// 状态模型：系统树、进程、文件、窗口与快照
import {
  normPath, pathJoin, pathDir, pathBase, pathExt, deepClone, clamp,
  fmtBytes, newId, hashStr
} from './util.js';
import { initialFiles, newWidgets, kernelSource, CONTROLLER_SOURCE, GUIDE_MD } from './seed.js';
import { rt, changed } from './store.js';
import { innerWallpaper } from './wallpapers.js';
export { changed } from './store.js';
export { rt } from './store.js';

export const MAX_DEPTH = 6;
export const LIMIT_STEP_SECONDS = 0.1;

export function makeModel() {
  return {
    version: 4,
    rootId: 'outer',
    systems: {},
    nextInner: 1,
    bootEpoch: Date.now(),
    createdAt: Date.now()
  };
}

let pidSeq = 1;
export function freshPid() { return ++pidSeq; }

const ROOT_APP_PROCS = [
  ['桌面外壳', 'shell', 'host', 3000, 18],
  ['显示合成器', 'compositor', 'kernel', 2200, 14],
  ['文件系统服务', 'files', 'service', 2400, 8],
  ['电子表格', 'spreadsheet', 'app', 3200, 10],
  ['桌面小组件', 'widgets', 'app', 1800, 6],
  ['文本与程序编辑器', 'editor', 'app', 2400, 8],
  ['浏览器', 'browser', 'app', 0, 46],
  ['Chromium 网页设备', 'chromium', 'browser', 0, 120],
  ['任务管理器', 'tasks', 'app', 1600, 6],
  ['设置', 'settings', 'app', 1400, 5],
  ['系统管理', 'systems', 'app', 1600, 6],
  ['操作说明', 'guide', 'app', 900, 3]
];

function makeProcess(sys, { name, kind = 'app', service = '', quota = 2000, memory = 4, state = 'ready', childId = null, programPath = '', vmState = null, suspended = false }) {
  return {
    pid: freshPid(), name, kind, service, state, quota, memory,
    work: 0, workTotal: 0, remaining: 0, messages: 0, error: null,
    childId, programPath, vmState, suspended, waitUntil: null,
    cpuHistory: []
  };
}

export function newSystemBase({ id, name, parentId, depth, isRoot, accent, wallpaper }) {
  const sys = {
    id, name: name || id, parentId, depth, isRoot: !!isRoot,
    state: 'running', paused: false, speed: 1, clock: 0,
    budget: {
      total: isRoot ? 24000 : (depth === 1 ? 12000 : 6000),
      used: 0, grant: 0, grantLimit: isRoot ? 12000 : 6000,
      kernelUsed: 0, appsUsed: 0, memoryQuota: isRoot ? 1024 : 512,
      storageQuota: isRoot ? 16 * 1024 * 1024 : 12 * 1024 * 1024
    },
    processes: [], nextPid: 10,
    kernel: null,
    windows: [], focusId: null, zTop: 20, nextWin: 1,
    viewport: { w: 1440, h: 900 },
    createdAt: Date.now(),
    files: initialFiles(isRoot ? 'root' : 'inner', id),
    settings: {
      name: id, wallpaper: wallpaper || (isRoot ? 'aurora-lake' : 'inner'),
      accent: accent || '#8b7bff', scale: 1, dnd: false,
      theme: 'aurora'
    },
    widgets: newWidgets(),
    notifications: [], nextNote: 10, recycle: [],
    apps: { spreadsheets: {}, editors: {}, players: {}, charts: {}, browser: { tabs: [], activeTabId: null, nextTab: 1 } },
    children: [], nextDoc: 1,
    counters: { doc: 1, note: 1, msg: 1, snap: 1 },
    bootLog: [],
    memoryExtra: 0,
    stateNote: '',
    lastActive: 0
  };
  if (isRoot) {
    sys.processes = ROOT_APP_PROCS.map(([name, service, kind, quota, memory]) => {
      const p = makeProcess(sys, { name, service, kind, quota, memory, state: 'ready' });
      if (kind === 'browser') { p.state = 'waiting'; p.note = '实际网页执行不计入逻辑预算'; }
      return p;
    });
    sys.nextPid = 40;
  }
  return sys;
}

export function createRootSystem() {
  const sys = newSystemBase({ id: 'outer', name: 'outer', parentId: null, depth: 0, isRoot: true });
  sys.settings.name = 'Nested OS · outer';
  sys.processes.find(p => p.service === 'shell').state = 'ready';
  return sys;
}

export function touch(model) { changed('model'); }

export function getSystem(model, id) { return model.systems[id] || null; }

export function systemList(model) {
  return Object.values(model.systems).sort((a, b) => (a.depth - b.depth) || a.id.localeCompare(b.id, 'zh'));
}

export function childrenOf(model, sys) { return sys.children.map(id => model.systems[id]).filter(Boolean); }

export function ancestorsOf(model, sys) {
  const out = [];
  let p = sys.parentId ? model.systems[sys.parentId] : null;
  while (p) { out.push(p); p = p.parentId ? model.systems[p.parentId] : null; }
  return out;
}

export function ancestorIds(model, sys) {
  return ancestorsOf(model, sys).map(s => s.id);
}

export function isAncestor(model, ancestorId, sysId) {
  let s = model.systems[sysId];
  while (s && s.parentId) {
    if (s.parentId === ancestorId) return true;
    s = model.systems[s.parentId];
  }
  return false;
}

