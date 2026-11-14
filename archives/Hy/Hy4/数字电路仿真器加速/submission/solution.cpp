#include <cstdint>
#include <vector>
#include <cstring>
#include <immintrin.h>
#include <omp.h>
#ifdef DBG
#include <cstdio>
#endif

#ifndef GATE_MODE
#define GATE_MODE 1
#endif
#ifdef USE_O3
#pragma GCC optimize("O3,unroll-loops")
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
    uint64_t z = x + 0x9E3779B97F4A7C15ULL;
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}
static inline uint64_t sm_next(uint64_t &s) {
    uint64_t z = (s += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}

struct Op {
    int32_t s0, s1, s2, sout;
    uint8_t t;
    uint8_t code;
};

std::vector<uint64_t> simulate(const Circuit& c) {
    const int I = c.I, F = c.F, G = c.G, O = c.O, M = c.M, T = c.T;
    const uint64_t seed = c.seed;
    const int base = I + F + 2;

    // ----- topological order of gates (Kahn) -----
    std::vector<int> indeg(G, 0), succ_cnt(G, 0);
    for (int k = 0; k < G; k++) {
        int x0 = c.in0[k], x1 = c.in1[k], x2 = c.in2[k];
        if (x0 >= base) { indeg[k]++; succ_cnt[x0 - base]++; }
        if (x1 >= base) { indeg[k]++; succ_cnt[x1 - base]++; }
        if (x2 >= base) { indeg[k]++; succ_cnt[x2 - base]++; }
    }
    std::vector<int> off(G + 1, 0);
    for (int k = 0; k < G; k++) off[k + 1] = off[k] + succ_cnt[k];
    std::vector<int> adj(off[G]);
    {
        std::vector<int> cur(off.begin(), off.end() - 1);
        for (int k = 0; k < G; k++) {
            int x0 = c.in0[k], x1 = c.in1[k], x2 = c.in2[k];
            if (x0 >= base) adj[cur[x0 - base]++] = k;
            if (x1 >= base) adj[cur[x1 - base]++] = k;
            if (x2 >= base) adj[cur[x2 - base]++] = k;
        }
    }
    std::vector<int> order; order.reserve(G);
#if GATE_MODE == 3
    {
        // type-prioritized LIFO Kahn: emit ready gates of the current type as long
        // as possible (long same-type runs); LIFO keeps the live set small.
        std::vector<int> q[8];
        for (int k = 0; k < G; k++) if (indeg[k] == 0) q[c.type[k]].push_back(k);
        int curtype = -1;
        long long remaining = G;
        while (remaining > 0) {
            int pick = -1;
            if (curtype >= 0 && !q[curtype].empty()) {
                pick = curtype;
            } else {
                size_t best = 0;
                for (int ty = 0; ty < 8; ty++) {
                    if (q[ty].size() > best) { best = q[ty].size(); pick = ty; }
                }
            }
            if (pick < 0 || q[pick].empty()) break;
            int g = q[pick].back();
            q[pick].pop_back();
            order.push_back(g);
            curtype = c.type[g];
            remaining--;
            for (int e = off[g]; e < off[g + 1]; e++) {
                int k = adj[e];
                if (--indeg[k] == 0) q[c.type[k]].push_back(k);
            }
        }
    }
#else
    {
        std::vector<int> q; q.reserve(G);
        for (int k = 0; k < G; k++) if (indeg[k] == 0) q.push_back(k);
        for (size_t qi = 0; qi < q.size(); qi++) {
            int g = q[qi];
            order.push_back(g);
            for (int e = off[g]; e < off[g + 1]; e++) {
                int k = adj[e];
                if (--indeg[k] == 0) q.push_back(k);
            }
        }
    }
#endif
    std::vector<int> pos(G);
    for (int p = 0; p < G; p++) pos[order[p]] = p;

#ifdef FLAT_ARRAY
    // Flat eval-index layout: gate at order position p writes to slot (base+p).
    // Sequential writes -> hardware-prefetch friendly.
    std::vector<int> slot_of_gate(G);
    for (int p = 0; p < G; p++) slot_of_gate[p] = base + p;
    const int num_slots = base + G;
#else
    // ----- last use (topo position) of each gate output -----
    std::vector<int> last_use(G);
    for (int p = 0; p < G; p++) last_use[p] = p;
    for (int q = 0; q < G; q++) {
        int g = order[q];
        int x0 = c.in0[g], x1 = c.in1[g], x2 = c.in2[g];
        if (x0 >= base) { int &lu = last_use[pos[x0 - base]]; if (q > lu) lu = q; }
        if (x1 >= base) { int &lu = last_use[pos[x1 - base]]; if (q > lu) lu = q; }
        if (x2 >= base) { int &lu = last_use[pos[x2 - base]]; if (q > lu) lu = q; }
    }
    for (int j = 0; j < O; j++) { int x = c.out[j]; if (x >= base) last_use[pos[x - base]] = G; }
    for (int f = 0; f < F; f++) { int x = c.d[f];   if (x >= base) last_use[pos[x - base]] = G; }

    // ----- linear-scan slot allocation -----
    std::vector<int> slot_of_gate(G);
    std::vector<int> head(G + 2, -1);
    std::vector<int> evt_slot, evt_next;
    evt_slot.reserve(G); evt_next.reserve(G);
    std::vector<int> freestk; freestk.reserve(1 << 16);
    int next_slot = base;
    for (int p = 0; p < G; p++) {
        for (int e = head[p]; e != -1; e = evt_next[e]) freestk.push_back(evt_slot[e]);
        int s;
        if (!freestk.empty()) { s = freestk.back(); freestk.pop_back(); }
        else s = next_slot++;
        slot_of_gate[p] = s;
        int d = last_use[p] + 1;
        if (d <= G - 1) {
            int idx = (int)evt_slot.size();
            evt_slot.push_back(s);
            evt_next.push_back(head[d]);
            head[d] = idx;
        }
    }
    const int num_slots = next_slot;
#endif
#ifdef DBG
    { FILE* ff = fopen("stats.txt", "a"); fprintf(ff, "G=%d num_slots=%d M=%d T=%d\n", G, num_slots, M, T); fclose(ff); }
#endif

    auto sig2slot = [&](int x) -> int {
        if (x < 0) return 0;
        if (x < base) return x;
        return slot_of_gate[pos[x - base]];
    };

    std::vector<Op> ops(G);
    for (int p = 0; p < G; p++) {
        int g = order[p];
        Op &o = ops[p];
        o.t = c.type[g];
        o.s0 = sig2slot(c.in0[g]);
        o.s1 = sig2slot(c.in1[g]);
        o.s2 = sig2slot(c.in2[g]);
        o.sout = slot_of_gate[p];
        static const int ANFC[8] = {8, 14, 6, 9, 15, 7, 3, 0}; // ANF2 4-bit code per type
        o.code = (uint8_t)ANFC[c.type[g]];
    }
    std::vector<int> out_slot(O), dslot(F);
    for (int j = 0; j < O; j++) out_slot[j] = sig2slot(c.out[j]);
    for (int f = 0; f < F; f++) dslot[f] = sig2slot(c.d[f]);

    std::vector<uint64_t> mixval((size_t)T * O);
    for (size_t k = 0; k < (size_t)T * O; k++) mixval[k] = mix64((uint64_t)k);

#if GATE_MODE == 3
    std::vector<int> run_start, run_end;
    std::vector<uint8_t> run_type;
    {
        int p = 0;
        while (p < G) {
            uint8_t ty = ops[p].t;
            int st = p;
            while (p < G && ops[p].t == ty) p++;
            run_start.push_back(st);
            run_end.push_back(p);
            run_type.push_back(ty);
        }
    }
    const int nruns = (int)run_type.size();
#endif

    const int V = (M + 255) / 256;
    std::vector<uint64_t> result((size_t)M, 0);

    int nt = omp_get_max_threads();
#ifdef FORCE_NT
    nt = FORCE_NT;
#endif
    if (nt > V) nt = V;
    if (nt < 1) nt = 1;

    const size_t pool_words = (size_t)num_slots * 4;
    const size_t pib_words = (size_t)T * I * 4;
    const size_t ff_words = (size_t)F * 4 + 4;

    // 6-term ANF: f = c0 ^ c1*a ^ c2*b ^ c3*c ^ c4*(a&b) ^ c5*(a&c)
    // a=in0, b=in1, c=in2 (c=0 for non-MUX). Handles all 8 gate types branchlessly.
    static const int ANF[8][6] = {
        {0,0,0,0,1,0}, // AND
        {0,1,1,0,1,0}, // OR
        {0,1,1,0,0,0}, // XOR
        {1,0,0,0,1,0}, // NAND
        {1,1,1,0,1,0}, // NOR
        {1,1,1,0,0,0}, // XNOR
        {1,1,0,0,0,0}, // NOT
        {0,0,1,0,1,1}, // MUX: b ^ (a&b) ^ (a&c)
    };
    __m256i MT[8][6];
    for (int q = 0; q < 8; q++)
        for (int j = 0; j < 6; j++)
            MT[q][j] = _mm256_set1_epi64x(ANF[q][j] ? -1LL : 0LL);

    #pragma omp parallel num_threads(nt)
    {
        uint64_t* pool  = (uint64_t*)_mm_malloc(pool_words * 8 + 32, 32);
        uint64_t* pib   = (uint64_t*)_mm_malloc(pib_words * 8 + 32, 32);
        uint64_t* newFF = (uint64_t*)_mm_malloc(ff_words * 8 + 32, 32);
        uint64_t H[64][4];

        #pragma omp for schedule(static)
        for (int chunk = 0; chunk < V; chunk++) {
            const int gbase = chunk * 256;
            // initial state: all FF = 0, const0 = 0, const1 = all ones
            memset(pool, 0, pool_words * 8);
            for (int w = 0; w < 4; w++) pool[4 + w] = ~0ULL;
            memset(H, 0, sizeof(H));

            // precompute PI bit-vectors for this chunk of 256 groups
            if (pib_words) memset(pib, 0, pib_words * 8);
            for (int p = 0; p < 256; p++) {
                int gg = gbase + p;
                if (gg >= M) break;
                uint64_t s = mix64(seed ^ (uint64_t)gg);
                for (int t = 0; t < T; t++) {
                    uint64_t r = sm_next(s);
                    for (int i = 0; i < I; i++) {
                        if ((r >> i) & 1ULL)
                            pib[((size_t)t * I + i) * 4 + (p >> 6)] |= 1ULL << (p & 63);
                    }
                }
            }

            for (int t = 0; t < T; t++) {
                // step 1: primary inputs
                for (int i = 0; i < I; i++)
                    memcpy(&pool[(2 + i) * 4], &pib[((size_t)t * I + i) * 4], 32);

                // step 2: combinational gates in topological order
                const __m256i ONES = _mm256_set1_epi64x(-1);
#if GATE_MODE == 3
                for (int ri = 0; ri < nruns; ri++) {
                    int st = run_start[ri], en = run_end[ri];
                    const Op* op = &ops[st];
                    switch (run_type[ri]) {
                        case 0: for (int p=st;p<en;p++,op++){
                            __m256i a=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s0*4]);
                            __m256i b=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s1*4]);
                            _mm256_store_si256((__m256i*)&pool[(size_t)op->sout*4], _mm256_and_si256(a,b));
                        } break;
                        case 1: for (int p=st;p<en;p++,op++){
                            __m256i a=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s0*4]);
                            __m256i b=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s1*4]);
                            _mm256_store_si256((__m256i*)&pool[(size_t)op->sout*4], _mm256_or_si256(a,b));
                        } break;
                        case 2: for (int p=st;p<en;p++,op++){
                            __m256i a=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s0*4]);
                            __m256i b=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s1*4]);
                            _mm256_store_si256((__m256i*)&pool[(size_t)op->sout*4], _mm256_xor_si256(a,b));
                        } break;
                        case 3: for (int p=st;p<en;p++,op++){
                            __m256i a=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s0*4]);
                            __m256i b=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s1*4]);
                            _mm256_store_si256((__m256i*)&pool[(size_t)op->sout*4], _mm256_xor_si256(_mm256_and_si256(a,b),ONES));
                        } break;
                        case 4: for (int p=st;p<en;p++,op++){
                            __m256i a=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s0*4]);
                            __m256i b=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s1*4]);
                            _mm256_store_si256((__m256i*)&pool[(size_t)op->sout*4], _mm256_xor_si256(_mm256_or_si256(a,b),ONES));
                        } break;
                        case 5: for (int p=st;p<en;p++,op++){
                            __m256i a=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s0*4]);
                            __m256i b=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s1*4]);
                            _mm256_store_si256((__m256i*)&pool[(size_t)op->sout*4], _mm256_xor_si256(_mm256_xor_si256(a,b),ONES));
                        } break;
                        case 6: for (int p=st;p<en;p++,op++){
                            __m256i a=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s0*4]);
                            _mm256_store_si256((__m256i*)&pool[(size_t)op->sout*4], _mm256_xor_si256(a,ONES));
                        } break;
                        default: for (int p=st;p<en;p++,op++){
                            __m256i a=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s0*4]);
                            __m256i b=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s1*4]);
                            __m256i c=_mm256_load_si256((const __m256i*)&pool[(size_t)op->s2*4]);
                            _mm256_store_si256((__m256i*)&pool[(size_t)op->sout*4], _mm256_xor_si256(b,_mm256_and_si256(a,_mm256_xor_si256(b,c))));
                        } break;
                    }
                }
