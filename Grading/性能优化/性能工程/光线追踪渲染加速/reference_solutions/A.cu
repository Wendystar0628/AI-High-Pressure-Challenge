// Private reference solution. No input-specific precomputed data.
#define ANY_HIT 1
#define TRAV 1
#define KERNEL 0
#define BUILD 1
// ladder.cu: layered experimental solution for the ray tracing draft.
// Each macro switches one optimization layer so the layers can be measured one by one.
//   ANY_HIT  0: occlusion queries search the closest hit (baseline)   1: stop at the first hit
//   BUILD    0: median split tree from bvh.hpp (baseline)              1: binned SAH on CPU
//   TRAV     0: baseline node layout and stack traversal               1: child boxes in parent, inverse direction,
//                                                                         near child first, leaf-ordered float4 triangles
//   KERNEL   0: one thread per sample + sample buffer + average kernel (baseline)
//            1: one thread per pixel, loops over samples, row-major pixels
//            2: like 1, but each warp covers an 8x4 pixel tile
//   PHASES   1: synchronize and print build/upload/trace times to stderr
//   COUNT    1: count rays, node visits and triangle tests (slow, for statistics only)
#include "render_math.cuh"
struct Node {float lo[3],hi[3];int left,right,start,count;};
template<class R> HD bool box(const Node& n,Ray<R> r,R limit,R& near){
    R a=R(.0002),b=limit;
    for(int k=0;k<3;k++){
        R o=r.o.at(k),d=r.d.at(k);
        if(fabs(d)<R(1e-30)){
            if(o<R(n.lo[k])-R(1e-5)||o>R(n.hi[k])+R(1e-5))return false;
            continue;
        }
        R x=(R(n.lo[k])-R(1e-5)-o)/d,y=(R(n.hi[k])+R(1e-5)-o)/d;
        if(x>y){R z=x;x=y;y=z;}
        if(x>a)a=x;if(y<b)b=y;if(a>b)return false;
    }
    near=a;return true;
}

#include <vector>
#include <algorithm>
#include <numeric>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cstdint>
#include <atomic>
#include <thread>
#if BUILD==2
// CUB needs MSVC's standard preprocessor: build this variant with -Xcompiler /Zc:preprocessor.
// (The draft's fixed compile command lacks it; even with the macro below the headers fail to compile.)
#define CCCL_IGNORE_MSVC_TRADITIONAL_PREPROCESSOR_WARNING
#include <cub/device/device_radix_sort.cuh>
#endif
#ifndef PAR_DEPTH
#define PAR_DEPTH 0   // BUILD 1: build subtrees on threads down to this depth (0 = single thread)
#endif
#ifndef ANY_HIT
#define ANY_HIT 1
#endif
#ifndef BUILD
#define BUILD 1
#endif
#ifndef TRAV
#define TRAV 1
#endif
#ifndef KERNEL
#define KERNEL 2
#endif
#ifndef PHASES
#define PHASES 0
#endif
#ifndef COUNT
#define COUNT 0
#endif
#ifndef NO_LDG
#define LDG(p) __ldg(p)
#else
#define LDG(p) (*(p))
#endif
#ifndef NO_RESTRICT
#define RESTRICT __restrict__
#else
#define RESTRICT
#endif
#ifndef DEBUG_BOTH
#define DEBUG_BOTH 0
#endif
#ifndef TRAV_V2
#define TRAV_V2 1   // 0: first loop form, which gave whole-warp wrong pixels on input 3 (cause not found)
#endif
__device__ unsigned g_dbg;
#ifndef LEAF
#define LEAF 8
#endif
#ifndef BINS
#define BINS 16
#endif
#ifndef CT
#define CT 1.0f
#endif
#ifndef CHUNK
#define CHUNK 262144
#endif
#ifndef BLOCK
#define BLOCK 128
#endif

static void ck(cudaError_t e){if(e!=cudaSuccess){fprintf(stderr,"ladder: %s\n",cudaGetErrorString(e));exit(2);}}
using Clock=std::chrono::steady_clock;
static double ms(Clock::time_point a,Clock::time_point b){return std::chrono::duration<double,std::milli>(b-a).count();}

#if COUNT
__device__ unsigned long long g_count[6]; // closest, blocked, node visits, triangle tests, samples, blocked-true
#define CNT(k,v) cnt[k]+=(v)
#else
#define CNT(k,v)
#endif

