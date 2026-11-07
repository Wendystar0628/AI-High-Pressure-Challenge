'use strict';
const fs = require('fs');
const path = require('path');
const U = require('./util');
const { VFS } = require('./vfs');
const { CPU, parseSource } = require('./vm');
const P = require('./programs');
const SCENE = require('./scene');

const STEP_DT = 0.1;          // 1 倍速下每个逻辑步推进的虚拟秒数
const STEP_MS = 100;          // 逻辑步的实际间隔（毫秒）
const BUDGETS = [1800, 1250, 900, 700];
const MEMORY = [32768, 24576, 18432, 14336];
const STORAGE = [800000, 640000, 520000, 460000];

class Budget {
  constructor(total) { this.total = total; this.used = 0; this.frames = [total]; }
  remaining() {
    let r = this.total - this.used;
    for (const f of this.frames) r = Math.min(r, f);
    return Math.max(0, r);
  }
  can(n) { return this.remaining() >= n; }
  take(n) {
    const x = Math.min(n, this.remaining());
    if (x <= 0) return 0;
    this.used += x;
    for (let i = 0; i < this.frames.length; i++) this.frames[i] = Math.max(0, this.frames[i] - x);
    return x;
  }
  pushFrame(cap) { this.frames.push(Math.max(0, Math.min(cap, this.remaining()))); }
  popFrame() { if (this.frames.length > 1) this.frames.pop(); }
}

const DEFAULT_WALLPAPERS = ['aurora', 'meadow', 'dusk', 'night'];

class Sys {
  constructor(id, parentId, depth, name) {
    this.id = id; this.parentId = parentId; this.depth = depth;
    this.name = name || (depth === 0 ? '根系统' : id);
    this.state = 'running'; this.rate = 1; this.virtualTime = 0;
    this.currentDt = STEP_DT; this.lastConsumed = 0; this.lastGrant = 0;
    this.config = {
      budget: BUDGETS[Math.min(depth, 3)], memory: MEMORY[Math.min(depth, 3)],
      storage: STORAGE[Math.min(depth, 3)]
    };
    this.childGrants = {};
    this.grantFromParent = this.config.budget;
    this.fs = new VFS();
    this.cpu = new CPU();
    this.kernelCpu = null; this.kernelPid = null;
    this.kernelSourcePath = null; this.kernelError = null;
    this.windows = []; this.focusWinId = null; this.zTop = 10;
    this.appState = {}; this.appActions = {}; this.processMeta = {};
    this.spawnRequests = []; this.errors = []; this.logs = [];
    this.rngState = 20240617 + depth * 7919;
    this.children = []; this.carriers = {};
    this.singleStepPending = false; this.stepping = false;
    this.memoryUsed = 0;
    this.desktop = {
      wallpaper: DEFAULT_WALLPAPERS[depth % DEFAULT_WALLPAPERS.length],
      accent: ['#7c5cff', '#ffb020', '#28c2a0', '#ff6b8b'][depth % 4],
      scale: 1, theme: 'light', dnd: false,
      startOpen: false, notificationsOpen: false, widgetsVisible: false,
      calendarMonth: null, timer: { duration: 5, remaining: 5, running: false, done: false },
      stopwatch: { running: false, elapsed: 0, laps: [] },
      notes: [], clipboard: [], notifications: [], unread: 0
    };
    this.runCounter = 0;
  }
  serialize() {
    return {
      id: this.id, parentId: this.parentId, depth: this.depth, name: this.name,
      state: this.state, rate: this.rate, virtualTime: this.virtualTime,
      config: U.deepClone(this.config), childGrants: U.deepClone(this.childGrants),
      grantFromParent: this.grantFromParent, fs: this.fs.serialize(),
      cpu: U.deepClone(this.cpu), kernelPid: this.kernelPid,
      kernelProc: this.kernelCpu && this.kernelPid ? U.deepClone(this.kernelCpu.procs[this.kernelPid]) : null,
      kernelSourcePath: this.kernelSourcePath, kernelError: this.kernelError,
      windows: U.deepClone(this.windows), focusWinId: this.focusWinId, zTop: this.zTop,
      appState: U.deepClone(this.appState), appActions: U.deepClone(this.appActions),
      processMeta: U.deepClone(this.processMeta), spawnRequests: U.deepClone(this.spawnRequests),
      errors: U.deepClone(this.errors), logs: U.deepClone(this.logs), rngState: this.rngState,
      children: U.deepClone(this.children), carriers: U.deepClone(this.carriers),
      memoryUsed: this.memoryUsed, desktop: U.deepClone(this.desktop), runCounter: this.runCounter
    };
  }
  static restore(o) {
    const s = new Sys(o.id, o.parentId, o.depth, o.name);
    for (const k in o) {
      if (k === 'fs') { s.fs = VFS.deserialize(o.fs); }
      else if (k === 'cpu') {
        s.cpu = new CPU(); s.cpu.procs = U.deepClone(o.cpu.procs || {});
        s.cpu.traps = U.deepClone(o.cpu.traps || []); s.cpu.nextPid = o.cpu.nextPid || 1;
      } else s[k] = U.deepClone(o[k]);
    }
    return s;
  }
}

class Engine {
  constructor(opts) {
    opts = opts || {};
    this.dataDir = opts.dataDir || null;
    this.width = opts.width || 1440;
    this.height = opts.height || 900;
    this.systems = {}; this.innerCounter = 0;
    this.budget = new Budget(BUDGETS[0]);
    this.stepCount = 0; this.stepMs = STEP_MS; this.stepDt = STEP_DT;
    this.emitter = new U.Emitter();
    this.gfx = null; this.runtime = null;
    this.connections = []; this.projections = [];
    this.readyResolve = null;
    this.readyPromise = new Promise(r => { this.readyResolve = r; });
    this._dirty = false;
    this.root = null;
    this.init();
  }
  on(k, fn) { return this.emitter.on(k, fn); }
  emit(k, v) { this.emitter.emit(k, v); }

  // ---------------- 初始化与预置文件 ----------------
  init() {
    U.resetIds();
    const root = new Sys('outer', null, 0, '根系统');
    root.kernelCpu = root.cpu;
    this.systems.outer = root;
    this.root = root;
    this.seedFS(root, 0);
    root.kernelSourcePath = '/System/kernel.prog';
    try { this.installKernel(root, root); }
    catch (e) { root.kernelError = '根内核装载失败: ' + e.message; }
    this.loadPersisted();
    this.openInitialWindows(root);
    this.startLoop();
  }
  systemDir(sys) { return '/Systems/' + sys.id; }

