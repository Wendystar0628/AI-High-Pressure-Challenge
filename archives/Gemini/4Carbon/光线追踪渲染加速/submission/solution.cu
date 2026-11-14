#include "render_math.cuh"
#include <cub/device/device_radix_sort.cuh>
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <cmath>
#include <algorithm>

static void ck(cudaError_t e) {
    if (e != cudaSuccess) {
        fprintf(stderr, "solution cuda error: %s\n", cudaGetErrorString(e));
        std::exit(2);
    }
}

struct __align__(128) BVH4Node {
    float4 lox, hix, loy, hiy, loz, hiz;
    int4   child;
    int4   pad;
};

struct __align__(16) WoopTri {
    float4 m2; // unit plane: nx, ny, nz, d
    float4 m0; // barycentric u row
    float4 m1; // barycentric v row
};

struct __align__(16) ShadeTri {
    float4 n_mir; // nx, ny, nz, mirror
    float4 col;   // r, g, b, 0
};

struct AABB6 {
    float lox, loy, loz, hix, hiy, hiz;
};

static constexpr int EMPTY_CHILD = 0x7fffffff;

static Triangle*           d_raw_tris   = nullptr;
static BVH4Node*           d_bvh4       = nullptr;
static WoopTri*            d_woop_tris  = nullptr;
static ShadeTri*           d_shade_tris = nullptr;

static AABB6*              d_ploc_box   = nullptr;
static float4*             d_cent       = nullptr;
static int*                d_ploc_left  = nullptr;
static int*                d_ploc_right = nullptr;
static int*                d_ploc_par   = nullptr;
static int*                d_ploc_cnt   = nullptr;
static int*                d_ploc_lcnt  = nullptr;
static int*                d_ploc_off   = nullptr;
static uint8_t*            d_collapsed  = nullptr;
static int2*               d_bfs_q0     = nullptr;
static int2*               d_bfs_q1     = nullptr;

static uint64_t*           d_morton0    = nullptr;
static uint64_t*           d_morton1    = nullptr;
static int*                d_idx0       = nullptr;
static int*                d_active0    = nullptr;
static int*                d_active1    = nullptr;
static int*                d_active_mid = nullptr;
static int*                d_nn         = nullptr;
static int*                d_blk_cnts   = nullptr;
static int*                d_pix_order  = nullptr;

static uint32_t*           d_cbounds_u  = nullptr;
static int*                d_scalars    = nullptr;
static unsigned long long* d_sample_ctr = nullptr;
static int*                h_pinned     = nullptr;

static void*               d_cub_temp   = nullptr;
static size_t              g_cub_bytes  = 0;
static int                 g_sm_count   = 76;

__constant__ Scene c_scene;

__device__ __forceinline__ uint32_t float_to_ord(float f) {
    uint32_t u = __float_as_uint(f);
    return (u & 0x80000000u) ? ~u : (u | 0x80000000u);
}

__device__ __forceinline__ float ord_to_float(uint32_t u) {
    u = (u & 0x80000000u) ? (u & 0x7fffffffu) : ~u;
    return __uint_as_float(u);
}

__device__ __forceinline__ float half_area(const AABB6& b) {
    float x = b.hix - b.lox, y = b.hiy - b.loy, z = b.hiz - b.loz;
    return x * y + y * z + z * x;
}

__device__ __forceinline__ AABB6 merge_aabb(const AABB6& a, const AABB6& b) {
    return {
        fminf(a.lox, b.lox), fminf(a.loy, b.loy), fminf(a.loz, b.loz),
        fmaxf(a.hix, b.hix), fmaxf(a.hiy, b.hiy), fmaxf(a.hiz, b.hiz)
    };
}

__device__ __forceinline__ void write_leaf_woop(const Triangle& t, int dst, WoopTri* wt, ShadeTri* sh) {
    double v0x = t.v0[0], v0y = t.v0[1], v0z = t.v0[2];
    double e1x = double(t.v1[0]) - v0x, e1y = double(t.v1[1]) - v0y, e1z = double(t.v1[2]) - v0z;
    double e2x = double(t.v2[0]) - v0x, e2y = double(t.v2[1]) - v0y, e2z = double(t.v2[2]) - v0z;

    double nx = e1y * e2z - e1z * e2y;
    double ny = e1z * e2x - e1x * e2z;
    double nz = e1x * e2y - e1y * e2x;
    double n2 = nx * nx + ny * ny + nz * nz;

    V<float> v0f(t.v0), v1f(t.v1), v2f(t.v2);
    V<float> nf = (v1f - v0f).cross(v2f - v0f).unit();
    sh[dst].n_mir = make_float4(nf.x, nf.y, nf.z, t.mirror);
    sh[dst].col   = make_float4(t.color[0], t.color[1], t.color[2], 0.0f);

    if (n2 < 1e-36) {
        wt[dst].m2 = make_float4(0.0f, 0.0f, 0.0f, 0.0f);
        wt[dst].m0 = make_float4(0.0f, 0.0f, 0.0f, 0.0f);
        wt[dst].m1 = make_float4(0.0f, 0.0f, 0.0f, 0.0f);
        return;
    }

    double inv_len = 1.0 / sqrt(n2);
    double unx = nx * inv_len, uny = ny * inv_len, unz = nz * inv_len;
    double inv_n2 = 1.0 / n2;

    double r0x = (e2y * nz - e2z * ny) * inv_n2;
    double r0y = (e2z * nx - e2x * nz) * inv_n2;
    double r0z = (e2x * ny - e2y * nx) * inv_n2;
    double r0w = -(r0x * v0x + r0y * v0y + r0z * v0z);

    double r1x = (ny * e1z - nz * e1y) * inv_n2;
    double r1y = (nz * e1x - nx * e1z) * inv_n2;
    double r1z = (nx * e1y - ny * e1x) * inv_n2;
    double r1w = -(r1x * v0x + r1y * v0y + r1z * v0z);

    double r2w = -(unx * v0x + uny * v0y + unz * v0z);

    wt[dst].m2 = make_float4(float(unx), float(uny), float(unz), float(r2w));
    wt[dst].m0 = make_float4(float(r0x), float(r0y), float(r0z), float(r0w));
    wt[dst].m1 = make_float4(float(r1x), float(r1y), float(r1z), float(r1w));
}

