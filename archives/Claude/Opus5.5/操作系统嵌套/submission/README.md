# Nested OS · 嵌套图形操作系统

一个运行在 Electron 中的嵌套图形操作系统：根系统提供日常桌面（文件管理器、电子表格、小组件、编辑器、任务管理器、设置、Chromium 浏览器），系统内可以继续启动子系统，形成多级桌面与并行分支的系统树。子系统的内核、窗口管理与全部应用都是存放在文件系统里的 **Nest 程序**，由系统内的编译器编译、在逐级拨付的预算下运行。

## 启动

需要 Node.js（已测试 24.x）。本机已备好 Electron 45.2.1：

```bash
npm install          # 安装 electron@45.2.1 与 three（three 已复制到 src/vendor，可离线运行）
npm start            # 等价于 electron .
```

启动参数（均可选）：

| 参数 | 说明 |
|---|---|
| `--data-dir <目录>` | 独立的测试数据目录（根系统文件、子系统磁盘、设置、浏览器数据）。缺省为 Electron 用户数据目录下的 `nested-os-data`，不会写回项目源码目录 |
| `--width <像素>` `--height <像素>` | 主窗口客户区尺寸（缺省 1600×940，支持到 3840×2160） |
| `--remote-debugging-port=<端口>` | Chrome DevTools 协议端口，供自动化连接 |

示例：`npm start -- --data-dir D:\nest-data --width 1920 --height 1080 --remote-debugging-port=19106`

首次启动会用系统内的编译器程序预编译全部预置程序，生成 `build/image-*.json`（`system/` 下的源文件更新后自动重新构建）。

## 自动化

- 根目录 `automation.json` 记录启动命令、主窗口定位方式和素材路径。
- 主页面提供 `window.bench`：`version`、`ready()`、`reset()`、`inspect()`。
- 关键控件带 `data-testid`、`data-system-id`、`data-window-id`（窗口容器另有 `data-app-id`）。子系统界面同样渲染为主页面中的 DOM 节点，可直接定位。

## 目录

| 路径 | 内容 |
|---|---|
| `main.js` `preload.cjs` | Electron 主进程（窗口、`app://` 协议、数据目录、本机文件对话框） |
| `src/vm/` | Nest 虚拟机（计量执行、`exec` 嵌套执行、上下文序列化）与引导编译器（仅构建时首次编译 compiler.nest） |
| `src/host/` | 根系统（宿主实现）：调度、系统调用、子系统承载、信封路由、快照、实时数据服务；根文件系统 |
| `src/device/` | 显示设备：二维显示列表渲染（DOM）与三维场景设备（Three.js，单一 WebGL 上下文） |
| `src/ui/` `src/apps/` | 根系统桌面与应用 |
| `system/common/` | 各层共有的系统文件：`System/kernel.nest`（内核模板）、`System/compiler.nest`（编译器）、`System/lib/*.nest`、示例程序、飞控程序、场景资源 |
| `system/inner/` | 子系统专有文件：`System/wm.nest`（窗口管理）、`Apps/*.nest`（文件管理器、编辑器、进程管理器、播放器、图表工作台） |
| `system/root/` | 根系统专有文件（示例工作簿） |
| `tools/` | 构建工具：系统映像、场景资源生成、默认演出记录生成（导演程序也是 Nest 程序） |
| `assets/wallpapers/` | 自制风景壁纸（SVG） |

完整的操作说明（程序格式、系统接口、内核源文件位置与修改方法、飞控接口、计量、场景与工作簿格式、排演记录、数据连接、投送与操作方法）见 `system/common/System/操作说明.md`，也可以在桌面上双击“操作说明”打开。
