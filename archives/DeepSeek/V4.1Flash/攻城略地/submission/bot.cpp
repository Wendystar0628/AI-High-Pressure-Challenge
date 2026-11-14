#include "engine.hpp"
#include <algorithm>
#include <cmath>
#include <vector>

#ifdef SIEGE_DEBUG
#include <cstdio>
#define DBG(...) std::fprintf(stderr, __VA_ARGS__)
#else
#define DBG(...) ((void)0)
#endif
#ifndef DBG_TURN
#define DBG_TURN -1
#endif
#ifndef DBG_TARGET
#define DBG_TARGET -1
#endif

namespace {

constexpr int MAXN = 24;
constexpr int MAXT = 212;
constexpr int INF = 1000000;

struct Arr { int turn, owner, troops; };

struct Mission {
    int target = -1;
    int arrive = 0;
    int req = 0;
    double score = 0.0;
};

struct Bot {
    int n = 0, T = 0, MT = 200;
    int g[MAXN];
    int dst[MAXN][MAXN];
    int pOwn[MAXN][MAXT];
    int pTr[MAXN][MAXT];
    int qOwn[MAXN][MAXT];   // pessimistic: only enemy fleets are simulated
    int qTr[MAXN][MAXT];
    std::vector<Arr> arr[MAXN];
    char inb[MAXN][MAXT];   // our fleet arrives at node i at end of turn t
    char hasInb[MAXN];
    int remain[MAXN];
    int reserve[MAXN];
    int enemyHome = -1;
    std::vector<Order> out;

    // ---- tunables (overridable for experiments) ----
#ifndef P_NEUTRAL
#define P_NEUTRAL 1.25
#endif
#ifndef P_ENEMY
#define P_ENEMY 2.0
#endif
#ifndef P_DECAY
#define P_DECAY 0.04
#endif
#ifndef P_THREATW
#define P_THREATW 1.0
#endif
#ifndef P_MINGARR
#define P_MINGARR 2
#endif
#ifndef P_RESERVEFRAC
#define P_RESERVEFRAC 0.12
#endif
#ifndef P_EPOT
#define P_EPOT 0.0
#endif
#ifndef P_MARGIN
#define P_MARGIN 0.0
#endif
#ifndef P_FLOW
#define P_FLOW 0
#endif
#ifndef P_ASSUME
#define P_ASSUME 1
#endif
#ifndef P_MAXD
#define P_MAXD 20
#endif
#ifndef P_EPOTD
#define P_EPOTD 3
#endif
#ifndef P_ATTACK
#define P_ATTACK 1
#endif
#ifndef P_EXTRA
#define P_EXTRA 0.0
#endif
#ifndef P_MAXDN
#define P_MAXDN 20
#endif
#ifndef P_MAXDE
#define P_MAXDE 20
#endif
#ifndef P_INB
#define P_INB 1
#endif
#ifndef P_SAVEG
#define P_SAVEG 0
#endif
#ifndef P_SAVE
#define P_SAVE 0
#endif
#ifndef P_DEFEG
#define P_DEFEG 0.0
#endif
#ifndef P_DEFM
#define P_DEFM 0.0
#endif
#ifndef P_EGROWTH
#define P_EGROWTH 0.0
#endif
#ifndef P_BORDER
#define P_BORDER 0
#endif
#ifndef P_FLOWFRAC
#define P_FLOWFRAC 1.0
#endif
#ifndef P_EVAC
#define P_EVAC 1
#endif
#ifndef P_MARGINN
#define P_MARGINN 0.0
#endif
#ifndef P_CONTEST
#define P_CONTEST 1.0
#endif
#ifndef P_SCORE
#define P_SCORE 0
#endif
#ifndef P_LOCAL
#define P_LOCAL 0
#endif
    double kNeutral = P_NEUTRAL;
    double kEnemy = P_ENEMY;
    double kDistDecay = P_DECAY;
    double kThreatW = P_THREATW;
    int    kMinGarr = P_MINGARR;
    double kReserveFrac = P_RESERVEFRAC;
    double kEpot = P_EPOT;
    double kAtkMargin = P_MARGIN;
    bool   kUseFlow = P_FLOW != 0;
    bool   kAssume = P_ASSUME != 0;
    int    kMaxD = P_MAXD;
    int    kEpotD = P_EPOTD;
    int    kFlowMode = P_FLOW;
    bool   kUseFlowFlag = P_FLOW != 0;
    bool   kAttack = P_ATTACK != 0;
    double kExtra = P_EXTRA;
    int    kScoreMode = P_SCORE;
    double kContest = P_CONTEST;
    double kAtkMarginN = P_MARGINN;
    bool   kEvac = P_EVAC != 0;
    double kFlowFrac = P_FLOWFRAC;
    int    kBorder = P_BORDER;
    double kEGrowth = P_EGROWTH;
    double kDefEG = P_DEFEG;
    int    kSave = P_SAVE;
    int    kSaveG = P_SAVEG;
    bool   kInb = P_INB != 0;
    double kDefM = P_DEFM;
    int    kMaxDNeutral = P_MAXDN;
    int    kMaxDEnemy = P_MAXDE;
    int    kLocal = P_LOCAL;