__global__ void build_tiny_bvh4_kernel(const Triangle* tris, int N, BVH4Node* bvh4, WoopTri* wt, ShadeTri* sh) {
    int i = threadIdx.x;
    const float PAD = 1.5e-5f;
    AABB6 my_box{1e30f, 1e30f, 1e30f, -1e30f, -1e30f, -1e30f};
    if (i < N) {
        const Triangle& t = tris[i];
        write_leaf_woop(t, i, wt, sh);
        my_box.lox = fminf(t.v0[0], fminf(t.v1[0], t.v2[0])) - PAD;
        my_box.loy = fminf(t.v0[1], fminf(t.v1[1], t.v2[1])) - PAD;
        my_box.loz = fminf(t.v0[2], fminf(t.v1[2], t.v2[2])) - PAD;
        my_box.hix = fmaxf(t.v0[0], fmaxf(t.v1[0], t.v2[0])) + PAD;
        my_box.hiy = fmaxf(t.v0[1], fmaxf(t.v1[1], t.v2[1])) + PAD;
        my_box.hiz = fmaxf(t.v0[2], fmaxf(t.v1[2], t.v2[2])) + PAD;
    }
    for (int off = 16; off > 0; off >>= 1) {
        AABB6 o{
            __shfl_down_sync(0xffffffffu, my_box.lox, off),
            __shfl_down_sync(0xffffffffu, my_box.loy, off),
            __shfl_down_sync(0xffffffffu, my_box.loz, off),
            __shfl_down_sync(0xffffffffu, my_box.hix, off),
            __shfl_down_sync(0xffffffffu, my_box.hiy, off),
            __shfl_down_sync(0xffffffffu, my_box.hiz, off)
        };
        my_box = merge_aabb(my_box, o);
    }
    if (i == 0) {
        BVH4Node r{};
        r.lox = make_float4(my_box.lox, 1e30f, 1e30f, 1e30f);
        r.hix = make_float4(my_box.hix, -1e30f, -1e30f, -1e30f);
        r.loy = make_float4(my_box.loy, 1e30f, 1e30f, 1e30f);
        r.hiy = make_float4(my_box.hiy, -1e30f, -1e30f, -1e30f);
        r.loz = make_float4(my_box.loz, 1e30f, 1e30f, 1e30f);
        r.hiz = make_float4(my_box.hiz, -1e30f, -1e30f, -1e30f);
        int leaf_code = ~int(uint32_t(0) | (uint32_t(N - 1) << 24));
        r.child = make_int4(leaf_code, EMPTY_CHILD, EMPTY_CHILD, EMPTY_CHILD);
        bvh4[0] = r;
    }
}

__global__ void reset_ploc_scalars(uint32_t* cbounds_u, int* scalars, unsigned long long* sample_ctr, int N) {
    if (threadIdx.x < 3) {
        cbounds_u[threadIdx.x]     = 0xffffffffu;
        cbounds_u[threadIdx.x + 3] = 0x00000000u;
    }
    if (threadIdx.x == 0) {
        scalars[0] = N; // next internal binary node id
        scalars[1] = 0; // root binary node id
        scalars[2] = 0; // active M
        scalars[3] = 1; // next BVH4 node id (0 is root)
        scalars[4] = 0; // BFS next frontier count
        *sample_ctr = 0ULL;
    }
}

__global__ void init_ploc_leaves_kernel(
    const Triangle* __restrict__ tris, int N,
    AABB6* __restrict__ boxes, float4* __restrict__ cents,
    int* __restrict__ par, int* __restrict__ cnt, int* __restrict__ lcnt, int* __restrict__ idx0,
    uint32_t* __restrict__ cbounds_u)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    float cx = 1e30f, cy = 1e30f, cz = 1e30f;
    float mx = -1e30f, my = -1e30f, mz = -1e30f;
    const float PAD = 1.5e-5f;
    if (i < N) {
        const Triangle& t = tris[i];
        AABB6 b{
            fminf(t.v0[0], fminf(t.v1[0], t.v2[0])) - PAD,
            fminf(t.v0[1], fminf(t.v1[1], t.v2[1])) - PAD,
            fminf(t.v0[2], fminf(t.v1[2], t.v2[2])) - PAD,
            fmaxf(t.v0[0], fmaxf(t.v1[0], t.v2[0])) + PAD,
            fmaxf(t.v0[1], fmaxf(t.v1[1], t.v2[1])) + PAD,
            fmaxf(t.v0[2], fmaxf(t.v1[2], t.v2[2])) + PAD
        };
        boxes[i] = b;
        cx = 0.5f * (b.lox + b.hix); cy = 0.5f * (b.loy + b.hiy); cz = 0.5f * (b.loz + b.hiz);
        mx = cx; my = cy; mz = cz;
        cents[i] = make_float4(cx, cy, cz, 0.0f);
        par[i] = -1; cnt[i] = 1; lcnt[i] = 0; idx0[i] = i;
    }
    for (int off = 16; off > 0; off >>= 1) {
        cx = fminf(cx, __shfl_down_sync(0xffffffffu, cx, off));
        cy = fminf(cy, __shfl_down_sync(0xffffffffu, cy, off));
        cz = fminf(cz, __shfl_down_sync(0xffffffffu, cz, off));
        mx = fmaxf(mx, __shfl_down_sync(0xffffffffu, mx, off));
        my = fmaxf(my, __shfl_down_sync(0xffffffffu, my, off));
        mz = fmaxf(mz, __shfl_down_sync(0xffffffffu, mz, off));
    }
    if ((threadIdx.x & 31) == 0 && (blockIdx.x * blockDim.x + (threadIdx.x & ~31)) < N) {
        atomicMin(&cbounds_u[0], float_to_ord(cx));
        atomicMin(&cbounds_u[1], float_to_ord(cy));
        atomicMin(&cbounds_u[2], float_to_ord(cz));
        atomicMax(&cbounds_u[3], float_to_ord(mx));
        atomicMax(&cbounds_u[4], float_to_ord(my));
        atomicMax(&cbounds_u[5], float_to_ord(mz));
    }
}

__device__ __forceinline__ uint64_t expand_bits_20(uint32_t v) {
    uint64_t x = v & 0xFFFFFu;
    x = (x | (x << 32)) & 0x001f00000000ffffULL;
    x = (x | (x << 16)) & 0x001f0000ff0000ffULL;
    x = (x | (x << 8))  & 0x100f00f00f00f00fULL;
    x = (x | (x << 4))  & 0x10c30c30c30c30c3ULL;
    x = (x | (x << 2))  & 0x1249249249249249ULL;
    return x;
}

__global__ void calc_morton64_kernel(const float4* __restrict__ cents, int N, const uint32_t* __restrict__ cbounds_u, uint64_t* __restrict__ morton) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= N) return;
    float lox = ord_to_float(cbounds_u[0]), loy = ord_to_float(cbounds_u[1]), loz = ord_to_float(cbounds_u[2]);
    float hix = ord_to_float(cbounds_u[3]), hiy = ord_to_float(cbounds_u[4]), hiz = ord_to_float(cbounds_u[5]);
    float max_ext = fmaxf(hix - lox, fmaxf(hiy - loy, hiz - loz));
    float s = max_ext > 1e-12f ? (1048575.0f / max_ext) : 0.0f;
    float4 c = cents[i];
    uint32_t qx = uint32_t(fminf(fmaxf((c.x - lox) * s, 0.0f), 1048575.0f));
    uint32_t qy = uint32_t(fminf(fmaxf((c.y - loy) * s, 0.0f), 1048575.0f));
    uint32_t qz = uint32_t(fminf(fmaxf((c.z - loz) * s, 0.0f), 1048575.0f));
    morton[i] = (expand_bits_20(qx) << 2) | (expand_bits_20(qy) << 1) | expand_bits_20(qz);
}

