/* ============================================================================
 * window.bench —— 录制/评测方通过 CDP 在主桌面渲染上下文使用的稳定接口。
 *   version / ready() / reset() / inspect()
 * 见 automation.json 与题面附录。
 * ========================================================================== */
(function (OS) {
  'use strict';
  const rt = OS.rt, ui = OS.ui;

  function waitFrames(n) {
    return new Promise((resolve) => {
      let left = n;
      const step = () => { if (left-- <= 0) resolve(true); else setTimeout(step, 34); };
      step();
    });
  }

  const bench = {
    version: 1,

    ready() {
      // 桌面已呈现并可操作
      if (rt.state && ui.desktops['outer']) return waitFrames(2).then(() => true);
      return waitFrames(3).then(() => true);
    },

    reset() {
      // 在当前测试数据目录内恢复初态：关闭全部应用与子系统实例、恢复预置文件/默认设置/根桌面、重置实例编号
      rt.reset();
      ui.clearAll();
      return waitFrames(3).then(() => true);
    },

    inspect() {
      const systems = [], windows = [], browsers = [], players = [], charts = [], projections = [];
      for (const sid in rt.state.systems) {
        const s = rt.state.systems[sid];
        systems.push({ id: s.id, parentId: s.parentId, name: s.id, state: s.state });
        for (const w of s.windows) {
          windows.push({ id: w.id, systemId: s.id, appId: w.appId, title: w.title, state: w.state });
          if (w.appId === 'browser' && w.extra && w.extra.tabs) {
            w.extra.tabs.forEach((t) => browsers.push({ windowId: w.id, tabId: t.id, url: t.url, loadState: t.loadState || 'idle' }));
          }
          if (w.appId === 'player') {
            const d = s.display[w.id] || {}, c = d.clock || {}, sc = d.scene || {};
            players.push({ windowId: w.id, systemId: s.id,
              state: c.playing ? 'playing' : 'paused', position: +(c.pos || 0), duration: +(c.duration || (w.extra.sceneRes && w.extra.sceneRes.duration) || 15),
              rate: +(c.rate || 1), scene: w.extra.path || '/Demo/helicopter-24.scene', frameTime: sc.t != null ? +sc.t : 0 });
          }
          if (w.appId === 'charts') {
            const conn = w.extra.connId ? rt.getConnections()[w.extra.connId] : null;
            charts.push({ windowId: w.id, systemId: s.id, sourceTitle: conn ? conn.sourceTitle : (w.extra.source || ''),
              range: w.extra.range || '', chartType: w.extra.chartType || 'bar', connectionState: conn ? conn.state : '未连接' });
          }
          if (w.appId === 'projection') {
            projections.push({ windowId: w.id, systemId: s.id, sourceSystemId: w.sourceSystemId,
              sourceWindowId: w.sourceWindowId, sourceAppId: w.sourceAppId, state: w.state });
          }
        }
      }
      return { systems, windows, browsers, players, charts, projections };
    },
  };

  window.bench = bench;
})(window.OS = window.OS || {});
