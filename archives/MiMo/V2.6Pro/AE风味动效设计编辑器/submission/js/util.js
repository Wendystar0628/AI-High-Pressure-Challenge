/* util.js — 数学、噪声、颜色、几何工具 */
(function(global) {
'use strict';

const U = {};

// ---------- 基础 ----------
U.clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
U.lerp = (a, b, t) => a + (b - a) * t;
U.smoothstep = (t) => t * t * (3 - 2 * t);
U.deg2rad = d => d * Math.PI / 180;
U.rad2deg = r => r * 180 / Math.PI;
U.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
U.dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z || 0) - (b.z || 0); return dx * dx + dy * dy + dz * dz; };

U.uid = (prefix) => (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

U.deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(U.deepClone);
  const r = {};
  for (const k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) r[k] = U.deepClone(obj[k]);
  return r;
};

U.deepEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!U.deepEqual(a[k], b[k])) return false;
  return true;
};

// ---------- 向量 ----------
U.v2 = (x = 0, y = 0) => ({ x, y });
U.v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
U.vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: (a.z || 0) + (b.z || 0) });
U.vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) });
U.vscale = (a, s) => ({ x: a.x * s, y: a.y * s, z: (a.z || 0) * s });
U.vlen = (a) => Math.hypot(a.x, a.y, a.z || 0);
U.vnorm = (a) => { const l = U.vlen(a) || 1; return { x: a.x / l, y: a.y / l, z: (a.z || 0) / l }; };
U.vdot = (a, b) => a.x * b.x + a.y * b.y + (a.z || 0) * (b.z || 0);
U.vcross = (a, b) => ({
  x: a.y * (b.z || 0) - (a.z || 0) * b.y,
  y: (a.z || 0) * b.x - a.x * (b.z || 0),
  z: a.x * b.y - a.y * b.x
});
U.vlerp = (a, b, t) => ({ x: U.lerp(a.x, b.x, t), y: U.lerp(a.y, b.y, t), z: U.lerp(a.z || 0, b.z || 0, t) });

