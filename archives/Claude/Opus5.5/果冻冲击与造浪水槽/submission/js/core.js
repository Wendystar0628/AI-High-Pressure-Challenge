// 基础层：向量/矩阵、WebGPU 设备与通用工具、轨道相机
'use strict';

const M4 = {
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, far * nf, -1, 0, 0, far * near * nf, 0]);
  },
  ortho(l, r, b, t, n, f) {
    return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, 1 / (n - f), 0,
      (l + r) / (l - r), (t + b) / (b - t), n / (n - f), 1]);
  },
  lookAt(e, c, up) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  invert(m) {
    const a = m, o = new Float32Array(16);
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4];
    const b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
    const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12];
    const b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    det = 1 / det;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det;
    o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det;
    o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det;
    o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det;
    o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det;
    o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det;
    o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det;
    o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det;
    o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det;
    o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det;
    o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det;
    o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det;
    o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
    return o;
  },
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// 轨道相机：交互时由鼠标控制；导出时由各场景的演示镜头驱动
class OrbitCamera {
  constructor() {
    this.yaw = 0; this.pitch = 0.2; this.dist = 5; this.target = [0, 0.5, 0]; this.fov = 30 * Math.PI / 180;
    this.def = null;
  }
  setDefault(o) { this.def = Object.assign({}, o); Object.assign(this, JSON.parse(JSON.stringify(o))); }
  restore() { if (this.def) Object.assign(this, JSON.parse(JSON.stringify(this.def))); }
  eye() {
    const c = Math.cos(this.pitch);
    return [this.target[0] + this.dist * Math.sin(this.yaw) * c,
      this.target[1] + this.dist * Math.sin(this.pitch),
      this.target[2] + this.dist * Math.cos(this.yaw) * c];
  }
  matrices(aspect) {
    const eye = this.eye();
    const view = M4.lookAt(eye, this.target, [0, 1, 0]);
    const proj = M4.perspective(this.fov, aspect, 0.05, 80);
    const vp = M4.mul(proj, view);
    return { eye, view, proj, vp, ivp: M4.invert(vp) };
  }
}

// WebGPU 设备与工具
const GX = {
  device: null, queue: null, ctx: null, format: null, canvas: null,
  async init(canvas) {
    if (!navigator.gpu) throw new Error('当前浏览器不支持 WebGPU');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('未找到可用的 WebGPU 适配器');
    const features = [];
    for (const f of ['float32-filterable', 'float32-blendable', 'timestamp-query']) if (adapter.features.has(f)) features.push(f);
    const lim = adapter.limits;
    const device = await adapter.requestDevice({
      requiredFeatures: features,
      requiredLimits: {
        maxStorageBuffersPerShaderStage: Math.min(16, lim.maxStorageBuffersPerShaderStage),
        maxStorageBufferBindingSize: lim.maxStorageBufferBindingSize,
        maxBufferSize: lim.maxBufferSize,
        maxColorAttachmentBytesPerSample: lim.maxColorAttachmentBytesPerSample,
        maxStorageTexturesPerShaderStage: Math.min(8, lim.maxStorageTexturesPerShaderStage),
        maxTextureDimension2D: lim.maxTextureDimension2D,
      },
    });
    device.lost.then((info) => {
      console.error('GPU 设备丢失：', info.message);
      const el = document.getElementById('fatal');
      if (el) { el.textContent = 'GPU 设备丢失，请刷新页面。' + info.message; el.style.display = 'block'; }
    });
    device.onuncapturederror = (e) => console.error('[WebGPU]', e.error.message);
    this.device = device; this.queue = device.queue; this.canvas = canvas;
    this.ctx = canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.ctx.configure({ device, format: this.format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    this.linear = device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge' });
    this.nearest = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
  },
  module(code, label) {
    const m = this.device.createShaderModule({ code, label });
    m.getCompilationInfo().then((info) => {
      for (const msg of info.messages) {
        if (msg.type === 'error') {
          const lines = code.split('\n');
          console.error(`[WGSL ${label}] L${msg.lineNum}:${msg.linePos} ${msg.message}\n> ${lines[msg.lineNum - 1]}`);
        }
      }
    });
    return m;
  },
  buffer(size, usage, label) {
    return this.device.createBuffer({ size: Math.max(16, (size + 15) & ~15), usage, label });
  },
  storage(size, label, extra = 0) {
    return this.buffer(size, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | extra, label);
  },
  uniform(size, label) {
    return this.buffer(size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, label);
  },
  texture(w, h, format, usage, opts = {}) {
    return this.device.createTexture(Object.assign({ size: [w, h], format, usage }, opts));
  },
};
