/* ============================================================
 * 内核运行时：执行子系统内核程序（巢语），提供系统调用、
 * 调度进程、分发消息、唤醒计时器、分配预算。
 * 子系统中的窗口管理、播放器、图表、飞控等都由内核启动的程序运行。
 * ============================================================ */
import { compile, VM } from './lang.js';
import {
  fsRead, fsWrite, findProcess, addProcess, memoryUsed, notify, changed,
  systemPathInParent, fsEnsureDir
} from './model.js';
import {
  timeServiceTick, sceneServiceTick, effectsServiceTick,
  chartReceiveTick, chartDrawTick, controllerSensor, controllerApply
} from './services.js';

const SERVICE_BY_FILE = {
  'wm.nest': 'wm', 'files.nest': 'files', 'player.nest': 'player', 'scene.nest': 'scene',
  'effects.nest': 'effects', 'charts.nest': 'charts', 'datafeed.nest': 'datafeed',
  'controller.nest': 'controller', 'compiler.nest': 'compiler'
};

const SERVICE_TITLES = {
  wm: '窗口管理', files: '文件管理器', player: '三维播放器（时序）', scene: '飞行场景',
  effects: '环境特效', charts: '图表工作台', datafeed: '数据接收', controller: '飞控'
};

export function kernelError(sys, msg) {
  if (!sys) return;
  if (sys.state === 'error' && sys.stateNote === msg) return;
  sys.state = 'error';
  sys.stateNote = msg;
  if (sys.kernel) { sys.kernel.error = msg; sys.kernel.started = false; }
  const model = MODEL_REF;
  const parent = sys.parentId && model ? model.systems[sys.parentId] : null;
  if (parent) notify(parent, '子系统内核错误', `${sys.id}：${msg}`, { kind: 'err' });
  changed('kernel-error');
}

let MODEL_REF = null;
function rtModel(sys) { return MODEL_REF; }

export function getKernelPath(sys) { return systemPathInParent(sys.id); }

export function startKernel(model, sys, { restore = false } = {}) {
  if (!sys || sys.isRoot) return { ok: false };
  MODEL_REF = model;
  const parent = model.systems[sys.parentId];
  if (!parent) return { ok: false, error: '父系统不存在' };
  const path = systemPathInParent(sys.id);
  let source = fsRead(parent, path);
  if (source == null) {
    source = sys.kernel && sys.kernel.source;
    if (source == null) {
      kernelError(sys, `父系统中缺少内核文件 ${path}`);
      return { ok: false, error: '缺少内核文件' };
    }
  }
  const oldKernel = sys.kernel;
  let vm = null;
  let error = null;
  if (restore && oldKernel && oldKernel.vmState) {
    // 用快照里的源码恢复运行位置
    const snap = oldKernel.vmState;
    if (snap.source && snap.source !== source) {
      // 以快照内的源码为准
      source = snap.source;
    }
    const c = compile(source);
    if (!c.ok) error = '内核源文件编译失败：' + c.error;
    else {
      const hostBundle = makeKernelHost(model, sys);
      vm = VM.restore(oldKernel.vmState, hostBundle.host);
      sys.kernel = {
        path, source, error: null, vmState: oldKernel.vmState, logs: oldKernel.logs || [],
        steps: oldKernel.steps || 0, fuelTotal: oldKernel.fuelTotal || 0, started: true,
        lastLog: oldKernel.lastLog || '', active: false,
        _vm: vm, _bridge: hostBundle.bridge, _host: hostBundle.host
      };
      hostBundle.bridge.kernel = sys.kernel;
      sys.state = 'running';
      sys.stateNote = '';
      // 恢复用户进程的虚拟机
      for (const proc of sys.processes) {
        if (proc.kind === 'carrier' || !proc.programPath) continue;
        if (proc.vmState) attachProcessVM(model, sys, proc, { restore: true });
      }
      changed('kernel-restore');
      return { ok: true, restored: true };
    }
  } else {
    const c = compile(source);
    if (!c.ok) error = '内核源文件编译失败：' + c.error;
    else {
      const hostBundle = makeKernelHost(model, sys);
      vm = new VM(c.compiled, hostBundle.host);
      sys.kernel = {
        path, source, error: null, vmState: null, logs: [], steps: 0, fuelTotal: 0,
        started: true, lastLog: '', active: false,
        _vm: vm, _bridge: hostBundle.bridge, _host: hostBundle.host
      };
      hostBundle.bridge.kernel = sys.kernel;
      sys.state = 'running';
      sys.stateNote = '';
      sys.budget.kernelUsed = 0;
      sys.budget.appsUsed = 0;
      // 首次启动时清空非承载进程，由内核程序重新创建
      sys.processes = sys.processes.filter(p => p.kind === 'carrier');
      changed('kernel-start');
      return { ok: true };
    }
  }
  // 编译失败
  sys.kernel = {
    path, source, error, vmState: null, logs: [], steps: 0, fuelTotal: 0,
    started: false, lastLog: '', active: false
  };
  sys.state = 'error';
  sys.stateNote = error;
  notify(parent, '子系统内核错误', `${sys.id}：${error}`, { kind: 'err' });
  changed('kernel-error');
  return { ok: false, error };
}

