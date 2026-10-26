// Hidden input generator for 网格沙粒倒塌的GPU加速.
// Usage: gen_sand <type> <seed> <scale> [extra] > input.txt
//   type : single | few | many | dust | edge | noise | ring | mixed | dense
//   scale: grains in main piles; for dense, the side length of the active square
//   extra: optional; ring radius for ring (default 1100), grains on each active cell for dense
//          (default 4). Omitting it reproduces the earlier inputs of these families.
// Output is deterministic for given arguments. The generator refuses to write an input with
// P > 2000000 or C > 2^23 (the limits of the problem statement).
// Build: g++ -O2 -std=c++20 -o gen_sand.exe gen_sand.cpp
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <random>
#include <string>
#include <vector>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif
using namespace std;

static const int L = 4096;

struct Pile { int x, y; long long c; };

int main(int argc, char** argv) {
    if (argc != 4 && argc != 5) { fprintf(stderr, "usage: gen_sand <type> <seed> <scale> [extra]\n"); return 1; }
#ifdef _WIN32
    _setmode(_fileno(stdout), _O_BINARY);
#endif
    string type = argv[1];
    mt19937_64 rng(strtoull(argv[2], nullptr, 10));
    long long scale = atoll(argv[3]);
    long long extra = argc == 5 ? atoll(argv[4]) : -1;  // -1: family default
    auto uni = [&](long long lo, long long hi) { return lo + (long long)(rng() % (unsigned long long)(hi - lo + 1)); };
    auto real = [&] { return (rng() >> 11) * (1.0 / 9007199254740992.0); };
    vector<Pile> piles;
    // Split `total` grains into n piles with random (exponential) weights.
    auto split = [&](int n, long long total, auto pos) {
        vector<double> w(n);
        double s = 0;
        for (auto& x : w) { x = -log(1.0 - real()); s += x; }
        long long used = 0;
        for (int i = 0; i < n; i++) {
            long long c = i + 1 == n ? total - used : (long long)(total * w[i] / s);
            if (c < 1) c = 1;
            used += c;
            auto [x, y] = pos();
            piles.push_back({x, y, c});
        }
    };
    auto anywhere = [&] { return pair<int, int>((int)uni(0, L - 1), (int)uni(0, L - 1)); };
    auto central = [&] { return pair<int, int>((int)uni(L / 4, 3 * L / 4), (int)uni(L / 4, 3 * L / 4)); };
    if (type == "single") {
        piles.push_back({(int)uni(L / 2 - 200, L / 2 + 200), (int)uni(L / 2 - 200, L / 2 + 200), scale});
    } else if (type == "few") {
        split(4, scale, central);
    } else if (type == "many") {
        split(16, scale, anywhere);
    } else if (type == "dust") {
        // many small piles everywhere, plus a few medium ones
        long long big = scale / 2;
        split(8, big, anywhere);
        long long rest = scale - big;
        while (rest > 0) {
            long long c = min(rest, uni(4, 60));
            auto [x, y] = anywhere();
            piles.push_back({x, y, c});
            rest -= c;
        }
    } else if (type == "edge") {
        // piles close to the border, so a large share of the sand leaves the grid
        split(12, scale, [&] {
            int side = (int)uni(0, 3), a = (int)uni(0, L - 1), b = (int)uni(0, 250);
            if (side == 0) return pair<int, int>(a, b);
            if (side == 1) return pair<int, int>(a, L - 1 - b);
            if (side == 2) return pair<int, int>(b, a);
            return pair<int, int>(L - 1 - b, a);
        });
    } else if (type == "noise") {
        // a sparse background of 1-3 grains on about 10% of the cells, plus large piles
        for (int k = 0; k < L * L / 10; k++) {
            auto [x, y] = anywhere();
            piles.push_back({x, y, uni(1, 3)});
        }
        split(6, scale, central);
    } else if (type == "ring") {
        // many medium piles along a ring and a cross
        int n = 20000;
        long long each = max(1LL, scale / n);
        double R = extra < 0 ? 1100 : (double)extra;
        if (R < 1 || R > L / 2 - 1) {
            fprintf(stderr, "ring radius must be in [1,%d]\n", L / 2 - 1);
            return 1;
        }
        for (int k = 0; k < n; k++) {
            double a = real() * 2 * 3.14159265358979323846;
            int x, y;
            if (k % 4) { x = L / 2 + (int)lround(R * cos(a)); y = L / 2 + (int)lround(R * sin(a)); }
            else if (k % 8 == 0) { x = (int)uni(L / 8, 7 * L / 8); y = L / 2; }
            else { x = L / 2; y = (int)uni(L / 8, 7 * L / 8); }
            piles.push_back({x, y, uni(each / 2, each * 3 / 2)});
        }
    } else if (type == "dense") {
        // A contiguous square with half its cells immediately active.  Unlike
        // the sparse pile families, many adjacent tiles must run together.
        // With more than 4 grains per active cell the square holds more sand
        // than it can keep, so the dense region stays active for a long time.
        int side = (int)scale;
        long long h = extra < 0 ? 4 : extra;
        if (side < 2 || side > L - 128) {
            fprintf(stderr, "dense side must be in [2,%d]\n", L - 128);
            return 1;
        }
        if (h < 4) {
            fprintf(stderr, "dense grains per active cell must be at least 4\n");
            return 1;
        }
        int ox = (int)uni(64, L - side - 64);
        int oy = (int)uni(64, L - side - 64);
        for (int y = 0; y < side; y++)
            for (int x = 0; x < side; x++)
                if ((x + y) % 2 == 0) piles.push_back({ox + x, oy + y, h});
    } else if (type == "mixed") {
        split(5, scale * 6 / 10, central);
        long long rest = scale * 4 / 10;
        while (rest > 0) {
            long long c = min(rest, uni(50, 4000));
            auto [x, y] = anywhere();
            piles.push_back({x, y, c});
            rest -= c;
        }
        for (int k = 0; k < L * L / 20; k++) {
            auto [x, y] = anywhere();
            piles.push_back({x, y, uni(1, 3)});
        }
    } else {
        fprintf(stderr, "unknown type\n");
        return 1;
    }
    long long total = 0;
    for (auto& p : piles) total += p.c;
    if (piles.size() > 2000000 || total > (1LL << 23)) {
        fprintf(stderr, "type=%s P=%zu C=%lld exceeds P <= 2000000 or C <= 2^23\n", type.c_str(), piles.size(), total);
        return 1;
    }
    // shuffle so that the listing order carries no structure
    for (size_t i = piles.size(); i > 1; i--) swap(piles[i - 1], piles[rng() % i]);
    string out;
    out.reserve(piles.size() * 20 + 32);
    char buf[64];
    snprintf(buf, sizeof buf, "%d %zu\n", L, piles.size());
    out += buf;
    for (auto& p : piles) { snprintf(buf, sizeof buf, "%d %d %lld\n", p.x, p.y, p.c); out += buf; }
    fwrite(out.data(), 1, out.size(), stdout);
    fprintf(stderr, "type=%s P=%zu C=%lld\n", type.c_str(), piles.size(), total);
    return 0;
}
