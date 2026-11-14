# 成绩网站的登记、导出和发布

网站数据由 `export_data.py` 从评分记录和题面原件导出到 `website/site/data/`（只读，不写 `orchestrator/`、`Grading/`、题面和 H 盘）；本地实时数据与正式确认快照分开，命令见下文「发布」。导出需要 pypinyin（算搜索用的拼音），没装时脚本会提示：`python -m pip install pypinyin==0.53.0`。

## 加一个模型

1. 在 `models.json` 里加一行：
   - `id`：网址用的名字，小写字母、数字、连字符，如 `gpt-6-1-sol`；
   - `key`：评测记录里的型号，如 `GPT/6.1Sol`（`orchestrator/grading.json` 的 `models`）；
   - `name` 全名、`short` 简称、`aliases` 可搜的别名、`vendor` 厂商（模型得分页侧栏和厂商筛选按它分组，同一厂商写法一致）、`logo`（`website/logos/mark/<logo>.svg` 必须存在，新厂商先按 `website/logos/README.md` 放进图标）、`agent` 作答用的 Agent（如 Claude Code、Codex、DeepSeek Harness）、`effort` 推理强度（原样显示在模型名后的括号里）；
   - `tested`：最近一次作答的日期，留空时按 `orchestrator/state.json` 里这个模型 13 题最近一次作答的开始日期填。
   - `audit`：`true` 的型号只在本地预览显示，不正式公开；视频比较模型继续过滤该标记。用户明确确认且全套完整后，`publish.py --confirm "厂商/型号"` 更新该型号正式快照并解除其 audit。
   - 出片时由做视频的 AI 自己加（可选，网站不用，测评视频的 `build_data.py` 读；不问用户）：`released` 发布日期 `YYYY-MM-DD`，查厂商官方发布信息；`tier` 定位（顶级旗舰 / 中高端性能主力 / 均衡性价比型 / 甜点快速型），按产品线位置判断；`series` 选手页背景大字，用模型代号（大写英文一个词，如 `OPUS`、`SOL`）；`portrait` 立绘文件名（`videos/model_character/transparent/` 里的透明 PNG），用这个模型自己的立绘，没有专属的用同厂商的（如 `claude.png`）；它的头部框登记在同目录 `heads.json`；`cover_name` 封面上显示的型号名（用户要求封面带版本号等时才写，如 `DeepSeek V4.1 Flash 1017`），只有封面用，片中和网站仍用 `name`。
2. 必须同时登记 `orchestrator/billing.json`：`models.<key>` 映射到 `plans` 的套餐。订阅填月费 `price`、币种 `currency`、`period: month`，按 ModelDial 填该型号的 `weekly_tokens_e8`（亿 Token）；积分套餐填套餐积分 `credits`。没有周额度时，填官方 `api_prices` 的分档价格、套餐 `estimate_ref` 与参考型号 `weekly_api_usd`。`source` 保留来源、日期及美元人民币汇率。`usage_proxy` 仅在明确需要历史型号代理时配置；全无本型号实测用量才启用，13 题全标拟合，使用目标型号自己的套餐。
   来源若为平均月Token，先以“月Token × 12 ÷ 52”换成周值写入；不要把月值直接当周值。Gemini Carbon/Hydrogen按2026-11-13截图的95.3/126亿Token每月与$199.99月费直接折算，不再套用其他型号的估计。
3. API 计费套餐必须登记本型号官方 `api_prices`：输入（缓存未命中）、缓存命中、输出、币种、提示长度分档及时段规则、来源网址和读取日期；按本地逐次请求记录自动算 API 等值并换成人民币，直接作为开销。`total_cny` 只可保留为历史对照，不再要求用户提供；重测自动选最新作答及续做重算。缺映射、官方价格、汇率或参考额度时金额为 null，网站显示“数据暂缺”，`costs.py status` 和导出日志列出缺项，不用 0 代替。
4. 每道题评分完成自动刷新本地预览；全套 13 题完整且用户明确确认后才能更新正式成绩。尚未作答时 Token 与金额为 null。

