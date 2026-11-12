/* bench.js — window.bench automation API */
export function installBench(root) {
  const bench = {
    version: 1,
    ready: () => {
      return new Promise((resolve) => {
        const check = () => {
          if (root.desktop && root.desktop.clientWidth > 0) resolve(true);
          else setTimeout(check, 100);
        };
        check();
      });
    },
    reset: async () => {
      // close all windows & subsystems, restore initial files
      for (const [id, sub] of [...root.subsystems]) {
        try { sub.shutdown(); } catch (e) { }
        root.subsystems.delete(id);
      }
      for (const w of [...root.windows.values()]) {
        try { w.onClose = null; w.destroy(); } catch (e) { }
      }
      root.windows.clear();
      root.nextInnerId = 1;
      root.virtualTime = 0;
      root.notifications = [];
      root.clipboardHistory = [];
      root.vfs.seed();
      // re-seed fixtures
      try {
        root._seedFixtures();
      } catch (e) { }
      root._refreshIcons();
      root._refreshTaskbar();
      root.applySettings();
      return true;
    },
    inspect: () => {
      const systems = [{
        id: root.id,
        parentId: null,
        name: root.settings.name || '根系统',
        state: root.state
      }];
      for (const [id, sub] of root.subsystems) {
        systems.push({
          id: sub.id,
          parentId: sub.parentId,
          name: sub.name,
          state: sub.state
        });
        if (sub.children) {
          for (const [cid, c] of sub.children) {
            systems.push({ id: c.id, parentId: c.parentId, name: c.name, state: c.state });
          }
        }
      }
      const windows = [];
      for (const w of root.windows.values()) {
        windows.push({
          id: w.id,
          systemId: w.systemId,
          appId: w.appId,
          title: w.title,
          state: w.state
        });
      }
      const browsers = root.apps.browser && root.apps.browser.getTabInfo ? root.apps.browser.getTabInfo() : [];
      const players = [];
      const charts = [];
      const projections = [];
      for (const [id, sub] of root.subsystems) {
        if (sub.playerInfo) {
          players.push(sub.playerInfo);
        }
        if (sub.chartInfo) {
          charts.push(sub.chartInfo);
        }
        for (const p of (sub.projections || [])) {
          projections.push(p);
        }
      }
      // root-level projections
      for (const w of root.windows.values()) {
        if (w.isProjection && w.projInfo) {
          projections.push({
            windowId: w.id,
            systemId: root.id,
            sourceSystemId: w.projInfo.sourceSystemId,
            sourceWindowId: w.projInfo.sourceWindowId,
            sourceAppId: w.projInfo.sourceAppId,
            state: w.state
          });
        }
      }
      return { systems, windows, browsers, players, charts, projections };
    }
  };
  window.bench = bench;
}
