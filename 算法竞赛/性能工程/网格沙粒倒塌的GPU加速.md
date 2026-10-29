# 题目

本题是一道性能优化工程题：在结果正确的前提下，让你的程序尽可能快。采用什么优化策略、怎样实现，由你自己决定。

越接近性能极限，同样的提速在计分中的分量越大。请用好全部时间，尽可能做出更好的结果。作答过程中，如果某个方向的方案难以继续推进，可以考虑换一个思路。

## 一、问题

在 $L\times L$ 的网格上，格子记为 $(x,y)$，其中 $0\le x,y<L$。每个格子上有 $h(x,y)$ 粒沙，$h(x,y)$ 为非负整数。

**倒塌规则**：若某个格子满足 $h(x,y)\ge 4$，它可以倒塌一次：

$$
h(x,y)\leftarrow h(x,y)-4,
$$

同时，四个相邻格子 $(x\pm1,y)$、$(x,y\pm1)$ 中位于网格内的，各加 1。落到网格外的沙粒直接消失。

反复执行倒塌，直到所有格子都满足 $h(x,y)<4$，称为**稳定状态**。可以证明，这一过程总会在有限步内结束，并且结束时的稳定状态是唯一的。

**任务**：给定初始状态，求最终的稳定状态。初始状态由若干堆沙给出：第 $p$ 堆在格子 $(x_p,y_p)$ 上放 $c_p$ 粒沙，同一个格子上的多堆沙粒数累加，其余格子初始为 0。

## 二、测试文件格式

每个测试输入是一个文本文件，由评测程序读取并解析，解法不需要自己读文件。格式如下：

- 第一行两个整数 $L\ P$。
- 接下来 $P$ 行，每行三个整数 $x_p\ y_p\ c_p$。

## 三、函数接口

提交的 `solution.cu` 中实现下面两个函数：

```cpp
#include <cstdint>

void init(int L);
void solve(uint32_t* grid, int L);
```

- `grid` 指向评测程序用 `cudaMalloc` 分配的显存，共 $L^2$ 个 `uint32_t`，第 $yL+x$ 个元素为 $h(x,y)$。调用 `solve()` 时其中已是初始状态：评测程序已在主机上把同一格子上的多堆沙粒累加好并上传。
- `solve()` 必须在 `grid` 中原地求出稳定状态：GPU 上的工作全部完成时，每个元素为稳定状态下的 $h(x,y)$，取值为 0–3。`solve()` 返回时 GPU 上的工作可以尚未完成，评测程序随后调用 `cudaDeviceSynchronize()` 等待并检查 CUDA 错误。
- 每次调用 `solve()` 之前，评测程序都会先以相同的 $L$ 调用一次 `init()`，供解法做准备工作，允许的范围见第九节规则 3。`init()` 不计时，可能被调用多次，每次的 $L$ 可以与上一次不同。

## 四、评测程序

评测程序 `grader.cu` 如下。它创建 CUDA 上下文，读取并解析测试文件，在主机上累加各堆沙粒得到初始网格，分配显存并上传，调用 `init()`，再计时调用 `solve()` 并等待 GPU 完成；最后把网格下载回主机，检查每个格子都不超过 3，按每行 $L$ 个数字写到标准输出（第 $y$ 行第 $x$ 个字符为 $h(x,y)$），并把计时写到标准错误。

```cpp
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
```

## 五、样例

**样例 1 测试文件**

```
3 1
1 1 4
```

**样例 1 评测程序输出**

```
010
101
010
```

**样例 2 测试文件**

```
5 2
2 2 40
0 4 7
```

**样例 2 评测程序输出**

```
01310
12321
33033
22321
32310
```

样例 2 就是评测程序预热时使用的输入。

## 六、数据规模

- $L=4096$。
- $1\le P\le 2\times10^{6}$。
- $0\le x_p,y_p<L$，$c_p\ge 1$。
- 沙粒总数 $C=\sum c_p$ 满足 $C\le 2^{23}$。

上述规模用于 **24 个隐藏性能输入**：8 类沙粒分布，每类 3 个参数不同的实例。另有 **7 个小规模隐藏正确性输入**：$1\le L\le128$，其余 $P$、坐标、沙粒数约束不变。

所有隐藏输入事先固定，对所有提交相同，不公开。

## 七、评测环境

