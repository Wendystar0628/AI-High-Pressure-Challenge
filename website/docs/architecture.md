# 网站架构约定

本文是实现约定，给并行开发的各方共用。设计以 README.md 和各页文档为准，这里只定代码怎么分、数据怎么来、谁改哪些文件。

## 一、加模型只改登记表

- `website/tools/models.json` 是登记表，网站只显示登记了的模型。
  - 每项写 `id`、`key`、`name`、`short`、`vendor`、`logo`、`agent`、`effort`、`tested`。
  - `key` 是评测记录里的型号，例如 `GPT/6.1Sol`；`id` 是网址用的名字，例如 `gpt-6-1-sol`。
- 加一个模型只在登记表里加一行（写法见 `website/tools/README.md`），之后的导出、构建和上线都走发布流程（二之一）。
- 页面、榜单、搜索和模型得分页都随数据生成，不写死模型数、模型名和厂商；新厂商只需 `website/logos/mark/` 里有它的图标。

## 二、数据

- `website/tools/export_data.py` 只读评测结果，生成以下文件。生成的文件提交进仓库，网站构建时不需要访问评测目录。
  - `site/data/models.json`、`tasks.json`、`scores.json`：格式见 README.md「数据」一节，可以加字段，不能删改已定字段。
  - `site/data/search.json`：全站搜索索引，拼音事先算好。
  - `site/data/stems/<类别>/<题目>.json`：题目页的题干，从题面原件摘录；摘录规则只在导出脚本的 `STEM_RULE` 一处（`tasks.md`「题干的摘录规则」）。
- 分数的算法和 `orchestrator/grading.py` 的 `task_scores`、`model_scores` 一致，直接只读调用这两个函数。权重和题目顺序取 `orchestrator/tasks.py`。
- 题目和类别的双语文案（短名、一句定位、交付物、英文名）写在 `website/tools/tasks_meta.json`，由导出脚本合进 `tasks.json`。中文从项目 README 摘取。

## 二之一、成绩自动同步

- 唯一的发布命令是 `python website/tools/publish.py`：导出数据 → 构建 → 推送到 GitHub 的 gh-pages 分支。
- 一个模型的评分全部结束时，调度（`orchestrator/grading.py`）在后台自动运行它，结果以事件送给指挥；用户改分后、网站代码改动后手动运行同一条命令。
- 正式测评的新型号在开测前写进登记表，所以评完一发布就上线；没登记的模型不会出现。
- 发布目标只在 `website/tools/publish.json` 里规定；托管、加速和一次性准备见 `website/tools/README.md`。

## 三、页面与路由

- 每种页面一个 HTML 模板，放在 `site/pages/<类型>.html`；对应一个脚本入口 `site/src/pages/<类型>/main.js`。
  - 页面类型：`home`、`leaderboard`、`categories`、`about`、`tasks`、`task`、`model`。
- 构建时由 `vite.config.js` 里的路由插件，按模板和 `site/data/*.json` 生成每个路由的 HTML：
  - 中文版和 `/en/` 下的英文版各一份；
  - 每道题一页 `/tasks/<类别>/<题目>/`；
  - 每个登记模型一页 `/models/<id>/`（模型得分）；入口页 `/models/` 是总分第 1 名的那一页。
  - 开发服务器用同一套规则。
- 生成的页面在 `<body>` 上写 `data-page`、`data-lang`、`data-id`（模型 id 或题目路径），页面脚本据此渲染。
- 网站挂在发布域名的根路径，站内链接一律经 `core/route.js` 生成。

## 四、目录与分工

```text
site/
  package.json  vite.config.js  README.md
  pages/                 页面模板（骨架方建，各页负责人改自己那一个）
  data/                  导出脚本的产物（数据方）
  public/                字体、星图底纹、厂商图标、类别图标、装饰，由同步脚本从 website/ 拷入（骨架方）
  src/
    core/                取数、i18n、路由信息、主题、网址参数和本地存储、格式化（模型名加推理强度）（骨架方）
    shell/               命令栏、全站搜索、快捷键表、模型侧面板、页脚、深浅和语言切换（骨架方）
    charts/              共用的星盘、导出图片、配色取值、坐标轴工具（骨架方）
    ui/                  共用的模型行、工具条（厂商筛选、搜模型、勾选对比）、数据下载（骨架方）
    styles/              全站样式：技能的 stellar.css 加本站的 visual.md 补充（骨架方）
    motion.js            动效档位和曲线（骨架方，按 motion.md）
    i18n/zh/<命名空间>.json、i18n/en/<命名空间>.json   common 归骨架方，每页一个命名空间归该页
    pages/<类型>/         各页自己的脚本、样式和部件（各页负责人）
  content/               说明页和题目页的长文，中英各一份（阅读页负责人）
tools/
  models.json  tasks_meta.json  export_data.py   （数据方）
  publish.py  publish.json                       发布（README.md）
```

- 各页负责人只改 `pages/<自己的类型>.html`、`src/pages/<自己的类型>/`、自己的 i18n 文件和 `content/` 下自己的文件。
- 共用部件归骨架方。页面需要的共用部件不够用时，先在自己的页面目录里扩展，在交付说明里写明，最后由整合方并入。

## 五、共同约束

- 设计系统用 `website/stellar-ui-skill`；视觉和动效按 `website/docs/visual.md`、`motion.md`；各页内容按对应文档。
- 素材只用 `website/decor`、`website/logos`、`website/icons/categories` 和技能自带的素材，不用 `assets/readme/` 下的旧图。
- 界面文字都放在 i18n 文件里，中文是主语言。
- 按桌面网页设计（宽 1024 以上）；模型得分页、题目类别榜和题目页在手机宽度下也不出现横向滚动。浅色、深色两套主题都要验收。
- 网站轻量，不展示作品的截图、录像和解答，也不放视频文件。
