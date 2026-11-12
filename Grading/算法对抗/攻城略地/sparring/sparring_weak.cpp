// 攻城略地 弱陪练（sparring_weak）
// 来源：上一版强陪练的代码，只把下面的前瞻旋钮调到 5（看得近、反应慢），打法本身没改。
// 打法：规则 + 局部打分，不做对局树搜索。
//  1. 时间线：按路上全部部队（含本回合已决定派出的）逐回合推演每个节点未来的归属和兵力。
//  2. 可用兵力：每个己方节点只派出不影响自身安全的部分——既要扛住已知来袭部队，
//     也要扛住附近敌方节点可能的突袭（扣除己方邻近节点的支援能力）。
//  3. 统一的目标评估：对每个不稳归己方的节点（中立、敌方、将要失守的己方节点）和每个到达回合，
//     算出最少兵力，多点按距离由近到远凑兵；按“双方总兵力差”记账估价值
//     （打中立要付出守军，与敌交战双方等量损耗，节点增长只计有限回合），
//     按 价值 /（兵力 × 在途回合）择优，反复执行直到没有正收益的计划。
//     抢夺（敌方刚打下的中立）、防守、反攻都由同一套估值自然得出。
//  4. 打下的中立或敌方节点要扛得住敌方随后几回合的抢夺/反扑，不够就多带兵，带不起就不打。
//  5. 余下的兵从后方节点向前线输送。
// 不用随机数，不看剩余时间，计算量固定，同一局面总是给出同样的命令。
#include "engine.hpp"
#include <algorithm>
#include <cstring>
#include <vector>

// ===================== 强弱旋钮 =====================
// LOOKAHEAD：前瞻回合数——时间线推演、目标到达回合、守住检查和威胁评估都只看未来 LOOKAHEAD 个回合，
// 路程超过它的目标看不见，更远的来袭部队要等进入这个范围才会应对。调大变强，调小变弱，有效范围 2–32。
// 本程序取 5。实测实力值（正式五档实力值 0/233/374/581/825，第 1 档记 0；对五档各 96 局）：
//   开发图 100000–100095 上：8 约 540，7 约 480，6 约 410，5 约 270，4 约 10（4 以下几乎打不出去）；
//   32 在开发图 100800–100895 上约 500。5 与 4 之间落差很大，没有中间档。
// 交付复核（开发图 100800–100895，对五档各 96 局）：5 为 214，对第 1–5 档分别得 62/45/30/13/10 分。
static constexpr int LOOKAHEAD = 5;
// ====================================================

