# 巡逻与交接调研（Sol）

调研对象：E:/Project/AI_OneShot_Bench 及 H:/AI_OneShot_Model/.oneshot。  
取证日期：2026-10-31；主要运行快照为 00:27—00:33（北京时间，UTC+8）。本文中的“今晚”跨越 10 月 30 日与 31 日。宿主 session.log 使用 UTC，timer-errors.log 和指挥通知使用本地时间，以下事故表已统一为北京时间。  
范围：读取代码、规则、状态、指定日志、文件元数据和进程元数据；运行内存模拟复现；只创建本报告。未执行 claim、launch、start、send、close、clean、reset、dispatch、retry、kill 或任何钩子入口，未操作受测进程，未读密码文件，未修改代码、配置、state.json、playbook 或 AIAgent 文件。作答目录仅查看存在性和文件名，未审阅答案内容。

## 一、结论与证据边界

当前体系有统一的消息运输层，但没有统一的事实解释层。监督、巡逻、钩子共用 state.json 的事件队列及 commander.next_step，因而会一致地重复同一个错误：把完整题库当成本轮安排，把当前 tasks 当成全部正式记录，把读取失败当成宿主失联，把已写信箱当成已送达。仅在文案上增加“以排班表为准”不能修复这些推导。

四类问题的判断如下：

| 问题 | 已证实的根因 | 置信度与限制 |
|---|---|---|
| “下一步”及空闲催测不符安排 | next_step、all_timed_out、patrol.report 未读排班表，未合并 archive；默认型号取最近 start，而非当前排班步骤 | 确定；有源代码、归档记录和实际指挥上下文 |
| 保留宿主被强杀 | host_status 遇读取错误返回空字典，check_task 将缺少 updated 判为过期；到时后没有保留状态豁免和二次确认 | 确定；三次事故的心跳并未按告警文案所述停止，且可用内存模拟稳定复现 |
| host.json 的 EPERM/PermissionError | Windows 原子替换与并发读存在兼容性风险；发布仅下次心跳重试，读取不重试 | 机制确定；三次错误当时的具体文件句柄持有者不能由现有日志确定，不能定责杀毒、索引或某一读取进程 |
| 额度不够权威 | 只检索受测信箱的历史事件，没有账户身份、有效期、刷新能力和缺失语义 | 确定；本次最新快照也已滞后约 18 分钟，不能代表采样时刻的当前余量 |
| 钩子噪声 | 所有通知都包完整开放会话表；下一步在监督事件、巡逻正文和通知外壳多处产生；无需行动的提醒也唤醒指挥 | 确定；同一份通知中的重复已复现 |

注意两个边界：

1. “有正式作答记录”不等于“作答正确”或“评分完成”。本次只核对作答记录的存在及来源。
2. state.json、host.json 和指挥会话正在变化；本文给出带时间的证据，不把多次只读采样冒充全系统事务快照。运行时字段应按 JSON 路径、任务标识和时间查证，行号只对应本次看到的版本。

## 二、现有信息流