| 项目 | 配置 |
|---|---|
| 操作系统 | Windows 11 专业版（内部版本 26200） |
| CPU | Intel Core i7-14700KF：8 个性能核 + 12 个能效核，共 28 个逻辑处理器，L3 缓存 33 MB；支持 AVX2，不支持 AVX-512 |
| 内存 | 64 GB |
| GPU | NVIDIA GeForce RTX 4080：16 GB 显存，计算能力 8.9（sm_89），驱动 610.88，WDDM 模式（同时负责显示输出） |
| CUDA | CUDA Toolkit 13.2（nvcc V13.2.78） |
| 主机编译器 | MSVC 14.44（Visual Studio 2022 Build Tools） |

在 Visual Studio 的 x64 开发环境中（先执行 `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat`），使用以下命令编译：

```
nvcc -O3 -std=c++17 -arch=sm_89 -Xcompiler "/O2 /utf-8" -o grader.exe grader.cu solution.cu
```

评测时进程被限制在 8 个性能核（逻辑处理器 0–15，共 16 个）上，并以高优先级运行。

## 八、计时与评价

- 只计评测程序对隐藏输入的那一次 `solve()` 调用的墙钟时间：从调用开始，到其后的 `cudaDeviceSynchronize()` 返回为止。评测程序中的其余步骤（含样例预热）都不计时。样例预热的结果同样必须正确，且不能出现 CUDA 错误。
- 每个正确性输入和性能输入都在独立进程中运行 1 次，正确性输入不计时。每次运行的输出都必须与标准答案完全一致。
- 同一次评测中，参考解法（出题人写的通用优化解法，代码不公开）和提交在每个性能输入上各运行一次，两者的运行条件完全相同：同一组处理器、同样的优先级和环境变量。

## 九、规则

1. 提交单个源文件 `solution.cu`，大小不超过 256 KB。其中实现 `init()` 和 `solve()`，不包含 `main()`。
2. 只能使用 C++ 标准库、CUDA Runtime API、CUDA C++ 语言本身的设备端功能（含内建函数和内联 PTX），以及 CUDA Toolkit 自带、无需额外链接的头文件库（如 CUB 和 Thrust）；不能通过任何方式调用 CUDA Driver API，不能使用其他第三方库。
3. 求稳定状态的全部计算必须在 `solve()` 调用中由 GPU 完成；只要结果正确，计算方式不限。
   - 主机端可以读回由 GPU 算出的少量控制信息（总量与 $L^2$ 相比可以忽略），并据此决定是否继续提交工作；不能把网格内容复制回主机，也不能在 CPU 上对格子数值做任何计算。
   - `init()` 只能分配和释放显存与主机内存（包括锁页内存）、把解法自己分配的缓冲区清零、创建流和事件等运行时对象；除清零外，不能在 GPU 或 CPU 上做任何计算，包括只依赖 $L$ 的预计算；不能读取或修改评测程序的网格。`init()` 返回时，解法创建的主机线程不能再做任何工作。
4. 解法不能读写任何文件，不能使用或改动标准输入、标准输出和标准错误，不能联网，不能启动其他进程。
5. 程序必须是通用的：对任意满足第一节和第六节约束的输入都要返回正确结果。不能针对具体输入硬编码结果，也不能在源码中内嵌预先算好的数据。
6. 同一个进程中 `init()` 和 `solve()` 会被调用不止一次，输入和规模可以不同（预热时 $L=5$，之后为测试输入的 $L$）。`init()` 必须能在已经初始化过的情况下按新的 $L$ 重新初始化。允许复用已分配的显存，但每次 `solve()` 必须重新初始化本次状态，不能复用之前调用的计算结果。结果必须写回 `grid` 本身，`solve()` 不能释放 `grid` 所指的显存；所有 GPU 工作都必须在 `solve()` 返回前提交，返回后不能再有主机线程继续提交工作。
7. 不能修改评测程序，不能以任何方式干扰任何一次运行的计时（包括参考解法的运行）。不能修改进程或线程的处理器亲和性和优先级，使用的逻辑处理器不能超出评测时给定的范围；线程数可以自行决定。不能修改系统设置或任何能延续到本进程结束之后的状态，不能访问或影响本进程以外的任何进程。
8. 每次运行的整个进程不超过 60 秒。内存和显存请合理使用（显卡同时负责显示输出），不要因占用过多导致内存、显存紧张或运行异常。
9. 允许使用多线程。

## 十、规定

