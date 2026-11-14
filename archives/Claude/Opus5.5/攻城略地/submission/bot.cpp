#include "engine.hpp"
#include <algorithm>
#include <cstring>
#include <vector>
#include <cmath>
using namespace std;

#ifndef P_RHO
#define P_RHO 1.0      // weight of enemy potential for own-node safety
#endif
#ifndef P_RHOT
#define P_RHOT 1.0     // weight of enemy potential for target safety
#endif
#ifndef P_RHOA
#define P_RHOA 1.0     // weight of enemy reinforcement potential before arrival (attacks)
#endif
#ifndef P_T1
#define P_T1 0.2       // assumed fraction of enemy home troops kept at turn 1
#endif
#ifndef P_XCAP
#define P_XCAP 1.0
#endif
#ifndef P_MU
#define P_MU 0.3
#endif
#ifndef P_SLACK
#define P_SLACK 2
#endif
#ifndef P_LAM
#define P_LAM 0.0
#endif
#ifndef P_PRO
#define P_PRO 1.0
#endif
#ifndef P_PROD
#define P_PROD 8
#endif
#ifndef P_TP
#define P_TP 25
#endif

namespace {
constexpr int MAXN = 24, HMAX = 64, TPM = 40;
int N, H, curTurn, remain;
int D[MAXN][MAXN], G[MAXN];
int own0[MAXN], tr0[MAXN];
int add_[MAXN][HMAX + 2][3];
bool inited = false;

struct TL { int ow[HMAX + 2]; int tr[HMAX + 2]; };

void simNode(int i, int o, int t, int horizon, TL& out) {
    out.ow[0] = o; out.tr[0] = t;
    for (int k = 1; k <= horizon; k++) {
        if (o) t += G[i];
        int a1 = add_[i][k][1], a2 = add_[i][k][2];
        if (a1 || a2) {
            int s[3] = {0, 0, 0}; bool p[3] = {false, false, false};
            s[o] = t; p[o] = true;
            if (a1) { s[1] += a1; p[1] = true; }
            if (a2) { s[2] += a2; p[2] = true; }
            int best = -1, sec = -1;
            for (int q = 0; q < 3; q++) if (p[q]) {
                if (best < 0 || s[q] > s[best]) { sec = best; best = q; }
                else if (sec < 0 || s[q] > s[sec]) sec = q;
            }
            if (sec >= 0 && s[best] == s[sec]) t = 0;
            else { o = best; t = s[best] - (sec >= 0 ? s[sec] : 0); }
        }
        out.ow[k] = o; out.tr[k] = t;
    }
}

int needAt(int i, int T, int cap, int holdTo) {
    TL tl;
    auto ok = [&](int x) {
        add_[i][T][1] += x;
        simNode(i, own0[i], tr0[i], holdTo, tl);
        add_[i][T][1] -= x;
        for (int k = T; k <= holdTo; k++) if (tl.ow[k] != 1) return false;
        return true;
    };
    if (cap < 0) return -1;
    if (!ok(cap)) return -1;
    if (ok(0)) return 0;
    int lo = 0, hi = cap;
    while (hi - lo > 1) {
        int m = (lo + hi) / 2;
        if (ok(m)) hi = m; else lo = m;
    }
    return hi;
}

}  // namespace

