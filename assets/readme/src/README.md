# README 配图源文件

风格来自 `website/stellar-ui-skill/`（星辰风味），浅色主题，纸色底。`hero`、`weights`、`overview-how`、`score-pipeline` 是按新风格重做的样板，其余图照它们改。

## 用法

- `python assets\readme\src\render.py <名字…>`：把 `figs\<名字>.html` 渲染成 `assets\readme\<名字>.png`（2 倍）；不给名字就渲染全部。
- 也可以给任意 `.html` 路径，PNG 写在它旁边，例如 `render.py assets\readme\src\icons-preview.html`。
- 每张图在 `<head>` 里写 `<meta name="size" content="960xH">`：宽 960，高按内容定；链接 `../tokens.css`，颜色、字体和公共样式只从它取。

## 规则

- **画布**：`.frame` 铺满纸色 `--paper`，直角，没有边框、圆角、投影和渐变。
- **抬头**：`.head` 里放 `.pair`（`.eyebrow.slash` 英文眉标 + `.title` 中文粗体标题）和 `.lead`（一条细线，末端一颗四角星），下面一句 `.desc`。眉标是中文标题的直译，宽体大写。
- **中性色占大头**：纸 `--paper`、白板 `--panel`、墨 `--ink`、次要字 `--ink-2`、细线 `--rule`、浅填充 `--chip`；`--ink-3` 只画刻度，不写字。
- **有色部分紫 6、荧光绿 3、星光青 1**（整套图合起来看）。色阶和依据见 `website/docs/visual.md`。
- **紫族**（`--violet` 即 500，`--violet-100/300/600/800`）：`//` 标记、页签、空心大字、主动设计题的数据；普通量用 `--violet-300`（`.c-soft` 还是旧的 `--violet-soft`）。紫 500 只写大字（≥ 24px，或 ≥ 18.66px 粗体），小字用 `--violet-800`。一张图至多一整块紫 500。
- **荧光绿族**（`--lime` 即 500，`--lime-100/300/600/800`）：标准评判题的数据、高亮（`.hi`、`.marker`，一张图一两处）、星光。可以有一条整宽的 `--lime-100` 色带标出一组。
- **星光青**（`--cyan`、`--cyan-100`、`--cyan-800`）：只给参考和基准（及格线、参考步数、平均、全场最高刻线）和首图光谱条，一张图至多一两处；线和字用 `--cyan-800`，区间底用 `--cyan-100`。
- **浅底上的亮色**：荧光绿 300/500/600 和青 500 只做填充，加 1px 墨边（`.edge`）或贴着墨色元素；写字、画细线改用 `--lime-800`、`--cyan-800`。紫和荧光绿不细线相贴、不等面积并排，相邻处隔纸色缝或墨线；不做紫绿渐变。
- **两类题**：标准评判题用荧光绿族，主动设计题用紫族。按类别上色时一律用 `var(--cat-<key>)`，各图一致；深浅交替，最浅到 300，不会像空条：

  | 标准评判题（加 `.edge` 墨边） | 色阶 | 主动设计题 | 色阶 |
  | --- | --- | --- | --- |
  | `--cat-reason` 数学推理 | 绿 600 | `--cat-interact` 复杂交互应用 | 紫 800 |
  | `--cat-algo` 算法竞赛 | 绿 300 | `--cat-game` 游戏设计与开发 | 紫 400 |
  | `--cat-spatial` 空间推理 | 绿 500 | `--cat-physics` 物理模拟 | 紫 600 |
  | | | `--cat-visual` 视觉设计与渲染 | 紫 300 |
  | | | `--cat-system` 系统架构与实现 | 紫 500 |

  段间留纸色缝。不分类别时标准评判题用 `--lime` 加 `.edge`，主动设计题用 `--violet`。
- **两类同图加形状**：标题或图例前，标准评判题放方块 `<i class="k std"></i>`，主动设计题放四角星 `<span class="star k des"></span>`。
- **最佳、第一名**：墨底标签（`.solid`）写荧光绿数字，旁边一颗荧光绿四角星；柱子本身不换色。`.c-best` 名字是旧的，不再表示最佳。
- **其余填充**：实心结果 `.c-ink`、`.solid`（墨底白字）；空槽 `.c-track`；低于及格线、未出分、评测中用 `.c-hatch` 或中性灰，不用彩色。图例用 `.legend`。
- **类别名**：靠图标 `<img class="icon" src="../../icon-<key>.svg">`（紫色）和名字。
- **字**：Saira（`fonts/`，SIL OFL）配系统中文黑体（Noto Sans SC）。标签、标题、数字用界面字体（默认）；整句用 `.desc` 或 `--font-text`。数字用 `.num`、`.field`、`.fig`（等宽数字）；几个字段并列用 `.facts`（竖线分隔），不用 `·`。
- **线和块**：1px 细线分区；连线是 1px 墨线、直角转弯，到达的一端画一颗四角星，不用箭头。块用白板 `.panel`（`.tab` 加一段紫页签），不用带边框的卡片。图里没有可点的东西，所以不切角；只有首图的紫色块带两个构图用的大切角。
- **星星一律四角星**：HTML 用 `<span class="star"></span>`（`width`/`height` 定大小，`color` 定颜色）；SVG 路径 `M x,y−r Q x+kr,y−kr x+r,y Q x+kr,y+kr x,y+r Q x−kr,y+kr x−r,y Q x−kr,y−kr x,y−r Z`，k = 0.0655。
- **只给首图的**：顶边光谱条 `.tri`、一整块紫色、角落的星图和轨道装饰（`decor/`，从 `website/decor/` 拷来）、几颗墨边荧光绿星光。其余图不加底纹和装饰。
- **数字都是真的**：内容和数字以 README 正文和原图为准，不编造。
- **量尺寸**：脚本要按元素位置画连线或对齐时，放进 `document.fonts.ready.then(...)`，否则按回退字体量，渲染出来会错位。
- **渲染后看图**：先按 README 宽度（约 880px）看整体，再放大看细节。

## 文件

| 文件 | 内容 |
| --- | --- |
| `tokens.css` | 变量和公共样式 |
| `fonts/` | Saira 可变字体和许可证 |
| `decor/` | 首图用的星图和轨道 |
| `figs/` | 每张图一个 html；`tasks-design-strip.css/js` 是 5 张设计题分值图共用的 |
| `icons-preview.html` | 8 个类别图标的预览，渲染成同目录的 `icons-preview.png` |

类别图标两份，图形相同：`assets/readme/icon-<key>.svg` 颜色写死为紫 `#9859FF`（README 和配图用），`website/icons/categories/<key>.svg` 用 `currentColor`（网页用）。改一份要同步另一份。key：reason、algo、spatial、interact、game、physics、visual、system。
