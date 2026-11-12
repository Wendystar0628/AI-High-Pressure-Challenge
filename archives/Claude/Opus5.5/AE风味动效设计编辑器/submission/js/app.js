'use strict';
// ============ 应用状态、撤销、播放、命令与菜单 ============
const History = {
  stack: [], idx: -1, labels: [],
  init() { this.stack = [Model.json(App.project)]; this.labels = ['初始']; this.idx = 0; },
  commit(label = '编辑') {
    const j = Model.json(App.project);
    if (j === this.stack[this.idx]) return false;
    this.stack = this.stack.slice(0, this.idx + 1); this.labels = this.labels.slice(0, this.idx + 1);
    this.stack.push(j); this.labels.push(label); this.idx++;
    if (this.stack.length > 150) { this.stack.shift(); this.labels.shift(); this.idx--; }
    App.updateHistBtns(); return true;
  },
  undo() { if (this.idx <= 0) return App.toast('没有可撤销的操作'); const l = this.labels[this.idx]; this.idx--; this.restore(); App.toast('撤销：' + l); },
  redo() { if (this.idx >= this.stack.length - 1) return App.toast('没有可重做的操作'); this.idx++; this.restore(); App.toast('重做：' + this.labels[this.idx]); },
  restore() {
    const p = JSON.parse(this.stack[this.idx]);
    App.setProject(p, true);
    App.updateHistBtns();
  },
};

