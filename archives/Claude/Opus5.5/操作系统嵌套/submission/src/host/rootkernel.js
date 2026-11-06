// 根系统内核（题面允许根系统由宿主实现）。接口与 programs/system/kernel.nest 对等：
// 承载进程（直属子系统内核）用同样的 tick/up/disk_* 调用向它取得时间、输入和存储。
import { Ctx, Image, loadImage, vmRun, vmResume, cloneValue, lastCopySize, refreshMem, remapValue, hashText, fromHost, deserializeCtx, serializeCtx, COPY_UNIT, ST_BUDGET, ST_TRAP, ST_EXIT, ST_FAULT } from './vm.js';

export const STEP_DT = 1 / 60;
const K_DISPATCH = 40;   // 根内核处理一次调度的计量
const K_SYSCALL = 60;    // 根内核处理一次系统调用的计量
const QUANTUM_DIV = 2;
const MB = 1024 * 1024;

const pathParts = (p) => p.split('/').filter((x) => x && x !== '.');
const norm = (p) => '/' + pathParts(p).join('/');
const dirnameOf = (p) => { const a = pathParts(p); a.pop(); return '/' + a.join('/'); };
const basenameOf = (p) => { const a = pathParts(p); return a.length ? a[a.length - 1] : ''; };
export { dirnameOf, basenameOf };

// 根系统文件系统：内存目录树 + 持久化回调（系统实例的磁盘 /Systems/** 只在内存中）
export class RootFS {
  constructor(persist) {
    this.nodes = new Map(); // path -> { type, text, size, mtime }
    this.nodes.set('/', { type: 'dir', size: 0, mtime: 0 });
    this.persist = persist || null;
    this.used = 0;
    this.limit = 8192 * MB;
    this.clock = () => Date.now() / 1000;
    this.watchers = new Set();
  }
  loadAll(files) {
    this.nodes.clear();
    this.nodes.set('/', { type: 'dir', size: 0, mtime: 0 });
    this.used = 0;
    for (const [p, v] of Object.entries(files)) {
      if (v === null) this.mkdirs(p, true);
      else this.write(p, v, true);
    }
  }
  exists(p) { return this.nodes.has(norm(p)); }
  stat(p) {
    const n = this.nodes.get(norm(p));
    if (!n) return null;
    return { name: basenameOf(p), type: n.type, size: n.size, mtime: n.mtime, path: norm(p) };
  }
  read(p) { const n = this.nodes.get(norm(p)); return n && n.type === 'file' ? n.text : null; }
  mkdirs(p, silent) {
    const parts = pathParts(p);
    let cur = '';
    for (const x of parts) {
      cur += '/' + x;
      const n = this.nodes.get(cur);
      if (n && n.type !== 'dir') return false;
      if (!n) {
        this.nodes.set(cur, { type: 'dir', size: 0, mtime: this.clock() });
        if (!silent && this.persist && !cur.startsWith('/Systems')) this.persist('mkdir', cur);
        if (!silent) this.changed(cur);
      }
    }
    return true;
  }
  write(p, text, silent) {
    p = norm(p);
    if (typeof text !== 'string') text = JSON.stringify(text);
    const n = this.nodes.get(p);
    if (n && n.type === 'dir') return { error: 'EISDIR: 目标是目录 ' + p };
    const old = n ? n.size : 0;
    if (this.used - old + text.length > this.limit) return { error: `ENOSPC: 存储配额不足（根系统上限 ${Math.floor(this.limit / 1024)} KB）` };
    this.mkdirs(dirnameOf(p), silent);
    this.nodes.set(p, { type: 'file', text, size: text.length, mtime: this.clock() });
    this.used += text.length - old;
    if (!silent && this.persist && !p.startsWith('/Systems')) this.persist('write', p, text);
    if (!silent) this.changed(p);
    return true;
  }
  children(p) {
    p = norm(p);
    const pre = p === '/' ? '/' : p + '/';
    const out = [];
    for (const k of this.nodes.keys()) {
      if (k !== '/' && k.startsWith(pre) && k.indexOf('/', pre.length) < 0) out.push(k);
    }
    return out;
  }
  list(p) {
    p = norm(p);
    const n = this.nodes.get(p);
    if (!n) return { error: 'ENOENT: ' + p };
    if (n.type !== 'dir') return { error: 'ENOTDIR: ' + p };
    const out = this.children(p).map((k) => {
      const c = this.nodes.get(k);
      return { name: basenameOf(k), type: c.type, size: c.size, mtime: c.mtime, path: k };
    });
    out.sort((a, b) => (a.type === b.type ? (a.name < b.name ? -1 : 1) : a.type === 'dir' ? -1 : 1));
    return out;
  }
  remove(p, silent) {
    p = norm(p);
    if (p === '/') return { error: 'EPERM: 不能删除根目录' };
    const n = this.nodes.get(p);
    if (!n) return { error: 'ENOENT: ' + p };
    const pre = p + '/';
    for (const k of [...this.nodes.keys()]) {
      if (k === p || k.startsWith(pre)) {
        const c = this.nodes.get(k);
        if (c.type === 'file') this.used -= c.size;
        this.nodes.delete(k);
      }
    }
    if (!silent && this.persist && !p.startsWith('/Systems')) this.persist('remove', p);
    if (!silent) this.changed(p);
    return true;
  }
  rename(a, b) {
    a = norm(a); b = norm(b);
    if (!this.nodes.has(a)) return { error: 'ENOENT: ' + a };
    if (this.nodes.has(b)) return { error: 'EEXIST: 目标已存在 ' + b };
    if ((b + '/').startsWith(a + '/')) return { error: 'EINVAL: 不能移动到自身内部' };
    this.mkdirs(dirnameOf(b));
    const pre = a + '/';
    for (const k of [...this.nodes.keys()]) {
      if (k === a || k.startsWith(pre)) {
        const nk = b + k.slice(a.length);
        const c = this.nodes.get(k);
        this.nodes.delete(k);
        this.nodes.set(nk, c);
      }
    }
    if (this.persist) this.persist('rename', a, b);
    this.changed(a);
    return true;
  }
  copy(a, b) {
    a = norm(a); b = norm(b);
    const n = this.nodes.get(a);
    if (!n) return { error: 'ENOENT: ' + a };
    if (n.type === 'file') return this.write(b, n.text);
    this.mkdirs(b);
    for (const k of this.children(a)) {
      const r = this.copy(k, b + '/' + basenameOf(k));
      if (r !== true) return r;
    }
    return true;
  }
  walk(p, base, out) {
    p = norm(p);
    const n = this.nodes.get(p);
    if (!n) return out;
    if (n.type === 'file') { out.push([base, n.text]); return out; }
    if (base !== '') out.push([base, null]);
    for (const k of this.children(p).sort()) this.walk(k, base + '/' + basenameOf(k), out);
    return out;
  }
  changed(p) { if (p.startsWith('/Systems')) return; for (const w of this.watchers) w(p); }
}

