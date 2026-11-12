'use strict';
// ============ 节点视图 ============
const NodeView = {
  path: [], pan: [20, 20], zoom: 0.85, els: new Map(), ups: [],
  CAT_COLORS: { '输入': '#2f5d4a', '数学': '#3d3d58', '几何': '#245266', '变形': '#5a3d24', '分布': '#3c4f2a', '场': '#6a3a1f', '输出': '#5e2a3a', '组': '#444' },
  init() {
    this.wrap = document.getElementById('nodeWrap'); this.layer = document.getElementById('nodeLayer'); this.svg = document.getElementById('nodeSvg'); this.info = document.getElementById('nodeInfo');
    this.wrap.addEventListener('mousedown', e => this.bgDown(e));
    this.wrap.addEventListener('wheel', e => { e.preventDefault(); const r = this.wrap.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const f = e.deltaY < 0 ? 1.12 : 1 / 1.12; const z = U.clamp(this.zoom * f, 0.25, 2); this.pan = [mx - (mx - this.pan[0]) * z / this.zoom, my - (my - this.pan[1]) * z / this.zoom]; this.zoom = z; this.applyXf(); }, { passive: false });
    this.wrap.addEventListener('contextmenu', e => { e.preventDefault(); if (e.target.closest('.node')) return; const p = this.toGraph(e); this.addMenu(e.clientX, e.clientY, p); });
    document.getElementById('nodePanel').addEventListener('mousedown', () => App.focus = 'nodes');
    const b = document.getElementById('nodeBtns');
    b.append(this.tb('＋节点', e => { const r = this.wrap.getBoundingClientRect(); this.addMenu(e.clientX, e.clientY + 10, this.toGraph({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); }, '添加节点（也可在空白处右键）'),
      this.tb('封装组', () => this.groupSel(), '把所选节点封装为节点组'), this.tb('解组', () => this.ungroupSel(), '解散所选节点组'), this.tb('上级', () => { this.path.pop(); this.rebuild(); }, '返回上级网络'), this.tb('适配', () => this.fit(), '适配视图'));
    new ResizeObserver(() => this.layoutWires()).observe(this.wrap);
  },
  tb(text, fn, title) { return U.el('button', { class: 'tbtn', text, title, onclick: fn }); },
  get graph() { return this.path.length ? this.path[this.path.length - 1].sub : App.comp.graph; },
  applyXf() { this.layer.style.transform = `translate(${this.pan[0]}px,${this.pan[1]}px) scale(${this.zoom})`; this.layoutWires(); },
  toGraph(e) { const r = this.wrap.getBoundingClientRect(); return [(e.clientX - r.left - this.pan[0]) / this.zoom, (e.clientY - r.top - this.pan[1]) / this.zoom]; },
  fit() {
    const g = this.graph; if (!g.nodes.length) return; const r = this.wrap.getBoundingClientRect();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const n of g.nodes) { const el = this.els.get(n.id); const w = el ? el.offsetWidth : 160, h = el ? el.offsetHeight : 80; x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + w); y1 = Math.max(y1, n.y + h); }
    this.zoom = U.clamp(Math.min((r.width - 40) / (x1 - x0), (r.height - 40) / (y1 - y0)), 0.25, 1.2); this.pan = [20 - x0 * this.zoom + (r.width - 40 - (x1 - x0) * this.zoom) / 2, 20 - y0 * this.zoom]; this.applyXf();
  },
  rebuild() {
    if (!this.layer) return; const comp = App.comp; this.path = this.path.filter(g => g.sub);
    const g = this.graph; this.layer.innerHTML = ''; this.els.clear(); this.ups = [];
    document.getElementById('nodeCrumb').textContent = ' · ' + comp.name + (this.path.length ? ' › ' + this.path.map(p => p.label || '节点组').join(' › ') : '');
    for (const n of g.nodes) this.layer.appendChild(this.nodeEl(n, g));
    this.applyXf(); this.update();
    if (!g.nodes.length) this.info.textContent = '空节点网络：右键或「＋节点」添加。示例：文字轮廓 → 挤出 → 场变形 → 显示；同一几何还可连到粒子发射源与碰撞体。';
    if (!this._fitted && g.nodes.length) { this._fitted = true; requestAnimationFrame(() => this.fit()); }
  },
  portShape(t) { return t === 'geo' ? 'sq' : t === 'field' ? 'dia' : ''; },
  nodeEl(n, g) {
    const T = NodeTypes[n.type]; const comp = App.comp; const ports = NodeEval.ports(n);
    const el = U.el('div', { class: 'node' + (App.sel.nodes.has(n.id) ? ' sel' : '') + (n._err ? ' err' : ''), style: { left: n.x + 'px', top: n.y + 'px' } });
    const head = U.el('div', { class: 'nh', style: { background: this.CAT_COLORS[T.cat] || '#333' } }, U.el('span', { text: n.label || T.label }), U.el('span', { class: 'cat', text: T.cat }));
    head.title = T.desc || ''; el.appendChild(head);
    head.addEventListener('mousedown', e => this.nodeDown(e, n));
    if (n.type === 'group') head.addEventListener('dblclick', () => { this.path.push(n); App.sel.nodes.clear(); this.rebuild(); setTimeout(() => this.fit(), 30); });
    const pr = U.el('div', { class: 'ports' }); const ins = U.el('div'), outs = U.el('div');
    for (const p of ports.in) {
      const linked = g.links.some(l => l.to === n.id && l.ti === p.n);
      const dot = U.el('span', { class: 'dot ' + this.portShape(p.t), style: { background: PORT_TYPES[p.t].color }, title: `输入「${p.label}」· 类型：${PORT_TYPES[p.t].label}` });
      dot.dataset.node = n.id; dot.dataset.port = p.n; dot.dataset.dir = 'in'; dot.dataset.type = p.t;
      dot.addEventListener('mousedown', e => this.portDown(e, n, p, 'in'));
      const row = U.el('div', { class: 'pin in' }, dot, U.el('span', { text: p.label }));
      if (!linked && p.p && Model.isProp(n.p[p.p])) { const meta = { prop: n.p[p.p], kind: p.t === 'vec' ? 'vec' : p.t === 'color' ? 'color' : 'num', label: p.label, dims: 3 }; const w = Widgets.propRow(meta, null, comp, { compact: true }); this.ups.push(w.update); const v = w.parts; v.style.marginLeft = '4px'; row.append(w.el.children[0], v); }
      ins.appendChild(row);
    }
    for (const p of ports.out) {
      const dot = U.el('span', { class: 'dot ' + this.portShape(p.t), style: { background: PORT_TYPES[p.t].color }, title: `输出「${p.label}」· 类型：${PORT_TYPES[p.t].label}（可连接多个使用者）` });
      dot.dataset.node = n.id; dot.dataset.port = p.n; dot.dataset.dir = 'out'; dot.dataset.type = p.t;
      dot.addEventListener('mousedown', e => this.portDown(e, n, p, 'out'));
      outs.appendChild(U.el('div', { class: 'pin out' }, U.el('span', { text: p.label }), dot));
    }
    pr.append(ins, outs); el.appendChild(pr);
    // 其余参数
    for (const [k, d] of Object.entries(T.params || {})) {
      if ((T.in || []).some(p => p.p === k)) continue;
      let ctl = null;
      if (d.t === 'layer') ctl = Widgets.layerSelect(comp, n.p[k], d.filter, v => { n.p[k] = v; App.structChanged('节点参数'); });
      else if (d.t === 'enum') ctl = Widgets.select(d.opts, n.p[k], v => { n.p[k] = v; App.structChanged('节点参数'); });
      else if (d.t === 'bool') ctl = Widgets.check(n.p[k], v => { n.p[k] = v; App.structChanged('节点参数'); });
      else if (d.t === 'pins') ctl = U.el('span', { class: 'dim', text: `${(n.pins || []).length} 个图钉` });
      else if (d.t === 'num' && !Model.isProp(n.p[k])) { ctl = Widgets.scrub(() => n.p[k], (v, c) => { n.p[k] = d.min !== undefined ? Math.max(d.min, v) : v; Anim.touch(); App.edited(c ? '节点参数' : null); }, { step: Math.abs(n.p[k]) > 20 ? 1 : 0.1, min: d.min, max: d.max }); this.ups.push(ctl.update); }
      else if (Model.isProp(n.p[k])) { const w = Widgets.propRow({ prop: n.p[k], kind: d.t === 'vec' ? 'vec' : d.t === 'color' ? 'color' : 'num', label: d.label, dims: 3 }, null, comp, { compact: true }); this.ups.push(w.update); ctl = U.el('span', { style: { display: 'flex', gap: '3px' } }, w.el.children[0], w.parts); }
      if (ctl) { ctl.addEventListener && ctl.addEventListener('mousedown', e => e.stopPropagation()); el.appendChild(U.el('div', { class: 'prm' }, U.el('span', { text: d.label }), ctl)); }
    }
    if (n.type === 'pinWarp') el.appendChild(U.el('div', { class: 'prm' }, U.el('span', { class: 'dim', text: '选中显示图层后用图钉工具添加' })));
    const res = U.el('div', { class: 'res' }); el.appendChild(res); el._res = res;
    el.addEventListener('mousedown', e => { if (e.target.closest('.dot')) return; e.stopPropagation(); });
    this.els.set(n.id, el);
    return el;
  },
  update() {
    for (const u of this.ups) try { u(); } catch (e) { }
    const g = this.graph; const comp = App.comp; const t = App.t;
    const ctx = NodeEval.ctx(comp, t);
    for (const n of g.nodes) {
      const el = this.els.get(n.id); if (!el) continue;
      const T = NodeTypes[n.type]; let txt = '';
      try {
        if (this.path.length) { txt = n._last ? Object.values(n._last).map(v => NodeEval.describe(v)).join(' | ') : '（组内结果在求值后显示）'; }
        else if (T.consumer) { const ip = NodeEval.ports(n).in[0]; const v = ip ? NodeEval.input(ctx, g, n, ip.n) : null; const tgt = Model.findLayer(comp, n.p.layer); txt = (tgt ? '→ ' + tgt.name + '：' : (n.type === 'collider' ? '→ 全部粒子：' : '（未指定图层）')) + NodeEval.describe(v); }
        else { const o = NodeEval.evalNode(ctx, g, n); txt = NodeEval.ports(n).out.map(p => NodeEval.describe(o[p.n])).join(' | '); }
      } catch (e) { txt = '错误：' + e.message; }
      el._res.textContent = n._err ? '⚠ ' + n._err : txt; el._res.classList.toggle('e', !!n._err); el.classList.toggle('err', !!n._err);
    }
  },
  // ---------- 连线 ----------
  portPos(nid, port, dir) {
    const el = this.els.get(nid); if (!el) return null; const d = el.querySelector(`.dot[data-port="${port}"][data-dir="${dir}"]`); if (!d) return null;
    const r = d.getBoundingClientRect(), w = this.wrap.getBoundingClientRect(); return [r.left + r.width / 2 - w.left, r.top + r.height / 2 - w.top];
  },
  wirePath(a, b) { const dx = Math.max(40, Math.abs(b[0] - a[0]) * 0.5); return `M${a[0]},${a[1]} C${a[0] + dx},${a[1]} ${b[0] - dx},${b[1]} ${b[0]},${b[1]}`; },
  layoutWires() {
    if (!this.svg || !App.project) return; const g = this.graph; this.svg.innerHTML = '';
    for (const l of g.links) {
      const a = this.portPos(l.from, l.fo, 'out'), b = this.portPos(l.to, l.ti, 'in'); if (!a || !b) continue;
      const src = g.nodes.find(n => n.id === l.from); const pt = src ? (NodeEval.ports(src).out.find(p => p.n === l.fo) || {}).t : 'geo';
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', this.wirePath(a, b)); p.setAttribute('class', 'wire'); p.setAttribute('stroke', (PORT_TYPES[pt] || PORT_TYPES.geo).color);
      p.style.pointerEvents = 'stroke'; p.style.cursor = 'pointer';
      p.addEventListener('mouseenter', () => { p.classList.add('hl'); this.info.textContent = this.linkInfo(l); });
      p.addEventListener('mouseleave', () => { p.classList.remove('hl'); this.info.textContent = ''; });
      p.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); Menus.show([['断开连线', () => { g.links = g.links.filter(x => x !== l); App.structChanged('断开连线'); }]], e.clientX, e.clientY); });
      p.addEventListener('mousedown', e => { if (e.button === 0 && e.altKey) { e.stopPropagation(); g.links = g.links.filter(x => x !== l); App.structChanged('断开连线'); } });
      this.svg.appendChild(p);
    }
    if (this.tmpWire) { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', this.wirePath(this.tmpWire[0], this.tmpWire[1])); p.setAttribute('class', 'wire'); p.setAttribute('stroke', '#fff'); p.setAttribute('stroke-dasharray', '5 4'); this.svg.appendChild(p); }
  },
  linkInfo(l) {
    const g = this.graph; const a = g.nodes.find(n => n.id === l.from), b = g.nodes.find(n => n.id === l.to); if (!a || !b) return '';
    const pa = NodeEval.ports(a).out.find(p => p.n === l.fo), pb = NodeEval.ports(b).in.find(p => p.n === l.ti);
    let v = ''; try { if (!this.path.length) v = NodeEval.describe(NodeEval.evalNode(NodeEval.ctx(App.comp, App.t), g, a)[l.fo]); } catch (e) { }
    return `${NodeTypes[a.type].label}.${pa ? pa.label : l.fo} → ${NodeTypes[b.type].label}.${pb ? pb.label : l.ti}（${PORT_TYPES[pa ? pa.t : 'geo'].label}）：${NodeTypes[b.type].desc || ''}　当前：${v}　（右键或 Alt+点击断开）`;
  },
  compatible(a, b) { return a === b || (a === 'num' && b === 'vec'); },
  portDown(e, n, p, dir) {
    e.stopPropagation(); e.preventDefault(); const g = this.graph;
    let from = dir === 'out' ? { n, p } : null;
    if (dir === 'in') { // 拾起已有连线
      const l = g.links.find(x => x.to === n.id && x.ti === p.n);
      if (!l) { from = null; this.toast('从输出端口拖到输入端口进行连接'); return; }
      g.links = g.links.filter(x => x !== l); const src = g.nodes.find(x => x.id === l.from); from = { n: src, p: NodeEval.ports(src).out.find(q => q.n === l.fo) }; this.layoutWires();
    }
    const a = this.portPos(from.n.id, from.p.n, 'out');
    const mv = ev => { const w = this.wrap.getBoundingClientRect(); this.tmpWire = [a, [ev.clientX - w.left, ev.clientY - w.top]]; this.layoutWires(); };
    const up = ev => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up); this.tmpWire = null;
      const t = document.elementFromPoint(ev.clientX, ev.clientY); const dot = t && t.closest && t.closest('.dot[data-dir="in"]');
      if (dot) {
        const tid = +dot.dataset.node, tp = dot.dataset.port, tt = dot.dataset.type;
        if (tid === from.n.id) { App.structChanged('断开连线'); return; }
        if (!this.compatible(from.p.t, tt)) { App.toast(`类型不匹配：${PORT_TYPES[from.p.t].label} 不能连接到 ${PORT_TYPES[tt].label}`); App.structChanged(); return; }
        g.links = g.links.filter(x => !(x.to === tid && x.ti === tp));
        g.links.push({ id: Model.nid(), from: from.n.id, fo: from.p.n, to: tid, ti: tp });
        // 环路检查
        try { NodeEval.memo.clear(); const tn = g.nodes.find(x => x.id === tid); NodeEval.evalNode(NodeEval.ctx(App.comp, App.t), g, tn); } catch (er) { g.links.pop(); App.toast('不能形成环路'); }
        App.structChanged('连接节点');
      } else App.structChanged(dir === 'in' ? '断开连线' : null);
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  },
  toast(m) { App.toast(m); },
  nodeDown(e, n) {
    e.stopPropagation(); App.focus = 'nodes';
    if (e.shiftKey || e.ctrlKey) { App.sel.nodes.has(n.id) ? App.sel.nodes.delete(n.id) : App.sel.nodes.add(n.id); }
    else if (!App.sel.nodes.has(n.id)) { App.sel.nodes.clear(); App.sel.nodes.add(n.id); }
    for (const [id, el] of this.els) el.classList.toggle('sel', App.sel.nodes.has(id));
    this.info.textContent = NodeTypes[n.type].desc || '';
    const g = this.graph; const sel = g.nodes.filter(x => App.sel.nodes.has(x.id)); const st = sel.map(x => [x.x, x.y]); const x0 = e.clientX, y0 = e.clientY; let moved = false;
    const mv = ev => { moved = true; sel.forEach((x, i) => { x.x = st[i][0] + (ev.clientX - x0) / this.zoom; x.y = st[i][1] + (ev.clientY - y0) / this.zoom; const el = this.els.get(x.id); el.style.left = x.x + 'px'; el.style.top = x.y + 'px'; }); this.layoutWires(); };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (moved) History.commit('移动节点'); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  },
  bgDown(e) {
    if (e.target.closest('.node') || e.button === 2) return;
    App.focus = 'nodes';
    if (!e.shiftKey) { App.sel.nodes.clear(); for (const el of this.els.values()) el.classList.remove('sel'); }
    const p0 = this.pan.slice(), x0 = e.clientX, y0 = e.clientY;
    const mv = ev => { this.pan = [p0[0] + ev.clientX - x0, p0[1] + ev.clientY - y0]; this.applyXf(); };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  },
  addMenu(x, y, pos) {
    const cats = {}; for (const [k, T] of Object.entries(NodeTypes)) { if (T.hidden || k === 'group') continue; (cats[T.cat] || (cats[T.cat] = [])).push([T.label, () => this.add(k, pos)]); }
    const items = []; for (const [c, list] of Object.entries(cats)) { items.push({ head: c }); items.push(...list); }
    Menus.show(items, x, y);
  },
  add(type, pos) {
    const n = NodeEval.newNode(type, pos[0], pos[1]); const comp = App.comp;
    const T = NodeTypes[type];
    for (const [k, d] of Object.entries(T.params || {})) if (d.t === 'layer' && !n.p[k]) { const L = comp.layers.find(l => d.filter === 'any' ? (App.sel.layers.includes(l.id)) : l.type === d.filter); if (L) n.p[k] = L.id; }
    this.graph.nodes.push(n); App.sel.nodes = new Set([n.id]); App.structChanged('添加节点：' + T.label);
  },
  deleteSel() { const g = this.graph; const s = App.sel.nodes; g.nodes = g.nodes.filter(n => !s.has(n.id) || n.type === 'groupIn' || n.type === 'groupOut'); g.links = g.links.filter(l => g.nodes.some(n => n.id === l.from) && g.nodes.some(n => n.id === l.to)); App.sel.nodes.clear(); App.structChanged('删除节点'); },
  selectAll() { for (const n of this.graph.nodes) App.sel.nodes.add(n.id); this.rebuild(); },
  copySel() { const g = this.graph; const ns = g.nodes.filter(n => App.sel.nodes.has(n.id) && !['groupIn', 'groupOut'].includes(n.type)); const ids = new Set(ns.map(n => n.id)); App.clip = { kind: 'nodes', nodes: Model.json(ns), links: Model.json(g.links.filter(l => ids.has(l.from) && ids.has(l.to))) }; App.toast(`已复制 ${ns.length} 个节点`); },
  paste() {
    const g = this.graph; const ns = JSON.parse(App.clip.nodes), ls = JSON.parse(App.clip.links); const map = new Map();
    for (const n of ns) { const old = n.id; Model.reId(n); map.set(old, n.id); n.x += 40; n.y += 40; }
    for (const l of ls) { l.id = Model.nid(); l.from = map.get(l.from); l.to = map.get(l.to); }
    g.nodes.push(...ns); g.links.push(...ls); App.sel.nodes = new Set(ns.map(n => n.id)); App.structChanged('粘贴节点');
  },
  duplicateSel() { this.copySel(); this.paste(); },
  groupSel() {
    const g = this.graph; const sel = g.nodes.filter(n => App.sel.nodes.has(n.id) && !['groupIn', 'groupOut'].includes(n.type)); if (sel.length < 1) return App.toast('先选择要封装的节点');
    const ids = new Set(sel.map(n => n.id));
    const gi = { id: Model.nid(), type: 'groupIn', x: Math.min(...sel.map(n => n.x)) - 220, y: Math.min(...sel.map(n => n.y)), p: {}, ports: [] };
    const go = { id: Model.nid(), type: 'groupOut', x: Math.max(...sel.map(n => n.x)) + 240, y: Math.min(...sel.map(n => n.y)), p: {}, ports: [] };
    const grp = { id: Model.nid(), type: 'group', label: '节点组', x: sel.reduce((s, n) => s + n.x, 0) / sel.length, y: sel.reduce((s, n) => s + n.y, 0) / sel.length, p: {}, ports: { in: [], out: [] }, sub: { nodes: [gi, ...sel, go], links: [] } };
    const outLinks = [];
    for (const l of g.links) {
      const fi = ids.has(l.from), ti = ids.has(l.to);
      if (fi && ti) grp.sub.links.push(l);
      else if (!fi && ti) { // 外 → 内
        const tn = sel.find(n => n.id === l.to); const pt = NodeEval.ports(tn).in.find(p => p.n === l.ti); const pn = 'i' + grp.ports.in.length;
        grp.ports.in.push({ n: pn, t: pt.t, label: pt.label }); gi.ports.push({ n: pn, t: pt.t, label: pt.label });
        grp.sub.links.push({ id: Model.nid(), from: gi.id, fo: pn, to: l.to, ti: l.ti }); outLinks.push({ id: Model.nid(), from: l.from, fo: l.fo, to: grp.id, ti: pn });
      } else if (fi && !ti) { // 内 → 外
        const fn = sel.find(n => n.id === l.from); const pt = NodeEval.ports(fn).out.find(p => p.n === l.fo);
        let ex = grp.ports.out.find(p => p.src === fn.id + ':' + l.fo); let pn;
        if (!ex) { pn = 'o' + grp.ports.out.length; grp.ports.out.push({ n: pn, t: pt.t, label: pt.label, src: fn.id + ':' + l.fo }); go.ports.push({ n: pn, t: pt.t, label: pt.label }); grp.sub.links.push({ id: Model.nid(), from: l.from, fo: l.fo, to: go.id, ti: pn }); } else pn = ex.n;
        outLinks.push({ id: Model.nid(), from: grp.id, fo: pn, to: l.to, ti: l.ti });
      } else outLinks.push(l);
    }
    g.nodes = g.nodes.filter(n => !ids.has(n.id)); g.nodes.push(grp); g.links = outLinks; App.sel.nodes = new Set([grp.id]);
    App.structChanged('封装节点组'); App.toast('已封装为节点组（双击标题进入）');
  },
  ungroupSel() {
    const g = this.graph; const grp = g.nodes.find(n => App.sel.nodes.has(n.id) && n.type === 'group'); if (!grp) return App.toast('先选择一个节点组');
    const sub = grp.sub; const gi = sub.nodes.find(n => n.type === 'groupIn'), go = sub.nodes.find(n => n.type === 'groupOut');
    const inner = sub.nodes.filter(n => n !== gi && n !== go); const links = g.links.filter(l => l.from !== grp.id && l.to !== grp.id);
    for (const l of sub.links) {
      if (l.from === gi.id) { const ext = g.links.find(x => x.to === grp.id && x.ti === l.fo); if (ext) links.push({ id: Model.nid(), from: ext.from, fo: ext.fo, to: l.to, ti: l.ti }); }
      else if (l.to === go.id) { for (const ext of g.links.filter(x => x.from === grp.id && x.fo === l.ti)) links.push({ id: Model.nid(), from: l.from, fo: l.fo, to: ext.to, ti: ext.ti }); }
      else links.push(l);
    }
    g.nodes = g.nodes.filter(n => n !== grp).concat(inner); g.links = links; App.sel.nodes = new Set(inner.map(n => n.id)); App.structChanged('解散节点组');
  },
};
