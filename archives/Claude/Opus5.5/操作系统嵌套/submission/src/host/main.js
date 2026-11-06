// 启动入口：把宿主设备、根内核、根桌面接到一起，驱动逻辑步。
import { RootKernel, RootFS, STEP_DT } from './rootkernel.js';
import { Device } from './device.js';
import { GfxDevice } from './gfx.js';
import { RootDesktop, h } from '../root/desktop.js';
import { filesApp, editorApp, consoleApp, tasksApp, settingsApp, systemsApp, helpApp } from '../root/apps.js';
import { sheetApp, DataHub } from '../root/sheet.js';
import { widgetsApp, installClipboard } from '../root/widgets.js';
import { browserApp, installBrowser } from '../root/browser.js';

const api = window.hostApi;
const device = new Device();
const fs = new RootFS((op, a, b) => {
  if (op === 'write') api.fsOp('write', a, b);
  else if (op === 'mkdir') api.fsOp('mkdir', a);
  else if (op === 'remove') api.fsOp('remove', a);
  else if (op === 'rename') api.fsOp('rename', a, b);
});

let desk = null;
let kernel = null;
let gfx = null;
let readyResolve;
const readyPromise = new Promise((r) => { readyResolve = r; });

function makeHooks() {
  return {
    notify: (level, text) => { if (desk) desk.notify(level, text); },
    systemName: () => (desk ? desk.settings.name : '根系统'),
    childNew: (info) => { desk.childWindow(info); },
    childState: (info) => { const w = desk.systemWindow(info.id); if (w) desk.renderSysBar(w); },
    childClosed: (id) => { const w = desk.systemWindow(id); if (w) desk.destroyWindow(w); },
    systemsChanged: () => { for (const c of kernel.children.values()) { const w = desk.systemWindow(c.id); if (w) desk.renderSysBar(w); } },
    projOpen: (p) => desk.projectionOpen(p),
    projClose: (id, reason) => desk.projectionClose(id, reason),
    projFocus: (id) => desk.projectionFocus(id),
    focusDesktop: () => desk.setFocus(null),
    xferConflict: async (id, m) => {
      const r = await desk.dialog('文件已存在', `${m.dir} 中已有 ${m.name}（来自 ${m.from} 的文件）。要覆盖吗？`, [{ label: '取消', value: 'no', cancel: true, tid: 'dialog-cancel' }, { label: '覆盖', value: 'yes', primary: true, tid: 'dialog-overwrite' }]);
      kernel.xferDecide(id, r === 'yes');
    },
    fsChanged: () => { if (desk) { refreshFileViews(); } },
    programOutput: (p, d) => { const f = desk.consoles.get(p.pid); if (f) f(d); else if (p.stdout === 0 && p.ppid) { const g = desk.consoles.get(p.ppid); if (g) g(d); } },
    hostExport: (name, text) => {
      // 系统程序导出文件到数据目录的 exports（用户可在说明中找到；根系统另有对话框选择路径）
      api.exportFile(name, text).then((r) => { if (r.error) desk.notify('error', '保存到本机失败：' + r.error); else desk.notify('info', '已保存到本机：' + r.path); });
      return { path: '数据目录/exports/' + name };
    },
    hostImport: async (m) => {
      const r = await desk.hostImportDialog();
      kernel.route({ dst: m.reply, op: 'host_file', pid: m.pid, tag: m.tag, name: r ? r.name : '', text: r ? r.text : '', error: r ? r.error || null : '已取消导入' });
    },
    hostPaths: () => ({}),
    killApp: (p) => { for (const w of desk.windows.values()) if (w.svc === p) { desk.destroyWindow(w); break; } },
  };
}
function refreshFileViews() {
  if (desk.fileManagers) for (const w of desk.fileManagers) w.reload();
  refreshIcons();
}
function refreshIcons() {
  const list = [
    { name: '文件管理器', icon: 'files', app: 'files' }, { name: '电子表格', icon: 'spreadsheet', app: 'spreadsheet' }, { name: '浏览器', icon: 'browser', app: 'browser' },
    { name: '小组件', icon: 'widgets', app: 'widgets' }, { name: '程序编辑器', icon: 'editor', app: 'editor' }, { name: '任务管理器', icon: 'tasks', app: 'tasks' },
    { name: '设置', icon: 'settings', app: 'settings' }, { name: '子系统管理', icon: 'systems', app: 'systems' }, { name: '操作说明', icon: 'help', app: 'help' },
    { name: 'sample.sheet', icon: 'file-sheet', path: '/Demo/sample.sheet' }, { name: 'helicopter-24.scene', icon: 'file-scene', path: '/Demo/helicopter-24.scene' },
  ];
  const desktop = fs.list('/Desktop');
  if (Array.isArray(desktop)) for (const e of desktop) if (!e.name.startsWith('.')) list.push({ name: e.name, icon: e.type === 'dir' ? 'folder' : 'file-' + (e.name.split('.').pop() || ''), path: e.path });
  const sig = JSON.stringify(list);
  if (sig !== desk.iconSig) { desk.iconSig = sig; desk.setIcons(list); }
}

