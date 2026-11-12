// Baseline: single-threaded 16-bin SAH, any-hit occlusion, sample buffer.
#include "bvh.hpp"
#include <cstdio>
#include <cstdlib>
static Triangle* dt;
static Node* dn;
static int* di;
static float* samples;
static void ck(cudaError_t e){if(e!=cudaSuccess){fprintf(stderr,"reference: %s\n",cudaGetErrorString(e));exit(2);}}
struct Query {
    const Triangle* tris;const Node* nodes;const int* ids;
    __device__ const Triangle& triangle(int id)const{return tris[id];}
    __device__ Hit<float> find(Ray<float> r,float limit,bool any){
        Hit<float> hit{limit,-1};int stack[64],sp=0;stack[sp++]=0;
        while(sp){const Node& n=nodes[stack[--sp]];float near;
            if(!box(n,r,hit.t,near))continue;
            if(n.count){for(int i=0;i<n.count;i++){int id=ids[n.start+i];float d;
                if(intersect(tris[id],r,hit.t,d)){hit={d,id};if(any)return hit;}}}
            else{stack[sp++]=n.left;stack[sp++]=n.right;}
        }return hit;
    }
    __device__ Hit<float> closest(Ray<float> r,float limit){return find(r,limit,false);}
    __device__ bool blocked(Ray<float> r,float limit){return find(r,limit,true).id>=0;}
};
__global__ void trace(Scene s,Query q,float* buf,int offset,int end){
    int i=offset+blockIdx.x*blockDim.x+threadIdx.x;if(i>=end)return;
    V<float> c=radiance<float>(s,i/s.spp,i%s.spp,q);
    buf[3*size_t(i)]=c.x;buf[3*size_t(i)+1]=c.y;buf[3*size_t(i)+2]=c.z;
}
__global__ void average(Scene s,const float* buf,float* out){
    int p=blockIdx.x*blockDim.x+threadIdx.x;if(p>=s.width*s.height)return;
    for(int k=0;k<3;k++){float sum=0;for(int j=0;j<s.spp;j++)sum+=buf[3*(size_t(p)*s.spp+j)+k];out[3*p+k]=sum/s.spp;}
}
void init(int mt,int mp,int ms){
    ck(cudaMalloc(&dt,size_t(mt)*sizeof(Triangle)));
    ck(cudaMalloc(&dn,(2*size_t(mt)+1)*sizeof(Node)));
    ck(cudaMalloc(&di,size_t(mt)*sizeof(int)));
    ck(cudaMalloc(&samples,size_t(mp)*ms*3*sizeof(float)));
}
void render(const Scene& s,float* out){
    SahBuilder tree(s);
    ck(cudaMemcpy(dt,s.triangles,size_t(s.triangle_count)*sizeof(Triangle),cudaMemcpyHostToDevice));
    ck(cudaMemcpy(dn,tree.nodes.data(),tree.nodes.size()*sizeof(Node),cudaMemcpyHostToDevice));
    ck(cudaMemcpy(di,tree.order.data(),tree.order.size()*sizeof(int),cudaMemcpyHostToDevice));
    Scene d=s;d.triangles=nullptr;Query q{dt,dn,di};int count=s.width*s.height*s.spp;
    for(int off=0;off<count;off+=262144){int end=std::min(count,off+262144);trace<<<(end-off+127)/128,128>>>(d,q,samples,off,end);}
    average<<<(s.width*s.height+127)/128,128>>>(d,samples,out);ck(cudaGetLastError());
}