export class RootKernel {
  constructor({ fs, device, hooks }) {
    this.fs = fs;
    this.device = device;
    this.hooks = hooks || {};
    this.vtime = 0;
    this.ticks = 0;
    this.cfg = { budget: 600000, mem: 4096 * MB, storage: fs.limit };
    this.procs = new Map();
    this.nextPid = 1;
    this.runq = [];
    this.throttled = [];
    this.sleepers = [];
    this.dead = [];
    this.children = new Map();
    this.systems = new Map();
    this.systems.set('outer', { id: 'outer', parentId: null, name: '根系统', state: 'running', path: 'outer' });
    this.nextInner = 1;
    this.left = 0;
    this.selfUsed = 0;
    this.selfTotal = 0;
    this.avg = { used: 0, own: 0 };
    this.bus = {};
    this.jobs = new Map();
    this.rebuilding = false;
    this.imgQueue = [];
    this.compilerBad = '';
    this.projections = new Map();
    this.subs = new Map();
    this.xfers = new Map();
    this.nextXfer = 1;
    this.fsWatchers = new Set();
    this.fsDirty = false;
    this.nextSurface = 1;
    this.surfaces = new Map();
    this.views = new Map();
    this.dataHub = null;
    this.tickListeners = new Set();
    fs.watchers.add(() => { this.fsDirty = true; });
    this.SC = this.buildSyscalls();
    this.HC = this.buildHostCalls();
  }

  // —— 进程 ——
  enqueue(p) {
    if (p.inq || p.suspended || p.state !== 'ready') return;
    if (p.child) { const c = this.children.get(p.child); if (c && c.paused && !c.stepping) return; }
    p.inq = true;
    this.runq.push(p.pid);
  }
  wake(p, v) {
    if (p.state === 'exited' || p.state === 'fault') return;
    p.wait = null; p.wakeAt = null;
    this.resumeCtx(p, v);
    p.state = 'ready';
    this.enqueue(p);
  }
  resumeCtx(p, v) {
    vmResume(p.ctx, v === undefined ? null : v, null);
    this.charge(Math.ceil(lastCopySize() / COPY_UNIT));
  }
  charge(n) { this.left -= n; this.selfUsed += n; this.selfTotal += n; }
  newProcess(image, args, o) {
    const pid = this.nextPid++;
    const ctx = new Ctx(image, cloneValue(args === undefined ? null : args), { priv: !!o.priv, memLimit: o.mem || 512 * MB, seed: pid * 7919 + this.ticks });
    const p = {
      pid, name: o.name || o.path, path: o.path, ctx, state: 'ready', wait: null, wakeAt: null, mq: [], suspended: false, inq: false,
      kind: o.kind || 'user', ppid: o.ppid || 0, group: o.group || pid, leader: !o.group, quota: o.quota || 0, quotaLeft: o.quota || 0,
      stdout: o.stdout || 0, child: o.child, app: o.app, onExit: o.onExit, tickUsed: 0, avg: 0, msgsIn: 0, msgsOut: 0, remaining: 0, error: null,
      started: this.vtime, sysMsgs: o.sysMsgs,
    };
    this.procs.set(pid, p);
    this.enqueue(p);
    return p;
  }
  // 宿主应用的逻辑进程：工作排队，按完成进度付费
  newService(name, app) {
    const pid = this.nextPid++;
    const p = {
      pid, name, path: '（根系统应用）', ctx: null, state: 'waiting', wait: 'event', suspended: false, inq: false, kind: 'app', ppid: 0, group: pid,
      leader: true, quota: 0, quotaLeft: 0, app, tickUsed: 0, avg: 0, msgsIn: 0, msgsOut: 0, remaining: 0, error: null, service: true, jobs: [], usedTotal: 0, mq: [], mem: 4096,
      started: this.vtime,
    };
    this.procs.set(pid, p);
    return p;
  }
  // 添加一项已知规模的工作；付清后执行 fn。
  addWork(svc, cost, fn) {
    if (!svc || svc.state === 'exited') { if (fn) fn(); return; }
    svc.jobs.push({ left: Math.max(1, Math.ceil(cost)), fn });
    svc.remaining += Math.max(1, Math.ceil(cost));
    if (svc.state === 'waiting') { svc.state = 'ready'; }
    if (!svc.suspended) this.enqueue(svc);
  }
  endService(p) {
    if (!p || p.state === 'exited') return;
    p.state = 'exited'; p.jobs = []; p.remaining = 0; p.inq = false;
    this.dead.push(p.pid);
    this.trimDead();
  }
  trimDead() { while (this.dead.length > 32) this.procs.delete(this.dead.shift()); }

  procCleanup(p) {
    this.fsWatchers.delete(p.pid);
    for (const [sid, owner] of this.surfaces) if (owner === p.pid) { this.surfaces.delete(sid); this.device.surfaceDrop('outer', sid); }
    for (const [vid, v] of this.views) if (v.pid === p.pid) { this.views.delete(vid); this.device.gfxClose('outer', vid); }
  }
  procEnd(p, state, value, err) {
    if (p.state === 'exited' || p.state === 'fault') return;
    p.state = state; p.error = err; p.inq = false;
    if (p.ctx) { p.finalUsed = p.ctx.used; p.finalOwn = p.ctx.used - p.ctx.kidUsed; }
    p.ctx = null; p.mq = [];
    this.procCleanup(p);
    this.dead.push(p.pid); this.trimDead();
    if (p.leader && !p.child) {
      for (const q of this.procs.values()) if (q.group === p.pid && q.pid !== p.pid && q.ctx) this.procEnd(q, 'exited', null, '所属应用已结束');
    }
    if (p.child) this.childOnExit(this.children.get(p.child), state, err);
    if (p.onExit) p.onExit(value, err);
    for (const q of this.procs.values()) if (q.wait === 'proc' && q.waitPid === p.pid) this.wake(q, { state, value, error: err });
    if (p.stdout) this.deliver(0, p.stdout, { type: 'proc_end', pid: p.pid, state, error: err, value });
    if (state === 'fault' && this.hooks.notify) this.hooks.notify('error', `进程 ${p.name} 异常：${err}`);
    if (this.hooks.procsChanged) this.hooks.procsChanged();
  }
  runProc(p, n) {
    if (p.service) return this.runService(p, n);
    p.state = 'running'; p.inq = false;
    let remain = n;
    const ctx = p.ctx;
    if (p.child) ctx.effLimit = Math.min(ctx.memLimit, this.cfg.mem);
    while (remain > 0) {
      const st = vmRun(ctx, remain);
      const paid = ctx.lastPaid;
      p.tickUsed += paid; p.quotaLeft -= paid; remain -= paid; this.left -= paid;
      if (st === ST_BUDGET) { if (paid === 0) break; continue; }
      if (st === ST_TRAP) {
        const name = ctx.trapName, args = ctx.trapArgs;
        this.charge(K_SYSCALL);
        const h = (p.child && this.HC[name]) || this.SC[name];
        let res;
        if (!h) res = { error: 'ENOSYS: 没有这个系统调用 ' + name };
        else {
          try { res = h(p, args); } catch (e) { console.error(e); res = { error: `系统调用 ${name} 失败：${e.message || e}` }; }
        }
        if (res === RootKernel.BLOCK) return;
        if (p.ctx === null || p.state !== 'running') return;
        this.resumeCtx(p, res);
        continue;
      }
      if (st === ST_EXIT) { this.procEnd(p, 'exited', ctx.exitValue, null); return; }
      this.procEnd(p, 'fault', null, ctx.error);
      return;
    }
    if (p.state === 'running') { p.state = 'ready'; this.enqueue(p); }
  }
  runService(p, n) {
    p.inq = false;
    let budget = n;
    while (budget > 0 && p.jobs.length) {
      const j = p.jobs[0];
      const pay = Math.min(j.left, budget);
      j.left -= pay; budget -= pay; p.remaining -= pay; p.tickUsed += pay; p.usedTotal += pay; this.left -= pay; p.quotaLeft -= pay;
      if (j.left <= 0) {
        p.jobs.shift();
        if (j.fn) { try { j.fn(); } catch (e) { console.error(e); p.error = String(e.message || e); } }
      }
    }
    if (p.state === 'exited') return;
    if (p.jobs.length) { p.state = 'ready'; this.enqueue(p); } else { p.state = 'waiting'; p.wait = 'event'; }
  }

