/* WebGPU 初始化与通用资源辅助（经典脚本，window.GPU） */
(function () {
  'use strict';
  const G = {
    device: null, adapter: null, format: null, context: null, canvas: null,
    queue: null,
  };

  G.init = async function (canvas) {
    if (!navigator.gpu) throw new Error('此浏览器不支持 WebGPU');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('无法获取 WebGPU 适配器');
    const device = await adapter.requestDevice();
    G.adapter = adapter; G.device = device; G.queue = device.queue;
    G.canvas = canvas;
    G.format = navigator.gpu.getPreferredCanvasFormat();
    G.context = canvas.getContext('webgpu');
    G.context.configure({ device, format: G.format, alphaMode: 'opaque' });
    device.lost.then((info) => { console.error('WebGPU device lost:', info.message); });
    return device;
  };

  const S = GPUShaderStage;

  G.buffer = function (data, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST) {
    const d = (data instanceof Float32Array || data instanceof Uint32Array || data instanceof Int32Array || data instanceof Uint16Array)
      ? data : new Float32Array(data);
    const buf = G.device.createBuffer({
      size: Math.max(16, Math.ceil(d.byteLength / 4) * 4),
      usage, mappedAtCreation: true,
    });
    const Ctor = d.constructor;
    new Ctor(buf.getMappedRange()).set(d);
    buf.unmap();
    return buf;
  };

  G.emptyBuffer = function (byteLength, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST) {
    return G.device.createBuffer({ size: Math.max(16, Math.ceil(byteLength / 4) * 4), usage });
  };

  G.tex3D = function (w, h, d, extraUsage = 0, format = 'rgba16float') {
    return G.device.createTexture({
      size: [w, h, d], dimension: '3d', format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | extraUsage,
    });
  };

  G.compute = function (code, entry = 'main') {
    return G.device.createComputePipeline({
      layout: 'auto',
      compute: { module: G.device.createShaderModule({ code }), entryPoint: entry },
    });
  };

  G.render = function (vsCode, fsCode, format = G.format, opts = {}) {
    const target = { format };
    if (opts.blend) target.blend = opts.blend;
    return G.device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: G.device.createShaderModule({ code: vsCode }), entryPoint: 'vs' },
      fragment: {
        module: G.device.createShaderModule({ code: fsCode }), entryPoint: 'fs',
        targets: [target],
      },
      primitive: { topology: 'triangle-list' },
    });
  };

  G.bind = function (pipeline, entries, index = 0) {
    return G.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(index),
      entries: entries.map((e, i) => ({ binding: i, resource: e })),
    });
  };

  G.write = function (buf, data, offset = 0) {
    G.queue.writeBuffer(buf, offset, data.buffer ? data : new Float32Array(data), data.byteOffset || 0, data.length);
  };

  G.dispatch = function (encoder, pipeline, bind, n, workgroupSize = 64) {
    const p = encoder.beginComputePass();
    p.setPipeline(pipeline);
    if (bind) p.setBindGroup(0, bind);
    p.dispatchWorkgroups(Math.ceil(n / workgroupSize));
    p.end();
  };

  window.GPU = G;
})();
