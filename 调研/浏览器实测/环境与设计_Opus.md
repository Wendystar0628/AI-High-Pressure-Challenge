# 浏览器实测受抑制：环境与设计调查（Opus）

调查时间 2026-10-29。只读调查：读了 `.oneshot\` 全部脚本与模板、两个账户的 Claude Code / Codex 配置、5 道网页题题面、orchestrator 存档的会话日志和 Opus 交付目录里的测试脚本；做了路径、版本、`require.resolve` 之类的无害检查。没有运行 runas，没有启动浏览器或受测会话，没有改任何文件。日志里的模型行为细节由另一位调查者负责，本文只摘与环境有关的部分。

## 结论

1. **受测会话里没有任何浏览器工具。** 用户平时看到模型主动开浏览器，靠的是两个桌面应用注入的工具：Claude 桌面应用的内置浏览器面板、Claude in Chrome 和 computer-use，Codex 桌面应用的 browser、chrome 和 computer-use 插件。这些工具都不在 `~/.claude`、`~/.codex` 的 CLI 配置里。受测会话跑的是无头 CLI（`claude -p` 和 `codex app-server`），工具列表里没有一个浏览器工具，AIAgent 账户也没装任何浏览器自动化库。
2. **题面让模型“优先用 Agent 工具自带的内置浏览器”，但两种 CLI 都没有这个浏览器。** 后面只写了“使用本机的 Google Chrome”，没说无窗口能不能用、用户数据目录放哪儿、调试端口用哪个。再加上“绝对禁止访问其他任何文件路径”和“严禁……会话被中止”两条，自己搭一套浏览器测试成了要自担风险和成本的事。最省事的做法是用 Node 跑逻辑，或者拍一张静态截图就算看过了。
3. **环境本身跑得动无窗口 Chrome。** Opus 在 5 道题里都启动过 Chrome，截图、读控制台、开调试端口都成功了。但它自己搭的测法普遍偏弱：用虚拟时间拍首帧、软件渲染（SwiftShader 或 `--disable-gpu`）、用 `Runtime.evaluate` 直接调内部函数，不发真实的点击。物理题只拍过首帧静态图（画面显示仿真时间 0.16 s、1 fps），从没在真实时间里看过连锁跑完。
4. **隔离设置本身不挡无窗口 Chrome，但当前版本还没在真实网页会话里验证过。** Job Object 不禁止嵌套 job，也没有界面限制；进程默认 DACL 的收紧是在 Opus 网页题跑完之后才可能上线的（`session-job.py` 最后修改于 16:48，网页题在 11:31–13:01 之间运行）。之后跑过的只有 Codex 证明题，所以 isolate() 下的 Chrome 和 GPU 进程只做过模拟令牌测试。**有窗口模式不可取**：runas 进程和出题人共用同一个桌面，窗口会弹到出题人屏幕上；被挡住的窗口会被 Chrome 停帧。
5. **改法（详见第 9 节）：**
   - 给 5 道网页题的受测会话接入同一个本地浏览器 MCP 服务器：Claude 用 `--mcp-config`，Codex 用 `-c mcp_servers.*`。服务器固定为无窗口 Chrome、使用显卡、每个会话一个独立的临时用户数据目录。
   - 把题面“规定”第 2 条改成如实的说明，并明确允许随时在浏览器里检查。
   - 下一批网页题开始前，用真实启动路径跑一次探针，确认当前隔离下 Chrome 和 GPU 都正常。

## 1. 受测会话怎么启动、有什么工具

| 项目 | Claude Code | Codex |
|---|---|---|
| 版本（会话日志） | 2.1.301 | 0.162.1 |
| 启动方式 | 指挥 `runas /savecred /user:AIAgent` → `launch.ps1`（`-WindowStyle Hidden`）→ `node session-host.cjs` → `session-job.py`（Job Object，进程 DACL）→ Agent | 同左 |
| 命令行 | `claude.exe -p --settings .oneshot\claude-settings.json --permission-mode bypassPermissions --input-format stream-json --output-format stream-json --verbose --model … --effort …` | `codex.exe --dangerously-bypass-hook-trust app-server --listen stdio:// -c features.memories=false`；`thread/start` 带 `approvalPolicy: never`、`sandbox: danger-full-access` |
| 设置来源 | 没传 `--setting-sources`，所以按默认读 user、project、local 三处。AIAgent 的 `settings.json` 只有 `theme`，工作目录下没有 `.claude`；`--settings` 文件只装了提醒钩子。没传 `--mcp-config`、`--strict-mcp-config` 或 `--chrome` | AIAgent 没有 `config.toml`（`.codex` 下只有 `hooks.json` 等）。没配插件，也没配 MCP |
| 权限与沙箱 | bypassPermissions：Bash 和 PowerShell 不用审批，没有沙箱 | danger-full-access，approval never。宿主对服务端发来的一切请求都回“Unattended session”错误 |
| 浏览器工具 | 会话 init 的工具列表：Task、Bash、PowerShell、Read、Write、Edit、Glob、Grep、WebFetch、WebSearch、Monitor、Skill、ToolSearch 等，**没有浏览器工具**，`mcp_servers: []` | 没有浏览器插件，也没有 MCP。`plugins\cache` 里只有远端同步的连接器类插件（github、gmail、figma、notion、sites、unity 等），都与浏览器无关 |
| 看图片 | Read 能读 PNG | 有 `view_image` 工具（二进制里能找到） |
| 环境变量 | 继承 AIAgent 的 PATH（node、Python 3.12.5、g++），另设 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` 和 `ONESHOT_MAILBOX` | 同左 |

另外，Claude 自带的 `run` 技能对网页项目的建议是“dev server + `chromium-cli` script”，用不了时改用 Playwright。本机两样都没有，所以这条内置路径在受测环境里走不通。

## 2. 管理员账户与 AIAgent 逐项对比

| 项目 | 管理员（平时开发） | AIAgent（受测） |
|---|---|---|
| Claude 运行形态 | Claude 桌面应用会话（也有终端 CLI） | `claude -p` 无头 CLI |
| Claude `settings.json` | `bypassPermissions`、`model: opus`、UESTC_RPG 钩子、`enabledPlugins: frontend-design` | 只有 `theme: dark` |
| Claude MCP（`.claude.json`） | `mcpServers: {}`，61 个项目里也都没有 MCP | 没有 |
| Claude 浏览器工具 | 桌面应用注入 `mcp__Claude_Browser__*`：内置浏览器面板、`preview_start`、截图、控制台、执行 JS、调整窗口。另有 `mcp__claude-in-chrome__*` 和 `mcp__computer-use__*`。本调查所在的管理员桌面会话里就能看到它们，它们不来自 `~/.claude` 配置 | 没有 |
| Claude 技能与插件 | claude.ai 同步的技能：built-in-browser、chrome-browser、computer-use，配合上面的工具使用。插件 frontend-design 已启用，superpowers 已安装但未启用 | 只有内置技能（run、verify、debug 等），没有浏览器相关的同步技能 |
| Codex 运行形态 | Codex 桌面应用（也有 CLI）。`config.toml` 里有 `sandbox_mode = danger-full-access`、`[windows] sandbox = elevated` | `app-server`，没有 `config.toml` |
| Codex 插件 | 已启用 `browser@openai-bundled`（应用内浏览器）、`chrome@openai-bundled`、`computer-use`、`unified-computer-use`、`visualize` 等。browser 插件的描述明确要求前端有较大改动后，用 Browser 打开相关的本地页面 | 没有 |
| Codex MCP | `node_repl`（桌面应用的 `cua_node` 运行时，`BROWSER_USE_AVAILABLE_BACKENDS=chrome,iab,mcpapps`，依赖桌面应用的命名管道）、`blender-ai-mcp` | 没有 |
| Codex 运行时目录 | `C:\Users\Administrator\AppData\Local\OpenAI\Codex\runtimes\cua_node` | 没有 `AppData\Local\OpenAI` |
| Node 全局包 | `@mermaid-js/mermaid-cli`（自带 puppeteer）、`@openai`、`@anthropic-ai` 等 | 只有 `@openai/codex` |
| 浏览器下载缓存 | `AppData\Local\ms-playwright`（chromium-1217/1223、headless_shell）、`.cache\puppeteer`（chrome、chrome-headless-shell） | 没有（管理员目录 AIAgent 也读不到） |
| Python 浏览器库 | 有 `websockets`，没有 playwright 和 selenium | 只有 numpy、scipy、sympy、mpmath、pandas |

要点：平时开发时的浏览器能力，以及“改完前端就去浏览器看”的引导文字，全部来自两个桌面应用。桌面应用的工具依赖应用本身的进程和管道，所以把管理员的 `settings.json` 或 `config.toml` 复制给 AIAgent 也拿不到这些能力。Claude in Chrome 和 Codex 的 chrome 插件还要求有窗口的 Chrome 加扩展，并绑定账户登录，不适合无人值守、需要隔离的受测会话。

## 3. 本机浏览器与库（管理员下检查）

- Chrome 156.0.8078.48：`C:\Program Files\Google\Chrome\Application\chrome.exe`
- Edge 156.0.4314.50：`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`（另有 EdgeWebView）。没有 Firefox，没有 chromedriver 或 msedgedriver。
- Node 24.11.0（`C:\Program Files\nodejs`，所有账户共用），**全局自带 `WebSocket` 和 `fetch`**：`node -e` 输出 `WebSocket function`。所以不装任何包也能写 CDP 客户端。
- `node -e "require.resolve(...)"`：playwright、playwright-core、puppeteer、puppeteer-core、chrome-remote-interface、ws 都是 NOT FOUND。
- 显卡：RTX 4080 是唯一接了显示器的适配器（3840×2160、160 Hz）。ToDesk 和 GameViewer 两块虚拟适配器没有输出，所以 ANGLE 的 D3D11 默认适配器应该是 4080。
- AIAgent 的默认 Chrome 用户数据目录 `C:\Users\AIAgent\AppData\Local\Google\Chrome\User Data` 已经存在，是 2026-10-27 18:22 某次启动留下的。
- 账户锁定阈值已是 `Never`（`net accounts`）。AIAgent 不在 Administrators 组。

## 4. 隔离与账户环境对浏览器的影响（纸面分析加旁证）

**Job Object。** 只设了 `KILL_ON_JOB_CLOSE`，网页题不绑核（`tasks.py` 里只有极值构造题有掩码）。没有界面限制，也不允许脱离 job。Windows 8 以后支持嵌套 job，Chrome 沙箱给子进程建自己的 job 不受影响。模型启动的 Chrome 留在会话的 job 里，到时会被宿主的 cleanup 一并结束。这一点对模型是好消息，可以告诉它：不用担心收不干净。

**默认 DACL 收紧到登录 SID。** 新进程的默认 DACL 是：本登录 SID 完全控制，SYSTEM 和 Administrators 完全控制，AIAgent 用户只读，OWNER RIGHTS 只有 READ_CONTROL。

- Chrome 的渲染进程和 GPU 进程用受限令牌运行。受限令牌按这个 DACL 做访问检查时，可能出现以前那种 0xC0000142（DLL 初始化失败）。
- 记忆里记录过用模拟令牌测试的结果：bash、PowerShell、node、Chrome、Python 都正常。
- **但真实网页会话里还没有在当前 isolate() 下跑过 Chrome。** Opus 的网页题在 11:31–13:01 运行，session-job.py 最后修改于 16:48，从日志看不出那时 isolate() 是否已经上线。之后的 GPT 会话（18:48 以后，没有“process isolation failed”）只做了形式化证明题。
- 结论：大概率能跑，但下一批网页题开始前必须实测一次，见 9.3。

**runas 登录会话与桌面。** runas 通过二次登录服务新建一个交互式登录，进程挂在当前控制台的 `WinSta0\Default` 上，也就是出题人正在用的桌面。

- **有窗口的 Chrome 会直接弹在出题人屏幕上，抢焦点；** 4 道网页题并行时，窗口会互相遮挡。
- Chrome 在 Windows 上会检测窗口是否被遮挡。被完全遮挡或锁屏时，页面按隐藏处理，`requestAnimationFrame` 停下或被大幅降频，模型看到的就是卡住或掉帧的假象。
- `windowsHide` 和 `-WindowStyle Hidden` 只管控制台窗口，管不住 Chrome 自己开的窗口。
- 所以受测会话里应当只用无窗口模式。这与评分员“一律无窗口 Chrome”的规定一致。

**无窗口模式下的 GPU。** `--headless=new` 跑的是完整的 Chrome。旁证：

- NVIDIA 题用 `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist` 正常截图，能编译着色器。
- 塔防题的驱动固定用 `--use-angle=swiftshader`，测出来 8 fps 左右（frameInterval ≈ 120 ms），这个帧率没有意义。
- AE 用了 `--disable-gpu`；渔港读到的渲染器名是被屏蔽的 `WebKit WebGL`，没有确认到底是不是 GPU。

所以，GPU 用不用得上取决于启动参数，模型自己选参数时经常选错。

**并行会话之间的冲突。** 这三项都会让跨题干扰变得可能，而 DACL 隔离管不到 TCP 端口：

- 远程调试端口：NVIDIA 题固定用 9333，题面没分配调试端口。两题撞上同一个端口时，会连到别的题的浏览器上。
- 同一个用户数据目录：同为 AIAgent 用户，两题都用默认目录时，Chrome 的单实例机制会把第二次启动交给第一个实例。DACL 隔离以后，这种交接也可能失败。
- 每次新建临时用户数据目录：Chrome 会尝试一次空密码登录 Windows 账户（记忆里有记录），以前因此锁过账户。现在阈值是 Never，不会再锁，但每次仍会留下一条失败登录记录。

**提升权限。** `--do-not-de-elevate` 只在提升权限的进程里需要。AIAgent 是普通用户，令牌没有提升，受测会话不涉及这个问题。旁支发现：`grading.py` 从指挥进程派生评分员，**指挥是提升权限运行时，评分员也是提升的**。这时评分员的无窗口 Chrome 不加 `--do-not-de-elevate` 就什么都不输出（`assets\readme\src\render.py` 的注释写明了这一点），评分提示词里没有提到。

**输出噪声。** 每次启动 Chrome，stderr 都会出现两类 ERROR，都无害：

- `HKLM\SOFTWARE\WOW6432Node\Google\Chrome\Extensions\ncennffkjdiamlpmcbajkmaiiiddgioo` 注册的迅雷扩展，路径指向 `C:\Users\Administrator\AppData\Local\ChromeExtensionCache\xl_ext_chrome.crx`，AIAgent 读不到，报错。
- Chrome 更新程序的命名管道报“拒绝访问 (0x5)”。

模型要自己学会过滤这两类信息。前者还会让模型以为碰到了禁止访问的路径。

## 5. 旁证：Opus 自己搭的浏览器测法（只摘环境相关部分）

| 题 | 做法 | 环境层面的问题 |
|---|---|---|
| AE 编辑器 | 写了 `shoot.ps1`：`--headless=new --disable-gpu --virtual-time-budget --screenshot`，用 `--enable-logging=stderr` 抓控制台；另用 `#uitest`、`?bench=E` 触发页内测试代码 | 关了 GPU；用虚拟时间；测试代码写进了作品本身 |
| 塔防 | 26 行零依赖 CDP 驱动 `tools/cdp.js`（Node 24 自带 WebSocket），之后写了 t1–t27 一系列脚本 | 第一次因启动竞争报错；SwiftShader 软件渲染；每次新建临时用户数据目录（导致锁账户的就是它）；早期跑过 `taskkill //F //IM chrome.exe`；测试是直接调 `startLevel()`、`step()`，不是真实输入 |
| NVIDIA | 先用 `--screenshot`，后写 `/tmp/cdp/cdp.mjs`，固定 9333 端口 | 第一次连接被拒（启动竞争）；固定端口；自己承认“脚本派发的不是真实点击” |
| 渔港 | 在工作目录的 `_dev` 里 `npm install three puppeteer-core`（4 秒装好，联网可用） | `node_modules` 放在工作目录里（现在改成 git 交付后会被 `git add -A` 带进仓库）；npm 缓存写到工作目录外；没确认渲染器 |
| 物理 | `--user-data-dir=tools\chr --screenshot --virtual-time-budget=3000`，共 5 张静态图 | 只拍了首帧（仿真时间 0.16 s）；20 MB 的用户数据目录留在工作目录里；没有任何交互或实时观察 |

