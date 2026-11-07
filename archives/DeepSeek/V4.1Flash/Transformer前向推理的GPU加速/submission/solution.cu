// Transformer forward inference on CUDA (RTX 4080 / sm_89).
//   void init(const TransformerSpec& spec, const float* x, float* y);
//   void forward();
#include <cuda_runtime.h>
#include <cuda_fp16.h>
#include <mma.h>
#include <cstdio>
#include <cmath>
#include <vector>
#include <cstring>

using namespace nvcuda;

struct TransformerSpec { int B, S, D, H, F, L; const float* weights; };

namespace {

// ---------------------------------------------------------------- config
int gB, gS, gD, gH, gF, gL, gDH;
long long gN;              // B*S
const float* gX;
float* gY;

__half *gU = nullptr;      // LN output / attention output  [N][D]
__half *gQKV = nullptr;    // QKV                          [N][3D]
__half *gHB = nullptr;     // FFN hidden                   [N][F]

__half *gWQKV = nullptr, *gWO = nullptr, *gW1 = nullptr, *gW2 = nullptr;
float *gBQKV = nullptr, *gBO = nullptr, *gB1 = nullptr, *gB2 = nullptr;
float *gG1 = nullptr, *gE1 = nullptr, *gG2 = nullptr, *gE2 = nullptr;
float *gGF = nullptr, *gEF = nullptr;

bool gFastGemm = false, gFastAttn = false;
bool gHp = false;          // high precision (fp32) path for deep stacks
float *gU32 = nullptr, *gQKV32 = nullptr, *gH32 = nullptr;
float *gWQKV32 = nullptr, *gWO32 = nullptr, *gW132 = nullptr, *gW232 = nullptr;

constexpr int GEMM_BM = 128;
constexpr int GEMM_BN = 64;
constexpr int GEMM_BK = 32;
constexpr int GEMM_APAD = GEMM_BK + 8;
constexpr int GEMM_BPAD = GEMM_BN + 8;

static inline int cdiv(int a, int b) { return (a + b - 1) / b; }

// ---------------------------------------------------------------- utils
__device__ __forceinline__ float gelu_f(float t) {
    return 0.5f * t * (1.0f + erff(t * 0.70710678118654752440f));
}

__device__ __forceinline__ void cp_async16(void* dst, const void* src) {
    unsigned s = (unsigned)__cvta_generic_to_shared(dst);
    asm volatile("cp.async.cg.shared.global [%0], [%1], 16;" ::"r"(s), "l"(src));
}
__device__ __forceinline__ void cp_commit() { asm volatile("cp.async.commit_group;"); }
template <int N>
__device__ __forceinline__ void cp_wait() { asm volatile("cp.async.wait_group %0;" ::"n"(N)); }

// ---------------------------------------------------------------- LayerNorm
// One warp per row.  NCHUNK float4 values per lane (NCHUNK*128 >= D).
template <int NCHUNK, bool TOHALF>
__global__ void ln_row_kernel(const float* __restrict__ y, const float* __restrict__ g,
                              const float* __restrict__ b, void* __restrict__ vout,
                              int D, int nrows) {
    int gwarp = (blockIdx.x * blockDim.x + threadIdx.x) >> 5;
    int lane = threadIdx.x & 31;
    if (gwarp >= nrows) return;
    const float* row = y + (long long)gwarp * D;
    float4 v[NCHUNK];
#pragma unroll
    for (int c = 0; c < NCHUNK; c++) {
        int idx = lane + c * 32;
        v[c] = make_float4(0.f, 0.f, 0.f, 0.f);
        if (idx * 4 < D) v[c] = *reinterpret_cast<const float4*>(row + idx * 4);
    }
    float s = 0.f;
#pragma unroll
    for (int c = 0; c < NCHUNK; c++) s += v[c].x + v[c].y + v[c].z + v[c].w;
#pragma unroll
    for (int off = 16; off; off >>= 1) s += __shfl_xor_sync(0xffffffffu, s, off);
    float mean = s / (float)D;
    float sv = 0.f;
#pragma unroll
    for (int c = 0; c < NCHUNK; c++) {
        if ((lane + c * 32) * 4 >= D) continue;
        float dx = v[c].x - mean, dy = v[c].y - mean, dz = v[c].z - mean, dw = v[c].w - mean;
        sv += dx * dx + dy * dy + dz * dz + dw * dw;
    }
#pragma unroll
    for (int off = 16; off; off >>= 1) sv += __shfl_xor_sync(0xffffffffu, sv, off);
    float rstd = rsqrtf(sv / (float)D + 1e-5f);
    __half* oh = reinterpret_cast<__half*>(vout) + (long long)gwarp * D;
    float* of = reinterpret_cast<float*>(vout) + (long long)gwarp * D;
#pragma unroll
    for (int c = 0; c < NCHUNK; c++) {
        int idx = lane + c * 32;
        int o4 = idx * 4;
        if (o4 >= D) continue;
        float4 r;
        r.x = (v[c].x - mean) * rstd * g[o4 + 0] + b[o4 + 0];
        r.y = (v[c].y - mean) * rstd * g[o4 + 1] + b[o4 + 1];
        r.z = (v[c].z - mean) * rstd * g[o4 + 2] + b[o4 + 2];
        r.w = (v[c].w - mean) * rstd * g[o4 + 3] + b[o4 + 3];
        if (TOHALF) {
            __half2 a = __floats2half2_rn(r.x, r.y);
            __half2 bb = __floats2half2_rn(r.z, r.w);
            uint2 pack;
            pack.x = *reinterpret_cast<unsigned*>(&a);
            pack.y = *reinterpret_cast<unsigned*>(&bb);
            *reinterpret_cast<uint2*>(oh + o4) = pack;
        } else {
            *reinterpret_cast<float4*>(of + o4) = r;
        }
    }
}

// scalar fallback for D % 4 != 0
__global__ void ln_scalar_kernel(const float* __restrict__ y, const float* __restrict__ g,
                                 const float* __restrict__ b, float* __restrict__ vout, int D,
                                 int nrows, int toHalf) {
    int gwarp = (blockIdx.x * blockDim.x + threadIdx.x) >> 5;
    int lane = threadIdx.x & 31;
    if (gwarp >= nrows) return;
    const float* row = y + (long long)gwarp * D;
    float s = 0.f;
    for (int i = lane; i < D; i += 32) s += row[i];
    for (int off = 16; off; off >>= 1) s += __shfl_xor_sync(0xffffffffu, s, off);
    float mean = s / (float)D;
    float sv = 0.f;
    for (int i = lane; i < D; i += 32) { float d = row[i] - mean; sv += d * d; }
    for (int off = 16; off; off >>= 1) sv += __shfl_xor_sync(0xffffffffu, sv, off);
    float rstd = rsqrtf(sv / (float)D + 1e-5f);
    __half* oh = reinterpret_cast<__half*>(vout) + (long long)gwarp * D;
    for (int i = lane; i < D; i += 32) {
        float v = (row[i] - mean) * rstd * g[i] + b[i];
        if (toHalf) oh[i] = __float2half(v);
        else vout[(long long)gwarp * D + i] = v;
    }
}

// ---------------------------------------------------------------- GEMM
// EPI: 0 = half out + bias, 1 = float residual add + bias, 2 = half out + bias + gelu
template <int EPI>
__global__ __launch_bounds__(256) void gemm_kernel(const __half* __restrict__ A,
                                                   const __half* __restrict__ Bm,
                                                   const float* __restrict__ bias,
                                                   void* __restrict__ vC, int M, int K, int N) {
    __shared__ __align__(16) __half As[2][GEMM_BM * GEMM_APAD];
    __shared__ __align__(16) __half Bs[2][GEMM_BK * GEMM_BPAD];
    __shared__ __align__(16) float Cs[8][256];

    const int m0 = blockIdx.y * GEMM_BM;
    const int n0 = blockIdx.x * GEMM_BN;
    const int tid = threadIdx.x;
    const int lda = GEMM_APAD, ldb = GEMM_BPAD;

    auto load_tile = [&](int buf, int kt) {
        const int k0 = kt * GEMM_BK;
        // A: 128 rows x 32 halfs  (4 x 16B per row)
#pragma unroll
        for (int i = 0; i < 2; i++) {
            int idx = tid + i * 256;
            int r = idx >> 2;
            int c = (idx & 3) << 3;
            cp_async16(As[buf] + r * lda + c, A + (long long)(m0 + r) * K + k0 + c);
        }
        // B: 32 rows x 64 halfs (8 x 16B per row)
        {
            int idx = tid;
            int r = idx >> 3;
            int c = (idx & 7) << 3;
            cp_async16(Bs[buf] + r * ldb + c, Bm + (long long)(k0 + r) * N + n0 + c);
        }
    };

    const int nk = K / GEMM_BK;
    load_tile(0, 0);
    cp_commit();

    const int warp = tid >> 5;
    const int lane = tid & 31;
    const int wm = (warp >> 1) * 32;
    const int wn = (warp & 1) * 32;

    wmma::fragment<wmma::accumulator, 16, 16, 16, float> acc[2][2];
#pragma unroll
    for (int i = 0; i < 2; i++)
#pragma unroll
        for (int j = 0; j < 2; j++) wmma::fill_fragment(acc[i][j], 0.f);

    for (int kt = 0; kt < nk; kt++) {
        if (kt + 1 < nk) load_tile((kt + 1) & 1, kt + 1);
        cp_commit();
        cp_wait<1>();
        __syncthreads();
        const __half* Ab = As[kt & 1];
        const __half* Bb = Bs[kt & 1];
#pragma unroll
        for (int kk = 0; kk < GEMM_BK; kk += 16) {
            wmma::fragment<wmma::matrix_a, 16, 16, 16, __half, wmma::row_major> a0, a1;
            wmma::fragment<wmma::matrix_b, 16, 16, 16, __half, wmma::row_major> b0, b1;
            wmma::load_matrix_sync(a0, Ab + (wm + 0) * lda + kk, lda);
            wmma::load_matrix_sync(a1, Ab + (wm + 16) * lda + kk, lda);
            wmma::load_matrix_sync(b0, Bb + kk * ldb + wn, ldb);
            wmma::load_matrix_sync(b1, Bb + kk * ldb + wn + 16, ldb);
            wmma::mma_sync(acc[0][0], a0, b0, acc[0][0]);
            wmma::mma_sync(acc[0][1], a0, b1, acc[0][1]);
            wmma::mma_sync(acc[1][0], a1, b0, acc[1][0]);
            wmma::mma_sync(acc[1][1], a1, b1, acc[1][1]);
        }
        __syncthreads();
    }

    // epilogue
    __half* Ch = reinterpret_cast<__half*>(vC);
    float* Cf = reinterpret_cast<float*>(vC);
    float* tmp = Cs[warp];
#pragma unroll
    for (int i = 0; i < 2; i++) {
#pragma unroll
        for (int j = 0; j < 2; j++) {
            wmma::store_matrix_sync(tmp, acc[i][j], 16, wmma::mem_row_major);
            __syncwarp();
            int base_row = m0 + wm + i * 16;
            int base_col = n0 + wn + j * 16;
            for (int e = lane; e < 256; e += 32) {
                int rr = e >> 4, cc = e & 15;
                int row = base_row + rr;
                int col = base_col + cc;
                if (row >= M) continue;
                float val = tmp[e] + bias[col];
                if (EPI == 1) {
                    Cf[(long long)row * N + col] += val;
                } else if (EPI == 2) {
                    Ch[(long long)row * N + col] = __float2half(gelu_f(val));
                } else {
                    Ch[(long long)row * N + col] = __float2half(val);
                }
            }
            __syncwarp();
        }
    }
}

template <int EPI>
__global__ void gemm_naive(const __half* __restrict__ A, const __half* __restrict__ Bm,
                           const float* __restrict__ bias, void* __restrict__ vC, int M, int K,
                           int N) {
    int row = blockIdx.y * 16 + threadIdx.y;
    int col = blockIdx.x * 16 + threadIdx.x;
    if (row >= M || col >= N) return;
    float acc = 0.f;
    for (int k = 0; k < K; k++)
        acc += __half2float(A[(long long)row * K + k]) * __half2float(Bm[(long long)k * N + col]);
    acc += bias[col];
    __half* Ch = reinterpret_cast<__half*>(vC);
    float* Cf = reinterpret_cast<float*>(vC);
    if (EPI == 1) Cf[(long long)row * N + col] += acc;
    else if (EPI == 2) Ch[(long long)row * N + col] = __float2half(gelu_f(acc));
    else Ch[(long long)row * N + col] = __float2half(acc);
}

// ---------------------------------------------------------------- fp32 GEMM (high-precision path)
// C = A*B + bias, all fp32.  EPI: 0 = plain, 1 = accumulate into C, 2 = gelu.
template <int EPI>
__global__ __launch_bounds__(256) void gemm_f32_kernel(const float* __restrict__ A,
                                                       const float* __restrict__ Bm,
                                                       const float* __restrict__ bias,
                                                       float* __restrict__ C, int M, int K, int N) {
    constexpr int BM = 128, BN = 64, BK = 16;
    __shared__ float As[2][BM][BK + 1];
    __shared__ float Bs[2][BK][BN + 1];
    const int m0 = blockIdx.y * BM, n0 = blockIdx.x * BN;
    const int tid = threadIdx.x;
    const int tx = tid & 15, ty = tid >> 4;
    const int r0 = ty * 8, c0 = tx * 4;
    float acc[8][4];
#pragma unroll
    for (int i = 0; i < 8; i++)
#pragma unroll
        for (int j = 0; j < 4; j++) acc[i][j] = 0.f;

    auto load = [&](int buf, int k0) {
#pragma unroll
        for (int i = 0; i < 8; i++) {
            int idx = tid + i * 256;
            int m = idx >> 4, k = idx & 15;
            As[buf][m][k] = A[(long long)(m0 + m) * K + k0 + k];
        }
#pragma unroll
        for (int i = 0; i < 4; i++) {
            int idx = tid + i * 256;
            int k = idx >> 6, n = idx & 63;
            Bs[buf][k][n] = Bm[(long long)(k0 + k) * N + n0 + n];
        }
    };
    load(0, 0);
    const int nk = K / BK;
    for (int kt = 0; kt < nk; kt++) {
        if (kt + 1 < nk) load((kt + 1) & 1, (kt + 1) * BK);
        __syncthreads();
        const float(*Ab)[BK + 1] = As[kt & 1];
        const float(*Bb)[BN + 1] = Bs[kt & 1];
#pragma unroll
        for (int kk = 0; kk < BK; kk++) {
            float a[8], b[4];
#pragma unroll
            for (int i = 0; i < 8; i++) a[i] = Ab[r0 + i][kk];
#pragma unroll
            for (int j = 0; j < 4; j++) b[j] = Bb[kk][c0 + j];
#pragma unroll
            for (int i = 0; i < 8; i++)
#pragma unroll
                for (int j = 0; j < 4; j++) acc[i][j] += a[i] * b[j];
        }
        __syncthreads();
    }

#pragma unroll
    for (int i = 0; i < 8; i++) {
        int row = m0 + r0 + i;
        if (row >= M) continue;
        int col = n0 + c0;
        float4 v;
        v.x = acc[i][0] + bias[col + 0];
        v.y = acc[i][1] + bias[col + 1];
        v.z = acc[i][2] + bias[col + 2];
        v.w = acc[i][3] + bias[col + 3];
        if (EPI == 2) {
            v.x = gelu_f(v.x); v.y = gelu_f(v.y); v.z = gelu_f(v.z); v.w = gelu_f(v.w);
        }
        float* dst = C + (long long)row * N + col;
        if (EPI == 1) {
            float4 o = *reinterpret_cast<const float4*>(dst);
            o.x += v.x; o.y += v.y; o.z += v.z; o.w += v.w;
            *reinterpret_cast<float4*>(dst) = o;
        } else {
            *reinterpret_cast<float4*>(dst) = v;
        }
    }
}

// ---------------------------------------------------------------- attention (wmma)
template <int DH, int BN>
__global__ __launch_bounds__(128) void attn_wmma_kernel(const __half* __restrict__ qkv,
                                                        __half* __restrict__ out, int Sq, int Dg,
                                                        int Hg, int nqt, int qt0) {
    constexpr int BM = 64;
    constexpr int NV = DH / 8;
    constexpr int NW = 4;  // warps
    constexpr int LDQ = DH + 8;
    constexpr int LDK = DH + 8;
    constexpr int LDS = BN + 4;
    constexpr int LDP = BN + 8;
    extern __shared__ char smraw[];
    __half* Qs = reinterpret_cast<__half*>(smraw);
    __half* Ks = Qs + BM * LDQ;
    __half* Vs = Ks + BN * LDK;
    float* Ss = reinterpret_cast<float*>(Vs + BN * LDK);
    __half* Ps = reinterpret_cast<__half*>(Ss + BM * LDS);
    float* Otmp = reinterpret_cast<float*>(Ps + BM * LDP);
    float* lsum = Otmp + NW * 256;
    float* scl = lsum + BM;

    const int q0 = (nqt - 1 - (qt0 + blockIdx.x)) * BM;
    const int bh = blockIdx.y;
    const int b = bh / Hg, h = bh % Hg;
    const __half* base = qkv + ((long long)b * Sq) * 3 * Dg + (long long)h * DH;
    const int tid = threadIdx.x;
    const int lane = tid & 31;
    const int warp = tid >> 5;

    for (int idx = tid; idx < BM * NV; idx += 128) {
        int r = idx / NV, c = (idx % NV) * 8;
        int row = q0 + r;
        uint4 v = make_uint4(0, 0, 0, 0);
        if (row < Sq) v = *reinterpret_cast<const uint4*>(base + (long long)row * 3 * Dg + c);
        *reinterpret_cast<uint4*>(Qs + r * LDQ + c) = v;
    }
    if (tid < BM) scl[tid] = 0.f;

    wmma::fragment<wmma::accumulator, 16, 16, 16, float> oacc[DH / 16];
#pragma unroll
    for (int i = 0; i < DH / 16; i++) wmma::fill_fragment(oacc[i], 0.f);
    __syncthreads();

    const int lr = lane >> 1;      // row within warp tile
    const int hf = lane & 1;       // half of the key range
    const int grow = warp * 16 + lr;
    const int qi = q0 + grow;
    float m_run = -INFINITY, l_run = 0.f;
    const int kend = min(Sq, q0 + BM);
    const float scale = rsqrtf((float)DH);
    const int half_keys = BN / 2;

    for (int k0 = 0; k0 < kend; k0 += BN) {
        for (int idx = tid; idx < BN * NV; idx += 128) {
            int r = idx / NV, c = (idx % NV) * 8;
            int row = k0 + r;
            uint4 k4 = make_uint4(0, 0, 0, 0), v4 = make_uint4(0, 0, 0, 0);
            if (row < Sq) {
                k4 = *reinterpret_cast<const uint4*>(base + (long long)row * 3 * Dg + Dg + c);
                v4 = *reinterpret_cast<const uint4*>(base + (long long)row * 3 * Dg + 2 * Dg + c);
            }
            *reinterpret_cast<uint4*>(Ks + r * LDK + c) = k4;
            *reinterpret_cast<uint4*>(Vs + r * LDK + c) = v4;
        }
        __syncthreads();

        {
            wmma::fragment<wmma::accumulator, 16, 16, 16, float> acc[BN / 16];
#pragma unroll
            for (int i = 0; i < BN / 16; i++) wmma::fill_fragment(acc[i], 0.f);
#pragma unroll
            for (int kk = 0; kk < DH; kk += 16) {
                wmma::fragment<wmma::matrix_a, 16, 16, 16, __half, wmma::row_major> af;
                wmma::load_matrix_sync(af, Qs + (warp * 16) * LDQ + kk, LDQ);
#pragma unroll
                for (int nn = 0; nn < BN / 16; nn++) {
                    wmma::fragment<wmma::matrix_b, 16, 16, 16, __half, wmma::col_major> bf;
                    wmma::load_matrix_sync(bf, Ks + (nn * 16) * LDK + kk, LDK);
                    wmma::mma_sync(acc[nn], af, bf, acc[nn]);
                }
            }
#pragma unroll
            for (int nn = 0; nn < BN / 16; nn++)
                wmma::store_matrix_sync(Ss + (warp * 16) * LDS + nn * 16, acc[nn], LDS,
                                        wmma::mem_row_major);
        }
        __syncwarp();

        float* srow = Ss + grow * LDS;
        bool diag = (k0 + BN > q0);
        // row max of this tile
        float tmax = -INFINITY;
        if (diag) {
            for (int t = 0; t < half_keys; t++) {
                int jj = hf * half_keys + t;
                int j = k0 + jj;
                if (j < Sq && j <= qi) tmax = fmaxf(tmax, srow[jj]);
            }
        } else {
            for (int t = 0; t < half_keys; t++) tmax = fmaxf(tmax, srow[hf * half_keys + t]);
        }
        tmax = fmaxf(tmax, __shfl_xor_sync(0xffffffffu, tmax, 1));
        float sc = 1.f;
        bool changed = false;
        if (m_run == -INFINITY) {
            m_run = tmax;
            sc = 0.f;
        } else if (tmax > m_run) {
            sc = __expf((m_run - tmax) * scale);
            m_run = tmax;
            changed = true;
        }
        if (__any_sync(0xffffffffu, changed)) {
            scl[grow] = sc;
            __syncwarp();
            float* tmp = Otmp + warp * 256;
#pragma unroll
            for (int nn = 0; nn < DH / 16; nn++) {
                wmma::store_matrix_sync(tmp, oacc[nn], 16, wmma::mem_row_major);
                __syncwarp();
                for (int e = lane; e < 256; e += 32) tmp[e] *= scl[warp * 16 + (e >> 4)];
                __syncwarp();
                wmma::load_matrix_sync(oacc[nn], tmp, 16, wmma::mem_row_major);
                __syncwarp();
            }
        }
        float sum = 0.f;
        __half* prow = Ps + grow * LDP;
        if (m_run == -INFINITY) {
            for (int t = 0; t < half_keys; t++) prow[hf * half_keys + t] = __float2half(0.f);
        } else if (diag) {
            for (int t = 0; t < half_keys; t++) {
                int jj = hf * half_keys + t;
                int j = k0 + jj;
                float p = 0.f;
                if (j < Sq && j <= qi) p = __expf((srow[jj] - m_run) * scale);
                prow[jj] = __float2half(p);
                sum += p;
            }
        } else {
            for (int t = 0; t < half_keys; t++) {
                int jj = hf * half_keys + t;
                float p = __expf((srow[jj] - m_run) * scale);
                prow[jj] = __float2half(p);
                sum += p;
            }
        }
        sum += __shfl_xor_sync(0xffffffffu, sum, 1);
        l_run = l_run * sc + sum;
        __syncwarp();
        {
#pragma unroll
            for (int kk = 0; kk < BN; kk += 16) {
                wmma::fragment<wmma::matrix_a, 16, 16, 16, __half, wmma::row_major> af;
                wmma::load_matrix_sync(af, Ps + (warp * 16) * LDP + kk, LDP);
#pragma unroll
                for (int nn = 0; nn < DH / 16; nn++) {
                    wmma::fragment<wmma::matrix_b, 16, 16, 16, __half, wmma::row_major> bf;
                    wmma::load_matrix_sync(bf, Vs + kk * LDK + nn * 16, LDK);
                    wmma::mma_sync(oacc[nn], af, bf, oacc[nn]);
                }
            }
        }
        __syncthreads();
    }
    lsum[grow] = l_run;
    __syncthreads();

#pragma unroll
    for (int nn = 0; nn < DH / 16; nn++) {
        wmma::store_matrix_sync(Otmp + warp * 256, oacc[nn], 16, wmma::mem_row_major);
        __syncwarp();
        for (int e = lane; e < 256; e += 32) {
            int rr = e >> 4, cc = e & 15;
            int row = q0 + warp * 16 + rr;
            if (row < Sq) {
                float inv = 1.f / lsum[warp * 16 + rr];
                out[((long long)b * Sq + row) * Dg + h * DH + nn * 16 + cc] =
                    __float2half(Otmp[warp * 256 + e] * inv);
            }
        }
        __syncwarp();
    }
}

template <int DH, int BN>
static size_t attn_smem_size() {
    constexpr int LDQ = DH + 8, LDK = DH + 8, LDS = BN + 4, LDP = BN + 8;
    return (size_t)64 * LDQ * 2 + (size_t)BN * LDK * 2 * 2 + (size_t)64 * LDS * 4 +
           (size_t)64 * LDP * 2 + 4 * 256 * 4 + 64 * 4 + 64 * 4;
}

// ---------------------------------------------------------------- attention (small head dim)
// One block handles G heads of one query tile; every thread owns one (row, head) pair
// and keeps its whole output row in registers (no shared-memory traffic for P).
template <int DH, int G>
__global__ __launch_bounds__(256) void attn_small_kernel(const __half* __restrict__ qkv,
                                                         __half* __restrict__ out, int Sq, int Dg,
                                                         int Hg, int nqt, int qt0) {
    constexpr int BM = 256 / G;
    constexpr int GD = G * DH;   // halfs per head group (<=16)
    constexpr int BN = 64;
    __shared__ float Qs[BM * GD];
    __shared__ float Ks[BN * GD];
    __shared__ float Vs[BN * GD];

    const int tid = threadIdx.x;
    const int lrow = tid / G;
    const int hh = tid - lrow * G;
    const int qt = qt0 + blockIdx.x;
    const int q0 = (nqt - 1 - qt) * BM;
    const int ng = Hg / G;
    const int bh = blockIdx.y;
    const int b = bh / ng, h0 = (bh % ng) * G;
    const long long rstride = 3LL * Dg;
    const __half* base = qkv + (long long)b * Sq * rstride + (long long)h0 * DH;
    const float scale = rsqrtf((float)DH);
    const int gi = q0 + lrow;

    {
        constexpr int NV = GD / 8;
        for (int idx = tid; idx < BM * NV; idx += 256) {
            int r = idx / NV, c = (idx % NV) * 8;
            int row = q0 + r;
            uint4 v = make_uint4(0, 0, 0, 0);
            if (row < Sq) v = *reinterpret_cast<const uint4*>(base + (long long)row * rstride + c);
            float* d = Qs + r * GD + c;
            const __half* h = reinterpret_cast<const __half*>(&v);
#pragma unroll
            for (int i = 0; i < 8; i++) d[i] = __half2float(h[i]);
        }
    }
    __syncthreads();
    float qv[DH];
#pragma unroll
    for (int i = 0; i < DH; i++) qv[i] = Qs[lrow * GD + hh * DH + i];

    float ov[2][DH];
#pragma unroll
    for (int i = 0; i < DH; i++) { ov[0][i] = 0.f; ov[1][i] = 0.f; }
    float lsum = 0.f;
    const int kof = hh * DH;
    const int kend = min(Sq, q0 + BM);

    for (int k0 = 0; k0 < kend; k0 += BN) {
        __syncthreads();
        {
            constexpr int NV = GD / 8;
            for (int idx = tid; idx < BN * NV; idx += 256) {
                int r = idx / NV, c = (idx % NV) * 8;
                int row = k0 + r;
                uint4 k4 = make_uint4(0, 0, 0, 0), v4 = make_uint4(0, 0, 0, 0);
                if (row < Sq) {
                    k4 = *reinterpret_cast<const uint4*>(base + (long long)row * rstride + Dg + c);
                    v4 = *reinterpret_cast<const uint4*>(base + (long long)row * rstride + 2 * Dg + c);
                }
                const __half* hk = reinterpret_cast<const __half*>(&k4);
                const __half* hv = reinterpret_cast<const __half*>(&v4);
                float* dk = Ks + r * GD + c;
                float* dv = Vs + r * GD + c;
#pragma unroll
                for (int i = 0; i < 8; i++) {
                    dk[i] = __half2float(hk[i]);
                    dv[i] = __half2float(hv[i]);
                }
            }
        }
        __syncthreads();
        int jmax = min(BN, gi - k0 + 1);
        if (jmax > BN) jmax = BN;
        for (int j = 0; j < jmax; j += 2) {
            const float* kp = Ks + j * GD + kof;
            float s = 0.f;
#pragma unroll
            for (int c = 0; c < DH; c++) s += qv[c] * kp[c];
            float p = __expf(s * scale - 8.0f);
            lsum += p;
            const float* vp = Vs + j * GD + kof;
#pragma unroll
            for (int c = 0; c < DH; c++) ov[0][c] += p * vp[c];
            if (j + 1 < jmax) {
                const float* kp1 = Ks + (j + 1) * GD + kof;
                float s1 = 0.f;
#pragma unroll
                for (int c = 0; c < DH; c++) s1 += qv[c] * kp1[c];
                float p1 = __expf(s1 * scale - 8.0f);
                lsum += p1;
                const float* vp1 = Vs + (j + 1) * GD + kof;
#pragma unroll
                for (int c = 0; c < DH; c++) ov[1][c] += p1 * vp1[c];
            }
        }
    }
    if (gi < Sq) {
        float inv = 1.f / lsum;
        __half* o = out + ((long long)b * Sq + gi) * Dg + (long long)h0 * DH + kof;
#pragma unroll
        for (int c = 0; c < DH; c++) o[c] = __float2half((ov[0][c] + ov[1][c]) * inv);
    }
}
// ---------------------------------------------------------------- attention (generic)
__device__ __forceinline__ float ldf(const __half* p) { return __half2float(*p); }
__device__ __forceinline__ float ldf(const float* p) { return *p; }
__device__ __forceinline__ void stf(__half* p, float v) { *p = __float2half(v); }
__device__ __forceinline__ void stf(float* p, float v) { *p = v; }

template <typename TIn, typename TOut>
__global__ void attn_generic_kernel(const TIn* __restrict__ qkv, TOut* __restrict__ out,
                                    int Sq, int Dg, int Hg, int dh, int nqt, int qt0) {
    constexpr int BM = 32, BN = 64, NTHR = 256;
    extern __shared__ float sm[];
    float* Qs = sm;                  // BM*dh
    float* Ks = Qs + BM * dh;        // BN*dh
    float* Vs = Ks + BN * dh;        // BN*dh
    float* Ps = Vs + BN * dh;        // BM*BN
    float* ls = Ps + BM * BN;        // BM
    const int tid = threadIdx.x;
    const int q0 = (nqt - 1 - (qt0 + blockIdx.x)) * BM;
    const int bh = blockIdx.y;
    const int b = bh / Hg, h = bh % Hg;
    const long long rowstride = 3LL * Dg;
    const TIn* base = qkv + (long long)b * Sq * rowstride + (long long)h * dh;
    const float scale = rsqrtf((float)dh);

    for (int idx = tid; idx < BM * dh; idx += NTHR) {
        int r = idx / dh, c = idx - r * dh;
        int row = q0 + r;
        Qs[idx] = (row < Sq) ? ldf(base + (long long)row * rowstride + c) : 0.f;
    }
    if (tid < BM) ls[tid] = 0.f;

    constexpr int MAXE = 8;
    float oacc[MAXE];
#pragma unroll
    for (int i = 0; i < MAXE; i++) oacc[i] = 0.f;

    const int kend = min(Sq, q0 + BM);
    for (int k0 = 0; k0 < kend; k0 += BN) {
        __syncthreads();
        for (int idx = tid; idx < BN * dh; idx += NTHR) {
            int r = idx / dh, c = idx - r * dh;
            int row = k0 + r;
            if (row < Sq) {
                Ks[idx] = ldf(base + (long long)row * rowstride + Dg + c);
                Vs[idx] = ldf(base + (long long)row * rowstride + 2 * Dg + c);
            } else {
                Ks[idx] = 0.f;
                Vs[idx] = 0.f;
            }
        }
        __syncthreads();
        {
            int r = tid >> 3, sub = tid & 7;
            constexpr int PER = BN / 8;
            int qi = q0 + r;
            float sum = 0.f;
            for (int t = 0; t < PER; t++) {
                int jj = sub * PER + t;
                int j = k0 + jj;
                float p = 0.f;
                if (j < Sq && j <= qi) {
                    float s0 = 0.f, s1 = 0.f, s2 = 0.f, s3 = 0.f;
                    const float* qp = Qs + r * dh;
                    const float* kp = Ks + jj * dh;
                    int c = 0;
                    for (; c + 4 <= dh; c += 4) {
                        s0 += qp[c] * kp[c];
                        s1 += qp[c + 1] * kp[c + 1];
                        s2 += qp[c + 2] * kp[c + 2];
                        s3 += qp[c + 3] * kp[c + 3];
                    }
                    for (; c < dh; c++) s0 += qp[c] * kp[c];
                    p = __expf((s0 + s1 + s2 + s3) * scale - 8.0f);
                }
                Ps[r * BN + jj] = p;
                sum += p;
            }
            sum += __shfl_xor_sync(0xffffffffu, sum, 1);
            sum += __shfl_xor_sync(0xffffffffu, sum, 2);
            sum += __shfl_xor_sync(0xffffffffu, sum, 4);
            if (sub == 0) ls[r] += sum;
        }
        __syncthreads();
        {
            int ncol = BM * dh;
            int slot = 0;
            for (int e = tid; e < ncol; e += NTHR, slot++) {
                int r = e / dh, c = e - r * dh;
                float acc0 = 0.f, acc1 = 0.f, acc2 = 0.f, acc3 = 0.f;
                const float* prow = Ps + r * BN;
                int jj = 0;
                for (; jj + 4 <= BN; jj += 4) {
                    acc0 += prow[jj] * Vs[jj * dh + c];
                    acc1 += prow[jj + 1] * Vs[(jj + 1) * dh + c];
                    acc2 += prow[jj + 2] * Vs[(jj + 2) * dh + c];
                    acc3 += prow[jj + 3] * Vs[(jj + 3) * dh + c];
                }
                for (; jj < BN; jj++) acc0 += prow[jj] * Vs[jj * dh + c];
                oacc[slot] += (acc0 + acc1) + (acc2 + acc3);
            }
        }
    }
    __syncthreads();
    {
        int ncol = BM * dh;
        int slot = 0;
        for (int e = tid; e < ncol; e += NTHR, slot++) {
            int r = e / dh, c = e - r * dh;
            int row = q0 + r;
            if (row < Sq) {
                float inv = 1.f / ls[r];
                stf(out + ((long long)b * Sq + row) * Dg + h * dh + c, oacc[slot] * inv);
            }
        }
    }
}

// ---------------------------------------------------------------- host side
void convert_weights(const TransformerSpec& sp) {
    const int D = sp.D, F = sp.F, L = sp.L;
    std::vector<__half> wqkv((size_t)L * D * 3 * D), wo((size_t)L * D * D), w1((size_t)L * D * F),
        w2((size_t)L * F * D);
    std::vector<float> bqkv((size_t)L * 3 * D), bo((size_t)L * D), b1((size_t)L * F),
        b2((size_t)L * D);
    std::vector<float> g1((size_t)L * D), e1((size_t)L * D), g2((size_t)L * D), e2((size_t)L * D);
    std::vector<float> fqkv, fo, f1, f2;
    if (gHp) {
        fqkv.resize((size_t)L * D * 3 * D);
        fo.resize((size_t)L * D * D);
        f1.resize((size_t)L * D * F);
        f2.resize((size_t)L * F * D);
    }
    const float* p = sp.weights;
    for (int l = 0; l < L; l++) {
        float* dg1 = &g1[(size_t)l * D];
        float* de1 = &e1[(size_t)l * D];
        float* dg2 = &g2[(size_t)l * D];
        float* de2 = &e2[(size_t)l * D];
        float* dbq = &bqkv[(size_t)l * 3 * D];
        float* dbo = &bo[(size_t)l * D];
        float* db1 = &b1[(size_t)l * F];
        float* db2 = &b2[(size_t)l * D];
        float* fwq = gHp ? &fqkv[(size_t)l * D * 3 * D] : nullptr;
        float* fwo_p = gHp ? &fo[(size_t)l * D * D] : nullptr;
        float* fw1 = gHp ? &f1[(size_t)l * D * F] : nullptr;
        float* fw2 = gHp ? &f2[(size_t)l * F * D] : nullptr;
        __half* dwq = &wqkv[(size_t)l * D * 3 * D];
        __half* dwo = &wo[(size_t)l * D * D];
        __half* dw1 = &w1[(size_t)l * D * F];
        __half* dw2 = &w2[(size_t)l * F * D];
        memcpy(dg1, p, sizeof(float) * D); p += D;
        memcpy(de1, p, sizeof(float) * D); p += D;
        const float* WQ = p; p += (size_t)D * D;
        const float* WK = p; p += (size_t)D * D;
        const float* WV = p; p += (size_t)D * D;
        for (int i = 0; i < D; i++) {
            for (int j = 0; j < D; j++) {
                float a = WQ[(size_t)i * D + j], bb2 = WK[(size_t)i * D + j],
                      cc2 = WV[(size_t)i * D + j];
                dwq[(size_t)i * 3 * D + j] = __float2half(a);
                dwq[(size_t)i * 3 * D + D + j] = __float2half(bb2);
                dwq[(size_t)i * 3 * D + 2 * D + j] = __float2half(cc2);
                if (gHp) {
                    fwq[(size_t)i * 3 * D + j] = a;
                    fwq[(size_t)i * 3 * D + D + j] = bb2;
                    fwq[(size_t)i * 3 * D + 2 * D + j] = cc2;
                }
            }
        }
        memcpy(dbq, p, sizeof(float) * D); p += D;
        memcpy(dbq + D, p, sizeof(float) * D); p += D;
        memcpy(dbq + 2 * D, p, sizeof(float) * D); p += D;
        if (gHp) memcpy(fwo_p, p, sizeof(float) * (size_t)D * D);
        for (size_t i = 0; i < (size_t)D * D; i++) dwo[i] = __float2half(p[i]);
        p += (size_t)D * D;
        memcpy(dbo, p, sizeof(float) * D); p += D;
        memcpy(dg2, p, sizeof(float) * D); p += D;
        memcpy(de2, p, sizeof(float) * D); p += D;
        if (gHp) memcpy(fw1, p, sizeof(float) * (size_t)D * F);
        for (size_t i = 0; i < (size_t)D * F; i++) dw1[i] = __float2half(p[i]);
        p += (size_t)D * F;
        memcpy(db1, p, sizeof(float) * F); p += F;
        if (gHp) memcpy(fw2, p, sizeof(float) * (size_t)F * D);
        for (size_t i = 0; i < (size_t)F * D; i++) dw2[i] = __float2half(p[i]);
        p += (size_t)F * D;
        memcpy(db2, p, sizeof(float) * D); p += D;
    }
    std::vector<float> gf(D), ef(D);
    memcpy(gf.data(), p, sizeof(float) * D); p += D;
    memcpy(ef.data(), p, sizeof(float) * D); p += D;

    size_t nqkv = (size_t)L * D * 3 * D, no = (size_t)L * D * D, n1 = (size_t)L * D * F,
           n2 = (size_t)L * F * D;
    cudaMalloc(&gWQKV, nqkv * 2);
    cudaMalloc(&gWO, no * 2);
    cudaMalloc(&gW1, n1 * 2);
    cudaMalloc(&gW2, n2 * 2);
    cudaMalloc(&gBQKV, (size_t)L * 3 * D * 4);
    cudaMalloc(&gBO, (size_t)L * D * 4);
    cudaMalloc(&gB1, (size_t)L * F * 4);
    cudaMalloc(&gB2, (size_t)L * D * 4);
    cudaMalloc(&gG1, (size_t)L * D * 4);
    cudaMalloc(&gE1, (size_t)L * D * 4);
    cudaMalloc(&gG2, (size_t)L * D * 4);
    cudaMalloc(&gE2, (size_t)L * D * 4);
    cudaMalloc(&gGF, (size_t)D * 4);
    cudaMalloc(&gEF, (size_t)D * 4);
    if (gHp) {
        cudaMalloc(&gWQKV32, nqkv * 4);
        cudaMalloc(&gWO32, no * 4);
        cudaMalloc(&gW132, n1 * 4);
        cudaMalloc(&gW232, n2 * 4);
        cudaMemcpy(gWQKV32, fqkv.data(), nqkv * 4, cudaMemcpyHostToDevice);
        cudaMemcpy(gWO32, fo.data(), no * 4, cudaMemcpyHostToDevice);
        cudaMemcpy(gW132, f1.data(), n1 * 4, cudaMemcpyHostToDevice);
        cudaMemcpy(gW232, f2.data(), n2 * 4, cudaMemcpyHostToDevice);
    }
    cudaMemcpy(gWQKV, wqkv.data(), nqkv * 2, cudaMemcpyHostToDevice);
    cudaMemcpy(gWO, wo.data(), no * 2, cudaMemcpyHostToDevice);
    cudaMemcpy(gW1, w1.data(), n1 * 2, cudaMemcpyHostToDevice);
    cudaMemcpy(gW2, w2.data(), n2 * 2, cudaMemcpyHostToDevice);
    cudaMemcpy(gBQKV, bqkv.data(), (size_t)L * 3 * D * 4, cudaMemcpyHostToDevice);
    cudaMemcpy(gBO, bo.data(), (size_t)L * D * 4, cudaMemcpyHostToDevice);
    cudaMemcpy(gB1, b1.data(), (size_t)L * F * 4, cudaMemcpyHostToDevice);
    cudaMemcpy(gB2, b2.data(), (size_t)L * D * 4, cudaMemcpyHostToDevice);
    cudaMemcpy(gG1, g1.data(), (size_t)L * D * 4, cudaMemcpyHostToDevice);
    cudaMemcpy(gE1, e1.data(), (size_t)L * D * 4, cudaMemcpyHostToDevice);
    cudaMemcpy(gG2, g2.data(), (size_t)L * D * 4, cudaMemcpyHostToDevice);
    cudaMemcpy(gE2, e2.data(), (size_t)L * D * 4, cudaMemcpyHostToDevice);
    cudaMemcpy(gGF, gf.data(), (size_t)D * 4, cudaMemcpyHostToDevice);
    cudaMemcpy(gEF, ef.data(), (size_t)D * 4, cudaMemcpyHostToDevice);
}

template <int EPI>
void gemm_launch_f32(const float* A, const float* Bm, const float* bias, float* C, int M, int K,
                     int N) {
    dim3 grid(cdiv(N, 64), cdiv(M, 128));
    gemm_f32_kernel<EPI><<<grid, 256>>>(A, Bm, bias, C, M, K, N);
}

template <int EPI>
void gemm_launch(const __half* A, const __half* Bm, const float* bias, void* C, int M, int K,
                 int N) {
    if (gFastGemm) {
        dim3 grid(cdiv(N, GEMM_BN), cdiv(M, GEMM_BM));
        gemm_kernel<EPI><<<grid, 256>>>(A, Bm, bias, C, M, K, N);
    } else {
        dim3 grid(cdiv(N, 16), cdiv(M, 16));
        dim3 blk(16, 16);
        gemm_naive<EPI><<<grid, blk>>>(A, Bm, bias, C, M, K, N);
    }
}

void ln_launch(const float* y, const float* g, const float* b, void* out, int nrows, bool toHalf) {
    int D = gD;
    int nb = 256;
    int grid = cdiv(nrows, 8);
    if (D % 4 != 0) {
        ln_scalar_kernel<<<grid, nb>>>(y, g, b, reinterpret_cast<float*>(out), D, nrows, toHalf);
        return;
    }
    if (D <= 128) {
        if (toHalf) ln_row_kernel<1, true><<<grid, nb>>>(y, g, b, out, D, nrows);
        else ln_row_kernel<1, false><<<grid, nb>>>(y, g, b, out, D, nrows);
    } else if (D <= 256) {
        if (toHalf) ln_row_kernel<2, true><<<grid, nb>>>(y, g, b, out, D, nrows);
        else ln_row_kernel<2, false><<<grid, nb>>>(y, g, b, out, D, nrows);
    } else if (D <= 512) {
        if (toHalf) ln_row_kernel<4, true><<<grid, nb>>>(y, g, b, out, D, nrows);
        else ln_row_kernel<4, false><<<grid, nb>>>(y, g, b, out, D, nrows);
    } else {
        if (toHalf) ln_row_kernel<8, true><<<grid, nb>>>(y, g, b, out, D, nrows);
        else ln_row_kernel<8, false><<<grid, nb>>>(y, g, b, out, D, nrows);
    }
}

static int chunk_count(int nqt) {
    int k = nqt / 64;
    if (k < 1) k = 1;
    if (k > 16) k = 16;
    return k;
}

template <int DH, int BN>
static void attn_wmma_chunks(int nqt, int nchunk) {
    for (int k = 0; k < nchunk; k++) {
        int a = (int)(nqt * sqrt((double)k / nchunk));
        int b = (int)(nqt * sqrt((double)(k + 1) / nchunk));
        if (b <= a) continue;
        dim3 grid(b - a, gB * gH);
        attn_wmma_kernel<DH, BN><<<grid, 128, attn_smem_size<DH, BN>()>>>(gQKV, gU, gS, gD, gH, nqt, a);
    }
}

template <int DH, int G>
static void attn_small_chunks(int nqt, int nchunk) {
    for (int k = 0; k < nchunk; k++) {
        int a = (int)(nqt * sqrt((double)k / nchunk));
        int b = (int)(nqt * sqrt((double)(k + 1) / nchunk));
        if (b <= a) continue;
        dim3 grid(b - a, gB * (gH / G));
        attn_small_kernel<DH, G><<<grid, 256>>>(gQKV, gU, gS, gD, gH, nqt, a);
    }
}


// ---------------------------------------------------------------- fp32 attention (hp path)
// 4 threads per query row (head dim in registers), block covers 64 rows.
template <int DH>
__global__ __launch_bounds__(256) void attn_hp_kernel(const float* __restrict__ qkv,
                                                      float* __restrict__ out, int Sq, int Dg,
                                                      int Hg, int nqt, int qt0) {
    constexpr int BM = 64, BN = 64, NT = 4;
    __shared__ float Ks[BN * DH];
    __shared__ float Vs[BN * DH];
    const int tid = threadIdx.x;
    const int row = tid >> 2;
    const int sub = tid & 3;
    const int qt = qt0 + blockIdx.x;
    const int q0 = (nqt - 1 - qt) * BM;
    const int bh = blockIdx.y;
    const int b = bh / Hg, h = bh % Hg;
    const long long rs = 3LL * Dg;
    const float* base = qkv + (long long)b * Sq * rs + (long long)h * DH;
    const int gi = q0 + row;
    const float scale = rsqrtf((float)DH);

    float qv[DH];
    if (gi < Sq) {
        const float* qp = base + (long long)gi * rs;
#pragma unroll
        for (int c = 0; c < DH; c++) qv[c] = qp[c];
    } else {
#pragma unroll
        for (int c = 0; c < DH; c++) qv[c] = 0.f;
    }
    float ov[DH], lsum = 0.f;
#pragma unroll
    for (int c = 0; c < DH; c++) ov[c] = 0.f;

    const int kend = min(Sq, q0 + BM);
    for (int k0 = 0; k0 < kend; k0 += BN) {
        __syncthreads();
#pragma unroll
        for (int i = 0; i < (BN * DH + 255) / 256; i++) {
            int idx = tid + i * 256;
            if (idx < BN * DH) {
                int r = idx / DH, c = idx - r * DH;
                int rr = k0 + r;
                if (rr < Sq) {
                    Ks[idx] = base[(long long)rr * rs + Dg + c];
                    Vs[idx] = base[(long long)rr * rs + 2 * Dg + c];
                } else {
                    Ks[idx] = 0.f;
                    Vs[idx] = 0.f;
                }
            }
        }
        __syncthreads();
        const int j0 = sub * (BN / NT);
        if (k0 + BN <= gi) {
#pragma unroll
            for (int t = 0; t < BN / NT; t++) {
                int j = j0 + t;
                const float* kp = Ks + j * DH;
                const float* vp = Vs + j * DH;
                float s0 = 0.f, s1 = 0.f;
#pragma unroll
                for (int c = 0; c < DH; c += 2) {
                    s0 += qv[c] * kp[c];
                    s1 += qv[c + 1] * kp[c + 1];
                }
                float p = __expf((s0 + s1) * scale - 8.0f);
                lsum += p;
#pragma unroll
                for (int c2 = 0; c2 < DH; c2++) ov[c2] += p * vp[c2];
            }
        } else {
#pragma unroll
            for (int t = 0; t < BN / NT; t++) {
                int j = j0 + t;
                int jj = k0 + j;
                const float* kp = Ks + j * DH;
                const float* vp = Vs + j * DH;
                float s0 = 0.f, s1 = 0.f;
#pragma unroll
                for (int c = 0; c < DH; c += 2) {
                    s0 += qv[c] * kp[c];
                    s1 += qv[c + 1] * kp[c + 1];
                }
                float p = (jj <= gi) ? __expf((s0 + s1) * scale - 8.0f) : 0.f;
                lsum += p;
#pragma unroll
                for (int c2 = 0; c2 < DH; c2++) ov[c2] += p * vp[c2];
            }
        }
    }
    lsum += __shfl_xor_sync(0xffffffffu, lsum, 1);
    lsum += __shfl_xor_sync(0xffffffffu, lsum, 2);
#pragma unroll
    for (int c = 0; c < DH; c++) {
        float v = ov[c];
        v += __shfl_xor_sync(0xffffffffu, v, 1);
        v += __shfl_xor_sync(0xffffffffu, v, 2);
        ov[c] = v;
    }
    if (sub == 0 && gi < Sq) {
        float inv = 1.f / lsum;
        float* o = out + ((long long)b * Sq + gi) * Dg + (long long)h * DH;
#pragma unroll
        for (int c = 0; c < DH; c++) o[c] = ov[c] * inv;
    }
}

void attn_launch_f32() {
    int nqt = cdiv(gS, 64);
    if (gDH == 16) {
        dim3 g(nqt, gB * gH);
        attn_hp_kernel<16><<<g, 256>>>(gQKV32, gU32, gS, gD, gH, nqt, 0);
        return;
    }
    if (gDH == 8) {
        dim3 g(nqt, gB * gH);
        attn_hp_kernel<8><<<g, 256>>>(gQKV32, gU32, gS, gD, gH, nqt, 0);
        return;
    }
    if (gDH == 4) {
        dim3 g(nqt, gB * gH);
        attn_hp_kernel<4><<<g, 256>>>(gQKV32, gU32, gS, gD, gH, nqt, 0);
        return;
    }
    int nqt2 = cdiv(gS, 32);
    dim3 g2(nqt2, gB * gH);
    size_t sm = (size_t)(32 * gDH + 2 * 64 * gDH + 32 * 64 + 32) * 4;
    for (int k = 0; k < nqt2; k += 256) {
        int cnt = min(256, nqt2 - k);
        dim3 g(cnt, gB * gH);
        attn_generic_kernel<float, float><<<g, 256, sm>>>(gQKV32, gU32, gS, gD, gH, gDH, nqt2, k);
    }
}

void attn_launch() {
    if (gFastAttn) {
        int nqt = cdiv(gS, 64);
        int nc = chunk_count(nqt);
        switch (gDH) {
            case 16: attn_wmma_chunks<16, 64>(nqt, nc); break;
            case 32: if (gS >= 2048) attn_wmma_chunks<32, 32>(nqt, nc); else attn_wmma_chunks<32, 64>(nqt, nc); break;
            case 64: if (gS >= 2048) attn_wmma_chunks<64, 32>(nqt, nc); else attn_wmma_chunks<64, 64>(nqt, nc); break;
            case 128: attn_wmma_chunks<128, 64>(nqt, nc); break;
            default: attn_wmma_chunks<256, 32>(nqt, nc); break;
        }
        return;
    }
    if (gDH <= 8) {
        int want = 16 / gDH;
        int g = 1;
        for (int cand = want; cand >= 1; cand--) {
            if (gH % cand == 0) { g = cand; break; }
        }
        if (g * gDH < 8) g = 0;
        if (g == 0) {
            int nqt2 = cdiv(gS, 32);
            dim3 g2(nqt2, gB * gH);
            size_t sm = (size_t)(32 * gDH + 2 * 64 * gDH + 32 * 64 + 32) * 4;
            attn_generic_kernel<__half, __half><<<g2, 256, sm>>>(gQKV, gU, gS, gD, gH, gDH, nqt2, 0);
            return;
        }
        if (gDH == 2) {
            int nqt = cdiv(gS, 256 / g);
            int nc = chunk_count(nqt);
            if (g == 8) { attn_small_chunks<2, 8>(nqt, nc); return; }
            if (g == 4) { attn_small_chunks<2, 4>(nqt, nc); return; }
            if (g == 2) { attn_small_chunks<2, 2>(nqt, nc); return; }
            attn_small_chunks<2, 1>(nqt, nc); return;
        }
        if (gDH == 4) {
            int nqt = cdiv(gS, 256 / g);
            int nc = chunk_count(nqt);
            if (g == 4) { attn_small_chunks<4, 4>(nqt, nc); return; }
            if (g == 2) { attn_small_chunks<4, 2>(nqt, nc); return; }
            attn_small_chunks<4, 1>(nqt, nc); return;
        }
        if (gDH == 8) {
            int nqt = cdiv(gS, 256 / g);
            int nc = chunk_count(nqt);
            if (g == 2) { attn_small_chunks<8, 2>(nqt, nc); return; }
            attn_small_chunks<8, 1>(nqt, nc); return;
        }
    }
    {
        int nqt2 = cdiv(gS, 32);
        dim3 g2(nqt2, gB * gH);
        size_t sm = (size_t)(32 * gDH + 2 * 64 * gDH + 32 * 64 + 32) * 4;
        attn_generic_kernel<__half, __half><<<g2, 256, sm>>>(gQKV, gU, gS, gD, gH, gDH, nqt2, 0);
    }
}

}  // namespace

