// 核心数学、确定性随机与噪声、AE 变换矩阵及贝塞尔弧长参数化工具

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1e-9), 0, 1);
  return t * t * (3 - 2 * t);
}

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hashInts(a, b = 0, c = 0, d = 0) {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b + 0x85ebca6b), 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (c + 0x27d4eb2f), 0x165667b1) >>> 0;
  h = Math.imul(h ^ d, 0x27d4eb2f) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return h >>> 0;
}

export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randFromHash(a, b = 0, c = 0, d = 0) {
  return hashInts(a, b, c, d) / 4294967296;
}

function quintic(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function grad1(ix, seed) {
  const r = randFromHash(ix, seed, 17, 31) * 2 - 1;
  return r;
}

export function noise1D(x, seed = 1) {
  const ix = Math.floor(x);
  const fx = x - ix;
  const u = quintic(fx);
  const g0 = grad1(ix, seed) * fx;
  const g1 = grad1(ix + 1, seed) * (fx - 1);
  return lerp(g0, g1, u) * 2; // approx [-1, 1]
}

export function fbm1D(x, octaves = 1, ampMult = 0.5, seed = 1) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  const oct = Math.max(1, Math.min(8, Math.round(octaves)));
  for (let i = 0; i < oct; i++) {
    sum += amp * noise1D(x * freq, seed + i * 101);
    norm += amp;
    amp *= ampMult;
    freq *= 2.03;
  }
  return norm > 0 ? sum / norm : 0;
}

function hash3(ix, iy, iz, seed) {
  return randFromHash(ix, iy, iz, seed) * 2 - 1;
}

export function noise3D(x, y, z, seed = 1337) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const u = quintic(fx);
  const v = quintic(fy);
  const w = quintic(fz);

  const c000 = hash3(ix, iy, iz, seed);
  const c100 = hash3(ix + 1, iy, iz, seed);
  const c010 = hash3(ix, iy + 1, iz, seed);
  const c110 = hash3(ix + 1, iy + 1, iz, seed);
  const c001 = hash3(ix, iy, iz + 1, seed);
  const c101 = hash3(ix + 1, iy, iz + 1, seed);
  const c011 = hash3(ix, iy + 1, iz + 1, seed);
  const c111 = hash3(ix + 1, iy + 1, iz + 1, seed);

  const x00 = lerp(c000, c100, u);
  const x10 = lerp(c010, c110, u);
  const x01 = lerp(c001, c101, u);
  const x11 = lerp(c011, c111, u);

  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

export function curlNoise3D(x, y, z, seed = 1337) {
  const e = 0.05;
  const inv2e = 1 / (2 * e);
  const n1y = noise3D(x, y + e, z, seed + 11) - noise3D(x, y - e, z, seed + 11);
  const n1z = noise3D(x, y, z + e, seed + 11) - noise3D(x, y, z - e, seed + 11);
  const n2x = noise3D(x + e, y, z, seed + 37) - noise3D(x - e, y, z, seed + 37);
  const n2z = noise3D(x, y, z + e, seed + 37) - noise3D(x, y, z - e, seed + 37);
  const n3x = noise3D(x + e, y, z, seed + 73) - noise3D(x - e, y, z, seed + 73);
  const n3y = noise3D(x, y + e, z, seed + 73) - noise3D(x, y - e, z, seed + 73);
  return [
    (n3y - n2z) * inv2e,
    (n1z - n3x) * inv2e,
    (n2x - n1y) * inv2e,
  ];
}

