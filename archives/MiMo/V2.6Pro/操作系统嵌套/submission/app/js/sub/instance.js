/* instance.js — Subsystem instance: carrier process that runs a kernel program.
   The kernel program (in the parent's VFS) manages this system's processes,
   files, messages, display and input. Host provides the execution device. */
import { VFS } from '../vfs.js';
import { parse, Interp } from '../vm/ks.js';
import { deepClone, uid } from '../utils.js';
import { Composite2D } from '../host/display.js';
import { makeWallpaper, getIcon } from '../host/wallpaper.js';
import { DEFAULT_KERNEL_SRC, DEFAULT_PROGRAMS, SUB_APP_SRC, installSubAppSources } from './kernel-src.js';
import { Scene3D } from '../scene/scene3d.js';
import { buildHelicopterScene } from '../scene/heli-scene.js';

let globalSubCount = 0;

export class SubInstance {
  constructor(opts) {
    this.id = opts.id;
    this.parentId = opts.parentId;
    this.parent = opts.parent;
    this.level = opts.level || 1;
    this.name = opts.name || opts.id;
    this.state = 'running'; // running | paused | error | closed
    this.budgetGrant = opts.budgetGrant || 1500;
    this.virtualTime = 0;
    this.rate = 1;
    this.vfs = new VFS(this.id);
    this.vfs.seed();
    this.kernelInterp = null;
    this.kernelError = null;
    this.kernelSrcPath = '/System/kernel.ks';
    this.displayFrame = [];
    this.inputQueue = [];
    this.pendingSyscalls = [];  // from user procs to kernel
    this.syscallResults = new Map();
    this.userProcs = new Map(); // pid -> { interp, name, state, ... }
    this.msgQueues = {};
    this.nextPid = 1;
    this.stats = { kernel: 0, user: 0 };
    this.windowEl = null;
    this.canvas = null;
    this.compositor = null;
    this.scene3d = null;
    this.grantUsed = 0;
    this.stepSizeMs = 16; // one logical step = 16ms virtual
    this.settings = { wallpaper: 'aurora', accent: '#7aa2ff' };
    this.subscriptions = []; // chart data connections INTO this system
    this.projections = [];   // projections OUT of this system
    this.recordings = new Map();
    this._tickAccum = 0;
    this._pendingKernelInject = undefined;
    this._hasKernelInject = false;
    this._procMeta = new Map();
  }

  now() { return this.virtualTime; }
  procCount() { return this.userProcs.size + 1; }

  /* ---------- boot ---------- */
  boot() {
    this._seedSystemFiles();
    this._startKernel();
  }

  _seedSystemFiles() {
    const v = this.vfs;
    v.mkdir('/System');
    v.mkdir('/System/Programs');
    v.mkdir('/Demo');
    v.mkdir('/Documents');
    // kernel source (copy from parent's copy if present, else default)
    let src = DEFAULT_KERNEL_SRC;
    try {
      const parentCopy = this.parent.vfs.read(this.kernelSrcPath);
      if (typeof parentCopy === 'string' && parentCopy.length > 50) src = parentCopy;
    } catch (e) { }
    v.write(this.kernelSrcPath, src);
    // also store in parent's VFS so it can be edited there
    try {
      if (!this.parent.vfs.exists(this.kernelSrcPath)) {
        this.parent.vfs.write(this.kernelSrcPath, src);
      }
    } catch (e) { }

    for (const [name, content] of Object.entries(DEFAULT_PROGRAMS)) {
      v.write('/System/Programs/' + name, content);
    }
    installSubAppSources(v);
    // scene resource
    v.write('/Demo/helicopter-24.scene', buildHelicopterScene());
    v.write('/Demo/说明.txt',
      '本目录存放示例场景资源。\n' +
      'helicopter-24.scene 为 24 号直升机三维场景。\n' +
      '排演记录保存为 .rec 文件。\n');
    v.write('/Documents/欢迎.txt',
      '子系统 ' + this.id + ' 已就绪。\n' +
      '双击桌面图标打开应用。可用“系统管理”创建下一层子系统。\n');
  }

