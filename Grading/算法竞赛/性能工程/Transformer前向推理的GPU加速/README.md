# Transformer前向推理的GPU加速：测试数据

本目录是题目《Transformer前向推理的GPU加速》的测试数据和出题工具。8 个 shape 写在题面里；权重、输入和答案的具体数值不公开，**不能让被测模型接触**。

## 目录内容

| 路径 | 说明 |
|---|---|
| `performance/inputs/input_01.bin` – `input_08.bin` | 8 个性能输入，每个 shape 一个 |
| `performance/expected/expected_01.bin` – `expected_08.bin` | 对应的标准答案（FP32 原始数据），由 FP64 求解器算出 |
| `generator/gen_hidden.cpp` | 输入生成器和 FP64 求解器 |
| `grader/grader.cu` | 官方评测程序，与题面第四节中的代码一致 |
| `baselines/reference_solution.cu` | 基线：FP32，共享内存分块，注意力融合在线 softmax，不用张量核心。每次评测重新运行，其用时 $R_i$ 是加速比的分子 |
| `validation.json` | 每个性能输入所属的类别，`evaluate.py` 报告用 |

`.bin` 不进 git。在本目录用下面的命令重建，约 10 分钟，主要占 CPU：

```powershell
g++ -O3 -march=native -fopenmp -std=c++17 -static -o generator\gen_hidden.exe generator\gen_hidden.cpp
generator\gen_hidden.exe
```

## 八个输入

格式 `B/S/D/H/F/L`。超长序列以外的输入计算量都不低于 800 GFLOP（$L(2BS^2D+8BSD^2+4BSDF)$），用加大批量达到，以降低短任务的计时波动。

| 编号 | 类 | 参数 | GFLOP | 基线用时（ms） | 基线吞吐（TFLOP/s） |
|---|---|---|---:|---:|---:|
| 01 | 大批量短序列 | 10000/128/128/4/128/4 | 1174 | 254.3 | 4.6 |
| 02 | 高维 | 48/256/1024/8/2048/4 | 850 | 102.8 | 8.3 |
| 03 | 长序列 | 4/16384/128/4/128/4 | 1151 | 217.5 | 5.3 |
| 04 | 超长序列 | 1/100000/1024/16/1024/2 | 43477 | 8776.8 | 5.0 |
| 05 | 窄头 | 430/1024/128/32/128/4 | 808 | 515.9 | 1.6 |
| 06 | 少头宽头 | 380/512/256/1/256/4 | 816 | 167.9 | 4.9 |
| 07 | 深层 | 1200/256/64/4/64/32 | 805 | 260.6 | 3.1 |
| 08 | 常见配比 | 144/512/256/8/1024/6 | 812 | 122.7 | 6.6 |

基线吞吐的几何平均为 4.5 TFLOP/s。