export function stopKernel(sys) {
  if (!sys || !sys.kernel) return;
  sys.kernel.started = false;
  sys.kernel.active = false;
  if (sys.kernel._vm) sys.kernel.vmState = sys.kernel._vm.snapshot();
  sys.kernel._vm = null;
}

function makeKernelHost(model, sys) {
  const bridge = {
    grant: 0, remaining: 0, stepOpen: false, kernel: null,
    appExtra: 0, inputEvents: 0, lastGrant: 0, grantedThisTick: false
  };
  const host = {
    syscall(name, args, vm) { return kernelSyscall(model, sys, bridge, name, args, vm); },
    onError(err) { kernelError(sys, '内核运行时错误：' + err); },
    onPrint(text) {
      if (sys.kernel) {
        sys.kernel.logs.push({ t: sys.clock, text });
        if (sys.kernel.logs.length > 120) sys.kernel.logs.shift();
      }
    }
  };
  return { host, bridge };
}

function spend(bridge, sys, amount) {
  const n = Math.max(0, Math.min(amount, bridge.remaining));
  bridge.remaining -= n;
  sys.budget.used += n;
  return n;
}

function kernelSyscall(model, sys, bridge, name, args, vm) {
  const kernel = sys.kernel;
  switch (name) {
    case 'kernel_log': {
      const text = String(args[0] ?? '');
      if (kernel) {
        kernel.logs.push({ t: +sys.clock.toFixed(3), text });
        if (kernel.logs.length > 160) kernel.logs.shift();
        kernel.lastLog = text;
      }
      return true;
    }
    case 'begin_step': {
      if (!bridge.grantedThisTick) {
        bridge.grantedThisTick = true;
        bridge.stepOpen = true;
        return Math.max(0, bridge.remaining);
      }
      return 0;
    }
    case 'end_step': {
      bridge.stepOpen = false;
      return null;
    }
    case 'idle': return { __wait: 'tick' };
    case 'clock': return sys.clock;
    case 'ready_list': {
      return sys.processes.filter(p => p.kind !== 'kernel' && p.state === 'ready').map(p => p.pid);
    }
    case 'quota_of': {
      const p = findProcess(sys, Number(args[0]));
      return p ? Math.max(100, p.quota || 1000) : 0;
    }
    case 'run_slice': {
      return runSlice(model, sys, bridge, Number(args[0]), Number(args[1]));
    }
    case 'deliver_messages': {
      return deliverMessages(model, sys);
    }
    case 'wake_timers': {
      let n = 0;
      for (const p of sys.processes) {
        if (p.state !== 'waiting') continue;
        if (p.waitUntil != null && p.waitUntil <= sys.clock + 1e-9) {
          p.state = 'ready';
          if (p._vm && p._vm.status === 'waiting') {
            // 若是接收超时，优先交付消息
            if (p._waitKind === 'recv') {
              const msg = (p.inbox || []).shift();
              p.messages = (p.inbox || []).length;
              p._vm.provideResult(msg === undefined ? null : msg.value ?? msg);
            } else p._vm.provideResult(null);
          }
          p.waitUntil = null; p._waitKind = null; n++;
        }
      }
      return n;
    }
    case 'spawn': {
      return kernelSpawn(model, sys, bridge, String(args[0] || '程序'), String(args[1] || ''), String(args[2] || ''));
    }
    case 'kill': {
      const p = findProcess(sys, Number(args[0]));
      if (!p) return false;
      p.state = 'ended';
      if (p._vm) p._vm.status = 'done';
      return true;
    }
    case 'self': return 0;
    case 'alloc': {
      const p = findProcess(sys, Number(args[0]));
      const mb = Number(args[1]) || 0;
      if (!p) return false;
      if (memoryUsed(sys) + mb > sys.budget.memoryQuota) return false;
      p.memory += mb; return true;
    }
    case 'budget_left': return bridge.remaining;
    case 'input_events': {
      const n = sys.inputQueue ? sys.inputQueue.length : 0;
      return n;
    }
    case 'read': return fsRead(sys, String(args[0]));
    case 'stat': {
      const node = sys.files[String(args[0])];
      return node ? { type: node.type, size: node.type === 'file' ? node.content.length : 0 } : null;
    }
    case 'write': {
      const r = fsWrite(sys, String(args[0]), String(args[1] ?? ''));
      spend(bridge, sys, 120 + String(args[1] ?? '').length / 4);
      return r;
    }
    case 'compile': {
      spend(bridge, sys, 80 + String(args[1] ?? '').length / 3);
      const c = compile(String(args[1] ?? ''));
      return { ok: c.ok, error: c.error, size: c.ok ? c.compiled.code.length : 0 };
    }
    default:
      return { error: `内核不支持的系统调用 ${name}` };
  }
}

