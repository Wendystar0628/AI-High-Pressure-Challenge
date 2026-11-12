// solution.cpp — synchronous sequential circuit simulator (bit-parallel across stimuli)
// COI prune, topological order, levelize + type-sorted runs, 64-wide bit-parallel,
// hybrid eval: run-specialized loops for long runs, branchless cmov kernel for short runs.
#include <cstdint>
#include <vector>
#include <algorithm>
#include <cstring>
#include <cstdlib>

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

static inline uint64_t mix64(uint64_t x) {
    x += 0x9E3779B97F4A7C15ULL;
    x = (x ^ (x >> 30)) * 0xBF58476D1CE4E5B9ULL;
    x = (x ^ (x >> 27)) * 0x94D049BB133111EBULL;
    return x ^ (x >> 31);
}

static void transpose64(uint64_t x[64]) {
    uint64_t m = 0x00000000FFFFFFFFULL;
    int j = 32;
    while (j > 0) {
        for (int k = 0; k < 64; k++) {
            if (k & j) continue;
            uint64_t t = ((x[k] >> j) ^ x[k | j]) & m;
            x[k] ^= t << j;
            x[k | j] ^= t;
        }
        if (j == 1) break;
        j >>= 1;
        m ^= m << j;
    }
}

enum : uint8_t { OP_AND = 0, OP_NAND, OP_OR, OP_NOR, OP_XOR, OP_XNOR, OP_MUX };