  _startKernel() {
    let src;
    try {
      src = this.vfs.readText(this.kernelSrcPath);
    } catch (e) {
      src = DEFAULT_KERNEL_SRC;
    }
    let ast;
    try {
      ast = parse(src);
    } catch (e) {
      this.state = 'error';
      this.kernelError = '内核编译错误: ' + e.message;
      this._refreshErrorBadge();
      return;
    }
    this.kernelInterp = new Interp(this._makeKernelBuiltins());
    this.kernelInterp.start(ast);
    this.state = 'running';
    this.kernelError = null;
    this._refreshErrorBadge();
  }

  _makeKernelBuiltins() {
    const self = this;
    const K = {
      now: () => self.virtualTime,
      log: (...a) => { console.log('[' + self.id + ']', ...a); return null; },
      /* storage = this system's VFS */
      storageRead: (p) => {
        try {
          const c = self.vfs.read(p);
          return typeof c === 'string' ? c : JSON.stringify(c);
        } catch (e) { return null; }
      },
      storageWrite: (p, d) => {
        try {
          let val = d;
          if (typeof d === 'string') {
            try { val = JSON.parse(d); } catch (e) { val = d; }
          }
          self.vfs.write(p, val);
          return true;
        } catch (e) { return false; }
      },
      storageList: (p) => {
        try { return self.vfs.list(p); } catch (e) { return []; }
      },
      storageDelete: (p) => {
        try { self.vfs.delete(p); return true; } catch (e) { return false; }
      },
      storageMkdir: (p) => {
        try { self.vfs.mkdir(p); return true; } catch (e) { return false; }
      },
      storageRename: (a, b) => {
        try { self.vfs.rename(a, b); return true; } catch (e) { return false; }
      },
      storageStat: (p) => self.vfs.stat(p),
      storageBytes: () => self.vfs.totalBytes(),
      /* display */
      submitDisplay: (frame) => {
        self.displayFrame = Array.isArray(frame) ? frame : [frame];
        return true;
      },
      /* input */
      readInput: () => {
        if (self.inputQueue.length) return self.inputQueue.shift();
        return null;
      },
      inputCount: () => self.inputQueue.length,
      /* time */
      stepTime: (ms) => {
        // called by kernel to advance its own clock gate
        return true;
      },
      /* process management (kernel-level) */
      procList: () => {
        return [...self.userProcs.entries()].map(([pid, p]) => ({
          pid, name: p.name, state: p.state, used: p.used, mem: p.mem || 0,
          error: p.error || null
        }));
      },
      procStart: (name, source, args) => {
        return self._startUserProc(name, source, args);
      },
      procKill: (pid) => {
        return self.userProcs.delete(pid);
      },
      procSuspend: (pid) => {
        const p = self.userProcs.get(pid);
        if (p) { p.state = 'suspended'; return true; }
        return false;
      },
      procResume: (pid) => {
        const p = self.userProcs.get(pid);
        if (p && p.state === 'suspended') { p.state = 'ready'; return true; }
        return false;
      },
      runProcess: (pid, budget) => {
        return self._runUserProc(pid, budget);
      },
      /* kernel syscall channel */
      getSyscall: () => {
        if (self.pendingSyscalls.length) return self.pendingSyscalls.shift();
        return null;
      },
      returnSyscall: (pid, result) => {
        self.syscallResults.set(pid, result);
        return true;
      },
      /* budget info */
      budgetLeft: () => Math.max(0, self.budgetGrant - self.grantUsed),
      charge: (n) => { self.grantUsed += (n || 1); return true; },
      /* message primitives (policy lives in kernel.ks) */
      deliver: (to, msg) => {
        if (!self.msgQueues[to]) self.msgQueues[to] = [];
        self.msgQueues[to].push(msg);
        const p = self.userProcs.get(to);
        if (p && p.waiting === 'recv') {
          p.pendingInject = msg;
          self.msgQueues[to].pop(); // consumed by the pending recv
          p.waiting = null;
          p.state = 'ready';
        }
        return true;
      },
      takeMsg: (pid) => {
        const q = self.msgQueues[pid];
        if (q && q.length) return q.shift();
        return null;
      },
      sleepRecv: (pid) => {
        const p = self.userProcs.get(pid);
        if (p) { p.state = 'waiting'; p.waiting = 'recv'; }
        return true;
      },
      wakeRecv: (pid) => {
        const p = self.userProcs.get(pid);
        if (p && p.waiting === 'recv') { p.state = 'ready'; p.waiting = null; }
        return true;
      },
      procAlive: (pid) => {
        return self.userProcs.has(pid);
      },
      /* child subsystem management */
      childCount: () => self.children ? self.children.size : 0,
      /* data connections for charts */
      pushData: (connId, payload) => {
        if (self.onDataPush) self.onDataPush(connId, payload);
        return true;
      },
      /* projection */
      requestProjection: (winId, targetSystemId, appId) => {
        if (self.onProjectionRequest) self.onProjectionRequest(winId, targetSystemId, appId);
        return true;
      },
      /* 3D scene */
      submitScene: (viewId, sceneState) => {
        if (self.scene3d) self.scene3d.submit(viewId, sceneState);
        return true;
      },
      /* measurements */
      nowReal: () => performance.now()
    };
    return { kern: K, sys: K };
  }

