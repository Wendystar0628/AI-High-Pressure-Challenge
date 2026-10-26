// grader.cu
// Usage: grader.exe <input file>
//   stdout: the stable grid, L lines of L digits
//   stderr: "solve_ms=<milliseconds>", the wall time of the timed solve() call
#include <cuda_runtime.h>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <vector>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

void init(int L);                   // untimed; called before every solve(), L may change between calls
void solve(uint32_t* grid, int L);  // timed; stabilizes the device grid in place, index y*L + x

struct SandInput {
    int L;
    std::vector<int> x, y;   // size P: cell of each pile
    std::vector<uint32_t> c; // size P: grains of each pile
};

static void fail(const char* msg) {
    fprintf(stderr, "grader: %s\n", msg);
    exit(1);
}

static void check(cudaError_t e, const char* msg) {
    if (e != cudaSuccess) {
        fprintf(stderr, "grader: %s: %s\n", msg, cudaGetErrorString(e));
        exit(1);
    }
}

static SandInput parse(const char* path) {
    FILE* f = fopen(path, "rb");
    if (!f) fail("cannot open input file");
    std::vector<char> buf;
    char tmp[1 << 16];
    size_t got;
    while ((got = fread(tmp, 1, sizeof tmp, f)) > 0) buf.insert(buf.end(), tmp, tmp + got);
    fclose(f);
    buf.push_back(0);
    size_t p = 0;
    auto num = [&]() -> uint64_t {
        while (buf[p] && (unsigned char)buf[p] <= ' ') p++;
        if (buf[p] < '0' || buf[p] > '9') fail("number expected");
        uint64_t v = 0;
        while (buf[p] >= '0' && buf[p] <= '9') v = v * 10 + (uint64_t)(buf[p++] - '0');
        return v;
    };
    SandInput in;
    in.L = (int)num();
    size_t P = (size_t)num();
    in.x.resize(P); in.y.resize(P); in.c.resize(P);
    for (size_t i = 0; i < P; i++) {
        in.x[i] = (int)num();
        in.y[i] = (int)num();
        in.c[i] = (uint32_t)num();
    }
    return in;
}

// Builds the initial grid on the host, uploads it and calls init() (all untimed),
// then times solve() plus the synchronization after it, and downloads the result.
static std::vector<uint32_t> run(const SandInput& in, double* ms) {
    const size_t L = (size_t)in.L, n = L * L;
    std::vector<uint32_t> h(n, 0);
    for (size_t p = 0; p < in.c.size(); p++) {
        if ((size_t)in.x[p] >= L || (size_t)in.y[p] >= L) fail("pile outside the grid");
        h[(size_t)in.y[p] * L + in.x[p]] += in.c[p];
    }
    uint32_t* grid = nullptr;
    check(cudaMalloc(&grid, n * sizeof(uint32_t)), "cannot allocate the device grid");
    check(cudaMemcpy(grid, h.data(), n * sizeof(uint32_t), cudaMemcpyHostToDevice), "cannot upload the grid");
    init(in.L);
    check(cudaDeviceSynchronize(), "CUDA error in init()");
    auto t0 = std::chrono::steady_clock::now();
    solve(grid, in.L);
    check(cudaDeviceSynchronize(), "CUDA error in solve()");
    auto t1 = std::chrono::steady_clock::now();
    *ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
    check(cudaMemcpy(h.data(), grid, n * sizeof(uint32_t), cudaMemcpyDeviceToHost), "cannot download the grid");
    check(cudaFree(grid), "cannot free the device grid");
    return h;
}

int main(int argc, char** argv) {
#ifdef _WIN32
    _setmode(_fileno(stdout), _O_BINARY);
    _putenv_s("CUDA_MODULE_LOADING", "EAGER");  // request eager module loading
#endif
    if (argc != 2) fail("usage: grader.exe <input file>");
    check(cudaFree(0), "cannot create CUDA context");  // untimed
    // Untimed warm-up on sample 2 of the problem statement, through the same init() + solve() path.
    double ms = 0;
    std::vector<uint32_t> sr = run(SandInput{5, {2, 0}, {2, 4}, {40, 7}}, &ms);
    static const char* sampleRows[5] = {"01310", "12321", "33033", "22321", "32310"};
    for (int i = 0; i < 25; i++)
        if (sr[i] != (uint32_t)(sampleRows[i / 5][i % 5] - '0')) fail("wrong result on the sample input");
    SandInput in = parse(argv[1]);  // untimed
    std::vector<uint32_t> r = run(in, &ms);
    const size_t L = (size_t)in.L;
    std::vector<char> out(L * (L + 1));
    for (size_t yy = 0; yy < L; yy++) {
        for (size_t xx = 0; xx < L; xx++) {
            uint32_t v = r[yy * L + xx];
            if (v > 3) fail("solve() left a cell with 4 or more grains");
            out[yy * (L + 1) + xx] = (char)('0' + v);
        }
        out[yy * (L + 1) + L] = '\n';
    }
    fwrite(out.data(), 1, out.size(), stdout);
    fprintf(stderr, "solve_ms=%.3f\n", ms);
    return 0;
}
