# 成绩网站的登记、导出和发布

网站数据由 `export_data.py` 从评分记录和题面原件导出到 `website/site/data/`（只读，不写 `orchestrator/`、`Grading/`、题面和 H 盘）；导出、构建、推送只用一条命令 `publish.py`，见下文「发布」。导出需要 pypinyin（算搜索用的拼音），没装时脚本会提示：`python -m pip install pypinyin==0.53.0`。

## 加一个模型

1. 在 `models.json` 里加一行：
   - `id`：网址用的名字，小写字母、数字、连字符，如 `gpt-6-1-sol`；
   - `key`：评测记录里的型号，如 `GPT/6.1Sol`（`orchestrator/grading.json` 的 `models`）；
   - `name` 全名、`short` 简称、`aliases` 可搜的别名、`vendor` 厂商（模型得分页侧栏和厂商筛选按它分组，同一厂商写法一致）、`logo`（`website/logos/mark/<logo>.svg` 必须存在，新厂商先按 `website/logos/README.md` 放进图标）、`agent` 作答用的 Agent（如 Claude Code、Codex、DeepSeek Harness）、`effort` 推理强度（原样显示在模型名后的括号里）；
   - `tested`：最近一次作答的日期，留空时按 `orchestrator/state.json` 里这个模型 13 题最近一次作答的开始日期填。
   - `audit`：临时做法，平时不用，只在用户明确说某个模型暂不上网站时写 `true`。网站导出整条跳过它（排行、模型页、搜索都没有这个模型），登记仍留着给测评视频和开销统计用；评分和测评视频都不读这个字段。用户说可以公开时删掉这一项，再运行 `publish.py`。
   - 出片时由做视频的 AI 自己加（可选，网站不用，测评视频的 `build_data.py` 读；不问用户）：`released` 发布日期 `YYYY-MM-DD`，查厂商官方发布信息；`tier` 定位（顶级旗舰 / 中高端性能主力 / 均衡性价比型 / 甜点快速型），按产品线位置判断；`series` 选手页背景大字，用模型代号（大写英文一个词，如 `OPUS`、`SOL`）；`portrait` 立绘文件名（`videos/model_character/transparent/` 里的透明 PNG），用这个模型自己的立绘，没有专属的用同厂商的（如 `claude.png`）；它的头部框登记在同目录 `heads.json`；`cover_name` 封面上显示的型号名（用户要求封面带版本号等时才写，如 `DeepSeek V4.1 Flash 1017`），只有封面用，片中和网站仍用 `name`。
2. 必须同时登记 `orchestrator/billing.json`：`models.<key>` 映射到 `plans` 的套餐。订阅填月费 `price`、币种 `currency`、`period: month`，按 ModelDial 填该型号的 `weekly_tokens_e8`（亿 Token）；积分套餐填套餐积分 `credits`。没有周额度时，填官方 `api_prices` 的分档价格、套餐 `estimate_ref` 与参考型号 `weekly_api_usd`。`source` 保留来源、日期及美元人民币汇率。`usage_proxy` 仅在明确需要历史型号代理时配置；全无本型号实测用量才启用，13 题全标拟合，使用目标型号自己的套餐。
3. API 计费套餐必须登记本型号官方 `api_prices`：输入（缓存未命中）、缓存命中、输出、币种、提示长度分档及时段规则、来源网址和读取日期；按本地逐次请求记录自动算 API 等值并换成人民币，直接作为开销。`total_cny` 只可保留为历史对照，不再要求用户提供；重测自动选最新作答及续做重算。缺映射、官方价格、汇率或参考额度时金额为 null，网站显示“数据暂缺”，`costs.py status` 和导出日志列出缺项，不用 0 代替。
4. 之后评完由调度自动发布上线（见「发布」），无需单独执行 Token 采集、开销换算命令。`GPT/6.2Sol` 当前已映射 OpenAI Pro 200、周额度 47.08 亿，沿用用户确认的 `gpt-6.1-sol` 额度口径；尚未作答时 Token 与金额为 null。

只有登记了的模型会出现在网站上（带 `audit` 的除外；`site.json` 的暂停公示打开时一个都不出现）。题没评完的模型照常导出，标为评测中。

## 暂停公示

全站暂时不公布任何成绩时用（例如改题后全量重测期间）。开关是 `site.json` 的 `notice`：

```json
{ "notice": { "zh": "正在重新设计题目，测评中", "en": "The tasks are being redesigned; testing is in progress" } }
```