// ---------------------------------------------------------------- API
void init(const TransformerSpec& spec, const float* x, float* y) {
    gB = spec.B; gS = spec.S; gD = spec.D; gH = spec.H; gF = spec.F; gL = spec.L;
    gDH = gD / gH;
    gN = (long long)gB * gS;
    gX = x; gY = y;

    gFastGemm = (gD % 64 == 0) && (gF % 64 == 0) && (gDH <= 256);
    gHp = (gL >= 8);
    gFastAttn = gFastGemm && (gDH % 16 == 0) && (gDH >= 16) && (gDH <= 256);

    const size_t pad = 128;
    cudaMalloc(&gU, ((size_t)gN * gD + pad * gD) * 2);
    cudaMalloc(&gQKV, ((size_t)gN * 3 * gD + pad * 3 * gD) * 2);
    cudaMalloc(&gHB, ((size_t)gN * gF + pad * gF) * 2);
    if (gHp) {
        cudaMalloc(&gU32, ((size_t)gN * gD + pad * gD) * 4);
        cudaMalloc(&gQKV32, ((size_t)gN * 3 * gD + pad * 3 * gD) * 4);
        cudaMalloc(&gH32, ((size_t)gN * gF + pad * gF) * 4);
    }
    cudaMemset(gU, 0, (size_t)gN * gD * 2);

    convert_weights(spec);

    if (gFastAttn) {
        cudaFuncSetAttribute(attn_wmma_kernel<16, 64>, cudaFuncAttributeMaxDynamicSharedMemorySize, (int)attn_smem_size<16, 64>());
        cudaFuncSetAttribute(attn_wmma_kernel<32, 64>, cudaFuncAttributeMaxDynamicSharedMemorySize, (int)attn_smem_size<32, 64>());
        cudaFuncSetAttribute(attn_wmma_kernel<32, 32>, cudaFuncAttributeMaxDynamicSharedMemorySize, (int)attn_smem_size<32, 32>());
        cudaFuncSetAttribute(attn_wmma_kernel<64, 32>, cudaFuncAttributeMaxDynamicSharedMemorySize, (int)attn_smem_size<64, 32>());
        cudaFuncSetAttribute(attn_wmma_kernel<64, 64>, cudaFuncAttributeMaxDynamicSharedMemorySize, (int)attn_smem_size<64, 64>());
        cudaFuncSetAttribute(attn_wmma_kernel<128, 64>, cudaFuncAttributeMaxDynamicSharedMemorySize, (int)attn_smem_size<128, 64>());
        cudaFuncSetAttribute(attn_wmma_kernel<256, 32>, cudaFuncAttributeMaxDynamicSharedMemorySize, (int)attn_smem_size<256, 32>());
    }
}

