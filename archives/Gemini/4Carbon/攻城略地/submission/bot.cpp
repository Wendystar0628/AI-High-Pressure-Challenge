#include "engine.hpp"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <vector>

namespace {

constexpr int MAXN = 24;
constexpr int MAXH = 22;

struct NodeTimeline {
    std::array<int, MAXH + 1> owner{};
    std::array<int, MAXH + 1> troops{};
};

struct BotContext {
    int n = 0;
    int turn = 1;
    int max_turns = 200;
    int rem_steps = 200;
    int horizon = 20;
    std::array<Node, MAXN> nodes{};
    std::array<std::array<int, MAXN>, MAXN> dist{};
    std::array<std::array<int, MAXH + 1>, MAXN> inc1{};
    std::array<std::array<int, MAXH + 1>, MAXN> inc2{};

    void init(const State& s) {
        n = (int)s.nodes.size();
        turn = s.turn;
        max_turns = s.max_turns;
        rem_steps = std::max(0, max_turns - turn + 1);
        horizon = std::min(MAXH, rem_steps);
        for (int i = 0; i < n; ++i) {
            nodes[i] = s.nodes[i];
            inc1[i].fill(0);
            inc2[i].fill(0);
            for (int j = 0; j < n; ++j) {
                dist[i][j] = s.dist[i][j];
            }
        }
        for (const auto& f : s.fleets) {
            if (f.turns_left >= 1 && f.turns_left <= MAXH && f.to >= 0 && f.to < n) {
                if (f.owner == 1) inc1[f.to][f.turns_left] += f.troops;
                else if (f.owner == 2) inc2[f.to][f.turns_left] += f.troops;
            }
        }
    }

    NodeTimeline simulate_node(int u, int start_troops,
                               const std::array<int, MAXH + 1>* add1 = nullptr) const {
        NodeTimeline tl;
        int cur_o = nodes[u].owner;
        int cur_t = start_troops;
        int g = nodes[u].growth;
        tl.owner[0] = cur_o;
        tl.troops[0] = cur_t;
        for (int k = 1; k <= horizon; ++k) {
            if (cur_o != 0) cur_t += g;
            int a1 = inc1[u][k] + (add1 ? (*add1)[k] : 0);
            int a2 = inc2[u][k];
            if (a1 > 0 || a2 > 0) {
                int s0 = (cur_o == 0) ? cur_t : 0;
                int s1 = ((cur_o == 1) ? cur_t : 0) + a1;
                int s2 = ((cur_o == 2) ? cur_t : 0) + a2;
                int top = s0, best_o = 0, second = 0;
                if (s1 > top) { second = top; top = s1; best_o = 1; }
                else if (s1 > second) { second = s1; }
                if (s2 > top) { second = top; top = s2; best_o = 2; }
                else if (s2 > second) { second = s2; }
                if (top == second) {
                    cur_t = 0;
                } else {
                    cur_o = best_o;
                    cur_t = top - second;
                }
            }
            tl.owner[k] = cur_o;
            tl.troops[k] = cur_t;
        }
        return tl;
    }

    int compute_hard_keep(int u, int cur_t) const {
        if (nodes[u].owner != 1 || horizon == 0) return 0;
        auto full_tl = simulate_node(u, cur_t);
        for (int k = 1; k <= horizon; ++k) {
            if (full_tl.owner[k] != 1) return cur_t + 1;
        }
        int lo = 0, hi = cur_t;
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            auto tl = simulate_node(u, mid);
            bool ok = true;
            for (int k = 1; k <= horizon; ++k) {
                if (tl.owner[k] != 1) { ok = false; break; }
            }
            if (ok) hi = mid;
            else lo = mid + 1;
        }
        return lo;
    }

    int compute_enemy_hard_keep(int e) const {
        if (nodes[e].owner != 2 || horizon == 0) return 0;
        auto full_tl = simulate_node(e, nodes[e].troops);
        for (int k = 1; k <= horizon; ++k) {
            if (full_tl.owner[k] != 2) return nodes[e].troops + 1;
        }
        int lo = 0, hi = nodes[e].troops;
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            auto tl = simulate_node(e, mid);
            bool ok = true;
            for (int k = 1; k <= horizon; ++k) {
                if (tl.owner[k] != 2) { ok = false; break; }
            }
            if (ok) hi = mid;
            else lo = mid + 1;
        }
        return lo;
    }
};

struct StrikePlan {
    int target = -1;
    int k_cap = -1;
    int total_troops = 0;
    double score = -1.0;
    std::array<int, MAXN> alloc{};
};

} // namespace

