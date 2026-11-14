(function (global) {
  'use strict';

  const SF = (global.SF = global.SF || {});

  function clamp(x, min, max) {
    return x < min ? min : x > max ? max : x;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function smootherstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

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

  function hash3(x, y, z) {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647);
    n = (n ^ (n >>> 13)) | 0;
    n = Math.imul(n, 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function valueNoise3D(x, y, z) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const xf = x - xi;
    const yf = y - yi;
    const zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const w = zf * zf * (3 - 2 * zf);

    const c000 = hash3(xi, yi, zi);
    const c100 = hash3(xi + 1, yi, zi);
    const c010 = hash3(xi, yi + 1, zi);
    const c110 = hash3(xi + 1, yi + 1, zi);
    const c001 = hash3(xi, yi, zi + 1);
    const c101 = hash3(xi + 1, yi, zi + 1);
    const c011 = hash3(xi, yi + 1, zi + 1);
    const c111 = hash3(xi + 1, yi + 1, zi + 1);

    const x00 = lerp(c000, c100, u);
    const x10 = lerp(c010, c110, u);
    const x01 = lerp(c001, c101, u);
    const x11 = lerp(c011, c111, u);

    const y0 = lerp(x00, x10, v);
    const y1 = lerp(x01, x11, v);

    return lerp(y0, y1, w);
  }

  function fbm3D(x, y, z, octaves) {
    let val = 0;
    let amp = 0.5;
    let freq = 1.0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      val += amp * valueNoise3D(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return val / norm;
  }

  const Vec3 = {
    create(x = 0, y = 0, z = 0) {
      return [x, y, z];
    },
    add(out, a, b) {
      out[0] = a[0] + b[0];
      out[1] = a[1] + b[1];
      out[2] = a[2] + b[2];
      return out;
    },
    sub(out, a, b) {
      out[0] = a[0] - b[0];
      out[1] = a[1] - b[1];
      out[2] = a[2] - b[2];
      return out;
    },
    scale(out, a, s) {
      out[0] = a[0] * s;
      out[1] = a[1] * s;
      out[2] = a[2] * s;
      return out;
    },
    addScaled(out, a, b, s) {
      out[0] = a[0] + b[0] * s;
      out[1] = a[1] + b[1] * s;
      out[2] = a[2] + b[2] * s;
      return out;
    },
    dot(a, b) {
      return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    },
    cross(out, a, b) {
      const ax = a[0], ay = a[1], az = a[2];
      const bx = b[0], by = b[1], bz = b[2];
      out[0] = ay * bz - az * by;
      out[1] = az * bx - ax * bz;
      out[2] = ax * by - ay * bx;
      return out;
    },
    len(a) {
      return Math.hypot(a[0], a[1], a[2]);
    },
    dist(a, b) {
      return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    },
    normalize(out, a) {
      const l = Math.hypot(a[0], a[1], a[2]);
      if (l > 1e-8) {
        const inv = 1 / l;
        out[0] = a[0] * inv;
        out[1] = a[1] * inv;
        out[2] = a[2] * inv;
      } else {
        out[0] = 0; out[1] = 0; out[2] = 0;
      }
      return out;
    },
    lerp(out, a, b, t) {
      out[0] = a[0] + (b[0] - a[0]) * t;
      out[1] = a[1] + (b[1] - a[1]) * t;
      out[2] = a[2] + (b[2] - a[2]) * t;
      return out;
    },
    copy(out, a) {
      out[0] = a[0]; out[1] = a[1]; out[2] = a[2];
      return out;
    }
  };

  const Mat4 = {
    create() {
      const m = new Float32Array(16);
      m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
      return m;
    },
    identity(out) {
      out.fill(0);
      out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
      return out;
    },
    copy(out, a) {
      out.set(a);
      return out;
    },
    multiply(out, a, b) {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

      let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
      out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

      b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
      out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

      b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
      out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

      b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
      out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      return out;
    },
    perspective(out, fovyRad, aspect, near, far) {
      const f = 1.0 / Math.tan(fovyRad / 2);
      out.fill(0);
      out[0] = f / aspect;
      out[5] = f;
      out[10] = (far + near) / (near - far);
      out[11] = -1;
      out[14] = (2 * far * near) / (near - far);
      return out;
    },
    ortho(out, left, right, bottom, top, near, far) {
      const lr = 1 / (left - right);
      const bt = 1 / (bottom - top);
      const nf = 1 / (near - far);
      out.fill(0);
      out[0] = -2 * lr;
      out[5] = -2 * bt;
      out[10] = 2 * nf;
      out[12] = (left + right) * lr;
      out[13] = (top + bottom) * bt;
      out[14] = (far + near) * nf;
      out[15] = 1;
      return out;
    },
    lookAt(out, eye, center, up) {
      let z0 = eye[0] - center[0];
      let z1 = eye[1] - center[1];
      let z2 = eye[2] - center[2];
      let len = Math.hypot(z0, z1, z2);
      if (len < 1e-8) {
        z2 = 1;
      } else {
        z0 /= len; z1 /= len; z2 /= len;
      }

      let x0 = up[1] * z2 - up[2] * z1;
      let x1 = up[2] * z0 - up[0] * z2;
      let x2 = up[0] * z1 - up[1] * z0;
      len = Math.hypot(x0, x1, x2);
      if (len < 1e-8) {
        x0 = 0; x1 = 0; x2 = 0;
      } else {
        x0 /= len; x1 /= len; x2 /= len;
      }

      const y0 = z1 * x2 - z2 * x1;
      const y1 = z2 * x0 - z0 * x2;
      const y2 = z0 * x1 - z1 * x0;

      out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
      out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
      out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
      out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
      out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
      out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
      out[15] = 1;
      return out;
    },
    fromTranslationRotationScale(out, pos, eulerXYZ, scale = [1, 1, 1]) {
      const rx = eulerXYZ[0], ry = eulerXYZ[1], rz = eulerXYZ[2];
      const cx = Math.cos(rx), sx = Math.sin(rx);
      const cy = Math.cos(ry), sy = Math.sin(ry);
      const cz = Math.cos(rz), sz = Math.sin(rz);

      // R = Ry * Rx * Rz (yaw-pitch-roll aerospace convention)
      const r00 = cy * cz + sy * sx * sz;
      const r01 = cz * sy * sx - cy * sz;
      const r02 = sy * cx;

      const r10 = cx * sz;
      const r11 = cx * cz;
      const r12 = -sx;

      const r20 = cy * sx * sz - sy * cz;
      const r21 = sy * sz + cy * cz * sx;
      const r22 = cy * cx;

      out[0] = r00 * scale[0]; out[1] = r10 * scale[0]; out[2] = r20 * scale[0]; out[3] = 0;
      out[4] = r01 * scale[1]; out[5] = r11 * scale[1]; out[6] = r21 * scale[1]; out[7] = 0;
      out[8] = r02 * scale[2]; out[9] = r12 * scale[2]; out[10] = r22 * scale[2]; out[11] = 0;
      out[12] = pos[0]; out[13] = pos[1]; out[14] = pos[2]; out[15] = 1;
      return out;
    },
    fromAxisAngleTranslation(out, pos, axis, angle, scale = 1) {
      const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
      const x = axis[0] / len, y = axis[1] / len, z = axis[2] / len;
      const s = Math.sin(angle), c = Math.cos(angle), t = 1 - c;
      out[0] = (x * x * t + c) * scale;
      out[1] = (y * x * t + z * s) * scale;
      out[2] = (z * x * t - y * s) * scale;
      out[3] = 0;
      out[4] = (x * y * t - z * s) * scale;
      out[5] = (y * y * t + c) * scale;
      out[6] = (z * y * t + x * s) * scale;
      out[7] = 0;
      out[8] = (x * z * t + y * s) * scale;
      out[9] = (y * z * t - x * s) * scale;
      out[10] = (z * z * t + c) * scale;
      out[11] = 0;
      out[12] = pos[0];
      out[13] = pos[1];
      out[14] = pos[2];
      out[15] = 1;
      return out;
    },
    fromBasisTranslation(out, right, up, forward, pos) {
      out[0] = right[0]; out[1] = right[1]; out[2] = right[2]; out[3] = 0;
      out[4] = up[0]; out[5] = up[1]; out[6] = up[2]; out[7] = 0;
      out[8] = forward[0]; out[9] = forward[1]; out[10] = forward[2]; out[11] = 0;
      out[12] = pos[0]; out[13] = pos[1]; out[14] = pos[2]; out[15] = 1;
      return out;
    },
    invert(out, a) {
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
      if (!det) return null;
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
    },
    transformPoint(out, m, p) {
      const x = p[0], y = p[1], z = p[2];
      out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      return out;
    }
  };

  function catmullRomScalar(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  }

  function catmullRomVec3(out, p0, p1, p2, p3, t) {
    out[0] = catmullRomScalar(p0[0], p1[0], p2[0], p3[0], t);
    out[1] = catmullRomScalar(p0[1], p1[1], p2[1], p3[1], t);
    out[2] = catmullRomScalar(p0[2], p1[2], p2[2], p3[2], t);
    return out;
  }

  // Evaluate piecewise Catmull-Rom over keyframe list [{t, val}, ...]
  function evalSplineKeyframes(out, keyframes, time, closed = false) {
    const n = keyframes.length;
    if (n === 0) return out;
    if (n === 1) return Vec3.copy(out, keyframes[0].val);

    if (!closed) {
      if (time <= keyframes[0].t) return Vec3.copy(out, keyframes[0].val);
      if (time >= keyframes[n - 1].t) return Vec3.copy(out, keyframes[n - 1].val);
    }

    let idx = 0;
    for (let i = 0; i < n - 1; i++) {
      if (time >= keyframes[i].t && time <= keyframes[i + 1].t) {
        idx = i;
        break;
      }
    }
    const k1 = keyframes[idx];
    const k2 = keyframes[idx + 1];
    const dt = k2.t - k1.t;
    const u = dt > 1e-6 ? clamp((time - k1.t) / dt, 0, 1) : 0;

    let p0, p3;
    if (closed) {
      p0 = keyframes[(idx - 1 + n) % n].val;
      p3 = keyframes[(idx + 2) % n].val;
    } else {
      p0 = idx > 0 ? keyframes[idx - 1].val : k1.val;
      p3 = idx + 2 < n ? keyframes[idx + 2].val : k2.val;
    }
    return catmullRomVec3(out, p0, k1.val, k2.val, p3, u);
  }

  SF.Math = {
    clamp,
    lerp,
    smoothstep,
    smootherstep,
    mulberry32,
    hash3,
    valueNoise3D,
    fbm3D,
    Vec3,
    Mat4,
    catmullRomVec3,
    evalSplineKeyframes
  };
})(window);