static constexpr int PLOC_R = 16;
static constexpr int PLOC_B = 256;

__global__ void ploc_find_nn_kernel(const int* __restrict__ active, int M, const AABB6* __restrict__ boxes, int* __restrict__ nn) {
    __shared__ AABB6 s_box[PLOC_B + 2 * PLOC_R];
    int base = blockIdx.x * PLOC_B - PLOC_R;
    for (int t = threadIdx.x; t < PLOC_B + 2 * PLOC_R; t += PLOC_B) {
        int g = base + t;
        if (g >= 0 && g < M) s_box[t] = boxes[active[g]];
    }
    __syncthreads();
    int i = blockIdx.x * PLOC_B + threadIdx.x;
    if (i >= M) return;
    int loc = threadIdx.x + PLOC_R;
    AABB6 bi = s_box[loc];
    int j_lo = max(0, i - PLOC_R), j_hi = min(M - 1, i + PLOC_R);
    float best_a = 1e38f; int best_j = i;
    for (int j = j_lo; j <= j_hi; ++j) {
        if (j == i) continue;
        AABB6 bj = s_box[loc + (j - i)];
        float ux = fmaxf(bi.hix, bj.hix) - fminf(bi.lox, bj.lox);
        float uy = fmaxf(bi.hiy, bj.hiy) - fminf(bi.loy, bj.loy);
        float uz = fmaxf(bi.hiz, bj.hiz) - fminf(bi.loz, bj.loz);
        float a = ux * uy + uy * uz + uz * ux;
        if (a < best_a) { best_a = a; best_j = j; }
    }
    nn[i] = best_j;
}

__global__ void ploc_merge_count_kernel(
    const int* __restrict__ active_in, int* __restrict__ active_mid, int M, const int* __restrict__ nn,
    AABB6* __restrict__ boxes, int* __restrict__ left_arr, int* __restrict__ right_arr,
    int* __restrict__ par_arr, int* __restrict__ cnt_arr, int* __restrict__ lcnt_arr,
    int* __restrict__ scalars, int* __restrict__ blk_cnts)
{
    __shared__ int s_wcnt[8];
    int tid = threadIdx.x, i = blockIdx.x * 256 + tid;
    bool valid = false;
    if (i < M) {
        int j = nn[i];
        if (j != i && nn[j] == i) {
            if (i < j) {
                int l = active_in[i], r = active_in[j];
                int p = atomicAdd(&scalars[0], 1);
                boxes[p] = merge_aabb(boxes[l], boxes[r]);
                left_arr[p] = l; right_arr[p] = r; par_arr[p] = -1;
                int cl = cnt_arr[l], cr = cnt_arr[r];
                cnt_arr[p] = cl + cr; lcnt_arr[p] = 0;
                par_arr[l] = p; lcnt_arr[l] = 0;
                par_arr[r] = p; lcnt_arr[r] = cl;
                active_mid[i] = p;
                valid = true;
            } else {
                active_mid[i] = -1;
                valid = false;
            }
        } else {
            active_mid[i] = active_in[i];
            valid = true;
        }
    }
    uint32_t mask = __ballot_sync(0xffffffffu, valid);
    int lane = tid & 31, warp = tid >> 5;
    if (lane == 0) s_wcnt[warp] = __popc(mask);
    __syncthreads();
    if (tid == 0) {
        int sum = 0;
        for (int w = 0; w < 8; ++w) sum += s_wcnt[w];
        blk_cnts[blockIdx.x] = sum;
    }
}

__global__ void scan_blocks_kernel(int* __restrict__ blk_cnts, int nblocks, int* __restrict__ scalars) {
    __shared__ int s_w[32];
    int tid = threadIdx.x, lane = tid & 31, warp = tid >> 5, running = 0;
    for (int base = 0; base < nblocks; base += 1024) {
        int idx = base + tid;
        int val = (idx < nblocks) ? blk_cnts[idx] : 0;
        int inc = val;
        for (int off = 1; off < 32; off <<= 1) {
            int o = __shfl_up_sync(0xffffffffu, inc, off);
            if (lane >= off) inc += o;
        }
        if (lane == 31) s_w[warp] = inc;
        __syncthreads();
        if (warp == 0) {
            int wv = s_w[lane];
            for (int off = 1; off < 32; off <<= 1) {
                int o = __shfl_up_sync(0xffffffffu, wv, off);
                if (lane >= off) wv += o;
            }
            s_w[lane] = wv;
        }
        __syncthreads();
        int exc = running + ((warp > 0) ? s_w[warp - 1] : 0) + inc - val;
        if (idx < nblocks) blk_cnts[idx] = exc;
        running += s_w[31];
        __syncthreads();
    }
    if (tid == 0) scalars[2] = running;
}

__global__ void ploc_scatter_kernel(const int* __restrict__ active_in, int M, const int* __restrict__ blk_offs, int* __restrict__ active_out) {
    __shared__ int s_w[8];
    int tid = threadIdx.x, i = blockIdx.x * 256 + tid;
    int v = (i < M) ? active_in[i] : -1;
    bool valid = (v >= 0);
    uint32_t mask = __ballot_sync(0xffffffffu, valid);
    int lane = tid & 31, warp = tid >> 5;
    int wp = __popc(mask & ((1u << lane) - 1u));
    if (lane == 31) s_w[warp] = wp + (valid ? 1 : 0);
    __syncthreads();
    if (warp == 0 && lane < 8) {
        int x = s_w[lane];
        for (int off = 1; off < 8; off <<= 1) {
            int o = __shfl_up_sync(0xffu, x, off);
            if (lane >= off) x += o;
        }
        s_w[lane] = x;
    }
    __syncthreads();
    if (valid) {
        active_out[blk_offs[blockIdx.x] + ((warp > 0) ? s_w[warp - 1] : 0) + wp] = v;
    }
}

