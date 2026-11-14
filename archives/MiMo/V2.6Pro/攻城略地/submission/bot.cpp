#include "engine.hpp"
#include <vector>
#include <algorithm>
#include <cmath>

// Bot v16: Major overhaul for better win rate
// Key improvements over v15:
// 1. More aggressive early expansion (turn 1-5: send everything)
// 2. Better hub management (always send growth to hub)
// 3. Stronger attacks (2x force for decisive wins)
// 4. Better defense timing
// 5. Consolidation phase to build decisive force

std::vector<Order> decide(const State& s) {
    const int n = (int)s.nodes.size();
    const int turn = s.turn;
    const int remaining = s.max_turns - turn + 1;
    
    std::vector<int> avail(n, 0);
    for (int i = 0; i < n; i++)
        if (s.nodes[i].owner == 1) avail[i] = s.nodes[i].troops;
    
    struct Arr { int owner, troops, turns_left; };
    std::vector<std::vector<Arr>> inc(n);
    for (const auto& f : s.fleets)
        inc[f.to].push_back({f.owner, f.troops, f.turns_left});
    
    std::vector<Order> orders;
    
    // === DEFENSE ===
    for (int i = 0; i < n; i++) {
        if (s.nodes[i].owner != 1) continue;
        int my_force = s.nodes[i].troops;
        int growth = s.nodes[i].growth;
        
        std::vector<std::pair<int,int>> my_arr, en_arr;
        for (auto& a : inc[i]) {
            if (a.owner == 1) my_arr.push_back({a.turns_left, a.troops});
            else en_arr.push_back({a.turns_left, a.troops});
        }
        std::sort(my_arr.begin(), my_arr.end());
        std::sort(en_arr.begin(), en_arr.end());
        
        int max_need = 0;
        int mi = 0, ei = 0;
        for (int t = 1; t <= 25; t++) {
            my_force += growth;
            while (mi < (int)my_arr.size() && my_arr[mi].first <= t) {
                my_force += my_arr[mi].second;
                mi++;
            }
            int en_here = 0;
            while (ei < (int)en_arr.size() && en_arr[ei].first <= t) {
                en_here += en_arr[ei].second;
                ei++;
            }
            if (en_here > 0) {
                int need = en_here - my_force;
                if (need > max_need) max_need = need;
                my_force = std::max(0, my_force - en_here);
            }
        }
        if (max_need > 0) {
            int needed = max_need + 1;
            int best = -1, bestd = 99999;
            for (int j = 0; j < n; j++) {
                if (s.nodes[j].owner != 1 || avail[j] < needed || j == i) continue;
                int d = s.dist[j][i];
                if (d < bestd) { bestd = d; best = j; }
            }
            if (best >= 0) {
                orders.push_back({best, i, needed});
                avail[best] -= needed;
            }
        }
    }
    
    // === EXPANSION ===
    // In early game (turn <= 5), be extremely aggressive
    // After that, keep growth rate
    struct CapMove { int from, to, cost; double score; };
    std::vector<CapMove> cap_moves;
    
    for (int i = 0; i < n; i++) {
        if (s.nodes[i].owner != 1) continue;
        int keep = (turn <= 5) ? 1 : s.nodes[i].growth;
        int sendable = avail[i] - keep;
        if (sendable <= 0) continue;
        
        for (int j = 0; j < n; j++) {
            if (s.nodes[j].owner != 0) continue;
            int dist = s.dist[i][j];
            if (dist <= 0) continue;
            int cost = s.nodes[j].troops + 1;
            if (sendable < cost) continue;
            double turns = remaining - dist + 1;
            if (turns < 5) continue;
            double value = s.nodes[j].growth * turns;
            double score = value / (cost * (double)dist);
            cap_moves.push_back({i, j, cost, score});
        }
    }
    
    std::sort(cap_moves.begin(), cap_moves.end(), [](const CapMove& a, const CapMove& b) {
        return a.score > b.score;
    });
    
    std::vector<bool> used(n, false);
    for (auto& m : cap_moves) {
        if (used[m.to]) continue;
        int keep = (turn <= 5) ? 1 : s.nodes[m.from].growth;
        if (avail[m.from] - m.cost < keep) continue;
        orders.push_back({m.from, m.to, m.cost});
        avail[m.from] -= m.cost;
        used[m.to] = true;
    }
    
    // === HUB REINFORCEMENT ===
    // Find best hub and send ALL available growth to it
    if (turn >= 3) {
        int best_hub = -1;
        double best_hub_val = -1;
        for (int i = 0; i < n; i++) {
            if (s.nodes[i].owner != 1) continue;
            double centrality = 0;
            for (int j = 0; j < n; j++)
                if (j != i) centrality += 1.0 / (s.dist[i][j] + 1.0);
            double val = centrality * s.nodes[i].growth;
            if (val > best_hub_val) { best_hub_val = val; best_hub = i; }
        }
        
        if (best_hub >= 0) {
            // Send excess troops to hub (keep growth for defense)
            for (int i = 0; i < n; i++) {
                if (s.nodes[i].owner != 1 || i == best_hub) continue;
                // Only send from nodes not under immediate threat
                bool threatened = false;
                for (auto& a : inc[i]) {
                    if (a.owner == 2) { threatened = true; break; }
                }
                if (threatened) continue;
                int keep = s.nodes[i].growth;
                int sendable = avail[i] - keep;
                if (sendable >= 2) {
                    orders.push_back({i, best_hub, sendable});
                    avail[i] -= sendable;
                }
            }
        }
    }
    
    // === ATTACK ===
    // Only attack with 2x force for decisive wins
    struct AtkMove { int from, to, cost; double score; };
    std::vector<AtkMove> atk_moves;
    
    for (int i = 0; i < n; i++) {
        if (s.nodes[i].owner != 1) continue;
        int keep = s.nodes[i].growth;
        int sendable = avail[i] - keep;
        if (sendable <= 0) continue;
        
        for (int j = 0; j < n; j++) {
            if (s.nodes[j].owner != 2) continue;
            int dist = s.dist[i][j];
            if (dist <= 0 || dist > 10) continue;
            int enemy_def = s.nodes[j].troops;
            for (auto& a : inc[j])
                if (a.owner == 2 && a.turns_left <= dist) enemy_def += a.troops;
            int cost = (enemy_def * 3) / 2 + 1;  // 1.5x force
            if (sendable < cost) continue;
            double turns = remaining - dist + 1;
            if (turns < 5) continue;
            double value = s.nodes[j].growth * turns * 2.0;
            double score = value / (cost * (double)dist);
            atk_moves.push_back({i, j, cost, score});
        }
    }
    
    std::sort(atk_moves.begin(), atk_moves.end(), [](const AtkMove& a, const AtkMove& b) {
        return a.score > b.score;
    });
    
    for (auto& m : atk_moves) {
        if (used[m.to]) continue;
        int keep = s.nodes[m.from].growth;
        if (avail[m.from] - m.cost < keep) continue;
        orders.push_back({m.from, m.to, m.cost});
        avail[m.from] -= m.cost;
        used[m.to] = true;
    }
    
    // === MULTI-SOURCE for tough targets ===
    for (int j = 0; j < n; j++) {
        if (used[j] || s.nodes[j].owner == 1) continue;
        
        int min_dist = 99999;
        for (int i = 0; i < n; i++)
            if (s.nodes[i].owner == 1) min_dist = std::min(min_dist, s.dist[i][j]);
        if (min_dist > 10) continue;
        
        int need = s.nodes[j].troops + 1;
        if (s.nodes[j].owner == 2) {
            for (auto& a : inc[j])
                if (a.owner == 2 && a.turns_left <= min_dist) need += a.troops;
            need = (need * 3) / 2;  // 1.5x
        }
        
        int total = 0;
        for (int i = 0; i < n; i++) {
            if (s.nodes[i].owner != 1) continue;
            total += std::max(0, avail[i] - s.nodes[i].growth);
        }
        if (total < need) continue;
        
        double turns = remaining - min_dist + 1;
        if (turns < 5) continue;
        double value = s.nodes[j].growth * turns * ((s.nodes[j].owner == 2) ? 2.0 : 1.0);
        double score = value / (need * (double)min_dist);
        if (score < 0.3) continue;
        
        std::vector<std::pair<int,int>> srcs;
        for (int i = 0; i < n; i++)
            if (s.nodes[i].owner == 1) srcs.push_back({s.dist[i][j], i});
        std::sort(srcs.begin(), srcs.end());
        
        int still = need;
        for (auto& [d, src] : srcs) {
            if (still <= 0) break;
            if (src == j) continue;
            int can = std::max(0, avail[src] - s.nodes[src].growth);
            if (can <= 0) continue;
            int send = std::min(can, still);
            if (send < 2 && send != still) continue;
            orders.push_back({src, j, send});
            avail[src] -= send;
            still -= send;
        }
        if (still <= 0) used[j] = true;
    }
    
    // === CLEANUP ===
    for (int i = 0; i < n; i++) {
        if (s.nodes[i].owner != 1) continue;
        int keep = s.nodes[i].growth;
        int sendable = avail[i] - keep;
        if (sendable < 3) continue;
        
        int best = -1;
        double best_score = -1;
        for (int j = 0; j < n; j++) {
            if (j == i || s.nodes[j].owner == 1) continue;
            int dist = s.dist[i][j];
            if (dist <= 0 || dist > 12) continue;
            double value = s.nodes[j].growth * (remaining - dist + 1);
            if (s.nodes[j].owner == 2) value *= 2.0;
            double score = value / dist;
            if (score > best_score) { best_score = score; best = j; }
        }
        
        if (best >= 0) {
            if (s.nodes[best].owner == 0) {
                int need = s.nodes[best].troops + 1;
                if (sendable >= need && need >= 3) {
                    orders.push_back({i, best, need});
                    avail[i] -= need;
                }
            } else {
                if (sendable >= 5) {
                    orders.push_back({i, best, sendable});
                    avail[i] = 0;
                }
            }
        }
    }
    
    return orders;
}
