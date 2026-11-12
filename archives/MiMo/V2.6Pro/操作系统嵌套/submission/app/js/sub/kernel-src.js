/* kernel-src.js — default KernelScript sources for subsystems.
   These are real programs that run inside each subsystem. They can be edited
   from the parent system's editor and take effect after a restart. */

export const DEFAULT_KERNEL_SRC = `// Nested OS — 内核程序 (kernel.ks)
// 本程序是子系统的内核：进程表、调度、消息、文件、显示与输入分发。
// 修改本文件并重启子系统后，系统按新规则运行。

let procs = [];
let nextPid = 1;
let syscallQueue = [];
let msgQueues = {};
let stepCount = 0;
let windowList = [];
let focusedWindow = 0;
let nextWinId = 1;
let inputQueue = [];
let displayFrame = [];
let desktopCmds = [];
let wmState = { menuOpen: 0, dragWin: 0, dragX: 0, dragY: 0, dragOffX: 0, dragOffY: 0, snapSide: 0 };
let tickSize = 16;

fn log2() {
  kern.log("kernel step", stepCount);
}

fn findProc(pid) {
  let i = 0;
  while (i < procs.length) {
    if (procs[i].pid == pid) {
      return procs[i];
    }
    i = i + 1;
  }
  return null;
}

fn makePid() {
  let p = nextPid;
  nextPid = nextPid + 1;
  return p;
}

fn startProc(name, source, args) {
  let r = kern.procStart(name, source, args);
  if (r.ok == true) {
    procs.push({ pid: r.pid, name: name, state: "ready", used: 0, quota: 800 });
  }
  return r;
}

fn killProc(pid) {
  kern.procKill(pid);
  let i = 0;
  let out = [];
  while (i < procs.length) {
    if (procs[i].pid != pid) {
      out.push(procs[i]);
    }
    i = i + 1;
  }
  procs = out;
  return true;
}

// ---------- 消息（投递规则在本程序，原始队列由 kern 提供） ----------
fn deliverMsg(to, msg) {
  // 只投递给指定进程实例；目标不存在时发送方得到明确结果
  kern.deliver(to, msg);
  return true;
}

fn recvMsg(pid) {
  return kern.takeMsg(pid);
}

// ---------- 文件（由内核实现） ----------
fn sysReadFile(path) {
  let t = kern.storageRead(path);
  if (t == null) {
    return { ok: false, error: "文件不存在: " + path };
  }
  return { ok: true, data: t };
}

fn sysWriteFile(path, data) {
  let ok = kern.storageWrite(path, data);
  return { ok: ok };
}

fn sysListDir(path) {
  return { ok: true, list: kern.storageList(path) };
}

// ---------- 系统调用分发 ----------
fn handleSyscall(req) {
  let name = req.name;
  if (name == "readFile") {
    return sysReadFile(req.path);
  }
  if (name == "writeFile") {
    return sysWriteFile(req.path, req.data);
  }
  if (name == "listDir") {
    return sysListDir(req.path);
  }
  if (name == "send") {
    let targetExists = kern.procAlive(req.to);
    if (targetExists == false) {
      return { ok: false, error: "目标进程不存在" };
    }
    deliverMsg(req.to, { from: req.pid, data: req.msg });
    return { ok: true };
  }
  if (name == "recv") {
    let m = recvMsg(req.pid);
    if (m == null) {
      kern.sleepRecv(req.pid);
      return { pending: true };
    }
    return m;
  }
  if (name == "spawn") {
    let r = startProc("user-proc", req.prog, req.args);
    return r;
  }
  if (name == "submit2d") {
    handleDraw(req.pid, req.cmds, req.winId);
    return { ok: true };
  }
  if (name == "submit3d") {
    kern.submitScene(req.viewId, req.scene);
    return { ok: true };
  }
  if (name == "procList") {
    return { ok: true, list: procs };
  }
  return { ok: false, error: "未知系统调用: " + name };
}

// ---------- 显示与窗口 ----------
fn handleDraw(pid, cmds, winId) {
  let i = 0;
  while (i < windowList.length) {
    if (windowList[i].id == winId) {
      windowList[i].cmds = cmds;
      return true;
    }
    i = i + 1;
  }
  return false;
}

fn createWindow(pid, title, appId, x, y, w, h) {
  let id = nextWinId;
  nextWinId = nextWinId + 1;
  windowList.push({
    id: id, pid: pid, title: title, appId: appId,
    x: x, y: y, w: w, h: h, z: windowList.length + 1,
    cmds: [], minimized: 0
  });
  return id;
}

fn findWindow(id) {
  let i = 0;
  while (i < windowList.length) {
    if (windowList[i].id == id) {
      return windowList[i];
    }
    i = i + 1;
  }
  return null;
}

fn focusWindow(id) {
  let w = findWindow(id);
  if (w == null) {
    return false;
  }
  let maxZ = 0;
  let i = 0;
  while (i < windowList.length) {
    if (windowList[i].z > maxZ) {
      maxZ = windowList[i].z;
    }
    i = i + 1;
  }
  w.z = maxZ + 1;
  focusedWindow = id;
  return true;
}

fn hitWindow(x, y) {
  let best = null;
  let bestZ = -1;
  let i = 0;
  while (i < windowList.length) {
    let w = windowList[i];
    if (w.minimized == 0 and x >= w.x and x < w.x + w.w and y >= w.y and y < w.y + w.h) {
      if (w.z > bestZ) {
        bestZ = w.z;
        best = w;
      }
    }
    i = i + 1;
  }
  return best;
}

fn pointInRect(x, y, rx, ry, rw, rh) {
  if (x >= rx and x < rx + rw and y >= ry and y < ry + rh) {
    return true;
  }
  return false;
}

// ---------- 桌面绘制 ----------
fn buildDesktop() {
  let cmds = [];
  // wallpaper: layered gradient + decorative glows
  cmds.push({ op: "gradient-rect", x: 0, y: 0, w: 4000, h: 4000, from: "#16223e", to: "#0a1220", dir: "diag" });
  cmds.push({ op: "circle", x: 780, y: 90, r: 200, fill: "rgba(122,162,255,0.06)" });
  cmds.push({ op: "circle", x: 140, y: 280, r: 130, fill: "rgba(122,162,255,0.05)" });
  cmds.push({ op: "circle", x: 500, y: 200, r: 90, fill: "rgba(180,140,255,0.05)" });
  // icons
  drawIcons(cmds);
  // windows
  drawWindows(cmds);
  // start menu (if open)
  if (wmState.menuOpen == 1) {
    drawStartMenu(cmds);
  }
  // taskbar
  drawTaskbar(cmds);
  return cmds;
}

fn drawIcons(cmds) {
  let icons = [
    { x: 16, y: 36, label: "文件管理", appId: "files", col: "#f5b83d" },
    { x: 16, y: 118, label: "编辑器", appId: "editor", col: "#4f7cff" },
    { x: 16, y: 200, label: "进程管理", appId: "tasks", col: "#ff7a59" },
    { x: 16, y: 282, label: "播放器", appId: "player", col: "#b266ff" },
    { x: 16, y: 364, label: "图表", appId: "charts", col: "#ff6b9d" }
  ];
  let i = 0;
  while (i < icons.length) {
    let ic = icons[i];
    cmds.push({ op: "rect", x: ic.x, y: ic.y, w: 76, h: 70, fill: "rgba(255,255,255,0.03)", radius: 10 });
    cmds.push({ op: "rect", x: ic.x + 20, y: ic.y + 8, w: 36, h: 36, fill: ic.col, radius: 9 });
    cmds.push({ op: "text", x: ic.x + 38, y: ic.y + 16, text: "◆", size: 16, color: "#fff", align: "center" });
    cmds.push({ op: "text", x: ic.x + 38, y: ic.y + 50, text: ic.label, size: 11, color: "#cdd8ee", align: "center" });
    i = i + 1;
  }
}

fn drawStartMenu(cmds) {
  let mw = 300;
  let mh = 260;
  let mx = 10;
  let my = 112;
  cmds.push({ op: "rect", x: mx + 3, y: my + 4, w: mw, h: mh, fill: "rgba(0,0,0,0.4)", radius: 12 });
  cmds.push({ op: "rect", x: mx, y: my, w: mw, h: mh, fill: "rgba(28,36,58,0.96)", radius: 12, stroke: "rgba(255,255,255,0.12)" });
  cmds.push({ op: "text", x: mx + 18, y: my + 16, text: "应用程序", size: 13, color: "#9ab4d8" });
  let items = [
    { label: "文件管理器", appId: "files" },
    { label: "编辑器", appId: "editor" },
    { label: "进程管理器", appId: "tasks" },
    { label: "三维播放器", appId: "player" },
    { label: "图表工作台", appId: "charts" },
    { label: "系统管理", appId: "systems" }
  ];
  let i = 0;
  while (i < items.length) {
    let iy = my + 42 + i * 32;
    cmds.push({ op: "rect", x: mx + 12, y: iy, w: mw - 24, h: 28, fill: "rgba(255,255,255,0.04)", radius: 6 });
    cmds.push({ op: "text", x: mx + 24, y: iy + 7, text: items[i].label, size: 12, color: "#e8edf7" });
    i = i + 1;
  }
}

fn drawWindows(cmds) {
  let i = 0;
  while (i < windowList.length) {
    let w = windowList[i];
    if (w.minimized == 1) {
      i = i + 1;
      continue;
    }
    // shadow
    cmds.push({ op: "rect", x: w.x + 3, y: w.y + 4, w: w.w, h: w.h, fill: "rgba(0,0,0,0.35)", radius: 8 });
    // frame
    cmds.push({ op: "rect", x: w.x, y: w.y, w: w.w, h: w.h, fill: "#1c2438", radius: 8, stroke: "rgba(255,255,255,0.12)" });
    // titlebar
    cmds.push({ op: "rect", x: w.x, y: w.y, w: w.w, h: 28, fill: "#232e48", radius: 8 });
    cmds.push({ op: "rect", x: w.x, y: w.y + 18, w: w.w, h: 10, fill: "#232e48" });
    cmds.push({ op: "text", x: w.x + 12, y: w.y + 8, text: w.title, size: 12, color: "#e8edf7" });
    // buttons
    cmds.push({ op: "text", x: w.x + w.w - 60, y: w.y + 8, text: "─", size: 12, color: "#9aa7c0" });
    cmds.push({ op: "text", x: w.x + w.w - 38, y: w.y + 8, text: "□", size: 11, color: "#9aa7c0" });
    cmds.push({ op: "rect", x: w.x + w.w - 24, y: w.y + 4, w: 18, h: 18, fill: "#e05555", radius: 4 });
    cmds.push({ op: "text", x: w.x + w.w - 15, y: w.y + 6, text: "✕", size: 10, color: "#fff", align: "center" });
    // content clip
    let cw = w.cmds;
    let j = 0;
    while (j < cw.length) {
      let c = cw[j];
      let cc = { op: c.op, x: (c.x || 0) + w.x, y: (c.y || 0) + w.y + 30, w: c.w, h: c.h, fill: c.fill, stroke: c.stroke, radius: c.radius, text: c.text, size: c.size, color: c.color, align: c.align, r: c.r, x1: (c.x1 || 0) + w.x, y1: (c.y1 || 0) + w.y + 30, x2: (c.x2 || 0) + w.x, y2: (c.y2 || 0) + w.y + 30, points: c.points, from: c.from, to: c.to, dir: c.dir, lineWidth: c.lineWidth, src: c.src };
      if (c.op == "path" and c.points != null) {
        let pts = [];
        let k = 0;
        while (k < c.points.length) {
          pts.push([c.points[k][0] + w.x, c.points[k][1] + w.y + 30]);
          k = k + 1;
        }
        cc.points = pts;
      }
      cmds.push(cc);
      j = j + 1;
    }
    i = i + 1;
  }
}

fn drawTaskbar(cmds) {
  let th = 44;
  let y = kern.budgetLeft() * 0;
  cmds.push({ op: "rect", x: 0, y: 380, w: 4000, h: th, fill: "rgba(12,18,32,0.88)" });
  cmds.push({ op: "rect", x: 8, y: 386, w: 32, h: 32, fill: "#33456e", radius: 8 });
  cmds.push({ op: "text", x: 24, y: 396, text: "⊞", size: 15, color: "#9ab4ff", align: "center" });
  // window buttons
  let i = 0;
  let bx = 50;
  while (i < windowList.length) {
    let w = windowList[i];
    let active = 0;
    if (w.id == focusedWindow) {
      active = 1;
    }
    let bg = "#232e48";
    if (active == 1) {
      bg = "#2e3d5e";
    }
    cmds.push({ op: "rect", x: bx, y: 388, w: 120, h: 28, fill: bg, radius: 6 });
    cmds.push({ op: "text", x: bx + 10, y: 395, text: w.title, size: 11, color: "#d6e2f5" });
    bx = bx + 128;
    i = i + 1;
  }
  // clock
  cmds.push({ op: "text", x: 920, y: 397, text: "子系统 " + stepCount, size: 11, color: "#9aa7c0", align: "right" });
}

fn composite() {
  let frame = buildDesktop();
  kern.submitDisplay(frame);
  return true;
}

// ---------- 输入处理 ----------
fn handleInput(ev) {
  if (ev == null) {
    return false;
  }
  if (ev.type == "resize") {
    return true;
  }
  if (ev.type == "move") {
    if (wmState.dragWin != 0) {
      let w = findWindow(wmState.dragWin);
      if (w != null) {
        w.x = ev.x - wmState.dragOffX;
        w.y = ev.y - wmState.dragOffY;
      }
    }
    return true;
  }
  if (ev.type == "down") {
    // start menu open?
    if (wmState.menuOpen == 1) {
      // check menu item clicks
      let mx = 10;
      let my = 112;
      let mw = 300;
      if (ev.x >= mx and ev.x < mx + mw and ev.y >= my and ev.y < my + 260) {
        let items = ["files", "editor", "tasks", "player", "charts", "systems"];
        let i = 0;
        while (i < items.length) {
          let iy = my + 42 + i * 32;
          if (ev.y >= iy and ev.y < iy + 28) {
            wmState.menuOpen = 0;
            openApp(items[i]);
            return true;
          }
          i = i + 1;
        }
        return true;
      }
      // click outside closes menu
      wmState.menuOpen = 0;
    }
    // taskbar?
    if (ev.y >= 380) {
      // start button
      if (ev.x >= 8 and ev.x < 42) {
        wmState.menuOpen = 1 - wmState.menuOpen;
        return true;
      }
      // window buttons
      let i = 0;
      let bx = 50;
      while (i < windowList.length) {
        if (ev.x >= bx and ev.x < bx + 120) {
          if (windowList[i].id == focusedWindow and windowList[i].minimized == 0) {
            windowList[i].minimized = 1;
          } else {
            windowList[i].minimized = 0;
            focusWindow(windowList[i].id);
          }
          return true;
        }
        bx = bx + 128;
        i = i + 1;
      }
      return true;
    }
    // desktop icon?
    if (ev.x < 100 and ev.y < 520) {
      let idx = (ev.y - 34) / 82;
      let apps = ["files", "editor", "tasks", "player", "charts", "systems"];
      let ai = 0;
      let n = 0;
      while (n < apps.length) {
        if (idx >= n and idx < n + 1) {
          ai = n;
        }
        n = n + 1;
      }
      openApp(apps[ai]);
      return true;
    }
    // window hit
    let w = hitWindow(ev.x, ev.y);
    if (w != null) {
      focusWindow(w.id);
      // titlebar drag
      if (ev.y < w.y + 30) {
        // close button
        if (ev.x > w.x + w.w - 26) {
          closeWindow(w.id);
          return true;
        }
        // minimize
        if (ev.x > w.x + w.w - 48) {
          w.minimized = 1;
          return true;
        }
        // max toggle
        if (ev.x > w.x + w.w - 70) {
          w.x = 0;
          w.y = 0;
          w.w = 1024;
          w.h = 372;
          return true;
        }
        wmState.dragWin = w.id;
        wmState.dragOffX = ev.x - w.x;
        wmState.dragOffY = ev.y - w.y;
        return true;
      }
      // forward click to app process
      let lx = ev.x - w.x;
      let ly = ev.y - w.y - 30;
      deliverMsg(w.pid, { type: "click", x: lx, y: ly, button: ev.button, winId: w.id });
      return true;
    }
    return true;
  }
  if (ev.type == "up") {
    wmState.dragWin = 0;
    return true;
  }
  if (ev.type == "dblclick") {
    let w = hitWindow(ev.x, ev.y);
    if (w != null and ev.y < w.y + 30) {
      w.x = 0;
      w.y = 0;
      w.w = 1024;
      w.h = 372;
    }
    return true;
  }
  return true;
}

fn closeWindow(id) {
  let out = [];
  let i = 0;
  while (i < windowList.length) {
    if (windowList[i].id != id) {
      out.push(windowList[i]);
    }
    i = i + 1;
  }
  windowList = out;
  return true;
}

fn openApp(appId) {
  let title = appId;
  let w = 620;
  let h = 380;
  if (appId == "files") { title = "文件管理器"; }
  if (appId == "editor") { title = "编辑器"; w = 660; }
  if (appId == "tasks") { title = "进程管理器"; }
  if (appId == "player") { title = "三维播放器"; w = 700; h = 420; }
  if (appId == "charts") { title = "图表工作台"; w = 700; h = 420; }
  if (appId == "systems") { title = "系统管理"; }
  let x = 60 + windowList.length * 28;
  let y = 40 + windowList.length * 24;
  let wid = createWindow(0, title, appId, x, y, w, h);
  focusWindow(wid);
  let progPath = "/System/Programs/" + appId + "-app.ks";
  let src = kern.storageRead(progPath);
  if (src == null) {
    kern.log("找不到应用程序:", progPath);
    return false;
  }
  let r = startProc(appId + "-app", src, { winId: wid, appId: appId });
  // tell the app its window id via a message
  if (r.ok == true) {
    deliverMsg(r.pid, { type: "init", winId: wid, appId: appId });
  }
  return true;
}

// ---------- 调度 ----------
fn scheduleStep() {
  stepCount = stepCount + 1;
  // collect syscalls from user processes by running them
  let i = 0;
  while (i < procs.length) {
    let p = procs[i];
    if (p.state == "ready" or p.state == "running") {
      let r = kern.runProcess(p.pid, p.quota);
      p.used = p.used + (r.used || 0);
      if (r.status == "done") {
        p.state = "ended";
      }
      if (r.status == "error") {
        p.state = "error";
      }
      if (r.status == "syscall") {
        let result = handleSyscall(r.request);
        if (result.pending == true) {
          p.state = "waiting";
        } else {
          p.state = "ready";
          kern.returnSyscall(p.pid, result);
        }
      }
      if (r.status == "wait") {
        p.state = "waiting";
      }
    }
    i = i + 1;
  }
  // remove ended
  let out = [];
  let j = 0;
  while (j < procs.length) {
    if (procs[j].state != "ended") {
      out.push(procs[j]);
    }
    j = j + 1;
  }
  procs = out;
  return true;
}

// ---------- 主循环 ----------
fn main() {
  // start window manager builtin (we are the WM here)
  // start default apps
  startProc("files-app", kern.storageRead("/System/Programs/files-app.ks"), null);
  composite();
  while (true) {
    // drain input
    let n = 0;
    while (n < 32) {
      let ev = kern.readInput();
      if (ev == null) {
        n = 32;
      } else {
        handleInput(ev);
        n = n + 1;
      }
    }
    scheduleStep();
    composite();
    kern.charge(4);
  }
}

main();
`;

