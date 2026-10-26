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

计分与题面一致：$s_i=W_i/C_i$，$G=\exp(\mathrm{mean}\ \ln s_i)$，得分 $=100\times\min(1,\ \ln G/\ln S_{\max})$，保留一位小数；$S_{\max}$ 电路为 316，沙粒为 576。任一正确性输入失败、任一性能输入运行失败、任一性能输入上 $C_i>W_i$，记 0 分。$G\ge S_{\max}$ 时记 100 分，并标注需人工复核。提交的计时低于 0.001 ms（评测程序输出为 0.000）时按 0.001 ms 计算，同样标注需人工复核；弱基线出现这种计时则会话作废。弱基线本身失败时会话作废（`score` 为 `null`），排查环境后重测。

报告中的 `health` 把本次弱基线耗时与 `validation.json` 的记录比较，单输入偏差超过 5% 或几何平均偏差超过 3% 时给出警告，不改变得分。

其他选项：`--correctness-only` 只检查正确性；`--smax` 临时改用其他 $S_{\max}$，此时报告不作为正式成绩；`--pause` 为每次运行前的停顿秒数，默认 0。退出码：0 为得分大于 0，1 为记 0 分，2 为会话作废。

## 重新生成与校验

```powershell
python gen_correctness.py
```

此命令重建两题的小规模正确性输入及答案。电路参考实现采用逐激励、逐周期的标量计算与同时更新；沙粒参考实现采用串行工作队列进行合法倒塌，与 GPU 同步迭代基线独立。

性能输入的生成参数和基线耗时位于各题目录。
