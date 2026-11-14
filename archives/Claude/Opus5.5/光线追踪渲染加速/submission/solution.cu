// GPU ray tracer: parallel CPU binned-SAH BVH emitted directly as BVH2 (child boxes in parent),
// one thread per sample, warp segmented reduction into the output.
#include "render_math.cuh"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
#include <thread>
#include <chrono>
#include <functional>
#include <algorithm>
#include <atomic>
#include <immintrin.h>

struct __align__(16) GNode { float4 a, b, c; int4 d; };
// a=(L.lo.x,L.hi.x,L.lo.y,L.hi.y) b=(R.lo.x,R.hi.x,R.lo.y,R.hi.y) c=(L.lo.z,L.hi.z,R.lo.z,R.hi.z)
// d=(left,right,leftCount,rightCount); count>0 -> leaf with tri start = index.

static Triangle* d_tris = nullptr;
static GNode* d_nodes = nullptr;
static float4* d_wt = nullptr;
static GNode* h_nodes = nullptr;
static int* h_order = nullptr;
static int* d_order = nullptr;
static cudaStream_t stream;

static void ck(cudaError_t e) { if (e != cudaSuccess) { fprintf(stderr, "solution: %s\n", cudaGetErrorString(e)); exit(2); } }

__device__ __forceinline__ float3 f3(V<float> v) { return make_float3(v.x, v.y, v.z); }

template<bool ANY>
__device__ __forceinline__ int traverse(const GNode* __restrict__ nodes, const float4* __restrict__ wt,
                                        float3 o, float3 d, float& tmax) {
    float ix = 1.0f / (fabsf(d.x) > 1e-30f ? d.x : copysignf(1e-30f, d.x));
    float iy = 1.0f / (fabsf(d.y) > 1e-30f ? d.y : copysignf(1e-30f, d.y));
    float iz = 1.0f / (fabsf(d.z) > 1e-30f ? d.z : copysignf(1e-30f, d.z));
    float ox = o.x * ix, oy = o.y * iy, oz = o.z * iz;
    int stack[64]; int sp = 0;
    int node = 0; int hit = -1;
    while (true) {
        const float4 a = __ldg(&nodes[node].a), b = __ldg(&nodes[node].b), c = __ldg(&nodes[node].c);
        const int4 dd = __ldg(&nodes[node].d);
        float l0x = fmaf(a.x, ix, -ox), l1x = fmaf(a.y, ix, -ox);
        float l0y = fmaf(a.z, iy, -oy), l1y = fmaf(a.w, iy, -oy);
        float l0z = fmaf(c.x, iz, -oz), l1z = fmaf(c.y, iz, -oz);
        float r0x = fmaf(b.x, ix, -ox), r1x = fmaf(b.y, ix, -ox);
        float r0y = fmaf(b.z, iy, -oy), r1y = fmaf(b.w, iy, -oy);
        float r0z = fmaf(c.z, iz, -oz), r1z = fmaf(c.w, iz, -oz);
        float lmin = fmaxf(fmaxf(fminf(l0x, l1x), fminf(l0y, l1y)), fmaxf(fminf(l0z, l1z), 0.0f));
        float lmax = fminf(fminf(fmaxf(l0x, l1x), fmaxf(l0y, l1y)), fminf(fmaxf(l0z, l1z), tmax));
        float rmin = fmaxf(fmaxf(fminf(r0x, r1x), fminf(r0y, r1y)), fmaxf(fminf(r0z, r1z), 0.0f));
        float rmax = fminf(fminf(fmaxf(r0x, r1x), fmaxf(r0y, r1y)), fminf(fmaxf(r0z, r1z), tmax));
        bool hl = lmin <= lmax, hr = rmin <= rmax;
        #pragma unroll
        for (int side = 0; side < 2; side++) {
            bool h = side ? hr : hl;
            int cnt = side ? dd.w : dd.z;
            if (h && cnt > 0) {
                int st = side ? dd.y : dd.x;
                for (int k = st; k < st + cnt; k++) {
                    float4 v0 = __ldg(&wt[3 * k]), e1 = __ldg(&wt[3 * k + 1]), e2 = __ldg(&wt[3 * k + 2]);
                    float px = d.y * e2.z - d.z * e2.y, py = d.z * e2.x - d.x * e2.z, pz = d.x * e2.y - d.y * e2.x;
                    float det = e1.x * px + e1.y * py + e1.z * pz;
                    float adet = fabsf(det);
                    if (adet < 1e-10f) continue;
                    float sg = det > 0.0f ? 1.0f : -1.0f;
                    float sx = o.x - v0.x, sy = o.y - v0.y, sz = o.z - v0.z;
                    float un = (sx * px + sy * py + sz * pz) * sg;
                    if (un < 0.0f || un > adet * 1.000001f) continue;
                    float qx = sy * e1.z - sz * e1.y, qy = sz * e1.x - sx * e1.z, qz = sx * e1.y - sy * e1.x;
                    float vn = (d.x * qx + d.y * qy + d.z * qz) * sg;
                    if (vn < 0.0f || un + vn > adet * 1.000001f) continue;
                    float tn = (e2.x * qx + e2.y * qy + e2.z * qz) * sg;
                    if (tn <= 0.0f || tn > tmax * adet * 1.000001f) continue;
                    float inv = 1.0f / det;
                    float u = (sx * px + sy * py + sz * pz) * inv;
                    if (u < 0.0f || u > 1.0f) continue;
                    float v = (d.x * qx + d.y * qy + d.z * qz) * inv;
                    if (v < 0.0f || u + v > 1.0f) continue;
                    float t = (e2.x * qx + e2.y * qy + e2.z * qz) * inv;
                    if (t <= 0.0002f || t >= tmax) continue;
                    tmax = t; hit = __float_as_int(v0.w);
                    if (ANY) return hit;
                }
            }
        }
        bool il = hl && dd.z == 0, ir = hr && dd.w == 0;
        if (il && ir) {
            int nearN = dd.x, farN = dd.y;
            if (rmin < lmin) { nearN = dd.y; farN = dd.x; }
            stack[sp++] = farN; node = nearN;
        } else if (il) node = dd.x;
        else if (ir) node = dd.y;
        else {
            if (sp == 0) break;
            node = stack[--sp];
        }
    }
    return hit;
}

