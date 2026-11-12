// NPL 系统调用绑定：程序经由这些接口取得系统服务，不直接访问宿主 DOM/计时器。
import * as F from './fs.js';
import { str, num, truthy, createVM } from '../lang/vm.js';

const ids = [];
const add = (...list) => ids.push(...list);
add(
  'fn:len', 'fn:print', 'fn:substr', 'fn:num', 'fn:keys', 'fn:append', 'fn:type',
  'fn:min', 'fn:max', 'fn:abs', 'fn:floor', 'fn:ceil', 'fn:round', 'fn:sqrt',
  'fn:sin', 'fn:cos', 'fn:atan2', 'fn:clamp', 'fn:rand', 'fn:range', 'fn:join',
  'sys.pid', 'sys.time', 'sys.wait', 'sys.stepWait', 'sys.spawn', 'sys.kill', 'sys.procs',
  'sys.run', 'sys.remaining', 'sys.log', 'sys.setReady', 'sys.registerSyscall', 'sys.syscall',
  'sys.fsPolicy', 'sys.deliverMode', 'sys.charge', 'sys.timeScale', 'sys.systemName',
  'fs.read', 'fs.write', 'fs.list', 'fs.mkdir', 'fs.rename', 'fs.delete', 'fs.exists',
  'fs.size', 'fs.copy', 'fs.type',
  'msg.send', 'msg.recv', 'msg.peek', 'msg.count',
  'proc.find', 'proc.list', 'proc.name', 'proc.pid',
  'ui.windowOrder', 'ui.wmPolicy', 'ui.wmApply', 'ui.windows', 'ui.notify',
  'app.configure', 'app.pump',
  'flight.bind', 'flight.sensors', 'flight.setControls',
  'compiler.configure',
  'math.abs', 'math.floor', 'math.ceil', 'math.round', 'math.sqrt', 'math.sin',
  'math.cos', 'math.atan2', 'math.min', 'math.max', 'math.clamp', 'math.pow',
  'json.stringify', 'json.parse',
  'str.len', 'str.upper', 'str.lower', 'str.substr', 'str.split', 'str.indexOf',
);
const NATIVE_IDS = new Set(ids);

export function hasNative(id) { return NATIVE_IDS.has(id); }
export { NATIVE_IDS };

function mark(prefix, names) {
  const obj = {};
  for (const n of names) obj[n] = { __native: `${prefix}.${n}` };
  return Object.freeze(obj);
}

export const HOST_GLOBALS = Object.freeze({
  sys: mark('sys', ['pid', 'time', 'wait', 'stepWait', 'spawn', 'kill', 'procs', 'run', 'remaining',
    'log', 'setReady', 'registerSyscall', 'syscall', 'fsPolicy', 'deliverMode', 'charge', 'timeScale', 'systemName']),
  fs: mark('fs', ['read', 'write', 'list', 'mkdir', 'rename', 'delete', 'exists', 'size', 'copy', 'type']),
  msg: mark('msg', ['send', 'recv', 'peek', 'count']),
  proc: mark('proc', ['find', 'list', 'name', 'pid']),
  ui: mark('ui', ['windowOrder', 'wmPolicy', 'wmApply', 'windows', 'notify']),
  app: mark('app', ['configure', 'pump']),
  flight: mark('flight', ['bind', 'sensors', 'setControls']),
  compiler: mark('compiler', ['configure']),
  math: mark('math', ['abs', 'floor', 'ceil', 'round', 'sqrt', 'sin', 'cos', 'atan2', 'min', 'max', 'clamp', 'pow']),
  json: mark('json', ['stringify', 'parse']),
  str: mark('str', ['len', 'upper', 'lower', 'substr', 'split', 'indexOf']),
});

function clone(v) {
  try { return JSON.parse(JSON.stringify(v)); } catch { return null; }
}

function consumeWake(proc, id) {
  if (proc.wake && proc.wake.nativeId === id) {
    const w = proc.wake;
    proc.wake = null;
    proc.wait = null;
    return w;
  }
  return null;
}

function bill(sys, proc, n) {
  const cost = Math.max(1, Math.round(n));
  sys.spent = Math.min(sys.budget, sys.spent + cost);
  if (proc) proc.cpu += cost;
  return cost;
}