// ---------------------------------------------------------------- build
struct SahBuilder {
    const Triangle* T;int N;
    std::vector<float> lo,hi,cen;
    std::vector<int> order;std::vector<Node> nodes;
    explicit SahBuilder(const Scene& s):T(s.triangles),N(s.triangle_count){
        lo.resize(3*size_t(N));hi.resize(3*size_t(N));cen.resize(3*size_t(N));order.resize(N);
        for(int i=0;i<N;i++){const Triangle& t=T[i];
            for(int k=0;k<3;k++){float a=t.v0[k],b=t.v1[k],c=t.v2[k];
                lo[3*i+k]=std::min(a,std::min(b,c));hi[3*i+k]=std::max(a,std::max(b,c));cen[3*i+k]=(lo[3*i+k]+hi[3*i+k])*.5f;}
            order[i]=i;}
        nodes.resize(2*size_t(N)+1);next=0;build(0,N,0);nodes.resize(next.load());
    }
    std::atomic<int> next;
    static float area(const float* a,const float* b){float x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2];return x*y+y*z+z*x;}
    int build(int b,int e,int depth){
        Node n{};float clo[3],chi[3];
        for(int k=0;k<3;k++){n.lo[k]=clo[k]=1e30f;n.hi[k]=chi[k]=-1e30f;}
        for(int i=b;i<e;i++){int t=order[i];for(int k=0;k<3;k++){
            n.lo[k]=std::min(n.lo[k],lo[3*t+k]);n.hi[k]=std::max(n.hi[k],hi[3*t+k]);
            clo[k]=std::min(clo[k],cen[3*t+k]);chi[k]=std::max(chi[k],cen[3*t+k]);}}
        n.start=b;n.count=e-b;n.left=n.right=-1;
        int id=next++;nodes[id]=n;
        int cnt=e-b;if(cnt<=2||depth>=60)return id;
        float best=1e30f;int bestAxis=-1,bestBin=0;
        for(int k=0;k<3;k++){
            float ext=chi[k]-clo[k];if(ext<1e-9f)continue;
            int bc[BINS]={};float blo[BINS][3],bhi[BINS][3];
            for(int j=0;j<BINS;j++)for(int q=0;q<3;q++){blo[j][q]=1e30f;bhi[j][q]=-1e30f;}
            float scale=BINS/ext*(1-1e-6f);
            for(int i=b;i<e;i++){int t=order[i];int j=std::min(BINS-1,int((cen[3*t+k]-clo[k])*scale));
                bc[j]++;for(int q=0;q<3;q++){blo[j][q]=std::min(blo[j][q],lo[3*t+q]);bhi[j][q]=std::max(bhi[j][q],hi[3*t+q]);}}
            float rarea[BINS];int rcnt[BINS];float alo[3]={1e30f,1e30f,1e30f},ahi[3]={-1e30f,-1e30f,-1e30f};int ac=0;
            for(int j=BINS-1;j>0;j--){ac+=bc[j];for(int q=0;q<3;q++){alo[q]=std::min(alo[q],blo[j][q]);ahi[q]=std::max(ahi[q],bhi[j][q]);}
                rcnt[j]=ac;rarea[j]=ac?area(alo,ahi):0;}
            for(int q=0;q<3;q++){alo[q]=1e30f;ahi[q]=-1e30f;}ac=0;
            for(int j=1;j<BINS;j++){ac+=bc[j-1];for(int q=0;q<3;q++){alo[q]=std::min(alo[q],blo[j-1][q]);ahi[q]=std::max(ahi[q],bhi[j-1][q]);}
                if(!ac||!rcnt[j])continue;float c=area(alo,ahi)*ac+rarea[j]*rcnt[j];
                if(c<best){best=c;bestAxis=k;bestBin=j;}}
        }
        float parentArea=area(n.lo,n.hi);
        float splitCost=CT+(parentArea>0?best/parentArea:float(cnt));
        if(cnt<=LEAF&&float(cnt)<=splitCost)return id;
        int mid=-1;
        if(bestAxis>=0){
            int k=bestAxis;float ext=chi[k]-clo[k],scale=BINS/ext*(1-1e-6f),c0=clo[k];
            mid=int(std::partition(order.begin()+b,order.begin()+e,[&](int t){return std::min(BINS-1,int((cen[3*t+k]-c0)*scale))<bestBin;})-order.begin());
        }
        if(mid<=b||mid>=e){
            if(cnt<=15)return id;
            int axis=0;for(int k=1;k<3;k++)if(chi[k]-clo[k]>chi[axis]-clo[axis])axis=k;
            mid=(b+e)/2;std::nth_element(order.begin()+b,order.begin()+mid,order.begin()+e,[&](int x,int y){return cen[3*x+axis]<cen[3*y+axis];});
        }
        int l,r;
        if(depth<PAR_DEPTH&&cnt>4096){std::thread th([&]{l=build(b,mid,depth+1);});r=build(mid,e,depth+1);th.join();}
        else{l=build(b,mid,depth+1);r=build(mid,e,depth+1);}
        nodes[id].left=l;nodes[id].right=r;nodes[id].count=0;return id;
    }
};

