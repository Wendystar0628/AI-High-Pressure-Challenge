// Hidden test circuit generator for 通用数字电路仿真器加速.
// Usage: gen_hidden <family> <seed> [p1 [p2 [p3]]] > input.txt
// Families: deep | wide | multiplier | cipher | control | regfile | pipeline | soc
// Optional structure parameters; omitting them gives the defaults in brackets and reproduces the
// earlier inputs of every family byte for byte:
//   deep        p1 = window of recent gates the inputs are drawn from                  [64]
//   wide        p1 = number of levels                                               [40]
//   multiplier  p1 = operand width of the array multipliers (2..32)                 [16]
//   cipher      p1 = minimal number of rounds; a block has p1 .. p1+6 rounds         [6]
//   control     p1 = select bits of the multiplexer tree and of the decoder (1..8)  [5]
//   regfile     p1 = address bits: 2^p1 registers of 4096 >> p1 bits (6..9)         [7]
//               p2 = write ports (1..32)                                            [16]
//   pipeline    p1 = number of stages; each writes min(448, 8192 / p1) flip-flops   [16]
//   soc         p1 p2 p3 = cumulative percentages of multiplier, cipher and control
//               blocks; the rest are random logic blocks                            [25 50 70]
// Build: g++ -O2 -std=c++20 -o gen_hidden.exe gen_hidden.cpp
//
// Every circuit has exactly the sizes below. Every gate has a structural path to a flip-flop
// or a primary output, and every flip-flop feeds an XOR output fold. This is structural
// reachability, not a claim that Boolean simplification cannot remove gates.
#include <algorithm>
#include <array>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <random>
#include <string>
#include <utility>
#include <vector>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif
using namespace std;
typedef uint64_t u64;
typedef vector<int> W;  // a word: list of signal ids

enum { AND, OR, XOR, NAND, NOR, XNOR, NOT, MUX };
static const char* NAMES[] = {"AND", "OR", "XOR", "NAND", "NOR", "XNOR", "NOT", "MUX"};
static int nin(int t) { return t == NOT ? 1 : (t == MUX ? 3 : 2); }

static const int I = 64, F = 8192, G = 500000, O = 64, M = 4096, T = 512;
static const int BASE_FF = 2 + I, BASE_G = BASE_FF + F;
static const int CONST0 = 0;
static const int FOLD = F / O;                 // flip-flops folded into each primary output
static const int OUTFOLD = O * (FOLD - 1);     // XOR gates used by the output folds
static const int RESERVE = 40000;              // gates left for the finishing pass
static const int MAIN = G - OUTFOLD - RESERVE; // target size of the family-specific part

struct Gen {
    mt19937_64 rng;
    vector<long long> par;        // optional structure parameters from the command line
    vector<array<int, 4>> gates;  // creation order; a gate's signal id is BASE_G + creation index
    vector<int> uses;             // fan-out count per gate
    vector<int> pool;             // candidates for "unused gate" picks (lazily cleaned)
    int unused = 0;               // number of gates with no fan-out yet
    vector<int> ffd = vector<int>(F, -1);
    int unsetFF = F;
    vector<int> outs;
    explicit Gen(u64 s, vector<long long> p) : rng(s), par(std::move(p)) {}
    // Structure parameter k (0-based): `def` when omitted, otherwise it must lie in [lo, hi].
    long long param(size_t k, long long def, long long lo, long long hi, const char* what) const {
        if (k >= par.size()) return def;
        if (par[k] < lo || par[k] > hi) {
            fprintf(stderr, "%s must be in [%lld,%lld]\n", what, lo, hi);
            exit(1);
        }
        return par[k];
    }

    u64 r(u64 n) { return rng() % n; }
    bool chance(int percent) { return (int)r(100) < percent; }
    int count() const { return (int)gates.size(); }
    static int gs(int c) { return BASE_G + c; }
    static int pi(int i) { return 2 + i; }
    static int ff(int f) { return BASE_FF + f; }