namespace {

constexpr int HMAX = 32;            // 时间线数组长度上限
constexpr int VALUE_HORIZON = 30;   // 节点增长收益最多计多少回合
constexpr int THREAT_WINDOW = 6;    // 评估敌方对己方节点潜在突袭的回合窗口
constexpr int SNIPE_WINDOW = 4;     // 打下中立节点后，评估敌方抢夺的回合窗口
constexpr int ATTACK_WINDOW = 4;    // 打下敌方节点后，评估敌方反扑的回合窗口
constexpr int THREAT_PCT = 100;     // 敌方节点兵力计入潜在威胁的比例（%）
constexpr int SUPPORT_PCT = 100;    // 己方邻近节点兵力计入支援能力的比例（%）
constexpr int MAX_PLANS = 24;       // 每回合最多执行的计划数
constexpr int TIME_BIAS = 5;        // 打分时在途回合数的平移量（越小越偏好近处目标）

struct Arr { int k, owner, troops; };
struct Piece { int src, k, troops; };
struct TL { int ow[HMAX + 1]; int tr[HMAX + 1]; };

const State* S = nullptr;
int n = 0, H = 0, R = 0;
std::vector<std::vector<Arr>> arr;   // 每个节点的到达（已知部队 + 本回合计划）
std::vector<int> cur;                // 本回合扣除计划出兵后的节点兵力（仅己方节点有意义）
std::vector<int> avail;              // 还能派出的兵力
std::vector<Order> out;

inline int D(int a, int b) { return S->dist[a][b]; }

// 一次到达结算：sum/part 为各方到达的部队，ow/tr 为节点当前归属和兵力（已加增长）。
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

void runTL(int i, int start, const std::vector<Piece>* ex, TL& tl) {
    static Buckets b;
    fill(i, ex, b);
    int ow = S->nodes[i].owner, tr = start;
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
    int ow = S->nodes[i].owner, tr = (ow == 1 ? cur[i] : S->nodes[i].troops);
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

// 敌方在第 t 回合（相对本回合）可能压到节点 i 的兵力，减去己方届时能支援的兵力。
// delay 为敌方出发前的反应回合数（对己方新派出的部队做出反应时为 1）；己方看到敌军再支援，要再晚 1 回合。
int threatGap(int i, int t, int delay) {
    long long ep = 0, mp = 0;
    for (int e = 0; e < n; ++e) {
        if (e == i) continue;
        const Node& p = S->nodes[e];
        const int d = D(e, i);
        if (p.owner == 2 && d <= t - delay) ep += p.troops + (long long)p.growth * (t - delay - d);
        else if (p.owner == 1 && d <= t - delay - 1) mp += cur[e] + (long long)p.growth * (t - delay - 1 - d);
    }
    return (int)(ep * THREAT_PCT / 100 - mp * SUPPORT_PCT / 100);
}

void computeAvail() {
    for (int j = 0; j < n; ++j) {
        avail[j] = 0;
        if (S->nodes[j].owner != 1) continue;
        TL tl;
        runTL(j, cur[j], nullptr, tl);
        // 已知来袭：出兵 x 会让之后每个回合的兵力都少 x（守住期间是线性的）。
        int cap = cur[j];
        bool lost = false;
        for (int k = 1; k <= H; ++k) {
            if (tl.ow[k] != 1) { lost = true; break; }
            cap = std::min(cap, tl.tr[k]);
        }
        for (const auto& a : arr[j])
            if (a.owner == 2 && a.k >= 1 && a.k <= H) cap = std::min(cap, tl.tr[a.k] - 1);
        if (lost) continue;
        // 潜在突袭。
        const int W = std::min(H, THREAT_WINDOW);
        for (int t = 1; t <= W; ++t) cap = std::min(cap, tl.tr[t] - threatGap(j, t, 0));
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
bool allocate(int i, int k, int amount, std::vector<Piece>& pieces, std::vector<int>& left) {
    if (amount <= 0) return true;
    static std::vector<int> order;
    order.clear();
    for (int j = 0; j < n; ++j)
        if (j != i && left[j] > 0 && S->nodes[j].owner == 1 && D(j, i) <= k) order.push_back(j);
    std::sort(order.begin(), order.end(), [&](int a, int b) {
        return D(a, i) != D(b, i) ? D(a, i) < D(b, i) : a < b;
    });
    for (int j : order) {
        if (amount <= 0) break;
        const int take = std::min(left[j], amount);
        bool merged = false;
        for (auto& p : pieces) if (p.src == j) { p.troops += take; merged = true; break; }
        if (!merged) pieces.push_back({j, D(j, i), take});
        left[j] -= take; amount -= take;
    }
    return amount <= 0;
}

void evaluate(int i, const TL& base, Plan& best) {
    const Node& node = S->nodes[i];
    // 候选到达回合：各可派兵节点到 i 的路程。
    bool seen[HMAX + 1] = {};
    for (int j = 0; j < n; ++j)
        if (j != i && avail[j] > 0 && D(j, i) <= H) seen[D(j, i)] = true;
    for (int k = 1; k <= H; ++k) {
        if (!seen[k]) continue;
        const int need = needWith(i, k, nullptr);
        if (need <= 0) continue;
        std::vector<int> left = avail;
        std::vector<Piece> pieces;
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
        TL plan;
        runTL(i, node.owner == 1 ? cur[i] : node.troops, &pieces, plan);
        bool held = true;
        for (int t = kc; t <= H; ++t) if (plan.ow[t] != 1) { held = false; break; }
        if (!held) continue;
        // 从中立或敌方手里夺下的节点：要扛住敌方随后的抢夺/反扑，不够就多带兵。
        // （增援仍归己方的节点不在此列。）
        if (base.ow[k0 - 1] != 1) {
            const int W = std::min(H, kc + (base.ow[k0 - 1] == 0 ? SNIPE_WINDOW : ATTACK_WINDOW));
            int deficit = 0;
            for (int t = kc; t <= W; ++t) deficit = std::max(deficit, threatGap(i, t, 1) - plan.tr[t] + 1);
            if (deficit > 0) {
                if (!allocate(i, kc, deficit, pieces, left)) continue;
                runTL(i, node.owner == 1 ? cur[i] : node.troops, &pieces, plan);
            }
        }
        int sent = 0;
        for (const auto& p : pieces) sent += p.troops;
        const int Ve = std::min(R, std::max(H, kc + VALUE_HORIZON));
        long long value = (long long)signedAt(plan, H) - signedAt(base, H) - sent
                        + (long long)node.growth * (Ve - H) * (sgn(plan.ow[H]) - sgn(base.ow[H]));
        if (value <= 0) continue;
        // 价值 / (兵力 × 在途回合)：同样的兵力，越早回本越好。
        // 用整数交叉相乘比较 value/cost，结果与浮点舍入无关。
        const long long cost = (long long)(sent + 5) * (kc + TIME_BIAS);
        if (best.target < 0 || value * best.cost > best.value * cost) {
            best.target = i; best.pieces = pieces; best.cost = cost; best.value = value;
        }
    }
}

void logistics() {
    std::vector<int> front(n, 1 << 20);
    bool enemy = false;
    for (int e = 0; e < n; ++e) if (S->nodes[e].owner == 2) enemy = true;
    if (!enemy) return;
    for (int m = 0; m < n; ++m) {
        if (S->nodes[m].owner != 1) continue;
        for (int e = 0; e < n; ++e) if (S->nodes[e].owner == 2) front[m] = std::min(front[m], D(m, e));
    }
    for (int j = 0; j < n; ++j) {
        if (S->nodes[j].owner != 1 || avail[j] <= 0) continue;
        int to = -1, bestCost = 1 << 20;
        for (int m = 0; m < n; ++m) {
            if (m == j || S->nodes[m].owner != 1 || front[m] >= front[j]) continue;
            const int c = D(j, m) + front[m];
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
    n = (int)s.nodes.size();
    R = s.max_turns - s.turn + 1;
    H = std::max(1, std::min({HMAX, LOOKAHEAD, R}));
    arr.assign(n, {});
    for (const auto& f : s.fleets)
        if (f.to >= 0 && f.to < n && f.turns_left >= 1) arr[f.to].push_back({f.turns_left, f.owner, f.troops});
    cur.assign(n, 0);
    for (int i = 0; i < n; ++i) cur[i] = s.nodes[i].troops;
    avail.assign(n, 0);
    out.clear();

    computeAvail();

    std::vector<TL> base(n);
    for (int i = 0; i < n; ++i) runTL(i, s.nodes[i].owner == 1 ? cur[i] : s.nodes[i].troops, nullptr, base[i]);
    auto unsafe = [&](int i) {
        for (int k = 0; k <= H; ++k) if (base[i].ow[k] != 1) return true;
        return false;
    };
    for (int round = 0; round < MAX_PLANS; ++round) {
        Plan best;
        for (int i = 0; i < n; ++i) if (unsafe(i)) evaluate(i, base[i], best);
        if (best.target < 0) break;
        const int i = best.target;
        for (const auto& p : best.pieces) {
            out.push_back({p.src, i, p.troops});
            cur[p.src] -= p.troops;
            avail[p.src] -= p.troops;
            arr[i].push_back({p.k, 1, p.troops});
        }
        runTL(i, s.nodes[i].owner == 1 ? cur[i] : s.nodes[i].troops, nullptr, base[i]);
    }

    logistics();
    return out;
}