export function subtreeIds(model, id) {
  const out = [];
  const walk = (sid) => {
    const s = model.systems[sid]; if (!s) return;
    out.push(sid); s.children.forEach(walk);
  };
  walk(id);
  return out;
}

export function isPausedEffectively(model, sys) {
  if (!sys) return true;
  if (sys.state === 'error' || sys.state === 'stopped') return true;
  let s = sys;
  while (s) {
    if (s.paused) return true;
    s = s.parentId ? model.systems[s.parentId] : null;
  }
  return false;
}

export function pausedByAncestor(model, sys) {
  let s = sys.parentId ? model.systems[sys.parentId] : null;
  while (s) {
    if (s.paused || s.state === 'error' || s.state === 'stopped') return s;
    s = s.parentId ? model.systems[s.parentId] : null;
  }
  return null;
}

export function effectiveSpeed(model, sys) {
  let rate = 1, s = sys;
  while (s) { rate *= s.speed; s = s.parentId ? model.systems[s.parentId] : null; }
  return rate;
}

export function runtimeState(model, sys) {
  if (!sys) return 'missing';
  if (sys.state === 'error') return 'error';
  if (sys.state === 'stopped') return 'stopped';
  if (sys.paused) return 'paused';
  const anc = pausedByAncestor(model, sys);
  if (anc) return 'ancestor-paused';
  return 'running';
}

export function stateLabel(st) {
  return { running: '运行中', paused: '已暂停', 'ancestor-paused': '祖先已暂停', error: '内核错误', stopped: '已停止', missing: '不存在', waiting: '等待', ready: '就绪', suspended: '挂起', ended: '结束', done: '完成' }[st] || st;
}

/* ---------------- 文件系统 ---------------- */
export function resolvePath(p) { return normPath(p || '/'); }

export function fsNode(sys, path) { return sys.files[resolvePath(path)] || null; }

export function fsEnsureDir(sys, dir) {
  dir = resolvePath(dir);
  if (dir === '/') return true;
  const parts = dir.split('/').filter(Boolean);
  let cur = '';
  for (const part of parts) {
    cur += '/' + part;
    if (!sys.files[cur]) sys.files[cur] = { type: 'dir' };
    if (sys.files[cur].type !== 'dir') return false;
  }
  return true;
}

export function fsList(sys, dir) {
  dir = resolvePath(dir);
  const node = sys.files[dir];
  if (!node || node.type !== 'dir') return [];
  const prefix = dir === '/' ? '/' : dir + '/';
  const out = [];
  for (const [p, n] of Object.entries(sys.files)) {
    if (!p.startsWith(prefix)) continue;
    if (p === dir) continue;
    const rest = p.slice(prefix.length);
    if (!rest || rest.includes('/')) continue;
    out.push({ path: p, name: rest, type: n.type, size: n.type === 'file' ? (n.content || '').length : 0, modified: n.modified || n.created || 0, node: n });
  }
  out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'zh') : a.type === 'dir' ? -1 : 1));
  return out;
}

export function fsRead(sys, path) {
  const n = fsNode(sys, path);
  return n && n.type === 'file' ? n.content : null;
}

export function storageUsed(sys) {
  let size = 0;
  for (const n of Object.values(sys.files)) if (n.type === 'file') size += (n.content || '').length;
  for (const r of sys.recycle) size += (r.node && r.node.content ? r.node.content.length : 0);
  return size;
}

export function memoryUsed(sys) {
  return sys.processes.reduce((a, p) => a + (p.memory || 0), 0) + (sys.memoryExtra || 0);
}

export function checkStorage(sys, extraBytes) {
  return storageUsed(sys) + extraBytes <= sys.budget.storageQuota;
}

export function fsWrite(sys, path, content, mime = 'text/plain') {
  path = resolvePath(path);
  const dir = pathDir(path);
  if (!fsNode(sys, dir) || fsNode(sys, dir).type !== 'dir') return { ok: false, error: `目录不存在：${dir}` };
  const old = sys.files[path];
  const contentStr = String(content);
  const oldSize = old && old.type === 'file' ? old.content.length : 0;
  const extra = contentStr.length - oldSize;
  if (extra > 0 && !checkStorage(sys, extra)) return { ok: false, error: '存储配额不足，无法写入文件' };
  sys.files[path] = { type: 'file', content: contentStr, mime, created: old ? old.created : Date.now(), modified: Date.now() };
  return { ok: true, path };
}

export function fsMkdir(sys, path) {
  path = resolvePath(path);
  if (sys.files[path]) return { ok: false, error: '同名项目已存在' };
  const dir = pathDir(path);
  if (!fsNode(sys, dir) || fsNode(sys, dir).type !== 'dir') return { ok: false, error: `目录不存在：${dir}` };
  sys.files[path] = { type: 'dir', created: Date.now() };
  return { ok: true, path };
}

export function fsMoveToRecycle(sys, path) {
  path = resolvePath(path);
  if (path === '/') return { ok: false, error: '不能删除根目录' };
  const node = sys.files[path];
  if (!node) return { ok: false, error: '项目不存在' };
  const entry = { id: 'r' + Date.now().toString(36) + Math.floor(Math.random() * 999), name: pathBase(path), originalPath: path, node: deepClone(node), deletedAt: Date.now() };
  sys.recycle.push(entry);
  // 递归删除
  const prefix = path + '/';
  for (const p of Object.keys(sys.files)) if (p === path || p.startsWith(prefix)) delete sys.files[p];
  return { ok: true, entry };
}