    void use(int s) {
        if (s >= BASE_G && uses[s - BASE_G]++ == 0) unused--;
    }
    int add(int t, int a, int b = -1, int c = -1) {
        gates.push_back({t, a, b, c});
        uses.push_back(0);
        unused++;
        pool.push_back(count() - 1);
        use(a);
        if (b >= 0) use(b);
        if (c >= 0) use(c);
        return gs(count() - 1);
    }
    void setFF(int f, int s) {
        ffd[f] = s;
        use(s);
        unsetFF--;
    }
    int takeUnused() {
        while (!pool.empty()) {
            size_t k = r(pool.size());
            int c = pool[k];
            pool[k] = pool.back();
            pool.pop_back();
            if (uses[c] == 0) return gs(c);
        }
        return -1;
    }
    int source() { return (int)(2 + r(I + F)); }
    int randType() {
        int x = (int)r(100);
        return x < 13 ? AND : x < 26 ? OR : x < 42 ? XOR : x < 55 ? NAND : x < 68 ? NOR : x < 84 ? XNOR : x < 92 ? NOT : MUX;
    }
    template <class P>
    int addRandom(P pick) {
        int t = randType();
        int a = pick(), b = nin(t) >= 2 ? pick() : -1, c = nin(t) == 3 ? pick() : -1;
        return add(t, a, b, c);
    }
    // Prefer a not-yet-used gate (keeps every gate live); otherwise fall back.
    template <class P>
    int preferUnused(int percent, P fallback) {
        if (chance(percent)) {
            int u = takeUnused();
            if (u >= 0) return u;
        }
        return fallback();
    }

