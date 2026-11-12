'use strict';
// ---------------------------------------------------------------------------
// Math / random / curve utilities (no dependencies)
// ---------------------------------------------------------------------------
const U = {};

U.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
U.lerp = (a, b, t) => a + (b - a) * t;
U.sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
U.smooth = (a, b, x) => { const t = U.sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
U.smoother = (a, b, x) => { const t = U.sat((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
U.remap = (x, a, b, c, d) => c + (d - c) * U.sat((x - a) / (b - a));
// bump: 0 outside [a,d], rises a->b, flat b->c, falls c->d
U.bump = (x, a, b, c, d) => U.smooth(a, b, x) * (1 - U.smooth(c, d, x));
U.easeInOut = (t) => t * t * (3 - 2 * t);
U.fract = (x) => x - Math.floor(x);

// ---- vec3 as plain arrays ----
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  madd: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  neg: (a) => [-a[0], -a[1], -a[2]],
};

// ---- quaternions [x,y,z,w] ----
const Q = {
  ident: () => [0, 0, 0, 1],
  axis: (ax, ang) => { const s = Math.sin(ang / 2), n = V.norm(ax); return [n[0] * s, n[1] * s, n[2] * s, Math.cos(ang / 2)]; },
  mul: (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ],
  rot: (q, v) => {
    const [x, y, z, w] = q;
    const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2];
    const iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
  },
  // yaw (around y), pitch (around x), roll (around z); forward is +z
  euler: (yaw, pitch, roll) => Q.mul(Q.mul(Q.axis([0, 1, 0], yaw), Q.axis([1, 0, 0], -pitch)), Q.axis([0, 0, 1], roll)),
  // rotation whose +z maps to fwd and +y close to up
  look: (fwd, up) => {
    const f = V.norm(fwd); let r = V.cross(up || [0, 1, 0], f);
    if (V.len(r) < 1e-5) r = V.cross([1, 0, 0], f);
    r = V.norm(r); const u = V.cross(f, r);
    return Q.fromBasis(r, u, f);
  },
  fromBasis: (r, u, f) => {
    const m00 = r[0], m01 = u[0], m02 = f[0], m10 = r[1], m11 = u[1], m12 = f[1], m20 = r[2], m21 = u[2], m22 = f[2];
    const tr = m00 + m11 + m22; let q;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]; }
    else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
    else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
    else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
    const l = Math.hypot(q[0], q[1], q[2], q[3]); return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
  },
  slerp: (a, b, t) => {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; let bb = b;
    if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
    if (d > 0.9995) { const r = [a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]; const l = Math.hypot(...r); return r.map((x) => x / l); }
    const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
  },
};

// ---- mat4 column-major Float32Array ----
const M = {
  ident: () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul: (a, b, out) => {
    const o = out || new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  // translation + quaternion (+ uniform scale)
  trq: (t, q, s) => {
    const m = new Float32Array(16); const [x, y, z, w] = q; const sc = s || 1;
    m[0] = (1 - 2 * (y * y + z * z)) * sc; m[1] = 2 * (x * y + z * w) * sc; m[2] = 2 * (x * z - y * w) * sc;
    m[4] = 2 * (x * y - z * w) * sc; m[5] = (1 - 2 * (x * x + z * z)) * sc; m[6] = 2 * (y * z + x * w) * sc;
    m[8] = 2 * (x * z + y * w) * sc; m[9] = 2 * (y * z - x * w) * sc; m[10] = (1 - 2 * (x * x + y * y)) * sc;
    m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; m[15] = 1; return m;
  },
  trans: (t) => { const m = M.ident(); m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; return m; },
  scale3: (s) => { const m = M.ident(); m[0] = s[0]; m[5] = s[1]; m[10] = s[2]; return m; },
  persp: (fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = (2 * far * near) / (near - far); return m;
  },
  ortho: (l, r, b, t, n, f) => {
    const m = new Float32Array(16);
    m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
    m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); m[15] = 1; return m;
  },
  lookAt: (eye, target, up) => {
    const f = V.norm(V.sub(target, eye)); let s = V.cross(f, up);
    if (V.len(s) < 1e-6) s = V.cross(f, [1, 0, 0]);
    s = V.norm(s); const u = V.cross(s, f); const m = new Float32Array(16);
    m[0] = s[0]; m[4] = s[1]; m[8] = s[2];
    m[1] = u[0]; m[5] = u[1]; m[9] = u[2];
    m[2] = -f[0]; m[6] = -f[1]; m[10] = -f[2];
    m[12] = -V.dot(s, eye); m[13] = -V.dot(u, eye); m[14] = V.dot(f, eye); m[15] = 1; return m;
  },
  invert: (a) => {
    const o = new Float32Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!det) return M.ident(); det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },
  xform: (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]],
  xdir: (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]],
};

