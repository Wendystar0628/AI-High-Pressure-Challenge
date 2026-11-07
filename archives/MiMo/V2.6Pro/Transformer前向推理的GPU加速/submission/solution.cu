// solution.cu — GPU forward pass of a causal Transformer.
// v1: FP32 tiled GEMM + flash attention + fused LN/GELU/residual.
#include <cuda_runtime.h>
#include <cstdint>
#include <cstring>
#include <cmath>
#include <cstdio>

#define CK(s) do { cudaError_t e_ = cudaDeviceSynchronize(); if (e_ != cudaSuccess) { fprintf(stderr, "sol: %s: %s\n", s, cudaGetErrorString(e_)); return; } } while (0)

struct TransformerSpec { int B, S, D, H, F, L; const float* weights; };

namespace {

int gB, gS, gD, gH, gF, gL, gd, gM;  // M = B*S
float *d_x = nullptr, *d_y = nullptr;
float *d_work = nullptr, *d_u = nullptr, *d_qkv = nullptr, *d_att = nullptr, *d_h = nullptr;

struct LayerPtrs {
    const float *g1, *b1, *Wqkv_t, *bqkv, *Wo_t, *bo, *g2, *b2, *W1_t, *b1f, *W2_t, *b2f;
};
LayerPtrs* gLayers = nullptr;
const float *gFinalG = nullptr, *gFinalB = nullptr;

// attention tile config
int gTq = 64, gTk = 64, gChunkQTiles = 1 << 30;

constexpr float NEG_INF = -1e30f;

// ---------------------------------------------------------------------------
// LayerNorm: one block per token row.
// ---------------------------------------------------------------------------
__global__ void ln_kernel(float* __restrict__ out, const float* __restrict__ in,
                          const float* __restrict__ g, const float* __restrict__ b, int D) {
    extern __shared__ float s[];  // D floats for the row + blockDim.x for reductions
    float* row = s;
    float* red = s + D;
    const int tid = threadIdx.x;
    const int ntx = blockDim.x;
    const float* x = in + (size_t)blockIdx.x * D;
    float* o = out + (size_t)blockIdx.x * D;

    for (int j = tid; j < D; j += ntx) row[j] = x[j];
    __syncthreads();

    float sum = 0.f;
    for (int j = tid; j < D; j += ntx) sum += row[j];
    red[tid] = sum;
    __syncthreads();
    for (int k = ntx >> 1; k > 0; k >>= 1) {
        if (tid < k) red[tid] += red[tid + k];
        __syncthreads();
    }
    const float m = red[0] / D;

    float v = 0.f;
    for (int j = tid; j < D; j += ntx) { float d = row[j] - m; v += d * d; }
    red[tid] = v;
    __syncthreads();
    for (int k = ntx >> 1; k > 0; k >>= 1) {
        if (tid < k) red[tid] += red[tid + k];
        __syncthreads();
    }
    const float inv = rsqrtf(red[0] / D + 1e-5f);

    for (int j = tid; j < D; j += ntx) o[j] = g[j] * (row[j] - m) * inv + b[j];
}

// ---------------------------------------------------------------------------
// GEMM: C[M,N] = A[M,K] * Wt[N,K]^T + bias  (+residual into C, +GELU)
// Wt is stored row-major as [N, K] (i.e. pre-transposed W[K, N]).
// ---------------------------------------------------------------------------
__global__ void gemm_kernel(const float* __restrict__ A, const float* __restrict__ Wt,
                            float* __restrict__ C, const float* __restrict__ bias,
                            int M, int N, int K, int add_resid, int do_gelu) {
    constexpr int BM = 64, BN = 64, BK = 8;
    __shared__ float As[BM][BK];
    __shared__ float Ws[BN][BK + 4];

    const int tx = threadIdx.x;
    const int trow = tx >> 4;   // 0..15
    const int tcol = tx & 15;   // 0..15
    const int bm = blockIdx.y * BM;
    const int bn = blockIdx.x * BN;

    float acc[4][4] = {};

    for (int k0 = 0; k0 < K; k0 += BK) {
        for (int idx = tx; idx < BM * BK; idx += 256) {
            int r = idx / BK, c = idx % BK;
            int gm = bm + r, gk = k0 + c;
            As[r][c] = (gm < M && gk < K) ? A[(size_t)gm * K + gk] : 0.f;
        }
        for (int idx = tx; idx < BN * BK; idx += 256) {
            int r = idx / BK, c = idx % BK;
            int gn = bn + r, gk = k0 + c;
            Ws[r][c] = (gn < N && gk < K) ? Wt[(size_t)gn * K + gk] : 0.f;
        }
        __syncthreads();

        for (int k = 0; k < BK; ++k) {
            float a4[4], w4[4];
            for (int i = 0; i < 4; ++i) a4[i] = As[trow * 4 + i][k];
            for (int j = 0; j < 4; ++j) w4[j] = Ws[tcol * 4 + j][k];
            for (int i = 0; i < 4; ++i)
                for (int j = 0; j < 4; ++j)
                    acc[i][j] = fmaf(a4[i], w4[j], acc[i][j]);
        }
        __syncthreads();
    }

    for (int i = 0; i < 4; ++i) {
        const int gm = bm + trow * 4 + i;
        if (gm >= M) continue;
        for (int j = 0; j < 4; ++j) {
            const int gn = bn + tcol * 4 + j;
            if (gn >= N) continue;
            float v = acc[i][j];
            if (bias) v += bias[gn];
            if (add_resid) v += C[(size_t)gm * N + gn];
            if (do_gelu) v = v * 0.5f * erfcf(-v * 0.7071067811865476f);
            C[(size_t)gm * N + gn] = v;
        }
    }
}

// ---------------------------------------------------------------------------
// Flash causal attention (FP32).
// qkv: [B, S, 3D] with Q at +0, K at +D, V at +2D, head h at cols [h*d, (h+1)*d).
// att: [B, S, D].
// ---------------------------------------------------------------------------
__global__ void attn_kernel(const float* __restrict__ qkv, float* __restrict__ att,
                            int B, int S, int H, int d, float scale,
                            int q_tile0, int Tq, int Tk) {
    extern __shared__ float sm[];
    float* Qs = sm;                 // Tq * d
    float* KVs = Qs + Tq * d;       // Tk * d
    float* Ss = KVs + Tk * d;       // Tq * Tk
    float* Os = Ss + Tq * Tk;       // Tq * d
    float* mvec = Os + Tq * d;      // Tq
    float* lvec = mvec + Tq;        // Tq

    const int tid = threadIdx.x;
    const int ntx = blockDim.x;
    const int p = blockIdx.x;
    const int b = p / H;
    const int h = p - b * H;
    const int q_tile = q_tile0 + (int)blockIdx.y;
    const int i0 = q_tile * Tq;
    if (i0 >= S) return;
    const int i_rows = min(Tq, S - i0);
    const int D = d * H;
    const int D3 = 3 * D;
    const int qoff = (size_t)b * S * D3 + h * d;

    // clear O
    for (int idx = tid; idx < Tq * d; idx += ntx) Os[idx] = 0.f;
    if (tid < Tq) { mvec[tid] = NEG_INF; lvec[tid] = 0.f; }
    __syncthreads();

    // load Q tile
    for (int idx = tid; idx < i_rows * d; idx += ntx) {
        int i = idx / d, k = idx % d;
        Qs[idx] = qkv[qoff + (size_t)(i0 + i) * D3 + k];
    }
    __syncthreads();

    const int last_kt = (i0 + i_rows - 1) / Tk;
    for (int kt = 0; kt <= last_kt; ++kt) {
        const int j0 = kt * Tk;
        const int j_rows = min(Tk, S - j0);

        // load K tile (into KVs)
        for (int idx = tid; idx < j_rows * d; idx += ntx) {
            int j = idx / d, k = idx % d;
            KVs[idx] = qkv[qoff + (size_t)(j0 + j) * D3 + D + k];
        }
        for (int idx = j_rows * d + tid; idx < Tk * d; idx += ntx) KVs[idx] = 0.f;
        __syncthreads();

        // scores
        for (int idx = tid; idx < i_rows * Tk; idx += ntx) {
            int i = idx / Tk, j = idx % Tk;
            int gi = i0 + i, gj = j0 + j;
            if (gj > gi || gj >= S) { Ss[idx] = NEG_INF; continue; }
            const float* q = Qs + i * d;
            const float* k = KVs + j * d;
            float e = 0.f;
            for (int kk = 0; kk < d; ++kk) e = fmaf(q[kk], k[kk], e);
            Ss[idx] = e * scale;
        }
        for (int idx = i_rows * Tk + tid; idx < Tq * Tk; idx += ntx) Ss[idx] = NEG_INF;
        __syncthreads();

        // row-wise online-softmax update
        for (int i = tid; i < i_rows; i += ntx) {
            float tile_m = NEG_INF;
            const float* srow = Ss + i * Tk;
            for (int j = 0; j < Tk; ++j) tile_m = fmaxf(tile_m, srow[j]);
            const float m_old = mvec[i];
            const float m_new = fmaxf(m_old, tile_m);
            const float corr = (m_old == NEG_INF) ? 0.f : __expf(m_old - m_new);
            float l = lvec[i] * corr;
            for (int j = 0; j < Tk; ++j) {
                float e = __expf(srow[j] - m_new);
                Ss[i * Tk + j] = e;
                l += e;
            }
            mvec[i] = m_new;
            lvec[i] = l;
            // rescale O row
            float* orow = Os + i * d;
            for (int k = 0; k < d; ++k) orow[k] *= corr;
        }
        __syncthreads();

        // load V tile (overwrite KVs)
        for (int idx = tid; idx < j_rows * d; idx += ntx) {
            int j = idx / d, k = idx % d;
            KVs[idx] = qkv[qoff + (size_t)(j0 + j) * D3 + 2 * D + k];
        }
        for (int idx = j_rows * d + tid; idx < Tk * d; idx += ntx) KVs[idx] = 0.f;
        __syncthreads();

        // O += P @ V
        for (int idx = tid; idx < i_rows * d; idx += ntx) {
            int i = idx / d, k = idx % d;
            float acc = 0.f;
            const float* srow = Ss + i * Tk;
            for (int j = 0; j < Tk; ++j) acc = fmaf(srow[j], KVs[j * d + k], acc);
            Os[idx] += acc;
        }
        __syncthreads();
    }

    // write output: att is [B, S, D] with D = d*H
    for (int idx = tid; idx < i_rows * d; idx += ntx) {
        int i = idx / d, k = idx % d;
        att[((size_t)b * S + (i0 + i)) * D + h * d + k] = Os[idx] / lvec[i];
    }
}

// ---------------------------------------------------------------------------

inline int ceil_div(int a, int b) { return (a + b - 1) / b; }
inline int imin(int a, int b) { return a < b ? a : b; }

void launch_attn(int q_tile0, int n_tiles) {
    const int n_pairs = gB * gH;
    const int smem = (2 * gTq * gd + gTk * gd + gTq * gTk + 2 * gTq) * (int)sizeof(float);
    dim3 grid(n_pairs, n_tiles);
    attn_kernel<<<grid, 256, smem>>>(d_qkv, d_att, gB, gS, gH, gd,
                                     rsqrtf((float)gd), q_tile0, gTq, gTk);
}

}  // namespace

