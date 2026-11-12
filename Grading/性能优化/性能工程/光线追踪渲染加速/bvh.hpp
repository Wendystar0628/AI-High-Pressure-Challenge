#pragma once
#include "render_math.cuh"
#include <vector>
#include <algorithm>
#include <atomic>
#include <thread>
#ifndef PAR_DEPTH
#define PAR_DEPTH 0
#endif
#define BINS 16
#define CT 1.0f
#define LEAF 8
struct Node {float lo[3],hi[3];int left,right,start,count;};
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