const App = {
  project: null, compId: null, times: {}, playing: false, loop: true, tool: 'select', focus: 'viewer',
  sel: { layers: [], props: new Set(), keys: new Set(), nodes: new Set() },
  flags: new Set(), exportMode: false, clip: null, showGuides: true, checker: false,
  get comp() { if (!this.project) return null; return Model.findComp(this.project, this.compId) || this.project.comps[0]; },
  get t() { return this.times[this.compId] || 0; },
  // ---------- 工程 ----------
  setProject(p, keepUI) {
    this.project = p; Anim.project = p; Model._id = Model.maxId(p) + 1;
    if (!keepUI || !Model.findComp(p, this.compId)) { this.compId = p.activeComp || p.comps[0].id; if (!keepUI) { this.times = {}; this.sel.layers = []; } }
    const c = this.comp; this.sel.layers = this.sel.layers.filter(id => Model.findLayer(c, id)); this.sel.keys.clear(); this.sel.nodes.clear();
    this.openComps = (this.openComps || []).filter(id => Model.findComp(p, id)); if (!this.openComps.includes(this.compId)) this.openComps.push(this.compId);
    Anim.touch(); Particles.invalidateAll();
    this.request('struct');
  },
  openComp(id) { if (this.playing) this.pause(); this.compId = id; this.project.activeComp = id; if (!this.openComps.includes(id)) this.openComps.push(id); this.sel.layers = []; this.sel.keys.clear(); this.sel.props.clear(); NodeView.path = []; this.request('struct'); Viewer.fit(); },
  // ---------- 刷新调度 ----------
  request(...f) { for (const x of f) this.flags.add(x); if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this.flush(); }); },
  flush() {
    const F = this.flags; this.flags = new Set();
    try {
      if (F.has('struct')) { ProjectPanel.rebuild(); Timeline.rebuild(); Inspector.rebuild(); NodeView.rebuild(); Viewer.updateTabs(); F.add('view'); F.add('tl'); }
      if (F.has('insp')) Inspector.rebuild();
      if (F.has('nodes')) NodeView.rebuild();
      if (F.has('view') || F.has('time')) Viewer.render();
      if (F.has('tl') || F.has('time')) Timeline.draw();
      if (F.has('time') || F.has('vals')) { Inspector.update(); Timeline.updateVals(); NodeView.update(); this.updateTC(); }
    } catch (e) { console.error(e); this.status('错误：' + e.message); }
  },
  // 修改了值（未改结构）
  edited(commitLabel) { Anim.touch(); this.request('view', 'tl', 'vals'); if (commitLabel) History.commit(commitLabel); },
  structChanged(label) { Anim.touch(); this.request('struct'); if (label) History.commit(label); },
  // ---------- 时间 ----------
  frameDur() { return 1 / this.comp.fps; },
  snapT(t) { const f = this.comp.fps; return Math.round(t * f) / f; },
  setTime(t, opts = {}) {
    const c = this.comp; t = U.clamp(t, 0, c.duration - (opts.allowEnd ? 0 : 1e-6));
    if (!opts.raw) t = U.clamp(this.snapT(t), 0, c.duration - 1 / c.fps * 0.001);
    this.times[c.id] = t;
    if (this.playing && !opts.fromPlay) { this.pause(); }
    this.request('time');
  },
  // ---------- 播放 ----------
  play() {
    const c = this.comp; if (this.playing) return;
    Synth.unlock();
    let t = this.t; if (t >= c.workEnd - 1 / c.fps || t < c.workStart - 1e-6) t = c.workStart;
    this.playing = true; this.playFrom = t; this.playWall = performance.now(); this.times[c.id] = t;
    const s = Synth.start(c, t, c.workEnd); this.playAudio = s ? Synth.now() + 0.06 : null;
    this.updateTransport(); this.tick();
  },
  pause() { if (!this.playing) return; this.playing = false; Synth.stop(); this.times[this.compId] = this.snapT(this.t); this.updateTransport(); this.request('time', 'vals'); },
  toggle() { this.playing ? this.pause() : this.play(); },
  tick() {
    if (!this.playing) return;
    requestAnimationFrame(() => this.tick());
    if (this.exportMode) return;
    const c = this.comp;
    let el = this.playAudio != null && Synth.ctx ? Math.max(0, Synth.now() - this.playAudio) : (performance.now() - this.playWall) / 1000;
    let t = this.playFrom + el;
    if (t >= c.workEnd) {
      if (this.loop) { this.playFrom = c.workStart; this.playWall = performance.now(); const s = Synth.start(c, c.workStart, c.workEnd); this.playAudio = s ? Synth.now() + 0.06 : null; t = c.workStart; }
      else { this.times[c.id] = c.workEnd - 1 / c.fps; this.pause(); return; }
    }
    const q = Math.floor(t * c.fps + 1e-6) / c.fps;
    if (q !== this.times[c.id]) { this.times[c.id] = q; this.request('time'); }
  },
  // ---------- 选择 ----------
  selLayers() { const c = this.comp; return this.sel.layers.map(id => Model.findLayer(c, id)).filter(Boolean); },
  selectLayer(id, mode) {
    const s = this.sel.layers;
    if (mode === 'add') { if (!s.includes(id)) s.push(id); }
    else if (mode === 'toggle') { const i = s.indexOf(id); if (i >= 0) s.splice(i, 1); else s.push(id); }
    else if (mode === 'range' && s.length) { const Ls = this.comp.layers; const a = Ls.findIndex(l => l.id === s[s.length - 1]), b = Ls.findIndex(l => l.id === id); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (!s.includes(Ls[i].id)) s.push(Ls[i].id); }
    else { this.sel.layers = id ? [id] : []; }
    this.request('struct');
  },
  // ---------- 工具 ----------
  setTool(t) { this.tool = t; Toolbar.refresh(); Viewer.cancelPen && Viewer.cancelPen(); Viewer.hint(); Viewer.drawOverlay(); },
  toast(msg) { const e = document.getElementById('toast'); e.textContent = msg; e.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => e.classList.remove('show'), 1800); },
  status(msg) { document.getElementById('stLeft').textContent = msg; },
  updateTC() { const c = this.comp; document.getElementById('tcode').textContent = U.fmtTime(this.t, c.fps) + `  (${Math.round(this.t * c.fps)})`; },
  updateHistBtns() { const b = document.getElementById('histbtns'); if (!b) return; b.children[0] && (b.children[0].style.opacity = History.idx > 0 ? 1 : .35); b.children[1] && (b.children[1].style.opacity = History.idx < History.stack.length - 1 ? 1 : .35); },
  updateTransport() { const b = document.getElementById('btnPlay'); if (b) b.innerHTML = this.playing ? Icons.pause : Icons.play; const l = document.getElementById('btnLoop'); if (l) l.classList.toggle('on', this.loop); },

  // ---------- 命令 ----------
  newLayer(type, opts = {}) {
    const c = this.comp; const L = Model.newLayer(type, c, opts.name);
    L.inPoint = 0; L.outPoint = c.duration;
    if (type === 'shape' && !opts.empty) {
      const g = Model.newShapeItem('group', { name: '矩形 1' }); g.items.push(Model.newShapeItem('rect', { size: [360, 240] }), Model.newShapeItem('fill', { color: [1, 0.55, 0.2] }));
      L.contents.push(g); L.tr.position.v = [c.width / 2, c.height / 2, 0];
    }
    if (type === 'text') { L.tr.position.v = [c.width / 2, c.height / 2 + 60, 0]; }
    if (type === 'particles') { L.ps.emitters[0].pos.v = [c.width / 2, c.height / 2, 0]; L.ps.collide.groundY.v = c.height * 0.85; }
    if (type === 'field') { L.tr.position.v = [c.width / 2, c.height / 2, 0]; }
    if (type === 'geo') { L.tr.position.v = [c.width / 2, c.height / 2, 0]; }
    if (type === 'synth') { L.synth.notes = [{ t: 0.5, n: 48, v: 1, d: 0.5 }, { t: 1.5, n: 48, v: 0.8, d: 0.5 }]; }
    if (type === 'precomp') { L.pre.compId = opts.compId; const s = Model.findComp(this.project, opts.compId); if (s) { L.tr.anchor.v = [s.width / 2, s.height / 2, 0]; L.name = s.name; } }
    Object.assign(L, opts.patch || {});
    const idx = this.sel.layers.length ? Math.max(0, c.layers.findIndex(l => l.id === this.sel.layers[0])) : 0;
    c.layers.splice(idx, 0, L);
    this.sel.layers = [L.id];
    this.structChanged('新建' + Model.LAYER_TYPES[type] + '图层');
    return L;
  },
  deleteSelection() {
    if (this.focus === 'nodes' && this.sel.nodes.size) return NodeView.deleteSel();
    if (this.sel.keys.size) { for (const { p, k } of this.keyList()) Anim.removeKey(p, k); this.sel.keys.clear(); return this.structChanged('删除关键帧'); }
    const c = this.comp; const ids = new Set(this.sel.layers); if (!ids.size) return;
    c.layers = c.layers.filter(l => !ids.has(l.id));
    for (const l of c.layers) if (ids.has(l.parent)) l.parent = null;
    this.sel.layers = []; this.structChanged('删除图层');
  },
  // 已选关键帧 → [{p,k,layer}]
  keyList() {
    const out = []; const c = this.comp;
    for (const L of c.layers) for (const f of Model.flatProps(L)) { const p = f.node.prop; if (p.k) for (const k of p.k) if (this.sel.keys.has(k)) out.push({ p, k, layer: L, node: f.node }); }
    for (const n of c.graph.nodes) for (const key in n.p) { const p = n.p[key]; if (Model.isProp(p) && p.k) for (const k of p.k) if (this.sel.keys.has(k)) out.push({ p, k, layer: null }); }
    return out;
  },
  duplicate() {
    if (this.focus === 'nodes' && this.sel.nodes.size) return NodeView.duplicateSel();
    const c = this.comp; const Ls = this.selLayers(); if (!Ls.length) return;
    const news = [];
    for (const L of Ls) { const d = JSON.parse(Model.json(L)); Model.reId(d); d.name = this.uniqueName(c, L.name); const i = c.layers.indexOf(L); c.layers.splice(i, 0, d); news.push(d.id); }
    this.sel.layers = news; this.structChanged('复制图层');
  },
  uniqueName(c, base) { const m = base.match(/^(.*?)(\s*\d+)?$/); const stem = m[1].trim(); let i = 2; let n; do { n = `${stem} ${i++}`; } while (c.layers.some(l => l.name === n)); return n; },
  copy() {
    if (this.focus === 'nodes' && this.sel.nodes.size) return NodeView.copySel();
    if (this.sel.keys.size) {
      const list = this.keyList(); const t0 = Math.min(...list.map(x => x.k.t + (x.layer ? x.layer.startTime : 0)));
      const groups = new Map(); for (const x of list) { if (!groups.has(x.p.id)) groups.set(x.p.id, { pid: x.p.id, keys: [], spatial: x.k.sp !== undefined }); groups.get(x.p.id).keys.push(Object.assign(U.clone(x.k), { t: x.k.t + (x.layer ? x.layer.startTime : 0) - t0 })); }
      this.clip = { kind: 'keys', groups: [...groups.values()] }; return this.toast(`已复制 ${list.length} 个关键帧`);
    }
    const Ls = this.selLayers(); if (Ls.length) { this.clip = { kind: 'layers', data: Ls.map(l => Model.json(l)) }; this.toast(`已复制 ${Ls.length} 个图层`); }
  },
  paste() {
    if (!this.clip) return;
    if (this.clip.kind === 'nodes') return NodeView.paste();
    const c = this.comp;
    if (this.clip.kind === 'keys') {
      const targets = [...this.sel.props];
      let n = 0;
      this.clip.groups.forEach((g, gi) => {
        let pid = g.pid; if (this.clip.groups.length === 1 && targets.length === 1) pid = targets[0];
        const o = Model.findPropOwner(c, pid); if (!o) return;
        const p = o.node.prop; const st = o.layer.startTime;
        for (const k of g.keys) { const nk = Anim.addKey(p, this.t - st + k.t, k.v, g.spatial); Object.assign(nk, U.clone(k), { t: this.t - st + k.t }); this.sel.keys.add(nk); n++; }
        Anim.sortKeys(p);
      });
      this.sel.keys = new Set(this.keyList().map(x => x.k));
      return this.structChanged(`粘贴 ${n} 个关键帧`);
    }
    if (this.clip.kind === 'layers') {
      const ids = []; for (const s of this.clip.data) { const d = JSON.parse(s); Model.reId(d); if (c.layers.some(l => l.name === d.name)) d.name = this.uniqueName(c, d.name); c.layers.unshift(d); ids.push(d.id); }
      this.sel.layers = ids; this.structChanged('粘贴图层');
    }
  },
  selectAll() { if (this.focus === 'nodes') return NodeView.selectAll(); this.sel.layers = this.comp.layers.map(l => l.id); this.request('struct'); },
  // 缓动
  ease(mode) {
    const list = this.keyList(); if (!list.length) return this.toast('请先在时间轴中选择关键帧');
    for (const x of list) { if (mode === 'linear' || mode === 'hold' || mode === 'bezier') Anim.setInterp(x.k, mode); else Anim.easyEase(x.p, x.k, mode); }
    this.structChanged({ both: '缓动', in: '缓入', out: '缓出', linear: '线性插值', hold: '定格插值', bezier: '贝塞尔插值' }[mode]);
  },
  spatial(mode) {
    const list = this.keyList().filter(x => x.k.sp !== undefined); if (!list.length) return this.toast('请选择位置类关键帧');
    for (const x of list) { if (mode === 'manual') { const i = x.p.k.indexOf(x.k); const tg = Anim.spatialTangents(x.p, i); x.k.ti = tg.ti.slice(); x.k.to = tg.to.slice(); } x.k.sp = mode; }
    this.structChanged('空间插值');
  },
  // 时间伸缩已选关键帧
  stretchKeys(f) {
    const list = this.keyList(); if (list.length < 2) return this.toast('至少选择两个关键帧');
    const t0 = Math.min(...list.map(x => x.k.t));
    for (const x of list) x.k.t = t0 + (x.k.t - t0) * f;
    for (const p of new Set(list.map(x => x.p))) Anim.sortKeys(p);
    this.structChanged('按比例拉伸关键帧');
  },
  // 跳到上/下一个关键帧
  jumpKey(dir) {
    const c = this.comp; const Ls = this.selLayers().length ? this.selLayers() : c.layers; const ts = [];
    for (const L of Ls) for (const f of Model.flatProps(L)) if (f.node.prop.k) for (const k of f.node.prop.k) ts.push(k.t + L.startTime);
    const t = this.t; const cand = dir > 0 ? ts.filter(x => x > t + 1e-4).sort((a, b) => a - b)[0] : ts.filter(x => x < t - 1e-4).sort((a, b) => b - a)[0];
    if (cand !== undefined) this.setTime(cand);
  },
  // 预合成（原位）
  precompose() {
    const c = this.comp; const Ls = this.selLayers(); if (!Ls.length) return this.toast('请先选择要预合成的图层');
    const ids = new Set(Ls.map(l => l.id));
    const nc = Model.newComp(this.uniqueCompName(Ls.length === 1 ? Ls[0].name + ' 合成' : '预合成 1'), c.width, c.height, c.fps, c.duration);
    nc.mb = U.clone(c.mb); nc.env = U.clone(c.env); nc.bg = c.bg.slice();
    const moved = c.layers.filter(l => ids.has(l.id));
    // 父级在外部：复制父级链为隐藏空对象（保持父级动画）
    const extraParents = new Map();
    const needParent = (pid) => {
      if (!pid || ids.has(pid) || extraParents.has(pid)) return;
      const P = Model.findLayer(c, pid); if (!P) return;
      const d = JSON.parse(Model.json(P)); const oldId = d.id; Model.reId(d); d.type = 'null'; d.name = P.name + '（父级）'; d.visible = true;
      for (const k of ['contents', 'text', 'solid', 'adj', 'pre', 'cam', 'light', 'geo', 'mat', 'ps', 'synth', 'field']) delete d[k];
      d.masks = []; d.effects = []; d.matte = 'none';
      extraParents.set(pid, d); needParent(P.parent); d.parent = P.parent ? (extraParents.get(P.parent) || {}).id || null : null;
    };
    for (const L of moved) needParent(L.parent);
    for (const L of moved) if (L.parent && extraParents.has(L.parent)) L.parent = extraParents.get(L.parent).id;
    // 场景元素：摄像机与灯光一并复制
    const has3D = moved.some(l => Render.is3D(l));
    const copies3D = has3D ? c.layers.filter(l => (l.type === 'camera' || l.type === 'light') && !ids.has(l.id)).map(l => { const d = JSON.parse(Model.json(l)); Model.reId(d); return d; }) : [];
    nc.layers = [...copies3D, ...moved, ...extraParents.values()];
    // 外部子层：父级在预合成里 → 在外部建空对象副本
    const outerNull = new Map();
    for (const l of c.layers) if (!ids.has(l.id) && l.parent && ids.has(l.parent)) {
      if (!outerNull.has(l.parent)) { const P = Model.findLayer(c, l.parent); const d = JSON.parse(Model.json(P)); Model.reId(d); d.type = 'null'; d.name = P.name + '（父级）'; for (const k of ['contents', 'text', 'solid', 'adj', 'pre', 'geo', 'mat', 'ps', 'synth', 'field']) delete d[k]; d.masks = []; d.effects = []; outerNull.set(l.parent, d); }
      l.parent = outerNull.get(l.parent).id;
    }
    const idx = c.layers.findIndex(l => ids.has(l.id));
    const PL = Model.newLayer('precomp', c, nc.name); PL.pre.compId = nc.id; PL.tr.anchor.v = [c.width / 2, c.height / 2, 0]; PL.tr.position.v = [c.width / 2, c.height / 2, 0];
    PL.inPoint = Math.min(...moved.map(l => l.inPoint)); PL.outPoint = Math.max(...moved.map(l => l.outPoint));
    if (moved.length === 1) { PL.blendMode = moved[0].blendMode; moved[0].blendMode = 'normal'; PL.motionBlur = moved[0].motionBlur; }
    c.layers = c.layers.filter(l => !ids.has(l.id)); c.layers.splice(Math.max(0, idx), 0, PL, ...outerNull.values());
    this.project.comps.push(nc); this.sel.layers = [PL.id];
    this.structChanged('预合成'); this.toast(`已预合成为「${nc.name}」`);
  },
  uniqueCompName(n) { let s = n, i = 2; while (this.project.comps.some(c => c.name === s)) s = n.replace(/\s*\d*$/, '') + ' ' + i++; return s; },
  newComp() { const c = this.comp; const nc = Model.newComp(this.uniqueCompName('合成 1'), c ? c.width : 1920, c ? c.height : 1080, c ? c.fps : 30, 10); this.project.comps.push(nc); this.openComp(nc.id); History.commit('新建合成'); },
  splitLayer() {
    const c = this.comp; const t = this.t; const ids = [];
    for (const L of this.selLayers()) { if (t <= L.inPoint || t >= L.outPoint) continue; const d = JSON.parse(Model.json(L)); Model.reId(d); d.inPoint = t; L.outPoint = t; c.layers.splice(c.layers.indexOf(L), 0, d); ids.push(d.id); }
    if (ids.length) { this.sel.layers = ids; this.structChanged('拆分图层'); }
  },
  trim(which, move) {
    const t = this.t;
    for (const L of this.selLayers()) {
      if (move) { const d = which === 'in' ? t - L.inPoint : t - L.outPoint; L.inPoint += d; L.outPoint += d; L.startTime += d; }
      else if (which === 'in') L.inPoint = Math.min(t, L.outPoint - this.frameDur()); else L.outPoint = Math.max(t + this.frameDur(), L.inPoint + this.frameDur());
    }
    this.structChanged(move ? '移动图层' : '裁剪入出点');
  },
  // 设定父级（保留当前画面）
  setParent(L, pid) {
    const c = this.comp, t = this.t;
    if (pid === L.id) return;
    // 防止环
    let x = pid ? Model.findLayer(c, pid) : null, g = 0; while (x && g++ < 50) { if (x.id === L.id) return this.toast('不能形成父级循环'); x = x.parent ? Model.findLayer(c, x.parent) : null; }
    const W = Xform.layerMatrix(c, L, t);
    const oldP = Xform.parentMatrix(c, L, t);
    L.parent = pid || null; Anim.touch();
    const newP = Xform.parentMatrix(c, L, t);
    // 位置：所有关键帧经 inv(newP)·oldP 变换；旋转、缩放按差值补偿
    const T = M4.mul(M4.invert(newP), oldP);
    const dOld = M4.decompose2D(oldP), dNew = M4.decompose2D(newP);
    const mapPos = v => { const q = M4.pt(T, v); return L.threeD ? q : [q[0], q[1], v[2] || 0]; };
    const p = L.tr.position; if (p.k) p.k.forEach(k => { k.v = mapPos(k.v); if (k.ti) k.ti = M4.dir(T, [...k.ti, 0].slice(0, 3)).slice(0, k.ti.length); if (k.to) k.to = M4.dir(T, [...k.to, 0].slice(0, 3)).slice(0, k.to.length); }); else p.v = mapPos(p.v);
    const dr = dOld.rot - dNew.rot; const r = L.tr.rotation; if (r.k) r.k.forEach(k => k.v += dr); else r.v += dr;
    const sx = dOld.sx / (dNew.sx || 1), sy = dOld.sy / (dNew.sy || 1); const s = L.tr.scale; const fs = v => [v[0] * sx, v[1] * sy, v[2]]; if (s.k) s.k.forEach(k => k.v = fs(k.v)); else s.v = fs(s.v);
    this.structChanged(pid ? '设定父级' : '解除父级');
  },
  // ---------- 文件 ----------
  save() {
    const data = { app: '锻炉动效编辑器', format: 1, project: JSON.parse(Model.json(this.project)), ui: { times: this.times, compId: this.compId } };
    const s = JSON.stringify(data);
    try { localStorage.setItem('duanlu.autosave', s); } catch (e) { }
    U.download((this.project.name || '工程') + '.dzae.json', s);
    this.toast('工程已保存（已下载文件，并存入浏览器）');
  },
  load(text) {
    try {
      const d = JSON.parse(text); const p = d.project || d; if (!p.comps) throw new Error('不是有效的工程文件');
      if (this.playing) this.pause();
      this.setProject(p, false); if (d.ui) { this.times = d.ui.times || {}; if (d.ui.compId && Model.findComp(p, d.ui.compId)) this.compId = d.ui.compId; }
      History.init(); Viewer.fit(); this.request('struct'); this.toast('工程已打开');
    } catch (e) { alert('打开失败：' + e.message); }
  },
  openFile() { const f = document.getElementById('fileIn'); f.value = ''; f.onchange = () => { const file = f.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => this.load(r.result); r.readAsText(file); }; f.click(); },
  newProject() { if (this.playing) this.pause(); this.setProject(Model.newProject(), false); History.init(); Viewer.fit(); this.toast('已新建空工程'); },
  loadDemo() { if (this.playing) this.pause(); this.setProject(Demo.build(), false); this.times = {}; this.sel.layers = []; History.init(); Viewer.fit(); this.request('struct'); },
  restoreLocal() { const s = localStorage.getItem('duanlu.autosave'); if (!s) return this.toast('浏览器中没有保存的工程'); this.load(s); },
};

