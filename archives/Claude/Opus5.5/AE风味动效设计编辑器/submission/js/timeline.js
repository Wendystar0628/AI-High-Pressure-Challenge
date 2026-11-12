'use strict';
// ============ 时间轴：图层大纲、关键帧轨道、工作区与擦洗 ============
const Timeline = {
  mode: 'tl', pps: 80, t0: 0, expanded: new Set(), revealMap: new Map(), rows: [], widgets: [], snap: true, RH: 22, HEAD: 26,
  init() {
    this.left = document.getElementById('tlRows'); this.cv = document.getElementById('tlc'); this.ctx = this.cv.getContext('2d'); this.right = document.getElementById('tlRight');
    const tabs = document.getElementById('tlTabs');
    for (const [k, v] of [['tl', '时间轴'], ['graph', '曲线编辑器']]) { const t = U.el('div', { class: 'tab', 'data-m': k, text: v }); t.onclick = () => { this.mode = k; this.updTabs(); this.draw(); }; tabs.appendChild(t); }
    this.updTabs();
    const head = document.getElementById('tlLeftHead');
    head.append(U.el('span', { text: '#' }), U.el('span', { text: '图层名称' }), U.el('span', { text: '显 锁 独 3D 模糊' }), U.el('span', { text: '模式' }), U.el('span', { text: '父级' }));
    const btns = document.getElementById('tlBtns');
    btns.append(
      U.el('button', { class: 'tbtn on', id: 'btnSnap', title: '吸附（关键帧、播放头、入出点）', text: '吸附', onclick: e => { this.snap = !this.snap; e.target.classList.toggle('on', this.snap); } }),
      U.el('button', { class: 'tbtn', id: 'btnSpeed', title: '曲线编辑器：值曲线 / 速度曲线', text: '值曲线', onclick: e => { Graph.speed = !Graph.speed; e.target.textContent = Graph.speed ? '速度曲线' : '值曲线'; this.mode = 'graph'; this.updTabs(); this.draw(); } }),
      U.el('button', { class: 'tbtn', title: '曲线自动适配', text: '适配', onclick: () => { Graph.autoFit = true; this.draw(); } }),
      U.el('button', { class: 'tbtn', title: '缩小时间 (-)', text: '−', onclick: () => this.zoom(0.8) }),
      U.el('button', { class: 'tbtn', title: '放大时间 (=)', text: '＋', onclick: () => this.zoom(1.25) }),
      U.el('button', { class: 'tbtn', title: '显示整个合成', text: '全部', onclick: () => this.fitAll() }));
    new ResizeObserver(() => this.resize()).observe(this.right);
    this.left.addEventListener('scroll', () => this.draw());
    this.cv.addEventListener('mousedown', e => this.down(e));
    this.cv.addEventListener('mousemove', e => this.hover(e));
    this.cv.addEventListener('wheel', e => this.wheel(e), { passive: false });
    this.cv.addEventListener('contextmenu', e => { e.preventDefault(); this.ctxMenu(e); });
    this.cv.addEventListener('dblclick', e => this.dbl(e));
    document.getElementById('timelinePanel').addEventListener('mousedown', () => App.focus = 'timeline');
    this.resize();
  },
  updTabs() { document.querySelectorAll('#tlTabs .tab').forEach(t => t.classList.toggle('on', t.dataset.m === this.mode)); },
  resize() { const r = this.right.getBoundingClientRect(); const d = window.devicePixelRatio || 1; this.W = r.width; this.H = r.height; this.cv.width = Math.max(1, r.width * d); this.cv.height = Math.max(1, r.height * d); if (!this._fitted && this.W > 50) { this._fitted = true; this.fitAll(); } this.draw(); },
  fitAll() { if (!App.project) return; const c = App.comp; if (!c || !this.W) return; this.pps = (this.W - 30) / c.duration; this.t0 = -10 / this.pps; this.draw(); },
  zoom(f, aroundX) { const x = aroundX ?? this.tx(App.t); const tt = this.xt(x); this.pps = U.clamp(this.pps * f, 5, 4000); this.t0 = tt - x / this.pps; this.draw(); },
  tx(t) { return (t - this.t0) * this.pps; },
  xt(x) { return x / this.pps + this.t0; },
  // ---------- 行 ----------
  reveal(what, add) {
    const Ls = App.selLayers().length ? App.selLayers() : App.comp.layers;
    for (const L of Ls) {
      let set = add && this.revealMap.get(L.id) ? this.revealMap.get(L.id) : new Set();
      if (what === 'anim') { for (const f of Model.flatProps(L)) if (Anim.isAnimated(f.node.prop) || f.node.prop.xOn) set.add(f.node.prop.id); }
      else if (what === 'effects' || what === 'masks') { this.revealMap.delete(L.id); this.expanded.add(L.id + ''); this.expanded.add(L.id + '/' + what); continue; }
      else for (const f of Model.flatProps(L)) if (what.includes(f.node.key) && f.path[0] === '变换') set.add(f.node.prop.id);
      if (set.size) { this.revealMap.set(L.id, set); this.expanded.add(L.id + ''); } else this.revealMap.delete(L.id);
    }
    this.rebuild();
  },
  buildRows() {
    const rows = []; const c = App.comp;
    c.layers.forEach((L, li) => {
      rows.push({ type: 'layer', L, li, depth: 0 });
      if (!this.expanded.has(L.id + '')) return;
      const rv = this.revealMap.get(L.id);
      if (rv) { for (const f of Model.flatProps(L)) if (rv.has(f.node.prop.id)) { rows.push({ type: 'prop', L, node: f.node, depth: 1 }); if (f.node.prop.xOn) rows.push({ type: 'expr', L, node: f.node, depth: 1 }); } return; }
      const walk = (nodes, depth, path) => {
        for (const n of nodes) {
          const key = L.id + '/' + path + n.key + (n.obj ? ':' + n.obj.id : '');
          if (n.prop) { rows.push({ type: 'prop', L, node: n, depth }); if (n.prop.xOn) rows.push({ type: 'expr', L, node: n, depth }); continue; }
          rows.push({ type: 'group', L, node: n, depth, key });
          if (this.expanded.has(key)) walk(n.children || [], depth + 1, path + n.key + '/');
        }
      };
      walk(Model.tree(L, c), 1, '');
    });
    return rows;
  },
  rebuild() {
    const c = App.comp; if (!c) return;
    this.rows = this.buildRows(); this.widgets = [];
    const box = this.left; const st = box.scrollTop; box.innerHTML = '';
    for (const r of this.rows) box.appendChild(this.rowEl(r));
    box.appendChild(U.el('div', { style: { height: '60px' } }));
    box.scrollTop = st; this.draw();
  },
  rowEl(r) {
    const c = App.comp; const L = r.L; const selL = App.sel.layers.includes(L.id);
    if (r.type === 'layer') {
      const tw = U.el('span', { class: 'tw', text: this.expanded.has(L.id + '') ? '▼' : '▶' });
      tw.onclick = e => { e.stopPropagation(); const k = L.id + ''; this.expanded.has(k) ? this.expanded.delete(k) : this.expanded.add(k); this.revealMap.delete(L.id); this.rebuild(); };
      const nm = U.el('span', { class: 'nm', text: L.name, title: L.name });
      nm.ondblclick = e => { e.stopPropagation(); this.rename(nm, L); };
      const sw = (txt, on, tip, fn, extra = '') => { const s = U.el('span', { class: (on ? 'on ' : '') + extra, text: txt, title: tip }); s.onmousedown = e => { e.stopPropagation(); fn(); }; return s; };
      const sws = U.el('span', { class: 'sws' },
        sw(L.type === 'synth' ? '♪' : '◉', L.visible, L.type === 'synth' ? '音频开关' : '显示/隐藏', () => { L.visible = !L.visible; App.structChanged('显示开关'); }),
        sw('🔒', L.locked, '锁定', () => { L.locked = !L.locked; App.structChanged('锁定'); }),
        sw('●', L.solo, '独显', () => { L.solo = !L.solo; App.structChanged('独显'); }),
        sw('3D', L.threeD, '三维图层', () => { if (['geo', 'particles', 'camera', 'light', 'field'].includes(L.type)) return; L.threeD = !L.threeD; if (L.threeD && L.tr.position.v.length < 3) L.tr.position.v.push(0); App.structChanged('三维开关'); }),
        sw('◐', L.motionBlur, '运动模糊', () => { L.motionBlur = !L.motionBlur; App.structChanged('运动模糊'); }, 'mb'));
      const mode = Widgets.select(Model.BLEND_MODES, L.blendMode, v => { L.blendMode = v; App.structChanged('混合模式'); }, '');
      const par = {}; par[''] = '无'; for (const o of c.layers) if (o.id !== L.id) par[o.id] = o.name;
      const parent = Widgets.select(par, L.parent || '', v => App.setParent(L, v ? +v : null), '');
      const el = U.el('div', { class: 'trow layer' + (selL ? ' selected' : '') }, U.el('span', { class: 'lc', style: { background: Model.LABEL_COLORS[L.label % 12] } }), U.el('span', { class: 'num', text: r.li + 1 }), tw, nm, U.el('span', { class: 'ty', text: Model.LAYER_TYPES[L.type] }), sws, mode, parent);
      el.onmousedown = e => { if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return; App.selectLayer(L.id, e.shiftKey ? 'range' : e.ctrlKey ? 'toggle' : null); this.dragLayerOrder(e, L); };
      el.oncontextmenu = e => { e.preventDefault(); this.layerMenu(e, L); };
      el.draggable = false;
      return el;
    }
    const pad = 8 + r.depth * 14;
    if (r.type === 'group') {
      const open = this.expanded.has(r.key);
      const tw = U.el('span', { class: 'tw', text: open ? '▼' : '▶' });
      const el = U.el('div', { class: 'trow group', style: { paddingLeft: pad + 'px' } }, tw, U.el('span', { class: 'lab', text: r.node.label }));
      el.onclick = () => { open ? this.expanded.delete(r.key) : this.expanded.add(r.key); this.rebuild(); };
      el.oncontextmenu = e => { e.preventDefault(); this.groupMenu(e, r); };
      if (r.node.key === 'mask') el.ondblclick = () => Viewer.editPath(r.node.obj.path, L);
      return el;
    }
    if (r.type === 'expr') { const b = Widgets.exprBox(r.node.prop, r.node, L, c); this.widgets.push(b.update); const el = U.el('div', { class: 'trow exprow', style: { paddingLeft: pad + 18 + 'px' } }, b); return el; }
    const w = Widgets.propRow(r.node, L, c, { compact: true });
    this.widgets.push(w.update);
    const el = U.el('div', { class: 'trow prop' + (App.sel.props.has(r.node.prop.id) ? ' gsel' : ''), style: { paddingLeft: pad + 'px' } }, w.el.children[0], U.el('span', { class: 'lab', text: r.node.label }), w.parts);
    el.onmousedown = e => {
      if (e.target.closest('.scrub,.sw,.knav,.exbtn,input,textarea,button')) return;
      if (!e.shiftKey && !e.ctrlKey) App.sel.props.clear();
      const id = r.node.prop.id; App.sel.props.has(id) && e.ctrlKey ? App.sel.props.delete(id) : App.sel.props.add(id);
      // 选中属性的全部关键帧
      if (r.node.prop.k && !e.ctrlKey) { if (!e.shiftKey) App.sel.keys.clear(); r.node.prop.k.forEach(k => App.sel.keys.add(k)); }
      if (!App.sel.layers.includes(L.id)) App.sel.layers = [L.id];
      if (r.node.kind === 'path') Viewer.editPath(r.node.prop, L);
      this.rebuild(); Inspector.rebuild(); Viewer.drawOverlay();
    };
    return el;
  },
  rename(nm, L) {
    const inp = U.el('input', { class: 'rename', value: L.name }); nm.replaceWith(inp); inp.focus(); inp.select();
    const fin = ok => { if (ok && inp.value.trim()) { L.name = inp.value.trim(); App.structChanged('重命名图层'); } else this.rebuild(); };
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); }; inp.onblur = () => fin(true);
  },
  dragLayerOrder(e, L) {
    const y0 = e.clientY; const c = App.comp; let moved = false;
    const mv = ev => { if (Math.abs(ev.clientY - y0) > 6) moved = true; };
    const up = ev => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (!moved) return;
      const rowsEls = [...this.left.querySelectorAll('.trow.layer')]; let target = c.layers.length - 1;
      for (let i = 0; i < rowsEls.length; i++) { const r = rowsEls[i].getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { target = i; break; } }
      const from = c.layers.indexOf(L); c.layers.splice(from, 1); if (target > from) target--; c.layers.splice(U.clamp(target, 0, c.layers.length), 0, L);
      App.structChanged('调整图层顺序');
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  },
  layerMenu(e, L) {
    App.selectLayer(App.sel.layers.includes(L.id) ? null : L.id); if (!App.sel.layers.includes(L.id)) App.sel.layers = [L.id];
    Menus.show([
      ['重命名', () => { const el = [...this.left.querySelectorAll('.trow.layer .nm')][App.comp.layers.indexOf(L)]; if (el) this.rename(el, L); }],
      ['创建副本', () => App.duplicate(), 'Ctrl+D'], ['删除', () => App.deleteSelection(), 'Delete'], ['预合成', () => App.precompose(), 'Ctrl+Shift+C'], ['拆分', () => App.splitLayer(), 'Ctrl+Shift+D'],
      '-', { head: '轨道遮罩（使用上方图层）' }, ...Object.entries(Model.MATTE_MODES).map(([k, v]) => [(L.matte === k ? '✓ ' : '　') + v, () => { L.matte = k; App.structChanged('轨道遮罩'); }]),
      '-', ['上移一层', () => { const c = App.comp; const i = c.layers.indexOf(L); if (i > 0) { c.layers.splice(i, 1); c.layers.splice(i - 1, 0, L); App.structChanged('上移'); } }], ['下移一层', () => { const c = App.comp; const i = c.layers.indexOf(L); if (i < c.layers.length - 1) { c.layers.splice(i, 1); c.layers.splice(i + 1, 0, L); App.structChanged('下移'); } }],
      ['标签颜色', () => { L.label = (L.label + 1) % 12; App.structChanged('标签'); }],
    ], e.clientX, e.clientY);
  },
  groupMenu(e, r) {
    const L = r.L, n = r.node; const items = [];
    if (n.key === 'effect') { const i = L.effects.indexOf(n.obj); items.push(['上移效果', () => { if (i > 0) { L.effects.splice(i, 1); L.effects.splice(i - 1, 0, n.obj); App.structChanged('效果顺序'); } }], ['下移效果', () => { if (i < L.effects.length - 1) { L.effects.splice(i, 1); L.effects.splice(i + 1, 0, n.obj); App.structChanged('效果顺序'); } }], [n.obj.on ? '停用效果' : '启用效果', () => { n.obj.on = !n.obj.on; App.structChanged('效果开关'); }], ['删除效果', () => { L.effects.splice(i, 1); App.structChanged('删除效果'); }]); }
    if (n.key === 'mask') { const i = L.masks.indexOf(n.obj); items.push(['编辑蒙版路径', () => Viewer.editPath(n.obj.path, L)], [n.obj.inv ? '取消反转' : '反转', () => { n.obj.inv = !n.obj.inv; App.structChanged('蒙版反转'); }], ...['add', 'subtract', 'intersect', 'difference', 'none'].map(m => [(n.obj.mode === m ? '✓ ' : '　') + { add: '相加', subtract: '相减', intersect: '交集', difference: '差值', none: '无' }[m], () => { n.obj.mode = m; App.structChanged('蒙版模式'); }]), ['删除蒙版', () => { L.masks.splice(i, 1); App.structChanged('删除蒙版'); }]); }
    if (n.shapeItem) items.push(['上移', () => Inspector.moveShapeItem(L, n.obj, -1)], ['下移', () => Inspector.moveShapeItem(L, n.obj, 1)], [n.obj.on ? '停用' : '启用', () => { n.obj.on = !n.obj.on; App.structChanged('形状开关'); }], ['删除', () => Inspector.removeShapeItem(L, n.obj)]);
    if (n.key === 'animator') items.push(['删除动画制作工具', () => { L.text.animators = L.text.animators.filter(a => a !== n.obj); App.structChanged('删除动画器'); }]);
    if (items.length) Menus.show(items, e.clientX, e.clientY);
  },
  updateVals() { for (const u of this.widgets) u(); },
  // ---------- 绘制 ----------
  rowY(i) { return this.HEAD + i * this.RH - this.left.scrollTop; },
  draw() {
    if (!this.ctx || !App.comp) return;
    const c = this.ctx, d = window.devicePixelRatio || 1, W = this.W, H = this.H, comp = App.comp;
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H);
    c.font = '11px ' + getComputedStyle(document.body).fontFamily;
    this.keyHits = []; this.barHits = [];
    if (this.mode === 'graph') { Graph.draw(c, W, H); this.drawRuler(c, W, comp); this.drawPlayhead(c, H, comp); return; }
    // 行背景
    this.rows.forEach((r, i) => {
      const y = this.rowY(i); if (y + this.RH < this.HEAD || y > H) return;
      c.fillStyle = r.type === 'layer' ? '#1c1c20' : '#17171a'; c.fillRect(0, y, W, this.RH); c.fillStyle = '#1d1d21'; c.fillRect(0, y + this.RH - 1, W, 1);
      const L = r.L; const st = L.startTime;
      if (r.type === 'layer') {
        const x0 = this.tx(L.inPoint), x1 = this.tx(L.outPoint); const col = Model.LABEL_COLORS[L.label % 12]; const sel = App.sel.layers.includes(L.id);
        c.globalAlpha = sel ? 0.9 : 0.55; c.fillStyle = col; c.fillRect(x0, y + 3, x1 - x0, this.RH - 6); c.globalAlpha = 1;
        if (sel) { c.strokeStyle = '#fff'; c.strokeRect(x0 + 0.5, y + 3.5, x1 - x0 - 1, this.RH - 7); }
        c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x0, y + 3, 3, this.RH - 6); c.fillRect(x1 - 3, y + 3, 3, this.RH - 6);
        c.fillStyle = '#0d0d0f'; c.save(); c.beginPath(); c.rect(x0, y, x1 - x0, this.RH); c.clip(); c.fillText(L.name, Math.max(x0, 0) + 6, y + 15);
        if (L.type === 'synth') this.drawSynth(c, L, y, comp);
        if (L.type === 'precomp' && L.pre.remapOn) { c.fillStyle = '#fff'; c.fillText('⏱ 时间重映射', Math.max(x0, 0) + 6 + c.measureText(L.name).width + 10, y + 15); }
        c.restore();
        this.barHits.push({ L, y, x0, x1 });
        // 折叠时显示所有关键帧摘要
        if (!this.expanded.has(L.id + '')) { const ts = new Set(); for (const f of Model.flatProps(L)) if (f.node.prop.k) for (const k of f.node.prop.k) ts.add(k.t + st); c.fillStyle = 'rgba(255,255,255,0.75)'; for (const t of ts) { const x = this.tx(t); c.fillRect(x - 1, y + this.RH - 6, 2, 3); } }
      } else if (r.type === 'prop') {
        const p = r.node.prop;
        if (p.xOn && p.x) { c.strokeStyle = 'rgba(255,122,184,0.5)'; c.beginPath(); c.moveTo(this.tx(L.inPoint), y + this.RH / 2); c.lineTo(this.tx(L.outPoint), y + this.RH / 2); c.stroke(); }
        if (p.k) {
          for (let ki = 0; ki < p.k.length; ki++) { const k = p.k[ki]; const k2 = p.k[ki + 1]; if (k2 && k.oi !== 'hold') { c.strokeStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.moveTo(this.tx(k.t + st), y + this.RH / 2); c.lineTo(this.tx(k2.t + st), y + this.RH / 2); c.stroke(); } }
          for (const k of p.k) { const x = this.tx(k.t + st); if (x < -10 || x > W + 10) continue; this.drawKey(c, x, y + this.RH / 2, k, App.sel.keys.has(k)); this.keyHits.push({ x, y: y + this.RH / 2, k, p, L }); }
        }
      } else if (r.type === 'group') {
        const ts = new Set(); const walk = n => { if (n.prop && n.prop.k) n.prop.k.forEach(k => ts.add(k.t + st)); (n.children || []).forEach(walk); }; walk(r.node);
        c.fillStyle = 'rgba(255,255,255,0.35)'; for (const t of ts) { const x = this.tx(t); c.beginPath(); c.arc(x, y + this.RH / 2, 2, 0, 7); c.fill(); }
      }
    });
    // 入出点外区域
    c.fillStyle = 'rgba(0,0,0,0.35)'; const xe = this.tx(comp.duration); if (xe < W) c.fillRect(xe, this.HEAD, W - xe, H);
    this.drawRuler(c, W, comp);
    if (this.marquee) { const m = this.marquee; c.strokeStyle = '#ff8a3d'; c.setLineDash([3, 3]); c.strokeRect(m[0], m[1], m[2] - m[0], m[3] - m[1]); c.setLineDash([]); }
    this.drawPlayhead(c, H, comp);
  },
  drawKey(c, x, y, k, sel) {
    c.fillStyle = sel ? '#ff8a3d' : '#d9d3c8'; c.strokeStyle = '#000';
    const easeIn = k.ii === 'bezier', easeOut = k.oi === 'bezier', hold = k.oi === 'hold';
    c.beginPath();
    if (hold) { c.rect(x - 4, y - 5, 8, 10); }
    else if (easeIn || easeOut) { // 沙漏形
      c.moveTo(x, y); c.lineTo(x - (easeIn ? 3 : 5), y - 5); c.lineTo(x + (easeOut ? 3 : 5), y - 5); c.lineTo(x, y); c.lineTo(x + (easeOut ? 3 : 5), y + 5); c.lineTo(x - (easeIn ? 3 : 5), y + 5); c.closePath();
    } else { c.moveTo(x, y - 5.5); c.lineTo(x + 5.5, y); c.lineTo(x, y + 5.5); c.lineTo(x - 5.5, y); c.closePath(); }
    c.fill(); c.stroke();
  },
  drawSynth(c, L, y, comp) {
    // 包络
    const x0 = Math.max(0, this.tx(L.inPoint)), x1 = Math.min(this.W, this.tx(L.outPoint));
    c.fillStyle = 'rgba(10,10,10,0.35)'; c.beginPath(); c.moveTo(x0, y + this.RH - 3);
    for (let x = x0; x <= x1; x += 2) { const v = Synth.envAt(L, comp, this.xt(x)); c.lineTo(x, y + this.RH - 3 - Math.min(1, v) * (this.RH - 8)); }
    c.lineTo(x1, y + this.RH - 3); c.closePath(); c.fill();
    c.fillStyle = '#111';
    for (const n of L.synth.notes) { const x = this.tx(L.startTime + n.t); c.fillRect(x - 1, y + 3, 2, this.RH - 6); if (n.d && Synth.PRESETS[L.synth.preset]?.kind !== 'hit') { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + 5, n.d * this.pps, this.RH - 10); c.fillStyle = '#111'; } }
  },
  drawRuler(c, W, comp) {
    c.fillStyle = '#161619'; c.fillRect(0, 0, W, this.HEAD); c.fillStyle = '#2c2c33'; c.fillRect(0, this.HEAD - 1, W, 1);
    // 工作区
    const wa = this.tx(comp.workStart), wb = this.tx(comp.workEnd);
    c.fillStyle = 'rgba(255,138,61,0.28)'; c.fillRect(wa, 2, wb - wa, 7); c.fillStyle = '#ff8a3d'; c.fillRect(wa - 2, 1, 4, 9); c.fillRect(wb - 2, 1, 4, 9);
    // 刻度
    const fps = comp.fps; const steps = [1 / fps, 2 / fps, 5 / fps, 10 / fps, 0.5, 1, 2, 5, 10, 30, 60]; let st = steps.find(s => s * this.pps >= 60) || 60;
    c.fillStyle = '#8d8a86'; c.strokeStyle = '#3a3a43';
    const a = Math.floor(this.t0 / st) * st;
    for (let t = a; t < this.xt(W); t += st) { if (t < -1e-6) continue; const x = this.tx(t); c.beginPath(); c.moveTo(x + 0.5, 12); c.lineTo(x + 0.5, this.HEAD); c.stroke(); c.fillText(st < 1 ? U.fmtTime(t, fps) : t.toFixed(0) + 's', x + 3, 21); }
    const sub = st / 5; c.strokeStyle = '#2a2a30'; for (let t = a; t < this.xt(W); t += sub) { const x = this.tx(t); c.beginPath(); c.moveTo(x + 0.5, 19); c.lineTo(x + 0.5, this.HEAD); c.stroke(); }
  },
  drawPlayhead(c, H, comp) {
    const x = this.tx(App.t); c.strokeStyle = '#ff5a36'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H); c.stroke();
    c.fillStyle = '#ff5a36'; c.beginPath(); c.moveTo(x - 6, 0); c.lineTo(x + 6, 0); c.lineTo(x + 6, 8); c.lineTo(x, 14); c.lineTo(x - 6, 8); c.closePath(); c.fill();
  },
  // ---------- 交互 ----------
  mpos(e) { const r = this.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; },
  wheel(e) {
    e.preventDefault(); const [x] = this.mpos(e);
    if (e.ctrlKey || e.altKey) this.zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, x);
    else if (e.shiftKey) { this.t0 += e.deltaY / this.pps * 0.5; this.draw(); }
    else if (this.mode === 'graph' && !e.shiftKey && Graph.wheel(e)) { }
    else this.left.scrollTop += e.deltaY;
  },
  snapT(t, exclude) {
    const comp = App.comp; let best = Math.round(t * comp.fps) / comp.fps;
    if (!this.snap) return best;
    const cands = [App.t, comp.workStart, comp.workEnd]; for (const L of comp.layers) { cands.push(L.inPoint, L.outPoint); }
    for (const h of this.keyHits || []) if (!exclude || !exclude.has(h.k)) cands.push(h.k.t + h.L.startTime);
    let bd = 6 / this.pps; for (const c of cands) if (Math.abs(c - t) < bd) { bd = Math.abs(c - t); best = c; }
    return best;
  },
  hover(e) {
    if (this.mode === 'graph') return; const [x, y] = this.mpos(e);
    let cur = 'default'; if (y < this.HEAD) cur = 'col-resize';
    else { const k = this.hitKey(x, y); if (k) cur = 'pointer'; else { const b = this.hitBar(x, y); if (b) cur = b.edge ? 'ew-resize' : 'grab'; } }
    this.cv.style.cursor = cur;
  },
  hitKey(x, y) { let best = null, bd = 7; for (const h of this.keyHits || []) { const d = Math.max(Math.abs(h.x - x), Math.abs(h.y - y)); if (d < bd) { bd = d; best = h; } } return best; },
  hitBar(x, y) { for (const b of this.barHits || []) if (y >= b.y && y < b.y + this.RH && x >= b.x0 - 4 && x <= b.x1 + 4) { const edge = Math.abs(x - b.x0) < 6 ? 'in' : Math.abs(x - b.x1) < 6 ? 'out' : null; return Object.assign({ edge }, b); } return null; },
  dbl(e) { const [x, y] = this.mpos(e); if (this.mode === 'graph') return; const b = this.hitBar(x, y); if (b && b.L.type === 'precomp') App.openComp(b.L.pre.compId); },
  down(e) {
    App.focus = 'timeline';
    const [x, y] = this.mpos(e); const comp = App.comp;
    if (this.mode === 'graph' && y >= this.HEAD) return Graph.down(e, x, y);
    if (e.button === 2) return;
    if (y < this.HEAD) {
      // 工作区手柄
      const wa = this.tx(comp.workStart), wb = this.tx(comp.workEnd);
      if (y < 11 && (Math.abs(x - wa) < 6 || Math.abs(x - wb) < 6)) {
        const which = Math.abs(x - wa) < Math.abs(x - wb) ? 'workStart' : 'workEnd';
        const mv = ev => { const t = this.snapT(this.xt(this.mpos(ev)[0])); if (which === 'workStart') comp.workStart = U.clamp(t, 0, comp.workEnd - 0.05); else comp.workEnd = U.clamp(t, comp.workStart + 0.05, comp.duration); this.draw(); };
        const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); App.structChanged('工作区'); };
        addEventListener('mousemove', mv); addEventListener('mouseup', up); return;
      }
      // 擦洗
      App.setTime(this.xt(x));
      const mv = ev => App.setTime(this.xt(this.mpos(ev)[0]));
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up); return;
    }
    const hk = this.hitKey(x, y);
    if (hk) {
      if (e.ctrlKey) { App.sel.keys.has(hk.k) ? App.sel.keys.delete(hk.k) : App.sel.keys.add(hk.k); this.draw(); return; }
      if (!App.sel.keys.has(hk.k)) { if (!e.shiftKey) App.sel.keys.clear(); App.sel.keys.add(hk.k); }
      return this.dragKeys(e, x, hk);
    }
    const b = this.hitBar(x, y);
    if (b && !b.L.locked) { if (!App.sel.layers.includes(b.L.id)) App.selectLayer(b.L.id, e.shiftKey ? 'add' : null); return this.dragBar(e, x, b); }
    // 框选
    if (!e.shiftKey) App.sel.keys.clear();
    const x0 = x, y0 = y; this.marquee = [x, y, x, y];
    const mv = ev => { const [x2, y2] = this.mpos(ev); this.marquee = [Math.min(x0, x2), Math.min(y0, y2), Math.max(x0, x2), Math.max(y0, y2)]; this.draw(); };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); const m = this.marquee; this.marquee = null; if (m[2] - m[0] < 3 && m[3] - m[1] < 3) { App.setTime(this.xt(x0)); } for (const h of this.keyHits) if (h.x >= m[0] && h.x <= m[2] && h.y >= m[1] && h.y <= m[3]) App.sel.keys.add(h.k); this.draw(); App.request('view'); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  },
  dragKeys(e, x0, hk) {
    const list = App.keyList(); const orig = new Map(list.map(it => [it.k, it.k.t]));
    const minT = Math.min(...list.map(it => it.k.t + (it.layer ? it.layer.startTime : 0))), maxT = Math.max(...list.map(it => it.k.t + (it.layer ? it.layer.startTime : 0)));
    const stretch = e.altKey && list.length > 1; const anchorT = hk.k.t + hk.L.startTime;
    let moved = false;
    const mv = ev => {
      const [x] = this.mpos(ev); moved = true;
      if (stretch) {
        const pivot = Math.abs(anchorT - maxT) < 1e-6 ? minT : maxT; const nt = this.snapT(this.xt(x), App.sel.keys); const f = (nt - pivot) / ((anchorT - pivot) || 1e-6);
        for (const it of list) { const st = it.layer ? it.layer.startTime : 0; it.k.t = pivot + (orig.get(it.k) + st - pivot) * f - st; }
      } else {
        let dt = this.xt(x) - this.xt(x0); const nt = this.snapT(anchorT + dt, App.sel.keys); dt = nt - anchorT;
        for (const it of list) it.k.t = orig.get(it.k) + dt;
      }
      for (const p of new Set(list.map(it => it.p))) Anim.sortKeys(p);
      Anim.touch(); this.draw(); App.request('view', 'vals');
    };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (moved) { for (const p of new Set(list.map(it => it.p))) { const seen = new Map(); p.k = p.k.filter(k => { const key = Math.round(k.t * 1e4); if (seen.has(key) && !App.sel.keys.has(k)) return false; seen.set(key, k); return true; }); } App.edited(stretch ? '拉伸关键帧' : '移动关键帧'); } this.draw(); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  },
  dragBar(e, x0, b) {
    const Ls = b.edge ? [b.L] : App.selLayers(); const o = Ls.map(L => ({ L, i: L.inPoint, o: L.outPoint, s: L.startTime })); let moved = false;
    const mv = ev => {
      const [x] = this.mpos(ev); const dt0 = this.xt(x) - this.xt(x0); moved = true;
      for (const s of o) {
        if (b.edge === 'in') s.L.inPoint = U.clamp(this.snapT(s.i + dt0), -1e4, s.L.outPoint - 1 / App.comp.fps);
        else if (b.edge === 'out') s.L.outPoint = Math.max(this.snapT(s.o + dt0), s.L.inPoint + 1 / App.comp.fps);
        else { const nt = this.snapT(s.i + dt0); const d = nt - s.i; s.L.inPoint = s.i + d; s.L.outPoint = s.o + d; s.L.startTime = s.s + d; }
      }
      Anim.touch(); this.draw(); App.request('view');
    };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (moved) App.edited(b.edge ? '裁剪入出点' : '移动图层时间'); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  },
  ctxMenu(e) {
    const [x, y] = this.mpos(e); const hk = this.mode === 'tl' ? this.hitKey(x, y) : Graph.hitKey(x, y);
    if (hk && !App.sel.keys.has(hk.k)) { App.sel.keys.clear(); App.sel.keys.add(hk.k); this.draw(); }
    if (!App.sel.keys.size) return;
    Menus.show([{ head: `${App.sel.keys.size} 个关键帧` }, ['缓动 (F9)', () => App.ease('both')], ['缓入', () => App.ease('in')], ['缓出', () => App.ease('out')], ['线性', () => App.ease('linear')], ['贝塞尔', () => App.ease('bezier')], ['定格', () => App.ease('hold')], '-', ['空间：直线', () => App.spatial('linear')], ['空间：自动曲线', () => App.spatial('auto')], ['空间：独立手柄', () => App.spatial('manual')], '-', ['时间拉伸…', () => { const v = prompt('拉伸比例（%）', '150'); if (v) App.stretchKeys(parseFloat(v) / 100); }], ['复制', () => App.copy()], ['删除', () => App.deleteSelection()]], e.clientX, e.clientY);
  },
};