  // —— 一个逻辑步 ——
  tick() {
    const dt = STEP_DT;
    this.vtime += dt;
    this.ticks++;
    this.left = this.cfg.budget;
    this.selfUsed = 0;
    for (const p of this.procs.values()) { p.quotaLeft = p.quota; p.avg += (p.tickUsed - p.avg) * 0.05; p.tickUsed = 0; }
    for (const c of this.children.values()) {
      if (c.state === 'stopped' || c.state === 'error' || !c.pid) continue;
      if (c.stepReq > 0 && c.paused) { c.stepReq--; c.stepping = true; c.pendingDt += STEP_DT * c.rate; }
      else if (!c.paused) c.pendingDt += dt * c.rate;
      const p = this.procs.get(c.pid);
      if (p) {
        if (p.state === 'waiting' && p.wait === 'tick' && c.pendingDt > 0 && (!c.paused || c.stepping) && !p.suspended) this.wake(p, this.takeTick(c));
        else this.enqueue(p);
      }
    }
    if (this.sleepers.length) {
      const keep = [];
      for (const pid of this.sleepers) {
        const p = this.procs.get(pid);
        if (!p || p.wakeAt === null || p.wakeAt === undefined) continue;
        if (p.wakeAt <= this.vtime && !p.suspended) { p.wakeAt = null; this.wake(p, null); } else keep.push(pid);
      }
      this.sleepers = keep;
    }
    const q = Math.max(500, Math.floor(this.cfg.budget / QUANTUM_DIV));
    while (this.runq.length && this.left > 0) {
      const pid = this.runq.shift();
      const p = this.procs.get(pid);
      if (!p) continue;
      p.inq = false;
      if (p.state !== 'ready' || p.suspended) continue;
      if (p.child) { const c = this.children.get(p.child); if (c && c.paused && !c.stepping) continue; }
      let n = q;
      if (p.quota > 0) {
        if (p.quotaLeft <= 0) { this.throttled.push(pid); continue; }
        if (n > p.quotaLeft) n = p.quotaLeft;
      }
      if (n > this.left) n = this.left;
      this.charge(K_DISPATCH);
      this.runProc(p, n);
    }
    while (this.throttled.length) {
      const p = this.procs.get(this.throttled.pop());
      if (p && p.state === 'ready') this.enqueue(p);
    }
    for (const c of this.children.values()) c.stepping = false;
    const used = this.cfg.budget - this.left;
    this.avg.used += (used - this.avg.used) * 0.05;
    this.avg.own += (this.selfUsed - this.avg.own) * 0.05;
    if (this.fsDirty) {
      this.fsDirty = false;
      for (const pid of this.fsWatchers) this.deliver(0, pid, { type: 'fs_changed' });
      if (this.hooks.fsChanged) this.hooks.fsChanged();
    }
    for (const l of this.tickListeners) l(this);
  }
  takeTick(c) {
    const r = { dt: c.pendingDt, inbox: c.inbox };
    c.pendingDt = 0; c.inbox = [];
    return r;
  }

  // —— 消息 ——
  deliver(from, to, data) {
    const t = this.procs.get(to);
    if (!t || t.state === 'exited' || t.state === 'fault' || t.service) return false;
    const m = fromHost({ from, data, t: this.vtime });
    t.msgsIn++;
    if (t.state === 'waiting' && t.wait === 'recv' && !t.suspended) { this.wake(t, m); return true; }
    if (t.mq.length >= 8192) return false;
    t.mq.push(m);
    return true;
  }