struct GQuery {
    const Triangle* tris; const GNode* nodes; const float4* wt;
    __device__ const Triangle& triangle(int id) const { return tris[id]; }
    __device__ Hit<float> closest(Ray<float> r, float limit) {
        float t = limit; int id = traverse<false>(nodes, wt, f3(r.o), f3(r.d), t);
        return Hit<float>{t, id};
    }
    __device__ bool blocked(Ray<float> r, float limit) {
        float t = limit; return traverse<true>(nodes, wt, f3(r.o), f3(r.d), t) >= 0;
    }
};

#ifndef MINB
#define MINB 1
#endif
__global__ void __launch_bounds__(128, MINB) trace_kernel(Scene s, GQuery q, float* acc, long long offset, long long end) {
    long long i = offset + (long long)blockIdx.x * blockDim.x + threadIdx.x;
    float cx = 0, cy = 0, cz = 0; int key = -1;
    if (i < end) {
        int pixel = int(i / s.spp), sid = int(i % s.spp);
        V<float> c = radiance<float>(s, pixel, sid, q);
        cx = c.x; cy = c.y; cz = c.z; key = pixel;
    }
    int lane = threadIdx.x & 31;
    #pragma unroll
    for (int off = 1; off < 32; off <<= 1) {
        float x = __shfl_down_sync(0xffffffffu, cx, off);
        float y = __shfl_down_sync(0xffffffffu, cy, off);
        float z = __shfl_down_sync(0xffffffffu, cz, off);
        int k = __shfl_down_sync(0xffffffffu, key, off);
        if (lane + off < 32 && k == key) { cx += x; cy += y; cz += z; }
    }
    int prev = __shfl_up_sync(0xffffffffu, key, 1);
    if (key >= 0 && (lane == 0 || prev != key)) {
        atomicAdd(&acc[3 * key], cx); atomicAdd(&acc[3 * key + 1], cy); atomicAdd(&acc[3 * key + 2], cz);
    }
}

__global__ void scale_kernel(float* out, int n, float spp) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) out[i] = out[i] / spp;
}