export function fsRestoreRecycle(sys, recycleId) {
  const i = sys.recycle.findIndex(r => r.id === recycleId);
  if (i < 0) return { ok: false, error: '回收站项目不存在' };
  const entry = sys.recycle[i];
  let target = entry.originalPath;
  let n = 1;
  while (sys.files[target]) {
    target = pathJoin(pathDir(entry.originalPath), pathBase(entry.originalPath).replace(/(\.[^.]*)?$/, ` (${n++})$1`));
  }
  fsEnsureDir(sys, pathDir(target));
  sys.files[target] = entry.node;
  sys.recycle.splice(i, 1);
  return { ok: true, path: target };
}

export function fsEmptyRecycle(sys) {
  const n = sys.recycle.length;
  sys.recycle = [];
  return { ok: true, count: n };
}

export function fsDeletePermanent(sys, path) {
  const prefix = path + '/';
  for (const p of Object.keys(sys.files)) if (p === path || p.startsWith(prefix)) delete sys.files[p];
}

export function fsRename(sys, path, newName) {
  path = resolvePath(path);
  if (!newName || /[\\/]/.test(newName)) return { ok: false, error: '名称不能包含斜杠' };
  const node = sys.files[path];
  if (!node) return { ok: false, error: '项目不存在' };
  const dest = pathJoin(pathDir(path), newName);
  if (dest === path) return { ok: true, path };
  if (sys.files[dest]) return { ok: false, error: '同名项目已存在' };
  const move = (from, to) => {
    sys.files[to] = sys.files[from];
    delete sys.files[from];
    const pre = from + '/';
    for (const p of Object.keys(sys.files)) {
      if (p.startsWith(pre)) { sys.files[to + p.slice(from.length)] = sys.files[p]; delete sys.files[p]; }
    }
  };
  move(path, dest);
  return { ok: true, path: dest };
}

export function fsCopyInto(sys, sourceSystem, sourcePath, destDir, { overwrite = false } = {}) {
  const node = sourceSystem.files[sourcePath];
  if (!node) return { ok: false, error: '源文件不存在' };
  destDir = resolvePath(destDir);
  if (!sys.files[destDir] || sys.files[destDir].type !== 'dir') return { ok: false, error: '目标目录不存在' };
  const name = pathBase(sourcePath);
  let dest = pathJoin(destDir, name);
  if (sys.files[dest] && !overwrite) return { ok: false, conflict: true, path: dest, name };
  let extra = 0;
  if (node.type === 'file') extra = (node.content || '').length;
  else {
    const pre = sourcePath + '/';
    for (const [p, n] of Object.entries(sourceSystem.files)) if (p.startsWith(pre) && n.type === 'file') extra += (n.content || '').length;
  }
  if (!checkStorage(sys, extra)) return { ok: false, error: '目标系统存储配额不足' };
  if (node.type === 'file') {
    sys.files[dest] = { type: 'file', content: node.content, mime: node.mime, created: Date.now(), modified: Date.now() };
  } else {
    fsEnsureDir(sys, dest);
    const pre = sourcePath + '/';
    for (const [p, n] of Object.entries(sourceSystem.files)) {
      if (!p.startsWith(pre)) continue;
      const rel = p.slice(pre.length);
      if (n.type === 'dir') fsEnsureDir(sys, dest + '/' + rel);
      else sys.files[dest + '/' + rel] = { type: 'file', content: n.content, mime: n.mime, created: Date.now(), modified: Date.now() };
    }
  }
  return { ok: true, path: dest };
}

/* ---------------- 进程与预算 ---------------- */
export function findProcess(sys, key) {
  if (typeof key === 'number') return sys.processes.find(p => p.pid === key) || null;
  return sys.processes.find(p => p.service === key || p.name === key) || null;
}

export function addProcess(sys, opts) {
  const proc = makeProcess(sys, opts);
  sys.processes.push(proc);
  return proc;
}

export function ensureProcess(sys, service) {
  const map = {
    files: '文件系统服务', spreadsheet: '电子表格', widgets: '桌面小组件', editor: '文本与程序编辑器',
    browser: '浏览器', tasks: '任务管理器', settings: '设置', systems: '系统管理', guide: '操作说明',
    player: '三维播放器', charts: '图表工作台', controller: '飞控'
  };
  let proc = sys.processes.find(p => p.service === service);
  if (!proc && !sys.isRoot) return null;
  if (!proc) {
    proc = makeProcess(sys, { name: map[service] || service, service, kind: 'app', quota: 2400, memory: 6 });
    sys.processes.push(proc);
  }
  return proc;
}

export function chargeWork(sys, key, amount, { allowOver = false } = {}) {
  const proc = findProcess(sys, key);
  const total = sys.budget.total;
  const remain = Math.max(0, total - sys.budget.used);
  let used = Math.min(amount, remain);
  if (allowOver && used === 0) used = 0;
  sys.budget.used += used;
  if (proc) {
    proc.work = (proc.work || 0) + used;
    proc.workTotal = (proc.workTotal || 0) + used;
  }
  return { used, short: used < amount, remaining: Math.max(0, total - sys.budget.used) };
}

export function requestMemory(sys, proc, mb) {
  const used = memoryUsed(sys);
  if (used + mb > sys.budget.memoryQuota) return false;
  proc.memory = (proc.memory || 0) + mb;
  return true;
}

