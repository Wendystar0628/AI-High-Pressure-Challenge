# 浏览器实测调研：Opus 5.5 日志证据

调查范围：`orchestrator\logs\Claude\Opus5.5\` 下 5 道网页设计题的全部会话段（含中断后续跑的段）、6 道非网页题的会话、`H:\AI_OneShot_Model\Claude\Opus5.5\` 下的作答目录，以及管理员账户下 Claude Code（`C:\Users\Administrator\.claude\projects\`）和 Codex（`C:\Users\Administrator\.codex\sessions\`）的会话记录。全程只读。

说明：受测日志里 Opus 的思考内容是空的（只有签名），只有零星几条思考摘要。所以它“为什么这么做”只能从它说出来的话和实际操作推断。

## 结论

1. **“几乎不在浏览器里打开”这个说法要修正。** Opus 在 5 道题里都用 Chrome 打开过作品，一共启动 Chrome 一百多次、看了两百多张截图。但它用的**全是无头模式（headless）**：一次也没开过可见窗口，也从没让作品以真实速度、在真实 GPU 上完整跑一遍。它看到的是虚拟时间推进后截下的静态画面，以及控制台日志。
2. **物理题是最弱的一题。** Opus 只截了 5 张图，页面最多推进了 14 秒虚拟时间。30.57 秒的完整连锁只在 Node 里跑过。它自己也说了没看完整播放，但当时还剩 27 分钟，它选择了收手。
3. **最主要的原因是受测会话里没有任何浏览器工具。** 管理员账户下的 Claude Code 是桌面版，自带内置浏览器（`mcp__Claude_Browser__*`），Opus 平时测网页主要靠它。受测会话是用 `claude -p` 启动的，`mcp_servers` 为空，没有这类工具，只能用 Bash 去启动 Chrome。Bash 打开的有头窗口它看不见，所以只能退回到无头模式加截图。

## 一、受测环境里 Opus 能用什么

- 启动方式：`timer.py` 用 `runas` 以 AIAgent 身份执行 `powershell -WindowStyle Hidden -File launch.ps1`。`session-host.cjs` 再以 `windowsHide: true` 启动 `claude -p --input-format stream-json --output-format stream-json --permission-mode bypassPermissions`。
- 每段会话的 init 记录都写着 `"mcp_servers":[]`。工具只有 Task、Bash、PowerShell、Read、Write、Edit、Glob、Grep、WebFetch 等，没有任何浏览器、截屏或桌面控制工具。
- AIAgent 的 `.claude.json` 里没有 `mcpServers`，`.claude\plugins` 里只有一个缓存文件。
- 题面“规定”第 2 条写的是：“优先使用你所在 Agent 工具自带的内置浏览器；它不可用时，使用本机的 Google Chrome”。在这个环境里内置浏览器不存在，Opus 也从没提过“内置浏览器”，直接用了 Chrome。这一点没有违规。
- Opus 能看到画面的唯一途径，是让 Chrome 把截图写成 PNG，再用 Read 读进来。

## 二、逐题统计

各题的作答被切成了几段：第一段从 22:34Z 开始；AE 和塔防的第一段在 23:27 一起停止，后来续跑了 37 分钟和 30 分钟两段；NVIDIA 和渔港后来各续跑了 11 分钟。物理题是 03:31Z 开始的一整段 90 分钟。

| 题目 | 启动 Chrome 的调用 | 方式 | GPU | 读截图次数 | 首次用浏览器（距开始） |
|---|---|---|---|---|---|
| AE 动效编辑器 | 24 + 12 + 9（三段） | 无头，`--screenshot`、`--virtual-time-budget`、`--remote-debugging-port=0` 保持进程；页面里自带 `?bench=`、`?uitest` 测试脚本，结果通过控制台写到 stderr | 部分调用加了 `--disable-gpu` | 14 + 10 + 11 | 27 分钟 |
| 动态路由塔防 | 7 + 0 + 1，另有 `node tools/cdp.js` 几十次 | 自己写了 CDP 客户端（`tools/cdp.js`）：无头 Chrome，用 Runtime.evaluate 让机器人自动打完整局，再截图 | `--use-angle=swiftshader`（软件渲染） | 21 + 10 + 8 | 27 分钟 |
| NVIDIA B200 | 43 + 3 | 无头，`--screenshot`，虚拟时间 8–30 秒；用 `#y=…&skip&lowres&test03&dbg` 跳到指定滚动位置截图 | 先试 `--use-angle=d3d11`，报错后改用 SwiftShader | 125 + 1 | 24 分钟 |
| 太阳雨渔港 | 2 次 shell 调用，另有 `node shot.js` 多次 | 开局就 `npm install three puppeteer-core`；用 puppeteer 启动无头 Chrome，设置相机位置后截图 | 传了 `--use-angle=d3d11 --enable-gpu`，实际是否用上 GPU 无法确认（渲染器名被屏蔽成 `WebKit WebGL`） | 53 + 3 | 29 分钟 |
| 多物理连锁机关 | 6（成功 5） | 无头，`--screenshot`，虚拟时间 3、5、14、6、6 秒（`#auto`、`#auto-node9`、`#auto-node10`） | 第一次加了 `--disable-gpu-sandbox`，之后用默认设置 | 5 | 42 分钟 |