    void setup(const State& s) {
        n = (int)s.nodes.size();
        T = s.turn;
        MT = s.max_turns;
        for (int i = 0; i < n; ++i) {
            g[i] = s.nodes[i].growth;
            for (int j = 0; j < n; ++j) dst[i][j] = s.dist[i][j];
            arr[i].clear();
            remain[i] = (s.nodes[i].owner == 1) ? s.nodes[i].troops : 0;
            reserve[i] = 0;
        }
        if (T == 1) {
            enemyHome = -1;
            for (int i = 0; i < n; ++i)
                if (s.nodes[i].owner == 2) enemyHome = i;
        }
        if (enemyHome < 0) enemyHome = 1;
        for (int i = 0; i < n; ++i) {
            hasInb[i] = 0;
            for (int t = 0; t < MAXT; ++t) inb[i][t] = 0;
        }
        for (const auto& f : s.fleets) {
            int a = T + f.turns_left - 1;
            if (a <= MT) {
                arr[f.to].push_back({a, f.owner, f.troops});
                if (f.owner == 1) { inb[f.to][a] = 1; hasInb[f.to] = 1; }
            }
        }
        out.clear();
    }

    void computeReserve(const State& s) {        for (int i = 0; i < n; ++i) {
            if (s.nodes[i].owner != 1) continue;
            double threat = 0.0;
            for (int j = 0; j < n; ++j) {
                if (s.nodes[j].owner != 2) continue;
                int d = dst[i][j];
                double w = 0.0;
                if (d <= 2) w = 0.9;
                else if (d == 3) w = 0.6;
                else if (d == 4) w = 0.35;
                else if (d == 5) w = 0.15;
                threat += s.nodes[j].troops * w;
            }
            int r = (int)(threat * kThreatW);
            r = std::max(r, kMinGarr);
            r = std::max(r, (int)(s.nodes[i].troops * kReserveFrac));
            reserve[i] = std::min(r, s.nodes[i].troops);
        }
    }