export function releaseMemory(proc, mb) {
  proc.memory = Math.max(1, (proc.memory || 0) - mb);
}

/* ---------------- 通知 ---------------- */
export function notify(sys, title, body, opts = {}) {
  const n = {
    id: 'n' + (sys.counters.msg++),
    title, body, clock: sys.clock, read: false, at: Date.now(), kind: opts.kind || 'info'
  };
  sys.notifications.unshift(n);
  if (sys.notifications.length > 60) sys.notifications.length = 60;
  if (!sys.settings.dnd && opts.toast !== false && rt.ui) rt.ui.toast(title, body, opts.kind || 'info', sys);
  changed('notify');
  return n;
}

export function unreadCount(sys) { return sys.notifications.filter(n => !n.read).length; }

/* ---------------- 窗口 ---------------- */
const APP_SIZES = {
  files: [920, 600], spreadsheet: [1080, 680], widgets: [860, 650], editor: [900, 620],
  browser: [1120, 740], tasks: [1000, 660], settings: [820, 620], systems: [880, 640],
  player: [980, 660], charts: [940, 640], guide: [820, 660], projection: [760, 540]
};
const APP_TITLES = {
  files: '文件管理器', spreadsheet: '电子表格', widgets: '桌面小组件', editor: '文本与程序编辑器',
  browser: '浏览器', tasks: '任务管理器', settings: '设置', systems: '系统管理',
  player: '三维场景播放器', charts: '图表工作台', guide: '操作说明', projection: '投送'
};

export function nextWindowId(sys) {
  let id;
  do { id = `w${sys.id.replace(/[^a-z0-9]/gi, '')}-${sys.nextWin++}`; } while (sys.windows.some(w => w.id === id));
  return id;
}

export function fitWindow(sys, w, h) {
  const vw = Math.max(320, sys.viewport.w), vh = Math.max(260, sys.viewport.h);
  w = Math.min(w, vw - 24); h = Math.min(h, vh - 64);
  const offset = Math.min(sys.windows.length, 6) * 22;
  const x = clamp(Math.round((vw - w) / 2 + offset - 40), 4, Math.max(4, vw - w - 4));
  const y = clamp(Math.round((vh - h) / 2 + offset - 40), 4, Math.max(4, vh - h - 44));
  return { x, y, w, h };
}

export function openWindow(model, sys, appId, opts = {}) {
  let title = opts.title || APP_TITLES[appId] || appId;
  let payload = opts.payload ? deepClone(opts.payload) : {};
  if (appId === 'system') {
    const child = model.systems[payload.childId];
    if (!child) return null;
    title = child.name;
    payload = { childId: child.id };
  }
  let [w, h] = APP_SIZES[appId] || [860, 600];
  if (appId === 'system') {
    w = Math.max(640, Math.min(1180, Math.round(sys.viewport.w * 0.78)));
    h = Math.max(480, Math.min(790, Math.round(sys.viewport.h * 0.82)));
  }
  if (appId === 'player') { w = Math.max(520, Math.min(1050, Math.round(sys.viewport.w * 0.7))); h = Math.max(420, Math.min(720, Math.round(sys.viewport.h * 0.72))); }
  const geom = opts.geometry || fitWindow(sys, w, h);
  const win = {
    id: nextWindowId(sys), systemId: sys.id, appId, title,
    x: geom.x, y: geom.y, w: geom.w, h: geom.h,
    minimized: false, maximized: false, snap: null,
    z: ++sys.zTop, payload, createdAt: sys.clock,
    subtitle: opts.subtitle || ''
  };
  if (opts.maximized) { win.maximized = true; win.prev = { x: win.x, y: win.y, w: win.w, h: win.h }; }
  sys.windows.push(win);
  focusWindow(sys, win.id);
  if (!sys.isRoot) ensureProcess(sys, appId);
  if (appId === 'spreadsheet' && payload.docId) {
    const doc = sys.apps.spreadsheets[payload.docId];
    if (doc) { win.title = doc.name; }
  }
  changed('open-window');
  return win;
}

export function openProjection(model, targetSys, sourceSys, sourceWin, appId) {
  const existing = targetSys.windows.find(w => w.appId === 'projection' && w.payload.sourceWindowId === sourceWin.id && w.payload.sourceSystemId === sourceSys.id);
  if (existing) { focusWindow(targetSys, existing.id); return { win: existing, existing: true }; }
  const geom = fitWindow(targetSys, 760, 540);
  const win = {
    id: nextWindowId(targetSys), systemId: targetSys.id, appId: 'projection', title: `投送 · ${sourceWin.title}`,
    x: geom.x + 30, y: geom.y + 30, w: geom.w, h: geom.h,
    minimized: false, maximized: false, snap: null, z: ++targetSys.zTop,
    payload: { sourceSystemId: sourceSys.id, sourceWindowId: sourceWin.id, sourceAppId: sourceWin.appId },
    createdAt: targetSys.clock, subtitle: `源：${sourceSys.id} / ${sourceWin.id}`,
    projection: true
  };
  targetSys.windows.push(win);
  focusWindow(targetSys, win.id);
  changed('projection');
  return { win, existing: false };
}

export function closeProjectionOfSource(model, sourceSysId, sourceWinId) {
  const closed = [];
  for (const sys of Object.values(model.systems)) {
    const keep = [];
    for (const w of sys.windows) {
      if (w.appId === 'projection' && w.payload.sourceSystemId === sourceSysId && (sourceWinId == null || w.payload.sourceWindowId === sourceWinId)) {
        closed.push({ systemId: sys.id, winId: w.id });
      } else keep.push(w);
    }
    sys.windows = keep;
    if (sys.focusId && !sys.windows.some(w => w.id === sys.focusId)) sys.focusId = sys.windows.length ? sys.windows[sys.windows.length - 1].id : null;
  }
  return closed;
}

