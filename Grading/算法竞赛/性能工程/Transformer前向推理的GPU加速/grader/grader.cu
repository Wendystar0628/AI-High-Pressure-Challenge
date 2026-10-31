// grader.cu
// Usage: grader.exe <input file>
//   stdout: y as raw little-endian float32 values, B*S*D of them
//   stderr: "forward_ms=<milliseconds>", the wall time of the timed forward() call
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

struct TransformerSpec { int B, S, D, H, F, L; const float* weights; };

void init(const TransformerSpec& spec, const float* x, float* y);  // untimed; x has no content yet
void forward();                                                    // timed; reads x, writes y

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

static size_t weight_count(const TransformerSpec& s) {
    const size_t D = s.D, F = s.F;
    return (size_t)s.L * (9 * D + 4 * D * D + 2 * D * F + F) + 2 * D;
}

int main(int argc, char** argv) {
#ifdef _WIN32
    _setmode(_fileno(stdout), _O_BINARY);
    _putenv_s("CUDA_MODULE_LOADING", "EAGER");  // request eager module loading
#endif
    if (argc != 2) fail("usage: grader.exe <input file>");
    check(cudaFree(0), "cannot create CUDA context");  // untimed
    FILE* f = fopen(argv[1], "rb");
    if (!f) fail("cannot open input file");
    int32_t head[6];
    if (fread(head, sizeof(int32_t), 6, f) != 6) fail("cannot read the header");
    TransformerSpec spec{head[0], head[1], head[2], head[3], head[4], head[5], nullptr};
    std::vector<float> weights(weight_count(spec));
    std::vector<float> input((size_t)spec.B * spec.S * spec.D);
    if (fread(weights.data(), sizeof(float), weights.size(), f) != weights.size()) fail("cannot read the weights");
    if (fread(input.data(), sizeof(float), input.size(), f) != input.size()) fail("cannot read x");
    fclose(f);
    spec.weights = weights.data();
    const size_t n = input.size();
    float* x = nullptr;
    float* y = nullptr;
    check(cudaMalloc(&x, n * sizeof(float)), "cannot allocate x");
    check(cudaMalloc(&y, n * sizeof(float)), "cannot allocate y");
    init(spec, x, y);
    check(cudaDeviceSynchronize(), "CUDA error in init()");
    // One untimed forward() on a different input of the same shape.
    std::vector<float> other(n);
    uint32_t state = 12345;
    for (size_t i = 0; i < n; i++) {
        state = state * 1664525u + 1013904223u;
        other[i] = (float)(state >> 8) / 16777216.0f * 4.0f - 2.0f;
    }
    check(cudaMemcpy(x, other.data(), n * sizeof(float), cudaMemcpyHostToDevice), "cannot upload x");
    forward();
    check(cudaDeviceSynchronize(), "CUDA error in forward()");
    // The real input: time forward() plus the synchronization after it.
    check(cudaMemcpy(x, input.data(), n * sizeof(float), cudaMemcpyHostToDevice), "cannot upload x");
    check(cudaMemset(y, 0, n * sizeof(float)), "cannot clear y");
    check(cudaDeviceSynchronize(), "CUDA error before forward()");
    auto t0 = std::chrono::steady_clock::now();
    forward();
    check(cudaDeviceSynchronize(), "CUDA error in forward()");
    auto t1 = std::chrono::steady_clock::now();
    const double ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
    std::vector<float> out(n);
    check(cudaMemcpy(out.data(), y, n * sizeof(float), cudaMemcpyDeviceToHost), "cannot download y");
    if (fwrite(out.data(), sizeof(float), out.size(), stdout) != out.size()) fail("cannot write y");
    fflush(stdout);
    fprintf(stderr, "forward_ms=%.3f\n", ms);
    return 0;
}