/* ---------- user programs ---------- */

export const DEFAULT_PROGRAMS = {
  'accum.ks': `// 累加计算程序：从 start 加到 end
let start = 1;
let end = 100;
let i = start;
let sum = 0;
while (i <= end) {
  sum = sum + i;
  i = i + 1;
}
sys.log("累加结果:", start, "到", end, "=", sum);
sys.writeFile("/Documents/accum-result.txt", "sum=" + sum);
return sum;
`,

  'sender.ks': `// 消息发送程序：向 receiver 进程发送问候
let target = 2;
let n = 0;
while (n < 5) {
  sys.send(target, { text: "你好，这是第 " + (n + 1) + " 条消息", n: n });
  sys.log("已发送消息", n + 1);
  sys.wait(500);
  n = n + 1;
}
sys.log("发送完毕");
return true;
`,

  'receiver.ks': `// 消息接收程序：接收并打印消息
let count = 0;
while (count < 5) {
  let m = sys.recv();
  sys.log("收到消息:", m);
  count = count + 1;
}
sys.log("接收完毕，共", count, "条");
return count;
`,

  'busy.ks': `// 持续计算程序：在循环中不主动等待或让出执行权，用于检验调度
let x = 0;
let iterations = 0;
while (true) {
  x = x + 1;
  iterations = iterations + 1;
  if (x >= 1000000) {
    x = 0;
    sys.log("busy 持续计算中，累计迭代:", iterations);
  }
}
`,

  'compiler.ks': `// 编译器程序：把 KernelScript 源码编译为可执行 AST（以 JSON 表示）
// 修改本程序会影响此后启动的程序的编译方式。

fn compile(source) {
  // 简化编译器：返回源码长度与关键字统计作为"编译结果"
  let len = 0;
  let lets = 0;
  let fns = 0;
  let i = 0;
  while (i < source.length) {
    let c = source[i];
    len = len + 1;
    i = i + 1;
  }
  // 统计 let / fn
  let pos = 0;
  while (pos < source.length - 3) {
    if (source[pos] == "l" and source[pos+1] == "e" and source[pos+2] == "t") {
      lets = lets + 1;
    }
    if (source[pos] == "f" and source[pos+1] == "n") {
      fns = fns + 1;
    }
    pos = pos + 1;
  }
  return { ok: true, length: len, lets: lets, fns: fns };
}

let src = sys.readFile("/System/Programs/accum.ks");
if (src.ok == true) {
  let r = compile(src.data);
  sys.log("编译结果:", r);
} else {
  sys.log("读取源码失败");
}
return true;
`,

  'flightctl.ks': `// 飞行控制程序 (flightctl.ks)
// 排演中保持 24 号直升机飞行：读取传感器值，写入总距与舵面。
// 接口：
//   sys.sensor()          -> { pitch, roll, yaw, alt, vx, vy, vz, time }
//   sys.control(collective, pitchCmd, rollCmd, yawCmd)
// 控制量保持到下一次写入；错过周期的控制不补发。

let kp = 0.6;
let ki = 0.08;
let kd = 0.25;
let iPitch = 0;
let iRoll = 0;
let lastPitchErr = 0;
let lastRollErr = 0;
let targetAlt = 30;
let targetHeading = 0;

fn step() {
  let s = sys.sensor();
  let dt = 0.05;
  // 高度保持
  let altErr = targetAlt - s.alt;
  let collective = 0.55 + altErr * 0.02 - s.vy * 0.06;
  if (collective > 1.0) { collective = 1.0; }
  if (collective < 0.15) { collective = 0.15; }
  // 姿态保持
  let pitchErr = 0 - s.pitch;
  let rollErr = 0 - s.roll;
  iPitch = iPitch + pitchErr * dt;
  iRoll = iRoll + rollErr * dt;
  let dPitch = (pitchErr - lastPitchErr) / dt;
  let dRoll = (rollErr - lastRollErr) / dt;
  let pitchCmd = kp * pitchErr + ki * iPitch + kd * dPitch;
  let rollCmd = kp * rollErr + ki * iRoll + kd * dRoll;
  lastPitchErr = pitchErr;
  lastRollErr = rollErr;
  // 航向
  let headErr = targetHeading - s.yaw;
  let yawCmd = headErr * 0.02;
  sys.control(collective, pitchCmd, rollCmd, yawCmd);
  return true;
}

sys.log("飞控程序已启动");
while (true) {
  step();
  sys.wait(50);
}
`
};