  seedFS(sys, depth) {
    const f = sys.fs;
    f.ensureDir('/Documents'); f.ensureDir('/Demo'); f.ensureDir('/Programs');
    f.ensureDir('/System/programs'); f.ensureDir('/Snapshots'); f.ensureDir('/Recycle Bin');
    f.ensureDir('/Pictures'); f.ensureDir('/说明');
    const progs = {
      '/Programs/accumulate.prog': P.ACCUMULATE, '/Programs/sender.prog': P.SENDER,
      '/Programs/receiver.prog': P.RECEIVER, '/Programs/wait.prog': P.WAITPROG,
      '/Programs/busy.prog': P.BUSY, '/Programs/filedemo.prog': P.FILEDEMO,
      '/System/compiler.prog': P.COMPILER, '/System/kernel.prog': P.KERNEL,
      '/System/controller.prog': P.CONTROLLER, '/System/programs/app_loop.prog': P.APP_LOOP,
      '/System/programs/chart_receiver.prog': P.CHART_RECEIVER,
      '/System/programs/chart_draw.prog': P.CHART_DRAW,
      '/System/programs/player_driver.prog': P.PLAYER_DRIVER,
      '/System/programs/player_flight.prog': P.FLIGHT,
      '/System/programs/player_fx.prog': P.FX
    };
    for (const p in progs) if (!f.exists(p)) f.write(p, progs[p], 'prog');
    if (!f.exists('/说明/操作说明.md')) f.write('/说明/操作说明.md', require('./docs').text, 'md');
    if (!f.exists('/Documents/欢迎.txt')) f.write('/Documents/欢迎.txt', '欢迎使用「操作系统嵌套」。\n从开始菜单或桌面图标启动应用；用「系统」面板创建直属子系统。\n', 'txt');
    if (depth === 0) {
      if (!f.exists('/Demo/sample.sheet')) f.write('/Demo/sample.sheet', SCENE.defaultSheetRaw(), 'sheet');
      if (!f.exists('/Demo/helicopter-24.scene')) f.write('/Demo/helicopter-24.scene', JSON.stringify(SCENE.buildDefaultScene()), 'scene');
      if (!f.exists('/Recycle Bin/deleted-note.txt')) {
        f.write('/Recycle Bin/deleted-note.txt', '这是一份已删除的示例便笺（可从回收站恢复）。', 'txt');
        const n = f.node('/Recycle Bin/deleted-note.txt'); if (n) n.origPath = '/Documents/旧便笺.txt';
      }
    } else {
      if (!f.exists('/Demo/helicopter-24.scene')) f.write('/Demo/helicopter-24.scene', JSON.stringify(SCENE.buildDefaultScene()), 'scene');
      if (!f.exists('/Documents/场景说明.txt')) f.write('/Documents/场景说明.txt', '本系统预置一份直升机场景副本，可从文件管理器用播放器打开。\n', 'txt');
    }
  }

  installKernel(sys, parent) {
    // 内核程序是父系统文件系统中的普通程序文件，由承载进程（父系统 CPU 中的进程）执行。
    let src;
    if (sys.id === 'outer') src = sys.fs.read('/System/kernel.prog');
    else {
      const kp = this.systemDir(sys);
      parent.fs.ensureDir(kp);
      if (!parent.fs.exists(kp + '/kernel.prog')) parent.fs.write(kp + '/kernel.prog', parent.fs.read('/System/kernel.prog') || P.KERNEL, 'prog');
      sys.kernelSourcePath = kp + '/kernel.prog';
      src = parent.fs.read(sys.kernelSourcePath);
    }
    if (src == null) throw new Error('内核源文件不存在');
    let code;
    try { code = parseSource(src); }
    catch (e) { sys.kernelError = '内核编译错误: ' + e.message; throw e; }
    sys.kernelError = null;
    sys.kernelCpu = parent.cpu;
    if (sys.kernelPid && sys.kernelCpu.procs[sys.kernelPid]) sys.kernelCpu.kill(sys.kernelPid);
    sys.kernelPid = sys.kernelCpu.spawn(code, { name: '内核 ' + sys.id, kind: 'kernel', args: { sysId: sys.id } });
    sys.kernelCpu.procs[sys.kernelPid].quota = 0;
    if (sys.id !== 'outer') parent.carriers[sys.id] = { pid: sys.kernelPid, work: 0, label: '承载进程 · ' + sys.id };
  }

  openInitialWindows(sys) {
    // 默认只呈现桌面，不自动打开演示窗口；子系统启动时由 createSystem 打开场景窗口。
  }

