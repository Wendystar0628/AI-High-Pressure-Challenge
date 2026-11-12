#ifdef P_PAY
#undef P_PAY
#endif
#define P_PAY 16
#ifdef P_RICH
#undef P_RICH
#endif
#define P_RICH 0.4
#ifdef P_BEHIND_FROM
#undef P_BEHIND_FROM
#endif
#define P_BEHIND_FROM 25
// Single requested merge: unchanged astra opening search + heur_v2 rules.
// Based on the installed heur_v1. Default Intent preserves its behavior;
// the independent search can select a small set of admitted task plans.
// Heuristic-core program (stage 0 = the investigation prototype with tuned defaults)
// (exact timelines, surplus, both sides' full-commitment potential, payback-ordered
// expansion, reaction-aware attacks, forward redistribution). Deterministic, no clock,
// no randomness, no cross-game state. Not a deliverable: used to test hypotheses.
#include "engine.hpp"
#include <cstdio>
#ifndef P_ALPHA   // weight of enemy full-attack potential when reserving garrisons
#define P_ALPHA 0.5
#endif
#ifndef P_BETA    // credit for own reinforcements that can react in time
#define P_BETA 0.5
#endif
#ifndef P_BETA_RES  // ... when reserving garrisons
#define P_BETA_RES 0.65
#endif
#ifndef P_BETA_CAP  // ... when judging whether a fresh capture can be held
#define P_BETA_CAP P_BETA
#endif
#ifndef P_SNIPE   // weight of enemy potential against a freshly captured node
#define P_SNIPE 1.0
#endif
#ifndef P_RHO     // weight of enemy reinforcement potential when attacking enemy nodes
#define P_RHO 1.0
#endif
#ifndef P_RAMP    // attack surcharge ramps up with flight length: full weight from this distance on (0 = always full)
#define P_RAMP 0
#endif
#ifndef P_BEHIND  // when the projected final count is lost, take more risk (1 = on)
#define P_BEHIND 1
#endif
#ifndef P_BEHIND_ALPHA
#define P_BEHIND_ALPHA 0.6
#endif
#ifndef P_BEHIND_RHO
#define P_BEHIND_RHO 0.5
#endif
#ifndef P_BEHIND_CAP
#define P_BEHIND_CAP 0
#endif
#ifndef P_BEHIND_FROM   // only from this turn on
#define P_BEHIND_FROM 25
#endif
#ifndef P_GAMBLE  // neutral captures this cheap are taken without the safety check
#define P_GAMBLE 0
#endif
#ifndef P_GAMBLE_UNTIL  // ... only up to this turn (0 = always)
#define P_GAMBLE_UNTIL 0
#endif
#ifndef P_CAPG    // garrison surcharge accepted per point of growth when taking a contested neutral
#define P_CAPG 0
#endif
#ifndef P_PAY     // early on, skip neutrals whose net cost exceeds this many turns of their production (0 = off)
#define P_PAY 16
#endif
#ifndef P_RICH
#define P_RICH 0.4
#endif
#ifndef P_PAY_UNTIL
#define P_PAY_UNTIL 30
#endif
#ifndef P_VH      // valuation horizon for production
#define P_VH 60
#endif
#ifndef P_WIN     // turns after capture that must be safe
#define P_WIN 8
#endif
#ifndef P_CAP     // largest garrison surcharge accepted when taking a neutral
#define P_CAP 0
#endif
#ifndef P_MARGIN
#define P_MARGIN 1
#endif
#ifndef P_LOGI
#define P_LOGI 1
#endif
#ifndef P_ENEMYW  // extra value of taking production away from the enemy
#define P_ENEMYW 2.0
#endif
namespace { namespace heur {
constexpr int HZ=30, NM=24;
struct Line {
    int n; const State& s;
    int base[NM];
    int inc[NM][HZ+1][3]{};
    int own[NM][HZ+1], army[NM][HZ+1];
    Line(const State& st):n((int)st.nodes.size()),s(st) {
        for(int i=0;i<n;++i) base[i]=s.nodes[i].troops;
        for(const auto& f:s.fleets) if(f.turns_left<=HZ) inc[f.to][f.turns_left][f.owner]+=f.troops;
        for(int i=0;i<n;++i) build(i);
    }
    void build(int i) {
        int o=s.nodes[i].owner,t=base[i];
        own[i][0]=o;army[i][0]=t;
        for(int u=1;u<=HZ;++u) {
            if(o) t+=s.nodes[i].growth;
            const int* a=inc[i][u];
            if(a[0]||a[1]||a[2]) {
                int sum[3]={a[0],a[1],a[2]};sum[o]+=t;
                int top=0;for(int k=1;k<3;++k)if(sum[k]>sum[top])top=k;
                int second=0;for(int k=0;k<3;++k)if(k!=top)second=std::max(second,sum[k]);
                if(sum[top]==second)t=0;else{o=top;t=sum[top]-second;}
            }
            own[i][u]=o;army[i][u]=t;
        }
    }
    // mine from time `from` to the end of the window
    bool held(int i,int from) const {for(int u=from;u<=HZ;++u)if(own[i][u]!=1)return false;return true;}
    // minimal extra troops arriving at time d so that node j is mine from time `from` on
    int hold_need(int j,int d,int from) {
        if(held(j,from)) return 0;
        int lo=1,hi=1;
        auto ok=[&](int x){inc[j][d][1]+=x;build(j);bool r=held(j,from);inc[j][d][1]-=x;return r;};
        while(hi<100000 && !ok(hi)) hi*=2;
        if(hi>=100000){build(j);return 1000000;}
        while(lo<hi){int mid=(lo+hi)/2;if(ok(mid))hi=mid;else lo=mid+1;}
        build(j);return lo;
    }
    // what side p could have delivered to node i by time t, launching from now on (first=0)
    // or only after seeing an attack (first=1)
    int potential(int p,int i,int t,int first) const {
        int sum=0;
        for(int e=0;e<n;++e) if(e!=i) {
            int u=t-s.dist[e][i];
            if(u>=first && own[e][u]==p) sum+=army[e][u];
        }
        return sum;
    }
};
// Options affect task priorities only. Defaults preserve the installed rule
// core; the capture, surplus and hold checks below remain the admission gate.
struct Intent {
    int valuation=P_VH;
    int missions=2*NM;
    bool forward=false;
    double reinforcementCredit=P_BETA_CAP;
};
std::vector<Order> play(const State& s, Intent intent={}) {
    Line l(s);const int n=l.n,rem=201-s.turn;
    std::vector<Order> orders;
    long long tot[3]{},grw[3]{};
    for(const auto& q:s.nodes){tot[q.owner]+=q.troops;grw[q.owner]+=q.growth;}
    for(const auto& f:s.fleets)tot[f.owner]+=f.troops;
    const bool behind=P_BEHIND && s.turn>=P_BEHIND_FROM && tot[1]+grw[1]*rem<tot[2]+grw[2]*rem;
    const double alpha=behind?P_ALPHA*P_BEHIND_ALPHA:P_ALPHA, rho=behind?P_RHO*P_BEHIND_RHO:P_RHO;
    const int cap=behind?std::max(P_CAP,P_BEHIND_CAP):P_CAP;
    int avail[NM]{},safe[NM]{};
    auto refresh=[&]() {
        for(int i=0;i<n;++i) {
            avail[i]=safe[i]=0;
            if(s.nodes[i].owner!=1 || !l.held(i,0)) continue;
            int x=l.base[i],y=l.base[i];
            for(int u=1;u<=std::min(HZ,rem);++u) {
                int room=l.army[i][u];
                if(P_ALPHA>0) room=(int)(l.army[i][u]+P_BETA_RES*l.potential(1,i,u,1)-alpha*l.potential(2,i,u,0));
                x=std::min(x,std::min(room,l.army[i][u]));
                y=std::min(y,l.army[i][u]);
            }
            avail[i]=std::max(0,x);safe[i]=std::max(0,y);
        }
    };
    auto send=[&](int i,int j,int c) {
        if(c<=0) return;
        orders.push_back({i,j,c});l.base[i]-=c;l.inc[j][s.dist[i][j]][1]+=c;l.build(i);l.build(j);
    };
    for(int pass=0;pass<std::min(2*n,intent.missions);++pass) {
        refresh();
        int spare=0;for(int i=0;i<n;++i)spare+=avail[i];
        double best=0;std::vector<Order> chosen;
        for(int j=0;j<n;++j) {
            if(l.held(j,0)) continue;                     // already mine for the whole window
            const bool rescue=s.nodes[j].owner==1;
            const int* pool=rescue?safe:avail;
            std::vector<int> src;
            for(int i=0;i<n;++i) if(i!=j && pool[i]>0 && s.dist[i][j]<=std::min(HZ,rem)) src.push_back(i);
            if(src.empty()) continue;
            std::stable_sort(src.begin(),src.end(),[&](int a,int b){return s.dist[a][j]<s.dist[b][j];});
            int saved[HZ+1];for(int u=0;u<=HZ;++u)saved[u]=l.inc[j][u][1];
            int lastmine=0;for(int u=1;u<=HZ;++u)if(saved[u])lastmine=u;
            std::vector<Order> mission;int total=0;bool done=false;int dlast=0,prior=s.nodes[j].owner;
            for(int i:src) {
                int d=s.dist[i][j];
                int from=std::max(d,lastmine);
                int need=l.hold_need(j,d,from);
                if(need>=1000000) continue;
                if(need==0 && mission.empty()) continue;      // nothing to add to plans already under way
                int extra=0;
                if(!rescue) {
                    int before=need>0?l.own[j][d-1]:prior;
                    prior=before;
                    if(before==2) extra=(int)(rho*(P_RAMP>0?std::min(1.0,d/(double)P_RAMP):1.0)*l.potential(2,j,d,1));
                    else {
                        // after the capture the enemy may strike; reinforcements can also come
                        int g=s.nodes[j].growth;
                        for(int u=d+1;u<=std::min(HZ,d+P_WIN);++u)
                            extra=std::max(extra,(int)(P_SNIPE*l.potential(2,j,u,0)-intent.reinforcementCredit*l.potential(1,j,u,1))-g*(u-d));
                    }
                }
                if(!rescue && prior!=2 && need>0 && need+P_MARGIN<=P_GAMBLE && (P_GAMBLE_UNTIL==0 || s.turn<=P_GAMBLE_UNTIL)) extra=0;
                if(!rescue && prior!=2 && extra>std::max(cap,(int)(P_CAPG*s.nodes[j].growth))){mission.clear();break;}   // not defensible cheaply: leave it
                int want=need>0?need+extra+P_MARGIN:std::max(0,extra-l.army[j][d]);
                int give=std::min(pool[i],want);
                if(give>0){mission.push_back({i,j,give});total+=give;l.inc[j][d][1]+=give;l.build(j);}
                if(give>=want){done=true;dlast=d;break;}
            }
            if(done && !mission.empty()) {
                int tc=dlast;                               // first time it is mine for good
                for(int u=dlast;u>=1;--u){if(l.held(j,u))tc=u;else break;}
                int g=s.nodes[j].growth;
                int horizon=std::min(rem,intent.valuation);
                int now=s.nodes[j].owner;
                double value=0;
                if(now==1) value=2.0*g*std::max(0,horizon-tc)+l.army[j][0];          // rescue
                else {
                    int kept=l.army[j][tc];                 // my garrison right after capture
                    int lost=total-kept;                    // troops consumed
                    double w=(l.own[j][std::max(0,tc-1)]==2)?P_ENEMYW:1.0;
                    value=w*g*std::max(0,horizon-tc)-std::max(0,lost);
                    if(P_PAY>0 && now==0 && s.turn<=P_PAY_UNTIL && lost>P_PAY*g && lost>P_RICH*spare) value=0;
                    if(l.own[j][std::max(0,tc-1)]==2) value+=std::max(0,lost);     // trade is 1:1 against the enemy
                }
                double score=value/(total+3.0*dlast+10.0);
                if(now==1) score+=1000;
                if(value>0 && score>best){best=score;chosen=mission;}
            }
            for(int u=0;u<=HZ;++u)l.inc[j][u][1]=saved[u];
            l.build(j);
        }
        if(chosen.empty()) break;
        for(auto& o:chosen) send(o.from,o.to,o.troops);
    }
    if(intent.forward && !orders.empty()) {
        int target[NM],front[NM];
        std::fill(target,target+NM,-1);
        for(int j=0;j<n;++j) {
            front[j]=99;
            for(int e=0;e<n;++e)if(s.nodes[e].owner==2)front[j]=std::min(front[j],s.dist[j][e]);
        }
        for(const auto& order:orders)
            if(target[order.from]<0 || front[order.to]<front[target[order.from]])target[order.from]=order.to;
        for(int i=0;i<n;++i)if(target[i]>=0) {
            refresh();
            if(l.held(target[i],s.dist[i][target[i]]))send(i,target[i],avail[i]);
        }
    }
    if(P_LOGI) {
        refresh();
        int front[NM];
        for(int i=0;i<n;++i){front[i]=99;for(int e=0;e<n;++e)if(l.own[e][std::min(HZ,rem)]==2 || s.nodes[e].owner==2)front[i]=std::min(front[i],s.dist[i][e]);}
        for(int i=0;i<n;++i) if((P_LOGI==2?safe[i]:avail[i])>0 && s.nodes[i].owner==1) {
            int dst=-1;double best=1e30;
            for(int j=0;j<n;++j) if(j!=i && s.nodes[j].owner==1 && l.held(j,0) && front[j]<front[i] && s.dist[i][j]<front[i]) {
                double v=front[j]*2+s.dist[i][j];
                if(v<best){best=v;dst=j;}
            }
            if(dst>=0) send(i,dst,P_LOGI==2?safe[i]:avail[i]);
        }
    }
    return orders;
}
}}