所有对 chrome.exe 的调用都带 `--headless`，没有一次打开可见窗口，也没有用过 Edge。

### 失败与应对

- **AE**：截图 URL 带 `#` 时页面加载失败。它说：“截图脚本的 URL 带 # 时加载失败，改用查询参数。”在虚拟时间下测性能，读数是 0，它改成按真实时间跑：“Benchmarking under virtual time reports zeros, so I'll rerun it on real time”。导出场景 C 时，无头模式下编码太慢，测不完，它就放弃了：
  > “headless software encoding is too slow to finish inside the polling window, so I'm leaving it.”
- **塔防**：`--remote-debugging-port=9333` 报 `Cannot start http server for devtools`，它改用端口 0，再从 `DevToolsActivePort` 文件里读出实际端口。中途三次执行了 `taskkill //F //IM chrome.exe`；23:27:34 又执行了 `taskkill //F //IM python.exe`。AE 和塔防的第一段都在 23:27:3x 停止，正好是这一刻。之后的提示词里加了“只按 PID 结束进程”。软件渲染下测得的帧率只有 10–14 fps（例如 `{"fps":13.8,…}`），性能无从判断。
- **NVIDIA**：用 d3d11 截图时连续报 `GPU state invalid after WaitForGetOffsetInRange`。16 秒后它改用 `--use-angle=swiftshader --enable-unsafe-swiftshader`，同时把窗口缩到 960×540，渲染比例降到 0.3（`lowres`）。截出来的画面和页面实际状态对不上时，它用调试输出核对：
  > “结尾状态经调试确认正确（截图工具在重场景下有滞后）。”
- **物理**：第一次截图用了 MSYS 路径 `$(pwd)`，报 `net::ERR_FILE_NOT_FOUND`；改用 `cygpath -m` 后正常。连锁本身全部在 Node 里调（`tools/run.js` 等，跑了 41 次），渲染器用假 canvas 测（`tools/rtest.js`）。

### Opus 说过的相关原话

- 物理题，在第 63 分钟第一次停下时说：
  > “I did not watch a full run at real speed in a browser, so the rendering and camera over the whole run have only been checked from still screenshots.”
  > “The headless run finishes at 30.57 s, and the browser runs the same code, so it should match.”
- 物理题，第 70 分钟被提醒叫醒后，仍然没有开浏览器：
  > “Using the remaining time for a safe check: exercising the renderer at the late chain state with a mock canvas to catch runtime errors.”
