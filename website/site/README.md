# 成绩网站 `website/site`

「AI八项全能·定时挑战赛」成绩网站的源码：Vite 8 多页静态站，原生 JS 模块，图表用 D3 v7 画 SVG。设计以 `website/docs/` 为准，分工约定见 `website/docs/architecture.md`。本文是各页负责人的主要参考：怎么跑、路由怎么来、谁改哪里、共用部件的 API。

## 一、运行与构建

```sh
cd website/site
npm install            # 只需一次（vite@8、d3@7）
npm run dev            # 开发服务器 http://localhost:5180/ ，改页面模板、i18n、数据会整页刷新
npm run preview        # 本地看构建产物 site/dist/：http://localhost:5181/
npm run sync           # 只同步素材（dev 和构建前会自动跑）
```

- 导出、构建和发布只用一条命令 `python website/tools/publish.py`（`--no-upload` 只导出和构建）；什么时候运行、发布到哪里见 `website/tools/README.md`。`package.json` 的 `build` 由它调用。
- 网站挂在发布域名的根路径。代码里所有站内链接都经 `core/route.js`，不要手写 `/leaderboard/` 这类绝对路径。
- 数据：`site/data/*.json`（连同子文件夹 `stems/` 里各题的题干）由 `website/tools/export_data.py` 生成，`publish.py` 每次先导出再构建。构建时把它们原样拷到 `dist/data/`，页面运行时再读。
- 截图验收时第一次访问会按浏览器语言跳到中文或 `/en/`；地址加 `?stay` 不跳，加 `?theme=light|dark` 临时指定主题（不记住）。截图放在仓库外，看完删掉。

## 二、路由怎么生成

`vite.config.js` 里的路由插件（`scripts/routes.mjs`）按 `pages/<类型>.html` 和 `data/*.json` 生成每个路由的 HTML，构建和开发服务器用同一套规则：

| 路由 | 页面类型 | `data-id` |
|---|---|---|
| `/`、`/en/` | `home` | 空 |
| `/leaderboard/` | `leaderboard` | 空 |
| `/categories/` | `categories` | 空 |
| `/about/` | `about` | 空 |
| `/tasks/` | `tasks` | 空 |
| `/tasks/<类别>/<题目>/` | `task` | `reason/formal-proof`（tasks.json 的 `path`） |
| `/models/` | `model` | 总分第 1 名的模型 id（scores.json 的 `order` 第一个）：「模型得分」入口页，静态生成，不跳转 |
| `/models/<id>/` | `model` | 模型 id（models.json 的 `id`） |

每个路由中文一份、`/en/` 下英文一份。生成的页面 `<body>` 上有 `data-page`、`data-lang`（`zh` / `en`）、`data-id`；`core/route.js` 的 `route` 读的就是它们。加模型、加题只要重新导出数据再构建，路由自动多出来。

### 页面模板 `pages/<类型>.html`

模板是普通 HTML，插件在交给 Vite 之前替换这些记号：

| 记号 | 换成 |
|---|---|
| `<!--@head-->` | 主题和语言的预载脚本、theme-color、图标、站点样式表 `src/styles/site.css`（别删） |
| `<!--@top-->` | 页顶光谱条 + 全站命令栏（别删） |
| `<!--@bottom-->` | 页脚（别删） |
| `{{lang}}` `{{htmlLang}}` | `zh` / `en`，`zh-CN` / `en` |
| `{{page}}` `{{id}}` `{{base}}` | 页面类型、`data-id`、基础路径 |
| `{{title}}` | 页标题（`common.pages.<类型>.title` + 题名或模型名 + 站名） |
| `{{name}}` `{{nameHTML}}` | 题目页：题名；模型页：`Claude Opus 5.5 (xhigh)`，`nameHTML` 是带厂商图标的模型名标记（同 `core/names.js`）。标题首帧就对，名字接力才落得上 |
| `{{t:命名空间.键}}` | i18n 文字，构建时按语言写进 HTML（英文缺键时用中文） |
| `{{href:路径}}` | 本语言下的站内链接，例如 `{{href:leaderboard/}}` |

模板顶上的注释只给负责人看，输出时会去掉。`<main id="main">` 里面由本页负责人随意改；页面脚本入口固定是 `<script type="module" src="/src/pages/<类型>/main.js">`。

## 三、目录与分工