vector<Order> decide(const State& s) {
    if (!inited) {
        inited = true;
        N = (int)s.nodes.size();
        for (int i = 0; i < N; i++) {
            G[i] = s.nodes[i].growth;
            for (int j = 0; j < N; j++) D[i][j] = s.dist[i][j];
        }
    }
    curTurn = s.turn;
    remain = s.max_turns - s.turn + 1;
    H = min(HMAX, remain);
    const int TP = P_TP;
    memset(add_, 0, sizeof(add_));
    for (int i = 0; i < N; i++) { own0[i] = s.nodes[i].owner; tr0[i] = s.nodes[i].troops; }
    for (auto& f : s.fleets) if (f.turns_left <= HMAX) add_[f.to][f.turns_left][f.owner] += f.troops;

    vector<Order> orders;
    static TL tl[MAXN];
    auto recompute = [&](int i) { simNode(i, own0[i], tr0[i], H, tl[i]); };
    for (int i = 0; i < N; i++) recompute(i);

    bool anyEnemyNode = false;
    for (int i = 0; i < N; i++) if (own0[i] == 2) anyEnemyNode = true;

    double enT[MAXN];
    for (int i = 0; i < N; i++) enT[i] = (own0[i] == 2) ? tr0[i] : 0;
    if (curTurn == 1) for (int i = 0; i < N; i++) if (own0[i] == 2) enT[i] *= P_T1;

    // EP[x][t]: enemy potential force arriving at x by t (launch now or wait for growth)
    static double EP[MAXN][TPM + 1];
    for (int x = 0; x < N; x++) for (int t = 0; t <= TP; t++) {
        double v = 0, mx = 0;
        for (int e = 0; e < N; e++) if (e != x && own0[e] == 2 && D[e][x] <= t) {
            double c = enT[e] + G[e] * (t - D[e][x]);
            v += c; mx = max(mx, c);
        }
        EP[x][t] = mx + P_LAM * (v - mx);
    }
    // MP[x][t]: my potential with one-turn reaction lag
    static double MP[MAXN][TPM + 1];
    for (int x = 0; x < N; x++) for (int t = 0; t <= TP; t++) {
        double v = 0;
        for (int k = 0; k < N; k++) if (k != x && own0[k] == 1 && D[k][x] + 1 <= t) v += tr0[k] + G[k] * (t - 1 - D[k][x]);
        MP[x][t] = v;
    }

    int nearEnemy[MAXN];
    for (int i = 0; i < N; i++) {
        nearEnemy[i] = 99;
        for (int j = 0; j < N; j++) if (j != i && own0[j] == 2) nearEnemy[i] = min(nearEnemy[i], D[j][i]);
    }

    int avail[MAXN];
    double marginA[MAXN];
    for (int i = 0; i < N; i++) {
        avail[i] = 0; marginA[i] = 1e18;
        if (own0[i] != 1) continue;
        int m = tr0[i];
        bool lost = false;
        for (int k = 0; k <= H; k++) {
            if (tl[i].ow[k] != 1) { lost = true; break; }
            m = min(m, tl[i].tr[k]);
        }
        if (lost) continue;
        double mg = 1e18;
        if (anyEnemyNode) for (int t = 1; t <= TP && t <= H; t++) mg = min(mg, tl[i].tr[t] + MP[i][t] - P_RHO * EP[i][t]);
        marginA[i] = mg;
        avail[i] = max(0, (int)floor(min<double>(mg, m)));
    }

    auto send = [&](int from, int to, int x) {
        if (x <= 0) return;
        orders.push_back({from, to, x});
        tr0[from] -= x;
        avail[from] -= x;
        int d = D[from][to];
        if (d <= HMAX) add_[to][d][1] += x;
        recompute(from);
        recompute(to);
    };

    // ---------- defense against known incoming
    {
        vector<int> mine;
        for (int i = 0; i < N; i++) if (own0[i] == 1) mine.push_back(i);
        sort(mine.begin(), mine.end(), [&](int a, int b) { return G[a] > G[b]; });
        for (int i : mine) {
            int tf = -1;
            for (int k = 1; k <= H; k++) if (tl[i].ow[k] != 1) { tf = k; break; }
            if (tf < 0) continue;
            vector<int> helpers;
            for (int j = 0; j < N; j++) if (j != i && own0[j] == 1 && avail[j] > 0 && D[j][i] <= tf) helpers.push_back(j);
            sort(helpers.begin(), helpers.end(), [&](int a, int b) { return D[a][i] < D[b][i]; });
            vector<pair<int, int>> plan;
            bool okk = false;
            for (int j : helpers) {
                int T = D[j][i];
                int x = needAt(i, T, avail[j], H);
                if (x >= 0) { plan.push_back({j, x}); add_[i][T][1] += x; okk = true; break; }
                plan.push_back({j, avail[j]});
                add_[i][T][1] += avail[j];
            }
            for (auto& pr : plan) add_[i][D[pr.first][i]][1] -= pr.second;
            if (okk) for (auto& pr : plan) send(pr.first, i, pr.second);
        }
    }

    // ---------- proactive reinforcement of nodes with negative margin
    if (P_PRO > 0 && anyEnemyNode) {
        vector<int> needy;
        for (int i = 0; i < N; i++) if (own0[i] == 1 && marginA[i] < 0 && marginA[i] > -1e17) needy.push_back(i);
        sort(needy.begin(), needy.end(), [&](int a, int b) { return marginA[a] < marginA[b]; });
        for (int x : needy) {
            double need = -marginA[x] * P_PRO;
            int hs[MAXN], nh = 0;
            for (int k = 0; k < N; k++) if (k != x && own0[k] == 1 && avail[k] > 0 && D[k][x] <= P_PROD) hs[nh++] = k;
            sort(hs, hs + nh, [&](int a, int b) { return D[a][x] < D[b][x]; });
            for (int a = 0; a < nh && need > 0; a++) {
                int k = hs[a];
                int amt = min(avail[k], (int)ceil(need));
                send(k, x, amt);
                need -= amt;
            }
        }
    }

    // ---------- target planning
    for (int iter = 0; iter < 40; iter++) {
        double bestScore = 0; int bx = -1, bT = -1, bneed = 0; bool bwait = false;
        int bsrcs[MAXN], bns = 0;
        for (int x = 0; x < N; x++) {
            if (tl[x].ow[H] == 1) continue;
            int srcs[MAXN], ns = 0;
            for (int j = 0; j < N; j++) if (j != x && own0[j] == 1 && avail[j] > 0) srcs[ns++] = j;
            if (!ns) continue;
            sort(srcs, srcs + ns, [&](int a, int b) { return D[a][x] < D[b][x]; });
            bool enemyInvolved = (own0[x] == 2);
            for (int k = 1; k <= H; k++) if (add_[x][k][2]) enemyInvolved = true;
            int maxT = min(remain - 1, min(D[srcs[ns - 1]][x], D[srcs[0]][x] + P_SLACK));
            int sumAv = 0, q = 0;
            double bestLocal = 0; int lT = -1, lneed = 0;
            for (int T = D[srcs[0]][x]; T <= maxT && T <= HMAX - 12; T++) {
                while (q < ns && D[srcs[q]][x] <= T) sumAv += avail[srcs[q++]];
                if (sumAv <= 0) continue;
                int holdTo = min(H, T + 10);
                int need = needAt(x, T, sumAv, holdTo);
                if (need < 0) continue;
                int ownerBefore = tl[x].ow[T - 1];
                int oppTroops = tl[x].tr[T - 1];
                double reinf = 0;
                if (ownerBefore == 2 || enemyInvolved) {
                    for (int e = 0; e < N; e++) if (e != x && own0[e] == 2 && D[e][x] <= T - 1)
                        reinf += enT[e] + G[e] * (T - 1 - D[e][x]);
                    reinf *= P_RHOA;
                }
                int needR = need + (int)ceil(reinf);
                if (needR > sumAv) continue;
                double extra = 0;
                if (anyEnemyNode) {
                    add_[x][T][1] += needR;
                    TL t2; simNode(x, own0[x], tr0[x], min(H, TP), t2);
                    add_[x][T][1] -= needR;
                    for (int t = T + 1; t <= min(H, TP); t++) {
                        if (t2.ow[t] != 1) { extra = 1e9; break; }
                        double mp = max(0.0, MP[x][t] - needR);
                        double def = t2.tr[t] + mp - P_RHOT * EP[x][t];
                        if (def < 0) extra = max(extra, -def);
                    }
                }
                if (extra > P_XCAP * need + 5) continue;
                int total = needR + (int)ceil(extra);
                if (total > sumAv) continue;
                int R = remain - T;
                double mult = (ownerBefore == 2) ? 2.0 : 1.0;
                double gain = G[x] * (double)R * mult;
                double destroyed = (ownerBefore == 0) ? (double)min(oppTroops, need) : 0.0;
                if (gain - destroyed <= 0) continue;
                double sc = G[x] * mult / (destroyed + 1.0 + G[x] * T + P_MU * (total - destroyed));
                if (own0[x] == 1) sc *= 1.5;
                if (sc > bestLocal) { bestLocal = sc; lT = T; lneed = total; }
                if (!enemyInvolved) break;
            }
            if (lT < 0) continue;
            if (bestLocal > bestScore) {
                bestScore = bestLocal; bx = x; bT = lT; bneed = lneed; bwait = enemyInvolved;
                bns = 0;
                for (int a = 0; a < ns; a++) if (D[srcs[a]][x] <= lT) bsrcs[bns++] = srcs[a];
            }
        }
        if (bx < 0) break;
        sort(bsrcs, bsrcs + bns, [&](int a, int b) { return D[a][bx] > D[b][bx]; });
        int rem = bneed;
        for (int a = 0; a < bns && rem > 0; a++) {
            int j = bsrcs[a];
            int take = min(rem, avail[j]);
            if (take <= 0) continue;
            rem -= take;
            if (bwait && D[j][bx] < bT) avail[j] -= take;  // reserve: launch later
            else send(j, bx, take);
        }
    }

    // ---------- redistribution to front
    if (anyEnemyNode && remain > 10) {
        for (int i = 0; i < N; i++) if (own0[i] == 1 && avail[i] > 0) {
            int best = -1;
            for (int k = 0; k < N; k++) if (k != i && own0[k] == 1 && tl[k].ow[H] == 1) {
                if (nearEnemy[k] < nearEnemy[i] && D[i][k] + nearEnemy[k] <= nearEnemy[i] + 3) {
                    if (best < 0 || D[i][k] < D[i][best] ||
                        (D[i][k] == D[i][best] && nearEnemy[k] < nearEnemy[best])) best = k;
                }
            }
            if (best >= 0) send(i, best, avail[i]);
        }
    }
    return orders;
}