只有登记、经用户明确确认且**已完成整轮测试**（全套 13 题正式结果齐备、无评分缺口）的模型才会进入网站正式导出与榜单计算（缺答按既定规则记 0 且已正式评分的 0 分合法，不要求全题答对或全题交答案；带 `audit: true` 的不正式公开，`site.json` 暂停公示时一个都不出现）。未完成整轮测试的模型由统一导出入口自动排除、不靠人工 `audit` 拦阻；单项评分结束/`model_finished` 只说明已排任务无活动，不代表整轮完毕。

## 暂停公示

全站暂时不公布任何成绩时用（例如改题后全量重测期间）。开关是 `site.json` 的 `notice`：

```json
{ "notice": { "zh": "正在重新设计题目，测评中", "en": "The tasks are being redesigned; testing is in progress" } }
```

- **打开**：`notice` 写中英两句。导出时一个模型都不输出（效果同所有模型都带 `audit`，`models.json` 本身不用改），`scores.json` 带上这句 `notice`；首页、排行总榜、题目类别榜和模型得分页只显示这条提示和去题目详情、挑战赛说明的按钮，题目页的「各模型得分」也只写这句；题目页、题目详情、挑战赛说明和猜你想问照常。
- **关闭**：把 `notice` 改成 `null`，一切恢复原样。
- 改完运行 `publish.py` 才对正式站生效；本地实时预览不受正式暂停公示影响。

## 暂停推送

本机照常导出、构建（可以看带成绩的网页），但不推送到 GitHub Pages 时用。开关是 `site.json` 的 `hold`：

- **打开**：`"hold": true`。手动 `publish.py` 只构建已确认正式成绩，不推送；自动评分只刷新本地，不走此入口。
- **关闭**：改为 `false`（或删掉），再运行 `publish.py` 推送。
- 和 `notice` 互不影响：`notice` 管网页上显不显示成绩，`hold` 管推不推送。

## 发布

```text
python website/tools/export_data.py                      更新本地实时预览（含未完整/audit）
python website/tools/publish.py                          只构建并发布已确认正式成绩
python website/tools/publish.py --no-upload              临时目录构建正式成绩，不上传、不覆盖本地
python website/tools/publish.py --confirm "厂商/型号"      用户明确确认后，更新该完整型号快照并发布
```

- 发布目标（自定义域名、分支）只写在 `publish.json`。网站由 GitHub Pages 托管该分支，阿里云 DCDN 在前面加速：访客 → DCDN → GitHub Pages。
- 自动本地刷新：每次评分真正结束后，调度按模型合并请求 `site_publish.py`，运行 `export_data.py --scores-only`，只更新成绩、模型和搜索索引，不构建、不上传。静态题目数据或题干缺失时自动完整初始化；日常修改题目仍用原有完整导出入口。日志为 `preview-<时间戳>.log`，结果仍通过事件送给指挥；无新结果时不重复刷新。
- 网站文字或代码修改后运行普通 `publish.py`，只发布既有确认快照；未经确认的新成绩不会随网页改动上线。用户确认某型号后才用 `--confirm`。
- 正式出现的模型取 `confirmed-scores.json` 中已确认且完整的记录，再按当前登记/audit过滤；本地默认包含已登记的 audit/未完整模型，未完成题为 null，总分和总榜名次只有全套完整时才出现。
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
| `export_data.py` | 默认本地实时导出；`--confirmed --out <绝对目录>` 导出正式快照 |
| `confirmed-scores.json` | 已确认公开成绩快照，只能显式确认某型号时更新 |
| `publish.py` | 唯一的发布命令：导出、构建、推送 |
| `publish.json` | 发布目标（自定义域名、分支），只在这里规定，不含密钥 |