void init(const TransformerSpec& spec, const float* x, float* y) {
    gB = spec.B; gS = spec.S; gD = spec.D; gH = spec.H; gF = spec.F; gL = spec.L;
    gd = gD / gH;
    gM = gB * gS;
    d_x = const_cast<float*>(x);
    d_y = y;

    const size_t N = (size_t)gM * gD;
    cudaMalloc(&d_work, N * sizeof(float));
    cudaMalloc(&d_u, N * sizeof(float));
    cudaMalloc(&d_qkv, 3 * N * sizeof(float));
    cudaMalloc(&d_att, N * sizeof(float));
    cudaMalloc(&d_h, (size_t)gM * gF * sizeof(float));

    // ---- preprocess weights on host: pack per layer into one device blob ----
    const float* w = spec.weights;
    const int D = gD, F = gF;
    // offsets in the source array
    size_t off = 0;
    auto adv = [&](size_t n) { size_t t = off; off += n; return t; };
    struct Src { size_t g1, b1, Wq, Wk, Wv, bq, bk, bv, Wo, bo, g2, b2, W1, b1f, W2, b2f; };
    Src* src = new Src[gL];
    for (int l = 0; l < gL; ++l) {
        src[l].g1 = adv(D); src[l].b1 = adv(D);
        src[l].Wq = adv((size_t)D * D); src[l].Wk = adv((size_t)D * D); src[l].Wv = adv((size_t)D * D);
        src[l].bq = adv(D); src[l].bk = adv(D); src[l].bv = adv(D);
        src[l].Wo = adv((size_t)D * D); src[l].bo = adv(D);
        src[l].g2 = adv(D); src[l].b2 = adv(D);
        src[l].W1 = adv((size_t)D * F); src[l].b1f = adv(F);
        src[l].W2 = adv((size_t)F * D); src[l].b2f = adv(D);
    }
    const size_t gfin = adv(D), bfin = adv(D);

    // destination layout per layer:
    // g1[D] b1[D] Wqkv_t[3D,D] bqkv[3D] Wo_t[D,D] bo[D] g2[D] b2[D] W1_t[F,D] b1f[F] W2_t[D,F] b2f[D]
    const size_t layer_floats =
        2 * D + 3 * (size_t)D * D + 3 * D + (size_t)D * D + D + 2 * D + (size_t)F * D + F + (size_t)D * F + D;
    float* host = new float[layer_floats * gL + 2 * D];
    gLayers = new LayerPtrs[gL];
    float* d_blob = nullptr;
    cudaMalloc(&d_blob, (layer_floats * gL + 2 * D) * sizeof(float));

    for (int l = 0; l < gL; ++l) {
        float* p = host + (size_t)l * layer_floats;
        memcpy(p, w + src[l].g1, D * sizeof(float)); p += D;
        memcpy(p, w + src[l].b1, D * sizeof(float)); p += D;
        // Wqkv_t[3D][D]: row j is column j of [Wq|Wk|Wv]
        {
            float* dst = p;
            const float* Wq = w + src[l].Wq;
            const float* Wk = w + src[l].Wk;
            const float* Wv = w + src[l].Wv;
            for (int j = 0; j < D; ++j) for (int k = 0; k < D; ++k) dst[j * D + k] = Wq[k * D + j];
            for (int j = 0; j < D; ++j) for (int k = 0; k < D; ++k) dst[(D + j) * D + k] = Wk[k * D + j];
            for (int j = 0; j < D; ++j) for (int k = 0; k < D; ++k) dst[(2 * D + j) * D + k] = Wv[k * D + j];
            p += 3 * (size_t)D * D;
        }
        {
            float* dst = p;
            for (int j = 0; j < D; ++j) dst[j] = w[src[l].bq + j];
            for (int j = 0; j < D; ++j) dst[D + j] = w[src[l].bk + j];
            for (int j = 0; j < D; ++j) dst[2 * D + j] = w[src[l].bv + j];
            p += 3 * D;
        }
        {
            float* dst = p;
            const float* Wo = w + src[l].Wo;
            for (int j = 0; j < D; ++j) for (int k = 0; k < D; ++k) dst[j * D + k] = Wo[k * D + j];
            p += (size_t)D * D;
        }
        memcpy(p, w + src[l].bo, D * sizeof(float)); p += D;
        memcpy(p, w + src[l].g2, D * sizeof(float)); p += D;
        memcpy(p, w + src[l].b2, D * sizeof(float)); p += D;
        {
            float* dst = p;
            const float* W1 = w + src[l].W1;
            for (int j = 0; j < F; ++j) for (int k = 0; k < D; ++k) dst[j * D + k] = W1[k * F + j];
            p += (size_t)F * D;
        }
        memcpy(p, w + src[l].b1f, F * sizeof(float)); p += F;
        {
            float* dst = p;
            const float* W2 = w + src[l].W2;
            for (int j = 0; j < D; ++j) for (int k = 0; k < F; ++k) dst[j * F + k] = W2[k * D + j];
            p += (size_t)D * F;
        }
        memcpy(p, w + src[l].b2f, D * sizeof(float)); p += D;

        // record device pointers
        LayerPtrs Lp;
        float* lp = d_blob + (size_t)l * layer_floats;
        Lp.g1 = lp; lp += D;
        Lp.b1 = lp; lp += D;
        Lp.Wqkv_t = lp; lp += 3 * (size_t)D * D;
        Lp.bqkv = lp; lp += 3 * D;
        Lp.Wo_t = lp; lp += (size_t)D * D;
        Lp.bo = lp; lp += D;
        Lp.g2 = lp; lp += D;
        Lp.b2 = lp; lp += D;
        Lp.W1_t = lp; lp += (size_t)F * D;
        Lp.b1f = lp; lp += F;
        Lp.W2_t = lp; lp += (size_t)D * F;
        Lp.b2f = lp;
        gLayers[l] = Lp;
    }
    {
        float* p = host + (size_t)gL * layer_floats;
        memcpy(p, w + gfin, D * sizeof(float));
        memcpy(p + D, w + bfin, D * sizeof(float));
        gFinalG = d_blob + (size_t)gL * layer_floats;
        gFinalB = gFinalG + D;
    }
    cudaMemcpy(d_blob, host, (layer_floats * gL + 2 * D) * sizeof(float), cudaMemcpyHostToDevice);
    delete[] host;
    delete[] src;

    // ---- attention tile config ----
    // smem per block: (2*Tq*d + Tk*d + Tq*Tk + 2*Tq) floats, must stay under 98 KB
    cudaFuncSetAttribute(attn_kernel, cudaFuncAttributeMaxDynamicSharedMemorySize, 98304);
    gTq = 32; gTk = 32;
    for (int t : {128, 112, 96, 80, 64, 48, 32, 24, 16}) {
        long long sm = 3LL * t * gd + (long long)t * t + 2LL * t;
        if (sm * 4 <= 98LL * 1024) { gTq = t; gTk = t; break; }
    }
    // clamp for tiny S
    if (gS < gTq) gTq = 32;
    if (gS < gTk) gTk = 32;

    // chunk query tiles so each attention launch stays well under 1 s
    const int n_q_tiles = ceil_div(gS, gTq);
    // rough flops per launch: proportional to n_tiles; split so each launch ~< 0.3 s of work
    // total attention flops per layer ~ 2*B*H*S*S*d / n_q_tiles... use heuristic:
    long long pair_flops = (long long)gB * gH * (long long)gS * gS * gd * 2;  // causal half already in factor 2? keep simple
    (void)pair_flops;
    // split launches so that each has at most ~2^12 query tiles * pairs
    int tiles_per = n_q_tiles;
    if (gS > 8192) tiles_per = ceil_div(n_q_tiles, ceil_div(gS, 8192));
    gChunkQTiles = tiles_per;
}

