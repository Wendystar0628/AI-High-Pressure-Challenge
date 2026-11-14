// Fast CUDA ray tracer for the given render_math contract.
#include "rt.h"
#include <cuda_runtime.h>
#include <vector>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <thread>
#include <atomic>
#include <intrin.h>

#define BINS 16
#define MAXST 48

struct __align__(32) DNode { float lo[3]; int child; float hi[3]; int count; };
// hot data for intersection tests
struct __align__(4) DTriX { float3 v0, e1, e2; };
// shading data, only touched on an actual hit
struct __align__(4) DTriS { float3 n, col; float mirror; };

static __device__ __forceinline__ float3 f3(float a, float b, float c) { return make_float3(a,b,c); }
static __device__ __forceinline__ float3 fadd(float3 a, float3 b) { return f3(a.x+b.x,a.y+b.y,a.z+b.z); }
static __device__ __forceinline__ float3 fsub(float3 a, float3 b) { return f3(a.x-b.x,a.y-b.y,a.z-b.z); }
static __device__ __forceinline__ float3 fmul(float3 a, float s) { return f3(a.x*s,a.y*s,a.z*s); }
static __device__ __forceinline__ float3 fmul3(float3 a, float3 b) { return f3(a.x*b.x,a.y*b.y,a.z*b.z); }
static __device__ __forceinline__ float fdot(float3 a, float3 b) { return a.x*b.x+a.y*b.y+a.z*b.z; }
static __device__ __forceinline__ float3 fcross(float3 a, float3 b) { return f3(a.y*b.z-a.z*b.y, a.z*b.x-a.x*b.z, a.x*b.y-a.y*b.x); }
static __device__ __forceinline__ float3 fneg(float3 a) { return f3(-a.x,-a.y,-a.z); }
static __device__ __forceinline__ float3 fnormalize(float3 a) { float s = rsqrtf(fdot(a,a)); return f3(a.x*s,a.y*s,a.z*s); }

struct GScene {
    float eye[3], u[3], v[3], w[3], light[3], ao_radius;
    int width, height, spp, ao, max_depth;
    unsigned seed;
};

__device__ __forceinline__ uint32_t mix32(uint32_t x) { x^=x>>16; x*=0x7feb352du; x^=x>>15; x*=0x846ca68bu; return x^(x>>16); }
__device__ __forceinline__ float samplef(uint32_t x) { return float(mix32(x)>>8) * (1.0f/16777216.0f); }

__device__ __forceinline__ float3 camDir(const GScene& s, int pixel, int sid) {
    uint32_t key = s.seed + uint32_t(pixel)*0x9e3779b9u + uint32_t(sid)*0x85ebca6bu;
    float x = (float(pixel % s.width) + samplef(key)) / float(s.width) * 2.0f - 1.0f;
    float y = 1.0f - (float(pixel / s.width) + samplef(key^0xa511e9b3u)) / float(s.height) * 2.0f;
    float3 d = f3(s.w[0] + s.u[0]*x + s.v[0]*y,
                  s.w[1] + s.u[1]*x + s.v[1]*y,
                  s.w[2] + s.u[2]*x + s.v[2]*y);
    return fnormalize(d);
}

__device__ __forceinline__ float3 safeInv(float3 d) {
    float3 r;
    r.x = fabsf(d.x) > 1e-20f ? __fdividef(1.0f, d.x) : 1e30f;
    r.y = fabsf(d.y) > 1e-20f ? __fdividef(1.0f, d.y) : 1e30f;
    r.z = fabsf(d.z) > 1e-20f ? __fdividef(1.0f, d.z) : 1e30f;
    return r;
}

__device__ __forceinline__ float3 scaleOrig(float3 o, float3 inv) {
    return f3(-(o.x*inv.x), -(o.y*inv.y), -(o.z*inv.z));
}

__device__ __forceinline__ bool boxHit(const DNode& n, float3 so, float3 inv, float tmax, float& tnear) {
    float t0 = fmaf(n.lo[0], inv.x, so.x), t1 = fmaf(n.hi[0], inv.x, so.x);
    float tmin = fminf(t0, t1), tmx = fmaxf(t0, t1);
    t0 = fmaf(n.lo[1], inv.y, so.y); t1 = fmaf(n.hi[1], inv.y, so.y);
    tmin = fmaxf(tmin, fminf(t0, t1)); tmx = fminf(tmx, fmaxf(t0, t1));
    t0 = fmaf(n.lo[2], inv.z, so.z); t1 = fmaf(n.hi[2], inv.z, so.z);
    tmin = fmaxf(tmin, fminf(t0, t1)); tmx = fminf(tmx, fmaxf(t0, t1));
    tmin = fmaxf(tmin, 0.0f);
    if (tmin > tmx || tmin > tmax) return false;
    tnear = tmin;
    return true;
}

__device__ __forceinline__ bool isect(const DTriX& t, float3 o, float3 d, float limit, float& dist) {
    float3 p = fcross(d, t.e2);
    float det = fdot(t.e1, p);
    if (fabsf(det) < 1e-10f) return false;
    float inv = __fdividef(1.0f, det);
    float3 s = fsub(o, t.v0);
    float u = fdot(s, p) * inv;
    if (u < 0.0f || u > 1.0f) return false;
    float3 q = fcross(s, t.e1);
    float v = fdot(d, q) * inv;
    if (v < 0.0f || u + v > 1.0f) return false;
    float dd = fdot(t.e2, q) * inv;
    if (dd <= 0.0002f || dd >= limit) return false;
    dist = dd;
    return true;
}

