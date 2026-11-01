# 清理机制报告（Sol）

结论：UESTC_RPG 的机制是明确列出一次性产物、默认只预览、按主线提交次数判过期、保留长期数据和仍被引用的证据，并在构建锁内重新判断。本项目迁移了“先列后动、明确范围、在用不动、锁内重算、证据保留”这几项；触发改为一题所有评分员的所有分段完成且有有效结果，动作改为同卷移动到时间戳待删除目录。**没有迁移永久删除、工作树清除和按提交数过期。**

交付状态：`orchestrator/cleanup.py` 和新增 playbook 文档已放到位；现有 `grading.py`、`tests/test_automation.py` 仅交付实验目录的改好副本及 diff，未替换运行中的文件。**自动调度尚未在现行监督进程里启用。** 未运行真实目录的 `run`，未修改真实状态，未永久删除、未使用回收站、未重启监督，未开浏览器、联网或运行 CPU/GPU 基准。

## 1. UESTC_RPG 中值得迁移的机制

只读依据：`E:\Project\UESTC_RPG\scripts\build\clean-artifacts.py`；`docs/workflow/WF-RULE-全员守则.md` §13；`.collab/tools/monitor/read/repo.py`、`monitor/check/workspace.py` 的清理提示接入。未运行其清理脚本，未改动该项目。`E:\Project\UESTC_RPG.wt` 本次为空，Git 只登记了主工作树。

| 机制 | 原项目做法 | 本次迁移 |
|---|---|---|
| 范围 | `output/`、工作树 `output/`、废弃工程 `bin/obj`；缓存旧格式另判 | 只认评分副本/临时产物和少量可再生检查缓存，不按目录名“看起来像垃圾”扩张到作品 |
| 无用判定 | 默认之后主线已有 20 次提交；旧缓存格式、无工程的编译目录另判 | 以评分生命周期为准；未知类别留报告 |
| 触发 | 主会话每任务结束预览；巡逻提示；显式 `--delete` 执行 | 在 `grading.advance()` 的 `reap()` 后、`start()` 前按题处理；失败下次继续 |
| 防误清 | 同一构建锁内重算；长期目录、未结任务/审计/通知引用、失败证据保护 | 共用现有状态锁；检查仍在作答、配置中的全部评分员/分段及结果；保护评分数据、运行文件与链接目标 |

无需照搬 RPG 的任务引用账本、失败证据引用解析、提交年龄或工作树登记维护；这些与本项目的按题清理无关。

## 2. 统计口径与总清单

元数据扫描：2026-11-01 17:32:59 至 2026-11-01 17:39:20（本机时间）；补充只读清单：2026-11-01 17:43:07。只读取目录、文件名、逻辑大小等元数据；未打开两账户的会话历史或凭据文件。另只读了模型 `.gitignore`、Git 文件清单及评分 `result.json` 等项目数据。

统计总计 **117.519 GiB、692,099 个文件**。这是本次列出的范围之和，包含管理员的其他项目缓存/会话，并非全是本项目可清空间。大小是逻辑长度，不等于已分配磁盘空间；空目录不计文件数；目录联接/符号链接不跟随。跳过 18 个重解析点，扫描错误 0 个。正在运行的系统没有冻结，分时扫描会有正常变化，各次清单不应硬相加。

### 按大小排序

| 区域 | 根路径 | 大小 | 文件数 | 有用/无用判断 |
|---|---|---|---|---|
| 管理员临时 | `C:\Users\Administrator\AppData\Local\Temp` | 45.142 GiB | 547,157 | 混有其他项目和活跃会话，待定 |
| 管理员_codex | `C:\Users\Administrator\.codex` | 33.959 GiB | 21,778 | 跨项目会话历史/安装保留，共享缓存待定 |
| 作答 | `H:\AI_OneShot_Model` | 13.786 GiB | 10,681 | 项目有用；复制题材、测试/搜索中间结果待定 |
| 管理员_claude | `C:\Users\Administrator\.claude` | 11.984 GiB | 16,991 | 跨项目会话历史/安装保留，共享缓存待定 |
| AIAgent临时 | `C:\Users\AIAgent\AppData\Local\Temp` | 5.248 GiB | 39,127 | 历史临时物可能无用；共享且可能在用，待定 |
| 评分 | `E:\Project\AI_OneShot_Bench\orchestrator\grading` | 4.766 GiB | 25,170 | 混合：评分证据保留，副本/缓存全题完成后无用 |
| AIAgent_claude | `C:\Users\AIAgent\.claude` | 1.303 GiB | 1,717 | 会话历史保留；共享缓存待定；安装配置保留 |
| 日志 | `E:\Project\AI_OneShot_Bench\orchestrator\logs` | 803.403 MiB | 609 | 会话逐字记录及运行日志，保留至整轮结束 |
| AIAgent_codex | `C:\Users\AIAgent\.codex` | 543.236 MiB | 1,771 | 会话历史保留；共享缓存待定；安装配置保留 |
| 线程运行 | `E:\Project\AI_OneShot_Bench\orchestrator\steer\runs` | 9.875 MiB | 47 | 混合且有本研究活跃线程，保留/待定 |
| 旧测试夹具 | `E:\Project\AI_OneShot_Bench\orchestrator\tests\work` | 6.333 MiB | 27,051 | 无用，但与当前题无法归属，不按题自动搬 |

