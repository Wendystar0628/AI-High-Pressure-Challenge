// 节点编辑器：创建、连接/断开、分支、复制、删除、封装节点组、公开参数；端口类型着色；显示当前结果与使用者
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, E = AE.Eval, Mdl = AE.Model, W = AE.W, App = AE.App, N = AE.Nodes;
  const NU = AE.NodeUI = { pan: [40, 40], zoom: 0.9 };
  const NW = 196, HH = 24, SH = 20;
  const CAT_COL = { '输入': '#4cc9f0', '分布': '#3ecf8e', '变换': '#9b8cff', '处理': '#ff9f43', '场': '#ff5d8f', '数学': '#9aa4b5', '输出': '#f2c14e', '组': '#7fe3d0' };
  let cv, cx, side, Wd, Ht, wire = null, box = null, selLink = null;
  NU.init = () => {
    cv = document.getElementById('ndc'); cx = cv.getContext('2d'); side = document.getElementById('nodeSide');
    cv.addEventListener('mousedown', onDown); cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', e => { e.preventDefault(); ctxMenu(e); });
    cv.addEventListener('dblclick', onDbl);
    App.panels.nodes = NU;
  };
  const graph = () => App.comp().graph;
  const S = (p) => [p[0] * NU.zoom + NU.pan[0], p[1] * NU.zoom + NU.pan[1]];
  const G2 = (p) => [(p[0] - NU.pan[0]) / NU.zoom, (p[1] - NU.pan[1]) / NU.zoom];
  function nodeH(n) { const ins = N.inputs(n), outs = N.outputs(n); return HH + Math.max(ins.length, outs.length, 1) * SH + 30; }
  function sockPos(n, id, isOut) {
    const list = isOut ? N.outputs(n) : N.inputs(n), i = list.findIndex(s => s.id === id);
    return [n.x + (isOut ? NW : 0), n.y + HH + (i + 0.5) * SH];
  }
  function consumers(n) {
    const d = N.DEFS[n.type]; if (!d || !d.out_) return [];
    const name = n.params.name, out = [];
    for (const l of App.comp().layers) {
      const js = Mdl.serialize(l);
      if (js.includes('"' + name + '"')) out.push(l.name);
    }
    return out;
  }
  NU.draw = () => {
    const f = W.fitCanvas(cv); Wd = f.w; Ht = f.h; cx.setTransform(f.d, 0, 0, f.d, 0, 0);
    cx.fillStyle = '#121418'; cx.fillRect(0, 0, Wd, Ht);
    // 网格点
    const gs = 24 * NU.zoom; cx.fillStyle = '#1f232b';
    for (let x = NU.pan[0] % gs; x < Wd; x += gs) for (let y = NU.pan[1] % gs; y < Ht; y += gs) cx.fillRect(x, y, 1.5, 1.5);
    const g = graph(), ch = App.chain();
    // 先求值输出节点，得到每个节点的当前结果
    for (const n of g.nodes) if (N.DEFS[n.type] && N.DEFS[n.type].out_) { try { N.evalNode(g, n, ch.t, ch.ctx); } catch (e) { n._err = e.message; } }
    cx.save(); cx.translate(NU.pan[0], NU.pan[1]); cx.scale(NU.zoom, NU.zoom);
    // 连线
    for (const lk of g.links) {
      const a = g.nodes.find(n => n.id === lk.from[0]), b = g.nodes.find(n => n.id === lk.to[0]); if (!a || !b) continue;
      const o = N.outputs(a).find(s => s.id === lk.from[1]); if (!o) continue;
      const p0 = sockPos(a, lk.from[1], true), p1 = sockPos(b, lk.to[1], false);
      drawWire(p0, p1, N.TYPES[o.type].color, lk === selLink ? 3.5 : 2);
    }
    if (wire) drawWire(wire.p0, wire.p1, wire.ok === false ? '#ff5a5f' : N.TYPES[wire.type].color, 2, true);
    // 节点
    for (const n of g.nodes) drawNode(n);
    cx.restore();
    if (box) { cx.strokeStyle = '#ff9f43'; cx.fillStyle = 'rgba(255,159,67,.08)'; const [a, b, c2, d] = box; cx.fillRect(Math.min(a, c2), Math.min(b, d), Math.abs(c2 - a), Math.abs(d - b)); cx.strokeRect(Math.min(a, c2), Math.min(b, d), Math.abs(c2 - a), Math.abs(d - b)); }
    // 图例
    cx.font = '11px sans-serif'; let x = 10;
    for (const k in N.TYPES) { cx.fillStyle = N.TYPES[k].color; cx.beginPath(); cx.arc(x + 4, Ht - 12, 4, 0, 7); cx.fill(); cx.fillStyle = '#8b93a7'; cx.fillText(N.TYPES[k].name, x + 11, Ht - 8); x += cx.measureText(N.TYPES[k].name).width + 26; }
    cx.fillStyle = '#5a6170'; cx.fillText('右键添加节点 · 拖动端口连线 · 框选后右键“封装为节点组” · Delete 删除 · 滚轮缩放 · 中键/Alt 拖动平移', x + 10, Ht - 8);
    if (!g.nodes.length) { cx.fillStyle = '#7c8494'; cx.font = '13px sans-serif'; cx.fillText('空节点图：右键添加“路径输入 → 挤出 → 几何输出”等节点，几何输出可被三维几何层、发射器与碰撞体同时使用。', 30, 40); }
    updateSide();
  };
  function drawWire(p0, p1, col, w, dash) {
    cx.strokeStyle = col; cx.lineWidth = w; if (dash) cx.setLineDash([6, 4]);
    const dx = Math.max(40, Math.abs(p1[0] - p0[0]) * 0.5);
    cx.beginPath(); cx.moveTo(p0[0], p0[1]); cx.bezierCurveTo(p0[0] + dx, p0[1], p1[0] - dx, p1[1], p1[0], p1[1]); cx.stroke(); cx.setLineDash([]);
  }
  function drawNode(n) {
    const d = N.DEFS[n.type] || {}, h = nodeH(n), sel = App.sel.nodes.has(n.id);
    const col = CAT_COL[d.cat] || '#888';
    cx.shadowColor = 'rgba(0,0,0,.5)'; cx.shadowBlur = 12;
    cx.fillStyle = '#1d2129'; rr(n.x, n.y, NW, h, 7); cx.fill(); cx.shadowBlur = 0;
    cx.strokeStyle = sel ? '#ff9f43' : n._err ? '#ff5a5f' : '#323947'; cx.lineWidth = sel ? 2 : 1; rr(n.x, n.y, NW, h, 7); cx.stroke();
    cx.fillStyle = col; cx.globalAlpha = 0.22; rr(n.x + 1, n.y + 1, NW - 2, HH - 2, 6); cx.fill(); cx.globalAlpha = 1;
    cx.fillStyle = col; cx.fillRect(n.x + 8, n.y + 9, 6, 6);
    cx.fillStyle = '#e8ebf0'; cx.font = 'bold 12px "Microsoft YaHei UI",sans-serif'; cx.fillText(n.name + (d.out_ ? '：' + n.params.name : ''), n.x + 20, n.y + 16);
    cx.fillStyle = '#7c8494'; cx.font = '10px sans-serif'; cx.fillText(d.cat || '', n.x + NW - 30, n.y + 16);
    cx.font = '11px "Microsoft YaHei UI",sans-serif';
    N.inputs(n).forEach((s, i) => { const y = n.y + HH + (i + 0.5) * SH; const linked = graph().links.some(l => l.to[0] === n.id && l.to[1] === s.id); sock(n.x, y, N.TYPES[s.type].color, linked); cx.fillStyle = '#aab1bf'; cx.fillText(s.name, n.x + 10, y + 4); });
    N.outputs(n).forEach((s, i) => { const y = n.y + HH + (i + 0.5) * SH; sock(n.x + NW, y, N.TYPES[s.type].color, true); cx.fillStyle = '#aab1bf'; const w = cx.measureText(s.name).width; cx.fillText(s.name, n.x + NW - 10 - w, y + 4); });
    // 结果
    cx.fillStyle = n._err ? '#ff5a5f' : '#6f7a8c'; cx.font = '10px Consolas,monospace';
    let res = n._err ? '⚠ ' + n._err : (n._last || '—');
    if (d.out_) { const cs = consumers(n); res = (cs.length ? '使用者：' + cs.join('、') : '未被引用'); }
    clip(res, n.x + 8, n.y + h - 10, NW - 16);
  }
  const sock = (x, y, col, fill) => { cx.beginPath(); cx.arc(x, y, 5, 0, 7); cx.fillStyle = fill ? col : '#1d2129'; cx.fill(); cx.strokeStyle = col; cx.lineWidth = 1.5; cx.stroke(); };
  const rr = (x, y, w, h, r) => { cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, w, h, r) : cx.rect(x, y, w, h); };
  function clip(s, x, y, w) { let str = String(s); while (str.length > 1 && cx.measureText(str).width > w) str = str.slice(0, -2) + '…'; cx.fillText(str, x, y); }

  function hit(gp) {
    const g = graph();
    for (let i = g.nodes.length - 1; i >= 0; i--) {
      const n = g.nodes[i];
      for (const s of N.outputs(n)) { const p = sockPos(n, s.id, true); if (Math.hypot(p[0] - gp[0], p[1] - gp[1]) < 9) return { kind: 'out', n, s }; }
      for (const s of N.inputs(n)) { const p = sockPos(n, s.id, false); if (Math.hypot(p[0] - gp[0], p[1] - gp[1]) < 9) return { kind: 'in', n, s }; }
      if (gp[0] >= n.x && gp[0] <= n.x + NW && gp[1] >= n.y && gp[1] <= n.y + nodeH(n)) return { kind: 'node', n };
    }
    // 连线
    for (const lk of g.links) {
      const a = g.nodes.find(n => n.id === lk.from[0]), b = g.nodes.find(n => n.id === lk.to[0]); if (!a || !b) continue;
      const p0 = sockPos(a, lk.from[1], true), p1 = sockPos(b, lk.to[1], false), dx = Math.max(40, Math.abs(p1[0] - p0[0]) * 0.5);
      for (let t = 0; t <= 1; t += 0.05) { const m = 1 - t; const x = m * m * m * p0[0] + 3 * m * m * t * (p0[0] + dx) + 3 * m * t * t * (p1[0] - dx) + t * t * t * p1[0], y = m * m * m * p0[1] + 3 * m * m * t * p0[1] + 3 * m * t * t * p1[1] + t * t * t * p1[1]; if (Math.hypot(x - gp[0], y - gp[1]) < 6) return { kind: 'link', lk }; }
    }
    return null;
  }
  const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function onWheel(e) { e.preventDefault(); const p = local(e), f = Math.exp(-e.deltaY * 0.0015), nz = U.clamp(NU.zoom * f, 0.25, 2.5); NU.pan = [p[0] - (p[0] - NU.pan[0]) * nz / NU.zoom, p[1] - (p[1] - NU.pan[1]) * nz / NU.zoom]; NU.zoom = nz; App.mark('nodes'); }
  function onDown(e) {
    const p = local(e), gp = G2(p);
    if (e.button === 1 || (e.button === 0 && e.altKey)) { const p0 = NU.pan.slice(); const mm = (ev) => { const q = local(ev); NU.pan = [p0[0] + q[0] - p[0], p0[1] + q[1] - p[1]]; App.mark('nodes'); }; const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); }; addEventListener('mousemove', mm); addEventListener('mouseup', mu); return; }
    if (e.button !== 0) return;
    const h = hit(gp), g = graph();
    selLink = null;
    if (h && h.kind === 'out') {
      wire = { p0: sockPos(h.n, h.s.id, true), p1: gp, type: h.s.type, from: [h.n.id, h.s.id] };
      const mm = (ev) => { wire.p1 = G2(local(ev)); const t = hit(wire.p1); wire.ok = t && t.kind === 'in' ? N.canConnect(g, wire.from, [t.n.id, t.s.id]) : undefined; App.mark('nodes'); };
      const mu = (ev) => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); const t = hit(G2(local(ev))); if (t && t.kind === 'in') { if (N.canConnect(g, wire.from, [t.n.id, t.s.id])) App.edit('连接节点', () => N.connect(g, wire.from, [t.n.id, t.s.id])); else W.toast('类型不匹配或会形成循环：' + N.TYPES[wire.type].name + ' → ' + N.TYPES[t.s.type].name, true); } wire = null; App.mark(); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu); return;
    }
    if (h && h.kind === 'in') {
      const lk = g.links.find(l => l.to[0] === h.n.id && l.to[1] === h.s.id);
      if (lk) { // 断开并重新拖动
        App.begin(); g.links = g.links.filter(l => l !== lk);
        const a = g.nodes.find(n => n.id === lk.from[0]); const o = N.outputs(a).find(s => s.id === lk.from[1]);
        wire = { p0: sockPos(a, lk.from[1], true), p1: gp, type: o.type, from: lk.from };
        const mm = (ev) => { wire.p1 = G2(local(ev)); App.mark('nodes'); };
        const mu = (ev) => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); const t = hit(G2(local(ev))); if (t && t.kind === 'in' && N.canConnect(g, wire.from, [t.n.id, t.s.id])) N.connect(g, wire.from, [t.n.id, t.s.id]); wire = null; App.commit('断开/重连节点'); };
        addEventListener('mousemove', mm); addEventListener('mouseup', mu);
      }
      return;
    }
    if (h && h.kind === 'link') { selLink = h.lk; App.mark('nodes'); return; }
    if (h && h.kind === 'node') {
      if (e.shiftKey || e.ctrlKey) { if (App.sel.nodes.has(h.n.id)) App.sel.nodes.delete(h.n.id); else App.sel.nodes.add(h.n.id); }
      else if (!App.sel.nodes.has(h.n.id)) App.sel.nodes = new Set([h.n.id]);
      const ns = g.nodes.filter(n => App.sel.nodes.has(n.id)), st = ns.map(n => [n.x, n.y]);
      // 置顶
      g.nodes = g.nodes.filter(n => n !== h.n).concat([h.n]);
      let moved = false;
      const mm = (ev) => { const q = G2(local(ev)); const dx = q[0] - gp[0], dy = q[1] - gp[1]; if (!moved && Math.hypot(dx, dy) < 3) return; if (!moved) { moved = true; App.begin(); } ns.forEach((n, i) => { n.x = Math.round((st[i][0] + dx) / 4) * 4; n.y = Math.round((st[i][1] + dy) / 4) * 4; }); App.mark('nodes'); };
      const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); if (moved) App.commit('移动节点'); App.mark('nodes', 'props', 'viewer'); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu);
      App.mark('nodes', 'props', 'viewer'); return;
    }
    if (!e.shiftKey) App.sel.nodes = new Set();
    box = [p[0], p[1], p[0], p[1]];
    const mm = (ev) => { const q = local(ev); box[2] = q[0]; box[3] = q[1]; App.mark('nodes'); };
    const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); const a = G2([Math.min(box[0], box[2]), Math.min(box[1], box[3])]), b = G2([Math.max(box[0], box[2]), Math.max(box[1], box[3])]); for (const n of g.nodes) if (n.x + NW > a[0] && n.x < b[0] && n.y + nodeH(n) > a[1] && n.y < b[1]) App.sel.nodes.add(n.id); box = null; App.mark('nodes', 'props'); };
    addEventListener('mousemove', mm); addEventListener('mouseup', mu);
    App.mark('nodes', 'props');
  }
  function onDbl(e) { const h = hit(G2(local(e))); if (h && h.kind === 'node') { const n = prompt('节点名称', h.n.name); if (n) App.edit('重命名节点', () => { h.n.name = n; }); } }
  NU.addNode = (type, at) => { let n; App.edit('添加节点：' + N.DEFS[type].name, () => { n = N.create(type, at[0], at[1]); if (N.DEFS[type].out_) n.params.name = N.DEFS[type].name + ' ' + (graph().nodes.filter(x => x.type === type).length + 1); graph().nodes.push(n); App.sel.nodes = new Set([n.id]); }); return n; };
  NU.addGroupInstance = (defId) => { const at = G2([Wd / 2 || 300, Ht / 2 || 200]); App.edit('添加节点组实例', () => { const n = N.instantiateGroup(App.proj, defId, at[0], at[1]); if (n) { graph().nodes.push(n); App.sel.nodes = new Set([n.id]); } }); };
  NU.deleteSel = () => {
    const g = graph();
    if (selLink) { App.edit('断开连接', () => { g.links = g.links.filter(l => l !== selLink); selLink = null; }); return; }
    const ids = App.sel.nodes; if (!ids.size) return;
    App.edit('删除节点', () => { g.nodes = g.nodes.filter(n => !ids.has(n.id)); g.links = g.links.filter(l => !ids.has(l.from[0]) && !ids.has(l.to[0])); App.sel.nodes = new Set(); });
  };
  NU.duplicateSel = () => {
    const g = graph(), ids = Array.from(App.sel.nodes); if (!ids.length) return;
    App.edit('复制节点', () => {
      const map = new Map();
      for (const id of ids) { const n = g.nodes.find(x => x.id === id); const c = Mdl.deserialize(Mdl.serialize(n)); c.id = Mdl.newId('nd'); c.x += 30; c.y += 30; if (N.DEFS[c.type] && N.DEFS[c.type].out_) c.params.name += ' 副本'; map.set(id, c.id); g.nodes.push(c); }
      for (const l of g.links.slice()) if (map.has(l.from[0]) && map.has(l.to[0])) g.links.push({ id: Mdl.newId('lk'), from: [map.get(l.from[0]), l.from[1]], to: [map.get(l.to[0]), l.to[1]] });
      App.sel.nodes = new Set(map.values());
    });
  };
  function ctxMenu(e) {
    const gp = G2(local(e)), h = hit(gp);
    if (h && h.kind === 'node' && !App.sel.nodes.has(h.n.id)) App.sel.nodes = new Set([h.n.id]);
    const cats = {};
    for (const [k, d] of Object.entries(N.DEFS)) { if (d.dyn) continue; (cats[d.cat] = cats[d.cat] || []).push({ label: d.name, fn: () => NU.addNode(k, gp) }); }
    const groups = (App.proj.nodeGroups || []).map(g => ({ label: g.name, fn: () => { App.edit('添加节点组实例', () => { const n = N.instantiateGroup(App.proj, g.id, gp[0], gp[1]); graph().nodes.push(n); }); } }));
    const items = [{ head: '添加节点' }, ...Object.entries(cats).map(([c, list]) => ({ label: c, sub: list })), groups.length ? { label: '节点组', sub: groups } : null];
    if (App.sel.nodes.size) items.push({ sep: true }, { label: '复制节点', fn: NU.duplicateSel }, { label: '封装为节点组（公开参数）', fn: () => { const name = prompt('节点组名称', '节点组 ' + ((App.proj.nodeGroups || []).length + 1)); if (!name) return; App.edit('封装节点组', () => { const gn = N.encapsulate(App.proj, graph(), Array.from(App.sel.nodes), name); if (gn) App.sel.nodes = new Set([gn.id]); }); } }, { label: '断开全部连接', fn: () => App.edit('断开连接', () => { graph().links = graph().links.filter(l => !App.sel.nodes.has(l.from[0]) && !App.sel.nodes.has(l.to[0])); }) }, { label: '删除', key: 'Del', fn: NU.deleteSel });
    if (h && h.kind === 'link') items.push({ sep: true }, { label: '断开此连接', fn: () => App.edit('断开连接', () => { graph().links = graph().links.filter(l => l !== h.lk); }) });
    W.menu(e.clientX, e.clientY, items.filter(Boolean));
  }
  addEventListener('keydown', (e) => { if (App.bottomTab !== 'nodes' || W.isTyping(e)) return; if (e.key === 'Delete' && (App.sel.nodes.size || selLink)) { NU.deleteSel(); e.stopImmediatePropagation(); e.preventDefault(); } if ((e.ctrlKey) && (e.key === 'd' || e.key === 'D') && App.sel.nodes.size) { NU.duplicateSel(); e.stopImmediatePropagation(); e.preventDefault(); } }, true);

  // ---------- 参数面板 ----------
  let sideSig = '';
  function updateSide() {
    const sig = Array.from(App.sel.nodes).join(',') + '|' + App.hist.cur.length;
    if (sig === sideSig) { side._up && side._up.forEach(f => f()); return; }
    sideSig = sig; side.innerHTML = '';
    side.append(NU.paramPanel(true));
  }
  NU.paramPanel = (compact) => {
    const el = W.el, g = graph();
    const wrap = el('div');
    const ns = g.nodes.filter(n => App.sel.nodes.has(n.id));
    if (!ns.length) { wrap.append(el('div', { class: 'small', style: { lineHeight: 1.7 } }, '选中节点以编辑参数。', el('br'), '端口类型：标量 / 向量 / 颜色 / 几何 / 场。同一几何输出可连到多个使用者（显示、变形、发射、碰撞）。', el('br'), '场节点的范围在画布中以粉色圆显示，可直接拖动中心。')); return wrap; }
    const n = ns[0], d = N.DEFS[n.type];
    wrap.append(el('div', { class: 'sub-h' }, el('span', { text: n.name + '（' + (d ? d.cat : '') + '）' })));
    const fake = { id: 'graph', threeD: true, transform: {} };
    const ups = [];
    const row = (label, ...c) => el('div', { class: 'row' }, el('label', { text: label }), el('div', { class: 'ctl' }, ...c));
    const layerSel = (filter) => { const o = { '': '（无）' }; for (const l of App.comp().layers) if (filter(l)) o[l.id] = l.name; return W.select(o, n.params.layer || '', v => App.edit('节点源图层', () => { n.params.layer = v || null; })); };
    if (n.type === 'pathIn') wrap.append(row('源图层', layerSel(l => l.type === 'shape')), row('', W.check(n.params.world, v => App.edit('世界坐标', () => { n.params.world = v; }), '使用图层世界变换')));
    if (n.type === 'textIn') wrap.append(row('文字图层', layerSel(l => l.type === 'text')));
    if (n.type === 'particlesIn') wrap.append(row('粒子图层', layerSel(l => l.type === 'particles')), el('div', { class: 'small', text: '输出每个粒子的位置、索引、稳定标识、年龄与寿命（逐粒子可在“逐元素表达式”中读取 id / age / life / pos）。' }));
    if (n.type === 'layerPos') wrap.append(row('图层', layerSel(() => true)));
    if (d && d.out_) wrap.append(row('输出名称', (() => { const i = el('input', { value: n.params.name, style: { width: '100%' } }); i.addEventListener('keydown', e => e.stopPropagation()); i.addEventListener('change', () => App.edit('输出名称', () => { n.params.name = i.value; })); return i; })()), el('div', { class: 'small', text: '使用者：' + (consumers(n).join('、') || '无') }));
    for (const [k, opts] of Object.entries({ op: n.type === 'boolean' ? { union: '并集', subtract: '差集', intersect: '交集', xor: '排除' } : n.type === 'math' ? { add: '加', sub: '减', mul: '乘', div: '除', sin: 'sin(a)·b', max: '最大', min: '最小', pow: '幂' } : { add: '加', sub: '减', scale: '缩放' }, mode: n.type === 'fieldMix' ? { add: '相加', sub: '相减', mul: '相乘', max: '最大', min: '最小', lerp: '插值' } : { vector: '向量位移', scalar: '标量（向上）' }, axis: { x: 'X', y: 'Y', z: 'Z' } })) {
      if (n.params[k] !== undefined && typeof n.params[k] === 'string' && k !== 'name' && k !== 'expr') wrap.append(row(Mdl.label(k) === k ? ({ op: '运算', mode: '方式', axis: '轴向' })[k] : Mdl.label(k), W.select(opts, n.params[k], v => App.edit('节点参数', () => { n.params[k] = v; }))));
    }
    if (n.type === 'instance') wrap.append(row('', W.check(n.params.align, v => App.edit('对齐', () => { n.params.align = v; }), '沿点方向旋转')));
    if (n.type === 'attrExpr') {
      const ta = el('textarea', { rows: 3, spellcheck: false }); ta.value = n.params.expr; ta.addEventListener('keydown', e => e.stopPropagation()); ta.addEventListener('change', () => App.edit('逐元素表达式', () => { n.params.expr = ta.value; }));
      wrap.append(el('div', { class: 'small', text: '对每个顶点/字符/实例/粒子求值。变量：pos idx id count age life time；返回新位置。' }), ta);
      const er = el('div', { class: 'exprerr' }); wrap.append(er); ups.push(() => { er.textContent = n._err ? '⚠ ' + n._err : ''; });
    }
    if (n.type === 'group') {
      const def = N.groupDef(App.proj, n.params.def);
      wrap.append(el('div', { class: 'small', text: def ? '节点组“' + def.name + '”：' + def.graph.nodes.length + ' 个内部节点；以下公开参数可按实例覆盖。' : '缺少节点组定义' }));
      if (def) for (const ex of def.exposed) { const p = n.params['x_' + ex.id]; if (p) wrap.append(AE.Props.propRow(null, p, ex.name, { noKeys: false })); }
      if (def) wrap.append(row('', el('button', { class: 'btn sm', text: '重命名组定义', onclick: () => { const nm = prompt('名称', def.name); if (nm) App.edit('重命名节点组', () => { def.name = nm; n.name = nm; }); } })));
    }
    for (const k in n.params) { const p = n.params[k]; if (Mdl.isProp(p) && !k.startsWith('x_')) wrap.append(AE.Props.propRow(null, p, Mdl.label(k) === k ? ({ cols: '列', rows: '行', spacing: '间距', seed: '种子', speed: '速度', value: '数值', a: 'A', b: 'B', k: '系数', t: '比例', translate: '平移', rotate: '旋转', pivot: '中心', tilt: '倾斜', fieldScale: '场缩放', axis: '轴', color: '颜色', scale: '缩放', phase: '相位' })[k] || k : Mdl.label(k), { step: p.type === 'num' && Math.abs(p.value) < 5 ? 0.01 : 1 })); }
    const res = el('div', { class: 'small', style: { marginTop: '8px', fontFamily: 'Consolas,monospace' } });
    ups.push(() => { res.textContent = '当前结果：' + (n._err ? '⚠ ' + n._err : n._last || '—'); });
    wrap.append(res);
    ups.forEach(f => f());
    side._up = ups;
    return wrap;
  };
})(typeof window !== 'undefined' ? window : globalThis);