```text
site/
  package.json  vite.config.js  README.md   骨架方
  scripts/routes.mjs  scripts/sync-assets.mjs 骨架方
  pages/<类型>.html          模板：骨架方建，<main> 里面归各页负责人
  data/                      数据方（导出脚本的产物）
  public/                    favicon.svg（骨架方）；fonts/ decor/ logos/ icons/ 由 npm run sync 从 website/ 拷入，不要手改
  src/
    vendor/stellar/          技能的 stellar.css、fx.js、tokens.json、星图（sync 拷入，不要手改）
    core/  shell/  charts/  ui/  styles/  motion.js     骨架方
    reading/                 阅读页工具：左栏与目录 reading.js/.css、长文 rich.js（块与行内标记、代码块）、公式 tex.js（TeX 转 MathML，不依赖 DOM）、content.js、图示 figs/（说明页、题目拆解、题目页共用）
    i18n/zh/common.json  i18n/en/common.json            骨架方
    i18n/<zh|en>/<页面类型>.json                         各页负责人（已建好空壳）
    pages/<类型>/main.js 及本页的样式和部件               各页负责人
  content/                   说明页和题目页的长文（阅读页负责人）
```

- 各页负责人只改：`pages/<自己的类型>.html` 的 `<main>`、`src/pages/<自己的类型>/`、`src/i18n/*/<自己的类型>.json`、`content/` 下自己的文件。
- 现在 `src/pages/*/main.js` 里是骨架方的占位演示（首页星盘和前五名、总榜工具条和模型行、模型页星盘），整页替换即可。
- 共用部件不够用时，先在自己的页面目录里扩展，在交付说明里写明，最后由整合方并入。
- 本页样式写在 `src/pages/<类型>/` 下，从 `main.js` 里 `import './style.css'`。颜色只用 `--st-*` 和下文的站点变量，不写死色值；只做布局时不必重复部件样式。
- D3 一律从 `src/charts/d3.js` 引入（`import * as d3 from '../../charts/d3.js'`），直接 `import 'd3'` 在构建后会丢掉 `selection.transition()`。

## 四、页面入口：`boot()`

```js
// src/pages/leaderboard/main.js
import './style.css';
import { boot, registerShortcut } from '../../shell/index.js';
import { rankBy, t } from '../../core/index.js';

boot(async ({ route, data, t, lang }) => {
  // route: { page, lang, id, category, task, model, base }
  // data: loadData() 的结果；读取失败时为 null（壳已显示出错提示）
  document.querySelector('[data-slot="page"]').append(/* … */);
}, { ns: [] });
```

`boot(render, { ns = [], data = true })` 依次：加载 i18n（`common` + 与页面类型同名的命名空间 + `ns`）→ 接好命令栏、搜索、快捷键、侧面板 → `loadData()` → `await render(ctx)` → 换语言后回到原阅读位置 → 地址有 `?model=` 时打开侧面板 → `<html class="is-ready">`，并派发 `document` 事件 `octa:ready`（`detail` 是 ctx）。`render` 里的报错只记到控制台，不会拖垮壳。

`src/shell/index.js` 还导出：

| 函数 | 作用 |
|---|---|
| `openSearch(q?)` / `closeSearch()` | 打开 / 关闭全站搜索 |
| `registerShortcut({ key, label, handler, ctrl?, display?, group? })` | 本页快捷键，自动列进 `?` 快捷键表的「本页」；返回注销函数。光标在输入框、或有对话框和侧面板开着时，本页快捷键不触发 |
| `openKeys()` | 打开快捷键表 |
| `openModelPanel(id, { order? })` | 打开模型侧面板；已开时直接换模型。`order` 是「上一个 / 下一个」的顺序。面板底部的主要按钮「查看全部得分」→ `/models/<id>/` |
| `closeModelPanel()` / `getPanelModel()` | 关闭；当前面板里的模型 id |
| `setPanelOrder(ids)` | 设上一个 / 下一个的顺序（如总榜当前排序；默认官方名次） |
| `switchLang(lang?)` / `toggleTheme()` | 切语言（保留查询、锚点和阅读位置）/ 切深浅（带揭幕） |

全站快捷键已注册：`/`、`Ctrl K` 搜索，`T` 深浅，`L` 语言，`?` 快捷键表，`Esc` 关对话框和侧面板。

任何元素加 `data-model-panel="<id>"`，点击就打开侧面板；元素里的链接、按钮、勾选框照常各管各的（模型行整行带它，行里的全名是去模型得分页的链接）。侧面板开着时地址带 `?model=<id>`，关掉时去掉；开、换、关都派发 `document` 事件 `octa:panel`（`detail.id`，关闭时为 `null`）。