### 按文件数排序

| 区域 | 文件数 | 大小 |
|---|---|---|
| 管理员临时 | 547,157 | 45.142 GiB |
| AIAgent临时 | 39,127 | 5.248 GiB |
| 旧测试夹具 | 27,051 | 6.333 MiB |
| 评分 | 25,170 | 4.766 GiB |
| 管理员_codex | 21,778 | 33.959 GiB |
| 管理员_claude | 16,991 | 11.984 GiB |
| 作答 | 10,681 | 13.786 GiB |
| AIAgent_codex | 1,771 | 543.236 MiB |
| AIAgent_claude | 1,717 | 1.303 GiB |
| 日志 | 609 | 803.403 MiB |
| 线程运行 | 47 | 9.875 MiB |

### 按类别细分（大小降序）

下表各类别互斥；“源码/交付/其他”是剩余项，包含尚未辨认的搜索二进制，不能把该行全当源码或全当垃圾。截图/媒体也可能是作品素材；构建产物可能是直接打开的网页；`数据` 可能被程序引用。

| 区域 | 类别及判断 | 所在路径 | 大小 | 文件数 |
|---|---|---|---|---|
| 管理员临时 | 全局临时/Chrome/编译缓存，待定（无法可靠归属题目） | `C:\Users\Administrator\AppData\Local\Temp\…` | 45.142 GiB | 547,157 |
| 管理员_codex | 会话历史/状态，整轮前保留 | `C:\Users\Administrator\.codex\…` | 30.785 GiB | 4,926 |
| 管理员_claude | 会话历史/状态，整轮前保留 | `C:\Users\Administrator\.claude\…` | 11.874 GiB | 9,630 |
| 作答 | 复制题材，待定（可能运行引用） | `H:\AI_OneShot_Model\…` | 10.272 GiB | 100 |
| AIAgent临时 | 全局临时/Chrome/编译缓存，待定（无法可靠归属题目） | `C:\Users\AIAgent\AppData\Local\Temp\…` | 5.248 GiB | 39,127 |
| 评分 | 评分work混合目录：副本/缓存无用，证据保留（不能整目录搬） | `E:\Project\AI_OneShot_Bench\orchestrator\grading\…` | 4.548 GiB | 24,678 |
| 管理员_codex | 安装/配置/其他，保留（只计元数据） | `C:\Users\Administrator\.codex\…` | 3.028 GiB | 16,489 |
| 作答 | 源码/交付/其他，保留或待定 | `H:\AI_OneShot_Model\…` | 2.988 GiB | 2,994 |
| AIAgent_claude | 会话历史/状态，整轮前保留 | `C:\Users\AIAgent\.claude\…` | 1.282 GiB | 759 |
| 日志 | 会话/监督日志，保留（整轮结束后处理） | `E:\Project\AI_OneShot_Bench\orchestrator\logs\…` | 803.403 MiB | 609 |
| 作答 | 任务信箱（会话记录保留） | `H:\AI_OneShot_Model\…` | 406.489 MiB | 179 |
| AIAgent_codex | 会话历史/状态，整轮前保留 | `C:\Users\AIAgent\.codex\…` | 384.274 MiB | 22 |
| 评分 | 评分/会话记录，保留 | `E:\Project\AI_OneShot_Bench\orchestrator\grading\…` | 218.226 MiB | 129 |
| 管理员_codex | 工具缓存/诊断，无用或待定（全局共享，不按题搬） | `C:\Users\Administrator\.codex\…` | 149.370 MiB | 363 |
| 管理员_claude | 安装/配置/其他，保留（只计元数据） | `C:\Users\Administrator\.claude\…` | 109.993 MiB | 7,342 |
| AIAgent_codex | 工具缓存/诊断，无用或待定（全局共享，不按题搬） | `C:\Users\AIAgent\.codex\…` | 106.812 MiB | 34 |
| 作答 | node_modules，运行依赖保留 | `H:\AI_OneShot_Model\…` | 62.732 MiB | 2,582 |
| AIAgent_codex | 安装/配置/其他，保留（只计元数据） | `C:\Users\AIAgent\.codex\…` | 52.150 MiB | 1,715 |
| 作答 | .git，保留 | `H:\AI_OneShot_Model\…` | 43.492 MiB | 4,337 |
| AIAgent_claude | 安装/配置/其他，保留（只计元数据） | `C:\Users\AIAgent\.claude\…` | 20.803 MiB | 951 |
| 作答 | 基础设施，保留 | `H:\AI_OneShot_Model\…` | 13.669 MiB | 404 |
| 作答 | 构建/交付产物，待定（可能运行入口） | `H:\AI_OneShot_Model\…` | 12.172 MiB | 26 |
| 线程运行 | 协作线程资料，待定（存在活跃线程） | `E:\Project\AI_OneShot_Bench\orchestrator\steer\runs\…` | 9.875 MiB | 47 |
| 旧测试夹具 | 离线旧夹具，无用（整轮后由指挥处理） | `E:\Project\AI_OneShot_Bench\orchestrator\tests\work\…` | 6.333 MiB | 27,051 |
| 评分 | 共享选版副本，无用（全题评完可搬） | `E:\Project\AI_OneShot_Bench\orchestrator\grading\…` | 4.161 MiB | 304 |
| 管理员_claude | 工具缓存/诊断，无用或待定（全局共享，不按题搬） | `C:\Users\Administrator\.claude\…` | 2.219 MiB | 19 |
| AIAgent_claude | 工具缓存/诊断，无用或待定（全局共享，不按题搬） | `C:\Users\AIAgent\.claude\…` | 1.384 MiB | 7 |
| 评分 | 评分其他证据，保留/待定 | `E:\Project\AI_OneShot_Bench\orchestrator\grading\…` | 0.417 MiB | 39 |
| 作答 | 评分/会话记录，保留 | `H:\AI_OneShot_Model\…` | 0.148 MiB | 40 |
| 作答 | 解释器/检查缓存，无用（未跟踪者可搬） | `H:\AI_OneShot_Model\…` | 0.110 MiB | 19 |
| 评分 | 评分信箱，无用（全题评完可搬） | `E:\Project\AI_OneShot_Bench\orchestrator\grading\…` | 0.004 MiB | 20 |

