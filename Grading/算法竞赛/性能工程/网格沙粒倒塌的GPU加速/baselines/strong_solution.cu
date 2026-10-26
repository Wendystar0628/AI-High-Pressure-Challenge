// Strong baseline for 网格沙粒倒塌的GPU加速: a general-purpose optimized solution by the setter.
//   - same synchronous rule as the weak baseline (each cell topples floor(h/4) times per round)
//   - temporal blocking: a block loads a 64x64 tile (48x48 inner part + 8-cell halo) into
//     shared memory and runs 8 rounds there, then writes back the inner part
//   - activity tracking: a tile is processed only if it or one of its 8 neighbours was still
//     active in the previous launch; stable regions cost almost nothing
//   - init() allocates the second grid buffer and the activity masks; solve() works in place on
//     the grader's grid and copies the result back into it if the last launch wrote the other buffer
// Build: nvcc -O3 -std=c++17 -arch=sm_89 -Xcompiler "/O2 /utf-8" -o strong.exe grader.cu strong_solution.cu
#include <cuda_runtime.h>
#include <cstdint>
#include <utility>

#define EXT 64           // tile side including halo
#define KR 8             // rounds per launch (= halo width)
#define IN (EXT - 2 * KR)  // inner tile side
#define ROWS_PER_THREAD 4  // 1024 threads x 4 cells = 64 x 64

static uint32_t* g_other = nullptr;  // ping-pong partner of the grader's grid
static uint8_t *g_act0 = nullptr, *g_act1 = nullptr, *g_proc0 = nullptr, *g_proc1 = nullptr;
static int* g_count = nullptr;
static int* g_hostCount = nullptr;

__global__ void __launch_bounds__(1024) tileKernel(const uint32_t* __restrict__ src, uint32_t* __restrict__ dst, int L,
                                                   int tilesX, int tilesY, const uint8_t* __restrict__ actCur,
                                                   uint8_t* __restrict__ actNext, const uint8_t* __restrict__ procCur,
                                                   uint8_t* __restrict__ procNext, int* activeCount) {
    const int tx = blockIdx.x, ty = blockIdx.y, tile = ty * tilesX + tx;
    const int ox = tx * IN, oy = ty * IN;
    __shared__ int run;
    if (threadIdx.x == 0) {
        int any = 0;
        for (int dy = -1; dy <= 1; dy++)
            for (int dx = -1; dx <= 1; dx++) {
                int nx = tx + dx, ny = ty + dy;
                if (nx >= 0 && nx < tilesX && ny >= 0 && ny < tilesY) any |= actCur[ny * tilesX + nx];
            }
        run = any;
    }
    __syncthreads();
    if (!run) {
        if (procCur[tile]) {  // the other buffer still holds an older copy of this tile
            for (int k = threadIdx.x; k < IN * IN; k += blockDim.x) {
                int gx = ox + k % IN, gy = oy + k / IN;
                if (gx < L && gy < L) dst[(size_t)gy * L + gx] = src[(size_t)gy * L + gx];
            }
        }
        if (threadIdx.x == 0) { actNext[tile] = 0; procNext[tile] = 0; }
        return;
    }
    __shared__ uint32_t tm[EXT][EXT];
    const int col = threadIdx.x & (EXT - 1), r0 = threadIdx.x >> 6;
    const int gx = ox - KR + col;
    const bool innerCol = col >= KR && col < KR + IN;
    uint32_t h[ROWS_PER_THREAD];
    bool inside[ROWS_PER_THREAD];
#pragma unroll
    for (int i = 0; i < ROWS_PER_THREAD; i++) {
        int row = r0 + 16 * i, gy = oy - KR + row;
        inside[i] = gx >= 0 && gx < L && gy >= 0 && gy < L;
        h[i] = inside[i] ? src[(size_t)gy * L + gx] : 0;
    }
    int toppled = 0;
    for (int k = 0; k < KR; k++) {
#pragma unroll
        for (int i = 0; i < ROWS_PER_THREAD; i++) tm[r0 + 16 * i][col] = h[i] >> 2;
        __syncthreads();
#pragma unroll
        for (int i = 0; i < ROWS_PER_THREAD; i++) {
            int row = r0 + 16 * i;
            uint32_t t = tm[row][col], nv = h[i] - 4 * t;
            if (row > 0) nv += tm[row - 1][col];
            if (row < EXT - 1) nv += tm[row + 1][col];
            if (col > 0) nv += tm[row][col - 1];
            if (col < EXT - 1) nv += tm[row][col + 1];
            if (!inside[i]) nv = 0;  // outside the grid: sand disappears
            if (t && innerCol && row >= KR && row < KR + IN) toppled = 1;
            h[i] = nv;
        }
        __syncthreads();
    }
#pragma unroll
    for (int i = 0; i < ROWS_PER_THREAD; i++) {
        int row = r0 + 16 * i, gy = oy - KR + row;
        if (innerCol && row >= KR && row < KR + IN && inside[i]) {
            dst[(size_t)gy * L + gx] = h[i];
            if (h[i] >= 4) toppled = 1;
        }
    }
    int any = __syncthreads_or(toppled);
    if (threadIdx.x == 0) {
        actNext[tile] = (uint8_t)(any != 0);
        procNext[tile] = 1;
        if (any) atomicAdd(activeCount, 1);
    }
}

void init(int L) {
    // Re-initialization: release the buffers of the previous size first.
    cudaFree(g_other);
    cudaFree(g_act0); cudaFree(g_act1); cudaFree(g_proc0); cudaFree(g_proc1);
    cudaFree(g_count);
    if (g_hostCount) cudaFreeHost(g_hostCount);
    const int tilesX = (L + IN - 1) / IN, tiles = tilesX * tilesX;
    cudaMalloc(&g_other, (size_t)L * L * sizeof(uint32_t));
    cudaMalloc(&g_act0, tiles); cudaMalloc(&g_act1, tiles);
    cudaMalloc(&g_proc0, tiles); cudaMalloc(&g_proc1, tiles);
    cudaMalloc(&g_count, sizeof(int));
    cudaMallocHost(&g_hostCount, sizeof(int));
}

void solve(uint32_t* grid, int L) {
    const size_t n = (size_t)L * L;
    const int tilesX = (L + IN - 1) / IN, tilesY = tilesX, tiles = tilesX * tilesY;
    uint32_t *a = grid, *b = g_other;
    uint8_t *act0 = g_act0, *act1 = g_act1, *proc0 = g_proc0, *proc1 = g_proc1;
    cudaMemsetAsync(act0, 1, tiles);   // everything is active at the start
    cudaMemsetAsync(proc0, 0, tiles);
    dim3 grd(tilesX, tilesY);
    while (true) {
        cudaMemsetAsync(g_count, 0, sizeof(int));
        tileKernel<<<grd, 1024>>>(a, b, L, tilesX, tilesY, act0, act1, proc0, proc1, g_count);
        std::swap(a, b);
        std::swap(act0, act1);
        std::swap(proc0, proc1);
        cudaMemcpy(g_hostCount, g_count, sizeof(int), cudaMemcpyDeviceToHost);
        if (*g_hostCount == 0) break;
    }
    // After the first launch both buffers agree on every tile not processed last; `a` is complete.
    if (a != grid) cudaMemcpyAsync(grid, a, n * sizeof(uint32_t), cudaMemcpyDeviceToDevice);
}
