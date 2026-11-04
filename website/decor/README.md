# 星辰装饰素材

成绩展示网站用的 SVG 装饰：8 类、57 个文件，全部由 `tools/draw-decor.mjs` 生成。配色、线宽和克制程度按 `../stellar-ui-skill/`（星辰风味 UI）来：线是 1px 细线，紫做线，荧光绿只点一颗星，**星星一律是四角星**，没有文字、数字、坐标和准星。

- 预览页：`index.html`（按类型列出全部差分、文件名和用途；可切深浅、可按建议浓度看）
- 截图：`preview-light.png`、`preview-dark.png`
- 生成脚本：`tools/draw-decor.mjs`

## 文件命名

`<类型>/<类型>-<构图>[-配色].svg`

| 后缀 | 配色 | 用法 |
| --- | --- | --- |
| 无 | 单色，全部 `currentColor`，靠不透明度分层 | 随文字颜色换色，浅深主题通用 |
| `-light` | 浅色主题双色：线 `#9859FF`，星 `#1A1726`，焦点星 `#D1FF57` 加 1px 墨边 | 只放在浅色底上 |
| `-dark` | 深色主题双色：线 `#9859FF`，星 `#ECEAF3`，焦点星 `#D1FF57`；背景星图里的星是荧光绿光点 | 只放在深色底上 |
| `-violet` | 紫底版：线和星是白色，焦点星 `#D1FF57` | 放在展示页那一块紫色上 |

每个文件都有 `viewBox`，`width`/`height` 是设计尺寸（1 个单位 = 1px，线宽 1px 就是按这个尺寸定的），按原尺寸或整数倍显示最准。渐隐用的遮罩 id 都以文件名开头，同一页内联多个文件也不会冲突。

## 类型清单

用途的说法：页面背景角落、页首横幅、标题装饰、看板装饰、分隔条、空状态、列表标记、主视觉、徽记。

### 四角星 `star/`（24×24，小图标）

| 文件 | 样子 | 用途 |
| --- | --- | --- |
| `star-solid` | 实心四角星 | 列表标记、标题装饰 |
| `star-outline` | 1.25px 描边 | 列表标记、空状态（"还没有"） |
| `star-ringed`（`-light` `-dark`） | 星外一圈细环；双色版环是紫、星是荧光绿 | 列表标记、徽记；双色版可标当前项 |
| `star-nested` | 描边大星套实心小星 | 标题装饰、徽记 |
| `star-cluster`（`-light` `-dark`，40×26） | 一大两小三颗星；双色版大星是荧光绿 | 标题装饰、空状态 |

### 星图底纹 `starfield/`

| 文件 | 尺寸 | 样子 | 用途 |
| --- | --- | --- | --- |
| `starfield-corner-tr`（`-light` `-dark`） | 720×540 | 右上角一大片星图：四角星、赤纬圈、时圈、一组星座，向左下渐隐 | 页面背景角落 |
| `starfield-corner-bl` | 560×420 | 左下角一小片，和上一片配对 | 页面背景角落 |
| `starfield-panel` | 320×200 | 稀疏的一小撮，锚在右上 | 看板装饰 |
| `starfield-band` | 1200×240 | 银河似的横带，两端渐隐 | 页首横幅、分隔条 |

### 星座连线 `constellation/`

| 文件 | 尺寸 | 样子 | 用途 |
| --- | --- | --- | --- |
| `constellation-mark`（`-light` `-dark`） | 200×140 | 七颗星的小星座，最亮一颗是焦点 | 标题装饰、空状态、徽记 |
| `constellation-corner-tl` | 480×360 | 左上角一组星座加零星暗星 | 页面背景角落、看板装饰 |
| `constellation-pair` | 640×200 | 左右两组星座 | 页首横幅、标题装饰 |
| `constellation-strip` | 960×56 | 横贯的一条星座 | 分隔条 |

### 星环轨道 `orbit/`

