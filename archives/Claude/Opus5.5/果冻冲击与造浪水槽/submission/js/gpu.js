'use strict';
// ---------------------------------------------------------------------------
// WebGPU 基础封装（全局 G）
// ---------------------------------------------------------------------------
const G = {
  device: null, queue: null, context: null, format: null, canvas: null, ready: false,
  _shaders: new Map(),

  async init(canvas) {
    if (!navigator.gpu) throw new Error('此浏览器不支持 WebGPU');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('无法获取 WebGPU 适配器');
    const L = adapter.limits;
    const want = {
      maxStorageBufferBindingSize: Math.min(L.maxStorageBufferBindingSize, 1 << 30),
      maxBufferSize: Math.min(L.maxBufferSize, 1 << 30),
      maxStorageBuffersPerShaderStage: Math.min(L.maxStorageBuffersPerShaderStage, 12),
      maxComputeWorkgroupStorageSize: L.maxComputeWorkgroupStorageSize,
      maxComputeInvocationsPerWorkgroup: Math.min(L.maxComputeInvocationsPerWorkgroup, 256),
      maxComputeWorkgroupSizeX: Math.min(L.maxComputeWorkgroupSizeX, 256),
      maxTextureDimension2D: Math.min(L.maxTextureDimension2D, 8192),
    };
    const features = [];
    if (adapter.features.has('float32-filterable')) features.push('float32-filterable');
    if (adapter.features.has('float32-blendable')) features.push('float32-blendable');
    this.device = await adapter.requestDevice({ requiredLimits: want, requiredFeatures: features });
    this.device.lost.then((info) => { console.error('GPU device lost', info.message); });
    this.device.onuncapturederror = (e) => { console.error('WebGPU error:', e.error && e.error.message); };
    this.queue = this.device.queue;
    this.canvas = canvas;
    this.context = canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });
    this.ready = true;
  },

  buffer(size, usage, data) {
    if (data) size = Math.max(size, data.byteLength);
    size = Math.max(16, Math.ceil(size / 4) * 4);
    const b = this.device.createBuffer({ size, usage: usage | GPUBufferUsage.COPY_DST, mappedAtCreation: !!data });
    if (data) {
      const src = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      new Uint8Array(b.getMappedRange()).set(src.subarray(0, Math.min(src.length, size)));
      b.unmap();
    }
    return b;
  },
  ubo(size) { return this.buffer(Math.ceil(size / 16) * 16, GPUBufferUsage.UNIFORM); },
  sto(size, extra = 0, data) { return this.buffer(size, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | extra, data); },
  vbo(data) { return this.buffer(data.byteLength, GPUBufferUsage.VERTEX, data); },
  ibo(data) { return this.buffer(data.byteLength, GPUBufferUsage.INDEX, data); },
  write(buf, data, offset = 0) { this.queue.writeBuffer(buf, offset, data.buffer || data, data.byteOffset || 0, data.byteLength); },

  shader(code, label) {
    let m = this._shaders.get(code);
    if (!m) {
      m = this.device.createShaderModule({ code, label });
      m.getCompilationInfo().then((info) => {
        for (const msg of info.messages) {
          if (msg.type === 'error') {
            const lines = code.split('\n');
            console.error(`[WGSL ${label || ''}] ${msg.message} @${msg.lineNum}:${msg.linePos}\n` + (lines[msg.lineNum - 1] || ''));
          }
        }
      });
      this._shaders.set(code, m);
    }
    return m;
  },

  // 绑定组布局简写：[{t:'ubo'|'sto'|'rsto'|'tex'|'utex'|'dtex'|'samp'|'csamp'|'stex', v:'vfc'}]
  bgl(spec) {
    const entries = spec.map((s, i) => {
      let vis = 0;
      const v = s.v || 'vfc';
      if (v.includes('v')) vis |= GPUShaderStage.VERTEX;
      if (v.includes('f')) vis |= GPUShaderStage.FRAGMENT;
      if (v.includes('c')) vis |= GPUShaderStage.COMPUTE;
      const e = { binding: s.b !== undefined ? s.b : i, visibility: vis };
      switch (s.t) {
        case 'ubo': e.buffer = { type: 'uniform' }; break;
        case 'sto': e.buffer = { type: 'storage' }; break;
        case 'rsto': e.buffer = { type: 'read-only-storage' }; break;
        case 'tex': e.texture = { sampleType: 'float', viewDimension: s.dim || '2d' }; break;
        case 'utex': e.texture = { sampleType: 'unfilterable-float', viewDimension: s.dim || '2d' }; break;
        case 'dtex': e.texture = { sampleType: 'depth' }; break;
        case 'samp': e.sampler = { type: 'filtering' }; break;
        case 'csamp': e.sampler = { type: 'comparison' }; break;
        case 'stex': e.storageTexture = { access: 'write-only', format: s.format, viewDimension: s.dim || '2d' }; break;
      }
      return e;
    });
    return this.device.createBindGroupLayout({ entries });
  },
  bg(layout, resources) {
    const entries = resources.map((r, i) => {
      let resource = r;
      if (r instanceof GPUBuffer) resource = { buffer: r };
      else if (r instanceof GPUTexture) resource = r.createView();
      return { binding: i, resource };
    });
    return this.device.createBindGroup({ layout, entries });
  },

  renderPipe(o) {
    const mod = this.shader(o.code, o.label);
    const desc = {
      label: o.label,
      layout: this.device.createPipelineLayout({ bindGroupLayouts: o.layouts }),
      vertex: { module: mod, entryPoint: o.vs || 'vs', buffers: o.buffers || [] },
      primitive: { topology: o.topology || 'triangle-list', cullMode: o.cull || 'none', frontFace: 'ccw' },
    };
    if (o.fs !== null) {
      desc.fragment = {
        module: mod, entryPoint: o.fs || 'fs',
        targets: (o.targets || [{ format: 'rgba16float' }]).map((t) => {
          const r = { format: t.format };
          if (t.blend) r.blend = t.blend;
          if (t.mask !== undefined) r.writeMask = t.mask;
          return r;
        }),
      };
    }
    if (o.depth) {
      desc.depthStencil = {
        format: o.depth.format || 'depth32float',
        depthWriteEnabled: o.depth.write !== false,
        depthCompare: o.depth.compare || 'less',
        depthBias: o.depth.bias || 0, depthBiasSlopeScale: o.depth.slope || 0,
      };
    }
    return this.device.createRenderPipeline(desc);
  },
  computePipe(code, entry, layouts, label) {
    return this.device.createComputePipeline({
      label: label || entry,
      layout: this.device.createPipelineLayout({ bindGroupLayouts: layouts }),
      compute: { module: this.shader(code, label || entry), entryPoint: entry },
    });
  },
  tex(w, h, format, usage, label) {
    return this.device.createTexture({ size: [Math.max(1, w), Math.max(1, h)], format, usage, label });
  },
};

const BLEND_ADD = { color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } };
const BLEND_ALPHA = { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
const BLEND_PREMUL = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