export function focusWindow(sys, id) {
  const win = sys.windows.find(w => w.id === id);
  if (!win) return;
  win.z = ++sys.zTop;
  if (win.minimized) win.minimized = false;
  sys.focusId = id;
}

export function closeWindow(model, sys, id, { keepProjections = false } = {}) {
  const idx = sys.windows.findIndex(w => w.id === id);
  if (idx < 0) return null;
  const win = sys.windows[idx];
  sys.windows.splice(idx, 1);
  if (!keepProjections) closeProjectionOfSource(model, sys.id, win.id);
  if (win.appId === 'player') delete sys.apps.players[id];
  if (win.appId === 'charts') delete sys.apps.charts[id];
  if (win.appId === 'editor') delete sys.apps.editors[id];
  if (win.appId === 'spreadsheet' && win.payload && win.payload.docId) {
    const doc = sys.apps.spreadsheets[win.payload.docId];
    if (doc) { doc.open = false; if (!doc.dirty) delete sys.apps.spreadsheets[win.payload.docId]; }
  }
  if (sys.focusId === id) {
    const top = sys.windows.filter(w => !w.minimized).sort((a, b) => b.z - a.z)[0];
    sys.focusId = top ? top.id : null;
  }
  changed('close-window');
  return win;
}

/* ---------------- 系统树 ---------------- */
export function systemPathInParent(id) { return `/System/subsystems/${id}/kernel.nest`; }

export function createSubsystem(model, parent, opts = {}) {
  if (!parent) return { ok: false, error: '父系统不存在' };
  if (parent.depth >= MAX_DEPTH - 1) return { ok: false, error: `最多支持 ${MAX_DEPTH} 层桌面` };
  const id = opts.id || `inner-${model.nextInner++}`;
  if (model.systems[id]) return { ok: false, error: '实例 ID 重复' };
  fsEnsureDir(parent, `/System/subsystems/${id}`);
  const source = opts.kernelSource || kernelSource(id, id);
  const write = fsWrite(parent, systemPathInParent(id), source, 'text/x-nestlang');
  if (!write.ok) return { ok: false, error: write.error };
  const accents = ['#4be3d1', '#8b7bff', '#ff7aa2', '#5ba8ff', '#ffb04d', '#8ee06a'];
  const child = newSystemBase({
    id, name: id, parentId: parent.id, depth: parent.depth + 1, isRoot: false,
    accent: accents[parent.depth % accents.length],
    wallpaper: 'inner'
  });
  child.viewport = { ...parent.viewport };
  model.systems[id] = child;
  parent.children.push(id);
  // 父系统的承载进程
  const carrier = makeProcess(parent, {
    name: `承载 ${id}`, kind: 'carrier', service: 'carrier', quota: child.budget.total,
    memory: 24, state: 'ready', childId: id
  });
  carrier.carrier = true;
  carrier.kernelWork = 0; carrier.userWork = 0;
  parent.processes.push(carrier);
  // 父桌面上的系统窗口
  const sysWin = openWindow(model, parent, 'system', {
    payload: { childId: id },
    geometry: fitWindow(parent, Math.max(700, Math.min(1660, Math.round(parent.viewport.w * 0.86))), Math.max(500, Math.min(990, Math.round(parent.viewport.h * 0.87))))
  });
  // 子桌面在系统窗口内可用的大致区域；播放器默认占据其中大部分面积
  if (child.viewport.w < 640 || child.viewport.h < 440) child.viewport = { ...parent.viewport };
  if (sysWin) {
    child.viewport = {
      w: Math.max(560, Math.round(sysWin.w - 8)),
      h: Math.max(400, Math.round(sysWin.h - 50))
    };
  }
  const scenePath = '/Demo/helicopter-24.scene';
  const playerGeom = defaultPlayerGeometry(child);
  const playerWin = openWindow(model, child, 'player', { payload: { scenePath }, geometry: playerGeom });
  if (playerWin) {
    if (!child.apps.players[playerWin.id]) child.apps.players[playerWin.id] = makePlayerState(child, playerWin.id, scenePath);
    playerWin.title = '三维场景播放器';
  }
  changed('create-subsystem');
  return { ok: true, system: child, kernelPath: systemPathInParent(id) };
}

export function defaultPlayerGeometry(sys) {
  const vw = sys.viewport.w || 1200, vh = sys.viewport.h || 760;
  const left = vw > 900 ? 112 : (vw > 700 ? 84 : 16);
  return { x: left, y: 38, w: Math.max(480, vw - left - 18), h: Math.max(340, vh - 90) };
}

export function makePlayerState(sys, winId, scenePath) {
  return {
    scenePath: scenePath || '/Demo/helicopter-24.scene',
    position: 0, duration: 15, playing: false, rate: 1, loop: false,
    mode: 'show', camera: 'auto', freeCam: { yaw: 0.6, pitch: 0.25, dist: 22 },
    selected: null, loaded: false, error: null, frameTime: 0,
    lastAdvance: null, speed: 1,
    rehearsal: {
      active: false, wind: 0.15, windDir: 210, targetHeading: 90, fault: false,
      physics: null, controls: { collective: 0.5, pitch: 0, roll: 0, pedal: 0 },
      controlUpdates: 0, lastControlAt: 0, controllerPid: null,
      recordPath: null, recordStart: 0
    },
    sceneError: null,
    viewVersion: 0
  };
}

