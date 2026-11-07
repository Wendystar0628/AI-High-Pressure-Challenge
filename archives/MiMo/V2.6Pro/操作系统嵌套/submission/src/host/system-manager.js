// 系统管理器: 根/子系统内核 VM 宿主、逐级拨付、显示帧、输入路由
import { VM, parse, defaultNatives, UserFn } from '../vm/vm.js';
import { KERNEL_MAIN, PROGRAM_SOURCES } from '../kernel/kernel-source.js';

const TICK_MS = 16;
const ROOT_TICK_BUDGET = 24000;

export class SystemInstance {
  constructor(mgr, opts) {
    this.mgr = mgr;
    this.id = opts.id;
    this.parentId = opts.parentId ?? null;
    this.name = opts.name;
    this.isRoot = !!opts.isRoot;
    this.state = 'running';       // running | paused | stopped | error
    this.kernelError = '';
    this.vtime = 0;
    this.rate = 1;
    this.tickBudget = opts.tickBudget || 8000;
    this.tickDt = TICK_MS;
    this.memQuota = opts.memQuota || 6000000;
    this.storageQuota = opts.storageQuota || 3000000;
    this.childGrantCap = opts.childGrantCap || 6000;
    this.childGrant = opts.childGrant || 2500;
    this.vm = null;
    this.bootCfg = opts.bootCfg || {};
    this.kernelSrc = opts.kernelSrc || KERNEL_MAIN;
    this.lastFrame = null;
    this.inputQueue = [];
    this.stats = { kernelWork: 0, userWork: 0, ticks: 0, lastTickWork: 0 };
    this.children = new Set();
    this.projectionRequests = [];
    this.chartState = null;
    this.createdOrder = opts.createdOrder || 0;
    this.snapshotCounter = 0;
  }

  compileKernel() {
    const natives = this.mgr.buildKernelNatives(this);
    this.vm = new VM(this.kernelSrc, { name: 'kernel:' + this.name, natives });
    return this.vm;
  }
}