// ---------------------------------------------------------------- GPU LBVH (Karras 2012), one triangle per leaf
static unsigned* d_keys[2];static int* d_vals[2];static void* d_sort_tmp;static size_t sort_bytes;
static unsigned* d_bounds;static int* d_parent;static int* d_visit;static float4* d_ibox;static int* d_child;
__device__ __forceinline__ unsigned f2u(float f){unsigned u=__float_as_uint(f);return (u&0x80000000u)?~u:(u|0x80000000u);}
__device__ __forceinline__ float u2f(unsigned u){return __uint_as_float((u&0x80000000u)?(u&0x7fffffffu):~u);}
__global__ void k_lb_bounds(const Triangle* t,int n,unsigned* b){
    __shared__ float s[6][256];int i=blockIdx.x*blockDim.x+threadIdx.x;
    float c[3];for(int k=0;k<3;k++){c[k]=i<n?(fminf(t[i].v0[k],fminf(t[i].v1[k],t[i].v2[k]))+fmaxf(t[i].v0[k],fmaxf(t[i].v1[k],t[i].v2[k])))*.5f:0;
        s[k][threadIdx.x]=i<n?c[k]:1e30f;s[3+k][threadIdx.x]=i<n?c[k]:-1e30f;}
    __syncthreads();
    for(int st=128;st;st>>=1){if(threadIdx.x<st)for(int k=0;k<3;k++){s[k][threadIdx.x]=fminf(s[k][threadIdx.x],s[k][threadIdx.x+st]);s[3+k][threadIdx.x]=fmaxf(s[3+k][threadIdx.x],s[3+k][threadIdx.x+st]);}__syncthreads();}
    if(threadIdx.x==0)for(int k=0;k<3;k++){atomicMin(&b[k],f2u(s[k][0]));atomicMax(&b[3+k],f2u(s[3+k][0]));}
}
__device__ __forceinline__ unsigned expand(unsigned v){v=(v*0x00010001u)&0xFF0000FFu;v=(v*0x00000101u)&0x0F00F00Fu;v=(v*0x00000011u)&0xC30C30C3u;v=(v*0x00000005u)&0x49249249u;return v;}
__global__ void k_lb_morton(const Triangle* t,int n,const unsigned* b,unsigned* key,int* val){
    int i=blockIdx.x*blockDim.x+threadIdx.x;if(i>=n)return;unsigned q[3];
    for(int k=0;k<3;k++){float lo=u2f(b[k]),hi=u2f(b[3+k]);float c=(fminf(t[i].v0[k],fminf(t[i].v1[k],t[i].v2[k]))+fmaxf(t[i].v0[k],fmaxf(t[i].v1[k],t[i].v2[k])))*.5f;
        float x=hi>lo?(c-lo)/(hi-lo):0.f;q[k]=min(1023u,unsigned(fmaxf(x,0.f)*1024.f));}
    key[i]=(expand(q[0])<<2)|(expand(q[1])<<1)|expand(q[2]);val[i]=i;
}
__device__ __forceinline__ int lb_delta(const unsigned* c,int n,int i,int j){if(j<0||j>=n)return -1;unsigned a=c[i],b=c[j];return a==b?32+__clz(i^j):__clz(a^b);}
// child codes: >=0 internal node, <0 leaf ~((m<<4)|1); parent: internal nodes 0..n-2, leaves stored at n-1+m
__global__ void k_lb_tree(const unsigned* c,int n,int* child,int* parent){
    int i=blockIdx.x*blockDim.x+threadIdx.x;if(i>=n-1)return;
    int d=(lb_delta(c,n,i,i+1)-lb_delta(c,n,i,i-1))>=0?1:-1;int dmin=lb_delta(c,n,i,i-d);
    int lmax=2;while(lb_delta(c,n,i,i+lmax*d)>dmin)lmax*=2;
    int l=0;for(int t=lmax/2;t>=1;t/=2)if(lb_delta(c,n,i,i+(l+t)*d)>dmin)l+=t;
    int j=i+l*d;int dn=lb_delta(c,n,i,j);int s=0;int div=2;int t;
    do{t=(l+div-1)/div;if(lb_delta(c,n,i,i+(s+t)*d)>dn)s+=t;div*=2;}while(t>1);
    int g=i+s*d+min(d,0);
    int L=min(i,j)==g?~((g<<4)|1):g;int R=max(i,j)==g+1?~(((g+1)<<4)|1):g+1;
    child[2*i]=L;child[2*i+1]=R;
    parent[L<0?n-1+g:L]=i;parent[R<0?n-1+g+1:R]=i;
}
__device__ __forceinline__ void grow_box(float4& lo,float4& hi){
    lo.x-=1e-5f+fabsf(lo.x)*2e-6f;lo.y-=1e-5f+fabsf(lo.y)*2e-6f;lo.z-=1e-5f+fabsf(lo.z)*2e-6f;
    hi.x+=1e-5f+fabsf(hi.x)*2e-6f;hi.y+=1e-5f+fabsf(hi.y)*2e-6f;hi.z+=1e-5f+fabsf(hi.z)*2e-6f;}
__device__ void child_box(int code,int n,const Triangle* tris,const int* order,const float4* ibox,float4& lo,float4& hi){
    if(code<0){int m=(~code)>>4;const Triangle& t=tris[order[m]];
        lo=make_float4(fminf(t.v0[0],fminf(t.v1[0],t.v2[0])),fminf(t.v0[1],fminf(t.v1[1],t.v2[1])),fminf(t.v0[2],fminf(t.v1[2],t.v2[2])),0);
        hi=make_float4(fmaxf(t.v0[0],fmaxf(t.v1[0],t.v2[0])),fmaxf(t.v0[1],fmaxf(t.v1[1],t.v2[1])),fmaxf(t.v0[2],fmaxf(t.v1[2],t.v2[2])),0);}
    else{lo=__ldcg(&ibox[2*code]);hi=__ldcg(&ibox[2*code+1]);}
}
__global__ void k_lb_boxes(int n,const Triangle* tris,const int* order,const int* child,const int* parent,int* visit,float4* ibox,float4* gn){
    int m=blockIdx.x*blockDim.x+threadIdx.x;if(m>=n)return;
    int node=parent[n-1+m];
    while(true){
        __threadfence();
        if(atomicAdd(&visit[node],1)==0)return;   // first arrival stops; the second one has both children
        __threadfence();
        float4 a,b,c,d;child_box(child[2*node],n,tris,order,ibox,a,b);child_box(child[2*node+1],n,tris,order,ibox,c,d);
        float4 u=make_float4(fminf(a.x,c.x),fminf(a.y,c.y),fminf(a.z,c.z),0),v=make_float4(fmaxf(b.x,d.x),fmaxf(b.y,d.y),fmaxf(b.z,d.z),0);
        ibox[2*node]=u;ibox[2*node+1]=v;
        grow_box(a,b);grow_box(c,d);
        gn[4*node]=make_float4(a.x,b.x,a.y,b.y);gn[4*node+1]=make_float4(c.x,d.x,c.y,d.y);gn[4*node+2]=make_float4(a.z,b.z,c.z,d.z);
        int4 cc=make_int4(child[2*node],child[2*node+1],0,0);gn[4*node+3]=*reinterpret_cast<float4*>(&cc);
        if(node==0)return;node=parent[node];
    }
}

