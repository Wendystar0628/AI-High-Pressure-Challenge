/* ============================================================================
 * 运行时核心：虚拟文件系统、栈式 VM、内核程序执行、分级预算调度、消息/文件/显示服务。
 * 所有状态都是纯数据（无函数/DOM 引用），因此整棵子树可被快照/恢复/分叉。
 * ========================================================================== */
(function (OS) {
  'use strict';
  const clone = (v) => OS.util.deepClone(v);
  const BASE_DT = 1 / 30;          // 单个逻辑步的基础虚拟时间（1 倍速 ≈ 真实时间）
  const KEEP_SHARE = 0.40;         // 系统保留给自身内核+用户进程的工作预算比例
  const CHILD_SHARE = 0.52;        // 拨付给直属子系统的比例（兄弟共享）

  const rt = {};
  rt.BASE_DT = BASE_DT;

  // ---------------------------------------------------------------- 虚拟文件系统
  function makeFS() { return { nodes: { '/': { type: 'dir', name: '', mime: null } }, recycle: [] }; }
  function parentPath(p) { const i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); }
  function baseName(p) { const i = p.lastIndexOf('/'); return p.slice(i + 1); }
  function normPath(p) { if (!p) return '/'; p = p.replace(/\\/g, '/'); if (p[0] !== '/') p = '/' + p; if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1); return p; }
  function fsGet(fs, p) { return fs.nodes[normPath(p)]; }
  function fsExists(fs, p) { return !!fs.nodes[normPath(p)]; }
  function fsMkdir(fs, p) {
    p = normPath(p);
    if (fs.nodes[p]) return;
    const par = parentPath(p);
    if (par !== p && !fs.nodes[par]) fsMkdir(fs, par);
    fs.nodes[p] = { type: 'dir', name: baseName(p), mime: null };
  }
  function fsWrite(fs, p, content, mime) {
    p = normPath(p);
    fsMkdir(fs, parentPath(p));
    fs.nodes[p] = { type: 'file', name: baseName(p), content, mime: mime || guessMime(p) };
  }
  function fsRead(fs, p) { const n = fsGet(fs, p); return n && n.type === 'file' ? n.content : null; }
  function fsList(fs, dir) {
    dir = normPath(dir);
    const out = [];
    for (const p in fs.nodes) {
      if (p === dir) continue;
      if (parentPath(p) === dir) out.push({ path: p, name: baseName(p), type: fs.nodes[p].type, mime: fs.nodes[p].mime, size: estSize(fs.nodes[p].content) });
    }
    out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    return out;
  }
  function fsDelete(fs, p, recycle) {
    p = normPath(p); const n = fs.nodes[p]; if (!n) return false;
    function collect(pp) {
      for (const q in fs.nodes) if (q === pp || q.startsWith(pp + '/')) { if (fs.nodes[q].type === 'file') recycle.push({ path: q, content: clone(fs.nodes[q].content), mime: fs.nodes[q].mime, name: baseName(q), deletedAt: Date.now() }); delete fs.nodes[q]; }
    }
    collect(p); return true;
  }
  function fsRename(fs, p, np) {
    p = normPath(p); np = normPath(np);
    const keys = Object.keys(fs.nodes).filter((q) => q === p || q.startsWith(p + '/'));
    for (const q of keys) { const nq = np + q.slice(p.length); fs.nodes[nq] = fs.nodes[q]; if (fs.nodes[nq].type === 'dir' || fs.nodes[nq].type === 'file') fs.nodes[nq].name = baseName(nq); delete fs.nodes[q]; }
  }
  function guessMime(p) {
    if (/\.npl$/i.test(p)) return 'program';
    if (/\.scene$/i.test(p)) return 'scene';
    if (/\.sheet$/i.test(p)) return 'sheet';
    if (/\.json$/i.test(p)) return 'json';
    if (/\.(txt|md)$/i.test(p)) return 'text';
    if (/\.snap$/i.test(p)) return 'snapshot';
    if (/\.(svg|png|jpg)$/i.test(p)) return 'image';
    return 'text';
  }
  function estSize(c) { if (c == null) return 0; if (typeof c === 'string') return c.length; try { return JSON.stringify(c).length; } catch (e) { return 16; } }
  function fsStorage(fs) { let s = 0; for (const p in fs.nodes) if (fs.nodes[p].type === 'file') s += estSize(fs.nodes[p].content); return s; }

  rt.fs = { makeFS, read: fsRead, write: fsWrite, get: fsGet, exists: fsExists, mkdir: fsMkdir, list: fsList, delete: fsDelete, rename: fsRename, parent: parentPath, base: baseName, norm: normPath, storage: fsStorage, guessMime };

  // ---------------------------------------------------------------- 预算池
  function makePool(n) { return { start: n, remaining: n, consume(k) { if (this.remaining < k) return false; this.remaining -= k; return true; } }; }

  // ---------------------------------------------------------------- 进程 / VM
  function blankProc() {
    return {
      pid: 0, name: '', isKernel: false, isApp: false, isCarrier: false, isCompiler: false,
      prog: null, pc: 0, stack: [], vars: {}, status: 'ready',
      hasReply: false, replyValue: undefined, waitReqId: null,
      deferred: null, sleepStart: 0, mailbox: [], waitUntil: 0,
      param: null, winId: null, appType: null, yielded: false, error: null,
      consumed: 0, work: 0, childId: null, kernelPart: 0, innerPart: 0,
    };
  }

  // 运行一条进程若干步；返回实际执行步数。pool 为系统工作池（可为 null 表示不计预算）。
  function stepProcess(proc, sys, pool, maxSteps, opts) {
    opts = opts || {};
    const allowSyscalls = opts.allowSyscalls !== false;
    if (!proc.prog) return 0;
    const code = proc.prog.code;
    let steps = 0;
    if (proc.hasReply) { // 系统调用返回：跳过 CALL，把结果压栈
      proc.stack.push(proc.replyValue);
      proc.hasReply = false; proc.replyValue = undefined;
    }
    proc.status = 'running';
    const ctx = { proc, sys, pool };
    while (steps < maxSteps) {
      if (pool && !pool.consume(1)) break;
      const ins = code[proc.pc];
      if (!ins) { proc.status = 'done'; break; }
      proc.pc++; steps++; proc.consumed++;
      try {
        switch (ins.op) {
          case 'PUSH': proc.stack.push(ins.a); break;
          case 'LOAD': { const v = proc.vars[ins.a]; proc.stack.push(v === undefined ? null : v); break; }
          case 'STORE': proc.vars[ins.a] = proc.stack.pop(); break;
          case 'ARR': { const n = ins.a; const a = []; for (let k = 0; k < n; k++) a.push(proc.stack.pop()); a.reverse(); proc.stack.push(a); break; }
          case 'OBJ': {
            const n = ins.a; const vals = []; for (let k = 0; k < 2 * n; k++) vals.push(proc.stack.pop());
            const o = {}; for (let j = 0; j < n; j++) { const v = vals[2 * (n - 1 - j)], key = vals[2 * (n - 1 - j) + 1]; o[key] = v; }
            proc.stack.push(o); break;
          }
          case 'GETI': { const idx = proc.stack.pop(), o = proc.stack.pop(); proc.stack.push(o == null ? null : (Array.isArray(o) ? o[idx] : (typeof o === 'string' ? o.charAt(idx) : o[idx]))); break; }
          case 'GETF': { const o = proc.stack.pop(); proc.stack.push(o == null ? null : o[ins.a]); break; }
          case 'SETI': { const v = proc.stack.pop(), idx = proc.stack.pop(), o = proc.stack.pop(); if (o != null) o[idx] = v; break; }
          case 'SETF': { const v = proc.stack.pop(), o = proc.stack.pop(); if (o != null) o[ins.a] = v; break; }
          case 'UN': { const a = proc.stack.pop(); proc.stack.push(ins.a === '!' ? !a : -(+a || 0)); break; }
          case 'BIN': { const b = proc.stack.pop(), a = proc.stack.pop(); proc.stack.push(binop(ins.a, a, b)); break; }
          case 'JMP': proc.pc = ins.a; break;
          case 'JF': { const c = proc.stack.pop(); if (!c) proc.pc = ins.a; break; }
          case 'POP': proc.stack.pop(); break;
          case 'CALL': {
            const argc = ins.b; const args = []; for (let k = 0; k < argc; k++) args.push(proc.stack.pop()); args.reverse();
            const res = handleCall(ins.a, args, ctx, allowSyscalls, proc.pc);
            if (res !== BLOCK) proc.stack.push(res);
            break;
          }
          case 'HALT': proc.status = 'done'; break;
          default: throw new Error('未知指令 ' + ins.op);
        }
      } catch (e) {
        proc.status = 'error'; proc.error = String(e && e.message || e);
        if (proc.isKernel) { sys.state = 'error'; sys.kernelError = proc.error; }
        break;
      }
      if (proc.status !== 'running') break;
    }
    if (proc.status === 'running') proc.status = 'ready';
    return steps;
  }
  const BLOCK = Symbol('BLOCK');

  function binop(op, a, b) {
    switch (op) {
      case '+': if (typeof a === 'string' || typeof b === 'string') return str(a) + str(b); return (+a || 0) + (+b || 0);
      case '-': return (+a || 0) - (+b || 0);
      case '*': return (+a || 0) * (+b || 0);
      case '/': { const d = +b || 0; if (d === 0) return 0; return (+a || 0) / d; }
      case '%': { const d = +b || 0; if (d === 0) return 0; return (+a || 0) % d; }
      case '==': return eq(a, b); case '!=': return !eq(a, b);
      case '<': return (+a || 0) < (+b || 0); case '>': return (+a || 0) > (+b || 0);
      case '<=': return (+a || 0) <= (+b || 0); case '>=': return (+a || 0) >= (+b || 0);
      case '&&': return !!a && !!b; case '||': return !!a || !!b;
      default: return 0;
    }
  }
  function str(v) { return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); }
  function eq(a, b) { if (a == null || b == null) return a === b; return a === b || String(a) === String(b); }

  function handleCall(name, args, ctx, allowSyscalls, pcAfterCall) {
    const { proc, sys, pool } = ctx;
    if (OS.PURE[name]) return OS.PURE[name](args, ctx);
    if (proc.isKernel && name.slice(0, 2) === 'k_') return callPrim(name, args, ctx);
    // 普通程序（或编译器）调用：作为「系统调用请求」交给内核分发
    if (!allowSyscalls) return null;   // 编译器模式：无系统调用
    const id = createRequest(sys, proc.pid, name, args);
    proc.status = 'waiting-syscall';
    proc.waitReqId = id;
    proc.replyValue = undefined; proc.hasReply = false;
    return BLOCK;
  }

  // ---------------------------------------------------------------- 系统调用请求
  function createRequest(sys, pid, name, args) {
    const id = ++sys.nextReqId;
    sys.requests.push({ id, pid, name, args: clone(args), state: 'pending' });
    return id;
  }
  function findRequest(sys, id) { return sys.requests.find((r) => r.id === id); }
  function doReply(sys, req, value) {
    if (!req) return;
    req.state = 'answered';
    const proc = sys.procs[req.pid];
    if (!proc || proc.status === 'done') return;
    proc.hasReply = true; proc.replyValue = clone(value);
    proc.deferred = null; proc.waitReqId = null;
    if (proc.status !== 'suspended') proc.status = 'ready';
  }

  // ---------------------------------------------------------------- 内核特权原语
  function callPrim(name, args, ctx) {
    const { sys, pool } = ctx;
    switch (name) {
      case 'k_wake': {
        for (const pid in sys.procs) {
          const p = sys.procs[pid];
          if (p.status === 'suspended' || !p.deferred) continue;
          const d = p.deferred;
          if (d.kind === 'time') {
            if (sys.virtualTime >= d.until) doReply(sys, findRequest(sys, d.id), sys.virtualTime - p.sleepStart);
          } else if (d.kind === 'msg') {
            if (p.mailbox.length) { const m = p.mailbox.shift(); doReply(sys, findRequest(sys, d.id), m.value); }
          }
        }
        return null;
      }
      case 'k_requests': {
        const out = [];
        for (const r of sys.requests) if (r.state === 'pending') { r.state = 'taken'; out.push({ id: r.id, pid: r.pid, name: r.name, args: r.args }); }
        // 清理已答复请求（保留 taken/deferred，k_wake 仍需按 id 找到延迟请求）
        sys.requests = sys.requests.filter((r) => r.state !== 'answered');
        return out;
      }
      case 'k_reply': doReply(sys, findRequest(sys, args[0]), args[1]); return null;
      case 'k_time': return sys.virtualTime;
      case 'k_runnable': {
        const out = [];
        for (const pid in sys.procs) { const p = sys.procs[pid]; if (!p.isKernel && !p.isApp && !p.isCarrier && p.prog && p.status === 'ready') out.push(p.pid); }
        return out;
      }
      case 'k_step': {
        const p = sys.procs[args[0]]; if (!p || p.status !== 'ready' || !p.prog) return 0;
        const s = stepProcess(p, sys, pool, Math.max(1, +args[1] || 1));
        sys.userConsumedThisTick += s; return s;
      }
      case 'k_newProcess': {
        const p = spawn(sys, String(args[0]), null, args[1], {}); return p ? p.pid : -1;
      }
      case 'k_kill': { const p = sys.procs[args[0]]; if (p) { p.status = 'done'; p.mailbox = []; } return 1; }
      case 'k_deliver': {
        const to = sys.procs[args[0]];
        if (!to || to.status === 'done') return -1;
        to.mailbox.push({ from: args[1], value: clone(args[2]), at: sys.virtualTime });
        return 1;
      }
      case 'k_recv': {
        const req = findRequest(sys, args[0]); const pid = args[1]; const p = sys.procs[pid];
        if (p && p.mailbox.length) { const m = p.mailbox.shift(); doReply(sys, req, m.value); }
        else { if (req) req.state = 'deferred'; if (p) { p.deferred = { id: args[0], kind: 'msg' }; p.status = 'waiting-msg'; p.waitReqId = args[0]; } }
        return null;
      }
      case 'k_tryrecv': { const p = sys.procs[args[0]]; return (p && p.mailbox.length) ? p.mailbox.shift().value : null; }
      case 'k_sleep': {
        const req = findRequest(sys, args[0]); const pid = args[1]; const dt = Math.max(0, +args[2] || 0); const p = sys.procs[pid];
        if (req) req.state = 'deferred';
        if (p) { p.deferred = { id: args[0], kind: 'time', until: sys.virtualTime + dt }; p.sleepStart = sys.virtualTime; p.status = 'waiting-time'; p.waitReqId = args[0]; }
        return null;
      }
      case 'k_readFile': return clone(rt.fs.read(sys.fs, String(args[0])));
      case 'k_listDir': return rt.fs.list(sys.fs, String(args[0])).map((n) => ({ path: n.path, name: n.name, type: n.type, mime: n.mime, size: n.size }));
      case 'k_writeFile': {
        const p = String(args[0]); const v = args[1];
        if (fsStorage(sys.fs) + estSize(v) > sys.storage.limit) return -1;   // 配额不足
        rt.fs.write(sys.fs, p, typeof v === 'string' ? v : clone(v)); return 1;
      }
      case 'k_display': {
        const p = sys.procs[args[0]]; const wid = p ? p.winId : null; const area = String(args[1]);
        if (wid) { if (!sys.display[wid]) sys.display[wid] = {}; sys.display[wid][area] = clone(args[2]); }
        return 1;
      }
      case 'k_log': { sys.log.push(String(args[0])); if (sys.log.length > 300) sys.log.shift(); return 1; }
      case 'k_consume': { if (pool) pool.consume(Math.max(0, +args[0] || 0)); return null; }
      case 'k_setSensor': sys.flightBus.sensor[String(args[0])] = clone(args[1]); return 1;
      case 'k_getSensor': return clone(sys.flightBus.sensor[String(args[0])] || { t: 0, y: 1, vy: 0, pitch: 0, roll: 0, yaw: 0 });
      case 'k_setControl': sys.flightBus.control[String(args[0])] = clone(args[1]); return 1;
      case 'k_getControl': return clone(sys.flightBus.control[String(args[0])] || { collective: 0.5, cyclic: 0, pedal: 0, t: 0 });
      case 'k_setFlightInput': { const v = clone(args[1]); sys.flightBus.input[String(args[0])] = Object.assign(sys.flightBus.input[String(args[0])] || {}, v); return 1; }
      case 'k_getFlightInput': return clone(sys.flightBus.input[String(args[0])] || { wind: 0, heading: 0, fault: 0 });
      default: throw new Error('未知内核原语 ' + name + '（内核程序可能有误）');
    }
  }

  // ---------------------------------------------------------------- 编译器 / 创建进程
  function runCompiler(prog, src, sys, pool) {
    const p = blankProc(); p.prog = prog; p.param = src; p.isCompiler = true; p.status = 'ready';
    let guard = 0;
    while (p.status !== 'done' && p.status !== 'error' && guard++ < 200) {
      stepProcess(p, sys, pool, 4000, { allowSyscalls: false });
      if (p.status === 'ready' && p.pc >= prog.code.length) break;
    }
    return p.vars['__out'];
  }
  function preprocess(sys, source) {
    const comp = sys.compilerActive || rt.fs.read(sys.fs, '/System/compiler.npl');
    if (!comp) return source;
    const res = OS.compile(comp);
    if (!res.ok) { sys.compilerError = res.error; return source; }
    const out = runCompiler(res.prog, source, sys, sys._pool || null);
    return typeof out === 'string' ? out : source;
  }
  function selfCompile(sys) {
    const src = rt.fs.read(sys.fs, '/System/compiler.npl');
    const res = OS.compile(src || '');
    if (!res.ok) { sys.compilerError = res.error; return { ok: false, error: res.error }; }
    sys.compilerActive = src; sys.compilerError = null;
    return { ok: true };
  }

  function spawn(sys, sourceOrPath, name, param, opts) {
    opts = opts || {};
    let source = sourceOrPath; let fileMissing = false;
    if (opts.fromFile !== false && typeof sourceOrPath === 'string' && sourceOrPath[0] === '/') {
      const c = rt.fs.read(sys.fs, sourceOrPath);
      if (typeof c === 'string') source = c; else fileMissing = true;
    }
    const processed = opts.isKernel ? source : preprocess(sys, source);
    const res = OS.compile(processed);
    const p = blankProc();
    p.pid = sys.nextPid++; p.name = name || (opts.isKernel ? 'kernel' : 'program');
    p.isKernel = !!opts.isKernel; p.isApp = !!opts.isApp; p.isCarrier = !!opts.isCarrier;
    p.param = clone(param); p.winId = opts.winId || null; p.appType = opts.appType || null;
    p.childId = opts.childId || null;
    if (fileMissing) { p.status = 'error'; p.error = '程序文件不存在：' + sourceOrPath; }
    else if (!res.ok) {
      p.status = 'error'; p.error = res.error;
      if (p.isKernel) { sys.state = 'error'; sys.kernelError = res.error; }
    } else { p.prog = res.prog; p.status = 'ready'; }
    sys.procs[p.pid] = p;
    return p;
  }
  function bookCarrier(parentSys, childId, name) {
    const p = blankProc(); p.pid = parentSys.nextPid++; p.name = name; p.isCarrier = true;
    p.childId = childId; p.status = 'running'; p.appType = 'carrier';
    parentSys.procs[p.pid] = p; return p;
  }
  function injectMessage(sys, pid, value) {
    const p = sys.procs[pid]; if (!p || p.status === 'done') return false;
    p.mailbox.push({ from: 'external', value: clone(value), at: sys.virtualTime }); return true;
  }

  // ---------------------------------------------------------------- 系统创建
  function initialFiles(sys, isRoot) {
    const fs = sys.fs;
    const D = OS.data;
    rt.fs.mkdir(fs, '/Documents'); rt.fs.mkdir(fs, '/Downloads'); rt.fs.mkdir(fs, '/Demo');
    rt.fs.mkdir(fs, '/Programs'); rt.fs.mkdir(fs, '/System'); rt.fs.mkdir(fs, '/Kernels');
    rt.fs.mkdir(fs, '/Wallpapers'); rt.fs.mkdir(fs, '/Snapshots'); rt.fs.mkdir(fs, '/Flight');
    rt.fs.write(fs, '/Documents/欢迎.txt', D.welcomeText, 'text');
    rt.fs.write(fs, '/Documents/说明.txt', D.welcomeText, 'text');
    rt.fs.write(fs, '/System/compiler.npl', D.compiler, 'program');
    rt.fs.write(fs, '/Kernels/kernel.npl', D.kernelTemplate, 'program');
    rt.fs.write(fs, '/System/kernel.npl', D.kernelTemplate, 'program');
    rt.fs.write(fs, '/Wallpapers/壁纸说明.txt', '壁纸资源位于项目 assets/wallpapers 目录；设置里可切换。', 'text');
    for (const k in D.programs) rt.fs.write(fs, '/Programs/' + k, D.programs[k], 'program');
    rt.fs.write(fs, '/Demo/helicopter-24.scene', clone(D.scene), 'scene');
    rt.fs.write(fs, '/Demo/minimal.scene', clone(D.minimalScene), 'scene');
    if (isRoot) rt.fs.write(fs, '/Demo/sample.sheet', clone(D.workbook), 'sheet');
    rt.fs.write(fs, '/Flight/sensor.json', { t: 0 }, 'json');
  }

  function newSystemObject(id, name, parentId, depth) {
    const sys = {
      id, name, parentId, children: [], depth,
      kernelPath: parentId ? '/Kernels/' + id + '.npl' : '/System/kernel.npl',
      kernelSource: null, carrierPid: null, wmPid: null, filemgrPid: null, _wmHash: '',
      state: 'running', paused: false, kernelError: null,
      timeScale: 1, virtualTime: 0, effectiveDt: 0, rngState: 2166136261 ^ (depth * 2654435761),
      fs: makeFS(), nextPid: 1, procs: {}, kernelPid: null, nextReqId: 0,
      requests: [], log: [], display: {}, flightBus: { sensor: {}, control: { main: { collective: 0.5, cyclic: 0, pedal: 0, t: 0 } }, input: { main: { wind: 0, heading: 0, fault: 0 } } },
      budget: 9000, grantCap: 7000, memory: { limit: 96000, used: 0 }, storage: { limit: 120000, used: 0 },
      parentGrant: 0, grantThisTick: 0, consumedThisTick: 0, totalConsumedThisTick: 0,
      kernelConsumed: 0, userConsumed: 0, userConsumedThisTick: 0, workPoolThisTick: 0,
      windows: [], nextWindowId: 1, focusWindowId: null,
      desktop: { wallpaper: 'aurora', accent: '#8b5cf6', scale: 1, title: name },
      notifications: [], quick: { dnd: false, wifi: true, bluetooth: true, night: false },
      clipboardHistory: [], widgets: { note: '', timerEnd: 0, timerLeft: 0, timerRunning: false, stopwatch: 0, stopwatchRunning: false, monthOffset: 0 },
      appStates: {}, settings: {}, pendingChartUpdates: [],
      compilerActive: null, compilerError: null,
      notices: [],
      _pool: null,
    };
    return sys;
  }

  function openWindow(sys, spec) {
    const w = {
      id: 'w-' + sys.id + '-' + (sys.nextWindowId++), systemId: sys.id, appId: spec.appId, title: spec.title || spec.appId,
      x: spec.x == null ? 60 + sys.windows.length * 24 : spec.x,
      y: spec.y == null ? 50 + sys.windows.length * 20 : spec.y,
      w: spec.w || 720, h: spec.h || 480,
      state: spec.state || 'normal', z: ++rt.state._z, focused: true,
      icon: spec.icon || '▣', extra: spec.extra || {},
      targetSystemId: spec.targetSystemId || null,
      sourceSystemId: spec.sourceSystemId || null, sourceWindowId: spec.sourceWindowId || null, sourceAppId: spec.sourceAppId || null,
    };
    sys.windows.push(w); sys.focusWindowId = w.id;
    return w;
  }
  function findWindow(sys, wid) { return sys.windows.find((w) => w.id === wid); }
  function closeWindow(sys, wid) {
    const w = findWindow(sys, wid); if (!w) return;
    // 结束对应应用进程及协作进程
    endWindowProcesses(sys, w);
    sys.windows = sys.windows.filter((x) => x.id !== wid);
    // 关闭源窗口时结束所有指向它的投送
    for (const sid in rt.state.systems) {
      const s = rt.state.systems[sid];
      const before = s.windows.length;
      s.windows = s.windows.filter((x) => !(x.appId === 'projection' && x.sourceWindowId === wid && x.sourceSystemId === sys.id));
      if (s.windows.length !== before) rt.notify(s, '投送已结束', '源窗口已关闭');
    }
    delete sys.appStates[wid]; delete sys.display[wid];
    if (sys.focusWindowId === wid) sys.focusWindowId = sys.windows.length ? sys.windows[sys.windows.length - 1].id : null;
  }
  function endWindowProcesses(sys, w) {
    for (const pid in sys.procs) { const p = sys.procs[pid]; if (p.winId === w.id && !p.isKernel) p.status = 'done'; }
  }

  // 创建直属子系统：内核源文件写入父系统 FS，编译为内核进程；父系统建承载进程与系统窗口。
  function createSystem(parentId) {
    const parent = rt.state.systems[parentId]; if (!parent) return null;
    const n = ++rt.state.nextInnerNum;
    const id = 'inner-' + n;
    const sys = newSystemObject(id, id, parentId, parent.depth + 1);
    initialFiles(sys, false);
    // 内核源文件是父系统 FS 里的普通程序文件
    rt.fs.write(parent.fs, sys.kernelPath, OS.data.kernelTemplate, 'program');
    sys.kernelSource = OS.data.kernelTemplate;
    // 父系统承载进程
    const carrier = bookCarrier(parent, id, '子系统 ' + id);
    sys.carrierPid = carrier.pid;
    // 内核进程
    const kp = spawn(sys, OS.data.kernelTemplate, 'kernel', null, { isKernel: true, fromFile: false });
    sys.kernelPid = kp.pid;
    // 窗口管理与文件管理是内核启动时拉起的系统内程序：从本系统文件载入，
    // 因此改写 /Programs/wm.npl 或 filemgr.npl 并重启后按新规则运行。
    const wm = spawn(sys, '/Programs/wm.npl', 'wm', null, { winId: '__wm' });
    sys.wmPid = wm.pid;
    const fm = spawn(sys, '/Programs/filemgr.npl', 'filemgr', null, { winId: '__files' });
    sys.filemgrPid = fm.pid;
    if (sys.state === 'error') rt.notify(parent, '内核错误', id + ' 内核编译失败：' + sys.kernelError);
    parent.children.push(id);
    rt.state.systems[id] = sys;
    // 系统窗口（父桌面与子桌面都可见）
    const w = openWindow(parent, {
      appId: 'system', title: '子系统 · ' + id, icon: '◱',
      x: 120 + (n % 3) * 40, y: 70 + (n % 3) * 30, w: Math.min(980, 900), h: 600,
      targetSystemId: id,
    });
    sys.systemWindowId = w.id;
    rt.notify(parent, '已创建子系统', id + '（第 ' + (sys.depth + 1) + ' 层）');
    return sys;
  }

  // ---------------------------------------------------------------- 时间 / 预算
  function advanceTime(sys, parentDt) {
    let eff = 0;
    const running = sys.state === 'running' && !sys.paused;
    if (running) { eff = parentDt * sys.timeScale; sys.virtualTime += eff; }
    sys.effectiveDt = eff;
    for (const cid of sys.children) { const c = rt.state.systems[cid]; if (c) advanceTime(c, eff); }
  }
  function budgetPass(sys, grant) {
    sys.parentGrant = grant; sys.grantThisTick = grant; sys.userConsumedThisTick = 0;
    const childBudget = grant * CHILD_SHARE;
    const workPool = makePool(Math.max(1, grant * KEEP_SHARE));
    sys.workPoolThisTick = workPool.start; sys._pool = workPool;
    const running = sys.state === 'running' && !sys.paused && !isEffectivelyPausedExceptSelf(sys);
    if (running && sys.kernelPid) {
      const kp = sys.procs[sys.kernelPid];
      if (kp && kp.status !== 'done' && kp.status !== 'error') {
        kp.yielded = false;
        stepProcess(kp, sys, workPool, 1e9);
        if (kp.status === 'error') { sys.state = 'error'; sys.kernelError = kp.error; rt.notify(sys, '内核错误', sys.kernelError); }
      }
    }
    const own = sys.workPoolThisTick - workPool.remaining;
    sys.kernelConsumed = Math.max(0, own - sys.userConsumedThisTick);
    sys.userConsumed = sys.userConsumedThisTick;
    sys.consumedThisTick = own;
    let childTotal = 0;
    const kids = sys.children.filter((id) => { const c = rt.state.systems[id]; return c && c.state === 'running'; });
    if (kids.length) {
      const totalCap = kids.reduce((s, id) => s + rt.state.systems[id].grantCap, 0) || 1;
      for (const id of kids) {
        const c = rt.state.systems[id];
        let g = childBudget * c.grantCap / totalCap; g = Math.min(g, c.grantCap, grant);
        childTotal += budgetPass(c, g);
      }
    }
    sys.totalConsumedThisTick = own + childTotal;
    // 承载进程读数：区分子系统内核自身与它内部的工作
    if (sys.parentId) {
      const parent = rt.state.systems[sys.parentId];
      const carrier = parent && parent.procs[sys.carrierPid];
      if (carrier) { carrier.consumed = sys.totalConsumedThisTick; carrier.kernelPart = sys.kernelConsumed; carrier.innerPart = sys.totalConsumedThisTick - sys.kernelConsumed; carrier.work = sys.totalConsumedThisTick; }
    }
    sys._pool = null;
    return sys.totalConsumedThisTick;
  }
  function isEffectivelyPausedExceptSelf(sys) {
    let p = sys.parentId ? rt.state.systems[sys.parentId] : null;
    while (p) { if (p.state !== 'running' || p.paused) return true; p = p.parentId ? rt.state.systems[p.parentId] : null; }
    return false;
  }
  function isEffectivelyPaused(sys) {
    let p = sys;
    while (p) { if (p.state !== 'running' || p.paused) return true; p = p.parentId ? rt.state.systems[p.parentId] : null; }
    return false;
  }
  function isRunning(sys) { return !isEffectivelyPaused(sys); }

  function deliverPendingChartUpdates() {
    for (const sid in rt.state.systems) {
      const s = rt.state.systems[sid];
      if (!isRunning(s)) continue;
      while (s.pendingChartUpdates.length) {
        const item = s.pendingChartUpdates[0];
        if (item.receiverPid && s.procs[item.receiverPid]) {
          injectMessage(s, item.receiverPid, item.data);
          s.pendingChartUpdates.shift();
        } else break;
      }
    }
  }
  function recomputeMemory(sys) {
    let used = 0;
    for (const pid in sys.procs) { const p = sys.procs[pid]; used += 256 + estSize(p.vars) + estSize(p.stack) + p.mailbox.length * 64; }
    for (const w in sys.display) used += estSize(sys.display[w]);
    used += fsStorage(sys.fs);
    sys.memory.used = used; sys.storage.used = fsStorage(sys.fs);
  }

  function tick() {
    const root = rt.root();
    if (!root) return;
    advanceTime(root, BASE_DT * root.timeScale);
    budgetPass(root, root.budget);
    deliverPendingChartUpdates();
    // 把窗口现状作为输入经消息队列交给子系统的窗口管理程序（层叠/焦点由其决定）
    for (const sid in rt.state.systems) {
      const s = rt.state.systems[sid];
      if (s.wmPid && s.procs[s.wmPid] && isRunning(s)) {
        const focus = s.focusWindowId || '';
        const hash = s.windows.map((w) => w.id).join('|') + '/' + focus;
        if (s._wmHash !== hash) { s._wmHash = hash; injectMessage(s, s.wmPid, { kind: 'windows', ids: s.windows.map((w) => w.id), focus }); }
      }
    }
    for (const sid in rt.state.systems) recomputeMemory(rt.state.systems[sid]);
    rt.state.tickCount++;
  }

  // ---------------------------------------------------------------- 通知 / 帮助函数
  rt.notify = function (sys, title, body) {
    sys.notifications.unshift({ id: OS.util.uid('nt'), title, body, at: Date.now(), read: false });
    if (sys.notifications.length > 60) sys.notifications.pop();
  };
  rt.root = function () { return rt.state.systems[rt.state.rootId]; };
  rt.getSystem = function (id) { return rt.state.systems[id]; };
  rt.ancestors = function (sys) { const out = []; let p = sys.parentId ? rt.state.systems[sys.parentId] : null; while (p) { out.push(p); p = p.parentId ? rt.state.systems[p.parentId] : null; } return out; };
  rt.descendants = function (sys) { const out = []; const walk = (s) => { for (const cid of s.children) { const c = rt.state.systems[cid]; if (c) { out.push(c); walk(c); } } }; walk(sys); return out; };

  // ---------------------------------------------------------------- 系统管理
  rt.setPaused = function (id, v) { const s = rt.state.systems[id]; if (s) { s.paused = !!v; if (s.parentId) rt.notify(rt.state.systems[s.parentId], v ? '已暂停子系统' : '已继续子系统', id); } };
  rt.setTimeScale = function (id, v) { const s = rt.state.systems[id]; if (s) s.timeScale = Math.max(0.1, Math.min(8, +v || 1)); };
  rt.singleStep = function (id) {
    const s = rt.state.systems[id]; if (!s) return;
    if (isEffectivelyPausedExceptSelf(s)) return;   // 父系统/祖先暂停时不能发起
    // 单步：推进该子树一个固定逻辑时间步（后代仍遵守各自暂停状态与速率）
    const saved = {};
    // 只推进目标子树：临时把其它系统标记为暂停
    for (const sid in rt.state.systems) { saved[sid] = rt.state.systems[sid].paused; }
    const targetSet = new Set([id, ...rt.descendants(s).map((d) => d.id)]);
    for (const sid in rt.state.systems) if (!targetSet.has(sid)) rt.state.systems[sid].paused = true;
    // root 单独推进：通过 root 的 advanceTime/budgetPass 会自然只推进未暂停者
    const root = rt.root(); advanceTime(root, BASE_DT * root.timeScale); budgetPass(root, root.budget); deliverPendingChartUpdates();
    for (const sid in rt.state.systems) rt.state.systems[sid].paused = saved[sid];
    rt.state.tickCount++;
  };
  rt.stopSystem = function (id) {
    const s = rt.state.systems[id]; if (!s || !s.parentId) return;
    stopSubtree(s);
    rt.notify(rt.state.systems[s.parentId], '已停止子系统', id);
  };
  function stopSubtree(s) {
    s.state = 'stopped';
    for (const pid in s.procs) { s.procs[pid].status = 'done'; s.procs[pid].mailbox = []; }
    // 关闭投送：源在此子树内的投送结束
    for (const sid in rt.state.systems) {
      const t = rt.state.systems[sid];
      t.windows = t.windows.filter((w) => !(w.appId === 'projection' && (w.sourceSystemId === s.id || isDescendantId(s, w.sourceSystemId))));
    }
    for (const cid of s.children) { const c = rt.state.systems[cid]; if (c) stopSubtree(c); }
  }
  function isDescendantId(s, id) { return rt.descendants(s).some((d) => d.id === id); }
  rt.closeSystem = function (id) {
    const s = rt.state.systems[id]; if (!s || !s.parentId) return;
    stopSubtree(s);
    // 移除父系统里的系统窗口与承载进程
    const parent = rt.state.systems[s.parentId];
    parent.windows = parent.windows.filter((w) => w.targetSystemId !== id);
    if (s.carrierPid && parent.procs[s.carrierPid]) parent.procs[s.carrierPid].status = 'done';
    parent.children = parent.children.filter((c) => c !== id);
    // 从状态里移除整棵子树（快照仍保留）
    for (const d of rt.descendants(s)) delete rt.state.systems[d.id];
    delete rt.state.systems[id];
    rt.notify(parent, '已关闭子系统', id + '（其快照仍可重新打开）');
  };
  rt.restartSystem = function (id) {
    const s = rt.state.systems[id]; if (!s || !s.parentId) return;
    const parent = rt.state.systems[s.parentId];
    // 保留系统树结构、文件、窗口布局、快照；重新载入内核源文件并从初始运行状态启动
    const src = rt.fs.read(parent.fs, s.kernelPath) || OS.data.kernelTemplate;
    s.kernelSource = src;
    s.procs = {}; s.nextPid = 1; s.requests = []; s.log = []; s.nextReqId = 0;
    s.kernelError = null; s.state = 'running'; s.paused = false; s.virtualTime = 0;
    s._wmHash = ''; s.compilerActive = null;
    s.flightBus = { sensor: {}, control: { main: { collective: 0.5, cyclic: 0, pedal: 0, t: 0 } }, input: { main: { wind: 0, heading: 0, fault: 0 } } };
    s.display = {};
    const kp = spawn(s, src, 'kernel', null, { isKernel: true, fromFile: false });
    s.kernelPid = kp.pid;
    if (s.state !== 'error') {
      const wm = spawn(s, '/Programs/wm.npl', 'wm', null, { winId: '__wm' });
      s.wmPid = wm.pid;
      const fm = spawn(s, '/Programs/filemgr.npl', 'filemgr', null, { winId: '__files' });
      s.filemgrPid = fm.pid;
    }
    if (s.state === 'error') rt.notify(parent, '内核错误', id + ' 内核编译失败：' + s.kernelError);
    else rt.notify(parent, '已重启子系统', id + ' 按当前内核源文件重新启动');
    // 重新拉起仍打开的应用进程
    for (const w of s.windows) rt.respawnApp(s, w);
  };

  // ---------------------------------------------------------------- 快照 / 恢复 / 分叉
  function snapshotSubtree(sys) {
    const list = [sys, ...rt.descendants(sys)];
    const systems = {};
    const kernelSources = {};
    for (const s of list) {
      systems[s.id] = clone(pickSystem(s));
      kernelSources[s.id] = typeof s.kernelSource === 'string' ? s.kernelSource : null;
    }
    return {
      version: 1, rootId: sys.id, createdAt: Date.now(),
      name: '快照 · ' + sys.id, systems, kernelSources,
      edges: list.map((s) => ({ id: s.id, parentId: s.parentId, children: s.children.slice() })),
      rng: sys.rngState,
    };
  }
  function pickSystem(s) {
    const o = {}; for (const k in s) if (k !== '_pool') o[k] = clone(s[k]); return o;
  }
  rt.snapshot = function (id) {
    const s = rt.state.systems[id]; if (!s) return null;
    const parent = rt.state.systems[s.parentId];
    const snap = snapshotSubtree(s);
    const sid = OS.util.uid('snap');
    rt.state.snapshots[sid] = snap;
    // 快照写入父系统文件（消耗父系统预算/存储）
    if (parent) rt.fs.write(parent.fs, '/Snapshots/' + sid + '.snap', { name: snap.name, snapId: sid, createdAt: snap.createdAt }, 'snapshot');
    rt.notify(parent || s, '已创建快照', snap.name + '（含整棵子树运行状态）');
    return sid;
  };
  function remapSystemIds(snap, newIds, keepIds) {
    const systems = {};
    for (const oid in snap.systems) {
      const nid = keepIds ? oid : newIds[oid];
      const s = clone(snap.systems[oid]);
      s.id = nid;
      s.parentId = s.parentId && (keepIds ? s.parentId : (newIds[s.parentId] || s.parentId));
      s.children = s.children.map((c) => keepIds ? c : (newIds[c] || c));
      // 窗口所属系统、投送来源（仅当来源在本快照内）
      for (const w of s.windows) {
        w.systemId = nid;
        if (w.sourceSystemId && (keepIds ? false : newIds[w.sourceSystemId])) w.sourceSystemId = newIds[w.sourceSystemId];
        if (w.sourceWindowId && !keepIds) w.sourceWindowId = remapWindowId(snap, w.sourceSystemId ? findOrigSystemId(newIds, w.sourceSystemId) : null, w.sourceWindowId, newIds);
      }
      systems[nid] = s;
    }
    return systems;
  }
  function findOrigSystemId(newIds, nid) { for (const o in newIds) if (newIds[o] === nid) return o; return null; }
  function remapWindowId(snap, origSysId, wid, newIds) {
    if (!origSysId || !newIds) return wid;
    // 分叉内窗口 id 前缀替换：同一系统内窗口 id 保持，但系统 id 前缀用新值
    return wid; // 窗口 id 在分叉内保持不变（内部关系指向对应节点）
  }
  rt.restoreSnapshot = function (snapId, targetId) {
    const snap = rt.state.snapshots[snapId]; if (!snap) return false;
    const target = rt.state.systems[targetId] || rt.state.systems[snap.rootId];
    if (!target) return false;
    // 移除目标及其后代当前实例，恢复为保存时状态（保持实例 id）
    const oldDescendants = [target, ...rt.descendants(target)].map((s) => s.id);
    for (const d of oldDescendants) delete rt.state.systems[d];
    const systems = remapSystemIds(snap, {}, true);
    for (const nid in systems) rt.state.systems[nid] = ensureSystemDefaults(systems[nid]);
    // 连接处于「已恢复，待重新连接」
    for (const cid in rt.state.connections) { const c = rt.state.connections[cid]; if (oldDescendants.indexOf(c.systemId) >= 0) c.state = 'restored'; }
    rt.notify(rt.root(), '已恢复快照', snap.name);
    return true;
  };
  rt.forkSnapshot = function (snapId) {
    const snap = rt.state.snapshots[snapId]; if (!snap) return null;
    const newIds = {};
    for (const oid in snap.systems) newIds[oid] = 'inner-' + (++rt.state.nextInnerNum);
    const systems = remapSystemIds(snap, newIds, false);
    // 父系统（快照根的父亲）保持当前值：挂到原来父系统下
    const origRoot = snap.systems[snap.rootId];
    const parent = rt.state.systems[origRoot.parentId] || rt.root();
    const forkRootId = newIds[snap.rootId];
    for (const nid in systems) rt.state.systems[nid] = ensureSystemDefaults(systems[nid]);
    const forkRoot = rt.state.systems[forkRootId];
    forkRoot.parentId = parent.id;
    // 追加到父系统 children（避免重复）
    if (parent.children.indexOf(forkRootId) < 0) parent.children.push(forkRootId);
    // 新的承载进程 + 系统窗口
    const carrier = bookCarrier(parent, forkRootId, '子系统 ' + forkRootId);
    forkRoot.carrierPid = carrier.pid;
    const w = openWindow(parent, { appId: 'system', title: '子系统 · ' + forkRootId, icon: '◱', x: 160, y: 90, w: 900, h: 600, targetSystemId: forkRootId });
    forkRoot.systemWindowId = w.id;
    for (const cid in rt.state.connections) { const c = rt.state.connections[cid]; if (snap.systems[c.systemId]) c.state = 'restored'; }
    rt.notify(parent, '已分叉子树', forkRootId + ' 与原子树互不影响');
    return forkRootId;
  };
  function ensureSystemDefaults(s) {
    s._pool = null; if (!s.flightBus) s.flightBus = { sensor: {}, control: { main: {} }, input: { main: {} } };
    if (!s.pendingChartUpdates) s.pendingChartUpdates = [];
    if (!s.notifications) s.notifications = [];
    return s;
  }
  rt.saveSnapshotLocal = function (snapId) {
    const snap = rt.state.snapshots[snapId]; if (!snap) return;
    return window.host.saveLocal('snapshot-' + snapId + '.json', JSON.stringify(snap));
  };
  rt.importSnapshotLocal = function () {
    return window.host.openFile().then((r) => {
      if (!r.ok) return null;
      try { const snap = JSON.parse(r.content); const sid = OS.util.uid('snap'); rt.state.snapshots[sid] = snap; rt.notify(rt.root(), '已导入快照', snap.name || '本机快照'); return sid; }
      catch (e) { return null; }
    });
  };

  // ---------------------------------------------------------------- 窗口操作
  rt.openWindow = openWindow; rt.findWindow = findWindow; rt.closeWindow = closeWindow;
  rt.focusWindow = function (sys, wid) { const w = findWindow(sys, wid); if (!w) return; w.z = ++rt.state._z; sys.focusWindowId = wid; if (w.state === 'minimized') w.state = 'normal'; };
  rt.setWindowRect = function (sys, wid, r) { const w = findWindow(sys, wid); if (!w) return; Object.assign(w, r); };
  rt.setWindowState = function (sys, wid, st) { const w = findWindow(sys, wid); if (w) { w.state = st; if (st !== 'minimized') rt.focusWindow(sys, wid); } };

  // ---------------------------------------------------------------- 应用进程拉起（供 UI 与重启复用）
  rt.respawnApp = function (sys, w) {
    // 由 ui-inner 注册具体拉起逻辑
    if (OS.rt._respawnHook) OS.rt._respawnHook(sys, w);
  };

  // ---------------------------------------------------------------- 投送
  rt.projectWindow = function (sourceSys, sourceWinId, targetSysId) {
    const srcWin = findWindow(sourceSys, sourceWinId); if (!srcWin) return null;
    // 每个源窗口至多一个投送窗口
    for (const sid in rt.state.systems) {
      const t = rt.state.systems[sid];
      const ex = t.windows.find((w) => w.appId === 'projection' && w.sourceSystemId === sourceSys.id && w.sourceWindowId === sourceWinId);
      if (ex) { rt.focusWindow(t, ex.id); if (ex.state === 'minimized') ex.state = 'normal'; return ex; }
    }
    const target = rt.state.systems[targetSysId]; if (!target) return null;
    const w = openWindow(target, {
      appId: 'projection', title: '投送 · ' + srcWin.title + ' ← ' + sourceSys.id,
      icon: srcWin.appId === 'player' ? '▶' : '▤', x: 220, y: 130, w: 720, h: 500,
      sourceSystemId: sourceSys.id, sourceWindowId: sourceWinId, sourceAppId: srcWin.appId,
    });
    rt.notify(target, '已创建投送', '来源 ' + sourceSys.id + ' / ' + srcWin.title);
    return w;
  };
  rt.unproject = function (targetSys, projWinId) { closeWindow(targetSys, projWinId); };

  // ---------------------------------------------------------------- 跨层文件传递
  rt.transferFile = function (srcSys, srcPath, dstSys, dstDir) {
    const node = rt.fs.get(srcSys.fs, srcPath); if (!node || node.type !== 'file') return { ok: false, error: '源文件不存在' };
    let name = rt.fs.base(srcPath);
    let dst = rt.fs.norm(dstDir + '/' + name);
    if (rt.fs.exists(dstSys.fs, dst)) {
      // 重名：由 UI 询问覆盖/取消，这里默认给出可覆盖标记
      return { ok: false, overwrite: true, dst, name };
    }
    return doTransfer(srcSys, srcPath, dstSys, dst, node);
  };
  rt.transferFileOverwrite = function (srcSys, srcPath, dstSys, dst) {
    const node = rt.fs.get(srcSys.fs, srcPath); if (!node) return { ok: false, error: '源文件不存在' };
    return doTransfer(srcSys, srcPath, dstSys, dst, node);
  };
  function doTransfer(srcSys, srcPath, dstSys, dst, node) {
    const content = clone(node.content);
    if (fsStorage(dstSys.fs) + estSize(content) > dstSys.storage.limit) return { ok: false, error: '目标存储配额不足' };
    rt.fs.write(dstSys.fs, dst, content, node.mime);
    rt.notify(dstSys, '已接收文件', rt.fs.base(dst) + '（来自 ' + srcSys.id + '，独立副本）');
    return { ok: true, dst };
  }

  // ---------------------------------------------------------------- 电子表格计算与发布
  function cellAddr(c, r) { return OS.util.colAddr(c) + (r + 1); }
  rt.computeWorkbook = function (wb) {
    const cells = wb.cells || {};
    const cache = {}; const visiting = {}; const errors = {};
    function val(addr) {
      if (cache[addr] !== undefined) return cache[addr];
      if (visiting[addr]) { errors[addr] = '循环依赖'; return 0; }
      visiting[addr] = true;
      const raw = cells[addr];
      let out;
      if (raw == null || raw === '') out = '';
      else if (typeof raw === 'string' && raw[0] === '=') out = evalFormula(raw.slice(1), addr);
      else out = raw;
      visiting[addr] = false; cache[addr] = out; return out;
    }
    function evalFormula(expr, addr) {
      try {
        const replaced = expr.replace(/\bSUM\s*\(/gi, '__SUM(').replace(/([A-Z]+\d+):([A-Z]+\d+)/gi, (m) => '"' + m.toUpperCase() + '"');
        // 把单元格引用换成 val()
        const tokenized = replaced.replace(/(^|[^"\w.])([A-Z]+\d+)(?![\w"(])/gi, (m, pre, ref) => pre + 'val("' + ref.toUpperCase() + '")');
        const fn = new Function('val', '__SUM', 'return (' + tokenized + ')');
        const sum = (rng) => {
          const rc = OS.util.rangeCells(rng); if (!rc) return 0;
          let s = 0; for (let r = rc.r1; r <= rc.r2; r++) for (let c = rc.c1; c <= rc.c2; c++) { const v = +val(cellAddr(c, r)) || 0; s += isNaN(v) ? 0 : v; } return s;
        };
        const r = fn(val, sum);
        if (r && typeof r === 'object') return r; // 区域引用返回对象（异常）
        if (typeof r === 'number' && !isFinite(r)) { errors[addr] = '除零或无效计算'; return '#DIV/0!'; }
        return r;
      } catch (e) { errors[addr] = '无效引用/公式'; return '#REF!'; }
    }
    const computed = {};
    for (const a in cells) computed[a] = val(a);
    // 针对除零结果给出反馈
    for (const a in computed) if (computed[a] === Infinity || computed[a] === -Infinity) { computed[a] = '#DIV/0!'; errors[a] = '除零'; }
    return { computed, errors };
  };
  rt.getWorkbook = function (sys, path) { const c = rt.fs.read(sys.fs, path); return (c && c.format === 'npl-sheet-1') ? c : null; };
  rt.commitWorkbook = function (sys, path, wb) {
    rt.fs.write(sys.fs, path, wb, 'sheet');
    rt.publishWorkbook(sys, path, wb);
  };
  rt.publishWorkbook = function (sys, path, wb) {
    for (const cid in rt.state.connections) {
      const c = rt.state.connections[cid];
      if (c.sourceSystem !== sys.id || c.workbook !== path) continue;
      if (c.state !== 'connected' && c.state !== 'restored') continue;
      const rc = OS.util.rangeCells(c.range); if (!rc) continue;
      const calc = rt.computeWorkbook(wb);
      const values = [];
      for (let r = rc.r1; r <= rc.r2; r++) { const row = []; for (let cc = rc.c1; cc <= rc.c2; cc++) { row.push(calc.computed[cellAddr(cc, r)] === undefined ? '' : String(calc.computed[cellAddr(cc, r)])); } values.push(row); }
      c.version = (c.version || 0) + 1; c.lastData = values;
      const data = { version: c.version, values, range: c.range, labelCol: c.labelCol, seriesCols: c.seriesCols, chartType: c.chartType, title: c.title || (wb.name + ' ' + c.range) };
      const target = rt.state.systems[c.systemId];
      if (target) target.pendingChartUpdates.push({ receiverPid: c.receiverPid, data });
    }
  };

  // ---------------------------------------------------------------- 图表连接
  rt.connectChart = function (cfg) {
    const cid = OS.util.uid('conn');
    rt.state.connections[cid] = Object.assign({ version: 0, state: 'connected', lastData: null }, cfg);
    return cid;
  };
  rt.disconnectChart = function (cid) { const c = rt.state.connections[cid]; if (c) { c.state = 'disconnected'; rt.notify(rt.state.systems[c.systemId] || rt.root(), '已断开连接', c.title || '图表连接'); } };
  rt.removeChartConnection = function (cid) { delete rt.state.connections[cid]; };
  rt.getConnections = function () { return rt.state.connections; };

  // ---------------------------------------------------------------- 用户程序/编辑器接口
  rt.spawn = spawn; rt.preprocess = preprocess; rt.selfCompile = selfCompile;
  rt.injectMessage = injectMessage; rt.stepProcess = stepProcess;
  rt.createProcess = spawn; rt.bookCarrier = bookCarrier;
  rt.isRunning = isRunning; rt.isEffectivelyPaused = isEffectivelyPaused;
  rt.compileAndRun = function (sys, source, name, param, opts) { return spawn(sys, source, name, param, opts || {}); };

  // ---------------------------------------------------------------- 初始化
  rt.tick = tick; rt.createSystem = createSystem; rt.snapshotSubtree = snapshotSubtree;
  rt.advanceTime = advanceTime; rt.budgetPass = budgetPass;
  rt.init = function (dataDir) {
    rt.state = {
      rootId: 'outer', systems: {}, nextInnerNum: 0, _z: 10, tickCount: 0,
      snapshots: {}, connections: {}, dataDir: dataDir || '', paused: false,
    };
    const root = newSystemObject('outer', 'outer', null, 0);
    root.desktop.title = '根系统桌面';
    root.budget = 9000; root.grantCap = 7000;
    initialFiles(root, true);
    // 根系统内核由宿主提供（同样是程序文件）
    root.kernelSource = OS.data.kernelTemplate;
    const kp = spawn(root, OS.data.kernelTemplate, 'kernel', null, { isKernel: true, fromFile: false });
    root.kernelPid = kp.pid;
    rt.state.systems['outer'] = root;
    return root;
  };
  rt.reset = function () { rt.init(rt.state ? rt.state.dataDir : ''); };

  OS.rt = rt;
})(window.OS = window.OS || {});
