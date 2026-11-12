# 数字电路仿真器加速 · AI 评分指南

- 评分版本：一律评作答结束时工作目录中的内容，不看 git 提交。

- 材料：题面 `E:\Project\AI_OneShot_Bench\性能优化\性能工程\数字电路仿真器加速.md`（第九、十、十三节）；本目录的 `grader/grader.cpp`、基线 `baselines/reference_solution.cpp`、`performance/`（9 个性能输入）、`correctness/`（7 个正确性输入）；上一级目录的 `evaluate.py` 及其说明 `README.md`。
- 满分 100 分。本题整题在评分最后阶段统一串行测量。
- 性能只在这 9 个输入上计分；7 个隐藏正确性输入不计时，其他电路只要求算对。

## 测量与计分

- 用题面第八节的命令分别编译（g++ 在 `C:\msys64\ucrt64\bin`，运行时也要在 PATH 中）：`g++ -O2 -std=c++20 -march=native -fopenmp -o submission.exe grader.cpp solution.cpp`；基线把 `solution.cpp` 换成 `reference_solution.cpp`、输出 `reference.exe`。然后运行一次：

  ```
  python E:\Project\AI_OneShot_Bench\Grading\性能优化\性能工程\evaluate.py --task circuit --exe <提交.exe> --reference <基线.exe> --report <报告.json>
  ```

- 正式评分仍按上述命令从源码重新编译基线，不使用作答材料中的 `reference.exe`；该程序仅供 `check.py` 现场核对。`evaluate.py` 在每个性能输入上让基线和提交各运行 3 次，交错进行，各取中位数，不使用预先记录的基线用时。
- 得分以 `evaluate.py` 的 `score` 为准：每个性能输入按 $s_i=R_i/C_i$ 在题面第十三节对应类别的锚点表上插值：深链和阵列乘法器（输入 1–6）在 $s_i$ 为 0.1、0.5、1、2、4、6、8、10、12 时得 0、5、12、27、47、62、76、89、100 分；寄存器堆（输入 7–9）在 $s_i$ 为 0.1、0.5、1、2、4、6、8 时得 0、5、15、35、65、85、100 分；两端封顶，运行失败的输入记 0 分；9 个输入得分的平均 × 通过的正确性输入个数 ÷ 7。$G$ 只作参考。
- 基线本身运行失败时本次评测作废，来信说明。
- 源文件名或位置与题面略有出入的从宽；函数接口、`Circuit` 的定义、编译和第十节规则照常要求。

## 记 0 分的情形

- 编译失败。
- 违反题面第十节第 1–7 条任一条（以题面原文为准）：
  1. 单个 `solution.cpp`，实现 `simulate()`，不含 `main()`。
  2. 只用 C++ 标准库、OpenMP、Windows API、编译器内建函数和 CPU 指令内在函数，不用其他第三方库。
  3. 只用 CPU 计算，不用 GPU。
  4. 不读写文件，不用或改动标准输入、输出和错误，不联网，不启动其他进程。
  5. 多次调用 `simulate()` 时，每次都在返回前算完。
  6. 不改评测程序，不干扰任何一次运行的计时；不改处理器亲和性和优先级，不超出给定的逻辑处理器；不改系统设置或留下进程结束后的状态，不影响其他进程。
  7. 摘要由 `simulate()` 根据传入的电路算出，没有把标准答案或预先算好的摘要写进提交。

## 输出

得分；正确性输入通过个数（k/7）；9 个输入得分的平均和 $G$；evaluate.py 报告的路径。
