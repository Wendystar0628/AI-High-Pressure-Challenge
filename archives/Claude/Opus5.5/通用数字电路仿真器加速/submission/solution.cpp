// Cycle simulator: compiles the netlist to AVX2 machine code (256 stimuli per vector) and runs it in parallel.
#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
#include <immintrin.h>
#include <malloc.h>
#include <omp.h>
#include <windows.h>
#ifdef DEV
#include <chrono>
#endif

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

inline uint64_t splitmix64_next(uint64_t* s) {
    uint64_t z = (*s += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}
inline uint64_t mix64(uint64_t x) { return splitmix64_next(&x); }

#ifdef DEV
double now_ms() {
    return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now().time_since_epoch()).count();
}
int env_int(const char* n, int dflt) {
    const char* s = getenv(n);
    return s ? atoi(s) : dflt;
}
#endif

constexpr int SEGMENTS = 16;                   // pieces of the program compiled in parallel
constexpr int WORKERS = 8;                     // one per performance core: SMT only adds cache and TLB pressure
constexpr size_t COMPILE_ARENA = 96u << 20;    // working memory of the compiler
constexpr size_t CODE_CAPACITY = 96u << 20;    // reserved for generated code
constexpr size_t CODE_PRETOUCH = 64u << 20;    // part of it touched ahead of time
constexpr size_t FRAME_PRETOUCH = 6u << 20;    // simulation frame of a worker

// Memory kept for the whole process: page faults are paid during the warm-up call, once.
struct Pool {
    uint8_t* code = nullptr;
    char* arena = nullptr;
    char* frames[WORKERS] = {};
    size_t frameCap[WORKERS] = {};
    bool threadsReady = false;
} pool;

void touch(void* p, size_t n) {
    for (size_t i = 0; i < n; i += 4096) ((volatile char*)p)[i] = 0;
}

