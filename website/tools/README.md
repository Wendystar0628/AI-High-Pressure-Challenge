# 成绩网站的登记、导出和发布

网站数据由 `export_data.py` 从评分记录和题面原件导出到 `website/site/data/`（只读，不写 `orchestrator/`、`Grading/`、题面和 H 盘）；导出、构建、推送只用一条命令 `publish.py`，见下文「发布」。导出需要 pypinyin（算搜索用的拼音），没装时脚本会提示：`python -m pip install pypinyin==0.53.0`。

## 加一个模型

1. 在 `models.json` 里加一行：
   - `id`：网址用的名字，小写字母、数字、连字符，如 `gpt-6-1-sol`；
   - `key`：评测记录里的型号，如 `GPT/6.1Sol`（`orchestrator/grading.json` 的 `models`）；
   - `name` 全名、`short` 简称、`aliases` 可搜的别名、`vendor` 厂商（模型得分页侧栏和厂商筛选按它分组，同一厂商写法一致）、`logo`（`website/logos/mark/<logo>.svg` 必须存在，新厂商先按 `website/logos/README.md` 放进图标）、`agent` 作答用的 Agent（如 Claude Code、Codex、DeepSeek Harness）、`effort` 推理强度（原样显示在模型名后的括号里）；
   - `tested`：最近一次作答的日期，留空时按 `orchestrator/state.json` 里这个模型 12 题最近一次作答的开始日期填。
   - `audit`：临时做法，平时不用，只在用户明确说要先逐一审计某个模型的分数时写 `true`。这个模型其实已经评完，只是暂不公开：网站把它按评测中导出，显示“已出 0 题”、不带任何分数，这是有意暂扣，不是评分没完成。评分和测评视频都不读这个字段。用户审计完删掉这一项，再运行 `publish.py`。
   - 出片时由做视频的 AI 自己加（可选，网站不用，测评视频的 `build_data.py` 读；不问用户）：`released` 发布日期 `YYYY-MM-DD`，查厂商官方发布信息；`tier` 定位（顶级旗舰 / 中高端性能主力 / 均衡性价比型 / 甜点快速型），按产品线位置判断；`series` 选手页背景大字，用模型代号（大写英文一个词，如 `OPUS`、`SOL`）；`portrait` 立绘文件名（`videos/model_character/transparent/` 里的透明 PNG），用这个模型自己的立绘，没有专属的用同厂商的（如 `claude.png`）；它的头部框登记在同目录 `heads.json`。
2. 不用另做什么：评完由调度自动发布上线（见「发布」）。

只有登记了的模型会出现在网站上。12 题没评完的模型照常导出，标为评测中。

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
| `tasks_meta.json` | 类别和题目的中英文案（名称、短名、一句定位、交付物、搜索别名），说明页各节标题 |
| `export_data.py` | 导出脚本 |
| `publish.py` | 唯一的发布命令：导出、构建、推送 |
| `publish.json` | 发布目标（自定义域名、分支），只在这里规定，不含密钥 |

- 分数用 `orchestrator/grading.py` 的 `load`、`task_scores`、`model_scores` 算，和 `grading.py status` 一致，一位小数。权重、限时、题型取 `orchestrator/tasks.py`。
- 题目顺序：类别按 `tasks_meta.json` 的顺序（同 README 题目总览），类别内按 `tasks.py` 的顺序；`no` 是全站统一的 01–12 编号。
- 一道题评完（`grading.py` 没有报缺口）才算出分，否则为 `null`。类别、两类题分要本类的题都出分；总分要 12 题都出分，否则为 `null`，`status` 为 `testing`（评测中），`rank` 为 `null`。
- 在已定格式之外加的字段：
  - `models.json`：`key`、`aliases`（登记表里出片用的 `released`、`tier`、`series`、`portrait` 不导出到网站）；
  - `tasks.json`：类别加 `short`、`short_en`、`icon`、`kind`、`brief`、`brief_en`；题目加 `path`、`no`、`category`、`statement`（题面在仓库里的路径）；
  - `scores.json`：顶层 `order`（总榜顺序，评测中的排在最后）；每个模型加 `status`、`done`（已出分题数）、`rank`、`category_ranks`、`task_ranks`（同分同名次）。
  - 测试开销：`scores.json` 顶层 `cost_source` 为 `{name, url, fetched, usd_cny}`；`scores.<模型 id>.cost` 为 `{cny, basis, plan, tokens, fitted, method, api_usd}`。cny 是一位小数的人民币金额，缺数据为 null；basis 为 subscription / api，无映射为 null；plan 含 name、price、currency、period（积分档另有 credits；API 只有 name），无映射为 null；tokens 是含拟合的 12 题输入+输出总量（整数，全无记录为 null）；fitted 列出发生 Token、积分或 API 等值拟合的中文题名。method 为 quota / api_price / credits / billed 或 null，api_usd 仅在 api_price 时为一位小数的 API 等值美元，其余 null。由 `orchestrator/costs.py` 只读计算，换算、当前最后一次作答及续做的选择、拟合和用量来源以 `orchestrator/docs/测试开销.md` 为准。
- 自动发布前由 site_publish.py 更新 orchestrator/usage.json；单独运行 export_data.py 只读台账和未采集运行，不写台账。
- `updated` 是用到的评分结果文件（`result.json`）里最晚的修改日期。
- `search.json`：`{ items: [{ type, id, name, en, short, terms, py, pyi, href, … }] }`，`type` 为 model、task、category、section；`py`、`pyi` 是名称、短名和中文别名的拼音全拼和首字母（数组）。
- `stems/<类别>/<题目>.json`：题目页的题干，每次导出整个文件夹重写。摘录规则只写在 `export_data.py` 的 `STEM_RULE` 注释和 `NOT_STEM` 词表（按标题排除作答、规定、评分、环境、录制接口等章节，题面旁材料文件夹里的 `第NN题.md` 接在后面），`website/docs/tasks.md`「题干的摘录规则」照录并写明理由。改题面后重新发布，题干自动跟上。
