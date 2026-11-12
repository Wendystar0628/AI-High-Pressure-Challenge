import { NestedOS } from './core/os.js';
import { Shell } from './ui/shell.js';

const state = { os: null, shell: null, ready: false };
let readyResolve;
const readyPromise = new Promise((res) => { readyResolve = res; });
// 在启动完成前也提供稳定接口，便于自动化尽早等待 ready()。
window.bench = {
  version: 1,
  ready: () => readyPromise,
  reset: async () => ({ ok: false, error: '应用正在启动' }),
  inspect: () => ({ version: 1, systems: [], windows: [], browsers: [], players: [], charts: [], projections: [] }),
};

function fatal(err) {
  console.error('[NESTED OS boot]', err);
  const box = document.getElementById('boot-fatal');
  if (!box) return;
  box.hidden = false;
  box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#070a12;color:#eceaf6;font:13px "Segoe UI","Microsoft YaHei UI",sans-serif;padding:38px;display:flex;flex-direction:column;gap:10px';
  box.innerHTML = `<div style="color:#fbbf24;font:600 20px 'Segoe UI'">NESTED OS 启动失败</div>
    <div style="color:#a19db8">${String(err?.message || err).replace(/[<>&]/g, '')}</div>
    <pre style="white-space:pre-wrap;color:#7a7590;font:11px Consolas;max-width:900px">${String(err?.stack || '').replace(/[<>&]/g, '')}</pre>`;
}

async function boot() {
  if (!window.nestHost) throw new Error('preload 未加载：请使用 Electron 启动。');
  const hostInfo = await window.nestHost.info();
  const saved = await window.nestHost.loadState();
  const os = new NestedOS();
  await os.init(hostInfo, saved);
  os.attachPersistence((data) => window.nestHost.saveState(data));
  const shell = new Shell(os);
  os.attachUI(shell);
  await shell.mount();
  await os.start();
  state.os = os;
  state.shell = shell;
  window.__nest = state;
  window.__os = os;
  window.__shell = shell;

  document.title = 'NESTED OS';
  window.nestHost.setTitle('NESTED OS').catch(() => {});

  window.bench = {
    version: 1,
    ready: () => readyPromise,
    reset: async () => {
      try {
        await window.nestHost.resetState();
        shell.destroyDesktopDom('outer', { silent: true });
        shell.desktops.clear();
        shell.views.clear();
        await os.resetAll();
        document.documentElement.classList.remove('night-mode');
        document.getElementById('boot-fatal').hidden = true;
        shell.buildRoot();
        shell.renderIconsFor('outer');
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return { ok: true, systems: shell.inspect().systems, windows: shell.inspect().windows };
      } catch (err) {
        fatal(err);
        return { ok: false, error: String(err?.message || err) };
      }
    },
    inspect: () => shell.inspect(),
    openApp: (systemId, appId, opts) => shell.openAppById(systemId, appId, opts),
    openFile: (systemId, path) => shell.openPath(systemId, path),
    createSystem: (parentId) => { const s = os.createChildSystem(parentId || 'outer'); return s ? s.id : null; },
    get os() { return os; },
    get shell() { return shell; },
  };

  // visibility/occlusion diagnostics for evaluation environment
  document.addEventListener('visibilitychange', () => {
    try { os.emit('visibility', { hidden: document.hidden }); } catch { /* ignore */ }
  });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  state.ready = true;
  readyResolve(true);
  os.emit('ui-ready', { systems: shell.inspect().systems });
}

boot().catch((err) => {
  readyResolve(false);
  fatal(err);
});
