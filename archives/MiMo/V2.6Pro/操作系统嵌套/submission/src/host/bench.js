// window.bench 自动化接口 (automation.json 约定)
export function initBench(ctx) {
  const bench = {
    version: 1,
    ready: async () => {
      // 桌面已呈现并可操作
      return true;
    },
    reset: async () => {
      // 关闭应用与全部子系统实例,恢复预置文件与默认设置
      const { wm, systemManager, shell, settings } = ctx;
      for (const w of wm.list()) {
        try { wm.close(w.id); } catch (e) { /* ignore */ }
      }
      if (systemManager) {
        for (const inst of [...systemManager.instances.values()]) {
          if (!inst.isRoot) {
            try { systemManager.closeSystem(inst); } catch (e) { /* ignore */ }
          }
        }
        systemManager.nextInner = 1;
      }
      // 恢复预置文件
      const { seedFileSystem } = await import('../core/fs.js');
      const { getSceneJson } = await import('../scenes/scene-data.js');
      const { KERNEL_SOURCES } = await import('../kernel/kernel-source.js');
      ctx.fs.files.clear();
      seedFileSystem(ctx.fs, getSceneJson(), KERNEL_SOURCES);
      Object.assign(settings, {
        wallpaper: 'dusk-lake', accent: 'violet', scale: 1,
        theme: 'dark', name: 'Nested OS', dnd: false,
      });
      const { applySettings } = await import('../apps/settings.js');
      applySettings(settings);
      await ctx.saveSettings();
      ctx.shell.notify('已重置', '测试数据目录已恢复初态', 'ok');
      return true;
    },
    inspect: async () => {
      const systems = [];
      const windows = [];
      const browsers = [];
      const players = [];
      const charts = [];
      const projections = [];
      const sm = ctx.systemManager;
      if (sm) {
        for (const s of sm.getSystems()) {
          systems.push({
            id: s.id, parentId: s.parentId, name: s.name, state: s.state,
            rate: s.rate, vtime: s.vtime,
          });
        }
      }
      for (const w of ctx.wm.list()) {
        windows.push({
          id: w.id,
          systemId: w.systemId || 'outer',
          appId: w.appId,
          title: w.title,
          state: w.minimized ? 'minimized' : (w.maximized ? 'maximized' : 'normal'),
        });
        if (w.appId === 'browser' && w.tabs) {
          for (const t of w.tabs) {
            browsers.push({
              windowId: w.id, tabId: t.id, url: t.url || '',
              loadState: t.loadState || 'idle',
            });
          }
        }
        if (w.appId === 'player' || (w.meta && w.meta.player)) {
          const p = (w.meta && w.meta.player) || {};
          players.push({
            windowId: w.id,
            systemId: w.systemId || 'outer',
            state: p.state || 'stopped',
            position: (p.position || 0) / 1000,
            duration: (p.duration || 15000) / 1000,
            rate: p.rate || 1,
            scene: p.scenePath || '/Demo/helicopter-24.scene',
            frameTime: (p.frameTime || 0) / 1000,
          });
        }
        if (w.appId === 'charts' || (w.meta && w.meta.chart)) {
          const c = (w.meta && w.meta.chart) || {};
          charts.push({
            windowId: w.id,
            systemId: w.systemId || 'outer',
            sourceTitle: c.sourceTitle || '',
            range: c.range || '',
            chartType: c.chartType || 'bar',
            connectionState: c.connectionState || 'disconnected',
          });
        }
        if (w.appId === 'projection') {
          projections.push({
            windowId: w.id,
            systemId: w.systemId || 'outer',
            sourceSystemId: w.meta ? w.meta.sourceSystemId : '',
            sourceWindowId: w.meta ? w.meta.sourceWindowId : '',
            sourceAppId: w.meta ? w.meta.sourceAppId : '',
            state: w.minimized ? 'minimized' : 'normal',
          });
        }
      }
      return { systems, windows, browsers, players, charts, projections };
    },
  };
  window.bench = bench;
  window.__benchReady = true;
  return bench;
}
