// Private oracle: double rays, shading, samples and averaging; float32 final output.
#include "bvh.hpp"
#include <cstdio>
#include <cstdlib>
static Triangle* dt;static Node* dn;static int* di;static double* buffer;static double* averaged;
static constexpr int SAMPLE_CAP=262144;
static void ck(cudaError_t e){if(e!=cudaSuccess){fprintf(stderr,"CUDA_ERROR code=%d oracle: %s\n",int(e),cudaGetErrorString(e));exit(2);}}
struct Query {
    const Triangle* tris;const Node* nodes;const int* ids;
    __device__ const Triangle& triangle(int id)const{return tris[id];}
    __device__ Hit<double> find(Ray<double> r,double limit,bool any){
        Hit<double> hit{limit,-1};int stack[64],sp=0;stack[sp++]=0;
        while(sp){const Node& n=nodes[stack[--sp]];double near;
            if(!box(n,r,hit.t,near))continue;
            if(n.count){for(int i=0;i<n.count;i++){int id=ids[n.start+i];double d;
                if(intersect(tris[id],r,hit.t,d)){hit={d,id};if(any)return hit;}}}
            else{stack[sp++]=n.left;stack[sp++]=n.right;}
        }return hit;
    }
    __device__ Hit<double> closest(Ray<double> r,double limit){return find(r,limit,false);}
    __device__ bool blocked(Ray<double> r,double limit){return find(r,limit,true).id>=0;}
};
// One thread computes one sample and writes it without local sample accumulation.
__global__ void trace_samples(Scene s,Query q,double* out,int first,int pixels){
    int i=blockIdx.x*blockDim.x+threadIdx.x;if(i>=pixels*s.spp)return;
    V<double> c=radiance<double>(s,first+i/s.spp,i%s.spp,q);
    out[3*size_t(i)]=c.x;out[3*size_t(i)+1]=c.y;out[3*size_t(i)+2]=c.z;
}
__global__ void average(Scene s,const double* buf,float* rgb,double* exact,int first,int pixels){
    int k=blockIdx.x*blockDim.x+threadIdx.x;if(k>=pixels)return;
    for(int c=0;c<3;c++){double sum=0;for(int j=0;j<s.spp;j++)sum+=buf[3*(size_t(k)*s.spp+j)+c];double value=sum/s.spp;exact[3*k+c]=value;rgb[3*(first+k)+c]=float(value);}
}
void init(int mt,int,int){
    ck(cudaMalloc(&dt,size_t(mt)*sizeof(Triangle)));ck(cudaMalloc(&dn,(2*size_t(mt)+1)*sizeof(Node)));
    ck(cudaMalloc(&di,size_t(mt)*sizeof(int)));ck(cudaMalloc(&buffer,size_t(SAMPLE_CAP)*3*sizeof(double)));ck(cudaMalloc(&averaged,8192*3*sizeof(double)));
}
void render(const Scene& s,float* rgb){
    SahBuilder tree(s);
    ck(cudaMemcpy(dt,s.triangles,size_t(s.triangle_count)*sizeof(Triangle),cudaMemcpyHostToDevice));
    ck(cudaMemcpy(dn,tree.nodes.data(),tree.nodes.size()*sizeof(Node),cudaMemcpyHostToDevice));
    ck(cudaMemcpy(di,tree.order.data(),tree.order.size()*sizeof(int),cudaMemcpyHostToDevice));
    Scene d=s;d.triangles=nullptr;Query q{dt,dn,di};int total=s.width*s.height;
    const char* exact_path=std::getenv("RT_ORACLE_DOUBLE_OUTPUT");FILE* exact=exact_path?std::fopen(exact_path,"wb"):nullptr;
    if(exact_path&&!exact){std::fprintf(stderr,"cannot open double oracle output\n");std::exit(3);}
    std::vector<double> host(8192*3);
    int batch=std::max(1,std::min(8192,SAMPLE_CAP/(s.spp*std::max(1,s.ao)*s.max_depth)));
    for(int first=0;first<total;first+=batch){int n=std::min(batch,total-first);
        trace_samples<<<(n*s.spp+127)/128,128>>>(d,q,buffer,first,n);
        average<<<(n+127)/128,128>>>(d,buffer,rgb,averaged,first,n);ck(cudaDeviceSynchronize());
        if(exact){ck(cudaMemcpy(host.data(),averaged,size_t(n)*3*sizeof(double),cudaMemcpyDeviceToHost));if(std::fwrite(host.data(),sizeof(double),size_t(n)*3,exact)!=size_t(n)*3){std::fprintf(stderr,"short double oracle write\n");std::exit(3);}}
    }if(exact&&std::fclose(exact)){std::fprintf(stderr,"double oracle close failed\n");std::exit(3);}ck(cudaGetLastError());
}