可见 Opus 有能力在几分钟内搭起 CDP。问题不在会不会搭，而在于自己搭出来的测试质量参差，而且每道题都要重造一遍。较弱的模型在这一步更吃亏，评测于是混进了“谁更会搭测试脚手架”这个与题目无关的变量。

## 6. 题面与提示词里的抑制因素

5 份题面“规定”中与浏览器有关的句子都相同（物理题第 2、4、9 条，其余 4 题对应的位置）：

1. **“优先使用你所在 Agent 工具自带的内置浏览器；它不可用时，使用本机的 Google Chrome；仍不可用时，使用本机的 Microsoft Edge。”**
   - 这句话预设了一个不存在的工具，模型要先花工夫确认它确实不存在。
   - 对 CLI 模型来说，“使用本机的 Chrome”只能理解为自己去启动 chrome.exe，但题面没说可以用无窗口模式，也没说怎么用。
   - 这句话是在第一个提交（827ff18，10-26）里写下的，前提是在桌面应用环境里作答。
2. **“所有文件只能在这个文件夹内读取、创建和修改；绝对禁止访问其他任何文件路径……只有运行编译器、解释器、库、浏览器等必需工具时必须访问的安装路径和临时目录除外。”**
   - Chrome 的默认用户数据目录在 `%LOCALAPPDATA%`，不算安装路径，也不算临时目录。npm 缓存、Playwright 的浏览器下载目录同样不在豁免范围内。
   - 谨慎的模型只剩两种做法：把用户数据目录放进工作目录（会污染 git），或者放在临时目录（每次新建）。也可能干脆不装库、不开持续运行的浏览器。