### 题目路径：按大小排序的前 16 项

作答相对 `H:\AI_OneShot_Model`；评分相对 `orchestrator/grading`。完整逐题逐类别清单见 `实验/按题目类别.csv`。

| 区域 | 厂商/型号/题名 | 大小 | 文件数 |
|---|---|---|---|
| 作答 | `GPT/6.1Sol/Transformer前向推理的GPU加速` | 3.432 GiB | 185 |
| 作答 | `Claude/Sonnet5.5/Transformer前向推理的GPU加速` | 3.431 GiB | 156 |
| 作答 | `Claude/Opus5.5/Transformer前向推理的GPU加速` | 3.427 GiB | 140 |
| 作答 | `GPT/6.1Sol/大规模旅行商回路长度最小化` | 1.473 GiB | 259 |
| 作答 | `Claude/Opus5.5/大规模旅行商回路长度最小化` | 1.163 GiB | 103 |
| 评分 | `Claude/Opus5.5/AE风味动效设计编辑器` | 546.934 MiB | 2,603 |
| 评分 | `Claude/Sonnet5.5/动态路由塔防` | 517.732 MiB | 1,955 |
| 评分 | `Claude/Opus5.5/动态路由塔防` | 470.059 MiB | 1,684 |
| 评分 | `Claude/Opus5.5/果冻冲击与造浪水槽` | 456.339 MiB | 1,622 |
| 评分 | `Claude/Opus5.5/NVIDIA_B200网页艺术` | 438.422 MiB | 1,869 |
| 评分 | `Claude/Sonnet5.5/果冻冲击与造浪水槽` | 348.751 MiB | 1,683 |
| 评分 | `Claude/Opus5.5/太阳雨渔港3D渲染` | 348.732 MiB | 1,566 |
| 评分 | `GPT/6.1Sol/AE风味动效设计编辑器` | 331.606 MiB | 1,877 |
| 评分 | `Claude/Sonnet5.5/AE风味动效设计编辑器` | 323.935 MiB | 2,479 |
| 评分 | `Claude/Sonnet5.5/NVIDIA_B200网页艺术` | 307.193 MiB | 1,422 |
| 评分 | `GPT/6.1Sol/动态路由塔防` | 298.446 MiB | 1,454 |