// ---------------------------------------------------------------- device data
struct Dev {
    const Triangle* tris;const Node* nodes;const int* ids;   // TRAV 0
    const float4* gnodes;const float4* gtris;const Triangle* shade; // TRAV 1
};
static Triangle* d_tris;static Node* d_nodes;static int* d_ids;static float4* d_gnodes;static float4* d_gtris;static Triangle* d_shade;static int* d_order;
static float* d_samples;

#if TRAV==0
struct Query {
    const Triangle* tris;const Node* nodes;const int* ids;
#if COUNT
    unsigned long long cnt[6]={};
#endif
    __device__ const Triangle& triangle(int id)const{return tris[id];}
    __device__ Hit<float> find(Ray<float> r,float limit,bool any){
        Hit<float> hit{limit,-1};int stack[64],sp=0;stack[sp++]=0;
        while(sp){const Node& n=nodes[stack[--sp]];float near;CNT(2,1);
            if(!box(n,r,hit.t,near))continue;
            if(n.count){for(int i=0;i<n.count;i++){int id=ids[n.start+i];float d;CNT(3,1);
                if(intersect(tris[id],r,hit.t,d)){hit={d,id};if(any)return hit;}}}
            else{stack[sp++]=n.left;stack[sp++]=n.right;}
        }return hit;
    }
    __device__ Hit<float> closest(Ray<float> r,float limit){CNT(0,1);return find(r,limit,false);}
    __device__ bool blocked(Ray<float> r,float limit){CNT(1,1);bool b=find(r,limit,ANY_HIT!=0).id>=0;CNT(5,b);return b;}
};
__device__ Query make_query(const Dev& d){Query q;q.tris=d.tris;q.nodes=d.nodes;q.ids=d.ids;return q;}
#else
struct Query {
    const float4* RESTRICT nodes;const float4* RESTRICT tris;const Triangle* RESTRICT shade;
#if COUNT
    unsigned long long cnt[6]={};
#endif
    __device__ const Triangle& triangle(int id)const{return shade[id];}
    __device__ __forceinline__ int trace(const Ray<float>& r,float& tmax,bool any){
        float dx=r.d.x,dy=r.d.y,dz=r.d.z,ox=r.o.x,oy=r.o.y,oz=r.o.z;
        float ix=1.f/(fabsf(dx)>1e-20f?dx:copysignf(1e-20f,dx));
        float iy=1.f/(fabsf(dy)>1e-20f?dy:copysignf(1e-20f,dy));
        float iz=1.f/(fabsf(dz)>1e-20f?dz:copysignf(1e-20f,dz));
        float oix=ox*ix,oiy=oy*iy,oiz=oz*iz;
        int stack[64];int sp=0;int code=0;int hit=-1;
#if TRAV_V2
        const int SENT=0x7fffffff;stack[sp++]=SENT;
        while(code!=SENT){
            if(code>=0){
                const float4* n=nodes+4*size_t(code);CNT(2,1);
                float4 a=LDG(n),b=LDG(n+1),c=LDG(n+2);int4 d=LDG(reinterpret_cast<const int4*>(n+3));
#if SLAB_FMA
                float l0=fmaf(a.x,ix,-oix),l1=fmaf(a.y,ix,-oix),l2=fmaf(a.z,iy,-oiy),l3=fmaf(a.w,iy,-oiy),l4=fmaf(c.x,iz,-oiz),l5=fmaf(c.y,iz,-oiz);
                float r0=fmaf(b.x,ix,-oix),r1=fmaf(b.y,ix,-oix),r2=fmaf(b.z,iy,-oiy),r3=fmaf(b.w,iy,-oiy),r4=fmaf(c.z,iz,-oiz),r5=fmaf(c.w,iz,-oiz);
#else
                float l0=(a.x-ox)*ix,l1=(a.y-ox)*ix,l2=(a.z-oy)*iy,l3=(a.w-oy)*iy,l4=(c.x-oz)*iz,l5=(c.y-oz)*iz;
                float r0=(b.x-ox)*ix,r1=(b.y-ox)*ix,r2=(b.z-oy)*iy,r3=(b.w-oy)*iy,r4=(c.z-oz)*iz,r5=(c.w-oz)*iz;
#endif
                float lmin=fmaxf(fmaxf(fminf(l0,l1),fminf(l2,l3)),fmaxf(fminf(l4,l5),0.0002f));
                float lmax=fminf(fminf(fmaxf(l0,l1),fmaxf(l2,l3)),fminf(fmaxf(l4,l5),tmax));
                float rmin=fmaxf(fmaxf(fminf(r0,r1),fminf(r2,r3)),fmaxf(fminf(r4,r5),0.0002f));
                float rmax=fminf(fminf(fmaxf(r0,r1),fmaxf(r2,r3)),fminf(fmaxf(r4,r5),tmax));
                bool hl=lmin<=lmax,hr=rmin<=rmax;
                if(hl&&hr){int nc=d.x,fc=d.y;if(rmin<lmin){nc=d.y;fc=d.x;}stack[sp++]=fc;code=nc;}
                else if(hl)code=d.x;else if(hr)code=d.y;
                else code=stack[--sp];
            }else{
                int v=~code;int start=v>>4,count=v&15;bool stop=false;
#pragma unroll 1
                for(int i=start;i<start+count;i++){
                    const float4* t=tris+3*size_t(i);CNT(3,1);
                    float4 A=LDG(t),E1=LDG(t+1),E2=LDG(t+2);
                    float px=dy*E2.z-dz*E2.y,py=dz*E2.x-dx*E2.z,pz=dx*E2.y-dy*E2.x;
                    float det=E1.x*px+E1.y*py+E1.z*pz;
                    if(fabsf(det)<1e-10f)continue;
                    float inv=1.f/det;float sx=ox-A.x,sy=oy-A.y,sz=oz-A.z;
                    float u=(sx*px+sy*py+sz*pz)*inv;if(u<0.f||u>1.f)continue;
                    float qx=sy*E1.z-sz*E1.y,qy=sz*E1.x-sx*E1.z,qz=sx*E1.y-sy*E1.x;
                    float v2=(dx*qx+dy*qy+dz*qz)*inv;if(v2<0.f||u+v2>1.f)continue;
                    float tt=(E2.x*qx+E2.y*qy+E2.z*qz)*inv;
                    if(tt<=0.0002f||tt>=tmax)continue;
                    tmax=tt;hit=i;if(any){stop=true;break;}
                }
                code=stop?SENT:stack[--sp];
            }
        }
        return hit;
#endif
        while(true){
            if(code>=0){
                const float4* n=nodes+4*size_t(code);CNT(2,1);
                float4 a=LDG(n),b=LDG(n+1),c=LDG(n+2);int4 d=LDG(reinterpret_cast<const int4*>(n+3));
                float l0=fmaf(a.x,ix,-oix),l1=fmaf(a.y,ix,-oix),l2=fmaf(a.z,iy,-oiy),l3=fmaf(a.w,iy,-oiy),l4=fmaf(c.x,iz,-oiz),l5=fmaf(c.y,iz,-oiz);
                float r0=fmaf(b.x,ix,-oix),r1=fmaf(b.y,ix,-oix),r2=fmaf(b.z,iy,-oiy),r3=fmaf(b.w,iy,-oiy),r4=fmaf(c.z,iz,-oiz),r5=fmaf(c.w,iz,-oiz);
                float lmin=fmaxf(fmaxf(fminf(l0,l1),fminf(l2,l3)),fmaxf(fminf(l4,l5),0.0002f));
                float lmax=fminf(fminf(fmaxf(l0,l1),fmaxf(l2,l3)),fminf(fmaxf(l4,l5),tmax));
                float rmin=fmaxf(fmaxf(fminf(r0,r1),fminf(r2,r3)),fmaxf(fminf(r4,r5),0.0002f));
                float rmax=fminf(fminf(fmaxf(r0,r1),fmaxf(r2,r3)),fminf(fmaxf(r4,r5),tmax));
                bool hl=lmin<=lmax,hr=rmin<=rmax;
                if(hl&&hr){int nc=d.x,fc=d.y;if(rmin<lmin){nc=d.y;fc=d.x;}stack[sp++]=fc;code=nc;}
                else if(hl)code=d.x;else if(hr)code=d.y;
                else{if(!sp)break;code=stack[--sp];}
            }else{
                int v=~code;int start=v>>4,count=v&15;
                for(int i=start;i<start+count;i++){
                    const float4* t=tris+3*size_t(i);CNT(3,1);
                    float4 A=LDG(t),E1=LDG(t+1),E2=LDG(t+2);
                    float px=dy*E2.z-dz*E2.y,py=dz*E2.x-dx*E2.z,pz=dx*E2.y-dy*E2.x;
                    float det=E1.x*px+E1.y*py+E1.z*pz;
                    if(fabsf(det)<1e-10f)continue;
                    float inv=1.f/det;float sx=ox-A.x,sy=oy-A.y,sz=oz-A.z;
                    float u=(sx*px+sy*py+sz*pz)*inv;if(u<0.f||u>1.f)continue;
                    float qx=sy*E1.z-sz*E1.y,qy=sz*E1.x-sx*E1.z,qz=sx*E1.y-sy*E1.x;
                    float v2=(dx*qx+dy*qy+dz*qz)*inv;if(v2<0.f||u+v2>1.f)continue;
                    float tt=(E2.x*qx+E2.y*qy+E2.z*qz)*inv;
                    if(tt<=0.0002f||tt>=tmax)continue;
                    tmax=tt;hit=i;if(any)return hit;
                }
                if(!sp)break;code=stack[--sp];
            }
        }
        return hit;
    }
#if DEBUG_BOTH
    const Triangle* otris;const Node* onodes;const int* oids;
    __device__ Hit<float> ofind(Ray<float> r,float limit,bool any){
        Hit<float> hit{limit,-1};int stack[64],sp=0;stack[sp++]=0;
        while(sp){const Node& n=onodes[stack[--sp]];float near;
            if(!box(n,r,hit.t,near))continue;
            if(n.count){for(int i=0;i<n.count;i++){int id=oids[n.start+i];float d;
                if(intersect(otris[id],r,hit.t,d)){hit={d,id};if(any)return hit;}}}
            else{stack[sp++]=n.left;stack[sp++]=n.right;}
        }return hit;
    }
    __device__ void report(const char* what,Ray<float> r,float limit,float t1,int i1,float t0,int i0){
        unsigned k=atomicAdd(&g_dbg,1u);
        if(k<12)printf("%s o=(%.6f,%.6f,%.6f) d=(%.6f,%.6f,%.6f) lim=%g new t=%.6f id=%d  old t=%.6f id=%d\n",what,r.o.x,r.o.y,r.o.z,r.d.x,r.d.y,r.d.z,limit,t1,i1,t0,i0);
    }
#endif
    __device__ Hit<float> closest(Ray<float> r,float limit){CNT(0,1);float t=limit;int id=trace(r,t,false);
#if DEBUG_BOTH
        Hit<float> o=ofind(r,limit,false);if((o.id<0)!=(id<0)||fabsf(o.t-t)>1e-3f)report("closest",r,limit,t,id,o.t,o.id);
#endif
        return {t,id};}
#if OCC_CACHE
    // Occluder cache: test the triangle that blocked this thread's previous query first.
    // It only changes the search order; the yes/no answer is the same.
    int last=-1;
    __device__ bool test_one(const Ray<float>& r,int i,float tmax){
        const float4* t=tris+3*size_t(i);float4 A=LDG(t),E1=LDG(t+1),E2=LDG(t+2);
        float dx=r.d.x,dy=r.d.y,dz=r.d.z;
        float px=dy*E2.z-dz*E2.y,py=dz*E2.x-dx*E2.z,pz=dx*E2.y-dy*E2.x;float det=E1.x*px+E1.y*py+E1.z*pz;
        if(fabsf(det)<1e-10f)return false;float inv=1.f/det;float sx=r.o.x-A.x,sy=r.o.y-A.y,sz=r.o.z-A.z;
        float u=(sx*px+sy*py+sz*pz)*inv;if(u<0.f||u>1.f)return false;
        float qx=sy*E1.z-sz*E1.y,qy=sz*E1.x-sx*E1.z,qz=sx*E1.y-sy*E1.x;
        float v2=(dx*qx+dy*qy+dz*qz)*inv;if(v2<0.f||u+v2>1.f)return false;
        float tt=(E2.x*qx+E2.y*qy+E2.z*qz)*inv;return tt>0.0002f&&tt<tmax;
    }
#endif
    __device__ bool blocked(Ray<float> r,float limit){CNT(1,1);
#if OCC_CACHE
        if(last>=0&&test_one(r,last,limit)){CNT(5,1);return true;}
#endif
        float t=limit;int id=trace(r,t,ANY_HIT!=0);bool b=id>=0;CNT(5,b);
#if OCC_CACHE
        if(b)last=id;
#endif
#if DEBUG_BOTH
        Hit<float> o=ofind(r,limit,false);if((o.id>=0)!=b)report("blocked",r,limit,t,id,o.t,o.id);
#endif
        return b;}
};
__device__ Query make_query(const Dev& d){Query q;q.nodes=d.gnodes;q.tris=d.gtris;q.shade=d.shade;
#if DEBUG_BOTH
    q.otris=d.tris;q.onodes=d.nodes;q.oids=d.ids;
#endif
    return q;}