// ============ 图标 ============
const Icons = {
  play: '<svg viewBox="0 0 16 16"><path d="M4 2.5l9 5.5-9 5.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" stroke="none"/></svg>',
  first: '<svg viewBox="0 0 16 16"><path d="M3 2.5v11M13 2.5L5 8l8 5.5z" /></svg>',
  last: '<svg viewBox="0 0 16 16"><path d="M13 2.5v11M3 2.5L11 8l-8 5.5z" /></svg>',
  prev: '<svg viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" /></svg>',
  next: '<svg viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" /></svg>',
  loop: '<svg viewBox="0 0 16 16"><path d="M3 7a4 4 0 014-4h5l-2-2M13 9a4 4 0 01-4 4H4l2 2" /></svg>',
  undo: '<svg viewBox="0 0 16 16"><path d="M5 3L2 6l3 3M2 6h8a4 4 0 010 8H6" /></svg>',
  redo: '<svg viewBox="0 0 16 16"><path d="M11 3l3 3-3 3M14 6H6a4 4 0 000 8h4" /></svg>',
  select: '<svg viewBox="0 0 16 16"><path d="M3 2l9 6-4 1 2.5 4.5-1.6.9L6.4 10 3 13z" fill="currentColor" stroke="none"/></svg>',
  hand: '<svg viewBox="0 0 16 16"><path d="M5 8V3.5a1 1 0 012 0V7m0-4a1 1 0 012 0v4m0-3a1 1 0 012 0v4m0-2a1 1 0 012 0v4c0 3-2 5-5 5s-4-1.5-5.5-4L2 9.5a1 1 0 011.6-1.2L5 10" /></svg>',
  zoom: '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14M5 7h4M7 5v4"/></svg>',
  rotate: '<svg viewBox="0 0 16 16"><path d="M13 8a5 5 0 11-1.5-3.5M12 2v3H9"/></svg>',
  anchor: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4"/><path d="M8 1v4M8 11v4M1 8h4M11 8h4"/></svg>',
  rect: '<svg viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="9" rx="1"/></svg>',
  ellipse: '<svg viewBox="0 0 16 16"><ellipse cx="8" cy="8" rx="5.5" ry="4.5"/></svg>',
  pen: '<svg viewBox="0 0 16 16"><path d="M3 13l2-6 6-4 2 2-4 6-6 2zM3 13l4-4"/><circle cx="8" cy="8" r="1"/></svg>',
  text: '<svg viewBox="0 0 16 16"><path d="M3 3h10M8 3v10M6 13h4"/></svg>',
  pin: '<svg viewBox="0 0 16 16"><path d="M8 14V8"/><circle cx="8" cy="5" r="3" fill="currentColor"/></svg>',
  orbit: '<svg viewBox="0 0 16 16"><ellipse cx="8" cy="8" rx="6" ry="2.5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>',
};

