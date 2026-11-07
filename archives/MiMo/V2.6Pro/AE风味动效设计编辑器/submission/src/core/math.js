// 基础数学：向量、缓动、插值、噪声
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const deg2rad = (d) => (d * Math.PI) / 180;
export const rad2deg = (r) => (r * 180) / Math.PI;

export function lerpArr(a, b, t) {
  const n = Math.min(a.length, b.length);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

// ---- 缓动 ----
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
export function easeInCubic(t) {
  return t * t * t;
}
export function easeOutBack(t, s = 1.70158) {
  const c3 = s + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
}
export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
export function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

// 贝塞尔缓动：influence 0-100，生成 cubic-bezier 缓动函数近似
export function bezierEase(influenceIn = 33, influenceOut = 33) {
  // 使用 hermite 形式：两端导数由 influence 决定
  const m0 = (influenceIn / 100) * 3; // 进入斜率
  const m1 = (influenceOut / 100) * 3; // 离开斜率（取反方向）
  return function (t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * 0 + h10 * m0 + h01 * 1 + h11 * m1;
  };
}

// AE 风格 ease：ease(t, tMin, tMax, v1, v2) 平滑插值
export function easeFn(t, tMin, tMax, v1, v2) {
  if (tMax === tMin) return t < tMin ? v1 : v2;
  const u = clamp((t - tMin) / (tMax - tMin), 0, 1);
  const s = u * u * (3 - 2 * u);
  return v1 + (v2 - v1) * s;
}

export function linearFn(t, tMin, tMax, v1, v2) {
  if (tMax === tMin) return t < tMin ? v1 : v2;
  const u = clamp((t - tMin) / (tMax - tMin), 0, 1);
  return v1 + (v2 - v1) * u;
}

// ---- 可复现随机（基于种子） ----
export function hashSeed(...args) {
  let h = 2166136261 >>> 0;
  for (const a of args) {
    let x = typeof a === 'number' ? Math.floor(a * 1000) : String(a).length;
    h ^= x & 0xffffffff;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 稳定伪随机：由 (seed, id, channel) 决定
export function stableRandom(seed, id, channel = 0) {
  const h = hashSeed(seed, id, channel);
  const r = mulberry32(h);
  r();
  return r();
}

// 确定性噪声（三维值噪声，足够平滑）
function vnoise(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const g = (i, j, k) => {
    let n = Math.imul(i + seed * 374761393, 668265263) ^ Math.imul(j + 1274126177, 2246822519) ^ Math.imul(k, 3266489917);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(g(xi, yi, zi), g(xi + 1, yi, zi), u), l(g(xi, yi + 1, zi), g(xi + 1, yi + 1, zi), u), v),
    l(l(g(xi, yi, zi + 1), g(xi + 1, yi, zi + 1), u), l(g(xi, yi + 1, zi + 1), g(xi + 1, yi + 1, zi + 1), u), v),
    w
  );
}

export function noise3(x, y, z, seed = 0) {
  return vnoise(x, y, z, seed) * 2 - 1;
}

// 可复现 wiggle：由 seed、时间、通道决定
export function wiggleVec(seed, freq, amp, t, dims = 3, id = 0) {
  const out = [];
  for (let d = 0; d < dims; d++) {
    out.push(noise3(t * freq, id * 13.7 + d * 71.3, d * 3.1, seed) * amp);
  }
  return out;
}

// ---- 颜色 ----
export function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const n = parseInt(hex, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(r, g, b) {
  const c = (x) => Math.round(clamp(x, 0, 1) * 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

export function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [r + m, g + m, b + m];
}

// 线性 -> sRGB 显示（近似）
export function toSRGB(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
}

// ---- 矩阵（列主序 4x4，与 WebGL 一致） ----
export class Mat4 {
  constructor(el) {
    this.e = el || new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  static identity() { return new Mat4(); }
  static translation(x, y, z) {
    return new Mat4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }
  static scaling(x, y, z) {
    return new Mat4([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
  }
  static rotationX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Mat4([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  }
  static rotationY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Mat4([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  }
  static rotationZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Mat4([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  multiply(m) {
    const a = this.e, b = m.e, o = new Float64Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return new Mat4(o);
  }
  transformPoint(p) {
    const e = this.e;
    return [
      e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12],
      e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13],
      e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14],
    ];
  }
  transformDir(p) {
    const e = this.e;
    return [
      e[0] * p[0] + e[4] * p[1] + e[8] * p[2],
      e[1] * p[0] + e[5] * p[1] + e[9] * p[2],
      e[2] * p[0] + e[6] * p[1] + e[10] * p[2],
    ];
  }
  clone() { return new Mat4(new Float64Array(this.e)); }
}

// 3D 旋转欧拉（度）-> 矩阵，顺序 ZYX（AE 风格 XYZ 旋转）
export function eulerToMat(rx, ry, rz) {
  return Mat4.rotationX(deg2rad(rx)).multiply(Mat4.rotationY(deg2rad(ry))).multiply(Mat4.rotationZ(deg2rad(rz)));
}

// 构建图层局部矩阵：T(pos) * R(rot) * S(scale) * T(-anchor)（scale 为百分比）
export function localMatrix(anchor, position, scale, rotationDeg) {
  const [rx, ry, rz] = rotationDeg.length === 3 ? rotationDeg : [0, 0, rotationDeg[0]];
  let m = Mat4.translation(position[0], position[1], position[2] || 0);
  m = m.multiply(eulerToMat(rx, ry, rz));
  const sx = (scale[0] ?? 100) / 100;
  const sy = (scale[1] ?? 100) / 100;
  const sz = (scale[2] != null ? scale[2] : (scale[0] ?? 100)) / 100;
  m = m.multiply(Mat4.scaling(sx, sy, sz));
  m = m.multiply(Mat4.translation(-anchor[0], -anchor[1], -anchor[2] || 0));
  return m;
}

export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
