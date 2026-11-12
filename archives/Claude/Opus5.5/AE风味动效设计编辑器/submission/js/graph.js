'use strict';
// ============ 曲线编辑器：值曲线与速度曲线 ============
const Graph = {
  speed: false, autoFit: true, vmin: 0, vmax: 1, COLORS: ['#ff6b6b', '#7fd84f', '#59a8ff', '#ffc46b', '#c18bff', '#5fe0d0'],
  props() {
    const c = App.comp; const out = [];
    if (App.sel.props.size) { for (const id of App.sel.props) { const o = Model.findPropOwner(c, id); if (o) out.push({ p: o.node.prop, node: o.node, L: o.layer }); } }
    else for (const L of App.selLayers()) for (const f of Model.flatProps(L)) { const p = f.node.prop; if ((Anim.isAnimated(p) || (p.xOn && p.x)) && ['num', 'angle', 'vec', 'color'].includes(f.node.kind)) out.push({ p, node: f.node, L }); }
    return out.slice(0, 12);
  },
  vy(v, H) { const top = Timeline.HEAD + 14, bot = H - 14; return bot - (v - this.vmin) / ((this.vmax - this.vmin) || 1) * (bot - top); },
  yv(y, H) { const top = Timeline.HEAD + 14, bot = H - 14; return this.vmin + (bot - y) / (bot - top) * (this.vmax - this.vmin); },
  sample(it, t) {
    const comp = App.comp;
    if (this.speed) return [Anim.speedAt(it.p, comp, it.L, t)];
    const v = Anim.evalProp(it.p, comp, it.L, t); return U.isArr(v) ? v.slice(0, it.node.dims || v.length) : [v];
  },
  draw(c, W, H) {
    const items = this.props(); this.items = items; this.hits = [];
    c.fillStyle = '#121215'; c.fillRect(0, Timeline.HEAD, W, H);
    if (!items.length) { c.fillStyle = '#6d6a66'; c.fillText('在时间轴中选择带动画或表达式的属性（或选择图层），这里显示其值曲线 / 速度曲线。', 16, Timeline.HEAD + 30); return; }
    const t0 = Timeline.xt(0), t1 = Timeline.xt(W); const N = Math.min(600, Math.max(60, W / 2));
    const series = items.map(it => { const arr = []; for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N; arr.push([t, this.sample(it, t)]); } return arr; });
    if (this.autoFit) {
      let mn = 1e18, mx = -1e18; for (const s of series) for (const [, v] of s) for (const x of v) { if (isFinite(x)) { mn = Math.min(mn, x); mx = Math.max(mx, x); } }
      if (mn > mx) { mn = 0; mx = 1; } if (mx - mn < 1e-6) { mn -= 1; mx += 1; } const pad = (mx - mn) * 0.12; this.vmin = mn - pad; this.vmax = mx + pad; this.autoFit = false;
    }
    // 网格
    c.strokeStyle = '#1f1f24'; c.fillStyle = '#5f5d5b';
    const range = this.vmax - this.vmin; const step = Math.pow(10, Math.floor(Math.log10(range / 4)));
    const st = range / step > 12 ? step * 5 : range / step > 6 ? step * 2 : step;
    for (let v = Math.ceil(this.vmin / st) * st; v < this.vmax; v += st) { const y = this.vy(v, H); c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke(); c.fillText(U.fmt(v, 2), 4, y - 2); }
    let ci = 0;
    items.forEach((it, ii) => {
      const s = series[ii]; const dims = s[0][1].length; const expr = it.p.xOn && it.p.x;
      for (let d = 0; d < dims; d++) {
        const col = this.COLORS[(ci++) % this.COLORS.length];
        c.strokeStyle = col; c.lineWidth = 1.6; if (expr) c.setLineDash([5, 3]);
        c.beginPath(); s.forEach(([t, v], i) => { const x = Timeline.tx(t), y = this.vy(v[d], H); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); c.setLineDash([]); c.lineWidth = 1;
        c.fillStyle = col; c.fillText((it.L ? it.L.name + ' · ' : '') + it.node.label + (dims > 1 ? ['.X', '.Y', '.Z'][d] : '') + (expr ? '（表达式结果）' : '') + (this.speed ? ' 速度' : ''), W - 260, Timeline.HEAD + 16 + (ci - 1) * 13);
        if (this.speed && d > 0) continue;
      }
      // 关键帧与手柄
      const p = it.p; if (!p.k) return; const st0 = it.L ? it.L.startTime : 0;
      p.k.forEach((k, i) => {
        const tk = k.t + st0; const x = Timeline.tx(tk); const sel = App.sel.keys.has(k);
        const vals = this.speed ? [Anim.speedAt(p, App.comp, it.L, tk + (i === 0 ? 0.002 : -0.002))] : (U.isArr(k.v) ? k.v.slice(0, it.node.dims || k.v.length) : [k.v]);
        vals.forEach((v, d) => { const y = this.vy(this.speed ? this.sample(it, tk + (i < p.k.length - 1 ? 0.001 : -0.001))[0] : v, H); c.fillStyle = sel ? '#ff8a3d' : '#eee'; c.fillRect(x - 3.5, y - 3.5, 7, 7); c.strokeStyle = '#000'; c.strokeRect(x - 3.5, y - 3.5, 7, 7); this.hits.push({ kind: 'key', x, y, k, p, it, d, i }); });
        if (!sel) return;
        // 手柄
        const dims1 = !U.isArr(k.v) || this.speed;
        if (!dims1) return;
        const next = p.k[i + 1], prev = p.k[i - 1];
        const handle = (which) => {
          const nb = which === 'out' ? next : prev; if (!nb) return;
          const isB = which === 'out' ? k.oi === 'bezier' : k.ii === 'bezier';
          const e = which === 'out' ? (k.eo || { s: 0, f: 33 }) : (k.ei || { s: 0, f: 33 }); const dt = Math.abs(nb.t - k.t); const f = (isB ? e.f : 33.3) / 100;
          const ht = tk + (which === 'out' ? 1 : -1) * f * dt;
          let hv, ky;
          if (this.speed) { ky = this.vy(this.sample(it, tk + (which === 'out' ? 0.001 : -0.001))[0], H); hv = isB ? e.s : this.sample(it, tk + (which === 'out' ? 0.001 : -0.001))[0]; }
          else { ky = this.vy(k.v, H); const sg = Math.sign(next ? next.v - k.v : k.v - prev.v) || 1; const sgn = which === 'out' ? Math.sign((next ? next.v : k.v) - k.v) || 1 : Math.sign(k.v - (prev ? prev.v : k.v)) || 1; const sp = isB ? e.s : Math.abs((nb.v - k.v) / (nb.t - k.t)); hv = k.v + (which === 'out' ? 1 : -1) * sgn * sp * f * dt; }
          const hx = Timeline.tx(ht), hy = this.vy(hv, H);
          c.strokeStyle = '#ffc46b'; c.beginPath(); c.moveTo(x, ky); c.lineTo(hx, hy); c.stroke(); c.fillStyle = '#ffc46b'; c.beginPath(); c.arc(hx, hy, 3.5, 0, 7); c.fill();
          this.hits.push({ kind: 'handle', x: hx, y: hy, k, p, it, which, nb, tk });
        };
        handle('out'); handle('in');
      });
    });
  },
  hitKey(x, y) { let b = null, bd = 8; for (const h of this.hits || []) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; b = h; } } return b; },
  wheel(e) { if (e.ctrlKey || e.altKey) return false; const H = Timeline.H; const [, y] = Timeline.mpos(e); const v = this.yv(y, H); const f = e.deltaY > 0 ? 1.15 : 1 / 1.15; this.vmin = v + (this.vmin - v) * f; this.vmax = v + (this.vmax - v) * f; Timeline.draw(); return true; },
  down(e, x, y) {
    const h = this.hitKey(x, y); const H = Timeline.H;
    if (!h) {
      // 平移
      if (e.button === 1 || e.altKey || true) {
        const v0 = [this.vmin, this.vmax], t00 = Timeline.t0, y0 = y, x0 = x; let moved = false;
        const mv = ev => { const [x2, y2] = Timeline.mpos(ev); moved = true; const dv = (y2 - y0) / (H - Timeline.HEAD - 28) * (v0[1] - v0[0]); this.vmin = v0[0] + dv; this.vmax = v0[1] + dv; Timeline.t0 = t00 - (x2 - x0) / Timeline.pps; Timeline.draw(); };
        const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (!moved) { App.sel.keys.clear(); App.setTime(Timeline.xt(x0)); } };
        addEventListener('mousemove', mv); addEventListener('mouseup', up);
      }
      return;
    }
    if (!App.sel.keys.has(h.k)) { if (!e.shiftKey) App.sel.keys.clear(); App.sel.keys.add(h.k); }
    const it = h.it, k = h.k, p = h.p; const st0 = it.L ? it.L.startTime : 0;
    let moved = false;
    if (h.kind === 'key') {
      const t0 = k.t, v0 = U.clone(k.v);
      const mv = ev => {
        const [x2, y2] = Timeline.mpos(ev); moved = true;
        k.t = Timeline.snapT(t0 + st0 + (x2 - x) / Timeline.pps, App.sel.keys) - st0;
        if (!this.speed && !ev.shiftKey) { const dv = this.yv(y2, H) - this.yv(y, H); if (U.isArr(v0)) { k.v = v0.slice(); k.v[h.d] = v0[h.d] + dv; } else k.v = v0 + dv; }
        Anim.sortKeys(p); Anim.touch(); Timeline.draw(); App.request('view', 'vals');
      };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (moved) App.edited('编辑曲线关键帧'); Timeline.draw(); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up); return;
    }
    // 手柄：影响（水平）+ 速度（垂直）
    const which = h.which, nb = h.nb; const dt = Math.abs(nb.t - k.t);
    const mv = ev => {
      const [x2, y2] = Timeline.mpos(ev); moved = true;
      const ht = Timeline.xt(x2); const f = U.clamp(Math.abs(ht - h.tk) / dt, 0.01, 1);
      let s;
      if (this.speed) s = this.yv(y2, H);
      else { const hv = this.yv(y2, H); const sgn = which === 'out' ? (Math.sign(nb.v - k.v) || 1) : (Math.sign(k.v - nb.v) || 1); s = (hv - k.v) / ((which === 'out' ? 1 : -1) * f * dt) * sgn; }
      if (which === 'out') { k.oi = 'bezier'; k.eo = { s, f: f * 100 }; if (!ev.altKey && k.ii === 'bezier' && !this.speed) k.ei = { s, f: k.ei ? k.ei.f : 33.3 }; }
      else { k.ii = 'bezier'; k.ei = { s, f: f * 100 }; if (!ev.altKey && k.oi === 'bezier' && !this.speed) k.eo = { s, f: k.eo ? k.eo.f : 33.3 }; }
      Anim.touch(); Timeline.draw(); App.request('view', 'vals');
    };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (moved) App.edited('编辑缓动手柄'); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  },
};
