// NestedOS 运行时核心：递归系统树、进程调度、预算、消息、文件、窗口模型与持久化。
import * as F from './fs.js';
import { compileProgram, createVM, runVM, LangError, str } from '../lang/vm.js';
import { seedRootFS, seedInnerFS, seedChildKernel, WORKBOOK_PATH, SCENE_PATH } from './seed.js';
import { hasNative, nativeCall, NATIVE_IDS, HOST_GLOBALS } from './bindings.js';

export const LOGIC_DT = 0.05;
export const TICK_MS = 50;
export const ROOT_BUDGET = 18000;
export const MB = 1024 * 1024;

export const APP_TITLES = {
  files: '文件管理器', spreadsheet: '电子表格', widgets: '小组件', editor: '文本与程序编辑器',
  browser: '浏览器', tasks: '任务与进程管理器', settings: '设置', player: '三维场景播放器',
  charts: '图表工作台', help: '操作说明', systems: '系统管理', projection: '投送',
  system: '子系统', preview: '预览',
};

const DEFAULT_SETTINGS = {
  name: 'NESTED 根系统',
  wallpaper: 'dusk-ridge',
  accent: '#a78bfa',
  scale: 1,
};

let uidSeq = 1;
function uid(prefix) { return `${prefix}-${(uidSeq++).toString(36)}`; }
export function deepClone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

class Emitter {
  constructor() { this.map = new Map(); }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) { this.map.get(evt)?.delete(fn); }
  emit(evt, payload) {
    const set = this.map.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error('[event]', evt, err); }
    }
  }
}

export class NestedOS {
  constructor() {
    this.events = new Emitter();
    this.systems = new Map();
    this.root = null;
    this.nextInner = 1;
    this.nextPid = 1;
    this.windowSeq = 1;
    this.procSeq = 1;
    this.tickId = 0;
    this.timer = null;
    this.started = false;
    this.host = null;
    this.persistenceSink = null;
    this._saveTimer = null;
    this.workbooks = new Map();
    this.chartSubs = new Map();
    this.chartBuffers = new Map();
    this.projectionMap = new Map(); // sourceWindowId -> {targetSystemId, windowId}
    this.docVersions = new Map();
    this.ui = null;
    this.clip = [];
    this.rngSeed = 0x24a1b3c5;
    this.stats = { steps: 0, startedAt: Date.now() };
    this.compilerBootstrap = true;
    this.lastStepAt = 0;
  }

  on(evt, fn) { return this.events.on(evt, fn); }
  emit(evt, payload) { this.events.emit(evt, payload); }

  attachPersistence(fn) { this.persistenceSink = fn; }
  attachUI(ui) { this.ui = ui; }

  async init(hostInfo, saved) {
    this.host = hostInfo || {};
    let rootFS;
    let settings = { ...DEFAULT_SETTINGS };
    let widgets = this.defaultWidgets();
    let notifications = [];
    if (saved && saved.version === 1 && saved.rootFS) {
      try {
        rootFS = saved.rootFS;
        settings = { ...settings, ...(saved.settings || {}) };
        widgets = { ...widgets, ...(saved.widgets || {}) };
        notifications = Array.isArray(saved.notifications) ? saved.notifications : [];
        this.nextInner = Math.max(1, saved.nextInner || 1);
        this.clip = Array.isArray(saved.clipboard) ? saved.clipboard : [];
      } catch { rootFS = null; }
    }
    if (!rootFS) rootFS = seedRootFS();
    // 补齐新增的演示资源，保持旧数据目录可用
    try {
      if (!F.resolveNode(rootFS, SCENE_PATH)) {
        const { makeScene } = await import('./seed.js');
        F.writeFile(rootFS, SCENE_PATH, JSON.stringify(makeScene(), null, 2), { kind: 'scene' });
      }
      if (!F.resolveNode(rootFS, '/Documents/操作说明.md')) {
        const { HELP_MD } = await import('./seed.js');
        F.writeFile(rootFS, '/Documents/操作说明.md', HELP_MD, { kind: 'text' });
      }
    } catch (e) { console.warn('seed supplement', e); }
    const root = this.makeSystem({
      id: 'outer', parentId: null, name: 'outer', depth: 0, fs: rootFS,
      settings, notifications, widgets, isRoot: true,
      budget: ROOT_BUDGET, memoryMB: 512, storageMB: 64,
    });
    root.displayName = settings.name || 'NESTED 根系统';
    this.root = root;
    this.systems.set('outer', root);
    this.rootState = { settings, widgets, notifications, clip: this.clip };
    return root;
  }

  defaultWidgets() {
    return {
      note: '欢迎来到 NESTED OS。\n这里是一张可以随时记事的便笺。',
      timer: { duration: 300, remaining: 300, running: false, ended: false, label: '倒计时' },
      stopwatch: { elapsed: 0, running: false, laps: [] },
      calendar: { month: new Date().getMonth(), year: new Date().getFullYear() },
      dnd: false,
      quick: { wifi: true, bluetooth: false, night: false, volume: 62 },
    };
  }

  makeSystem(o) {
    const isRoot = !!o.isRoot;
    return {
      id: o.id,
      parentId: o.parentId,
      name: o.name,
      displayName: o.settings?.name || (isRoot ? 'NESTED 根系统' : o.name),
      depth: o.depth,
      isRoot,
      state: 'running',
      selfPaused: false,
      clock: 0,
      timeScale: 1,
      totalBudget: o.budget || (isRoot ? ROOT_BUDGET : 12000),
      memoryLimitMB: o.memoryMB || (isRoot ? 512 : 256),
      storageLimitMB: o.storageMB || (isRoot ? 64 : 16),
      budget: 0,
      spent: 0,
      _lastRunTick: -1,
      _delta: 0,
      fs: o.fs,
      settings: o.settings || { ...DEFAULT_SETTINGS },
      notifications: o.notifications || [],
      widgets: o.widgets || this.defaultWidgets(),
      processes: [],
      nextPid: 1,
      children: [],
      childGrants: {},
      windows: [],
      winSeq: 1,
      zSeq: 10,
      focusOrder: [],
      focusId: null,
      kernelPath: o.kernelPath || null,
      kernelSource: null,
      kernelError: null,
      compilerConfig: { prelude: '', allowLoops: true, name: 'nplc' },
      syscalls: {},
      policies: { fsPolicy: 'normal', deliveryMode: 'fifo' },
      appConfig: {},
      wmPolicy: { policy: 'stack', cascade: 28, focusRule: 'recent' },
      rngState: 0x9e3779b9 ^ (o.depth + 1) * 2654435761,
      bootMessage: '',
      pendingChartBuffers: [],
      flightState: null,
      flightControls: null,
      flightControllerPid: 0,
      log: [],
      errors: [],
      stats: { kernelSteps: 0, workSteps: 0, lastKernelSteps: 0, lastWorkSteps: 0 },
      createdAt: Date.now(),
      snapshots: [],
    };
  }

  get sys() { return this.systems; }
  sysById(id) { return this.systems.get(id); }

  isEffectivelyPaused(sysId) {
    let s = this.systems.get(sysId);
    while (s) {
      if (s.state !== 'running' || s.selfPaused) return true;
      if (!s.parentId) return false;
      s = this.systems.get(s.parentId);
    }
    return true;
  }

  ancestorsOf(sysId) {
    const out = [];
    let s = this.systems.get(sysId);
    while (s && s.parentId) {
      const p = this.systems.get(s.parentId);
      if (p) out.unshift(p);
      s = p;
    }
    return out;
  }

  async start() {
    if (this.started) return;
    this.started = true;
    this.stats.startedAt = Date.now();
    this.timer = setInterval(() => {
      if (!this.started) return;
      try { this.rootTick(); } catch (err) {
        console.error('root tick', err);
        this.emit('fatal', { error: String(err && err.message || err) });
      }
    }, TICK_MS);
    this.emit('ready', { root: this.root });
  }

  stopTicking() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  // ---------------- 虚拟时间与调度 ----------------

  rootTick() {
    if (!this.root) return;
    this.tickId++;
    this.stats.steps++;
    const root = this.root;
    root.clock += LOGIC_DT;
    root.spent = 0;
    root.budget = root.totalBudget;
    root._delta = LOGIC_DT;
    this._lastRootProcessCharge = 0;
    // 时间先于一切工作推进，保证低预算时仍能看到真实虚拟时间与积压
    for (const child of this.childrenOf(root)) {
      if (child.state !== 'running' || child.selfPaused) continue;
      child.clock += LOGIC_DT * child.timeScale;
      child._delta = LOGIC_DT * child.timeScale;
      this.wakeTimers(child);
      this.advanceClocks(child, child._delta);
    }
    root.focusOrder = root.focusOrder.filter((id) => root.windows.some((w) => w.id === id));
    // 承载进程按 grant 获得父预算
    let remaining = root.totalBudget;
    for (const child of this.childrenOf(root)) {
      const carrier = this.carrierOf(child);
      if (!carrier) continue;
      if (child.state !== 'running' || child.selfPaused) {
        carrier.state = child.state === 'kernel-error' ? 'error' : (child.selfPaused ? 'suspended' : 'stopped');
        continue;
      }
      if (carrier.state === 'suspended') carrier.state = 'ready';
      const grant = Math.min(child.childGrantSelf || child.defaultGrant || 7000, remaining, child.totalBudget);
      if (grant <= 0) { carrier.remaining = 1; continue; }
      const beforeK = child.stats.kernelSteps, beforeW = child.stats.workSteps;
      const spent = this.stepSystem(child, grant, { fromParent: true });
      remaining = Math.max(0, remaining - spent);
      carrier.cpu += spent;
      carrier.memory = 4096 + 2048;
      carrier.cpuKernel += child.stats.kernelSteps - beforeK;
      carrier.cpuInner += child.stats.workSteps - beforeW;
      carrier.remaining = Math.max(0, child.totalBudget - spent);
      carrier.state = 'ready';
      this.chargeRootBudget(spent);
    }
    // 根系统自身的原生应用进程
    for (const proc of root.processes) {
      if (proc.kind === 'carrier' || proc.kind === 'kernel' || proc.state === 'ended') continue;
      if (proc.state === 'suspended') continue;
      this.runRootNative(root, proc, 320);
    }
    this.processRootWidgets();
    // 到达的通知/后台任务
    this.emit('tick', { clock: root.clock, tickId: this.tickId });
  }

  chargeRootBudget(n) {
    if (!this.root) return;
    this.root.spent = Math.min(this.root.totalBudget, this.root.spent + n);
  }

