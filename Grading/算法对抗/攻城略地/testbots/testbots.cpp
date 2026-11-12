#include "engine.hpp"
#include <cstdint>
#include <limits>
#ifndef TESTBOT
#define TESTBOT 1
#endif
namespace {
std::uint64_t next(std::uint64_t& x) {
    x+=0x9e3779b97f4a7c15ull; auto z=x;
    z=(z^(z>>30))*0xbf58476d1ce4e5b9ull;
    z=(z^(z>>27))*0x94d049bb133111ebull;
    return z^(z>>31);
}
}
std::vector<Order> decide(const State& s) {
    std::vector<Order> orders;
    if constexpr(TESTBOT==1) return orders;
    int home=s.nodes[0].owner==1?0:1;
    if constexpr(TESTBOT==4) {
        if(s.turn==1) return {{home,home^1,s.nodes[home].troops}};
        return {};
    }
    if constexpr(TESTBOT==11) {
        int totals[3]{};
        for(const auto& p:s.nodes) totals[p.owner]+=p.troops;
        for(const auto& f:s.fleets) totals[f.owner]+=f.troops;
        if(totals[1]>totals[2]) return {};
    }
    std::uint64_t random=0x12345678ull+s.turn;
    for(const auto& p:s.nodes) random=random*131+(p.x+11)*23+p.y+11+p.troops*7+p.owner;
    for(int i=0;i<(int)s.nodes.size();++i) if(s.nodes[i].owner==1) {
        int available=s.nodes[i].troops-(TESTBOT==3?5:8);
        if constexpr(TESTBOT==3) {
            if(s.nodes[i].troops<10) continue;
            available=s.nodes[i].troops;
        }
        if(available<=0) continue;
        if constexpr(TESTBOT==2) {
            int j=next(random)%s.nodes.size();
            if(j!=i) orders.push_back({i,j,1+(int)(next(random)%available)});
            continue;
        }
        if constexpr(TESTBOT==10) {
            for(int j=0;j<(int)s.nodes.size();++j) if(s.nodes[j].owner!=1 && available>=2) {
                orders.push_back({i,j,2});available-=2;
            }
            continue;
        }
        int target=-1; double best=-1;
        for(int j=0;j<(int)s.nodes.size();++j) if(s.nodes[j].owner!=1) {
            const auto& p=s.nodes[j];
            if constexpr(TESTBOT==3) if(p.owner!=2) continue;
            if constexpr(TESTBOT==5) {
                if(p.owner!=0 || s.dist[home][j]>=s.dist[home^1][j]) continue;
                if(s.dist[home][j]>8) continue;
            }
            if constexpr(TESTBOT==6) {
                if(p.owner!=0 || p.troops>=available) continue;
                int inbound=0;
                for(const auto& f:s.fleets) if(f.owner==1 && f.to==j) inbound+=f.troops;
                if(inbound>p.troops) continue;
            }
            bool intercept=false;
            if constexpr(TESTBOT==7) {
                int enemy_eta=999;
                for(const auto& f:s.fleets) if(f.owner==2 && f.to==j) enemy_eta=std::min(enemy_eta,f.turns_left);
                intercept=p.owner==0 && s.dist[i][j]==enemy_eta+1;
            }
            double score=(TESTBOT==3 || TESTBOT==5)?1.0/(s.dist[i][j]+0.1):
                p.growth/(double)(p.troops+s.dist[i][j]+1);
            if(intercept) score+=1000.0/(s.dist[i][j]+1);
            if(score>best) {best=score;target=j;}
        }
        if(target>=0) {
            int count=available;
            if constexpr(TESTBOT==5 || TESTBOT==6 || TESTBOT==11)
                count=std::min(available,s.nodes[target].troops+1);
            if constexpr(TESTBOT==7) {
                int force=0,eta=s.dist[i][target]-1;
                for(const auto& f:s.fleets) if(f.owner==2 && f.to==target && f.turns_left==eta) force+=f.troops;
                if(s.nodes[target].owner==0 && force>s.nodes[target].troops)
                    count=std::min(available,force-s.nodes[target].troops+s.nodes[target].growth+2);
            }
            if constexpr(TESTBOT==9) if(i<2 && s.turn%10==1) count=s.nodes[i].troops;
            orders.push_back({i,target,count});
        }
    }
    return orders;
}
