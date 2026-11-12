# Nested OS — 嵌套图形操作系统

递归系统树桌面环境：根系统提供日常桌面、电子表格、小组件、浏览器与三维播放器；系统内可以继续启动系统，形成多级桌面。子系统由父系统文件系统中的内核程序运行，调度、消息、文件、窗口管理都是系统自己运行的程序。

## 启动

```bash
npm install        # 首次运行（electron@45.2.1 与 three 本地已备好）
npm start
```

支持的启动参数：

| 参数 | 说明 |
|---|---|
| `--data-dir <path>` | 指定独立测试数据目录（运行数据不写回源码目录） |
| `--width <n>` | 主窗口客户区宽度 |
| `--height <n>` | 主窗口客户区高度 |
| `--remote-debugging-port=<p>` | 远程调试端口（默认 19106） |

示例：

```bash
npm start -- --data-dir C:\tmp\nos-test --width 1600 --height 1000 --remote-debugging-port=19106
```

## 项目结构

```
main.js                  Electron 主进程（窗口、--data-dir、导入导出对话框）
preload.js               安全桥
automation.json          录制约定（启动命令、素材路径、控件标识）
app/
  index.html             主窗口页面
  css/                   设计语言（桌面、窗口、应用）
  js/
    boot.js              入口
    utils.js             工具
    vfs.js               每系统独立的虚拟文件系统
    vm/ks.js             KernelScript：词法、语法、可挂起解释器
    host/
      wallpaper.js       程序生成壁纸与图标
      display.js         二维显示设备（命令 → Canvas）
      scheduler.js       逻辑步预算与调度
      bench.js           window.bench 自动化接口
    root/
      root.js            根系统桌面（宿主实现）
      window.js          窗口管理（拖动、缩放、贴靠、最大化）
      projection.js      跨层窗口投送
      apps/              根系统应用（文件、表格、编辑器、设置、任务、浏览器、播放器、图表、帮助）
    sub/
      instance.js        子系统实例（承载进程执行内核程序）
      kernel-src.js      预置内核程序与应用程序（KernelScript 源码）
    scene/
      heli-scene.js      24 号直升机场景资源与演出求值
      flight.js          飞行动力学（排演）
      scene3d.js         三维显示设备（Three.js）
```

## 核心机制

### KernelScript（KS）
类 JavaScript 的程序格式，支持变量、函数、条件、循环、数组与对象。
系统服务通过 `sys.*` / `kern.*` 取得。程序可在编辑器中编辑、运行、保存。

### 内核程序
每个子系统由父系统文件系统中的 `kernel.ks` 运行，实现：
- 进程表与调度（round-robin，可改写）
- 消息投递（带收件人身份，可改写规则）
- 文件系统（存储读写，可改写行为）
- 系统调用分发
- 窗口管理（层叠、焦点、命中判断、输入分发）
- 显示提交（二维图形 / 三维场景）

**修改内核源文件并重启子系统后，系统按新规则运行。**

### 共享资源与预算
每系统每逻辑步有总执行预算（指令单位），内核、程序、应用服务与子系统承载进程共同竞争。
任务管理器显示实际消耗，可调整总预算与拨付。

### 三维播放器与飞行排演
- 默认演出：24 号直升机起飞—失控—坠毁（15 秒，可跳转/逐帧/调速）
- 飞行排演：不稳定的被控对象，飞控程序（flightctl.ks）经系统接口保持飞行
- 预算/调度/时间速率影响飞行；可保存排演记录并回放

### 跨层投送与实时数据
播放器与图表可投送到祖先桌面；图表从根系统电子表格建立实时数据连接。

### 子树快照、恢复与分叉
保存整棵子树的运行状态，恢复或分叉出独立新子树。

## 操作说明
从桌面「操作说明」图标或开始菜单打开完整操作说明（含 KS 语法、系统接口、飞控接口、预算计量说明）。

## 录制约定
见 `automation.json`。主窗口标题为 `Nested OS`。`window.bench` 提供 `ready/reset/inspect` 接口。