__global__ void ploc_finish_smem_kernel(
    const int* __restrict__ active_in, int M_in, AABB6* __restrict__ boxes,
    int* __restrict__ left_arr, int* __restrict__ right_arr,
    int* __restrict__ par_arr, int* __restrict__ cnt_arr, int* __restrict__ lcnt_arr,
    int* __restrict__ scalars, int2* __restrict__ bfs_q0)
{
    __shared__ int   s_act[512];
    __shared__ AABB6 s_box[512];
    __shared__ int   s_nn[512];
    __shared__ int   s_scan[16];
    __shared__ int   s_M, s_node_cur;
    int tid = threadIdx.x;
    if (tid == 0) { s_M = M_in; s_node_cur = scalars[0]; }
    if (tid < M_in) { int c = active_in[tid]; s_act[tid] = c; s_box[tid] = boxes[c]; }
    __syncthreads();
    while (s_M > 1) {
        int M = s_M;
        if (tid < M) {
            AABB6 bi = s_box[tid];
            int j_lo = max(0, tid - PLOC_R), j_hi = min(M - 1, tid + PLOC_R);
            float best_a = 1e38f; int best_j = tid;
            for (int j = j_lo; j <= j_hi; ++j) {
                if (j == tid) continue;
                AABB6 bj = s_box[j];
                float ux = fmaxf(bi.hix, bj.hix) - fminf(bi.lox, bj.lox);
                float uy = fmaxf(bi.hiy, bj.hiy) - fminf(bi.loy, bj.loy);
                float uz = fmaxf(bi.hiz, bj.hiz) - fminf(bi.loz, bj.loz);
                float a = ux * uy + uy * uz + uz * ux;
                if (a < best_a) { best_a = a; best_j = j; }
            }
            s_nn[tid] = best_j;
        }
        __syncthreads();
        if (tid < M) {
            int j = s_nn[tid];
            if (j > tid && s_nn[j] == tid) {
                int l = s_act[tid], r = s_act[j];
                int p = atomicAdd(&s_node_cur, 1);
                AABB6 pb = merge_aabb(s_box[tid], s_box[j]);
                boxes[p] = pb; left_arr[p] = l; right_arr[p] = r; par_arr[p] = -1;
                int cl = cnt_arr[l], cr = cnt_arr[r];
                cnt_arr[p] = cl + cr; lcnt_arr[p] = 0;
                par_arr[l] = p; lcnt_arr[l] = 0; par_arr[r] = p; lcnt_arr[r] = cl;
                s_act[tid] = p; s_box[tid] = pb; s_act[j] = -1;
            }
        }
        __syncthreads();
        int valid = (tid < M && s_act[tid] >= 0) ? 1 : 0;
        int my_act = valid ? s_act[tid] : -1;
        AABB6 my_box; if (valid) my_box = s_box[tid];
        int lane = tid & 31, warp = tid >> 5;
        uint32_t mask = __ballot_sync(0xffffffffu, valid);
        int wp = __popc(mask & ((1u << lane) - 1u));
        if (lane == 31) s_scan[warp] = wp + valid;
        __syncthreads();
        if (warp == 0) {
            int v = (lane < 16) ? s_scan[lane] : 0;
            for (int off = 1; off < 16; off <<= 1) {
                int o = __shfl_up_sync(0xffffffffu, v, off);
                if (lane >= off) v += o;
            }
            if (lane < 16) s_scan[lane] = v;
        }
        __syncthreads();
        if (valid) {
            int dst = ((warp > 0) ? s_scan[warp - 1] : 0) + wp;
            s_act[dst] = my_act; s_box[dst] = my_box;
        }
        if (tid == 0) s_M = s_scan[15];
        __syncthreads();
    }
    if (tid == 0) {
        scalars[0] = s_node_cur;
        scalars[1] = s_act[0];
        bfs_q0[0]  = make_int2(0, s_act[0]);
    }
}

__global__ void ploc_offsets_and_woop_kernel(
    int N, const Triangle* __restrict__ raw_tris, const int* __restrict__ par_arr, const int* __restrict__ lcnt_arr,
    int* __restrict__ off_arr, uint8_t* __restrict__ collapsed, WoopTri* __restrict__ wt, ShadeTri* __restrict__ sh)
{
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    if (x >= 2 * N - 1) return;
    int off = 0, cur = x;
    while (cur >= 0) { off += lcnt_arr[cur]; cur = par_arr[cur]; }
    off_arr[x] = off;
    collapsed[x] = 0;
    if (x < N) write_leaf_woop(raw_tris[x], off, wt, sh);
}

static constexpr int MAX_COLLAPSE = 8;

__device__ float eval_collapse(int x, int N, int root_id, const AABB6* boxes, const int* l_arr, const int* r_arr, const int* cnt_arr, uint8_t* col) {
    if (x < N) return half_area(boxes[x]);
    float cl = eval_collapse(l_arr[x], N, root_id, boxes, l_arr, r_arr, cnt_arr, col);
    float cr = eval_collapse(r_arr[x], N, root_id, boxes, l_arr, r_arr, cnt_arr, col);
    float ap = half_area(boxes[x]); int cnt = cnt_arr[x];
    float lc = ap * float(cnt), sc = ap * 0.75f + cl + cr;
    if (x != root_id && (cnt <= 3 || lc <= sc)) { col[x] = 1; return lc; }
    return sc;
}

__device__ void mark_dead(int x, int N, const int* l_arr, const int* r_arr, uint8_t* col, bool kill) {
    if (x < N) return;
    bool nk = kill || (col[x] == 1);
    if (kill) col[x] = 2;
    mark_dead(l_arr[x], N, l_arr, r_arr, col, nk);
    mark_dead(r_arr[x], N, l_arr, r_arr, col, nk);
}

__global__ void ploc_sah_collapse_kernel(int N, const int* scalars, const AABB6* boxes, const int* l_arr, const int* r_arr, const int* par_arr, const int* cnt_arr, uint8_t* col) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= N - 1) return;
    int x = N + idx, c = cnt_arr[x];
    if (c <= MAX_COLLAPSE) {
        int p = par_arr[x];
        if (p < 0 || cnt_arr[p] > MAX_COLLAPSE) {
            eval_collapse(x, N, scalars[1], boxes, l_arr, r_arr, cnt_arr, col);
            mark_dead(x, N, l_arr, r_arr, col, false);
        }
    }
}

