#include <cuda_runtime.h>
#include <cuda_fp16.h>
#include <mma.h>
#include <vector>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <algorithm>

struct TransformerSpec { int B, S, D, H, F, L; const float* weights; };

namespace {
using half = __half;
using namespace nvcuda;

void ck(cudaError_t e) {
    if (e != cudaSuccess) {
        std::fprintf(stderr, "CUDA: %s\n", cudaGetErrorString(e));
        std::exit(1);
    }
}
template<class T> T* alloc(size_t n) {
    T* p; ck(cudaMalloc(&p,n*sizeof(T))); return p;
}
template<class T> T* upload(const std::vector<T>& v) {
    T* p=alloc<T>(v.size());
    ck(cudaMemcpy(p,v.data(),v.size()*sizeof(T),cudaMemcpyHostToDevice));
    return p;
}

__device__ __forceinline__ float warp_sum(float v) {
    #pragma unroll
    for(int d=16;d;d>>=1) v+=__shfl_xor_sync(0xffffffff,v,d);
    return v;
}
template<int D, bool OUT_FLOAT=false, bool PRECISE=false>
__global__ void norm(const float* x, void* out, const float* g, const float* b, int rows) {
    int row=blockIdx.x*8+threadIdx.x/32, lane=threadIdx.x%32;
    if(row>=rows) return;
    float z[(D+31)/32];
    float sum=0,ss=0;
    #pragma unroll
    for(int k=0;k<(D+31)/32;k++) {
        int j=lane+32*k;
        float v=j<D ? x[(size_t)row*D+j]:0;
        z[k]=v; sum+=v; ss+=v*v;
    }
    float mean=warp_sum(sum)/D;
    float inv=rsqrtf(fmaxf(0.f,warp_sum(ss)/D-mean*mean)+1.e-5f);
    #pragma unroll
    for(int k=0;k<(D+31)/32;k++) {
        int j=lane+32*k;
        if(j<D) {
            float v=(z[k]-mean)*inv*g[j]+b[j];
            if constexpr(OUT_FLOAT) ((float*)out)[(size_t)row*D+j]=v;
            else {
                half hi=__float2half_rn(v);
                ((half*)out)[(size_t)row*D+j]=hi;
                if constexpr(PRECISE) ((half*)out)[(size_t)(row+rows)*D+j]=__float2half_rn(v-__half2float(hi));
            }
        }
    }
}

// Four warps, each computing a 32 x 32 output tile. All dot products
// accumulate in float. The epilogue incorporates bias and the next operation.
template<int MODE, bool PRECISE=false, int SD=0, int SH=0, int SS=0>
__global__ void gemm(const half* a,const half* w,void* out,const float* bias,
                     const float* residual,int M,int N,int K,int Sarg,int Harg,int Darg,int SP,int B) {
    constexpr int TK=PRECISE?32:64;
    const int S=SS?SS:Sarg, H=SH?SH:Harg, D=SD?SD:Darg;
    __shared__ union {
        struct { half a[64][TK+8],b[TK][72],al[PRECISE?64:1][TK+8],bl[PRECISE?TK:1][72]; } in;
        float c[64][68];
    } sh;
    auto& as=sh.in.a; auto& bs=sh.in.b;
    auto& al=sh.in.al; auto& bl=sh.in.bl; auto& cs=sh.c;
    int tid=threadIdx.x, warp=tid/32;
    int rm=blockIdx.x*64, cn=blockIdx.y*64;
    int wr=(warp/2)*32, wc=(warp%2)*32;
    wmma::fragment<wmma::accumulator,16,16,16,float> c[2][2];
    #pragma unroll
    for(int i=0;i<2;i++)
        #pragma unroll
        for(int j=0;j<2;j++) wmma::fill_fragment(c[i][j],0.f);
    for(int kb=0;kb<K;kb+=TK) {
        if(K%TK==0 && N%64==0) {
            for(int z=tid;z<64*(TK/8);z+=128) {
                int r=z/(TK/8),k=(z%(TK/8))*8;
                int4 v={0,0,0,0};
                if(rm+r<M) v=*(const int4*)(a+(size_t)(rm+r)*K+kb+k);
                *(int4*)&as[r][k]=v;
                if constexpr(PRECISE) {
                    if(rm+r<M) v=*(const int4*)(a+(size_t)(rm+r+M)*K+kb+k);
                    *(int4*)&al[r][k]=v;
                }
            }
            for(int z=tid;z<TK*8;z+=128) {
                int k=z/8,n=z%8*8;
                *(int4*)&bs[k][n]=*(const int4*)(w+(size_t)(kb+k)*N+cn+n);
                if constexpr(PRECISE) *(int4*)&bl[k][n]=*(const int4*)(w+(size_t)(kb+k+K)*N+cn+n);
            }
        } else {
            for(int z=tid;z<64*TK;z+=128) {
                int r=z/TK,k=z%TK;
                as[r][k]=(rm+r<M && kb+k<K)?a[(size_t)(rm+r)*K+kb+k]:__float2half(0.f);
                if constexpr(PRECISE) al[r][k]=(rm+r<M && kb+k<K)?a[(size_t)(rm+r+M)*K+kb+k]:__float2half(0.f);
            }
            for(int z=tid;z<TK*64;z+=128) {
                int k=z/64,n=z%64;
                bs[k][n]=(kb+k<K && cn+n<N)?w[(size_t)(kb+k)*N+cn+n]:__float2half(0.f);
                if constexpr(PRECISE) bl[k][n]=(kb+k<K && cn+n<N)?w[(size_t)(kb+k+K)*N+cn+n]:__float2half(0.f);
            }
        }
        __syncthreads();
        #pragma unroll
        for(int kk=0;kk<TK;kk+=16) {
            wmma::fragment<wmma::matrix_a,16,16,16,half,wmma::row_major> av[2];
            wmma::fragment<wmma::matrix_b,16,16,16,half,wmma::row_major> bv[2];
            #pragma unroll
            for(int i=0;i<2;i++) wmma::load_matrix_sync(av[i],&as[wr+i*16][kk],TK+8);
            #pragma unroll
            for(int j=0;j<2;j++) wmma::load_matrix_sync(bv[j],&bs[kk][wc+j*16],72);
            #pragma unroll
            for(int i=0;i<2;i++)
                #pragma unroll
                for(int j=0;j<2;j++) wmma::mma_sync(c[i][j],av[i],bv[j],c[i][j]);
            if constexpr(PRECISE) {
                wmma::fragment<wmma::matrix_a,16,16,16,half,wmma::row_major> ax[2];
                wmma::fragment<wmma::matrix_b,16,16,16,half,wmma::row_major> bx[2];
                #pragma unroll
                for(int i=0;i<2;i++) wmma::load_matrix_sync(ax[i],&al[wr+i*16][kk],TK+8);
                #pragma unroll
                for(int j=0;j<2;j++) wmma::load_matrix_sync(bx[j],&bl[kk][wc+j*16],72);
                #pragma unroll
                for(int i=0;i<2;i++)
                    #pragma unroll
                    for(int j=0;j<2;j++) {
                        wmma::mma_sync(c[i][j],av[i],bx[j],c[i][j]);
                        wmma::mma_sync(c[i][j],ax[i],bv[j],c[i][j]);
                    }
            }
        }
        __syncthreads();
    }
    #pragma unroll
    for(int i=0;i<2;i++)
        #pragma unroll
        for(int j=0;j<2;j++) wmma::store_matrix_sync(&cs[wr+i*16][wc+j*16],c[i][j],68,wmma::mem_row_major);
    __syncthreads();
    for(int z=tid;z<64*64;z+=128) {
        int r=rm+z/64,n=cn+z%64;
        if(r<M && n<N) {
            float v=cs[z/64][z%64]+bias[n];
            if constexpr(MODE==0) {
                int part=n/D, h=(n%D)/(D/H), d=n%(D/H);
                size_t idx=(((size_t)(part*B+r/S)*H+h)*SP+r%S)*(D/H)+d;
                half hi=__float2half_rn(v);
                ((half*)out)[idx]=hi;
                if constexpr(PRECISE) ((half*)out)[idx+(size_t)3*B*SP*D]=__float2half_rn(v-__half2float(hi));
            } else if constexpr(MODE==1) {
                ((float*)out)[(size_t)r*N+n]=residual[(size_t)r*N+n]+v;
            } else {
                v=0.5f*v*(1.f+erff(v*0.7071067811865475f));
                half hi=__float2half_rn(v);
                ((half*)out)[(size_t)r*N+n]=hi;
                if constexpr(PRECISE) ((half*)out)[(size_t)(r+M)*N+n]=__float2half_rn(v-__half2float(hi));
            }
        }
    }
}



// Wider output tiles reuse each operand across more products.
template<int MODE,int SD=0,int SH=0,int SS=0>
__global__ __launch_bounds__(256,2) void gemm_wide(const half* a,const half* w,void* out,const float* bias,
    const float* residual,int M,int N,int K,int Sarg,int Harg,int Darg,int SP,int B) {
    const int S=SS?SS:Sarg,H=SH?SH:Harg,D=SD?SD:Darg;
    __shared__ union {
        struct { half a[128][72],b[64][136]; } in;
        float c[128][68];
    } sh;
    int tid=threadIdx.x,warp=tid/32;
    int rm=blockIdx.x*128,cn=blockIdx.y*128,wr=warp/2*32,wc=warp%2*64;
    wmma::fragment<wmma::accumulator,16,16,16,float> c[2][4];
    #pragma unroll
    for(int i=0;i<2;i++)
        #pragma unroll
        for(int j=0;j<4;j++) wmma::fill_fragment(c[i][j],0.f);
    for(int kb=0;kb<K;kb+=64) {
        #pragma unroll
        for(int z=tid;z<128*8;z+=256) {
            int r=z/8,k=z%8*8;
            int4 val={0,0,0,0};
            if(rm+r<M) val=*(const int4*)(a+(size_t)(rm+r)*K+kb+k);
            *(int4*)&sh.in.a[r][k]=val;
        }
        #pragma unroll
        for(int z=tid;z<64*16;z+=256) {
            int k=z/16,n=z%16*8;
            *(int4*)&sh.in.b[k][n]=*(const int4*)(w+(size_t)(kb+k)*N+cn+n);
        }
        __syncthreads();
        #pragma unroll
        for(int kk=0;kk<64;kk+=16) {
            wmma::fragment<wmma::matrix_a,16,16,16,half,wmma::row_major> av[2];
            #pragma unroll
            for(int i=0;i<2;i++) wmma::load_matrix_sync(av[i],&sh.in.a[wr+i*16][kk],72);
            #pragma unroll
            for(int j=0;j<4;j++) {
                wmma::fragment<wmma::matrix_b,16,16,16,half,wmma::row_major> bv;
                wmma::load_matrix_sync(bv,&sh.in.b[kk][wc+j*16],136);
                #pragma unroll
                for(int i=0;i<2;i++) wmma::mma_sync(c[i][j],av[i],bv,c[i][j]);
            }
        }
        __syncthreads();
    }
    #pragma unroll
    for(int phase=0;phase<2;phase++) {
        if(warp%2==phase) {
            #pragma unroll
            for(int i=0;i<2;i++)
                #pragma unroll
                for(int j=0;j<4;j++) wmma::store_matrix_sync(&sh.c[wr+i*16][j*16],c[i][j],68,wmma::mem_row_major);
        }
        __syncthreads();
        for(int z=tid;z<128*64;z+=256) {
            int r=rm+z/64,n=cn+phase*64+z%64;
            if(r<M) {
                float val=sh.c[z/64][z%64]+bias[n];
                if constexpr(MODE==0) {
                    int part=n/D,h=(n%D)/(D/H),d=n%(D/H);
                    size_t idx=(((size_t)(part*B+r/S)*H+h)*SP+r%S)*(D/H)+d;
                    ((half*)out)[idx]=__float2half_rn(val);
                } else if constexpr(MODE==1) {
                    ((float*)out)[(size_t)r*N+n]=residual[(size_t)r*N+n]+val;
                } else {
                    val=0.5f*val*(1.f+erff(val*0.7071067811865475f));
                    ((half*)out)[(size_t)r*N+n]=__float2half_rn(val);
                }
            }
        }
        __syncthreads();
    }
}

// The whole residual row is owned by one CTA, so the following layer norm
// needs neither another global read of the residual nor a separate launch.
template<int N,bool PRECISE=false,bool FINAL=false>
__global__ void residual_norm(const half* a,const half* w,float* out,const float* bias,
    const float* residual,void* normalized,const float* gamma,const float* beta,int M,int K) {
    constexpr int RT=4096/N;
    __shared__ union {
        struct { half a[RT][40],b[32][N+8],al[PRECISE?RT:1][40],bl[PRECISE?32:1][N+8]; } in;
        float c[RT][N+8];
    } sh;
    int tid=threadIdx.x,warp=tid/32,lane=tid%32;
    int rm=blockIdx.x*RT,wr=warp/(N/64)*16,wc=warp%(N/64)*64;
    wmma::fragment<wmma::accumulator,16,16,16,float> c[4];
    #pragma unroll
    for(int j=0;j<4;j++) wmma::fill_fragment(c[j],0.f);
    for(int kb=0;kb<K;kb+=32) {
        #pragma unroll
        for(int z=tid;z<RT*4;z+=128) {
            int r=z/4,k=z%4*8;
            int4 val={0,0,0,0};
            if(rm+r<M) val=*(const int4*)(a+(size_t)(rm+r)*K+kb+k);
            *(int4*)&sh.in.a[r][k]=val;
            if constexpr(PRECISE) {
                if(rm+r<M) val=*(const int4*)(a+(size_t)(rm+r+M)*K+kb+k);
                *(int4*)&sh.in.al[r][k]=val;
            }
        }
        #pragma unroll
        for(int z=tid;z<32*(N/8);z+=128) {
            int k=z/(N/8),n=z%(N/8)*8;
            *(int4*)&sh.in.b[k][n]=*(const int4*)(w+(size_t)(kb+k)*N+n);
            if constexpr(PRECISE) *(int4*)&sh.in.bl[k][n]=*(const int4*)(w+(size_t)(kb+k+K)*N+n);
        }
        __syncthreads();
        #pragma unroll
        for(int kk=0;kk<32;kk+=16) {
            wmma::fragment<wmma::matrix_a,16,16,16,half,wmma::row_major> av,al;
            wmma::load_matrix_sync(av,&sh.in.a[wr][kk],40);
            if constexpr(PRECISE) wmma::load_matrix_sync(al,&sh.in.al[wr][kk],40);
            #pragma unroll
            for(int j=0;j<4;j++) {
                wmma::fragment<wmma::matrix_b,16,16,16,half,wmma::row_major> bv;
                wmma::load_matrix_sync(bv,&sh.in.b[kk][wc+j*16],N+8);
                wmma::mma_sync(c[j],av,bv,c[j]);
                if constexpr(PRECISE) {
                    wmma::mma_sync(c[j],al,bv,c[j]);
                    wmma::load_matrix_sync(bv,&sh.in.bl[kk][wc+j*16],N+8);
                    wmma::mma_sync(c[j],av,bv,c[j]);
                }
            }
        }
        __syncthreads();
    }
    #pragma unroll
    for(int j=0;j<4;j++) wmma::store_matrix_sync(&sh.c[wr][wc+j*16],c[j],N+8,wmma::mem_row_major);
    __syncthreads();
    #pragma unroll
    for(int r=warp;r<RT;r+=4) {
        if(rm+r<M) {
            float z[N/32],sum=0,ss=0;
            #pragma unroll
            for(int j=0;j<N/32;j++) {
                int col=lane+j*32;
                float val=sh.c[r][col]+bias[col]+residual[(size_t)(rm+r)*N+col];
                z[j]=val;sum+=val;ss+=val*val;
                if constexpr(!FINAL) out[(size_t)(rm+r)*N+col]=val;
            }
            float mean=warp_sum(sum)/N;
            float inv=rsqrtf(fmaxf(0.f,warp_sum(ss)/N-mean*mean)+1.e-5f);
            #pragma unroll
            for(int j=0;j<N/32;j++) {
                int col=lane+j*32;
                float val=(z[j]-mean)*inv*gamma[col]+beta[col];
                if constexpr(FINAL) ((float*)normalized)[(size_t)(rm+r)*N+col]=val;
                else {
                    half hi=__float2half_rn(val);
                    ((half*)normalized)[(size_t)(rm+r)*N+col]=hi;
                    if constexpr(PRECISE) ((half*)normalized)[(size_t)(rm+r+M)*N+col]=__float2half_rn(val-__half2float(hi));
                }
            }
        }
    }
}

template<int D,int H,int S,bool PRECISE=false>
__global__ void qkv_projection(const half* a,const half* w,half* out,const float* bias,int M,int SP,int B) {
    constexpr int N=3*D,K=D,RT=D==64?32:16;
    __shared__ union {
        struct { half a[RT][40],b[32][N+8],al[PRECISE?RT:1][40],bl[PRECISE?32:1][N+8]; } in;
        float c[RT][N+8];
    } sh;
    int tid=threadIdx.x,warp=tid/32,lane=tid%32;
    int rm=blockIdx.x*RT,wr=warp/(N/96)*16,wc=warp%(N/96)*96;
    wmma::fragment<wmma::accumulator,16,16,16,float> c[6];
    #pragma unroll
    for(int j=0;j<6;j++) wmma::fill_fragment(c[j],0.f);
    for(int kb=0;kb<K;kb+=32) {
        #pragma unroll
        for(int z=tid;z<RT*4;z+=128) {
            int r=z/4,k=z%4*8;
            int4 val={0,0,0,0};
            if(rm+r<M) val=*(const int4*)(a+(size_t)(rm+r)*K+kb+k);
            *(int4*)&sh.in.a[r][k]=val;
            if constexpr(PRECISE) {
                if(rm+r<M) val=*(const int4*)(a+(size_t)(rm+r+M)*K+kb+k);
                *(int4*)&sh.in.al[r][k]=val;
            }
        }
        #pragma unroll
        for(int z=tid;z<32*(N/8);z+=128) {
            int k=z/(N/8),n=z%(N/8)*8;
            *(int4*)&sh.in.b[k][n]=*(const int4*)(w+(size_t)(kb+k)*N+n);
            if constexpr(PRECISE) *(int4*)&sh.in.bl[k][n]=*(const int4*)(w+(size_t)(kb+k+K)*N+n);
        }
        __syncthreads();
        #pragma unroll
        for(int kk=0;kk<32;kk+=16) {
            wmma::fragment<wmma::matrix_a,16,16,16,half,wmma::row_major> av,al;
            wmma::load_matrix_sync(av,&sh.in.a[wr][kk],40);
            if constexpr(PRECISE) wmma::load_matrix_sync(al,&sh.in.al[wr][kk],40);
            #pragma unroll
            for(int j=0;j<6;j++) {
                wmma::fragment<wmma::matrix_b,16,16,16,half,wmma::row_major> bv;
                wmma::load_matrix_sync(bv,&sh.in.b[kk][wc+j*16],N+8);
                wmma::mma_sync(c[j],av,bv,c[j]);
                if constexpr(PRECISE) {
                    wmma::mma_sync(c[j],al,bv,c[j]);
                    wmma::load_matrix_sync(bv,&sh.in.bl[kk][wc+j*16],N+8);
                    wmma::mma_sync(c[j],av,bv,c[j]);
                }
            }
        }
        __syncthreads();
    }
    #pragma unroll
    for(int j=0;j<6;j++) wmma::store_matrix_sync(&sh.c[wr][wc+j*16],c[j],N+8,wmma::mem_row_major);
    __syncthreads();

    for(int z=tid;z<RT*N;z+=128) {
        int r=rm+z/N,n=z%N;
        if(r<M) {
            float value=sh.c[z/N][n]+bias[n];
            half hi=__float2half_rn(value);
            int part=n/D,h=(n%D)/(D/H),d=n%(D/H);
            size_t idx=(((size_t)(part*B+r/S)*H+h)*SP+r%S)*(D/H)+d;
            out[idx]=hi;
            if constexpr(PRECISE) out[idx+(size_t)3*B*SP*D]=__float2half_rn(value-__half2float(hi));
        }
    }
}


// Both feed-forward projections share their hidden activation in shared memory.
template<int N,bool PRECISE=false,bool FINAL=false>
__global__ void feed_forward(const half* a,const half* w1,const half* w2,float* out,
    const float* bias1,const float* bias,const float* residual,void* normalized,
    const float* gamma,const float* beta,int M) {
    constexpr int RT=4096/N;
    __shared__ union {
        struct { half a[RT][40],al[PRECISE?RT:1][40]; } in;
        float c[RT][N+8];
    } sh;
    __shared__ half ws[32][N+8],wl[PRECISE?32:1][N+8];
    __shared__ half hidden[RT][N+8],hidden_lo[PRECISE?RT:1][N+8];
    int tid=threadIdx.x,warp=tid/32,lane=tid%32;
    int rm=blockIdx.x*RT,wr=warp/(N/64)*16,wc=warp%(N/64)*64;
    wmma::fragment<wmma::accumulator,16,16,16,float> c[4];
    #pragma unroll
    for(int phase=0;phase<2;phase++) {
        #pragma unroll
        for(int j=0;j<4;j++) wmma::fill_fragment(c[j],0.f);
        const half* w=phase==0?w1:w2;
        for(int kb=0;kb<N;kb+=32) {
            if(phase==0) {
                #pragma unroll
                for(int z=tid;z<RT*4;z+=128) {
                    int r=z/4,k=z%4*8;
                    int4 val={0,0,0,0};
                    if(rm+r<M) val=*(const int4*)(a+(size_t)(rm+r)*N+kb+k);
                    *(int4*)&sh.in.a[r][k]=val;
                    if constexpr(PRECISE) {
                        if(rm+r<M) val=*(const int4*)(a+(size_t)(rm+r+M)*N+kb+k);
                        *(int4*)&sh.in.al[r][k]=val;
                    }
                }
            }
            #pragma unroll
            for(int z=tid;z<32*(N/8);z+=128) {
                int k=z/(N/8),n=z%(N/8)*8;
                *(int4*)&ws[k][n]=*(const int4*)(w+(size_t)(kb+k)*N+n);
                if constexpr(PRECISE) *(int4*)&wl[k][n]=*(const int4*)(w+(size_t)(kb+k+N)*N+n);
            }
            __syncthreads();
            #pragma unroll
            for(int kk=0;kk<32;kk+=16) {
                wmma::fragment<wmma::matrix_a,16,16,16,half,wmma::row_major> av,al;
                if(phase==0) {
                    wmma::load_matrix_sync(av,&sh.in.a[wr][kk],40);
                    if constexpr(PRECISE) wmma::load_matrix_sync(al,&sh.in.al[wr][kk],40);
                } else {
                    wmma::load_matrix_sync(av,&hidden[wr][kb+kk],N+8);
                    if constexpr(PRECISE) wmma::load_matrix_sync(al,&hidden_lo[wr][kb+kk],N+8);
                }
                #pragma unroll
                for(int j=0;j<4;j++) {
                    wmma::fragment<wmma::matrix_b,16,16,16,half,wmma::row_major> bv;
                    wmma::load_matrix_sync(bv,&ws[kk][wc+j*16],N+8);
                    wmma::mma_sync(c[j],av,bv,c[j]);
                    if constexpr(PRECISE) {
                        wmma::mma_sync(c[j],al,bv,c[j]);
                        wmma::load_matrix_sync(bv,&wl[kk][wc+j*16],N+8);
                        wmma::mma_sync(c[j],av,bv,c[j]);
                    }
                }
            }
            __syncthreads();
        }
        #pragma unroll
        for(int j=0;j<4;j++) wmma::store_matrix_sync(&sh.c[wr][wc+j*16],c[j],N+8,wmma::mem_row_major);
        __syncthreads();
        if(phase==0) {
            for(int z=tid;z<RT*N;z+=128) {
                int r=z/N,n=z%N;
                float val=sh.c[r][n]+bias1[n];
                val=0.5f*val*(1.f+erff(val*0.7071067811865475f));
                half hi=__float2half_rn(val);
                hidden[r][n]=hi;
                if constexpr(PRECISE) hidden_lo[r][n]=__float2half_rn(val-__half2float(hi));
            }
            __syncthreads();
        }
    }
    #pragma unroll
    for(int r=warp;r<RT;r+=4) {
        if(rm+r<M) {
            float z[N/32],sum=0,ss=0;
            #pragma unroll
            for(int j=0;j<N/32;j++) {
                int col=lane+j*32;
                float val=sh.c[r][col]+bias[col]+residual[(size_t)(rm+r)*N+col];
                z[j]=val;sum+=val;ss+=val*val;
                if constexpr(!FINAL) out[(size_t)(rm+r)*N+col]=val;
            }
            float mean=warp_sum(sum)/N;
            float inv=rsqrtf(fmaxf(0.f,warp_sum(ss)/N-mean*mean)+1.e-5f);
            #pragma unroll
            for(int j=0;j<N/32;j++) {
                int col=lane+j*32;
                float val=(z[j]-mean)*inv*gamma[col]+beta[col];
                if constexpr(FINAL) ((float*)normalized)[(size_t)(rm+r)*N+col]=val;
                else {
                    half hi=__float2half_rn(val);
                    ((half*)normalized)[(size_t)(rm+r)*N+col]=hi;
                    if constexpr(PRECISE) ((half*)normalized)[(size_t)(rm+r+M)*N+col]=__float2half_rn(val-__half2float(hi));
                }
            }
        }
    }
}

__device__ __forceinline__ unsigned pack(half a,half b) {
    return (unsigned)__half_as_ushort(a)|((unsigned)__half_as_ushort(b)<<16);
}
__device__ __forceinline__ void mma16816(float* c,unsigned a0,unsigned a1,unsigned a2,unsigned a3,unsigned b0,unsigned b1) {
    asm volatile("mma.sync.aligned.m16n8k16.row.col.f32.f16.f16.f32 "
                 "{%0,%1,%2,%3}, {%4,%5,%6,%7}, {%8,%9}, {%0,%1,%2,%3};"
                 : "+f"(c[0]),"+f"(c[1]),"+f"(c[2]),"+f"(c[3])
                 : "r"(a0),"r"(a1),"r"(a2),"r"(a3),"r"(b0),"r"(b1));
}

__device__ __forceinline__ void mma1688(float* c,unsigned a0,unsigned a1,unsigned b0) {
    asm volatile("mma.sync.aligned.m16n8k8.row.col.f32.f16.f16.f32 "
                 "{%0,%1,%2,%3}, {%4,%5}, {%6}, {%0,%1,%2,%3};"
                 : "+f"(c[0]),"+f"(c[1]),"+f"(c[2]),"+f"(c[3])
                 : "r"(a0),"r"(a1),"r"(b0));
}
__device__ __forceinline__ float fast_exp2(float x) {
    float y;
    asm("ex2.approx.ftz.f32 %0,%1;" : "=f"(y) : "f"(x));
    return y;
}
template<int DH,int BC=64,bool PRECISE=false,int BM=128>
__global__ __launch_bounds__(BM*2) void attention(const half* qkv,half* out,int S,int SP,int H,int D,int B,int qbase) {
    constexpr int DP=DH<16?16:DH;
    constexpr int ND=(DH+7)/8,LD=DH<8?8:DP;
    __shared__ half ks[BC][DP+8];
    __shared__ half vs[DP][BC+8];
    __shared__ half kl[PRECISE?BC:1][DP+8];
    __shared__ half vl[PRECISE?DP:1][BC+8];
    int tid=threadIdx.x, warp=tid/32,lane=tid%32;
    int rr=lane/4, cc=(lane%4)*2;
    int bh=blockIdx.y, batch=bh/H,head=bh%H;
    int qb=(blockIdx.x+qbase)*BM;
    int qr=qb+warp*16+rr;
    size_t plane=(size_t)B*H*SP*DH;
    const half* q=qkv+(size_t)bh*SP*DH;
    const half* k=q+plane;
    const half* v=k+plane;
    unsigned aq[DP/16][4];
    unsigned aqlo[PRECISE?DP/16:1][4];
    #pragma unroll
    for(int t=0;t<DP/16;t++) {
        int dim=t*16+cc;
        aq[t][0]=qr<S && dim<DH?pack(q[(size_t)qr*DH+dim],q[(size_t)qr*DH+dim+1]):0;
        aq[t][1]=qr+8<S && dim<DH?pack(q[(size_t)(qr+8)*DH+dim],q[(size_t)(qr+8)*DH+dim+1]):0;
        aq[t][2]=qr<S && dim+8<DH?pack(q[(size_t)qr*DH+dim+8],q[(size_t)qr*DH+dim+9]):0;
        aq[t][3]=qr+8<S && dim+8<DH?pack(q[(size_t)(qr+8)*DH+dim+8],q[(size_t)(qr+8)*DH+dim+9]):0;
        if constexpr(PRECISE) {
            const half* ql=q+plane*3;
            aqlo[t][0]=qr<S && dim<DH?pack(ql[(size_t)qr*DH+dim],ql[(size_t)qr*DH+dim+1]):0;
            aqlo[t][1]=qr+8<S && dim<DH?pack(ql[(size_t)(qr+8)*DH+dim],ql[(size_t)(qr+8)*DH+dim+1]):0;
            aqlo[t][2]=qr<S && dim+8<DH?pack(ql[(size_t)qr*DH+dim+8],ql[(size_t)qr*DH+dim+9]):0;
            aqlo[t][3]=qr+8<S && dim+8<DH?pack(ql[(size_t)(qr+8)*DH+dim+8],ql[(size_t)(qr+8)*DH+dim+9]):0;
        }
    }
    float acc[ND][4]={};
    float mx[2]={-1.e30f,-1.e30f},sum[2]={0,0};
    const float scale=1.4426950408889634f/sqrtf((float)DH);
    int end=min(S,qb+BM);
    for(int kb=0;kb<end;kb+=BC) {

        if constexpr(DH>=32 && !PRECISE) {
            for(int z=tid;z<BC*(DP/8);z+=BM*2) {
                int r=z/(DP/8),d=z%(DP/8)*8;
                int4 kv={0,0,0,0},vv={0,0,0,0};
                if(kb+r<S) {
                    kv=*(const int4*)(k+(size_t)(kb+r)*DH+d);
                    vv=*(const int4*)(v+(size_t)(kb+r)*DH+d);
                }
                *(int4*)&ks[r][d]=kv;
                const half* vals=(const half*)&vv;
                #pragma unroll
                for(int j=0;j<8;j++) vs[d+j][r^((d/8)&7)*2]=vals[j];
            }
        } else {
        for(int z=tid;z<BC*LD;z+=BM*2) {
            int r=z/LD,d=z%LD;
            ks[r][d]=(kb+r<S && d<DH)?k[(size_t)(kb+r)*DH+d]:__float2half(0.f);
            vs[d][r]=(kb+r<S && d<DH)?v[(size_t)(kb+r)*DH+d]:__float2half(0.f);
            if constexpr(PRECISE) {
                kl[r][d]=(kb+r<S && d<DH)?k[3*plane+(size_t)(kb+r)*DH+d]:__float2half(0.f);
                vl[d][r]=(kb+r<S && d<DH)?v[3*plane+(size_t)(kb+r)*DH+d]:__float2half(0.f);
            }
        }
        }
        __syncthreads();
        float sc[BC/8][4]={};
        if constexpr(DH==64) {
        #pragma unroll
        for(int n=0;n<BC/8;n++) {
            #pragma unroll
            for(int t=0;t<DP/16;t++) {
                unsigned b0=pack(ks[n*8+rr][t*16+cc],ks[n*8+rr][t*16+cc+1]);
                unsigned b1=pack(ks[n*8+rr][t*16+cc+8],ks[n*8+rr][t*16+cc+9]);
                if constexpr(DH<8) mma1688(sc[n],aq[t][0],aq[t][1],b0);
                else mma16816(sc[n],aq[t][0],aq[t][1],aq[t][2],aq[t][3],b0,b1);
                if constexpr(PRECISE) {
                    unsigned l0=pack(kl[n*8+rr][t*16+cc],kl[n*8+rr][t*16+cc+1]);
                    unsigned l1=pack(kl[n*8+rr][t*16+cc+8],kl[n*8+rr][t*16+cc+9]);
                    mma16816(sc[n],aq[t][0],aq[t][1],aq[t][2],aq[t][3],l0,l1);
                    mma16816(sc[n],aqlo[t][0],aqlo[t][1],aqlo[t][2],aqlo[t][3],b0,b1);
                }
            }
        }
        } else {
        #pragma unroll
        for(int t=0;t<DP/16;t++) {
            #pragma unroll
            for(int n=0;n<BC/8;n++) {
                unsigned b0=pack(ks[n*8+rr][t*16+cc],ks[n*8+rr][t*16+cc+1]);
                unsigned b1=pack(ks[n*8+rr][t*16+cc+8],ks[n*8+rr][t*16+cc+9]);
                if constexpr(DH<8) mma1688(sc[n],aq[t][0],aq[t][1],b0);
                else mma16816(sc[n],aq[t][0],aq[t][1],aq[t][2],aq[t][3],b0,b1);
                if constexpr(PRECISE) {
                    unsigned l0=pack(kl[n*8+rr][t*16+cc],kl[n*8+rr][t*16+cc+1]);
                    unsigned l1=pack(kl[n*8+rr][t*16+cc+8],kl[n*8+rr][t*16+cc+9]);
                    mma16816(sc[n],aq[t][0],aq[t][1],aq[t][2],aq[t][3],l0,l1);
                    mma16816(sc[n],aqlo[t][0],aqlo[t][1],aqlo[t][2],aqlo[t][3],b0,b1);
                }
            }
        }
        }
        float nm[2]={mx[0],mx[1]};
        #pragma unroll
        for(int n=0;n<BC/8;n++) {
            #pragma unroll
            for(int j=0;j<4;j++) {
                int key=kb+n*8+cc+(j%2),query=qr+(j/2)*8;
                float z=(key<=query && key<S)?sc[n][j]*scale:-1.e30f;
                sc[n][j]=z; nm[j/2]=fmaxf(nm[j/2],z);
            }
        }
        #pragma unroll
        for(int r=0;r<2;r++) {
            nm[r]=fmaxf(nm[r],__shfl_xor_sync(0xffffffff,nm[r],1,4));
            nm[r]=fmaxf(nm[r],__shfl_xor_sync(0xffffffff,nm[r],2,4));
        }
        float factor[2]={fast_exp2(mx[0]-nm[0]),fast_exp2(mx[1]-nm[1])};
        float ps[2]={0,0};
        #pragma unroll
        for(int n=0;n<BC/8;n++) {
            #pragma unroll
            for(int j=0;j<4;j++) {
                float p=fast_exp2(sc[n][j]-nm[j/2]);
                sc[n][j]=p; ps[j/2]+=p;
            }
        }
        #pragma unroll
        for(int r=0;r<2;r++) {
            ps[r]+=__shfl_xor_sync(0xffffffff,ps[r],1,4);
            ps[r]+=__shfl_xor_sync(0xffffffff,ps[r],2,4);
            sum[r]=sum[r]*factor[r]+ps[r];mx[r]=nm[r];
        }
        #pragma unroll
        for(int n=0;n<ND;n++)
            #pragma unroll
            for(int j=0;j<4;j++) acc[n][j]*=factor[j/2];
        #pragma unroll
        for(int t=0;t<BC/16;t++) {
            unsigned p0=pack(__float2half_rn(sc[t*2][0]),__float2half_rn(sc[t*2][1]));
            unsigned p1=pack(__float2half_rn(sc[t*2][2]),__float2half_rn(sc[t*2][3]));
            unsigned p2=pack(__float2half_rn(sc[t*2+1][0]),__float2half_rn(sc[t*2+1][1]));
            unsigned p3=pack(__float2half_rn(sc[t*2+1][2]),__float2half_rn(sc[t*2+1][3]));
            unsigned pl0,pl1,pl2,pl3;
            if constexpr(PRECISE) {
                pl0=pack(__float2half_rn(sc[t*2][0]-__half2float(__ushort_as_half(p0))),__float2half_rn(sc[t*2][1]-__half2float(__ushort_as_half(p0>>16))));
                pl1=pack(__float2half_rn(sc[t*2][2]-__half2float(__ushort_as_half(p1))),__float2half_rn(sc[t*2][3]-__half2float(__ushort_as_half(p1>>16))));
                pl2=pack(__float2half_rn(sc[t*2+1][0]-__half2float(__ushort_as_half(p2))),__float2half_rn(sc[t*2+1][1]-__half2float(__ushort_as_half(p2>>16))));
                pl3=pack(__float2half_rn(sc[t*2+1][2]-__half2float(__ushort_as_half(p3))),__float2half_rn(sc[t*2+1][3]-__half2float(__ushort_as_half(p3>>16))));
            }
            #pragma unroll
            for(int n=0;n<ND;n++) {
                int sw=(DH>=32 && !PRECISE)?(n&7)*2:0;
                int vk0=(t*16+cc)^sw,vk1=(t*16+cc+8)^sw;
                unsigned b0=pack(vs[n*8+rr][vk0],vs[n*8+rr][vk0+1]);
                unsigned b1=pack(vs[n*8+rr][vk1],vs[n*8+rr][vk1+1]);
                mma16816(acc[n],p0,p1,p2,p3,b0,b1);
                if constexpr(PRECISE) {
                    unsigned l0=pack(vl[n*8+rr][t*16+cc],vl[n*8+rr][t*16+cc+1]);
                    unsigned l1=pack(vl[n*8+rr][t*16+cc+8],vl[n*8+rr][t*16+cc+9]);
                    mma16816(acc[n],p0,p1,p2,p3,l0,l1);
                    mma16816(acc[n],pl0,pl1,pl2,pl3,b0,b1);
                }
            }
        }
        __syncthreads();
    }
    #pragma unroll
    for(int n=0;n<ND;n++) {
        #pragma unroll
        for(int j=0;j<4;j++) {
            int query=qr+(j/2)*8,d=n*8+cc+j%2;
            if(query<S && d<DH) {
                size_t idx=((size_t)batch*S+query)*D+head*DH+d;
                float value=acc[n][j]/sum[j/2];
                half hi=__float2half_rn(value);
                out[idx]=hi;
                if constexpr(PRECISE) out[idx+(size_t)B*S*D]=__float2half_rn(value-__half2float(hi));
            }
        }
    }
}

struct Layer {
    float *g1,*b1,*g2,*b2,*bqkv,*bo,*bf1,*bf2;
    half *wqkv,*wo,*wf1,*wf2;
};
TransformerSpec spec;
std::vector<Layer> layers;
const float* input;
float *output,*state,*fg,*fb;
half *u,*qkv,*att,*ff;
int M,SP,attention_rows;
bool precise;
cudaStream_t stream;
cudaGraph_t graph;
cudaGraphExec_t graph_exec;

void launch_norm(const float* a,void* b,const float* g,const float* beta,bool last=false) {
    if(precise && !last) {
        norm<64,false,true><<<(M+7)/8,256,0,stream>>>(a,b,g,beta,M);return;
    }
    #define LN_CASE(d) case d: if(last) norm<d,true><<<(M+7)/8,256,0,stream>>>(a,b,g,beta,M); else norm<d><<<(M+7)/8,256,0,stream>>>(a,b,g,beta,M); break
    switch(spec.D) { LN_CASE(64); LN_CASE(128); LN_CASE(256); LN_CASE(1024); LN_CASE(4); }
    #undef LN_CASE
}
template<int MODE>
void launch_mm(const half* a,const half* w,void* dest,const float* bias,const float* res,int N,int K) {
    if constexpr(MODE==0) {
        #define MM_CASE(d,h,s,p) if constexpr(d==256 && h==1) { gemm_wide<MODE,d,h,s><<<dim3((M+127)/128,N/128),256,0,stream>>>(a,w,dest,bias,res,M,N,K,spec.S,spec.H,spec.D,SP,spec.B); } else { gemm<MODE,p,d,h,s><<<dim3((M+63)/64,(N+63)/64),128,0,stream>>>(a,w,dest,bias,res,M,N,K,spec.S,spec.H,spec.D,SP,spec.B); }
        if(precise) { qkv_projection<64,4,256,true><<<(M+31)/32,128,0,stream>>>(a,w,(half*)dest,bias,M,SP,spec.B);return; }
        if(spec.D==64 && spec.H==4 && spec.S==256) { qkv_projection<64,4,256,false><<<(M+31)/32,128,0,stream>>>(a,w,(half*)dest,bias,M,SP,spec.B);return; }
        if(spec.D==128 && spec.H==4 && spec.S==128) { qkv_projection<128,4,128><<<(M+15)/16,128,0,stream>>>(a,w,(half*)dest,bias,M,SP,spec.B);return; }
        if(spec.D==128 && spec.H==4 && spec.S==16384) { qkv_projection<128,4,16384><<<(M+15)/16,128,0,stream>>>(a,w,(half*)dest,bias,M,SP,spec.B);return; }
        if(spec.D==128 && spec.H==32) { qkv_projection<128,32,1024><<<(M+15)/16,128,0,stream>>>(a,w,(half*)dest,bias,M,SP,spec.B);return; }
        if(spec.D==1024 && spec.H==8) { MM_CASE(1024,8,256,false);return; }
        if(spec.D==1024 && spec.H==16) { MM_CASE(1024,16,100000,false);return; }
        if(spec.D==256 && spec.H==1) { MM_CASE(256,1,512,false);return; }
        if(spec.D==256 && spec.H==8) { MM_CASE(256,8,512,false);return; }
        #undef MM_CASE
    }
    if(precise) {
        gemm<MODE,true><<<dim3((M+63)/64,(N+63)/64),128,0,stream>>>(a,w,dest,bias,res,M,N,K,spec.S,spec.H,spec.D,SP,spec.B);return;
    }
    if(N==256 && K==256) {
        gemm_wide<MODE><<<dim3((M+127)/128,N/128),256,0,stream>>>(a,w,dest,bias,res,M,N,K,spec.S,spec.H,spec.D,SP,spec.B);return;
    }
    gemm<MODE><<<dim3((M+63)/64,(N+63)/64),128,0,stream>>>(a,w,dest,bias,res,M,N,K,spec.S,spec.H,spec.D,SP,spec.B);
}
void launch_att(int base,int count) {
    dim3 grid(count,spec.B*spec.H);
    if(precise) {
        attention<16,64,true,64><<<grid,128,0,stream>>>(qkv,att,spec.S,SP,spec.H,spec.D,spec.B,base);return;
    }
    if(spec.S>=100000) {
        attention<64,64,false,64><<<grid,128,0,stream>>>(qkv,att,spec.S,SP,spec.H,spec.D,spec.B,base);return;
    }
    #define AT_CASE(d) case d: attention<d><<<grid,256,0,stream>>>(qkv,att,spec.S,SP,spec.H,spec.D,spec.B,base); break
    switch(spec.D/spec.H) { AT_CASE(2); AT_CASE(4); AT_CASE(16); AT_CASE(32); AT_CASE(64); AT_CASE(128); case 256: attention<256,32><<<grid,256,0,stream>>>(qkv,att,spec.S,SP,spec.H,spec.D,spec.B,base); break; }
    #undef AT_CASE
}

template<bool FINAL=false>
void launch_resnorm(const half* a,const half* w,const float* bias,const float* res,
                    const float* gamma,const float* beta,int K) {
    void* dest=FINAL?(void*)output:(void*)u;
    if(precise) {
        residual_norm<64,true,FINAL><<<(M+63)/64,128,0,stream>>>(a,w,state,bias,res,dest,gamma,beta,M,K);return;
    }
    #define RES_CASE(d) case d: residual_norm<d,false,FINAL><<<(M+4096/d-1)/(4096/d),128,0,stream>>>(a,w,state,bias,res,dest,gamma,beta,M,K);break
    switch(spec.D) { RES_CASE(64);RES_CASE(128);RES_CASE(256); }
    #undef RES_CASE
}

template<bool FINAL=false>
void launch_ffn(const Layer& l,const float* gamma,const float* beta) {
    void* dest=FINAL?(void*)output:(void*)u;
    if(precise) {
        feed_forward<64,true,FINAL><<<(M+63)/64,128,0,stream>>>(u,l.wf1,l.wf2,state,l.bf1,l.bf2,state,dest,gamma,beta,M);return;
    }
    feed_forward<64,false,FINAL><<<(M+63)/64,128,0,stream>>>(u,l.wf1,l.wf2,state,l.bf1,l.bf2,state,dest,gamma,beta,M);
}
void run_fused() {
    bool deep=(spec.D==64 && spec.L>=16);
    precise=deep;
    launch_norm(input,u,layers[0].g1,layers[0].b1);
    const float* cur=input;
    for(int i=0;i<spec.L;i++) {
        // Early-layer errors propagate through more layers, so compensate these products.
        precise=deep && i<12;
        attention_rows=precise?64:128;
        const auto& l=layers[i];
        launch_mm<0>(u,l.wqkv,qkv,l.bqkv,nullptr,3*spec.D,spec.D);
        launch_att(0,(spec.S+attention_rows-1)/attention_rows);
        ck(cudaGetLastError());
        launch_resnorm(att,l.wo,l.bo,cur,l.g2,l.b2,spec.D);
        if(spec.F==spec.D && spec.D==64) {
            if(i+1<spec.L) launch_ffn(l,layers[i+1].g1,layers[i+1].b1);
            else launch_ffn<true>(l,fg,fb);
        } else {
        launch_mm<2>(u,l.wf1,ff,l.bf1,nullptr,spec.F,spec.D);
        if(i+1<spec.L) launch_resnorm(ff,l.wf2,l.bf2,state,layers[i+1].g1,layers[i+1].b1,spec.F);
        else launch_resnorm<true>(ff,l.wf2,l.bf2,state,fg,fb,spec.F);
        }
        cur=state;
    }
}
void run(bool split) {
    if(spec.D>=64 && spec.D<=256) {run_fused();return;}
    const float* cur=input;
    for(const auto& l:layers) {
        launch_norm(cur,u,l.g1,l.b1);
        launch_mm<0>(u,l.wqkv,qkv,l.bqkv,nullptr,3*spec.D,spec.D);
        if(split) ck(cudaStreamSynchronize(stream));
        int blocks=(spec.S+attention_rows-1)/attention_rows;
        if(split) {
            // Explicit submission boundaries also bound WDDM work packets.
            constexpr int blocks_per_submission=256;
            for(int base=0;base<blocks;base+=blocks_per_submission) {
                launch_att(base,std::min(blocks_per_submission,blocks-base));
                ck(cudaGetLastError());
                ck(cudaStreamSynchronize(stream));
            }
        } else launch_att(0,blocks);
        launch_mm<1>(att,l.wo,state,l.bo,cur,spec.D,spec.D);
        launch_norm(state,u,l.g2,l.b2);
        launch_mm<2>(u,l.wf1,ff,l.bf1,nullptr,spec.F,spec.D);
        launch_mm<1>(ff,l.wf2,state,l.bf2,state,spec.D,spec.F);
        if(split) ck(cudaStreamSynchronize(stream));
        cur=state;
    }
    launch_norm(cur,output,fg,fb,true);
}
}