  /* ---------- user process execution ---------- */
  _startUserProc(name, source, args) {
    const pid = this.nextPid++;
    let ast;
    try {
      ast = typeof source === 'string' ? parse(source) : source;
    } catch (e) {
      return { ok: false, error: '编译错误: ' + e.message, pid: -1 };
    }
    const interp = new Interp(this._makeUserBuiltins(pid));
    interp.start(ast);
    const proc = {
      pid, name, interp, state: 'ready', used: 0, mem: 0,
      error: null, waiting: null, args: args || null
    };
    this.userProcs.set(pid, proc);
    return { ok: true, pid };
  }

  _makeUserBuiltins(pid) {
    const self = this;
    const proc = () => self.userProcs.get(pid);
    const U = {
      time: () => self.virtualTime,
      now: () => self.virtualTime,
      pid: () => pid,
      args: () => { const p = proc(); return p ? p.args : null; },
      wait: (ms) => ({ ksSuspend: true, type: 'wait', ms }),
      log: (...a) => { console.log('[' + self.id + ':' + pid + ']', ...a); return null; },
      readFile: (p) => ({ ksSuspend: true, type: 'syscall', request: { name: 'readFile', path: p } }),
      writeFile: (p, d) => ({ ksSuspend: true, type: 'syscall', request: { name: 'writeFile', path: p, data: d } }),
      listDir: (p) => ({ ksSuspend: true, type: 'syscall', request: { name: 'listDir', path: p } }),
      send: (to, msg) => ({ ksSuspend: true, type: 'syscall', request: { name: 'send', to, msg } }),
      recv: () => ({ ksSuspend: true, type: 'syscall', request: { name: 'recv' } }),
      spawn: (prog, a) => ({ ksSuspend: true, type: 'syscall', request: { name: 'spawn', prog, args: a } }),
      submit2d: (cmds, winId) => ({ ksSuspend: true, type: 'syscall', request: { name: 'submit2d', cmds, winId } }),
      submit3d: (scene, viewId) => ({ ksSuspend: true, type: 'syscall', request: { name: 'submit3d', scene, viewId } }),
      charge: (n) => { self.grantUsed += (n || 1); return true; },
      /* process queries via syscall */
      procList: () => ({ ksSuspend: true, type: 'syscall', request: { name: 'procList' } }),
      procCount: () => self.userProcs.size
    };
    return { sys: U };
  }

  _runUserProc(pid, budget) {
    const p = this.userProcs.get(pid);
    if (!p) return { status: 'gone', used: 0 };
    if (p.state === 'suspended') return { status: 'suspended', used: 0 };
    // pending inject (e.g. recv woke with a message)
    if (p.pendingInject !== undefined) {
      const val = p.pendingInject;
      p.pendingInject = undefined;
      p.waiting = null;
      p.state = 'ready';
      const r = p.interp.run(budget, val);
      return this._procRunResult(p, r, budget);
    }
    if (p.state === 'waiting') {
      // deliver pending syscall result if any
      if (p.waiting === 'syscall' && this.syscallResults.has(pid)) {
        const result = this.syscallResults.get(pid);
        this.syscallResults.delete(pid);
        p.waiting = null;
        p.state = 'ready';
        const r = p.interp.run(budget, result);
        return this._procRunResult(p, r, budget);
      }
      if (p.waiting === 'wait' && p.waitUntil <= this.virtualTime) {
        p.waiting = null;
        p.state = 'ready';
        const r = p.interp.run(budget);
        return this._procRunResult(p, r, budget);
      }
      return { status: 'waiting', used: 0 };
    }
    // ready: run
    const r = p.interp.run(budget);
    return this._procRunResult(p, r, budget);
  }

