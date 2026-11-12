// math3d.js — 向量 / 矩阵 / 相机辅助（列主序 mat4，与 WebGPU clip 空间一致）
(function (global) {
  'use strict';

  const M = {};

  M.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.smoothstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  M.smootherstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10));
  M.rad = (deg) => (deg * Math.PI) / 180;

  // ---------- vec3 ----------
  M.v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
  M.v3set = (o, x, y, z) => { o.x = x; o.y = y; o.z = z; return o; };
  M.v3copy = (o, a) => { o.x = a.x; o.y = a.y; o.z = a.z; return o; };
  M.v3add = (o, a, b) => { o.x = a.x + b.x; o.y = a.y + b.y; o.z = a.z + b.z; return o; };
  M.v3sub = (o, a, b) => { o.x = a.x - b.x; o.y = a.y - b.y; o.z = a.z - b.z; return o; };
  M.v3scale = (o, a, s) => { o.x = a.x * s; o.y = a.y * s; o.z = a.z * s; return o; };
  M.v3addScaled = (o, a, b, s) => { o.x = a.x + b.x * s; o.y = a.y + b.y * s; o.z = a.z + b.z * s; return o; };
  M.v3dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  M.v3cross = (o, a, b) => {
    const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x;
    o.x = x; o.y = y; o.z = z; return o;
  };
  M.v3len = (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  M.v3lenSq = (a) => a.x * a.x + a.y * a.y + a.z * a.z;
  M.v3dist = (a, b) => {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  M.v3norm = (o, a) => {
    const l = M.v3len(a) || 1;
    o.x = a.x / l; o.y = a.y / l; o.z = a.z / l; return o;
  };
  M.v3lerp = (o, a, b, t) => {
    o.x = a.x + (b.x - a.x) * t;
    o.y = a.y + (b.y - a.y) * t;
    o.z = a.z + (b.z - a.z) * t;
    return o;
  };

  // ---------- mat4 (column-major Float32Array(16)) ----------
  M.mat4 = () => {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  };
  M.mat4Identity = (m) => {
    m.fill(0);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  };
  M.mat4Copy = (o, a) => { o.set(a); return o; };
  M.mat4Mul = (o, a, b) => {
    const r = M._tmpM || (M._tmpM = new Float32Array(16));
    for (let c = 0; c < 4; c++) {
      for (let r0 = 0; r0 < 4; r0++) {
        r[c * 4 + r0] =
          a[0 * 4 + r0] * b[c * 4 + 0] +
          a[1 * 4 + r0] * b[c * 4 + 1] +
          a[2 * 4 + r0] * b[c * 4 + 2] +
          a[3 * 4 + r0] * b[c * 4 + 3];
      }
    }
    o.set(r);
    return o;
  };

  M.mat4Perspective = (o, fovY, aspect, near, far) => {
    const f = 1 / Math.tan(fovY / 2);
    o.fill(0);
    o[0] = f / aspect;
    o[5] = f;
    o[10] = far / (near - far);
    o[11] = -1;
    o[14] = (far * near) / (near - far);
    return o;
  };

  M.mat4LookAt = (o, eye, target, up) => {
    const zx = eye.x - target.x, zy = eye.y - target.y, zz = eye.z - target.z;
    let zl = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
    const z0 = zx / zl, z1 = zy / zl, z2 = zz / zl;
    let x0 = up.y * z2 - up.z * z1, x1 = up.z * z0 - up.x * z2, x2 = up.x * z1 - up.y * z0;
    let xl = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2) || 1;
    x0 /= xl; x1 /= xl; x2 /= xl;
    const y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
    o[0] = x0; o[1] = y0; o[2] = z0; o[3] = 0;
    o[4] = x1; o[5] = y1; o[6] = z1; o[7] = 0;
    o[8] = x2; o[9] = y2; o[10] = z2; o[11] = 0;
    o[12] = -(x0 * eye.x + x1 * eye.y + x2 * eye.z);
    o[13] = -(y0 * eye.x + y1 * eye.y + y2 * eye.z);
    o[14] = -(z0 * eye.x + z1 * eye.y + z2 * eye.z);
    o[15] = 1;
    return o;
  };

  M.mat4Ortho = (o, l, r, b, t, n, f) => {
    o.fill(0);
    o[0] = 2 / (r - l);
    o[5] = 2 / (t - b);
    o[10] = 1 / (n - f);
    o[12] = -(r + l) / (r - l);
    o[13] = -(t + b) / (t - b);
    o[14] = n / (n - f);
    o[15] = 1;
    return o;
  };

  M.mat4Translate = (o, x, y, z) => {
    M.mat4Identity(o);
    o[12] = x; o[13] = y; o[14] = z;
    return o;
  };

  M.mat4Scale = (o, x, y, z) => {
    M.mat4Identity(o);
    o[0] = x; o[5] = y; o[10] = z;
    return o;
  };

  M.mat4RotateY = (o, a) => {
    M.mat4Identity(o);
    const c = Math.cos(a), s = Math.sin(a);
    o[0] = c; o[2] = -s; o[8] = s; o[10] = c;
    return o;
  };

  M.mat4RotateX = (o, a) => {
    M.mat4Identity(o);
    const c = Math.cos(a), s = Math.sin(a);
    o[5] = c; o[6] = s; o[9] = -s; o[10] = c;
    return o;
  };

  M.mat4RotateZ = (o, a) => {
    M.mat4Identity(o);
    const c = Math.cos(a), s = Math.sin(a);
    o[0] = c; o[1] = s; o[4] = -s; o[5] = c;
    return o;
  };

  // ---------- 轨道相机 ----------
  class OrbitCamera {
    constructor() {
      this.target = { x: 0, y: 1.2, z: 0 };
      this.dist = 12;
      this.yaw = 0.6;
      this.pitch = 0.35;
      this.fov = M.rad(42);
      this.near = 0.08;
      this.far = 120;
      this.view = M.mat4();
      this.proj = M.mat4();
      this.viewProj = M.mat4();
      this.invView = M.mat4();
      this._eye = { x: 0, y: 0, z: 0 };
      this._up = { x: 0, y: 1, z: 0 };
      this._tmpT = { x: 0, y: 0, z: 0 };
    }

    setPose(target, dist, yaw, pitch, fovDeg) {
      this.target.x = target.x; this.target.y = target.y; this.target.z = target.z;
      if (dist != null) this.dist = dist;
      if (yaw != null) this.yaw = yaw;
      if (pitch != null) this.pitch = pitch;
      if (fovDeg != null) this.fov = M.rad(fovDeg);
    }

    eye() {
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      this._eye.x = this.target.x + this.dist * cp * sy;
      this._eye.y = this.target.y + this.dist * sp;
      this._eye.z = this.target.z + this.dist * cp * cy;
      return this._eye;
    }

    update(aspect) {
      const e = this.eye();
      M.mat4LookAt(this.view, e, this.target, this._up);
      M.mat4Perspective(this.proj, this.fov, aspect, this.near, this.far);
      M.mat4Mul(this.viewProj, this.proj, this.view);
      return this.viewProj;
    }

    orbit(dx, dy) {
      this.yaw -= dx * 0.0052;
      this.pitch += dy * 0.0042;
      this.pitch = M.clamp(this.pitch, -1.35, 1.45);
    }

    pan(dx, dy) {
      const e = this.eye();
      // 相机右/上方向
      const fx = this.target.x - e.x, fy = this.target.y - e.y, fz = this.target.z - e.z;
      const fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
      const rx = fz / fl, rz = -fx / fl; // 简化右向（忽略俯仰对右向的影响）
      const rl = Math.sqrt(rx * rx + rz * rz) || 1;
      const s = this.dist * 0.0013;
      this.target.x -= (rx / rl) * dx * s;
      this.target.z -= (rz / rl) * dx * s;
      this.target.y += dy * s * 0.85;
    }

    zoom(delta) {
      this.dist *= Math.exp(delta * 0.0011);
      this.dist = M.clamp(this.dist, 3, 60);
    }
  }

  // ---------- 颜色 ----------
  M.rgb = (r, g, b) => ({ r: r / 255, g: g / 255, b: b / 255 });
  M.hexRgb = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
  };

  M.OrbitCamera = OrbitCamera;

  global.M3 = M;
})(window);