std::vector<Order> decide(const State& s) {
    BotContext ctx;
    ctx.init(s);
    const int n = ctx.n;
    if (n == 0 || ctx.rem_steps <= 0) return {};

    std::array<std::array<int, MAXN>, MAXN> send_mat{};
    std::array<int, MAXN> cur_troops{};
    int my_total = 0, opp_total = 0;
    int my_growth = 0, opp_growth = 0;

    for (int i = 0; i < n; ++i) {
        send_mat[i].fill(0);
        cur_troops[i] = ctx.nodes[i].troops;
        if (ctx.nodes[i].owner == 1) { my_total += ctx.nodes[i].troops; my_growth += ctx.nodes[i].growth; }
        else if (ctx.nodes[i].owner == 2) { opp_total += ctx.nodes[i].troops; opp_growth += ctx.nodes[i].growth; }
    }
    for (const auto& f : s.fleets) {
        if (f.owner == 1) my_total += f.troops;
        else if (f.owner == 2) opp_total += f.troops;
    }

    // Capital discount rate grounded in Payback Physics:
    // - Opening (Turn 1..4): r = 0.028 (~35-turn horizon: snaps up g=3..5 nodes up to troops=58 while preferring fast IRR)
    // - Contested Early/Midgame: r = 0.034 (~29-turn horizon: avoids dumping 45..60 troops into slow g=1..2 traps while clashing!)
    // - Surplus / Quiet Stalemate: relaxes to 0.015 once we safely outnumber Enemy so slow g=1..2 neutrals get harvested cleanly!
    double disc_r = 0.034;
    if (ctx.turn <= 4) {
        disc_r = 0.028;
    } else if (my_total > opp_total + 75 && my_growth >= opp_growth) {
        disc_r = 0.015;
    } else if (ctx.turn >= 45 && my_total >= opp_total + 25 && my_growth >= opp_growth) {
        disc_r = 0.018;
    }

    auto discounted_growth_turns = [&](int d_arr, double r_override = -1.0) -> double {
        double r = (r_override > 0.0) ? r_override : disc_r;
        int r_turns = std::max(0, ctx.rem_steps - d_arr);
        if (r_turns <= 0) return 0.0;
        double a = std::exp(-r * (double)d_arr);
        double b = std::exp(-r * (double)ctx.rem_steps);
        return (a - b) / r;
    };

    auto emit = [&](int from, int to, int troops) {
        if (from < 0 || from >= n || to < 0 || to >= n || from == to) return;
        if (ctx.nodes[from].owner != 1 || troops <= 0 || troops > cur_troops[from]) return;
        cur_troops[from] -= troops;
        send_mat[from][to] += troops;
        int d = ctx.dist[from][to];
        if (d <= ctx.horizon) {
            ctx.inc1[to][d] += troops;
        }
    };

    std::array<NodeTimeline, MAXN> base_tl{};
    std::array<int, MAXN> opp_now_free{};
    std::array<int, MAXN> opp_deter_pinned{};

    for (int i = 0; i < n; ++i) {
        base_tl[i] = ctx.simulate_node(i, cur_troops[i]);
        if (ctx.nodes[i].owner == 2) {
            int ehk = ctx.compute_enemy_hard_keep(i);
            opp_now_free[i] = (ehk > ctx.nodes[i].troops) ? 0 : (ctx.nodes[i].troops - ehk);

            int my_near_threat = 0;
            for (int u = 0; u < n; ++u) {
                if (ctx.nodes[u].owner == 1 && ctx.dist[u][i] <= 6) {
                    my_near_threat += std::max(0, ctx.nodes[u].troops - ctx.dist[u][i] * ctx.nodes[i].growth);
                }
            }
            opp_deter_pinned[i] = std::min(opp_now_free[i], (int)(0.50 * my_near_threat));
        }
    }

    // Count genuinely attractive (positive-NPV at r=0.034) safe neutrals remaining on our side
    int attractive_safe_neutral_g = 0;
    for (int z = 0; z < n; ++z) {
        if (ctx.nodes[z].owner == 0 && base_tl[z].owner[ctx.horizon] == 0) {
            int md = 99, ed = 99;
            for (int u = 0; u < n; ++u) {
                if (ctx.nodes[u].owner == 1) md = std::min(md, ctx.dist[u][z]);
                else if (ctx.nodes[u].owner == 2) ed = std::min(ed, ctx.dist[u][z]);
            }
            if (md <= ed + 1) {
                double pv = discounted_growth_turns(md, 0.034) * ctx.nodes[z].growth - ctx.nodes[z].troops;
                if (pv > 4.0) attractive_safe_neutral_g += ctx.nodes[z].growth;
            }
        }
    }

    auto enemy_reactive_reach = [&](int v, int k, bool discount_pinned = true) -> int {
        int sum = 0;
        for (int e = 0; e < n; ++e) {
            if (e == v) continue;
            int d = ctx.dist[e][v];
            int t_launch = k - d;
            if (t_launch < 1) continue;
            int idx = std::min(ctx.horizon, t_launch);
            if (base_tl[e].owner[idx] == 2) {
                bool safe_later = true;
                int min_after = base_tl[e].troops[idx];
                for (int t2 = idx + 1; t2 <= ctx.horizon; ++t2) {
                    if (base_tl[e].owner[t2] != 2) { safe_later = false; break; }
                    min_after = std::min(min_after, base_tl[e].troops[t2]);
                }
                if (safe_later) {
                    int pin = discount_pinned ? opp_deter_pinned[e] : 0;
                    sum += std::max(0, std::min(base_tl[e].troops[idx], min_after) - pin);
                }
            }
        }
        return sum;
    };

    // 1. Reaction-Cone Protected Deterrence Keep
    std::array<double, MAXN> enemy_split{};
    for (int e = 0; e < n; ++e) {
        if (ctx.nodes[e].owner != 2) continue;
        double wsum = 0.0;
        for (int u = 0; u < n; ++u) {
            if (ctx.nodes[u].owner == 1 && ctx.dist[e][u] <= 9) {
                wsum += (double)(ctx.nodes[u].growth + 1) / (double)ctx.dist[e][u];
            }
        }
        enemy_split[e] = std::max(1.0, wsum);
    }

    std::array<int, MAXN> hard_keep{};
    std::array<int, MAXN> keep{};
    for (int u = 0; u < n; ++u) {
        if (ctx.nodes[u].owner == 1) {
            hard_keep[u] = ctx.compute_hard_keep(u, cur_troops[u]);
        }
    }

    for (int u = 0; u < n; ++u) {
        if (ctx.nodes[u].owner != 1) continue;
        int hk = hard_keep[u];
        if (hk > cur_troops[u]) {
            keep[u] = cur_troops[u];
            continue;
        }
        double worst_single = 0.0;
        double sum_frac = 0.0;
        for (int e = 0; e < n; ++e) {
            if (ctx.nodes[e].owner != 2) continue;
            int d = ctx.dist[e][u];
            if (d > ctx.horizon || d > 9) continue;

            int cone_help = 0;
            for (int w = 0; w < n; ++w) {
                if (w != u && ctx.nodes[w].owner == 1 && ctx.dist[w][u] <= d - 1 && hard_keep[w] <= cur_troops[w]) {
                    cone_help += (cur_troops[w] - hard_keep[w]);
                }
            }

            int e_today = opp_now_free[e];
            int need0 = std::max(0, e_today - d * ctx.nodes[u].growth - cone_help);

            int e_next = (base_tl[e].owner[1] == 2) ? base_tl[e].troops[1] : 0;
            int cone_help_next = cone_help;
            for (int w = 0; w < n; ++w) {
                if (w != u && ctx.nodes[w].owner == 1 && ctx.dist[w][u] == d && hard_keep[w] <= cur_troops[w]) {
                    cone_help_next += (cur_troops[w] - hard_keep[w]);
                }
            }
            int need1 = (d + 1 <= ctx.horizon) ? std::max(0, e_next - (d + 1) * ctx.nodes[u].growth - cone_help_next) : 0;
            int raw_need = std::max(need0, need1);

            int snipe_guard = std::min(raw_need, 32);
            double w_u = (double)(ctx.nodes[u].growth + 1) / (double)d;
            double frac = std::min(1.0, 1.15 * w_u / enemy_split[e]);
            double w_need = std::max((double)snipe_guard, raw_need * frac);
            worst_single = std::max(worst_single, w_need);
            sum_frac += raw_need * (w_u / enemy_split[e]);
        }
        int deter = (int)std::ceil(std::max(worst_single, 0.75 * sum_frac));
        if (ctx.turn <= 10) deter = std::min(deter, 5);
        keep[u] = std::min(cur_troops[u], std::max(hk, deter));
    }

    std::array<int, MAXN> avail{};
    for (int u = 0; u < n; ++u) {
        if (ctx.nodes[u].owner == 1) {
            avail[u] = std::max(0, cur_troops[u] - keep[u]);
        }
    }

    // 2. Urgent Defense
    struct DefTask {
        int v;
        int loss_step;
        int growth;
    };
    std::vector<DefTask> def_tasks;
    for (int v = 0; v < n; ++v) {
        bool ever_ours = (ctx.nodes[v].owner == 1);
        int loss_step = -1;
        for (int k = 1; k <= ctx.horizon; ++k) {
            if (base_tl[v].owner[k] == 1) ever_ours = true;
            if (ever_ours && base_tl[v].owner[k] == 2) {
                loss_step = k;
                break;
            }
        }
        if (loss_step == 1 && ctx.nodes[v].owner == 1) {
            keep[v] = 0;
            avail[v] = cur_troops[v];
        } else if (loss_step >= 2) {
            def_tasks.push_back({v, loss_step, ctx.nodes[v].growth});
        }
    }
    std::sort(def_tasks.begin(), def_tasks.end(), [](const DefTask& a, const DefTask& b) {
        if (a.growth != b.growth) return a.growth > b.growth;
        return a.loss_step < b.loss_step;
    });

    for (const auto& dt : def_tasks) {
        int v = dt.v;
        std::vector<int> srcs;
        for (int u = 0; u < n; ++u) {
            if (u != v && ctx.nodes[u].owner == 1 && avail[u] > 0 && ctx.dist[u][v] <= std::min(ctx.horizon, dt.loss_step + 1)) {
                srcs.push_back(u);
            }
        }
        std::sort(srcs.begin(), srcs.end(), [&](int a, int b) {
            return ctx.dist[a][v] < ctx.dist[b][v];
        });

        std::array<int, MAXH + 1> add1{};
        add1.fill(0);
        std::vector<std::pair<int, int>> chosen;
        bool saved = false;

        for (int u : srcs) {
            int d = ctx.dist[u][v];
            auto check_amt = [&](int amt) {
                add1[d] += amt;
                auto tl = ctx.simulate_node(v, cur_troops[v], &add1);
                add1[d] -= amt;
                int start_chk = std::max(d, dt.loss_step);
                for (int k = start_chk; k <= ctx.horizon; ++k) {
                    if (tl.owner[k] != 1) return false;
                }
                return true;
            };
            if (check_amt(avail[u])) {
                int lo = 1, hi = avail[u];
                while (lo < hi) {
                    int mid = (lo + hi) / 2;
                    if (check_amt(mid)) hi = mid;
                    else lo = mid + 1;
                }
                add1[d] += lo;
                chosen.push_back({u, lo});
                saved = true;
                break;
            } else {
                add1[d] += avail[u];
                chosen.push_back({u, avail[u]});
            }
        }

        if (saved) {
            for (auto [u, amt] : chosen) {
                emit(u, v, amt);
                avail[u] -= amt;
            }
            base_tl[v] = ctx.simulate_node(v, cur_troops[v]);
        } else if (ctx.nodes[v].owner == 1) {
            keep[v] = 0;
            avail[v] = cur_troops[v];
        }
    }

    // 3. Turn 1..4 Exact Immediate 0-1 Knapsack from Home Hub (Up to d <= 16!)
    int my_node_count = 0;
    int primary_hub = -1;
    for (int u = 0; u < n; ++u) {
        if (ctx.nodes[u].owner == 1) {
            ++my_node_count;
            if (primary_hub == -1 || avail[u] > avail[primary_hub]) primary_hub = u;
        }
    }

    std::array<bool, MAXN> targeted{};
    targeted.fill(false);

    if (ctx.turn <= 4 && my_node_count == 1 && primary_hub != -1 && avail[primary_hub] >= 12) {
        int hub = primary_hub;
        int cap = std::min(200, avail[hub]);
        struct KnapItem {
            int v;
            int cost;
            double npv;
        };
        std::vector<KnapItem> items;
        for (int v = 0; v < n; ++v) {
            if (v == hub || ctx.nodes[v].owner != 0) continue;
            if (base_tl[v].owner[ctx.horizon] == 1) continue;
            int d = ctx.dist[hub][v];
            if (d > 16 || d > ctx.horizon) continue;
            int min_ed = 99;
            for (int e = 0; e < n; ++e) if (ctx.nodes[e].owner == 2) min_ed = std::min(min_ed, ctx.dist[e][v]);
            if (min_ed < d) continue;

            int need = base_tl[v].troops[d] + 1;
            if (need > cap) continue;
            double pv = discounted_growth_turns(d, 0.028) * ctx.nodes[v].growth - base_tl[v].troops[d];
            if (min_ed == d) pv -= 10.0;
            if (pv > 2.0) {
                items.push_back({v, need, pv});
            }
        }
        int M = (int)items.size();
        if (M > 0) {
            std::vector<std::vector<double>> dp(M + 1, std::vector<double>(cap + 1, -1e18));
            std::vector<std::vector<bool>> take(M + 1, std::vector<bool>(cap + 1, false));
            dp[0][0] = 0.0;
            for (int i = 0; i < M; ++i) {
                for (int c = 0; c <= cap; ++c) {
                    if (dp[i][c] < -1e17) continue;
                    if (dp[i][c] > dp[i + 1][c]) {
                        dp[i + 1][c] = dp[i][c];
                        take[i + 1][c] = false;
                    }
                    int nc = c + items[i].cost;
                    if (nc <= cap && dp[i][c] + items[i].npv > dp[i + 1][nc]) {
                        dp[i + 1][nc] = dp[i][c] + items[i].npv;
                        take[i + 1][nc] = true;
                    }
                }
            }
            int best_c = 0;
            for (int c = 1; c <= cap; ++c) {
                if (dp[M][c] > dp[M][best_c]) best_c = c;
            }
            int cur_c = best_c;
            for (int i = M; i >= 1; --i) {
                if (take[i][cur_c]) {
                    int v = items[i - 1].v;
                    int cst = items[i - 1].cost;
                    targeted[v] = true;
                    emit(hub, v, cst);
                    avail[hub] -= cst;
                    base_tl[v] = ctx.simulate_node(v, cur_troops[v]);
                    cur_c -= cst;
                }
            }
        }
    }

    // 4. General Multi-Source Coordinated Strike Planner
    bool behind_growth = (my_growth < opp_growth && attractive_safe_neutral_g < (opp_growth - my_growth));
    bool winning_big = (my_total > opp_total * 1.18 + 50 && my_growth >= opp_growth);
    bool trailing_score = (my_total + ctx.rem_steps * (my_growth - opp_growth) <= opp_total &&
                           attractive_safe_neutral_g == 0 && ctx.turn > 22);

    int spent_neutral_tax = 0;

    for (int iter = 0; iter < n; ++iter) {
        int total_avail = 0;
        for (int u = 0; u < n; ++u) if (ctx.nodes[u].owner == 1) total_avail += avail[u];
        if (total_avail <= 0) break;

        StrikePlan best_plan;
        int best_plan_ntax = 0;

        for (int v = 0; v < n; ++v) {
            if (targeted[v]) continue;
            base_tl[v] = ctx.simulate_node(v, cur_troops[v]);

            if (base_tl[v].owner[ctx.horizon] == 1) {
                bool seen_ours = (ctx.nodes[v].owner == 1);
                bool lost_later = false;
                for (int k = 1; k <= ctx.horizon; ++k) {
                    if (base_tl[v].owner[k] == 1) seen_ours = true;
                    else if (seen_ours) { lost_later = true; break; }
                }
                if (!lost_later) continue;
            }

            std::vector<int> srcs;
            for (int u = 0; u < n; ++u) {
                if (u != v && ctx.nodes[u].owner == 1 && avail[u] > 0 && ctx.dist[u][v] <= ctx.horizon) {
                    srcs.push_back(u);
                }
            }
            if (srcs.empty()) continue;
            std::sort(srcs.begin(), srcs.end(), [&](int a, int b) {
                if (ctx.dist[a][v] != ctx.dist[b][v]) return ctx.dist[a][v] < ctx.dist[b][v];
                return avail[a] > avail[b];
            });

            int min_ed = 99;
            for (int e = 0; e < n; ++e) {
                if (e != v && (ctx.nodes[e].owner == 2 || base_tl[e].owner[std::min(ctx.horizon, 4)] == 2)) {
                    min_ed = std::min(min_ed, ctx.dist[e][v]);
                }
            }

            int first_ecap = -1;
            if (ctx.nodes[v].owner == 0) {
                for (int k = 1; k <= ctx.horizon; ++k) {
                    if (base_tl[v].owner[k] == 2) { first_ecap = k; break; }
                }
            }

            std::array<int, MAXH + 1> add1{};
            add1.fill(0);
            int cum_supply = 0;

            for (std::size_t r = 0; r < srcs.size(); ++r) {
                int u_r = srcs[r];
                int d_r = ctx.dist[u_r][v];
                cum_supply += avail[u_r];
                add1[d_r] += avail[u_r];

                if (r + 1 < srcs.size() && ctx.dist[srcs[r + 1]][v] == d_r) continue;

                bool is_pure_neutral = (ctx.nodes[v].owner == 0 && first_ecap == -1);
                if (is_pure_neutral && d_r > 10) {
                    bool have_closer_owned = false;
                    for (int w = 0; w < n; ++w) {
                        if ((ctx.nodes[w].owner == 1 || base_tl[w].owner[std::min(ctx.horizon, 4)] == 1) && ctx.dist[w][v] <= d_r - 3) {
                            have_closer_owned = true;
                            break;
                        }
                    }
                    if (have_closer_owned && my_total < 450) continue;
                }

                int rem_grow = std::max(0, ctx.rem_steps - d_r);
                if (rem_grow <= 0 && my_growth > 0 && opp_growth > 5) continue;

                int e_before = enemy_reactive_reach(v, d_r, !is_pure_neutral);
                int e_soon = std::max(0, enemy_reactive_reach(v, std::min(ctx.horizon, d_r + 2), !is_pure_neutral) - e_before);

                int g_v = ctx.nodes[v].growth;
                int desired_rem = 1;
                int this_ntax = 0;

                if (is_pure_neutral) {
                    int n_tax = base_tl[v].troops[d_r];
                    this_ntax = n_tax;
                    if (rem_grow * g_v - n_tax <= 2) continue;

                    // Guard against slow midgame neutral traps (e.g. troops=45..60, g=1..2) putting us into a combat troop deficit!
                    if (ctx.turn >= 5 && n_tax > 15 * g_v) {
                        if (my_total - spent_neutral_tax - n_tax < (int)(0.94 * opp_total)) continue;
                    }

                    // Turn 1..4 opening: never waste escort on our-side neutrals!
                    // Turn >= 5: preserve full anti-poach escort when Enemy has hubs nearby (min_ed <= d_r + 1)!
                    if (ctx.turn <= 4) {
                        if (min_ed < d_r) continue;
                        desired_rem = 1;
                    } else if (min_ed < d_r && (e_before + e_soon) >= g_v + 3) {
                        if (my_total < 200) continue;
                        desired_rem = 1 + std::min(40, (e_before + e_soon) / 2 + g_v);
                    } else if (min_ed <= d_r + 1 && (e_before + e_soon) >= g_v + 4) {
                        desired_rem = 1 + std::min(25, (e_before + e_soon) / 3 + 2);
                    }
                } else {
                    bool true_poach = (first_ecap != -1 && d_r >= first_ecap && d_r <= first_ecap + 2 && min_ed >= d_r - 2);
                    bool uninterceptable = (e_before == 0 && min_ed + 1 > d_r);

                    // Prevent early-game cross-map suicide into Enemy backyard while attractive neutrals on our side exist!
                    if ((ctx.turn <= 10 || attractive_safe_neutral_g >= 3) && !true_poach) {
                        if (!uninterceptable || d_r > 7) {
                            if (d_r > 7 || d_r > min_ed + 1) continue;
                        }
                    }

                    if (uninterceptable) {
                        desired_rem = 1 + std::min(20, e_soon / 3);
                    } else {
                        double beta = winning_big ? 0.90 : (trailing_score ? 0.38 : (behind_growth ? 0.60 : 0.85));
                        if (!true_poach && !winning_big && !trailing_score && !behind_growth && d_r > 8) {
                            beta = 1.05;
                        }
                        desired_rem = 1 + (int)std::ceil(beta * e_before);
                    }
                }

                auto full_sim = ctx.simulate_node(v, cur_troops[v], &add1);
                bool ok = (full_sim.owner[d_r] == 1 && full_sim.troops[d_r] >= desired_rem);
                if (ok) {
                    for (int k = d_r + 1; k <= ctx.horizon; ++k) {
                        if (full_sim.owner[k] != 1) { ok = false; break; }
                    }
                }
                if (!ok) continue;

                auto build_trimmed = [&](int keep_total, std::array<int, MAXH + 1>& tmp_add, std::array<int, MAXN>& tmp_alloc) {
                    tmp_add.fill(0);
                    tmp_alloc.fill(0);
                    int rem_t = keep_total;
                    for (std::size_t j = 0; j <= r && rem_t > 0; ++j) {
                        int u = srcs[j];
                        int take = std::min(avail[u], rem_t);
                        tmp_alloc[u] = take;
                        tmp_add[ctx.dist[u][v]] += take;
                        rem_t -= take;
                    }
                };

                int lo = 1, hi = cum_supply;
                std::array<int, MAXH + 1> tmp_add{};
                std::array<int, MAXN> tmp_alloc{};
                while (lo < hi) {
                    int mid = (lo + hi) / 2;
                    build_trimmed(mid, tmp_add, tmp_alloc);
                    auto tl = ctx.simulate_node(v, cur_troops[v], &tmp_add);
                    bool m_ok = (tl.owner[d_r] == 1 && tl.troops[d_r] >= desired_rem);
                    if (m_ok) {
                        for (int k = d_r + 1; k <= ctx.horizon; ++k) {
                            if (tl.owner[k] != 1) { m_ok = false; break; }
                        }
                    }
                    if (m_ok) hi = mid;
                    else lo = mid + 1;
                }

                build_trimmed(lo, tmp_add, tmp_alloc);
                int cost_troops = lo;

                double score = -1.0;
                if (is_pure_neutral) {
                    int n_tax = base_tl[v].troops[d_r];
                    double npv = discounted_growth_turns(d_r) * g_v - n_tax;
                    if (npv <= 1.0) continue;
                    int in_flight_already = 0;
                    for (int k = 1; k <= ctx.horizon; ++k) in_flight_already += ctx.inc1[v][k];
                    double denom = n_tax + 0.25 * (cost_troops - n_tax) + 0.8 * d_r + 4.0;
                    score = (npv / denom) * 100.0;
                    if (min_ed > d_r + 2) score *= 1.12;
                    if (in_flight_already > 0) score *= 1.85;
                } else {
                    bool true_poach = (first_ecap != -1 && d_r >= first_ecap && d_r <= first_ecap + 2 && min_ed >= d_r - 2);
                    int safe_turns = std::max(1, std::min(rem_grow, min_ed + 1 - d_r));
                    bool uninterceptable = (e_before == 0 && min_ed + 1 > d_r);
                    double eff_pv = uninterceptable && (e_soon > desired_rem + safe_turns * g_v)
                        ? (double)safe_turns
                        : std::min(discounted_growth_turns(d_r, 0.020), 24.0);
                    double swing = 2.0 * eff_pv * g_v + (true_poach ? 28.0 : 0.0);
                    double denom = cost_troops + 2.0 * d_r + 8.0;
                    score = (swing / denom) * 85.0;
                    if (true_poach) score *= 1.65;
                    if (uninterceptable) score *= 1.25;
                    if (winning_big || trailing_score) score *= 1.45;
                    else if (attractive_safe_neutral_g > 0 && !true_poach && !uninterceptable) score *= 0.45;
                    else if (!behind_growth && !uninterceptable && !true_poach) score *= 0.80;
                }

                if (score > best_plan.score) {
                    best_plan.target = v;
                    best_plan.k_cap = d_r;
                    best_plan.total_troops = cost_troops;
                    best_plan.score = score;
                    best_plan.alloc = tmp_alloc;
                    best_plan_ntax = this_ntax;
                }

                if (is_pure_neutral && desired_rem == 1) break;
            }
        }

        if (best_plan.target == -1 || best_plan.score < 2.5) break;

        int v = best_plan.target;
        targeted[v] = true;
        spent_neutral_tax += best_plan_ntax;
        for (int u = 0; u < n; ++u) {
            int amt = best_plan.alloc[u];
            if (amt > 0) {
                emit(u, v, amt);
                avail[u] -= amt;
            }
        }
        base_tl[v] = ctx.simulate_node(v, cur_troops[v]);
    }

    // 4b. Endgame / Stalemate Deficit Multi-Flank Harassment (Fixes seed 22: 1-node Deathstar when trailing!)
    if (trailing_score && ctx.rem_steps >= 2 && ctx.rem_steps <= 45) {
        struct FlankRaid { int u, v, need; double sc; };
        std::vector<FlankRaid> raids;
        for (int v = 0; v < n; ++v) {
            if (targeted[v] || ctx.nodes[v].owner != 2 || ctx.nodes[v].troops > 25) continue;
            for (int u = 0; u < n; ++u) {
                if (ctx.nodes[u].owner != 1 || avail[u] < 10) continue;
                int d = ctx.dist[u][v];
                if (d >= ctx.rem_steps || d > ctx.horizon) continue;
                int need = base_tl[v].troops[d] + 2 + 2 * ctx.nodes[v].growth;
                if (need <= avail[u] && need <= 65) {
                    double sc = (double)(ctx.nodes[v].growth * std::min(12, ctx.rem_steps - d)) / (need + d);
                    raids.push_back({u, v, need, sc});
                }
            }
        }
        std::sort(raids.begin(), raids.end(), [](const FlankRaid& a, const FlankRaid& b) { return a.sc > b.sc; });
        int cnt = 0;
        for (const auto& fr : raids) {
            if (targeted[fr.v] || avail[fr.u] < fr.need) continue;
            targeted[fr.v] = true;
            emit(fr.u, fr.v, fr.need);
            avail[fr.u] -= fr.need;
            base_tl[fr.v] = ctx.simulate_node(fr.v, cur_troops[fr.v]);
            if (++cnt >= 3) break;
        }
    }

    // 5. Un-Poisoned Triangle-Inequality Geodesic Hub Streaming!
    // Only pull toward Enemy nodes and genuinely attractive positive-NPV neutrals (never slow g=1..2 backyard rocks!).
    if (ctx.rem_steps > 3) {
        std::array<double, MAXN> front_pot{};
        bool has_targets = false;
        for (int i = 0; i < n; ++i) {
            if (base_tl[i].owner[ctx.horizon] != 1) has_targets = true;
        }
        if (has_targets) {
            for (int u = 0; u < n; ++u) {
                std::vector<double> dists;
                for (int t = 0; t < n; ++t) {
                    if (t == u || base_tl[t].owner[ctx.horizon] == 1) continue;
                    if (base_tl[t].owner[ctx.horizon] == 2 || ctx.nodes[t].owner == 2) {
                        dists.push_back((double)ctx.dist[u][t] - 0.32 * ctx.nodes[t].growth);
                    } else if (ctx.nodes[t].owner == 0) {
                        double pv = discounted_growth_turns(ctx.dist[u][t], 0.034) * ctx.nodes[t].growth - ctx.nodes[t].troops;
                        if (pv > 5.0) {
                            dists.push_back((double)ctx.dist[u][t] + 0.25 * (ctx.nodes[t].troops / std::max(1, ctx.nodes[t].growth)));
                        }
                    }
                }
                if (dists.empty()) {
                    // Fallback: pull toward any remaining neutral if Enemy eliminated / only slow neutrals left
                    for (int t = 0; t < n; ++t) {
                        if (t != u && base_tl[t].owner[ctx.horizon] != 1) {
                            dists.push_back((double)ctx.dist[u][t]);
                        }
                    }
                }
                if (dists.empty()) {
                    front_pot[u] = 1e9;
                } else {
                    std::sort(dists.begin(), dists.end());
                    if (dists.size() >= 2) front_pot[u] = 0.65 * dists[0] + 0.35 * dists[1];
                    else front_pot[u] = dists[0];
                }
            }

            for (int u = 0; u < n; ++u) {
                if (ctx.nodes[u].owner != 1 || avail[u] <= 0) continue;

                int best_w = -1;
                double best_val = 1e18;
                for (int w = 0; w < n; ++w) {
                    if (w == u) continue;
                    int d_uw = ctx.dist[u][w];
                    if (d_uw >= ctx.rem_steps || d_uw > ctx.horizon) continue;

                    if (front_pot[w] > front_pot[u] - 1.25) continue;
                    if (d_uw + front_pot[w] > front_pot[u] + 3.5) continue;

                    bool w_safe = (base_tl[w].owner[d_uw] == 1);
                    if (w_safe) {
                        for (int k = d_uw + 1; k <= ctx.horizon; ++k) {
                            if (base_tl[w].owner[k] != 1) { w_safe = false; break; }
                        }
                    }
                    if (w_safe && ctx.nodes[w].owner != 1) {
                        int w_ed = 99;
                        for (int e = 0; e < n; ++e) if (ctx.nodes[e].owner == 2) w_ed = std::min(w_ed, ctx.dist[e][w]);
                        if (w_ed <= d_uw) w_safe = false;
                    }
                    if (!w_safe) continue;

                    double cand_val = 0.92 * d_uw + front_pot[w] - 0.08 * ctx.nodes[w].growth;
                    if (cand_val < best_val) {
                        best_val = cand_val;
                        best_w = w;
                    }
                }
                if (best_w != -1) {
                    emit(u, best_w, avail[u]);
                    avail[u] = 0;
                }
            }
        }
    }

    std::vector<Order> orders;
    for (int i = 0; i < n; ++i) {
        for (int j = 0; j < n; ++j) {
            if (send_mat[i][j] > 0) {
                orders.push_back({i, j, send_mat[i][j]});
            }
        }
    }
    return orders;
}
