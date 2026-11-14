import { compileNScript } from '../../shared/nscript/compiler.js';
import { createVM, stepVM, resumeSyscall, deepCloneValue } from '../../shared/nscript/vm.js';
import { serializeGraph, deserializeGraph } from '../../shared/nscript/snapshot.js';
import { createSampleSheetContent } from '../../shared/fixtures/sample_sheet.js';
import { createHelicopterSceneContent } from '../../shared/fixtures/helicopter_scene.js';
import {
  COMPILER_NS_SOURCE,
  KERNEL_NS_SOURCE,
  WM_NS_SOURCE,
  FILES_NS_SOURCE,
  EDITOR_NS_SOURCE,
  TASKS_NS_SOURCE,
  PLAYER_SEQ_NS_SOURCE,
  PLAYER_SCENE_NS_SOURCE,
  PLAYER_FX_NS_SOURCE,
  FLIGHT_CTRL_NS_SOURCE,
  CHART_RECV_NS_SOURCE,
  CHART_DRAW_NS_SOURCE,
  DEMO_CALC_NS_SOURCE,
  DEMO_BUSY_NS_SOURCE,
  DEMO_MSG_SENDER_NS_SOURCE,
  DEMO_MSG_RECEIVER_NS_SOURCE,
  MINIMAL_SCENE_EXAMPLE,
  createDefaultSubsystemVfsSeed
} from '../../shared/fixtures/nscript_sources.js';

export const SUBSYSTEM_STEP_MS = 50; // 暂停子树单步固定逻辑步长 (50 ms)

function precompileDefaults() {
  const map = {};
  const entries = [
    ['/System/compiler.ns', COMPILER_NS_SOURCE],
    ['/System/kernel.ns', KERNEL_NS_SOURCE],
    ['/System/wm.ns', WM_NS_SOURCE],
    ['/System/files.ns', FILES_NS_SOURCE],
    ['/System/editor.ns', EDITOR_NS_SOURCE],
    ['/System/tasks.ns', TASKS_NS_SOURCE],
    ['/System/player_seq.ns', PLAYER_SEQ_NS_SOURCE],
    ['/System/player_scene.ns', PLAYER_SCENE_NS_SOURCE],
    ['/System/player_fx.ns', PLAYER_FX_NS_SOURCE],
    ['/System/flight_ctrl.ns', FLIGHT_CTRL_NS_SOURCE],
    ['/System/chart_recv.ns', CHART_RECV_NS_SOURCE],
    ['/System/chart_draw.ns', CHART_DRAW_NS_SOURCE],
    ['/Demo/calc_loop.ns', DEMO_CALC_NS_SOURCE],
    ['/Demo/busy_loop.ns', DEMO_BUSY_NS_SOURCE],
    ['/Demo/msg_sender.ns', DEMO_MSG_SENDER_NS_SOURCE],
    ['/Demo/msg_receiver.ns', DEMO_MSG_RECEIVER_NS_SOURCE]
  ];
  for (const [p, src] of entries) {
    map[p] = compileNScript(src, { compilerId: 'self-1' });
  }
  return map;
}

const PRECOMPILED_CACHE = precompileDefaults();

export class HostKernel {
  constructor() {
    this.listeners = new Set();
    this.displayDevice = null;
    this.resetInMemory();
  }

  setDisplayDevice(dev) {
    this.displayDevice = dev;
  }

  on(eventOrCb, maybeCb) {
    let entry;
    if (typeof eventOrCb === 'string' && typeof maybeCb === 'function') {
      entry = (ev, payload) => {
        if (ev === eventOrCb) maybeCb(payload, ev);
      };
    } else if (typeof eventOrCb === 'function') {
      entry = eventOrCb;
    } else {
      return () => {};
    }
    this.listeners.add(entry);
    return () => this.listeners.delete(entry);
  }

  emit(event, payload) {
    for (const cb of this.listeners) {
      try {
        cb(event, payload);
      } catch (e) {
        console.error('HostKernel listener error:', e);
      }
    }
  }

  resetInMemory() {
    this.nextSystemSeq = 1;
    this.nextSubId = 1;
    this.nextProjSeq = 1;
    this.rootVirtualTime = 0;

    this.settings = {
      systemName: '叠境根系统 (Outer)',
      wallpaper: 'alpine-horizon',
      accentColor: '#38bdf8',
      uiScale: 1.0,
      notificationsEnabled: true
    };

    this.rootQuotas = {
      totalBudget: 240000,
      memQuota: 64 * 1024 * 1024,
      storageQuota: 32 * 1024 * 1024
    };

    this.rootTelemetry = {
      budgetUsedLastTick: 0,
      rootAppCost: 0,
      childrenCost: 0,
      memUsed: 4 * 1024 * 1024,
      storageUsed: 0
    };

    this.rootVfs = this.createInitialRootVfs();
    this.recalcRootStorage();

    // Subsystem registry: sysId -> SubsystemHostSlot
    this.subsystems = new Map();
    // Root direct child configs (grantCap, paused, timeRate, state, etc.)
    this.rootChildConfigs = new Map();

    // Cross-layer live spreadsheet workbooks & subscriptions
    this.workbooks = new Map();
    this.subscriptions = new Map();

    // Cross-layer projection registry
    this.projections = new Map(); // projWinId -> projection record

    // Root desktop state (synced by root_desktop.js for inspect & notifications)
    this.rootWindows = new Map();
    this.rootBrowsers = []; // [{ windowId, tabId, url, loadState }]
    this.notifications = [];
    this.clipboardHistory = [];
    this.stickyNoteText = '欢迎使用叠境操作系统！\n可在此记录实验步骤、观察子系统调度与飞行排演结果。';
  }

  createInitialRootVfs() {
    const vfs = {};
    const addDir = (p) => { vfs[p] = { type: 'dir', mtime: 0, size: 0 }; };
    const addFile = (p, content) => {
      vfs[p] = { type: 'file', content, size: content.length, mtime: 0 };
    };

    addDir('/');
    addDir('/Desktop');
    addDir('/Documents');
    addDir('/Downloads');
    addDir('/Demo');
    addDir('/Systems');
    addDir('/RecycleBin');

    addFile('/Demo/sample.sheet', createSampleSheetContent());
    addFile('/Demo/helicopter-24.scene', createHelicopterSceneContent());
    addFile('/Demo/minimal.scene', MINIMAL_SCENE_EXAMPLE);
    addFile('/Demo/calc_loop.ns', DEMO_CALC_NS_SOURCE);
    addFile('/Demo/busy_loop.ns', DEMO_BUSY_NS_SOURCE);
    addFile('/Documents/welcome.txt', '叠境根系统文档目录\n支持与各层子系统文件管理器之间双向拖放文件。\n');
    addFile('/Downloads/notes.txt', '下载目录预置说明文件。\n');

    return vfs;
  }

  recalcRootStorage() {
    let total = 0;
    for (const node of Object.values(this.rootVfs)) {
      if (node.type === 'file') total += node.size || 0;
    }
    this.rootTelemetry.storageUsed = total;
    return total;
  }

  getRootStorageUsed() {
    return this.recalcRootStorage();
  }

  rootStat(filePath) {
    const np = this.normPath(filePath);
    const node = this.rootVfs[np];
    if (!node) return null;
    return {
      type: node.type,
      size: node.size || 0,
      mtime: node.mtime || 0,
      origPath: node.origPath
    };
  }

  // ==================== Root VFS Operations ====================
  normPath(p) {
    if (typeof p !== 'string' || !p) return '/';
    const parts = p.split('/');
    const stack = [];
    for (const seg of parts) {
      if (!seg || seg === '.') continue;
      if (seg === '..') stack.pop();
      else stack.push(seg);
    }
    return stack.length === 0 ? '/' : '/' + stack.join('/');
  }

  parentPath(p) {
    const np = this.normPath(p);
    if (np === '/') return '/';
    const parts = np.split('/');
    parts.pop();
    return parts.length <= 1 ? '/' : parts.join('/');
  }

  baseName(p) {
    const np = this.normPath(p);
    if (np === '/') return '/';
    const parts = np.split('/');
    return parts[parts.length - 1];
  }

  ensureRootDirs(dirPath) {
    const np = this.normPath(dirPath);
    if (np === '/') return;
    const parts = np.split('/').slice(1);
    let cur = '';
    for (const seg of parts) {
      cur += '/' + seg;
      if (!this.rootVfs[cur]) {
        this.rootVfs[cur] = { type: 'dir', mtime: Date.now(), size: 0 };
      }
    }
  }

