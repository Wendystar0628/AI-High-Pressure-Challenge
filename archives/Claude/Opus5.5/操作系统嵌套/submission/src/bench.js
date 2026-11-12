// window.bench：自动化与录制使用的准备与状态接口
import { DEFAULT_SETTINGS } from './ui/desktop.js';
import { sysOfSid } from './device/display.js';

export function installBench({ root, desktop, fs, device, rootImg, bridge, syncImage }) {
  const winState = (w) => w.state === 'min' ? 'minimized' : w.state === 'max' ? 'maximized' : w.snap ? 'snapped-' + w.snap : 'normal';
  const bench = {
    version: 1,
    async ready() {
      for (let i = 0; i < 400; i++) {
        if (document.body.dataset.ready === '1' && desktop.desk && desktop.desk.isConnected) return true;
        await new Promise((r) => setTimeout(r, 50));
      }
      return false;
    },
    async reset() {
      for (const w of [...desktop.wins.values()]) desktop.destroyWin(w, false);
      root.reset();
      fs.loadImage(rootImg.files);
      syncImage(fs, rootImg);
      for (const d of ['/Documents', '/Downloads', '/Recycle', '/Desktop', '/Snapshots', '/System/Kernels', '/System/Disks']) fs.mkdir(d);
      fs.write('/System/state.json', JSON.stringify({ nextInner: 1, conf: root.conf }));
      desktop.settings = { ...DEFAULT_SETTINGS };
      desktop.saveSettings();
      desktop.notifications = []; desktop.clipboard = []; desktop.fileClipboard = null; desktop.sheetClipboard = null;
      desktop.closeFlyouts(); desktop.endDrag();
      desktop.applySettings(); desktop.layout(); desktop.renderIcons(); desktop.renderTaskbar();
      device.surfaces.forEach((s, sid) => { if (sysOfSid(sid) !== 'outer') device.drop(sid); });
      await fs.flush();
      await new Promise((r) => setTimeout(r, 50));
      return true;
    },
    async inspect() {
      const systems = root.tree.map((s) => ({ id: s.id, parentId: s.parentId, name: s.name, state: s.state }));
      const windows = [];
      for (const id of desktop.order) {
        const w = desktop.wins.get(id);
        if (!w) continue;
        windows.push({ id: w.id, systemId: 'outer', appId: w.appId, title: w.title, state: winState(w), focused: desktop.focused === w.id, ...(w.kind === 'system' ? { targetSystemId: w.child } : {}) });
      }
      const players = [], charts = [], projections = [];
      for (const w of desktop.wins.values()) if (w.kind === 'proj') projections.push({ windowId: w.id, systemId: 'outer', sourceSystemId: w.srcSys, sourceWindowId: w.srcWin, sourceAppId: w.srcApp, state: root.chainPaused(w.srcSys) ? 'source-paused' : winState(w) });
      for (const [sid, s] of device.surfaces) {
        const m = s.meta;
        if (!m) continue;
        const sys = sysOfSid(sid);
        if (sid.endsWith(':desktop') && Array.isArray(m.windows)) {
          for (const w of m.windows) {
            windows.push({ id: w.id, systemId: sys, appId: w.app, title: w.title, state: w.state, focused: !!w.focused, ...(w.child ? { targetSystemId: w.child } : {}) });
            if (w.kind === 'proj') projections.push({ windowId: w.id, systemId: sys, sourceSystemId: w['src-sys'] || null, sourceWindowId: w['src-win'] || null, sourceAppId: w['src-app'] || null, state: w.state });
          }
        }
        if (sid.includes('@')) continue;
        if (m.kind === 'player') players.push({ windowId: sid, systemId: sys, state: m.state, position: m.position, duration: m.duration, rate: m.rate, scene: m.scene, frameTime: m.frameTime, mode: m.mode, camera: m.camera });
        if (m.kind === 'charts') charts.push({ windowId: sid, systemId: sys, sourceTitle: m.sourceTitle, range: m.range, chartType: m.chartType, connectionState: m.connectionState, version: m.version, labelColumn: m.labelColumn, series: m.series });
      }
      const browsers = [...desktop.browserTabs.values()].map((t) => ({ windowId: t.windowId, tabId: t.tabId, url: t.url, loadState: t.loadState, title: t.title }));
      return { systems, windows, browsers, players, charts, projections, focus: desktop.focused, scale: desktop.settings.scale };
    },
  };
  window.bench = bench;
  return bench;
}