// ============ 工具栏与菜单 ============
const Toolbar = {
  TOOLS: [['select', '选择工具 (V)'], ['hand', '手形工具 (H)'], ['zoom', '缩放工具 (Z)'], ['rotate', '旋转工具 (W)'], ['anchor', '锚点工具 (Y)'], ['rect', '矩形工具 (Q)'], ['ellipse', '椭圆工具 (Q)'], ['pen', '钢笔工具 (G)'], ['text', '文字工具 (Ctrl+T)'], ['pin', '图钉工具 (Ctrl+P)'], ['orbit', '摄像机轨道工具 (C)']],
  init() {
    const tb = document.getElementById('tools');
    for (const [id, tip] of this.TOOLS) tb.appendChild(U.el('button', { class: 'tbtn', title: tip, 'data-tool': id, html: Icons[id], onclick: () => App.setTool(id) }));
    const tr = document.getElementById('transport');
    tr.append(
      U.el('button', { class: 'tbtn', title: '到开头 (Home)', html: Icons.first, onclick: () => App.setTime(App.comp.workStart) }),
      U.el('button', { class: 'tbtn', title: '上一帧 (PageUp)', html: Icons.prev, onclick: () => App.setTime(App.t - App.frameDur()) }),
      U.el('button', { class: 'tbtn', id: 'btnPlay', title: '播放/暂停 (空格)', html: Icons.play, onclick: () => App.toggle() }),
      U.el('button', { class: 'tbtn', title: '下一帧 (PageDown)', html: Icons.next, onclick: () => App.setTime(App.t + App.frameDur()) }),
      U.el('button', { class: 'tbtn', title: '到结尾 (End)', html: Icons.last, onclick: () => App.setTime(App.comp.duration) }),
      U.el('button', { class: 'tbtn on', id: 'btnLoop', title: '循环工作区', html: Icons.loop, onclick: () => { App.loop = !App.loop; App.updateTransport(); } }));
    const hb = document.getElementById('histbtns');
    hb.append(U.el('button', { class: 'tbtn', title: '撤销 (Ctrl+Z)', html: Icons.undo, onclick: () => History.undo() }), U.el('button', { class: 'tbtn', title: '重做 (Ctrl+Shift+Z / Ctrl+Y)', html: Icons.redo, onclick: () => History.redo() }));
    this.refresh(); Menus.init();
  },
  refresh() { document.querySelectorAll('#tools .tbtn').forEach(b => b.classList.toggle('on', b.dataset.tool === App.tool)); },
};

