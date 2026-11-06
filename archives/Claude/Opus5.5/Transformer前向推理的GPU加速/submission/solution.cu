// Transformer forward pass on tensor cores.
//
// All matrices live in "tile images" that match the register layout of mma.m16n8k16, so loads are contiguous across
// the lanes of a warp (the fast path of the load/store unit). A tile is 8 rows x 16 columns of 16-bit floats, 256 bytes:
// lane i holds two words, word w covers row i/4, columns 8w+2(i%4) and 8w+2(i%4)+1.
//   As operand A of mma two tiles give 16 rows x 16 k; as operand B one tile gives n=8 x k=16.
// x is kept in 32 bits: 16 rows x 8 columns, 512 bytes, the image of the four accumulator registers.
#include <cuda_runtime.h>
#include <cuda_fp16.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <type_traits>
#include <vector>

struct TransformerSpec { int B, S, D, H, F, L; const float* weights; };

typedef unsigned long long u64;
typedef unsigned u32;
typedef unsigned char u8;

#define CK(call) do { cudaError_t e_ = (call); if (e_ != cudaSuccess) { \
    fprintf(stderr, "solution: %s at line %d\n", cudaGetErrorString(e_), __LINE__); exit(1); } } while (0)

extern __shared__ u8 shm[];

// ---------------------------------------------------------------------------------------------------------------------
// device helpers
// ---------------------------------------------------------------------------------------------------------------------
#define DEV __device__ __forceinline__

DEV u32 pack_f16(float a, float b) { __half2 h = __floats2half2_rn(a, b); return *reinterpret_cast<u32*>(&h); }
DEV u32 pack_bf16(float a, float b) {
    return ((__float_as_uint(a) + 0x8000u) >> 16) | ((__float_as_uint(b) + 0x8000u) & 0xffff0000u);
}
DEV u64 word2(u32 lo, u32 hi) { return (u64)lo | ((u64)hi << 32); }

DEV void mma16(float& c0, float& c1, float& c2, float& c3, u32 a0, u32 a1, u32 a2, u32 a3, u32 b0, u32 b1) {
    asm volatile("mma.sync.aligned.m16n8k16.row.col.f32.f16.f16.f32 {%0,%1,%2,%3},{%4,%5,%6,%7},{%8,%9},{%10,%11,%12,%13};"
        : "=f"(c0), "=f"(c1), "=f"(c2), "=f"(c3)
        : "r"(a0), "r"(a1), "r"(a2), "r"(a3), "r"(b0), "r"(b1), "f"(c0), "f"(c1), "f"(c2), "f"(c3));
}
DEV void mma16b(float& c0, float& c1, float& c2, float& c3, u32 a0, u32 a1, u32 a2, u32 a3, u32 b0, u32 b1) {
    asm volatile("mma.sync.aligned.m16n8k16.row.col.f32.bf16.bf16.f32 {%0,%1,%2,%3},{%4,%5,%6,%7},{%8,%9},{%10,%11,%12,%13};"
        : "=f"(c0), "=f"(c1), "=f"(c2), "=f"(c3)
        : "r"(a0), "r"(a1), "r"(a2), "r"(a3), "r"(b0), "r"(b1), "f"(c0), "f"(c1), "f"(c2), "f"(c3));
}
DEV void mma8(float& c0, float& c1, float& c2, float& c3, u32 a0, u32 a1, u32 b0) {
    asm volatile("mma.sync.aligned.m16n8k8.row.col.f32.f16.f16.f32 {%0,%1,%2,%3},{%4,%5},{%6},{%7,%8,%9,%10};"
        : "=f"(c0), "=f"(c1), "=f"(c2), "=f"(c3)
        : "r"(a0), "r"(a1), "r"(b0), "f"(c0), "f"(c1), "f"(c2), "f"(c3));
}
DEV void mma8b(float& c0, float& c1, float& c2, float& c3, u32 a0, u32 a1, u32 b0) {
    asm volatile("mma.sync.aligned.m16n8k8.row.col.f32.bf16.bf16.f32 {%0,%1,%2,%3},{%4,%5},{%6},{%7,%8,%9,%10};"
        : "=f"(c0), "=f"(c1), "=f"(c2), "=f"(c3)
        : "r"(a0), "r"(a1), "r"(b0), "f"(c0), "f"(c1), "f"(c2), "f"(c3));
}

template<int N, class F> DEV void sfor(F f) {
    if constexpr (N > 0) { sfor<N - 1>(f); f(std::integral_constant<int, N - 1>{}); }
}

// 2^x, x in log2 units and well inside the normal range. Degree 3: 7.5e-5 worst relative error.
DEV float exp2_fast(float x) {
    const float big = 12582912.0f;  // 1.5 * 2^23: the mantissa of x + big holds the rounded x
    const float t = x + big;
    const float f = x - (t - big);
    const float p = ((0.055171476f * f + 0.24261111f) * f + 0.69326102f) * f + 0.99992808f;
    return __uint_as_float(__float_as_uint(p) + (__float_as_uint(t) << 23));
}
DEV float pow2i(int n) { return __uint_as_float((u32)(127 + n) << 23); }

// Across the lanes of one row, keep the largest value: rows r and r + 8
DEV void rowMax(float& m0, float& m1, float2* st, int lane) {
    st[lane] = make_float2(m0, m1);
    __syncwarp();
    const int base = lane & ~3;
    const float2 a = st[base], b = st[base + 1], c = st[base + 2], d = st[base + 3];
    m0 = fmaxf(fmaxf(a.x, b.x), fmaxf(c.x, d.x));
    m1 = fmaxf(fmaxf(a.y, b.y), fmaxf(c.y, d.y));
}

// g(t) = t * Phi(t), worst error of Phi about 1e-4
DEV float g_fast(float t) {
    const float c = fminf(fmaxf(t, -4.0f), 4.0f);
    const float s = c * c;
    float p = 2.81603894e-08f;
    p = p * s - 1.8918601e-06f;
    p = p * s + 5.41898687e-05f;
    p = p * s - 0.00087897659f;
    p = p * s + 0.009112936f;
    p = p * s - 0.0653883389f;
    p = p * s + 0.398526918f;
    return t * (0.5f + c * p);
}

DEV float asf(u32 v) { return __uint_as_float(v); }

// Copies rows x tiles of 256 bytes into shared memory; warps take rows round robin
DEV void stage(u8* dst, const u8* src, size_t srcRowStride, int rows, int tiles, int warp, int lane, int warps) {
    for (int r = warp; r < rows; r += warps) {
        u64* d = (u64*)(dst + (size_t)r * tiles * 256) + lane;
        const u64* s = (const u64*)(src + (size_t)r * srcRowStride) + lane;
        for (int q = 0; q < tiles; q++) d[q * 32] = s[q * 32];
    }
}

// C (16 rows x 16 cols, two chains) = sum over k of A(row group rg) * B(n16); tiles are owned by warps round robin.
// A rows and B columns come through the shared memory regions sA, sB; with KB16 < K16 partial tiles live in sC.
struct MMGeom {
    const u8* A; size_t Astride;  // bytes per row octet
    const u8* B; size_t Bstride;  // bytes per column octet
    int RG, N16, NB16, K16, KB16;
    bool stageA, stageB;
};