__device__ __forceinline__ bool closest(const DNode* __restrict__ nodes, const DTriX* __restrict__ tris,
                                        float3 o, float3 d, float3 inv, float limit, float& bestT, int& bestId) {
    float bt = limit; int bid = -1;
    float3 so = scaleOrig(o, inv);
    int stack[MAXST]; int sp = 0; stack[sp++] = 0;
    while (sp) {
        int ci = stack[--sp];
        const DNode& n = nodes[ci];
        float tn;
        if (!boxHit(n, so, inv, bt, tn)) continue;
        if (n.count > 0) {
            const DTriX* tp = tris + n.child;
            int cnt = n.count;
            for (int k = 0; k < cnt; k++) {
                float dt;
                if (isect(tp[k], o, d, bt, dt)) { bt = dt; bid = n.child + k; }
            }
        } else {
            int c = n.child;
            stack[sp++] = c; stack[sp++] = c+1;
        }
    }
    bestT = bt; bestId = bid;
    return bid >= 0;
}

__device__ __forceinline__ bool blocked(const DNode* __restrict__ nodes, const DTriX* __restrict__ tris,
                                        float3 o, float3 d, float3 inv, float limit) {
    float tn;
    float3 so = scaleOrig(o, inv);
    if (!boxHit(nodes[0], so, inv, limit, tn)) return false;
    int stack[MAXST]; int sp = 0; int ci = 0;
    for (;;) {
        const DNode& n = nodes[ci];
        if (n.count > 0) {
            const DTriX* tp = tris + n.child;
            int cnt = n.count;
            for (int k = 0; k < cnt; k++) { float dt; if (isect(tp[k], o, d, limit, dt)) return true; }
        } else {
            int c = n.child;
            float t0, t1;
            bool h0 = boxHit(nodes[c], so, inv, limit, t0);
            bool h1 = boxHit(nodes[c+1], so, inv, limit, t1);
            if (h0 && h1) {
                if (t0 <= t1) { stack[sp++] = c+1; ci = c; }
                else { stack[sp++] = c; ci = c+1; }
                continue;
            } else if (h0) { ci = c; continue; }
            else if (h1) { ci = c+1; continue; }
        }
        if (!sp) return false;
        ci = stack[--sp];
    }
}

__device__ __forceinline__ float3 radiance(const GScene& s, const DNode* __restrict__ nodes,
                                           const DTriX* __restrict__ tris, const DTriS* __restrict__ sh,
                                           int pixel, int sid) {
    float3 o = f3(s.eye[0], s.eye[1], s.eye[2]);
    float3 d = camDir(s, pixel, sid);
    float3 res = f3(0,0,0);
    float3 through = f3(1,1,1);
    float3 l = f3(s.light[0], s.light[1], s.light[2]);
    for (int depth = 0; depth < s.max_depth; depth++) {
        float t; int id;
        if (!closest(nodes, tris, o, d, safeInv(d), 1e20f, t, id)) {
            float a = 0.5f*(d.y+1.0f);
            float3 bg = fadd(fmul(f3(0.95f,0.93f,0.95f), 1.0f-a), fmul(f3(0.40f,0.55f,0.85f), a));
            res = fadd(res, fmul3(through, bg));
            break;
        }
        const DTriS& ts = sh[id];
        float3 n = ts.n;
        if (fdot(n, d) > 0.0f) n = fneg(n);
        float3 p = fadd(fadd(o, fmul(d, t)), fmul(n, 0.001f));
        float cosine = fdot(n, l); if (cosine < 0.0f) cosine = 0.0f;
        float visible = 0.0f;
        if (cosine > 0.0f) {
            if (!blocked(nodes, tris, p, l, safeInv(l), 1e20f)) visible = 1.0f;
        }
        int open = 0;
        if (s.ao) {
            float3 axis = fabsf(n.z) < 0.8f ? f3(0,0,1) : f3(0,1,0);
            float3 tx = fnormalize(fcross(axis, n));
            float3 ty = fcross(n, tx);
            for (int a = 0; a < s.ao; a++) {
                uint32_t key = s.seed + uint32_t(pixel)*0x9e3779b9u + uint32_t(sid)*0x85ebca6bu
                             + uint32_t(depth)*0xc2b2ae35u + uint32_t(a)*0x27d4eb2du;
                float x = 2.0f*samplef(key^0x68bc21ebu) - 1.0f;
                float y = 2.0f*samplef(key^0x02e5be93u) - 1.0f;
                float z = 0.25f + 0.75f*samplef(key^0x967a889bu);
                float3 dir = fnormalize(fadd(fadd(fmul(tx, x), fmul(ty, y)), fmul(n, z)));
                open += blocked(nodes, tris, p, dir, safeInv(dir), s.ao_radius) ? 0 : 1;
            }
        }
        float ambient = s.ao ? float(open)/float(s.ao) : 1.0f;
        float value = 0.08f + 0.20f*ambient + 0.72f*cosine*visible;
        res = fadd(res, fmul(fmul3(through, ts.col), value*(1.0f - ts.mirror)));
        through = fmul(through, ts.mirror);
        if (ts.mirror == 0.0f) break;
        d = fnormalize(fsub(d, fmul(n, 2.0f*fdot(d, n))));
        o = p;
    }
    return res;
}