- AE 题的思考摘要。它知道无头模式下是 CPU 光栅化：
  > “Rendering cost seems driven mostly by CPU rasterization in headless mode … should perform better in a real GPU-backed browser.”
  > “The total varies because headless CPU drawing is noisy.”
- 渔港 11 分钟续跑段：
  > “剩下约 7 分钟，任何改动都要重新构建和测试，我判断风险大于收益。”

**它没有说过的话**：在全部可见文本里搜了“无法显示窗口”“没有浏览器工具”“规定不允许”“内置浏览器”“怕占用时间”以及对应的英文，都没有找到。它从没解释为什么不开可见窗口，也从没把“没有 GPU”当作不测的理由。它只是说无头模式下的读数不准。

## 三、6 道非网页题（简述）

这几题都用不上浏览器。Opus 都实际编译、运行或检查了作品：GPU 题用 nvcc 编译了 6 次，还运行了几十次可执行文件；Lean 题也实际跑了编译。所以“只在环境外面验证”这个问题在这里不存在。

但有一个相同的倾向：**它觉得做完了就提前停手**，要等时间提醒把它叫醒。首次停手的时间如下：形式化证明第 18 分钟（共 60），IMO 第 13 分钟，电路仿真第 26 分钟（共 60），GPU 沙粒第 40 分钟（共 60），物理题第 63 分钟（共 90）。物理题没有完整实测，主要原因是它认为不需要，不是因为时间不够。

## 四、对照：管理员账户下的会话

### Claude Code（`C:\Users\Administrator\.claude\projects\`，2026-10-06 到 10-29）

- 有浏览器测试操作的会话共 499 个（含子代理），其中 457 个来自桌面版（`entrypoint: claude-desktop`），42 个来自 CLI。
- 调用次数：
  - **内置浏览器 `mcp__Claude_Browser__*` 共约 7,800 次**：javascript_tool 3,332、computer（截图、滚动、点击）1,698、navigate 1,008、browser_batch 413、resize_window 373、read_console_messages 272、preview_start 163、get_page_text 124 等。
  - Bash 启动 Chrome 或 Edge 604 次，playwright 427 次，puppeteer 142 次。
  - `claude-in-chrome` 实际调用为 0。
- 按模型统计：用过内置浏览器的会话里，Opus 5.5 有 175 个，Sonnet 5.5 有 35 个；另有 Opus 5.5 的 190 个会话只用 shell，多半是子代理。
- 与本评测题目相近的例子：
  - `E:\Test`，10-11，Opus 5.5 评审 B200 页面：`preview_start "b200-review"`，然后 `browser_batch`（navigate → 等 3 秒 → JS 滚动 → 截图）。
  - `E:\Test`，10-13，Opus 5.5：`preview_start "corner"`，再用 `javascript_tool` 跑 `performance.now()` 循环，在真实浏览器里测帧耗时。
  - `E:\Test`，10-14，Opus 5.5 做 3D 咖啡馆：`preview_start "cafe"` → `read_console_messages` → 用 JS 读渲染器尺寸、隐藏或显示物体后截图。
  - `Front-end-design-presentation\render\太阳雨中的小渔港\Fable5.1`，10-23（早期版本的渔港题）：`preview_start "harbor-preview"` → 等待 → 读控制台 → 截图 → 读页面文字 → 看网络请求。
  - 同一题的 sonnet5.5 目录，10-17：桌面版里的 Sonnet 也用 puppeteer-core 加无头 Chrome 测帧率和截图。可见只要走 shell 这条路，结果同样是无头模式。

### Codex（`C:\Users\Administrator\.codex\sessions\`）

