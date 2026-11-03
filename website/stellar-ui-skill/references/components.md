# 部件：写法、含义、禁忌

这是网页写法：所有类都在 `assets/stellar.css`。效果图见 `examples/web/specimen-light.jpg`、`specimen-dark.jpg`。外层容器要带 `class="st"`（通常放在 `<body>` 上），想要背景星点再加 `st-stars`。

两种主题色的分工贯穿下面每个部件：

- **紫 `--st-orbit`**：当前位置。做线、色条、括弧和大字；当前项的块是淡紫底 `--st-wash` 加 3px 紫条、墨色粗体字。不做小字的底。
- **荧光绿 `--st-flare`**：可以按 / 要看一眼。只做填充，上面写墨字（`--st-on-flare`）；不做线和字。
- **红 `--st-danger`**：只给删除。

---

## 光谱条 `.st-tri`

```html
<div class="st-tri" aria-hidden="true"><i></i><i></i><i></i></div>
```

3px 高，紫 / 星光青 `#62D4F5` / 荧光绿三等分。**只放两处**：页面最顶上；文章标题正下方。一次访问的第一页可以加 `.st-in-sweep`，让它从左往右画出来。

不要：放在正文中间、当列表分隔、做成渐变、加粗。星光青只在这里出现，别处不用。

## 记录字段 `.st-field` `.st-facts`

```html
<ul class="st-facts st-field">
  <li><time datetime="2026-10-16">2026.10.16</time></li>
  <li>6,380 字</li>
  <li>约 16 分钟</li>
</ul>
```

界面字体 13px、宽度 112%、次要墨色、等宽数字。`.st-facts` 用竖线分隔，换行时行首不出现竖线。日期写成 `2026.10.16`；计数带单位；`当前 / 总数` 写成 `3 / 24`。

不要：用 `·` 串字段；写"三天前"这种相对时间；编造数字。

## 入口：编号、键值、小块 `.st-tag` `.st-kv` `.st-chip`

```html
<a class="st-tag is-current" href="#" aria-current="page">No.024</a>
<a class="st-kv" href="#"><span>分类</span><span>目视观测</span></a>
<button class="st-chip" aria-pressed="true">全部 <span class="n">24</span></button>
```

右下角切掉 7px（`--st-cut`，随变体缩放），表示"可以点进去"。切角画在背景渐变里，所以焦点框完整。右侧内边距是一段固定值加 `--st-cut`，切角放大时字也不会压进切角。

- `.st-tag`：墨底编号。`.is-current` = 当前这一条：淡紫底、左边 3px 紫条、墨色粗体字。
- `.st-kv`：成对键值，左键右值，中间一条细线。
- `.st-chip`：浅灰小块，用于筛选和标签。`aria-pressed="true"` 或 `.is-active` = 选中，样子和当前编号一样。
- 指向一个**没被选中**的入口时，它填满荧光绿、墨字：表示"可以按"。

不要：给不能点的东西切角；同一排出现两个"当前"；把当前编号做成紫底白字（13px 的白字压在紫底上只有 4.03:1）。

## 马克笔 `.st-marker`

```html
<p><span class="st-marker">示例：一个人的观测笔记</span></p>
```

一行荧光绿底墨字粗体，像荧光笔划过。**一页最多一处**，用来说"这是什么"。加 `.st-in-stroke` 时，打开页面会有一笔划过的动效。

## 状态 `.st-state`

```html
<span class="st-state">已发布</span>
<span class="st-state is-hidden">隐藏</span>
<span class="st-state is-draft">草稿</span>
<span class="st-state is-alert">待审</span>
```

实线墨框 = 生效中；虚线 = 在后台（草稿、隐藏、暂停）；荧光绿块 = 需要看一眼（待审、失败、快满了）。**不用红色**。

## 提示 `.st-notice`

```html
<p class="st-notice" data-flag="出错">这个地址已经被另一个笔记本使用。</p>
```

墨框白底，前面一面荧光绿小旗（默认写"注意"，用 `data-flag` 改字）。出错、警告、需要读的说明都用它。空的时候隐藏。

不要：换成红框红字；抖动。

## 按钮 `.st-btn`