#elif GATE_MODE == 5
                const Op* op = ops.data();
                // ANF2 with broadcast-generated masks + MUX branch
                for (int p = 0; p < G; p++, op++) {
                    __m256i a = _mm256_load_si256((const __m256i*)&pool[(size_t)op->s0 * 4]);
                    __m256i b = _mm256_load_si256((const __m256i*)&pool[(size_t)op->s1 * 4]);
                    __m256i r;
                    if (op->t == 7) {
                        __m256i c = _mm256_load_si256((const __m256i*)&pool[(size_t)op->s2 * 4]);
                        r = _mm256_xor_si256(b, _mm256_and_si256(a, _mm256_xor_si256(b, c)));
                    } else {
                        int cd = op->code;
                        __m256i M0 = _mm256_set1_epi64x(-(int64_t)(cd & 1));
                        __m256i M1 = _mm256_set1_epi64x(-(int64_t)((cd >> 1) & 1));
                        __m256i M2 = _mm256_set1_epi64x(-(int64_t)((cd >> 2) & 1));
                        __m256i M3 = _mm256_set1_epi64x(-(int64_t)((cd >> 3) & 1));
                        __m256i ab = _mm256_and_si256(a, b);
                        __m256i x = _mm256_xor_si256(M0, _mm256_and_si256(M1, a));
                        x = _mm256_xor_si256(x, _mm256_and_si256(M2, b));
                        r = _mm256_xor_si256(x, _mm256_and_si256(M3, ab));
                    }
                    _mm256_store_si256((__m256i*)&pool[(size_t)op->sout * 4], r);
                }