    void predict(const State& s) {
        for (int i = 0; i < n; ++i) {
            int owner = s.nodes[i].owner;
            int tr = s.nodes[i].troops;
            for (int t = T; t <= MT; ++t) {
                pOwn[i][t] = owner;
                pTr[i][t] = tr;
                if (owner) tr += g[i];
                int sums[3] = {0, 0, 0};
                bool part[3] = {false, false, false};
                sums[owner] += tr;
                part[owner] = true;
                for (const auto& x : arr[i]) {
                    if (x.turn == t) {
                        sums[x.owner] += x.troops;
                        part[x.owner] = true;
                    }
                }
                int bestO = -1, bestV = -1, secO = -1, secV = -1;
                for (int k = 0; k < 3; ++k) {
                    if (!part[k]) continue;
                    if (sums[k] > bestV) {
                        secV = bestV; secO = bestO;
                        bestV = sums[k]; bestO = k;
                    } else if (sums[k] > secV) {
                        secV = sums[k]; secO = k;
                    }
                }
                if (secO < 0) { owner = bestO; tr = bestV; }
                else if (bestV == secV) { tr = 0; }
                else { owner = bestO; tr = bestV - secV; }
                if (T == DBG_TURN && i == DBG_TARGET)
                    DBG("  pred t=%d own=%d tr=%d (before growth %d)\n", t, pOwn[i][t], pTr[i][t], owner);
            }
        }
    }

    // Same simulation, but our own fleets in transit are ignored entirely.
    void predictPess(const State& s) {
        for (int i = 0; i < n; ++i) {
            int owner = s.nodes[i].owner;
            int tr = s.nodes[i].troops;
            for (int t = T; t <= MT; ++t) {
                qOwn[i][t] = owner;
                qTr[i][t] = tr;
                if (owner) tr += g[i];
                int sums[3] = {0, 0, 0};
                bool part[3] = {false, false, false};
                sums[owner] += tr;
                part[owner] = true;
                for (const auto& x : arr[i]) {
                    if (x.turn == t && x.owner == 2) {
                        sums[2] += x.troops;
                        part[2] = true;
                    }
                }
                int bestO = -1, bestV = -1, secO = -1, secV = -1;
                for (int k = 0; k < 3; ++k) {
                    if (!part[k]) continue;
                    if (sums[k] > bestV) {
                        secV = bestV; secO = bestO;
                        bestV = sums[k]; bestO = k;
                    } else if (sums[k] > secV) {
                        secV = sums[k]; secO = k;
                    }
                }
                if (secO < 0) { owner = bestO; tr = bestV; }
                else if (bestV == secV) { tr = 0; }
                else { owner = bestO; tr = bestV - secV; }
            }
        }
    }

    void battleAt(int i, int a, int& other, int& mine) {
        int sums[3] = {0, 0, 0};
        bool part[3] = {false, false, false};
        int bo = pOwn[i][a];
        int bt = pTr[i][a] + (bo ? g[i] : 0);
        sums[bo] += bt;
        part[bo] = true;
        for (const auto& x : arr[i]) {
            if (x.turn == a) {
                sums[x.owner] += x.troops;
                part[x.owner] = true;
            }
        }
        other = 0;
        if (part[0]) other = std::max(other, sums[0]);
        if (part[2]) other = std::max(other, sums[2]);
        mine = part[1] ? sums[1] : 0;
    }

    // Pessimistic evaluation for attacking target i, arriving end of turn a:
    // node evolves as if our own fleets in transit do not exist at all.
    // our same-turn arrivals still count as attackers; other arrivals are ignored.
    void battleAtPess(int i, int a, int& other, int& mine) {
        int sums[3] = {0, 0, 0};
        bool part[3] = {false, false, false};
        int bo = qOwn[i][a];
        int bt = qTr[i][a] + (bo ? g[i] : 0);
        sums[bo] += bt;
        part[bo] = true;
        for (const auto& x : arr[i]) {
            if (x.turn != a) continue;
            if (x.owner == 2) {
                sums[2] += x.troops;
                part[2] = true;
            } else if (x.owner == 1) {
                sums[1] += x.troops;
                part[1] = true;
            }
        }
        other = 0;
        if (part[0]) other = std::max(other, sums[0]);
        if (part[2]) other = std::max(other, sums[2]);
        mine = part[1] ? sums[1] : 0;
    }

    void send(int from, int to, int troops) {
        if (troops <= 0 || troops > remain[from]) return;
        remain[from] -= troops;
        out.push_back({from, to, troops});
    }