```html
<a class="st-btn go" href="#">读最新一篇 <span class="sub">No.024</span></a>
<a class="st-btn" href="#">全部笔记</a>
<button class="st-btn small danger" type="button">删除</button>
```

右下角切掉 0.5rem（用 `mask` 实现，焦点框画在块内）。指向或聚焦：荧光绿从左擦入，前面带一条墨色亮边扫过，字换成墨色；按下时下沉 1px、缩小 1.5%。

- 默认：浅灰底，次要操作。
- `.go`：主要操作，一组按钮里最多一个。静止时墨底，指向时擦入荧光绿。
- `.small`：放进列表行、表格、面板标题。
- `.danger`：字是红色，擦入的也是红色。**只给删除**。撤回、隐藏、从列表移除这些能恢复的操作用普通按钮加确认框。
- `:disabled`：现在不能按，半透明，指针 not-allowed。
- `aria-busy="true"`：已经按下、正在处理（保存、发送中），铺斜线纹并暂停响应。处理完去掉这个属性。
- `.is-done`：由 `fx.js` 的 `flashDone()` 加上，荧光绿从左到右穿过一次，表示完成。

一排按钮放在 `<p class="st-actions">` 里。一个大链接里的 `<span class="st-btn">` 会在链接被指向时一起擦入。

不要：圆角、胶囊形、投影、渐变底、发光、文字后面加箭头 `→`（写"查看全部"）。

## 记录行 `.st-records`

```html
<ol class="st-records">
  <li>
    <a class="st-record" href="#">
      <span class="st-tag">No.023</span>
      <time class="st-field">2026.10.14</time>
      <span class="name st-read">示例：赤道仪的极轴校准</span>
      <span class="st-field">9,102 字</span>
    </a>
  </li>
</ol>
```

四列：编号 / 日期 / 名称 / 计数，每一列都是真实字段。指向或聚焦：左边落下一条 3px 紫色色条（指针停在哪一行），行内容右移 6px，底色变成纸色。

阅读页和展示页的列表一律用它，不用卡片。

## 阅读页零件

```html
<nav class="st-rail" aria-label="主导航">
  <a class="brand" href="#">LYRA.NOTES</a>
  <a href="#" aria-current="page">笔记</a>
  <a href="#">分类</a>
</nav>

<article class="st-spread">
  <div class="st-sheet">
    <p class="st-crumb st-field"><a href="#">全部笔记</a><span>目视观测</span></p>
    <header class="st-sheet-head"><h1 class="st-read">笔记</h1><p class="st-field">共 24 篇</p></header>
    <p class="st-lede st-read">一两句话说明这里有什么。</p>
    <h2 class="st-group-head st-read"><span>2026</span><span class="st-field">12 篇</span></h2>
    <p class="st-empty">还没有发布笔记。写好的笔记会按发布顺序编号，列在这里。</p>
  </div>
  <aside class="st-margin">
    <ol class="st-toc"><li><a href="#" aria-current="true">一、暗适应</a></li><li><a href="#">二、找参照星</a></li></ol>
    <ul class="st-ledger"><li><span>字数合计</span><span class="st-field">48,210 字</span></li></ul>
  </aside>
</article>
```

- `.st-rail`：左侧竖排导航。当前项是淡紫底、左边 3px 紫条、粗体，右下切角。窗口窄于 1100 时横过来放到顶部。要贴顶就自己加 `position: sticky`（见 `templates/reading.html`）。
- `.st-spread`：白纸 `.st-sheet`（一个阅读栏宽加两侧边距）紧贴页边 `.st-margin`。窄于 960 时页边移到白纸下面。
- `.st-toc`：页边目录，左边一条细线；正在读的那一节换成 3px 紫条、墨色粗体。
- `.st-sheet-head`：页名在左，计数在右，下面一条墨线。
- `.st-crumb`：上一级，斜线分隔。
- `.st-lede`：导语，次要墨色。
- `.st-group-head`：列表里的分组（年份、分类），下面一条墨线，计数在右。
- `.st-ledger`：页边的"标签｜数字"表；值需要注意时加 `.warn`（荧光绿块）。
- `.st-empty`：空状态写成完整的一句话，说明将来会出现什么。

## 正文 `.st-prose`

黑体常规 17px，行高 1.85，最长约 38 字一行。