void forward() {
    const size_t N = (size_t)gM * gD;
    cudaMemcpyAsync(d_work, d_x, N * sizeof(float), cudaMemcpyDeviceToDevice);

    const int M = gM, D = gD, F = gF;
    dim3 gridQKV(ceil_div(3 * D, 64), ceil_div(M, 64));
    dim3 gridD(ceil_div(D, 64), ceil_div(M, 64));
    dim3 gridF(ceil_div(F, 64), ceil_div(M, 64));
    const int ln_smem = (D + 256) * (int)sizeof(float);

    for (int l = 0; l < gL; ++l) {
        const LayerPtrs& P = gLayers[l];
        ln_kernel<<<M, 256, ln_smem>>>(d_u, d_work, P.g1, P.b1, D); CK("ln1");
        gemm_kernel<<<gridQKV, 256>>>(d_u, P.Wqkv_t, d_qkv, P.bqkv, M, 3 * D, D, 0, 0); CK("qkv");
        const int n_q_tiles = ceil_div(gS, gTq);
        for (int t0 = 0; t0 < n_q_tiles; t0 += gChunkQTiles) {
            launch_attn(t0, imin(gChunkQTiles, n_q_tiles - t0)); CK("attn");
        }
        gemm_kernel<<<gridD, 256>>>(d_att, P.Wo_t, d_work, P.bo, M, D, D, 1, 0); CK("proj");
        ln_kernel<<<M, 256, ln_smem>>>(d_u, d_work, P.g2, P.b2, D); CK("ln2");
        gemm_kernel<<<gridF, 256>>>(d_u, P.W1_t, d_h, P.b1f, M, F, D, 0, 1); CK("ffn1");
        gemm_kernel<<<gridD, 256>>>(d_h, P.W2_t, d_work, P.b2f, M, D, F, 1, 0); CK("ffn2");
    }
    ln_kernel<<<M, 256, ln_smem>>>(d_y, d_work, gFinalG, gFinalB, D); CK("lnf");
}