    void planDefense(const State& s) {
        for (int i = 0; i < n; ++i) {
            if (s.nodes[i].owner != 1) continue;
            int battleTurn = -1, deficit = 0;
            for (int a = T; a <= MT; ++a) {
                if (pOwn[i][a] != 1) break;
                int sums[3] = {0, 0, 0};
                bool part[3] = {false, false, false};
                int base = pTr[i][a] + g[i];
                sums[1] += base; part[1] = true;
                for (const auto& x : arr[i]) {
                    if (x.turn == a) {
                        sums[x.owner] += x.troops;
                        part[x.owner] = true;
                    }
                }
                int other = 0;
                if (part[0]) other = std::max(other, sums[0]);
                if (part[2]) other = std::max(other, sums[2]);
                if (other > sums[1]) {
                    battleTurn = a;
                    deficit = other - sums[1] + 1;
                    if (kDefEG > 0.0) {
                        double eg = 0.0;
                        int travel = battleTurn - T;
                        for (int q = 0; q < n; ++q) if (s.nodes[q].owner == 2) { int dd = dst[q][i]; if (dd <= travel) eg += g[q]; }
                        deficit += (int)(eg * travel * kDefEG);
                    }
                    deficit = (int)std::ceil(deficit * (1.0 + kDefM));
                    break;
                }
            }
            if (battleTurn < 0) continue;
            int maxD = battleTurn - T + 1;
            struct Src { int j, d, r; };
            std::vector<Src> src;
            int total = 0;
            for (int j = 0; j < n; ++j) {
                if (j == i || s.nodes[j].owner != 1 || remain[j] <= 0) continue;
                int d = dst[j][i];
                if (d <= maxD) { src.push_back({j, d, remain[j]}); total += remain[j]; }
            }
            if (total >= deficit) {
                std::sort(src.begin(), src.end(), [](const Src& x, const Src& y) {
                    return x.r > y.r;
                });
                int need = deficit;
                for (const auto& x : src) {
                    if (need <= 0) break;
                    int take = std::min(need, x.r);
                    send(x.j, i, take);
                    need -= take;
                }
            } else if (kEvac && battleTurn - T <= 3) {
                int best = -1, bestScore = -INF;
                for (int j = 0; j < n; ++j) {
                    if (j == i || s.nodes[j].owner != 1) continue;
                    bool doomed = false;
                    for (int a = T; a <= MT; ++a) if (pOwn[j][a] != 1) { doomed = true; break; }
                    if (doomed) continue;
                    int near = 100;
                    for (int k = 0; k < n; ++k) if (s.nodes[k].owner == 2) near = std::min(near, dst[j][k]);
                    int sc = near * 1000 - dst[j][i];
                    if (sc > bestScore) { bestScore = sc; best = j; }
                }
                if (best >= 0) send(i, best, remain[i]);
            }
        }
    }