  _procRunResult(p, r, budget) {
    p.used = (p.used || 0) + (r.instr || 0);
    this.stats.user += (r.instr || 0);
    this.grantUsed += (r.instr || 0);
    if (r.status === 'done') {
      p.state = 'ended';
      return { status: 'done', value: r.value, used: r.instr };
    }
    if (r.status === 'error') {
      p.state = 'error';
      p.error = r.error;
      return { status: 'error', error: r.error, used: r.instr };
    }
    if (r.status === 'budget') {
      p.state = 'ready';
      return { status: 'budget', used: r.instr };
    }
    if (r.status === 'suspend') {
      const s = r.suspend;
      if (s.type === 'syscall') {
        p.state = 'waiting';
        p.waiting = 'syscall';
        this.pendingSyscalls.push({ pid: p.pid, ...s.request });
        return { status: 'syscall', request: { pid: p.pid, ...s.request }, used: r.instr };
      }
      if (s.type === 'wait') {
        p.state = 'waiting';
        p.waiting = 'wait';
        p.waitUntil = this.virtualTime + (s.ms || 0);
        return { status: 'wait', ms: s.ms, used: r.instr };
      }
      p.state = 'ready';
      return { status: 'suspend', used: r.instr };
    }
    return { status: 'budget', used: r.instr };
  }

  /* ---------- host tick (called by parent's clock) ---------- */
  hostTick(dtParentMs) {
    if (this.state !== 'running') return;
    this.grantUsed = 0;
    // advance virtual time
    this.virtualTime += dtParentMs * this.rate;

    // run kernel program with budget
    if (!this.kernelInterp || this.kernelInterp.done) return;
    const maxSteps = Math.min(20000, Math.max(200, this.budgetGrant));
    let inject;
    let hasInject = false;
    if (this._hasKernelInject) {
      inject = this._pendingKernelInject;
      this._hasKernelInject = false;
      this._pendingKernelInject = undefined;
      hasInject = true;
    }
    let r;
    try {
      r = hasInject ? this.kernelInterp.run(maxSteps, inject) : this.kernelInterp.run(maxSteps);
    } catch (e) {
      this.state = 'error';
      this.kernelError = '内核运行错误: ' + (e.message || e);
      this._refreshErrorBadge();
      return;
    }
    this.stats.kernel += (r.instr || 0);
    this.grantUsed += (r.instr || 0);
    if (r.status === 'error') {
      this.state = 'error';
      this.kernelError = r.error;
      this._refreshErrorBadge();
    } else if (r.status === 'suspend') {
      const s = r.suspend;
      if (s.type === 'wait') {
        // kernel itself waiting — resume next tick
      } else if (s.type === 'syscall') {
        // kernel requesting host service (shouldn't normally happen with kern.* direct)
        const result = this._handleHostSyscall(s.request);
        this._pendingKernelInject = result;
        this._hasKernelInject = true;
      }
    } else if (r.status === 'done') {
      // kernel main loop exited — restart it (kernels are infinite loops)
      this._startKernel();
    }
    // present the submitted display frame
    this.renderDisplay();
    this._updateBanner();
  }

  _handleHostSyscall(req) {
    // host-side fallback for sys.* used directly in kernel
    if (!req) return null;
    if (req.name === 'readFile') {
      try { return { ok: true, data: this.vfs.read(req.path) }; }
      catch (e) { return { ok: false, error: e.message }; }
    }
    return { ok: false, error: '未知请求' };
  }

  /* ---------- UI / window for subsystem desktop ---------- */
  openWindow() {
    if (this.windowEl && !this.windowEl.__dead) {
      const w = this.parent.windows.get(this.windowId);
      if (w) {
        w.restore();
        w.focus();
        return w;
      }
    }
    const self = this;
    const win = this.parent.createWindow({
      appId: 'system-window',
      title: `${this.name} (${this.id})`,
      icon: 'system',
      w: 960, h: 620,
      className: 'system-window',
      onClose: () => {
        this.parent.closeSubsystem(this.id);
        return false; // parent close flow handles removal
      },
      onResize: (w, h) => {
        this._resizeCanvas(w, h);
      }
    });
    this.windowId = win.id;
    this.windowEl = win.body;
    this.windowEl.__dead = false;
    this._buildInnerDesktop(win);
    return win;
  }