3. **“严禁使用……按进程名批量结束进程的命令……这些命令会锁定评测账户或误杀评测系统的进程，导致你的会话被中止。”**
   - Chrome 一次会起很多个进程，模型只能按 PID 收拾。
   - “会话被中止”的后果写得很重，题面又没说时间到时 job 会自动清理（开场提示词里说了）。这会让模型倾向于不开长时间运行的浏览器，只用一次性的 `--screenshot`。
4. **端口**：题面只给了网页服务器端口，没给浏览器调试端口。
5. **开场提示词和定时提醒都没提浏览器。** 每 10 分钟的提醒要求“重读‘规定’一节，确认你的做法没有违反任何一条规定”，等于每 10 分钟把第 2、3 两条的分量再加重一次。提醒只说“对照要求逐条检查”，没说到哪里检查，模型自然会选最快的 Node 检查。
6. **联网**：网页题题面没有限制联网（`frontend-prompt-style`、README 表格），渔港题也确实装过 npm 包。所以联网本身不是阻碍，阻碍在于第 2 条把装进来的东西放在哪里说得含糊。
7. README 的“工具与联网规定”表格对网页题的描述也是“优先用智能体工具自带的内置浏览器”，与实际环境不符。

## 7. 历史：项目里有没有过浏览器工具

