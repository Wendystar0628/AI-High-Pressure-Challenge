# 光线追踪渲染加速评分端

当前为一个江南园林性能输入、12 个隐藏正确性输入和 3 个公开边界输入。满分倍率 10 倍；加速比 1/2/4/6/8/10 对应速度分 0/22/50/70/87/100，相邻锚点按对数插值。此题已登记，评分指南和评分表已补齐。

## 文件与共同设置

`reference.cu` 与公开材料相同：单线程 16 桶 SAH、遮挡查询遇到任意交点即返回、朴素遍历、一线程一样本、样本缓冲后求平均。`oracle.cu` 以一线程一样本生成双精度样本缓冲，再以固定样本顺序求和并转换成 float32；`oracle_check.cu` 用一 warp 一像素、按 lane 分配样本的独立内核形式；设置 `RT_ORACLE_DOUBLE_OUTPUT` 时，两者另存转换前的 float64 平均值；`oracle_cpu.cu` 在 CPU 上用平面求交加 Gram 重心坐标暴力核对，使用不同于 GPU 的求交公式。

`rt_eval.py` 是检查和评分共用的判定及运行代码，公开副本在材料的 `数据\` 中。`settings.json` 的 `timing` 集中设置次数和统计量，目前为各 5 次取最小值；正式条件为逻辑处理器 16–27、高优先级。公开与评分端使用同一份设置，变更时同步复制。

`manifest.json` 的 `performance`、`boundary`、`hidden` 三个列表决定输入个数。每条含 `id, input, expected, width, height, baseline_exceptions`；性能输入另含 `name` 和 `anchors`；`settings.json.scoring` 保存同样的锚点及 `full_speedup=10`，清单未填锚点时从设置读取；隐藏输入用 `for` 指向对应性能输入的 `id`。不根据文件名推断分组。

## 重建基线与答案

```
python build.py --source reference.cu --output reference.exe
python build_oracles.py
python generate_answers.py --oracle oracle.exe --oracle-check oracle_check.exe --cpu-oracle oracle_cpu.exe --reference reference.exe
```

`generate.py` 调用同目录的 `garden.py` 生成输入和清单，`--main-spp` 设置性能输入的样本数；`--publish` 只发布公开材料。答案脚本读取清单，不生成几何；每条输入先运行两种双精度 GPU 内核，要求全部输出有限，转换前的 float64 结果与最终 float32 答案均逐位相同，再用 CPU 暴力抽查 32 个确定性像素（另可在清单的 `cpu_probe_pixels` 中追加回归点）。CPU 与 GPU 的逐通道误差上限为 `1e-6+1e-6*abs(CPU)`。两项均通过后才运行单精度基线，统计 b，按 `4b+20` 和原有偏差、均方根误差检查。全部输入都通过后才发布答案、图片及清单；旧的错误输出会被核对流程拒绝。公开性能输入会生成 PNG 与拼版。PNG 只用于查看，判定始终读取原始线性 RGB。

## 评分

```
python evaluate.py --source path\solution.cu --output path\result
```

基线与提交使用独立进程，交错运行，每一对交换先后；每次都检查画面。按已定锚点计算速度分 q、5 次计时画面系数 c、12 个隐藏输入系数 h，本题得分为 q×c×h。只给公开输入的自测不含 h，不能当作最终分数。

每次运行前通过系统自带 NVML 查询显卡进程和利用率；NVML 不可用时退回 `nvidia-smi`。一次显卡故障后，该输入后续提交运行全部记失败，等 15 秒并用基线微型样例探测恢复；同一提交第二次故障停止它后续的全部显卡运行。运行失败、缺输出、非有限值均记失败。基线任何一次失败或不通过，整次评测作废，写 `invalid.json`，排除环境问题后重跑。

本机驱动 610.88 会把普通桌面进程也列成 C+G。脚本记录完整进程表，再通过只读模块快照识别加载了 `nvcuda.dll` 的 CUDA 进程，结合不高于 10% 的利用率判空闲，查询后端写入记录。读取不到模块的 PID 记在 `unclassified_pids`，不据此断言独占；正式评测仍须先由指挥安排独占窗口。

显卡超时恢复的真实触发验证尚未做，须由指挥安排不影响其他工作的窗口；这里不会主动触发。

## 规则核对

`python rules_scan.py path\solution.cu` 只标可疑行，不自动判违规。随后在英文临时目录用本机 Nsight Systems 追踪一个性能输入：

```
nsys profile --trace=cuda --sample=none --cpuctxsw=none -o trace .\submission.exe input.bin output.bin
nsys stats --report cuda_gpu_mem_size_sum trace.nsys-rep
```

评测程序自身回传最终图像 `width*height*12` 字节，另有预热有限值核对的 12 字节。扣掉这部分后，少量控制信息回传允许，总量超过约 1 MB 需要重点查看。主机上传应与三角形、树和队列同量级。最终由评分员结合扫描和追踪读源码判断：第三方光追库、硬件光追接口、跨调用场景缓存、预计算图像，以及 render 返回后的主机线程行为。不得把允许的按规模选实现或少量控制信息当作违规。

旧逐像素双精度程序在园林 960×540 回归中错 45 个像素，最大误差约 0.3321。已替换的两个 GPU 内核逐位一致，CPU 35 点抽查误差为 0；本次 b=195，上限为 800。最小化复现、检查记录和根因调查见 `调研/光追题设计/成稿实验/oracle_fix/`。