- **打开**：`notice` 写中英两句。导出时一个模型都不输出（效果同所有模型都带 `audit`，`models.json` 本身不用改），`scores.json` 带上这句 `notice`；首页、排行总榜、题目类别榜和模型得分页只显示这条提示和去题目拆解、挑战赛说明的按钮，题目页的「各模型得分」也只写这句；题目页、题目拆解、挑战赛说明和猜你想问照常。
- **关闭**：把 `notice` 改成 `null`，一切恢复原样。
- 改完运行 `publish.py` 才生效。自动发布（`site_publish.py`）跑的是同一个 `publish.py`、读同一份 `site.json`，开关打开期间评完自动发布也保持隐藏。

## 暂停推送

本机照常导出、构建（可以看带成绩的网页），但不推送到 GitHub Pages 时用。开关是 `site.json` 的 `hold`：

- **打开**：`"hold": true`。`publish.py` 无论手动运行还是评分后自动运行，都只导出和构建，输出“推送暂停，只构建，没有推送”。
- **关闭**：改为 `false`（或删掉），再运行 `publish.py` 推送。
- 和 `notice` 互不影响：`notice` 管网页上显不显示成绩，`hold` 管推不推送。

## 发布

```text
python website/tools/publish.py              导出 → 构建 → 推送到 GitHub 的发布分支
python website/tools/publish.py --no-upload  只导出和构建，在本机检查构建
```

- 发布目标（自定义域名、分支）只写在 `publish.json`。网站由 GitHub Pages 托管该分支，阿里云 DCDN 在前面加速：访客 → DCDN → GitHub Pages。
- 自动发布：一个模型的评分全部结束时，调度（`orchestrator/grading.py` 的 `advance()`）在后台运行 `orchestrator/site_publish.py`，由它运行 `publish.py`，输出写到 `orchestrator/logs/publish-<时间戳>.log`，结束后（成功或失败）用 `timer.py notify` 把名次、是否已推送和日志路径作为事件送给指挥。同一时刻只跑一个发布，已有发布在跑时排一次，跑完再发；排队时又来的请求并入那一次。
- 手动运行同一条命令：用户改分之后（`orchestrator/playbook/3-评分.md` 第 10 条）、网站代码改动之后、自动发布失败并处理之后。
- 网站上出现哪些模型只由 `models.json` 决定。正式测评的新型号在开测前登记（`1-准备与启动.md`），所以评完一发布就上线；对照实验（如 Fast 型号）不登记，就不会出现。
- 推送时把构建产物加上 `CNAME`、`.nojekyll`，作为一个全新提交强制推送到发布分支（分支只留最新一版）；用本机已有的 Git 登录，不需要任何云密钥。主分支不受影响，不提交主分支。
- 推送后在 DCDN 的网页缓存到期时上线，不用刷新缓存。

**一次性准备**：
1. GitHub：仓库 Settings → Pages，来源选 `publish.json` 的 `branch` 分支根目录，自定义域名填它的 `domain`（DNS 指向 DCDN，GitHub 的 DNS 检查报警不用管，不勾强制 HTTPS）。
2. 阿里云 DCDN：加速域名为 `domain`，源站类型「域名」`wendystar0628.github.io`、端口 80、回源协议 HTTP、回源 HOST 设为加速域名；缓存规则：`html`、`json` 5 分钟，目录 `/assets/` 365 天；HTTPS 用免费证书并强制跳转；设用量封顶。
3. 云解析：`domain` 的主机记录 CNAME 到 DCDN 给出的地址。

## 文件和规则

| 文件 | 来源 |
|---|---|
| `models.json` | 模型登记表 |
| `site.json` | 全站开关：`notice` 不为 `null` 时暂停公示（见「暂停公示」） |
| `tasks_meta.json` | 类别和题目的中英文案（名称、短名、一句定位、交付物、搜索别名），说明页各节标题 |
| `export_data.py` | 导出脚本 |
| `publish.py` | 唯一的发布命令：导出、构建、推送 |
| `publish.json` | 发布目标（自定义域名、分支），只在这里规定，不含密钥 |