__global__ void bvh4_bfs_level_kernel(
    const int2* __restrict__ q_in, int q_len,
    int2* __restrict__ q_out, int* __restrict__ next_q_len,
    int* __restrict__ bvh4_alloc,
    int N, const AABB6* __restrict__ boxes,
    const int* __restrict__ l_arr, const int* __restrict__ r_arr,
    const int* __restrict__ off_arr, const int* __restrict__ cnt_arr,
    const uint8_t* __restrict__ col,
    BVH4Node* __restrict__ bvh4)
{
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= q_len) return;

    int2 job = q_in[idx];
    int out_id = job.x, bin_root = job.y;

    int ch_bin[4];
    ch_bin[0] = l_arr[bin_root];
    ch_bin[1] = r_arr[bin_root];
    int n_ch = 2;

    while (n_ch < 4) {
        int best_k = -1; float best_area = -1.0f;
        for (int k = 0; k < n_ch; ++k) {
            int c = ch_bin[k];
            if (c >= N && col[c] == 0) {
                float a = half_area(boxes[c]);
                if (a > best_area) { best_area = a; best_k = k; }
            }
        }
        if (best_k < 0) break;
        int exp_node = ch_bin[best_k];
        ch_bin[best_k] = l_arr[exp_node];
        ch_bin[n_ch++] = r_arr[exp_node];
    }

    int n_int = 0;
    for (int k = 0; k < n_ch; ++k) {
        if (ch_bin[k] >= N && col[ch_bin[k]] == 0) ++n_int;
    }
    int base_bvh4 = 0, base_q = 0;
    if (n_int > 0) {
        base_bvh4 = atomicAdd(bvh4_alloc, n_int);
        base_q    = atomicAdd(next_q_len, n_int);
    }

    int ch_enc[4] = {EMPTY_CHILD, EMPTY_CHILD, EMPTY_CHILD, EMPTY_CHILD};
    AABB6 cb[4];
    for (int k = 0; k < 4; ++k) cb[k] = {1e30f, 1e30f, 1e30f, -1e30f, -1e30f, -1e30f};

    int cur_int = 0;
    for (int k = 0; k < n_ch; ++k) {
        int c = ch_bin[k];
        cb[k] = boxes[c];
        if (c < N || col[c] == 1) {
            ch_enc[k] = ~int(uint32_t(off_arr[c]) | (uint32_t(cnt_arr[c] - 1) << 24));
        } else {
            int cid = base_bvh4 + cur_int;
            ch_enc[k] = cid;
            q_out[base_q + cur_int] = make_int2(cid, c);
            ++cur_int;
        }
    }

    BVH4Node node{};
    node.lox   = make_float4(cb[0].lox, cb[1].lox, cb[2].lox, cb[3].lox);
    node.hix   = make_float4(cb[0].hix, cb[1].hix, cb[2].hix, cb[3].hix);
    node.loy   = make_float4(cb[0].loy, cb[1].loy, cb[2].loy, cb[3].loy);
    node.hiy   = make_float4(cb[0].hiy, cb[1].hiy, cb[2].hiy, cb[3].hiy);
    node.loz   = make_float4(cb[0].loz, cb[1].loz, cb[2].loz, cb[3].loz);
    node.hiz   = make_float4(cb[0].hiz, cb[1].hiz, cb[2].hiz, cb[3].hiz);
    node.child = make_int4(ch_enc[0], ch_enc[1], ch_enc[2], ch_enc[3]);
    bvh4[out_id] = node;
}

__global__ void build_pixel_order_kernel(int width, int height, int tx8, int* __restrict__ pix_order) {
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    int ty8 = (height + 7) / 8;
    int total_slots = tx8 * ty8 * 64;
    if (tid >= total_slots) return;

    int tile  = tid >> 6;
    int p_ord = tid & 63;
    int t_x   = tile % tx8;
    int t_y   = tile / tx8;
    int rx    = ((p_ord & 1)) | ((p_ord & 4) >> 1) | ((p_ord & 16) >> 2);
    int ry    = ((p_ord & 2) >> 1) | ((p_ord & 8) >> 2) | ((p_ord & 32) >> 3);
    int px    = t_x * 8 + rx;
    int py    = t_y * 8 + ry;
    if (px >= width || py >= height) return;

    int row_h  = min(8, height - t_y * 8);
    int tile_w = min(8, width - t_x * 8);
    int base   = t_y * 8 * width + t_x * 8 * row_h;
    int local_rank = (tile_w == 8 && row_h == 8) ? p_ord : (ry * tile_w + rx);
    pix_order[base + local_rank] = py * width + px;
}

__device__ __forceinline__ float safe_rcp(float d) {
    const float eps = 1e-30f;
    if (fabsf(d) < eps) d = (d < 0.0f) ? -eps : eps;
    return 1.0f / d;
}

__device__ __forceinline__ bool intersect_woop(const WoopTri& wt, const Ray<float>& r, float limit, float& dist) {
    float4 m2 = __ldg(&wt.m2);
    float dz = __fmaf_rn(r.d.x, m2.x, __fmaf_rn(r.d.y, m2.y, r.d.z * m2.z));
    if (fabsf(dz) < 1e-12f) return false;
    float oz = __fmaf_rn(r.o.x, m2.x, __fmaf_rn(r.o.y, m2.y, __fmaf_rn(r.o.z, m2.z, m2.w)));
    float t = -oz / dz;
    if (t <= 0.0002f || t >= limit) return false;

    float4 m0 = __ldg(&wt.m0);
    float ox = __fmaf_rn(r.o.x, m0.x, __fmaf_rn(r.o.y, m0.y, __fmaf_rn(r.o.z, m0.z, m0.w)));
    float dx = __fmaf_rn(r.d.x, m0.x, __fmaf_rn(r.d.y, m0.y, r.d.z * m0.z));
    float u = __fmaf_rn(t, dx, ox);
    if (u < 0.0f || u > 1.0f) return false;

    float4 m1 = __ldg(&wt.m1);
    float oy = __fmaf_rn(r.o.x, m1.x, __fmaf_rn(r.o.y, m1.y, __fmaf_rn(r.o.z, m1.z, m1.w)));
    float dy = __fmaf_rn(r.d.x, m1.x, __fmaf_rn(r.d.y, m1.y, r.d.z * m1.z));
    float v = __fmaf_rn(t, dy, oy);
    if (v < 0.0f || u + v > 1.0f) return false;

    dist = t;
    return true;
}

#define SWAP_IF(ta, ca, tb, cb) \
    do { if ((tb) < (ta)) { float _ft = (ta); (ta) = (tb); (tb) = _ft; int _ic = (ca); (ca) = (cb); (cb) = _ic; } } while(0)

