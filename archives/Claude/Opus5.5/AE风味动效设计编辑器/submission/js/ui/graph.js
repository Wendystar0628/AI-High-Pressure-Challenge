// 曲线编辑器：值曲线 / 速度曲线，多曲线标注，关键帧与手柄拖动（联动/断开），适配，数值输入，缓动预设与预览，表达式最终曲线
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, E = AE.Eval, A = AE.Anim, Mdl = AE.Model, W = AE.W, App = AE.App;
  const GR = AE.Graph = { mode: 'value', t0: 0, t1: 10, v0: -100, v1: 100, auto: true, hidden: new Set() };
  const COLS = ['#ff5a5f', '#3ecf8e', '#4cc9f0', '#f2c14e', '#ff5d8f', '#9b8cff', '#ff9f43', '#7fe3d0'];
  let cv, cx, side, Wd, Ht;
  GR.init = () => {
    cv = document.getElementById('grc'); cx = cv.getContext('2d'); side = document.getElementById('graphSide');
    cv.addEventListener('mousedown', onDown); cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', e => { e.preventDefault(); W.menu(e.clientX, e.clientY, [{ label: '缓入缓出', fn: () => App.easeKeys('easy') }, { label: '线性', fn: () => App.setInterp('linear') }, { label: '定格', fn: () => App.setInterp('hold') }, { label: '适配', fn: GR.fit }]); });
    App.panels.graph = GR;
    buildSide();
  };
  // 显示的曲线
  function curves() {
    const comp = App.comp(), out = [];
    let props = Array.from(App.sel.props).filter(p => p._layer && comp.layers.includes(p._layer));
    if (!props.length) for (const l of App.layers()) for (const x of Mdl.layerProps(l)) if (x.prop.anim || (x.prop.exprOn && x.prop.expr)) props.push(x.prop);
    let ci = 0;
    for (const p of props) {
      if (p.type === 'path' || p.type === 'text' || p.type === 'color') continue;
      const l = p._layer, dims = p.type === 'num' ? 1 : AE.Tree.dims(p, l);
      const name = Mdl.label((p._path || '').split('.').pop());
      for (let d = 0; d < dims; d++) { const id = (p._path || '') + '#' + d + '@' + (l && l.id); out.push({ p, l, d, dims, id, name: (l ? l.name + ' · ' : '') + name + (dims > 1 ? ' ' + 'XYZ'[d] : ''), col: COLS[ci++ % COLS.length] }); }
    }
    return out;
  }
  const X = (t) => 50 + (t - GR.t0) / (GR.t1 - GR.t0) * (Wd - 60);
  const Y = (v) => Ht - 24 - (v - GR.v0) / (GR.v1 - GR.v0 || 1) * (Ht - 44);
  const XT = (x) => GR.t0 + (x - 50) / (Wd - 60) * (GR.t1 - GR.t0);
  const YV = (y) => GR.v0 + (Ht - 24 - y) / (Ht - 44) * (GR.v1 - GR.v0);
  const comp1 = (v, d) => typeof v === 'number' ? v : v[d];
  const ctxNow = () => App.ctx();
  function sampleFinal(c, t) { return comp1(E.prop(c.p, t, ctxNow(), c.l), c.d); }
  function sampleRaw(c, t) { return comp1(E.propRaw(c.p, t, ctxNow()), c.d); }
  function speed(c, t, final) {
    const f = (tt) => final ? E.prop(c.p, tt, ctxNow(), c.l) : E.propRaw(c.p, tt, ctxNow());
    if (c.dims > 1 && c.p.type !== 'num') { if (c.d > 0) return null; return A.velocity(f, t); }
    return A.velocity((tt) => comp1(f(tt), c.d), t);
  }
  GR.fit = () => {
    const cs = curves().filter(c => !GR.hidden.has(c.id)); const comp = App.comp();
    let t0 = Infinity, t1 = -Infinity;
    for (const c of cs) if (c.p.anim && c.p.keys.length) { t0 = Math.min(t0, c.p.keys[0].t); t1 = Math.max(t1, c.p.keys[c.p.keys.length - 1].t); }
    if (!isFinite(t0) || t1 - t0 < 0.05) { t0 = 0; t1 = comp.duration; }
    const pad = (t1 - t0) * 0.08 + 0.05; GR.t0 = t0 - pad; GR.t1 = t1 + pad;
    let v0 = Infinity, v1 = -Infinity;
    for (const c of cs) for (let i = 0; i <= 120; i++) { const t = GR.t0 + (GR.t1 - GR.t0) * i / 120; const v = GR.mode === 'value' ? sampleFinal(c, t) : speed(c, t, true); if (v === null || !isFinite(v)) continue; v0 = Math.min(v0, v); v1 = Math.max(v1, v); if (GR.mode === 'value') { const r = sampleRaw(c, t); v0 = Math.min(v0, r); v1 = Math.max(v1, r); } }
    if (!isFinite(v0)) { v0 = -1; v1 = 1; }
    if (GR.mode === 'speed') v0 = Math.min(0, v0);
    const vp = (v1 - v0) * 0.12 + 1e-3; GR.v0 = v0 - vp; GR.v1 = v1 + vp;
    App.mark('graph');
  };
  let handles = [], lastSig = '';
  GR.draw = () => {
    const f = W.fitCanvas(cv); Wd = f.w; Ht = f.h; cx.setTransform(f.d, 0, 0, f.d, 0, 0);
    cx.fillStyle = '#13161c'; cx.fillRect(0, 0, Wd, Ht);
    const cs = curves();
    const sig = cs.map(c => c.id).join('|') + GR.mode;
    if (sig !== lastSig) { lastSig = sig; GR.fit(); updateSide(cs); }
    handles = [];
    // 网格
    cx.font = '10px Consolas,monospace'; cx.strokeStyle = '#1e222b'; cx.fillStyle = '#5a6170';
    const tStep = niceStep((GR.t1 - GR.t0) / 10), vStep = niceStep((GR.v1 - GR.v0) / 6);
    for (let t = Math.ceil(GR.t0 / tStep) * tStep; t <= GR.t1; t += tStep) { const x = X(t); cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, Ht - 20); cx.stroke(); cx.fillText(t.toFixed(tStep < 0.1 ? 2 : 1) + 's', x + 2, Ht - 8); }
    for (let v = Math.ceil(GR.v0 / vStep) * vStep; v <= GR.v1; v += vStep) { const y = Y(v); cx.beginPath(); cx.moveTo(48, y); cx.lineTo(Wd, y); cx.stroke(); cx.fillText(U.fmt(v, Math.abs(vStep) < 1 ? 2 : 0), 2, y + 3); }
    if (GR.v0 < 0 && GR.v1 > 0) { cx.strokeStyle = '#2f3542'; cx.beginPath(); cx.moveTo(48, Y(0)); cx.lineTo(Wd, Y(0)); cx.stroke(); }
    // 播放头
    const pt = X(App.t()); cx.strokeStyle = '#ff9f43'; cx.beginPath(); cx.moveTo(pt, 0); cx.lineTo(pt, Ht - 20); cx.stroke();
    if (!cs.length) { cx.fillStyle = '#7c8494'; cx.font = '13px sans-serif'; cx.fillText('选择带关键帧或表达式的图层/属性以显示曲线（时间轴中单击属性名）', 70, Ht / 2); return; }
    const N = Math.max(60, Math.round(Wd / 3));
    for (const c of cs) {
      if (GR.hidden.has(c.id)) continue;
      const hasExpr = c.p.exprOn && c.p.expr;
      // 关键帧曲线
      cx.lineWidth = 1.6; cx.strokeStyle = c.col; cx.setLineDash([]);
      cx.beginPath();
      for (let i = 0; i <= N; i++) { const t = GR.t0 + (GR.t1 - GR.t0) * i / N; const v = GR.mode === 'value' ? sampleRaw(c, t) : speed(c, t, false); if (v === null) continue; const x = X(t), y = Y(v); if (i) cx.lineTo(x, y); else cx.moveTo(x, y); }
      cx.globalAlpha = hasExpr ? 0.45 : 1; cx.stroke(); cx.globalAlpha = 1;
      // 表达式最终曲线
      if (hasExpr) {
        cx.setLineDash([5, 3]); cx.lineWidth = 1.4; cx.beginPath();
        for (let i = 0; i <= N; i++) { const t = GR.t0 + (GR.t1 - GR.t0) * i / N; const v = GR.mode === 'value' ? sampleFinal(c, t) : speed(c, t, true); if (v === null) continue; const x = X(t), y = Y(v); if (i) cx.lineTo(x, y); else cx.moveTo(x, y); }
        cx.stroke(); cx.setLineDash([]);
      }
      // 位置：逐帧点
      if (c.p.spatial && GR.mode === 'value') { cx.fillStyle = c.col; const fd = 1 / App.comp().fps; for (let t = Math.max(0, Math.ceil(GR.t0 / fd) * fd); t <= GR.t1; t += fd) { cx.fillRect(X(t) - 1, Y(sampleFinal(c, t)) - 1, 2, 2); } }
      // 关键帧与手柄
      if (!c.p.anim) continue;
      const keys = c.p.keys;
      keys.forEach((k, i) => {
        const sel = App.sel.keys.has(k);
        App.registerKey(k, c.p);
        let kv;
        if (GR.mode === 'value') kv = comp1(k.v, c.d);
        else { if (c.d > 0 && c.dims > 1 && c.p.type !== 'num') return; kv = speedAtKey(c, i, 'out'); }
        const x = X(k.t), y = Y(kv);
        // 手柄
        const showH = sel || keys.length < 8;
        if (showH) for (const side of ['in', 'out']) {
          const seg = side === 'out' ? i : i - 1;
          if (seg < 0 || seg >= keys.length - 1) continue;
          const kk = keys[seg], interp = side === 'out' ? k.oi : k.ii;
          if (interp !== 'bezier') continue;
          if (GR.mode === 'value' && c.p.type !== 'num') continue;
          const sb = A.segBezier(c.p, keys, seg);
          let hx, hy;
          if (GR.mode === 'value') { const p = side === 'out' ? sb.p1 : sb.p2; hx = X(kk.t + p[0]); hy = Y(keys[seg].v + p[1]); }
          else { const e = side === 'out' ? k.oe : k.ie; const sp = k.auto ? speedAtKey(c, i, side) : e.s; hx = X(k.t + (side === 'out' ? 1 : -1) * e.f * sb.dt); hy = Y(Math.abs(sp) * (c.p.type === 'num' ? Math.sign(sp || 1) : 1)); if (c.p.type === 'num') hy = Y(sp); }
          cx.strokeStyle = 'rgba(255,255,255,.4)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(x, GR.mode === 'value' ? y : Y(speedAtKey(c, i, side))); cx.lineTo(hx, hy); cx.stroke();
          cx.fillStyle = '#ffd8a8'; cx.beginPath(); cx.arc(hx, hy, 3.5, 0, 7); cx.fill();
          handles.push({ kind: 'h', c, k, i, side, seg, x: hx, y: hy });
        }
        cx.fillStyle = sel ? '#ff9f43' : '#e8ebf0'; cx.strokeStyle = '#13161c';
        cx.beginPath(); cx.rect(x - 4, (GR.mode === 'value' ? y : Y(speedAtKey(c, i, 'out'))) - 4, 8, 8); cx.fill(); cx.stroke();
        handles.push({ kind: 'k', c, k, i, x, y: GR.mode === 'value' ? y : Y(speedAtKey(c, i, 'out')) });
      });
    }
    // 标注
    cx.font = '11px sans-serif'; let ly = 14;
    for (const c of cs) { if (GR.hidden.has(c.id)) continue; cx.fillStyle = c.col; cx.fillRect(Wd - 230, ly - 8, 10, 3); cx.fillStyle = '#aab1bf'; cx.fillText(c.name + (c.p.exprOn && c.p.expr ? '（虚线=表达式结果）' : ''), Wd - 214, ly - 3); ly += 15; if (ly > Ht - 30) break; }
    cx.fillStyle = '#7c8494'; cx.fillText(GR.mode === 'value' ? '值曲线' : '速度曲线（单位/秒）', 54, 14);
    if (box) { cx.strokeStyle = '#ff9f43'; cx.fillStyle = 'rgba(255,159,67,.1)'; const [a, b, c2, d] = box; cx.fillRect(Math.min(a, c2), Math.min(b, d), Math.abs(c2 - a), Math.abs(d - b)); cx.strokeRect(Math.min(a, c2), Math.min(b, d), Math.abs(c2 - a), Math.abs(d - b)); }
    updateNumeric();
  };
  function speedAtKey(c, i, side) {
    const k = c.p.keys[i], dt = 1 / 600;
    const t = side === 'out' ? Math.min(k.t + dt, c.p.keys[c.p.keys.length - 1].t) : Math.max(k.t - dt, c.p.keys[0].t);
    const v = speed(c, side === 'out' ? k.t + dt : k.t - dt, false);
    return v === null ? 0 : v;
  }
  const niceStep = (x) => { const p = Math.pow(10, Math.floor(Math.log10(x || 1))); const m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  function onWheel(e) {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, f = Math.exp(e.deltaY * 0.0015);
    if (e.shiftKey) { const tc = XT(x); GR.t0 = tc - (tc - GR.t0) * f; GR.t1 = tc + (GR.t1 - tc) * f; }
    else if (e.ctrlKey) { const vc = YV(y); GR.v0 = vc - (vc - GR.v0) * f; GR.v1 = vc + (GR.v1 - vc) * f; }
    else { const tc = XT(x), vc = YV(y); GR.t0 = tc - (tc - GR.t0) * f; GR.t1 = tc + (GR.t1 - tc) * f; GR.v0 = vc - (vc - GR.v0) * f; GR.v1 = vc + (GR.v1 - vc) * f; }
    App.mark('graph');
  }
  let box = null;
  function onDown(e) {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (e.button === 1) { const t0 = GR.t0, t1 = GR.t1, v0 = GR.v0, v1 = GR.v1, x0 = e.clientX, y0 = e.clientY; const mm = (ev) => { const dt = (ev.clientX - x0) / (Wd - 60) * (t1 - t0), dv = (ev.clientY - y0) / (Ht - 44) * (v1 - v0); GR.t0 = t0 - dt; GR.t1 = t1 - dt; GR.v0 = v0 + dv; GR.v1 = v1 + dv; App.mark('graph'); }; const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); }; addEventListener('mousemove', mm); addEventListener('mouseup', mu); return; }
    if (e.button !== 0) return;
    let h = null, bd = 8;
    for (const q of handles) { const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; h = q; } }
    if (!h) {
      if (y > Ht - 20) { App.setTime(XT(x)); return; }
      if (!e.shiftKey) App.sel.keys.clear();
      box = [x, y, x, y];
      const mm = (ev) => { box[2] = ev.clientX - r.left; box[3] = ev.clientY - r.top; App.mark('graph'); };
      const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); const [a, b, c, d] = box; box = null; for (const q of handles) if (q.kind === 'k' && q.x >= Math.min(a, c) && q.x <= Math.max(a, c) && q.y >= Math.min(b, d) && q.y <= Math.max(b, d)) App.sel.keys.add(q.k); App.mark(); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu); return;
    }
    const p = h.c.p, keys = p.keys;
    let started = false;
    const begin = () => { if (!started) { started = true; App.begin(); } };
    if (h.kind === 'k') {
      if (e.shiftKey) { if (App.sel.keys.has(h.k)) App.sel.keys.delete(h.k); else App.sel.keys.add(h.k); }
      else if (!App.sel.keys.has(h.k)) { App.sel.keys.clear(); App.sel.keys.add(h.k); }
      const sel = Array.from(App.sel.keys), t0s = sel.map(k => k.t), v0s = sel.map(k => U.clone(k.v));
      const comp = App.comp();
      const mm = (ev) => {
        begin();
        const dt = (ev.clientX - e.clientX) / (Wd - 60) * (GR.t1 - GR.t0);
        const dv = -(ev.clientY - e.clientY) / (Ht - 44) * (GR.v1 - GR.v0);
        sel.forEach((k, i) => {
          k.t = Math.round((t0s[i] + dt) * comp.fps * 2) / (comp.fps * 2);
          if (GR.mode === 'value' && !ev.altKey) { const ow = App.keyOwner.get(k); if (ow === p) { if (typeof k.v === 'number') k.v = v0s[i] + dv; else if (Array.isArray(k.v)) { k.v = v0s[i].slice(); k.v[h.c.d] += dv; } } }
        });
        for (const [pp] of App.selectedKeysByProp()) A.sortKeys(pp);
        E.bump(); App.mark('graph', 'viewer', 'timeline', 'props');
      };
      const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); if (started) App.commit('移动关键帧（曲线）'); App.mark(); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu);
      App.mark(); return;
    }
    // 手柄
    const k = h.k;
    App.sel.keys.add(k);
    const linked0 = Math.abs(k.ie.s - k.oe.s) < 1e-6 && k.ii === 'bezier' && k.oi === 'bezier';
    const mm = (ev) => {
      begin();
      const mx = ev.clientX - r.left, my = ev.clientY - r.top;
      const sb = A.segBezier(p, keys, h.seg);
      const kk = keys[h.seg];
      if (k.auto) { k.ie.s = speedAtKey(h.c, h.i, 'in'); k.oe.s = speedAtKey(h.c, h.i, 'out'); k.auto = false; }
      const e2 = h.side === 'out' ? k.oe : k.ie;
      if (GR.mode === 'value') {
        const ht = XT(mx) - k.t, hv = YV(my) - comp1(k.v, h.c.d);
        const f = U.clamp(Math.abs(ht) / sb.dt, 0.01, 1);
        e2.f = f; e2.s = Math.abs(ht) > 1e-6 ? hv / Math.abs(ht) * (h.side === 'out' ? 1 : -1) : e2.s;
      } else {
        const ht = Math.abs(XT(mx) - k.t); e2.f = U.clamp(ht / sb.dt, 0.01, 1); e2.s = YV(my);
      }
      // 联动：保持两侧速度一致（Alt 断开）
      if (linked0 && !ev.altKey) { if (h.side === 'out') k.ie.s = k.oe.s; else k.oe.s = k.ie.s; }
      E.bump(); App.mark('graph', 'viewer', 'timeline', 'props');
    };
    const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); if (started) App.commit('调整曲线手柄'); };
    addEventListener('mousemove', mm); addEventListener('mouseup', mu);
  }
  // ---------- 侧栏 ----------
  let listEl, numEl, prevCv;
  function buildSide() {
    const el = W.el;
    side.append(
      el('div', { class: 'seg', style: { marginBottom: '8px' } }, el('div', { class: 'on', id: 'gmV', text: '值曲线', onclick: () => setMode('value') }), el('div', { id: 'gmS', text: '速度曲线', onclick: () => setMode('speed') })),
      el('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' } }, el('button', { class: 'btn sm', text: '适配', onclick: GR.fit }), el('button', { class: 'btn sm', text: '缓入缓出 F9', onclick: () => App.easeKeys('easy') }), el('button', { class: 'btn sm', text: '线性', onclick: () => App.setInterp('linear') }), el('button', { class: 'btn sm', text: '定格', onclick: () => App.setInterp('hold') })),
      el('div', { class: 'sub-h', text: '缓动预设（应用到所选关键帧）' }),
    );
    const presets = [['柔和', 0.33, 0.33, 0, 0], ['强缓出', 0.1, 0.85, 0, 0], ['强缓入', 0.85, 0.1, 0, 0], ['预备', 0.5, 0.4, -0.35, 0], ['过冲', 0.3, 0.5, 0, 0.6], ['急停', 0.05, 0.6, 0, 0]];
    prevCv = el('canvas', { style: { width: '100%', height: '46px', background: '#0f1217', borderRadius: '5px', border: '1px solid #272c37', marginTop: '6px' } });
    const pr = el('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } }, ...presets.map(([n, fo, fi, so, si]) => {
      const b = el('button', { class: 'btn sm', text: n, onclick: () => applyPreset(fo, fi, so, si) });
      b.addEventListener('mouseenter', () => preview(fo, fi, so, si)); return b;
    }));
    side.append(pr, prevCv);
    numEl = el('div', { style: { marginTop: '8px' } });
    listEl = el('div', { style: { marginTop: '8px' } });
    side.append(el('div', { class: 'sub-h', text: '所选关键帧（数值输入）' }), numEl, el('div', { class: 'sub-h', text: '曲线（单击显示/隐藏）' }), listEl);
    preview(0.33, 0.33, 0, 0);
  }
  function setMode(m) { GR.mode = m; document.getElementById('gmV').classList.toggle('on', m === 'value'); document.getElementById('gmS').classList.toggle('on', m === 'speed'); lastSig = ''; App.mark('graph'); }
  // 预设：影响（出/入）与速度比例（相对平均速度）
  function applyPreset(fo, fi, so, si) {
    if (!App.sel.keys.size) { W.toast('请先选择关键帧'); return; }
    App.edit('缓动预设', () => {
      for (const [p, ks] of App.selectedKeysByProp()) {
        for (const k of ks) {
          const i = p.keys.indexOf(k);
          const avg = (j) => { if (j < 0 || j >= p.keys.length - 1) return 0; return A.segDelta(p, p.keys, j) / (p.keys[j + 1].t - p.keys[j].t); };
          if (i < p.keys.length - 1) { k.oi = 'bezier'; k.oe = { f: fo, s: so * avg(i) }; }
          if (i > 0) { k.ii = 'bezier'; k.ie = { f: fi, s: si * avg(i - 1) }; }
          k.auto = false;
        }
      }
    });
  }
  let pvT = 0, pvRaf = 0;
  function preview(fo, fi, so, si) {
    cancelAnimationFrame(pvRaf);
    const pk = { type: 'num', anim: true, keys: [Mdl.key(0, 0, { oi: 'bezier', oe: { f: fo, s: so } }), Mdl.key(1, 1, { ii: 'bezier', ie: { f: fi, s: si } })], value: 0 };
    const st = performance.now();
    const loop = () => {
      const f = W.fitCanvas(prevCv), x = prevCv.getContext('2d'); x.setTransform(f.d, 0, 0, f.d, 0, 0); x.clearRect(0, 0, f.w, f.h);
      x.strokeStyle = '#3a4150'; x.beginPath(); for (let i = 0; i <= 60; i++) { const v = A.valueAt(pk, i / 60); const px = 6 + i / 60 * (f.w * 0.45), py = f.h - 6 - v * (f.h - 12); if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke();
      const tt = ((performance.now() - st) / 1000 % 1.6) / 1.2; const v = A.valueAt(pk, Math.min(1, tt));
      x.fillStyle = '#ff9f43'; x.beginPath(); x.arc(f.w * 0.55 + v * (f.w * 0.4 - 10) + 5, f.h / 2, 6, 0, 7); x.fill();
      pvRaf = requestAnimationFrame(loop);
    };
    loop();
  }
  function updateSide(cs) {
    listEl.innerHTML = '';
    for (const c of cs) {
      const it = W.el('div', { class: 'graphitem' + (GR.hidden.has(c.id) ? ' off' : ''), onclick: () => { if (GR.hidden.has(c.id)) GR.hidden.delete(c.id); else GR.hidden.add(c.id); updateSide(cs); App.mark('graph'); } }, W.el('i', { style: { background: c.col } }), W.el('span', { text: c.name + (c.p.exprOn && c.p.expr ? ' ƒ' : '') }));
      listEl.append(it);
    }
    if (!cs.length) listEl.append(W.el('div', { class: 'small', text: '无曲线' }));
  }
  let numSig = '';
  function updateNumeric() {
    const ks = Array.from(App.sel.keys);
    const sig = ks.map(k => k.t + ':' + JSON.stringify(k.v) + k.ie.s + k.oe.s + k.ie.f + k.oe.f + k.ii + k.oi).join('|');
    if (sig === numSig) return; numSig = sig;
    numEl.innerHTML = '';
    if (ks.length !== 1) { numEl.append(W.el('div', { class: 'small', text: ks.length ? ks.length + ' 个关键帧（混合值）' : '未选择关键帧' })); return; }
    const k = ks[0], p = App.keyOwner.get(k);
    const field = (label, get, set) => { const s = W.el('span', { class: 'num', text: U.fmt(get(), 3) }); W.scrub(s, get, (v, fin) => { set(v); s.textContent = U.fmt(v, 3); E.bump(); App.mark('graph', 'viewer', 'timeline'); if (fin) App.commit('关键帧数值'); }, { step: 0.01, begin: () => App.begin(), end: () => App.commit('关键帧数值') }); return W.el('div', { class: 'row' }, W.el('label', { text: label }), W.el('div', { class: 'ctl' }, s)); };
    numEl.append(field('时间(秒)', () => k.t, v => { k.t = v; if (p) A.sortKeys(p); }));
    if (typeof k.v === 'number') numEl.append(field('数值', () => k.v, v => { k.v = v; }));
    numEl.append(field('入：速度', () => k.ie.s, v => { k.ie.s = v; k.ii = 'bezier'; k.auto = false; }), field('入：影响 %', () => k.ie.f * 100, v => { k.ie.f = U.clamp(v / 100, 0.01, 1); k.ii = 'bezier'; }), field('出：速度', () => k.oe.s, v => { k.oe.s = v; k.oi = 'bezier'; k.auto = false; }), field('出：影响 %', () => k.oe.f * 100, v => { k.oe.f = U.clamp(v / 100, 0.01, 1); k.oi = 'bezier'; }));
    numEl.append(W.el('div', { class: 'small', text: '插值：入 ' + ({ linear: '线性', bezier: '贝塞尔', hold: '定格' })[k.ii] + ' / 出 ' + ({ linear: '线性', bezier: '贝塞尔', hold: '定格' })[k.oi] + '。拖动手柄默认联动两侧速度，按住 Alt 断开。' }));
  }
})(typeof window !== 'undefined' ? window : globalThis);
