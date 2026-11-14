// ============================================================================
// 01_math_rng.js
// Deterministic PRNG, 3D Procedural Noise, Linear Algebra & Spline Utilities
// ============================================================================
(function (global) {
  'use strict';

  const SF = (global.StarFleet = global.StarFleet || {});

  // --- Deterministic PRNG (Mulberry32) ---
  function createRNG(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash3i(x, y, z) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function hash1(n) {
    let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  // Smooth 3D Value Noise (deterministic, fast for voxel sculpting & motion)
  function noise3D(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const ux = fx * fx * (3.0 - 2.0 * fx);
    const uy = fy * fy * (3.0 - 2.0 * fy);
    const uz = fz * fz * (3.0 - 2.0 * fz);

    const n000 = hash3i(ix, iy, iz);
    const n100 = hash3i(ix + 1, iy, iz);
    const n010 = hash3i(ix, iy + 1, iz);
    const n110 = hash3i(ix + 1, iy + 1, iz);
    const n001 = hash3i(ix, iy, iz + 1);
    const n101 = hash3i(ix + 1, iy, iz + 1);
    const n011 = hash3i(ix, iy + 1, iz + 1);
    const n111 = hash3i(ix + 1, iy + 1, iz + 1);

    const nx00 = n000 + (n100 - n000) * ux;
    const nx10 = n010 + (n110 - n010) * ux;
    const nx01 = n001 + (n101 - n001) * ux;
    const nx11 = n011 + (n111 - n011) * ux;

    const nxy0 = nx00 + (nx10 - nx00) * uy;
    const nxy1 = nx01 + (nx11 - nx01) * uy;

    return nxy0 + (nxy1 - nxy0) * uz;
  }

  function fbm3D(x, y, z, octaves) {
    let val = 0.0;
    let amp = 0.5;
    let freq = 1.0;
    let norm = 0.0;
    const oct = octaves || 3;
    for (let i = 0; i < oct; i++) {
      val += amp * noise3D(x * freq, y * freq, z * freq);
      norm += amp;
      freq *= 2.03;
      amp *= 0.5;
    }
    return val / norm;
  }

  // --- Scalar Helpers ---
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function saturate(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(e0, e1, x) {
    const t = saturate((x - e0) / (e1 - e0 || 1e-6));
    return t * t * (3.0 - 2.0 * t);
  }

  function smootherstep(e0, e1, x) {
    const t = saturate((x - e0) / (e1 - e0 || 1e-6));
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  // --- Vec3 Operations ---
  const V3 = {
    create(x = 0, y = 0, z = 0) {
      return new Float32Array([x, y, z]);
    },
    set(out, x, y, z) {
      out[0] = x; out[1] = y; out[2] = z;
      return out;
    },
    copy(out, a) {
      out[0] = a[0]; out[1] = a[1]; out[2] = a[2];
      return out;
    },
    add(out, a, b) {
      out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2];
      return out;
    },
    sub(out, a, b) {
      out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2];
      return out;
    },
    scale(out, a, s) {
      out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s;
      return out;
    },
    scaleAndAdd(out, a, b, s) {
      out[0] = a[0] + b[0] * s;
      out[1] = a[1] + b[1] * s;
      out[2] = a[2] + b[2] * s;
      return out;
    },
    lerp(out, a, b, t) {
      out[0] = a[0] + (b[0] - a[0]) * t;
      out[1] = a[1] + (b[1] - a[1]) * t;
      out[2] = a[2] + (b[2] - a[2]) * t;
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
        const inv = 1.0 / l;
        out[0] = a[0] * inv; out[1] = a[1] * inv; out[2] = a[2] * inv;
      } else {
        out[0] = 0; out[1] = 0; out[2] = 1;
      }
      return out;
    }
  };

  // --- Mat4 Operations (Column-Major for WebGL2) ---
  const M4 = {
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

      for (let i = 0; i < 4; i++) {
        const idx = i * 4;
        const b0 = b[idx], b1 = b[idx + 1], b2 = b[idx + 2], b3 = b[idx + 3];
        out[idx]     = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[idx + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[idx + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[idx + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      }
      return out;
    },
    perspective(out, fovyRad, aspect, near, far) {
      const f = 1.0 / Math.tan(fovyRad * 0.5);
      out.fill(0);
      out[0] = f / aspect;
      out[5] = f;
      out[10] = (far + near) / (near - far);
      out[11] = -1.0;
      out[14] = (2.0 * far * near) / (near - far);
      return out;
    },
    ortho(out, left, right, bottom, top, near, far) {
      const lr = 1.0 / (left - right);
      const bt = 1.0 / (bottom - top);
      const nf = 1.0 / (near - far);
      out.fill(0);
      out[0] = -2.0 * lr;
      out[5] = -2.0 * bt;
      out[10] = 2.0 * nf;
      out[12] = (left + right) * lr;
      out[13] = (top + bottom) * bt;
      out[14] = (far + near) * nf;
      out[15] = 1.0;
      return out;
    },
    lookAt(out, eye, center, up) {
      let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
      let len = Math.hypot(zx, zy, zz);
      if (len < 1e-8) { zx = 0; zy = 0; zz = 1; } else { zx /= len; zy /= len; zz /= len; }

      let xx = up[1] * zz - up[2] * zy;
      let xy = up[2] * zx - up[0] * zz;
      let xz = up[0] * zy - up[1] * zx;
      len = Math.hypot(xx, xy, xz);
      if (len < 1e-8) { xx = 1; xy = 0; xz = 0; } else { xx /= len; xy /= len; xz /= len; }

      const yx = zy * xz - zz * xy;
      const yy = zz * xx - zx * xz;
      const yz = zx * xy - zy * xx;

      out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
      out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
      out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
      out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
      out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
      out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
      out[15] = 1.0;
      return out;
    },
    // Strict rigid-body transform (Translation + Euler YXZ Rotation, scale = 1.0!)
    // Preserves uniform 1x1x1 voxel size across all solid entities!
    fromRigidEuler(out, tx, ty, tz, yawY, pitchX, rollZ) {
      const cy = Math.cos(yawY), sy = Math.sin(yawY);
      const cx = Math.cos(pitchX), sx = Math.sin(pitchX);
      const cz = Math.cos(rollZ), sz = Math.sin(rollZ);

      // R = Ry * Rx * Rz
      out[0] = cy * cz + sy * sx * sz;
      out[1] = cx * sz;
      out[2] = -sy * cz + cy * sx * sz;
      out[3] = 0;

      out[4] = -cy * sz + sy * sx * cz;
      out[5] = cx * cz;
      out[6] = sy * sz + cy * sx * cz;
      out[7] = 0;

      out[8] = sy * cx;
      out[9] = -sx;
      out[10] = cy * cx;
      out[11] = 0;

      out[12] = tx;
      out[13] = ty;
      out[14] = tz;
      out[15] = 1;
      return out;
    },
    // Transform for smooth non-voxel light/medium VFX (shields, beams, plumes) where non-uniform scale is allowed
    fromTRS(out, tx, ty, tz, yawY, pitchX, rollZ, sxScale, syScale, szScale) {
      M4.fromRigidEuler(out, tx, ty, tz, yawY, pitchX, rollZ);
      out[0] *= sxScale; out[1] *= sxScale; out[2] *= sxScale;
      out[4] *= syScale; out[5] *= syScale; out[6] *= syScale;
      out[8] *= szScale; out[9] *= szScale; out[10] *= szScale;
      return out;
    },
    // Align +Z axis along dir, with position at pos and optional scale (for beams, bolts, plumes, missiles)
    fromPosDirScale(out, pos, dir, roll, sx, sy, sz) {
      let zx = dir[0], zy = dir[1], zz = dir[2];
      let zl = Math.hypot(zx, zy, zz) || 1;
      zx /= zl; zy /= zl; zz /= zl;

      let ux = 0, uy = 1, uz = 0;
      if (Math.abs(zy) > 0.96) { ux = 1; uy = 0; uz = 0; }
      let xx = uy * zz - uz * zy;
      let xy = uz * zx - ux * zz;
      let xz = ux * zy - uy * zx;
      let xl = Math.hypot(xx, xy, xz) || 1;
      xx /= xl; xy /= xl; xz /= xl;

      let yx = zz * xy - zx * xz;
      let yy = zx * xz - zz * xx; // wait: z cross x = (zy*xz - zz*xy, zz*xx - zx*xz, zx*xy - zy*xx)
      yx = zy * xz - zz * xy;
      yy = zz * xx - zx * xz;
      let yz = zx * xy - zy * xx;

      if (roll) {
        const cr = Math.cos(roll), sr = Math.sin(roll);
        const nxx = xx * cr + yx * sr;
        const nxy = xy * cr + yy * sr;
        const nxz = xz * cr + yz * sr;
        yx = yx * cr - xx * sr;
        yy = yy * cr - xy * sr;
        yz = yz * cr - xz * sr;
        xx = nxx; xy = nxy; xz = nxz;
      }

      out[0] = xx * sx; out[1] = xy * sx; out[2] = xz * sx; out[3] = 0;
      out[4] = yx * sy; out[5] = yy * sy; out[6] = yz * sy; out[7] = 0;
      out[8] = zx * sz; out[9] = zy * sz; out[10] = zz * sz; out[11] = 0;
      out[12] = pos[0]; out[13] = pos[1]; out[14] = pos[2]; out[15] = 1;
      return out;
    },
    invertRigidOrGeneral(out, a) {
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
      if (!det) return M4.identity(out);
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
    },
    transformDir(out, m, d) {
      const x = d[0], y = d[1], z = d[2];
      out[0] = m[0] * x + m[4] * y + m[8] * z;
      out[1] = m[1] * x + m[5] * y + m[9] * z;
      out[2] = m[2] * x + m[6] * y + m[10] * z;
      return out;
    }
  };

  // --- Catmull-Rom Spline Evaluation (C1 Smooth Camera & Shuttle/Missile Paths) ---
  function evalCatmullRom3(out, pts, u, closed) {
    const n = pts.length;
    if (n === 1) {
      out[0] = pts[0][0]; out[1] = pts[0][1]; out[2] = pts[0][2];
      return out;
    }
    const segCount = closed ? n : n - 1;
    const su = clamp(u, 0, 1) * segCount;
    let i = Math.min(Math.floor(su), segCount - 1);
    const t = su - i;

    const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];

    const t2 = t * t, t3 = t2 * t;
    for (let k = 0; k < 3; k++) {
      const v0 = p0[k], v1 = p1[k], v2 = p2[k], v3 = p3[k];
      out[k] = 0.5 * (
        (2.0 * v1) +
        (-v0 + v2) * t +
        (2.0 * v0 - 5.0 * v1 + 4.0 * v2 - v3) * t2 +
        (-v0 + 3.0 * v1 - 3.0 * v2 + v3) * t3
      );
    }
    return out;
  }

  function evalCatmullRomTangent3(out, pts, u, closed) {
    const eps = 0.0015;
    const a = [0, 0, 0], b = [0, 0, 0];
    if (closed) {
      let ua = u - eps; if (ua < 0) ua += 1;
      let ub = u + eps; if (ub >= 1) ub -= 1;
      evalCatmullRom3(a, pts, ua, true);
      evalCatmullRom3(b, pts, ub, true);
    } else {
      evalCatmullRom3(a, pts, Math.max(0, u - eps), false);
      evalCatmullRom3(b, pts, Math.min(1, u + eps), false);
    }
    V3.sub(out, b, a);
    return V3.normalize(out, out);
  }

  // Time-keyed Hermite / Catmull-Rom keyframe track: keys = [[t, x, y, z], ...]
  function evalTimedSpline3(out, keys, time) {
    const n = keys.length;
    if (time <= keys[0][0]) {
      out[0] = keys[0][1]; out[1] = keys[0][2]; out[2] = keys[0][3];
      return out;
    }
    if (time >= keys[n - 1][0]) {
      out[0] = keys[n - 1][1]; out[1] = keys[n - 1][2]; out[2] = keys[n - 1][3];
      return out;
    }
    let i = 0;
    while (i < n - 2 && time >= keys[i + 1][0]) i++;
    const k0 = keys[Math.max(0, i - 1)];
    const k1 = keys[i];
    const k2 = keys[i + 1];
    const k3 = keys[Math.min(n - 1, i + 2)];

    const dt = Math.max(1e-5, k2[0] - k1[0]);
    const t = clamp((time - k1[0]) / dt, 0, 1);
    const t2 = t * t, t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const dtPrev = Math.max(1e-5, k2[0] - k0[0]);
    const dtNext = Math.max(1e-5, k3[0] - k1[0]);

    for (let c = 1; c <= 3; c++) {
      const p1 = k1[c], p2 = k2[c];
      const m1 = (k2[c] - k0[c]) / dtPrev * dt;
      const m2 = (k3[c] - k1[c]) / dtNext * dt;
      out[c - 1] = h00 * p1 + h10 * m1 + h01 * p2 + h11 * m2;
    }
    return out;
  }

  SF.Math = {
    createRNG,
    hash3i,
    hash1,
    noise3D,
    fbm3D,
    clamp,
    saturate,
    lerp,
    smoothstep,
    smootherstep,
    V3,
    M4,
    evalCatmullRom3,
    evalCatmullRomTangent3,
    evalTimedSpline3
  };
})(window);