function kernelSpawn(model, sys, bridge, name, programPath, kindHint) {
  const source = fsRead(sys, programPath);
  if (source == null) {
    if (sys.kernel) sys.kernel.logs.push({ t: sys.clock, text: `启动失败：找不到程序 ${programPath}` });
    return 0;
  }
  const service = kindHint || SERVICE_BY_FILE[programPath.split('/').pop()] || 'app';
  if (memoryUsed(sys) + 8 > sys.budget.memoryQuota) {
    if (sys.kernel) sys.kernel.logs.push({ t: sys.clock, text: `启动失败：内存配额不足（${name}）` });
    return 0;
  }
  const c = compile(source);
  if (!c.ok) {
    if (sys.kernel) sys.kernel.logs.push({ t: sys.clock, text: `启动失败：${name} 编译错误 ${c.error}` });
    const p = addProcess(sys, { name, kind: 'app', service, quota: 1200, memory: 4, state: 'error', programPath });
    p.error = c.error;
    return p.pid;
  }
  const used = spend(bridge, sys, 100 + source.length / 4);
  const proc = addProcess(sys, {
    name: name || SERVICE_TITLES[service] || programPath,
    kind: 'app', service, quota: service === 'player' || service === 'scene' ? 1800 : 1200,
    memory: service === 'scene' ? 10 : 6, state: 'ready', programPath
  });
  proc._compiled = c.compiled;
  proc._source = source;
  proc._vmStatePending = null;
  sys.budget.appsUsed += used;
  if (sys.kernel) sys.kernel.logs.push({ t: sys.clock, text: `启动进程 ${proc.pid} ${proc.name}` });
  return proc.pid;
}

