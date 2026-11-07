# 操作系统嵌套 · 启动说明

一个 Windows 桌面端的递归图形操作系统：根系统提供日常桌面、电子表格、小组件与真实联网的 Chromium 浏览器；系统内可继续启动系统，形成多级桌面与并行分支的系统树。子系统由父系统文件系统里的内核程序运行，全部程序在逐级拨付的共享预算下竞争。

## 启动

环境已备好 Electron 45.2.1 与 three.js 0.160.0（随项目 `node_modules` 交付，离线可运行）。

```
npm start
```

根目录 `package.json` 的 `start` 为唯一启动入口（`electron .`）。支持的启动参数：

```
npm start -- --data-dir <独立数据目录> --width <宽> --height <高> --remote-debugging-port=<端口>
```

- `--data-dir`：独立测试数据目录，运行数据写入其中的 `state.json`，不写回项目源码目录；不同目录相互独立。
- `--width` / `--height`：主窗口客户区尺寸（作品自适应，最高支持 3840×2160）。
- `--remote-debugging-port`：Electron 原生 CDP 调试端口；录制与评测约定使用 19106。
- 开发期如需本地网页服务器，使用 18106 端口；本作品不需要额外手动开启服务。

主窗口标题为 `Nested OS`。自动化约定见根目录 `automation.json`。

## 主桌面渲染上下文接口

```js
window.bench.version        // 1
await window.bench.ready()  // 桌面已呈现并可操作
await window.bench.reset()  // 在当前 data-dir 内恢复初态，完成后桌面已呈现
await window.bench.inspect()// 返回 systems/windows/browsers/players/charts/projections
```

`window.__nested` 提供 `engine / ui / runtime / gfx` 便于开发检查。所有自制控件使用稳定 `data-testid`，标注 `data-system-id`；窗口容器标注 `data-window-id` 与 `data-app-id`。

## 快速上手

1. 默认显示根系统桌面（`outer`）。开始菜单 / 桌面图标 / 任务栏可启动文件管理器、电子表格、桌面小组件、编辑器、任务管理器、设置、浏览器。
2. 从「子系统管理」（开始菜单 `launch-system` 或桌面图标）点击「新建直属子系统」创建 `inner-1`……每层都能继续创建，支持四层以上。子系统桌面完整位于父系统的系统窗口内。
3. 子系统默认打开三维场景播放器（`player`）：播放/暂停/逐帧/跳转/调速/镜头切换，另有飞行排演与记录回放；图表工作台（`charts`）可连接根系统电子表格建立实时数据连接；播放器与图表都可以「窗口投送」到任一祖先桌面。
4. 右键桌面空白处查看菜单（按 `Esc` 收起）；窗口标题栏可拖动、双击最大化、拖到左右边缘半屏贴靠；任务栏可切换/最小化/恢复窗口。
5. 按 `F1` 或开始菜单「操作说明」打开完整说明（程序格式、系统接口、内核源文件位置与修改方法、飞控接口、预算与配额计量、场景资源与工作簿格式、排演记录、数据连接与投送规则）。

## 目录

- `main.js` — Electron 主进程（启动参数、CDP、文件对话框、webview 新窗口处理、遮挡与后台节流设置）
- `index.html` / `style.css` / `assets/wallpaper.svg` — 桌面承载与自制美术
- `src/engine.js` — 系统树、逻辑步、共享预算与逐级拨付、虚拟时间、快照/恢复/分叉、投送、连接、持久化、inspect
- `src/vm.js` — 自定义程序语言、编译器/解析器、CPU 与进程状态
- `src/programs.js` — 内核程序、编译器程序、示例程序、飞控、播放器协作进程、图表协作进程（均作为系统内文件随项目交付）
- `src/vfs.js` — 每系统独立虚拟文件系统与回收站
- `src/runtime.js` — 应用状态、电子表格公式与重算、实时数据连接、小组件、文件/编辑器/浏览器/播放器动作
- `src/scene.js` — 场景资源（纯数据）与确定性状态演化、飞行物理、记录
- `src/gfx.js` — WebGL 2（three.js）显示设备：单上下文、多视图、遮挡与上下文丢失恢复、图表二维绘制
- `src/ui.js` / `src/apps-ui.js` — 递归桌面、窗口系统、各层应用界面与自动化标识
- `src/docs.js` — 可从桌面打开的操作说明
- `automation.json` — 自动化约定与素材清单

## 录制主线所需素材（均在虚拟文件系统内）

- 根系统 `/Demo/sample.sheet`（示例工作簿，`A1:D4` D 列为公式）、`/Demo/helicopter-24.scene`（用于跨层传递的场景源文件）、`/Recycle Bin/deleted-note.txt`（预置已删除文件）。
- 各子系统 `/Demo/helicopter-24.scene` 预置场景副本、`/System/kernel.prog` 内核模板、`/System/compiler.prog` 编译器、`/System/controller.prog` 飞控程序、`/System/programs/*.prog` 应用协作进程。
- 逻辑步：1 倍速下 0.1 虚拟秒 / 步，实际间隔 100 ms；根系统每步预算 1800 单位，逐级递减。