  // ---------------- 逻辑步与调度 ----------------
  startLoop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.logicalStep(), STEP_MS);
  }
  logicalStep() {
    this.budget = new Budget(this.root.config.budget);
    this.budget.pushFrame(this.root.config.budget);
    // 暂停子树的一次固定逻辑步（覆盖子树，后代仍遵守各自暂停状态）
    for (const id in this.systems) {
      const s = this.systems[id];
      if (!s.singleStepPending) continue;
      s.singleStepPending = false;
      if (s.id === 'outer' || this.ancestorPaused(s.parentId)) continue;
      const before = this.budget.remaining();
      this.budget.pushFrame(Math.min(before, s.config.budget, s.grantFromParent || s.config.budget));
      const saved = s.state; s.state = 'running'; s.stepping = true;
      this.runKernel(s, STEP_DT * s.rate);
      s.state = saved; s.stepping = false;
      this.budget.popFrame();
      this.emit('step');
    }
    this.runKernel(this.root, STEP_DT * this.root.rate);
    this.budget.popFrame();
    this.stepCount++;
    this.updateMemory();
    if (this.runtime) this.runtime.onStep(this);
    if (this.gfx) this.gfx.renderAll();
    this.emit('step');
    if (this._dirty) { this.savePersisted(); this._dirty = false; }
  }
  runKernel(sys, dt) {
    if (sys.state !== 'running') return;
    if (sys.kernelError) return;
    sys.currentDt = dt;
    sys.virtualTime += dt;
    const cpu = sys.kernelCpu;
    const handler = this.makeDevHandler(sys);
    // 每个逻辑步向内核发一次「步开始」信号：重置其调度回合标志，保证直属子系统按步拨付。
    const kp = cpu.procs[sys.kernelPid];
    if (kp) kp.vars.first = 1;
    try { cpu.step(sys.kernelPid, 1e9, this.budget, handler, { scope: sys }); }
    catch (e) {
      sys.kernelError = '内核运行异常: ' + e.message;
      sys.state = 'error';
      this.notify('内核错误', sys.name + ': ' + sys.kernelError, sys.id);
    }
  }
  updateMemory() {
    for (const id in this.systems) {
      const s = this.systems[id];
      let m = 0;
      for (const pid in s.cpu.procs) {
        const p = s.cpu.procs[pid];
        p.mem = 64 + p.code.length * 2 + U.jsonSize(p.vars) + U.jsonSize(p.inbox) + U.jsonSize(p.out);
        m += p.mem;
      }
      s.memoryUsed = m;
    }
  }

  makeDevHandler(sys) {
    const self = this;
    return function (name, args, ctx) {
      const proc = ctx.proc;
      const privileged = proc && (proc.kind === 'kernel' || proc.kind === 'carrier' || proc.kind === 'compiler');
      if (!privileged && !(proc && proc.kind === 'app' && (name === 'app_tick' || name === 'display'))) {
        return { __err: '权限不足：dev 设备调用仅限内核与编译器' };
      }
      args = args || [];
      const A = i => args[i];
      switch (name) {
        case 'budget': return self.budget.remaining();
        case 'time': return sys.virtualTime;
        case 'arg': return proc ? proc.args : {};
        case 'take_requests': { const r = sys.spawnRequests.slice(); sys.spawnRequests.length = 0; return r; }
        case 'compile': return self.compileProgram(sys, String(A(0)), ctx.cpu);
        case 'cpu_spawn': {
          const code = Array.isArray(A(0)) ? A(0) : null;
          if (!code) return { __err: '编译结果无效' };
          const a = (A(1) && typeof A(1) === 'object' && !Array.isArray(A(1))) ? A(1) : {};
          const estimate = 64 + code.length * 2 + U.jsonSize(a);
          if (sys.memoryUsed + estimate > sys.config.memory) return { __err: '内存配额不足：无法启动进程' };
          const pid = sys.cpu.spawn(code, { name: a.name || '程序', kind: a.kind || 'user', args: a,
            appId: a.appId || null, quota: a.quota || 0, owner: a.owner || null, createdAt: sys.virtualTime });
          sys.processMeta[pid] = { kind: a.kind || 'user', appId: a.appId || null, label: a.name || '程序', remaining: 0 };
          return pid;
        }
        case 'cpu_step': {
          const pid = String(A(0)); const units = Math.max(1, Math.floor(Number(A(1)) || 1));
          const h = self.makeDevHandler(sys);
          const r = sys.cpu.step(pid, units, self.budget, h, { scope: sys });
          const p = sys.cpu.procs[pid];
          if (p && sys.processMeta[pid]) sys.processMeta[pid].remaining = Math.max(0, (sys.processMeta[pid].remaining || 0) - r.used);
          return r.used;
        }
        case 'procs_snapshot': {
          const snap = sys.cpu.snapshot();
          if (sys.kernelCpu === sys.cpu) delete snap[sys.kernelPid];
          for (const pid in snap) if (snap[pid].kind === 'kernel' || snap[pid].kind === 'carrier') delete snap[pid];
          return snap;
        }
        case 'pull_trap': return sys.cpu.traps.shift() || null;
        case 'resolve': return self.resolveProc(sys, String(A(0)), A(1));
        case 'fail': return self.failProc(sys, String(A(0)), String(A(1)));
        case 'hold': {
          const p = sys.cpu.procs[String(A(0))];
          if (p) { p.status = 'wait'; p.waitKind = 'sleep'; p.waitUntil = sys.virtualTime + (Number(A(1)) || 0); }
          return 1;
        }
        case 'hold_recv': {
          const p = sys.cpu.procs[String(A(0))];
          if (p) { p.status = 'wait'; p.waitKind = 'recv'; }
          return 1;
        }
        case 'wake': return self.resolveProc(sys, String(A(0)), sys.virtualTime);
        case 'wake_recv': {
          const p = sys.cpu.procs[String(A(0))];
          if (!p || !p.inbox.length) return 0;
          return self.resolveProc(sys, String(A(0)), p.inbox.shift());
        }
        case 'inbox_push': {
          const p = sys.cpu.procs[String(A(0))];
          if (!p) return 0;
          p.inbox.push(U.deepClone(A(1)));
          if (p.inbox.length > 500) p.inbox.shift();
          return 1;
        }
        case 'cpu_kill': { sys.cpu.kill(String(A(0))); return 1; }
        case 'set_quota': { const p = sys.cpu.procs[String(A(0))]; if (p) p.quota = Number(A(1)) || 0; return 1; }
        case 'disk_read': {
          const pth = String(A(0)); const c = sys.fs.read(pth);
          self.budget.take(1 + Math.floor((c ? c.length : 0) / 24));
          return c === null ? { __err: '文件不存在: ' + pth } : c;
        }
        case 'disk_write': {
          const pth = String(A(0)); const c = String(A(1) == null ? '' : A(1));
          self.budget.take(1 + Math.floor(c.length / 24));
          if (sys.fs.usage() + c.length > sys.config.storage) return { __err: '存储配额不足: ' + pth };
          const ok = sys.fs.write(pth, c);
          self._dirty = true;
          return ok ? 1 : { __err: '写入失败: ' + pth };
        }
        case 'disk_list': {
          const l = sys.fs.list(String(A(0)));
          self.budget.take(1 + Math.floor((l ? l.length : 0) / 4));
          return l === null ? { __err: '目录不存在' } : l.map(x => x.name + (x.type === 'dir' ? '/' : ''));
        }
        case 'disk_delete': { const ok = sys.fs.remove(String(A(0))); self._dirty = true; return ok ? 1 : { __err: '删除失败' }; }
        case 'disk_usage': return sys.fs.usage();
        case 'storage_cap': return sys.config.storage;
        case 'display': {
          const pid = String(A(0)); const p = sys.cpu.procs[pid];
          if (!p || !p.appId) return 0;
          let d = U.deepClone(A(1));
          const st = sys.appState[p.appId];
          self.budget.take(1 + Math.floor(U.jsonSize(d) / 32));
          if (d && Array.isArray(d.rows) && d.version !== undefined) {
            d = { type: 'chart', version: d.version, rows: d.rows, series: d.series || [],
              labelCol: d.labelCol, range: d.range, docTitle: d.docTitle || (st ? st.sourceTitle : '实时数据'),
              chartType: st ? st.chartType : 'bar', title: st ? st.sourceTitle : '实时数据',
              selectionLabel: st ? st.selectionLabel : null };
            if (st) { st.version = d.version; st.values = d.rows; st.cache.push(U.deepClone(d)); if (st.cache.length > 40) st.cache.shift(); }
          }
          self.submitDisplay(sys, p.appId, d);
          return 1;
        }
        case 'app_tick': {
          const pid = String(A(0)); const p = sys.cpu.procs[pid];
          if (!p || !p.appId || !self.runtime) return { value: 1, work: 1 };
          const avail = self.budget.remaining();
          const r = self.runtime.tick(sys, p.appId, { avail, input: A(1) });
          const work = Math.max(1, Math.min(avail, r.work || 1));
          self.budget.take(work);
          return r.value === undefined ? {} : r.value;
        }
        case 'child_ids': return sys.children.filter(id => self.systems[id] && self.systems[id].state === 'running');
        case 'child_grant': return sys.childGrants[String(A(0))] === undefined ? Math.floor(sys.config.budget * 0.55) : sys.childGrants[String(A(0))];
        case 'run_child': {
          const cid = String(A(0)); const give = Math.max(0, Number(A(1)) || 0);
          const child = self.systems[cid];
          if (!child || child.state !== 'running') return 0;
          const before = self.budget.remaining();
          const cap = Math.min(before, give, child.config.budget);
          if (cap <= 0) return 0;
          child.grantFromParent = give; child.lastGrant = give;
          self.budget.pushFrame(cap);
          self.runKernel(child, sys.currentDt * child.rate);
          self.budget.popFrame();
          const used = Math.max(0, before - self.budget.remaining());
          if (sys.carriers[cid]) { sys.carriers[cid].work += used; sys.carriers[cid].label = '承载进程 · ' + cid; }
          sys.lastConsumed += used;
          self.emit('carrier', { parent: sys.id, child: cid, used });
          return used;
        }
        case 'misc': return self.miscSyscall(sys, proc, String(A(0)), A(1) || [], String(A(2)));
        default: return { __err: '未知设备调用: ' + name };
      }
    };
  }

  compileProgram(sys, srcPath, cpu) {
    // 用系统内的编译器程序把源文件降低为可执行指令表；编译本身计入该系统预算。
    const prior = this.budget;
    let temp = null;
    // 编译器本身是较长的程序，编译自身需要独立、充足的逻辑预算；仍按父系统工作计量并受配额约束。
    if (!this.budget || this.budget.remaining() < 8000) { temp = new Budget(24000); this.budget = temp; }
    try {
      let srcText;
      try { srcText = sys.fs.read(srcPath); }
      catch (e) { return { __err: '读取源文件失败: ' + e.message }; }
      if (srcText == null) return { __err: '程序文件不存在: ' + srcPath };
      const compSrc = sys.fs.read('/System/compiler.prog');
      let code;
      try { code = parseSource(compSrc || P.COMPILER); }
      catch (e) { return { __err: '编译器源文件损坏: ' + e.message }; }
      const workCpu = sys.cpu;
      const tmp = workCpu.spawn(code, { name: '编译器', kind: 'compiler', args: { path: srcPath } });
      const handler = this.makeDevHandler(sys);
      let guard = 0;
      while (guard++ < 4000 && workCpu.procs[tmp].status === 'ready' && this.budget && this.budget.remaining() > 0) {
        workCpu.step(tmp, 48, this.budget, handler, { scope: sys });
      }
      const p = workCpu.procs[tmp];
      const lowered = p && p.out.length ? p.out[p.out.length - 1] : '';
      if (workCpu.procs[tmp]) delete workCpu.procs[tmp];
      if (!lowered || String(lowered)[0] === '#') return { __err: '编译器未产生有效输出（编译器可能被改坏）' };
      try { return parseSource(lowered); }
      catch (e) { return { __err: '编译结果无法装载: ' + e.message }; }
    } finally {
      if (temp) {
        // 编译是父系统的工作：把一部分工作量计入当前逻辑步读数（不独占全部步预算）。
        if (prior) prior.take(Math.min(prior.remaining(), 40 + Math.floor(temp.used / 40)));
        this.budget = prior;
      }
    }
  }

  resolveProc(sys, pid, value) {
    const p = sys.cpu.procs[pid];
    if (!p || pid === 'null' || pid === 'undefined') return 0;
    if (p.pendingSys && p.pendingSys.out) p.vars[p.pendingSys.out] = U.deepClone(value);
    p.pendingSys = null; p.status = 'ready'; p.waitKind = null; p.waitUntil = null;
    return 1;
  }
  failProc(sys, pid, msg) {
    const p = sys.cpu.procs[pid];
    if (p) {
      p.lastError = msg;
      p.out.push('ERR: ' + msg);
      sys.errors.unshift({ t: sys.virtualTime, pid, msg });
      if (sys.errors.length > 60) sys.errors.pop();
    }
    this.resolveProc(sys, pid, 0);
    if (sys.id === 'outer') this.notify('程序错误', msg, sys.id);
    return 1;
  }
  miscSyscall(sys, proc, name, args, pid) {
    const A = i => args[i];
    switch (name) {
      case 'rand': {
        sys.rngState = (sys.rngState * 1103515245 + 12345) & 0x7fffffff;
        return { value: sys.rngState / 0x7fffffff };
      }
      case 'clock': return { value: { t: sys.virtualTime, rate: sys.rate, state: sys.state } };
      case 'log': { sys.logs.push({ t: sys.virtualTime, pid, text: String(A(0)) }); if (sys.logs.length > 200) sys.logs.shift(); return { value: 1 }; }
      case 'notify': { this.notify(String(A(0) || '通知'), String(A(1) || ''), sys.id); return { value: 1 }; }
      case 'self': return { value: pid };
      default:
        if (this.runtime) return this.runtime.syscall(sys, proc, name, args, pid);
        return { __err: '未知系统调用: ' + name };
    }
  }

  // ---------------- 进程与程序 ----------------
  launchProgram(sys, srcPath, args, opts) {
    opts = opts || {};
    sys.spawnRequests.push({ path: srcPath, args: Object.assign({ name: opts.name || srcPath, kind: opts.kind || 'user', appId: opts.appId || null }, args || {}), replyTo: null });
    this.emit('structure');
  }
  spawnInternal(sys, srcPath, args, opts) {
    // 内核启动的应用协作进程：同样经过系统内编译器。
    const code = this.compileProgram(sys, srcPath, sys.cpu);
    if (!Array.isArray(code)) {
      sys.errors.unshift({ t: sys.virtualTime, pid: '-', msg: String(code.__err) });
      return null;
    }
    const a = Object.assign({ name: opts && opts.name || srcPath, kind: (opts && opts.kind) || 'app', appId: (opts && opts.appId) || null }, args || {});
    const pid = sys.cpu.spawn(code, { name: a.name, kind: a.kind, args: a, appId: a.appId, createdAt: sys.virtualTime });
    sys.processMeta[pid] = { kind: a.kind, appId: a.appId, label: a.name, remaining: 0 };
    return pid;
  }
  procList(sys) {
    const out = [];
    for (const pid in sys.cpu.procs) {
      const p = sys.cpu.procs[pid];
      if (p.kind === 'kernel' || p.kind === 'carrier') continue;
      out.push({
        pid, name: p.name, kind: p.kind, status: p.status, waitKind: p.waitKind,
        work: p.workDone, remaining: (sys.processMeta[pid] && sys.processMeta[pid].remaining) || 0,
        mem: p.mem, quota: p.quota, appId: p.appId, error: p.lastError, inbox: p.inbox.length,
        out: p.out.slice(-8)
      });
    }
    for (const cid in sys.carriers) {
      const c = sys.carriers[cid];
      const child = this.systems[cid];
      out.push({ pid: c.pid, name: c.label, kind: 'carrier', status: child ? child.state : 'stopped',
        work: c.work, remaining: 0, mem: child ? child.memoryUsed : 0, quota: sys.childGrants[cid] || 0,
        appId: null, error: child ? child.kernelError : null, inbox: 0, out: [] });
    }
    return out;
  }
  suspendProc(sys, pid) { const p = sys.cpu.procs[pid]; if (p && p.status !== 'ended') p.status = 'suspended'; this.emit('structure'); }
  resumeProc(sys, pid) { const p = sys.cpu.procs[pid]; if (p && p.status === 'suspended') p.status = p.pendingSys ? 'wait' : 'ready'; this.emit('structure'); }
  killProc(sys, pid) {
    const p = sys.cpu.procs[pid]; if (!p) return;
    sys.cpu.kill(pid);
    if (p.appId) this.releaseAppProcesses(sys, p.appId, pid);
    this.emit('structure');
  }
  releaseAppProcesses(sys, appId, exceptPid) {
    for (const pid in sys.cpu.procs) {
      const p = sys.cpu.procs[pid];
      if (p.appId === appId && pid !== exceptPid) sys.cpu.kill(pid);
    }
  }

  // ---------------- 窗口 ----------------
  openWindow(sys, appType, opts) {
    opts = opts || {};
    const id = U.uid('win');
    const w = {
      id, systemId: sys.id, appType, title: opts.title || this.defaultTitle(appType),
      x: opts.x === undefined ? 90 + (sys.windows.length % 4) * 34 : opts.x,
      y: opts.y === undefined ? 70 + (sys.windows.length % 4) * 28 : opts.y,
      w: opts.w || 760, h: opts.h || 500,
      state: 'normal', z: ++sys.zTop, restore: null,
      snap: null, data: opts.data || {}, closable: opts.closable !== false
    };
    sys.windows.push(w);
    sys.focusWinId = id;
    sys.appState[id] = this.runtime ? this.runtime.initAppState(sys, appType, w, opts) : { appType, winId: id };
    sys.appActions[id] = [];
    // 应用驱动进程：由内核通过 spawn 请求启动（系统窗口由宿主承载，不另启驱动进程）。
    if (!opts.noDriver) {
      const driver = appType === 'player' ? '/System/programs/player_driver.prog' : '/System/programs/app_loop.prog';
      sys.spawnRequests.push({ path: driver,
        args: { name: this.defaultTitle(appType), kind: 'app', appId: id, appType }, replyTo: null });
    }
    if (this.runtime) this.runtime.onWindowOpen(this, sys, w, opts);
    this.emit('window', { sys, win: w });
    return w;
  }
  defaultTitle(t) {
    return ({ files: '文件管理器', spreadsheet: '电子表格', widgets: '桌面小组件', editor: '文本与程序编辑器',
      tasks: '任务管理器', settings: '设置', browser: '浏览器', player: '三维场景播放器',
      charts: '图表工作台', projection: '投送窗口', system: '子系统管理', help: '操作说明', notes: '便笺',
      'system-window': '子系统桌面' })[t] || t;
  }
  closeWindow(sys, winId, opts) {
    opts = opts || {};
    const w = sys.windows.find(x => x.id === winId);
    if (!w) return;
    sys.windows = sys.windows.filter(x => x.id !== winId);
    for (const pid in sys.cpu.procs) if (sys.cpu.procs[pid].appId === winId) sys.cpu.kill(pid);
    delete sys.appState[winId]; delete sys.appActions[winId];
    if (sys.focusWinId === winId) sys.focusWinId = sys.windows.length ? sys.windows[sys.windows.length - 1].id : null;
    // 关闭源窗口结束对应投送
    for (const p of this.projections.slice()) {
      if (p.sourceSystemId === sys.id && p.sourceWindowId === winId) {
        this.closeWindow(this.systems[p.targetSystemId], p.windowId);
        this.projections = this.projections.filter(x => x !== p);
        this.notify('投送结束', '源窗口已关闭，投送视图结束', p.targetSystemId);
      }
    }
    // 关闭图表释放订阅
    for (const c of this.connections) {
      if (c.targetSystemId === sys.id && c.targetWinId === winId && c.state === 'connected') {
        c.state = 'disconnected'; c.recvPid = null; c.drawPid = null;
      }
    }
    this.emit('windowclose', { sys, winId });
    this.emit('structure');
  }
  focusWindow(sys, winId) {
    const w = sys.windows.find(x => x.id === winId); if (!w) return;
    w.z = ++sys.zTop; sys.focusWinId = winId;
    sys.desktop.startOpen = false;
    this.emit('focus', { sys, winId });
  }
  appAction(sys, winId, action, payload) {
    if (!sys.appActions[winId]) sys.appActions[winId] = [];
    sys.appActions[winId].push({ action, payload: U.deepClone(payload || {}) });
  }

  // ---------------- 显示投送 ----------------
  submitDisplay(sys, winId, data) {
    const st = sys.appState[winId]; if (!st) return;
    st.display = data;
    if (this.gfx) this.gfx.submit(sys.id, winId, data);
  }
  projectWindow(sourceSys, sourceWinId, targetSystemId) {
    const existing = this.projections.find(p => p.sourceSystemId === sourceSys.id && p.sourceWindowId === sourceWinId);
    if (existing) { const t = this.systems[existing.targetSystemId]; if (t) this.focusWindow(t, existing.windowId); return existing; }
    const target = this.systems[targetSystemId]; if (!target) return null;
    const srcWin = sourceSys.windows.find(w => w.id === sourceWinId); if (!srcWin) return null;
    const pid = U.uid('proj');
    const w = this.openWindow(target, 'projection', {
      title: '投送 · ' + sourceSys.name + ' · ' + srcWin.title,
      x: 120 + (target.windows.length % 3) * 40, y: 100, w: 620, h: 440,
      data: { sourceSystemId: sourceSys.id, sourceWindowId: sourceWinId, sourceAppId: srcWin.appType, projectionId: pid }
    });
    const proj = { id: pid, windowId: w.id, targetSystemId, systemId: targetSystemId,
      sourceSystemId: sourceSys.id, sourceWindowId: sourceWinId, sourceAppId: srcWin.appType, state: 'normal' };
    this.projections.push(proj);
    if (this.gfx) this.gfx.link(targetSystemId, w.id, sourceSys.id, sourceWinId);
    this.notify('投送已创建', srcWin.title + ' → ' + target.name, targetSystemId);
    this.emit('structure');
    return proj;
  }
  unproject(projId) {
    const p = this.projections.find(x => x.id === projId); if (!p) return;
    this.closeWindow(this.systems[p.targetSystemId], p.windowId);
    this.projections = this.projections.filter(x => x !== p);
    this.emit('structure');
  }
  projectionFor(targetSysId, winId) {
    return this.projections.find(p => p.targetSystemId === targetSysId && p.windowId === winId) || null;
  }
  forwardProjectionInput(targetSysId, winId, action, payload) {
    const p = this.projectionFor(targetSysId, winId); if (!p) return;
    const src = this.systems[p.sourceSystemId];
    if (!src || src.state !== 'running' || !src.appActions[p.sourceWindowId]) return;
    // 应用内容冻结时禁用输入
    if (this.ancestorPaused(p.sourceSystemId) || src.state !== 'running') return;
    this.appAction(src, p.sourceWindowId, action, Object.assign({ __fromProjection: true }, payload || {}));
  }

  // ---------------- 系统树操作 ----------------
  nextInnerId() { this.innerCounter++; return 'inner-' + this.innerCounter; }
  subsystemIds() { return Object.keys(this.systems); }
  createSystem(parentId, opts) {
    opts = opts || {};
    const parent = this.systems[parentId]; if (!parent) return null;
    const id = this.nextInnerId();
    const sys = new Sys(id, parentId, parent.depth + 1, opts.name || id);
    sys.rate = opts.rate === undefined ? 1 : opts.rate;
    sys.desktop.wallpaper = DEFAULT_WALLPAPERS[(parent.depth + 1) % DEFAULT_WALLPAPERS.length];
    sys.desktop.accent = ['#7c5cff', '#ffb020', '#28c2a0', '#ff6b8b'][(parent.depth + 1) % 4];
    this.systems[id] = sys;
    parent.children.push(id);
    parent.childGrants[id] = Math.floor(parent.config.budget * 0.55);
    this.seedFS(sys, sys.depth);
    try { this.installKernel(sys, parent); }
    catch (e) { sys.kernelError = '内核装载失败: ' + e.message; sys.state = 'error'; }
    // 承载进程在父系统 CPU 中
    const carrier = parent.cpu.procs[sys.kernelPid];
    if (carrier) { carrier.kind = 'carrier'; carrier.name = '承载进程 · ' + id; }
    // 子系统桌面完整位于父系统的系统窗口显示区域内
    const sw = this.openWindow(parent, 'system-window', {
      title: '子系统桌面 · ' + id + '（第 ' + (sys.depth + 1) + ' 层）',
      x: 150 + (parent.windows.length % 3) * 30, y: 60,
      w: Math.max(680, Math.min(1120, this.width * 0.72)), h: Math.max(470, Math.min(760, this.height * 0.72)),
      noDriver: true, data: { childId: id }
    });
    sys.systemWindowId = sw.id;
    // 子系统默认布局：打开一个场景播放器窗口（暂停），父桌面与子桌面都可见
    const pw = this.openWindow(sys, 'player', {
      title: '三维场景播放器 · 24 号直升机',
      x: 30, y: 24, w: Math.max(500, Math.min(860, this.width * 0.54)), h: 430
    });
    if (sys.appState[pw.id]) { sys.appState[pw.id].scenePath = '/Demo/helicopter-24.scene'; sys.appState[pw.id].state = 'paused'; }
    this.notify('子系统已创建', id + '（第 ' + (sys.depth + 1) + ' 层）', parentId);
    this._dirty = true;
    this.emit('structure');
    return sys;
  }
  ancestorPaused(id) {
    let cur = id ? this.systems[id] : null;
    while (cur) { if (cur.state === 'paused') return true; cur = cur.parentId ? this.systems[cur.parentId] : null; }
    return false;
  }
  subtreeIds(id) {
    const out = []; const walk = i => { out.push(i); const s = this.systems[i]; if (s) for (const c of s.children) walk(c); };
    walk(id); return out;
  }
  pause(id) { const s = this.systems[id]; if (!s) return; s.state = 'paused'; this.notify('已暂停', s.name, id); this.emit('structure'); }
  resume(id) { const s = this.systems[id]; if (!s) return; s.state = 'running'; this.emit('structure'); }
  singleStep(id) { const s = this.systems[id]; if (!s) return; s.singleStepPending = true; this.emit('structure'); }
  setRate(id, r) { const s = this.systems[id]; if (!s) return; s.rate = Math.max(0.1, Math.min(4, Number(r) || 1)); this.emit('structure'); }
  setGrant(parent, childId, n) { const p = this.systems[parent]; if (!p) return; p.childGrants[childId] = Math.max(0, Number(n) || 0); this._dirty = true; this.emit('structure'); }
  setConfig(id, key, value) {
    const s = this.systems[id]; if (!s) return;
    s.config[key] = Math.max(1, Number(value) || 1);
    this._dirty = true; this.emit('structure');
  }
  stopSubtree(id) {
    for (const sid of this.subtreeIds(id)) {
      const s = this.systems[sid];
      s.state = 'stopped';
      for (const pid in s.cpu.procs) s.cpu.kill(pid);
      s.singleStepPending = false;
    }
    for (const p of this.projections.slice()) {
      if (this.subtreeIds(id).includes(p.sourceSystemId)) this.unproject(p.id);
    }
    this.notify('子系统已停止', id + ' 及其子树', this.systems[id] ? this.systems[id].parentId : null);
    this.emit('structure');
  }
  restartSubtree(id) {
    const ids = this.subtreeIds(id);
    // 重新载入内核源文件；保留系统树结构与已保存文件
    for (const sid of ids) {
      const s = this.systems[sid];
      for (const pid in s.cpu.procs) s.cpu.kill(pid);
      s.cpu.traps = []; s.errors = []; s.virtualTime = 0; s.state = 'running'; s.kernelError = null;
      s.spawnRequests = []; s.appActions = {}; s.carriers = {};
      for (const w of s.windows) s.appActions[w.id] = [];
      const parent = s.parentId ? this.systems[s.parentId] : s;
      try { this.installKernel(s, parent); }
      catch (e) { s.kernelError = '内核编译错误: ' + e.message; s.state = 'error'; }
      const carrier = (s.kernelCpu && s.kernelPid) ? s.kernelCpu.procs[s.kernelPid] : null;
      if (carrier && sid !== 'outer') carrier.kind = 'carrier';
      for (const w of s.windows) {
        if (w.appType === 'system-window') continue;
        const driver = w.appType === 'player' ? '/System/programs/player_driver.prog' : '/System/programs/app_loop.prog';
        s.spawnRequests.push({ path: driver,
          args: { name: w.title, kind: 'app', appId: w.id, appType: w.appType }, replyTo: null });
      }
      if (this.runtime) {
        this.runtime.onRestart(this, s);
        for (const w of s.windows) this.runtime.onWindowOpen(this, s, w, {});
      }
    }
    this.notify('子系统已重启', id + ' 的内核已重新载入', this.systems[id] ? this.systems[id].parentId : null);
    this.emit('structure');
  }

  // ---------------- 快照 / 恢复 / 分叉 ----------------
  snapshotSubtree(id, name) {
    const parent = this.systems[id] ? this.systems[this.systems[id].parentId] : null;
    const target = parent || this.root;
    const ids = this.subtreeIds(id);
    const payload = {
      version: 1, createdAt: Date.now(), name: name || ('快照-' + id),
      rootId: id, systems: {}, order: ids,
      connections: U.deepClone(this.connections.filter(c => ids.includes(c.targetSystemId))),
      projections: U.deepClone(this.projections.filter(p => ids.includes(p.sourceSystemId) || ids.includes(p.targetSystemId)))
    };
    for (const sid of ids) payload.systems[sid] = this.systems[sid].serialize();
    const text = JSON.stringify(payload);
    const dir = '/Snapshots'; target.fs.ensureDir(dir);
    const fname = (name || ('snap-' + this.stepCount)).replace(/[^A-Za-z0-9\u4e00-\u9fa5_-]/g, '_');
    let p = dir + '/' + fname + '.snap';
    let i = 1; while (target.fs.exists(p)) p = dir + '/' + fname + '(' + (i++) + ').snap';
    if (target.fs.usage() + text.length > target.config.storage) { this.notify('快照失败', '父系统存储配额不足', target.id); return null; }
    this.budget.take(4 + Math.min(4000, Math.floor(text.length / 32)));
    target.fs.write(p, text, 'snap');
    this._dirty = true;
    this.notify('快照已创建', p, target.id);
    this.emit('structure');
    return p;
  }
  listSnapshots(parentId) {
    const s = this.systems[parentId] || this.root;
    return (s.fs.list('/Snapshots') || []).filter(x => x.type === 'file');
  }
  readSnapshot(parentId, p) {
    const s = this.systems[parentId] || this.root;
    const t = s.fs.read(p);
    if (t == null) return null;
    try { return JSON.parse(t); } catch (e) { return null; }
  }
  restoreSnapshot(parentId, snapPath, mode) {
    const payload = this.readSnapshot(parentId, snapPath);
    if (!payload) { this.notify('恢复失败', '快照文件损坏或不存在', parentId); return null; }
    const ids = mode === 'fork' ? null : this.subtreeIds(payload.rootId);
    if (mode !== 'fork') {
      // 范围外状态保持不变；范围内的投送随快照恢复
      for (const p of this.projections.slice()) if (ids.includes(p.targetSystemId) || ids.includes(p.sourceSystemId)) this.unproject(p.id);
      for (const sid of ids) {
        if (sid === 'outer') continue;
        delete this.systems[sid];
      }
      const parent = this.systems[payload.systems[payload.rootId].parentId];
      if (parent) parent.children = parent.children.filter(x => x !== payload.rootId);
    }
    const idMap = {};
    for (const sid of payload.order) idMap[sid] = mode === 'fork' ? this.nextInnerId() : sid;
    this.applySnapshot(payload, idMap, mode === 'fork');
    this._fullRebuild = true;
    this.emit('structure');
    return idMap[payload.rootId];
  }
  applySnapshot(payload, idMap, fork) {
    for (const sid of payload.order) {
      const data = U.deepClone(payload.systems[sid]);
      const nid = idMap[sid];
      data.id = nid;
      data.parentId = data.parentId && idMap[data.parentId] ? idMap[data.parentId] : data.parentId;
      data.children = (data.children || []).map(x => idMap[x] || x);
      const s = Sys.restore(data);
      if (fork) s.name = data.name + '（分叉）';
      s.kernelCpu = data.parentId ? this.systems[data.parentId].cpu : s.cpu;
      // 内核进程（含其变量与运行位置）随快照恢复到承载 CPU 中
      const kpState = data.kernelProc;
      const kpPid = fork ? U.uid('kp') : s.kernelPid;
      s.kernelPid = kpPid;
      if (kpState) {
        const kp = U.deepClone(kpState); kp.pid = kpPid; kp.kind = data.parentId ? 'carrier' : 'kernel';
        s.kernelCpu.procs[kpPid] = kp;
        if (s.kernelCpu.nextPid <= 0) s.kernelCpu.nextPid = 1;
      }
      this.systems[nid] = s;
      if (data.parentId) {
        const parent = this.systems[data.parentId];
        if (parent && !parent.children.includes(nid)) parent.children.push(nid);
        parent.carriers[nid] = { pid: kpPid, work: 0, label: '承载进程 · ' + nid };
        const kproc = parent.cpu.procs[kpPid];
        if (kproc) kproc.kind = 'carrier';
      }
      // 重新映射窗口/应用标识
      for (const w of s.windows) {
        w.systemId = nid;
        if (this.runtime) this.runtime.onSnapshotRestore(this, s, w, fork);
      }
      // 分叉/恢复后，父系统必须有承载该子系统桌面的系统窗口。
      if (data.parentId) {
        const parent = this.systems[data.parentId];
        if (parent) {
          let host = parent.windows.find(x => x.data && x.data.childId === nid);
          if (!host) {
            host = this.openWindow(parent, 'system-window', {
              title: '子系统桌面 · ' + nid + '（第 ' + (s.depth + 1) + ' 层）',
              x: 150 + (parent.windows.length % 3) * 30, y: 60,
              w: Math.max(680, Math.min(1120, this.width * 0.72)), h: Math.max(470, Math.min(760, this.height * 0.72)),
              noDriver: true, data: { childId: nid }
            });
            s.systemWindowId = host.id;
          } else s.systemWindowId = host.id;
        }
      }
    }
    // 连接：范围内的随快照恢复；范围外的保持原值
    for (const c of payload.connections || []) {
      const nc = U.deepClone(c);
      nc.targetSystemId = idMap[nc.targetSystemId] || nc.targetSystemId;
      nc.targetWinId = nc.targetWinId;
      if (fork) nc.state = 'restored'; else nc.state = nc.state === 'connected' ? 'restored' : nc.state;
      nc.recvPid = null; nc.drawPid = null;
      nc.queue = U.deepClone(c.queue || []);
      this.connections.push(nc);
    }
    for (const p of payload.projections || []) {
      const np = U.deepClone(p);
      np.sourceSystemId = idMap[np.sourceSystemId] || np.sourceSystemId;
      np.targetSystemId = idMap[np.targetSystemId] || np.targetSystemId;
      if (!this.systems[np.sourceSystemId] || !this.systems[np.targetSystemId]) continue;
      const srcWin = this.systems[np.sourceSystemId].windows.find(w => w.id === np.sourceWindowId);
      if (!srcWin && np.sourceWindowId) continue;
      if (fork) continue;
    }
    this.notify(fork ? '子树已分叉' : '快照已恢复', payload.name, payload.systems[payload.rootId].parentId || 'outer');
  }

  // ---------------- 通知与持久化 ----------------
  notify(kind, text, sysId) {
    const r = this.root;
    const n = { id: U.uid('ntf'), kind, text: String(text), sysId: sysId || 'outer',
      time: Date.now(), read: false };
    r.desktop.notifications.unshift(n);
    if (r.desktop.notifications.length > 100) r.desktop.notifications.pop();
    r.desktop.unread++;
    this._dirty = true;
    this.emit('notification', n);
    return n;
  }
  persistedPath() { return this.dataDir ? path.join(this.dataDir, 'state.json') : null; }
  savePersisted() {
    const p = this.persistedPath(); if (!p) return;
    try {
      const r = this.root;
      const data = { fs: r.fs.serialize(), desktop: U.deepClone(r.desktop), innerCounter: this.innerCounter,
        settings: { name: r.name }, exports: this.exports || {} };
      fs.mkdirSync(this.dataDir, { recursive: true });
      fs.writeFileSync(p, JSON.stringify(data));
    } catch (e) { console.warn('持久化失败', e.message); }
  }
  loadPersisted() {
    const p = this.persistedPath(); if (!p || !fs.existsSync(p)) return;
    try {
      const d = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (d.fs) this.root.fs = VFS.deserialize(d.fs);
      if (d.desktop) this.root.desktop = Object.assign(this.root.desktop, d.desktop);
      if (d.innerCounter) this.innerCounter = d.innerCounter;
      if (d.settings && d.settings.name) this.root.name = d.settings.name;
      this.exports = d.exports || {};
    } catch (e) { console.warn('载入持久化失败', e.message); }
  }
  markDirty() { this._dirty = true; }
  reset() {
    if (this._timer) clearInterval(this._timer);
    const p = this.persistedPath();
    if (p && fs.existsSync(p)) { try { fs.unlinkSync(p); } catch (e) {} }
    this.systems = {}; this.innerCounter = 0; this.connections = []; this.projections = [];
    this.exports = {}; U.resetIds();
    const root = new Sys('outer', null, 0, '根系统');
    root.kernelCpu = root.cpu; this.systems.outer = root; this.root = root;
    this.seedFS(root, 0);
    root.kernelSourcePath = '/System/kernel.prog';
    try { this.installKernel(root, root); } catch (e) {}
    if (this.runtime) this.runtime.onReset(this);
    if (this.gfx) this.gfx.clear();
    this.startLoop();
    this.emit('reset');
    this.emit('structure');
    this._dirty = true;
  }

  // ---------------- 跨层文件传递与本机导入导出 ----------------
  transferFile(srcSysId, srcPath, dstSysId, dstDir, overwrite) {
    const src = this.systems[srcSysId], dst = this.systems[dstSysId];
    if (!src || !dst) return false;
    const node = src.fs.node(srcPath);
    if (!node || node.type !== 'file') { this.notify('传递失败', '源文件不存在', dstSysId); return false; }
    const content = src.fs.read(srcPath);
    let target = VFS.join(dstDir || '/Documents', VFS.basename(srcPath));
    if (dst.fs.exists(target) && !overwrite) {
      this.notify('目标已存在', '请确认覆盖：' + target, dstSysId);
      return false;
    }
    if (dst.fs.usage() + content.length > dst.config.storage) {
      this.notify('传递失败', '目标系统存储配额不足', dstSysId); return false;
    }
    this.budget.take(2 + Math.floor(content.length / 24));
    dst.fs.write(target, content, node.format);
    this.markDirty();
    this.notify('文件已投放到 ' + dst.name, target, dstSysId);
    this.emit('structure');
    return true;
  }
  ipc() { try { return require('electron').ipcRenderer; } catch (e) { return null; } }
  exportFile(sysId, path) {
    const ipc = this.ipc(); if (!ipc) return;
    const sys = this.systems[sysId]; if (!sys) return;
    const content = sys.fs.read(path); if (content == null) return;
    ipc.invoke('save-file', { defaultName: VFS.basename(path), content }).then(r => {
      if (r && r.ok) this.notify('已保存到本机', r.path, sysId);
      else if (r && r.error) this.notify('保存失败', r.error, sysId);
    });
  }
  importFile(sysId, dir) {
    const ipc = this.ipc(); if (!ipc) return;
    ipc.invoke('open-file', {}).then(r => {
      if (!r || !r.ok) return;
      const sys = this.systems[sysId];
      let target = VFS.join(dir || '/Documents', r.name);
      let i = 1; while (sys.fs.exists(target)) target = VFS.join(dir || '/Documents', r.name + '(' + (i++) + ')');
      if (sys.fs.usage() + r.content.length > sys.config.storage) { this.notify('导入失败', '存储配额不足', sysId); return; }
      sys.fs.write(target, r.content, sys.fs.guessFormat(target));
      this.markDirty(); this.notify('已导入到本系统', target, sysId); this.emit('structure');
    });
  }
  exportSnapshot(parentId, path) {
    const ipc = this.ipc(); if (!ipc) return;
    const content = (this.systems[parentId] || this.root).fs.read(path);
    if (content == null) return;
    ipc.invoke('save-file', { defaultName: VFS.basename(path), content }).then(r => {
      if (r && r.ok) this.notify('快照已保存到本机', r.path, parentId);
    });
  }
  importSnapshot(parentId) {
    const ipc = this.ipc(); if (!ipc) return;
    ipc.invoke('open-file', {}).then(r => {
      if (!r || !r.ok) return;
      const s = this.systems[parentId] || this.root;
      s.fs.ensureDir('/Snapshots');
      let target = '/Snapshots/' + r.name;
      let i = 1; while (s.fs.exists(target)) target = '/Snapshots/' + r.name + '(' + (i++) + ')';
      s.fs.write(target, r.content, 'snap');
      this.markDirty(); this.notify('快照已导入', target, parentId); this.emit('structure');
    });
  }

  // ---------------- 自动化接口 ----------------
  markReady() { if (this.readyResolve) { this.readyResolve(); this.readyResolve = null; } }
  inspect() {
    const systems = Object.values(this.systems).map(s => ({ id: s.id, parentId: s.parentId, name: s.name, state: s.state, rate: s.rate, depth: s.depth }));
    const windows = [];
    for (const s of Object.values(this.systems)) for (const w of s.windows) windows.push({
      id: w.id, systemId: s.id, appId: w.appType, title: w.title, state: w.state });
    const browsers = [];
    for (const s of Object.values(this.systems)) for (const w of s.windows) {
      const st = s.appState[w.id];
      if (w.appType === 'browser' && st && st.tabs) for (const t of st.tabs) browsers.push({
        windowId: w.id, tabId: t.id, url: t.url, loadState: t.loadState || 'idle' });
    }
    const players = [];
    const charts = [];
    for (const s of Object.values(this.systems)) for (const w of s.windows) {
      const st = s.appState[w.id]; if (!st) continue;
      if (w.appType === 'player') players.push({
        windowId: w.id, systemId: s.id, state: st.state || 'stopped', position: st.position || 0,
        duration: st.duration || 15, rate: st.rate || 1, scene: st.scenePath || '', frameTime: st.frameTime || 0 });
      if (w.appType === 'charts') charts.push({
        windowId: w.id, systemId: s.id, sourceTitle: st.sourceTitle || '', range: st.range || 'A1:D4',
        chartType: st.chartType || 'bar', connectionState: st.connectionState || 'disconnected' });
    }
    const projections = this.projections.map(p => {
      const t = this.systems[p.targetSystemId];
      const w = t && t.windows.find(x => x.id === p.windowId);
      return { windowId: p.windowId, systemId: p.targetSystemId, sourceSystemId: p.sourceSystemId,
        sourceWindowId: p.sourceWindowId, sourceAppId: p.sourceAppId, state: w ? w.state : p.state };
    });
    return { systems, windows, browsers, players, charts, projections,
      step: this.stepCount, budget: this.root.config.budget };
  }
}

module.exports = { Engine, Sys, Budget, STEP_DT, STEP_MS, DEFAULT_WALLPAPERS };