  processRootWidgets() {
    const st = this.rootState?.widgets;
    if (!st) return;
    const dt = LOGIC_DT;
    const timer = st.timer;
    if (timer && timer.running) {
      timer.remaining = Math.max(0, Number(timer.remaining) - dt);
      if (timer.remaining <= 0) {
        timer.running = false;
        timer.ended = true;
        const label = timer.label || '倒计时';
        this.notify('outer', {
          title: '倒计时结束', body: timer.message || `${label}已到时（${Math.round((timer.duration || 0))} 秒）`,
          kind: 'success', appId: 'widgets',
        });
        this.emit('widget-timer-ended', { timer });
      }
    }
    const sw = st.stopwatch;
    if (sw && sw.running) sw.elapsed = Number(sw.elapsed || 0) + dt;
    if (st.timer) this.emit('widget-timer-tick', { timer });
    if (sw) this.emit('widget-stopwatch-tick', { stopwatch: sw });
  }

  advanceClocks(sys, delta) {
    for (const child of this.childrenOf(sys)) {
      if (child.state !== 'running' || child.selfPaused) continue;
      child.clock += delta * child.timeScale;
      child._delta = delta * child.timeScale;
      this.wakeTimers(child);
      this.advanceClocks(child, child._delta);
    }
  }

  childrenOf(sys) {
    return sys.children.map((id) => this.systems.get(id)).filter(Boolean);
  }

  carrierOf(child) {
    if (!child.parentId) return null;
    const parent = this.systems.get(child.parentId);
    if (!parent) return null;
    return parent.processes.find((p) => p.kind === 'carrier' && p.childId === child.id) || null;
  }

  wakeTimers(sys) {
    for (const p of sys.processes) {
      if (p.state !== 'waiting' || !p.wait) continue;
      if (p.wait.kind === 'time' && sys.clock >= p.wait.until - 1e-9) {
        p.state = 'ready';
        p.wake = { nativeId: p.wait.nativeId || 'sys.wait', reason: 'time' };
      } else if (p.wait.kind === 'recv' && p.wait.until && sys.clock >= p.wait.until - 1e-9) {
        if (!p.messages || p.messages.length === 0) {
          p.state = 'ready';
          p.wake = { nativeId: 'msg.recv', reason: 'timeout' };
        }
      }
    }
  }

  stepSystem(sys, budget, opts = {}) {
    if (!sys || sys.isRoot) return 0;
    const forced = !!opts.force || !!sys._forceNextStep;
    if (!forced && (sys.state !== 'running' || sys.selfPaused)) return 0;
    if (!forced && sys._lastRunTick === this.tickId) return 0;
    sys._forceNextStep = false;
    sys._lastRunTick = forced ? 'f' + this.tickId + '-' + Math.random() : this.tickId;
    sys.budget = Math.max(0, Math.min(budget, sys.totalBudget));
    const stepBudget = sys.budget;
    sys.spent = 0;
    // 本逻辑步开始时唤醒等待步进的进程
    for (const p of sys.processes) {
      if (p.state === 'waiting' && p.wait && p.wait.kind === 'step') {
        p.state = 'ready';
        p.wake = { nativeId: 'sys.stepWait', reason: 'step', dt: sys._delta || LOGIC_DT * sys.timeScale };
      }
    }
    this.wakeTimers(sys);
    const kernel = sys.processes.find((p) => p.pid === 1);
    if (!kernel || kernel.state === 'ended') {
      if (!sys.kernelError) this.setKernelError(sys, '内核进程不存在', 'runtime');
      return sys.spent;
    }
    if (kernel.state === 'suspended') {
      sys.spent = 0;
      return 0;
    }
    kernel.state = 'running';
    const ctx = this.vmContext(sys, kernel);
    let res;
    try {
      res = runVM(kernel.vm, 5000, ctx);
    } catch (err) {
      this.setKernelError(sys, String(err && err.message || err), 'runtime');
      return sys.spent;
    }
    kernel.cpu += res.steps;
    sys.stats.kernelSteps += res.steps;
    sys.spent = Math.min(sys.budget, sys.spent + res.steps);
    kernel.state = 'ready';
    if (res.status === 'blocked') {
      const block = res.block || {};
      kernel.state = 'waiting';
      kernel.wait = { ...block };
    } else if (res.status === 'done') {
      this.setKernelError(sys, '内核主循环已退出', 'runtime');
    } else if (res.status === 'error') {
      this.setKernelError(sys, res.error || '内核异常', 'runtime');
    } else if (res.status === 'budget') {
      sys.kernelOverrun = (sys.kernelOverrun || 0) + 1;
      if (sys.kernelOverrun >= 5) this.setKernelError(sys, '内核连续 5 个逻辑步未让出执行权，已停止', 'watchdog');
    }
    if (res.status === 'blocked' || res.status === 'budget') {
      if (res.status === 'blocked') sys.kernelOverrun = 0;
    }
    sys.stats.lastKernelSteps = res.steps;
    sys.stats.lastWorkSteps = Math.max(0, sys.spent - res.steps);
    sys.stats.workSteps += sys.stats.lastWorkSteps;
    this.updateMemory(sys);
    return Math.min(sys.spent, stepBudget);
  }

  ensureCompiler(sys) {
    const node = F.resolveNode(sys.fs, '/System/compiler.prog');
    if (!node) {
      sys.compilerConfig = { prelude: '', allowLoops: true, name: 'nplc' };
      return;
    }
    try {
      const prog = compileProgram(node.content, '/System/compiler.prog');
      const vm = createVM(prog);
      const fake = { pid: 0, name: 'compiler', kind: 'vm', state: 'ready', output: [], messages: [], cpu: 0 };
      const ctx = this.vmContext(sys, fake, { compilerBootstrap: true });
      let guard = 0;
      while (!vm.done && guard++ < 20) {
        const r = runVM(vm, 2000, ctx);
        if (r.status === 'error') throw new Error(r.error);
        if (r.status === 'blocked') break;
      }
      if (!sys.compilerConfig) sys.compilerConfig = { prelude: '', allowLoops: true, name: 'nplc' };
    } catch (err) {
      this.setKernelError(sys, `编译器错误：${err.message}`, 'compiler');
    }
  }

  compileWithSystem(sys, source, filename) {
    const cfg = sys.compilerConfig || {};
    if (cfg.allowLoops === false && /\b(while|for)\b/.test(source)) {
      throw new LangError('编译器配置禁止循环');
    }
    const text = (cfg.prelude ? cfg.prelude + '\n' : '') + source;
    return compileProgram(text, filename || 'program.prog');
  }

  bootSystem(sys) {
    sys.state = 'running';
    sys.kernelError = null;
    sys.errors = [];
    sys.processes = [];
    sys.nextPid = 1;
    sys.windows = []; // 重启后的窗口由 UI 重建；运行中重启会清理
    sys.focusOrder = [];
    sys.focusId = null;
    sys.notifications = [];
    sys.kernelOverrun = 0;
    sys.stats = { kernelSteps: 0, workSteps: 0, lastKernelSteps: 0, lastWorkSteps: 0 };
    sys.appConfig = {};
    sys.compilerConfig = { prelude: '', allowLoops: true, name: 'nplc' };
    sys.syscalls = {};
    sys.clock = 0;
    sys.messages = [];
    this.ensureCompiler(sys);
    if (sys.kernelError) { sys.state = 'kernel-error'; this.emit('system-updated', sys); return false; }
    const parent = this.systems.get(sys.parentId);
    const kernelPath = sys.kernelPath;
    const knode = parent ? F.resolveNode(parent.fs, kernelPath) : null;
    if (!knode) {
      this.setKernelError(sys, `找不到内核源文件 ${kernelPath}`, 'compile');
      return false;
    }
    sys.kernelSource = knode.content;
    let prog;
    try {
      prog = this.compileWithSystem(sys, knode.content, kernelPath);
    } catch (err) {
      this.setKernelError(sys, `内核编译失败：${err.message}`, 'compile');
      return false;
    }
    const vm = createVM(prog);
    const pid = this.allocPid(sys);
    const kp = this.addProcessInternal(sys, {
      pid, name: 'kernel', kind: 'kernel', role: 'kernel', state: 'ready',
      programPath: kernelPath, programSource: knode.content, vm, quota: 2500,
      memory: 16384, windowId: null, appId: null,
    });
    kp.isKernel = true;
    sys.state = 'running';
    this.emit('system-updated', sys);
    return true;
  }

  setKernelError(sys, message, phase = 'runtime') {
    if (sys.state === 'kernel-error') return;
    sys.state = 'kernel-error';
    sys.kernelError = message;
    sys.errors.push({ at: sys.clock, message, phase });
    for (const p of sys.processes) {
      if (p.kind === 'kernel') { p.state = 'error'; p.error = message; }
      else if (p.state !== 'ended') p.state = 'error';
    }
    const carrier = this.carrierOf(sys);
    if (carrier) { carrier.state = 'error'; carrier.error = message; }
    this.closeProjectionsForSubtree(sys.id, '源系统内核错误，投送结束');
    try { this.releaseChartSubsForSubtree(sys.id, '源系统内核错误'); } catch { /* ignore */ }
    this.emit('kernel-error', { systemId: sys.id, message });
    this.emit('system-updated', sys);
    this.emit('toast', { systemId: sys.parentId || 'outer', text: `${sys.name} 内核错误：${message}`, kind: 'error' });
  }

  allocPid(sys) { return sys.nextPid++; }

  addProcessInternal(sys, p) {
    const proc = {
      pid: p.pid,
      name: p.name || 'process',
      kind: p.kind || 'vm',
      role: p.role || null,
      state: p.state || 'ready',
      programPath: p.programPath || null,
      programSource: p.programSource || null,
      vm: p.vm || null,
      quota: p.quota || 900,
      cpu: 0,
      cpuKernel: 0,
      cpuInner: 0,
      memory: p.memory || 4096,
      remaining: p.remaining || 0,
      messages: [],
      wait: null,
      wake: null,
      error: null,
      output: [],
      appId: p.appId || null,
      windowId: p.windowId || null,
      childId: p.childId || null,
      tick: p.tick || null,
      suspendedState: null,
      createdAt: Date.now(),
      runs: 0,
    };
    sys.processes.push(proc);
    return proc;
  }

  spawnProgram(sysId, path, name) {
    const sys = this.systems.get(sysId);
    if (!sys) throw new Error('系统不存在');
    if (sys.processes.length >= 64) throw new Error('进程数已达上限');
    const node = F.resolveNode(sys.fs, F.normalizePath(path));
    if (!node || node.type !== 'file') throw new Error('找不到程序文件');
    const prog = this.compileWithSystem(sys, node.content, path);
    const p = this.addProcessInternal(sys, {
      pid: this.allocPid(sys), name: name || F.baseName(path), kind: 'vm', role: 'custom',
      state: 'ready', programPath: path, programSource: node.content,
      vm: createVM(prog), quota: 900, memory: 8192,
    });
    this.emit('process-created', { systemId: sys.id, pid: p.pid });
    this.emit('process-output', { systemId: sys.id, pid: p.pid, text: `[启动] ${p.name} PID ${p.pid}`, clock: sys.clock });
    return p;
  }