- 链接：墨字下半截垫一块荧光绿（背景块，高 0.5em，换行时每行各有一块）；指向或聚焦时荧光绿涨满整个字。深色主题里只留底部 2px 的荧光绿细条（大块会吞掉浅色字）。
- 强调：加粗（700）。
- 引用：左边 3px 墨线，字退成次要墨色。
- 二级标题：上方一条细线隔开，界面字体 700。
- 行内代码：等宽，细边框，纸色底。

不要：在正文里铺紫色或荧光绿的大块；用紫色写小字。

## 大字标 `.st-wordmark`

```html
<h1 class="st-wordmark">
  <span class="solid st-in-drive">LYRA</span>
  <span class="hollow st-in-drive" style="animation-delay:140ms" aria-hidden="true">.NOTES</span>
</h1>
```

实心超大字，下面跟一行约一半大的空心字（2px 墨色描边）。界面字体 800、宽度 125%、全大写、行高 0.84。名字较长时用 `--st-wordmark` 调字号。只用在展示页。字标是产品自己的名字，模板里的 LYRA.NOTES 是占位。

## 空心大编号 `.st-hollow-no`

```html
<a href="#" data-fx-host>
  <span class="st-hollow-no" aria-hidden="true" data-fx>024</span>
  …标题、字段、按钮…
</a>
```

超大的空心数字，是这一条的真实编号。指向它所在的链接时，墨色从左往右灌满；配合 `fx.js` 的 `data-fx`，数字同时"乱码后落定"。

## 星点细线标题 `.st-bar-title`

```html
<p class="st-eyebrow slash">Index</p>
<h2 class="st-bar-title">全站索引</h2>
```

粗体标题，后面拖一条 1px 墨色细线，线的末端是一颗 7px 的墨色星点。用在展示页和长页面的段落。

不要：把线换成紫色（紫色只表示当前位置）；一屏里每个小节都挂。

## 画框与铭牌 `.st-frame` `.st-plate`

```html
<figure class="st-frame">
  <div class="window"><svg viewBox="0 0 400 420" role="img" aria-label="…">…</svg></div>
  <figcaption class="st-plate">一句话说明这张图。</figcaption>
</figure>
```

左上、右下各切掉 3.25rem 的画框；后面错开一块斜线纹"影子"（硬边，不是投影）；左下压一块直角的墨色铭牌，写一句话（铭牌不能点，所以不切角；画框的两个大切角是构图，不表示能点）。画框的高度由容器决定，`.window` 绝对定位铺满，里面放 `img` 或 `svg`。配合 `fx.js` 的 `wireParallax()`，图和影子随指针反向轻移。

图要用产品自己的：线稿、照片、自己画的示意图都行。模板里的行星仪线稿是占位。

## 滚动条 `.st-ticker`

```html
<div class="st-ticker" aria-label="最近的笔记">
  <div class="track">
    <ul>…<li><a href="#"><b>No.024</b>标题</a></li>…</ul>
    <ul aria-hidden="true">…同一份，链接加 tabindex="-1"…</ul>
  </div>
</div>
```

深色横带，**两套主题都是深色**（和命令栏同色），不会在深色主题里变成一条亮带。编号是荧光绿块。两份列表首尾相接，60 秒滚完一圈，指向或聚焦即停；指向的那一项整格变荧光绿。减少动效时停止，变成可以横向滚动的一条。它是全套里唯一允许持续运动的东西，因为它承载内容。

## 眉标与中英成对 `.st-eyebrow` `.st-pair`

```html
<p class="st-eyebrow slash">Notes / Observing</p>
<h2 class="st-pair"><span class="st-eyebrow">Notes</span><span>笔记</span></h2>
```

`.st-eyebrow`：11px、宽度 125%、600、全大写、字距 0.14em、次要墨色。`.slash` 在前面加 `// `。`.st-pair`：英文小字在上，中文粗体在下，用来给段落和看板起名。

不要：把中文也拉宽；全大写的长句；一屏里每个元素都挂眉标。

## 命令栏 `.st-cmdbar`

```html
<header class="st-cmdbar">
  <a class="brand" href="#"><span class="seal" aria-hidden="true">L</span>CONSOLE</a>
  <nav aria-label="分区">
    <a href="#" aria-current="page">概览<small>Overview</small></a>
    <a href="#">评论<small>Comments</small><span class="count">2</span></a>
  </nav>
  <div class="util"><a href="#">查看网站</a></div>
</header>
```

