#include "render_math.cuh"
#include <cub/cub.cuh>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace {

static void ck(cudaError_t e) {
    if (e != cudaSuccess) {
        fprintf(stderr, "solution CUDA error %d: %s\n", int(e), cudaGetErrorString(e));
        exit(2);
    }
}

struct alignas(128) BVH4Node {
    float4 lox, hix;
    float4 loy, hiy;
    float4 loz, hiz;
    uint4 child;
    uint4 pad; // 128 bytes total = exact L1 cache line
};

struct alignas(16) TriGeom {
    float v0x, v0y, v0z, e1x;
    float e1y, e1z, e2x, e2y;
    float e2z, pad0, pad1, pad2;
};

struct alignas(16) TriMat {
    float r, g, b, mirror;
};

struct QueueItem {
    int bvh2_node;
    int bvh4_idx;
};

constexpr int MAX_LEAF_TRIS = 4;
constexpr float C_NODE4 = 1.0f;
constexpr float C_TRI = 0.6f;
constexpr float AABB_PAD = 2e-5f;

constexpr int MAX_TILE_TRIS = 12;
constexpr int BLOCK_THREADS = 128;
constexpr int SH_STACK = 15;
constexpr int SPILL_STRIDE = 64;
constexpr int CHUNK_SAMPLES = 1048576;
constexpr int NUM_WARPS_MAX = CHUNK_SAMPLES / 32;

struct alignas(16) BounceItem {
    float4 o_ps;  // ox, oy, oz, as_float((uint32_t(pixel) << 9) | uint32_t(sid))
    float4 d_thr; // dx, dy, dz, through
};

static int g_num_sms = 76;
static int g_max_blocks = 912;
static int g_blk_shadow = 608;
static int g_blk_ao = 608;
static int g_cap_pixels = 0;
static int g_cap_tiles4 = 0;

// Persistent workspace allocated in init()
static int g_cap_tris = 0;
static Triangle* d_tris_in = nullptr;
static Triangle* h_tris_pinned = nullptr;
static size_t g_pinned_bytes = 0;

static TriGeom* d_tri_geom = nullptr;
static TriMat* d_tri_mat = nullptr;
static BVH4Node* d_bvh4_nodes = nullptr;
static uint32_t* d_spill = nullptr;

// Builder buffers
static int* d_scene_cbox = nullptr;
static uint64_t* d_morton_a = nullptr;
static uint64_t* d_morton_b = nullptr;
static int* d_idx_a = nullptr;
static int* d_idx_b = nullptr;
static void* d_cub_temp = nullptr;
static size_t g_cub_temp_bytes = 0;

static int* d_left = nullptr;
static int* d_right = nullptr;
static int* d_parent = nullptr;
static int* d_visits = nullptr;
static float4* d_bmin = nullptr;
static float4* d_bmax = nullptr;
static int* d_tri_cnt = nullptr;
static float4* d_dp_cost = nullptr;
static uchar4* d_dp_choice = nullptr;

static QueueItem* d_q_a = nullptr;
static QueueItem* d_q_b = nullptr;
static int* d_counters = nullptr; // [0..2]=BVH4 BFS, [3..27]=wavefront queues & work counters
static uint32_t* d_root_ref = nullptr;
static int* h_q_cnt_pinned = nullptr;

// Primary tile-frustum & pixel-hint caches
static int* d_hint_tri = nullptr;
static int* d_shadow_hint = nullptr;
static int* d_tile_mode = nullptr;
static uint32_t* d_tile_entry = nullptr;
static uint32_t* d_tile_tris = nullptr;

// Coherent chunked buffers (L2 resident working set)
static float* d_hit_t = nullptr;
static int* d_hit_id = nullptr;
static int* d_diff_rays = nullptr;
static int* d_bounce_src = nullptr;
static uint32_t* d_warp_diff_mask = nullptr;
static uint32_t* d_warp_bounce_mask = nullptr;
static int* d_warp_diff_off = nullptr;
static int* d_warp_bnc_off = nullptr;
static int* d_pack_blk = nullptr;
static BounceItem* d_bounce_a = nullptr;
static BounceItem* d_bounce_b = nullptr;

// ---- Device helpers ----

__device__ inline int floatToOrderedInt(float f) {
    int bits = __float_as_int(f);
    return (bits >= 0) ? bits : (bits ^ 0x7fffffff);
}

__device__ inline float orderedIntToFloat(int i) {
    int bits = (i >= 0) ? i : (i ^ 0x7fffffff);
    return __int_as_float(bits);
}

__device__ inline uint64_t expandBits21(uint32_t v) {
    uint64_t x = v & 0x1fffffu;
    x = (x | (x << 32)) & 0x1f00000000ffffULL;
    x = (x | (x << 16)) & 0x1f0000ff0000ffULL;
    x = (x | (x << 8))  & 0x100f00f00f00f00fULL;
    x = (x | (x << 4))  & 0x10c30c30c30c30c3ULL;
    x = (x | (x << 2))  & 0x1249249249249249ULL;
    return x;
}

__device__ inline float halfArea(float lx, float ly, float lz, float hx, float hy, float hz) {
    float dx = fmaxf(0.0f, hx - lx);
    float dy = fmaxf(0.0f, hy - ly);
    float dz = fmaxf(0.0f, hz - lz);
    return dx * dy + dy * dz + dz * dx;
}

__global__ void kComputeCentroidBounds(const Triangle* __restrict__ tris, int N, int* __restrict__ cbox) {
    float lox = 1e30f, loy = 1e30f, loz = 1e30f;
    float hix = -1e30f, hiy = -1e30f, hiz = -1e30f;
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    int stride = blockDim.x * gridDim.x;
    for (int i = tid; i < N; i += stride) {
        const Triangle& t = tris[i];
        float cx = 0.5f * (fminf(t.v0[0], fminf(t.v1[0], t.v2[0])) + fmaxf(t.v0[0], fmaxf(t.v1[0], t.v2[0])));
        float cy = 0.5f * (fminf(t.v0[1], fminf(t.v1[1], t.v2[1])) + fmaxf(t.v0[1], fmaxf(t.v1[1], t.v2[1])));
        float cz = 0.5f * (fminf(t.v0[2], fminf(t.v1[2], t.v2[2])) + fmaxf(t.v0[2], fmaxf(t.v1[2], t.v2[2])));
        lox = fminf(lox, cx); loy = fminf(loy, cy); loz = fminf(loz, cz);
        hix = fmaxf(hix, cx); hiy = fmaxf(hiy, cy); hiz = fmaxf(hiz, cz);
    }
    for (int off = 16; off >= 1; off >>= 1) {
        lox = fminf(lox, __shfl_down_sync(0xffffffff, lox, off));
        loy = fminf(loy, __shfl_down_sync(0xffffffff, loy, off));
        loz = fminf(loz, __shfl_down_sync(0xffffffff, loz, off));
        hix = fmaxf(hix, __shfl_down_sync(0xffffffff, hix, off));
        hiy = fmaxf(hiy, __shfl_down_sync(0xffffffff, hiy, off));
        hiz = fmaxf(hiz, __shfl_down_sync(0xffffffff, hiz, off));
    }
    __shared__ float s_val[6 * 8];
    int warp = threadIdx.x >> 5;
    int lane = threadIdx.x & 31;
    if (lane == 0) {
        s_val[warp * 6 + 0] = lox; s_val[warp * 6 + 1] = loy; s_val[warp * 6 + 2] = loz;
        s_val[warp * 6 + 3] = hix; s_val[warp * 6 + 4] = hiy; s_val[warp * 6 + 5] = hiz;
    }
    __syncthreads();
    if (threadIdx.x == 0) {
        int nwarps = (blockDim.x + 31) >> 5;
        for (int w = 1; w < nwarps; w++) {
            lox = fminf(lox, s_val[w * 6 + 0]); loy = fminf(loy, s_val[w * 6 + 1]); loz = fminf(loz, s_val[w * 6 + 2]);
            hix = fmaxf(hix, s_val[w * 6 + 3]); hiy = fmaxf(hiy, s_val[w * 6 + 4]); hiz = fmaxf(hiz, s_val[w * 6 + 5]);
        }
        if (lox <= hix) {
            atomicMin(&cbox[0], floatToOrderedInt(lox));
            atomicMin(&cbox[1], floatToOrderedInt(loy));
            atomicMin(&cbox[2], floatToOrderedInt(loz));
            atomicMax(&cbox[3], floatToOrderedInt(hix));
            atomicMax(&cbox[4], floatToOrderedInt(hiy));
            atomicMax(&cbox[5], floatToOrderedInt(hiz));
        }
    }
}

__global__ void kComputeMorton(const Triangle* __restrict__ tris, int N, const int* __restrict__ cbox,
                               uint64_t* __restrict__ morton, int* __restrict__ idx) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= N) return;
    float lox = orderedIntToFloat(cbox[0]), loy = orderedIntToFloat(cbox[1]), loz = orderedIntToFloat(cbox[2]);
    float hix = orderedIntToFloat(cbox[3]), hiy = orderedIntToFloat(cbox[4]), hiz = orderedIntToFloat(cbox[5]);
    float invx = (hix > lox) ? (2097151.0f / (hix - lox)) : 0.0f;
    float invy = (hiy > loy) ? (2097151.0f / (hiy - loy)) : 0.0f;
    float invz = (hiz > loz) ? (2097151.0f / (hiz - loz)) : 0.0f;

    const Triangle& t = tris[i];
    float cx = 0.5f * (fminf(t.v0[0], fminf(t.v1[0], t.v2[0])) + fmaxf(t.v0[0], fmaxf(t.v1[0], t.v2[0])));
    float cy = 0.5f * (fminf(t.v0[1], fminf(t.v1[1], t.v2[1])) + fmaxf(t.v0[1], fmaxf(t.v1[1], t.v2[1])));
    float cz = 0.5f * (fminf(t.v0[2], fminf(t.v1[2], t.v2[2])) + fmaxf(t.v0[2], fmaxf(t.v1[2], t.v2[2])));

    uint32_t qx = uint32_t(fminf(fmaxf((cx - lox) * invx, 0.0f), 2097151.0f));
    uint32_t qy = uint32_t(fminf(fmaxf((cy - loy) * invy, 0.0f), 2097151.0f));
    uint32_t qz = uint32_t(fminf(fmaxf((cz - loz) * invz, 0.0f), 2097151.0f));
    morton[i] = (expandBits21(qx) << 2) | (expandBits21(qy) << 1) | expandBits21(qz);
    idx[i] = i;
}

__device__ inline int delta64(const uint64_t* __restrict__ M, int N, int i, int j) {
    if (j < 0 || j >= N) return -1;
    uint64_t a = M[i], b = M[j];
    if (a != b) return __clzll(a ^ b);
    return 64 + __clz(uint32_t(i) ^ uint32_t(j));
}

__global__ void kBuildKarras(const uint64_t* __restrict__ M, int N,
                             int* __restrict__ left, int* __restrict__ right, int* __restrict__ parent) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= N - 1) return;

    int d = (delta64(M, N, i, i + 1) - delta64(M, N, i, i - 1)) >= 0 ? 1 : -1;
    int dmin = delta64(M, N, i, i - d);
    int lmax = 2;
    while (delta64(M, N, i, i + lmax * d) > dmin) lmax <<= 1;

    int l = 0;
    for (int t = lmax >> 1; t >= 1; t >>= 1) {
        if (delta64(M, N, i, i + (l + t) * d) > dmin) l += t;
    }
    int j = i + l * d;
    int dnode = delta64(M, N, i, j);

    int s = 0;
    int step = l;
    do {
        step = (step + 1) >> 1;
        if (delta64(M, N, i, i + (s + step) * d) > dnode) s += step;
    } while (step > 1);
    int split = i + s * d + (d < 0 ? d : 0);

    int first = (i < j) ? i : j;
    int last = (i > j) ? i : j;
    int lc = (first == split) ? (N - 1 + split) : split;
    int rc = (last == split + 1) ? (N - 1 + split + 1) : (split + 1);

    left[i] = lc;
    right[i] = rc;
    parent[lc] = i;
    parent[rc] = i;
    if (i == 0) parent[0] = -1;
}

__global__ void kInitLeavesAndRefit(const Triangle* __restrict__ tris, const int* __restrict__ tri_idx, int N,
                                    const int* __restrict__ left, const int* __restrict__ right, const int* __restrict__ parent,
                                    int* __restrict__ visits, float4* __restrict__ bmin, float4* __restrict__ bmax) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= N) return;
    int tid = tri_idx[i];
    const Triangle& t = tris[tid];
    float lox = fminf(t.v0[0], fminf(t.v1[0], t.v2[0]));
    float loy = fminf(t.v0[1], fminf(t.v1[1], t.v2[1]));
    float loz = fminf(t.v0[2], fminf(t.v1[2], t.v2[2]));
    float hix = fmaxf(t.v0[0], fmaxf(t.v1[0], t.v2[0]));
    float hiy = fmaxf(t.v0[1], fmaxf(t.v1[1], t.v2[1]));
    float hiz = fmaxf(t.v0[2], fmaxf(t.v1[2], t.v2[2]));

    int leaf = (N - 1) + i;
    float sa = halfArea(lox, loy, loz, hix, hiy, hiz);
    bmin[leaf] = make_float4(lox, loy, loz, sa);
    bmax[leaf] = make_float4(hix, hiy, hiz, sa);
    __threadfence();

    int cur = parent[leaf];
    while (cur >= 0) {
        if (atomicAdd(&visits[cur], 1) == 0) return;
        __threadfence();
        int lc = __ldcg(&left[cur]);
        int rc = __ldcg(&right[cur]);
        float4 l0 = __ldcg(&bmin[lc]), l1 = __ldcg(&bmax[lc]);
        float4 r0 = __ldcg(&bmin[rc]), r1 = __ldcg(&bmax[rc]);
        float nx0 = fminf(l0.x, r0.x), ny0 = fminf(l0.y, r0.y), nz0 = fminf(l0.z, r0.z);
        float nx1 = fmaxf(l1.x, r1.x), ny1 = fmaxf(l1.y, r1.y), nz1 = fmaxf(l1.z, r1.z);
        float csa = halfArea(nx0, ny0, nz0, nx1, ny1, nz1);
        bmin[cur] = make_float4(nx0, ny0, nz0, csa);
        bmax[cur] = make_float4(nx1, ny1, nz1, csa + l1.w + r1.w);
        __threadfence();
        cur = __ldcg(&parent[cur]);
    }
}

