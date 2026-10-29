# 自动化机制架构整治方案（Sol，第一阶段）

> 调研日期：2026-10-29。本文是第二阶段的实施说明；本阶段只读调查，唯一新增文件是本文。没有修改脚本、配置、题面、评分材料、状态、信箱或作答目录，没有启动、关闭、清理、送信、认领或结束进程。
>
> 行号均对应调研时磁盘上的文件，从 1 开始；实施前重新核对。`orchestrator/` 与 `.claude/` 被 `.git/info/exclude:11–12` 排除，搜索必须使用 `rg --no-ignore --hidden`。Git 当前 HEAD 为 `6c813da`，但工作区有既有修改，且自动化目录没有纳入该 Git 历史；不能用 HEAD 代替本次磁盘版本，也不能据此推断某段补丁的引入日期。

## 1. 决策与范围

| 决策 | 实施要求 |
|---|---|
| 提醒策略独立 | 新增 `orchestrator/reminders.json` 与小型 `reminders.py`，存放类别、阶段、题目专属建议；计时器只决定何时发，组合函数只决定说什么，送达器只负责送达 |
| 保留现有可靠性机制 | 保留 Windows AIAgent、runas、每会话 Job Object、logon SID/DACL、绑核、宿主中断、监督兜底、共享锁、原子发布、输出成功后确认 |
| 拆开实际混杂的职责 | `timer.py` 保留全部现有命令入口；把状态与事件、受测生命周期、指挥钩子分别移入小模块；不引入服务框架、插件发现、数据库或通用工作流引擎 |
| 人工判断仍由指挥做 | 批次推进、故障归因、是否续时、是否重试、是否终止评分、修复和汇报写在 playbook；不增设自动补时、自动重测、自动评分裁决 |
| 评分内容仍由指南决定 | 自动收割只检查身份、结构、覆盖与算术；不把正确性、设计质量、违规认定、扣分阈值写入 Python |
| 不改题面与计分 | 11 份题面、题目限时、权重、计分公式、评分指南与评分表的分值不在本次修改范围；不改现有账户和进程隔离实现 |
| 切换按完整版本进行 | 新增文件可先准备；现有入口及其导入关系的修改，须等第二阶段授权且本轮测试、评分、保留宿主均结束后统一切换。21:05 到时本身不是切换条件 |

只读状态快照：20:57:05（UTC+8），`GPT/6.1Sol/形式化证明题` 仍在作答，剩余约 8.2 分钟；监督 PID **14896**，心跳正常；没有评分任务。PID 仅为调研记录，之后不得直接拿它操作，必须重新查询并核对进程身份。

## 2. 现状图

### 2.1 路径约定

| 简称 | 绝对路径 |
|---|---|
| `O/` | `E:\Project\AI_OneShot_Bench\orchestrator\` |
| `B/` | `E:\Project\AI_OneShot_Bench\` |
| `S/` | `H:\AI_OneShot_Model\.oneshot\` |
| `M/` | `H:\AI_OneShot_Model\` |
| `A/` | `C:\Users\AIAgent\` |
| `U/` | `C:\Users\Administrator\` |

下文所有 `文件:行号` 均按上述前缀解析。`<model>` 是“厂商/型号”，不是 Agent 名；`claude`、`codex` 是 Agent 类型，目前又被用作评分员键名。

### 2.2 控制与数据流

```text
指挥 Claude 会话（管理员）
 ├─ settings.local.json → timer session / hook / rewake
 │    ├─ 显式 claim 才接收 events；SessionStart 只注入说明
 │    ├─ PostToolUse/UserPromptSubmit：输出事件、来信 → flush → 确认/归档
 │    └─ Stop：rewake 等待事件；Cron 兜底在接力失效时唤醒
 ├─ timer launch → 确认监督心跳 → runas AIAgent → launch.ps1
 │    ├─ 写 pid.txt、填启动/续做模板 → session-host.cjs
 │    ├─ session-job.py：先把宿主纳入 Job，再建立隔离、绑核，再启动 Agent
 │    └─ timer begin：写 state.json，再发布 deadline.json
 └─ grading plan / retry / kill 等：指挥决定何时执行