两套主题下**都是深色**。徽记是荧光绿切角方块里的一个大写字母（用产品自己的字母）。当前分区：淡紫底、底边一条 3px 紫条、白色粗体字。指向其他分区时，一条荧光绿细条沿底边从左擦过。待处理数量用荧光绿小角标。控制台没有左侧列表，命令栏是唯一的导航。

## 控制台页名 `.st-head`

```html
<header class="st-head"><h1>样张 <small>Specimen</small></h1><p>一句说明。</p></header>
```

粗体中文加小号英文，后面一条以星点结尾的细线，下面一行说明。用在控制台的子页面和样张页。

## 看板 `.st-panel`

```html
<section class="st-panel cut-br">
  <h2><span class="st-pair"><span class="st-eyebrow">Notes</span><span>笔记</span></span> <a href="#">全部</a></h2>
  <div class="st-figs">
    <a href="#"><b data-fx-load>16</b><span>已发布</span></a>
    <a href="#" class="is-alert"><b>2</b><span>待审</span></a>
    <a href="#"><b>7</b><span>草稿</span></a>
  </div>
</section>
```

白板，顶边有一段 5px 的粗墨"页签"（占 14% 宽）。指向或聚焦看板时，页签沿整条边伸开。

修饰：

- `.cut-br` / `.cut-bl` / `.cut-tr` / `.cut-tl`：切掉朝向中心星盘的那个角（1.6rem），让一侧的看板顺着圆的轮廓排，而不是摆成方格。这是排版用的大切角，不表示能按，比按钮的切角大得多，不会混淆。
- `.tab-right`：页签从右端伸出（右侧看板用，左右镜像）。
- `.lead-right` / `.lead-left`：从看板中线引出一根细线，末端一颗 7px 的墨色星点，接到星盘边上；用 `--lead` 设长度。看板堆成一列时要隐藏（模板里用容器查询处理）。

内容：`.st-figs`（三个大数字）、`.st-ledger`（标签｜数值，`.warn` 荧光绿块）、`.st-rows`（工作行）、`.st-bars`（柱图）。

## 大数字 `.st-figs`

三个一排的宽体粗数字，下面小标签。指向一个数字所在的链接时，荧光绿从左垫满数字底下；`.is-alert` 的数字静止就垫着荧光绿（需要处理）。

不要：把数字写成紫色；给每个数字都垫底。

## 工作行 `.st-rows`

```html
<ul class="st-rows">
  <li>
    <div><div>示例：赤道仪的极轴校准 <span class="st-state is-draft">草稿</span></div><div class="meta"><span>No.023</span><span>9,102 字</span></div></div>
    <div class="acts"><button class="st-btn small" type="button" data-open="detail">详情</button><button class="st-btn small go" type="button">发布</button></div>
  </li>
</ul>
```

放在看板里，左右贴边。左边是名称、状态和一行宽体元信息，右边是一组小按钮。指向或行内有焦点时，左边落下紫色色条。

## 星盘 `.st-dial` + `dial.js`

```html
<svg class="st-dial" data-dial role="group" aria-label="分区"></svg>
<script type="module">
  import { drawDial } from '../assets/dial.js';
  drawDial(document.querySelector('[data-dial]'), {
    idle: { label: '系统已运行', big: 16, unit: '小时', sub: '读数 11:36' },
    gauges: [{ label: '处理器', share: 0.12 }, { label: '磁盘', share: 0.89 }],
    sections: [
      { zh: '概览', en: 'Overview', href: '#', big: 16, unit: '小时', here: true },
      { zh: '评论', en: 'Comments', href: '#', big: 10, unit: '条', sub: '待审 2', alert: true },
    ],
  });
</script>
```

外圈一道虚线圆环，里面是 N 段弧形块，每段是一个链接：

- 当前分区（`here`）：淡紫底，外缘一道紫色括弧常显。
- 需要处理的分区（`alert`）：边框加粗，挂一个荧光绿小方块。
- 指向某段：块填满荧光绿、字变墨色，外缘画出紫色括弧，一束紫色光束从块连到中心，中心读数换成这一段的数字。
- 中心：读数标签垫荧光绿，下面是大数字和一行说明。
- 内圈可放几条四分之三圈的仪表弧，平时是次要墨色；快满（超过 85%）的那条变成墨色，标签垫荧光绿。