__global__ void kTreeletOptimize(int N, int* __restrict__ left, int* __restrict__ right, int* __restrict__ parent,
                                 int* __restrict__ visits, float4* __restrict__ bmin, float4* __restrict__ bmax) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= N) return;
    int cur = parent[(N - 1) + i];
    while (cur >= 0) {
        if (atomicAdd(&visits[cur], 1) == 0) return;
        __threadfence();

        int pool[6];
        int pool_cnt = 1;
        pool[0] = cur;

        int front[7];
        float4 fmin[7], fmax[7];
        int lc = __ldcg(&left[cur]);
        int rc = __ldcg(&right[cur]);
        front[0] = lc; fmin[0] = __ldcg(&bmin[lc]); fmax[0] = __ldcg(&bmax[lc]);
        front[1] = rc; fmin[1] = __ldcg(&bmin[rc]); fmax[1] = __ldcg(&bmax[rc]);
        int m = 2;

        while (m < 7) {
            int best_idx = -1;
            float best_sa = -1.0f;
            for (int k = 0; k < m; k++) {
                if (front[k] < N - 1 && fmin[k].w > best_sa) {
                    best_sa = fmin[k].w;
                    best_idx = k;
                }
            }
            if (best_idx < 0) break;
            int exp_node = front[best_idx];
            pool[pool_cnt++] = exp_node;
            int el = __ldcg(&left[exp_node]);
            int er = __ldcg(&right[exp_node]);
            front[best_idx] = el; fmin[best_idx] = __ldcg(&bmin[el]); fmax[best_idx] = __ldcg(&bmax[el]);
            front[m] = er;        fmin[m] = __ldcg(&bmin[er]);        fmax[m] = __ldcg(&bmax[er]);
            m++;
        }

        if (m == 2) {
            float nx0 = fminf(fmin[0].x, fmin[1].x), ny0 = fminf(fmin[0].y, fmin[1].y), nz0 = fminf(fmin[0].z, fmin[1].z);
            float nx1 = fmaxf(fmax[0].x, fmax[1].x), ny1 = fmaxf(fmax[0].y, fmax[1].y), nz1 = fmaxf(fmax[0].z, fmax[1].z);
            float csa = halfArea(nx0, ny0, nz0, nx1, ny1, nz1);
            bmin[cur] = make_float4(nx0, ny0, nz0, csa);
            bmax[cur] = make_float4(nx1, ny1, nz1, csa + fmax[0].w + fmax[1].w);
        } else {
            int active_cnt = m;
            for (int s = 0; s < m - 1; s++) {
                int bi = 0, bj = 1;
                float best_area = 1e30f;
                for (int a = 0; a < active_cnt; a++) {
                    for (int b = a + 1; b < active_cnt; b++) {
                        float ux0 = fminf(fmin[a].x, fmin[b].x), uy0 = fminf(fmin[a].y, fmin[b].y), uz0 = fminf(fmin[a].z, fmin[b].z);
                        float ux1 = fmaxf(fmax[a].x, fmax[b].x), uy1 = fmaxf(fmax[a].y, fmax[b].y), uz1 = fmaxf(fmax[a].z, fmax[b].z);
                        float ua = halfArea(ux0, uy0, uz0, ux1, uy1, uz1);
                        if (ua < best_area) { best_area = ua; bi = a; bj = b; }
                    }
                }
                int node_id = pool[m - 2 - s];
                int ca = front[bi], cb = front[bj];
                float nx0 = fminf(fmin[bi].x, fmin[bj].x), ny0 = fminf(fmin[bi].y, fmin[bj].y), nz0 = fminf(fmin[bi].z, fmin[bj].z);
                float nx1 = fmaxf(fmax[bi].x, fmax[bj].x), ny1 = fmaxf(fmax[bi].y, fmax[bj].y), nz1 = fmaxf(fmax[bi].z, fmax[bj].z);
                float sah_node = best_area + fmax[bi].w + fmax[bj].w;

                left[node_id] = ca;
                right[node_id] = cb;
                parent[ca] = node_id;
                parent[cb] = node_id;
                bmin[node_id] = make_float4(nx0, ny0, nz0, best_area);
                bmax[node_id] = make_float4(nx1, ny1, nz1, sah_node);

                front[bi] = node_id;
                fmin[bi] = make_float4(nx0, ny0, nz0, best_area);
                fmax[bi] = make_float4(nx1, ny1, nz1, sah_node);
                active_cnt--;
                if (bj != active_cnt) {
                    front[bj] = front[active_cnt];
                    fmin[bj] = fmin[active_cnt];
                    fmax[bj] = fmax[active_cnt];
                }
            }
        }
        __threadfence();
        cur = __ldcg(&parent[cur]);
    }
}

__global__ void kBuildBVH4DP(int N, const int* __restrict__ left, const int* __restrict__ right,
                             const int* __restrict__ parent, int* __restrict__ visits,
                             const float4* __restrict__ bmin, int* __restrict__ tri_cnt,
                             float4* __restrict__ dp_cost, uchar4* __restrict__ dp_choice) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= N) return;
    int leaf = (N - 1) + i;
    tri_cnt[leaf] = 1;
    float leaf_c = C_TRI * bmin[leaf].w;
    dp_cost[leaf] = make_float4(leaf_c, leaf_c, leaf_c, 0.0f);
    dp_choice[leaf] = make_uchar4(0, 0, 0, 0);
    __threadfence();

    int cur = parent[leaf];
    while (cur >= 0) {
        if (atomicAdd(&visits[cur], 1) == 0) return;
        __threadfence();

        int lc = __ldcg(&left[cur]);
        int rc = __ldcg(&right[cur]);
        int cnt = __ldcg(&tri_cnt[lc]) + __ldcg(&tri_cnt[rc]);
        float4 cL = __ldcg(&dp_cost[lc]); // x=C1, y=C2, z=C3
        float4 cR = __ldcg(&dp_cost[rc]);
        float sa_u = bmin[cur].w;

        // C1: leaf vs 4-slot internal (k from L, 4-k from R)
        float cost_leaf = (cnt <= MAX_LEAF_TRIS) ? (C_TRI * sa_u * float(cnt)) : 1e30f;
        float s13 = cL.x + cR.z;
        float s22 = cL.y + cR.y;
        float s31 = cL.z + cR.x;
        float best_int = s13;
        uint8_t ch1 = 1;
        if (s22 < best_int) { best_int = s22; ch1 = 2; }
        if (s31 < best_int) { best_int = s31; ch1 = 3; }
        best_int += C_NODE4 * sa_u;

        float C1 = best_int;
        if (cnt <= MAX_LEAF_TRIS && cost_leaf <= best_int) {
            C1 = cost_leaf;
            ch1 = 0;
        }

        // C2: keep C1 vs (1, 1)
        float C2 = C1;
        uint8_t ch2 = 0;
        float s11 = cL.x + cR.x;
        if (s11 < C2) { C2 = s11; ch2 = 1; }

        // C3: keep C2 vs (1, 2) or (2, 1)
        float C3 = C2;
        uint8_t ch3 = 0;
        float s12 = cL.x + cR.y;
        float s21 = cL.y + cR.x;
        if (s12 < C3) { C3 = s12; ch3 = 1; }
        if (s21 < C3) { C3 = s21; ch3 = 2; }

        tri_cnt[cur] = cnt;
        dp_cost[cur] = make_float4(C1, C2, C3, 0.0f);
        dp_choice[cur] = make_uchar4(ch1, ch2, ch3, 0);
        __threadfence();
        cur = __ldcg(&parent[cur]);
    }
}

__device__ inline int collectLeafTris(int N, int root_bvh2, const int* __restrict__ left, const int* __restrict__ right,
                                      const int* __restrict__ tri_idx, const Triangle* __restrict__ tris_in,
                                      int tri_base, TriGeom* __restrict__ geom, TriMat* __restrict__ mat) {
    int st[16];
    int sp = 0;
    st[sp++] = root_bvh2;
    int cnt = 0;
    while (sp > 0) {
        int x = st[--sp];
        if (x >= N - 1) {
            const Triangle& t = tris_in[tri_idx[x - (N - 1)]];
            int dst = tri_base + cnt;
            TriGeom g;
            g.v0x = t.v0[0]; g.v0y = t.v0[1]; g.v0z = t.v0[2];
            g.e1x = t.v1[0] - t.v0[0]; g.e1y = t.v1[1] - t.v0[1]; g.e1z = t.v1[2] - t.v0[2];
            g.e2x = t.v2[0] - t.v0[0]; g.e2y = t.v2[1] - t.v0[1]; g.e2z = t.v2[2] - t.v0[2];
            g.pad0 = g.pad1 = g.pad2 = 0.0f;
            geom[dst] = g;
            mat[dst] = TriMat{t.color[0], t.color[1], t.color[2], t.mirror};
            cnt++;
        } else {
            st[sp++] = right[x];
            st[sp++] = left[x];
        }
    }
    return cnt;
}

__global__ void kInitBVH4BFS(int N, const int* __restrict__ left, const int* __restrict__ right,
                             const int* __restrict__ tri_idx, const Triangle* __restrict__ tris_in,
                             const uchar4* __restrict__ dp_choice,
                             TriGeom* __restrict__ geom, TriMat* __restrict__ mat,
                             QueueItem* __restrict__ q_out, int* __restrict__ counters, uint32_t* __restrict__ root_ref) {
    if (dp_choice[0].x == 0) {
        int cnt = collectLeafTris(N, 0, left, right, tri_idx, tris_in, 0, geom, mat);
        *root_ref = 0x80000000u | (uint32_t(cnt - 1) << 24) | 0u;
        counters[0] = 0; // next_q_cnt
        counters[1] = 0; // bvh4_cnt
        counters[2] = cnt;
    } else {
        *root_ref = 0u;
        q_out[0] = QueueItem{0, 0};
        counters[0] = 1; // q_cnt
        counters[1] = 1; // next free bvh4 idx
        counters[2] = 0; // next free tri idx
    }
}

__global__ void kPackBVH4Level(int N, int q_cnt, const QueueItem* __restrict__ q_in,
                               const int* __restrict__ left, const int* __restrict__ right,
                               const float4* __restrict__ bmin, const float4* __restrict__ bmax,
                               const int* __restrict__ tri_cnt, const uchar4* __restrict__ dp_choice,
                               const int* __restrict__ tri_idx, const Triangle* __restrict__ tris_in,
                               BVH4Node* __restrict__ nodes, TriGeom* __restrict__ geom, TriMat* __restrict__ mat,
                               QueueItem* __restrict__ q_out, int* __restrict__ counters) {
    int qid = blockIdx.x * blockDim.x + threadIdx.x;
    if (qid >= q_cnt) return;

    QueueItem item = q_in[qid];
    int u = item.bvh2_node;
    int dst = item.bvh4_idx;

    // Backtrack 4-slot expansion from dp_choice
    int b_node[4], b_slots[4];
    int bsp = 0;
    uint8_t ch1 = dp_choice[u].x;
    int k_left = (ch1 == 1) ? 1 : (ch1 == 2) ? 2 : 3;
    b_node[bsp] = right[u]; b_slots[bsp] = 4 - k_left; bsp++;
    b_node[bsp] = left[u];  b_slots[bsp] = k_left;     bsp++;

    int children[4];
    int m = 0;
    while (bsp > 0) {
        int v = b_node[--bsp];
        int s = b_slots[bsp];
        uchar4 c = dp_choice[v];
        if (s == 1 || c.x == 0) {
            children[m++] = v;
        } else if (s == 2) {
            if (c.y == 0) {
                children[m++] = v;
            } else {
                b_node[bsp] = right[v]; b_slots[bsp] = 1; bsp++;
                b_node[bsp] = left[v];  b_slots[bsp] = 1; bsp++;
            }
        } else { // s == 3
            if (c.z == 0) {
                b_node[bsp] = v; b_slots[bsp] = 2; bsp++;
            } else if (c.z == 1) {
                b_node[bsp] = right[v]; b_slots[bsp] = 2; bsp++;
                b_node[bsp] = left[v];  b_slots[bsp] = 1; bsp++;
            } else {
                b_node[bsp] = right[v]; b_slots[bsp] = 1; bsp++;
                b_node[bsp] = left[v];  b_slots[bsp] = 2; bsp++;
            }
        }
    }

    int num_int = 0;
    int num_tris = 0;
    bool is_leaf[4];
    for (int j = 0; j < m; j++) {
        is_leaf[j] = (dp_choice[children[j]].x == 0);
        if (is_leaf[j]) num_tris += tri_cnt[children[j]];
        else num_int++;
    }

    int int_base = (num_int > 0) ? atomicAdd(&counters[1], num_int) : 0;
    int tri_base = (num_tris > 0) ? atomicAdd(&counters[2], num_tris) : 0;

    float lox[4], hix[4], loy[4], hiy[4], loz[4], hiz[4];
    uint32_t cref[4];

    for (int j = 0; j < 4; j++) {
        if (j < m) {
            int c = children[j];
            float4 mn = bmin[c], mx = bmax[c];
            lox[j] = mn.x - AABB_PAD; hix[j] = mx.x + AABB_PAD;
            loy[j] = mn.y - AABB_PAD; hiy[j] = mx.y + AABB_PAD;
            loz[j] = mn.z - AABB_PAD; hiz[j] = mx.z + AABB_PAD;
            if (is_leaf[j]) {
                int cnt = collectLeafTris(N, c, left, right, tri_idx, tris_in, tri_base, geom, mat);
                cref[j] = 0x80000000u | (uint32_t(cnt - 1) << 24) | uint32_t(tri_base);
                tri_base += cnt;
            } else {
                int next_idx = int_base++;
                cref[j] = uint32_t(next_idx);
                int qslot = atomicAdd(&counters[0], 1);
                q_out[qslot] = QueueItem{c, next_idx};
            }
        } else {
            lox[j] = loy[j] = loz[j] = 1e37f;
            hix[j] = hiy[j] = hiz[j] = 1e37f;
            cref[j] = 0x7fffffffu;
        }
    }

    BVH4Node out;
    out.lox = make_float4(lox[0], lox[1], lox[2], lox[3]);
    out.hix = make_float4(hix[0], hix[1], hix[2], hix[3]);
    out.loy = make_float4(loy[0], loy[1], loy[2], loy[3]);
    out.hiy = make_float4(hiy[0], hiy[1], hiy[2], hiy[3]);
    out.loz = make_float4(loz[0], loz[1], loz[2], loz[3]);
    out.hiz = make_float4(hiz[0], hiz[1], hiz[2], hiz[3]);
    out.child = make_uint4(cref[0], cref[1], cref[2], cref[3]);
    out.pad = make_uint4(0, 0, 0, 0);
    nodes[dst] = out;
}

__global__ void kSingleTriInit(const Triangle* __restrict__ tris, TriGeom* __restrict__ geom, TriMat* __restrict__ mat, uint32_t* __restrict__ root_ref) {
    const Triangle& t = tris[0];
    TriGeom g;
    g.v0x = t.v0[0]; g.v0y = t.v0[1]; g.v0z = t.v0[2];
    g.e1x = t.v1[0] - t.v0[0]; g.e1y = t.v1[1] - t.v0[1]; g.e1z = t.v1[2] - t.v0[2];
    g.e2x = t.v2[0] - t.v0[0]; g.e2y = t.v2[1] - t.v0[1]; g.e2z = t.v2[2] - t.v0[2];
    g.pad0 = g.pad1 = g.pad2 = 0.0f;
    geom[0] = g;
    mat[0] = TriMat{t.color[0], t.color[1], t.color[2], t.mirror};
    *root_ref = 0x80000000u;
}

// ---- Traversal & Shading ----

__device__ inline float3 add3(float3 a, float3 b) { return make_float3(a.x + b.x, a.y + b.y, a.z + b.z); }
__device__ inline float3 sub3(float3 a, float3 b) { return make_float3(a.x - b.x, a.y - b.y, a.z - b.z); }
__device__ inline float3 mul3(float3 a, float s) { return make_float3(a.x * s, a.y * s, a.z * s); }
__device__ inline float dot3(float3 a, float3 b) { return fmaf(a.x, b.x, fmaf(a.y, b.y, a.z * b.z)); }
__device__ inline float3 cross3(float3 a, float3 b) {
    return make_float3(fmaf(a.y, b.z, -a.z * b.y), fmaf(a.z, b.x, -a.x * b.z), fmaf(a.x, b.y, -a.y * b.x));
}
__device__ inline float3 unit3(float3 a) { return mul3(a, rsqrtf(dot3(a, a))); }

__device__ inline float3 precomputeInvDir(float3 d) {
    float ix = 1.0f / (fabsf(d.x) > 1e-18f ? d.x : 1e-18f);
    float iy = 1.0f / (fabsf(d.y) > 1e-18f ? d.y : 1e-18f);
    float iz = 1.0f / (fabsf(d.z) > 1e-18f ? d.z : 1e-18f);
    return make_float3(ix, iy, iz);
}