#endif

__device__ void flush(Query& q){
#if COUNT
    for(int k=0;k<6;k++)if(q.cnt[k])atomicAdd(&g_count[k],q.cnt[k]);
#endif
}

// ---------------------------------------------------------------- kernels
__global__ void k_gather(const Triangle* in,const int* order,int n,Triangle* shade,float4* gt){
    int i=blockIdx.x*blockDim.x+threadIdx.x;if(i>=n)return;
    Triangle t=in[order[i]];shade[i]=t;
    gt[3*i]=make_float4(t.v0[0],t.v0[1],t.v0[2],0.f);
    gt[3*i+1]=make_float4(t.v1[0]-t.v0[0],t.v1[1]-t.v0[1],t.v1[2]-t.v0[2],0.f);
    gt[3*i+2]=make_float4(t.v2[0]-t.v0[0],t.v2[1]-t.v0[1],t.v2[2]-t.v0[2],0.f);
}
__global__ void __launch_bounds__(BLOCK) k_samples(Scene s,Dev dv,float* samples,int offset,int end){
    int i=offset+blockIdx.x*blockDim.x+threadIdx.x;if(i>=end)return;
    Query q=make_query(dv);V<float> c=radiance<float>(s,i/s.spp,i%s.spp,q);
#if COUNT
    q.cnt[4]++;
#endif
    flush(q);
    samples[size_t(3)*i]=c.x;samples[size_t(3)*i+1]=c.y;samples[size_t(3)*i+2]=c.z;
}
__global__ void k_average(Scene s,const float* samples,float* rgb){
    int p=blockIdx.x*blockDim.x+threadIdx.x;if(p>=s.width*s.height)return;
    for(int k=0;k<3;k++){float sum=0;for(int j=0;j<s.spp;j++)sum+=samples[size_t(3)*(size_t(p)*s.spp+j)+k];rgb[3*p+k]=sum/s.spp;}
}
__device__ __forceinline__ void shade_pixel(const Scene& s,const Dev& dv,float* rgb,int pixel){
    Query q=make_query(dv);V<float> c;
    for(int j=0;j<s.spp;j++)c=c+radiance<float>(s,pixel,j,q);
#if COUNT
    q.cnt[4]+=s.spp;
#endif
    flush(q);
    rgb[3*pixel]=c.x/s.spp;rgb[3*pixel+1]=c.y/s.spp;rgb[3*pixel+2]=c.z/s.spp;
}
__global__ void __launch_bounds__(BLOCK) k_rows(Scene s,Dev dv,float* rgb,int offset,int end){
    int p=offset+blockIdx.x*blockDim.x+threadIdx.x;if(p>=end)return;shade_pixel(s,dv,rgb,p);
}
// block = 128 threads = 16x8 pixels; warp w covers an 8x4 tile.
__global__ void __launch_bounds__(128) k_tiles(Scene s,Dev dv,float* rgb,int block_offset,int tiles_x){
    int b=block_offset+blockIdx.x;int bx=b%tiles_x,by=b/tiles_x;
    int w=threadIdx.x>>5,lane=threadIdx.x&31;
    int x=bx*16+(w&1)*8+(lane&7),y=by*8+(w>>1)*4+(lane>>3);
    if(x>=s.width||y>=s.height)return;shade_pixel(s,dv,rgb,y*s.width+x);
}