### 2.1 总路径

    用户临时安排
        ↓ 指挥人工更新
    playbook/排班表.md ──→ 指挥阅读
        × 未进入 next_step / patrol / launch_blocker 的共同决策输入

    tasks.py ──→ 启动参数、批次、提醒、评分规则
        ↓
    timer.py launch → session_runtime.launch / begin
        ├─→ state.json / tasks：启动、预算、PID、生命周期
        └─→ AIAgent launch.ps1 → session-host.cjs → agents.cjs → 受测 Agent
                                  ↕ session-job.py：Job Object、子进程清理
                                  ├─→ host.json：宿主自报状态
                                  └─→ session.log：Agent 事件、故障、额度观察

    supervisor.py 每轮目标间隔 2 秒
        ├─→ session_runtime.check：截止、提醒、退出、到时兜底
        ├─→ grading.auto_step_locked：回收、校验、派发、评分消息
        ├─→ session_runtime.close_graded：评分终态后的关闭归档
        └─→ patrol.report：每 20 分钟生成报告
                 ↓
    state.json / events（seq、at、kind、text）
                 ↓
    commander.gather / report
        ├─→ PostToolUse / UserPromptSubmit → 上下文
        └─→ Stop / asyncRewake → stderr + 退出码 2 → 再唤醒指挥
                 ↓
    flush 后 confirm_events 清空待送队列；来信另移到 inbox/delivered

    grading.json / pending_notices → state.json / events
    评分员 → orchestrator/inbox/*.tmp → 原子改名 *.md → 同一指挥钩子
    受测提醒 → 信箱 *.msg → deliver.cjs / 宿主 start 或 steer → delivered/

这里的 2 秒是循环目标间隔，并非严格实时保证：step 内含锁、磁盘读取、进程枚举、评分启动和归档；超过 2 秒时不会补偿为实时截止服务。参见 [supervisor.py](E:/Project/AI_OneShot_Bench/orchestrator/supervisor.py:62)、[循环](E:/Project/AI_OneShot_Bench/orchestrator/supervisor.py:123)。

### 2.2 每类消息的生产、读取、时机与送达

| 信息 | 谁产生、读取什么 | 何时产生 | 到指挥的路径 | 当前确认含义 |
|---|---|---|---|---|
| 截止事件 | check_task 读 state.tasks 的 start/minutes，读 host.json、Windows 进程状态 | 到截止首次设置 deadline_done | supervisor.step → queue_events → hooks | 事件已输出；不证明宿主已完成中止 |
| 宿主/Agent 异常 | check_task 比对 PID/创建时间、host.failed；exit_event 生成处置文字 | 首次发现；检查异常按 message 去重 | 同上；底层错误另写 timer-errors.log | 通知已输出；未记录指挥是否处理 |
| 到时兜底 | check_task 读 host.busy、updated 及核心 PID，调用进程树终止 | 截止 +60 秒后任意一次巡检满足 busy 或 stale | 同上 | 保存 fallback_done；计时表却未专门显示 |
| 自动提醒回执 | reminders 配置决定文字；check_task/send 写 *.msg 并设标志 | 设计题半场、每段最后 10 分钟；正常结束后立即续做另由宿主触发 | kind=reminder 入 events，仍被 hooks 全文通知 | 只证明入信箱；没有“模型已读”确认 |
| 巡逻报告 | patrol.report 读 tasks、grading.json、host.json、*.msg、磁盘余量及 timer-errors.log 增量 | supervisor 在 patrol.due 成立时生成，通常每 20 分钟 | kind=patrol 入 events → 同上 | 包括“无异常”也会唤醒；不是独立主动推送进程 |
| 计时表 | commander.table 根据 tasks、closed/exited/deadline 等字段派生 | CLI status；session_note；每次 report | CLI stdout，或钩子上下文/Stop stderr | 是展示，不是状态权威源 |
| “下一步” | commander.next_step 读当前 tasks、tasks.test_batches、grading.json、cleaned_at | status、launch、clean、session_note、report、patrol；监督在无人作答且有事件时还追加一份 | 直接命令输出，或嵌入事件/巡逻/外壳 | 无版本号；历史建议会随队列延迟到达 |
| 评分状态/失败/超时 | grading.advance/reap/start；result.json 校验后生成 notices | 评分完成、失败、超过 40 分钟一次；评分员每 10 分钟另收提醒 | grading.pending_notices → publish_notices → timer events → hooks | grading_notice_ack 防止跨文件搬运重复；不是人工处理确认 |
| 评分员来信 | 评分员按 grader-prompt 写 *.tmp，关闭后改 *.md | 环境/评分问题需指挥决定时 | commander.letters → report → archive 到 delivered | flush 后归档；没有处置状态，全文最多注入 1500 字符 |
| 监督本身异常 | step/_run_owned、timer.main、repair_supervisor | 捕获异常；部分相同消息去重 | timer-errors.log；部分入队，部分仅 stderr | 不同异常路径的送达与去重策略不一致 |
| 上下文恢复交接 | session_hook/session_note 读认领信息、当前阶段和总纲/分册 | SessionStart 的 startup/resume/clear/compact | SessionStart.additionalContext，最多 8000 字符 | 不自动 claim；新 ID 需显式认领 |
| 定时兜底唤醒 | 指挥按总纲人工建 Cron，提示词以“兜底唤醒”开头 | cron 为每小时 7、37 分钟 | 新用户提示进入 UserPromptSubmit | rewake_waiting 只验证最新等待进程身份/存活；正常时拦下 |
| 额度查询 | quota.latest 仅检索信箱下 session.log 的 rate_limit_event | 指挥人工执行 quota.py | CLI stdout，再由指挥解释 | 未接入监督、巡逻或启动门禁；不是实时额度服务 |

主要入口：

- [.claude/settings.local.json](E:/Project/AI_OneShot_Bench/.claude/settings.local.json:1)：SessionStart、PostToolUse、UserPromptSubmit、Stop 的实际配置；Stop 为 asyncRewake，timeout 1560 秒。
- [commander.py](E:/Project/AI_OneShot_Bench/orchestrator/commander.py:248)：事件钩子；[Stop 等待](E:/Project/AI_OneShot_Bench/orchestrator/commander.py:285)每 2 秒查看队列，最长 1500 秒，无新消息但仍 active 时发 25 分钟心跳。
- [run_state.py](E:/Project/AI_OneShot_Bench/orchestrator/run_state.py:70)：事件与计时状态同一次原子写入；输出 flush 后才确认。这是应保留的可靠性基础。
- [grading.py](E:/Project/AI_OneShot_Bench/orchestrator/grading.py:893)：评分通知先保存 timer 侧 ack，再清评分侧 outbox，已有重启恢复设计。
- [grader-prompt.txt](E:/Project/AI_OneShot_Bench/orchestrator/grader-prompt.txt:42)：评分员来信约定。
- [deliver.cjs](H:/AI_OneShot_Model/.oneshot/deliver.cjs:70)：受测消息消费者；[宿主](H:/AI_OneShot_Model/.oneshot/session-host.cjs:158)负责空闲唤醒与 Codex steer。辅助工作线程另有 [codex_thread.py](E:/Project/AI_OneShot_Bench/orchestrator/codex_thread.py:156) 的 steer 信箱，不等同于评分员给指挥的 inbox。

补充：不能把 timer.py 的 hook/session/rewake 当成只读检查命令。它们会调用 repair_supervisor，后者可能写 hold_until、拉起或重建监督；本次没有调用这些入口。

## 三、当前字段的数据权威来源

权威来源必须分清“用户意图”“观测事实”“程序派生”和“通知副本”。

| 数据或字段 | 当前来源与写入者 | 正确解释 | 现有缺口 |
|---|---|---|---|
| 本轮测哪些题、顺序、暂停、不再排测、何时评分 | 用户指令；落地到排班表 | 当前操作以排班表为准；总纲第 3 行及排班表第 7 行已明确 | 只有人读取，机器决策未接入 |
| 题库、默认分钟、类别、CPU 分配、批次、评分员 | tasks.py 的 TASKS/test_batches | 题库规则和默认值 | 不能证明本轮要测全题库；不能代表已运行会话的冻结版本 |
| tasks.start、minutes | session_runtime.begin；CLI start 亦可写 | 本段登记计时事实；截止=start+minutes×60 | 不是严格的首个模型输出时刻；begin 后才写 deadline.json，跨文件非原子 |
| deadline.json.start/minutes | begin 从上述登记值写出的副本 | 宿主执行截止的输入 | 无 run_id/revision，读取失败时宿主 expired 返回 false |
| pid / process_created | launch.ps1 的 pid.txt；begin 打开进程取创建时间 | pid 是启动器 PowerShell 的 PID，不是 host PID | 必须和创建时间一起使用；不能单看数字 |
| host_pid/job_pid/agent_pid、busy/stopped/failed/failure_at、updated | session-host.cjs.publish | 宿主自报；updated 为宿主发布时刻，busy 是协议侧一轮执行标志 | 读取失败不能据此判 false/0；stopped 表示已进入截止处理，不独立证明清理完成 |
| host_created | check_task 用 Windows Process 查询 | 宿主身份的旁证 | 创建时间未知仍可能放行；核心 PID 集合部分来源未逐一绑定创建时间 |
| deadline_done、deadline_at、deadline_detected_at | check_task | 已登记到时；deadline_at 是计划截止，detected_at 是发现时刻 | 不等于真正停止工作 |
| exited_at、exit_time_known、exit_detected_at | 保留的 Windows 进程句柄/host.failure_at；取不到时估计 | 分清实际结束与监督发现；估计值不能冒充精确值 | Agent 失败沿用“宿主异常退出”处置文字，故障类别仍混杂 |
| fallback_done/killed_at、kill_targets | check_task | 监督执行过到时兜底及目标身份记录 | 没有完整记录触发前 host 证据；table 未展示该终态 |
| closed、close_requested_at、closed_at、archive_pending/error、log_dir | close_tick/stash_mailbox | 会话关闭与信箱搬运的不同阶段 | closed 不能代替归档完成；跨盘逐文件搬运可能部分成功 |
| 正式作答是否存在 | 排班表认定 + tasks/archive 的计时事实 + 指向的作答/日志目录 | archive 是历史记录，不是“从未测过” | 缺少正式选用、作废、被替代、题面版本的结构化指针 |
| reminded/final_reminded/halfway_reminded | check_task/send | 已排入信箱的逻辑标志 | 不是送达/已读；续做只保留部分提醒标志 |
| *.msg 与 delivered/*.msg | send 与 deliver/宿主 | 待投递与消费者输出后的归档 | 定时提醒会合并，只保留最新文字，其他也归档；不能把全部 delivered 当成全部已读 |
| events.seq/at/kind/text、event_seq | queue_events | 指挥待送消息，at 常为入队时刻 | 事件正文可能包含旧建议；没有证据结构、严重度、处置状态 |
| event_ack | confirm_events | 已 flush 的最后一条；随后 events 清空 | 不是指挥已理解/完成；ack 后无独立永久事件账本 |
| orchestrator、rewake_token/created | claim、rewake_hook | 指挥接收方及最新等待者的身份 | 不代表该指挥仍能处理消息；无待送积压升级机制 |
| supervisor.json.pid/created/heartbeat/running | 监督 _run_owned | 监督自报；supervisor_status 再检查新鲜度和 alive | “不健康”不等于进程死亡，长 step 也会使心跳过期 |
| grading.jobs/parts.state | grading 的调度、回收、校验 | 评分执行状态以 phase 为最细粒度，父 job 为聚合 | 未绑定具体正式作答版本；“failed”无“不再重试”结构化决定 |
| result.json 分数与 complete | 评分员写，grading.validate/reap 接收 | 通过校验后才成为采用结果；规则仍以指南为准 | 文件存在不等于评分完成，缺段不能放大已有分 |
| 额度 status/unifiedWindows/utilization/resetsAt | 服务端信息经受测 Agent 的 rate_limit_event 进入 session.log | 指定时刻的服务端额度观察 | 无账号主体、新鲜度、窗口覆盖及当前刷新保证 |
| patrol_at、patrol_log_size | 监督调用巡逻时保存 | 报告节奏和日志字节游标 | 不是故障确认/解决记录；手动 patrol 只生成预览，不保存游标 |
| “下一步”、表格状态、idle 分钟 | commander/patrol 派生 | 只能是解释结果 | 目前被当成指令，且证据不足 |

## 四、四类问题逐条取证

### 4.1 安排与正式记录未进入共同推导

#### A. Opus 形式化证明题反复被当成未启动

现象：钩子和巡逻提示“继续逐个 launch ① 并行批剩余 1 题：形式化证明题”。

根因：

- [next_step 第 107—118 行](E:/Project/AI_OneShot_Bench/orchestrator/commander.py:104)仅从当前 tasks 构造 mine，用 n not in mine 算 missing。
- [timer.reset 第 35—47 行](E:/Project/AI_OneShot_Bench/orchestrator/timer.py:35)会将记录放到 archive，再从 tasks 删除；next_step、all_timed_out 和巡逻都不查 archive。
- [patrol.report 第 69—78 行](E:/Project/AI_OneShot_Bench/orchestrator/patrol.py:65)的分母固定为 len(TASKS)=11。
- 当前 [排班表](E:/Project/AI_OneShot_Bench/orchestrator/playbook/排班表.md:36)认定 Opus 已有全部 11 题，评分等用户指示；机器仍按完整作答流程建议 launch。

直接证据：

- state.json 的 archive[7]，归档标识 20261030-052622，含 Claude/Opus5.5/形式化证明题：start=1793304421.711555（04:07:01），minutes=60，deadline_at=05:07:01，closed_at=05:08:12，log_dir 指向 orchestrator/logs/Claude/Opus5.5/形式化证明题/20261030-050812。
- [该归档日志](E:/Project/AI_OneShot_Bench/orchestrator/logs/Claude/Opus5.5/形式化证明题/20261030-050812/session.log:1)存在，长度 1,817,312 字节；H:/AI_OneShot_Model/Claude/Opus5.5/形式化证明题 下有题面及 Problem*.lean。
- 下文统一称“指挥记录 T”的 JSONL：C:/Users/Administrator/.claude/projects/E--Project-AI-OneShot-Bench/00229dd5-4e38-471e-895e-c1790288b388.jsonl。T 第 13498 行，19:59:49，含 #巡逻正文和外壳各一遍相同错误建议；第 13583 行 20:19:50 再次重复。
- 内存构造“当前已有其他十题、形式化在 archive”的状态，真实 next_step 仍返回缺少形式化，all_timed_out 返回 false。

修复不能只把所有 archive 无条件并上：同一题已有多次记录、作废说明、旧题名和重测，必须有正式选用指针及题面版本，见第六节。

#### B. Sol 只安排 NV/渔港，却提示剩余五题

[排班表第 48 行](E:/Project/AI_OneShot_Bench/orchestrator/playbook/排班表.md:48)写明用户 23:01 安排两题，到时 clean 后等用户指示。当前 tasks 只有这两题，next_step 用七题并行批减去两题，得到五题；已归档的 Sol 形式化也被计入“缺题”。

证据：

- archive[3] 的 GPT/6.1Sol/形式化证明题，start=2026-10-29 20:05:14，deadline_at=21:05:14，closed_at=21:06:13，log_dir 为 20261029-210613。
- T 第 15771 行，23:40:02：巡逻显示 GPT/6.1Sol 作答中 2 题，却建议启动形式化、IMO、AE、塔防、物理五题；第 15912 行自动提醒回执外壳又带同样建议。
- 对本次实际 state 的纯读取调用，显式传 GPT/6.1Sol 仍输出上述五题。
- 不传 model 时，又因 Opus 在 00:00 有续做记录，默认型号变成 Opus，输出“缺形式化”。这是“最近启动的型号”替代“当前排班步骤”的另一个错误。

#### C. Haiku 已停止排测，仍按四道算法题催测

根因：[patrol.py 第 106—112 行](E:/Project/AI_OneShot_Bench/orchestrator/patrol.py:106)只判断当前型号无作答、mine 少于 11 且闲置超过 10 分钟，没有暂停、不再排测、等用户、等额度等状态。

T 第 10499 行 15:59:45 记“19 分钟没有题在作答，还有 4 题没启动”；第 10776 行 16:19:45 记 39 分钟；第 12838 行 19:19:48 仍记 219 分钟。当前排班表明确 Haiku“不再排测”。这些数字是题库差额和距截止时间，并不是“应当行动却未行动”的时间。

### 4.2 三次保留宿主被结束：确定的错误在监督判断

#### A. 可直接验证的错误链

[host_status](E:/Project/AI_OneShot_Bench/orchestrator/session_runtime.py:110)在 OSError/JSON 错误时记录日志，然后返回空字典。随后 [check_task 第 189—205 行](E:/Project/AI_OneShot_Bench/orchestrator/session_runtime.py:189)计算：

    stale = now - host.get('updated', 0) > 15
    截止已过 60 秒 且 (host.busy 或 stale) → capture_tree → terminate_targets

因此，一次读取失败会把 updated 变成 0；对于任何已经过了截止宽限期的保留宿主，都可能立即触发整棵树终止。它不要求连续失败，不复读，不使用上次成功状态，不检查 stopped，不要求证明仍在作答。这套兜底在截止几小时后仍持续生效。

#### B. 三次时间线

| 任务/宿主 | 登记截止；宿主截止处理 | 读取失败 | 最后持久化 host.json | 监督结束证据 |
|---|---|---|---|---|
| Opus 塔防，host 24376 | 10-30 21:30:44.607；session.log 第 2814 行 21:30:45.351 deadline reached，第 2818 行已清子进程 | timer-errors.log 第 447 行，21:47:17.874661 | updated=1793368037.873，即 21:47:17.873；busy=false、stopped=true、failed=false | state.tasks 的 fallback_killed_at=21:47:21.469763；T 第 14471 行保存事件 #296 |
| Opus 渔港旧段，host 27552 | deadline.json 为 21:20:47.735517；session.log 第 3086 行 21:20:48.460 deadline reached，第 3091 行已清子进程 | 第 459 行，23:20:34.907233 | 归档 host.json 的 updated=23:20:45.282；busy=false、stopped=true、failed=false，晚于读错约 10 秒 | T 第 15457 行事件 #305，23:20:50；归档日志第 3102 行 23:20:42.109 agent exit |
| Opus NV 新段，host 77724 | 10-31 00:12:39.016886；session.log 第 473 行 00:12:39.845 deadline reached，第 477 行已清子进程 | 第 483 行，00:17:14.732663 | updated=00:17:18.743；busy=false、stopped=true、failed=false，晚于读错约 4 秒 | state.tasks 的 fallback_killed_at=00:17:22.655991；T 第 16427 行事件 #314 |

日志链接：

- [timer-errors.log 三次读取错误](E:/Project/AI_OneShot_Bench/orchestrator/logs/timer-errors.log:447)。
- [塔防 session.log](H:/AI_OneShot_Model/.oneshot/mailbox/Claude/Opus5.5/动态路由塔防/session.log:2814)、[host.json](H:/AI_OneShot_Model/.oneshot/mailbox/Claude/Opus5.5/动态路由塔防/host.json:1)。
- [渔港旧段 session.log](E:/Project/AI_OneShot_Bench/orchestrator/logs/Claude/Opus5.5/太阳雨渔港3D渲染/20261031-000037/session.log:3086)、[归档 host.json](E:/Project/AI_OneShot_Bench/orchestrator/logs/Claude/Opus5.5/太阳雨渔港3D渲染/20261031-000037/host.json:1)、[deadline.json](E:/Project/AI_OneShot_Bench/orchestrator/logs/Claude/Opus5.5/太阳雨渔港3D渲染/20261031-000037/deadline.json:1)。
- [NV session.log](H:/AI_OneShot_Model/.oneshot/mailbox/Claude/Opus5.5/NVIDIA_B200网页艺术/session.log:473)、[host.json](H:/AI_OneShot_Model/.oneshot/mailbox/Claude/Opus5.5/NVIDIA_B200网页艺术/host.json:1)。

T 的三个条目为 api-request-blob，证明相应事件文本进入了指挥请求上下文；不把它们重复计为新的事故或独立日志写入。

结论：塔防在读取失败前约 1 毫秒刚发布心跳，另两题在失败后仍发布状态，不能称“心跳已停”。被清理时已经经过截止约 16.6 分钟、120 分钟、4.7 分钟，告警却都写“到时后约 60 秒”，把阈值错写成了实际延迟。

#### C. 宿主写状态、占用、ACL 分别能判断到什么程度

1. 宿主确有发布脆弱点。[session-host.cjs 第 19—29 行](H:/AI_OneShot_Model/.oneshot/session-host.cjs:19)同步写 host.<PID>.tmp 后 rename 覆盖 host.json；失败只写 host status retry，等下一轮 2 秒心跳。没有连续失败计数、最后发布成功时间、退避重试和独立健康通道。
2. session.log 的 EPERM 证明“这一次 rename 失败”，不是“宿主退出”。塔防第 622、985、1208、1929 等行出现过，后面仍正常到时；渔港旧段直到 23:20:32.878 还报一次 rename 重试。
3. Windows 的打开共享模式会影响并发删除和重命名；微软明确 FILE_SHARE_DELETE 与 rename/delete 相关。libuv 的 Windows rename 实现使用 MoveFileExW + MOVEFILE_REPLACE_EXISTING。CPython 3.12 的 FileIO 普通打开走 _wopen，而现有读取没有专门控制共享删除模式。因此自身高频读与替换竞争是有代码依据的候选，应优先用离线对照验证。[微软 CreateFile](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea)、[libuv 源码](https://github.com/libuv/libuv/blob/v1.x/src/win/fs.c)、[CPython 源码](https://github.com/python/cpython/blob/v3.12.10/Modules/_io/fileio.c)。
4. 本次只读 ACL：塔防目录及 host.json 给 AIAgent Modify/Synchronize，给 Administrator、Administrators、SYSTEM FullControl；文件仅 Archive 属性。管理员令牌为高完整性。稳定的 NTFS 读写权限缺失不符合“长期正常、偶发失败后又成功”的证据；但当前 ACL 不能证明事故瞬间没有过滤驱动或权限变化。
5. 机器上 MsMpEng.exe、SearchIndexer.exe 等存在，只能说明服务运行，不能证明它们在事故时占用 host.json。现有日志没有句柄、ShareMode、Win32 原始错误码和调用栈，不能据此宣布“杀毒导致”。

需补证的方法：在离线临时信箱中，用与生产相同 Node/Python 版本、AIAgent 权限和 ACL，分别测试普通 Python 读、允许共享删除的读、无读者三组；记录替换失败率及原始 Win32 错误。若仍需锁定实际占用者，再在维护窗口用有大小上限的 Process Monitor，限定 host.json/host.*.tmp 路径，检查 CreateFile、重命名、共享冲突、用户名与调用栈，不安装或调整防护排除项来“试错”。该工具支持这些只读取证维度，见[微软 Process Monitor 文档](https://learn.microsoft.com/sysinternals/downloads/procmon)。这些取证本轮均未执行。

### 4.3 额度：历史观察被用于当前启动决策

[quota.latest 第 15—29 行](E:/Project/AI_OneShot_Bench/orchestrator/quota.py:15)只遍历当前信箱，不读指挥、评分员、其他客户端或已搬走的归档日志；按字符串时间挑最新事件，无有效期、账号或窗口身份校验。[排班表第 23—26 行](E:/Project/AI_OneShot_Bench/orchestrator/playbook/排班表.md:23)却直接用其 60%/85% 阈值决定是否开步。

实测：00:30:06 扫描 10 份信箱 session.log，8 份含额度事件；最新为 Opus NV 第 439 行，UTC 16:11:46.694，即本地 00:11:46.694，距采样约 18 分 20 秒。它报告五小时 17%、七天 1%、status=allowed。这些数值只能写成“00:11:46 观察到”，不能写成“现在还剩 83%”。本次最新记录并非几小时前；代码确实允许记录无限陈旧。

需要校正用户观察中的一个含义：如果这些事件报告的是共享账户窗口，它们在采样时可能已包含其他客户端的累计消耗，并非天然只统计该受测会话。缺口在于其他客户端后续消耗没有触发本脚本的新观察，且脚本未证明几个进程属于同一额度主体。Anthropic 官方说明同一 Claude 账户跨产品共享使用限制，亦提供 /usage 查看计划额度；本轮未查询账户面板、未读取凭据，未验证可供无人值守调用的官方只读接口。[官方共享限制说明](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work)、[官方 /usage 文档](https://code.claude.com/docs/en/commands)。

其他确定缺陷：任意最新事件 JSON 截断可让 latest 整体抛错；只捕获文件读取 OSError，不捕获事件解析错误。窗口不存在时静默不打印；resetsAt 已过时仍可打印负的“还有 N 分钟”；按日志字符串排序，格式不统一会失真；关闭搬走信箱后可能退回更老的记录。不能以本地 token 估算或“刷新时刻已经过了”推断服务端余量归零重置。

### 4.4 重复输出：运输可靠，但消息分层不足

[commander.report 第 75—85 行](E:/Project/AI_OneShot_Bench/orchestrator/commander.py:75)每次都生成所有开放会话的整表及 next_step。与此同时：

- [supervisor.step 第 66—68 行](E:/Project/AI_OneShot_Bench/orchestrator/supervisor.py:62)可能把 next_step 再作为一条事件入队；
- [patrol.report 第 109、139 行](E:/Project/AI_OneShot_Bench/orchestrator/patrol.py:106)在空闲问题及报告结尾各附一次；
- kind=reminder 不被 gather 或 report 过滤，已写明“无需指挥处理”的回执照样触发 Stop；
- 正常巡逻每 20 分钟生成“无异常”，也成为可唤醒事件。

并非每次 Stop 调用必然输出：没有事件/来信时它会等待，无 active 时安静结束；问题是“一旦有任何通知，输出整表和建议”，加上正常通知源持续制造唤醒。T 第 13498 行同一投递中已有两份 next_step，Haiku 空闲巡逻还可达到三份；内存复现 c.report(state, [next_step]) 的确产生两份。

## 五、其他误报、漏报与交接风险

下表中“代码可达”表示已确认分支存在，但本轮没有把该风险记成已发生事故。

| 编号 | 现象/可能影响 | 根因与证据 | 分类 |
|---|---|---|---|
| R1 | 强杀后的任务仍显示“已到时，保留宿主”，指挥以为宿主尚在 | commander.table 只看 closed、exit_detected、close_requested、answering；不看 fallback_done。check_task 开头又对 fallback_done 直接返回，不再纠正退出状态（runtime:161；commander:61） | 已内存复现，严重状态误报 |
| R2 | 旧目录阻塞后续批次，或建议和门禁判断不同 | launch_blocker:535 在无当前计时记录时以目录存在推断前批未完成；已归档作答同样有目录。next_step 却以当前键缺失判未启动 | 代码可达；目录不是安排或作答状态 |
| R3 | 另一型号的评分失败、排队停滞不进入巡逻 | patrol:69 只选最近 start 的型号，评分诊断 sessions 也只取该型号；开放宿主遍历全部型号，覆盖范围不一致 | 代码可达，漏报 |
| R4 | 巡逻把暂时读不到宿主说成“心跳停但进程没退出” | patrol:90—97 调 host_status 的空字典，以任务 start 代替 updated，且该分支未单独验证进程存活 | 代码可达，误报 |
| R5 | 作答中宿主卡住很久才提醒；“保留宿主”读失败却可能直接强杀 | 到截止前 check_task 不用心跳判卡住；巡逻用 2 分钟阈值但每 20 分钟才看；监督到时阈值只有 15 秒 | 检测和处置阈值不一致 |
| R6 | 已决定不重试的评分持续被提示失败；长评分持续被提示超时 | patrol:115—119 每次根据 failed/elapsed 重报，只有括号说“不重试不用再管”；未保存决定。grading.advance:873 的一次通知与巡逻重复 | 代码可达，处置无闭环 |
| R7 | 将“已排入信箱”误写成“已送达”，统计提醒数量偏大 | runtime:235—237 的文字超出 send 证据；deliver:83—92 只注入最新定时提醒，却将读取到的全部消息归档 | 确定语义错误；交接审计缺口 |
| R8 | 延迟投递的旧“下一步”与当前安排冲突，压缩恢复时丢失临时决定 | events 持久化的是含建议的整段文字；没有 schedule revision；session_note 只注入总纲/当前分册，排班表仍靠指挥再读 | 代码可达，尤其跨 claim/压缩 |
| R9 | 消息已出管道但指挥没真正接收，队列已清；来信已读但未处理无人跟踪 | flush 后 confirm_events 清空 events；ack 仅代表输出。letters 与 events 无共同处理 ID；超长通知落文件后也立即确认 | 可靠性边界；不能宣传端到端恰好一次 |
| R10 | 部分旧错误不再提示；日志轮转后漏算或重算 | patrol.new_errors 初次以当前 size 为 seen，按字节游标而非文件身份跟踪，且先推进游标；任何新异常只显示最后一条头行 | 代码可达；缺故障聚合与恢复状态 |
| R11 | 监督停滞被另一个钩子误判为需重建 | ensure_supervisor:39—43 对“进程仍活但心跳过期”的同身份监督直接结束；step 内做慢 IO/派发/归档且持共享锁，心跳只在整步后更新 | 代码可达；本轮观察到监督 PID 变化，但未归因于此 |
| R12 | 重启后本应立即巡逻，实际再等 20 分钟 | patrol.due:146 对距旧 patrol_at 超过 40 分钟的情况直接重置起点；未区分新轮次与长时间停检 | 代码可达，检测延迟 |
| R13 | 评分仅部分题结束就关闭该型号全部保留宿主 | close_graded:331—339 按该型号所有“已有 jobs”均 done/failed 判 finished，未核对本轮预期评分集合、选用作答或保留策略 | 代码可达；部分排测下需特别处理 |
| R14 | 本段续做覆盖前段计时，历史难以审计；提醒累计时间也可能不准 | begin:63—67 同键覆盖旧 task；stash 保存日志但不自动保留每段结构化状态；halfway_minute 用完整默认预算减本段预算推算累计已用 | 代码可达；不能把预算差一律当已作答时间 |
| R15 | state 已开始计时但宿主没拿到截止；截止文件短暂读错时继续执行 | begin:68 保存 state 后才写 deadline.json；host.expired:38—42 读错返回 false，无版本或截止读取故障事件 | 代码可达，可能超时作答 |
| R16 | 清理保护集合缺失导致误清理；PID 重用时对象不属于原会话 | clean:359 依赖 host_status/core_pids；读错会缺 host/job/agent。core_pids:122—124 接收 PID 后未逐一校验原创建身份；旧 pid.txt 亦可进入目标 | 代码可达；本轮未执行清理验证 |
| R17 | 历史失败试跑/旧题名被当正式，或正式记录被漏掉 | archive 混有 Probe、重测、旧题名如 IMO难题精选/多物理连锁机关及 note；无 formal/superseded/statement_hash | 已有数据结构缺口 |
| R18 | 换指挥后消息积压，却没有可靠升级 | claim 只改 SID；监督本身不主动给模型发请求，依赖钩子/Stop/Cron；BACKSTOP 是否拦截仅依 rewake 等待进程，而非整条投递链健康 | 代码可达；需监测未送达时长与接收者租约 |

R11 的本次观察：00:32 读取到监督 PID 12656，创建 00:32:24，命令行是 supervisor.py --interval 2。这里只说明运行环境在变化，不声称是本次只读检查重启了监督，也不把未经核实的原因记成事故。

## 六、“一致体系”的目标设计

### 6.1 唯一权威、允许副本、禁止双写

采用“意图、执行、观测、解释、投递”五层，副本必须带来源、版本和采样时间。下面是建议方案，不是本轮已经创建的文件。

| 领域 | 唯一权威 | 其他地方如何使用 |
|---|---|---|
| 本轮安排 | 新增 orchestrator/schedule.json，由专用 schedule 命令唯一写入；记录用户指令引用及 revision | 排班表.md 改为自动生成的人类视图；不再同时手写两份真相。迁移前仍以当前排班表及最新用户指令为准 |
| 题库规则 | tasks.py 的稳定 task_id、版本、题面/配置摘要 | 每次 evaluation 启动冻结快照；新默认值不回写运行中预算 |
| 正式作答与时间段 | state.json v2 的 evaluations/attempts/segments，以及 official_selection 指针 | archive 只是归档位置；是否正式由选用状态决定，目录只作存在性证据 |
| 宿主事实 | 对应 run_id 的宿主状态及 Job 控制回执；Windows 句柄/创建时间为身份和存活旁证 | 监督缓存最近成功观测；读取失败返回 unknown，不能造出 false、0 或“已死亡” |
| 评分 | grading.json 的 phase 状态，绑定 evaluation_id 和 submission revision；采用结果须经 validate | 汇总、巡逻和关闭都读取相同评分集合及终态决定 |
| 额度 | 同一账户/组织/计费方式/额度桶下的服务端新鲜快照，统一由 quota provider 获取 | quota.py 是查询/刷新与缓存适配器；会话事件仅作带时效的补充观察，不累加各会话百分比 |
| 派生状态和行动建议 | 一个纯函数 build_view/decide_next，输入带版本的统一快照 | status、巡逻、钩子和启动/评分门禁只消费此结果，不再各写一套条件 |
| 通知与处置 | 永久结构化事件账本 + 每接收者投递游标 + 告警处置记录 | 不再把已 flush 当成已解决；巡逻只是观察/核对生产者 |

不建议用自然语言/勾选框正则自动猜“暂停”“不测”等含义。首次迁移由指挥把现有排班显式登记成结构化状态，并生成预览核对；生成的排班表保留用户熟悉的阅读入口。若仍允许人工改 Markdown，则必须通过明确的结构化区块导入并校验 revision，不能让双源静默分叉。

### 6.2 安排与正式记录的最小模型

安排至少包含：plan_id、revision、用户指令引用、updated_at；每个 step 的 model、精确 task_id 集合、顺序/依赖、并发或独占约束、state、reason、resume_condition、允许的评分范围、retention_policy。状态建议为 ready、running、paused、not_scheduled、awaiting_user、quota_wait、done、cancelled；paused 等状态不是故障。

执行记录至少包含：

- evaluation_id：型号 + 稳定题目 ID + 题面/材料版本 + 本轮正式测评身份。
- attempt_id / segment_id：一次尝试和中断续做分段；记录 start、budget、实际/估计结束、结束原因、来源、parent_segment、累计作答时间，保留每段事实。
- official_selection：accepted / superseded / void / pending_review、选用的 attempt、决定依据；不能自动选择“时间最新的一份”。
- run_id：贯穿 launch、pid.txt、deadline、host、提醒、评分及日志目录；进程用 PID + creation time + run_id 绑定。
- answer_state 与 host_state 分开：answering / interruption_pending / deadline_stopped / failed；host_alive / retaining / close_requested / closed / unknown，避免一串布尔值产生非法组合。
- 留存策略：retain_until_grading、retain_until_user、close_when_terminal，并有原因；允许长期保留而不催 close。
- 评分失败的 disposition：retry_pending、waived、final_failed，重试次数绑定 phase，避免仅在聊天里记决定。

迁移本轮安排时的期望解释：

| 型号 | 应生成的意图 | 自动系统的正确行为 |
|---|---|---|
| Opus5.5 | 接纳已确认的各题正式记录；评分 awaiting_user | 不催缺形式化，不催立即评分；保留宿主按策略展示 |
| GPT/6.1Sol | 当前步骤仅 NV/渔港两题；步骤结束 clean 后 awaiting_user | 不扩展成七题或十一题；保留已归档形式化的正式身份 |
| Haiku5.5 | 后续任务 not_scheduled | 不计算“尚有四题应启动”，仍记录已经发生的故障和结果 |
| Fable5.1 | 五道设计题 awaiting_user；四道算法暂不测 | 用户明确开始前不催 launch |
| Sonnet5.5 | 并行七题 paused | 只显示暂停原因，不发空闲告警 |

partial 排测的完成分母必须是该步骤任务集合。全套 benchmark 总分仍遵循原权重和缺口规则；只测两题不能自动重标成完整 11 题成绩，也不能任意重新归一化权重。

### 6.3 宿主读取与截止处置的决策表

host_status 应改成返回带质量的观测：

    observation:
      run_id、observed_at、source_updated_at、publish_seq
      quality = fresh / stale / missing / unreadable / invalid / identity_mismatch
      value = 最近这次成功读取的完整状态，或空
      last_good = 最近成功观测，及其采样时刻
      error = code / winerror / syscall / path / consecutive_failures

只有 value 缺失时保留 unknown；last_good 可以辅助判断，但不能冒充当前心跳。

| 情况 | 应做什么 | 不应据此推出什么 |
|---|---|---|
| 单次 PermissionError/短暂不存在/JSON 不完整 | 有界重试、保留 last_good、统计失败；不发指挥告警 | 不推出心跳停止或需要杀宿主 |
| 已有匹配 run_id 的到时停止及清理完成回执，当前读取异常 | 保持 deadline_stopped/retaining；持续失败超过阈值后发一次“观测不可用”告警 | 不重新打开无限期截止强杀条件 |
| 到截止但尚无清理完成回执 | 通过独立、校验身份的 Job 控制通道请求 interrupt/停止作答，记录命令 ID 和 ACK | stopped=true 仅表示进入处理，不能代替清理 ACK |
| 超过宽限且有新鲜证据仍 busy/仍有未获准工作进程 | 终止该 run 的作答工作负载，保留可保留的宿主/控制进程；记录依据和真实延迟 | 不把“CLI 核心进程存在”本身算作仍在作答 |
| 观测持续不可用，且无法证明截止得到执行 | 用独立 Job/进程证据核实；控制失败并确认仍运行时按截止保障策略兜底，必要时结束该 run 的 Job 并告警 | 不能无限放行超时作答，也不能仅凭一份文件读错强杀 |
| 进程确实退出或身份不符 | 记录实际/估计时刻及身份冲突，按是否还有作答预算决定处置 | 到时后不续时；未知时长不冒充精确时长 |

建议起点：单次读取重试总预算 100—300ms；连续 3 轮失败或持续 10 秒进入 degraded，持续 30 秒且需要决策时才通知；具体值在离线负载测试后定。15 秒/2 分钟两个现有阈值应归入同一健康策略，持续时长用 monotonic，审计时间保留 UTC。

宿主需发布 publish_seq、deadline_revision、stop_started_at、interrupt_ack、cleanup_completed_at、非保留 Job 成员数量和最后发布成功信息。cleanup 的 ACK 应包括未能终止的成员及 Win32 错误，不能只有 killed 列表而把打开失败当不存在。当前 session-job.py:145—152 会跳过无法打开的 PID，须补足这一证据缺口。

读端可在 Windows 使用允许 FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE 的短生命周期句柄读取原子快照；不要复用只给 FILE_SHARE_READ 的 read_letter，它专用于拒绝来信并发写。写端用独立临时文件、有界非阻塞退避、成功序号；保留原子替换，不改成直接覆盖 JSON。先验证跨账户 ACL 与共享模式；长期可把控制及 ACK 走本地 IPC，将文件保留为兼容观测副本。

### 6.4 额度权威与启动门禁

把 quota 输出标准化为：provider、account_scope（非敏感指纹）、billing_mode、window_id、utilization、reset_at、observed_at、fetched_at、source、freshness、status、覆盖的窗口集合、最近读取错误。

具体规则：

1. 先确认指挥、受测、评分员是否使用同一服务端账户/组织和额度桶；Windows 用户名不能代替账户身份。禁止采集或输出 token。
2. 优先接入官方支持的只读账户额度来源。官方 /usage/账户 Usage 页面可用于核验；本轮没有证据证明一个稳定、可无人值守调用的公开订阅额度 API 已可用，不能把未验证的 OAuth 私有地址写成现成方案。
3. 若没有合适机器接口，先采用“官方界面快照 + 时间/主体登记”的过渡 provider；事件回退仍保留原观察时间。拿不到新鲜快照就输出 unknown/stale，禁止输出当前余量或“可启动”结论。
4. 开步前需要一次新鲜快照，建议有效期先设 60 秒；共享账户在此后仍可能被其他客户端消耗，必须带时间，不能承诺完成整批。阈值仍可沿用 60%/85% 作为排班政策，但不伪装成供应商规则。
5. 窗口已过期、缺窗口、身份不一致、解析失败均进入 unknown。reset_at 只用于安排“到时再刷新”，不自动清零、不直接恢复测试。
6. 多客户端事件按账户/窗口合并最新服务端观察，不累加利用率；服务端限流事实要与窗口和时刻关联。可另记预计消耗/容量预约，明确它是本地估计。
7. 中央额度服务缓存并限制刷新频率，避免每个钩子访问网络；刷新失败聚合一次，在需要 launch/评分派发而受阻时才告警。

### 6.5 告警、巡逻与钩子精简

事件只存事实和证据，不持久化旧的 launch/clean 指令。结构至少有 event_id、kind、severity、entity/run_id、plan_revision、observed_at、dedupe_key、evidence、action_required、recommended_action、resolved_at/disposition。

- 告警进入条件：偏离当前计划或截止保障，且指挥现在能采取具体行动；内容给出“对象、事实、依据、动作、截止/影响”，不是泛泛“可能卡死”。
- 首次出现、严重度升级、指定提醒到期且仍未处理、恢复时才通知；同一故障按 run_id+reason 聚合。用户已暂停、不排测、等待指示、接受失败、保留宿主等，记录决定后停止催办。
- 20 分钟巡逻继续执行核对，但正常结果仅更新健康状态和审计记录，不唤醒 AI；发现新增行动项才入通知。不能用“安静”代替监督心跳监测。
- 提醒生命周期分 published、injected、superseded、delivery_failed；“模型已读”若无协议 ACK 不宣称。正常回执沉入审计，不唤醒指挥；真正投递失败才合并成行动项。
- PostToolUse/UserPromptSubmit 只注入新增行动项，若计划/下一步发生变化再附一行。Stop 收到同样摘要；无变化继续等待。完整表只在显式 status、SessionStart/恢复且需要交接、或重大阶段变更时输出。
- next_step 只在统一 renderer 一个位置出现，不写进巡逻正文或监督事实事件；无授权待办时明确写“等待用户指示/已暂停”，不要生成 launch 命令。
- 状态快照携带 state_revision、plan_revision、task_catalog_revision、grading_revision、采样时间；旧通知在送出前重新核对适用性，事实仍保留，过时动作标 superseded。
- 接收方持租约/交接版本，使用每 SID 投递游标；区分 produced → emitted → received（能力允许时）→ resolved。无法实现 received ACK 时明确只有 emitted，不能承诺恰好一次；消费者按 event_id 幂等。
- 永久账本保留事实和处置；钩子只传索引/短摘要。长通知分页并按条确认，避免一条 8000 字符溢出导致所有问题只剩文件路径。

建议摘要示例（设计格式，非本次状态通知）：

    【需处理 #A42】Opus/塔防：宿主状态连续 30 秒不可读，Win32=32。
    依据：最后成功 seq=812 为 stopped、cleanup 完成；当前进程身份匹配。
    动作：检查宿主发布通道。当前保持保留状态；本次不需要续时。
    完整证据：事件 #A42。

正常巡逻无新行动项时不注入上述格式；显式 status 仍能看到“暂停/保留/等待用户”的原因及全表。

### 6.6 交接包

压缩、恢复、新 claim 共用一个只读生成器，交接内容包括：

1. 当前用户安排及 revision、当前步骤、授权范围、暂停/等待条件；
2. 正式作答选用记录及版本，运行中/保留/待关闭的会话身份和冻结截止；
3. 未解决行动项、已接受的失败/不重试决定、额度快照及年龄；
4. 评分范围、phase 进度及绑定的作答版本；
5. 最后已投递序号、积压年龄、监督健康及各证据路径。

按优先级注入短摘要，完整包通过明确路径读取。记录的截止不能因为换指挥、压缩、reset 展示或重读 tasks.py 而重新起算。

## 七、具体改动清单与测试计划

以下均为后续实施建议，本轮不执行。

| 优先级 | 文件/函数 | 具体改动 | 验收重点 |
|---|---|---|---|
| P0 | session_runtime.py：host_status、check_task | 引入 Observation，读错≠stale；缓存 last_good；有界重试；截止停止与保留分离；保存强杀前证据、真实延迟与 reason_code | 单次读错不强杀；真实超时仍能停止；三次事故回放不误杀 |
| P0 | common.py：新增 read_json_shared / 进程身份助手 | 共享删除读取；区分 errno/winerror；所有操作校验 run_id、PID、created；不可查询返回 unknown | Windows 共享/替换竞争、ACL 拒绝、PID 重用、句柄泄漏 |
| P0 | commander.py：table | 展示 fallback_terminated、retaining、observation_unknown、关闭/归档阶段；来源不足时不谎称宿主仍在 | 强杀后不显示“保留宿主”；截止/关闭用时不混淆 |
| P0 | H:/AI_OneShot_Model/.oneshot/session-host.cjs：publish/tick/cleanup | 稳定 run_id、发布序号、有界异步重试；截止/清理 ACK，读取截止错误可观测；心跳与慢清理分离 | EPERM 后恢复；deadline 读错；interrupt 拒绝；cleanup 超时仍有健康信号 |
| P0 | H:/AI_OneShot_Model/.oneshot/session-job.py：main 清理协议 | 返回成员/失败证据；独立控制通道校验身份；停止工作负载与关闭整 Job 分开 | 保留核心进程、终止孤儿子进程、无法打开成员、Job 控制失败 |
| P1 | 新 schedule.py / schedule.json | 校验、更新、revision、生成排班视图；明确 paused/not_scheduled/awaiting_user/quota_wait；禁止隐式扩题 | 现排班逐项一致；未知状态/任务/冲突依赖拒绝并给依据 |
| P1 | run_state.py：load/save/queue_events/confirm_events；新增迁移和快照层 | schema_version；evaluation/attempt/segment 与正式选用；不可变事件、单消费者游标、告警处置；向后兼容读取 | 幂等迁移、无记录丢失、原子写失败恢复、无双写 |
| P1 | commander.py：next_step/all_timed_out/current_part/report/session_note/gather | 统一 decide_next/build_view；按计划范围和正式记录推进；按授权范围输出；通知过滤、差量及交接包 | 三型号误报消失；默认不随最新 start 漂移；恢复能看到暂停原因 |
| P1 | session_runtime.py：launch/launch_blocker/begin/fail_launch | 与同一决策函数共用资格判断；不以目录存在排班；冻结规则与分段；事务式启动握手 | 建议与门禁一致；历史目录/归档不误阻塞；启动失败有独立尝试记录 |
| P1 | timer.py：status/reset/start/claim | status 支持全表/证据/计划摘要；reset 只归档展示，不删除正式身份；旧 start 入口也受一致校验 | 归档后仍认正式；绕过 launch 的入口不会漏校验 |
| P1 | patrol.py：report/due/new_errors | 遍历所有计划实体；统一健康判据；只生产新增行动项；日志文件身份+游标、故障恢复；重启区分新轮次 | 暂停不催；其他型号失败不漏；轮转、首启和长停后检查 |
| P1 | quota.py：latest/main 与新增 provider/cache | 按主体和窗口统一快照；新鲜度/unknown/缺窗口；容错解析和增量采集；开步按需刷新 | 旧数据不放行；截断事件不使全局崩溃；搬走信箱不倒退 |
| P1 | supervisor.py：step/_run_owned/ensure_supervisor | 控制慢操作与锁持有；健康/阶段进度区分；不凭一次心跳过期就重建活进程；只排行动通知 | 慢归档/评分启动不误重启；重启不重发已确认消息 |
| P1 | grading.py：plan/testing/start/advance/publish_notices/refresh；runtime.close_graded | 绑定正式作答、计划评分集合；存失败处置；自动关闭遵守 retention；评分 outbox 接统一事件 | 部分排测/补评/重试不误关整型号；不改变计分与独占顺序 |
| P2 | deliver.cjs、agents.cjs；reminders.py/json | 消息 ID/回执区分 injected/superseded；保持现有文字与去重规则；按冻结预算和累计分段算提醒 | 半场/最后提醒不重复、无时间泄露；不同协议接受后才确认 |
| P2 | .claude/settings.local.json、指挥启动提示词、grader-prompt.txt | 入口兼容，调整摘要/交接约定，来信加入 event/run/evaluation ID | hook JSON/退出码兼容；不误领开发会话，不要求评分员手工改调度事实 |

### 7.1 本轮已做的验证

没有改测试文件，也没有运行可能生成大量工作目录的全套测试。使用 python -B 导入真实模块，进程查询/终止及发布写入均由 mock 替代，构造内存状态验证以下结果：

| 场景 | 实际结果 |
|---|---|
| 到时后、新鲜 busy=false/stopped=true | terminate_targets 调用 0 次 |
| 同一任务，仅 host_status 改为空字典 | terminate_targets 调用 1 次，设置 fallback_done，生成“心跳已停”告警 |
| 真实 host_status 的 read_text 抛 PermissionError | 返回空字典，并记录一次错误 |
| 形式化在 archive、当前已有其余十题 | next_step 仍要求 launch 形式化，all_timed_out 为 false |
| report 输入已含 next_step 的事件 | 单份投递出现两遍相同 next_step |
| fallback_done=true 的任务进入 table | 仍显示“已到时，保留宿主” |
| 最新额度事件 JSON 截断 | latest 抛 JSONDecodeError，未跳过坏记录 |
| 对实际 state 的纯 next_step 调用 | 默认选 Opus；显式 GPT 则报缺五题，均与排班意图不符 |

这些是对现有缺陷的复现，不是修复后的通过证明。代码执行未调用真实终止、信箱发送、state.save 或主管理钩子，也未产生 pycache。

现有测试值得保留的基础：[test_automation.py](E:/Project/AI_OneShot_Bench/orchestrator/tests/test_automation.py:35)将真实进程动作设为禁止，根目录重定向到 tests/work；已有投递失败保留事件、显式认领、保留宿主不阻塞评分、完整批次推进等覆盖。[test_host.cjs](E:/Project/AI_OneShot_Bench/orchestrator/tests/test_host.cjs:15)模拟子进程/时钟，但使用真实临时文件。当前文件没有对 host.json EPERM/读取失败导致截止误杀的专门覆盖，也未覆盖排班、正式选用和账户额度时效。完整流水线测试目前还断言 next_step 被放进事件，重构时应改为事实与单一 renderer 的断言。

### 7.2 必补回归矩阵

1. 安排：两题局部测评、完整十一题、暂停、不再排测、等待用户、额度等待；用户改 revision 时撤回旧建议；恢复/压缩/换 SID 后仍一致。
2. 正式记录：当前/归档/多次重测/作废/旧题名映射/不同题面 hash；正式选用不靠最新时间；reset 和续做均保留分段。
3. 生命周期：三次事故逐时钟回放；PermissionError、FileNotFound、截断 JSON、未来时间戳、连续发布失败、读恢复；fresh stopped 与真正 busy 的处置分离。
4. 进程与截止：PID 重用、创建时间未知、host/job/agent 不匹配、孤儿进程、Job 查询/终止失败；未知不能冒充已停止，也不能误杀其他 run。
5. 提醒：发布成功但未注入、消费者输出失败、合并的旧提醒、续做半场累计、最后十分钟优先、截止后禁止投递，保持现有文案约束。
6. 消息运输：重复消费、输出断管、flush 后进程退出、来信归档失败、长通知分页、评分 outbox 两文件写入中断、无人认领与积压升级。
7. 巡逻：所有型号覆盖；无异常不唤醒；已确认/忽略/恢复状态；日志轮转/截断、首次扫描、停检超过四十分钟。
8. 额度：共享主体、不同主体、缺窗口、旧窗口/已过 reset、过期快照、接口失败/缓存、乱序/重复/坏事件、不同时间格式；未知时给出刷新动作而不编余量。
9. 评分：两题局部范围、单评分员失败已接受、补评/重试、全部终态但仍要求保留、旧轮次 jobs；原主体验证与性能独占回归继续通过。
10. Windows 集成：在明确隔离的临时目录/离线账户环境检验读写共享模式、ACL、原子替换和文件句柄数量，不使用真实作答目录或运行中信箱。

验收标准：每条告警可追溯到事实及计划版本；三类计划例子不再催测；单次状态读取错误绝不终止保留宿主；真实超时工作负载仍按规则停止；正常 20 分钟巡逻和提醒回执不会唤醒指挥；每份通知最多一行下一步；未知额度不能被当成可用额度；端到端投递和人工处置分开记账。

## 八、playbook、排班表与提示词同步

| 文档 | 需要同步之处 |
|---|---|
| 0-总纲.md 第 3、6、11—15 行及“体系异常” | 解释结构化计划与生成视图；完整题库批次仅为默认约束，实际范围来自计划；正常巡逻不要求指挥动作；Cron 只核对未送达/监督失联；交接包取代反复全册注入 |
| 1-准备与启动.md 第 9、14、24 行 | 不再要求局部测评先 reset/准备全部 11 目录；正式选用不可因重开批次丢失；准备和 launch 仅针对授权任务集合，冻结题面/预算 |
| 2-计时与关闭.md 第 13—22、24—36 行 | 按当前计划批次子集推进；区分到时停止、保留、观测未知和异常中断；仅真实未完成预算可续做；清理必须身份核验及观测可靠 |
| 3-评分.md 第 3、8、11 行 | 完整十一题/十七评分会话是全套配置；局部评分必须显式范围；失败接受/不再重试写 disposition；自动关闭遵守计划保留策略 |
| 4-汇报.md 第 3、8、9 行 | 汇报明确局部/完整范围与缺口；只有计划允许时关闭/清理；当前排班禁止删会话历史的规则优先，不能被通用“汇报后清理”覆盖 |
| 排班表.md 第 3、7、23—32、34—58 行 | 迁移成唯一计划的人类视图；显式暂停/不排测/等待条件及正式记录引用；额度展示采样时间/主体/缺失；不只依勾选框和百分比推进 |
| 指挥启动提示词.txt 第 2—3 行 | 启动先拿交接包和当前计划，不无条件“测完 11 题后评分”；保持单指挥约束 |
| grader-prompt.txt 的来信/结束约定 | 来信标识 run/evaluation/phase；结果和来信引用同一作答版本；不让评分员承担账户额度或调度真相的维护 |

当前总纲与排班表已经写了优先级，但通用准备/评分/清理章节仍按全套流程表述。实施前应统一“计划授权范围 + 题库安全约束”，避免指挥在两套正文之间自行补规则。

## 九、实施顺序与风险

建议先离线修复 P0 的观测语义、截止判据及状态展示，用三次事故回放验证；再实现结构化计划、正式记录和共享决策函数，迁移现有排班；随后接事件降噪、交接闭环、额度 provider 和评分关闭策略。不能仅压低告警频率掩盖真实生命周期错误。

主要风险及控制：

- 截止保障回归：简单加“stopped 就永不杀”会漏掉清理/interrupt 失败。必须区分“已开始停止”和“已确认停止”，以 Job 控制回执和工作进程证据补全。
- 迁移误认正式记录：archive 含旧题面、试跑、作废、重测。先生成候选/冲突清单，按既有用户决定和排班确认选用，不能自动挑最新或全量合并；不改答案。
- 双权威：如果 schedule.json 与排班表继续各自手写，问题会更隐蔽。必须限定一个写入口并能检测视图版本落后。
- 热加载差异：Python 监督导入模块常驻，reminders.runtime_policy 也缓存；CLI/钩子可能已读新代码，宿主则在启动时加载。tasks.py 在本次取证前 23:56 有修改，而部分会话更早开始，说明冻结版本和观测 provenance 必不可少，不能用当前默认分钟覆盖旧段。
- 进程误杀：新协议需要与旧 pid.txt/host 格式兼容，身份不足先报告 unknown；不要回退到按进程名或账户批量杀。特别防止 clean 在 host 读取失败时丢失保护集合。
- 消息丢失/重复：更改 ack 和过滤可能误吞真正行动项。保留先持久化后确认的基础，采用可重放事件 ID；正常回执降级但不能丢审计。
- 新增 I/O 干扰：中心快照、额度刷新和账本不能在 2 秒巡检的共享锁里做长网络/磁盘操作；事件写入与状态变化保持事务一致。
- 账户与接口限制：官方订阅额度未必有合适的公开自动接口。无法刷新就显示未知和阻塞原因，不能用未验证私有 API 或本地 token 估算冒充权威值。
- 日志归档与清理：永久事件和正式记录不能被现有巡逻清理当过时文件删除；跨盘归档应有 manifest/校验及幂等重试，避免部分搬运后失去日志关联。
- 正在运行的测评：本轮不切换、不重启任何组件。后续按维护窗口、离线回放、兼容版本及明确加载边界实施；保留回滚数据与原记录，不追溯改写既有计时事实。

## 十、取证索引与复核说明

核心源码行号：commander.py:61/75/97/104/141/162/239/248/285；session_runtime.py:52/110/161/189/215/275/329/351/428/527；supervisor.py:20/30/62/109；patrol.py:47/65/106/144；quota.py:15；run_state.py:59/70；grading.py:182/719/815/844/893；H:/AI_OneShot_Model/.oneshot/session-host.cjs:19/38/129/141；session-job.py:123；deliver.cjs:70。

指挥上下文证据：[记录 T](C:/Users/Administrator/.claude/projects/E--Project-AI-OneShot-Bench/00229dd5-4e38-471e-895e-c1790288b388.jsonl:13498)。定位时使用前述行号和事件序号，避免把 api-request-blob 与对应用户上下文重复计数。报告只摘取运行通知，不包含模型答案、凭据或无关聊天。

本轮检查没有运行有副作用的调度 CLI。正式文件 SHA-256 于报告制作前采集用于末尾复核，覆盖 27 个代码/规则/配置文件；其中 commander.py 为 c8d962300a7e4e0e7302b79b67d15dc663a18f80a84d37460db13808e2c3b213，session_runtime.py 为 9ec9d702b6a24f2425247d464d1080f6054624295dabd0855c1881979f2f54ad，session-host.cjs 为 ea356328949c005ff9d28f6c57d74df6ea189ba30bc5395d3d8508df5d71e815。运行态文件不纳入“不变”承诺，因为监督和指挥仍在正常写入。

00:39:37 完成复核：上述 27 个文件的 SHA-256 全部与制作报告前一致；报告的 37 个本地文件链接均存在，UTF-8 文本没有替换字符。修改范围仅为本报告；未因取证执行任何监督修复、调度或进程操作。