  // —— 程序载入：编译器是系统内的程序 ——
  requestImage(path, cb) {
    if (this.rebuilding) { this.imgQueue.push([path, cb]); return; }
    const src = this.fs.read(path);
    if (src === null) { cb(null, '找不到文件 ' + path); return; }
    const ctext = this.fs.read('/System/bin/compiler.nbc');
    if (ctext === null) { cb(null, '系统缺少编译器 /System/bin/compiler.nbc'); return; }
    this.charge((src.length + ctext.length) >> 4);
    const csrc = this.fs.read('/System/compiler.nest');
    if (csrc !== null) {
      const ch = hashText(csrc);
      const hd = nbcHeader(ctext);
      if (hd && ch !== hd.deps[0][1] && ch !== this.compilerBad) {
        this.rebuilding = true;
        this.imgQueue.push([path, cb]);
        this.startCompile('/System/compiler.nest', ctext, '', (value, err) => this.onCompilerBuilt(ch, value, err));
        return;
      }
    }
    const cid = hashText(ctext);
    const key = hashText(src);
    const binPath = `/System/bin/${key}.nbc`;
    const bin = this.fs.read(binPath);
    if (bin !== null) {
      const h = nbcHeader(bin);
      if (h && h.compiler === cid && this.depsOk(h)) {
        try { cb(loadImage(bin), null); } catch (e) { cb(null, e.message); }
        return;
      }
    }
    let job = this.jobs.get(key);
    if (job) { job.waiters.push(cb); return; }
    job = { key, waiters: [cb] };
    this.jobs.set(key, job);
    this.startCompile(path, ctext, cid, (value, err) => {
      this.jobs.delete(key);
      let im = null, e = err;
      if (value && value.ok) {
        const w = this.fs.write(binPath, value.text);
        if (w !== true) e = w.error;
        else { try { im = loadImage(value.text); } catch (x) { e = x.message; } }
      } else if (value) e = value.error;
      else if (!e) e = '编译器被结束';
      for (const w of job.waiters) w(im, e);
    });
  }
  depsOk(h) {
    for (let i = 1; i < h.deps.length; i++) {
      const t = this.fs.read(h.deps[i][0]);
      if (t === null || hashText(t) !== h.deps[i][1]) return false;
    }
    return true;
  }
  startCompile(path, ctext, cid, cb) {
    this.newProcess(loadImage(ctext), { path, compiler_id: cid }, { name: '编译器 ' + basenameOf(path), path: '/System/compiler.nest', kind: 'system', onExit: cb });
  }
  onCompilerBuilt(ch, value, err) {
    this.rebuilding = false;
    if (value && value.ok) {
      this.fs.write('/System/bin/compiler.nbc', value.text);
      if (this.hooks.notify) this.hooks.notify('info', '编译器已用新的源文件重新编译，后续启动的程序使用新编译器');
    } else {
      this.compilerBad = ch;
      if (this.hooks.notify) this.hooks.notify('error', '编译器源文件编译失败，继续使用现有编译器：' + (value ? value.error : err));
    }
    const q = this.imgQueue; this.imgQueue = [];
    for (const [p, c] of q) this.requestImage(p, c);
  }
  // 宿主入口：启动程序（编辑器的“运行”、桌面图标）。回调得到 pid 或 {error}。
  spawn(path, args, opts, cb) {
    this.requestImage(path, (image, err) => {
      if (!image) { if (cb) cb({ error: '编译失败：' + err }); return; }
      try {
        const p = this.newProcess(image, args, { path, name: (opts && opts.name) || basenameOf(path), ...(opts || {}) });
        if (cb) cb(p.pid);
      } catch (e) { if (cb) cb({ error: e.message }); }
    });
  }
  compile(path, cb) { this.requestImage(path, (im, err) => cb(im ? true : { error: err })); }
  procKill(pid, reason) {
    const p = this.procs.get(pid);
    if (!p) return false;
    if (p.child) { this.childStop(this.children.get(p.child), '承载进程被结束'); return true; }
    if (p.service) { if (this.hooks.killApp) this.hooks.killApp(p); this.endService(p); return true; }
    if (p.ctx) this.procEnd(p, 'exited', null, reason || '被任务管理器结束');
    return true;
  }
  procSuspend(pid) {
    const p = this.procs.get(pid);
    if (!p) return false;
    p.suspended = true;
    if (p.child) { const c = this.children.get(p.child); if (c) { c.paused = true; this.childSetState(c, 'paused'); } }
    return true;
  }
  procResume(pid) {
    const p = this.procs.get(pid);
    if (!p) return false;
    p.suspended = false;
    if (p.child) { const c = this.children.get(p.child); if (c) { c.paused = false; this.childSetState(c, 'running'); } }
    if (p.service) { if (p.jobs.length) { p.state = 'ready'; this.enqueue(p); } return true; }
    if (p.wait === 'recv' && p.mq.length) { this.wake(p, p.mq.shift()); return true; }
    if (p.wakeAt !== null && p.wakeAt !== undefined && p.wakeAt <= this.vtime) { this.wake(p, null); return true; }
    this.enqueue(p);
    return true;
  }
  procRows() {
    const rows = [];
    for (const p of this.procs.values()) {
      if (p.service) {
        rows.push({ pid: p.pid, ppid: 0, name: p.name, path: p.path, kind: p.kind, app: p.app, state: p.suspended && p.state !== 'exited' ? 'suspended' : p.state, wait: p.wait, used: p.usedTotal, own: p.usedTotal, mem: p.mem || 0, debt: 0, remaining: p.remaining, avg: Math.floor(p.avg), quota: p.quota, mq: 0, msgsIn: 0, msgsOut: 0, error: p.error, child: null, inner: 0 });
        continue;
      }
      const c = p.ctx;
      if (c) refreshMem(c);
      rows.push({
        pid: p.pid, ppid: p.ppid, name: p.name, path: p.path, kind: p.kind, app: p.app, state: p.suspended && c ? 'suspended' : p.state, wait: p.wait,
        used: c ? c.used : (p.finalUsed || 0), own: c ? c.used - c.kidUsed : (p.finalOwn || 0), inner: c ? c.kidUsed : 0, mem: c ? c.memTotal : 0, debt: c ? c.debt : 0,
        remaining: p.remaining + (c ? c.debt : 0), avg: Math.floor(p.avg), quota: p.quota, mq: p.mq.length, msgsIn: p.msgsIn, msgsOut: p.msgsOut, error: p.error, child: p.child || null,
      });
    }
    return rows;
  }
  stats() {
    let mem = 0;
    for (const p of this.procs.values()) if (p.ctx) mem += p.ctx.memTotal; else if (p.service && p.state !== 'exited') mem += p.mem || 0;
    return {
      id: 'outer', name: this.hooks.systemName ? this.hooks.systemName() : '根系统', path: 'outer', depth: 1, vtime: this.vtime, ticks: this.ticks, budget: this.cfg.budget,
      used_avg: Math.floor(this.avg.used), own_avg: Math.floor(this.avg.own), runq: this.runq.length, mem_used: mem, mem_limit: this.cfg.mem,
      storage_used: this.fs.used, storage_limit: this.fs.limit, step: STEP_DT, procs: this.procs.size,
    };
  }

  // —— 系统调用（普通程序在根系统运行时）——
  buildSyscalls() {
    const K = this, BLOCK = RootKernel.BLOCK;
    return {
      time: () => K.vtime,
      sleep(p, a) {
        const d = a[0] > 0 ? a[0] : 0;
        p.wakeAt = K.vtime + d; K.sleepers.push(p.pid);
        p.state = 'waiting'; p.wait = 'sleep';
        return BLOCK;
      },
      self: (p) => ({ pid: p.pid, system: 'outer', path: 'outer', depth: 1, name: K.hooks.systemName ? K.hooks.systemName() : '根系统', ppid: p.ppid, group: p.group }),
      exit(p, a) { K.procEnd(p, 'exited', a[0], null); return BLOCK; },
      spawn(p, a) {
        p.state = 'waiting'; p.wait = 'spawn';
        const o = a[2] || {};
        K.spawn(a[0], a[1], {
          name: o.name, ppid: p.pid, kind: o.kind || 'user', stdout: o.stdout || (o.inherit_stdout ? p.stdout : 0), group: o.join_group ? p.group : undefined, app: o.app, quota: o.quota, mem: o.mem,
        }, (r) => { if (p.wait === 'spawn') K.wake(p, r); });
        return BLOCK;
      },
      compile(p, a) {
        p.state = 'waiting'; p.wait = 'spawn';
        K.compile(a[0], (r) => { if (p.wait === 'spawn') K.wake(p, r); });
        return BLOCK;
      },
      kill(p, a) { return K.procKill(a[0], `被进程 ${p.pid} 结束`) ? true : { error: 'ENOPROC: 进程不存在' }; },
      suspend(p, a) { return K.procSuspend(a[0]) ? true : { error: 'ENOPROC: 进程不存在' }; },
      resume(p, a) { return K.procResume(a[0]) ? true : { error: 'ENOPROC: 进程不存在' }; },
      set_quota(p, a) { const t = K.procs.get(a[0]); if (!t) return { error: 'ENOPROC: 进程不存在' }; t.quota = a[1]; t.quotaLeft = a[1]; return true; },
      wait_proc(p, a) {
        const t = K.procs.get(a[0]);
        if (!t || !t.ctx) return { state: 'exited' };
        p.state = 'waiting'; p.wait = 'proc'; p.waitPid = a[0];
        return BLOCK;
      },
      proc_state(p, a) { const t = K.procs.get(a[0]); return !t ? 'gone' : t.suspended ? 'suspended' : t.state; },
      proc_list: () => K.procRows(),
      stats: () => K.stats(),
      work(p, a) { p.remaining = a[0] || 0; return true; },
      send(p, a) {
        const ok = K.deliver(p.pid, a[0], a[1]);
        p.msgsOut++;
        return ok ? true : { error: `ENOPROC: 目标进程 ${a[0]} 不存在或已结束` };
      },
      recv(p, a) {
        if (p.mq.length) return p.mq.shift();
        const timeout = a[0];
        if (timeout !== null && timeout !== undefined) {
          if (timeout <= 0) return null;
          p.wakeAt = K.vtime + timeout; K.sleepers.push(p.pid);
        }
        p.state = 'waiting'; p.wait = 'recv';
        return BLOCK;
      },
      fs_read(p, a) { const t = K.fs.read(a[0]); if (t === null) return { error: `ENOENT: 文件不存在 ${a[0]}` }; K.charge(t.length >> 4); return t; },
      fs_write(p, a) { const t = typeof a[1] === 'string' ? a[1] : JSON.stringify(a[1]); K.charge(t.length >> 4); return K.fs.write(a[0], t); },
      fs_append(p, a) { const t = K.fs.read(a[0]) || ''; return K.fs.write(a[0], t + String(a[1])); },
      fs_list(p, a) { return K.fs.list(a[0]); },
      fs_stat(p, a) { return K.fs.stat(a[0]); },
      fs_mkdir(p, a) { return K.fs.mkdirs(a[0]) ? true : { error: 'ENOTDIR: ' + a[0] }; },
      fs_delete(p, a) { return K.fs.remove(a[0]); },
      fs_rename(p, a) { return K.fs.rename(a[0], a[1]); },
      fs_copy(p, a) { return K.fs.copy(a[0], a[1]); },
      fs_watch(p) { K.fsWatchers.add(p.pid); return true; },
      print(p, a) {
        const t = typeof a[0] === 'string' ? a[0] : JSON.stringify(a[0]);
        if (K.hooks.programOutput) K.hooks.programOutput(p, { type: 'print', text: t });
        if (p.stdout) K.deliver(p.pid, p.stdout, { type: 'print', pid: p.pid, name: p.name, text: t });
        return true;
      },
      draw(p, a) { if (K.hooks.programOutput) K.hooks.programOutput(p, { type: 'draw', ops: a[0] }); return true; },
      scene(p, a) { if (K.hooks.programOutput) K.hooks.programOutput(p, { type: 'scene', text: a[0], frame: a[1] }); return true; },
      scene_frame(p, a) { if (K.hooks.programOutput) K.hooks.programOutput(p, { type: 'scene_frame', frame: a[0] }); return true; },
      bus_write(p, a) { K.bus[a[0]] = { t: K.vtime, v: a[1] }; return true; },
      bus_read(p, a) { const e = K.bus[a[0]]; return e ? e.v : null; },
      ancestors: () => [],
      notify(p, a) { if (K.hooks.notify) K.hooks.notify(a[1] || 'info', a[0]); return true; },
      service_get: () => null,
      service_set: () => true,
      set_config(p, a) { K.setConfig(a[0]); return true; },
    };
  }
  setConfig(c) {
    if (c.budget > 0) this.cfg.budget = c.budget;
    if (c.mem > 0) this.cfg.mem = c.mem;
    if (c.storage > 0) { this.cfg.storage = c.storage; this.fs.limit = c.storage; }
  }