const Menus = {
  init() {
    const m = document.getElementById('menus');
    for (const [name, fn] of Object.entries(this.defs())) { const e = U.el('div', { class: 'm', text: name }); e.addEventListener('mousedown', ev => { ev.stopPropagation(); this.show(fn(), e.getBoundingClientRect().left, e.getBoundingClientRect().bottom + 2, e); }); m.appendChild(e); }
    document.addEventListener('mousedown', e => { if (!e.target.closest('#menuPop')) this.hide(); });
  },
  hide() { const p = document.getElementById('menuPop'); p.style.display = 'none'; document.querySelectorAll('#menus .m').forEach(x => x.classList.remove('open')); },
  // items: [label, fn, key, disabled] | '-' | {head}
  show(items, x, y, anchor) {
    const p = document.getElementById('menuPop'); p.innerHTML = '';
    for (const it of items) {
      if (it === '-') { p.appendChild(U.el('div', { class: 'sep' })); continue; }
      if (it.head) { p.appendChild(U.el('div', { class: 'mh', text: it.head })); continue; }
      const [label, fn, key, dis] = it;
      const e = U.el('div', { class: 'mi' + (dis ? ' dis' : '') }, U.el('span', { text: label }), key ? U.el('span', { class: 'k', text: key }) : null);
      if (!dis) e.addEventListener('mouseup', ev => { ev.stopPropagation(); this.hide(); fn(); });
      p.appendChild(e);
    }
    p.style.display = 'block'; const r = p.getBoundingClientRect();
    p.style.left = Math.min(x, innerWidth - r.width - 4) + 'px'; p.style.top = Math.min(y, innerHeight - r.height - 4) + 'px';
    document.querySelectorAll('#menus .m').forEach(m => m.classList.toggle('open', m === anchor));
  },
  layerTypes() { return Object.entries(Model.LAYER_TYPES).filter(([k]) => k !== 'precomp').map(([k, v]) => [v + '图层', () => App.newLayer(k)]); },
  effects() { return Object.entries(Model.EFFECTS).map(([k, v]) => [v.label, () => Inspector.addEffect(k)]); },
  defs() {
    return {
      '文件': () => [['新建空工程', () => App.newProject()], ['打开工程…', () => App.openFile(), 'Ctrl+O'], ['保存工程', () => App.save(), 'Ctrl+S'], ['从浏览器恢复上次保存', () => App.restoreLocal()], '-', ['重新载入「锻字」示例', () => App.loadDemo()]],
      '编辑': () => [['撤销', () => History.undo(), 'Ctrl+Z'], ['重做', () => History.redo(), 'Ctrl+Shift+Z'], '-', ['复制', () => App.copy(), 'Ctrl+C'], ['粘贴', () => App.paste(), 'Ctrl+V'], ['创建副本', () => App.duplicate(), 'Ctrl+D'], ['删除', () => App.deleteSelection(), 'Delete'], ['全选', () => App.selectAll(), 'Ctrl+A'], '-', ['拆分图层', () => App.splitLayer(), 'Ctrl+Shift+D']],
      '合成': () => [['新建合成', () => App.newComp(), 'Ctrl+N'], ['合成设置…', () => Inspector.showComp(), 'Ctrl+K'], ['预合成所选图层', () => App.precompose(), 'Ctrl+Shift+C'], '-', ['工作区起点设为当前', () => { App.comp.workStart = Math.min(App.t, App.comp.workEnd - 0.05); App.structChanged('工作区'); }, 'B'], ['工作区终点设为当前', () => { App.comp.workEnd = Math.max(App.t + App.frameDur(), App.comp.workStart + 0.05); App.structChanged('工作区'); }, 'N'], ['运动模糊总开关', () => { App.comp.mb.on = !App.comp.mb.on; App.structChanged('运动模糊'); }]],
      '图层': () => [{ head: '新建' }, ...this.layerTypes(), ['预合成引用…', () => Inspector.pickCompForLayer()], '-', ['添加矩形蒙版', () => Inspector.addMask('rect')], ['添加椭圆蒙版', () => Inspector.addMask('ellipse')], ['添加文字动画制作工具', () => Inspector.addAnimator()], '-', ['启用时间重映射', () => Inspector.toggleRemap(), 'Ctrl+Alt+T'], ['在当前时间裁剪入点', () => App.trim('in'), 'Alt+['], ['在当前时间裁剪出点', () => App.trim('out'), 'Alt+]']],
      '效果': () => this.effects(),
      '动画': () => [['缓动（缓入缓出）', () => App.ease('both'), 'F9'], ['缓入', () => App.ease('in'), 'Shift+F9'], ['缓出', () => App.ease('out'), 'Ctrl+Shift+F9'], ['线性', () => App.ease('linear')], ['贝塞尔', () => App.ease('bezier')], ['定格', () => App.ease('hold'), 'Ctrl+Alt+H'], '-', ['空间：直线（尖角）', () => App.spatial('linear')], ['空间：自动曲线', () => App.spatial('auto')], ['空间：独立手柄', () => App.spatial('manual')], '-', ['关键帧时间拉伸 200%', () => App.stretchKeys(2)], ['关键帧时间拉伸 50%', () => App.stretchKeys(0.5)], ['上一关键帧', () => App.jumpKey(-1), 'J'], ['下一关键帧', () => App.jumpKey(1), 'K']],
      '帮助': () => [['快捷键与说明', () => Inspector.showHelp()], ['字体与字符范围', () => Inspector.showFonts()]],
    };
  },
};

