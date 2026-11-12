'use strict';
// ---------------------------------------------------------------------------
// 通用数学与工具函数（全局命名空间 U）
// ---------------------------------------------------------------------------
const U = (() => {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const easeInOut = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = (t) => { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); };

  // --- vec3 (普通数组) ---
  const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // --- mat4 列主序 Float32Array ---
  const m4 = () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
  function mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  // WebGPU 深度范围 0..1
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = f / aspect; o[5] = f; o[10] = far / (near - far); o[11] = -1; o[14] = (near * far) / (near - far);
    return o;
  }
  function ortho(l, r, b, t, n, f) {
    const o = new Float32Array(16);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = 1 / (n - f);
    o[12] = (l + r) / (l - r); o[13] = (t + b) / (b - t); o[14] = n / (n - f); o[15] = 1;
    return o;
  }
  function lookAt(eye, at, up) {
    const z = norm(sub(eye, at)), x = norm(cross(up, z)), y = cross(z, x), o = new Float32Array(16);
    o[0] = x[0]; o[4] = x[1]; o[8] = x[2];
    o[1] = y[0]; o[5] = y[1]; o[9] = y[2];
    o[2] = z[0]; o[6] = z[1]; o[10] = z[2];
    o[12] = -dot(x, eye); o[13] = -dot(y, eye); o[14] = -dot(z, eye); o[15] = 1;
    return o;
  }
  function invert(m) {
    const inv = new Float32Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    det = det ? 1 / det : 0;
    for (let i = 0; i < 16; i++) inv[i] *= det;
    return inv;
  }
  function translate(x, y, z) { const m = m4(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function scaleM(x, y, z) { const m = m4(); m[0] = x; m[5] = y; m[10] = z; return m; }
  function rotY(a) { const m = m4(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function rotX(a) { const m = m4(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function rotZ(a) { const m = m4(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }

  // --- 四元数 [x,y,z,w] ---
  function qmul(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  }
  function qnorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
  // 按角速度 w 积分 dt
  function qintegrate(q, w, dt) {
    const dq = qmul([w[0] * 0.5 * dt, w[1] * 0.5 * dt, w[2] * 0.5 * dt, 0], q);
    return qnorm([q[0] + dq[0], q[1] + dq[1], q[2] + dq[2], q[3] + dq[3]]);
  }

  // --- 确定性随机数 ---
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 关键帧插值（Catmull-Rom 平滑），keys: [{t, v:[...]}]
  function sampleKeys(keys, t) {
    if (t <= keys[0].t) return keys[0].v.slice();
    const n = keys.length;
    if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
    let i = 0; while (i < n - 2 && t > keys[i + 1].t) i++;
    const k0 = keys[Math.max(i - 1, 0)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(i + 2, n - 1)];
    let s = (t - k1.t) / (k2.t - k1.t);
    if (k1.ease !== 'linear') s = s * s * (3 - 2 * s) * 0.65 + s * 0.35;
    const out = [];
    for (let j = 0; j < k1.v.length; j++) {
      const p0 = k0.v[j], p1 = k1.v[j], p2 = k2.v[j], p3 = k3.v[j];
      const m1 = (p2 - p0) * 0.5 * (k2.t - k1.t) / Math.max(k2.t - k0.t, 1e-6) * 2;
      const m2 = (p3 - p1) * 0.5 * (k2.t - k1.t) / Math.max(k3.t - k1.t, 1e-6) * 2;
      const s2 = s * s, s3 = s2 * s;
      out.push((2 * s3 - 3 * s2 + 1) * p1 + (s3 - 2 * s2 + s) * m1 + (-2 * s3 + 3 * s2) * p2 + (s3 - s2) * m2);
    }
    return out;
  }

  // 分段线性速率曲线：rate(τ)，返回 simTime(τ)=∫rate
  function makeTimeMap(segments, duration) {
    // segments: [{t0, rate}] 按 t0 升序；含过渡平滑
    const N = Math.ceil(duration * 2000) + 2, dt = duration / (N - 1);
    const tbl = new Float64Array(N);
    const rateAt = (t) => {
      let r = segments[0].rate;
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        if (t >= s.t0) {
          const prev = i > 0 ? segments[i - 1].rate : s.rate;
          const k = s.blend ? smooth(s.t0, s.t0 + s.blend, t) : 1;
          r = prev + (s.rate - prev) * k;
        }
      }
      return r;
    };
    for (let i = 1; i < N; i++) {
      const t = (i - 0.5) * dt;
      tbl[i] = tbl[i - 1] + rateAt(t) * dt;
    }
    return {
      rateAt,
      sim(t) {
        const f = clamp(t / dt, 0, N - 1), i = Math.floor(f), fr = f - i;
        if (i >= N - 1) return tbl[N - 1];
        return tbl[i] + (tbl[i + 1] - tbl[i]) * fr;
      },
      total: () => tbl[N - 1],
    };
  }

  return {
    clamp, lerp, smooth, easeInOut, easeOut, v3, add, sub, scale, dot, cross, len, norm, mix3,
    m4, mul, perspective, ortho, lookAt, invert, translate, scaleM, rotY, rotX, rotZ,
    qmul, qnorm, qintegrate, rng, sampleKeys, makeTimeMap,
  };
})();
