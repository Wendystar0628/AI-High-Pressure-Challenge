// Deterministic math, PRNG, linear algebra, and 3x3 symmetric eigensolver utilities
window.AppMath = (() => {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function mat4Identity(out = new Float32Array(16)) {
    out.fill(0);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  }

  function mat4Multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      out[i * 4]     = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return out;
  }

  // WebGPU clip space Z in [0, 1]
  function mat4PerspectiveZO(out, fovyRad, aspect, near, far) {
    const f = 1.0 / Math.tan(fovyRad * 0.5);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[11] = -1;
    if (far !== null && far !== Infinity) {
      const nf = 1 / (near - far);
      out[10] = far * nf;
      out[14] = far * near * nf;
    } else {
      out[10] = -1;
      out[14] = -near;
    }
    return out;
  }

  function mat4OrthoZO(out, left, right, bottom, top, near, far) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    out.fill(0);
    out[0] = -2 * lr;
    out[5] = -2 * bt;
    out[10] = nf;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = near * nf;
    out[15] = 1;
    return out;
  }

  function mat4LookAt(out, eye, target, up) {
    let zx = eye[0] - target[0];
    let zy = eye[1] - target[1];
    let zz = eye[2] - target[2];
    let len = Math.hypot(zx, zy, zz);
    if (len > 1e-8) {
      zx /= len; zy /= len; zz /= len;
    } else {
      zz = 1;
    }

    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz);
    if (len > 1e-8) {
      xx /= len; xy /= len; xz /= len;
    } else {
      xx = 1; xy = 0; xz = 0;
    }

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }

  function mat4Invert(out, a) {
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
    if (Math.abs(det) < 1e-12) return null;
    det = 1.0 / det;

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

  // Jacobi 3x3 symmetric eigensolver for C = F^T * F
  // Input: [c00, c11, c22, c01, c02, c12]
  // Output: { values: [l0, l1, l2], maxVec: [vx, vy, vz] } (largest eigenvalue's eigenvector)
  function symmetricEigen3x3Max(c00, c11, c22, c01, c02, c12) {
    let a00 = c00, a11 = c11, a22 = c22;
    let a01 = c01, a02 = c02, a12 = c12;
    let v00 = 1, v01 = 0, v02 = 0;
    let v10 = 0, v11 = 1, v12 = 0;
    let v20 = 0, v21 = 0, v22 = 1;

    for (let iter = 0; iter < 12; iter++) {
      const m01 = Math.abs(a01), m02 = Math.abs(a02), m12 = Math.abs(a12);
      if (m01 < 1e-9 && m02 < 1e-9 && m12 < 1e-9) break;

      if (m01 >= m02 && m01 >= m12) {
        const tau = (a11 - a00) / (2 * a01);
        const t = tau >= 0 ? 1 / (tau + Math.sqrt(1 + tau * tau)) : -1 / (-tau + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;
        const n00 = a00 - t * a01;
        const n11 = a11 + t * a01;
        const n02 = c * a02 - s * a12;
        const n12 = s * a02 + c * a12;
        a00 = n00; a11 = n11; a01 = 0; a02 = n02; a12 = n12;
        const u0 = c * v00 - s * v01, u1 = s * v00 + c * v01; v00 = u0; v01 = u1;
        const w0 = c * v10 - s * v11, w1 = s * v10 + c * v11; v10 = w0; v11 = w1;
        const z0 = c * v20 - s * v21, z1 = s * v20 + c * v21; v20 = z0; v21 = z1;
      } else if (m02 >= m01 && m02 >= m12) {
        const tau = (a22 - a00) / (2 * a02);
        const t = tau >= 0 ? 1 / (tau + Math.sqrt(1 + tau * tau)) : -1 / (-tau + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;
        const n00 = a00 - t * a02;
        const n22 = a22 + t * a02;
        const n01 = c * a01 - s * a12;
        const n12 = s * a01 + c * a12;
        a00 = n00; a22 = n22; a02 = 0; a01 = n01; a12 = n12;
        const u0 = c * v00 - s * v02, u2 = s * v00 + c * v02; v00 = u0; v02 = u2;
        const w0 = c * v10 - s * v12, w2 = s * v10 + c * v12; v10 = w0; v12 = w2;
        const z0 = c * v20 - s * v22, z2 = s * v20 + c * v22; v20 = z0; v22 = z2;
      } else {
        const tau = (a22 - a11) / (2 * a12);
        const t = tau >= 0 ? 1 / (tau + Math.sqrt(1 + tau * tau)) : -1 / (-tau + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;
        const n11 = a11 - t * a12;
        const n22 = a22 + t * a12;
        const n01 = c * a01 - s * a02;
        const n02 = s * a01 + c * a02;
        a11 = n11; a22 = n22; a12 = 0; a01 = n01; a02 = n02;
        const u1 = c * v01 - s * v02, u2 = s * v01 + c * v02; v01 = u1; v02 = u2;
        const w1 = c * v11 - s * v12, w2 = s * v11 + c * v12; v11 = w1; v12 = w2;
        const z1 = c * v21 - s * v22, z2 = s * v21 + c * v22; v21 = z1; v22 = z2;
      }
    }

    let maxVal = a00, minVal = a00, midVal = a00;
    let vx = v00, vy = v10, vz = v20;
    if (a11 >= a00 && a11 >= a22) {
      maxVal = a11;
      vx = v01; vy = v11; vz = v21;
      minVal = Math.min(a00, a22);
      midVal = Math.max(a00, a22);
    } else if (a22 >= a00 && a22 >= a11) {
      maxVal = a22;
      vx = v02; vy = v12; vz = v22;
      minVal = Math.min(a00, a11);
      midVal = Math.max(a00, a11);
    } else {
      minVal = Math.min(a11, a22);
      midVal = Math.max(a11, a22);
    }
    return { maxVal, midVal, minVal, vx, vy, vz };
  }

  return {
    mulberry32,
    clamp,
    lerp,
    smoothstep,
    mat4Identity,
    mat4Multiply,
    mat4PerspectiveZO,
    mat4OrthoZO,
    mat4LookAt,
    mat4Invert,
    symmetricEigen3x3Max
  };
})();
