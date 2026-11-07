// 编辑器中的程序运行器：把巢语程序作为自定义进程运行并由系统预算计费
import { compile, VM } from './lang.js';
import * as M from './model.js';
import { rt, changed } from './store.js';
import { fsRead, fsWrite, chargeWork, findProcess, runtimeState } from './model.js';
import { isPausedEffectively } from './model.js';

const runners = new Map();
let interval = null;
let seq = 0;

function ensureLoop() {
  if (interval) return;
  interval = setInterval(() => {
    let alive = false;
    for (const r of [...runners.values()]) {
      if (r.done) continue;
      alive = true;
      try { stepRunner(r); } catch (e) { r.fail('运行器异常：' + e.message); }
    }
    if (!alive && interval) { clearInterval(interval); interval = null; }
  }, 50);
}

function stepRunner(r) {
  const sys = rt.model && rt.model.systems[r.sysId];
  if (!sys) { r.stop('系统已关闭'); return; }
  if (isPausedEffectively(rt.model, sys)) return;
  const vm = r.vm;
  if (!vm || vm.status !== 'ready') {
    if (vm && vm.status === 'waiting') {
      if (r.waitUntil != null && sys.clock >= r.waitUntil) {
        r.waitUntil = null;
        const inbox = r.inbox;
        const value = inbox.length ? inbox.shift() : null;
        vm.provideResult(value);
      }
    }
    return;
  }
  // 每 50ms 最多执行 400 条指令；额度不足时让出
  const proc = sys.processes.find(p => p.pid === r.pid);
  if (proc && proc.state === 'suspended') return;
  const before = vm.instructions;
  vm.step(400);
  const used = vm.instructions - before;
  if (used > 0) {
    chargeWork(sys, r.pid, used);
    const p = sys.processes.find(x => x.pid === r.pid);
    if (p) { p.work = (p.work || 0) + used; p.workTotal = (p.workTotal || 0) + used; }
  }
  r.procWork = (r.procWork || 0) + used;
  if (vm.status === 'waiting') {
    r.waitUntil = vm.wait && vm.wait.__wait === 'timer' ? vm.wakeAt : null;
  } else r.waitUntil = null;
  if (vm.status === 'done') r.stop(null, '程序正常结束');
  else if (vm.status === 'error') r.fail(vm.error || '程序异常');
  else {
    const p = sys.processes.find(x => x.pid === r.pid);
    if (p) { p.state = 'running'; p.vmState = vm.snapshot(); p.programPath = r.path || p.programPath; }
  }
}

function runnerHost(r) {
  const sys = () => rt.model.systems[r.sysId];
  return {
    onPrint(text) {
      r.log(text);
    },
    onError(err) { r.fail(err); },
    syscall(name, args, vm) {
      const s = sys();
      if (!s) return null;
      switch (name) {
        case 'clock': return s.clock;
        case 'self': return r.pid;
        case 'wait': {
          const ms = Math.max(1, Number(args[0]) || 1);
          return { __wait: 'timer', at: s.clock + ms / 1000 };
        }
        case 'read': return fsRead(s, String(args[0]));
        case 'write': {
          chargeWork(s, r.pid, 80 + String(args[1] || '').length / 8);
          return fsWrite(s, String(args[0]), String(args[1] ?? ''));
        }
        case 'compile': {
          chargeWork(s, r.pid, 40 + String(args[1] || '').length / 4);
          const c = compile(String(args[1] || ''));
          return { ok: c.ok, error: c.error };
        }
        case 'send': {
          const targetName = String(args[0]);
          const target = [...runners.values()].find(x => x.sysId === r.sysId && x.name === targetName && !x.done);
          if (!target) return '目标不存在';
          target.inbox.push(typeof args[1] === 'string' ? args[1] : String(args[1]));
          target.log(`← 来自 ${r.name}：${String(args[1])}`);
          return '已投递';
        }
        case 'recv': {
          if (r.inbox.length) return r.inbox.shift();
          const timeout = Number(args[0] || 0);
          if (timeout > 0) return { __wait: 'timer', at: s.clock + timeout / 1000 };
          return { __wait: 'msg' };
        }
        case 'log': {
          r.log(String(args[0] ?? ''));
          const p = s.processes.find(x => x.pid === r.pid);
          if (p) { p.logs = p.logs || []; p.logs.push({ t: s.clock, text: String(args[0] ?? '') }); }
          return null;
        }
        case 'spawn': {
          const path = String(args[1] || '');
          const src = fsRead(s, path);
          if (src == null) return 0;
          const child = createRunner({ sysId: r.sysId, source: src, name: String(args[0] || '程序'), path });
          return child ? child.pid : 0;
        }
        case 'kill': {
          const p = findProcess(s, Number(args[0]));
          if (p) p.state = 'ended';
          return !!p;
        }
        default:
          return { error: '该程序运行环境不支持服务 ' + name };
      }
    }
  };
}