  registerNativeProcess(sysId, opts) {    const sys = this.systems.get(sysId);
    if (!sys) return null;
    if (sys.processes.length >= 80) return null;
    const p = this.addProcessInternal(sys, {
      pid: this.allocPid(sys), name: opts.name, kind: 'native', role: opts.role || 'native',
      state: 'ready', quota: opts.quota || 900, memory: opts.memory || 8192,
      windowId: opts.windowId || null, appId: opts.appId || null, tick: opts.tick || null,
      remaining: opts.remaining || 0,
    });
    sys.processes.push;
    this.emit('process-created', { systemId: sys.id, pid: p.pid });
    return p;
  }

  bindNativeTick(sysId, pid, tick) {
    const sys = this.systems.get(sysId);
    const p = sys?.processes.find((x) => x.pid === pid);
    if (p) p.tick = tick;
    return p;
  }

  addWebProcess(sysId, tabId, title) {
    const sys = this.systems.get(sysId);
    if (!sys) return null;
    return this.addProcessInternal(sys, {
      pid: this.allocPid(sys), name: `网页 · ${title || '新标签页'}`, kind: 'webview',
      role: 'webview', state: 'running', quota: 0, memory: 64 * MB,
      appId: 'browser', windowId: null, tick: null, webviewTabId: tabId,
    });
  }

  removeProcess(sysId, pid, opts = {}) {
    const sys = this.systems.get(sysId);
    if (!sys) return;
    const idx = sys.processes.findIndex((p) => p.pid === pid);
    if (idx < 0) return;
    const p = sys.processes[idx];
    if (p.isKernel) { this.setKernelError(sys, '内核进程被结束', 'killed'); }
    p.state = 'ended';
    p.tick = null;
    p.messages = [];
    p.vm = null;
    p.memory = 0;
    if (p.windowId && !opts.keepWindow) this.closeWindow(sysId, p.windowId, { byProcess: true, silent: true });
    if (p.kind === 'carrier' && p.childId) {
      this.stopSystem(p.childId, { byCarrier: true });
    }
    sys.processes.splice(idx, 1);
    this.emit('process-ended', { systemId: sysId, pid });
    this.emit('window-refresh', { systemId: sysId });
  }

  suspendProcess(sysId, pid) {
    const sys = this.systems.get(sysId); if (!sys) return;
    const p = sys.processes.find((x) => x.pid === pid); if (!p || p.state === 'ended') return;
    if (p.state !== 'suspended') p.suspendedState = p.state;
    p.state = 'suspended';
    this.emit('process-updated', { systemId: sysId, pid });
  }

  resumeProcess(sysId, pid) {
    const sys = this.systems.get(sysId); if (!sys) return;
    const p = sys.processes.find((x) => x.pid === pid); if (!p || p.state !== 'suspended') return;
    p.state = p.suspendedState || 'ready';
    p.suspendedState = null;
    if (p.state === 'waiting') {
      if (p.wait && p.wait.kind === 'recv' && p.messages.length) {
        p.state = 'ready';
        p.wake = { nativeId: 'msg.recv', reason: 'message' };
      } else this.wakeTimers(sys);
    }
    this.emit('process-updated', { systemId: sysId, pid });
  }

  runRootNative(sys, proc, quantum) {
    if (proc.state === 'ended') return;
    if (proc.state === 'suspended') return;
    if (proc.tick) {
      try {
        const ctx = this.nativeContext(sys, proc, Math.min(quantum, proc.quota || quantum));
        ctx.messages = this.takeMessages(sys, proc);
        const used = proc.tick(ctx) || 0;
        const cost = Math.max(1, Math.min(quantum, used | 0));
        proc.cpu += cost;
        proc.runs++;
        sys.spent = Math.min(sys.totalBudget, sys.spent + cost);
      } catch (err) {
        proc.error = String(err && err.message || err);
        proc.state = 'error';
        this.emit('process-error', { systemId: sys.id, pid: proc.pid, error: proc.error });
      }
    }
  }

  runProcessSlice(sys, pid, quantum) {
    if (!sys || sys.state !== 'running' || sys.selfPaused) return 0;
    const proc = sys.processes.find((p) => p.pid === pid);
    if (!proc || proc.state !== 'ready') return 0;
    const remaining = Math.max(0, sys.budget - sys.spent);
    if (remaining <= 0) return 0;
    const quota = Math.min(quantum || 900, proc.quota || 900, remaining);
    if (quota <= 0) return 0;
    if (proc.kind === 'carrier') {
      const child = this.systems.get(proc.childId);
      if (!child) return 0;
      if (child.state !== 'running' || child.selfPaused) {
        proc.state = 'suspended';
        return 0;
      }
      const beforeK = child.stats.kernelSteps, beforeW = child.stats.workSteps;
      const grant = Math.min(quota, child.totalBudget);
      const spent = this.stepSystem(child, grant, {});
      proc.cpu += spent;
      proc.cpuKernel += child.stats.kernelSteps - beforeK;
      proc.cpuInner += child.stats.workSteps - beforeW;
      proc.remaining = Math.max(0, child.totalBudget - spent);
      sys.spent = Math.min(sys.budget, sys.spent + spent);
      proc.state = 'ready';
      return spent;
    }
    if (proc.kind === 'vm' || proc.vm) {
      proc.state = 'running';
      proc.runs++;
      const ctx = this.vmContext(sys, proc);
      let res;
      try { res = runVM(proc.vm, Math.min(quota, 4000), ctx); }
      catch (err) { res = { status: 'error', error: String(err && err.message || err), steps: 0 }; }
      proc.cpu += res.steps;
      sys.spent = Math.min(sys.budget, sys.spent + res.steps);
      this.updateProcessMemory(proc);
      if (res.status === 'blocked') {
        const block = res.block || {};
        proc.state = 'waiting';
        proc.wait = { ...block };
      } else if (res.status === 'done') {
        proc.state = 'ended';
        proc.remaining = 0;
        this.emit('process-ended', { systemId: sys.id, pid: proc.pid });
      } else if (res.status === 'error') {
        proc.state = 'error';
        proc.error = res.error || '程序异常';
        this.emit('process-error', { systemId: sys.id, pid: proc.pid, error: proc.error });
      } else {
        proc.state = 'ready';
      }
      sys.stats.workSteps += res.steps;
      return res.steps;
    }
    // native
    proc.state = 'running';
    proc.runs++;
    let used = 0;
    try {
      const ctx = this.nativeContext(sys, proc, quota);
      ctx.messages = this.takeMessages(sys, proc);
      used = proc.tick ? (proc.tick(ctx) || 0) : 0;
      used = Math.max(0, Math.min(quota, used | 0));
      if (proc.tick) {
        proc.state = 'waiting';
        proc.wait = { kind: 'step' };
        proc.wake = null;
      } else proc.state = 'ready';
    } catch (err) {
      proc.state = 'error';
      proc.error = String(err && err.message || err);
      this.emit('process-error', { systemId: sys.id, pid: proc.pid, error: proc.error });
    }
    proc.cpu += used;
    sys.spent = Math.min(sys.budget, sys.spent + used);
    sys.stats.workSteps += used;
    return used;
  }

  updateProcessMemory(proc) {
    if (!proc.vm) return;
    let size = 4096;
    try {
      const g = JSON.stringify(proc.vm.globals || {});
      size += g.length * 1.6;
      size += (proc.vm.frames?.length || 0) * 512;
    } catch { size += 32768; }
    proc.memory = Math.round(size);
  }

  chargeProcess(sysId, pid, cost) {
    const sys = this.systems.get(sysId);
    if (!sys) return;
    const p = sys.processes.find((x) => x.pid === pid);
    if (p) p.cpu += Math.max(0, Math.round(cost));
    sys.spent = Math.min(sys.totalBudget, sys.spent + Math.max(0, Math.round(cost)));
  }

  updateMemory(sys) {
    let total = 2 * MB; // 内核基础
    for (const p of sys.processes) {
      if (p.kind === 'vm' || p.vm) this.updateProcessMemory(p);
      total += p.memory || 0;
    }
    total += sys.appMemory || 0;
    sys.memoryUsed = total;
    sys.storageUsed = F.fileSize(sys.fs);
  }

  memoryUsedMB(sys) { return this.memoryUsed(sys) / MB; }
  memoryUsed(sys) {
    if (sys.isRoot) {
      let total = 18 * MB;
      for (const p of sys.processes) total += p.memory || 0;
      return total;
    }
    this.updateMemory(sys);
    return sys.memoryUsed || 2 * MB;
  }

  nativeContext(sys, proc, budget) {
    return {
      os: this, system: sys, proc, budget,
      messages: [],
      print: (line) => this.printToProcess(sys, proc, line),
      charge: (n) => { sys.spent = Math.min(sys.budget, sys.spent + Math.max(0, n | 0)); },
    };
  }

  vmContext(sys, proc) {
    return {
      hasNative: (id) => hasNative(id),
      nativeCall: (id, args, ctl, vm) => nativeCall(this, sys, proc, id, args, ctl, vm),
      hasGlobal: (name) => Object.prototype.hasOwnProperty.call(HOST_GLOBALS, name),
      getGlobal: (name) => HOST_GLOBALS[name],
    };
  }

  printToProcess(sys, proc, line) {
    const text = String(line);
    proc.output.push(text);
    if (proc.output.length > 200) proc.output.shift();
    sys.log.push({ at: sys.clock, pid: proc.pid, text });
    if (sys.log.length > 500) sys.log.shift();
    this.emit('process-output', { systemId: sys.id, pid: proc.pid, text, clock: sys.clock });
  }

  // ---------------- 子系统树 ----------------

  createChildSystem(parentId) {
    const parent = this.systems.get(parentId);
    if (!parent) return null;
    if (parent.state !== 'running') throw new Error('父系统未运行');
    const name = `inner-${this.nextInner++}`;
    const kernelPath = seedChildKernel(parent.fs, name);
    const depth = parent.depth + 1;
    const fs = seedInnerFS();
    const budget = Math.max(4000, Math.min(16000, Math.round(parent.totalBudget * 0.82)));
    const grantDefault = Math.max(3200, Math.min(8000, Math.round(parent.totalBudget * 0.42)));
    const child = this.makeSystem({
      id: name, parentId, name, depth, fs, kernelPath,
      budget, memoryMB: 256, storageMB: 16,
      settings: { ...DEFAULT_SETTINGS },
    });
    child.defaultGrant = grantDefault;
    child.childGrantSelf = grantDefault;
    child.displayName = name;
    this.systems.set(name, child);
    parent.children.push(child.id);
    parent.childGrants[name] = grantDefault;
    const carrier = this.addProcessInternal(parent, {
      pid: this.allocPid(parent), name, kind: 'carrier', role: 'carrier',
      state: 'ready', childId: name, quota: grantDefault, memory: 6144,
      windowId: null, appId: 'system',
    });
    carrier.cpuKernel = 0; carrier.cpuInner = 0;
    this.bootSystem(child);
    this.emit('system-created', { systemId: child.id, parentId });
    this.emit('system-updated', child);
    this.emit('toast', { systemId: parent.id, text: `已创建子系统 ${name}`, kind: 'success' });
    this.scheduleSave();
    return child;
  }