  _buildInnerDesktop(win) {
    const body = win.body;
    body.innerHTML = '';
    // banner
    const banner = document.createElement('div');
    banner.className = 'sys-banner';
    banner.setAttribute('data-system-id', this.id);
    this.bannerEl = banner;
    body.appendChild(banner);
    this._updateBanner();

    // canvas host
    const host = document.createElement('div');
    host.className = 'display-host';
    host.setAttribute('data-system-id', this.id);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-testid', 'os-desktop');
    canvas.setAttribute('data-system-id', this.id);
    host.appendChild(canvas);
    body.appendChild(host);
    this.canvas = canvas;
    this.canvasHost = host;

    this.compositor = new Composite2D(canvas);
    this.scene3d = new Scene3D(host, this);

    const w = win.contentW();
    const h = win.contentH() - 26;
    this._resizeCanvas(w, h);

    // input forwarding
    const rectOf = () => canvas.getBoundingClientRect();
    const toLocal = (e) => {
      const r = rectOf();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    canvas.addEventListener('mousemove', (e) => {
      const p = toLocal(e);
      this.inputQueue.push({ type: 'move', x: p.x, y: p.y, buttons: e.buttons });
      if (this.inputQueue.length > 200) this.inputQueue.splice(0, 100);
    });
    canvas.addEventListener('mousedown', (e) => {
      const p = toLocal(e);
      this.inputQueue.push({ type: 'down', x: p.x, y: p.y, button: e.button });
    });
    canvas.addEventListener('mouseup', (e) => {
      const p = toLocal(e);
      this.inputQueue.push({ type: 'up', x: p.x, y: p.y, button: e.button });
    });
    canvas.addEventListener('wheel', (e) => {
      const p = toLocal(e);
      this.inputQueue.push({ type: 'wheel', x: p.x, y: p.y, dy: e.deltaY });
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('dblclick', (e) => {
      const p = toLocal(e);
      this.inputQueue.push({ type: 'dblclick', x: p.x, y: p.y });
    });
  }

  _resizeCanvas(w, h) {
    if (this.compositor) this.compositor.resize(w, h);
    if (this.scene3d) this.scene3d.resize(w, h);
    this._canvasW = w;
    this._canvasH = h;
    // tell kernel the new size
    this.inputQueue.push({ type: 'resize', w, h });
  }

  _updateBanner() {
    if (!this.bannerEl) return;
    const stateText = this.state === 'running' ? '运行中' : this.state === 'paused' ? '已暂停' : '内核错误';
    const dotCls = this.state === 'running' ? 'dot' : this.state === 'paused' ? 'dot paused' : 'dot error';
    this.bannerEl.innerHTML = '';
    const add = (html) => { const s = document.createElement('span'); s.innerHTML = html; this.bannerEl.appendChild(s); };
    add(`<span class="${dotCls}"></span>`);
    add(`<b>${this.name}</b>`);
    add(`<span class="sep">|</span>`);
    add(`<span>${this.id}</span>`);
    add(`<span class="sep">|</span>`);
    add(`<span>${stateText}</span>`);
    add(`<span class="sep">|</span>`);
    add(`<span>时间 ${Math.floor(this.virtualTime / 1000)}s</span>`);
    if (this.kernelError) {
      add(`<span class="sep">|</span>`);
      add(`<span style="color:#ff8080" data-testid="kernel-error">${this.kernelError}</span>`);
    }
    const actions = document.createElement('div');
    actions.className = 'sys-actions';
    const mkBtn = (label, fn) => {
      const b = document.createElement('div');
      b.className = 'mini-btn';
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };
    if (this.state === 'paused') {
      actions.appendChild(mkBtn('继续', () => this.parent.resumeSubsystem(this.id)));
    } else {
      actions.appendChild(mkBtn('暂停', () => this.parent.pauseSubsystem(this.id)));
    }
    actions.appendChild(mkBtn('单步', () => this.parent.stepSubsystem(this.id)));
    actions.appendChild(mkBtn('重启', () => this.parent.restartSubsystem(this.id)));
    actions.appendChild(mkBtn('快照', () => this.parent.snapshotSubsystem(this.id)));
    this.bannerEl.appendChild(actions);
  }

  _refreshErrorBadge() {
    this._updateBanner();
    if (this.windowEl && this.state === 'error') {
      if (!this.windowEl.querySelector('.window-error-badge')) {
        const b = document.createElement('div');
        b.className = 'window-error-badge';
        b.textContent = '内核错误';
        this.windowEl.appendChild(b);
      }
    }
  }

  /* render display frame */
  renderDisplay() {
    if (this.compositor && this.displayFrame && this.displayFrame.length) {
      this.compositor.render(this.displayFrame);
    }
  }

  /* ---------- lifecycle ---------- */
  pause() {
    this.state = 'paused';
    this._prevState = 'running';
    // pause descendants
    if (this.children) {
      for (const c of this.children.values()) c.pauseSubtreeOnly();
    }
    this._updateBanner();
  }
  pauseSubtreeOnly() {
    if (this.state === 'running') { this._prevState = 'running'; this.state = 'paused'; }
    if (this.children) for (const c of this.children.values()) c.pauseSubtreeOnly();
    this._updateBanner();
  }
  resume() {
    if (this.state === 'paused') this.state = 'running';
    this._updateBanner();
    // descendants keep their own pause state
  }
  stepOnce() {
    if (this.state === 'paused') {
      // run one logical step
      this.state = 'running';
      this.hostTick(this.stepSizeMs);
      this.state = 'paused';
      this._updateBanner();
    }
  }
  restart() {
    // end all processes, reload kernel
    this.userProcs.clear();
    this.pendingSyscalls = [];
    this.syscallResults.clear();
    this.inputQueue = [];
    this.displayFrame = [];
    this.virtualTime = 0;
    this.stats = { kernel: 0, user: 0 };
    // reload kernel from VFS (preserved files)
    this._startKernel();
    this._updateBanner();
  }
  shutdown() {
    this.state = 'closed';
    this.userProcs.clear();
    if (this.children) {
      for (const c of [...this.children.values()]) c.shutdown();
    }
    // end projections
    for (const p of this.projections) {
      try { if (p.end) p.end(); } catch (e) { }
    }
    if (this.windowEl) {
      const w = this.parent.windows.get(this.windowId);
      if (w) {
        w.onClose = null;
        w.destroy();
      }
      this.parent.windows.delete(this.windowId);
      this.parent._refreshTaskbar();
    }
    this._updateBanner();
  }

  /* ---------- snapshot ---------- */
  createSnapshot() {
    return {
      type: 'subtree-snapshot',
      version: 1,
      id: this.id,
      name: this.name,
      parentId: this.parentId,
      level: this.level,
      virtualTime: this.virtualTime,
      rate: this.rate,
      budgetGrant: this.budgetGrant,
      state: this.state,
      vfs: this.vfs.serialize(),
      stats: { ...this.stats },
      userProcs: [...this.userProcs.entries()].map(([pid, p]) => ({
        pid, name: p.name, state: p.state, used: p.used, error: p.error,
        waiting: p.waiting, waitUntil: p.waitUntil
      })),
      nextPid: this.nextPid,
      displayFrame: deepClone(this.displayFrame),
      settings: { ...this.settings },
      savedAt: Date.now()
    };
  }

  restoreSnapshot(snap) {
    if (!snap || snap.type !== 'subtree-snapshot') throw new Error('无效快照');
    this.name = snap.name;
    this.virtualTime = snap.virtualTime;
    this.rate = snap.rate;
    this.budgetGrant = snap.budgetGrant;
    this.vfs = VFS.deserialize(snap.vfs, this.id);
    this.stats = snap.stats || { kernel: 0, user: 0 };
    this.nextPid = snap.nextPid || 1;
    this.displayFrame = snap.displayFrame || [];
    this.settings = snap.settings || this.settings;
    this.userProcs.clear();
    this._startKernel();
    this._updateBanner();
    if (this.compositor && this.displayFrame.length) this.compositor.render(this.displayFrame);
  }

  getStats() {
    return { kernel: this.stats.kernel, user: this.stats.user };
  }

  /* fork from this instance's snapshot */
  fork(name) {
    const snap = this.createSnapshot();
    const id = 'inner-' + (++globalSubCount);
    const child = new SubInstance({
      id, parentId: this.parentId, parent: this.parent,
      level: this.level, name: name || (this.name + '-分叉'),
      budgetGrant: this.budgetGrant
    });
    child.restoreSnapshot(snap);
    child.id = id;
    return child;
  }
}

export function SubSystemFactory(opts) {
  globalSubCount++;
  return new SubInstance(opts);
}