__device__ __noinline__ Hit<float> traverse_bvh4_closest(
    const BVH4Node* __restrict__ bvh4,
    const WoopTri* __restrict__ tris,
    const Ray<float>& r)
{
    float hit_t  = 1e20f;
    int   hit_id = -1;
    float idx = safe_rcp(r.d.x), idy = safe_rcp(r.d.y), idz = safe_rcp(r.d.z);
    float oodx = -r.o.x * idx, oody = -r.o.y * idy, oodz = -r.o.z * idz;

    int stack[64];
    int sp   = 0;
    int node = 0;

    while (true) {
        while (node >= 0) {
            const BVH4Node& n = bvh4[node];
            float4 lox = __ldg(&n.lox), hix = __ldg(&n.hix);
            float4 loy = __ldg(&n.loy), hiy = __ldg(&n.hiy);
            float4 loz = __ldg(&n.loz), hiz = __ldg(&n.hiz);
            int4   ch  = __ldg(&n.child);

            #define TC(C, SUB) \
                float x0_##C = __fmaf_rn(lox.SUB, idx, oodx), x1_##C = __fmaf_rn(hix.SUB, idx, oodx); \
                float y0_##C = __fmaf_rn(loy.SUB, idy, oody), y1_##C = __fmaf_rn(hiy.SUB, idy, oody); \
                float z0_##C = __fmaf_rn(loz.SUB, idz, oodz), z1_##C = __fmaf_rn(hiz.SUB, idz, oodz); \
                float tmin_##C = fmaxf(fmaxf(fminf(x0_##C, x1_##C), fminf(y0_##C, y1_##C)), fmaxf(fminf(z0_##C, z1_##C), 0.0002f)); \
                float tmax_##C = fminf(fminf(fmaxf(x0_##C, x1_##C), fmaxf(y0_##C, y1_##C)), fminf(fmaxf(z0_##C, z1_##C), hit_t)); \
                bool hit_##C = (ch.SUB != EMPTY_CHILD) && (tmin_##C <= tmax_##C);

            TC(0, x) TC(1, y) TC(2, z) TC(3, w)
            #undef TC

            if (!(hit_0 | hit_1 | hit_2 | hit_3)) {
                if (sp == 0) return {hit_t, hit_id};
                node = stack[--sp];
                continue;
            }

            float t0 = hit_0 ? tmin_0 : 1e30f; int c0 = hit_0 ? ch.x : EMPTY_CHILD;
            float t1 = hit_1 ? tmin_1 : 1e30f; int c1 = hit_1 ? ch.y : EMPTY_CHILD;
            float t2 = hit_2 ? tmin_2 : 1e30f; int c2 = hit_2 ? ch.z : EMPTY_CHILD;
            float t3 = hit_3 ? tmin_3 : 1e30f; int c3 = hit_3 ? ch.w : EMPTY_CHILD;

            SWAP_IF(t0, c0, t1, c1);
            SWAP_IF(t2, c2, t3, c3);
            SWAP_IF(t0, c0, t2, c2);
            SWAP_IF(t1, c1, t3, c3);
            SWAP_IF(t1, c1, t2, c2);

            if (c3 != EMPTY_CHILD && sp < 64) stack[sp++] = c3;
            if (c2 != EMPTY_CHILD && sp < 64) stack[sp++] = c2;
            if (c1 != EMPTY_CHILD && sp < 64) stack[sp++] = c1;
            node = c0;
        }

        uint32_t code = uint32_t(~node);
        int start = int(code & 0x00FFFFFFu);
        int count = int(code >> 24) + 1;
        for (int i = 0; i < count; ++i) {
            float d;
            if (intersect_woop(tris[start + i], r, hit_t, d)) {
                hit_t  = d;
                hit_id = start + i;
            }
        }
        if (sp == 0) return {hit_t, hit_id};
        node = stack[--sp];
    }
}

__device__ __noinline__ bool traverse_bvh4_blocked(
    const BVH4Node* __restrict__ bvh4,
    const WoopTri* __restrict__ tris,
    const Ray<float>& r,
    float idx, float idy, float idz,
    float limit,
    int& cached_tri)
{
    float tmp_d;
    if (cached_tri >= 0 && intersect_woop(tris[cached_tri], r, limit, tmp_d)) {
        return true;
    }

    float oodx = -r.o.x * idx, oody = -r.o.y * idy, oodz = -r.o.z * idz;
    int stack[64];
    int sp   = 0;
    int node = 0;

    while (true) {
        while (node >= 0) {
            const BVH4Node& n = bvh4[node];
            float4 lox = __ldg(&n.lox), hix = __ldg(&n.hix);
            float4 loy = __ldg(&n.loy), hiy = __ldg(&n.hiy);
            float4 loz = __ldg(&n.loz), hiz = __ldg(&n.hiz);
            int4   ch  = __ldg(&n.child);

            #define TA(C, SUB) \
                float x0_##C = __fmaf_rn(lox.SUB, idx, oodx), x1_##C = __fmaf_rn(hix.SUB, idx, oodx); \
                float y0_##C = __fmaf_rn(loy.SUB, idy, oody), y1_##C = __fmaf_rn(hiy.SUB, idy, oody); \
                float z0_##C = __fmaf_rn(loz.SUB, idz, oodz), z1_##C = __fmaf_rn(hiz.SUB, idz, oodz); \
                float tmin_##C = fmaxf(fmaxf(fminf(x0_##C, x1_##C), fminf(y0_##C, y1_##C)), fmaxf(fminf(z0_##C, z1_##C), 0.0002f)); \
                float tmax_##C = fminf(fminf(fmaxf(x0_##C, x1_##C), fmaxf(y0_##C, y1_##C)), fminf(fmaxf(z0_##C, z1_##C), limit)); \
                bool hit_##C = (ch.SUB != EMPTY_CHILD) && (tmin_##C <= tmax_##C);

            TA(0, x) TA(1, y) TA(2, z) TA(3, w)
            #undef TA

            if (!(hit_0 | hit_1 | hit_2 | hit_3)) {
                if (sp == 0) return false;
                node = stack[--sp];
                continue;
            }

            float t0 = hit_0 ? (ch.x < 0 ? -1.0f : tmin_0) : 1e30f; int c0 = hit_0 ? ch.x : EMPTY_CHILD;
            float t1 = hit_1 ? (ch.y < 0 ? -1.0f : tmin_1) : 1e30f; int c1 = hit_1 ? ch.y : EMPTY_CHILD;
            float t2 = hit_2 ? (ch.z < 0 ? -1.0f : tmin_2) : 1e30f; int c2 = hit_2 ? ch.z : EMPTY_CHILD;
            float t3 = hit_3 ? (ch.w < 0 ? -1.0f : tmin_3) : 1e30f; int c3 = hit_3 ? ch.w : EMPTY_CHILD;

            SWAP_IF(t0, c0, t1, c1);
            SWAP_IF(t2, c2, t3, c3);
            SWAP_IF(t0, c0, t2, c2);
            SWAP_IF(t1, c1, t3, c3);
            SWAP_IF(t1, c1, t2, c2);

            if (c3 != EMPTY_CHILD && sp < 64) stack[sp++] = c3;
            if (c2 != EMPTY_CHILD && sp < 64) stack[sp++] = c2;
            if (c1 != EMPTY_CHILD && sp < 64) stack[sp++] = c1;
            node = c0;
        }

        uint32_t code = uint32_t(~node);
        int start = int(code & 0x00FFFFFFu);
        int count = int(code >> 24) + 1;
        for (int i = 0; i < count; ++i) {
            int tri_id = start + i;
            if (tri_id != cached_tri && intersect_woop(tris[tri_id], r, limit, tmp_d)) {
                cached_tri = tri_id;
                return true;
            }
        }
        if (sp == 0) return false;
        node = stack[--sp];
    }
}

