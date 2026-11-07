/* PRISM project panel */
(function () {
  const AE = window.AE, U = AE.U, P = AE.P;
  const PP = (AE.ProjectPanel = {});
  PP.init = function () { this.render(); };
  PP.render = function () {
    const app = AE.App;
    const list = document.getElementById('compList');
    const ngList = document.getElementById('nodeGroupList');
    const assetList = document.getElementById('assetList');
    if (!app || !app.project) { if (list) list.innerHTML = '<div style="padding:14px;color:#4d5c70;font-size:10px">尚未打开工程</div>'; return; }
    const q = (document.getElementById('projectSearch')?.value || '').trim().toLowerCase();
    const comps = app.project.comps.filter(c => !q || c.name.toLowerCase().includes(q) || c.layers.some(l => l.name.toLowerCase().includes(q)));
    const activeId = app.comp ? app.comp.id : null;
    if (list) {
      list.innerHTML = '';
      if (!comps.length) list.innerHTML = `<div class="proj-empty" style="padding:16px 10px;font-size:10px;color:#516075;text-align:center;line-height:1.7">${app.project.comps.length ? '没有匹配的合成' : '还没有合成<br>点击 + 新建一个'}</div>`;
      const sorted = comps.slice().sort((a, b) => (a.isDemo === b.isDemo ? 0 : a.isDemo ? -1 : 1));
      for (const c of sorted) {
        const row = U.el('div', 'comp-item' + (c.id === activeId ? ' active' : ''));
        row.dataset.id = c.id;
        row.innerHTML = `<div class="comp-thumb"><i>${c.width}×${c.height}</i></div>
          <div class="comp-meta"><div class="comp-name">${escapeHtml(c.name)}</div><div class="comp-sub">${c.fps} FPS · ${c.duration.toFixed(1)}s · ${c.layers.length} 层</div></div>
          <div class="comp-kind">${c.isDemo ? '示例' : c.name.includes('预合成') ? '嵌套' : '合成'}</div>`;
        row.onclick = () => app.openComp(c.id);
        row.ondblclick = () => { app.openComp(c.id); if (AE.Timeline) AE.Timeline.render(); };
        row.oncontextmenu = (e) => { e.preventDefault(); app.showMenu(e.clientX, e.clientY, [
          { label: '打开合成', action: () => app.openComp(c.id) },
          { label: '合成设置…', action: () => { app.openComp(c.id); app.compSettingsDialog(); } },
          '-',
          { label: '复制合成', action: () => app.duplicateComp ? app.duplicateComp(c) : null },
          { label: '删除合成', action: () => app.deleteComp ? app.deleteComp(c) : null }
        ]); };
        list.appendChild(row);
      }
      const totalLayers = app.project.comps.reduce((a, c) => a + c.layers.length, 0);
      const st = document.getElementById('projStats'); if (st) st.textContent = `${app.project.comps.length} 合成 · ${totalLayers} 层`;
    }
    if (ngList) {
      ngList.innerHTML = '';
      const graphs = app.project.nodeGraphs || [];
      if (!graphs.length) ngList.innerHTML = '<div style="padding:8px;color:#4a596c;font-size:9px">尚无节点组</div>';
      for (const g of graphs) {
        const row = U.el('div', 'ng-row');
        row.dataset.id = g.id;
        row.innerHTML = `<svg><use href="#i-nodes"/></svg><span style="flex:1">${escapeHtml(g.name)}</span><span style="font-family:var(--mono);font-size:8px;color:#4f5c70">${(g.nodes || []).length}N</span>`;
        row.onclick = () => { app.setWorkspace('nodes'); if (AE.NodesUI) AE.NodesUI.setGraph(g.id); };
        ngList.appendChild(row);
      }
      const st = document.getElementById('nodeGroupStats'); if (st) st.textContent = `${graphs.length} 个`;
    }
    if (assetList) {
      assetList.innerHTML = '';
      const assets = app.project.assets || [];
      if (!assets.length) {
        assetList.innerHTML = '<div style="padding:7px 6px;color:#4a596c;font-size:9px">导入音频或新建音色图层</div>';
      }
      for (const a of assets) {
        const row = U.el('div', 'asset-row');
        row.innerHTML = `<svg><use href="#i-audio"/></svg><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(a.name)}</span><span class="asset-meta">${(a.duration || 0).toFixed(1)}s</span>`;
        row.onclick = () => {
          const l = P.createLayer(app.project, app.comp, 'audio', { name: a.name, assetId: a.id });
          app.edit('添加音频图层', () => { l.outPoint = Math.min(app.comp.duration, (a.duration || app.comp.duration)); app.comp.layers.push(l); });
          AE.Audio.engine.ensureBuffer(app.project, a);
        };
        assetList.appendChild(row);
      }
      const toneCount = app.project.comps.reduce((n, c) => n + c.layers.filter(l => l.type === 'tone').length, 0);
      if (toneCount) assetList.insertAdjacentHTML('beforeend', `<div class="asset-row" style="color:#5f756f"><svg><use href="#i-audio"/></svg><span>内置音色图层</span><span class="asset-meta">${toneCount}</span></div>`);
    }
    if (document.getElementById('layerCount') && app.comp) document.getElementById('layerCount').textContent = app.comp.layers.length + ' 图层';
  };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  AE.ProjectPanel = PP;
})();