  // —— 承载进程接口 ——
  buildHostCalls() {
    const K = this, BLOCK = RootKernel.BLOCK;
    return {
      tick(p) {
        const c = K.children.get(p.child);
        if (!c) return { dt: 0, inbox: [] };
        if (c.pendingDt > 0) return K.takeTick(c);
        p.state = 'waiting'; p.wait = 'tick';
        return BLOCK;
      },
      up(p, a) { return K.route(a[0], p); },
      disk_get(p, a) {
        const c = K.children.get(p.child);
        return K.fs.read(`/Systems/${c.id}/disk/${a[0]}`);
      },
      disk_put(p, a) {
        const c = K.children.get(p.child);
        const path = `/Systems/${c.id}/disk/${a[0]}`;
        const st = K.fs.stat(path);
        const old = st ? st.size : 0;
        if (c.diskUsed - old + a[1].length > c.storage + MB) return { error: `ENOSPC: ${c.id} 超出父系统拨付的存储配额` };
        const r = K.fs.write(path, a[1]);
        if (r === true) c.diskUsed += a[1].length - old;
        return r;
      },
      disk_del(p, a) {
        const c = K.children.get(p.child);
        const path = `/Systems/${c.id}/disk/${a[0]}`;
        const st = K.fs.stat(path);
        if (st) { c.diskUsed -= st.size; K.fs.remove(path); }
        return true;
      },
      seed_list() {
        const out = [];
        const add = (d) => { const n = K.fs.stat(d); if (!n) return; if (n.type === 'file') { out.push(d); return; } for (const k of K.fs.children(d).sort()) add(k); };
        for (const d of ['/System', '/Programs', '/Flight', '/Docs']) add(d);
        if (K.fs.exists('/Demo/helicopter-24.scene')) out.push('/Demo/helicopter-24.scene');
        if (K.fs.exists('/Demo/minimal.scene')) out.push('/Demo/minimal.scene');
        return out;
      },
      seed_read(p, a) { return K.fs.read(a[0]); },
    };
  }

  // —— 跨层路由 ——
  route(m, fromProc) {
    const d = m.dst;
    if (d === 'host' || d === undefined || d === null) return this.hostOp(m, fromProc);
    if (d === 'outer') return this.localOp(m);
    if (d.startsWith('outer/')) {
      const rest = d.slice(6);
      const i = rest.indexOf('/');
      const next = i < 0 ? rest : rest.slice(0, i);
      const c = this.children.get(next);
      if (!c) return { error: 'ENOSYS: 没有实例 ' + next };
      c.inbox.push(fromHost(m));
      return true;
    }
    return { error: 'ENOSYS: 无法路由到 ' + d };
  }
  // 向下发送（根系统应用使用）
  sendDown(path, msg) { msg.dst = path; return this.route(msg); }