| 文件 | 尺寸 | 样子 | 用途 |
| --- | --- | --- | --- |
| `orbit-single`（`-light` `-dark`） | 480×160 | 一条扁轨道，骑一颗星 | 标题装饰、页首横幅 |
| `orbit-nested`（`-light` `-dark` `-violet`） | 340×180 | 中心一颗星、三层轨道、一颗行星、一颗小星 | 空状态、主视觉、徽记 |
| `orbit-corner-br` | 640×480 | 一组大轨道从右下角伸出 | 页面背景角落 |
| `orbit-divider` | 960×48 | 侧看的一道环：后半虚线、前半实线 | 分隔条 |

### 星轨 `trails/`

| 文件 | 尺寸 | 样子 | 用途 |
| --- | --- | --- | --- |
| `trails-corner-tr` | 720×540 | 天极在右上角外，星轨向左下扫开 | 页面背景角落 |
| `trails-corner-bl` | 560×420 | 稀疏一版，从左下角扫开 | 页面背景角落 |
| `trails-center`（`-light` `-dark`） | 320×320 | 天极在中心，一圈圈星轨，中心一颗星 | 空状态、徽记、主视觉 |
| `trails-wide` | 1200×200 | 天极在下方很远，星轨几乎是平的 | 页首横幅、分隔条 |

### 星盘刻度 `dial/`

| 文件 | 尺寸 | 样子 | 用途 |
| --- | --- | --- | --- |
| `dial-ring`（`-light` `-dark`） | 320×320 | 一整圈三档刻度、虚线内圈、上方一颗星；双色版多一道紫色括弧 | 看板装饰、空状态、徽记（围在头像或大数字外，不压字） |
| `dial-quarter-tr` | 480×480 | 以右上角为圆心的四分之一圈刻度 | 页面背景角落、看板装饰 |
| `dial-arc-wide` | 960×96 | 一段很大的弧，刻度朝下 | 页首横幅、分隔条 |
| `dial-ruler` | 960×24 | 直尺刻度，8px 一格，32px、128px 加长 | 分隔条 |

### 天球经纬 `sphere/`

| 文件 | 尺寸 | 样子 | 用途 |
| --- | --- | --- | --- |
| `sphere-globe` | 320×320 | 经纬各 30°，只画朝前的一半，北极一颗星 | 空状态、主视觉 |
| `sphere-armillary`（`-light` `-dark` `-violet`） | 360×300 | 天球外绕一道倾斜的环，环上一颗星 | 主视觉、空状态、徽记 |
| `sphere-corner-bl` | 560×560 | 从左下角露出的大天球 | 页面背景角落 |
| `sphere-horizon` | 1200×280 | 很大的天球从下沿升起，经线汇到北极的星 | 页首横幅、主视觉 |

### 星芒射线 `rays/`

| 文件 | 尺寸 | 样子 | 用途 |
| --- | --- | --- | --- |
| `rays-burst`（`-light` `-dark`） | 240×240 | 中心一颗星，四十道长短不一的射线 | 徽记（新纪录、最佳成绩）、空状态 |
| `rays-corner-tl` | 640×480 | 从左上角外射进来的光 | 页面背景角落、主视觉 |
| `rays-fan-up` | 720×240 | 下沿一颗星，射线向上扇开 | 标题装饰（颁奖、最佳成绩）、徽记 |
| `rays-divider`（`-light` `-dark`） | 960×48 | 中间一颗带短芒的星，两侧细线 | 分隔条 |

射线都从星外开始，避开横竖方向，不穿过星，不成十字。

## 配色规则

和星辰技能一致：

- **线是紫，星是墨或荧光绿。** 轨道、星座连线、星轨、射线这类主线用轨道紫 `#9859FF`；网格、刻度、经纬这类次要线用墨（深色用浅墨）。
- **荧光绿只点焦点那一颗星。** 浅色底上荧光绿看不见（白上 1.16:1），所以浅色版的焦点星加 1px 墨边；深色里荧光绿可以单独出现。背景星图（`starfield` 的深色版）里的星是荧光绿光点，那是整片底纹，用时要压得很淡。
- **两色不相贴。** 轨道、连线、星轨都在星前断开，紫线和荧光绿不碰在一起。
- **用量。** 一屏里紫约一成，荧光绿只做点缀：一页里双色装饰放一两处就够，其余用单色版。
- 单色版在网页里通常用墨或次要墨（`--st-ink`、`--st-ink-2`），背景类再压低不透明度。

