// 攻城略地 强陪练（sparring_strong）
//
// 打法：规则 + 局部打分，不做对局树搜索，每回合约 0.1–0.5 毫秒。
//  1. 时间线：按路上全部部队（含本回合已决定派出的）逐回合推演每个节点未来的归属和兵力。
//  2. 势力表：对每个节点 i 和未来回合 t，算出双方最多能有多少兵在第 t 回合前压到 i
//     （按各节点时间线取兵力，出发越晚兵越多；敌方看到我方部队后晚 1 回合反应，我方再晚 1 回合）。
//     记账时敌方势力足额计入，己方支援只按 SUPPORT_PCT 的比例计入，并扣掉本计划自己带走的兵。
//  3. 可用兵力：己方节点只派出不影响自身安全的部分——扛住已知来袭部队，
//     也扛住附近敌方势力在 THREAT_WINDOW 回合内的突袭（扣除打折后的己方支援）。
//  4. 统一的目标评估：对每个不稳归己方的节点（中立、敌方、将要失守的己方节点）和每个到达回合，
//     算出最少兵力，多点按距离由近到远凑兵；夺下的节点要扛得住敌方随后 HOLD_WINDOW 回合内的
//     抢夺/反扑，不够就多带兵，带不起就不打。按“双方总兵力差”记账估价值
//     （打中立要付出守军，与敌交战双方等量损耗，节点增长只计有限回合），
//     按 价值 /（兵力 × 在途回合）择优，反复执行直到没有正收益的计划。
//     抢夺（敌方刚打下的中立）、防守、反攻都由同一套估值自然得出。
//  5. 终局预计要输时（剩余回合不多、按当前兵力和增长推算落后），己方支援按足额计入、
//     反扑窗口缩短，敢于冒险出兵。
//  6. 余下的兵从后方节点向前线输送。
// 不用随机数，不看剩余时间，计算量固定，同一局面总是给出同样的命令。
#include "engine.hpp"
#include <algorithm>
#include <cstring>
#include <vector>

// ===================== 强弱旋钮 =====================
// LOOKAHEAD：前瞻回合数——时间线推演、目标到达回合、留守和反扑检查都只看未来 LOOKAHEAD 个回合。
// 调大变强，调小变弱；有效范围 2–32，默认 32 就是最强设置，只能往弱调。
// 实测实力值（正式五档实力值 0/233/374/581/825，第 1 档记 0；开发图 100000–100095，对五档各 96 局）：
//   32 约 707，16 约 692，12 约 641，8 约 581（与第 4 档相当）。
// 交付复核（开发图 100800–100895，对五档各 96 局）：32 为 727，对第 1–5 档分别胜 96/91/78/67/40 局。
static constexpr int LOOKAHEAD = 32;
// ====================================================