export function attachProcessVM(model, sys, proc, { restore = false } = {}) {
  if (proc.kind === 'carrier') return null;
  let compiled = proc._compiled;
  let source = proc._source;
  if (!compiled) {
    source = fsRead(sys, proc.programPath);
    if (source == null) { proc.state = 'error'; proc.error = '程序文件不存在：' + proc.programPath; return null; }
    const c = compile(source);
    if (!c.ok) { proc.state = 'error'; proc.error = c.error; return null; }
    compiled = c.compiled;
    proc._compiled = compiled;
    proc._source = source;
  }
  const host = {
    syscall(name, args, vm) { return appSyscall(model, sys, proc, name, args, vm); },
    onError(err) {
      proc.state = 'error'; proc.error = err;
      if (sys.kernel) sys.kernel.logs.push({ t: sys.clock, text: `进程 ${proc.pid} 异常：${err}` });
    },
    onPrint(text) {
      proc.logs = proc.logs || [];
      proc.logs.push({ t: sys.clock, text });
      if (proc.logs.length > 100) proc.logs.shift();
      if (proc.service === 'controller') {
        sys.controllerLog = sys.controllerLog || [];
        sys.controllerLog.push({ t: sys.clock, text });
        if (sys.controllerLog.length > 80) sys.controllerLog.shift();
      }
      if (typeof proc.onOutput === 'function') { try { proc.onOutput(text); } catch (e) {} }
    }
  };
  let vm;
  if (restore && proc.vmState) {
    vm = VM.restore(proc.vmState, host);
    if (vm.status === 'error') { proc.state = 'error'; proc.error = vm.error; }
  } else {
    vm = new VM(compiled, host);
  }
  proc._vm = vm;
  if (!restore && !proc.vmState) proc.vmState = vm.snapshot();
  return vm;
}

// 从编辑器中启动程序：在子系统里注册为内核调度的进程（不是宿主定时器）
export function spawnEditorProgram(sys, source, path, name, onOutput) {
  if (!sys) return { ok: false, error: '系统不存在' };
  const c = compile(source);
  if (!c.ok) return { ok: false, error: c.error };
  if (memoryUsed(sys) + 4 > sys.budget.memoryQuota) return { ok: false, error: '内存配额不足' };
  const proc = addProcess(sys, {
    name: `程序 ${name}`, kind: 'app', service: 'custom-' + name,
    quota: Math.max(400, Math.min(2000, sys.budget.total / 6)), memory: 4,
    state: 'ready', programPath: path || `/System/programs/${name}.nest`
  });
  proc._compiled = c.compiled;
  proc._source = source;
  proc.onOutput = onOutput;
  proc.running = true;
  const vmr = attachProcessVM(MODEL_REF || rtModel(sys), sys, proc, { restore: false });
  if (!vmr) return { ok: false, error: proc.error || '无法载入程序' };
  if (sys.kernel) sys.kernel.logs.push({ t: sys.clock, text: `编辑器启动进程 ${proc.pid} ${proc.name}` });
  changed('program-start');
  return { ok: true, pid: proc.pid, instructions: c.compiled.code.length };
}

export const APP_SERVICES = {
  files: ['files'],
  player: ['player', 'scene', 'effects'],
  charts: ['charts', 'datafeed']
};

// 关闭子系统最后一个应用窗口时，结束该应用及其协作进程；重新打开时从程序文件恢复。
export function endAppServices(sys, appId) {
  const list = APP_SERVICES[appId];
  if (!list) return;
  for (const service of list) {
    const proc = sys.processes.find(p => p.service === service);
    if (!proc || proc.state === 'ended') continue;
    proc._savedMemory = proc.memory;
    proc.state = 'ended';
    proc.suspended = false;
    proc.memory = 0;
    proc.work = 0;
    if (proc._vm) proc._vm.status = 'done';
    if (sys.kernel) sys.kernel.logs.push({ t: sys.clock, text: `应用 ${appId} 关闭，结束 ${proc.name}（${proc.pid}）` });
  }
  changed('app-services-ended');
}

export function reviveAppServices(sys, appId) {
  const list = APP_SERVICES[appId];
  if (!list) return;
  for (const service of list) {
    const proc = sys.processes.find(p => p.service === service);
    if (!proc || proc.state !== 'ended' || !proc.programPath) continue;
    proc.memory = proc._savedMemory || proc.memory || 6;
    const r = reloadProcessProgram(sys, proc);
    if (r.ok && sys.kernel) sys.kernel.logs.push({ t: sys.clock, text: `应用 ${appId} 打开，恢复 ${proc.name}（${proc.pid}）` });
  }
  changed('app-services-revived');
}