__global__ void warm_kernel() {}

// ---------------- BVH builder ----------------
struct alignas(16) Ref { float lo[3]; int id; float hi[3]; float pad; };
struct Info { float lo[3], hi[3]; int idx, cnt; };
static Ref* g_refs = nullptr;
static std::atomic<int> g_next;
#define NB 16
#ifndef PD
#define PD 8
#endif
#ifndef MAXLEAF
#define MAXLEAF 8
#endif
#ifndef TRAV_COST
#define TRAV_COST 1.0f
#endif
static inline float harea(const float* a, const float* b) { float x = b[0] - a[0], y = b[1] - a[1], z = b[2] - a[2]; return x * y + y * z + z * x; }

static void writeChild(GNode& g, int side, const Info& c) {
    float lo[3], hi[3];
    for (int k = 0; k < 3; k++) { lo[k] = c.lo[k] - 1e-5f; hi[k] = c.hi[k] + 1e-5f; }
    if (side == 0) { g.a = make_float4(lo[0], hi[0], lo[1], hi[1]); g.c.x = lo[2]; g.c.y = hi[2]; g.d.x = c.idx; g.d.z = c.cnt; }
    else { g.b = make_float4(lo[0], hi[0], lo[1], hi[1]); g.c.z = lo[2]; g.c.w = hi[2]; g.d.y = c.idx; g.d.w = c.cnt; }
}

struct Bins { __m128 lo[3][NB], hi[3][NB]; int c[3][NB]; };
static int g_nthreads = 12;
static void binRange(const Ref* R, int b, int e, __m128 clo4, __m128 sc4, Bins& B) {
    const __m128 big = _mm_set1_ps(1e30f), nbig = _mm_set1_ps(-1e30f), half = _mm_set1_ps(0.5f);
    for (int k = 0; k < 3; k++) for (int j = 0; j < NB; j++) { B.lo[k][j] = big; B.hi[k][j] = nbig; B.c[k][j] = 0; }
    const __m128i zero = _mm_setzero_si128(), mx = _mm_set1_epi32(NB - 1);
    alignas(16) int idx[4];
    const __m128 m3 = _mm_castsi128_ps(_mm_setr_epi32(-1, -1, -1, 0));
    for (int i = b; i < e; i++) {
        __m128 l = _mm_and_ps(_mm_load_ps(R[i].lo), m3), h = _mm_load_ps(R[i].hi);
        __m128 c = _mm_mul_ps(_mm_add_ps(l, h), half);
        __m128i bi = _mm_cvttps_epi32(_mm_mul_ps(_mm_sub_ps(c, clo4), sc4));
        bi = _mm_min_epi32(_mm_max_epi32(bi, zero), mx);
        _mm_store_si128((__m128i*)idx, bi);
        for (int k = 0; k < 3; k++) { int j = idx[k]; B.c[k][j]++; B.lo[k][j] = _mm_min_ps(B.lo[k][j], l); B.hi[k][j] = _mm_max_ps(B.hi[k][j], h); }
    }
}

