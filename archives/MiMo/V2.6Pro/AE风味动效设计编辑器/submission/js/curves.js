/* curves.js — 曲线编辑器：值曲线、速度曲线、拖动编辑 */
(function(global) {
'use strict';

const C = {};
const $ = id => document.getElementById(id);

let dragState = null;

C.render = function() {
  const cv = $('curve-canvas');
  if (!cv) return;
  const wrap = cv.parentElement;
  cv.width = wrap.clientWidth;
  cv.height = wrap.clientHeight - 30;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a1e';
  ctx.fillRect(0, 0, W, H);

  const S = UI.S;
  const comp = S.comp;
  if (!comp) return;
  const layer = UI.selectedLayer();
  if (!layer) {
    ctx.fillStyle = '#556';
    ctx.font = '13px sans-serif';
    ctx.fillText('选择图层并选中属性，查看与编辑曲线', 20, 30);
    return;
  }

  const paths = S.selectedProps.length ? S.selectedProps.map(p => p.propPath) : ['transform.position'];
  const anim = Engine.getAnim(layer, paths[0]);
  if (!anim) {
    ctx.fillStyle = '#556';
    ctx.fillText('该属性不支持曲线', 20, 30);
    return;
  }

  const t0 = 0, t1 = comp.duration;
  const pad = { l: 46, r: 16, t: 14, b: 24 };
  const gw = W - pad.l - pad.r, gh = H - pad.t - pad.b;

  // 值范围
  let vmin = Infinity, vmax = -Infinity;
  const isSpeed = S.curveMode === 'speed';
  const samples = isSpeed
    ? Interp.sampleSpeed(anim, t0, t1, 140, comp.fps)
    : Interp.sampleCurve(anim, t0, t1, 140);

  samples.forEach(s => {
    const vs = Array.isArray(s.v) ? s.v : [s.v];
    vs.forEach(v => {
      vmin = Math.min(vmin, v);
      vmax = Math.max(vmax, v);
    });
  });
  if (!isFinite(vmin)) { vmin = 0; vmax = 1; }
  if (Math.abs(vmax - vmin) < 1e-6) { vmin -= 1; vmax += 1; }
  const margin = (vmax - vmin) * 0.12;
  vmin -= margin; vmax += margin;

  const tx = (t) => pad.l + (t - t0) / (t1 - t0) * gw;
  const ty = (v) => pad.t + (1 - (v - vmin) / (vmax - vmin)) * gh;

  // 网格
  ctx.strokeStyle = '#2a2a32';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const x = pad.l + gw * i / 8;
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + gh); ctx.stroke();
  }
  for (let i = 0; i <= 6; i++) {
    const y = pad.t + gh * i / 6;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + gw, y); ctx.stroke();
    const v = vmax - (vmax - vmin) * i / 6;
    ctx.fillStyle = '#667';
    ctx.font = '10px monospace';
    ctx.fillText(v.toFixed(1), 6, y + 3);
  }
  // 时间标签
  ctx.fillStyle = '#667';
  for (let s = 0; s <= comp.duration; s += Math.max(1, Math.round(comp.duration / 10))) {
    ctx.fillText(s + 's', tx(s) - 6, H - 8);
  }

  // 当前时间线
  ctx.strokeStyle = 'rgba(255,80,80,0.6)';
  ctx.beginPath();
  ctx.moveTo(tx(S.time), pad.t);
  ctx.lineTo(tx(S.time), pad.t + gh);
  ctx.stroke();

  // 曲线
  const colors = ['#5af', '#f84', '#8f6', '#f6a'];
  const dims = Array.isArray(samples[0].v) ? samples[0].v.length : 1;
  for (let d = 0; d < dims; d++) {
    ctx.beginPath();
    samples.forEach((s, i) => {
      const v = Array.isArray(s.v) ? s.v[d] : s.v;
      const x = tx(s.t), y = ty(v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = colors[d % colors.length];
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // 表达式提示
    if (anim.exprOn && anim.expr) {
      ctx.fillStyle = '#8f8';
      ctx.font = '10px sans-serif';
      ctx.fillText('表达式求值曲线', pad.l + 8, pad.t + 12);
    }
  }

  // 关键帧点与手柄
  anim.kfs.forEach((kf, ki) => {
    const v = Array.isArray(kf.v) ? kf.v[0] : kf.v;
    const x = tx(kf.t), y = ty(v);
    const sel = S.selectedKfs.some(sk => sk.propPath === paths[0] && Math.abs(sk.time - kf.t) < 1e-4);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = sel ? '#fc4' : '#e8c868';
    ctx.fill();
    ctx.strokeStyle = '#a87';
    ctx.stroke();

    // 时间手柄（进出影响）
    const drawHandle = (side) => {
      const e = side === 'in' ? kf.easeIn : kf.easeOut;
      const infl = (e ? e.infl : 33) / 100;
      const sp = (e ? e.sp : 0) / 100;
      const dx = (side === 'out' ? 1 : -1) * infl * 40;
      const dy = -sp * 30;
      const hx = x + dx, hy = y + dy;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(hx, hy);
      ctx.strokeStyle = 'rgba(255,200,120,0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fc6';
      ctx.fill();
      return { x: hx, y: hy, side, kf };
    };
    if (sel || S.selectedProps.length) {
      drawHandle('out');
      drawHandle('in');
    }
  });

  // 交互：点击/拖动
  cv.onmousedown = (e) => {
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    // 找最近关键帧
    let best = null, bestD = 12;
    anim.kfs.forEach(kf => {
      const v = Array.isArray(kf.v) ? kf.v[0] : kf.v;
      const d = Math.hypot(tx(kf.t) - mx, ty(v) - my);
      if (d < bestD) { bestD = d; best = { type: 'kf', kf }; }
    });
    // 手柄
    anim.kfs.forEach(kf => {
      const v = Array.isArray(kf.v) ? kf.v[0] : kf.v;
      const x = tx(kf.t), y = ty(v);
      [['out', kf.easeOut], ['in', kf.easeIn]].forEach(([side, e2]) => {
        const infl = (e2 ? e2.infl : 33) / 100;
        const sp = (e2 ? e2.sp : 0) / 100;
        const hx = x + (side === 'out' ? 1 : -1) * infl * 40;
        const hy = y - sp * 30;
        const d = Math.hypot(hx - mx, hy - my);
        if (d < 10 && d < bestD) { bestD = d; best = { type: 'handle', kf, side }; }
      });
    });

    if (best) {
      UI.pushUndo('编辑曲线');
      UI.S.selectedKfs = [{ layerId: layer.id, propPath: paths[0], time: best.kf.t }];
      UI.S.selectedProps = [{ layerId: layer.id, propPath: paths[0] }];
      dragState = { best, tx, ty, anim, layer, path: paths[0] };
      C.render();
      return;
    }
    // 点击空白 = 设置时间
    const t = U.clamp((mx - pad.l) / gw * (t1 - t0) + t0, 0, t1);
    UI.setTime(t);
  };

  window.onmousemove = (e) => {
    if (!dragState) return;
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const { best, tx: tx2, ty: ty2, anim: an, layer: ly } = dragState;
    if (best.type === 'kf') {
      const nt = U.clamp((mx - pad.l) / gw * (t1 - t0) + t0, 0, t1);
      const nv = vmin + (1 - (my - pad.t) / gh) * (vmax - vmin);
      best.kf.t = nt;
      if (Array.isArray(best.kf.v)) best.kf.v[0] = nv;
      else best.kf.v = nv;
      an.kfs.sort((a, b) => a.t - b.t);
      Engine.invalidate(ly.id);
      UI.setTime(nt, true);
      UI.renderViewer();
      C.render();
    } else if (best.type === 'handle') {
      const kf = best.kf;
      const v = Array.isArray(kf.v) ? kf.v[0] : kf.v;
      const kx = tx2(kf.t), ky = ty2(v);
      const dx = mx - kx, dy = my - ky;
      const sign = best.side === 'out' ? 1 : -1;
      const infl = U.clamp(Math.abs(dx) / 40 * 100, 1, 100);
      const sp = U.clamp(-dy / 30 * 100, -200, 200);
      const e2 = { infl, sp };
      if (best.side === 'out') kf.easeOut = e2;
      else kf.easeIn = e2;
      Engine.invalidate(ly.id);
      UI.renderViewer();
      C.render();
    }
  };
  window.onmouseup = () => {
    if (dragState) {
      dragState = null;
      Timeline.render();
    }
  };
};

global.Curves = C;
})(window);