// ---------------------------------------------------------------- host
static std::vector<float4> pack(const std::vector<Node>& nodes,std::vector<int>& internal){
    // Map internal tree nodes to packed indices; leaves become ~((start<<4)|count).
    internal.assign(nodes.size(),-1);int k=0;
    for(size_t i=0;i<nodes.size();i++)if(nodes[i].count==0)internal[i]=k++;
    auto code=[&](int c){const Node& n=nodes[c];return n.count?~((n.start<<4)|n.count):internal[c];};
    std::vector<float4> out;
    auto grow=[](const Node& n,float* lo,float* hi){for(int q=0;q<3;q++){float e=1e-5f+fabsf(n.lo[q])*2e-6f,f=1e-5f+fabsf(n.hi[q])*2e-6f;lo[q]=n.lo[q]-e;hi[q]=n.hi[q]+f;}};
    if(nodes[0].count){ // single leaf root: wrap it
        float lo[3],hi[3];grow(nodes[0],lo,hi);
        // The right child is an empty leaf (~0: start 0, count 0) with the same box.
        out.push_back(make_float4(lo[0],hi[0],lo[1],hi[1]));out.push_back(make_float4(lo[0],hi[0],lo[1],hi[1]));
        out.push_back(make_float4(lo[2],hi[2],lo[2],hi[2]));int4 d=make_int4(code(0),~0,0,0);float4 f;memcpy(&f,&d,16);out.push_back(f);
        return out;
    }
    out.resize(4*size_t(k));
    for(size_t i=0;i<nodes.size();i++){if(nodes[i].count)continue;int j=internal[i];
        const Node& L=nodes[nodes[i].left];const Node& R=nodes[nodes[i].right];float ll[3],lh[3],rl[3],rh[3];grow(L,ll,lh);grow(R,rl,rh);
        out[4*j]=make_float4(ll[0],lh[0],ll[1],lh[1]);out[4*j+1]=make_float4(rl[0],rh[0],rl[1],rh[1]);out[4*j+2]=make_float4(ll[2],lh[2],rl[2],rh[2]);
        int4 d=make_int4(code(nodes[i].left),code(nodes[i].right),0,0);memcpy(&out[4*j+3],&d,16);}
    return out;
}

