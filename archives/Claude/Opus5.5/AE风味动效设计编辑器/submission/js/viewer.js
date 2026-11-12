'use strict';
// ============ 合成画布：显示、辅助元素与直接编辑 ============
const Viewer = {
  zoom: 0.5, pan: [0, 0], fitMode: true, dpr: 1, res: 'auto', showMesh: true, lastRS: 1,
  init() {
    this.wrap = document.getElementById('viewerWrap'); this.glc = document.getElementById('glc'); this.ovc = document.getElementById('ovc');
    GLX.init(this.glc); GLX.ctxGen = 1;
    this.ctx = this.ovc.getContext('2d');
    new ResizeObserver(() => this.resize()).observe(this.wrap);
    this.ovc.addEventListener('mousedown', e => this.down(e));
    this.ovc.addEventListener('mousemove', e => this.hover(e));
    this.ovc.addEventListener('dblclick', e => this.dbl(e));
    this.ovc.addEventListener('wheel', e => this.wheel(e), { passive: false });
    this.ovc.addEventListener('contextmenu', e => e.preventDefault());
    this.wrap.addEventListener('mousedown', () => App.focus = 'viewer');
    window.addEventListener('keydown', e => { if (e.code === 'Space' && !Keys.typing(e)) this.spaceDown = true; });
    this.wrap.addEventListener('dragover', e => e.preventDefault());
    this.wrap.addEventListener('drop', e => { const id = +e.dataTransfer.getData('text/comp'); if (id && id !== App.compId) App.newLayer('precomp', { compId: id }); });
    const vb = document.getElementById('viewBtns');
    this.resSel = Widgets.select({ auto: '自动分辨率', full: '完整', half: '二分之一', third: '三分之一' }, 'auto', v => { this.res = v; this.render(); });
    this.zoomSel = Widgets.select({ fit: '适合', 0.25: '25%', 0.5: '50%', 0.75: '75%', 1: '100%', 1.5: '150%', 2: '200%' }, 'fit', v => { if (v === 'fit') this.fit(); else this.setZoom(+v); });
    vb.append(this.zoomSel, this.resSel,
      U.el('button', { class: 'tbtn', id: 'btnGuides', title: '显示辅助元素（选择框、运动路径、网格、场范围、灯光与摄像机）', text: '辅助', onclick: e => { App.showGuides = !App.showGuides; e.target.classList.toggle('on', App.showGuides); this.drawOverlay(); } }),
      U.el('button', { class: 'tbtn', title: '显示三维网格线框', text: '网格', onclick: e => { this.showMesh = !this.showMesh; e.target.classList.toggle('on', this.showMesh); this.drawOverlay(); } }),
      U.el('button', { class: 'tbtn', title: '透明网格背景', text: '透明', onclick: e => { App.checker = !App.checker; e.target.classList.toggle('on', App.checker); this.render(); } }),
      U.el('button', { class: 'tbtn', id: 'btnMB', title: '合成运动模糊总开关', text: '模糊', onclick: () => { App.comp.mb.on = !App.comp.mb.on; App.structChanged('运动模糊开关'); } }));
    document.getElementById('btnGuides').classList.add('on'); vb.children[3].classList.add('on');
    this.resize();
  },
  resize() {
    const r = this.wrap.getBoundingClientRect(); this.dpr = window.devicePixelRatio || 1;
    this.cw = r.width; this.ch = r.height;
    for (const c of [this.glc, this.ovc]) { c.width = Math.max(1, Math.round(r.width * this.dpr)); c.height = Math.max(1, Math.round(r.height * this.dpr)); }
    if (this.fitMode) this.fit(true); else this.render();
  },
  fit(noRender) {
    const c = App.comp; if (!c || !this.cw) return; this.fitMode = true;
    this.zoom = Math.min((this.cw - 40) / c.width, (this.ch - 40) / c.height);
    this.pan = [(this.cw - c.width * this.zoom) / 2, (this.ch - c.height * this.zoom) / 2];
    if (this.zoomSel) this.zoomSel.value = 'fit';
    if (!noRender) this.render(); else this.render();
  },
  setZoom(z, cx, cy) {
    if (cx === undefined) { cx = this.cw / 2; cy = this.ch / 2; }
    const c = this.s2c([cx, cy]); this.zoom = U.clamp(z, 0.05, 16); this.pan = [cx - c[0] * this.zoom, cy - c[1] * this.zoom]; this.fitMode = false; this.render();
  },
  zoomBy(f) { this.setZoom(this.zoom * f); },
  updateTabs() {
    const tabs = document.getElementById('compTabs'); tabs.innerHTML = '';
    for (const id of App.openComps) { const c = Model.findComp(App.project, id); if (!c) continue; const t = U.el('div', { class: 'tab' + (id === App.compId ? ' on' : ''), text: c.name }); t.onclick = () => App.openComp(id); tabs.appendChild(t); }
    const mb = document.getElementById('btnMB'); if (mb) mb.classList.toggle('on', App.comp.mb.on);
    const em = document.getElementById('viewerEmpty');
    const empty = !App.comp.layers.length; em.classList.toggle('show', empty);
    em.innerHTML = empty ? '<div><b>空合成</b>用左侧「新建图层」或顶部工具（矩形 Q、钢笔 G、文字 Ctrl+T）开始创作<br>也可以从「文件 → 重新载入示例」打开「锻字」示例</div>' : '';
    this.hint();
  },
  // ---------- 坐标 ----------
  c2s(p) { return [this.pan[0] + p[0] * this.zoom, this.pan[1] + p[1] * this.zoom]; },
  s2c(p) { return [(p[0] - this.pan[0]) / this.zoom, (p[1] - this.pan[1]) / this.zoom]; },
  is3DLayer(L) { return L.threeD || ['camera', 'light', 'geo', 'particles', 'field'].includes(L.type); },
  // 图层空间点 → 合成像素（与渲染同一投影）
  toComp(comp, L, t, p, cam) {
    const M = Xform.layerMatrix(comp, L, t);
    if (this.is3DLayer(L)) { cam = cam || Xform.camera(comp, t); const w = M4.pt(M, p); const s = Xform.project(cam, comp, w); return s ? [s[0], s[1]] : null; }
    const q = M4.pt(M, p); return [q[0], q[1]];
  },
  worldToComp(comp, w, cam) { const s = Xform.project(cam, comp, w); return s ? [s[0], s[1]] : null; },
  // 视线：合成像素 → 世界射线
  ray(comp, cam, cp) {
    const nx = cp[0] / comp.width * 2 - 1, ny = 1 - cp[1] / comp.height * 2; const iv = M4.invert(cam.vp);
    const a = M4.pt(iv, [nx, ny, -1]), b = M4.pt(iv, [nx, ny, 1]); return { o: a, d: V3.norm(V3.sub(b, a)) };
  },
  rayPlane(r, p0, n) { const dn = V3.dot(r.d, n); if (Math.abs(dn) < 1e-9) return null; const t = V3.dot(V3.sub(p0, r.o), n) / dn; return V3.add(r.o, V3.mul(r.d, t)); },

  // ---------- 渲染 ----------
  renderScale() {
    const c = App.comp; let rs = this.zoom * this.dpr;
    const lim = { auto: 2, full: 1, half: 0.5, third: 1 / 3 }[this.res]; rs = Math.min(rs, lim);
    if (this.res !== 'auto') rs = lim;
    return U.clamp(rs, 0.1, Math.min(2, 4096 / Math.max(c.width, c.height)));
  },
  render() {
    if (!GLX.gl || !App.project) return;
    const c = App.comp; if (!c) return; const gl = GLX.gl;
    const t0 = performance.now();
    const rs = this.renderScale(); this.lastRS = rs;
    let rt = null;
    try { rt = Render.renderComp(c, App.t, rs, {}); } catch (e) { console.error(e); App.status('渲染错误：' + e.message); }
    GLX.bind(null); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (rt) {
      const W = this.glc.width, H = this.glc.height;
      const x0 = this.pan[0] * this.dpr / W, y1 = 1 - this.pan[1] * this.dpr / H, w = c.width * this.zoom * this.dpr / W, h = c.height * this.zoom * this.dpr / H;
      GLX.use('view'); GLX.set('uRect', [x0, y1 - h, w, h]); GLX.tex('uTex', rt.tex); GLX.set('uBg', c.bg); GLX.set('uChecker', App.checker ? 1 : 0); GLX.set('uScreen', [W, H]);
      gl.disable(gl.BLEND); GLX.drawQuad(); GLX.release(rt);
    }
    GLX.gc();
    this.renderMs = performance.now() - t0;
    this.drawOverlay();
    document.getElementById('stRight').textContent = `${c.width}×${c.height} · 渲染 ${rs.toFixed(2)}× · ${this.renderMs.toFixed(0)} ms`;
    const lv = Synth.levelAt(c, App.t); const mb = document.querySelector('#meter .bar'); if (mb) mb.style.width = (lv * 100).toFixed(0) + '%';
  },
  // ---------- 辅助元素 ----------
  hint(msg) {
    const h = document.getElementById('viewerHint'); if (!h) return;
    h.textContent = msg || ({ select: '选择：点击选取可见对象，拖动移动；拖动手柄缩放/旋转；Shift 加选', hand: '手形：拖动平移视图', zoom: '缩放：点击放大，Alt+点击缩小', rotate: '旋转：拖动旋转所选图层', anchor: '锚点：拖动锚点，画面保持不动', rect: '矩形：拖动绘制（选中形状层则加入，其他层则建蒙版）', ellipse: '椭圆：拖动绘制', pen: '钢笔：点击加点，拖动拉切线，点首点闭合，Enter 结束', text: '文字：点击放置新文字', pin: '图钉：在图层上点击添加操控图钉，拖动图钉变形', orbit: '摄像机：左键环绕，右键平移，滚轮推拉' }[App.tool] || '');
  },
  ovStyle(c) { c.lineWidth = 1; c.font = '11px ' + getComputedStyle(document.body).fontFamily; },
  drawOverlay() {
    if (!App.project) return;
    const c = this.ctx; const d = this.dpr; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, this.cw, this.ch);
    const comp = App.comp; if (!comp) return;
    this.handles = [];
    // 合成边框
    const a = this.c2s([0, 0]), b = this.c2s([comp.width, comp.height]);
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.strokeRect(a[0] - 0.5, a[1] - 0.5, b[0] - a[0] + 1, b[1] - a[1] + 1);
    if (!App.showGuides || App.exportMode) return;
    this.ovStyle(c);
    const t = App.t; const cam = Xform.camera(comp, t);
    // 场范围（全部显示）
    for (const L of comp.layers) if (L.type === 'field' && L.visible && L.field.show) this.drawField(c, comp, L, t, cam);
    // 灯光图标
    for (const L of comp.layers) if (L.type === 'light' && L.visible) this.drawLight(c, comp, L, t, cam);
    const sel = App.selLayers();
    for (const L of sel) {
      try {
        if (L.type === 'geo' && this.showMesh && !App.playing) this.drawMesh(c, comp, L, t, cam);
        this.drawMotionPath(c, comp, L, t, cam);
        if (L.type === 'camera') this.drawCamera(c, comp, L, t, cam);
        else if (L.type === 'particles') this.drawEmitters(c, comp, L, t, cam);
        else if (L.type !== 'light' && L.type !== 'synth') this.drawBox(c, comp, L, t, cam, sel.length === 1);
        for (const m of L.masks) this.drawPath(c, comp, L, t, Anim.evalProp(m.path, comp, L, t), '#ffd84d', this.pathEdit && this.pathEdit.prop === m.path, m.path);
        const pup = L.effects.find(e => e.type === 'puppet'); if (pup) this.drawPins(c, comp, L, t, pup);
        if (L.type === 'geo') this.drawNodePins(c, comp, L, t, cam);
      } catch (e) { console.warn(e); }
    }
    if (this.pathEdit && this.pathEdit.layer && !this.pathEdit.mask) { const L = this.pathEdit.layer; if (Model.findLayer(comp, L.id)) this.drawPath(c, comp, L, t, Anim.evalProp(this.pathEdit.prop, comp, L, t), '#59a8ff', true, this.pathEdit.prop, this.pathEdit.groupM); }
    if (this.pen) this.drawPen(c);
    if (this.drag && this.drag.marquee) { const m = this.drag.marquee; c.strokeStyle = '#ff8a3d'; c.setLineDash([4, 3]); c.strokeRect(m[0], m[1], m[2] - m[0], m[3] - m[1]); c.setLineDash([]); }
    if (this.drawTmp) this.drawTmp(c);
  },
  dot(c, p, r, fill, stroke) { c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); } },
  sq(c, p, r, fill, stroke) { c.fillStyle = fill; c.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); if (stroke) { c.strokeStyle = stroke; c.strokeRect(p[0] - r, p[1] - r, r * 2, r * 2); } },
  layerBBox(comp, L, t) {
    try {
      if (L.type === 'shape') { const P = Shapes.allPolys(comp, L, t); return P.length ? Geo2D.bbox(P) : [-40, -40, 40, 40]; }
      if (L.type === 'text') return TextL.bbox(comp, L, t);
      if (L.type === 'solid') return [0, 0, L.solid.w, L.solid.h];
      if (L.type === 'adjustment') return [0, 0, L.adj.w, L.adj.h];
      if (L.type === 'precomp') { const s = Model.findComp(App.project, L.pre.compId); return s ? [0, 0, s.width, s.height] : [0, 0, 100, 100]; }
    } catch (e) { }
    return [-30, -30, 30, 30];
  },
  drawBox(c, comp, L, t, cam, handles) {
    const cs = p => { const q = this.toComp(comp, L, t, p, cam); return q ? this.c2s(q) : null; };
    if (L.type === 'geo') {
      const m = Scene.layerMesh(comp, L, t); const b = m ? Geo3D.bounds(m) : [-50, -50, -50, 50, 50, 50];
      const P = [[b[0], b[1], b[2]], [b[3], b[1], b[2]], [b[3], b[4], b[2]], [b[0], b[4], b[2]], [b[0], b[1], b[5]], [b[3], b[1], b[5]], [b[3], b[4], b[5]], [b[0], b[4], b[5]]].map(cs);
      c.strokeStyle = 'rgba(255,138,61,0.75)'; c.beginPath();
      for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) if (P[i] && P[j]) { c.moveTo(P[i][0], P[i][1]); c.lineTo(P[j][0], P[j][1]); }
      c.stroke();
    } else if (L.type !== 'null' && L.type !== 'field') {
      const bb = this.layerBBox(comp, L, t);
      const pts = [[bb[0], bb[1], 0], [bb[2], bb[1], 0], [bb[2], bb[3], 0], [bb[0], bb[3], 0]].map(cs);
      if (pts.every(Boolean)) {
        c.strokeStyle = '#ff8a3d'; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke();
        if (handles && !this.is3DLayer(L)) {
          const mids = [[(bb[0] + bb[2]) / 2, bb[1]], [bb[2], (bb[1] + bb[3]) / 2], [(bb[0] + bb[2]) / 2, bb[3]], [bb[0], (bb[1] + bb[3]) / 2]];
          const hs = [[bb[0], bb[1], 1, 1], [bb[2], bb[1], 1, 1], [bb[2], bb[3], 1, 1], [bb[0], bb[3], 1, 1], [mids[0][0], mids[0][1], 0, 1], [mids[1][0], mids[1][1], 1, 0], [mids[2][0], mids[2][1], 0, 1], [mids[3][0], mids[3][1], 1, 0]];
          for (const h of hs) { const s = cs([h[0], h[1], 0]); this.sq(c, s, 3.5, '#1a1a1a', '#ff8a3d'); this.handles.push({ kind: 'scale', layer: L, p: s, lp: [h[0], h[1]], ax: [h[2], h[3]] }); }
          for (let i = 0; i < 4; i++) this.handles.push({ kind: 'rotateZone', layer: L, p: pts[i] });
        }
      }
    }
    // 锚点 / 三维轴
    const ap = Anim.evalProp(L.tr.anchor, comp, L, t);
    const o = cs(ap);
    if (!o) return;
    if (this.is3DLayer(L)) {
      const M = Xform.layerMatrix(comp, L, t); const w0 = M4.pt(M, ap); const s0 = this.worldToComp(comp, w0, cam); if (!s0) return;
      const scl = Math.max(1, V3.dist(w0, cam.eye)) * 0.11 / this.zoom * (comp.height / 1080);
      const PM = Xform.parentMatrix(comp, L, t);
      const axes = [[1, 0, 0, '#ff5252'], [0, 1, 0, '#7fd84f'], [0, 0, 1, '#4fa3ff']];
      for (const [x, y, z, col] of axes) {
        const dw = V3.norm(M4.dir(PM, [x, y, z])); const e = this.worldToComp(comp, V3.add(w0, V3.mul(dw, scl)), cam); if (!e) continue;
        const A = this.c2s(s0), B = this.c2s(e); c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); c.lineWidth = 1;
        this.dot(c, B, 4, col); this.handles.push({ kind: 'axis', layer: L, p: B, axis: [x, y, z], dirW: dw, o: A });
      }
      this.dot(c, this.c2s(s0), 3, '#fff');
    } else {
      c.strokeStyle = '#fff'; c.beginPath(); c.arc(o[0], o[1], 5, 0, Math.PI * 2); c.moveTo(o[0] - 9, o[1]); c.lineTo(o[0] + 9, o[1]); c.moveTo(o[0], o[1] - 9); c.lineTo(o[0], o[1] + 9); c.stroke();
      this.handles.push({ kind: 'anchor', layer: L, p: o });
    }
  },
  drawMesh(c, comp, L, t, cam) {
    const m = Scene.layerMesh(comp, L, t); if (!m) return; const M = Xform.layerMatrix(comp, L, t);
    const nt = m.idx.length / 3; const step = Math.max(1, Math.ceil(nt / 9000));
    const S = new Float32Array(m.pos.length / 3 * 2); const ok = new Uint8Array(m.pos.length / 3);
    const vp = M4.mul(cam.vp, M);
    for (let i = 0; i < m.pos.length / 3; i++) { const q = M4.pt4(vp, [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]]); if (q[3] > 1e-3) { ok[i] = 1; S[i * 2] = this.pan[0] + (q[0] / q[3] * 0.5 + 0.5) * comp.width * this.zoom; S[i * 2 + 1] = this.pan[1] + (1 - (q[1] / q[3] * 0.5 + 0.5)) * comp.height * this.zoom; } }
    c.strokeStyle = 'rgba(120,200,255,0.10)'; c.beginPath();
    for (let k = 0; k < nt; k += step) { const a = m.idx[k * 3], b = m.idx[k * 3 + 1], d = m.idx[k * 3 + 2]; if (!ok[a] || !ok[b] || !ok[d]) continue; c.moveTo(S[a * 2], S[a * 2 + 1]); c.lineTo(S[b * 2], S[b * 2 + 1]); c.lineTo(S[d * 2], S[d * 2 + 1]); c.closePath(); }
    c.stroke();
  },
  // 运动路径（按最终画面：含父级动画）
  drawMotionPath(c, comp, L, t, cam) {
    const p = L.tr.position; if (!Anim.isAnimated(p) || p.k.length < 2) return;
    const st = L.startTime; const k0 = p.k[0].t + st, k1 = p.k[p.k.length - 1].t + st;
    const anchor = Anim.evalProp(L.tr.anchor, comp, L, t);
    const world = tt => { const M = Xform.layerMatrix(comp, L, tt); const w = M4.pt(M, L.type === 'camera' || L.type === 'light' ? [0, 0, 0] : anchor); return this.is3DLayer(L) ? this.worldToComp(comp, w, cam) : [w[0], w[1]]; };
    const N = Math.min(600, Math.max(20, Math.round((k1 - k0) * comp.fps)));
    c.strokeStyle = 'rgba(255,196,107,0.7)'; c.setLineDash([3, 3]); c.beginPath(); let started = false;
    for (let i = 0; i <= N; i++) { const q = world(k0 + (k1 - k0) * i / N); if (!q) { started = false; continue; } const s = this.c2s(q); if (!started) { c.moveTo(s[0], s[1]); started = true; } else c.lineTo(s[0], s[1]); }
    c.stroke(); c.setLineDash([]);
    // 帧点
    c.fillStyle = 'rgba(255,196,107,0.55)';
    for (let f = Math.ceil(k0 * comp.fps); f <= k1 * comp.fps; f++) { const q = world(f / comp.fps); if (q) { const s = this.c2s(q); c.fillRect(s[0] - 1, s[1] - 1, 2, 2); } }
    // 关键帧与空间手柄
    p.k.forEach((k, i) => {
      const tk = k.t + st; const q = world(tk); if (!q) return; const s = this.c2s(q);
      const selK = App.sel.keys.has(k);
      this.sq(c, s, 4, selK ? '#ff8a3d' : '#ffe2b8', '#000');
      this.handles.push({ kind: 'pathKey', layer: L, p: s, key: k, idx: i, prop: p });
      if (k.sp !== undefined) {
        const tg = Anim.spatialTangents(p, i); const PM = Xform.parentMatrix(comp, L, tk);
        for (const [nm, v] of [['ti', tg.ti], ['to', tg.to]]) {
          if ((nm === 'ti' && i === 0) || (nm === 'to' && i === p.k.length - 1)) continue;
          if (U.vecLen(v) < 1e-6 && k.sp === 'linear') continue;
          const wv = U.vecAdd(k.v, v); const wq = M4.pt(PM, [wv[0], wv[1], wv[2] || 0]); const hq = this.is3DLayer(L) ? this.worldToComp(comp, wq, cam) : [wq[0], wq[1]]; if (!hq) continue;
          const hs = this.c2s(hq); c.strokeStyle = 'rgba(255,196,107,0.8)'; c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(hs[0], hs[1]); c.stroke();
          this.dot(c, hs, 3.5, '#ffc46b', '#000'); this.handles.push({ kind: 'tangent', layer: L, p: hs, key: k, idx: i, which: nm, prop: p });
        }
      }
    });
  },
  drawPath(c, comp, L, t, path, col, edit, prop, groupM) {
    if (!path || !path.c) return;
    const M = Xform.layerMatrix(comp, L, t);
    const tp = q => { let x = q; if (groupM) x = Shapes.apA(groupM, q); const r = this.is3DLayer(L) ? this.toComp(comp, L, t, [x[0], x[1], 0]) : M4.pt(M, [x[0], x[1], 0]); return r ? this.c2s(r) : [0, 0]; };
    c.strokeStyle = col; c.lineWidth = edit ? 1.5 : 1;
    for (const ct of path.c) { const f = Geo2D.flatten(ct, 1); c.beginPath(); f.pts.forEach((q, i) => { const s = tp(q); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }); if (ct.closed) c.closePath(); c.stroke(); }
    c.lineWidth = 1;
    if (!edit) return;
    path.c.forEach((ct, ci) => ct.v.forEach((v, vi) => {
      const s = tp(v); const selV = this.pathSel && this.pathSel.ci === ci && this.pathSel.vi === vi;
      for (const [nm, d] of [['i', ct.i[vi]], ['o', ct.o[vi]]]) { if (!d || (!d[0] && !d[1])) continue; const h = tp([v[0] + d[0], v[1] + d[1]]); c.strokeStyle = col; c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(h[0], h[1]); c.stroke(); this.dot(c, h, 3, '#fff', col); this.handles.push({ kind: 'pathTan', layer: L, prop, ci, vi, which: nm, p: h, groupM }); }
      this.sq(c, s, 3.5, selV ? col : '#111', col); this.handles.push({ kind: 'pathVert', layer: L, prop, ci, vi, p: s, groupM });
    }));
  },
  drawPins(c, comp, L, t, eff) {
    const st = Puppet.pinState(comp, L, t, eff);
    st.forEach((s, i) => { const q = this.toComp(comp, L, t, [s.q[0], s.q[1], 0]); if (!q) return; const p = this.c2s(q); this.dot(c, p, 5, '#ffd84d', '#000'); c.fillStyle = '#000'; c.fillText(String(i + 1), p[0] - 3, p[1] + 4); this.handles.push({ kind: 'pin', layer: L, eff, pin: eff.pins[i], p }); });
  },
  drawNodePins(c, comp, L, t, cam) {
    const M = Xform.layerMatrix(comp, L, t);
    for (const n of comp.graph.nodes) if (n.type === 'pinWarp' && n.pins) n.pins.forEach((pn, i) => { const o = Anim.evalProp(pn.off, comp, null, t); const w = M4.pt(M, [pn.rest[0] + o[0], pn.rest[1] + o[1], 0]); const q = this.worldToComp(comp, w, cam); if (!q) return; const p = this.c2s(q); this.dot(c, p, 5, '#ffd84d', '#000'); this.handles.push({ kind: 'nodePin', layer: L, node: n, pin: pn, p }); });
  },
  drawField(c, comp, L, t, cam) {
    const F = Fields.fromLayer(comp, L, t); if (!F) return;
    const sel = App.sel.layers.includes(L.id);
    const ctr = F.ctr; const s0 = this.worldToComp(comp, ctr, cam); if (!s0) return; const S = this.c2s(s0);
    const right = V3.norm([cam.view[0], cam.view[4], cam.view[8]]); const up = V3.norm([cam.view[1], cam.view[5], cam.view[9]]);
    const ring = (r, dash, col) => { c.strokeStyle = col; c.setLineDash(dash); c.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; const w = V3.add(ctr, V3.add(V3.mul(right, Math.cos(a) * r), V3.mul(up, Math.sin(a) * r))); const q = this.worldToComp(comp, w, cam); if (!q) continue; const s = this.c2s(q); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); } c.stroke(); c.setLineDash([]); };
    const col = sel ? '#ff8a4c' : 'rgba(255,138,76,0.45)';
    ring(F.radius, [], col); ring(F.radius * (1 - U.clamp(Anim.evalProp(L.field.falloff, comp, L, t) / 100, 0, 1)), [4, 4], col);
    c.fillStyle = col; c.fillText(`场 · ${L.name}`, S[0] + 6, S[1] - 6);
    if (L.field.kind === 'vortex' || L.field.kind === 'linear') { const d = V3.norm(M4.dir(Xform.layerMatrix(comp, L, t), Anim.evalProp(L.field.dir, comp, L, t))); const e = this.worldToComp(comp, V3.add(ctr, V3.mul(d, F.radius * 0.6)), cam); if (e) { const E = this.c2s(e); c.strokeStyle = col; c.beginPath(); c.moveTo(S[0], S[1]); c.lineTo(E[0], E[1]); c.stroke(); } }
    this.dot(c, S, 3, col);
    if (!sel) this.handles.push({ kind: 'selectLayer', layer: L, p: S });
  },
  drawLight(c, comp, L, t, cam) {
    const PM = Xform.parentMatrix(comp, L, t); const pos = M4.pt(PM, Anim.evalProp(L.tr.position, comp, L, t));
    const q = this.worldToComp(comp, pos, cam); if (!q) return; const s = this.c2s(q); const sel = App.sel.layers.includes(L.id);
    c.strokeStyle = sel ? '#ffd84d' : 'rgba(255,216,77,0.55)'; c.beginPath(); c.arc(s[0], s[1], 7, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.beginPath(); c.moveTo(s[0] + Math.cos(a) * 10, s[1] + Math.sin(a) * 10); c.lineTo(s[0] + Math.cos(a) * 14, s[1] + Math.sin(a) * 14); c.stroke(); }
    c.fillStyle = c.strokeStyle; c.fillText(L.name, s[0] + 14, s[1] - 10);
    this.handles.push({ kind: sel ? 'lightPos' : 'selectLayer', layer: L, p: s });
    if (L.light.kind === 'parallel') { const poi = M4.pt(PM, Anim.evalProp(L.light.poi, comp, L, t)); const pq = this.worldToComp(comp, poi, cam); if (pq) { const ps = this.c2s(pq); c.setLineDash([3, 4]); c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(ps[0], ps[1]); c.stroke(); c.setLineDash([]); if (sel) { c.strokeRect(ps[0] - 4, ps[1] - 4, 8, 8); this.handles.push({ kind: 'poi', layer: L, p: ps, prop: L.light.poi }); } } }
  },
  drawCamera(c, comp, L, t, cam) {
    const PM = Xform.parentMatrix(comp, L, t); const poi = M4.pt(PM, Anim.evalProp(L.cam.poi, comp, L, t));
    const q = this.worldToComp(comp, poi, cam); if (q) { const s = this.c2s(q); c.strokeStyle = '#9ad0ff'; c.beginPath(); c.moveTo(s[0] - 8, s[1]); c.lineTo(s[0] + 8, s[1]); c.moveTo(s[0], s[1] - 8); c.lineTo(s[0], s[1] + 8); c.stroke(); c.fillStyle = '#9ad0ff'; c.fillText('摄像机目标点', s[0] + 8, s[1] - 8); this.handles.push({ kind: 'poi', layer: L, p: s, prop: L.cam.poi }); }
    // 对焦距离平面指示
    if (L.cam.dof) { c.fillStyle = 'rgba(154,208,255,0.8)'; c.fillText(`对焦 ${U.fmt(cam.focus, 0)} · 光圈 ${U.fmt(cam.aperture, 1)}`, 12, 18); }
  },
  drawEmitters(c, comp, L, t, cam) {
    L.ps.emitters.forEach((em, i) => {
      if (em.kind !== 'point') return;
      const w = M4.pt(Xform.layerMatrix(comp, L, t), Anim.evalProp(em.pos, comp, L, t)); const q = this.worldToComp(comp, w, cam); if (!q) return; const s = this.c2s(q);
      c.strokeStyle = '#ff9a5a'; c.beginPath(); c.arc(s[0], s[1], 8, 0, Math.PI * 2); c.moveTo(s[0] - 12, s[1]); c.lineTo(s[0] + 12, s[1]); c.moveTo(s[0], s[1] - 12); c.lineTo(s[0], s[1] + 12); c.stroke();
      c.fillStyle = '#ff9a5a'; c.fillText(em.name, s[0] + 10, s[1] - 10);
      this.handles.push({ kind: 'emitter', layer: L, em, p: s });
    });
  },
  drawPen(c) {
    const P = this.pen; if (!P || !P.v.length) return; const comp = App.comp;
    const tp = q => this.c2s(P.toComp(q));
    c.strokeStyle = '#59a8ff'; c.lineWidth = 1.5; const ct = { closed: false, v: P.v, i: P.i, o: P.o };
    const f = Geo2D.flatten(ct, 1); c.beginPath(); f.pts.forEach((q, i) => { const s = tp(q); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }); c.stroke(); c.lineWidth = 1;
    P.v.forEach((v, i) => { const s = tp(v); this.sq(c, s, i === 0 ? 5 : 3.5, i === 0 ? '#59a8ff' : '#111', '#59a8ff'); const o = P.o[i]; if (o[0] || o[1]) { const h = tp([v[0] + o[0], v[1] + o[1]]), h2 = tp([v[0] - o[0], v[1] - o[1]]); c.beginPath(); c.moveTo(h2[0], h2[1]); c.lineTo(h[0], h[1]); c.stroke(); this.dot(c, h, 2.5, '#fff'); } });
  },

  // ---------- 交互 ----------
  mpos(e) { const r = this.ovc.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; },
  hit(sp, kinds) { let best = null, bd = 9; for (const h of this.handles || []) { if (kinds && !kinds.includes(h.kind)) continue; const d = Math.hypot(h.p[0] - sp[0], h.p[1] - sp[1]); const lim = h.kind === 'rotateZone' ? 22 : 8; if (h.kind === 'rotateZone' && d < 8) continue; if (d < lim && (!best || d < bd)) { best = h; bd = d; } } return best; },
  hover(e) {
    if (this.drag) return; const sp = this.mpos(e); const h = this.hit(sp);
    const cur = { scale: 'nwse-resize', rotateZone: 'alias', anchor: 'move', axis: 'pointer', pathKey: 'move', tangent: 'pointer', pathVert: 'move', pathTan: 'pointer', pin: 'move', nodePin: 'move', poi: 'crosshair', lightPos: 'move', emitter: 'move', selectLayer: 'pointer' }[h && h.kind];
    this.ovc.style.cursor = App.tool === 'hand' || this.spaceDown ? 'grab' : App.tool === 'zoom' ? 'zoom-in' : ['rect', 'ellipse', 'pen', 'pin', 'text'].includes(App.tool) ? 'crosshair' : (cur || 'default');
  },
  wheel(e) {
    e.preventDefault(); const sp = this.mpos(e);
    if (App.tool === 'orbit' && Xform.activeCamera(App.comp, App.t)) return this.camDolly(e.deltaY);
    this.setZoom(this.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), sp[0], sp[1]);
  },
  dbl(e) {
    const sp = this.mpos(e); const cp = this.s2c(sp); const comp = App.comp;
    const id = Render.pick(comp, App.t, cp[0], cp[1]); const L = Model.findLayer(comp, id); if (!L) return;
    if (L.type === 'shape') { const first = this.findFirstPath(L.contents, [1, 0, 0, 1, 0, 0], comp, L); if (first) this.editPath(first.prop, L, first.M); }
    else if (L.type === 'text') { App.selectLayer(L.id); setTimeout(() => { const ta = document.querySelector('#inspBody textarea.txt'); if (ta) { ta.focus(); ta.select(); } }, 50); }
    else if (L.type === 'precomp') App.openComp(L.pre.compId);
  },
  findFirstPath(items, M, comp, L) {
    for (const it of items) {
      if (it.type === 'path') return { prop: it.path, M };
      if (it.type === 'group') { const gm = Shapes.groupMat(it.tr, { comp, layer: L, t: App.t }); const r = this.findFirstPath(it.items, Shapes.mulA(M, gm), comp, L); if (r) return r; }
    }
    return null;
  },
  editPath(prop, layer, groupM) {
    if (!groupM && layer && layer.type === 'shape') { const f = this.findPathOwnerM(layer.contents, prop, [1, 0, 0, 1, 0, 0], App.comp, layer); groupM = f; }
    const isMask = layer && layer.masks.some(m => m.path === prop);
    this.pathEdit = { prop, layer, groupM: groupM || null, mask: isMask }; this.pathSel = null;
    if (layer) App.sel.layers = [layer.id];
    App.request('struct'); App.toast('路径编辑：拖动顶点/切线；Ctrl+点击线段加点；Alt+点击顶点切换尖角/平滑；Delete 删除顶点');
  },
  findPathOwnerM(items, prop, M, comp, L) {
    for (const it of items) {
      if (it.type === 'path' && it.path === prop) return M;
      if (it.type === 'group') { const r = this.findPathOwnerM(it.items, prop, Shapes.mulA(M, Shapes.groupMat(it.tr, { comp, layer: L, t: App.t })), comp, L); if (r) return r; }
    }
    return null;
  },
  cancelPen() { if (this.pen) { this.pen = null; this.drawOverlay(); } },
  // 合成像素 → 图层空间（2D 图层）
  compToLayer(comp, L, t, cp) {
    if (this.is3DLayer(L)) { const cam = Xform.camera(comp, t); const M = Xform.layerMatrix(comp, L, t); const r = this.ray(comp, cam, cp); const o = M4.pt(M, [0, 0, 0]); const n = V3.norm(M4.dir(M, [0, 0, 1])); const h = this.rayPlane(r, o, n); if (!h) return [0, 0]; const q = M4.pt(M4.invert(M), h); return [q[0], q[1]]; }
    const q = M4.pt(M4.invert(Xform.layerMatrix(comp, L, t)), [cp[0], cp[1], 0]); return [q[0], q[1]];
  },
  down(e) {
    App.focus = 'viewer'; Synth.unlock();
    const sp = this.mpos(e); const cp = this.s2c(sp); const comp = App.comp; const t = App.t;
    if (e.button === 1 || App.tool === 'hand' || this.spaceDown) return this.startPan(e, sp);
    if (App.tool === 'zoom') { this.setZoom(this.zoom * (e.altKey ? 0.5 : 2), sp[0], sp[1]); return; }
    if (App.tool === 'orbit') return this.startOrbit(e, sp);
    if (App.tool === 'rect' || App.tool === 'ellipse') return this.startShapeDraw(e, sp);
    if (App.tool === 'pen') return this.penClick(e, sp);
    if (App.tool === 'text') return this.placeText(cp);
    if (App.tool === 'pin') return this.pinClick(e, sp, cp);
    const h = this.hit(sp);
    if (h) return this.startHandle(e, h, sp);
    // 路径编辑：Ctrl+点击线段加点
    if (this.pathEdit && e.ctrlKey) { if (this.insertPathVertex(sp)) return; }
    // 点选
    const id = Render.pick(comp, t, cp[0], cp[1]);
    if (!id) { if (!e.shiftKey) { App.sel.layers = []; this.pathEdit = null; App.request('struct'); } return; }
    const L = Model.findLayer(comp, id); if (!L) return;
    if (this.pathEdit && this.pathEdit.layer && this.pathEdit.layer.id !== id) this.pathEdit = null;
    if (e.shiftKey) App.selectLayer(id, 'toggle'); else if (!App.sel.layers.includes(id)) App.selectLayer(id);
    if (App.tool === 'rotate') return this.startRotate(e, sp, App.selLayers());
    if (App.tool === 'anchor') return this.startAnchor(e, L, sp);
    this.startMove(e, sp, App.selLayers().filter(l => !l.locked));
  },
  dragLoop(onMove, onUp) {
    const mv = ev => { onMove(ev, this.mpos(ev)); App.edited(); this.renderSoon(); };
    const up = ev => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); this.drag = null; onUp && onUp(ev); this.drawOverlay(); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  },
  renderSoon() { App.request('view'); },
  startPan(e, sp) { this.panning = true; const p0 = this.pan.slice(); this.drag = { pan: true }; const mv = ev => { const q = this.mpos(ev); this.pan = [p0[0] + q[0] - sp[0], p0[1] + q[1] - sp[1]]; this.fitMode = false; this.render(); }; const up = () => { this.panning = false; this.drag = null; removeEventListener('mousemove', mv); removeEventListener('mouseup', up); }; addEventListener('mousemove', mv); addEventListener('mouseup', up); },
  tl(L) { return App.t - L.startTime; },
  // 当前（关键帧）值
  kv(p, L) { return U.clone(Anim.keyValue(p, App.t - (L ? L.startTime : 0))); },
  setv(p, v, L, spatial) { Anim.setValue(p, v, App.t - (L ? L.startTime : 0), spatial); },
  // 合成像素增量 → 父级空间增量
  parentDelta(comp, L, t, dcp, startW) {
    const PM = Xform.parentMatrix(comp, L, t); const IPM = M4.invert(PM);
    if (this.is3DLayer(L)) return null;
    const d = M4.dir(IPM, [dcp[0], dcp[1], 0]); return [d[0], d[1], 0];
  },
  startMove(e, sp, layers) {
    if (!layers.length) return; const comp = App.comp, t = App.t; const cam = Xform.camera(comp, t);
    const st = layers.map(L => { const PM = Xform.parentMatrix(comp, L, t); const w = M4.pt(Xform.layerMatrix(comp, L, t), Anim.evalProp(L.tr.anchor, comp, L, t)); return { L, pos0: this.kv(L.tr.position, L), PM, IPM: M4.invert(PM), w }; });
    const cp0 = this.s2c(sp); this.drag = { move: true }; let moved = false;
    this.dragLoop((ev, q) => {
      const cp = this.s2c(q); moved = true;
      for (const s of st) {
        let dw;
        if (this.is3DLayer(s.L)) { const n = V3.norm(V3.sub(cam.target, cam.eye)); const a = this.rayPlane(this.ray(comp, cam, cp0), s.w, n), b = this.rayPlane(this.ray(comp, cam, cp), s.w, n); if (!a || !b) continue; dw = V3.sub(b, a); }
        else { dw = [cp[0] - cp0[0], cp[1] - cp0[1], 0]; if (ev.shiftKey) { if (Math.abs(dw[0]) > Math.abs(dw[1])) dw[1] = 0; else dw[0] = 0; } }
        const d = M4.dir(s.IPM, dw); const v = s.pos0.slice(); v[0] += d[0]; v[1] += d[1]; if (this.is3DLayer(s.L)) v[2] = (v[2] || 0) + d[2];
        this.setv(s.L.tr.position, v, s.L, true);
      }
    }, () => { if (moved) History.commit('移动图层'); });
  },
  startHandle(e, h, sp) {
    const comp = App.comp, t = App.t, L = h.layer; const cam = Xform.camera(comp, t);
    if (h.kind === 'selectLayer') { App.selectLayer(L.id); return; }
    if (h.kind === 'rotateZone') return this.startRotate(e, sp, [L]);
    if (h.kind === 'anchor') return App.tool === 'anchor' ? this.startAnchor(e, L, sp) : this.startMove(e, sp, App.selLayers());
    if (h.kind === 'scale') {
      const s0 = this.kv(L.tr.scale, L); const M = Xform.layerMatrix(comp, L, t); const IM = M4.invert(M); const a = Anim.evalProp(L.tr.anchor, comp, L, t);
      const v0 = [h.lp[0] - a[0], h.lp[1] - a[1]]; let moved = false; this.drag = { scale: true };
      this.dragLoop((ev, q) => {
        const cp = this.s2c(q); const lp = M4.pt(IM, [cp[0], cp[1], 0]); const v1 = [lp[0] - a[0], lp[1] - a[1]]; moved = true;
        let fx = h.ax[0] && Math.abs(v0[0]) > 1e-6 ? v1[0] / v0[0] : 1, fy = h.ax[1] && Math.abs(v0[1]) > 1e-6 ? v1[1] / v0[1] : 1;
        if (ev.shiftKey && h.ax[0] && h.ax[1]) { const f = (fx + fy) / 2; fx = fy = f; }
        this.setv(L.tr.scale, [s0[0] * fx, s0[1] * fy, s0[2]], L);
      }, () => moved && History.commit('缩放图层'));
      return;
    }
    if (h.kind === 'axis') {
      const pos0 = this.kv(L.tr.position, L); const PM = Xform.parentMatrix(comp, L, t); const IPM = M4.invert(PM);
      const sd = [h.p[0] - h.o[0], h.p[1] - h.o[1]]; const sl = Math.hypot(sd[0], sd[1]) || 1; const w0 = M4.pt(Xform.layerMatrix(comp, L, t), Anim.evalProp(L.tr.anchor, comp, L, t));
      const tipW = V3.add(w0, h.dirW); const so = this.worldToComp(comp, w0, cam), st2 = this.worldToComp(comp, tipW, cam); const pxPerUnit = so && st2 ? Math.hypot(st2[0] - so[0], st2[1] - so[1]) * this.zoom : 1;
      let moved = false; this.drag = { axis: true };
      this.dragLoop((ev, q) => { const d = ((q[0] - sp[0]) * sd[0] + (q[1] - sp[1]) * sd[1]) / sl; const units = d / (pxPerUnit || 1); const dw = V3.mul(h.dirW, units); const dl = M4.dir(IPM, dw); moved = true; this.setv(L.tr.position, [pos0[0] + dl[0], pos0[1] + dl[1], (pos0[2] || 0) + dl[2]], L, true); }, () => moved && History.commit('沿轴移动'));
      return;
    }
    if (h.kind === 'pathKey' || h.kind === 'tangent') {
      const k = h.key; const tk = k.t + L.startTime; const PM = Xform.parentMatrix(comp, L, tk); const IPM = M4.invert(PM);
      App.sel.keys = new Set([k]);
      const v0 = k.v.slice(); const tg = Anim.spatialTangents(h.prop, h.idx); const t0 = { ti: tg.ti.slice(), to: tg.to.slice() };
      const wAnchor = M4.pt(PM, [...v0, 0].slice(0, 3));
      let moved = false; this.drag = { path: true };
      this.dragLoop((ev, q) => {
        const cp = this.s2c(q); let w;
        if (this.is3DLayer(L)) { const n = V3.norm(V3.sub(cam.target, cam.eye)); w = this.rayPlane(this.ray(comp, cam, cp), wAnchor, n); if (!w) return; }
        else w = [cp[0], cp[1], 0];
        const lp = M4.pt(IPM, w); moved = true;
        if (h.kind === 'pathKey') { const nv = v0.slice(); nv[0] = lp[0]; nv[1] = lp[1]; if (this.is3DLayer(L) && nv.length > 2) nv[2] = lp[2]; k.v = nv; }
        else {
          const d = [lp[0] - k.v[0], lp[1] - k.v[1], this.is3DLayer(L) ? lp[2] - (k.v[2] || 0) : 0].slice(0, k.v.length);
          if (k.sp !== 'manual') { k.ti = t0.ti.slice(); k.to = t0.to.slice(); k.sp = 'manual'; }
          k[h.which] = d;
          const other = h.which === 'ti' ? 'to' : 'ti';
          if (!ev.altKey && k.sc !== false) { const ol = U.vecLen(k[other]) || U.vecLen(d); const dl = U.vecLen(d) || 1; k[other] = d.map(x => -x / dl * ol); } else k.sc = false;
        }
        Anim.touch();
      }, () => { if (moved) History.commit(h.kind === 'pathKey' ? '编辑运动路径' : '编辑空间手柄'); App.request('tl'); });
      return;
    }
    if (h.kind === 'pathVert' || h.kind === 'pathTan') {
      const prop = h.prop; this.pathSel = { ci: h.ci, vi: h.vi };
      if (h.kind === 'pathVert' && e.altKey) { const path = this.kv(prop, L); const ct = path.c[h.ci]; const has = ct.i[h.vi].some(x => x) || ct.o[h.vi].some(x => x); if (has) { ct.i[h.vi] = [0, 0]; ct.o[h.vi] = [0, 0]; } else { const n = ct.v.length; const a = ct.v[(h.vi - 1 + n) % n], b = ct.v[(h.vi + 1) % n]; const d = [(b[0] - a[0]) / 6, (b[1] - a[1]) / 6]; ct.o[h.vi] = d; ct.i[h.vi] = [-d[0], -d[1]]; } this.setv(prop, path, L); App.edited('转换顶点'); return; }
      const toLocal = cp => { let q = this.compToLayer(comp, L, t, cp); if (h.groupM) { const gm = h.groupM; const det = gm[0] * gm[3] - gm[1] * gm[2]; const x = q[0] - gm[4], y = q[1] - gm[5]; q = [(gm[3] * x - gm[2] * y) / det, (-gm[1] * x + gm[0] * y) / det]; } return q; };
      const path0 = this.kv(prop, L); let moved = false; this.drag = { pathEdit: true };
      this.dragLoop((ev, q) => {
        const lp = toLocal(this.s2c(q)); const path = U.clone(path0); const ct = path.c[h.ci]; moved = true;
        if (h.kind === 'pathVert') ct.v[h.vi] = lp;
        else { const v = ct.v[h.vi]; const d = [lp[0] - v[0], lp[1] - v[1]]; ct[h.which][h.vi] = d; if (!ev.altKey) { const o = h.which === 'i' ? 'o' : 'i'; const ol = Math.hypot(...ct[o][h.vi]) || Math.hypot(...d); const dl = Math.hypot(...d) || 1; ct[o][h.vi] = [-d[0] / dl * ol, -d[1] / dl * ol]; } }
        this.setv(prop, path, L);
      }, () => moved && History.commit('编辑路径'));
      return;
    }
    if (h.kind === 'pin' || h.kind === 'nodePin') {
      const pin = h.pin; const o0 = U.clone(Anim.keyValue(pin.off, h.kind === 'pin' ? App.t - L.startTime : App.t));
      const start = h.kind === 'pin' ? this.compToLayer(comp, L, t, this.s2c(sp)) : this.compToLayer(comp, L, t, this.s2c(sp));
      let moved = false; this.drag = { pin: true };
      this.dragLoop((ev, q) => { const lp = this.compToLayer(comp, L, t, this.s2c(q)); moved = true; Anim.setValue(pin.off, [o0[0] + lp[0] - start[0], o0[1] + lp[1] - start[1]], h.kind === 'pin' ? App.t - L.startTime : App.t); }, () => moved && History.commit('移动图钉'));
      return;
    }
    if (h.kind === 'poi' || h.kind === 'lightPos' || h.kind === 'emitter') {
      const prop = h.kind === 'poi' ? h.prop : h.kind === 'emitter' ? h.em.pos : L.tr.position;
      const PM = h.kind === 'emitter' ? Xform.layerMatrix(comp, L, t) : Xform.parentMatrix(comp, L, t); const IPM = M4.invert(PM);
      const v0 = this.kv(prop, L); const w0 = M4.pt(PM, v0); const n = V3.norm(V3.sub(cam.target, cam.eye)); const a = this.rayPlane(this.ray(comp, cam, this.s2c(sp)), w0, n);
      let moved = false; this.drag = { poi: true };
      this.dragLoop((ev, q) => { const b = this.rayPlane(this.ray(comp, cam, this.s2c(q)), w0, n); if (!a || !b) return; const d = M4.dir(IPM, V3.sub(b, a)); moved = true; this.setv(prop, [v0[0] + d[0], v0[1] + d[1], (v0[2] || 0) + d[2]], L, true); }, () => moved && History.commit('移动'));
      return;
    }
  },
  startRotate(e, sp, layers) {
    const comp = App.comp, t = App.t; if (!layers.length) return;
    const st = layers.map(L => { const a = Anim.evalProp(L.tr.anchor, comp, L, t); const o = this.toComp(comp, L, t, a); return { L, r0: this.kv(L.tr.rotation, L), o: o ? this.c2s(o) : sp }; });
    let moved = false; this.drag = { rotate: true };
    this.dragLoop((ev, q) => { moved = true; for (const s of st) { const a0 = Math.atan2(sp[1] - s.o[1], sp[0] - s.o[0]), a1 = Math.atan2(q[1] - s.o[1], q[0] - s.o[0]); let d = U.deg(a1 - a0); if (ev.shiftKey) d = Math.round(d / 15) * 15; this.setv(s.L.tr.rotation, s.r0 + d, s.L); } }, () => moved && History.commit('旋转图层'));
  },
  // 锚点：移动锚点，画面不变
  startAnchor(e, L, sp) {
    const comp = App.comp, t = App.t; const a0 = this.kv(L.tr.anchor, L), p0 = this.kv(L.tr.position, L);
    const loc = Xform.local(comp, L, t); // 父空间
    let moved = false; this.drag = { anchor: true };
    this.dragLoop((ev, q) => {
      const lp = this.compToLayer(comp, L, t, this.s2c(q)); moved = true;
      // 使用初始变换计算
      const na = [lp[0], lp[1], a0[2] || 0];
      const d = M4.dir(loc, [na[0] - a0[0], na[1] - a0[1], 0]);
      this.setv(L.tr.anchor, na, L); this.setv(L.tr.position, [p0[0] + d[0], p0[1] + d[1], (p0[2] || 0) + d[2]], L, true);
    }, () => moved && History.commit('移动锚点'));
  },
  // 绘制矩形/椭圆：形状层内新增，或为其他图层建蒙版，或新建形状图层
  startShapeDraw(e, sp) {
    const comp = App.comp, t = App.t; const cp0 = this.s2c(sp); let cp1 = cp0;
    const tgt = App.selLayers()[0];
    this.drawTmp = c => { const a = this.c2s(cp0), b = this.c2s(cp1); c.strokeStyle = '#59a8ff'; c.setLineDash([4, 3]); if (App.tool === 'rect') c.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); else { c.beginPath(); c.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2); c.stroke(); } c.setLineDash([]); };
    const mv = ev => { cp1 = this.s2c(this.mpos(ev)); if (ev.shiftKey) { const d = Math.max(Math.abs(cp1[0] - cp0[0]), Math.abs(cp1[1] - cp0[1])); cp1 = [cp0[0] + Math.sign(cp1[0] - cp0[0]) * d, cp0[1] + Math.sign(cp1[1] - cp0[1]) * d]; } this.drawOverlay(); };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up); this.drawTmp = null;
      const w = Math.abs(cp1[0] - cp0[0]), h = Math.abs(cp1[1] - cp0[1]); if (w < 3 || h < 3) return this.drawOverlay();
      const cx = (cp0[0] + cp1[0]) / 2, cy = (cp0[1] + cp1[1]) / 2;
      if (tgt && tgt.type !== 'shape' && !this.is3DLayer(tgt)) {
        const a = this.compToLayer(comp, tgt, t, cp0), b = this.compToLayer(comp, tgt, t, cp1);
        const ctr = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], sz = [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])];
        const ct = App.tool === 'rect' ? Geo2D.rect(ctr[0], ctr[1], sz[0], sz[1]) : Geo2D.ellipse(ctr[0], ctr[1], sz[0], sz[1]);
        tgt.masks.push(Model.newMask({ c: [ct] }, '蒙版 ' + (tgt.masks.length + 1))); return App.structChanged('新建蒙版');
      }
      const it = Model.newShapeItem(App.tool, { size: [w, h], pos: [0, 0] });
      if (tgt && tgt.type === 'shape') {
        const lc = this.compToLayer(comp, tgt, t, [cx, cy]);
        const g = Model.newShapeItem('group', { name: (App.tool === 'rect' ? '矩形 ' : '椭圆 ') + (tgt.contents.length + 1) }); g.tr.position.v = lc; g.items.push(it, Model.newShapeItem('fill', { color: [0.35, 0.65, 1] }), Model.newShapeItem('stroke', { width: 4, color: [1, 1, 1] })); tgt.contents.unshift(g); return App.structChanged('添加形状');
      }
      const L = App.newLayer('shape', { empty: true, name: '形状图层 ' + (comp.layers.filter(l => l.type === 'shape').length + 1) });
      const g = Model.newShapeItem('group', { name: App.tool === 'rect' ? '矩形 1' : '椭圆 1' }); g.items.push(it, Model.newShapeItem('fill', { color: [1, 0.55, 0.2] }));
      L.contents.push(g); L.tr.position.v = [cx, cy, 0]; App.structChanged('绘制形状');
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  },
  // 钢笔
  penClick(e, sp) {
    const comp = App.comp, t = App.t; const cp = this.s2c(sp);
    if (!this.pen) {
      const tgt = App.selLayers()[0];
      if (tgt && !this.is3DLayer(tgt)) this.pen = { target: tgt, v: [], i: [], o: [], toComp: q => { const r = this.toComp(comp, tgt, t, [q[0], q[1], 0]); return r || [0, 0]; }, toLocal: c => this.compToLayer(comp, tgt, t, c) };
      else this.pen = { target: null, v: [], i: [], o: [], toComp: q => q, toLocal: c => c };
    }
    const P = this.pen; const lp = P.toLocal(cp);
    if (P.v.length > 2) { const f = this.c2s(P.toComp(P.v[0])); if (Math.hypot(f[0] - sp[0], f[1] - sp[1]) < 8) return this.finishPen(true); }
    P.v.push(lp); P.i.push([0, 0]); P.o.push([0, 0]);
    const idx = P.v.length - 1;
    const mv = ev => { const q = P.toLocal(this.s2c(this.mpos(ev))); const d = [q[0] - lp[0], q[1] - lp[1]]; P.o[idx] = d; P.i[idx] = [-d[0], -d[1]]; this.drawOverlay(); };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up); this.drawOverlay();
  },
  finishPen(closed) {
    const P = this.pen; this.pen = null; if (!P || P.v.length < 2) return this.drawOverlay();
    const ct = { closed, v: P.v, i: P.i, o: P.o }; const comp = App.comp;
    if (P.target && P.target.type !== 'shape') { P.target.masks.push(Model.newMask({ c: [ct] }, '蒙版 ' + (P.target.masks.length + 1))); return App.structChanged('钢笔蒙版'); }
    if (P.target && P.target.type === 'shape') { const g = Model.newShapeItem('group', { name: '路径 ' + (P.target.contents.length + 1) }); g.items.push(Model.newShapeItem('path', { path: { c: [ct] } }), Model.newShapeItem('stroke', { width: 6, color: [1, 0.8, 0.4] })); if (closed) g.items.push(Model.newShapeItem('fill', { color: [0.3, 0.6, 1] })); P.target.contents.unshift(g); return App.structChanged('钢笔路径'); }
    const L = App.newLayer('shape', { empty: true, name: '路径图层' }); L.tr.position.v = [0, 0, 0];
    const g = Model.newShapeItem('group', { name: '路径 1' }); g.items.push(Model.newShapeItem('path', { path: { c: [ct] } }), Model.newShapeItem('stroke', { width: 6, color: [1, 0.8, 0.4] })); if (closed) g.items.push(Model.newShapeItem('fill', { color: [0.3, 0.6, 1] }));
    L.contents.push(g); App.structChanged('钢笔路径');
  },
  insertPathVertex(sp) {
    const pe = this.pathEdit; const comp = App.comp, t = App.t; const L = pe.layer; const path = this.kv(pe.prop, L);
    const tp = q => { let x = q; if (pe.groupM) x = Shapes.apA(pe.groupM, q); const r = this.toComp(comp, L, t, [x[0], x[1], 0]); return r ? this.c2s(r) : [0, 0]; };
    let best = null;
    path.c.forEach((ct, ci) => { const n = ct.v.length; const segs = ct.closed ? n : n - 1; for (let s = 0; s < segs; s++) { const a = ct.v[s], b = ct.v[(s + 1) % n]; for (let k = 1; k < 20; k++) { const u = k / 20; const q = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; const S = tp(q); const d = Math.hypot(S[0] - sp[0], S[1] - sp[1]); if (d < 8 && (!best || d < best.d)) best = { d, ci, s, q }; } } });
    if (!best) return false;
    const ct = path.c[best.ci]; ct.v.splice(best.s + 1, 0, best.q); ct.i.splice(best.s + 1, 0, [0, 0]); ct.o.splice(best.s + 1, 0, [0, 0]);
    this.setv(pe.prop, path, L); App.edited('添加顶点'); return true;
  },
  deletePathVertex() {
    const pe = this.pathEdit, ps = this.pathSel; if (!pe || !ps) return false; const L = pe.layer; const path = this.kv(pe.prop, L); const ct = path.c[ps.ci]; if (!ct || ct.v.length <= 2) return false;
    ct.v.splice(ps.vi, 1); ct.i.splice(ps.vi, 1); ct.o.splice(ps.vi, 1); this.pathSel = null; this.setv(pe.prop, path, L); App.edited('删除顶点'); return true;
  },
  placeText(cp) {
    const L = App.newLayer('text'); L.tr.position.v = [cp[0], cp[1], 0]; L.text.source.v = '文字'; App.setTool('select'); App.structChanged('新建文字');
    setTimeout(() => { const ta = document.querySelector('#inspBody textarea.txt'); if (ta) { ta.focus(); ta.select(); } }, 60);
  },
  pinClick(e, sp, cp) {
    const comp = App.comp, t = App.t; const h = this.hit(sp, ['pin', 'nodePin']); if (h) return this.startHandle(e, h, sp);
    let L = App.selLayers()[0]; const id = Render.pick(comp, t, cp[0], cp[1]); if (id) L = Model.findLayer(comp, id);
    if (!L) return App.toast('请在图层上点击添加图钉');
    if (L.type === 'geo') {
      const pw = comp.graph.nodes.find(n => n.type === 'pinWarp'); if (!pw) return App.toast('该几何的节点网络中没有「图钉变形」节点');
      const lp = this.compToLayer(comp, L, t, cp); const pin = Model.newPin(lp); pin.off = Model.P([0, 0]); pw.pins.push(pin); App.selectLayer(L.id); return App.structChanged('添加图钉');
    }
    if (this.is3DLayer(L)) return App.toast('操控图钉作用于二维图层');
    let eff = L.effects.find(x => x.type === 'puppet'); if (!eff) { eff = Model.newEffect('puppet'); eff.meshT = t; L.effects.unshift(eff); }
    const lp = this.compToLayer(comp, L, t, cp); eff.pins.push(Model.newPin(lp)); App.sel.layers = [L.id]; App.structChanged('添加图钉');
  },
  // 摄像机轨道
  startOrbit(e, sp) {
    const comp = App.comp, t = App.t; const C = Xform.activeCamera(comp, t); if (!C) return App.toast('合成中没有摄像机图层');
    const pos0 = this.kv(C.tr.position, C), poi0 = this.kv(C.cam.poi, C); const right = e.button === 2;
    let moved = false;
    this.dragLoop((ev, q) => {
      const dx = q[0] - sp[0], dy = q[1] - sp[1]; moved = true;
      if (right) { const cam = Xform.camera(comp, t); const r = V3.norm([cam.view[0], cam.view[4], cam.view[8]]), u = V3.norm([cam.view[1], cam.view[5], cam.view[9]]); const k = V3.dist(pos0, poi0) / (comp.height * this.zoom); const d = V3.add(V3.mul(r, -dx * k), V3.mul(u, dy * k)); this.setv(C.tr.position, V3.add(pos0, d), C, true); this.setv(C.cam.poi, V3.add(poi0, d), C, true); return; }
      const off = V3.sub(pos0, poi0); const R = V3.len(off); let yaw = Math.atan2(off[0], -off[2]), pit = Math.asin(U.clamp(-off[1] / R, -1, 1));
      yaw += dx * 0.006; pit = U.clamp(pit + dy * 0.006, -1.45, 1.45);
      const np = [poi0[0] + R * Math.cos(pit) * Math.sin(yaw), poi0[1] - R * Math.sin(pit), poi0[2] - R * Math.cos(pit) * Math.cos(yaw)];
      this.setv(C.tr.position, np, C, true);
    }, () => moved && History.commit('摄像机轨道'));
  },
  camDolly(dy) {
    const comp = App.comp; const C = Xform.activeCamera(comp, App.t); if (!C) return; const pos = this.kv(C.tr.position, C), poi = this.kv(C.cam.poi, C);
    const d = V3.sub(pos, poi); const f = dy > 0 ? 1.08 : 1 / 1.08; this.setv(C.tr.position, V3.add(poi, V3.mul(d, f)), C, true); App.edited(); clearTimeout(this._dt); this._dt = setTimeout(() => History.commit('摄像机推拉'), 400);
  },
};
