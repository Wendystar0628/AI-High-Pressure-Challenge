# 叠境操作系统 (Nested OS)

面向 Electron 与 Chromium 的多层递归可编程嵌套图形操作系统桌面项目，内置自托管脚本语言 NScript（含可修改自举编译器）、递归子系统内核与窗口管理器、数据驱动 Three.js 24 号紫金直升机三维飞行排演场、真实多标签 Chromium 浏览器、实时跨层图表工作台、跨层文件拖放以及整棵子树状态快照/恢复/分叉机制。

## 启动与命令行参数

```bash
npm start -- --data-dir "<dataDir>" --width 1440 --height 900 --remote-debugging-port=19106
```

- `--data-dir`：将桌面状态、应用数据、文件与 Chromium 缓存隔离持久化在该目录。
- `--width` / `--height`：主窗口初始内容尺寸（支持自适应缩放到 `3840x2160`）。
- `--remote-debugging-port`：Chromium DevTools / Playwright / CDP 自动化连接端口。

## 分层架构概览

1. **根系统 (`outer`)**
   - 自制矢量 SVG 桌面图标与程序化风光壁纸（无外部图片或 Windows 资源拷贝）。
   - 窗口管理器支持移动、8 向缩放、左/右半屏贴靠、最小化、最大化、恢复与关闭，全部可重排 `Z_ORDER`。
   - 原生应用：文件管理器（含 `/Documents`、`/Downloads`、`/Demo`、`/Systems`、`/RecycleBin` 与宿主机导入导出）、电子表格（公式引擎、DAG 重算、`#DIV/0!`/`#REF!`/`#CYCLE!`、实时工作簿发布）、小组件抽屉（时钟日历、倒计时秒表、便签、剪贴板历史、免打扰通知中心、快捷设置）、文本编辑器（可编辑 `/Systems/<id>/kernel.ns`）、任务管理器（预算与配额控制、独立展示 WebView）、个性化设置与中文使用手册。
   - 内嵌真实 Chromium 多标签浏览器（`<webview partition="persist:nested-browser">`，弹窗自动收敛为标签页，被遮挡时由主机层稳定裁剪与防穿透）。

2. **递归可编程子系统 (`inner-1`, `inner-2`, ...)**
   - 每个子系统以真实的 `/Systems/<id>/kernel.ns` 存在于父系统虚拟文件系统中，通过可抢占字节码虚拟机运行与隔离。
   - **自举编译器 (`/System/compiler.ns`)**：可打开源码修改并原地重建自身字节码。
   - **可编程窗口管理器 (`/System/wm.ns`)** 与应用：均可按源码修改，错误仅隔离在对应子系统。
   - **分层算力预算与配额**：步长工作量账本、内存/存储配额、暂停/单步/调速实时继承至全部后代子树。

3. **三维场景播放器与飞行排演 (`player_seq.ns` + `player_scene.ns` + `player_fx.ns` + `flight_ctrl.ns`)**
   - 单一共享离屏 Three.js WebGL2 渲染器（带自动 `webglcontextlost` 恢复），避免多视口上下文耗尽。
   - `/Demo/helicopter-24.scene` 数据驱动 24 号紫金涂装直升机、峡谷地形、双停机坪、风标塔台、风摇与下洗倒伏草地、颗粒特效，默认 15s 自动演艺（起飞 -> 掠过塔台 -> 尾桨故障黑烟火花先兆 -> 失控坠毁 -> 碎片翻滚静止）并支持无跳变转入闭环飞控排演、2 号停机坪悬停降落与 `.rehearsal` 录制重播。

4. **跨层窗口投送与实时图表同步**
   - 子系统内的三维播放器与图表工作台支持一键投送至根系统或任意上层祖先桌面；投送窗口外壳归目标桌面管理，输入转发与算力归源系统，画面实时共享渲染。
   - 图表工作台（`chart_recv.ns` + `chart_draw.ns`）订阅根系统电子表格，支持子树暂停期间增量积压交付、柱状图/折线图平滑动画、源关闭降级与快照恢复重连提示。

5. **整棵子树快照与分叉 (`.snap`)**
   - 保存包括多级内核与用户虚拟机调用栈、定时器、IPC 队列、3D 物理检查点、完整 VFS 及 UI 状态，支持原地恢复与无冲突新编号分叉。

## 自动化接口 (`window.bench` & DOM 标识)

- 清单文件：`automation.json`（version `1`）。
- 全局状态接口：`window.bench.version`、`await window.bench.ready()`、`await window.bench.reset()`、`await window.bench.inspect()`。
- 关键交互控件均标注 `data-testid`、`data-system-id`、`data-window-id` 及约定语义属性；网页容器 `<webview>` 直接以 Chrome WebView 上下文驱动，内部网页 DOM 不额外注入测试标识。