  rootList(dirPath) {
    const np = this.normPath(dirPath);
    if (!this.rootVfs[np] || this.rootVfs[np].type !== 'dir') return [];
    const out = [];
    for (const [k, node] of Object.entries(this.rootVfs)) {
      if (k === '/') continue;
      if (this.parentPath(k) === np) {
        out.push({
          name: this.baseName(k),
          path: k,
          type: node.type,
          size: node.size || 0,
          mtime: node.mtime || 0,
          origPath: node.origPath
        });
      }
    }
    out.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    return out;
  }

  rootRead(filePath) {
    const np = this.normPath(filePath);
    const node = this.rootVfs[np];
    if (!node) return { ok: false, error: '文件不存在: ' + np };
    if (node.type !== 'file') return { ok: false, error: '目标不是文件: ' + np };
    return { ok: true, content: node.content, size: node.size, mtime: node.mtime };
  }

  rootWrite(filePath, content) {
    const np = this.normPath(filePath);
    const text = typeof content === 'string' ? content : String(content ?? '');
    const newSize = text.length;
    const oldSize = this.rootVfs[np]?.type === 'file' ? this.rootVfs[np].size : 0;
    const delta = newSize - oldSize;
    if (this.rootTelemetry.storageUsed + delta > this.rootQuotas.storageQuota) {
      return { ok: false, error: '根系统存储配额不足' };
    }
    this.ensureRootDirs(this.parentPath(np));
    this.rootVfs[np] = { type: 'file', content: text, size: newSize, mtime: Date.now() };
    this.rootTelemetry.storageUsed += delta;
    this.emit('vfs_changed', { sysId: 'outer', path: np });
    return { ok: true, path: np, size: newSize };
  }

  rootMkdir(dirPath) {
    const np = this.normPath(dirPath);
    if (this.rootVfs[np]) return { ok: false, error: '路径已存在' };
    this.ensureRootDirs(np);
    this.emit('vfs_changed', { sysId: 'outer', path: np });
    return { ok: true, path: np };
  }

  rootDelete(targetPath, permanent = false) {
    const np = this.normPath(targetPath);
    const node = this.rootVfs[np];
    if (!node || np === '/') return { ok: false, error: '路径不存在' };
    if (permanent || np.startsWith('/RecycleBin/')) {
      const prefix = np + '/';
      for (const k of Object.keys(this.rootVfs)) {
        if (k === np || k.startsWith(prefix)) {
          if (this.rootVfs[k].type === 'file') this.rootTelemetry.storageUsed -= this.rootVfs[k].size;
          delete this.rootVfs[k];
        }
      }
      this.emit('vfs_changed', { sysId: 'outer', path: np });
      return { ok: true };
    }
    const base = this.baseName(np);
    let trashPath = '/RecycleBin/' + base;
    let seq = 1;
    while (this.rootVfs[trashPath]) {
      trashPath = `/RecycleBin/${base}_${seq++}`;
    }
    if (node.type === 'file') {
      this.rootVfs[trashPath] = { ...node, origPath: np, mtime: Date.now() };
      delete this.rootVfs[np];
    } else {
      const prefix = np + '/';
      this.rootVfs[trashPath] = { type: 'dir', mtime: Date.now(), size: 0, origPath: np };
      for (const k of Object.keys(this.rootVfs)) {
        if (k.startsWith(prefix)) {
          const rel = k.slice(np.length);
          this.rootVfs[trashPath + rel] = deepCloneValue(this.rootVfs[k]);
          delete this.rootVfs[k];
        }
      }
      delete this.rootVfs[np];
    }
    this.emit('vfs_changed', { sysId: 'outer', path: np });
    return { ok: true, trashPath };
  }

  rootRestore(trashPath) {
    const tp = this.normPath(trashPath);
    const node = this.rootVfs[tp];
    if (!node) return { ok: false, error: '回收站条目不存在' };
    let dst = node.origPath || ('/Documents/' + this.baseName(tp));
    if (this.rootVfs[dst]) dst += '.restored';
    this.ensureRootDirs(this.parentPath(dst));
    if (node.type === 'file') {
      this.rootVfs[dst] = { type: 'file', content: node.content, size: node.size, mtime: Date.now() };
      delete this.rootVfs[tp];
    } else {
      const prefix = tp + '/';
      this.rootVfs[dst] = { type: 'dir', mtime: Date.now(), size: 0 };
      for (const k of Object.keys(this.rootVfs)) {
        if (k.startsWith(prefix)) {
          const rel = k.slice(tp.length);
          this.rootVfs[dst + rel] = deepCloneValue(this.rootVfs[k]);
          delete this.rootVfs[k];
        }
      }
      delete this.rootVfs[tp];
    }
    this.emit('vfs_changed', { sysId: 'outer', path: dst });
    return { ok: true, path: dst };
  }

  rootRename(oldPath, newName) {
    const op = this.normPath(oldPath);
    if (!this.rootVfs[op] || op === '/') return { ok: false, error: '路径不存在' };
    const np = this.normPath(this.parentPath(op) + '/' + newName);
    if (this.rootVfs[np]) return { ok: false, error: '目标名称已存在' };
    const node = this.rootVfs[op];
    if (node.type === 'file') {
      this.rootVfs[np] = node;
      delete this.rootVfs[op];
    } else {
      const prefix = op + '/';
      this.rootVfs[np] = node;
      for (const k of Object.keys(this.rootVfs)) {
        if (k.startsWith(prefix)) {
          const rel = k.slice(op.length);
          this.rootVfs[np + rel] = this.rootVfs[k];
          delete this.rootVfs[k];
        }
      }
      delete this.rootVfs[op];
    }
    this.emit('vfs_changed', { sysId: 'outer', path: np });
    return { ok: true, path: np };
  }

  rootCopy(srcPath, dstPath) {
    const sp = this.normPath(srcPath);
    const dp = this.normPath(dstPath);
    const node = this.rootVfs[sp];
    if (!node) return { ok: false, error: '源文件不存在' };
    if (node.type === 'file') return this.rootWrite(dp, node.content);
    this.ensureRootDirs(dp);
    const prefix = sp + '/';
    for (const k of Object.keys(this.rootVfs)) {
      if (k.startsWith(prefix)) {
        const rel = k.slice(sp.length);
        if (this.rootVfs[k].type === 'dir') this.ensureRootDirs(dp + rel);
        else {
          const r = this.rootWrite(dp + rel, this.rootVfs[k].content);
          if (!r.ok) return r;
        }
      }
    }
    return { ok: true, path: dp };
  }

  // ==================== Notifications & Clipboard ====================
  pushNotification(title, body, category = 'system') {
    const item = {
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      title,
      body,
      category,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      read: false
    };
    this.notifications.unshift(item);
    if (this.notifications.length > 50) this.notifications.length = 50;
    this.emit('notification', item);
    return item;
  }