## 五、core（`src/core/index.js` 一处全导出）

### 数据 `core/data.js`

- `loadData()` → Promise，整页只取一次。结构：

```js
{
  updated: '2026-11-04',
  models: [model],          // models.json：{ id, key, name, short, aliases, vendor, logo, agent, effort, tested }
  order: [id],              // scores.order：官方顺序（已排名按总分，后接评测中）
  categories: [category],   // tasks.json：{ key, name, en, short, short_en, icon, weight, kind, brief, brief_en, tasks: [task] }
  tasks: [task],            // 按 no 1–12 摊平：{ key, path, no, category, name, name_en, short, short_en, weight, minutes, kind, brief, deliverable, statement, … }
  scores: { id: score },    // { total, kinds:{standard,design}, categories, tasks, status:'ranked'|'testing', done, rank, category_ranks, task_ranks }
  vendors: [{ vendor, logo, count }],   // 按模型数排
  kinds: { standard: { weight, categories:[key], tasks:[key] }, design: {…} },
  model(id), category(key), task(key), score(id), categoryOf(taskKey),
}
```

- 权重是百分数（类别 15、题 7.5）；分数 0–100 一位小数，没出分是 `null`。
- `loadSearch()` → search.json 的 `items`。`fetchJSON(name)` 取任一数据文件（带缓存），子文件夹照写，如题目页的 `fetchJSON('stems/reason/formal-proof')`。`bundle()` → `{ updated, models, tasks, scores, order }`（下载 JSON 用）。

### 名次 `core/rank.js`

量度 `by`：`'total'`、`'standard'`、`'design'`、类别 key（`'reason'`…）、题目 key（`'luban'`…）。

| 函数 | 返回 |
|---|---|
| `rankBy(data, by, { ids?, weights? })` | `[{ id, model, value, rank, ranked }]`：已排名的按分数降序（同分同名次 1,1,3，同分按全名），后接未排名的（`rank: null`）。`ids` 只取一部分，但名次仍是全体中的名次；`weights` 是自定义类别权重（只影响 `total`） |
| `rankOf(data, id, by, opts)` | `{ rank, of }`，`of` 是参与排名的模型数 |
| `valueOf(data, id, by, opts)` | 该量度的分数或 `null`（评测中的模型总分为 `null`） |
| `bestValue` / `isBest` / `meanValue` | 最高分、是否第一（并列都算）、平均（参考线用） |
| `customTotal(data, id, weights)` | 自定义权重下的总分，有类别没出分时 `null` |
| `modelStatus(data, id)` / `progress(data, id)` | `'ranked' | 'testing'`；`{ done, all }`（已出几题） |

### i18n `core/i18n.js`

- 文件：`src/i18n/<zh|en>/<命名空间>.json`。`common` 归骨架方，每页一个与页面类型同名的命名空间（`home`、`leaderboard`、`categories`、`about`、`tasks`、`task`、`model`）。
- `t('ns.key', vars)`：`{name}` 占位；英文缺键回落中文，再缺显示键名。`tv(key)` 取原值（对象、数组）。`has(key)`。
- 单复数：英文值写成 `{ "one": "{n} model", "other": "{n} models" }`，`t()` 按 `vars.count`（没有时 `vars.n`）选形式；中文照旧写字符串。`plural(key, n)` 只取选好的原文（不填占位），给把占位换成元素的场合用。构建时的 `{{t:…}}` 同样支持。
- `lang`：`'zh' | 'en'`。`pick(obj, 'name')`：英文页取 `name_en`（类别名取 `en`），没有就用中文；也用于 `short`、`brief`、`deliverable`。
- `applyI18n(root)`：给 `data-i18n="ns.key"`（文字）和 `data-i18n-attr="title:ns.key;aria-label:ns.key"`（属性）填字；`boot` 已对 `<main>` 跑过一次。模板里更推荐直接写 `{{t:ns.key}}`。
- `loadNamespaces(...names)`：`boot` 之外要多加载命名空间时用。

### 路由与链接 `core/route.js`

- `route`：`{ page, lang, id, category, task, model, base }`。`BASE`：基础路径。
- `href(path, { lang, query, hash })`：站内链接，自动加基础路径和 `/en/`。`query` 可以是对象（数组用逗号连起来）。
- `links`：`home()`、`leaderboard(query)`、`categories(类别key)`、`about(锚点)`、`tasks(类别key)`、`task(task 或 'reason/formal-proof')`、`model(id)`、`compare(ids)`（→ `/leaderboard/?view=compare&cmp=…`）、`data(file)`、`asset(path)`。每个都可再传 `{ lang }`。
- `altHref(lang?)`：本页另一种语言的地址（带查询和锚点）。

