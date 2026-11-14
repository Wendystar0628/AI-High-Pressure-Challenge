#include "engine.hpp"
#include <algorithm>
#include <vector>
#include <cmath>
using namespace std;

// ===================== Tunables =====================
static const int  MAXH     = 24;
static int        HUB_MODE = 2;      // 0:frontmost 1:farthest from home 2:central(min dist origin)
static bool       STRIKE   = true;    // decisive strikes from the hub
static int        KEEP     = 4;       // troops left on a feeder node
static int        STRIKE_MIN_ARMY = 40;
static int        STRIKE_EXTRA = 40;
static int        EXP_MAX_A = 14;
static double     MIN_SCORE = 0.2;
static double     TIME_W = 2.0;
static int        SAFETY = 0;         // capture neutral only if dHome < dEnemyHome + SAFETY
// ===================================================

static const State* S;
static int N, T, R, H;
static vector<int> G, ARR, DISP;
static vector<char> PART, MYNODE;
static int gEnemyHome;
struct NS { int owner; int troops; };
static vector<NS> TL;
static NS buf[MAXH+1];
static int gHub = -1;                 // persistent hub across turns

static inline int  DST(int i,int j){ return S->dist[i][j]; }
static inline int& arrAt(int i,int r,int o){ return ARR[(i*(H+1)+r)*3+o]; }
static inline char& partAt(int i,int r,int o){ return PART[(i*(H+1)+r)*3+o]; }

static void inputs(int i,int r,const NS& cur,int sums[3],char part[3]){
    int base = cur.troops + (cur.owner!=0 ? G[i] : 0);
    sums[0]=sums[1]=sums[2]=0; part[0]=part[1]=part[2]=0;
    sums[cur.owner]+=base; part[cur.owner]=1;
    for(int o=0;o<3;o++) if(partAt(i,r,o)){ sums[o]+=arrAt(i,r,o); part[o]=1; }
}
static NS resolve(int i,int r,const NS& cur){
    int sums[3]; char part[3]; inputs(i,r,cur,sums,part);
    int ord[3],m=0; for(int o=0;o<3;o++) if(part[o]) ord[m++]=o;
    for(int a=0;a<m;a++)for(int b=a+1;b<m;b++)
        if(sums[ord[b]]>sums[ord[a]]||(sums[ord[b]]==sums[ord[a]]&&ord[b]<ord[a])) swap(ord[a],ord[b]);
    int top=sums[ord[0]],second=m>1?sums[ord[1]]:0; bool tie=m>1&&top==second;
    NS nx; if(tie){nx.owner=cur.owner;nx.troops=0;}else{nx.owner=ord[0];nx.troops=top-second;} return nx;
}
static void timeline(int i,int owner0,int troops0,NS* after){
    after[0]={owner0,troops0}; for(int r=0;r<H;r++) after[r+1]=resolve(i,r,after[r]);
}
static bool survive(int i,int g0){ timeline(i,1,g0,buf); for(int r=1;r<=H;r++) if(buf[r].owner!=1) return false; return true; }
static bool gather(int i,int a,int F,vector<Order>& orders){
    if(F<=0) return true;
    struct Cand{int src,d,dp;}; vector<Cand> cs;
    for(int src=0;src<N;src++){
        if(!MYNODE[src]||src==i||DISP[src]<=0) continue;
        int d=DST(src,i); if(d-1>a) continue; cs.push_back({src,d,DISP[src]});
    }
    sort(cs.begin(),cs.end(),[](const Cand&x,const Cand&y){if(x.d!=y.d)return x.d<y.d;return x.dp>y.dp;});
    int need=F,gathered=0;
    for(auto&c:cs){ if(need<=0)break; int take=min(DISP[c.src],need); if(take<=0)continue;
        orders.push_back({c.src,i,take}); DISP[c.src]-=take;
        int asrc=c.d-1; arrAt(i,asrc,1)+=take; partAt(i,asrc,1)=1; need-=take; gathered+=take; }
    return gathered>0;
}

