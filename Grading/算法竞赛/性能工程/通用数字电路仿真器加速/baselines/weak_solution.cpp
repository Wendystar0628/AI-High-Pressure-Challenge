// Weak baseline for 通用数字电路仿真器加速: a competent first attempt. It implements simulate()
// for grader.cpp and follows the problem rules.
//   - Kahn topological order; every gate evaluated with a switch
//   - 256 stimuli per thread block (4 x 64-bit words per signal), blocks spread over threads
// Used only to cross-check the expected outputs computed by the reference solution; it is not timed.
// Build: g++ -O2 -std=c++20 -march=native -fopenmp -o weak.exe grader.cpp weak_solution.cpp
#include <algorithm>
#include <cstdint>
#include <cstring>
#include <vector>
using namespace std;
typedef uint64_t u64;

struct Circuit {
    int I, F, G, O, M, T;
    uint64_t seed;
    std::vector<int> d;
    std::vector<uint8_t> type;
    std::vector<int> in0, in1, in2;
    std::vector<int> out;
};

static const int WPB = 4;  // 64-bit words per block: 256 stimuli

static u64 sm_next(u64* s) {
    u64 z = (*s += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31);
}
static u64 mix64(u64 x) { return sm_next(&x); }

std::vector<uint64_t> simulate(const Circuit& c) {
    const int I = c.I, F = c.F, G = c.G, O = c.O, M = c.M, T = c.T;
    const u64 seed = c.seed;
    const int BFF = 2 + I, BG = BFF + F, S = BG + G;
    const vector<int>& d = c.d;
    const vector<int>& outs = c.out;
    const vector<uint8_t>& type = c.type;
    // Unused inputs point at the constant-0 signal so every gate can read three operands.
    vector<int> in0(c.in0), in1(c.in1), in2(c.in2);
    for (int k = 0; k < G; k++) { if (in1[k] < 0) in1[k] = 0; if (in2[k] < 0) in2[k] = 0; }

    // Kahn topological order of the gates.
    vector<int> indeg(G, 0), head(G, -1), nxt, to;
    auto edge = [&](int s, int k) {
        if (s >= BG) { indeg[k]++; to.push_back(k); nxt.push_back(head[s - BG]); head[s - BG] = (int)to.size() - 1; }
    };
    for (int k = 0; k < G; k++) {
        edge(in0[k], k);
        if (type[k] != 6) edge(in1[k], k);
        if (type[k] == 7) edge(in2[k], k);
    }
    vector<int> order, st;
    order.reserve(G);
    for (int k = 0; k < G; k++) if (!indeg[k]) st.push_back(k);
    while (!st.empty()) {
        int k = st.back(); st.pop_back(); order.push_back(k);
        for (int e = head[k]; e >= 0; e = nxt[e]) if (--indeg[to[e]] == 0) st.push_back(to[e]);
    }

    vector<u64> H(M, 0), key((size_t)T * O);
    for (int t = 0; t < T; t++) for (int j = 0; j < O; j++) key[(size_t)t * O + j] = mix64((u64)t * O + j);
    const int lanesPerBlock = 64 * WPB;
    const int blocks = (M + lanesPerBlock - 1) / lanesPerBlock;
#pragma omp parallel
    {
        vector<u64> v((size_t)S * WPB), ffw((size_t)F * WPB), rs(lanesPerBlock);
#pragma omp for schedule(dynamic, 1)
        for (int blk = 0; blk < blocks; blk++) {
            int lane0 = blk * lanesPerBlock, lanes = min(lanesPerBlock, M - lane0);
            for (int l = 0; l < lanes; l++) rs[l] = mix64(seed ^ (u64)(lane0 + l));
            fill(ffw.begin(), ffw.end(), 0);
            for (int t = 0; t < T; t++) {
                for (int w = 0; w < WPB; w++) { v[0 * WPB + w] = 0; v[1 * WPB + w] = ~0ULL; }
                for (int i = 0; i < I; i++) for (int w = 0; w < WPB; w++) v[(size_t)(2 + i) * WPB + w] = 0;
                for (int l = 0; l < lanes; l++) {
                    u64 r = sm_next(&rs[l]);
                    for (int i = 0; i < I; i++) v[(size_t)(2 + i) * WPB + l / 64] |= ((r >> i) & 1ULL) << (l % 64);
                }
                memcpy(&v[(size_t)BFF * WPB], ffw.data(), sizeof(u64) * F * WPB);
                for (int k : order) {
                    const u64* a = &v[(size_t)in0[k] * WPB];
                    const u64* b = &v[(size_t)in1[k] * WPB];
                    const u64* cc = &v[(size_t)in2[k] * WPB];
                    u64* o = &v[(size_t)(BG + k) * WPB];
                    switch (type[k]) {
                        case 0: for (int w = 0; w < WPB; w++) o[w] = a[w] & b[w]; break;
                        case 1: for (int w = 0; w < WPB; w++) o[w] = a[w] | b[w]; break;
                        case 2: for (int w = 0; w < WPB; w++) o[w] = a[w] ^ b[w]; break;
                        case 3: for (int w = 0; w < WPB; w++) o[w] = ~(a[w] & b[w]); break;
                        case 4: for (int w = 0; w < WPB; w++) o[w] = ~(a[w] | b[w]); break;
                        case 5: for (int w = 0; w < WPB; w++) o[w] = ~(a[w] ^ b[w]); break;
                        case 6: for (int w = 0; w < WPB; w++) o[w] = ~a[w]; break;
                        default: for (int w = 0; w < WPB; w++) o[w] = (a[w] & cc[w]) | (~a[w] & b[w]); break;  // s ? b : a
                    }
                }
                for (int j = 0; j < O; j++) {
                    const u64* x = &v[(size_t)outs[j] * WPB];
                    u64 kk = key[(size_t)t * O + j];
                    for (int w = 0; w < WPB; w++) {
                        u64 bits = x[w];
                        if (w * 64 + 64 > lanes) bits &= lanes - w * 64 <= 0 ? 0 : (~0ULL >> (64 - (lanes - w * 64)));
                        while (bits) { int l = __builtin_ctzll(bits); H[lane0 + w * 64 + l] ^= kk; bits &= bits - 1; }
                    }
                }
                for (int f = 0; f < F; f++) for (int w = 0; w < WPB; w++) ffw[(size_t)f * WPB + w] = v[(size_t)d[f] * WPB + w];
            }
        }
    }
    return H;
}
