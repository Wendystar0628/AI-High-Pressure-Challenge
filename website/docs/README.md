# 成绩网站设计总览

展示「AI八项全能·定时挑战赛」各模型成绩的静态网站，只做桌面网页（宽 1024 以上）。设计系统用 `website/stellar-ui-skill`，本目录只写本站自己的决定；技能里已有的规则不重复。

## 变体卡

```text
变体：纸 neutral / 切角 standard / 底纹 stars / 密度 standard / 动效 full（动效按 motion.md 在技能上扩展）
主视觉：八项星盘——8 个类别按权重分扇区，12 道题是扇区里的四角星，星的大小按题目权重，星到中心的距离是当前模型这道题的得分；中心是当前模型（默认榜首）和总分
页面类型：首页展示；排行总榜、类别榜、模型详情控制台；挑战赛说明、题目拆解阅读
配色：有色部分紫 6、荧光绿 3、星光青 1；标准评判题荧光绿族，主动设计题紫族，参考和基准用青（visual.md）
```

## 页面

| 页面 | 路径 | 类型 | 文档 |
|---|---|---|---|
| 首页 | `/` | 展示 | [home.md](home.md) |
| 排行总榜 | `/leaderboard/` | 控制台 | [leaderboard.md](leaderboard.md) |
| 类别榜 | `/categories/`，类别用锚点 `#reason` 等 | 控制台 | [categories.md](categories.md) |
| 挑战赛说明 | `/about/` | 阅读 | [about.md](about.md) |
| 题目拆解 | `/tasks/`，题目页 `/tasks/<类别>/<题目>/` | 阅读 | [tasks.md](tasks.md) |
| 模型详情 | `/models/<模型id>/` | 控制台 | [models.md](models.md) |
| 配色与版式 | 全站 | — | [visual.md](visual.md) |
| 动效 | 全站 | — | [motion.md](motion.md) |

类别和题目的路径名：

| 类别 | 路径名 | 题目路径名 |
|---|---|---|
| 数学推理 | `reason` | `formal-proof`、`math-olympiad` |
| 算法竞赛 | `algo` | `unit-square`、`transformer`、`circuit` |
| 空间推理 | `spatial` | `luban` |
| 复杂交互应用 | `interact` | `ae-editor` |
| 游戏设计与开发 | `game` | `tower-defense` |
| 物理模拟 | `physics` | `jelly-tank` |
| 视觉设计与渲染 | `visual` | `nvidia-b200`、`harbor` |
| 系统架构与实现 | `system` | `nested-os` |

## 导航

- 全站顶部一条深色命令栏：左端字标（回首页），中间五个入口「首页 / 排行总榜 / 类别榜 / 题目拆解 / 挑战赛说明」，右端搜索和深浅切换。当前页按技能的当前项样式标出。
- 阅读页左栏是本页目录，不再放全站导航。
- 页面之间的链接：
  - 模型名：打开模型侧面板，内容是总分、8 个类别分和 12 道题的分数。两个榜单页和题目页都能打开。面板底部有「打开详情页」→ `/models/<模型id>/`；首页、说明页、搜索里的模型名直接去详情页。
  - 类别名：跳到 `/categories/#<类别>`。
  - 题目名：跳到该题的题目页。
  - 首页的星盘扇区：跳到对应类别。

## 全站搜索

- 入口：命令栏右端的搜索块「搜索模型、题目、类别」，快捷键 `/` 或 `Ctrl K`，每页都能用。
- 打开居中对话框，边输入边出结果，分四组：模型、题目、类别、说明章节；每组最多 5 条，组尾「查看全部 N 条」。
- 能搜到：中文名、英文名、短名、简称（Sol、Opus）、厂商、拼音全拼和首字母（`lbs` → 鲁班锁拆解）；不分大小写，忽略空格。
- 每条结果：图标（厂商或类别）、名称（命中的字加粗）、一行字段。模型写总分和名次；题目写类别、限时、权重；类别写权重、题数；章节写所在页。
- 去处：模型到详情页 `/models/<id>/`；题目到题目页；类别到 `/categories/#<类别>`；章节到 `/about/#<锚点>`。
- 键盘：↑ ↓ 选择，Enter 打开，Esc 关闭。输入框为空时列出最近 5 次搜索（存在 localStorage）和五个页面入口。
- 没有结果：「没有找到“<输入>”。可以搜模型名、题目名、类别或拼音首字母。」
- 索引 `site/data/search.json` 由数据导出脚本生成，内容包括模型、题目、类别和说明页各节标题，拼音在生成时算好。
- 榜单工具条里的搜索只筛本页的模型行，和全站搜索分开。

## 浅色与深色

- 两套完整主题，默认跟随系统，命令栏右端切换，选择记在 localStorage；切换时用技能的深浅揭幕。
- 颜色一律用 `--st-*` 变量，图表、类别图标、厂商图标、装饰都跟着换主题，不写死颜色。
- 每页两套主题都截图验收。

## 英文版

- 中文在根路径，英文加 `/en/` 前缀（`/en/leaderboard/`）。命令栏右端「中 │ EN」切换，切换后停在同一页、同一位置；选择记在 localStorage，第一次访问按浏览器语言。
- 界面文字全部放在 `site/src/i18n/zh.json`、`en.json`，页面和脚本里不写死文案。
- 数据双语：tasks.json 的类别已有 `en`，题目加 `name_en`、`short_en`、`brief_en`、`deliverable_en`；模型名本来是英文。
- 说明页和题目页的长文各写一份英文正文；英文还没写好的段落显示中文原文。
- 英文页的标题去掉中文行：上行宽体大写眉标，下行同一宽体的粗字标题，宽度 100%，不全大写（技能对无中文产品的写法）。

