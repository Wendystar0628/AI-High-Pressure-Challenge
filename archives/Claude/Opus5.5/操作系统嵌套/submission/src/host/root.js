// 根系统（由宿主直接实现）。
// 它提供与子系统内核相同的系统调用（供根系统里的自定义程序使用），
// 并作为直属子系统的“父系统”：执行子系统内核的承载进程、按步拨付预算与时间、
// 处理 k- 开头的父系统接口（磁盘、显示设备、信封路由……）。
import { Prog, Ctx, run, deepCopy, sizeOf, hashStr, measure, serialize, deserialize, remapStrings, remapValue, toStr, toJSON } from '../vm/vm.js';
import { fmtB } from './rootfs.js';

export const STEP_DT = 1 / 60;
const QUANTUM = 4000;
const BLOCK = Symbol('block');

export class RootSystem {
  constructor({ fs, device, image }) {
    this.fs = fs; this.device = device; this.innerImage = image;
    this.id = 'outer';
    this.name = '根系统';
    this.clock = 0; this.stepNo = 0; this.rate = 1;
    this.conf = { budget: 120000, mem: 3 * 1024 * 1024 * 1024, storage: 1536 * 1024 * 1024, childCap: 96000, procQuota: 40000 };
    this.procs = new Map(); this.porder = []; this.nextPid = 1; this.rr = 0;
    this.children = new Map(); this.childOrder = [];
    this.bus = new Map(); this.endpoints = new Map();
    this.binIndex = {}; this.compilerHash = '';
    this.svcPending = 0; this.svcLast = 0;
    this.stepInfo = { budget: 0, svc: 0, procs: 0, used: 0 };
    this.listeners = {};
    this.wins = new Map();
    this.nextWin = 1;
    this.snapSeq = 0;
    this.subs = new Map();     // 数据订阅
    this.pendingPulls = new Map();
    this.tree = [];
    this.nextInner = 1;
    this.running = false;
    this.desktop = null;       // 由桌面设置
    this.dataSources = null;   // 由电子表格模块设置
    this.fs.chargeHook = (n) => { this.svcPending += n; };
  }

  on(ev, cb) { (this.listeners[ev] ||= new Set()).add(cb); return () => this.listeners[ev].delete(cb); }
  emit(ev, data) { for (const cb of this.listeners[ev] || []) { try { cb(data); } catch (e) { console.error(e); } } }
  charge(n, who) { this.svcPending += Math.max(0, Math.ceil(n)); if (who) who.units = (who.units || 0) + Math.ceil(n); }

