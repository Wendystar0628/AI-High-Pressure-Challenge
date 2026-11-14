#include <cstdint>
#include <vector>
#include <cstring>
#include <algorithm>
#include <omp.h>
#include <immintrin.h>
#ifdef _WIN32
#include <windows.h>
#endif

struct Circuit {
    int I, F, G, O, M, T;
    uint64_t seed;
    std::vector<int> d;
    std::vector<uint8_t> type;
    std::vector<int> in0, in1, in2;
    std::vector<int> out;
};

static inline uint64_t splitmix64_next(uint64_t* s) {
    uint64_t z = (*s += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}
static inline uint64_t mix64(uint64_t x) { return splitmix64_next(&x); }

struct alignas(32) Vec4 { uint64_t w[4]; };

static inline void transpose64(uint64_t* a) {
    uint64_t m = 0x00000000FFFFFFFFULL;
    for (int j = 32; j; j >>= 1) {
        for (int k = 0; k < 64; k = (k + j + 1) & ~j) {
            uint64_t t = ((a[k] >> j) ^ a[k + j]) & m;
            a[k] ^= t << j;
            a[k + j] ^= t;
        }
        m = m ^ (m << (j >> 1));
    }
}

// ---------------- tiny x86-64 AVX2 code emitter ----------------
struct CodeBuf {
    uint8_t* p;
    uint8_t* base;
    bool ok;
    CodeBuf(size_t n) {
        base = (uint8_t*)VirtualAlloc(nullptr, n, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
        p = base;
        ok = (base != nullptr);
    }
    ~CodeBuf() { if (base) VirtualFree(base, 0, MEM_RELEASE); }
    inline void b(uint8_t x) { *p++ = x; }
    inline void d32(int32_t x) { memcpy(p, &x, 4); p += 4; }
};

// Fills VEX prefix + opcode + modrm (+disp32). reg/v/rm are ymm indices 0..15.
static inline void vex(CodeBuf& c, int reg, int v, int rm, int opcode, bool mem, int32_t disp) {
    int R = ((reg >> 3) & 1) ^ 1;
    int B = ((rm >> 3) & 1) ^ 1;
    int vf = (~v) & 0xF;
    if (R && B) {
        c.b(0xC5);
        c.b((uint8_t)((R << 7) | (vf << 3) | 4 | 1));
    } else {
        c.b(0xC4);
        c.b((uint8_t)((R << 7) | (1 << 6) | (B << 5) | 1));
        c.b((uint8_t)((vf << 3) | 4 | 1));
    }
    c.b((uint8_t)opcode);
    if (mem) {
        c.b((uint8_t)(0x80 | ((reg & 7) << 3) | 1));  // [rcx + disp32]
        c.d32(disp);
    } else {
        c.b((uint8_t)(0xC0 | ((reg & 7) << 3) | (rm & 7)));
    }
}
enum { OP_AND = 0, OP_OR = 1, OP_XOR = 2 };
static inline void e_load(CodeBuf& c, int d, int32_t disp) { vex(c, d, 0, 1, 0x6F, true, disp); }
static inline void e_store(CodeBuf& c, int s, int32_t disp) { vex(c, s, 0, 1, 0x7F, true, disp); }
static inline void e_alu_mem(CodeBuf& c, int op, int d, int v, int32_t disp) {
    static const uint8_t o[3] = {0xDB, 0xEB, 0xEF};
    vex(c, d, v, 1, o[op], true, disp);
}
static inline void e_alu_reg(CodeBuf& c, int op, int d, int v, int rm) {
    static const uint8_t o[3] = {0xDB, 0xEB, 0xEF};
    vex(c, d, v, rm, o[op], false, 0);
}
static inline void e_setones(CodeBuf& c, int r) { vex(c, r, r, r, 0x76, false, 0); }

std::vector<uint64_t> simulate(const Circuit& c) {
    const int I = c.I, F = c.F, G = c.G, O = c.O, M = c.M, T = c.T;
    const int baseFF = 2 + I;
    const int baseG = 2 + I + F;
    std::vector<uint64_t> result((size_t)M, 0);
    if (M <= 0) return result;

    // ---------- topological order ----------
    std::vector<uint32_t> cnt(G > 0 ? G : 1, 0);
    std::vector<int> indeg(G, 0);
    for (int k = 0; k < G; k++) {
        int s;
        if ((s = c.in0[k]) >= baseG) { cnt[s - baseG]++; indeg[k]++; }
        if (c.type[k] != 6 && (s = c.in1[k]) >= baseG) { cnt[s - baseG]++; indeg[k]++; }
        if (c.type[k] == 7 && (s = c.in2[k]) >= baseG) { cnt[s - baseG]++; indeg[k]++; }
    }
    std::vector<int> off(G + 1);
    off[0] = 0;
    for (int k = 0; k < G; k++) off[k + 1] = off[k] + (int)cnt[k];
    std::vector<int> cons(off[G]);
    {
        std::vector<int> pos(off.begin(), off.end() - 1);
        for (int k = 0; k < G; k++) {
            int s;
            if ((s = c.in0[k]) >= baseG) cons[pos[s - baseG]++] = k;
            if (c.type[k] != 6 && (s = c.in1[k]) >= baseG) cons[pos[s - baseG]++] = k;
            if (c.type[k] == 7 && (s = c.in2[k]) >= baseG) cons[pos[s - baseG]++] = k;
        }
    }
    std::vector<uint8_t> usedEnd(G, 0);
    for (int f = 0; f < F; f++) { int s = c.d[f]; if (s >= baseG) usedEnd[s - baseG] = 1; }
    for (int j = 0; j < O; j++) { int s = c.out[j]; if (s >= baseG) usedEnd[s - baseG] = 1; }

    std::vector<int> order;
    order.reserve(G);
    {
        std::vector<int> q(G);
        int muxCount = 0;
        for (int k = 0; k < G; k++) if (c.type[k] == 7) muxCount++;
        bool useLifo = (G > 0 && (long long)muxCount * 10 > (long long)G * 3);
        int qt = 0;
        for (int k = 0; k < G; k++) if (indeg[k] == 0) q[qt++] = k;
        if (useLifo) {
            while (qt > 0) {
                int k = q[--qt];
                order.push_back(k);
                for (int e = off[k]; e < off[k + 1]; e++) {
                    int t = cons[e];
                    if (--indeg[t] == 0) q[qt++] = t;
                }
            }
        } else {
            int qh = 0;
            while (qh < qt) {
                int k = q[qh++];
                order.push_back(k);
                for (int e = off[k]; e < off[k + 1]; e++) {
                    int t = cons[e];
                    if (--indeg[t] == 0) q[qt++] = t;
                }
            }
        }
    }
    if ((int)order.size() != G) return result;

    // ---------- slot allocation ----------
    std::vector<int> gslot(G);
    std::vector<int> freeStack;
    int nextSlot = 2 + I + F;
    std::vector<int> rem(G);
    for (int k = 0; k < G; k++) rem[k] = off[k + 1] - off[k];
    for (int p = 0; p < G; p++) {
        int k = order[p];
        int ds;
        if (!freeStack.empty()) { ds = freeStack.back(); freeStack.pop_back(); }
        else ds = nextSlot++;
        gslot[k] = ds;
        int s;
        if ((s = c.in0[k]) >= baseG) {
            int j = s - baseG;
            if (--rem[j] == 0 && !usedEnd[j]) freeStack.push_back(gslot[j]);
        }
        if (c.type[k] != 6 && (s = c.in1[k]) >= baseG) {
            int j = s - baseG;
            if (--rem[j] == 0 && !usedEnd[j]) freeStack.push_back(gslot[j]);
        }
        if (c.type[k] == 7 && (s = c.in2[k]) >= baseG) {
            int j = s - baseG;
            if (--rem[j] == 0 && !usedEnd[j]) freeStack.push_back(gslot[j]);
        }
    }
    const int nslots = nextSlot;

    std::vector<int> slotOf((size_t)baseG + G);
    slotOf[0] = 0; slotOf[1] = 1;
    for (int i = 0; i < I; i++) slotOf[2 + i] = 2 + i;
    for (int f = 0; f < F; f++) slotOf[baseFF + f] = baseFF + f;
    for (int k = 0; k < G; k++) slotOf[baseG + k] = gslot[k];

    std::vector<int32_t> ea(G), eb(G), ec(G), ed(G);
    std::vector<uint8_t> et(G);
    for (int p = 0; p < G; p++) {
        int k = order[p];
        et[p] = c.type[k];
        ea[p] = slotOf[c.in0[k]];
        eb[p] = (c.type[k] != 6) ? slotOf[c.in1[k]] : 0;
        ec[p] = (c.type[k] == 7) ? slotOf[c.in2[k]] : 0;
        ed[p] = gslot[k];
    }
    std::vector<int32_t> dslot(F), oslot(O);
    bool anyFFd = false;
    for (int f = 0; f < F; f++) {
        dslot[f] = slotOf[c.d[f]];
        if (c.d[f] >= baseFF && c.d[f] < baseG) anyFFd = true;
    }
    for (int j = 0; j < O; j++) oslot[j] = slotOf[c.out[j]];

    // ---------- code generation ----------
    CodeBuf cb((size_t)G * 64 + 65536);
    if (!cb.ok) return result;
    e_setones(cb, 3);
    {
        // Consumers remaining per gate (for one-step register fusion).
        std::vector<int> remG(G);
        for (int k = 0; k < G; k++) remG[k] = off[k + 1] - off[k];
        int pendSlot = -1, pendGate = -1;
        for (int p = 0; p < G; p++) {
            int k = order[p];
            int t = et[p];
            int sA = ea[p], sB = eb[p], sC = ec[p];
            int32_t oa = sA * 32, ob = sB * 32, oc = sC * 32;
            int usePos = -1;
            if (pendSlot >= 0) {
                if (sA == pendSlot) usePos = 0;
                else if (t != 6 && sB == pendSlot) usePos = 1;
                else if (t == 7 && sC == pendSlot) usePos = 2;
            }
            bool useP = usePos >= 0;
            bool canFuse = false;
            if (useP) {
#ifdef NOFUSE_ALL
                canFuse = false;
#else
                if (t <= 5) {
                    int other = (usePos == 0) ? sB : sA;
                    if (other != pendSlot) canFuse = true;
#ifdef NOFUSE_POS1
                    if (usePos == 1) canFuse = false;
#endif
#ifdef NOFUSE_INV
                    if (t >= 3) canFuse = false;
#endif
                } else if (t == 6) {
                    canFuse = true;
#ifdef NOFUSE_NOT
                    canFuse = false;
#endif
                } else {
                    if (usePos == 1 && sA != pendSlot && sC != pendSlot) canFuse = true;
#ifdef NOFUSE_MUX
                    canFuse = false;
#endif
                }
#endif
            }
            if (pendSlot >= 0) {
                int useCount = 0;
                if (sA == pendSlot) useCount++;
                if (t != 6 && sB == pendSlot) useCount++;
                if (t == 7 && sC == pendSlot) useCount++;
                bool neededAfter = (remG[pendGate] > useCount) || (usedEnd[pendGate] != 0);
                if (canFuse) {
                    if (neededAfter) e_store(cb, 0, pendSlot * 32);
                } else {
                    if (useP || neededAfter) e_store(cb, 0, pendSlot * 32);
                }
            }
            // bookkeeping: this gate consumes its gate-inputs
            if (sA >= 2 + I + F) remG[sA - (2 + I + F)]--;
            if (t != 6 && sB >= 2 + I + F) remG[sB - (2 + I + F)]--;
            if (t == 7 && sC >= 2 + I + F) remG[sC - (2 + I + F)]--;

            if (canFuse) {
                if (t <= 5) {
                    int other = (usePos == 0) ? sB : sA;
                    int32_t oo = (usePos == 0) ? ob : oa;
                    int op = (t == 0 || t == 3) ? OP_AND : (t == 1 || t == 4 ? OP_OR : OP_XOR);
                    e_alu_mem(cb, op, 0, 0, oo);
                    if (t >= 3) e_alu_reg(cb, OP_XOR, 0, 0, 3);
                } else if (t == 6) {
                    e_alu_reg(cb, OP_XOR, 0, 0, 3);
                } else {
                    e_alu_mem(cb, OP_XOR, 1, 0, oc);  // a ^ b
                    e_alu_mem(cb, OP_AND, 1, 1, oa);  // & s
                    e_alu_reg(cb, OP_XOR, 0, 0, 1);   // a ^ ...
                }
            } else {
                switch (t) {
                    case 0: e_load(cb, 0, oa); e_alu_mem(cb, OP_AND, 0, 0, ob); break;
                    case 1: e_load(cb, 0, oa); e_alu_mem(cb, OP_OR, 0, 0, ob); break;
                    case 2: e_load(cb, 0, oa); e_alu_mem(cb, OP_XOR, 0, 0, ob); break;
                    case 3: e_load(cb, 0, oa); e_alu_mem(cb, OP_AND, 0, 0, ob); e_alu_reg(cb, OP_XOR, 0, 0, 3); break;
                    case 4: e_load(cb, 0, oa); e_alu_mem(cb, OP_OR, 0, 0, ob); e_alu_reg(cb, OP_XOR, 0, 0, 3); break;
                    case 5: e_load(cb, 0, oa); e_alu_mem(cb, OP_XOR, 0, 0, ob); e_alu_reg(cb, OP_XOR, 0, 0, 3); break;
                    case 6: e_load(cb, 0, oa); e_alu_reg(cb, OP_XOR, 0, 0, 3); break;
                    default:
                        e_load(cb, 0, ob);               // a = in1
                        e_alu_mem(cb, OP_XOR, 1, 0, oc); // a ^ b
                        e_alu_mem(cb, OP_AND, 1, 1, oa); // & s
                        e_alu_reg(cb, OP_XOR, 0, 0, 1);  // a ^ ...
                        break;
                }
            }
            pendSlot = ed[p];
            pendGate = k;
#ifdef ALWAYS_STORE
            e_store(cb, 0, ed[p] * 32);
#endif
        }
        if (pendSlot >= 0 && (remG[pendGate] > 0 || usedEnd[pendGate] != 0))
            e_store(cb, 0, pendSlot * 32);
    }
    cb.b(0xC5); cb.b(0xF8); cb.b(0x77); cb.b(0xC3);  // vzeroupper; ret
#ifdef VERIFY_SLOTS
    {
        std::vector<Vec4> A(nslots), B(nslots);
        for (int i = 0; i < nslots; i++) for (int j = 0; j < 4; j++) { A[i].w[j] = B[i].w[j] = (uint64_t)(i * 131 + j * 7 + 1); }
        for (int p = 0; p < G; p++) {
            __m256i a = _mm256_load_si256((const __m256i*)A[ea[p]].w);
            __m256i b = _mm256_load_si256((const __m256i*)A[eb[p]].w);
            __m256i r;
            switch (et[p]) {
                case 0: r = _mm256_and_si256(a, b); break;
                case 1: r = _mm256_or_si256(a, b); break;
                case 2: r = _mm256_xor_si256(a, b); break;
                case 3: r = _mm256_xor_si256(_mm256_and_si256(a, b), _mm256_set1_epi64x(-1)); break;
                case 4: r = _mm256_xor_si256(_mm256_or_si256(a, b), _mm256_set1_epi64x(-1)); break;
                case 5: r = _mm256_xor_si256(_mm256_xor_si256(a, b), _mm256_set1_epi64x(-1)); break;
                case 6: r = _mm256_xor_si256(a, _mm256_set1_epi64x(-1)); break;
                default: { __m256i cc = _mm256_load_si256((const __m256i*)A[ec[p]].w); __m256i tt = _mm256_xor_si256(b, cc); r = _mm256_xor_si256(b, _mm256_and_si256(tt, a)); break; }
            }
            _mm256_store_si256((__m256i*)A[ed[p]].w, r);
        }
        ((void(*)(void*))cb.base)(B.data());
        int bad = 0;
        std::vector<int> slotGate(nslots, -1);
        for (int p = 0; p < G; p++) slotGate[ed[p]] = order[p];
        std::vector<int> roots;
        for (int f = 0; f < F; f++) roots.push_back(dslot[f]);
        for (int j = 0; j < O; j++) roots.push_back(oslot[j]);
        for (int i : roots) for (int j = 0; j < 4; j++)
            if (A[i].w[j] != B[i].w[j]) { fprintf(stderr, "ROOTDIFF slot=%d gate=%d word=%d interp=%llx jit=%llx\n", i, slotGate[i], j, (unsigned long long)A[i].w[j], (unsigned long long)B[i].w[j]); bad++; break; }
        if (!bad) fprintf(stderr, "ROOTS OK (%d checked)\n", (int)roots.size());
    }
#endif
    typedef void (*Fn)(void*);
    Fn fn = (Fn)cb.base;

    // ---------- parallel simulation ----------
    const int nw = (M + 63) / 64;
    const int CW = 4;
    const int nchunks = (nw + CW - 1) / CW;
    int nt = omp_get_max_threads();
    if (nt > 8) nt = 8;
    if (nt > nchunks) nt = nchunks;
    if (nt < 1) nt = 1;
#ifdef FORCE_THREADS
    nt = FORCE_THREADS;
    if (nt > nchunks) nt = nchunks;
#endif

#pragma omp parallel num_threads(nt)
    {
        int tid = omp_get_thread_num();
        int c0 = (int)((long long)nchunks * tid / nt);
        int c1 = (int)((long long)nchunks * (tid + 1) / nt);

        std::vector<Vec4> S((size_t)nslots);
        Vec4* s = S.data();
        for (int i = 0; i < nslots; i++)
            _mm256_store_si256((__m256i*)s[i].w, _mm256_setzero_si256());
        _mm256_store_si256((__m256i*)s[1].w, _mm256_set1_epi64x(-1));

        alignas(64) uint64_t rng[256];
        alignas(64) uint64_t rstate[256];
        alignas(64) uint64_t outbits[64][4];
        alignas(64) uint64_t maskm[256];
        uint64_t tbl[8][256];

        for (int chunk = c0; chunk < c1; chunk++) {
            int m0 = chunk * 256;
            int nvalid = std::min(256, M - m0);
            // reset flip-flop state for this group of sequences (all FFs start at 0)
            if (F > 0) {
                const __m256i z = _mm256_setzero_si256();
                for (int f = 0; f < F; f++)
                    _mm256_store_si256((__m256i*)s[baseFF + f].w, z);
            }
            for (int j = 0; j < 256; j++)
                rstate[j] = mix64(c.seed ^ (uint64_t)(m0 + j));
            uint64_t HH[256];
            for (int j = 0; j < 256; j++) HH[j] = 0;

            for (int t = 0; t < T; t++) {
                for (int j = 0; j < 256; j++) rng[j] = splitmix64_next(&rstate[j]);
                for (int g = 0; g < 4; g++) {
                    uint64_t tmp[64];
                    for (int j = 0; j < 64; j++) tmp[j] = rng[g * 64 + j];
                    transpose64(tmp);
                    for (int i = 0; i < I; i++) s[2 + i].w[g] = tmp[i];
                }

                fn(s);

                // digest
                uint64_t C[64];
                for (int j = 0; j < O; j++) C[j] = mix64((uint64_t)t * O + j);
                for (int j = O; j < 64; j++) C[j] = 0;
                for (int e = 0; e < 8; e++) {
                    tbl[e][0] = 0;
                    for (int v = 1; v < 256; v++) {
                        int b = __builtin_ctz(v);
                        tbl[e][v] = tbl[e][v & (v - 1)] ^ C[e * 8 + b];
                    }
                }
                for (int j = 0; j < O; j++)
                    for (int g = 0; g < 4; g++) outbits[j][g] = s[oslot[j]].w[g];
                for (int j = O; j < 64; j++)
                    for (int g = 0; g < 4; g++) outbits[j][g] = 0;
                for (int g = 0; g < 4; g++) {
                    uint64_t tmp[64];
                    for (int j = 0; j < 64; j++) tmp[j] = outbits[j][g];
                    transpose64(tmp);
                    for (int m = 0; m < 64; m++) maskm[g * 64 + m] = tmp[m];
                }
                for (int m = 0; m < nvalid; m++) {
                    uint64_t mk = maskm[m];
                    HH[m] ^= tbl[0][mk & 255] ^ tbl[1][(mk >> 8) & 255] ^
                             tbl[2][(mk >> 16) & 255] ^ tbl[3][(mk >> 24) & 255] ^
                             tbl[4][(mk >> 32) & 255] ^ tbl[5][(mk >> 40) & 255] ^
                             tbl[6][(mk >> 48) & 255] ^ tbl[7][(mk >> 56) & 255];
                }

                // FF update
                if (!anyFFd) {
                    for (int f = 0; f < F; f++) {
                        int ds = dslot[f];
                        if (ds == baseFF + f) continue;
                        _mm256_store_si256((__m256i*)s[baseFF + f].w,
                                           _mm256_load_si256((const __m256i*)s[ds].w));
                    }
                } else {
                    std::vector<Vec4> tmp(F > 0 ? F : 1);
                    for (int f = 0; f < F; f++) tmp[f] = s[dslot[f]];
                    for (int f = 0; f < F; f++) s[baseFF + f] = tmp[f];
                }
            }
            for (int m = 0; m < nvalid; m++) result[m0 + m] = HH[m];
        }
    }
    return result;
}