  ensureKernelBoot(child) {
    if (!child || child.isRoot) return false;
    if (child._bootPromise) return child._bootReady;
    child.state = 'booting';
    child._bootPromise = this.bootSystem(child).then((ok) => {
      child._bootPromise = null;
      return ok;
    }).catch((err) => {
      this.setKernelError(child, String(err && err.message || err), 'boot');
      child._bootPromise = null;
      return false;
    });
    child._bootReady = child._bootPromise;
    return true;
  }

  // 承载进程首次运行前完成内核装载
  async prepareCarrierStep(child) {
    if (!child.kernelSource && child.state !== 'kernel-error' && !child._loadedKernel) {
      child._loadedKernel = true;
      await this.bootSystem(child);
    }
  }

  pauseSystem(id) {
    const sys = this.systems.get(id); if (!sys) return;
    if (sys.selfPaused) return;
    sys.selfPaused = true;
    if (sys.state === 'running') sys.state = 'paused';
    const carrier = this.carrierOf(sys);
    if (carrier && carrier.state !== 'error') carrier.state = 'suspended';
    for (const p of sys.processes) {
      if (p.kind === 'carrier' && p.state === 'ready') p.state = 'suspended';
    }
    this.emit('system-updated', sys);
    this.emit('toast', { systemId: sys.parentId || 'outer', text: `${sys.name} 已暂停（整棵子树）`, kind: 'info' });
  }

  resumeSystem(id) {
    const sys = this.systems.get(id); if (!sys) return;
    if (sys.state === 'kernel-error' || sys.state === 'stopped') return;
    sys.selfPaused = false;
    sys.state = 'running';
    const carrier = this.carrierOf(sys);
    if (carrier && carrier.state === 'suspended') carrier.state = 'ready';
    for (const p of sys.processes) {
      if (p.kind === 'carrier' && p.state === 'suspended') p.state = 'ready';
    }
    this.flushChartBuffersForSubtree(id);
    this.emit('system-updated', sys);
    this.emit('toast', { systemId: sys.parentId || 'outer', text: `${sys.name} 已继续`, kind: 'success' });
  }

  setTimeScale(id, v) {
    const sys = this.systems.get(id); if (!sys) return;
    sys.timeScale = Math.max(0.1, Math.min(4, Number(v) || 1));
    this.emit('system-updated', sys);
  }

  singleStep(id) {
    const sys = this.systems.get(id);
    if (!sys || sys.isRoot) return { ok: false, error: '只能单步直属子系统' };
    const parent = this.systems.get(sys.parentId);
    if (!parent) return { ok: false, error: '父系统不存在' };
    if (this.isEffectivelyPaused(parent.id)) return { ok: false, error: '父系统或其祖先已暂停' };
    if (!sys.selfPaused && sys.state !== 'paused') return { ok: false, error: '请先暂停该子系统' };
    const delta = LOGIC_DT;
    this.advanceClocksForced(sys, delta);
    const grant = Math.min(sys.totalBudget, sys.childGrantSelf || sys.defaultGrant || 6000);
    const pausedCarriers = sys.processes.filter((p) => p.kind === 'carrier' && p.state === 'suspended');
    for (const p of pausedCarriers) p.state = 'ready';
    sys._lastRunTick = 'forced';
    const spent = this.stepSystem(sys, grant, { force: true });
    for (const p of pausedCarriers) { if (p.state !== 'stopped' && p.state !== 'error') p.state = 'suspended'; }
    const carrier = this.carrierOf(sys);
    if (carrier) { carrier.cpu += spent; carrier.state = 'suspended'; }
    sys.state = 'paused';
    sys.selfPaused = true;
    this.emit('system-updated', sys);
    this.emit('single-step', { systemId: id, clock: sys.clock });
    return { ok: true, spent, clock: sys.clock };
  }

  advanceClocksForced(sys, delta) {
    sys._forceNextStep = true;
    sys.clock += delta * sys.timeScale;
    sys._delta = delta * sys.timeScale;
    this.wakeTimers(sys);
    for (const child of this.childrenOf(sys)) {
      if (child.state !== 'running' || child.selfPaused) continue;
      this.advanceClocksForced(child, sys._delta);
    }
  }

  stopSystem(id, opts = {}) {
    const sys = this.systems.get(id);
    if (!sys || sys.isRoot) return;
    this.closeProjectionsForSubtree(id, '源系统已停止，投送结束');
    this.releaseChartSubsForSubtree(id, '源系统停止');
    for (const p of sys.processes) { p.state = 'ended'; p.tick = null; }
    sys.processes = [];
    sys.state = 'stopped';
    sys.selfPaused = false;
    sys.notifications = [];
    const carrier = this.carrierOf(sys);
    if (carrier) {
      carrier.state = 'stopped';
      carrier.remaining = 0;
    }
    for (const child of this.childrenOf(sys)) this.stopSystem(child.id, { silent: true });
    if (!opts.silent) {
      this.emit('system-stopped', { systemId: id });
      this.emit('toast', { systemId: sys.parentId, text: `${sys.name} 已关闭，文件与快照保留`, kind: 'warn' });
    }
    this.emit('system-updated', sys);
    this.scheduleSave();
  }

  async restartSystem(id) {
    const sys = this.systems.get(id);
    if (!sys || sys.isRoot) return { ok: false, error: '不能重启根系统' };
    const ids = [id, ...this.collectSubtreeIds(id).filter((x) => x !== id)];
    // 保留目录与快照；内核源文件在父系统中重新读取
    for (const sid of ids) {
      const s = this.systems.get(sid);
      if (!s) continue;
      s.processes = [];
      s.windows = [];
      s.focusOrder = [];
      s.clock = 0;
      s.selfPaused = false;
      s.state = 'running';
      s.kernelError = null;
      s._loadedKernel = false;
      s._lastRunTick = -1;
      for (const p of s.processes) p.tick = null;
    }
    // 重新建立直属承载进程
    for (const sid of ids) {
      const s = this.systems.get(sid);
      if (!s || s.isRoot) continue;
      const parent = this.systems.get(s.parentId);
      if (!parent) continue;
      if (!parent.processes.some((p) => p.kind === 'carrier' && p.childId === s.id)) {
        this.addProcessInternal(parent, {
          pid: this.allocPid(parent), name: s.name, kind: 'carrier', state: 'ended',
          childId: s.id, quota: parent.childGrants[s.id] || s.childGrantSelf || 6000,
        });
      }
      await this.bootSystem(s);
    }
    this.emit('systems-restarted', { systemId: id, ids });
    this.emit('toast', { systemId: sys.parentId, text: `${sys.name} 已重启，内核与程序重新载入`, kind: 'success' });
    return { ok: true };
  }

  collectSubtreeIds(id) {
    const out = [id];
    const sys = this.systems.get(id);
    if (sys) for (const c of sys.children) out.push(...this.collectSubtreeIds(c));
    return out;
  }

  setBudget(id, n) {
    const sys = this.systems.get(id); if (!sys) return;
    sys.totalBudget = Math.max(2000, Math.min(120000, Math.round(n)));
    this.emit('system-updated', sys);
    this.emit('task-updated', { systemId: id });
  }
  setMemoryLimit(id, mb) {
    const sys = this.systems.get(id); if (!sys) return;
    sys.memoryLimitMB = Math.max(8, Math.min(8192, Math.round(mb)));
    this.emit('task-updated', { systemId: id });
  }
  setStorageLimit(id, mb) {
    const sys = this.systems.get(id); if (!sys) return;
    sys.storageLimitMB = Math.max(1, Math.min(4096, Math.round(mb)));
    this.emit('task-updated', { systemId: id });
  }
  setChildGrant(parentId, childId, n) {
    const parent = this.systems.get(parentId); const child = this.systems.get(childId);
    if (!parent || !child) return;
    const v = Math.max(500, Math.min(60000, Math.round(n)));
    parent.childGrants[childId] = v;
    child.childGrantSelf = v;
    const carrier = this.carrierOf(child);
    if (carrier) carrier.quota = v;
    this.emit('task-updated', { systemId: parentId });
    this.emit('system-updated', child);
  }
  setProcessQuota(sysId, pid, n) {
    const sys = this.systems.get(sysId); if (!sys) return;
    const p = sys.processes.find((x) => x.pid === pid);
    if (p) { p.quota = Math.max(10, Math.min(20000, Math.round(n))); this.emit('task-updated', { systemId: sysId }); }
  }

  // ---------------- 文件系统包装 ----------------

  writeFile(sysId, path, content, meta = {}) {
    const sys = this.systems.get(sysId);
    if (!sys) throw new Error('系统不存在');
    if (sys.policies.fsPolicy === 'readonly' && !sys.isRoot) throw new Error('内核文件策略为只读');
    const before = F.fileSize(sys.fs);
    const old = F.resolveNode(sys.fs, path);
    const oldSize = old && old.type === 'file' ? F.fileSize(old) : 0;
    const newSize = new TextEncoder().encode(String(content)).length;
    if (before - oldSize + newSize > sys.storageLimitMB * MB) throw new Error('存储配额不足');
    const node = F.writeFile(sys.fs, path, content, meta);
    sys.storageUsed = F.fileSize(sys.fs);
    this.emit('fs-changed', { systemId: sysId, path });
    this.scheduleSave();
    return node;
  }
  deleteToTrash(sysId, path) {
    const sys = this.systems.get(sysId);
    if (!sys) throw new Error('系统不存在');
    if (sys.policies.fsPolicy === 'readonly' && !sys.isRoot) throw new Error('内核文件策略为只读');
    const node = F.deleteToTrash(sys.fs, path, sys.clock);
    this.emit('fs-changed', { systemId: sysId, path });
    this.notify(sysId, { title: '已删除到回收站', body: path, kind: 'info' });
    this.scheduleSave();
    return node;
  }
  mkdir(sysId, path) {
    const sys = this.systems.get(sysId);
    if (sys.policies.fsPolicy === 'readonly' && !sys.isRoot) throw new Error('内核文件策略为只读');
    const node = F.mkdir(sys.fs, path);
    this.emit('fs-changed', { systemId: sysId, path });
    this.scheduleSave();
    return node;
  }
  storageUsed(sysId) { const sys = this.systems.get(sysId); return sys ? F.fileSize(sys.fs) : 0; }
  memoryUsedMB(sysId) { const sys = this.systems.get(sysId); return sys ? this.memoryUsed(sys) / MB : 0; }