__global__ void __launch_bounds__(256, 4)
traceKernel(GScene s, const DNode* __restrict__ nodes, const DTriX* __restrict__ trix,
            const DTriS* __restrict__ trs, float* __restrict__ out, int p0, int p1) {
    int gwarp = (blockIdx.x*blockDim.x + threadIdx.x) >> 5;
    int lane = threadIdx.x & 31;
    int p = p0 + gwarp;
    if (p >= p1) return;
    float3 acc = f3(0,0,0);
    int spp = s.spp;
    for (int j = lane; j < spp; j += 32) acc = fadd(acc, radiance(s, nodes, trix, trs, p, j));
    #pragma unroll
    for (int off = 16; off; off >>= 1) {
        acc.x += __shfl_down_sync(0xffffffffu, acc.x, off);
        acc.y += __shfl_down_sync(0xffffffffu, acc.y, off);
        acc.z += __shfl_down_sync(0xffffffffu, acc.z, off);
    }
    if (lane == 0) {
        float inv = 1.0f/float(spp);
        out[3*(size_t)p+0] = acc.x*inv;
        out[3*(size_t)p+1] = acc.y*inv;
        out[3*(size_t)p+2] = acc.z*inv;
    }
}

__global__ void prepTris(const Triangle* __restrict__ src, const int* __restrict__ order,
                         DTriX* __restrict__ tx, DTriS* __restrict__ ts, int n) {
    int i = blockIdx.x*blockDim.x + threadIdx.x;
    if (i >= n) return;
    const Triangle& t = src[order ? order[i] : i];
    float3 v0 = f3(t.v0[0], t.v0[1], t.v0[2]);
    float3 e1 = f3(t.v1[0]-t.v0[0], t.v1[1]-t.v0[1], t.v1[2]-t.v0[2]);
    float3 e2 = f3(t.v2[0]-t.v0[0], t.v2[1]-t.v0[1], t.v2[2]-t.v0[2]);
    DTriX x; x.v0 = v0; x.e1 = e1; x.e2 = e2;
    DTriS s; s.n = fnormalize(fcross(e1, e2)); s.col = f3(t.color[0], t.color[1], t.color[2]); s.mirror = t.mirror;
    tx[i] = x; ts[i] = s;
}


// ======================= GPU BVH build =======================
#define GBINS 16
struct TInfoD { float lo[3], hi[3], cen[3]; int id; };
struct GBox { float lo[3], hi[3], clo[3], chi[3]; };
struct GTask { int node, start, cnt; };

__device__ __forceinline__ float dcarea(const float* a, const float* b) {
    float x = b[0]-a[0], y = b[1]-a[1], z = b[2]-a[2];
    return x*y + y*z + z*x;
}
__device__ __forceinline__ unsigned fkey(float f) {
    unsigned i = __float_as_uint(f);
    return (i & 0x80000000u) ? (~i) : (i | 0x80000000u);
}
__device__ __forceinline__ float funkey(unsigned k) {
    return (k & 0x80000000u) ? __uint_as_float(k & 0x7fffffffu) : __uint_as_float(~k);
}

__global__ void gb_fillInfo(const Triangle* __restrict__ src, TInfoD* __restrict__ info, int n) {
    int i = blockIdx.x*blockDim.x + threadIdx.x;
    if (i >= n) return;
    const Triangle& t = src[i];
    TInfoD q;
    for (int k = 0; k < 3; k++) {
        float a = t.v0[k], b = t.v1[k], c = t.v2[k];
        float l = fminf(a, fminf(b, c)), h = fmaxf(a, fmaxf(b, c));
        q.lo[k] = l; q.hi[k] = h; q.cen[k] = (l+h)*0.5f;
    }
    q.id = i;
    info[i] = q;
}

__global__ void gb_root(const TInfoD* __restrict__ info, int n, GBox* __restrict__ nbox,
                        GTask* __restrict__ tasks, int* __restrict__ nTasks) {
    __shared__ float rl[32][12];
    int ti = threadIdx.x;
    float acc[12];
    #pragma unroll
    for (int k = 0; k < 12; k++) acc[k] = (k & 1) ? -1e30f : 1e30f;
    for (int i = ti; i < n; i += blockDim.x) {
        TInfoD q = info[i];
        acc[0]=fminf(acc[0],q.lo[0]); acc[1]=fmaxf(acc[1],q.lo[0]);
        acc[2]=fminf(acc[2],q.lo[1]); acc[3]=fmaxf(acc[3],q.lo[1]);
        acc[4]=fminf(acc[4],q.lo[2]); acc[5]=fmaxf(acc[5],q.lo[2]);
        acc[6]=fminf(acc[6],q.cen[0]); acc[7]=fmaxf(acc[7],q.cen[0]);
        acc[8]=fminf(acc[8],q.cen[1]); acc[9]=fmaxf(acc[9],q.cen[1]);
        acc[10]=fminf(acc[10],q.cen[2]); acc[11]=fmaxf(acc[11],q.cen[2]);
    }
    #pragma unroll
    for (int off = 16; off; off >>= 1) {
        #pragma unroll
        for (int k = 0; k < 12; k++) {
            float v = __shfl_down_sync(0xffffffffu, acc[k], off);
            acc[k] = (k & 1) ? fmaxf(acc[k], v) : fminf(acc[k], v);
        }
    }
    int lane = ti & 31, wid = ti >> 5;
    if (lane == 0) for (int k = 0; k < 12; k++) rl[wid][k] = acc[k];
    __syncthreads();
    if (ti == 0) {
        int nw = (int)(blockDim.x >> 5);
        for (int w = 1; w < nw; w++)
            for (int k = 0; k < 12; k++)
                rl[0][k] = (k & 1) ? fmaxf(rl[0][k], rl[w][k]) : fminf(rl[0][k], rl[w][k]);
        GBox b;
        b.lo[0]=rl[0][0]; b.hi[0]=rl[0][1];
        b.lo[1]=rl[0][2]; b.hi[1]=rl[0][3];
        b.lo[2]=rl[0][4]; b.hi[2]=rl[0][5];
        b.clo[0]=rl[0][6]; b.chi[0]=rl[0][7];
        b.clo[1]=rl[0][8]; b.chi[1]=rl[0][9];
        b.clo[2]=rl[0][10]; b.chi[2]=rl[0][11];
        nbox[0] = b;
        tasks[0].node = 0; tasks[0].start = 0; tasks[0].cnt = n;
        *nTasks = 1;
    }
}