    void planStrongLike(const State& s) {
        int pot[MAXN];
        for (int j = 0; j < n; ++j)
            pot[j] = (s.nodes[j].owner == 1) ? dst[j][enemyHome] : INF;
        int order[MAXN];
        for (int j = 0; j < n; ++j) order[j] = j;
        std::sort(order, order + n, [&](int a, int b) { return pot[a] > pot[b]; });
        for (int oi = 0; oi < n; ++oi) {
            int j = order[oi];
            if (s.nodes[j].owner != 1) continue;
            int surplus = remain[j] - 1;
            if (surplus <= 0) continue;
            double bestScore = -1e18, bestAny = -1e18;
            int bestTgt = -1, bestReq = 0, anyTgt = -1;
            for (int i = 0; i < n; ++i) {
                if (s.nodes[i].owner == 1) continue;
                int d = dst[j][i];
                int a = T + d - 1;
                if (a > MT) continue;
                if (kInb && hasInb[i] && !inb[i][a]) continue;
                if (pOwn[i][a] == 1) continue;
                int other, mine;
                battleAtPess(i, a, other, mine);
                int req = other - mine + 1;
                if (req <= 0) continue;
                double val = (double)g[i] * (double)(MT - a + 1) *
                             (s.nodes[i].owner == 2 ? kEnemy : kNeutral);
                double rr = (double)req + 2.0;
                double score;
                if (kScoreMode == 0) score = val / rr;
                else if (kScoreMode == 1) score = val / std::sqrt(rr);
                else if (kScoreMode == 2) score = val - req;
                else if (kScoreMode == 5) score = -(double)(a - T) * 1000.0 + (double)g[i] * 2.0 - (double)req * 0.01;
                else score = val / std::pow(rr, 0.3);
                score /= (1.0 + kDistDecay * (a - T));
                // score *= contest;
                if (score > bestAny) { bestAny = score; anyTgt = i; }
                if (req <= surplus && score > bestScore) { bestScore = score; bestTgt = i; bestReq = req; }
            }
            if (bestTgt >= 0) {
                send(j, bestTgt, bestReq);
                surplus -= bestReq;
            }
            if (surplus <= 0) continue;
            int k = -1, bd = INF;
            for (int q = 0; q < n; ++q) {
                if (q == j || s.nodes[q].owner != 1) continue;
                if (pot[q] >= pot[j]) continue;
                if (dst[j][q] < bd) { bd = dst[j][q]; k = q; }
            }
            if (k >= 0) send(j, k, surplus);
            else if (anyTgt >= 0) send(j, anyTgt, surplus);
        }
    }

    void planOffenseLocal(const State& s) {
        std::vector<char> taken(n, 0);
        for (int j = 0; j < n; ++j) {
            if (s.nodes[j].owner != 1) continue;
            int spare = remain[j] - reserve[j];
            if (spare <= 0) continue;
            double bestScore = -1e18;
            int bestTgt = -1, bestReq = 0;
            for (int i = 0; i < n; ++i) {
                if (s.nodes[i].owner == 1 || taken[i]) continue;
                if (!kAttack && s.nodes[i].owner == 2) continue;
                int d = dst[j][i];
                if (d > kMaxD) continue;
                int a = T + d - 1;
                if (a > MT) continue;
                if (kInb && hasInb[i] && !inb[i][a]) continue;
                if (pOwn[i][a] == 1) continue;
                int other, mine;
                battleAtPess(i, a, other, mine);
                int req = other - mine + 1;
                if (req <= 0) continue;
                req = (int)std::ceil(req * (1.0 + (s.nodes[i].owner == 2 ? kAtkMargin : kAtkMarginN)));
                if (req > spare) continue;
                double val = (double)g[i] * (double)(MT - a + 1) *
                             (s.nodes[i].owner == 2 ? kEnemy : kNeutral);
                double rr = (double)req + 2.0;
                double score;
                if (kScoreMode == 0) score = val / rr;
                else if (kScoreMode == 1) score = val / std::sqrt(rr);
                else if (kScoreMode == 2) score = val - req;
                else if (kScoreMode == 5) score = -(double)(a - T) * 1000.0 + (double)g[i] * 2.0 - (double)req * 0.01;
                else score = val / std::pow(rr, 0.3);
                score /= (1.0 + kDistDecay * (a - T));
                // score *= contest;
                if (score > bestScore) { bestScore = score; bestTgt = i; bestReq = req; }
            }
            if (bestTgt >= 0) {
                send(j, bestTgt, bestReq);
                taken[bestTgt] = 1;
            }
        }
    }

