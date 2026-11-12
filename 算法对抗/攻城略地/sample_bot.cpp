#include "engine.hpp"

// Deliberately simple: ignore fleets and threats. Send half of the largest
// garrison to the nearest non-owned node. Ties use the lowest node number.
std::vector<Order> decide(const State& s) {
    int from=-1,to=-1;
    for(int i=0;i<(int)s.nodes.size();++i)
        if(s.nodes[i].owner==1 && (from<0 || s.nodes[i].troops>s.nodes[from].troops)) from=i;
    if(from<0 || s.nodes[from].troops<2) return {};
    for(int i=0;i<(int)s.nodes.size();++i)
        if(s.nodes[i].owner!=1 && (to<0 || s.dist[from][i]<s.dist[from][to])) to=i;
    if(to<0) return {};
    return {{from,to,s.nodes[from].troops/2}};
}