  // ---------- 启动 ----------
  boot() {
    this.loadBinIndex();
    const st = this.fs.read('/System/state.json');
    if (st) { try { const s = JSON.parse(st); this.nextInner = s.nextInner || 1; Object.assign(this.conf, s.conf || {}); } catch {} }
    this.rebuildTree();
  }
  saveState() { this.fs.write('/System/state.json', JSON.stringify({ nextInner: this.nextInner, conf: this.conf })); }
  loadBinIndex() {
    const s = this.fs.read('/System/bin/index.json');
    try { this.binIndex = s ? JSON.parse(s) : {}; } catch { this.binIndex = {}; }
    const c = this.fs.read('/System/bin/compiler.nx');
    this.compilerHash = c ? hashStr(c) : '';
  }
  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    let acc = 0;
    const loop = () => {
      if (!this.running) return;
      const now = performance.now();
      acc += Math.min(200, now - last); last = now;
      let n = 0;
      while (acc >= 1000 / 60 && n < 3) { acc -= 1000 / 60; n++; try { this.step(); } catch (e) { console.error('root step', e); } }
      if (n === 3) acc = 0;
      this.timer = setTimeout(loop, Math.max(1, 1000 / 60 - acc - 0.5));
    };
    this.timer = setTimeout(loop, 16);
  }
  stop() { this.running = false; clearTimeout(this.timer); }

  // ---------- 进程 ----------
  makeProc(name, path, kind, parent) {
    const pid = this.nextPid++;
    const p = { pid, name, path, kind, ctx: null, state: 'loading', wait: null, queue: [], parent, quota: this.conf.procQuota,
      used: 0, last: 0, out: [], error: null, progress: null, wins: [], child: null, svc: 0, started: this.clock, ended: null, demand: false, units: 0, onDone: null };
    this.procs.set(pid, p); this.porder.push(pid);
    this.emit('procs');
    return p;
  }
  registerApp(name, appId, ops) {
    const p = this.makeProc(name, null, 'app', null);
    p.state = 'running'; p.appId = appId; p.ops = ops || {};
    return p;
  }
  plog(p, text) { p.out.push(`[${this.clock.toFixed(2)}] ${text}`); if (p.out.length > 80) p.out.shift(); this.emit('proc-out', p); }

  cachedExe(path, src) {
    const h = hashStr(src);
    let r = this.binIndex[path];
    if (!r || r.src !== h) r = Object.values(this.binIndex).find((x) => x.src === h && x.compiler === this.compilerHash) || null;
    if (!r || r.src !== h || r.compiler !== this.compilerHash) return null;
    for (const d of r.deps || []) { const s = this.fs.read(d[0]); if (s == null || hashStr(s) !== d[1]) return null; }
    return this.fs.read(r.exe);
  }
  storeExe(path, src, text, deps) {
    const out = '/System/bin/' + path.slice(1).split('/').join('_') + '.nx';
    this.fs.write(out, text);
    this.binIndex[path] = { src: hashStr(src), compiler: this.compilerHash, deps: deps || [], exe: out };
    this.fs.write('/System/bin/index.json', JSON.stringify(this.binIndex));
  }
  compileAsync(path, src, k) {
    const cexe = this.fs.read('/System/bin/compiler.nx');
    if (!cexe) return k({ error: '找不到编译器 /System/bin/compiler.nx' });
    const cp = this.makeProc('编译 ' + path.split('/').pop(), '/System/compiler.nest', 'service', null);
    try { cp.ctx = new Ctx(new Prog(JSON.parse(cexe)), { args: { src, name: path.split('/').pop().replace(/\.nest$/, ''), path }, mem: 256e6 }); }
    catch (e) { cp.state = 'error'; cp.error = String(e.message || e); return k({ error: cp.error }); }
    this.charge(cexe.length / 48, cp);
    cp.state = 'ready';
    cp.onDone = (res) => {
      if (res && typeof res === 'object' && !res.error && res.format === 'nest-exe') {
        const text = JSON.stringify(res);
        this.storeExe(path, src, text, res.deps);
        k(text);
      } else k(res && typeof res === 'object' ? res : { error: toStr(res) });
    };
    return cp;
  }
  spawn(path, args, kind = 'user', parent = null) {
    path = this.fs.norm(path);
    const src = this.fs.read(path);
    if (src == null) throw new Error('程序不存在: ' + path);
    const p = this.makeProc(path.split('/').pop().replace(/\.nest$/, ''), path, kind, parent);
    const start = (exe) => {
      if (exe && typeof exe === 'object' && exe.error) {
        p.state = 'error'; p.error = `编译错误：${exe.error}（第 ${exe.line} 行）`; p.ended = this.clock; this.plog(p, p.error); this.emit('procs');
        this.emit('notify', { title: '编译失败：' + p.name, body: p.error, level: 'error' });
        return;
      }
      try { p.ctx = new Ctx(new Prog(JSON.parse(exe)), { args: args === undefined ? null : deepCopy(args), mem: this.conf.mem / 8, seed: 7 + 31 * p.pid }); }
      catch (e) { p.state = 'error'; p.error = String(e.message || e); return; }
      this.charge(exe.length / 48, p);
      if (p.state === 'loading') p.state = 'ready';
      this.emit('procs');
    };
    const hit = this.cachedExe(path, src);
    if (hit) start(hit); else this.compileAsync(path, src, start);
    return p;
  }
  killProc(p, why = 'killed') {
    if (!p || p.state === 'done' || p.state === 'error') return;
    p.state = why === 'error' ? 'error' : 'done';
    p.ended = this.clock;
    if (p.ctx) { p.ctx.state = 'dead'; p.ctx.frames.length = 0; p.ctx.stack.length = 0; }
    p.wait = null; p.queue = [];
    for (const wid of [...p.wins]) this.closeWindow(wid);
    for (const q of this.procs.values()) if (q.parent === p.pid) this.killProc(q, 'parent');
    for (const [k, pid] of this.endpoints) if (pid === p.pid) this.endpoints.delete(k);
    if (p.kind === 'app' && p.ops && p.ops.kill && why !== 'app-closed') p.ops.kill();
    if (p.child) this.childStopped(p.child, '承载进程已结束');
    this.emit('procs');
  }
  finish(p, val) { const k = p.onDone; p.result = val; this.killProc(p, 'done'); if (k) k(val); }

  // ---------- 调度 ----------
  runnable(p) {
    if (p.state !== 'ready' || !p.ctx || p.used >= p.quota) return false;
    if (p.child) { const c = this.children.get(p.child); return !!c && (c.state === 'running' || c.state === 'booting' || c.stepping > 0); }
    return true;
  }
  pickNext() {
    const n = this.porder.length;
    for (let i = 0; i < n; i++) {
      const p = this.procs.get(this.porder[(this.rr + i) % n]);
      if (p && this.runnable(p)) { this.rr = (this.rr + i + 1) % n; return p; }
    }
    return null;
  }
  step() {
    const dt = STEP_DT * this.rate;
    this.clock += dt; this.stepNo++;
    for (const pid of this.porder) {
      const p = this.procs.get(pid);
      if (!p) continue;
      p.last = p.used; p.used = 0;
      if (p.state === 'waiting' && p.wait) {
        if (p.wait.k === 'sleep' && p.wait.until <= this.clock) { p.wait = null; p.state = 'ready'; this.resume(p, this.clock); }
        else if (p.wait.k === 'recv' && p.wait.until != null && p.wait.until <= this.clock) { p.wait = null; p.state = 'ready'; this.resume(p, null); }
      }
    }
    this.deliverTicks(dt);
    let budget = this.conf.budget;
    const svc = Math.min(this.svcPending, budget * 0.5);
    this.svcPending = Math.max(0, this.svcPending - svc);
    if (this.svcPending > budget * 20) this.svcPending = budget * 20;
    budget -= svc;
    let spent = 0;
    for (let guard = 0; guard < 5000; guard++) {
      const left = budget - spent;
      if (left < 50) break;
      const p = this.pickNext();
      if (!p) break;
      const q = Math.min(p.child ? QUANTUM * 4 : QUANTUM, p.quota - p.used, left);
      const used = run(p.ctx, q);
      p.used += used; spent += used;
      this.afterRun(p);
    }
    for (const pid of this.porder) { const p = this.procs.get(pid); if (p) p.demand = p.state === 'ready' && !!p.ctx && this.runnable({ ...p, used: 0 }); }
    this.stepInfo = { budget: this.conf.budget, svc, procs: spent, used: svc + spent };
    this.accountChildren();
    if (this.stepNo % 30 === 0) this.emit('tick');
    if (this.stepNo % 600 === 0) this.reap();
  }
  reap() {
    this.porder = this.porder.filter((pid) => {
      const p = this.procs.get(pid);
      if (p && (p.state === 'done' || p.state === 'error') && this.clock - (p.ended || 0) > 60 && p.kind !== 'app') { this.procs.delete(pid); return false; }
      return !!p;
    });
  }
  afterRun(p) {
    const c = p.ctx;
    switch (c.state) {
      case 'trap': this.dispatch(p, c.trap); break;
      case 'done': this.finish(p, c.result); break;
      case 'error':
        p.error = c.error; p.ended = this.clock; this.plog(p, '错误: ' + c.error);
        if (p.child) this.childCrashed(p, c.error);
        else { const k = p.onDone; this.killProc(p, 'error'); if (k) k({ error: c.error, line: 0 }); this.emit('notify', { title: '程序异常：' + p.name, body: c.error, level: 'error' }); }
        break;
      default: break;
    }
  }
  resume(p, v) { const c = p.ctx; if (c && c.state === 'trap') { c.stack.push(v === undefined ? null : v); c.state = 'ready'; c.trap = null; } }
  throwInto(p, msg) { const c = p.ctx; if (c && c.state === 'trap') { c.pendingThrow = msg; c.state = 'ready'; c.trap = null; } }
  dispatch(p, trap) {
    const name = trap[0];
    const h = SYS[name];
    if (!h) { this.throwInto(p, '未知的系统调用: ' + name); return; }
    let r;
    try { r = h.call(this, p, trap); }
    catch (e) { this.throwInto(p, String(e && e.message ? e.message : e)); return; }
    if (r === BLOCK) return;
    this.resume(p, r);
  }

  // ---------- 消息 ----------
  deliver(from, to, msg) {
    const q = this.procs.get(to);
    if (!q || q.state === 'done' || q.state === 'error' || !q.ctx) return 'no-such-process';
    q.queue.push({ from, msg: deepCopy(msg) });
    this.charge(sizeOf(msg) / 32);
    this.wakeReceiver(q);
    return 'ok';
  }
  wakeReceiver(q) {
    if (q.state === 'waiting' && q.wait && q.wait.k === 'recv' && q.queue.length && q.ctx) {
      const m = q.queue.shift(); q.wait = null; q.state = 'ready'; this.resume(q, m.msg);
    }
  }

  // ---------- 窗口（根系统中自定义程序的窗口） ----------
  closeWindow(wid) {
    const w = this.wins.get(wid);
    if (!w) return;
    this.wins.delete(wid);
    const p = this.procs.get(w.pid); if (p) p.wins = p.wins.filter((x) => x !== wid);
    this.device.submit(wid, null, null);
    if (this.desktop) this.desktop.closeProgramWindow(wid);
  }

  // ---------- 直属子系统 ----------
  allocId() { const id = `inner-${this.nextInner++}`; this.saveState(); return id; }
  newChildRecord(id, name) {
    return { id, name, state: 'booting', rate: 1, host: null, inbox: [], acc: 0, stepping: 0,
      cap: this.conf.childCap, budget: this.conf.childCap, mem: 1024 * 1024 * 1024, storage: 768 * 1024 * 1024,
      error: null, kernel: `/System/Kernels/${id}.nest`, subtree: [], own: 0, inner: 0, ownTotal: 0, innerTotal: 0, restarts: 0, size: [1000, 620] };
  }
  saveChildren() {
    this.fs.write('/System/children.json', JSON.stringify(this.childOrder.map((id) => { const c = this.children.get(id); return { id: c.id, name: c.name, rate: c.rate, cap: c.cap, budget: c.budget, mem: c.mem, storage: c.storage }; })));
  }
  createChild(name, size) {
    const id = this.allocId();
    const c = this.newChildRecord(id, name || `子系统 ${id}`);
    if (size) c.size = size;
    this.fs.copy('/System/kernel.nest', c.kernel);
    this.children.set(id, c); this.childOrder.push(id);
    this.saveChildren();
    this.startChildKernel(c);
    this.rebuildTree();
    if (this.desktop) this.desktop.openSystemWindow(id);
    return id;
  }
  startChildKernel(c) {
    let src = this.fs.read(c.kernel);
    if (src == null) { this.fs.copy('/System/kernel.nest', c.kernel); src = this.fs.read(c.kernel); }
    c.state = 'booting'; c.error = null;
    const hp = this.makeProc('承载 ' + c.id, c.kernel, 'host', null);
    hp.child = c.id; hp.quota = Math.min(c.cap, c.budget);
    c.host = hp.pid;
    const go = (exe) => {
      if (exe && typeof exe === 'object' && exe.error) {
        hp.state = 'error'; hp.error = `内核编译错误：${exe.error}（第 ${exe.line} 行）`;
        this.childCrashed(hp, hp.error);
        return;
      }
      try { hp.ctx = new Ctx(new Prog(JSON.parse(exe)), { mem: c.mem, seed: 99 + hp.pid }); hp.state = 'ready'; }
      catch (e) { this.childCrashed(hp, '内核载入失败：' + e.message); }
      this.emit('procs');
    };
    const hit = this.cachedExe(c.kernel, src);
    if (hit) go(hit); else this.compileAsync(c.kernel, src, go);
    this.emitChild(c);
    return hp;
  }
  emitChild(c) { this.rebuildTree(); this.emit('child-state', c); }
  childStopped(id, why) {
    const c = this.children.get(id);
    if (!c) return;
    c.state = 'stopped'; c.error = why;
    this.dropSubtree(id);
    this.emitChild(c);
  }
  childCrashed(hp, msg) {
    const c = this.children.get(hp.child);
    if (hp.ctx) hp.ctx.state = 'dead';
    hp.state = 'error'; hp.error = msg; hp.ended = this.clock;
    if (c) { c.state = 'kernel-error'; c.error = msg; this.dropSubtree(c.id); this.emitChild(c); }
    this.emit('notify', { title: `${hp.child} 内核错误`, body: msg, level: 'error' });
  }
  hostOf(c) { return c ? this.procs.get(c.host) : null; }
  childControl(action, id, a) {
    const c = this.children.get(id);
    if (!c) throw new Error('没有直属子系统 ' + id);
    const hp = this.hostOf(c);
    switch (action) {
      case 'pause': if (c.state === 'running' || c.state === 'booting') c.state = 'paused'; break;
      case 'resume': if (c.state === 'paused') c.state = 'running'; break;
      case 'step': if (c.state !== 'paused') throw new Error('只能单步已暂停的子系统'); c.stepping = 1; break;
      case 'rate': c.rate = Math.min(16, Math.max(0.05, Number(a) || 1)); this.saveChildren(); break;
      case 'grant': c.cap = Math.max(0, Math.floor(a)); if (hp) hp.quota = Math.min(c.cap, c.budget); this.saveChildren(); break;
      case 'config':
        for (const k of ['budget', 'mem', 'storage', 'cap']) if (typeof a[k] === 'number') c[k] = Math.max(0, Math.floor(a[k]));
        if (hp) { hp.quota = Math.min(c.cap, c.budget); if (hp.ctx) hp.ctx.memLimit = c.mem; }
        c.inbox.push({ type: 'conf', conf: { budget: c.budget, mem: c.mem, storage: c.storage } });
        this.saveChildren(); break;
      case 'stop': if (hp) { hp.child = null; this.killProc(hp, 'killed'); } this.childStopped(id, '已停止'); break;
      case 'restart':
        if (hp) { hp.child = null; this.killProc(hp, 'killed'); }
        this.dropSubtree(id);
        c.inbox = []; c.acc = 0; c.stepping = 0; c.restarts++;
        this.startChildKernel(c);
        break;
      case 'close':
        if (hp) { hp.child = null; this.killProc(hp, 'killed'); }
        this.dropSubtree(id);
        this.children.delete(id); this.childOrder = this.childOrder.filter((x) => x !== id);
        this.saveChildren();
        if (this.desktop) this.desktop.closeSystemWindow(id);
        break;
      case 'snapshot': return this.snapshotChild(c);
      case 'rename': c.name = String(a); this.saveChildren(); break;
      default: throw new Error('未知的子系统操作: ' + action);
    }
    this.emitChild(c);
    return true;
  }
  childInput(id, ev) {
    const c = this.children.get(id);
    if (!c) return;
    c.inbox.push({ type: 'input', ev });
    if (c.inbox.length > 4000) c.inbox.shift();
  }
  childResize(id, w, h) {
    const c = this.children.get(id);
    if (!c) return;
    if (c.size[0] === w && c.size[1] === h) return;
    c.size = [w, h];
    c.inbox.push({ type: 'resize', w, h });
  }
  deliverTicks(dt) {
    for (const id of this.childOrder) {
      const c = this.children.get(id);
      const hp = this.hostOf(c);
      if (!c || !hp) continue;
      hp.quota = Math.min(c.cap, c.budget);
      if (c.state === 'running') c.acc += dt * c.rate;
      const waiting = hp.state === 'waiting' && hp.wait && hp.wait.k === 'tick';
      if (waiting && (c.state === 'running' || (c.state === 'paused' && c.stepping === 1))) {
        if (c.state === 'paused') { c.acc = STEP_DT * c.rate; c.stepping = 2; }
        const evs = c.inbox; c.inbox = [];
        hp.wait = null; hp.state = 'ready';
        this.resume(hp, { dt: c.acc, budget: Math.min(c.cap, c.budget), events: evs, step: this.stepNo });
        c.acc = 0;
      }
    }
  }
  accountChildren() {
    for (const id of this.childOrder) {
      const c = this.children.get(id);
      const hp = this.hostOf(c);
      if (!c || !hp || !hp.ctx) continue;
      const x = hp.ctx;
      c.own = x.own - c.ownTotal; c.inner = x.inner - c.innerTotal;
      c.ownTotal = x.own; c.innerTotal = x.inner;
      if (this.stepNo % 60 === 0) {
        measure(x);
        if (x.memTotal > c.mem) this.childCrashed(hp, `内存配额耗尽：${fmtB(x.memTotal)} > ${fmtB(c.mem)}`);
      }
    }
  }
  dropSubtree(id) {
    const ids = new Set([id]);
    for (const s of this.tree) if (s.id !== id && this.isUnder(s.id, id)) ids.add(s.id);
    this.device.dropSystems(ids);
    for (const [k, s] of this.subs) if (s.path.some((x) => ids.has(x))) this.subs.delete(k);
    if (this.desktop) this.desktop.sourcesGone(ids, '源系统已停止');
    const c = this.children.get(id);
    if (c && id === c.id) c.subtree = [];
    this.rebuildTree();
  }
  isUnder(sid, ancestor) {
    let cur = this.tree.find((s) => s.id === sid);
    for (let g = 0; cur && g < 64; g++) { if (cur.parentId === ancestor) return true; cur = this.tree.find((s) => s.id === cur.parentId); }
    return false;
  }
  pathOf(sid) {
    const path = [];
    let cur = this.tree.find((s) => s.id === sid);
    for (let g = 0; cur && g < 64; g++) { path.unshift(cur.id); if (cur.parentId == null) break; cur = this.tree.find((s) => s.id === cur.parentId); }
    return path;
  }
  rebuildTree() {
    const list = [{ id: 'outer', parentId: null, name: this.name, state: 'running', depth: 1 }];
    for (const id of this.childOrder) {
      const c = this.children.get(id);
      list.push({ id: c.id, parentId: 'outer', name: c.name, state: c.state, rate: c.rate, error: c.error });
      for (const s of c.subtree || []) {
        let st = s.state;
        if ((c.state !== 'running' && c.state !== 'booting') && (st === 'running' || st === 'booting')) st = 'held';
        list.push({ ...s, state: st });
      }
    }
    this.tree = list;
    this.emit('tree', list);
  }
  // 源系统或其任一祖先暂停（用于投送外框提示）
  chainPaused(sid) {
    const path = this.pathOf(sid);
    for (const id of path) {
      if (id === 'outer') continue;
      const s = this.tree.find((x) => x.id === id);
      if (s && s.state !== 'running' && s.state !== 'booting') return { id, state: s.state };
    }
    return null;
  }

  // ---------- 快照 ----------
  snapshotChild(c) {
    const hp = this.hostOf(c);
    if (!hp || !hp.ctx) throw new Error('子系统没有运行，无法快照');
    this.snapSeq++;
    const prefix = `/System/Disks/${c.id}`;
    const disk = [];
    for (const [q, e] of this.fs.files) if (q.startsWith(prefix + '/')) disk.push([q.slice(prefix.length), e.type, e.type === 'file' ? e.data : null]);
    const snap = { format: 'nest-snapshot', v: 1, id: c.id, name: c.name, time: this.clock, parent: 'outer',
      state: c.state, rate: c.rate, cap: c.cap, budget: c.budget, mem: c.mem, storage: c.storage,
      subtree: c.subtree, 'kernel-src': this.fs.read(c.kernel),
      host: serialize(hp.ctx), hostWait: hp.wait ? hp.wait.k : null, hostState: hp.state,
      inbox: c.inbox, acc: c.acc, disk, display: this.device.capture(this.subtreeIds(c.id)) };
    const text = JSON.stringify(snap);
    this.charge(text.length / 32);
    const path = `/Snapshots/${c.id}-${String(this.snapSeq).padStart(3, '0')}.snap`;
    this.fs.write(path, text);
    this.emit('notify', { title: '快照已保存', body: `${c.id} → ${path}（${fmtB(text.length)}）`, level: 'ok' });
    return path;
  }
  subtreeIds(id) { const ids = [id]; for (const s of this.tree) if (this.isUnder(s.id, id)) ids.push(s.id); return ids; }
  snapshotLoad(mode, path, target) {
    const s = this.fs.read(path);
    if (s == null) throw new Error('快照不存在: ' + path);
    const snap = JSON.parse(s);
    if (snap.format !== 'nest-snapshot') throw new Error('不是快照文件');
    this.charge(s.length / 32);
    const ids = [snap.id, ...(snap.subtree || []).map((x) => x.id)];
    let c; const map = {};
    const oldProjections = this.desktop ? this.desktop.projectionsFrom(new Set(ids)) : [];
    if (mode === 'restore') {
      c = this.children.get(target || snap.id);
      if (!c) throw new Error(`原实例不存在，请用“分叉”打开: ${snap.id}`);
      if (c.id !== snap.id) throw new Error('快照属于其他实例');
      const hp0 = this.hostOf(c);
      if (hp0) { hp0.child = null; this.killProc(hp0, 'killed'); }
      this.device.dropSystems(new Set(this.subtreeIds(c.id)));
      for (const [k, sb] of this.subs) if (sb.path.some((x) => ids.includes(x))) this.subs.delete(k);
    } else {
      for (const old of ids) map[old] = this.allocId();
      c = this.newChildRecord(map[snap.id], snap.name + ' 分叉');
      this.children.set(c.id, c); this.childOrder.push(c.id);
    }
    const dpre = `/System/Disks/${c.id}`;
    if (this.fs.exists(dpre)) this.fs.delete(dpre);
    for (const e of snap.disk) {
      const dp = mode === 'fork' ? remapValue(e[0], map) : e[0];
      if (e[1] === 'dir') this.fs.mkdir(dpre + dp); else this.fs.write(dpre + dp, e[2]);
    }
    this.fs.write(c.kernel, snap['kernel-src'] || this.fs.read('/System/kernel.nest'));
    const hctx = deserialize(snap.host);
    if (mode === 'fork') remapStrings(hctx, map);
    for (const k of ['rate', 'cap', 'budget', 'mem', 'storage']) c[k] = snap[k];
    c.subtree = mode === 'fork' ? remapValue(snap.subtree, map) : snap.subtree;
    c.state = snap.state === 'paused' ? 'paused' : 'running';
    c.acc = snap.acc || 0; c.stepping = 0; c.error = null;
    c.inbox = mode === 'fork' ? remapValue(snap.inbox, map) : snap.inbox;
    c.inbox.push({ type: 'restored', mode });
    c.ownTotal = hctx.own; c.innerTotal = hctx.inner;
    const hp = this.makeProc('承载 ' + c.id, c.kernel, 'host', null);
    hp.child = c.id; hp.quota = Math.min(c.cap, c.budget); hp.ctx = hctx;
    c.host = hp.pid;
    if (snap.hostWait === 'tick') { hp.state = 'waiting'; hp.wait = { k: 'tick' }; } else hp.state = 'ready';
    this.device.restore(mode === 'fork' ? remapValue(snap.display, map) : snap.display);
    this.saveChildren();
    this.rebuildTree();
    if (this.desktop) {
      if (mode === 'fork') this.desktop.openSystemWindow(c.id);
      else {
        this.desktop.refreshSystemWindow(c.id);
        // 范围外的投送外框保持位置，并继续对应同一源窗口
        for (const pr of oldProjections) c.inbox.push({ type: 'env', env: { to: pr.srcPath, from: ['outer'], kind: 'proj-opened', data: { 'src-win': pr.srcWin, proj: pr.wid, w: pr.w, h: pr.h, reattach: true } } });
      }
    }
    this.emitChild(c);
    this.emit('notify', { title: mode === 'fork' ? '已从快照分叉' : '已恢复快照', body: `${snap.id} → ${c.id}`, level: 'ok' });
    return c.id;
  }

  // ---------- 信封路由 ----------
  route(env) {
    if (!env.from) env.from = ['outer'];
    const to = env.to || [];
    if (to.length === 1 && to[0] === 'outer') return this.handleEnvelope(env);
    if (to[0] !== 'outer') return;
    const c = this.children.get(to[1]);
    if (c) { c.inbox.push({ type: 'env', env }); if (c.inbox.length > 4000) c.inbox.shift(); }
    else if (env.kind !== 'bounce') this.route({ to: env.from, kind: 'bounce', data: { kind: env.kind, why: '目标系统不存在', data: env.data } });
  }
  send(to, kind, data) { this.route({ to, from: ['outer'], kind, data }); }
  handleEnvelope(env) {
    const d = env.data || {};
    const dk = this.desktop;
    switch (env.kind) {
      case 'proj-open': {
        if (!dk) return;
        const r = dk.openProjection({ srcPath: env.from, srcSys: d['src-sys'], srcWin: d['src-win'], srcApp: d['src-app'], title: d.title, w: d.w, h: d.h });
        this.send(env.from, 'proj-opened', { 'src-win': d['src-win'], proj: r.wid, w: r.w, h: r.h });
        break;
      }
      case 'proj-focus': if (dk) dk.focusWindow(d.proj); break;
      case 'proj-end': if (dk) dk.endProjection(d.proj, d.reason || '投送已结束'); break;
      case 'proj-title': if (dk) dk.setProjectionTitle(d.proj, d.title); break;
      case 'file-pull': {
        let content = null;
        try { content = this.fs.read(d.path); } catch {}
        this.send(env.from, 'file-data', { req: d.req, path: d.path, name: (d.path || '').split('/').pop(), content, error: content == null ? '源文件不存在' : null });
        break;
      }
      case 'file-data': {
        const k = this.pendingPulls.get(d.req);
        if (k) { this.pendingPulls.delete(d.req); k(d); }
        break;
      }
      case 'data-sources': this.send(env.from, 'data-sources-r', { req: d.req, endpoint: d.endpoint, sources: this.dataSources ? this.dataSources.list() : [] }); break;
      case 'data-sub': this.subscribe(env.from, d); break;
      case 'data-unsub': this.subs.delete(d.sub); break;
      case 'drag-begin': if (dk) dk.foreignDragBegin(env.from, d); break;
      case 'drop-info': if (dk) dk.dropTargetInfo(env.from, d); break;
      case 'bounce': {
        const k = d.data && d.data.req && this.pendingPulls.get(d.data.req);
        if (k) { this.pendingPulls.delete(d.data.req); k({ error: d.why }); }
        break;
      }
      default: break;
    }
  }
  pullFile(srcPath, path, k) {
    const req = 'pull-' + Math.random().toString(36).slice(2);
    this.pendingPulls.set(req, k);
    this.send(srcPath, 'file-pull', { req, path });
    setTimeout(() => { if (this.pendingPulls.has(req)) { this.pendingPulls.delete(req); k({ error: '源系统没有响应（可能已暂停）' }); } }, 20000);
  }

  // ---------- 实时数据服务（根系统电子表格 -> 子系统图表） ----------
  subscribe(path, d) {
    const src = this.dataSources;
    const sub = { id: d.sub, path, endpoint: d.endpoint || d.sub, docId: d.doc, range: d.range, version: 0 };
    if (!src || !src.has(d.doc)) { this.send(path, 'data-closed', { sub: d.sub, reason: '数据源未打开' }); return; }
    this.subs.set(d.sub, sub);
    const v = src.read(d.doc, d.range);
    if (!v) { this.send(path, 'data-error', { sub: d.sub, error: '区域无效：' + d.range }); this.subs.delete(d.sub); return; }
    sub.version = v.version;
    this.charge(sizeOf(v.values) / 16);
    this.send(path, 'data-full', { sub: d.sub, version: v.version, values: v.values, title: v.title, range: d.range, doc: d.doc });
  }
  publish(docId) {
    // 电子表格每次提交并重算后调用：给订阅了该文档的连接发布新版本（完整选区）
    const src = this.dataSources;
    for (const sub of this.subs.values()) {
      if (sub.docId !== docId) continue;
      const v = src.read(docId, sub.range);
      if (!v) continue;
      sub.version = v.version;
      this.charge(sizeOf(v.values) / 16);
      this.send(sub.path, 'data-update', { sub: sub.id, version: v.version, values: v.values, title: v.title, range: sub.range, doc: docId });
    }
  }
  sourceClosed(docId) {
    for (const [k, sub] of this.subs) if (sub.docId === docId) { this.send(sub.path, 'data-closed', { sub: sub.id, reason: '数据源已关闭' }); this.subs.delete(k); }
  }

  // ---------- 系统信息 ----------
  sysinfo() {
    return { id: 'outer', name: this.name, path: ['outer'], depth: 1, time: this.clock, step: this.stepNo, conf: { ...this.conf },
      'step-info': { ...this.stepInfo }, storage: this.fs.used, kernel: '宿主实现的根系统', children: this.childOrder.length, procs: this.porder.length };
  }
  procInfo(q) {
    const c = q.ctx;
    return { pid: q.pid, name: q.name, path: q.path, kind: q.kind, state: q.state, wait: q.wait ? q.wait.k : null,
      units: c ? c.units : (q.units || 0), own: c ? c.own : 0, inner: c ? c.inner : 0, last: q.last, quota: q.quota, demand: q.demand,
      mem: c ? c.memTotal : 0, qlen: q.queue.length, error: q.error, progress: q.progress, pending: c && c.prepaidFor ? c.prepaidFor - c.prepaid : 0,
      out: q.out.slice(-8), child: q.child, parent: q.parent, where: c ? c.where() : '', appId: q.appId || null, svc: q.svc || 0 };
  }
  childInfo(c) {
    const hp = this.hostOf(c);
    return { id: c.id, name: c.name, state: c.state, rate: c.rate, cap: c.cap, budget: c.budget, mem: c.mem, storage: c.storage,
      error: c.error, kernel: c.kernel, pid: c.host, last: hp ? hp.last : 0, units: hp && hp.ctx ? hp.ctx.units : 0,
      own: c.own, inner: c.inner, memUsed: hp && hp.ctx ? hp.ctx.memTotal : 0, subtree: c.subtree, disk: this.fs.treeSize(`/System/Disks/${c.id}`) };
  }
  reset() {
    for (const id of [...this.childOrder]) { try { this.childControl('close', id); } catch {} }
    for (const p of [...this.procs.values()]) if (p.kind !== 'app') this.killProc(p, 'killed');
    this.procs.clear(); this.porder = [];
    for (const [k] of this.procs) this.procs.delete(k);
    this.children.clear(); this.childOrder = []; this.subs.clear(); this.bus.clear(); this.endpoints.clear(); this.wins.clear();
    this.nextInner = 1; this.clock = 0; this.stepNo = 0; this.snapSeq = 0; this.svcPending = 0;
    this.conf = { budget: 120000, mem: 3 * 1024 * 1024 * 1024, storage: 1536 * 1024 * 1024, childCap: 96000, procQuota: 40000 };
    this.loadBinIndex();
    this.rebuildTree();
  }
}