void prepareFrame(int w, size_t bytes) {
    if (pool.frameCap[w] >= bytes) return;
    if (pool.frames[w]) VirtualFree(pool.frames[w], 0, MEM_RELEASE);
    pool.frames[w] = (char*)VirtualAlloc(nullptr, bytes, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    pool.frameCap[w] = pool.frames[w] ? bytes : 0;
    if (pool.frames[w]) touch(pool.frames[w], bytes);
}

void preparePool() {
    if (pool.threadsReady) return;
    pool.threadsReady = true;
    pool.code = (uint8_t*)VirtualAlloc(nullptr, CODE_CAPACITY, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
    pool.arena = (char*)VirtualAlloc(nullptr, COMPILE_ARENA, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
#pragma omp parallel num_threads(WORKERS)
    {
        int w = omp_get_thread_num();
        if (w < WORKERS) prepareFrame(w, FRAME_PRETOUCH);
#pragma omp for schedule(static)
        for (int i = 0; i < 64; i++) {
            size_t step = 1u << 20;
            if (pool.code && i * step < CODE_PRETOUCH) touch(pool.code + i * step, step);
            if (pool.arena) touch(pool.arena + i * step, step);
        }
    }
    // the rest of the arena, on demand
}

// ---- plain simulator, used only if executable memory is unavailable ----
std::vector<uint64_t> simulatePlain(const Circuit& c) {
    const int base = c.I + c.F + 2, N = base + c.G;
    std::vector<int> order, st;
    std::vector<char> vis(c.G, 0);
    for (int k = 0; k < c.G; k++) {
        if (vis[k]) continue;
        st.push_back(k);
        while (!st.empty()) {
            int g = st.back();
            if (vis[g] == 2) { st.pop_back(); continue; }
            if (vis[g] == 0) {
                vis[g] = 1;
                for (int x : {c.in0[g], c.in1[g], c.in2[g]})
                    if (x >= base && !vis[x - base]) st.push_back(x - base);
            } else {
                vis[g] = 2;
                st.pop_back();
                order.push_back(g);
            }
        }
    }
    std::vector<uint64_t> res(c.M, 0);
    const int batches = (c.M + 63) / 64;
#pragma omp parallel for schedule(dynamic, 1) num_threads(WORKERS)
    for (int b = 0; b < batches; b++) {
        std::vector<uint64_t> v(N, 0), nx(c.F);
        uint64_t rs[64];
        int cnt = std::min(64, c.M - b * 64);
        for (int i = 0; i < cnt; i++) rs[i] = mix64(c.seed ^ (uint64_t)(b * 64 + i));
        v[1] = ~0ULL;
        for (int t = 0; t < c.T; t++) {
            uint64_t pi[64] = {};
            for (int i = 0; i < cnt; i++) {
                uint64_t r = splitmix64_next(&rs[i]);
                for (int k = 0; k < 64 && k < c.I; k++) pi[k] |= ((r >> k) & 1) << i;
            }
            for (int k = 0; k < c.I && k < 64; k++) v[2 + k] = pi[k];
            for (int g : order) {
                uint64_t x = v[c.in0[g]], y = c.in1[g] >= 0 ? v[c.in1[g]] : 0, z = c.in2[g] >= 0 ? v[c.in2[g]] : 0, r;
                switch (c.type[g]) {
                    case 0: r = x & y; break;
                    case 1: r = x | y; break;
                    case 2: r = x ^ y; break;
                    case 3: r = ~(x & y); break;
                    case 4: r = ~(x | y); break;
                    case 5: r = ~(x ^ y); break;
                    case 6: r = ~x; break;
                    default: r = (x & z) | (~x & y); break;
                }
                v[base + g] = r;
            }
            for (int j = 0; j < c.O; j++) {
                uint64_t x = v[c.out[j]], w = mix64((uint64_t)t * (uint64_t)c.O + (uint64_t)j);
                for (int i = 0; i < cnt; i++)
                    if ((x >> i) & 1) res[b * 64 + i] ^= w;
            }
            for (int f = 0; f < c.F; f++) nx[f] = v[c.d[f]];
            for (int f = 0; f < c.F; f++) v[c.I + 2 + f] = nx[f];
        }
    }
    return res;
}

// ---- netlist compiler ----
enum Kind : uint8_t { K_AND, K_XOR, K_MUX, K_COPY };

constexpr int NONE = 0x7fffffff;      // no further use
constexpr int ENDUSE = 0x7ffffffe;    // read at the end of the cycle
constexpr int NOSLOT = -0x7fffffff;
constexpr int R_S1 = 14, R_S2 = 15, NREG = 14;  // scratch registers are never allocated to values

// Packed copy of a gate, 8 bytes so that more of them fit the caches during the depth-first walk.
// Bits 0-19, 20-39: first inputs; bits 40-59: third input of a MUX, type of the others; bit 60: MUX;
// bits 62-63: state. A finished gate holds its literal in the low bits.
constexpr uint64_t SIG_MASK = 0xFFFFF;
constexpr int MAX_SIGNALS = 0xFFFFF;
constexpr uint64_t ST_VISITING = 1ULL << 62, ST_DONE = 2ULL << 62;

struct Op {
    int a, b, c;  // operand literals
    int link;     // (next op with the same key << 2) | kind
};

struct Info {
    int next;      // first read of a gate, while building the tables: next read
    int slot;      // byte offset from the anchor; below -128: fixed home, otherwise a temporary of its segment
    int aux;       // >= 0: last read; < 0: offset of the flip-flop slot this gate is written to
    uint8_t pinv;  // stored value is the complement of the node
    uint8_t inMem;  // the value has been stored (only meaningful inside the segment defining it)
    uint16_t pad;
};

struct Compiled {
    size_t codeLen = 0;
    int L = 0;
    int localSlots = 0;  // temporaries above the anchor
    std::vector<int> outOff;
    uint64_t outInv = 0;
    int stateLow = 0;  // flip-flop, input and constant area: [stateLow, -128)
    int low = 0;       // lowest used frame offset
    int piOff = 0;
    int nops = 0;
    long long loads = 0, stores = 0, alu = 0;
};

// Frame layout around the anchor: segment temporaries at (k-4)*32; constant 0 at -160; primary inputs below it, in
// ascending order; flip-flops below those; values crossing segments below those.
inline int tempOff(int k) { return (k - 4) * 32; }

// Base registers of the temporaries, one per 256 bytes (rbx is the anchor itself). rdi is kept for flip-flops.
constexpr int WINDOWS = 13;
constexpr int WINDOW_REG[WINDOWS] = {3, 0, 1, 2, 5, 6, 8, 9, 10, 11, 13, 14, 15};

// Register allocation and encoding of one segment of the program. Segments start and end with empty registers, so
// they can be compiled independently: all a segment needs from the others is fixed by the table of values.
struct Emitter {
    const Op* ops;
    const int* nxt;
    Info* info;
    const int L;
    uint8_t* cp;
    int segFirst = 0;  // first node defined in this segment
    int segLast = 0;
    int ffFirst = 0;
    int slideLo = 0x7ffffff0;
    int slideLook = 16, slideNeed = 2;
    int ffHighOff = -0x7fffffff, ffLowOff = 0;  // flip-flop area: [ffLowOff, ffHighOff)
    alignas(32) int regVal[16];
    int regNext[16];
    int curP = 0;
    static constexpr int LCLASSES = 2;
    std::vector<int> freeSlots[LCLASSES];
    std::vector<uint8_t> blockClass;
    int blockNext[LCLASSES];
    int localHigh = 0;
    long long loads = 0, stores = 0, alu = 0;

    Emitter(const Op* o, const int* n, Info* i, int l) : ops(o), nxt(n), info(i), L(l), cp(nullptr) {}

    // ---- x86 encoding ----
    void vexRR(uint8_t op, int d, int v, int rm) {
        if (rm < 8) {
            *cp++ = 0xC5;
            *cp++ = (uint8_t)(((d < 8) << 7) | ((~v & 15) << 3) | 4 | 1);
        } else {
            *cp++ = 0xC4;
            *cp++ = (uint8_t)(((d < 8) << 7) | 0x40 | 0x01);
            *cp++ = (uint8_t)(((~v & 15) << 3) | 4 | 1);
        }
        *cp++ = op;
        *cp++ = (uint8_t)(0xC0 | ((d & 7) << 3) | (rm & 7));
    }
    // Short encodings: base registers point into the temporaries, 256 bytes apart, and rdi slides over the
    // flip-flops when several of them are read in sequence.
    void vexRM(uint8_t op, int d, int v, int off) {
        int base = 3;  // rbx
        int disp = off;
        if (off >= -128 && off < (int)(WINDOWS * 256 - 128)) {
            int w = (off + 128) >> 8;
            base = WINDOW_REG[w];
            disp = off - w * 256;
        } else if (off >= slideLo && off <= slideLo + 255) {
            base = 7;
            disp = off - (slideLo + 128);
        } else if (off < -128) {
            base = 3;
        }
        if (base < 8) {
            *cp++ = 0xC5;
            *cp++ = (uint8_t)(((d < 8) << 7) | ((~v & 15) << 3) | 4 | 1);
        } else {
            *cp++ = 0xC4;
            *cp++ = (uint8_t)(((d < 8) << 7) | 0x40 | 0x01);
            *cp++ = (uint8_t)(((~v & 15) << 3) | 4 | 1);
        }
        *cp++ = op;
        if (disp >= -128 && disp <= 127) {
            *cp++ = (uint8_t)(0x40 | ((d & 7) << 3) | (base & 7));
            *cp++ = (uint8_t)disp;
        } else {
            *cp++ = (uint8_t)(0x80 | ((d & 7) << 3) | (base & 7));
            memcpy(cp, &disp, 4);
            cp += 4;
        }
    }
    // Before a read of flip-flop slot `off`: point rdi at it if more reads close by follow.
    void maybeSlide(int off) {
        if (off >= slideLo && off <= slideLo + 255) return;
        const int lo = off - 224, hi = off;
        int hits = 0;
        const int end = std::min(curP + slideLook, segLast);
        for (int q = curP; q < end && hits < slideNeed; q++) {
            if (info[L + q].next == NONE) continue;
            const Op& o = ops[q];
            const int vs[3] = {o.a >> 1, o.b >> 1, o.c >> 1};
            for (int k = 0; k < 3; k++) {
                int x = vs[k];
                if (x < ffFirst || x >= L) continue;
                int sl = info[x].slot;
                if (sl >= lo && sl <= hi && sl != off) hits++;
            }
        }
        if (hits < slideNeed) return;
        slideLo = lo - 1 < 0 ? lo : lo;
        // keep the window aligned to the slots: rdi = lo + 128, reach [lo, lo + 255]
        slideLo = lo;
        *cp++ = 0x48; *cp++ = 0x8D; *cp++ = 0xBB;  // lea rdi, [rbx + disp32]
        int d32 = lo + 128;
        memcpy(cp, &d32, 4);
        cp += 4;
    }
    void opRR(uint8_t op, int d, int a, int b, bool comm) {
        if (comm && b >= 8 && a < 8) std::swap(a, b);
        vexRR(op, d, a, b);
#ifdef DEV
        alu++;
#endif
    }
    void opRM(uint8_t op, int d, int a, int off) {
        if (off < ffHighOff && off >= ffLowOff) maybeSlide(off);
        vexRM(op, d, a, off);
#ifdef DEV
        alu++;
        loads++;
#endif
    }
    void load(int d, int off) {
        if (off < ffHighOff && off >= ffLowOff) maybeSlide(off);
        vexRM(0x6F, d, 0, off);
#ifdef DEV
        loads++;
#endif
    }
    void store(int off, int s) {
        vexRM(0x7F, s, 0, off);
#ifdef DEV
        stores++;
#endif
    }
    static constexpr uint8_t OP_AND = 0xDB, OP_ANDN = 0xDF, OP_OR = 0xEB, OP_XOR = 0xEF;

    // ---- temporaries: pages are dedicated to values of similar lifetime, so short-lived ones stay together ----
    int allocSlot(int life) {
        int cl = life < 256 ? 0 : 1;
        std::vector<int>& fr = freeSlots[cl];
        if (!fr.empty()) {
            int s = fr.back();
            fr.pop_back();
            return s;
        }
        if (blockNext[cl] < 0) {
            blockNext[cl] = localHigh;
            localHigh += 128;
            blockClass.push_back((uint8_t)cl);
        }
        int s = blockNext[cl]++;
        if ((blockNext[cl] & 127) == 0) blockNext[cl] = -1;
        return s;
    }
    void freeSlot(int off) {
        int k = off / 32 + 4;
        freeSlots[blockClass[k >> 7]].push_back(k);
    }

    // ---- register allocation (furthest next use) ----
    int regOf(int v) const {
        const __m256i key = _mm256_set1_epi32(v);
        unsigned m = (unsigned)_mm256_movemask_ps(_mm256_castsi256_ps(_mm256_cmpeq_epi32(key, _mm256_load_si256((const __m256i*)regVal)))) |
                     ((unsigned)_mm256_movemask_ps(_mm256_castsi256_ps(_mm256_cmpeq_epi32(key, _mm256_load_si256((const __m256i*)(regVal + 8))))) << 8);
        return m ? __builtin_ctz(m) : -1;
    }
    void writeBack(int v, int r) {
        if (v < segFirst) return;  // defined by an earlier segment: already in memory
        Info& iv = info[v];
        if (!iv.inMem) {
            iv.inMem = 1;
            if (iv.slot == NOSLOT) iv.slot = tempOff(allocSlot(iv.aux - curP));
            store(iv.slot, r);
        }
    }
    void evict(int r) {
        int v = regVal[r];
        if (v >= 0 && regNext[r] != NONE) writeBack(v, r);
        regVal[r] = -1;
        regNext[r] = NONE;
    }
    // The register whose value is needed last, or -1 if every candidate is needed before `next`.
    int pickReg(int next, unsigned forbid) {
        int best = -1, bestNext = -1;
        for (int r = 0; r < NREG; r++) {
            if (forbid >> r & 1) continue;
            if (regNext[r] > bestNext) {
                bestNext = regNext[r];
                best = r;
            }
        }
        return bestNext > next || (best >= 0 && regVal[best] < 0) ? best : -1;
    }
    void bind(int r, int v, int next) {
        regVal[r] = v;
        regNext[r] = next;
    }
    int fetch(int v, int next, unsigned forbid, int scratch) {
        int have = regOf(v);
        if (have >= 0) return have;
        int r = pickReg(next, forbid);
        if (r < 0) {
            load(scratch, info[v].slot);
            return scratch;
        }
        evict(r);
        load(r, info[v].slot);
        bind(r, v, next);
        return r;
    }
    void release(int v, int next) {
        int r = regOf(v);
        if (r >= 0) regNext[r] = next;
        if (next == NONE) {
            if (r >= 0) regVal[r] = -1;
            if (v >= segFirst && info[v].inMem && info[v].slot >= -128) freeSlot(info[v].slot);
        }
    }
    void unbind(int r) {
        regVal[r] = -1;
        regNext[r] = NONE;
    }
    void finishDest(int g, int r, int next, bool scratchDest) {
        if (scratchDest) {
            writeBack(g, r);
            return;
        }
        bind(r, g, next);
    }

    void segment(int first, int last) {
        segFirst = L + first;
        segLast = last;
        slideLo = 0x7ffffff0;
        for (int r = 0; r < 16; r++) {
            regVal[r] = -1;
            regNext[r] = NONE;
        }
        for (int i = 0; i < LCLASSES; i++) {
            freeSlots[i].clear();
            blockNext[i] = -1;
        }
        blockClass.assign(1, 0);
        localHigh = 128;
        blockNext[0] = 0;
        for (int p = first; p < last; p++) {
            const int g = L + p;
            const int gnext = info[g].next;
            if (gnext == NONE) continue;
            curP = p;
            const Op& o = ops[p];
            const int* nx = nxt + 3 * (size_t)p;
            switch (o.link & 3) {
                case K_COPY: {
                    int v = o.a >> 1;
                    int nA = nx[0];
                    int src = fetch(v, nA, 0, R_S1);
                    int d = pickReg(gnext, 1u << src);
                    bool sc = false;
                    if (d < 0) { d = R_S2; sc = true; }
                    else evict(d);
                    vexRR(0x6F, d, 0, src);
                    release(v, nA);
                    finishDest(g, d, gnext, sc);
                    break;
                }
                case K_AND:
                case K_XOR: {
                    int a = o.a >> 1, b = o.b >> 1;
                    int ea = (o.a & 1) ^ info[a].pinv, eb = (o.b & 1) ^ info[b].pinv;
                    int na = nx[0], nb = nx[1];
                    uint8_t op;
                    bool comm = true;
                    if ((o.link & 3) == K_XOR) {
                        op = OP_XOR;
                    } else if (!ea && !eb) {
                        op = OP_AND;
                    } else if (ea && eb) {
                        op = OP_OR;
                    } else {
                        op = OP_ANDN;
                        comm = false;
                        if (eb) {  // first source is the inverted one
                            std::swap(a, b);
                            std::swap(na, nb);
                        }
                    }
                    int ra = regOf(a), rb = regOf(b);
                    if (comm && ((ra < 0 && rb >= 0) || (ra < 0 && rb < 0 && nb < na))) {
                        std::swap(a, b);
                        std::swap(na, nb);
                        std::swap(ra, rb);
                    }
                    // a must be in a register, b may stay in memory
                    ra = fetch(a, na, rb >= 0 ? (1u << rb) : 0, R_S1);
                    unsigned forbid = (ra < NREG ? 1u << ra : 0) | (rb >= 0 ? 1u << rb : 0);
                    int d;
                    bool sc = false;
                    if (na == NONE && ra < NREG) d = ra;
                    else if (nb == NONE && rb >= 0) d = rb;
                    else {
                        d = pickReg(gnext, forbid);
                        if (d < 0) { d = ra == R_S1 ? R_S1 : R_S2; sc = true; }
                        else evict(d);
                    }
                    if (rb >= 0) opRR(op, d, ra, rb, comm);
                    else opRM(op, d, ra, info[b].slot);
                    if (d == ra && ra < NREG) unbind(ra);
                    if (d == rb && rb >= 0) unbind(rb);
                    release(a, na);
                    release(b, nb);
                    finishDest(g, d, gnext, sc);
                    break;
                }
                default: {  // K_MUX: (s & b) | (~s & a)
                    int s = o.a >> 1, a = o.b >> 1, b = o.c >> 1;
                    int es = (o.a & 1) ^ info[s].pinv, ea = (o.b & 1) ^ info[a].pinv, eb = (o.c & 1) ^ info[b].pinv;
                    int ns = nx[0], na = nx[1], nb = nx[2];
                    if (es) {
                        std::swap(a, b);
                        std::swap(ea, eb);
                        std::swap(na, nb);
                    }
                    if (ea) eb ^= 1;  // the result is stored complemented
                    int ra = regOf(a), rb = regOf(b);
                    int rs = fetch(s, ns, (ra >= 0 ? 1u << ra : 0) | (rb >= 0 ? 1u << rb : 0), R_S1);
                    int t = R_S2;
                    if (eb) {
                        unsigned forbid = (rs < NREG ? 1u << rs : 0) | (ra >= 0 ? 1u << ra : 0);
                        rb = fetch(b, nb, forbid, R_S2);
                        if (nb == NONE && rb < NREG) t = rb;
                        opRR(OP_ANDN, t, rb, rs, false);
                    } else {
                        if (nb == NONE && rb >= 0) t = rb;
                        if (rb >= 0) opRR(OP_AND, t, rs, rb, true);
                        else opRM(OP_AND, t, rs, info[b].slot);
                    }
                    unsigned forbid = (rs < NREG ? 1u << rs : 0) | (ra >= 0 ? 1u << ra : 0) | (rb >= 0 && rb < NREG ? 1u << rb : 0);
                    int dd;
                    bool sc = false;
                    if (na == NONE && ra >= 0) dd = ra;
                    else if (ns == NONE && rs < NREG) dd = rs;
                    else {
                        dd = pickReg(gnext, forbid);
                        if (dd < 0) { dd = R_S1; sc = true; }
                        else evict(dd);
                    }
                    if (ra >= 0) opRR(OP_ANDN, dd, rs, ra, false);
                    else opRM(OP_ANDN, dd, rs, info[a].slot);
                    opRR(OP_OR, dd, dd, t, true);
                    if (dd == ra && ra >= 0) unbind(ra);
                    if (dd == rs && rs < NREG) unbind(rs);
                    if (rb >= 0 && rb < NREG && t == rb) unbind(rb);
                    release(s, ns);
                    release(a, na);
                    release(b, nb);
                    finishDest(g, dd, gnext, sc);
                    break;
                }
            }
        }
        // Whatever is still needed goes to its home.
        for (int r = 0; r < NREG; r++) evict(r);
    }
};

struct Compiler {
    const Circuit& c;
    Compiled& P;
    const int base;
    const int L;
    uint64_t* gs;
    Op* ops;
    int* head;
    int* nxt;
    Info* info;
    int ng = 0;
    uint8_t* cp;
    int piCount;
    int opt = 3;
    long long simpH = 0, simpR = 0;

    Compiler(const Circuit& ci, Compiled& p, uint8_t* code)
        : c(ci), P(p), base(ci.I + ci.F + 2), L(1 + ci.I + ci.F), cp(code) {
        piCount = std::max(c.I, 64);
    }

    int leafLit(int sig) const { return sig < 2 ? sig : (sig - 1) * 2; }

    int newOp(int k, int a, int b, int cc, int key) {
        Op& o = ops[ng];
        o.a = a;
        o.b = b;
        o.c = cc;
        o.link = (head[key] << 2) | k;
        head[key] = ng;
        return L + ng++;
    }
    int hashed(int k, int a, int b, int cc) {
        int key = std::max(a, std::max(b, cc)) >> 1;
        if (opt >= 1) {
            int p = head[key];
            for (int hop = 0; p >= 0 && hop < 6; hop++) {
                const Op& o = ops[p];
                if ((o.link & 3) == k && o.a == a && o.b == b && o.c == cc) {
                    simpH++;
                    return L + p;
                }
                p = o.link >> 2;
            }
        }
        return newOp(k, a, b, cc, key);
    }
    const Op* opOf(int lit) const { return (lit >> 1) >= L ? &ops[(lit >> 1) - L] : nullptr; }
    static int kindOf(const Op* o) { return o->link & 3; }

    // Value of literal y when the variable of literal x makes x true, if that simplifies y.
    int cofactor(int y, int x) {
        const Op* o = opOf(y);
        if (!o) return y;
        const int inv = y & 1;
        const int notx = x ^ 1;
        switch (kindOf(o)) {
            case K_AND:
                if (o->a == x) return o->b ^ inv;
                if (o->b == x) return o->a ^ inv;
                if (o->a == notx || o->b == notx) return inv;
                break;
            case K_XOR:
                if (o->a == (x & ~1)) return o->b ^ inv ^ ((x & 1) ^ 1);
                if (o->b == (x & ~1)) return o->a ^ inv ^ ((x & 1) ^ 1);
                break;
            case K_MUX:
                if (o->a == x) return o->c ^ inv;
                if (o->a == notx) return o->b ^ inv;
                break;
            default: break;
        }
        return y;
    }

    int mkAnd(int a, int b) {
        for (;;) {
            if (a == 0 || b == 0 || a == (b ^ 1)) return 0;
            if (a == 1 || a == b) return b;
            if (b == 1) return a;
            if (opt < 2) break;
            int nb = cofactor(b, a);
            if (nb != b) {
                simpR++;
                b = nb;
                continue;
            }
            int na = cofactor(a, b);
            if (na != a) {
                simpR++;
                a = na;
                continue;
            }
            break;
        }
        if (a > b) std::swap(a, b);
        return hashed(K_AND, a, b, -1) * 2;
    }
    int mkXor(int a, int b) {
        int inv = (a ^ b) & 1;
        a &= ~1;
        b &= ~1;
        for (;;) {
            if (a == b) return inv;
            if (a == 0) return b ^ inv;
            if (b == 0) return a ^ inv;
            if (opt < 2) break;
            const Op* oa = opOf(a);
            const Op* ob = opOf(b);
            if (ob && kindOf(ob) == K_XOR) {
                if (ob->a == a) { simpR++; return ob->b ^ inv; }
                if (ob->b == a) { simpR++; return ob->a ^ inv; }
            }
            if (oa && kindOf(oa) == K_XOR) {
                if (oa->a == b) { simpR++; return oa->b ^ inv; }
                if (oa->b == b) { simpR++; return oa->a ^ inv; }
                if (ob && kindOf(ob) == K_XOR) {
                    // (p^q) ^ (p^r) = q ^ r
                    int p = oa->a, q = oa->b, r = ob->a, t = ob->b;
                    int x = -1, y = -1;
                    if (p == r) { x = q; y = t; }
                    else if (p == t) { x = q; y = r; }
                    else if (q == r) { x = p; y = t; }
                    else if (q == t) { x = p; y = r; }
                    if (x >= 0) {
                        simpR++;
                        a = x;
                        b = y;
                        continue;
                    }
                }
            }
            break;
        }
        if (a > b) std::swap(a, b);
        return (hashed(K_XOR, a, b, -1) * 2) ^ inv;
    }
    int mkMux(int s, int a, int b) {
        if (s & 1) {
            s ^= 1;
            std::swap(a, b);
        }
        for (;;) {
            if (s == 0) return a;
            if (a == b) return a;
            if (a == (b ^ 1)) return mkXor(s, a);
            if (a == 0) return mkAnd(s, b);
            if (a == 1) return mkAnd(s, b ^ 1) ^ 1;
            if (b == 0) return mkAnd(s ^ 1, a);
            if (b == 1) return mkAnd(s ^ 1, a ^ 1) ^ 1;
            if (s == a) return mkAnd(s, b);
            if (s == (a ^ 1)) return mkAnd(s, b ^ 1) ^ 1;
            if (s == b) return mkAnd(s ^ 1, a ^ 1) ^ 1;
            if (s == (b ^ 1)) return mkAnd(s ^ 1, a);
            if (opt < 2) break;
            int na = cofactor(a, s ^ 1);
            int nb = cofactor(b, s);
            if (na == a && nb == b) break;
            simpR++;
            a = na;
            b = nb;
        }
        int inv = a & 1;
        return (hashed(K_MUX, s, a ^ inv, b ^ inv) * 2) ^ inv;
    }

    int sigToLit(int sig) const { return sig >= base ? (int)gs[sig - base] : leafLit(sig); }

    void buildGates() {
        const int G = c.G;
        for (int g = 0; g < G; g++) {
            const int t = c.type[g];
            uint64_t w = (uint64_t)(uint32_t)c.in0[g];
            if (t != 6) w |= (uint64_t)(uint32_t)c.in1[g] << 20;
            else w |= SIG_MASK << 20;
            if (t == 7) w |= ((uint64_t)(uint32_t)c.in2[g] << 40) | (1ULL << 60);
            else w |= (uint64_t)t << 40;
            gs[g] = w;
        }
        memset(head, 0xff, sizeof(int) * (size_t)(L + G + c.F + c.O + 2));
        int* stack = (int*)(ops + G + c.F + c.O + 8);  // the arena reserves room behind the operations
        int sp = 0;
        const int adaptAt = std::min(40000, G / 4 + 1);
        int done = 0;
        const int sigNone = (int)SIG_MASK;
        auto unvisited = [&](int x) { return x >= base && x != sigNone && (gs[x - base] >> 62) == 0; };
        auto visitRoot = [&](int sig) {
            if (!unvisited(sig)) return;
            stack[sp++] = sig - base;
            while (sp) {
                const int g = stack[sp - 1];
                const uint64_t w = gs[g];
                const int ra = (int)(w & SIG_MASK), rb = (int)((w >> 20) & SIG_MASK), rc = (int)((w >> 40) & SIG_MASK);
                const bool isMux = (w >> 60) & 1;
                if ((w >> 62) == 0) {
                    gs[g] = w | ST_VISITING;
                    if (isMux && unvisited(rc)) stack[sp++] = rc - base;
                    if (unvisited(rb)) stack[sp++] = rb - base;
                    if (unvisited(ra)) stack[sp++] = ra - base;
                } else {
                    sp--;
                    if ((w >> 62) == 1) {
                        int a = sigToLit(ra);
                        int res;
                        if (isMux) {
                            res = mkMux(a, sigToLit(rb), sigToLit(rc));
                        } else if (rc == 6) {
                            res = a ^ 1;
                        } else {
                            int b = sigToLit(rb);
                            switch (rc) {
                                case 0: res = mkAnd(a, b); break;
                                case 1: res = mkAnd(a ^ 1, b ^ 1) ^ 1; break;
                                case 2: res = mkXor(a, b); break;
                                case 3: res = mkAnd(a, b) ^ 1; break;
                                case 4: res = mkAnd(a ^ 1, b ^ 1); break;
                                default: res = mkXor(a, b) ^ 1; break;
                            }
                        }
                        gs[g] = ST_DONE | (uint32_t)res;
                        if (++done == adaptAt && adaptive) {
                            // Rewriting only pays where the logic has structure.
                            if ((simpH + simpR) * 200 < done) opt = 0;
                        }
                    }
                }
            }
        };
#ifdef DEV
        static int rootOrder = env_int("SIM_ROOT", 0);
#else
        const int rootOrder = 0;
#endif
        int muxCount = 0;
        if (rootOrder < 0) {
            for (int g = 0; g < G; g++) muxCount += c.type[g] == 7;
        }
        if (rootOrder > 0 || (rootOrder < 0 && muxCount * 2 > G)) {
            // Registers read and written together are scheduled together.
            std::vector<uint64_t> keys(c.F);
            for (int f = 0; f < c.F; f++) {
                int sig = c.d[f];
                uint64_t key = 0xFFFFFFFFULL;
                if (sig >= base) {
                    const uint64_t w = gs[sig - base];
                    if ((w >> 62) == 0) key = std::min(w & SIG_MASK, (w >> 20) & SIG_MASK);
                }
                keys[f] = (key << 32) | (uint32_t)f;
            }
            std::sort(keys.begin(), keys.end());
            for (uint64_t k : keys) visitRoot(c.d[(uint32_t)k]);
        }
        for (int s : c.d) visitRoot(s);
        for (int s : c.out) visitRoot(s);
    }
    bool adaptive = true;

    bool compile() {
#ifdef DEV
        double t0 = now_ms();
        opt = env_int("SIM_OPT", 3);
        adaptive = opt == 3;
#endif
        const int I = c.I, F = c.F, G = c.G, O = c.O;
        const size_t maxOps = (size_t)G + F + O + 8;
        // Arena: raw gates, operations, next-use table, node table, chain heads, stack.
        size_t need = sizeof(uint64_t) * (size_t)G + sizeof(Op) * maxOps + sizeof(int) * 3 * (size_t)G * 3 + sizeof(int) * 3 * maxOps +
                      sizeof(Info) * (L + maxOps) + sizeof(int) * (L + maxOps);
        char* mem = pool.arena;
        std::vector<char> heapMem;
        if (!mem || need + 4096 > COMPILE_ARENA) {
            heapMem.resize(need + 4096);
            mem = heapMem.data();
        }
        size_t at = 0;
        auto take = [&](size_t n) {
            char* p = mem + at;
            at += (n + 63) & ~(size_t)63;
            return p;
        };
        gs = (uint64_t*)take(sizeof(uint64_t) * (size_t)G);
        head = (int*)take(sizeof(int) * (L + maxOps));
        info = (Info*)take(sizeof(Info) * (L + maxOps));
        nxt = (int*)take(sizeof(int) * 3 * maxOps);
        // ops are followed by the depth-first stack
        ops = (Op*)take(sizeof(Op) * maxOps + sizeof(int) * 3 * (size_t)G * 3);
        buildGates();
#ifdef DEV
        double t1 = now_ms();
#endif
        // Flip-flop data and outputs must be gates, with storage of their own.
        std::vector<int> dRoot(F), oRoot(O);
        std::vector<int> leafCopy(L, -1);
        auto rootLit = [&](int sig) {
            int l = sigToLit(sig);
            int n = l >> 1;
            if (n >= L) return l;
            if (leafCopy[n] < 0) {
                // a copy gate keys on nothing: chains are no longer needed
                Op& o = ops[ng];
                o.a = n * 2;
                o.b = -1;
                o.c = -1;
                o.link = K_COPY;
                leafCopy[n] = L + ng++;
            }
            return leafCopy[n] * 2 + (l & 1);
        };
        for (int f = 0; f < F; f++) dRoot[f] = rootLit(c.d[f]);
        for (int j = 0; j < O; j++) oRoot[j] = rootLit(c.out[j]);

        const int N = L + ng;
        // Backward pass: next-use chains; unused gates are dropped.
        for (int i = 0; i < N; i++) {
            Info& iv = info[i];
            iv.next = NONE;
            iv.slot = NOSLOT;
            iv.aux = 0;
            iv.pinv = 0;
            iv.inMem = 0;
        }
        for (int f = 0; f < F; f++) info[dRoot[f] >> 1].next = ENDUSE;
        for (int j = 0; j < O; j++) info[oRoot[j] >> 1].next = ENDUSE;
        for (int p = ng - 1; p >= 0; p--) {
            const int g = L + p;
            if (info[g].next == NONE) continue;
            const Op& o = ops[p];
            int* nx = nxt + 3 * (size_t)p;
            const int vs[3] = {o.a, o.b, o.c};
            for (int k = 0; k < 3; k++) {
                if (vs[k] < 0) continue;
                Info& iv = info[vs[k] >> 1];
                nx[k] = iv.next;
                if (iv.next == NONE) iv.aux = p;  // last read
                iv.next = p;
            }
        }
        // A value that is read at the end of the cycle lives until then.
        for (int f = 0; f < F; f++) info[dRoot[f] >> 1].aux = ENDUSE - 1;
        for (int j = 0; j < O; j++) info[oRoot[j] >> 1].aux = ENDUSE - 1;
#ifdef DEV
        double t1c = now_ms();
#endif

        const int piLow = -192 - 32 * (piCount - 1);
        const int ffTop = piLow - 32;
        const int stateLow = ffTop - 32 * std::max(F - 1, 0);
        for (int i = 0; i < L; i++) info[i].inMem = 1;

        // Coalesce a flip-flop with the gate driving it if nobody reads the old value after the gate.
        std::vector<int> ffOfRoot(F, -1);
        for (int f = 0; f < F; f++) {
            int g = dRoot[f] >> 1;
            int p = g - L;
            int lastRead = info[1 + I + f].next == NONE ? -1 : info[1 + I + f].aux;
            if (info[g].aux >= 0 && lastRead < p) {
                info[g].aux = -1;
                ffOfRoot[f] = g;
            }
        }

        // Split the program into segments. Polarities and the homes of values read in a later segment are fixed
        // here, in program order, reusing the home that was freed last. Flip-flop slots are numbered by first
        // read, so that arrays read in sequence are laid out in sequence.
        int segOps = std::max(ng / SEGMENTS + 1, 4096);
#ifdef DEV
        segOps = std::max(ng / env_int("SIM_SEGS", SEGMENTS) + 1, 4096);
#endif
        const int segCount = ng ? (ng - 1) / segOps + 1 : 0;
        int crossHigh = 0;
        std::vector<int> crossFree;
        crossFree.reserve(1 << 16);
        std::vector<int> ffRank(F, -1), ffOrder;
        std::vector<uint8_t> ffSeen(F, 0);
        ffOrder.reserve(F);
        int nops = 0;
        {
            int segEnd = 0, rank = 0;
            const int ffLo = 1 + I, ffHi = L;
            for (int p = 0; p < ng; p++) {
                if (p == segEnd) segEnd += segOps;
                const int g = L + p;
                Info& ig = info[g];
                if (ig.next == NONE) continue;
                nops++;
                const Op& o = ops[p];
                const int kind = o.link & 3;
                const Info& ia = info[o.a >> 1];
                if (kind == K_AND) {
                    ig.pinv = (uint8_t)(((o.a & 1) ^ ia.pinv) & ((o.b & 1) ^ info[o.b >> 1].pinv));
                } else if (kind == K_XOR) {
                    ig.pinv = (uint8_t)((o.a & 1) ^ ia.pinv ^ (o.b & 1) ^ info[o.b >> 1].pinv);
                } else if (kind == K_COPY) {
                    ig.pinv = (uint8_t)((o.a & 1) ^ ia.pinv);
                } else {
                    // the data input selected by a clear select decides the polarity of the result
                    int es = (o.a & 1) ^ ia.pinv;
                    int l = es ? o.c : o.b;
                    ig.pinv = (uint8_t)((l & 1) ^ info[l >> 1].pinv);
                }
                const int* nx = nxt + 3 * (size_t)p;
                const int vs[3] = {o.a, o.b, o.c};
                // Muxes selecting between two flip-flops are the leaves of arrays read in sequence.
                if (kind == K_MUX) {
                    const int x = o.b >> 1, y = o.c >> 1;
                    if (x >= ffLo && x < ffHi && y >= ffLo && y < ffHi) {
                        if (ffRank[x - ffLo] < 0) ffRank[x - ffLo] = rank++;
                        if (ffRank[y - ffLo] < 0) ffRank[y - ffLo] = rank++;
                    }
                }
                for (int k = 0; k < 3; k++) {
                    if (vs[k] < 0) continue;
                    const int v = vs[k] >> 1;
                    if (v >= ffLo && v < ffHi) {
                        if (!ffSeen[v - ffLo]) {
                            ffSeen[v - ffLo] = 1;
                            ffOrder.push_back(v - ffLo);
                        }
                    } else if (nx[k] == NONE && v >= L && info[v].slot != NOSLOT) {
                        crossFree.push_back(info[v].slot);
                    }
                }
                if (ig.aux >= segEnd && ig.slot == NOSLOT) {
                    int off;
                    if (!crossFree.empty()) {
                        off = crossFree.back();
                        crossFree.pop_back();
                    } else {
                        off = stateLow - 32 * ++crossHigh;
                    }
                    ig.slot = off;
                }
            }
            for (int f : ffOrder)
                if (ffRank[f] < 0) ffRank[f] = rank++;
            for (int f = 0; f < F; f++)
                if (ffRank[f] < 0) ffRank[f] = rank++;
        }
        auto ffOff = [&](int f) { return ffTop - 32 * ffRank[f]; };
        info[0].slot = -160;
        for (int i = 0; i < I; i++) info[1 + i].slot = i < piCount ? piLow + 32 * i : -160;
        for (int f = 0; f < F; f++) {
            info[1 + I + f].slot = ffOff(f);
            if (ffOfRoot[f] >= 0) {
                info[ffOfRoot[f]].slot = ffOff(f);
                info[ffOfRoot[f]].aux = ffOff(f);
            }
        }
#ifdef DEV
        double t1d = now_ms();
#endif
        // Each segment gets its own stretch of the code area; they are linked by jumps.
        std::vector<uint8_t*> segCode(segCount + 2);
        std::vector<uint8_t*> segEndCode(segCount + 2);
        const auto putInt = [&](int x) {
            memcpy(cp, &x, 4);
            cp += 4;
        };
        // prologue: rcx = anchor; save registers; set up the base registers
        *cp++ = 0x53;                              // push rbx
        *cp++ = 0x55;                              // push rbp
        *cp++ = 0x56;                              // push rsi
        *cp++ = 0x57;                              // push rdi
        *cp++ = 0x41; *cp++ = 0x55;                // push r13
        *cp++ = 0x41; *cp++ = 0x56;                // push r14
        *cp++ = 0x41; *cp++ = 0x57;                // push r15
        *cp++ = 0x48; *cp++ = 0x81; *cp++ = 0xEC; putInt(168);
        for (int r = 6; r < 16; r++) {
            *cp++ = 0xC5; *cp++ = (uint8_t)(((r < 8) << 7) | 0x78);
            *cp++ = 0x11;
            *cp++ = (uint8_t)(0x84 | ((r & 7) << 3));
            *cp++ = 0x24;
            putInt((r - 6) * 16);
        }
        *cp++ = 0x48; *cp++ = 0x89; *cp++ = 0xCB;  // mov rbx, rcx
        for (int w = WINDOWS - 1; w >= 1; w--) {
            int rg = WINDOW_REG[w];
            // lea reg, [rbx + disp32]
            *cp++ = (uint8_t)(rg < 8 ? 0x48 : 0x4C);
            *cp++ = 0x8D;
            *cp++ = (uint8_t)(0x83 | ((rg & 7) << 3));
            putInt(w * 256);
        }
        uint8_t* const afterPrologue = cp;
        {
            uint8_t* q = cp + 16;
            for (int s = 0; s < segCount; s++) {
                segCode[s] = q;
                q += (size_t)std::min(segOps, ng - s * segOps) * 96 + 256;
            }
            segCode[segCount] = q;
        }
        long long loads = 0, stores = 0, alu = 0;
        int maxLocal = 0;
        auto setup = [&](Emitter& em) {
            em.ffFirst = 1 + I;
            em.ffHighOff = ffTop + 32;
            em.ffLowOff = stateLow;
#ifdef DEV
            static int look = env_int("SIM_SLIDELOOK", 16), need = env_int("SIM_SLIDENEED", 2);
            em.slideLook = look;
            em.slideNeed = need;
#endif
        };
        auto finishSegment = [&](Emitter& em, int s) {
            *em.cp++ = 0xE9;  // jmp to what follows
            int rel = (int)(segCode[s + 1] - (em.cp + 4));
            memcpy(em.cp, &rel, 4);
            em.cp += 4;
            segEndCode[s] = em.cp;
        };
        if (segCount > 1) {
#pragma omp parallel num_threads(WORKERS)
            {
                Emitter em(ops, nxt, info, L);
                setup(em);
                int high = 0;
#pragma omp for schedule(dynamic, 1)
                for (int s = 0; s < segCount; s++) {
                    em.cp = segCode[s];
                    int first = s * segOps;
                    em.segment(first, std::min(first + segOps, ng));
                    finishSegment(em, s);
                    high = std::max(high, em.localHigh);
                }
#pragma omp critical
                {
                    maxLocal = std::max(maxLocal, high);
                    loads += em.loads;
                    stores += em.stores;
                    alu += em.alu;
                }
            }
        } else if (segCount == 1) {
            Emitter em(ops, nxt, info, L);
            setup(em);
            em.cp = segCode[0];
            em.segment(0, ng);
            finishSegment(em, 0);
            maxLocal = em.localHigh;
            loads += em.loads;
            stores += em.stores;
            alu += em.alu;
        }
        // The jump into the first segment, then the end of the cycle.
        cp = afterPrologue;
        *cp++ = 0xE9;
        putInt((int)(segCode[0 < segCount ? 0 : segCount] - (cp + 4)));
        for (int s = 0; s < segCount; s++) P.codeLen += segEndCode[s] - segCode[s];
        // Flip-flops that were not coalesced. Everything is in memory by now.
        Emitter em(ops, nxt, info, L);
        em.cp = segCode[segCount];
        P.outOff.resize(O);
        P.outInv = 0;
        std::vector<int> invFix;
        for (int f = 0; f < F; f++) {
            int g = dRoot[f] >> 1;
            int inv = (dRoot[f] & 1) ^ info[g].pinv;
            bool coal = ffOfRoot[f] >= 0;
            if (coal) {
                if (inv) invFix.push_back(f);
                continue;
            }
            int src = R_S1;
            em.load(R_S1, info[g].slot);
            if (inv) {
                em.vexRR(0x76, R_S2, R_S2, R_S2);  // vpcmpeqd: all ones
                em.opRR(Emitter::OP_XOR, R_S2, R_S2, src, true);
                src = R_S2;
            }
            em.store(ffOff(f), src);
        }
        // A coalesced gate that reaches its flip-flop inverted is fixed in place, after the others read it.
        for (int f : invFix) {
            int g = dRoot[f] >> 1;
            em.load(R_S1, info[g].slot);
            em.vexRR(0x76, R_S2, R_S2, R_S2);
            em.opRR(Emitter::OP_XOR, R_S2, R_S2, R_S1, true);
            em.store(info[g].slot, R_S2);
            info[g].pinv ^= 1;
        }
        for (int j = 0; j < O; j++) {
            int g = oRoot[j] >> 1;
            P.outOff[j] = info[g].slot;
            if ((oRoot[j] & 1) ^ info[g].pinv) P.outInv |= 1ULL << j;
        }
        cp = em.cp;
        for (int r = 6; r < 16; r++) {
            *cp++ = 0xC5; *cp++ = (uint8_t)(((r < 8) << 7) | 0x78);
            *cp++ = 0x10;
            *cp++ = (uint8_t)(0x84 | ((r & 7) << 3));
            *cp++ = 0x24;
            putInt((r - 6) * 16);
        }
        *cp++ = 0xC5; *cp++ = 0xF8; *cp++ = 0x77;  // vzeroupper
        *cp++ = 0x48; *cp++ = 0x81; *cp++ = 0xC4; putInt(168);
        *cp++ = 0x41; *cp++ = 0x5F;                // pop r15
        *cp++ = 0x41; *cp++ = 0x5E;                // pop r14
        *cp++ = 0x41; *cp++ = 0x5D;                // pop r13
        *cp++ = 0x5F;                              // pop rdi
        *cp++ = 0x5E;                              // pop rsi
        *cp++ = 0x5D;                              // pop rbp
        *cp++ = 0x5B;                              // pop rbx
        *cp++ = 0xC3;
        P.L = L;
        P.localSlots = maxLocal;
        P.piOff = piLow;
        P.stateLow = stateLow;
        P.low = stateLow - 32 * (crossHigh + 1);
        P.nops = nops;
#ifdef DEV
        double t2 = now_ms();
        fprintf(stderr, "backward %.2f tables %.2f segments %.2f\n", t1c - t1, t1d - t1c, t2 - t1d);
        fprintf(stderr, "build %.1f emit %.1f ms; simp hash %lld rewrite %lld; gates %d ops %d code %.2f MB (%.1f B/op) cross %d local %d loads %lld stores %lld alu %lld\n", t1 - t0, t2 - t1,
                simpH, simpR, ng, nops, P.codeLen / 1e6, (double)P.codeLen / std::max(nops, 1), crossHigh, maxLocal, loads + em.loads, stores + em.stores, alu + em.alu);
#endif
        return true;
    }
};

// In-place bit-matrix transpose of 64 rows of 64-bit lanes: bit j of row i, lane q <-> bit i of row j, lane q.
inline void transpose64(__m256i* A) {
    uint64_t m = 0x00000000FFFFFFFFULL;
    for (int j = 32; j; j >>= 1, m ^= m << j) {
        const __m256i mask = _mm256_set1_epi64x((long long)m);
        const __m128i sh = _mm_cvtsi32_si128(j);
        for (int k = 0; k < 64; k = ((k | j) + 1) & ~j) {
            __m256i x = _mm256_load_si256(A + k), y = _mm256_load_si256(A + (k | j));
            __m256i t = _mm256_and_si256(_mm256_xor_si256(_mm256_srl_epi64(x, sh), y), mask);
            _mm256_store_si256(A + (k | j), _mm256_xor_si256(y, t));
            _mm256_store_si256(A + k, _mm256_xor_si256(x, _mm256_sll_epi64(t, sh)));
        }
    }
}

}  // namespace

std::vector<uint64_t> simulate(const Circuit& c) {
#ifdef DEV
    double t0 = now_ms();
#endif
    preparePool();
    if (!pool.code) return simulatePlain(c);
    Compiled P;
    {
        Compiler comp(c, P, pool.code);
        size_t bound = ((size_t)c.G + c.F + c.O) * 96 + (size_t)c.F * 64 + 65536 * 2;
        if (bound > CODE_CAPACITY || (long long)c.I + c.F + c.G + 2 >= MAX_SIGNALS) return simulatePlain(c);
        comp.compile();
    }
    int threads = WORKERS;
#ifdef DEV
    threads = env_int("SIM_THREADS", WORKERS);
#endif
    const int batches = (c.M + 255) / 256;
    const int O = c.O, T = c.T;
    // Digest tables: 16 nibble tables of 16 entries for each cycle.
    const int nib = 16;
    std::vector<uint64_t> tabs((size_t)T * nib * 16);
    std::vector<uint64_t> res(c.M, 0);
    threads = std::min(threads, batches);
    const int lowOff = P.low;                       // lowest frame offset in use
    const int piOff = P.piOff;
    const size_t tempBytes = (size_t)(P.localSlots + 8) * 32;
    // The anchor sits 128 bytes into a page, so that blocks of temporaries are whole pages.
    const size_t lowBytes = (((size_t)(-lowOff) + 128 + 4095) & ~(size_t)4095);
    const size_t frameBytes = lowBytes + tempBytes + 4096;
    auto fn = (void (*)(void*))pool.code;
#ifdef DEV
    double t1 = now_ms();
#endif
#pragma omp parallel num_threads(threads)
    {
#pragma omp for schedule(static)
        for (int t = 0; t < T; t++) {
            uint64_t* tb = &tabs[(size_t)t * nib * 16];
            for (int n = 0; n < nib; n++) {
                uint64_t m[4];
                for (int b = 0; b < 4; b++) {
                    int j = n * 4 + b;
                    m[b] = j < O ? mix64((uint64_t)t * (uint64_t)O + (uint64_t)j) : 0;
                }
                for (int v = 0; v < 16; v++) {
                    uint64_t x = 0;
                    for (int b = 0; b < 4; b++)
                        if (v >> b & 1) x ^= m[b];
                    tb[n * 16 + v] = x;
                }
            }
        }
        int w = omp_get_thread_num();
        prepareFrame(w, frameBytes);
        char* anchor = pool.frames[w] + lowBytes + 128;
        __m256i* rows = (__m256i*)(anchor + piOff);
        alignas(64) __m256i outv[64];
        alignas(64) uint64_t rs[256];
        const int stateLow = P.stateLow;
        const size_t stateBytes = (size_t)(-128 - stateLow);
        const uint64_t inv = P.outInv;
#pragma omp for schedule(dynamic, 1)
        for (int b = 0; b < batches; b++) {
            memset(anchor + stateLow, 0, stateBytes);
            for (int i = 0; i < 256; i++) rs[i] = mix64(c.seed ^ (uint64_t)(b * 256 + i));
            uint64_t hb[256];
            memset(hb, 0, sizeof hb);
            for (int t = 0; t < T; t++) {
                for (int q = 0; q < 4; q++) {
                    for (int j = 0; j < 64; j++) ((uint64_t*)&rows[j])[q] = splitmix64_next(&rs[64 * q + j]);
                }
                transpose64(rows);
                _mm256_zeroupper();
                fn(anchor);
                memset(outv, 0, sizeof outv);
                for (int j = 0; j < O && j < 64; j++) outv[j] = _mm256_load_si256((const __m256i*)(anchor + P.outOff[j]));
                transpose64(outv);
                const uint64_t* tb = &tabs[(size_t)t * nib * 16];
                for (int j = 0; j < 64; j++) {
                    for (int q = 0; q < 4; q++) {
                        uint64_t x = ((const uint64_t*)&outv[j])[q] ^ inv;
                        uint64_t h = 0;
                        for (int n = 0; n < nib; n++) h ^= tb[n * 16 + ((x >> (4 * n)) & 15)];
                        hb[64 * q + j] ^= h;
                    }
                }
            }
            for (int i = 0; i < 256 && b * 256 + i < c.M; i++) res[b * 256 + i] = hb[i];
        }
    }
#ifdef DEV
    fprintf(stderr, "prep %.1f run %.1f total %.1f ms\n", t1 - t0, now_ms() - t1, now_ms() - t0);
#endif
    return res;
}