星盘只在数据本来就分成几块时才用；它是"可以用"，不是"必须有"。

## 表单 `.st-form`

```html
<form class="st-form">
  <label class="field"><span>名称</span><input value="示例笔记本" /><small>说明写在输入框下面。</small></label>
  <p class="st-notice" data-flag="出错" hidden></p>
  <p class="st-actions"><button class="st-btn go">保存</button></p>
</form>
```

方角输入框，白底细边；指向时边框变深，聚焦时墨色边框加一圈 2px 紫色。标签用界面字体 600，说明写在框下面，不写在占位符里。复选框和单选的勾选色是紫。

## 搜索 `.st-search`

```html
<label class="st-search"><input type="search" placeholder="搜索标题、编号" aria-label="搜索" /></label>
```

白底细框，前缀 `//`，聚焦时下边变 2px 紫线。

## 开关 `.st-switch`、分段 `.st-seg`、设置行 `.st-setting`

```html
<label class="st-setting">
  <span><b>公开笔记</b><small>关闭后只有自己能看到。</small></span>
  <input class="st-switch" type="checkbox" role="switch" checked />
</label>

<div class="st-seg" role="radiogroup" aria-label="列表密度">
  <label><input type="radio" name="d" /><span>紧凑</span></label>
  <label><input type="radio" name="d" checked /><span>标准</span></label>
</div>
```

- 开关是方的：开 = 紫色轨道、白方块在右；关 = 浅灰轨道、深灰方块在左。用的是原生 checkbox，键盘和读屏不用另外处理。
- 分段：墨色细框，段间细线；当前段是淡紫底、底部 3px 紫条、粗体，和其他"当前"一样。
- 设置行：名称加一行说明在左，控件在右，下面细线。

不要：圆形开关；把开关做成荧光绿（荧光绿表示"按这里"，不表示"开着"）。

## 进度 `.st-progress`、骨架 `.st-skeleton`

```html
<div class="st-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="63" style="--p: 0.63">
  <span class="st-eyebrow">Syncing / 同步中</span><span class="st-field">063%</span><i></i>
</div>
<div class="st-progress is-unknown" role="progressbar" aria-label="正在连接">…<i></i></div>
<span class="st-skeleton line"></span>
```

24 格的分段条，走到的格是紫色（进度走到哪），读数补零。不知道进度时加 `.is-unknown`，一段紫格从左往右走，完成后换成有数的或者移除。不用转圈。骨架屏是浅灰块，不闪光。

## 对话框 `.st-dialog`

```html
<dialog class="st-dialog" id="confirm" aria-labelledby="confirm-title">
  <div class="st-panel cut-br">
    <p class="st-eyebrow slash">Confirm</p>
    <h2 id="confirm-title">删除这条评论？</h2>
    <p>示例读者#0001 的评论会被永久删除，不能恢复。</p>
    <p class="st-actions"><button class="st-btn small" type="button" data-close>取消</button><button class="st-btn small danger" type="button" data-close="delete">删除</button></p>
  </div>
</dialog>
```

就是一块看板：顶边粗墨页签、右下切角。眉标加中文问题，一句说明后果的话，右下两个小按钮，确认在右。用原生 `<dialog>`，焦点圈在里面、Esc 能关、背后的页面不能点。`dialog.returnValue` 是被点的那个 `data-close` 的值。

## 侧面板 `.st-drawer` 和操作行 `.st-act`

```html
<button class="st-btn small" type="button" data-open="detail">详情</button>

<dialog class="st-drawer" id="detail" aria-labelledby="detail-title">
  <div class="body">
    <header>
      <span class="st-pair" id="detail-title"><span class="st-eyebrow slash">No.023 / Actions</span><span>赤道仪的极轴校准</span></span>
      <button class="st-btn small" type="button" data-close>关闭</button>
    </header>
    <button class="st-act" type="button" data-close="open"><span>打开</span><span class="st-field">9,102 字</span></button>
    <button class="st-act danger" type="button" data-close="delete"><span>删除</span></button>
    <p class="st-actions"><button class="st-btn go" type="button" data-close="publish">发布</button><button class="st-btn" type="button" data-close>取消</button></p>
  </div>
</dialog>
```

