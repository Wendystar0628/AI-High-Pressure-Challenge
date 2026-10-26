// Weak baseline for 网格沙粒倒塌的GPU加速: a simple full-grid tiled implementation.
//   - 32x32 output tiles with a four-cell halo
//   - four synchronous rounds in shared memory per launch
//   - every tile is processed; no activity masks or sparse-region scheduling
//   - the "anything toppled" flag is read back every 64 logical rounds
//   - init() allocates the second grid buffer and the flag; solve() works in place on the grader's grid
// Build: nvcc -O3 -std=c++17 -arch=sm_89 -Xcompiler "/O2 /utf-8" -o weak.exe grader.cu weak_solution.cu
#include <cuda_runtime.h>
#include <cstdint>
#include <utility>

static constexpr int TILE = 32, ROUNDS = 4, EXT = TILE + 2 * ROUNDS;
static constexpr int LAUNCHES_PER_CHECK = 64 / ROUNDS;
static_assert(LAUNCHES_PER_CHECK % 2 == 0, "an even number of launches leaves the result in the grader's grid");

static uint32_t* g_other = nullptr;  // second grid buffer (ping-pong partner of the grader's grid)
static int* g_changed = nullptr;

__global__ void roundKernel(const uint32_t* __restrict__ h, uint32_t* __restrict__ o, int L, int* changed) {
    __shared__ uint32_t first[EXT * EXT], second[EXT * EXT];
    const int ox = blockIdx.x * TILE, oy = blockIdx.y * TILE;
    for (int i = threadIdx.x; i < EXT * EXT; i += blockDim.x) {
        int x = ox + i % EXT - ROUNDS, y = oy + i / EXT - ROUNDS;
        first[i] = x >= 0 && x < L && y >= 0 && y < L ? h[(size_t)y * L + x] : 0;
    }
    __syncthreads();
    uint32_t* src = first;
    uint32_t* dst = second;
    int toppled = 0;
#pragma unroll
    for (int step = 0; step < ROUNDS; step++) {
        // Shrink the valid region by one cell each round; the four-cell halo
        // makes every final interior value identical to full-grid Jacobi steps.
        for (int i = threadIdx.x; i < EXT * EXT; i += blockDim.x) {
            int tx = i % EXT, ty = i / EXT;
            if (tx <= step || tx >= EXT - 1 - step || ty <= step || ty >= EXT - 1 - step) continue;
            int x = ox + tx - ROUNDS, y = oy + ty - ROUNDS;
            uint32_t v = src[i];
            uint32_t nv = (v & 3) + (src[i - 1] >> 2) + (src[i + 1] >> 2)
                                  + (src[i - EXT] >> 2) + (src[i + EXT] >> 2);
            bool inside = x >= 0 && x < L && y >= 0 && y < L;
            dst[i] = inside ? nv : 0;
            if (inside && tx >= ROUNDS && tx < ROUNDS + TILE &&
                          ty >= ROUNDS && ty < ROUNDS + TILE && v >= 4) toppled = 1;
        }
        __syncthreads();
        uint32_t* tmp = src; src = dst; dst = tmp;
    }
    for (int i = threadIdx.x; i < TILE * TILE; i += blockDim.x) {
        int x = ox + i % TILE, y = oy + i / TILE;
        if (x < L && y < L) {
            uint32_t v = src[(i / TILE + ROUNDS) * EXT + i % TILE + ROUNDS];
            o[(size_t)y * L + x] = v;
            if (v >= 4) toppled = 1;
        }
    }
    if (__syncthreads_or(toppled) && threadIdx.x == 0) atomicExch(changed, 1);
}

void init(int L) {
    cudaFree(g_other);  // re-initialization: release the buffers of the previous size
    cudaFree(g_changed);
    cudaMalloc(&g_other, (size_t)L * L * sizeof(uint32_t));
    cudaMalloc(&g_changed, sizeof(int));
}

void solve(uint32_t* grid, int L) {
    uint32_t *a = grid, *b = g_other;
    dim3 grd((L + TILE - 1) / TILE, (L + TILE - 1) / TILE);
    while (true) {
        cudaMemset(g_changed, 0, sizeof(int));
        for (int k = 0; k < LAUNCHES_PER_CHECK; k++) {
            roundKernel<<<grd, 256>>>(a, b, L, g_changed);
            std::swap(a, b);
        }
        int h = 0;
        cudaMemcpy(&h, g_changed, sizeof(int), cudaMemcpyDeviceToHost);
        if (!h) break;
    }
}