__global__ void gb_level(TInfoD* __restrict__ info, TInfoD* __restrict__ infoTmp,
                         const GTask* __restrict__ tasks, GTask* __restrict__ tasksOut,
                         int* __restrict__ nOut, GBox* __restrict__ nbox,
                         DNode* __restrict__ nodes, int* __restrict__ nalloc) {
    __shared__ unsigned slo[GBINS][3], shi[GBINS][3], sclo[GBINS][3], schi[GBINS][3];
    __shared__ int scnt[GBINS], swr[GBINS], soff[GBINS+1];
    __shared__ int ssplit;
    int ti = threadIdx.x;
    GTask t = tasks[blockIdx.x];
    GBox nb = nbox[t.node];
    DNode* ndp = nodes + t.node;
    for (int j = ti; j < GBINS; j += blockDim.x) {
        scnt[j] = 0; swr[j] = 0;
        for (int k = 0; k < 3; k++) {
            slo[j][k] = 0xffffffffu; shi[j][k] = 0x80000000u;
            sclo[j][k] = 0xffffffffu; schi[j][k] = 0x80000000u;
        }
    }
    if (ti == 0) ssplit = -2;
    __syncthreads();

    int en = t.start + t.cnt;
    float e0 = nb.chi[0]-nb.clo[0], e1 = nb.chi[1]-nb.clo[1], e2 = nb.chi[2]-nb.clo[2];
    int axis = (e0 >= e1 && e0 >= e2) ? 0 : (e1 >= e2 ? 1 : 2);
    float ext = (axis == 0) ? e0 : ((axis == 1) ? e1 : e2);
    float c0 = (axis == 0) ? nb.clo[0] : ((axis == 1) ? nb.clo[1] : nb.clo[2]);
    bool canSplit = (t.cnt > 2) && (ext > 1e-9f);
    float scale = canSplit ? GBINS/ext*(1.0f - 1e-6f) : 0.0f;

    if (canSplit) {
        for (int i = t.start + ti; i < en; i += blockDim.x) {
            TInfoD q = info[i];
            int j = (int)((q.cen[axis] - c0) * scale);
            if (j < 0) j = 0; if (j >= GBINS) j = GBINS-1;
            atomicAdd(&scnt[j], 1);
            unsigned k0 = fkey(q.lo[0]), k1 = fkey(q.lo[1]), k2 = fkey(q.lo[2]);
            atomicMin(&slo[j][0], k0); atomicMin(&slo[j][1], k1); atomicMin(&slo[j][2], k2);
            atomicMax(&shi[j][0], k0); atomicMax(&shi[j][1], k1); atomicMax(&shi[j][2], k2);
            unsigned m0 = fkey(q.cen[0]), m1 = fkey(q.cen[1]), m2 = fkey(q.cen[2]);
            atomicMin(&sclo[j][0], m0); atomicMin(&sclo[j][1], m1); atomicMin(&sclo[j][2], m2);
            atomicMax(&schi[j][0], m0); atomicMax(&schi[j][1], m1); atomicMax(&schi[j][2], m2);
        }
    }
    __syncthreads();

    if (ti == 0) {
        float flo[3], fhi[3];
        for (int k = 0; k < 3; k++) { flo[k] = 1e30f; fhi[k] = -1e30f; }
        if (canSplit) {
            for (int j = 0; j < GBINS; j++) {
                if (!scnt[j]) continue;
                for (int k = 0; k < 3; k++) {
                    float a = funkey(slo[j][k]), b = funkey(shi[j][k]);
                    if (a < flo[k]) flo[k] = a;
                    if (b > fhi[k]) fhi[k] = b;
                }
            }
        } else {
            for (int i = t.start; i < en; i++) {
                TInfoD q = info[i];
                for (int k = 0; k < 3; k++) { flo[k] = fminf(flo[k], q.lo[k]); fhi[k] = fmaxf(fhi[k], q.hi[k]); }
            }
        }
        ndp->lo[0] = flo[0]-2e-5f; ndp->lo[1] = flo[1]-2e-5f; ndp->lo[2] = flo[2]-2e-5f;
        ndp->hi[0] = fhi[0]+2e-5f; ndp->hi[1] = fhi[1]+2e-5f; ndp->hi[2] = fhi[2]+2e-5f;
        ndp->count = t.cnt; ndp->child = t.start;
        int split = -1;
        if (canSplit) {
            float rarea[GBINS+1]; int rcnt[GBINS+1];
            float alo[3] = {1e30f,1e30f,1e30f}, ahi[3] = {-1e30f,-1e30f,-1e30f};
            int ac = 0;
            rarea[GBINS] = 0.0f; rcnt[GBINS] = 0;
            for (int j = GBINS-1; j > 0; j--) {
                ac += scnt[j];
                if (scnt[j]) for (int k = 0; k < 3; k++) {
                    float a = funkey(slo[j][k]), b = funkey(shi[j][k]);
                    if (a < alo[k]) alo[k] = a; if (b > ahi[k]) ahi[k] = b;
                }
                rcnt[j] = ac;
                rarea[j] = ac ? dcarea(alo, ahi) : 0.0f;
            }
            for (int k = 0; k < 3; k++) { alo[k] = 1e30f; ahi[k] = -1e30f; }
            ac = 0;
            float best = 1e30f; int bb = -1;
            for (int j = 1; j < GBINS; j++) {
                ac += scnt[j-1];
                if (scnt[j-1]) for (int k = 0; k < 3; k++) {
                    float a = funkey(slo[j-1][k]), b = funkey(shi[j-1][k]);
                    if (a < alo[k]) alo[k] = a; if (b > ahi[k]) ahi[k] = b;
                }
                if (!ac || !rcnt[j]) continue;
                float c = dcarea(alo, ahi)*float(ac) + rarea[j]*float(rcnt[j]);
                if (c < best) { best = c; bb = j; }
            }
            float parea = dcarea(flo, fhi);
            if (bb >= 0 && (parea <= 0.0f || best < parea*float(t.cnt))) split = bb;
        }
        if (split >= 0) {
            int lc = 0;
            for (int j = 0; j < split; j++) lc += scnt[j];
            int child = atomicAdd(nalloc, 2);
            ndp->count = 0; ndp->child = child;
            for (int half = 0; half < 2; half++) {
                GBox cb;
                for (int k = 0; k < 3; k++) { cb.lo[k] = 1e30f; cb.hi[k] = -1e30f; cb.clo[k] = 1e30f; cb.chi[k] = -1e30f; }
                int j0 = half ? split : 0, j1 = half ? GBINS : split;
                for (int j = j0; j < j1; j++) {
                    if (!scnt[j]) continue;
                    for (int k = 0; k < 3; k++) {
                        float a = funkey(slo[j][k]), b = funkey(shi[j][k]);
                        float u = funkey(sclo[j][k]), v = funkey(schi[j][k]);
                        if (a < cb.lo[k]) cb.lo[k] = a;
                        if (b > cb.hi[k]) cb.hi[k] = b;
                        if (u < cb.clo[k]) cb.clo[k] = u;
                        if (v > cb.chi[k]) cb.chi[k] = v;
                    }
                }
                nbox[child+half] = cb;
            }
            soff[0] = 0;
            for (int j = 0; j < GBINS; j++) soff[j+1] = soff[j] + scnt[j];
            for (int j = 0; j < GBINS; j++) swr[j] = soff[j];
            int ti2 = atomicAdd(nOut, 2);
            tasksOut[ti2].node = child; tasksOut[ti2].start = t.start; tasksOut[ti2].cnt = lc;
            tasksOut[ti2+1].node = child+1; tasksOut[ti2+1].start = t.start + lc; tasksOut[ti2+1].cnt = t.cnt - lc;
            ssplit = split;
        } else {
            ssplit = -1;
        }
    }
    __syncthreads();
    if (ssplit >= 0) {
        for (int i = t.start + ti; i < en; i += blockDim.x) {
            TInfoD q = info[i];
            int j = (int)((q.cen[axis] - c0) * scale);
            if (j < 0) j = 0; if (j >= GBINS) j = GBINS-1;
            int pos = atomicAdd(&swr[j], 1);
            infoTmp[t.start + pos] = q;
        }
    } else {
        for (int i = t.start + ti; i < en; i += blockDim.x) infoTmp[i] = info[i];
    }
}

