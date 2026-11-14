#include <cstdint>
#include <vector>
#include <cstring>
#include <climits>
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <immintrin.h>
#include <omp.h>
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

struct Circuit {
    int I, F, G, O, M, T;
    uint64_t seed;
    std::vector<int> d;
    std::vector<uint8_t> type;
    std::vector<int> in0, in1, in2;
    std::vector<int> out;
};

std::vector<uint64_t> simulate(const Circuit& c);

namespace {

#ifdef DBG
struct Timer {
    std::chrono::steady_clock::time_point t0 = std::chrono::steady_clock::now();
    void lap(const char* s) {
        auto t1 = std::chrono::steady_clock::now();
        fprintf(stderr, "  [%s] %.3f ms\n", s, std::chrono::duration<double, std::milli>(t1 - t0).count());
        t0 = t1;
    }
};
static int envi(const char* n, int def) {
    const char* v = getenv(n);
    return v ? atoi(v) : def;
}
#else
struct Timer { void lap(const char*) {} };
static int envi(const char*, int def) { return def; }
#endif

static inline uint64_t mix64(uint64_t x) {
    uint64_t z = (x += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}

// 4 parallel 64x64 transposes: a[k] lane l = matrix l row k.  a[i] bit j <-> a[j] bit i
static inline void transpose64x4(__m256i* a) {
    static const uint64_t masks[6] = {0x00000000FFFFFFFFULL, 0x0000FFFF0000FFFFULL, 0x00FF00FF00FF00FFULL,
                                      0x0F0F0F0F0F0F0F0FULL, 0x3333333333333333ULL, 0x5555555555555555ULL};
    int s = 0;
    for (int j = 32; j; j >>= 1, s++) {
        __m256i m = _mm256_set1_epi64x((long long)masks[s]);
        __m128i sh = _mm_cvtsi32_si128(j);
        for (int k = 0; k < 64; k++) {
            if (k & j) continue;
            __m256i t = _mm256_and_si256(_mm256_xor_si256(_mm256_srl_epi64(a[k], sh), a[k | j]), m);
            a[k] = _mm256_xor_si256(a[k], _mm256_sll_epi64(t, sh));
            a[k | j] = _mm256_xor_si256(a[k | j], t);
        }
    }
}

template <class T>
struct Buf {  // uninitialized array (no zeroing), freed automatically
    T* p = nullptr;
    size_t n = 0;
    explicit Buf(size_t cnt = 0) { alloc(cnt); }
    void alloc(size_t cnt) { free(p); n = cnt; p = cnt ? (T*)malloc(cnt * sizeof(T)) : nullptr; }
    ~Buf() { free(p); }
    Buf(const Buf&) = delete;
    Buf& operator=(const Buf&) = delete;
    T& operator[](size_t i) { return p[i]; }
    const T& operator[](size_t i) const { return p[i]; }
};

enum { NT_CONST = 0, NT_PI, NT_FF, NT_AND, NT_XOR, NT_MUX, NT_MUXD };

struct Node {
    uint32_t a, b, c;  // literals (node<<1 | inv)
    uint8_t t, pol;    // type; physical value = logical ^ pol
    uint16_t pad;
};

struct Net {
    Node* nd = nullptr;
    uint8_t* polv = nullptr;
    uint32_t n = 0;
    bool useHash = true;
    bool decMux = false;
    uint32_t nfixedN = 0;
    uint32_t hashHits = 0;
    std::vector<uint32_t> ht;
    uint32_t hmask = 0;

    static inline uint32_t hkey(uint32_t ty, uint32_t x, uint32_t y, uint32_t z) {
        uint64_t h = (uint64_t)x * 0x9E3779B97F4A7C15ULL;
        h ^= (uint64_t)y * 0xC2B2AE3D27D4EB4FULL + ((uint64_t)z << 7) + ty;
        h ^= h >> 29;
        h *= 0xBF58476D1CE4E5B9ULL;
        h ^= h >> 32;
        return (uint32_t)h;
    }
    void initHash(size_t cap) {
        size_t sz = 1;
        while (sz < cap * 2) sz <<= 1;
        ht.assign(sz, 0);
        hmask = (uint32_t)(sz - 1);
    }
    inline uint8_t eff(uint32_t l) const { return polv[l >> 1] ^ (uint8_t)(l & 1); }
    uint32_t mk(uint8_t ty, uint32_t x, uint32_t y, uint32_t z) {
        uint32_t h = 0;
        if (useHash) {
            h = hkey(ty, x, y, z) & hmask;
            while (true) {
                uint32_t m = ht[h];
                if (!m) break;
                const Node& q = nd[m];
                if (q.t == ty && q.a == x && q.b == y && q.c == z) { hashHits++; return m << 1; }
                h = (h + 1) & hmask;
            }
        }
        uint32_t m = n++;
        Node& q = nd[m];
        q.a = x; q.b = y; q.c = z; q.t = ty; q.pad = 0;
        uint8_t pl;
        if (ty == NT_AND) pl = eff(x) & eff(y);
        else if (ty == NT_XOR) pl = eff(x) ^ eff(y);
        else if (ty == NT_MUX) pl = eff(eff(x) ? z : y);  // MUX: s=x; data a=y (s=0), b=z (s=1)
        else pl = eff(y);  // MUXD: s=x, A'=y, D=z
        q.pol = pl;
        polv[m] = pl;
        if (useHash) ht[h] = m;
        return m << 1;
    }
    uint32_t AND(uint32_t x, uint32_t y) {
        if (x == 0 || y == 0 || x == (y ^ 1)) return 0;
        if (x == 1) return y;
        if (y == 1 || x == y) return x;
        if (x > y) std::swap(x, y);
        return mk(NT_AND, x, y, 0);
    }
    uint32_t OR(uint32_t x, uint32_t y) { return AND(x ^ 1, y ^ 1) ^ 1; }
    uint32_t XOR(uint32_t x, uint32_t y) {
        if (x == y) return 0;
        if (x == (y ^ 1)) return 1;
        uint32_t inv = (x ^ y) & 1;
        x &= ~1u; y &= ~1u;
        if (x == 0) return y ^ inv;
        if (y == 0) return x ^ inv;
        if (x > y) std::swap(x, y);
        return mk(NT_XOR, x, y, 0) ^ inv;
    }
    uint32_t MUX(uint32_t s, uint32_t x, uint32_t y) {  // s ? y : x
        if (s & 1) { s ^= 1; std::swap(x, y); }
        if (s == 0) return x;
        if (x == y) return x;
        if (x == (y ^ 1)) return XOR(s, x);
        if (s == x) return AND(s, y);
        if (s == (x ^ 1)) return OR(s ^ 1, y);
        if (s == y) return OR(s, x);
        if (s == (y ^ 1)) return AND(s ^ 1, x);
        if (x == 0) return AND(s, y);
        if (x == 1) return OR(s ^ 1, y);
        if (y == 0) return AND(s ^ 1, x);
        if (y == 1) return OR(s, x);
        uint32_t inv = x & 1;
        x ^= inv; y ^= inv;
        if (decMux && useHash && (x >> 1) < nfixedN && (y >> 1) < nfixedN) {
            // data inputs are FF/PI: share D = x ^ y across all muxes selecting between them
            uint32_t dl = XOR(x, y);
            uint32_t ap = eff(s) ? y : x;
            return mk(NT_MUXD, s, ap, dl) ^ inv;
        }
        return mk(NT_MUX, s, x, y) ^ inv;
    }
};

// ---------------- x86 emitter ----------------
enum { RAX = 0, RCX = 1, RDX = 2, RBX = 3, RSP = 4, RBP = 5, RSI = 6, RDI = 7, R8 = 8, R9 = 9, R10 = 10 };
static const int kBaseReg[3] = {RCX, RDX, RAX};  // 0: S area, 1: FF array (read), 2: FF array (write)

struct Emitter {
    uint8_t* p;
    inline void b(uint8_t x) { *p++ = x; }
    inline void d32(int32_t x) { memcpy(p, &x, 4); p += 4; }
    inline void modrm_mem(int reg, int base, int32_t disp) {
        int r = (reg & 7) << 3, bb = base & 7;
        if (disp == 0 && bb != 5) {
            b((uint8_t)(r | bb));
            if (bb == 4) b(0x24);
        } else if (disp >= -128 && disp <= 127) {
            b((uint8_t)(0x40 | r | bb));
            if (bb == 4) b(0x24);
            b((uint8_t)(int8_t)disp);
        } else {
            b((uint8_t)(0x80 | r | bb));
            if (bb == 4) b(0x24);
            d32(disp);
        }
    }
    // pp: 0 none,1 66,2 F3,3 F2 ; map 0F
    inline void vex(int pp, int L, int opc, int reg, int vvvv, bool rmIsReg, int rm, int base, int32_t disp) {
        int R = (reg >> 3) & 1;
        int B = rmIsReg ? ((rm >> 3) & 1) : ((base >> 3) & 1);
        if (!B) {
            b(0xC5);
            b((uint8_t)(((~R & 1) << 7) | ((~vvvv & 15) << 3) | (L << 2) | pp));
        } else {
            b(0xC4);
            b((uint8_t)(((~R & 1) << 7) | (1 << 6) | ((~B & 1) << 5) | 1));
            b((uint8_t)(((~vvvv & 15) << 3) | (L << 2) | pp));
        }
        b((uint8_t)opc);
        if (rmIsReg) b((uint8_t)(0xC0 | ((reg & 7) << 3) | (rm & 7)));
        else modrm_mem(reg, base, disp);
    }
    size_t cnt[8] = {0, 0, 0, 0, 0, 0, 0, 0};  // rr, rm, load, store, rm-by-base(0/1)
    inline void op_rr(int opc, int d, int s1, int s2) { cnt[0]++; vex(1, 1, opc, d, s1, true, s2, 0, 0); }
    inline void op_rm(int opc, int d, int s1, int bid, int32_t disp) { cnt[1]++; cnt[4 + bid]++; vex(1, 1, opc, d, s1, false, 0, kBaseReg[bid], disp); }
    inline void load(int d, int bid, int32_t disp) { cnt[2]++; cnt[4 + bid]++; vex(1, 1, 0x6F, d, 0, false, 0, kBaseReg[bid], disp); }
    inline void store(int s, int bid, int32_t disp) { cnt[3]++; vex(1, 1, 0x7F, s, 0, false, 0, kBaseReg[bid], disp); }
    inline void mov_st64(int base, int disp, int reg) {
        b((uint8_t)(0x48 | (((reg >> 3) & 1) << 2) | ((base >> 3) & 1)));
        b(0x89);
        b((uint8_t)(0x40 | ((reg & 7) << 3) | (base & 7)));
        b((uint8_t)disp);
    }
    inline void mov_ld64(int reg, int base, int disp) {
        b((uint8_t)(0x48 | (((reg >> 3) & 1) << 2) | ((base >> 3) & 1)));
        b(0x8B);
        b((uint8_t)(0x40 | ((reg & 7) << 3) | (base & 7)));
        b((uint8_t)disp);
    }
};
// ctx layout (8-byte words): 0 S, 1 FFcur, 2 FFnext, 6 xmm save area ptr
static void emitPrologue(Emitter& E) {
    E.b(0x49); E.b(0x89); E.b(0xCA);  // mov r10, rcx
    E.mov_ld64(R9, R10, 48);
    for (int x = 6; x < 16; x++) E.vex(2, 0, 0x7F, x, 0, false, 0, R9, (x - 6) * 16);
    E.mov_ld64(RDX, R10, 8);
    E.mov_ld64(RAX, R10, 16);
    E.mov_ld64(RCX, R10, 0);
}
static void emitEpilogue(Emitter& E) {
    for (int x = 6; x < 16; x++) E.vex(2, 0, 0x6F, x, 0, false, 0, R9, (x - 6) * 16);
    E.b(0xC5); E.b(0xF8); E.b(0x77);  // vzeroupper
    E.b(0xC3);
}

enum { OPC_AND = 0xDB, OPC_ANDN = 0xDF, OPC_OR = 0xEB, OPC_XOR = 0xEF };
enum { IR_AND = 0, IR_ANDN, IR_OR, IR_XOR, IR_MUX, IR_MUXD, IR_STF, IR_STFI, IR_STO, IR_MOV };
struct Ins {
    uint8_t op, q;
    int32_t d, a, b, c;  // value ids (d: FF index / out index for stores)
    int32_t na, nb, nc;  // next use position of a, b, c after this instruction
};

static const int SLOT_ZERO = 0, SLOT_ONES = 1, SLOT_PI = 2, SLOT_OUT = 2 + 64, SLOT_SPILL = 2 + 64 + 64;
static const int INF = INT_MAX;

typedef void (*JitFn)(void* ctx);

struct GenShared {
    const Ins* ir;
    const int32_t* firstUse;
    const int32_t* death;
    const int32_t* crossSlot;  // -1 if not cross
    int I, nfixed, nCross;
    int farThresh;
};

struct ChunkOut {
    std::vector<uint8_t> code;
    int nearMax = 0, farMax = 0;
    size_t nSpill = 0, nLoad = 0;
    size_t cnt[8] = {0, 0, 0, 0, 0, 0, 0, 0};
};

struct VS {
    int32_t next;
    int32_t disp;
    int8_t reg;
    uint8_t base;
    uint8_t mem;    // has valid memory copy at (base, disp)
    uint8_t spill;  // 0 none, 1 local near slot, 2 local far slot
    int32_t vid;
};

static void genChunk(const GenShared& g, int lo, int hi, int vlo, int vhi, ChunkOut& out) {
    const Ins* ir = g.ir;
    const int nLocal = vhi - vlo;
    const int maxForeign = 3 * (hi - lo) + 16;
    std::vector<VS> st((size_t)nLocal + maxForeign);
    int nForeign = 0;
    uint32_t hsz = 1;
    while (hsz < (uint32_t)maxForeign * 2) hsz <<= 1;
    std::vector<int32_t> hkeys(hsz, -1), hval(hsz);
    const uint32_t hm = hsz - 1;
    for (int v = vlo; v < vhi; v++) {
        VS& s = st[v - vlo];
        s.next = g.firstUse[v]; s.reg = -1; s.mem = 0; s.spill = 0; s.vid = v;
        if (g.crossSlot[v] >= 0) { s.base = 0; s.disp = -(g.crossSlot[v] + 1) * 32; }
        else { s.base = 0; s.disp = 0; }
    }
    auto idx = [&](int v) -> int {
        if (v >= vlo && v < vhi) return v - vlo;
        uint32_t h = ((uint32_t)v * 2654435761u) & hm;
        while (true) {
            int k = hkeys[h];
            if (k == v) return hval[h];
            if (k < 0) break;
            h = (h + 1) & hm;
        }
        int li = nLocal + nForeign++;
        hkeys[h] = v; hval[h] = li;
        VS& s = st[li];
        s.reg = -1; s.mem = 1; s.spill = 0; s.vid = v; s.next = INF;
        if (v == 0) { s.base = 0; s.disp = SLOT_ZERO * 32; }
        else if (v <= g.I) { s.base = 0; s.disp = (SLOT_PI + v - 1) * 32; }
        else if (v < g.nfixed) { s.base = 1; s.disp = (v - 1 - g.I) * 32; }
        else { s.base = 0; s.disp = -(g.crossSlot[v] + 1) * 32; }
        return li;
    };
    auto isCrossLi = [&](int li) -> bool { return li < nLocal && g.crossSlot[st[li].vid] >= 0; };

    out.code.resize((size_t)(hi - lo) * 64 + 4096);
    Emitter E;
    E.p = out.code.data();
    int regVal[16];
    for (int r = 0; r < 16; r++) regVal[r] = -1;
    std::vector<int> freeNear, freeFar;
    int nNear = 0, nFar = 0;
    int curI = lo;

    auto allocReg = [&](uint32_t lock) -> int {
        for (int r = 0; r < 16; r++)
            if (regVal[r] < 0 && !((lock >> r) & 1)) return r;
        int best = -1;
        long long bestScore = -1;
        for (int r = 0; r < 16; r++) {
            if ((lock >> r) & 1) continue;
            const VS& s = st[regVal[r]];
            long long sc = (long long)s.next * 2 + (s.mem ? 1 : 0);
            if (sc > bestScore) { bestScore = sc; best = r; }
        }
        int li = regVal[best];
        VS& s = st[li];
        if (!s.mem) {
            if (!isCrossLi(li)) {
                int sl;
                if (g.death[s.vid] - curI > g.farThresh) {
                    if (!freeFar.empty()) { sl = freeFar.back(); freeFar.pop_back(); }
                    else sl = nFar++;
                    s.disp = -(g.nCross + sl + 1) * 32;
                    s.spill = 2;
                } else {
                    if (!freeNear.empty()) { sl = freeNear.back(); freeNear.pop_back(); }
                    else sl = nNear++;
                    s.disp = (SLOT_SPILL + sl) * 32;
                    s.spill = 1;
                }
                s.base = 0;
            }
            s.mem = 1;
            E.store(best, s.base, s.disp);
            out.nSpill++;
        }
        s.reg = -1;
        regVal[best] = -1;
        return best;
    };
    auto ensureReg = [&](int li, uint32_t lock) -> int {
        VS& s = st[li];
        if (s.reg >= 0) return s.reg;
        int r = allocReg(lock);
        E.load(r, s.base, s.disp);
        out.nLoad++;
        s.reg = (int8_t)r; regVal[r] = li;
        return r;
    };
    auto release = [&](int li) {
        VS& s = st[li];
        if (s.reg >= 0) { regVal[s.reg] = -1; s.reg = -1; }
        if (s.spill == 1) { freeNear.push_back(s.disp / 32 - SLOT_SPILL); s.spill = 0; s.mem = 0; }
        else if (s.spill == 2) { freeFar.push_back(-s.disp / 32 - 1 - g.nCross); s.spill = 0; s.mem = 0; }
    };
    auto lockOf = [&](int li) -> uint32_t { return st[li].reg >= 0 ? (1u << st[li].reg) : 0u; };
    auto emitOp = [&](int opc, int d, int s1, int li2) {
        const VS& s = st[li2];
        if (s.reg >= 0) E.op_rr(opc, d, s1, s.reg);
        else E.op_rm(opc, d, s1, s.base, s.disp);
    };
    auto define = [&](int li, int r) {
        regVal[r] = li;
        VS& s = st[li];
        s.reg = (int8_t)r;
        s.mem = 0;
        s.spill = 0;
    };

    for (int i = lo; i < hi; i++) {
        const Ins& in = ir[i];
        curI = i;
        switch (in.op) {
            case IR_AND: case IR_ANDN: case IR_OR: case IR_XOR: {
                int a = idx(in.a), b = idx(in.b);
                st[a].next = in.na; st[b].next = in.nb;
                int opc = in.op == IR_AND ? OPC_AND : in.op == IR_ANDN ? OPC_ANDN : in.op == IR_OR ? OPC_OR : OPC_XOR;
                int s1, s2;
                if (in.op == IR_ANDN) { s1 = a; s2 = b; }
                else if (st[a].reg >= 0) { s1 = a; s2 = b; }
                else if (st[b].reg >= 0) { s1 = b; s2 = a; }
                else if (st[a].next <= st[b].next) { s1 = a; s2 = b; }
                else { s1 = b; s2 = a; }
                uint32_t lock = lockOf(a) | lockOf(b);
                int r1 = ensureReg(s1, lock);
                lock |= 1u << r1;
                int rd;
                bool d1 = st[s1].next == INF, d2 = st[s2].next == INF;
                if (d1) rd = r1;
                else if (d2 && st[s2].reg >= 0) rd = st[s2].reg;
                else rd = allocReg(lock);
                emitOp(opc, rd, r1, s2);
                if (d1) release(s1);
                if (d2) release(s2);
                define(idx(in.d), rd);
                break;
            }
            case IR_MUX: {
                int S = idx(in.c), A = idx(in.a), B = idx(in.b);
                st[S].next = in.nc; st[A].next = in.na; st[B].next = in.nb;
                uint32_t lock = lockOf(S) | lockOf(A) | lockOf(B);
                int x1, x2;
                if (st[A].reg >= 0) { x1 = A; x2 = B; }
                else if (st[B].reg >= 0) { x1 = B; x2 = A; }
                else { x1 = A; x2 = B; }
                int r1 = ensureReg(x1, lock);
                lock |= 1u << r1;
                bool dS = st[S].next == INF, dA = st[A].next == INF, dB = st[B].next == INF;
                int rt;
                if (dB && st[B].reg >= 0) rt = st[B].reg;
                else rt = allocReg(lock);
                emitOp(OPC_XOR, rt, r1, x2);
                if (rt == st[B].reg) { regVal[rt] = -1; st[B].reg = -1; }
                if (st[S].reg >= 0) E.op_rr(in.q ? OPC_ANDN : OPC_AND, rt, rt, st[S].reg);
                else E.op_rm(in.q ? OPC_ANDN : OPC_AND, rt, rt, st[S].base, st[S].disp);
                if (st[A].reg >= 0) E.op_rr(OPC_XOR, rt, rt, st[A].reg);
                else E.op_rm(OPC_XOR, rt, rt, st[A].base, st[A].disp);
                if (dS) release(S);
                if (dA) release(A);
                if (dB) release(B);
                define(idx(in.d), rt);
                break;
            }
            case IR_MUXD: {
                int S = idx(in.c), A = idx(in.a), D = idx(in.b);
                st[S].next = in.nc; st[A].next = in.na; st[D].next = in.nb;
                uint32_t lock = lockOf(S) | lockOf(A) | lockOf(D);
                int x1, x2;  // t = S & D  (q: t = ~D & S, D must be src1)
                if (in.q) { x1 = D; x2 = S; }
                else if (st[S].reg >= 0) { x1 = S; x2 = D; }
                else if (st[D].reg >= 0) { x1 = D; x2 = S; }
                else if (st[S].next <= st[D].next) { x1 = S; x2 = D; }
                else { x1 = D; x2 = S; }
                int r1 = ensureReg(x1, lock);
                lock |= 1u << r1;
                bool dS = st[S].next == INF, dA = st[A].next == INF, dD = st[D].next == INF;
                int rt;
                if (dS && st[S].reg >= 0 && S != A) rt = st[S].reg;
                else if (dD && st[D].reg >= 0 && D != A) rt = st[D].reg;
                else rt = allocReg(lock);
                emitOp(in.q ? OPC_ANDN : OPC_AND, rt, r1, x2);
                if (st[S].reg == rt) { regVal[rt] = -1; st[S].reg = -1; }
                if (st[D].reg == rt) { regVal[rt] = -1; st[D].reg = -1; }
                emitOp(OPC_XOR, rt, rt, A);
                if (dS) release(S);
                if (dA) release(A);
                if (dD) release(D);
                define(idx(in.d), rt);
                break;
            }
            case IR_MOV: {
                int v = idx(in.a);
                st[v].next = in.na;
                int rd;
                if (st[v].reg >= 0) {
                    if (st[v].next == INF) { rd = st[v].reg; release(v); }
                    else { rd = allocReg(1u << st[v].reg); E.op_rr(OPC_OR, rd, st[v].reg, st[v].reg); }
                } else {
                    rd = allocReg(0);
                    E.load(rd, st[v].base, st[v].disp);
                    if (st[v].next == INF) release(v);
                }
                define(idx(in.d), rd);
                break;
            }
            default: {  // STF / STFI / STO
                int v = idx(in.a);
                st[v].next = in.na;
                int r = ensureReg(v, 0);
                int bid = in.op == IR_STO ? 0 : 2;
                int32_t disp = in.op == IR_STO ? (SLOT_OUT + in.d) * 32 : in.d * 32;
                if (in.op == IR_STFI) {
                    int tr = allocReg(1u << r);
                    E.op_rm(OPC_XOR, tr, r, 0, SLOT_ONES * 32);
                    E.store(tr, bid, disp);
                } else {
                    E.store(r, bid, disp);
                    VS& s = st[v];
                    if (!s.mem && !isCrossLi(v) && v < nLocal) { s.mem = 1; s.base = (uint8_t)bid; s.disp = disp; s.spill = 0; }
                }
                if (st[v].next == INF) release(v);
                break;
            }
        }
    }
    // flush dirty cross values still in registers
    for (int r = 0; r < 16; r++) {
        int li = regVal[r];
        if (li < 0) continue;
        VS& s = st[li];
        if (li < nLocal && !s.mem && g.crossSlot[s.vid] >= 0) {
            E.store(r, 0, -(g.crossSlot[s.vid] + 1) * 32);
            s.mem = 1;
        }
    }
    out.code.resize((size_t)(E.p - out.code.data()));
    for (int q = 0; q < 8; q++) out.cnt[q] = E.cnt[q];
    out.nearMax = nNear;
    out.farMax = nFar;
}

}  // namespace

std::vector<uint64_t> simulate(const Circuit& c) {
    Timer tm;
    const int I = c.I, F = c.F, G = c.G, O = c.O, M = c.M, T = c.T;
    std::vector<uint64_t> result(M, 0);
    if (M <= 0) return result;
    const int gbase = I + F + 2;
    const int nfixed = 1 + I + F;
    const int maxThr = std::max(1, omp_get_max_threads());
    const int prepThr = std::min(16, maxThr);
    const bool big = G >= 20000;

    // ---- pack gates: 3 x 20-bit inputs + 4-bit type ----
    const bool packed = (int64_t)gbase + G < (1 << 20);
    struct Rec { int32_t in[3]; int32_t ty; };
    Buf<uint64_t> rec8(packed ? G : 0);
    Buf<Rec> rec(packed ? 0 : G);
#pragma omp parallel for num_threads(prepThr) schedule(static) if (big && envi("PARPACK", 0))
    for (int k = 0; k < G; k++) {
        int ty = c.type[k];
        uint64_t a = (uint64_t)c.in0[k], b = ty != 6 ? (uint64_t)c.in1[k] : 0, cc = ty == 7 ? (uint64_t)c.in2[k] : 0;
        if (packed) rec8[k] = a | (b << 20) | (cc << 40) | ((uint64_t)ty << 60);
        else { Rec& r = rec[k]; r.ty = ty; r.in[0] = (int)a; r.in[1] = (int)b; r.in[2] = (int)cc; }
    }
    auto rIn = [&](int g, int i) -> int { return packed ? (int)((rec8[g] >> (20 * i)) & 0xFFFFF) : rec[g].in[i]; };
    auto rTy = [&](int g) -> int { return packed ? (int)(rec8[g] >> 60) : rec[g].ty; };
    auto rPtr = [&](int g) -> const char* { return packed ? (const char*)&rec8[g] : (const char*)&rec[g]; };
    tm.lap("pack");

    // ---- DFS over original gates + build simplified network in post-order ----
    Net net;
    size_t nMuxGates = 0;
    for (int k = 0; k < G; k++) nMuxGates += c.type[k] == 7;
    const size_t nodeCap = (size_t)nfixed + G + nMuxGates + 1;
    Buf<Node> nodes(nodeCap);
    Buf<uint8_t> polv(nodeCap);
    memset(polv.p, 0, nodeCap);
    net.nd = nodes.p;
    net.polv = polv.p;
    net.decMux = envi("MUXDEC", 1) != 0;
    net.nfixedN = (uint32_t)nfixed;
    {
        Node z{0, 0, 0, NT_CONST, 0, 0};
        nodes[0] = z;
        for (int i = 0; i < I; i++) { Node q{(uint32_t)i, 0, 0, NT_PI, 0, 0}; nodes[1 + i] = q; }
        for (int f = 0; f < F; f++) { Node q{(uint32_t)f, 0, 0, NT_FF, 0, 0}; nodes[1 + I + f] = q; }
        net.n = nfixed;
    }
    net.initHash(nodeCap + 16);
    Buf<uint32_t> lit((size_t)gbase + G);
    lit[0] = 0; lit[1] = 1;
    for (int i = 0; i < I; i++) lit[2 + i] = (uint32_t)(1 + i) << 1;
    for (int f = 0; f < F; f++) lit[I + 2 + f] = (uint32_t)(1 + I + f) << 1;
    {
        std::vector<uint64_t> vis(((size_t)G + 63) / 64, 0);
        std::vector<int> stG;
        std::vector<uint8_t> stI;
        stG.reserve(4096); stI.reserve(4096);
        int nBuilt = 0;
        auto buildGate = [&](int g) {
            uint32_t x = lit[rIn(g, 0)];
            uint32_t res;
            switch (rTy(g)) {
                case 0: res = net.AND(x, lit[rIn(g, 1)]); break;
                case 1: res = net.OR(x, lit[rIn(g, 1)]); break;
                case 2: res = net.XOR(x, lit[rIn(g, 1)]); break;
                case 3: res = net.AND(x, lit[rIn(g, 1)]) ^ 1; break;
                case 4: res = net.OR(x, lit[rIn(g, 1)]) ^ 1; break;
                case 5: res = net.XOR(x, lit[rIn(g, 1)]) ^ 1; break;
                case 6: res = x ^ 1; break;
                default: res = net.MUX(x, lit[rIn(g, 1)], lit[rIn(g, 2)]); break;
            }
            lit[gbase + g] = res;
            if (++nBuilt == 65536 && net.useHash && net.hashHits * 100 < (uint32_t)nBuilt) net.useHash = false;
        };
        auto visit = [&](int s) {
            if (s < gbase) return;
            int g0 = s - gbase;
            if ((vis[g0 >> 6] >> (g0 & 63)) & 1) return;
            vis[g0 >> 6] |= 1ULL << (g0 & 63);
            stG.push_back(g0); stI.push_back(0);
            while (!stG.empty()) {
                int x = stG.back();
                int i = stI.back();
                const int ty = rTy(x);
                int n = ty == 6 ? 1 : (ty == 7 ? 3 : 2);
                if (i == 0) {
                    for (int k = 0; k < n; k++) {
                        int s2 = rIn(x, k);
                        if (s2 >= gbase) _mm_prefetch(rPtr(s2 - gbase), _MM_HINT_T0);
                        _mm_prefetch((const char*)&lit[s2], _MM_HINT_T0);
                    }
                }
                if (i < n) {
                    stI.back() = (uint8_t)(i + 1);
                    int s2 = rIn(x, i);
                    if (s2 >= gbase) {
                        int y = s2 - gbase;
                        if (!((vis[y >> 6] >> (y & 63)) & 1)) {
                            vis[y >> 6] |= 1ULL << (y & 63);
                            stG.push_back(y); stI.push_back(0);
                        }
                    }
                } else {
                    stG.pop_back(); stI.pop_back();
                    buildGate(x);
                }
            }
        };
        for (int j = 0; j < O; j++) visit(c.out[j]);
        for (int f = 0; f < F; f++) visit(c.d[f]);
    }
    const int NN = (int)net.n;
    std::vector<uint32_t> dlit(F), olit(O);
    for (int f = 0; f < F; f++) dlit[f] = lit[c.d[f]];
    for (int j = 0; j < O; j++) olit[j] = lit[c.out[j]];
    tm.lap("build");

    // ---- liveness (all FFs treated as live) ----
    Buf<uint8_t> live(NN);
    memset(live.p, 0, NN);
    for (int j = 0; j < O; j++) live[olit[j] >> 1] = 1;
    for (int f = 0; f < F; f++) live[dlit[f] >> 1] = 1;
    for (int n = NN - 1; n >= nfixed; n--) {
        if (!live[n]) continue;
        const Node& q = nodes[n];
        live[q.a >> 1] = 1; live[q.b >> 1] = 1;
        if (q.t >= NT_MUX) live[q.c >> 1] = 1;
    }
    // copy-FFs: d is not a gate
    std::vector<int> copyFF;
    for (int f = 0; f < F; f++)
        if (nodes[dlit[f] >> 1].t < NT_AND) copyFF.push_back(f);
    const int nCopy = (int)copyFF.size();
    // vids: [0,nfixed) fixed, [nfixed, nfixed+nCopy) copy temps, then live gates in order
    Buf<int32_t> vidOf(NN);
    int NV = nfixed + nCopy;
    for (int n = 0; n < nfixed; n++) vidOf[n] = n;
    for (int n = nfixed; n < NN; n++) vidOf[n] = live[n] ? NV++ : -1;
    const int L = NV - nfixed - nCopy;  // number of live gates
    tm.lap("live");

    // ---- FF store deferral: last reader (gate rank) of each FF ----
    std::vector<int> lastReader(F, -1);
    for (int n = nfixed; n < NN; n++) {
        if (!live[n]) continue;
        const Node& q = nodes[n];
        int rk = vidOf[n] - nfixed - nCopy;
        uint32_t ins[3] = {q.a >> 1, q.b >> 1, q.t >= NT_MUX ? (q.c >> 1) : 0u};
        for (int k = 0; k < 3; k++)
            if (ins[k] > (uint32_t)I && ins[k] < (uint32_t)nfixed) lastReader[ins[k] - 1 - I] = rk;
    }
    std::vector<int> ffHead(L > 0 ? L : 1, -1), ffNext(F, -1), defHead(L > 0 ? L : 1, -1), defNext(F, -1);
    for (int f = F - 1; f >= 0; f--) {
        uint32_t n = dlit[f] >> 1;
        if (nodes[n].t < NT_AND) continue;
        int rk = vidOf[n] - nfixed - nCopy;
        if (lastReader[f] > rk) { defNext[f] = defHead[lastReader[f]]; defHead[lastReader[f]] = f; }
        else { ffNext[f] = ffHead[rk]; ffHead[rk] = f; }
    }
    std::vector<int> outHead(L > 0 ? L : 1, -1), outNext(O, -1);
    for (int j = O - 1; j >= 0; j--) {
        uint32_t n = olit[j] >> 1;
        if (nodes[n].t < NT_AND) continue;
        int rk = vidOf[n] - nfixed - nCopy;
        outNext[j] = outHead[rk]; outHead[rk] = j;
    }

    tm.lap("defer");
    // ---- IR ----
    std::vector<Ins> ir;
    ir.reserve((size_t)L + F + O + nCopy + 4);
    Buf<int32_t> defPos(NV);
    auto effv = [&](uint32_t l) -> int { return polv[l >> 1] ^ (int)(l & 1); };
    for (int q = 0; q < nCopy; q++) {
        Ins in{};
        in.op = IR_MOV; in.d = nfixed + q; in.a = (int)(dlit[copyFF[q]] >> 1);
        defPos[in.d] = (int)ir.size();
        ir.push_back(in);
    }
    for (int j = 0; j < O; j++) {
        uint32_t n = olit[j] >> 1;
        if (nodes[n].t >= NT_AND) continue;
        Ins in{};
        in.op = IR_STO; in.d = j; in.a = (int)n;
        ir.push_back(in);
    }
    for (int n = nfixed; n < NN; n++) {
        if (!live[n]) continue;
        const Node& q = nodes[n];
        int v = vidOf[n];
        int rk = v - nfixed - nCopy;
        Ins in{};
        in.d = v;
        if (q.t == NT_AND) {
            int e1 = effv(q.a), e2 = effv(q.b);
            int vx = vidOf[q.a >> 1], vy = vidOf[q.b >> 1];
            if (!e1 && !e2) { in.op = IR_AND; in.a = vx; in.b = vy; }
            else if (e1 && !e2) { in.op = IR_ANDN; in.a = vx; in.b = vy; }
            else if (!e1 && e2) { in.op = IR_ANDN; in.a = vy; in.b = vx; }
            else { in.op = IR_OR; in.a = vx; in.b = vy; }
        } else if (q.t == NT_XOR) {
            in.op = IR_XOR; in.a = vidOf[q.a >> 1]; in.b = vidOf[q.b >> 1];
        } else if (q.t == NT_MUX) {
            uint32_t x = q.b, y = q.c;
            if (effv(q.a)) std::swap(x, y);
            in.op = IR_MUX; in.c = vidOf[q.a >> 1]; in.a = vidOf[x >> 1]; in.b = vidOf[y >> 1];
            in.q = (uint8_t)(effv(x) ^ effv(y));
        } else {
            // MUXD: out = A' ^ (S & d), d = logical (x ^ y)
            in.op = IR_MUXD; in.c = vidOf[q.a >> 1]; in.a = vidOf[q.b >> 1]; in.b = vidOf[q.c >> 1];
            in.q = (uint8_t)effv(q.c);
        }
        defPos[v] = (int)ir.size();
        ir.push_back(in);
        for (int f = ffHead[rk]; f >= 0; f = ffNext[f]) {
            Ins s{};
            s.op = (polv[n] ^ (dlit[f] & 1)) ? IR_STFI : IR_STF; s.d = f; s.a = v;
            ir.push_back(s);
        }
        for (int j = outHead[rk]; j >= 0; j = outNext[j]) {
            Ins s{};
            s.op = IR_STO; s.d = j; s.a = v;
            ir.push_back(s);
        }
        for (int f = defHead[rk]; f >= 0; f = defNext[f]) {
            uint32_t dn = dlit[f] >> 1;
            Ins s{};
            s.op = (polv[dn] ^ (dlit[f] & 1)) ? IR_STFI : IR_STF; s.d = f; s.a = vidOf[dn];
            ir.push_back(s);
        }
    }
    for (int q = 0; q < nCopy; q++) {
        int f = copyFF[q];
        int e = effv(dlit[f]);
        Ins s{};
        s.op = e ? IR_STFI : IR_STF; s.d = f; s.a = nfixed + q;
        ir.push_back(s);
    }
    const int NI = (int)ir.size();
    tm.lap("iremit");
    // next use, first use, death
    Buf<int32_t> firstUse(NV), death(NV);
    for (int v = 0; v < NV; v++) { firstUse[v] = INF; death[v] = -1; }
    for (int i = NI - 1; i >= 0; i--) {
        Ins& in = ir[i];
        switch (in.op) {
            case IR_MUX: case IR_MUXD: in.nc = firstUse[in.c]; if (in.nc == INF) death[in.c] = i; firstUse[in.c] = i; [[fallthrough]];
            case IR_AND: case IR_ANDN: case IR_OR: case IR_XOR:
                in.nb = firstUse[in.b]; if (in.nb == INF) death[in.b] = i; firstUse[in.b] = i;
                in.na = firstUse[in.a]; if (in.na == INF) death[in.a] = i; firstUse[in.a] = i;
                break;
            default: in.na = firstUse[in.a]; if (in.na == INF) death[in.a] = i; firstUse[in.a] = i; break;
        }
    }
    tm.lap("ir");

    // ---- chunking + cross-chunk slots ----
    const int targetChunk = envi("CHUNK", 8192);
    int nChunks = std::max(1, std::min(256, (NI + targetChunk - 1) / std::max(1, targetChunk)));
    std::vector<int> cb(nChunks + 1);
    for (int k = 0; k <= nChunks; k++) cb[k] = (int)((long long)NI * k / nChunks);
    // vid range per chunk (defs are monotone in vid)
    std::vector<int> cvlo(nChunks + 1);
    {
        int v = nfixed;
        for (int k = 0; k < nChunks; k++) {
            while (v < NV && defPos[v] < cb[k]) v++;
            cvlo[k] = v;
        }
        cvlo[nChunks] = NV;
    }
    Buf<int32_t> crossSlot(NV);
    for (int v = 0; v < NV; v++) crossSlot[v] = -1;
    int nCross = 0;
    {
        std::vector<int> freeS;
        std::vector<std::vector<int>> dieIn(nChunks);
        for (int k = 0; k < nChunks; k++) {
            if (k > 0)
                for (int v : dieIn[k - 1]) freeS.push_back(crossSlot[v]);
            for (int v = cvlo[k]; v < cvlo[k + 1]; v++) {
                if (death[v] < cb[k + 1]) continue;
                int sl;
                if (!freeS.empty()) { sl = freeS.back(); freeS.pop_back(); }
                else sl = nCross++;
                crossSlot[v] = sl;
                int dk = (int)(std::upper_bound(cb.begin(), cb.end(), death[v]) - cb.begin()) - 1;
                dieIn[std::min(dk, nChunks - 1)].push_back(v);
            }
        }
    }
    tm.lap("cross");

    // ---- parallel codegen ----
    GenShared gs;
    gs.ir = ir.data(); gs.firstUse = firstUse.p; gs.death = death.p; gs.crossSlot = crossSlot.p;
    gs.I = I; gs.nfixed = nfixed; gs.nCross = nCross; gs.farThresh = envi("FARTH", 300);
    std::vector<ChunkOut> chunks(nChunks);
#pragma omp parallel for num_threads(prepThr) schedule(dynamic, 1) if (nChunks > 1)
    for (int k = 0; k < nChunks; k++) genChunk(gs, cb[k], cb[k + 1], cvlo[k], cvlo[k + 1], chunks[k]);
    int nearMax = 0, farMax = 0;
    for (int k = 0; k < nChunks; k++) {
        nearMax = std::max(nearMax, chunks[k].nearMax);
        farMax = std::max(farMax, chunks[k].farMax);
    }
    // group chunks into callable units of ~unitBytes code each
    const size_t unitBytes = (size_t)envi("UNITKB", 0) * 1024;
    std::vector<int> ub;  // unit boundaries in chunk indices
    ub.push_back(0);
    {
        size_t acc = 0;
        for (int k = 0; k < nChunks; k++) {
            acc += chunks[k].code.size();
            if (unitBytes && acc >= unitBytes && k + 1 < nChunks) { ub.push_back(k + 1); acc = 0; }
        }
        ub.push_back(nChunks);
    }
    const int nUnits = (int)ub.size() - 1;
    uint8_t pro[256], epi[256];
    size_t proLen, epiLen;
    {
        Emitter E; E.p = pro; emitPrologue(E); proLen = (size_t)(E.p - pro);
        E.p = epi; emitEpilogue(E); epiLen = (size_t)(E.p - epi);
    }
    std::vector<size_t> coff(nChunks + 1), uoff(nUnits + 1);
    {
        size_t pos = 0;
        for (int u = 0; u < nUnits; u++) {
            uoff[u] = pos;
            pos += proLen;
            for (int k = ub[u]; k < ub[u + 1]; k++) { coff[k] = pos; pos += chunks[k].code.size(); }
            pos += epiLen;
            pos = (pos + 63) & ~(size_t)63;
        }
        uoff[nUnits] = pos;
    }
    const size_t codeSize = uoff[nUnits];
    uint8_t* code = (uint8_t*)VirtualAlloc(nullptr, codeSize, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
#pragma omp parallel for num_threads(prepThr) schedule(static) if (nChunks > 1)
    for (int k = 0; k < nChunks; k++) memcpy(code + coff[k], chunks[k].code.data(), chunks[k].code.size());
    for (int u = 0; u < nUnits; u++) {
        memcpy(code + uoff[u], pro, proLen);
        size_t e = coff[ub[u + 1] - 1] + chunks[ub[u + 1] - 1].code.size();
        memcpy(code + e, epi, epiLen);
    }
    DWORD oldp;
    VirtualProtect(code, codeSize, PAGE_EXECUTE_READ, &oldp);
    FlushInstructionCache(GetCurrentProcess(), code, codeSize);
    std::vector<JitFn> ufn(nUnits);
    for (int u = 0; u < nUnits; u++) ufn[u] = (JitFn)(void*)(code + uoff[u]);
    tm.lap("codegen");
#ifdef DBG
    {
        size_t sp = 0, ld = 0;
        size_t cn[8] = {0, 0, 0, 0, 0, 0, 0, 0};
        for (auto& ch : chunks) { sp += ch.nSpill; ld += ch.nLoad; for (int q = 0; q < 8; q++) cn[q] += ch.cnt[q]; }
        fprintf(stderr, "  instr: rr=%zu rm=%zu load=%zu store=%zu | mem by base: S=%zu FF=%zu\n", cn[0], cn[1], cn[2], cn[3], cn[4], cn[5]);
        fprintf(stderr, "  nodes=%d live=%d ir=%d chunks=%d units=%d code=%zu cross=%d far=%d near=%d spills=%zu loads=%zu\n",
                NN - nfixed, L, NI, nChunks, nUnits, codeSize, nCross, farMax, nearMax, sp, ld);
    }
#endif
    std::vector<ChunkOut>().swap(chunks);

    // ---- output digests ----
    std::vector<uint64_t> K((size_t)T * O);
    uint64_t corr = 0;
    std::vector<uint8_t> outInv(O);
    for (int j = 0; j < O; j++) outInv[j] = (uint8_t)effv(olit[j]);
    for (int t = 0; t < T; t++)
        for (int j = 0; j < O; j++) {
            uint64_t k = mix64((uint64_t)t * O + j);
            K[(size_t)t * O + j] = k;
            if (outInv[j]) corr ^= k;
        }

    const int groups = (M + 255) / 256;
    const int W = std::max(1, std::min(8, envi("W", 1)));
    const int batches = (groups + W - 1) / W;
    int nthr = std::min(batches, std::min(maxThr, envi("SIMTHR", 8)));
    if (nthr < 1) nthr = 1;
    const size_t lowBytes = (size_t)(nCross + farMax) * 32;
    const size_t sBytes = lowBytes + (size_t)(SLOT_SPILL + nearMax + 1) * 32;
    const size_t ffBytes = (size_t)std::max(F, 1) * 32;
    tm.lap("prep");

#pragma omp parallel num_threads(nthr)
    {
        uint8_t* Sraw[8];
        uint8_t* S[8];
        uint8_t* FA[8];
        __m256i* Hs[8];
        uint64_t* rs[8];
        alignas(64) uint64_t ctx[8][8];
        alignas(32) uint8_t save[160];
        alignas(32) __m256i tb[64];
        for (int w = 0; w < W; w++) {
            Sraw[w] = (uint8_t*)_mm_malloc(sBytes, 64);
            memset(Sraw[w], 0, sBytes);
            S[w] = Sraw[w] + lowBytes;
            memset(S[w] + SLOT_ONES * 32, 0xFF, 32);
            FA[w] = (uint8_t*)_mm_malloc(ffBytes, 64);
            Hs[w] = (__m256i*)_mm_malloc(64 * 32, 64);
            rs[w] = (uint64_t*)_mm_malloc(256 * 8, 64);
            ctx[w][0] = (uint64_t)S[w]; ctx[w][1] = (uint64_t)FA[w]; ctx[w][2] = (uint64_t)FA[w];
            ctx[w][6] = (uint64_t)save;
        }
#pragma omp for schedule(static)
        for (int bt = 0; bt < batches; bt++) {
            for (int w = 0; w < W; w++) {
                const int g = bt * W + w;
                memset(FA[w], 0, ffBytes);
                for (int b = 0; b < 64; b++) Hs[w][b] = _mm256_setzero_si256();
                for (int i = 0; i < 256; i++) rs[w][i] = mix64(c.seed ^ ((uint64_t)g * 256 + i));
            }
            for (int t = 0; t < T; t++) {
                for (int w = 0; w < W; w++) {
                    uint64_t* tbu = (uint64_t*)tb;
                    uint64_t* r = rs[w];
                    for (int l = 0; l < 4; l++)
                        for (int i = 0; i < 64; i++) {
                            uint64_t z = (r[l * 64 + i] += 0x9E3779B97F4A7C15ULL);
                            z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
                            z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
                            tbu[i * 4 + l] = z ^ (z >> 31);
                        }
                    transpose64x4(tb);
                    for (int i = 0; i < I; i++) _mm256_store_si256((__m256i*)(S[w] + (SLOT_PI + i) * 32), tb[i]);
                }
                for (int u = 0; u < nUnits; u++)
                    for (int w = 0; w < W; w++) ufn[u](ctx[w]);
                const uint64_t* Kt = &K[(size_t)t * O];
                for (int w = 0; w < W; w++) {
                    __m256i* H = Hs[w];
                    for (int j = 0; j < O; j++) {
                        __m256i v = _mm256_load_si256((const __m256i*)(S[w] + (SLOT_OUT + j) * 32));
                        uint64_t k = Kt[j];
                        while (k) {
                            int b = (int)_tzcnt_u64(k);
                            k &= k - 1;
                            H[b] = _mm256_xor_si256(H[b], v);
                        }
                    }
                }
            }
            for (int w = 0; w < W; w++) {
                const int g = bt * W + w;
                for (int b = 0; b < 64; b++) tb[b] = Hs[w][b];
                transpose64x4(tb);
                uint64_t* tbu = (uint64_t*)tb;
                for (int l = 0; l < 4; l++)
                    for (int i = 0; i < 64; i++) {
                        int64_t m = (int64_t)g * 256 + l * 64 + i;
                        if (m < M) result[m] = tbu[i * 4 + l] ^ corr;
                    }
            }
        }
        for (int w = 0; w < W; w++) { _mm_free(Sraw[w]); _mm_free(FA[w]); _mm_free(Hs[w]); _mm_free(rs[w]); }
    }
    tm.lap("sim");
    VirtualFree(code, 0, MEM_RELEASE);
    return result;
}
