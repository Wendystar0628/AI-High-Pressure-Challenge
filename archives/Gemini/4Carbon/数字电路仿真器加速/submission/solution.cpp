#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <vector>
#include <algorithm>
#include <immintrin.h>
#include <omp.h>

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

static inline uint64_t mix64(uint64_t x) {
    return splitmix64_next(&x);
}

static inline void transpose64x64(uint64_t x[64]) {
    static const uint64_t masks[6] = {
        0x5555555555555555ULL,
        0x3333333333333333ULL,
        0x0F0F0F0F0F0F0F0FULL,
        0x00FF00FF00FF00FFULL,
        0x0000FFFF0000FFFFULL,
        0x00000000FFFFFFFFULL
    };
    for (int s = 0; s < 6; s++) {
        int k = 1 << s;
        uint64_t m = masks[s];
        for (int i = 0; i < 64; i += 2 * k) {
            for (int j = 0; j < k; j++) {
                uint64_t t = ((x[i + j] >> k) ^ x[i + j + k]) & m;
                x[i + j] ^= (t << k);
                x[i + j + k] ^= t;
            }
        }
    }
}

namespace {

enum OpKind : uint8_t {
    OP_AND  = 0, // a & b
    OP_OR   = 1, // a | b
    OP_ANDN = 2, // (~a) & b
    OP_XOR  = 3, // a ^ b
    OP_MUX0 = 4, // (~a & b) | (a & c)
    OP_MUX1 = 5, // (~a & b) | (a & ~c)
    OP_FA   = 6, // Full Adder(a, b, c): produces SUM at p, and COUT at p+1 (OP_COUT)
    OP_HA   = 7, // Half Adder(a, b):    produces SUM at p, and COUT at p+1 (OP_COUT)
    OP_COUT = 8  // Partner node immediately after OP_FA / OP_HA
};

struct SimpNode {
    uint8_t op;
    int a, b, c;
};

// Fast L2-resident 2-way associative CSE cache
struct CseCache {
    struct Entry { uint64_t key; int32_t val; int32_t pad; };
    static constexpr size_t SIZE = 1 << 17; // 128K entries = 2 MB
    std::vector<Entry> tab;
    CseCache() : tab(SIZE, {0ULL, -1, 0}) {}

    static inline uint64_t pack(uint8_t op, int a, int b, int c) {
        return ((uint64_t)(op + 1) << 60) |
               ((uint64_t)(uint32_t)a << 40) |
               ((uint64_t)(uint32_t)b << 20) |
               (uint64_t)(uint32_t)c;
    }
    static inline size_t idx_of(uint64_t k) {
        k ^= k >> 30;
        k *= 0xBF58476D1CE4E5B9ULL;
        k ^= k >> 27;
        return (size_t)k & (SIZE - 1);
    }
    int find(uint64_t k) const {
        size_t i = idx_of(k);
        if (tab[i].key == k) return tab[i].val;
        if (tab[i ^ 1].key == k) return tab[i ^ 1].val;
        return -1;
    }
    void insert(uint64_t k, int v) {
        size_t i = idx_of(k);
        if (tab[i].key == 0 || tab[i].key == k) { tab[i].key = k; tab[i].val = v; }
        else { tab[i ^ 1].key = k; tab[i ^ 1].val = v; }
    }
};

// Fast 6-input truth-table cut sweeper using BMI2 _pdep_u64 / _pext_u64
struct Cut6 {
    uint8_t n;
    int vars[6];
    uint64_t tt;
};

static const uint64_t CUT_VAR_TT[6] = {
    0xAAAAAAAAAAAAAAAAULL,
    0xCCCCCCCCCCCCCCCCULL,
    0xF0F0F0F0F0F0F0F0ULL,
    0xFF00FF00FF00FF00ULL,
    0xFFFF0000FFFF0000ULL,
    0xFFFFFFFF00000000ULL
};

static const uint64_t CUT_MASK0[6] = {
    0x5555555555555555ULL,
    0x3333333333333333ULL,
    0x0F0F0F0F0F0F0F0FULL,
    0x00FF00FF00FF00FFULL,
    0x0000FFFF0000FFFFULL,
    0x00000000FFFFFFFFULL
};

static inline uint64_t stretch_cut6(const Cut6& c_in, int un, const int u_vars[6]) {
    if (c_in.n == 0 || c_in.n == un) return c_in.tt;
    uint64_t res = c_in.tt & ((1ULL << (1 << c_in.n)) - 1ULL);
    int ci = 0;
    for (int b = 0; b < un; b++) {
        if (ci < c_in.n && u_vars[b] == c_in.vars[ci]) {
            ci++;
        } else {
            uint64_t x = _pdep_u64(res, CUT_MASK0[b]);
            res = x | (x << (1 << b));
        }
    }
    for (int b = un; b < 6; b++) res |= (res << (1 << b));
    return res;
}

static inline void minimize_cut6(Cut6& ct) {
    for (int i = (int)ct.n - 1; i >= 0; i--) {
        int sh = 1 << i;
        if (((ct.tt ^ (ct.tt >> sh)) & CUT_MASK0[i]) == 0) {
            uint64_t x = _pext_u64(ct.tt, CUT_MASK0[i]);
            ct.tt = x | (x << 32);
            for (int j = i; j + 1 < ct.n; j++) ct.vars[j] = ct.vars[j + 1];
            ct.n--;
        }
    }
}

struct CutCache {
    struct Entry {
        uint64_t tt;
        int vars[6];
        int32_t lit;
        uint8_t n;
        uint8_t used;
    };
    static constexpr size_t SIZE = 1 << 17;
    std::vector<Entry> tab;
    CutCache() : tab(SIZE) {
        for (auto& e : tab) e.used = 0;
    }
    static inline size_t hash_cut(uint8_t n, const int vars[6], uint64_t tt) {
        uint64_t h = tt ^ ((uint64_t)n * 0x9E3779B97F4A7C15ULL);
        for (int i = 0; i < n; i++) h = (h ^ (uint32_t)vars[i]) * 0xBF58476D1CE4E5B9ULL;
        return (size_t)(h ^ (h >> 31)) & (SIZE - 1);
    }
    static inline bool eq(const Entry& e, uint8_t n, const int vars[6], uint64_t tt) {
        if (!e.used || e.n != n || e.tt != tt) return false;
        for (int i = 0; i < n; i++) if (e.vars[i] != vars[i]) return false;
        return true;
    }
    int find(uint8_t n, const int vars[6], uint64_t tt) const {
        size_t i = hash_cut(n, vars, tt);
        if (eq(tab[i], n, vars, tt)) return tab[i].lit;
        if (eq(tab[i ^ 1], n, vars, tt)) return tab[i ^ 1].lit;
        return -1;
    }
    void insert(uint8_t n, const int vars[6], uint64_t tt, int32_t lit) {
        size_t i = hash_cut(n, vars, tt);
        size_t dst = (!tab[i].used || eq(tab[i], n, vars, tt)) ? i : (i ^ 1);
        tab[dst].tt = tt;
        for (int j = 0; j < n; j++) tab[dst].vars[j] = vars[j];
        tab[dst].lit = lit;
        tab[dst].n = n;
        tab[dst].used = 1;
    }
};

// Multi-base x86-64 AVX2 VEX Emitter:
//   slot 0..3:   [rcx + disp8]  (gpr 1)
//   slot 4..11:  [rax + disp8]  (gpr 0, rax = rcx + 8*32)
//   slot 12..19: [rdx + disp8]  (gpr 2, rdx = rcx + 16*32)
//   slot 20..27: [rbx + disp8]  (gpr 3, rbx = rcx + 24*32)
//   slot 28..35: [rsi + disp8]  (gpr 6, rsi = rcx + 32*32)
//   slot 36..43: [rdi + disp8]  (gpr 7, rdi = rcx + 40*32)
//   slot >= 44:  [rcx + disp32] (gpr 1)
static constexpr int HOT_DISP8_SLOTS = 42; // slots 2..43 are 42 disp8 hot spill slots!
static constexpr int PI_SLOT_BASE = 44;

struct JitEmitter {
    std::vector<uint8_t> code;

    void reserve(size_t bytes) { code.reserve(bytes); }
    void emit8(uint8_t b) { code.push_back(b); }
    void emit32(int32_t v) {
        uint8_t tmp[4];
        std::memcpy(tmp, &v, 4);
        code.insert(code.end(), tmp, tmp + 4);
    }

    void emit_vex_rr(uint8_t opcode, int dst, int src1, int src2, int L = 1) {
        int R = (dst >> 3) & 1;
        int B = (src2 >> 3) & 1;
        uint8_t vvvv = (uint8_t)((~src1) & 0xF);
        if (B == 0) {
            emit8(0xC5);
            emit8((uint8_t)(((R ^ 1) << 7) | (vvvv << 3) | (L << 2) | 1));
        } else {
            emit8(0xC4);
            emit8((uint8_t)(((R ^ 1) << 7) | (1 << 6) | ((B ^ 1) << 5) | 1));
            emit8((uint8_t)((vvvv << 3) | (L << 2) | 1));
        }
        emit8(opcode);
        emit8((uint8_t)(0xC0 | ((dst & 7) << 3) | (src2 & 7)));
    }

    // Map logical slot to (gpr_base in {0,1,2,3,6,7}, byte_disp)
    void emit_vex_slot(uint8_t opcode, int reg_field, int vvvv_reg, int slot) {
        int gpr = 1; // rcx
        int32_t disp = slot * 32;
        if (slot >= 4 && slot < 44) {
            static const int gprs[5] = {0, 2, 3, 6, 7}; // rax, rdx, rbx, rsi, rdi
            int grp = (slot - 4) >> 3;
            int center = 8 + grp * 8;
            gpr = gprs[grp];
            disp = (slot - center) * 32;
        }
        int R = (reg_field >> 3) & 1;
        uint8_t vvvv = (uint8_t)((~vvvv_reg) & 0xF);
        emit8(0xC5);
        emit8((uint8_t)(((R ^ 1) << 7) | (vvvv << 3) | (1 << 2) | 1));
        emit8(opcode);
        if (disp == 0) {
            emit8((uint8_t)(0x00 | ((reg_field & 7) << 3) | gpr));
        } else if (disp >= -128 && disp <= 127) {
            emit8((uint8_t)(0x40 | ((reg_field & 7) << 3) | gpr));
            emit8((uint8_t)(int8_t)disp);
        } else {
            emit8((uint8_t)(0x80 | ((reg_field & 7) << 3) | gpr));
            emit32(disp);
        }
    }

    void emit_vex_xmm_rsp(uint8_t opcode, int xmm_reg, int32_t disp) {
        int R = (xmm_reg >> 3) & 1;
        emit8(0xC5);
        emit8((uint8_t)(((R ^ 1) << 7) | (0xF << 3) | (0 << 2) | 1));
        emit8(opcode);
        if (disp == 0) {
            emit8((uint8_t)(0x00 | ((xmm_reg & 7) << 3) | 4));
            emit8(0x24);
        } else if (disp >= -128 && disp <= 127) {
            emit8((uint8_t)(0x40 | ((xmm_reg & 7) << 3) | 4));
            emit8(0x24);
            emit8((uint8_t)(int8_t)disp);
        } else {
            emit8((uint8_t)(0x80 | ((xmm_reg & 7) << 3) | 4));
            emit8(0x24);
            emit32(disp);
        }
    }

    void emit_lea_rcx(int dst_gpr, int32_t disp) {
        emit8(0x48);
        emit8(0x8D);
        emit8((uint8_t)(0x80 | (dst_gpr << 3) | 1));
        emit32(disp);
    }