// ---------- 根系统的系统调用（与子系统内核提供的接口一致） ----------
const SYS = {
  now() { return this.clock; },
  self(p) { return p.pid; },
  yield(p) { p.used = p.quota; return true; },
  sleep(p, t) { const s = t[1]; if (typeof s !== 'number' || s <= 0) return this.clock; p.state = 'waiting'; p.wait = { k: 'sleep', until: this.clock + s }; return BLOCK; },
  log(p, t) { this.plog(p, toStr(t[1])); return true; },
  progress(p, t) { p.progress = [t[1], t[2]]; return true; },
  exit(p, t) { this.finish(p, t[1]); return BLOCK; },
  spawn(p, t) { const o = t[3] || {}; return this.spawn(t[1], t[2], o.kind || 'user', o.detached ? null : p.pid).pid; },
  kill(p, t) { const q = this.procs.get(t[1]); if (!q || q.child) return false; this.killProc(q, 'killed'); return true; },
  send(p, t) { return this.deliver(p.pid, t[1], t[2]); },
  recv(p, t) {
    if (p.queue.length) return p.queue.shift().msg;
    p.state = 'waiting'; p.wait = { k: 'recv', until: typeof t[1] === 'number' ? this.clock + t[1] : null }; return BLOCK;
  },
  'try-recv'(p) { return p.queue.length ? p.queue.shift().msg : null; },
  'recv-from'(p) { return p.queue.length ? p.queue.shift() : null; },
  'bus-write'(p, t) { this.bus.set(t[1], { v: deepCopy(t[2]), t: this.clock, pid: p.pid }); return true; },
  'bus-read'(p, t) { const e = this.bus.get(t[1]); return e ? { v: deepCopy(e.v), t: e.t } : null; },
  read(p, t) { return this.fs.read(t[1]); },
  write(p, t) { return this.fs.write(t[1], typeof t[2] === 'string' ? t[2] : toStr(t[2])); },
  list(p, t) { return this.fs.list(t[1]).map((e) => ({ name: e.name, path: e.path, type: e.type, size: e.size, mtime: e.mtime })); },
  stat(p, t) { const e = this.fs.get(t[1]); return e ? { path: this.fs.norm(t[1]), type: e.type, size: e.size, mtime: e.mtime } : null; },
  exists(p, t) { return this.fs.exists(t[1]); },
  mkdir(p, t) { return this.fs.mkdir(t[1]); },
  delete(p, t) { return this.fs.delete(t[1]); },
  rename(p, t) { return this.fs.rename(t[1], t[2]); },
  copy(p, t) { return this.fs.copy(t[1], t[2]); },
  storage() { return { used: this.fs.used, quota: this.fs.quota }; },
  compile(p, t) {
    const path = this.fs.norm(t[1]);
    const src = this.fs.read(path);
    if (src == null) return { error: '不存在: ' + path };
    p.state = 'waiting'; p.wait = { k: 'compile' };
    this.compileAsync(path, src, (res) => { p.wait = null; p.state = 'ready'; this.resume(p, typeof res === 'string' ? { ok: true, path } : res); });
    return BLOCK;
  },
  'install-compiler'(p) {
    const src = this.fs.read('/System/compiler.nest');
    p.state = 'waiting'; p.wait = { k: 'compile' };
    this.compileAsync('/System/compiler.nest', src, (res) => {
      p.wait = null; p.state = 'ready';
      if (typeof res === 'string') {
        const old = this.fs.read('/System/bin/compiler.nx');
        if (old) this.fs.write('/System/bin/compiler.prev.nx', old);
        this.fs.write('/System/bin/compiler.nx', res);
        this.compilerHash = hashStr(res);
        this.resume(p, { ok: true, hash: this.compilerHash });
      } else this.resume(p, res);
    });
    return BLOCK;
  },
  ps() { return this.porder.map((pid) => this.procs.get(pid)).filter(Boolean).map((q) => this.procInfo(q)); },
  proc(p, t) {
    const q = this.procs.get(t[1]); const a = t[2];
    if (!q) throw new Error('没有这个进程');
    if (a === 'suspend') { if (!['done', 'error', 'suspended'].includes(q.state)) { q.resumeState = q.state; q.state = 'suspended'; } }
    else if (a === 'resume') { if (q.state === 'suspended') { q.state = q.resumeState || 'ready'; this.wakeReceiver(q); } }
    else if (a === 'kill') { if (q.child) this.childControl('stop', q.child); else this.killProc(q, 'killed'); }
    else if (a === 'quota') q.quota = Math.max(0, Math.floor(t[3]));
    else throw new Error('未知操作: ' + a);
    this.emit('procs');
    return true;
  },
  sysinfo() { return this.sysinfo(); },
  sysconf(p, t) {
    const k = t[1], v = t[2];
    if (typeof v !== 'number') throw new Error('配置值必须是数字');
    const map = { budget: 'budget', mem: 'mem', storage: 'storage', 'child-cap': 'childCap', 'proc-quota': 'procQuota' };
    if (!map[k]) throw new Error('未知配置项: ' + k);
    this.conf[map[k]] = Math.max(0, Math.floor(v));
    if (k === 'storage') this.fs.quota = this.conf.storage;
    this.saveState();
    return { ...this.conf };
  },
  ancestors() { return ['outer']; },
  endpoint(p, t) { this.endpoints.set(t[1], p.pid); return true; },
  'endpoint-drop'(p, t) { this.endpoints.delete(t[1]); return true; },
  'win-open'(p, t) {
    const o = t[1] || {};
    const wid = `outer:p${this.nextWin++}`;
    this.wins.set(wid, { wid, pid: p.pid, app: o.app || 'program', title: o.title || p.name });
    p.wins.push(wid);
    if (this.desktop) this.desktop.openProgramWindow({ wid, pid: p.pid, title: o.title || p.name, w: o.w || 480, h: o.h || 320, app: o.app || 'program' });
    return wid;
  },
  'win-title'(p, t) { const w = this.wins.get(t[1]); if (w && w.pid === p.pid) { w.title = t[2]; if (this.desktop) this.desktop.setProgramTitle(w.wid, t[2]); } return true; },
  'win-close'(p, t) { const w = this.wins.get(t[1]); if (w && w.pid === p.pid) this.closeWindow(w.wid); return true; },
  'win-focus'(p, t) { if (this.desktop) this.desktop.focusWindow(t[1]); return true; },
  windows() { return [...this.wins.values()].map((w) => ({ wid: w.wid, pid: w.pid, app: w.app, title: w.title })); },
  display(p, t) {
    const sid = t[1];
    const pp = p.parent ? this.procs.get(p.parent) : null;
    const own = (ws) => ws.some((w) => sid === w || sid.startsWith(w + '@') || sid.startsWith(w + '#'));
    if (!own(p.wins) && !(pp && own(pp.wins))) throw new Error('无权提交到显示面 ' + sid);
    this.charge(sizeOf(t[2]) / 32, p);
    this.device.submit(sid, deepCopy(t[2]), deepCopy(t[3]));
    return true;
  },
  'display-res'(p, t) { this.device.resource('outer', t[1], deepCopy(t[2])); return true; },
  scene(p, t) {
    const sid = t[2];
    if (!p.wins.some((w) => sid.startsWith(w))) throw new Error('无权使用场景 ' + sid);
    this.charge(sizeOf(t[3]) / 32, p);
    this.device.scene(t[1], sid, deepCopy(t[3]));
    return true;
  },
  notify(p, t) { this.emit('notify', { title: toStr(t[1]), body: toStr(t[2]), from: p.name }); return true; },
  project() { throw new Error('根系统没有祖先桌面'); },
  unproject() { return true; },
  children() { return this.childOrder.map((id) => this.childInfo(this.children.get(id))); },
  child(p, t) {
    const a = t[1];
    if (a === 'new') return this.createChild(t[3]);
    if (a === 'restore' || a === 'fork') return this.snapshotLoad(a, t[2], t[3]);
    return this.childControl(a, t[2], t[3]);
  },
  'child-input'(p, t) { this.childInput(t[1], deepCopy(t[2])); return true; },
  'child-resize'(p, t) { this.childResize(t[1], t[2], t[3]); return true; },
  route(p, t) { const env = deepCopy(t[1]); env.from = ['outer']; this.route(env); return true; },

  // ---- 父系统接口：子系统内核（承载进程）调用 ----
  'k-boot'(p) {
    const c = this.children.get(p.child);
    if (!c) throw new Error('不是承载进程');
    return { id: c.id, name: c.name, path: ['outer', c.id], depth: 2, conf: { budget: c.budget, mem: c.mem, storage: c.storage }, size: c.size.slice(), restarts: c.restarts };
  },
  'k-tick'(p) {
    const c = this.children.get(p.child);
    if (!c) throw new Error('不是承载进程');
    if (c.state === 'booting') { c.state = 'running'; this.emitChild(c); }
    if (c.stepping === 2) { c.stepping = 0; this.emitChild(c); }
    p.state = 'waiting'; p.wait = { k: 'tick' };
    return BLOCK;
  },
  'k-disk-dump'(p) {
    const c = this.children.get(p.child); const pre = `/System/Disks/${c.id}`; const out = [];
    for (const [q, e] of this.fs.files) if (q.startsWith(pre + '/')) out.push([q.slice(pre.length), e.type, e.type === 'file' ? e.data : null, e.mtime]);
    this.charge(out.reduce((s, r) => s + (r[2] ? r[2].length : 16), 0) / 64, p);
    return out;
  },
  'k-disk-write'(p, t) { const c = this.children.get(p.child); return this.fs.write(`/System/Disks/${c.id}${t[1]}`, t[2]); },
  'k-disk-mkdir'(p, t) { const c = this.children.get(p.child); return this.fs.mkdir(`/System/Disks/${c.id}${t[1]}`); },
  'k-disk-delete'(p, t) { const c = this.children.get(p.child); const q = `/System/Disks/${c.id}${t[1]}`; if (this.fs.exists(q)) this.fs.delete(q); return true; },
  'k-disk-rename'(p, t) { const c = this.children.get(p.child); return this.fs.rename(`/System/Disks/${c.id}${t[1]}`, `/System/Disks/${c.id}${t[2]}`); },
  'k-image'(p) {
    const img = {};
    let n = 0;
    for (const k of Object.keys(this.innerImage)) { img[k] = this.innerImage[k]; n += this.innerImage[k].length; }
    this.charge(n / 64, p);
    return img;
  },
  'k-idalloc'() { return this.allocId(); },
  'k-display'(p, t) { this.charge(sizeOf(t[2]) / 32, p); this.device.submit(t[1], t[2] == null ? null : deepCopy(t[2]), t[3] == null ? null : deepCopy(t[3])); return true; },
  'k-display-res'(p, t) { this.device.resource(t[1], t[2], deepCopy(t[3])); return true; },
  'k-scene'(p, t) { this.charge(sizeOf(t[3]) / 32, p); this.device.scene(t[1], t[2], t[3] == null ? null : deepCopy(t[3])); return true; },
  'k-drop-subtree'(p, t) {
    const id = t[1];
    const ids = new Set([id]);
    for (const s of this.tree) if (this.isUnder(s.id, id)) ids.add(s.id);
    this.device.dropSystems(ids);
    for (const [k, s] of this.subs) if (s.path.some((x) => ids.has(x))) this.subs.delete(k);
    if (this.desktop) this.desktop.sourcesGone(ids, '源系统已停止');
    return true;
  },
  'k-route'(p, t) { this.route(deepCopy(t[1])); return true; },
  'k-report'(p, t) {
    const c = this.children.get(p.child);
    if (c && t[1] === 'tree') { c.subtree = deepCopy(t[2]) || []; this.rebuildTree(); }
    return true;
  },
  'k-capture'(p, t) { return this.device.capture(this.subtreeIds(t[1])); },
  'k-restore-display'(p, t) { this.device.restore(deepCopy(t[1])); return true; },
};
export { SYS as ROOT_SYSCALLS, BLOCK };