__device__ inline uint32_t octantOfInvDir(float3 id) {
    return (id.x < 0.0f ? 1u : 0u) | (id.y < 0.0f ? 2u : 0u) | (id.z < 0.0f ? 4u : 0u);
}

__device__ inline bool intersectTri(const TriGeom& tg, float3 o, float3 d, float limit, float& dist) {
    float4 f0 = *reinterpret_cast<const float4*>(&tg.v0x);
    float4 f1 = *reinterpret_cast<const float4*>(&tg.e1y);
    float4 f2 = *reinterpret_cast<const float4*>(&tg.e2z);
    float3 v0 = make_float3(f0.x, f0.y, f0.z);
    float3 e1 = make_float3(f0.w, f1.x, f1.y);
    float3 e2 = make_float3(f1.z, f1.w, f2.x);

    float3 p = cross3(d, e2);
    float det = dot3(e1, p);
    float abs_det = fabsf(det);
    if (abs_det < 1e-10f) return false;

    uint32_t sb = __float_as_uint(det) & 0x80000000u;
    float3 s = sub3(o, v0);
    float u_pos = __uint_as_float(__float_as_uint(dot3(s, p)) ^ sb);
    if (u_pos < 0.0f || u_pos > abs_det) return false;

    float3 q = cross3(s, e1);
    float v_pos = __uint_as_float(__float_as_uint(dot3(d, q)) ^ sb);
    if (v_pos < 0.0f || u_pos + v_pos > abs_det) return false;

    float t_pos = __uint_as_float(__float_as_uint(dot3(e2, q)) ^ sb);
    if (t_pos <= 0.0002f * abs_det || t_pos >= limit * abs_det) return false;

    dist = t_pos / abs_det;
    return true;
}

__device__ inline int intersectLeafClosest(uint32_t ref, const TriGeom* __restrict__ geom,
                                           float3 o, float3 d, float& t_best, int hit_id) {
    uint32_t cnt = ((ref >> 24) & 0x7fu) + 1u;
    uint32_t start = ref & 0x00ffffffu;
    for (uint32_t k = 0; k < cnt; k++) {
        float dist;
        if (intersectTri(geom[start + k], o, d, t_best, dist)) {
            t_best = dist;
            hit_id = int(start + k);
        }
    }
    return hit_id;
}

__device__ inline int intersectLeafBlocker(uint32_t ref, const TriGeom* __restrict__ geom,
                                           float3 o, float3 d, float limit) {
    uint32_t cnt = ((ref >> 24) & 0x7fu) + 1u;
    uint32_t start = ref & 0x00ffffffu;
    for (uint32_t k = 0; k < cnt; k++) {
        float dist;
        if (intersectTri(geom[start + k], o, d, limit, dist)) return int(start + k);
    }
    return -1;
}

__device__ inline bool intersectLeafAny(uint32_t ref, const TriGeom* __restrict__ geom,
                                        float3 o, float3 d, float limit) {
    return intersectLeafBlocker(ref, geom, o, d, limit) >= 0;
}

__device__ inline void pushStack(uint32_t val, int& sp, uint32_t s_stack[SH_STACK][BLOCK_THREADS], uint32_t* g_spill) {
    if (sp < SH_STACK) {
        s_stack[sp][threadIdx.x] = val;
    } else {
        long long gtid = (long long)blockIdx.x * BLOCK_THREADS + threadIdx.x;
        g_spill[gtid * SPILL_STRIDE + (sp - SH_STACK)] = val;
    }
    sp++;
}

__device__ inline uint32_t popStack(int& sp, uint32_t s_stack[SH_STACK][BLOCK_THREADS], uint32_t* g_spill) {
    --sp;
    if (sp < SH_STACK) return s_stack[sp][threadIdx.x];
    long long gtid = (long long)blockIdx.x * BLOCK_THREADS + threadIdx.x;
    return g_spill[gtid * SPILL_STRIDE + (sp - SH_STACK)];
}

__device__ inline uint32_t packStackItem(uint32_t ref, float t) {
    uint32_t t9 = (__float_as_uint(t) << 1) & 0xff800000u;
    uint32_t r23 = ((ref >> 9) & 0x00400000u) | ((ref >> 4) & 0x00300000u) | (ref & 0x000fffffu);
    return t9 | r23;
}

__device__ inline uint32_t unpackStackRef(uint32_t item) {
    return ((item & 0x00400000u) << 9) | ((item & 0x00300000u) << 4) | (item & 0x000fffffu);
}

__device__ inline float unpackStackT(uint32_t item) {
    return __uint_as_float((item & 0xff800000u) >> 1);
}

__device__ inline bool popValidClosest(int& sp, float t_best, uint32_t& cur,
                                       uint32_t s_stack[SH_STACK][BLOCK_THREADS], uint32_t* g_spill) {
    while (sp > 0) {
        uint32_t packed = popStack(sp, s_stack, g_spill);
        if (unpackStackT(packed) <= t_best) {
            cur = unpackStackRef(packed);
            return true;
        }
    }
    return false;
}

__device__ inline void traceClosest4From(const BVH4Node* __restrict__ nodes, const TriGeom* __restrict__ geom,
                                         uint32_t start_ref, float3 o, float3 d, float& t_best, int& hit_id,
                                         uint32_t s_stack[SH_STACK][BLOCK_THREADS], uint32_t* g_spill) {
    float3 id = precomputeInvDir(d);
    float3 oid = make_float3(o.x * id.x, o.y * id.y, o.z * id.z);
    int sp = 0;
    uint32_t cur = start_ref;

    while (true) {
        if (cur & 0x80000000u) {
            hit_id = intersectLeafClosest(cur, geom, o, d, t_best, hit_id);
            if (!popValidClosest(sp, t_best, cur, s_stack, g_spill)) break;
            continue;
        }

        const float4* ptr = reinterpret_cast<const float4*>(&nodes[cur]);
        float4 lo = ptr[0], hi = ptr[1];
        float a0 = fmaf(lo.x, id.x, -oid.x), b0 = fmaf(hi.x, id.x, -oid.x);
        float a1 = fmaf(lo.y, id.x, -oid.x), b1 = fmaf(hi.y, id.x, -oid.x);
        float a2 = fmaf(lo.z, id.x, -oid.x), b2 = fmaf(hi.z, id.x, -oid.x);
        float a3 = fmaf(lo.w, id.x, -oid.x), b3 = fmaf(hi.w, id.x, -oid.x);
        float t0 = fmaxf(0.0002f, fminf(a0, b0)), x0 = fminf(t_best, fmaxf(a0, b0));
        float t1 = fmaxf(0.0002f, fminf(a1, b1)), x1 = fminf(t_best, fmaxf(a1, b1));
        float t2 = fmaxf(0.0002f, fminf(a2, b2)), x2 = fminf(t_best, fmaxf(a2, b2));
        float t3 = fmaxf(0.0002f, fminf(a3, b3)), x3 = fminf(t_best, fmaxf(a3, b3));

        lo = ptr[2]; hi = ptr[3];
        a0 = fmaf(lo.x, id.y, -oid.y); b0 = fmaf(hi.x, id.y, -oid.y);
        a1 = fmaf(lo.y, id.y, -oid.y); b1 = fmaf(hi.y, id.y, -oid.y);
        a2 = fmaf(lo.z, id.y, -oid.y); b2 = fmaf(hi.z, id.y, -oid.y);
        a3 = fmaf(lo.w, id.y, -oid.y); b3 = fmaf(hi.w, id.y, -oid.y);
        t0 = fmaxf(t0, fminf(a0, b0)); x0 = fminf(x0, fmaxf(a0, b0));
        t1 = fmaxf(t1, fminf(a1, b1)); x1 = fminf(x1, fmaxf(a1, b1));
        t2 = fmaxf(t2, fminf(a2, b2)); x2 = fminf(x2, fmaxf(a2, b2));
        t3 = fmaxf(t3, fminf(a3, b3)); x3 = fminf(x3, fmaxf(a3, b3));

        lo = ptr[4]; hi = ptr[5];
        a0 = fmaf(lo.x, id.z, -oid.z); b0 = fmaf(hi.x, id.z, -oid.z);
        a1 = fmaf(lo.y, id.z, -oid.z); b1 = fmaf(hi.y, id.z, -oid.z);
        a2 = fmaf(lo.z, id.z, -oid.z); b2 = fmaf(hi.z, id.z, -oid.z);
        a3 = fmaf(lo.w, id.z, -oid.z); b3 = fmaf(hi.w, id.z, -oid.z);
        t0 = fmaxf(t0, fminf(a0, b0)); x0 = fminf(x0, fmaxf(a0, b0));
        t1 = fmaxf(t1, fminf(a1, b1)); x1 = fminf(x1, fmaxf(a1, b1));
        t2 = fmaxf(t2, fminf(a2, b2)); x2 = fminf(x2, fmaxf(a2, b2));
        t3 = fmaxf(t3, fminf(a3, b3)); x3 = fminf(x3, fmaxf(a3, b3));

        bool h0 = (t0 <= x0), h1 = (t1 <= x1), h2 = (t2 <= x2), h3 = (t3 <= x3);
        int mask = (h0 ? 1 : 0) | (h1 ? 2 : 0) | (h2 ? 4 : 0) | (h3 ? 8 : 0);
        if (mask == 0) {
            if (!popValidClosest(sp, t_best, cur, s_stack, g_spill)) break;
            continue;
        }

        uint4 ch = *reinterpret_cast<const uint4*>(&ptr[6]);
        uint32_t c0 = ch.x, c1 = ch.y, c2 = ch.z, c3 = ch.w;
        if ((mask & (mask - 1)) == 0) {
            cur = h0 ? c0 : (h1 ? c1 : (h2 ? c2 : c3));
            continue;
        }

        if (!h0) t0 = 1e30f;
        if (!h1) t1 = 1e30f;
        if (!h2) t2 = 1e30f;
        if (!h3) t3 = 1e30f;

        auto cmpSwap = [](float& ta, uint32_t& ca, float& tb, uint32_t& cb) {
            if (ta > tb) {
                float tt = ta; ta = tb; tb = tt;
                uint32_t tc = ca; ca = cb; cb = tc;
            }
        };
        cmpSwap(t0, c0, t2, c2);
        cmpSwap(t1, c1, t3, c3);
        cmpSwap(t0, c0, t1, c1);
        cmpSwap(t2, c2, t3, c3);
        cmpSwap(t1, c1, t2, c2);

        if (t3 <= t_best) pushStack(packStackItem(c3, t3), sp, s_stack, g_spill);
        if (t2 <= t_best) pushStack(packStackItem(c2, t2), sp, s_stack, g_spill);
        pushStack(packStackItem(c1, t1), sp, s_stack, g_spill);
        cur = c0;
    }
}

__device__ inline int traceClosest4(const BVH4Node* __restrict__ nodes, const TriGeom* __restrict__ geom,
                                    uint32_t root_ref, float3 o, float3 d, float& t_best,
                                    uint32_t s_stack[SH_STACK][BLOCK_THREADS], uint32_t* g_spill) {
    t_best = 1e9f;
    int hit_id = -1;
    traceClosest4From(nodes, geom, root_ref, o, d, t_best, hit_id, s_stack, g_spill);
    return hit_id;
}

__device__ inline int traceBlocked4Signed(const BVH4Node* __restrict__ nodes, const TriGeom* __restrict__ geom,
                                          uint32_t root_ref, float3 o, float3 d, float3 id, float3 oid, uint32_t oct,
                                          float limit, uint32_t s_stack[SH_STACK][BLOCK_THREADS], uint32_t* g_spill) {
    if (root_ref & 0x80000000u) {
        return intersectLeafBlocker(root_ref, geom, o, d, limit);
    }

    int sp = 0;
    uint32_t cur = root_ref;
    const uint32_t sx = oct & 1u, sy = (oct >> 1) & 1u, sz = (oct >> 2) & 1u;

    while (true) {
        const float4* ptr = reinterpret_cast<const float4*>(&nodes[cur]);
        float4 lo = sx ? ptr[1] : ptr[0];
        float4 hi = sx ? ptr[0] : ptr[1];
        float t0 = fmaxf(0.0002f, fmaf(lo.x, id.x, -oid.x)), x0 = fminf(limit, fmaf(hi.x, id.x, -oid.x));
        float t1 = fmaxf(0.0002f, fmaf(lo.y, id.x, -oid.x)), x1 = fminf(limit, fmaf(hi.y, id.x, -oid.x));
        float t2 = fmaxf(0.0002f, fmaf(lo.z, id.x, -oid.x)), x2 = fminf(limit, fmaf(hi.z, id.x, -oid.x));
        float t3 = fmaxf(0.0002f, fmaf(lo.w, id.x, -oid.x)), x3 = fminf(limit, fmaf(hi.w, id.x, -oid.x));

        lo = sy ? ptr[3] : ptr[2];
        hi = sy ? ptr[2] : ptr[3];
        t0 = fmaxf(t0, fmaf(lo.x, id.y, -oid.y)); x0 = fminf(x0, fmaf(hi.x, id.y, -oid.y));
        t1 = fmaxf(t1, fmaf(lo.y, id.y, -oid.y)); x1 = fminf(x1, fmaf(hi.y, id.y, -oid.y));
        t2 = fmaxf(t2, fmaf(lo.z, id.y, -oid.y)); x2 = fminf(x2, fmaf(hi.z, id.y, -oid.y));
        t3 = fmaxf(t3, fmaf(lo.w, id.y, -oid.y)); x3 = fminf(x3, fmaf(hi.w, id.y, -oid.y));

        lo = sz ? ptr[5] : ptr[4];
        hi = sz ? ptr[4] : ptr[5];
        t0 = fmaxf(t0, fmaf(lo.x, id.z, -oid.z)); x0 = fminf(x0, fmaf(hi.x, id.z, -oid.z));
        t1 = fmaxf(t1, fmaf(lo.y, id.z, -oid.z)); x1 = fminf(x1, fmaf(hi.y, id.z, -oid.z));
        t2 = fmaxf(t2, fmaf(lo.z, id.z, -oid.z)); x2 = fminf(x2, fmaf(hi.z, id.z, -oid.z));
        t3 = fmaxf(t3, fmaf(lo.w, id.z, -oid.z)); x3 = fminf(x3, fmaf(hi.w, id.z, -oid.z));

        uint4 ch = *reinterpret_cast<const uint4*>(&ptr[6]);
        bool h0 = (t0 <= x0) && (ch.x != 0x7fffffffu);
        bool h1 = (t1 <= x1) && (ch.y != 0x7fffffffu);
        bool h2 = (t2 <= x2) && (ch.z != 0x7fffffffu);
        bool h3 = (t3 <= x3) && (ch.w != 0x7fffffffu);

        if (h0 && (ch.x & 0x80000000u)) { int b = intersectLeafBlocker(ch.x, geom, o, d, limit); if (b >= 0) return b; h0 = false; }
        if (h1 && (ch.y & 0x80000000u)) { int b = intersectLeafBlocker(ch.y, geom, o, d, limit); if (b >= 0) return b; h1 = false; }
        if (h2 && (ch.z & 0x80000000u)) { int b = intersectLeafBlocker(ch.z, geom, o, d, limit); if (b >= 0) return b; h2 = false; }
        if (h3 && (ch.w & 0x80000000u)) { int b = intersectLeafBlocker(ch.w, geom, o, d, limit); if (b >= 0) return b; h3 = false; }

        int mask = (h0 ? 1 : 0) | (h1 ? 2 : 0) | (h2 ? 4 : 0) | (h3 ? 8 : 0);
        if (mask != 0) {
            uint32_t c0 = ch.x, c1 = ch.y, c2 = ch.z, c3 = ch.w;
            if ((mask & (mask - 1)) == 0) {
                cur = h0 ? c0 : (h1 ? c1 : (h2 ? c2 : c3));
                continue;
            }
            if (!h0) t0 = 1e30f;
            if (!h1) t1 = 1e30f;
            if (!h2) t2 = 1e30f;
            if (!h3) t3 = 1e30f;
            auto cmpSwap = [](float& ta, uint32_t& ca, float& tb, uint32_t& cb) {
                if (ta > tb) { float tt = ta; ta = tb; tb = tt; uint32_t tc = ca; ca = cb; cb = tc; }
            };
            cmpSwap(t0, c0, t2, c2);
            cmpSwap(t1, c1, t3, c3);
            cmpSwap(t0, c0, t1, c1);
            cmpSwap(t2, c2, t3, c3);
            cmpSwap(t1, c1, t2, c2);
            if (t3 < 1e29f) pushStack(c3, sp, s_stack, g_spill);
            if (t2 < 1e29f) pushStack(c2, sp, s_stack, g_spill);
            pushStack(c1, sp, s_stack, g_spill);
            cur = c0;
            continue;
        }
        if (sp == 0) break;
        cur = popStack(sp, s_stack, g_spill);
    }
    return -1;
}