// ---- deterministic random ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
U.rng = mulberry32;
U.hash = (n) => { let x = (n | 0) * 374761393 + 668265263; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
U.hash3 = (x, y, z) => U.hash((x | 0) * 73856093 ^ (y | 0) * 19349663 ^ (z | 0) * 83492791);

// value noise 3D (smooth), returns 0..1
U.vnoise = (x, y, z) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let xf = x - xi, yf = y - yi, zf = z - zi;
  xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
  const h = U.hash3;
  const c000 = h(xi, yi, zi), c100 = h(xi + 1, yi, zi), c010 = h(xi, yi + 1, zi), c110 = h(xi + 1, yi + 1, zi);
  const c001 = h(xi, yi, zi + 1), c101 = h(xi + 1, yi, zi + 1), c011 = h(xi, yi + 1, zi + 1), c111 = h(xi + 1, yi + 1, zi + 1);
  const x00 = c000 + (c100 - c000) * xf, x10 = c010 + (c110 - c010) * xf, x01 = c001 + (c101 - c001) * xf, x11 = c011 + (c111 - c011) * xf;
  const y0 = x00 + (x10 - x00) * yf, y1 = x01 + (x11 - x01) * yf;
  return y0 + (y1 - y0) * zf;
};
U.fbm = (x, y, z, oct) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * U.vnoise(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; };

// ---- Hermite keyframe track (velocity-continuous) ----
// keys: [{t, v:[..]}]  values arrays of equal length; tangents by Catmull-Rom in time
class Track {
  constructor(keys) {
    this.keys = keys.slice().sort((a, b) => a.t - b.t);
    const k = this.keys, n = k.length;
    this.m = k.map((key, i) => {
      if (key.m) return key.m;
      if (n < 2) return key.v.map(() => 0);
      if (i === 0) { if (key.ease) return key.v.map(() => 0); return key.v.map((x, j) => (k[1].v[j] - x) / (k[1].t - key.t)); }
      if (i === n - 1) { if (key.ease) return key.v.map(() => 0); return key.v.map((x, j) => (x - k[i - 1].v[j]) / (key.t - k[i - 1].t)); }
      if (key.ease) return key.v.map(() => 0);
      return key.v.map((x, j) => (k[i + 1].v[j] - k[i - 1].v[j]) / (k[i + 1].t - k[i - 1].t));
    });
  }
  at(t) {
    const k = this.keys, n = k.length;
    if (t <= k[0].t) return k[0].v.slice();
    if (t >= k[n - 1].t) return k[n - 1].v.slice();
    let i = 0; while (i < n - 2 && t > k[i + 1].t) i++;
    const a = k[i], b = k[i + 1], h = b.t - a.t, s = (t - a.t) / h;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const ma = this.m[i], mb = this.m[i + 1];
    return a.v.map((x, j) => h00 * x + h10 * h * ma[j] + h01 * b.v[j] + h11 * h * mb[j]);
  }
}
U.Track = Track;

// sRGB hex -> linear rgb
U.lin = (hex) => {
  const c = typeof hex === 'string' ? parseInt(hex.slice(1), 16) : hex;
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return [f((c >> 16) & 255), f((c >> 8) & 255), f(c & 255)];
};
