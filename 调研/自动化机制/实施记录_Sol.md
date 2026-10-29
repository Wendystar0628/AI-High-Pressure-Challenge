# 自动化机制整治实施记录（Sol）

实施日期：2026-10-29；完整代码切换：2026-10-29 22:16:56；生产刷新验证：2026-10-29 22:18:38（UTC+8）。

## 1. 实施范围与结果

- 已按第一阶段方案步骤 0–7 完成离线开发、验证、切换和生产状态检查，并纳入用户后续补充 1–10。
- 分类统一为“主动设计题”和“标准评判题”；标准评判题只收简短时间/提交提示，数学题仅保留获准附加句；主动设计题按阶段重读与推进整体完成度和质量，正常结束一轮后由现有宿主在约 0–2 秒内继续。
- 注入文字使用平实说明，删除允许停手、收尾、求稳、模型比较和施压的表达；主动设计题含小 bug 不应拖住整体推进及 git 版本兜底的说明。形式化题不注入临时换题建议。
- 只对主动设计题接入可选的本地浏览器 MCP；标准评判题禁用。完整权限和无审批设置保持，未修改账户、DACL、Job、绑核或普通题目限时。
- 本次没有执行真实受测 launch、runas、claim、reset、clean 或 send；所有 launch/close/故障注入单测使用合成状态和进程 mock。管理员的浏览器连通性测试独立进行，不是正式受测会话。
- **没有 Git 提交。没有修改 Grading 文件。** 现有 Git diff 含实施前和其他代理的改动，不能把 diff 总量归到本次。