// ---------- 4x4 矩阵（列主序，与 WebGL 一致） ----------
U.mat4 = {
  identity() {
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  },
  multiply(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  translation(x, y, z) {
    const m = U.mat4.identity(); m[12] = x; m[13] = y; m[14] = z; return m;
  },
  scaling(x, y, z) {
    const m = U.mat4.identity(); m[0] = x; m[5] = y; m[10] = z; return m;
  },
  rotationX(a) {
    const c = Math.cos(a), s = Math.sin(a), m = U.mat4.identity();
    m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m;
  },
  rotationY(a) {
    const c = Math.cos(a), s = Math.sin(a), m = U.mat4.identity();
    m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m;
  },
  rotationZ(a) {
    const c = Math.cos(a), s = Math.sin(a), m = U.mat4.identity();
    m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m;
  },
  compose(pos, rotXYZ, scale, anchor) {
    // 位置 - 锚点偏移 → 旋转 → 缩放
    let m = U.mat4.translation(pos.x, pos.y, pos.z || 0);
    m = U.mat4.multiply(m, U.mat4.rotationZ(U.deg2rad(rotXYZ.z || 0)));
    m = U.mat4.multiply(m, U.mat4.rotationY(U.deg2rad(rotXYZ.y || 0)));
    m = U.mat4.multiply(m, U.mat4.rotationX(U.deg2rad(rotXYZ.x || 0)));
    m = U.mat4.multiply(m, U.mat4.scaling(scale.x / 100, scale.y / 100, (scale.z != null ? scale.z : 100) / 100));
    if (anchor) m = U.mat4.multiply(m, U.mat4.translation(-anchor.x, -anchor.y, -anchor.z || 0));
    return m;
  },
  perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2), m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f;
    m[10] = (far + near) / (near - far); m[11] = -1;
    m[14] = (2 * far * near) / (near - far);
    return m;
  },
  ortho(l, r, b, t, n, f) {
    const m = U.mat4.identity();
    m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
    m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n);
    return m;
  },
  lookAt(eye, target, up) {
    const z = U.vnorm(U.vsub(eye, target));
    const x = U.vnorm(U.vcross(up, z));
    const y = U.vcross(z, x);
    const m = new Float32Array(16);
    m[0] = x.x; m[1] = y.x; m[2] = z.x; m[3] = 0;
    m[4] = x.y; m[5] = y.y; m[6] = z.y; m[7] = 0;
    m[8] = x.z; m[9] = y.z; m[10] = z.z; m[11] = 0;
    m[12] = -U.vdot(x, eye); m[13] = -U.vdot(y, eye); m[14] = -U.vdot(z, eye); m[15] = 1;
    return m;
  },
  invert(m) {
    const inv = new Float32Array(16);
    inv[0] = m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15] + m[9]*m[7]*m[14] + m[13]*m[6]*m[11] - m[13]*m[7]*m[10];
    inv[4] = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15] - m[8]*m[7]*m[14] - m[12]*m[6]*m[11] + m[12]*m[7]*m[10];
    inv[8] = m[4]*m[9]*m[15] - m[4]*m[11]*m[13] - m[8]*m[5]*m[15] + m[8]*m[7]*m[13] + m[12]*m[5]*m[11] - m[12]*m[7]*m[9];
    inv[12] = -m[4]*m[9]*m[14] + m[4]*m[10]*m[13] + m[8]*m[5]*m[14] - m[8]*m[6]*m[13] - m[12]*m[5]*m[10] + m[12]*m[6]*m[9];
    inv[1] = -m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15] - m[9]*m[3]*m[14] - m[13]*m[2]*m[11] + m[13]*m[3]*m[10];
    inv[5] = m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15] + m[8]*m[3]*m[14] + m[12]*m[2]*m[11] - m[12]*m[3]*m[10];
    inv[9] = -m[0]*m[9]*m[15] + m[0]*m[11]*m[13] + m[8]*m[1]*m[15] - m[8]*m[3]*m[13] - m[12]*m[1]*m[11] + m[12]*m[3]*m[9];
    inv[13] = m[0]*m[9]*m[14] - m[0]*m[10]*m[13] - m[8]*m[1]*m[14] + m[8]*m[2]*m[13] + m[12]*m[1]*m[10] - m[12]*m[2]*m[9];
    inv[2] = m[1]*m[6]*m[15] - m[1]*m[7]*m[14] - m[5]*m[2]*m[15] + m[5]*m[3]*m[14] + m[13]*m[2]*m[7] - m[13]*m[3]*m[6];
    inv[6] = -m[0]*m[6]*m[15] + m[0]*m[7]*m[14] + m[4]*m[2]*m[15] - m[4]*m[3]*m[14] - m[12]*m[2]*m[7] + m[12]*m[3]*m[6];
    inv[10] = m[0]*m[5]*m[15] - m[0]*m[7]*m[13] - m[4]*m[1]*m[15] + m[4]*m[3]*m[13] + m[12]*m[1]*m[7] - m[12]*m[3]*m[5];
    inv[14] = -m[0]*m[5]*m[14] + m[0]*m[6]*m[13] + m[4]*m[1]*m[14] - m[4]*m[2]*m[13] - m[12]*m[1]*m[6] + m[12]*m[2]*m[5];
    inv[3] = -m[1]*m[6]*m[11] + m[1]*m[7]*m[10] + m[5]*m[2]*m[11] - m[5]*m[3]*m[10] - m[9]*m[2]*m[7] + m[9]*m[3]*m[6];
    inv[7] = m[0]*m[6]*m[11] - m[0]*m[7]*m[10] - m[4]*m[2]*m[11] + m[4]*m[3]*m[10] + m[8]*m[2]*m[7] - m[8]*m[3]*m[6];
    inv[11] = -m[0]*m[5]*m[11] + m[0]*m[7]*m[9] + m[4]*m[1]*m[11] - m[4]*m[3]*m[9] - m[8]*m[1]*m[7] + m[8]*m[3]*m[5];
    inv[15] = m[0]*m[5]*m[10] - m[0]*m[6]*m[9] - m[4]*m[1]*m[10] + m[4]*m[2]*m[9] + m[8]*m[1]*m[6] - m[8]*m[2]*m[5];
    let det = m[0]*inv[0] + m[1]*inv[4] + m[2]*inv[8] + m[3]*inv[12];
    if (!det) return U.mat4.identity();
    det = 1 / det;
    for (let i = 0; i < 16; i++) inv[i] *= det;
    return inv;
  },
  transformPoint(m, p) {
    const x = p.x, y = p.y, z = p.z || 0;
    return {
      x: m[0] * x + m[4] * y + m[8] * z + m[12],
      y: m[1] * x + m[5] * y + m[9] * z + m[13],
      z: m[2] * x + m[6] * y + m[10] * z + m[14],
      w: m[3] * x + m[7] * y + m[11] * z + m[15]
    };
  },
  transformDir(m, p) {
    const x = p.x, y = p.y, z = p.z || 0;
    return {
      x: m[0] * x + m[4] * y + m[8] * z,
      y: m[1] * x + m[5] * y + m[9] * z,
      z: m[2] * x + m[6] * y + m[10] * z
    };
  }
};