### 地址参数与存储 `core/state.js`

- `getParam(name, fallback)`、`getListParam(name)`（逗号列表）、`getParams()`。
- `setParams({ view: 'pass', cmp: ['a','b'], model: null }, { push })`：改地址不刷新；`null`、空串、空数组删键；默认 `replaceState`。
- `local` / `session`：`get(key, fallback)`、`set(key, value)`、`remove(key)`，JSON 值，键自动加前缀 `octa.`，存储被禁用时静默。
- `isTyping(el?)`：焦点在输入框里吗（快捷键用）。

### 格式化 `core/format.js`

`fmtScore(v)` → `74.7` / `—`；`fmtDate('2026-11-04')` → `2026.11.04`；`fmtPct(12.5)` → `12.5%`；`fmtRank(1)` → `01`；`fmtNo(1)` → `No.01`；`fmtDiff(-0.1)` → `−0.1`（真减号）；`fmtMinutes(60)` → `60 分钟` / `60 min`；`fmtRankOf(1, 7)` → `1 / 7`；`fmtRankLabel(rank)` → `第 1 名` / `评测中`；`fmtInt(n)`；`round1(v)`；`DASH`。

### 模型名与图标 `core/names.js`

- README 规则：显示受测模型名的地方一律带推理强度 `Claude Opus 5.5 (xhigh)`，括号部分用 Saira、小一级、次要墨色；名字放不下时省略名字、保留括号。
- `modelName(model, { tag, short, className })` → 元素 `<span class="mname"><span class="mname-text">…</span><span class="mname-effort">(xhigh)</span></span>`，CSS 已处理省略。`modelNameHTML(model)` 是字符串版。`modelLabel(model)` → 纯文本（aria、CSV、标题用）。评分员名不要用这几个函数。
- `vendorIcon(model 或 logo, { label })`、`categoryIcon(key, { label })` → 图标 `<span class="icon">`。厂商图标有彩色版（`public/logos/mark/<logo>-color.svg`）时画彩色原图（类 `is-color`，深色主题也不反色），否则和类别图标一样是单色遮罩、跟随文字颜色；都不染紫、不染荧光绿。有哪些彩色版由路由插件按文件给出（`hasColorLogo(logo)`）。
- `iconURL.vendor(logo, { mono })`（有彩色版时给彩色版，`mono: true` 只取单色）、`iconURL.category(key)`、`iconURL.decor('orbit/orbit-nested')`：带基础路径的素材地址。
- `inlineSVG(parentSvg, url, { x, y, size })`：把 SVG 内联进图表（导出图片时遮罩会丢，内联不会）；单色文件跟随 `color`，彩色文件保留自带颜色。

### 其他

- `core/dom.js`：`h('a.st-btn.small#id', props, ...children)`（props 支持 `class`、`dataset`、`style`（可写 `--变量`）、`aria`、`onclick` 等）、`svg(tag, attrs)`、`esc(s)`、`fromHTML(html)`、`srOnly(text)`。
- `core/theme.js`：`currentTheme()` → `'light' | 'dark'`；`onThemeChange(fn)`。主题记在 `localStorage.theme`（技能 fx.js 的键）；没选过时跟随系统。

## 六、动效 `src/motion.js`

按 `website/docs/motion.md`，数值取自技能 `tokens.json`。

