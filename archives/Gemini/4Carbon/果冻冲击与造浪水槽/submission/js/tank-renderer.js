(function () {
  const App = (window.App = window.App || {});
  const M = App.Math;
  const TC = App.TANK_CONSTS;

  function buildTerrainMesh() {
    const nx = 144;
    const nz = 36;
    const verts = []; // pos(3), normal(3)
    const indices = [];

    const eps = 0.012;
    for (let iz = 0; iz <= nz; iz++) {
      const z = M.lerp(TC.TANK_MIN_Z, TC.TANK_MAX_Z, iz / nz);
      for (let ix = 0; ix <= nx; ix++) {
        const x = M.lerp(TC.TANK_MIN_X, TC.TANK_MAX_X, ix / nx);
        const y = TC.evalTerrainHeightJS(x, z);
        const hx = TC.evalTerrainHeightJS(x + eps, z) - TC.evalTerrainHeightJS(x - eps, z);
        const hz = TC.evalTerrainHeightJS(x, z + eps) - TC.evalTerrainHeightJS(x, z - eps);
        const nl = Math.hypot(-hx, 2 * eps, -hz) || 1.0;
        verts.push(x, y, z, -hx / nl, (2 * eps) / nl, -hz / nl);
      }
    }

    const row = nx + 1;
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const a = iz * row + ix;
        const b = a + row;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }

    // Add front & right skirt faces so terrain cross-section looks like solid sculpted laboratory stone against the glass!
    const pushQuad = (p0, p1, p2, p3, nxN, nyN, nzN) => {
      const base = verts.length / 6;
      verts.push(
        p0[0], p0[1], p0[2], nxN, nyN, nzN,
        p1[0], p1[1], p1[2], nxN, nyN, nzN,
        p2[0], p2[1], p2[2], nxN, nyN, nzN,
        p3[0], p3[1], p3[2], nxN, nyN, nzN
      );
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    // Front glass cross-section skirt (z = TANK_MAX_Z)
    for (let ix = 0; ix < nx; ix++) {
      const x0 = M.lerp(TC.TANK_MIN_X, TC.TANK_MAX_X, ix / nx);
      const x1 = M.lerp(TC.TANK_MIN_X, TC.TANK_MAX_X, (ix + 1) / nx);
      const y0 = TC.evalTerrainHeightJS(x0, TC.TANK_MAX_Z);
      const y1 = TC.evalTerrainHeightJS(x1, TC.TANK_MAX_Z);
      if (y0 > 0.002 || y1 > 0.002) {
        pushQuad(
          [x0, y0, TC.TANK_MAX_Z - 0.001],
          [x0, 0.0, TC.TANK_MAX_Z - 0.001],
          [x1, 0.0, TC.TANK_MAX_Z - 0.001],
          [x1, y1, TC.TANK_MAX_Z - 0.001],
          0, 0, 1
        );
      }
    }

    // Back glass cross-section skirt (z = TANK_MIN_Z)
    for (let ix = 0; ix < nx; ix++) {
      const x0 = M.lerp(TC.TANK_MIN_X, TC.TANK_MAX_X, ix / nx);
      const x1 = M.lerp(TC.TANK_MIN_X, TC.TANK_MAX_X, (ix + 1) / nx);
      const y0 = TC.evalTerrainHeightJS(x0, TC.TANK_MIN_Z);
      const y1 = TC.evalTerrainHeightJS(x1, TC.TANK_MIN_Z);
      if (y0 > 0.002 || y1 > 0.002) {
        pushQuad(
          [x1, y1, TC.TANK_MIN_Z + 0.001],
          [x1, 0.0, TC.TANK_MIN_Z + 0.001],
          [x0, 0.0, TC.TANK_MIN_Z + 0.001],
          [x0, y0, TC.TANK_MIN_Z + 0.001],
          0, 0, -1
        );
      }
    }

    // Right wall skirt (x = TANK_MAX_X)
    for (let iz = 0; iz < nz; iz++) {
      const z0 = M.lerp(TC.TANK_MIN_Z, TC.TANK_MAX_Z, iz / nz);
      const z1 = M.lerp(TC.TANK_MIN_Z, TC.TANK_MAX_Z, (iz + 1) / nz);
      const y0 = TC.evalTerrainHeightJS(TC.TANK_MAX_X, z0);
      const y1 = TC.evalTerrainHeightJS(TC.TANK_MAX_X, z1);
      pushQuad(
        [TC.TANK_MAX_X - 0.001, y0, z0],
        [TC.TANK_MAX_X - 0.001, 0.0, z0],
        [TC.TANK_MAX_X - 0.001, 0.0, z1],
        [TC.TANK_MAX_X - 0.001, y1, z1],
        1, 0, 0
      );
    }

    return {
      vertices: new Float32Array(verts),
      indices: new Uint32Array(indices)
    };
  }

  function appendBox(verts, indices, x0, y0, z0, x1, y1, z1, r, g, b, metal) {
    const faces = [
      // +X
      [[x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [1, 0, 0]],
      // -X
      [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [-1, 0, 0]],
      // +Y
      [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]],
      // -Y
      [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0]],
      // +Z
      [[x0, y1, z1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [0, 0, 1]],
      // -Z
      [[x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [0, 0, -1]]
    ];
    for (let f = 0; f < 6; f++) {
      const fc = faces[f];
      const base = verts.length / 10;
      const n = fc[4];
      for (let k = 0; k < 4; k++) {
        const p = fc[k];
        verts.push(p[0], p[1], p[2], n[0], n[1], n[2], r, g, b, metal);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  function buildWavemakerMeshes() {
    // 1. Static frame (motor housing at left end + guide rails along top left of flume)
    const sVerts = [], sIdx = [];
    // Anodized actuator housing block on left of tank
    appendBox(sVerts, sIdx, -1.62, -0.02, -0.26, -1.455, 0.72, 0.26, 0.17, 0.21, 0.28, 0.75);
    appendBox(sVerts, sIdx, -1.60, 0.72, -0.18, -1.46, 0.86, 0.18, 0.24, 0.29, 0.37, 0.85);
    // Accent status trim bar
    appendBox(sVerts, sIdx, -1.625, 0.56, -0.24, -1.452, 0.59, 0.24, 0.18, 0.68, 0.96, 0.35);
    // Twin overhead stainless-steel guide rails spanning [-1.52, -0.82]
    appendBox(sVerts, sIdx, -1.52, 1.135, -0.28, -0.82, 1.162, -0.245, 0.76, 0.80, 0.85, 0.92);
    appendBox(sVerts, sIdx, -1.52, 1.135,  0.245, -0.82, 1.162,  0.28, 0.76, 0.80, 0.85, 0.92);
    // Rail end-bracket
    appendBox(sVerts, sIdx, -0.83, 1.115, -0.375, -0.79, 1.17, 0.375, 0.22, 0.26, 0.33, 0.80);

    // 2. Moving Paddle Assembly (defined relative to paddleX = 0 at front face of paddle!)
    const mVerts = [], mIdx = [];
    // Main brushed stainless wave plate (front pushing face at local x = 0.0, thickness 0.022m)
    appendBox(mVerts, mIdx, -0.022, 0.004, -0.354, 0.0, 1.06, 0.354, 0.74, 0.79, 0.86, 0.90);
    // Vertical reinforcing ribs on back of paddle
    appendBox(mVerts, mIdx, -0.048, 0.04, -0.24, -0.022, 1.14, -0.20, 0.42, 0.48, 0.56, 0.85);
    appendBox(mVerts, mIdx, -0.048, 0.04,  0.20, -0.022, 1.14,  0.24, 0.42, 0.48, 0.56, 0.85);
    // Overhead carriage cross-bar riding on rails
    appendBox(mVerts, mIdx, -0.065, 1.12, -0.31, 0.025, 1.18, 0.31, 0.22, 0.58, 0.86, 0.65);
    // Twin chrome piston actuator rods extending back into motor housing
    appendBox(mVerts, mIdx, -0.45, 0.54, -0.14, -0.022, 0.575, -0.105, 0.86, 0.89, 0.93, 0.95);
    appendBox(mVerts, mIdx, -0.45, 0.54,  0.105, -0.022, 0.575,  0.14, 0.86, 0.89, 0.93, 0.95);

    return {
      staticVerts: new Float32Array(sVerts),
      staticIndices: new Uint32Array(sIdx),
      movingVerts: new Float32Array(mVerts),
      movingIndices: new Uint32Array(mIdx)
    };
  }

  function buildGlassTankBoxAndBevels() {
    // Glass wall panes (back, left, right, front) + crisp 3D beveled edge strips so glass edge specular highlights shine!
    const x0 = TC.TANK_MIN_X - 0.012;
    const x1 = TC.TANK_MAX_X + 0.012;
    const y0 = -0.005;
    const y1 = TC.TANK_MAX_Y + 0.01;
    const z0 = TC.TANK_MIN_Z - 0.012;
    const z1 = TC.TANK_MAX_Z + 0.012;

    const verts = []; // pos(3), normal(3), uvWall(2), isEdgeBevel(1), wallId(1) -> 10 floats
    const indices = [];

    const addQuad = (p0, p1, p2, p3, n, bevelFlag, wallId) => {
      const b = verts.length / 10;
      const pts = [p0, p1, p2, p3];
      const uvs = [[0, 1], [0, 0], [1, 0], [1, 1]];
      for (let k = 0; k < 4; k++) {
        verts.push(pts[k][0], pts[k][1], pts[k][2], n[0], n[1], n[2], uvs[k][0], uvs[k][1], bevelFlag, wallId);
      }
      indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };

    // Order back-to-front for clean alpha blending: Back (-Z), Left (-X), Right (+X), Front (+Z)
    addQuad([x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [0, 0, -1], 0.0, 0.0);
    addQuad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [-1, 0, 0], 0.0, 1.0);
    addQuad([x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [1, 0, 0], 0.0, 2.0);
    addQuad([x0, y1, z1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [0, 0, 1], 0.0, 3.0);

    // Top polished glass rim strips (12mm thick crystal glass top edges catch bright overhead softbox highlights!)
    const gw = 0.014;
    // Front top rim
    addQuad([x0, y1, z1 - gw], [x0, y1, z1], [x1, y1, z1], [x1, y1, z1 - gw], [0, 1, 0.25], 1.0, 4.0);
    // Back top rim
    addQuad([x0, y1, z0], [x0, y1, z0 + gw], [x1, y1, z0 + gw], [x1, y1, z0], [0, 1, -0.25], 1.0, 4.0);
    // Right top rim
    addQuad([x1 - gw, y1, z0], [x1 - gw, y1, z1], [x1, y1, z1], [x1, y1, z0], [0.25, 1, 0], 1.0, 4.0);
    // Left top rim
    addQuad([x0, y1, z0], [x0, y1, z1], [x0 + gw, y1, z1], [x0 + gw, y1, z0], [-0.25, 1, 0], 1.0, 4.0);

    // 4 Vertical corner bevel strips (45-degree chamfered glass corners!)
    const cb = 0.011;
    // Front-Right vertical bevel
    addQuad([x1 - cb, y1, z1], [x1 - cb, y0, z1], [x1, y0, z1 - cb], [x1, y1, z1 - cb], [0.707, 0, 0.707], 1.0, 5.0);
    // Front-Left vertical bevel
    addQuad([x0, y1, z1 - cb], [x0, y0, z1 - cb], [x0 + cb, y0, z1], [x0 + cb, y1, z1], [-0.707, 0, 0.707], 1.0, 5.0);
    // Back-Right vertical bevel
    addQuad([x1, y1, z0 + cb], [x1, y0, z0 + cb], [x1 - cb, y0, z0], [x1 - cb, y1, z0], [0.707, 0, -0.707], 1.0, 5.0);
    // Back-Left vertical bevel
    addQuad([x0 + cb, y1, z0], [x0 + cb, y0, z0], [x0, y0, z0 + cb], [x0, y1, z0 + cb], [-0.707, 0, -0.707], 1.0, 5.0);

    return {
      vertices: new Float32Array(verts),
      indices: new Uint32Array(indices)
    };
  }

  class TankRenderer {
    constructor(gpu, fluid) {
      this.gpu = gpu;
      this.device = gpu.device;
      this.fluid = fluid;

      // Tank-specific uniform buffer (32 bytes: paddleX, restWaterY, numSpheres, time, etc.)
      this.tankUniData = new Float32Array(8);
      this.tankUniBuf = this.device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });

      this._initMeshes();
      this._createPipelines();
      this.rebuildBindGroups();
    }

    _initMeshes() {
      const dev = this.device;

      const terr = buildTerrainMesh();
      this.terrVtxBuf = dev.createBuffer({ size: terr.vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      dev.queue.writeBuffer(this.terrVtxBuf, 0, terr.vertices);
      this.terrIdxBuf = dev.createBuffer({ size: terr.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
      dev.queue.writeBuffer(this.terrIdxBuf, 0, terr.indices);
      this.terrIdxCount = terr.indices.length;

      const wm = buildWavemakerMeshes();
      this.wmStaticVtxBuf = dev.createBuffer({ size: wm.staticVerts.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      dev.queue.writeBuffer(this.wmStaticVtxBuf, 0, wm.staticVerts);
      this.wmStaticIdxBuf = dev.createBuffer({ size: wm.staticIndices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
      dev.queue.writeBuffer(this.wmStaticIdxBuf, 0, wm.staticIndices);
      this.wmStaticIdxCount = wm.staticIndices.length;

      this.wmMovingVtxBuf = dev.createBuffer({ size: wm.movingVerts.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      dev.queue.writeBuffer(this.wmMovingVtxBuf, 0, wm.movingVerts);
      this.wmMovingIdxBuf = dev.createBuffer({ size: wm.movingIndices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
      dev.queue.writeBuffer(this.wmMovingIdxBuf, 0, wm.movingIndices);
      this.wmMovingIdxCount = wm.movingIndices.length;

      const glass = buildGlassTankBoxAndBevels();
      this.glassVtxBuf = dev.createBuffer({ size: glass.vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      dev.queue.writeBuffer(this.glassVtxBuf, 0, glass.vertices);
      this.glassIdxBuf = dev.createBuffer({ size: glass.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
      dev.queue.writeBuffer(this.glassIdxBuf, 0, glass.indices);
      this.glassIdxCount = glass.indices.length;
    }

    _createPipelines() {
      const dev = this.device;

      // 0. GPU-to-GPU Sphere Instance + Caster Packer Compute Pipeline (zero CPU stall!)
      const packShader = dev.createShaderModule({
        code: /* wgsl */ `
struct TankSphere {
  posRad: vec4<f32>,
  velDens: vec4<f32>,
  angGroup: vec4<f32>,
  quat: vec4<f32>,
  colSub: vec4<f32>,
  prevSplash: vec4<f32>,
};

struct SphereInst {
  posRad: vec4<f32>,
  quat: vec4<f32>,
  colRough: vec4<f32>,
  metalExtra: vec4<f32>,
};

struct Caster {
  posRad: vec4<f32>,
  colType: vec4<f32>,
};

struct TankUni {
  paddleX: f32,
  isMovingMesh: f32,
  numSpheres: f32,
  restWaterY: f32,
  pad0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> tUni: TankUni;
@group(0) @binding(1) var<storage, read> srcSpheres: array<TankSphere>;
@group(0) @binding(2) var<storage, read_write> dstInst: array<SphereInst>;
@group(0) @binding(3) var<storage, read_write> dstCasters: array<Caster>;

@compute @workgroup_size(64)
fn csPack(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = u32(tUni.numSpheres);
  if (i < 24u) {
    dstCasters[i].posRad = vec4<f32>(0.0, 0.0, 0.0, -1.0);
    dstCasters[i].colType = vec4<f32>(0.0);
  }
  if (i >= n) { return; }

  let s = srcSpheres[i];
  // Glossy laboratory precision polymer/mineral spheres: high-density has subtle metallic sheen
  let isHeavy = select(0.06, 0.35, s.velDens.w > 1.8);
  let rough = select(0.16, 0.20, s.velDens.w > 1.8);

  dstInst[i].posRad = s.posRad;
  dstInst[i].quat = s.quat;
  dstInst[i].colRough = vec4<f32>(s.colSub.rgb, rough);
  dstInst[i].metalExtra = vec4<f32>(isHeavy, 2.0, s.colSub.w * 0.55, 1.0);

  if (i < 24u) {
    dstCasters[i].posRad = vec4<f32>(s.posRad.x, s.posRad.y - s.posRad.w, s.posRad.z, s.posRad.w * 1.15);
    dstCasters[i].colType = vec4<f32>(0.0);
  }
}
`
      });

      this.packSpheresPipe = dev.createComputePipeline({
        layout: 'auto',
        compute: { module: packShader, entryPoint: 'csPack' }
      });

      this.packSpheresBG = dev.createBindGroup({
        layout: this.packSpheresPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.tankUniBuf } },
          { binding: 1, resource: { buffer: this.fluid.tankSpheresBuf } },
          { binding: 2, resource: { buffer: this.gpu.sphereInstanceBuffer } },
          { binding: 3, resource: { buffer: this.gpu.casterBuffer } }
        ]
      });

      // 1. Sculpted Underwater Terrain Pipeline (with Real-Time Caustics + Sphere Contact AO + Contour Strata!)
      const terrModule = dev.createShaderModule({
        code: App.STUDIO_COMMON_WGSL + /* wgsl */ `
struct TankSphere {
  posRad: vec4<f32>,
  velDens: vec4<f32>,
  angGroup: vec4<f32>,
  quat: vec4<f32>,
  colSub: vec4<f32>,
  prevSplash: vec4<f32>,
};

struct TankUni {
  paddleX: f32,
  isMovingMesh: f32,
  numSpheres: f32,
  restWaterY: f32,
  pad0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var<uniform> tUni: TankUni;
@group(0) @binding(2) var causticTex: texture_2d<f32>;
@group(0) @binding(3) var shadowTex: texture_depth_2d;
@group(0) @binding(4) var shadowSampler: sampler_comparison;
@group(0) @binding(5) var linearSamp: sampler;
@group(0) @binding(6) var<storage, read> spheres: array<TankSphere>;

struct VSIn {
  @location(0) pos: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

@vertex
fn vsMain(in: VSIn) -> VSOut {
  var out: VSOut;
  out.worldPos = in.pos;
  out.normal = in.normal;
  out.clipPos = frame.viewProj * vec4<f32>(in.pos, 1.0);
  return out;
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(in.normal);
  let L = normalize(frame.keyLightDir.xyz);
  let V = normalize(frame.cameraPos.xyz - in.worldPos);

  // Sculpted warm travertine-sandstone flume bed with subtle elevation contour rings!
  let h = in.worldPos.y;
  var albedo = mix(vec3<f32>(0.68, 0.73, 0.79), vec3<f32>(0.78, 0.75, 0.69), smoothstep(0.01, 0.22, h));
  // Subtle topographic 2.5cm contour lines on reef mound + 10cm flume bed ruler ticks
  let contour = 1.0 - clamp(abs(fract(h * 40.0) - 0.5) / max(0.02, fwidth(h * 40.0)), 0.0, 1.0);
  albedo = mix(albedo, vec3<f32>(0.52, 0.57, 0.64), contour * 0.22 * smoothstep(0.015, 0.04, h));

  let gx = abs(fract(in.worldPos.x * 5.0 + 0.5) - 0.5) / max(0.01, fwidth(in.worldPos.x * 5.0));
  let gz = abs(fract(in.worldPos.z * 5.0 + 0.5) - 0.5) / max(0.01, fwidth(in.worldPos.z * 5.0));
  let gridLine = (1.0 - clamp(min(gx, gz), 0.0, 1.0)) * step(0.5, N.y);
  albedo = mix(albedo, vec3<f32>(0.54, 0.60, 0.68), gridLine * 0.26);

  // Sphere proximity contact AO right on the tank bed & reef!
  var contactAO = 1.0;
  let nSph = u32(tUni.numSpheres);
  for (var i: u32 = 0u; i < nSph; i++) {
    let sp = spheres[i].posRad;
    let dHoriz = length(in.worldPos.xz - sp.xz);
    let gapY = max(0.0, (sp.y - sp.w) - in.worldPos.y);
    if (dHoriz < sp.w * 2.2 && gapY < 0.22) {
      let fall = exp(-pow(dHoriz / (sp.w * 1.05), 2.1)) * exp(-gapY * 11.0);
      contactAO *= (1.0 - 0.68 * fall);
    }
  }

  // Shadow map
  let lp = frame.lightViewProj * vec4<f32>(in.worldPos, 1.0);
  let ndc = lp.xyz / lp.w;
  let suv = clamp(vec2<f32>(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5), vec2<f32>(0.002), vec2<f32>(0.998));
  let inB = ndc.z >= 0.0 && ndc.z <= 1.0;
  let sh = select(1.0, textureSampleCompareLevel(shadowTex, shadowSampler, suv, clamp(ndc.z - 0.0025, 0.0, 1.0)), inB);

  // Real-time refracted underwater caustics from 3D particle surface!
  var causticLight = vec3<f32>(0.0);
  if (in.worldPos.x > tUni.paddleX && N.y > 0.15) {
    let tuv = clamp(vec2<f32>((in.worldPos.x + 1.44) / 2.88, (in.worldPos.z + 0.36) / 0.72), vec2<f32>(0.005), vec2<f32>(0.995));
    let cRaw = textureSampleLevel(causticTex, linearSamp, tuv, 0.0).r;
    // Focus boost where wave lens converges photons (> 1.0) and troughs dim (< 1.0)!
    let focus = pow(max(0.0, cRaw), 1.55);
    causticLight = albedo * vec3<f32>(0.42, 0.58, 0.66) * focus * 0.85 * sh;
  }

  let ndotl = max(0.0, dot(N, L));
  let H = normalize(L + V);
  let spec = pow(max(0.0, dot(N, H)), 36.0) * 0.10 * sh;

  var color = albedo * vec3<f32>(0.30, 0.36, 0.44) * contactAO
            + albedo * vec3<f32>(0.78, 0.82, 0.84) * ndotl * sh * contactAO
            + causticLight * contactAO
            + vec3<f32>(spec);

  // Subtle pale-turquoise depth absorption on submerged floor ahead of paddle
  if (in.worldPos.x > tUni.paddleX) {
    let subD = max(0.0, 0.43 - in.worldPos.y);
    color *= exp(-vec3<f32>(0.36, 0.09, 0.05) * subD);
  }
  return vec4<f32>(color, 1.0);
}
`
      });

      this.terrPipeline = dev.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: terrModule,
          entryPoint: 'vsMain',
          buffers: [{
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x3' }
            ]
          }]
        },
        fragment: { module: terrModule, entryPoint: 'fsMain', targets: [{ format: 'rgba16float' }] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });

      // 2. Wavemaker Rig Pipeline (Static Frame + Moving Piston Paddle)
      const wmModule = dev.createShaderModule({
        code: App.STUDIO_COMMON_WGSL + /* wgsl */ `
struct TankUni {
  paddleX: f32,
  isMovingMesh: f32,
  numSpheres: f32,
  restWaterY: f32,
  pad0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var<uniform> tUni: TankUni;

struct VSIn {
  @location(0) pos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) colMetal: vec4<f32>,
};

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) colMetal: vec4<f32>,
};

@vertex
fn vsMain(in: VSIn) -> VSOut {
  var wp = in.pos;
  if (tUni.isMovingMesh > 0.5) {
    wp.x += tUni.paddleX;
  }
  var out: VSOut;
  out.worldPos = wp;
  out.normal = in.normal;
  out.colMetal = in.colMetal;
  out.clipPos = frame.viewProj * vec4<f32>(wp, 1.0);
  return out;
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(in.normal);
  let V = normalize(frame.cameraPos.xyz - in.worldPos);
  let L = normalize(frame.keyLightDir.xyz);
  let albedo = in.colMetal.rgb;
  let metallic = in.colMetal.w;
  let rough = mix(0.38, 0.20, metallic);

  let ndotl = max(0.0, dot(N, L));
  let H = normalize(L + V);
  let spec = pow(max(0.0, dot(N, H)), 72.0) * mix(0.25, 0.85, metallic);
  let R = reflect(-V, N);
  let env = sampleStudioEnv(R) * mix(0.18, 0.62, metallic);

  let diff = albedo * (1.0 - metallic * 0.72);
  let col = diff * (vec3<f32>(0.32, 0.36, 0.44) + vec3<f32>(1.15, 1.12, 1.06) * ndotl) + albedo * env + vec3<f32>(spec);
  return vec4<f32>(col, 1.0);
}
`
      });

      const wmBuffers = [{
        arrayStride: 40,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' },
          { shaderLocation: 2, offset: 24, format: 'float32x4' }
        ]
      }];

      this.wmPipeline = dev.createRenderPipeline({
        layout: 'auto',
        vertex: { module: wmModule, entryPoint: 'vsMain', buffers: wmBuffers },
        fragment: { module: wmModule, entryPoint: 'fsMain', targets: [{ format: 'rgba16float' }] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });

      this.tankUniMovingBuf = dev.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });

      this.wmStaticBG = dev.createBindGroup({
        layout: this.wmPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuffer } },
          { binding: 1, resource: { buffer: this.tankUniBuf } }
        ]
      });

      this.wmMovingBG = dev.createBindGroup({
        layout: this.wmPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuffer } },
          { binding: 1, resource: { buffer: this.tankUniMovingBuf } }
        ]
      });

      // 3. 3D Raymarched Free-Surface & Volumetric Water Shader (reads waterTex3D + refracts hdrCopyTex!)
      const waterRayModule = dev.createShaderModule({
        code: App.STUDIO_COMMON_WGSL + /* wgsl */ `
struct TankUni {
  paddleX: f32,
  isMovingMesh: f32,
  numSpheres: f32,
  restWaterY: f32,
  pad0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var<uniform> tUni: TankUni;
@group(0) @binding(2) var waterTex3D: texture_3d<f32>;
@group(0) @binding(3) var backdropTex: texture_2d<f32>;
@group(0) @binding(4) var sceneDepthTex: texture_depth_2d;
@group(0) @binding(5) var linearSamp: sampler;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) ndc: vec2<f32>,
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
  out.ndc = p[vid];
  out.uv = vec2<f32>(p[vid].x * 0.5 + 0.5, 0.5 - p[vid].y * 0.5);
  return out;
}

fn worldToWaterUVW(p: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    (p.x - (-1.44)) / 2.88,
    (p.y - 0.00) / 1.12,
    (p.z - (-0.36)) / 0.72
  );
}

fn sampleWaterField(p: vec3<f32>) -> vec4<f32> {
  let uvw = clamp(worldToWaterUVW(p), vec3<f32>(0.002), vec3<f32>(0.998));
  return textureSampleLevel(waterTex3D, linearSamp, uvw, 0.0);
}

fn sampleRefinedNormal(p: vec3<f32>) -> vec3<f32> {
  let ex = vec3<f32>(0.015, 0.0, 0.0);
  let ey = vec3<f32>(0.0, 0.014, 0.0);
  let ez = vec3<f32>(0.0, 0.0, 0.015);
  let gx = -(sampleWaterField(p + ex).r - sampleWaterField(p - ex).r);
  let gy = -(sampleWaterField(p + ey).r - sampleWaterField(p - ey).r);
  let gz = -(sampleWaterField(p + ez).r - sampleWaterField(p - ez).r);
  let g = vec3<f32>(gx, gy, gz);
  let l = length(g);
  return select(vec3<f32>(0.0, 1.0, 0.0), g / l, l > 0.0005);
}

fn intersectAABB(ro: vec3<f32>, invRd: vec3<f32>, bMin: vec3<f32>, bMax: vec3<f32>) -> vec2<f32> {
  let t0 = (bMin - ro) * invRd;
  let t1 = (bMax - ro) * invRd;
  let tSmaller = min(t0, t1);
  let tBigger = max(t0, t1);
  let tNear = max(max(tSmaller.x, tSmaller.y), tSmaller.z);
  let tFar = min(min(tBigger.x, tBigger.y), tBigger.z);
  return vec2<f32>(tNear, tFar);
}

struct FSOut {
  @location(0) color: vec4<f32>,
  @builtin(frag_depth) depth: f32,
};

@fragment
fn fsMain(in: VSOut) -> FSOut {
  let px = clamp(vec2<i32>(in.pos.xy), vec2<i32>(0), vec2<i32>(frame.viewport.xy) - vec2<i32>(1));
  let opaqueZ = textureLoad(sceneDepthTex, px, 0);

  // Reconstruct world ray & linear distance to opaque geometry (terrain, submerged spheres, wavemaker)
  let farH = frame.invViewProj * vec4<f32>(in.ndc, 1.0, 1.0);
  let farW = farH.xyz / farH.w;
  let ro = frame.cameraPos.xyz;
  let rd = normalize(farW - ro);
  let invRd = 1.0 / select(rd, sign(rd) * 1e-6, abs(rd) < vec3<f32>(1e-6));

  let opH = frame.invViewProj * vec4<f32>(in.ndc, opaqueZ, 1.0);
  let opW = opH.xyz / opH.w;
  let maxOpaqueDist = length(opW - ro);

  let boxMin = vec3<f32>(tUni.paddleX + 0.002, 0.002, -0.358);
  let boxMax = vec3<f32>(1.438, 1.115, 0.358);
  let hitBox = intersectAABB(ro, invRd, boxMin, boxMax);

  let tStart = max(0.02, hitBox.x);
  let tEnd = min(hitBox.y, maxOpaqueDist);
  if (tEnd <= tStart + 0.001) {
    discard;
  }

  let iso = 0.68;
  let stepLen = 0.016;
  var t = tStart;
  let startSample = sampleWaterField(ro + rd * (tStart + 0.003));
  let startedInsideWater = startSample.r >= iso;

  var hitSurface = false;
  var hitPos = ro + rd * tStart;
  var hitN = vec3<f32>(0.0, 1.0, 0.0);
  var waterTravel = 0.0;
  var internalReflectMix = 0.0;
  var internalRCol = vec3<f32>(0.0);

  if (startedInsideWater) {
    // Camera ray entered through wet glass wall directly below the waterline!
    hitSurface = true;
    // Outward normal of the flat tank boundary face that we entered
    let pEnter = ro + rd * tStart;
    let dMin = abs(pEnter - boxMin);
    let dMax = abs(boxMax - pEnter);
    if (dMax.z < 0.012)      { hitN = vec3<f32>(0.0, 0.0,  1.0); }
    else if (dMin.z < 0.012) { hitN = vec3<f32>(0.0, 0.0, -1.0); }
    else if (dMax.x < 0.012) { hitN = vec3<f32>(1.0, 0.0,  0.0); }
    else if (dMin.x < 0.012) { hitN = vec3<f32>(-1.0, 0.0, 0.0); }
    else                     { hitN = vec3<f32>(0.0, 1.0,  0.0); }

    // March through underwater volume to measure water thickness AND detect underside of wavy surface (total internal reflection!)
    var prevT = tStart;
    t = tStart + stepLen * 1.4;
    for (var stepIdx: u32 = 0u; stepIdx < 160u; stepIdx++) {
      if (t >= tEnd) {
        waterTravel += (tEnd - prevT);
        break;
      }
      let dVal = sampleWaterField(ro + rd * t).r;
      if (dVal < iso && t < tEnd - 0.045) {
        // Hit underside of wavy water surface from below! Refine via bisection!
        var a = prevT;
        var b = t;
        for (var bi: u32 = 0u; bi < 4u; bi++) {
          let m = 0.5 * (a + b);
          if (sampleWaterField(ro + rd * m).r >= iso) { a = m; } else { b = m; }
        }
        let uPos = ro + rd * a;
        waterTravel += (a - tStart);
        let underN = -sampleRefinedNormal(uPos); // points downward into water
        let cosI = max(0.0, dot(-rd, underN));
        // Snell's window / Total internal reflection (n1=1.333 -> n2=1.0, critical cosTheta ~ 0.661)
        let tir = smoothstep(0.72, 0.52, cosI);
        let rUnder = reflect(rd, underN);
        internalRCol = sampleStudioEnv(vec3<f32>(rUnder.x, abs(rUnder.y) * 0.65 + 0.15, rUnder.z)) * vec3<f32>(0.62, 0.86, 0.96);
        internalReflectMix = 0.12 + 0.52 * tir;
        break;
      }
      prevT = t;
      t += stepLen * 1.5;
    }
    if (waterTravel <= 0.0) {
      waterTravel = tEnd - tStart;
    }
  } else {
    // Camera ray entered air space of tank -> march until hitting free water surface (waves, cavities, splash crowns!)
    var prevT = tStart;
    t = tStart + stepLen * 0.65;
    for (var stepIdx: u32 = 0u; stepIdx < 210u; stepIdx++) {
      if (t > tEnd) { break; }
      let pSample = ro + rd * t;
      let dVal = sampleWaterField(pSample).r;
      if (dVal >= iso) {
        var a = prevT;
        var b = t;
        for (var bi: u32 = 0u; bi < 5u; bi++) {
          let m = 0.5 * (a + b);
          if (sampleWaterField(ro + rd * m).r >= iso) { b = m; } else { a = m; }
        }
        let tHit = 0.5 * (a + b);
        hitPos = ro + rd * tHit;
        hitN = sampleRefinedNormal(hitPos);
        hitSurface = true;
        waterTravel = max(0.025, min(1.15, tEnd - tHit));
        break;
      }
      prevT = t;
      t += stepLen;
    }
  }

  if (!hitSurface) {
    discard;
  }

  let V = -rd;
  let L = normalize(frame.keyLightDir.xyz);
  let clipHit = frame.viewProj * vec4<f32>(hitPos, 1.0);
  let fragZ = clamp(clipHit.z / clipHit.w, 0.0001, 0.9999);

  // Screen-space refraction through wavy free surface (flat glass side pane uses gentle meniscus distortion only)
  let viewN = (frame.view * vec4<f32>(hitN, 0.0)).xyz;
  let refractStrength = select(0.088, 0.010, startedInsideWater) * min(0.55, waterTravel + 0.08);
  let refOffset = viewN.xy * refractStrength * vec2<f32>(frame.viewport.y * frame.viewport.z, 1.0);

  var refUV = clamp(in.uv - refOffset, vec2<f32>(0.002), vec2<f32>(0.998));
  let refPx = clamp(vec2<i32>(refUV * frame.viewport.xy), vec2<i32>(0), vec2<i32>(frame.viewport.xy) - vec2<i32>(1));
  let checkZ = textureLoad(sceneDepthTex, refPx, 0);
  if (checkZ < fragZ - 0.001) {
    refUV = in.uv; // prevent foreground object bleeding
  }

  // Slight chromatic dispersion in crystal water
  var refractedBg: vec3<f32>;
  refractedBg.r = textureSampleLevel(backdropTex, linearSamp, clamp(refUV + refOffset * 0.06, vec2<f32>(0.002), vec2<f32>(0.998)), 0.0).r;
  refractedBg.g = textureSampleLevel(backdropTex, linearSamp, refUV, 0.0).g;
  refractedBg.b = textureSampleLevel(backdropTex, linearSamp, clamp(refUV - refOffset * 0.06, vec2<f32>(0.002), vec2<f32>(0.998)), 0.0).b;

  // Beer-Lambert crystal pale-aqua absorption + subtle deep cyan inscatter
  let absorb = exp(-vec3<f32>(0.48, 0.135, 0.075) * waterTravel);
  let inscatter = vec3<f32>(0.025, 0.095, 0.135) * (1.0 - exp(-waterTravel * 1.45));
  var waterBody = refractedBg * absorb + inscatter;

  if (internalReflectMix > 0.001) {
    waterBody = mix(waterBody, internalRCol, internalReflectMix);
  }

  var finalCol = waterBody;
  if (!startedInsideWater) {
    // True air-water dielectric Fresnel reflection (F0 = 0.020) + crisp studio specular!
    let ndotv = max(0.001, dot(hitN, V));
    let fresnel = 0.020 + 0.980 * pow(1.0 - ndotv, 5.0);
    let R = reflect(-V, hitN);
    let envRefl = sampleStudioEnv(R);

    let H = normalize(L + V);
    let specSun = pow(max(0.0, dot(hitN, H)), 320.0) * 2.35;
    let specGlint = pow(max(0.0, dot(hitN, H)), 38.0) * 0.12;

    // Subtle aerated turquoise-white subsurface glow in thin steep wave crests!
    let crestThin = smoothstep(0.28, 0.04, waterTravel) * smoothstep(0.45, 0.72, hitPos.y);
    let crestSSS = vec3<f32>(0.18, 0.42, 0.48) * crestThin * 0.55;

    finalCol = mix(waterBody + crestSSS, envRefl, clamp(fresnel * 0.94, 0.0, 0.92)) + vec3<f32>(specSun + specGlint);
  } else {
    // Subtle top waterline meniscus gleam right along the glass interface!
    let dAbove = sampleWaterField(ro + rd * tStart + vec3<f32>(0.0, 0.018, 0.0)).r;
    let meniscus = smoothstep(iso + 0.25, iso - 0.15, dAbove);
    finalCol += vec3<f32>(0.24, 0.34, 0.42) * meniscus * 0.65;
  }

  var out: FSOut;
  out.color = vec4<f32>(finalCol, 1.0);
  out.depth = fragZ;
  return out;
}
`
      });

      this.waterRayPipeline = dev.createRenderPipeline({
        layout: 'auto',
        vertex: { module: waterRayModule, entryPoint: 'vsMain' },
        fragment: { module: waterRayModule, entryPoint: 'fsMain', targets: [{ format: 'rgba16float' }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less-equal' }
      });

      // 4. Airborne Splash Droplets Pipeline (renders isolated low-density FLIP particles as refractive 3D beads!)
      const dropletModule = dev.createShaderModule({
        code: App.STUDIO_COMMON_WGSL + /* wgsl */ `
@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var<storage, read> pPos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> pVel: array<vec4<f32>>;
@group(0) @binding(3) var backdropTex: texture_2d<f32>;
@group(0) @binding(4) var linearSamp: sampler;

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) uvQuad: vec2<f32>,
  @location(1) worldPos: vec3<f32>,
};

@vertex
fn vsMain(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VSOut {
  var out: VSOut;
  let cDens = pVel[iid].w;
  let pos = pPos[iid].xyz;
  let spd = length(pVel[iid].xyz);

  // Only draw genuinely airborne / crown splash droplets that escaped continuous fluid body!
  if (cDens > 0.42 || pos.y < 0.44 || spd < 0.65) {
    out.clipPos = vec4<f32>(0.0, 0.0, 2.0, 1.0);
    out.uvQuad = vec2<f32>(0.0);
    out.worldPos = pos;
    return out;
  }

  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0,  1.0), vec2<f32>(-1.0,  1.0)
  );
  let q = corners[vid];
  let rad = mix(0.011, 0.0065, clamp(cDens, 0.0, 0.9));

  // Camera-facing billboard
  let right = vec3<f32>(frame.view[0][0], frame.view[1][0], frame.view[2][0]);
  let up = vec3<f32>(frame.view[0][1], frame.view[1][1], frame.view[2][1]);
  let wp = pos + (right * q.x + up * q.y) * rad;

  out.clipPos = frame.viewProj * vec4<f32>(wp, 1.0);
  out.uvQuad = q;
  out.worldPos = wp;
  return out;
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.uvQuad, in.uvQuad);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let viewN = vec3<f32>(in.uvQuad.x, in.uvQuad.y, nz);

  let screenUV = in.clipPos.xy * frame.viewport.zw;
  let refUV = clamp(screenUV - viewN.xy * 0.018, vec2<f32>(0.002), vec2<f32>(0.998));
  let bg = textureSampleLevel(backdropTex, linearSamp, refUV, 0.0).rgb * vec3<f32>(0.90, 0.97, 1.0);

  let fres = 0.04 + 0.85 * pow(1.0 - nz, 4.0);
  let spec = pow(max(0.0, dot(viewN, normalize(vec3<f32>(0.35, 0.65, 0.68)))), 48.0) * 1.45;
  let col = mix(bg, vec3<f32>(0.65, 0.82, 0.96), fres * 0.65) + vec3<f32>(spec);
  let alpha = smoothstep(1.0, 0.72, r2) * 0.88;
  return vec4<f32>(col, alpha);
}
`
      });

      this.dropletPipeline = dev.createRenderPipeline({
        layout: 'auto',
        vertex: { module: dropletModule, entryPoint: 'vsMain' },
        fragment: {
          module: dropletModule,
          entryPoint: 'fsMain',
          targets: [{
            format: 'rgba16float',
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
            }
          }]
        },
        primitive: { topology: 'triangle-list' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'less-equal' }
      });

      // 5. Unified Whitewater (Spray, Drifting Surface Foam & Underwater Rising Bubbles) Pipeline
      const wwModule = dev.createShaderModule({
        code: App.STUDIO_COMMON_WGSL + /* wgsl */ `
struct WWParticle {
  posLife: vec4<f32>,
  velKind: vec4<f32>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var<storage, read> wwBuf: array<WWParticle>;

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) uvQuad: vec2<f32>,
  @location(1) lifeKind: vec2<f32>,
};

@vertex
fn vsMain(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VSOut {
  var out: VSOut;
  let p = wwBuf[iid];
  let life = p.posLife.w;
  if (life <= 0.005) {
    out.clipPos = vec4<f32>(0.0, 0.0, 2.0, 1.0);
    out.uvQuad = vec2<f32>(0.0);
    out.lifeKind = vec2<f32>(0.0);
    return out;
  }

  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0,  1.0), vec2<f32>(-1.0,  1.0)
  );
  let q = corners[vid];
  let kind = p.velKind.w;
  // Foam puffs slightly wider & softer; underwater bubbles crisp small beads; spray fine mist
  var size = 0.011;
  if (kind > 1.5) { size = 0.0085; }
  else if (kind > 0.5) { size = 0.0155 * clamp(life * 0.85, 0.35, 1.15); }
  else { size = 0.0095; }

  let right = vec3<f32>(frame.view[0][0], frame.view[1][0], frame.view[2][0]);
  let up = vec3<f32>(frame.view[0][1], frame.view[1][1], frame.view[2][1]);
  let wp = p.posLife.xyz + (right * q.x + up * q.y) * size;

  out.clipPos = frame.viewProj * vec4<f32>(wp, 1.0);
  out.uvQuad = q;
  out.lifeKind = vec2<f32>(life, kind);
  return out;
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.uvQuad, in.uvQuad);
  if (r2 > 1.0) { discard; }

  let life = in.lifeKind.x;
  let kind = in.lifeKind.y;
  let fade = clamp(life * 1.1, 0.0, 1.0);

  if (kind > 1.5) {
    // Underwater Bubble: hollow glossy rim + top-right glint!
    let r = sqrt(r2);
    let ring = smoothstep(0.32, 0.88, r) * (1.0 - smoothstep(0.88, 1.0, r));
    let glint = exp(-length(in.uvQuad - vec2<f32>(0.32, 0.36)) * 5.5);
    let col = vec3<f32>(0.78, 0.94, 1.0) * (ring * 1.1 + glint * 1.6 + 0.15);
    let alpha = clamp((ring * 0.65 + glint * 0.85 + 0.08 * (1.0 - r2)) * fade, 0.0, 0.85);
    return vec4<f32>(col, alpha);
  } else if (kind > 0.5) {
    // Drifting Surface Whitewater Foam: aerated bright white with soft 3D spherical shading!
    let nz = sqrt(max(0.0, 1.0 - r2));
    let shade = 0.72 + 0.35 * (in.uvQuad.y * 0.6 + nz * 0.4);
    let col = vec3<f32>(0.92, 0.96, 0.99) * shade;
    let alpha = (1.0 - r2) * (1.0 - r2) * 0.56 * fade;
    return vec4<f32>(col, alpha);
  } else {
    // Airborne Fine Spray Mist
    let col = vec3<f32>(0.88, 0.95, 1.0);
    let alpha = (1.0 - r2) * 0.46 * fade;
    return vec4<f32>(col, alpha);
  }
}
`
      });

      this.wwPipeline = dev.createRenderPipeline({
        layout: 'auto',
        vertex: { module: wwModule, entryPoint: 'vsMain' },
        fragment: {
          module: wwModule,
          entryPoint: 'fsMain',
          targets: [{
            format: 'rgba16float',
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
            }
          }]
        },
        primitive: { topology: 'triangle-list' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'less-equal' }
      });

      // 6. Crystal Glass Tank Walls, Beveled Edge Specular Highlights & Water-Level Scale Etchings!
      const glassModule = dev.createShaderModule({
        code: App.STUDIO_COMMON_WGSL + /* wgsl */ `
@group(0) @binding(0) var<uniform> frame: FrameUniforms;

struct VSIn {
  @location(0) pos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uvWall: vec2<f32>,
  @location(3) bevelAndId: vec2<f32>,
};

struct VSOut {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uvWall: vec2<f32>,
  @location(3) bevelAndId: vec2<f32>,
};

@vertex
fn vsMain(in: VSIn) -> VSOut {
  var out: VSOut;
  out.clipPos = frame.viewProj * vec4<f32>(in.pos, 1.0);
  out.worldPos = in.pos;
  out.normal = in.normal;
  out.uvWall = in.uvWall;
  out.bevelAndId = in.bevelAndId;
  return out;
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  let N = normalize(in.normal);
  let V = normalize(frame.cameraPos.xyz - in.worldPos);
  let L = normalize(frame.keyLightDir.xyz);
  let isBevel = in.bevelAndId.x > 0.5;
  let wallId = in.bevelAndId.y;
  let fwYCm = max(0.02, fwidth(in.worldPos.y * 50.0));
  let fwY10 = max(0.01, fwidth(in.worldPos.y * 10.0));

  let ndotv = abs(dot(N, V));
  let R = reflect(-V, sign(dot(N, V)) * N);
  let env = sampleStudioEnv(R);
  let H = normalize(L + V);
  let spec = pow(max(0.0, dot(sign(dot(N, V)) * N, H)), 240.0);

  if (isBevel) {
    // Crisp, bright borosilicate glass edge highlight (slightly aqua-tinted crown glass!)
    let col = vec3<f32>(0.55, 0.82, 0.94) * 0.48 + env * 0.72 + vec3<f32>(spec * 2.2);
    return vec4<f32>(col, 0.62);
  }

  // Flat glass wall: ultra-clean low reflection so tank interior is NEVER obscured!
  let fres = 0.012 + 0.14 * pow(1.0 - ndotv, 5.0);
  // Subtle edge rim boost near perimeter of glass pane
  let borderX = min(in.uvWall.x, 1.0 - in.uvWall.x);
  let borderY = min(in.uvWall.y, 1.0 - in.uvWall.y);
  let edgeLine = 1.0 - smoothstep(0.0, 0.008, min(borderX * 2.5, borderY));

  // Precision etched water-level graduation ticks on the front glass wall (near x = -0.95m and +1.28m)
  var tickMark = 0.0;
  if (wallId > 2.5 && wallId < 3.5 && in.worldPos.y > 0.05 && in.worldPos.y < 0.95) {
    let nearLeftScale = abs(in.worldPos.x - (-1.05));
    let nearRightScale = abs(in.worldPos.x - 1.28);
    let minScaleDist = min(nearLeftScale, nearRightScale);
    if (minScaleDist < 0.032) {
      let yCm = in.worldPos.y * 50.0; // every 2cm minor, every 10cm major
      let dMinor = abs(fract(yCm + 0.5) - 0.5) / fwYCm;
      let dMajor = abs(fract(in.worldPos.y * 10.0 + 0.5) - 0.5) / fwY10;
      let wMinor = step(minScaleDist, 0.012) * (1.0 - clamp(dMinor, 0.0, 1.0));
      let wMajor = step(minScaleDist, 0.024) * (1.0 - clamp(dMajor, 0.0, 1.0));
      tickMark = max(wMinor * 0.45, wMajor * 0.85);
    }
  }

  let glassCol = env * 0.85 + vec3<f32>(0.55, 0.85, 0.96) * edgeLine * 0.65 + vec3<f32>(0.90, 0.96, 1.0) * tickMark + vec3<f32>(spec * 0.8);
  let alpha = clamp(fres * 0.72 + edgeLine * 0.34 + tickMark * 0.52, 0.0, 0.65);
  return vec4<f32>(glassCol, alpha);
}
`
      });

      this.glassPipeline = dev.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: glassModule,
          entryPoint: 'vsMain',
          buffers: [{
            arrayStride: 40,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x3' },
              { shaderLocation: 2, offset: 24, format: 'float32x2' },
              { shaderLocation: 3, offset: 32, format: 'float32x2' }
            ]
          }]
        },
        fragment: {
          module: glassModule,
          entryPoint: 'fsMain',
          targets: [{
            format: 'rgba16float',
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
            }
          }]
        },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'less-equal' }
      });

      this.glassBG = dev.createBindGroup({
        layout: this.glassPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this.gpu.frameUniformBuffer } }]
      });

      this.wwBG = dev.createBindGroup({
        layout: this.wwPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuffer } },
          { binding: 1, resource: { buffer: this.fluid.whitewaterBuf } }
        ]
      });

      this.sphereTankBG = this.gpu.makeSphereBindGroup(this.fluid.causticTexView);

      this.terrBG = dev.createBindGroup({
        layout: this.terrPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuffer } },
          { binding: 1, resource: { buffer: this.tankUniBuf } },
          { binding: 2, resource: this.fluid.causticTexView },
          { binding: 3, resource: this.gpu.shadowView },
          { binding: 4, resource: this.gpu.shadowSampler },
          { binding: 5, resource: this.gpu.linearSampler },
          { binding: 6, resource: { buffer: this.fluid.tankSpheresBuf } }
        ]
      });
    }

    rebuildBindGroups() {
      const gpu = this.gpu;
      this.waterRayBG = this.device.createBindGroup({
        layout: this.waterRayPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: gpu.frameUniformBuffer } },
          { binding: 1, resource: { buffer: this.tankUniBuf } },
          { binding: 2, resource: this.fluid.waterTex3DView },
          { binding: 3, resource: gpu.hdrCopyView },
          { binding: 4, resource: gpu.depthCopyView },
          { binding: 5, resource: gpu.linearSampler }
        ]
      });

      this.dropletBG = this.device.createBindGroup({
        layout: this.dropletPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: gpu.frameUniformBuffer } },
          { binding: 1, resource: { buffer: this.fluid.posBuf } },
          { binding: 2, resource: { buffer: this.fluid.velBuf } },
          { binding: 3, resource: gpu.hdrCopyView },
          { binding: 4, resource: gpu.linearSampler }
        ]
      });
    }

    render(encoder, camera) {
      const gpu = this.gpu;
      const fluid = this.fluid;
      if (gpu.resizeToWindow()) {
        this.rebuildBindGroups();
      }

      camera.updateMatrices(gpu.width / gpu.height);
      gpu.updateFrameUniforms(camera, fluid.simTime, 1, 1.82, -0.006, 0.62, 1.06);

      // Update tank uniforms (static vs moving paddle mesh)
      this.tankUniData[0] = fluid.paddleX;
      this.tankUniData[1] = 0.0;
      this.tankUniData[2] = fluid.numSpheres;
      this.tankUniData[3] = fluid.restWaterHeight;
      this.device.queue.writeBuffer(this.tankUniBuf, 0, this.tankUniData);

      this.tankUniData[1] = 1.0;
      this.device.queue.writeBuffer(this.tankUniMovingBuf, 0, this.tankUniData);

      // 1. Reconstruct 3D Water Density Field + Real-Time Caustics + Pack Spheres on GPU!
      fluid.encodeRenderFields(encoder);
      {
        const cpass = encoder.beginComputePass();
        cpass.setPipeline(this.packSpheresPipe);
        cpass.setBindGroup(0, this.packSpheresBG);
        cpass.dispatchWorkgroups(2);
        cpass.end();
      }

      // 2. Shadow Map Pass (Multi-Density Spheres cast real shadows onto underwater terrain & each other!)
      {
        const spass = encoder.beginRenderPass({
          colorAttachments: [],
          depthStencilAttachment: {
            view: gpu.shadowView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });
        gpu.drawSpheresShadow(spass, fluid.numSpheres);
        spass.end();
      }

      // 3. Opaque Scene Pass: Studio Backdrop + Bench Plinth + Underwater Terrain (with Caustics!) + Wavemaker + Spheres
      {
        const opass = encoder.beginRenderPass({
          colorAttachments: [{
            view: gpu.hdrView,
            clearValue: { r: 0.05, g: 0.07, b: 0.10, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
          }],
          depthStencilAttachment: {
            view: gpu.depthView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });

        gpu.drawBackgroundAndPlinth(opass);

        // Sculpted underwater bathymetry
        opass.setPipeline(this.terrPipeline);
        opass.setBindGroup(0, this.terrBG);
        opass.setVertexBuffer(0, this.terrVtxBuf);
        opass.setIndexBuffer(this.terrIdxBuf, 'uint32');
        opass.drawIndexed(this.terrIdxCount);

        // Visible Wavemaker Rig (Static frame + Moving piston plate!)
        opass.setPipeline(this.wmPipeline);
        opass.setBindGroup(0, this.wmStaticBG);
        opass.setVertexBuffer(0, this.wmStaticVtxBuf);
        opass.setIndexBuffer(this.wmStaticIdxBuf, 'uint32');
        opass.drawIndexed(this.wmStaticIdxCount);

        opass.setBindGroup(0, this.wmMovingBG);
        opass.setVertexBuffer(0, this.wmMovingVtxBuf);
        opass.setIndexBuffer(this.wmMovingIdxBuf, 'uint32');
        opass.drawIndexed(this.wmMovingIdxCount);

        // Multi-density rigid spheres
        gpu.drawSpheres(opass, fluid.numSpheres, this.sphereTankBG);
        opass.end();
      }

      // 4. Copy HDR Scene + Depth so Raymarched Water & Splash Droplets Refract Actual Tank Interior!
      gpu.copySceneBackdrop(encoder);

      // 5. Raymarched 3D Free-Surface & Volumetric Water Pass
      {
        const wpass = encoder.beginRenderPass({
          colorAttachments: [{ view: gpu.hdrView, loadOp: 'load', storeOp: 'store' }],
          depthStencilAttachment: { view: gpu.depthView, depthLoadOp: 'load', depthStoreOp: 'store' }
        });
        wpass.setPipeline(this.waterRayPipeline);
        wpass.setBindGroup(0, this.waterRayBG);
        wpass.draw(3);
        wpass.end();
      }

      // 6. Airborne Splash Droplets + Whitewater (Spray / Foam / Bubbles) + Beveled Crystal Glass Tank Walls
      {
        const tpass = encoder.beginRenderPass({
          colorAttachments: [{ view: gpu.hdrView, loadOp: 'load', storeOp: 'store' }],
          depthStencilAttachment: { view: gpu.depthView, depthLoadOp: 'load', depthStoreOp: 'store' }
        });

        if (fluid.numParticles > 0) {
          tpass.setPipeline(this.dropletPipeline);
          tpass.setBindGroup(0, this.dropletBG);
          tpass.draw(6, fluid.numParticles);
        }

        tpass.setPipeline(this.wwPipeline);
        tpass.setBindGroup(0, this.wwBG);
        tpass.draw(6, TC.MAX_WHITEWATER);

        tpass.setPipeline(this.glassPipeline);
        tpass.setBindGroup(0, this.glassBG);
        tpass.setVertexBuffer(0, this.glassVtxBuf);
        tpass.setIndexBuffer(this.glassIdxBuf, 'uint32');
        tpass.drawIndexed(this.glassIdxCount);

        tpass.end();
      }

      // 7. ACES Tone Mapping to Canvas
      gpu.runTonemapToCanvas(encoder);
    }
  }

  App.TankRenderer = TankRenderer;
})();