- 分数用 `orchestrator/grading.py` 的 `load`、`task_scores`、`model_scores` 算，和 `grading.py status` 一致，一位小数。权重、限时、题型取 `orchestrator/tasks.py`。
- 题目顺序：类别按 `tasks_meta.json` 的顺序（同 README 题目总览），类别内按 `tasks.py` 的顺序；`no` 是全站统一的 01–13 编号。
- 一道题评完（`grading.py` 没有报缺口）才算出分，否则为 `null`。类别、两类题分要本类的题都出分；总分要 13 题都出分，否则为 `null`，`status` 为 `testing`（评测中），`rank` 为 `null`。
- 在已定格式之外加的字段：
  - `models.json`：`key`、`aliases`（登记表里出片用的 `released`、`tier`、`series`、`portrait` 不导出到网站）；
  - `tasks.json`：类别加 `short`、`short_en`、`icon`、`kind`、`brief`、`brief_en`；题目加 `path`、`no`、`category`、`statement`（题面在仓库里的路径）；
  - `scores.json`：顶层 `order`（总榜顺序，评测中的排在最后）、`notice`（暂停公示时的中英提示，平时 `null`）；每个模型加 `status`、`done`（已出分题数）、`rank`、`category_ranks`、`task_ranks`（同分同名次）。
  - `scores.<模型 id>.task_info`：按题目 key，只写分数本身说不出的内容，没有可补充的题不出现。`state` 是没出分的原因：`testing` 评测中（还在作答或还在评分）、`missing` 未交、`failed` 评分失败、`unscored` 评分员没给总分；`graders` 是设计题主项有两位评分员时各自单独给出的题分（`[{name, score}]`，性能项仍用它自己的评分员，两者平均就是题分）；`anomaly` 是评分员写的分数异常说明（`[{grader, text}]`）。网站的成绩矩阵和题目类别榜“按题”视图用它写格里的短标记和浮签。
  - “未交”的判定：`grading.py` 报这题缺少提交（没有评分任务，也没有作答目录），并且 `orchestrator/state.json` 里这个模型这题的作答记录已经关闭；作答记录还没关闭或没有记录时算评测中。
  - 测试开销：`scores.json` 顶层 `cost_source` 为 `{name, url, fetched, usd_cny}`；`scores.<模型 id>.cost` 为 `{cny, basis, plan, tokens, fitted, method, api_usd}`。cny 是一位小数的人民币金额，缺数据为 null；basis 为 subscription / api，无映射为 null；plan 含 name、price、currency、period（积分档另有 credits；API 只有 name），无映射为 null；tokens 是含拟合的 13 题输入+输出总量（整数，全无记录为 null）；fitted 列出发生 Token、积分或 API 等值拟合的中文题名。method 为 quota / api_price / credits 或 null，api_usd 仅在 api_price 时为一位小数的 API 等值美元，其余 null。由 `orchestrator/costs.py` 只读计算，换算、当前最后一次作答及续做的选择、拟合和用量来源以 `orchestrator/docs/测试开销.md` 为准。
- 自动发布和手动发布统一在 `publish.py` 的 `build()` 中先更新 `orchestrator/usage.json`，再导出和构建；`site_publish.py` 负责排队、启动与通知。单独运行 `export_data.py`、视频的 `build_data.py` 只读台账和未采集运行，自动重算开销，不写台账。用户只改 `result.json` 分数不改变作答用量；下一次发布/出片重新读分数和开销，无需手改台账。磁盘上的网站和视频生成文件仍需各自的正常生成步骤，不会因文件被编辑而自行发布或重渲染。
- `updated` 是用到的评分结果文件（`result.json`）里最晚的修改日期。
- `search.json`：`{ items: [{ type, id, name, en, short, terms, py, pyi, href, … }] }`，`type` 为 model、task、category、section；`py`、`pyi` 是名称、短名和中文别名的拼音全拼和首字母（数组）。
- `stems/<类别>/<题目>.json`：题目页的题干，每次导出整个文件夹重写。摘录规则只写在 `export_data.py` 的 `STEM_RULE` 注释和 `NOT_STEM` 词表（按标题排除作答、规定、评分、环境、录制接口等章节，题面旁材料文件夹里的 `第NN题.md` 接在后面），`website/docs/tasks.md`「题干的摘录规则」照录并写明理由。改题面后重新发布，题干自动跟上。

- Token 缺失题按实际运行时长拟合：已测 Token 合计 / 对应运行分钟合计 × 目标题实际分钟；代理也按目标自己的时长缩放。新增可选 `cost.fit_basis` 记录速率、来源、各题分钟及限时回退；详见测试开销约定。新型号启动前即写 E 盘 runtime.json，每次归档把用量与时长一并入台账，发布、核心归档和清理前自动采集，正常完整测试无需拟合。

- 最新作答按计时记录和显式续做关系选择，日志缺失不能回退旧作答。部分续做缺日志只补缺失段；`cost.fit_basis` 带时间精度、缺失段和归属证据。只知截止的时长标为“实际停止未知”。`cost.usage_gaps` 表示服务未返回用量，不能用字符数冒充实测。
