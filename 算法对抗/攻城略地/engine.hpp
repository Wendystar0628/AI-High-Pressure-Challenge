#ifndef SIEGE_ENGINE_HPP
#define SIEGE_ENGINE_HPP
#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

struct Node { int x, y, owner, troops, growth; };
struct Fleet { int owner, troops, from, to, turns_left; };
struct State {
    int turn, max_turns;
    std::vector<Node> nodes;
    std::vector<Fleet> fleets;
    std::vector<std::vector<int>> dist;
};
struct Order { int from, to, troops; };
std::vector<Order> decide(const State& s);

inline int distance(int x1, int y1, int x2, int y2) {
    const long long dx = (long long)x1-x2, dy = (long long)y1-y2;
    const long long square = dx*dx+dy*dy;
    long long d = (long long)std::sqrt((long double)square);
    while (d*d < square) ++d;
    while (d && (d-1)*(d-1) >= square) --d;
    return (int)d;
}

// Optional detailed trace used by the referee. Public step() uses this same code.
namespace siege_detail {
enum Discard { accepted=0, command_limit=1, invalid_node=2, not_owned=3,
               same_node=4, nonpositive=5, insufficient=6 };
struct OrderEvent { int owner, index; Order order; int reason, fleet_index; };
struct ArrivalEvent {
    int node, old_owner, old_troops;
    std::array<int,3> sums{};
    std::array<bool,3> participates{};
    std::vector<int> fleet_indices;
    int owner, troops;
    bool tie;
};
struct Trace { std::vector<OrderEvent> orders; std::vector<ArrivalEvent> arrivals;
               std::vector<Fleet> departed; };
inline State settle(const State& s, const std::vector<Order>& a,
                    const std::vector<Order>& b, Trace* trace=nullptr) {
    State out = s;
    const int n = (int)out.nodes.size();
    auto dispatch = [&](const std::vector<Order>& orders, int owner) {
        for (std::size_t i=0; i<orders.size(); ++i) {
            const auto o = orders[i];
            int reason=accepted, fi=-1;
            if (i>=1000) reason=command_limit;
            else if (o.from<0 || o.from>=n || o.to<0 || o.to>=n) reason=invalid_node;
            else if (out.nodes[o.from].owner!=owner) reason=not_owned;
            else if (o.from==o.to) reason=same_node;
            else if (o.troops<=0) reason=nonpositive;
            else if (o.troops>out.nodes[o.from].troops) reason=insufficient;
            else {
                out.nodes[o.from].troops-=o.troops;
                fi=(int)out.fleets.size();
                const auto &src=out.nodes[o.from], &dst=out.nodes[o.to];
                // Coordinates define the rule, even if a caller changed dist.
                Fleet f{owner,o.troops,o.from,o.to,distance(src.x,src.y,dst.x,dst.y)};
                out.fleets.push_back(f);
                if (trace) trace->departed.push_back(f);
            }
            if (trace) trace->orders.push_back({owner,(int)i,o,reason,fi});
        }
    };
    dispatch(a,1); dispatch(b,2);
    for (auto& p:out.nodes) if (p.owner) p.troops+=p.growth;
    std::vector<std::vector<int>> arriving(n);
    std::vector<Fleet> moving;
    for (int i=0;i<(int)out.fleets.size();++i) {
        auto& f=out.fleets[i];
        --f.turns_left;
        if (f.turns_left==0) arriving[f.to].push_back(i);
        else moving.push_back(f);
    }
    for (int i=0;i<n;++i) if (!arriving[i].empty()) {
        auto& p=out.nodes[i];
        ArrivalEvent e{};
        e.node=i; e.old_owner=p.owner; e.old_troops=p.troops;
        e.sums[p.owner]=p.troops; e.participates[p.owner]=true;
        e.fleet_indices=arriving[i];
        for (int j:arriving[i]) {
            const auto& f=out.fleets[j];
            e.sums[f.owner]+=f.troops; e.participates[f.owner]=true;
        }
        std::vector<int> owners;
        for (int k=0;k<3;++k) if (e.participates[k]) owners.push_back(k);
        std::sort(owners.begin(),owners.end(),[&](int x,int y) {
            return e.sums[x]!=e.sums[y] ? e.sums[x]>e.sums[y] : x<y;
        });
        const int top=e.sums[owners[0]];
        const int second=owners.size()>1 ? e.sums[owners[1]] : 0;
        e.tie=owners.size()>1 && top==second;
        if (!e.tie) p.owner=owners[0];
        p.troops=e.tie ? 0 : top-second;
        e.owner=p.owner; e.troops=p.troops;
        if (trace) trace->arrivals.push_back(e);
    }
    out.fleets=std::move(moving);
    ++out.turn;
    return out;
}
}

inline State step(const State& s,const std::vector<Order>& mine,const std::vector<Order>& theirs) {
    return siege_detail::settle(s,mine,theirs);
}
inline State flip(const State& s) {
    State out=s;
    for (auto& p:out.nodes) if(p.owner) p.owner=3-p.owner;
    for (auto& f:out.fleets) f.owner=3-f.owner;
    return out;
}
inline int result(const State& s) {
    bool alive[3]{};
    long long total[3]{};
    for (const auto& p:s.nodes) { alive[p.owner]=true; total[p.owner]+=p.troops; }
    for (const auto& f:s.fleets) { alive[f.owner]=true; total[f.owner]+=f.troops; }
    if (!alive[1] && !alive[2]) return 3;
    if (!alive[1]) return 2;
    if (!alive[2]) return 1;
    if (s.turn<=s.max_turns) return 0;
    return total[1]==total[2] ? 3 : (total[1]>total[2] ? 1 : 2);
}
#endif
