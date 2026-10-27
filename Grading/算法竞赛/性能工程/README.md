# 性能工程评测数据与工具

两题各包含固定的 8 个性能输入，另各有 7 个正确性输入。电路正确性输入包括 6 个小规模用例及 1 个完整规模的同步语义用例；沙粒正确性输入为小规模网格。正确性用例不参与计分，但任一失败即记 0 分。

## 使用方法

1. 按各题题面的编译命令，将对应 `grader/grader.cpp` 或 `grader/grader.cu` 分别与最终提交、`baselines/weak_solution.*`（弱基线）和 `baselines/strong_solution.*`（强基线）编译成三个可执行文件。编译失败直接记 0 分，本脚本不负责编译。
2. 在本目录使用 Python 3.12 运行：

```powershell
python evaluate.py --task circuit --exe C:\eval\circuit\grader.exe --weak C:\eval\circuit\weak.exe --strong C:\eval\circuit\strong.exe --report C:\eval\circuit-result.json
python evaluate.py --task sand --exe C:\eval\sand\grader.exe --weak C:\eval\sand\weak.exe --strong C:\eval\sand\strong.exe --report C:\eval\sand-result.json
```

## 一次评测会话

每个进程以高优先级、CPU 亲和掩码 `0xffff`（可用 `--affinity` 指定）和 `OMP_NUM_THREADS=16` 启动，最长 60 秒，超时判为失败。所有进程顺序运行，不同会话不能同时进行。

1. 提交的 7 个正确性输入各运行一次。任一失败即记 0 分，后面的步骤都不再运行。
2. 弱基线在 8 个性能输入上各运行一次。
3. 强基线在 8 个性能输入上各运行一次，仅供参考，不影响提交得分。
4. 提交在 8 个性能输入上各运行一次。

计分与题面一致：每个性能输入单独计分，$s_i=W_i/C_i$，按题面的锚点表在 $\ln s_i$ 上分段插值得到该输入的 0–100 分，本题得分为 8 个输入得分的平均值，都保留一位小数。锚点电路为 $s_i$ = 1、4、8、12、20、32、48 对应 0、3、15、30、52、75、100 分，沙粒为 $s_i$ = 1、2、4、8、16、32 对应 0、2、10、30、60、100 分。$s_i\le1$ 的输入得 0 分；提交在某个性能输入上运行失败，该输入记 0 分，其余照常计分；任一正确性输入失败，整题记 0 分。报告另给出 $G=\exp(\mathrm{mean}\ \ln s_i)$ 作参考，不用于计分。某个输入的 $s_i$ 达到或超过满分锚点时，该输入记 100 分，并标注需人工复核。提交的计时低于 0.001 ms（评测程序输出为 0.000）时按 0.001 ms 计算，同样标注需人工复核；弱基线出现这种计时则会话作废。弱基线本身失败时会话作废（`score` 为 `null`），排查环境后重测。

报告中的 `health` 把本次弱基线耗时与 `validation.json` 的记录比较，单输入偏差超过 10% 或几何平均偏差超过 5% 时给出警告，不改变得分。单次运行的正常波动约 5–7%，超过阈值通常意味着有别的程序占用 GPU 或 CPU、降频或绑核错误，应排查环境后重测。

其他选项：`--correctness-only` 只检查正确性；`--pause` 为每次运行前的停顿秒数，默认 0。退出码：0 为得分大于 0，1 为记 0 分，2 为会话作废。

## 重新生成与校验

```powershell
python gen_correctness.py
```

此命令重建两题的小规模正确性输入及答案。电路参考实现采用逐激励、逐周期的标量计算与同时更新；沙粒参考实现采用串行工作队列进行合法倒塌，与 GPU 同步迭代基线独立。

性能输入的生成参数和基线耗时位于各题目录。