function installDialogs(d) {
  d.hostExportDialog = async (name, text) => {
    const paths = await api.hostPaths();
    const def = paths.exportsDir + '\\' + name;
    const input = h('input', { class: 'rfield', tid: 'host-export-path', value: def, style: 'margin:0 20px;width:calc(100% - 40px)' });
    const r = await d.dialog('保存到本机', '保存到下面的本机路径：', [{ label: '浏览…', value: 'browse', tid: 'host-export-browse' }, { label: '保存', value: 'ok', primary: true, tid: 'host-export-ok' }, { label: '取消', value: 'cancel', cancel: true, tid: 'dialog-cancel' }], input);
    if (r === 'cancel' || r === null) return null;
    let p = input.value.trim();
    if (r === 'browse') { p = await api.pickSave(name); if (!p) return null; }
    return api.exportFile(p, text);
  };
  d.hostImportDialog = async () => {
    const list = await api.listExports();
    const paths = await api.hostPaths();
    const input = h('input', { class: 'rfield', tid: 'host-import-path', value: list.length ? list[list.length - 1].path : paths.exportsDir + '\\', style: 'margin:0 20px;width:calc(100% - 40px)' });
    const hint = list.length ? `数据目录里已有：${list.map((x) => x.name).slice(-4).join('、')}` : '输入本机文件路径';
    const r = await d.dialog('从本机导入', hint, [{ label: '浏览…', value: 'browse', tid: 'host-import-browse' }, { label: '导入', value: 'ok', primary: true, tid: 'host-import-ok' }, { label: '取消', value: 'cancel', cancel: true, tid: 'dialog-cancel' }], input);
    if (r === 'cancel' || r === null) return null;
    let p = input.value.trim();
    if (r === 'browse') { p = await api.pickOpen(); if (!p) return null; }
    return api.readHostFile(p);
  };
}

async function boot() {
  const files = await api.fsLoadAll();
  fs.loadAll(files);
  kernel = new RootKernel({ fs, device, hooks: makeHooks() });
  device.kernel = kernel;
  gfx = new GfxDevice(device);
  device.gfx = gfx;
  desk = new RootDesktop({ el: document.getElementById('desktop'), kernel, device, gfx });
  desk.consoles = new Map();
  desk.hub = new DataHub(kernel);
  installClipboard(desk);
  installBrowser(desk);
  installDialogs(desk);
  desk.registerApp('files', filesApp);
  desk.registerApp('editor', editorApp);
  desk.registerApp('console', consoleApp);
  desk.registerApp('tasks', tasksApp);
  desk.registerApp('settings', settingsApp);
  desk.registerApp('systems', systemsApp);
  desk.registerApp('help', helpApp);
  desk.registerApp('spreadsheet', sheetApp);
  desk.registerApp('widgets', widgetsApp);
  desk.registerApp('browser', browserApp);
  device.onDrop = (srcSys, paths, dstSys, dir) => onFileDrop(srcSys, paths, dstSys, dir);
  const saved = await api.settingsLoad();
  if (saved) Object.assign(desk.settings, saved);
  desk.applySettings();
  refreshIcons();
  startPump();
  readyResolve();
}

function onFileDrop(srcSys, paths, dstSys, dir) {
  const K = kernel;
  if (srcSys === dstSys) {
    // 同一系统内：移动到目标目录
    if (srcSys === 'outer') {
      for (const p of paths) {
        const name = p.split('/').pop();
        const t = (dir === '/' ? '' : dir) + '/' + name;
        if (t === p) continue;
        const r = fs.rename(p, t);
        if (r !== true) desk.notify('error', r.error); else desk.notify('info', `已移动 ${name} 到 ${dir}`);
      }
    }
    return;
  }
  const a = K.systems.get(srcSys), b = K.systems.get(dstSys);
  if (!a || !b) { desk.notify('error', '目标系统已不存在'); return; }
  K.transfer(a.path, paths, b.path, dir);
}