### 题目路径：按文件数排序的前 12 项

| 区域 | 厂商/型号/题名 | 文件数 | 大小 |
|---|---|---|---|
| 评分 | `Claude/Opus5.5/AE风味动效设计编辑器` | 2,603 | 546.934 MiB |
| 评分 | `Claude/Sonnet5.5/AE风味动效设计编辑器` | 2,479 | 323.935 MiB |
| 作答 | `GPT/6.1Sol/单位正方形内最小三角形面积最大化` | 2,032 | 7.658 MiB |
| 评分 | `Claude/Sonnet5.5/动态路由塔防` | 1,955 | 517.732 MiB |
| 评分 | `GPT/6.1Sol/AE风味动效设计编辑器` | 1,877 | 331.606 MiB |
| 评分 | `Claude/Opus5.5/NVIDIA_B200网页艺术` | 1,869 | 438.422 MiB |
| 评分 | `GPT/6.1Sol/单位正方形内最小三角形面积最大化` | 1,764 | 7.525 MiB |
| 评分 | `Claude/Opus5.5/动态路由塔防` | 1,684 | 470.059 MiB |
| 评分 | `Claude/Sonnet5.5/果冻冲击与造浪水槽` | 1,683 | 348.751 MiB |
| 评分 | `Claude/Opus5.5/果冻冲击与造浪水槽` | 1,622 | 456.339 MiB |
| 作答 | `Claude/Opus5.5/太阳雨渔港3D渲染` | 1,608 | 45.173 MiB |
| 评分 | `Claude/Opus5.5/太阳雨渔港3D渲染` | 1,566 | 348.732 MiB |

### `.gitignore` 排除项与模型自己的测试数据

对存在题根 `.gitignore` 的项目只读执行 `git ls-files --others --ignored --exclude-standard --directory -z`，去掉父子重叠计数，合计 **13.294 GiB、4,817 文件、345 项**。这是作答总量的子集，不能再加到总量里。Git 排除的仍可能是运行必需的三方库、输入、权重或交付二进制，不能将排除清单直接交给移动器。

| 题目目录（相对模型根） | 有效排除项 | 大小 | 文件数 | 判断 |
|---|---|---|---|---|
| Claude\Opus5.5\Transformer前向推理的GPU加速 | `数据/inputs` | 1.812 GiB | 8 | 排除不等于无用；默认保留 |
| Claude\Sonnet5.5\Transformer前向推理的GPU加速 | `数据/inputs` | 1.812 GiB | 8 | 排除不等于无用；默认保留 |
| GPT\6.1Sol\Transformer前向推理的GPU加速 | `数据/inputs` | 1.812 GiB | 8 | 排除不等于无用；默认保留 |
| Claude\Opus5.5\Transformer前向推理的GPU加速 | `数据/expected` | 1.609 GiB | 8 | 排除不等于无用；默认保留 |
| Claude\Sonnet5.5\Transformer前向推理的GPU加速 | `数据/expected` | 1.609 GiB | 8 | 排除不等于无用；默认保留 |
| GPT\6.1Sol\Transformer前向推理的GPU加速 | `数据/expected` | 1.609 GiB | 8 | 排除不等于无用；默认保留 |
| GPT\6.1Sol\大规模旅行商回路长度最小化 | `evolution_trial` | 375.356 MiB | 10 | 排除不等于无用；默认保留 |
| GPT\6.1Sol\大规模旅行商回路长度最小化 | `alternative` | 368.496 MiB | 7 | 排除不等于无用；默认保留 |
| GPT\6.1Sol\大规模旅行商回路长度最小化 | `lookahead_trial` | 368.393 MiB | 7 | 排除不等于无用；默认保留 |
| GPT\6.1Sol\大规模旅行商回路长度最小化 | `kickneighbors.bin` | 335.547 MiB | 1 | 排除不等于无用；默认保留 |
| Claude\Opus5.5\大规模旅行商回路长度最小化 | `work/master.bin` | 294.914 MiB | 1 | 排除不等于无用；默认保留 |
| Claude\Opus5.5\大规模旅行商回路长度最小化 | `work/popM1.bin` | 294.914 MiB | 1 | 排除不等于无用；默认保留 |
| Claude\Opus5.5\大规模旅行商回路长度最小化 | `work/pop600m.bin` | 196.610 MiB | 1 | 排除不等于无用；默认保留 |
| Claude\Sonnet5.5\通用数字电路仿真器加速 | `tests` | 185.753 MiB | 90 | 排除不等于无用；默认保留 |

