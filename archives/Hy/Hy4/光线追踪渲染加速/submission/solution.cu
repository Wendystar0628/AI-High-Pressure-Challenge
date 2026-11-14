// Ray-tracing render acceleration.
// Strategy: parallel SAH build (bvh.hpp PAR_DEPTH), a stackless "threaded" BVH
// (skip pointers, triangles reordered to contiguous leaf ranges), a slab test
// using a once-per-ray reciprocal direction, and a fast reciprocal in the
// triangle intersection. All sampling/shading follows render_math.cuh exactly
// (radiance<float> reused verbatim), and culling stays conservative, so the
// image matches the reference. Kernel-launch count is kept low to avoid WDDM
// submit overhead, and scaled up for heavy scenes to stay below the TDR limit.
#define PAR_DEPTH 6
#ifndef LBMINB
#define LBMINB 10
#endif
#if LBMINB>0
#define TRACE_LB __launch_bounds__(128,LBMINB)
#else
#define TRACE_LB
#endif
#define FIND_Q __forceinline__
#include "bvh.hpp"
#include <cstdio>
#include <cstdlib>
#include <vector>

struct TNode { float lo[3], hi[3]; int start, count, skip; };

static Triangle* dTris;
static TNode* dNodes;
static float* dSamples;
static void ck(cudaError_t e){if(e!=cudaSuccess){fprintf(stderr,"solution: %s\n",cudaGetErrorString(e));exit(2);}}

// Slab test using precomputed reciprocal ray direction (multiplies, not
// divisions). par is a bitmask of near-zero direction axes; the slow path
// handles them exactly like the reference box(). The 1e-5 epsilon keeps the
// test conservative, so the true closest / any hit is preserved.
__device__ __forceinline__ bool boxF(const TNode& n,
    float ox,float oy,float oz,float idx,float idy,float idz,float limit,int par){
    const float eps=1e-5f;
    float a=0.0002f,b=limit;
    if(par==0){
        float x=(n.lo[0]-eps-ox)*idx,y=(n.hi[0]+eps-ox)*idx;
        if(x>y){float t=x;x=y;y=t;}if(x>a)a=x;if(y<b)b=y;if(a>b)return false;
        x=(n.lo[1]-eps-oy)*idy;y=(n.hi[1]+eps-oy)*idy;
        if(x>y){float t=x;x=y;y=t;}if(x>a)a=x;if(y<b)b=y;if(a>b)return false;
        x=(n.lo[2]-eps-oz)*idz;y=(n.hi[2]+eps-oz)*idz;
        if(x>y){float t=x;x=y;y=t;}if(x>a)a=x;if(y<b)b=y;if(a>b)return false;
        return true;
    }
    if(par&1){if(ox<n.lo[0]-eps||ox>n.hi[0]+eps)return false;}
    else{float x=(n.lo[0]-eps-ox)*idx,y=(n.hi[0]+eps-ox)*idx;
        if(x>y){float t=x;x=y;y=t;}if(x>a)a=x;if(y<b)b=y;if(a>b)return false;}
    if(par&2){if(oy<n.lo[1]-eps||oy>n.hi[1]+eps)return false;}
    else{float x=(n.lo[1]-eps-oy)*idy,y=(n.hi[1]+eps-oy)*idy;
        if(x>y){float t=x;x=y;y=t;}if(x>a)a=x;if(y<b)b=y;if(a>b)return false;}
    if(par&4){if(oz<n.lo[2]-eps||oz>n.hi[2]+eps)return false;}
    else{float x=(n.lo[2]-eps-oz)*idz,y=(n.hi[2]+eps-oz)*idz;
        if(x>y){float t=x;x=y;y=t;}if(x>a)a=x;if(y<b)b=y;if(a>b)return false;}
    return true;
}

// Copy of render_math.cuh intersect<float> with a fast approximate reciprocal
// for 1/det (avoids div.rn.f32). All other operations are identical.
__device__ __forceinline__ bool intersectF(const Triangle& t,Ray<float> r,float limit,float& distance){
    V<float> a(t.v0),e1=V<float>(t.v1)-a,e2=V<float>(t.v2)-a;
    V<float> p=r.d.cross(e2);float det=e1.dot(p);
    if(fabsf(det)<1e-10f)return false;
    float inv=__fdividef(1.0f,det);
    V<float> s=r.o-a;float u=s.dot(p)*inv;
    if(u<0.f||u>1.f)return false;
    V<float> q=s.cross(e1);float v=r.d.dot(q)*inv;
    if(v<0.f||u+v>1.f)return false;
    float d=e2.dot(q)*inv;
    if(d<=0.0002f||d>=limit)return false;
    distance=d;return true;
}

