/* ============================================================
   curve.js — 曲线编辑器：值曲线 / 速度曲线、关键帧与手柄拖动
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const UI = AE.ui;
  const C = AE.curve = {
    canvas: null, ctx: null, prop: null, layer: null, path: null, label: '',
    mode: 'value', component: 0, selected: new Set(), autoFit: true,
    view: { t0: 0, t1: 15, v0: 0, v1: 100 }, drag: null, _pad: 0
  };
  const PAD = { l: 54, r: 16, t: 24, b: 26 };
  C.PAD = PAD;

  C.init = function () {
    C.canvas = document.getElementById('curveCanvas');
    C.ctx = C.canvas.getContext('2d');
    C.canvas.addEventListener('pointerdown', C.onDown);
    C.canvas.addEventListener('pointermove', C.onMove);
    C.canvas.addEventListener('pointerup', C.onUp);
    C.canvas.addEventListener('pointercancel', C.onUp);
    C.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!C.prop) return;
      const r = C.canvas.getBoundingClientRect();
      const f = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      const cx = (e.clientX - r.left - PAD.l) / Math.max(1, r.width - PAD.l - PAD.r);
      const span = C.view.t1 - C.view.t0;
      const t = C.view.t0 + span * cx;
      C.view.t0 = Math.max(0, t - (t - C.view.t0) * f);
      C.view.t1 = Math.min(AE.app.comp.duration, t + (C.view.t1 - t) * f);
      C.autoFit = false;
      C.draw();
    }, { passive: false });
    document.getElementById('curveAutoFit').addEventListener('click', () => {
      C.autoFit = !C.autoFit;
      document.getElementById('curveAutoFit').classList.toggle('on', C.autoFit);
      C.draw();
    });
    document.getElementById('curveExprToggle').addEventListener('click', (e) => {
      C.showExpr = !C.showExpr;
      e.currentTarget.classList.toggle('on', C.showExpr);
      C.draw();
    });
    C.showExpr = true;
    C.resize();
    C.refresh();
  };

  C.resize = function () {
    if (!C.canvas) return;
    const wrap = C.canvas.parentElement;
    if (!wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (w < 2 || h < 2) return;
    C.canvas.width = Math.round(w * dpr); C.canvas.height = Math.round(h * dpr);
    C.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    C._w = w; C._h = h;
    C.draw();
  };

  C.setProperty = function (layer, prop, path, label) {
    C.layer = layer; C.prop = prop; C.path = path; C.label = label || prop.label || path;
    C.selected.clear();
    C.autoFit = true;
    C.view.t0 = 0;
    C.view.t1 = AE.app.comp ? AE.app.comp.duration : 15;
    const lab = document.getElementById('curvePropLabel');
    if (lab) lab.textContent = layer.name + ' · ' + C.label + (prop.expression ? ' · ƒ' : '');
    C.updateSide();
  };

  C.setMode = function (mode) {
    C.mode = mode;
    C.draw();
    C.updateSide();
  };

  C.refresh = function () {
    const app = AE.app;
    if (app.selectedProp && app.selectedProp.prop) {
      const l = app.getLayer(app.selectedProp.layerId);
      if (l) C.setProperty(l, app.selectedProp.prop, app.selectedProp.path, app.selectedProp.label);
    }
    if (!C.prop && app.comp && app.comp.layers.length) {
      const l = app.primary() || app.comp.layers[0];
      let found = null;
      for (const k of ['position', 'rotation', 'opacity']) {
        const p = l.transform[k];
        if (A.isAnimated(p)) { found = [p, 'transform.' + k, p.label]; break; }
      }
      if (found) C.setProperty(l, found[0], found[1], found[2]);
    }
    if (!AE.app.comp) return;
    C.canvas && C.resize();
    C.updateSide();
    C.draw();
  };

  C.updateSide = function () {
    const side = document.getElementById('curveSide');
    const lab = document.getElementById('curvePropLabel');
    if (!side) return;
    const p = C.prop;
    if (!p) {
      side.innerHTML = '<div class="ni-empty">选择一个已动画属性<br>曲线将在这里显示</div>';
      if (lab) lab.textContent = '未选择动画属性';
      return;
    }
    C.layer = C.layer || AE.app.primary();
    const t = AE.app.time;
    const val = A.sample(p, t, C.layer, A.newCtx(AE.app.comp, C.layer, t));
    if (lab) lab.textContent = (C.layer ? C.layer.name + ' · ' : '') + C.label + (p.expression ? ' · ƒ' : '');
    const keys = p.keyframes || [];
    side.innerHTML = `<h5>属性</h5><div class="cs-row"><span>名称</span><b>${UI.esc(C.label)}</b></div>
      <div class="cs-row"><span>关键帧</span><b>${keys.length}</b></div>
      <div class="cs-row"><span>当前值</span><b>${UI.esc(cvText(p, val))}</b></div>
      <div class="cs-row"><span>当前速度</span><b>${U.round(speedAt(C.layer, p, t), 1)}</b></div>
      <div class="cs-row"><span>表达式</span><b>${p.expression ? 'ƒ 开启' : '—'}</b></div>
      <h5>分量</h5>
      <div style="display:flex;gap:4px">${p.type === 'vec' ? ['X', 'Y', 'Z'].map((a, i) => `<button class="mini-btn ${C.component === i ? 'on' : ''}" data-comp="${i}">${a}</button>`).join('') : '<span style="font-size:9px;color:#5c6673">标量属性</span>'}</div>
      <h5>视图</h5><div class="cs-row"><span>时间范围</span><b>${C.view.t0.toFixed(2)}–${C.view.t1.toFixed(2)}s</b></div>
      <div class="cs-row"><span>数值范围</span><b>${U.round(C.view.v0, 1)}–${U.round(C.view.v1, 1)}</b></div>
      <div style="margin-top:8px;font-size:8.5px;color:#4f5966;line-height:1.7">拖动关键帧改时间/数值；拖动青色手柄调整贝塞尔缓动。滚轮缩放时间。</div>`;
    side.querySelectorAll('[data-comp]').forEach(b => b.addEventListener('click', () => { C.component = +b.dataset.comp; C.autoFit = true; C.updateSide(); C.draw(); }));
  };

  function cvText(p, v) {
    if (p.type === 'vec') { const q = A.vec3(v); return `${U.round(q.x, 1)}, ${U.round(q.y, 1)}, ${U.round(q.z, 1)}`; }
    if (p.type === 'color') return String(v);
    return U.round(A.n(v), 3);
  }
  function speedAt(layer, p, t) {
    const v = A.velocity(p, t, layer);
    return p.type === 'vec' ? v.speed : Math.abs(v);
  }
  function componentValue(p, v, comp) {
    if (p.type !== 'vec') return A.n(v);
    const q = A.vec3(v);
    return [q.x, q.y, q.z][comp];
  }

  // 坐标映射
  C.x2t = function (x) { return C.view.t0 + (x - PAD.l) / Math.max(1, C._w - PAD.l - PAD.r) * (C.view.t1 - C.view.t0); };
  C.t2x = function (t) { return PAD.l + (t - C.view.t0) / Math.max(1e-6, C.view.t1 - C.view.t0) * (C._w - PAD.l - PAD.r); };
  C.y2v = function (y) { return C.view.v1 - (y - PAD.t) / Math.max(1, C._h - PAD.t - PAD.b) * (C.view.v1 - C.view.v0); };
  C.v2y = function (v) { return PAD.t + (C.view.v1 - v) / Math.max(1e-6, C.view.v1 - C.view.v0) * (C._h - PAD.t - PAD.b); };

  C.autoRange = function () {
    const p = C.prop;
    if (!p) return;
    let vals = [];
    const n = 140;
    for (let i = 0; i <= n; i++) {
      const t = C.view.t0 + (C.view.t1 - C.view.t0) * i / n;
      if (C.mode === 'speed') vals.push(speedAt(C.layer, p, t));
      else vals.push(componentValue(p, A.sample(p, t, C.layer, A.newCtx(AE.app.comp, C.layer, t)), C.component));
    }
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (!isFinite(mn) || !isFinite(mx)) { mn = 0; mx = 1; }
    if (mx - mn < 1e-6) { mx = mn + Math.max(1, Math.abs(mn) * 0.2); mn -= Math.max(1, Math.abs(mn) * 0.2); }
    const pad = (mx - mn) * 0.18;
    C.view.v0 = mn - pad; C.view.v1 = mx + pad;
  };

  C.draw = function () {
    if (!C.ctx) return;
    const ctx = C.ctx;
    if (!C._w) C.resize();
    if (!C._w) return;
    const w = C._w, h = C._h;
    ctx.clearRect(0, 0, w, h);
    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#131820'); bg.addColorStop(1, '#0f1318');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (!C.prop || !C.layer) {
      ctx.fillStyle = '#4c5663'; ctx.font = '11px "Microsoft YaHei"'; ctx.fillText('选择属性以编辑曲线', w / 2 - 60, h / 2);
      return;
    }
    if (!C.view.t1 || C.view.t1 <= C.view.t0) C.view.t1 = AE.app.comp.duration;
    if (C.autoFit) C.autoRange();
    const gx = w - PAD.l - PAD.r, gy = h - PAD.t - PAD.b;
    // 网格
    ctx.strokeStyle = '#1e252e'; ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const y = PAD.t + gy * i / 6;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
      const v = C.y2v(y);
      ctx.fillStyle = '#4d5763'; ctx.font = '8px "Cascadia Mono", monospace'; ctx.textAlign = 'right';
      ctx.fillText(U.round(v, 1), PAD.l - 6, y + 3);
    }
    ctx.textAlign = 'center';
    const span = C.view.t1 - C.view.t0;
    const major = span > 12 ? 2 : span > 5 ? 1 : span > 1.5 ? 0.5 : 0.2;
    for (let t = Math.ceil(C.view.t0 / major) * major; t <= C.view.t1 + 1e-6; t += major) {
      const x = C.t2x(t);
      ctx.strokeStyle = '#1e252e';
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, h - PAD.b); ctx.stroke();
      ctx.fillStyle = '#4d5763'; ctx.font = '8px "Cascadia Mono", monospace';
      ctx.fillText(U.round(t, 2) + 's', x, h - PAD.b + 14);
    }
    // 播放头
    if (AE.app.time >= C.view.t0 && AE.app.time <= C.view.t1) {
      const px = C.t2x(AE.app.time);
      ctx.strokeStyle = 'rgba(255,138,61,.7)'; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(px, PAD.t); ctx.lineTo(px, h - PAD.b); ctx.stroke(); ctx.setLineDash([]);
    }
    // 曲线
    const p = C.prop;
    const n = 220;
    const drawCurve = (getter, color, width, dash) => {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const t = C.view.t0 + span * i / n;
        const v = getter(t);
        const x = C.t2x(t), y = C.v2y(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    };
    if (C.mode === 'speed') {
      drawCurve(t => speedAt(C.layer, p, t), '#ff9d55', 1.8);
    } else if (p.type === 'vec') {
      const colors = ['#ff8a5c', '#6ee7a8', '#7fb8ff'];
      for (let ci = 0; ci < 3; ci++) {
        if (ci !== C.component) {
          drawCurve(t => componentValue(p, A.sample(p, t, C.layer, A.newCtx(AE.app.comp, C.layer, t)), ci), colors[ci] + '44', 1);
        }
      }
      drawCurve(t => componentValue(p, A.sample(p, t, C.layer, A.newCtx(AE.app.comp, C.layer, t)), C.component), colors[C.component], 2);
    } else if (p.type === 'color') {
      ctx.fillStyle = '#5c6673'; ctx.font = '10px "Microsoft YaHei"'; ctx.fillText('颜色属性以关键帧显示', w / 2, PAD.t + 18);
    } else {
      drawCurve(t => A.n(A.sample(p, t, C.layer, A.newCtx(AE.app.comp, C.layer, t))), '#ffb066', 2);
    }
    // 表达式最终曲线
    if (C.showExpr && p.expression && C.mode === 'value') {
      drawCurve(t => C.mode === 'speed' ? speedAt(C.layer, p, t) : componentValue(p, A.sample(p, t, C.layer, A.newCtx(AE.app.comp, C.layer, t)), C.component), '#62d8ed', 1.2, [4, 3]);
    }
    // 关键帧
    const keys = p.keyframes || [];
    for (const k of keys) {
      const t = k.t;
      if (t < C.view.t0 - 0.1 || t > C.view.t1 + 0.1) continue;
      const val = C.mode === 'speed' ? speedAt(C.layer, p, t) : componentValue(p, k.v, C.component);
      const x = C.t2x(t), y = C.v2y(val);
      const selected = C.selected.has(k) || (AE.timeline && AE.timeline.selected.has(k));
      ctx.save();
      ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = selected ? '#ffb24e' : '#dcd4c6';
      ctx.strokeStyle = '#2a2118';
      ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8);
      ctx.restore();
      // 手柄
      if (C.mode === 'value') {
        const i = keys.indexOf(k);
        for (const [adj, dir] of [[keys[i - 1], -1], [keys[i + 1], 1]]) {
          if (!adj) continue;
          const k0 = dir > 0 ? k : adj, k1 = dir > 0 ? adj : k;
          if (k0.outType === 'linear' && k1.inType === 'linear') continue;
          const v0 = componentValue(p, k0.v, C.component), v1 = componentValue(p, k1.v, C.component);
          const dt = k1.t - k0.t, dv = v1 - v0;
          const p1 = { t: k0.t + k0.out.x * dt, v: v0 + k0.out.y * dv };
          const p2 = { t: k1.t - k1.in.x * dt, v: v1 - k1.in.y * dv };
          if (dir > 0) {
            drawHandle(ctx, C.t2x(k0.t), C.v2y(v0), C.t2x(p1.t), C.v2y(p1.v), k0 === k);
          } else {
            drawHandle(ctx, C.t2x(k1.t), C.v2y(v1), C.t2x(p2.t), C.v2y(p2.v), k1 === k);
          }
        }
      }
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5b6572'; ctx.font = '9px "Microsoft YaHei"';
    ctx.fillText((C.mode === 'speed' ? '速度曲线 · 单位/秒' : '值曲线') + (p.expression ? ' · 实线=关键帧，虚线=表达式最终值' : ''), PAD.l, 14);
    if (C._tip) ctx.fillText(C._tip, PAD.l, h - 8);
  };
  function drawHandle(ctx, x0, y0, x1, y1, active) {
    ctx.strokeStyle = active ? 'rgba(110,220,240,.9)' : 'rgba(110,220,240,.35)';
    ctx.fillStyle = active ? '#6edcf0' : 'rgba(110,220,240,.5)';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.arc(x1, y1, active ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // 命中
  C.hit = function (x, y) {
    const p = C.prop;
    if (!p) return null;
    const keys = p.keyframes || [];
    for (let i = keys.length - 1; i >= 0; i--) {
      const k = keys[i];
      const val = C.mode === 'speed' ? speedAt(C.layer, p, k.t) : componentValue(p, k.v, C.component);
      if (Math.hypot(x - C.t2x(k.t), y - C.v2y(val)) < 8) return { type: 'key', key: k };
    }
    if (C.mode === 'value') {
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        for (const adj of [keys[i - 1], keys[i + 1]]) {
          if (!adj) continue;
          const k0 = adj.t < k.t ? adj : k, k1 = adj.t < k.t ? k : adj;
          if (k0.outType === 'linear' && k1.inType === 'linear') continue;
          const v0 = componentValue(p, k0.v, C.component), v1 = componentValue(p, k1.v, C.component);
          const dt = k1.t - k0.t, dv = v1 - v0;
          if (dt <= 1e-6) continue;
          const p1 = { t: k0.t + k0.out.x * dt, v: v0 + k0.out.y * dv };
          const p2 = { t: k1.t - k1.in.x * dt, v: v1 - k1.in.y * dv };
          if (Math.hypot(x - C.t2x(p1.t), y - C.v2y(p1.v)) < 7) return { type: 'handleOut', key: k0, k: k1, seg: [k0, k1] };
          if (Math.hypot(x - C.t2x(p2.t), y - C.v2y(p2.v)) < 7) return { type: 'handleIn', key: k1, k: k0, seg: [k0, k1] };
        }
      }
    }
    return null;
  };

  C.onDown = function (e) {
    if (!C.prop) return;
    const r = C.canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = C.hit(x, y);
    AE.app.snapshot('编辑曲线');
    if (hit) {
      if (hit.type === 'key') {
        if (!e.shiftKey) C.selected.clear();
        C.selected.add(hit.key);
        if (AE.timeline) { AE.timeline.selected.clear(); AE.timeline.selected.add(hit.key); }
        AE.app.setTime(hit.key.t, { raw: true });
        C.drag = {
          type: 'key', key: hit.key, x0: x, y0: y,
          t0: hit.key.t, v0: U.deepClone(hit.key.v)
        };
      } else {
        C.drag = { type: hit.type, x0: x, y0: y, key: hit.key, seg: hit.seg, h0: hit.type === 'handleOut' ? { ...hit.key.out } : { ...hit.key.in } };
      }
    } else {
      if (!e.shiftKey) C.selected.clear();
      C.drag = { type: 'pan', x0: x, y0: y, v0: C.view.v0, v1: C.view.v1 };
    }
    C.canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  C.onMove = function (e) {
    const r = C.canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    C._tip = `t ${C.x2t(x).toFixed(2)}s · v ${U.round(C.y2v(y), 2)}`;
    if (!C.drag) { C.draw(); return; }
    const d = C.drag;
    if (d.type === 'key') {
      const nt = U.clamp(AE.app.time === null ? C.x2t(x) : C.x2t(x), 0, AE.app.comp.duration);
      let snapT = nt;
      if (!e.altKey) { const f = 1 / AE.app.comp.fps; snapT = Math.round(nt / f) * f; }
      d.key.t = snapT;
      if (C.mode === 'value') {
        const nv = C.y2v(y);
        if (C.prop.type === 'vec') {
          const v = A.vec3(d.v0);
          if (C.component === 0) v.x = nv; else if (C.component === 1) v.y = nv; else v.z = nv;
          d.key.v = v;
        } else if (C.prop.type !== 'color') d.key.v = nv;
      }
      A.sortKeys(C.prop);
      A.clearCache();
      AE.app.requestRender();
      if (AE.timeline) AE.timeline.onTime(AE.app.time);
      C.draw();
      return;
    }
    if (d.type === 'handleOut' || d.type === 'handleIn') {
      const k = d.key;
      const seg = d.seg;
      const k0 = seg[0], k1 = seg[1];
      const v0 = componentValue(C.prop, k0.v, C.component), v1 = componentValue(C.prop, k1.v, C.component);
      const dt = k1.t - k0.t, dv = v1 - v0;
      const t = C.x2t(x), v = C.y2v(y);
      let nx = (t - k0.t) / Math.max(1e-6, dt), ny = (v - v0) / (Math.abs(dv) > 1e-6 ? dv : 1);
      nx = U.clamp(nx, 0.01, 0.99); ny = U.clamp(ny, -2, 2);
      if (d.type === 'handleOut') { k.out = { x: nx, y: ny }; k.outType = 'bezier'; }
      else { k.in = { x: 1 - nx, y: 1 - ny }; k.inType = 'bezier'; }
      A.clearCache();
      AE.app.requestRender();
      C.draw();
      return;
    }
    if (d.type === 'pan') {
      const dy = (y - d.y0) / Math.max(1, C._h - PAD.t - PAD.b) * (d.v1 - d.v0);
      C.view.v0 = d.v0 + dy; C.view.v1 = d.v1 + dy;
      C.autoFit = false;
      C.draw();
    }
  };
  C.onUp = function () {
    if (C.drag && C.drag.type !== 'pan') {
      AE.props.refresh();
      if (AE.timeline) { AE.timeline.refresh(); }
      AE.ui.updateExprAlert();
    }
    C.drag = null;
    C.updateSide();
    C.draw();
  };

  C.onTime = function () {
    if (AE.app.view.tab !== 'curves') return;
    C.draw();
    C.updateSide();
  };

})(window);
