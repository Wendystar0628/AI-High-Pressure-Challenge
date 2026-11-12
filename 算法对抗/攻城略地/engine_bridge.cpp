// Referee helper, compiled automatically by arena.py using the specified g++.
// All game settlement happens in engine.hpp, never in the Python referee.
#include "engine.hpp"
#include <iostream>
#include <string>
#include <windows.h>

static void fleet(const Fleet& f) {
    std::cout<<"{\"owner\":"<<f.owner<<",\"troops\":"<<f.troops
             <<",\"from\":"<<f.from<<",\"to\":"<<f.to<<",\"turns_left\":"<<f.turns_left<<'}';
}
static void state_json(const State& s) {
    std::cout<<"{\"turn\":"<<s.turn<<",\"max_turns\":"<<s.max_turns<<",\"nodes\":[";
    for (std::size_t i=0;i<s.nodes.size();++i) {
        if(i) std::cout<<',';
        auto p=s.nodes[i];
        std::cout<<"{\"x\":"<<p.x<<",\"y\":"<<p.y<<",\"owner\":"<<p.owner
                 <<",\"troops\":"<<p.troops<<",\"growth\":"<<p.growth<<'}';
    }
    std::cout<<"],\"fleets\":[";
    for(std::size_t i=0;i<s.fleets.size();++i) { if(i) std::cout<<','; fleet(s.fleets[i]); }
    std::cout<<"]}";
}
int main(int argc,char** argv) {
    if(argc>1 && std::string(argv[1])=="--calibrate") {
        // Three long busy intervals. GetProcessTimes is the independent
        // user+kernel CPU reference; wall clock only controls interval length.
        HANDLE h=GetCurrentProcess();
        auto cpu=[&]() { FILETIME c,e,k,u; GetProcessTimes(h,&c,&e,&k,&u);
            return ((unsigned long long)k.dwHighDateTime<<32)+k.dwLowDateTime+
                   ((unsigned long long)u.dwHighDateTime<<32)+u.dwLowDateTime; };
        for(int sample=0;sample<3;++sample) {
            ULONG64 a,b; LARGE_INTEGER freq,start,now;
            QueryPerformanceFrequency(&freq); QueryPerformanceCounter(&start);
            auto t0=cpu(); QueryProcessCycleTime(h,&a);
            unsigned long long x=123+sample;
            do {
                for(int j=0;j<100000;++j) { x^=x<<13; x^=x>>7; x^=x<<17; }
                QueryPerformanceCounter(&now);
            } while(now.QuadPart-start.QuadPart<freq.QuadPart/2);
            QueryProcessCycleTime(h,&b); auto t1=cpu();
            std::cout<<(b-a)<<' '<<(t1-t0)<<' '<<x<<'\n'<<std::flush;
        }
        return 0;
    }
    std::ios::sync_with_stdio(false); std::cin.tie(nullptr);
    std::string tag;
    while(std::cin>>tag) {
        if(tag=="STOP") return 0;
        if(tag!="STATE") return 2;
        State s{}; int n,f;
        std::cin>>s.turn>>s.max_turns>>n>>f;
        s.nodes.resize(n); s.fleets.resize(f);
        for(auto& p:s.nodes) std::cin>>p.x>>p.y>>p.owner>>p.troops>>p.growth;
        for(auto& v:s.fleets) std::cin>>v.owner>>v.troops>>v.from>>v.to>>v.turns_left;
        std::vector<Order> orders[2];
        for(auto& list:orders) {
            int count; std::cin>>count; list.resize(count);
            for(auto& o:list) std::cin>>o.from>>o.to>>o.troops;
        }
        if(!std::cin) return 2;
        siege_detail::Trace trace;
        State out=siege_detail::settle(s,orders[0],orders[1],&trace);
        std::cout<<"{\"state\":"; state_json(out);
        std::cout<<",\"result\":"<<result(out)<<",\"orders\":[";
        for(std::size_t i=0;i<trace.orders.size();++i) {
            const auto& e=trace.orders[i]; if(i) std::cout<<',';
            std::cout<<"{\"owner\":"<<e.owner<<",\"index\":"<<e.index<<",\"order\":["
                     <<e.order.from<<','<<e.order.to<<','<<e.order.troops<<"],\"reason\":"<<e.reason
                     <<",\"fleet_index\":"<<e.fleet_index<<'}';
        }
        std::cout<<"],\"departures\":[";
        for(std::size_t i=0;i<trace.departed.size();++i) { if(i) std::cout<<','; fleet(trace.departed[i]); }
        std::cout<<"],\"arrivals\":[";
        for(std::size_t i=0;i<trace.arrivals.size();++i) {
            const auto& e=trace.arrivals[i]; if(i) std::cout<<',';
            std::cout<<"{\"node\":"<<e.node<<",\"old_owner\":"<<e.old_owner
                     <<",\"old_troops\":"<<e.old_troops<<",\"sums\":[";
            for(int j=0;j<3;++j) {if(j)std::cout<<',';std::cout<<e.sums[j];}
            std::cout<<"],\"participates\":[";
            for(int j=0;j<3;++j) {if(j)std::cout<<',';std::cout<<(e.participates[j]?"true":"false");}
            std::cout<<"],\"fleet_indices\":[";
            for(std::size_t j=0;j<e.fleet_indices.size();++j) {if(j)std::cout<<',';std::cout<<e.fleet_indices[j];}
            std::cout<<"],\"owner\":"<<e.owner<<",\"troops\":"<<e.troops
                     <<",\"tie\":"<<(e.tie?"true":"false")<<'}';
        }
        std::cout<<"]}\n"<<std::flush;
    }
}
