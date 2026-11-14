# 棱镜嵌套图形操作系统（Nested OS）

基于 Electron 45.2.1 与 Three.js 构建的桌面端递归嵌套图形操作系统。

## 启动方式

在项目根目录执行：

```bash
npm start
```

支持自动化与评测命令行参数：

```bash
npm start -- --data-dir ./tmp-data --width 1600 --height 960 --remote-debugging-port=19106
```

- `--data-dir <path>`：指定独立的持久化运行数据目录（不修改项目源码目录）
- `--width <px>` / `--height <px>`：指定主窗口客户区初始宽高（最高自适应 3840×2160）
- `--remote-debugging-port=<port>`：开启 Chromium 远程调试端口（开发与自动化检查端口约定 `19106`）

## 核心架构概览

- **真实内核与系统程序（NosLang + NosVM）**：根系统之下的每一级子系统均作为父系统的承载进程运行 `/Subsystems/<id>/kernel.nos`，进程表、抢占式分片调度、虚拟时钟唤醒、IPC 消息投递、VFS 虚拟文件系统、系统调用分发、自举编译器（`/System/compiler.nos`）、窗口管理器（`/System/wm.nos`）、文件管理器、编辑器、进程管理器、三维场景三进程组、闭环飞控进程与图表双进程组全部作为真实 `.nos` 程序在确定性字节码虚拟机 `NosVM` 中受逐级预算与内存/存储配额约束运行。
- **单 WebGL 2 上下文无限多视口渲染设备**：宿主显示设备使用单一共享 `THREE.WebGLRenderer` 进行实时光栅化与实时阴影计算，按需合成至任意层级裁剪窗口与跨层投送视口，突破 Chromium 16 个活跃 WebGL 上下文上限并支持上下文丢失无损恢复。
- **完整中文说明**：启动后双击根系统桌面上的 **《操作说明.md》** 即可查阅完整语法、系统调用、内核修改、飞控接口与场景格式文档（源文件位于 `fixtures/docs/操作说明.md`）。