// ============ 项目面板 ============
const ProjectPanel = {
  rebuild() {
    const b = document.getElementById('projBody'); b.innerHTML = '';
    const btns = document.getElementById('projBtns'); btns.innerHTML = '';
    btns.append(U.el('button', { class: 'tbtn', title: '新建合成', text: '＋', onclick: () => App.newComp() }));
    const list = U.el('div', { class: 'plist' });
    for (const c of App.project.comps) {
      const it = U.el('div', { class: 'item' + (c.id === App.compId ? ' on' : ''), draggable: 'true' }, U.el('div', { class: 'ic' }), U.el('div', {}, U.el('div', { text: c.name }), U.el('div', { class: 'meta', text: `${c.width}×${c.height} · ${c.fps}fps · ${U.fmt(c.duration, 2)}s · ${c.layers.length} 层` })));
      it.addEventListener('click', () => App.openComp(c.id));
      it.addEventListener('dblclick', () => { App.openComp(c.id); Inspector.showComp(); });
      it.addEventListener('contextmenu', e => { e.preventDefault(); Menus.show([['打开', () => App.openComp(c.id)], ['添加到当前合成', () => { if (c.id === App.compId) return App.toast('不能把合成放进自身'); App.newLayer('precomp', { compId: c.id }); }, '', c.id === App.compId], ['重命名', () => { const n = prompt('合成名称', c.name); if (n) { c.name = n; App.structChanged('重命名合成'); } }], ['删除', () => { if (App.project.comps.length < 2) return; App.project.comps = App.project.comps.filter(x => x !== c); for (const cc of App.project.comps) cc.layers = cc.layers.filter(l => !(l.type === 'precomp' && l.pre.compId === c.id)); if (App.compId === c.id) App.compId = App.project.comps[0].id; App.structChanged('删除合成'); }, '', App.project.comps.length < 2]], e.clientX, e.clientY); });
      it.addEventListener('dragstart', e => { e.dataTransfer.setData('text/comp', String(c.id)); });
      list.appendChild(it);
    }
    b.appendChild(list);
    b.appendChild(U.el('div', { class: 'psec', text: '新建图层（加入当前合成）' }));
    const g = U.el('div', { class: 'addgrid' });
    for (const [k, v] of Object.entries(Model.LAYER_TYPES)) { if (k === 'precomp') continue; g.appendChild(U.el('button', { text: v, onclick: () => App.newLayer(k) })); }
    b.appendChild(g);
    b.appendChild(U.el('div', { class: 'psec', text: '字体与字符范围' }));
    b.appendChild(U.el('div', { class: 'fontinfo' }, U.el('div', { text: '内置「锻圆体」笔画字库（含笔顺，可书写与挤出）：' }), U.el('div', { class: 'chars', text: DuanFont.chars }), U.el('div', { text: '其他字符改用本机系统字体（黑体/宋体/楷体），由字形轮廓追踪得到几何，无笔顺。' })));
  },
};

