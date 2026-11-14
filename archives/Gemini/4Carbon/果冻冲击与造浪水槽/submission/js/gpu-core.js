(function () {
  const App = (window.App = window.App || {});
  const M = App.Math;

  const STUDIO_COMMON_WGSL = /* wgsl */ `
struct FrameUniforms {
  viewProj: mat4x4<f32>,
  invViewProj: mat4x4<f32>,
  view: mat4x4<f32>,
  lightViewProj: mat4x4<f32>,
  cameraPos: vec4<f32>,   // xyz: eye, w: time
  viewport: vec4<f32>,    // x: w, y: h, z: 1/w, w: 1/h
  keyLightDir: vec4<f32>, // xyz: dir TO key light, w: sceneId (0=jelly, 1=tank)
  plinthSize: vec4<f32>,  // x: halfX, y: topY, z: halfZ, w: exposure
};

fn sampleStudioEnv(dirIn: vec3<f32>) -> vec3<f32> {
  let d = normalize(dirIn);
  // Cyclorama vertical gradient (deep slate-navy studio)
  let upT = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  var col = mix(vec3<f32>(0.055, 0.072, 0.105), vec3<f32>(0.115, 0.160, 0.235), smoothstep(0.32, 0.92, upT));
  // Subtle warm studio horizon band
  let horiz = exp(-abs(d.y - 0.04) * 7.5);
  col += vec3<f32>(0.048, 0.062, 0.088) * horiz;

  // Overhead rectangular studio softbox
  if (d.y > 0.08) {
    let uv = d.xz / max(0.18, d.y);
    let boxX = 1.0 - smoothstep(0.52, 0.78, abs(uv.x - 0.12));
    let boxZ = 1.0 - smoothstep(0.36, 0.60, abs(uv.y - 0.08));
    col += vec3<f32>(3.65, 3.55, 3.42) * (boxX * boxZ) * smoothstep(0.15, 0.55, d.y);
  }

  // Key directional soft spot (front-right-top)
  let keyDot = max(0.0, dot(d, normalize(vec3<f32>(0.42, 0.80, 0.43))));
  col += vec3<f32>(2.4, 2.28, 2.10) * pow(keyDot, 28.0);

  // Rear-left cool rim softbox (highlights edges, glass bevels, cracks, wave crests)
  let rimDot = max(0.0, dot(d, normalize(vec3<f32>(-0.62, 0.44, -0.65))));
  col += vec3<f32>(1.85, 2.35, 3.10) * pow(rimDot, 14.0);

  // Side fill card (left-front)
  let fillDot = max(0.0, dot(d, normalize(vec3<f32>(-0.78, 0.28, 0.56))));
  col += vec3<f32>(0.55, 0.65, 0.82) * pow(fillDot, 8.0);

  // Alabaster plinth bounce from below
  if (d.y < 0.0) {
    col = mix(col, vec3<f32>(0.20, 0.23, 0.27), clamp(-d.y * 0.85, 0.0, 0.65));
  }
  return col;
}

fn quatRotateInv(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  // Rotate vector by conjugate(q)
  let u = -q.xyz;
  let s = q.w;
  return 2.0 * dot(u, v) * u + (s * s - dot(u, u)) * v + 2.0 * s * cross(u, v);
}

fn acesToneMap(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}
`;

  function buildUnitSphereMesh(latBands = 28, lonBands = 40) {
    const verts = [];
    const indices = [];
    for (let lat = 0; lat <= latBands; lat++) {
      const theta = (lat * Math.PI) / latBands;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      for (let lon = 0; lon <= lonBands; lon++) {
        const phi = (lon * 2 * Math.PI) / lonBands;
        const nx = Math.cos(phi) * sinT;
        const ny = cosT;
        const nz = Math.sin(phi) * sinT;
        verts.push(nx, ny, nz);
      }
    }
    for (let lat = 0; lat < latBands; lat++) {
      for (let lon = 0; lon < lonBands; lon++) {
        const a = lat * (lonBands + 1) + lon;
        const b = a + lonBands + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return {
      vertices: new Float32Array(verts),
      indices: new Uint32Array(indices)
    };
  }

  function buildPlinthBoxMesh() {
    // Unit box [-1, 1] in X,Z and [-1, 0] in Y with normals & bevel-friendly faces
    // 24 vertices (6 faces * 4)
    const p = [
      // Top (y = 0)
      [-1, 0, -1, 0, 1, 0], [-1, 0,  1, 0, 1, 0], [ 1, 0,  1, 0, 1, 0], [ 1, 0, -1, 0, 1, 0],
      // Front (z = 1)
      [-1, 0,  1, 0, 0, 1], [-1,-1,  1, 0, 0, 1], [ 1,-1,  1, 0, 0, 1], [ 1, 0,  1, 0, 0, 1],
      // Back (z = -1)
      [ 1, 0, -1, 0, 0,-1], [ 1,-1, -1, 0, 0,-1], [-1,-1, -1, 0, 0,-1], [-1, 0, -1, 0, 0,-1],
      // Right (x = 1)
      [ 1, 0,  1, 1, 0, 0], [ 1,-1,  1, 1, 0, 0], [ 1,-1, -1, 1, 0, 0], [ 1, 0, -1, 1, 0, 0],
      // Left (x = -1)
      [-1, 0, -1,-1, 0, 0], [-1,-1, -1,-1, 0, 0], [-1,-1,  1,-1, 0, 0], [-1, 0,  1,-1, 0, 0]
    ];
    const verts = [];
    const idx = [];
    for (let f = 0; f < 5; f++) {
      const base = f * 4;
      for (let k = 0; k < 4; k++) verts.push(...p[base + k]);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return {
      vertices: new Float32Array(verts),
      indices: new Uint32Array(idx)
    };
  }

  class GPUCore {
    constructor(canvas) {
      this.canvas = canvas;
      this.adapter = null;
      this.device = null;
      this.context = null;
      this.canvasFormat = 'bgra8unorm';
      this.hasFloat32Filterable = false;

      this.width = 1280;
      this.height = 720;

      // Offscreen HDR & Depth textures
      this.hdrTex = null;
      this.hdrView = null;
      this.hdrCopyTex = null;
      this.hdrCopyView = null;
      this.depthTex = null;
      this.depthView = null;
      this.depthCopyTex = null;
      this.depthCopyView = null;
      this.thicknessTex = null;
      this.thicknessView = null;

      // Shadow map (2048x2048)
      this.shadowSize = 2048;
      this.shadowTex = null;
      this.shadowView = null;
      this.shadowSampler = null;
      this.linearSampler = null;
      this.nearestSampler = null;

      // Shared Buffers
      this.frameUniformData = new Float32Array(80); // 320 bytes (padded to 320)
      this.frameUniformBuffer = null;

      // Jelly coloured shadow / AO casters on plinth (up to 16 casters: vec4(x, y, z, r), vec4(r, g, b, strength))
      this.maxCasters = 24;
      this.casterData = new Float32Array(this.maxCasters * 8);
      this.casterBuffer = null;

      // Rigid spheres buffer (up to 96 spheres * 16 floats)
      this.maxSpheres = 96;
      this.sphereInstanceData = new Float32Array(this.maxSpheres * 16);
      this.sphereInstanceBuffer = null;

      // Dummy 1x1 caustic texture when rendering Scene 1
      this.dummyCausticTex = null;
      this.dummyCausticView = null;

      // Pipelines
      this.bgPipeline = null;
      this.plinthPipeline = null;
      this.spherePipeline = null;
      this.sphereShadowPipeline = null;
      this.tonemapPipeline = null;
    }

    async init() {
      if (!navigator.gpu) {
        throw new Error('当前浏览器不支持 WebGPU，请使用支持 WebGPU 的 Chrome 打开。');
      }
      this.adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!this.adapter) {
        throw new Error('未能获取 WebGPU 显卡适配器。');
      }

      const reqFeatures = [];
      if (this.adapter.features.has('float32-filterable')) {
        reqFeatures.push('float32-filterable');
        this.hasFloat32Filterable = true;
      }

      const lim = this.adapter.limits;
      this.device = await this.adapter.requestDevice({
        requiredFeatures: reqFeatures,
        requiredLimits: {
          maxStorageBufferBindingSize: Math.min(lim.maxStorageBufferBindingSize, 536870912),
          maxBufferSize: Math.min(lim.maxBufferSize, 536870912),
          maxStorageBuffersPerShaderStage: Math.min(lim.maxStorageBuffersPerShaderStage, 12)
        }
      });

      this.context = this.canvas.getContext('webgpu');
      this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: this.canvasFormat,
        alphaMode: 'opaque'
      });

      this.linearSampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
        addressModeW: 'clamp-to-edge'
      });

      this.nearestSampler = this.device.createSampler({
        magFilter: 'nearest',
        minFilter: 'nearest',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge'
      });

      this.shadowSampler = this.device.createSampler({
        compare: 'less-equal',
        magFilter: 'linear',
        minFilter: 'linear'
      });

      this.shadowTex = this.device.createTexture({
        size: [this.shadowSize, this.shadowSize, 1],
        format: 'depth32float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });
      this.shadowView = this.shadowTex.createView();

      this.dummyCausticTex = this.device.createTexture({
        size: [4, 4, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
      this.dummyCausticView = this.dummyCausticTex.createView();

      this.frameUniformBuffer = this.device.createBuffer({
        size: 320,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });

      this.casterBuffer = this.device.createBuffer({
        size: this.casterData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      this.sphereInstanceBuffer = this.device.createBuffer({
        size: this.sphereInstanceData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      const sph = buildUnitSphereMesh(30, 42);
      this.sphereVtxBuf = this.device.createBuffer({
        size: sph.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(this.sphereVtxBuf, 0, sph.vertices);
      this.sphereIdxBuf = this.device.createBuffer({
        size: sph.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(this.sphereIdxBuf, 0, sph.indices);
      this.sphereIdxCount = sph.indices.length;

      const plinth = buildPlinthBoxMesh();
      this.plinthVtxBuf = this.device.createBuffer({
        size: plinth.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(this.plinthVtxBuf, 0, plinth.vertices);
      this.plinthIdxBuf = this.device.createBuffer({
        size: plinth.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(this.plinthIdxBuf, 0, plinth.indices);
      this.plinthIdxCount = plinth.indices.length;

      this._createCorePipelines();
      this.resizeToWindow();
    }

    resizeToWindow(explicitW, explicitH) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
      const targetW = M.clamp(Math.round(explicitW || window.innerWidth * dpr), 64, 4096);
      const targetH = M.clamp(Math.round(explicitH || window.innerHeight * dpr), 64, 2304);

      if (
        this.hdrTex &&
        this.width === targetW &&
        this.height === targetH &&
        this.canvas.width === targetW &&
        this.canvas.height === targetH
      ) {
        return false;
      }

      this.width = targetW;
      this.height = targetH;
      this.canvas.width = targetW;
      this.canvas.height = targetH;

      const destroySafe = (t) => { if (t) t.destroy(); };
      destroySafe(this.hdrTex);
      destroySafe(this.hdrCopyTex);
      destroySafe(this.depthTex);
      destroySafe(this.depthCopyTex);
      destroySafe(this.thicknessTex);

      this.hdrTex = this.device.createTexture({
        size: [targetW, targetH, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
      });
      this.hdrView = this.hdrTex.createView();

      this.hdrCopyTex = this.device.createTexture({
        size: [targetW, targetH, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
      this.hdrCopyView = this.hdrCopyTex.createView();

      this.depthTex = this.device.createTexture({
        size: [targetW, targetH, 1],
        format: 'depth32float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
      });
      this.depthView = this.depthTex.createView();

      this.depthCopyTex = this.device.createTexture({
        size: [targetW, targetH, 1],
        format: 'depth32float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
      this.depthCopyView = this.depthCopyTex.createView();

      this.thicknessTex = this.device.createTexture({
        size: [targetW, targetH, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });
      this.thicknessView = this.thicknessTex.createView();

      this._rebuildResizeBindGroups();
      return true;
    }

    _rebuildResizeBindGroups() {
      this.tonemapBindGroup = this.device.createBindGroup({
        layout: this.tonemapPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.frameUniformBuffer } },
          { binding: 1, resource: this.hdrView },
          { binding: 2, resource: this.linearSampler }
        ]
      });
    }

    updateFrameUniforms(camera, time, sceneId, plinthHalfX, plinthTopY, plinthHalfZ, exposure = 1.05) {
      const f = this.frameUniformData;
      f.set(camera.viewProj, 0);
      f.set(camera.invViewProj, 16);
      f.set(camera.view, 32);

      // Compute directional light ortho viewProj centered on stage
      const keyDir = [0.40, 0.83, 0.39];
      const kLen = Math.hypot(keyDir[0], keyDir[1], keyDir[2]);
      keyDir[0] /= kLen; keyDir[1] /= kLen; keyDir[2] /= kLen;

      const lightEye = [keyDir[0] * 6.0, keyDir[1] * 6.0, keyDir[2] * 6.0];
      const lightView = M.mat4LookAt(new Float32Array(16), lightEye, [0, 0.25, 0], [0, 1, 0]);
      const span = sceneId === 1 ? 2.25 : 1.95;
      const lightProj = M.mat4OrthoZO(new Float32Array(16), -span, span, -span, span, 0.8, 12.5);
      const lightVP = M.mat4Multiply(new Float32Array(16), lightProj, lightView);
      f.set(lightVP, 48);

      f[64] = camera.eye[0];
      f[65] = camera.eye[1];
      f[66] = camera.eye[2];
      f[67] = time;

      f[68] = this.width;
      f[69] = this.height;
      f[70] = 1.0 / this.width;
      f[71] = 1.0 / this.height;

      f[72] = keyDir[0];
      f[73] = keyDir[1];
      f[74] = keyDir[2];
      f[75] = sceneId;

      f[76] = plinthHalfX;
      f[77] = plinthTopY;
      f[78] = plinthHalfZ;
      f[79] = exposure;

      this.device.queue.writeBuffer(this.frameUniformBuffer, 0, f);
      return lightVP;
    }

    copySceneBackdrop(encoder) {
      encoder.copyTextureToTexture(
        { texture: this.hdrTex },
        { texture: this.hdrCopyTex },
        [this.width, this.height, 1]
      );
      encoder.copyTextureToTexture(
        { texture: this.depthTex },
        { texture: this.depthCopyTex },
        [this.width, this.height, 1]
      );
    }

    _createCorePipelines() {
      // 1. Studio Cyclorama Background Skybox Pipeline
      const bgModule = this.device.createShaderModule({
        code: STUDIO_COMMON_WGSL + /* wgsl */ `
@group(0) @binding(0) var<uniform> frame: FrameUniforms;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

@vertex
fn vsMain(@builtin(vertex_index) vid: u32) -> VSOut {
  var p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0)
  );
  var out: VSOut;
  out.pos = vec4<f32>(p[vid], 0.99999, 1.0);
  out.ndc = p[vid];
  return out;
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  let farH = frame.invViewProj * vec4<f32>(in.ndc, 1.0, 1.0);
  let farW = farH.xyz / farH.w;
  let rayDir = normalize(farW - frame.cameraPos.xyz);
  // Subtle studio backdrop (toned down direct softbox glare in background view)
  let upT = clamp(rayDir.y * 0.5 + 0.5, 0.0, 1.0);
  var col = mix(vec3<f32>(0.042, 0.056, 0.084), vec3<f32>(0.105, 0.148, 0.218), smoothstep(0.28, 0.92, upT));
  let glow = max(0.0, dot(rayDir, normalize(vec3<f32>(-0.25, 0.35, -0.85))));
  col += vec3<f32>(0.055, 0.085, 0.135) * pow(glow, 3.0);
  return vec4<f32>(col, 1.0);
}
`
      });

      this.bgPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: bgModule, entryPoint: 'vsMain' },
        fragment: {
          module: bgModule,
          entryPoint: 'fsMain',
          targets: [{ format: 'rgba16float' }]
        },
        primitive: { topology: 'triangle-list' },
        depthStencil: {
          format: 'depth32float',
          depthWriteEnabled: false,
          depthCompare: 'less-equal'
        }
      });

      this.bgBindGroup = this.device.createBindGroup({
        layout: this.bgPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this.frameUniformBuffer } }]
      });

      // 2. Laboratory Stage Plinth Pipeline (with PCF shadow + colored jelly caustic/AO casters + precision grid)
      const plinthModule = this.device.createShaderModule({
        code: STUDIO_COMMON_WGSL + /* wgsl */ `
struct Caster {
  posRad: vec4<f32>,    // xyz: center, w: radius (negative w => unused)
  colType: vec4<f32>,   // rgb: transmission tint, w: mode (0=opaque AO, 1=jelly caustic+AO)
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var shadowTex: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;
@group(0) @binding(3) var<storage, read> casters: array<Caster>;

struct VSIn {
  @location(0) pos: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) localXZ: vec2<f32>,
};

@vertex
fn vsMain(in: VSIn) -> VSOut {
  let hx = frame.plinthSize.x;
  let topY = frame.plinthSize.y;
  let hz = frame.plinthSize.z;
  let thick = 0.14;
  let wp = vec3<f32>(in.pos.x * hx, topY + in.pos.y * thick, in.pos.z * hz);
  var out: VSOut;
  out.worldPos = wp;
  out.normal = in.normal;
  out.localXZ = in.pos.xz;
  out.clipPos = frame.viewProj * vec4<f32>(wp, 1.0);
  return out;
}

fn sampleShadowPCF(worldPos: vec3<f32>) -> f32 {
  let lp = frame.lightViewProj * vec4<f32>(worldPos, 1.0);
  let ndc = lp.xyz / lp.w;
  let uv = vec2<f32>(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
  let inBounds = uv.x >= 0.002 && uv.x <= 0.998 && uv.y >= 0.002 && uv.y <= 0.998 && ndc.z >= 0.0 && ndc.z <= 1.0;
  let safeUV = clamp(uv, vec2<f32>(0.002), vec2<f32>(0.998));
  let safeZ = clamp(ndc.z - 0.0018, 0.0, 1.0);
  let stepUV = 1.0 / 2048.0;
  var sum = 0.0;
  for (var dy: i32 = -1; dy <= 1; dy++) {
    for (var dx: i32 = -1; dx <= 1; dx++) {
      let off = vec2<f32>(f32(dx), f32(dy)) * stepUV * 1.35;
      sum += textureSampleCompareLevel(shadowTex, shadowSampler, safeUV + off, safeZ);
    }
  }
  return select(1.0, sum / 9.0, inBounds);
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(in.normal);
  let V = normalize(frame.cameraPos.xyz - in.worldPos);
  let L = normalize(frame.keyLightDir.xyz);
  let isTop = N.y > 0.5;

  // Hoist fwidth to uniform control flow
  let fwX5 = max(1e-4, fwidth(in.worldPos.x * 5.0));
  let fwZ5 = max(1e-4, fwidth(in.worldPos.z * 5.0));
  let fwX1 = max(1e-4, fwidth(in.worldPos.x * 1.0));
  let fwZ1 = max(1e-4, fwidth(in.worldPos.z * 1.0));

  var albedo = vec3<f32>(0.15, 0.18, 0.23); // anodized aluminum skirt
  var rough = 0.34;
  if (isTop) {
    // Satin slate-ceramic optical bench surface (balanced mid-tone so grid & colored caustics never blow out)
    albedo = vec3<f32>(0.42, 0.46, 0.53);
    rough = 0.44;
    // Precision laboratory 10cm / 50cm grid markings
    let gx10 = abs(fract(in.worldPos.x * 5.0 + 0.5) - 0.5) / fwX5;
    let gz10 = abs(fract(in.worldPos.z * 5.0 + 0.5) - 0.5) / fwZ5;
    let lineMinor = 1.0 - clamp(min(gx10, gz10), 0.0, 1.0);

    let gx50 = abs(fract(in.worldPos.x * 1.0 + 0.5) - 0.5) / fwX1;
    let gz50 = abs(fract(in.worldPos.z * 1.0 + 0.5) - 0.5) / fwZ1;
    let lineMajor = 1.0 - clamp(min(gx50, gz50), 0.0, 1.0);

    albedo = mix(albedo, vec3<f32>(0.33, 0.37, 0.45), lineMinor * 0.42);
    albedo = mix(albedo, vec3<f32>(0.24, 0.29, 0.38), lineMajor * 0.62);

    // Subtle anodized rim border around edge of bench
    let edgeDist = max(abs(in.localXZ.x), abs(in.localXZ.y));
    let rimMask = smoothstep(0.965, 0.985, edgeDist);
    albedo = mix(albedo, vec3<f32>(0.18, 0.22, 0.29), rimMask);
    rough = mix(rough, 0.24, rimMask);
  } else {
    // Machined horizontal groove on side chassis
    let groove = smoothstep(0.06, 0.0, abs(in.worldPos.y - (frame.plinthSize.y - 0.035)));
    albedo = mix(albedo, vec3<f32>(0.28, 0.58, 0.82), groove * 0.45);
  }

  let shadow = sampleShadowPCF(in.worldPos);
  var ao = 1.0;
  var causticGlow = vec3<f32>(0.0);

  if (isTop) {
    let lightOffsetXZ = L.xz / max(0.35, L.y);
    for (var i: u32 = 0u; i < 24u; i++) {
      let c = casters[i];
      let r = c.posRad.w;
      if (r <= 0.0) { continue; }
      let h = max(0.0, c.posRad.y - in.worldPos.y);
      // Direct contact AO right under object
      let dContact = length(in.worldPos.xz - c.posRad.xz);
      let contactFactor = exp(-pow(dContact / max(0.02, r * 1.05), 2.2)) * exp(-h * 3.8);

      if (c.colType.w > 0.5) {
        // Translucent Jelly: rich colored transmission caustic + soft penumbra rim shadow
        ao *= (1.0 - 0.42 * contactFactor);
        let projCenter = c.posRad.xz - lightOffsetXZ * (h + r * 0.42);
        let dProj = length(in.worldPos.xz - projCenter) / max(0.03, r * 1.18);
        if (dProj < 1.35) {
          let penumbra = 1.0 - smoothstep(0.55, 1.25, dProj);
          let focusCore = exp(-dProj * dProj * 2.4);
          causticGlow += c.colType.rgb * (0.72 * focusCore + 0.26 * penumbra) * exp(-h * 0.9);
          ao *= (1.0 - 0.30 * penumbra * (1.0 - 0.55 * focusCore));
        }
      } else {
        // Rigid sphere crisp contact AO
        ao *= (1.0 - 0.72 * contactFactor);
      }
    }
  }

  let ndotl = max(0.0, dot(N, L));
  let H = normalize(L + V);
  let spec = pow(max(0.0, dot(N, H)), mix(96.0, 18.0, rough)) * mix(0.28, 0.06, rough);
  let R = reflect(-V, N);
  let fres = 0.03 + 0.22 * pow(1.0 - max(0.0, dot(N, V)), 5.0);
  let envCol = sampleStudioEnv(R) * mix(0.35, 0.12, rough);

  let ambient = albedo * vec3<f32>(0.34, 0.38, 0.45) * ao;
  let direct = albedo * vec3<f32>(1.18, 1.14, 1.08) * ndotl * shadow;
  let color = ambient + direct + albedo * causticGlow + vec3<f32>(spec * shadow) + envCol * fres * ao;
  return vec4<f32>(color, 1.0);
}
`
      });

      this.plinthPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: plinthModule,
          entryPoint: 'vsMain',
          buffers: [{
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x3' }
            ]
          }]
        },
        fragment: {
          module: plinthModule,
          entryPoint: 'fsMain',
          targets: [{ format: 'rgba16float' }]
        },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: {
          format: 'depth32float',
          depthWriteEnabled: true,
          depthCompare: 'less'
        }
      });

      this.plinthBindGroup = this.device.createBindGroup({
        layout: this.plinthPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.frameUniformBuffer } },
          { binding: 1, resource: this.shadowView },
          { binding: 2, resource: this.shadowSampler },
          { binding: 3, resource: { buffer: this.casterBuffer } }
        ]
      });

      // 3. Instanced PBR Rigid Sphere Pipeline (+ Shadow Pipeline)
      const sphereModule = this.device.createShaderModule({
        code: STUDIO_COMMON_WGSL + /* wgsl */ `
@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var shadowTex: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;
@group(0) @binding(3) var causticTex: texture_2d<f32>;
@group(0) @binding(4) var linearSamp: sampler;

struct VSIn {
  @location(0) unitPos: vec3<f32>,
  @location(1) instPosRad: vec4<f32>,
  @location(2) instQuat: vec4<f32>,
  @location(3) instColRough: vec4<f32>,
  @location(4) instMetalExtra: vec4<f32>, // x: metallic, y: stripeStyle, z: submergeDepth, w: tankMaxX
};

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) worldNormal: vec3<f32>,
  @location(2) localDir: vec3<f32>,
  @location(3) colRough: vec4<f32>,
  @location(4) metalExtra: vec4<f32>,
};

@vertex
fn vsShadow(in: VSIn) -> @builtin(position) vec4<f32> {
  let wp = in.instPosRad.xyz + in.unitPos * in.instPosRad.w;
  return frame.lightViewProj * vec4<f32>(wp, 1.0);
}

@vertex
fn vsMain(in: VSIn) -> VSOut {
  let n = normalize(in.unitPos);
  let wp = in.instPosRad.xyz + n * in.instPosRad.w;
  var out: VSOut;
  out.clipPos = frame.viewProj * vec4<f32>(wp, 1.0);
  out.worldPos = wp;
  out.worldNormal = n;
  out.localDir = quatRotateInv(in.instQuat, n);
  out.colRough = in.instColRough;
  out.metalExtra = in.instMetalExtra;
  return out;
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(in.worldNormal);
  let V = normalize(frame.cameraPos.xyz - in.worldPos);
  let L = normalize(frame.keyLightDir.xyz);
  let loc = normalize(in.localDir);

  var albedo = in.colRough.rgb;
  var rough = clamp(in.colRough.w, 0.05, 0.95);
  let metallic = clamp(in.metalExtra.x, 0.0, 1.0);
  let stripeStyle = in.metalExtra.y;

  // Rotational visual cues (makes rolling & spin 100% readable!)
  if (stripeStyle > 1.5) {
    // Scene 2 Multi-density sphere: crisp white-ivory equatorial band + pole dot
    let eqBand = 1.0 - smoothstep(0.11, 0.14, abs(loc.y));
    let merTick = (1.0 - smoothstep(0.05, 0.08, abs(loc.x))) * step(0.14, abs(loc.y)) * (1.0 - step(0.45, abs(loc.y)));
    let mark = clamp(eqBand + merTick * 0.75, 0.0, 1.0);
    albedo = mix(albedo, vec3<f32>(0.95, 0.97, 0.99), mark * 0.78);
    rough = mix(rough, 0.18, mark);
  } else if (stripeStyle > 0.5) {
    // Scene 1 Heavy Metal / Stone sphere: precision machined latitude ring + subtle brushed grain
    let groove = 1.0 - smoothstep(0.035, 0.055, abs(abs(loc.y) - 0.28));
    let crossGroove = 1.0 - smoothstep(0.025, 0.045, abs(loc.x));
    let grain = sin(loc.y * 90.0 + loc.x * 18.0) * 0.03;
    albedo = albedo * (1.0 + grain) * (1.0 - groove * 0.28 - crossGroove * 0.12);
    rough = clamp(rough + groove * 0.22, 0.06, 0.9);
  }

  // Shadow lookup
  let lp = frame.lightViewProj * vec4<f32>(in.worldPos, 1.0);
  let ndc = lp.xyz / lp.w;
  let suv = clamp(vec2<f32>(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5), vec2<f32>(0.002), vec2<f32>(0.998));
  let inB = ndc.z >= 0.0 && ndc.z <= 1.0;
  let sh = select(1.0, textureSampleCompareLevel(shadowTex, shadowSampler, suv, clamp(ndc.z - 0.002, 0.0, 1.0)), inB);

  // PBR Cook-Torrance / GGX approximation
  let F0 = mix(vec3<f32>(0.04), albedo, metallic);
  let diffCol = albedo * (1.0 - metallic);
  let ndotl = max(0.0, dot(N, L));
  let ndotv = max(0.001, dot(N, V));
  let H = normalize(L + V);
  let ndoth = max(0.0, dot(N, H));

  let a = rough * rough;
  let a2 = max(0.0008, a * a);
  let denom = ndoth * ndoth * (a2 - 1.0) + 1.0;
  let D = a2 / (3.14159265 * denom * denom);
  let F = F0 + (1.0 - F0) * pow(1.0 - max(0.0, dot(H, V)), 5.0);
  let specDirect = D * F * (0.25 / max(0.08, ndotv));

  let R = reflect(-V, N);
  let envSpec = sampleStudioEnv(R) * mix(1.0, 0.22, rough);
  let F_env = F0 + (max(vec3<f32>(1.0 - rough), F0) - F0) * pow(1.0 - ndotv, 5.0);

  // Underwater caustics & subtle pale-aqua water tint when submerged in Scene 2
  let subDepth = in.metalExtra.z;
  var causticAdd = vec3<f32>(0.0);
  if (subDepth > 0.005 && frame.keyLightDir.w > 0.5) {
    // Tank coordinates mapped to [0, 1] UV
    let tankUV = clamp(vec2<f32>((in.worldPos.x + 1.44) / 2.88, (in.worldPos.z + 0.36) / 0.72), vec2<f32>(0.01), vec2<f32>(0.99));
    let cVal = textureSampleLevel(causticTex, linearSamp, tankUV, 0.0).r;
    causticAdd = diffCol * vec3<f32>(0.75, 0.95, 1.05) * max(0.0, cVal - 0.85) * 0.65 * max(0.0, N.y * 0.7 + 0.3);
  }

  var color = diffCol * (vec3<f32>(0.30, 0.35, 0.43) + vec3<f32>(1.22, 1.17, 1.10) * ndotl * sh)
            + specDirect * ndotl * sh * vec3<f32>(1.25, 1.20, 1.12)
            + envSpec * F_env
            + causticAdd;

  if (subDepth > 0.005) {
    let absorb = exp(-vec3<f32>(0.42, 0.12, 0.08) * min(1.5, subDepth * 1.4));
    color *= absorb;
  }

  return vec4<f32>(color, 1.0);
}
`
      });

      const sphereVtxBuffers = [
        {
          arrayStride: 12,
          stepMode: 'vertex',
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
        },
        {
          arrayStride: 64,
          stepMode: 'instance',
          attributes: [
            { shaderLocation: 1, offset: 0, format: 'float32x4' },
            { shaderLocation: 2, offset: 16, format: 'float32x4' },
            { shaderLocation: 3, offset: 32, format: 'float32x4' },
            { shaderLocation: 4, offset: 48, format: 'float32x4' }
          ]
        }
      ];

      this.spherePipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: sphereModule, entryPoint: 'vsMain', buffers: sphereVtxBuffers },
        fragment: { module: sphereModule, entryPoint: 'fsMain', targets: [{ format: 'rgba16float' }] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });

      this.sphereShadowPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: sphereModule, entryPoint: 'vsShadow', buffers: sphereVtxBuffers },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });

      this.sphereShadowBindGroup = this.device.createBindGroup({
        layout: this.sphereShadowPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this.frameUniformBuffer } }]
      });

      this.sphereDefaultBindGroup = this.makeSphereBindGroup(this.dummyCausticView);

      // 4. HDR -> sRGB ACES Filmic Tonemap + Subtle Specular Bloom Post-Pass
      const tonemapModule = this.device.createShaderModule({
        code: STUDIO_COMMON_WGSL + /* wgsl */ `
@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var hdrTex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vsMain(@builtin(vertex_index) vid: u32) -> VSOut {
  var p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0)
  );
  var out: VSOut;
  out.pos = vec4<f32>(p[vid], 0.0, 1.0);
  out.uv = vec2<f32>(p[vid].x * 0.5 + 0.5, 0.5 - p[vid].y * 0.5);
  return out;
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  let center = textureSampleLevel(hdrTex, samp, in.uv, 0.0).rgb;
  // Soft 8-tap wide halo bloom for bright specular highlights on jelly/water/glass
  let texel = frame.viewport.zw * 2.5;
  var glow = vec3<f32>(0.0);
  let offs = array<vec2<f32>, 8>(
    vec2<f32>( 1.0,  0.0), vec2<f32>(-1.0,  0.0),
    vec2<f32>( 0.0,  1.0), vec2<f32>( 0.0, -1.0),
    vec2<f32>( 1.8,  1.8), vec2<f32>(-1.8,  1.8),
    vec2<f32>( 1.8, -1.8), vec2<f32>(-1.8, -1.8)
  );
  for (var i: u32 = 0u; i < 8u; i++) {
    let c = textureSampleLevel(hdrTex, samp, clamp(in.uv + offs[i] * texel, vec2<f32>(0.001), vec2<f32>(0.999)), 0.0).rgb;
    let lum = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
    glow += c * smoothstep(1.15, 3.2, lum);
  }
  let hdr = (center + glow * (0.042 / 8.0)) * frame.plinthSize.w;
  // Vignette (very subtle studio lens falloff)
  let d = length((in.uv - 0.5) * vec2<f32>(1.15, 1.0));
  let vig = 1.0 - smoothstep(0.52, 1.05, d) * 0.16;

  let mapped = acesToneMap(hdr * vig);
  let srgb = pow(mapped, vec3<f32>(1.0 / 2.2));
  return vec4<f32>(srgb, 1.0);
}
`
      });

      this.tonemapPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: tonemapModule, entryPoint: 'vsMain' },
        fragment: {
          module: tonemapModule,
          entryPoint: 'fsMain',
          targets: [{ format: this.canvasFormat }]
        },
        primitive: { topology: 'triangle-list' }
      });
    }

    makeSphereBindGroup(causticView) {
      return this.device.createBindGroup({
        layout: this.spherePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.frameUniformBuffer } },
          { binding: 1, resource: this.shadowView },
          { binding: 2, resource: this.shadowSampler },
          { binding: 3, resource: causticView || this.dummyCausticView },
          { binding: 4, resource: this.linearSampler }
        ]
      });
    }

    drawBackgroundAndPlinth(pass) {
      pass.setPipeline(this.bgPipeline);
      pass.setBindGroup(0, this.bgBindGroup);
      pass.draw(3);

      pass.setPipeline(this.plinthPipeline);
      pass.setBindGroup(0, this.plinthBindGroup);
      pass.setVertexBuffer(0, this.plinthVtxBuf);
      pass.setIndexBuffer(this.plinthIdxBuf, 'uint32');
      pass.drawIndexed(this.plinthIdxCount);
    }

    drawSpheresShadow(pass, count, instanceBuf = this.sphereInstanceBuffer) {
      if (count <= 0) return;
      pass.setPipeline(this.sphereShadowPipeline);
      pass.setBindGroup(0, this.sphereShadowBindGroup);
      pass.setVertexBuffer(0, this.sphereVtxBuf);
      pass.setVertexBuffer(1, instanceBuf);
      pass.setIndexBuffer(this.sphereIdxBuf, 'uint32');
      pass.drawIndexed(this.sphereIdxCount, count);
    }

    drawSpheres(pass, count, bindGroup = this.sphereDefaultBindGroup, instanceBuf = this.sphereInstanceBuffer) {
      if (count <= 0) return;
      pass.setPipeline(this.spherePipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, this.sphereVtxBuf);
      pass.setVertexBuffer(1, instanceBuf);
      pass.setIndexBuffer(this.sphereIdxBuf, 'uint32');
      pass.drawIndexed(this.sphereIdxCount, count);
    }

    runTonemapToCanvas(encoder) {
      const swapView = this.context.getCurrentTexture().createView();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: swapView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
      pass.setPipeline(this.tonemapPipeline);
      pass.setBindGroup(0, this.tonemapBindGroup);
      pass.draw(3);
      pass.end();
    }
  }

  App.STUDIO_COMMON_WGSL = STUDIO_COMMON_WGSL;
  App.GPUCore = GPUCore;
})();