    // ---------- word-level building blocks ----------
    W ffWord(int width) {  // aligned group of flip-flops
        int base = width * (int)r(F / width);
        W w(width);
        for (int i = 0; i < width; i++) w[i] = ff(base + i);
        return w;
    }
    W piWord(int width) {
        int base = (int)r(I - width + 1);
        W w(width);
        for (int i = 0; i < width; i++) w[i] = pi(base + i);
        return w;
    }
    W operand(int width, int unusedPercent) {  // from unused gates, flip-flops or primary inputs
        if (chance(unusedPercent)) {
            W w;
            for (int i = 0; i < width; i++) {
                int u = takeUnused();
                if (u < 0) break;
                w.push_back(u);
            }
            if ((int)w.size() == width) return w;
            for (int i = (int)w.size(); i < width; i++) w.push_back(source());
            return w;
        }
        return chance(70) ? ffWord(width) : piWord(min(width, I));
    }
    W widen(W w, int width) {
        while ((int)w.size() < width) w.push_back(source());
        return w;
    }
    W adder(const W& a, const W& b) {  // ripple carry, returns a+b (same width)
        W s(a.size());
        int c = CONST0;
        for (size_t i = 0; i < a.size(); i++) {
            int t1 = add(XOR, a[i], b[i]);
            if (i == 0) {
                s[i] = t1;
                c = add(AND, a[i], b[i]);
                continue;
            }
            s[i] = add(XOR, t1, c);
            if (i + 1 < a.size()) c = add(OR, add(AND, a[i], b[i]), add(AND, t1, c));
        }
        return s;
    }
    W xorWords(const W& a, const W& b) {
        W s(a.size());
        for (size_t i = 0; i < a.size(); i++) s[i] = add(XOR, a[i], b[i]);
        return s;
    }
    W muxWords(int sel, const W& a, const W& b) {
        W s(a.size());
        for (size_t i = 0; i < a.size(); i++) s[i] = add(MUX, sel, a[i], b[i]);
        return s;
    }
    W multiplier(const W& a, const W& b) {  // w x w array multiplier, 2w-bit product
        const int w = (int)a.size();
        vector<vector<int>> pp(w, vector<int>(w));
        for (int i = 0; i < w; i++)
            for (int j = 0; j < w; j++) pp[i][j] = add(AND, a[j], b[i]);
        W acc(2 * w, CONST0);
        for (int j = 0; j < w; j++) acc[j] = pp[0][j];
        for (int i = 1; i < w; i++) {
            int c = -1;
            for (int j = 0; j < w; j++) {
                int k = i + j, x = acc[k], y = pp[i][j];
                if (j == 0) {
                    acc[k] = add(XOR, x, y);
                    c = add(AND, x, y);
                } else {
                    int t1 = add(XOR, x, y);
                    acc[k] = add(XOR, t1, c);
                    c = add(OR, add(AND, x, y), add(AND, t1, c));
                }
            }
            acc[i + w] = c;
        }
        return acc;
    }
    W sbox4(const W& x) {  // random 4-bit nonlinear layer: each output is a chain of 5 gates
        W y(4);
        for (int o = 0; o < 4; o++) {
            W nodes = x;
            for (int g = 0; g < 5; g++) {
                int t = randType();
                if (t == NOT) t = XNOR;
                int a = nodes.back();
                int b = nodes[r(nodes.size() - 1)], c = nodes[r(nodes.size() - 1)];
                nodes.push_back(add(t, a, b, t == MUX ? c : -1));
            }
            y[o] = nodes.back();
        }
        return y;
    }
    W cipherRound(const W& st, const W& key, const vector<int>& perm) {
        W x = xorWords(st, key), s(64), p(64), y(64);
        for (int b = 0; b < 16; b++) {
            W v = sbox4(W(x.begin() + 4 * b, x.begin() + 4 * b + 4));
            for (int i = 0; i < 4; i++) s[4 * b + i] = v[i];
        }
        for (int i = 0; i < 64; i++) p[perm[i]] = s[i];
        for (int i = 0; i < 64; i++) y[i] = add(XOR, add(XOR, p[i], p[(i + 1) % 64]), p[(i + 13) % 64]);
        return y;
    }
    W muxTree(const W& idx, const vector<W>& ops) {  // ops.size() == 2^idx.size()
        vector<W> level = ops;
        for (size_t b = 0; b < idx.size(); b++) {
            vector<W> nxt;
            for (size_t k = 0; k + 1 < level.size(); k += 2) nxt.push_back(muxWords(idx[b], level[k], level[k + 1]));
            level.swap(nxt);
        }
        return level[0];
    }
    int lessThan(const W& a, const W& b) {  // borrow chain of a - b
        int borrow = CONST0;
        for (size_t i = 0; i < a.size(); i++) {
            int na = add(NOT, a[i]);
            int gen = add(AND, na, b[i]);
            int keep = add(XNOR, a[i], b[i]);
            borrow = i == 0 ? gen : add(OR, gen, add(AND, keep, borrow));
        }
        return borrow;
    }
    int equal(const W& a, const W& b) {
        W e(a.size());
        for (size_t i = 0; i < a.size(); i++) e[i] = add(XNOR, a[i], b[i]);
        while (e.size() > 1) {
            W n;
            for (size_t i = 0; i + 1 < e.size(); i += 2) n.push_back(add(AND, e[i], e[i + 1]));
            if (e.size() % 2) n.push_back(e.back());
            e.swap(n);
        }
        return e[0];
    }
    W decoder(const W& idx) {  // 2^k one-hot lines
        int k = (int)idx.size();
        W lit0(k), lines;
        for (int i = 0; i < k; i++) lit0[i] = add(NOT, idx[i]);
        for (int v = 0; v < (1 << k); v++) {
            int acc = ((v >> 0) & 1) ? idx[0] : lit0[0];
            for (int i = 1; i < k; i++) acc = add(AND, acc, ((v >> i) & 1) ? idx[i] : lit0[i]);
            lines.push_back(acc);
        }
        return lines;
    }

