#include <cstdint>
#include <vector>
#include <cstring>
#include <algorithm>
#include <immintrin.h>
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

static inline uint64_t splitmix64_next(uint64_t* s) {
    uint64_t z = (*s += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}
static inline uint64_t mix64(uint64_t x) { return splitmix64_next(&x); }

#define PW 256
typedef __m256i Vec;
static const Vec VONES = _mm256_set1_epi64x(-1);

std::vector<uint64_t> simulate(const Circuit& c) {
    const int I = c.I, F = c.F, G = c.G, O = c.O, M = c.M, T = c.T;
    const uint64_t seed = c.seed;
    const int gate_base = I + F + 2;
    const int n_sig = gate_base + G;

    // 1. Build reverse dependency CSR + in-degrees
    std::vector<int> indeg(G, 0), rev_count(G, 0);
    for (int k = 0; k < G; k++) {
        int t = c.type[k];
        int nin = (t == 6) ? 1 : (t == 7) ? 3 : 2;
        const int ins[3] = {c.in0[k], c.in1[k], c.in2[k]};
        for (int j = 0; j < nin; j++)
            if (ins[j] >= gate_base) { indeg[k]++; rev_count[ins[j] - gate_base]++; }
    }
    std::vector<int> rev_off(G + 1, 0);
    for (int k = 0; k < G; k++) rev_off[k+1] = rev_off[k] + rev_count[k];
    std::vector<int> rev_data(rev_off[G]);
    {
        std::vector<int> pos(rev_off.begin(), rev_off.begin() + G);
        for (int k = 0; k < G; k++) {
            int t = c.type[k];
            int nin = (t == 6) ? 1 : (t == 7) ? 3 : 2;
            const int ins[3] = {c.in0[k], c.in1[k], c.in2[k]};
            for (int j = 0; j < nin; j++)
                if (ins[j] >= gate_base) rev_data[pos[ins[j]-gate_base]++] = k;
        }
    }

    // 2. Kahn's topological sort
    std::vector<int> topo;
    topo.reserve(G);
    {
        std::vector<int> q;
        q.reserve(G);
        for (int k = 0; k < G; k++) if (!indeg[k]) q.push_back(k);
        for (int i = 0; i < (int)q.size(); i++) {
            int k = q[i];
            topo.push_back(k);
            for (int j = rev_off[k]; j < rev_off[k+1]; j++)
                if (--indeg[rev_data[j]] == 0) q.push_back(rev_data[j]);
        }
    }

    // 3. Compute levels
    std::vector<int32_t> level(G, 0);
    for (int idx = 0; idx < (int)topo.size(); idx++) {
        int k = topo[idx];
        int t = c.type[k];
        int nin = (t == 6) ? 1 : (t == 7) ? 3 : 2;
        const int ins[3] = {c.in0[k], c.in1[k], c.in2[k]};
        int lv = 0;
        for (int j = 0; j < nin; j++)
            if (ins[j] >= gate_base) { int dl = level[ins[j]-gate_base]; if (dl > lv) lv = dl; }
        level[k] = lv + 1;
    }

    // 4. Sort by (level, type) for long same-type runs
    std::vector<int> order = topo;
    std::sort(order.begin(), order.end(), [&](int a, int b) {
        return level[a] != level[b] ? level[a] < level[b] : c.type[a] < c.type[b];
    });

    // 5. Simplification: const prop + identity/inverse
    std::vector<int> subst(n_sig);
    for (int s = 0; s < n_sig; s++) subst[s] = s;
    std::vector<int8_t> is_const(n_sig, -1);
    is_const[0] = 0; is_const[1] = 1;

    struct EvalOp { uint8_t type; int32_t in0, in1, in2, out; };
    std::vector<EvalOp> eval_ops;
    eval_ops.reserve(G);

    for (int idx = 0; idx < (int)order.size(); idx++) {
        int k = order[idx], t = c.type[k], sig_out = gate_base + k;
        int ra = subst[c.in0[k]];
        int rb = (t != 6) ? subst[c.in1[k]] : -1;
        int rc = (t == 7) ? subst[c.in2[k]] : -1;
        int8_t ca = is_const[ra], cb = (rb>=0)?is_const[rb]:-1, cc = (rc>=0)?is_const[rc]:-1;

        if (t == 6) {
            if (ca >= 0) is_const[sig_out] = 1 - ca;
            else eval_ops.push_back({6, ra, -1, -1, sig_out});
        } else if (t == 7) {
            if (ca>=0&&cb>=0&&cc>=0) is_const[sig_out]=ca?cc:cb;
            else if (ca==0) { if(cb>=0)is_const[sig_out]=cb; else subst[sig_out]=rb; }
            else if (ca==1) { if(cc>=0)is_const[sig_out]=cc; else subst[sig_out]=rc; }
            else if (cb>=0&&cc>=0&&cb==cc) is_const[sig_out]=cb;
            else if (cb==0&&cc==1) subst[sig_out]=ra;
            else if (cb==1&&cc==0) eval_ops.push_back({6,ra,-1,-1,sig_out});
            else eval_ops.push_back({7,ra,rb,rc,sig_out});
        } else {
            bool done = false;
            if (ca>=0&&cb>=0) {
                int r; switch(t){case 0:r=ca&cb;break;case 1:r=ca|cb;break;case 2:r=ca^cb;break;
                case 3:r=1-(ca&cb);break;case 4:r=1-(ca|cb);break;default:r=1-(ca^cb);break;}
                is_const[sig_out]=r; done=true;
            } else if (cb>=0&&ca<0) {
                int x=ra; switch(t){
                case 0: if(!cb){is_const[sig_out]=0;}else{subst[sig_out]=x;} done=true;break;
                case 1: if(cb){is_const[sig_out]=1;}else{subst[sig_out]=x;} done=true;break;
                case 2: if(!cb){subst[sig_out]=x;}else{eval_ops.push_back({6,x,-1,-1,sig_out});} done=true;break;
                case 3: if(!cb){is_const[sig_out]=1;}else{eval_ops.push_back({6,x,-1,-1,sig_out});} done=true;break;
                case 4: if(cb){is_const[sig_out]=0;}else{eval_ops.push_back({6,x,-1,-1,sig_out});} done=true;break;
                case 5: if(cb){subst[sig_out]=x;}else{eval_ops.push_back({6,x,-1,-1,sig_out});} done=true;break;}
            } else if (ca>=0&&cb<0) {
                int x=rb; switch(t){
                case 0: if(!ca){is_const[sig_out]=0;}else{subst[sig_out]=x;} done=true;break;
                case 1: if(ca){is_const[sig_out]=1;}else{subst[sig_out]=x;} done=true;break;
                case 2: if(!ca){subst[sig_out]=x;}else{eval_ops.push_back({6,x,-1,-1,sig_out});} done=true;break;
                case 3: if(!ca){is_const[sig_out]=1;}else{eval_ops.push_back({6,x,-1,-1,sig_out});} done=true;break;
                case 4: if(ca){is_const[sig_out]=0;}else{eval_ops.push_back({6,x,-1,-1,sig_out});} done=true;break;
                case 5: if(ca){subst[sig_out]=x;}else{eval_ops.push_back({6,x,-1,-1,sig_out});} done=true;break;}
            }
            if (!done) eval_ops.push_back({(uint8_t)t, ra, rb, -1, sig_out});
        }
    }

    // 6. Resolve outputs and FF inputs
    std::vector<int> res_out(O), res_d(F);
    for (int j = 0; j < O; j++) res_out[j] = subst[c.out[j]];
    for (int f = 0; f < F; f++) res_d[f] = subst[c.d[f]];

    // 7. DCE
    std::vector<uint8_t> live(n_sig, 0);
    for (int j = 0; j < O; j++) live[res_out[j]] = 1;
    for (int f = 0; f < F; f++) live[res_d[f]] = 1;
    for (int idx = (int)eval_ops.size()-1; idx >= 0; idx--) {
        auto& op = eval_ops[idx];
        if (!live[op.out]) continue;
        live[op.in0]=1; if(op.in1>=0)live[op.in1]=1; if(op.in2>=0)live[op.in2]=1;
    }

    // 8. Build compact eval arrays (in topological order)
    std::vector<int32_t> op_in0, op_in1, op_in2, op_out;
    std::vector<uint8_t> op_type;
    for (auto& op : eval_ops) {
        if (live[op.out]) {
            op_type.push_back(op.type);
            op_in0.push_back(op.in0); op_in1.push_back(op.in1);
            op_in2.push_back(op.in2); op_out.push_back(op.out);
        }
    }
    const int n_ops = (int)op_in0.size();

    // 9. Signal remapping: compact indices in eval order for cache locality
    //    new layout: [0]=const0 [1]=const1 [2..I+1]=PIs [I+2..I+F+1]=FFs [I+F+2..]=gate outputs in eval order
    std::vector<int32_t> remap(n_sig, -1);
    remap[0] = 0; remap[1] = 1;
    for (int i = 0; i < I; i++) remap[2+i] = 2+i;
    for (int f = 0; f < F; f++) remap[I+2+f] = I+2+f;
    int next_idx = I + F + 2;
    for (int i = 0; i < n_ops; i++) remap[op_out[i]] = next_idx++;
    // Constant gate outputs -> 0 or 1
    for (int s = gate_base; s < n_sig; s++)
        if (is_const[s] == 0) remap[s] = 0;
        else if (is_const[s] == 1) remap[s] = 1;
    // Substituted signals -> target's remap
    for (int s = 0; s < n_sig; s++)
        if (remap[s] < 0 && subst[s] != s) remap[s] = remap[subst[s]];
    // Safety: any remaining unmapped -> 0
    for (int s = 0; s < n_sig; s++) if (remap[s] < 0) remap[s] = 0;

    // Apply remapping
    for (int i = 0; i < n_ops; i++) {
        op_in0[i] = remap[op_in0[i]];
        op_in1[i] = remap[op_in1[i]];
        op_in2[i] = remap[op_in2[i]];
        op_out[i] = remap[op_out[i]];
    }
    for (int j = 0; j < O; j++) res_out[j] = remap[res_out[j]];
    for (int f = 0; f < F; f++) res_d[f] = remap[res_d[f]];
    const int new_n_sig = next_idx;

    // 10. mix64 table
    std::vector<uint64_t> mix_table((size_t)T * O);
    for (int t = 0; t < T; t++)
        for (int j = 0; j < O; j++)
            mix_table[(size_t)t*O+j] = mix64((uint64_t)t*O+j);

    // 11. PRNG states
    std::vector<uint64_t> init_states(M);
    for (int m = 0; m < M; m++) init_states[m] = mix64(seed ^ (uint64_t)m);

    // === Simulation ===
    std::vector<uint64_t> H(M, 0);
    const int n_packs = (M + PW - 1) / PW;

    #pragma omp parallel
    {
        Vec* val = (Vec*)_mm_malloc((size_t)new_n_sig * sizeof(Vec), 64);
        Vec* ff_tmp = (Vec*)_mm_malloc((size_t)(F>0?F:1) * sizeof(Vec), 64);
        uint64_t rbuf[PW], tbuf[4][64];

        #pragma omp for schedule(static)
        for (int p = 0; p < n_packs; p++) {
            const int m0 = p * PW;
            const int m1 = std::min(m0 + PW, M);
            const int ng = m1 - m0;

            val[0] = _mm256_setzero_si256();
            val[1] = VONES;
            for (int f = 0; f < F; f++) val[I+2+f] = _mm256_setzero_si256();

            uint64_t ps[PW];
            for (int k = 0; k < PW; k++) ps[k] = (m0+k<M) ? init_states[m0+k] : 0;

            for (int t = 0; t < T; t++) {
                for (int k = 0; k < ng; k++) rbuf[k] = splitmix64_next(&ps[k]);

                // Transpose r -> PI (256x64 bit)
                for (int q = 0; q < 4; q++)
                    for (int i = 0; i < I; i++) {
                        uint64_t pi = 0;
                        for (int k = 0; k < 64; k++) pi |= ((rbuf[q*64+k] >> i) & 1) << k;
                        tbuf[q][i] = pi;
                    }
                for (int i = 0; i < I; i++)
                    val[2+i] = _mm256_set_epi64x((int64_t)tbuf[3][i],(int64_t)tbuf[2][i],
                                                  (int64_t)tbuf[1][i],(int64_t)tbuf[0][i]);

                // Evaluate gates with type-batched windows
                int idx = 0;
                while (idx < n_ops) {
                    uint8_t tt = op_type[idx];
                    int end = idx + 1;
                    while (end < n_ops && op_type[end] == tt) end++;
                    switch (tt) {
                        case 0: for(int i=idx;i<end;i++) val[op_out[i]]=_mm256_and_si256(val[op_in0[i]],val[op_in1[i]]); break;
                        case 1: for(int i=idx;i<end;i++) val[op_out[i]]=_mm256_or_si256(val[op_in0[i]],val[op_in1[i]]); break;
                        case 2: for(int i=idx;i<end;i++) val[op_out[i]]=_mm256_xor_si256(val[op_in0[i]],val[op_in1[i]]); break;
                        case 3: for(int i=idx;i<end;i++) val[op_out[i]]=_mm256_xor_si256(_mm256_and_si256(val[op_in0[i]],val[op_in1[i]]),VONES); break;
                        case 4: for(int i=idx;i<end;i++) val[op_out[i]]=_mm256_xor_si256(_mm256_or_si256(val[op_in0[i]],val[op_in1[i]]),VONES); break;
                        case 5: for(int i=idx;i<end;i++) val[op_out[i]]=_mm256_xor_si256(_mm256_xor_si256(val[op_in0[i]],val[op_in1[i]]),VONES); break;
                        case 6: for(int i=idx;i<end;i++) val[op_out[i]]=_mm256_xor_si256(val[op_in0[i]],VONES); break;
                        case 7: for(int i=idx;i<end;i++){Vec s=val[op_in0[i]];val[op_out[i]]=_mm256_or_si256(_mm256_and_si256(s,val[op_in2[i]]),_mm256_andnot_si256(s,val[op_in1[i]]));} break;
                    }
                    idx = end;
                }

                // Hash accumulation
                for (int j = 0; j < O; j++) {
                    uint64_t w4[4];
                    _mm256_storeu_si256((__m256i*)w4, val[res_out[j]]);
                    uint64_t mv = mix_table[(size_t)t*O+j];
                    for (int q = 0; q < 4; q++) {
                        uint64_t w = w4[q];
                        while (w) {
                            int k = __builtin_ctzll(w);
                            if (m0+q*64+k < M) H[m0+q*64+k] ^= mv;
                            w &= w - 1;
                        }
                    }
                }

                // FF update
                if (F > 0) {
                    for (int f = 0; f < F; f++) ff_tmp[f] = val[res_d[f]];
                    for (int f = 0; f < F; f++) val[I+2+f] = ff_tmp[f];
                }
            }
        }
        _mm_free(val);
        _mm_free(ff_tmp);
    }
    return H;
}