template<class Init, class Post>
DEV void mm(const MMGeom& m, u8* sA, u8* sB, u8* sC, int warp, int lane, int warps, Init init, Post post) {
    const int tiles = m.RG * m.NB16;
    const int sh = 31 - __clz(m.NB16);
    for (int nb = 0; nb < m.N16; nb += m.NB16) {
        for (int kb = 0; kb < m.K16; kb += m.KB16) {
            if (m.stageB) stage(sB, m.B + (size_t)nb * 2 * m.Bstride + (size_t)kb * 256, m.Bstride, m.NB16 * 2, m.KB16, warp, lane, warps);
            if (m.stageA && (nb == 0 || m.KB16 < m.K16)) stage(sA, m.A + (size_t)kb * 256, m.Astride, m.RG * 2, m.KB16, warp, lane, warps);
            __syncthreads();
            for (int t = warp; t < tiles; t += warps) {
                const int rg = t >> sh, n = t & (m.NB16 - 1);
                float c[8];
                uint4* cp = (uint4*)(sC + (size_t)t * 1024) + lane;
                if (kb == 0) {
                    init(rg, nb + n, c);
                } else {
                    const uint4 v = cp[0], w = cp[32];
                    c[0] = asf(v.x); c[1] = asf(v.y); c[2] = asf(v.z); c[3] = asf(v.w);
                    c[4] = asf(w.x); c[5] = asf(w.y); c[6] = asf(w.z); c[7] = asf(w.w);
                }
                const u64* a0p = (const u64*)(sA + (size_t)rg * 2 * m.KB16 * 256) + lane;
                const u64* a1p = a0p + m.KB16 * 32;
                const u64* b0p = (const u64*)(sB + (size_t)n * 2 * m.KB16 * 256) + lane;
                const u64* b1p = b0p + m.KB16 * 32;
                for (int k = 0; k < m.KB16; k++) {
                    const u64 a0 = a0p[k * 32], a1 = a1p[k * 32], b0 = b0p[k * 32], b1 = b1p[k * 32];
                    const u32 r0 = (u32)a0, r1 = (u32)a1, r2 = (u32)(a0 >> 32), r3 = (u32)(a1 >> 32);
                    mma16(c[0], c[1], c[2], c[3], r0, r1, r2, r3, (u32)b0, (u32)(b0 >> 32));
                    mma16(c[4], c[5], c[6], c[7], r0, r1, r2, r3, (u32)b1, (u32)(b1 >> 32));
                }
                if (kb + m.KB16 >= m.K16) {
                    post(rg, nb + n, c);
                } else {
                    cp[0] = make_uint4(__float_as_uint(c[0]), __float_as_uint(c[1]), __float_as_uint(c[2]), __float_as_uint(c[3]));
                    cp[32] = make_uint4(__float_as_uint(c[4]), __float_as_uint(c[5]), __float_as_uint(c[6]), __float_as_uint(c[7]));
                }
            }
            __syncthreads();
        }
    }
}

// Row statistics of one row group of x: mean and inverse deviation for rows 0-7 and 8-15 of the lane's row
struct RowStats { float m0, i0, m1, i1; };
DEV RowStats ln_stats(const u8* Xg, int Doct, int warp, int lane, u8* sT, float Dinv) {
    const uint4* xp = (const uint4*)Xg + lane;
    float s0 = 0, s1 = 0, q0 = 0, q1 = 0;
    for (int t = 0; t < Doct; t++) {
        const uint4 v = xp[t * 32];
        const float a = asf(v.x), b = asf(v.y), c = asf(v.z), d = asf(v.w);
        s0 += a + b; s1 += c + d;
        q0 += a * a + b * b; q1 += c * c + d * d;
    }
    float4* st = (float4*)sT + warp * 32;
    st[lane] = make_float4(s0, s1, q0, q1);
    __syncwarp();
    const int base = lane & ~3;
    const float4 r0 = st[base], r1 = st[base + 1], r2 = st[base + 2], r3 = st[base + 3];
    const float S0 = (r0.x + r1.x + r2.x + r3.x) * Dinv, S1 = (r0.y + r1.y + r2.y + r3.y) * Dinv;
    const float Q0 = (r0.z + r1.z + r2.z + r3.z) * Dinv, Q1 = (r0.w + r1.w + r2.w + r3.w) * Dinv;
    RowStats out;
    out.m0 = S0; out.m1 = S1;
    out.i0 = rsqrtf(Q0 - S0 * S0 + 1e-5f);
    out.i1 = rsqrtf(Q1 - S1 * S1 + 1e-5f);
    return out;
}