__global__ __launch_bounds__(128, 6)
void render_bvh4_continuous_kernel(
    V<float> light_dir, float l_idx, float l_idy, float l_idz, float inv_spp,
    unsigned long long total_samples,
    const int* __restrict__ pix_order,
    const BVH4Node* __restrict__ bvh4,
    const WoopTri* __restrict__ woop_tris,
    const ShadeTri* __restrict__ shade_tris,
    unsigned long long* __restrict__ sample_ctr,
    float* __restrict__ out_rgb)
{
    int lane = threadIdx.x & 31;
    int last_shad_tri = -1;
    int last_ao_tri   = -1;
    unsigned int spp_u = static_cast<unsigned int>(c_scene.spp);

    while (true) {
        unsigned long long base_s;
        if (lane == 0) base_s = atomicAdd(sample_ctr, 32ULL);
        base_s = __shfl_sync(0xffffffffu, base_s, 0);
        if (base_s >= total_samples) break;

        unsigned long long s_idx = base_s + static_cast<unsigned long long>(lane);
        bool valid = (s_idx < total_samples);
        int pixel = -1;
        V<float> result(0.0f, 0.0f, 0.0f);

        if (valid) {
            int p_ord = static_cast<int>(s_idx / spp_u);
            int sid   = static_cast<int>(s_idx - static_cast<unsigned long long>(p_ord) * spp_u);
            pixel     = __ldg(&pix_order[p_ord]);

            Ray<float> r = camera<float>(c_scene, pixel, sid);
            float through = 1.0f;

            for (int depth = 0; depth < c_scene.max_depth; ++depth) {
                Hit<float> hit = traverse_bvh4_closest(bvh4, woop_tris, r);
                if (hit.id < 0) {
                    result = result + sky<float>(r.d) * through;
                    break;
                }
                float4 nm = __ldg(&shade_tris[hit.id].n_mir);
                float4 tc = __ldg(&shade_tris[hit.id].col);
                V<float> n(nm.x, nm.y, nm.z);
                float mirror = nm.w;
                if (n.dot(r.d) > 0.0f) n = n * -1.0f;

                V<float> p = r.o + r.d * hit.t + n * 0.001f;
                float cosine = n.dot(light_dir);
                if (cosine < 0.0f) cosine = 0.0f;
                float visible = 0.0f;
                if (cosine > 0.0f) {
                    uint32_t m_sh = __ballot_sync(__activemask(), last_shad_tri >= 0);
                    if (last_shad_tri < 0 && m_sh != 0u) {
                        last_shad_tri = __shfl_sync(__activemask(), last_shad_tri, __ffs(m_sh) - 1);
                    }
                    Ray<float> sr{p, light_dir};
                    if (!traverse_bvh4_blocked(bvh4, woop_tris, sr, l_idx, l_idy, l_idz, 1e20f, last_shad_tri)) {
                        visible = 1.0f;
                    }
                }

                int open = 0;
                if (c_scene.ao > 0) {
                    V<float> axis = fabsf(n.z) < 0.8f ? V<float>(0.0f, 0.0f, 1.0f) : V<float>(0.0f, 1.0f, 0.0f);
                    V<float> tan_x = axis.cross(n).unit();
                    V<float> tan_y = n.cross(tan_x);
                    uint32_t base_key = c_scene.seed + uint32_t(pixel) * 0x9e3779b9u + uint32_t(sid) * 0x85ebca6bu + uint32_t(depth) * 0xc2b2ae35u;
                    for (int a = 0; a < c_scene.ao; ++a) {
                        uint32_t key = base_key + uint32_t(a) * 0x27d4eb2du;
                        float ax = 2.0f * sample<float>(key ^ 0x68bc21ebu) - 1.0f;
                        float ay = 2.0f * sample<float>(key ^ 0x02e5be93u) - 1.0f;
                        float az = 0.25f + 0.75f * sample<float>(key ^ 0x967a889bu);
                        V<float> dir = (tan_x * ax + tan_y * ay + n * az).unit();
                        Ray<float> ar{p, dir};
                        float a_idx = safe_rcp(dir.x), a_idy = safe_rcp(dir.y), a_idz = safe_rcp(dir.z);
                        open += !traverse_bvh4_blocked(bvh4, woop_tris, ar, a_idx, a_idy, a_idz, c_scene.ao_radius, last_ao_tri);
                    }
                }

                float ambient = c_scene.ao ? (float(open) / float(c_scene.ao)) : 1.0f;
                float value   = 0.08f + 0.20f * ambient + 0.72f * cosine * visible;
                V<float> color(tc.x, tc.y, tc.z);
                result = result + color * (through * value * (1.0f - mirror));
                through *= mirror;
                if (mirror == 0.0f) break;
                r = {p, (r.d - n * (2.0f * r.d.dot(n))).unit()};
            }
        }

        int prev_pix = __shfl_up_sync(0xffffffffu, pixel, 1);
        #pragma unroll
        for (int off = 1; off < 32; off <<= 1) {
            int   opix = __shfl_down_sync(0xffffffffu, pixel, off);
            float rx   = __shfl_down_sync(0xffffffffu, result.x, off);
            float ry   = __shfl_down_sync(0xffffffffu, result.y, off);
            float rz   = __shfl_down_sync(0xffffffffu, result.z, off);
            if (lane + off < 32 && opix == pixel) {
                result.x += rx; result.y += ry; result.z += rz;
            }
        }
        if (valid && (lane == 0 || prev_pix != pixel)) {
            atomicAdd(&out_rgb[3 * pixel + 0], result.x * inv_spp);
            atomicAdd(&out_rgb[3 * pixel + 1], result.y * inv_spp);
            atomicAdd(&out_rgb[3 * pixel + 2], result.z * inv_spp);
        }
    }
}

void init(int mt, int mp, int ms) {
    (void)ms;
    cudaDeviceProp prop{};
    ck(cudaGetDeviceProperties(&prop, 0));
    g_sm_count = prop.multiProcessorCount;

    size_t n = static_cast<size_t>(std::max(mt, 16));
    size_t p = static_cast<size_t>(std::max(mp, 64));

    ck(cudaMalloc(&d_raw_tris,   n * sizeof(Triangle)));
    ck(cudaMalloc(&d_bvh4,       (n + 4) * sizeof(BVH4Node)));
    ck(cudaMalloc(&d_woop_tris,  n * sizeof(WoopTri)));
    ck(cudaMalloc(&d_shade_tris, n * sizeof(ShadeTri)));

    ck(cudaMalloc(&d_ploc_box,   2 * n * sizeof(AABB6)));
    ck(cudaMalloc(&d_cent,       n * sizeof(float4)));
    ck(cudaMalloc(&d_ploc_left,  2 * n * sizeof(int)));
    ck(cudaMalloc(&d_ploc_right, 2 * n * sizeof(int)));
    ck(cudaMalloc(&d_ploc_par,   2 * n * sizeof(int)));
    ck(cudaMalloc(&d_ploc_cnt,   2 * n * sizeof(int)));
    ck(cudaMalloc(&d_ploc_lcnt,  2 * n * sizeof(int)));
    ck(cudaMalloc(&d_ploc_off,   2 * n * sizeof(int)));
    ck(cudaMalloc(&d_collapsed,  2 * n * sizeof(uint8_t)));
    ck(cudaMalloc(&d_bfs_q0,     n * sizeof(int2)));
    ck(cudaMalloc(&d_bfs_q1,     n * sizeof(int2)));

    ck(cudaMalloc(&d_morton0,    n * sizeof(uint64_t)));
    ck(cudaMalloc(&d_morton1,    n * sizeof(uint64_t)));
    ck(cudaMalloc(&d_idx0,       n * sizeof(int)));
    ck(cudaMalloc(&d_active0,    n * sizeof(int)));
    ck(cudaMalloc(&d_active1,    n * sizeof(int)));
    ck(cudaMalloc(&d_active_mid, n * sizeof(int)));
    ck(cudaMalloc(&d_nn,         n * sizeof(int)));
    ck(cudaMalloc(&d_blk_cnts,   ((n + 255) / 256 + 16) * sizeof(int)));
    ck(cudaMalloc(&d_pix_order,  p * sizeof(int)));

    ck(cudaMalloc(&d_cbounds_u,  8 * sizeof(uint32_t)));
    ck(cudaMalloc(&d_scalars,    8 * sizeof(int)));
    ck(cudaMalloc(&d_sample_ctr, sizeof(unsigned long long)));
    ck(cudaMallocHost(&h_pinned, 4 * sizeof(int)));

    g_cub_bytes = 0;
    ck(cub::DeviceRadixSort::SortPairs(nullptr, g_cub_bytes, d_morton0, d_morton1, d_idx0, d_active0, static_cast<int>(n), 0, 60));
    g_cub_bytes += 4096;
    ck(cudaMalloc(&d_cub_temp, g_cub_bytes));

    ck(cudaFuncSetAttribute(render_bvh4_continuous_kernel, cudaFuncAttributePreferredSharedMemoryCarveout, 0));
}