- `dur(name)`：毫秒；系统「减少动态效果」时为 0。名字：`press row figFill wipe edge lock come scramble shutter assemble tab stroke fill power sweep scrambleLoad drive drawerIn drawerOut …`，以及本站补充 `starSettle constellationOpen constellationSwitch morph reorder tip highlight timerMax expand`。`durIn(name)`：入场用，`data-st-motion="calm"` 时也为 0。`durOut(name)`：约 2/3。
- `ease.snap / mech / ease / linear`：给 `d3 transition.ease()` 的函数；`css.snap / mech / ease`：CSS 字符串。
- `STAGGER`（row 38、segment 45、block 100）；`stagger(kind, count, maxSpread)` 压缩间隔，不拉长总时长。`SEQUENCE_MAX` = 1000。
- `DIM` = 0.28：联动高亮时其余元素的退淡不透明度（CSS 里是 `var(--dim)`）。
- `play(el, keyframes, { duration, easing, delay })`、`flip(elements, mutate, { duration, delay })`（FLIP 行重排，可打断）、`onEnterView(el, fn)`（屏外的图滚到时才播）、`isInView(el)`、`reduced()`、`calm()`。
- 名字接力（motion.md「换页」）：共享元素名只有一个 `RELAY`（`'name-relay'`）。旧页：链接里的名字元素加 `data-relay-name`（或链接本身加 `data-relay`），或调 `relayName(link, nameEl 或 () => nameEl)`，点击时自动给名字并在 sessionStorage 记下目标路径；SVG 里的名字用 `relayGhost(fromEl, text, href, className)`（星盘的星已内置）；代码里跳页用 `relayTo(href, nameEl)`。新页：模板里首帧就在的标题加 `data-relay-target`，head 预载脚本在 `pagereveal` 时接上，过渡结束收回。JS 后画的标题（题目类别榜看板）接不上，那里不要标名字。
- 技能的 `fx.js` 在 `src/vendor/stellar/fx.js`：`scramble(el, ms)`、`flashDone(btn, label)`、`toast(text)`、`wireReadouts()`、`removeRow(li)`、`closeDialog(d)`。CSS 类 `.st-in-come`（配 `--i`）、`.st-in-power`、`.st-in-wipe` 等照技能用。

## 七、charts（`src/charts/index.js` 一处全导出）

### 八项星盘 `createStarDial(container, options)`

首页和模型得分页共用（README 变体卡、home.md 首屏右栏、models.md 星盘）。从里到外：紫盘（模型、总分、名次）→ 星区（紫盘外沿 0 分，外沿 100 分，25/50/75/100 虚线圈）→ 8 段类别板（圆心角 = 权重 × 3.6°，12 点起顺时针；标准评判题荧光绿 100、主动设计题紫 100，两组间一道墨线；板内侧括弧写「标准评判 40% / 主动设计 60%」）→ 外沿刻度（每 1% 一格，类别分界加长）。12 道题是四角星：到中心的距离 = 该题得分，面积 ∝ 题目权重，本模型该题全场第一时是荧光绿；星座连线顺时针、在每颗星前断开。

```js
import { createStarDial, exportButton } from '../../charts/index.js';
const dial = createStarDial(box, {
  data,                    // loadData() 的结果
  model: 'gpt-6-astra',
  entrance: 'edge',        // 'edge'（首页：星从紫盘外沿飞出）| 'center'（模型页：从中心）| false
  links: true,             // 扇区 → /categories/#类别，星 → 题目页
  tagLink: true,           // 紫盘标签上的模型名 → /models/<id>/（名字接力）；模型得分页自己传 false
  onHover: (h) => {},      // { type: 'category' | 'task', key } 或 null
});
dial.setModel('gpt-6-1-sol');   // 换模型：星沿半径移动 → 连线补间 → 紫盘擦入、总分落定；第一名的星最后变荧光绿
dial.focus('reason');           // 从外部高亮一个类别（null 取消）
dial.wipeTag({ delay: 420 });   // 紫盘标签擦入的钩子：页面按自己的入场编排定时机
dial.svg;                       // 给 exportChart / exportButton
dial.destroy();
```

- SVG 的 viewBox 是 640×640，宽度随容器（`width:100%`），高宽相等；容器决定大小。
- 指向扇区：板填深一档、外沿紫括弧和光束、其余扇区的星和连线退淡、紫盘换成该类分数和名次；指向星：星填荧光绿、紫盘换成该题。离开回到本模型。键盘聚焦同样有效，每段每颗星都有 `aria-label`。
- 没出分的题不画星，在扇区里写「未出分」。home.md 要的「星盘下方三行图例」由首页负责人写在星盘外面。
- 盘内小字按渲染尺寸放大，屏上不小于 11px（技能字号阶最小一级）；扇区名和权重两条弧随字号拉开，放不下的扇区名换简称；分组括弧在「标准评判 40%」处断开。紫盘标签放不下全名时依次换简称、去掉厂商图标，最后才截断（保留推理强度）。

### 存为图片 `charts/export.js`

