#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <immintrin.h>
#include <omp.h>
#include <vector>
#include <windows.h>

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

namespace {

enum OpType : uint8_t {
    OP_AND = 0,
    OP_OR = 1,
    OP_XOR = 2,
    OP_ANDN = 3,
    OP_MUX_NN = 4,
    OP_MUX_NI = 5,
};

struct ExecGate {
    uint8_t op;
    int dst;
    int s0, s1, s2;
};

struct SimpGate {
    uint8_t op;
    int s0, s1, s2;
};

struct FlatCseTable {
    struct Entry {
        uint32_t fp;
        int32_t idx;
    };
    std::vector<Entry> tab;
    uint32_t mask = 0;

    void init(size_t expected) {
        size_t cap = 64;
        while (cap < expected * 2) cap <<= 1;
        tab.resize(cap);
        memset(tab.data(), -1, cap * sizeof(Entry));
        mask = (uint32_t)(cap - 1);
    }

    static inline uint64_t hash_key(uint8_t op, int s0, int s1, int s2) {
        uint64_t k1 = ((uint64_t)op << 48) | (uint64_t)(uint32_t)s0;
        uint64_t k2 = ((uint64_t)(uint32_t)s1 << 32) | (uint64_t)(uint32_t)s2;
        uint64_t h = k1 * 0x9E3779B97F4A7C15ULL ^ (k2 * 0xBF58476D1CE4E5B9ULL);
        h ^= h >> 30;
        h *= 0xBF58476D1CE4E5B9ULL;
        h ^= h >> 27;
        h *= 0x94D049BB133111EBULL;
        return h ^ (h >> 31);
    }