    // ---------- families ----------
    void randomBlock(int n, int window, int unusedPercent) {
        for (int k = 0; k < n; k++) {
            int j = count();
            addRandom([&] {
                return preferUnused(unusedPercent, [&] {
                    if (j == 0 || chance(6)) return source();
                    return gs(j - 1 - (int)r(min(j, window)));
                });
            });
        }
    }
    int mulW = 16, cipherR = 6, ctrlK = 5;  // block parameters (defaults of the earlier inputs)
    void multiplierBlock() {
        W a = operand(mulW, 60), b = operand(mulW, 60);
        W p = multiplier(a, b);
        if (chance(50)) p = adder(p, widen(operand(2 * mulW, 40), 2 * mulW));
    }
    void cipherBlock() {
        vector<int> perm(64);
        for (int i = 0; i < 64; i++) perm[i] = i;
        shuffle(perm.begin(), perm.end(), rng);
        W st = widen(operand(64, 50), 64);
        int rounds = cipherR + (int)r(7);
        for (int k = 0; k < rounds; k++) st = cipherRound(st, chance(50) ? ffWord(64) : piWord(64), perm);
    }
    void controlBlock() {
        W idx = operand(ctrlK, 40);
        vector<W> ops(1 << ctrlK);
        for (auto& o : ops) o = operand(16, 50);
        W sel = muxTree(idx, ops);
        W other = operand(16, 50);
        int lt = lessThan(sel, other);
        int eq = equal(sel, operand(16, 30));
        muxWords(lt, sel, xorWords(other, ops[r(ops.size())]));
        W dec = decoder(operand(ctrlK, 40));
        for (int line : dec) add(AND, line, eq);
    }
    void build(const string& fam) {
        if (fam == "deep") {
            randomBlock(MAIN, (int)param(0, 64, 1, MAIN, "deep window"), 50);
        } else if (fam == "wide") {
            // Layered (default 40 levels); inputs mostly from the previous level, every gate there gets used.
            const int LEVELS = (int)param(0, 40, 1, 4000, "wide levels"), PER = MAIN / LEVELS;
            vector<int> prev;
            for (int lv = 0; lv < LEVELS; lv++) {
                vector<int> order = prev;
                shuffle(order.begin(), order.end(), rng);
                size_t next = 0;
                vector<int> cur;
                int n = lv + 1 == LEVELS ? MAIN - count() : PER;
                for (int k = 0; k < n; k++) {
                    cur.push_back(addRandom([&] {
                        int x = (int)r(100);
                        if (prev.empty() || x < 10) return source();
                        if (x < 80) return next < order.size() ? order[next++] : prev[r(prev.size())];
                        return gs((int)r(count()));
                    }));
                }
                prev.swap(cur);
            }
        } else if (fam == "multiplier") {
            mulW = (int)param(0, 16, 2, 32, "multiplier width");
            while (count() < MAIN - 2000) multiplierBlock();
        } else if (fam == "cipher") {
            cipherR = (int)param(0, 6, 1, 64, "cipher minimal rounds");
            while (count() < MAIN - 8000) cipherBlock();
        } else if (fam == "control") {
            ctrlK = (int)param(0, 5, 1, 8, "control select bits");
            while (count() < MAIN - 2000) controlBlock();
        } else if (fam == "regfile") {
            // 2^A registers x (4096 >> A) bits in flip-flops 0..4095; 64 read ports, WPN write ports.
            // Default: 128 registers x 32 bits, 16 write ports.
            const int A = (int)param(0, 7, 6, 9, "regfile address bits"), R = 1 << A, WD = 4096 >> A, RP = 64;
            const int WPN = (int)param(1, 16, 1, RP / 2, "regfile write ports");
            auto regWord = [&](int k) { W w(WD); for (int i = 0; i < WD; i++) w[i] = ff(WD * k + i); return w; };
            vector<W> regs(R);
            for (int k = 0; k < R; k++) regs[k] = regWord(k);
            auto addrBits = [&](int n) { W a(n); for (int i = 0; i < n; i++) a[i] = chance(50) ? pi((int)r(I)) : ff(4096 + (int)r(4096)); return a; };
            vector<W> rd(RP);
            for (int p = 0; p < RP; p++) rd[p] = muxTree(addrBits(A), regs);
            vector<W> data(WPN), we(WPN);
            for (int p = 0; p < WPN; p++) {
                W s = adder(rd[2 * p], rd[2 * p + 1]);
                data[p] = muxWords(pi((int)r(I)), s, xorWords(rd[2 * p], piWord(WD)));
                W dec = decoder(addrBits(A));
                int wen = ff(4096 + (int)r(4096));
                we[p] = W(R);
                for (int k = 0; k < R; k++) we[p][k] = add(AND, dec[k], wen);
            }
            int glue = MAIN - count() - R * WD * WPN;
            randomBlock(max(glue, 0), 4000, 50);
            for (int k = 0; k < R; k++)
                for (int i = 0; i < WD; i++) {
                    int v = ff(WD * k + i);
                    for (int p = 0; p < WPN; p++) v = add(MUX, we[p][k], v, data[p][i]);
                    setFF(WD * k + i, v);
                }
        } else if (fam == "pipeline") {
            // S-stage ring (default 16); stage s reads register group s-1 and writes register group s.
            const int S = (int)param(0, 16, 2, 256, "pipeline stages"), REG = min(448, F / S), PER = MAIN / S;
            for (int s = 0; s < S; s++) {
                int start = count(), prev = (s + S - 1) % S;
                for (int k = 0; k < PER; k++) {
                    int j = count();
                    addRandom([&] {
                        return preferUnused(45, [&] {
                            int x = (int)r(100);
                            if (k == 0 || x < 10) return ff(prev * REG + (int)r(REG));
                            if (x < 12) return pi((int)r(I));
                            return gs(j - 1 - (int)r(min(k, 800)));
                        });
                    });
                }
                for (int q = 0; q < REG; q++) {
                    int u = takeUnused();
                    if (u < 0 || u - BASE_G < start) u = gs(start + PER / 2 + (int)r(PER / 2));
                    setFF(s * REG + q, u);
                }
            }
        } else if (fam == "soc") {
            const int pm = (int)param(0, 25, 0, 100, "soc multiplier percentage");
            const int pc = (int)param(1, 50, pm, 100, "soc cumulative cipher percentage");
            const int pk = (int)param(2, 70, pc, 100, "soc cumulative control percentage");
            while (count() < MAIN - 8000) {
                int x = (int)r(100);
                if (x < pm) multiplierBlock();
                else if (x < pc) cipherBlock();
                else if (x < pk) controlBlock();
                else randomBlock(2000, 300, 50);
            }
        } else {
            fprintf(stderr, "unknown family\n");
            exit(1);
        }
        finish();
    }