struct RenderParams {
    int width, height, spp, ao, max_depth;
    uint32_t seed;
    float ao_radius;
    float inv_width, inv_height, inv_spp;
    float3 eye, u, v, w, unit_light, light_inv_d;
    uint32_t light_neg;
    int tiles4_x, tiles4_y, total_tiles4;
    bool use_tile_cache;
};

__device__ inline float3 computeHitNormal(const TriGeom& tg, float3 rd) {
    float4 f0 = *reinterpret_cast<const float4*>(&tg.v0x);
    float4 f1 = *reinterpret_cast<const float4*>(&tg.e1y);
    float4 f2 = *reinterpret_cast<const float4*>(&tg.e2z);
    float3 e1 = make_float3(f0.w, f1.x, f1.y);
    float3 e2 = make_float3(f1.z, f1.w, f2.x);
    float3 n = unit3(cross3(e1, e2));
    if (dot3(n, rd) > 0.0f) n = make_float3(-n.x, -n.y, -n.z);
    return n;
}

__global__ void __launch_bounds__(BLOCK_THREADS, 8)
kPrimaryHints(RenderParams rp, const BVH4Node* __restrict__ nodes, const TriGeom* __restrict__ geom,
              const TriMat* __restrict__ mat, const uint32_t* __restrict__ root_ref_ptr,
              uint32_t* __restrict__ g_spill, int* __restrict__ hint_tri, int* __restrict__ shadow_hint) {
    __shared__ uint32_t s_stack[SH_STACK][BLOCK_THREADS];
    uint32_t root_ref = *root_ref_ptr;
    int total_px = rp.width * rp.height;
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    int stride = gridDim.x * blockDim.x;
    for (int pixel = tid; pixel < total_px; pixel += stride) {
        int py = pixel / rp.width;
        int px = pixel - py * rp.width;
        float cam_x = (float(px) + 0.5f) * rp.inv_width * 2.0f - 1.0f;
        float cam_y = 1.0f - (float(py) + 0.5f) * rp.inv_height * 2.0f;
        float3 rd = unit3(add3(rp.w, add3(mul3(rp.u, cam_x), mul3(rp.v, cam_y))));
        float hit_t;
        int hit_id = traceClosest4(nodes, geom, root_ref, rp.eye, rd, hit_t, s_stack, g_spill);
        hint_tri[pixel] = hit_id;

        int sh = -1;
        if (hit_id >= 0) {
            TriMat m = mat[hit_id];
            if (m.mirror < 1.0f) {
                float3 n = computeHitNormal(geom[hit_id], rd);
                if (dot3(n, rp.unit_light) > 0.0f) {
                    float3 p = add3(add3(rp.eye, mul3(rd, hit_t)), mul3(n, 0.001f));
                    float3 oid = make_float3(p.x * rp.light_inv_d.x, p.y * rp.light_inv_d.y, p.z * rp.light_inv_d.z);
                    sh = traceBlocked4Signed(nodes, geom, root_ref, p, rp.unit_light, rp.light_inv_d, oid,
                                             rp.light_neg, 1e20f, s_stack, g_spill);
                }
            }
        }
        shadow_hint[pixel] = sh;
    }
}

__device__ inline float3 makeInwardNormal(float3 a, float3 b, float3 center, bool& ok) {
    float3 c = cross3(a, b);
    float l2 = dot3(c, c);
    if (l2 < 1e-24f) { ok = false; return make_float3(0.0f, 0.0f, 0.0f); }
    float3 n = mul3(c, rsqrtf(l2));
    if (dot3(n, center) < 0.0f) n = make_float3(-n.x, -n.y, -n.z);
    return n;
}

__device__ inline bool frustumHitsBox(float lox, float hix, float loy, float hiy, float loz, float hiz,
                                      float3 eye, float3 n0, float3 n1, float3 n2, float3 n3, float3 nF,
                                      float t_max_tile) {
    float lx = lox - eye.x, hx = hix - eye.x;
    float ly = loy - eye.y, hy = hiy - eye.y;
    float lz = loz - eye.z, hz = hiz - eye.z;
    auto testPlane = [&](float3 n) {
        float px = (n.x >= 0.0f) ? hx : lx;
        float py = (n.y >= 0.0f) ? hy : ly;
        float pz = (n.z >= 0.0f) ? hz : lz;
        return (fmaf(px, n.x, fmaf(py, n.y, pz * n.z)) >= -1e-4f);
    };
    if (!testPlane(n0) || !testPlane(n1) || !testPlane(n2) || !testPlane(n3) || !testPlane(nF)) return false;
    if (t_max_tile < 1e8f) {
        float nx = (nF.x >= 0.0f) ? lx : hx;
        float ny = (nF.y >= 0.0f) ? ly : hy;
        float nz = (nF.z >= 0.0f) ? lz : hz;
        if (fmaf(nx, nF.x, fmaf(ny, nF.y, nz * nF.z)) > t_max_tile + 1e-4f) return false;
    }
    return true;
}

__global__ void kBuildTileFrustum(RenderParams rp, const BVH4Node* __restrict__ nodes, const TriGeom* __restrict__ geom,
                                  const uint32_t* __restrict__ root_ref_ptr, const int* __restrict__ hint_tri,
                                  int* __restrict__ tile_mode, uint32_t* __restrict__ tile_entry,
                                  uint32_t* __restrict__ tile_tris) {
    int tile_id = blockIdx.x * blockDim.x + threadIdx.x;
    if (tile_id >= rp.total_tiles4) return;

    uint32_t root_ref = *root_ref_ptr;
    int ty = tile_id / rp.tiles4_x;
    int tx = tile_id - ty * rp.tiles4_x;
    int px0 = tx << 2;
    int py0 = ty << 2;
    int px1 = min(px0 + 4, rp.width);
    int py1 = min(py0 + 4, rp.height);

    float xL = (float(px0) - 0.002f) * rp.inv_width * 2.0f - 1.0f;
    float xR = (float(px1) + 0.002f) * rp.inv_width * 2.0f - 1.0f;
    float yT = 1.0f - (float(py0) - 0.002f) * rp.inv_height * 2.0f;
    float yB = 1.0f - (float(py1) + 0.002f) * rp.inv_height * 2.0f;

    float3 r00 = add3(rp.w, add3(mul3(rp.u, xL), mul3(rp.v, yT)));
    float3 r10 = add3(rp.w, add3(mul3(rp.u, xR), mul3(rp.v, yT)));
    float3 r01 = add3(rp.w, add3(mul3(rp.u, xL), mul3(rp.v, yB)));
    float3 r11 = add3(rp.w, add3(mul3(rp.u, xR), mul3(rp.v, yB)));
    float3 ctr = add3(rp.w, add3(mul3(rp.u, 0.5f * (xL + xR)), mul3(rp.v, 0.5f * (yT + yB))));
    float3 nF = unit3(ctr);

    bool ok = true;
    float3 n0 = makeInwardNormal(r01, r00, ctr, ok);
    float3 n1 = makeInwardNormal(r10, r11, ctr, ok);
    float3 n2 = makeInwardNormal(r00, r10, ctr, ok);
    float3 n3 = makeInwardNormal(r11, r01, ctr, ok);
    if (!ok || dot3(unit3(r00), nF) <= 0.02f || dot3(unit3(r10), nF) <= 0.02f ||
        dot3(unit3(r01), nF) <= 0.02f || dot3(unit3(r11), nF) <= 0.02f) {
        tile_mode[tile_id] = -1;
        tile_entry[tile_id] = root_ref;
        return;
    }

    int uni = -2;
    for (int py = py0; py < py1 && uni != -1; py++) {
        for (int px = px0; px < px1; px++) {
            int h = hint_tri[py * rp.width + px];
            if (h < 0) { uni = -1; break; }
            if (uni == -2) uni = h;
            else if (uni != h) { uni = -1; break; }
        }
    }

    float t_max_tile = 1e9f;
    if (uni >= 0) {
        const TriGeom& tg = geom[uni];
        float3 rs[4] = {r00, r10, r01, r11};
        float max_tau = 0.0f, max_len = 0.0f;
        bool all4 = true;
        for (int c = 0; c < 4; c++) {
            float l = sqrtf(dot3(rs[c], rs[c]));
            float3 d = mul3(rs[c], 1.0f / l);
            float dist;
            if (!intersectTri(tg, rp.eye, d, 1e9f, dist)) { all4 = false; break; }
            max_tau = fmaxf(max_tau, dist / l);
            max_len = fmaxf(max_len, l);
        }
        if (all4) t_max_tile = max_tau * max_len * 1.001f + 1e-4f;
    }

    uint32_t entry = root_ref;
    while (!(entry & 0x80000000u)) {
        const BVH4Node& nd = nodes[entry];
        bool h0 = frustumHitsBox(nd.lox.x, nd.hix.x, nd.loy.x, nd.hiy.x, nd.loz.x, nd.hiz.x, rp.eye, n0, n1, n2, n3, nF, t_max_tile);
        bool h1 = frustumHitsBox(nd.lox.y, nd.hix.y, nd.loy.y, nd.hiy.y, nd.loz.y, nd.hiz.y, rp.eye, n0, n1, n2, n3, nF, t_max_tile);
        bool h2 = frustumHitsBox(nd.lox.z, nd.hix.z, nd.loy.z, nd.hiy.z, nd.loz.z, nd.hiz.z, rp.eye, n0, n1, n2, n3, nF, t_max_tile);
        bool h3 = frustumHitsBox(nd.lox.w, nd.hix.w, nd.loy.w, nd.hiy.w, nd.loz.w, nd.hiz.w, rp.eye, n0, n1, n2, n3, nF, t_max_tile);
        int m = (h0 ? 1 : 0) + (h1 ? 1 : 0) + (h2 ? 1 : 0) + (h3 ? 1 : 0);
        if (m == 0) { tile_mode[tile_id] = 0; return; }
        if (m > 1) break;
        entry = h0 ? nd.child.x : (h1 ? nd.child.y : (h2 ? nd.child.z : nd.child.w));
    }

    uint32_t st[24];
    int sp = 0;
    st[sp++] = entry;
    uint32_t found[MAX_TILE_TRIS];
    int fcnt = 0;
    bool overflow = false;

    while (sp > 0) {
        uint32_t v = st[--sp];
        if (v & 0x80000000u) {
            uint32_t cnt = ((v >> 24) & 0x7fu) + 1u;
            uint32_t start = v & 0x00ffffffu;
            for (uint32_t k = 0; k < cnt; k++) {
                uint32_t tidx = start + k;
                const TriGeom& tg = geom[tidx];
                float3 v0 = make_float3(tg.v0x, tg.v0y, tg.v0z);
                float3 v1 = add3(v0, make_float3(tg.e1x, tg.e1y, tg.e1z));
                float3 v2 = add3(v0, make_float3(tg.e2x, tg.e2y, tg.e2z));
                float lx = fminf(v0.x, fminf(v1.x, v2.x)) - AABB_PAD;
                float hx = fmaxf(v0.x, fmaxf(v1.x, v2.x)) + AABB_PAD;
                float ly = fminf(v0.y, fminf(v1.y, v2.y)) - AABB_PAD;
                float hy = fmaxf(v0.y, fmaxf(v1.y, v2.y)) + AABB_PAD;
                float lz = fminf(v0.z, fminf(v1.z, v2.z)) - AABB_PAD;
                float hz = fmaxf(v0.z, fmaxf(v1.z, v2.z)) + AABB_PAD;
                if (frustumHitsBox(lx, hx, ly, hy, lz, hz, rp.eye, n0, n1, n2, n3, nF, t_max_tile)) {
                    if (fcnt >= MAX_TILE_TRIS) { overflow = true; break; }
                    found[fcnt++] = tidx;
                }
            }
            if (overflow) break;
        } else {
            const BVH4Node& nd = nodes[v];
            bool h0 = frustumHitsBox(nd.lox.x, nd.hix.x, nd.loy.x, nd.hiy.x, nd.loz.x, nd.hiz.x, rp.eye, n0, n1, n2, n3, nF, t_max_tile);
            bool h1 = frustumHitsBox(nd.lox.y, nd.hix.y, nd.loy.y, nd.hiy.y, nd.loz.y, nd.hiz.y, rp.eye, n0, n1, n2, n3, nF, t_max_tile);
            bool h2 = frustumHitsBox(nd.lox.z, nd.hix.z, nd.loy.z, nd.hiy.z, nd.loz.z, nd.hiz.z, rp.eye, n0, n1, n2, n3, nF, t_max_tile);
            bool h3 = frustumHitsBox(nd.lox.w, nd.hix.w, nd.loy.w, nd.hiy.w, nd.loz.w, nd.hiz.w, rp.eye, n0, n1, n2, n3, nF, t_max_tile);
            int push_n = (h0 ? 1 : 0) + (h1 ? 1 : 0) + (h2 ? 1 : 0) + (h3 ? 1 : 0);
            if (sp + push_n > 24) { overflow = true; break; }
            if (h0) st[sp++] = nd.child.x;
            if (h1) st[sp++] = nd.child.y;
            if (h2) st[sp++] = nd.child.z;
            if (h3) st[sp++] = nd.child.w;
        }
    }

    if (!overflow) {
        tile_mode[tile_id] = fcnt;
        for (int k = 0; k < fcnt; k++) {
            tile_tris[tile_id * MAX_TILE_TRIS + k] = found[k];
        }
    } else {
        tile_mode[tile_id] = -1;
        tile_entry[tile_id] = entry;
    }
}