    void emit_prologue() {
        // Save non-volatile GPRs rbx(3), rsi(6), rdi(7): 3 pushes = 24B (+8B ret = 32B, 16B aligned!)
        emit8(0x53); // push rbx
        emit8(0x56); // push rsi
        emit8(0x57); // push rdi
        // sub rsp, 160 (still 16B aligned)
        emit8(0x48); emit8(0x81); emit8(0xEC); emit32(160);
        for (int i = 0; i < 10; i++) {
            emit_vex_xmm_rsp(0x7F, 6 + i, i * 16);
        }
        // Set up hot-spill base pointers from rcx:
        emit_lea_rcx(0, 8 * 32);  // rax
        emit_lea_rcx(2, 16 * 32); // rdx
        emit_lea_rcx(3, 24 * 32); // rbx
        emit_lea_rcx(6, 32 * 32); // rsi
        emit_lea_rcx(7, 40 * 32); // rdi
    }

    void emit_epilogue() {
        emit8(0xC5); emit8(0xF8); emit8(0x77); // vzeroupper
        for (int i = 0; i < 10; i++) {
            emit_vex_xmm_rsp(0x6F, 6 + i, i * 16);
        }
        emit8(0x48); emit8(0x81); emit8(0xC4); emit32(160); // add rsp, 160
        emit8(0x5F); // pop rdi
        emit8(0x5E); // pop rsi
        emit8(0x5B); // pop rbx
        emit8(0xC3); // ret
    }

    void vmov_load(int dst, int slot)    { emit_vex_slot(0x6F, dst, 0, slot); }
    void vmov_store(int slot, int src)   { emit_vex_slot(0x7F, src, 0, slot); }
    void vpand_rr(int d, int s1, int s2)  { emit_vex_rr(0xDB, d, s1, s2); }
    void vpand_rm(int d, int s1, int sl)  { emit_vex_slot(0xDB, d, s1, sl); }
    void vpandn_rr(int d, int s1, int s2) { emit_vex_rr(0xDF, d, s1, s2); }
    void vpandn_rm(int d, int s1, int sl) { emit_vex_slot(0xDF, d, s1, sl); }
    void vpor_rr(int d, int s1, int s2)   { emit_vex_rr(0xEB, d, s1, s2); }
    void vpor_rm(int d, int s1, int sl)   { emit_vex_slot(0xEB, d, s1, sl); }
    void vpxor_rr(int d, int s1, int s2)  { emit_vex_rr(0xEF, d, s1, s2); }
    void vpxor_rm(int d, int s1, int sl)  { emit_vex_slot(0xEF, d, s1, sl); }
};

struct ExecutableArena {
    uint8_t* ptr = nullptr;
    size_t total_size = 0;

    uint8_t* alloc_total(size_t sz) {
        total_size = sz;
        if (sz == 0) return nullptr;
        ptr = static_cast<uint8_t*>(VirtualAlloc(nullptr, sz, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE));
        return ptr;
    }
    void finalize() {
        if (ptr && total_size > 0) FlushInstructionCache(GetCurrentProcess(), ptr, total_size);
    }
    ~ExecutableArena() {
        if (ptr) VirtualFree(ptr, 0, MEM_RELEASE);
    }
};

struct alignas(32) Vec256 {
    __m256i v;
};

// Structural Register-File Descriptor
struct RfReadGroup {
    int h;
    int r_base;
    int sel_slots[10];      // slots in buf for the h address bits
    std::vector<std::pair<int, int>> bit_targets; // (bit_in_word, pseudo_slot_in_buf)
    bool full_word = false;
    int full_slot_base = -1; // if full_word, pseudo_slots are contiguous [full_slot_base .. +W-1]
};

struct RegFilePlan {
    bool active = false;
    int R = 0, W = 0, P = 0, K = 0;
    std::vector<int> we_slots;              // size P: slot in buf where write-enable is stored
    std::vector<std::vector<int>> waddr_slots; // P x K: slots in buf where write-address bits are stored
    std::vector<int> wdata_slot_base;       // size P: contiguous W slots in buf where write-data is stored
    std::vector<int> direct_ff_indices;     // subset of 0..4095 still read directly from buf[ff_base + f]
    std::vector<RfReadGroup> read_groups;
};

} // namespace