建议浓度（预览页"按建议浓度看"就是这个）：

| 类别 | 文件 | 不透明度 |
| --- | --- | --- |
| 背景 | `*-corner-*`（`constellation-corner-tl` 除外）、`starfield-band` | 约 0.2（和技能的星图底纹一样淡） |
| 装饰 | `starfield-panel`、`constellation-corner-tl`、`trails-wide`、`dial-quarter-tr`、`sphere-horizon`、`rays-fan-up` | 约 0.5 |
| 标记 | 其余 | 1 |

背景类只放在页面两角、内容下面（`z-index: -1`、`pointer-events: none`），向内容一侧渐隐，不铺满全屏、不压正文、不动。

## 在网页里用

**`<img>`**：最省事，但 `currentColor` 在图片里会变成黑色，所以单色版要么接受黑色，要么换用写死颜色的双色版。装饰图写空的 `alt`。

```html
<img src="decor/orbit/orbit-single-light.svg" alt="" width="480" height="160" />
```

**内联**：把 SVG 源码贴进页面，单色版随父元素的 `color` 换色，深浅主题自动跟着变。文件里已经有 `aria-hidden="true"`。

```html
<h2 class="title">
  <span>本月最佳</span>
  <span class="deco" style="color: var(--st-ink-2)"><!-- 贴 star/star-cluster.svg 的内容 --></span>
</h2>
```

**CSS `mask`**：把单色版当遮罩，颜色由 `background` 决定，换主题只改变量。背景角落推荐这种写法（和技能里 `.st-stars` 的做法一样）：

```css
.page::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: color-mix(in srgb, var(--st-ink) 20%, transparent);
  -webkit-mask: url('decor/trails/trails-corner-tr.svg') right top / 45rem auto no-repeat;
  mask: url('decor/trails/trails-corner-tr.svg') right top / 45rem auto no-repeat;
}
.divider {
  height: 48px;
  background: var(--st-ink-2);
  -webkit-mask: url('decor/orbit/orbit-divider.svg') center / contain no-repeat;
  mask: url('decor/orbit/orbit-divider.svg') center / contain no-repeat;
}
```

遮罩要求页面经 http 打开（浏览器不让 `file://` 页面拿本地 SVG 当遮罩）。双色版不能当遮罩用（遮罩只看透明度），用 `<img>` 或内联。

## 重新生成

```sh
cd website/decor/tools
node draw-decor.mjs
```

不依赖外部包（Node 18 以上）。它会清掉各类型文件夹里旧的 `.svg`，重画全部文件，再生成 `index.html`。同一组种子永远画出同一组文件。

- 换一个差分：改脚本里 `TYPES` 中那一项的 `seed`（星的位置、星座的形状、星轨和射线的长短都跟着变）或参数（`count` 数量、`pole` 天极位置、`circles` 赤纬圈、`fade` 渐隐方向、`tilt` 天球倾角……）。
- 加一个差分：在对应类型的 `variants` 里加一项，写好 `name`、`w`、`h`、`uses`、`note`；要双色版就加 `palettes: ['light', 'dark']`（紫底版加 `'violet'`）。
- 四角星的画法在 `star()`，星等的大小在 `MAG`，和 `stellar-ui-skill/assets/stars/draw-stars.mjs` 是同一套。

预览页引用了 `../stellar-ui-skill/assets/stellar.css` 和其中的 Saira 字体，直接双击也能看（SVG 都是内联的），用本地服务器看字体更准：

```sh
cd website
python -m http.server 8772
# 打开 http://127.0.0.1:8772/decor/index.html，?theme=dark 看深色，?weak=1 按建议浓度看
```

截图用本机无窗口 Chrome（页面高约 11560px）：

```sh
chrome --headless=new --hide-scrollbars --window-size=1280,11560 --screenshot=preview-light.png "http://127.0.0.1:8772/decor/index.html?theme=light"
chrome --headless=new --hide-scrollbars --window-size=1280,11560 --screenshot=preview-dark.png "http://127.0.0.1:8772/decor/index.html?theme=dark"
```