__device__ inline void warpReducePixelAdd(int pixel, float rx, float ry, float rz, float* __restrict__ out) {
    int lane = threadIdx.x & 31;
    int prev_px = __shfl_up_sync(0xffffffff, pixel, 1);
    bool is_head = (lane == 0) || (prev_px != pixel);
    uint32_t heads = __ballot_sync(0xffffffff, is_head);
    uint32_t prefix_mask = 0xffffffffu >> (31 - lane);
    int seg_id = 31 - __clz(heads & prefix_mask);
    bool is_tail = (lane == 31) || ((heads >> (lane + 1)) & 1u);

    #pragma unroll
    for (int off = 1; off <= 16; off <<= 1) {
        float ox = __shfl_up_sync(0xffffffff, rx, off);
        float oy = __shfl_up_sync(0xffffffff, ry, off);
        float oz = __shfl_up_sync(0xffffffff, rz, off);
        int o_seg = __shfl_up_sync(0xffffffff, seg_id, off);
        if (lane >= off && o_seg == seg_id) {
            rx += ox;
            ry += oy;
            rz += oz;
        }
    }

    if (pixel >= 0 && is_tail && (rx != 0.0f || ry != 0.0f || rz != 0.0f)) {
        atomicAdd(&out[3 * pixel + 0], rx);
        atomicAdd(&out[3 * pixel + 1], ry);
        atomicAdd(&out[3 * pixel + 2], rz);
    }
}

__device__ inline float3 sampleAOHeli(float3 n, uint32_t akey) {
    float3 axis = (fabsf(n.z) < 0.8f) ? make_float3(0.0f, 0.0f, 1.0f) : make_float3(0.0f, 1.0f, 0.0f);
    float3 tx_v = unit3(cross3(axis, n));
    float3 ty_v = cross3(n, tx_v);
    float ax = 2.0f * sample<float>(akey ^ 0x68bc21ebu) - 1.0f;
    float ay = 2.0f * sample<float>(akey ^ 0x02e5be93u) - 1.0f;
    float az = 0.25f + 0.75f * sample<float>(akey ^ 0x967a889bu);
    return unit3(add3(mul3(tx_v, ax), add3(mul3(ty_v, ay), mul3(n, az))));
}

__device__ inline void decodePrimaryRay(const RenderParams& rp, long long tid,
                                        int& pixel, int& sid, float3& rd) {
    long long p_tile_idx = tid / rp.spp;
    sid = int(tid - p_tile_idx * rp.spp);
    int t4_id = int(p_tile_idx >> 4);
    int lp = int(p_tile_idx & 15);
    int ty4 = t4_id / rp.tiles4_x;
    int tx4 = t4_id - ty4 * rp.tiles4_x;
    int px = (tx4 << 2) + (lp & 3);
    int py = (ty4 << 2) + (lp >> 2);
    if (px < rp.width && py < rp.height) {
        pixel = py * rp.width + px;
        uint32_t key = rp.seed + uint32_t(pixel) * 0x9e3779b9u + uint32_t(sid) * 0x85ebca6bu;
        float cam_x = (float(px) + sample<float>(key)) * rp.inv_width * 2.0f - 1.0f;
        float cam_y = 1.0f - (float(py) + sample<float>(key ^ 0xa511e9b3u)) * rp.inv_height * 2.0f;
        rd = unit3(add3(rp.w, add3(mul3(rp.u, cam_x), mul3(rp.v, cam_y))));
    } else {
        pixel = -1;
        rd = make_float3(0.0f, 0.0f, 1.0f);
    }
}

__global__ void __launch_bounds__(BLOCK_THREADS, 10)
kPrimaryTrace(RenderParams rp, const BVH4Node* __restrict__ nodes, const TriGeom* __restrict__ geom,
              const TriMat* __restrict__ mat, const uint32_t* __restrict__ root_ref_ptr,
              const int* __restrict__ hint_tri, const int* __restrict__ tile_mode,
              const uint32_t* __restrict__ tile_entry, const uint32_t* __restrict__ tile_tris,
              uint32_t* __restrict__ g_spill, float* __restrict__ hit_ts, int* __restrict__ hit_ids,
              uint32_t* __restrict__ warp_diff_mask, uint32_t* __restrict__ warp_bounce_mask,
              long long chunk_off, int chunk_len, float* __restrict__ out) {
    __shared__ uint32_t s_stack[SH_STACK][BLOCK_THREADS];
    int local_idx = blockIdx.x * blockDim.x + threadIdx.x;
    int lane = threadIdx.x & 31;
    int warp_id = (blockIdx.x * 4) + (threadIdx.x >> 5);
    int n_warps = (chunk_len + 31) >> 5;
    uint32_t root_ref = *root_ref_ptr;

    int pixel = -1;
    int hit_id = -1;
    float hit_t = 1e9f;
    float sky_r = 0.0f, sky_g = 0.0f, sky_b = 0.0f;
    bool need_diff = false;
    bool need_bounce = false;
    bool sky_hit = false;

    if (local_idx < chunk_len) {
        long long tid = chunk_off + (long long)local_idx;
        long long p_tile_idx = tid / rp.spp;
        int sid = int(tid - p_tile_idx * rp.spp);
        int t4_id = int(p_tile_idx >> 4);
        int lp = int(p_tile_idx & 15);
        int ty4 = t4_id / rp.tiles4_x;
        int tx4 = t4_id - ty4 * rp.tiles4_x;
        int px = (tx4 << 2) + (lp & 3);
        int py = (ty4 << 2) + (lp >> 2);

        if (px < rp.width && py < rp.height) {
            pixel = py * rp.width + px;
            uint32_t key = rp.seed + uint32_t(pixel) * 0x9e3779b9u + uint32_t(sid) * 0x85ebca6bu;
            float cam_x = (float(px) + sample<float>(key)) * rp.inv_width * 2.0f - 1.0f;
            float cam_y = 1.0f - (float(py) + sample<float>(key ^ 0xa511e9b3u)) * rp.inv_height * 2.0f;
            float3 rd = unit3(add3(rp.w, add3(mul3(rp.u, cam_x), mul3(rp.v, cam_y))));

            if (rp.use_tile_cache) {
                int mode = tile_mode[t4_id];
                if (mode > 0) {
                    int base_tri = t4_id * MAX_TILE_TRIS;
                    for (int k = 0; k < mode; k++) {
                        uint32_t tidx = tile_tris[base_tri + k];
                        float dist;
                        if (intersectTri(geom[tidx], rp.eye, rd, hit_t, dist)) {
                            hit_t = dist;
                            hit_id = int(tidx);
                        }
                    }
                } else if (mode < 0) {
                    int htri = hint_tri[pixel];
                    if (htri >= 0) {
                        float dist;
                        if (intersectTri(geom[htri], rp.eye, rd, hit_t, dist)) {
                            hit_t = dist;
                            hit_id = htri;
                        }
                    }
                    traceClosest4From(nodes, geom, tile_entry[t4_id], rp.eye, rd, hit_t, hit_id, s_stack, g_spill);
                }
            } else {
                hit_id = traceClosest4(nodes, geom, root_ref, rp.eye, rd, hit_t, s_stack, g_spill);
            }

            if (hit_id < 0) {
                sky_hit = true;
                float a = 0.5f * (rd.y + 1.0f);
                sky_r = rp.inv_spp * fmaf(0.40f - 0.95f, a, 0.95f);
                sky_g = rp.inv_spp * fmaf(0.55f - 0.93f, a, 0.93f);
                sky_b = rp.inv_spp * fmaf(0.85f - 0.95f, a, 0.95f);
            } else {
                float mir = mat[hit_id].mirror;
                need_diff = (mir < 1.0f);
                need_bounce = (mir > 0.0f) && (1 < rp.max_depth);
            }
        }
        hit_ids[local_idx] = hit_id;
        hit_ts[local_idx] = hit_t;
    }

    if (__any_sync(0xffffffff, sky_hit)) {
        warpReducePixelAdd(sky_hit ? pixel : -1, sky_r, sky_g, sky_b, out);
    }

    uint32_t dm = __ballot_sync(0xffffffff, need_diff);
    uint32_t bm = __ballot_sync(0xffffffff, need_bounce);
    if (lane == 0 && warp_id < n_warps) {
        warp_diff_mask[warp_id] = dm;
        warp_bounce_mask[warp_id] = bm;
    }
}

__global__ void __launch_bounds__(BLOCK_THREADS, 8)
kBounceTrace(RenderParams rp, int depth, const BVH4Node* __restrict__ nodes, const TriGeom* __restrict__ geom,
             const TriMat* __restrict__ mat, const uint32_t* __restrict__ root_ref_ptr,
             const BounceItem* __restrict__ bounce_in_q, const int* __restrict__ bounce_in_cnt_ptr,
             uint32_t* __restrict__ g_spill, float* __restrict__ hit_ts, int* __restrict__ hit_ids,
             uint32_t* __restrict__ warp_diff_mask, uint32_t* __restrict__ warp_bounce_mask, float* __restrict__ out) {
    int n_rays = *bounce_in_cnt_ptr;
    int local_idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (blockIdx.x * blockDim.x >= n_rays) return;

    __shared__ uint32_t s_stack[SH_STACK][BLOCK_THREADS];
    int lane = threadIdx.x & 31;
    int warp_id = (blockIdx.x * 4) + (threadIdx.x >> 5);
    int n_warps = (n_rays + 31) >> 5;
    uint32_t root_ref = *root_ref_ptr;

    int pixel = -1;
    int hit_id = -1;
    float hit_t = 1e9f;
    float sky_r = 0.0f, sky_g = 0.0f, sky_b = 0.0f;
    bool need_diff = false;
    bool need_bounce = false;
    bool sky_hit = false;

    if (local_idx < n_rays) {
        BounceItem bi = bounce_in_q[local_idx];
        uint32_t ps = __float_as_uint(bi.o_ps.w);
        pixel = int(ps >> 9);
        float3 ro = make_float3(bi.o_ps.x, bi.o_ps.y, bi.o_ps.z);
        float3 rd = make_float3(bi.d_thr.x, bi.d_thr.y, bi.d_thr.z);
        float through = bi.d_thr.w;

        hit_id = traceClosest4(nodes, geom, root_ref, ro, rd, hit_t, s_stack, g_spill);
        if (hit_id < 0) {
            sky_hit = true;
            float a = 0.5f * (rd.y + 1.0f);
            float w = through * rp.inv_spp;
            sky_r = w * fmaf(0.40f - 0.95f, a, 0.95f);
            sky_g = w * fmaf(0.55f - 0.93f, a, 0.93f);
            sky_b = w * fmaf(0.85f - 0.95f, a, 0.95f);
        } else {
            float mir = mat[hit_id].mirror;
            need_diff = (mir < 1.0f);
            need_bounce = (mir > 0.0f) && (depth + 1 < rp.max_depth);
        }
        hit_ids[local_idx] = hit_id;
        hit_ts[local_idx] = hit_t;
    }

    if (__any_sync(0xffffffff, sky_hit)) {
        warpReducePixelAdd(sky_hit ? pixel : -1, sky_r, sky_g, sky_b, out);
    }

    uint32_t dm = __ballot_sync(0xffffffff, need_diff);
    uint32_t bm = __ballot_sync(0xffffffff, need_bounce);
    if (lane == 0 && warp_id < n_warps) {
        warp_diff_mask[warp_id] = dm;
        warp_bounce_mask[warp_id] = bm;
    }
}

__global__ void kPackCount(const uint32_t* __restrict__ warp_diff_mask,
                           const uint32_t* __restrict__ warp_bounce_mask,
                           const int* __restrict__ n_rays_ptr, int n_rays_fixed,
                           int* __restrict__ warp_diff_off, int* __restrict__ warp_bnc_off,
                           int* __restrict__ pack_blk) {
    static_assert(NUM_WARPS_MAX == 128 * 256, "Adjust pack block count");
    int n_rays = (n_rays_ptr != nullptr) ? *n_rays_ptr : n_rays_fixed;
    int n_warps = (n_rays > 0) ? ((n_rays + 31) >> 5) : 0;
    int base_w = blockIdx.x * 256;
    if (base_w >= n_warps) {
        if (threadIdx.x == 0) {
            pack_blk[blockIdx.x] = 0;
            pack_blk[128 + blockIdx.x] = 0;
        }
        return;
    }

    int w = base_w + threadIdx.x;
    uint32_t dm = (w < n_warps) ? warp_diff_mask[w] : 0u;
    uint32_t bm = (w < n_warps) ? warp_bounce_mask[w] : 0u;
    int dc = __popc(dm);
    int bc = __popc(bm);

    typedef cub::BlockScan<int, 256> BlockScan;
    __shared__ typename BlockScan::TempStorage ts_diff;
    __shared__ typename BlockScan::TempStorage ts_bnc;

    int doff, dblk, boff, bblk;
    BlockScan(ts_diff).ExclusiveSum(dc, doff, dblk);
    BlockScan(ts_bnc).ExclusiveSum(bc, boff, bblk);

    if (w < n_warps) {
        warp_diff_off[w] = doff;
        warp_bnc_off[w] = boff;
    }
    if (threadIdx.x == 0) {
        pack_blk[blockIdx.x] = dblk;
        pack_blk[128 + blockIdx.x] = bblk;
    }
}

__global__ void kPackScanBlocks(int out_bounce_idx, int* __restrict__ pack_blk, int* __restrict__ counters) {
    int tid = threadIdx.x;
    int dval = pack_blk[tid];
    int bval = pack_blk[128 + tid];

    typedef cub::BlockScan<int, 128> BlockScan;
    __shared__ typename BlockScan::TempStorage ts_diff;
    __shared__ typename BlockScan::TempStorage ts_bnc;

    int doff, dtot, boff, btot;
    BlockScan(ts_diff).ExclusiveSum(dval, doff, dtot);
    BlockScan(ts_bnc).ExclusiveSum(bval, boff, btot);

    pack_blk[256 + tid] = doff;
    pack_blk[384 + tid] = boff;

    if (tid == 0) {
        counters[3] = dtot;
        counters[out_bounce_idx] = btot;
        counters[6] = 0;
        counters[7] = 0;
        counters[8] = 0;
    }
}

__global__ void kPackScatter(const uint32_t* __restrict__ warp_diff_mask,
                             const uint32_t* __restrict__ warp_bounce_mask,
                             const int* __restrict__ warp_diff_off,
                             const int* __restrict__ warp_bnc_off,
                             const int* __restrict__ pack_blk,
                             const int* __restrict__ n_rays_ptr, int n_rays_fixed,
                             int* __restrict__ diff_rays, int* __restrict__ bounce_src) {
    int n_rays = (n_rays_ptr != nullptr) ? *n_rays_ptr : n_rays_fixed;
    int n_warps = (n_rays > 0) ? ((n_rays + 31) >> 5) : 0;
    int w = (blockIdx.x * blockDim.x + threadIdx.x) >> 5;
    if (w >= n_warps) return;

    int lane = threadIdx.x & 31;
    int blk_idx = w >> 8;
    int ray_idx = (w << 5) + lane;
    uint32_t lane_mask = (1u << lane) - 1u;

    uint32_t dm = warp_diff_mask[w];
    if (dm && ((dm >> lane) & 1u)) {
        int pos = pack_blk[256 + blk_idx] + warp_diff_off[w] + __popc(dm & lane_mask);
        diff_rays[pos] = ray_idx;
    }

    uint32_t bm = warp_bounce_mask[w];
    if (bm && ((bm >> lane) & 1u)) {
        int pos = pack_blk[384 + blk_idx] + warp_bnc_off[w] + __popc(bm & lane_mask);
        bounce_src[pos] = ray_idx;
    }
}