static void buildNode(int b, int e, const float* blo, const float* bhi, const float* clo, const float* chi, int depth, Info& out) {
    Ref* R = g_refs;
    int cnt = e - b;
    for (int k = 0; k < 3; k++) { out.lo[k] = blo[k]; out.hi[k] = bhi[k]; }
    out.idx = b; out.cnt = cnt;
    if (cnt <= 1 || depth >= 60) return;
    float scale[3]; bool okAxis[3];
    for (int k = 0; k < 3; k++) {
        float ext = chi[k] - clo[k]; okAxis[k] = ext > 1e-9f;
        scale[k] = okAxis[k] ? NB / ext * (1 - 1e-6f) : 0.0f;
    }
    __m128 clo4 = _mm_setr_ps(clo[0], clo[1], clo[2], 0), sc4 = _mm_setr_ps(scale[0], scale[1], scale[2], 0);
    Bins B;
    if (cnt > 40000) {
        int T = std::min(g_nthreads, cnt / 16384);
        std::vector<Bins> part(T);
        std::vector<std::thread> th;
        for (int t = 1; t < T; t++) th.emplace_back([&, t] { binRange(R, b + int((long long)cnt * t / T), b + int((long long)cnt * (t + 1) / T), clo4, sc4, part[t]); });
        binRange(R, b, b + int((long long)cnt / T), clo4, sc4, part[0]);
        for (auto& x : th) x.join();
        B = part[0];
        for (int t = 1; t < T; t++) for (int k = 0; k < 3; k++) for (int j = 0; j < NB; j++) {
            B.c[k][j] += part[t].c[k][j]; B.lo[k][j] = _mm_min_ps(B.lo[k][j], part[t].lo[k][j]); B.hi[k][j] = _mm_max_ps(B.hi[k][j], part[t].hi[k][j]); }
    } else binRange(R, b, e, clo4, sc4, B);
    int bc[3][NB]; float bl[3][NB][4], bh[3][NB][4];
    for (int k = 0; k < 3; k++) for (int j = 0; j < NB; j++) { bc[k][j] = B.c[k][j]; _mm_storeu_ps(bl[k][j], B.lo[k][j]); _mm_storeu_ps(bh[k][j], B.hi[k][j]); }
    float best = 1e30f; int bestAxis = -1, bestBin = 0;
    float bestL[6], bestR[6];
    for (int k = 0; k < 3; k++) {
        if (!okAxis[k]) continue;
        float rarea[NB]; int rcnt[NB]; float rlo[NB][3], rhi[NB][3];
        float alo[3] = {1e30f, 1e30f, 1e30f}, ahi[3] = {-1e30f, -1e30f, -1e30f}; int ac = 0;
        for (int j = NB - 1; j > 0; j--) {
            ac += bc[k][j];
            for (int q = 0; q < 3; q++) { alo[q] = std::min(alo[q], bl[k][j][q]); ahi[q] = std::max(ahi[q], bh[k][j][q]); rlo[j][q] = alo[q]; rhi[j][q] = ahi[q]; }
            rcnt[j] = ac; rarea[j] = ac ? harea(alo, ahi) : 0;
        }
        for (int q = 0; q < 3; q++) { alo[q] = 1e30f; ahi[q] = -1e30f; } ac = 0;
        for (int j = 1; j < NB; j++) {
            ac += bc[k][j - 1];
            for (int q = 0; q < 3; q++) { alo[q] = std::min(alo[q], bl[k][j - 1][q]); ahi[q] = std::max(ahi[q], bh[k][j - 1][q]); }
            if (!ac || !rcnt[j]) continue;
            float c = harea(alo, ahi) * ac + rarea[j] * rcnt[j];
            if (c < best) { best = c; bestAxis = k; bestBin = j;
                for (int q = 0; q < 3; q++) { bestL[q] = alo[q]; bestL[3 + q] = ahi[q]; bestR[q] = rlo[j][q]; bestR[3 + q] = rhi[j][q]; } }
        }
    }
    float parentArea = harea(blo, bhi);
    float splitCost = TRAV_COST + (parentArea > 0 ? best / parentArea : float(cnt));
    if (cnt <= MAXLEAF && float(cnt) <= splitCost) return;
    int mid = -1;
    if (bestAxis >= 0) {
        int k = bestAxis; float sc = scale[k], c0 = clo[k];
        Ref* p = std::partition(R + b, R + e, [&](const Ref& r) { return std::min(NB - 1, std::max(0, int(((r.lo[k] + r.hi[k]) * 0.5f - c0) * sc))) < bestBin; });
        mid = int(p - R);
    }
    float lb[6], rb[6];
    if (mid <= b || mid >= e) {
        if (cnt <= MAXLEAF) return;
        int axis = 0; for (int k = 1; k < 3; k++) if (chi[k] - clo[k] > chi[axis] - clo[axis]) axis = k;
        mid = (b + e) / 2;
        std::nth_element(R + b, R + mid, R + e, [&](const Ref& x, const Ref& y) { return x.lo[axis] + x.hi[axis] < y.lo[axis] + y.hi[axis]; });
        for (int q = 0; q < 3; q++) { lb[q] = rb[q] = 1e30f; lb[3 + q] = rb[3 + q] = -1e30f; }
        for (int i = b; i < e; i++) { float* t = i < mid ? lb : rb; for (int q = 0; q < 3; q++) { t[q] = std::min(t[q], R[i].lo[q]); t[3 + q] = std::max(t[3 + q], R[i].hi[q]); } }
    } else { for (int q = 0; q < 6; q++) { lb[q] = bestL[q]; rb[q] = bestR[q]; } }
    float lc[6], rc[6];
    for (int q = 0; q < 3; q++) { lc[q] = rc[q] = 1e30f; lc[3 + q] = rc[3 + q] = -1e30f; }
    for (int i = b; i < e; i++) { float* t = i < mid ? lc : rc; for (int q = 0; q < 3; q++) { float c = (R[i].lo[q] + R[i].hi[q]) * 0.5f; t[q] = std::min(t[q], c); t[3 + q] = std::max(t[3 + q], c); } }
    int id = g_next++;
    Info L, Rr;
    if (depth < PD && cnt > 2048) {
        std::thread th([&] { buildNode(b, mid, lb, lb + 3, lc, lc + 3, depth + 1, L); });
        buildNode(mid, e, rb, rb + 3, rc, rc + 3, depth + 1, Rr);
        th.join();
    } else {
        buildNode(b, mid, lb, lb + 3, lc, lc + 3, depth + 1, L);
        buildNode(mid, e, rb, rb + 3, rc, rc + 3, depth + 1, Rr);
    }
    GNode& g = h_nodes[id];
    writeChild(g, 0, L); writeChild(g, 1, Rr);
    out.idx = id; out.cnt = 0;
}