export class SystemManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.instances = new Map();
    this.byId = this.instances;
    this.root = null;
    this.nextInner = 1;
    this.handleSeq = 1;
    this.handles = new Map();     // handleId -> {type:'user'|'child', vm|instance, pid}
    this.running = false;
    this.realStart = Date.now();
    this.tickTimer = null;
    this.tickCount = 0;
    this.frameListeners = new Set();
    this.pendingEffects = [];
    this.chartSubscriptions = new Map();
    this.globalStats = { totalKernel: 0, totalUser: 0 };
  }

  // ================= 启动 =================
  async bootRoot() {
    const bootFiles = this.buildBootFiles();
    const root = new SystemInstance(this, {
      id: 'outer', parentId: null, name: '根系统', isRoot: true,
      tickBudget: ROOT_TICK_BUDGET,
      bootCfg: {
        name: 'outer', is_root: true,
        tick_budget: ROOT_TICK_BUDGET,
        boot_files: {},
        mem_quota: 40000000,
        storage_quota: 200000000,
      },
    });
    root.compileKernel();
    this.root = root;
    this.instances.set('outer', root);
    // 预置程序写入根文件系统(fs.js)
    const fs = this.ctx.fs;
    for (const [name, src] of Object.entries(PROGRAM_SOURCES)) {
      if (!fs.exists('/Programs/' + name)) {
        fs.writeFile('/Programs/' + name, src, { kind: 'prog' });
      }
    }
    // 内核源文件
    if (!fs.exists('/System/Kernels/kernel.sys')) {
      fs.mkdir('/System/Kernels');
      fs.writeFile('/System/Kernels/kernel.sys', KERNEL_MAIN, { kind: 'sys' });
    }
    this.startTicking();
    return root;
  }

  buildBootFiles() {
    const files = {};
    for (const [name, src] of Object.entries(PROGRAM_SOURCES)) {
      files['/Programs/' + name] = src;
    }
    return files;
  }

  startTicking() {
    if (this.tickTimer) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      try {
        this.tick();
      } catch (e) {
        console.error('tick error', e);
      }
      this.tickTimer = setTimeout(loop, TICK_MS);
    };
    this.tickTimer = setTimeout(loop, TICK_MS);
  }

  stopTicking() {
    this.running = false;
    if (this.tickTimer) clearTimeout(this.tickTimer);
    this.tickTimer = null;
  }

  // ================= 时钟推进与内核执行 =================
  tick() {
    this.tickCount++;
    const dt = TICK_MS;
    this._advanceTime(this.root, dt);
    this._runKernel(this.root);
    // 通知 UI 刷新
    if (this.tickCount % 2 === 0) {
      for (const fn of this.frameListeners) fn();
    }
  }

  _advanceTime(inst, dt) {
    if (inst.state === 'stopped' || inst.state === 'error') return;
    if (inst.state === 'paused') return;
    if (inst === this.root) {
      inst.vtime += dt * inst.rate;
    } else {
      // 由父拨付时间:父 tick 已推进,自身按速率跟随
      inst.vtime += dt * inst.rate;
    }
    for (const cid of inst.children) {
      const c = this.instances.get(cid);
      if (c) this._advanceTime(c, dt);
    }
  }

  _runKernel(inst) {
    if (inst.state !== 'running' || !inst.vm) return;
    inst.vm.injected = inst.vm.injected || [];
    const r = inst.vm.run(inst.tickBudget);
    inst.stats.lastTickWork = inst.vm.work;
    inst.stats.ticks++;
    inst.stats.kernelWork += inst.vm.work;
    this.globalStats.totalKernel += inst.vm.work;
    if (inst.vm.error) {
      inst.state = 'error';
      inst.kernelError = inst.vm.error.message;
      console.error('kernel error', inst.name, inst.vm.error);
      this.ctx.bus.emit('kernel-error', inst);
    }
    if (r === 'done') {
      // 内核主循环不应结束;若结束则视为内核错误
      if (!inst.vm.done) return;
      if (inst.state === 'running' && inst.vm.error == null) {
        // 正常 yield 结束不处理
      }
    }
    // 收集显示帧
    if (inst.vm.globals) {
      // last_frame 由 host.frame 原语记录
    }
    for (const fn of this.frameListeners) { /* tick 层统一通知 */ }
  }

  // ================= 内核原生(cpu / host) =================
  buildKernelNatives(inst) {
    const mgr = this;
    const natives = defaultNatives();

    // ---- cpu: 用户进程执行环境 ----
    natives.cpu = {
      load(src, name, pid) {
        try {
          const userNatives = mgr.buildUserNatives(inst);
          const vm = new VM(String(src), { name: name || 'user', natives: userNatives });
          userNatives.__vm = vm;
          const h = mgr.handleSeq++;
          mgr.handles.set(h, { type: 'user', vm, pid, owner: inst.id });
          return h;
        } catch (e) {
          inst.kernelError = '程序编译失败: ' + (e.message || e);
          return null;
        }
      },
      resume(handle, units) {
        const hd = mgr.handles.get(handle);
        if (!hd) return { status: 'error', error: '无效句柄', work: 0 };
        if (hd.type === 'child') {
          // 子系统承载进程:执行子内核
          const child = hd.instance;
          if (!child || child.state === 'stopped') return { status: 'done', work: 0 };
          if (child.state === 'paused' || child.state === 'error') return { status: 'budget', work: 0 };
          const before = child.vm ? child.vm.work : 0;
          const r = child.vm.run(Math.min(units, child.tickBudget));
          const w = Math.max(0, child.vm.work - before);
          mgr.globalStats.totalKernel += 0;
          if (child.vm.error) {
            child.state = 'error';
            child.kernelError = child.vm.error.message;
            mgr.ctx.bus.emit('kernel-error', child);
          }
          return { status: r === 'budget' ? 'budget' : (r === 'trap' ? 'trap' : 'done'), work: w, name: child.vm.trap ? child.vm.trap.name : null, args: child.vm.trap ? child.vm.trap.args : null };
        }
        const vm = hd.vm;
        const st = vm.run(units);
        const work = vm.work;
        mgr.globalStats.totalUser += work;
        if (vm.error) {
          return { status: 'error', error: vm.error.message, work };
        }
        if (st === 'trap' && vm.trap) {
          return { status: 'trap', name: vm.trap.name, args: vm.trap.args, work };
        }
        return { status: st === 'done' ? 'done' : 'budget', work };
      },
      resolve(handle, value) {
        const hd = mgr.handles.get(handle);
        if (!hd || hd.type !== 'user') return false;
        hd.vm.resolve(value);
        return true;
      },
      kill(handle) {
        mgr.handles.delete(handle);
        return true;
      },
      state(handle) {
        const hd = mgr.handles.get(handle);
        if (!hd) return 'gone';
        return hd.vm.done ? 'done' : (hd.vm.suspended ? 'suspended' : 'ready');
      },
    };

    // ---- host: 宿主设备与系统管理 ----
    natives.host = {
      cfg() {
        return {
          name: inst.name,
          is_root: inst.isRoot,
          tick_budget: inst.tickBudget,
          mem_quota: inst.memQuota,
          storage_quota: inst.storageQuota,
          boot_files: inst.bootCfg.boot_files || {},
        };
      },
      now() {
        return Math.round(inst.vtime);
      },
      log(text) {
        mgr.ctx.bus.emit('kernel-log', { systemId: inst.id, text: String(text), time: Date.now() });
      },
      yieldTick() {
        const e = { __yield: true };
        throw e;
      },
      frame(f) {
        inst.lastFrame = f;
        inst.frameAt = inst.vtime;
      },
      fsRead(p) {
        return mgr.ctx.fs.readFile(p);
      },
      fsWrite(p, content) {
        try {
          mgr.ctx.fs.writeFile(p, String(content));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },
      fsList(p) {
        return mgr.ctx.fs.list(p).map((it) => ({
          path: it.path, name: it.name, kind: it.kind, size: it.size,
        }));
      },
      fsRemove(p) {
        mgr.ctx.fs.delete(p, { toRecycle: false });
        return { ok: true };
      },
      fsExists(p) {
        return mgr.ctx.fs.exists(p);
      },
      createSystem(cfg) {
        return mgr.createSystem(inst, cfg || {});
      },
      systemCmd(id, cmd) {
        return mgr.systemCmd(inst, id, cmd);
      },
      snapshot(id) {
        return mgr.snapshotSystem(inst, id);
      },
      restore(id, data) {
        return mgr.restoreSystem(inst, id, data);
      },
      fork(id, data) {
        return mgr.forkSystem(inst, id, data);
      },
      childFsRead(id, path) {
        return mgr.childFsRead(inst, id, path);
      },
      childFsWrite(id, path, content) {
        return mgr.childFsWrite(inst, id, path, content);
      },
      project(targetId, opts) {
        return mgr.projectView(inst, targetId, opts);
      },
      chartPublish(payload) {
        mgr.ctx.bus.emit('chart-published', {
          systemId: inst.id,
          ...payload,
        });
        return { ok: true };
      },
      chartSubscribe(opts) {
        mgr.chartSubscriptions.set(inst.id, opts);
        mgr.ctx.bus.emit('chart-subscribed', { systemId: inst.id, opts });
        return { ok: true, state: 'connected' };
      },
      chartData() {
        return mgr.ctx.chartDataCache || { rows: [], version: 0 };
      },
      memoryReport() {
        return { memUsed: 0, memQuota: inst.memQuota, storageUsed: 0, storageQuota: inst.storageQuota };
      },
    };
    return natives;
  }

  // ---- 用户程序原生(sys.*): 全部以陷阱形式交给内核分发 ----
  buildUserNatives(inst) {
    const mgr = this;
    const natives = defaultNatives();
    const sys = {};
    const trap = (name) => (...args) => {
      // 在所属 VM 上抛出陷阱
      const vm = natives.__vm;
      if (vm) return vm.raiseTrap(name, args);
      return null;
    };
    for (const name of [
      'time', 'wait', 'self', 'spawn', 'exit', 'send', 'recv',
      'readFile', 'writeFile', 'listDir', 'remove', 'mkdir',
      'draw', 'scene3d', 'sceneResource', 'window', 'input', 'log',
      'project', 'chartPublish', 'chartSubscribe', 'chartData',
      'system', 'createSystem', 'snapshot', 'restore', 'fork',
      'childFsRead', 'childFsWrite', 'argv', 'setVar', 'getVar',
    ]) {
      sys[name] = trap(name);
    }
    natives.sys = sys;
    natives.flight = {
      sensors: trap('flightSensors'),
      write: trap('flightWrite'),
    };
    return natives;
  }

  // ================= 子系统管理 =================
  createSystem(parent, cfg) {
    const name = cfg.name || ('inner-' + (this.nextInner));
    const kernelSrc = cfg.kernel_src != null ? String(cfg.kernel_src) : KERNEL_MAIN;
    const bootFiles = cfg.boot_files || this.buildBootFiles();
    const id = 'inner-' + (this.nextInner);
    this.nextInner++;
    const inst = new SystemInstance(this, {
      id, parentId: parent.id, name,
      isRoot: false,
      tickBudget: cfg.tick_budget || 6000,
      memQuota: cfg.mem_quota || 5000000,
      storageQuota: cfg.storage_quota || 2500000,
      childGrant: cfg.child_grant || 2000,
      childGrantCap: cfg.child_grant_cap || 6000,
      bootCfg: {
        name, is_root: false,
        tick_budget: cfg.tick_budget || 6000,
        mem_quota: cfg.mem_quota || 5000000,
        storage_quota: cfg.storage_quota || 2500000,
        boot_files: bootFiles,
      },
      kernelSrc,
      createdOrder: this.nextInner,
    });
    try {
      inst.compileKernel();
    } catch (e) {
      return { ok: false, error: '内核编译失败: ' + e.message };
    }
    this.instances.set(id, inst);
    parent.children.add(id);
    const handle = this.handleSeq++;
    this.handles.set(handle, { type: 'child', instance: inst, pid: 0, owner: parent.id });
    inst.carrierHandle = handle;
    this.ctx.bus.emit('systems-changed');
    return { ok: true, id, handle, name };
  }

  systemCmd(fromInst, id, cmd) {
    const inst = this.instances.get(id);
    if (!inst) return { ok: false, error: '实例不存在' };
    if (cmd === 'pause') {
      this.pauseSubtree(inst);
      return { ok: true };
    }
    if (cmd === 'resume') {
      this.resumeSystem(inst);
      return { ok: true };
    }
    if (cmd === 'step') {
      this.stepSystem(inst);
      return { ok: true };
    }
    if (cmd === 'restart') {
      return this.restartSystem(inst);
    }
    if (cmd === 'close' || cmd === 'stop') {
      this.closeSystem(inst);
      return { ok: true };
    }
    if (cmd && cmd.rate != null) {
      inst.rate = cmd.rate;
      return { ok: true };
    }
    return { ok: false, error: '未知命令' };
  }

  pauseSubtree(inst) {
    inst.state = 'paused';
    inst.pausedByParent = inst.state === 'paused';
    for (const cid of inst.children) {
      const c = this.instances.get(cid);
      if (c) this.pauseSubtree(c);
    }
    this.ctx.bus.emit('systems-changed');
  }

  resumeSystem(inst) {
    // 恢复该实例;后代保留各自原有暂停状态
    if (inst.wasPausedSelf || inst.state === 'paused') {
      inst.state = 'running';
      inst.userPaused = false;
    }
    this.ctx.bus.emit('systems-changed');
  }

  resumeSubtree(inst) {
    inst.state = 'running';
    inst.userPaused = false;
    for (const cid of inst.children) {
      const c = this.instances.get(cid);
      if (c && c.pausedByParent) {
        c.pausedByParent = false;
        if (!c.userPaused) c.state = 'running';
      }
    }
    this.ctx.bus.emit('systems-changed');
  }

  pauseSelf(inst) {
    inst.userPaused = true;
    inst.state = 'paused';
    this.ctx.bus.emit('systems-changed');
  }

  stepSystem(inst) {
    // 单步:执行一个固定逻辑时间步(50ms)与相应预算
    if (inst.state !== 'paused') return { ok: false, error: '仅暂停时可单步' };
    const dt = 50;
    inst.vtime += dt * inst.rate;
    for (const cid of inst.children) {
      const c = this.instances.get(cid);
      if (c && c.state !== 'stopped') c.vtime += dt * c.rate;
    }
    const saved = inst.state;
    inst.state = 'running';
    if (inst.vm) {
      inst.vm.run(inst.tickBudget);
    }
    // 子树单步
    for (const cid of inst.children) {
      const c = this.instances.get(cid);
      if (c && c.state === 'running' && c.vm) c.vm.run(c.tickBudget);
    }
    inst.state = saved;
    this.ctx.bus.emit('systems-changed');
    return { ok: true, dt };
  }

  restartSystem(inst) {
    // 重新载入内核源文件(父系统 FS 中),重建 VM,保留文件与子树结构
    try {
      const parentId = inst.parentId;
      let src = inst.kernelSrc;
      if (parentId && !inst.isRoot) {
        const parent = this.instances.get(parentId);
        const path = '/System/Kernels/' + inst.id + '.sys';
        const t = this.readSystemFile(parent, path);
        if (t != null) src = t;
      }
      inst.kernelSrc = src;
      // 结束原有进程句柄
      for (const [h, hd] of [...this.handles]) {
        if (hd.owner === inst.id) this.handles.delete(h);
      }
      inst.compileKernel();
      inst.state = 'running';
      inst.kernelError = '';
      inst.vtime = 0;
      this.ctx.bus.emit('systems-changed');
      this.ctx.bus.emit('system-restarted', inst);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  closeSystem(inst) {
    // 停止整棵子树
    for (const cid of [...inst.children]) {
      const c = this.instances.get(cid);
      if (c) this.closeSystem(c);
    }
    inst.state = 'stopped';
    for (const [h, hd] of [...this.handles]) {
      if (hd.owner === inst.id || hd.instance === inst) this.handles.delete(h);
    }
    if (inst.parentId) {
      const p = this.instances.get(inst.parentId);
      if (p) p.children.delete(inst.id);
    }
    this.instances.delete(inst.id);
    this.ctx.bus.emit('systems-changed');
    this.ctx.bus.emit('system-closed', inst);
    return { ok: true };
  }

  // ================= 快照 / 恢复 / 分叉 =================
  snapshotSystem(fromInst, targetId) {
    const inst = this.instances.get(targetId);
    if (!inst) return { ok: false, error: '实例不存在' };
    const data = this._captureSubtree(inst);
    // 保存为父系统文件
    const parent = this.instances.get(inst.parentId) || this.root;
    const snapName = '/Snapshots/' + inst.id + '-' + (++inst.snapshotCounter) + '.snapshot';
    const json = JSON.stringify(data);
    this.writeSystemFile(parent, snapName, json);
    return { ok: true, path: snapName, size: json.length, data };
  }

  _captureSubtree(inst) {
    const node = {
      id: inst.id, name: inst.name, isRoot: inst.isRoot,
      vtime: inst.vtime, rate: inst.rate, state: inst.state,
      tickBudget: inst.tickBudget, memQuota: inst.memQuota,
      storageQuota: inst.storageQuota, kernelSrc: inst.kernelSrc,
      bootCfg: inst.bootCfg,
      kernelState: inst.vm ? inst.vm.snapshotState() : null,
      procs: this._captureProcs(inst),
      children: [],
    };
    for (const cid of inst.children) {
      const c = this.instances.get(cid);
      if (c) node.children.push(this._captureSubtree(c));
    }
    return node;
  }

  _captureProcs(inst) {
    const out = [];
    for (const [h, hd] of this.handles) {
      if (hd.owner !== inst.id) continue;
      if (hd.type === 'user') {
        out.push({
          handle: h, pid: hd.pid, name: hd.vm.name,
          state: hd.vm.snapshotState(),
          source: hd.vm.source,
        });
      }
    }
    return out;
  }

  restoreSystem(fromInst, targetId, data) {
    try {
      const d = typeof data === 'string' ? JSON.parse(data) : data;
      const inst = this.instances.get(targetId);
      if (!inst) return { ok: false, error: '实例不存在' };
      this._restoreSubtree(d, inst);
      this.ctx.bus.emit('systems-changed');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  _restoreSubtree(node, inst) {
    inst.vtime = node.vtime;
    inst.rate = node.rate;
    inst.state = node.state === 'paused' ? 'paused' : 'running';
    inst.kernelSrc = node.kernelSrc;
    inst.bootCfg = node.bootCfg;
    inst.tickBudget = node.tickBudget;
    for (const [h, hd] of [...this.handles]) {
      if (hd.owner === inst.id) this.handles.delete(h);
    }
    inst.compileKernel();
    if (node.kernelState && inst.vm) {
      try { inst.vm.restoreState(node.kernelState); } catch (e) { /* 容错 */ }
    }
    for (const p of node.procs || []) {
      const hd = this._loadUserFromSource(inst, p.source, p.name, p.pid);
      if (hd && p.state) {
        try { hd.vm.restoreState(p.state); } catch (e) { /* 容错 */ }
      }
    }
    for (const cn of node.children || []) {
      let child = this.instances.get(cn.id);
      if (!child) {
        const r = this.createSystem(inst, {
          name: cn.name,
          kernel_src: cn.kernelSrc,
          boot_files: (cn.bootCfg && cn.bootCfg.boot_files) || {},
          tick_budget: cn.tickBudget,
        });
        if (r.ok) child = this.instances.get(r.id);
      }
      if (child) this._restoreSubtree(cn, child);
    }
  }

  _loadUserFromSource(inst, src, name, pid) {
    try {
      const userNatives = this.buildUserNatives(inst);
      const vm = new VM(String(src), { name: name || 'user', natives: userNatives });
      userNatives.__vm = vm;
      const h = this.handleSeq++;
      this.handles.set(h, { type: 'user', vm, pid, owner: inst.id });
      return this.handles.get(h);
    } catch (e) {
      return null;
    }
  }

  forkSystem(fromInst, targetId, data) {
    // 从快照启动独立新子树(新身份)
    const d = typeof data === 'string' ? JSON.parse(data) : (data || null);
    const parent = fromInst;
    const name = (d && d.name ? d.name : 'inner') + '-fork-' + (this.nextInner);
    let cfg;
    if (d) {
      cfg = {
        name: 'inner-' + this.nextInner,
        kernel_src: d.kernelSrc || KERNEL_MAIN,
        boot_files: (d.bootCfg && d.bootCfg.boot_files) || this.buildBootFiles(),
        tick_budget: d.tickBudget || 6000,
      };
    } else {
      cfg = { name: 'inner-' + this.nextInner, kernel_src: KERNEL_MAIN, boot_files: this.buildBootFiles() };
    }
    const r = this.createSystem(parent, cfg);
    if (!r.ok) return r;
    const newInst = this.instances.get(r.id);
    if (d) {
      this._restoreSubtree(d, newInst);
      newInst.id = r.id;
      newInst.name = cfg.name;
    }
    this.ctx.bus.emit('systems-changed');
    return { ok: true, id: r.id, name: cfg.name };
  }

  // ================= 跨系统文件 =================
  readSystemFile(inst, path) {
    if (!inst) return null;
    if (inst.isRoot) return this.ctx.fs.readFile(path);
    try {
      return inst.vm.callFunction('fs_read', [path]);
    } catch (e) {
      return null;
    }
  }

  writeSystemFile(inst, path, content) {
    if (!inst) return { ok: false };
    if (inst.isRoot) {
      try {
        this.ctx.fs.writeFile(path, String(content), { kind: 'snapshot' });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
    try {
      return inst.vm.callFunction('fs_write', [path, String(content)]);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  childFsRead(parentInst, childId, path) {
    const child = this.instances.get(childId);
    if (!child || child.parentId !== parentInst.id) return { ok: false, error: '非法子系统' };
    const v = this.readSystemFile(child, path);
    return v == null ? { ok: false, error: '文件不存在' } : { ok: true, content: v };
  }

  childFsWrite(parentInst, childId, path, content) {
    const child = this.instances.get(childId);
    if (!child || child.parentId !== parentInst.id) return { ok: false, error: '非法子系统' };
    return this.writeSystemFile(child, path, content);
  }

  // ================= 投送 =================
  projectView(inst, targetId, opts) {
    // 请求把视图投送到祖先桌面
    const req = {
      sourceSystemId: inst.id,
      sourceWindowId: opts && opts.window_id,
      sourceAppId: opts && opts.app,
      targetSystemId: String(targetId),
      kind: opts && opts.kind || 'player',
      at: Date.now(),
    };
    this.ctx.bus.emit('projection-request', req);
    return { ok: true, request: req };
  }

  // ================= 编辑器运行程序 =================
  runProgramFromEditor(path) {
    const fs = this.ctx.fs;
    const src = fs.readFile(path);
    if (src == null) return { ok: false, error: '文件不存在: ' + path };
    const root = this.root;
    if (!root) return { ok: false, error: '根系统未就绪' };
    try {
      const userNatives = this.buildUserNatives(root);
      const vm = new VM(String(src), { name: path.split('/').pop(), natives: userNatives });
      userNatives.__vm = vm;
      const h = this.handleSeq++;
      const pid = h;
      this.handles.set(h, { type: 'user', vm, pid, owner: 'outer' });
      // 交给根内核进程表(通过 host 注入)
      this.injectUserProcess(root, pid, h, path.split('/').pop(), path);
      return { ok: true, pid };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  injectUserProcess(inst, pid, handle, name, path) {
    // 将宿主侧进程注入内核进程表(供调度与显示)
    if (!inst.injectedProcs) inst.injectedProcs = [];
    inst.injectedProcs.push({ pid, handle, name, path });
    // 通过内核原生注入:写入内核 globals
    try {
      const g = inst.vm._scope(inst.vm.rootScopeId);
      const procs = g.get('procs');
      if (Array.isArray(procs)) {
        procs.push({
          pid, name, path, handle, state: 'ready', quota: 3000, used: 0,
          inbox: [], wait_until: 0, wait_kind: '', error: '', app: '', win_id: '',
          args: {}, created: inst.vtime, has_wake: 0, wake_value: 0,
        });
        const np = g.get('next_pid');
        if (typeof np === 'number' && np <= pid) g.set('next_pid', pid + 1);
      }
    } catch (e) {
      console.warn('inject proc fail', e);
    }
  }

  stopEditorPrograms() {
    for (const [h, hd] of [...this.handles]) {
      if (hd.owner === 'outer' && hd.type === 'user' && hd.editor) this.handles.delete(h);
    }
    const root = this.root;
    if (root && root.vm) {
      try {
        const g = root.vm._scope(root.vm.rootScopeId);
        const procs = g.get('procs');
        if (Array.isArray(procs)) {
          for (const p of procs) {
            if (p.name && String(p.name).includes('.prog')) p.state = 'zombie';
          }
        }
      } catch (e) { /* ignore */ }
    }
  }

  // ================= UI 辅助 =================
  rootNotify(title, body) {
    this.ctx.bus.emit('root-notify', { title, body });
  }

  getSystems() {
    const out = [];
    for (const inst of this.instances.values()) {
      out.push({
        id: inst.id,
        parentId: inst.parentId,
        name: inst.name,
        state: inst.state,
        rate: inst.rate,
        vtime: Math.round(inst.vtime),
        kernelError: inst.kernelError,
        stats: { ...inst.stats },
        children: [...inst.children],
      });
    }
    return out;
  }

  getSystem(id) {
    return this.instances.get(id) || null;
  }

  getProcs(systemId) {
    const inst = this.instances.get(systemId);
    if (!inst) return [];
    const out = [];
    for (const [h, hd] of this.handles) {
      if (hd.owner !== systemId) continue;
      out.push({
        handle: h, pid: hd.pid, name: hd.vm ? hd.vm.name : (hd.instance ? 'carrier:' + hd.instance.name : '?'),
        type: hd.type,
        done: hd.vm ? hd.vm.done : false,
        suspended: hd.vm ? hd.vm.suspended : false,
        error: hd.vm && hd.vm.error ? hd.vm.error.message : '',
      });
    }
    // 内核进程表读数
    try {
      const g = inst.vm._scope(inst.vm.rootScopeId);
      const procs = g.get('procs');
      if (Array.isArray(procs)) {
        for (const p of procs) {
          out.push({
            pid: p.pid, name: p.name, path: p.path,
            state: p.state, used: p.used, quota: p.quota,
            error: p.error, inbox: p.inbox ? p.inbox.length : 0,
            type: p.name && String(p.name).startsWith('carrier') ? 'carrier' : 'user',
            kernel: true,
          });
        }
      }
    } catch (e) { /* ignore */ }
    return out;
  }
}
