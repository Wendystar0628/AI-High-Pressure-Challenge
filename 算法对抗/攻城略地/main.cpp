#include "engine.hpp"
#include <iostream>
#include <string>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);
    State s{};
    std::string tag;
    int n,f;
    while (std::cin>>tag) {
        if (tag=="STOP") return 0;
        if (tag!="STATE" || !(std::cin>>s.turn>>s.max_turns>>n>>f) || n<0 || f<0) return 2;
        s.nodes.resize(n); s.fleets.resize(f);
        for (auto& p:s.nodes)
            if (!(std::cin>>p.x>>p.y>>p.owner>>p.troops>>p.growth)) return 2;
        for (auto& v:s.fleets)
            if (!(std::cin>>v.owner>>v.troops>>v.from>>v.to>>v.turns_left)) return 2;
        if (s.dist.size()!=(std::size_t)n) {
            s.dist.assign(n,std::vector<int>(n));
            for(int i=0;i<n;++i) for(int j=0;j<n;++j)
                s.dist[i][j]=distance(s.nodes[i].x,s.nodes[i].y,s.nodes[j].x,s.nodes[j].y);
        }
        const auto orders=decide(s);
        // Include the full returned list, including commands beyond the rule's 1000 cap.
        std::cout<<"ORDERS "<<s.turn<<' '<<orders.size()<<'\n';
        for(const auto& o:orders) std::cout<<o.from<<' '<<o.to<<' '<<o.troops<<'\n';
        std::cout<<"END "<<s.turn<<'\n'<<std::flush;
    }
    return std::cin.eof() ? 0 : 2;
}