#include "engine.hpp"


#ifndef SEARCH_MODE
#define SEARCH_MODE 2
#endif

namespace {
std::vector<Order> canonical(std::vector<Order> orders) {
    std::sort(orders.begin(),orders.end(),[](const Order&a,const Order&b) {
        return a.from!=b.from?a.from<b.from:a.to<b.to;
    });
    std::vector<Order> merged;
    for(const auto& order:orders) {
        if(!merged.empty() && merged.back().from==order.from && merged.back().to==order.to)
            merged.back().troops+=order.troops;
        else merged.push_back(order);
    }
    return merged;
}

bool equal(const std::vector<Order>&a,const std::vector<Order>&b) {
    if(a.size()!=b.size())return false;
    for(int i=0;i<(int)a.size();++i)
        if(a[i].from!=b[i].from || a[i].to!=b[i].to || a[i].troops!=b[i].troops)return false;
    return true;
}

std::vector<Order> opening(const State& state) {
    std::vector<std::vector<Order>> choices;
    auto add=[&](const heur::Intent& intent) {
        auto orders=canonical(heur::play(state,intent));
        for(const auto& existing:choices)if(equal(existing,orders))return;
        choices.push_back(std::move(orders));
    };
    heur::Intent intent;
    add(intent);
    intent.valuation=24;add(intent);
    intent.valuation=36;add(intent);
    intent={};intent.missions=2;intent.forward=true;add(intent);
    intent={};intent.valuation=24;intent.forward=true;add(intent);
    bool hasWait=false;
    for(const auto& orders:choices)if(orders.empty())hasWait=true;
    if(!hasWait)choices.push_back({});

    double best=-1e100;int selected=0;
    for(int k=0;k<(int)choices.size();++k) {
        double total=0,worst=1e100;
        for(int response=0;response<2;++response) {
            State projected=state;
            heur::Intent enemy;
            if(response==1)enemy.reinforcementCredit=1.0;
            // Public settlement is the sole simulator. The bound is a full
            // 200-turn game, independent of machine speed or elapsed time.
            for(int t=0;t<200;++t) {
                auto mine=t==0?choices[k]:heur::play(projected);
                auto theirs=heur::play(flip(projected),enemy);
                projected=step(projected,mine,theirs);
                if(result(projected))break;
            }
            const int outcome=result(projected);
            double value=outcome==1?1:outcome==2?-1:0;
            if(outcome==1 || outcome==2)value*=1+.02*(201-projected.turn)/200.;
            total+=value;worst=std::min(worst,value);
        }
        double value=.7*total/2+.3*worst;
        if(value>best){best=value;selected=k;}
    }
    return choices[selected];
}
}

std::vector<Order> selected_tier5(const State& state) {
    if(SEARCH_MODE==0 || state.turn!=1)return heur::play(state);
    if(SEARCH_MODE==1){heur::Intent intent;intent.valuation=24;return heur::play(state,intent);}
    return opening(state);
}