export function createRunner({ sysId, source, name, path, onLog }) {
  const model = rt.model;
  const sys = model.systems[sysId];
  if (!sys) return null;
  const c = compile(source);
  if (!c.ok) {
    toastRunnerError(sys, name, c.error);
    return null;
  }
  const proc = M.addProcess(sys, {
    name: `程序 ${name}`, kind: 'app', service: 'custom-' + name,
    quota: 900, memory: 4, state: 'running', programPath: path || ''
  });
  proc.programPath = path;
  proc.running = true;
  const id = 'runner-' + (++seq);
  const r = {
    id, sysId, name, path, proc, pid: proc.pid, vm: null, inbox: [], waitUntil: null,
    done: false, logs: [], logCb: onLog || null, procWork: 0,
    log(text) {
      this.logs.push({ t: sys.clock, text });
      if (this.logs.length > 200) this.logs.shift();
      if (this.logCb) try { this.logCb(text); } catch (e) {}
      if (this.proc) { this.proc.logs = this.proc.logs || []; this.proc.logs.push({ t: sys.clock, text }); if (this.proc.logs.length > 200) this.proc.logs.shift(); }
    },
    fail(msg) {
      this.done = true;
      this.log('错误：' + msg);
      const s = rt.model && rt.model.systems[this.sysId];
      const p = s && s.processes.find(x => x.pid === this.pid);
      if (p) { p.state = 'error'; p.error = msg; }
      this.stopIntervalIfIdle();
      changed('program-error');
    },
    stop(reason, msg) {
      this.done = true;
      if (msg) this.log(msg);
      const s = rt.model && rt.model.systems[this.sysId];
      const p = s && s.processes.find(x => x.pid === this.pid);
      if (p && reason !== 'system') { p.state = 'ended'; p.endedAt = s.clock; }
      runners.delete(this.id);
      this.stopIntervalIfIdle();
      changed('program-stop');
    },
    stopIntervalIfIdle() {
      if ([...runners.values()].every(x => x.done)) {
        if (interval) { clearInterval(interval); interval = null; }
      }
    }
  };
  r.vm = new VM(c.compiled, runnerHost(r));
  r.proc = proc;
  proc.runnerId = r.id;
  runners.set(id, r);
  ensureLoop();
  r.log(`▶ 启动 ${name}（进程 ${proc.pid}）`);
  changed('program-start');
  return r;
}

function toastRunnerError(sys, name, error) {
  if (rt.ui) rt.ui.toast('编译失败', `${name}：${error}`, 'err', sys);
}

export function stopRunner(sysId, pid) {
  for (const r of [...runners.values()]) {
    if (r.sysId === sysId && r.pid === pid) r.stop(null, '已被结束');
  }
}
export function killRunnerByPid(sysId, pid) { stopRunner(sysId, pid); }
export function runnersFor(sysId) { return [...runners.values()].filter(r => r.sysId === sysId && !r.done); }
export function stopAllForSystem(sysId) {
  for (const r of [...runners.values()]) if (r.sysId === sysId) r.stop('system', null);
}