// ============ 快捷键 ============
const Keys = {
  init() {
    window.addEventListener('keydown', e => this.down(e), true);
    window.addEventListener('keyup', e => { if (e.code === 'Space') Viewer.spaceDown = false; });
    for (const ev of ['mousedown', 'keydown']) window.addEventListener(ev, () => Synth.unlock(), { once: false, capture: true });
  },
  typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); },
  down(e) {
    if (App.exportMode) return;
    if (this.typing(e)) { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key, ctrl = e.ctrlKey || e.metaKey, sh = e.shiftKey, alt = e.altKey;
    const done = () => { e.preventDefault(); e.stopPropagation(); };
    if (ctrl && !sh && (k === 'z' || k === 'Z')) { done(); return History.undo(); }
    if ((ctrl && sh && (k === 'z' || k === 'Z')) || (ctrl && (k === 'y' || k === 'Y'))) { done(); return History.redo(); }
    if (ctrl && sh && (k === 'c' || k === 'C')) { done(); return App.precompose(); }
    if (ctrl && sh && (k === 'd' || k === 'D')) { done(); return App.splitLayer(); }
    if (k === 'F9') { done(); return App.ease(ctrl && sh ? 'out' : sh ? 'in' : 'both'); }
    if (ctrl && alt && (k === 'h' || k === 'H')) { done(); return App.ease('hold'); }
    if (ctrl && alt && (k === 't' || k === 'T')) { done(); return Inspector.toggleRemap(); }
    if (ctrl) {
      switch (k.toLowerCase()) {
        case 'c': done(); return App.copy(); case 'v': done(); return App.paste(); case 'd': done(); return App.duplicate(); case 'a': done(); return App.selectAll();
        case 's': done(); return App.save(); case 'o': done(); return App.openFile(); case 'n': done(); return App.newComp(); case 'k': done(); return Inspector.showComp();
        case 't': done(); return App.setTool('text'); case 'p': done(); return App.setTool('pin');
        case 'arrowleft': done(); return App.setTime(App.t - App.frameDur()); case 'arrowright': done(); return App.setTime(App.t + App.frameDur());
      }
      return;
    }
    if (alt && sh) { const m = { p: 'position', s: 'scale', r: 'rotation', t: 'opacity', a: 'anchorPoint' }[e.code.replace('Key', '').toLowerCase()]; if (m) { done(); return Inspector.keyAtTime(m); } }
    if (alt && (k === '[' || k === '【')) { done(); return App.trim('in'); }
    if (alt && (k === ']' || k === '】')) { done(); return App.trim('out'); }
    switch (k) {
      case ' ': done(); if (!Viewer.panning) App.toggle(); return;
      case 'Delete': case 'Backspace': done(); return App.deleteSelection();
      case 'PageUp': done(); return App.setTime(App.t - App.frameDur() * (sh ? 10 : 1));
      case 'PageDown': done(); return App.setTime(App.t + App.frameDur() * (sh ? 10 : 1));
      case 'Home': done(); return App.setTime(0);
      case 'End': done(); return App.setTime(App.comp.duration);
      case 'Escape': App.sel.keys.clear(); Viewer.cancelPen(); App.request('tl', 'view'); return;
      case 'Enter': if (Viewer.pen) { done(); return Viewer.finishPen(false); } return;
      case '[': case '【': done(); return App.trim('in', true);
      case ']': case '】': done(); return App.trim('out', true);
      case '=': case '+': done(); return Timeline.zoom(1.25);
      case '-': done(); return Timeline.zoom(0.8);
      case ',': done(); return Viewer.zoomBy(0.8);
      case '.': done(); return Viewer.zoomBy(1.25);
      case '0': if (e.code === 'Numpad0') { done(); return App.toggle(); } return;
      case 'F2': done(); App.sel.layers = []; return App.request('struct');
    }
    const lk = k.toLowerCase();
    const tools = { v: 'select', h: 'hand', z: 'zoom', w: 'rotate', y: 'anchor', g: 'pen', c: 'orbit' };
    if (tools[lk] && !sh) { done(); return App.setTool(tools[lk]); }
    if (lk === 'q') { done(); return App.setTool(App.tool === 'rect' ? 'ellipse' : 'rect'); }
    if (lk === 'j') { done(); return App.jumpKey(-1); }
    if (lk === 'k') { done(); return App.jumpKey(1); }
    if (lk === 'b') { done(); App.comp.workStart = Math.min(App.t, App.comp.workEnd - 0.05); return App.structChanged('工作区起点'); }
    if (lk === 'n') { done(); App.comp.workEnd = Math.max(App.t + App.frameDur(), App.comp.workStart + 0.05); return App.structChanged('工作区终点'); }
    const reveal = { p: ['position'], s: ['scale'], r: ['rotation', 'xRotation', 'yRotation'], t: ['opacity'], a: ['anchorPoint'], u: 'anim', e: 'effects', m: 'masks' }[lk];
    if (reveal) { done(); return Timeline.reveal(reveal, sh); }
  },
};