void init(const TransformerSpec& s,const float* x,float* y) {
    spec=s; spec.weights=nullptr; input=x; output=y; M=s.B*s.S;SP=(s.S+15)/16*16;
    precise=(s.D==64 && s.L>=16);
    attention_rows=(precise || s.S>=100000)?64:128;
    int mult=precise?2:1;
    int batch_chunk=s.B;
    if(s.D==128 && s.S==128) batch_chunk=std::min(s.B,128);
    if(s.D==64 && s.S==256) batch_chunk=std::min(s.B,128);
    M=batch_chunk*s.S;
    ck(cudaStreamCreate(&stream));
    state=alloc<float>((size_t)M*s.D);
    u=alloc<half>((size_t)mult*M*s.D);
    att=alloc<half>((size_t)mult*M*s.D);
    ff=alloc<half>((size_t)mult*M*s.F);
    qkv=alloc<half>((size_t)mult*3*batch_chunk*SP*s.D);
    const float* p=s.weights;
    auto floats=[&](size_t n) { std::vector<float> v(p,p+n);p+=n;return upload(v); };
    auto halves=[&](size_t n) { std::vector<half> v(mult*n);for(size_t i=0;i<n;i++){v[i]=__float2half_rn(p[i]);if(precise)v[n+i]=__float2half_rn(p[i]-__half2float(v[i]));}p+=n;return upload(v); };
    for(int i=0;i<s.L;i++) {
        Layer l{};
        l.g1=floats(s.D);l.b1=floats(s.D);
        size_t nw=(size_t)3*s.D*s.D;
        std::vector<half> w(mult*nw);
        for(int k=0;k<s.D;k++) for(int part=0;part<3;part++) for(int n=0;n<s.D;n++)
            {
            size_t ix=(size_t)k*(3*s.D)+part*s.D+n;
            float val=p[(size_t)part*s.D*s.D+(size_t)k*s.D+n];
            w[ix]=__float2half_rn(val);
            if(precise) w[nw+ix]=__float2half_rn(val-__half2float(w[ix]));
        }
        l.wqkv=upload(w);p+=(size_t)3*s.D*s.D;
        l.bqkv=floats(3*s.D);l.wo=halves((size_t)s.D*s.D);l.bo=floats(s.D);
        l.g2=floats(s.D);l.b2=floats(s.D);
        l.wf1=halves((size_t)s.D*s.F);l.bf1=floats(s.F);
        l.wf2=halves((size_t)s.F*s.D);l.bf2=floats(s.D);
        layers.push_back(l);
    }
    fg=floats(s.D);fb=floats(s.D);
    if(s.S<100000) {
        ck(cudaStreamBeginCapture(stream,cudaStreamCaptureModeThreadLocal));
        for(int b=0;b<s.B;b+=batch_chunk) {
            spec.B=std::min(batch_chunk,s.B-b);M=spec.B*s.S;
            input=x+(size_t)b*s.S*s.D;output=y+(size_t)b*s.S*s.D;
            run(false);
        }
        input=x;output=y;spec.B=s.B;M=s.B*s.S;
        ck(cudaStreamEndCapture(stream,&graph));
        ck(cudaGraphInstantiate(&graph_exec,graph,0));
    }
}

void forward() {
    if(spec.S>=100000) run(true);
    else ck(cudaGraphLaunch(graph_exec,stream));
}