- 题面里“内置浏览器优先”这一条从首个提交起就有，后来只改过其他条款。记忆 `frontend-prompt-style` 里也是按“Agent 自带浏览器 → Chrome → Edge”的顺序写的，说明出题时设想的是桌面应用环境。
- `setup-aiagent.ps1` 只装了 Claude Code 2.1.301、Codex 0.162.1 和 Codex 提醒钩子；`setup-toolchain.ps1` 只装了 Python 3.12.5（加 5 个科学计算库）和 g++。受测账户**从来没装过**浏览器工具，也没有过 MCP 配置。
- git 历史里没有任何关于 playwright、puppeteer、mcpServers、mcp_servers、chrome-devtools 的改动记录。orchestrator 现有脚本和 `.oneshot` 模板里也没有浏览器工具。`.oneshot` 不在 git 里，只能看现存文件，现存文件里看不出删过东西的痕迹。所以**不是后来被去掉的，而是从来没有过**。
- 评分侧有完整的浏览器规定（“评分员一律无窗口 Chrome，靠截图看画面，先确认 WebGL 用的是 GPU”），受测侧没有对应的说明，也没有对应的工具。

## 8. 两种环境下浏览器测试的成本对比

| | 桌面应用（平时开发） | 受测无头 CLI |
|---|---|---|
| 打开页面 | 一次 `preview_start` 或 `navigate` 调用 | 自己找 chrome.exe，自己选参数，处理启动竞争和中文路径的 URL 编码 |
| 交互 | `computer`/`find`/`form_input` 按坐标或元素操作 | 自己写 CDP 的 `Input.dispatchMouseEvent`，或者偷懒用 `Runtime.evaluate` 直接调内部函数 |
| 看画面 | 截图直接回到上下文里 | 先写成 PNG，再用 Read 或 view_image 读回来 |
| 控制台 | `read_console_messages` | 订阅 CDP 事件，或者解析 `--enable-logging` 的 stderr，还要过滤迅雷扩展和 updater 的噪声 |
| 是否用 GPU | 宿主自动处理 | 要自己知道 `--use-angle=d3d11`，并避开 SwiftShader 和 `--disable-gpu` |
| 进程收尾 | 宿主管理 | 按 PID 结束，不能按进程名 |
| 引导 | 工具说明里就写着改完前端去浏览器看 | 什么都没有；题面还指向一个不存在的工具 |

