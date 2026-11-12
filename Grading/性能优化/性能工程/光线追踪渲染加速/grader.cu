#include "rt.h"
#include <cuda_runtime.h>
#include <vector>
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <cmath>
#include <chrono>
static void die(const char* s){fprintf(stderr,"grader: %s\n",s);exit(1);}
static void ck(cudaError_t e){if(e!=cudaSuccess){fprintf(stderr,"CUDA_ERROR code=%d %s\n",int(e),cudaGetErrorString(e));exit(2);}}
static Scene read(const char* path,std::vector<Triangle>& t){
    FILE* f=fopen(path,"rb");if(!f)die("cannot open input");uint32_t h[8];float v[16];
    if(fread(h,4,8,f)!=8||h[0]!=0x31544252||fread(v,4,16,f)!=16)die("bad header");
    if(h[1]<1||h[1]>2048||h[2]<1||h[2]>2048||h[3]<1||h[3]>256||h[4]>64||h[5]<1||h[5]>8||h[6]<1||h[6]>1000000)die("bad size");
    Scene s{};s.width=h[1];s.height=h[2];s.spp=h[3];s.ao=h[4];s.max_depth=h[5];s.triangle_count=h[6];s.seed=h[7];
    for(int k=0;k<3;k++){s.eye[k]=v[k];s.u[k]=v[3+k];s.v[k]=v[6+k];s.w[k]=v[9+k];s.light[k]=v[12+k];}s.ao_radius=v[15];
    static_assert(sizeof(Triangle)==52,"unexpected Triangle layout");
    t.resize(s.triangle_count);if(fread(t.data(),sizeof(Triangle),t.size(),f)!=t.size()||fgetc(f)!=EOF)die("bad triangles");fclose(f);s.triangles=t.data();return s;
}
__global__ void spin(long long clocks){long long start=clock64();while(clock64()-start<clocks){}}
int main(int argc,char** argv){
    if(argc!=3)die("usage: grader.exe input.bin output.bin");
    _putenv_s("CUDA_MODULE_LOADING","EAGER");ck(cudaSetDevice(0));ck(cudaFree(nullptr));
    std::vector<Triangle> tris;Scene s=read(argv[1],tris);size_t count=size_t(s.width)*s.height*3;
    float* out;ck(cudaMalloc(&out,count*sizeof(float)));init(s.triangle_count,s.width*s.height,s.spp);ck(cudaDeviceSynchronize());
    Triangle t{{-1,-1,0},{1,-1,0},{0,1,0},{.6f,.7f,.8f},0};
    Scene w{};w.width=w.height=w.spp=w.max_depth=w.triangle_count=1;w.ao=0;w.seed=1234567;w.triangles=&t;
    w.eye[2]=2;w.u[0]=1;w.v[1]=1;w.w[2]=-1;w.light[1]=1;w.ao_radius=1;
    render(w,out);ck(cudaDeviceSynchronize());float warm[3];ck(cudaMemcpy(warm,out,12,cudaMemcpyDeviceToHost));
    for(float x:warm)if(!std::isfinite(x))die("nonfinite warmup");
    ck(cudaMemset(out,0xff,count*sizeof(float)));cudaDeviceProp prop{};ck(cudaGetDeviceProperties(&prop,0));
    auto heat=std::chrono::steady_clock::now();
    do{spin<<<prop.multiProcessorCount,128>>>(20000000LL);ck(cudaDeviceSynchronize());}
    while(std::chrono::duration<double>(std::chrono::steady_clock::now()-heat).count()<.2);
    ck(cudaDeviceSynchronize());size_t free_bytes,total_bytes;ck(cudaMemGetInfo(&free_bytes,&total_bytes));
    fprintf(stderr,"gpu_free_bytes=%zu gpu_total_bytes=%zu\n",free_bytes,total_bytes);
    auto t0=std::chrono::steady_clock::now();render(s,out);ck(cudaDeviceSynchronize());auto t1=std::chrono::steady_clock::now();
    std::vector<float> rgb(count);ck(cudaMemcpy(rgb.data(),out,count*sizeof(float),cudaMemcpyDeviceToHost));
    FILE* f=fopen(argv[2],"wb");if(!f)die("cannot open output");if(fwrite(rgb.data(),sizeof(float),count,f)!=count)die("write failed");fclose(f);
    fprintf(stderr,"render_ms=%.6f\n",std::chrono::duration<double,std::milli>(t1-t0).count());return 0;
}