__global__ void gb_perm(const TInfoD* __restrict__ info, int* __restrict__ order, int n) {
    int i = blockIdx.x*blockDim.x + threadIdx.x;
    if (i < n) order[i] = info[i].id;
}
// ============================================================

// ------------------------------- host side -------------------------------
static DNode* g_nodes = nullptr;
static DTriX* g_trix = nullptr;
static DTriS* g_trs = nullptr;
static Triangle* g_src = nullptr;
static int* g_order = nullptr;
static TInfoD* g_info = nullptr;
static TInfoD* g_infoTmp = nullptr;
static GBox* g_nbox = nullptr;
static GTask* g_tasks = nullptr;
static GTask* g_tasks2 = nullptr;
static int* g_cnt = nullptr;

static inline float carea(const float* a, const float* b) {
    float x = b[0]-a[0], y = b[1]-a[1], z = b[2]-a[2];
    return x*y + y*z + z*x;
}

struct TInfo { float lo[3], hi[3], cen[3]; int id; };

struct Builder {
    const Triangle* T; int N;
    std::vector<TInfo> info;
    std::vector<DNode> nodes;
    std::atomic<int> alloc{1};
    float gclo[3], gchi[3];
    std::atomic<int> fronte{0};
    std::vector<int> frontier;
    int stopDepth = 1 << 30;