__global__ void make_wt(const Triangle* __restrict__ tris, const int* __restrict__ order, float4* wt, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x; if (i >= n) return;
    int o = order[i]; const Triangle& t = tris[o];
    wt[3 * i] = make_float4(t.v0[0], t.v0[1], t.v0[2], __int_as_float(o));
    wt[3 * i + 1] = make_float4(t.v1[0] - t.v0[0], t.v1[1] - t.v0[1], t.v1[2] - t.v0[2], 0);
    wt[3 * i + 2] = make_float4(t.v2[0] - t.v0[0], t.v2[1] - t.v0[1], t.v2[2] - t.v0[2], 0);
}

static int pf_threads(int n) { return std::max(1, std::min(g_nthreads, n / 8192 + 1)); }
static void parallel_for(int n, const std::function<void(int, int, int)>& f) {
    int T = pf_threads(n);
    std::vector<std::thread> th;
    for (int t = 1; t < T; t++) th.emplace_back([&, t] { f(t, int((long long)n * t / T), int((long long)n * (t + 1) / T)); });
    f(0, 0, int((long long)n / T));
    for (auto& x : th) x.join();
}

void init(int mt, int mp, int ms) {
    unsigned hc = std::thread::hardware_concurrency(); g_nthreads = std::max(1, std::min(12, int(hc ? hc : 12)));
    ck(cudaStreamCreateWithFlags(&stream, cudaStreamNonBlocking));
    ck(cudaMalloc(&d_tris, size_t(mt) * sizeof(Triangle)));
    ck(cudaMalloc(&d_nodes, (size_t(mt) + 2) * sizeof(GNode)));
    ck(cudaMalloc(&d_wt, size_t(mt) * 3 * sizeof(float4)));
    ck(cudaMalloc(&d_order, size_t(mt) * sizeof(int)));
    ck(cudaMallocHost(&h_nodes, (size_t(mt) + 2) * sizeof(GNode)));
    ck(cudaMallocHost(&h_order, size_t(mt) * sizeof(int)));
    g_refs = (Ref*)malloc(size_t(mt) * sizeof(Ref));
    memset(g_refs, 0, size_t(mt) * sizeof(Ref));
    memset(h_nodes, 0, (size_t(mt) + 2) * sizeof(GNode));
    warm_kernel<<<1, 1, 0, stream>>>();
    ck(cudaStreamSynchronize(stream));
}

#ifdef RT_TIMING
#define TP(name) do{auto _t=std::chrono::steady_clock::now();fprintf(stderr,"  %s %.3f ms\n",name,std::chrono::duration<double,std::milli>(_t-T0).count());}while(0)
#else
#define TP(name)
#endif