已核对模型自建测试/搜索目录和规则：Fable 电路的 `bin/`、`tests/*.out/*.err/*.ref/L_*.txt`；Opus Transformer 的 `dev/build`、编译副产物，TSP 的 `work/*.bin/*.tour/*.out`；Sonnet 的 `scratch/`、`build/`、`tests/`；Sol 极值构造的 `seeds/population/integer_seeds` 和搜索候选，TSP 的 `alternative/evolution_trial/patch_trial/lookahead_trial`。其中搜索二进制与模型自测输出多数无后续价值，但同名目录里也可能混有生成交付物所需脚本、数据或最终结果，**本版不自动搬**。详见 `gitignore_有效排除.csv` 与 `gitignore_规则.json`。

### 两账户的临时与工具缓存

| 账户/区域 | 具体路径 | 大小 | 文件数 | 判断 |
|---|---|---|---|---|
| 管理员_codex | `C:\Users\Administrator\.codex\sessions` | 27.722 GiB | 4,432 | 会话历史，整轮前保留 |
| 管理员临时 | `C:\Users\Administrator\AppData\Local\Temp\claude\E--Project-AI-OneShot-Bench` | 17.480 GiB | 217,132 | 共享临时/缓存；不按题自动搬 |
| 管理员_claude | `C:\Users\Administrator\.claude\projects` | 11.874 GiB | 9,556 | 会话历史，整轮前保留 |
| AIAgent_claude | `C:\Users\AIAgent\.claude\projects` | 1.281 GiB | 659 | 会话历史，整轮前保留 |
| AIAgent_codex | `C:\Users\AIAgent\.codex\sessions` | 351.204 MiB | 15 | 会话历史，整轮前保留 |
| 管理员_codex | `C:\Users\Administrator\.codex\cache` | 63.030 MiB | 16 | 共享临时/缓存；不按题自动搬 |
| AIAgent_codex | `C:\Users\AIAgent\.codex\cache` | 55.146 MiB | 3 | 共享临时/缓存；不按题自动搬 |
| 管理员_codex | `C:\Users\Administrator\.codex\tmp` | 3.378 MiB | 323 | 共享临时/缓存；不按题自动搬 |
| 管理员_claude | `C:\Users\Administrator\.claude\cache` | 1.378 MiB | 14 | 共享临时/缓存；不按题自动搬 |
| AIAgent_claude | `C:\Users\AIAgent\.claude\cache` | 1.049 MiB | 2 | 共享临时/缓存；不按题自动搬 |
| 管理员_claude | `C:\Users\Administrator\.claude\backups` | 0.841 MiB | 5 | 共享临时/缓存；不按题自动搬 |
| AIAgent_claude | `C:\Users\AIAgent\.claude\backups` | 0.335 MiB | 5 | 共享临时/缓存；不按题自动搬 |
| 管理员_codex | `C:\Users\Administrator\.codex\backups` | 0.325 MiB | 20 | 共享临时/缓存；不按题自动搬 |
| AIAgent_claude | `C:\Users\AIAgent\.claude\sessions` | 0.009 MiB | 26 | 会话历史，整轮前保留 |
| AIAgent_codex | `C:\Users\AIAgent\.codex\tmp` | 0.003 MiB | 27 | 共享临时/缓存；不按题自动搬 |
| 管理员_claude | `C:\Users\Administrator\.claude\sessions` | 0.002 MiB | 7 | 会话历史，整轮前保留 |
| 管理员_codex | `C:\Users\Administrator\.codex\log` | 0.001 MiB | 1 | 共享临时/缓存；不按题自动搬 |
| AIAgent_codex | `C:\Users\AIAgent\.codex\log` | 0.000 MiB | 1 | 共享临时/缓存；不按题自动搬 |

管理员 Temp 最大项是 `claude`（35.924 GiB、378,362 文件），其中本项目对应目录约 17.480 GiB、217,132 文件。这个关联只到“项目”，仍混有指挥、研究和评分子代理，无法安全归到某个已经评完的题。其他可见项目包括 Chrome/Puppeteer 用户目录、编译缓存、性能媒体、安装包和 Office 诊断，不能整棵当本题垃圾搬走。AIAgent 的 `.codex/sessions`、`.claude/projects` 等历史以及管理员账户的其他项目历史均保留。

### 其他必看目录