- `exportButton({ getSvg, title, filename })`：看板头右端的小按钮「存为图片」，完成时荧光绿穿过一次、字换成「已保存」。`getSvg` 返回在页上的 `<svg>`。
- `exportButton({ build, title })`：图不是一整块 SVG 时用，`build()` 返回 `{ svg, width, height }`（样式已内联，可以是 Promise），例如 `build: () => listToSVG(ol, { head })`。
- `rowsToSVG([head, ...rows], { sub: '.mrow-sub', skip: '.sr-only' })` → Promise：一组 HTML 行（连同行里的子行）拼成一张 SVG：文字照位置和样式写成 `<text>`（省略号照样截断），行里每个 SVG 原样带上，高光、虚线「评测中」框、柱尾四角星、厂商和类别图标、勾选紫条都保留，每行和每个子行下沿画自己的细线。带底色的标签加 `data-ground` 会连底色一起导出。
- `exportChart(svg, { title, filename, scale = 2 })`、`exportPrepared(svg, w, h, opts)`：直接导出。PNG 是 2 倍像素、当前主题和状态，下加一行页脚「站名 │ 图名 │ 数据 日期 │ 网址」，嵌入 Saira。文件名默认 `ai-octathlon-<图名>-<更新日期>.png`。
- 导出靠复制每个元素的计算样式，所以图里的颜色写在 CSS（类或 `style`）里就行；HTML 元素（遮罩图标、`<div>` 柱）导不进去，图标用 `inlineSVG`。

### 配色 `charts/colors.js`（visual.md）

- `fill.category(key)` → `var(--cat-reason)` 等类别固定色；`fill.kind('standard'|'design', 'base'|'deep'|'soft')`；`fill.series(deep)`（单一指标：紫 300 / 600）；`fill.compare(n)`（对比的第 n 个：紫、荧光绿、青、墨）；`fill.ref()` / `fill.refBand()`（参考线、及格线：青 800，深色青 500）；`fill.best()`；`fill.pending()`。
- `needsEdge(key 或 kind)`：荧光绿族要 1px 墨边，边色 `edge()`（深色主题里自动隐去）。`stepFill(kind, value)`：矩阵 5 档顺序色（变量 `--step-<kind>-0…4`，深色主题从看板底色里升起）；`stepInk(value)`：写在格里的数字颜色（深色低档用浅墨）；`stepOf(value)`。`resolve('--v-500')`：取当前主题下的实际色值。`CATEGORY_VAR`、`LIME_FAMILY`。
- 用 D3 时写 `.style('fill', fill.category(k))`，换主题不用重画。

### 坐标轴 `charts/axis.js`、四角星 `charts/star.js`

- `scale100(x0, x1)`：固定 0–100 刻度（不随数据缩放）。`drawGrid(g, x, { y0, y1, pass: true })`：20/40/80 淡网格和 60 分青色虚线（类 `.grid-line`、`.pass-line`）。`drawTicks(g, x, { y, ticks, format })`（类 `.tick-label`）。常量 `GRID`、`PASS`。
- 横向分数柱 `charts/bar.js`：`createBar({ grid: [20, 40, 80], pass, thick })` 一根柱的 SVG（坐标写百分数、不用 viewBox，所以斜线纹和细线不随柱伸缩变形）；`setBar(svg, value, { duration, delay, from0 })` 返回柱长百分数；`holdBar(svg)` 先缩回 0 等入场。0 分画零长度标记（墨色短竖线，类 `.bar-zero`），没出分铺斜线纹。`hatchPattern(defs, id)`：像素单位的斜线纹 `<pattern>`，自己画图时用。
- `starPath(x, y, tip, waist)`、`starD(tip)`：全站唯一的星形；`tipForArea(weight)`：面积按权重；`bestStar(parent, x, y, tip)`：荧光绿最佳标记（类 `.best-star`）。

## 八、ui（`src/ui/index.js` 一处全导出）

### 模型行 `ui/modelRow.js`

列：勾选 │ 名次 │ 厂商图标 │ 全名（链接，到模型得分页 `/models/<id>/`，名字接力）│ 图区 │ 分数。点行的其余部分打开侧面板（行上有 `data-model-panel`；键盘用全名后面一个读屏可见的按钮）。行高 `--row-h`，指向或聚焦时左边落紫条、底变纸色、图形加深一档；勾选的行常显紫条（类 `is-checked`，`--cmp` 是勾选序号）。评测中的行名次写虚线框「评测中」、分数 `—`、图区斜线纹加「已出 8 / 12 题」。读屏把一行读作「第 1 名，GPT 6 Astra (xhigh)，74.7 分」。