__global__ void __launch_bounds__(BLOCK_THREADS, 10)
kBuildBounceItems(RenderParams rp, int depth, const TriGeom* __restrict__ geom, const TriMat* __restrict__ mat,
                  const int* __restrict__ bounce_src, const int* __restrict__ bnc_cnt_ptr,
                  const float* __restrict__ hit_ts, const int* __restrict__ hit_ids,
                  const BounceItem* __restrict__ bounce_in_q, BounceItem* __restrict__ bounce_out_q,
                  long long chunk_off) {
    int total = *bnc_cnt_ptr;
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= total) return;

    int src = bounce_src[idx];
    int hit_id = hit_ids[src];
    float hit_t = hit_ts[src];
    int pixel, sid;
    float3 ro, rd;
    float through = 1.0f;

    if (depth == 0) {
        decodePrimaryRay(rp, chunk_off + (long long)src, pixel, sid, rd);
        ro = rp.eye;
    } else {
        BounceItem bi = bounce_in_q[src];
        uint32_t ps = __float_as_uint(bi.o_ps.w);
        pixel = int(ps >> 9);
        sid = int(ps & 511u);
        ro = make_float3(bi.o_ps.x, bi.o_ps.y, bi.o_ps.z);
        rd = make_float3(bi.d_thr.x, bi.d_thr.y, bi.d_thr.z);
        through = bi.d_thr.w;
    }

    float3 n = computeHitNormal(geom[hit_id], rd);
    float3 p = add3(add3(ro, mul3(rd, hit_t)), mul3(n, 0.001f));
    float3 dir_refl = unit3(sub3(rd, mul3(n, 2.0f * dot3(rd, n))));
    float mir = mat[hit_id].mirror;

    BounceItem out_item;
    out_item.o_ps = make_float4(p.x, p.y, p.z, __uint_as_float((uint32_t(pixel) << 9) | uint32_t(sid)));
    out_item.d_thr = make_float4(dir_refl.x, dir_refl.y, dir_refl.z, through * mir);
    bounce_out_q[idx] = out_item;
}

__global__ void __launch_bounds__(BLOCK_THREADS, 8)
kShadeAndShadow(RenderParams rp, int depth, const BVH4Node* __restrict__ nodes, const TriGeom* __restrict__ geom,
                const TriMat* __restrict__ mat, const uint32_t* __restrict__ root_ref_ptr,
                const int* __restrict__ diff_rays, const float* __restrict__ hit_ts, const int* __restrict__ hit_ids,
                const BounceItem* __restrict__ bounce_in_q, const int* __restrict__ shadow_hint,
                int* __restrict__ counters, uint32_t* __restrict__ g_spill, long long chunk_off, float* __restrict__ out) {
    int total = counters[3];
    if (total <= 0) return;

    __shared__ uint32_t s_stack[SH_STACK][BLOCK_THREADS];
    __shared__ uint32_t s_beam[4][48];
    int wid = threadIdx.x >> 5;
    int lane = threadIdx.x & 31;
    uint32_t root_ref = *root_ref_ptr;
    const uint32_t sx = rp.light_neg & 1u, sy = (rp.light_neg >> 1) & 1u, sz = (rp.light_neg >> 2) & 1u;

    while (true) {
        int base = 0;
        if (lane == 0) base = atomicAdd(&counters[6], 32);
        base = __shfl_sync(0xffffffff, base, 0);
        if (base >= total) break;

        int i = base + lane;
        int pixel = -1;
        float br = 0.0f, bg = 0.0f, bb = 0.0f;
        float sr = 0.0f, sg = 0.0f, sb = 0.0f;
        float3 p = make_float3(0.0f, 0.0f, 0.0f);
        bool need_shadow = false;

        if (i < total) {
            int src = diff_rays[i];
            int hit_id = hit_ids[src];
            float hit_t = hit_ts[src];
            int sid = 0;
            float3 ro, rd;
            float through = 1.0f;

            if (depth == 0) {
                decodePrimaryRay(rp, chunk_off + (long long)src, pixel, sid, rd);
                ro = rp.eye;
            } else {
                BounceItem bi = bounce_in_q[src];
                uint32_t ps = __float_as_uint(bi.o_ps.w);
                pixel = int(ps >> 9);
                sid = int(ps & 511u);
                ro = make_float3(bi.o_ps.x, bi.o_ps.y, bi.o_ps.z);
                rd = make_float3(bi.d_thr.x, bi.d_thr.y, bi.d_thr.z);
                through = bi.d_thr.w;
            }

            float3 n = computeHitNormal(geom[hit_id], rd);
            p = add3(add3(ro, mul3(rd, hit_t)), mul3(n, 0.001f));
            TriMat m = mat[hit_id];
            float w_base = through * (1.0f - m.mirror) * rp.inv_spp;
            float c_base = w_base * (0.08f + (rp.ao == 0 ? 0.20f : 0.0f));
            br = c_base * m.r;
            bg = c_base * m.g;
            bb = c_base * m.b;

            float cosine = fmaxf(0.0f, dot3(n, rp.unit_light));
            if (cosine > 0.0f) {
                float cs = w_base * (0.72f * cosine);
                sr = cs * m.r; sg = cs * m.g; sb = cs * m.b;
                need_shadow = true;
                if (shadow_hint != nullptr) {
                    int sh = shadow_hint[pixel];
                    if (sh >= 0) {
                        float dist;
                        if (intersectTri(geom[sh], p, rp.unit_light, 1e20f, dist)) need_shadow = false;
                    }
                }
            }
        }

        bool blocked = !need_shadow;
        if (__ballot_sync(0xffffffff, need_shadow)) {
            float3 plo = need_shadow ? p : make_float3(1e30f, 1e30f, 1e30f);
            float3 phi = need_shadow ? p : make_float3(-1e30f, -1e30f, -1e30f);
            #pragma unroll
            for (int off = 16; off >= 1; off >>= 1) {
                plo.x = fminf(plo.x, __shfl_xor_sync(0xffffffff, plo.x, off));
                plo.y = fminf(plo.y, __shfl_xor_sync(0xffffffff, plo.y, off));
                plo.z = fminf(plo.z, __shfl_xor_sync(0xffffffff, plo.z, off));
                phi.x = fmaxf(phi.x, __shfl_xor_sync(0xffffffff, phi.x, off));
                phi.y = fmaxf(phi.y, __shfl_xor_sync(0xffffffff, phi.y, off));
                phi.z = fmaxf(phi.z, __shfl_xor_sync(0xffffffff, phi.z, off));
            }

            float span = fmaxf(phi.x - plo.x, fmaxf(phi.y - plo.y, phi.z - plo.z));
            bool beam_overflow = false;
            if (span <= 0.45f) {
                float3 blo = make_float3(plo.x - 1e-4f, plo.y - 1e-4f, plo.z - 1e-4f);
                float3 bhi = make_float3(phi.x + 1e-4f, phi.y + 1e-4f, phi.z + 1e-4f);
                float px_lo = sx ? blo.x : bhi.x, px_hi = sx ? bhi.x : blo.x;
                float py_lo = sy ? blo.y : bhi.y, py_hi = sy ? bhi.y : blo.y;
                float pz_lo = sz ? blo.z : bhi.z, pz_hi = sz ? bhi.z : blo.z;

                uint32_t cur = root_ref;
                int sp = 0;
                while (true) {
                    if (cur & 0x80000000u) {
                        if (need_shadow) {
                            if (intersectLeafBlocker(cur, geom, p, rp.unit_light, 1e20f) >= 0) {
                                need_shadow = false;
                                blocked = true;
                            }
                        }
                        if (__ballot_sync(0xffffffff, need_shadow) == 0) break;
                        if (sp == 0) break;
                        --sp;
                        uint32_t nc = (lane == 0) ? s_beam[wid][sp] : 0u;
                        cur = __shfl_sync(0xffffffff, nc, 0);
                        continue;
                    }

                    const float4* ptr = reinterpret_cast<const float4*>(&nodes[cur]);
                    float4 lo = sx ? ptr[1] : ptr[0], hi = sx ? ptr[0] : ptr[1];
                    float t0 = fmaxf(0.0002f, (lo.x - px_lo) * rp.light_inv_d.x), x0 = fminf(1e20f, (hi.x - px_hi) * rp.light_inv_d.x);
                    float t1 = fmaxf(0.0002f, (lo.y - px_lo) * rp.light_inv_d.x), x1 = fminf(1e20f, (hi.y - px_hi) * rp.light_inv_d.x);
                    float t2 = fmaxf(0.0002f, (lo.z - px_lo) * rp.light_inv_d.x), x2 = fminf(1e20f, (hi.z - px_hi) * rp.light_inv_d.x);
                    float t3 = fmaxf(0.0002f, (lo.w - px_lo) * rp.light_inv_d.x), x3 = fminf(1e20f, (hi.w - px_hi) * rp.light_inv_d.x);

                    lo = sy ? ptr[3] : ptr[2]; hi = sy ? ptr[2] : ptr[3];
                    t0 = fmaxf(t0, (lo.x - py_lo) * rp.light_inv_d.y); x0 = fminf(x0, (hi.x - py_hi) * rp.light_inv_d.y);
                    t1 = fmaxf(t1, (lo.y - py_lo) * rp.light_inv_d.y); x1 = fminf(x1, (hi.y - py_hi) * rp.light_inv_d.y);
                    t2 = fmaxf(t2, (lo.z - py_lo) * rp.light_inv_d.y); x2 = fminf(x2, (hi.z - py_hi) * rp.light_inv_d.y);
                    t3 = fmaxf(t3, (lo.w - py_lo) * rp.light_inv_d.y); x3 = fminf(x3, (hi.w - py_hi) * rp.light_inv_d.y);

                    lo = sz ? ptr[5] : ptr[4]; hi = sz ? ptr[4] : ptr[5];
                    t0 = fmaxf(t0, (lo.x - pz_lo) * rp.light_inv_d.z); x0 = fminf(x0, (hi.x - pz_hi) * rp.light_inv_d.z);
                    t1 = fmaxf(t1, (lo.y - pz_lo) * rp.light_inv_d.z); x1 = fminf(x1, (hi.y - pz_hi) * rp.light_inv_d.z);
                    t2 = fmaxf(t2, (lo.z - pz_lo) * rp.light_inv_d.z); x2 = fminf(x2, (hi.z - pz_hi) * rp.light_inv_d.z);
                    t3 = fmaxf(t3, (lo.w - pz_lo) * rp.light_inv_d.z); x3 = fminf(x3, (hi.w - pz_hi) * rp.light_inv_d.z);

                    uint4 ch = *reinterpret_cast<const uint4*>(&ptr[6]);
                    bool h0 = (t0 <= x0) && (ch.x != 0x7fffffffu);
                    bool h1 = (t1 <= x1) && (ch.y != 0x7fffffffu);
                    bool h2 = (t2 <= x2) && (ch.z != 0x7fffffffu);
                    bool h3 = (t3 <= x3) && (ch.w != 0x7fffffffu);
                    int mask = (h0 ? 1 : 0) | (h1 ? 2 : 0) | (h2 ? 4 : 0) | (h3 ? 8 : 0);

                    if (mask == 0) {
                        if (sp == 0) break;
                        --sp;
                        uint32_t nc = (lane == 0) ? s_beam[wid][sp] : 0u;
                        cur = __shfl_sync(0xffffffff, nc, 0);
                        continue;
                    }
                    uint32_t c0 = ch.x, c1 = ch.y, c2 = ch.z, c3 = ch.w;
                    if ((mask & (mask - 1)) == 0) {
                        cur = h0 ? c0 : (h1 ? c1 : (h2 ? c2 : c3));
                        continue;
                    }
                    if (!h0) t0 = 1e30f;
                    if (!h1) t1 = 1e30f;
                    if (!h2) t2 = 1e30f;
                    if (!h3) t3 = 1e30f;
                    auto cmpSwap = [](float& ta, uint32_t& ca, float& tb, uint32_t& cb) {
                        if (ta > tb) { float tt = ta; ta = tb; tb = tt; uint32_t tc = ca; ca = cb; cb = tc; }
                    };
                    cmpSwap(t0, c0, t2, c2);
                    cmpSwap(t1, c1, t3, c3);
                    cmpSwap(t0, c0, t1, c1);
                    cmpSwap(t2, c2, t3, c3);
                    cmpSwap(t1, c1, t2, c2);

                    int push_cnt = (t1 < 1e29f ? 1 : 0) + (t2 < 1e29f ? 1 : 0) + (t3 < 1e29f ? 1 : 0);
                    if (sp + push_cnt >= 48) { beam_overflow = true; break; }
                    if (t3 < 1e29f) { if (lane == 0) s_beam[wid][sp] = c3; sp++; }
                    if (t2 < 1e29f) { if (lane == 0) s_beam[wid][sp] = c2; sp++; }
                    if (t1 < 1e29f) { if (lane == 0) s_beam[wid][sp] = c1; sp++; }
                    cur = c0;
                }
            }

            if ((span > 0.45f || beam_overflow) && need_shadow) {
                float3 oid = make_float3(p.x * rp.light_inv_d.x, p.y * rp.light_inv_d.y, p.z * rp.light_inv_d.z);
                if (traceBlocked4Signed(nodes, geom, root_ref, p, rp.unit_light, rp.light_inv_d, oid,
                                        rp.light_neg, 1e20f, s_stack, g_spill) >= 0) {
                    blocked = true;
                }
            }
        }

        if (pixel >= 0) {
            if (!blocked) { br += sr; bg += sg; bb += sb; }
        }
        warpReducePixelAdd(pixel, br, bg, bb, out);
    }
}

