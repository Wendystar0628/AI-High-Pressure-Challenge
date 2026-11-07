// 逻辑调度：固定墙钟节拍、逐级预算拨付、单步、计时器与暂停
import { tickKernel, startKernel, stopKernel } from './kernel.js';
import {
  findProcess, runtimeState, isPausedEffectively, effectiveSpeed, notify,
  chargeWork, changed, fsRead, systemPathInParent
} from './model.js';
import { resetServiceQueues } from './services.js';
import { rt } from './store.js';

export const TICK_MS = 50;          // 每个逻辑步对应的墙钟时间
export const STEP_SECONDS = 0.1;     // 单步推进的虚拟时间

export class Ticker {
  constructor() {
    this.model = null;
    this.last = 0;
    this.acc = 0;
    this.timerAcc = 0;
    this.running = false;
    this.frame = this.frame.bind(this);
    this.onStep = null;
    this.realTime = 0;
  }
  start(model) {
    this.model = model;
    this.last = performance.now();
    this.lastFrameAt = this.last;
    this.running = true;
    requestAnimationFrame(this.frame);
    if (this.safetyTimer) clearInterval(this.safetyTimer);
    // 主窗口被完全遮挡时 requestAnimationFrame 可能停止；用墙钟兜底继续推进
    this.safetyTimer = setInterval(() => {
      if (!this.running) return;
      const now = performance.now();
      if (now - this.lastFrameAt < 450) return;
      const dt = Math.min(0.3, (now - this.last) / 1000);
      this.last = now; this.lastFrameAt = now;
      if (dt <= 0) return;
      try {
        this.realTime += dt;
        this.advanceClocks(dt);
        this.acc += dt;
        let guard = 0;
        while (this.acc >= TICK_MS / 1000 && guard++ < 6) { this.acc -= TICK_MS / 1000; this.schedulerTick(); }
        if (rt.ui && rt.ui.onTick) rt.ui.onTick(dt);
      } catch (e) { console.warn('兜底调度异常', e); }
    }, 500);
  }
  frame(ts) {
    if (!this.running || !this.model) return;
    this.lastFrameAt = performance.now();
    const dt = Math.min(0.25, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    this.realTime += dt;
    try {
      this.advanceClocks(dt);
      this.acc += dt;
      let guard = 0;
      while (this.acc >= TICK_MS / 1000 && guard++ < 8) {
        this.acc -= TICK_MS / 1000;
        this.schedulerTick();
      }
      this.timerAcc += dt;
      if (this.timerAcc >= 0.2) { this.timerAcc = 0; this.pumpWidgets(); }
      if (rt.ui && rt.ui.onTick) rt.ui.onTick(dt);
    } catch (e) {
      console.error('调度异常', e);
    }
    requestAnimationFrame(this.frame);
  }
  advanceClocks(dt) {
    const model = this.model;
    for (const sys of Object.values(model.systems)) {
      if (sys.state === 'error' || sys.paused) continue;
      if (this.ancestorPaused(sys)) continue;
      const rate = effectiveSpeed(model, sys);
      sys.clock += dt * rate;
      sys.lastActive = performance.now();
    }
  }
  ancestorPaused(sys) {
    let s = sys.parentId ? this.model.systems[sys.parentId] : null;
    while (s) {
      if (s.paused || s.state === 'error' || s.state === 'stopped') return true;
      s = s.parentId ? this.model.systems[s.parentId] : null;
    }
    return false;
  }
  schedulerTick() {
    const model = this.model;
    const root = model.systems[model.rootId];
    if (!root) return;
    root.budget.used = 0;
    root.budget.kernelUsed = 0;
    root.budget.appsUsed = 0;
    root.budget.grant = root.budget.total;
    for (const p of root.processes) p.work = 0;
    // 宿主实现的根系统服务消耗少量预算
    for (const service of ['shell', 'compositor']) {
      const p = findProcess(root, service);
      if (!p || p.suspended) continue;
      const cost = service === 'compositor' ? 18 : 10;
      const c = chargeWork(root, service, cost);
      p.state = 'ready';
    }
    // 直属子系统承载进程
    for (const proc of root.processes) {
      if (proc.kind !== 'carrier') continue;
      const child = model.systems[proc.childId];
      if (!child) continue;
      if (child.state === 'error') { proc.state = 'error'; proc.error = child.stateNote || '内核错误'; continue; }
      if (child.paused) { proc.state = 'waiting'; continue; }
      if (isPausedEffectively(model, child)) { proc.state = 'waiting'; continue; }
      if (!child.kernel || !child.kernel.started) {
        bootSystem(model, child);
        if (!child.kernel || !child.kernel.started) { proc.state = 'error'; continue; }
      }
      const remain = Math.max(0, root.budget.total - root.budget.used);
      if (remain <= 10) break;
      const grant = Math.max(0, Math.min(proc.quota || child.budget.total, child.budget.total, remain));
      proc.grant = grant;
      proc.state = 'running';
      const used = tickKernel(model, child, grant);
      proc.work = (proc.work || 0) + used;
      proc.workTotal = (proc.workTotal || 0) + used;
      proc.kernelWork = child.kernel ? (child.kernel.lastKernelFuel || 0) : 0;
      proc.userWork = Math.max(0, used - (proc.kernelWork || 0));
      root.budget.used += used;
      proc.state = child.kernel && child.kernel._vm && child.kernel._vm.status === 'waiting' ? 'waiting' : 'ready';
      if (used <= 0 && child.processes.every(p => p.state === 'waiting')) proc.state = 'waiting';
    }
    if (this.onStep) this.onStep();
  }
  pumpWidgets() {
    const model = this.model;
    const root = model.systems[model.rootId];
    if (!root) return;
    const t = root.widgets && root.widgets.timer;
    if (t && t.running && t.endAt != null && root.clock >= t.endAt) {
      t.running = false; t.remaining = 0; t.endAt = null;
      notify(root, '倒计时结束', `${t.duration} 秒倒计时已结束。`, { kind: 'ok' });
    }
    if (root.widgets && root.widgets.stopwatch && root.widgets.stopwatch.running) {
      // UI 根据 startedAt 计算
    }
    if (rt.ui && rt.ui.onSlowTick) rt.ui.onSlowTick();
  }
}

export function bootSystem(model, sys) {
  if (!sys || sys.isRoot) return;
  if (sys.kernel && sys.kernel.started && sys.kernel._vm) return;
  const parent = model.systems[sys.parentId];
  if (!parent) return;
  resetServiceQueues(sys);
  const kernelPath = systemPathInParent(sys.id);
  if (!fsRead(parent, kernelPath)) {
    sys.state = 'error';
    sys.stateNote = `父系统缺少内核文件：${kernelPath}`;
    sys.kernel = { path: kernelPath, source: '', error: sys.stateNote, started: false, logs: [], vmState: null };
    return;
  }
  const restore = !!(sys.kernel && sys.kernel.vmState);
  const r = startKernel(model, sys, { restore });
  if (r.ok) {
    sys.state = 'running';
    if (!sys.serviceQueues) sys.serviceQueues = { scene: [], effects: [], commands: [] };
    changed('boot-system');
  } else {
    sys.state = 'error';
    sys.stateNote = r.error || '内核启动失败';
  }
}

export function restartKernel(model, sys) {
  stopKernel(sys);
  sys.kernel = null;
  for (const p of sys.processes) if (p.kind !== 'carrier') { p._vm = null; p.vmState = null; }
  sys.processes = sys.processes.filter(p => p.kind === 'carrier');
  sys.state = 'running'; sys.stateNote = '';
  bootSystem(model, sys);
}

export function stepSubtree(model, sys) {
  if (!sys || !sys.parentId) return { ok: false, error: '根系统不能单步' };
  const parent = model.systems[sys.parentId];
  if (!parent) return { ok: false, error: '父系统不存在' };
  if (isPausedEffectively(model, parent)) return { ok: false, error: '父系统或更上层已暂停，不能单步' };
  if (!sys.paused) return { ok: false, error: '请先暂停该子系统再单步' };
  if (sys.state === 'error') return { ok: false, error: '内核错误状态下不能单步' };
  const ids = [sys.id, ...collectDesc(sys)];
  // 目标自身忽略暂停；后代按各自暂停状态
  for (const id of ids) {
    const s = model.systems[id];
    if (!s) continue;
    if (s.id !== sys.id && s.paused) continue;
    const isTarget = s.id === sys.id;
    if (!isTarget) {
      // 任一中间暂停都不推进其子树
      let p = s.parentId ? model.systems[s.parentId] : null;
      let frozen = false;
      while (p && p.id !== sys.id) { if (p.paused) { frozen = true; break; } p = p.parentId ? model.systems[p.parentId] : null; }
      if (frozen) continue;
    }
    s.clock += STEP_SECONDS * (s.id === sys.id ? 1 : s.speed);
    s.lastSteppedAt = s.clock;
  }
  const proc = findProcess(parent, 'carrier');
  const carrier = parent.processes.find(p => p.kind === 'carrier' && p.childId === sys.id);
  const grant = Math.min(carrier ? carrier.quota : sys.budget.total, sys.budget.total, Math.max(100, parent.budget.total - parent.budget.used));
  if (carrier) carrier.grant = grant;
  let used = 0;
  if (sys.kernel && sys.kernel.started) used = tickKernel(model, sys, grant);
  parent.budget.used += used;
  if (carrier) { carrier.work = (carrier.work || 0) + used; carrier.workTotal = (carrier.workTotal || 0) + used; }
  if (sys.serviceQueues) {
    // 确保单步后完成一次场景与特效取样，读数与画面一致
  }
  changed('step');
  return { ok: true, advanced: STEP_SECONDS, used, clock: sys.clock };
}

function collectDesc(sys) {
  const out = [];
  const walk = (s) => { for (const id of s.children) { const c = rt.model.systems[id]; if (c) { out.push(c); walk(c); } } };
  walk(sys);
  return out.map(s => s.id);
}

export function pauseSystem(sys) {
  if (!sys) return;
  sys.paused = true;
  sys.state = sys.state === 'error' ? 'error' : 'running';
  for (const p of sys.processes) if (p.state === 'running') p.state = 'ready';
  changed('pause');
}

export function resumeSystem(sys) {
  if (!sys) return;
  sys.paused = false;
  sys.state = sys.state === 'error' ? 'error' : 'running';
  // 不补进暂停期间的时间
  for (const w of sys.windows) {
    if (w.appId === 'player') {
      const p = sys.apps.players[w.id];
      if (p) { p.lastClock = sys.clock; if (p.rehearsal && p.rehearsal.physics) p.rehearsal.physics.lastClock = sys.clock; }
    }
  }
  changed('resume');
}

export function setSpeed(sys, speed) {
  sys.speed = Math.max(0.1, Math.min(4, speed));
  changed('speed');
}

export function findCarrier(parent, childId) {
  return parent.processes.find(p => p.kind === 'carrier' && p.childId === childId) || null;
}