```js
import { createModelList, createRowHead, barPlot, listToSVG } from '../../ui/index.js';
const head = createRowHead({ rank: '名次', name: '模型', score: '总分', plot: axisNode });
const list = createModelList(ol, {
  data,
  kind: 'series',          // 柱色：'series'（紫 300）| 'standard'（荧光绿加墨边）| 'design'（紫 300）
  plot: barPlot,           // 默认；或 (cell, entry, ctx) => {}，ctx: { data, kind, best, note, first, animate, delay, pass, grid, row, sr }
  checkable: true,         // 勾选框（对比）
  pass: true,              // barPlot 画 60 分线
  grid: [25, 50, 75],      // barPlot 的淡网格（默认 20/40/80）
  // 可选：best、note（常量或 (entry) => 值）、rank(cell, entry, ctx)、rankText(entry)、scoreText(entry)、empty（无行时的句子）
});
list.update(rankBy(data, 'total').filter((e) => tb.matches(e.model)));   // 按 id 复用行，FLIP 重排，新行逐行亮起，筛掉的先收起
list.rows;  // Map<id, li>
```

- 列宽：名字列 `--mrow-name`（默认 15rem，可在本页 CSS 里改）。行 `li.mrow` 带 `data-id`，图区是 `.mrow-plot`。
- 每行（entry）可以带 `best`（全场最佳：分数垫荧光绿、柱尾荧光绿星；不写时名次 1 即最佳）和 `note`（行内备注：没出分的行写在斜线纹上，有分的行跟在柱尾；没出分又没写时是「已出 8 / 12 题」，写 `''` 不显示）。列表选项的 `note` 写成字符串时只给没出分的行。
- 名次格钩子 `rank(cell, entry, ctx)`：自己往名次格里写（例如按某题排序的名次、名次变化），它在本行读屏句 `ctx.sr` 写好之后跑，需要时可改写。
- `createRowHead({ …, hidden: true })`：默认整行对读屏隐藏；`hidden: false` 时标签可读，只隐藏装饰格（勾选位、图标位、没有链接的图区）。表头的名次、分数和其他表头字同一字号。
- `barPlot`：共用的横向分数柱（`charts/bar.js`），固定 0–100，柱尾荧光绿四角星（HTML 叠加层）。自己画图区时同样只往 `cell` 里画。
- `listToSVG(ol, { head })` → Promise `{ svg, width, height }`：表头和每个可见的模型行，连同行里的子行（`.mrow-sub`），拼成一张 SVG（`charts/export.js` 的 `rowsToSVG`），给 `exportButton({ build })`。

### 工具条 `ui/toolbar.js`

```js
const tb = createToolbar({
  data,
  vendors: true, search: true, compare: true,
  download: { csv: () => scoreTable(data, entries, { weights }), json: true },  // json 也可以是 () => 对象
});
el.append(tb.el);                 // 吸顶在命令栏下（top: var(--shell-h)）
tb.slots.top.append(viewSeg);     // 总榜的视图分段、排序放这里（有内容才显示）；tb.slots.end 在下载按钮旁
tb.slots.bottom.append(jumpBar);  // 工具条下面一行，和工具条一起吸顶（题目类别榜的跳转条）
createToolbar({ …, wrap: true }); // 允许各行换行；默认每行一行，搜索框先变窄
tb.on('change', ({ vendors, query }) => redraw());   // 厂商筛选或搜索变了：只隐藏行，不改名次
tb.on('compare', ({ ids }) => toCompareView());      // 「对比」被按下；不监听时自动去 /leaderboard/?view=compare&cmp=…
tb.matches(modelOrId);            // 是否通过筛选和搜索（全名、简称、厂商、aliases）
tb.setQuery(q); tb.clear(); tb.state;   // { vendors: Set, query }
```

厂商块按模型数排、可多选、「全部」清空，超过 6 个厂商时其余收进「更多厂商」。右侧是已勾选模型的小块（序号 + 简称，点一下取消）和主要按钮「对比」（不足 2 个时不可按）。

### 对比勾选 `ui/compare.js`

最多 4 个，按勾选先后排，存在 sessionStorage（`octa.compare`），两个榜单页之间沿用；地址有 `cmp=` 时以它为准。`getCompare()`、`setCompare(ids)`、`toggleCompare(id, on?)`（满 4 个时返回 `false`）、`isCompared(id)`、`compareIndex(id)`（1 起）、`isCompareFull()`、`onCompareChange(fn)`、`MAX_COMPARE`。变化时派发 `window` 事件 `octa:compare`（`detail.ids`）。总榜把勾选写进 `?cmp=` 由总榜负责人用 `setParams` 做。

### 数据下载 `ui/download.js`