__global__ void __launch_bounds__(BLOCK_THREADS, 6)
kAOTrace(RenderParams rp, int depth, const BVH4Node* __restrict__ nodes, const TriGeom* __restrict__ geom,
         const TriMat* __restrict__ mat, const uint32_t* __restrict__ root_ref_ptr,
         const int* __restrict__ diff_rays, const float* __restrict__ hit_ts, const int* __restrict__ hit_ids,
         const BounceItem* __restrict__ bounce_in_q, int* __restrict__ counters, uint32_t* __restrict__ g_spill,
         long long chunk_off, float* __restrict__ out) {
    int n_diff = counters[3];
    if (n_diff <= 0 || rp.ao <= 0) return;

    __shared__ uint32_t s_stack[SH_STACK][BLOCK_THREADS];
    int lane = threadIdx.x & 31;
    uint32_t low_mask = (lane == 0) ? 0u : (0xffffffffu >> (32 - lane));
    uint32_t root_ref = *root_ref_ptr;
    long long total_ao = (rp.ao == 1) ? (long long)n_diff : ((long long)n_diff * rp.ao);

    bool active = false;
    uint32_t cur = 0;
    int sp = 0;
    float3 o = make_float3(0.0f, 0.0f, 0.0f);
    float3 d = make_float3(0.0f, 0.0f, 1.0f);
    float3 id = make_float3(1.0f, 1.0f, 1.0f);
    float3 oid = make_float3(0.0f, 0.0f, 0.0f);
    int out_px = -1;
    float ar = 0.0f, ag = 0.0f, ab = 0.0f;

    while (true) {
        uint32_t alive_mask = __ballot_sync(0xffffffff, active);
        int alive_cnt = __popc(alive_mask);
        if (alive_cnt <= 22) {
            uint32_t dead_mask = ~alive_mask;
            int need = 32 - alive_cnt;
            int ldr = __ffs(dead_mask) - 1;
            int fetch_base = 0;
            if (lane == ldr) fetch_base = atomicAdd(&counters[7], need);
            fetch_base = __shfl_sync(0xffffffff, fetch_base, ldr);
            int my_slot = fetch_base + __popc(dead_mask & low_mask);
            bool got_new = (!active) && ((long long)my_slot < total_ao);

            float3 new_o = make_float3(0.0f, 0.0f, 0.0f);
            float3 new_d = make_float3(0.0f, 0.0f, 1.0f);
            int new_px = -1;
            float new_ar = 0.0f, new_ag = 0.0f, new_ab = 0.0f;

            if (got_new) {
                int ray_i = (rp.ao == 1) ? my_slot : (my_slot / rp.ao);
                int a = (rp.ao == 1) ? 0 : (my_slot - ray_i * rp.ao);
                int src = diff_rays[ray_i];
                int hit_id = hit_ids[src];
                float hit_t = hit_ts[src];
                int sid = 0;
                float3 ro, rd;
                float through = 1.0f;

                if (depth == 0) {
                    decodePrimaryRay(rp, chunk_off + (long long)src, new_px, sid, rd);
                    ro = rp.eye;
                } else {
                    BounceItem bi = bounce_in_q[src];
                    uint32_t ps = __float_as_uint(bi.o_ps.w);
                    new_px = int(ps >> 9);
                    sid = int(ps & 511u);
                    ro = make_float3(bi.o_ps.x, bi.o_ps.y, bi.o_ps.z);
                    rd = make_float3(bi.d_thr.x, bi.d_thr.y, bi.d_thr.z);
                    through = bi.d_thr.w;
                }

                float3 n = computeHitNormal(geom[hit_id], rd);
                new_o = add3(add3(ro, mul3(rd, hit_t)), mul3(n, 0.001f));
                TriMat m = mat[hit_id];
                float ca = through * (1.0f - m.mirror) * rp.inv_spp * (0.20f / float(rp.ao));
                new_ar = ca * m.r; new_ag = ca * m.g; new_ab = ca * m.b;
                uint32_t base_key = rp.seed + uint32_t(new_px) * 0x9e3779b9u + uint32_t(sid) * 0x85ebca6bu + uint32_t(depth) * 0xc2b2ae35u;
                new_d = sampleAOHeli(n, base_key + uint32_t(a) * 0x27d4eb2du);
            }

            if (__ballot_sync(0xffffffff, got_new)) {
                float3 r_end = add3(new_o, mul3(new_d, rp.ao_radius));
                float3 qlo = got_new ? make_float3(fminf(new_o.x, r_end.x) - 1e-4f, fminf(new_o.y, r_end.y) - 1e-4f, fminf(new_o.z, r_end.z) - 1e-4f)
                                     : make_float3(1e30f, 1e30f, 1e30f);
                float3 qhi = got_new ? make_float3(fmaxf(new_o.x, r_end.x) + 1e-4f, fmaxf(new_o.y, r_end.y) + 1e-4f, fmaxf(new_o.z, r_end.z) + 1e-4f)
                                     : make_float3(-1e30f, -1e30f, -1e30f);
                #pragma unroll
                for (int off = 16; off >= 1; off >>= 1) {
                    qlo.x = fminf(qlo.x, __shfl_xor_sync(0xffffffff, qlo.x, off));
                    qlo.y = fminf(qlo.y, __shfl_xor_sync(0xffffffff, qlo.y, off));
                    qlo.z = fminf(qlo.z, __shfl_xor_sync(0xffffffff, qlo.z, off));
                    qhi.x = fmaxf(qhi.x, __shfl_xor_sync(0xffffffff, qhi.x, off));
                    qhi.y = fmaxf(qhi.y, __shfl_xor_sync(0xffffffff, qhi.y, off));
                    qhi.z = fmaxf(qhi.z, __shfl_xor_sync(0xffffffff, qhi.z, off));
                }

                uint32_t entry = root_ref;
                bool empty_entry = false;
                float span = fmaxf(qhi.x - qlo.x, fmaxf(qhi.y - qlo.y, qhi.z - qlo.z));
                if (span <= 2.5f * rp.ao_radius + 0.5f) {
                    for (int lvl = 0; lvl < 14 && !(entry & 0x80000000u); lvl++) {
                        const float4* ptr = reinterpret_cast<const float4*>(&nodes[entry]);
                        float4 lox = ptr[0], hix = ptr[1], loy = ptr[2], hiy = ptr[3], loz = ptr[4], hiz = ptr[5];
                        uint4 ch = *reinterpret_cast<const uint4*>(&ptr[6]);
                        int ov0 = (ch.x != 0x7fffffffu) && (hix.x >= qlo.x) && (lox.x <= qhi.x) && (hiy.x >= qlo.y) && (loy.x <= qhi.y) && (hiz.x >= qlo.z) && (loz.x <= qhi.z);
                        int ov1 = (ch.y != 0x7fffffffu) && (hix.y >= qlo.x) && (lox.y <= qhi.x) && (hiy.y >= qlo.y) && (loy.y <= qhi.y) && (hiz.y >= qlo.z) && (loz.y <= qhi.z);
                        int ov2 = (ch.z != 0x7fffffffu) && (hix.z >= qlo.x) && (lox.z <= qhi.x) && (hiy.z >= qlo.y) && (loy.z <= qhi.y) && (hiz.z >= qlo.z) && (loz.z <= qhi.z);
                        int ov3 = (ch.w != 0x7fffffffu) && (hix.w >= qlo.x) && (lox.w <= qhi.x) && (hiy.w >= qlo.y) && (loy.w <= qhi.y) && (hiz.w >= qlo.z) && (loz.w <= qhi.z);
                        int omask = ov0 | (ov1 << 1) | (ov2 << 2) | (ov3 << 3);
                        if (omask == 0) { empty_entry = true; break; }
                        if ((omask & (omask - 1)) != 0) break;
                        entry = ov0 ? ch.x : (ov1 ? ch.y : (ov2 ? ch.z : ch.w));
                    }
                }

                bool direct_unblocked = false;
                if (got_new) {
                    if (empty_entry) {
                        direct_unblocked = true;
                    } else if (entry & 0x80000000u) {
                        if (intersectLeafBlocker(entry, geom, new_o, new_d, rp.ao_radius) < 0) direct_unblocked = true;
                    } else {
                        active = true;
                        o = new_o; d = new_d;
                        id = precomputeInvDir(new_d);
                        oid = make_float3(new_o.x * id.x, new_o.y * id.y, new_o.z * id.z);
                        cur = entry; sp = 0;
                        out_px = new_px; ar = new_ar; ag = new_ag; ab = new_ab;
                    }
                }
                if (__ballot_sync(0xffffffff, direct_unblocked)) {
                    warpReducePixelAdd(direct_unblocked ? new_px : -1,
                                       direct_unblocked ? new_ar : 0.0f,
                                       direct_unblocked ? new_ag : 0.0f,
                                       direct_unblocked ? new_ab : 0.0f, out);
                }
            }
            alive_mask = __ballot_sync(0xffffffff, active);
            if (alive_mask == 0) break;
        }

        bool step_unblocked = false;
        if (active) {
            if (cur & 0x80000000u) {
                if (intersectLeafBlocker(cur, geom, o, d, rp.ao_radius) >= 0) {
                    active = false;
                } else if (sp > 0) {
                    cur = popStack(sp, s_stack, g_spill);
                } else {
                    active = false;
                    step_unblocked = true;
                }
            } else {
                const float4* ptr = reinterpret_cast<const float4*>(&nodes[cur]);
                float4 lo = ptr[0], hi = ptr[1];
                float a0 = fmaf(lo.x, id.x, -oid.x), b0 = fmaf(hi.x, id.x, -oid.x);
                float a1 = fmaf(lo.y, id.x, -oid.x), b1 = fmaf(hi.y, id.x, -oid.x);
                float a2 = fmaf(lo.z, id.x, -oid.x), b2 = fmaf(hi.z, id.x, -oid.x);
                float a3 = fmaf(lo.w, id.x, -oid.x), b3 = fmaf(hi.w, id.x, -oid.x);
                float t0 = fmaxf(0.0002f, fminf(a0, b0)), x0 = fminf(rp.ao_radius, fmaxf(a0, b0));
                float t1 = fmaxf(0.0002f, fminf(a1, b1)), x1 = fminf(rp.ao_radius, fmaxf(a1, b1));
                float t2 = fmaxf(0.0002f, fminf(a2, b2)), x2 = fminf(rp.ao_radius, fmaxf(a2, b2));
                float t3 = fmaxf(0.0002f, fminf(a3, b3)), x3 = fminf(rp.ao_radius, fmaxf(a3, b3));

                lo = ptr[2]; hi = ptr[3];
                a0 = fmaf(lo.x, id.y, -oid.y); b0 = fmaf(hi.x, id.y, -oid.y);
                a1 = fmaf(lo.y, id.y, -oid.y); b1 = fmaf(hi.y, id.y, -oid.y);
                a2 = fmaf(lo.z, id.y, -oid.y); b2 = fmaf(hi.z, id.y, -oid.y);
                a3 = fmaf(lo.w, id.y, -oid.y); b3 = fmaf(hi.w, id.y, -oid.y);
                t0 = fmaxf(t0, fminf(a0, b0)); x0 = fminf(x0, fmaxf(a0, b0));
                t1 = fmaxf(t1, fminf(a1, b1)); x1 = fminf(x1, fmaxf(a1, b1));
                t2 = fmaxf(t2, fminf(a2, b2)); x2 = fminf(x2, fmaxf(a2, b2));
                t3 = fmaxf(t3, fminf(a3, b3)); x3 = fminf(x3, fmaxf(a3, b3));

                lo = ptr[4]; hi = ptr[5];
                a0 = fmaf(lo.x, id.z, -oid.z); b0 = fmaf(hi.x, id.z, -oid.z);
                a1 = fmaf(lo.y, id.z, -oid.z); b1 = fmaf(hi.y, id.z, -oid.z);
                a2 = fmaf(lo.z, id.z, -oid.z); b2 = fmaf(hi.z, id.z, -oid.z);
                a3 = fmaf(lo.w, id.z, -oid.z); b3 = fmaf(hi.w, id.z, -oid.z);
                t0 = fmaxf(t0, fminf(a0, b0)); x0 = fminf(x0, fmaxf(a0, b0));
                t1 = fmaxf(t1, fminf(a1, b1)); x1 = fminf(x1, fmaxf(a1, b1));
                t2 = fmaxf(t2, fminf(a2, b2)); x2 = fminf(x2, fmaxf(a2, b2));
                t3 = fmaxf(t3, fminf(a3, b3)); x3 = fminf(x3, fmaxf(a3, b3));

                uint4 ch = *reinterpret_cast<const uint4*>(&ptr[6]);
                bool h0 = (t0 <= x0) && (ch.x != 0x7fffffffu);
                bool h1 = (t1 <= x1) && (ch.y != 0x7fffffffu);
                bool h2 = (t2 <= x2) && (ch.z != 0x7fffffffu);
                bool h3 = (t3 <= x3) && (ch.w != 0x7fffffffu);
                int mask = (h0 ? 1 : 0) | (h1 ? 2 : 0) | (h2 ? 4 : 0) | (h3 ? 8 : 0);

                if (mask == 0) {
                    if (sp > 0) cur = popStack(sp, s_stack, g_spill);
                    else { active = false; step_unblocked = true; }
                } else {
                    uint32_t c0 = ch.x, c1 = ch.y, c2 = ch.z, c3 = ch.w;
                    if ((mask & (mask - 1)) == 0) {
                        cur = h0 ? c0 : (h1 ? c1 : (h2 ? c2 : c3));
                    } else {
                        if (!h0) t0 = 1e30f;
                        if (!h1) t1 = 1e30f;
                        if (!h2) t2 = 1e30f;
                        if (!h3) t3 = 1e30f;
                        auto cmpSwap = [](float& ta, uint32_t& ca, float& tb, uint32_t& cb) {
                            if (ta > tb) { float tt = ta; ta = tb; tb = tt; uint32_t tc = ca; ca = cb; cb = tc; }
                        };
                        cmpSwap(t0, c0, t2, c2);
                        cmpSwap(t1, c1, t3, c3);
                        cmpSwap(t0, c0, t1, c1);
                        cmpSwap(t2, c2, t3, c3);
                        cmpSwap(t1, c1, t2, c2);
                        if (t3 < 1e29f) pushStack(c3, sp, s_stack, g_spill);
                        if (t2 < 1e29f) pushStack(c2, sp, s_stack, g_spill);
                        pushStack(c1, sp, s_stack, g_spill);
                        cur = c0;
                    }
                }
            }
        }
        if (__ballot_sync(0xffffffff, step_unblocked)) {
            warpReducePixelAdd(step_unblocked ? out_px : -1,
                               step_unblocked ? ar : 0.0f,
                               step_unblocked ? ag : 0.0f,
                               step_unblocked ? ab : 0.0f, out);
        }
    }
}

} // namespace

static int queryResidentBlocks(const void* kernel) {
    int bpsm = 0;
    ck(cudaOccupancyMaxActiveBlocksPerMultiprocessor(&bpsm, kernel, BLOCK_THREADS, 0));
    return std::min(g_max_blocks, std::max(1, g_num_sms * std::max(1, bpsm)));
}

void init(int max_triangles, int max_pixels, int max_samples) {
    (void)max_samples;
    int mt = std::max(2, max_triangles);
    g_cap_tris = mt;

    ck(cudaMalloc(&d_tris_in, size_t(mt) * sizeof(Triangle)));
    g_pinned_bytes = size_t(mt) * sizeof(Triangle);
    ck(cudaMallocHost(&h_tris_pinned, g_pinned_bytes));
    ck(cudaMallocHost(&h_q_cnt_pinned, sizeof(int)));

    int dev = 0;
    ck(cudaGetDevice(&dev));
    ck(cudaDeviceGetAttribute(&g_num_sms, cudaDevAttrMultiProcessorCount, dev));
    g_max_blocks = g_num_sms * 12;
    g_blk_shadow = queryResidentBlocks((const void*)kShadeAndShadow);
    g_blk_ao     = queryResidentBlocks((const void*)kAOTrace);

    ck(cudaMalloc(&d_tri_geom, size_t(mt) * sizeof(TriGeom)));
    ck(cudaMalloc(&d_tri_mat, size_t(mt) * sizeof(TriMat)));
    ck(cudaMalloc(&d_bvh4_nodes, size_t(mt) * sizeof(BVH4Node)));
    size_t spill_threads = std::max<size_t>(CHUNK_SAMPLES, size_t(g_max_blocks) * BLOCK_THREADS);
    ck(cudaMalloc(&d_spill, spill_threads * SPILL_STRIDE * sizeof(uint32_t)));

    g_cap_pixels = std::max(1, max_pixels);
    g_cap_tiles4 = std::max(64, (g_cap_pixels + 7) / 8);
    ck(cudaMalloc(&d_hint_tri, size_t(g_cap_pixels) * sizeof(int)));
    ck(cudaMalloc(&d_shadow_hint, size_t(g_cap_pixels) * sizeof(int)));
    ck(cudaMalloc(&d_tile_mode, size_t(g_cap_tiles4) * sizeof(int)));
    ck(cudaMalloc(&d_tile_entry, size_t(g_cap_tiles4) * sizeof(uint32_t)));
    ck(cudaMalloc(&d_tile_tris, size_t(g_cap_tiles4) * MAX_TILE_TRIS * sizeof(uint32_t)));

    ck(cudaMalloc(&d_hit_t, size_t(CHUNK_SAMPLES) * sizeof(float)));
    ck(cudaMalloc(&d_hit_id, size_t(CHUNK_SAMPLES) * sizeof(int)));
    ck(cudaMalloc(&d_diff_rays, size_t(CHUNK_SAMPLES) * sizeof(int)));
    ck(cudaMalloc(&d_bounce_src, size_t(CHUNK_SAMPLES) * sizeof(int)));
    ck(cudaMalloc(&d_warp_diff_mask, size_t(NUM_WARPS_MAX) * sizeof(uint32_t)));
    ck(cudaMalloc(&d_warp_bounce_mask, size_t(NUM_WARPS_MAX) * sizeof(uint32_t)));
    ck(cudaMalloc(&d_warp_diff_off, size_t(NUM_WARPS_MAX) * sizeof(int)));
    ck(cudaMalloc(&d_warp_bnc_off, size_t(NUM_WARPS_MAX) * sizeof(int)));
    ck(cudaMalloc(&d_pack_blk, 512 * sizeof(int)));
    ck(cudaMalloc(&d_bounce_a, size_t(CHUNK_SAMPLES) * sizeof(BounceItem)));
    ck(cudaMalloc(&d_bounce_b, size_t(CHUNK_SAMPLES) * sizeof(BounceItem)));

    ck(cudaMalloc(&d_scene_cbox, 6 * sizeof(int)));
    ck(cudaMalloc(&d_morton_a, size_t(mt) * sizeof(uint64_t)));
    ck(cudaMalloc(&d_morton_b, size_t(mt) * sizeof(uint64_t)));
    ck(cudaMalloc(&d_idx_a, size_t(mt) * sizeof(int)));
    ck(cudaMalloc(&d_idx_b, size_t(mt) * sizeof(int)));

    ck(cudaMalloc(&d_left, size_t(mt) * sizeof(int)));
    ck(cudaMalloc(&d_right, size_t(mt) * sizeof(int)));
    ck(cudaMalloc(&d_parent, (2 * size_t(mt) + 1) * sizeof(int)));
    ck(cudaMalloc(&d_visits, size_t(mt) * sizeof(int)));
    ck(cudaMalloc(&d_bmin, (2 * size_t(mt) + 1) * sizeof(float4)));
    ck(cudaMalloc(&d_bmax, (2 * size_t(mt) + 1) * sizeof(float4)));
    ck(cudaMalloc(&d_tri_cnt, (2 * size_t(mt) + 1) * sizeof(int)));
    ck(cudaMalloc(&d_dp_cost, (2 * size_t(mt) + 1) * sizeof(float4)));
    ck(cudaMalloc(&d_dp_choice, (2 * size_t(mt) + 1) * sizeof(uchar4)));

    ck(cudaMalloc(&d_q_a, size_t(mt) * sizeof(QueueItem)));
    ck(cudaMalloc(&d_q_b, size_t(mt) * sizeof(QueueItem)));
    ck(cudaMalloc(&d_counters, 32 * sizeof(int)));
    ck(cudaMalloc(&d_root_ref, sizeof(uint32_t)));

    size_t sort_bytes = 0;
    cub::DeviceRadixSort::SortPairs(nullptr, sort_bytes, d_morton_a, d_morton_b, d_idx_a, d_idx_b, mt);
    g_cub_temp_bytes = std::max(size_t(1024), sort_bytes);
    ck(cudaMalloc(&d_cub_temp, g_cub_temp_bytes));
}

