/* ============================================================
   fields.js — 空间场：距离衰减、噪声、旋涡与混合
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const F = AE.fields = {};

  F.resolve = function (layer, t, ctx) {
    if (!layer || !layer.field) return null;
    ctx = ctx || A.newCtx(layer._comp, layer, t);
    const f = layer.field;
    const pos = A.vec3(A.sample(f.position, t, layer, ctx));
    const radius = Math.max(1, A.n(A.sample(f.radius, t, layer, ctx)));
    const strength = A.n(A.sample(f.strength, t, layer, ctx));
    const falloff = A.n(A.sample(f.falloff, t, layer, ctx));
    const freq = Math.max(1, A.n(A.sample(f.frequency, t, layer, ctx)));
    const evo = A.n(A.sample(f.evolution, t, layer, ctx));
    const spin = A.n(A.sample(f.spin, t, layer, ctx));
    const seed = f.seed === undefined ? 1 : f.seed;
    const type = typeof f.type === 'string' ? f.type : (A.sample(f.type, t, layer, ctx) || 'radial');
    return {
      layerId: layer.id, layer: layer, name: layer.name, type,
      position: pos, x: pos.x, y: pos.y, z: pos.z,
      radius, strength, falloff, freq, evo, spin, seed,
      blend: f.blend || 'add', time: t,
      _cacheKey: `${type}|${pos.x.toFixed(2)},${pos.y.toFixed(2)}|${radius.toFixed(1)}|${strength.toFixed(1)}|${falloff.toFixed(1)}|${freq.toFixed(2)}|${evo.toFixed(2)}|${seed}`
    };
  };

  F.falloff = function (f, p) {
    const dx = p.x - f.x, dy = p.y - f.y;
    const d = Math.hypot(dx, dy);
    if (d > f.radius) return 0;
    const soft = U.clamp(f.falloff / 100, 0, 1);
    const inner = f.radius * (1 - soft) * 0.92;
    let w;
    if (d <= inner) w = 1;
    else w = 1 - U.smoothstep(inner, f.radius, d);
    // 边缘再柔和一些
    w *= U.smoothstep(f.radius, f.radius * 0.82, d);
    return U.clamp(w, 0, 1);
  };

  F.applyAt = function (f, p, t) {
    const w = F.falloff(f, p);
    if (w <= 0) return { x: 0, y: 0, z: 0 };
    if (f.type === 'noise' || f.type === 'turbulence') {
      const s = f.seed * 13.37;
      const tt = (t || 0) * f.evo;
      const nx = U.fbm2((p.x + s) / f.freq + tt, (p.y - s) / f.freq - tt * 0.7, f.type === 'turbulence' ? 5 : 3);
      const ny = U.fbm2((p.y + s * 2) / f.freq - tt * 0.6, (p.x - s * 3) / f.freq + tt, f.type === 'turbulence' ? 5 : 3);
      const nz = U.fbm2((p.x + s) / f.freq + 7.7, (p.y + s) / f.freq - 7.7, 2);
      return { x: nx * f.strength * w, y: ny * f.strength * w, z: nz * f.strength * w * 0.4 };
    }
    let dx = p.x - f.x, dy = p.y - f.y;
    const d = Math.hypot(dx, dy) || 1;
    if (f.type === 'vortex') {
      const tx = -dy / d, ty = dx / d;
      const spin = (f.spin || 0);
      return { x: tx * f.strength * w * (1 + spin * 0.01), y: ty * f.strength * w * (1 + spin * 0.01), z: 0 };
    }
    if (f.type === 'direction') {
      const ang = (f.spin || 0) * U.DEG;
      return { x: Math.cos(ang) * f.strength * w, y: Math.sin(ang) * f.strength * w, z: 0 };
    }
    // radial: 正值为排斥，负值为吸引
    const k = f.strength * w;
    const fall = U.smoothstep(f.radius, 0, d);
    return { x: (dx / d) * k * (0.4 + fall * 0.6), y: (dy / d) * k * (0.4 + fall * 0.6), z: 0 };
  };

  // 粒子的场加速度（更接近力）
  F.forceAt = function (f, p, t) {
    const w = F.falloff(f, p);
    if (w <= 0) return { x: 0, y: 0, z: 0 };
    const r = F.applyAt(f, p, t);
    const scale = 0.55;
    return { x: r.x * scale, y: r.y * scale, z: r.z * scale };
  };

  F.drawRange = function (ctx, f, cam) {
    // 在画布叠加层显示场范围
    if (!f) return;
    const pr = cam.projectWorld ? cam.projectWorld({ x: f.x, y: f.y, z: f.z }) : null;
    if (!pr) return;
    const rad = cam.scaleAt ? cam.scaleAt(f.z, f.radius) : f.radius;
    ctx.save();
    ctx.strokeStyle = f.type === 'vortex' ? 'rgba(192,132,252,.5)' : (f.type === 'noise' ? 'rgba(255,207,107,.45)' : 'rgba(110,231,168,.5)');
    ctx.fillStyle = f.type === 'vortex' ? 'rgba(192,132,252,.05)' : (f.type === 'noise' ? 'rgba(255,207,107,.045)' : 'rgba(110,231,168,.05)');
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y, rad, rad, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.fillStyle = 'rgba(200,210,220,.65)';
    ctx.font = '9px "Cascadia Mono", monospace';
    ctx.fillText(f.name + ' · ' + f.type, pr.x + 8, pr.y - 8);
    ctx.restore();
  };

})(window);
