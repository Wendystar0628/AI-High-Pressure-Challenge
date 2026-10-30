# 网格沙粒倒塌的GPU加速 · AI 评分指南

- 材料：题面 `E:\Project\AI_OneShot_Bench\算法竞赛\性能工程\网格沙粒倒塌的GPU加速.md`（第八、九、十二节）；本目录的 `grader/grader.cu`、参考解法 `baselines/reference_solution.cu`（`weak_solution.cu` 不用）、`performance/`（24 个性能输入）、`correctness/`（7 个正确性输入）、`validation.json`；上一级目录的 `evaluate.py` 及其说明 `README.md`。
- 满分 100 分。本题整题在评分最后阶段统一串行测量。

## 测量与计分

- 把 `grader.cu`、提交的 `solution.cu` 和参考解法复制到纯英文路径（如 `C:\eval\sand\`，中文路径会触发大量无害警告）。先执行 `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat` 进入 x64 开发环境，再用题面第七节的命令分别编译：`nvcc -O3 -std=c++17 -arch=sm_89 -Xcompiler "/O2 /utf-8" -o submission.exe grader.cu solution.cu`；参考解法把 `solution.cu` 换成 `reference_solution.cu`、输出 `reference.exe`。然后运行一次：

  ```
  python E:\Project\AI_OneShot_Bench\Grading\算法竞赛\性能工程\evaluate.py --task sand --exe <提交.exe> --reference <参考解法.exe> --report <报告.json> --pause 1
  ```

- 得分以 `evaluate.py` 的 `score` 为准：每个性能输入按 $s_i=R_i/C_i$ 在题面第十二节的锚点表上插值（$s_i$ 为 0.2、0.5、1、2、4、8、20 时得 0、5、20、37、55、74、100 分），运行失败的输入记 0 分；24 个输入得分的平均 × 通过的正确性输入个数 ÷ 7。$G$ 只作参考。
- $s_i\ge20$ 的输入注明需要复核；`health` 警告不改变得分；参考解法本身运行失败时本次评测作废，来信说明。
- 源文件名或位置与题面略有出入的从宽；函数接口、编译和第九节规则照常要求。

## 记 0 分的情形

- 编译失败。
- 违反题面第九节任一条规则（以题面原文为准）：
  1. 单个 `solution.cu`，不超过 256 KB，实现 `init()` 和 `solve()`，不含 `main()`。
  2. 只用 C++ 标准库、CUDA Runtime API、设备端功能和 CUDA Toolkit 自带的头文件库；不调用 Driver API，不用其他第三方库。
  3. 全部计算在 `solve()` 中由 GPU 完成：主机只读回少量控制信息，不复制回网格、不在 CPU 上算格子；`init()` 只分配、清零、建运行时对象，不做其他计算，返回后解法的主机线程不再工作。
  4. 不读写文件，不用或改动标准输入、输出和错误，不联网，不启动其他进程。
  5. 程序通用，不针对具体输入硬编码结果，不在源码中内嵌预先算好的数据。
  6. 多次调用时 `init()` 能按新的 $L$ 重新初始化，每次 `solve()` 重新初始化状态、不复用之前的结果，结果写回 `grid` 且不释放它，返回前提交全部 GPU 工作。
  7. 不改评测程序，不干扰任何一次运行的计时；不改处理器亲和性和优先级，不超出给定的逻辑处理器；不改系统设置或留下进程结束后的状态，不影响其他进程。
  8. 每次运行的整个进程不超过 60 秒。
- 规则审查：通读提交源码，检索 Driver API（`cu` 开头的驱动函数）、文件读写、启动进程、改亲和性或优先级、大段内嵌数据和按输入内容分支的代码；没有疑点就不再逐条细查，有疑点再对照原文核实。
- 规则 5 的认定：看程序是否按具体输入的内容分支，或内嵌针对评测输入算好的结果；与输入无关的通用常量表不算违规。性能输入上运行失败只记该输入 0 分，不据此认定违反规则 5。
- 规则 8 的认定：单次运行超过 60 秒，由 `evaluate.py` 判该次运行失败，按该输入失败计分，不据此记整题 0 分。

## 输出

得分；正确性输入通过个数（k/7）；24 个输入得分的平均和 $G$；evaluate.py 报告的路径；第九节规则的审查结论：未发现违规写一句，发现时写明条目和依据。