  pushClipboard(text, source = 'system') {
    if (typeof text !== 'string' || text.length === 0) return;
    if (this.clipboardHistory[0]?.text === text) return;
    this.clipboardHistory.unshift({
      id: 'clip-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      text,
      source,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false })
    });
    if (this.clipboardHistory.length > 30) this.clipboardHistory.length = 30;
    this.emit('clipboard', this.clipboardHistory);
  }

  // ==================== Cross-Layer Workbook Subscriptions (2.16) ====================
  registerWorkbook(wb) {
    this.workbooks.set(wb.docId, wb);
    this.emit('workbooks_changed');
  }

  publishWorkbookUpdate(docId) {
    const wb = this.workbooks.get(docId);
    if (!wb) return;
    wb.version = (wb.version || 0) + 1;
    for (const sub of this.subscriptions.values()) {
      if (sub.docId === docId && !sub.closed) {
        const data = deepCloneValue(wb.getRangeData(sub.rangeStr));
        sub.queue.push({ version: wb.version, data });
      }
    }
  }

  closeWorkbook(docId) {
    const wb = this.workbooks.get(docId);
    if (wb) wb.closed = true;
    for (const sub of this.subscriptions.values()) {
      if (sub.docId === docId && !sub.closed) {
        sub.closed = true;
        sub.queue.push({ closed: true });
      }
    }
    this.workbooks.delete(docId);
    this.emit('workbooks_changed');
  }

  listOpenWorkbooks() {
    const res = [];
    for (const wb of this.workbooks.values()) {
      if (!wb.closed) {
        res.push({ docId: wb.docId, title: wb.title, path: wb.path || '' });
      }
    }
    return res;
  }

  // ==================== Subsystem Creation, Boot, Control ====================
  getDefaultQuotasForDepth(depth) {
    const table = {
      1: { totalBudget: 160000, grantCap: 160000, memQuota: 16 * 1024 * 1024, storageQuota: 8 * 1024 * 1024 },
      2: { totalBudget: 100000, grantCap: 100000, memQuota: 12 * 1024 * 1024, storageQuota: 6 * 1024 * 1024 },
      3: { totalBudget: 65000, grantCap: 65000, memQuota: 8 * 1024 * 1024, storageQuota: 4 * 1024 * 1024 },
      4: { totalBudget: 42000, grantCap: 42000, memQuota: 6 * 1024 * 1024, storageQuota: 3 * 1024 * 1024 }
    };
    if (table[depth]) return { ...table[depth] };
    const f = Math.pow(0.65, depth - 1);
    return {
      totalBudget: Math.max(8000, Math.floor(160000 * f)),
      grantCap: Math.max(8000, Math.floor(160000 * f)),
      memQuota: Math.max(2 * 1024 * 1024, Math.floor(16 * 1024 * 1024 * f)),
      storageQuota: Math.max(1024 * 1024, Math.floor(8 * 1024 * 1024 * f))
    };
  }

  allocateSubsystemSlot(parentId, customGrant = null) {
    const id = 'inner-' + this.nextSystemSeq++;
    const parentSlot = parentId === 'outer' ? null : this.subsystems.get(parentId);
    const depth = parentSlot ? parentSlot.depth + 1 : 1;
    const def = this.getDefaultQuotasForDepth(depth);
    const slot = {
      id,
      name: id,
      parentId,
      depth,
      kernelPath: `/Systems/${id}/kernel.ns`,
      state: 'stopped',
      paused: false,
      timeRate: 1.0,
      grantCap: customGrant || def.grantCap,
      totalBudget: def.totalBudget,
      memQuota: def.memQuota,
      storageQuota: def.storageQuota,
      kernelError: null,
      kernelVm: null,
      lastReportedKernelSteps: 0,
      vmPool: {},
      nextVmId: 10,
      pendingInputs: [],
      pendingCrossInputs: [],
      pendingStepMs: 0,
      lastDesktop: null,
      appUIs: {},
      scene3dResources: {},
      scene3dFrames: {},
      scene3dFx: {},
      telemetry: {
        sysId: id,
        virtualTime: 0,
        timeRate: 1.0,
        totalBudget: def.totalBudget,
        effectiveGrant: 0,
        remainingBudget: 0,
        kernelCost: 0,
        userCost: 0,
        childrenCost: 0,
        memQuota: def.memQuota,
        memUsed: 0,
        storageQuota: def.storageQuota,
        storageUsed: 0
      }
    };
    this.subsystems.set(id, slot);
    return slot;
  }

  createRootChildSubsystem(customGrant = null) {
    const slot = this.allocateSubsystemSlot('outer', customGrant);
    const wr = this.rootWrite(slot.kernelPath, KERNEL_NS_SOURCE);
    if (!wr.ok) {
      this.subsystems.delete(slot.id);
      return wr;
    }
    this.rootChildConfigs.set(slot.id, {
      id: slot.id,
      grantCap: slot.grantCap,
      paused: false,
      timeRate: 1.0
    });
    const res = this.startRootChildSubsystem(slot.id);
    this.emit('systems_changed');
    return res;
  }

  startRootChildSubsystem(sysId) {
    const slot = this.subsystems.get(sysId);
    if (!slot || slot.parentId !== 'outer') return { ok: false, error: '子系统不存在: ' + sysId };

    const rd = this.rootRead(slot.kernelPath);
    if (!rd.ok) {
      slot.state = 'kernel_error';
      slot.kernelError = '无法读取内核源文件: ' + slot.kernelPath;
      this.emit('systems_changed');
      return { ok: false, error: slot.kernelError };
    }

    let bc;
    try {
      bc = compileNScript(rd.content, { compilerId: 'self-1' });
    } catch (err) {
      slot.state = 'kernel_error';
      slot.kernelError = '内核编译错误: ' + err.message;
      this.emit('systems_changed');
      return { ok: false, error: slot.kernelError };
    }

    slot.vmPool = {};
    slot.nextVmId = 10;
    slot.pendingInputs = [];
    slot.pendingCrossInputs = [];
    slot.lastDesktop = null;
    slot.appUIs = {};
    slot.scene3dResources = {};
    slot.scene3dFrames = {};
    slot.scene3dFx = {};
    slot.kernelError = null;
    slot.lastReportedKernelSteps = 0;

    const seedVfs = slot.preservedVfs
      ? deepCloneValue(slot.preservedVfs)
      : createDefaultSubsystemVfsSeed(PRECOMPILED_CACHE);

    const globals = {
      __sys_id: slot.id,
      __sys_name: slot.name,
      __parent_id: 'outer',
      __depth: slot.depth,
      __total_budget: slot.totalBudget,
      __mem_quota: slot.memQuota,
      __storage_quota: slot.storageQuota,
      __compiler_id: 'self',
      __seed_vfs: seedVfs,
      __seed_compiler_bc: PRECOMPILED_CACHE['/System/compiler.ns']
    };

    slot.kernelVm = createVM(bc, { globals, seed: 1001 + slot.depth * 97 });
    slot.state = slot.paused ? 'paused' : 'running';

    // Run initial kernel boot slice until it hits first host_next_tick
    this.bootKernelUntilTickWait(slot, Math.min(slot.grantCap, 80000));
    this.emit('systems_changed');
    return { ok: true, id: slot.id };
  }

  bootKernelUntilTickWait(slot, budget) {
    let used = 0;
    let guard = 0;
    while (used < budget && guard < 300) {
      guard++;
      const res = stepVM(slot.kernelVm, budget - used);
      used += res.cost;
      if (res.status === 'ERROR') {
        slot.state = 'kernel_error';
        slot.kernelError = '内核运行错误: ' + res.error;
        return used;
      }
      if (res.status === 'HALTED') {
        slot.state = 'stopped';
        return used;
      }
      if (res.status === 'PREEMPT') {
        return used;
      }
      if (res.status === 'TRAP') {
        if (res.syscall === 'host_next_tick') {
          // Kernel finished boot & is now waiting for its first tick!
          delete slot.preservedVfs;
          delete slot.preservedChildren;
          return used;
        }
        const reply = this.handleHypervisorSyscall(slot, res.syscall, res.args, budget - used);
        used += reply.extraCost || 0;
        if (!reply.yielded) {
          resumeSyscall(slot.kernelVm, reply.value);
        }
      }
    }
    return used;
  }

  // ==================== Ancestor Pause & System Tree Queries ====================
  isSystemOrAncestorPaused(sysId) {
    let cur = sysId;
    while (cur && cur !== 'outer') {
      const s = this.subsystems.get(cur);
      if (!s) return true;
      if (s.paused || s.state === 'paused' || s.state === 'stopped' || s.state === 'kernel_error') return true;
      cur = s.parentId;
    }
    return false;
  }

  getPauseReason(sysId) {
    let cur = sysId;
    while (cur && cur !== 'outer') {
      const s = this.subsystems.get(cur);
      if (!s) return '系统已停止';
      if (s.state === 'kernel_error') return `${cur} 内核错误`;
      if (s.state === 'stopped') return `${cur} 已停止`;
      if (s.paused) return cur === sysId ? '源系统已暂停' : `祖先系统 ${cur} 已暂停`;
      cur = s.parentId;
    }
    return null;
  }

  getAllSystemsList() {
    const list = [
      {
        id: 'outer',
        parentId: null,
        name: this.settings.systemName,
        depth: 0,
        state: 'running',
        paused: false,
        timeRate: 1.0,
        totalBudget: this.rootQuotas.totalBudget,
        memQuota: this.rootQuotas.memQuota,
        storageQuota: this.rootQuotas.storageQuota
      }
    ];
    for (const s of this.subsystems.values()) {
      const effectivePaused = this.isSystemOrAncestorPaused(s.id);
      list.push({
        id: s.id,
        parentId: s.parentId,
        name: s.name,
        depth: s.depth,
        state: s.state === 'kernel_error' || s.state === 'stopped' ? s.state : (effectivePaused ? 'paused' : 'running'),
        paused: Boolean(s.paused),
        selfPaused: Boolean(s.paused),
        timeRate: s.timeRate,
        grantCap: s.grantCap,
        totalBudget: s.telemetry?.totalBudget ?? s.totalBudget,
        effectiveGrant: s.telemetry?.effectiveGrant ?? 0,
        kernelCost: s.telemetry?.kernelCost ?? 0,
        userCost: s.telemetry?.userCost ?? 0,
        childrenCost: s.telemetry?.childrenCost ?? 0,
        memQuota: s.telemetry?.memQuota ?? s.memQuota,
        memUsed: s.telemetry?.memUsed ?? 0,
        storageQuota: s.telemetry?.storageQuota ?? s.storageQuota,
        storageUsed: s.telemetry?.storageUsed ?? 0,
        virtualTime: s.telemetry?.virtualTime ?? 0,
        kernelPath: s.kernelPath,
        kernelError: s.kernelError
      });
    }
    return list;
  }

  // ==================== Parent Control Commands ====================
  controlSubsystem(sysId, op, arg = null) {
    const slot = this.subsystems.get(sysId);
    if (!slot) return { ok: false, error: '子系统不存在' };

    if (slot.parentId === 'outer') {
      const cfg = this.rootChildConfigs.get(sysId);
      if (op === 'pause') {
        slot.paused = true;
        if (slot.state === 'running') slot.state = 'paused';
        if (cfg) cfg.paused = true;
        this.emit('systems_changed');
        return { ok: true };
      }
      if (op === 'resume') {
        slot.paused = false;
        if (slot.state === 'paused') slot.state = 'running';
        if (cfg) cfg.paused = false;
        this.emit('systems_changed');
        return { ok: true };
      }
      if (op === 'step') {
        if (!slot.paused) return { ok: false, error: '仅暂停状态支持单步' };
        slot.pendingStepMs = Number(arg) > 0 ? Number(arg) : SUBSYSTEM_STEP_MS;
        return { ok: true };
      }
      if (op === 'set_speed') {
        slot.timeRate = Math.max(0.1, Math.min(8.0, Number(arg) || 1.0));
        if (cfg) cfg.timeRate = slot.timeRate;
        return { ok: true };
      }
      if (op === 'set_grant') {
        slot.grantCap = Math.max(500, Number(arg) || 10000);
        if (cfg) cfg.grantCap = slot.grantCap;
        return { ok: true };
      }
      if (op === 'restart') {
        this.stopSubtree(sysId, false, true);
        return this.startRootChildSubsystem(sysId);
      }
      if (op === 'stop') {
        this.stopSubtree(sysId, true);
        this.emit('systems_changed');
        return { ok: true };
      }
    } else {
      // Delegate to parent subsystem's kernel.ns via child op injection!
      const parentSlot = this.subsystems.get(slot.parentId);
      if (!parentSlot || !parentSlot.kernelVm) return { ok: false, error: '父系统未运行' };
      if (op === 'step') {
        if (this.isSystemOrAncestorPaused(slot.parentId)) {
          return { ok: false, error: '父系统或祖先处于暂停状态，不能发起单步' };
        }
        if (!slot.paused) return { ok: false, error: '仅暂停状态支持单步' };
        slot.pendingStepMs = Number(arg) > 0 ? Number(arg) : SUBSYSTEM_STEP_MS;
        return { ok: true };
      }
      // Route via parent kernel's handle_child_op by queueing or calling directly in parent kernel globals
      const childrenGlobal = parentSlot.kernelVm.globals.CHILDREN;
      if (childrenGlobal && childrenGlobal[sysId]) {
        const c = childrenGlobal[sysId];
        if (op === 'pause') {
          c.paused = true;
          c.state = 'paused';
          slot.paused = true;
          if (slot.state === 'running') slot.state = 'paused';
          this.emit('systems_changed');
          return { ok: true };
        }
        if (op === 'resume') {
          c.paused = false;
          c.state = 'running';
          slot.paused = false;
          if (slot.state === 'paused') slot.state = 'running';
          this.emit('systems_changed');
          return { ok: true };
        }
        if (op === 'set_speed') {
          const spd = Math.max(0.1, Math.min(8.0, Number(arg) || 1.0));
          c.timeRate = spd;
          slot.timeRate = spd;
          return { ok: true };
        }
        if (op === 'set_grant') {
          const g = Math.max(500, Number(arg) || 10000);
          c.grantCap = g;
          slot.grantCap = g;
          return { ok: true };
        }
      }
    }
    return { ok: false, error: '不支持的控制操作' };
  }

  stopSubtree(sysId, markStopped = true, preserveForRestart = false) {
    const slot = this.subsystems.get(sysId);
    if (!slot) return;
    if (preserveForRestart) {
      if (slot.kernelVm?.globals?.VFS) {
        slot.preservedVfs = deepCloneValue(slot.kernelVm.globals.VFS);
      }
      const pChildren = [];
      const cg = slot.kernelVm?.globals?.CHILDREN;
      for (const child of this.subsystems.values()) {
        if (child.parentId === sysId && child.state !== 'stopped') {
          const kc = cg?.[child.id];
          pChildren.push({
            id: child.id,
            name: child.name,
            kernelPath: child.kernelPath,
            grantCap: kc?.grantCap ?? child.grantCap,
            paused: kc ? Boolean(kc.paused) : Boolean(child.paused),
            timeRate: kc?.timeRate ?? child.timeRate
          });
        }
      }
      if (pChildren.length > 0) {
        slot.preservedChildren = pChildren;
      } else if (slot.kernelVm && slot.state !== 'kernel_error' && slot.state !== 'stopped') {
        delete slot.preservedChildren;
      }
    } else {
      delete slot.preservedVfs;
      delete slot.preservedChildren;
    }
    // Stop children recursively first
    for (const child of this.subsystems.values()) {
      if (child.parentId === sysId) {
        this.stopSubtree(child.id, true, preserveForRestart);
      }
    }
    // Close any projections from this system
    for (const [pId, proj] of this.projections.entries()) {
      if (proj.sourceSystemId === sysId) {
        this.closeProjection(pId, '源系统已停止');
      }
    }
    // Unsubscribe any chart subscriptions owned by this system
    for (const [subId, sub] of this.subscriptions.entries()) {
      if (sub.sysId === sysId) {
        this.subscriptions.delete(subId);
      }
    }
    slot.vmPool = {};
    slot.kernelVm = null;
    slot.lastDesktop = null;
    slot.appUIs = {};
    if (markStopped) {
      slot.state = 'stopped';
    }
  }

  // ==================== Hypervisor Execution Engine ====================
  tick(dtMs = 33.333) {
    this.rootVirtualTime += dtMs;
    let budgetRem = this.rootQuotas.totalBudget;
    let childrenCost = 0;

    // Step direct children of outer
    for (const slot of this.subsystems.values()) {
      if (slot.parentId !== 'outer') continue;
      if (slot.state === 'stopped' || slot.state === 'kernel_error' || !slot.kernelVm) continue;

      let runDt = 0;
      if (slot.paused) {
        if (slot.pendingStepMs > 0) {
          runDt = slot.pendingStepMs * slot.timeRate;
          slot.pendingStepMs = 0;
        } else {
          continue;
        }
      } else {
        runDt = dtMs * slot.timeRate;
      }

      const grant = Math.min(budgetRem, slot.grantCap);
      if (grant <= 0) continue;

      const spent = this.runSubsystemTick(slot, runDt, grant);
      budgetRem = Math.max(0, budgetRem - spent);
      childrenCost += spent;
    }

    this.rootTelemetry.childrenCost = childrenCost;
    this.rootTelemetry.budgetUsedLastTick = this.rootTelemetry.rootAppCost + childrenCost;
    this.rootTelemetry.rootAppCost = 0;
    this.emit('tick_done');
  }

  runSubsystemTick(slot, dtMs, budgetGrant) {
    if (!slot.kernelVm || slot.state === 'kernel_error' || slot.state === 'stopped') return 0;

    // Wake kernel from host_next_tick ONLY if it is trapped at host_next_tick
    if (slot.kernelVm.status === 'trapped' && slot.kernelVm.pendingSyscall?.name === 'host_next_tick') {
      const inputs = slot.pendingInputs.splice(0);
      const crossInputs = slot.pendingCrossInputs.splice(0);
      const stepChildren = {};
      for (const cs of this.subsystems.values()) {
        if (cs.parentId === slot.id && cs.paused && cs.pendingStepMs > 0) {
          stepChildren[cs.id] = cs.pendingStepMs;
          cs.pendingStepMs = 0;
        }
      }
      resumeSyscall(slot.kernelVm, {
        dtMs,
        budgetGrant,
        inputs,
        crossInputs,
        stepChildren
      });
    }

    let totalUsed = 0;
    let guard = 0;
    while (totalUsed < budgetGrant && guard < 400) {
      guard++;
      const res = stepVM(slot.kernelVm, budgetGrant - totalUsed);
      totalUsed += res.cost;

      if (res.status === 'ERROR') {
        slot.state = 'kernel_error';
        slot.kernelError = '内核运行错误: ' + res.error;
        this.emit('systems_changed');
        break;
      }
      if (res.status === 'HALTED') {
        slot.state = 'stopped';
        this.emit('systems_changed');
        break;
      }
      if (res.status === 'PREEMPT') {
        break;
      }
      if (res.status === 'TRAP') {
        if (res.syscall === 'host_next_tick') {
          // Tick completed cleanly!
          delete slot.preservedVfs;
          delete slot.preservedChildren;
          break;
        }
        const reply = this.handleHypervisorSyscall(slot, res.syscall, res.args, budgetGrant - totalUsed);
        totalUsed += reply.extraCost || 0;
        if (slot.kernelVm.status === 'trapped' && !reply.yielded) {
          resumeSyscall(slot.kernelVm, reply.value);
        }
        if (reply.kernelError) {
          slot.state = 'kernel_error';
          slot.kernelError = reply.kernelError;
          this.emit('systems_changed');
          break;
        }
      }
    }
    return totalUsed;
  }

  handleHypervisorSyscall(slot, name, args, remainingBudget) {
    switch (name) {
      case 'host_self_cost': {
        const cur = slot.kernelVm.stepsExecuted;
        const delta = Math.max(0, cur - slot.lastReportedKernelSteps);
        slot.lastReportedKernelSteps = cur;
        return { value: delta };
      }

      case 'host_vm_create': {
        const [bytecode, globals, seed] = args;
        const vmId = 'vm-' + slot.nextVmId++;
        slot.vmPool[vmId] = createVM(bytecode, { globals: deepCloneValue(globals), seed: seed || 12345 });
        return { value: vmId };
      }

      case 'host_vm_create_child': {
        const [cid, bytecode, globals] = args;
        const childSlot = this.subsystems.get(cid);
        if (!childSlot) return { value: null };
        childSlot.vmPool = {};
        childSlot.nextVmId = 10;
        childSlot.pendingInputs = [];
        childSlot.pendingCrossInputs = [];
        childSlot.lastDesktop = null;
        childSlot.appUIs = {};
        childSlot.scene3dResources = {};
        childSlot.scene3dFrames = {};
        childSlot.scene3dFx = {};
        childSlot.kernelError = null;
        childSlot.lastReportedKernelSteps = 0;
        childSlot.kernelVm = createVM(bytecode, {
          globals: deepCloneValue(globals),
          seed: 1001 + childSlot.depth * 97
        });
        childSlot.state = childSlot.paused ? 'paused' : 'running';
        this.bootKernelUntilTickWait(childSlot, Math.min(remainingBudget, childSlot.grantCap));
        this.emit('systems_changed');
        return { value: 'child:' + cid };
      }

      case 'host_vm_destroy': {
        const [vmId] = args;
        if (typeof vmId === 'string' && vmId.startsWith('child:')) {
          const cid = vmId.slice(6);
          this.stopSubtree(cid, true);
        } else {
          delete slot.vmPool[vmId];
        }
        return { value: true };
      }

      case 'host_vm_resume': {
        const [vmId, retVal] = args;
        const vm = this.resolveVm(slot, vmId);
        if (vm && vm.status === 'trapped') {
          resumeSyscall(vm, retVal);
        }
        return { value: true };
      }

      case 'host_vm_stdout': {
        const [vmId] = args;
        const vm = this.resolveVm(slot, vmId);
        return { value: vm ? vm.stdout.slice(-30) : [] };
      }

      case 'host_vm_step': {
        const [vmId, reqSlice, memLimit] = args;
        const slice = Math.min(Math.max(1, Number(reqSlice) || 1), Math.max(1, remainingBudget));

        if (typeof vmId === 'string' && vmId.startsWith('child:')) {
          const cid = vmId.slice(6);
          const childSlot = this.subsystems.get(cid);
          if (!childSlot || !childSlot.kernelVm) {
            return { value: { status: 'ERROR', cost: 0, error: '子系统内核未加载' } };
          }
          // Step child kernel within slice budget!
          let cUsed = 0;
          let guard = 0;
          while (cUsed < slice && guard < 200) {
            guard++;
            const cres = stepVM(childSlot.kernelVm, slice - cUsed, memLimit || Infinity);
            cUsed += cres.cost;
            if (cres.status === 'ERROR') {
              childSlot.state = 'kernel_error';
              childSlot.kernelError = '内核运行错误: ' + cres.error;
              this.emit('systems_changed');
              return { value: { status: 'ERROR', cost: cUsed, error: cres.error }, extraCost: cUsed };
            }
            if (cres.status === 'HALTED') {
              return { value: { status: 'HALTED', cost: cUsed, result: cres.result }, extraCost: cUsed };
            }
            if (cres.status === 'PREEMPT') {
              return {
                value: {
                  status: 'PREEMPT',
                  cost: cUsed,
                  memBytes: cres.memBytes,
                  remainingWork: cres.remainingWork
                },
                extraCost: cUsed
              };
            }
            if (cres.status === 'TRAP') {
              if (cres.syscall === 'host_next_tick' || cres.syscall === 'host_child_telemetry') {
                return {
                  value: {
                    status: 'TRAP',
                    cost: cUsed,
                    syscall: cres.syscall,
                    args: cres.args,
                    memBytes: cres.memBytes
                  },
                  extraCost: cUsed
                };
              }
              const creply = this.handleHypervisorSyscall(childSlot, cres.syscall, cres.args, slice - cUsed);
              cUsed += creply.extraCost || 0;
              if (childSlot.kernelVm.status === 'trapped' && !creply.yielded) {
                resumeSyscall(childSlot.kernelVm, creply.value);
              }
            }
          }
          return { value: { status: 'PREEMPT', cost: cUsed, memBytes: childSlot.kernelVm.memBytes }, extraCost: cUsed };
        }

        const vm = slot.vmPool[vmId];
        if (!vm) return { value: { status: 'ERROR', cost: 0, error: 'VM 不存在' } };
        const res = stepVM(vm, slice, memLimit || Infinity);
        return { value: res, extraCost: res.cost };
      }

      case 'host_run_compiler_vm': {
        const [compilerBc, sourceText, compilerId, memAvail] = args;
        const cvm = createVM(compilerBc, {
          globals: { __source: sourceText, __compiler_id: compilerId }
        });
        let used = 0;
        const cap = Math.max(50000, remainingBudget);
        let guard = 0;
        let out = { ok: false, error: '编译超时或预算耗尽' };
        while (guard < 500) {
          guard++;
          const r = stepVM(cvm, Math.min(50000, cap), memAvail || Infinity);
          used += r.cost;
          if (r.status === 'HALTED') {
            out = r.result || { ok: false, error: '编译器未返回字节码' };
            break;
          }
          if (r.status === 'ERROR') {
            out = { ok: false, error: '编译器运行错误: ' + r.error };
            break;
          }
        }
        return { value: out, extraCost: Math.min(used, remainingBudget) };
      }

      case 'host_alloc_child': {
        const childSlot = this.allocateSubsystemSlot(slot.id);
        return { value: { ok: true, id: childSlot.id, depth: childSlot.depth } };
      }

      case 'host_get_child_seed': {
        const [cid] = args;
        const cs = this.subsystems.get(cid);
        if (!cs) return { value: { totalBudget: 40000, memQuota: 8 * 1024 * 1024, storageQuota: 4 * 1024 * 1024, seedVfs: {} } };
        const seedVfs = cs.preservedVfs
          ? deepCloneValue(cs.preservedVfs)
          : createDefaultSubsystemVfsSeed(PRECOMPILED_CACHE);
        return {
          value: {
            totalBudget: cs.totalBudget,
            memQuota: cs.memQuota,
            storageQuota: cs.storageQuota,
            seedVfs
          }
        };
      }

      case 'host_take_preserved_children': {
        const list = deepCloneValue(slot.preservedChildren || []);
        return { value: list };
      }

      case 'host_child_tick_payload': {
        const [cid, cDt, cGrant] = args;
        const cs = this.subsystems.get(cid);
        if (!cs) return { value: { dtMs: 0, budgetGrant: 0, inputs: [], crossInputs: [] } };
        const stepChildren = {};
        for (const gcs of this.subsystems.values()) {
          if (gcs.parentId === cid && gcs.paused && gcs.pendingStepMs > 0) {
            stepChildren[gcs.id] = gcs.pendingStepMs;
            gcs.pendingStepMs = 0;
          }
        }
        return {
          value: {
            dtMs: cDt,
            budgetGrant: cGrant,
            inputs: cs.pendingInputs.splice(0),
            crossInputs: cs.pendingCrossInputs.splice(0),
            stepChildren
          }
        };
      }

      case 'host_child_started':
      case 'host_child_error':
      case 'host_child_stopped':
      case 'host_child_reset_for_restart': {
        const [cid, arg2] = args;
        const cs = this.subsystems.get(cid);
        if (cs) {
          if (name === 'host_child_error') {
            cs.state = 'kernel_error';
            cs.kernelError = String(arg2 || '内核错误');
          } else if (name === 'host_child_stopped') {
            this.stopSubtree(cid, true);
          } else if (name === 'host_child_reset_for_restart') {
            this.stopSubtree(cid, false, true);
          }
        }
        this.emit('systems_changed');
        return { value: true };
      }

      case 'host_child_state': {
        const [cid, patch] = args;
        const cs = this.subsystems.get(cid);
        if (cs && patch && typeof patch === 'object') {
          if (typeof patch.paused === 'boolean') cs.paused = patch.paused;
          if (typeof patch.state === 'string') cs.state = patch.state;
          if (typeof patch.grantCap === 'number' && Number.isFinite(patch.grantCap)) cs.grantCap = patch.grantCap;
          if (typeof patch.timeRate === 'number' && Number.isFinite(patch.timeRate)) cs.timeRate = patch.timeRate;
          this.emit('systems_changed');
          this.emit('projections_changed');
        }
        return { value: true };
      }

      case 'host_submit_desktop': {
        slot.lastDesktop = deepCloneValue(args[0]);
        this.emit('subsystem_desktop', { sysId: slot.id, desktop: slot.lastDesktop });
        return { value: true };
      }

      case 'host_publish_app_ui': {
        const [winId, ui] = args;
        slot.appUIs[winId] = deepCloneValue(ui);
        this.emit('app_ui', { sysId: slot.id, winId, ui: slot.appUIs[winId] });
        return { value: true };
      }

      case 'host_window_closed': {
        const [winId] = args;
        delete slot.appUIs[winId];
        delete slot.scene3dResources[winId];
        delete slot.scene3dFrames[winId];
        delete slot.scene3dFx[winId];
        if (this.projections.has(winId)) {
          this.closeProjection(winId, '目标投送窗口已关闭');
        }
        for (const [pId, proj] of this.projections.entries()) {
          if (proj.sourceSystemId === slot.id && proj.sourceWindowId === winId) {
            this.closeProjection(pId, '源窗口已关闭');
          }
        }
        return { value: true };
      }

      case 'host_3d_load': {
        const [playerId, res] = args;
        slot.scene3dResources[playerId] = deepCloneValue(res);
        if (this.displayDevice) {
          this.displayDevice.loadScene(slot.id, playerId, slot.scene3dResources[playerId]);
        }
        return { value: true };
      }

      case 'host_3d_frame': {
        const [playerId, frame] = args;
        slot.scene3dFrames[playerId] = deepCloneValue(frame);
        return { value: true };
      }

      case 'host_3d_fx': {
        const [playerId, fx] = args;
        slot.scene3dFx[playerId] = deepCloneValue(fx);
        return { value: true };
      }

      case 'host_3d_raycast': {
        const [playerId, nx, ny, camMode, camOrbit] = args;
        if (!this.displayDevice) return { value: null };
        const hit = this.displayDevice.raycast(slot.id, playerId, nx, ny, camMode, camOrbit);
        return { value: hit };
      }

      case 'host_chart_list_sources': {
        return { value: this.listOpenWorkbooks() };
      }

      case 'host_chart_subscribe': {
        const [docId, rangeStr] = args;
        const wb = this.workbooks.get(docId);
        if (!wb || wb.closed) {
          return { value: { ok: false, error: '工作簿未打开或已关闭' } };
        }
        const subId = 'sub-' + this.nextSubId++;
        const initialData = deepCloneValue(wb.getRangeData(rangeStr));
        this.subscriptions.set(subId, {
          subId,
          sysId: slot.id,
          docId,
          rangeStr,
          closed: false,
          queue: []
        });
        return {
          value: {
            ok: true,
            subId,
            title: wb.title,
            version: wb.version || 1,
            initialData
          }
        };
      }

      case 'host_chart_poll': {
        const [subId] = args;
        const sub = this.subscriptions.get(subId);
        if (!sub) return { value: [] };
        const items = sub.queue.splice(0);
        return { value: items };
      }

      case 'host_chart_unsubscribe': {
        const [subId] = args;
        this.subscriptions.delete(subId);
        return { value: true };
      }

      case 'host_project_window': {
        const [sourceWinId, targetSysId, meta] = args;
        const res = this.createOrFocusProjection(slot.id, sourceWinId, targetSysId, meta);
        return { value: res };
      }

      case 'host_get_sys_tree': {
        return { value: this.getAllSystemsList() };
      }

      case 'host_forward_child_input': {
        const [cid, ev] = args;
        this.forwardInputToSubsystem(cid, ev);
        return { value: true };
      }

      case 'host_report_telemetry': {
        slot.telemetry = deepCloneValue(args[0]);
        return { value: true };
      }

      case 'host_update_self_quotas': {
        const q = args[0];
        if (q && typeof q === 'object') {
          if (typeof q.totalBudget === 'number' && q.totalBudget >= 500) slot.totalBudget = q.totalBudget;
          if (typeof q.memQuota === 'number' && q.memQuota >= 65536) slot.memQuota = q.memQuota;
          if (typeof q.storageQuota === 'number' && q.storageQuota >= 65536) slot.storageQuota = q.storageQuota;
          this.emit('systems_changed');
        }
        return { value: true };
      }

      case 'host_snapshot_create': {
        const [cid, snapPath] = args;
        const res = this.createSubtreeSnapshotToParentVfs(slot, cid, snapPath);
        return { value: res };
      }

      case 'host_snapshot_restore_latest': {
        const [cid] = args;
        const res = this.restoreLatestSnapshotForChild(slot, cid);
        return { value: res };
      }

      case 'host_snapshot_fork_latest': {
        const [cid] = args;
        const res = this.forkLatestSnapshotForChild(slot, cid);
        return { value: res };
      }

      case 'host_snapshot_fork_file': {
        const [snapPath] = args;
        const res = this.forkSnapshotFromPath(slot, snapPath);
        return { value: res };
      }

      case 'host_export_dialog': {
        const [name, content] = args;
        if (window.hostBridge?.exportFile) {
          window.hostBridge.exportFile({ defaultName: name, content });
        }
        return { value: true };
      }

      case 'host_import_dialog': {
        // Note: synchronous VM call cannot await native dialog directly; trigger async notification/drop helper
        return { value: { canceled: true } };
      }

      default:
        return { value: null };
    }
  }

  resolveVm(slot, vmId) {
    if (typeof vmId === 'string' && vmId.startsWith('child:')) {
      const cs = this.subsystems.get(vmId.slice(6));
      return cs ? cs.kernelVm : null;
    }
    return slot.vmPool[vmId] || null;
  }

  forwardInputToSubsystem(sysId, ev) {
    const slot = this.subsystems.get(sysId);
    if (!slot || slot.state === 'stopped' || slot.state === 'kernel_error') return;
    if (this.isSystemOrAncestorPaused(sysId)) return;
    slot.pendingInputs.push(ev);
    if (slot.pendingInputs.length > 160) slot.pendingInputs.shift();
  }

  // ==================== Cross-Layer Projection Management (2.15) ====================
  createOrFocusProjection(sourceSystemId, sourceWindowId, targetSysId, meta) {
    // At most one projection per source window
    for (const proj of this.projections.values()) {
      if (proj.sourceSystemId === sourceSystemId && proj.sourceWindowId === sourceWindowId) {
        if (proj.targetSysId === targetSysId) {
          this.emit('focus_projection', proj.projWinId);
          return { ok: true, projWinId: proj.projWinId, existing: true };
        }
        // Move projection to new target desktop
        this.closeProjection(proj.projWinId, '切换投送目标');
      }
    }

    const projWinId = 'proj-' + this.nextProjSeq++;
    const proj = {
      projWinId,
      targetSysId,
      sourceSystemId,
      sourceWindowId,
      sourceAppId: meta.appId,
      sourcePid: meta.pid,
      title: `[投送 · ${sourceSystemId}] ${meta.title || meta.appId}`,
      state: 'active',
      minimized: false
    };
    this.projections.set(projWinId, proj);
    if (targetSysId !== 'outer') {
      this.forwardInputToSubsystem(targetSysId, { type: 'open_projection', proj: { ...proj } });
    }
    this.emit('projections_changed');
    this.emit('open_projection', proj);
    return { ok: true, projWinId };
  }

  closeProjection(projWinId, reason = '') {
    const proj = this.projections.get(projWinId);
    if (!proj) return;
    this.projections.delete(projWinId);
    if (proj.targetSysId !== 'outer') {
      this.forwardInputToSubsystem(proj.targetSysId, { type: 'close_projection', projWinId });
    }
    this.emit('close_projection', { projWinId, reason });
    this.emit('projections_changed');
  }

  sendInputFromProjection(projWinId, ev) {
    const proj = this.projections.get(projWinId);
    if (!proj) return false;
    if (this.isSystemOrAncestorPaused(proj.sourceSystemId)) return false;
    const slot = this.subsystems.get(proj.sourceSystemId);
    if (!slot || slot.state === 'stopped' || slot.state === 'kernel_error') return false;
    slot.pendingCrossInputs.push({
      winId: proj.sourceWindowId,
      pid: proj.sourcePid,
      event: ev
    });
    return true;
  }

  // ==================== Subtree Snapshot, Restore & Fork (2.12) ====================
  collectSubtreeSlotData(sysId) {
    const slot = this.subsystems.get(sysId);
    if (!slot) return null;
    const children = [];
    for (const cs of this.subsystems.values()) {
      if (cs.parentId === sysId) {
        children.push(this.collectSubtreeSlotData(cs.id));
      }
    }
    // Capture internal projections whose BOTH target & source lie inside this subtree
    const internalProjs = [];
    for (const p of this.projections.values()) {
      if (p.sourceSystemId === sysId) {
        internalProjs.push({ ...p });
      }
    }
    return {
      slot: {
        id: slot.id,
        name: slot.name,
        parentId: slot.parentId,
        depth: slot.depth,
        kernelPath: slot.kernelPath,
        state: slot.state,
        paused: slot.paused,
        timeRate: slot.timeRate,
        grantCap: slot.grantCap,
        totalBudget: slot.totalBudget,
        memQuota: slot.memQuota,
        storageQuota: slot.storageQuota,
        kernelError: slot.kernelError,
        kernelVm: slot.kernelVm,
        lastReportedKernelSteps: slot.lastReportedKernelSteps,
        vmPool: slot.vmPool,
        nextVmId: slot.nextVmId,
        pendingInputs: slot.pendingInputs,
        pendingCrossInputs: slot.pendingCrossInputs,
        pendingStepMs: slot.pendingStepMs,
        lastDesktop: slot.lastDesktop,
        appUIs: slot.appUIs,
        scene3dResources: slot.scene3dResources,
        scene3dFrames: slot.scene3dFrames,
        scene3dFx: slot.scene3dFx,
        telemetry: slot.telemetry
      },
      children,
      internalProjs
    };
  }

  createSubtreeSnapshotJson(sysId) {
    const treeData = this.collectSubtreeSlotData(sysId);
    if (!treeData) return null;
    const envelope = {
      magic: 'NSSNAP',
      version: 1,
      rootSysId: sysId,
      createdAt: Date.now(),
      tree: treeData
    };
    return serializeGraph(envelope);
  }

  createSubtreeSnapshotToParentVfs(parentSlot, childId, snapPath) {
    const snapJson = this.createSubtreeSnapshotJson(childId);
    if (!snapJson) return { ok: false, error: '无法生成快照: ' + childId };
    if (parentSlot === null) {
      // Save to root VFS
      const wr = this.rootWrite(snapPath, snapJson);
      if (wr.ok) this.pushNotification('子树快照已创建', `已保存 ${childId} 快照至 ${snapPath}`);
      return wr;
    }
    // Save into parent subsystem VFS via kernel globals VFS
    const vfs = parentSlot.kernelVm.globals.VFS;
    const curUsed = parentSlot.kernelVm.globals.STORAGE_USED || 0;
    const oldSz = vfs[snapPath]?.type === 'file' ? vfs[snapPath].size : 0;
    const delta = snapJson.length - oldSz;
    const quota = parentSlot.kernelVm.globals.SYS?.storageQuota || parentSlot.storageQuota;
    if (curUsed + delta > quota) {
      return { ok: false, error: '父系统存储配额不足，无法保存快照' };
    }
    vfs[snapPath] = { type: 'file', content: snapJson, size: snapJson.length, mtime: parentSlot.telemetry.virtualTime };
    parentSlot.kernelVm.globals.STORAGE_USED = curUsed + delta;
    return { ok: true, path: snapPath, size: snapJson.length };
  }

  getSubtreeIds(node, set = new Set()) {
    set.add(node.slot.id);
    for (const ch of node.children) this.getSubtreeIds(ch, set);
    return set;
  }

  restoreSnapshot(snapJson, targetParentId, mode = 'restore', originalRootId = null) {
    const env = deserializeGraph(snapJson);
    if (!env || env.magic !== 'NSSNAP' || !env.tree) {
      return { ok: false, error: '无效的子树快照格式' };
    }

    const oldTree = env.tree;
    const oldRootId = oldTree.slot.id;
    const subtreeIdSet = this.getSubtreeIds(oldTree);

    // Build ID mapping: in 'restore', preserve exact IDs; in 'fork', allocate fresh sequential IDs!
    const idMap = new Map();
    const mapIds = (node) => {
      if (mode === 'restore') {
        idMap.set(node.slot.id, node.slot.id);
      } else {
        idMap.set(node.slot.id, 'inner-' + this.nextSystemSeq++);
      }
      for (const ch of node.children) mapIds(ch);
    };
    mapIds(oldTree);

    const newRootId = idMap.get(oldRootId);

    if (mode === 'restore') {
      // Stop existing subtree cleanly first
      this.stopSubtree(oldRootId, false);
    }

    // Remap strings/refs inside a subtree node
    const remapStr = (s) => {
      if (typeof s !== 'string') return s;
      let out = s;
      for (const [oldId, newId] of idMap.entries()) {
        if (oldId !== newId) {
          out = out.split(oldId).join(newId);
        }
      }
      return out;
    };

    const installNode = (node, actualParentId, depth) => {
      const oldId = node.slot.id;
      const newId = idMap.get(oldId);
      const sd = node.slot;

      // Remap IDs inside kernel globals & VMs when forking
      if (mode === 'fork') {
        const kv = sd.kernelVm;
        if (kv?.globals?.SYS) {
          kv.globals.SYS.id = newId;
          kv.globals.SYS.name = newId;
          kv.globals.SYS.parentId = actualParentId;
          kv.globals.SYS.depth = depth;
        }
        if (kv?.globals?.CHILDREN) {
          const newCh = {};
          for (const [ck, cv] of Object.entries(kv.globals.CHILDREN)) {
            const nck = idMap.get(ck) || ck;
            cv.id = nck;
            cv.name = nck;
            cv.kernelPath = `/Systems/${nck}/kernel.ns`;
            newCh[nck] = cv;
          }
          kv.globals.CHILDREN = newCh;
        }
        if (kv?.globals?.PROCS) {
          for (const pr of kv.globals.PROCS) {
            if (pr.childSystemId && idMap.has(pr.childSystemId)) {
              pr.childSystemId = idMap.get(pr.childSystemId);
              pr.vmId = 'child:' + pr.childSystemId;
              pr.name = pr.childSystemId + ' (内核承载)';
              pr.path = `/Systems/${pr.childSystemId}/kernel.ns`;
            }
          }
        }
        if (kv?.globals?.VFS) {
          const nvfs = {};
          for (const [vk, vv] of Object.entries(kv.globals.VFS)) {
            let nvk = vk;
            for (const [oid, nid] of idMap.entries()) {
              if (vk.startsWith(`/Systems/${oid}`)) {
                nvk = `/Systems/${nid}` + vk.slice(`/Systems/${oid}`.length);
              }
            }
            nvfs[nvk] = vv;
          }
          kv.globals.VFS = nvfs;
        }
        // Remap winIds in user VMs & WM & UI
        if (sd.lastDesktop) {
          sd.lastDesktop.sysId = newId;
          sd.lastDesktop.sysName = newId;
          sd.lastDesktop.depth = depth;
          for (const w of sd.lastDesktop.windows || []) {
            w.id = remapStr(w.id);
            if (w.childSystemId && idMap.has(w.childSystemId)) {
              w.childSystemId = idMap.get(w.childSystemId);
              w.title = remapStr(w.title);
            }
          }
        }
      }

      // Mark any active chart_recv VMs as restored_pending per 2.12 & 2.16!
      for (const vm of Object.values(sd.vmPool || {})) {
        if (vm?.globals?.CONN_STATE === 'connected') {
          vm.globals.SUB_ID = null;
          vm.globals.CONN_STATE = 'restored_pending';
          // Also notify paired chart_draw if present via inbox
          const drawPid = vm.globals.DRAW_PID;
          const procs = sd.kernelVm?.globals?.PROCS || [];
          const drawProc = procs.find((p) => p.pid === drawPid);
          if (drawProc) {
            drawProc.inbox.push({
              from: 1,
              seq: 999999,
              timestamp: sd.telemetry?.virtualTime || 0,
              data: { type: 'sub_status', connectionState: 'restored_pending' }
            });
            if (drawProc.state === 'waiting' && drawProc.waitType === 'msg' && drawProc.pendingReply) {
              drawProc.state = 'ready';
              drawProc.waitType = null;
              drawProc.pendingReply = false;
              const dvm = sd.vmPool[drawProc.vmId];
              if (dvm) resumeSyscall(dvm, drawProc.inbox.shift());
            }
          }
        }
        if (vm?.globals?.CONN_STATE === 'restored_pending' && vm.globals.STATUS_MSG !== undefined) {
          vm.globals.STATUS_MSG = '已恢复，待重新连接';
        }
      }

      // Refresh Display Device 3D scene resources from restored data
      if (this.displayDevice) {
        for (const [plId, res] of Object.entries(sd.scene3dResources || {})) {
          this.displayDevice.loadScene(newId, plId, res);
        }
      }

      const restoredSlot = {
        ...sd,
        id: newId,
        name: newId,
        parentId: actualParentId,
        depth,
        kernelPath: `/Systems/${newId}/kernel.ns`
      };
      this.subsystems.set(newId, restoredSlot);

      for (const ch of node.children) {
        installNode(ch, newId, depth + 1);
      }
    };

    const parentDepth = targetParentId === 'outer' ? 0 : (this.subsystems.get(targetParentId)?.depth || 1);
    installNode(oldTree, targetParentId, parentDepth + 1);

    // Ensure parent system registers the restored/forked child in its carrier & window list
    if (targetParentId === 'outer') {
      const slot = this.subsystems.get(newRootId);
      const rd = this.rootRead(slot.kernelPath);
      if (!rd.ok) this.rootWrite(slot.kernelPath, KERNEL_NS_SOURCE);
      this.rootChildConfigs.set(newRootId, {
        id: newRootId,
        grantCap: slot.grantCap,
        paused: slot.paused,
        timeRate: slot.timeRate
      });
    } else {
      const pSlot = this.subsystems.get(targetParentId);
      if (pSlot?.kernelVm?.globals) {
        const kvg = pSlot.kernelVm.globals;
        const rSlot = this.subsystems.get(newRootId);
        if (!kvg.VFS[rSlot.kernelPath]) {
          kvg.VFS[rSlot.kernelPath] = { type: 'file', content: KERNEL_NS_SOURCE, size: KERNEL_NS_SOURCE.length, mtime: 0 };
        }
        const existingChild = kvg.CHILDREN[newRootId];
        let carrierPid = existingChild?.carrierPid;
        if (!existingChild) {
          carrierPid = kvg.NEXT_PID++;
          kvg.PROCS.push({
            pid: carrierPid,
            name: `${newRootId} (内核承载)`,
            path: rSlot.kernelPath,
            parentPid: 1,
            type: 'carrier',
            state: 'ready',
            savedState: null,
            waitType: null,
            waitUntil: 0,
            priority: 1,
            quantum: 12000,
            budgetLimit: 1000000,
            tickBudgetUsed: 0,
            budgetUsed: 0,
            memBytes: 8192,
            remainingWork: 0,
            pendingOp: null,
            pendingReply: false,
            inbox: [],
            vmId: 'child:' + newRootId,
            childSystemId: newRootId,
            error: null,
            stdout: [],
            createdAt: kvg.SYS?.virtualTime || 0
          });
        }
        kvg.CHILDREN[newRootId] = {
          id: newRootId,
          name: newRootId,
          carrierPid,
          grantCap: rSlot.grantCap,
          paused: rSlot.paused,
          timeRate: rSlot.timeRate,
          state: rSlot.state,
          kernelPath: rSlot.kernelPath,
          kernelError: rSlot.kernelError,
          kernelCost: 0,
          internalCost: 0
        };
        const wmPid = kvg.WM_PID;
        const wmProc = kvg.PROCS.find((p) => p.pid === wmPid);
        if (wmProc && mode === 'fork') {
          wmProc.inbox.push({
            from: 1,
            seq: 999998,
            timestamp: kvg.SYS?.virtualTime || 0,
            data: { type: 'open_child_window', childId: newRootId, title: `${newRootId} (L${parentDepth + 1})` }
          });
        }
      }
    }

    // Revalidate external projections pointing into restored originalRootId
    if (mode === 'restore') {
      const restoredSlot = this.subsystems.get(newRootId);
      const winIds = new Set((restoredSlot?.lastDesktop?.windows || []).map((w) => w.id));
      for (const [pId, proj] of this.projections.entries()) {
        if (subtreeIdSet.has(proj.sourceSystemId) && !subtreeIdSet.has(proj.targetSysId)) {
          const targetSlot = this.subsystems.get(proj.sourceSystemId);
          const targetWinExists = targetSlot?.lastDesktop?.windows?.some((w) => w.id === proj.sourceWindowId);
          if (!targetWinExists) {
            this.closeProjection(pId, '快照恢复后源窗口已不存在');
          }
        }
      }
      void winIds;
    }

    this.emit('systems_changed');
    const restoredFirst = this.subsystems.get(newRootId);
    if (restoredFirst?.lastDesktop) {
      this.emit('subsystem_desktop', { sysId: newRootId, desktop: restoredFirst.lastDesktop });
    }
    if (targetParentId === 'outer') {
      this.emit('open_root_child_window', { sysId: newRootId });
    }
    return { ok: true, id: newRootId, mode };
  }

  restoreLatestSnapshotForChild(parentSlot, childId) {
    if (parentSlot === null) {
      const files = this.rootList('/Documents').filter((f) => f.name.startsWith(childId + '_snap_') && f.name.endsWith('.snap'));
      if (files.length === 0) return { ok: false, error: `未找到 ${childId} 的快照文件` };
      files.sort((a, b) => b.name.localeCompare(a.name));
      const rd = this.rootRead(files[0].path);
      if (!rd.ok) return rd;
      return this.restoreSnapshot(rd.content, 'outer', 'restore');
    }
    const vfs = parentSlot.kernelVm.globals.VFS;
    const matches = Object.keys(vfs).filter((k) => k.startsWith('/Documents/' + childId + '_snap_') && k.endsWith('.snap'));
    if (matches.length === 0) return { ok: false, error: `未找到 ${childId} 的快照文件` };
    matches.sort().reverse();
    return this.restoreSnapshot(vfs[matches[0]].content, parentSlot.id, 'restore');
  }

  forkLatestSnapshotForChild(parentSlot, childId) {
    if (parentSlot === null) {
      const files = this.rootList('/Documents').filter((f) => f.name.startsWith(childId + '_snap_') && f.name.endsWith('.snap'));
      if (files.length === 0) return { ok: false, error: `未找到 ${childId} 的快照文件` };
      files.sort((a, b) => b.name.localeCompare(a.name));
      const rd = this.rootRead(files[0].path);
      if (!rd.ok) return rd;
      return this.restoreSnapshot(rd.content, 'outer', 'fork');
    }
    const vfs = parentSlot.kernelVm.globals.VFS;
    const matches = Object.keys(vfs).filter((k) => k.startsWith('/Documents/' + childId + '_snap_') && k.endsWith('.snap'));
    if (matches.length === 0) return { ok: false, error: `未找到 ${childId} 的快照文件` };
    matches.sort().reverse();
    return this.restoreSnapshot(vfs[matches[0]].content, parentSlot.id, 'fork');
  }

  forkSnapshotFromPath(parentSlot, snapPath) {
    if (parentSlot === null) {
      const rd = this.rootRead(snapPath);
      if (!rd.ok) return rd;
      return this.restoreSnapshot(rd.content, 'outer', 'fork');
    }
    const vfs = parentSlot.kernelVm.globals.VFS;
    if (!vfs[snapPath] || vfs[snapPath].type !== 'file') return { ok: false, error: '快照文件不存在' };
    return this.restoreSnapshot(vfs[snapPath].content, parentSlot.id, 'fork');
  }

  // ==================== Persistence (dataDir) ====================
  exportPersistentState() {
    return serializeGraph({
      version: 1,
      settings: this.settings,
      rootQuotas: this.rootQuotas,
      rootVfs: this.rootVfs,
      stickyNoteText: this.stickyNoteText,
      clipboardHistory: this.clipboardHistory
    });
  }

  importPersistentState(jsonStr) {
    if (!jsonStr) return false;
    try {
      const data = deserializeGraph(jsonStr);
      if (!data || data.version !== 1) return false;
      if (data.settings) Object.assign(this.settings, data.settings);
      if (data.rootQuotas) Object.assign(this.rootQuotas, data.rootQuotas);
      if (data.rootVfs) {
        this.rootVfs = data.rootVfs;
        this.recalcRootStorage();
      }
      if (typeof data.stickyNoteText === 'string') this.stickyNoteText = data.stickyNoteText;
      if (Array.isArray(data.clipboardHistory)) this.clipboardHistory = data.clipboardHistory;
      return true;
    } catch {
      return false;
    }
  }
}
