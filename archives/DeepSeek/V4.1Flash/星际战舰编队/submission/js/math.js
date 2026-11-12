// Minimal math library for the fleet film.
const M = (() => {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const smootherstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  const easeInOut = (t) => {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const fract = (x) => x - Math.floor(x);

  // ---- seeded random ----
  function mulberry32(a) {
    a |= 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash1(n) {
    n = (n << 13) ^ n;
    return 1.0 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0;
  }

  // ---- vec3 ----
  const v3 = (x, y, z) => [x, y, z];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const len = (a) => Math.sqrt(dot(a, a));
  const norm = (a) => {
    const l = len(a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const dist = (a, b) => len(sub(a, b));

  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [
      0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      0.5 * (2 * p1[2] + (-p0[2] + p2[2]) * t + (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 + (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t3),
    ];
  }

  // keys: [[t, x,y,z], ...] (time ascending, t in seconds local to key list)
  function sampleKeys(keys, time) {
    if (!keys || keys.length === 0) return [0, 0, 0];
    if (keys.length === 1) return [keys[0][1], keys[0][2], keys[0][3]];
    if (time <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3]];
    const n = keys.length;
    if (time >= keys[n - 1][0]) return [keys[n - 1][1], keys[n - 1][2], keys[n - 1][3]];
    let i = 0;
    while (i < n - 2 && time > keys[i + 1][0]) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
    const p = (k) => [k[1], k[2], k[3]];
    const span = k2[0] - k1[0] || 1;
    let u = clamp((time - k1[0]) / span, 0, 1);
    // gentle easing to keep control over slow-in / slow-out without killing continuity
    return catmull(p(k0), p(k1), p(k2), p(k3), u);
  }
  function sampleScalarKeys(keys, time) {
    if (!keys || keys.length === 0) return 0;
    if (keys.length === 1) return keys[0][1];
    if (time <= keys[0][0]) return keys[0][1];
    const n = keys.length;
    if (time >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (i < n - 2 && time > keys[i + 1][0]) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
    const span = k2[0] - k1[0] || 1;
    const u = clamp((time - k1[0]) / span, 0, 1);
    const v0 = k0[1], v1 = k1[1], v2 = k2[1], v3 = k3[1];
    // Catmull-Rom scalar
    const u2 = u * u, u3 = u2 * u;
    return 0.5 * (2 * v1 + (-v0 + v2) * u + (2 * v0 - 5 * v1 + 4 * v2 - v3) * u2 + (-v0 + 3 * v1 - 3 * v2 + v3) * u3);
  }

  function mat4Identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  function mat4Multiply(a, b) {
    // returns a*b (column-major, both Float32Array-like)
    const o = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        o[i * 4 + j] =
          a[0 * 4 + j] * b[i * 4 + 0] +
          a[1 * 4 + j] * b[i * 4 + 1] +
          a[2 * 4 + j] * b[i * 4 + 2] +
          a[3 * 4 + j] * b[i * 4 + 3];
      }
    }
    return o;
  }
  function mat4Perspective(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    const o = new Float32Array(16);
    o[0] = f / aspect;
    o[5] = f;
    o[10] = (far + near) * nf;
    o[11] = -1;
    o[14] = 2 * far * near * nf;
    return o;
  }
  function mat4Ortho(l, r, b, t, n, f) {
    const o = mat4Identity();
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n);
    return o;
  }
  function mat4LookAt(eye, target, up) {
    let z = norm(sub(eye, target));
    if (len(z) < 1e-8) z = [0, 0, 1];
    let x = norm(cross(up, z));
    if (len(x) < 1e-6) x = norm(cross([0, 0, 1], z));
    const y = cross(z, x);
    const o = new Float32Array(16);
    o[0] = x[0]; o[1] = y[0]; o[2] = z[0]; o[3] = 0;
    o[4] = x[1]; o[5] = y[1]; o[6] = z[1]; o[7] = 0;
    o[8] = x[2]; o[9] = y[2]; o[10] = z[2]; o[11] = 0;
    o[12] = -dot(x, eye); o[13] = -dot(y, eye); o[14] = -dot(z, eye); o[15] = 1;
    return o;
  }
  function mat4Compose(pos, yaw = 0, pitch = 0, roll = 0, scale = 1) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    // R = Ry * Rx * Rz
    const r00 = cy * cr + sy * sp * sr;
    const r01 = -cy * sr + sy * sp * cr;
    const r02 = sy * cp;
    const r10 = cp * sr;
    const r11 = cp * cr;
    const r12 = -sp;
    const r20 = -sy * cr + cy * sp * sr;
    const r21 = sy * sr + cy * sp * cr;
    const r22 = cy * cp;
    const s = scale;
    return new Float32Array([
      r00 * s, r10 * s, r20 * s, 0,
      r01 * s, r11 * s, r21 * s, 0,
      r02 * s, r12 * s, r22 * s, 0,
      pos[0], pos[1], pos[2], 1,
    ]);
  }
  function mat4Invert(a) {
    const o = new Float32Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return mat4Identity();
    det = 1.0 / det;
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
  }
  function transformPoint(m, p) {
    const x = p[0], y = p[1], z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    const iw = w ? 1 / w : 1;
    return [
      (m[0] * x + m[4] * y + m[8] * z + m[12]) * iw,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) * iw,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) * iw,
    ];
  }
  function transformDir(m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2],
    ];
  }

  // Rotation of a point about y axis
  function rotY(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  }
  function rotX(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  }

  return {
    clamp, lerp, smoothstep, smootherstep, easeInOut, fract,
    mulberry32, hash1,
    v3, add, sub, mul, dot, cross, len, norm, mix, dist,
    catmull, sampleKeys, sampleScalarKeys,
    mat4Identity, mat4Multiply, mat4Perspective, mat4Ortho, mat4LookAt, mat4Compose, mat4Invert,
    transformPoint, transformDir, rotY, rotX,
  };
})();