void init(int max_triangles,int max_pixels,int max_samples){
    size_t n=size_t(max_triangles);
    ck(cudaMalloc(&d_tris,n*sizeof(Triangle)));ck(cudaMalloc(&d_nodes,(2*n+1)*sizeof(Node)));ck(cudaMalloc(&d_ids,n*sizeof(int)));
    ck(cudaMalloc(&d_gnodes,(4*n+8)*sizeof(float4)));ck(cudaMalloc(&d_gtris,3*n*sizeof(float4)));ck(cudaMalloc(&d_shade,n*sizeof(Triangle)));ck(cudaMalloc(&d_order,n*sizeof(int)));
#if KERNEL==0
    ck(cudaMalloc(&d_samples,size_t(max_pixels)*max_samples*3*sizeof(float)));
#endif
#if BUILD==2
    for(int k=0;k<2;k++){ck(cudaMalloc(&d_keys[k],n*4));ck(cudaMalloc(&d_vals[k],n*4));}
    ck(cub::DeviceRadixSort::SortPairs(nullptr,sort_bytes,d_keys[0],d_keys[1],d_vals[0],d_vals[1],int(n),0,30));
    ck(cudaMalloc(&d_sort_tmp,sort_bytes));ck(cudaMalloc(&d_bounds,64));
    ck(cudaMalloc(&d_parent,2*n*4));ck(cudaMalloc(&d_visit,n*4));ck(cudaMalloc(&d_ibox,2*n*sizeof(float4)));ck(cudaMalloc(&d_child,2*n*4));
#endif
}