独立 supervisor（管理员，每 2 秒）
 ├─ timer.check → state.json + host.json + 进程句柄
 │    ├─ 提醒 → S/mailbox/<model>/<task>/*.msg
 │    ├─ 到时事件；到时 60 秒后仍 busy/心跳失效 → 兜底进程清理
 │    └─ 宿主退出 → 异常事件
 ├─ grading.advance → 回收结果、评分提醒、按互斥条件派发
 ├─ timer.close_graded → 写 close → 等待/兜底 → 跨盘归档日志
 ├─ patrol.report（每 20 分钟）→ 问题清单，交指挥处理
 └─ 将事件写入 state.json.events → 指挥钩子领取

受测宿主（AIAgent，每 2 秒）
 ├─ 读 deadline.json → 到时 interrupt + Job cleanup；保留宿主和 Agent 核心
 ├─ Claude 工作中：deliver.cjs 钩子消费 *.msg
 ├─ Codex 工作中：宿主 turn/steer 消费 *.msg
 ├─ 两者空闲时：宿主用来信开启新一轮
 └─ 读 close → TerminateJobObject；host.json/session.log 回报状态
```

两个时间控制层有明确用途：宿主直接中断作答，监督发现失效后兜底；不应为了“去重”删掉任一层。`clean` 负责批间残留，`close` 负责结束保留宿主，两者也不能合并。

### 2.3 机制逐项定位

| 机制 | 实现位置 | 入口、行为与边界 |
|---|---|---|
| 题目目录、限时、类别、批次、评分互斥、权重、CPU 掩码 | `O/tasks.py:14–54` | 11 行 `_TABLE` 是运行元数据；类别从题面相对路径第一段取得；题目内容不由脚本生成 |
| 指挥认领 | `O/timer.py:509–530,544–584,903–923` | SessionStart 给 ID；`claim` 写 `orchestrator`；钩子按 session_id 过滤；新认领清除旧 rewake token，保留未送事件 |
| 指挥阶段说明 | `O/timer.py:467–530,824–829,885–890` | 由作答/评分状态选择 playbook；超 8000 字符时只给原文路径 |
| 指挥钩子注册 | `B/.claude/settings.local.json:3–48` | SessionStart→session（30 秒）；PostToolUse/UserPromptSubmit→hook（30 秒）；Stop→rewake，asyncRewake，1560 秒 |
| 指挥在线收信与确认 | `O/timer.py:185–202,405–437,910–944`；`O/common.py:169–183` | events 与来信一同输出；成功 flush 后清 events、移动来信；长通知先写 `logs/notification-*.txt` |
| 指挥空闲唤醒与 Cron 兜底 | `O/timer.py:54–68,544–558,919–923,945–982`；`O/playbook/0-总纲.md:40`；`4-汇报.md:27` | rewake 每 2 秒查事件，最长 25 分钟；token+PID 创建时间排除旧等待者；指挥用 CronList/Create/Delete 管理 `7,37 * * * *` 兜底，不是 Python 自动创建 |
| 监督启动、单例、心跳与退出 | `O/timer.py:108–149,987–993`；`O/supervisor.py:55–125` | 共享锁之外启动候选，监督自行取得 singleton；健康握手后才 launch；心跳 20 秒过期；仅结束旧监督 PID，不带 /T |
| 受测启动、失败记录与计时 | `O/timer.py:218–235,699–846`；`S/launch.ps1:23–62` | 校验题面→归档旧信箱→runas→读 pid.txt→begin；`--minutes` 是异常续做的剩余整数分钟；`--resume` 从归档日志取会话号 |
| 启动提示词与环境 | `S/launch.ps1:39–54`；`S/prompt-template.txt:1–11`；`resume-template.txt:1–4` | 替换 TASK/WORKDIR/DELIVERABLE/MINUTES；移除继承的会话标记、关闭自动记忆、设置 ONESHOT_MAILBOX |
| 每题 Job、绑核、进程隔离 | `S/session-host.cjs:56–97`；`S/session-job.py:19–77,80–154` | Job ready 之后才启动 Agent；Job 限制继承给后代；logon SID 与默认 DACL 限制同账户其他会话结束进程；管理员/SYSTEM 保留控制权 |
| 账户/脚本 ACL 与一次性安装 | `O/tighten-oneshot.ps1:1–8`；`S/setup-aiagent.ps1:1–41`；`setup-toolchain.ps1:1–42` | `.oneshot` AIAgent 只读执行，mailbox 可修改；安装脚本设置工具版本、用户 PATH、Codex hook 副本，不是每题运行入口 |
| 提醒调度与文字 | `O/timer.py:46–53,324–386` | 10 分钟档位；迟到只发当前最新档；剩余≤10 分钟补一次 final；目前所有题同一段文字，无类别/前后阶段 |
| 受测消息原子发布 | `O/timer.py:165–171` | 完整写 `.tmp` 后改名 `.msg`；普通 send 与自动提醒共用文件格式 |
| 受测消息竞争、合并、确认 | `S/deliver.cjs:18–51,70–115` | 目录锁避免宿主/钩子重复消费；普通消息全保留，时间提醒只保留最新一条；writer 成功后将所读文件移入 delivered |
| 工作中和空闲送达 | `S/claude-settings.json:3–61`；`session-host.cjs:123–135,171–185` | Claude 多个工具/会话钩子；Codex 使用 app-server turn/steer，拒绝后 20 秒重试；空闲时 start；送达延迟不延长作答时间 |
| 到时中止与独立兜底 | `S/session-host.cjs:30–35,137–170`；`session-job.py:123–154`；`O/timer.py:348–372` | 宿主读 deadline，自行 interrupt 并清除非核心 Job 成员；监督到时后 60 秒依据 busy/心跳执行兜底 |
| 退出检测与异常续做 | `O/common.py:110–137`；`O/timer.py:238–250,332–346`；`O/patrol.py:78–101`；`O/playbook/2-计时与关闭.md:31–46` | 宿主消失由监督检测；Agent failed/宿主停心跳主要由 20 分钟巡逻发现；是否续时、剩余时间、第三次异常停止续做，由指挥判断执行 |
| 批间清理 | `O/timer.py:283–321,683–696`；`O/common.py:44–61` | 尚有未到时作答则拒绝；对 AIAgent 非核心 PID 逐个清理；不带进程树级联，保护保留宿主 |
| 关闭、归档与重测归档 | `O/timer.py:587–680,864–877` | close 文件→5 秒宽限→核对创建时间后兜底；标 closed 后跨盘移动信箱，失败留 archive_pending 重试；reset 归档旧计时记录 |
| 评分建队列、派发、互斥 | `O/grading.py:59–78,493–562,603–626,629–705` | plan 建 jobs、复制空表；监督和 dispatch 共用 advance；作答未结束不派发；light/parallel 并行，exclusive 单个且与 parallel 互斥 |
| 评分进程与提醒 | `O/grader_runner.py:35–73`；`O/grading.py:481–518,629–661` | 管理员账户；runner Job 收尾；每 10 分钟注入评分提醒，超过 40 分钟只通知，不自动终止 |
| 评分材料与结果协议 | `O/grader-prompt.txt:1–53`；`O/grading.py:161–276,468–490,521–537` | AI 读题面、指南和选定的提交副本；写自己的评分表、result.json；进程退出后校验 complete、身份、覆盖、数值与算术 |
| 分数汇总与出题人分 | `O/grading.py:279–457,765–787` | 从指南读取结构；按现有公式折算、平均、加权；author 录入；status 只读展示，不给内容打分 |
| 评分重试、手动终止、归档 | `O/grading.py:708–762,790–813`；`O/playbook/3-评分.md:30–45` | 是否 retry/kill 与重试上限由指挥决定；旧运行目录、旧表保留；没有自动重试 |
| 巡逻与过时文件清理 | `O/patrol.py:25–144,147–227`；`O/supervisor.py:31–42` | 巡逻只报告；结束后 clean --delete 才进回收站；清理拒绝开放宿主或 queued/running 评分；不列作答目录 |
| 管理员临时 Codex 线程 | `O/codex_thread.py:37–102,114–193`；`O/steer/codex_steer.cjs:15–98` | 与测评分开；运行中由 PostToolUse 收信，空闲时 exec resume；threads.json、steer/inbox/delivered；不负责受测计时 |

额外的全局连接点也已核对：

| 文件 | 本项目相关内容 |
|---|---|
| `U/.codex/hooks.json:26–36` | 临时 Codex 线程的 `O/steer/codex_steer.cjs`，上下文上限 4000 |
| `U/.codex/hooks.json:60–68` | 评分 Codex 的 `S/deliver.cjs`，依赖评分启动时的 ONESHOT_MAILBOX |
| `A/.codex/hooks.json:1–56` | 与 `S/codex-hooks.json` 对应的安装副本；本项目 Agent 说明和宿主代码明确将受测 Codex 的工作中送达交给 turn/steer，不依赖该副本 |

实际 ACL 只读结果与设计相符：项目 E 盘目录对 AIAgent 显式拒绝；`.oneshot` 给 AIAgent RX，mailbox 给 M。没有运行任何 ACL 设置脚本。

### 2.4 状态文件的读写归属

| 文件/内容 | 写入者 | 读取者 | 原子性、归档与注意点 |
|---|---|---|---|
| `O/state.json.tasks` | timer CLI；监督通过 timer 函数 | timer、supervisor、grading.testing、patrol | common.locked + atomic_json；含 start/minutes/closed/reminded、进程身份、退出、到时、close、归档字段 |
| `O/state.json` 顶层 | claim/hook/rewake/监督 | 指挥钩子、监督、巡逻 | orchestrator、rewake_token/created、events/seq/ack、patrol_at/log_size、hold_until、archive；并非只有计时 |
| `O/state.lock` | 各写入者持操作系统锁 | 同上 | 文件存在不等于锁住；不可删除它来“解锁” |
| `O/supervisor.json` | 唯一监督 heartbeat | timer.supervisor_status/ensure | 原子替换；pid、created、heartbeat、running；不代表子会话可被结束 |
| `O/supervisor.lock` | 监督持操作系统锁 | 候选监督 | 防双监督，退出由 OS 释放 |
| `S/mailbox/<model>/<task>/pid.txt` | launch.ps1 | timer launch/core_pids | 启动器 PID，不是 Agent PID，也不证明 Agent 已 ready |
| 同目录 `deadline.json` | timer.begin | host.expired、deliver 主入口 | `{start, minutes}` 原子 JSON；begin 当前先写计时状态，后写该文件 |
| 同目录 `host.json` | host 每 2 秒 | timer、patrol | host_pid/job_pid/agent_pid/busy/stopped/failed/updated；临时文件替换，失败下次再试 |
| 同目录 `*.msg`、`.delivery.lock`、`delivered/` | timer 发布；host/钩子消费归档 | host、deliver、patrol（统计积压） | 时间提醒靠正文前缀识别；原子可见与输出后确认，不等于模型已处理 |
| 同目录 `close` | timer.close_tick（CLI 或监督） | host | 文件信号；不在正常到时写入 |
| 同目录 `session.log`、`launch-error.log` | host、launch、job stderr | 指挥、last_session、巡逻提示 | close 后搬到 `O/logs/<model>/<task>/<时间>/`；不覆盖作答目录 |
| `O/grading.json` | grading CLI；监督调用 grading | grading、timer、patrol | 共享 state.lock；当前自身 save 使用固定 .tmp；models/jobs/author/archive；与 timer 状态是两份文件 |
| `O/grading/<model>/<task>/<grader>/` | grading 生成 prompt/work/mailbox；runner 写 runner-status；评分 AI 写 result | grading、指挥 | 旧运行用 -旧时间保留；runner-status 表示 Job 是否建立 |
| `M/<model>/<task>/评分表_*.md` | plan/retry 复制；各评分 AI 填自己的表 | 自己的评分 AI、出题人 | 测评结束后才能进入作答目录；另一评分 AI 不应读取 |
| `O/inbox/*.md`、`delivered/` | 评分 AI 先 .tmp 后 .md；指挥钩子归档 | letters/hook/rewake | read_letter 拒绝并发写入；不是受测信箱，不与 steer 信箱混用 |
| `O/logs/timer-errors.log`、`supervisor.log`、`notification-*.txt` | timer/监督 | 指挥、patrol | notification 是长通知正文；不应把“已写文件”说成“已注入全文” |
| `O/steer/threads.json`、inbox/delivered | codex_thread CLI、codex_steer 钩子 | 临时管理员线程、patrol.stale | 独立注册表；不应合并进受测状态或使用受测清理规则 |
| Cron 兜底任务 | 指挥通过 Cron 工具创建/删除 | Claude 会话调度器、UserPromptSubmit 钩子 | 不由 state.json 创建；仓库有 scheduled_tasks.lock，不能仅凭该锁推断具体 Cron 是否存在 |

`common.answering()` 与 `timer.running()` 含义不同：前者表示尚在作答预算内，后者表示尚未关闭。到时保留宿主属于 running，但不属于 answering。评分与批次判断必须继续使用前者。

## 3. 问题清单

“确认”指从现有调用和文本可直接验证；“风险”指存在故障窗口，未在运行中的系统做故障注入；“残留”只描述当前形态，不推断修改历史。

| 编号/性质 | 文件与行号 | 问题及影响 | 处理方向 |
|---|---|---|---|
| P01 确认 | `O/timer.py:108–149,185–235,324–386,487–530,587–846,849–1009` | 同一文件管理监督、生命周期、提醒文字、状态、归档、指挥 UI 和钩子；监督/巡逻又 import CLI，改文字也进入关键路径 | 按第 4 节拆边界，保留 timer 命令 |
| P02 确认 | `O/timer.py:46–53,375–385` | 提醒类别、阶段、建议与调度混写；REREAD 中“进入检查阶段”没有阶段选择器；当前每档重复完整长段 | 数据文件 + 纯组合；调度不感知题目建议 |
| P03 确认 | `S/prompt-template.txt:6–9`；`O/timer.py:48–53`；`B/README.md:382` | 模板要求每次提醒都重读，代码却只在检查阶段要求；新增“算法/推理按需”后会再冲突；模板还写死周期和 final 阈值 | 模板改为题面与系统提醒的入口说明；周期/阈值只在策略数据中维护 |
| P04 确认 | 第 3.1 节全部 11 处；`O/playbook/2-计时与关闭.md:5` | 题面、模板、代码、playbook、README 都复述提醒制度；没有统一修改/核对入口 | 冻结题面；建立来源表与只读核对，不自动重写题面 |
| P05 确认 | `O/timer.py:228–234,771–775,823` | 续做覆盖同一任务记录，start/minutes 变为新段；若按该段长度选 60/90 阶段，90 分钟题续 20 分钟会选错策略 | 用 TASKS 原始限时选阶段，按“原限时－本段预算＋本段已用”定位进度；调度仍按本段计时 |
| P06 风险 | `O/timer.py:381–385`；`O/supervisor.py:15–18` | 先发 .msg，再保存 reminded；崩溃可重复发提醒。时间命名不能识别“同一档已送过” | 提醒使用稳定消息名并查 queued/delivered，保留原子发布 |
| P07 确认 | `S/deliver.cjs:80–92` | 正文 `【时间提醒】` 实际是协议字段；随意改标题会把过期提醒当普通信全部送达 | 本次保留前缀并做契约测试；不为此更换消息格式 |
| P08 风险 | `O/grading.py:664–686`；`O/supervisor.py:21–30` | 同一锁不让两份 JSON 原子提交；grading 已保存、timer.events 尚未保存时崩溃，完成事件可能丢失；“同锁发布”注释容易造成错误保证 | grading 状态内暂存待发通知，再按序号幂等转入 timer 事件队列，见第 4.4 节 |
| P09 确认 | `O/timer.py:393–402,434–437,493,514`；`O/supervisor.py:99`；`O/grading.py:586–595,669–673` | grading_watch 返回的事件都被取 `[1]` 丢弃；仍执行 watch_events 的进程检查；auto_step 在当前源码没有调用者 | 删除无消费的事件生成路径；保留只读 active；auto_step 全局复查后移除，不能把它误当自动评分入口 |
| P10 残留 | `O/timer.py:434–437,482–484,570–573,916,924,968`；`S/deliver.cjs:70,84` | gather 永远返回空 reminders；in_orchestrator 固定多返回一个 False；next_part 的 model 没用；sendQueued 的 currentTime 所有现有调用都为 false/默认 | 去掉无效参数/返回槽，不改行为；删除前搜全部调用 |
| P11 确认 | `O/timer.py:205–206`；`O/common.py:44–48`；`O/timer.py:440–450` | running 实际指“未关闭”；续做的 status 限时是本段剩余预算，容易误读为题目总限时 | 内部改名 open_sessions；显示明确区分本段/原限时；状态字段和 CLI 不改名 |
| P12 确认 | `O/timer.py:832–845`；`O/playbook/1-准备与启动.md:56` | 脚本输出中写第二次失败得 0 分、继续后题，是评分/流程判断；again 只看前次 launch_failed，也不是可靠的通用尝试计数 | 脚本只报告事实和日志；重试与处理规则留 playbook，不新增自动计分判定 |
| P13 确认 | `O/grader-prompt.txt:14,21,23,48`；例如 `B/Grading/复杂交互应用/AE风味动效设计编辑器/AI评分指南.md:9–19` | 评分模板重复“完成×质量”与酌情少给性能分等评分内容；将来指南改了模板可能没改 | 模板保留工作流、字段协议；方法和处罚只引用本题指南，现有指南已写出的公式不再复述 |
| P14 风险 | `O/grading.py:161–194,223–257` | 指南自由文本由正则推断结构；标题/表格写法变化会拒收；不能因为解析困难就加逐题 Python 分项表 | 保留通用解析和指南权威；用 11 题解析回归暴露变化；不推断评分正确性 |
| P15 确认 | `O/grading.py:61–78,130–136,426–447`；`O/playbook/Agent使用说明.md:55–59` | Agent、评分员身份、模型名、文件后缀与报告正文重复硬编码；两位评分员的 avg(*totals) 又是假定固定两位 | 保持两位评分规则；单份评分员 profile 供启动、标签、后缀、报告使用，不做任意 N 位评分扩展 |
| P16 确认 | `O/timer.py:762–763`；`S/launch.ps1:28`；`session-host.cjs:12,79–118,127–132,163–184,194–202`；`O/playbook/1-准备与启动.md:8` | 新 Agent 要多处补白名单与协议分支；“不支持其他厂商”混淆模型厂商与 Agent 能力 | 公共 Agent 清单 + 两个明确协议适配对象；playbook 按可用 Agent 选模型，不按厂商封死 |
| P17 确认 | `O/timer.py:34–45,78–95`；`O/tasks.py:14–16`；`O/patrol.py:23`；`O/steer/codex_steer.cjs:10` | 路径多处定义；configure_root 修改模块全局，patrol 的 MODELS 是已导入旧值；--root 并未隔离 LAUNCHER 或进程操作 | 运行路径显式传递；测试须额外 mock 进程/runas，不能只改 --root 后调用真实 launch |
| P18 确认 | `O/timer.py:349–352`；`S/session-host.cjs:158–170` | 到时事件写“已由宿主中止”，实际上只判断了时钟，没有等待中断或清理确认 | 事件写“已到截止，宿主负责中止，监督将检查兜底”；不新增中断确认协议 |
| P19 确认 | `S/session-host.cjs:100–104,206`；`O/patrol.py:88–90`；`O/timer.py:332–346` | Agent 退出但宿主仍活，failed 主要等 20 分钟巡逻；异常时刻缺失，无法直接据实际中断计算剩余时间 | 每 2 秒的退出检测同时读 failed；宿主增加首次 failure_at，监督报告事实，续时仍由指挥决定 |
| P20 风险 | `O/grading.py:108–113,152–158` | 解析错误/读取错误当空状态或“无作答”，评分调度可能放行，status 又显示没有评分任务 | 仅不存在文件视为空；损坏/不可读报错并暂停派发，不覆盖原文件 |
| P21 确认 | `O/grading.py:116–119`；`O/codex_thread.py:49–53` 对比 `O/common.py:64–83` | 三套 JSON 原子保存，部分固定 .tmp、无共享重试/flush；threads 注册表没有并发读改写锁 | 复用 atomic_json；threads 使用自己的短时 OS 锁，不能借用测评长锁 |
| P22 风险 | `O/steer/codex_steer.cjs:35–49,64–74`；对比 `S/deliver.cjs:18–51` | steer 锁先建空文件再写 PID，空 owner 及回收竞争没有与受测目录锁同等保护；枚举发生在取锁前 | 独立修正该信箱的取锁/读消息顺序，复用已存在的目录锁算法；不合并三种信箱 |
| P23 确认 | `O/codex_thread.py:37–39` 对比 `O/steer/codex_steer.cjs:15–18` | Python startswith 不含目录边界，可把同前缀兄弟目录当本项目；Python 与 JS 范围不一致 | 用 resolve 后的路径相等/父目录关系，保留明确的本项目 scratchpad 例外 |
| P24 确认 | `O/playbook/0-总纲.md:3–5,28–63`；`1-准备与启动.md:21–37`；`3-评分.md:15–22` | playbook 包含背景、通信架构和重复表格；“同一题先 Claude 后 GPT”也没有限定是独占任务，轻量/网页实际同时派发 | playbook 只保留操作条件、动作和命令；架构背景留本文；表格改读 tasks 的只读输出；精确写明独占顺序 |
| P25 确认 | `O/playbook/0-总纲.md:73`；`S/session-host.cjs:7`；`S/claude-settings.json:9,21,32,44,56` | “.oneshot 改动只对以后会话生效”过于笼统：host 缓存模块，但新钩子进程会重读 deliver.cjs | 按第 6 节给出生效矩阵；运行期间同样冻结被钩子逐次加载的 JS |
| P26 风险 | `S/session-job.py:114–117`；`O/playbook/0-总纲.md:23` | 隔离失败会记录后继续；playbook 要求运行中修 isolate 且不重启，但现有宿主已完成隔离步骤，改源文件不会补做 | 标明现有行为与风险；本次不改 DACL/Job 语义，不声称热修能追溯生效；隔离错误单独按现有异常规则记录处理 |
| P27 风险 | `O/timer.py:613–643`；`O/supervisor.py:12–42`；`O/grading.py:493–518` | 全局锁中有进程操作、启动与跨盘归档；慢 I/O 会拖慢巡检、status、钩子；归档逐文件搬迁也不是跨盘事务 | 本次保留锁保护范围，先以故障测试确保重试与不丢文件；不贸然把副作用移到锁外；后续仅在实测超时后处理 |

### 3.1 11 份题面中重复规则的精确位置

这张表同时是以后核对“运行元数据没有漂移”的入口。这里不提议修改任何题面。

| 题面（相对 B/） | 限时 | 最终版本/最近提交规则 | 提醒、重读、阶段提交规则 |
|---|---:|---:|---:|
| `深度推理/形式化证明题.md` | 109 | 114 | 115 |
| `深度推理/IMO难题精选.md` | 116 | 121 | 122 |
| `复杂交互应用/AE风味动效设计编辑器.md` | 300 | 305 | 306 |
| `游戏设计与开发/动态路由塔防.md` | 243 | 248 | 249 |
| `视觉设计与渲染/NVIDIA_B200网页艺术.md` | 233 | 238 | 239 |
| `视觉设计与渲染/太阳雨渔港3D渲染.md` | 309 | 314 | 315 |
| `算法竞赛/极值构造/单位正方形内最小三角形面积最大化.md` | 37 | 42 | 43 |
| `算法竞赛/极值构造/正负一序列的自相关能量最小化.md` | 41 | 46 | 47 |
| `算法竞赛/性能工程/网格沙粒倒塌的GPU加速.md` | 259 | 265 | 266 |
| `算法竞赛/性能工程/通用数字电路仿真器加速.md` | 303 | 309 | 310 |
| `物理建模与仿真/多物理连锁机关.md` | 265 | 269 | 270 |

题面都写“提醒你重读题面”，没有“按类别每次强制/按需”的细分。新的用户要求优先；算法和推理提醒仍出现“如有需要再重读题面”，设计题明确每次重读。题面原文保持冻结，不能伪称这些原文已全部由新策略自动生成或严格逐字一致。

## 4. 目标结构

### 4.1 模块边界与依赖方向

```text
O/
  timer.py                兼容的 CLI 分发、status；所有原命令名和钩子命令保持
  run_state.py            计时状态、事件序号/确认、运行路径；不导入其他业务模块
  session_runtime.py      launch/begin/check/close/archive/clean；不处理指挥钩子
  commander.py            claim/session/hook/rewake、来信、playbook 选择与注入
  reminders.py            策略校验、阶段选择、文字组合、离线预览；无运行副作用
  reminders.json          唯一的提醒类别/阶段/专属建议与节奏配置
  supervisor.py           监督的 ensure/status/run/step；组合运行、评分、巡逻
  common.py               OS 锁、进程身份/操作、atomic_json、read_letter
  tasks.py                现有题目元数据；增加只读打印入口，不增加题目内容
  grading.py              现有评分队列、回收、互斥、通用结构解析与汇总
  grader-prompt.txt       评分工作流、I/O 协议、指南路径；不重复本题给分方法
  patrol.py               只读巡逻 + 现有清理函数；清理仅显式命令可达
  codex_thread.py         临时管理员线程，保持独立
  steer/codex_steer.cjs   临时线程送信，保持独立
  playbook/*.md           指挥动作、条件与命令
S/
  agents.json             当前受测 Agent 的公共清单（AIAgent 可读，无评分材料）
  agents.cjs              两个显式协议适配对象；不做动态插件加载
  launch.ps1              runas 后的路径/参数/环境、模板填充、启动宿主
  session-host.cjs        通用状态、心跳、deadline、close、送达调度
  session-job.py          原样保留的 Job/DACL/绑核实现
  deliver.cjs             原样协议的消息消费者，不选择提醒策略
```

实施上只有三块 timer 职责需要拆出，再加提醒数据/组合器；grading 内部按“队列、校验、汇总”保持函数分区即可，不再拆十几个小文件。

| 模块 | 输入/输出与明确禁止 |
|---|---|
| run_state | 接收简单运行路径对象（root、models_root、mailbox_root，其他状态路径由此派生）；保留 state.json 和字段兼容；load/save/queue/confirm 不执行进程操作，不读指南，不选阶段 |
| session_runtime | 使用 run_state/common/tasks/reminders；检查截止与进程必须先于提醒组合；产出事实事件；接收 `now` 便于模拟；不选下一批、不决定续时、不认定评分违规 |
| commander | 读状态、来信和 playbook；调用 supervisor.ensure；不巡检受测任务、不推进评分；只有 claim 改归属；延续 flush 后确认 |
| supervisor | 直接调用 session_runtime、grading、patrol、run_state，不再 import timer CLI；提供 ensure/status 时不启动 run 循环。commander 可调用 supervisor，supervisor 不反向导入 commander |
| grading | 读 run_state 的只读作答状态，保留自己的 grading.json；通用结构与算术可以自动检查；证明/质量/处罚由评分 AI 按指南判断 |
| patrol | 读取共享状态与运行路径，不依赖 timer CLI；规则阈值仍集中在该模块顶部，不为一组稳定巡逻阈值再建配置系统；clean 与 report 入口分开 |
| Agent 适配 | 封装启动参数、ready/turn 状态、start/steer/interrupt/resume 及日志 ID 提取；不得读 TASKS、提醒策略或评分指南 |

路径对象只解决现有全局重定向问题，不支持动态多部署。生产 E/H 根目录保持不变；BENCH 可由源码所在目录推导。题目 submission 方法接收可选 models_root，隔离测试不再依赖修改 tasks.MODELS。测试进程操作另行 mock，路径隔离不能代替进程隔离。

### 4.2 提醒数据的具体形式

采用 UTF-8 JSON，标准库即可读取，不引入 YAML 依赖。建议结构如下，省略的题名在实文件中补齐 11 项：

```json
{
  "interval_min": 10,
  "final_left_min": 10,
  "review_from_min": {"60": 40, "90": 60},
  "categories": {
    "算法竞赛": "optional",
    "深度推理": "optional",
    "视觉设计与渲染": "required",
    "游戏设计与开发": "required",
    "复杂交互应用": "required",
    "物理建模与仿真": "required"
  },
  "text": {
    "optional": "如有需要再重读题面《{task}.md》。",
    "required": "请现在重读题面《{task}.md》，对照要求检查进度，纠正遗漏或偏离。",
    "work": "请继续推进作答，及时保存可用的阶段成果。",
    "review": "请检查完成度，补齐题面要求，并检查和提升成果质量。",
    "final": "请完成收尾，把完整可用的版本提交到 git；改动后确认可用再提交，避免到时停在半途。"
  },
  "task_tips": {
    "形式化证明题": {"default": "", "work": "", "review": "", "final": ""},
    "IMO难题精选": {"default": "", "work": "", "review": "", "final": ""}
  }
}
```

- 90 分钟：累计进度 `<60` 为 work，`≥60` 为 review；剩余 `≤10` 为 final。60 分钟：**本方案建议**前 40 分钟 work、后 20 分钟 review，最后 10 分钟 final；40 是可改的数据，不是用户已经指定的阈值。
- 每题专属文字由另一份调研给出；此处只建空槽，不杜撰建议。每题每阶段选 `该阶段非空文本`，否则选 `default`；不是把所有阶段建议同时拼上去。没有文字就不添加。
- 前期保持“时间行 + 一句类别要求 + 一句推进 + 一条短建议”；后期用 review 或 final 替换推进句。设计题前期也保留明确的重读要求。final 仍包含类别重读要求，不因收尾省略。
- 不把题面全文、评分指南、参考解法、隐藏输入、具体给分细则塞进策略；题目专属文字只能面向受测模型。
- 周期和最后提醒阈值为现有值 10/10；本次不改。时间提醒正文必须继续以 `【时间提醒】` 开头；这是现有消费协议的一部分。

组合器接口建议：

```python
load_policy(path) -> policy                         # 读取/校验，无写入
phase_for(task, segment_minutes, segment_elapsed, policy) -> str
render_reminder(task, segment_minutes, segment_elapsed, policy) -> str
preview_all(policy) -> iterable                     # 11 题全部正常提醒与边界/续做样例
```

计算约定：

```text
nominal = TASKS[task].minutes                       # 原题 60/90，选择阶段配置
segment_elapsed = max(0, (now - state_task.start) / 60)
left = max(0, state_task.minutes - segment_elapsed)
progress = nominal - state_task.minutes + segment_elapsed
phase = final if left <= final_left_min
        else review if progress >= review_from_min[nominal]
        else work
```

`--minutes` 沿用现有指挥按规则取整的剩余预算，不自行重新算补时。上述 progress 是按获准预算推算的累计进度，不能冒称精确的历史 CPU/墙钟作答时间。续做提醒标注“本段已用/剩余；全题进度约……”，普通提醒仍写“已用/剩余”。无需为这项需求迁移历史 state.json 或新增作答历史数据库。

调度与组合必须分开：

| 层次 | 处理内容 |
|---|---|
| session_runtime | 只发当前 10 分钟档，不追发错过的各档；final 与周期重合只发一次；到时后不发；记录 reminded/final_reminded |
| reminders | 根据类别、原限时、累计进度选择文字，不改状态，不读取信箱，不执行 send |
| deliver / host | 排序、合并积压、排他消费、插话/空闲唤醒、成功后归档；不推断类别或阶段 |

配置在监督启动时加载一次，修改配置后重启监督才切换；不引入文件监听或隐式热加载。新 launch 前校验配置；已运行任务遇到无有效配置时，截止/退出/关闭仍正常执行，提醒退化为短时间行和通用保存提示，错误只去重报告一次。文案失败绝不能跳过到时中止路径。

校验至少包括：六类别全覆盖、60/90 阈值合法、task_tips 恰好覆盖 TASKS、字段类型正确、无未知占位符/未替换标记、生成文案符合送达上限、设计/推理两类措辞符合要求。专属建议为空允许通过。

### 4.3 单一事实来源与文字防漂移

“单一来源”按信息性质划分，不能把题面与评分细则合成一个巨型 JSON。

| 信息 | 权威来源 | 其他位置怎么处理 |
|---|---|---|
| 作品要求、限制、交付语义、题内计分 | 现有题面；评分指南展开评分方法，与题面冲突以题面为准 | 模板/提醒只引用本题文件；不自动解释或重写规定 |
| 运行题目名、路径、时长、类别、批次、掩码、grade 互斥、现有权重 | tasks.py | playbook 执行只读 `python -B orchestrator\tasks.py` 获取表；README 作为公开说明保留，核对差异，不反向驱动运行 |
| 提醒周期、收尾阈值、阶段、类别语气与专属建议 | reminders.json | 删除 timer 文案常量；启动模板只说明“按系统时间提醒继续推进，具体要求见题面”，不再写所有题每次必重读或复制阶段策略 |
| 受测启动/续做的通用会话说明 | prompt-template/resume-template | 保留任务路径、交付、独立作答、到时停止等必要入口提示；规则细节引用题面，不复制评分版本判定长段 |
| 工作目录/最近提交的评分版本选择 | grader-prompt 中的操作流程，依据题面既有提交规则 | 指挥 playbook 只让评分 AI 依模板选择；timer 提醒不另造版本规则；本文不改这一规则 |
| 逐题分项、满分、方法、违规条款 | Grading 各题 AI评分指南.md | 不建 Python 分值表；评分表视为展示载体；guide_items 检查结构，AI 核对内容 |
| 两位评分员的标签、Agent、模型、effort、表后缀 | grading.py 中单份 GRADERS profile | 合并现有 GRADERS/CODES/命令字面量；报告动态生成；仍保持当前两位、模型和顺序 |
| 受测 Agent 可用键与协议标识 | S/agents.json | Python 读取校验；PS 不再复制白名单；host 根据 protocol 取 agents.cjs 的显式适配；型号由启动参数指定 |
| 指挥决策 | playbook | 事件只报告事实并指向条目，不把“得几分、是否重试、如何修”硬编码成长指令 |

防漂移采用小范围的只读核对，不做文件生成工程：

1. reminders 的 `--check` 校验数据/占位符/类别；`--preview-all` 直接打印最终文字，供人检查。
2. tasks 的只读输出展示现有表；核对第 3.1 节题面限时和文件存在，不因文本解析差异自动改题面。
3. 11 题运行 guide_items，核对解析结果；评分表与指南分项名称/满分用一次性只读检查核对，发现差异人工处理，不用脚本修分值。
4. 搜索旧 REREAD、WRAP_UP、“收到提醒后请重读”“每 10 分钟”“最后 10 分钟”等副本，确保运行入口只剩必要引用。题面和 README 公开描述是有意保留的文档，列入核对清单，不能用“搜索为零”作为验收条件。
5. 改动记录只写本方案或实施记录，playbook 不添加“过去如何/为何改过”段落。启动提示词缩短为读总纲、认领、执行当前阶段，不再复制整套制度。

### 4.4 消息与状态的最小可靠性整理

| 路径 | 改法 | 不作出的保证 |
|---|---|---|
| 自动时间提醒 | 用 `reminder-<start的稳定微秒标识>-<档位或final>.msg`；同次任务同档在 queued 或 delivered 已存在就不重建；临时写入名仍用唯一后缀再发布 | 不声称重启后能撤销已经进入模型上下文的旧文字 |
| 普通 send | 保持文本格式，文件名改用时间+随机唯一值；依旧 .tmp→.msg | 不把普通信当时间提醒折叠 |
| 评分→指挥事件 | grading.json 增加 `notice_seq` 和 `pending_notices`；advance 将转换与待发通知一次保存；监督把未转移序号放进 state.events 并保存 `grading_notice_ack`，成功后才从 grading 清除。重启先按 ack 去重再排空 | 两个文件没有跨文件事务；这里用可恢复的待发记录补上窗口，不声称它们物理原子提交 |
| 指挥 hooks/rewake | 保留共享锁内领取、输出 flush 后 confirm；同一时刻只由最新认领/等待者消费；长通知落盘后给全文路径 | stdout 成功只是注入通道接受，不是 AI 已执行；极端退出窗口允许重复，避免丢信 |
| 临时 Codex 线程 | 注册表用独立短锁+atomic_json；steer 用已填 owner 的目录锁，取锁后重新枚举/读取；范围检查一致 | 不把临时线程注册表并进测评状态，不修改其他项目的全局钩子 |

评分通知暂存只解决现有跨文件丢事件窗口，是原子消息处理的一部分；不用引入消息总线、事件回放系统或新调度服务。`notice_seq` 应跨 reset 保持单调，旧 grading.json 缺字段时按 0/空列表读取，不凭历史 done 任务补发全部旧通知。

### 4.5 Agent 扩展的限定做法

`S/agents.json` 仅保存当前两项，例如 `{"claude":{"protocol":"claude-stream-json"},"codex":{"protocol":"codex-app-server"}}`。这份文件位于 AIAgent 已可读的公共脚本区，不含 Grading 路径、参考材料或管理员凭据。

- `agents.cjs` 显式导出两适配器，分别实现参数、输出事件识别、initialize/resume、start、steer/工作中钩子策略、interrupt；host 保留通用 busy/stopped/failed、Job、tick、close、日志与 pending 请求。
- 新模型：只改变 launch 参数和指挥选择，不改计时、提醒、清理代码。新 Agent：增加一个协议适配器和清单项，再补 Agent 使用说明的操作命令。未新增 Agent 前不写空插件基类、不做自动扫描。
- Python/PS 仍检查参数与路径安全；PS 删除重复的 Agent 枚举，但不删除 Workdir、Minutes、Resume、环境隔离检查；host 在启动 Job/Agent 前拒绝不支持的 protocol。
- last_session 的两个日志正则集中在一份按 Agent 分支的小函数中，不散落到计时/评分；launch 在 state 记录实际 Agent 与所选模型/effort，旧状态允许缺字段，旧的 --resume 回退规则保留。不迁移存量会话号或会话历史。
- 受测常驻协议与管理员评分 CLI 是两条不同启动链。评分的 build_argv 仍按 Agent 构造自己的 CLI 参数，不复用受测 runas/宿主，不更改评分账户。

## 5. 第二阶段整治步骤与验证

以下均为**待第二阶段执行**。本阶段没有执行其中的写入、重启、故障注入或启动测试。每步保持可单独审阅；现有入口切换前一次性通过隔离验证，不在生产目录边改边观察。

| 顺序 | 要改的文件与具体工作 | 验证及通过条件 | 生效范围 |
|---|---|---|---|
| 0 切换准备 | 重新 status，确认无作答、无评分队列/运行、无保留宿主/待归档；确认指挥处于维护阶段、不再触发测评动作；对 O、S 与项目钩子做版本备份。自动化被 exclude，备份/差异必须显式包括它们；不提交密码/状态/日志 | 记录真实文件哈希、状态快照、现有钩子命令；下面所有试验使用合成状态，不能复制真实 PID 后运行 step | 不改变运行行为 |
| 1 提醒独立实现 | 新增 reminders.json/reminders.py；类别六项、原限时阶段两项、专属建议 11 槽；实现 check/preview，不先接入 timer | 70 条正常提醒全打印；类别/阶段/空提示/占位符检查；60 分钟 5 条、90 分钟 8 条；边界与续做样例见下 | 新模块尚未接入，不影响现有会话 |
| 2 拆开状态与生命周期 | 新增 run_state.py/session_runtime.py/commander.py；按第 4.1 节搬迁 timer 函数；timer 保留原 CLI 与 hook JSON 格式；supervisor/patrol/grading 去掉对 timer CLI 的依赖；移除 P09/P10 残留；采用显式运行路径 | AST/语法检查、无环导入；旧合成 state 可读；status 结果语义一致；claim/session/hook/rewake fixture 验证归属、压缩恢复、token 与 flush 失败不丢事件 | 监督相关 Python 必须重启；新钩子调用读取新 CLI；已存在 rewake 不会自动换代码 |
| 3 接入提醒与消息可靠性 | session_runtime 用 composer；稳定档位消息名；grading pending_notices/ack；grading/codex_thread 统一 atomic_json；修正损坏 JSON 的失败处理；独立修 steer 锁和范围检查 | 模拟“写信后未存状态”“保存 grading 后未排事件”“排事件后未清 pending”三处崩溃重启；无重复发布/丢事件；并行消费者只一个领取；普通消息保留；坏配置/坏状态不放行评分、不妨碍截止 | 监督重启；steer/deliver 脚本按各自钩子加载时机生效 |
| 4 整理 Agent 边界与退出事件 | 新增 S/agents.json/agents.cjs；改 launch.ps1、session-host.cjs 的重复白名单/协议分支；session_runtime 记录 Agent 元数据与读取 host.failed；host 写首次 failure_at；到时事件改成事实描述；session-job.py 不动 | 两适配器用录制/模拟协议验证 start/resume/steer/interrupt；模拟 Agent 退出宿主仍活，下一监督周期给出异常与中断时刻；模拟隔离失败日志仍可发现；核对 Job/DACL/掩码实现哈希未变 | host/适配器/PS 只对之后启动的受测宿主生效；监督的检测逻辑重启生效 |
| 5 整理评分与文字来源 | grading 合并当前两位 profile，保留身份键/模型/后缀和公式；脚本删“分歧大”的主观裁定，差值留给指挥判断；grader-prompt 删除重复评分方法，改引用指南；不改指南、分项/权重或结果 | 11 题 guide_items 与现状表一致；既有合成结果在新旧 validate/score_task/model_scores 下接受/拒绝及数值一致；两位启动 argv/文件名逐项一致；新提示词仅用副本填充核对 | 评分调度 Python 重启；提示词只用于之后启动的评分任务；运行中评分员不回灌新提示词 |
| 6 收紧操作说明 | 改 playbook 0–4、Agent使用说明、指挥启动提示词；删背景、通信图、历史解释和重复题目表；加入只读 tasks 输出、准确生效命令；README 只更新自动化摘要/引用，不动题目/计分段；模板删每次强制重读和复制阶段文字 | 按“开场、批间、异常续做、评分失败、收尾”逐项演练每条命令仍可执行；全文搜索无过期强制措辞；核对设计题每档重读不被模板弱化；题面/评分规则哈希未变 | playbook 后续读取/注入生效；启动/续做模板只影响之后 launch；已发出的文案不追溯 |
| 7 整版切换 | 离线副本验证后，维护窗口统一替换实现；保留 `.claude/settings.local.json` 现有命令路径/参数；按第 6 节刷新监督与旧 rewake；再只读 status | 监督单例+新心跳正常；认领未被调研/测试改动；既有事件队列未被清空；一次性验证无双监督；下一轮正式测试前用自有短命进程做中断/close 的隔离验收 | 不能在本次运行到时前或仅到时后立即切换 |

### 5.1 提醒验收矩阵

| 维度 | 样例与预期 |
|---|---|
| 11 题全量 | 6 道 60 分钟题，每题 t=10/20/30/40/50；5 道 90 分钟题，每题 t=10/20/30/40/50/60/70/80；共 70 条，每条打印题名、类别、原限时、阶段、正文 |
| 分类 | 6 道算法/推理题每条包含“如有需要再重读题面”；5 道设计题每条含明确的现在重读要求；不按 60/90 偷代类别 |
| 阶段 | 90 分钟 t<60 简短，60/70 检查提升，80 收尾；60 分钟 t<40 简短，40 检查提升，50 收尾；final 不重复叠加两段阶段文字 |
| 边界 | 39.99/40、59.99/60、剩余 10.01/10/9.99；到时/超时不发消息；同一 tick final 与整档只一条 |
| 调度迟到 | 90 分钟首次巡检 t=35 只发当前 30 档，正文写实际 35/55；不是补发 10/20/30 三条；下一 tick 不重发 |
| 续做 | 原 90 分钟、续 25 分钟：本段刚开始时全题进度约 65，属于 review；原 60、续 8 分钟：首轮符合原有 final 触发条件，直接 final；不把续做当“8 分钟题”找配置 |
| 建议 | 空槽不输出空标题；阶段建议替代 default；全题默认建议只出现一次；超长/未知占位符在离线 check 中报错 |
| 送达 | 两条积压时间提醒只送最新；普通 send 不丢；writer 失败不归档；有锁竞争不重复领取；【时间提醒】前缀保持 |
| 安全退化 | JSON 损坏/未知题名只使文案退化并报错；到时、退出、close 仍被处理；新 launch 在策略无效时不启动 |

建议第二阶段实现并运行的只读入口：

```powershell
python -B orchestrator\reminders.py --check
python -B orchestrator\reminders.py --preview-all
python -B orchestrator\tasks.py
python -B orchestrator\timer.py status
python -B orchestrator\grading.py status
```

前三个是本方案待新增的只读输出，现阶段不存在，不能现在照抄运行。后两个已在本次调研运行。`status` 不会认领或确保/拉起监督，不能用它当重启命令。

### 5.2 指南解析现状基线

本阶段已用 `python -B` 导入并逐题执行 guide_items，只读取得下表，没有触发评分、复制评分表或写 __pycache__。分项数不作为新的硬编码评分表，实施时应从指南重新取得。

| 题目 | 解析分项数 | 可解析的分项加权满分 | 说明 |
|---|---:|---:|---|
| 形式化证明题 | 5 | 100 | 通用“每题 N 分，K 题共……”分支 |
| IMO难题精选 | 6 | 42 | 分项可正确推导；独立的“满分 N 分”正则返回 None 不等于解析失败 |
| AE风味动效设计编辑器 | 23 | 100 | 分方向标题不重复计入分项 |
| 动态路由塔防 | 21 | 100 | 同上 |
| NVIDIA_B200网页艺术 | 18 | 100 | 同上 |
| 太阳雨渔港3D渲染 | 19 | 100 | 同上 |
| 两道极值构造（各自） | 各 1 | 各 100 | 指南“只有一个分项” |
| 两道性能工程（各自） | 各 0 | 不适用 | 指南可解析满分 100；validate 的既有兜底要求一个总分项，不是“没有分项可随意通过” |
| 多物理连锁机关 | 19 | 100 | 通用标题解析 |

可重复的只读命令（从项目根运行）：

```powershell
@'
import sys
sys.path.insert(0, 'orchestrator')
import grading
from tasks import TASKS
for name in TASKS:
    _, items, full = grading.guide_items(name)
    print(name, len(items), full, items)
'@ | python -B -
```

结构校验覆盖：有效 complete 结果、缺分项/重复分项、错误身份、NaN/越界、总分算术不符、合法 violations 扣分、指南总分兜底；维持现有接受边界，不顺手新增“必须满足 completion×quality 才收割”等评分内容检查。

### 5.3 不碰生产进程的验证边界

- 使用临时目录、合成任务、虚拟时间，以及 unittest.mock 替换 Process/alive/user_processes/kill_tree/kill_process/runas/Popen。所有可能结束进程的函数都要 mock，不能只 mock 最外层。
- 先对 AST/JSON/PS 语法做只读解析。不要用 `py_compile` 在源目录写缓存来满足本阶段“只读”；第二阶段也优先用 `python -B` 与 AST 解析。
- 子进程级集成只在维护窗口对测试专有的短命父/子进程运行，PID 来自该测试并核对创建时间；不拿真实 state 的 PID 做夹具，不向生产信箱写验证消息。
- Job/DACL/绑核不因拆模块而重写；检查原实现哈希、Job ready 顺序、CPU 掩码仍为 `0x3F00FF` 和 `0xFC0FF00`。真正的账户隔离变更不属于这次整治。
- 检查监督 step 不调用 clean（只可能请求/完成已有 close）、评分失败不会自动 retry、异常退出不会自动补时、巡逻只报告。不得为了自动化覆盖而新增这些行为。

## 6. 重启与生效范围

### 6.1 监督的安全刷新步骤

只在第二阶段维护窗口执行：

1. `python -B orchestrator\timer.py status`，取得**当前**监督 PID；结合 `supervisor.json.created` 和进程命令行确认身份，不能沿用本文 PID。
2. 用 `taskkill /PID <PID> /F` 只结束监督，**不加 `/T`**。评分 runner 可能是其子进程，/T 会误杀正在评分的任务；不得用进程名、USERNAME 批量结束。
3. 下一次原指挥会话的 session/hook/rewake 会执行 ensure 拉起监督；在完整代码就位后才允许发生。仅运行 status 不会拉起。
4. 再运行 status 确认新的 PID/心跳、单例、原状态和待送事件保留。若没有后续钩子，只在维护完成后通过既有指挥会话产生正常工具调用，让其既有 PostToolUse 拉起；不要为此伪造 claim、send 或 launch。

现有异步 rewake 是独立 Python 进程，重启监督不刷新它。结构拆分时应等它自然退出（原上限 25 分钟），或在第二阶段由指挥核对 token/PID 创建时间后只结束该旧等待进程，再通过正常 Stop 建新等待。不能误把受测 host/job 或评分 runner 当 rewake 结束。

### 6.2 生效矩阵

| 改动 | 当前进程是否自动读取 | 要做什么 |
|---|---|---|
| supervisor、session_runtime、run_state、common、tasks、grading、patrol、监督导入的 reminders.py | Python import 后缓存 | 重启监督；长期 rewake 若导入相关模块也要结束旧等待、建立新等待 |
| reminders.json（目标约定） | 监督启动时读取一次 | 配置改完校验、重启监督；已排队 .msg 不追溯替换 |
| timer/commander 的 CLI/hook 代码 | 新一次 hook/CLI 会读新文件 | 后续调用生效；旧 rewake 仍用旧代码，不能只重启监督就视为切换完成 |
| playbook、指挥启动提示词 | part/session_note 在调用时读；已注入的上下文不自动改变 | 后续读取或阶段注入生效；指挥启动提示词需用于之后的开场 |
| launch.ps1、prompt/resume-template | 每次 launch 读取/填充 | 只影响以后启动/续做的宿主，不给运行中模型重新发开场提示 |
| session-host.cjs、agents.cjs、agents.json（目标） | 宿主启动时加载，Node require 缓存 | 只影响以后启动的受测宿主；不重启正在作答的宿主来套用重构 |
| session-job.py | 每宿主启动辅助进程时加载，隔离只执行一次 | 只影响新宿主；本次不改它，也不声称修源文件能补上已运行隔离 |
| deliver.cjs | host 的 require 已缓存；Claude/评分等新钩子进程每次重新读取 | **会影响运行中会话的后续钩子**；同样必须维护窗口整版替换，不能按“只影响新会话”处理 |
| claude-settings、codex-hooks、全局 hooks 注册 | 何时重载由相应 Agent 决定，本次没有做运行中修改试验 | 保守按新 Agent 会话验证；不依赖热重载，不修改不相关全局钩子 |
| grader-prompt、评分 profiles/argv、grader_runner | launch 评分时生成提示词/启动进程 | 新评分任务生效；运行中的评分员不追溯变更；调度模块自身仍须重启监督 |
| codex_thread.py、steer/codex_steer.cjs | CLI/新一次钩子进程加载 | 后续临时线程操作/工具钩子生效；无需重启受测宿主；全局 hook 路径维持 |

## 7. 风险与避免方式

| 风险 | 可能后果 | 避免方式 |
|---|---|---|
| 运行中改 timer 或其 import，短暂缺函数/语法错误 | 指挥每次工具钩子立即报错；新监督也可能无法启动 | 第一阶段只写本文；第二阶段用离线副本完成语法、导入和模拟验证后，维护窗口完整切换 |
| 以到时作为“全部停机” | 保留宿主/评分员仍在；热改 deliver 导致新旧消费者混用 | 切换条件检查开放宿主、评分队列、待归档、旧 rewake；不能只看 21:05 或 answering=false |
| 不正确拆模块造成循环 import/全局重定向遗漏 | 监督启动失败，测试误写 H 盘或调用真实 kill | 按第 4.1 节单向依赖；生产路径不变；隔离路径加进程 mock 双重约束 |
| 提醒策略出错牵连截止 | 宿主异常时监督也无法兜底 | 截止/退出/close 路径先执行；文案读取和组合独立捕获；故障时短文案退化 |
| 重启清空/迁移旧状态 | 丢提醒标记、指挥归属、评分 PID、事件或重发全部旧通知 | 只增加可缺省字段，兼容现有 JSON；不 reset 生产状态；新通知序号从现有可用状态初始化，不回放历史全部 done |
| 将“锁”误当跨文件事务或模型确认 | 事件窗口丢失、重复提醒、过度承诺送达 | grading pending_notices+ack；稳定提醒 ID；保留 flush 后确认；验收三处崩溃窗口，允许极端重复不允许静默丢失 |
| 改分值解析同时改评分规则 | 历史结果失效，实际计分改变 | 指南/题面/分值文件冻结；新旧结构校验和汇总数值对比；不加入逐题硬编码 |
| 顺手改变 fail-open 隔离行为、账户或清理对象 | 改变竞赛隔离条件、误杀其他题 | session-job、ACL 与清理保护语义原样保留；隔离失败作为现有风险记录，不在架构整理里另改安全模型 |
| 指挥与后台自动修复相互覆盖 | 一边部署一边被钩子拉起中间版本 | 第二阶段先结束本轮并进入维护；所有依赖文件就位后才恢复正常钩子拉起；不在运行中“杀监督后慢慢改” |
| 误删兼容入口/安装副本 | 旧指挥、评分 hook 或一次性 setup 失效 | timer 命令和既有 hook 路径保持；codex-hooks 标注实际用途，不因受测改用 steer 就删全局评分 deliver 注册 |

## 8. 完成标准与明确不做的事

| 完成标准 | 检查结果应满足 |
|---|---|
| 一处改提醒 | 改类别要求、60/90 阶段或某题建议只动 reminders.json；不改送达器、题面、计时代码或 playbook |
| 一处改受测模型选择 | 现有 Agent 下新型号只改 launch 参数；不改 timer 的厂商白名单 |
| 关键运行边界可看清 | timer 是 CLI；监督只组合无人值守步骤；宿主负责中止；指挥 playbook 负责判断；评分指南负责评分内容 |
| 规则不漂移 | 70 条正常提醒、边界/续做、11 题指南解析通过；旧强制措辞已从运行模板删除；题面与计分文件无修改 |
| 安全性不退步 | Job/DACL/CPU 掩码/账户不变；消息排他和失败重试不丢失；坏 JSON 不放行评分；status 保持只读 |
| 指挥说明简洁 | playbook 每条能归为条件、动作或命令；背景、原因、历史只在本文等架构材料出现 |

不增加自动批次调度、自动重试/续时、自动改题面、评分内容裁决、通用 Agent 插件平台、更多评分员、仪表盘、远程服务、消息数据库或全量文档生成系统。新专属建议文本由另行调研提供，本方案只确定存放、选择、组合和校验方式。