// Normalized x of one row group, as 16-bit tiles (rows 0-7 at Up, rows 8-15 one octet further)
DEV void ln_tiles(const u8* Xg, const u8* lnImg, int D16, const RowStats& st, u8* U0, u8* U1, int lane) {
    const uint4* xp = (const uint4*)Xg + lane;
    const float4* lp = (const float4*)lnImg + lane;
    u64* o0 = (u64*)U0 + lane;
    u64* o1 = (u64*)U1 + lane;
    for (int t = 0; t < D16; t++) {
        const uint4 v = xp[t * 64], w = xp[t * 64 + 32];
        const float4 l = lp[t * 64], n = lp[t * 64 + 32];
        const float u00 = (asf(v.x) - st.m0) * st.i0 * l.x + l.z, u01 = (asf(v.y) - st.m0) * st.i0 * l.y + l.w;
        const float u02 = (asf(v.z) - st.m1) * st.i1 * l.x + l.z, u03 = (asf(v.w) - st.m1) * st.i1 * l.y + l.w;
        const float u10 = (asf(w.x) - st.m0) * st.i0 * n.x + n.z, u11 = (asf(w.y) - st.m0) * st.i0 * n.y + n.w;
        const float u12 = (asf(w.z) - st.m1) * st.i1 * n.x + n.z, u13 = (asf(w.w) - st.m1) * st.i1 * n.y + n.w;
        o0[t * 32] = word2(pack_f16(u00, u01), pack_f16(u10, u11));
        o1[t * 32] = word2(pack_f16(u02, u03), pack_f16(u12, u13));
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// kernels
// ---------------------------------------------------------------------------------------------------------------------
struct Common {
    int S, D, H, F, d;
    int S16, Doct, D16, F16, Foct;
    int seqs;                 // sequences of this sub-batch
    size_t seqX, seqT, seqQ;  // bytes per sequence in the X, T and the D-wide 16-bit scratch images
    u8* X; u8* U; u8* Q; u8* K; u8* V; u8* O; u8* T;
};

struct MatPlan { int RG, NB16, KB16; };

__global__ void k_load(Common c, const float* x, int RG) {
    const int lane = threadIdx.x & 31, warp = threadIdx.x >> 5;
    const int warps = blockDim.x >> 5;
    const int IB = (c.S16 + RG - 1) / RG;
    const int b = blockIdx.x / IB, ib = blockIdx.x % IB;
    const int rgn = min(RG, c.S16 - ib * RG);
    const float* xs = x + (size_t)b * c.S * c.D;
    for (int rg = warp; rg < rgn; rg += warps) {
        const int g = ib * RG + rg;
        const float* r0 = xs + (size_t)(g * 16 + lane / 4) * c.D + 2 * (lane & 3);
        const float* r1 = r0 + (size_t)8 * c.D;
        uint4* o = (uint4*)(c.X + (size_t)b * c.seqX + (size_t)g * c.Doct * 512) + lane;
        for (int t = 0; t < c.Doct; t++) {
            const u64 a = *(const u64*)(r0 + t * 8), e = *(const u64*)(r1 + t * 8);
            o[t * 32] = make_uint4((u32)a, (u32)(a >> 32), (u32)e, (u32)(e >> 32));
        }
    }
}

__global__ void k_final(Common c, float* y, const u8* lnImg, int RG) {
    const int lane = threadIdx.x & 31, warp = threadIdx.x >> 5;
    const int warps = blockDim.x >> 5;
    const int IB = (c.S16 + RG - 1) / RG;
    const int b = blockIdx.x / IB, ib = blockIdx.x % IB;
    const int rgn = min(RG, c.S16 - ib * RG);
    float* ys = y + (size_t)b * c.S * c.D;
    const float Dinv = 1.0f / c.D;
    for (int rg = warp; rg < rgn; rg += warps) {
        const int g = ib * RG + rg;
        const u8* Xg = c.X + (size_t)b * c.seqX + (size_t)g * c.Doct * 512;
        RowStats st = ln_stats(Xg, c.Doct, warp, lane, shm, Dinv);
        const uint4* xp = (const uint4*)Xg + lane;
        const float4* lp = (const float4*)lnImg + lane;
        float* r0 = ys + (size_t)(g * 16 + lane / 4) * c.D + 2 * (lane & 3);
        float* r1 = r0 + (size_t)8 * c.D;
        for (int t = 0; t < c.Doct; t++) {
            const uint4 v = xp[t * 32];
            const float4 l = lp[t * 32];
            const float a = (asf(v.x) - st.m0) * st.i0 * l.x + l.z, e = (asf(v.y) - st.m0) * st.i0 * l.y + l.w;
            const float f = (asf(v.z) - st.m1) * st.i1 * l.x + l.z, h = (asf(v.w) - st.m1) * st.i1 * l.y + l.w;
            *(u64*)(r0 + t * 8) = word2(__float_as_uint(a), __float_as_uint(e));
            *(u64*)(r1 + t * 8) = word2(__float_as_uint(f), __float_as_uint(h));
        }
    }
}

// Shared memory layout helpers. sT: statistics (512 bytes per warp)
struct QkvArgs {
    const u8* ln;
    const u8* WQ; const u8* WK; const u8* WV;
    const u8* bQ; const u8* bK; const u8* bVr;
    MatPlan p;
    int ACH;      // dim groups of W_V per chunk
    int NBV16;    // token groups of u per chunk for V (K-split only)
};

// LN, then Q = u WQ, K = u WK, V^T = WV^T u^T
__global__ void k_qkv(Common c, QkvArgs a) {
    const int lane = threadIdx.x & 31, warp = threadIdx.x >> 5;
    const int warps = blockDim.x >> 5;
    const int RG = a.p.RG;
    const int IB = (c.S16 + RG - 1) / RG;
    const int b = blockIdx.x / IB, ib = blockIdx.x % IB;
    const int g0 = ib * RG;
    const int rgn = min(RG, c.S16 - g0);
    const bool whole = a.p.KB16 >= c.D16;
    const float Dinv = 1.0f / c.D;
    u8* sT = shm;
    u8* sA = shm + warps * 512;
    const int KB = a.p.KB16;
    const size_t uStride = (size_t)c.D16 * 256;
    u8* Us = c.U + (size_t)b * c.seqQ + (size_t)g0 * 2 * uStride;
    for (int rg = warp; rg < rgn; rg += warps) {
        const int g = g0 + rg;
        const u8* Xg = c.X + (size_t)b * c.seqX + (size_t)g * c.Doct * 512;
        RowStats st = ln_stats(Xg, c.Doct, warp, lane, sT, Dinv);
        if (whole) ln_tiles(Xg, a.ln, c.D16, st, sA + (size_t)rg * 2 * uStride, sA + (size_t)(rg * 2 + 1) * uStride, lane);
        else ln_tiles(Xg, a.ln, c.D16, st, Us + (size_t)rg * 2 * uStride, Us + (size_t)(rg * 2 + 1) * uStride, lane);
    }
    __syncthreads();
    u8* sB = sA + (size_t)RG * 2 * KB * 256;
    u8* sC = sB + (size_t)a.p.NB16 * 2 * KB * 256;
    MMGeom m;
    m.A = whole ? sA : Us; m.Astride = uStride;
    m.RG = rgn; m.N16 = c.D16; m.NB16 = a.p.NB16; m.K16 = c.D16; m.KB16 = KB;
    m.Bstride = uStride; m.stageA = !whole; m.stageB = true;
    const size_t off0 = (size_t)b * c.seqQ + (size_t)g0 * 2 * uStride;
    {
        m.B = a.WQ;
        u8* out = c.Q + off0;
        const u64* bi = (const u64*)a.bQ + lane;
        mm(m, sA, sB, sC, warp, lane, warps,
           [&](int, int n16, float* v) { const u64 p = bi[n16 * 64], q = bi[n16 * 64 + 32];
               v[0] = v[2] = asf((u32)p); v[1] = v[3] = asf((u32)(p >> 32)); v[4] = v[6] = asf((u32)q); v[5] = v[7] = asf((u32)(q >> 32)); },
           [&](int rg, int n16, const float* v) {
               u64* o0 = (u64*)(out + (size_t)rg * 2 * uStride + (size_t)n16 * 256) + lane;
               u64* o1 = (u64*)(out + (size_t)(rg * 2 + 1) * uStride + (size_t)n16 * 256) + lane;
               *o0 = word2(pack_f16(v[0], v[1]), pack_f16(v[4], v[5]));
               *o1 = word2(pack_f16(v[2], v[3]), pack_f16(v[6], v[7])); });
    }
    {
        m.B = a.WK;
        u8* out = c.K + off0;
        const u64* bi = (const u64*)a.bK + lane;
        mm(m, sA, sB, sC, warp, lane, warps,
           [&](int, int n16, float* v) { const u64 p = bi[n16 * 64], q = bi[n16 * 64 + 32];
               v[0] = v[2] = asf((u32)p); v[1] = v[3] = asf((u32)(p >> 32)); v[4] = v[6] = asf((u32)q); v[5] = v[7] = asf((u32)(q >> 32)); },
           [&](int rg, int n16, const float* v) {
               u64* o0 = (u64*)(out + (size_t)rg * 2 * uStride + (size_t)n16 * 256) + lane;
               u64* o1 = (u64*)(out + (size_t)(rg * 2 + 1) * uStride + (size_t)n16 * 256) + lane;
               *o0 = word2(pack_f16(v[0], v[1]), pack_f16(v[4], v[5]));
               *o1 = word2(pack_f16(v[2], v[3]), pack_f16(v[6], v[7])); });
    }
    {
        // V^T: rows are output dims (from W_V), columns are tokens of this job, contraction over input dims.
        MMGeom v = m;
        const size_t Vstride = (size_t)c.S16 * 256;
        u8* out = c.V + (size_t)b * c.seqQ;
        const u64* bi = (const u64*)a.bVr + lane;
        int nbv = whole ? rgn : min(a.NBV16, rgn);
        if (!whole) nbv = 1 << (31 - __clz(nbv));
        int ach = a.ACH;
        u8* vA = whole ? sB : sA;
        u8* vB = whole ? sA : sB;
        for (int d0 = 0; d0 < c.D16; d0 += ach) {
            v.A = a.WV + (size_t)d0 * 2 * uStride; v.Astride = uStride;
            v.B = whole ? sA : Us; v.Bstride = uStride;
            v.RG = min(ach, c.D16 - d0);
            v.N16 = rgn; v.NB16 = whole ? (1 << (32 - __clz(rgn - 1))) : nbv;
            v.K16 = c.D16; v.KB16 = KB;
            v.stageA = true; v.stageB = !whole;
            mm(v, vA, vB, sC, warp, lane, warps,
               [&](int rg, int, float* w) { const u64 p = bi[(d0 + rg) * 32];
                   w[0] = w[1] = w[4] = w[5] = asf((u32)p); w[2] = w[3] = w[6] = w[7] = asf((u32)(p >> 32)); },
               [&](int rg, int n16, const float* w) {
                   if (n16 >= rgn) return;
                   u64* o0 = (u64*)(out + (size_t)(d0 + rg) * 2 * Vstride + (size_t)(g0 + n16) * 256) + lane;
                   u64* o1 = (u64*)(out + (size_t)((d0 + rg) * 2 + 1) * Vstride + (size_t)(g0 + n16) * 256) + lane;
                   *o0 = word2(pack_f16(w[0], w[1]), pack_f16(w[4], w[5]));
                   *o1 = word2(pack_f16(w[2], w[3]), pack_f16(w[6], w[7])); });
        }
    }
}

// Each row keeps its attention weights in the 16-bit float range: weights are exp(e) * 2^-c with a per-row integer c.
// The first tile sets c so that the largest weight is about 2^RANGE_TARGET; whenever a value would pass 2^RANGE_MAX the
// row is rescaled, together with what it has accumulated so far.
#define RANGE_MAX 15.5f
#define RANGE_TARGET 4

// Attention for d >= 16. Block: one sequence, one head, RG = warps row groups. Q and O are in registers.
template<int DQ>
__global__ void k_attn(Common c, int h0, int hn, int JG) {
    const int lane = threadIdx.x & 31, warp = threadIdx.x >> 5;
    const int RG = blockDim.x >> 5;
    const int IB = (c.S16 + RG - 1) / RG;
    const int ib = blockIdx.x % IB;
    const int hh = blockIdx.x / IB;
    const int b = hh / hn;
    const int h = h0 + hh % hn;
    const int g0 = ib * RG, g = g0 + warp;
    const int gl = min(g0 + RG, c.S16) - 1;
    const size_t tokStride = (size_t)c.D16 * 256;
    const size_t dimStride = (size_t)c.S16 * 256;
    const u8* Kh = c.K + (size_t)b * c.seqQ + (size_t)h * DQ * 256;
    const u8* Vh = c.V + (size_t)b * c.seqQ + (size_t)h * DQ * 2 * dimStride;
    u8* sK = shm;
    u8* sV = shm + (size_t)JG * 2 * DQ * 256;
    u8* sT = sV + (size_t)DQ * 2 * JG * 256;
    u32 q[DQ * 4];
    float o[DQ * 8];
    float s0 = 0, s1 = 0, c0 = 0, c1 = 0;
    const bool active = g <= gl;
    if (active) {
        const u64* q0 = (const u64*)(c.Q + (size_t)b * c.seqQ + (size_t)g * 2 * tokStride + (size_t)h * DQ * 256) + lane;
        const u64* q1 = q0 + tokStride / 8;
        sfor<DQ>([&](auto I) { constexpr int k = decltype(I)::value;
            const u64 a0 = q0[k * 32], a1 = q1[k * 32];
            q[k * 4] = (u32)a0; q[k * 4 + 1] = (u32)a1; q[k * 4 + 2] = (u32)(a0 >> 32); q[k * 4 + 3] = (u32)(a1 >> 32); });
    }
    sfor<DQ * 8>([&](auto I) { o[decltype(I)::value] = 0.f; });
    for (int jb = 0; jb <= gl; jb += JG) {
        const int jn = min(JG, gl + 1 - jb);
        stage(sK, Kh + (size_t)jb * 2 * tokStride, tokStride, jn * 2, DQ, warp, lane, RG);
        stage(sV, Vh + (size_t)jb * 256, dimStride, DQ * 2, jn, warp, lane, RG);
        __syncthreads();
        if (active) {
            const u64* kp = (const u64*)sK + lane;
            const u64* vp = (const u64*)sV + lane;
            const int stop = min(jn, g + 1 - jb);
            for (int jg = 0; jg < stop; jg++) {
                float e[8] = {0, 0, 0, 0, 0, 0, 0, 0};
                const u64* k0 = kp + (size_t)jg * 2 * DQ * 32;
                const u64* k1 = k0 + DQ * 32;
                sfor<DQ>([&](auto I) { constexpr int k = decltype(I)::value;
                    const u64 b0 = k0[k * 32], b1 = k1[k * 32];
                    mma16(e[0], e[1], e[2], e[3], q[k * 4], q[k * 4 + 1], q[k * 4 + 2], q[k * 4 + 3], (u32)b0, (u32)(b0 >> 32));
                    mma16(e[4], e[5], e[6], e[7], q[k * 4], q[k * 4 + 1], q[k * 4 + 2], q[k * 4 + 3], (u32)b1, (u32)(b1 >> 32)); });
                float xv[8];
                xv[0] = e[0] - c0; xv[1] = e[1] - c0; xv[2] = e[2] - c1; xv[3] = e[3] - c1;
                xv[4] = e[4] - c0; xv[5] = e[5] - c0; xv[6] = e[6] - c1; xv[7] = e[7] - c1;
                const bool diag = jb + jg == g;
                bool valid[8] = {true, true, true, true, true, true, true, true};
                float m0, m1;
                if (diag) {
                    const int r = lane >> 2, cc = (lane & 3) * 2;
                    valid[0] = cc <= r; valid[1] = cc + 1 <= r; valid[2] = cc <= r + 8; valid[3] = cc + 1 <= r + 8;
                    valid[4] = cc + 8 <= r; valid[5] = cc + 9 <= r; valid[6] = cc <= r; valid[7] = cc + 1 <= r;
                    m0 = -1e6f; m1 = -1e6f;
                    if (valid[0]) m0 = fmaxf(m0, xv[0]);
                    if (valid[1]) m0 = fmaxf(m0, xv[1]);
                    if (valid[4]) m0 = fmaxf(m0, xv[4]);
                    if (valid[5]) m0 = fmaxf(m0, xv[5]);
                    if (valid[2]) m1 = fmaxf(m1, xv[2]);
                    if (valid[3]) m1 = fmaxf(m1, xv[3]);
                    if (valid[6]) m1 = fmaxf(m1, xv[6]);
                    if (valid[7]) m1 = fmaxf(m1, xv[7]);
                } else {
                    m0 = fmaxf(fmaxf(xv[0], xv[1]), fmaxf(xv[4], xv[5]));
                    m1 = fmaxf(fmaxf(xv[2], xv[3]), fmaxf(xv[6], xv[7]));
                }
                const bool first = jb == 0 && jg == 0;
                if (first || __ballot_sync(0xffffffffu, m0 > RANGE_MAX || m1 > RANGE_MAX)) {
                    rowMax(m0, m1, (float2*)sT + warp * 32, lane);
                    const int d0 = first || m0 > RANGE_MAX ? (int)floorf(m0) - RANGE_TARGET : 0;
                    const int d1 = first || m1 > RANGE_MAX ? (int)floorf(m1) - RANGE_TARGET : 0;
                    const float f0 = pow2i(-d0), f1 = pow2i(-d1);
                    const float dd0 = (float)d0, dd1 = (float)d1;
                    c0 += dd0; c1 += dd1;
                    xv[0] -= dd0; xv[1] -= dd0; xv[4] -= dd0; xv[5] -= dd0;
                    xv[2] -= dd1; xv[3] -= dd1; xv[6] -= dd1; xv[7] -= dd1;
                    s0 *= f0; s1 *= f1;
                    sfor<DQ * 2>([&](auto I) { constexpr int t = decltype(I)::value;
                        o[t * 4] *= f0; o[t * 4 + 1] *= f0; o[t * 4 + 2] *= f1; o[t * 4 + 3] *= f1; });
                }
                float al[8];
                sfor<8>([&](auto I) { constexpr int m = decltype(I)::value; al[m] = exp2_fast(xv[m]); });
                if (diag) {
                    sfor<8>([&](auto I) { constexpr int m = decltype(I)::value; if (!valid[m]) al[m] = 0.f; });
                }
                s0 += al[0] + al[1] + al[4] + al[5];
                s1 += al[2] + al[3] + al[6] + al[7];
                const u32 a0 = pack_f16(al[0], al[1]), a1 = pack_f16(al[2], al[3]);
                const u32 a2 = pack_f16(al[4], al[5]), a3 = pack_f16(al[6], al[7]);
                const u64* vj = vp + (size_t)jg * 32;
                sfor<DQ * 2>([&](auto I) { constexpr int t = decltype(I)::value;
                    const u64 w = vj[(size_t)t * jn * 32];
                    mma16(o[t * 4], o[t * 4 + 1], o[t * 4 + 2], o[t * 4 + 3], a0, a1, a2, a3, (u32)w, (u32)(w >> 32)); });
            }
        }
        __syncthreads();
    }
    if (active) {
        float2* st = (float2*)sT + warp * 32;
        st[lane] = make_float2(s0, s1);
        __syncwarp();
        const int base = lane & ~3;
        const float2 r0 = st[base], r1 = st[base + 1], r2 = st[base + 2], r3 = st[base + 3];
        const float i0 = 1.0f / (r0.x + r1.x + r2.x + r3.x), i1 = 1.0f / (r0.y + r1.y + r2.y + r3.y);
        u64* o0 = (u64*)(c.O + (size_t)b * c.seqQ + (size_t)g * 2 * tokStride + (size_t)h * DQ * 256) + lane;
        u64* o1 = o0 + tokStride / 8;
        sfor<DQ>([&](auto I) { constexpr int t = decltype(I)::value;
            o0[t * 32] = word2(pack_f16(o[t * 8] * i0, o[t * 8 + 1] * i0), pack_f16(o[t * 8 + 4] * i0, o[t * 8 + 5] * i0));
            o1[t * 32] = word2(pack_f16(o[t * 8 + 2] * i1, o[t * 8 + 3] * i1), pack_f16(o[t * 8 + 6] * i1, o[t * 8 + 7] * i1)); });
    }
}

// Attention for d = 4: one block handles a quad of heads, all 16 dims of one tile.
__global__ void k_attn4(Common c, int JG) {
    const int lane = threadIdx.x & 31, warp = threadIdx.x >> 5;
    const int RG = blockDim.x >> 5;
    const int IB = (c.S16 + RG - 1) / RG;
    const int ib = blockIdx.x % IB;
    const int hh = blockIdx.x / IB;
    const int b = hh / c.D16;
    const int qd = hh % c.D16;
    const int g0 = ib * RG, g = g0 + warp;
    const int gl = min(g0 + RG, c.S16) - 1;
    const size_t tokStride = (size_t)c.D16 * 256;
    const size_t dimStride = (size_t)c.S16 * 256;
    const u8* Kh = c.K + (size_t)b * c.seqQ + (size_t)qd * 256;
    const u8* Vh = c.V + (size_t)b * c.seqQ + (size_t)qd * 2 * dimStride;
    u8* sK = shm;
    u8* sV = shm + (size_t)JG * 2 * 256;
    u8* sT = sV + (size_t)2 * JG * 256;
    u32 q[4];
    float o[16];
    float s[8];
    float cs[8];
    for (int i = 0; i < 16; i++) o[i] = 0.f;
    for (int i = 0; i < 8; i++) { s[i] = 0.f; cs[i] = 0.f; }
    const bool active = g <= gl;
    if (active) {
        const u64* q0 = (const u64*)(c.Q + (size_t)b * c.seqQ + (size_t)g * 2 * tokStride + (size_t)qd * 256) + lane;
        const u64* q1 = q0 + tokStride / 8;
        const u64 a0 = *q0, a1 = *q1;
        q[0] = (u32)a0; q[1] = (u32)a1; q[2] = (u32)(a0 >> 32); q[3] = (u32)(a1 >> 32);
    }
    const u32 kLow = (lane & 2) ? 0u : ~0u;     // k < 4 of a k8 fragment
    const u32 nLow = (lane >> 2) < 4 ? ~0u : 0u;  // n < 4 of a fragment
    for (int jb = 0; jb <= gl; jb += JG) {
        const int jn = min(JG, gl + 1 - jb);
        stage(sK, Kh + (size_t)jb * 2 * tokStride, tokStride, jn * 2, 1, warp, lane, RG);
        stage(sV, Vh + (size_t)jb * 256, dimStride, 2, jn, warp, lane, RG);
        __syncthreads();
        if (active) {
            const u64* kp = (const u64*)sK + lane;
            const u64* vp = (const u64*)sV + lane;
            const int stop = min(jn, g + 1 - jb);
            for (int jg = 0; jg < stop; jg++) {
                const u64 wv0 = vp[(size_t)jg * 32], wv1 = vp[(size_t)(jn + jg) * 32];
                sfor<2>([&](auto OC) { constexpr int oc = decltype(OC)::value;
                    const u64 kw = kp[(size_t)(jg * 2 + oc) * 32];
                    const bool diag = jb + jg == g;
                    const bool first = jb == 0 && jg == 0 && oc == 0;
                    sfor<4>([&](auto HH) { constexpr int hh2 = decltype(HH)::value;
                        const u32 mk = (hh2 & 1) ? ~kLow : kLow;
                        const u32 mn = (hh2 & 1) ? ~nLow : nLow;
                        const u32 w = (hh2 & 2) ? (u32)(kw >> 32) : (u32)kw;
                        const u32 a0 = (hh2 & 2) ? q[2] : q[0], a1 = (hh2 & 2) ? q[3] : q[1];
                        float e0 = 0, e1 = 0, e2 = 0, e3 = 0;
                        mma8(e0, e1, e2, e3, a0, a1, w & mk);
                        float& c0 = cs[hh2 * 2]; float& c1 = cs[hh2 * 2 + 1];
                        float x0 = e0 - c0, x1 = e1 - c0, x2 = e2 - c1, x3 = e3 - c1;
                        bool v0 = true, v1 = true, v2 = true, v3 = true;
                        float m0, m1;
                        if (diag) {
                            const int r = lane >> 2, cc = (lane & 3) * 2 + oc * 8;
                            v0 = cc <= r; v1 = cc + 1 <= r; v2 = cc <= r + 8; v3 = cc + 1 <= r + 8;
                            m0 = -1e6f; m1 = -1e6f;
                            if (v0) m0 = fmaxf(m0, x0);
                            if (v1) m0 = fmaxf(m0, x1);
                            if (v2) m1 = fmaxf(m1, x2);
                            if (v3) m1 = fmaxf(m1, x3);
                        } else {
                            m0 = fmaxf(x0, x1); m1 = fmaxf(x2, x3);
                        }
                        if (first || __ballot_sync(0xffffffffu, m0 > RANGE_MAX || m1 > RANGE_MAX)) {
                            rowMax(m0, m1, (float2*)sT + warp * 64, lane);
                            const int d0 = first || m0 > RANGE_MAX ? (int)floorf(m0) - RANGE_TARGET : 0;
                            const int d1 = first || m1 > RANGE_MAX ? (int)floorf(m1) - RANGE_TARGET : 0;
                            const float dd0 = (float)d0, dd1 = (float)d1;
                            c0 += dd0; c1 += dd1;
                            x0 -= dd0; x1 -= dd0; x2 -= dd1; x3 -= dd1;
                            const float f0 = pow2i(-d0), f1 = pow2i(-d1);
                            s[hh2 * 2] *= f0; s[hh2 * 2 + 1] *= f1;
                            const bool mine = (hh2 & 1) ? (lane & 2) != 0 : (lane & 2) == 0;
                            const int ti = (hh2 >> 1) * 8;
                            if (mine) { o[ti] *= f0; o[ti + 1] *= f0; o[ti + 2] *= f1; o[ti + 3] *= f1; }
                        }
                        float al0 = exp2_fast(x0), al1 = exp2_fast(x1), al2 = exp2_fast(x2), al3 = exp2_fast(x3);
                        if (diag) {
                            if (!v0) al0 = 0.f;
                            if (!v1) al1 = 0.f;
                            if (!v2) al2 = 0.f;
                            if (!v3) al3 = 0.f;
                        }
                        s[hh2 * 2] += al0 + al1;
                        s[hh2 * 2 + 1] += al2 + al3;
                        const u64 wv = (hh2 & 2) ? wv1 : wv0;
                        const u32 vw = oc ? (u32)(wv >> 32) : (u32)wv;
                        const int ti = (hh2 >> 1) * 8;
                        mma8(o[ti], o[ti + 1], o[ti + 2], o[ti + 3], pack_f16(al0, al1), pack_f16(al2, al3), vw & mn);
                    });
                });
            }
        }
        __syncthreads();
    }
    if (active) {
        float4* st = (float4*)sT + warp * 64;
        st[lane] = make_float4(s[0], s[1], s[2], s[3]);
        st[lane + 32] = make_float4(s[4], s[5], s[6], s[7]);
        __syncwarp();
        const int base = lane & ~3;
        const float4 p0 = st[base], p1 = st[base + 1], p2 = st[base + 2], p3 = st[base + 3];
        const float4 r0 = st[base + 32], r1 = st[base + 33], r2 = st[base + 34], r3 = st[base + 35];
        const bool odd = lane & 2;
        const float i0a = 1.0f / (odd ? p0.z + p1.z + p2.z + p3.z : p0.x + p1.x + p2.x + p3.x);
        const float i1a = 1.0f / (odd ? p0.w + p1.w + p2.w + p3.w : p0.y + p1.y + p2.y + p3.y);
        const float i0b = 1.0f / (odd ? r0.z + r1.z + r2.z + r3.z : r0.x + r1.x + r2.x + r3.x);
        const float i1b = 1.0f / (odd ? r0.w + r1.w + r2.w + r3.w : r0.y + r1.y + r2.y + r3.y);
        u64* o0 = (u64*)(c.O + (size_t)b * c.seqQ + (size_t)g * 2 * tokStride + (size_t)qd * 256) + lane;
        u64* o1 = o0 + tokStride / 8;
        *o0 = word2(pack_f16(o[0] * i0a, o[1] * i0a), pack_f16(o[8] * i0b, o[9] * i0b));
        *o1 = word2(pack_f16(o[2] * i1a, o[3] * i1a), pack_f16(o[10] * i1b, o[11] * i1b));
    }
}

struct UpdArgs {
    const u8* ln;
    const u8* WO; const u8* W1;
    const u8* bO; const u8* b1;
    MatPlan pO, p1;
};

// x += O W_O + b_O, then LN and t = u W_1 + b_1, T = g(t)
__global__ void k_upd1(Common c, UpdArgs a) {
    const int lane = threadIdx.x & 31, warp = threadIdx.x >> 5;
    const int warps = blockDim.x >> 5;
    const int RG = a.pO.RG;
    const int IB = (c.S16 + RG - 1) / RG;
    const int b = blockIdx.x / IB, ib = blockIdx.x % IB;
    const int g0 = ib * RG;
    const int rgn = min(RG, c.S16 - g0);
    const float Dinv = 1.0f / c.D;
    u8* sT = shm;
    u8* sA = shm + warps * 512;
    const size_t uStride = (size_t)c.D16 * 256;
    const size_t tStride = (size_t)c.F16 * 256;
    const size_t off0 = (size_t)b * c.seqQ + (size_t)g0 * 2 * uStride;
    u8* Xs = c.X + (size_t)b * c.seqX + (size_t)g0 * c.Doct * 512;
    {
        const int KB = a.pO.KB16;
        u8* sB = sA + (size_t)RG * 2 * KB * 256;
        u8* sC = sB + (size_t)a.pO.NB16 * 2 * KB * 256;
        MMGeom m;
        m.A = c.O + off0; m.Astride = uStride;
        m.B = a.WO; m.Bstride = uStride;
        m.RG = rgn; m.N16 = c.D16; m.NB16 = a.pO.NB16; m.K16 = c.D16; m.KB16 = KB;
        m.stageA = true; m.stageB = true;
        const u64* bi = (const u64*)a.bO + lane;
        mm(m, sA, sB, sC, warp, lane, warps,
           [&](int rg, int n16, float* v) {
               const uint4* xp = (const uint4*)(Xs + (size_t)rg * c.Doct * 512 + (size_t)n16 * 1024) + lane;
               const uint4 p = xp[0], q = xp[32];
               const u64 bp = bi[n16 * 64], bq = bi[n16 * 64 + 32];
               const float b0 = asf((u32)bp), b1 = asf((u32)(bp >> 32)), b2 = asf((u32)bq), b3 = asf((u32)(bq >> 32));
               v[0] = asf(p.x) + b0; v[1] = asf(p.y) + b1; v[2] = asf(p.z) + b0; v[3] = asf(p.w) + b1;
               v[4] = asf(q.x) + b2; v[5] = asf(q.y) + b3; v[6] = asf(q.z) + b2; v[7] = asf(q.w) + b3; },
           [&](int rg, int n16, const float* v) {
               uint4* xp = (uint4*)(Xs + (size_t)rg * c.Doct * 512 + (size_t)n16 * 1024) + lane;
               xp[0] = make_uint4(__float_as_uint(v[0]), __float_as_uint(v[1]), __float_as_uint(v[2]), __float_as_uint(v[3]));
               xp[32] = make_uint4(__float_as_uint(v[4]), __float_as_uint(v[5]), __float_as_uint(v[6]), __float_as_uint(v[7])); });
    }
    const int KB = a.p1.KB16;
    const bool whole = KB >= c.D16;
    u8* Us = c.U + off0;
    for (int rg = warp; rg < rgn; rg += warps) {
        const u8* Xg = Xs + (size_t)rg * c.Doct * 512;
        RowStats st = ln_stats(Xg, c.Doct, warp, lane, sT, Dinv);
        if (whole) ln_tiles(Xg, a.ln, c.D16, st, sA + (size_t)rg * 2 * uStride, sA + (size_t)(rg * 2 + 1) * uStride, lane);
        else ln_tiles(Xg, a.ln, c.D16, st, Us + (size_t)rg * 2 * uStride, Us + (size_t)(rg * 2 + 1) * uStride, lane);
    }
    __syncthreads();
    {
        u8* sB = sA + (size_t)RG * 2 * KB * 256;
        u8* sC = sB + (size_t)a.p1.NB16 * 2 * KB * 256;
        MMGeom m;
        m.A = whole ? sA : Us; m.Astride = uStride;
        m.B = a.W1; m.Bstride = uStride;
        m.RG = rgn; m.N16 = c.F16; m.NB16 = a.p1.NB16; m.K16 = c.D16; m.KB16 = KB;
        m.stageA = !whole; m.stageB = true;
        const u64* bi = (const u64*)a.b1 + lane;
        u8* out = c.T + (size_t)b * c.seqT + (size_t)g0 * 2 * tStride;
        mm(m, sA, sB, sC, warp, lane, warps,
           [&](int, int n16, float* v) { const u64 p = bi[n16 * 64], q = bi[n16 * 64 + 32];
               v[0] = v[2] = asf((u32)p); v[1] = v[3] = asf((u32)(p >> 32)); v[4] = v[6] = asf((u32)q); v[5] = v[7] = asf((u32)(q >> 32)); },
           [&](int rg, int n16, const float* v) {
               u64* o0 = (u64*)(out + (size_t)rg * 2 * tStride + (size_t)n16 * 256) + lane;
               u64* o1 = (u64*)(out + (size_t)(rg * 2 + 1) * tStride + (size_t)n16 * 256) + lane;
               *o0 = word2(pack_f16(g_fast(v[0]), g_fast(v[1])), pack_f16(g_fast(v[4]), g_fast(v[5])));
               *o1 = word2(pack_f16(g_fast(v[2]), g_fast(v[3])), pack_f16(g_fast(v[6]), g_fast(v[7]))); });
    }
}

// x += T W_2 + b_2
__global__ void k_upd2(Common c, const u8* W2, const u8* b2, MatPlan p) {
    const int lane = threadIdx.x & 31, warp = threadIdx.x >> 5;
    const int warps = blockDim.x >> 5;
    const int RG = p.RG;
    const int IB = (c.S16 + RG - 1) / RG;
    const int b = blockIdx.x / IB, ib = blockIdx.x % IB;
    const int g0 = ib * RG;
    const int rgn = min(RG, c.S16 - g0);
    const size_t tStride = (size_t)c.F16 * 256;
    u8* sA = shm;
    const int KB = p.KB16;
    u8* sB = sA + (size_t)RG * 2 * KB * 256;
    u8* sC = sB + (size_t)p.NB16 * 2 * KB * 256;
    u8* Xs = c.X + (size_t)b * c.seqX + (size_t)g0 * c.Doct * 512;
    MMGeom m;
    m.A = c.T + (size_t)b * c.seqT + (size_t)g0 * 2 * tStride; m.Astride = tStride;
    m.B = W2; m.Bstride = tStride;
    m.RG = rgn; m.N16 = c.D16; m.NB16 = p.NB16; m.K16 = c.F16; m.KB16 = KB;
    m.stageA = true; m.stageB = true;
    const u64* bi = (const u64*)b2 + lane;
    mm(m, sA, sB, sC, warp, lane, warps,
       [&](int rg, int n16, float* v) {
           const uint4* xp = (const uint4*)(Xs + (size_t)rg * c.Doct * 512 + (size_t)n16 * 1024) + lane;
           const uint4 p0 = xp[0], q0 = xp[32];
           const u64 bp = bi[n16 * 64], bq = bi[n16 * 64 + 32];
           const float b0 = asf((u32)bp), b1 = asf((u32)(bp >> 32)), b2v = asf((u32)bq), b3 = asf((u32)(bq >> 32));
           v[0] = asf(p0.x) + b0; v[1] = asf(p0.y) + b1; v[2] = asf(p0.z) + b0; v[3] = asf(p0.w) + b1;
           v[4] = asf(q0.x) + b2v; v[5] = asf(q0.y) + b3; v[6] = asf(q0.z) + b2v; v[7] = asf(q0.w) + b3; },
       [&](int rg, int n16, const float* v) {
           uint4* xp = (uint4*)(Xs + (size_t)rg * c.Doct * 512 + (size_t)n16 * 1024) + lane;
           xp[0] = make_uint4(__float_as_uint(v[0]), __float_as_uint(v[1]), __float_as_uint(v[2]), __float_as_uint(v[3]));
           xp[32] = make_uint4(__float_as_uint(v[4]), __float_as_uint(v[5]), __float_as_uint(v[6]), __float_as_uint(v[7])); });
}

// ---------------------------------------------------------------------------------------------------------------------
// host
// ---------------------------------------------------------------------------------------------------------------------
namespace {

struct LayerImg {
    u8* ln1; u8* ln2;
    u8* WQ; u8* WK; u8* WV; u8* WO; u8* W1; u8* W2;
    u8* bQ; u8* bK; u8* bVr; u8* bO; u8* b1; u8* b2;
};

struct State {
    TransformerSpec s;
    const float* x; float* y;
    std::vector<LayerImg> layers;
    u8* lnEnd;
    Common c;
    int batch;     // sequences per sub-batch
    MatPlan pQ, pO, p1, p2;
    int ACH, NBV16, warpsMM, loadRG;
} st;

const size_t SHM_MAX = 99 * 1024;

u8* gpuAlloc(size_t bytes) { u8* p; CK(cudaMalloc(&p, bytes)); return p; }

u8* upload(const std::vector<u8>& h) {
    u8* p = gpuAlloc(h.size());
    CK(cudaMemcpy(p, h.data(), h.size(), cudaMemcpyHostToDevice));
    return p;
}

unsigned short toHalf(float v) {
    // round to nearest, ties to even, with subnormals
    u32 b; memcpy(&b, &v, 4);
    const u32 sign = (b >> 16) & 0x8000u;
    const int e = (int)((b >> 23) & 255) - 127;
    u32 m = b & 0x7fffffu;
    if (e > 15) return (unsigned short)(sign | 0x7c00u);
    if (e >= -14) {
        u32 r = ((u32)(e + 15) << 10) | (m >> 13);
        const u32 rest = m & 0x1fffu;
        if (rest > 0x1000u || (rest == 0x1000u && (r & 1))) r++;
        return (unsigned short)(sign | r);
    }
    if (e < -25) return (unsigned short)sign;
    m |= 0x800000u;
    const int sh = -e - 1;  // shift so that the result is in units of 2^-24
    u32 r = m >> sh;
    const u32 rest = m & ((1u << sh) - 1), half = 1u << (sh - 1);
    if (rest > half || (rest == half && (r & 1))) r++;
    return (unsigned short)(sign | r);
}

// Weight W (K rows, N columns, row major) as B image [N/8][K/16], multiplied by scale
u8* weightImage(const float* W, int K, int N, float scale) {
    std::vector<u8> h((size_t)(N / 8) * (K / 16) * 256);
    for (int kr = 0; kr < K; kr++) for (int nc = 0; nc < N; nc++) {
        const int r8 = nc & 7, cc = kr & 15, lane = r8 * 4 + (cc & 7) / 2, word = cc >> 3, half = cc & 1;
        const size_t off = ((size_t)(nc / 8) * (K / 16) + kr / 16) * 256 + lane * 8 + word * 4 + half * 2;
        const unsigned short v = toHalf(W[(size_t)kr * N + nc] * scale);
        memcpy(&h[off], &v, 2);
    }
    return upload(h);
}

// b as columns of a tile: [N/8] x 32 lanes x 2 floats
u8* biasImage(const float* b, int N, float scale) {
    std::vector<u8> h((size_t)(N / 8) * 256);
    for (int t = 0; t < N / 8; t++) for (int lane = 0; lane < 32; lane++) {
        const float v[2] = {b[t * 8 + 2 * (lane & 3)] * scale, b[t * 8 + 2 * (lane & 3) + 1] * scale};
        memcpy(&h[(size_t)t * 256 + lane * 8], v, 8);
    }
    return upload(h);
}

// b as rows of a tile: [N/16] x 32 lanes x (row lane/4, row lane/4 + 8)
u8* biasRowImage(const float* b, int N) {
    std::vector<u8> h((size_t)(N / 16) * 256);
    for (int t = 0; t < N / 16; t++) for (int lane = 0; lane < 32; lane++) {
        const float v[2] = {b[t * 16 + lane / 4], b[t * 16 + lane / 4 + 8]};
        memcpy(&h[(size_t)t * 256 + lane * 8], v, 8);
    }
    return upload(h);
}

// gamma, beta: [D/8] x 32 lanes x (g0, g1, b0, b1)
u8* lnImage(const float* g, const float* b, int D) {
    std::vector<u8> h((size_t)(D / 8) * 512);
    for (int t = 0; t < D / 8; t++) for (int lane = 0; lane < 32; lane++) {
        const int c = t * 8 + 2 * (lane & 3);
        const float v[4] = {g[c], g[c + 1], b[c], b[c + 1]};
        memcpy(&h[(size_t)t * 512 + lane * 16], v, 16);
    }
    return upload(h);
}

MatPlan planFor(int K, int N, int rows) {
    MatPlan p;
    p.RG = std::min(8, rows / 16);
    const int K16 = K / 16, N16 = N / 16;
    const size_t aB = (size_t)8 * 2 * K16 * 256;   // A of 128 rows
    if (K <= 128) {
        p.KB16 = K16; p.NB16 = std::min(N16, 8);
    } else if (K <= 256) {
        p.KB16 = K16; p.NB16 = std::min(N16, 2);
        (void)aB;
    } else {
        p.KB16 = 4; p.NB16 = std::min(N16, 4);
    }
    return p;
}

template<class Fn> void setShm(Fn fn) { CK(cudaFuncSetAttribute(fn, cudaFuncAttributeMaxDynamicSharedMemorySize, (int)SHM_MAX)); }

void runAttention(const Common& c, int seqs) {
    if (c.d == 4) {
        const int warps = 16;
        const int JG = c.S16;
        const size_t shmBytes = (size_t)JG * 4 * 256 + warps * 1024;
        const int IB = (c.S16 + warps - 1) / warps;
        k_attn4<<<seqs * c.D16 * IB, warps * 32, (unsigned)shmBytes>>>(c, JG);
        return;
    }
    const int DQ = c.d / 16;
    const int warps = DQ >= 8 ? 8 : 16;
    const size_t avail = SHM_MAX - (size_t)warps * 256 - 256;
    const int JG = std::min(c.S16, (int)(avail / ((size_t)DQ * 4 * 256)));
    const size_t shmBytes = (size_t)JG * DQ * 4 * 256 + warps * 256;
    const int IB = (c.S16 + warps - 1) / warps;
    const bool split = c.S >= 50000;   // long sequences: one submission per head, waiting in between
    const int step = split ? 1 : c.H;
    for (int h = 0; h < c.H; h += step) {
        const int grid = seqs * step * IB;
        const unsigned th = warps * 32, sh = (unsigned)shmBytes;
        switch (DQ) {
            case 1: k_attn<1><<<grid, th, sh>>>(c, h, step, JG); break;
            case 2: k_attn<2><<<grid, th, sh>>>(c, h, step, JG); break;
            case 4: k_attn<4><<<grid, th, sh>>>(c, h, step, JG); break;
            case 8: k_attn<8><<<grid, th, sh>>>(c, h, step, JG); break;
            case 16: k_attn<16><<<grid, th, sh>>>(c, h, step, JG); break;
            default: exit(1);
        }
        if (split) CK(cudaDeviceSynchronize());
    }
}

}  // namespace

void init(const TransformerSpec& spec, const float* x, float* y) {
    st.s = spec; st.x = x; st.y = y;
    const int D = spec.D, F = spec.F, H = spec.H, S = spec.S, L = spec.L;
    const int d = D / H;
    Common& c = st.c;
    c.S = S; c.D = D; c.H = H; c.F = F; c.d = d;
    c.S16 = S / 16; c.Doct = D / 8; c.D16 = D / 16; c.F16 = F / 16; c.Foct = F / 8;
    const float kappa = (float)(1.0 / (std::sqrt((double)d) * std::log(2.0)));
    const float* w = spec.weights;
    const size_t D2 = (size_t)D * D;
    st.layers.resize(L);
    for (int l = 0; l < L; l++) {
        LayerImg& li = st.layers[l];
        li.ln1 = lnImage(w, w + D, D); w += 2 * D;
        const float* WQ = w, *WK = w + D2, *WV = w + 2 * D2; w += 3 * D2;
        const float* bQ = w, *bK = w + D, *bV = w + 2 * D; w += 3 * D;
        const float* WO = w; w += D2;
        const float* bO = w; w += D;
        li.ln2 = lnImage(w, w + D, D); w += 2 * D;
        const float* W1 = w; w += (size_t)D * F;
        const float* b1 = w; w += F;
        const float* W2 = w; w += (size_t)F * D;
        const float* b2 = w; w += D;
        li.WQ = weightImage(WQ, D, D, kappa); li.WK = weightImage(WK, D, D, 1.f); li.WV = weightImage(WV, D, D, 1.f);
        li.WO = weightImage(WO, D, D, 1.f); li.W1 = weightImage(W1, D, F, 1.f); li.W2 = weightImage(W2, F, D, 1.f);
        li.bQ = biasImage(bQ, D, kappa); li.bK = biasImage(bK, D, 1.f); li.bVr = biasRowImage(bV, D);
        li.bO = biasImage(bO, D, 1.f); li.b1 = biasImage(b1, F, 1.f); li.b2 = biasImage(b2, D, 1.f);
    }
    st.lnEnd = lnImage(w, w + D, D);

    const size_t seqX = (size_t)S * D * 4, seqQ = (size_t)S * D * 2, seqT = (size_t)S * F * 2;
    const size_t perSeq = seqX + 5 * seqQ + seqT;
    const size_t target = (size_t)40 << 20;
    int batch = (int)std::max<size_t>(1, target / perSeq);
    batch = std::min(batch, spec.B);
    st.batch = batch;
    c.seqX = seqX; c.seqQ = seqQ; c.seqT = seqT; c.seqs = batch;
    c.X = gpuAlloc(seqX * batch);
    c.U = gpuAlloc(seqQ * batch); c.Q = gpuAlloc(seqQ * batch); c.K = gpuAlloc(seqQ * batch);
    c.V = gpuAlloc(seqQ * batch); c.O = gpuAlloc(seqQ * batch);
    c.T = gpuAlloc(seqT * batch);

    st.pQ = planFor(D, D, S); st.pO = st.pQ; st.p1 = planFor(D, F, S); st.p2 = planFor(F, D, S);
    st.p1.RG = st.pO.RG;
    st.warpsMM = 16;
    st.ACH = D <= 128 ? D / 16 : (D <= 256 ? 2 : 4);
    st.NBV16 = 4;
    st.loadRG = 8;

    setShm(k_qkv); setShm(k_upd1); setShm(k_upd2); setShm(k_attn<1>); setShm(k_attn<2>); setShm(k_attn<4>);
    setShm(k_attn<8>); setShm(k_attn<16>); setShm(k_attn4); setShm(k_final);
}

#ifdef PROF
#include <chrono>
static double profMs[8]; static int profCount[8];
static std::chrono::steady_clock::time_point profT0;
static void profTick(int k) {
    CK(cudaDeviceSynchronize());
    auto t1 = std::chrono::steady_clock::now();
    profMs[k] += std::chrono::duration<double, std::milli>(t1 - profT0).count();
    profCount[k]++;
    profT0 = std::chrono::steady_clock::now();
}
void profDump() {
    const char* nm[8] = {"load", "qkv", "attn", "upd1", "upd2", "final", "", ""};
    for (int i = 0; i < 6; i++) fprintf(stderr, "  %-6s %9.3f ms  %d launches\n", nm[i], profMs[i], profCount[i]);
    memset(profMs, 0, sizeof(profMs)); memset(profCount, 0, sizeof(profCount));
}
#define TICK(k) profTick(k)
#else
#define TICK(k)
#endif

void forward() {
#ifdef PROF
    profDump();
    profT0 = std::chrono::steady_clock::now();
#endif
    const TransformerSpec& s = st.s;
    Common c = st.c;
    const int warps = st.warpsMM;
    const int IBload = (c.S16 + st.loadRG - 1) / st.loadRG;
    for (int sb = 0; sb < s.B; sb += st.batch) {
        const int seqs = std::min(st.batch, s.B - sb);
        c.seqs = seqs;
        const float* xb = st.x + (size_t)sb * s.S * s.D;
        float* yb = st.y + (size_t)sb * s.S * s.D;
        k_load<<<seqs * IBload, 8 * 32>>>(c, xb, st.loadRG);
        TICK(0);
        for (int l = 0; l < s.L; l++) {
            const LayerImg& li = st.layers[l];
            {
                QkvArgs a{li.ln1, li.WQ, li.WK, li.WV, li.bQ, li.bK, li.bVr, st.pQ, st.ACH, st.NBV16};
                const int RG = st.pQ.RG;
                const int IB = (c.S16 + RG - 1) / RG;
                const size_t sh = (size_t)warps * 512 + (size_t)RG * 2 * st.pQ.KB16 * 256
                    + (size_t)std::max({st.pQ.NB16 * 2, st.ACH * 2}) * st.pQ.KB16 * 256
                    + (st.pQ.KB16 < c.D16 ? (size_t)RG * st.pQ.NB16 * 1024 : 0);
                k_qkv<<<seqs * IB, warps * 32, (unsigned)std::min(sh, SHM_MAX)>>>(c, a);
                TICK(1);
            }
            runAttention(c, seqs);
            TICK(2);
            {
                UpdArgs a{li.ln2, li.WO, li.W1, li.bO, li.b1, st.pO, st.p1};
                const int RG = st.pO.RG;
                const int IB = (c.S16 + RG - 1) / RG;
                const size_t sh1 = (size_t)warps * 512 + (size_t)RG * 2 * st.pO.KB16 * 256
                    + (size_t)st.pO.NB16 * 2 * st.pO.KB16 * 256 + (st.pO.KB16 < c.D16 ? (size_t)RG * st.pO.NB16 * 1024 : 0);
                const size_t sh2 = (size_t)warps * 512 + (size_t)RG * 2 * st.p1.KB16 * 256
                    + (size_t)st.p1.NB16 * 2 * st.p1.KB16 * 256 + (st.p1.KB16 < c.D16 ? (size_t)RG * st.p1.NB16 * 1024 : 0);
                k_upd1<<<seqs * IB, warps * 32, (unsigned)std::min(std::max(sh1, sh2), SHM_MAX)>>>(c, a);
                TICK(3);
            }
            {
                const int RG = st.p2.RG;
                const int IB = (c.S16 + RG - 1) / RG;
                const size_t sh = (size_t)RG * 2 * st.p2.KB16 * 256 + (size_t)st.p2.NB16 * 2 * st.p2.KB16 * 256
                    + (st.p2.KB16 < c.F16 ? (size_t)RG * st.p2.NB16 * 1024 : 0);
                k_upd2<<<seqs * IB, warps * 32, (unsigned)std::min(sh, SHM_MAX)>>>(c, li.W2, li.b2, st.p2);
                TICK(4);
            }
        }
        k_final<<<seqs * IBload, 8 * 32, 8 * 512>>>(c, yb, st.lnEnd, st.loadRG);
        TICK(5);
    }
}