namespace {

constexpr int HMAX = 32;            // 时间线数组长度上限
constexpr int MAXN = 32;            // 节点数上限（题面为 16–24）
constexpr int SUPPORT_PCT = 60;     // 己方支援计入的比例（%）
constexpr int HOLD_WINDOW = 4;      // 夺下节点后检查敌方抢夺/反扑的回合窗口
constexpr int THREAT_WINDOW = 6;    // 己方节点留守时考虑敌方突袭的回合窗口
constexpr int VALUE_HORIZON = 30;   // 节点增长收益最多计多少回合
constexpr int TIME_BIAS = 5;        // 打分时在途回合数的平移量（越小越偏好近处目标）
constexpr int SENT_BIAS = 5;        // 打分时兵力的平移量
constexpr int MAX_PLANS = 24;       // 每回合最多执行的计划数
constexpr int LOSE_TURNS = 80;      // 剩余回合不超过此值且推算落后时进入冒险模式
constexpr int LOSE_SUPPORT_PCT = 100;
constexpr int LOSE_HOLD_WINDOW = 2;

struct Arr { int k, owner, troops; };
struct Piece { int src, k, troops; };
struct TL { int ow[HMAX + 1]; int tr[HMAX + 1]; };

const State* S = nullptr;
int n = 0, H = 0, R = 0;
int supportPct = SUPPORT_PCT, holdWindow = HOLD_WINDOW;
int dd[MAXN][MAXN];
std::vector<Arr> arr[MAXN];          // 每个节点的到达（已知部队 + 本回合计划）
int cur[MAXN], avail[MAXN];          // 本回合扣除出兵后的兵力（仅己方节点）、还能派出的兵力
TL base[MAXN];                       // 各节点在已有部队和本回合计划下的时间线
int pmEn[2][MAXN][HMAX + 1], pmOwn[2][MAXN][HMAX + 1];
int epT[2][MAXN][HMAX + 1], mpT[2][MAXN][HMAX + 1];
std::vector<Order> out;

inline int startTroops(int i) { return S->nodes[i].owner == 1 ? cur[i] : S->nodes[i].troops; }

// 一次到达结算：s0/p0 为各方到达的部队，ow/tr 为节点当前归属和兵力（已加增长）。
inline void resolve(const int* s0, const bool* p0, int& ow, int& tr) {
    int s[3] = {s0[0], s0[1], s0[2]};
    bool p[3] = {p0[0], p0[1], p0[2]};
    s[ow] += tr; p[ow] = true;
    int best = -1, second = -1;
    for (int q = 0; q < 3; ++q) {
        if (!p[q]) continue;
        if (best < 0 || s[q] > s[best]) { second = best; best = q; }
        else if (second < 0 || s[q] > s[second]) second = q;
    }
    const int top = s[best], sec = second >= 0 ? s[second] : 0;
    if (second >= 0 && top == sec) tr = 0;
    else { ow = best; tr = top - sec; }
}

struct Buckets {
    int s[HMAX + 2][3];
    bool p[HMAX + 2][3];
};

void fill(int i, const std::vector<Piece>* ex, Buckets& b) {
    std::memset(&b, 0, sizeof(b));
    for (const auto& a : arr[i]) if (a.k >= 1 && a.k <= H) { b.s[a.k][a.owner] += a.troops; b.p[a.k][a.owner] = true; }
    if (ex) for (const auto& q : *ex) if (q.k >= 1 && q.k <= H) { b.s[q.k][1] += q.troops; b.p[q.k][1] = true; }
}

inline bool any(const Buckets& b, int k) { return b.p[k][0] || b.p[k][1] || b.p[k][2]; }

void runTL(int i, const std::vector<Piece>* ex, TL& tl) {
    static Buckets b;
    fill(i, ex, b);
    int ow = S->nodes[i].owner, tr = startTroops(i);
    const int g = S->nodes[i].growth;
    tl.ow[0] = ow; tl.tr[0] = tr;
    for (int k = 1; k <= H; ++k) {
        if (ow) tr += g;
        if (any(b, k)) resolve(b.s[k], b.p[k], ow, tr);
        tl.ow[k] = ow; tl.tr[k] = tr;
    }
}

// 在已有到达（含 ex）之外，第 k 回合再到达多少己方兵力，才能让节点 i 从第 k 回合起一直归己方到 H。
int needWith(int i, int k, const std::vector<Piece>* ex) {
    static Buckets b;
    fill(i, ex, b);
    int ow = S->nodes[i].owner, tr = startTroops(i);
    const int g = S->nodes[i].growth;
    for (int t = 1; t < k; ++t) {
        if (ow) tr += g;
        if (any(b, t)) resolve(b.s[t], b.p[t], ow, tr);
    }
    int x = 0;
    for (int t = k; t <= H; ++t) {
        if (ow) tr += g;
        if (t == k) {
            int s[3] = {b.s[t][0], b.s[t][1], b.s[t][2]};
            bool p[3] = {b.p[t][0], b.p[t][1], b.p[t][2]};
            s[ow] += tr; p[ow] = true;
            int other = -1;
            for (int q = 0; q < 3; ++q) if (q != 1 && p[q]) other = std::max(other, s[q]);
            if (other < 0) { ow = 1; tr = s[1]; continue; }
            if (s[1] <= other) x = other - s[1] + 1;
            ow = 1; tr = s[1] + x - other;
        } else if (any(b, t)) {
            const int my = tr + b.s[t][1];
            if (!b.p[t][2]) { tr = my; continue; }
            const int other = b.s[t][2];
            int add = 0;
            if (my <= other) add = other - my + 1;
            x += add;
            tr = my + add - other;
        }
    }
    return x;
}

inline int signedAt(const TL& tl, int k) {
    return tl.ow[k] == 1 ? tl.tr[k] : (tl.ow[k] == 2 ? -tl.tr[k] : 0);
}
inline int sgn(int ow) { return ow == 1 ? 1 : (ow == 2 ? -1 : 0); }

// 势力表。pmEn[d][e][r]：敌方在第 d..r 回合之间从节点 e 出发时最多能带的兵；
// pmOwn[d][m][r]：己方在第 d+1..r 回合之间从 m 出发时最多能带的兵（己方晚 1 回合反应）。
// epT[d][i][t] / mpT[d][i][t]：第 t 回合前双方能压到节点 i 的兵力上限（不含 i 本身）。
// d = 0 用于己方节点留守（敌方本回合就能出发），d = 1 用于夺点后的反扑（敌方看到我方部队后才出发）。
void refreshPotentials() {
    for (int e = 0; e < n; ++e)
        for (int d = 0; d < 2; ++d) {
            int me = 0, mo = 0;
            for (int r = 0; r <= H; ++r) {
                if (r >= d) { const int v = base[e].ow[r] == 2 ? base[e].tr[r] : 0; if (v > me) me = v; }
                if (r >= d + 1) { const int v = base[e].ow[r] == 1 ? base[e].tr[r] : 0; if (v > mo) mo = v; }
                pmEn[d][e][r] = me;
                pmOwn[d][e][r] = mo;
            }
        }
    for (int d = 0; d < 2; ++d)
        for (int i = 0; i < n; ++i)
            for (int t = 0; t <= H; ++t) {
                int ep = 0, mp = 0;
                for (int e = 0; e < n; ++e) {
                    if (e == i) continue;
                    const int r = t - dd[e][i];
                    if (r >= d) ep += pmEn[d][e][r];
                    if (r >= d + 1) mp += pmOwn[d][e][r];
                }
                epT[d][i][t] = ep;
                mpT[d][i][t] = mp;
            }
}

void computeAvail() {
    for (int j = 0; j < n; ++j) {
        avail[j] = 0;
        if (S->nodes[j].owner != 1) continue;
        const TL& tl = base[j];
        // 已知来袭：出兵 x 会让之后每个回合的兵力都少 x（守住期间是线性的）。
        int cap = cur[j];
        bool lost = false;
        for (int k = 1; k <= H; ++k) {
            if (tl.ow[k] != 1) { lost = true; break; }
            cap = std::min(cap, tl.tr[k]);
        }
        if (lost) continue;
        for (const auto& a : arr[j])
            if (a.owner == 2 && a.k >= 1 && a.k <= H) cap = std::min(cap, tl.tr[a.k] - 1);
        // 潜在突袭：敌方势力足额，己方支援打折。
        const int W = std::min(H, THREAT_WINDOW);
        for (int t = 1; t <= W; ++t) {
            const long long gap = (long long)epT[0][j][t] - (long long)mpT[0][j][t] * supportPct / 100;
            if (gap > 0) cap = (int)std::min<long long>(cap, tl.tr[t] - gap);
        }
        avail[j] = std::max(0, std::min(cap, cur[j]));
    }
}

struct Plan {
    int target = -1;
    std::vector<Piece> pieces;
    long long cost = 1;
    long long value = 0;
};

// 按距离由近到远从可派兵节点凑出 amount 兵力，到达不晚于 k。
bool allocate(int i, int k, int amount, std::vector<Piece>& pieces, int* left) {
    if (amount <= 0) return true;
    int order[MAXN], m = 0;
    for (int j = 0; j < n; ++j)
        if (j != i && left[j] > 0 && S->nodes[j].owner == 1 && dd[j][i] <= k) order[m++] = j;
    std::sort(order, order + m, [&](int a, int b) {
        return dd[a][i] != dd[b][i] ? dd[a][i] < dd[b][i] : a < b;
    });
    for (int q = 0; q < m && amount > 0; ++q) {
        const int j = order[q];
        const int take = std::min(left[j], amount);
        bool merged = false;
        for (auto& p : pieces) if (p.src == j) { p.troops += take; merged = true; break; }
        if (!merged) pieces.push_back({j, dd[j][i], take});
        left[j] -= take; amount -= take;
    }
    return amount <= 0;
}

// 夺下节点 i 之后（kc 起 holdWindow 个回合内），敌方势力减去打折的己方支援（扣掉本计划带走的兵），超出守军的部分。
int deficitOf(int i, int kc, const TL& plan, const std::vector<Piece>& pieces) {
    const int W = std::min(H, kc + holdWindow);
    long long def = 0;
    for (int t = kc; t <= W; ++t) {
        long long mp = mpT[1][i][t];
        for (const auto& p : pieces) if (t - dd[p.src][i] >= 2) mp -= p.troops;
        if (mp < 0) mp = 0;
        const long long gap = (long long)epT[1][i][t] - mp * supportPct / 100 - plan.tr[t] + 1;
        if (gap > def) def = gap;
    }
    return (int)def;
}

void evaluate(int i, Plan& best) {
    const Node& node = S->nodes[i];
    const TL& bs = base[i];
    // 候选到达回合：各可派兵节点到 i 的路程。
    bool cand[HMAX + 2] = {};
    for (int j = 0; j < n; ++j)
        if (j != i && avail[j] > 0 && S->nodes[j].owner == 1 && dd[j][i] <= H) cand[dd[j][i]] = true;
    static std::vector<Piece> pieces;
    int left[MAXN];
    TL plan;
    for (int k = 1; k <= H; ++k) {
        if (!cand[k]) continue;
        const int need = needWith(i, k, nullptr);
        if (need <= 0) continue;
        std::copy(avail, avail + n, left);
        pieces.clear();
        if (!allocate(i, k, need, pieces, left)) continue;
        // 多点出兵到达时间不同，补足差额。
        bool ok = false;
        for (int it = 0; it < 3; ++it) {
            const int extra = needWith(i, k, &pieces);
            if (extra <= 0) { ok = true; break; }
            if (!allocate(i, k, extra, pieces, left)) break;
        }
        if (!ok) continue;
        int kc = 0, k0 = H;
        for (const auto& p : pieces) { kc = std::max(kc, p.k); k0 = std::min(k0, p.k); }
        runTL(i, &pieces, plan);
        bool held = true;
        for (int t = kc; t <= H; ++t) if (plan.ow[t] != 1) { held = false; break; }
        if (!held) continue;
        // 从中立或敌方手里夺下的节点：要扛住敌方随后的抢夺/反扑，不够就多带兵。
        // 带进去的兵从支援里移到守军里，支援打了折，所以补的兵按 1/(1 - 折扣) 放大。
        if (bs.ow[k0 - 1] != 1) {
            bool safe = false;
            for (int it = 0; it < 4; ++it) {
                const int def = deficitOf(i, kc, plan, pieces);
                if (def <= 0) { safe = true; break; }
                const int add = supportPct < 100 ? (def * 100 + (100 - supportPct) - 1) / (100 - supportPct) : def;
                if (!allocate(i, kc, std::max(def, std::min(add, def * 4)), pieces, left)) break;
                runTL(i, &pieces, plan);
            }
            if (!safe) continue;
        }
        int sent = 0;
        for (const auto& p : pieces) sent += p.troops;
        const int Ve = std::min(R, std::max(H, kc + VALUE_HORIZON));
        const long long value = (long long)signedAt(plan, H) - signedAt(bs, H) - sent
                              + (long long)node.growth * (Ve - H) * (sgn(plan.ow[H]) - sgn(bs.ow[H]));
        if (value <= 0) continue;
        // 价值 / (兵力 × 在途回合)：同样的兵力，越早回本越好。整数交叉相乘比较。
        const long long cost = (long long)(sent + SENT_BIAS) * (kc + TIME_BIAS);
        if (best.target < 0 || value * best.cost > best.value * cost) {
            best.target = i; best.pieces = pieces; best.cost = cost; best.value = value;
        }
    }
}

void execute(const Plan& p) {
    const int i = p.target;
    for (const auto& q : p.pieces) {
        out.push_back({q.src, i, q.troops});
        cur[q.src] -= q.troops;
        avail[q.src] -= q.troops;
        arr[i].push_back({q.k, 1, q.troops});
    }
    runTL(i, nullptr, base[i]);
    for (const auto& q : p.pieces) runTL(q.src, nullptr, base[q.src]);
    refreshPotentials();
}

void logistics() {
    int front[MAXN];
    bool enemy = false;
    for (int e = 0; e < n; ++e) if (S->nodes[e].owner == 2) enemy = true;
    if (!enemy) return;
    for (int m = 0; m < n; ++m) {
        front[m] = 1 << 20;
        if (S->nodes[m].owner != 1) continue;
        for (int e = 0; e < n; ++e) if (S->nodes[e].owner == 2) front[m] = std::min(front[m], dd[m][e]);
    }
    for (int j = 0; j < n; ++j) {
        if (S->nodes[j].owner != 1 || avail[j] <= 0) continue;
        int to = -1, bestCost = 1 << 20;
        for (int m = 0; m < n; ++m) {
            if (m == j || S->nodes[m].owner != 1 || front[m] >= front[j]) continue;
            const int c = dd[j][m] + front[m];
            if (c < bestCost) { bestCost = c; to = m; }
        }
        if (to < 0) continue;
        out.push_back({j, to, avail[j]});
        cur[j] -= avail[j];
        avail[j] = 0;
    }
}

}  // namespace