    // Fill the remaining budget so that, at the end, every gate has fan-out and all leftover
    // unused gates can be attached to unassigned flip-flops; then fold flip-flops into outputs.
    void finish() {
        int budget = (G - OUTFOLD) - count();
        if (budget < 0) { fprintf(stderr, "main part too large: %d\n", count()); exit(1); }
        vector<int> ul;
        for (int c = 0; c < count(); c++) if (uses[c] == 0) ul.push_back(c);
        auto popU = [&]() {
            while (!ul.empty()) {
                size_t k = r(ul.size());
                int c = ul[k];
                ul[k] = ul.back();
                ul.pop_back();
                if (uses[c] == 0) return gs(c);
            }
            return -1;
        };
        auto anyGate = [&] { return chance(10) ? source() : gs((int)r(count())); };
        for (int step = 0; step < budget; step++) {
            int remaining = budget - step;
            int need = unused - unsetFF;
            if (need > remaining) { fprintf(stderr, "cannot absorb %d unused gates\n", need); exit(1); }
            int t = randType();
            if (need == remaining || (need > 0 && chance(60))) {  // reduce: two inputs from unused gates
                if (t == NOT) t = XOR;
                int a = popU(), b = popU();
                if (b < 0) b = anyGate();
                int c = t == MUX ? (need >= 2 ? popU() : anyGate()) : -1;
                if (t == MUX && c < 0) c = anyGate();
                add(t, a, b, c);
            } else {  // mix: one input from an unused gate if any
                int a = popU();
                if (a < 0) a = anyGate();
                add(t, a, nin(t) >= 2 ? anyGate() : -1, nin(t) == 3 ? anyGate() : -1);
            }
            ul.push_back(count() - 1);
        }
        vector<int> freeFF;
        for (int f = 0; f < F; f++) if (ffd[f] < 0) freeFF.push_back(f);
        shuffle(freeFF.begin(), freeFF.end(), rng);
        size_t q = 0;
        for (int u; q < freeFF.size() && (u = popU()) >= 0; q++) setFF(freeFF[q], u);
        for (; q < freeFF.size(); q++) setFF(freeFF[q], gs((int)r(count())));
        if (unused != 0) { fprintf(stderr, "%d gates still unused\n", unused); exit(1); }
        vector<int> order(F);
        for (int f = 0; f < F; f++) order[f] = f;
        shuffle(order.begin(), order.end(), rng);
        for (int o = 0; o < O; o++) {
            W level;
            for (int k = 0; k < FOLD; k++) level.push_back(ff(order[o * FOLD + k]));
            while (level.size() > 1) {
                W n;
                for (size_t i = 0; i + 1 < level.size(); i += 2) n.push_back(add(XOR, level[i], level[i + 1]));
                if (level.size() % 2) n.push_back(level.back());
                level.swap(n);
            }
            outs.push_back(level[0]);
        }
        if (count() != G) { fprintf(stderr, "gate count %d != %d\n", count(), G); exit(1); }
    }