struct Query {
    const Triangle* tris;
    const TNode* nodes;
    int numNodes;
    __device__ const Triangle& triangle(int id)const{return tris[id];}
    __device__ FIND_Q Hit<float> find(Ray<float> r,float limit,bool any){
        Hit<float> hit{limit,-1};
        float dx=r.d.x,dy=r.d.y,dz=r.d.z,ox=r.o.x,oy=r.o.y,oz=r.o.z;
        float idx=1.0f/dx,idy=1.0f/dy,idz=1.0f/dz;
        int par=(fabsf(dx)<1e-30f?1:0)|(fabsf(dy)<1e-30f?2:0)|(fabsf(dz)<1e-30f?4:0);
        int i=0;
        while(i<numNodes){
            const TNode& n=nodes[i];
            if(!boxF(n,ox,oy,oz,idx,idy,idz,hit.t,par)){i=n.skip;continue;}
            if(n.count){
                for(int j=0;j<n.count;j++){int id=n.start+j;float d;
                    if(intersectF(tris[id],r,hit.t,d)){hit.t=d;hit.id=id;if(any)return hit;}}
                i=n.skip;
            }else i=i+1;
        }
        return hit;
    }
    __device__ Hit<float> closest(Ray<float> r,float limit){return find(r,limit,false);}
    __device__ bool blocked(Ray<float> r,float limit){return find(r,limit,true).id>=0;}
};

__global__ void TRACE_LB trace(Scene s,Query q,float* buf,int offset,int end){
    int i=offset+blockIdx.x*blockDim.x+threadIdx.x;if(i>=end)return;
    V<float> c=radiance<float>(s,i/s.spp,i%s.spp,q);
    buf[3*size_t(i)]=c.x;buf[3*size_t(i)+1]=c.y;buf[3*size_t(i)+2]=c.z;
}
__global__ void average(Scene s,const float* buf,float* out){
    int p=blockDim.x*blockIdx.x+threadIdx.x;if(p>=s.width*s.height)return;
    for(int k=0;k<3;k++){float sum=0;for(int j=0;j<s.spp;j++)sum+=buf[3*(size_t(p)*s.spp+j)+k];out[3*p+k]=sum/s.spp;}
}

// Flatten the SAH tree into a threaded layout: each node carries an escape
// (skip) index, children are laid out contiguously (right first, matching the
// reference DFS order), and triangles are reordered so leaves are contiguous.
struct Flattener {
    const std::vector<Node>& src;const std::vector<int>& order;const Triangle* tris;
    std::vector<TNode>& flat;std::vector<Triangle>& sorted;int triPos=0;
    void emit(int idx){
        int p=(int)flat.size();const Node& n=src[idx];TNode tn;
        for(int k=0;k<3;k++){tn.lo[k]=n.lo[k];tn.hi[k]=n.hi[k];}
        tn.start=0;tn.count=0;tn.skip=0;flat.push_back(tn);
        if(n.count>0){
            flat[p].start=triPos;flat[p].count=n.count;
            for(int i=0;i<n.count;i++)sorted[triPos++]=tris[order[n.start+i]];
            flat[p].skip=(int)flat.size();
        }else{
            emit(n.right);emit(n.left);
            flat[p].skip=(int)flat.size();
        }
    }
};

void init(int mt,int mp,int ms){
    ck(cudaMalloc(&dTris,size_t(mt)*sizeof(Triangle)));
    ck(cudaMalloc(&dNodes,(2*size_t(mt)+1)*sizeof(TNode)));
    ck(cudaMalloc(&dSamples,size_t(mp)*ms*3*sizeof(float)));
}
void render(const Scene& s,float* out){
    SahBuilder tree(s);
    std::vector<TNode> flat;flat.reserve(tree.nodes.size());
    std::vector<Triangle> sorted(size_t(s.triangle_count));
    Flattener f{tree.nodes,tree.order,s.triangles,flat,sorted};f.emit(0);
    ck(cudaMemcpy(dTris,sorted.data(),size_t(s.triangle_count)*sizeof(Triangle),cudaMemcpyHostToDevice));
    ck(cudaMemcpy(dNodes,flat.data(),flat.size()*sizeof(TNode),cudaMemcpyHostToDevice));
    Scene d=s;d.triangles=nullptr;Query q{dTris,dNodes,(int)flat.size()};
    long long n=(long long)s.width*s.height*s.spp;
    // Few large kernels for light scenes (minimize WDDM submit overhead); more,
    // shorter kernels for heavy scenes (stay under the ~2s WDDM TDR limit).
    long long w=(long long)(1+s.ao)*s.max_depth;if(w<1)w=1;
    long long CH=80000000LL/w;if(CH<131072)CH=131072;
    for(long long off=0;off<n;off+=CH){long long e=std::min(n,off+CH);int len=(int)(e-off);
        trace<<<(len+127)/128,128>>>(d,q,dSamples,(int)off,(int)e);}
    average<<<(s.width*s.height+127)/128,128>>>(d,dSamples,out);
    ck(cudaGetLastError());
}