export function reloadProcessProgram(sys, proc) {
  if (!sys || !proc || !proc.programPath) return { ok: false, error: '程序不存在' };
  const source = fsRead(sys, proc.programPath);
  if (source == null) return { ok: false, error: '程序文件不存在' };
  const c = compile(source);
  if (!c.ok) { proc.state = 'error'; proc.error = '编译失败：' + c.error; return { ok: false, error: c.error }; }
  proc._compiled = c.compiled;
  proc._source = source;
  proc._vm = null;
  proc.vmState = null;
  proc.error = null;
  proc.state = 'ready';
  const vm = attachProcessVM(rtModel(sys) || MODEL_REF, sys, proc, { restore: false });
  if (!vm) return { ok: false, error: proc.error || '无法载入程序' };
  return { ok: true, instructions: c.compiled.code.length };
}

function runSlice(model, sys, bridge, pid, quota) {
  const proc = findProcess(sys, pid);
  if (!proc) return 0;
  if (proc.suspended || proc.state === 'suspended' || proc.state === 'ended' || proc.state === 'error') return 0;
  const q = Math.max(0, Math.min(quota, bridge.remaining));
  if (q <= 0) return 0;

  if (proc.kind === 'carrier') {
    const child = model.systems[proc.childId];
    if (!child || child.state === 'error' || child.paused) return 0;
    if (!child.kernel || !child.kernel._vm) startKernel(model, child);
    if (!child.kernel || !child.kernel._vm) return 0;
    const grant = Math.min(q, child.budget.total);
    const used = tickKernel(model, child, grant);
    bridge.remaining = Math.max(0, bridge.remaining - used);
    sys.budget.used = Math.min(sys.budget.grant || sys.budget.total, sys.budget.used + used);
    proc.work = (proc.work || 0) + used;
    proc.workTotal = (proc.workTotal || 0) + used;
    proc.kernelWork = child.kernel ? (child.kernel.lastKernelFuel || 0) : 0;
    proc.userWork = Math.max(0, used - (proc.kernelWork || 0));
    proc.state = child.paused ? 'waiting' : 'ready';
    return used;
  }

  if (!proc._vm) attachProcessVM(model, sys, proc);
  const vm = proc._vm;
  if (!vm) return 0;

  proc.state = 'running';
  const instrBefore = vm.instructions;
  proc._extra = 0;
  const usedByVm = vm.step(q);
  const extra = Math.min(proc._extra || 0, Math.max(0, q - usedByVm));
  const used = Math.min(q, usedByVm + extra);
  bridge.remaining = Math.max(0, bridge.remaining - used);
  sys.budget.used += used;
  if (proc.kind !== 'carrier') sys.budget.appsUsed += used;
  proc.work = (proc.work || 0) + used;
  proc.workTotal = (proc.workTotal || 0) + used;
  proc.instructions = (proc.instructions || 0) + (vm.instructions - instrBefore);
  proc.lastInstr = vm.instructions - instrBefore;
  proc.remaining = Math.max(0, (proc.quota || 0) - used);
  proc.vmState = vm.snapshot();
  if (vm.status === 'error') { proc.state = 'error'; proc.error = vm.error; }
  else if (vm.status === 'done') { proc.state = 'ended'; proc.endedAt = sys.clock; }
  else if (vm.status === 'waiting') {
    proc.state = 'waiting';
    proc.waitUntil = vm.wait && vm.wait.__wait === 'timer' ? vm.wakeAt : null;
    proc._waitKind = vm.pending ? vm.pending.name : null;
    if (proc._waitKind === 'recv') {
      proc._waitKind = 'recv';
      proc.waitUntil = vm.wait && vm.wait.__wait === 'timer' ? vm.wakeAt : null;
    }
  } else { proc.state = 'ready'; proc.waitUntil = null; }
  return used;
}