    Builder(const Triangle* t, int n) : T(t), N(n) {
        info.resize(N);
        for (int i = 0; i < N; i++) {
            const Triangle& t2 = T[i];
            TInfo& q = info[i];
            for (int k = 0; k < 3; k++) {
                float a = t2.v0[k], b = t2.v1[k], c = t2.v2[k];
                float l = fminf(a, fminf(b, c)), h = fmaxf(a, fmaxf(b, c));
                q.lo[k] = l; q.hi[k] = h; q.cen[k] = (l+h)*0.5f;
            }
            q.id = i;
        }
        for (int k = 0; k < 3; k++) { gclo[k] = 1e30f; gchi[k] = -1e30f; }
        for (int i = 0; i < N; i++) {
            const TInfo& q = info[i];
            for (int k = 0; k < 3; k++) {
                if (q.cen[k] < gclo[k]) gclo[k] = q.cen[k];
                if (q.cen[k] > gchi[k]) gchi[k] = q.cen[k];
            }
        }
    }

    void buildNode(int node, int st, int cnt, int depth, const float* pcLo, const float* pcHi) {
        if (depth == stopDepth) {
            frontier.push_back(node); frontier.push_back(st); frontier.push_back(cnt);
            return;
        }
        int en = st + cnt;
        DNode& nd = nodes[node];
        if (cnt <= 2 || depth >= 40) {
            float flo[3], fhi[3];
            for (int k = 0; k < 3; k++) { flo[k] = 1e30f; fhi[k] = -1e30f; }
            for (int i = st; i < en; i++) {
                const TInfo& q = info[i];
                for (int k = 0; k < 3; k++) {
                    flo[k] = fminf(flo[k], q.lo[k]); fhi[k] = fmaxf(fhi[k], q.hi[k]);
                }
            }
            for (int k = 0; k < 3; k++) { nd.lo[k] = flo[k] - 2e-5f; nd.hi[k] = fhi[k] + 2e-5f; }
            nd.count = cnt; nd.child = st;
            return;
        }
        float clo[3], chi[3];
        if (pcLo) { for (int k = 0; k < 3; k++) { clo[k] = pcLo[k]; chi[k] = pcHi[k]; } }
        else {
            for (int k = 0; k < 3; k++) { clo[k] = 1e30f; chi[k] = -1e30f; }
            for (int i = st; i < en; i++) {
                const TInfo& q = info[i];
                for (int k = 0; k < 3; k++) {
                    clo[k] = fminf(clo[k], q.cen[k]); chi[k] = fmaxf(chi[k], q.cen[k]);
                }
            }
        }
        int axis = 0;
        for (int k = 1; k < 3; k++) if (chi[k]-clo[k] > chi[axis]-clo[axis]) axis = k;
        float ext = chi[axis] - clo[axis];
        if (ext < 1e-9f) {
            float flo[3], fhi[3];
            for (int k = 0; k < 3; k++) { flo[k] = 1e30f; fhi[k] = -1e30f; }
            for (int i = st; i < en; i++) {
                const TInfo& q = info[i];
                for (int k = 0; k < 3; k++) {
                    flo[k] = fminf(flo[k], q.lo[k]); fhi[k] = fmaxf(fhi[k], q.hi[k]);
                }
            }
            for (int k = 0; k < 3; k++) { nd.lo[k] = flo[k] - 2e-5f; nd.hi[k] = fhi[k] + 2e-5f; }
            nd.count = cnt; nd.child = st;
            return;
        }

        float blo[BINS][3], bhi[BINS][3]; int bcnt[BINS];
        float c0 = clo[axis];
        float scale = BINS/ext*(1.0f - 1e-6f);
        for (int j = 0; j < BINS; j++) { bcnt[j] = 0; for (int k = 0; k < 3; k++) { blo[j][k] = 1e30f; bhi[j][k] = -1e30f; } }
        for (int i = st; i < en; i++) {
            const TInfo& q = info[i];
            int j = (int)((q.cen[axis] - c0) * scale);
            if (j < 0) j = 0; if (j >= BINS) j = BINS-1;
            bcnt[j]++;
            for (int k = 0; k < 3; k++) {
                if (q.lo[k] < blo[j][k]) blo[j][k] = q.lo[k];
                if (q.hi[k] > bhi[j][k]) bhi[j][k] = q.hi[k];
            }
        }
        // node box == union of per-bin boxes, so no separate bbox pass is needed
        float flo[3], fhi[3];
        for (int k = 0; k < 3; k++) { flo[k] = 1e30f; fhi[k] = -1e30f; }
        for (int j = 0; j < BINS; j++) {
            if (!bcnt[j]) continue;
            for (int k = 0; k < 3; k++) {
                if (blo[j][k] < flo[k]) flo[k] = blo[j][k];
                if (bhi[j][k] > fhi[k]) fhi[k] = bhi[j][k];
            }
        }
        for (int k = 0; k < 3; k++) { nd.lo[k] = flo[k] - 2e-5f; nd.hi[k] = fhi[k] + 2e-5f; }
        nd.count = cnt; nd.child = st;

        float rarea[BINS]; int rcnt[BINS];
        float alo[3] = {1e30f,1e30f,1e30f}, ahi[3] = {-1e30f,-1e30f,-1e30f};
        int ac = 0;
        for (int j = BINS-1; j > 0; j--) {
            ac += bcnt[j];
            for (int k = 0; k < 3; k++) {
                if (blo[j][k] < alo[k]) alo[k] = blo[j][k];
                if (bhi[j][k] > ahi[k]) ahi[k] = bhi[j][k];
            }
            rcnt[j] = ac;
            rarea[j] = ac ? carea(alo, ahi) : 0.0f;
        }
        for (int k = 0; k < 3; k++) { alo[k] = 1e30f; ahi[k] = -1e30f; }
        ac = 0;
        float best = 1e30f; int bestBin = -1;
        for (int j = 1; j < BINS; j++) {
            ac += bcnt[j-1];
            for (int k = 0; k < 3; k++) {
                if (blo[j-1][k] < alo[k]) alo[k] = blo[j-1][k];
                if (bhi[j-1][k] > ahi[k]) ahi[k] = bhi[j-1][k];
            }
            if (!ac || !rcnt[j]) continue;
            float c = carea(alo, ahi)*float(ac) + rarea[j]*float(rcnt[j]);
            if (c < best) { best = c; bestBin = j; }
        }
        float parea = carea(flo, fhi);
        if (bestBin < 0 || (parea > 0.0f && best >= parea*float(cnt))) return;
        if (cnt > 16) {
            int lc = 0;
            for (int j = 0; j < bestBin; j++) lc += bcnt[j];
            int rc = cnt - lc;
            int mn = lc < rc ? lc : rc;
            if (mn * 8 < cnt || depth >= 16) {
                int hf = cnt >> 1, cm = 0, mb = BINS;
                for (int j = 0; j < BINS; j++) { cm += bcnt[j]; if (cm > hf) { mb = j+1; break; } }
                if (mb > BINS-1) mb = BINS-1;
                if (mb >= 1) bestBin = mb;
            }
        }

        float Lc[3], Lh[3], Rc[3], Rh[3];
        for (int k = 0; k < 3; k++) { Lc[k] = Rc[k] = 1e30f; Lh[k] = Rh[k] = -1e30f; }
        int i = st, j2 = en-1;
        while (i <= j2) {
            const TInfo& qi = info[i];
            int bb = (int)((qi.cen[axis] - c0) * scale);
            if (bb < 0) bb = 0; if (bb >= BINS) bb = BINS-1;
            if (bb < bestBin) {
                for (int k = 0; k < 3; k++) {
                    if (qi.cen[k] < Lc[k]) Lc[k] = qi.cen[k];
                    if (qi.cen[k] > Lh[k]) Lh[k] = qi.cen[k];
                }
                i++; continue;
            }
            for (;;) {
                if (i > j2) break;
                const TInfo& qj = info[j2];
                int b2 = (int)((qj.cen[axis] - c0) * scale);
                if (b2 < 0) b2 = 0; if (b2 >= BINS) b2 = BINS-1;
                if (b2 >= bestBin) {
                    for (int k = 0; k < 3; k++) {
                        if (qj.cen[k] < Rc[k]) Rc[k] = qj.cen[k];
                        if (qj.cen[k] > Rh[k]) Rh[k] = qj.cen[k];
                    }
                    j2--; continue;
                }
                break;
            }
            if (i < j2) {
                for (int k = 0; k < 3; k++) {
                    if (info[i].cen[k] < Rc[k]) Rc[k] = info[i].cen[k];
                    if (info[i].cen[k] > Rh[k]) Rh[k] = info[i].cen[k];
                    if (info[j2].cen[k] < Lc[k]) Lc[k] = info[j2].cen[k];
                    if (info[j2].cen[k] > Lh[k]) Lh[k] = info[j2].cen[k];
                }
                TInfo tmp = info[i]; info[i] = info[j2]; info[j2] = tmp; i++; j2--;
            } else break;
        }
        int mid = i;
        if (mid <= st || mid >= en) return;
        int c = alloc.fetch_add(2);
        nd.count = 0; nd.child = c;
        buildNode(c, st, mid-st, depth+1, Lc, Lh);
        buildNode(c+1, mid, en-mid, depth+1, Rc, Rh);
    }