    inline int find_or_insert(const std::vector<SimpGate>& sgates, uint8_t op, int s0, int s1, int s2, bool& inserted) {
        uint64_t h = hash_key(op, s0, s1, s2);
        uint32_t fp = (uint32_t)(h >> 32);
        uint32_t pos = (uint32_t)h & mask;
        while (true) {
            Entry& e = tab[pos];
            if (e.idx < 0) {
                e.fp = fp;
                e.idx = (int32_t)sgates.size();
                inserted = true;
                return e.idx;
            }
            if (e.fp == fp) {
                const SimpGate& g = sgates[e.idx];
                if (g.op == op && g.s0 == s0 && g.s1 == s1 && g.s2 == s2) {
                    inserted = false;
                    return e.idx;
                }
            }
            pos = (pos + 1) & mask;
        }
    }
};

struct GateFFTarget {
    int ff_idx;
    uint8_t inv;
};

struct DirectFF {
    int ff_idx;
    int src_slot;
    uint8_t inv;
};

struct RFSelSource {
    uint8_t is_ff;
    int buf_idx;
};

struct RFGatherTap {
    uint8_t bit;
    int sig_slot;
};

struct RFGatherGroup {
    uint8_t mask;
    uint8_t base;
    uint8_t half;
    uint32_t tap_beg;
    uint32_t tap_end;
};

struct RFPortRuntime {
    std::vector<RFSelSource> sels;
    std::vector<int> full_sig_slot;
    bool has_full = false;
};

struct RFRuntime {
    bool active = false;
    int N = 0, W = 0, D = 0, stride_w = 1;
    std::vector<int> ff_idx_flat; // size N * W -> ff_cur index
    std::vector<RFPortRuntime> ports;
    std::vector<int> port_grp_head;
    std::vector<RFGatherGroup> port_grps;
    std::vector<RFGatherTap> grp_taps;
};

struct CompiledCircuit {
    int num_pi = 0;
    int num_rf_outs = 0;
    int num_ff = 0;
    int num_slots = 0;
    int num_sig_buf_slots = 2;
    std::vector<int> pi_orig_idx;
    std::vector<int> out_slot;
    std::vector<uint8_t> out_inv;
    std::vector<uint8_t> out_is_ff;
    std::vector<int> out_buf_idx;
    std::vector<ExecGate> gates;
    std::vector<uint8_t> gate_die_mask;
    std::vector<int> gate_ff_head;
    std::vector<GateFFTarget> gate_ff_target;
    std::vector<DirectFF> direct_ffs;
    std::vector<uint8_t> slot_is_pinned_end;
    RFRuntime rf;
};

struct RFDetectNode {
    int port_idx = -1;
    uint8_t depth = 0;
    uint8_t base = 0;
    uint8_t bit = 0;
};

struct RFDetectResult {
    bool active = false;
    int N = 0, W = 0, D = 0;
    std::vector<int> ff_orig_flat; // size N * W -> orig FF id
    std::vector<std::vector<int>> port_sels; // [P][D] -> orig signal id (< gate_base)
    std::vector<RFDetectNode> gate_tag; // size G
};

static RFDetectResult detect_register_file(const Circuit& c) {
    RFDetectResult res;
    if (c.F < 64 || c.G < 512) return res;
    const int F = c.F, G = c.G;
    const int ff_base = c.I + 2;
    const int gate_base = c.I + c.F + 2;

    // 1. Identify FFs driven by write-enable MUX chain ending at self along in1
    struct WChain {
        int f;
        uint64_t hash;
        std::vector<int> sels;
    };
    std::vector<WChain> wchains;
    wchains.reserve(F);
    for (int f = 0; f < F; f++) {
        int cur = c.d[f];
        std::vector<int> sels;
        bool ok = true;
        while (cur >= gate_base) {
            int g = cur - gate_base;
            if (c.type[g] != 7) { ok = false; break; }
            sels.push_back(c.in0[g]);
            cur = c.in1[g];
            if (sels.size() > 64) { ok = false; break; }
        }
        if (ok && cur == ff_base + f && sels.size() >= 4) {
            uint64_t h = sels.size();
            for (int s : sels) h = h * 0x9E3779B97F4A7C15ULL ^ (uint64_t)s;
            wchains.push_back({f, h, std::move(sels)});
        }
    }
    if (wchains.size() < 256) return res;

    std::vector<int> w_order(wchains.size());
    for (size_t i = 0; i < wchains.size(); i++) w_order[i] = (int)i;
    std::sort(w_order.begin(), w_order.end(), [&](int a, int b) {
        if (wchains[a].sels.size() != wchains[b].sels.size()) return wchains[a].sels.size() < wchains[b].sels.size();
        if (wchains[a].hash != wchains[b].hash) return wchains[a].hash < wchains[b].hash;
        if (wchains[a].sels != wchains[b].sels) return wchains[a].sels < wchains[b].sels;
        return wchains[a].f < wchains[b].f;
    });

    // Group identical write-select chains -> candidate words
    struct WGroup { int w; int cnt; std::vector<int> ffs; };
    std::vector<WGroup> groups;
    for (size_t i = 0; i < w_order.size();) {
        size_t j = i + 1;
        const auto& sa = wchains[w_order[i]].sels;
        while (j < w_order.size()) {
            const auto& wc = wchains[w_order[j]];
            if (wc.sels.size() != sa.size() || wc.hash != wchains[w_order[i]].hash || wc.sels != sa) break;
            j++;
        }
        int cnt = (int)(j - i);
        if (cnt >= 8 && cnt <= 64) {
            WGroup wg;
            wg.w = cnt;
            wg.cnt = cnt;
            wg.ffs.reserve(cnt);
            for (size_t k = i; k < j; k++) wg.ffs.push_back(wchains[w_order[k]].f);
            groups.push_back(std::move(wg));
        }
        i = j;
    }
    if (groups.empty()) return res;

    // Pick dominant width W whose count N is power of 2 in [32, 256]
    int hist_w[65] = {};
    for (const auto& g : groups) hist_w[g.w]++;
    int best_W = -1, best_N = 0;
    for (int w = 8; w <= 64; w++) {
        int n = hist_w[w];
        if (n >= 32 && n <= 256 && (n & (n - 1)) == 0 && n * w > best_N * std::max(0, best_W)) {
            best_W = w;
            best_N = n;
        }
    }
    if (best_W < 0) return res;

    int D = 0;
    while ((1 << D) < best_N) D++;
    const int N = best_N, W = best_W;

    std::vector<int> ff_word(F, -1);
    int wid = 0;
    for (const auto& wg : groups) {
        if (wg.w != W) continue;
        for (int f : wg.ffs) ff_word[f] = wid;
        wid++;
    }

    // 2. Bottom-up uniform-selector binary MUX tree detection (d = 1..D, selectors < gate_base)
    struct SeqEntry { int parent; int sel; };
    std::vector<SeqEntry> seq_nodes;
    seq_nodes.push_back({-1, -1}); // id 0 = empty
    struct PairHashTab {
        std::vector<uint64_t> keys;
        std::vector<int> vals;
        uint32_t mask = 0;
        void init(size_t cap) {
            keys.assign(cap, ~0ULL);
            vals.assign(cap, -1);
            mask = (uint32_t)(cap - 1);
        }
        int intern(std::vector<SeqEntry>& nodes, int parent, int sel) {
            uint64_t key = ((uint64_t)(uint32_t)parent << 32) | (uint32_t)sel;
            uint64_t h = key * 0x9E3779B97F4A7C15ULL;
            h ^= h >> 30;
            uint32_t pos = (uint32_t)h & mask;
            while (true) {
                if (vals[pos] < 0) {
                    int id = (int)nodes.size();
                    nodes.push_back({parent, sel});
                    keys[pos] = key;
                    vals[pos] = id;
                    return id;
                }
                if (keys[pos] == key) return vals[pos];
                pos = (pos + 1) & mask;
            }
        }
    };
    PairHashTab pair_tab;
    pair_tab.init(1 << 17); // 128k slots covers up to 64k distinct selector sequences cleanly

    std::vector<uint8_t> tdepth(G, 0);
    std::vector<int> seq_id(G, 0);
    std::vector<int> gate_mux;
    gate_mux.reserve(G);

    for (int g = 0; g < G; g++) {
        if (c.type[g] != 7 || c.in0[g] >= gate_base) continue;
        int i1 = c.in1[g], i2 = c.in2[g];
        if (i1 >= ff_base && i1 < gate_base && i2 >= ff_base && i2 < gate_base) {
            int f1 = i1 - ff_base, f2 = i2 - ff_base;
            if (ff_word[f1] >= 0 && ff_word[f2] >= 0 && ff_word[f1] != ff_word[f2]) {
                tdepth[g] = 1;
                seq_id[g] = pair_tab.intern(seq_nodes, 0, c.in0[g]);
            }
        } else if (i1 >= gate_base && i2 >= gate_base) {
            gate_mux.push_back(g);
        }
    }

    std::vector<int> next_gm;
    next_gm.reserve(gate_mux.size());
    for (int d = 2; d <= D; d++) {
        bool any = false;
        next_gm.clear();
        for (int g : gate_mux) {
            int g1 = c.in1[g] - gate_base, g2 = c.in2[g] - gate_base;
            if (tdepth[g1] == d - 1 && tdepth[g2] == d - 1) {
                if (seq_id[g1] == seq_id[g2]) {
                    tdepth[g] = (uint8_t)d;
                    seq_id[g] = pair_tab.intern(seq_nodes, seq_id[g1], c.in0[g]);
                    any = true;
                }
            } else if ((tdepth[g1] == 0 || tdepth[g1] >= d) && (tdepth[g2] == 0 || tdepth[g2] >= d)) {
                next_gm.push_back(g);
            }
        }
        gate_mux.swap(next_gm);
        if (!any) break;
    }

    // 3. Collect and verify full depth-D read trees
    std::vector<std::pair<int, int>> full_roots;
    for (int g = 0; g < G; g++) {
        if (tdepth[g] == D) full_roots.push_back({seq_id[g], g});
    }
    if ((int)full_roots.size() < W) return res;
    std::sort(full_roots.begin(), full_roots.end());

    auto get_leaves = [&](int root_g, int dep, std::vector<int>& out_lv) {
        out_lv.clear();
        struct Item { int node; int d; };
        std::vector<Item> stk;
        stk.reserve(D + 2);
        stk.push_back({gate_base + root_g, dep});
        while (!stk.empty()) {
            Item it = stk.back();
            stk.pop_back();
            if (it.d == 0) {
                out_lv.push_back(it.node - ff_base);
            } else {
                int g = it.node - gate_base;
                stk.push_back({c.in2[g], it.d - 1});
                stk.push_back({c.in1[g], it.d - 1});
            }
        }
    };

    std::vector<int> ff_canon_word(F, -1);
    std::vector<int> ff_bit(F, -1);
    std::vector<int> word_bit_to_ff(N * W, -1);
    bool base_established = false;

    std::vector<int> lv;
    lv.reserve(N);

    size_t idx = 0;
    while (idx < full_roots.size()) {
        int sid = full_roots[idx].first;
        size_t jdx = idx + 1;
        while (jdx < full_roots.size() && full_roots[jdx].first == sid) jdx++;
        if (!base_established && (int)(jdx - idx) == W) {
            std::vector<int> canon_map(N, -1);
            get_leaves(full_roots[idx].second, D, lv);
            bool ok0 = ((int)lv.size() == N);
            for (int r = 0; r < N && ok0; r++) {
                int ow = ff_word[lv[r]];
                if (ow < 0 || canon_map[ow] >= 0) ok0 = false;
                else canon_map[ow] = r;
            }
            if (ok0) {
                for (int f = 0; f < F; f++) {
                    if (ff_word[f] >= 0) ff_canon_word[f] = canon_map[ff_word[f]];
                }
                bool ok_all = true;
                for (size_t b = 0; b < (size_t)W && ok_all; b++) {
                    get_leaves(full_roots[idx + b].second, D, lv);
                    for (int r = 0; r < N; r++) {
                        int f = lv[r];
                        if (ff_canon_word[f] != r || ff_bit[f] >= 0) { ok_all = false; break; }
                        ff_bit[f] = (int)b;
                        word_bit_to_ff[r * W + (int)b] = f;
                    }
                }
                if (ok_all) {
                    base_established = true;
                    break;
                }
                std::fill(ff_canon_word.begin(), ff_canon_word.end(), -1);
                std::fill(ff_bit.begin(), ff_bit.end(), -1);
                std::fill(word_bit_to_ff.begin(), word_bit_to_ff.end(), -1);
            }
        }
        idx = jdx;
    }
    if (!base_established) return res;

    // 4. Verify every port group against word_bit_to_ff & tag all internal nodes top-down
    res.gate_tag.resize(G);
    idx = 0;
    while (idx < full_roots.size()) {
        int sid = full_roots[idx].first;
        size_t jdx = idx + 1;
        while (jdx < full_roots.size() && full_roots[jdx].first == sid) jdx++;

        int port_idx = -1;
        for (size_t k = idx; k < jdx; k++) {
            int root_g = full_roots[k].second;
            get_leaves(root_g, D, lv);
            int col = (lv.size() == (size_t)N) ? ff_bit[lv[0]] : -1;
            if (col < 0 || ff_canon_word[lv[0]] != 0) continue;
            bool ok = true;
            for (int r = 0; r < N; r++) {
                if (lv[r] != word_bit_to_ff[r * W + col]) { ok = false; break; }
            }
            if (!ok) continue;

            if (port_idx < 0) {
                port_idx = (int)res.port_sels.size();
                std::vector<int> sels(D);
                int cur_s = sid;
                for (int d = D - 1; d >= 0; d--) {
                    sels[d] = seq_nodes[cur_s].sel;
                    cur_s = seq_nodes[cur_s].parent;
                }
                res.port_sels.push_back(std::move(sels));
            }

            // Walk top-down and tag untagged read-tree nodes
            struct TItem { int g; uint8_t d; uint8_t base; };
            std::vector<TItem> tstk;
            tstk.reserve(N * 2);
            if (res.gate_tag[root_g].port_idx < 0) {
                res.gate_tag[root_g] = {port_idx, (uint8_t)D, 0, (uint8_t)col};
                tstk.push_back({root_g, (uint8_t)D, 0});
            }
            while (!tstk.empty()) {
                TItem it = tstk.back();
                tstk.pop_back();
                if (it.d <= 1) continue;
                int g1 = c.in1[it.g] - gate_base;
                int g2 = c.in2[it.g] - gate_base;
                uint8_t nd = (uint8_t)(it.d - 1);
                uint8_t b1 = it.base;
                uint8_t b2 = (uint8_t)(it.base + (1u << nd));
                if (res.gate_tag[g1].port_idx < 0) {
                    res.gate_tag[g1] = {port_idx, nd, b1, (uint8_t)col};
                    tstk.push_back({g1, nd, b1});
                }
                if (res.gate_tag[g2].port_idx < 0) {
                    res.gate_tag[g2] = {port_idx, nd, b2, (uint8_t)col};
                    tstk.push_back({g2, nd, b2});
                }
            }
        }
        idx = jdx;
    }

    if (res.port_sels.empty()) {
        res.gate_tag.clear();
        return res;
    }
    res.active = true;
    res.N = N;
    res.W = W;
    res.D = D;
    res.ff_orig_flat = std::move(word_bit_to_ff);
    return res;
}

CompiledCircuit compile_circuit(const Circuit& c, int rf_min_d = -1) {
    const int I = c.I, F = c.F, G = c.G, O = c.O;
    const int ff_base = I + 2;
    const int gate_base = I + F + 2;
    const int total_orig = gate_base + G;

    RFDetectResult rfd = detect_register_file(c);
    if (rf_min_d < 0 && rfd.active) rf_min_d = (rfd.D <= 6) ? rfd.D : 5;
    int rf_cand_max = 0;
    if (rfd.active) {
        for (int g = 0; g < G; g++) {
            if (rfd.gate_tag[g].port_idx >= 0 && rfd.gate_tag[g].depth >= rf_min_d) rf_cand_max++;
        }
        if (rf_cand_max == 0) rfd.active = false;
    }

    // 1. Fused COI + iterative postorder DFS + literal simplification + Flat CSE
    // Signal ID layout: 0=const0, 1..I=PIs, 1+I..I+F=FFs, s_rf_base..sbase-1=RF outputs, sbase..=sgates
    const int s_rf_base = 1 + I + F;
    const int sbase = s_rf_base + rf_cand_max;
    std::vector<int> remap(total_orig, 0);
    remap[0] = 0;
    remap[1] = 1;
    for (int i = 0; i < I; i++) remap[2 + i] = (1 + i) << 1;
    for (int f = 0; f < F; f++) remap[ff_base + f] = (1 + I + f) << 1;

    struct RFOutSpec { int port_idx; uint8_t depth; uint8_t base; uint8_t bit; };
    std::vector<RFOutSpec> rf_outs;
    std::vector<uint8_t> port_roots_pushed;
    bool rf_ffs_pushed = false;
    if (rfd.active) {
        rf_outs.reserve(4096);
        port_roots_pushed.assign(rfd.port_sels.size(), 0);
    }

    std::vector<SimpGate> sgates;
    sgates.reserve((size_t)G + 16);
    FlatCseTable cse;
    cse.init((size_t)G + 64);

    auto emit_op = [&](uint8_t op, int s0, int s1, int s2) -> int {
        if (op <= OP_XOR && s0 > s1) std::swap(s0, s1);
        bool inserted = false;
        int idx = cse.find_or_insert(sgates, op, s0, s1, s2, inserted);
        if (inserted) sgates.push_back({op, s0, s1, s2});
        return (sbase + idx) << 1;
    };

    auto make_and = [&](int la, int lb) -> int {
        if (la == 0 || lb == 0) return 0;
        if (la == 1) return lb;
        if (lb == 1) return la;
        if (la == lb) return la;
        if (la == (lb ^ 1)) return 0;
        int ia = la & 1, ib = lb & 1;
        int sa = la >> 1, sb = lb >> 1;
        if (ia == 0 && ib == 0) return emit_op(OP_AND, sa, sb, 0);
        if (ia == 1 && ib == 0) return emit_op(OP_ANDN, sa, sb, 0);
        if (ia == 0 && ib == 1) return emit_op(OP_ANDN, sb, sa, 0);
        return emit_op(OP_OR, sa, sb, 0) ^ 1;
    };

    auto make_or = [&](int la, int lb) -> int {
        return make_and(la ^ 1, lb ^ 1) ^ 1;
    };

    auto make_xor = [&](int la, int lb) -> int {
        if (la == 0) return lb;
        if (la == 1) return lb ^ 1;
        if (lb == 0) return la;
        if (lb == 1) return la ^ 1;
        if (la == lb) return 0;
        if (la == (lb ^ 1)) return 1;
        int inv = (la ^ lb) & 1;
        return emit_op(OP_XOR, la >> 1, lb >> 1, 0) ^ inv;
    };

    auto make_mux = [&](int ls, int la, int lb) -> int {
        if (ls == 0) return la;
        if (ls == 1) return lb;
        if (la == lb) return la;
        if (la == (lb ^ 1)) return make_xor(ls, la);
        if (la == 0) return make_and(ls, lb);
        if (la == 1) return make_or(ls ^ 1, lb);
        if (lb == 0) return make_and(ls ^ 1, la);
        if (lb == 1) return make_or(ls, la);
        if ((ls >> 1) == (la >> 1)) {
            if (ls == la) return make_and(ls, lb);
            return make_or(ls ^ 1, lb);
        }
        if ((ls >> 1) == (lb >> 1)) {
            if (ls == lb) return make_or(ls, la);
            return make_and(ls ^ 1, la);
        }
        if (ls & 1) { ls ^= 1; std::swap(la, lb); }
        int inv_out = la & 1;
        if (inv_out) { la ^= 1; lb ^= 1; }
        int ss = ls >> 1, sa = la >> 1, sb = lb >> 1;
        if (lb & 1) return emit_op(OP_MUX_NI, ss, sa, sb) ^ inv_out;
        return emit_op(OP_MUX_NN, ss, sa, sb) ^ inv_out;
    };

    std::vector<uint8_t> g_vis(G, 0);
    std::vector<uint8_t> ff_seen(F, 0);
    std::vector<int> roots;
    roots.reserve(F + O + 64);
    for (int x : c.out) roots.push_back(x);

    auto bind_collapsed_rf_gate = [&](int cg) -> bool {
        if (!rfd.active) return false;
        const RFDetectNode& tn = rfd.gate_tag[cg];
        if (tn.port_idx < 0 || tn.depth < rf_min_d) return false;
        g_vis[cg] = 2;
        int id = (int)rf_outs.size();
        rf_outs.push_back({tn.port_idx, tn.depth, tn.base, tn.bit});
        remap[gate_base + cg] = (s_rf_base + id) << 1;
        if (!port_roots_pushed[tn.port_idx]) {
            port_roots_pushed[tn.port_idx] = 1;
            for (int sel : rfd.port_sels[tn.port_idx]) roots.push_back(sel);
        }
        if (!rf_ffs_pushed) {
            rf_ffs_pushed = true;
            for (int f : rfd.ff_orig_flat) roots.push_back(ff_base + f);
        }
        return true;
    };

    std::vector<uint32_t> dfs_g;
    dfs_g.reserve(4096);

    for (size_t ri = 0; ri < roots.size(); ri++) {
        int r = roots[ri];
        if (r >= ff_base && r < gate_base) {
            int f = r - ff_base;
            if (!ff_seen[f]) {
                ff_seen[f] = 1;
                roots.push_back(c.d[f]);
            }
            continue;
        }
        if (r < gate_base) continue;
        int rg = r - gate_base;
        if (g_vis[rg]) continue;
        if (bind_collapsed_rf_gate(rg)) continue;
        g_vis[rg] = 1;
        dfs_g.push_back((uint32_t)rg << 2);
        while (!dfs_g.empty()) {
            uint32_t top = dfs_g.back();
            int g = (int)(top >> 2);
            uint32_t st = top & 3u;
            if (st < 3u) {
                dfs_g.back() = ((uint32_t)g << 2) | (st + 1u);
                int ch = (st == 0u) ? c.in0[g] : (st == 1u ? c.in1[g] : c.in2[g]);
                if (ch >= gate_base) {
                    int cg = ch - gate_base;
                    if (!g_vis[cg]) {
                        if (!bind_collapsed_rf_gate(cg)) {
                            g_vis[cg] = 1;
                            dfs_g.push_back((uint32_t)cg << 2);
                        }
                    }
                } else if (ch >= ff_base) {
                    int cf = ch - ff_base;
                    if (!ff_seen[cf]) {
                        ff_seen[cf] = 1;
                        roots.push_back(c.d[cf]);
                    }
                }
            } else {
                dfs_g.pop_back();
                g_vis[g] = 2;
                uint8_t t = c.type[g];
                int la = remap[c.in0[g]];
                int lb = (t != 6) ? remap[c.in1[g]] : 0;
                int lc = (t == 7) ? remap[c.in2[g]] : 0;
                int res = 0;
                switch (t) {
                    case 0: res = make_and(la, lb); break;
                    case 1: res = make_or(la, lb); break;
                    case 2: res = make_xor(la, lb); break;
                    case 3: res = make_and(la, lb) ^ 1; break;
                    case 4: res = make_or(la, lb) ^ 1; break;
                    case 5: res = make_xor(la, lb) ^ 1; break;
                    case 6: res = la ^ 1; break;
                    case 7: res = make_mux(la, lb, lc); break;
                }
                remap[gate_base + g] = res;
            }
        }
    }

    // 2. Re-run COI on simplified graph (propagating RF reads -> selectors + RF FFs)
    const int SG = (int)sgates.size();
    const int total_simp = sbase + SG;
    std::vector<uint8_t> live_s(total_simp, 0);
    std::vector<int> stk;
    stk.reserve(4096);
    for (int x : c.out) {
        int s = remap[x] >> 1;
        if (s > 0 && !live_s[s]) { live_s[s] = 1; stk.push_back(s); }
    }
    bool rf_live_ffs_marked = false;
    std::vector<uint8_t> port_live_marked(rfd.port_sels.size(), 0);
    while (!stk.empty()) {
        int s = stk.back();
        stk.pop_back();
        if (s >= sbase) {
            const SimpGate& sg = sgates[s - sbase];
            if (sg.s0 > 0 && !live_s[sg.s0]) { live_s[sg.s0] = 1; stk.push_back(sg.s0); }
            if (sg.s1 > 0 && !live_s[sg.s1]) { live_s[sg.s1] = 1; stk.push_back(sg.s1); }
            if (sg.s2 > 0 && !live_s[sg.s2]) { live_s[sg.s2] = 1; stk.push_back(sg.s2); }
        } else if (s >= s_rf_base) {
            int rf_id = s - s_rf_base;
            int pid = rf_outs[rf_id].port_idx;
            if (!port_live_marked[pid]) {
                port_live_marked[pid] = 1;
                for (int sel : rfd.port_sels[pid]) {
                    int ss = remap[sel] >> 1;
                    if (ss > 0 && !live_s[ss]) { live_s[ss] = 1; stk.push_back(ss); }
                }
            }
            if (!rf_live_ffs_marked) {
                rf_live_ffs_marked = true;
                for (int f : rfd.ff_orig_flat) {
                    int sf = 1 + I + f;
                    if (!live_s[sf]) { live_s[sf] = 1; stk.push_back(sf); }
                }
            }
        } else if (s >= 1 + I) {
            int f = s - (1 + I);
            int ds = remap[c.d[f]] >> 1;
            if (ds > 0 && !live_s[ds]) { live_s[ds] = 1; stk.push_back(ds); }
        }
    }

    // 3. Levels directly in forward pass (sgates is already topologically ordered!) + Sethi-Ullman DFS postorder
    std::vector<int> lvl(SG, 0);
    for (int k = 0; k < SG; k++) {
        if (!live_s[sbase + k]) continue;
        const SimpGate& sg = sgates[k];
        int l = 0;
        if (sg.s0 >= sbase && lvl[sg.s0 - sbase] + 1 > l) l = lvl[sg.s0 - sbase] + 1;
        if (sg.s1 >= sbase && lvl[sg.s1 - sbase] + 1 > l) l = lvl[sg.s1 - sbase] + 1;
        if (sg.s2 >= sbase && lvl[sg.s2 - sbase] + 1 > l) l = lvl[sg.s2 - sbase] + 1;
        lvl[k] = l;
    }

    std::vector<std::pair<int, int>> sinks;
    sinks.reserve(F + O);
    for (int f = 0; f < F; f++) {
        if (!live_s[1 + I + f]) continue;
        int ds = remap[c.d[f]] >> 1;
        if (ds >= sbase) sinks.push_back({lvl[ds - sbase], ds - sbase});
    }
    for (int x : c.out) {
        int os = remap[x] >> 1;
        if (os >= sbase) sinks.push_back({lvl[os - sbase], os - sbase});
    }
    std::sort(sinks.begin(), sinks.end());

    std::vector<uint8_t> vis(SG, 0);
    std::vector<int> order;
    order.reserve(SG);
    struct Frame { int u, st; };
    std::vector<Frame> dfs;
    dfs.reserve(4096);
    for (auto [l, root] : sinks) {
        if (vis[root]) continue;
        dfs.push_back({root, 0});
        while (!dfs.empty()) {
            Frame& top = dfs.back();
            int u = top.u;
            if (vis[u]) { dfs.pop_back(); continue; }
            int st = top.st++;
            const SimpGate& sg = sgates[u];
            int ch[3], nc = 0;
            if (sg.s0 >= sbase) ch[nc++] = sg.s0 - sbase;
            if (sg.s1 >= sbase) ch[nc++] = sg.s1 - sbase;
            if (sg.s2 >= sbase) ch[nc++] = sg.s2 - sbase;
            if (nc == 2 && lvl[ch[0]] < lvl[ch[1]]) std::swap(ch[0], ch[1]);
            if (nc == 3) {
                if (lvl[ch[0]] < lvl[ch[1]]) std::swap(ch[0], ch[1]);
                if (lvl[ch[1]] < lvl[ch[2]]) std::swap(ch[1], ch[2]);
                if (lvl[ch[0]] < lvl[ch[1]]) std::swap(ch[0], ch[1]);
            }
            if (st < nc) {
                if (!vis[ch[st]]) dfs.push_back({ch[st], 0});
            } else {
                vis[u] = 1;
                order.push_back(u);
                dfs.pop_back();
            }
        }
    }

    // 4. Slot allocation (slot 0=const0, slot 1=const1, 2..=PIs, ..=RF outs, ..=FFs, ..=gates) + FF target attachment
    CompiledCircuit cc;
    std::vector<int> sig_slot(total_simp, -1);
    sig_slot[0] = 0;
    int next_fixed = 2; // slot 1 reserved for sig[1] = all-ones
    for (int i = 0; i < I; i++) {
        if (live_s[1 + i]) {
            cc.pi_orig_idx.push_back(i);
            sig_slot[1 + i] = next_fixed++;
        }
    }
    cc.num_pi = (int)cc.pi_orig_idx.size();

    if (rfd.active && rf_live_ffs_marked) {
        cc.rf.active = true;
        cc.rf.N = rfd.N;
        cc.rf.W = rfd.W;
        cc.rf.D = rfd.D;
        cc.rf.stride_w = (rfd.W > 32) ? 2 : 1;

        const int P_orig = (int)rfd.port_sels.size();
        std::vector<int> orig_to_live_port(P_orig, -1);
        for (int p = 0; p < P_orig; p++) {
            if (!port_live_marked[p]) continue;
            orig_to_live_port[p] = (int)cc.rf.ports.size();
            RFPortRuntime pr;
            pr.full_sig_slot.assign(rfd.W, -1);
            cc.rf.ports.push_back(std::move(pr));
        }
        const int P_live = (int)cc.rf.ports.size();
        struct TmpTap { int p; uint8_t mask; uint8_t base; uint8_t bit; int sig_slot; };
        std::vector<TmpTap> tmp_taps;
        for (size_t id = 0; id < rf_outs.size(); id++) {
            if (!live_s[s_rf_base + (int)id]) continue;
            int slot = next_fixed++;
            sig_slot[s_rf_base + (int)id] = slot;
            const auto& sp = rf_outs[id];
            int lp = orig_to_live_port[sp.port_idx];
            if (sp.depth == rfd.D && sp.base == 0) {
                cc.rf.ports[lp].full_sig_slot[sp.bit] = slot;
                cc.rf.ports[lp].has_full = true;
            } else {
                tmp_taps.push_back({lp, (uint8_t)((1u << sp.depth) - 1u), sp.base, sp.bit, slot});
            }
        }
        cc.num_rf_outs = next_fixed - (2 + cc.num_pi);
        for (auto& t : tmp_taps) t.mask = t.mask; // keep fields
        std::sort(tmp_taps.begin(), tmp_taps.end(), [&](const TmpTap& a, const TmpTap& b) {
            uint8_t ha = (cc.rf.stride_w == 2) ? (a.bit >> 5) : 0;
            uint8_t hb = (cc.rf.stride_w == 2) ? (b.bit >> 5) : 0;
            if (a.p != b.p) return a.p < b.p;
            if (a.mask != b.mask) return a.mask < b.mask;
            if (a.base != b.base) return a.base < b.base;
            if (ha != hb) return ha < hb;
            return a.bit < b.bit;
        });
        cc.rf.port_grp_head.assign(P_live + 1, 0);
        cc.rf.grp_taps.reserve(tmp_taps.size());
        size_t ti = 0;
        for (int p = 0; p < P_live; p++) {
            cc.rf.port_grp_head[p] = (int)cc.rf.port_grps.size();
            while (ti < tmp_taps.size() && tmp_taps[ti].p == p) {
                uint8_t mk = tmp_taps[ti].mask, bs = tmp_taps[ti].base;
                uint8_t hf = (cc.rf.stride_w == 2) ? (tmp_taps[ti].bit >> 5) : 0;
                uint32_t beg = (uint32_t)cc.rf.grp_taps.size();
                while (ti < tmp_taps.size() && tmp_taps[ti].p == p &&
                       tmp_taps[ti].mask == mk && tmp_taps[ti].base == bs &&
                       ((cc.rf.stride_w == 2) ? (tmp_taps[ti].bit >> 5) : 0) == hf) {
                    cc.rf.grp_taps.push_back({tmp_taps[ti].bit, tmp_taps[ti].sig_slot});
                    ti++;
                }
                cc.rf.port_grps.push_back({mk, bs, hf, beg, (uint32_t)cc.rf.grp_taps.size()});
            }
        }
        cc.rf.port_grp_head[P_live] = (int)cc.rf.port_grps.size();
    }

    std::vector<int> live_ffs;
    live_ffs.reserve(F);
    std::vector<int> orig_ff_to_live(F, -1);
    for (int f = 0; f < F; f++) {
        if (live_s[1 + I + f]) {
            orig_ff_to_live[f] = (int)live_ffs.size();
            live_ffs.push_back(f);
            sig_slot[1 + I + f] = next_fixed++;
        }
    }
    cc.num_ff = (int)live_ffs.size();

    if (cc.rf.active) {
        cc.rf.ff_idx_flat.resize(rfd.ff_orig_flat.size());
        for (size_t i = 0; i < rfd.ff_orig_flat.size(); i++) {
            cc.rf.ff_idx_flat[i] = orig_ff_to_live[rfd.ff_orig_flat[i]];
        }
        const int ff_slot0_tmp = 2 + cc.num_pi + cc.num_rf_outs;
        const int P_orig = (int)rfd.port_sels.size();
        int lp = 0;
        for (int p = 0; p < P_orig; p++) {
            if (!port_live_marked[p]) continue;
            auto& sels = cc.rf.ports[lp++].sels;
            sels.resize(rfd.D);
            for (int d = 0; d < rfd.D; d++) {
                int sel_orig = rfd.port_sels[p][d];
                if (sel_orig == 0) {
                    sels[d] = {0, 0};
                } else if (sel_orig == 1) {
                    sels[d] = {0, 1};
                } else {
                    int s = remap[sel_orig] >> 1;
                    int slot = sig_slot[s];
                    if (slot >= ff_slot0_tmp) {
                        sels[d] = {1, slot - ff_slot0_tmp};
                    } else {
                        sels[d] = {0, slot};
                    }
                }
            }
        }
    }

    // Gate/out refcounts ONLY (FF next-state writes happen inline without occupying sig slots!)
    std::vector<int> rem_ref(total_simp, 0);
    std::vector<uint8_t> end_pinned(total_simp, 0);
    for (int x : c.out) {
        int os = remap[x] >> 1;
        rem_ref[os]++;
        end_pinned[os] = 1;
    }
    for (int k : order) {
        const SimpGate& sg = sgates[k];
        if (sg.s0 > 0) rem_ref[sg.s0]++;
        if (sg.s1 > 0) rem_ref[sg.s1]++;
        if (sg.s2 > 0) rem_ref[sg.s2]++;
    }

    int next_gate_slot = next_fixed;
    std::vector<int> free_slots;
    free_slots.reserve(4096);

    const int ng = (int)order.size();
    cc.gates.reserve(ng);
    cc.gate_die_mask.reserve(ng);
    std::vector<int> sgate_to_exec(SG, -1);

    for (int idx = 0; idx < ng; idx++) {
        int k = order[idx];
        sgate_to_exec[k] = idx;
        const SimpGate& sg = sgates[k];
        int s0 = sig_slot[sg.s0];
        int s1 = (sg.s1 > 0) ? sig_slot[sg.s1] : -1;
        int s2 = (sg.s2 > 0) ? sig_slot[sg.s2] : -1;

        int dst = -1;
        if (rem_ref[sbase + k] > 0) {
            if (!free_slots.empty()) {
                dst = free_slots.back();
                free_slots.pop_back();
            } else {
                dst = next_gate_slot++;
            }
        }
        sig_slot[sbase + k] = dst;
        cc.gates.push_back({sg.op, dst, s0, s1, s2});

        uint8_t die_m = 0;
        if (sg.s0 > 0 && --rem_ref[sg.s0] == 0) {
            if (!end_pinned[sg.s0]) die_m |= 1;
            if (sg.s0 >= sbase) free_slots.push_back(s0);
        }
        if (sg.s1 > 0 && --rem_ref[sg.s1] == 0) {
            if (!end_pinned[sg.s1]) die_m |= 2;
            if (sg.s1 >= sbase) free_slots.push_back(s1);
        }
        if (sg.s2 > 0 && --rem_ref[sg.s2] == 0) {
            if (!end_pinned[sg.s2]) die_m |= 4;
            if (sg.s2 >= sbase) free_slots.push_back(s2);
        }
        cc.gate_die_mask.push_back(die_m);
    }

    cc.num_slots = next_gate_slot;
    cc.num_sig_buf_slots = next_gate_slot - cc.num_ff;
    cc.slot_is_pinned_end.assign(cc.num_slots, 0);

    // Build FF target mappings: gate-produced vs direct (const/PI/RF/FF)
    std::vector<int> gate_ff_cnt(ng, 0);
    struct TempGateFF { int exec_idx; int ff_idx; uint8_t inv; };
    std::vector<TempGateFF> tmp_gff;
    tmp_gff.reserve(cc.num_ff);

    for (int ff_id = 0; ff_id < cc.num_ff; ff_id++) {
        int f = live_ffs[ff_id];
        int lit = remap[c.d[f]];
        int ds = lit >> 1;
        uint8_t dinv = (uint8_t)(lit & 1);
        if (ds >= sbase) {
            int eidx = sgate_to_exec[ds - sbase];
            gate_ff_cnt[eidx]++;
            tmp_gff.push_back({eidx, ff_id, dinv});
        } else {
            cc.direct_ffs.push_back({ff_id, sig_slot[ds], dinv});
        }
    }

    cc.gate_ff_head.assign(ng + 1, 0);
    for (int i = 0; i < ng; i++) cc.gate_ff_head[i + 1] = cc.gate_ff_head[i] + gate_ff_cnt[i];
    cc.gate_ff_target.resize(tmp_gff.size());
    std::vector<int> gf_cur = cc.gate_ff_head;
    for (const auto& t : tmp_gff) {
        cc.gate_ff_target[gf_cur[t.exec_idx]++] = {t.ff_idx, t.inv};
    }
    std::sort(cc.direct_ffs.begin(), cc.direct_ffs.end(), [](const DirectFF& a, const DirectFF& b) {
        if (a.src_slot != b.src_slot) return a.src_slot < b.src_slot;
        if (a.inv != b.inv) return a.inv < b.inv;
        return a.ff_idx < b.ff_idx;
    });

    const int ff_slot0 = 2 + cc.num_pi + cc.num_rf_outs;
    const int ff_slot1 = ff_slot0 + cc.num_ff;
    cc.out_slot.resize(O);
    cc.out_inv.resize(O);
    cc.out_is_ff.resize(O);
    cc.out_buf_idx.resize(O);
    for (int j = 0; j < O; j++) {
        int lit = remap[c.out[j]];
        int s = sig_slot[lit >> 1];
        cc.out_slot[j] = s;
        cc.out_inv[j] = (uint8_t)(lit & 1);
        cc.slot_is_pinned_end[s] = 1;
        if (s >= ff_slot0 && s < ff_slot1) {
            cc.out_is_ff[j] = 1;
            cc.out_buf_idx[j] = s - ff_slot0;
        } else {
            cc.out_is_ff[j] = 0;
            cc.out_buf_idx[j] = (s >= ff_slot1) ? (s - cc.num_ff) : s;
        }
    }
    return cc;
}

// =========================================================================
// x86-64 AVX2 JIT Compiler (Windows x64 ABI: RCX = sig, RDX = ff_cur, R8 = ff_next)
// =========================================================================
struct JitKernel {
    void* mem = nullptr;
    size_t cap = 0;
    using Fn = void (*)(__m256i* sig, const __m256i* ff_cur, __m256i* ff_next);
    Fn fn = nullptr;