std::vector<Order> decide(const State& s){
    S=&s; N=(int)s.nodes.size(); if(N==0) return {};
    T=s.turn; R=s.max_turns-T+1; H=MAXH;
    G.assign(N,0); for(int i=0;i<N;i++) G[i]=s.nodes[i].growth;
    int hx=-s.nodes[0].x,hy=-s.nodes[0].y; gEnemyHome=1;
    for(int i=0;i<N;i++) if(s.nodes[i].x==hx&&s.nodes[i].y==hy){gEnemyHome=i;break;}
    MYNODE.assign(N,0); for(int i=0;i<N;i++) if(s.nodes[i].owner==1) MYNODE[i]=1;
    int SZ=N*(H+1)*3; ARR.assign(SZ,0); PART.assign(SZ,0);
    for(const auto&f:s.fleets){ int a=f.turns_left-1;
        if(a<0||a>H||f.to<0||f.to>=N||f.owner<1||f.owner>2) continue;
        arrAt(f.to,a,f.owner)+=f.troops; partAt(f.to,a,f.owner)=1; }

    // hub: re-pick each turn, most central among owned nodes EXCLUDING home (node 0)
    int hub=-1; long long bestc=LLONG_MAX;
    for(int i=1;i<N;i++) if(MYNODE[i]){
        long long c;
        if(HUB_MODE==0) c=DST(i,gEnemyHome);
        else if(HUB_MODE==1) c=-DST(0,i);
        else c=(long long)s.nodes[i].x*s.nodes[i].x+(long long)s.nodes[i].y*s.nodes[i].y;
        if(c<bestc){bestc=c;hub=i;}
    }
    if(hub<0) hub=0; // fallback: only home

    DISP.assign(N,0);
    for(int i=0;i<N;i++) if(MYNODE[i]) DISP[i]=max(0,(int)s.nodes[i].troops-KEEP);

    vector<Order> orders;
    // ---- defense ----
    vector<int> threatened;
    for(int i=0;i<N;i++) if(MYNODE[i]&&!survive(i,s.nodes[i].troops)) threatened.push_back(i);
    sort(threatened.begin(),threatened.end(),[&](int a,int b){return G[a]>G[b];});
    for(int i:threatened){
        for(int it=0;it<12;it++){
            timeline(i,1,s.nodes[i].troops,buf);
            int rr=-1; for(int r=1;r<=H;r++) if(buf[r].owner!=1){rr=r;break;}
            if(rr<0)break;
            int a=rr-1,sums[3];char part[3]; inputs(i,a,buf[a],sums,part);
            int mySide=sums[1],maxOther=0;
            for(int o=0;o<3;o++) if(o!=1&&part[o]) maxOther=max(maxOther,sums[o]);
            int F=maxOther-mySide+1; if(F<1)F=1;
            if(!gather(i,a,F,orders))break;
        }
    }
    TL.assign((size_t)N*(H+1), NS{0,0});
    for(int i=0;i<N;i++) timeline(i,s.nodes[i].owner,s.nodes[i].troops,&TL[(size_t)i*(H+1)]);

    bool hubBig = STRIKE && hub>=0 && DISP[hub]>=STRIKE_MIN_ARMY;
    vector<char> planned(N,0);
    for(int it=0;it<N;it++){
        double bestScore=MIN_SCORE; int bj=-1,bsrc=-1,bS=0;
        for(int j=0;j<N;j++){
            if(s.nodes[j].owner==1||planned[j]) continue;
            int ownj=s.nodes[j].owner;
            int dM=DST(0,j),dE=DST(gEnemyHome,j);
            bool safe = dM < dE + SAFETY;
            bool strikeTgt = (ownj==2) || (ownj==0 && !safe); // contested / enemy
            if(strikeTgt && !hubBig) continue;                 // needs a big hub army
            for(int src=0;src<N;src++){
                if(!MYNODE[src]||DISP[src]<1) continue;
                if(strikeTgt && src!=hub) continue;            // strikes only from the hub
                int d=DST(src,j),a=d-1; if(a<1||a>EXP_MAX_A||a>=H) continue;
                NS cur=TL[(size_t)j*(H+1)+a]; if(cur.owner==1) continue;
                int sums[3];char part[3]; inputs(j,a,cur,sums,part);
                int mySide=sums[1],maxOther=0;
                for(int o=0;o<3;o++) if(o!=1&&part[o]) maxOther=max(maxOther,sums[o]);
                int Sreq=maxOther-mySide+1; if(Sreq<1)Sreq=1;
                int S=Sreq + (strikeTgt?STRIKE_EXTRA:0);
                // decisive: send a big chunk of the hub army on a strike
                if(strikeTgt) S=min(DISP[src], max(S, Sreq*2+20));
                if(S>DISP[src]) continue;
                double prod=max(0.0,(double)(R-1-a)); if(prod<=0) continue;
                double gain=((double)G[j]+0.5)*prod*(ownj==2?2.2:1.0);
                double cost=(double)S+TIME_W*(double)a+1.0;
                double sc=gain/cost*(strikeTgt?1.8:1.0);
                if(sc>bestScore){bestScore=sc;bj=j;bsrc=src;bS=S;}
            }
        }
        if(bj<0)break;
        orders.push_back({bsrc,bj,bS}); DISP[bsrc]-=bS; planned[bj]=1;
    }

    // ---- funnel ALL remaining DISP to the hub ----
    if(hub>=0){
        for(int i=0;i<N;i++){
            if(!MYNODE[i]||i==hub||DISP[i]<=0) continue;
            int d=DST(i,hub); if(d<2) continue;
            orders.push_back({i,hub,DISP[i]}); DISP[i]=0;
        }
    }
    return orders;
}