void render(const Scene& s, float* out) {
    int N = s.triangle_count;
    size_t tris_bytes = size_t(N) * sizeof(Triangle);
    if (tris_bytes <= g_pinned_bytes) {
        std::memcpy(h_tris_pinned, s.triangles, tris_bytes);
        ck(cudaMemcpyAsync(d_tris_in, h_tris_pinned, tris_bytes, cudaMemcpyHostToDevice));
    } else {
        ck(cudaMemcpyAsync(d_tris_in, s.triangles, tris_bytes, cudaMemcpyHostToDevice));
    }

    size_t out_bytes = size_t(s.width) * s.height * 3 * sizeof(float);
    ck(cudaMemsetAsync(out, 0, out_bytes));

    if (N == 1) {
        kSingleTriInit<<<1, 1>>>(d_tris_in, d_tri_geom, d_tri_mat, d_root_ref);
    } else {
        int init_cbox[6] = {0x7fffffff, 0x7fffffff, 0x7fffffff, int(0x80000000u), int(0x80000000u), int(0x80000000u)};
        ck(cudaMemcpyAsync(d_scene_cbox, init_cbox, sizeof(init_cbox), cudaMemcpyHostToDevice));

        int cbox_blocks = std::min(512, (N + 255) / 256);
        kComputeCentroidBounds<<<cbox_blocks, 256>>>(d_tris_in, N, d_scene_cbox);

        int n_blocks = (N + 255) / 256;
        kComputeMorton<<<n_blocks, 256>>>(d_tris_in, N, d_scene_cbox, d_morton_a, d_idx_a);

        size_t temp_bytes = g_cub_temp_bytes;
        cub::DeviceRadixSort::SortPairs(d_cub_temp, temp_bytes, d_morton_a, d_morton_b, d_idx_a, d_idx_b, N, 0, 63);

        int int_blocks = (N - 1 + 255) / 256;
        kBuildKarras<<<int_blocks, 256>>>(d_morton_b, N, d_left, d_right, d_parent);

        ck(cudaMemsetAsync(d_visits, 0, size_t(N - 1) * sizeof(int)));
        kInitLeavesAndRefit<<<n_blocks, 256>>>(d_tris_in, d_idx_b, N, d_left, d_right, d_parent, d_visits, d_bmin, d_bmax);

        for (int pass = 0; pass < 2; pass++) {
            ck(cudaMemsetAsync(d_visits, 0, size_t(N - 1) * sizeof(int)));
            kTreeletOptimize<<<n_blocks, 256>>>(N, d_left, d_right, d_parent, d_visits, d_bmin, d_bmax);
        }

        ck(cudaMemsetAsync(d_visits, 0, size_t(N - 1) * sizeof(int)));
        kBuildBVH4DP<<<n_blocks, 256>>>(N, d_left, d_right, d_parent, d_visits, d_bmin, d_tri_cnt, d_dp_cost, d_dp_choice);

        QueueItem* q_in = d_q_a;
        QueueItem* q_out = d_q_b;
        kInitBVH4BFS<<<1, 1>>>(N, d_left, d_right, d_idx_b, d_tris_in, d_dp_choice, d_tri_geom, d_tri_mat, q_in, d_counters, d_root_ref);
        ck(cudaMemcpy(h_q_cnt_pinned, &d_counters[0], sizeof(int), cudaMemcpyDeviceToHost));
        int q_cnt = *h_q_cnt_pinned;
        while (q_cnt > 0) {
            ck(cudaMemsetAsync(&d_counters[0], 0, sizeof(int)));
            int q_blocks = (q_cnt + 127) / 128;
            kPackBVH4Level<<<q_blocks, 128>>>(N, q_cnt, q_in, d_left, d_right, d_bmin, d_bmax, d_tri_cnt, d_dp_choice,
                                              d_idx_b, d_tris_in, d_bvh4_nodes, d_tri_geom, d_tri_mat, q_out, d_counters);
            ck(cudaMemcpy(h_q_cnt_pinned, &d_counters[0], sizeof(int), cudaMemcpyDeviceToHost));
            q_cnt = *h_q_cnt_pinned;
            std::swap(q_in, q_out);
        }
    }

    RenderParams rp{};
    rp.width = s.width;
    rp.height = s.height;
    rp.spp = s.spp;
    rp.ao = s.ao;
    rp.max_depth = s.max_depth;
    rp.seed = s.seed;
    rp.ao_radius = s.ao_radius;
    rp.inv_width = 1.0f / float(s.width);
    rp.inv_height = 1.0f / float(s.height);
    rp.inv_spp = 1.0f / float(s.spp);
    rp.eye = make_float3(s.eye[0], s.eye[1], s.eye[2]);
    rp.u = make_float3(s.u[0], s.u[1], s.u[2]);
    rp.v = make_float3(s.v[0], s.v[1], s.v[2]);
    rp.w = make_float3(s.w[0], s.w[1], s.w[2]);
    float lnorm = 1.0f / std::sqrt(s.light[0] * s.light[0] + s.light[1] * s.light[1] + s.light[2] * s.light[2]);
    rp.unit_light = make_float3(s.light[0] * lnorm, s.light[1] * lnorm, s.light[2] * lnorm);
    rp.light_inv_d = make_float3(
        1.0f / (std::fabs(rp.unit_light.x) > 1e-18f ? rp.unit_light.x : 1e-18f),
        1.0f / (std::fabs(rp.unit_light.y) > 1e-18f ? rp.unit_light.y : 1e-18f),
        1.0f / (std::fabs(rp.unit_light.z) > 1e-18f ? rp.unit_light.z : 1e-18f)
    );
    rp.light_neg = (rp.light_inv_d.x < 0.0f ? 1u : 0u) |
                   (rp.light_inv_d.y < 0.0f ? 2u : 0u) |
                   (rp.light_inv_d.z < 0.0f ? 4u : 0u);
    rp.tiles4_x = (s.width + 3) >> 2;
    rp.tiles4_y = (s.height + 3) >> 2;
    rp.total_tiles4 = rp.tiles4_x * rp.tiles4_y;
    rp.use_tile_cache = (s.spp >= 4);

    if (rp.use_tile_cache) {
        int total_px = s.width * s.height;
        if (total_px > g_cap_pixels) {
            cudaFree(d_hint_tri);
            cudaFree(d_shadow_hint);
            g_cap_pixels = total_px;
            ck(cudaMalloc(&d_hint_tri, size_t(g_cap_pixels) * sizeof(int)));
            ck(cudaMalloc(&d_shadow_hint, size_t(g_cap_pixels) * sizeof(int)));
        }
        if (rp.total_tiles4 > g_cap_tiles4) {
            cudaFree(d_tile_mode);
            cudaFree(d_tile_entry);
            cudaFree(d_tile_tris);
            g_cap_tiles4 = rp.total_tiles4;
            ck(cudaMalloc(&d_tile_mode, size_t(g_cap_tiles4) * sizeof(int)));
            ck(cudaMalloc(&d_tile_entry, size_t(g_cap_tiles4) * sizeof(uint32_t)));
            ck(cudaMalloc(&d_tile_tris, size_t(g_cap_tiles4) * MAX_TILE_TRIS * sizeof(uint32_t)));
        }
        int hint_grid = std::min(g_max_blocks, (total_px + BLOCK_THREADS - 1) / BLOCK_THREADS);
        kPrimaryHints<<<hint_grid, BLOCK_THREADS>>>(rp, d_bvh4_nodes, d_tri_geom, d_tri_mat, d_root_ref,
                                                    d_spill, d_hint_tri, d_shadow_hint);
        int t4_blocks = (rp.total_tiles4 + 127) / 128;
        kBuildTileFrustum<<<t4_blocks, 128>>>(rp, d_bvh4_nodes, d_tri_geom, d_root_ref, d_hint_tri,
                                              d_tile_mode, d_tile_entry, d_tile_tris);
    }

    long long total_threads = (long long)rp.total_tiles4 * 16LL * (long long)s.spp;
    long long chunk_samples = (s.ao <= 1)
        ? (long long)CHUNK_SAMPLES
        : std::max(16384LL, std::min<long long>(CHUNK_SAMPLES, 4194304LL / s.ao));
    chunk_samples = (chunk_samples / BLOCK_THREADS) * BLOCK_THREADS;

    const int* shadow_hint0 = rp.use_tile_cache ? d_shadow_hint : nullptr;
    for (long long off = 0; off < total_threads; off += chunk_samples) {
        int chunk_len = int(std::min(chunk_samples, total_threads - off));
        int prim_blocks = (chunk_len + BLOCK_THREADS - 1) / BLOCK_THREADS;

        kPrimaryTrace<<<prim_blocks, BLOCK_THREADS>>>(
            rp, d_bvh4_nodes, d_tri_geom, d_tri_mat, d_root_ref,
            d_hint_tri, d_tile_mode, d_tile_entry, d_tile_tris,
            d_spill, d_hit_t, d_hit_id, d_warp_diff_mask, d_warp_bounce_mask, off, chunk_len, out);

        int scatter_blocks = (((chunk_len + 31) >> 5) + 7) >> 3;
        kPackCount<<<128, 256>>>(d_warp_diff_mask, d_warp_bounce_mask, nullptr, chunk_len,
                                 d_warp_diff_off, d_warp_bnc_off, d_pack_blk);
        kPackScanBlocks<<<1, 128>>>(4, d_pack_blk, d_counters);
        kPackScatter<<<scatter_blocks, 256>>>(d_warp_diff_mask, d_warp_bounce_mask,
                                              d_warp_diff_off, d_warp_bnc_off, d_pack_blk,
                                              nullptr, chunk_len, d_diff_rays, d_bounce_src);

        if (rp.max_depth > 1) {
            int max_bnc_blk = std::min(g_max_blocks, prim_blocks);
            kBuildBounceItems<<<prim_blocks, BLOCK_THREADS>>>(
                rp, 0, d_tri_geom, d_tri_mat, d_bounce_src, &d_counters[4],
                d_hit_t, d_hit_id, nullptr, d_bounce_a, off);
            (void)max_bnc_blk;
        }

        kShadeAndShadow<<<g_blk_shadow, BLOCK_THREADS>>>(
            rp, 0, d_bvh4_nodes, d_tri_geom, d_tri_mat, d_root_ref,
            d_diff_rays, d_hit_t, d_hit_id, nullptr, shadow_hint0, d_counters, d_spill, off, out);

        if (rp.ao > 0) {
            kAOTrace<<<g_blk_ao, BLOCK_THREADS>>>(
                rp, 0, d_bvh4_nodes, d_tri_geom, d_tri_mat, d_root_ref,
                d_diff_rays, d_hit_t, d_hit_id, nullptr, d_counters, d_spill, off, out);
        }

        BounceItem* b_in = d_bounce_a;
        BounceItem* b_out = d_bounce_b;
        int cur_cnt_idx = 4;
        for (int depth = 1; depth < rp.max_depth; depth++) {
            int nxt_cnt_idx = cur_cnt_idx ^ 1;
            kBounceTrace<<<prim_blocks, BLOCK_THREADS>>>(
                rp, depth, d_bvh4_nodes, d_tri_geom, d_tri_mat, d_root_ref,
                b_in, &d_counters[cur_cnt_idx], d_spill, d_hit_t, d_hit_id,
                d_warp_diff_mask, d_warp_bounce_mask, out);

            kPackCount<<<128, 256>>>(d_warp_diff_mask, d_warp_bounce_mask, &d_counters[cur_cnt_idx], 0,
                                     d_warp_diff_off, d_warp_bnc_off, d_pack_blk);
            kPackScanBlocks<<<1, 128>>>(nxt_cnt_idx, d_pack_blk, d_counters);
            kPackScatter<<<scatter_blocks, 256>>>(d_warp_diff_mask, d_warp_bounce_mask,
                                                  d_warp_diff_off, d_warp_bnc_off, d_pack_blk,
                                                  &d_counters[cur_cnt_idx], 0, d_diff_rays, d_bounce_src);

            if (depth + 1 < rp.max_depth) {
                kBuildBounceItems<<<prim_blocks, BLOCK_THREADS>>>(
                    rp, depth, d_tri_geom, d_tri_mat, d_bounce_src, &d_counters[nxt_cnt_idx],
                    d_hit_t, d_hit_id, b_in, b_out, off);
            }

            kShadeAndShadow<<<g_blk_shadow, BLOCK_THREADS>>>(
                rp, depth, d_bvh4_nodes, d_tri_geom, d_tri_mat, d_root_ref,
                d_diff_rays, d_hit_t, d_hit_id, b_in, nullptr, d_counters, d_spill, off, out);

            if (rp.ao > 0) {
                kAOTrace<<<g_blk_ao, BLOCK_THREADS>>>(
                    rp, depth, d_bvh4_nodes, d_tri_geom, d_tri_mat, d_root_ref,
                    d_diff_rays, d_hit_t, d_hit_id, b_in, d_counters, d_spill, off, out);
            }

            std::swap(b_in, b_out);
            cur_cnt_idx = nxt_cnt_idx;
        }
    }
    ck(cudaGetLastError());
}