export function serializeModel(model) {
  // 去掉运行时句柄（_vm/_bridge 等），但保留虚拟机等待标记 __wait
  return JSON.stringify(model, (k, v) => (k && k.startsWith('_') && k !== '__wait') ? undefined : v);
}

export function syncSequences(model) {
  let maxPid = 0, maxInner = 0;
  for (const sys of Object.values(model.systems || {})) {
    for (const p of sys.processes || []) maxPid = Math.max(maxPid, p.pid || 0);
    const m = /^inner-(\d+)$/.exec(sys.id);
    if (m) maxInner = Math.max(maxInner, Number(m[1]));
  }
  pidSeq = Math.max(pidSeq, maxPid);
  model.nextInner = Math.max(model.nextInner || 1, maxInner + 1);
}

export function deserializeModel(json) {
  const model = typeof json === 'string' ? JSON.parse(json) : json;
  if (!model || !model.systems) throw new Error('无效的模型数据');
  for (const sys of Object.values(model.systems)) {
    sys.viewport = sys.viewport || { w: 1440, h: 900 };
    sys.processes = sys.processes || [];
    sys.apps = sys.apps || { spreadsheets: {}, editors: {}, players: {}, charts: {}, browser: { tabs: [], activeTabId: null } };
    sys.notifications = sys.notifications || [];
    sys.recycle = sys.recycle || [];
    sys.children = sys.children || [];
  }
  syncSequences(model);
  return model;
}

/* ---------------- 快照 ---------------- */
export function snapshotSubtree(model, childSys) {
  const parent = model.systems[childSys.parentId];
  if (!parent) return { ok: false, error: '父系统不存在' };
  const ids = subtreeIds(model, childSys.id);
  const systems = {};
  for (const id of ids) {
    const copy = JSON.parse(serializeModel(model.systems[id]));
    systems[id] = copy;
  }
  const kernelSources = {};
  for (const id of ids) {
    const sys = model.systems[id];
    const parentOf = sys.parentId ? model.systems[sys.parentId] : null;
    if (parentOf) kernelSources[id] = fsRead(parentOf, systemPathInParent(id)) || (sys.kernel ? sys.kernel.source : '') || '';
  }
  const data = {
    format: 'nested-snapshot', version: 1,
    createdAt: Date.now(), clock: childSys.clock, rootId: childSys.id,
    parentId: parent.id, systems, kernelSources,
    note: `快照：${childSys.name} 及全部后代`
  };
  const text = JSON.stringify(data);
  const name = `${childSys.id}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.snap`;
  const path = `/Snapshots/${name}`;
  fsEnsureDir(parent, '/Snapshots');
  const work = Math.round(text.length / 16) + 120;
  const charged = chargeWork(parent, 'files', work);
  if (charged.short) return { ok: false, error: '父系统预算不足，无法完成快照写入' };
  const w = fsWrite(parent, path, text, 'application/x-nested-snapshot');
  if (!w.ok) return { ok: false, error: w.error };
  notify(parent, '已创建快照', `${childSys.name} 的整棵子树已保存到 ${path}`, { kind: 'ok' });
  changed('snapshot');
  return { ok: true, path, size: text.length };
}

export function listSnapshots(sys) {
  return fsList(sys, '/Snapshots').filter(f => f.type === 'file' && f.name.endsWith('.snap'));
}

export function readSnapshot(sys, path) {
  const text = fsRead(sys, path);
  if (!text) return { ok: false, error: '快照文件不存在' };
  try {
    const data = JSON.parse(text);
    if (data.format !== 'nested-snapshot') return { ok: false, error: '不是有效的快照文件' };
    return { ok: true, data, text };
  } catch (e) { return { ok: false, error: '快照内容已损坏：' + e.message }; }
}

function reattachSystem(model, sys) {
  sys.viewport = sys.viewport || { w: 1440, h: 900 };
  sys.processes = sys.processes || [];
  // 保留原始进程状态：快照时已结束的应用任务不会因为恢复而重新运行；
  // 用户重新打开应用窗口时再由 reviveAppServices 从程序文件恢复。
  for (const proc of sys.processes) if (!proc.state) proc.state = 'ready';
}