    void build() {
        nodes.assign(size_t(2)*N + 8, DNode());
        alloc.store(1);
        stopDepth = 4;
        buildNode(0, 0, N, 0, gclo, gchi);
        stopDepth = 1 << 30;
        if (!frontier.empty()) {
            int nth = 12;
            std::vector<std::thread> th;
            th.reserve(nth);
            for (int t = 0; t < nth; t++) th.emplace_back([this]{
                for (int i = fronte.fetch_add(3); i < (int)frontier.size(); i = fronte.fetch_add(3))
                    buildNode(frontier[i], frontier[i+1], frontier[i+2], 4, 0, 0);
            });
            for (size_t t = 0; t < th.size(); t++) th[t].join();
        }
        nodes.resize((size_t)alloc.load());
    }
};

static void ck(cudaError_t e) {
    if (e != cudaSuccess) fprintf(stderr, "solution: %s\n", cudaGetErrorString(e));
}

void init(int max_triangles, int max_pixels, int max_samples) {
    (void)max_pixels; (void)max_samples;
    ck(cudaMalloc(&g_nodes, size_t(2)*max_triangles*sizeof(DNode) + 4096));
    ck(cudaMalloc(&g_trix, size_t(max_triangles)*sizeof(DTriX)));
    ck(cudaMalloc(&g_trs, size_t(max_triangles)*sizeof(DTriS)));
    ck(cudaMalloc(&g_src, size_t(max_triangles)*sizeof(Triangle)));
    ck(cudaMalloc(&g_order, size_t(max_triangles)*sizeof(int)));
    ck(cudaMalloc(&g_info, size_t(max_triangles)*sizeof(TInfoD)));
    ck(cudaMalloc(&g_infoTmp, size_t(max_triangles)*sizeof(TInfoD)));
    ck(cudaMalloc(&g_nbox, (size_t(2)*max_triangles + 8)*sizeof(GBox)));
    ck(cudaMalloc(&g_tasks, (size_t(2)*max_triangles + 8)*sizeof(GTask)));
    ck(cudaMalloc(&g_tasks2, (size_t(2)*max_triangles + 8)*sizeof(GTask)));
    ck(cudaMalloc(&g_cnt, 8*sizeof(int)));
}