// —— 逻辑步驱动：不依赖动画帧回调，窗口被盖住时继续运行 ——
let nextAt = 0;
function startPump() {
  nextAt = performance.now();
  const ms = STEP_DT * 1000;
  const pump = () => {
    const now = performance.now();
    let n = 0;
    while (now >= nextAt && n < 3) {
      kernel.tick();
      nextAt += ms;
      n++;
    }
    if (now - nextAt > 250) nextAt = now; // 跟不上时放弃补课，逻辑时间只按实际执行的步推进
    setTimeout(pump, Math.max(1, Math.min(ms, nextAt - performance.now())));
  };
  pump();
}

// —— 自动化接口 ——
window.bench = {
  version: 1,
  ready: () => readyPromise,
  reset: async () => {
    await readyPromise;
    for (const w of [...desk.windows.values()]) { w.onClose = null; desk.destroyWindow(w); }
    desk.closePopups();
    kernel.resetAll();
    for (const id of [...device.instances.keys()]) device.dropInstance(id);
    const files = await api.fsReset();
    fs.loadAll(files);
    desk.notifications = []; desk.updateNotifBadge();
    desk.cascade = 0; desk.nextWin = 1; desk.fileManagers = new Set(); desk.browsers.clear(); desk.consoles.clear(); desk.projByKey.clear();
    desk.clipboard.length = 0; desk.timerState = null; desk.swState = null;
    desk.hub.docs.clear(); desk.hub.subs.clear(); if (desk.hub.watchers) desk.hub.watchers.clear();
    desk.settings = { name: '根系统', wallpaper: 'root', accent: '#f5c542', scale: 1, theme: 'dark', notes: [], timer: null };
    desk.dnd = false;
    desk.applySettings();
    refreshIcons();
    await new Promise((r) => setTimeout(r, 30));
    return true;
  },
  inspect: async () => {
    await readyPromise;
    const systems = [...kernel.systems.values()].map((s) => ({ id: s.id, parentId: s.parentId, name: s.name, state: s.state, path: s.path, error: s.err || null }));
    const windows = []; const browsers = []; const players = []; const charts = []; const projections = [];
    for (const w of desk.windows.values()) {
      windows.push({ id: w.id, systemId: 'outer', appId: w.app, title: w.title, state: w.state === 'min' ? 'minimized' : w.state === 'max' ? 'maximized' : 'normal', focused: desk.focused === w, childSystem: w.child || null });
      if (w.proj) projections.push({ windowId: w.id, systemId: 'outer', sourceSystemId: w.proj.src_sys, sourceWindowId: w.proj.src_win, sourceAppId: w.proj.src_app, state: w.state === 'min' ? 'minimized' : 'normal' });
    }
    for (const b of desk.browserViews()) browsers.push({ windowId: b.windowId, tabId: b.tabId, url: b.url, loadState: b.loadState, title: b.title });
    for (const w of desk.browsers) for (const t of w.tabs) if (!t.view) browsers.push({ windowId: w.id, tabId: t.id, url: t.url, loadState: t.loadState, title: t.title });
    for (const [id, I] of device.instances) {
      if (!kernel.systems.has(id)) continue;
      for (const row of I.meta.windows || []) {
        windows.push({ id: row.id, systemId: id, appId: row.appId, title: row.title, state: row.state, focused: row.focused, childSystem: row.childSystem || null });
        if (row.appId === 'projection') projections.push({ windowId: row.id, systemId: id, sourceSystemId: row.sourceSystemId, sourceWindowId: row.sourceWindowId, sourceAppId: row.sourceAppId, state: row.state });
      }
      for (const k of Object.keys(I.meta)) {
        if (k.startsWith('player:')) players.push(I.meta[k]);
        else if (k.startsWith('chart:')) charts.push(I.meta[k]);
      }
    }
    return JSON.parse(JSON.stringify({ systems, windows, browsers, players, charts, projections }));
  },
};
window.__nest = { get kernel() { return kernel; }, get desk() { return desk; }, get device() { return device; }, get gfx() { return gfx; } };

boot().catch((e) => { console.error(e); document.body.textContent = '启动失败：' + e.message; });