export function restoreSnapshot(model, parent, data, opts = {}) {
  const oldId = data.rootId;
  const parentSys = model.systems[opts.parentId || data.parentId || parent.id];
  if (!parentSys) return { ok: false, error: '目标父系统不存在' };
  const fork = !!opts.fork;
  const idMap = {};
  if (fork) {
    for (const oldSysId of Object.keys(data.systems)) {
      const old = data.systems[oldSysId];
      if (oldSysId === oldId) idMap[oldSysId] = `inner-${model.nextInner++}`;
      else idMap[oldSysId] = `inner-${model.nextInner++}`;
    }
  } else {
    for (const oldSysId of Object.keys(data.systems)) idMap[oldSysId] = oldSysId;
    // 恢复前移除现有同名子树，以及祖先桌面上指向它的窗口
    const oldIds = subtreeIds(model, oldId);
    for (const sid of oldIds) {
      if (model.systems[sid]) delete model.systems[sid];
    }
    for (const other of Object.values(model.systems)) {
      // 外部投送外框保留：恢复后的源窗口沿用同一窗口标识，会重新挂接；
      // 若源窗口确实不存在，投送视图会在挂载时自行结束。
      other.windows = other.windows.filter(w => {
        if (!w || !w.payload) return true;
        if (w.appId === 'system' && oldIds.includes(w.payload.childId)) return false;
        return true;
      });
      if (other.focusId && !other.windows.some(w => w.id === other.focusId)) other.focusId = other.windows.length ? other.windows[other.windows.length - 1].id : null;
    }
    parentSys.children = parentSys.children.filter(cid => cid !== oldId);
    parentSys.processes = parentSys.processes.filter(p => p.childId !== oldId);
  }
  const newRootId = idMap[oldId];
  const systems = {};
  for (const [oldSysId, old] of Object.entries(data.systems)) {
    const copy = JSON.parse(JSON.stringify(old));
    copy.id = idMap[oldSysId];
    copy.name = copy.id;
    copy.parentId = old.parentId && idMap[old.parentId] ? idMap[old.parentId] : parentSys.id;
    copy.depth = old.depth;
    copy.children = (old.children || []).map(c => idMap[c]).filter(Boolean);
    // 窗口与进程中的内部引用
    const winMap = {};
    let wseq = 0;
    for (const w of copy.windows || []) {
      if (w.appId === 'system' && w.payload && w.payload.childId) w.payload.childId = idMap[w.payload.childId] || w.payload.childId;
      if (w.appId === 'projection' && w.payload && w.payload.sourceSystemId) w.payload.sourceSystemId = idMap[w.payload.sourceSystemId] || w.payload.sourceSystemId;
      const oldWinId = w.id;
      if (fork) {
        w.id = `w${copy.id.replace(/[^a-z0-9]/gi, '')}-${++wseq}`;
        winMap[oldWinId] = w.id;
      }
      if (w.payload && w.payload.sourceWindowId && winMap[w.payload.sourceWindowId]) w.payload.sourceWindowId = winMap[w.payload.sourceWindowId];
      if (w.payload && w.payload.sourceSystemId) w.payload.sourceSystemId = idMap[w.payload.sourceSystemId] || w.payload.sourceSystemId;
    }
    if (fork && copy.windows) {
      // 应用状态以窗口 id 为键，分叉时同步改用新 id
      const remapDict = (dict) => {
        if (!dict) return {};
        const out = {};
        for (const [wid, val] of Object.entries(dict)) {
          const nid = winMap[wid] || wid;
          if (val && typeof val === 'object') val.winId = nid;
          out[nid] = val;
        }
        return out;
      };
      copy.apps.players = remapDict(copy.apps.players);
      copy.apps.charts = remapDict(copy.apps.charts);
      copy.apps.editors = remapDict(copy.apps.editors);
    }
    for (const p of copy.processes || []) if (p.childId) p.childId = idMap[p.childId] || p.childId;
    if (copy.state !== 'error') copy.state = 'running';
    if (!copy.kernel) copy.kernel = null;
    // 恢复/分叉后，根系统实时数据连接属于“已恢复，待重新连接”
    for (const chart of Object.values(copy.apps.charts || {})) {
      if (chart.connection === 'connected') {
        chart.connection = 'restored';
        chart.pendingIn = [];
        chart.statusText = '已恢复，待重新连接';
      }
    }
    reattachSystem(model, copy);
    systems[copy.id] = copy;
  }
  // 文件名中的子目录也要跟着改名
  for (const sys of Object.values(systems)) {
    if (!fork) break;
    const newFiles = {};
    for (const [p, n] of Object.entries(sys.files || {})) {
      let np = p;
      for (const [oldSid, newSid] of Object.entries(idMap)) {
        np = np.replace(`/System/subsystems/${oldSid}`, `/System/subsystems/${newSid}`);
      }
      newFiles[np] = n;
    }
    sys.files = newFiles;
  }
  Object.assign(model.systems, systems);
  // 挂到目标父系统
  if (!parentSys.children.includes(newRootId)) parentSys.children.push(newRootId);
  fsEnsureDir(parentSys, `/System/subsystems`);
  const kernelSrc = data.kernelSources[oldId] || (data.systems[oldId] && data.systems[oldId].kernel ? data.systems[oldId].kernel.source : '') || '';
  fsEnsureDir(parentSys, `/System/subsystems/${newRootId}`);
  fsWrite(parentSys, systemPathInParent(newRootId), kernelSrc, 'text/x-nestlang');
  // 子树内部的内核文件
  for (const [oldSid, newSid] of Object.entries(idMap)) {
    if (oldSid === oldId) continue;
    const src = data.kernelSources[oldSid] || '';
    const p = systems[newSid] && systems[newSid].parentId ? systems[systems[newSid].parentId] : null;
    if (p) { fsEnsureDir(p, `/System/subsystems/${newSid}`); fsWrite(p, systemPathInParent(newSid), src, 'text/x-nestlang'); }
  }
  // 父系统承载进程
  const carrier = makeProcess(parentSys, {
    name: `承载 ${newRootId}`, kind: 'carrier', service: 'carrier', quota: systems[newRootId].budget.total,
    memory: 24, state: 'ready', childId: newRootId
  });
  carrier.carrier = true; carrier.kernelWork = 0; carrier.userWork = 0;
  parentSys.processes.push(carrier);
  // 恢复/分叉后在父桌面打开系统窗口
  openWindow(model, parentSys, 'system', { payload: { childId: newRootId } });
  if (fork) {
    // 源窗口编号保持唯一
    for (const sys of Object.values(systems)) { sys.zTop = Math.max(...(sys.windows || []).map(w => w.z), 20); sys.nextWin = Math.max(20, sys.nextWin || 1); }
    notify(parentSys, '已分叉子树', `${oldId} 的快照已作为独立子树 ${newRootId} 启动`, { kind: 'ok' });
  } else {
    notify(parentSys, '已恢复快照', `${newRootId} 已从 ${new Date(data.createdAt).toLocaleString('zh-CN')} 的快照继续`, { kind: 'ok' });
  }
  changed('restore-snapshot');
  return { ok: true, newRootId, fork };
}