// 4x4 列主序矩阵工具（与 Three.js Matrix4 兼容）
export function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function mat4Multiply(a, b) {
  const out = new Array(16);
  for (let col = 0; col < 4; col++) {
    const b0 = b[col * 4];
    const b1 = b[col * 4 + 1];
    const b2 = b[col * 4 + 2];
    const b3 = b[col * 4 + 3];
    out[col * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

export function mat4Invert(m) {
  const inv = new Array(16);
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
  if (Math.abs(det) < 1e-12) return mat4Identity();
  const invDet = 1.0 / det;
  for (let i = 0; i < 16; i++) inv[i] *= invDet;
  return inv;
}

export function mat4TransformPoint(m, p) {
  const x = p[0], y = p[1], z = p[2] || 0;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

export function mat4TransformVector(m, v) {
  const x = v[0], y = v[1], z = v[2] || 0;
  return [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ];
}

export function mat4Translation(x, y, z = 0) {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

export function mat4Scale(sx, sy, sz = 1) {
  return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
}

export function mat4RotationZ(deg) {
  const r = deg * DEG2RAD;
  const c = Math.cos(r), s = Math.sin(r);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function mat4RotationY(deg) {
  const r = deg * DEG2RAD;
  const c = Math.cos(r), s = Math.sin(r);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

export function mat4RotationX(deg) {
  const r = deg * DEG2RAD;
  const c = Math.cos(r), s = Math.sin(r);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}

// AE 本地变换矩阵：M = T(pos) * Rz(rz) * Ry(ry) * Rx(rx) * S(scale/100) * T(-anchor)
export function composeAETransform({
  position = [0, 0, 0],
  anchorPoint = [0, 0, 0],
  scale = [100, 100, 100],
  rotation = 0,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
  is3D = false,
}) {
  const rz = is3D ? (rotationZ || 0) : (rotation || 0);
  const rx = is3D ? (rotationX || 0) : 0;
  const ry = is3D ? (rotationY || 0) : 0;
  const sx = (scale[0] ?? 100) / 100;
  const sy = (scale[1] ?? 100) / 100;
  const sz = is3D ? ((scale[2] ?? 100) / 100) : 1;

  let m = mat4Translation(position[0] || 0, position[1] || 0, is3D ? (position[2] || 0) : 0);
  if (rz) m = mat4Multiply(m, mat4RotationZ(rz));
  if (ry) m = mat4Multiply(m, mat4RotationY(ry));
  if (rx) m = mat4Multiply(m, mat4RotationX(rx));
  m = mat4Multiply(m, mat4Scale(sx, sy, sz));
  const ax = anchorPoint[0] || 0;
  const ay = anchorPoint[1] || 0;
  const az = is3D ? (anchorPoint[2] || 0) : 0;
  if (ax || ay || az) {
    m = mat4Multiply(m, mat4Translation(-ax, -ay, -az));
  }
  return m;
}

// 仅旋转+缩放的线性部分：R * S（用于锚点补偿与增量映射）
export function composeAERotScale({
  scale = [100, 100, 100],
  rotation = 0,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
  is3D = false,
}) {
  const rz = is3D ? (rotationZ || 0) : (rotation || 0);
  const rx = is3D ? (rotationX || 0) : 0;
  const ry = is3D ? (rotationY || 0) : 0;
  const sx = (scale[0] ?? 100) / 100;
  const sy = (scale[1] ?? 100) / 100;
  const sz = is3D ? ((scale[2] ?? 100) / 100) : 1;

  let m = mat4Identity();
  if (rz) m = mat4Multiply(m, mat4RotationZ(rz));
  if (ry) m = mat4Multiply(m, mat4RotationY(ry));
  if (rx) m = mat4Multiply(m, mat4RotationX(rx));
  m = mat4Multiply(m, mat4Scale(sx, sy, sz));
  return m;
}

// 给定完整 AE 矩阵与已知锚点，反解 position / scale / rotationXYZ（父子层级变更时保持画面不变）
export function decomposeAETransform(m, anchorPoint = [0, 0, 0]) {
  // M = T(pos) * Rz * Ry * Rx * S * T(-anchor) => M * T(anchor) = T(pos) * Rz * Ry * Rx * S
  const ma = mat4Multiply(m, mat4Translation(anchorPoint[0] || 0, anchorPoint[1] || 0, anchorPoint[2] || 0));
  const pos = [ma[12], ma[13], ma[14]];

  // 列向量长度即缩放（带符号处理镜像）
  let c0x = ma[0], c0y = ma[1], c0z = ma[2];
  let c1x = ma[4], c1y = ma[5], c1z = ma[6];
  let c2x = ma[8], c2y = ma[9], c2z = ma[10];

  let sx = Math.hypot(c0x, c0y, c0z) || 1e-6;
  let sy = Math.hypot(c1x, c1y, c1z) || 1e-6;
  let sz = Math.hypot(c2x, c2y, c2z) || 1e-6;

  // 检查行列式符号
  const det =
    c0x * (c1y * c2z - c1z * c2y) -
    c1x * (c0y * c2z - c0z * c2y) +
    c2x * (c0y * c1z - c0z * c1y);
  if (det < 0) sx = -sx;

  const r00 = c0x / sx, r10 = c0y / sx, r20 = c0z / sx;
  const r01 = c1x / sy, r11 = c1y / sy, r21 = c1z / sy;
  const r02 = c2x / sz, r12 = c2y / sz, r22 = c2z / sz;

  // 反解 Rz(rz) * Ry(ry) * Rx(rx)（与 ZYX 内旋顺序一致：M_R = Rz * Ry * Rx）
  // M_R[2][0] = r20 = -sin(ry)
  const sinY = clamp(-r20, -1, 1);
  const ry = Math.asin(sinY);
  let rx, rz;
  if (Math.abs(Math.cos(ry)) > 1e-5) {
    rx = Math.atan2(r21, r22);
    rz = Math.atan2(r10, r00);
  } else {
    rx = Math.atan2(-r12, r11);
    rz = 0;
  }

  return {
    position: pos,
    scale: [sx * 100, sy * 100, sz * 100],
    rotationX: rx * RAD2DEG,
    rotationY: ry * RAD2DEG,
    rotationZ: rz * RAD2DEG,
    rotation: rz * RAD2DEG,
  };
}

// 贝塞尔弧长查找表（支持 2D 与 3D 三次贝塞尔曲线）
export function evalCubicBezier(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;
  const dim = p0.length;
  const out = new Array(dim);
  for (let i = 0; i < dim; i++) {
    out[i] = a * p0[i] + b * p1[i] + c * p2[i] + d * p3[i];
  }
  return out;
}

export function evalCubicBezierTangent(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const a = 3 * mt * mt;
  const b = 6 * mt * t;
  const c = 3 * t * t;
  const dim = p0.length;
  const out = new Array(dim);
  for (let i = 0; i < dim; i++) {
    out[i] = a * (p1[i] - p0[i]) + b * (p2[i] - p1[i]) + c * (p3[i] - p2[i]);
  }
  return out;
}

export function buildBezierArcLengthLUT(p0, p1, p2, p3, steps = 64) {
  const lut = new Float64Array(steps + 1);
  let prev = p0;
  let total = 0;
  lut[0] = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const pt = evalCubicBezier(p0, p1, p2, p3, t);
    let distSq = 0;
    for (let k = 0; k < p0.length; k++) {
      const d = pt[k] - prev[k];
      distSq += d * d;
    }
    total += Math.sqrt(distSq);
    lut[i] = total;
    prev = pt;
  }
  return { lut, totalLength: total, steps };
}

export function arcLengthToParam(lutObj, targetLen) {
  const { lut, totalLength, steps } = lutObj;
  if (totalLength <= 1e-8) return 0;
  const s = clamp(targetLen, 0, totalLength);
  if (s === 0) return 0;
  if (s >= totalLength) return 1;
  let lo = 0, hi = steps;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (lut[mid] <= s) lo = mid;
    else hi = mid;
  }
  const l0 = lut[lo], l1 = lut[hi];
  const frac = l1 > l0 ? (s - l0) / (l1 - l0) : 0;
  return (lo + frac) / steps;
}
