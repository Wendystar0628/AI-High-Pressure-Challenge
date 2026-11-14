// GPU ray tracing acceleration: parallel SAH BVH + compact ordered traversal.
#define PAR_DEPTH 5
#define ORDERED_TRAVERSAL 1
#include "bvh.hpp"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <algorithm>

static void ck(cudaError_t e) {
    if (e != cudaSuccess) {
        fprintf(stderr, "solution: %s\n", cudaGetErrorString(e));
        exit(2);
    }
}

// Compact BVH node (32 B). Interior: left/right = child indices.
// Leaf: left = start index into ids, right = -count.
struct BNode {
    float lo[3], hi[3];
    int left, right;
};

static Triangle* d_tris = nullptr;
static BNode* d_nodes = nullptr;
static int* d_ids = nullptr;
static float* d_accum = nullptr;
static BNode* h_nodes = nullptr;

void init(int max_triangles, int max_pixels, int max_samples) {
    (void)max_samples;
    ck(cudaMalloc(&d_tris, (size_t)max_triangles * sizeof(Triangle)));
    ck(cudaMalloc(&d_nodes, (2 * (size_t)max_triangles + 1) * sizeof(BNode)));
    ck(cudaMalloc(&d_ids, (size_t)max_triangles * sizeof(int)));
    ck(cudaMalloc(&d_accum, 3 * (size_t)max_pixels * sizeof(float)));
    h_nodes = (BNode*)malloc((2 * (size_t)max_triangles + 1) * sizeof(BNode));
    if (!h_nodes) {
        fprintf(stderr, "solution: host alloc failed\n");
        exit(2);
    }
}

__device__ __forceinline__ bool boxTest(const float* __restrict__ lo,
                                        const float* __restrict__ hi,
                                        float ox, float oy, float oz,
                                        float idx, float idy, float idz,
                                        float limit, float& near) {
    float tmin = 0.0002f, tmax = limit;
    float t0 = (lo[0] - ox) * idx, t1 = (hi[0] - ox) * idx;
    tmin = fmaxf(tmin, fminf(t0, t1));
    tmax = fminf(tmax, fmaxf(t0, t1));
    t0 = (lo[1] - oy) * idy;
    t1 = (hi[1] - oy) * idy;
    tmin = fmaxf(tmin, fminf(t0, t1));
    tmax = fminf(tmax, fmaxf(t0, t1));
    t0 = (lo[2] - oz) * idz;
    t1 = (hi[2] - oz) * idz;
    tmin = fmaxf(tmin, fminf(t0, t1));
    tmax = fminf(tmax, fmaxf(t0, t1));
    near = tmin;
    return tmin <= tmax;
}

struct FastQuery {
    const Triangle* tris;
    const BNode* nodes;
    const int* ids;
    __device__ const Triangle& triangle(int id) const { return tris[id]; }
#if ORDERED_TRAVERSAL
    __device__ Hit<float> find(Ray<float> r, float limit, bool any) const {
        Hit<float> hit{limit, -1};
        const float ox = r.o.x, oy = r.o.y, oz = r.o.z;
        const float idx = 1.0f / r.d.x, idy = 1.0f / r.d.y, idz = 1.0f / r.d.z;
        int stk[64];
        float snr[64];
        int sp = 0;
        float nr;
        if (!boxTest(nodes[0].lo, nodes[0].hi, ox, oy, oz, idx, idy, idz, hit.t, nr))
            return hit;
        int cur = 0;
        for (;;) {
            const BNode n = nodes[cur];
            if (n.right < 0) {
                const int st = n.left, cnt = -n.right;
                for (int i = 0; i < cnt; i++) {
                    const int id = ids[st + i];
                    float d;
                    if (intersect(tris[id], r, hit.t, d)) {
                        hit.t = d;
                        hit.id = id;
                        if (any) return hit;
                    }
                }
            } else {
                const int lc = n.left, rc = n.right;
                float ln, rn;
                const bool hl = boxTest(nodes[lc].lo, nodes[lc].hi, ox, oy, oz, idx, idy, idz, hit.t, ln);
                const bool hr = boxTest(nodes[rc].lo, nodes[rc].hi, ox, oy, oz, idx, idy, idz, hit.t, rn);
                if (hl && hr) {
                    if (ln <= rn) {
                        stk[sp] = rc;
                        snr[sp] = rn;
                        sp++;
                        cur = lc;
                    } else {
                        stk[sp] = lc;
                        snr[sp] = ln;
                        sp++;
                        cur = rc;
                    }
                    continue;
                }
                if (hl) {
                    cur = lc;
                    continue;
                }
                if (hr) {
                    cur = rc;
                    continue;
                }
            }
            for (;;) {
                if (sp == 0) return hit;
                sp--;
                if (snr[sp] <= hit.t) {
                    cur = stk[sp];
                    break;
                }
            }
        }
    }
#else
    __device__ Hit<float> find(Ray<float> r, float limit, bool any) const {
        Hit<float> hit{limit, -1};
        const float ox = r.o.x, oy = r.o.y, oz = r.o.z;
        const float idx = 1.0f / r.d.x, idy = 1.0f / r.d.y, idz = 1.0f / r.d.z;
        int stack[64], sp = 0;
        stack[sp++] = 0;
        while (sp) {
            const BNode n = nodes[stack[--sp]];
            float near;
            if (!boxTest(n.lo, n.hi, ox, oy, oz, idx, idy, idz, hit.t, near)) continue;
            if (n.right < 0) {
                const int st = n.left, cnt = -n.right;
                for (int i = 0; i < cnt; i++) {
                    const int id = ids[st + i];
                    float d;
                    if (intersect(tris[id], r, hit.t, d)) {
                        hit.t = d;
                        hit.id = id;
                        if (any) return hit;
                    }
                }
            } else {
                stack[sp++] = n.left;
                stack[sp++] = n.right;
            }
        }
        return hit;
    }
#endif
    __device__ Hit<float> closest(Ray<float> r, float limit) const { return find(r, limit, false); }
    __device__ bool blocked(Ray<float> r, float limit) const { return find(r, limit, true).id >= 0; }
};