export function tickKernel(model, sys, grant) {
  if (!sys || !sys.kernel || !sys.kernel.started) return 0;
  if (sys.state === 'error') return 0;
  const kernel = sys.kernel;
  const vm = kernel._vm;
  const bridge = kernel._bridge;
  if (!vm || !bridge) return 0;
  MODEL_REF = model;
  sys.budget.used = 0;
  sys.budget.kernelUsed = 0;
  sys.budget.appsUsed = 0;
  sys.budget.grant = grant;
  bridge.grant = Math.max(0, grant);
  bridge.remaining = Math.max(0, grant);
  bridge.stepOpen = false;
  bridge.grantedThisTick = false;
  for (const p of sys.processes) p.work = 0;
  kernel.active = true;

  if (vm.status === 'waiting' && vm.wait && vm.wait.__wait === 'tick') vm.provideResult(0);
  if (vm.status !== 'ready') {
    if (vm.status === 'error') { kernelError(sys, vm.error || '内核异常'); }
    kernel.vmState = vm.snapshot();
    return 0;
  }
  const fuelCap = Math.min(16000, Math.max(1200, Math.floor(grant * 0.28)));
  const instrBefore = vm.instructions;
  vm.step(fuelCap);
  const fuel = vm.instructions - instrBefore;
  bridge.remaining = Math.max(0, bridge.remaining - fuel);
  sys.budget.used = Math.min(grant, sys.budget.used + fuel);
  sys.budget.kernelUsed += fuel;
  kernel.fuelTotal = (kernel.fuelTotal || 0) + fuel;
  kernel.lastKernelFuel = fuel;
  kernel.steps = (kernel.steps || 0) + 1;
  kernel.vmState = vm.snapshot();
  kernel.active = false;
  if (vm.status === 'error') {
    kernelError(sys, vm.error || '内核运行时异常');
  }
  return Math.min(grant, sys.budget.used);
}

function deliverMessages(model, sys) {
  let n = 0;
  const queue = sys.messageQueue || [];
  const delivered = [];
  for (const msg of queue) {
    const target = sys.processes.find(p => p.pid === msg.toPid) || sys.processes.find(p => p.name === msg.toName);
    if (!target || target.state === 'ended' || target.state === 'error') continue;
    target.inbox = target.inbox || [];
    target.inbox.push({ from: msg.fromPid, fromName: msg.fromName, value: msg.value, at: sys.clock });
    target.messages = target.inbox.length;
    delivered.push(msg);
    n++;
    if (target._vm && target._vm.status === 'waiting' && target._waitKind === 'recv') {
      const m = target.inbox.shift();
      target.messages = target.inbox.length;
      target._vm.provideResult(m.value);
      target._waitKind = null;
      target.waitUntil = null;
      target.state = 'ready';
    }
  }
  sys.messageQueue = queue.filter(m => !delivered.includes(m));
  return n;
}