    void emit() {
        vector<int> perm(G);  // creation index -> listed index
        for (int i = 0; i < G; i++) perm[i] = i;
        shuffle(perm.begin(), perm.end(), rng);
        auto remap = [&](int s) { return s < BASE_G ? s : BASE_G + perm[s - BASE_G]; };
        vector<array<int, 4>> listed(G);
        for (int j = 0; j < G; j++) {
            array<int, 4> g = gates[j];
            for (int k = 1; k <= 3; k++) if (g[k] >= 0) g[k] = remap(g[k]);
            listed[perm[j]] = g;
        }
        string out;
        out.reserve(16 << 20);
        char buf[96];
        snprintf(buf, sizeof buf, "%d %d %d %d %d %d %llu\n", I, F, G, O, M, T, (unsigned long long)rng());
        out += buf;
        for (int f = 0; f < F; f++) { snprintf(buf, sizeof buf, "%d%c", remap(ffd[f]), f + 1 == F ? '\n' : ' '); out += buf; }
        for (int k = 0; k < G; k++) {
            const auto& g = listed[k];
            out += NAMES[g[0]];
            for (int q = 0; q < nin(g[0]); q++) { snprintf(buf, sizeof buf, " %d", g[1 + q]); out += buf; }
            out += '\n';
        }
        for (int o = 0; o < O; o++) { snprintf(buf, sizeof buf, "%d%c", remap(outs[o]), o + 1 == O ? '\n' : ' '); out += buf; }
        fwrite(out.data(), 1, out.size(), stdout);
    }
};

int main(int argc, char** argv) {
    if (argc < 3 || argc > 6) { fprintf(stderr, "usage: gen_hidden <family> <seed> [p1 [p2 [p3]]]\n"); return 1; }
#ifdef _WIN32
    _setmode(_fileno(stdout), _O_BINARY);  // write LF line endings on Windows too
#endif
    vector<long long> par;
    for (int k = 3; k < argc; k++) par.push_back(atoll(argv[k]));
    Gen g(strtoull(argv[2], nullptr, 10), par);
    g.build(argv[1]);
    g.emit();
    return 0;
}