- `H:\AI_OneShot_Model\.oneshot\mailbox`：约 406.489 MiB、179 文件，含模型逐字记录、宿主控制和消息；本版不按题搬。正常 `close` 已有归档到 `orchestrator/logs/<厂商>/<型号>/<题名>/<时间>` 的流程，不改它。
- `orchestrator/logs`：保留作答 `session.log` 和监督/错误日志。通知文件可能过时，但本版不按题猜测删除范围。
- `orchestrator/steer/runs`：保存协作线程输入/输出；本研究仍活跃，不按评分题归属。
- `orchestrator/tests/work`：已有 27,051 个文件但只有 6.333 MiB，典型“小文件多”；不能在当前有测试时批量搬。新增实验仅在 `实验` 内创建假目录。

全部明细：`按一级路径.csv`、`按二级路径.csv`、`按题目类别.csv`；每份均有 `_按文件数.csv` 版本。`元数据扫描说明.json` 保存范围、时间与跳过的链接，未保存会话正文。

## 3. 当前能搬的范围

补充统计快照可搬 **350 项、21,163 文件、3.203 GiB**；其中 E 盘 3,439,321,224 字节 / 21,150 文件，H 盘 63,060 字节 / 13 文件，C 盘 0。下面列最大 10 项；完整清单有大小与文件数两种排序。

| 题目 | 可搬路径 | 大小 | 文件数 |
|---|---|---|---|
| Claude/Opus5.5/NVIDIA_B200网页艺术 | `E:\Project\AI_OneShot_Bench\orchestrator\grading\Claude\Opus5.5\NVIDIA_B200网页艺术\claude\main\work\chrome-profile` | 171.527 MiB | 900 |
| Claude/Opus5.5/NVIDIA_B200网页艺术 | `E:\Project\AI_OneShot_Bench\orchestrator\grading\Claude\Opus5.5\NVIDIA_B200网页艺术\codex\main\work\chrome-profile` | 154.509 MiB | 759 |
| Claude/Opus5.5/果冻冲击与造浪水槽 | `E:\Project\AI_OneShot_Bench\orchestrator\grading\Claude\Opus5.5\果冻冲击与造浪水槽\codex\main\work\chrome-profile` | 154.301 MiB | 735 |
| Claude/Opus5.5/果冻冲击与造浪水槽 | `E:\Project\AI_OneShot_Bench\orchestrator\grading\Claude\Opus5.5\果冻冲击与造浪水槽\claude\main\work\chrome-profile` | 154.291 MiB | 735 |
| Claude/Sonnet5.5/动态路由塔防 | `E:\Project\AI_OneShot_Bench\orchestrator\grading\Claude\Sonnet5.5\动态路由塔防\claude\main\work\chrome-profile` | 154.082 MiB | 744 |
| Claude/Sonnet5.5/动态路由塔防 | `E:\Project\AI_OneShot_Bench\orchestrator\grading\Claude\Sonnet5.5\动态路由塔防\codex\main\work\chrome-profile` | 153.984 MiB | 732 |
| Claude/Opus5.5/动态路由塔防 | `E:\Project\AI_OneShot_Bench\orchestrator\grading\Claude\Opus5.5\动态路由塔防\codex\main\work\chrome-profile` | 153.949 MiB | 738 |
| Claude/Opus5.5/动态路由塔防 | `E:\Project\AI_OneShot_Bench\orchestrator\grading\Claude\Opus5.5\动态路由塔防\claude\main\work\chrome-profile` | 153.947 MiB | 738 |
| Claude/Sonnet5.5/果冻冲击与造浪水槽 | `E:\Project\AI_OneShot_Bench\orchestrator\grading\Claude\Sonnet5.5\果冻冲击与造浪水槽\codex\main\work\chrome-profile` | 153.888 MiB | 730 |
| Claude/Sonnet5.5/果冻冲击与造浪水槽 | `E:\Project\AI_OneShot_Bench\orchestrator\grading\Claude\Sonnet5.5\果冻冲击与造浪水槽\claude\main\work\chrome-profile` | 153.888 MiB | 730 |

部署新脚本后的另一次真实只读 CLI `scan` 输出末行是：

```text

```

该次读取现行调度状态与当时的目录，与较早实验副本统计快照不同；按执行当时实际状态决定，不据旧统计强行搬移。两次均未执行移动。完整真实输出在 `实验/真实目录scan输出.txt`。

## 4. 实现说明

入口：

```powershell
python orchestrator\cleanup.py scan
python orchestrator\cleanup.py run "<厂商/型号>" "<题名>"
```

`scan` 不取会创建锁文件的写锁、不写状态、不写日志、不移动。`run` 取得 `common.locked(timeout_s=0)` 后读最新状态；锁忙留到下次。自动调用由评分调度原有锁保护，避免与 `plan/retry/reset` 的正规流程重叠。

