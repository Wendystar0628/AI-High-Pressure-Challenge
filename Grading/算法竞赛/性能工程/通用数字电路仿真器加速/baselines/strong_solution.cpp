// Strong baseline for 通用数字电路仿真器加速: a general-purpose optimized solution written by the
// setter. It implements simulate() for grader.cpp and follows the problem rules (single file,
// C++ standard library + OpenMP, CPU only).
//   - only gates that can affect an output or flip-flop are kept (DFS from the sinks)
//   - evaluation order: DFS post-order or level order, whichever needs fewer value slots;
//     slots of dead values are reused so the working set per block stays small
//   - software prefetch of the operands PF instructions ahead
//   - 256 stimuli per AVX2 vector, V vectors per block, blocks spread over threads
//   - branch-free gate kernel: out = inv ^ (a&ka) ^ (b&kb) ^ (a&b&kab) ^ (s&(a^b)&ks)
//   - 64x64 bit transposes for the primary inputs and for the output digest
// Build: g++ -O2 -std=c++20 -march=native -fopenmp -o strong.exe grader.cpp strong_solution.cpp
#include <immintrin.h>
#include <omp.h>
#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
using namespace std;
typedef uint64_t u64;

#ifndef PF
#define PF 16
#endif
#ifndef VEC_PER_BLOCK
#define VEC_PER_BLOCK 1
#endif
static const int V = VEC_PER_BLOCK;