- 有浏览器测试操作的会话共 61 个，其中 56 个来自 Codex Desktop。UESTC_RPG 里的 `--headless` 是 Godot 的参数，不算浏览器测试。
- 主要做法是：先读 `~\.codex\skills\playwright\SKILL.md`，再通过 exec_command 运行 `npx --package @playwright/cli playwright-cli open …`（含 playwright 的工具调用 842 次），然后用 `tools.view_image` 看截图（176 次）。browser-use（`mcp__node_repl__js`）只用了 8 次。
- 例子：
  - `E:\Test`，10-26，gpt-6.1-terra 做 vector-studio：`playwright-cli open 'file:///E:/Test/vector-studio/index.html' --browser=chrome`。
  - 同期做 sunshower-harbor：`playwright-cli -s=harbor open http://127.0.0.1:8765/`。
  - 渔港 6Astra，10-23：开局就读 frontend-design 和 playwright 两个 skill，然后 `playwright-cli -s=shionagi open …`。
- 管理员的 Codex 配置里有 `browser@openai-bundled`、`chrome@openai-bundled` 插件，node_repl MCP 的 `BROWSER_USE_AVAILABLE_BACKENDS="chrome,iab,mcpapps"`，还有 playwright skill。
- AIAgent 的 `.codex` 下没有 config.toml，skills 里只有 `.system`，没有 playwright skill，也没有浏览器插件。

### 两边的差别

| 能力 | 管理员 Claude Code（桌面版） | 受测 Opus（`claude -p`，AIAgent） |
|---|---|---|
| 内置浏览器（启动预览、截图、执行 JS、读控制台、点击滚动，真实 GPU、实时运行） | 有，是主要手段 | **没有** |
| 浏览器工具说明里的引导（preview_start 的说明写着“ALWAYS use this instead of Bash for running servers”） | 有 | 没有 |
| claude-in-chrome、computer-use | 已配置 | 没有 |
| Bash 启动无头 Chrome、puppeteer、playwright | 有，是辅助手段 | 有，**是唯一手段** |

| 能力 | 管理员 Codex Desktop | 受测 Codex（AIAgent） |
|---|---|---|
| playwright skill、frontend-design skill | 有 | 没有 |
| browser 和 chrome 插件（node_repl browser-use） | 有 | 没有 |

## 五、最可能的原因（按可能性排序）

1. **受测会话没有内置浏览器工具（证据最强）。** Opus 平时测网页主要靠桌面版的 Claude_Browser，在受测的 `claude -p` 会话里这个工具不存在。退到 Bash 以后，它能拿到画面的唯一办法是无头 Chrome 加截图：有头窗口它看不见，也没有截屏工具可用。题面要求“优先内置浏览器”，但这个环境里没有内置浏览器。
2. **无头 Chrome 在这个账户下表现差，Opus 也不信任它的实时结果。** NVIDIA 题用 d3d11 时报 GPU 状态错误，改用 SwiftShader；塔防软件渲染只有 10–14 fps；AE 题它自己说是 CPU 光栅化、读数有噪声。实时播放又慢又不能代表真实效果，于是它只截虚拟时间下的静态帧，动态行为和连锁结果交给 Node 去验证。AIAgent 下的无头 Chrome 能否稳定使用 GPU，本次没有核实。
3. **它默认 Node 结果能代表浏览器，并且自认做完就停手。** 物理题它原话说“the browser runs the same code, so it should match”，还剩 27 分钟就收手了，被叫醒后也只做了假 canvas 测试。非网页题同样早早停手。这是模型自身的行为倾向，环境只是放大了它。
4. **无人值守带来的进程约束增加了麻烦（较弱）。** 塔防第一段按进程名结束 chrome.exe 和 python.exe 之后，提示词加了“只按 PID 结束”。此后 Opus 改用会自动退出的 `--screenshot` 模式，或者按 PID 结束自己启动的进程。但没有证据表明它因此少开了浏览器。
5. **目录限制影响很小。** 它把 Chrome 的用户数据目录放在工作目录（`tools\chr`）或临时目录里，照常使用。

“规定不允许”和“怕占用时间”这两种说法没有证据支持。题面反而要求用浏览器测试，而 Opus 停手时手里还有不少时间。

## 附：其他模型的旧作答目录

协调方确认 `H:\AI_OneShot_Model\` 下其他厂商的目录都是空的，所以没有对比。