__global__ void traceAdd(Scene s, FastQuery q, float* accum, int sid, int begin, int end) {
    int p = begin + blockIdx.x * blockDim.x + threadIdx.x;
    if (p >= end) return;
    V<float> c = radiance<float>(s, p, sid, q);
    size_t o = 3 * (size_t)p;
    accum[o] += c.x;
    accum[o + 1] += c.y;
    accum[o + 2] += c.z;
}

__global__ void finalize(const float* accum, float* out, int pixels, int spp) {
    int p = blockIdx.x * blockDim.x + threadIdx.x;
    if (p >= pixels) return;
    size_t o = 3 * (size_t)p;
    float d = (float)spp;
    out[o] = accum[o] / d;
    out[o + 1] = accum[o + 1] / d;
    out[o + 2] = accum[o + 2] / d;
}

void render(const Scene& s, float* out) {
    const int N = s.triangle_count;
    const int pixels = s.width * s.height;
    SahBuilder tree(s);
    const int nn = (int)tree.nodes.size();
    for (int i = 0; i < nn; i++) {
        const Node& src = tree.nodes[i];
        BNode& dst = h_nodes[i];
        for (int k = 0; k < 3; k++) {
            dst.lo[k] = src.lo[k] - 1e-4f;
            dst.hi[k] = src.hi[k] + 1e-4f;
        }
        if (src.count > 0) {
            dst.left = src.start;
            dst.right = -src.count;
        } else {
            dst.left = src.left;
            dst.right = src.right;
        }
    }
    ck(cudaMemcpy(d_tris, s.triangles, (size_t)N * sizeof(Triangle), cudaMemcpyHostToDevice));
    ck(cudaMemcpy(d_nodes, h_nodes, (size_t)nn * sizeof(BNode), cudaMemcpyHostToDevice));
    ck(cudaMemcpy(d_ids, tree.order.data(), (size_t)N * sizeof(int), cudaMemcpyHostToDevice));
    ck(cudaMemsetAsync(d_accum, 0, 3 * (size_t)pixels * sizeof(float), 0));
    Scene ds = s;
    ds.triangles = nullptr;
    FastQuery q{d_tris, d_nodes, d_ids};
    const long long qps = (long long)s.max_depth * (2 + s.ao) + 2;
    int chunk = pixels;
    const long long CAP = 120000000LL;
    if ((long long)pixels * qps > CAP) {
        chunk = (int)(CAP / qps);
        if (chunk < 8192) chunk = 8192;
        if (chunk > pixels) chunk = pixels;
    }
    for (int sid = 0; sid < s.spp; sid++) {
        for (int b = 0; b < pixels; b += chunk) {
            const int e = std::min(b + chunk, pixels);
            const int n = e - b;
            traceAdd<<<(n + 127) / 128, 128>>>(ds, q, d_accum, sid, b, e);
        }
    }
    finalize<<<(pixels + 127) / 128, 128>>>(d_accum, out, pixels, s.spp);
    ck(cudaGetLastError());
}
