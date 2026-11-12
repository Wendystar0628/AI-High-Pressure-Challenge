/* 轻量向量 / 相机 / 随机工具（经典脚本，挂到 window.M） */
(function () {
  'use strict';
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    mul: (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    clone: (a) => [a[0], a[1], a[2]],
  };

  function makeCamera(pos, target, fovDeg) {
    const fwd = V.norm(V.sub(target, pos));
    let right = V.cross(fwd, [0, 1, 0]);
    if (V.len(right) < 1e-5) right = [1, 0, 0];
    right = V.norm(right);
    const up = V.norm(V.cross(right, fwd));
    return {
      pos: V.clone(pos), target: V.clone(target),
      fwd, right, up,
      tanHalf: Math.tan(fovDeg * Math.PI / 360),
      fovDeg,
    };
  }

  // orbit camera: yaw/pitch around target
  function orbitCamera(target, yaw, pitch, dist, fovDeg) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const pos = [
      target[0] + dist * cp * Math.sin(yaw),
      target[1] + dist * sp,
      target[2] + dist * cp * Math.cos(yaw),
    ];
    return makeCamera(pos, target, fovDeg);
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a || 1), 0, 1); return t * t * (3 - 2 * t); };

  window.M = { V, makeCamera, orbitCamera, mulberry32, clamp, lerp, smoothstep };
})();