- 本地分数用 `orchestrator/grading.py` 的 `load`、`task_scores`、`model_scores` 算，和 `grading.py status` 一致，一位小数。权重、限时、题型取 `orchestrator/tasks.py`。
- 题目顺序：类别按 `tasks_meta.json` 的顺序（同 README 题目总览），类别内按 `tasks.py` 的顺序；`no` 是全站统一的 01–13 编号。
- 正式成绩须全套 13 题无评分缺口且已由用户明确确认；缺答按规则正式计 0 分亦属完整。本地可查看已有 final 单题分数，未齐题时 total/rank 为 null；视频仍严格排除未完整模型。
- 在已定格式之外加的字段：
  - `models.json`：`key`、`aliases`（登记表里出片用的 `released`、`tier`、`series`、`portrait` 不导出到网站）；
  - `tasks.json`：类别加 `short`、`short_en`、`icon`、`kind`、`brief`、`brief_en`；题目加 `path`、`no`、`category`、`statement`（题面在仓库里的路径）；
  - `scores.json`：顶层 `order`（总榜顺序，评测中的排在最后）、`notice`（暂停公示时的中英提示，平时 `null`）；每个模型加 `status`、`done`（已出分题数）、`rank`、`category_ranks`、`task_ranks`（同分同名次）。
  - `scores.<模型 id>.task_info`：按题目 key，只写分数本身说不出的内容，没有可补充的题不出现。`state` 是没出分的原因：`testing` 评测中（还在作答或还在评分）、`missing` 未交、`failed` 评分失败、`unscored` 评分员没给总分；`graders` 是设计题主项有两位评分员时各自单独给出的题分（`[{name, score}]`，性能项仍用它自己的评分员，两者平均就是题分）；`anomaly` 是分数异常说明（`[{text}]`），只公开异常原文及其顺序，不公开异常所属评分员；设计题正常的 `graders` 分项不变。网站的成绩矩阵和题目类别榜“按题”视图用它写格里的短标记和浮签。
  - “未交”的判定：`grading.py` 报这题缺少提交（没有评分任务，也没有作答目录），并且 `orchestrator/state.json` 里这个模型这题的作答记录已经关闭；作答记录还没关闭或没有记录时算评测中。
  - 测试开销只按公开白名单导出：`scores.json.cost_source` 为 `{name, name_en, url, fetched, usd_cny}`；`scores.<模型 id>.cost` 为 `{cny, basis, plan, tokens, method, api_usd, hours}`。`plan` 只含 `name`、`name_en`、`price`、`currency`、`period`、`credits` 中已有的通用套餐字段。金额、Token、计费方法及测试时长沿用 `orchestrator/costs.py` 的计算值；不公开内部采集情况、估算标记或题目清单、代理关系、日志路径、运行/会话 ID、`fitted`、`fit_basis`、`usage_gaps`、`pricing_issues` 及其他扩展。JSON/CSV 下载只读这些公开数据，不另取内部台账。换算和内部核算约定见 `orchestrator/docs/测试开销.md`。
- `export_data.py` 只读生成本地实时数据；`publish.py` 不采集或升级新成绩，只用确认快照在临时目录导出，并以绝对路径 `ONESHOT_SITE_DATA_DIR` 传给 Vite 的路由与数据输出。正式构建不覆盖本地 `site/data`。作答日志/用量仍由 clean、close、核心归档入口自动入账。
- `updated` 是用到的评分结果文件（`result.json`）里最晚的修改日期。
- `search.json`：`{ items: [{ type, id, name, en, short, terms, py, pyi, href, … }] }`，`type` 为 model、task、category、section；`py`、`pyi` 是名称、短名和中文别名的拼音全拼和首字母（数组）。
- `stems/<类别>/<题目>.json`：题目页的题干，每次导出整个文件夹重写。摘录规则只写在 `export_data.py` 的 `STEM_RULE` 注释和 `NOT_STEM` 词表（按标题排除作答、规定、评分、环境、录制接口等章节，题面旁材料文件夹里的 `第NN题.md` 接在后面），`website/docs/tasks.md`「题干的摘录规则」照录并写明理由。改题面后重新发布，题干自动跟上。

- Token 缺失题按实际运行时长拟合：已测 Token 合计 / 对应运行分钟合计 × 目标题实际分钟；代理也按目标自己的时长缩放。内部计算的可选 `cost.fit_basis` 记录速率、来源、各题分钟及限时回退，不进入网站导出；详见测试开销约定。新型号启动前即写 E 盘 runtime.json，每次归档把用量与时长一并入台账，核心归档和清理前自动采集，正常完整测试无需拟合。

- 最新作答按计时记录和显式续做关系选择，日志缺失不能回退旧作答。部分续做缺日志只补缺失段；内部 `cost.fit_basis` 带时间精度、缺失段和归属证据，不公开。只知截止的时长标为“实际停止未知”。内部 `cost.usage_gaps` 表示服务未返回用量，不能用字符数冒充实测。