  localOp(m) {
    const H = this.hooks;
    switch (m.op) {
      case 'deliver': this.deliver(0, m.pid, m.data); break;
      case 'proj_open': if (H.projOpen) H.projOpen(m.proj); break;
      case 'proj_close': if (H.projClose) H.projClose(m.id, m.reason); break;
      case 'proj_focus': if (H.projFocus) H.projFocus(m.id); break;
      case 'xfer_data': this.xferData(m); break;
      case 'xfer_result': if (H.notify) H.notify(m.ok ? 'info' : 'error', m.text); break;
      case 'notify': if (H.notify) H.notify(m.level, m.text); break;
      case 'focus_child_parent': if (H.focusDesktop) H.focusDesktop(m.child); break;
      case 'data_sources': if (this.dataHub) this.dataHub.sources(m); break;
      case 'data_connect': if (this.dataHub) this.dataHub.connect(m); break;
      case 'data_disconnect': if (this.dataHub) this.dataHub.disconnect(m.sub); break;
      case 'host_file': break;
      default: break;
    }
    return true;
  }
  xferData(m) {
    const dest = (m.dir === '/' ? '' : m.dir) + '/' + m.name;
    if (this.fs.exists(dest) && !m.overwrite) {
      const id = 'x' + this.nextXfer++;
      this.xfers.set(id, m);
      if (this.hooks.xferConflict) this.hooks.xferConflict(id, m);
      else this.xferDecide(id, false);
      return;
    }
    this.xferCommit(m, dest);
  }
  xferCommit(m, dest) {
    this.charge(m.text.length >> 4);
    const r = this.fs.write(dest, m.text);
    if (r === true) { if (this.hooks.notify) this.hooks.notify('info', `已从 ${m.from} 接收文件 ${dest}`); }
    else {
      if (this.hooks.notify) this.hooks.notify('error', `接收 ${m.name} 失败：${r.error}`);
      if (m.reply !== 'outer') this.route({ dst: m.reply, op: 'xfer_result', ok: false, text: `传递到 outer 失败：${r.error}` });
    }
  }
  xferDecide(id, yes) {
    const m = this.xfers.get(id);
    if (!m) return;
    this.xfers.delete(id);
    if (yes) this.xferCommit(m, (m.dir === '/' ? '' : m.dir) + '/' + m.name);
    else if (this.hooks.notify) this.hooks.notify('info', `已取消接收 ${m.name}`);
  }
  // 在两个系统的文件管理器之间传递文件。source / target 是系统路径。
  transfer(source, paths, target, dir) {
    if (source === target) return;
    if (source === 'outer') {
      for (const p of paths) {
        const t = this.fs.read(p);
        if (t === null) { if (this.hooks.notify) this.hooks.notify('error', '暂不支持传递目录：' + p); continue; }
        this.route({ dst: target, op: 'xfer_data', dir, name: basenameOf(p), text: t, from: 'outer', from_path: p, reply: 'outer' });
      }
      return;
    }
    this.route({ dst: source, op: 'xfer_start', paths, target, dir, reply: target === 'outer' ? 'outer' : source });
  }
  systemDescendants(id) {
    const out = [];
    const rec = (x) => { for (const s of this.systems.values()) if (s.parentId === x) { out.push(s.id); rec(s.id); } };
    rec(id);
    return out;
  }

  hostOp(m) {
    const D = this.device;
    switch (m.op) {
      case 'ui': return D.commit(m.sys, m.sid, m.tree);
      case 'ui_patch': return D.patch(m.sys, m.sid, m.key, m.props);
      case 'ui_focus': return D.focusNode(m.sys, m.sid, m.key);
      case 'surface_drop': return D.surfaceDrop(m.sys, m.sid);
      case 'meta': return D.meta(m.sys, m.kind, m.data);
      case 'gfx_open': return D.gfxOpen(m.sys, m.vid, m.text);
      case 'gfx_frame': return D.gfxFrame(m.sys, m.vid, m.frame, m.meta);
      case 'gfx_close': return D.gfxClose(m.sys, m.vid);
      case 'gfx_pick': return D.gfxPick(m.sys, m.vid, m.x, m.y);
      case 'alloc_id': return 'inner-' + this.nextInner++;
      case 'sys_state': {
        if (m.state === 'closed') { this.systems.delete(m.target); }
        else {
          const prev = this.systems.get(m.target);
          this.systems.set(m.target, { id: m.target, parentId: m.parent, name: m.name, state: m.state, path: m.path, err: m.err || null });
          void prev;
        }
        D.sysState(m.target, m.state, m.err);
        if (this.hooks.systemsChanged) this.hooks.systemsChanged();
        return true;
      }
      case 'subtree_ids': return [m.target, ...this.systemDescendants(m.target)];
      case 'drop_subtree': return this.dropSubtree(m.target, m.keep_self, m.reason, m.keep_proj);
      case 'dev_export': return this.devExport(m.target);
      case 'dev_import': return this.devImport(m);
      case 'remap_value': return remapValue(m.value, m.remap);
      case 'proj_reg': this.projections.set(m.proj.id, m.proj); return true;
      case 'proj_unreg': this.projections.delete(m.id); return true;
      case 'proj_external': return this.projExternal(m.scope);
      case 'host_export': return this.hooks.hostExport ? this.hooks.hostExport(m.name, m.text) : { error: '不支持' };
      case 'host_import': if (this.hooks.hostImport) this.hooks.hostImport(m); return true;
      case 'host_paths': return this.hooks.hostPaths ? this.hooks.hostPaths() : {};
      case 'kernel_note': if (this.hooks.notify) this.hooks.notify('error', m.text); return true;
      default: return { error: '未知设备操作 ' + m.op };
    }
  }

  dropSubtree(target, keepSelf, reason, keepProj) {
    const desc = this.systemDescendants(target);
    const scope = [target, ...desc];
    const inScope = new Set(scope);
    for (const [id, pj] of [...this.projections]) {
      if (!inScope.has(pj.src_sys)) continue;
      const targetInside = scope.some((s) => this.systems.get(s) && (this.systems.get(s).path === pj.target));
      if (targetInside) { this.projections.delete(id); continue; }
      if (keepProj) continue;
      this.projections.delete(id);
      this.route({ dst: pj.target, op: 'proj_close', id, reason: reason || '实例已停止' });
    }
    if (this.dataHub) this.dataHub.dropScope(scope);
    for (const s of desc) { this.device.dropInstance(s); this.systems.delete(s); }
    this.device.dropInstance(target, keepSelf);
    if (!keepSelf) this.systems.delete(target);
    if (this.hooks.systemsChanged) this.hooks.systemsChanged();
    return true;
  }
  devExport(target) {
    const ids = [target, ...this.systemDescendants(target)];
    const sysRecs = ids.map((i) => this.systems.get(i)).filter(Boolean);
    const scope = new Set(ids);
    const projs = [...this.projections.values()].filter((p) => scope.has(p.src_sys) && sysRecs.some((s) => s.path === p.target));
    return { ...this.device.exportInstances(ids), systems: sysRecs, projs };
  }
  devImport(m) {
    const data = m.remap ? remapValue(m.data, m.remap) : m.data;
    for (const s of data.systems) {
      if (s.id !== (m.remap ? remapStr(m.remap, m.target) : m.target) || true) this.systems.set(s.id, { ...s });
    }
    for (const p of data.projs || []) this.projections.set(p.id, p);
    this.device.importInstances(data);
    if (this.hooks.systemsChanged) this.hooks.systemsChanged();
    return true;
  }
  // 恢复后：范围外的投送外框继续对应同一源窗口；源窗口不再存在时投送结束
  projExternal(scopePath) {
    const out = [];
    for (const [id, pj] of [...this.projections]) {
      if (pj.src_path !== scopePath && !pj.src_path.startsWith(scopePath + '/')) continue;
      if (pj.target === scopePath || pj.target.startsWith(scopePath + '/')) continue;
      if (!this.device.hasWindow(pj.src_sys, pj.src_win)) {
        this.projections.delete(id);
        this.route({ dst: pj.target, op: 'proj_close', id, reason: '源窗口在恢复后已不存在' });
        continue;
      }
      out.push(pj);
    }
    return out;
  }

