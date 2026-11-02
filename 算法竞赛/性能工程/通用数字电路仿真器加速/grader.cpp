// grader.cpp
// Usage: grader.exe <input file>
//   stdout: the M digests, one 16-digit lowercase hex number per line
//   stderr: "simulate_ms=<milliseconds>", the wall time of the timed simulate() call
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

struct Circuit {
    int I, F, G, O, M, T;
    uint64_t seed;
    std::vector<int> d;              // size F: data input of each flip-flop
    std::vector<uint8_t> type;       // size G: 0 AND, 1 OR, 2 XOR, 3 NAND, 4 NOR, 5 XNOR, 6 NOT, 7 MUX
    std::vector<int> in0, in1, in2;  // size G: input signals; unused inputs are -1; MUX: in0=s, in1=a, in2=b
    std::vector<int> out;            // size O: primary outputs
};

std::vector<uint64_t> simulate(const Circuit& c);

static void fail(const char* msg) {
    fprintf(stderr, "grader: %s\n", msg);
    exit(1);
}

static Circuit parse(const char* path) {
    FILE* f = fopen(path, "rb");
    if (!f) fail("cannot open input file");
    std::vector<char> buf;
    char tmp[1 << 16];
    size_t got;
    while ((got = fread(tmp, 1, sizeof tmp, f)) > 0) buf.insert(buf.end(), tmp, tmp + got);
    fclose(f);
    buf.push_back(0);
    size_t p = 0;
    auto skip = [&] { while (buf[p] && (unsigned char)buf[p] <= ' ') p++; };
    auto num = [&]() -> uint64_t {
        skip();
        if (buf[p] < '0' || buf[p] > '9') fail("number expected");
        uint64_t x = 0;
        while (buf[p] >= '0' && buf[p] <= '9') x = x * 10 + (uint64_t)(buf[p++] - '0');
        return x;
    };
    static const char* names[] = {"AND", "OR", "XOR", "NAND", "NOR", "XNOR", "NOT", "MUX"};
    auto word = [&]() -> int {
        skip();
        size_t e = p;
        while ((unsigned char)buf[e] > ' ') e++;
        for (int t = 0; t < 8; t++)
            if (strlen(names[t]) == e - p && !strncmp(&buf[p], names[t], e - p)) { p = e; return t; }
        fail("unknown gate type");
        return -1;
    };
    Circuit c;
    c.I = (int)num(); c.F = (int)num(); c.G = (int)num(); c.O = (int)num(); c.M = (int)num(); c.T = (int)num();
    c.seed = num();
    c.d.resize(c.F);
    for (auto& x : c.d) x = (int)num();
    c.type.resize(c.G); c.in0.assign(c.G, -1); c.in1.assign(c.G, -1); c.in2.assign(c.G, -1);
    for (int k = 0; k < c.G; k++) {
        int t = word();
        c.type[k] = (uint8_t)t;
        c.in0[k] = (int)num();
        if (t != 6) c.in1[k] = (int)num();
        if (t == 7) c.in2[k] = (int)num();
    }
    c.out.resize(c.O);
    for (auto& x : c.out) x = (int)num();
    return c;
}

static Circuit sampleCircuit() {  // the sample from the problem statement
    Circuit c;
    c.I = 64; c.F = 2; c.G = 6; c.O = 3; c.M = 2; c.T = 4; c.seed = 12345;
    c.d = {68, 72};
    c.type = {2, 0, 1, 6, 7, 3};
    c.in0 = {70, 2, 69, 67, 5, 72};
    c.in1 = {66, 3, 4, -1, 71, 1};
    c.in2 = {-1, -1, -1, -1, 68, -1};
    c.out = {68, 72, 73};
    return c;
}

int main(int argc, char** argv) {
#ifdef _WIN32
    _setmode(_fileno(stdout), _O_BINARY);
#endif
    if (argc != 2) fail("usage: grader.exe <input file>");
    // Untimed warm-up on the sample circuit.
    std::vector<uint64_t> s = simulate(sampleCircuit());
    if (s.size() != 2 || s[0] != 0x90b37d5a4e5580f7ULL || s[1] != 0x8cdc0aaf7feb37edULL)
        fail("wrong result on the sample circuit");
    Circuit c = parse(argv[1]);  // untimed
    auto t0 = std::chrono::steady_clock::now();
    std::vector<uint64_t> h = simulate(c);
    auto t1 = std::chrono::steady_clock::now();
    if ((int)h.size() != c.M) fail("simulate() returned a wrong number of digests");
    std::vector<char> outbuf((size_t)c.M * 17);
    static const char hx[] = "0123456789abcdef";
    for (int m = 0; m < c.M; m++) {
        char* q = &outbuf[(size_t)m * 17];
        for (int i = 0; i < 16; i++) q[i] = hx[(h[m] >> (60 - 4 * i)) & 15];
        q[16] = '\n';
    }
    fwrite(outbuf.data(), 1, outbuf.size(), stdout);
    fprintf(stderr, "simulate_ms=%.3f\n", std::chrono::duration<double, std::milli>(t1 - t0).count());
    return 0;
}