一题可搬的必要条件：当前没有继续作答；本题已有的所有评分工作和其子段全部为 `done`；`tasks.py` 配置的每位评分员及其必需分段均有记录；每段 `result.json` 能通过现有 `grading.validate()`。复用现有结果有效性判定，不另外加身份校验、分数交叉核对或审核账本。AE 需要 Claude 主体、Sol 主体、Sol 性能都完成；任一失败、排队、运行、缺段、缺结果则一项也不搬。旧未拆段任务继续按原目录读取。

可搬范围是明确名单：

1. 评分 `work` 中的 `submission/submission_worktree/site/app/project` 副本、`chrome-profile/chrome`、依赖/检查/编译目录和 `temp`；根层临时工具脚本及编译二进制。保留未知目录。
2. 评分员根或分段根下的 `version`、`mailbox`，均等整题完成。
3. 作答目录仅检查 `__pycache__/.pytest_cache/.mypy_cache/.ruff_cache`；Git 跟踪的保留，找不到源 `.py` 的字节码也保留。没有 Git 仓库或不能确认未跟踪时保留。

作品的 `node_modules`、构建/交付目录、素材、`.git`、源码、自测/搜索目录、复制题材都不受自动移动影响。评分 `work` 已查到 `evaluation.json`、`check_result.json`、编译日志、截图、视频导出证据，所以不能直接整棵搬 `work`；这些位于副本、浏览器和 `temp` 外的数据会留下。`result.json`、`prompt.txt`、`session.log` 和 `评分表_*` 即便混入副本也保护，目录中有受保护文件就只搬其他子项。

视频导出依据：`videos/tools/common.mjs` 默认直接定位模型题目下的 `index.html`，`record.mjs/browser.mjs` 从该作品读取并注入导出适配。保留整个作品依赖和资源，不依赖“以后重新安装”来保证可打开。本次按要求未开网页或导出视频；保证来自移动范围与假目录中运行文件字节不变的验证，未声称真实浏览器实测。

源盘映射固定为 `H:\待删除`、`E:\Project\AI_OneShot_Bench\待删除`、`C:\待删除`，前加 `yyyyMMdd-HHmmss-ffffff`，其后保留相对盘符根的原路径。只用 `Path.rename`；先确认同卷，跨卷失败，绝不复制后删除。不覆盖已存在目标，跳过链接/联接及其路径。某项被占用则记入现有 `timer-errors.log`，继续其余项；后续调度会重试，已搬走的不再出现。没有新增清理状态文件。

为了不在性能测量期间做目录遍历/移动，有任意性能段正在运行时自动清理暂缓；放在下一次性能结束后的 `reap` 与新性能启动之间执行。失败或清理器异常都不影响评分派发。

后续后台评分 `TEMP/TMP` 定位到本段 `work/temp`；Claude 子代理通过生成提示词约定使用相同位置，不改变指挥进程或其他会话环境。评分证据明确存到临时目录和提交副本外。工具如果自行忽略 `TEMP/TMP` 仍可能写到共享 C 盘，那些遗留继续只统计，不推断归属。

## 5. 文件交付与指挥集成

| 文件 | 状态/改动 |
|---|---|
| `orchestrator/cleanup.py` | 新文件，已放到位，与实验副本一致 |
| `orchestrator/playbook/5-清理.md` | 新文档，已放到位，含人工永久删除命令 |
| `实验/orchestrator/grading.py` | 改好副本：导入 cleanup；`fill` 附加临时目录约定；`launch` 创建 temp 并设置子进程 TEMP/TMP；`advance` 在 reap 后 start 前调用清理，捕获异常 |
| `实验/orchestrator/tests/test_automation.py` | 改好副本：清理路径隔离到假 holding；验证临时目录；新增 14 个清理用例；物理题旧 17 项断言同步为现指南 18 项 |
| `实验/grading.diff`、`实验/test_automation.diff` | 相对生成报告时现行文件的最小差异，方便指挥合入 |
| `实验/run_copy_tests.py` | 实验测试入口：真实指南只读，所有状态/夹具在实验目录，夹具退役只 rename，不走回收站 |
| `实验/inventory.py`、`survey_details.py` | 本次只读统计代码 |

指挥在合适的维护时机合入两个修改副本。不要覆盖研究后新增的并行改动，可按 diff 合入；不要在当前占用本机的测试/性能评分阶段为了此任务重启监督。现行监督是已加载的 Python 进程，换磁盘文件不会让它即时采用新逻辑。集成后新调度步会补处理此前已满足条件的题，且会重试移动失败项。