    void planOffense(const State& s) {
        std::vector<Mission> ms;
        for (int i = 0; i < n; ++i) {
            if (s.nodes[i].owner == 1) continue;
            if (!kAttack && s.nodes[i].owner == 2) continue;
            for (int a = T + 1; a <= MT; ++a) {
                int d = a - T + 1;
                if (d > (s.nodes[i].owner == 2 ? kMaxDEnemy : kMaxDNeutral)) break;
                if (kInb && hasInb[i] && !inb[i][a]) continue;
                int total = 0;
                for (int j = 0; j < n; ++j) {
                    if (s.nodes[j].owner != 1 || dst[j][i] != d) continue;
                    int sp = remain[j] - reserve[j];
                    if (sp > 0) total += sp;
                }
                if (total <= 0) continue;
                if (pOwn[i][a] == 1) continue;
                int other, mine;
                battleAtPess(i, a, other, mine);
                bool assumeEnemy = false;
                double contest = 1.0;
                int eArr = INF;
                if (qOwn[i][a] == 0) {
                    // if an enemy can arrive clearly earlier, they are likely to take it
                    int neutralTr = qTr[i][a];
                    for (int j = 0; j < n; ++j) {
                        if (s.nodes[j].owner != 2) continue;
                        int ea = T + dst[j][i] - 1;
                        if (ea >= a) continue;
                        if (s.nodes[j].troops <= neutralTr) continue;
                        if (ea < eArr) eArr = ea;
                    }
                    if (eArr < a) {
                        if (kAssume) {
                            assumeEnemy = true;
                            other = 1 + g[i] * (a - eArr);
                        } else {
                            contest = kContest;
                        }
                    }
                }
                if (!kAssume) assumeEnemy = false;
                int req = other - mine + 1;
                if (kEpot > 0.0 && (s.nodes[i].owner == 2 || assumeEnemy)) {
                    int travel = a - T + 1;
                    double ep = 0.0;
                    for (int j = 0; j < n; ++j) {
                        if (j == i || s.nodes[j].owner != 2) continue;
                        int dd = dst[j][i];
                        if (dd <= travel) ep += s.nodes[j].troops;
                    }
                    req += (int)(ep * kEpot);
                }
                if (kEGrowth > 0.0 && s.nodes[i].owner == 2) {
                    double grow = 0.0;
                    int travel = a - T + 1;
                    for (int q = 0; q < n; ++q) if (s.nodes[q].owner == 2) { int dd = dst[q][i]; if (dd <= travel) grow += g[q]; }
                    req += (int)(grow * travel * kEGrowth);
                }
                if (req <= 0) continue;
                req = (int)std::ceil(req * (1.0 + (s.nodes[i].owner == 2 ? kAtkMargin : kAtkMarginN)));
                if (T == DBG_TURN && i == DBG_TARGET)
                    DBG("t%d target %d a=%d d=%d pOwn=%d pTr=%d other=%d mine=%d req=%d total=%d\n",
                        T, i, a, d, pOwn[i][a], pTr[i][a], other, mine, req, total);
                if (total < req) continue;
                double val = (double)g[i] * (double)(MT - a + 1) *
                             (s.nodes[i].owner == 2 ? kEnemy : (assumeEnemy ? kEnemy : kNeutral));
                double score;
                double rr = (double)req + 2.0;
                if (kScoreMode == 0) score = val / rr;
                else if (kScoreMode == 1) score = val / std::sqrt(rr);
                else if (kScoreMode == 2) score = val - req;
                else if (kScoreMode == 5) score = -(double)(a - T) * 1000.0 + (double)g[i] * 2.0 - (double)req * 0.01;
                else score = val / std::pow(rr, 0.3);
                score /= (1.0 + kDistDecay * (a - T));
                score *= contest;
                ms.push_back({i, a, req, score});
            }
        }
        std::sort(ms.begin(), ms.end(), [](const Mission& x, const Mission& y) {
            return x.score > y.score;
        });
        if (T == DBG_TURN) {
            DBG("=== t%d %d missions\n", T, (int)ms.size());
            for (const auto& m : ms) {
                DBG("  cand tgt=%d a=%d req=%d score=%.1f\n", m.target, m.arrive, m.req, m.score);
            }
            for (int j = 0; j < n; ++j) if (s.nodes[j].owner == 1)
                DBG("  node %d tr=%d reserve=%d remain=%d\n", j, s.nodes[j].troops, reserve[j], remain[j]);
        }
        std::vector<char> taken(n, 0);
        for (const auto& m : ms) {
            if (taken[m.target]) continue;
            int d = m.arrive - T + 1;
            std::vector<std::pair<int, int>> src;
            int total = 0;
            for (int j = 0; j < n; ++j) {
                if (s.nodes[j].owner != 1 || dst[j][m.target] != d) continue;
                int sp = remain[j] - reserve[j];
                if (sp > 0) { src.push_back({sp, j}); total += sp; }
            }
            if (total < m.req) continue;
            std::sort(src.begin(), src.end(), [](const std::pair<int, int>& x, const std::pair<int, int>& y) {
                return x.first > y.first;
            });
            int need = m.req;
            for (const auto& p : src) {
                if (need <= 0) break;
                int take = std::min(need, p.first);
                send(p.second, m.target, take);
                need -= take;
            }
            taken[m.target] = 1;
        }
    }

