import { WorkbookModel } from './spreadsheet-engine.js';

const { NosVM } = window.NosVMModule;

export const FIXED_LOGIC_STEP_SEC = 0.05; // 50ms per logic step (documented in UI & manual)

export function normVfsPath(p) {
  if (!p) return '/';
  let s = String(p).replace(/\\/g, '/').trim();
  if (!s.startsWith('/')) s = '/' + s;
  while (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

export function parentVfsDir(p) {
  const np = normVfsPath(p);
  if (np === '/') return '/';
  const idx = np.lastIndexOf('/');
  return idx <= 0 ? '/' : np.slice(0, idx);
}

export function baseVfsName(p) {
  const np = normVfsPath(p);
  if (np === '/') return '/';
  return np.slice(np.lastIndexOf('/') + 1);
}

export class NestedOSRuntime {
  constructor(bootstrapData, onStateChange) {
    this.bundle = bootstrapData.bundle;
    this.dataDir = bootstrapData.dataDir;
    this.onStateChange = onStateChange || (() => {});

    // Global bytecode compile cache keyed by compilerHash::progPath::len::src
    this.compileCache = new Map();
    this.seedPrecompileCache();

    this.nextInnerSeq = 1;
    this.systems = new Map(); // sysId -> system meta & carrier bridge state
    this.openWorkbooks = new Map(); // docId -> WorkbookModel
    this.nextDocSeq = 1;
    this.chartSubscriptions = new Map(); // subId -> subscription record
    this.nextSubSeq = 1;
    this.projections = new Map(); // projKey (sourceSysId::sourceWinId) -> projection record
    this.saveDebounceTimer = null;

    this.initFromPersisted(bootstrapData.persisted);
  }

  seedPrecompileCache() {
    this.compileCache.clear();
    const pre = this.bundle.precompiled || {};
    const nosFiles = this.bundle.nosFiles || {};
    for (const [vfsPath, bc] of Object.entries(pre)) {
      const src = nosFiles[vfsPath];
      if (src !== undefined) {
        const key = `boot::${src.length}::${src}`;
        this.compileCache.set(key, bc);
      }
    }
  }

  buildDefaultVfsEntries(isRoot) {
    const vfs = {
      '/': { type: 'dir', content: null, mtime: 0 },
      '/Documents': { type: 'dir', content: null, mtime: 0 },
      '/Demo': { type: 'dir', content: null, mtime: 0 },
      '/Programs': { type: 'dir', content: null, mtime: 0 },
      '/System': { type: 'dir', content: null, mtime: 0 },
      '/Subsystems': { type: 'dir', content: null, mtime: 0 },
      '/Snapshots': { type: 'dir', content: null, mtime: 0 },
      '/.Trash': { type: 'dir', content: null, mtime: 0 }
    };

    if (isRoot) {
      vfs['/Downloads'] = { type: 'dir', content: null, mtime: 0 };
      vfs['/Demo/sample.sheet'] = { type: 'file', content: this.bundle.sampleSheet, mtime: 0 };
      vfs['/Documents/操作说明.md'] = { type: 'file', content: this.bundle.manualMd, mtime: 0 };
      vfs['/Documents/欢迎便笺.txt'] = {
        type: 'file',
        content: '欢迎来到棱镜嵌套操作系统 (Nested OS)！\n可随时创建多级子系统、编辑内核程序、排演24号直升机飞行或建立跨层实时图表。\n',
        mtime: 0
      };
    } else {
      vfs['/Apps'] = { type: 'dir', content: null, mtime: 0 };
    }

    vfs['/Demo/helicopter-24.scene'] = { type: 'file', content: this.bundle.heliScene, mtime: 0 };
    vfs['/Demo/minimal.scene'] = { type: 'file', content: this.bundle.minimalScene, mtime: 0 };

    for (const [p, content] of Object.entries(this.bundle.nosFiles)) {
      if (isRoot && p.startsWith('/Apps/')) continue;
      vfs[p] = { type: 'file', content, mtime: 0 };
    }
    return vfs;
  }

  initFromPersisted(persisted) {
    this.systems.clear();
    this.openWorkbooks.clear();
    this.chartSubscriptions.clear();
    this.projections.clear();
    this.nextInnerSeq = (persisted && persisted.nextInnerSeq) || 1;

    // Initialize Root System ('outer')
    const rootVfs = (persisted && persisted.rootVfs) || this.buildDefaultVfsEntries(true);
    const rootTrashMeta = (persisted && persisted.rootTrashMeta) || {};
    const rootSettings = {
      systemName: 'Prism Root OS',
      wallpaper: 'aurora-peaks.png',
      accent: '#8b5cf6',
      scale: 1.0,
      dnd: false,
      noteText: '今日排演计划：\n1. 检查 sample.sheet 小计公式\n2. 连接第3层实时图表\n3. 投送第4层24号直升机演出',
      ...(persisted && persisted.rootSettings ? persisted.rootSettings : {})
    };

    this.root = {
      id: 'outer',
      parentId: null,
      name: rootSettings.systemName,
      depth: 0,
      state: 'running',
      selfPaused: false,
      vtime: 0,
      speed: 1.0,
      totalBudget: 28000,
      lastUsedBudget: 0,
      memQuota: 128 * 1024 * 1024,
      storageQuota: 32 * 1024 * 1024,
      storageUsed: 0,
      vfs: rootVfs,
      trashMeta: rootTrashMeta,
      settings: rootSettings,
      customProcs: [], // Custom .nos programs started in Root
      nextRootPid: 100,
      directCarriers: new Map(), // childSysId -> { pid, vm, grant, memQuota, cpuSelf, cpuChildren, error }
      clipboardHistory: [],
      notifications: []
    };
    this.recalcVfsStorage(this.root);
    this.systems.set('outer', this.root);

    // Persisted saved VFS maps per subsystem ID (so restarts preserve saved files)
    this.savedSubsysFiles = (persisted && persisted.savedSubsysFiles) || {};
  }

  async resetAll() {
    const fresh = await window.hostBridge.resetState();
    this.bundle = fresh.bundle;
    this.seedPrecompileCache();
    this.nextInnerSeq = 1;
    this.initFromPersisted(null);
    this.onStateChange({ type: 'reset' });
  }

  schedulePersist() {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      this.saveDebounceTimer = null;
      window.hostBridge.saveState({
        nextInnerSeq: this.nextInnerSeq,
        rootVfs: this.root.vfs,
        rootTrashMeta: this.root.trashMeta,
        rootSettings: this.root.settings,
        savedSubsysFiles: this.savedSubsysFiles
      });
    }, 350);
  }

  // ==========================================================================
  // Root System VFS Operations
  // ==========================================================================

  recalcVfsStorage(sysObj) {
    let bytes = 0;
    for (const entry of Object.values(sysObj.vfs)) {
      if (entry && entry.type === 'file' && typeof entry.content === 'string') {
        bytes += entry.content.length * 2 + 32;
      } else {
        bytes += 24;
      }
    }
    sysObj.storageUsed = bytes;
    return bytes;
  }

  ensureRootDirs(filePath) {
    const np = normVfsPath(filePath);
    const parts = np.split('/');
    let cur = '';
    for (let i = 1; i < parts.length - 1; i++) {
      cur += '/' + parts[i];
      if (!this.root.vfs[cur]) {
        this.root.vfs[cur] = { type: 'dir', content: null, mtime: this.root.vtime };
      }
    }
  }

  rootReadFile(filePath) {
    const np = normVfsPath(filePath);
    const entry = this.root.vfs[np];
    return entry && entry.type === 'file' ? entry.content : null;
  }

  rootWriteFile(filePath, content) {
    const np = normVfsPath(filePath);
    const str = String(content ?? '');
    const newBytes = str.length * 2 + 32;
    const prev = this.root.vfs[np];
    const oldBytes = prev && prev.type === 'file' && prev.content ? prev.content.length * 2 + 32 : 0;
    if (this.root.storageUsed - oldBytes + newBytes > this.root.storageQuota) {
      return { ok: false, error: 'E_STORAGE_QUOTA: 根系统存储配额不足' };
    }
    this.ensureRootDirs(np);
    this.root.vfs[np] = { type: 'file', content: str, mtime: this.root.vtime };
    this.recalcVfsStorage(this.root);
    this.chargeRootWork(2 + Math.ceil(str.length / 128));
    this.schedulePersist();
    return { ok: true, path: np, bytes: newBytes };
  }

  rootMkdir(dirPath) {
    const np = normVfsPath(dirPath);
    this.ensureRootDirs(np + '/_');
    this.root.vfs[np] = { type: 'dir', content: null, mtime: this.root.vtime };
    this.schedulePersist();
    return { ok: true, path: np };
  }

  rootListDir(dirPath) {
    const dp = normVfsPath(dirPath);
    const out = [];
    for (const [p, entry] of Object.entries(this.root.vfs)) {
      if (p !== '/' && p !== dp && parentVfsDir(p) === dp) {
        const name = baseVfsName(p);
        if (dp === '/' && name === '.Trash') continue;
        out.push({
          name,
          path: p,
          type: entry.type,
          size: entry.type === 'file' && entry.content ? entry.content.length : 0,
          mtime: entry.mtime || 0,
          origPath: this.root.trashMeta[p] ? this.root.trashMeta[p].origPath : null
        });
      }
    }
    out.sort((a, b) => (a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name, 'zh-CN')));
    return out;
  }

  rootDeletePath(filePath) {
    const np = normVfsPath(filePath);
    if (!this.root.vfs[np] || np === '/') return { ok: false, error: '文件不存在' };
    if (np.startsWith('/.Trash/')) {
      delete this.root.vfs[np];
      delete this.root.trashMeta[np];
      this.recalcVfsStorage(this.root);
      this.schedulePersist();
      return { ok: true, permanent: true };
    }
    let trashPath = '/.Trash/' + baseVfsName(np);
    let idx = 1;
    while (this.root.vfs[trashPath]) {
      trashPath = `/.Trash/${idx++}_${baseVfsName(np)}`;
    }
    this.root.vfs[trashPath] = this.root.vfs[np];
    this.root.trashMeta[trashPath] = { origPath: np, deletedAt: Date.now() };
    delete this.root.vfs[np];
    this.pushRootNotification('文件已移入回收站', `${np} -> 回收站`);
    this.schedulePersist();
    return { ok: true, trashPath };
  }

  rootRestoreTrash(trashPath) {
    const np = normVfsPath(trashPath);
    const entry = this.root.vfs[np];
    if (!entry) return { ok: false, error: '回收站项不存在' };
    const meta = this.root.trashMeta[np];
    const dst = meta && meta.origPath ? meta.origPath : '/Documents/' + baseVfsName(np);
    this.ensureRootDirs(dst);
    this.root.vfs[dst] = entry;
    delete this.root.vfs[np];
    delete this.root.trashMeta[np];
    this.pushRootNotification('文件已恢复', `已恢复至 ${dst}`);
    this.schedulePersist();
    return { ok: true, restoredPath: dst };
  }

  rootCopyPath(srcPath, dstPath) {
    const sp = normVfsPath(srcPath);
    const dp = normVfsPath(dstPath);
    const entry = this.root.vfs[sp];
    if (!entry) return { ok: false, error: '源文件不存在' };
    if (entry.type === 'file') {
      return this.rootWriteFile(dp, entry.content);
    }
    this.rootMkdir(dp);
    for (const [k, v] of Object.entries(this.root.vfs)) {
      if (k.startsWith(sp + '/')) {
        const sub = dp + k.slice(sp.length);
        if (v.type === 'dir') this.rootMkdir(sub);
        else {
          const wr = this.rootWriteFile(sub, v.content);
          if (!wr.ok) return wr;
        }
      }
    }
    return { ok: true, path: dp };
  }

  rootRenamePath(oldPath, newPath) {
    const cp = this.rootCopyPath(oldPath, newPath);
    if (!cp.ok) return cp;
    const op = normVfsPath(oldPath);
    delete this.root.vfs[op];
    for (const k of Object.keys(this.root.vfs)) {
      if (k.startsWith(op + '/')) delete this.root.vfs[k];
    }
    this.recalcVfsStorage(this.root);
    this.schedulePersist();
    return { ok: true, path: normVfsPath(newPath) };
  }

  pushRootNotification(title, body) {
    const item = {
      id: 'ntf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title,
      body,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      unread: true
    };
    this.root.notifications.unshift(item);
    if (this.root.notifications.length > 40) this.root.notifications.pop();
    this.onStateChange({ type: 'notification', item, suppressedByDnd: this.root.settings.dnd });
  }

  recordClipboard(text, kind = 'text', meta = null) {
    const s = String(text ?? '');
    if (!s) return;
    this.root.clipboardHistory.unshift({
      id: 'clip_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      text: s,
      kind,
      meta,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false })
    });
    if (this.root.clipboardHistory.length > 25) this.root.clipboardHistory.pop();
    this.onStateChange({ type: 'clipboard' });
  }

  chargeRootWork(ops) {
    this.root.lastUsedBudget += Math.max(0, Math.floor(ops));
  }

  // ==========================================================================
  // Root Custom NosLang Program Execution (Editor / Task Manager in Root)
  // ==========================================================================

  compileInRoot(progPath, sourceCode) {
    const compilerRaw = this.rootReadFile('/System/compiler.nbc');
    if (!compilerRaw) return { ok: false, error: '缺少根系统编译器 /System/compiler.nbc' };
    const compilerHash = this.rootCompilerEdited ? 'rc_' + compilerRaw.length + '_' + compilerRaw.slice(0, 64) : 'boot';
    const dynKey = `${compilerHash}::${sourceCode.length}::${sourceCode}`;
    if (this.compileCache.has(dynKey)) {
      return { ok: true, bytecode: this.compileCache.get(dynKey) };
    }

    try {
      const compilerBc = JSON.parse(compilerRaw);
      const cvm = new NosVM(compilerBc, {
        memLimit: 32 * 1024 * 1024,
        entryArgs: [sourceCode, '__MEM__']
      });
      let errText = null;
      cvm.setHostHandler((name, args) => {
        if (name === 'report_error') errText = args[0];
        return { value: null, cost: 1 };
      });
      const res = cvm.step(18_000_000);
      this.chargeRootWork(Math.min(4000, Math.ceil(res.consumed / 200)));
      if (res.status === 'exit' && res.value && res.value.magic === 'NOSBC1') {
        this.compileCache.set(dynKey, res.value);
        return { ok: true, bytecode: res.value };
      }
      return { ok: false, error: errText || res.error || '编译语法错误' };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  spawnRootProgram(progPath, entryArgs = []) {
    const np = normVfsPath(progPath);
    const src = this.rootReadFile(np);
    if (src === null) return { ok: false, error: '文件不存在: ' + np };
    const comp = this.compileInRoot(np, src);
    if (!comp.ok) return comp;

    const pid = this.root.nextRootPid++;
    const vm = new NosVM(comp.bytecode, {
      memLimit: 8 * 1024 * 1024,
      entryArgs
    });
    const proc = {
      pid,
      name: baseVfsName(np),
      progPath: np,
      role: null,
      state: 'ready',
      prevWaitState: null,
      wakeAt: 0,
      quota: 650,
      cpuSelf: 0,
      memBytes: 1024,
      remainingWork: 0,
      msgQueue: [],
      nextSeq: 1,
      lastResult: null,
      error: null,
      vm
    };
    this.root.customProcs.push(proc);
    return { ok: true, pid };
  }

  stepRootCustomProcs(budgetLimit) {
    let used = 0;
    for (const p of this.root.customProcs) {
      if (p.state === 'waiting_time' && this.root.vtime >= p.wakeAt) {
        p.state = 'ready';
        p.wakeAt = 0;
        p.vm.resumeSyscall(this.root.vtime);
      } else if (p.state === 'waiting_msg' && p.msgQueue.length > 0) {
        p.state = 'ready';
        p.vm.resumeSyscall(p.msgQueue.shift());
      }
    }

    for (const p of this.root.customProcs) {
      if (used >= budgetLimit) break;
      if (p.state !== 'ready') continue;
      const slice = Math.min(p.quota, budgetLimit - used);
      const res = p.vm.step(slice);
      used += res.consumed;
      p.cpuSelf += res.consumed;
      p.memBytes = p.vm.getMemoryBytes();
      p.remainingWork = p.vm.getRemainingWork();

      if (res.status === 'syscall') {
        this.handleRootProcSyscall(p, res.name, res.args);
      } else if (res.status === 'exit') {
        p.state = 'exited';
      } else if (res.status === 'error') {
        p.state = 'error';
        p.error = res.error;
      }
    }
    return used;
  }

  handleRootProcSyscall(p, name, args) {
    if (name === 'time_now') return p.vm.resumeSyscall(this.root.vtime);
    if (name === 'get_pid') return p.vm.resumeSyscall(p.pid);
    if (name === 'sleep') {
      p.state = 'waiting_time';
      p.wakeAt = this.root.vtime + Math.max(0, Number(args[0] || 0));
      return;
    }
    if (name === 'register_role') {
      p.role = String(args[0]);
      return p.vm.resumeSyscall(true);
    }
    if (name === 'find_pid_by_role') {
      const found = this.root.customProcs.find((x) => x.role === String(args[0]) && x.state !== 'exited' && x.state !== 'error');
      return p.vm.resumeSyscall(found ? found.pid : null);
    }
    if (name === 'proc_spawn') {
      const sr = this.spawnRootProgram(args[0], args[1] || []);
      return p.vm.resumeSyscall(sr);
    }
    if (name === 'send_msg') {
      const target = this.root.customProcs.find((x) => x.pid === Number(args[0]) && x.state !== 'exited' && x.state !== 'error');
      if (!target) return p.vm.resumeSyscall({ ok: false, error: 'ERR_NO_TARGET' });
      const msg = { from: p.pid, seq: target.nextSeq++, time: this.root.vtime, data: JSON.parse(JSON.stringify(args[1] ?? null)) };
      target.msgQueue.push(msg);
      if (target.state === 'waiting_msg') {
        target.state = 'ready';
        target.vm.resumeSyscall(target.msgQueue.shift());
      }
      return p.vm.resumeSyscall({ ok: true, seq: msg.seq });
    }
    if (name === 'recv_msg') {
      return p.vm.resumeSyscall(p.msgQueue.length ? p.msgQueue.shift() : null);
    }
    if (name === 'recv_msg_wait') {
      if (p.msgQueue.length) return p.vm.resumeSyscall(p.msgQueue.shift());
      p.state = 'waiting_msg';
      return;
    }
    if (name === 'fs_read') return p.vm.resumeSyscall(this.rootReadFile(args[0]));
    if (name === 'fs_write') {
      const wr = this.rootWriteFile(args[0], args[1]);
      if (normVfsPath(args[0]) === '/System/compiler.nbc' && wr.ok) {
        this.rootCompilerEdited = true;
      }
      return p.vm.resumeSyscall(wr);
    }
    if (name === 'fs_list') return p.vm.resumeSyscall(this.rootListDir(args[0]));
    if (name === 'report_result') {
      p.lastResult = String(args[0]);
      return p.vm.resumeSyscall(true);
    }
    if (name === 'report_error') {
      p.error = String(args[0]);
      return p.vm.resumeSyscall(true);
    }
    p.vm.resumeSyscall(null);
  }

  // ==========================================================================
  // Recursive Subsystem Tree Creation, Lifecycle & Carrier Bridge
  // ==========================================================================

  allocateNextSubsystemId() {
    const id = `inner-${this.nextInnerSeq}`;
    this.nextInnerSeq += 1;
    this.schedulePersist();
    return id;
  }

  getDepth(sysId) {
    let d = 0;
    let cur = this.systems.get(sysId);
    while (cur && cur.parentId) {
      d++;
      cur = this.systems.get(cur.parentId);
    }
    return d;
  }

  getAncestors(sysId) {
    const out = [];
    let cur = this.systems.get(sysId);
    while (cur && cur.parentId) {
      const p = this.systems.get(cur.parentId);
      if (!p) break;
      out.push({ id: p.id, name: p.name });
      cur = p;
    }
    return out;
  }

  isEffectivelyPaused(sysId) {
    let cur = this.systems.get(sysId);
    while (cur) {
      if (cur.selfPaused || cur.state === 'stopped' || cur.state === 'kernel_error') return true;
      cur = cur.parentId ? this.systems.get(cur.parentId) : null;
    }
    return false;
  }

  buildSubsystemInitialFileArray(sysId) {
    const baseVfs = this.savedSubsysFiles[sysId]
      ? JSON.parse(JSON.stringify(this.savedSubsysFiles[sysId]))
      : this.buildDefaultVfsEntries(false);
    this.savedSubsysFiles[sysId] = baseVfs;

    const arr = [];
    for (const [p, entry] of Object.entries(baseVfs)) {
      arr.push({
        path: p,
        type: entry.type,
        content: entry.content
      });
    }
    return arr;
  }

  registerSubsystemMeta(sysId, parentId, customOpts = {}) {
    const depth = this.getDepth(parentId) + 1;
    const defaultBudget = Math.max(4500, Math.round(24000 * Math.pow(0.76, depth)));
    const defaultMem = Math.max(12 * 1024 * 1024, Math.round(64 * 1024 * 1024 * Math.pow(0.75, depth)));
    const defaultStorage = Math.max(4 * 1024 * 1024, Math.round(16 * 1024 * 1024 * Math.pow(0.8, depth)));

    const meta = {
      id: sysId,
      parentId,
      name: customOpts.name || `子系统 ${sysId}`,
      depth,
      state: 'running', // running | paused | stopped | kernel_error
      selfPaused: false,
      kernelError: null,
      speed: customOpts.speed || 1.0,
      vtime: 0,
      totalBudget: customOpts.totalBudget || defaultBudget,
      grantFromParent: customOpts.grant || Math.round(defaultBudget * 0.95),
      memQuota: customOpts.memQuota || defaultMem,
      storageQuota: customOpts.storageQuota || defaultStorage,
      storageUsed: 0,
      pendingDt: 0,
      pendingBudgetGrant: 0,
      inputQueue: [],
      crossMsgQueue: [],
      retainedChildren: [],
      lastPresent: null, // Latest packet from kernel.nos host_present
      carrierPid: null
    };
    this.systems.set(sysId, meta);
    return meta;
  }

  // Create a direct child subsystem of Root ('outer')
  createRootChildSubsystem() {
    const childId = this.allocateNextSubsystemId();
    const meta = this.registerSubsystemMeta(childId, 'outer');

    const kernelTemplate = this.rootReadFile('/System/kernel.nos') || this.bundle.nosFiles['/System/kernel.nos'];
    const kernelPath = `/Subsystems/${childId}/kernel.nos`;
    if (!this.rootReadFile(kernelPath)) {
      this.rootWriteFile(kernelPath, kernelTemplate);
    }

    this.bootRootChildCarrier(childId);
    this.onStateChange({ type: 'subsystem_created', sysId: childId, parentId: 'outer' });
    return childId;
  }

  bootRootChildCarrier(childId) {
    const meta = this.systems.get(childId);
    if (!meta) return { ok: false, error: '未知子系统' };

    const kernelPath = `/Subsystems/${childId}/kernel.nos`;
    const kernelSrc = this.rootReadFile(kernelPath);
    if (!kernelSrc) {
      meta.state = 'kernel_error';
      meta.kernelError = `找不到内核源文件 ${kernelPath}`;
      return { ok: false, error: meta.kernelError };
    }

    const comp = this.compileInRoot(kernelPath, kernelSrc);
    if (!comp.ok) {
      meta.state = 'kernel_error';
      meta.kernelError = comp.error;
      this.root.directCarriers.delete(childId);
      return { ok: false, error: comp.error };
    }

    const pid = this.root.nextRootPid++;
    const vm = new NosVM(comp.bytecode, {
      isKernel: true,
      memLimit: meta.memQuota,
      entryArgs: [childId],
      hostHandler: (callName, args) => this.handleSubsystemHostCall(childId, callName, args)
    });

    const carrier = {
      pid,
      childSysId: childId,
      vm,
      state: 'ready',
      grant: meta.grantFromParent,
      cpuSelf: 0,
      cpuChildren: 0,
      memBytes: 2048,
      remainingWork: 0
    };
    meta.carrierPid = pid;
    meta.state = meta.selfPaused ? 'paused' : 'running';
    meta.kernelError = null;
    this.root.directCarriers.set(childId, carrier);

    // Run immediate initial boot cycle so desktop & default window appear right away!
    meta.pendingDt = 0;
    meta.pendingBudgetGrant = Math.min(meta.grantFromParent, 14000);
    const bootRes = vm.step(meta.pendingBudgetGrant);
    carrier.cpuSelf += bootRes.selfConsumed || 0;
    carrier.cpuChildren += bootRes.childConsumed || 0;
    carrier.memBytes = vm.getMemoryBytes();
    carrier.remainingWork = vm.getRemainingWork();
    if (bootRes.status === 'error') {
      meta.state = 'kernel_error';
      meta.kernelError = bootRes.error;
    }
    return { ok: meta.state !== 'kernel_error', pid, error: meta.kernelError };
  }

  // Host port handler shared across ALL nested layers (Root -> L1 and Ln -> L(n+1) via host_child_bridge!)
  handleSubsystemHostCall(sysId, callName, args) {
    const meta = this.systems.get(sysId);
    if (!meta) return { value: null, cost: 1 };

    if (callName === 'host_boot_info') {
      const files = this.buildSubsystemInitialFileArray(sysId);
      const curNbc = this.savedSubsysFiles[sysId]?.['/System/compiler.nbc']?.content;
      const compilerHash =
        curNbc && curNbc !== this.bundle.nosFiles['/System/compiler.nbc']
          ? `custom_${curNbc.length}_${curNbc.slice(0, 48)}`
          : 'boot';
      return {
        value: {
          sysId: meta.id,
          name: meta.name,
          depth: meta.depth,
          totalBudget: meta.totalBudget,
          memQuota: meta.memQuota,
          storageQuota: meta.storageQuota,
          speed: meta.speed,
          compilerHash,
          initialFiles: files,
          retainedChildren: meta.retainedChildren || []
        },
        cost: 20 + files.length * 2
      };
    }

    if (callName === 'host_poll') {
      const dt = meta.pendingDt || 0;
      const budgetGranted = meta.pendingBudgetGrant || meta.grantFromParent;
      meta.pendingDt = 0;
      const events = meta.inputQueue.splice(0, meta.inputQueue.length);
      const cross = meta.crossMsgQueue.splice(0, meta.crossMsgQueue.length);
      return {
        value: {
          dt,
          budgetGranted,
          speed: meta.speed,
          totalBudget: meta.totalBudget,
          memQuota: meta.memQuota,
          storageQuota: meta.storageQuota,
          events,
          incomingCrossMsgs: cross
        },
        cost: 2 + events.length + cross.length
      };
    }

    if (callName === 'host_present') {
      const pkt = args[0];
      meta.lastPresent = pkt;
      if (pkt && pkt.sysInfo) {
        meta.vtime = Number(pkt.sysInfo.vtime || 0);
        meta.storageUsed = Number(pkt.sysInfo.storageUsed || 0);
      }
      return { value: true, cost: 6 };
    }

    if (callName === 'host_vfs_sync') {
      const [op, vPath, content] = args;
      if (!this.savedSubsysFiles[sysId]) {
        this.savedSubsysFiles[sysId] = this.buildDefaultVfsEntries(false);
      }
      const map = this.savedSubsysFiles[sysId];
      if (op === 'write') {
        map[vPath] = { type: 'file', content: String(content ?? ''), mtime: meta.vtime };
      } else if (op === 'mkdir') {
        map[vPath] = { type: 'dir', content: null, mtime: meta.vtime };
      } else if (op === 'delete') {
        delete map[vPath];
      } else if (op === 'move' && content) {
        if (map[vPath]) {
          map[content] = map[vPath];
          delete map[vPath];
        }
      }
      this.schedulePersist();
      return { value: true, cost: 4 + Math.ceil(String(content ?? '').length / 256) };
    }

    if (callName === 'host_compile_cache') {
      const [mode, key, bc] = args;
      if (mode === 'get') {
        return { value: this.compileCache.get(key) || null, cost: 2 };
      }
      if (mode === 'set' && key && bc) {
        this.compileCache.set(key, bc);
      }
      return { value: true, cost: 2 };
    }

    if (callName === 'host_child_bridge') {
      const [childSysId, childCallName, childArgs] = args;
      const childMeta = this.systems.get(childSysId);
      if (childMeta && childCallName === 'host_poll') {
        // Compute child dt & budget from parent's advancement!
        const parentAllowed = !this.isEffectivelyPaused(childSysId);
        childMeta.pendingDt = parentAllowed ? childMeta.pendingStepDt || 0 : 0;
        childMeta.pendingStepDt = 0;
        childMeta.pendingBudgetGrant = childMeta.grantFromParent;
      }
      return this.handleSubsystemHostCall(childSysId, childCallName, childArgs || []);
    }

    if (callName === 'host_cross_call') {
      const [kind, payload] = args;
      return this.handleCrossLayerService(sysId, kind, payload);
    }

    return { value: null, cost: 1 };
  }

  handleCrossLayerService(sysId, kind, payload) {
    const meta = this.systems.get(sysId);
    if (!meta) return { value: null, cost: 1 };

    // 1. Nested Child Subsystem Management (when inner-1 creates/manages inner-2, inner-3, ...)
    if (kind === 'subsys_prepare_create') {
      const childId = this.allocateNextSubsystemId();
      this.registerSubsystemMeta(childId, sysId);
      if (!meta.retainedChildren.includes(childId)) {
        meta.retainedChildren.push(childId);
      }
      return { value: { ok: true, childSysId: childId }, cost: 12 };
    }

    if (kind === 'subsys_prepare_restart') {
      const cid = payload.childSysId;
      this.resetSubtreeRuntimeBeforeRestart(cid);
      return { value: { ok: true }, cost: 6 };
    }

    if (kind === 'subsys_carrier_started') {
      const cMeta = this.systems.get(payload.childSysId);
      if (cMeta) {
        cMeta.carrierPid = payload.carrierPid;
        cMeta.state = cMeta.selfPaused ? 'paused' : 'running';
        cMeta.kernelError = null;
      }
      this.onStateChange({ type: 'tree_updated' });
      return { value: true, cost: 2 };
    }

    if (kind === 'subsys_kernel_error') {
      const cMeta = this.systems.get(payload.childSysId);
      if (cMeta) {
        cMeta.state = 'kernel_error';
        cMeta.kernelError = String(payload.error || '内核运行异常');
      }
      this.onStateChange({ type: 'kernel_error', sysId: payload.childSysId });
      return { value: true, cost: 2 };
    }

    if (kind === 'child_stopped') {
      const cMeta = this.systems.get(payload.childSysId);
      if (cMeta) {
        if (payload.error) {
          cMeta.state = 'kernel_error';
          cMeta.kernelError = String(payload.error);
        } else {
          this.markSubtreeStopped(payload.childSysId);
        }
      }
      this.onStateChange({ type: 'tree_updated' });
      return { value: true, cost: 4 };
    }

    if (kind === 'subsys_manage') {
      const { action, targetId, extra } = payload || {};
      if (action === 'ancestors') {
        return { value: this.getAncestors(sysId), cost: 2 };
      }
      if (action === 'list') {
        const list = [];
        for (const s of this.systems.values()) {
          if (s.parentId === sysId) {
            list.push({
              id: s.id,
              name: s.name,
              state: s.state,
              selfPaused: s.selfPaused,
              effectivelyPaused: this.isEffectivelyPaused(s.id),
              speed: s.speed,
              vtime: Math.round(s.vtime * 100) / 100,
              grant: s.grantFromParent,
              kernelError: s.kernelError
            });
          }
        }
        return { value: list, cost: 3 };
      }
      if (action === 'pause') {
        this.pauseSubsystem(targetId);
        return { value: { ok: true, message: `已暂停 ${targetId} 及其子树` }, cost: 2 };
      }
      if (action === 'resume') {
        this.resumeSubsystem(targetId);
        return { value: { ok: true, message: `已继续 ${targetId}` }, cost: 2 };
      }
      if (action === 'step') {
        const sr = this.stepPausedSubsystem(targetId);
        return { value: sr, cost: 4 };
      }
      if (action === 'set_speed' && extra) {
        this.setSubsystemSpeed(targetId, Number(extra.speed || 1));
        return { value: { ok: true, message: `已调整 ${targetId} 时间速率为 ${extra.speed}x` }, cost: 2 };
      }
      if (action === 'set_grant' && extra) {
        this.setSubsystemGrant(targetId, Number(extra.grant || 2000));
        return { value: { ok: true }, cost: 2 };
      }
      if (action === 'close') {
        this.closeSubsystem(targetId);
        return { value: { ok: true, message: `已关闭子系统 ${targetId}` }, cost: 6 };
      }
      if (action === 'snapshot') {
        const snapRes = this.createSubtreeSnapshot(sysId, targetId);
        return { value: snapRes, cost: snapRes.cost || 40 };
      }
      if (action === 'restore_snapshot' && extra && extra.snapPath) {
        const rr = this.restoreSnapshotFromParent(sysId, extra.snapPath, targetId);
        return { value: rr, cost: 40 };
      }
      if (action === 'fork_snapshot' && extra && extra.snapPath) {
        const fr = this.forkSnapshotFromParent(sysId, extra.snapPath);
        return { value: fr, cost: 50 };
      }
      return { value: { ok: true }, cost: 2 };
    }

    if (kind === 'sys_limits_updated' && payload) {
      meta.totalBudget = Number(payload.totalBudget || meta.totalBudget);
      meta.memQuota = Number(payload.memQuota || meta.memQuota);
      meta.storageQuota = Number(payload.storageQuota || meta.storageQuota);
      return { value: true, cost: 2 };
    }

    // 2. Cross-Layer Window Projection (Section 2.15)
    if (kind === 'project_open') {
      const projKey = `${sysId}::${payload.winId}`;
      const existing = this.projections.get(projKey);
      if (existing) {
        existing.targetSysId = payload.targetSysId || 'outer';
        existing.surface = payload.surface ? JSON.parse(JSON.stringify(payload.surface)) : existing.surface;
        this.onStateChange({ type: 'projection_focus', projKey, projection: existing });
        return { value: { ok: true, projWinId: existing.projWinId, existed: true }, cost: 8 };
      }
      const projWinId = `proj-${sysId}-${payload.winId}`;
      const isPlayerProj = payload.appId === 'player';
      const projIdx = this.projections.size % 4;
      const isOuterTarget = (payload.targetSysId || 'outer') === 'outer';
      const rec = {
        projKey,
        projWinId,
        targetSysId: payload.targetSysId || 'outer',
        sourceSystemId: sysId,
        sourceWindowId: payload.winId,
        sourceAppId: payload.appId,
        title: `投送视图 · [${sysId} / L${meta.depth}] ${isPlayerProj ? '三维场景播放器' : '实时图表工作台'}`,
        state: 'normal',
        x: (isOuterTarget ? (isPlayerProj ? 180 : 450) : 24) + projIdx * 28,
        y: (isOuterTarget ? (isPlayerProj ? 68 : 340) : 20) + projIdx * 22,
        w: isPlayerProj ? 760 : 680,
        h: isPlayerProj ? 500 : 430,
        restoreRect: null,
        surface: payload.surface ? JSON.parse(JSON.stringify(payload.surface)) : null
      };
      this.projections.set(projKey, rec);
      this.onStateChange({ type: 'projection_opened', projKey, projection: rec });
      return { value: { ok: true, projWinId }, cost: 16 };
    }

    if (kind === 'project_frame') {
      const projKey = `${sysId}::${payload.winId}`;
      const rec = this.projections.get(projKey);
      if (rec) {
        rec.surface = JSON.parse(JSON.stringify(payload.surface));
      }
      const serializedLen = payload.surface ? JSON.stringify(payload.surface).length : 64;
      return { value: true, cost: 6 + Math.ceil(serializedLen / 256) };
    }

    if (kind === 'project_close') {
      const projKey = `${sysId}::${payload.winId}`;
      if (this.projections.has(projKey)) {
        const rec = this.projections.get(projKey);
        this.projections.delete(projKey);
        this.pushRootNotification('跨层投送已结束', `${rec.title}：${payload.reason || '已关闭'}`);
        this.onStateChange({ type: 'projection_closed', projKey });
      }
      return { value: true, cost: 4 };
    }

    // 3. Live Spreadsheet Data Connection Service (Section 2.16)
    if (kind === 'chart_service') {
      const { action, payload: cp, callerPid } = payload || {};
      if (action === 'list_sources') {
        const wbs = [];
        for (const wb of this.openWorkbooks.values()) {
          wbs.push({ docId: wb.docId, title: wb.title, filePath: wb.filePath });
        }
        return { value: { workbooks: wbs }, cost: 3 };
      }
      if (action === 'subscribe') {
        let wb = this.openWorkbooks.get(cp.docId);
        if (!wb && this.openWorkbooks.size > 0) {
          wb = this.openWorkbooks.values().next().value;
        }
        if (!wb) {
          return { value: { ok: false, error: '当前根系统没有已打开的工作簿，请先在根系统打开工作簿' }, cost: 2 };
        }
        const snap = wb.extractRangeSnapshot(cp.range || 'A1:D4');
        if (!snap) {
          return { value: { ok: false, error: '选区格式无效（示例: A1:D4）' }, cost: 2 };
        }
        const subId = `sub_${this.nextSubSeq++}`;
        const subRec = {
          subId,
          docId: wb.docId,
          range: cp.range || 'A1:D4',
          targetSysId: sysId,
          targetWinId: cp.winId,
          targetPid: callerPid,
          lastDeliveredVersion: snap.version,
          backlog: [],
          restoredDisconnected: false
        };
        this.chartSubscriptions.set(subId, subRec);
        return { value: { ok: true, subId, snapshot: snap }, cost: 8 + snap.matrix.length * 2 };
      }
      if (action === 'unsubscribe' && cp && cp.subId) {
        this.chartSubscriptions.delete(cp.subId);
        return { value: { ok: true }, cost: 2 };
      }
      if (action === 'poll' && cp && cp.subId) {
        const sub = this.chartSubscriptions.get(cp.subId);
        if (!sub) {
          return { value: { updates: [], restoredDisconnected: true }, cost: 1 };
        }
        const updates = sub.backlog.splice(0, sub.backlog.length);
        return { value: { updates, restoredDisconnected: false }, cost: 1 + updates.length * 2 };
      }
      return { value: null, cost: 1 };
    }

    // 4. Host File Export / Import (Section 2.11)
    if (kind === 'host_file_io') {
      // Handled asynchronously from UI button in subsystem view; synchronous fallback returns status
      return { value: { ok: false, asyncRequired: true }, cost: 2 };
    }

    return { value: null, cost: 1 };
  }

  // ==========================================================================
  // Workbook Lifecycle & Live Subscription Publishing (Section 2.16)
  // ==========================================================================

  openRootWorkbook(filePath) {
    const np = normVfsPath(filePath);
    for (const wb of this.openWorkbooks.values()) {
      if (wb.filePath === np) return wb;
    }
    const raw = this.rootReadFile(np);
    const docId = `wb_${this.nextDocSeq++}`;
    const wb = new WorkbookModel(docId, np, raw);
    this.openWorkbooks.set(docId, wb);
    return wb;
  }

  createNewRootWorkbook(filePath = '/Documents/new_sheet.sheet') {
    const docId = `wb_${this.nextDocSeq++}`;
    const wb = new WorkbookModel(docId, normVfsPath(filePath), null);
    wb.dirty = true;
    this.openWorkbooks.set(docId, wb);
    return wb;
  }

  closeRootWorkbook(docId) {
    const wb = this.openWorkbooks.get(docId);
    if (!wb) return;
    this.openWorkbooks.delete(docId);

    // Notify all subscribed charts that source workbook closed (retaining received data!)
    for (const [subId, sub] of this.chartSubscriptions.entries()) {
      if (sub.docId === docId) {
        const msg = { subId, closed: true, title: wb.title, version: wb.publishVersion + 1 };
        if (this.isEffectivelyPaused(sub.targetSysId)) {
          sub.backlog.push(msg);
        } else {
          const tMeta = this.systems.get(sub.targetSysId);
          if (tMeta) {
            tMeta.crossMsgQueue.push({ kind: 'chart_push', targetPid: sub.targetPid, payload: msg });
          }
        }
        this.chartSubscriptions.delete(subId);
      }
    }
  }

  publishWorkbookUpdate(docId) {
    const wb = this.openWorkbooks.get(docId);
    if (!wb) return;
    this.chargeRootWork(wb.lastRecalcCost || 10);

    for (const sub of this.chartSubscriptions.values()) {
      if (sub.docId !== docId) continue;
      const tMeta = this.systems.get(sub.targetSysId);
      if (!tMeta || tMeta.state === 'stopped') continue;

      const snap = wb.extractRangeSnapshot(sub.range);
      if (!snap) continue;
      snap.subId = sub.subId;

      if (this.isEffectivelyPaused(sub.targetSysId)) {
        // Queue outside paused subtree in strict version order (Section 2.9 & 2.16.4)!
        sub.backlog.push(snap);
      } else {
        if (sub.backlog.length > 0) {
          for (const old of sub.backlog.splice(0, sub.backlog.length)) {
            tMeta.crossMsgQueue.push({ kind: 'chart_push', targetPid: sub.targetPid, payload: old });
          }
        }
        tMeta.crossMsgQueue.push({ kind: 'chart_push', targetPid: sub.targetPid, payload: snap });
      }
    }
  }

  // ==========================================================================
  // Subsystem Control: Pause, Resume, Single-Step, Speed, Restart, Close
  // ==========================================================================

  pauseSubsystem(sysId) {
    const meta = this.systems.get(sysId);
    if (!meta || sysId === 'outer' || meta.state === 'stopped') return;
    meta.selfPaused = true;
    if (meta.state === 'running') meta.state = 'paused';
    this.onStateChange({ type: 'tree_updated' });
  }

  resumeSubsystem(sysId) {
    const meta = this.systems.get(sysId);
    if (!meta || sysId === 'outer' || meta.state === 'stopped' || meta.state === 'kernel_error') return;
    meta.selfPaused = false;
    meta.state = 'running';

    // Flush any external spreadsheet updates queued while this subtree was paused!
    for (const sub of this.chartSubscriptions.values()) {
      if (!this.isEffectivelyPaused(sub.targetSysId) && sub.backlog.length > 0) {
        const tMeta = this.systems.get(sub.targetSysId);
        if (tMeta) {
          for (const snap of sub.backlog.splice(0, sub.backlog.length)) {
            tMeta.crossMsgQueue.push({ kind: 'chart_push', targetPid: sub.targetPid, payload: snap });
          }
        }
      }
    }
    this.onStateChange({ type: 'tree_updated' });
  }

  stepPausedSubsystem(sysId) {
    const meta = this.systems.get(sysId);
    if (!meta || sysId === 'outer') return { ok: false, message: '无效目标子系统' };
    if (!meta.selfPaused) return { ok: false, message: '仅暂停中的直属子系统可执行单步推进' };
    if (meta.parentId && this.isEffectivelyPaused(meta.parentId)) {
      return { ok: false, message: '父系统或祖先系统处于暂停状态，不能越级发起单步执行' };
    }

    // Temporarily lift selfPaused on `sysId` ONLY for one fixed logic step (50ms),
    // while keeping any descendants that have their own `selfPaused === true` paused!
    meta.selfPaused = false;
    meta.state = 'running';
    this.advanceSubtreeClocksForStep(sysId, FIXED_LOGIC_STEP_SEC);
    this.executeCarrierSliceForSubtree(sysId);
    meta.selfPaused = true;
    if (meta.state === 'running') meta.state = 'paused';
    this.onStateChange({ type: 'stepped', sysId });
    return { ok: true, message: `已对 ${sysId} 子树单步推进 ${FIXED_LOGIC_STEP_SEC * 1000}ms` };
  }

  advanceSubtreeClocksForStep(rootSubId, parentLogicDt) {
    const meta = this.systems.get(rootSubId);
    if (!meta || meta.selfPaused || meta.state !== 'running') return;
    const myDt = parentLogicDt * meta.speed;
    if (meta.parentId === 'outer') {
      meta.pendingDt += myDt;
    } else {
      meta.pendingStepDt = (meta.pendingStepDt || 0) + myDt;
    }
    for (const s of this.systems.values()) {
      if (s.parentId === rootSubId) {
        this.advanceSubtreeClocksForStep(s.id, myDt);
      }
    }
  }

  executeCarrierSliceForSubtree(sysId) {
    // Walk up to the direct Root carrier ancestor that hosts this subtree and step it!
    let top = this.systems.get(sysId);
    while (top && top.parentId && top.parentId !== 'outer') {
      top = this.systems.get(top.parentId);
    }
    if (!top) return;
    const carrier = this.root.directCarriers.get(top.id);
    if (!carrier || carrier.state === 'suspended') return;
    top.pendingBudgetGrant = carrier.grant;
    const res = carrier.vm.step(carrier.grant);
    carrier.cpuSelf += res.selfConsumed || 0;
    carrier.cpuChildren += res.childConsumed || 0;
    carrier.memBytes = carrier.vm.getMemoryBytes();
    carrier.remainingWork = carrier.vm.getRemainingWork();
    if (res.status === 'error') {
      top.state = 'kernel_error';
      top.kernelError = res.error;
    }
  }

  setSubsystemSpeed(sysId, speed) {
    const meta = this.systems.get(sysId);
    if (!meta) return;
    meta.speed = Math.max(0.1, Math.min(8.0, Number(speed || 1.0)));
    this.onStateChange({ type: 'tree_updated' });
  }

  setSubsystemGrant(sysId, grant) {
    const meta = this.systems.get(sysId);
    if (!meta) return;
    const g = Math.max(120, Math.floor(Number(grant || 1000)));
    meta.grantFromParent = g;
    if (meta.parentId === 'outer') {
      const c = this.root.directCarriers.get(sysId);
      if (c) c.grant = g;
    } else {
      const pMeta = this.systems.get(meta.parentId);
      if (pMeta) {
        pMeta.crossMsgQueue.push({ kind: 'parent_cmd', action: 'set_child_grant', childSysId: sysId, grant: g });
      }
    }
  }

  collectSubtreeIds(sysId, out = []) {
    out.push(sysId);
    for (const s of this.systems.values()) {
      if (s.parentId === sysId) this.collectSubtreeIds(s.id, out);
    }
    return out;
  }

  cleanupSubtreeExternalLinks(subtreeIds, reason) {
    const idSet = new Set(subtreeIds);
    for (const [projKey, rec] of this.projections.entries()) {
      if (idSet.has(rec.sourceSystemId) || idSet.has(rec.targetSysId)) {
        this.projections.delete(projKey);
        if (idSet.has(rec.sourceSystemId) && !idSet.has(rec.targetSysId)) {
          this.pushRootNotification('投送窗口已关闭', `${rec.title}：${reason}`);
        }
      }
    }
    for (const [subId, sub] of this.chartSubscriptions.entries()) {
      if (idSet.has(sub.targetSysId)) {
        this.chartSubscriptions.delete(subId);
      }
    }
  }

  resetSubtreeRuntimeBeforeRestart(sysId) {
    const ids = this.collectSubtreeIds(sysId);
    this.cleanupSubtreeExternalLinks(ids, '源子系统正在重启');
    for (const id of ids) {
      const m = this.systems.get(id);
      if (m) {
        m.vtime = 0;
        m.inputQueue = [];
        m.crossMsgQueue = [];
        m.lastPresent = null;
        m.kernelError = null;
        m.state = m.selfPaused ? 'paused' : 'running';
      }
    }
  }

  restartSubsystem(sysId) {
    const meta = this.systems.get(sysId);
    if (!meta || sysId === 'outer') return { ok: false };
    this.resetSubtreeRuntimeBeforeRestart(sysId);

    if (meta.parentId === 'outer') {
      this.root.directCarriers.delete(sysId);
      const r = this.bootRootChildCarrier(sysId);
      this.onStateChange({ type: 'restarted', sysId });
      return r;
    } else {
      const pMeta = this.systems.get(meta.parentId);
      if (pMeta) {
        pMeta.crossMsgQueue.push({ kind: 'parent_cmd', action: 'restart_child', childSysId: sysId });
      }
      this.onStateChange({ type: 'restarted', sysId });
      return { ok: true };
    }
  }

  markSubtreeStopped(sysId) {
    const ids = this.collectSubtreeIds(sysId);
    this.cleanupSubtreeExternalLinks(ids, '所属子树已停止');
    for (const id of ids) {
      const m = this.systems.get(id);
      if (m) {
        m.state = 'stopped';
        m.lastPresent = null;
      }
    }
  }

  closeSubsystem(sysId) {
    const meta = this.systems.get(sysId);
    if (!meta || sysId === 'outer') return;
    this.markSubtreeStopped(sysId);
    if (meta.parentId === 'outer') {
      this.root.directCarriers.delete(sysId);
    } else {
      const pMeta = this.systems.get(meta.parentId);
      if (pMeta) {
        pMeta.retainedChildren = (pMeta.retainedChildren || []).filter((x) => x !== sysId);
        pMeta.crossMsgQueue.push({ kind: 'parent_cmd', action: 'kill_child_carrier', childSysId: sysId });
      }
    }
    this.onStateChange({ type: 'subsystem_closed', sysId });
  }

  // ==========================================================================
  // Subtree Complete Snapshot, Restore & Fork (Section 2.12)
  // ==========================================================================

  findCarrierVmForSystem(sysId) {
    const meta = this.systems.get(sysId);
    if (!meta) return null;
    if (meta.parentId === 'outer') {
      const c = this.root.directCarriers.get(sysId);
      return c ? c.vm : null;
    }
    const parentVm = this.findCarrierVmForSystem(meta.parentId);
    if (!parentVm) return null;
    // Locate child carrier VM in parentVm.childVMs matching childSysId in parent's PROC_TABLE
    const parentExportedProcs = meta.parentId ? this.systems.get(meta.parentId)?.lastPresent?.processes : null;
    if (Array.isArray(parentExportedProcs)) {
      const pEntry = parentExportedProcs.find((p) => p.isCarrier && p.childSysId === sysId);
      if (pEntry) {
        // In kernel.nos each spawned VM gets sequential cid; match isKernel childVM
        for (const cvm of Object.values(parentVm.childVMs)) {
          if (cvm && cvm.isKernel) {
            const sysInfoGlobal = cvm.exportValue(cvm.globals.SYS_INFO);
            if (sysInfoGlobal && sysInfoGlobal.sysId === sysId) return cvm;
          }
        }
      }
    }
    for (const cvm of Object.values(parentVm.childVMs)) {
      if (cvm && cvm.isKernel) {
        const sysInfoGlobal = cvm.exportValue(cvm.globals.SYS_INFO);
        if (sysInfoGlobal && sysInfoGlobal.sysId === sysId) return cvm;
      }
    }
    return null;
  }

  createSubtreeSnapshot(parentSysId, targetSysId) {
    const targetVm = this.findCarrierVmForSystem(targetSysId);
    if (!targetVm) return { ok: false, message: '无法找到运行或暂停中的目标子系统虚拟机' };

    const subtreeIds = this.collectSubtreeIds(targetSysId);
    const metaTree = {};
    const vfsTree = {};
    for (const id of subtreeIds) {
      const m = this.systems.get(id);
      if (m) {
        metaTree[id] = {
          id: m.id,
          parentId: m.parentId,
          name: m.name,
          depth: m.depth,
          state: m.state,
          selfPaused: m.selfPaused,
          speed: m.speed,
          vtime: m.vtime,
          totalBudget: m.totalBudget,
          grantFromParent: m.grantFromParent,
          memQuota: m.memQuota,
          storageQuota: m.storageQuota,
          retainedChildren: [...(m.retainedChildren || [])],
          lastPresent: m.lastPresent ? JSON.parse(JSON.stringify(m.lastPresent)) : null
        };
      }
      if (this.savedSubsysFiles[id]) {
        vfsTree[id] = JSON.parse(JSON.stringify(this.savedSubsysFiles[id]));
      }
    }

    // Internal projections strictly within the subtree
    const internalProjections = [];
    const subSet = new Set(subtreeIds);
    for (const rec of this.projections.values()) {
      if (subSet.has(rec.sourceSystemId) && subSet.has(rec.targetSysId)) {
        internalProjections.push(JSON.parse(JSON.stringify(rec)));
      }
    }

    const snapObj = {
      magic: 'NESTEDOS_SUBTREE_SNAP_V1',
      createdAt: new Date().toISOString(),
      rootSubsysId: targetSysId,
      subtreeIds,
      metaTree,
      vfsTree,
      internalProjections,
      vmSnapshot: targetVm.serialize()
    };

    const jsonStr = JSON.stringify(snapObj);
    const snapName = `${targetSysId}-t${Math.round((this.systems.get(targetSysId)?.vtime || 0) * 10)}.snap`;
    const snapPath = `/Snapshots/${snapName}`;
    const snapCost = 45 + Math.ceil(jsonStr.length / 512);

    if (parentSysId === 'outer') {
      const wr = this.rootWriteFile(snapPath, jsonStr);
      if (!wr.ok) return { ok: false, message: wr.error, cost: snapCost };
      this.chargeRootWork(snapCost);
      this.pushRootNotification('已保存子树快照', `${snapPath} (${Math.round(jsonStr.length / 1024)} KB)`);
      return { ok: true, snapPath, message: `已创建快照 ${snapPath}`, cost: snapCost };
    } else {
      const pVm = this.findCarrierVmForSystem(parentSysId);
      if (pVm) {
        if (!this.savedSubsysFiles[parentSysId]) this.savedSubsysFiles[parentSysId] = {};
        const pMeta = this.systems.get(parentSysId);
        if (pMeta && pMeta.storageUsed + jsonStr.length * 2 > pMeta.storageQuota) {
          return { ok: false, message: 'E_STORAGE_QUOTA: 父子系统存储配额不足，无法写入快照' };
        }
        pMeta.crossMsgQueue.push({ kind: 'file_drop', dstPath: snapPath, content: jsonStr });
      }
      return { ok: true, snapPath, message: `已创建快照 ${snapPath}`, cost: snapCost };
    }
  }

  readParentFile(parentSysId, vPath) {
    if (parentSysId === 'outer') return this.rootReadFile(vPath);
    const map = this.savedSubsysFiles[parentSysId];
    return map && map[vPath] ? map[vPath].content : null;
  }

  restoreSnapshotObject(parentSysId, snapObj, targetInstanceId = null) {
    const origRootId = snapObj.rootSubsysId;
    const dstRootId = targetInstanceId || origRootId;
    if (dstRootId !== origRootId) {
      return this.forkSnapshotObject(parentSysId, snapObj);
    }

    // 1. Clean up current descendants of dstRootId that aren't in snapshot
    const existingIds = this.systems.has(dstRootId) ? this.collectSubtreeIds(dstRootId) : [];
    const snapIdSet = new Set(snapObj.subtreeIds);
    for (const eid of existingIds) {
      if (!snapIdSet.has(eid)) {
        this.systems.delete(eid);
      }
    }

    // 2. Restore metadata & saved VFS for all nodes in snapshot
    for (const id of snapObj.subtreeIds) {
      const sm = snapObj.metaTree[id];
      const restoredMeta = {
        ...JSON.parse(JSON.stringify(sm)),
        parentId: id === dstRootId ? parentSysId : sm.parentId,
        inputQueue: [],
        crossMsgQueue: [],
        pendingDt: 0,
        pendingBudgetGrant: 0,
        kernelError: null
      };
      this.systems.set(id, restoredMeta);
      if (snapObj.vfsTree && snapObj.vfsTree[id]) {
        this.savedSubsysFiles[id] = JSON.parse(JSON.stringify(snapObj.vfsTree[id]));
      }
    }

    // 3. Disconnect live Root chart subscriptions into this subtree so restored charts show "已恢复，待重新连接"
    for (const [subId, sub] of this.chartSubscriptions.entries()) {
      if (snapIdSet.has(sub.targetSysId)) {
        this.chartSubscriptions.delete(subId);
      }
    }

    // 4. Reconcile external projections (Section 2.12.2: keep external frame if sourceWindowId still exists, else close!)
    for (const [projKey, rec] of this.projections.entries()) {
      if (snapIdSet.has(rec.sourceSystemId) && !snapIdSet.has(rec.targetSysId)) {
        const srcMeta = this.systems.get(rec.sourceSystemId);
        const restoredSurfaces = srcMeta && srcMeta.lastPresent ? srcMeta.lastPresent.surfaces : null;
        if (restoredSurfaces && restoredSurfaces[rec.sourceWindowId]) {
          rec.surface = JSON.parse(JSON.stringify(restoredSurfaces[rec.sourceWindowId]));
        } else {
          this.projections.delete(projKey);
          this.pushRootNotification('投送已随快照恢复结束', '恢复时刻源窗口尚不存在');
        }
      } else if (snapIdSet.has(rec.sourceSystemId) && snapIdSet.has(rec.targetSysId)) {
        this.projections.delete(projKey);
      }
    }
    for (const ip of snapObj.internalProjections || []) {
      this.projections.set(ip.projKey, JSON.parse(JSON.stringify(ip)));
    }

    // 5. Deserialize VM tree at exact instruction pointer & variables!
    if (parentSysId === 'outer') {
      const rootMeta = this.systems.get(dstRootId);
      const restoredVm = NosVM.deserialize(snapObj.vmSnapshot, {
        hostHandler: (callName, args) => this.handleSubsystemHostCall(dstRootId, callName, args)
      });
      const existingCarrier = this.root.directCarriers.get(dstRootId);
      const pid = existingCarrier ? existingCarrier.pid : this.root.nextRootPid++;
      this.root.directCarriers.set(dstRootId, {
        pid,
        childSysId: dstRootId,
        vm: restoredVm,
        state: 'ready',
        grant: rootMeta.grantFromParent,
        cpuSelf: restoredVm.totalOpsSelf,
        cpuChildren: restoredVm.totalOpsChildren,
        memBytes: restoredVm.getMemoryBytes(),
        remainingWork: restoredVm.getRemainingWork()
      });
      rootMeta.carrierPid = pid;
    } else {
      const parentVm = this.findCarrierVmForSystem(parentSysId);
      if (parentVm) {
        for (const [cid, cvm] of Object.entries(parentVm.childVMs)) {
          if (cvm && cvm.isKernel) {
            const gInfo = cvm.exportValue(cvm.globals.SYS_INFO);
            if (gInfo && gInfo.sysId === dstRootId) {
              parentVm.childVMs[cid] = NosVM.deserialize(snapObj.vmSnapshot);
              break;
            }
          }
        }
      }
    }

    this.schedulePersist();
    this.onStateChange({ type: 'snapshot_restored', sysId: dstRootId });
    return { ok: true, sysId: dstRootId, message: `已将快照完整恢复至 ${dstRootId}` };
  }

  forkSnapshotObject(parentSysId, snapObj) {
    // Allocate fresh global IDs (inner-N, inner-(N+1), ...) for every node in the forked subtree!
    const idMap = {};
    for (const oldId of snapObj.subtreeIds) {
      idMap[oldId] = this.allocateNextSubsystemId();
    }

    let remappedJson = JSON.stringify(snapObj);
    // Replace longest IDs first (e.g. inner-12 before inner-1) so window IDs, VFS paths, and VM heap strings remap cleanly!
    const sortedOldIds = [...snapObj.subtreeIds].sort((a, b) => b.length - a.length);
    for (const oldId of sortedOldIds) {
      const newId = idMap[oldId];
      remappedJson = remappedJson.split(oldId).join(newId);
    }
    const forkedSnap = JSON.parse(remappedJson);
    const newRootId = forkedSnap.rootSubsysId;

    // Clear external projections from VM's PROJECTIONS map so fork starts with independent external links (Section 2.12.3)!
    for (const id of forkedSnap.subtreeIds) {
      const sm = forkedSnap.metaTree[id];
      const restoredMeta = {
        ...sm,
        parentId: id === newRootId ? parentSysId : sm.parentId,
        name: id === newRootId ? `子系统 ${id} (分叉)` : `子系统 ${id}`,
        inputQueue: [],
        crossMsgQueue: [],
        pendingDt: 0,
        pendingBudgetGrant: 0,
        kernelError: null
      };
      this.systems.set(id, restoredMeta);
      if (forkedSnap.vfsTree && forkedSnap.vfsTree[id]) {
        this.savedSubsysFiles[id] = forkedSnap.vfsTree[id];
      }
    }

    for (const ip of forkedSnap.internalProjections || []) {
      this.projections.set(ip.projKey, ip);
    }

    if (parentSysId === 'outer') {
      const kernelTemplate = this.rootReadFile('/System/kernel.nos') || this.bundle.nosFiles['/System/kernel.nos'];
      this.rootWriteFile(`/Subsystems/${newRootId}/kernel.nos`, kernelTemplate);

      const rootMeta = this.systems.get(newRootId);
      const forkedVm = NosVM.deserialize(forkedSnap.vmSnapshot, {
        hostHandler: (callName, args) => this.handleSubsystemHostCall(newRootId, callName, args)
      });
      // Clear external projection registrations inside forked VM so original subtree keeps its projections
      forkedVm.globals.PROJECTIONS = forkedVm.allocObject({});

      const pid = this.root.nextRootPid++;
      this.root.directCarriers.set(newRootId, {
        pid,
        childSysId: newRootId,
        vm: forkedVm,
        state: 'ready',
        grant: rootMeta.grantFromParent,
        cpuSelf: forkedVm.totalOpsSelf,
        cpuChildren: forkedVm.totalOpsChildren,
        memBytes: forkedVm.getMemoryBytes(),
        remainingWork: forkedVm.getRemainingWork()
      });
      rootMeta.carrierPid = pid;
    } else {
      // Forking inside a nested subsystem
      const parentVm = this.findCarrierVmForSystem(parentSysId);
      const pMeta = this.systems.get(parentSysId);
      if (parentVm && pMeta) {
        pMeta.retainedChildren.push(newRootId);
        // Spawn a carrier slot in parent kernel and replace its VM state with forkedVm!
        this.bootRootOrNestedFork(parentSysId, parentVm, newRootId, forkedSnap.vmSnapshot);
      }
    }

    this.schedulePersist();
    this.onStateChange({ type: 'snapshot_forked', sysId: newRootId, parentId: parentSysId });
    return { ok: true, sysId: newRootId, message: `已从快照分叉启动独立子树 ${newRootId}` };
  }

  bootRootOrNestedFork(parentSysId, parentVm, newRootId, vmSnapshot) {
    const forkedChildVm = NosVM.deserialize(vmSnapshot);
    forkedChildVm.globals.PROJECTIONS = forkedChildVm.allocObject({});
    const cid = parentVm.nextChildVmId++;
    parentVm.childVMs[cid] = forkedChildVm;

    // Register carrier entry in parent kernel's PROC_TABLE & CHILD_SYSTEMS globals
    const procTableRef = parentVm.globals.PROC_TABLE;
    const procTableCell = parentVm.deref(procTableRef);
    const pid = Number(parentVm.globals.NEXT_PID || 50);
    parentVm.globals.NEXT_PID = pid + 1;
    if (procTableCell && procTableCell.type === 'arr') {
      procTableCell.items.push(
        parentVm.importValue({
          pid,
          vmId: cid,
          name: 'carrier:' + newRootId,
          progPath: `/Subsystems/${newRootId}/kernel.nos`,
          role: null,
          isCarrier: true,
          childSysId: newRootId,
          parentPid: 0,
          state: 'ready',
          prevWaitState: null,
          wakeAt: 0,
          quota: 6000,
          memQuota: 16 * 1024 * 1024,
          cpuSelf: 0,
          cpuChildren: 0,
          remainingWork: 0,
          memBytes: forkedChildVm.getMemoryBytes(),
          msgQueue: [],
          nextMsgSeq: 1,
          logs: [],
          lastResult: null,
          error: null
        })
      );
    }
    const childSysMap = parentVm.deref(parentVm.globals.CHILD_SYSTEMS);
    if (childSysMap && childSysMap.type === 'obj') {
      childSysMap.entries[newRootId] = pid;
    }
    const pMeta = this.systems.get(parentSysId);
    if (pMeta) {
      pMeta.inputQueue.push({ type: 'open_subsys_win', childSysId: newRootId });
    }
  }

  restoreSnapshotFromParent(parentSysId, snapPath, targetInstanceId = null) {
    const raw = this.readParentFile(parentSysId, snapPath);
    if (!raw) return { ok: false, message: '找不到快照文件: ' + snapPath };
    try {
      const snapObj = JSON.parse(raw);
      if (!snapObj || snapObj.magic !== 'NESTEDOS_SUBTREE_SNAP_V1') {
        return { ok: false, message: '快照文件格式无效' };
      }
      return this.restoreSnapshotObject(parentSysId, snapObj, targetInstanceId);
    } catch (e) {
      return { ok: false, message: '解析快照失败: ' + String(e.message || e) };
    }
  }

  forkSnapshotFromParent(parentSysId, snapPath) {
    const raw = this.readParentFile(parentSysId, snapPath);
    if (!raw) return { ok: false, message: '找不到快照文件: ' + snapPath };
    try {
      const snapObj = JSON.parse(raw);
      if (!snapObj || snapObj.magic !== 'NESTEDOS_SUBTREE_SNAP_V1') {
        return { ok: false, message: '快照文件格式无效' };
      }
      return this.forkSnapshotObject(parentSysId, snapObj);
    } catch (e) {
      return { ok: false, message: '分叉快照失败: ' + String(e.message || e) };
    }
  }

  // ==========================================================================
  // Input Routing & Cross-Layer File Drag-and-Drop
  // ==========================================================================

  sendSubsystemEvent(sysId, eventObj) {
    const meta = this.systems.get(sysId);
    if (!meta || this.isEffectivelyPaused(sysId)) return false;
    meta.inputQueue.push(eventObj);
    return true;
  }

  sendProjectionInput(projKey, eventPayload) {
    const rec = this.projections.get(projKey);
    if (!rec) return false;
    if (this.isEffectivelyPaused(rec.sourceSystemId)) return false;
    const srcMeta = this.systems.get(rec.sourceSystemId);
    if (!srcMeta) return false;
    srcMeta.crossMsgQueue.push({
      kind: 'proj_input',
      winId: rec.sourceWindowId,
      event: eventPayload
    });
    return true;
  }

  closeProjectionWindowOnly(projKey) {
    const rec = this.projections.get(projKey);
    if (!rec) return;
    this.projections.delete(projKey);
    const srcMeta = this.systems.get(rec.sourceSystemId);
    if (srcMeta) {
      srcMeta.crossMsgQueue.push({ kind: 'proj_closed_by_target', winId: rec.sourceWindowId });
    }
    this.onStateChange({ type: 'projection_closed', projKey });
  }

  transferFileAcrossSystems(srcSysId, srcPath, dstSysId, dstDir, overwrite = false) {
    let content = null;
    if (srcSysId === 'outer') {
      content = this.rootReadFile(srcPath);
    } else {
      const map = this.savedSubsysFiles[srcSysId];
      content = map && map[normVfsPath(srcPath)] ? map[normVfsPath(srcPath)].content : null;
    }
    if (content === null || content === undefined) {
      return { ok: false, error: '无法读取源文件: ' + srcPath };
    }

    const fileName = baseVfsName(srcPath);
    const targetPath = normVfsPath((dstDir === '/' ? '' : dstDir) + '/' + fileName);

    if (dstSysId === 'outer') {
      if (!overwrite && this.rootReadFile(targetPath) !== null) {
        return { ok: false, duplicate: true, targetPath };
      }
      const wr = this.rootWriteFile(targetPath, content);
      if (!wr.ok) {
        this.pushRootNotification('跨层文件传递失败', wr.error);
        return wr;
      }
      this.pushRootNotification('跨层文件传递完成', `${srcSysId}:${srcPath} -> outer:${targetPath}`);
      return { ok: true, targetPath };
    }

    const dstMeta = this.systems.get(dstSysId);
    if (!dstMeta || dstMeta.state === 'stopped') {
      return { ok: false, error: '目标子系统不可用' };
    }
    const dstMap = this.savedSubsysFiles[dstSysId] || {};
    if (!overwrite && dstMap[targetPath] && dstMap[targetPath].type === 'file') {
      return { ok: false, duplicate: true, targetPath };
    }
    const neededBytes = String(content).length * 2 + 32;
    const prevBytes = dstMap[targetPath] && dstMap[targetPath].content ? dstMap[targetPath].content.length * 2 + 32 : 0;
    if (dstMeta.storageUsed - prevBytes + neededBytes > dstMeta.storageQuota) {
      this.pushRootNotification('存储配额不足', `子系统 ${dstSysId} 存储配额不足，文件投放失败`);
      return { ok: false, error: `E_STORAGE_QUOTA: 目标子系统 ${dstSysId} 存储配额不足` };
    }

    dstMeta.crossMsgQueue.push({
      kind: 'file_drop',
      dstPath: targetPath,
      content: String(content)
    });
    return { ok: true, targetPath };
  }

  // ==========================================================================
  // Main Logic Step Tick (Driven by Hybrid Heartbeat + rAF Loop)
  // ==========================================================================

  tickStep(realDeltaSec) {
    const dt = Math.min(0.1, Math.max(0.01, realDeltaSec));
    this.root.vtime += dt * this.root.speed;
    let remainingRootBudget = this.root.totalBudget;

    // 1. Run Root custom programs
    const customUsed = this.stepRootCustomProcs(Math.floor(remainingRootBudget * 0.25));
    remainingRootBudget = Math.max(0, remainingRootBudget - customUsed);

    // 2. Advance virtual clock deltas down active subtrees & schedule Root's direct carrier VMs fairly!
    const carriers = Array.from(this.root.directCarriers.values()).filter((c) => {
      const m = this.systems.get(c.childSysId);
      return m && m.state !== 'stopped' && m.state !== 'kernel_error' && c.state !== 'suspended';
    });

    for (const c of carriers) {
      const m = this.systems.get(c.childSysId);
      if (m && !m.selfPaused) {
        this.advanceSubtreeClocksForStep(m.id, dt * this.root.speed);
      }
    }

    let carrierTotalUsed = 0;
    if (carriers.length > 0 && remainingRootBudget > 0) {
      // Share parent's remaining budget fairly across sibling subtrees, bounded by each carrier's grant cap!
      const fairShare = Math.floor(remainingRootBudget / carriers.length);
      for (const c of carriers) {
        const m = this.systems.get(c.childSysId);
        if (!m || m.selfPaused) continue;
        const allowed = Math.min(c.grant, fairShare, remainingRootBudget - carrierTotalUsed);
        if (allowed <= 0) break;
        m.pendingBudgetGrant = allowed;
        const stepRes = c.vm.step(allowed);
        carrierTotalUsed += stepRes.consumed;
        c.cpuSelf += stepRes.selfConsumed || 0;
        c.cpuChildren += stepRes.childConsumed || 0;
        c.memBytes = c.vm.getMemoryBytes();
        c.remainingWork = c.vm.getRemainingWork();
        if (stepRes.status === 'error') {
          m.state = 'kernel_error';
          m.kernelError = stepRes.error;
          this.onStateChange({ type: 'kernel_error', sysId: m.id });
        }
      }
    }

    this.root.lastUsedBudget = customUsed + carrierTotalUsed;
  }
}
