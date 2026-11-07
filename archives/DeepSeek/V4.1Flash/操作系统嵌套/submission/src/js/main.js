/* Nested OS 渲染层入口：装载状态、启动内核与调度器、暴露 window.bench */
import { rt, on, changed, saveNow, scheduleSave } from './store.js';
import {
  makeModel, createRootSystem, deserializeModel, serializeModel, syncSequences,
  runtimeState, listSnapshots, fsRead, notify, findProcess, makePlayerState
} from './model.js';
import { UI } from './ui/shell.js';
import { Ticker, bootSystem } from './scheduler.js';
import { openWorkbookDoc } from './ui/apps/spreadsheet.js';
import { toast } from './ui/common.js';
import { appIcon } from './icons.js';

const benchListeners = [];
let readyFlag = false;
let bootError = null;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function makeWebHost() {
  return {
    isElectron: false,
    info: async () => ({ dataDir: '(浏览器预览模式)', width: window.innerWidth, height: window.innerHeight, isElectron: false }),
    loadState: async () => {
      try { const t = localStorage.getItem('nested-os-state'); return t ? JSON.parse(t) : null; } catch (e) { return null; }
    },
    saveState: async (json) => {
      try { localStorage.setItem('nested-os-state', json); return { ok: true }; } catch (e) { return { ok: false, error: String(e) }; }
    },
    resetState: async () => { try { localStorage.removeItem('nested-os-state'); } catch (e) {} return { ok: true }; },
    saveTextToLocal: async ({ defaultName, content }) => {
      const blob = new Blob([content], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = defaultName || 'nested-os.txt'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      return { ok: true, path: defaultName };
    },
    openTextFromLocal: async () => ({ ok: false, canceled: true }),
    onBrowserPopup: () => {}
  };
}

function hideSplash() {
  const el = document.getElementById('boot-splash');
  if (!el) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 700);
}

function showBootError(msg) {
  bootError = msg;
  const el = document.getElementById('boot-splash');
  if (el) {
    el.querySelector('.boot-sub').textContent = '启动失败：' + msg;
    el.querySelector('.boot-bar').style.display = 'none';
  }
  console.error(msg);
}

async function loadOrCreateModel() {
  let loaded = null;
  try { loaded = await rt.host.loadState(); } catch (e) { console.warn('读取状态失败', e); }
  if (loaded) {
    try {
      const model = deserializeModel(loaded);
      if (model.systems[model.rootId]) return { model, restored: true };
    } catch (e) { console.warn('状态反序列化失败，使用初始状态', e); }
  }
  const model = makeModel();
  model.systems[model.rootId] = createRootSystem();
  return { model, restored: false };
}

function bootKernels(model) {
  const order = Object.values(model.systems).sort((a, b) => a.depth - b.depth);
  for (const sys of order) {
    if (sys.isRoot) continue;
    try { bootSystem(model, sys); } catch (e) { sys.state = 'error'; sys.stateNote = '启动内核失败：' + e.message; }
  }
}

function seedFirstRun(model) {
  const root = model.systems[model.rootId];
  if (!root) return;
  if (!root.notifications.length) {
    root.notifications.unshift({ id: 'welcome-1', title: '欢迎使用 Nested OS', body: '双击桌面图标打开应用；系统管理可创建可嵌套的子系统。操作说明包含内核、程序、投送与快照的完整规则。', clock: 0, read: false, at: Date.now(), kind: 'info' });
  }
}