void render(const Scene& s, float* out) {
#ifdef RT_TIMING
    auto T0 = std::chrono::steady_clock::now();
#endif
    int N = s.triangle_count;
    size_t npix = size_t(s.width) * s.height;
    std::thread up([&] {
        ck(cudaMemcpyAsync(d_tris, s.triangles, size_t(N) * sizeof(Triangle), cudaMemcpyHostToDevice, stream));
        ck(cudaMemsetAsync(out, 0, npix * 3 * sizeof(float), stream));
    });
    struct Acc { float b[6], c[6]; };
    Acc acc[16];
    parallel_for(N, [&](int t, int lo, int hi) {
        Acc a; for (int q = 0; q < 3; q++) { a.b[q] = a.c[q] = 1e30f; a.b[3 + q] = a.c[3 + q] = -1e30f; }
        for (int i = lo; i < hi; i++) {
            const Triangle& tr = s.triangles[i]; Ref& r = g_refs[i]; r.id = i;
            for (int k = 0; k < 3; k++) {
                float x = tr.v0[k], y = tr.v1[k], z = tr.v2[k];
                float l = std::min(x, std::min(y, z)), h = std::max(x, std::max(y, z));
                r.lo[k] = l; r.hi[k] = h; float c = (l + h) * 0.5f;
                a.b[k] = std::min(a.b[k], l); a.b[3 + k] = std::max(a.b[3 + k], h);
                a.c[k] = std::min(a.c[k], c); a.c[3 + k] = std::max(a.c[3 + k], c);
            }
        }
        acc[t] = a;
    });
    int used = pf_threads(N);
    float bb[6], cb[6];
    for (int q = 0; q < 3; q++) { bb[q] = cb[q] = 1e30f; bb[3 + q] = cb[3 + q] = -1e30f; }
    for (int t = 0; t < used; t++) for (int q = 0; q < 3; q++) {
        bb[q] = std::min(bb[q], acc[t].b[q]); bb[3 + q] = std::max(bb[3 + q], acc[t].b[3 + q]);
        cb[q] = std::min(cb[q], acc[t].c[q]); cb[3 + q] = std::max(cb[3 + q], acc[t].c[3 + q]); }
    TP("refs");
    g_next = 0;
    Info root;
    buildNode(0, N, bb, bb + 3, cb, cb + 3, 0, root);
    if (root.cnt > 0) { g_next = 1; writeChild(h_nodes[0], 0, root); writeChild(h_nodes[0], 1, root); }
    int ng = g_next;
    TP("built");
    parallel_for(N, [&](int, int lo, int hi) { for (int i = lo; i < hi; i++) h_order[i] = g_refs[i].id; });
    up.join();
    TP("order");
    ck(cudaMemcpyAsync(d_nodes, h_nodes, size_t(ng) * sizeof(GNode), cudaMemcpyHostToDevice, stream));
    ck(cudaMemcpyAsync(d_order, h_order, size_t(N) * sizeof(int), cudaMemcpyHostToDevice, stream));
    make_wt<<<(N + 255) / 256, 256, 0, stream>>>(d_tris, d_order, d_wt, N);
    Scene d = s; d.triangles = nullptr;
    GQuery q{d_tris, d_nodes, d_wt};
    long long total = (long long)npix * s.spp;
    double cost = double(2 + s.ao) * s.max_depth;
    double budget = s.ao >= 8 || s.max_depth >= 6 ? 4.0e8 : 1.0e9;
    long long nch = (long long)ceil(total * cost / budget); if (nch < 1) nch = 1;
    long long chunk = (total + nch - 1) / nch; chunk = (chunk + 127) / 128 * 128;
    for (long long off = 0; off < total; off += chunk) {
        long long end = std::min(total, off + chunk);
        trace_kernel<<<unsigned((end - off + 127) / 128), 128, 0, stream>>>(d, q, out, off, end);
    }
    scale_kernel<<<unsigned((npix * 3 + 255) / 256), 256, 0, stream>>>(out, int(npix * 3), float(s.spp));
    ck(cudaGetLastError());
    TP("launched");
#ifdef RT_TIMING
    ck(cudaStreamSynchronize(stream));
    TP("done");
    fprintf(stderr, "  nodes %d\n", ng);
#endif
}