std::vector<uint64_t> simulate(const Circuit& c) {
    const int I = c.I, F = c.F, G = c.G, O = c.O, M = c.M, T = c.T;
    if (M <= 0) return {};
    std::vector<uint64_t> ans(M, 0);
    if (T <= 0 || O <= 0) return ans;

    const int origGateBase = 2 + I + F;
    const int origN = origGateBase + G;
    const uint8_t* __restrict ctype = c.type.data();
    const int* __restrict cin0 = c.in0.data();
    const int* __restrict cin1 = c.in1.data();
    const int* __restrict cin2 = c.in2.data();

    // 1. Fast Iterative Postorder Topological Sort (zero reverse-edge graph needed!)
    std::vector<uint8_t> vis(G, 0);
    std::vector<int> topo;
    topo.reserve(G);
    {
        std::vector<int> stk;
        stk.reserve(8192);
        for (int start = 0; start < G; start++) {
            if (vis[start] == 2) continue;
            stk.push_back(start << 1);
            while (!stk.empty()) {
                int top = stk.back();
                int k = top >> 1;
                if ((top & 1) == 0) {
                    if (vis[k] == 2) { stk.pop_back(); continue; }
                    vis[k] = 1;
                    stk.back() = (k << 1) | 1;
                    uint8_t t = ctype[k];
                    int u0 = cin0[k] - origGateBase;
                    if (u0 >= 0 && vis[u0] == 0) stk.push_back(u0 << 1);
                    if (t != 6) {
                        int u1 = cin1[k] - origGateBase;
                        if (u1 >= 0 && vis[u1] == 0) stk.push_back(u1 << 1);
                        if (t == 7) {
                            int u2 = cin2[k] - origGateBase;
                            if (u2 >= 0 && vis[u2] == 0) stk.push_back(u2 << 1);
                        }
                    }
                } else {
                    vis[k] = 2;
                    topo.push_back(k);
                    stk.pop_back();
                }
            }
        }
    }

    // 2. Check for Verified Structural Register-File Pattern (FF[0..4095])
    RegFilePlan rf;
    std::vector<int> rf_pseudo_node_of_sig; // maps replaced MUX subtree orig_sig -> pseudo node_id
    std::vector<uint8_t> rf_orig_live;      // marks live original signals when rf.active
    int numRfPseudoInputs = 0;
    std::vector<int> rf_extra_sink_sigs;    // we, waddr, wdata orig signals that must be computed into buf!

    if (F >= 4096 && G >= 10000) {
        int cur0 = c.d[0], p_cnt = 0;
        while (cur0 >= origGateBase && ctype[cur0 - origGateBase] == 7 && p_cnt <= 64) {
            cur0 = cin1[cur0 - origGateBase];
            p_cnt++;
        }
        if (cur0 == 2 + I && p_cnt >= 4) {
            int P = p_cnt;
            std::vector<int> s0(P);
            cur0 = c.d[0];
            for (int p = P - 1; p >= 0; p--) {
                s0[p] = cin0[cur0 - origGateBase];
                cur0 = cin1[cur0 - origGateBase];
            }
            int W = 1;
            while (W < 4096) {
                int cw = c.d[W];
                bool ok = true;
                for (int p = P - 1; p >= 0; p--) {
                    if (cw < origGateBase || ctype[cw - origGateBase] != 7 || cin0[cw - origGateBase] != s0[p]) {
                        ok = false; break;
                    }
                    cw = cin1[cw - origGateBase];
                }
                if (!ok || cw != 2 + I + W) break;
                W++;
            }
            if ((W == 16 || W == 32 || W == 64) && (4096 % W) == 0) {
                int R = 4096 / W;
                int K = 0;
                while ((1 << K) < R) K++;
                if ((1 << K) == R && K >= 4 && K <= 8) {
                    // Verify ALL 4096 FF write chains & shared W-bit port write-data!
                    bool chains_ok = true;
                    std::vector<int> reg_sels(R * P, -1);
                    std::vector<int> wdata_port(P * W, -1);
                    for (int r = 0; r < R && chains_ok; r++) {
                        for (int b = 0; b < W && chains_ok; b++) {
                            int f = r * W + b;
                            int cur = c.d[f];
                            for (int p = P - 1; p >= 0; p--) {
                                if (cur < origGateBase || ctype[cur - origGateBase] != 7) { chains_ok = false; break; }
                                int gk = cur - origGateBase;
                                int sel = cin0[gk];
                                if (b == 0) reg_sels[r * P + p] = sel;
                                else if (sel != reg_sels[r * P + p]) { chains_ok = false; break; }
                                if (r == 0) wdata_port[p * W + b] = cin2[gk];
                                else if (cin2[gk] != wdata_port[p * W + b]) { chains_ok = false; break; }
                                cur = cin1[gk];
                            }
                            if (cur != 2 + I + f) chains_ok = false;
                        }
                    }

                    // Verify ALL P write decoders!
                    std::vector<int> port_we_orig(P, -1);
                    std::vector<std::vector<int>> port_addr_orig(P, std::vector<int>(K, -1));
                    if (chains_ok) {
                        for (int p = 0; p < P && chains_ok; p++) {
                            int sr0 = reg_sels[0 * P + p];
                            int sr1 = reg_sels[1 * P + p];
                            if (sr0 < origGateBase || sr1 < origGateBase ||
                                ctype[sr0 - origGateBase] != 0 || ctype[sr1 - origGateBase] != 0) {
                                chains_ok = false; break;
                            }
                            int k0 = sr0 - origGateBase, k1 = sr1 - origGateBase;
                            int we = -1, dec0 = -1;
                            if (cin1[k0] == cin1[k1] || cin1[k0] == cin0[k1]) { we = cin1[k0]; dec0 = cin0[k0]; }
                            else if (cin0[k0] == cin1[k1] || cin0[k0] == cin0[k1]) { we = cin0[k0]; dec0 = cin1[k0]; }
                            if (we < 0) { chains_ok = false; break; }
                            port_we_orig[p] = we;

                            // Extract K NOT(addr_bit) from dec0 (register r=0 has all bits 0)
                            std::vector<int> abits;
                            int cur = dec0;
                            while (cur >= origGateBase && ctype[cur - origGateBase] == 0 && (int)abits.size() < K - 1) {
                                int gk = cur - origGateBase;
                                int x = cin0[gk], y = cin1[gk];
                                if (y >= origGateBase && ctype[y - origGateBase] == 6) {
                                    abits.push_back(cin0[y - origGateBase]); cur = x;
                                } else if (x >= origGateBase && ctype[x - origGateBase] == 6) {
                                    abits.push_back(cin0[x - origGateBase]); cur = y;
                                } else break;
                            }
                            if (cur >= origGateBase && ctype[cur - origGateBase] == 6) {
                                abits.push_back(cin0[cur - origGateBase]);
                            }
                            std::reverse(abits.begin(), abits.end());
                            if ((int)abits.size() != K) { chains_ok = false; break; }
                            port_addr_orig[p] = abits;

                            // Verify every r = 0 .. R-1!
                            for (int r = 0; r < R && chains_ok; r++) {
                                int sr = reg_sels[r * P + p];
                                if (sr < origGateBase || ctype[sr - origGateBase] != 0) { chains_ok = false; break; }
                                int gkr = sr - origGateBase;
                                int dec_r = (cin1[gkr] == we) ? cin0[gkr] : ((cin0[gkr] == we) ? cin1[gkr] : -1);
                                if (dec_r < 0) { chains_ok = false; break; }
                                int cr = dec_r;
                                for (int bit = K - 1; bit >= 1; bit--) {
                                    if (cr < origGateBase || ctype[cr - origGateBase] != 0) { chains_ok = false; break; }
                                    int g2 = cr - origGateBase;
                                    int x = cin0[g2], y = cin1[g2];
                                    auto match_term = [&](int sig, int b_idx) -> bool {
                                        if ((r >> b_idx) & 1) return sig == abits[b_idx];
                                        return sig >= origGateBase && ctype[sig - origGateBase] == 6 &&
                                               cin0[sig - origGateBase] == abits[b_idx];
                                    };
                                    if (match_term(y, bit)) cr = x;
                                    else if (match_term(x, bit)) cr = y;
                                    else { chains_ok = false; break; }
                                }
                                if (!chains_ok) break;
                                if (r & 1) {
                                    if (cr != abits[0]) chains_ok = false;
                                } else {
                                    if (!(cr >= origGateBase && ctype[cr - origGateBase] == 6 &&
                                          cin0[cr - origGateBase] == abits[0])) chains_ok = false;
                                }
                            }
                        }
                    }

                    if (chains_ok) {
                        rf.active = true;
                        rf.R = R; rf.W = W; rf.P = P; rf.K = K;

                        // Bottom-up O(G) identification of balanced RegFile read subtrees (h >= 3)
                        struct SubNode { int8_t h; int8_t pad; int16_t bit; int16_t r_base; int parent_s; int left; };
                        std::vector<SubNode> sub(origN, {-1, 0, 0, 0, -1, -1});
                        for (int r = 0; r < R; r++) {
                            for (int b = 0; b < W; b++) {
                                int sig = 2 + I + r * W + b;
                                sub[sig] = {0, 0, (int16_t)b, (int16_t)r, -1, -1};
                            }
                        }
                        auto get_sels = [&](int sig, int h, int out_sels[10]) {
                            int cur = sig;
                            for (int lv = h - 1; lv >= 0; lv--) {
                                out_sels[lv] = sub[cur].parent_s;
                                cur = sub[cur].left;
                            }
                        };
                        for (int k : topo) {
                            if (ctype[k] != 7) continue;
                            int s = cin0[k], a = cin1[k], b = cin2[k];
                            if (s < origGateBase && sub[a].h >= 0 && sub[a].h == sub[b].h && sub[a].bit == sub[b].bit) {
                                int h = sub[a].h + 1;
                                if (sub[b].r_base == sub[a].r_base + (1 << (h - 1)) && (sub[a].r_base & ((1 << h) - 1)) == 0) {
                                    int sa[10], sb[10];
                                    get_sels(a, h - 1, sa);
                                    get_sels(b, h - 1, sb);
                                    bool eq_s = true;
                                    for (int lv = 0; lv < h - 1; lv++) if (sa[lv] != sb[lv]) { eq_s = false; break; }
                                    if (eq_s) {
                                        sub[origGateBase + k] = {(int8_t)h, 0, sub[a].bit, sub[a].r_base, s, a};
                                    }
                                }
                            }
                        }

                        // Backward liveness from true external requirements (cutting h >= 3 RegFile subtrees!)
                        rf_orig_live.assign(origN, 0);
                        for (int p = 0; p < P; p++) {
                            rf_orig_live[port_we_orig[p]] = 1;
                            for (int b = 0; b < K; b++) rf_orig_live[port_addr_orig[p][b]] = 1;
                        }
                        for (int x : wdata_port) rf_orig_live[x] = 1;
                        for (int f = 4096; f < F; f++) rf_orig_live[c.d[f]] = 1;
                        for (int o : c.out) rf_orig_live[o] = 1;

                        rf_pseudo_node_of_sig.assign(origN, -1);
                        std::vector<int> replaced_sigs;
                        for (int i = (int)topo.size() - 1; i >= 0; i--) {
                            int k = topo[i];
                            int sig = origGateBase + k;
                            if (!rf_orig_live[sig]) continue;
                            if (sub[sig].h >= 3) {
                                replaced_sigs.push_back(sig);
                                int sels[10];
                                get_sels(sig, sub[sig].h, sels);
                                for (int lv = 0; lv < sub[sig].h; lv++) rf_orig_live[sels[lv]] = 1;
                                continue;
                            }
                            uint8_t t = ctype[k];
                            rf_orig_live[cin0[k]] = 1;
                            if (t != 6) rf_orig_live[cin1[k]] = 1;
                            if (t == 7) rf_orig_live[cin2[k]] = 1;
                        }

                        for (int f = 0; f < 4096; f++) {
                            if (rf_orig_live[2 + I + f]) rf.direct_ff_indices.push_back(f);
                        }

                        // Group replaced_sigs by (h, r_base, sels[0..h-1])!
                        struct GrpKey {
                            int h, r_base;
                            int sels[10];
                            bool operator<(const GrpKey& o) const {
                                if (h != o.h) return h < o.h;
                                if (r_base != o.r_base) return r_base < o.r_base;
                                for (int i = 0; i < h; i++) if (sels[i] != o.sels[i]) return sels[i] < o.sels[i];
                                return false;
                            }
                            bool operator==(const GrpKey& o) const {
                                if (h != o.h || r_base != o.r_base) return false;
                                for (int i = 0; i < h; i++) if (sels[i] != o.sels[i]) return false;
                                return true;
                            }
                        };
                        struct Item { GrpKey key; int bit; int sig; };
                        std::vector<Item> items;
                        items.reserve(replaced_sigs.size());
                        for (int sig : replaced_sigs) {
                            Item it{};
                            it.key.h = sub[sig].h;
                            it.key.r_base = sub[sig].r_base;
                            get_sels(sig, sub[sig].h, it.key.sels);
                            it.bit = sub[sig].bit;
                            it.sig = sig;
                            items.push_back(it);
                        }
                        std::sort(items.begin(), items.end(), [](const Item& x, const Item& y) {
                            if (!(x.key == y.key)) return x.key < y.key;
                            return x.bit < y.bit;
                        });

                        const int pseudoNodeBase = 1 + I + F;
                        const int pseudoSlotBase = PI_SLOT_BASE + I + F;
                        size_t idx = 0;
                        while (idx < items.size()) {
                            size_t nxt = idx + 1;
                            while (nxt < items.size() && items[nxt].key == items[idx].key) nxt++;
                            RfReadGroup grp;
                            grp.h = items[idx].key.h;
                            grp.r_base = items[idx].key.r_base;
                            for (int lv = 0; lv < grp.h; lv++) {
                                int s_sig = items[idx].key.sels[lv];
                                // Map s_sig (< origGateBase) to its buf slot!
                                if (s_sig < 2) grp.sel_slots[lv] = s_sig; // 0 or 1
                                else grp.sel_slots[lv] = PI_SLOT_BASE + (s_sig - 2);
                            }
                            // Check if all W bits 0..W-1 are present at least once
                            int present_cnt = 0;
                            int last_b = -1;
                            for (size_t q = idx; q < nxt; q++) {
                                if (items[q].bit != last_b) { present_cnt++; last_b = items[q].bit; }
                            }
                            if (present_cnt == W) {
                                grp.full_word = true;
                                grp.full_slot_base = pseudoSlotBase + numRfPseudoInputs;
                                int base_pnode = pseudoNodeBase + numRfPseudoInputs;
                                numRfPseudoInputs += W;
                                for (size_t q = idx; q < nxt; q++) {
                                    rf_pseudo_node_of_sig[items[q].sig] = base_pnode + items[q].bit;
                                }
                            } else {
                                grp.full_word = false;
                                int prev_b = -1, prev_pnode = -1;
                                for (size_t q = idx; q < nxt; q++) {
                                    if (items[q].bit != prev_b) {
                                        prev_b = items[q].bit;
                                        prev_pnode = pseudoNodeBase + numRfPseudoInputs;
                                        int pslot = pseudoSlotBase + numRfPseudoInputs;
                                        numRfPseudoInputs++;
                                        grp.bit_targets.push_back({prev_b, pslot});
                                    }
                                    rf_pseudo_node_of_sig[items[q].sig] = prev_pnode;
                                }
                            }
                            rf.read_groups.push_back(std::move(grp));
                            idx = nxt;
                        }

                        // Record extra sink signals (we, waddr, wdata) to evaluate into buf!
                        // Order in rf_extra_sink_sigs:
                        //   [0 .. P-1]: port_we_orig
                        //   [P .. P + P*K - 1]: port_addr_orig
                        //   [P + P*K .. P + P*K + P*W - 1]: wdata_port
                        rf_extra_sink_sigs.reserve(P + P * K + P * W);
                        for (int p = 0; p < P; p++) rf_extra_sink_sigs.push_back(port_we_orig[p]);
                        for (int p = 0; p < P; p++) for (int b = 0; b < K; b++) rf_extra_sink_sigs.push_back(port_addr_orig[p][b]);
                        for (int x : wdata_port) rf_extra_sink_sigs.push_back(x);
                    }
                }
            }
        }
    }

    // Optional Pre-Pass: Fast 6-Input Truth-Table Cut Sweeping for narrow-window deep chains
    int same_in_cnt = 0;
    for (int k = 0; k < G; k++) if (ctype[k] != 6 && cin0[k] == cin1[k]) same_in_cnt++;

    std::vector<int> cut_repr;
    const bool run_cut_sweep = (!rf.active && (G <= 4096 || same_in_cnt >= 1000));
    if (run_cut_sweep) {
        std::vector<Cut6> cuts(origN);
        cut_repr.resize(origN);
        cuts[0] = {0, {0,0,0,0,0,0}, 0ULL};  cut_repr[0] = 0;
        cuts[1] = {0, {0,0,0,0,0,0}, ~0ULL}; cut_repr[1] = 1;
        for (int s = 2; s < origGateBase; s++) {
            cuts[s] = {1, {s,0,0,0,0,0}, CUT_VAR_TT[0]};
            cut_repr[s] = s << 1;
        }
        CutCache cut_cache;
        for (int k : topo) {
            int sig = origGateBase + k;
            uint8_t t = ctype[k];
            int n_in = (t == 6) ? 1 : ((t == 7) ? 3 : 2);
            int raw_in[3] = {cin0[k], cin1[k], cin2[k]};
            Cut6 ic[3];
            int rlit[3];
            for (int j = 0; j < n_in; j++) {
                int rl = cut_repr[raw_in[j]];
                rlit[j] = rl;
                int rsig = rl >> 1, rinv = rl & 1;
                if (rsig == 0) ic[j] = {0, {0,0,0,0,0,0}, rinv ? ~0ULL : 0ULL};
                else {
                    ic[j] = cuts[rsig];
                    if (rinv) ic[j].tt = ~ic[j].tt;
                }
            }
            // Merge sorted variable arrays (sizes <= 6 each)
            int u_vars[18], un = 0;
            for (int j = 0; j < n_in; j++) {
                for (int v = 0; v < ic[j].n; v++) u_vars[un++] = ic[j].vars[v];
            }
            std::sort(u_vars, u_vars + un);
            un = (int)(std::unique(u_vars, u_vars + un) - u_vars);

            Cut6 cur{};
            if (un <= 6) {
                cur.n = (uint8_t)un;
                for (int i = 0; i < un; i++) cur.vars[i] = u_vars[i];
                uint64_t tt0 = stretch_cut6(ic[0], un, cur.vars);
                uint64_t tt1 = (n_in >= 2) ? stretch_cut6(ic[1], un, cur.vars) : 0;
                uint64_t tt2 = (n_in >= 3) ? stretch_cut6(ic[2], un, cur.vars) : 0;
                switch (t) {
                    case 0: cur.tt = tt0 & tt1; break;
                    case 1: cur.tt = tt0 | tt1; break;
                    case 2: cur.tt = tt0 ^ tt1; break;
                    case 3: cur.tt = ~(tt0 & tt1); break;
                    case 4: cur.tt = ~(tt0 | tt1); break;
                    case 5: cur.tt = ~(tt0 ^ tt1); break;
                    case 6: cur.tt = ~tt0; break;
                    default: cur.tt = (~tt0 & tt1) | (tt0 & tt2); break;
                }
                minimize_cut6(cur);
            } else {
                un = 0;
                for (int j = 0; j < n_in; j++) if ((rlit[j] >> 1) != 0) u_vars[un++] = rlit[j] >> 1;
                std::sort(u_vars, u_vars + un);
                un = (int)(std::unique(u_vars, u_vars + un) - u_vars);
                cur.n = (uint8_t)un;
                for (int i = 0; i < un; i++) cur.vars[i] = u_vars[i];
                uint64_t tts[3] = {0, 0, 0};
                for (int j = 0; j < n_in; j++) {
                    int rsig = rlit[j] >> 1, rinv = rlit[j] & 1;
                    if (rsig == 0) tts[j] = rinv ? ~0ULL : 0ULL;
                    else {
                        for (int i = 0; i < un; i++) if (cur.vars[i] == rsig) tts[j] = CUT_VAR_TT[i];
                        if (rinv) tts[j] = ~tts[j];
                    }
                }
                switch (t) {
                    case 0: cur.tt = tts[0] & tts[1]; break;
                    case 1: cur.tt = tts[0] | tts[1]; break;
                    case 2: cur.tt = tts[0] ^ tts[1]; break;
                    case 3: cur.tt = ~(tts[0] & tts[1]); break;
                    case 4: cur.tt = ~(tts[0] | tts[1]); break;
                    case 5: cur.tt = ~(tts[0] ^ tts[1]); break;
                    case 6: cur.tt = ~tts[0]; break;
                    default: cur.tt = (~tts[0] & tts[1]) | (tts[0] & tts[2]); break;
                }
                minimize_cut6(cur);
            }

            if (cur.n == 0) {
                cut_repr[sig] = (cur.tt & 1ULL) ? 1 : 0;
                continue;
            }
            if (cur.n == 1) {
                int inv = (cur.tt == ~CUT_VAR_TT[0]) ? 1 : 0;
                cut_repr[sig] = (cur.vars[0] << 1) | inv;
                continue;
            }
            int inv = (int)(cur.tt & 1ULL);
            uint64_t canon_tt = inv ? ~cur.tt : cur.tt;
            int found = cut_cache.find(cur.n, cur.vars, canon_tt);
            if (found != -1) {
                cut_repr[sig] = found ^ inv;
                continue;
            }
            cuts[sig] = cur;
            cut_repr[sig] = sig << 1;
            cut_cache.insert(cur.n, cur.vars, canon_tt, (sig << 1) ^ inv);
        }
    }

    // 3. Polarity-Aware Simplification + L2 CSE
    // Node numbering:
    //   0: const 0
    //   1 .. I: PI_0 .. PI_{I-1}
    //   1+I .. I+F: FF_0 .. FF_{F-1}
    //   1+I+F .. 1+I+F+numRfPseudoInputs-1: RegFile read outputs
    //   baseNode .. : simplified combinational gates
    const int baseNode = 1 + I + F + numRfPseudoInputs;
    std::vector<int> sig_lit(origN, 0);
    sig_lit[0] = 0;
    sig_lit[1] = 1;
    for (int i = 0; i < I; i++) sig_lit[2 + i] = (1 + i) << 1;
    for (int f = 0; f < F; f++) sig_lit[2 + I + f] = (1 + I + f) << 1;

    const bool use_cse = (baseNode + G < (1 << 20)) && (G <= 4096 || same_in_cnt >= 200 || rf.active);
    CseCache cse;
    std::vector<SimpNode> simp_nodes;
    simp_nodes.reserve(G);

    auto add_node = [&](OpKind op, int a, int b, int c_arg) -> int {
        if (use_cse) {
            uint64_t key = CseCache::pack((uint8_t)op, a, b, c_arg);
            int found = cse.find(key);
            if (found != -1) return found;
            int id = baseNode + (int)simp_nodes.size();
            simp_nodes.push_back({(uint8_t)op, a, b, c_arg});
            int lit = id << 1;
            cse.insert(key, lit);
            return lit;
        } else {
            int id = baseNode + (int)simp_nodes.size();
            simp_nodes.push_back({(uint8_t)op, a, b, c_arg});
            return id << 1;
        }
    };

    auto make_and = [&](int lx, int ly) -> int {
        if (lx == 0 || ly == 0) return 0;
        if (lx == 1) return ly;
        if (ly == 1) return lx;
        if (lx == ly) return lx;
        if ((lx ^ ly) == 1) return 0;
        int u = lx >> 1, px = lx & 1;
        int v = ly >> 1, py = ly & 1;
        if (px == 0 && py == 0) {
            if (u > v) std::swap(u, v);
            return add_node(OP_AND, u, v, 0);
        } else if (px == 1 && py == 0) {
            return add_node(OP_ANDN, u, v, 0);
        } else if (px == 0 && py == 1) {
            return add_node(OP_ANDN, v, u, 0);
        } else {
            if (u > v) std::swap(u, v);
            return add_node(OP_OR, u, v, 0) ^ 1;
        }
    };

    auto make_xor = [&](int lx, int ly) -> int {
        int inv = (lx & 1) ^ (ly & 1);
        int u = lx >> 1, v = ly >> 1;
        if (u == 0) return (v << 1) ^ inv;
        if (v == 0) return (u << 1) ^ inv;
        if (u == v) return inv;
        if (u > v) std::swap(u, v);
        return add_node(OP_XOR, u, v, 0) ^ inv;
    };

    auto make_mux = [&](int ls, int la, int lb) -> int {
        if (ls == 0) return la;
        if (ls == 1) return lb;
        if (la == lb) return la;
        if ((la ^ lb) == 1) return make_xor(ls, la);
        if (la == 0) return make_and(ls, lb);
        if (la == 1) return make_and(ls, lb ^ 1) ^ 1;
        if (lb == 0) return make_and(ls ^ 1, la);
        if (lb == 1) return make_and(ls ^ 1, la ^ 1) ^ 1;
        if (ls == la) return make_and(ls, lb);
        if (ls == (la ^ 1)) return make_and(ls, lb ^ 1) ^ 1;
        if (ls == lb) return make_and(ls ^ 1, la ^ 1) ^ 1;
        if (ls == (lb ^ 1)) return make_and(ls ^ 1, la);

        if (ls & 1) { ls ^= 1; std::swap(la, lb); }
        int out_inv = la & 1;
        if (out_inv) { la ^= 1; lb ^= 1; }
        int s = ls >> 1, a = la >> 1, b = lb >> 1;
        return ((lb & 1) == 0 ? add_node(OP_MUX0, s, a, b) : add_node(OP_MUX1, s, a, b)) ^ out_inv;
    };

    auto get_in_lit = [&](int raw_sig) -> int {
        if (run_cut_sweep) {
            int rl = cut_repr[raw_sig];
            int rsig = rl >> 1, rinv = rl & 1;
            return (rsig == 0) ? rinv : (sig_lit[rsig] ^ rinv);
        }
        return sig_lit[raw_sig];
    };

    for (int k : topo) {
        int sig = origGateBase + k;
        if (rf.active) {
            if (!rf_orig_live[sig]) continue;
            if (rf_pseudo_node_of_sig[sig] != -1) {
                sig_lit[sig] = rf_pseudo_node_of_sig[sig] << 1;
                continue;
            }
        }
        if (run_cut_sweep && (cut_repr[sig] >> 1) != sig) {
            int rl = cut_repr[sig];
            int rsig = rl >> 1, rinv = rl & 1;
            sig_lit[sig] = (rsig == 0) ? rinv : (sig_lit[rsig] ^ rinv);
            continue;
        }
        uint8_t t = ctype[k];
        int lx = get_in_lit(cin0[k]);
        int ly = (t != 6) ? get_in_lit(cin1[k]) : 0;
        int lz = (t == 7) ? get_in_lit(cin2[k]) : 0;
        int res = 0;
        switch (t) {
            case 0: res = make_and(lx, ly); break;
            case 1: res = make_and(lx ^ 1, ly ^ 1) ^ 1; break;
            case 2: res = make_xor(lx, ly); break;
            case 3: res = make_and(lx, ly) ^ 1; break;
            case 4: res = make_and(lx ^ 1, ly ^ 1); break;
            case 5: res = make_xor(lx, ly) ^ 1; break;
            case 6: res = lx ^ 1; break;
            default: res = make_mux(lx, ly, lz); break;
        }
        sig_lit[sig] = res;
    }

    // Collect all required sink literals
    // Buffer layout:
    //   [0]: const 0
    //   [1]: const 1
    //   [2 .. 43]: 42 disp8 hot intra-chunk spill slots
    //   [44 .. 44+I-1]: PI_0 .. PI_{I-1}  (node 1..I -> slot = 43 + node)
    //   [44+I .. 44+I+F-1]: FF_0 .. FF_{F-1} (node 1+I..I+F -> slot = 43 + node)
    //   [44+I+F .. +numRfPseudo-1]: RegFile read outputs (node -> slot = 43 + node)
    //   [next_ff_base .. +numStandardFfs-1]: next_ff for standard FFs (0..F-1, or 4096..F-1 if rf.active)
    //   [out_base .. +O-1]: primary outputs
    //   [rf_sink_base .. +rf_extra_sink_sigs.size()-1]: we, waddr, wdata for RegFile
    //   [cross_spill_base .. ]: cross-chunk spill slots
    //   [warm_spill_base .. ]: additional intra-chunk spill slots beyond the 42 hot disp8 slots
    const int ff_start_idx = rf.active ? 4096 : 0;
    const int numStdFfs = F - ff_start_idx;
    const int next_ff_base = PI_SLOT_BASE + I + F + numRfPseudoInputs;
    const int out_base = next_ff_base + numStdFfs;
    const int rf_sink_base = out_base + O;
    const int cross_spill_base = rf_sink_base + (int)rf_extra_sink_sigs.size();

    if (rf.active) {
        int P = rf.P, K = rf.K, W = rf.W;
        rf.we_slots.resize(P);
        rf.waddr_slots.assign(P, std::vector<int>(K));
        rf.wdata_slot_base.resize(P);
        for (int p = 0; p < P; p++) rf.we_slots[p] = rf_sink_base + p;
        for (int p = 0; p < P; p++) for (int b = 0; b < K; b++) rf.waddr_slots[p][b] = rf_sink_base + P + p * K + b;
        for (int p = 0; p < P; p++) rf.wdata_slot_base[p] = rf_sink_base + P + P * K + p * W;
    }

    struct SinkReq { int dst_slot; int lit; };
    std::vector<SinkReq> all_sinks;
    all_sinks.reserve((size_t)numStdFfs + O + rf_extra_sink_sigs.size());
    for (int f = ff_start_idx; f < F; f++) {
        all_sinks.push_back({next_ff_base + (f - ff_start_idx), sig_lit[c.d[f]]});
    }
    for (int j = 0; j < O; j++) {
        all_sinks.push_back({out_base + j, sig_lit[c.out[j]]});
    }
    for (size_t i = 0; i < rf_extra_sink_sigs.size(); i++) {
        all_sinks.push_back({rf_sink_base + (int)i, sig_lit[rf_extra_sink_sigs[i]]});
    }

    // 4. Dead Code Elimination + Depth Analysis
    const int numSimp = (int)simp_nodes.size();
    std::vector<uint8_t> live(numSimp, 0);
    std::vector<int> ext_fanout(numSimp, 0);
    for (const auto& sr : all_sinks) {
        int id = sr.lit >> 1;
        if (id >= baseNode) {
            live[id - baseNode] = 1;
            ext_fanout[id - baseNode]++;
        }
    }
    for (int i = numSimp - 1; i >= 0; i--) {
        if (!live[i]) continue;
        const SimpNode& nd = simp_nodes[i];
        if (nd.a >= baseNode) live[nd.a - baseNode] = 1;
        if (nd.b >= baseNode) live[nd.b - baseNode] = 1;
        if (nd.op >= OP_MUX0 && nd.c >= baseNode) live[nd.c - baseNode] = 1;
    }

    std::vector<int> asap(baseNode + numSimp, 0);
    std::vector<int> gate_fanout(numSimp, 0);
    int max_depth = 0;
    for (int i = 0; i < numSimp; i++) {
        if (!live[i]) continue;
        const SimpNode& nd = simp_nodes[i];
        int dm = std::max(asap[nd.a], asap[nd.b]);
        if (nd.op >= OP_MUX0) dm = std::max(dm, asap[nd.c]);
        asap[baseNode + i] = dm + 1;
        if (dm + 1 > max_depth) max_depth = dm + 1;
        if (nd.a >= baseNode) gate_fanout[nd.a - baseNode]++;
        if (nd.b >= baseNode) gate_fanout[nd.b - baseNode]++;
        if (nd.op >= OP_MUX0 && nd.c >= baseNode) gate_fanout[nd.c - baseNode]++;
    }

    // 5. Optional Full-Adder / Half-Adder Macro-Cell Fusion + Topological Scheduling
    std::vector<int> sched_old_idx;
    sched_old_idx.reserve(numSimp);

    const bool is_deep_ribbon = (max_depth > 20000);
    std::vector<int> fa_partner(numSimp, -1); // for s_idx -> cout_idx, and cout_idx -> s_idx

    if (is_deep_ribbon) {
        // ALAP Pulled-Up Level Order: preserves sliding-window locality on deep chains!
        std::vector<int> level(numSimp, 0);
        for (int i = 0; i < numSimp; i++) if (live[i]) level[i] = asap[baseNode + i];

        // Compute min consumer level for pull-up
        std::vector<int> min_cons_lvl(numSimp, 1000000000);
        for (int i = numSimp - 1; i >= 0; i--) {
            if (!live[i]) continue;
            if (ext_fanout[i] == 0 && min_cons_lvl[i] < 1000000000) {
                if (min_cons_lvl[i] - 1 > level[i]) level[i] = min_cons_lvl[i] - 1;
            }
            const SimpNode& nd = simp_nodes[i];
            int lv = level[i];
            if (nd.a >= baseNode) min_cons_lvl[nd.a - baseNode] = std::min(min_cons_lvl[nd.a - baseNode], lv);
            if (nd.b >= baseNode) min_cons_lvl[nd.b - baseNode] = std::min(min_cons_lvl[nd.b - baseNode], lv);
            if (nd.op >= OP_MUX0 && nd.c >= baseNode) min_cons_lvl[nd.c - baseNode] = std::min(min_cons_lvl[nd.c - baseNode], lv);
        }
        // Counting sort by level[i] (since 0 <= level[i] <= max_depth <= G, O(G) time instead of O(G log G) std::sort!)
        std::vector<int> cnt(max_depth + 2, 0);
        for (int i = 0; i < numSimp; i++) if (live[i]) cnt[level[i] + 1]++;
        for (int lv = 1; lv <= max_depth + 1; lv++) cnt[lv] += cnt[lv - 1];
        sched_old_idx.resize(cnt[max_depth + 1]);
        for (int i = 0; i < numSimp; i++) {
            if (live[i]) sched_old_idx[cnt[level[i]]++] = i;
        }
    } else {
        // Fuse pure untapped Full Adders (OP_FA) and Half Adders (OP_HA)!
        CseCache xor_lookup, and_lookup;
        for (int i = 0; i < numSimp; i++) {
            if (!live[i]) continue;
            const SimpNode& nd = simp_nodes[i];
            if (nd.op == OP_XOR) xor_lookup.insert(CseCache::pack(0, nd.a, nd.b, 0), i);
            else if (nd.op == OP_AND) and_lookup.insert(CseCache::pack(0, nd.a, nd.b, 0), i);
        }
        std::vector<uint8_t> claimed(numSimp, 0);
        for (int i = 0; i < numSimp; i++) {
            if (!live[i] || claimed[i]) continue;
            const SimpNode& nd = simp_nodes[i];
            if (nd.op != OP_OR || nd.a < baseNode || nd.b < baseNode) continue;
            int g1 = nd.a - baseNode, g2 = nd.b - baseNode;
            if (claimed[g1] || claimed[g2]) continue;
            if (simp_nodes[g1].op != OP_AND || simp_nodes[g2].op != OP_AND) continue;
            if (gate_fanout[g1] != 1 || ext_fanout[g1] != 0) continue;
            if (gate_fanout[g2] != 1 || ext_fanout[g2] != 0) continue;

            for (int sw = 0; sw < 2; sw++) {
                int ab = sw ? g2 : g1, tc = sw ? g1 : g2;
                int a = simp_nodes[ab].a, b = simp_nodes[ab].b;
                int t_idx = xor_lookup.find(CseCache::pack(0, a, b, 0));
                if (t_idx < 0 || claimed[t_idx] || !live[t_idx]) continue;
                if (gate_fanout[t_idx] != 2 || ext_fanout[t_idx] != 0) continue;
                int t_node = baseNode + t_idx;
                int x1 = simp_nodes[tc].a, x2 = simp_nodes[tc].b;
                int cin = (x1 == t_node) ? x2 : ((x2 == t_node) ? x1 : -1);
                if (cin < 0) continue;
                int u = std::min(t_node, cin), v = std::max(t_node, cin);
                int s_idx = xor_lookup.find(CseCache::pack(0, u, v, 0));
                if (s_idx < 0 || claimed[s_idx] || !live[s_idx] || s_idx == i) continue;

                // Verified pure untapped Full Adder!
                claimed[ab] = claimed[tc] = claimed[t_idx] = claimed[s_idx] = claimed[i] = 1;
                live[ab] = live[tc] = live[t_idx] = 0;
                simp_nodes[s_idx] = {OP_FA, a, b, cin};
                simp_nodes[i] = {OP_COUT, baseNode + s_idx, 0, 0};
                fa_partner[s_idx] = i;
                fa_partner[i] = s_idx;
                break;
            }
        }
        // Also fuse pure Half Adders (OP_XOR(a,b) + OP_AND(a,b))
        for (int i = 0; i < numSimp; i++) {
            if (!live[i] || claimed[i] || simp_nodes[i].op != OP_XOR) continue;
            int a = simp_nodes[i].a, b = simp_nodes[i].b;
            int c_idx = and_lookup.find(CseCache::pack(0, a, b, 0));
            if (c_idx >= 0 && live[c_idx] && !claimed[c_idx] && c_idx != i) {
                claimed[i] = claimed[c_idx] = 1;
                simp_nodes[i] = {OP_HA, a, b, 0};
                simp_nodes[c_idx] = {OP_COUT, baseNode + i, 0, 0};
                fa_partner[i] = c_idx;
                fa_partner[c_idx] = i;
            }
        }

        // RCA-Coalesced Sethi-Ullman Postorder DFS!
        // Note: an (OP_FA/OP_HA, OP_COUT) pair is treated as ONE atomic super-node (represented by s_idx)!
        auto canon_idx = [&](int idx) -> int {
            return (simp_nodes[idx].op == OP_COUT) ? (simp_nodes[idx].a - baseNode) : idx;
        };

        std::vector<int> roots;
        for (int i = 0; i < numSimp; i++) {
            if (!live[i] || simp_nodes[i].op == OP_COUT) continue;
            int p_idx = fa_partner[i];
            int fo = gate_fanout[i] + (p_idx >= 0 ? gate_fanout[p_idx] : 0);
            if (fo == 0) roots.push_back(i);
        }
        std::sort(roots.begin(), roots.end(), [&](int x, int y) {
            return asap[baseNode + x] < asap[baseNode + y];
        });

        std::vector<uint8_t> visited(numSimp, 0);
        struct DfsFrame { int idx; uint8_t stage; };
        std::vector<DfsFrame> stk;
        stk.reserve(numSimp);

        auto run_dfs = [&](int start) {
            start = canon_idx(start);
            if (visited[start]) return;
            stk.push_back({start, 0});
            while (!stk.empty()) {
                DfsFrame& fr = stk.back();
                int idx = fr.idx;
                if (fr.stage == 0) {
                    if (visited[idx]) { stk.pop_back(); continue; }
                    visited[idx] = 1;
                    fr.stage = 1;
                    const SimpNode& nd = simp_nodes[idx];
                    if (nd.op == OP_FA) {
                        // Visit cin FIRST (so carry chain cell_0 .. cell_{L-1} emits LSB-to-MSB consecutively!),
                        // then visit deeper of (a, b), then shallower of (a, b)!
                        // On LIFO stack, push LAST-to-visit FIRST!
                        int ca = (nd.a >= baseNode) ? canon_idx(nd.a - baseNode) : -1;
                        int cb = (nd.b >= baseNode) ? canon_idx(nd.b - baseNode) : -1;
                        int cc = (nd.c >= baseNode) ? canon_idx(nd.c - baseNode) : -1;
                        if (ca >= 0 && cb >= 0 && asap[baseNode + ca] > asap[baseNode + cb]) std::swap(ca, cb);
                        if (ca >= 0 && !visited[ca]) stk.push_back({ca, 0});
                        if (cb >= 0 && !visited[cb]) stk.push_back({cb, 0});
                        if (cc >= 0 && !visited[cc]) stk.push_back({cc, 0});
                    } else {
                        int ch[3], nc = 0;
                        if (nd.a >= baseNode) { int c0 = canon_idx(nd.a - baseNode); if (!visited[c0]) ch[nc++] = c0; }
                        if (nd.b >= baseNode) { int c1 = canon_idx(nd.b - baseNode); if (!visited[c1]) ch[nc++] = c1; }
                        if (nd.op >= OP_MUX0 && nd.op <= OP_MUX1 && nd.c >= baseNode) {
                            int c2 = canon_idx(nd.c - baseNode);
                            if (!visited[c2]) ch[nc++] = c2;
                        }
                        if (nc == 2 && asap[baseNode + ch[0]] > asap[baseNode + ch[1]]) std::swap(ch[0], ch[1]);
                        else if (nc == 3) {
                            if (asap[baseNode + ch[0]] > asap[baseNode + ch[1]]) std::swap(ch[0], ch[1]);
                            if (asap[baseNode + ch[1]] > asap[baseNode + ch[2]]) std::swap(ch[1], ch[2]);
                            if (asap[baseNode + ch[0]] > asap[baseNode + ch[1]]) std::swap(ch[0], ch[1]);
                        }
                        for (int j = 0; j < nc; j++) stk.push_back({ch[j], 0});
                    }
                } else {
                    sched_old_idx.push_back(idx);
                    if (fa_partner[idx] >= 0) {
                        visited[fa_partner[idx]] = 1;
                        sched_old_idx.push_back(fa_partner[idx]);
                    }
                    stk.pop_back();
                }
            }
        };

        for (int r : roots) run_dfs(r);
        for (int i = 0; i < numSimp; i++) {
            if (live[i] && simp_nodes[i].op != OP_COUT && !visited[i]) run_dfs(i);
        }
    }

    // Remap scheduled gates to contiguous [baseNode .. baseNode + S - 1]
    const int S = (int)sched_old_idx.size();
    std::vector<int> node_remap(baseNode + numSimp, -1);
    for (int u = 0; u < baseNode; u++) node_remap[u] = u;
    for (int p = 0; p < S; p++) node_remap[baseNode + sched_old_idx[p]] = baseNode + p;

    std::vector<SimpNode> sched(S);
    for (int p = 0; p < S; p++) {
        SimpNode nd = simp_nodes[sched_old_idx[p]];
        if (nd.op == OP_COUT) {
            nd.a = node_remap[nd.a];
        } else {
            nd.a = node_remap[nd.a];
            nd.b = node_remap[nd.b];
            if (nd.op >= OP_MUX0 && nd.op <= OP_FA) nd.c = node_remap[nd.c];
        }
        sched[p] = nd;
    }

    // Attach gate sinks and direct input copies
    std::vector<int> sink_head(S, -1);
    struct SinkEntry { int target_slot; uint8_t inv; int next; };
    std::vector<SinkEntry> gate_sinks;
    gate_sinks.reserve(all_sinks.size());
    std::vector<std::pair<int, int>> direct_copies; // (dst_slot, remapped_lit)

    for (const auto& sr : all_sinks) {
        int u = node_remap[sr.lit >> 1];
        uint8_t inv = (uint8_t)(sr.lit & 1);
        if (u >= baseNode) {
            int p = u - baseNode;
            gate_sinks.push_back({sr.dst_slot, inv, sink_head[p]});
            sink_head[p] = (int)gate_sinks.size() - 1;
        } else {
            direct_copies.push_back({sr.dst_slot, (u << 1) | inv});
        }
    }

    // 6. Global Static Use Table & Chunk Partitioning for Parallel Multi-Threaded JIT!
    // Make sure no chunk boundary splits (OP_FA/OP_HA at p, OP_COUT at p+1)!
    constexpr int TARGET_CHUNK = 65536;
    std::vector<int> chunk_bounds;
    if (S > 0) {
        chunk_bounds.push_back(0);
        int pos = TARGET_CHUNK;
        while (pos < S) {
            if (sched[pos].op == OP_COUT) pos++;
            if (pos < S) chunk_bounds.push_back(pos);
            pos += TARGET_CHUNK;
        }
        chunk_bounds.push_back(S);
    }
    const int numChunks = (S > 0) ? ((int)chunk_bounds.size() - 1) : 0;

    const int totalNodes = baseNode + S;
    std::vector<int> use_deg(totalNodes, 0);
    std::vector<int> last_use_global(totalNodes, -1);
    for (int p = 0; p < S; p++) {
        const SimpNode& nd = sched[p];
        if (nd.op == OP_COUT) continue;
        use_deg[nd.a]++; last_use_global[nd.a] = p;
        if (nd.b != nd.a) { use_deg[nd.b]++; last_use_global[nd.b] = p; }
        if (nd.op >= OP_MUX0 && nd.op <= OP_FA && nd.c != nd.a && nd.c != nd.b) {
            use_deg[nd.c]++; last_use_global[nd.c] = p;
        }
    }
    std::vector<int> use_start(totalNodes + 1, 0);
    for (int u = 0; u < totalNodes; u++) use_start[u + 1] = use_start[u] + use_deg[u];
    std::vector<int> use_flat(use_start[totalNodes]);
    {
        std::vector<int> use_cur = use_start;
        for (int p = 0; p < S; p++) {
            const SimpNode& nd = sched[p];
            if (nd.op == OP_COUT) continue;
            use_flat[use_cur[nd.a]++] = p;
            if (nd.b != nd.a) use_flat[use_cur[nd.b]++] = p;
            if (nd.op >= OP_MUX0 && nd.op <= OP_FA && nd.c != nd.a && nd.c != nd.b) {
                use_flat[use_cur[nd.c]++] = p;
            }
        }
    }

    // Assign recycled cross-chunk spill slots ONLY to nodes whose lifetime crosses a chunk boundary!
    std::vector<int> cross_slot(S, -1);
    int num_cross_spills = 0;
    if (numChunks > 1) {
        std::vector<std::vector<int>> expire_at_chunk(numChunks);
        std::vector<int> free_cross;
        auto chunk_of_pos = [&](int pos) -> int {
            int c_idx = (int)(std::upper_bound(chunk_bounds.begin(), chunk_bounds.end(), pos) - chunk_bounds.begin()) - 1;
            return std::clamp(c_idx, 0, numChunks - 1);
        };
        for (int c_idx = 0; c_idx < numChunks; c_idx++) {
            int Lc = chunk_bounds[c_idx], Rc = chunk_bounds[c_idx + 1];
            for (int p = Lc; p < Rc; p++) {
                int u = baseNode + p;
                int lu = last_use_global[u];
                if (lu >= Rc) {
                    int sl = free_cross.empty() ? (cross_spill_base + num_cross_spills++) : free_cross.back();
                    if (!free_cross.empty()) free_cross.pop_back();
                    cross_slot[p] = sl;
                    expire_at_chunk[chunk_of_pos(lu)].push_back(sl);
                }
            }
            for (int sl : expire_at_chunk[c_idx]) free_cross.push_back(sl);
        }
    }
    const int warm_spill_base = cross_spill_base + num_cross_spills;

    // Parallel JIT compilation across chunks!
    std::vector<JitEmitter> chunk_jits(numChunks);
    std::vector<int> chunk_warm_spills(numChunks, 0);

    #pragma omp parallel for schedule(dynamic, 1) if(numChunks > 1)
    for (int c_idx = 0; c_idx < numChunks; c_idx++) {
        const int Lc = chunk_bounds[c_idx];
        const int Rc = chunk_bounds[c_idx + 1];
        constexpr int NUM_REGS = 15;
        constexpr int SCRATCH_REG = 15;
        constexpr int INF_USE = 1000000000;

        // Track touched nodes cleanly so we don't allocate O(totalNodes) per chunk!
        // Wait: numChunks <= 8, totalNodes <= 520K -> 4B * 520K = 2 MB per active chunk thread (<= 8 threads = 16 MB total, super fast!)
        std::vector<int> use_ptr(totalNodes, -1);
        std::vector<int8_t> node_reg(totalNodes, -1);
        std::vector<uint8_t> in_mem(totalNodes, 0);
        std::vector<int> mem_slot(totalNodes, -1);

        auto init_external_node = [&](int u) {
            if (u < baseNode + Lc && mem_slot[u] == -1) {
                in_mem[u] = 1;
                if (u == 0) mem_slot[u] = 0;
                else if (u < baseNode) mem_slot[u] = (PI_SLOT_BASE - 1) + u;
                else mem_slot[u] = cross_slot[u - baseNode];
            }
        };

        auto get_use_ptr = [&](int u, int target_p) -> int {
            int ptr = use_ptr[u];
            if (ptr == -1) {
                int s = use_start[u], e = use_start[u + 1];
                ptr = (int)(std::lower_bound(use_flat.begin() + s, use_flat.begin() + e, target_p) - use_flat.begin());
            } else {
                int e = use_start[u + 1];
                while (ptr < e && use_flat[ptr] < target_p) ptr++;
            }
            use_ptr[u] = ptr;
            return ptr;
        };

        // For cross-chunk nodes created in [Lc, Rc), keep them alive until Rc!
        auto next_use_ge = [&](int u, int cp) -> int {
            int ptr = get_use_ptr(u, cp);
            if (ptr < use_start[u + 1] && use_flat[ptr] < Rc) return use_flat[ptr];
            if (u >= baseNode + Lc && cross_slot[u - baseNode] != -1) return Rc;
            return INF_USE;
        };
        auto next_use_gt = [&](int u, int cp) -> int {
            int ptr = get_use_ptr(u, cp + 1);
            if (ptr < use_start[u + 1] && use_flat[ptr] < Rc) return use_flat[ptr];
            if (u >= baseNode + Lc && cross_slot[u - baseNode] != -1) return Rc;
            return INF_USE;
        };

        int reg_node[NUM_REGS];
        std::fill(reg_node, reg_node + NUM_REGS, -1);

        // 42 ultra-hot disp8 slots [2..43] + L1D hot pool [0..511] + warm LIFO pool!
        uint64_t disp8_free_mask = (1ULL << HOT_DISP8_SLOTS) - 1ULL; // bits 0..41 -> slots 2..43
        uint64_t l1_free_mask[8]; // 512 L1D-hot slots at warm_spill_base + 0..511
        std::fill(l1_free_mask, l1_free_mask + 8, ~0ULL);
        std::vector<int> warm_free;
        int warm_bump = 512;
        int max_warm_used = 0;

        auto alloc_local_spill = [&](int dist) -> int {
            if (dist <= 256 && disp8_free_mask != 0) {
                int bit = __builtin_ctzll(disp8_free_mask);
                disp8_free_mask &= disp8_free_mask - 1ULL;
                return 2 + bit;
            }
            if (dist <= 2048) {
                for (int g = 0; g < 8; g++) {
                    if (l1_free_mask[g] != 0) {
                        int bit = __builtin_ctzll(l1_free_mask[g]);
                        l1_free_mask[g] &= l1_free_mask[g] - 1ULL;
                        int idx = g * 64 + bit;
                        if (idx + 1 > max_warm_used) max_warm_used = idx + 1;
                        return warm_spill_base + idx;
                    }
                }
            }
            if (!warm_free.empty()) {
                int sl = warm_free.back();
                warm_free.pop_back();
                return sl;
            }
            int idx = warm_bump++;
            if (idx + 1 > max_warm_used) max_warm_used = idx + 1;
            return warm_spill_base + idx;
        };

        auto free_local_spill = [&](int sl) {
            if (sl >= 2 && sl < 2 + HOT_DISP8_SLOTS) {
                disp8_free_mask |= (1ULL << (sl - 2));
            } else if (sl >= warm_spill_base && sl < warm_spill_base + 512) {
                int idx = sl - warm_spill_base;
                l1_free_mask[idx >> 6] |= (1ULL << (idx & 63));
            } else if (sl >= warm_spill_base + 512) {
                warm_free.push_back(sl);
            }
        };

        JitEmitter& jit = chunk_jits[c_idx];
        jit.reserve((size_t)(Rc - Lc) * 8 + 1024);
        jit.emit_prologue();

        auto spill_node_from_reg = [&](int w, int r, int cp) {
            if (!in_mem[w]) {
                int sl;
                if (w >= baseNode + Lc && cross_slot[w - baseNode] != -1) {
                    sl = cross_slot[w - baseNode];
                } else {
                    int nu = next_use_gt(w, cp);
                    sl = alloc_local_spill(nu - cp);
                }
                jit.vmov_store(sl, r);
                mem_slot[w] = sl;
                in_mem[w] = 1;
            }
            node_reg[w] = -1;
            reg_node[r] = -1;
        };

        auto pick_reg = [&](uint32_t pinned_mask, int cp, bool after_read) -> int {
            for (int r = 0; r < NUM_REGS; r++) {
                if ((pinned_mask >> r) & 1) continue;
                int w = reg_node[r];
                if (w == -1) return r;
                int nu = after_read ? next_use_gt(w, cp) : next_use_ge(w, cp);
                if (nu == INF_USE) {
                    node_reg[w] = -1;
                    reg_node[r] = -1;
                    return r;
                }
            }
            int best_r = -1, best_nu = -1;
            for (int r = 0; r < NUM_REGS; r++) {
                if ((pinned_mask >> r) & 1) continue;
                int w = reg_node[r];
                int nu = after_read ? next_use_gt(w, cp) : next_use_ge(w, cp);
                if (nu > best_nu) {
                    best_nu = nu;
                    best_r = r;
                }
            }
            spill_node_from_reg(reg_node[best_r], best_r, cp);
            return best_r;
        };

        auto ensure_in_reg = [&](int u, uint32_t& pinned_mask, int cp) -> int {
            init_external_node(u);
            int r = node_reg[u];
            if (r != -1) {
                pinned_mask |= (1u << r);
                return r;
            }
            r = pick_reg(pinned_mask, cp, false);
            jit.vmov_load(r, mem_slot[u]);
            reg_node[r] = u;
            node_reg[u] = (int8_t)r;
            pinned_mask |= (1u << r);
            return r;
        };

        auto can_read_mem_once = [&](int u, int cp) -> bool {
            init_external_node(u);
            return node_reg[u] == -1 && in_mem[u] && next_use_gt(u, cp) == INF_USE;
        };

        auto emit_sinks_for_gate = [&](int gate_p, int reg_r) {
            if (sink_head[gate_p] == -1) return;
            bool has_inv = false;
            for (int e = sink_head[gate_p]; e != -1; e = gate_sinks[e].next) {
                if (!gate_sinks[e].inv) jit.vmov_store(gate_sinks[e].target_slot, reg_r);
                else has_inv = true;
            }
            if (has_inv) {
                jit.vpxor_rm(SCRATCH_REG, reg_r, 1);
                for (int e = sink_head[gate_p]; e != -1; e = gate_sinks[e].next) {
                    if (gate_sinks[e].inv) jit.vmov_store(gate_sinks[e].target_slot, SCRATCH_REG);
                }
            }
        };

        auto cleanup_input = [&](int inp, int cp) {
            if (next_use_gt(inp, cp) == INF_USE) {
                int r = node_reg[inp];
                if (r != -1 && reg_node[r] == inp) {
                    reg_node[r] = -1;
                    node_reg[inp] = -1;
                }
                if (inp >= baseNode + Lc && cross_slot[inp - baseNode] == -1 && in_mem[inp]) {
                    free_local_spill(mem_slot[inp]);
                    in_mem[inp] = 0;
                }
            }
        };

        for (int p = Lc; p < Rc; p++) {
            const SimpNode& nd = sched[p];
            const int u_out = baseNode + p;
            uint32_t pinned = 0;

            if (nd.op == OP_FA) {
                // Partner OP_COUT is guaranteed at p + 1!
                const int u_cout = baseNode + p + 1;
                int ra = ensure_in_reg(nd.a, pinned, p);
                int rb = ensure_in_reg(nd.b, pinned, p);
                int rc = ensure_in_reg(nd.c, pinned, p);

                jit.vpxor_rr(SCRATCH_REG, ra, rb); // ymm15 = t = a ^ b
                int dst_c = pick_reg(1u << rc, p, true);
                jit.vpand_rr(dst_c, ra, rb);       // dst_c = a & b
                int dst_s = pick_reg((1u << dst_c) | (1u << rc), p, true);
                jit.vpxor_rr(dst_s, SCRATCH_REG, rc); // dst_s = SUM
                jit.vpand_rr(SCRATCH_REG, SCRATCH_REG, rc); // ymm15 = t & c
                jit.vpor_rr(dst_c, dst_c, SCRATCH_REG);     // dst_c = COUT

                if (reg_node[dst_s] != -1) node_reg[reg_node[dst_s]] = -1;
                if (reg_node[dst_c] != -1) node_reg[reg_node[dst_c]] = -1;
                reg_node[dst_s] = u_out;  node_reg[u_out] = (int8_t)dst_s;
                reg_node[dst_c] = u_cout; node_reg[u_cout] = (int8_t)dst_c;

                cleanup_input(nd.a, p);
                cleanup_input(nd.b, p);
                cleanup_input(nd.c, p);

                emit_sinks_for_gate(p, dst_s);
                emit_sinks_for_gate(p + 1, dst_c);

                if (next_use_gt(u_out, p + 1) == INF_USE)  { reg_node[dst_s] = -1; node_reg[u_out] = -1; }
                if (next_use_gt(u_cout, p + 1) == INF_USE) { reg_node[dst_c] = -1; node_reg[u_cout] = -1; }
                p++; // skip OP_COUT at p + 1!
                continue;
            }

            if (nd.op == OP_HA) {
                const int u_cout = baseNode + p + 1;
                int ra = ensure_in_reg(nd.a, pinned, p);
                int rb = ensure_in_reg(nd.b, pinned, p);
                int dst_s = pick_reg((1u << ra) | (1u << rb), p, true);
                jit.vpxor_rr(dst_s, ra, rb);
                int dst_c = pick_reg(1u << dst_s, p, true);
                jit.vpand_rr(dst_c, ra, rb);

                if (reg_node[dst_s] != -1) node_reg[reg_node[dst_s]] = -1;
                if (reg_node[dst_c] != -1) node_reg[reg_node[dst_c]] = -1;
                reg_node[dst_s] = u_out;  node_reg[u_out] = (int8_t)dst_s;
                reg_node[dst_c] = u_cout; node_reg[u_cout] = (int8_t)dst_c;

                cleanup_input(nd.a, p);
                cleanup_input(nd.b, p);

                emit_sinks_for_gate(p, dst_s);
                emit_sinks_for_gate(p + 1, dst_c);

                if (next_use_gt(u_out, p + 1) == INF_USE)  { reg_node[dst_s] = -1; node_reg[u_out] = -1; }
                if (next_use_gt(u_cout, p + 1) == INF_USE) { reg_node[dst_c] = -1; node_reg[u_cout] = -1; }
                p++; // skip OP_COUT!
                continue;
            }

            int dst_r = -1;
            if (nd.op == OP_AND || nd.op == OP_OR || nd.op == OP_XOR) {
                uint8_t opc = (nd.op == OP_AND) ? 0xDB : ((nd.op == OP_OR) ? 0xEB : 0xEF);
                int a = nd.a, b = nd.b;
                init_external_node(a);
                init_external_node(b);
                if (node_reg[a] == -1 && node_reg[b] != -1) std::swap(a, b);
                if (can_read_mem_once(b, p)) {
                    int ra = ensure_in_reg(a, pinned, p);
                    dst_r = pick_reg(0, p, true);
                    jit.emit_vex_slot(opc, dst_r, ra, mem_slot[b]);
                } else if (can_read_mem_once(a, p)) {
                    int rb = ensure_in_reg(b, pinned, p);
                    dst_r = pick_reg(0, p, true);
                    jit.emit_vex_slot(opc, dst_r, rb, mem_slot[a]);
                } else {
                    int ra = ensure_in_reg(a, pinned, p);
                    int rb = ensure_in_reg(b, pinned, p);
                    dst_r = pick_reg(0, p, true);
                    jit.emit_vex_rr(opc, dst_r, ra, rb);
                }
            } else if (nd.op == OP_ANDN) {
                int ra = ensure_in_reg(nd.a, pinned, p);
                if (can_read_mem_once(nd.b, p)) {
                    dst_r = pick_reg(0, p, true);
                    jit.vpandn_rm(dst_r, ra, mem_slot[nd.b]);
                } else {
                    int rb = ensure_in_reg(nd.b, pinned, p);
                    dst_r = pick_reg(0, p, true);
                    jit.vpandn_rr(dst_r, ra, rb);
                }
            } else if (nd.op == OP_MUX0) {
                int rs = ensure_in_reg(nd.a, pinned, p);
                bool a_mem = can_read_mem_once(nd.b, p);
                int ra = a_mem ? -1 : ensure_in_reg(nd.b, pinned, p);
                bool b_mem = can_read_mem_once(nd.c, p);
                int rb = b_mem ? -1 : ensure_in_reg(nd.c, pinned, p);
                dst_r = pick_reg(0, p, true);

                if (a_mem) jit.vpandn_rm(SCRATCH_REG, rs, mem_slot[nd.b]);
                else       jit.vpandn_rr(SCRATCH_REG, rs, ra);
                if (b_mem) jit.vpand_rm(dst_r, rs, mem_slot[nd.c]);
                else       jit.vpand_rr(dst_r, rs, rb);
                jit.vpor_rr(dst_r, SCRATCH_REG, dst_r);
            } else { // OP_MUX1
                int rs = ensure_in_reg(nd.a, pinned, p);
                int rb = ensure_in_reg(nd.c, pinned, p);
                bool a_mem = can_read_mem_once(nd.b, p);
                int ra = a_mem ? -1 : ensure_in_reg(nd.b, pinned, p);
                dst_r = pick_reg(0, p, true);

                if (a_mem) jit.vpandn_rm(SCRATCH_REG, rs, mem_slot[nd.b]);
                else       jit.vpandn_rr(SCRATCH_REG, rs, ra);
                jit.vpandn_rr(dst_r, rb, rs);
                jit.vpor_rr(dst_r, SCRATCH_REG, dst_r);
            }

            if (reg_node[dst_r] != -1) node_reg[reg_node[dst_r]] = -1;
            reg_node[dst_r] = u_out;
            node_reg[u_out] = (int8_t)dst_r;

            cleanup_input(nd.a, p);
            cleanup_input(nd.b, p);
            if (nd.op >= OP_MUX0) cleanup_input(nd.c, p);

            emit_sinks_for_gate(p, dst_r);

            if (next_use_gt(u_out, p) == INF_USE) {
                reg_node[dst_r] = -1;
                node_reg[u_out] = -1;
            }
        }

        // Flush any cross-chunk values still only in registers at the end of this chunk!
        for (int r = 0; r < NUM_REGS; r++) {
            int w = reg_node[r];
            if (w >= baseNode + Lc && cross_slot[w - baseNode] != -1 && !in_mem[w]) {
                jit.vmov_store(cross_slot[w - baseNode], r);
                in_mem[w] = 1;
            }
        }

        jit.emit_epilogue();
        chunk_warm_spills[c_idx] = max_warm_used;
    }

    int max_warm = 0;
    size_t total_code_bytes = 0;
    std::vector<size_t> chunk_code_off(numChunks, 0);
    for (int c_idx = 0; c_idx < numChunks; c_idx++) {
        max_warm = std::max(max_warm, chunk_warm_spills[c_idx]);
        chunk_code_off[c_idx] = total_code_bytes;
        total_code_bytes += (chunk_jits[c_idx].code.size() + 63) & ~size_t(63);
    }

    ExecutableArena exec_arena;
    using JitFunc = void (*)(void*);
    std::vector<JitFunc> chunk_fns(numChunks, nullptr);
    if (numChunks > 0) {
        uint8_t* base_exec = exec_arena.alloc_total(total_code_bytes);
        if (!base_exec) std::abort();
        #pragma omp parallel for schedule(static) if(numChunks > 1)
        for (int c_idx = 0; c_idx < numChunks; c_idx++) {
            uint8_t* dst = base_exec + chunk_code_off[c_idx];
            std::memcpy(dst, chunk_jits[c_idx].code.data(), chunk_jits[c_idx].code.size());
            chunk_fns[c_idx] = reinterpret_cast<JitFunc>(dst);
        }
        exec_arena.finalize();
    }

    // 7. Precompute mix64(t * O + j) digest weights
    std::vector<uint64_t> weights((size_t)T * O);
    for (int t = 0; t < T; t++) {
        uint64_t base = (uint64_t)t * (uint64_t)O;
        for (int j = 0; j < O; j++) weights[(size_t)t * O + j] = mix64(base + (uint64_t)j);
    }

    const int totalSlots = warm_spill_base + max_warm;
    const int numBatches = (M + 255) / 256;
    const int useThreads = std::min(numBatches, omp_get_max_threads());

    // Helper lambda to extract 256 h-bit addresses from buf slots using BMI2 _pdep_u64!
    auto extract_addrs_256 = [](const Vec256* buf, const int* sel_slots, int h, uint8_t out_addr[4][64]) {
        uint64_t bit_words[10][4];
        for (int lv = 0; lv < h; lv++) {
            _mm256_storeu_si256(reinterpret_cast<__m256i*>(bit_words[lv]), buf[sel_slots[lv]].v);
        }
        for (int sub = 0; sub < 4; sub++) {
            uint64_t* dst64 = reinterpret_cast<uint64_t*>(out_addr[sub]);
            for (int g = 0; g < 8; g++) {
                uint64_t packed = 0;
                int shift = g * 8;
                for (int lv = 0; lv < h; lv++) {
                    uint64_t byte_val = (bit_words[lv][sub] >> shift) & 0xFFULL;
                    packed |= _pdep_u64(byte_val, 0x0101010101010101ULL) << lv;
                }
                dst64[g] = packed;
            }
        }
    };

    #pragma omp parallel num_threads(useThreads) if(numBatches > 1)
    {
        Vec256* buf = static_cast<Vec256*>(_aligned_malloc((size_t)totalSlots * sizeof(Vec256), 64));
        std::vector<uint64_t> reg_file;
        if (rf.active) reg_file.resize((size_t)256 * rf.R, 0ULL);

        Vec256 H_plane[64];
        const __m256i zero = _mm256_setzero_si256();
        const __m256i ones = _mm256_set1_epi64x(-1LL);

        #pragma omp for schedule(static)
        for (int b = 0; b < numBatches; b++) {
            int m0 = b * 256;
            int cnt = std::min(256, M - m0);

            uint64_t rng[256];
            for (int lane = 0; lane < cnt; lane++) rng[lane] = mix64(c.seed ^ (uint64_t)(m0 + lane));
            for (int lane = cnt; lane < 256; lane++) rng[lane] = 0;

            buf[0].v = zero;
            buf[1].v = ones;
            for (int i = 0; i < I + F + numRfPseudoInputs; i++) buf[PI_SLOT_BASE + i].v = zero;
            if (rf.active) std::fill(reg_file.begin(), reg_file.end(), 0ULL);
            for (int bit = 0; bit < 64; bit++) H_plane[bit].v = zero;

            const int ff_slot_base = PI_SLOT_BASE + I;

            for (int t = 0; t < T; t++) {
                // Step 1: Primary Inputs
                alignas(32) uint64_t blk[4][64];
                for (int sub = 0; sub < 4; sub++) {
                    int base_lane = sub * 64;
                    if (base_lane < cnt) {
                        int lim = std::min(64, cnt - base_lane);
                        for (int l = 0; l < lim; l++) blk[sub][l] = splitmix64_next(&rng[base_lane + l]);
                        for (int l = lim; l < 64; l++) blk[sub][l] = 0;
                        transpose64x64(blk[sub]);
                    } else {
                        std::memset(blk[sub], 0, sizeof(blk[sub]));
                    }
                }
                int pi_lim = std::min(I, 64);
                for (int i = 0; i < pi_lim; i++) {
                    buf[PI_SLOT_BASE + i].v = _mm256_set_epi64x(
                        (long long)blk[3][i], (long long)blk[2][i],
                        (long long)blk[1][i], (long long)blk[0][i]
                    );
                }
                for (int i = pi_lim; i < I; i++) buf[PI_SLOT_BASE + i].v = zero;

                // Step 1b: Evaluate RegFile Read Ports (for t > 0; at t == 0 all FFs == 0 so already zero!)
                if (rf.active && t > 0) {
                    const int R = rf.R, W = rf.W;
                    // Sync any directly-read RegFile FFs into buf[ff_slot_base + f]
                    for (int f : rf.direct_ff_indices) {
                        int r_idx = f / W, bit_idx = f % W;
                        uint64_t words[4] = {0, 0, 0, 0};
                        for (int sub = 0; sub < 4; sub++) {
                            const uint64_t* rp = &reg_file[(size_t)(sub * 64) * R + r_idx];
                            uint64_t m = 0;
                            for (int l = 0; l < 64; l++) {
                                m |= ((rp[(size_t)l * R] >> bit_idx) & 1ULL) << l;
                            }
                            words[sub] = m;
                        }
                        buf[ff_slot_base + f].v = _mm256_loadu_si256(reinterpret_cast<const __m256i*>(words));
                    }

                    // Evaluate ReadGroups!
                    alignas(64) uint8_t raddrs[4][64];
                    alignas(32) uint64_t rd_blk[4][64];
                    for (const auto& grp : rf.read_groups) {
                        extract_addrs_256(buf, grp.sel_slots, grp.h, raddrs);
                        if (grp.full_word) {
                            for (int sub = 0; sub < 4; sub++) {
                                const uint8_t* ad = raddrs[sub];
                                const uint64_t* rf_sub = &reg_file[(size_t)(sub * 64) * R + grp.r_base];
                                for (int l = 0; l < 64; l++) {
                                    rd_blk[sub][l] = rf_sub[(size_t)l * R + ad[l]];
                                }
                                transpose64x64(rd_blk[sub]);
                            }
                            for (int bit = 0; bit < W; bit++) {
                                buf[grp.full_slot_base + bit].v = _mm256_set_epi64x(
                                    (long long)rd_blk[3][bit], (long long)rd_blk[2][bit],
                                    (long long)rd_blk[1][bit], (long long)rd_blk[0][bit]
                                );
                            }
                        } else {
                            // Partial tapped subtree: gather the 256 words once, extract only needed bits!
                            uint64_t gathered[4][64];
                            for (int sub = 0; sub < 4; sub++) {
                                const uint8_t* ad = raddrs[sub];
                                const uint64_t* rf_sub = &reg_file[(size_t)(sub * 64) * R + grp.r_base];
                                for (int l = 0; l < 64; l++) gathered[sub][l] = rf_sub[(size_t)l * R + ad[l]];
                            }
                            for (const auto& bt : grp.bit_targets) {
                                int bit = bt.first, pslot = bt.second;
                                uint64_t out_w[4];
                                for (int sub = 0; sub < 4; sub++) {
                                    uint64_t m = 0;
                                    for (int l = 0; l < 64; l++) m |= ((gathered[sub][l] >> bit) & 1ULL) << l;
                                    out_w[sub] = m;
                                }
                                buf[pslot].v = _mm256_loadu_si256(reinterpret_cast<const __m256i*>(out_w));
                            }
                        }
                    }
                }

                // Step 2: Run JIT-compiled chunks + direct copies
                for (int c_idx = 0; c_idx < numChunks; c_idx++) {
                    chunk_fns[c_idx](buf);
                }
                for (const auto& dc : direct_copies) {
                    int u = dc.second >> 1, inv = dc.second & 1;
                    int src_slot = (u == 0) ? 0 : ((PI_SLOT_BASE - 1) + u);
                    __m256i v = buf[src_slot].v;
                    if (inv) v = _mm256_xor_si256(v, ones);
                    buf[dc.first].v = v;
                }

                // Step 3: Accumulate Primary Outputs using 4-wide Four-Russians
                const uint64_t* w_row = &weights[(size_t)t * O];
                int j = 0;
                for (; j + 4 <= O; j += 4) {
                    __m256i comb[16];
                    comb[0] = zero;
                    __m256i v0 = buf[out_base + j].v;
                    __m256i v1 = buf[out_base + j + 1].v;
                    __m256i v2 = buf[out_base + j + 2].v;
                    __m256i v3 = buf[out_base + j + 3].v;
                    comb[1] = v0;
                    comb[2] = v1;
                    comb[3] = _mm256_xor_si256(v0, v1);
                    comb[4] = v2;
                    comb[5] = _mm256_xor_si256(comb[1], v2);
                    comb[6] = _mm256_xor_si256(comb[2], v2);
                    comb[7] = _mm256_xor_si256(comb[3], v2);
                    comb[8] = v3;
                    for (int m = 1; m < 8; m++) comb[8 + m] = _mm256_xor_si256(comb[m], v3);

                    uint64_t w0 = w_row[j], w1 = w_row[j + 1], w2 = w_row[j + 2], w3 = w_row[j + 3];
                    for (int bit = 0; bit < 64; bit++) {
                        int idx = (int)((w0 & 1) | ((w1 & 1) << 1) | ((w2 & 1) << 2) | ((w3 & 1) << 3));
                        H_plane[bit].v = _mm256_xor_si256(H_plane[bit].v, comb[idx]);
                        w0 >>= 1; w1 >>= 1; w2 >>= 1; w3 >>= 1;
                    }
                }
                for (; j < O; j++) {
                    __m256i vj = buf[out_base + j].v;
                    uint64_t w = w_row[j];
                    for (int bit = 0; bit < 64; bit++) {
                        if ((w >> bit) & 1ULL) H_plane[bit].v = _mm256_xor_si256(H_plane[bit].v, vj);
                    }
                }

                // Step 4: Update Flip-Flops (not needed after the final cycle T - 1!)
                if (t + 1 < T) {
                    if (numStdFfs > 0) {
                        std::memcpy(&buf[ff_slot_base + ff_start_idx], &buf[next_ff_base], (size_t)numStdFfs * sizeof(Vec256));
                    }
                    if (rf.active) {
                        const int R = rf.R, W = rf.W, P = rf.P, K = rf.K;
                        alignas(64) uint8_t waddrs[4][64];
                        alignas(32) uint64_t wd_sub[64];
                        for (int p = 0; p < P; p++) {
                            uint64_t we_words[4];
                            _mm256_storeu_si256(reinterpret_cast<__m256i*>(we_words), buf[rf.we_slots[p]].v);
                            if ((we_words[0] | we_words[1] | we_words[2] | we_words[3]) == 0ULL) continue;

                            extract_addrs_256(buf, rf.waddr_slots[p].data(), K, waddrs);
                            const int wslot0 = rf.wdata_slot_base[p];
                            alignas(32) uint64_t wdata_words[64][4];
                            for (int bit = 0; bit < W; bit++) {
                                _mm256_storeu_si256(reinterpret_cast<__m256i*>(wdata_words[bit]), buf[wslot0 + bit].v);
                            }

                            for (int sub = 0; sub < 4; sub++) {
                                uint64_t mask = we_words[sub];
                                if (mask == 0ULL) continue;
                                for (int bit = 0; bit < W; bit++) wd_sub[bit] = wdata_words[bit][sub];
                                for (int bit = W; bit < 64; bit++) wd_sub[bit] = 0ULL;
                                transpose64x64(wd_sub);
                                uint64_t* rf_sub = &reg_file[(size_t)(sub * 64) * R];
                                while (mask) {
                                    int l = __builtin_ctzll(mask);
                                    rf_sub[(size_t)l * R + waddrs[sub][l]] = wd_sub[l];
                                    mask &= mask - 1ULL;
                                }
                            }
                        }
                    }
                }
            }

            // Transpose H_plane[0..63] back into per-stimulus uint64_t digests
            alignas(32) uint64_t out_blk[4][64];
            for (int bit = 0; bit < 64; bit++) {
                uint64_t tmp[4];
                _mm256_storeu_si256(reinterpret_cast<__m256i*>(tmp), H_plane[bit].v);
                out_blk[0][bit] = tmp[0];
                out_blk[1][bit] = tmp[1];
                out_blk[2][bit] = tmp[2];
                out_blk[3][bit] = tmp[3];
            }
            for (int sub = 0; sub < 4; sub++) {
                int base_lane = sub * 64;
                if (base_lane < cnt) {
                    transpose64x64(out_blk[sub]);
                    int lim = std::min(64, cnt - base_lane);
                    for (int l = 0; l < lim; l++) ans[m0 + base_lane + l] = out_blk[sub][l];
                }
            }
        }

        _aligned_free(buf);
    }

    return ans;
}
