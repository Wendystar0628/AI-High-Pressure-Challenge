# 接入网页

起点：`assets/stellar.css`（部件）、`assets/fx.js`（小动效、深浅切换）、`assets/dial.js`（控制台星盘）、`assets/variant.js`（外观设置）、`assets/stars/`（星点底纹），以及 `templates/` 里的模板。不依赖任何框架。只做桌面网页。

## 接入

1. 把 `assets/` 整个复制进项目（`stellar.css` 用相对路径引用 `./stars/`，两者要放在一起）。
2. 字体自托管（见 `tokens.md`），二选一：

   ```css
   /* 用 npm 包 */
   @import '@fontsource-variable/saira/standard.css'; /* 含宽度轴 */
   @import '@fontsource-variable/noto-sans-sc/wght.css';
   @import './stellar.css';
   ```

   ```css
   /* 或者用随包附带的 assets/fonts/Saira.ttf（许可证 Saira-OFL.txt 一起带上） */
   @font-face {
     font-family: 'Saira';
     src: url('./fonts/Saira.ttf') format('truetype');
     font-weight: 100 900;
     font-stretch: 50% 125%;
     font-display: swap;
   }
   ```

   中文用 `@fontsource-variable/noto-sans-sc`，或者直接落到系统黑体。

3. 页面骨架：

   ```html
   <!-- 外观写在 <html> 上，见 variation.md -->
   <html lang="zh-CN" data-st-paper="cool" data-st-cut="tight" data-st-ground="chart">
     <head>
       <!-- 先写好主题，避免闪烁；也可以直接引用 assets/variant.js -->
       <script>
         try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
       </script>
       <meta name="theme-color" content="#F2F1F6" media="(prefers-color-scheme: light)" />
       <meta name="theme-color" content="#121019" media="(prefers-color-scheme: dark)" />
       <link rel="stylesheet" href="./assets/stellar.css" />
     </head>
     <body class="st st-stars">
       <div class="st-tri" aria-hidden="true"><i></i><i></i><i></i></div>
       …
       <script type="module">
         import { wireTheme, wireReadouts } from './assets/fx.js';
         wireTheme();
         wireReadouts();
       </script>
     </body>
   </html>
   ```

   如果内容安全策略不允许内联脚本，把这两段放进外部文件。

4. 外观只在 `<html>` 上设置一次：`data-st-paper`、`data-st-cut`、`data-st-ground`、`data-st-density`、`data-st-motion`，或者写一个 `data-st-variant` 预设，再在 `<head>` 里引用 `assets/variant.js`（它还能从地址读 `?variant=` 和 `?theme=`，方便对比）。两种主题色 `--st-orbit`、`--st-flare` 不随产品换。
5. 部件怎么写、怎么组合，参考模板：阅读 `templates/reading.html`、展示 `templates/showcase.html`、控制台 `templates/console.html`；全部部件 `templates/specimen.html`；动效对照 `templates/motion.html`。版式按自己的内容排，不照搬模板的结构和占位内容。页面自己的 `<style>` 只写布局（grid、间距），颜色、字、部件全部用 `st-` 类和 `--st-*` 变量。

模板要用静态服务器打开（浏览器不允许从 `file://` 加载 ES 模块）：在 skill 目录运行 `python3 -m http.server 8766`，打开 `http://localhost:8766/templates/showcase.html`。

## 在框架里用

- **React / Vue / Svelte / Astro**：直接写类名（`className="st-btn go"`）。把 `stellar.css` 作为全局样式引入一次，`stars/` 跟着放。`fx.js` 的函数在组件挂载后调用（`useEffect` / `onMounted`），传入组件根节点；`dial.js` 的 `drawDial()` 同样在挂载后调用。
- **Tailwind**：保留 `stellar.css` 做部件，用 token 扩展主题，布局用 Tailwind：

  ```js
  // tailwind.config.js
  export default {
    theme: {
      extend: {
        colors: {
          paper: 'var(--st-paper)', panel: 'var(--st-panel)', ink: 'var(--st-ink)', 'ink-2': 'var(--st-ink-2)',
          rule: 'var(--st-rule)', chip: 'var(--st-chip)', orbit: 'var(--st-orbit)', flare: 'var(--st-flare)',
        },
        fontFamily: { ui: 'var(--st-font-ui)', text: 'var(--st-font-text)' },
        borderRadius: { DEFAULT: '0', none: '0' },
        boxShadow: { DEFAULT: 'none' },
      },
    },
  };
  ```

  然后把默认的 `rounded-*`、`shadow-*` 当成禁用词；`text-flare`、`border-flare` 也不要写（荧光绿只做填充），`text-orbit` 只给大字。

- **组件库**（MUI、Ant Design、Element、shadcn/ui 等）：把圆角设为 0、关掉阴影和涟漪；**主色设为墨 `#1A1726`**，不是紫也不是荧光绿——组件库会用主色画光标、焦点线、复选框和小字，紫色写小字不够清楚，荧光绿画线看不见。两种主题色在 `st-` 部件里手动用。按钮、标签、表格换成 `st-` 部件更省事。Ant Design：`token: { borderRadius: 0, colorPrimary: '#1A1726', boxShadow: 'none', fontFamily: 'var(--st-font-ui)' }`。

## 网页上的细节

- **焦点**：`.st` 下所有可聚焦元素有 2px、颜色跟随文字（`currentColor`）的焦点框，所以在深色命令栏和滚动条上也看得见；输入框聚焦加一圈紫色。切角按钮的焦点框向内缩 4px，不会被切掉。
- **换页快门**：`stellar.css` 自带同源 `@view-transition`，新页面被一扇斜切快门推入。不想要就删掉那一段。
- **链接**：正文链接墨字压荧光绿下划块；深色里改成 2px 荧光绿细条。正文以外的链接不加下划线，靠位置和切角说明能点。
- **表格**：列表用 `.st-records` 或 `.st-rows`；真正的数据表用 `<table class="st-table">`：表头是眉标样式，行间细线，数字右对齐用等宽数字，没有斑马纹，指向的行左边出现紫条。
- **图表**：灰色柱和线；当前或指向的那一项用紫色；超阈值的点用荧光绿小方块（带墨色细边）标记。不用红绿、不用渐变填充。简单柱图用 `.st-bars`；用图表库时照这几条改它的配色，并把数值另外写在表格或文字里。
- **滚动条**：可以把 `scrollbar-color` 设成 `var(--st-rule) transparent`，细而直角。
- **点击区域**：按钮、行、导航项至少 32px 高（WCAG 2.5.8 要求 24px）。

## 验收

- 1024、1280、1440、1920 四个宽度，浅深两套，都没有横向滚动。
- 开系统的"减少动态效果"后一切静止，内容完整。
- 键盘 Tab 走一遍：焦点框都看得见，顺序合理；读屏能读出当前项（`aria-current`、`aria-pressed`）。
- 背景星点只在两角，不压在正文下面。