/* ---------------- 应用进程系统调用 ---------------- */
function appSyscall(model, sys, proc, name, args, vm) {
  const addExtra = (n) => { proc._extra = (proc._extra || 0) + n; };
  switch (name) {
    case 'clock': return sys.clock;
    case 'self': return proc.pid;
    case 'wait': {
      const ms = Math.max(1, Number(args[0]) || 1);
      return { __wait: 'timer', at: sys.clock + ms / 1000 };
    }
    case 'send': {
      const target = args[0];
      const targetProc = sys.processes.find(p => p.name === target || p.pid === Number(target));
      if (!targetProc || targetProc.state === 'ended' || targetProc.state === 'error') return '目标不存在';
      const value = typeof args[1] === 'string' ? args[1] : JSON.stringify(args[1] ?? null);
      sys.messageQueue = sys.messageQueue || [];
      sys.messageQueue.push({ toPid: targetProc.pid, toName: targetProc.name, fromPid: proc.pid, fromName: proc.name, value, at: sys.clock });
      addExtra(8);
      return '已投递';
    }
    case 'recv': {
      const timeout = Number(args[0] ?? 0);
      proc.inbox = proc.inbox || [];
      if (proc.inbox.length) {
        const m = proc.inbox.shift();
        proc.messages = proc.inbox.length;
        return m.value;
      }
      proc._waitKind = 'recv';
      if (timeout > 0) return { __wait: 'timer', at: sys.clock + timeout / 1000 };
      return { __wait: 'msg' };
    }
    case 'read': {
      const content = fsRead(sys, String(args[0]));
      addExtra(20 + String(content || '').length / 16);
      return content;
    }
    case 'write': {
      const content = String(args[1] ?? '');
      addExtra(80 + content.length / 8);
      return fsWrite(sys, String(args[0]), content);
    }
    case 'compile': {
      addExtra(40 + String(args[1] ?? '').length / 4);
      const c = compile(String(args[1] ?? ''));
      return { ok: c.ok, error: c.error, size: c.ok ? c.compiled.code.length : 0 };
    }
    case 'kill': {
      const p = findProcess(sys, Number(args[0]));
      if (!p) return false;
      p._savedMemory = p._savedMemory || p.memory;
      p.memory = 0;
      p.state = 'ended';
      if (p._vm) p._vm.status = 'done';
      addExtra(8);
      return true;
    }
    case 'spawn': {
      const name = String(args[0] || '程序');
      const path = String(args[1] || '');
      const source = fsRead(sys, path);
      if (source == null) return 0;
      const c = compile(source);
      if (!c.ok) return 0;
      if (memoryUsed(sys) + 4 > sys.budget.memoryQuota) return 0;
      const child = addProcess(sys, {
        name, kind: 'app', service: 'custom-' + name, quota: 800, memory: 4,
        state: 'ready', programPath: path
      });
      child._compiled = c.compiled;
      child._source = source;
      attachProcessVM(MODEL_REF || rtModel(sys), sys, child, { restore: false });
      addExtra(60 + source.length / 4);
      return child.pid;
    }
    case 'submit_scene': {
      proc.lastSceneSubmission = { at: sys.clock, data: String(args[0] ?? '').slice(0, 2000) };
      addExtra(80 + String(args[0] ?? '').length / 8);
      return true;
    }
    case 'submit_2d': {
      proc.last2dSubmission = { at: sys.clock, data: String(args[0] ?? '').slice(0, 2000) };
      addExtra(30 + String(args[0] ?? '').length / 8);
      return true;
    }
    case 'log': {
      proc.logs = proc.logs || [];
      proc.logs.push({ t: sys.clock, text: String(args[0] ?? '') });
      if (proc.logs.length > 120) proc.logs.shift();
      if (proc.service === 'controller') {
        sys.controllerLog = sys.controllerLog || [];
        sys.controllerLog.push({ t: sys.clock, text: String(args[0] ?? '') });
        if (sys.controllerLog.length > 100) sys.controllerLog.shift();
      }
      return null;
    }
    case 'sensor': {
      addExtra(24);
      return controllerSensor(model, sys, proc);
    }
    case 'set_control': {
      addExtra(12);
      return controllerApply(model, sys, proc, args);
    }
    case 'wm_pump': {
      const n = Math.min(Number(args[0]) || 4, sys.inputQueue ? sys.inputQueue.length : 0);
      if (sys.inputQueue) sys.inputQueue.splice(0, n);
      addExtra(Math.max(4, n * 14));
      return n;
    }
    case 'files_service': {
      addExtra(4);
      return 0;
    }
    case 'player_service': {
      const r = timeServiceTick(model, sys, proc);
      addExtra(r.work || 0);
      return r.count || 0;
    }
    case 'scene_service': {
      const r = sceneServiceTick(model, sys, proc);
      addExtra(r.work || 0);
      return r.count || 0;
    }
    case 'effects_service': {
      const r = effectsServiceTick(model, sys, proc);
      addExtra(r.work || 0);
      return r.count || 0;
    }
    case 'chart_service': {
      const r = chartDrawTick(model, sys, proc);
      addExtra(r.work || 0);
      return r.count || 0;
    }
    case 'datafeed_service': {
      const r = chartReceiveTick(model, sys, proc);
      addExtra(r.work || 0);
      return r.count || 0;
    }
    default:
      return { error: `未知服务 ${name}` };
  }
}

export function serviceNameForProgram(path) {
  return SERVICE_BY_FILE[(path || '').split('/').pop()] || 'app';
}

export { SERVICE_TITLES };