- `downloadCSV({ columns, rows, preface, filename, updated })`：UTF-8 带 BOM，Excel 直接开；`columns` 是 `[{ key, label }]`（行是对象）或 `[label]`（行是数组）；`preface` 是第一行（用了自定义权重时写权重）。默认文件名 `ai-octathlon-scores-<更新日期>.csv`。
- `scoreTable(data, entries, { weights })` → `{ columns, rows, preface }`：名次、模型（带推理强度）、厂商、总分（+自定义总分）、标准评判题、主动设计题、8 类、12 题。`entries` 按页面当前的排序和筛选传入。
- 数字照数据原样写：整数写整数（`78`，不写 `78.0`），小数保留数据里的位数；只有算出来的长小数（自定义总分）留一位。
- `downloadJSON(obj, filename)`、`downloadBundle()`（models + tasks + scores 合成一份）、`dataFilename(updated, ext)`、`toCSV(...)`。

### 浮签 `ui/tip.js`

`attachTip(el, () => '数学推理 78.0 × 15% = 11.7')`：指向和键盘聚焦都显示墨底直角小提示；`showTip(text, element 或 {x, y})`、`hideTip()`。

## 九、样式与变量

`src/styles/site.css` = 技能 `stellar.css` + `tokens.css`（本站变量）+ `base.css`（页面框架、背景两角星图、`.page` 内容栏 88rem、`.mname`、`.icon`、`.sr-only`、`.num`、`.site-empty`）+ `shell.css` + `ui.css` + `charts.css`。外观只在 `<html>` 上设一次（`data-st-paper="neutral" data-st-cut="standard" data-st-ground="stars" data-st-density="standard" data-st-motion="full"`，即变体卡）。

| 变量 | 意思 |
|---|---|
| `--v-100 … --v-800`、`--g-100 … --g-800`、`--c-100/500/800` | 紫、荧光绿、星光青色阶（visual.md 二） |
| `--cat-reason` … `--cat-system` | 8 个类别的固定色 |
| `--kind-standard(-deep/-soft)`、`--kind-design(-deep/-soft)` | 两类题的数据色、加深一档、子行浅一档 |
| `--series`、`--series-deep` | 单一指标图表：紫 300、紫 600 |
| `--ref-line`、`--ref-band` | 参考和基准：青 800 / 青 100（深色自动换） |
| `--compare-1 … --compare-4` | 对比视图按勾选顺序 |
| `--group-standard`、`--group-design` | 分组底色（荧光绿 100、紫 100；深色里压暗） |
| `--text-violet`、`--text-lime`、`--text-cyan` | 主题色写小字时用的字色（浅色 800，深色 300/500） |
| `--lime-edge` | 荧光绿填充的 1px 墨边 |
| `--pending-fill`、`--hatch` | 未出分、评测中 |
| `--dim` | 联动高亮的退淡不透明度 |
| `--content-max`（88rem）、`--gutter`、`--shell-h`（命令栏高，吸顶元素用 `top: var(--shell-h)`）、`--row-h` | 版式 |

技能自己的变量（`--st-paper`、`--st-panel`、`--st-ink`、`--st-ink-2`、`--st-rule`、`--st-chip`、`--st-orbit`、`--st-flare`、`--st-wash`、`--st-hatch`、`--st-star` …）和部件类（`.st-panel`、`.st-btn`、`.st-chip`、`.st-head`、`.st-pair`、`.st-eyebrow`、`.st-figs`、`.st-table`、`.st-records`、`.st-toc` …）照技能文档用。

## 十、素材

`npm run sync`（`scripts/sync-assets.mjs`，幂等，多余的旧拷贝会删掉）：

| 来源 | 去处 | 网页里的地址 |
|---|---|---|
| `stellar-ui-skill/assets/fonts` | `public/fonts/` | `/fonts/Saira.ttf`（已在 tokens.css 里 `@font-face`） |
| `website/decor/<类型>/*.svg` | `public/decor/` | `iconURL.decor('orbit/orbit-nested')` 或 CSS `url('/decor/…')` |
| `website/logos/mark` | `public/logos/mark/` | `iconURL.vendor(logo)` |
| `website/icons/categories` | `public/icons/categories/` | `iconURL.category(key)` |
| `stellar-ui-skill/assets/{stellar.css,fx.js,tokens.json,stars}` | `src/vendor/stellar/` | 由 Vite 打包 |

CSS 里写 `url('/decor/…')` 这种根路径，Vite 构建时会自动加基础路径；JS 里一律用 `iconURL` 或 `links.asset()`。不用 `assets/readme/` 下的任何旧图。
