'use strict';
// ============ 通用工具：数学、矩阵、噪声、颜色、DOM ============
const U = {
  clamp: (x, a, b) => x < a ? a : x > b ? b : x,
  lerp: (a, b, t) => a + (b - a) * t,
  smooth: (a, b, x) => { const t = U.clamp((x - a) / (b - a || 1e-9), 0, 1); return t * t * (3 - 2 * t); },
  isArr: Array.isArray,
  clone: o => o === undefined ? undefined : JSON.parse(JSON.stringify(o)),
  deg: r => r * 180 / Math.PI,
  rad: d => d * Math.PI / 180,
  fmt(n, d = 1) { if (typeof n !== 'number' || !isFinite(n)) return String(n); const p = Math.pow(10, d); return String(Math.round(n * p) / p); },
  fmtTime(t, fps) { const f = Math.round(t * fps); const s = Math.floor(f / fps); const ff = f - s * fps; const m = Math.floor(s / 60); return `${String(m).padStart(1, '0')}:${String(s % 60).padStart(2, '0')}:${String(ff).padStart(2, '0')}`; },
  // 字符串哈希
  hash(str) { let h = 2166136261 >>> 0; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
  hashN(...a) { let h = 0x9e3779b9; for (const x of a) { h ^= (x | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2); h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16; } return h >>> 0; },
  // 由整数键得到 [0,1) 的可复现随机数
  rand01(...a) { return U.hashN(...a) / 4294967296; },
  rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
  vecAdd(a, b) { if (!U.isArr(a)) return a + (U.isArr(b) ? b[0] : b); return a.map((x, i) => x + (U.isArr(b) ? (b[i] || 0) : b)); },
  vecSub(a, b) { if (!U.isArr(a)) return a - (U.isArr(b) ? b[0] : b); return a.map((x, i) => x - (U.isArr(b) ? (b[i] || 0) : b)); },
  vecMul(a, s) { return U.isArr(a) ? a.map(x => x * s) : a * s; },
  vecLerp(a, b, t) { if (!U.isArr(a)) return a + (b - a) * t; return a.map((x, i) => x + ((b[i] ?? x) - x) * t); },
  vecLen(a) { if (!U.isArr(a)) return Math.abs(a); let s = 0; for (const x of a) s += x * x; return Math.sqrt(s); },
  vecDist(a, b) { return U.vecLen(U.vecSub(a, b)); },
  el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (k === 'class') e.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (k === 'text') e.textContent = v;
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(c) : c);
    return e;
  },
  hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; },
  rgb2hex(c) { return '#' + c.slice(0, 3).map(x => Math.round(U.clamp(x, 0, 1) * 255).toString(16).padStart(2, '0')).join(''); },
  rgb2hsl([r, g, b]) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; },
  hsl2rgb([h, s, l]) { if (s === 0) return [l, l, l]; const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)]; },
  download(name, text, type = 'application/json') { const b = new Blob([text], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); },
};

// ---------- 3 维向量 ----------
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
};

// ---------- 4x4 矩阵（列主序，Float64Array） ----------
const M4 = {
  ident() { const m = new Float64Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  copy(a) { return new Float64Array(a); },
  mul(a, b) { // a*b
    const o = new Float64Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  translate(x, y, z = 0) { const m = M4.ident(); m[12] = x; m[13] = y; m[14] = z; return m; },
  scale(x, y, z = 1) { const m = M4.ident(); m[0] = x; m[5] = y; m[10] = z; return m; },
  rotX(a) { const c = Math.cos(a), s = Math.sin(a), m = M4.ident(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  rotY(a) { const c = Math.cos(a), s = Math.sin(a), m = M4.ident(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rotZ(a) { const c = Math.cos(a), s = Math.sin(a), m = M4.ident(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
  invert(m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7], a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    const o = new Float64Array(16);
    if (!det) return M4.ident();
    det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },
  perspective(fovy, aspect, near, far) { const f = 1 / Math.tan(fovy / 2), m = new Float64Array(16); m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = 2 * far * near / (near - far); return m; },
  ortho(l, r, b, t, n, f) { const m = M4.ident(); m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n); m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); return m; },
  lookAt(eye, target, up) {
    let f = V3.norm(V3.sub(target, eye)); if (!isFinite(f[0])) f = [0, 0, 1];
    let s = V3.cross(f, up); if (V3.len(s) < 1e-6) s = V3.cross(f, [0, 0, 1]); s = V3.norm(s);
    const u = V3.cross(s, f), m = M4.ident();
    m[0] = s[0]; m[4] = s[1]; m[8] = s[2]; m[1] = u[0]; m[5] = u[1]; m[9] = u[2]; m[2] = -f[0]; m[6] = -f[1]; m[10] = -f[2];
    m[12] = -V3.dot(s, eye); m[13] = -V3.dot(u, eye); m[14] = V3.dot(f, eye); return m;
  },
  pt(m, p) { const x = p[0], y = p[1], z = p[2] || 0; const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1; return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w]; },
  pt4(m, p) { const x = p[0], y = p[1], z = p[2] || 0; return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]]; },
  dir(m, d) { return [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]]; },
  normalMat(m) { const i = M4.invert(m); return new Float32Array([i[0], i[4], i[8], i[1], i[5], i[9], i[2], i[6], i[10]]); },
  f32(m) { return new Float32Array(m); },
  // 2D 仿射分解：返回 {tx,ty,rot(度),sx,sy}
  decompose2D(m) { const a = m[0], b = m[1], c = m[4], d = m[5]; const sx = Math.hypot(a, b); const rot = Math.atan2(b, a); const det = a * d - b * c; const sy = det / (sx || 1); return { tx: m[12], ty: m[13], tz: m[14], rot: U.deg(rot), sx, sy }; },
};

// ---------- 柏林噪声（可复现） ----------
const Noise = (() => {
  const perm = new Uint8Array(512); const r = U.rng(1337); const p = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  function n3(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    const l = U.lerp;
    return l(l(l(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u), l(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
      l(l(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u), l(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }
  function fbm(x, y, z, oct = 1, mult = 0.5) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * n3(x * f, y * f, z * f); n += a; a *= mult; f *= 2; } return s / n; }
  return { n3, fbm };
})();

// ---------- 事件总线 ----------
const Bus = {
  map: {},
  on(ev, fn) { (this.map[ev] || (this.map[ev] = [])).push(fn); },
  emit(ev, a) { const l = this.map[ev]; if (l) for (const f of l.slice()) f(a); },
};