    ~JitKernel() {
        if (mem) VirtualFree(mem, 0, MEM_RELEASE);
    }
    JitKernel() = default;
    JitKernel(const JitKernel&) = delete;
    JitKernel& operator=(const JitKernel&) = delete;

    bool build(const CompiledCircuit& cc) {
        std::vector<uint8_t> code;
        code.reserve(cc.gates.size() * 14 + cc.num_ff * 10 + 512);

        auto emit_u8 = [&](uint8_t b) { code.push_back(b); };
        auto emit_u32 = [&](uint32_t v) {
            size_t p = code.size();
            code.resize(p + 4);
            memcpy(&code[p], &v, 4);
        };

        auto vex_rr = [&](uint8_t opcode, int reg, int vvvv, int rm) {
            uint8_t b1 = 0x01 | ((reg < 8) ? 0x80 : 0) | 0x40 | ((rm < 8) ? 0x20 : 0);
            uint8_t b2 = 0x05 | ((uint8_t)((~vvvv) & 0xF) << 3);
            uint8_t modrm = (uint8_t)(0xC0 | ((reg & 7) << 3) | (rm & 7));
            code.push_back(0xC4);
            code.push_back(b1);
            code.push_back(b2);
            code.push_back(opcode);
            code.push_back(modrm);
        };

        auto vex_rm_base = [&](uint8_t opcode, int reg, int vvvv, int base_reg, int32_t disp) {
            uint8_t b1 = 0x01 | ((reg < 8) ? 0x80 : 0) | 0x40 | ((base_reg < 8) ? 0x20 : 0);
            uint8_t b2 = 0x05 | ((uint8_t)((~vvvv) & 0xF) << 3);
            uint8_t rm = (uint8_t)(base_reg & 7);
            code.push_back(0xC4);
            code.push_back(b1);
            code.push_back(b2);
            code.push_back(opcode);
            if (disp == 0) {
                code.push_back((uint8_t)(((reg & 7) << 3) | rm));
            } else if (disp >= -128 && disp <= 127) {
                code.push_back((uint8_t)(0x40 | ((reg & 7) << 3) | rm));
                code.push_back((uint8_t)(int8_t)disp);
            } else {
                code.push_back((uint8_t)(0x80 | ((reg & 7) << 3) | rm));
                emit_u32((uint32_t)disp);
            }
        };

        const int ff_slot0 = 2 + cc.num_pi + cc.num_rf_outs;
        const int ff_slot1 = ff_slot0 + cc.num_ff;
        const int n_ff = cc.num_ff;
        auto vex_rm_slot = [&](uint8_t opcode, int reg, int vvvv, int slot) {
            if (slot >= ff_slot0 && slot < ff_slot1) {
                vex_rm_base(opcode, reg, vvvv, 2 /* RDX */, (slot - ff_slot0) * 32);
            } else {
                int sig_idx = (slot >= ff_slot1) ? (slot - n_ff) : slot;
                vex_rm_base(opcode, reg, vvvv, 1 /* RCX */, sig_idx * 32);
            }
        };

        auto save_xmm_rsp = [&](int xmm_r, int disp) {
            uint8_t b1 = 0x01 | ((xmm_r < 8) ? 0x80 : 0) | 0x40 | 0x20;
            uint8_t b2 = 0x01 | (0xF << 3);
            code.push_back(0xC4); code.push_back(b1); code.push_back(b2);
            code.push_back(0x7F);
            if (disp == 0) {
                code.push_back((uint8_t)(0x04 | ((xmm_r & 7) << 3)));
                code.push_back(0x24);
            } else if (disp <= 127) {
                code.push_back((uint8_t)(0x44 | ((xmm_r & 7) << 3)));
                code.push_back(0x24);
                code.push_back((uint8_t)disp);
            } else {
                code.push_back((uint8_t)(0x84 | ((xmm_r & 7) << 3)));
                code.push_back(0x24);
                emit_u32((uint32_t)disp);
            }
        };
        auto load_xmm_rsp = [&](int xmm_r, int disp) {
            uint8_t b1 = 0x01 | ((xmm_r < 8) ? 0x80 : 0) | 0x40 | 0x20;
            uint8_t b2 = 0x01 | (0xF << 3);
            code.push_back(0xC4); code.push_back(b1); code.push_back(b2);
            code.push_back(0x6F);
            if (disp == 0) {
                code.push_back((uint8_t)(0x04 | ((xmm_r & 7) << 3)));
                code.push_back(0x24);
            } else if (disp <= 127) {
                code.push_back((uint8_t)(0x44 | ((xmm_r & 7) << 3)));
                code.push_back(0x24);
                code.push_back((uint8_t)disp);
            } else {
                code.push_back((uint8_t)(0x84 | ((xmm_r & 7) << 3)));
                code.push_back(0x24);
                emit_u32((uint32_t)disp);
            }
        };

        emit_u8(0x48); emit_u8(0x81); emit_u8(0xEC); emit_u32(168);
        for (int r = 6; r <= 15; r++) save_xmm_rsp(r, (r - 6) * 16);

        constexpr int NUM_CACHE = 15;
        constexpr int TMP_REG = 15;

        // Emit direct FFs (const / PI / FF_cur) directly into [r8 + ff*32]
        if (!cc.direct_ffs.empty()) {
            size_t di = 0, dn = cc.direct_ffs.size();
            while (di < dn) {
                int s = cc.direct_ffs[di].src_slot;
                size_t dj = di;
                while (dj < dn && cc.direct_ffs[dj].src_slot == s) dj++;
                if (s == 0) {
                    bool loaded0 = false, loaded1 = false;
                    for (size_t k = di; k < dj; k++) {
                        if (!cc.direct_ffs[k].inv) {
                            if (!loaded0) { vex_rm_base(0x6F, 14, 0, 1, 0); loaded0 = true; }
                            vex_rm_base(0x7F, 14, 0, 8, cc.direct_ffs[k].ff_idx * 32);
                        } else {
                            if (!loaded1) { vex_rm_base(0x6F, 15, 0, 1, 32); loaded1 = true; }
                            vex_rm_base(0x7F, 15, 0, 8, cc.direct_ffs[k].ff_idx * 32);
                        }
                    }
                } else {
                    vex_rm_slot(0x6F, 14, 0, s);
                    bool inv_done = false;
                    for (size_t k = di; k < dj; k++) {
                        if (!cc.direct_ffs[k].inv) {
                            vex_rm_base(0x7F, 14, 0, 8, cc.direct_ffs[k].ff_idx * 32);
                        } else {
                            if (!inv_done) {
                                vex_rm_base(0xEF, 15, 14, 1, 32);
                                inv_done = true;
                            }
                            vex_rm_base(0x7F, 15, 0, 8, cc.direct_ffs[k].ff_idx * 32);
                        }
                    }
                }
                di = dj;
            }
        }

        // Precompute exact next-use distances for Belady eviction
        const int ng = (int)cc.gates.size();
        const int INF = ng + 1000;
        std::vector<int> op0_next(ng, INF), op1_next(ng, INF), op2_next(ng, INF), dst_next(ng, INF);
        {
            std::vector<int> last_seen(cc.num_slots, INF);
            for (int s = 0; s < cc.num_slots; s++) {
                if (cc.slot_is_pinned_end[s]) last_seen[s] = ng;
            }
            for (int i = ng - 1; i >= 0; i--) {
                const ExecGate& eg = cc.gates[i];
                if (eg.s0 >= 0) op0_next[i] = last_seen[eg.s0];
                if (eg.s1 >= 0) op1_next[i] = last_seen[eg.s1];
                if (eg.s2 >= 0) op2_next[i] = last_seen[eg.s2];
                if (eg.s0 >= 0) last_seen[eg.s0] = i;
                if (eg.s1 >= 0) last_seen[eg.s1] = i;
                if (eg.s2 >= 0) last_seen[eg.s2] = i;
                if (eg.dst >= 0) {
                    dst_next[i] = last_seen[eg.dst];
                    last_seen[eg.dst] = INF;
                }
            }
        }

        int reg_slot[NUM_CACHE];
        bool reg_dirty[NUM_CACHE];
        int reg_next_use[NUM_CACHE];
        for (int r = 0; r < NUM_CACHE; r++) {
            reg_slot[r] = -1;
            reg_dirty[r] = false;
            reg_next_use[r] = INF;
        }
        std::vector<int8_t> slot_reg(cc.num_slots, -1);

        auto alloc_reg = [&](int pin0, int pin1, int pin2, int prefer_free0, int prefer_free1, int prefer_free2) -> int {
            if (prefer_free0 >= 0) return prefer_free0;
            if (prefer_free1 >= 0) return prefer_free1;
            if (prefer_free2 >= 0) return prefer_free2;
            for (int r = 0; r < NUM_CACHE; r++) {
                if (reg_slot[r] < 0) return r;
            }
            int best = -1;
            int best_next = -1;
            bool best_clean = false;
            for (int r = 0; r < NUM_CACHE; r++) {
                if (r == pin0 || r == pin1 || r == pin2) continue;
                int nu = reg_next_use[r];
                bool is_clean = !reg_dirty[r];
                if (nu > best_next || (nu == best_next && is_clean && !best_clean)) {
                    best_next = nu;
                    best_clean = is_clean;
                    best = r;
                }
            }
            int old_s = reg_slot[best];
            if (old_s >= 0) {
                if (reg_dirty[best]) {
                    vex_rm_slot(0x7F, best, 0, old_s);
                    reg_dirty[best] = false;
                }
                slot_reg[old_s] = -1;
                reg_slot[best] = -1;
                reg_next_use[best] = INF;
            }
            return best;
        };

        auto ensure_in_reg = [&](int s, int pin0, int pin1, int cur_i) -> int {
            int r = slot_reg[s];
            if (r >= 0) {
                reg_next_use[r] = cur_i;
                return r;
            }
            r = alloc_reg(pin0, pin1, -1, -1, -1, -1);
            vex_rm_slot(0x6F, r, 0, s);
            reg_slot[r] = s;
            reg_dirty[r] = false;
            reg_next_use[r] = cur_i;
            slot_reg[s] = (int8_t)r;
            return r;
        };

        auto kill_if_dead = [&](int s, bool dies, int except_reg) {
            if (!dies) return;
            int r = slot_reg[s];
            if (r >= 0) {
                if (r != except_reg) {
                    reg_slot[r] = -1;
                    reg_dirty[r] = false;
                    reg_next_use[r] = INF;
                }
                slot_reg[s] = -1;
            }
        };

        for (int i = 0; i < ng; i++) {
            const ExecGate& eg = cc.gates[i];
            uint8_t dm = cc.gate_die_mask[i];
            bool d0 = (dm & 1) != 0;
            bool d1 = (dm & 2) != 0;
            bool d2 = (dm & 4) != 0;

            int s0 = eg.s0, s1 = eg.s1, s2 = eg.s2;
            int n0 = op0_next[i], n1 = op1_next[i], n2 = op2_next[i];
            int r0 = slot_reg[s0];
            int r1 = (s1 >= 0) ? slot_reg[s1] : -1;
            int r2 = (s2 >= 0) ? slot_reg[s2] : -1;
            int r_dst = -1;

            if (eg.op <= OP_XOR) {
                uint8_t opcode = (eg.op == OP_AND) ? 0xDB : (eg.op == OP_OR ? 0xEB : 0xEF);
                if (r0 < 0 && r1 >= 0) {
                    std::swap(s0, s1); std::swap(r0, r1); std::swap(d0, d1); std::swap(n0, n1);
                }
                if (r0 < 0) {
                    r_dst = alloc_reg(-1, -1, -1, -1, -1, -1);
                    vex_rm_slot(0x6F, r_dst, 0, s0);
                    vex_rm_slot(opcode, r_dst, r_dst, s1);
                } else {
                    r_dst = alloc_reg(r0, r1, -1, d0 ? r0 : -1, (r1 >= 0 && d1) ? r1 : -1, -1);
                    if (r1 >= 0) vex_rr(opcode, r_dst, r0, r1);
                    else vex_rm_slot(opcode, r_dst, r0, s1);
                }
            } else if (eg.op == OP_ANDN) {
                if (r0 < 0) r0 = ensure_in_reg(s0, r1, -1, i);
                r1 = slot_reg[s1];
                r_dst = alloc_reg(r0, r1, -1, d0 ? r0 : -1, (r1 >= 0 && d1) ? r1 : -1, -1);
                if (r1 >= 0) vex_rr(0xDF, r_dst, r0, r1);
                else vex_rm_slot(0xDF, r_dst, r0, s1);
            } else if (eg.op == OP_MUX_NN) {
                if (r0 < 0) r0 = ensure_in_reg(s0, r1, r2, i);
                r1 = slot_reg[s1];
                r2 = slot_reg[s2];
                r_dst = alloc_reg(r0, r1, r2, d0 ? r0 : -1, (r1 >= 0 && d1) ? r1 : -1, (r2 >= 0 && d2) ? r2 : -1);
                if (r2 >= 0) vex_rr(0xDB, TMP_REG, r0, r2);
                else vex_rm_slot(0xDB, TMP_REG, r0, s2);
                if (r1 >= 0) vex_rr(0xDF, r_dst, r0, r1);
                else vex_rm_slot(0xDF, r_dst, r0, s1);
                vex_rr(0xEB, r_dst, r_dst, TMP_REG);
            } else {
                if (r0 < 0) r0 = ensure_in_reg(s0, r1, r2, i);
                r2 = slot_reg[s2];
                if (r2 < 0) r2 = ensure_in_reg(s2, r0, slot_reg[s1], i);
                r0 = slot_reg[s0];
                r1 = slot_reg[s1];
                r_dst = alloc_reg(r0, r1, r2, d0 ? r0 : -1, (r1 >= 0 && d1) ? r1 : -1, d2 ? r2 : -1);
                vex_rr(0xDF, TMP_REG, r2, r0);
                if (r1 >= 0) vex_rr(0xDF, r_dst, r0, r1);
                else vex_rm_slot(0xDF, r_dst, r0, s1);
                vex_rr(0xEB, r_dst, r_dst, TMP_REG);
            }

            // Write attached FF next-states directly from register r_dst before releasing/clobbering
            int f0 = cc.gate_ff_head[i], f1 = cc.gate_ff_head[i + 1];
            if (f0 < f1) {
                bool inv_ready = false;
                for (int p = f0; p < f1; p++) {
                    const GateFFTarget& tgt = cc.gate_ff_target[p];
                    if (!tgt.inv) {
                        vex_rm_base(0x7F, r_dst, 0, 8 /* R8 */, tgt.ff_idx * 32);
                    } else {
                        if (!inv_ready) {
                            vex_rm_base(0xEF, TMP_REG, r_dst, 1 /* RCX */, 32);
                            inv_ready = true;
                        }
                        vex_rm_base(0x7F, TMP_REG, 0, 8 /* R8 */, tgt.ff_idx * 32);
                    }
                }
            }

            int keep_dst = (eg.dst >= 0) ? r_dst : -1;
            kill_if_dead(s0, d0, keep_dst);
            kill_if_dead(s1, d1, keep_dst);
            kill_if_dead(s2, d2, keep_dst);

            if (s0 >= 0 && !d0 && slot_reg[s0] >= 0) reg_next_use[slot_reg[s0]] = n0;
            if (s1 >= 0 && !d1 && slot_reg[s1] >= 0) reg_next_use[slot_reg[s1]] = n1;
            if (s2 >= 0 && !d2 && slot_reg[s2] >= 0) reg_next_use[slot_reg[s2]] = n2;

            if (eg.dst >= 0) {
                reg_slot[r_dst] = eg.dst;
                reg_dirty[r_dst] = true;
                reg_next_use[r_dst] = dst_next[i];
                slot_reg[eg.dst] = (int8_t)r_dst;
            }
        }

        for (int r = 0; r < NUM_CACHE; r++) {
            int s = reg_slot[r];
            if (s >= 0 && reg_dirty[r] && cc.slot_is_pinned_end[s]) {
                vex_rm_slot(0x7F, r, 0, s);
            }
        }

        emit_u8(0xC5); emit_u8(0xF8); emit_u8(0x77);
        for (int r = 6; r <= 15; r++) load_xmm_rsp(r, (r - 6) * 16);
        emit_u8(0x48); emit_u8(0x81); emit_u8(0xC4); emit_u32(168);
        emit_u8(0xC3);

        cap = (code.size() + 4095) & ~(size_t)4095;
        mem = VirtualAlloc(nullptr, cap, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
        if (!mem) return false;
        memcpy(mem, code.data(), code.size());
        DWORD oldp = 0;
        if (!VirtualProtect(mem, cap, PAGE_EXECUTE_READ, &oldp)) {
            VirtualFree(mem, 0, MEM_RELEASE);
            mem = nullptr;
            return false;
        }
        FlushInstructionCache(GetCurrentProcess(), mem, code.size());
        fn = (Fn)mem;
        return true;
    }
};

static inline void transpose_32rows_u64(const uint64_t src[32], uint32_t dst[], bool only_low32) {
    __m256i a0 = _mm256_setr_epi64x(src[0], src[8], src[16], src[24]);
    __m256i a1 = _mm256_setr_epi64x(src[1], src[9], src[17], src[25]);
    __m256i a2 = _mm256_setr_epi64x(src[2], src[10], src[18], src[26]);
    __m256i a3 = _mm256_setr_epi64x(src[3], src[11], src[19], src[27]);
    __m256i a4 = _mm256_setr_epi64x(src[4], src[12], src[20], src[28]);
    __m256i a5 = _mm256_setr_epi64x(src[5], src[13], src[21], src[29]);
    __m256i a6 = _mm256_setr_epi64x(src[6], src[14], src[22], src[30]);
    __m256i a7 = _mm256_setr_epi64x(src[7], src[15], src[23], src[31]);

    __m256i b0 = _mm256_unpacklo_epi8(a0, a1), b1 = _mm256_unpackhi_epi8(a0, a1);
    __m256i b2 = _mm256_unpacklo_epi8(a2, a3), b3 = _mm256_unpackhi_epi8(a2, a3);
    __m256i b4 = _mm256_unpacklo_epi8(a4, a5), b5 = _mm256_unpackhi_epi8(a4, a5);
    __m256i b6 = _mm256_unpacklo_epi8(a6, a7), b7 = _mm256_unpackhi_epi8(a6, a7);

    __m256i c0 = _mm256_unpacklo_epi16(b0, b2), c2 = _mm256_unpacklo_epi16(b4, b6);
    __m256i c4 = _mm256_unpacklo_epi16(b1, b3), c6 = _mm256_unpacklo_epi16(b5, b7);
    __m256i d0 = _mm256_unpacklo_epi32(c0, c2), d1 = _mm256_unpackhi_epi32(c0, c2);
    __m256i d2 = _mm256_unpacklo_epi32(c4, c6), d3 = _mm256_unpackhi_epi32(c4, c6);
    __m256i y0[4] = {
        _mm256_unpacklo_epi64(d0, d2), _mm256_unpackhi_epi64(d0, d2),
        _mm256_unpacklo_epi64(d1, d3), _mm256_unpackhi_epi64(d1, d3)
    };
    for (int k = 0; k < 4; k++) {
        __m256i v = y0[k];
        for (int b = 7; b >= 0; b--) {
            dst[k * 8 + b] = (uint32_t)_mm256_movemask_epi8(v);
            v = _mm256_add_epi8(v, v);
        }
    }
    if (only_low32) return;

    __m256i c1 = _mm256_unpackhi_epi16(b0, b2), c3 = _mm256_unpackhi_epi16(b4, b6);
    __m256i c5 = _mm256_unpackhi_epi16(b1, b3), c7 = _mm256_unpackhi_epi16(b5, b7);
    __m256i d4 = _mm256_unpacklo_epi32(c1, c3), d5 = _mm256_unpackhi_epi32(c1, c3);
    __m256i d6 = _mm256_unpacklo_epi32(c5, c7), d7 = _mm256_unpackhi_epi32(c5, c7);
    __m256i y1[4] = {
        _mm256_unpacklo_epi64(d4, d6), _mm256_unpackhi_epi64(d4, d6),
        _mm256_unpacklo_epi64(d5, d7), _mm256_unpackhi_epi64(d5, d7)
    };
    for (int k = 0; k < 4; k++) {
        __m256i v = y1[k];
        for (int b = 7; b >= 0; b--) {
            dst[32 + k * 8 + b] = (uint32_t)_mm256_movemask_epi8(v);
            v = _mm256_add_epi8(v, v);
        }
    }
}

static inline void transpose_64x64_split(const uint64_t in[64], uint32_t lo[64], uint32_t hi[64]) {
    transpose_32rows_u64(in, lo, false);
    transpose_32rows_u64(in + 32, hi, false);
}

static inline void transpose_64x64(const uint64_t in[64], uint64_t out[64]) {
    alignas(32) uint32_t lo[64], hi[64];
    transpose_64x64_split(in, lo, hi);
    for (int i = 0; i < 64; i++) out[i] = (uint64_t)lo[i] | ((uint64_t)hi[i] << 32);
}

static inline void transpose_64x32(const uint64_t in[64], uint64_t out[32]) {
    alignas(32) uint32_t lo[32], hi[32];
    transpose_32rows_u64(in, lo, true);
    transpose_32rows_u64(in + 32, hi, true);
    for (int i = 0; i < 32; i++) out[i] = (uint64_t)lo[i] | ((uint64_t)hi[i] << 32);
}

static inline void eval_rf_reads_scalar(const CompiledCircuit& cc, uint64_t* sig, const uint64_t* ff_cur, int cnt) {
    const int N = cc.rf.N, W = cc.rf.W, D = cc.rf.D;
    const int P = (int)cc.rf.ports.size();
    const int* ff_flat = cc.rf.ff_idx_flat.data();
    std::vector<uint64_t> rf_words((size_t)cnt * N, 0ULL);
    for (int s = 0; s < cnt; s++) {
        uint64_t smask = 1ULL << s;
        for (int r = 0; r < N; r++) {
            uint64_t wval = 0;
            for (int b = 0; b < W; b++) {
                if (ff_cur[ff_flat[r * W + b]] & smask) wval |= (1ULL << b);
            }
            rf_words[(size_t)s * N + r] = wval;
        }
    }
    std::vector<uint8_t> raddr(cnt, 0);
    for (int p = 0; p < P; p++) {
        const auto& pr = cc.rf.ports[p];
        for (int s = 0; s < cnt; s++) {
            uint8_t addr = 0;
            uint64_t smask = 1ULL << s;
            for (int d = 0; d < D; d++) {
                uint64_t v = pr.sels[d].is_ff ? ff_cur[pr.sels[d].buf_idx] : sig[pr.sels[d].buf_idx];
                if (v & smask) addr |= (uint8_t)(1u << d);
            }
            raddr[s] = addr;
        }
        if (pr.has_full) {
            for (int b = 0; b < W; b++) {
                int slot = pr.full_sig_slot[b];
                if (slot < 0) continue;
                uint64_t outv = 0;
                for (int s = 0; s < cnt; s++) {
                    if ((rf_words[(size_t)s * N + raddr[s]] >> b) & 1ULL) outv |= (1ULL << s);
                }
                sig[slot] = outv;
            }
        }
        for (int gi = cc.rf.port_grp_head[p]; gi < cc.rf.port_grp_head[p + 1]; gi++) {
            const auto& gp = cc.rf.port_grps[gi];
            for (uint32_t ti = gp.tap_beg; ti < gp.tap_end; ti++) {
                const auto& tp = cc.rf.grp_taps[ti];
                uint64_t outv = 0;
                for (int s = 0; s < cnt; s++) {
                    int row = (int)gp.base | ((int)raddr[s] & (int)gp.mask);
                    if ((rf_words[(size_t)s * N + row] >> tp.bit) & 1ULL) outv |= (1ULL << s);
                }
                sig[tp.sig_slot] = outv;
            }
        }
    }
}

static void eval_rf_reads_256(const CompiledCircuit& cc, __m256i* sig, const __m256i* ff_cur,
                              uint32_t* rf32, uint8_t* raddr_ps) {
    const int N = cc.rf.N, W = cc.rf.W, D = cc.rf.D, stride_w = cc.rf.stride_w;
    const int P = (int)cc.rf.ports.size();
    const int* ff_flat = cc.rf.ff_idx_flat.data();
    const __m256i v_s0_7 = _mm256_setr_epi32(0, 1, 2, 3, 4, 5, 6, 7);
    const __m256i v_8 = _mm256_set1_epi32(8);
    uint16_t* rf16 = (uint16_t*)rf32;
    uint32_t* rf_hi = rf32 + N * 64;

    alignas(32) uint64_t tin[64], tout[64];
    alignas(32) uint32_t lo_tmp[64], hi_tmp[64];

    for (int w = 0; w < 4; w++) {
        // 1. Transpose N * W RF FFs -> [row][64] in L1D (rf16 / rf32 / rf32+rf_hi)
        if (W <= 16) {
            for (int r = 0; r < N; r += 4) {
                memset(tin, 0, sizeof(tin));
                for (int j = 0; j < 4; j++) {
                    const int* row_ffs = &ff_flat[(r + j) * W];
                    for (int b = 0; b < W; b++) {
                        tin[j * 16 + b] = ((const uint64_t*)&ff_cur[row_ffs[b]])[w];
                    }
                }
                transpose_64x64_split(tin, lo_tmp, hi_tmp);
                uint16_t* d0 = rf16 + (r + 0) * 64;
                uint16_t* d1 = rf16 + (r + 1) * 64;
                uint16_t* d2 = rf16 + (r + 2) * 64;
                uint16_t* d3 = rf16 + (r + 3) * 64;
                for (int s = 0; s < 64; s++) {
                    uint32_t v0 = lo_tmp[s], v1 = hi_tmp[s];
                    d0[s] = (uint16_t)v0;
                    d1[s] = (uint16_t)(v0 >> 16);
                    d2[s] = (uint16_t)v1;
                    d3[s] = (uint16_t)(v1 >> 16);
                }
            }
        } else if (W <= 32) {
            for (int r = 0; r < N; r += 2) {
                if (W < 32) memset(tin, 0, sizeof(tin));
                for (int j = 0; j < 2; j++) {
                    const int* row_ffs = &ff_flat[(r + j) * W];
                    for (int b = 0; b < W; b++) {
                        tin[j * 32 + b] = ((const uint64_t*)&ff_cur[row_ffs[b]])[w];
                    }
                }
                transpose_64x64_split(tin, rf32 + r * 64, rf32 + (r + 1) * 64);
            }
        } else {
            for (int r = 0; r < N; r++) {
                if (W < 64) memset(tin, 0, sizeof(tin));
                const int* row_ffs = &ff_flat[r * W];
                for (int b = 0; b < W; b++) {
                    tin[b] = ((const uint64_t*)&ff_cur[row_ffs[b]])[w];
                }
                transpose_64x64_split(tin, rf32 + r * 64, rf_hi + r * 64);
            }
        }

        // 2. Transpose P * D read addresses -> raddr_ps[p * 64 + s]
        for (int p0 = 0; p0 < P; p0 += 8) {
            memset(tin, 0, sizeof(tin));
            int np = std::min(8, P - p0);
            for (int k = 0; k < np; k++) {
                const auto& sels = cc.rf.ports[p0 + k].sels;
                for (int d = 0; d < D; d++) {
                    const __m256i* ptr = sels[d].is_ff ? &ff_cur[sels[d].buf_idx] : &sig[sels[d].buf_idx];
                    tin[k * 8 + d] = ((const uint64_t*)ptr)[w];
                }
            }
            transpose_64x64(tin, tout);
            for (int s = 0; s < 64; s++) {
                uint64_t v = tout[s];
                for (int k = 0; k < np; k++) {
                    raddr_ps[(p0 + k) * 64 + s] = (uint8_t)(v >> (k * 8));
                }
            }
        }

        // 3. Evaluate full read ports + grouped sparse intermediate taps per port
        for (int p = 0; p < P; p++) {
            const auto& pr = cc.rf.ports[p];
            const uint8_t* rp = &raddr_ps[p * 64];
            if (pr.has_full) {
                if (W <= 16) {
                    for (int s = 0; s < 64; s++) tin[s] = rf16[(int)rp[s] * 64 + s];
                    transpose_64x32(tin, tout);
                } else if (stride_w == 1) {
                    for (int s = 0; s < 64; s++) tin[s] = rf32[(int)rp[s] * 64 + s];
                    transpose_64x32(tin, tout);
                } else {
                    for (int s = 0; s < 64; s++) {
                        int off = (int)rp[s] * 64 + s;
                        tin[s] = (uint64_t)rf32[off] | ((uint64_t)rf_hi[off] << 32);
                    }
                    transpose_64x64(tin, tout);
                }
                for (int b = 0; b < W; b++) {
                    int slot = pr.full_sig_slot[b];
                    if (slot >= 0) ((uint64_t*)&sig[slot])[w] = tout[b];
                }
            }

            int g0 = cc.rf.port_grp_head[p], g1 = cc.rf.port_grp_head[p + 1];
            if (g0 < g1) {
                __m256i vr[8];
                for (int g = 0; g < 8; g++) {
                    vr[g] = _mm256_cvtepu8_epi32(_mm_loadl_epi64((const __m128i*)&rp[g * 8]));
                }
                for (int gi = g0; gi < g1; gi++) {
                    const auto& gp = cc.rf.port_grps[gi];
                    const __m256i v_mask = _mm256_set1_epi32((int)gp.mask);
                    const __m256i v_base = _mm256_set1_epi32((int)gp.base);
                    const int* src_ptr = (W <= 16) ? (const int*)rf16 : (gp.half ? (const int*)rf_hi : (const int*)rf32);
                    __m256i words[8];
                    __m256i lane = v_s0_7;
                    if (W <= 16) {
                        for (int g = 0; g < 8; g++) {
                            __m256i row = _mm256_or_si256(v_base, _mm256_and_si256(vr[g], v_mask));
                            __m256i idx = _mm256_add_epi32(_mm256_slli_epi32(row, 6), lane);
                            words[g] = _mm256_i32gather_epi32(src_ptr, idx, 2);
                            lane = _mm256_add_epi32(lane, v_8);
                        }
                    } else {
                        for (int g = 0; g < 8; g++) {
                            __m256i row = _mm256_or_si256(v_base, _mm256_and_si256(vr[g], v_mask));
                            __m256i idx = _mm256_add_epi32(_mm256_slli_epi32(row, 6), lane);
                            words[g] = _mm256_i32gather_epi32(src_ptr, idx, 4);
                            lane = _mm256_add_epi32(lane, v_8);
                        }
                    }
                    for (uint32_t ti = gp.tap_beg; ti < gp.tap_end; ti++) {
                        const auto& tp = cc.rf.grp_taps[ti];
                        const int sh = 31 - (tp.bit & 31);
                        uint64_t out64 = 0;
                        for (int g = 0; g < 8; g++) {
                            uint32_t m8 = (uint32_t)_mm256_movemask_ps(_mm256_castsi256_ps(_mm256_slli_epi32(words[g], sh)));
                            out64 |= ((uint64_t)m8) << (g * 8);
                        }
                        ((uint64_t*)&sig[tp.sig_slot])[w] = out64;
                    }
                }
            }
        }
    }
}

static void simulate_scalar_chunk(const CompiledCircuit& cc, const Circuit& c,
                                  int m_begin, int m_end, std::vector<uint64_t>& digests) {
    const int n_pi = cc.num_pi;
    const int n_ff = cc.num_ff;
    const int ff_slot0 = 2 + n_pi + cc.num_rf_outs;
    const int ff_slot1 = ff_slot0 + n_ff;
    const int O = c.O;
    const int T = c.T;
    const int cnt = m_end - m_begin;
    const uint64_t valid_mask = (cnt == 64) ? ~0ULL : ((1ULL << cnt) - 1ULL);

    std::vector<uint64_t> sig_buf(std::max(2, cc.num_sig_buf_slots), 0ULL);
    sig_buf[0] = 0ULL;
    sig_buf[1] = ~0ULL;
    std::vector<uint64_t> ff_cur_buf(n_ff, 0ULL);
    std::vector<uint64_t> ff_next_buf(n_ff, 0ULL);
    uint64_t* sig = sig_buf.data();
    uint64_t* ff_cur = n_ff ? ff_cur_buf.data() : nullptr;
    uint64_t* ff_next = n_ff ? ff_next_buf.data() : nullptr;

    auto read_slot = [&](int s) -> uint64_t {
        if (s >= ff_slot0 && s < ff_slot1) return ff_cur[s - ff_slot0];
        return sig[(s >= ff_slot1) ? (s - n_ff) : s];
    };

    std::vector<uint64_t> rng(cnt);
    for (int k = 0; k < cnt; k++) rng[k] = mix64(c.seed ^ (uint64_t)(m_begin + k));
    std::vector<uint64_t> rvals(cnt);
    std::vector<uint64_t> h(cnt, 0ULL);

    const ExecGate* __restrict gates = cc.gates.data();
    const int ng = (int)cc.gates.size();

    for (int t = 0; t < T; t++) {
        for (int k = 0; k < cnt; k++) rvals[k] = splitmix64_next(&rng[k]);
        for (int i = 0; i < n_pi; i++) {
            int bit = cc.pi_orig_idx[i];
            uint64_t v = 0;
            if (bit < 64) {
                for (int k = 0; k < cnt; k++) v |= ((rvals[k] >> bit) & 1ULL) << k;
            }
            sig[2 + i] = v;
        }

        if (cc.rf.active) eval_rf_reads_scalar(cc, sig, ff_cur, cnt);

        for (const auto& df : cc.direct_ffs) {
            uint64_t v = read_slot(df.src_slot);
            ff_next[df.ff_idx] = df.inv ? ~v : v;
        }

        for (int g = 0; g < ng; g++) {
            const ExecGate& eg = gates[g];
            uint64_t a = read_slot(eg.s0), b = read_slot(eg.s1), res;
            switch (eg.op) {
                case OP_AND: res = a & b; break;
                case OP_OR:  res = a | b; break;
                case OP_XOR: res = a ^ b; break;
                case OP_ANDN: res = (~a) & b; break;
                case OP_MUX_NN: res = (a & read_slot(eg.s2)) | ((~a) & b); break;
                default: res = (a & ~read_slot(eg.s2)) | ((~a) & b); break;
            }
            for (int p = cc.gate_ff_head[g]; p < cc.gate_ff_head[g + 1]; p++) {
                const GateFFTarget& tgt = cc.gate_ff_target[p];
                ff_next[tgt.ff_idx] = tgt.inv ? ~res : res;
            }
            if (eg.dst >= 0) sig[eg.dst - n_ff] = res;
        }

        uint64_t base_idx = (uint64_t)t * (uint64_t)O;
        for (int j = 0; j < O; j++) {
            uint64_t ov = cc.out_is_ff[j] ? ff_cur[cc.out_buf_idx[j]] : sig[cc.out_buf_idx[j]];
            if (cc.out_inv[j]) ov = ~ov;
            ov &= valid_mask;
            if (ov) {
                uint64_t key = mix64(base_idx + (uint64_t)j);
                while (ov) {
                    h[__builtin_ctzll(ov)] ^= key;
                    ov &= ov - 1;
                }
            }
        }

        std::swap(ff_cur, ff_next);
    }

    for (int k = 0; k < cnt; k++) digests[m_begin + k] = h[k];
}

static void simulate_avx2_256(const CompiledCircuit& cc, const JitKernel* jit, const Circuit& c,
                              int m_begin, std::vector<uint64_t>& digests) {
    const int n_pi = cc.num_pi;
    const int n_ff = cc.num_ff;
    const int ff_slot0 = 2 + n_pi + cc.num_rf_outs;
    const int ff_slot1 = ff_slot0 + n_ff;
    const int O = c.O;
    const int T = c.T;

    __m256i* sig = (__m256i*)_mm_malloc((size_t)std::max(2, cc.num_sig_buf_slots) * sizeof(__m256i), 32);
    __m256i* ff_cur = n_ff ? (__m256i*)_mm_malloc((size_t)n_ff * sizeof(__m256i), 32) : nullptr;
    __m256i* ff_next = n_ff ? (__m256i*)_mm_malloc((size_t)n_ff * sizeof(__m256i), 32) : nullptr;
    uint32_t* rf32 = cc.rf.active ? (uint32_t*)_mm_malloc(((size_t)64 * cc.rf.N * cc.rf.stride_w + 16) * sizeof(uint32_t), 32) : nullptr;
    std::vector<uint8_t> raddr_ps(cc.rf.active ? cc.rf.ports.size() * 64 : 0);
    const __m256i ones = _mm256_set1_epi64x(-1LL);

    sig[0] = _mm256_setzero_si256();
    sig[1] = ones;
    if (n_ff > 0) memset(ff_cur, 0, (size_t)n_ff * sizeof(__m256i));

    alignas(32) uint64_t rng[256];
    for (int k = 0; k < 256; k++) rng[k] = mix64(c.seed ^ (uint64_t)(m_begin + k));

    alignas(32) uint64_t rvals[256];
    alignas(32) uint64_t trans[4][64];
    alignas(32) uint64_t h[256] = {};
    alignas(32) uint64_t out_lanes[4][64];
    alignas(32) uint64_t tbl[8][256];

    const ExecGate* __restrict gates = cc.gates.data();
    const int ng = (int)cc.gates.size();
    const uint8_t* __restrict out_inv = cc.out_inv.data();
    const uint8_t* __restrict out_is_ff = cc.out_is_ff.data();
    const int* __restrict out_buf_idx = cc.out_buf_idx.data();

    uint64_t out_inv_mask = 0;
    if (O <= 64) {
        for (int j = 0; j < O; j++) {
            if (out_inv[j]) out_inv_mask |= (1ULL << j);
        }
    }

    auto read_slot_v = [&](int s) -> __m256i {
        if (s >= ff_slot0 && s < ff_slot1) return ff_cur[s - ff_slot0];
        return sig[(s >= ff_slot1) ? (s - n_ff) : s];
    };

    for (int t = 0; t < T; t++) {
        for (int k = 0; k < 256; k++) rvals[k] = splitmix64_next(&rng[k]);
        for (int w = 0; w < 4; w++) transpose_64x64(&rvals[w * 64], trans[w]);
        for (int i = 0; i < n_pi; i++) {
            int bit = cc.pi_orig_idx[i];
            if (bit < 64) {
                sig[2 + i] = _mm256_set_epi64x(trans[3][bit], trans[2][bit], trans[1][bit], trans[0][bit]);
            } else {
                sig[2 + i] = _mm256_setzero_si256();
            }
        }

        if (cc.rf.active) eval_rf_reads_256(cc, sig, ff_cur, rf32, raddr_ps.data());

        if (jit && jit->fn) {
            jit->fn(sig, ff_cur, ff_next);
        } else {
            for (const auto& df : cc.direct_ffs) {
                __m256i v = read_slot_v(df.src_slot);
                ff_next[df.ff_idx] = df.inv ? _mm256_xor_si256(v, ones) : v;
            }
            for (int g = 0; g < ng; g++) {
                const ExecGate& eg = gates[g];
                __m256i a = read_slot_v(eg.s0), b = read_slot_v(eg.s1), res;
                switch (eg.op) {
                    case OP_AND: res = _mm256_and_si256(a, b); break;
                    case OP_OR:  res = _mm256_or_si256(a, b); break;
                    case OP_XOR: res = _mm256_xor_si256(a, b); break;
                    case OP_ANDN: res = _mm256_andnot_si256(a, b); break;
                    case OP_MUX_NN: res = _mm256_or_si256(_mm256_and_si256(a, read_slot_v(eg.s2)), _mm256_andnot_si256(a, b)); break;
                    default: res = _mm256_or_si256(_mm256_andnot_si256(read_slot_v(eg.s2), a), _mm256_andnot_si256(a, b)); break;
                }
                for (int p = cc.gate_ff_head[g]; p < cc.gate_ff_head[g + 1]; p++) {
                    const GateFFTarget& tgt = cc.gate_ff_target[p];
                    ff_next[tgt.ff_idx] = tgt.inv ? _mm256_xor_si256(res, ones) : res;
                }
                if (eg.dst >= 0) sig[eg.dst - n_ff] = res;
            }
        }

        const __m256i* out_bases[2] = {sig, ff_cur};
        uint64_t base_idx = (uint64_t)t * (uint64_t)O;
        if (O == 64) {
            alignas(32) uint64_t out_in[4][64];
            for (int j = 0; j < 64; j++) {
                alignas(32) uint64_t v[4];
                _mm256_store_si256((__m256i*)v, out_bases[out_is_ff[j]][out_buf_idx[j]]);
                out_in[0][j] = v[0];
                out_in[1][j] = v[1];
                out_in[2][j] = v[2];
                out_in[3][j] = v[3];
            }
            for (int w = 0; w < 4; w++) transpose_64x64(out_in[w], out_lanes[w]);
            uint64_t keys[64];
            for (int j = 0; j < 64; j++) keys[j] = mix64(base_idx + (uint64_t)j);
            for (int b = 0; b < 8; b++) {
                tbl[b][0] = 0;
                for (int m = 1; m < 256; m++) {
                    int bit = __builtin_ctz(m);
                    tbl[b][m] = tbl[b][m & (m - 1)] ^ keys[8 * b + bit];
                }
            }
            for (int w = 0; w < 4; w++) {
                for (int k = 0; k < 64; k++) {
                    uint64_t mask = out_lanes[w][k] ^ out_inv_mask;
                    h[w * 64 + k] ^= tbl[0][mask & 255] ^ tbl[1][(mask >> 8) & 255] ^
                                     tbl[2][(mask >> 16) & 255] ^ tbl[3][(mask >> 24) & 255] ^
                                     tbl[4][(mask >> 32) & 255] ^ tbl[5][(mask >> 40) & 255] ^
                                     tbl[6][(mask >> 48) & 255] ^ tbl[7][(mask >> 56) & 255];
                }
            }
        } else {
            for (int j = 0; j < O; j++) {
                alignas(32) uint64_t v[4];
                __m256i val = out_bases[out_is_ff[j]][out_buf_idx[j]];
                if (out_inv[j]) val = _mm256_xor_si256(val, ones);
                _mm256_store_si256((__m256i*)v, val);
                uint64_t key = mix64(base_idx + (uint64_t)j);
                for (int w = 0; w < 4; w++) {
                    uint64_t m = v[w];
                    while (m) {
                        h[w * 64 + __builtin_ctzll(m)] ^= key;
                        m &= m - 1;
                    }
                }
            }
        }

        std::swap(ff_cur, ff_next);
    }

    for (int k = 0; k < 256; k++) digests[m_begin + k] = h[k];

    _mm_free(sig);
    if (ff_cur) _mm_free(ff_cur);
    if (ff_next) _mm_free(ff_next);
    if (rf32) _mm_free(rf32);
}

} // namespace

std::vector<uint64_t> simulate(const Circuit& c) {
    std::vector<uint64_t> digests(c.M, 0ULL);
    if (c.M == 0 || c.T == 0 || c.O == 0) return digests;

    CompiledCircuit cc = compile_circuit(c);

    if (c.M < 256 || (int64_t)cc.gates.size() * c.M * c.T < 2000000LL) {
        for (int m = 0; m < c.M; m += 64) {
            int end = std::min(c.M, m + 64);
            simulate_scalar_chunk(cc, c, m, end, digests);
        }
        return digests;
    }

    JitKernel jit;
    jit.build(cc);

    int n_blocks = c.M / 256;
    #pragma omp parallel num_threads(8)
    {
        #pragma omp for schedule(dynamic, 1)
        for (int b = 0; b < n_blocks; b++) {
            simulate_avx2_256(cc, &jit, c, b * 256, digests);
        }
    }

    int rem_start = n_blocks * 256;
    for (int m = rem_start; m < c.M; m += 64) {
        int end = std::min(c.M, m + 64);
        simulate_scalar_chunk(cc, c, m, end, digests);
    }
    return digests;
}