`B/` = `E:\Project\AI_OneShot_Bench\`；`S/` = `H:\AI_OneShot_Model\.oneshot\`。

## 2. 文件清单

本次发布 34 个代码/配置/说明/测试文件，并对 11 份题面和 README 做定点补丁。题面只改获准的提醒、交付版本、设计题持续检查、两道数学题提前结束建议，以及新增浏览器第 2/4 条；共 39 处。未覆盖整份题面或 README；其他代理已完成的开头、格式宽容、罚则迁移和作答建议均保留。

| 状态 | 文件 |
|---|---|
| 修改 | `B/orchestrator/codex_thread.py` |
| 新增 | `B/orchestrator/commander.py` |
| 修改 | `B/orchestrator/grader-prompt.txt` |
| 修改 | `B/orchestrator/grading.py` |
| 修改 | `B/orchestrator/patrol.py` |
| 新增 | `B/orchestrator/reminders.json` |
| 新增 | `B/orchestrator/reminders.py` |
| 新增 | `B/orchestrator/run_state.py` |
| 新增 | `B/orchestrator/session_runtime.py` |
| 修改 | `B/orchestrator/supervisor.py` |
| 修改 | `B/orchestrator/tasks.py` |
| 修改 | `B/orchestrator/timer.py` |
| 修改 | `B/orchestrator/指挥启动提示词.txt` |
| 修改 | `B/orchestrator/playbook/0-总纲.md` |
| 修改 | `B/orchestrator/playbook/1-准备与启动.md` |
| 修改 | `B/orchestrator/playbook/2-计时与关闭.md` |
| 修改 | `B/orchestrator/playbook/3-评分.md` |
| 修改 | `B/orchestrator/playbook/4-汇报.md` |
| 修改 | `B/orchestrator/playbook/Agent使用说明.md` |
| 修改 | `B/orchestrator/steer/codex_steer.cjs` |
| 新增 | `B/orchestrator/tests/test_automation.py` |
| 新增 | `B/orchestrator/tests/test_host.cjs` |
| 新增 | `S/agents.cjs` |
| 新增 | `S/agents.json` |
| 新增 | `S/browser-mcp.json` |
| 新增 | `S/browser-probe.html` |
| 新增 | `S/browser-probe.txt` |
| 新增 | `S/browser.cjs` |
| 修改 | `S/deliver.cjs` |
| 新增 | `S/empty-mcp.json` |
| 修改 | `S/launch.ps1` |
| 修改 | `S/prompt-template.txt` |
| 修改 | `S/resume-template.txt` |
| 修改 | `S/session-host.cjs` |
| 定点补丁（3 处） | `B/深度推理/形式化证明题.md` |
| 定点补丁（3 处） | `B/深度推理/IMO难题精选.md` |
| 定点补丁（5 处） | `B/复杂交互应用/AE风味动效设计编辑器.md` |
| 定点补丁（5 处） | `B/游戏设计与开发/动态路由塔防.md` |
| 定点补丁（5 处） | `B/视觉设计与渲染/NVIDIA_B200网页艺术.md` |
| 定点补丁（5 处） | `B/视觉设计与渲染/太阳雨渔港3D渲染.md` |
| 定点补丁（2 处） | `B/算法竞赛/极值构造/单位正方形内最小三角形面积最大化.md` |
| 定点补丁（2 处） | `B/算法竞赛/极值构造/正负一序列的自相关能量最小化.md` |
| 定点补丁（2 处） | `B/算法竞赛/性能工程/网格沙粒倒塌的GPU加速.md` |
| 定点补丁（2 处） | `B/算法竞赛/性能工程/通用数字电路仿真器加速.md` |
| 定点补丁（5 处） | `B/物理建模与仿真/多物理连锁机关.md` |
| 定点补丁（8 处） | `B/README.md` |

交付文档另有：`B/调研/自动化机制/提醒预览.md`、本文。第一阶段方案保留为调研原记录，后续用户要求以本次实现和本文为准。

## 3. 模块与策略整理

| 部分 | 实际改法 |
|---|---|
| timer CLI | 保留所有原命令与 hook JSON 输出入口；分发到专门模块，项目 .claude/settings.local.json 字节不变 |
| run_state | 集中运行路径、原 JSON 状态读写、事件序号与确认；隔离测试不再全局改写各模块路径 |
| session_runtime | 管理 launch、begin、check、close、归档与 clean；异常判断/是否续时/是否重试仍交指挥 playbook |
| commander | 管理认领、SessionStart 注入、PostToolUse/UserPromptSubmit、Stop 等待和来信；保留 flush 后确认与最新 token 规则 |
| reminders.json/reminders.py | 两类映射、10 分钟节奏、阶段正文、五题检查重点、两类叫醒文字、纯组合及离线预览；阶段按原题限时与剩余预算定位，续做不重置成新题 |
| 消息 | 时间提醒稳定 ID，queued/delivered 去重；普通消息唯一名称；评分转换与通知在 grading.json 同次保存，待发通知按序号转入指挥事件并确认；三种信箱保持独立 |
| grading | 单份两评分员 profile 生成命令、标签和表后缀；损坏 JSON 不再当无任务放行评分；通用结构校验和分数算法不改 |
| 监督 | 单例取锁失败安静退出；ensure 在候选退出后继续握手/重试，覆盖旧实例退出时的竞争；Agent failed 每轮检查并保留首次故障时刻 |
| 宿主 | 两 Agent 协议放在 agents.cjs；Job ready 后才启动 Agent；正常完成触发一次主动设计题继续，API/额度/进程错误设置 failed，不重复继续；到时先于叫醒 |
| 临时 Codex 线程 | 单独的短锁与 atomic_json；项目路径边界检查；steer 复用目录排他锁，取锁后枚举；未改全局 hook 注册 |
| 操作说明 | playbook 只列动作、条件、命令；任务表通过 tasks.py 只读输出；管理员与 AIAgent 的操作边界保留 |

## 4. 各步骤验证

| 步骤 | 验证与结果 |
|---|---|
| 0 维护核对 | status 确认所有既有记录关闭、无 queued/running 评分；GPT/6.1Sol 已由指挥归档。备份 75 份原始源文档与必要状态快照，未把真实状态/PID复制到运行测试区 |
| 1 提醒 | `reminders.py --check` 通过：11 题、6 类、2 类题、70 条定时提醒、22 份分类提示词。60 分钟题每题 5 条，90 分钟题每题 8 条；第 80 分钟和最后阈值重合只发一次 |
| 2 拆模块 | 全部 Python AST 与全局名检查、PowerShell 语法、Node --check 通过；claim、非认领会话隔离、SessionStart JSON、事件确认失败保留等回归通过 |
| 3 消息/状态 | 模拟写提醒后未存状态、grading 保存后未写 timer、写 timer 后未清 grading 待发三处中断，重试不重复发布/不丢事件；破损状态阻止评分启动；送达失败不归档，竞争消费者只一方领取 |
| 4 生命周期/Agent | 共 26 项 Python 回归和 10 个 Node 宿主/送达场景通过；两 Agent 分别验证主动设计正常完成→一次继续、标准题不立即继续、故障不连续继续、到时不继续；完整 mock launch、保留宿主不阻塞评分、clean 保护核心 PID、close/归档通过 |
| 5 评分 | 旧/新 guide_items、validate、score_task、model_scores、norm、by_key、author_items 的 AST 相同；派发仍为 12 个轻量/网页并行，再单个独占；Job/DACL、grader_runner 与项目 hook 设置原字节不变；实际指南重新解析见下表 |
| 6 文本/模板 | PowerShell 与 Python 实际分类选择/占位符替换的 22 份全文一致；题面/README 应用逐行补丁并逐处读回；不复制评分资料到受测脚本区；最新定稿的平实语气、小 bug、git、形式化题要求已检查 |
| 7 切换 | 先备好并发布全部依赖，最后以 os.replace 原子切换 timer.py；没有中间缺模块或半文件入口。随后核对生产状态、认领保持、源文件 SHA-256 与部署清单相符；预览从已部署代码生成 |

真实 Windows 单例竞争另做了进程级验证：一个旧持锁实例发布退出状态并延迟释放，前两个候选安静退出，第三个成功握手；没有 timer-errors.log。该测试没有调用 runas，没有接触生产任务或其 PID。

实际生产指南解析结果（未改指南）：

| 题目 | 解析分项数 |
|---|---:|
| 形式化证明题 | 5 |
| IMO难题精选 | 6 |
| AE风味动效设计编辑器 | 23 |
| 动态路由塔防 | 21 |
| NVIDIA_B200网页艺术 | 18 |
| 太阳雨渔港3D渲染 | 19 |
| 单位正方形内最小三角形面积最大化 | 1 |
| 正负一序列的自相关能量最小化 | 1 |
| 网格沙粒倒塌的GPU加速 | 0 |
| 通用数字电路仿真器加速 | 0 |
| 多物理连锁机关 | 19 |

性能题解析为 0 个命名分项时，保留既有“一个总分项+指南满分”校验兜底；并非跳过校验。IMO 的原始满分 42 由指南分项推导，不新增逐题 Python 分值表。

## 5. 浏览器 MCP

### 5.1 接入与权限

- 复用指挥安装的 chrome-devtools-mcp 1.12.0，没有再次安装。入口为 `S/tools/chrome-devtools-mcp/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js`。
- 固定配置在 browser-mcp.json：headless、本机 Chrome、isolated 临时用户目录、关闭 usageStatistics/performanceCrux、experimentalVision、1920×1080 视口、D3D11、screenshotMaxWidth=1440；另加 do-not-de-elevate，使管理员探针也在同一 Job 中启动 Chrome。没有加入 no-sandbox、breakaway 或降低隔离的选项；分辨率没有写进题面。
- 两类开关由 reminders 的类别映射经 launch 的 TaskClass 传到宿主；标准题 Claude 使用 strict+empty-mcp.json，Codex 禁用 oneshot_browser；尤其没有给 IMO 增加浏览器工具。
- Claude 保持 bypassPermissions；Codex 保持 never/danger-full-access，并将本地 server 的 default_tools_approval_mode 设 auto、required 设 false。相关配置项和 app-server 协议已对照[官方配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)与[官方 app-server 文档](https://learn.chatgpt.com/docs/app-server)，并以下述本机实测核对。
- 注册配置缺失/损坏时退化为空配置；server 进程启动失败为可选工具失效，不使正常会话起不来。强制结束产生的临时目录残留继续由既有轮后 patrol clean 清理。

### 5.2 管理员侧已实测

| 项目 | 结果 |
|---|---|
| Codex 模型实际调用 | app-server 模型发起 oneshot_browser/list_pages，状态 completed，客户端审批/elicitation 请求 0 |
| Claude 模型实际调用 | mcp__oneshot_browser__list_pages 成功，permission_denials 为空；工具搜索后直接调用，无需确认 |
| 可选 server 故障 | 不存在的 MCP 入口：Codex thread/start 成功；Claude 正常返回 OPTIONAL_MCP_OK，未因 server 缺失退出 |
| 打开页面和截图 | data 页面打开，PNG 实际写出，检查通过 |
| 实际 WebGL renderer | `ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 (0x00002704) Direct3D11 vs_5_0 ps_5_0, D3D11)`，无 SwiftShader |
| 两场并行隔离 | A 仅列 A 页面，B 仅列 B 页面；没有互相混入 |
| Job 归属 | 查询两场 app-server 后代，16 个 Chrome 进程均属于探针自己的 kill-on-close Job；正式宿主仍保持先入 Job 再起 Agent 的顺序 |

以上是管理员侧验证。**AIAgent 的真实 logon SID/DACL、工具可用性和显卡访问仍需由指挥跑下面的探针**；本次没有代替指挥执行 runas，也没有宣称 AIAgent 已实测通过。

### 5.3 指挥执行 AIAgent 短探针

本版提供 `--browser-probe`，仅允许 `Probe/` 命名空间中的主动设计题；不增加第 12 题、不改正式题目。参数通过正常 timer→runas→launch.ps1→host→Job 链路运行，改用专用探针提示词并放入测试页。

1. 用两个全新的 Probe 型号目录，分别准备 `H:\AI_OneShot_Model\Probe\ClaudeBrowser\AE风味动效设计编辑器\` 与 `H:\AI_OneShot_Model\Probe\CodexBrowser\AE风味动效设计编辑器\`。目录已有内容先归档，不覆盖正式作答。
2. 按 1-准备与启动.md 复制该题题面并 git init/提交题面。不要计划评分，不在这些目录放 Grading 文件。
3. **只由指挥**在同一维护轮先后启动两场，使它们时间重叠：

```powershell
python orchestrator\timer.py launch "Probe/ClaudeBrowser" "AE风味动效设计编辑器" claude --model "claude-opus-5-5" --effort xhigh --minutes 3 --browser-probe
python orchestrator\timer.py launch "Probe/CodexBrowser" "AE风味动效设计编辑器" codex --model "gpt-6.1-sol" --effort xhigh --minutes 3 --browser-probe
```

4. 读取各自的 browser-probe-result.json 与对应 session.log：工具真实调用、PNG 路径、WebGL renderer=RTX 4080 非 SwiftShader、两场标题/token/页面列表互不干扰；检查无审批、elicitation、isolation failed 或 startup error。
5. 到时后用 timer status 核对，再由指挥执行：

```powershell
python orchestrator\timer.py close "Probe/ClaudeBrowser" "AE风味动效设计编辑器"
python orchestrator\timer.py close "Probe/CodexBrowser" "AE风味动效设计编辑器"
python orchestrator\timer.py clean
python orchestrator\timer.py reset "Probe/ClaudeBrowser"
python orchestrator\timer.py reset "Probe/CodexBrowser"
```

Probe 目录/result 是本次探针结果，可保留；它们不进入正常 11 题评分。这里的命令仅供指挥执行，本次没有运行。

## 6. 刷新与生效范围

生产刷新时 status 返回旧监督 PID 27068 已停止；核对实际进程后没有对失效 PID 盲发 taskkill，旧 rewake 也没有仍需结束的实例。通过 ensure 的新握手拉起 PID 52932；2026-10-29 22:18:38 的 status 确认运行中、心跳正常，grading status 显示没有评分任务，原指挥认领和归档保持。监督空闲退出是正常行为；后续钩子按需再拉起。

仍在运行的监督/旧 rewake 如需刷新，只能核对 PID、命令行和创建时间后 `taskkill /PID <PID> /F`，不加 /T；本次刷新脚本具有这项校验，但没有误杀已经退出的 PID。

| 修改 | 生效范围 |
|---|---|
| 监督导入的 Python、reminders.json | 监督进程启动时读取；本次已刷新；今后改动仍需刷新监督 |
| timer/commander | 后续 CLI/钩子读取新文件；长期旧 rewake 需核对后刷新；hook 命令及 JSON 格式不变 |
| playbook | 后续 part/session 注入或指挥读取生效；快速模式说明已追加，默认不开快速模式 |
| launch、host、agents、browser 配置、开场/续做模板 | 只影响之后启动的会话；本次没有运行中受测宿主，不追溯替换已发提示词 |
| deliver | 新的工具钩子进程会重读；宿主 require 缓存到宿主结束；本次完整切换时无活跃受测宿主 |
| grader-prompt/profiles | 之后启动的评分任务使用；没有回灌旧评分员 |
| 项目/全局 hook 注册、账户/进程隔离 | 没改；不需要重装插件或修改管理员配置 |

## 7. 复查命令、证据和未做项

```powershell
python -B orchestrator\reminders.py --check
python -B orchestrator\reminders.py --preview-all
python -B orchestrator\timer.py status
python -B orchestrator\grading.py status
python -B orchestrator\tests\test_automation.py
node orchestrator\tests\test_host.cjs
```

预览全文已存为 `调研\自动化机制\提醒预览.md`：70 条正常提醒、全部 11 题两类开场/续做全文（22 份）、主动设计题立即继续样例、标准题不立即继续的说明，以及续做/非整档最后提醒样例。

- 可选的 `--fast` 未新增，按用户允许只写操作说明；受测 serviceTier、exec priority 命令与核对方法已写入 Agent使用说明.md，默认保持不启用快速模式，AIAgent tier 未实测。
- 不做自动批次推进、自动续时/重试、评分内容裁决、通用插件/工作流系统、额外服务、更多评分员或计分改变。
- 保留现有全局锁内的进程操作与跨盘归档粒度；没有借整治扩建后台归档服务。旧版本日志错误不删除；新单例竞争验证未产生此噪音。
- 账户/ACL/Job/DACL/绑核、任务时长与权重保持；题面罚则迁移/格式宽容/新开头等由指挥及另一代理完成，本次没有写 Grading。
- AIAgent 浏览器探针由指挥运行，见 5.3；未为验证重新跑正式 60/90 分钟作答或花费正式评分任务。

离线工作、原始备份、切换前备份和验证摘要位于：`C:\Users\Administrator\AppData\Local\Temp\claude\E--Project-AI-OneShot-Bench\bf85ba38-d78e-4f3b-9f96-8238940ad3fe\scratchpad\sol_arch`。主要文件为 baseline.json、deploy_manifest.json、doc_edits.json、published.json、verification.json，浏览器证据位于 browser-probe/。备份不包含密码文件，也没有复制登录凭据。部署清单逐文件记录 SHA-256；题面/README 补丁逐处记录旧行与新行，便于复查归属。