  copyFileCross(sourceSystemId, sourcePath, targetSystemId, targetDir, opts = {}) {
    const src = this.systems.get(sourceSystemId);
    const dst = this.systems.get(targetSystemId);
    if (!src || !dst) return { ok: false, error: '系统不存在' };
    const node = F.resolveNode(src.fs, sourcePath);
    if (!node || node.type !== 'file') return { ok: false, error: '源文件不存在' };
    const size = F.fileSize(node);
    if (F.fileSize(dst.fs) + size > dst.storageLimitMB * MB) return { ok: false, error: '目标系统存储配额不足' };
    const targetNode = F.resolveNode(dst.fs, F.joinPath(targetDir, node.name));
    if (targetNode && !opts.overwrite) return { ok: false, conflict: true, error: '目标存在同名文件' };
    try {
      if (targetNode) F.deleteToTrash(dst.fs, F.joinPath(targetDir, node.name), dst.clock);
      const cloned = F.copyNode(node);
      const dir = F.resolveNode(dst.fs, targetDir);
      if (!dir || dir.type !== 'dir') return { ok: false, error: '目标目录不存在' };
      cloned.name = F.uniqueName(dir, node.name);
      dir.children.push(cloned);
      this.emit('fs-changed', { systemId: targetSystemId });
      this.notify(targetSystemId, { title: '收到跨层文件', body: `${node.name} ← ${src.name}`, kind: 'success' });
      this.notify(sourceSystemId, { title: '文件已发送', body: `${node.name} → ${dst.name}:${targetDir}`, kind: 'success' });
      this.scheduleSave();
      return { ok: true, name: cloned.name };
    } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  }

  // ---------------- 窗口模型 ----------------

  openApp(sysId, appId, opts = {}) {
    const sys = this.systems.get(sysId);
    if (!sys) return null;
    if (sys.state === 'stopped') return null;
    const width = opts.width || 860;
    const height = opts.height || 560;
    const cascade = sys.wmPolicy?.cascade || 28;
    const layer = Math.min(9, sys.windows.filter((w) => w.state === 'normal').length);
    const availableW = opts.desktopW || 1280;
    const availableH = opts.desktopH || 800;
    const x = Math.max(12, Math.min(availableW - width - 12, 54 + layer * cascade));
    const y = Math.max(12, Math.min(availableH - height - 58, 32 + layer * cascade));
    const id = `win-${this.windowSeq++}`;
    const win = {
      id, systemId: sysId, appId,
      title: opts.title || APP_TITLES[appId] || appId,
      x, y, w: Math.min(width, availableW - 24), h: Math.min(height, availableH - 80),
      minW: opts.minW || 360, minH: opts.minH || 240,
      state: 'normal', z: ++sys.zSeq, createdAt: Date.now(),
      props: deepClone(opts.props || {}),
      data: deepClone(opts.data || {}),
      restoreRect: null,
      procId: null,
    };
    sys.windows.push(win);
    sys.focusOrder = [id, ...sys.focusOrder.filter((w) => w !== id)];
    sys.focusId = id;
    if (appId !== 'system' && appId !== 'projection') {
      const proc = this.addProcessInternal(sys, {
        pid: this.allocPid(sys),
        name: win.title, kind: sys.isRoot ? 'host' : 'app', role: 'app',
        state: 'ready', appId, windowId: id, quota: 500,
        memory: appId === 'spreadsheet' ? 2 * MB : 512 * 1024,
      });
      if (sys.isRoot) proc.state = 'running';
      win.procId = proc.pid;
    }
    if (appId === 'system' && win.props.childId) {
      const child = this.systems.get(win.props.childId);
      if (child) win.title = `${child.name} · 子系统`;
    }
    this.emit('window-created', { system: sys, window: win });
    this.emit('system-updated', sys);
    this.scheduleSave();
    return win;
  }

  getWindow(sysId, winId) {
    return this.systems.get(sysId)?.windows.find((w) => w.id === winId) || null;
  }
  findWindowById(winId) {
    for (const sys of this.systems.values()) {
      const w = sys.windows.find((x) => x.id === winId);
      if (w) return { system: sys, window: w };
    }
    return null;
  }
  findSystemWindow(childId) {
    const sys = this.systems.get(childId);
    if (!sys) return null;
    const parent = this.systems.get(sys.parentId);
    if (!parent) return null;
    const win = parent.windows.find((w) => w.appId === 'system' && w.props?.childId === childId);
    return win ? { system: parent, window: win } : null;
  }

  focusWindow(sysId, winId) {
    const sys = this.systems.get(sysId); if (!sys) return;
    const win = sys.windows.find((w) => w.id === winId); if (!win) return;
    sys.focusOrder = [winId, ...sys.focusOrder.filter((x) => x !== winId)];
    sys.focusId = winId;
    win.z = ++sys.zSeq;
    if (win.state === 'minimized') win.state = 'normal';
    this.emit('window-focused', { systemId: sysId, windowId: winId });
    this.emit('system-updated', sys);
  }

  minimizeWindow(sysId, winId) {
    const win = this.getWindow(sysId, winId); if (!win) return;
    if (win.state === 'minimized') {
      win.state = win.restoreRect ? 'maximized' : 'normal';
      this.focusWindow(sysId, winId);
    } else win.state = 'minimized';
    this.emit('window-updated', { window: win, systemId: sysId });
  }

  maximizeWindow(sysId, winId) {
    const win = this.getWindow(sysId, winId); if (!win) return;
    if (win.state === 'maximized') {
      win.state = win.restoreRect ? 'normal' : 'normal';
      if (win.restoreRect) { Object.assign(win, win.restoreRect); win.restoreRect = null; }
    } else {
      win.restoreRect = { x: win.x, y: win.y, w: win.w, h: win.h };
      win.state = 'maximized';
    }
    this.focusWindow(sysId, winId);
    this.emit('window-updated', { window: win, systemId: sysId });
  }

  snapWindow(sysId, winId, side) {
    const win = this.getWindow(sysId, winId); if (!win) return;
    if (!win.restoreRect) win.restoreRect = { x: win.x, y: win.y, w: win.w, h: win.h };
    win.state = 'normal';
    win.snap = side;
    this.emit('window-updated', { window: win, systemId: sysId });
  }

  updateWindowRect(sysId, winId, rect) {
    const win = this.getWindow(sysId, winId); if (!win) return;
    Object.assign(win, rect);
    this.emit('window-updated', { window: win, systemId: sysId });
  }

  closeWindow(sysId, winId, opts = {}) {
    const sys = this.systems.get(sysId); if (!sys) return;
    const idx = sys.windows.findIndex((w) => w.id === winId);
    if (idx < 0) return;
    const win = sys.windows[idx];
    if (win.appId === 'projection') { this.closeProjection(sysId, winId, opts.reason || '关闭投送'); return; }
    // 取消该窗口发起的投送
    this.closeProjectionsForSource(sysId, winId, '源窗口已关闭，投送结束');
    sys.windows.splice(idx, 1);
    sys.focusOrder = sys.focusOrder.filter((x) => x !== winId);
    if (sys.focusId === winId) sys.focusId = sys.focusOrder[0] || null;
    if (win.procId) {
      const p = sys.processes.find((x) => x.pid === win.procId);
      if (p) { p.state = 'ended'; p.memory = 0; p.tick = null; const pi = sys.processes.indexOf(p); if (pi >= 0) sys.processes.splice(pi, 1); }
    }
    this.emit('window-removed', { systemId: sysId, windowId: winId, window: win, silent: !!opts.silent });
    this.emit('system-updated', sys);
    this.scheduleSave();
  }

  applyWindowOrder(sysId, ids) {
    const sys = this.systems.get(sysId); if (!sys) return;
    const valid = ids.filter((id) => sys.windows.some((w) => w.id === id));
    const rest = sys.windows.filter((w) => !valid.includes(w.id)).map((w) => w.id);
    const order = [...valid, ...rest].reverse();
    order.forEach((id, i) => {
      const w = sys.windows.find((x) => x.id === id);
      if (w) w.z = 10 + i;
    });
    sys.zSeq = 10 + order.length;
    this.emit('windows-order', { systemId: sysId, order });
  }

  windowOrder(sysId, policy = 'stack') {
    const sys = this.systems.get(sysId); if (!sys) return [];
    const active = sys.windows.filter((w) => w.state !== 'removed');
    if (policy === 'alpha') return active.slice().sort((a, b) => a.title.localeCompare(b.title, 'zh')).map((w) => w.id);
    if (policy === 'creation') return active.slice().sort((a, b) => a.createdAt - b.createdAt).map((w) => w.id);
    return [...sys.focusOrder.filter((id) => active.some((w) => w.id === id)), ...active.filter((w) => !sys.focusOrder.includes(w.id)).map((w) => w.id)];
  }

  // ---------------- 通知 / 剪贴板 ----------------

  notify(sysId, opt = {}) {
    const sys = this.systems.get(sysId) || this.root;
    if (!sys) return null;
    const n = {
      id: uid('not'),
      title: opt.title || '通知',
      body: opt.body || '',
      kind: opt.kind || 'info',
      appId: opt.appId || null,
      at: sys.clock,
      realAt: Date.now(),
      read: false,
      systemId: sys.id,
    };
    sys.notifications.push(n);
    if (sys.notifications.length > 80) sys.notifications.shift();
    if (sys.isRoot) this.rootState.notifications = sys.notifications;
    this.emit('notification', n);
    if (!sys.isRoot || !this.rootState.widgets.dnd) {
      this.emit('toast', { systemId: sys.id, text: opt.body ? `${n.title} · ${n.body}` : n.title, kind: n.kind });
    }
    this.scheduleSave();
    return n;
  }

  markNotificationsRead(sysId) {
    const sys = this.systems.get(sysId); if (!sys) return;
    sys.notifications.forEach((n) => { n.read = true; });
    if (sys.isRoot) this.rootState.notifications = sys.notifications;
    this.emit('notifications-updated', { systemId: sysId });
    this.scheduleSave();
  }

  addClipboard(text, meta = {}) {
    if (!text) return;
    this.clip = this.clip.filter((x) => x.text !== text);
    this.clip.unshift({ text, meta, at: this.root.clock, realAt: Date.now() });
    if (this.clip.length > 40) this.clip.length = 40;
    this.rootState.clip = this.clip;
    this.emit('clipboard-updated', { clip: this.clip });
    this.scheduleSave();
  }

  // ---------------- 工作簿数据线程 / 图表订阅 ----------------

