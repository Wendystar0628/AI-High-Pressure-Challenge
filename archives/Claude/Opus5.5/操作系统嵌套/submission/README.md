# Nest OS —— 嵌套图形操作系统

桌面端的嵌套图形操作系统。根系统提供日常桌面、电子表格、小组件和能访问真实网页的 Chromium 浏览器；系统内可以继续启动系统，形成多级桌面和并行分支。子系统由存放在父系统文件系统里的**内核程序**运行，调度、消息、文件、窗口管理、应用和编译器都是系统内可以修改的程序。

## 启动

```
npm install        # 安装 Electron 45.2.1（本机已备好时不用下载）
npm start          # 启动，打开根系统桌面
```

可选参数（`npm start -- ...`）：

| 参数 | 含义 |
|---|---|
| `--data-dir <目录>` | 独立的运行数据目录（根系统文件、设置、导出文件、浏览器数据都在这里） |
| `--width <n>` `--height <n>` | 主窗口客户区尺寸 |
| `--remote-debugging-port=<端口>` | 自动化连接端口 |

自动化约定见根目录 `automation.json`。详细操作与接口说明见 `docs/操作说明.md`（桌面“操作说明”图标、开始菜单都能打开）。

## 目录

```
main.cjs, preload.cjs      Electron 主进程（窗口、数据目录、网页视图隔离）
src/host/vm.js             程序执行环境：字节码 VM、计量、陷入、内存计量、快照编码
src/host/rootkernel.js     根系统内核与根文件系统（题面允许根系统由宿主实现）
src/host/device.js         显示与输入设备：节点树 → DOM，指针键盘 → 消息
src/host/gfx.js            三维显示设备：单一 WebGL 上下文，多视图拷贝到二维画布
src/root/                  根桌面与根应用
programs/system/           kernel.nest（子系统内核）、compiler.nest（自举编译器）、wm.nest（窗口管理器）
programs/apps/             子系统应用：文件、编辑器、进程管理、子系统管理、播放器、飞行、特效、图表
programs/lib/              系统接口封装、界面库、飞行模拟库
programs/flight/           飞控程序
programs/user/             预置示例程序
fixtures/rootfs/           初始根文件系统（程序源文件、预编译产物、场景、示例工作簿）
tools/                     开发工具：引导编译器、生成场景、壁纸、控制记录（运行期不使用）
```

修改 `programs/` 后运行 `npm run build:fixtures` 更新初始文件；在系统内修改文件则不需要，内核启动程序时按源文件和编译器哈希自动重新编译。

## 第三方内容

Electron（Chromium）与 Three.js（已打包到 `src/vendor/`）。图标、壁纸、场景模型与贴图都由本项目的工具生成。