void render(const Scene& s, float* out) {
    int ntri = s.triangle_count;
    int npix = s.width * s.height;
    ck(cudaMemcpyAsync(g_src, s.triangles, size_t(ntri)*sizeof(Triangle), cudaMemcpyHostToDevice));

    int nodeCount = 0;
    if (ntri >= 256) {
        gb_fillInfo<<<(ntri+255)/256, 256>>>(g_src, g_info, ntri);
        gb_root<<<1, 1024>>>(g_info, ntri, g_nbox, g_tasks, g_cnt);
        int nT = 0;
        ck(cudaMemcpy(&nT, g_cnt, sizeof(int), cudaMemcpyDeviceToHost));
        TInfoD* cur = g_info; TInfoD* tmp = g_infoTmp;
        GTask* ta = g_tasks; GTask* tb = g_tasks2;
        int allocLvl = 1;
        ck(cudaMemcpy(g_cnt+1, &allocLvl, sizeof(int), cudaMemcpyHostToDevice));
        int guard = 0;
        while (nT > 0 && guard < 64) {
            int zero = 0;
            ck(cudaMemcpy(g_cnt, &zero, sizeof(int), cudaMemcpyHostToDevice));
            gb_level<<<nT, 256>>>(cur, tmp, ta, tb, g_cnt, g_nbox, g_nodes, g_cnt+1);
            ck(cudaMemcpy(&nT, g_cnt, sizeof(int), cudaMemcpyDeviceToHost));
            TInfoD* a = cur; cur = tmp; tmp = a;
            GTask* bq = ta; ta = tb; tb = bq;
            guard++;
        }
        ck(cudaMemcpy(&allocLvl, g_cnt+1, sizeof(int), cudaMemcpyDeviceToHost));
        nodeCount = allocLvl;
        gb_perm<<<(ntri+255)/256, 256>>>(cur, g_order, ntri);
    } else {
        Builder b(s.triangles, ntri);
        b.build();
        std::vector<int> perm(ntri);
        for (int i = 0; i < ntri; i++) perm[i] = b.info[i].id;
        ck(cudaMemcpyAsync(g_order, perm.data(), size_t(ntri)*sizeof(int), cudaMemcpyHostToDevice));
        ck(cudaMemcpyAsync(g_nodes, b.nodes.data(), size_t(b.nodes.size())*sizeof(DNode), cudaMemcpyHostToDevice));
        nodeCount = (int)b.nodes.size();
    }
    (void)nodeCount;
    if (ntri > 0) prepTris<<<(ntri+255)/256, 256>>>(g_src, g_order, g_trix, g_trs, ntri);

    GScene gs;
    for (int k = 0; k < 3; k++) {
        gs.eye[k] = s.eye[k]; gs.u[k] = s.u[k]; gs.v[k] = s.v[k]; gs.w[k] = s.w[k];
        gs.light[k] = s.light[k];
    }
    { float ln = sqrtf(gs.light[0]*gs.light[0] + gs.light[1]*gs.light[1] + gs.light[2]*gs.light[2]);
      if (ln > 0) { gs.light[0] /= ln; gs.light[1] /= ln; gs.light[2] /= ln; } }
    gs.ao_radius = s.ao_radius; gs.width = s.width; gs.height = s.height;
    gs.spp = s.spp; gs.ao = s.ao; gs.max_depth = s.max_depth; gs.seed = s.seed;

    long long work = (long long)npix * s.spp * s.max_depth * (s.ao + 3);
    int chunks = (int)std::min<long long>(2048, std::max<long long>(1, work / 200000000LL));
    int per = (npix + chunks - 1) / chunks;
    for (int p0 = 0; p0 < npix; p0 += per) {
        int p1 = std::min(npix, p0 + per);
        int n = p1 - p0;
        int nb = (n + 7) / 8;
        traceKernel<<<nb, 256>>>(gs, g_nodes, g_trix, g_trs, out, p0, p1);
    }
    ck(cudaGetLastError());
}