// ============ 分隔条 ============
const Splitters = {
  init() {
    document.querySelectorAll('.splitter').forEach(s => s.addEventListener('mousedown', e => {
      e.preventDefault(); const kind = s.dataset.split; const R = document.documentElement.style; const sx = e.clientX, sy = e.clientY;
      const cs = getComputedStyle(document.documentElement);
      const start = { left: document.getElementById('projectPanel').offsetWidth, right: document.getElementById('inspector').offsetWidth, bottom: document.getElementById('bottom').offsetHeight, nodes: document.getElementById('nodePanel').offsetWidth };
      const mv = ev => {
        if (kind === 'left') R.setProperty('--leftW', U.clamp(start.left + ev.clientX - sx, 150, 500) + 'px');
        if (kind === 'right') R.setProperty('--rightW', U.clamp(start.right - (ev.clientX - sx), 220, 700) + 'px');
        if (kind === 'bottom') R.setProperty('--bottomH', U.clamp(start.bottom - (ev.clientY - sy), 120, innerHeight - 220) + 'px');
        if (kind === 'nodes') R.setProperty('--nodeW', U.clamp(start.nodes - (ev.clientX - sx), 200, innerWidth - 400) + 'px');
        Viewer.resize(); Timeline.resize(); NodeView.layoutWires();
      };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
    }));
  },
};
