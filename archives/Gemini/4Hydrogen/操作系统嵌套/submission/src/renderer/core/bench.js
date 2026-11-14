// Automation & Benchmark Bridge (`window.bench`, version 1)
// Exposes: version, ready(), reset(), inspect()

export function installBenchApi({ hostKernel, displayDevice, getDesktopCtrl, saveNow }) {
  let isReady = false;

  const markReady = () => { isReady = true; };

  const bench = {
    version: 1,

    async ready() {
      const start = Date.now();
      while (!isReady || !document.querySelector('[data-testid="os-desktop"][data-system-id="outer"]')) {
        if (Date.now() - start > 10000) break;
        await new Promise((r) => setTimeout(r, 30));
      }
      return true;
    },

    async reset() {
      const desk = getDesktopCtrl();
      desk?.resetUI?.();
      hostKernel.resetInMemory();
      if (window.hostBridge?.clearState) {
        await window.hostBridge.clearState();
      }
      desk?.resetUI?.();
      displayDevice.renderAll();
      await saveNow?.();
      return true;
    },

    async inspect() {
      const systems = [
        { id: 'outer', parentId: null, name: hostKernel.settings.systemName || '叠境操作系统', state: 'running' }
      ];
      const windows = [];
      const players = [];
      const charts = [];

      for (const rw of hostKernel.rootWindows.values()) {
        windows.push({
          id: rw.id,
          systemId: 'outer',
          appId: rw.appId,
          title: rw.title,
          state: rw.minimized ? 'minimized' : (rw.maximized ? 'maximized' : 'normal')
        });
      }

      for (const slot of hostKernel.subsystems.values()) {
        const effState = (slot.state === 'kernel_error' || slot.state === 'stopped')
          ? slot.state
          : (hostKernel.isSystemOrAncestorPaused(slot.id) ? 'paused' : 'running');
        systems.push({
          id: slot.id,
          parentId: slot.parentId,
          name: slot.name,
          state: effState
        });
        const wins = slot.lastDesktop?.windows || [];
        for (const w of wins) {
          windows.push({
            id: w.id,
            systemId: slot.id,
            appId: w.appId,
            title: w.title,
            state: w.minimized ? 'minimized' : (w.maximized ? 'maximized' : 'normal')
          });
          const ui = slot.appUIs?.[w.id] || w.ui;
          if (w.appId === 'player' && ui) {
            const fr = slot.scene3dFrames?.[w.id];
            players.push({
              windowId: w.id,
              systemId: slot.id,
              state: ui.playState || 'paused',
              position: Number((ui.playTime ?? 0).toFixed(3)),
              duration: ui.duration ?? 15,
              rate: ui.rate ?? 1,
              scene: ui.scenePath || '',
              frameTime: Number((fr?.frameTime ?? ui.frameTime ?? 0).toFixed(3))
            });
          } else if (w.appId === 'charts' && ui) {
            charts.push({
              windowId: w.id,
              systemId: slot.id,
              sourceTitle: ui.sourceTitle || '',
              range: ui.rangeStr || 'A1:D4',
              chartType: ui.chartType || 'bar',
              connectionState: ui.connectionState || 'disconnected'
            });
          }
        }
      }

      const browsers = (hostKernel.rootBrowsers || []).map((b) => ({
        windowId: b.windowId,
        tabId: b.tabId,
        url: b.url,
        loadState: b.loadState
      }));

      const projections = [];
      for (const p of hostKernel.projections.values()) {
        const paused = hostKernel.isSystemOrAncestorPaused(p.sourceSystemId) || hostKernel.isSystemOrAncestorPaused(p.targetSysId);
        projections.push({
          windowId: p.projWinId,
          systemId: p.targetSysId,
          sourceSystemId: p.sourceSystemId,
          sourceWindowId: p.sourceWindowId,
          sourceAppId: p.sourceAppId,
          state: paused ? 'suspended' : (p.state || 'active')
        });
      }

      return { systems, windows, browsers, players, charts, projections };
    }
  };

  window.bench = bench;
  return { markReady };
}