桌面上的侧面板：贴着窗口右边、满高，宽约 28rem，从右边推入。用来看一条记录的详情或对它做操作，不用离开列表。顶部一条 5px 墨线，标题区是中英成对加"关闭"按钮，底部一排按钮。

`.st-act` 是面板里每行一个操作：上面细线，右边可放字段，末尾 `›`；指向时底色变纸色。删除那行字是红色。

## 打开与关闭：`wireDialogs()`

```html
<script type="module">
  import { wireDialogs } from '../assets/fx.js';
  wireDialogs(); // data-open 打开，data-close / Esc / 点遮罩关闭，都带进出动效
</script>
```

## 提示条 `toast()`

```js
import { toast } from '../assets/fx.js';
toast('设置已保存。');
```

深色条（两套主题都深）、左边 6px 荧光绿条、一句话，出现在窗口左下角；从左擦入，2 秒后向右擦掉，`role="status"` 会被读屏读出。错误不用它，用 `.st-notice`。

## 数据表 `.st-table`

```html
<div class="st-table-wrap">
  <table class="st-table">
    <thead><tr><th>天体</th><th class="num">次数</th></tr></thead>
    <tbody><tr><td>示例：M31</td><td class="num">4</td></tr></tbody>
  </table>
</div>
```

表头是眉标样式加墨线，行间细线，数字右对齐、等宽数字，没有斑马纹；指向的行左边出现紫色色条。宽表放进 `.st-table-wrap` 横向滚动。

## 柱图 `.st-bars`

```html
<ol class="st-bars" aria-label="最近 7 天的访问">
  <li style="--v: 0.4"><span>10.11</span></li>
  <li style="--v: 0.95" class="is-over"><span>10.14</span></li>
  <li style="--v: 0.48" class="is-here"><span>10.17</span></li>
</ol>
```

灰柱；指向的或 `.is-here`（今天、当前）的那根变成紫色；超过阈值的在顶上挂一个荧光绿小方块（`.is-over`）。不用红绿、不用渐变。给它一个 `aria-label`，数值另外写在表格或文字里。

## 星点底纹 `.st-stars`

放在 `<body>` 上。右上角一大片、左下角一小片极淡的星图：按星等分大小的圆点、一两组稀疏的星座连线、几段赤纬圈和时圈的弧。墨色 16%，SVG 里的线条本身还更淡，并向边缘渐隐。图是 `assets/stars/stars-a.svg`、`stars-b.svg`，样式里用作遮罩，所以颜色跟随主题。用 `assets/stars/draw-stars.mjs` 改种子就能生成新的一组（`node draw-stars.mjs`，同一个种子永远得到同一张图）。

换底纹用 `<html data-st-ground="chart|hatch|plain">`：`chart` 是右上角极淡的同心弧，`hatch` 是两角的斜线纹，`plain` 是什么都没有。

不要：铺满全屏、加深、让它动、在上面加坐标数字或十字准星、压在正文下面。

---

## 进出和状态的小函数（`fx.js`）

| 函数 | 做什么 |
| --- | --- |
| `wireReadouts()` | `data-fx-load` 的数字在打开页面时乱码后落定；`data-fx-host` 被指向时，里面的 `data-fx` 重新落定一次 |
| `wireTheme()` | `data-theme-toggle` 按钮切换深浅、记住选择、同步 `aria-pressed`、从按钮处圆形揭幕 |
| `wireParallax(el)` | 指针在元素上移动时设 `--mx` / `--my`，给画框做视差 |
| `wireDialogs()` / `closeDialog(d)` | 侧面板和对话框的进出动效、Esc、点遮罩 |
| `toast(text, ms)` | 提示条 |
| `removeRow(li)` | 一行向右擦掉，下面的行用 transform 补位 |
| `flashDone(btn, label)` | 去掉 `aria-busy`，荧光绿穿过按钮一次，可选地短暂换字 |
| `scramble(el, ms)` | 单独让一个元素的数字乱码后落定 |

`.st-in-wipe`（从左擦入）和 `.st-out-wipe`（向右擦掉）两个类也可以直接用。时长和曲线见 `motion.md`。