static u64 sm_next(u64* s) {
    u64 z = (*s += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}
static u64 mix64(u64 x) { return sm_next(&x); }

static void transpose64(u64* a) {  // afterwards bit c of a[r] = old bit r of a[c]
    u64 m = 0x00000000FFFFFFFFULL;
    for (int j = 32; j; j >>= 1, m ^= m << j)
        for (int k = 0; k < 64; k = ((k | j) + 1) & ~j) {
            u64 t = ((a[k] >> j) ^ a[k | j]) & m;
            a[k] ^= t << j;
            a[k | j] ^= t;
        }
}

struct Instr { int a, b, s, o, kind; };

struct Circuit {
    int I, F, G, O, M, T;
    uint64_t seed;
    std::vector<int> d;
    std::vector<uint8_t> type;
    std::vector<int> in0, in1, in2;
    std::vector<int> out;
};

std::vector<uint64_t> simulate(const Circuit& c) {
    const int I = c.I, F = c.F, G = c.G, O = c.O, M = c.M, T = c.T;
    const u64 seed = c.seed;
    const int BFF = 2 + I, BG = BFF + F;
    const vector<int>& d = c.d;
    const vector<int>& outs = c.out;
    vector<int> gk(G), ga(G), gb(G), gsel(G);
    for (int k = 0; k < G; k++) {
        int t = c.type[k];
        gk[k] = t;
        if (t == 7) { gsel[k] = c.in0[k]; ga[k] = c.in1[k]; gb[k] = c.in2[k]; }
        else if (t == 6) { ga[k] = c.in0[k]; gb[k] = ga[k]; gsel[k] = ga[k]; }
        else { ga[k] = c.in0[k]; gb[k] = c.in1[k]; gsel[k] = ga[k]; }
    }

    // DFS post-order from the sinks (flip-flop inputs, then outputs); unreachable gates are dropped.
    vector<char> st(G, 0);
    vector<int> dfsOrder;
    dfsOrder.reserve(G);
    vector<pair<int, int>> stk;
    auto visit = [&](int sig) {
        if (sig < BG || st[sig - BG]) return;
        stk.push_back({sig - BG, 0});
        st[sig - BG] = 1;
        while (!stk.empty()) {
            auto& [k, e] = stk.back();
            int in3[3] = {gsel[k], ga[k], gb[k]};
            if (e < 3) {
                int s = in3[e++];
                if (s >= BG && !st[s - BG]) { st[s - BG] = 1; stk.push_back({s - BG, 0}); }
            } else {
                dfsOrder.push_back(k);
                stk.pop_back();
            }
        }
    };
    for (int f = 0; f < F; f++) visit(d[f]);
    for (int j = 0; j < O; j++) visit(outs[j]);
    const int n = (int)dfsOrder.size();

    // Second candidate order: by level (longest path from the inputs), stable within a level.
    vector<int> lvl(G, 0);
    int maxLvl = 0;
    for (int k : dfsOrder) {
        int in3[3] = {gsel[k], ga[k], gb[k]};
        for (int s : in3) if (s >= BG) lvl[k] = max(lvl[k], lvl[s - BG] + 1);
        maxLvl = max(maxLvl, lvl[k]);
    }
    vector<int> lvlOrder(n), cnt(maxLvl + 2, 0);
    for (int k : dfsOrder) cnt[lvl[k] + 1]++;
    for (int i = 1; i <= maxLvl + 1; i++) cnt[i] += cnt[i - 1];
    for (int k : dfsOrder) lvlOrder[cnt[lvl[k]]++] = k;

    // Slot allocation: fixed slots for constants, inputs and flip-flops; reuse slots of dead values.
    vector<char> keep(G, 0);
    for (int f = 0; f < F; f++) if (d[f] >= BG) keep[d[f] - BG] = 1;
    for (int j = 0; j < O; j++) if (outs[j] >= BG) keep[outs[j] - BG] = 1;
    struct Plan { int nslots; vector<Instr> prog; vector<int> slotOf; };
    auto allocate = [&](const vector<int>& order) {
        Plan pl{BG, vector<Instr>(n), vector<int>(G, -1)};
        vector<int> last(G, -1), freeList;
        for (int p = 0; p < n; p++) {
            int k = order[p];
            int in3[3] = {gsel[k], ga[k], gb[k]};
            for (int s : in3) if (s >= BG) last[s - BG] = p;
        }
        for (int p = 0; p < n; p++) {
            int k = order[p];
            auto slot = [&](int s) { return s < BG ? s : pl.slotOf[s - BG]; };
            Instr ins{slot(ga[k]), slot(gb[k]), slot(gsel[k]), 0, gk[k]};
            int in3[3] = {gsel[k], ga[k], gb[k]};
            for (int q = 0; q < 3; q++) {
                int s = in3[q];
                if (s < BG) continue;
                int cc = s - BG;
                bool dup = false;
                for (int r = 0; r < q; r++) dup |= in3[r] == s;
                if (!dup && last[cc] == p && !keep[cc]) freeList.push_back(pl.slotOf[cc]);
            }
            int o;
            if (!freeList.empty()) { o = freeList.back(); freeList.pop_back(); }
            else o = pl.nslots++;
            pl.slotOf[k] = o;
            ins.o = o;
            pl.prog[p] = ins;
        }
        return pl;
    };
    Plan pa = allocate(dfsOrder), pb = allocate(lvlOrder);
    Plan& best = pa.nslots <= pb.nslots ? pa : pb;
    const int nslots = best.nslots;
    vector<Instr>& prog = best.prog;
    vector<int>& slotOf = best.slotOf;
    for (auto& ins : prog) { ins.a *= V; ins.b *= V; ins.s *= V; ins.o *= V; }
    vector<int> dslot(F), oslot(O);
    for (int f = 0; f < F; f++) dslot[f] = (d[f] < BG ? d[f] : slotOf[d[f] - BG]) * V;
    for (int j = 0; j < O; j++) oslot[j] = (outs[j] < BG ? outs[j] : slotOf[outs[j] - BG]) * V;

    // Per-kind masks: inv, ka, kb, kab, ks.
    static const int KM[8][5] = {
        {0, 0, 0, 1, 0}, {0, 1, 1, 1, 0}, {0, 1, 1, 0, 0}, {1, 0, 0, 1, 0},
        {1, 1, 1, 1, 0}, {1, 1, 1, 0, 0}, {1, 1, 0, 0, 0}, {0, 1, 0, 0, 1}};
    alignas(32) __m256i masks[8][5];
    for (int k = 0; k < 8; k++)
        for (int q = 0; q < 5; q++) masks[k][q] = _mm256_set1_epi64x(KM[k][q] ? -1LL : 0);

    // Digest tables: for cycle t and output group g (8 outputs), XOR of keys selected by a byte.
    const int groups = (O + 7) / 8;
    vector<u64> tab((size_t)T * groups * 256);
    for (int t = 0; t < T; t++)
        for (int g = 0; g < groups; g++) {
            u64* tb = &tab[((size_t)t * groups + g) * 256];
            tb[0] = 0;
            for (int v = 1; v < 256; v++) {
                int b = __builtin_ctz(v), j = g * 8 + b;
                tb[v] = tb[v & (v - 1)] ^ (j < O ? mix64((u64)t * O + j) : 0);
            }
        }

    const int lanesPerBlock = 256 * V;
    const int blocks = (M + lanesPerBlock - 1) / lanesPerBlock;
    vector<u64> H(M, 0);
#pragma omp parallel
    {
        __m256i* val = (__m256i*)_mm_malloc(sizeof(__m256i) * (size_t)nslots * V, 32);
        __m256i* nextFF = (__m256i*)_mm_malloc(sizeof(__m256i) * (size_t)F * V, 32);
        vector<u64> rs(lanesPerBlock), Hl(lanesPerBlock);
        alignas(64) u64 mat[64];
#pragma omp for schedule(dynamic, 1)
        for (int blk = 0; blk < blocks; blk++) {
            int lane0 = blk * lanesPerBlock;
            int lanes = min(lanesPerBlock, M - lane0);
            for (int l = 0; l < lanesPerBlock; l++) { rs[l] = l < lanes ? mix64(seed ^ (u64)(lane0 + l)) : 0; Hl[l] = 0; }
            u64* vp = (u64*)val;
            for (int v = 0; v < V; v++) {
                val[0 * V + v] = _mm256_setzero_si256();
                val[1 * V + v] = _mm256_set1_epi64x(-1LL);
            }
            for (int f = 0; f < F; f++) for (int v = 0; v < V; v++) val[(BFF + f) * V + v] = _mm256_setzero_si256();
            for (int t = 0; t < T; t++) {
                // Primary inputs: transpose 64 lanes x 64 bits per lane word.
                for (int q = 0; q < 4 * V; q++) {
                    for (int l = 0; l < 64; l++) {
                        int lane = q * 64 + l;
                        mat[l] = lane < lanes ? sm_next(&rs[lane]) : 0;
                    }
                    transpose64(mat);
                    int v = q / 4, w = q % 4;
                    for (int i = 0; i < I; i++) vp[((size_t)(2 + i) * V + v) * 4 + w] = mat[i];
                }
                // Gates.
                const Instr* P = prog.data();
                for (int p = 0; p < n; p++) {
                    const Instr& ins = P[p];
                    if (PF && p + PF < n) {
                        const Instr& q = P[p + PF];
                        _mm_prefetch((const char*)&val[q.a], _MM_HINT_T0);
                        _mm_prefetch((const char*)&val[q.b], _MM_HINT_T0);
                        _mm_prefetch((const char*)&val[q.s], _MM_HINT_T0);
                    }
                    const __m256i* mk = masks[ins.kind];
                    for (int v = 0; v < V; v++) {
                        __m256i A = val[ins.a + v], B = val[ins.b + v], S = val[ins.s + v];
                        __m256i r = _mm256_xor_si256(mk[0], _mm256_and_si256(A, mk[1]));
                        r = _mm256_xor_si256(r, _mm256_and_si256(B, mk[2]));
                        r = _mm256_xor_si256(r, _mm256_and_si256(_mm256_and_si256(A, B), mk[3]));
                        r = _mm256_xor_si256(r, _mm256_and_si256(_mm256_and_si256(S, _mm256_xor_si256(A, B)), mk[4]));
                        val[ins.o + v] = r;
                    }
                }
                // Output digest: transpose outputs (64 at a time) into per-lane words.
                for (int q = 0; q < 4 * V; q++) {
                    int v = q / 4, w = q % 4;
                    for (int j0 = 0; j0 < O; j0 += 64) {
                        for (int j = 0; j < 64; j++)
                            mat[j] = j0 + j < O ? vp[((size_t)oslot[j0 + j] + v) * 4 + w] : 0;
                        transpose64(mat);
                        const u64* tb = &tab[((size_t)t * groups + j0 / 8) * 256];
                        int gcount = min(8, groups - j0 / 8);
                        for (int l = 0; l < 64; l++) {
                            int lane = q * 64 + l;
                            if (lane >= lanes) break;
                            u64 x = mat[l], h = 0;
                            for (int g = 0; g < gcount; g++) h ^= tb[g * 256 + ((x >> (8 * g)) & 255)];
                            Hl[lane] ^= h;
                        }
                    }
                }
                // Flip-flops update simultaneously.
                for (int f = 0; f < F; f++) for (int v = 0; v < V; v++) nextFF[f * V + v] = val[dslot[f] + v];
                for (int f = 0; f < F; f++) for (int v = 0; v < V; v++) val[(BFF + f) * V + v] = nextFF[f * V + v];
            }
            for (int l = 0; l < lanes; l++) H[lane0 + l] = Hl[l];
        }
        _mm_free(val);
        _mm_free(nextFF);
    }
    return H;
}