Node 24 自带 WebSocket，最小的 CDP 驱动大约 25–60 行，Opus 做得到。但搭这套东西每题要花几分钟，每个测试场景还要另写脚本，而且容易选到软件渲染、虚拟时间这类偏离真实的设置。在 90 分钟的限时里，Node 单测更快、更稳，模型会理性地优先用它。

## 9. 改法建议

### 9.1 核心：给网页题接入同一个本地浏览器 MCP 服务器

- **选型**：`chrome-devtools-mcp`（Google）或 `@playwright/mcp`（微软），都是 Node 写的，可以指定本机 Chrome 的可执行文件，也都支持无窗口和独立用户数据目录。
  - 5 道题以画布和 WebGL 为主，靠坐标点击、截图、执行脚本、控制台和性能追踪，**chrome-devtools-mcp 更合适**。
  - Playwright MCP 以无障碍快照为主，坐标操作要另开能力。
  - 参数名以所装版本的 `--help` 为准。版本要锁定。
- **安装位置**：出题方用管理员身份装到 `H:\AI_OneShot_Model\.oneshot\tools\`。这个目录对 AIAgent 只读可执行，模型改不了；它也不在工作目录里，不会进 git。不要让它下载浏览器，直接指向本机 Chrome。
- **固定参数**（写进配置，模型不用操心）：
  - 无窗口；
  - 本机 Chrome 路径；
  - 每个会话一个用户数据目录，放在 `%TEMP%`，同一会话内反复使用，以减少空密码登录记录；
  - 用显卡（ANGLE D3D11），不用 SwiftShader；
  - 固定视口大小（只是工具设置，不写进题面，不违反“题面不写分辨率”的规定）；
  - 截图默认直接回到上下文。
- **接入 Claude**：`session-host.cjs` 给 claude 加 `--mcp-config <json 文件>`，可再加 `--strict-mcp-config`。只对网页题加，可以在 `tasks.py` 或 launch 参数里加一个开关，由 launch 传给宿主。在 bypassPermissions 下，MCP 工具不用审批。
- **接入 Codex**：app-server 的启动参数已经在用 `-c features.memories=false`，照这个方式加 `-c mcp_servers.browser.command=...`、`-c mcp_servers.browser.args=[...]` 就行，同样只对网页题加。**必须先验证一点**：在 `approvalPolicy: never` 下，Codex 调 MCP 工具会不会向客户端发审批或 elicitation 请求。宿主对所有请求一律回错误，如果会发，工具调用就会失败。
- **取舍**：
  - 好处：
    - 最接近平时开发的体验；
    - 两家用同一个工具，公平；
    - 浏览器进程在会话的 job 里，到时自动清理；
    - MCP 用管道或随机端口，并行的几题不会撞端口；
    - 用显卡和独立数据目录是配置定死的，模型选不错。
  - 代价：
    - 多一个依赖，也多一个启动失败点：Claude 起不来时只是少了这个工具；Codex 起不来时 `thread/start` 会不会报错要先试；
    - 工具说明和截图会占上下文；
    - 要在当前 isolate() 下实测；
    - 要防止工具在非网页题里出现：IMO 题不准用任何程序，虽然有了浏览器也没用，但最好不给。
- **联网**：MCP 和 Chrome 都只在本机运行，网页题本来也没限制联网，不违反规定。

### 9.2 题面和提示词（必须改）

- **“规定”第 2 条**：去掉“内置浏览器优先”的顺序，改成如实的说明，并明确允许。下面是示例措辞（按用户的写法：只写事实和规定，不写测试内容）：
  > 2. 开发期间可以随时在浏览器里打开、操作和截图检查作品。评测环境为你接入了浏览器工具，它使用无窗口（headless）的 Google Chrome 和本机显卡。也可以自己启动本机的 Google Chrome 或 Microsoft Edge，但只能用无窗口模式，浏览器的用户数据目录放在临时目录中；需要远程调试端口时，使用 N 端口。

  如果暂时不接 MCP，就把第二句改成“本环境没有 Agent 自带的浏览器面板”。调试端口按服务器端口的办法分配，例如 AE 19101、塔防 19102、NVIDIA 19103、渔港 19104；物理题单独运行，可以不分配。
- **第 4 条的路径豁免**：在“安装路径和临时目录除外”后面加上“浏览器的用户数据目录、截图等放在临时目录”，消除“默认用户数据目录算不算越界”的疑问。
- **开场提示词**（只对主动设计题）：加一句平实的说明，例如“作品在浏览器中运行，可以随时用浏览器工具打开、操作和截图，按实际运行的效果检查和改进”。这符合《用户定稿要求》里“检查是推进和提升的手段”和“不施压”两条。不建议写成“必须在浏览器里测”：工具到位以后，主动去测本身也是能力的一部分。
- 第 6 节第 7 点提到的 README 表格那一行，按新措辞同步修改。
- 定时提醒可以在后 30 分钟的检查提升阶段带一句“在浏览器里看实际效果”，由用户决定，不是必须。

### 9.3 隔离与环境（不放松，只补漏）

- 保留 Job Object、进程 DACL 和 runas 分登录，不加 `JOB_OBJECT_LIMIT_BREAKAWAY_OK`，不放宽默认 DACL。
- **下一批网页题开始前跑一次探针**：由指挥在它自己的会话里，用正常的 launch 路径（当前的 session-job.py）以 AIAgent 身份跑一个短任务。可以仿照现有的 `mailbox\probe\probe.ps1`，或者用一道 1 分钟的假题。探针要确认四件事：
  1. 无窗口 Chrome 能打开一个测试页并截图；
  2. `WEBGL_debug_renderer_info` 读出的 UNMASKED_RENDERER 是 RTX 4080，不是 SwiftShader；
  3. 两个会话同时启动 Chrome 互不干扰；
  4. 接了 MCP 的话，Claude 和 Codex 都能调用到它。
- 题面写明只用无窗口模式，原因见第 4 节：窗口会弹到出题人桌面，被遮挡的窗口会停帧。
- 可选：删掉 HKLM 下迅雷扩展的注册项，去掉每次启动 Chrome 都出现的那条 ERROR。这是系统设置，由用户决定。
- 旁支：评分员是提升权限运行时，评分提示词或评分员的启动方式要处理 `--do-not-de-elevate`，不然无窗口 Chrome 不输出任何东西。

### 9.4 备选：零依赖的命令行脚本

如果 MCP 在 app-server 下或在隔离下不稳定，可以改为在 `.oneshot\tools\` 放一个 Node 24 零依赖的 CDP 脚本。它负责：打开页面，按步骤点击、按键、拖动、等待，截图，输出控制台错误和 GPU 渲染器名。Claude 用 Read 看截图，Codex 用 view_image 看。

- 好处：不改 Agent 的启动参数，失败点最少。
- 代价：不如工具调用自然，题面要写明脚本路径和用法，并把这条路径加进访问豁免。

记忆 `minimal-design` 要求只做关键机制，所以 9.1 和 9.4 二选一，不要两个都做。

### 9.5 不建议的做法

- 允许或默认用有窗口的浏览器：会占出题人桌面，并行几题的窗口互相遮挡还会停帧。
- 给受测账户装 Claude in Chrome 扩展或 Codex 桌面应用的插件：要有窗口的浏览器，要绑定登录，依赖桌面应用的管道，没法无人值守。
- 让模型自己 `npm install` 测试库：库会装进工作目录、进 git，缓存写到工作目录外，而且每家模型做法不一，不公平。
- 把 MCP 或浏览器库预装到各题的工作目录里：会污染 git，也会混进交付物。

## 10. 不确定之处

- Opus 网页题运行时 isolate() 是否已经上线，从日志无法确定，现有记录也不能证明 Chrome 在当前版本下没问题，只能靠 9.3 的探针。
- `chrome-devtools-mcp` 和 `@playwright/mcp` 的具体参数名、会不会收集使用统计，以安装时的版本为准。
- Codex 0.162.1 的 app-server 在 `approvalPolicy: never` 下调 MCP 工具会不会发审批请求，没有实测。
- 无窗口 Chrome 不加 GPU 参数时，在这台机器上默认用 D3D11 还是 SwiftShader，没有在 AIAgent 身份下实测。旁证是：Opus 加了 D3D11 参数的那次能用显卡，用 SwiftShader 的那次帧率明显失真。