std::vector<uint64_t> simulate(const Circuit& c) {
    const int I = c.I, F = c.F, G = c.G, O = c.O, M = c.M, T = c.T;
    std::vector<uint64_t> H((size_t)M, 0);
    if (M <= 0 || T < 0) return H;

    const int sigBase = 2 + I + F;

    // ---- cone of influence ----
    std::vector<uint8_t> live((size_t)sigBase + G, 0);
    std::vector<int> stack;
    stack.reserve(sigBase + G);
    for (int j = 0; j < O; j++) {
        int s = c.out[j];
        if (s >= 0 && s < (int)live.size() && !live[s]) { live[s] = 1; stack.push_back(s); }
    }
    for (int f = 0; f < F; f++) {
        int s = c.d[f];
        if (s >= 0 && s < (int)live.size() && !live[s]) { live[s] = 1; stack.push_back(s); }
    }
    while (!stack.empty()) {
        int s = stack.back();
        stack.pop_back();
        if (s >= sigBase) {
            int k = s - sigBase;
            int ins[3] = {c.in0[k], c.in1[k], c.in2[k]};
            for (int t = 0; t < 3; t++) {
                int u = ins[t];
                if (u >= 0 && u < (int)live.size() && !live[u]) { live[u] = 1; stack.push_back(u); }
            }
        }
    }

    // ---- topo sort + levelize ----
    std::vector<int> indeg(G, 0);
    std::vector<std::vector<int>> fanout(G);
    for (int k = 0; k < G; k++) {
        if (!live[sigBase + k]) continue;
        int ins[3] = {c.in0[k], c.in1[k], c.in2[k]};
        for (int t = 0; t < 3; t++) {
            int u = ins[t];
            if (u >= sigBase && u < sigBase + G && live[u]) {
                indeg[k]++;
                fanout[u - sigBase].push_back(k);
            }
        }
    }
    std::vector<int> topo;
    topo.reserve(G);
    std::vector<int> level(G, 0);
    {
        std::vector<int> q;
        q.reserve(G);
        for (int k = 0; k < G; k++)
            if (live[sigBase + k] && indeg[k] == 0) q.push_back(k);
        for (size_t i = 0; i < q.size(); i++) {
            int k = q[i];
            topo.push_back(k);
            for (int w : fanout[k]) {
                if (level[w] < level[k] + 1) level[w] = level[k] + 1;
                if (--indeg[w] == 0) q.push_back(w);
            }
        }
    }
    const int ng = (int)topo.size();

    // ---- normalize ops (NOT -> XOR with const1) ----
    std::vector<uint8_t> nrm((size_t)ng);
    std::vector<int> bov((size_t)ng, -1);
    for (int pos = 0; pos < ng; pos++) {
        int k = topo[pos];
        switch (c.type[k]) {
            case 0: nrm[pos] = OP_AND; break;
            case 1: nrm[pos] = OP_OR; break;
            case 2: nrm[pos] = OP_XOR; break;
            case 3: nrm[pos] = OP_NAND; break;
            case 4: nrm[pos] = OP_NOR; break;
            case 5: nrm[pos] = OP_XNOR; break;
            case 6: nrm[pos] = OP_XOR; bov[pos] = 1; break;
            default: nrm[pos] = OP_MUX; break;
        }
    }

    // ---- eval order: sort by op within each level ----
    int maxlev = 0;
    for (int k = 0; k < G; k++)
        if (live[sigBase + k]) maxlev = std::max(maxlev, level[k]);
    const int nlev = maxlev + 1;
    std::vector<int> lstart((size_t)nlev + 1, 0);
    for (int pos = 0; pos < ng; pos++) lstart[level[topo[pos]] + 1]++;
    for (int l = 0; l < nlev; l++) lstart[l + 1] += lstart[l];
    std::vector<int> eval2topo((size_t)ng);
    {
        std::vector<int> cursor = lstart;
        for (int pos = 0; pos < ng; pos++) eval2topo[cursor[level[topo[pos]]]++] = pos;
        for (int l = 0; l < nlev; l++)
            std::sort(eval2topo.begin() + lstart[l], eval2topo.begin() + lstart[l + 1],
                      [&](int a, int b) { return nrm[a] < nrm[b]; });
    }

    // ---- renumber signals in eval order ----
    const int gateBase = 2 + I + F;
    const int nsig = gateBase + ng;
    std::vector<int> remap((size_t)sigBase + G, -1);
    for (int s = 0; s < sigBase; s++) remap[s] = s;
    for (int p = 0; p < ng; p++) remap[sigBase + topo[eval2topo[p]]] = gateBase + p;

    // ---- gate metadata ----
    // ctl = i0 | i1<<32 ; sel = third input (MUX select, 0 otherwise) ; op = normalized op
    std::vector<uint64_t> ctl((size_t)ng);
    std::vector<uint32_t> sel((size_t)ng, 0);
    std::vector<uint8_t> op((size_t)ng);
    for (int p = 0; p < ng; p++) {
        int k = topo[eval2topo[p]];
        int bo = bov[eval2topo[p]];
        uint8_t o = nrm[eval2topo[p]];
        if (o == OP_MUX) {
            uint32_t da = (uint32_t)remap[c.in1[k]];
            uint32_t db = (uint32_t)remap[c.in2[k]];
            ctl[p] = (uint64_t)da | ((uint64_t)db << 32);
            sel[p] = (uint32_t)remap[c.in0[k]];
        } else {
            uint32_t x0 = (uint32_t)remap[c.in0[k]];
            uint32_t x1 = (bo >= 0) ? (uint32_t)bo : (uint32_t)remap[c.in1[k]];
            ctl[p] = (uint64_t)x0 | ((uint64_t)x1 << 32);
        }
        op[p] = o;
    }
    std::vector<uint32_t> didx(F), ffslot(F);
    for (int f = 0; f < F; f++) {
        didx[f] = (uint32_t)remap[c.d[f]];
        ffslot[f] = (uint32_t)(2 + I + f);
    }
    std::vector<uint32_t> outidx(O);
    for (int j = 0; j < O; j++) outidx[j] = (uint32_t)remap[c.out[j]];

    // ---- runs ----
    struct Run { uint8_t o; int s, e; };
    std::vector<Run> runs;
    {
        int maxRun = 0;
        for (int p = 0; p < ng;) {
            int q = p + 1;
            while (q < ng && op[q] == op[p]) q++;
            runs.push_back({op[p], p, q});
            maxRun = std::max(maxRun, q - p);
            p = q;
        }
        (void)maxRun;
    }

    // ---- stimuli R[t][m] ----
    std::vector<uint64_t> R((size_t)T * M);
    for (int m = 0; m < M; m++) {
        uint64_t s = mix64(c.seed ^ (uint64_t)m);
        for (int t = 0; t < T; t++) {
            s += 0x9E3779B97F4A7C15ULL;
            uint64_t z = s;
            z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
            z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
            R[(size_t)t * M + m] = z ^ (z >> 31);
        }
    }

    // decide: long runs -> specialized switch loops; else branchless
    long long runLenSum = 0;
    int longRuns = 0;
    for (auto& r : runs) {
        runLenSum += r.e - r.s;
        if (r.e - r.s >= 8) longRuns++;
    }
    // fraction of gates covered by runs of length >= 8
    long long covered = 0;
    for (auto& r : runs)
        if (r.e - r.s >= 8) covered += r.e - r.s;
    const bool useRuns = (covered * 2 >= ng); // >=50% of gates in long runs

    const int ngroups = (M + 63) / 64;

#ifdef _OPENMP
#pragma omp parallel
#endif
    {
        std::vector<uint64_t> vals((size_t)nsig);
        std::vector<uint64_t> newff((size_t)(F > 0 ? F : 1));
        uint64_t row[64];

#ifdef _OPENMP
#pragma omp for schedule(dynamic, 1)
#endif
        for (int g = 0; g < ngroups; g++) {
            const int base_m = g * 64;
            const int n = (M - base_m > 64) ? 64 : (M - base_m);
            std::memset(vals.data(), 0, (size_t)nsig * 8);
            vals[1] = ~0ULL;
            uint64_t Hloc[64];
            std::memset(Hloc, 0, sizeof Hloc);

            for (int t = 0; t < T; t++) {
                for (int m = 0; m < 64; m++)
                    row[m] = (m < n) ? R[(size_t)t * M + base_m + m] : 0;
                transpose64(row);
                for (int i = 0; i < I; i++) vals[2 + i] = row[i];

                if (useRuns) {
                    for (const Run& rn : runs) {
                        switch (rn.o) {
                            case OP_AND:
                                for (int k = rn.s; k < rn.e; k++) {
                                    uint64_t pk = ctl[k];
                                    vals[gateBase + k] = vals[(uint32_t)pk] & vals[pk >> 32];
                                }
                                break;
                            case OP_NAND:
                                for (int k = rn.s; k < rn.e; k++) {
                                    uint64_t pk = ctl[k];
                                    vals[gateBase + k] = ~(vals[(uint32_t)pk] & vals[pk >> 32]);
                                }
                                break;
                            case OP_OR:
                                for (int k = rn.s; k < rn.e; k++) {
                                    uint64_t pk = ctl[k];
                                    vals[gateBase + k] = vals[(uint32_t)pk] | vals[pk >> 32];
                                }
                                break;
                            case OP_NOR:
                                for (int k = rn.s; k < rn.e; k++) {
                                    uint64_t pk = ctl[k];
                                    vals[gateBase + k] = ~(vals[(uint32_t)pk] | vals[pk >> 32]);
                                }
                                break;
                            case OP_XOR:
                                for (int k = rn.s; k < rn.e; k++) {
                                    uint64_t pk = ctl[k];
                                    vals[gateBase + k] = vals[(uint32_t)pk] ^ vals[pk >> 32];
                                }
                                break;
                            case OP_XNOR:
                                for (int k = rn.s; k < rn.e; k++) {
                                    uint64_t pk = ctl[k];
                                    vals[gateBase + k] = ~(vals[(uint32_t)pk] ^ vals[pk >> 32]);
                                }
                                break;
                            case OP_MUX:
                                for (int k = rn.s; k < rn.e; k++) {
                                    uint64_t pk = ctl[k];
                                    uint64_t da = vals[(uint32_t)pk];
                                    uint64_t db = vals[pk >> 32];
                                    uint64_t s = vals[sel[k]];
                                    vals[gateBase + k] = da ^ ((da ^ db) & s);
                                }
                                break;
                            default: break;
                        }
                    }
                } else {
                    // branchless kernel (cmov-based select, no unpredictable branches)
                    for (int k = 0; k < ng; k++) {
                        uint64_t pk = ctl[k];
                        uint64_t a = vals[(uint32_t)pk], b = vals[pk >> 32];
                        uint64_t u = a & b, v = a ^ b;
                        uint64_t s = vals[sel[k]];
                        uint64_t muxv = a ^ (v & s);
                        uint64_t orv = u | v;
                        uint8_t o = op[k];
                        // sel2: 0 -> u, 1 -> orv, 2 -> v, 3 -> muxv
                        uint64_t sel2 = o >> 1; // 0,0,1,1,2,2,3
                        uint64_t lo = (sel2 & 1) ? orv : u;
                        uint64_t hi = (sel2 & 1) ? muxv : v;
                        uint64_t r = (sel2 & 2) ? hi : lo;
                        r ^= -(uint64_t)(o & 1);
                        vals[gateBase + k] = r;
                    }
                }

                for (int j = 0; j < O; j++) {
                    uint64_t w = vals[outidx[j]];
                    const uint64_t cc = mix64((uint64_t)t * (uint64_t)O + (uint64_t)j);
                    while (w) {
                        int m = __builtin_ctzll(w);
                        Hloc[m] ^= cc;
                        w &= w - 1;
                    }
                }

                if (F > 0) {
                    for (int f = 0; f < F; f++) newff[f] = vals[didx[f]];
                    for (int f = 0; f < F; f++) vals[ffslot[f]] = newff[f];
                }
            }
            for (int m = 0; m < n; m++) H[(size_t)base_m + m] = Hloc[m];
        }
    }
    return H;
}