1. 开发时间为 60 分钟，从拿到题目开始计算。
2. 全程不能联网：不能使用网页搜索、网页抓取等联网工具，不能下载或安装软件包，也不能调用其他 AI 模型或服务。
3. 全程不得访问 GitHub 上的任何仓库，无论通过网页、`git`、`gh` 命令行还是 API。
4. 工作目录是本题面所在的文件夹，即 `H:\AI_OneShot_Model\<厂商>\<型号>\<题名>\`，开始作答时你就在这个目录中。所有文件只能在这个文件夹内读取、创建和修改；绝对禁止访问其他任何文件路径，包括同一型号下其他题目的文件夹；只有运行编译器、解释器、库、浏览器等必需工具时必须访问的安装路径和临时目录除外。
5. 开发期间可以在本机上编译、运行和测试，也可以编写任何辅助程序；只有最终提交的 `solution.cu` 需要遵守第九节的规则。
6. 测试输入需要自己构造。
7. 时间到时，你的作答会被直接中止，时间预算不会延长。工作目录是一个 git 仓库。评分时先看工作目录：工作目录完整可用时，以那时工作目录中的 `solution.cu` 作为最终提交；停在半途（例如改到一半、文件不完整、无法编译或运行）的，以最近一次 git 提交中的 `solution.cu` 作为最终提交。
8. 作答期间每 10 分钟会发出已用时间和剩余时间的简短提醒，长时间思考或运行工具时可能延迟。每完成一个完整可用的阶段，就用 git 提交（`git add -A` 后 `git commit`）。有已提交的版本兜底，可以大胆推进，每有可用改进就提交。
9. 全程独立作答，不得开启子代理（subagent），也不得使用任何多代理或并行协作功能。
10. 严禁使用以下命令：`runas`，以及任何以其他账户身份登录、需要输入账户密码的命令；按进程名批量结束进程的命令（`taskkill /IM`、`pkill`、`killall`、`Stop-Process -Name` 等）。需要结束进程时，只按 PID 结束你自己启动的进程。这些命令会锁定评测账户或误杀评测系统的进程，导致你的会话被中止。

## 十一、注意事项

1. 隐藏性能输入覆盖面很广：24 个输入分属 8 类沙粒分布，在堆的多少和大小、在网格中的位置与疏密、沙粒总量等方面差别很大。只在一两种输入上调优，换一类分布可能明显变慢甚至出错。建议优化时自己构造多种类型、不同规模的测试用例，分别测速，并与一个简单可靠的实现核对结果。
2. Windows WDDM 启用了 GPU 超时检测与恢复（TDR），默认抢占等待超时约为 2 秒；长时间无法完成或无法被抢占的 GPU 任务可能触发驱动重置。
3. RTX 4080 同时负责显示输出。评测时会关闭其他占用 GPU 的程序，但运行时间仍可能有少量波动。
4. 本机系统代码页为 936（简体中文）。编译命令中的 `/utf-8` 用于避免 CUDA 头文件触发大量 C4819 警告；源文件请保存为 UTF-8 编码。
5. 源文件所在路径含有中文时，nvcc 生成的中间文件会让 MSVC 报出大量 C4828、C4129 警告。这些警告不影响编译结果，在纯英文路径下编译可以避免。
6. 部分命令行环境设置了环境变量 `NoDefaultCurrentDirectoryInExePath`，此时 `cmd` 不会在当前目录中查找可执行文件。运行当前目录下的程序时，请写成 `.\grader.exe`。

## 十二、评分标准

评分对提交格式很宽容，格式上的小出入不用担心；但评测必需的内容仍按题面：`solution.cu` 能用第七节的命令与评测程序一起编译，`init()`、`solve()` 的接口与第三节一致，并遵守第九节的规则。

满分 100 分。24 个性能输入各自单独计分，本题得分为 24 个输入得分的平均值。

设性能输入 $i$（$i=1,\dots,24$）上参考解法与提交的计时分别为 $R_i$、$C_i$，加速比 $s_i=R_i/C_i$。输入 $i$ 的得分按 $s_i$ 在对数尺度上分段插值，锚点如下：

| $s_i$ | 0.2 | 0.5 | 1 | 2 | 4 | 8 | 20 |
|---|---|---|---|---|---|---|---|
| 得分 | 0 | 5 | 20 | 37 | 55 | 74 | 100 |

$s_i\le0.2$ 时该输入得 0 分，$s_i\ge20$ 时得 100 分。$s_i$ 位于相邻锚点 $a_k\le s_i\le a_{k+1}$ 之间、两锚点的得分为 $p_k$、$p_{k+1}$ 时：

$$
\text{得分}_i=p_k+(p_{k+1}-p_k)\,\frac{\ln(s_i/a_k)}{\ln(a_{k+1}/a_k)}
$$

$$
\text{本题得分}=\frac{k}{7}\cdot\frac{1}{24}\sum_{i=1}^{24}\text{得分}_i
$$

其中 $k$ 为通过的正确性输入个数（0–7）。

各输入得分和本题得分都保留一位小数。越接近高加速比，同样的提速得分越多。