std::vector<Order> decide(const State& s) {
    S = &s;
    n = std::min((int)s.nodes.size(), MAXN);
    R = s.max_turns - s.turn + 1;
    H = std::max(1, std::min({HMAX, LOOKAHEAD, R}));
    for (int i = 0; i < n; ++i)
        for (int j = 0; j < n; ++j) dd[i][j] = s.dist[i][j];
    for (int i = 0; i < n; ++i) arr[i].clear();
    long long tot[3] = {0, 0, 0}, gr[3] = {0, 0, 0};
    for (const auto& f : s.fleets) {
        if (f.owner < 1 || f.owner > 2) continue;
        tot[f.owner] += f.troops;
        if (f.to >= 0 && f.to < n && f.turns_left >= 1) arr[f.to].push_back({f.turns_left, f.owner, f.troops});
    }
    for (int i = 0; i < n; ++i) {
        const Node& p = s.nodes[i];
        cur[i] = p.owner == 1 ? p.troops : 0;
        avail[i] = 0;
        tot[p.owner] += p.troops;
        gr[p.owner] += p.growth;
    }
    out.clear();

    // 终局推算落后时放宽安全余量。
    const long long proj = tot[1] - tot[2] + (gr[1] - gr[2]) * (long long)R;
    const bool losing = R <= LOSE_TURNS && proj < 0;
    supportPct = losing ? LOSE_SUPPORT_PCT : SUPPORT_PCT;
    holdWindow = losing ? LOSE_HOLD_WINDOW : HOLD_WINDOW;

    for (int i = 0; i < n; ++i) runTL(i, nullptr, base[i]);
    refreshPotentials();
    computeAvail();

    auto unsafe = [&](int i) {
        for (int k = 0; k <= H; ++k) if (base[i].ow[k] != 1) return true;
        return false;
    };
    for (int round = 0; round < MAX_PLANS; ++round) {
        Plan best;
        for (int i = 0; i < n; ++i) if (unsafe(i)) evaluate(i, best);
        if (best.target < 0) break;
        execute(best);
    }

    logistics();
    return out;
}
