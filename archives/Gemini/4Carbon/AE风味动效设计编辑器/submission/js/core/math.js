/**
 * Forge Studio — Core Math, Deterministic PRNG, Coherent Noise & 3D Matrix Library
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});

  const EPS = 1e-6;
  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(edge0, edge1, x) {
    if (Math.abs(edge1 - edge0) < EPS) return x >= edge1 ? 1 : 0;
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // FNV-1a string hash for deterministic seeding and cache signatures
  function hashString(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function hashCombine(h1, h2) {
    let h = (h1 >>> 0) ^ ((h2 >>> 0) + 0x9e3779b9 + ((h1 << 6) >>> 0) + (h1 >>> 2));
    return h >>> 0;
  }

  // Pure deterministic stateless/stateful PRNG (Mulberry32)
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashFloat(seed) {
    let a = (seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Deterministic 1D & 3D Gradient Noise (for wiggle() and 3D Noise/Curl Spatial Fields)
  function grad1D(i, seed) {
    return hashFloat(hashCombine(i | 0, seed | 0)) * 2 - 1;
  }

  function noise1D(x, seed = 1337) {
    const xi = Math.floor(x);
    const xf = x - xi;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const g0 = grad1D(xi, seed) * xf;
    const g1 = grad1D(xi + 1, seed) * (xf - 1);
    return lerp(g0, g1, u) * 2.0; // normalized roughly [-1, 1]
  }

  function fbm1D(x, octaves = 2, ampMult = 0.5, seed = 1337) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    const oct = clamp(Math.floor(octaves) || 1, 1, 8);
    for (let i = 0; i < oct; i++) {
      sum += noise1D(x * freq, seed + i * 7919) * amp;
      norm += amp;
      amp *= ampMult;
      freq *= 2.0;
    }
    return norm > 0 ? sum / norm : 0;
  }

  function hash3i(ix, iy, iz, seed) {
    let h = seed >>> 0;
    h = hashCombine(h, Math.imul(ix | 0, 73856093));
    h = hashCombine(h, Math.imul(iy | 0, 19349663));
    h = hashCombine(h, Math.imul(iz | 0, 83492791));
    return h >>> 0;
  }

  function noise3D(x, y, z, seed = 42) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const uz = fz * fz * (3 - 2 * fz);

    const n000 = hashFloat(hash3i(ix, iy, iz, seed)) * 2 - 1;
    const n100 = hashFloat(hash3i(ix + 1, iy, iz, seed)) * 2 - 1;
    const n010 = hashFloat(hash3i(ix, iy + 1, iz, seed)) * 2 - 1;
    const n110 = hashFloat(hash3i(ix + 1, iy + 1, iz, seed)) * 2 - 1;
    const n001 = hashFloat(hash3i(ix, iy, iz + 1, seed)) * 2 - 1;
    const n101 = hashFloat(hash3i(ix + 1, iy, iz + 1, seed)) * 2 - 1;
    const n011 = hashFloat(hash3i(ix, iy + 1, iz + 1, seed)) * 2 - 1;
    const n111 = hashFloat(hash3i(ix + 1, iy + 1, iz + 1, seed)) * 2 - 1;

    const nx00 = lerp(n000, n100, ux);
    const nx10 = lerp(n010, n110, ux);
    const nx01 = lerp(n001, n101, ux);
    const nx11 = lerp(n011, n111, ux);
    const nxy0 = lerp(nx00, nx10, uy);
    const nxy1 = lerp(nx01, nx11, uy);
    return lerp(nxy0, nxy1, uz);
  }

  function fbm3DVec(x, y, z, octaves = 2, seed = 42) {
    let vx = 0, vy = 0, vz = 0;
    let amp = 1, freq = 1, norm = 0;
    const oct = clamp(Math.floor(octaves) || 1, 1, 5);
    for (let i = 0; i < oct; i++) {
      const s = seed + i * 1013;
      vx += noise3D(x * freq, y * freq, z * freq, s) * amp;
      vy += noise3D(x * freq + 31.7, y * freq + 17.3, z * freq + 53.1, s + 17) * amp;
      vz += noise3D(x * freq + 71.9, y * freq + 89.2, z * freq + 11.4, s + 43) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.02;
    }
    const inv = norm > 0 ? 1 / norm : 1;
    return [vx * inv, vy * inv, vz * inv];
  }

  // Vec2 & Vec3 helpers (plain arrays [x, y] and [x, y, z] for speed & JSON friendliness)
  const Vec2 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
    scale: (a, s) => [a[0] * s, a[1] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1],
    cross: (a, b) => a[0] * b[1] - a[1] * b[0],
    len: (a) => Math.hypot(a[0], a[1]),
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]),
    lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)],
    norm: (a) => {
      const l = Math.hypot(a[0], a[1]);
      return l > 1e-8 ? [a[0] / l, a[1] / l] : [0, 0];
    },
    perp: (a) => [-a[1], a[0]],
    rot: (a, rad) => {
      const c = Math.cos(rad), s = Math.sin(rad);
      return [a[0] * c - a[1] * s, a[0] * s + a[1] * c];
    }
  };

  const Vec3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    addScaled: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    lenSq: (a) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2],
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
    lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
    norm: (a) => {
      const l = Math.hypot(a[0], a[1], a[2]);
      return l > 1e-8 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1];
    }
  };

  // Column-major 4x4 Float32Array matrices (WebGL native convention)
  const Mat4 = {
    identity() {
      const m = new Float32Array(16);
      m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
      return m;
    },
    clone(a) {
      return new Float32Array(a);
    },
    multiply(a, b, out = new Float32Array(16)) {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

      for (let c = 0; c < 4; c++) {
        const i = c * 4;
        const b0 = b[i], b1 = b[i + 1], b2 = b[i + 2], b3 = b[i + 3];
        out[i]     = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[i + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[i + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[i + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      }
      return out;
    },
    fromTranslation(tx, ty, tz, out = new Float32Array(16)) {
      out.fill(0);
      out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
      out[12] = tx; out[13] = ty; out[14] = tz;
      return out;
    },
    fromScale(sx, sy, sz, out = new Float32Array(16)) {
      out.fill(0);
      out[0] = sx; out[5] = sy; out[10] = sz; out[15] = 1;
      return out;
    },
    // Intrinsic Z * Y * X rotation (in degrees), matching AE 3D rotation order cleanly
    fromEulerDeg(rxDeg, ryDeg, rzDeg, out = new Float32Array(16)) {
      const rx = rxDeg * DEG2RAD, ry = ryDeg * DEG2RAD, rz = rzDeg * DEG2RAD;
      const cx = Math.cos(rx), sx = Math.sin(rx);
      const cy = Math.cos(ry), sy = Math.sin(ry);
      const cz = Math.cos(rz), sz = Math.sin(rz);

      // R = Rz * Ry * Rx
      out[0] = cz * cy;
      out[1] = sz * cy;
      out[2] = -sy;
      out[3] = 0;

      out[4] = cz * sy * sx - sz * cx;
      out[5] = sz * sy * sx + cz * cx;
      out[6] = cy * sx;
      out[7] = 0;

      out[8] = cz * sy * cx + sz * sx;
      out[9] = sz * sy * cx - cz * sx;
      out[10] = cy * cx;
      out[11] = 0;

      out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
      return out;
    },
    // AE Layer Transform: Translate(pos) * RotateZYX(rot) * Scale(scale/100) * Translate(-anchor)
    fromLayerTransform(pos, rotDeg, scalePct, anchor, out = new Float32Array(16)) {
      const tPos = Mat4.fromTranslation(pos[0] || 0, pos[1] || 0, pos[2] || 0);
      const rMat = Mat4.fromEulerDeg(rotDeg[0] || 0, rotDeg[1] || 0, rotDeg[2] || 0);
      const sMat = Mat4.fromScale(
        (scalePct[0] ?? 100) / 100,
        (scalePct[1] ?? 100) / 100,
        (scalePct[2] ?? 100) / 100
      );
      const tAnc = Mat4.fromTranslation(-(anchor[0] || 0), -(anchor[1] || 0), -(anchor[2] || 0));
      const rs = Mat4.multiply(rMat, sMat);
      const trs = Mat4.multiply(tPos, rs);
      return Mat4.multiply(trs, tAnc, out);
    },
    // Decompose M_local = Translate(pos) * Rz*Ry*Rx * Scale(s) * Translate(-anchor) given known anchor
    decomposeLayerTransform(m, anchor = [0, 0, 0]) {
      // If M = T(pos) * R * S * T(-anchor), then M * [anchor, 1] = T(pos) * R * S * [0,0,0,1] = [pos, 1]!
      const pos = Mat4.transformPoint(m, anchor);

      // Upper-left 3x3 of M is R * S
      let c0 = [m[0], m[1], m[2]];
      let c1 = [m[4], m[5], m[6]];
      let c2 = [m[8], m[9], m[10]];

      let sx = Vec3.len(c0);
      let sy = Vec3.len(c1);
      let sz = Vec3.len(c2);

      // Handle negative determinant (reflection)
      const det = Vec3.dot(c0, Vec3.cross(c1, c2));
      if (det < 0) sx = -sx;

      const r0 = Math.abs(sx) > 1e-7 ? Vec3.scale(c0, 1 / sx) : [1, 0, 0];
      const r1 = Math.abs(sy) > 1e-7 ? Vec3.scale(c1, 1 / sy) : [0, 1, 0];
      const r2 = Math.abs(sz) > 1e-7 ? Vec3.scale(c2, 1 / sz) : [0, 0, 1];

      // R = Rz * Ry * Rx => r0[2] = -sin(ry)
      const syVal = clamp(-r0[2], -1, 1);
      const ry = Math.asin(syVal);
      let rx = 0, rz = 0;
      if (Math.cos(ry) > 1e-5) {
        rx = Math.atan2(r1[2], r2[2]);
        rz = Math.atan2(r0[1], r0[0]);
      } else {
        rx = Math.atan2(-r2[1], r1[1]);
        rz = 0;
      }

      return {
        position: pos,
        rotation: [rx * RAD2DEG, ry * RAD2DEG, rz * RAD2DEG],
        scale: [sx * 100, sy * 100, sz * 100]
      };
    },
    invert(a, out = new Float32Array(16)) {
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
      if (Math.abs(det) < 1e-12) {
        return Mat4.identity();
      }
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
    transpose(a, out = new Float32Array(16)) {
      const t = a === out ? new Float32Array(a) : a;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          out[c * 4 + r] = t[r * 4 + c];
        }
      }
      return out;
    },
    // AE coordinate convention: +X right, +Y down (comp space), -Z forward into screen / +Z away or towards camera.
    // Let's use clean AE-compatible right-handed/comp-aligned 3D camera where default camera for comp (W, H)
    // is at (W/2, H/2, -camDist) looking at (W/2, H/2, 0) with up = (0, -1, 0), so a 3D layer at (W/2, H/2, 0)
    // aligns 1:1 pixel-exact with a 2D layer at (W/2, H/2)!
    lookAtAE(eye, target, up = [0, -1, 0], out = new Float32Array(16)) {
      // Standard right-handed OpenGL camera looks down -Z_cam, with +Y_cam = screen up (which is -Y_world in AE!).
      let zAxis = Vec3.sub(eye, target); // points from target toward camera (+Z_cam)
      if (Vec3.lenSq(zAxis) < 1e-10) zAxis = [0, 0, -1];
      zAxis = Vec3.norm(zAxis);

      let xAxis = Vec3.cross(up, zAxis);
      if (Vec3.lenSq(xAxis) < 1e-8) {
        xAxis = Vec3.cross([0, 0, 1], zAxis);
        if (Vec3.lenSq(xAxis) < 1e-8) xAxis = [1, 0, 0];
      }
      xAxis = Vec3.norm(xAxis);
      const yAxis = Vec3.cross(zAxis, xAxis);

      out[0] = xAxis[0]; out[4] = xAxis[1]; out[8] = xAxis[2];   out[12] = -Vec3.dot(xAxis, eye);
      out[1] = yAxis[0]; out[5] = yAxis[1]; out[9] = yAxis[2];   out[13] = -Vec3.dot(yAxis, eye);
      out[2] = zAxis[0]; out[6] = zAxis[1]; out[10] = zAxis[2];  out[14] = -Vec3.dot(zAxis, eye);
      out[3] = 0;        out[7] = 0;        out[11] = 0;         out[15] = 1;
      return out;
    },
    perspective(fovYDeg, aspect, near, far, out = new Float32Array(16)) {
      const f = 1.0 / Math.tan(clamp(fovYDeg, 2, 170) * 0.5 * DEG2RAD);
      const nf = 1.0 / (near - far);
      out.fill(0);
      out[0] = f / Math.max(aspect, 1e-4);
      out[5] = f;
      out[10] = (far + near) * nf;
      out[11] = -1;
      out[14] = 2 * far * near * nf;
      return out;
    },
    ortho(left, right, bottom, top, near, far, out = new Float32Array(16)) {
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
    transformPoint(m, p) {
      const x = p[0] || 0, y = p[1] || 0, z = p[2] || 0;
      const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1.0;
      return [
        (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
        (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
        (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
      ];
    },
    transformDir(m, d) {
      const x = d[0] || 0, y = d[1] || 0, z = d[2] || 0;
      return [
        m[0] * x + m[4] * y + m[8] * z,
        m[1] * x + m[5] * y + m[9] * z,
        m[2] * x + m[6] * y + m[10] * z
      ];
    },
    // Project 3D world point to composition 2D pixel coordinates [x, y, ndcZ, clipW]
    projectToComp(viewProj, worldPt, compW, compH) {
      const x = worldPt[0], y = worldPt[1], z = worldPt[2] || 0;
      const cx = viewProj[0] * x + viewProj[4] * y + viewProj[8] * z + viewProj[12];
      const cy = viewProj[1] * x + viewProj[5] * y + viewProj[9] * z + viewProj[13];
      const cz = viewProj[2] * x + viewProj[6] * y + viewProj[10] * z + viewProj[14];
      const cw = viewProj[3] * x + viewProj[7] * y + viewProj[11] * z + viewProj[15];
      if (cw <= 1e-5) return null;
      const ndcX = cx / cw;
      const ndcY = cy / cw;
      const ndcZ = cz / cw;
      return [
        (ndcX * 0.5 + 0.5) * compW,
        (0.5 - ndcY * 0.5) * compH,
        ndcZ,
        cw
      ];
    },
    // Unproject composition 2D pixel coordinate (compX, compY) into a 3D world ray { origin, dir }
    unprojectRay(invViewProj, compX, compY, compW, compH) {
      const ndcX = (compX / compW) * 2 - 1;
      const ndcY = 1 - (compY / compH) * 2;
      const nearPt = Mat4.transformPoint(invViewProj, [ndcX, ndcY, -1]);
      const farPt = Mat4.transformPoint(invViewProj, [ndcX, ndcY, 1]);
      return {
        origin: nearPt,
        dir: Vec3.norm(Vec3.sub(farPt, nearPt))
      };
    }
  };

  // Color utilities (hex <-> [r,g,b] in 0..1, HSL <-> RGB)
  function hexToRgb(hex) {
    if (Array.isArray(hex)) return [hex[0], hex[1], hex[2]];
    let s = String(hex || '#ffffff').trim().replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s, 16);
    if (Number.isNaN(n)) return [1, 1, 1];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function rgbToHex(rgb) {
    if (typeof rgb === 'string') return rgb;
    const r = clamp(Math.round((rgb[0] ?? 1) * 255), 0, 255);
    const g = clamp(Math.round((rgb[1] ?? 1) * 255), 0, 255);
    const b = clamp(Math.round((rgb[2] ?? 1) * 255), 0, 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function rgbToCss(rgb, alpha = 1) {
    const c = Array.isArray(rgb) ? rgb : hexToRgb(rgb);
    return `rgba(${Math.round(clamp(c[0], 0, 1) * 255)}, ${Math.round(clamp(c[1], 0, 1) * 255)}, ${Math.round(clamp(c[2], 0, 1) * 255)}, ${clamp(alpha, 0, 1)})`;
  }

  let _uidCounter = 1;
  function uid(prefix = 'id') {
    return `${prefix}_${(_uidCounter++).toString(36)}`;
  }

  function syncUidCounter(n) {
    if (n >= _uidCounter) _uidCounter = n + 1;
  }

  Forge.Math = {
    EPS,
    DEG2RAD,
    RAD2DEG,
    clamp,
    lerp,
    smoothstep,
    hashString,
    hashCombine,
    mulberry32,
    hashFloat,
    noise1D,
    fbm1D,
    noise3D,
    fbm3DVec,
    Vec2,
    Vec3,
    Mat4,
    hexToRgb,
    rgbToHex,
    rgbToCss,
    uid,
    syncUidCounter
  };
})();
