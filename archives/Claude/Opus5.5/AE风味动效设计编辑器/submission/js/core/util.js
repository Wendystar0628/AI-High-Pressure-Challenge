// 基础数学、噪声、随机与颜色工具
(function (G) {
  'use strict';
  const AE = G.AE = G.AE || {};
  const U = AE.U = {};

  U.clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (a, b, x) => { const t = U.clamp((x - a) / (b - a || 1e-9), 0, 1); return t * t * (3 - 2 * t); };
  U.deg = Math.PI / 180;
  U.isArr = Array.isArray;
  U.clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  U.lerpV = (a, b, t) => {
    if (typeof a === 'number') return a + (b - a) * t;
    const n = Math.max(a.length, b.length), r = new Array(n);
    for (let i = 0; i < n; i++) r[i] = (a[i] || 0) + ((b[i] || 0) - (a[i] || 0)) * t;
    return r;
  };
  U.dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = (a[i] || 0) - (b[i] || 0); s += d * d; } return Math.sqrt(s); };
  U.len = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s); };
  U.norm = a => { const l = U.len(a) || 1; return a.map(x => x / l); };
  U.add = (a, b) => a.map((x, i) => x + (b[i] || 0));
  U.sub = (a, b) => a.map((x, i) => x - (b[i] || 0));
  U.scale = (a, s) => a.map(x => x * s);
  U.dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * (b[i] || 0); return s; };
  U.cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  U.fmt = (x, d = 1) => { if (typeof x !== 'number' || !isFinite(x)) return String(x); const p = Math.pow(10, d); return String(Math.round(x * p) / p); };
  U.uid = (() => { let n = 0; return (p = 'id') => p + '_' + (Date.now() % 1e6).toString(36) + (n++).toString(36); })();

  // ---------- mat4 (列主序，与 WebGL 一致) ----------
  const M = U.M4 = {};
  M.ident = () => new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  M.copy = m => new Float64Array(m);
  M.mul = (a, b) => {
    const r = new Float64Array(16);
    for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) {
      r[c * 4 + rr] = a[rr] * b[c * 4] + a[4 + rr] * b[c * 4 + 1] + a[8 + rr] * b[c * 4 + 2] + a[12 + rr] * b[c * 4 + 3];
    }
    return r;
  };
  M.trans = (x, y, z) => { const m = M.ident(); m[12] = x; m[13] = y; m[14] = z || 0; return m; };
  M.scale = (x, y, z) => { const m = M.ident(); m[0] = x; m[5] = y; m[10] = z === undefined ? 1 : z; return m; };
  M.rotX = a => { const c = Math.cos(a), s = Math.sin(a), m = M.ident(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; };
  M.rotY = a => { const c = Math.cos(a), s = Math.sin(a), m = M.ident(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; };
  M.rotZ = a => { const c = Math.cos(a), s = Math.sin(a), m = M.ident(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; };
  M.apply = (m, p) => {
    const x = p[0], y = p[1], z = p[2] || 0;
    return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
  };
  M.applyDir = (m, p) => {
    const x = p[0], y = p[1], z = p[2] || 0;
    return [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
  };
  M.apply4 = (m, p) => {
    const x = p[0], y = p[1], z = p[2], w = p[3] === undefined ? 1 : p[3];
    return [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w,
      m[2] * x + m[6] * y + m[10] * z + m[14] * w, m[3] * x + m[7] * y + m[11] * z + m[15] * w];
  };
  M.inv = m => {
    const a = m, r = new Float64Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
      b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
      b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (Math.abs(det) < 1e-14) return M.ident();
    det = 1 / det;
    r[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; r[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    r[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; r[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    r[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; r[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    r[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; r[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    r[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; r[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    r[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; r[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    r[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; r[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    r[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; r[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return r;
  };
  // 去除深度：只保留 XY 仿射部分（二维子层跟随三维父级）
  M.flatten = m => {
    const r = M.ident();
    r[0] = m[0]; r[1] = m[1]; r[4] = m[4]; r[5] = m[5]; r[12] = m[12]; r[13] = m[13];
    return r;
  };
  M.f32 = m => new Float32Array(m);
  M.normal3 = m => { // 法线矩阵（3x3 逆转置），列主序
    const i = M.inv(m);
    return new Float32Array([i[0], i[4], i[8], i[1], i[5], i[9], i[2], i[6], i[10]]);
  };
  // AE 坐标系：X 右、Y 下、Z 指向画面内。相机看向 +Z
  M.lookAt = (eye, target, roll) => {
    let f = U.norm(U.sub(target, eye));
    if (!isFinite(f[0])) f = [0, 0, 1];
    let down = [0, 1, 0];
    if (Math.abs(U.dot(f, down)) > 0.999) down = [0, 0, -1];
    let r = U.norm(U.cross(down, f));
    let d = U.cross(f, r);
    if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const r2 = U.add(U.scale(r, c), U.scale(d, s)); d = U.sub(U.scale(d, c), U.scale(r, s)); r = r2; }
    const m = M.ident();
    m[0] = r[0]; m[4] = r[1]; m[8] = r[2]; m[12] = -U.dot(r, eye);
    m[1] = d[0]; m[5] = d[1]; m[9] = d[2]; m[13] = -U.dot(d, eye);
    m[2] = f[0]; m[6] = f[1]; m[10] = f[2]; m[14] = -U.dot(f, eye);
    return m;
  };
  // 透视：相机空间 (x 右, y 下, z 前) → 裁剪空间
  M.persp = (fovY, aspect, n, f) => {
    const t = 1 / Math.tan(fovY / 2), m = new Float64Array(16);
    m[0] = t / aspect; m[5] = -t; m[10] = (f + n) / (f - n); m[11] = 1; m[14] = -2 * f * n / (f - n);
    return m;
  };
  // 正交：相机空间 → 裁剪空间（同样 y 向下）
  M.orthoCam = (hw, hh, n, f) => {
    const m = M.ident();
    m[0] = 1 / hw; m[5] = -1 / hh; m[10] = 2 / (f - n); m[14] = -(f + n) / (f - n);
    return m;
  };
  // 合成像素 → NDC（2D 视图矩形）
  M.ortho2D = (x0, y0, x1, y1) => {
    const m = M.ident();
    m[0] = 2 / (x1 - x0); m[5] = -2 / (y1 - y0); m[10] = -1 / 100000;
    m[12] = -(x1 + x0) / (x1 - x0); m[13] = (y1 + y0) / (y1 - y0);
    return m;
  };
  // 按 XYZ 欧拉分解（局部矩阵 R = Rx·Ry·Rz）
  M.decompose = (m) => {
    const c0 = [m[0], m[1], m[2]], c1 = [m[4], m[5], m[6]], c2 = [m[8], m[9], m[10]];
    let sx = U.len(c0), sy = U.len(c1), sz = U.len(c2);
    const det = U.dot(c0, U.cross(c1, c2));
    if (det < 0) sx = -sx;
    const r00 = c0[0] / sx, r10 = c0[1] / sx, r20 = c0[2] / sx;
    const r01 = c1[0] / sy, r11 = c1[1] / sy, r21 = c1[2] / sy;
    const r02 = c2[0] / sz, r12 = c2[1] / sz, r22 = c2[2] / sz;
    // R = Rx Ry Rz → r02 = sin(ry)
    const ry = Math.asin(U.clamp(r02, -1, 1));
    let rx, rz;
    if (Math.abs(r02) < 0.9999) { rx = Math.atan2(-r12, r22); rz = Math.atan2(-r01, r00); }
    else { rx = Math.atan2(r21, r11); rz = 0; }
    return { pos: [m[12], m[13], m[14]], scale: [sx, sy, sz], rot: [rx / U.deg, ry / U.deg, rz / U.deg] };
  };

  // ---------- 随机与噪声（可复现） ----------
  U.hash = function () { // 任意整数/字符串参数 → [0,1)
    let h = 2166136261 >>> 0;
    for (let i = 0; i < arguments.length; i++) {
      let a = arguments[i];
      if (typeof a === 'string') { for (let j = 0; j < a.length; j++) { h ^= a.charCodeAt(j); h = Math.imul(h, 16777619); } }
      else { a = (a * 1000003) | 0; h ^= a; h = Math.imul(h, 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); }
    }
    h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  U.rng = seed => { // mulberry32
    let a = (seed * 2654435761) >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };
  U.strSeed = s => Math.floor(U.hash(String(s)) * 1e9);
  const grad1 = (i, s) => U.hash(i, s) * 2 - 1;
  U.noise1 = (x, s = 0) => { // 1D 梯度噪声 [-1,1]
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return U.lerp(grad1(i, s) * f, grad1(i + 1, s) * (f - 1), u) * 2;
  };
  // 3D 梯度噪声
  const P = new Uint8Array(512);
  (() => { const r = U.rng(1337), p = []; for (let i = 0; i < 256; i++) p[i] = i; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; })();
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const g3 = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  U.noise3 = (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    return U.lerp(U.lerp(U.lerp(g3(P[AA], x, y, z), g3(P[BA], x - 1, y, z), u), U.lerp(g3(P[AB], x, y - 1, z), g3(P[BB], x - 1, y - 1, z), u), v),
      U.lerp(U.lerp(g3(P[AA + 1], x, y, z - 1), g3(P[BA + 1], x - 1, y, z - 1), u), U.lerp(g3(P[AB + 1], x, y - 1, z - 1), g3(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  };
  U.fbm3 = (x, y, z, oct = 3) => { let s = 0, a = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * U.noise3(x, y, z); n += a; a *= 0.5; x *= 2.03; y *= 2.03; z *= 2.03; } return s / n; };
  // 旋度噪声（无散度，适合粒子）
  U.curl3 = (x, y, z, t) => {
    const e = 0.08;
    const n1 = (a, b, c) => U.noise3(a, b, c + t), n2 = (a, b, c) => U.noise3(a + 31.4, b + t, c + 7.7), n3 = (a, b, c) => U.noise3(a + t, b + 17.1, c + 53.2);
    const dy3 = (n3(x, y + e, z) - n3(x, y - e, z)), dz2 = (n2(x, y, z + e) - n2(x, y, z - e));
    const dz1 = (n1(x, y, z + e) - n1(x, y, z - e)), dx3 = (n3(x + e, y, z) - n3(x - e, y, z));
    const dx2 = (n2(x + e, y, z) - n2(x - e, y, z)), dy1 = (n1(x, y + e, z) - n1(x, y - e, z));
    const k = 1 / (2 * e);
    return [(dy3 - dz2) * k, (dz1 - dx3) * k, (dx2 - dy1) * k];
  };

  // ---------- 颜色 ----------
  U.hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1]; };
  U.toHex = c => '#' + [0, 1, 2].map(i => Math.round(U.clamp(c[i], 0, 1) * 255).toString(16).padStart(2, '0')).join('');
  U.rgb2hsl = c => {
    const r = c[0], g = c[1], b = c[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6;
    }
    return [h, s, l, c[3] === undefined ? 1 : c[3]];
  };
  U.hsl2rgb = c => {
    const h = c[0], s = c[1], l = c[2];
    if (s === 0) return [l, l, l, c[3] === undefined ? 1 : c[3]];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t % 1 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3), c[3] === undefined ? 1 : c[3]];
  };
  // 生命周期曲线 [[t,v],...]（线性）
  U.curve = (pts, t) => {
    if (!pts || !pts.length) return 1;
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return U.lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0] || 1)); }
    return pts[pts.length - 1][1];
  };
  U.gradient = (stops, t) => { // [[t,[r,g,b,a]],...]
    if (!stops || !stops.length) return [1, 1, 1, 1];
    if (t <= stops[0][0]) return stops[0][1].slice();
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const a = stops[i - 1], b = stops[i]; return U.lerpV(a[1], b[1], (t - a[0]) / (b[0] - a[0] || 1)); }
    return stops[stops.length - 1][1].slice();
  };
  U.timecode = (t, fps) => {
    const f = Math.round(t * fps), s = Math.floor(f / fps), fr = f - s * fps;
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
