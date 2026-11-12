// Minimal vector / matrix math (column-major mat4, WebGL convention)
(function (global) {
  'use strict';

  function v3(x, y, z) { return [x || 0, y || 0, z || 0]; }

  function v3add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function v3sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function v3scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function v3dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function v3cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function v3len(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
  function v3norm(a) {
    const l = v3len(a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  function v3lerp(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function v3dist(a, b) { return v3len(v3sub(a, b)); }

  function m4identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function m4mul(a, b, out) {
    out = out || new Float32Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      out[c * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      out[c * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      out[c * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      out[c * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return out;
  }

  function m4translate(x, y, z) {
    const m = m4identity();
    m[12] = x; m[13] = y; m[14] = z;
    return m;
  }

  function m4scale(x, y, z) {
    const m = m4identity();
    m[0] = x; m[5] = y; m[10] = z;
    return m;
  }

  function m4rotateX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m = m4identity();
    m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
    return m;
  }
  function m4rotateY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m = m4identity();
    m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
    return m;
  }
  function m4rotateZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m = m4identity();
    m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
    return m;
  }

  // Compose TRS: translate * rotY * rotX * rotZ * scale
  function m4trs(pos, rot, scl) {
    let m = m4translate(pos[0], pos[1], pos[2]);
    if (rot[1]) m = m4mul(m, m4rotateY(rot[1]));
    if (rot[0]) m = m4mul(m, m4rotateX(rot[0]));
    if (rot[2]) m = m4mul(m, m4rotateZ(rot[2]));
    if (scl && (scl[0] !== 1 || scl[1] !== 1 || scl[2] !== 1)) {
      m = m4mul(m, m4scale(scl[0], scl[1], scl[2]));
    }
    return m;
  }

  function m4perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    const m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f;
    m[10] = (far + near) * nf; m[11] = -1;
    m[14] = 2 * far * near * nf;
    return m;
  }

  function m4lookAt(eye, center, up) {
    const z = v3norm(v3sub(eye, center));
    const x = v3norm(v3cross(up, z));
    const y = v3cross(z, x);
    const m = new Float32Array(16);
    m[0] = x[0]; m[1] = y[0]; m[2] = z[0]; m[3] = 0;
    m[4] = x[1]; m[5] = y[1]; m[6] = z[1]; m[7] = 0;
    m[8] = x[2]; m[9] = y[2]; m[10] = z[2]; m[11] = 0;
    m[12] = -v3dot(x, eye); m[13] = -v3dot(y, eye); m[14] = -v3dot(z, eye); m[15] = 1;
    return m;
  }

  function m4transformPoint(m, p) {
    const x = p[0], y = p[1], z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    return [
      (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
    ];
  }

  function m4invert(m, out) {
    out = out || new Float32Array(16);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return out;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }

  function m4transformDir(m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2]
    ];
  }

  // Catmull-Rom on a list of vec3 keys
  function catmullRom(pts, t) {
    const n = pts.length;
    if (n === 1) return pts[0].slice();
    if (n === 2) return v3lerp(pts[0], pts[1], t);
    const ft = t * (n - 1);
    let i = Math.floor(ft);
    if (i >= n - 1) i = n - 2;
    const u = ft - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const u2 = u * u, u3 = u2 * u;
    const out = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      out[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
    }
    return out;
  }

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) {
    const t = clamp((x - a) / (b - a || 1), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function smootherstep(a, b, x) {
    const t = clamp((x - a) / (b - a || 1), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  // wrap-around time delta: positive seconds from a→b along a loop of length L
  function wrapDelta(a, b, L) {
    let d = b - a;
    while (d < 0) d += L;
    while (d >= L) d -= L;
    return d;
  }

  // deterministic pseudo-random
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  global.V3 = {
    v3, add: v3add, sub: v3sub, scale: v3scale, dot: v3dot, cross: v3cross,
    len: v3len, norm: v3norm, lerp: v3lerp, dist: v3dist
  };
  global.M4 = {
    identity: m4identity, mul: m4mul, translate: m4translate, scale: m4scale,
    rotateX: m4rotateX, rotateY: m4rotateY, rotateZ: m4rotateZ, trs: m4trs,
    perspective: m4perspective, lookAt: m4lookAt, invert: m4invert,
    transformPoint: m4transformPoint, transformDir: m4transformDir
  };
  global.U = {
    clamp, lerp, smoothstep, smootherstep, wrapDelta, catmullRom, mulberry32
  };
})(window);
