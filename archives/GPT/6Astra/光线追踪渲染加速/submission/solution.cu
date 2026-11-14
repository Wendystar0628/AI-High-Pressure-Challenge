#define PAR_DEPTH 3
#include "bvh.hpp"
#include <algorithm>
#include <cstdlib>
#include <cstdio>
#ifndef TRACE_MIN_BLOCKS
#define TRACE_MIN_BLOCKS 8
#endif
#ifndef SAH_LEAVES
#define SAH_LEAVES 1
#endif
#ifndef LEAF_SIZE
#define LEAF_SIZE 8
#endif
#if QUERY_INLINE
#define QUERY_QUAL __forceinline__
#else
#define QUERY_QUAL __noinline__
#endif
template<> HD inline V<float> V<float>::unit()const{
#ifdef __CUDA_ARCH__
    return *this*rsqrtf(dot(*this));
#else
    return *this*(1.f/sqrtf(dot(*this)));
#endif
}

struct alignas(16) FastNode { float4 a,b,c,d; };
struct alignas(16) FastTri { float4 v,e1,e2; };
struct alignas(16) Material { float4 color,normal; };
static FastNode* dnodes;
static FastNode* dcompact;
static FastTri* dtris;
static Material* dmats;
static float4* dbuf;
static Triangle* draw;
__device__ const Triangle* originalTriangles;
static int *dids0,*dids1,*dparents;
static float4 *dblo,*dbhi;
static int4 *dwork0,*dwork1;
static int* dbuild;
static Node* dpnodes;
static int* dporder;
struct PreciseQuery {
    const Triangle* tris;const Node* nodes;const int* ids;
    __device__ const Triangle& triangle(int id)const{return tris[id];}
    __device__ Hit<double> find(Ray<double> r,double limit,bool any){
        Hit<double> hit{limit,-1};int stack[64],sp=0;stack[sp++]=0;
        while(sp){const Node& n=nodes[stack[--sp]];double near;
            if(!box(n,r,hit.t,near))continue;
            if(n.count){for(int i=0;i<n.count;i++){int id=ids[n.start+i];double d;if(intersect(tris[id],r,hit.t,d)){hit={d,id};if(any)return hit;}}}
            else{stack[sp++]=n.left;stack[sp++]=n.right;}
        }return hit;
    }
    __device__ Hit<double> closest(Ray<double> r,double limit){return find(r,limit,false);}
    __device__ bool blocked(Ray<double> r,double limit){return find(r,limit,true).id>=0;}
};
__global__ void preciseTrace(Scene s,PreciseQuery q,float4* buf,int off,int pixels){
    int i=blockIdx.x*blockDim.x+threadIdx.x;if(i>=pixels*s.spp)return;
    V<double> c=radiance<double>(s,off+i/s.spp,i%s.spp,q);buf[i]=make_float4(float(c.x),float(c.y),float(c.z),0);
}
__global__ void preciseAverage(Scene s,const float4* buf,float* out,int off,int pixels){
    int p=blockIdx.x*blockDim.x+threadIdx.x;if(p>=pixels)return;double x=0,y=0,z=0;
    for(int i=0;i<s.spp;i++){float4 c=buf[p*s.spp+i];x+=c.x;y+=c.y;z+=c.z;}
    out[3*(off+p)]=float(x/s.spp);out[3*(off+p)+1]=float(y/s.spp);out[3*(off+p)+2]=float(z/s.spp);
}
__device__ float atomicMinF(float*,float);
__device__ float atomicMaxF(float*,float);
__global__ void prepareBoxes(const Triangle* tris,int n,int* ids,float4* lo,float4* hi){
    int i=blockIdx.x*blockDim.x+threadIdx.x;if(i>=n)return;Triangle t=tris[i];ids[i]=i;
    lo[i]=make_float4(fminf(t.v0[0],fminf(t.v1[0],t.v2[0])),fminf(t.v0[1],fminf(t.v1[1],t.v2[1])),fminf(t.v0[2],fminf(t.v1[2],t.v2[2])),0);
    hi[i]=make_float4(fmaxf(t.v0[0],fmaxf(t.v1[0],t.v2[0])),fmaxf(t.v0[1],fmaxf(t.v1[1],t.v2[1])),fmaxf(t.v0[2],fmaxf(t.v1[2],t.v2[2])),0);
}
__device__ float area3(float x,float y,float z){return x*y+y*z+z*x;}
__global__ void sahLevel(const int4* work,int4* next,int* build,int* ids,int* scratch,const float4* blo,const float4* bhi,FastNode* nodes,int* parents){
    int tid=threadIdx.x;int4 job=work[blockIdx.x];int begin=job.x,count=job.y,node=job.z;
    __shared__ float bounds[12][128];
    __shared__ float binsLo[48][3],binsHi[48][3];
    __shared__ int binsCount[48];
    __shared__ int axis,split,lcnt,rcnt,childBase,workBase;
    __shared__ float splitValue,scaleVal;
    float lo[3]={1e30f,1e30f,1e30f},hi[3]={-1e30f,-1e30f,-1e30f};
    float cl[3]={1e30f,1e30f,1e30f},ch[3]={-1e30f,-1e30f,-1e30f};
    for(int j=tid;j<count;j+=128){int id=ids[begin+j];float4 a=blo[id],b=bhi[id];float av[3]={a.x,a.y,a.z},bv[3]={b.x,b.y,b.z};
        for(int k=0;k<3;k++){lo[k]=fminf(lo[k],av[k]);hi[k]=fmaxf(hi[k],bv[k]);float c=.5f*(av[k]+bv[k]);cl[k]=fminf(cl[k],c);ch[k]=fmaxf(ch[k],c);}
    }
    for(int k=0;k<3;k++){bounds[k][tid]=lo[k];bounds[k+3][tid]=hi[k];bounds[k+6][tid]=cl[k];bounds[k+9][tid]=ch[k];}
    __syncthreads();
    for(int step=64;step;step>>=1){if(tid<step){for(int k=0;k<3;k++){bounds[k][tid]=fminf(bounds[k][tid],bounds[k][tid+step]);bounds[k+3][tid]=fmaxf(bounds[k+3][tid],bounds[k+3][tid+step]);bounds[k+6][tid]=fminf(bounds[k+6][tid],bounds[k+6][tid+step]);bounds[k+9][tid]=fmaxf(bounds[k+9][tid],bounds[k+9][tid+step]);}}__syncthreads();}
    if(tid==0&&node!=0){int par=parents[node];float4 a=make_float4(bounds[0][0]-1e-5f,bounds[1][0]-1e-5f,bounds[2][0]-1e-5f,__int_as_float(node));float4 b=make_float4(bounds[3][0]+1e-5f,bounds[4][0]+1e-5f,bounds[5][0]+1e-5f,0);if(__float_as_int(nodes[par].a.w)==node){nodes[par].a=a;nodes[par].b=b;}else{nodes[par].c=a;nodes[par].d=b;}}
    if(count<=(SAH_LEAVES?2:LEAF_SIZE)){if(tid==0){FastNode f{};f.a.w=__int_as_float(-1);f.b.w=__int_as_float(begin);f.c.w=__int_as_float(count);nodes[node]=f;}return;}
    if(tid<48){binsCount[tid]=0;for(int k=0;k<3;k++){binsLo[tid][k]=1e30f;binsHi[tid][k]=-1e30f;}}
    __syncthreads();
    float scales[3];for(int k=0;k<3;k++)scales[k]=15.999984f/(bounds[k+9][0]-bounds[k+6][0]+1e-20f);
    for(int j=tid;j<count;j+=128){int id=ids[begin+j];float4 a=blo[id],b=bhi[id];float av[3]={a.x,a.y,a.z},bv[3]={b.x,b.y,b.z};
        for(int k=0;k<3;k++){int bin=min(15,max(0,int((.5f*(av[k]+bv[k])-bounds[k+6][0])*scales[k])))+16*k;
            atomicAdd(binsCount+bin,1);for(int z=0;z<3;z++){atomicMinF(&binsLo[bin][z],av[z]);atomicMaxF(&binsHi[bin][z],bv[z]);}
        }
    }
    __syncthreads();
    float best=1e30f;int bestSplit=-1;
    if(tid<3){int ac=0,bc=0;float al[3]={1e30f,1e30f,1e30f},ah[3]={-1e30f,-1e30f,-1e30f};float rcost[16];int rc[16];
        for(int j=15;j>0;j--){int bin=tid*16+j;bc+=binsCount[bin];for(int k=0;k<3;k++){al[k]=fminf(al[k],binsLo[bin][k]);ah[k]=fmaxf(ah[k],binsHi[bin][k]);}rc[j]=bc;rcost[j]=bc?area3(ah[0]-al[0],ah[1]-al[1],ah[2]-al[2])*bc:0;}
        for(int k=0;k<3;k++){al[k]=1e30f;ah[k]=-1e30f;}
        for(int j=1;j<16;j++){int bin=tid*16+j-1;ac+=binsCount[bin];for(int k=0;k<3;k++){al[k]=fminf(al[k],binsLo[bin][k]);ah[k]=fmaxf(ah[k],binsHi[bin][k]);}float cost=area3(ah[0]-al[0],ah[1]-al[1],ah[2]-al[2])*ac+rcost[j];if(ac&&rc[j]&&cost<best){best=cost;bestSplit=j;}}
        bounds[tid][1]=best;bounds[tid][2]=__int_as_float(bestSplit);
    }
    __syncthreads();
    if(tid==0){axis=0;for(int k=1;k<3;k++)if(bounds[k][1]<bounds[axis][1])axis=k;
        split=__float_as_int(bounds[axis][2]);splitValue=bounds[axis+6][0];scaleVal=scales[axis];if(job.w>=40)split=-1;
        if(SAH_LEAVES&&count<=LEAF_SIZE){float area=area3(bounds[3][0]-bounds[0][0],bounds[4][0]-bounds[1][0],bounds[5][0]-bounds[2][0]);if(bounds[axis][1]+area>=count*area)split=-2;}
        lcnt=rcnt=0;if(split!=-2){childBase=atomicAdd(build+1,2);workBase=atomicAdd(build,2);}
    }
    __syncthreads();
    if(split==-2){if(tid==0){FastNode f{};f.a.w=__int_as_float(-1);f.b.w=__int_as_float(begin);f.c.w=__int_as_float(count);nodes[node]=f;}return;}
    // Partition this node into disjoint index ranges.
    for(int j=tid;j<count;j+=128){int id=ids[begin+j];float4 a=blo[id],b=bhi[id];float c=axis==0?.5f*(a.x+b.x):axis==1?.5f*(a.y+b.y):.5f*(a.z+b.z);
        bool left=split<0?j<count/2:min(15,max(0,int((c-splitValue)*scaleVal)))<split;
        int dst=left?atomicAdd(&lcnt,1):count-1-atomicAdd(&rcnt,1);scratch[begin+dst]=id;
    }
    __syncthreads();
    for(int j=tid;j<count;j+=128)ids[begin+j]=scratch[begin+j];
    __syncthreads();
    if(tid==0){
        next[workBase]=make_int4(begin,lcnt,childBase,job.w+1);next[workBase+1]=make_int4(begin+lcnt,rcnt,childBase+1,job.w+1);
        FastNode f{};f.a.w=__int_as_float(childBase);f.c.w=__int_as_float(childBase+1);nodes[node]=f;
        parents[childBase]=node;parents[childBase+1]=node;
    }
}
static void ck(cudaError_t e){if(e!=cudaSuccess){fprintf(stderr,"solution: %s\n",cudaGetErrorString(e));exit(2);}}
__device__ float atomicMinF(float* a,float v){int old=v>=0?atomicMin((int*)a,__float_as_int(v)):atomicMax((unsigned*)a,__float_as_uint(v));return __int_as_float(old);}
__device__ float atomicMaxF(float* a,float v){int old=v>=0?atomicMax((int*)a,__float_as_int(v)):atomicMin((unsigned*)a,__float_as_uint(v));return __int_as_float(old);}
__global__ void reorder(const Triangle* raw,const int* ids,int n,FastTri* tris,Material* mats,int* fragileFlag){
    int i=blockIdx.x*blockDim.x+threadIdx.x;if(i>=n)return;Triangle t=raw[ids[i]];
    V<float> v(t.v0),a=V<float>(t.v1)-v,b=V<float>(t.v2)-v;
    V<double> exactA=V<double>(t.v1)-V<double>(t.v0),exactB=V<double>(t.v2)-V<double>(t.v0),cross=exactA.cross(exactB);
    bool fragile=cross.dot(cross)<1e-10*exactA.dot(exactA)*exactB.dot(exactB);
    if(fragile)atomicExch(fragileFlag,1);
    V<double> preciseNormal=cross.unit();
    V<float> normal(float(preciseNormal.x),float(preciseNormal.y),float(preciseNormal.z));
    tris[i]={make_float4(v.x,v.y,v.z,fragile?__int_as_float(int(0x80000000u)|ids[i]):0.f),make_float4(a.x,a.y,a.z,0),make_float4(b.x,b.y,b.z,0)};
    mats[i]={make_float4(t.color[0],t.color[1],t.color[2],t.mirror),make_float4(normal.x,normal.y,normal.z,fabs(preciseNormal.z)<.8?1.f:0.f)};
}
__device__ __forceinline__ float boxnear(float4 a,float4 b,V<float> o,V<float> inv,float limit){
    float x=fmaf(a.x,inv.x,o.x),X=fmaf(b.x,inv.x,o.x);
    float y=fmaf(a.y,inv.y,o.y),Y=fmaf(b.y,inv.y,o.y);
    float z=fmaf(a.z,inv.z,o.z),Z=fmaf(b.z,inv.z,o.z);
    float mn=fmaxf(fmaxf(fminf(x,X),fminf(y,Y)),fmaxf(fminf(z,Z),.0002f));
    float mx=fminf(fminf(fmaxf(x,X),fmaxf(y,Y)),fminf(fmaxf(z,Z),limit));
    return mn<=mx?mn:1e30f;
}
__global__ void compact(const FastNode* src,FastNode* dst,int count){
    int i=blockIdx.x*blockDim.x+threadIdx.x;if(i>=count)return;FastNode n=src[i];
    if(__float_as_int(n.a.w)<0){int start=__float_as_int(n.b.w),cnt=__float_as_int(n.c.w);n.a=make_float4(-1e30f,-1e30f,-1e30f,__int_as_float(int(0x80000000u)|((cnt-1)<<24)|start));n.b=make_float4(1e30f,1e30f,1e30f,0);n.c=make_float4(0,0,0,0);n.d=make_float4(0,0,0,-1);}
    else{int l=__float_as_int(n.a.w),r=__float_as_int(n.c.w);FastNode left=src[l],right=src[r];
        if(__float_as_int(left.a.w)<0)n.a.w=__int_as_float(int(0x80000000u)|((__float_as_int(left.c.w)-1)<<24)|__float_as_int(left.b.w));
        if(__float_as_int(right.a.w)<0)n.c.w=__int_as_float(int(0x80000000u)|((__float_as_int(right.c.w)-1)<<24)|__float_as_int(right.b.w));
    }dst[i]=n;
}
template<bool ANY,bool PRECISE>
__device__ __forceinline__ bool triHit(const FastTri& t,Ray<float> r,float lim,float& dst){
    // Nearly parallel edges need the original vertices and double arithmetic.
    if constexpr(PRECISE){if(__float_as_int(t.v.w)<0){int id=__float_as_int(t.v.w)&0x7fffffff;Ray<double> rd{V<double>(r.o.x,r.o.y,r.o.z),V<double>(r.d.x,r.d.y,r.d.z)};double d;
        if(!intersect(originalTriangles[id],rd,double(lim),d))return false;dst=ANY?0.f:float(d);return true;
    }}
    V<float> e1(t.e1.x,t.e1.y,t.e1.z),e2(t.e2.x,t.e2.y,t.e2.z);
    V<float> p=r.d.cross(e2);float det=e1.dot(p),ad=fabsf(det);if(ad<1e-10f)return false;
    int sign=__float_as_int(det)&0x80000000;V<float> s=r.o-V<float>(t.v.x,t.v.y,t.v.z);
    float u=__int_as_float(__float_as_int(s.dot(p))^sign);if(u<0||u>ad)return false;
    V<float> q=s.cross(e1);float v=__int_as_float(__float_as_int(r.d.dot(q))^sign);if(v<0||u+v>ad)return false;
    float d=__int_as_float(__float_as_int(e2.dot(q))^sign);if(d<=.0002f*ad||d>=lim*ad)return false;
    dst=ANY?0.f:d*__frcp_rn(ad);return true;
}
template<bool ANY,bool PRECISE>
__device__ QUERY_QUAL Hit<float> query(Ray<float> r,float limit,const FastNode* nodes,const FastTri* tris){
    int stack[64],sp=0,cur=0;Hit<float> hit{limit,-1};
    V<float> inv(__frcp_rn(fabsf(r.d.x)<1e-30f?copysignf(1e-30f,r.d.x):r.d.x),__frcp_rn(fabsf(r.d.y)<1e-30f?copysignf(1e-30f,r.d.y):r.d.y),__frcp_rn(fabsf(r.d.z)<1e-30f?copysignf(1e-30f,r.d.z):r.d.z));
    V<float> oo(-r.o.x*inv.x,-r.o.y*inv.y,-r.o.z*inv.z);
    while(true){
        if(cur<0){int start=cur&0x00ffffff,count=((unsigned(cur)>>24)&127)+1;
            for(int i=0;i<count;i++){float t;int id=start+i;if(triHit<ANY,PRECISE>(tris[id],r,hit.t,t)){hit={t,id};if(ANY)return hit;}}
        }else{
            FastNode n=nodes[cur];int left=__float_as_int(n.a.w),right=__float_as_int(n.c.w);
            float a=boxnear(n.a,n.b,oo,inv,hit.t),b=n.d.w<0?1e30f:boxnear(n.c,n.d,oo,inv,hit.t);
            if(a<=hit.t||b<=hit.t){
                if(a<=hit.t&&b<=hit.t){if(a<b){stack[sp++]=right;cur=left;}else{stack[sp++]=left;cur=right;}}
                else cur=a<=hit.t?left:right;continue;
            }
        }
        if(!sp)break;cur=stack[--sp];
    }
    return hit;
}
template<bool PRECISE>
__device__ __forceinline__ V<float> path(const Scene& s,int pixel,int sid,const FastNode* ns,const FastTri* ts,const Material* ms){
    Ray<float> r=camera<float>(s,pixel,sid);V<float> result;float through=1;
    V<float> light=V<float>(s.light).unit();
    for(int depth=0;depth<s.max_depth;depth++){
        Hit<float> h=query<false,PRECISE>(r,1e20f,ns,ts);
        if(h.id<0){result=result+sky(r.d)*through;break;}
        Material m=ms[h.id];V<float> n(m.normal.x,m.normal.y,m.normal.z);
        if(n.dot(r.d)>0)n=n*-1.0f;
        V<float> p=r.o+r.d*h.t+n*.001f;
        float mirror=m.color.w;
        {
            float cosine=fmaxf(0,n.dot(light));
            float visible=cosine>0&&query<true,PRECISE>({p,light},1e20f,ns,ts).id<0?1.0f:0.0f;
            int open=0;V<float> axis=m.normal.w>0?V<float>(0,0,1):V<float>(0,1,0);
            V<float> tx=axis.cross(n).unit(),ty=n.cross(tx);
            for(int a=0;a<s.ao;a++){
                unsigned key=s.seed+unsigned(pixel)*0x9e3779b9u+unsigned(sid)*0x85ebca6bu+unsigned(depth)*0xc2b2ae35u+unsigned(a)*0x27d4eb2du;
                float x=2*sample<float>(key^0x68bc21ebu)-1,y=2*sample<float>(key^0x02e5be93u)-1;
                float z=.25f+.75f*sample<float>(key^0x967a889bu);
                V<float> dir=(tx*x+ty*y+n*z).unit();
                open+=query<true,PRECISE>({p,dir},s.ao_radius,ns,ts).id<0;
            }
            float ambient=s.ao?float(open)/s.ao:1.f;
            float value=.08f+.20f*ambient+.72f*cosine*visible;
            result=result+V<float>(m.color.x,m.color.y,m.color.z)*(through*(value*(1-mirror)));
        }
        through*=mirror;if(mirror==0)break;
        r={p,(r.d-n*(2*r.d.dot(n))).unit()};
    }
    return result;
}
template<bool PRECISE>
__global__ __launch_bounds__(128,TRACE_MIN_BLOCKS) void trace(Scene s,const FastNode* ns,const FastTri* ts,const Material* ms,float4* buf,int pixelOffset,int pixels){
    int i=blockIdx.x*blockDim.x+threadIdx.x;
    if(i>=pixels*s.spp)return;
    V<float> c=path<PRECISE>(s,pixelOffset+i/s.spp,i%s.spp,ns,ts,ms);
    buf[i]=make_float4(c.x,c.y,c.z,0);
}
__global__ void average(Scene s,const float4* buf,float* out,int off,int pixels){
    int p=blockIdx.x*blockDim.x+threadIdx.x;if(p>=pixels)return;
    V<float> sum;
    for(int i=0;i<s.spp;i++){float4 c=buf[p*s.spp+i];sum=sum+V<float>(c.x,c.y,c.z);}
    float inv=1.f/s.spp;out[3*(off+p)]=sum.x*inv;out[3*(off+p)+1]=sum.y*inv;out[3*(off+p)+2]=sum.z*inv;
}
void init(int mt,int mp,int ms){
    ck(cudaMalloc(&dpnodes,(2*size_t(mt)+1)*sizeof(Node)));ck(cudaMalloc(&dporder,size_t(mt)*sizeof(int)));
    ck(cudaMalloc(&dcompact,(2*size_t(mt)+1)*sizeof(FastNode)));
    ck(cudaMalloc(&dnodes,(2*size_t(mt)+1)*sizeof(FastNode)));
    ck(cudaMalloc(&dtris,size_t(mt)*sizeof(FastTri)));
    ck(cudaMalloc(&dmats,size_t(mt)*sizeof(Material)));
    ck(cudaMalloc(&dbuf,1048576*sizeof(float4)));
    ck(cudaMalloc(&draw,size_t(mt)*sizeof(Triangle)));
    ck(cudaMemcpyToSymbol(originalTriangles,&draw,sizeof(draw)));
    ck(cudaMalloc(&dids0,size_t(mt)*4));ck(cudaMalloc(&dids1,size_t(mt)*4));
    ck(cudaMalloc(&dparents,(2*size_t(mt)+1)*4));
    ck(cudaMalloc(&dblo,size_t(mt)*sizeof(float4)));ck(cudaMalloc(&dbhi,size_t(mt)*sizeof(float4)));
    ck(cudaMalloc(&dwork0,(2*size_t(mt)+1)*sizeof(int4)));ck(cudaMalloc(&dwork1,(2*size_t(mt)+1)*sizeof(int4)));ck(cudaMalloc(&dbuild,12));
}
void render(const Scene& s,float* out){
    double cameraScale=0,lightScale=0;
    for(int k=0;k<3;k++){cameraScale=std::max(cameraScale,std::max(std::fabs(double(s.u[k])),std::max(std::fabs(double(s.v[k])),std::fabs(double(s.w[k])))));lightScale=std::max(lightScale,std::fabs(double(s.light[k])));}
    bool extremeBasis=cameraScale>1e10||cameraScale<1e-10||lightScale>1e10||lightScale<1e-10;
    if(s.triangle_count>=400000||extremeBasis){
        SahBuilder tree(s);
        ck(cudaMemcpy(draw,s.triangles,size_t(s.triangle_count)*sizeof(Triangle),cudaMemcpyHostToDevice));
        ck(cudaMemcpy(dpnodes,tree.nodes.data(),tree.nodes.size()*sizeof(Node),cudaMemcpyHostToDevice));
        ck(cudaMemcpy(dporder,tree.order.data(),tree.order.size()*sizeof(int),cudaMemcpyHostToDevice));
        Scene d=s;d.triangles=nullptr;PreciseQuery q{draw,dpnodes,dporder};int pixels=s.width*s.height,chunk=std::min(65536,524288/(s.ao+1))/s.spp;
        for(int off=0;off<pixels;off+=chunk){int n=std::min(chunk,pixels-off);preciseTrace<<<(n*s.spp+127)/128,128>>>(d,q,dbuf,off,n);preciseAverage<<<(n+127)/128,128>>>(d,dbuf,out,off,n);}
        ck(cudaGetLastError());return;
    }

    int nt=s.triangle_count;
    ck(cudaMemcpy(draw,s.triangles,size_t(nt)*sizeof(Triangle),cudaMemcpyHostToDevice));
    prepareBoxes<<<(nt+255)/256,256>>>(draw,nt,dids0,dblo,dbhi);
    int4 root=make_int4(0,nt,0,0);ck(cudaMemcpy(dwork0,&root,sizeof(root),cudaMemcpyHostToDevice));
    int binfo[3]={0,1,0};ck(cudaMemcpy(dbuild,binfo,12,cudaMemcpyHostToDevice));
    int nwork=1;int4* work=dwork0;int4* next=dwork1;
    while(nwork){ck(cudaMemset(dbuild,0,4));sahLevel<<<nwork,128>>>(work,next,dbuild,dids0,dids1,dblo,dbhi,dnodes,dparents);ck(cudaMemcpy(&nwork,dbuild,4,cudaMemcpyDeviceToHost));std::swap(work,next);}
    reorder<<<(nt+255)/256,256>>>(draw,dids0,nt,dtris,dmats,dbuild+2);
    int info[2];ck(cudaMemcpy(info,dbuild+1,8,cudaMemcpyDeviceToHost));int nodes=info[0];compact<<<(nodes+127)/128,128>>>(dnodes,dcompact,nodes);


    Scene d=s;d.triangles=nullptr;int total=s.width*s.height,chunk=std::min(1048576,8388608/((s.ao+1)*s.max_depth))/s.spp;
    for(int off=0;off<total;off+=chunk){int pixels=std::min(chunk,total-off);
        if(info[1])trace<true><<<(pixels*s.spp+127)/128,128>>>(d,dcompact,dtris,dmats,dbuf,off,pixels);
        else trace<false><<<(pixels*s.spp+127)/128,128>>>(d,dcompact,dtris,dmats,dbuf,off,pixels);
        average<<<(pixels+127)/128,128>>>(d,dbuf,out,off,pixels);
    }
    ck(cudaGetLastError());

}
