/* PRISM core utilities */
(function () {
  const AE = (window.AE = window.AE || {});

  const U = (AE.U = {});
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  U.clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.invLerp = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));
  U.smoothstep = (a, b, x) => { const t = U.clamp((x - a) / (b - a || 1)); return t * t * (3 - 2 * t); };
  U.easeOut = t => 1 - Math.pow(1 - t, 3);
  U.easeIn = t => t * t * t;
  U.easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  U.rad = d => d * Math.PI / 180;
  U.deg = r => r * 180 / Math.PI;
  U.round = (v, p = 0) => { const m = Math.pow(10, p); return Math.round(v * m) / m; };
  U.map = (v, a, b, c, d) => c + (d - c) * U.clamp((v - a) / (b - a || 1));
  U.mod = (v, n) => ((v % n) + n) % n;
  U.mix = U.lerp;

  U.uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  U.hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  U.seedRand = (seed) => {
    let a = (seed ^ 0x9e3779b9) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const perm = new Uint8Array(512);
  (() => {
    const r = U.seedRand(1337); const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  })();
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad2 = (h, x, y) => { const u = (h & 1) ? x : -x, v = (h & 2) ? y : -y; return u + v; };
  U.noise2 = (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    return U.lerp(U.lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u), U.lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u), v);
  };
  U.fbm2 = (x, y, oct = 3, lac = 2, gain = .5) => {
    let a = 0, amp = .5, f = 1;
    for (let i = 0; i < oct; i++) { a += amp * U.noise2(x * f, y * f); f *= lac; amp *= gain; }
    return a;
  };
  U.noise3 = (x, y, z) => (U.noise2(x + z * .71, y - z * .37) + U.noise2(x - z * .43 + 17.3, y + z * .83 + 9.1)) * .5;

  // ---------- easing ----------
  U.cubicBezier = (p1x, p1y, p2x, p2y) => {
    const A = (a, b) => 3 * a * (1 - b) * (1 - b) + 3 * b * (1 - b) * 0 ; // unused
    const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
    const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t;
    const sy = t => ((ay * t + by) * t + cy) * t;
    const dx = t => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-6) return sy(t); const d = dx(t); if (Math.abs(d) < 1e-8) break; t -= e / d; }
      let lo = 0, hi = 1; t = x;
      for (let i = 0; i < 24; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-5) return sy(t); if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return sy(t);
    };
  };
  U.EASE_PRESETS = {
    linear: [1 / 3, 1 / 3, 2 / 3, 2 / 3],
    ease: [.33, 0, .67, 1],
    easeIn: [.42, 0, 1, 1],
    easeOut: [0, 0, .58, 1],
    snappy: [.2, .9, .25, 1],
    slow: [.7, 0, .9, 1]
  };

  // ---------- colors ----------
  U.hexToRgb = (hex) => {
    hex = String(hex || '#ffffff').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  U.rgbToHex = (rgb) => {
    const c = v => Math.round(U.clamp(v) * 255).toString(16).padStart(2, '0');
    return '#' + c(rgb[0]) + c(rgb[1]) + c(rgb[2]);
  };
  U.rgbaStr = (c, a) => `rgba(${Math.round(U.clamp(c[0]) * 255)},${Math.round(U.clamp(c[1]) * 255)},${Math.round(U.clamp(c[2]) * 255)},${a == null ? (c[3] == null ? 1 : c[3]) : a})`;
  U.lerpColor = (a, b, t) => [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t), U.lerp(a[3] == null ? 1 : a[3], b[3] == null ? 1 : b[3], t)];
  U.colorArr = (v) => {
    if (!v) return [1, 1, 1, 1];
    if (Array.isArray(v)) return v.length === 4 ? v : [v[0], v[1], v[2], 1];
    return U.hexToRgb(v).concat([1]);
  };
  U.cssColor = (v) => Array.isArray(v) ? U.rgbaStr(v) : (v || '#fff');
  U.hsv2rgb = (h, s, v) => {
    h = U.mod(h, 1) * 6; const i = Math.floor(h), f = h - i;
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  };

  // ---------- time ----------
  U.pad = (n, l = 2) => String(Math.floor(n)).padStart(l, '0');
  U.timecode = (t, fps = 60) => {
    t = Math.max(0, t);
    const f = Math.floor(t * fps + 1e-6);
    const ff = f % fps, s = Math.floor(f / fps), ss = s % 60, m = Math.floor(s / 60) % 60, h = Math.floor(s / 3600);
    return `${U.pad(h)}:${U.pad(m)}:${U.pad(ss)}:${U.pad(ff)}`;
  };
  U.parseTime = (str, fps = 60) => {
    str = String(str).trim();
    if (!str) return null;
    if (str.includes(':')) {
      const p = str.split(':').map(Number).reverse();
      let t = 0;
      if (p[0] != null) t += p[0] / fps;
      if (p[1] != null) t += p[1];
      if (p[2] != null) t += p[2] * 60;
      if (p[3] != null) t += p[3] * 3600;
      return t;
    }
    const m = str.match(/^(-?[\d.]+)\s*(s|f|帧|秒)?$/);
    if (!m) return null;
    const v = parseFloat(m[1]); if (isNaN(v)) return null;
    return m[2] === 'f' || m[2] === '帧' ? v / fps : v;
  };

  // ---------- math / mat4 ----------
  const M = (AE.M = {});
  M.add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + (b[2] || 0)];
  M.sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] + (a[2] ? 0 : 0) - (b[2] || 0)];
  M.mul = (a, s) => [a[0] * s, a[1] * s, (a[2] || 0) * s];
  M.len = a => Math.hypot(a[0], a[1], a[2] || 0);
  M.norm = a => { const l = M.len(a) || 1; return [a[0] / l, a[1] / l, (a[2] || 0) / l]; };
  M.dot = (a, b) => a[0] * b[0] + a[1] * b[1] + (a[2] || 0) * (b[2] || 0);
  M.cross = (a, b) => [a[1] * (b[2] || 0) - (a[2] || 0) * b[1], (a[2] || 0) * b[0] - a[0] * (b[2] || 0), a[0] * b[1] - a[1] * b[0]];
  M.lerp = (a, b, t) => [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2] || 0, b[2] || 0, t)];
  M.dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0));

  M.identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  M.clone = m => new Float32Array(m);
  M.mult = (a, b) => {
    const o = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      o[i * 4 + j] = a[j] * b[i * 4] + a[4 + j] * b[i * 4 + 1] + a[8 + j] * b[i * 4 + 2] + a[12 + j] * b[i * 4 + 3];
    }
    return o;
  };
  M.translate = (x, y, z = 0) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  M.scale = (x, y = x, z = 1) => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
  M.rotateX = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
  M.rotateY = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };
  M.rotateZ = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); };
  M.fromTRS = (pos, rot, scl, anchor) => {
    let m = M.translate(pos[0] - (anchor ? anchor[0] : 0), pos[1] - (anchor ? anchor[1] : 0), (pos[2] || 0) - (anchor ? (anchor[2] || 0) : 0));
    m = M.mult(m, M.rotateZ(U.rad(rot[2] || 0)));
    m = M.mult(m, M.rotateY(U.rad(rot[1] || 0)));
    m = M.mult(m, M.rotateX(U.rad(rot[0] || 0)));
    m = M.mult(m, M.scale(scl[0] / 100, scl[1] / 100, (scl[2] == null ? 100 : scl[2]) / 100));
    return m;
  };
  M.transformPoint = (m, p) => {
    const x = p[0], y = p[1], z = p[2] || 0;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w];
  };
  M.transformDir = (m, p) => {
    const x = p[0], y = p[1], z = p[2] || 0;
    return [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
  };
  M.invert = (m) => {
    const o = new Float32Array(16);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
      a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return M.identity(); det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  };
  M.perspective = (fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  };
  M.ortho = (l, r, b, t, n, f) => {
    const lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
    return new Float32Array([-2 * lr, 0, 0, 0, 0, -2 * bt, 0, 0, 0, 0, 2 * nf, 0, (l + r) * lr, (t + b) * bt, (f + n) * nf, 1]);
  };
  M.lookAt = (eye, center, up = [0, 1, 0]) => {
    let z = M.norm(M.sub(eye, center)); if (M.len(z) < 1e-6) z = [0, 0, 1];
    let x = M.cross(up, z); if (M.len(x) < 1e-6) { x = M.cross([1, 0, 0], z); } x = M.norm(x);
    const y = M.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -M.dot(x, eye), -M.dot(y, eye), -M.dot(z, eye), 1]);
  };
  M.invertRotScale = (m) => {
    const o = new Float32Array(16);
    const bx = [m[0], m[1], m[2]], by = [m[4], m[5], m[6]], bz = [m[8], m[9], m[10]];
    const sx = M.len(bx) || 1, sy = M.len(by) || 1, sz = M.len(bz) || 1;
    const ix = M.mul(bx, 1 / (sx * sx)), iy = M.mul(by, 1 / (sy * sy)), iz = M.mul(bz, 1 / (sz * sz));
    o[0] = ix[0]; o[1] = iy[0]; o[2] = iz[0]; o[3] = 0;
    o[4] = ix[1]; o[5] = iy[1]; o[6] = iz[1]; o[7] = 0;
    o[8] = ix[2]; o[9] = iy[2]; o[10] = iz[2]; o[11] = 0;
    const t = [-m[12], -m[13], -m[14]];
    o[12] = M.dot(ix, t); o[13] = M.dot(iy, t); o[14] = M.dot(iz, t); o[15] = 1;
    return o;
  };
  M.decompose = (m) => {
    const pos = [m[12], m[13], m[14]];
    const sx = M.len([m[0], m[1], m[2]]), sy = M.len([m[4], m[5], m[6]]), sz = M.len([m[8], m[9], m[10]]);
    const r = [0, 0, 0];
    const r20 = -m[8] / (sz || 1);
    r[1] = Math.asin(U.clamp(r20, -1, 1));
    if (Math.abs(r20) < .9999) { r[0] = Math.atan2(m[9] / sy, m[10] / sz); r[2] = Math.atan2(m[1] / sx, m[0] / sx); }
    else { r[0] = Math.atan2(-m[6] / sy, m[5] / sy); }
    return { pos, rot: r.map(U.deg), scale: [sx * 100, sy * 100, sz * 100] };
  };
  // 2D affine [a,b,c,d,e,f]
  U.affine = (() => {
    const id = () => [1, 0, 0, 1, 0, 0];
    const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
    const trs = (x, y, rot, sx, sy, ax = 0, ay = 0) => {
      const c = Math.cos(rot), s = Math.sin(rot);
      return [c * sx, s * sx, -s * sy, c * sy, x - (c * sx * ax - s * sy * ay), y - (s * sx * ax + c * sy * ay)];
    };
    const apply = (A, x, y) => [A[0] * x + A[2] * y + A[4], A[1] * x + A[3] * y + A[5]];
    const inv = (A) => { const d = A[0] * A[3] - A[1] * A[2] || 1e-9; return [A[3] / d, -A[1] / d, -A[2] / d, A[0] / d, (A[2] * A[5] - A[3] * A[4]) / d, (A[1] * A[4] - A[0] * A[5]) / d]; };
    return { id, mul, trs, apply, inv };
  })();

  // ---------- geometry helpers ----------
  U.rayPlane = (origin, dir, planePoint, planeNormal) => {
    const denom = M.dot(planeNormal, dir);
    if (Math.abs(denom) < 1e-7) return null;
    const t = M.dot(M.sub(planePoint, origin), planeNormal) / denom;
    return t < 0 ? null : M.add(origin, M.mul(dir, t));
  };

  // ---------- arrays ----------
  U.range = (n, f) => Array.from({ length: n }, (_, i) => f ? f(i) : i);
  U.sum = a => a.reduce((x, y) => x + y, 0);
  U.last = a => a[a.length - 1];
  U.uniq = a => Array.from(new Set(a));
  U.deepClone = (o) => { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; } };
  U.deepMerge = (a, b) => {
    if (Array.isArray(a) || Array.isArray(b)) return b === undefined ? a : b;
    if (typeof a !== 'object' || a === null) return b === undefined ? a : b;
    const o = Object.assign({}, a);
    if (b && typeof b === 'object') for (const k of Object.keys(b)) o[k] = U.deepMerge(a[k], b[k]);
    return o;
  };
  U.equals = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // ---------- download ----------
  U.download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  };
  U.readFileAsText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
  U.readFileAsArrayBuffer = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(file); });
  U.blobToBase64 = (blob) => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

  // ---------- tiny event bus ----------
  class Bus {
    constructor() { this.m = new Map(); }
    on(k, f) { if (!this.m.has(k)) this.m.set(k, new Set()); this.m.get(k).add(f); return () => this.off(k, f); }
    off(k, f) { const s = this.m.get(k); if (s) s.delete(f); }
    emit(k, ...a) { const s = this.m.get(k); if (s) for (const f of Array.from(s)) { try { f(...a); } catch (e) { console.error(e); } } }
  }
  AE.Bus = Bus;
  AE.bus = new Bus();

  U.nextFrame = () => new Promise(r => requestAnimationFrame(r));
  U.wait = ms => new Promise(r => setTimeout(r, ms));

  U.roman = (n) => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n);
  U.ordinal = (n) => n + ['', 'st', 'nd', 'rd'][n % 10 > 3 || n % 100 > 13 ? 0 : n % 10] || n + 'th';
})();
