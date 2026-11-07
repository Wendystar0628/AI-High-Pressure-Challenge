/* PRISM curve editor: value / speed / motion path */
(function () {
  const AE = window.AE, U = AE.U, M = AE.M, P = AE.P, E = AE.Eval, G = AE.G;
  const Curves = (AE.Curves = {});
  const $ = U.$, $$ = U.$$;
  const COLORS = ['#7fe7d4', '#ffb454', '#6ba8ff', '#a991ff', '#ff7a66', '#f58cc8', '#c9d7a2', '#e8c48a', '#8fe3ff', '#ffa8d2'];
  Curves.mode = 'value';
  Curves.showExpr = true;
  Curves.hidden = new Set();
  Curves.view = null;
  Curves.snap = false;
  Curves.drag = null;
  Curves.selectedKey = null;
  Curves.initialized = false;

  Curves.init = function () {
    if (this.initialized) return;
    this.initialized = true;
    const cv = $('#curveCanvas');
    if (!cv) return;
    const seg = $('#curveModeSeg');
    seg.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      this.mode = b.dataset.mode; seg.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      this.fit();
    };
    $('#curveFitBtn').onclick = () => this.fit();
    $('#curveSnapBtn').onclick = () => { this.snap = !this.snap; $('#curveSnapBtn').classList.toggle('active', this.snap); };
    $('#curveExprBtn').onclick = () => { this.showExpr = !this.showExpr; $('#curveExprBtn').classList.toggle('active', this.showExpr); this.render(); };
    $('#easePresets').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; AE.App.applyEase(b.dataset.preset); };
    cv.addEventListener('mousedown', (e) => this.onDown(e));
    window.addEventListener('mousemove', (e) => this.onMove(e));
    window.addEventListener('mouseup', (e) => this.onUp(e));
    cv.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    cv.addEventListener('dblclick', (e) => this.onDouble(e));
    new ResizeObserver(() => this.render()).observe($('#curveView'));
    this.render();
  };

  Curves.collectTracks = function () {
    const app = AE.App, comp = app.comp; if (!comp) return [];
    const layers = app.selectedLayers();
    if (!layers.length) return [];
    const out = [];
    for (const l of layers) {
      for (const g of P.propGroups(l)) {
        for (const tr of g.tracks) {
          if (!['number', 'percent', 'vec2', 'vec3'].includes(tr.type)) continue;
          const p = l.props[tr.key]; if (!p) continue;
          if (!(p.animated || p.keys.length || p.expr)) continue;
          if (this.mode === 'path' && tr.key !== 'transform.position') continue;
          out.push({ layer: l, group: g, track: tr, prop: p, type: tr.type });
        }
      }
    }
    if (!out.length) return [];
    const at = app.activeTrack;
    if (at) {
      const match = out.find(t => t.layer.id === at.layerId && t.track.key === at.key);
      if (match) return [match];
    }
    // prefer position when showing a new layer, else first animated property
    return [out.find(t => t.track.key === 'transform.position') || out[0]];
  };
  Curves.buildCurves = function (tracks) {
    const curves = [];
    for (const t of tracks) {
      if (this.hidden.has(t.layer.id + '|' + t.track.key)) continue;
      if (t.type === 'vec2' || t.type === 'vec3') {
        const n = t.type === 'vec3' ? 3 : 2;
        for (let i = 0; i < n; i++) curves.push({ track: t, comp: i, label: `${t.layer.name} · ${t.track.label} [${'XYZ'[i]}]`, color: COLORS[curves.length % COLORS.length] });
      } else curves.push({ track: t, comp: null, label: `${t.layer.name} · ${t.track.label}`, color: COLORS[curves.length % COLORS.length] });
    }
    return curves;
  };
  Curves.valueAt = function (curve, time, ctx, final) {
    const p = curve.track.prop, layer = curve.track.layer;
    let v;
    if (final && p.expr) v = E.propValue(layer, curve.track.track.key, ctx, time);
    else v = E.interpBase(p, time);
    if (curve.comp != null) return Array.isArray(v) ? (v[curve.comp] == null ? 0 : v[curve.comp]) : 0;
    if (Array.isArray(v)) return v[0] || 0;
    return v;
  };
  Curves.render = function () {
    const app = AE.App, comp = app && app.comp;
    const cv = $('#curveCanvas');
    if (!cv || !comp) return;
    const wrap = $('#curveView');
    if (!wrap || !wrap.classList.contains('active')) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (w < 4 || h < 4) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const margin = { l: 58, r: 18, t: 24, b: 28 };
    const pw = w - margin.l - margin.r, ph = h - margin.t - margin.b;
    this.geom = { w, h, margin, pw, ph };
    if (this.mode === 'path') { this.drawPath(ctx, w, h, margin, pw, ph); return; }
    const tracks = this.collectTracks();
    const curves = this.buildCurves(tracks);
    this.curves = curves;
    if (!curves.length) {
      $('#curveHint').classList.add('show');
      $('#curveHint').textContent = '选择一个带动画的图层，或在时间轴展开属性、点击属性名后切换到此工作区';
      $('#curveLegend').innerHTML = '';
      this.drawGrid(ctx, margin, pw, ph, 0, comp.duration, 0, 1);
      this.renderSide(null);
      return;
    }
    $('#curveHint').classList.remove('show');
    const ctxEval = E.makeCtx(app.project, comp, app.time);
    // view autofit
    if (!this.view || this.view.mode !== this.mode) this.fit();
    const v = this.view;
    this.drawGrid(ctx, margin, pw, ph, v.t0, v.t1, v.yMin, v.yMax);
    // draw curves
    this.drawLegend(curves);
    const xOf = t => margin.l + (t - v.t0) / (v.t1 - v.t0) * pw;
    const yOf = val => margin.t + (1 - (val - v.yMin) / (v.yMax - v.yMin || 1)) * ph;
    for (const curve of curves) {
      if (this.mode === 'speed') {
        ctx.strokeStyle = curve.color; ctx.lineWidth = 1.4; ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 220; i++) {
          const t = v.t0 + (v.t1 - v.t0) * i / 220;
          const dt = 1 / (comp.fps * 2);
          let a = this.valueAt(curve, Math.max(0, t - dt), ctxEval, false), b = this.valueAt(curve, Math.min(comp.duration, t + dt), ctxEval, false);
          const val = Math.abs(b - a) / (dt * 2);
          const y = yOf(val);
          if (!started) { ctx.moveTo(xOf(t), y); started = true; } else ctx.lineTo(xOf(t), y);
        }
        ctx.stroke(); this.drawKeys(ctx, curve, xOf, yOf, ctxEval);
        continue;
      }
      // base curve
      ctx.strokeStyle = curve.color; ctx.lineWidth = 1.35; ctx.globalAlpha = .9;
      ctx.beginPath();
      for (let i = 0; i <= 260; i++) {
        const t = v.t0 + (v.t1 - v.t0) * i / 260;
        const val = this.valueAt(curve, t, ctxEval, false);
        const y = yOf(val);
        if (i === 0) ctx.moveTo(xOf(t), y); else ctx.lineTo(xOf(t), y);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
      if (curve.track.prop.expr && this.showExpr) {
        ctx.strokeStyle = curve.color; ctx.globalAlpha = .5; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
          const t = v.t0 + (v.t1 - v.t0) * i / 160;
          const val = this.valueAt(curve, t, ctxEval, true);
          const y = yOf(val);
          if (i === 0) ctx.moveTo(xOf(t), y); else ctx.lineTo(xOf(t), y);
        }
        ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      this.drawKeys(ctx, curve, xOf, yOf, ctxEval);
    }
    // playhead
    if (app.time >= v.t0 && app.time <= v.t1) {
      ctx.strokeStyle = 'rgba(255,180,84,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xOf(app.time), margin.t); ctx.lineTo(xOf(app.time), margin.t + ph); ctx.stroke();
      ctx.fillStyle = '#ffb454'; ctx.beginPath(); ctx.moveTo(xOf(app.time) - 4, margin.t - 5); ctx.lineTo(xOf(app.time) + 4, margin.t - 5); ctx.lineTo(xOf(app.time), margin.t + 1); ctx.closePath(); ctx.fill();
    }
    this.renderSide(this.selectedKey);
  };
  Curves.drawGrid = function (ctx, margin, pw, ph, t0, t1, y0, y1) {
    const app = AE.App;
    ctx.fillStyle = '#090d13'; ctx.fillRect(0, 0, margin.l + pw + margin.r, margin.t + ph + margin.b);
    const step = this.niceTimeStep((t1 - t0), pw);
    ctx.font = '8px Cascadia Code, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let t = Math.ceil(t0 / step) * step; t <= t1 + 1e-6; t += step) {
      const x = margin.l + (t - t0) / (t1 - t0) * pw;
      ctx.strokeStyle = 'rgba(48,62,80,.28)'; ctx.beginPath(); ctx.moveTo(x, margin.t); ctx.lineTo(x, margin.t + ph); ctx.stroke();
      ctx.fillStyle = '#59677b'; ctx.fillText(t.toFixed(step < 1 ? 1 : 0) + 's', x, margin.t + ph + 6);
    }
    const yStep = (y1 - y0) / 5;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const val = y0 + yStep * i;
      const y = margin.t + ph - ph * i / 5;
      ctx.strokeStyle = 'rgba(48,62,80,.22)'; ctx.beginPath(); ctx.moveTo(margin.l, y); ctx.lineTo(margin.l + pw, y); ctx.stroke();
      ctx.fillStyle = '#59677b'; ctx.fillText(Math.abs(val) >= 100 ? val.toFixed(0) : val.toFixed(2), margin.l - 7, y);
    }
    ctx.strokeStyle = 'rgba(70,86,106,.6)'; ctx.beginPath(); ctx.moveTo(margin.l, margin.t); ctx.lineTo(margin.l, margin.t + ph); ctx.lineTo(margin.l + pw, margin.t + ph); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#4d5c70'; ctx.fillText(this.mode === 'speed' ? '速度 / 单位每秒' : '值', 10, 8);
    ctx.textAlign = 'right'; ctx.fillStyle = '#425166'; ctx.fillText('时间', margin.l + pw, margin.t + ph + 16);
  };
  Curves.niceTimeStep = function (range, px) {
    const steps = [.1, .25, .5, 1, 2, 5, 10, 15, 30, 60];
    for (const s of steps) if (px * s / range > 55) return s;
    return 60;
  };
  Curves.drawLegend = function (curves) {
    const el = $('#curveLegend'); if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < curves.length; i++) {
      const c = curves[i];
      const item = U.el('div', 'legend-item');
      item.innerHTML = `<i style="background:${c.color}"></i><span class="lg-name">${escapeHtml(c.label)}</span>`;
      item.title = '点击隐藏/显示此曲线';
      item.onclick = () => { const id = c.track.layer.id + '|' + c.track.track.key; if (this.hidden.has(id)) this.hidden.delete(id); else this.hidden.add(id); this.render(); };
      el.appendChild(item);
    }
    // hidden tracks restore chips
    for (const id of this.hidden) {
      const [lid, key] = id.split('|');
      const l = AE.App.comp.layers.find(x => x.id === lid); if (!l) continue;
      const tr = P.findTrack(l, key);
      const item = U.el('div', 'legend-item'); item.style.opacity = '.45';
      item.innerHTML = `<i style="background:#445366"></i><span>${escapeHtml(l.name + ' · ' + (tr ? tr.label : key))}</span>`;
      item.onclick = () => { this.hidden.delete(id); this.render(); };
      el.appendChild(item);
    }
  };
  Curves.drawKeys = function (ctx, curve, xOf, yOf, ctxEval) {
    const app = AE.App;
    const keys = curve.track.prop.keys || [];
    const v = this.view;
    for (const k of keys) {
      if (curve.comp != null && !Array.isArray(k.v)) continue;
      const val = curve.comp != null ? (Array.isArray(k.v) ? k.v[curve.comp] : 0) : (Array.isArray(k.v) ? k.v[0] : k.v);
      if (k.t < v.t0 - .01 || k.t > v.t1 + .01) continue;
      const x = xOf(k.t), y = yOf(val);
      const sel = app.selectedKeys.has(app.keyId(curve.track.layer, curve.track.track.key, k.t));
      ctx.save();
      ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = sel ? '#7fe7d4' : (k.out === 'hold' ? '#b9c4d2' : '#8d99ac');
      ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
      ctx.strokeStyle = '#0b1017'; ctx.lineWidth = 1; ctx.strokeRect(-3.4, -3.4, 6.8, 6.8);
      ctx.restore();
      if (sel && keys.length > 1) {
        const idx = keys.indexOf(k);
        const prev = keys[Math.max(0, idx - 1)], next = keys[Math.min(keys.length - 1, idx + 1)];
        const segs = [];
        if (idx > 0) segs.push([prev, k, 'in']);
        if (idx < keys.length - 1) segs.push([k, next, 'out']);
        for (const [A, B, side] of segs) {
          const h = side === 'in' ? (B.inH || [.67, 1]) : (A.outH || [.33, 0]);
          const tv = side === 'in' ? A.t : A.t;
          const spreadT = (B.t - A.t) * (side === 'in' ? h[0] : h[0]);
          const valA = curve.comp != null ? (Array.isArray(A.v) ? A.v[curve.comp] : 0) : (Array.isArray(A.v) ? A.v[0] : A.v);
          const valB = curve.comp != null ? (Array.isArray(B.v) ? B.v[curve.comp] : 0) : (Array.isArray(B.v) ? B.v[0] : B.v);
          const spreadV = (valB - valA) * h[1];
          const hx = xOf(A.t + spreadT), hy = yOf(valA + spreadV);
          ctx.strokeStyle = 'rgba(255,180,84,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(hx, hy); ctx.stroke();
          ctx.fillStyle = '#ffb454'; ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  };
  Curves.drawPath = function (ctx, w, h, margin, pw, ph) {
    const app = AE.App, comp = app.comp;
    const tracks = this.collectTracks().filter(t => t.track.key === 'transform.position');
    const curves = tracks.map((t, i) => ({ track: t, color: COLORS[i % COLORS.length], label: t.layer.name + ' · 位置路径' }));
    this.pathCurves = curves;
    if (!curves.length) {
      $('#curveHint').classList.add('show'); $('#curveHint').textContent = '选择一个带有位置关键帧的图层以查看空间运动路径';
      $('#curveLegend').innerHTML = '';
      this.drawGrid(ctx, margin, pw, ph, 0, 1, 0, 1); this.renderSide(null); return;
    }
    $('#curveHint').classList.remove('show');
    this.drawLegend(curves);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const ctxEval = E.makeCtx(app.project, comp, app.time);
    const paths = [];
    for (const c of curves) {
      const pts = E.motionPath(c.track.prop, 24);
      const all = pts.concat(c.track.prop.keys.map(k => k.v));
      for (const p of all) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
      paths.push(pts);
    }
    minX = Math.max(-4000, minX); maxX = Math.min(4000, maxX); minY = Math.max(-4000, minY); maxY = Math.min(4000, maxY);
    if (!isFinite(minX)) { minX = 0; maxX = comp.width; minY = 0; maxY = comp.height; }
    const pad = Math.max(40, (maxX - minX) * .1, (maxY - minY) * .1);
    minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    const sx = pw / (maxX - minX || 1), sy = ph / (maxY - minY || 1);
    const scale = Math.min(sx, sy);
    const ox = margin.l + (pw - (maxX - minX) * scale) / 2, oy = margin.t + (ph - (maxY - minY) * scale) / 2;
    const xOf = x => ox + (x - minX) * scale, yOf = y => oy + (y - minY) * scale;
    this.pathGeom = { minX, maxX, minY, maxY, ox, oy, scale, xOf, yOf };
    // background grid
    ctx.fillStyle = '#090d13'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(48,62,80,.2)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { const x = margin.l + pw * i / 10; ctx.beginPath(); ctx.moveTo(x, margin.t); ctx.lineTo(x, margin.t + ph); ctx.stroke(); }
    for (let i = 0; i <= 8; i++) { const y = margin.t + ph * i / 8; ctx.beginPath(); ctx.moveTo(margin.l, y); ctx.lineTo(margin.l + pw, y); ctx.stroke(); }
    // comp center axes
    ctx.strokeStyle = 'rgba(127,231,212,.12)'; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(xOf(comp.width / 2), margin.t); ctx.lineTo(xOf(comp.width / 2), margin.t + ph); ctx.moveTo(margin.l, yOf(comp.height / 2)); ctx.lineTo(margin.l + pw, yOf(comp.height / 2)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#435267'; ctx.font = '8px Cascadia Code, monospace'; ctx.textAlign = 'left';
    ctx.fillText(`世界坐标  ·  ${Math.round(minX)} → ${Math.round(maxX)}`, 10, 10);
    for (let ci = 0; ci < curves.length; ci++) {
      const c = curves[ci], prop = c.track.prop;
      const pts = paths[ci];
      ctx.strokeStyle = c.color; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i < pts.length; i++) { const x = xOf(pts[i][0]), y = yOf(pts[i][1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      // per-frame dots
      ctx.fillStyle = c.color; ctx.globalAlpha = .32;
      const frames = Math.round(comp.duration * comp.fps);
      for (let f = 0; f <= frames; f += Math.max(1, Math.round(comp.fps / 12))) {
        const tv = f / comp.fps;
        const val = E.interpBase(prop, tv);
        if (!val || val.length < 2) continue;
        ctx.fillRect(xOf(val[0]) - 1, yOf(val[1]) - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
      // keys
      for (const k of prop.keys) {
        const x = xOf(k.v[0]), y = yOf(k.v[1]);
        const sel = app.selectedKeys.has(app.keyId(c.track.layer, 'transform.position', k.t));
        ctx.fillStyle = sel ? '#7fe7d4' : '#c7d2de';
        ctx.beginPath(); ctx.arc(x, y, sel ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0b1017'; ctx.lineWidth = 1; ctx.stroke();
        // spatial handles for selected
        if (sel) {
          const idx = prop.keys.indexOf(k);
          const hOut = E.spatialHandleOut(prop, idx, k), hIn = E.spatialHandleIn(prop, idx, k);
          for (const [h, dir] of [[hOut, 1], [hIn, -1]]) {
            if (!h) continue;
            const hx = xOf(k.v[0] + h[0]), hy = yOf(k.v[1] + h[1]);
            ctx.strokeStyle = 'rgba(255,180,84,.7)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(hx, hy); ctx.stroke();
            ctx.fillStyle = '#ffb454'; ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }
    // playhead marker along current position
    ctx.fillStyle = 'rgba(255,180,84,.9)';
    for (const c of curves) {
      const val = E.propValue(c.track.layer, 'transform.position', ctxEval, app.time);
      if (val) { ctx.beginPath(); ctx.arc(xOf(val[0]), yOf(val[1]), 4.5, 0, Math.PI * 2); ctx.fill(); }
    }
    this.renderSide(this.selectedKey);
  };
  Curves.fit = function () {
    const app = AE.App, comp = app.comp;
    if (!comp) return;
    this.view = { mode: this.mode, t0: 0, t1: comp.duration, yMin: 0, yMax: 1 };
    if (this.mode === 'path') { this.render(); return; }
    const tracks = this.collectTracks();
    const curves = this.buildCurves(tracks);
    const ctx = E.makeCtx(app.project, comp, app.time);
    let min = Infinity, max = -Infinity;
    for (const c of curves) {
      for (const k of (c.track.prop.keys || [])) {
        const val = c.comp != null ? (Array.isArray(k.v) ? k.v[c.comp] : 0) : (Array.isArray(k.v) ? k.v[0] : k.v);
        if (typeof val === 'number') { min = Math.min(min, val); max = Math.max(max, val); }
      }
      for (let i = 0; i <= 40; i++) {
        const t = comp.duration * i / 40;
        const val = this.valueAt(c, t, ctx, this.showExpr);
        if (typeof val === 'number') { min = Math.min(min, val); max = Math.max(max, val); }
      }
    }
    if (!isFinite(min)) { min = 0; max = 1; }
    if (max - min < 1e-4) { min -= 10; max += 10; }
    const pad = (max - min) * .14;
    this.view = { mode: this.mode, t0: 0, t1: comp.duration, yMin: min - pad, yMax: max + pad };
    this.render();
  };
  Curves.renderSide = function (sel) {
    const info = $('#curveKeyInfo');
    if (!info) return;
    if (!sel || !sel.k) {
      info.className = 'side-empty'; info.innerHTML = '选择曲线上的关键帧<br><span style="color:#3f4c5e;font-size:8px">拖动关键帧或手柄编辑时间与缓动</span>';
      this.drawEasePreview(null);
      return;
    }
    info.className = '';
    const k = sel.k, p = sel.prop, layer = sel.layer;
    const idx = p.keys.indexOf(k);
    const time = (k.t).toFixed(3);
    const compIdx = sel.comp;
    const val = compIdx != null ? (Array.isArray(k.v) ? k.v[compIdx] : 0) : (Array.isArray(k.v) ? k.v[0] : k.v);
    info.innerHTML = `<div class="side-title" style="margin-top:0">${escapeHtml(layer.name)} · ${escapeHtml(sel.label || '')}</div>
      <div class="key-info-label">时间 (秒)</div>
      <div class="key-info-grid"><input class="num-input" id="ckTime" value="${time}"><input class="num-input" id="ckValue" value="${Math.round(val * 1000) / 1000}"></div>
      <div class="key-info-label">时间插值</div>
      <div class="key-info-grid"><select class="mini-select" id="ckIn"><option value="linear" ${k.in === 'linear' ? 'selected' : ''}>进入线性</option><option value="ease" ${k.in === 'ease' || !k.in ? 'selected' : ''}>进入缓动</option></select><select class="mini-select" id="ckOut"><option value="linear" ${k.out === 'linear' ? 'selected' : ''}>离开线性</option><option value="ease" ${k.out === 'ease' || !k.out ? 'selected' : ''}>离开缓动</option><option value="hold" ${k.out === 'hold' ? 'selected' : ''}>离开定格</option></select></div>
      <div class="key-info-label">关键帧导航</div>
      <div class="form-row" style="gap:4px"><button class="chip" id="ckPrev">← 上一个</button><button class="chip" id="ckNext">下一个 →</button></div>`;
    const apply = (fn, label) => AE.App.edit(label, fn);
    $('#ckTime').onchange = () => { const nt = Math.max(0, Math.min(AE.App.comp.duration, parseFloat($('#ckTime').value) || 0)); apply('修改关键帧时间', () => { k.t = nt; P.sortKeys(p); }); };
    $('#ckValue').onchange = () => {
      const nv = parseFloat($('#ckValue').value); if (isNaN(nv)) return;
      apply('修改关键帧值', () => {
        if (compIdx != null) { const arr = Array.isArray(k.v) ? k.v.slice() : [0, 0, 0]; arr[compIdx] = nv; k.v = arr; }
        else if (Array.isArray(k.v)) k.v[0] = nv; else k.v = nv;
      });
    };
    $('#ckIn').onchange = () => apply('关键帧进入插值', () => { k.in = $('#ckIn').value; if (k.in === 'ease') k.inH = null; });
    $('#ckOut').onchange = () => apply('关键帧离开插值', () => { k.out = $('#ckOut').value; if (k.out === 'ease') k.outH = null; });
    $('#ckPrev').onclick = () => { if (idx > 0) AE.App.setTime(p.keys[idx - 1].t); };
    $('#ckNext').onclick = () => { if (idx < p.keys.length - 1) AE.App.setTime(p.keys[idx + 1].t); };
    this.drawEasePreview(k);
  };
  Curves.drawEasePreview = function (k) {
    const cv = $('#easePreview'); if (!cv) return;
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#080b10'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1b2430'; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(w * i / 4, 0); ctx.lineTo(w * i / 4, h); ctx.moveTo(0, h * i / 4); ctx.lineTo(w, h * i / 4); ctx.stroke(); }
    ctx.strokeStyle = '#7fe7d4'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(12, h - 12); ctx.bezierCurveTo(12 + w * .76 * (k && k.outH ? k.outH[0] : .33), h - 12 - h * .76 * (k && k.outH ? k.outH[1] : 0), 12 + w * .76 * (k && k.inH ? k.inH[0] : .67), h - 12 - h * .76 * (k && k.inH ? k.inH[1] : 1), w - 12, 12); ctx.stroke();
    ctx.fillStyle = '#4f5c6f'; ctx.font = '8px Cascadia Code, monospace'; ctx.fillText('0', 6, h - 2); ctx.fillText('1', w - 12, 10);
  };
  Curves.onDown = function (e) {
    const app = AE.App, comp = app.comp; if (!comp) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (this.mode === 'path') { this.onPathDown(e, x, y); return; }
    const g = this.geom; if (!g) return;
    // selected key handles
    if (this.selectedKey) {
      const sel = this.selectedKey;
      const hit = this.hitHandle(sel, x, y);
      if (hit) { this.drag = { type: 'handle', sel, side: hit, startX: x, startY: y }; app.beginEdit('调整缓动手柄'); return; }
    }
    // keys
    for (const curve of (this.curves || [])) {
      for (const k of (curve.track.prop.keys || [])) {
        const px = g.margin.l + (k.t - this.view.t0) / (this.view.t1 - this.view.t0) * g.pw;
        const val = curve.comp != null ? (Array.isArray(k.v) ? k.v[curve.comp] : 0) : (Array.isArray(k.v) ? k.v[0] : k.v);
        const py = g.margin.t + (1 - (val - this.view.yMin) / (this.view.yMax - this.view.yMin || 1)) * g.ph;
        if (Math.hypot(px - x, py - y) < 7) {
          const id = app.keyId(curve.track.layer, curve.track.track.key, k.t);
          if (e.shiftKey) { if (app.selectedKeys.has(id)) app.selectedKeys.delete(id); else app.selectedKeys.add(id); }
          else if (!app.selectedKeys.has(id)) { app.selectedKeys.clear(); app.selectedKeys.add(id); }
          this.selectedKey = { layer: curve.track.layer, prop: curve.track.prop, k, label: curve.label, comp: curve.comp };
          this.drag = { type: 'key', startX: x, startY: y, comp: curve.comp, items: app.selectedKeyObjects().map(s => ({ ...s, origT: s.k.t, origV: Array.isArray(s.k.v) ? s.k.v.slice() : s.k.v })) };
          app.beginEdit('调整关键帧');
          this.render(); return;
        }
      }
    }
    // empty: pan time
    this.drag = { type: 'pan', startX: x, startY: y, t0: this.view.t0, t1: this.view.t1, yMin: this.view.yMin, yMax: this.view.yMax };
    app.selectedKeys.clear(); this.selectedKey = null; this.render();
  };
  Curves.hitHandle = function (sel, x, y) {
    const g = this.geom; if (!g) return null;
    const k = sel.k, p = sel.prop;
    const idx = p.keys.indexOf(k);
    if (idx < 0) return null;
    const val = sel.comp != null ? (Array.isArray(k.v) ? k.v[sel.comp] : 0) : (Array.isArray(k.v) ? k.v[0] : k.v);
    const px = g.margin.l + (k.t - this.view.t0) / (this.view.t1 - this.view.t0) * g.pw;
    const py = g.margin.t + (1 - (val - this.view.yMin) / (this.view.yMax - this.view.yMin || 1)) * g.ph;
    const checks = [];
    if (idx > 0) { const h = k.inH || [.67, 1]; checks.push({ side: 'in', x: px - g.pw * .07, y: py }); }
    if (idx < p.keys.length - 1) { const h = k.outH || [.33, 0]; checks.push({ side: 'out', x: px + g.pw * .07, y: py }); }
    for (const c of checks) if (Math.hypot(c.x - x, c.y - y) < 9) return c.side;
    return null;
  };
  Curves.onMove = function (e) {
    const d = this.drag; if (!d) return;
    const app = AE.App;
    if (d.type === 'pan') {
      const g = this.geom, dx = e.clientX - d.startX;
      const dt = dx / g.pw * (d.t1 - d.t0);
      this.view.t0 = Math.max(-1, d.t0 - dt); this.view.t1 = Math.max(1, d.t1 - dt);
      this.render(); return;
    }
    if (d.type === 'key') {
      const g = this.geom, dx = e.clientX - d.startX, dy = e.clientY - d.startY;
      for (const it of d.items) {
        const dt = dx / g.pw * (this.view.t1 - this.view.t0);
        it.k.t = Math.max(0, Math.min(app.comp.duration, it.origT + dt));
        const dv = -dy / g.ph * (this.view.yMax - this.view.yMin);
        if (Array.isArray(it.origV)) {
          const a = it.origV.slice();
          if (d.comp != null) a[d.comp] = (a[d.comp] || 0) + dv;
          else a[0] = (a[0] || 0) + dv;
          it.k.v = a;
        } else it.k.v = (typeof it.origV === 'number' ? it.origV : 0) + dv;
      }
      this.render(); return;
    }
    if (d.type === 'pathKey') {
      const g = this.pathGeom, dx = e.clientX - d.startX, dy = e.clientY - d.startY;
      const wx = dx / g.scale, wy = dy / g.scale;
      d.k.v = [d.v0[0] + wx, d.v0[1] + wy, d.v0[2] || 0];
      this.render(); return;
    }
    if (d.type === 'pathHandle') {
      const g = this.pathGeom, dx = e.clientX - d.startX, dy = e.clientY - d.startY;
      const wx = dx / g.scale, wy = dy / g.scale;
      const h = [d.h0[0] + wx, d.h0[1] + wy];
      if (d.side === 'out') d.k.spatialOut = h; else d.k.spatialIn = h;
      if (!d.k.outH) d.k.corner = false;
      this.render(); return;
    }
    if (d.type === 'handle') {
      const g = this.geom, dx = e.clientX - d.startX, dy = e.clientY - d.startY;
      const k = d.sel.k, p = d.sel.prop;
      const idx = p.keys.indexOf(k);
      const seg = d.side === 'out' ? (p.keys[idx + 1] ? p.keys[idx + 1].t - k.t : 1) : (p.keys[idx - 1] ? k.t - p.keys[idx - 1].t : 1);
      if (seg > 1e-6) {
        const hx = U.clamp((d.side === 'out' ? .33 : .67) + dx / g.pw * (this.view.t1 - this.view.t0) / seg, 0, 1);
        const hy = U.clamp((d.side === 'out' ? 0 : 1) - dy / g.ph, -2, 3);
        const h = [hx, hy];
        if (d.side === 'out') k.outH = h; else k.inH = h;
        if (p.keys.length === 1) { }
        app.markDirty();
      }
      this.render(); return;
    }
  };
  Curves.onUp = function (e) {
    if (!this.drag) return;
    if (['key', 'handle', 'pathKey', 'pathHandle'].includes(this.drag.type)) {
      for (const c of (this.curves || [])) P.sortKeys(c.track.prop);
      AE.App.endEdit(true);
      this.selectedKey = null;
    }
    this.drag = null;
    this.render();
  };
  Curves.onWheel = function (e) {
    e.preventDefault();
    if (this.mode === 'path') return;
    if (!this.view) this.fit();
    const g = this.geom, rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const anchor = this.view.t0 + U.clamp((x - g.margin.l) / g.pw, 0, 1) * (this.view.t1 - this.view.t0);
    const f = e.deltaY < 0 ? .88 : 1.12;
    let t0 = anchor - (anchor - this.view.t0) * f, t1 = anchor + (this.view.t1 - anchor) * f;
    if (t1 - t0 < .2) return;
    this.view.t0 = t0; this.view.t1 = t1;
    if (e.shiftKey) {
      const range = this.view.yMax - this.view.yMin;
      const center = (this.view.yMin + this.view.yMax) / 2;
      this.view.yMin = center - range * f / 2; this.view.yMax = center + range * f / 2;
    }
    this.render();
  };
  Curves.onDouble = function (e) {
    const app = AE.App;
    app.setWorkspace('stage');
  };
  Curves.onPathDown = function (e, x, y) {
    const app = AE.App;
    const g = this.pathGeom;
    if (!g) return;
    const curves = this.pathCurves || [];
    // keys
    for (const c of curves) {
      for (const k of c.track.prop.keys) {
        const kx = g.xOf(k.v[0]), ky = g.yOf(k.v[1]);
        if (Math.hypot(kx - x, ky - y) < 8) {
          const id = app.keyId(c.track.layer, 'transform.position', k.t);
          if (!e.shiftKey) app.selectedKeys.clear();
          app.selectedKeys.add(id);
          this.drag = { type: 'pathKey', curve: c, k, startX: x, startY: y, v0: k.v.slice() };
          app.beginEdit('移动路径关键帧');
          this.render(); return;
        }
      }
    }
    // handles
    for (const c of curves) {
      for (const k of c.track.prop.keys) {
        const id = app.keyId(c.track.layer, 'transform.position', k.t);
        if (!app.selectedKeys.has(id)) continue;
        const idx = c.track.prop.keys.indexOf(k);
        const hs = [[E.spatialHandleOut(c.track.prop, idx, k), 'out'], [E.spatialHandleIn(c.track.prop, idx, k), 'in']];
        for (const [h, side] of hs) {
          if (!h) continue;
          const hx = g.xOf(k.v[0] + h[0]), hy = g.yOf(k.v[1] + h[1]);
          if (Math.hypot(hx - x, hy - y) < 9) {
            this.drag = { type: 'pathHandle', curve: c, k, side, h0: h.slice(), startX: x, startY: y };
            app.beginEdit('调整空间手柄');
            return;
          }
        }
      }
    }
    this.selectedKey = null; app.selectedKeys.clear(); this.render();
  };
  Curves.drawEasePreview = Curves.drawEasePreview;
  Curves.updatePlayhead = function () { if (this.mode !== 'path') this.render(); };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  AE.Curves = Curves;
})();
