// Owner-only independent check: brute force, plane intersection + Gram barycentrics.
#include "render_math.cuh"
#include <vector>
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#ifdef _WIN32
#include <io.h>
#include <fcntl.h>
#endif
struct Brute {
    const Triangle* t;int n;
    const Triangle& triangle(int i){return t[i];}
    Hit<double> find(Ray<double> r,double limit,bool any){
        Hit<double> best{limit,-1};
        for(int i=0;i<n;i++){
            V<double> a(t[i].v0),e=V<double>(t[i].v1)-a,f=V<double>(t[i].v2)-a;
            V<double> normal=e.cross(f);double den=normal.dot(r.d);if(fabs(den)<1e-10)continue;
            double d=normal.dot(a-r.o)/den;if(d<=.0002||d>=best.t)continue;
            V<double> p=r.o+r.d*d-a;
            double aa=e.dot(e),bb=e.dot(f),cc=f.dot(f),dd=p.dot(e),ee=p.dot(f),g=aa*cc-bb*bb;
            if(g<=0)continue;double u=(dd*cc-ee*bb)/g,v=(ee*aa-dd*bb)/g;
            if(u>=0&&v>=0&&u+v<=1){best={d,i};if(any)return best;}
        }return best;
    }
    Hit<double> closest(Ray<double> r,double limit){return find(r,limit,false);}
    bool blocked(Ray<double> r,double limit){return find(r,limit,true).id>=0;}
};
int main(int argc,char** argv){
    if(argc<3)return 1;
#ifdef _WIN32
    _setmode(_fileno(stdout),_O_BINARY);
#endif
    FILE* in=fopen(argv[1],"rb");if(!in)return 1;uint32_t h[8];float a[16];
    if(fread(h,4,8,in)!=8||fread(a,4,16,in)!=16)return 2;
    Scene s{};s.width=h[1];s.height=h[2];s.spp=h[3];s.ao=h[4];s.max_depth=h[5];s.triangle_count=h[6];s.seed=h[7];
    for(int k=0;k<3;k++){s.eye[k]=a[k];s.u[k]=a[k+3];s.v[k]=a[k+6];s.w[k]=a[k+9];s.light[k]=a[k+12];}s.ao_radius=a[15];
    std::vector<Triangle> tris(s.triangle_count);if(fread(tris.data(),52,tris.size(),in)!=tris.size())return 2;fclose(in);s.triangles=tris.data();
    FILE* output=fopen(argv[2],"wb");if(!output)return 3;
    Brute q{tris.data(),s.triangle_count};
    // Exactly 32 deterministic pixels, including four image corners.
    for(uint32_t j=0;j<32+uint32_t(argc-3);j++){
        uint32_t pixel=j>=32?uint32_t(strtoul(argv[j-32+3],nullptr,10)):j==0?0:j==1?s.width-1:j==2?(s.height-1)*s.width:j==3?s.width*s.height-1:mix32(j*1234567u)%(s.width*s.height);
        V<double> c;for(int k=0;k<s.spp;k++)c=c+radiance<double>(s,int(pixel),k,q);c=c*(1.0/s.spp);
        float color[3]={float(c.x),float(c.y),float(c.z)};fwrite(&pixel,4,1,output);fwrite(color,4,3,output);
    }fclose(output);return 0;
}
