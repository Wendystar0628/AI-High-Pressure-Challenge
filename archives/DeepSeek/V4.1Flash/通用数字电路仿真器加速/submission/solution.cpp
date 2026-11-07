#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <vector>
#include <algorithm>
#include <immintrin.h>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

#ifdef _OPENMP
#include <omp.h>
#endif

struct Circuit {
    int I, F, G, O, M, T;
    uint64_t seed;
    std::vector<int> d;
    std::vector<uint8_t> type;
    std::vector<int> in0, in1, in2;
    std::vector<int> out;
};

#ifndef USE_INTERP
#define USE_INTERP 0
#endif
#ifndef NT_OVERRIDE
#define NT_OVERRIDE 0
#endif

static inline uint64_t sm64(uint64_t &s) {
    uint64_t z = (s += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}

static inline void transpose64(uint64_t a[64]) {
    uint64_t m = 0x00000000FFFFFFFFULL;
    for (int j = 32; j != 0; ) {
        for (int k = 0; k < 64; k = ((k | j) + 1) & ~j) {
            uint64_t t = ((a[k] >> j) ^ a[k | j]) & m;
            a[k] ^= (t << j);
            a[k | j] ^= t;
        }
        j >>= 1;
        if (j) m ^= m << j;
    }
}

namespace {

constexpr int W = 4;  // 64-bit words per batch (AVX2 width)

// input references: >=0 gate position, <0 fixed slot (-ref-1)
struct Build {
    int n = 0;
    int nSlots = 0;
    std::vector<int> order;   // position -> original gate
    std::vector<int> type;
    std::vector<int> ra, rb, rc;  // input refs
    std::vector<int> outSlot;
    std::vector<int> lastUse;
    std::vector<uint8_t> isLast;
    std::vector<int> dRef;
    std::vector<int> outRef;
    std::vector<int> ffSlot;
    std::vector<int> ffUserStart;   // CSR: value -> flip-flops using it as d
    std::vector<int> ffUserList;
    std::vector<uint8_t> isOut;
    bool dIsFF = false;
};

inline int refSlot(const Build &b, int ref) {
    return ref >= 0 ? b.outSlot[ref] : (-ref - 1);
}

// ---------------------------------------------------------------- interpreter

void runInterp(const Build &bd, const Circuit &c, const std::vector<uint64_t> &keys,
               std::vector<uint64_t> &res, int nt) {
    const int F = c.F, O = c.O, M = c.M, T = c.T;
    const int n = bd.n;
    const int TESTS = 64 * W;
    const int nBatches = (M + TESTS - 1) / TESTS;

#pragma omp parallel num_threads(nt)
    {
        std::vector<uint64_t> piVal((size_t)64 * W);
        uint64_t rbuf[64];
        uint64_t *vals = (uint64_t *)_mm_malloc((size_t)bd.nSlots * W * 8, 32);
        uint64_t *fftmp = (uint64_t *)_mm_malloc((size_t)(F ? F : 1) * W * 8, 32);
        std::vector<uint64_t> H((size_t)TESTS);

#pragma omp for schedule(dynamic, 1)
        for (int bi = 0; bi < nBatches; bi++) {
            const int m0 = bi * TESTS;
            uint64_t state[TESTS];
            for (int q = 0; q < TESTS; q++) {
                int m = m0 + q;
                uint64_t z = (m < M) ? (c.seed ^ (uint64_t)m) : 0;
                state[q] = (m < M) ? sm64(z) : 0;
            }
            std::fill(H.begin(), H.end(), 0);
            std::memset(vals, 0, (size_t)(2 + c.I + c.F) * W * 8);
            for (int w = 0; w < W; w++) vals[W + w] = ~0ULL;

            for (int t = 0; t < T; t++) {
                for (int w = 0; w < W; w++) {
                    for (int q = 0; q < 64; q++) {
                        int m = m0 + w * 64 + q;
                        rbuf[q] = (m < M) ? sm64(state[w * 64 + q]) : 0;
                    }
                    transpose64(rbuf);
                    for (int i = 0; i < 64; i++) piVal[(size_t)i * W + w] = rbuf[i];
                }
                for (int i = 0; i < c.I; i++)
                    for (int w = 0; w < W; w++) vals[(size_t)(2 + i) * W + w] = (i < 64) ? piVal[(size_t)i * W + w] : 0;

                for (int i = 0; i < n; i++) {
                    int ty = bd.type[i];
                    int sa = refSlot(bd, bd.ra[i]);
                    int sb = refSlot(bd, bd.rb[i]);
                    int sc = refSlot(bd, bd.rc[i]);
                    const __m256i *pa = (const __m256i *)(vals + (size_t)sa * W);
                    __m256i A = _mm256_load_si256(pa);
                    __m256i R;
                    if (ty == 6) {
                        R = _mm256_xor_si256(A, _mm256_set1_epi64x(-1));
                    } else if (ty == 7) {
                        __m256i B = _mm256_load_si256((const __m256i *)(vals + (size_t)sb * W));
                        __m256i C = _mm256_load_si256((const __m256i *)(vals + (size_t)sc * W));
                        R = _mm256_xor_si256(B, _mm256_and_si256(A, _mm256_xor_si256(B, C)));
                    } else {
                        __m256i B = _mm256_load_si256((const __m256i *)(vals + (size_t)sb * W));
                        switch (ty) {
                            case 0: R = _mm256_and_si256(A, B); break;
                            case 1: R = _mm256_or_si256(A, B); break;
                            case 2: R = _mm256_xor_si256(A, B); break;
                            case 3: R = _mm256_xor_si256(_mm256_and_si256(A, B), _mm256_set1_epi64x(-1)); break;
                            case 4: R = _mm256_xor_si256(_mm256_or_si256(A, B), _mm256_set1_epi64x(-1)); break;
                            default: R = _mm256_xor_si256(_mm256_xor_si256(A, B), _mm256_set1_epi64x(-1)); break;
                        }
                    }
                    _mm256_store_si256((__m256i *)(vals + (size_t)bd.outSlot[i] * W), R);
                }

                {
                    const uint64_t *kt = keys.data() + (size_t)t * O;
                    for (int j = 0; j < O; j++) {
                        uint64_t key = kt[j];
                        const uint64_t *v = vals + (size_t)refSlot(bd, bd.outRef[j]) * W;
                        for (int w = 0; w < W; w++) {
                            uint64_t x = v[w];
                            uint64_t *hh = H.data() + (size_t)w * 64;
                            while (x) {
                                int bit = __builtin_ctzll(x);
                                hh[bit] ^= key;
                                x &= x - 1;
                            }
                        }
                    }
                }

                if (!bd.dIsFF) {
                    for (int f = 0; f < F; f++) {
                        if (bd.dRef[f] >= 0) continue;  // stored directly by generated code
                        const uint64_t *src = vals + (size_t)refSlot(bd, bd.dRef[f]) * W;
                        uint64_t *dst = vals + (size_t)bd.ffSlot[f] * W;
                        for (int w = 0; w < W; w++) dst[w] = src[w];
                    }
                } else {
                    for (int f = 0; f < F; f++) {
                        const uint64_t *src = vals + (size_t)refSlot(bd, bd.dRef[f]) * W;
                        for (int w = 0; w < W; w++) fftmp[(size_t)f * W + w] = src[w];
                    }
                    for (int f = 0; f < F; f++) {
                        uint64_t *dst = vals + (size_t)bd.ffSlot[f] * W;
                        for (int w = 0; w < W; w++) dst[w] = fftmp[(size_t)f * W + w];
                    }
                }
            }
            for (int q = 0; q < TESTS; q++) {
                int m = m0 + q;
                if (m < M) res[m] = H[q];
            }
        }
        _mm_free(vals);
        _mm_free(fftmp);
    }
}

// ----------------------------------------------------------------------- JIT

// opcodes (VEX.256.66.0F)
enum { OP_MOVDQA = 0x6F, OP_MOVDQU = 0x7F, OP_AND = 0xDB, OP_OR = 0xEB, OP_XOR = 0xEF, OP_CMPEQD = 0x76 };

struct Emitter {
    uint8_t *buf = nullptr;
    uint8_t *cur = nullptr;
    size_t sz = 0;
    void begin(size_t cap) { buf = (uint8_t *)std::malloc(cap); cur = buf; sz = 0; }
    void release() { std::free(buf); buf = nullptr; cur = nullptr; }
    inline void u8(int x) { *cur++ = (uint8_t)x; }
    inline void u32(int32_t x) { cur[0] = (uint8_t)x; cur[1] = (uint8_t)(x >> 8); cur[2] = (uint8_t)(x >> 16); cur[3] = (uint8_t)(x >> 24); cur += 4; }
    inline void vex(int opcode, int pp, int dst, int src1, int rm, int32_t disp, bool mem, bool rspmem = false) {
        int R = (dst >> 3) & 1;
        int B = mem ? 0 : ((rm >> 3) & 1);
        if (R == 0 && B == 0) {
            u8(0xC5);
            u8((1 << 7) | (((~src1) & 0xF) << 3) | (1 << 2) | pp);
        } else {
            u8(0xC4);
            u8((((~R) & 1) << 7) | (1 << 6) | (((~B) & 1) << 5) | 1);
            u8((((~src1) & 0xF) << 3) | (1 << 2) | pp);
        }
        u8(opcode);
        if (mem) {
            u8(0x80 | ((dst & 7) << 3) | (rspmem ? 4 : 1));
            if (rspmem) u8(0x24);
            u32(disp);
        } else {
            u8(0xC0 | ((dst & 7) << 3) | (rm & 7));
        }
    }
    inline void load(int dst, int slot) { vex(OP_MOVDQA, 1, dst, 0, 0, slot * 32, true); }
    inline void store(int src, int slot) { vex(OP_MOVDQU, 1, src, 0, 0, slot * 32, true); }
    inline void mov(int dst, int src) { vex(OP_MOVDQA, 1, dst, 0, src, 0, false); }
    inline void rr(int opc, int dst, int src1, int rm) { vex(opc, 1, dst, src1, rm, 0, false); }
    inline void rm(int opc, int dst, int src1, int slot) { vex(opc, 1, dst, src1, 0, slot * 32, true); }
    inline void opWith(int opc, int dst, int rx, int slot) {
        if (rx >= 0) rr(opc, dst, dst, rx); else rm(opc, dst, dst, slot);
    }
    inline void movTo(int dst, int rx, int slot) {
        if (rx >= 0) mov(dst, rx); else load(dst, slot);
    }
};

// Generate AVX2 code implementing one combinational evaluation.
bool generate(const Build &b, Emitter &em, bool directFF) {
    const int n = b.n;
    em.begin((size_t)n * 57 + (size_t)(b.ffSlot.size() + 8) * 20 + 4096);
    if (!em.buf) return false;

    em.u8(0x48); em.u8(0x81); em.u8(0xEC); em.u32(320);  // sub rsp, 320
    for (int r = 6; r <= 15; r++) em.vex(OP_MOVDQU, 2, r, 0, 0, (r - 6) * 32, true, true);  // save
    em.rr(OP_CMPEQD, 15, 15, 15);  // all ones

    int regVal[16], regLU[16];
    for (int i = 0; i < 16; i++) { regVal[i] = -1; regLU[i] = -1; }
    regVal[15] = -2;
    // only ymm0-7 are used for values: every VEX operand then fits the 2-byte form
    constexpr int NREG = 8;
    std::vector<int> valReg((size_t)n, -1);

    for (int i = 0; i < n; i++) {
        const int ty = b.type[i];
        const int r0 = b.ra[i], r1 = b.rb[i], r2 = b.rc[i];
        const int s0 = refSlot(b, r0), s1 = refSlot(b, r1), s2 = refSlot(b, r2);
        const int v0 = (r0 >= 0) ? valReg[r0] : -1;
        const int v1 = (r1 >= 0) ? valReg[r1] : -1;
        const int v2 = (r2 >= 0) ? valReg[r2] : -1;

        int T = -1;
        bool deadPick = false;
        if (ty == 7) {
            if (r2 >= 0 && v2 >= 0 && v2 != v0 && v2 != v1 && b.isLast[(size_t)i * 3 + 2]) { T = v2; deadPick = true; }
        } else {
            if (r0 >= 0 && b.isLast[(size_t)i * 3] && v0 >= 0) { T = v0; deadPick = true; }
            else if (r1 >= 0 && b.isLast[(size_t)i * 3 + 1] && v1 >= 0) { T = v1; deadPick = true; }
        }
        if (T < 0)
            for (int r = 0; r < NREG; r++) if (regVal[r] == -1) { T = r; break; }
        if (T < 0) {
            int best = -1, blu = -1;
            for (int r = 0; r < NREG; r++) {
                int v = regVal[r];
                if (v < 0) continue;
                if (ty == 7 && (r == v0 || r == v1)) continue;
                if (regLU[r] > blu) { blu = regLU[r]; best = r; }
            }
            if (best < 0) {
                for (int r = 0; r < NREG; r++) {
                    int v = regVal[r];
                    if (v < 0) continue;
                    if (regLU[r] > blu) { blu = regLU[r]; best = r; }
                }
            }
            if (best < 0) return false;
            int v = regVal[best];
            em.store(best, b.outSlot[v]);
            valReg[v] = -1;
            regVal[best] = -1;
            regLU[best] = -1;
            T = best;
            deadPick = false;
        }
        (void)deadPick;

        if (ty == 6) {
            if (v0 >= 0) em.rr(OP_XOR, T, v0, 15);
            else { em.load(T, s0); em.rr(OP_XOR, T, T, 15); }
        } else if (ty == 7) {
            if (r1 >= 0 && r2 >= 0 && r1 == r2) {
                if (v1 >= 0) em.mov(T, v1); else em.load(T, s1);
            } else {
                int R1 = v1;
                if (R1 < 0) {
                    int u = -1;
                    for (int r = 0; r < NREG && u < 0; r++)
                        if (regVal[r] == -1 && r != T && r != v0 && r != v2) u = r;
                    if (u < 0) {
                        int best = -1, blu = -1;
                        for (int r = 0; r < NREG; r++) {
                            int v = regVal[r];
                            if (v < 0 || r == T || r == v0 || r == v2) continue;
                            if (regLU[r] > blu) { blu = regLU[r]; best = r; }
                        }
                        if (best >= 0) {
                            int v = regVal[best];
                            em.store(best, b.outSlot[v]);
                            valReg[v] = -1;
                            regVal[best] = -1;
                            regLU[best] = -1;
                            u = best;
                        }
                    }
                    if (u >= 0) { em.load(u, s1); R1 = u; }
                }
                if (R1 >= 0) {
                    if (v2 >= 0) em.rr(OP_XOR, T, R1, v2); else em.rm(OP_XOR, T, R1, s2);
                } else if (v2 >= 0) {
                    em.rm(OP_XOR, T, v2, s1);
                } else {
                    em.load(T, s2);
                    em.rm(OP_XOR, T, T, s1);
                }
                em.opWith(OP_AND, T, v0, s0);
                em.opWith(OP_XOR, T, R1, s1);
            }
        } else {
            int opc = (ty == 0 || ty == 3) ? OP_AND : (ty == 1 || ty == 4) ? OP_OR : OP_XOR;
            if (v0 >= 0) {
                if (v1 >= 0) em.rr(opc, T, v0, v1); else em.rm(opc, T, v0, s1);
            } else if (v1 >= 0) {
                em.rm(opc, T, v1, s0);
            } else {
                em.load(T, s0);
                em.rm(opc, T, T, s1);
            }
            if (ty >= 3) em.rr(OP_XOR, T, T, 15);
        }

        if (r0 >= 0 && b.isLast[(size_t)i * 3]) { int rr = valReg[r0]; if (rr >= 0 && rr != T) { regVal[rr] = -1; regLU[rr] = -1; } valReg[r0] = -1; }
        if (ty != 6 && r1 >= 0 && b.isLast[(size_t)i * 3 + 1]) { int rr = valReg[r1]; if (rr >= 0 && rr != T) { regVal[rr] = -1; regLU[rr] = -1; } valReg[r1] = -1; }
        if (ty == 7 && r2 >= 0 && b.isLast[(size_t)i * 3 + 2]) { int rr = valReg[r2]; if (rr >= 0 && rr != T) { regVal[rr] = -1; regLU[rr] = -1; } valReg[r2] = -1; }

        valReg[i] = T;
        regVal[T] = i;
        regLU[T] = b.lastUse[i];
    }

    for (int v = 0; v < n; v++) {
        if (b.lastUse[v] != n || valReg[v] < 0) continue;
        int fs = b.ffUserStart[v], fe = b.ffUserStart[v + 1];
        if (directFF && fs < fe) {
            for (int e = fs; e < fe; e++) em.store(valReg[v], b.ffSlot[b.ffUserList[e]]);
            if (b.isOut[v]) em.store(valReg[v], b.outSlot[v]);
        } else {
            em.store(valReg[v], b.outSlot[v]);
        }
    }
    if (directFF) {
        for (int v = 0; v < n; v++) {
            if (b.lastUse[v] != n || valReg[v] >= 0) continue;
            int fs = b.ffUserStart[v], fe = b.ffUserStart[v + 1];
            if (fs >= fe) continue;
            em.load(0, b.outSlot[v]);
            for (int e = fs; e < fe; e++) em.store(0, b.ffSlot[b.ffUserList[e]]);
        }
    }

    for (int r = 6; r <= 15; r++) em.vex(OP_MOVDQU, 2, r, 0, 0, (r - 6) * 32, true, true);  // restore
    em.u8(0x48); em.u8(0x81); em.u8(0xC4); em.u32(320);  // add rsp, 320
    em.u8(0xC5); em.u8(0xF8); em.u8(0x77);               // vzeroupper
    em.u8(0xC3);                                          // ret
    em.sz = (size_t)(em.cur - em.buf);
    return true;
}

}  // namespace

std::vector<uint64_t> simulate(const Circuit &c) {
    const int I = c.I, F = c.F, G = c.G, O = c.O, M = c.M, T = c.T;
    const int BASE = I + F + 2;

    Build bd;
    bd.order.reserve((size_t)G);

    // DFS post-order over the gates reachable from flip-flop inputs and primary outputs.
    std::vector<int> orderD;
    orderD.reserve((size_t)G);
    {
        std::vector<uint8_t> state((size_t)G, 0);
        std::vector<uint32_t> stk;
        stk.reserve(4096);
        for (int s = 0; s < G; s++) {
            if (state[s]) continue;
            state[s] = 1;
            stk.push_back((uint32_t)s << 2);
            while (!stk.empty()) {
                uint32_t top = stk.back();
                int k = (int)(top >> 2);
                int q = (int)(top & 3);
                if (q < 3) {
                    stk.back() = top + 1;
                    int a = (q == 0) ? c.in0[k] : (q == 1) ? c.in1[k] : c.in2[k];
                    if (a >= BASE) {
                        int d = a - BASE;
                        if (!state[d]) { state[d] = 1; stk.push_back((uint32_t)d << 2); }
                    }
                } else {
                    orderD.push_back(k);
                    stk.pop_back();
                }
            }
        }
    }
    bd.order = std::move(orderD);
    const int n = (int)bd.order.size();

    // base slot assignment
    const int nBase = 2 + I + F;
    std::vector<int> baseSlot((size_t)BASE);
    baseSlot[0] = 0; baseSlot[1] = 1;
    for (int i = 0; i < I; i++) baseSlot[2 + i] = 2 + i;
    for (int f = 0; f < F; f++) baseSlot[2 + I + f] = 2 + I + f;

    // gate -> position
    std::vector<int> gatePos((size_t)G, -1);
    for (int i = 0; i < n; i++) gatePos[bd.order[i]] = i;
    auto refOf = [&](int sig) -> int {
        if (sig >= BASE) return gatePos[sig - BASE];
        return -(baseSlot[sig] + 1);
    };
    bd.n = n;
    bd.type.resize((size_t)n);
    bd.ra.resize((size_t)n); bd.rb.resize((size_t)n); bd.rc.resize((size_t)n);
    for (int i = 0; i < n; i++) {
        int k = bd.order[i];
        bd.type[i] = c.type[k];
        bd.ra[i] = refOf(c.in0[k]);
        bd.rb[i] = (c.type[k] == 6) ? -1 : refOf(c.in1[k]);
        bd.rc[i] = (c.type[k] == 7) ? refOf(c.in2[k]) : -1;
    }
    bd.dRef.resize((size_t)F);
    bd.ffSlot.resize((size_t)F);
    for (int f = 0; f < F; f++) {
        bd.dRef[f] = refOf(c.d[f]);
        bd.ffSlot[f] = baseSlot[2 + I + f];
        if (c.d[f] >= 2 + I && c.d[f] < BASE) bd.dIsFF = true;
    }
    bd.outRef.resize((size_t)O);
    for (int j = 0; j < O; j++) bd.outRef[j] = refOf(c.out[j]);

    // last use by position, plus per-input "is last use" flags
    bd.lastUse.assign((size_t)n, -1);
    bd.isLast.assign((size_t)n * 3, 0);
    for (int f = 0; f < F; f++) if (bd.dRef[f] >= 0) bd.lastUse[bd.dRef[f]] = n;
    for (int j = 0; j < O; j++) if (bd.outRef[j] >= 0) bd.lastUse[bd.outRef[j]] = n;
    for (int i = n - 1; i >= 0; i--) {
        int r0 = bd.ra[i], r1 = bd.rb[i], r2 = bd.rc[i];
        if (r0 >= 0 && bd.lastUse[r0] < 0) { bd.lastUse[r0] = i; bd.isLast[(size_t)i * 3] = 1; }
        if (r1 >= 0 && bd.lastUse[r1] < 0) { bd.lastUse[r1] = i; bd.isLast[(size_t)i * 3 + 1] = 1; }
        if (r2 >= 0 && bd.lastUse[r2] < 0) { bd.lastUse[r2] = i; bd.isLast[(size_t)i * 3 + 2] = 1; }
    }
    for (int i = 0; i < n; i++) if (bd.lastUse[i] < 0) bd.lastUse[i] = n;

    // slot colouring
    std::vector<int> head((size_t)n + 1, -1), nxt((size_t)n, -1);
    for (int i = 0; i < n; i++) {
        int lu = bd.lastUse[i];
        nxt[i] = head[lu]; head[lu] = i;
    }
    std::vector<int> outSlot((size_t)n);
    std::vector<int> freeStack;
    freeStack.reserve((size_t)n);
    int nSlots = nBase;
    for (int i = 0; i < n; i++) {
        if (i > 0) for (int e = head[i - 1]; e != -1; e = nxt[e]) freeStack.push_back(outSlot[e]);
        int s;
        if (!freeStack.empty()) { s = freeStack.back(); freeStack.pop_back(); }
        else s = nSlots++;
        outSlot[i] = s;
    }
    bd.nSlots = nSlots;
    bd.outSlot = outSlot;
    {
        bd.ffUserStart.assign((size_t)n + 1, 0);
        for (int f = 0; f < F; f++) if (bd.dRef[f] >= 0) bd.ffUserStart[(size_t)bd.dRef[f] + 1]++;
        for (int i = 0; i < n; i++) bd.ffUserStart[i + 1] += bd.ffUserStart[i];
        bd.ffUserList.resize((size_t)bd.ffUserStart[n]);
        std::vector<int> fillp(bd.ffUserStart.begin(), bd.ffUserStart.end() - 1);
        for (int f = 0; f < F; f++) if (bd.dRef[f] >= 0) bd.ffUserList[fillp[bd.dRef[f]]++] = f;
        bd.isOut.assign((size_t)n, 0);
        for (int j = 0; j < O; j++) if (bd.outRef[j] >= 0) bd.isOut[bd.outRef[j]] = 1;
    }

    // digest keys
    std::vector<uint64_t> keys((size_t)T * O);
    for (int t = 0; t < T; t++)
        for (int j = 0; j < O; j++) {
            uint64_t z = (uint64_t)t * (uint64_t)O + (uint64_t)j;
            keys[(size_t)t * O + j] = sm64(z);
        }

    const int TESTS = 64 * W;
    const int nBatches = (M + TESTS - 1) / TESTS;
    std::vector<uint64_t> res((size_t)M, 0);

#ifdef _OPENMP
    int nt = omp_get_num_procs();
#else
    int nt = 1;
#endif
    if (NT_OVERRIDE) nt = NT_OVERRIDE;
    else { int lim = 8; if (nt > lim) nt = lim; }
    if (nt > nBatches) nt = nBatches;
    if (nt < 1) nt = 1;

    // generate code
    Emitter em;
    bool jitOk = false;
    void *codeMem = nullptr;
    bool outHasFF = false;
    for (int j = 0; j < O; j++) if (c.out[j] >= 2 + I && c.out[j] < BASE) outHasFF = true;
    if (!USE_INTERP && n <= 2000000) jitOk = generate(bd, em, !bd.dIsFF && !outHasFF);

    if (!jitOk) {
        em.release();
        runInterp(bd, c, keys, res, nt);
        return res;
    }

#ifdef _WIN32
    codeMem = VirtualAlloc(nullptr, em.sz, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
    if (!codeMem) { em.release(); runInterp(bd, c, keys, res, nt); return res; }
    std::memcpy(codeMem, em.buf, em.sz);
    em.release();
#endif
    if (!codeMem) { em.release(); runInterp(bd, c, keys, res, nt); return res; }

    typedef void (*JitFn)(uint64_t *);
    JitFn fn = (JitFn)codeMem;
    const bool directFF = !bd.dIsFF && !outHasFF;

#pragma omp parallel num_threads(nt)
    {
        std::vector<uint64_t> piVal((size_t)64 * W);
        uint64_t rbuf[64];
        uint64_t *vals = (uint64_t *)_mm_malloc((size_t)bd.nSlots * W * 8, 32);
        uint64_t *fftmp = (uint64_t *)_mm_malloc((size_t)(F ? F : 1) * W * 8, 32);
        std::vector<uint64_t> H((size_t)TESTS);

#pragma omp for schedule(dynamic, 1)
        for (int bi = 0; bi < nBatches; bi++) {
            const int m0 = bi * TESTS;
            uint64_t state[TESTS];
            for (int q = 0; q < TESTS; q++) {
                int m = m0 + q;
                if (m < M) { uint64_t z = c.seed ^ (uint64_t)m; state[q] = sm64(z); } else state[q] = 0;
            }
            std::fill(H.begin(), H.end(), 0);
            std::memset(vals, 0, (size_t)nBase * W * 8);
            for (int w = 0; w < W; w++) vals[W + w] = ~0ULL;

            for (int t = 0; t < T; t++) {
                for (int w = 0; w < W; w++) {
                    for (int q = 0; q < 64; q++) {
                        int m = m0 + w * 64 + q;
                        rbuf[q] = (m < M) ? sm64(state[w * 64 + q]) : 0;
                    }
                    transpose64(rbuf);
                    for (int i = 0; i < 64; i++) piVal[(size_t)i * W + w] = rbuf[i];
                }
                for (int i = 0; i < I; i++) {
                    uint64_t pv = (i < 64) ? piVal[(size_t)i * W] : 0;
                    for (int w = 0; w < W; w++) vals[(size_t)(2 + i) * W + w] = (i < 64) ? piVal[(size_t)i * W + w] : 0;
                    (void)pv;
                }

                fn(vals);

                {
                    const uint64_t *kt = keys.data() + (size_t)t * O;
                    for (int j = 0; j < O; j++) {
                        uint64_t key = kt[j];
                        const uint64_t *v = vals + (size_t)refSlot(bd, bd.outRef[j]) * W;
                        for (int w = 0; w < W; w++) {
                            uint64_t x = v[w];
                            uint64_t *hh = H.data() + (size_t)w * 64;
                            while (x) {
                                int bit = __builtin_ctzll(x);
                                hh[bit] ^= key;
                                x &= x - 1;
                            }
                        }
                    }
                }

                if (directFF) {
                    for (int f = 0; f < F; f++) {
                        if (bd.dRef[f] >= 0) continue;  // stored directly by generated code
                        const uint64_t *src = vals + (size_t)refSlot(bd, bd.dRef[f]) * W;
                        uint64_t *dst = vals + (size_t)bd.ffSlot[f] * W;
                        for (int w = 0; w < W; w++) dst[w] = src[w];
                    }
                } else {
                    for (int f = 0; f < F; f++) {
                        const uint64_t *src = vals + (size_t)refSlot(bd, bd.dRef[f]) * W;
                        for (int w = 0; w < W; w++) fftmp[(size_t)f * W + w] = src[w];
                    }
                    for (int f = 0; f < F; f++) {
                        uint64_t *dst = vals + (size_t)bd.ffSlot[f] * W;
                        for (int w = 0; w < W; w++) dst[w] = fftmp[(size_t)f * W + w];
                    }
                }
            }
            for (int q = 0; q < TESTS; q++) {
                int m = m0 + q;
                if (m < M) res[m] = H[q];
            }
        }
        _mm_free(vals);
        _mm_free(fftmp);
    }

    VirtualFree(codeMem, 0, MEM_RELEASE);
    return res;
}