static void trace_all(const Scene& s,float* rgb,const Dev& dv,Clock::time_point t0,Clock::time_point t1,size_t node_count);
void render(const Scene& s,float* rgb){
    auto t0=Clock::now();
    std::vector<Node> nodes;std::vector<int> order;
#if BUILD==2
    if(s.triangle_count>=2){
        int n=s.triangle_count;
        ck(cudaMemcpy(d_tris,s.triangles,size_t(n)*sizeof(Triangle),cudaMemcpyHostToDevice));
        ck(cudaMemset(d_bounds,0xff,12));ck(cudaMemset(d_bounds+3,0,12));
        k_lb_bounds<<<(n+255)/256,256>>>(d_tris,n,d_bounds);
        k_lb_morton<<<(n+255)/256,256>>>(d_tris,n,d_bounds,d_keys[0],d_vals[0]);
        ck(cub::DeviceRadixSort::SortPairs(d_sort_tmp,sort_bytes,d_keys[0],d_keys[1],d_vals[0],d_vals[1],n,0,30));
        k_lb_tree<<<(n+254)/256,256>>>(d_keys[1],n,d_child,d_parent);
        ck(cudaMemset(d_visit,0,size_t(n)*4));
        k_lb_boxes<<<(n+255)/256,256>>>(n,d_tris,d_vals[1],d_child,d_parent,d_visit,d_ibox,d_gnodes);
#if PHASES
        ck(cudaDeviceSynchronize());
#endif
        auto t1=Clock::now();
        k_gather<<<(n+255)/256,256>>>(d_tris,d_vals[1],n,d_shade,d_gtris);
        Dev dv{};dv.gnodes=d_gnodes;dv.gtris=d_gtris;dv.shade=d_shade;
        trace_all(s,rgb,dv,t0,t1,size_t(n-1));
        return;
    }
#endif
#if BUILD==0
    {Tree tree(s);nodes.swap(tree.nodes);order.swap(tree.order);}
#else
    {SahBuilder b(s);nodes.swap(b.nodes);order.swap(b.order);}
#endif
    auto t1=Clock::now();
    Dev dv{};
#if TRAV==0
    ck(cudaMemcpy(d_tris,s.triangles,size_t(s.triangle_count)*sizeof(Triangle),cudaMemcpyHostToDevice));
    ck(cudaMemcpy(d_nodes,nodes.data(),nodes.size()*sizeof(Node),cudaMemcpyHostToDevice));
    ck(cudaMemcpy(d_ids,order.data(),order.size()*sizeof(int),cudaMemcpyHostToDevice));
    dv.tris=d_tris;dv.nodes=d_nodes;dv.ids=d_ids;
#else
    std::vector<int> internal;std::vector<float4> packed=pack(nodes,internal);
    ck(cudaMemcpy(d_tris,s.triangles,size_t(s.triangle_count)*sizeof(Triangle),cudaMemcpyHostToDevice));
    ck(cudaMemcpy(d_order,order.data(),order.size()*sizeof(int),cudaMemcpyHostToDevice));
    ck(cudaMemcpy(d_gnodes,packed.data(),packed.size()*sizeof(float4),cudaMemcpyHostToDevice));
    k_gather<<<(s.triangle_count+255)/256,256>>>(d_tris,d_order,s.triangle_count,d_shade,d_gtris);
    dv.gnodes=d_gnodes;dv.gtris=d_gtris;dv.shade=d_shade;
#if DEBUG_BOTH
    ck(cudaMemcpy(d_nodes,nodes.data(),nodes.size()*sizeof(Node),cudaMemcpyHostToDevice));
    ck(cudaMemcpy(d_ids,order.data(),order.size()*sizeof(int),cudaMemcpyHostToDevice));
    dv.tris=d_tris;dv.nodes=d_nodes;dv.ids=d_ids;
#endif
#endif
    trace_all(s,rgb,dv,t0,t1,nodes.size());
}

static void trace_all(const Scene& s,float* rgb,const Dev& dv,Clock::time_point t0,Clock::time_point t1,size_t node_count){
#if PHASES
    ck(cudaDeviceSynchronize());
#endif
    auto t2=Clock::now();
    Scene ds=s;ds.triangles=nullptr;
#if COUNT
    {unsigned long long z[6]={};ck(cudaMemcpyToSymbol(g_count,z,sizeof(z)));}
#endif
#if KERNEL==0
    int count=s.width*s.height*s.spp;
    for(int off=0;off<count;off+=CHUNK){int end=std::min(count,off+CHUNK);k_samples<<<(end-off+BLOCK-1)/BLOCK,BLOCK>>>(ds,dv,d_samples,off,end);}
    k_average<<<(s.width*s.height+127)/128,128>>>(ds,d_samples,rgb);
#elif KERNEL==1
    int count=s.width*s.height;
    for(int off=0;off<count;off+=CHUNK){int end=std::min(count,off+CHUNK);k_rows<<<(end-off+BLOCK-1)/BLOCK,BLOCK>>>(ds,dv,rgb,off,end);}
#else
    int tx=(s.width+15)/16,ty=(s.height+7)/8,blocks=tx*ty,per=CHUNK/128;
    for(int off=0;off<blocks;off+=per){int n=std::min(per,blocks-off);k_tiles<<<n,128>>>(ds,dv,rgb,off,tx);}
#endif
    ck(cudaGetLastError());
#if PHASES||COUNT
    ck(cudaDeviceSynchronize());auto t3=Clock::now();
    fprintf(stderr,"phase build=%.3f upload=%.3f trace=%.3f nodes=%zu\n",ms(t0,t1),ms(t1,t2),ms(t2,t3),node_count);
#endif
#if COUNT
    {unsigned long long h[6];ck(cudaMemcpyFromSymbol(h,g_count,sizeof(h)));
     fprintf(stderr,"count closest=%llu blocked=%llu node_visits=%llu tri_tests=%llu samples=%llu blocked_true=%llu\n",h[0],h[1],h[2],h[3],h[4],h[5]);}
#endif
}