## 键盘快捷键

- `/` 或 `Ctrl K` 搜索，`T` 切深浅，`L` 切语言，`?` 打开快捷键表，`Esc` 关闭对话框和侧面板。
- 排行总榜：`1`–`6` 切视图，`W` 打开权重沙盘，`C` 切到对比。
- 光标在输入框里时不触发。命令栏和按钮的指向提示里写上对应的键。

## 图表存图

- 每张数据图（首页星盘、总榜各视图、类别榜每块、模型详情页的图）所在看板头右端一个小按钮「存为图片」。
- 导出 PNG：2 倍像素、当前主题、当前视图和高亮；图下加一行页脚：站名、图名、数据日期、网址。字体内嵌进导出用的 SVG，导出结果和屏幕一致。
- 保存后按钮用技能的完成反馈：荧光绿穿过一次，字短暂换成「已保存」。

## 数据下载

- 排行总榜、类别榜、模型详情页的工具条有「下载数据」：CSV 是当前页的表（按当前排序和筛选），JSON 是 models、tasks、scores 合成的一份。
- 文件名 `ai-octathlon-scores-<更新日期>.csv`；CSV 用 UTF-8 带 BOM，Excel 直接打开不乱码。
- 用了自定义权重时，CSV 多一列「自定义总分」，文件第一行写明所用权重。

## 数据

网站只读 `site/data/` 下的静态 JSON，由脚本从评分结果生成（`website/tools/export_data.py`，之后写）。分数一律 0–100，保留一位小数。

```text
models.json   [{ id, name, short, vendor, logo, agent, effort, tested }]
              例：{ "id": "gpt-6-1-sol", "name": "GPT 6.1 Sol", "short": "6.1Sol", "vendor": "OpenAI",
                    "logo": "openai", "agent": "Codex", "effort": "xhigh", "tested": "2026-11-03" }
tasks.json    [{ key, name, en, weight, tasks: [{ key, name, short, weight, minutes, kind, brief, deliverable }] }]
              short：放不下全名处用的短名（如「Transformer 加速」）；brief：一句定位；deliverable：交付物
              brief、deliverable 取自项目 README 的题目总览和题目卡片
              kind：standard（标准评判题，程序校验生成分数）或 design（主动设计题，两位评分员取平均）
scores.json   { updated, scores: { <模型id>: { total, kinds: { standard, design },
                                       categories: { <类别>: 分 | null }, tasks: { <题目>: 分 | null } } } }
              kinds：标准评判题（40%）和主动设计题（60%）各自折成 0–100 的分；类别里的题没出齐时类别分为 null
```

- 12 道题按 tasks.json 的顺序统一编号 01–12，矩阵、类别榜和题目页都用这套编号。

- 模型全名用 `name`：Claude Opus 5.5、Claude Sonnet 5.5、Claude Haiku 5.5、GPT 6.1 Sol、GPT 6.1 Terra、GPT 6 Astra、GPT 6 Luna。
- 凡是显示受测模型名的地方（榜单行、侧面板、详情页、首页前五名、题目页得分、搜索结果、对比视图），名字后面用半角括号标推理强度，取 `effort`：`Claude Opus 5.5 (xhigh)`。括号部分用 Saira，比名字小一级，次要墨色；名字放不下省略时，括号部分照常显示。评分员名不加。
- 厂商图标从 `website/logos/mark/<logo>.svg` 取，单色、跟随文字颜色。
- 12 题没测完的模型标「评测中」，排在已排名模型之后，不参与总榜名次；某个类别的题出齐了，就参加这个类别的排名。

## 多模型扩展

现在 7 个模型，以后会加到几十个。所有榜单、图表都按「一行一个模型」来排：

- 行高固定，模型越多页面越长；不用写死模型数的版式，比如固定的雷达色、固定列数的网格。
- 模型不分配专属颜色。图表按 visual.md 上色：数据按题目类型分荧光绿族和紫族，选中加深一档，最佳用荧光绿高光加四角星。
- 榜单上方有一条工具条：按厂商筛选、搜索模型、勾选对比（最多 4 个）；总榜另有视图切换和排序。勾选的模型在本页所有图表里同时高亮，并带到另一个榜单页（存在 sessionStorage）。
- 总榜的视图、排序、勾选、自定义权重和打开的侧面板写在网址参数里，刷新和分享不丢。
- 首页只放前 5 名和模型总数。类别榜每个类别默认显示前 10 名，下面是「展开全部 N 个」。

## 技术

- 多页静态站，用 Vite 构建，原生 JS 模块；图表用 D3 v7 画 SVG。产物 `dist/` 可直接放 GitHub Pages。
- 素材只用新做的：从技能拷入 `stellar.css`、`fx.js`、星图底纹和 Saira 字体；装饰取自 `website/decor`，厂商图标取自 `website/logos`，类别图标取自 `website/icons/categories/<类别>.svg`（单色 `currentColor`）。不用 `assets/readme/` 下的旧配图、旧图标和旧配色；README 只作为文字内容的来源。
- 代表作录像另转一份 MP4（H.264）给网页播放；原始素材仍是 MKV。

## 目录

```text
website/
  docs/              设计文档（本目录）
  site/              网站源码（待建）：各页 HTML、src/、data/、public/
  tools/             数据导出脚本（待建）
  stellar-ui-skill/  设计系统
  decor/             装饰 SVG
  logos/             厂商图标
  icons/categories/  8 个类别图标
```
