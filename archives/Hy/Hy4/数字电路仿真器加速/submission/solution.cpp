// Stage 3: type-grouped topological order + per-run dispatch (branch-friendly).
#include <cstdint>
#include <vector>
#include <cstring>
#include <immintrin.h>

struct Circuit {
    int I, F, G, O, M, T;
    uint64_t seed;
    std::vector<int> d;
    std::vector<uint8_t> type;
    std::vector<int> in0, in1, in2;
    std::vector<int> out;
};

static inline uint64_t splitmix_next(uint64_t &s) {
    uint64_t z = (s += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}
static inline uint64_t mix64(uint64_t x) { return splitmix_next(x); }

static void transpose64(uint64_t A[64]) {
    static const uint64_t HM[6] = {
        0xAAAAAAAAAAAAAAAAULL, 0xCCCCCCCCCCCCCCCCULL, 0xF0F0F0F0F0F0F0F0ULL,
        0xFF00FF00FF00FF00ULL, 0xFFFF0000FFFF0000ULL, 0xFFFFFFFF00000000ULL
    };
    for (int s = 0; s < 6; s++) {
        int j = 1 << s;
        uint64_t hm = HM[s];
        for (int r = 0; r < 64; r++) if ((r & j) == 0) {
            int r2 = r | j;
            uint64_t t = (A[r] ^ (A[r2] << j)) & hm;
            A[r] ^= t;
            A[r2] ^= (t >> j);
        }
    }
}

static const int WPT   = 4;
static const int NV    = WPT / 4;
static const int NTMAX = 16;

struct Inst { uint32_t a, b, c, d; uint8_t op; };
struct Run  { uint8_t op; uint32_t start, len; };

std::vector<uint64_t> simulate(const Circuit& c) {
    const int I = c.I, F = c.F, G = c.G, O = c.O, M = c.M, T = c.T;
    const uint64_t seed = c.seed;
    const int GSLOT = 2 + I + F;
    const int BATCH = WPT * 64;
    int paddedM = ((M + BATCH - 1) / BATCH) * BATCH;
    int Wtotal  = paddedM / 64;
    int NC      = paddedM / BATCH;

    auto nin = [&](int k, int* arr) -> int {
        int n = 0;
        arr[n++] = c.in0[k];
        if (c.type[k] != 6) arr[n++] = c.in1[k];
        if (c.type[k] == 7) arr[n++] = c.in2[k];
        return n;
    };

    // ---- dependency graph ----
    std::vector<int> indeg(G, 0), outdeg(G, 0);
    for (int k = 0; k < G; k++) {
        int a[3], n = nin(k, a);
        for (int i = 0; i < n; i++) if (a[i] >= GSLOT) { indeg[k]++; outdeg[a[i] - GSLOT]++; }
    }
    std::vector<int> off(G + 1, 0);
    for (int p = 0; p < G; p++) off[p + 1] = off[p] + outdeg[p];
    std::vector<int> succ(off[G]);
    {
        std::vector<int> cur(off.begin(), off.end() - 1);
        for (int k = 0; k < G; k++) {
            int a[3], n = nin(k, a);
            for (int i = 0; i < n; i++) if (a[i] >= GSLOT) succ[cur[a[i] - GSLOT]++] = k;
        }
    }

    // ---- type-run topological order (Kahn with per-type queues) ----
    std::vector<int> order; order.reserve(G);
    std::vector<int> topoPos(G, -1);
    {
        std::vector<int> deg = indeg;
        std::vector<int> q[8];
        size_t qi[8] = {0,0,0,0,0,0,0,0};
        for (int k = 0; k < G; k++) if (deg[k] == 0) q[c.type[k]].push_back(k);
        int emitted = 0, cur = -1;
        while (emitted < G) {
            int t = -1;
            if (cur >= 0 && qi[cur] < q[cur].size()) t = cur;
            else {
                size_t best = 0;
                for (int tt = 0; tt < 8; tt++) {
                    size_t sz = q[tt].size() - qi[tt];
                    if (sz > best) { best = sz; t = tt; }
                }
            }
            if (t < 0) break;
            cur = t;
            while (qi[t] < q[t].size()) {
                int g = q[t][qi[t]++];
                order.push_back(g); emitted++;
                for (int e = off[g]; e < off[g + 1]; e++) {
                    int v = succ[e];
                    if (--deg[v] == 0) q[c.type[v]].push_back(v);
                }
            }
        }
        for (int i = 0; i < (int)order.size(); i++) topoPos[order[i]] = i;
    }
    const int NG = (int)order.size();

    // ---- death times ----
    std::vector<int> death(NG, 0);
    for (int p = 0; p < NG; p++) death[p] = p;
    for (int q = 0; q < NG; q++) {
        int k = order[q];
        int a[3], n = nin(k, a);
        for (int i = 0; i < n; i++) if (a[i] >= GSLOT) {
            int pp = topoPos[a[i] - GSLOT];
            if (q > death[pp]) death[pp] = q;
        }
    }
    for (int j = 0; j < O; j++) { int s = c.out[j]; if (s >= GSLOT) death[topoPos[s - GSLOT]] = NG; }
    for (int f = 0; f < F; f++) { int s = c.d[f];   if (s >= GSLOT) death[topoPos[s - GSLOT]] = NG; }

    // ---- slot recycling + program build ----
    std::vector<int> relHead(NG + 2, -1);
    std::vector<int> relNext;
    std::vector<int> freePool;
    std::vector<int> slotOfGate(G, GSLOT);
    std::vector<Inst> prog; prog.reserve(NG);
    int nextSlot = 0;

    auto loc = [&](int s) -> uint32_t {
        if (s < GSLOT) return (uint32_t)s * WPT;
        return (uint32_t)slotOfGate[s - GSLOT] * WPT;
    };

    for (int p = 0; p < NG; p++) {
        for (int sl = relHead[p]; sl != -1; ) {
            int nx = relNext[sl];
            freePool.push_back(sl);
            sl = nx;
        }
        int slot;
        if (!freePool.empty()) { slot = freePool.back(); freePool.pop_back(); }
        else { slot = nextSlot++; relNext.push_back(-1); }
        int gate = order[p];
        slotOfGate[gate] = GSLOT + slot;

        int a[3], n = nin(gate, a);
        Inst in;
        in.op = c.type[gate];
        in.a = loc(a[0]);
        in.b = (n >= 2) ? loc(a[1]) : in.a;
        in.c = (n >= 3) ? loc(a[2]) : in.b;
        in.d = (uint32_t)(GSLOT + slot) * WPT;
        prog.push_back(in);

        int r = death[p] + 1;
        if (r <= NG - 1) { relNext[slot] = relHead[r]; relHead[r] = slot; }
        else             { relNext[slot] = -1; }
    }
    int slotsUsed = nextSlot;

    // ---- build runs (consecutive same-op instructions) ----
    std::vector<Run> runs;
    for (int p = 0; p < NG; ) {
        int q = p + 1;
        while (q < NG && prog[q].op == prog[p].op) q++;
        runs.push_back({prog[p].op, (uint32_t)p, (uint32_t)(q - p)});
        p = q;
    }

    std::vector<uint32_t> locOut(O), locD(F);
    for (int j = 0; j < O; j++) locOut[j] = loc(c.out[j]);
    for (int f = 0; f < F; f++) locD[f]   = loc(c.d[f]);

    int memslots = GSLOT + slotsUsed;

    // ---- precompute PI ----
    std::vector<uint64_t> PI((size_t)T * I * Wtotal);
    {
        std::vector<uint64_t> state(paddedM);
        for (int m = 0; m < paddedM; m++) state[m] = mix64(seed ^ (uint64_t)m);
        for (int t = 0; t < T; t++) {
            for (int w = 0; w < Wtotal; w++) {
                uint64_t r[64];
                for (int b = 0; b < 64; b++) r[b] = splitmix_next(state[w * 64 + b]);
                transpose64(r);
                for (int i = 0; i < I; i++) PI[((size_t)t * I + i) * Wtotal + w] = r[i];
            }
        }
    }

    std::vector<uint64_t> wt((size_t)T * O);
    for (int t = 0; t < T; t++)
        for (int j = 0; j < O; j++) wt[(size_t)t * O + j] = mix64((uint64_t)t * O + j);

    // ---- simulate ----
    std::vector<uint64_t> H(paddedM, 0);
    int NT = NTMAX < NC ? NTMAX : NC;
    if (NT < 1) NT = 1;

    #define BODY2(EXPR) \
        for (uint32_t i = 0; i < R.len; i++) { \
            const Inst& in = P[i]; \
            uint64_t* A = mem + in.a; uint64_t* B = mem + in.b; uint64_t* D = mem + in.d; \
            for (int v = 0; v < NV; v++) { \
                __m256i x = _mm256_load_si256((const __m256i*)(A + 4*v)); \
                __m256i y = _mm256_load_si256((const __m256i*)(B + 4*v)); \
                _mm256_store_si256((__m256i*)(D + 4*v), (EXPR)); \
            } \
        }

    #pragma omp parallel num_threads(NT)
    {
        const __m256i ONES = _mm256_set1_epi64x(-1);
        uint64_t* mem = (uint64_t*)_mm_malloc((size_t)memslots * WPT * 8, 64);
        for (int w = 0; w < WPT; w++) { mem[w] = 0; mem[WPT + w] = ~0ULL; }
        std::vector<uint64_t> ffnew((size_t)F * WPT);

        #pragma omp for schedule(static)
        for (int chunk = 0; chunk < NC; chunk++) {
            uint64_t* ffbase = mem + (size_t)(2 + I) * WPT;
            memset(ffbase, 0, (size_t)F * WPT * 8);
            const int wb   = chunk * WPT;
            const int base = chunk * BATCH;

            for (int t = 0; t < T; t++) {
                for (int i = 0; i < I; i++) {
                    uint64_t* dst = mem + (size_t)(2 + i) * WPT;
                    const uint64_t* src = &PI[((size_t)t * I + i) * Wtotal + wb];
                    for (int w = 0; w < WPT; w++) dst[w] = src[w];
                }
                for (size_t ri = 0; ri < runs.size(); ri++) {
                    const Run& R = runs[ri];
                    const Inst* P = prog.data() + R.start;
                    switch (R.op) {
                        case 0: BODY2(_mm256_and_si256(x,y)) break;
                        case 1: BODY2(_mm256_or_si256(x,y)) break;
                        case 2: BODY2(_mm256_xor_si256(x,y)) break;
                        case 3: BODY2(_mm256_xor_si256(_mm256_and_si256(x,y),ONES)) break;
                        case 4: BODY2(_mm256_xor_si256(_mm256_or_si256(x,y),ONES)) break;
                        case 5: BODY2(_mm256_xor_si256(_mm256_xor_si256(x,y),ONES)) break;
                        case 6: for (uint32_t i2=0;i2<R.len;i2++){ const Inst& in=P[i2]; uint64_t* A=mem+in.a; uint64_t* D=mem+in.d; for(int v=0;v<NV;v++){ __m256i x=_mm256_load_si256((const __m256i*)(A+4*v)); _mm256_store_si256((__m256i*)(D+4*v), _mm256_xor_si256(x,ONES)); } } break;
                        case 7: for (uint32_t i2=0;i2<R.len;i2++){ const Inst& in=P[i2]; uint64_t* A=mem+in.a; uint64_t* B=mem+in.b; uint64_t* C=mem+in.c; uint64_t* D=mem+in.d; for(int v=0;v<NV;v++){ __m256i s=_mm256_load_si256((const __m256i*)(A+4*v)); __m256i a=_mm256_load_si256((const __m256i*)(B+4*v)); __m256i b=_mm256_load_si256((const __m256i*)(C+4*v)); _mm256_store_si256((__m256i*)(D+4*v), _mm256_xor_si256(a, _mm256_and_si256(s, _mm256_xor_si256(a,b)))); } } break;
                    }
                }
                for (int j = 0; j < O; j++) {
                    uint64_t* src = mem + locOut[j];
                    uint64_t W = wt[(size_t)t * O + j];
                    for (int w = 0; w < WPT; w++) {
                        uint64_t mask = src[w];
                        while (mask) { int b = __builtin_ctzll(mask); H[base + w*64 + b] ^= W; mask &= mask - 1; }
                    }
                }
                for (int f = 0; f < F; f++) {
                    uint64_t* src = mem + locD[f];
                    for (int w = 0; w < WPT; w++) ffnew[(size_t)f * WPT + w] = src[w];
                }
                memcpy(ffbase, ffnew.data(), (size_t)F * WPT * 8);
            }
        }
        _mm_free(mem);
    }
    #undef BODY2

    H.resize(M);
    return H;
}