#else
                const Op* op = ops.data();
                // DUAL: branch on MUX (well predicted when MUX is rare), ANF2 with mask-table loads
                for (int p = 0; p < G; p++, op++) {
                    __m256i a = _mm256_load_si256((const __m256i*)&pool[(size_t)op->s0 * 4]);
                    __m256i b = _mm256_load_si256((const __m256i*)&pool[(size_t)op->s1 * 4]);
                    __m256i r;
                    if (op->t == 7) {
                        __m256i c = _mm256_load_si256((const __m256i*)&pool[(size_t)op->s2 * 4]);
                        r = _mm256_xor_si256(b, _mm256_and_si256(a, _mm256_xor_si256(b, c)));
                    } else {
                        const __m256i* M = MT[op->t];
                        __m256i ab = _mm256_and_si256(a, b);
                        __m256i x = _mm256_xor_si256(M[0], _mm256_and_si256(M[1], a));
                        x = _mm256_xor_si256(x, _mm256_and_si256(M[2], b));
                        r = _mm256_xor_si256(x, _mm256_and_si256(M[4], ab));
                    }
                    _mm256_store_si256((__m256i*)&pool[(size_t)op->sout * 4], r);
                }
#endif

                // step 3: primary outputs -> digest
                for (int j = 0; j < O; j++) {
                    uint64_t K = mixval[(size_t)t * O + j];
                    const uint64_t* ov = &pool[(size_t)out_slot[j] * 4];
                    while (K) {
                        int bb = __builtin_ctzll(K);
                        K &= K - 1;
                        H[bb][0] ^= ov[0]; H[bb][1] ^= ov[1];
                        H[bb][2] ^= ov[2]; H[bb][3] ^= ov[3];
                    }
                }

                // step 4: simultaneous FF update
                for (int f = 0; f < F; f++)
                    memcpy(&newFF[(size_t)f * 4], &pool[(size_t)dslot[f] * 4], 32);
                for (int f = 0; f < F; f++)
                    memcpy(&pool[(size_t)(I + 2 + f) * 4], &newFF[(size_t)f * 4], 32);
            }

            // reconstruct per-group digests
            for (int w = 0; w < 4; w++) {
                for (int q = 0; q < 64; q++) {
                    int gg = gbase + w * 64 + q;
                    if (gg >= M) continue;
                    uint64_t h = 0;
                    for (int bb = 0; bb < 64; bb++)
                        if ((H[bb][w] >> q) & 1ULL) h |= 1ULL << bb;
                    result[gg] = h;
                }
            }
        }
        _mm_free(pool);
        _mm_free(pib);
        _mm_free(newFF);
    }

    return result;
}