function primitive(sys, name, args) {
  switch (name) {
    case 'time': return sys.clock;
    case 'mul2': return num(args[0]) * 2;
    case 'add': return num(args[0]) + num(args[1]);
    case 'pid': return sys.pid || 0;
    case 'echo': return args[0] === undefined ? null : args[0];
    case 'upper': return str(args[0]).toUpperCase();
    default: return null;
  }
}

export function nativeCall(os, sys, proc, id, args, ctl, vm) {
  const block = (info) => ctl.block({ ...info, nativeId: id });
  const charge = (n) => bill(sys, proc, n);

  // ---- 全局函数 ----
  switch (id) {
    case 'fn:len': {
      const v = args[0];
      if (Array.isArray(v) || typeof v === 'string') return v.length;
      if (v && typeof v === 'object') return Object.keys(v).length;
      return 0;
    }
    case 'fn:print': {
      const line = args.map((a) => str(a)).join(' ');
      os.printToProcess(sys, proc, line);
      charge(2);
      return null;
    }
    case 'fn:substr': return str(args[0]).substr(num(args[1]), args[2] === undefined ? undefined : num(args[2]));
    case 'fn:num': return num(args[0]);
    case 'fn:keys': {
      const v = args[0];
      if (Array.isArray(v)) return v.map((_, i) => i);
      if (v && typeof v === 'object') return Object.keys(v);
      return [];
    }
    case 'fn:append': {
      const arr = Array.isArray(args[0]) ? args[0] : [];
      arr.push(args[1]);
      return arr;
    }
    case 'fn:type':
      if (Array.isArray(args[0])) return 'array';
      if (args[0] === null) return 'null';
      return typeof args[0];
    case 'fn:min': return Math.min(num(args[0]), num(args[1]));
    case 'fn:max': return Math.max(num(args[0]), num(args[1]));
    case 'fn:abs': return Math.abs(num(args[0]));
    case 'fn:floor': return Math.floor(num(args[0]));
    case 'fn:ceil': return Math.ceil(num(args[0]));
    case 'fn:round': return Math.round(num(args[0]));
    case 'fn:sqrt': return Math.sqrt(Math.max(0, num(args[0])));
    case 'fn:sin': return Math.sin(num(args[0]));
    case 'fn:cos': return Math.cos(num(args[0]));
    case 'fn:atan2': return Math.atan2(num(args[0]), num(args[1]));
    case 'fn:clamp': return Math.max(num(args[1]), Math.min(num(args[2]), num(args[0])));
    case 'fn:range': { const n = Math.max(0, Math.min(10000, Math.floor(num(args[0])))); return Array.from({ length: n }, (_, i) => i); }
    case 'fn:join': {
      const arr = Array.isArray(args[0]) ? args[0] : [];
      return arr.map((x) => str(x)).join(str(args[1] ?? ','));
    }
    case 'fn:rand': {
      sys.rngState = (sys.rngState * 1664525 + 1013904223) >>> 0;
      return sys.rngState / 4294967296;
    }
  }

  switch (id) {
    // ---- sys ----
    case 'sys.pid': return proc.pid;
    case 'sys.time': return sys.clock;
    case 'sys.timeScale': return sys.timeScale;
    case 'sys.systemName': return sys.name;
    case 'sys.wait': {
      const wake = consumeWake(proc, id);
      if (wake) return null;
      const seconds = Math.max(0, num(args[0]));
      if (seconds <= 0) return null;
      block({ kind: 'time', until: sys.clock + seconds });
      return null;
    }
    case 'sys.stepWait': {
      const wake = consumeWake(proc, id);
      if (wake) return wake.dt ?? sys._delta ?? 0.05;
      charge(1);
      block({ kind: 'step' });
      return null;
    }
    case 'sys.remaining': return Math.max(0, sys.budget - sys.spent);
    case 'sys.log': {
      const text = args.map((a) => str(a)).join(' ');
      sys.log.push({ at: sys.clock, pid: proc.pid, text });
      if (sys.log.length > 500) sys.log.shift();
      os.emit('kernel-log', { systemId: sys.id, text, pid: proc.pid });
      return true;
    }
    case 'sys.setReady': {
      sys.bootMessage = str(args[0] ?? '运行中');
      proc.ready = true;
      return true;
    }
    case 'sys.registerSyscall': {
      const name = str(args[0]);
      const impl = str(args[1]);
      if (!name) return false;
      sys.syscalls[name] = impl;
      os.emit('syscall-registered', { systemId: sys.id, name, impl });
      return true;
    }
    case 'sys.syscall': {
      const name = str(args[0]);
      const impl = sys.syscalls[name];
      if (!impl) return null;
      return primitive(sys, impl, args.slice(1));
    }
    case 'sys.fsPolicy': {
      const policy = str(args[0]);
      if (!['normal', 'readonly'].includes(policy)) return false;
      sys.policies.fsPolicy = policy;
      return true;
    }
    case 'sys.deliverMode': {
      const mode = str(args[0]);
      if (!['fifo', 'lifo'].includes(mode)) return false;
      sys.policies.deliveryMode = mode;
      return true;
    }
    case 'sys.charge': charge(num(args[0])); return true;
    case 'sys.spawn': return sysSpawn(os, sys, proc, args, charge);
    case 'sys.kill': {
      const pid = num(args[0]);
      const target = sys.processes.find((p) => p.pid === pid);
      if (!target) return false;
      os.removeProcess(sys.id, pid);
      return true;
    }
    case 'sys.procs': {
      charge(2);
      return sys.processes.map((p) => ({
        pid: p.pid, name: p.name, kind: p.kind, state: p.state,
        cpu: p.cpu, memory: p.memory, quota: p.quota, remaining: p.remaining,
        messages: p.messages.length, error: p.error,
      }));
    }
    case 'sys.run': {
      if (!proc.isKernel) return 0;
      const pid = num(args[0]);
      const quantum = num(args[1]) || 300;
      const spent = os.runProcessSlice(sys, pid, quantum);
      charge(1);
      return spent;
    }

    // ---- fs ----
    case 'fs.read': {
      const path = F.normalizePath(str(args[0]));
      const node = F.resolveNode(sys.fs, path);
      if (!node || node.type !== 'file') return null;
      charge(2 + node.content.length / 512);
      proc.memory = Math.min(proc.memory + node.content.length * 2, sys.memoryLimitMB * 1024 * 1024);
      return node.meta?.encoding === 'base64' ? null : node.content;
    }
    case 'fs.write': {
      const path = F.normalizePath(str(args[0]));
      const content = str(args[1]);
      try {
        os.writeFile(sys.id, path, content, { kind: 'text' });
        charge(2 + content.length / 256);
        return true;
      } catch (err) {
        os.printToProcess(sys, proc, '[fs.write] ' + err.message);
        return false;
      }
    }
    case 'fs.list': {
      const path = F.normalizePath(str(args[0]));
      const node = F.resolveNode(sys.fs, path);
      if (!node || node.type !== 'dir') return null;
      charge(2 + node.children.length);
      return node.children.map((c) => c.name);
    }
    case 'fs.mkdir': {
      try { os.mkdir(sys.id, F.normalizePath(str(args[0]))); charge(4); return true; }
      catch (err) { os.printToProcess(sys, proc, '[fs.mkdir] ' + err.message); return false; }
    }
    case 'fs.rename': {
      const from = F.normalizePath(str(args[0]));
      const to = F.normalizePath(str(args[1]));
      try {
        const node = F.resolveNode(sys.fs, from);
        const targetParent = F.resolveNode(sys.fs, F.parentPath(to));
        if (!node || !targetParent || targetParent.type !== 'dir') return false;
        if (sys.policies.fsPolicy === 'readonly') return false;
        const fromParent = F.resolveNode(sys.fs, F.parentPath(from));
        fromParent.children = fromParent.children.filter((c) => c !== node);
        node.name = F.baseName(to);
        targetParent.children.push(node);
        os.emit('fs-changed', { systemId: sys.id, path: to });
        charge(4);
        return true;
      } catch { return false; }
    }
    case 'fs.delete': {
      try { os.deleteToTrash(sys.id, F.normalizePath(str(args[0]))); charge(4); return true; }
      catch { return false; }
    }
    case 'fs.exists': {
      const node = F.resolveNode(sys.fs, F.normalizePath(str(args[0])));
      return !!node;
    }
    case 'fs.size': {
      const node = F.resolveNode(sys.fs, F.normalizePath(str(args[0])));
      return node ? F.fileSize(node) : 0;
    }
    case 'fs.type': {
      const node = F.resolveNode(sys.fs, F.normalizePath(str(args[0])));
      return node ? node.type : null;
    }
    case 'fs.copy': {
      try {
        const from = F.normalizePath(str(args[0]));
        const toDir = F.normalizePath(str(args[1]));
        if (sys.policies.fsPolicy === 'readonly') return false;
        F.copyInto(sys.fs, from, toDir);
        os.emit('fs-changed', { systemId: sys.id });
        charge(8);
        return true;
      } catch { return false; }
    }

    // ---- msg ----
    case 'msg.send': {
      const pid = num(args[0]);
      const ok = os.sendMessage(sys.id, proc.pid, pid, args[1]);
      charge(1);
      return ok;
    }
    case 'msg.recv': {
      const existing = os.popMessageForRecv(sys, proc);
      if (existing !== null) {
        consumeWake(proc, id);
        return existing;
      }
      const wake = consumeWake(proc, id);
      if (wake) {
        if (wake.reason === 'timeout') return null;
        const again = os.popMessageForRecv(sys, proc);
        return again === undefined ? null : again;
      }
      const timeout = Math.max(0, num(args[0]));
      block({
        kind: timeout > 0 ? 'recv' : 'recv',
        until: timeout > 0 ? sys.clock + timeout : 0,
      });
      return null;
    }
    case 'msg.peek': {
      return proc.messages.length ? clone(proc.messages[0].payload) : null;
    }
    case 'msg.count': return proc.messages.length;

    // ---- proc ----
    case 'proc.find': {
      const name = str(args[0]);
      const p = sys.processes.find((x) => x.name === name && x.state !== 'ended');
      return p ? p.pid : 0;
    }
    case 'proc.list': return sys.processes.map((p) => ({ pid: p.pid, name: p.name, state: p.state, cpu: p.cpu }));
    case 'proc.name': return proc.name;
    case 'proc.pid': return proc.pid;

    // ---- ui / wm ----
    case 'ui.windowOrder': {
      const policy = str(args[0] || 'stack');
      charge(1);
      return os.windowOrder(sys.id, policy);
    }
    case 'ui.wmPolicy': {
      sys.wmPolicy = {
        policy: str(args[0] || 'stack'),
        cascade: Math.max(0, Math.min(120, num(args[1] ?? 28))),
        focusRule: str(args[2] || 'recent'),
      };
      os.emit('wm-policy', { systemId: sys.id, policy: sys.wmPolicy });
      return true;
    }
    case 'ui.wmApply': {
      const order = Array.isArray(args[0]) ? args[0].map(String) : [];
      os.applyWindowOrder(sys.id, order);
      return true;
    }
    case 'ui.windows': return sys.windows.map((w) => ({
      id: w.id, appId: w.appId, title: w.title, state: w.state, z: w.z, focused: sys.focusId === w.id,
    }));
    case 'ui.notify': {
      os.notify(sys.id, { title: str(args[0] || '程序通知'), body: str(args[1] || ''), kind: 'info' });
      return true;
    }

    // ---- app 服务 ----
    case 'app.configure': {
      const appId = str(args[0]);
      if (!appId) return false;
      if (appId === 'files') sys.appConfig.files = { sort: str(args[1] || 'kind'), hidden: truthy(args[2]) };
      else if (appId === 'player') sys.appConfig.player = { fps: num(args[1]) || 30, loop: truthy(args[2]), defaultScene: str(args[3] || '') };
      else if (appId === 'charts') sys.appConfig.charts = {
        transition: num(args[1]) || 0.35, seriesLimit: num(args[2]) || 6,
        barGap: args[3] === undefined ? 0.18 : num(args[3]),
        lineWidth: args[4] === undefined ? 2 : num(args[4]),
        defaultType: str(args[5] || 'bar'),
      };
      else sys.appConfig[appId] = { args: clone(args.slice(1)) };
      os.emit('app-config', { systemId: sys.id, appId, config: sys.appConfig[appId] });
      return true;
    }
    case 'app.pump': {
      const appId = str(args[0]);
      charge(2);
      const hook = os.pumpHooks?.[`${sys.id}:${appId}`] || os.pumpHooks?.[appId];
      if (hook) { try { hook(sys); } catch (err) { os.printToProcess(sys, proc, '[app.pump] ' + err.message); } }
      return true;
    }

    // ---- flight ----
    case 'flight.bind': {
      proc.flightBound = true;
      sys.flightControllerPid = proc.pid;
      os.notify(sys.id, { title: '飞控进程已接管', body: `${proc.name} (PID ${proc.pid})`, kind: 'info', appId: 'player' });
      return true;
    }
    case 'flight.sensors': {
      if (!proc.flightBound) return null;
      const s = sys.flightState;
      if (!s) return null;
      charge(1);
      return clone(s);
    }
    case 'flight.setControls': {
      if (!proc.flightBound) return false;
      if (proc.state === 'suspended') return false;
      sys.flightControls = {
        collective: num(args[0]), pitch: num(args[1]), roll: num(args[2]), yaw: num(args[3]),
        at: sys.clock, pid: proc.pid,
      };
      return true;
    }

    // ---- compiler ----
    case 'compiler.configure': {
      sys.compilerConfig = {
        prelude: str(args[0] || ''),
        allowLoops: args[1] === undefined ? true : truthy(args[1]),
        name: str(args[2] || 'nplc'),
      };
      return true;
    }

    // ---- math / json / str ----
    case 'math.abs': return Math.abs(num(args[0]));
    case 'math.floor': return Math.floor(num(args[0]));
    case 'math.ceil': return Math.ceil(num(args[0]));
    case 'math.round': return Math.round(num(args[0]));
    case 'math.sqrt': return Math.sqrt(Math.max(0, num(args[0])));
    case 'math.sin': return Math.sin(num(args[0]));
    case 'math.cos': return Math.cos(num(args[0]));
    case 'math.atan2': return Math.atan2(num(args[0]), num(args[1]));
    case 'math.min': return Math.min(num(args[0]), num(args[1]));
    case 'math.max': return Math.max(num(args[0]), num(args[1]));
    case 'math.clamp': return Math.max(num(args[1]), Math.min(num(args[2]), num(args[0])));
    case 'math.pow': return Math.pow(num(args[0]), num(args[1]));
    case 'json.stringify': { try { return JSON.stringify(args[0]); } catch { return 'null'; } }
    case 'json.parse': { try { return JSON.parse(str(args[0])); } catch { return null; } }
    case 'str.len': return str(args[0]).length;
    case 'str.upper': return str(args[0]).toUpperCase();
    case 'str.lower': return str(args[0]).toLowerCase();
    case 'str.substr': return str(args[0]).substr(num(args[1]), args[2] === undefined ? undefined : num(args[2]));
    case 'str.split': return str(args[0]).split(str(args[1] ?? ''));
    case 'str.indexOf': return str(args[0]).indexOf(str(args[1]));
    default:
      throw new Error('未知系统接口 ' + id);
  }
}