// ---------- 可复现噪声（种子化） ----------
U.hash2 = (x, y, seed) => {
  let h = (x * 374761393 + y * 668265263 + (seed | 0) * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
U.valueNoise2 = (x, y, seed) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = U.hash2(xi, yi, seed), b = U.hash2(xi + 1, yi, seed);
  const c = U.hash2(xi, yi + 1, seed), d = U.hash2(xi + 1, yi + 1, seed);
  return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v) * 2 - 1;
};
U.valueNoise3 = (x, y, z, seed) => {
  // 2D 切片插值
  const z0 = Math.floor(z), z1 = z0 + 1, fz = z - z0;
  const s = fz * fz * (3 - 2 * fz);
  return U.lerp(
    U.valueNoise2(x + z0 * 17.7, y - z0 * 9.3, seed + z0),
    U.valueNoise2(x + z1 * 17.7, y - z1 * 9.3, seed + z1), s);
};
U.fbm3 = (x, y, z, seed, oct = 3) => {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    v += a * U.valueNoise3(x * f, y * f, z * f, seed + i * 31);
    a *= 0.5; f *= 2;
  }
  return v;
};

// 种子随机数（mulberry32）
U.rng = (seed) => {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ---------- 颜色 ----------
U.parseColor = (c) => {
  if (Array.isArray(c)) {
    return { r: c[0], g: c[1], b: c[2], a: c[3] != null ? c[3] : 1 };
  }
  if (typeof c === 'object' && c) return c;
  if (typeof c === 'number') {
    return { r: ((c >> 16) & 255) / 255, g: ((c >> 8) & 255) / 255, b: (c & 255) / 255, a: 1 };
  }
  if (typeof c === 'string') {
    if (c[0] === '#') {
      let h = c.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      const n = parseInt(h.slice(0, 6), 16);
      return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
    }
    const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (m) return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a: m[4] != null ? +m[4] : 1 };
  }
  return { r: 1, g: 1, b: 1, a: 1 };
};
U.colorToCss = (c) => {
  const p = U.parseColor(c);
  return `rgba(${Math.round(p.r * 255)},${Math.round(p.g * 255)},${Math.round(p.b * 255)},${p.a != null ? p.a : 1})`;
};
U.colorToHex = (c) => {
  const p = U.parseColor(c);
  const h = v => Math.round(U.clamp(v, 0, 1) * 255).toString(16).padStart(2, '0');
  return '#' + h(p.r) + h(p.g) + h(p.b);
};
U.colorLerp = (a, b, t) => {
  const A = U.parseColor(a), B = U.parseColor(b);
  return { r: U.lerp(A.r, B.r, t), g: U.lerp(A.g, B.g, t), b: U.lerp(A.b, B.b, t), a: U.lerp(A.a != null ? A.a : 1, B.a != null ? B.a : 1, t) };
};
U.rgbToHsl = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h, s, l };
};
U.hslToRgb = (h, s, l) => {
  if (s === 0) return { r: l, g: l, b: l };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: f(h + 1 / 3), g: f(h), b: f(h - 1 / 3) };
};