  // —— 直属子系统管理 ——
  childDefaults() {
    return { rate: 1, grant: Math.floor(this.cfg.budget / 2), budget: Math.floor(this.cfg.budget / 2), mem: Math.floor(this.cfg.mem / 4), storage: Math.floor(this.fs.limit / 4) };
  }
  childInfo(c) {
    const p = this.procs.get(c.pid);
    const ctx = p && p.ctx;
    if (ctx) refreshMem(ctx);
    return {
      id: c.id, name: c.name, path: c.path, depth: c.depth, state: c.state, rate: c.rate, grant: c.grant, budget: c.budget, mem: c.mem, storage: c.storage, err: c.err, pid: c.pid,
      kernel: `/Systems/${c.id}/kernel.nest`, disk_used: c.diskUsed, used: ctx ? ctx.used : 0, own: ctx ? ctx.used - ctx.kidUsed : 0, inner: ctx ? ctx.kidUsed : 0, mem_used: ctx ? ctx.memTotal : 0, avg: p ? Math.floor(p.avg) : 0, parent: 'outer',
    };
  }
  childSetState(c, state, err) {
    c.state = state; c.err = err || null;
    this.systems.set(c.id, { id: c.id, parentId: 'outer', name: c.name, state, path: c.path, err: c.err });
    this.device.sysState(c.id, state, c.err);
    if (this.hooks.childState) this.hooks.childState(this.childInfo(c));
    if (this.hooks.systemsChanged) this.hooks.systemsChanged();
  }
  saveTree() {
    const out = [...this.children.values()].map((c) => ({ id: c.id, name: c.name, rate: c.rate, grant: c.grant, budget: c.budget, mem: c.mem, storage: c.storage, stopped: c.state === 'stopped' }));
    this.fs.write('/Systems/tree.json', JSON.stringify(out));
  }
  newChild(o = {}) {
    const id = o.id || this.hostOp({ op: 'alloc_id' });
    const d = this.childDefaults();
    const c = {
      id, name: o.name || id, path: 'outer/' + id, depth: 2, state: 'booting', rate: o.rate ?? d.rate, grant: o.grant ?? d.grant, budget: o.budget ?? d.budget, mem: o.mem ?? d.mem, storage: o.storage ?? d.storage,
      paused: false, stepping: false, stepReq: 0, pendingDt: 0, inbox: [], pid: 0, err: null, diskUsed: 0, w: o.w || 1000, h: o.h || 640,
    };
    this.children.set(id, c);
    this.fs.mkdirs(`/Systems/${id}/disk`);
    if (!this.fs.exists(`/Systems/${id}/kernel.nest`)) {
      const r = this.fs.copy('/System/kernel.nest', `/Systems/${id}/kernel.nest`);
      if (r !== true) { this.children.delete(id); return { error: '创建失败：' + r.error }; }
    }
    this.saveTree();
    this.systems.set(id, { id, parentId: 'outer', name: c.name, state: 'booting', path: c.path, err: null });
    if (this.hooks.childNew) this.hooks.childNew(this.childInfo(c));
    this.childBoot(c);
    return id;
  }
  childBoot(c) {
    c.state = 'booting'; c.err = null; c.pendingDt = 0; c.inbox = []; c.paused = false; c.diskUsed = c.diskUsed || 0;
    this.childSetState(c, 'booting');
    this.requestImage(`/Systems/${c.id}/kernel.nest`, (image, err) => {
      if (!this.children.has(c.id)) return;
      if (!image) {
        this.childSetState(c, 'error', '内核编译失败：' + err);
        if (this.hooks.notify) this.hooks.notify('error', `${c.id} 内核错误：${err}`);
        return;
      }
      const args = { id: c.id, name: c.name, path: c.path, depth: c.depth, parent: 'outer', parent_path: 'outer', budget: c.budget, mem: c.mem, storage: c.storage, w: c.w, h: c.h };
      const p = this.newProcess(image, args, { name: '内核 ' + c.id, path: `/Systems/${c.id}/kernel.nest`, kind: 'host', child: c.id, priv: true, mem: c.mem, quota: c.grant });
      c.pid = p.pid;
      this.childSetState(c, 'running');
    });
  }
  childKillProc(c) {
    const p = this.procs.get(c.pid);
    if (p && p.ctx) {
      const saved = p.child;
      p.child = null;
      this.procEnd(p, 'exited', null, '实例已停止');
      p.child = saved;
    }
    c.pid = 0;
  }
  childOnExit(c, state, err) {
    if (!c) return;
    c.pid = 0;
    if (state === 'fault') {
      this.dropSubtree(c.id, true, '内核错误');
      this.childSetState(c, 'error', '内核错误：' + err);
      if (this.hooks.notify) this.hooks.notify('error', `${c.id} 内核错误：${err}`);
    } else if (c.state !== 'stopped') {
      this.dropSubtree(c.id, true, '实例已停止');
      this.childSetState(c, 'stopped', err);
    }
  }
  childStop(c, reason) {
    this.childKillProc(c);
    this.dropSubtree(c.id, true, reason || '实例已停止');
    this.childSetState(c, 'stopped');
    this.saveTree();
  }
  sysctl(op, id, a, b) {
    if (op === 'new') return this.newChild(id || {});
    if (op === 'list') return [...this.children.values()].map((c) => this.childInfo(c));
    if (op === 'fork') return this.childFork(id, a);
    if (op === 'snapshots') { const l = this.fs.list('/Snapshots'); return Array.isArray(l) ? l : []; }
    const c = this.children.get(id);
    if (!c) return { error: '没有直属子系统 ' + id };
    switch (op) {
      case 'pause': c.paused = true; this.childSetState(c, 'paused'); return true;
      case 'resume': {
        c.paused = false;
        const pr = this.procs.get(c.pid);
        if (pr) { pr.suspended = false; this.enqueue(pr); }
        this.childSetState(c, 'running');
        return true;
      }
      case 'step':
        if (!c.paused) return { error: '只有暂停的直属子系统可以单步' };
        c.stepReq++; return true;
      case 'rate': c.rate = a; if (this.hooks.childState) this.hooks.childState(this.childInfo(c)); return true;
      case 'stop': this.childStop(c, '实例已停止'); return true;
      case 'start': if (!c.pid) this.childBoot(c); return true;
      case 'restart':
        this.childKillProc(c);
        this.dropSubtree(c.id, true, '实例已重启');
        this.childBoot(c);
        return true;
      case 'close':
        this.childKillProc(c);
        this.dropSubtree(c.id, false, '实例已关闭');
        this.fs.remove(`/Systems/${c.id}`);
        this.children.delete(c.id);
        this.saveTree();
        if (this.hooks.childClosed) this.hooks.childClosed(c.id);
        return true;
      case 'snapshot': return this.childSnapshot(c, a);
      case 'restore': return this.childRestore(c, a);
      case 'grant': {
        c.grant = a;
        const pr = this.procs.get(c.pid);
        if (pr) { pr.quota = a; pr.quotaLeft = a; }
        if (this.hooks.childState) this.hooks.childState(this.childInfo(c));
        this.saveTree();
        return true;
      }
      case 'config': {
        if (a.mem) { c.mem = a.mem; const pr = this.procs.get(c.pid); if (pr && pr.ctx) pr.ctx.memLimit = a.mem; }
        if (a.storage) c.storage = a.storage;
        if (a.budget) c.budget = a.budget;
        c.inbox.push(fromHost({ op: 'cfg', cfg: a }));
        this.saveTree();
        return true;
      }
      case 'input': c.inbox.push(fromHost({ op: 'input', ev: a })); return true;
      case 'resize': c.w = a; c.h = b; c.inbox.push(fromHost({ op: 'resize', w: a, h: b })); return true;
      case 'kernel_path': return `/Systems/${c.id}/kernel.nest`;
      default: return { error: '未知操作 ' + op };
    }
  }
  // —— 快照 ——
  childSnapshot(c, file) {
    const p = this.procs.get(c.pid);
    if (!p || !p.ctx) return { error: '实例没有运行，不能保存快照' };
    const ctxText = serializeCtx(p.ctx);
    this.charge(ctxText.length >> 4);
    const rec = {
      kind: 'nest-snapshot', v: 1, id: c.id, name: c.name, path: c.path, depth: c.depth, parent_path: 'outer', parent_vtime: this.vtime,
      ids: [c.id, ...this.systemDescendants(c.id)], rate: c.rate, paused: c.paused, pending_dt: c.pendingDt, inbox: c.inbox,
      budget: c.budget, mem: c.mem, storage: c.storage,
      proc: { state: p.state, wait: p.wait, wake_at: p.wakeAt, mq: p.mq, suspended: p.suspended, avg: p.avg, msgs_in: p.msgsIn, msgs_out: p.msgsOut },
      ctx: ctxText, dev: this.devExport(c.id), files: this.fs.walk(`/Systems/${c.id}`, '', []),
    };
    const name = file || `/Snapshots/${c.id}-${this.ticks}.snap`;
    const text = JSON.stringify(rec);
    this.charge(text.length >> 4);
    const r = this.fs.write(name, text);
    if (r !== true) return r;
    if (this.hooks.notify) this.hooks.notify('info', `已保存 ${c.id} 的快照：${name}`);
    return name;
  }
  writeSnapshotFiles(id, files) {
    const dir = `/Systems/${id}`;
    if (this.fs.exists(dir)) this.fs.remove(dir);
    this.fs.mkdirs(dir);
    for (const [rel, text] of files) {
      if (text === null) this.fs.mkdirs(dir + rel);
      else { const r = this.fs.write(dir + rel, text); if (r !== true) return r; }
    }
    return true;
  }
  installSnapshotProc(c, rec, remap) {
    const ctx = deserializeCtx(rec.ctx, remap);
    const pid = this.nextPid++;
    const pr = rec.proc;
    const p = {
      pid, name: '内核 ' + c.id, path: `/Systems/${c.id}/kernel.nest`, ctx, state: pr.state === 'running' ? 'ready' : pr.state, wait: pr.wait, wakeAt: pr.wake_at, mq: [], suspended: pr.suspended, inq: false,
      kind: 'host', ppid: 0, group: pid, leader: true, quota: c.grant, quotaLeft: c.grant, stdout: 0, child: c.id, tickUsed: 0, avg: pr.avg, msgsIn: pr.msgs_in, msgsOut: pr.msgs_out, remaining: 0, error: null, started: this.vtime,
    };
    this.procs.set(pid, p);
    c.pid = pid;
    this.enqueue(p);
  }
  childRestore(c, file) {
    const text = this.fs.read(file);
    if (text === null) return { error: '快照文件不存在：' + file };
    let rec;
    try { rec = fromHost(JSON.parse(text)); } catch (e) { return { error: '快照文件损坏：' + e.message }; }
    if (rec.kind !== 'nest-snapshot') return { error: '不是快照文件' };
    this.childKillProc(c);
    this.dropSubtree(c.id, true, '恢复快照', true);
    let remap = null;
    if (rec.id !== c.id || rec.parent_path !== 'outer') { remap = { [rec.id]: c.id, '@from': rec.parent_path, '@to': 'outer' }; }
    const w = this.writeSnapshotFiles(c.id, rec.files);
    if (w !== true) { this.childSetState(c, 'error', '恢复失败：' + w.error); return w; }
    c.rate = rec.rate; c.paused = rec.paused; c.pendingDt = rec.pending_dt; c.inbox = rec.inbox; c.stepping = false; c.stepReq = 0;
    this.installSnapshotProc(c, rec, remap);
    this.devImport({ target: c.id, data: rec.dev, remap });
    const ext = this.projExternal(c.path);
    c.inbox.push(fromHost({ op: 'restored', mode: 'restore', scope: c.path, ext }));
    this.childSetState(c, c.paused ? 'paused' : 'running');
    if (this.hooks.notify) this.hooks.notify('info', `已恢复 ${c.id}（${file}）`);
    return true;
  }
  childFork(file) {
    const text = this.fs.read(file);
    if (text === null) return { error: '快照文件不存在：' + file };
    let rec;
    try { rec = fromHost(JSON.parse(text)); } catch (e) { return { error: '快照文件损坏：' + e.message }; }
    if (rec.kind !== 'nest-snapshot') return { error: '不是快照文件' };
    const remap = Object.create(null);
    for (const old of rec.ids) remap[old] = this.hostOp({ op: 'alloc_id' });
    remap['@from'] = rec.parent_path; remap['@to'] = 'outer';
    const id = remap[rec.id];
    const c = {
      id, name: id, path: 'outer/' + id, depth: 2, state: 'running', rate: rec.rate, grant: this.childDefaults().grant, budget: rec.budget, mem: rec.mem, storage: rec.storage,
      paused: rec.paused, stepping: false, stepReq: 0, pendingDt: rec.pending_dt, inbox: remapValue(rec.inbox, remap), pid: 0, err: null, diskUsed: 0, w: 1000, h: 640,
    };
    this.children.set(id, c);
    const w = this.writeSnapshotFiles(id, rec.files);
    if (w !== true) { this.children.delete(id); return w; }
    this.installSnapshotProc(c, rec, remap);
    this.systems.set(id, { id, parentId: 'outer', name: id, state: c.paused ? 'paused' : 'running', path: c.path, err: null });
    if (this.hooks.childNew) this.hooks.childNew(this.childInfo(c));
    this.devImport({ target: id, data: rec.dev, remap, fork: true });
    c.inbox.push(fromHost({ op: 'restored', mode: 'fork', scope: c.path, ext: [] }));
    this.saveTree();
    this.childSetState(c, c.paused ? 'paused' : 'running');
    if (this.hooks.notify) this.hooks.notify('info', `已从快照分叉出 ${id}`);
    return id;
  }
  resetAll() {
    for (const c of [...this.children.values()]) { try { this.sysctl('close', c.id); } catch (e) { console.error(e); } }
    for (const p of [...this.procs.values()]) if (p.ctx) this.procEnd(p, 'exited', null, '重置');
    this.procs.clear(); this.runq = []; this.sleepers = []; this.dead = []; this.throttled = [];
    this.children.clear(); this.systems.clear();
    this.systems.set('outer', { id: 'outer', parentId: null, name: '根系统', state: 'running', path: 'outer' });
    this.nextInner = 1; this.nextPid = 1;
    this.projections.clear(); this.bus = {}; this.jobs.clear(); this.rebuilding = false; this.imgQueue = []; this.compilerBad = '';
    this.vtime = 0; this.ticks = 0; this.cfg.budget = 600000;
  }
}
RootKernel.BLOCK = { block: true };

function nbcHeader(text) {
  const i = text.indexOf('\n');
  if (i < 0) return null;
  try { return JSON.parse(text.slice(0, i)); } catch { return null; }
}
function remapStr(map, s) { return map[s] !== undefined ? map[s] : s; }
void Image; void ST_EXIT; void ST_FAULT; void ST_TRAP;