function makeBench(ticker) {
  const bench = {
    version: 1,
    async ready() {
      for (let i = 0; i < 200; i++) {
        if (readyFlag) return true;
        if (bootError) throw new Error(bootError);
        await sleep(50);
      }
      return readyFlag;
    },
    async reset() {
      try { await rt.host.resetState(); } catch (e) {}
      const model = makeModel();
      model.systems[model.rootId] = createRootSystem();
      model.systems[model.rootId].notifications = [];
      seedFirstRun(model);
      rt.model = model;
      rt.ui.model = model;
      if (ticker) ticker.model = model;
      rt.ready = true;
      readyFlag = true;
      ticker.acc = 0; ticker.last = performance.now();
      rt.ui.mount(model);
      try { await saveNow(true); } catch (e) {}
      changed('reset');
      return true;
    },
    async inspect() {
      const model = rt.model;
      const out = { systems: [], windows: [], browsers: [], players: [], charts: [], projections: [] };
      if (!model) return out;
      const sysList = Object.values(model.systems).sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
      for (const sys of sysList) {
        out.systems.push({ id: sys.id, parentId: sys.parentId, name: sys.name, state: runtimeState(model, sys) });
        for (const w of sys.windows) {
          out.windows.push({
            id: w.id, systemId: sys.id, appId: w.appId, title: w.title,
            state: w.minimized ? 'minimized' : w.maximized ? 'maximized' : w.snap ? 'snapped-' + w.snap : 'normal'
          });
          if (w.appId === 'projection') {
            out.projections.push({
              windowId: w.id, systemId: sys.id,
              sourceSystemId: w.payload.sourceSystemId, sourceWindowId: w.payload.sourceWindowId,
              sourceAppId: w.payload.sourceAppId,
              state: w.minimized ? 'minimized' : 'visible'
            });
          }
        }
        const b = sys.apps.browser;
        if (b && b.tabs && b.tabs.length && sys.isRoot) {
          const bw = sys.windows.find(w => w.appId === 'browser');
          if (bw) {
            for (const tab of b.tabs) {
              out.browsers.push({
                windowId: bw.id, tabId: tab.id, url: tab.url || '',
                loadState: tab.error ? 'error' : tab.loading ? 'loading' : tab.url ? 'complete' : 'newtab'
              });
            }
          }
        }
        for (const w of sys.windows) {
          if (w.appId === 'player') {
            const p = sys.apps.players[w.id];
            if (!p) continue;
            out.players.push({
              windowId: w.id, systemId: sys.id,
              state: p.sceneError ? 'error' : (M_paused(model, sys) ? 'frozen' : (p.playing ? 'playing' : 'paused')),
              position: +(p.frameTime || p.position || 0).toFixed(3),
              duration: +(p.duration || 15).toFixed(3),
              rate: p.rate || 1,
              scene: p.scenePath,
              frameTime: +((p.frame && p.frame.t != null) ? p.frame.t : (p.position || 0)).toFixed(3),
              mode: p.mode,
              playing: !!p.playing,
              loop: !!p.loop
            });
          }
          if (w.appId === 'charts') {
            const c = sys.apps.charts[w.id];
            if (!c) continue;
            out.charts.push({
              windowId: w.id, systemId: sys.id, sourceTitle: c.sourceTitle || '',
              range: c.range, chartType: c.chartType || 'bar',
              connectionState: c.connection, version: c.displayVersion || 0
            });
          }
        }
      }
      return out;
    }
  };
  return bench;
}

function M_paused(model, sys) {
  let s = sys;
  while (s) { if (s.paused) return true; s = s.parentId ? model.systems[s.parentId] : null; }
  return false;
}

async function boot() {
  try {
    rt.host = window.nestedHost || makeWebHost();
    try { rt.info = await rt.host.info(); } catch (e) { rt.info = {}; }
    rt.serialize = serializeModel;
    rt.openWorkbookDoc = openWorkbookDoc;
    const { model, restored } = await loadOrCreateModel();
    rt.model = model;
    syncSequences(model);
    if (!restored) seedFirstRun(model);
    bootKernels(model);
    window.__nested = { rt, model, bootModels: () => model };
    // UI
    const rootEl = document.getElementById('root-os');
    const ui = new UI(rootEl);
    rt.ui = ui;
    rt.ready = true;
    ui.mount(model);
    on('model', (d) => { if (rt.ui) rt.ui.refresh(d.reason); });
    on('boot-toast', (d) => toast(d.title, d.msg, d.kind, d.sys));
    if (window.nestedHost && window.nestedHost.onBrowserPopup) {
      // 由浏览器应用自行订阅
    }
    const ticker = new Ticker();
    ticker.start(model);
    window.__nested.ticker = ticker;
    benchReady(ui, ticker);
    setTimeout(hideSplash, 420);
  } catch (e) {
    console.error(e);
    showBootError(e.message || String(e));
  }
}

let benchObj = null;
function benchReady(ui, ticker) {
  benchObj = makeBench(ticker);
  window.bench = benchObj;
  readyFlag = true;
  for (const resolve of benchListeners.splice(0)) resolve(true);
  try { window.dispatchEvent(new CustomEvent('nested-os-ready')); } catch (e) {}
}

// 在启动早期就暴露接口，便于自动化等待
const earlyBench = {
  version: 1,
  ready() { return new Promise((resolve) => { if (readyFlag) resolve(true); else benchListeners.push(resolve); }); },
  async reset() { if (benchObj) return benchObj.reset(); return false; },
  async inspect() { if (benchObj) return benchObj.inspect(); return { systems: [], windows: [], browsers: [], players: [], charts: [], projections: [] }; }
};
window.bench = earlyBench;

window.addEventListener('beforeunload', () => { try { if (rt.model && rt.serialize) rt.host.saveState(rt.serialize(rt.model)); } catch (e) {} });
setInterval(() => { if (rt.dirty) saveNow(); }, 6000);

window.addEventListener('error', (e) => { console.error('页面错误', e.error || e.message); });
window.addEventListener('unhandledrejection', (e) => { console.error('未处理的 Promise', e.reason); });

boot();

export { M_paused };