// ---------- 贝塞尔 ----------
U.bezier1D = (p0, p1, p2, p3, t) => {
  const it = 1 - t;
  return it * it * it * p0 + 3 * it * it * t * p1 + 3 * it * t * t * p2 + t * t * t * p3;
};
U.bezierPoint = (p0, p1, p2, p3, t) => ({
  x: U.bezier1D(p0.x, p1.x, p2.x, p3.x, t),
  y: U.bezier1D(p0.y, p1.y, p2.y, p3.y, t),
  z: U.bezier1D(p0.z || 0, p1.z || 0, p2.z || 0, p3.z || 0, t)
});
// 求 t 使 x 分量接近目标（牛顿迭代）
U.bezierSolveT = (p0, p1, p2, p3, x) => {
  let t = 0.5;
  for (let i = 0; i < 12; i++) {
    const v = U.bezier1D(p0, p1, p2, p3, t);
    const dv = 3 * (1 - t) * (1 - t) * (p1 - p0) + 6 * (1 - t) * t * (p2 - p1) + 3 * t * t * (p3 - p2);
    if (Math.abs(dv) < 1e-6) break;
    t = U.clamp(t - (v - x) / dv, 0, 1);
    if (Math.abs(v - x) < 1e-6) break;
  }
  return t;
};

// 平面贝塞尔轮廓：[{x,y, in:{x,y}, out:{x,y}, smooth}] 首尾相连
U.flattenContour = (pts, steps = 16) => {
  const out = [];
  const n = pts.length;
  if (n < 2) return pts.map(p => ({ x: p.x, y: p.y }));
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const p0 = { x: a.x, y: a.y };
    const p1 = a.out ? { x: a.x + a.out.x, y: a.y + a.out.y } : p0;
    const p2 = b.in ? { x: b.x + b.in.x, y: b.y + b.in.y } : { x: b.x, y: b.y };
    const p3 = { x: b.x, y: b.y };
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push(U.bezierPoint(p0, p1, p2, p3, t));
    }
  }
  out.push({ x: pts[n - 1].x, y: pts[n - 1].y });
  return out;
};

// 折线总长度 / 按弧长取点
U.polylineLength = (pts) => {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return L;
};
U.pointAtLength = (pts, s) => {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + d >= s || i === pts.length - 1) {
      const t = d < 1e-9 ? 0 : (s - acc) / d;
      return {
        x: U.lerp(pts[i - 1].x, pts[i].x, t),
        y: U.lerp(pts[i - 1].y, pts[i].y, t),
        angle: Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x)
      };
    }
    acc += d;
  }
  return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, angle: 0 };
};

// Ramer–Douglas–Peucker 简化
U.simplify = (pts, eps = 0.6) => {
  if (pts.length < 3) return pts.slice();
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = U.pointLineDist(pts[i], pts[s], pts[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
};
U.pointLineDist = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / L;
};

// 多边形面积（有符号）
U.polyArea = (pts) => {
  let A = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const j = (i + 1) % n;
    A += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return A / 2;
};
U.pointInPoly = (pt, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-12) + xi)) inside = !inside;
  }
  return inside;
};

// ---------- 时间格式化 ----------
U.formatTime = (t, fps) => {
  fps = fps || 30;
  const frames = Math.round(t * fps);
  const s = Math.floor(frames / fps);
  const f = frames % fps;
  const mm = Math.floor(s / 60), ss = s % 60;
  return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + ':' + String(f).padStart(2, '0');
};

// ---------- 事件 ----------
U.emitter = () => {
  const map = {};
  return {
    on(ev, fn) { (map[ev] = map[ev] || []).push(fn); return () => this.off(ev, fn); },
    off(ev, fn) { if (map[ev]) map[ev] = map[ev].filter(f => f !== fn); },
    emit(ev, ...args) { (map[ev] || []).slice().forEach(f => f(...args)); }
  };
};

global.U = U;
})(window);