void forward() {
    cudaMemcpyAsync(gY, gX, (size_t)gN * gD * 4, cudaMemcpyDeviceToDevice);
    if (gHp) {
        for (int l = 0; l < gL; l++) {
            ln_launch(gY, gG1 + (size_t)l * gD, gE1 + (size_t)l * gD, gU32, (int)gN, false);
            gemm_launch_f32<0>(gU32, gWQKV32 + (size_t)l * gD * 3 * gD, gBQKV + (size_t)l * 3 * gD,
                               gQKV32, (int)gN, gD, 3 * gD);
            attn_launch_f32();
            gemm_launch_f32<1>(gU32, gWO32 + (size_t)l * gD * gD, gBO + (size_t)l * gD, gY,
                               (int)gN, gD, gD);
            ln_launch(gY, gG2 + (size_t)l * gD, gE2 + (size_t)l * gD, gU32, (int)gN, false);
            gemm_launch_f32<2>(gU32, gW132 + (size_t)l * gD * gF, gB1 + (size_t)l * gF, gH32,
                               (int)gN, gD, gF);
            gemm_launch_f32<1>(gH32, gW232 + (size_t)l * gF * gD, gB2 + (size_t)l * gD, gY,
                               (int)gN, gF, gD);
        }
        ln_launch(gY, gGF, gEF, gY, (int)gN, false);
        return;
    }
    for (int l = 0; l < gL; l++) {
        ln_launch(gY, gG1 + (size_t)l * gD, gE1 + (size_t)l * gD, gU, (int)gN, true);
        gemm_launch<0>(gU, gWQKV + (size_t)l * gD * 3 * gD, gBQKV + (size_t)l * 3 * gD, gQKV,
                       (int)gN, gD, 3 * gD);
        attn_launch();
        gemm_launch<1>(gU, gWO + (size_t)l * gD * gD, gBO + (size_t)l * gD, gY, (int)gN, gD, gD);
        ln_launch(gY, gG2 + (size_t)l * gD, gE2 + (size_t)l * gD, gU, (int)gN, true);
        gemm_launch<2>(gU, gW1 + (size_t)l * gD * gF, gB1 + (size_t)l * gF, gHB, (int)gN, gD, gF);
        gemm_launch<1>(gHB, gW2 + (size_t)l * gF * gD, gB2 + (size_t)l * gD, gY, (int)gN, gF, gD);
    }
    ln_launch(gY, gGF, gEF, gY, (int)gN, false);
}