  registerWorkbook(doc) {
    this.workbooks.set(doc.docId, doc);
    this.docVersions.set(doc.docId, this.docVersions.get(doc.docId) || 0);
    this.emit('workbooks-updated', {});
  }
  unregisterWorkbook(docId) {
    this.workbooks.delete(docId);
    for (const sub of [...this.chartSubs.values()]) {
      if (sub.docId === docId) this.deliverChartPayload(sub, { type: 'source-closed', docTitle: sub.docTitle, docId });
    }
    this.emit('workbooks-updated', {});
  }
  listOpenWorkbooks() {
    return [...this.workbooks.values()].map((d) => ({ docId: d.docId, title: d.title, path: d.path, dirty: d.dirty }));
  }
  publishWorkbook(docId) {
    const doc = this.workbooks.get(docId);
    if (!doc) return;
    const version = (this.docVersions.get(docId) || 0) + 1;
    this.docVersions.set(docId, version);
    for (const sub of [...this.chartSubs.values()]) {
      if (sub.docId !== docId) continue;
      let snap;
      try { snap = doc.snapshotRange(sub.range, { labelColumn: sub.labelColumn, series: sub.series }); }
      catch (err) { snap = { error: String(err && err.message || err) }; }
      const payload = {
        type: 'data', version, docId, docTitle: doc.title, path: doc.path,
        range: sub.range, labelColumn: sub.labelColumn, series: sub.series,
        matrix: snap.matrix, labels: snap.labels, columns: snap.columns,
        rows: snap.rows, seq: version, at: this.root.clock,
      };
      this.deliverChartPayload(sub, payload);
    }
    this.emit('workbook-published', { docId, version });
  }

  connectChart(sub) {
    const doc = this.workbooks.get(sub.docId);
    if (!doc) return { ok: false, error: '源工作簿未打开' };
    const id = uid('sub');
    const record = { ...sub, id, createdAt: Date.now(), seq: 0 };
    this.chartSubs.set(id, record);
    let snap;
    try { snap = doc.snapshotRange(sub.range, { labelColumn: sub.labelColumn, series: sub.series }); }
    catch (err) { this.chartSubs.delete(id); return { ok: false, error: String(err && err.message || err) }; }
    const version = (this.docVersions.get(doc.docId) || 0) + 1;
    this.docVersions.set(doc.docId, version);
    const payload = {
      type: 'data', version, docId: doc.docId, docTitle: doc.title, path: doc.path,
      range: sub.range, labelColumn: sub.labelColumn, series: sub.series,
      matrix: snap.matrix, labels: snap.labels, columns: snap.columns, rows: snap.rows,
      seq: version, at: this.root.clock, initial: true,
    };
    // 让图表进程先拿到初始快照
    record.initialPayload = payload;
    this.deliverChartPayload(record, payload);
    this.emit('chart-connected', { subscription: record });
    return { ok: true, subscriptionId: id, payload };
  }
  disconnectChart(subscriptionId, reason = 'user') {
    const sub = this.chartSubs.get(subscriptionId);
    if (!sub) return;
    this.chartSubs.delete(subscriptionId);
    this.deliverChartPayload(sub, { type: 'disconnected', reason });
    this.emit('chart-disconnected', { subscription: sub, reason });
  }
  releaseChartSubsForSubtree(rootId, reason) {
    const ids = new Set(this.collectSubtreeIds(rootId));
    for (const [id, sub] of [...this.chartSubs.entries()]) {
      if (ids.has(sub.systemId)) {
        this.chartSubs.delete(id);
        this.emit('chart-disconnected', { subscription: sub, reason });
      }
    }
  }
  deliverChartPayload(sub, payload) {
    const sys = this.systems.get(sub.systemId);
    if (!sys || sys.state === 'stopped' || sys.state === 'kernel-error') return;
    if (this.isEffectivelyPaused(sub.systemId)) {
      if (!sys.pendingChartBuffers) sys.pendingChartBuffers = [];
      sys.pendingChartBuffers.push({ sub, payload });
      if (sys.pendingChartBuffers.length > 120) sys.pendingChartBuffers.splice(0, sys.pendingChartBuffers.length - 120);
      return;
    }
    const win = sys.windows.find((w) => w.id === sub.windowId);
    const rxId = win?.procIds?.rx;
    if (rxId) {
      this.sendMessage(sub.systemId, 0, rxId, { chartPayload: payload, subscriptionId: sub.id });
    } else {
      this.emit('chart-data-orphan', { subscription: sub, payload });
    }
  }
  flushChartBuffersForSubtree(rootId) {
    const ids = this.collectSubtreeIds(rootId);
    for (const sid of ids) {
      const sys = this.systems.get(sid);
      if (!sys || !sys.pendingChartBuffers?.length) continue;
      if (this.isEffectivelyPaused(sid)) continue;
      const buf = sys.pendingChartBuffers.splice(0);
      for (const item of buf) this.deliverChartPayload(item.sub, item.payload);
    }
  }

  // ---------------- 投送 ----------------

  existingProjection(sourceWindowId) {
    const m = this.projectionMap.get(sourceWindowId);
    if (!m) return null;
    const target = this.systems.get(m.targetSystemId);
    const win = target?.windows.find((w) => w.id === m.windowId);
    return win ? { target, window: win } : null;
  }

  createProjection(sourceSystemId, sourceWindowId, targetSystemId) {
    const source = this.systems.get(sourceSystemId);
    const target = this.systems.get(targetSystemId);
    const srcWin = source?.windows.find((w) => w.id === sourceWindowId);
    if (!source || !target || !srcWin) return { ok: false, error: '源窗口不存在' };
    if (!this.ancestorsOf(sourceSystemId).some((a) => a.id === targetSystemId)) return { ok: false, error: '目标不是祖先桌面' };
    if (!['player', 'charts'].includes(srcWin.appId)) return { ok: false, error: '该应用不支持投送' };
    const existing = this.existingProjection(sourceWindowId);
    if (existing) {
      this.focusWindow(existing.target.id, existing.window.id);
      return { ok: true, existing: true, window: existing.window, targetSystemId: existing.target.id };
    }
    const dw = target.isRoot ? 1440 : 1000;
    const dh = target.isRoot ? 860 : 700;
    const win = this.openApp(targetSystemId, 'projection', {
      title: `${srcWin.title} · 投送`,
      width: srcWin.appId === 'player' ? 760 : 700,
      height: srcWin.appId === 'player' ? 520 : 500,
      desktopW: dw, desktopH: dh,
      props: {
        sourceSystemId, sourceWindowId, sourceAppId: srcWin.appId,
      },
      data: {},
    });
    if (!win) return { ok: false, error: '创建投送窗口失败' };
    win.sourceSystemId = sourceSystemId;
    win.sourceWindowId = sourceWindowId;
    win.sourceAppId = srcWin.appId;
    this.projectionMap.set(sourceWindowId, { targetSystemId, windowId: win.id });
    srcWin.projection = { targetSystemId, windowId: win.id };
    if (!srcWin.data) srcWin.data = {};
    srcWin.data.projection = { targetSystemId, windowId: win.id };
    this.notify(sourceSystemId, { title: '已投送视图', body: `${srcWin.title} → ${target.name}`, kind: 'success' });
    this.emit('projection-created', { win, sourceSystemId, sourceWindowId });
    return { ok: true, window: win, targetSystemId };
  }

  closeProjection(targetSystemId, projectionWindowId, reason = '关闭投送') {
    const sys = this.systems.get(targetSystemId);
    const win = sys?.windows.find((w) => w.id === projectionWindowId);
    if (!win || win.appId !== 'projection') return;
    const srcId = win.sourceWindowId;
    const idx = sys.windows.indexOf(win);
    sys.windows.splice(idx, 1);
    sys.focusOrder = sys.focusOrder.filter((x) => x !== win.id);
    if (sys.focusId === win.id) sys.focusId = sys.focusOrder[0] || null;
    this.projectionMap.delete(srcId);
    const src = this.findWindowById(srcId);
    if (src?.window) {
      src.window.projection = null;
      if (src.window.data) src.window.data.projection = null;
    }
    this.emit('window-removed', { systemId: targetSystemId, windowId: projectionWindowId, window: win });
    this.notify(targetSystemId, { title: '投送已结束', body: reason, kind: 'info' });
    this.emit('projection-closed', { targetSystemId, windowId: projectionWindowId, reason });
  }

  closeProjectionsForSource(sourceSystemId, sourceWindowId = null, reason = '源窗口已关闭，投送结束') {
    for (const sys of this.systems.values()) {
      for (const win of [...sys.windows]) {
        if (win.appId !== 'projection') continue;
        if (win.sourceSystemId !== sourceSystemId) continue;
        if (sourceWindowId && win.sourceWindowId !== sourceWindowId) continue;
        this.closeProjection(sys.id, win.id, reason);
      }
    }
  }

  closeProjectionsForSubtree(rootId, reason) {
    const ids = new Set(this.collectSubtreeIds(rootId));
    for (const sys of this.systems.values()) {
      for (const win of [...sys.windows]) {
        if (win.appId === 'projection' && ids.has(win.sourceSystemId)) {
          this.closeProjection(sys.id, win.id, reason);
        }
      }
    }
    // 子树内部的投送外框随子树处理
    for (const sid of ids) {
      const s = this.systems.get(sid);
      if (!s) continue;
      for (const win of [...s.windows]) {
        if (win.appId === 'projection') this.closeProjection(sid, win.id, reason);
      }
    }
  }

  listTargets(sourceSystemId) {
    return this.ancestorsOf(sourceSystemId).map((s) => ({ id: s.id, name: s.name, depth: s.depth })).reverse();
  }

  // ---------------- 消息 ----------------

  sendMessage(sysId, fromPid, toPid, payload) {
    const sys = this.systems.get(sysId);
    if (!sys) return false;
    const target = sys.processes.find((p) => p.pid === toPid);
    if (!target || target.state === 'ended' || target.state === 'error') {
      return false;
    }
    let value;
    try { value = deepClone(payload); } catch { return false; }
    const msg = { from: fromPid, to: toPid, payload: value, at: sys.clock, seq: (sys.msgSeq = (sys.msgSeq || 0) + 1) };
    target.messages.push(msg);
    if (target.state === 'waiting' && target.wait && (target.wait.kind === 'recv' || target.wait.kind === 'recvTimeout')) {
      target.state = 'ready';
      target.wake = { nativeId: 'msg.recv', reason: 'message' };
    }
    this.emit('message-sent', { systemId: sysId, fromPid, toPid, msg });
    return true;
  }

  takeMessages(sys, proc) {
    if (!proc.messages.length) return [];
    const mode = sys.policies.deliveryMode || 'fifo';
    const out = mode === 'lifo' ? proc.messages.slice().reverse() : proc.messages.slice();
    proc.messages = [];
    return out.map((m) => m.payload);
  }

  popMessageForRecv(sys, proc) {
    if (!proc.messages.length) return null;
    const mode = sys.policies.deliveryMode || 'fifo';
    const m = mode === 'lifo' ? proc.messages.pop() : proc.messages.shift();
    return m.payload;
  }

  // ---------------- 飞行接口数据 ----------------

  setFlightState(sysId, state) {
    const sys = this.systems.get(sysId); if (!sys) return;
    sys.flightState = state;
  }
  setFlightControls(sysId, controls) {
    const sys = this.systems.get(sysId); if (!sys) return;
    sys.flightControls = { ...controls, at: sys.clock, pid: null };
  }