void render(const Scene& s, float* out_rgb) {
    int N = s.triangle_count;
    ck(cudaMemcpy(d_raw_tris, s.triangles, static_cast<size_t>(N) * sizeof(Triangle), cudaMemcpyHostToDevice));

    if (N <= 8) {
        reset_ploc_scalars<<<1, 32>>>(d_cbounds_u, d_scalars, d_sample_ctr, N);
        build_tiny_bvh4_kernel<<<1, 32>>>(d_raw_tris, N, d_bvh4, d_woop_tris, d_shade_tris);
    } else {
        reset_ploc_scalars<<<1, 32>>>(d_cbounds_u, d_scalars, d_sample_ctr, N);
        init_ploc_leaves_kernel<<<(N + 255) / 256, 256>>>(
            d_raw_tris, N, d_ploc_box, d_cent, d_ploc_par, d_ploc_cnt, d_ploc_lcnt, d_idx0, d_cbounds_u);
        calc_morton64_kernel<<<(N + 255) / 256, 256>>>(d_cent, N, d_cbounds_u, d_morton0);
        ck(cub::DeviceRadixSort::SortPairs(d_cub_temp, g_cub_bytes, d_morton0, d_morton1, d_idx0, d_active0, N, 0, 60));

        int* act_cur  = d_active0;
        int* act_next = d_active1;
        int  M        = N;
        while (M > 512) {
            int nb = (M + 255) / 256;
            ploc_find_nn_kernel<<<nb, PLOC_B>>>(act_cur, M, d_ploc_box, d_nn);
            ploc_merge_count_kernel<<<nb, 256>>>(
                act_cur, d_active_mid, M, d_nn, d_ploc_box, d_ploc_left, d_ploc_right,
                d_ploc_par, d_ploc_cnt, d_ploc_lcnt, d_scalars, d_blk_cnts);
            scan_blocks_kernel<<<1, 1024>>>(d_blk_cnts, nb, d_scalars);
            ploc_scatter_kernel<<<nb, 256>>>(d_active_mid, M, d_blk_cnts, act_next);
            ck(cudaMemcpy(h_pinned, d_scalars + 2, sizeof(int), cudaMemcpyDeviceToHost));
            M = h_pinned[0];
            std::swap(act_cur, act_next);
        }
        ploc_finish_smem_kernel<<<1, 512>>>(
            act_cur, M, d_ploc_box, d_ploc_left, d_ploc_right,
            d_ploc_par, d_ploc_cnt, d_ploc_lcnt, d_scalars, d_bfs_q0);

        int tot = 2 * N - 1;
        ploc_offsets_and_woop_kernel<<<(tot + 255) / 256, 256>>>(
            N, d_raw_tris, d_ploc_par, d_ploc_lcnt, d_ploc_off, d_collapsed, d_woop_tris, d_shade_tris);
        int n_int = N - 1;
        ploc_sah_collapse_kernel<<<(n_int + 255) / 256, 256>>>(
            N, d_scalars, d_ploc_box, d_ploc_left, d_ploc_right, d_ploc_par, d_ploc_cnt, d_collapsed);

        int2* q_cur = d_bfs_q0;
        int2* q_nxt = d_bfs_q1;
        int   q_len = 1;
        while (q_len > 0) {
            ck(cudaMemsetAsync(d_scalars + 4, 0, sizeof(int)));
            bvh4_bfs_level_kernel<<<(q_len + 255) / 256, 256>>>(
                q_cur, q_len, q_nxt, d_scalars + 4, d_scalars + 3,
                N, d_ploc_box, d_ploc_left, d_ploc_right, d_ploc_off, d_ploc_cnt, d_collapsed, d_bvh4);
            ck(cudaMemcpy(h_pinned, d_scalars + 4, sizeof(int), cudaMemcpyDeviceToHost));
            q_len = h_pinned[0];
            std::swap(q_cur, q_nxt);
        }
    }

    int tx8 = (s.width + 7) / 8;
    int ty8 = (s.height + 7) / 8;
    int tot_slots = tx8 * ty8 * 64;
    build_pixel_order_kernel<<<(tot_slots + 255) / 256, 256>>>(s.width, s.height, tx8, d_pix_order);

    Scene d_scene = s;
    d_scene.triangles = nullptr;
    ck(cudaMemcpyToSymbolAsync(c_scene, &d_scene, sizeof(Scene)));

    int num_pixels = s.width * s.height;
    unsigned long long total_samples = static_cast<unsigned long long>(num_pixels) * static_cast<unsigned long long>(s.spp);
    ck(cudaMemsetAsync(out_rgb, 0, static_cast<size_t>(3) * static_cast<size_t>(num_pixels) * sizeof(float)));

    V<float> light_dir = V<float>(s.light).unit();
    auto host_rcp = [](float d) {
        const float eps = 1e-30f;
        if (std::fabs(d) < eps) d = (d < 0.0f) ? -eps : eps;
        return 1.0f / d;
    };
    float l_idx = host_rcp(light_dir.x), l_idy = host_rcp(light_dir.y), l_idz = host_rcp(light_dir.z);

    int max_needed_blocks = static_cast<int>((total_samples + 127ULL) / 128ULL);
    int p_blocks = std::min(g_sm_count * 6, std::max(1, max_needed_blocks));
    render_bvh4_continuous_kernel<<<p_blocks, 128>>>(
        light_dir, l_idx, l_idy, l_idz, 1.0f / float(s.spp),
        total_samples, d_pix_order, d_bvh4, d_woop_tris, d_shade_tris, d_sample_ctr, out_rgb);

    ck(cudaGetLastError());
    ck(cudaDeviceSynchronize());
}