function sysSpawn(os, sys, proc, args, charge) {
  const path = F.normalizePath(str(args[0]));
  const name = str(args[1] || F.baseName(path));
  if (sys.processes.length >= 64) return 0;
  const node = F.resolveNode(sys.fs, path);
  if (!node || node.type !== 'file') {
    os.printToProcess(sys, proc, `[sys.spawn] 找不到程序 ${path}`);
    return 0;
  }
  let prog;
  try {
    prog = os.compileWithSystem(sys, node.content, path);
  } catch (err) {
    os.printToProcess(sys, proc, `[sys.spawn] 编译失败：${err.message}`);
    return 0;
  }
  const roleByPath = {
    '/Apps/wm.prog': 'wm', '/Apps/files.prog': 'files',
    '/Apps/player.prog': 'player', '/Apps/charts.prog': 'charts',
  };
  const role = roleByPath[path] || 'custom';
  if (role !== 'custom') {
    const existing = sys.processes.find((p) => p.role === role && p.state !== 'ended');
    if (existing) return existing.pid;
  }
  charge(4 + node.content.length / 64);
  const p = os.addProcessInternal(sys, {
    pid: os.allocPid(sys), name, kind: 'vm', role,
    state: 'ready', programPath: path, programSource: node.content,
    vm: createVM(prog), quota: role === 'kernel' ? 2000 : 700, memory: 8192,
    appId: role === 'custom' ? null : role,
  });
  os.emit('process-created', { systemId: sys.id, pid: p.pid });
  os.printToProcess(sys, proc, `[sys.spawn] ${name} → PID ${p.pid}`);
  return p.pid;
}