export function resetRuntime(model, sys, { isRootKeep = false } = {}) {
  const keepSpeed = sys.speed;
  sys.clock = 0;
  sys.state = 'running';
  sys.paused = false;
  sys.speed = keepSpeed;
  sys.budget.used = 0;
  sys.windows = [];
  sys.focusId = null;
  sys.zTop = 20;
  sys.nextWin = 1;
  sys.notifications = [];
  sys.recycle = [];
  sys.apps = { spreadsheets: {}, editors: {}, players: {}, charts: {}, browser: { tabs: [], activeTabId: null, nextTab: 1 } };
  sys.kernel = null;
  if (sys.isRoot) {
    sys.processes = sys.processes.filter(p => p.kind !== 'carrier');
    for (const p of sys.processes) { p.state = 'ready'; p.work = 0; p.workTotal = 0; p.error = null; p.suspended = false; p.vmState = null; }
  } else {
    sys.processes = sys.processes.filter(p => p.kind === 'carrier');
    for (const p of sys.processes) { p.state = 'ready'; p.work = 0; p.vmState = null; }
  }
  for (const childId of sys.children) {
    const c = model.systems[childId];
    if (c) resetRuntime(model, c);
  }
}

export function restartSubtree(model, sys) {
  const parent = sys.parentId ? model.systems[sys.parentId] : null;
  // 清除旧窗口（含子系统的窗口）
  const ids = subtreeIds(model, sys.id);
  for (const id of ids) {
    const s = model.systems[id];
    if (s) {
      s.windows = [];
      s.apps = { spreadsheets: {}, editors: {}, players: {}, charts: {}, browser: { tabs: [], activeTabId: null, nextTab: 1 } };
    }
  }
  const ancestors = parent ? [parent, ...ancestorsOf(model, parent)] : [];
  for (const a of ancestors) a.windows = a.windows.filter(w => !(w.appId === 'system' && w.payload && ids.includes(w.payload.childId)) && !(w.appId === 'projection' && ids.includes(w.payload.sourceSystemId)));
  resetRuntime(model, sys);
  const parentKernelPath = parent ? systemPathInParent(sys.id) : null;
  if (parent && parentKernelPath) sys.kernel = {
    path: parentKernelPath,
    source: fsRead(parent, parentKernelPath) || '',
    error: null, vmState: null, started: false, logs: []
  };
  if (parent) {
    openWindow(model, parent, 'system', { payload: { childId: sys.id } });
    // 重启后默认打开播放器
    const pw = openWindow(model, sys, 'player', { payload: { scenePath: '/Demo/helicopter-24.scene' }, geometry: defaultPlayerGeometry(sys) });
    if (pw && !sys.apps.players[pw.id]) sys.apps.players[pw.id] = makePlayerState(sys, pw.id, '/Demo/helicopter-24.scene');
  }
  for (const cid of sys.children) {
    const c = model.systems[cid];
    if (c && parent) {
      // 重新打开每一级子系统的入口窗口由递归重启完成
      restartSubtree(model, c);
    }
  }
  changed('restart');
  return { ok: true };
}

export function removeSubtree(model, sys) {
  const parent = sys.parentId ? model.systems[sys.parentId] : null;
  const ids = subtreeIds(model, sys.id);
  closeProjectionOfSource(model, sys.id);
  for (const id of ids) {
    const s = model.systems[id];
    if (!s) continue;
    delete model.systems[id];
    for (const other of Object.values(model.systems)) {
      other.windows = other.windows.filter(w => !(w.appId === 'projection' && w.payload && ids.includes(w.payload.sourceSystemId)));
    }
  }
  if (parent) {
    parent.children = parent.children.filter(c => c !== sys.id);
    parent.processes = parent.processes.filter(p => p.childId !== sys.id);
    parent.windows = parent.windows.filter(w => !(w.appId === 'system' && w.payload && w.payload.childId === sys.id));
    if (parent.focusId && !parent.windows.some(w => w.id === parent.focusId)) parent.focusId = parent.windows.length ? parent.windows[parent.windows.length - 1].id : null;
  }
  changed('remove-subtree');
  return { ok: true, removed: ids };
}

export function updateSystemName(sys, name) {
  sys.settings.name = name;
  sys.name = name;
  changed('rename');
}

export function projectionSource(model, projWin) {
  const p = projWin.payload || {};
  const srcSys = model.systems[p.sourceSystemId];
  const srcWin = srcSys ? srcSys.windows.find(w => w.id === p.sourceWindowId) : null;
  return { sys: srcSys, win: srcWin };
}

export function sourceTag(sys) {
  const depth = sys.depth;
  return `${sys.id} · 第 ${depth + 1} 层`;
}

export { GUIDE_MD };