研究期间现行测试文件的物理题总项数断言出现了并行更新；实验副本与现指南的 18 项、100 分一致。现有 `patrol.py clean --delete` 仍是整轮后走回收站的旧流程，本次没有擅改其历史保留规则；本机制能按题提前减少以后交给旧清理的大量评分临时物。

## 6. 测试结果

运行 `python -X utf8 调研\清理机制\实验\run_copy_tests.py`：**107 项通过，0 失败，0 错误，0 跳过，耗时 10.645 秒**。包含原有 93 项测试与新增 14 项。原有完整 11 题作答/17 个评分会话的模拟、真实 OS 锁与事件钩子子进程、Node 的内存宿主/消息协议测试均通过；没有启动真实模型、Chrome 或 GPU 工作。

新增覆盖：所有评分员/AE 性能等待；结果缺失/损坏/不完整；保留项目源码/依赖/构建/数据及评分证据；只读 scan；真实同盘假目录移动与路径保持；占用失败跳过后重试；作答中与其他性能段运行时保护；未跟踪缓存及字节码源文件检查；实际目录符号链接不动及目标保护；不覆盖、拒绝跨卷和越界参数；共享历史/Temp 不碰；旧未拆段目录；reap→清理→start 顺序及异常不阻评分；损坏状态不搬；CLI scan/run 的假目录验证。

完整记录在 `实验/测试结果.txt`。测试使用的所有源码都是实验副本，未写现行 `state.json/grading.json`。测试夹具退役留在实验目录内，未永久删除。真实环境只执行过 `scan`。

## 7. 需要用户决定的类别

1. **复制题材**：尤其三份 Transformer `数据/inputs`、`数据/expected`，合计约 10.27 GiB。评分已经有权威副本，但模型程序可能按相对路径读取它们；若只需保存源码与选定演示，需要明确是否允许搬走，以及运行所需输入如何恢复。本版保留。
2. **模型自测和搜索二进制**：极值构造/TSP 的 population、候选、trial、work/*.bin 等；可省数 GiB，但与生成最终解的代码/数据混放。需确定哪些只留最终解、哪些属于交付。`.gitignore` 本身不是这个判断。本版保留。
3. **作品依赖与交付构建、截图/媒体**：`node_modules` 和 `dist/build` 可能是直接打开作品所需；PNG/视频可能是真实素材。需给出逐项目可移范围，不能一概清。本版保留。
4. **C 盘历史临时文件**：本项目 Claude scratch 仍有活跃会话，其他 Temp 更混有别的项目；何时按整轮移动哪些明确目录，由指挥/用户决定。不可把整个管理员 Temp 或 `.claude/.codex` 当评分垃圾。
5. **全局旧夹具、线程与日志**：`orchestrator/tests/work`、已结束的 steer/runs、通知文件等多为无用，但与具体评分题无直接对应；不应在当前线程或测试活跃时处理。模型逐字记录继续遵守整轮结束后仅指挥可清的规则。

## 8. 用户自行永久删除

移动只隔离文件，**不会释放同盘空间**。只有用户自己执行下面的删除才释放空间，不进回收站；代理未执行。每次选一个根目录和一个时间戳，范围先解析并限制到选定待删除根目录。命令与 `orchestrator/playbook/5-清理.md` 一致：

```powershell
$holdingRoot = 'H:\待删除'
# 可改为 'E:\Project\AI_OneShot_Bench\待删除' 或 'C:\待删除'
Get-ChildItem -LiteralPath $holdingRoot -Force
$batchName = Read-Host '输入要永久删除的时间戳目录名（yyyyMMdd-HHmmss-ffffff）'
if ($batchName -notmatch '^\d{8}-\d{6}-\d{6}$') { throw '时间戳格式不正确' }
$holdingItem = Get-Item -LiteralPath $holdingRoot -Force
if ($holdingItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw '根目录是链接，停止' }
$holdingFull = [IO.Path]::GetFullPath($holdingItem.FullName).TrimEnd('\')
$batchPath = [IO.Path]::GetFullPath((Join-Path $holdingFull $batchName))
if (-not $batchPath.StartsWith($holdingFull + '\', [StringComparison]::OrdinalIgnoreCase)) { throw '路径越界' }
$batchItem = Get-Item -LiteralPath $batchPath -Force
if ($batchItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw '批次目录是链接，停止' }
Remove-Item -LiteralPath $batchPath -Recurse -Force
```

不清空回收站，不调用任何删除动作去处理本次真实文件。
