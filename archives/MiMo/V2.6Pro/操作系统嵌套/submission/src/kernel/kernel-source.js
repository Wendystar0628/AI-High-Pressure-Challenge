// 内核源程序集合: 每个子系统由一份 kernel.sys 运行。
// 内核实现: 进程表、调度、等待/唤醒、消息、文件系统、系统调用分发、
//          显示提交、子系统承载进程管理。均可在编辑器中修改并重启生效。

export const KERNEL_MAIN = `# ============================================================
# kernel.sys — 嵌套操作系统内核程序
# 进程表 / 调度 / 消息 / 文件系统 / 系统调用分发 / 子系统管理
# 修改本文件并重启子系统后生效。
# ============================================================

var sysname = "system"
var is_root = false
var procs = []
var next_pid = 1
var vtime = 0
var tick_budget = 20000
var tick_dt = 16
var mem_quota = 8000000
var storage_quota = 4000000
var mem_used = 0
var storage_used = 0
var child_grant = 2500
var child_grant_cap = 8000
var sched_mode = 0
var fsroot = {}
var boot_files = {}
var wm_pid = 0
var kernel_error = ""
var paused = false
var rate = 1
var step_pending = 0
var input_queue = []
var last_frame = {}
var display_log = []
var stats = { kernel_work: 0, user_work: 0, ticks: 0 }

fn log(text) {
  host.log("[" + sysname + "] " + text)
}

fn boot(cfg) {
  sysname = cfg.name
  is_root = cfg.is_root
  if cfg.tick_budget != null
    tick_budget = cfg.tick_budget
  end
  if cfg.mem_quota != null
    mem_quota = cfg.mem_quota
  end
  if cfg.storage_quota != null
    storage_quota = cfg.storage_quota
  end
  if cfg.boot_files != null
    boot_files = cfg.boot_files
  end
  seed_fs()
  log("内核启动 " + sysname)
  wm_pid = spawn_named("wm.prog", "/Programs/wm.prog", {})
  spawn_named("desktop.prog", "/Programs/desktop.prog", {})
  return 0
}

fn seed_fs() {
  if is_root
    return 0
  end
  var ks = keys(boot_files)
  for path in ks
    fs_write(path, boot_files[path])
  end
  return 0
}

# ---------- 文件系统(子系统内核实现) ----------
fn norm_path(p) {
  if p == null
    return "/"
  end
  var s = str(p)
  if len(s) == 0
    return "/"
  end
  var parts = []
  var cur = ""
  var i = 0
  while i < len(s)
    var c = s[i]
    if c == "/"
      if cur != ".."
        if cur != "."
          if cur != ""
            push(parts, cur)
          end
        end
      else
        if len(parts) > 0
          parts = parts.slice(0, len(parts) - 1)
        end
      end
      cur = ""
    else
      cur = cur + c
    end
    i = i + 1
  end
  if cur != ""
    if cur != "."
      if cur != ".."
        push(parts, cur)
      end
    end
  end
  var out = ""
  for x in parts
    out = out + "/" + x
  end
  if out == ""
    return "/"
  end
  return out
}

fn fs_write(path, content) {
  var p = norm_path(path)
  if is_root
    return host.fsWrite(p, content)
  end
  var old = fsroot[p]
  if old != null
    storage_used = storage_used - len(old)
  end
  var sz = len(content)
  if storage_used + sz > storage_quota
    return { ok: false, error: "存储配额不足" }
  end
  fsroot[p] = content
  storage_used = storage_used + sz
  return { ok: true }
}

fn fs_read(path) {
  var p = norm_path(path)
  if is_root
    return host.fsRead(p)
  end
  var v = fsroot[p]
  return v
}

fn fs_list(path) {
  var p = norm_path(path)
  if is_root
    return host.fsList(p)
  end
  if p != "/"
    p = p + "/"
  end
  var out = []
  var ks = keys(fsroot)
  for k in ks
    if len(k) > len(p)
      if k.slice(0, len(p)) == p
        var rest = k.slice(len(p), len(k))
        if rest == ""
          push(out, { path: k, name: "", kind: "file", size: len(fsroot[k]) })
        else
          var cut = -1
          var j = 0
          while j < len(rest)
            if rest[j] == "/"
              cut = j
              j = len(rest)
            end
            j = j + 1
          end
          if cut < 0
            push(out, { path: k, name: rest, kind: "file", size: len(fsroot[k]) })
          else
            if cut == 0
            else
              var dname = rest.slice(0, cut)
              var exists = 0
              for o in out
                if o.name == dname
                  exists = 1
                end
              end
              if exists == 0
                push(out, { path: p + dname, name: dname, kind: "dir", size: 0 })
              end
            end
          end
        end
      end
    end
  end
  return out
}

fn fs_remove(path) {
  var p = norm_path(path)
  if is_root
    return host.fsRemove(p)
  end
  var v = fsroot[p]
  if v != null
    storage_used = storage_used - len(v)
    fsroot[p] = null
  end
  return { ok: true }
}

fn fs_exists(path) {
  var p = norm_path(path)
  if is_root
    return host.fsExists(p)
  end
  return fsroot[p] != null
}

# ---------- 进程管理 ----------
fn find_proc(pid) {
  for p in procs
    if p.pid == pid
      return p
    end
  end
  return null
}

fn spawn_named(name, path, args) {
  var src = fs_read(path)
  if src == null
    log("进程载入失败: " + path)
    return -1
  end
  var pid = next_pid
  next_pid = next_pid + 1
  var h = cpu.load(src, name, pid)
  if h == null
    log("程序编译失败: " + path)
    return -1
  end
  var p = { pid: pid, name: name, path: path, handle: h, state: "ready",
            quota: 3000, used: 0, inbox: [], wait_until: 0, wait_kind: "",
            error: "", app: "", win_id: "", args: args, created: vtime,
            has_wake: 0, wake_value: 0 }
  push(procs, p)
  cpu.resume(h, 0)
  return pid
}

fn kill_proc(pid) {
  var p = find_proc(pid)
  if p == null
    return false
  end
  cpu.kill(p.handle)
  p.state = "zombie"
  return true
}

# ---------- 消息 ----------
fn send_msg(from_pid, to_pid, msg) {
  var t = find_proc(to_pid)
  if t == null
    return { ok: false, error: "目标进程不存在" }
  end
  var env = { from: from_pid, to: to_pid, msg: msg, at: vtime }
  if t.wait_kind == "msg"
    if t.state == "wait"
      t.state = "ready"
      t.wait_kind = ""
      t.has_wake = 1
      t.wake_value = env
      return { ok: true }
    end
  end
  push(t.inbox, env)
  return { ok: true }
}

# ---------- 调度 ----------
fn schedule() {
  var budget = tick_budget
  var used = 0
  stats.ticks = stats.ticks + 1
  if paused == true
    return 0
  end
  if step_pending > 0
    step_pending = 0
    budget = tick_budget
  end
  var n = len(procs)
  if n == 0
    return 0
  end
  var idx = sched_mode
  var visited = 0
  while used < budget
    if visited >= n
      return used
    end
    var p = procs[idx % n]
    idx = idx + 1
    visited = visited + 1
    if p.state == "zombie"
    else
      if p.state == "suspended"
      else
        if p.state == "wait"
          if p.wait_kind == "time"
            if vtime >= p.wait_until
              p.state = "ready"
              p.wait_kind = ""
              p.has_wake = 1
              p.wake_value = 0
            end
          end
          if p.wait_kind == "msg"
            if len(p.inbox) > 0
              p.state = "ready"
              p.wait_kind = ""
              p.has_wake = 1
              p.wake_value = p.inbox[0]
              p.inbox = p.inbox.slice(1, len(p.inbox))
            end
          end
          if p.wait_kind == "msgtimeout"
            if len(p.inbox) > 0
              p.state = "ready"
              p.wait_kind = ""
              p.has_wake = 1
              p.wake_value = p.inbox[0]
              p.inbox = p.inbox.slice(1, len(p.inbox))
            else
              if vtime >= p.wait_until
                p.state = "ready"
                p.wait_kind = ""
                p.has_wake = 1
                p.wake_value = null
              end
            end
          end
        end
        if p.state == "ready"
          var slice = 600
          if p.quota < slice
            slice = p.quota
          end
          if budget - used < slice
            slice = budget - used
          end
          if slice > 0
            visited = 0
            if p.has_wake == 1
              p.has_wake = 0
              cpu.resolve(p.handle, p.wake_value)
            end
            var r = cpu.resume(p.handle, slice)
            used = used + r.work
            p.used = p.used + r.work
            stats.user_work = stats.user_work + r.work
            handle_result(p, r)
          end
        end
      end
    end
  end
  return used
}

fn handle_result(p, r) {
  if r.status == "done"
    if p.state != "zombie"
      p.state = "zombie"
    end
    return 0
  end
  if r.status == "error"
    p.state = "error"
    p.error = str(r.error)
    log("进程异常 #" + str(p.pid) + " " + p.error)
    return 0
  end
  if r.status == "trap"
    handle_trap(p, r.name, r.args)
    return 0
  end
  return 0
}

fn handle_trap(p, name, args) {
  if name == "log"
    log("#" + str(p.pid) + " " + str(args[0]))
    cpu.resolve(p.handle, 0)
    return 0
  end
  if name == "time"
    cpu.resolve(p.handle, vtime)
    return 0
  end
  if name == "self"
    cpu.resolve(p.handle, p.pid)
    return 0
  end
  if name == "wait"
    var ms = num(args[0])
    p.wait_until = vtime + ms
    p.wait_kind = "time"
    p.state = "wait"
    return 0
  end
  if name == "exit"
    p.state = "zombie"
    cpu.resolve(p.handle, 0)
    return 0
  end
  if name == "spawn"
    var np = spawn_named(str(args[0]), str(args[0]), args[1])
    cpu.resolve(p.handle, np)
    return 0
  end
  if name == "send"
    var r = send_msg(p.pid, num(args[0]), args[1])
    cpu.resolve(p.handle, r)
    return 0
  end
  if name == "recv"
    if len(p.inbox) > 0
      var m = p.inbox[0]
      p.inbox = p.inbox.slice(1, len(p.inbox))
      cpu.resolve(p.handle, m)
      return 0
    end
    var to = num(args[0])
    if to == 0
      p.wait_kind = "msg"
      p.state = "wait"
      return 0
    end
    p.wait_until = vtime + to
    p.wait_kind = "msgtimeout"
    p.state = "wait"
    return 0
  end
  if name == "readFile"
    cpu.resolve(p.handle, fs_read(str(args[0])))
    return 0
  end
  if name == "writeFile"
    var r2 = fs_write(str(args[0]), str(args[1]))
    cpu.resolve(p.handle, r2)
    return 0
  end
  if name == "listDir"
    cpu.resolve(p.handle, fs_list(str(args[0])))
    return 0
  end
  if name == "remove"
    cpu.resolve(p.handle, fs_remove(str(args[0])))
    return 0
  end
  if name == "mkdir"
    cpu.resolve(p.handle, { ok: true })
    return 0
  end
  if name == "draw"
    var cost = 20 + len(args[0]) * 4
    var r3 = cpu.resolve(p.handle, 0)
    last_frame[str(p.pid)] = args[0]
    return 0
  end
  if name == "scene3d"
    cpu.resolve(p.handle, 0)
    last_frame["s3d_" + str(p.pid)] = args[0]
    return 0
  end
  if name == "sceneResource"
    cpu.resolve(p.handle, 0)
    last_frame["s3res_" + str(p.pid)] = args[0]
    return 0
  end
  if name == "window"
    cpu.resolve(p.handle, 0)
    last_frame["win_" + str(p.pid)] = args[0]
    return 0
  end
  if name == "input"
    if len(input_queue) > 0
      var ev = input_queue[0]
      input_queue = input_queue.slice(1, len(input_queue))
      cpu.resolve(p.handle, ev)
    else
      cpu.resolve(p.handle, null)
    end
    return 0
  end
  if name == "project"
    var r4 = host.project(num(args[0]), args[1])
    cpu.resolve(p.handle, r4)
    return 0
  end
  if name == "chartPublish"
    var r5 = host.chartPublish(args[0])
    cpu.resolve(p.handle, r5)
    return 0
  end
  if name == "chartSubscribe"
    var r6 = host.chartSubscribe(args[0])
    cpu.resolve(p.handle, r6)
    return 0
  end
  if name == "chartData"
    cpu.resolve(p.handle, host.chartData())
    return 0
  end
  if name == "system"
    cpu.resolve(p.handle, host.systemCmd(args[0], args[1]))
    return 0
  end
  if name == "createSystem"
    var r7 = host.createSystem(args[0])
    cpu.resolve(p.handle, r7)
    return 0
  end
  if name == "snapshot"
    cpu.resolve(p.handle, host.snapshot(num(args[0])))
    return 0
  end
  if name == "restore"
    cpu.resolve(p.handle, host.restore(num(args[0]), args[1]))
    return 0
  end
  if name == "fork"
    cpu.resolve(p.handle, host.fork(num(args[0]), args[1]))
    return 0
  end
  if name == "childFsRead"
    cpu.resolve(p.handle, host.childFsRead(num(args[0]), str(args[1])))
    return 0
  end
  if name == "childFsWrite"
    cpu.resolve(p.handle, host.childFsWrite(num(args[0]), str(args[1]), str(args[2])))
    return 0
  end
  log("未知系统调用: " + str(name))
  cpu.resolve(p.handle, { ok: false, error: "未知系统调用" })
  return 0
}

# ---------- 主循环 ----------
var boot_done = 0
while true
  if boot_done == 0
    boot(host.cfg())
    boot_done = 1
  end
  vtime = host.now()
  var uw = schedule()
  stats.kernel_work = stats.kernel_work + 64
  host.frame(last_frame)
  last_frame = {}
  host.yieldTick(uw)
end
`;