  // ---------------- 持久化 ----------------

  serializePersistent() {
    if (!this.root) return null;
    this.rootState.settings = this.root.settings;
    this.rootState.widgets = this.root.widgets;
    this.rootState.notifications = this.root.notifications;
    this.rootState.clip = this.clip;
    return {
      version: 1,
      savedAt: Date.now(),
      rootFS: this.root.fs,
      settings: this.root.settings,
      widgets: this.root.widgets,
      notifications: this.root.notifications,
      clipboard: this.clip,
      nextInner: this.nextInner,
    };
  }

  scheduleSave() {
    if (!this.persistenceSink) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.flushSave(), 500);
  }

  async flushSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = null;
    if (!this.persistenceSink) return;
    try {
      const data = this.serializePersistent();
      if (data) await this.persistenceSink(data);
    } catch (err) { console.warn('save failed', err); }
  }

  async resetAll() {
    this.stopTicking();
    this.started = false;
    for (const sys of this.systems.values()) {
      for (const p of sys.processes) p.tick = null;
    }
    this.systems.clear();
    this.workbooks.clear();
    this.chartSubs.clear();
    this.projectionMap.clear();
    this.docVersions.clear();
    this.clip = [];
    this.nextInner = 1;
    this.windowSeq = 1;
    this.nextPid = 1;
    this.tickId = 0;
    this.emit('reset');
    const settings = { ...DEFAULT_SETTINGS };
    const widgets = this.defaultWidgets();
    const root = this.makeSystem({
      id: 'outer', parentId: null, name: 'outer', depth: 0, fs: seedRootFS(),
      settings, notifications: [], widgets, isRoot: true,
      budget: ROOT_BUDGET, memoryMB: 512, storageMB: 64,
    });
    root.displayName = settings.name;
    this.root = root;
    this.systems.set('outer', root);
    this.rootState = { settings, widgets, notifications: [], clip: [] };
    this.emit('reset-complete', { root });
    await this.flushSave();
    this.start();
    return true;
  }

  // ---------------- 快照 / 恢复 / 分叉 ----------------

  serializeSystemForSnapshot(sys) {
    const out = {};
    const copyKeys = [
      'id', 'parentId', 'name', 'displayName', 'depth', 'isRoot', 'state', 'selfPaused', 'clock',
      'timeScale', 'totalBudget', 'memoryLimitMB', 'storageLimitMB', 'settings', 'notifications',
      'widgets', 'nextPid', 'children', 'childGrants', 'winSeq', 'zSeq', 'focusOrder', 'focusId',
      'kernelPath', 'kernelSource', 'kernelError', 'compilerConfig', 'syscalls', 'policies',
      'appConfig', 'wmPolicy', 'rngState', 'flightState', 'flightControls', 'flightControllerPid',
      'errors', 'log', 'createdAt', 'bootMessage', 'childGrantSelf', 'defaultGrant',
    ];
    for (const k of copyKeys) if (sys[k] !== undefined) out[k] = deepClone(sys[k]);
    out.fs = deepClone(sys.fs);
    out.windows = deepClone(sys.windows);
    out.processes = sys.processes.map((p) => this.serializeProcessForSnapshot(p));
    out.stats = { kernelSteps: sys.stats.kernelSteps, workSteps: sys.stats.workSteps };
    return out;
  }

  serializeProcessForSnapshot(p) {
    const out = {};
    const keys = ['pid', 'name', 'kind', 'role', 'state', 'programPath', 'quota', 'cpu', 'cpuKernel',
      'cpuInner', 'memory', 'remaining', 'messages', 'wait', 'wake', 'error', 'output', 'appId',
      'windowId', 'childId', 'runs', 'createdAt', 'isKernel', 'flightBound', 'suspendedState', 'webviewTabId'];
    for (const k of keys) if (p[k] !== undefined) out[k] = deepClone(p[k]);
    if (p.vm) out.vm = deepClone(p.vm);
    if (p.programSource) out.programSource = p.programSource;
    return out;
  }

  rehydrateProcess(raw) {
    const p = { ...deepClone(raw), tick: null };
    if (p.state === 'running') p.state = 'ready';
    p.messages = p.messages || [];
    p.output = p.output || [];
    return p;
  }

  rehydrateSystem(raw, overrides = {}) {
    const sys = this.makeSystem({
      id: overrides.id || raw.id,
      parentId: overrides.parentId !== undefined ? overrides.parentId : raw.parentId,
      name: overrides.name || raw.name,
      depth: raw.depth,
      fs: deepClone(raw.fs),
      settings: raw.settings,
      notifications: [],
      isRoot: false,
      budget: raw.totalBudget,
    });
    const keys = [
      'displayName', 'state', 'selfPaused', 'clock', 'timeScale', 'totalBudget', 'memoryLimitMB',
      'storageLimitMB', 'settings', 'nextPid', 'childGrants', 'winSeq', 'zSeq', 'focusOrder',
      'focusId', 'kernelPath', 'kernelSource', 'kernelError', 'compilerConfig', 'syscalls',
      'policies', 'appConfig', 'wmPolicy', 'rngState', 'flightState', 'flightControls',
      'flightControllerPid', 'errors', 'createdAt', 'bootMessage', 'childGrantSelf', 'defaultGrant',
      'stats',
    ];
    for (const k of keys) if (raw[k] !== undefined) sys[k] = deepClone(raw[k]);
    sys.name = overrides.name || raw.name;
    sys.displayName = sys.name;
    sys.processes = (raw.processes || []).map((p) => this.rehydrateProcess(p));
    sys.windows = deepClone(raw.windows || []);
    sys.children = (raw.children || []).map((id) => overrides.idMap?.[id] || id);
    sys.parentId = overrides.parentId !== undefined ? overrides.parentId : raw.parentId;
    sys.notifications = deepClone(raw.notifications || []);
    if (sys.state === 'booting') sys.state = 'running';
    sys._lastRunTick = -1;
    sys.budget = 0; sys.spent = 0;
    return sys;
  }

  collectSnapshot(rootId) {
    const ids = this.collectSubtreeIds(rootId);
    const systems = {};
    for (const id of ids) {
      const sys = this.systems.get(id);
      if (!sys) continue;
      systems[id] = this.serializeSystemForSnapshot(sys);
    }
    return {
      format: 'NESTED-SNAPSHOT/1',
      createdAt: Date.now(),
      meta: {
        rootId,
        name: this.systems.get(rootId)?.name || rootId,
        clock: this.systems.get(rootId)?.clock || 0,
        systemCount: ids.length,
        app: 'NESTED OS',
      },
      systems,
    };
  }

  createSnapshot(rootId) {
    const sys = this.systems.get(rootId);
    if (!sys || sys.isRoot) return { ok: false, error: '只能为直属子系统创建快照' };
    const parent = this.systems.get(sys.parentId);
    if (!parent) return { ok: false, error: '父系统不存在' };
    const snap = this.collectSnapshot(rootId);
    snap.meta.createdAt = Date.now();
    const content = JSON.stringify(snap);
    const size = new TextEncoder().encode(content).length;
    if (F.fileSize(parent.fs) + size > parent.storageLimitMB * MB) {
      this.notify(parent.id, { title: '快照失败', body: '父系统存储配额不足', kind: 'error' });
      return { ok: false, error: '父系统存储配额不足' };
    }
    F.ensureDir(parent.fs, '/Snapshots');
    const stamp = this.formatStamp(new Date());
    const fileName = `${rootId}-${stamp}.snap`;
    const path = '/Snapshots/' + fileName;
    try {
      this.writeFile(parent.id, path, content, { kind: 'snapshot' });
    } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
    const meta = { ...snap.meta, createdAt: snap.meta.createdAt, bytes: size, path };
    const node = F.resolveNode(parent.fs, path);
    if (node) node.meta.snapshot = meta;
    parent.spent = Math.min(parent.totalBudget, parent.spent + Math.max(1, Math.round(size / 1024)));
    this.notify(parent.id, { title: '快照已创建', body: `${sys.name} · ${size} 字节`, kind: 'success' });
    this.emit('snapshot-created', { parentId: parent.id, systemId: rootId, path, meta });
    this.scheduleSave();
    return { ok: true, path, meta, size };
  }

  formatStamp(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  getSnapshotMeta(parentId) {
    const parent = this.systems.get(parentId);
    if (!parent) return [];
    const dir = F.resolveNode(parent.fs, '/Snapshots');
    if (!dir || dir.type !== 'dir') return [];
    return dir.children.filter((c) => c.type === 'file' && c.name.endsWith('.snap')).map((c) => {
      let meta = {};
      try {
        const parsed = JSON.parse(c.content);
        meta = { ...(parsed.meta || {}), ...(c.meta.snapshot || {}) };
      } catch (err) { meta = { error: '快照损坏' }; }
      return {
        path: '/Snapshots/' + c.name, name: c.name, size: c.content.length, meta,
        createdAt: c.meta?.snapshot?.createdAt || c.createdAt,
      };
    }).sort((a, b) => b.createdAt - a.createdAt);
  }

  readSnapshot(parentId, path) {
    const parent = this.systems.get(parentId);
    if (!parent) return { ok: false, error: '父系统不存在' };
    const node = F.resolveNode(parent.fs, F.normalizePath(path));
    if (!node || node.type !== 'file') return { ok: false, error: '快照文件不存在' };
    let data;
    try { data = JSON.parse(node.content); } catch (err) { return { ok: false, error: '快照 JSON 损坏：' + err.message }; }
    if (data.format !== 'NESTED-SNAPSHOT/1' || !data.systems) return { ok: false, error: '不是 NESTED OS 快照' };
    return { ok: true, data, node };
  }

  removeSubtreeFromParent(rootId) {
    const ids = this.collectSubtreeIds(rootId);
    const sys = this.systems.get(rootId);
    const parent = sys ? this.systems.get(sys.parentId) : null;
    if (parent) {
      parent.children = parent.children.filter((id) => id !== rootId);
      for (const id of ids) {
        const s = this.systems.get(id);
        if (!s) continue;
        if (s.parentId && !ids.includes(s.parentId)) {
          // 根节点的外部父系统已处理；跳过
        }
        this.systems.delete(id);
      }
    } else {
      for (const id of ids) this.systems.delete(id);
    }
    return { ids, parent };
  }

  async restoreSnapshot(parentId, snapshotPath, opts = {}) {
    const read = this.readSnapshot(parentId, snapshotPath);
    if (!read.ok) return read;
    const snap = read.data;
    const parent = this.systems.get(parentId);
    if (!parent) return { ok: false, error: '父系统不存在' };
    const oldRootId = snap.meta.rootId;
    const oldIds = this.systems.has(oldRootId) ? this.collectSubtreeIds(oldRootId) : [];
    if (!opts.fork) {
      this.emit('before-subtree-restore', { ids: oldIds, fork: false, parentId, rootId: oldRootId });
      this.releaseChartSubsForSubtree(oldRootId, '快照恢复');
    }
    if (!opts.fork) {
      // 尊重范围外的投送：源窗口仍存在则保留，否则结束
      const oldSys = this.systems.get(oldRootId);
      const extParent = oldSys ? this.systems.get(oldSys.parentId) : null;
      const oldWindowIds = new Set();
      for (const id of oldIds) {
        for (const w of this.systems.get(id)?.windows || []) oldWindowIds.add(w.id);
      }
      if (oldIds.length) this.removeSubtreeFromParent(oldRootId);
      const rawSystems = snap.systems;
      const idMap = Object.fromEntries(Object.keys(rawSystems).map((id) => [id, id]));
      const restored = [];
      for (const [id, raw] of Object.entries(rawSystems)) {
        const sys = this.rehydrateSystem(raw, {
          id,
          parentId: id === oldRootId ? parentId : (idMap[raw.parentId] || raw.parentId),
          idMap,
          name: raw.name,
        });
        this.systems.set(id, sys);
        restored.push(sys);
      }
      const rootSys = this.systems.get(oldRootId);
      if (!rootSys) return { ok: false, error: '快照根系统缺失' };
      if (!parent.children.includes(oldRootId)) parent.children.push(oldRootId);
      this.ensureCarriersForRestored(restored, parentId);
      // 重算窗口 ID 不必改变；修复各系统的直属关系
      for (const sys of restored) {
        sys.children = (sys.children || []).filter((cid) => this.systems.has(cid));
        sys.focusOrder = sys.focusOrder.filter((wid) => sys.windows.some((w) => w.id === wid));
        if (!sys.focusId || !sys.windows.some((w) => w.id === sys.focusId)) sys.focusId = sys.focusOrder[0] || null;
        this.restoreProcessTicksHint(sys);
      }
      // 外部投送：源窗口消失则结束
      for (const s of this.systems.values()) {
        for (const win of [...s.windows]) {
          if (win.appId !== 'projection') continue;
          if (!oldIds.includes(win.sourceSystemId) && !this.systems.has(win.sourceSystemId)) continue;
          const srcWin = this.findWindowById(win.sourceWindowId);
          if (!srcWin) this.closeProjection(s.id, win.id, '恢复后源窗口不存在，投送结束');
        }
      }
      this.emit('subtree-restored', { rootId: oldRootId, parentId, fork: false, ids: restored.map((s) => s.id) });
      this.notify(parentId, { title: '子树已恢复', body: `${rootSys.name} 从快照续行`, kind: 'success' });
      return { ok: true, rootId: oldRootId, fork: false };
    }

    // 分叉：为整棵子树分配新身份，并重命名内核文件
    const rawSystems = snap.systems;
    const idMap = {};
    const nameMap = {};
    const order = this.sortSnapshotSystems(rawSystems);
    for (const oldId of order) {
      const newName = `inner-${this.nextInner++}`;
      idMap[oldId] = newName;
      nameMap[oldId] = newName;
    }
    const winMap = {};
    const restored = [];
    for (const oldId of order) {
      const raw = rawSystems[oldId];
      const newId = idMap[oldId];
      const newParent = oldId === oldRootId ? parentId : idMap[raw.parentId];
      const sys = this.rehydrateSystem(raw, { id: newId, parentId: newParent, idMap, name: newId });
      sys.depth = raw.depth;
      this.systems.set(newId, sys);
      restored.push(sys);
    }
    // 新窗口 ID 与内部引用重映射
    let nextWin = this.windowSeq;
    for (const sys of restored) {
      for (const win of sys.windows) {
        const oldWinId = win.id;
        win.id = `win-${nextWin++}`;
        win.systemId = sys.id;
        win.state = win.state === 'maximized' ? 'maximized' : 'normal';
        winMap[oldWinId] = win.id;
      }
    }
    this.windowSeq = nextWin;
    for (const sys of restored) {
      for (const win of sys.windows) {
        if (win.props && win.props.childId) win.props.childId = idMap[win.props.childId] || win.props.childId;
        if (win.sourceSystemId) win.sourceSystemId = idMap[win.sourceSystemId] || win.sourceSystemId;
        if (win.sourceWindowId) win.sourceWindowId = winMap[win.sourceWindowId] || win.sourceWindowId;
        if (win.appId === 'system' && win.props?.childId) {
          const c = this.systems.get(win.props.childId);
          if (c) win.title = `${c.name} · 子系统`;
        }
        if (win.appId === 'projection' && win.sourceSystemId) {
          const src = this.systems.get(win.sourceSystemId);
          if (src) win.title = `${src.windows.find((w) => w.id === win.sourceWindowId)?.title || '视图'} · 投送`;
        }
      }
      sys.focusOrder = sys.windows.map((w) => w.id).slice(0, 6);
      sys.focusId = sys.focusOrder[0] || null;
      sys.zSeq = 10 + sys.windows.length;
      for (const p of sys.processes) {
        if (p.childId) p.childId = idMap[p.childId] || p.childId;
        if (p.windowId) p.windowId = winMap[p.windowId] || p.windowId;
      }
      // 内核文件迁移到新的父系统中
      const parentSys = this.systems.get(sys.parentId);
      if (parentSys && sys.kernelSource) {
        const kpath = `/System/${sys.name}.kernel.prog`;
        try {
          this.writeFile(parentSys.id, kpath, sys.kernelSource, { kind: 'program' });
        } catch { /* 存储配额不足时保留内存内核 */ }
        sys.kernelPath = kpath;
        for (const p of sys.processes) if (p.programPath?.includes('.kernel.prog')) p.programPath = kpath;
      }
    }
    // 外部投送不在克隆范围内；克隆内部的投送已经映射。
    for (const sys of restored) {
      for (const win of [...sys.windows]) {
        if (win.appId === 'projection' && !this.systems.has(win.sourceSystemId)) this.closeProjection(sys.id, win.id, '分叉后源窗口不存在');
      }
    }
    if (!parent.children.includes(restored[0].id)) parent.children.push(restored[0].id);
    this.ensureCarriersForRestored(restored, parentId);
    for (const sys of restored) {
      for (const win of sys.windows) {
        if (win.appId === 'charts' && win.data?.charts) {
          win.data.charts.connectionState = 'restored';
          win.data.charts.subscriptionId = null;
          win.data.charts.renderDirty = true;
        }
      }
      this.restoreProcessTicksHint(sys);
    }
    this.emit('subtree-restored', { rootId: restored[0].id, parentId, fork: true, ids: restored.map((s) => s.id), oldIds });
    this.notify(parentId, { title: '子树已分叉', body: `${restored[0].name} · ${restored.length} 个系统`, kind: 'success' });
    this.scheduleSave();
    return { ok: true, rootId: restored[0].id, fork: true, ids: restored.map((s) => s.id) };
  }

  sortSnapshotSystems(raw) {
    const roots = [];
    const map = new Map(Object.entries(raw));
    const visit = (id, out) => {
      const sys = map.get(id);
      if (!sys) return;
      out.push(id);
      for (const c of sys.children || []) visit(c, out);
    };
    // 找到没有父节点在快照内的根
    for (const [id, sys] of map) {
      if (!sys.parentId || !map.has(sys.parentId)) { visit(id, roots); }
    }
    for (const id of map.keys()) if (!roots.includes(id)) roots.push(id);
    return roots;
  }

  ensureCarriersForRestored(restored, externalParentId) {
    for (const sys of restored) {
      const parent = this.systems.get(sys.parentId);
      if (!parent) continue;
      let carrier = parent.processes.find((p) => p.kind === 'carrier' && p.childId === sys.id);
      if (!carrier) {
        carrier = this.addProcessInternal(parent, {
          pid: this.allocPid(parent), name: sys.name, kind: 'carrier', role: 'carrier',
          state: sys.state === 'running' && !sys.selfPaused ? 'ready' : 'suspended',
          childId: sys.id, quota: parent.childGrants[sys.id] || sys.childGrantSelf || 6000,
          memory: 6144, appId: 'system',
        });
      } else {
        carrier.name = sys.name;
        carrier.childId = sys.id;
        carrier.state = sys.state === 'running' && !sys.selfPaused ? 'ready' : 'suspended';
      }
      if (!parent.childGrants[sys.id]) parent.childGrants[sys.id] = carrier.quota || 6000;
      if (!parent.children.includes(sys.id)) parent.children.push(sys.id);
    }
  }

  restoreProcessTicksHint(sys) {
    // tick 函数不可序列化；由 UI 在重建窗口时重新绑定。这里清理瞬时计数。
    for (const p of sys.processes) {
      p.tick = null;
      if (p.state === 'running') p.state = 'ready';
    }
    sys._lastRunTick = -1;
    sys.kernelOverrun = 0;
    sys.msgSeq = sys.msgSeq || 0;
    for (const p of sys.processes) for (const w of sys.windows) if (w.procId === p.pid) w._procRestored = true;
  }

  deleteSnapshot(parentId, path) {
    const parent = this.systems.get(parentId);
    if (!parent) return { ok: false, error: '父系统不存在' };
    const np = F.normalizePath(path);
    if (!np.startsWith('/Snapshots/')) return { ok: false, error: '只能删除快照目录内的文件' };
    try {
      F.deleteToTrash(parent.fs, np, parent.clock);
      this.emit('snapshot-deleted', { parentId, path: np });
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  }

  importSnapshot(parentId, filename, content) {
    const parent = this.systems.get(parentId);
    if (!parent) return { ok: false, error: '父系统不存在' };
    let data;
    try { data = JSON.parse(content); } catch (err) { return { ok: false, error: '不是有效 JSON' }; }
    if (data.format !== 'NESTED-SNAPSHOT/1' || !data.systems) return { ok: false, error: '不是 NESTED OS 快照文件' };
    const size = new TextEncoder().encode(content).length;
    if (F.fileSize(parent.fs) + size > parent.storageLimitMB * MB) return { ok: false, error: '存储配额不足' };
    F.ensureDir(parent.fs, '/Snapshots');
    const base = (filename || 'imported.snap').replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
    const dir = F.resolveNode(parent.fs, '/Snapshots');
    const name = F.uniqueName(dir, base.endsWith('.snap') ? base : base + '.snap');
    try {
      this.writeFile(parentId, '/Snapshots/' + name, content, { kind: 'snapshot' });
      this.notify(parentId, { title: '快照已导入', body: name, kind: 'success' });
      return { ok: true, path: '/Snapshots/' + name };
    } catch (err) { return { ok: false, error: err.message }; }
  }

  exportSnapshot(parentId, path) {
    const parent = this.systems.get(parentId);
    if (!parent) return { ok: false, error: '父系统不存在' };
    const node = F.resolveNode(parent.fs, F.normalizePath(path));
    if (!node || node.type !== 'file') return { ok: false, error: '快照不存在' };
    return { ok: true, name: node.name, content: node.content };
  }

}
