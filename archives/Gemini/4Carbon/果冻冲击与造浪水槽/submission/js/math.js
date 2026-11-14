(function () {
  const App = (window.App = window.App || {});

  function createRNG(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
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

  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function smootherstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  // Column-major 4x4 matrices for WebGPU (Z clip in [0, 1])
  function mat4Identity(out) {
    out = out || new Float32Array(16);
    out.fill(0);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  }

  function mat4PerspectiveZO(out, fovyRad, aspect, near, far) {
    const f = 1.0 / Math.tan(fovyRad * 0.5);
    const nf = 1.0 / (near - far);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = far * nf;
    out[11] = -1;
    out[14] = near * far * nf;
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

  function mat4LookAt(out, eye, center, up) {
    let zx = eye[0] - center[0];
    let zy = eye[1] - center[1];
    let zz = eye[2] - center[2];
    let len = Math.hypot(zx, zy, zz);
    if (len < 1e-8) {
      zz = 1;
      len = 1;
    }
    zx /= len;
    zy /= len;
    zz /= len;

    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * xx * 0; // fix below
    xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz);
    if (len < 1e-8) {
      xx = 1;
      xy = 0;
      xz = 0;
    } else {
      xx /= len;
      xy /= len;
      xz /= len;
    }

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    out[0] = xx;
    out[1] = yx;
    out[2] = zx;
    out[3] = 0;
    out[4] = xy;
    out[5] = yy;
    out[6] = zy;
    out[7] = 0;
    out[8] = xz;
    out[9] = yz;
    out[10] = zz;
    out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }

  function mat4Multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
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
    if (!det) return mat4Identity(out);
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

  function quatIntegrate(q, wx, wy, wz, dt) {
    // q = [x, y, z, w]
    const hx = 0.5 * wx * dt;
    const hy = 0.5 * wy * dt;
    const hz = 0.5 * wz * dt;
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const nx = qx + (hy * qz - hz * qy + hx * qw);
    const ny = qy + (hz * qx - hx * qz + hy * qw);
    const nz = qz + (hx * qy - hy * qx + hz * qw);
    const nw = qw - (hx * qx + hy * qy + hz * qz);
    const inv = 1.0 / (Math.hypot(nx, ny, nz, nw) || 1.0);
    q[0] = nx * inv;
    q[1] = ny * inv;
    q[2] = nz * inv;
    q[3] = nw * inv;
  }

  function quatSlerp(out, a, b, t) {
    let ax = a[0], ay = a[1], az = a[2], aw = a[3];
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];
    let cosom = ax * bx + ay * by + az * bz + aw * bw;
    if (cosom < 0) {
      cosom = -cosom;
      bx = -bx; by = -by; bz = -bz; bw = -bw;
    }
    let s0, s1;
    if (1.0 - cosom > 1e-5) {
      const omega = Math.acos(clamp(cosom, -1, 1));
      const sinom = Math.sin(omega);
      s0 = Math.sin((1.0 - t) * omega) / sinom;
      s1 = Math.sin(t * omega) / sinom;
    } else {
      s0 = 1.0 - t;
      s1 = t;
    }
    out[0] = s0 * ax + s1 * bx;
    out[1] = s0 * ay + s1 * by;
    out[2] = s0 * az + s1 * bz;
    out[3] = s0 * aw + s1 * bw;
    return out;
  }

  class OrbitCamera {
    constructor() {
      this.target = [0, 0.28, 0];
      this.yaw = 0.22;
      this.pitch = 0.34;
      this.distance = 2.55;
      this.fovDeg = 40;
      this.near = 0.05;
      this.far = 35.0;

      this.eye = [0, 1, 2.5];
      this.up = [0, 1, 0];
      this.view = mat4Identity();
      this.proj = mat4Identity();
      this.viewProj = mat4Identity();
      this.invViewProj = mat4Identity();
      this.invView = mat4Identity();
      this.invProj = mat4Identity();

      this.overridePose = null; // { eye, target, fovDeg }
      this._dragging = 0; // 0 none, 1 orbit, 2 pan
      this._lastX = 0;
      this._lastY = 0;
    }

    setOrbit(yaw, pitch, distance, target, fovDeg = 40) {
      this.overridePose = null;
      this.yaw = yaw;
      this.pitch = clamp(pitch, -0.05, 1.42);
      this.distance = clamp(distance, 0.55, 12.0);
      if (target) {
        this.target[0] = target[0];
        this.target[1] = target[1];
        this.target[2] = target[2];
      }
      this.fovDeg = fovDeg;
    }

    setDirectPose(eye, target, fovDeg = 40) {
      this.overridePose = {
        eye: [eye[0], eye[1], eye[2]],
        target: [target[0], target[1], target[2]],
        fovDeg
      };
    }

    clearOverride() {
      if (this.overridePose) {
        const dx = this.overridePose.eye[0] - this.overridePose.target[0];
        const dy = this.overridePose.eye[1] - this.overridePose.target[1];
        const dz = this.overridePose.eye[2] - this.overridePose.target[2];
        const dist = Math.hypot(dx, dy, dz) || 2.5;
        this.target = [...this.overridePose.target];
        this.distance = clamp(dist, 0.55, 12.0);
        this.pitch = clamp(Math.asin(clamp(dy / dist, -0.99, 0.99)), -0.05, 1.42);
        this.yaw = Math.atan2(dx, dz);
        this.fovDeg = this.overridePose.fovDeg || 40;
        this.overridePose = null;
      }
    }

    updateMatrices(aspect) {
      let fov = this.fovDeg;
      if (this.overridePose) {
        this.eye[0] = this.overridePose.eye[0];
        this.eye[1] = this.overridePose.eye[1];
        this.eye[2] = this.overridePose.eye[2];
        fov = this.overridePose.fovDeg;
        mat4LookAt(this.view, this.eye, this.overridePose.target, this.up);
      } else {
        const cp = Math.cos(this.pitch);
        const sp = Math.sin(this.pitch);
        const sy = Math.sin(this.yaw);
        const cy = Math.cos(this.yaw);
        this.eye[0] = this.target[0] + this.distance * cp * sy;
        this.eye[1] = Math.max(0.06, this.target[1] + this.distance * sp);
        this.eye[2] = this.target[2] + this.distance * cp * cy;
        mat4LookAt(this.view, this.eye, this.target, this.up);
      }
      mat4PerspectiveZO(this.proj, (fov * Math.PI) / 180, Math.max(0.2, aspect), this.near, this.far);
      mat4Multiply(this.viewProj, this.proj, this.view);
      mat4Invert(this.invViewProj, this.viewProj);
      mat4Invert(this.invView, this.view);
      mat4Invert(this.invProj, this.proj);
    }

    attachInput(canvas, onUserInteract) {
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.addEventListener('pointerdown', (e) => {
        if (onUserInteract) onUserInteract(e);
        if (this.overridePose) return;
        this._dragging = e.button === 2 || e.button === 1 || e.shiftKey ? 2 : 1;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!this._dragging || this.overridePose) return;
        const dx = e.clientX - this._lastX;
        const dy = e.clientY - this._lastY;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
        if (this._dragging === 1) {
          this.yaw -= dx * 0.0065;
          this.pitch = clamp(this.pitch + dy * 0.0055, -0.04, 1.42);
        } else {
          const panScale = this.distance * 0.0012;
          const cy = Math.cos(this.yaw);
          const sy = Math.sin(this.yaw);
          this.target[0] -= dx * cy * panScale;
          this.target[2] += dx * sy * panScale;
          this.target[1] = clamp(this.target[1] + dy * panScale, -0.2, 1.8);
        }
      });
      const endDrag = (e) => {
        this._dragging = 0;
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      canvas.addEventListener('pointerup', endDrag);
      canvas.addEventListener('pointercancel', endDrag);
      canvas.addEventListener('wheel', (e) => {
        if (onUserInteract) onUserInteract(e);
        if (this.overridePose) return;
        e.preventDefault();
        const factor = Math.exp(e.deltaY * 0.001);
        this.distance = clamp(this.distance * factor, 0.6, 10.5);
      }, { passive: false });
    }
  }

  App.Math = {
    createRNG,
    clamp,
    lerp,
    smoothstep,
    smootherstep,
    mat4Identity,
    mat4PerspectiveZO,
    mat4OrthoZO,
    mat4LookAt,
    mat4Multiply,
    mat4Invert,
    quatIntegrate,
    quatSlerp,
    OrbitCamera
  };
})();