/* subsystem app programs (KS) */
export const SUB_APP_SRC = {
  'files-app.ks': `// 文件管理器应用
let winId = 0;
let a = sys.args();
if (a != null) {
  if (a.winId != null) { winId = a.winId; }
}
let path = "/";
let items = [];
let scroll = 0;

fn refresh() {
  let r = sys.listDir(path);
  if (r.ok == true) {
    items = r.list;
  }
  return true;
}

fn draw() {
  let cmds = [];
  cmds.push({ op: "rect", x: 0, y: 0, w: 600, h: 340, fill: "#1a2236" });
  // path bar
  cmds.push({ op: "rect", x: 8, y: 8, w: 584, h: 26, fill: "#0f1729", radius: 6 });
  cmds.push({ op: "text", x: 16, y: 14, text: "路径: " + path, size: 12, color: "#9ab4d8" });
  // toolbar
  cmds.push({ op: "rect", x: 8, y: 40, w: 70, h: 22, fill: "#2e4a7a", radius: 5 });
  cmds.push({ op: "text", x: 16, y: 45, text: "上上级", size: 11, color: "#d6e2f5" });
  cmds.push({ op: "rect", x: 84, y: 40, w: 70, h: 22, fill: "#2e4a7a", radius: 5 });
  cmds.push({ op: "text", x: 92, y: 45, text: "新建", size: 11, color: "#d6e2f5" });
  // list
  let i = 0;
  let y = 72;
  while (i < items.length and y < 320) {
    let it = items[i];
    let bg = "#222c44";
    cmds.push({ op: "rect", x: 8, y: y, w: 584, h: 24, fill: bg, radius: 4 });
    let icon = "▢";
    if (it.type == "dir") { icon = "📁"; }
    cmds.push({ op: "text", x: 16, y: y + 5, text: icon + " " + it.name, size: 12, color: "#d6e2f5" });
    y = y + 28;
    i = i + 1;
  }
  sys.submit2d(cmds, winId);
  return true;
}

fn onClick(x, y) {
  if (y >= 40 and y < 64 and x >= 8 and x < 78) {
    // up
    if (path.length > 1) {
      let parts = [];
      let seg = "";
      let i = 1;
      while (i < path.length) {
        if (path[i] == "/") {
          if (seg.length > 0) { parts.push(seg); }
          seg = "";
        } else {
          seg = seg + path[i];
        }
        i = i + 1;
      }
      if (seg.length > 0) { parts.push(seg); }
      parts.pop();
      path = "/" ;
      let j = 0;
      while (j < parts.length) {
        path = path + parts[j] + "/";
        j = j + 1;
      }
      if (path.length > 1) {
        path = path.substring(0, path.length - 1);
      }
      if (path == "") { path = "/"; }
      refresh();
      draw();
    }
    return true;
  }
  if (y >= 72) {
    let idx = (y - 72) / 28;
    if (idx < items.length) {
      let it = items[idx];
      if (it.type == "dir") {
        if (path == "/") {
          path = "/" + it.name;
        } else {
          path = path + "/" + it.name;
        }
        refresh();
        draw();
      }
    }
  }
  return true;
}

// main
refresh();
winId = 0;
// request window via syscall? kernel creates windows on openApp
// we just draw content; kernel window wraps it
draw();
while (true) {
  let m = sys.recv();
  if (m != null) {
    if (m.data != null and m.data.type == "click") {
      onClick(m.data.x, m.data.y);
    }
    if (m.data != null and m.data.type == "open") {
      path = m.data.path;
      refresh();
      draw();
    }
  }
  sys.wait(100);
}
`,

  'editor-app.ks': `// 编辑器应用
let winId = 0;
let a = sys.args();
if (a != null) {
  if (a.winId != null) { winId = a.winId; }
}
let text = "// 在此编辑 KernelScript 程序\\n";
let fname = "/Documents/新程序.ks";

fn draw() {
  let cmds = [];
  cmds.push({ op: "rect", x: 0, y: 0, w: 600, h: 340, fill: "#141b2e" });
  cmds.push({ op: "rect", x: 0, y: 0, w: 600, h: 24, fill: "#1c2438" });
  cmds.push({ op: "text", x: 12, y: 6, text: fname, size: 11, color: "#9ab4d8" });
  cmds.push({ op: "rect", x: 480, y: 2, w: 50, h: 20, fill: "#2e6e4a", radius: 4 });
  cmds.push({ op: "text", x: 488, y: 6, text: "保存", size: 11, color: "#fff" });
  cmds.push({ op: "rect", x: 536, y: 2, w: 50, h: 20, fill: "#2e4a7a", radius: 4 });
  cmds.push({ op: "text", x: 544, y: 6, text: "运行", size: 11, color: "#fff" });
  // text area
  let lines = [];
  let line = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] == "\\n") {
      lines.push(line);
      line = "";
    } else {
      line = line + text[i];
    }
    i = i + 1;
  }
  lines.push(line);
  let y = 32;
  let li = 0;
  while (li < lines.length and y < 330) {
    cmds.push({ op: "text", x: 12, y: y, text: lines[li], size: 12, color: "#d6e2f5", font: "monospace" });
    y = y + 16;
    li = li + 1;
  }
  sys.submit2d(cmds, winId);
  return true;
}

draw();
while (true) {
  sys.wait(200);
  draw();
}
`,

  'tasks-app.ks': `// 进程管理器应用
let winId = 0;
let a = sys.args();
if (a != null) {
  if (a.winId != null) { winId = a.winId; }
}

fn draw() {
  let cmds = [];
  cmds.push({ op: "rect", x: 0, y: 0, w: 600, h: 340, fill: "#1a2236" });
  cmds.push({ op: "text", x: 12, y: 10, text: "进程管理器", size: 13, color: "#e8edf7" });
  let plr = sys.procList();
  let pl = [];
  if (plr.ok == true) {
    pl = plr.list;
  }
  let i = 0;
  let y = 36;
  cmds.push({ op: "text", x: 12, y: y, text: "PID", size: 11, color: "#9aa7c0" });
  cmds.push({ op: "text", x: 60, y: y, text: "名称", size: 11, color: "#9aa7c0" });
  cmds.push({ op: "text", x: 220, y: y, text: "状态", size: 11, color: "#9aa7c0" });
  cmds.push({ op: "text", x: 320, y: y, text: "已用", size: 11, color: "#9aa7c0" });
  y = y + 20;
  while (i < pl.length and y < 300) {
    let p = pl[i];
    cmds.push({ op: "text", x: 12, y: y, text: "" + p.pid, size: 11, color: "#d6e2f5" });
    cmds.push({ op: "text", x: 60, y: y, text: p.name, size: 11, color: "#d6e2f5" });
    cmds.push({ op: "text", x: 220, y: y, text: p.state, size: 11, color: "#d6e2f5" });
    cmds.push({ op: "text", x: 320, y: y, text: "" + p.used, size: 11, color: "#d6e2f5" });
    y = y + 20;
    i = i + 1;
  }
  sys.submit2d(cmds, winId);
  return true;
}

while (true) {
  draw();
  sys.wait(500);
}
`,

  'player-app.ks': `// 三维场景播放器应用
// 播放位置由本进程按所属系统时间推进；图形经系统显示接口提交。
let winId = 0;
let a = sys.args();
if (a != null) {
  if (a.winId != null) { winId = a.winId; }
}
let position = 0;
let duration = 15000;
let rate = 1;
let playing = 0;
let loop = 0;
let mode = "performance";
let scenePath = "/Demo/helicopter-24.scene";
let lastTime = sys.time();
let selection = "";

fn fmtTime(ms) {
  let s = ms / 1000;
  let m = s / 60;
  let ss = s % 60;
  return m + ":" + ss;
}

fn draw() {
  let cmds = [];
  cmds.push({ op: "rect", x: 0, y: 0, w: 700, h: 360, fill: "#0a0e18" });
  // 3D viewport placeholder (actual 3D rendered by device)
  cmds.push({ op: "rect", x: 10, y: 10, w: 680, h: 260, fill: "#0c1526", radius: 6 });
  cmds.push({ op: "text", x: 350, y: 120, text: "24 号直升机 · " + mode, size: 16, color: "#b266ff", align: "center" });
  cmds.push({ op: "text", x: 350, y: 150, text: "时刻 " + fmtTime(position) + " / " + fmtTime(duration), size: 12, color: "#9aa7c0", align: "center" });
  // progress bar
  cmds.push({ op: "rect", x: 20, y: 280, w: 660, h: 8, fill: "#2a3550", radius: 4 });
  let pw = position * 660 / duration;
  cmds.push({ op: "rect", x: 20, y: 280, w: pw, h: 8, fill: "#7aa2ff", radius: 4 });
  // buttons
  cmds.push({ op: "rect", x: 20, y: 298, w: 56, h: 28, fill: "#2e6e4a", radius: 6 });
  cmds.push({ op: "text", x: 32, y: 305, text: "播放", size: 11, color: "#fff" });
  cmds.push({ op: "rect", x: 84, y: 298, w: 56, h: 28, fill: "#4a5568", radius: 6 });
  cmds.push({ op: "text", x: 96, y: 305, text: "暂停", size: 11, color: "#fff" });
  cmds.push({ op: "rect", x: 148, y: 298, w: 56, h: 28, fill: "#4a5568", radius: 6 });
  cmds.push({ op: "text", x: 160, y: 305, text: "停止", size: 11, color: "#fff" });
  cmds.push({ op: "rect", x: 212, y: 298, w: 56, h: 28, fill: "#4a5568", radius: 6 });
  cmds.push({ op: "text", x: 224, y: 305, text: "逐帧", size: 11, color: "#fff" });
  cmds.push({ op: "rect", x: 276, y: 298, w: 56, h: 28, fill: "#4a5568", radius: 6 });
  cmds.push({ op: "text", x: 288, y: 305, text: "重播", size: 11, color: "#fff" });
  cmds.push({ op: "rect", x: 340, y: 298, w: 56, h: 28, fill: "#4a5568", radius: 6 });
  cmds.push({ op: "text", x: 352, y: 305, text: "循环", size: 11, color: "#fff" });
  cmds.push({ op: "rect", x: 410, y: 298, w: 70, h: 28, fill: "#5a3a8a", radius: 6 });
  cmds.push({ op: "text", x: 418, y: 305, text: "排演模式", size: 10, color: "#fff" });
  // status
  let status = "已暂停";
  if (playing == 1) { status = "播放中"; }
  cmds.push({ op: "text", x: 640, y: 305, text: status + " · " + rate + "x", size: 11, color: "#9aa7c0", align: "right" });
  if (selection.length > 0) {
    cmds.push({ op: "rect", x: 500, y: 10, w: 180, h: 50, fill: "rgba(0,0,0,0.5)", radius: 8 });
    cmds.push({ op: "text", x: 510, y: 22, text: selection, size: 11, color: "#fff" });
  }
  sys.submit2d(cmds, winId);
  return true;
}

fn onClick(x, y) {
  // progress bar click to seek
  if (y >= 278 and y < 292 and x >= 20 and x < 680) {
    let u = (x - 20) / 660;
    position = u * duration;
    draw();
    return true;
  }
  // buttons
  if (y >= 296 and y < 330) {
    if (x >= 20 and x < 78) {
      playing = 1;
      lastTime = sys.time();
    }
    if (x >= 82 and x < 142) {
      playing = 0;
    }
    if (x >= 146 and x < 206) {
      playing = 0;
      position = 0;
    }
    if (x >= 210 and x < 270) {
      playing = 0;
      position = position + 33;
      if (position > duration) { position = duration; }
    }
    if (x >= 274 and x < 334) {
      position = 0;
      playing = 1;
      lastTime = sys.time();
    }
    if (x >= 338 and x < 398) {
      loop = 1 - loop;
    }
    if (x >= 408 and x < 482) {
      mode = "rehearsal";
    }
    draw();
    return true;
  }
  // 3D view click -> selection
  if (y >= 10 and y < 270 and x >= 10 and x < 690) {
    let parts = ["机身", "主旋翼", "尾桨", "座舱", "起落撬", "发动机"];
    let idx = (x - 10) / 113;
    selection = parts[idx];
    draw();
    return true;
  }
  return true;
}

// main loop
draw();
while (true) {
  // advance playback position based on system time
  let now = sys.time();
  let dt = now - lastTime;
  lastTime = now;
  if (playing == 1) {
    position = position + dt * rate;
    if (position >= duration) {
      if (loop == 1) {
        position = 0;
      } else {
        position = duration;
        playing = 0;
      }
    }
  }
  // handle input messages
  let n = 0;
  while (n < 8) {
    let m = sys.recv();
    if (m == null) {
      n = 8;
    } else {
      let d = m.data;
      if (d != null) {
        if (d.type == "click") {
          onClick(d.x, d.y);
        }
        if (d.type == "seek") {
          position = d.pos;
          draw();
        }
        if (d.type == "play") {
          playing = 1;
          lastTime = sys.time();
        }
      }
      n = n + 1;
    }
  }
  draw();
  sys.wait(33);
}
`,

  'charts-app.ks': `// 图表工作台应用
// 从根系统电子表格建立实时数据连接，数据经消息传入。
let winId = 0;
let a = sys.args();
if (a != null) {
  if (a.winId != null) { winId = a.winId; }
}
let chartType = "bar";
let connected = 0;
let dataRows = [];
let labels = [];
let series = [];
let seriesNames = [];
let version = 0;

fn draw() {
  let cmds = [];
  cmds.push({ op: "rect", x: 0, y: 0, w: 700, h: 380, fill: "#1a2236" });
  cmds.push({ op: "text", x: 12, y: 10, text: "图表工作台", size: 13, color: "#e8edf7" });
  // controls
  cmds.push({ op: "rect", x: 520, y: 8, w: 80, h: 24, fill: "#2e4a7a", radius: 5 });
  cmds.push({ op: "text", x: 530, y: 13, text: "切换类型", size: 10, color: "#fff" });
  cmds.push({ op: "rect", x: 610, y: 8, w: 80, h: 24, fill: "#4a5568", radius: 5 });
  cmds.push({ op: "text", x: 618, y: 13, text: "断开连接", size: 10, color: "#fff" });
  if (connected == 0) {
    cmds.push({ op: "text", x: 350, y: 180, text: "尚未连接数据源", size: 14, color: "#9aa7c0", align: "center" });
    cmds.push({ op: "text", x: 350, y: 210, text: "在下方选择工作簿与区域后点击连接", size: 11, color: "#6b7791", align: "center" });
  } else {
    cmds.push({ op: "text", x: 350, y: 42, text: "已连接 · 版本 " + version + " · " + chartType, size: 11, color: "#3ecf8e", align: "center" });
    // draw chart
    if (labels.length > 0) {
      let n = labels.length;
      let sn = series.length;
      let cw = 620 / n;
      let maxV = 0;
      let si = 0;
      while (si < sn) {
        let j = 0;
        while (j < n) {
          if (series[si][j] > maxV) { maxV = series[si][j]; }
          j = j + 1;
        }
        si = si + 1;
      }
      if (maxV == 0) { maxV = 1; }
      // axis
      cmds.push({ op: "line", x1: 50, y1: 70, x2: 50, y2: 310, stroke: "rgba(255,255,255,0.2)" });
      cmds.push({ op: "line", x1: 50, y1: 310, x2: 680, y2: 310, stroke: "rgba(255,255,255,0.2)" });
      // bars
      if (chartType == "bar") {
        let i = 0;
        while (i < n) {
          let j2 = 0;
          while (j2 < sn) {
            let v = series[j2][i];
            let bh = v * 220 / maxV;
            let bx = 55 + i * cw + j2 * (cw / (sn + 1));
            let bw = cw / (sn + 1) - 3;
            let colors = ["#4f7cff", "#3ecf8e", "#f5b83d", "#ff6b9d"];
            cmds.push({ op: "rect", x: bx, y: 310 - bh, w: bw, h: bh, fill: colors[j2 % 4] });
            j2 = j2 + 1;
          }
          cmds.push({ op: "text", x: 55 + i * cw + cw / 2, y: 318, text: labels[i], size: 9, color: "#9aa7c0", align: "center" });
          i = i + 1;
        }
      } else {
        // line chart
        let j3 = 0;
        while (j3 < sn) {
          let i2 = 0;
          while (i2 < n - 1) {
            let v1 = series[j3][i2];
            let v2 = series[j3][i2 + 1];
            let x1 = 55 + i2 * cw + cw / 2;
            let x2 = 55 + (i2 + 1) * cw + cw / 2;
            let y1 = 310 - v1 * 220 / maxV;
            let y2 = 310 - v2 * 220 / maxV;
            let colors2 = ["#4f7cff", "#3ecf8e", "#f5b83d", "#ff6b9d"];
            cmds.push({ op: "line", x1: x1, y1: y1, x2: x2, y2: y2, stroke: colors2[j3 % 4], lineWidth: 2 });
            i2 = i2 + 1;
          }
          j3 = j3 + 1;
        }
      }
    }
  }
  sys.submit2d(cmds, winId);
  return true;
}

fn onClick(x, y) {
  if (y >= 8 and y < 34) {
    if (x >= 518 and x < 602) {
      if (chartType == "bar") { chartType = "line"; } else { chartType = "bar"; }
      draw();
      return true;
    }
    if (x >= 608 and x < 692) {
      connected = 0;
      draw();
      return true;
    }
  }
  return true;
}

// main loop: listen for data updates via messages
draw();
while (true) {
  let m = sys.recv();
  if (m != null) {
    let d = m.data;
    if (d != null) {
      if (d.type == "data-update") {
        connected = 1;
        labels = d.labels;
        series = d.series;
        seriesNames = d.seriesNames;
        version = d.version;
        draw();
      }
      if (d.type == "click") {
        onClick(d.x, d.y);
      }
      if (d.type == "connect") {
        connected = 1;
        draw();
      }
    }
  }
  draw();
  sys.wait(200);
}
`,

  'systems-app.ks': `// 系统管理应用
let winId = 0;
let a = sys.args();
if (a != null) {
  if (a.winId != null) { winId = a.winId; }
}

fn draw() {
  let cmds = [];
  cmds.push({ op: "rect", x: 0, y: 0, w: 600, h: 340, fill: "#1a2236" });
  cmds.push({ op: "text", x: 12, y: 10, text: "系统管理", size: 13, color: "#e8edf7" });
  cmds.push({ op: "text", x: 12, y: 40, text: "子系统数量: " + kern.childCount(), size: 12, color: "#d6e2f5" });
  cmds.push({ op: "rect", x: 12, y: 70, w: 120, h: 28, fill: "#2e6e4a", radius: 6 });
  cmds.push({ op: "text", x: 28, y: 77, text: "新建子系统", size: 12, color: "#fff" });
  sys.submit2d(cmds, winId);
  return true;
}

while (true) {
  draw();
  sys.wait(500);
}
`
};

export function installSubAppSources(vfs) {
  for (const [name, src] of Object.entries(SUB_APP_SRC)) {
    try {
      vfs.write('/System/Programs/' + name, src);
    } catch (e) { }
  }
}