// 用户程序集合
export const PROGRAM_SOURCES = {
  'wm.prog': `# wm.prog — 窗口管理程序(窗口次序/焦点/命中判断/输入分发)
var wins = []
var focus_id = 0
var next_win = 1
var dragging = ""

fn find_win(id) {
  for w in wins
    if w.id == id
      return w
    end
  end
  return null
}

fn raise_win(id) {
  var w = find_win(id)
  if w == null
    return 0
  end
  w.z = 1
  for o in wins
    if o.id != id
      o.z = o.z + 1
    end
  end
  focus_id = id
  return 0
}

fn hit_test(x, y) {
  var best = null
  for w in wins
    if w.min == 0
      if x >= w.x
        if x <= w.x + w.w
          if y >= w.y
            if y <= w.y + w.h
              if best == null
                best = w
              else
                if w.z < best.z
                  best = w
                end
              end
            end
          end
        end
      end
    end
  end
  return best
}

fn layout_frame() {
  var list = []
  for w in wins
    push(list, { id: w.id, x: w.x, y: w.y, w: w.w, h: w.h, z: w.z,
                 title: w.title, icon: w.icon, min: w.min, max: w.max,
                 focused: w.id == focus_id, app: w.app })
  end
  sys.window({ windows: list, focus: focus_id })
  return 0
}

sys.log("窗口管理器已启动")
while true
  var m = sys.recv(0)
  if m != null
    var msg = m.msg
    var t = msg.type
    if t == "win.open"
      var id = next_win
      next_win = next_win + 1
      var w = { id: id, x: msg.x, y: msg.y, w: msg.w, h: msg.h, z: 1,
                title: msg.title, icon: msg.icon, app: msg.app,
                owner: m.from, min: 0, max: 0 }
      push(wins, w)
      raise_win(id)
      sys.send(m.from, { type: "win.opened", id: id })
    else
      if t == "win.raise"
        raise_win(msg.id)
      else
        if t == "win.close"
          var nw = []
          for w in wins
            if w.id != msg.id
              push(nw, w)
            end
          end
          wins = nw
        else
          if t == "input"
            var ev = msg.event
            var w = hit_test(ev.x, ev.y)
            if ev.kind == "down"
              if w != null
                raise_win(w.id)
                sys.send(w.owner, { type: "input", event: ev, local_x: ev.x - w.x, local_y: ev.y - w.y })
              end
            else
              if w != null
                sys.send(w.owner, { type: "input", event: ev, local_x: ev.x - w.x, local_y: ev.y - w.y })
              else
                if focus_id != 0
                  var fw = find_win(focus_id)
                  if fw != null
                    sys.send(fw.owner, { type: "input", event: ev, local_x: ev.x - fw.x, local_y: ev.y - fw.y })
                  end
                end
              end
            end
          else
            if t == "win.move"
              var w2 = find_win(msg.id)
              if w2 != null
                w2.x = msg.x
                w2.y = msg.y
                if msg.w != null
                  w2.w = msg.w
                  w2.h = msg.h
                end
              end
            end
          end
        end
      end
    end
    layout_frame()
  else
    sys.wait(30)
    layout_frame()
  end
end
`,

  'desktop.prog': `# desktop.prog — 子系统桌面程序(壁纸/图标/任务栏)
var t = 0

fn sysname_label() {
  return "嵌套子系统"
}

sys.log("子系统桌面已启动")
while true
  t = t + 1
  var cmds = [
    { op: "rect", x: 0, y: 0, w: 4000, h: 3000, fill: "#101430" },
    { op: "text", x: 24, y: 20, text: sysname_label(), size: 13, color: "#9ba6cf" },
    { op: "rect", x: 0, y: 560, w: 4000, h: 40, fill: "#0c122c" },
    { op: "text", x: 16, y: 572, text: "子系统桌面", size: 12, color: "#e9edff" }
  ]
  sys.draw(cmds)
  sys.wait(200)
end
`,

  'filemgr.prog': `# filemgr.prog — 子系统文件管理器
var cwd = "/"
sys.log("文件管理器已启动")
while true
  var lst = sys.listDir(cwd)
  var cmds = [
    { op: "rect", x: 0, y: 0, w: 600, h: 400, fill: "#141a3a" },
    { op: "text", x: 12, y: 10, text: "文件管理器 " + cwd, size: 13, color: "#e9edff" }
  ]
  var y = 40
  for it in lst
    push(cmds, { op: "text", x: 20, y: y, text: it.name, size: 12, color: "#c8d4ff" })
    y = y + 22
  end
  sys.draw(cmds)
  sys.wait(300)
end
`,

  'editor.prog': `# editor.prog — 子系统文本与程序编辑器
sys.log("编辑器已启动")
var text = "# 在此编辑程序\\n"
while true
  sys.draw([
    { op: "rect", x: 0, y: 0, w: 600, h: 400, fill: "#0c122c" },
    { op: "text", x: 12, y: 10, text: "程序编辑器", size: 13, color: "#e9edff" },
    { op: "text", x: 12, y: 36, text: text, size: 12, color: "#c8d4ff" }
  ])
  sys.wait(300)
end
`,

  'tasks.prog': `# tasks.prog — 子系统进程管理器
sys.log("进程管理器已启动")
while true
  sys.draw([
    { op: "rect", x: 0, y: 0, w: 600, h: 400, fill: "#141a3a" },
    { op: "text", x: 12, y: 10, text: "进程管理器", size: 13, color: "#e9edff" }
  ])
  sys.wait(400)
end
`,

  'player.prog': `# player.prog — 三维场景播放器(时序进程)
var pos = 0
var playing = 0
var rate = 1
var duration = 15000
sys.log("播放器已启动")
while true
  if playing == 1
    pos = pos + 100
    if pos > duration
      pos = duration
      playing = 0
    end
  end
  sys.scene3d({ t: pos / 1000.0, playing: playing, rate: rate })
  sys.draw([
    { op: "rect", x: 0, y: 340, w: 600, h: 60, fill: "#0c122c" },
    { op: "text", x: 12, y: 356, text: "播放器 " + str(pos / 1000.0) + "s", size: 12, color: "#e9edff" }
  ])
  sys.wait(100)
end
`,

  'charts.prog': `# charts.prog — 图表工作台
sys.log("图表工作台已启动")
while true
  var data = sys.chartData()
  sys.draw([
    { op: "rect", x: 0, y: 0, w: 600, h: 400, fill: "#141a3a" },
    { op: "text", x: 12, y: 10, text: "图表工作台", size: 13, color: "#e9edff" }
  ])
  sys.wait(200)
end
`,

  'flightctl.prog': `# flightctl.prog — 飞控程序(排演中保持飞行)
# 经 flight.sensors() 读取传感器, flight.write() 写入总距与舵面
sys.log("飞控程序已启动")
while true
  sys.wait(40)
end
`,

  'accumulate.prog': `# 累加计算
var n = 10
var sum = 0
var i = 1
while i <= n
  sum = sum + i
  i = i + 1
end
sys.log("累加结果: " + str(sum))
`,

  'send.prog': `# 消息发送
var target = 1
sys.send(target, { from: sys.self(), text: "hello", at: sys.time() })
sys.log("已发送消息")
`,

  'recv.prog': `# 消息接收
sys.log("等待消息中")
var m = sys.recv(5000)
if m == null
  sys.log("超时未收到消息")
else
  sys.log("收到消息: " + str(m))
end
`,

  'spin.prog': `# 持续计算(不主动让出,检验调度公平性)
var n = 0
while true
  n = n + 1
end
`,
};

export const KERNEL_SOURCES = { 'kernel.sys': KERNEL_MAIN };
export const ALL_PROGRAMS = PROGRAM_SOURCES;