    void planLogistics(const State& s) {
        if (!kUseFlow) return;
        int pot[MAXN];
        for (int j = 0; j < n; ++j) {
            pot[j] = INF;
            if (s.nodes[j].owner != 1) continue;
            if (kFlowMode == 1) {
                for (int i = 0; i < n; ++i) {
                    if (s.nodes[i].owner == 1) continue;
                    pot[j] = std::min(pot[j], dst[j][i]);
                }
            } else {
                pot[j] = dst[j][enemyHome];
            }
        }
        // process rear nodes first so a single turn can move several hops
        int order[MAXN];
        for (int j = 0; j < n; ++j) order[j] = j;
        std::sort(order, order + n, [&](int a, int b) { return pot[a] > pot[b]; });
        for (int oi = 0; oi < n; ++oi) {
            int j = order[oi];
            if (s.nodes[j].owner != 1) continue;
            if (kSaveG > 0) {
                bool save = false;
                for (int q = 0; q < n; ++q) if (s.nodes[q].owner == 0) {
                    int dd = dst[j][q];
                    if (dd > 8) continue;
                    int need = s.nodes[q].troops + 1;
                    if (need <= remain[j] + g[j] * kSaveG) { save = true; break; }
                }
                if (save) continue;
            }
            if (kSave > 0) { bool nearN = false; for (int q = 0; q < n; ++q) if (s.nodes[q].owner == 0 && dst[j][q] <= kSave) { nearN = true; break; } if (nearN) continue; }
            if (kBorder > 0) { bool nearE = false; for (int q = 0; q < n; ++q) if (s.nodes[q].owner == 2 && dst[j][q] <= kBorder) { nearE = true; break; } if (nearE) continue; }
            int spare = (int)((remain[j] - reserve[j]) * kFlowFrac);
            if (spare <= 0) continue;
            if (spare > remain[j]) spare = remain[j];
            int best = -1, bestVal = INF;
            for (int k = 0; k < n; ++k) {
                if (k == j || s.nodes[k].owner != 1) continue;
                if (pot[k] >= pot[j]) continue;
                int v = (kFlowMode == 3) ? (dst[j][k] * 1000 + pot[k]) : (pot[k] * 10 + dst[j][k]);
                if (v < bestVal) { bestVal = v; best = k; }
            }
            if (best >= 0) send(j, best, spare);
        }
    }

    std::vector<Order> decide(const State& s) {
        setup(s);
        computeReserve(s);
        predict(s);
        predictPess(s);
        planDefense(s);
        if (kLocal == 3) planStrongLike(s); else if (kLocal == 1) planOffenseLocal(s);
        else planOffense(s);
        planLogistics(s);
        return out;
    }
};

Bot g_bot;

}  // namespace

std::vector<Order> decide(const State& s) { return g_bot.decide(s); }
