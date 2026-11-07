/* PRISM node editor UI */
(function () {
  const AE = window.AE, U = AE.U, P = AE.P, E = AE.Eval, N = AE.Nodes;
  const NUI = (AE.NodesUI = {});
  const $ = U.$, $$ = U.$$;
  NUI.zoom = 1; NUI.panX = 60; NUI.panY = 40;
  NUI.selected = new Set();
  NUI.graph = null; NUI.graphId = null;
  NUI.drag = null; NUI.linkDrag = null;
  NUI.initialized = false;
  NUI.stack = [];

  NUI.init = function () {
    if (this.initialized) return;
    this.initialized = true;
    const app = AE.App;
    $('#nodeAddBtn').onclick = (e) => this.addMenu(e.currentTarget);
    $('#nodeGroupBtn').onclick = () => this.encapsulate();
    $('#nodeFitBtn').onclick = () => this.fit();
    $('#nodeCreateBtn').onclick = () => this.createGraph();
    const wrap = $('#nodeCanvasWrap');
    wrap.addEventListener('wheel', (e) => {
      if (e.target.closest('.node')) return;
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nz = U.clamp(this.zoom * f, .2, 2.4);
      this.panX = mx - (mx - this.panX) * (nz / this.zoom);
      this.panY = my - (my - this.panY) * (nz / this.zoom);
      this.zoom = nz;
      this.render();
    }, { passive: false });
    wrap.addEventListener('mousedown', (e) => {
      if (e.target.closest('.node')) return;
      if (e.button === 1 || e.button === 0) {
        const rect = wrap.getBoundingClientRect();
        this.drag = { type: 'pan', x: e.clientX, y: e.clientY, panX: this.panX, panY: this.panY };
        wrap.style.cursor = 'grabbing';
      }
      if (!e.target.closest('.node') && e.button === 0) { this.selected.clear(); this.render(); }
    });
    wrap.addEventListener('dblclick', (e) => {
      if (e.target.closest('.node')) return;
      const rect = wrap.getBoundingClientRect();
      this.addNodeMenu(e.clientX, e.clientY, (e.clientX - rect.left - this.panX) / this.zoom, (e.clientY - rect.top - this.panY) / this.zoom);
    });
    window.addEventListener('mousemove', (e) => this.onMove(e));
    window.addEventListener('mouseup', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => {
      if (AE.App.isTyping()) return;
      if (AE.App.workspace !== 'nodes') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteSelected(); }
    });
    document.addEventListener('mousedown', (e) => { if (!e.target.closest('.node-add-pop')) this.closeAddPop(); }, true);
    this.render();
  };
  NUI.setGraph = function (graphId, push = false) {
    const app = AE.App;
    const g = (app.project.nodeGraphs || []).find(x => x.id === graphId);
    if (!g) return;
    if (this.graph && this.graph.id !== graphId && push) this.stack.push(this.graph.id);
    this.graph = g; this.graphId = g.id;
    this.selected.clear();
    this.fit();
    this.render();
  };
  NUI.back = function () {
    const id = this.stack.pop();
    if (id) this.setGraph(id);
  };
  NUI.currentGraph = function () {
    const app = AE.App;
    const layer = app.selectedLayer();
    if (layer && layer.type === 'nodes' && layer.nodeGraphId) {
      const g = (app.project.nodeGraphs || []).find(x => x.id === layer.nodeGraphId);
      if (g) { this.graph = g; this.graphId = g.id; }
    } else if (this.graphId) {
      const g = (app.project.nodeGraphs || []).find(x => x.id === this.graphId);
      if (g) this.graph = g;
    }
    if (!this.graph) this.graph = (app.project.nodeGraphs || [])[0] || null;
    return this.graph;
  };
  NUI.render = function () {
    const app = AE.App;
    if (!app || !app.comp) return;
    const wrap = $('#nodeView'); if (!wrap || !wrap.classList.contains('active')) return;
    const graph = this.currentGraph();
    $('#nodeEmpty').classList.toggle('show', !graph);
    if (!graph) { $('#nodeLayer').innerHTML = ''; $('#nodeLinks').innerHTML = ''; $('#nodeGraphName').textContent = '未选择节点图层'; return; }
    $('#nodeGraphName').textContent = graph.name + ' · ' + graph.nodes.length + ' 节点';
    const nodeLayer = $('#nodeLayer'), links = $('#nodeLinks');
    nodeLayer.style.transform = `translate(${this.panX}px,${this.panY}px) scale(${this.zoom})`;
    nodeLayer.innerHTML = '';
    const ctx = E.makeCtx(app.project, app.comp, app.time);
    let evalRes = null;
    try { evalRes = N.evalGraph(app.project, graph, ctx); } catch (e) { console.warn('node eval', e); }
    for (const node of graph.nodes) {
      const def = N.NODE_DEFS[node.type];
      if (!def) continue;
      const el = U.el('div', 'node' + (this.selected.has(node.id) ? ' selected' : ''));
      el.dataset.id = node.id;
      el.style.left = (node.x || 0) + 'px'; el.style.top = (node.y || 0) + 'px';
      const head = U.el('div', 'node-head');
      head.innerHTML = `<span class="nd-dot" style="background:${def.color || '#7fe7d4'}"></span><span class="nd-title">${escapeHtml(node.title || def.title)}</span><span class="nd-kind">${def.cat || 'node'}</span>`;
      head.onmousedown = (e) => this.startNodeDrag(e, node);
      head.onclick = (e) => { e.stopPropagation(); this.selectNode(node.id, e.shiftKey || e.metaKey || e.ctrlKey); };
      el.appendChild(head);
      const body = U.el('div', 'node-body');
      for (const port of (def.inputs || [])) {
        const row = U.el('div', 'node-port in');
        row.dataset.port = port.key;
        row.innerHTML = `<span class="socket type-${port.type}" data-node="${node.id}" data-dir="in" data-port="${port.key}"></span><span class="port-name">${escapeHtml(port.label)}</span><span class="port-type">${port.type.slice(0, 4)}</span>`;
        const sk = row.querySelector('.socket');
        sk.onmousedown = (e) => this.startLink(e, node, port.key, 'in', sk);
        sk.onclick = (e) => { e.stopPropagation(); const l = graph.links.find(x => x.to === node.id && x.toPort === port.key); if (l) { app.edit('断开节点链接', () => { graph.links = graph.links.filter(x => x !== l); }); } };
        body.appendChild(row);
      }
      for (const port of (def.outputs || [])) {
        const row = U.el('div', 'node-port out');
        row.dataset.port = port.key;
        row.innerHTML = `<span class="socket type-${port.type} ${graph.links.some(l => l.from === node.id && l.fromPort === port.key) ? 'connected' : ''}" data-node="${node.id}" data-dir="out" data-port="${port.key}"></span><span class="port-name">${escapeHtml(port.label)}</span>`;
        const sk = row.querySelector('.socket');
        sk.onmousedown = (e) => this.startLink(e, node, port.key, 'out', sk);
        body.appendChild(row);
      }
      // preview canvas
      if (def.outputs.length) {
        const pv = U.el('div', 'node-preview');
        pv.innerHTML = `<canvas></canvas><span class="np-label">LIVE PREVIEW</span>`;
        body.appendChild(pv);
        const cvs = pv.querySelector('canvas');
        setTimeout(() => this.drawPreview(cvs, node, evalRes), 0);
      }
      // params
      for (const paramDef of (def.params || [])) {
        if (paramDef.key === 'graphId' && node.type === 'group') {
          const row = U.el('div', 'node-param');
          const lab = U.el('label', '', '子图');
          const sel = U.el('select', 'mini-select');
          for (const g of (app.project.nodeGraphs || [])) { const o = document.createElement('option'); o.value = g.id; o.textContent = g.name; if (g.id === node.params.graphId) o.selected = true; sel.appendChild(o); }
          sel.onchange = () => app.edit('节点组图', () => node.params.graphId = sel.value);
          row.append(lab, sel); body.appendChild(row);
          continue;
        }
        const row = U.el('div', 'node-param');
        const lab = U.el('label', '', paramDef.label);
        let inp;
        if (paramDef.type === 'select') {
          inp = U.el('select', 'mini-select');
          for (const o of (paramDef.options || [])) { const op = document.createElement('option'); op.value = o; op.textContent = o; if (String(node.params[paramDef.key]) === String(o)) op.selected = true; inp.appendChild(op); }
          inp.onchange = () => app.edit('节点参数', () => node.params[paramDef.key] = inp.value);
        } else if (paramDef.type === 'text') {
          inp = U.el('input', 'num-input'); inp.style.textAlign = 'left'; inp.value = node.params[paramDef.key] == null ? paramDef.def : node.params[paramDef.key];
          inp.onchange = () => app.edit('节点参数', () => node.params[paramDef.key] = inp.value);
        } else {
          inp = U.el('input', 'num-input'); inp.value = node.params[paramDef.key] == null ? paramDef.def : node.params[paramDef.key];
          inp.onchange = () => { const v = parseFloat(inp.value); if (!isNaN(v)) app.edit('节点参数', () => node.params[paramDef.key] = v); };
        }
        row.append(lab, inp); body.appendChild(row);
      }
      if (node.type === 'group') {
        const ig = app.project.nodeGraphs.find(g => g.id === node.params.graphId);
        if (ig && ig.exposed && ig.exposed.length) {
          const tip = U.el('div', 'node-exp-tip', '公开参数');
          body.appendChild(tip);
          for (const exp of ig.exposed) {
            const row = U.el('div', 'node-param');
            const lab = U.el('label', '', exp.label);
            let inp;
            if (exp.type === 'select') {
              inp = U.el('select', 'mini-select');
              for (const o of (exp.options || [])) { const op = document.createElement('option'); op.value = o; op.textContent = o; if (String(node.params[exp.id] ?? exp.def) === String(o)) op.selected = true; inp.appendChild(op); }
              inp.onchange = () => app.edit('节点组公开参数', () => node.params[exp.id] = inp.value);
            } else {
              inp = U.el('input', 'num-input'); inp.value = node.params[exp.id] ?? exp.def;
              inp.onchange = () => { const v = parseFloat(inp.value); if (!isNaN(v)) app.edit('节点组公开参数', () => node.params[exp.id] = v); };
            }
            row.append(lab, inp); body.appendChild(row);
          }
        }
      }
      const foot = U.el('div', 'node-footer'); foot.textContent = `${node.type}  ·  ${def.outputs.length} out  ·  ${(node.id || '').slice(-5)}`;
      el.appendChild(body); el.appendChild(foot);
      el.onclick = (e) => { if (e.target.closest('.socket,input,select')) return; this.selectNode(node.id, e.shiftKey || e.metaKey || e.ctrlKey); };
      el.oncontextmenu = (e) => {
        e.preventDefault(); e.stopPropagation();
        this.selectNode(node.id, false);
        app.showMenu(e.clientX, e.clientY, [
          { label: '复制节点', action: () => this.duplicateSelected() },
          { label: '删除节点', action: () => this.deleteSelected() },
          '-',
          { label: '断开全部连接', action: () => app.edit('断开链接', () => { graph.links = graph.links.filter(l => l.from !== node.id && l.to !== node.id); }) },
          ...(node.type === 'group' ? [{ label: '进入节点组', action: () => this.setGraph(node.params.graphId, true) }] : [])
        ]);
      };
      nodeLayer.appendChild(el);
    }
    this.renderLinks();
    this.renderMinimap();
    $('#nodeZoomLabel').textContent = Math.round(this.zoom * 100) + '%';
  };
  NUI.renderLinks = function () {
    const graph = this.graph; const svg = $('#nodeLinks');
    if (!graph || !svg) return;
    const wrapRect = $('#nodeCanvasWrap').getBoundingClientRect();
    svg.innerHTML = '';
    const defs = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#5b8b83"/></marker></defs>`;
    svg.insertAdjacentHTML('beforeend', defs);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (const link of graph.links) {
      const from = document.querySelector(`.socket[data-node="${link.from}"][data-dir="out"][data-port="${link.fromPort}"]`);
      const to = document.querySelector(`.socket[data-node="${link.to}"][data-dir="in"][data-port="${link.toPort}"]`);
      if (!from || !to) continue;
      const rf = from.getBoundingClientRect(), rt = to.getBoundingClientRect();
      const x1 = rf.left + rf.width / 2 - wrapRect.left, y1 = rf.top + rf.height / 2 - wrapRect.top;
      const x2 = rt.left + rt.width / 2 - wrapRect.left, y2 = rt.top + rt.height / 2 - wrapRect.top;
      const mx = (x1 + x2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
      const type = (AE.NODE_DEFS || N.NODE_DEFS)[(graph.nodes.find(n => n.id === link.to) || {}).type];
      const color = N.TYPE_COLORS[from.dataset.type || 'geometry'] || '#7fe7d4';
      path.setAttribute('stroke', '#52847b');
      path.setAttribute('marker-end', 'url(#arrow)');
      path.dataset.link = link.id;
      g.appendChild(path);
    }
    svg.appendChild(g);
    if (this.linkDrag && this.linkDrag.temp) g.appendChild(this.linkDrag.temp);
  };
  NUI.drawPreview = function (cvs, node, res) {
    if (!cvs || !res) return;
    const wrap = cvs.parentElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth || 140, h = wrap.clientHeight || 56;
    cvs.width = w * dpr; cvs.height = h * dpr;
    const ctx = cvs.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(60,90,84,.2)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    let geo = null;
    if (res.cache && res.cache.has(node.id)) {
      const r = res.cache.get(node.id);
      geo = r.geo || r.field || r.emitter || null;
    }
    if (!geo) { ctx.fillStyle = '#3d514b'; ctx.font = '7px monospace'; ctx.fillText('—', w / 2, h / 2); return; }
    let pts = [];
    if (geo.mesh && geo.mesh.pos) { for (let i = 0; i < geo.mesh.pos.length; i += 3 * Math.max(1, Math.floor(geo.mesh.pos.length / 90))) pts.push([geo.mesh.pos[i], geo.mesh.pos[i + 1]]); }
    if (geo.points) pts.push(...geo.points.map(p => [p[0], p[1]]));
    if (geo.type === 'field') { ctx.strokeStyle = 'rgba(255,180,84,.5)'; for (let r = 8; r < 30; r += 7) { ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke(); } return; }
    if (!pts.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const sc = Math.min((w - 12) / Math.max(1, maxX - minX), (h - 12) / Math.max(1, maxY - minY), 2);
    const ox = w / 2 - (minX + maxX) / 2 * sc, oy = h / 2 - (minY + maxY) / 2 * sc;
    ctx.fillStyle = '#7fe7d4';
    for (const p of pts) ctx.fillRect(ox + p[0] * sc - .8, oy + p[1] * sc - .8, 1.6, 1.6);
    ctx.strokeStyle = 'rgba(127,231,212,.35)'; ctx.beginPath();
    let started = false;
    for (const p of pts.slice(0, 120)) { const x = ox + p[0] * sc, y = oy + p[1] * sc; if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); }
    ctx.stroke();
  };
  NUI.renderMinimap = function () {
    const el = $('#nodeMinimap'); if (!el || !this.graph) return;
    let cvs = el.querySelector('canvas');
    if (!cvs) { cvs = document.createElement('canvas'); el.appendChild(cvs); }
    const w = el.clientWidth, h = el.clientHeight;
    if (!w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cvs.width = w * dpr; cvs.height = h * dpr; cvs.style.width = '100%'; cvs.style.height = '100%';
    const ctx = cvs.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const nodes = this.graph.nodes;
    if (!nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) { const x = n.x || 0, y = n.y || 0; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + 180); maxY = Math.max(maxY, y + 120); }
    const pad = 20;
    const sc = Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1));
    const ox = pad + ((w - pad * 2) - (maxX - minX) * sc) / 2, oy = pad + ((h - pad * 2) - (maxY - minY) * sc) / 2;
    ctx.fillStyle = 'rgba(35,48,58,.6)';
    for (const n of nodes) { ctx.fillRect(ox + (n.x - minX) * sc, oy + (n.y - minY) * sc, 180 * sc, 110 * sc); }
    const wrap = $('#nodeCanvasWrap').getBoundingClientRect();
    ctx.strokeStyle = 'rgba(127,231,212,.5)'; ctx.strokeRect(ox + (-this.panX / this.zoom - minX) * sc, oy + (-this.panY / this.zoom - minY) * sc, wrap.width / this.zoom * sc, wrap.height / this.zoom * sc);
  };
  NUI.drawPreview = NUI.drawPreview;
  NUI.selectNode = function (id, additive) {
    if (!additive) this.selected.clear();
    if (this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);
    this.render();
  };
  NUI.startNodeDrag = function (e, node) {
    e.preventDefault(); e.stopPropagation();
    if (!this.selected.has(node.id)) this.selectNode(node.id, false);
    this.drag = { type: 'node', startX: e.clientX, startY: e.clientY, nodes: Array.from(this.selected).map(id => { const n = this.graph.nodes.find(x => x.id === id); return n ? { n, x: n.x || 0, y: n.y || 0 } : null; }).filter(Boolean), changed: false };
  };
  NUI.startLink = function (e, node, port, dir, socket) {
    e.preventDefault(); e.stopPropagation();
    const app = AE.App;
    if (dir === 'in') {
      const existing = this.graph.links.find(l => l.to === node.id && l.toPort === port);
      if (existing) {
        app.edit('断开节点链接', () => { this.graph.links = this.graph.links.filter(l => l !== existing); });
        return;
      }
      this.linkDrag = { from: node.id, port, dir: 'in', startSocket: socket };
    } else {
      this.linkDrag = { from: node.id, port, dir: 'out', startSocket: socket };
    }
    const wrapRect = $('#nodeCanvasWrap').getBoundingClientRect();
    const r = socket.getBoundingClientRect();
    const x = r.left + r.width / 2 - wrapRect.left, y = r.top + r.height / 2 - wrapRect.top;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#7fe7d4'); path.setAttribute('stroke-dasharray', '4 4'); path.setAttribute('stroke-width', '1.5');
    this.linkDrag.temp = path; this.linkDrag.x0 = x; this.linkDrag.y0 = y;
    $('#nodeLinks').appendChild(path);
  };
  NUI.onMove = function (e) {
    if (this.drag && this.drag.type === 'pan') {
      this.panX = this.drag.panX + e.clientX - this.drag.x; this.panY = this.drag.panY + e.clientY - this.drag.y;
      this.render(); return;
    }
    if (this.drag && this.drag.type === 'node') {
      if (!this.drag.changed) { this.drag.changed = true; AE.App.beginEdit('移动节点'); }
      const dx = (e.clientX - this.drag.startX) / this.zoom, dy = (e.clientY - this.drag.startY) / this.zoom;
      for (const it of this.drag.nodes) { it.n.x = Math.round((it.x + dx) / 10) * 10; it.n.y = Math.round((it.y + dy) / 10) * 10; }
      this.render(); return;
    }
    if (this.linkDrag) {
      const wrapRect = $('#nodeCanvasWrap').getBoundingClientRect();
      const x = e.clientX - wrapRect.left, y = e.clientY - wrapRect.top;
      const mx = (this.linkDrag.x0 + x) / 2;
      this.linkDrag.temp.setAttribute('d', `M${this.linkDrag.x0},${this.linkDrag.y0} C${mx},${this.linkDrag.y0} ${mx},${y} ${x},${y}`);
      return;
    }
  };
  NUI.onUp = function (e) {
    if (this.drag && this.drag.type === 'node') {
      if (this.drag.changed) AE.App.endEdit(true);
      this.drag = null; return;
    }
    if (this.drag && this.drag.type === 'pan') { this.drag = null; const w = $('#nodeCanvasWrap'); if (w) w.style.cursor = ''; return; }
    if (this.linkDrag) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const socket = target && target.closest ? target.closest('.socket') : null;
      if (socket) {
        const node = socket.dataset.node, dir = socket.dataset.dir, port = socket.dataset.port;
        let from, fromPort, to, toPort;
        if (this.linkDrag.dir === 'out' && dir === 'in') { from = this.linkDrag.from; fromPort = this.linkDrag.port; to = node; toPort = port; }
        else if (this.linkDrag.dir === 'in' && dir === 'out') { from = node; fromPort = port; to = this.linkDrag.from; toPort = this.linkDrag.port; }
        if (from && to) {
          const app = AE.App;
          app.edit('连接节点', () => {
            this.graph.links = this.graph.links.filter(l => !(l.to === to && l.toPort === toPort));
            this.graph.links.push({ id: U.uid('link'), from, fromPort, to, toPort });
          });
        }
      }
      if (this.linkDrag.temp) this.linkDrag.temp.remove();
      this.linkDrag = null; this.render();
    }
  };
  NUI.addMenu = function (el) {
    const r = el.getBoundingClientRect();
    this.addNodeMenu(r.left, r.bottom + 4, 100, 80);
  };
  NUI.addNodeMenu = function (x, y, gx, gy) {
    const app = AE.App;
    this.closeAddPop();
    const pop = U.el('div', 'node-add-pop');
    for (const cat in N.CATEGORIES) {
      pop.appendChild(U.el('div', 'nap-cat', cat));
      for (const type of N.CATEGORIES[cat]) {
        const def = N.NODE_DEFS[type]; if (!def) continue;
        const b = U.el('button', '', `<i style="background:${def.color}"></i>${def.title}`);
        b.onclick = () => {
          if (type === 'group') {
            const g = app.project.nodeGraphs[0];
            if (!g) { app.toast('没有可用的节点组', '', 'warn'); return; }
            const n = N.newNode('group', gx, gy); n.params.graphId = g.id; n.title = '节点组 · ' + g.name;
            app.edit('添加节点组', () => this.graph.nodes.push(n));
          } else {
            app.edit('添加节点', () => this.graph.nodes.push(N.newNode(type, gx, gy)));
          }
          this.closeAddPop();
        };
        pop.appendChild(b);
      }
    }
    const wrap = $('#nodeCanvasWrap'); const wr = wrap.getBoundingClientRect();
    pop.style.left = U.clamp(x - wr.left, 4, wr.width - 228) + 'px';
    pop.style.top = U.clamp(y - wr.top, 4, wr.height - 300) + 'px';
    wrap.appendChild(pop);
    this._addPop = pop;
  };
  NUI.closeAddPop = function () { if (this._addPop) { this._addPop.remove(); this._addPop = null; } };
  NUI.deleteSelected = function () {
    if (!this.selected.size) return;
    const app = AE.App;
    const ids = new Set(this.selected);
    app.edit('删除节点', () => {
      this.graph.nodes = this.graph.nodes.filter(n => !ids.has(n.id));
      this.graph.links = this.graph.links.filter(l => !ids.has(l.from) && !ids.has(l.to));
    });
    this.selected.clear();
  };
  NUI.duplicateSelected = function () {
    const app = AE.App;
    const nodes = this.graph.nodes.filter(n => this.selected.has(n.id));
    if (!nodes.length) return;
    app.edit('复制节点', () => {
      for (const n of nodes) {
        const m = U.deepClone(n); m.id = U.uid('node'); m.x += 30; m.y += 30; m.title = n.title || N.NODE_DEFS[n.type].title;
        this.graph.nodes.push(m);
      }
    });
    this.selected.clear();
  };
  NUI.createGraph = function () {
    const app = AE.App;
    const g = N.newGraph('节点图 ' + (app.project.nodeGraphs.length + 1));
    const input = N.newNode('ring', 80, 100);
    const dist = N.newNode('distribute', 340, 100);
    const out = N.newNode('output', 640, 110);
    g.nodes = [input, dist, out];
    N.link(g, input.id, 'geo', dist.id, 'geo');
    N.link(g, dist.id, 'geo', out.id, 'geo');
    app.edit('新建节点图', () => {
      app.project.nodeGraphs.push(g);
      const layer = app.selectedLayer();
      if (layer && layer.type === 'nodes') layer.nodeGraphId = g.id;
      else {
        const l = P.createLayer(app.project, app.comp, 'nodes', { name: '程序节点 · ' + g.name, graphId: g.id });
        P.addMaterialGroup(l);
        app.comp.layers.push(l); app.selection = [l.id];
      }
    });
    this.setGraph(g.id);
    app.toast('节点图已创建', g.name, 'ok');
  };
  NUI.fit = function () {
    const g = this.graph || this.currentGraph();
    const wrap = $('#nodeCanvasWrap');
    if (!g || !wrap) return;
    const nodes = g.nodes || [];
    if (!nodes.length) { this.zoom = 1; this.panX = 80; this.panY = 80; this.render(); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) { minX = Math.min(minX, n.x || 0); minY = Math.min(minY, n.y || 0); maxX = Math.max(maxX, (n.x || 0) + 220); maxY = Math.max(maxY, (n.y || 0) + 180); }
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const pad = 90;
    this.zoom = U.clamp(Math.min((w - pad * 2) / Math.max(1, maxX - minX), (h - pad * 2) / Math.max(1, maxY - minY)), .25, 1.15);
    this.panX = (w - (maxX - minX) * this.zoom) / 2 - minX * this.zoom;
    this.panY = (h - (maxY - minY) * this.zoom) / 2 - minY * this.zoom;
    this.render();
  };
  NUI.encapsulate = function () {
    const app = AE.App;
    const g = this.graph; if (!g) return;
    let sel = g.nodes.filter(n => this.selected.has(n.id));
    if (!sel.length) sel = g.nodes.filter(n => n.type !== 'output');
    if (!sel.length) { app.toast('没有可封装的节点', '', 'warn'); return; }
    const ids = new Set(sel.map(n => n.id));
    const inner = N.newGraph('节点组 ' + (app.project.nodeGraphs.length + 1));
    let output = sel.find(n => n.type === 'output');
    if (!output) {
      output = N.newNode('output', Math.max(...sel.map(n => n.x || 0)) + 260, Math.min(...sel.map(n => n.y || 0)));
      const sink = sel.slice().sort((a, b) => (b.x || 0) - (a.x || 0))[0];
      inner.nodes = sel.map(n => U.deepClone(n));
      inner.nodes.push(output);
      N.link(inner, sink.id, 'geo', output.id, 'geo');
    } else {
      inner.nodes = sel.map(n => U.deepClone(n));
    }
    inner.links = g.links.filter(l => ids.has(l.from) && ids.has(l.to)).map(l => U.deepClone(l));
    inner.exposed = [];
    for (const nd of inner.nodes) {
      if (nd.type === 'output') continue;
      const d = N.NODE_DEFS[nd.type]; if (!d) continue;
      for (const pd of (d.params || [])) {
        if (!['number', 'select'].includes(pd.type) || inner.exposed.length >= 6) continue;
        inner.exposed.push({ id: U.uid('exp'), nodeId: nd.id, key: pd.key, label: (nd.title || d.title) + ' · ' + pd.label, def: nd.params[pd.key] == null ? pd.def : nd.params[pd.key], type: pd.type, options: pd.options });
      }
    }
    const cx = Math.min(...sel.map(n => n.x || 0)), cy = Math.min(...sel.map(n => n.y || 0));
    app.edit('封装节点组', () => {
      app.project.nodeGraphs.push(inner);
      g.nodes = g.nodes.filter(n => !ids.has(n.id));
      g.links = g.links.filter(l => !ids.has(l.from) && !ids.has(l.to));
      const group = N.newNode('group', cx, cy); group.params.graphId = inner.id; group.title = '节点组 · ' + inner.name;
      for (const exp of inner.exposed) group.params[exp.id] = exp.def;
      g.nodes.push(group);
      const outNode = g.nodes.find(n => n.type === 'output');
      if (outNode) g.links.push({ id: U.uid('link'), from: group.id, fromPort: 'geo', to: outNode.id, toPort: 'geo' });
    });
    this.selected.clear();
    app.toast('节点组已封装', inner.name + ' · 可通过项目面板复用', 'ok');
    if (AE.ProjectPanel) AE.ProjectPanel.render();
  };
  NUI.openGraphInLayer = function (id) {
    const app = AE.App;
    const layer = app.selectedLayer();
    if (layer && layer.type === 'nodes') { app.edit('切换节点图', () => layer.nodeGraphId = id); this.setGraph(id); }
  };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  AE.NodesUI = NUI;
})();
