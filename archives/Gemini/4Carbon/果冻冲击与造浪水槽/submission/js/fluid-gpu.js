(function () {
  const App = (window.App = window.App || {});
  const M = App.Math;

  // Tank interior domain:
  // X in [-1.44, +1.44] (Lx = 2.88m, NX = 144, h = 0.02m)
  // Y in [ 0.00, +1.12] (Ly = 1.12m, NY = 56,  h = 0.02m)
  // Z in [-0.36, +0.36] (Lz = 0.72m, NZ = 36,  h = 0.02m)
  const TANK_MIN_X = -1.44;
  const TANK_MAX_X = 1.44;
  const TANK_MIN_Y = 0.0;
  const TANK_MAX_Y = 1.12;
  const TANK_MIN_Z = -0.36;
  const TANK_MAX_Z = 0.36;

  const NX = 144;
  const NY = 56;
  const NZ = 36;
  const CELL_H = 0.02;

  // Padded MAC strides so u (NX+1), v (NY+1), w (NZ+1) share one unified index formula
  const SX = NX + 1; // 145
  const SY = NY + 1; // 57
  const SZ = NZ + 1; // 37
  const MAC_SLICE = SX * SY * SZ; // 305,805

  // 3D Render Density Grid (1.333cm voxels)
  const R_NX = 216;
  const R_NY = 84;
  const R_NZ = 54;
  const R_TOTAL = R_NX * R_NY * R_NZ; // 979,776

  // Caustic 2D Grid
  const C_NX = 256;
  const C_NZ = 128;

  const MAX_WHITEWATER = 65536;
  const MAX_TANK_SPHERES = 64;

  // Exact smooth underwater bathymetry function (JS mirror of WGSL terrainHeight)
  function evalTerrainHeightJS(x, z) {
    // 1. Shoaling sandbar / ramp starting smoothly at x = 0.10, cresting around x = 0.68, descending after 0.96
    const up = M.smoothstep(0.08, 0.66, x);
    const down = 1.0 - 0.62 * M.smoothstep(0.84, 1.24, x);
    const bar = 0.145 * up * down;

    // 2. Sculpted 3D submerged reef knoll on the back-center side (z = -0.13), leaving a bypass channel on +z!
    const dx = (x - 0.64) / 0.27;
    const dz = (z + 0.13) / 0.21;
    const r2 = dx * dx + dz * dz;
    const knoll = 0.132 * Math.exp(-r2 * 1.45);

    // 3. Subtle secondary front-right pebble ridge + far-wall toe fillet
    const dx2 = (x - 0.92) / 0.20;
    const dz2 = (z - 0.16) / 0.17;
    const ridge2 = 0.052 * Math.exp(-(dx2 * dx2 + dz2 * dz2) * 1.6);

    const toe = 0.045 * M.smoothstep(1.30, 1.44, x);
    return bar + knoll + ridge2 + toe;
  }

  const FLUID_COMMON_WGSL = /* wgsl */ `
const TANK_MIN_X: f32 = -1.44;
const TANK_MAX_X: f32 =  1.44;
const TANK_MIN_Y: f32 =  0.00;
const TANK_MAX_Y: f32 =  1.12;
const TANK_MIN_Z: f32 = -0.36;
const TANK_MAX_Z: f32 =  0.36;

const NX: u32 = 144u;
const NY: u32 = 56u;
const NZ: u32 = 36u;
const CELL_H: f32 = 0.02;
const INV_H: f32 = 50.0;

const SX: u32 = 145u;
const SY: u32 = 57u;
const SZ: u32 = 37u;
const MAC_SLICE: u32 = 305805u;

const R_NX: u32 = 216u;
const R_NY: u32 = 84u;
const R_NZ: u32 = 54u;

const C_NX: u32 = 256u;
const C_NZ: u32 = 128u;

const FIXED_SCALE: f32 = 2048.0;
const INV_FIXED_SCALE: f32 = 1.0 / 2048.0;
const REST_DENSITY: f32 = 4.0;

struct SimParams {
  dt: f32,
  gravity: f32,
  paddleX: f32,
  paddleVel: f32,

  numParticles: u32,
  numSpheres: u32,
  sorColor: u32,
  stepCounter: u32,

  flipRatio: f32,
  driftGain: f32,
  simTime: f32,
  waveRunning: f32,

  groupDensities: vec4<f32>, // live densities (g/cm^3) for groups 0, 1, 2, 3
};

struct TankSphere {
  posRad: vec4<f32>,     // xyz: pos, w: radius
  velDens: vec4<f32>,    // xyz: vel, w: densityRatio
  angGroup: vec4<f32>,   // xyz: omega, w: groupIndex (0..3)
  quat: vec4<f32>,       // xyzw: orientation quaternion
  colSub: vec4<f32>,     // rgb: color, w: submergedFraction
  prevSplash: vec4<f32>, // xyz: prevSubstepPos, w: splashImpulseAccumulator
};

struct WhitewaterParticle {
  posLife: vec4<f32>, // xyz: pos, w: remainingLife (<=0 inactive)
  velKind: vec4<f32>, // xyz: vel, w: kind (0=spray, 1=foam, 2=bubble)
};

fn macIdx(i: u32, j: u32, k: u32) -> u32 {
  return (k * SY + j) * SX + i;
}

fn sCurve(e0: f32, e1: f32, x: f32) -> f32 {
  let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

fn terrainHeight(x: f32, z: f32) -> f32 {
  let up = sCurve(0.08, 0.66, x);
  let down = 1.0 - 0.62 * sCurve(0.84, 1.24, x);
  let bar = 0.145 * up * down;

  let dx = (x - 0.64) / 0.27;
  let dz = (z + 0.13) / 0.21;
  let knoll = 0.132 * exp(-(dx * dx + dz * dz) * 1.45);

  let dx2 = (x - 0.92) / 0.20;
  let dz2 = (z - 0.16) / 0.17;
  let ridge2 = 0.052 * exp(-(dx2 * dx2 + dz2 * dz2) * 1.6);

  let toe = 0.045 * sCurve(1.30, 1.44, x);
  return bar + knoll + ridge2 + toe;
}

fn terrainNormal(x: f32, z: f32) -> vec3<f32> {
  let eps = 0.012;
  let hx = terrainHeight(x + eps, z) - terrainHeight(x - eps, z);
  let hz = terrainHeight(x, z + eps) - terrainHeight(x, z - eps);
  return normalize(vec3<f32>(-hx, 2.0 * eps, -hz));
}

fn hashU32(nIn: u32) -> f32 {
  var n = nIn;
  n = (n << 13u) ^ n;
  n = n * (n * n * 15731u + 789221u) + 1376312589u;
  return f32(n & 0x00ffffffu) / f32(0x01000000);
}
`;

  class FluidTankGPU {
    constructor(gpu, sound) {
      this.gpu = gpu;
      this.device = gpu.device;
      this.sound = sound;

      this.params = {
        waveAmp: 0.58,         // [0.05 .. 1.0] -> maps to piston stroke amplitude
        waveFreq: 0.78,        // Hz [0.35 .. 1.45]
        densities: [0.35, 0.72, 1.00, 2.65] // 4 distinct density groups!
      };

      this.groupColors = [
        [1.00, 0.28, 0.20], // Group 0: Coral Vermilion (Low density ~0.35)
        [1.00, 0.73, 0.06], // Group 1: Sunburst Amber (Sub-surface ~0.72)
        [0.08, 0.82, 0.48], // Group 2: Vivid Emerald (Neutral ~1.00)
        [0.54, 0.26, 0.96]  // Group 3: Royal Amethyst (High density ~2.65)
      ];

      this.ballRadius = 0.064;
      this.restWaterHeight = 0.43;
      this.paddleRestX = -1.26;
      this.paddleX = this.paddleRestX;
      this.paddleVel = 0.0;
      this.waveRunning = false;
      this.waveEnvelope = 0.0;
      this.wavePhase = 0.0;
      this.flipRatio = 0.965;

      this.simTime = 0.0;
      this.stepCounter = 0;
      this.numParticles = 0;
      this.numSpheres = 0;
      this.cpuSpheresShadow = []; // initial/spawn mirror + async audio feedback

      this._initBuffers();
      this._createComputePipelines();
      this.resetTank(true);
    }

    _initBuffers() {
      const dev = this.device;

      // Max 320,000 3D FLIP particles
      this.maxParticles = 320000;
      this.posBuf = dev.createBuffer({
        size: this.maxParticles * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.velBuf = dev.createBuffer({
        size: this.maxParticles * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });

      // 7 slices of MAC_SLICE atomic<i32>
      this.atomicAccumBuf = dev.createBuffer({
        size: 7 * MAC_SLICE * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      // 2 slices of MAC_SLICE vec4<f32> (velNew + fluidDensity, velOld + solidFlag)
      this.gridVelBuf = dev.createBuffer({
        size: 2 * MAC_SLICE * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      // 1 slice of MAC_SLICE vec4<f32> (pressure, divRHS, cellType, sphereVolFrac)
      this.gridPressBuf = dev.createBuffer({
        size: MAC_SLICE * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      // Spheres GPU buffer (64 spheres * 96 bytes) + readback staging buffer for UI/audio/shadow
      this.tankSpheresBuf = dev.createBuffer({
        size: MAX_TANK_SPHERES * 96,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      this.sphereReadbackBuf = dev.createBuffer({
        size: MAX_TANK_SPHERES * 96,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      this._mappingSpheres = false;
      this.latestSphereReadback = new Float32Array(MAX_TANK_SPHERES * 24);

      // Whitewater spray/foam/bubble particles + atomic spawn cursor
      this.whitewaterBuf = dev.createBuffer({
        size: MAX_WHITEWATER * 32,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.wwCounterBuf = dev.createBuffer({
        size: 16, // [spawnCursor, activeFoamEstimate, wallSlamAccum, pad]
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });

      // Sim uniform buffer (64 bytes) + dedicated Red/Black SOR uniform buffers so all 36 SOR passes run in 1 compute pass!
      this.simUniformData = new ArrayBuffer(64);
      this.simUniformF32 = new Float32Array(this.simUniformData);
      this.simUniformU32 = new Uint32Array(this.simUniformData);
      this.simUniformBuf = dev.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.sorRedBuf = dev.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.sorBlackBuf = dev.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const redArr = new Uint32Array(16); redArr[6] = 0;
      const blkArr = new Uint32Array(16); blkArr[6] = 1;
      dev.queue.writeBuffer(this.sorRedBuf, 0, redArr);
      dev.queue.writeBuffer(this.sorBlackBuf, 0, blkArr);

      // Render 3D density splat atomic buffer + 3D rgba16float hardware-filterable texture!
      this.renderDensAtomicBuf = dev.createBuffer({
        size: R_TOTAL * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      this.waterTex3D = dev.createTexture({
        size: [R_NX, R_NY, R_NZ],
        dimension: '3d',
        format: 'rgba16float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      });
      this.waterTex3DView = this.waterTex3D.createView({ dimension: '3d' });

      // Caustic 2D atomic buffer + rgba16float 2D texture
      this.causticAtomicBuf = dev.createBuffer({
        size: C_NX * C_NZ * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      this.causticTex = dev.createTexture({
        size: [C_NX, C_NZ, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      });
      this.causticTexView = this.causticTex.createView();
    }

    _createComputePipelines() {
      const dev = this.device;

      // Shader Module 1: Core 3D FLIP + Sphere Hydrodynamics + Whitewater Simulation
      const simShader = dev.createShaderModule({
        code: FLUID_COMMON_WGSL + /* wgsl */ `
@group(0) @binding(0) var<uniform> sim: SimParams;
@group(0) @binding(1) var<storage, read_write> pPos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> pVel: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> accum: array<atomic<i32>>;
@group(0) @binding(4) var<storage, read_write> gridVel: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> gridPress: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> spheres: array<TankSphere>;
@group(0) @binding(7) var<storage, read_write> wwParticles: array<WhitewaterParticle>;
@group(0) @binding(8) var<storage, read_write> wwCounters: array<atomic<u32>>;

// Kernel 1: Clear MAC atomic accumulators & classify solid cells + sphere volume fractions
@compute @workgroup_size(256)
fn csClearAndSolids(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= MAC_SLICE) { return; }

  for (var s: u32 = 0u; s < 7u; s++) {
    atomicStore(&accum[s * MAC_SLICE + idx], 0);
  }

  let i = idx % SX;
  let jk = idx / SX;
  let j = jk % SY;
  let k = jk / SY;

  if (i >= NX || j >= NY || k >= NZ) {
    var gp = gridPress[idx];
    gp.x = 0.0;
    gp.z = 2.0; // SOLID outside domain
    gp.w = 0.0;
    gridPress[idx] = gp;
    return;
  }

  let cx = TANK_MIN_X + (f32(i) + 0.5) * CELL_H;
  let cy = TANK_MIN_Y + (f32(j) + 0.5) * CELL_H;
  let cz = TANK_MIN_Z + (f32(k) + 0.5) * CELL_H;
  let bedY = terrainHeight(cx, cz);

  var cType = 0.0;
  if (cx < sim.paddleX || cy < bedY - 0.25 * CELL_H) {
    cType = 2.0; // SOLID
  }

  // Compute overlapping rigid sphere volume fraction & wake momentum coupling!
  var sphFrac = 0.0;
  var sphVelAcc = vec3<f32>(0.0);
  var sphWAcc = 0.0;
  let nSph = sim.numSpheres;
  for (var s: u32 = 0u; s < nSph; s++) {
    let sp = spheres[s].posRad;
    let d = distance(vec3<f32>(cx, cy, cz), sp.xyz);
    if (d < sp.w + 0.85 * CELL_H) {
      let f = 1.0 - sCurve(sp.w - 0.55 * CELL_H, sp.w + 0.75 * CELL_H, d);
      sphFrac = min(1.0, sphFrac + f);
      let mw = f * clamp(spheres[s].velDens.w, 0.3, 1.8) * 0.85;
      sphVelAcc += spheres[s].velDens.xyz * mw;
      sphWAcc += mw;
    }
  }

  if (sphWAcc > 0.01) {
    let iw = i32(sphWAcc * FIXED_SCALE);
    atomicAdd(&accum[0u * MAC_SLICE + idx], i32(sphVelAcc.x * FIXED_SCALE));
    atomicAdd(&accum[1u * MAC_SLICE + idx], iw);
    atomicAdd(&accum[2u * MAC_SLICE + idx], i32(sphVelAcc.y * FIXED_SCALE));
    atomicAdd(&accum[3u * MAC_SLICE + idx], iw);
    atomicAdd(&accum[4u * MAC_SLICE + idx], i32(sphVelAcc.z * FIXED_SCALE));
    atomicAdd(&accum[5u * MAC_SLICE + idx], iw);
  }

  var prevP = gridPress[idx].x;
  if (cType > 1.5) { prevP = 0.0; }
  gridPress[idx] = vec4<f32>(prevP, 0.0, cType, sphFrac);
}

fn atomicAddStaggered(sliceSum: u32, sliceW: u32, fx: f32, fy: f32, fz: f32, maxI: u32, maxJ: u32, maxK: u32, val: f32) {
  let gx = clamp(fx, 0.0, f32(maxI) - 1.001);
  let gy = clamp(fy, 0.0, f32(maxJ) - 1.001);
  let gz = clamp(fz, 0.0, f32(maxK) - 1.001);

  let i0 = u32(gx); let j0 = u32(gy); let k0 = u32(gz);
  let tx = gx - f32(i0); let ty = gy - f32(j0); let tz = gz - f32(k0);
  let wx0 = 1.0 - tx; let wy0 = 1.0 - ty; let wz0 = 1.0 - tz;

  for (var dk: u32 = 0u; dk < 2u; dk++) {
    let wz = select(wx0, tx, false); // dummy avoid unused
    let kz = select(wz0, tz, dk == 1u);
    for (var dj: u32 = 0u; dj < 2u; dj++) {
      let wy = select(wy0, ty, dj == 1u);
      for (var di: u32 = 0u; di < 2u; di++) {
        let wx = select(wx0, tx, di == 1u);
        let w = wx * wy * kz;
        if (w > 0.0005) {
          let mIdx = macIdx(i0 + di, j0 + dj, k0 + dk);
          let iw = i32(w * FIXED_SCALE);
          let iv = i32(val * w * FIXED_SCALE);
          atomicAdd(&accum[sliceSum * MAC_SLICE + mIdx], iv);
          atomicAdd(&accum[sliceW * MAC_SLICE + mIdx], iw);
        }
      }
    }
  }
}

// Kernel 2: Particle-to-Grid (P2G) onto Staggered MAC faces + cell center density
@compute @workgroup_size(256)
fn csP2G(@builtin(global_invocation_id) gid: vec3<u32>) {
  let pid = gid.x;
  if (pid >= sim.numParticles) { return; }

  let pos = pPos[pid].xyz;
  let vel = pVel[pid].xyz;

  let lx = (pos.x - TANK_MIN_X) * INV_H;
  let ly = (pos.y - TANK_MIN_Y) * INV_H;
  let lz = (pos.z - TANK_MIN_Z) * INV_H;

  // u at (i, j+0.5, k+0.5)
  atomicAddStaggered(0u, 1u, lx, ly - 0.5, lz - 0.5, NX + 1u, NY, NZ, vel.x);
  // v at (i+0.5, j, k+0.5)
  atomicAddStaggered(2u, 3u, lx - 0.5, ly, lz - 0.5, NX, NY + 1u, NZ, vel.y);
  // w at (i+0.5, j+0.5, k)
  atomicAddStaggered(4u, 5u, lx - 0.5, ly - 0.5, lz, NX, NY, NZ + 1u, vel.z);

  // Cell center fluid density at (i+0.5, j+0.5, k+0.5)
  let cx = clamp(lx - 0.5, 0.0, f32(NX) - 1.001);
  let cy = clamp(ly - 0.5, 0.0, f32(NY) - 1.001);
  let cz = clamp(lz - 0.5, 0.0, f32(NZ) - 1.001);
  let i0 = u32(cx); let j0 = u32(cy); let k0 = u32(cz);
  let tx = cx - f32(i0); let ty = cy - f32(j0); let tz = cz - f32(k0);

  for (var dk: u32 = 0u; dk < 2u; dk++) {
    let wz = select(1.0 - tz, tz, dk == 1u);
    for (var dj: u32 = 0u; dj < 2u; dj++) {
      let wy = select(1.0 - ty, ty, dj == 1u);
      for (var di: u32 = 0u; di < 2u; di++) {
        let wx = select(1.0 - tx, tx, di == 1u);
        let w = wx * wy * wz;
        let cIdx = macIdx(i0 + di, j0 + dj, k0 + dk);
        atomicAdd(&accum[6u * MAC_SLICE + cIdx], i32(w * FIXED_SCALE));
      }
    }
  }
}

// Kernel 3a: Finalize MAC velocities, apply gravity & solid/paddle boundary conditions
@compute @workgroup_size(256)
fn csFinalizeGrid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= MAC_SLICE) { return; }

  let i = idx % SX;
  let jk = idx / SX;
  let j = jk % SY;
  let k = jk / SY;

  let uW = atomicLoad(&accum[1u * MAC_SLICE + idx]);
  let vW = atomicLoad(&accum[3u * MAC_SLICE + idx]);
  let wW = atomicLoad(&accum[5u * MAC_SLICE + idx]);
  let dI = atomicLoad(&accum[6u * MAC_SLICE + idx]);

  var u = select(0.0, f32(atomicLoad(&accum[0u * MAC_SLICE + idx])) / f32(uW), uW > 2);
  var v = select(0.0, f32(atomicLoad(&accum[2u * MAC_SLICE + idx])) / f32(vW), vW > 2);
  var w = select(0.0, f32(atomicLoad(&accum[4u * MAC_SLICE + idx])) / f32(wW), wW > 2);
  let dens = f32(dI) * INV_FIXED_SCALE;

  // Save pre-force velocity as velOld for FLIP delta!
  let uOld = u;
  let vOld = v;
  let wOld = w;

  // Add gravity to Y faces that have fluid weight
  if (vW > 2) {
    v += sim.gravity * sim.dt;
  }

  // Classify FLUID vs AIR on non-SOLID cells
  var gp = gridPress[idx];
  if (i < NX && j < NY && k < NZ && gp.z < 1.5) {
    if (dens > 0.14) {
      gp.z = 1.0; // FLUID
    } else {
      gp.z = 0.0; // AIR -> zero Dirichlet pressure
      gp.x = 0.0;
    }
    gridPress[idx] = gp;
  }

  // Enforce solid wall & moving wavemaker boundary conditions on staggered faces!
  let faceX = TANK_MIN_X + f32(i) * CELL_H;
  if (faceX <= sim.paddleX + 0.55 * CELL_H) {
    u = sim.paddleVel;
  }
  if (i == 0u || i >= NX) {
    u = select(0.0, sim.paddleVel, i == 0u && sim.paddleX <= TANK_MIN_X + CELL_H);
    if (i >= NX) { u = 0.0; }
  }
  if (j == 0u || j >= NY) { v = 0.0; }
  if (k == 0u || k >= NZ) { w = 0.0; }

  // Solid terrain boundary check for internal faces
  if (i > 0u && i < NX && j < NY && k < NZ) {
    let leftSolid = gridPress[macIdx(i - 1u, j, k)].z > 1.5;
    let rightSolid = gp.z > 1.5;
    if (leftSolid || rightSolid) {
      u = select(0.0, sim.paddleVel, faceX <= sim.paddleX + 1.15 * CELL_H);
    }
  }
  if (i < NX && j > 0u && j < NY && k < NZ) {
    if (gridPress[macIdx(i, j - 1u, k)].z > 1.5 || gp.z > 1.5) {
      v = 0.0;
    }
  }
  if (i < NX && j < NY && k > 0u && k < NZ) {
    if (gridPress[macIdx(i, j, k - 1u)].z > 1.5 || gp.z > 1.5) {
      w = 0.0;
    }
  }

  gridVel[idx] = vec4<f32>(u, v, w, dens);
  gridVel[MAC_SLICE + idx] = vec4<f32>(uOld, vOld, wOld, gp.z);
}

// Kernel 3b: Compute Divergence RHS + Volume Drift & Sphere Displacement Compensation
@compute @workgroup_size(256)
fn csComputeDivergence(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= MAC_SLICE) { return; }

  let i = idx % SX;
  let jk = idx / SX;
  let j = jk % SY;
  let k = jk / SY;
  if (i >= NX || j >= NY || k >= NZ) { return; }

  var gp = gridPress[idx];
  if (gp.z != 1.0) {
    gp.x = 0.0;
    gp.y = 0.0;
    gridPress[idx] = gp;
    return;
  }

  let u0 = gridVel[idx].x;
  let u1 = gridVel[macIdx(i + 1u, j, k)].x;
  let v0 = gridVel[idx].y;
  let v1 = gridVel[macIdx(i, j + 1u, k)].y;
  let w0 = gridVel[idx].z;
  let w1 = gridVel[macIdx(i, j, k + 1u)].z;

  var div = (u1 - u0) + (v1 - v0) + (w1 - w0);

  // Drift compensation including submerged sphere volume fraction (raises tank water level accurately without wave aeration!)
  let fluidDens = gridVel[idx].w;
  let totalOcc = fluidDens + gp.w * REST_DENSITY;
  let restTarget = REST_DENSITY * 1.08;
  if (totalOcc > restTarget) {
    let compression = min(3.5, totalOcc - restTarget);
    div -= sim.driftGain * compression;
  }

  gp.y = div;
  gridPress[idx] = gp;
}

// Kernel 4: Red-Black Gauss-Seidel SOR Pressure Solver (zero race conditions!)
@compute @workgroup_size(256)
fn csPressureSOR(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= MAC_SLICE) { return; }

  let i = idx % SX;
  let jk = idx / SX;
  let j = jk % SY;
  let k = jk / SY;
  if (i >= NX || j >= NY || k >= NZ) { return; }
  if (((i + j + k) & 1u) != sim.sorColor) { return; }

  var gp = gridPress[idx];
  if (gp.z != 1.0) { return; }

  var s = 0.0;
  var pSum = 0.0;

  // -X
  if (i > 0u) {
    let nb = gridPress[macIdx(i - 1u, j, k)];
    if (nb.z < 1.5) { s += 1.0; pSum += nb.x; }
  }
  // +X
  if (i + 1u < NX) {
    let nb = gridPress[macIdx(i + 1u, j, k)];
    if (nb.z < 1.5) { s += 1.0; pSum += nb.x; }
  }
  // -Y
  if (j > 0u) {
    let nb = gridPress[macIdx(i, j - 1u, k)];
    if (nb.z < 1.5) { s += 1.0; pSum += nb.x; }
  }
  // +Y (open top of tank is AIR -> s += 1.0, p = 0)
  if (j + 1u < NY) {
    let nb = gridPress[macIdx(i, j + 1u, k)];
    if (nb.z < 1.5) { s += 1.0; pSum += nb.x; }
  } else {
    s += 1.0;
  }
  // -Z
  if (k > 0u) {
    let nb = gridPress[macIdx(i, j, k - 1u)];
    if (nb.z < 1.5) { s += 1.0; pSum += nb.x; }
  }
  // +Z
  if (k + 1u < NZ) {
    let nb = gridPress[macIdx(i, j, k + 1u)];
    if (nb.z < 1.5) { s += 1.0; pSum += nb.x; }
  }

  if (s > 0.0) {
    let pTarget = (pSum - gp.y) / s;
    gp.x = mix(gp.x, pTarget, 1.76);
    gridPress[idx] = gp;
  }
}

// Kernel 5: Subtract Pressure Gradient to Make Grid Divergence-Free
@compute @workgroup_size(256)
fn csProjectVelocity(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= MAC_SLICE) { return; }

  let i = idx % SX;
  let jk = idx / SX;
  let j = jk % SY;
  let k = jk / SY;

  var gv = gridVel[idx];
  let gp = gridPress[idx];

  if (i > 0u && i < NX && j < NY && k < NZ) {
    let gpL = gridPress[macIdx(i - 1u, j, k)];
    if (gpL.z < 1.5 && gp.z < 1.5 && (gpL.z == 1.0 || gp.z == 1.0)) {
      gv.x -= (gp.x - gpL.x);
    }
  }
  if (i < NX && j > 0u && j < NY && k < NZ) {
    let gpB = gridPress[macIdx(i, j - 1u, k)];
    if (gpB.z < 1.5 && gp.z < 1.5 && (gpB.z == 1.0 || gp.z == 1.0)) {
      gv.y -= (gp.x - gpB.x);
    }
  }
  if (i < NX && j < NY && k > 0u && k < NZ) {
    let gpF = gridPress[macIdx(i, j, k - 1u)];
    if (gpF.z < 1.5 && gp.z < 1.5 && (gpF.z == 1.0 || gp.z == 1.0)) {
      gv.z -= (gp.x - gpF.x);
    }
  }

  // Far-wall slam audio detector (check high pressure & upward surge at right glass wall i == NX-1)
  if (i == NX - 1u && j > 20u && j < 48u && k == 18u && gp.z == 1.0 && gv.y > 1.35) {
    atomicAdd(&wwCounters[2], u32(min(50.0, gv.y * 10.0)));
  }

  gridVel[idx] = gv;
}

fn sampleMACComponent(comp: u32, sliceOff: u32, fx: f32, fy: f32, fz: f32, maxI: u32, maxJ: u32, maxK: u32) -> f32 {
  let gx = clamp(fx, 0.0, f32(maxI) - 1.001);
  let gy = clamp(fy, 0.0, f32(maxJ) - 1.001);
  let gz = clamp(fz, 0.0, f32(maxK) - 1.001);
  let i0 = u32(gx); let j0 = u32(gy); let k0 = u32(gz);
  let tx = gx - f32(i0); let ty = gy - f32(j0); let tz = gz - f32(k0);

  var acc = 0.0;
  for (var dk: u32 = 0u; dk < 2u; dk++) {
    let wz = select(1.0 - tz, tz, dk == 1u);
    for (var dj: u32 = 0u; dj < 2u; dj++) {
      let wy = select(1.0 - ty, ty, dj == 1u);
      for (var di: u32 = 0u; di < 2u; di++) {
        let wx = select(1.0 - tx, tx, di == 1u);
        let gv = gridVel[sliceOff + macIdx(i0 + di, j0 + dj, k0 + dk)];
        let val = select(select(gv.z, gv.y, comp == 1u), select(gv.w, gv.x, comp == 0u), comp == 0u || comp == 3u);
        acc += val * (wx * wy * wz);
      }
    }
  }
  return acc;
}

fn sampleFluidVelNew(p: vec3<f32>) -> vec3<f32> {
  let lx = (p.x - TANK_MIN_X) * INV_H;
  let ly = (p.y - TANK_MIN_Y) * INV_H;
  let lz = (p.z - TANK_MIN_Z) * INV_H;
  return vec3<f32>(
    sampleMACComponent(0u, 0u, lx, ly - 0.5, lz - 0.5, NX + 1u, NY, NZ),
    sampleMACComponent(1u, 0u, lx - 0.5, ly, lz - 0.5, NX, NY + 1u, NZ),
    sampleMACComponent(2u, 0u, lx - 0.5, ly - 0.5, lz, NX, NY, NZ + 1u)
  );
}

fn sampleFluidVelOld(p: vec3<f32>) -> vec3<f32> {
  let lx = (p.x - TANK_MIN_X) * INV_H;
  let ly = (p.y - TANK_MIN_Y) * INV_H;
  let lz = (p.z - TANK_MIN_Z) * INV_H;
  return vec3<f32>(
    sampleMACComponent(0u, MAC_SLICE, lx, ly - 0.5, lz - 0.5, NX + 1u, NY, NZ),
    sampleMACComponent(1u, MAC_SLICE, lx - 0.5, ly, lz - 0.5, NX, NY + 1u, NZ),
    sampleMACComponent(2u, MAC_SLICE, lx - 0.5, ly - 0.5, lz, NX, NY, NZ + 1u)
  );
}

fn sampleCellDensity(p: vec3<f32>) -> f32 {
  let lx = (p.x - TANK_MIN_X) * INV_H - 0.5;
  let ly = (p.y - TANK_MIN_Y) * INV_H - 0.5;
  let lz = (p.z - TANK_MIN_Z) * INV_H - 0.5;
  return sampleMACComponent(3u, 0u, lx, ly, lz, NX, NY, NZ);
}

// Kernel 6: Two-Way Rigid Sphere Hydrodynamics, Buoyancy, Lift, Rolling & Collisions (single workgroup!)
@compute @workgroup_size(64)
fn csUpdateSpheres(@builtin(local_invocation_id) lid: vec3<u32>) {
  let sid = lid.x;
  let nSph = sim.numSpheres;
  let dt = sim.dt;

  if (sid < nSph) {
    var sp = spheres[sid];
    let r = sp.posRad.w;
    let grp = u32(clamp(sp.angGroup.w, 0.0, 3.0));
    let densRatio = max(0.12, sim.groupDensities[grp]);
    sp.velDens.w = densRatio;
    sp.prevSplash.x = sp.posRad.x;
    sp.prevSplash.y = sp.posRad.y;
    sp.prevSplash.z = sp.posRad.z;

    let prevSub = sp.colSub.w;

    // 27-point Gauss-like 3D quadrature inside sphere [-0.72r, 0, +0.72r]^3 to measure exact submerged fraction & local flow!
    var subSum = 0.0;
    var wFlow = 0.0;
    var uNewAvg = vec3<f32>(0.0);
    var uOldAvg = vec3<f32>(0.0);

    for (var qz: i32 = -1; qz <= 1; qz++) {
      for (var qy: i32 = -1; qy <= 1; qy++) {
        for (var qx: i32 = -1; qx <= 1; qx++) {
          let off = vec3<f32>(f32(qx), f32(qy), f32(qz)) * (r * 0.58);
          let spPt = sp.posRad.xyz + off;
          let cd = sampleCellDensity(spPt);
          // Account for self displacement: inside a submerged sphere, surrounding ring has fluid!
          let sampleShell = sp.posRad.xyz + normalize(off + vec3<f32>(0.0001, 0.0002, 0.0001)) * (r * 1.18);
          let shellD = sampleCellDensity(sampleShell);
          let f = clamp(max(cd, shellD * 0.92) / (REST_DENSITY * 0.72), 0.0, 1.0);
          subSum += f;
          if (f > 0.05) {
            uNewAvg += sampleFluidVelNew(sampleShell) * f;
            uOldAvg += sampleFluidVelOld(sampleShell) * f;
            wFlow += f;
          }
        }
      }
    }

    let eta = clamp(subSum / 27.0, 0.0, 1.0);
    sp.colSub.w = eta;

    // Detect fresh high-speed water entry for procedural splash sound!
    if (prevSub < 0.12 && eta >= 0.12 && sp.velDens.y < -0.45) {
      sp.prevSplash.w = max(sp.prevSplash.w, abs(sp.velDens.y));
    }

    var vel = sp.velDens.xyz;
    var omega = sp.angGroup.xyz;

    // Effective inertial mass includes added mass C_m = 0.5 * eta of displaced water!
    let effMassRatio = densRatio + 0.50 * eta;

    // Gentle physical pycnocline gradient (0.955 near surface -> 1.000 at mid-depth y=0.23m -> 1.052 near bed)
    // so rho ~ 1.00 spheres naturally equilibrate suspended in the mid-water column!
    let effWaterDens = 1.0 + 0.052 * clamp((0.23 - sp.posRad.y) / 0.19, -0.86, 1.0);

    // 1. Gravity + Exact Archimedean Buoyancy: (densRatio - eta * effWaterDens) * g
    var acc = vec3<f32>(0.0, sim.gravity * (densRatio - eta * effWaterDens) / effMassRatio, 0.0);

    if (wFlow > 0.1 && eta > 0.01) {
      let uFluid = uNewAvg / wFlow;
      let uFluidOld = uOldAvg / wFlow;
      let aFluid = clamp((uFluid - uFluidOld) / max(0.0002, dt), vec3<f32>(-35.0), vec3<f32>(35.0));

      // 2. Dynamic Wave Pressure (Froude-Krylov + Added Mass acceleration (1 + Cm) * eta * a_fluid)
      acc += (1.50 * eta / effMassRatio) * aFluid;

      // 3. Linear + Quadratic Hydrodynamic Drag: 3/(8 R) * Cd * |u_rel| * u_rel
      let uRel = uFluid - vel;
      let relSpd = length(uRel);
      let dragCoeff = (0.375 / r) * (0.48 * relSpd + 0.55) * (eta / effMassRatio);
      let dragDv = uRel * min(0.88, dragCoeff * dt);
      vel += dragDv;

      // 4. Shear / Saffman & Bed Bernoulli Lift during strong waves (makes heavy bottom balls briefly lift off bed!)
      let bedH = terrainHeight(sp.posRad.x, sp.posRad.z);
      let gapToBed = (sp.posRad.y - r) - bedH;
      if (gapToBed < r * 0.85) {
        let horizFlow2 = uFluid.x * uFluid.x + uFluid.z * uFluid.z;
        let liftAcc = (0.36 / r) * horizFlow2 * (eta / effMassRatio) * (1.0 - clamp(gapToBed / (r * 0.85), 0.0, 1.0));
        acc.y += min(18.0, liftAcc);
      }

      // 5. Fluid vorticity spin coupling
      let uTop = sampleFluidVelNew(sp.posRad.xyz + vec3<f32>(0.0, r * 1.1, 0.0));
      let uBot = sampleFluidVelNew(sp.posRad.xyz - vec3<f32>(0.0, r * 1.1, 0.0));
      let targetWz = -(uTop.x - uBot.x) / (2.2 * r);
      omega.z = mix(omega.z, targetWz, min(1.0, 2.5 * eta * dt));
      omega *= exp(-1.2 * eta * dt);
    }

    vel += acc * dt;
    var pos = sp.posRad.xyz + vel * dt;

    // Integrate quaternion rotation
    let hRot = 0.5 * omega * dt;
    var q = sp.quat;
    let nq = vec4<f32>(
      q.x + (hRot.y * q.z - hRot.z * q.y + hRot.x * q.w),
      q.y + (hRot.z * q.x - hRot.x * q.z + hRot.y * q.w),
      q.z + (hRot.x * q.y - hRot.y * q.x + hRot.z * q.w),
      q.w - (hRot.x * q.x + hRot.y * q.y + hRot.z * q.z)
    );
    sp.quat = normalize(nq);

    // Collide with smooth analytical underwater terrain + floor (rolling torque!)
    let bedY = terrainHeight(pos.x, pos.z);
    let bedN = terrainNormal(pos.x, pos.z);
    let clearance = (pos.y - bedY) * bedN.y;
    if (pos.y - bedY < r / max(0.5, bedN.y)) {
      pos.y = bedY + r / max(0.5, bedN.y);
      let vn = dot(vel, bedN);
      if (vn < 0.0) {
        vel -= (1.0 + 0.32) * vn * bedN;
      }
      // Rolling contact coupling on tank bed!
      let vt = vel - dot(vel, bedN) * bedN;
      omega.z = mix(omega.z, -vt.x / r, min(1.0, 14.0 * dt));
      omega.x = mix(omega.x,  vt.z / r, min(1.0, 14.0 * dt));
      vel.x *= exp(-0.55 * dt);
      vel.z *= exp(-0.55 * dt);
    }

    // Collide with moving wavemaker paddle & glass tank walls
    let minX = sim.paddleX + 0.018 + r;
    if (pos.x < minX) {
      pos.x = minX;
      vel.x = max(vel.x, sim.paddleVel + abs(vel.x - sim.paddleVel) * 0.45);
    }
    if (pos.x > TANK_MAX_X - r) {
      pos.x = TANK_MAX_X - r;
      if (vel.x > 0.0) { vel.x = -vel.x * 0.52; }
    }
    if (pos.z < TANK_MIN_Z + r) {
      pos.z = TANK_MIN_Z + r;
      if (vel.z < 0.0) { vel.z = -vel.z * 0.52; }
    }
    if (pos.z > TANK_MAX_Z - r) {
      pos.z = TANK_MAX_Z - r;
      if (vel.z > 0.0) { vel.z = -vel.z * 0.52; }
    }
    if (pos.y > TANK_MAX_Y + 0.55) {
      pos.y = TANK_MAX_Y + 0.55;
      if (vel.y > 0.0) { vel.y = -vel.y * 0.3; }
    }

    sp.posRad = vec4<f32>(pos, r);
    sp.velDens = vec4<f32>(vel, densRatio);
    sp.angGroup = vec4<f32>(omega, sp.angGroup.w);
    spheres[sid] = sp;
  }

  workgroupBarrier();

  // Exact All-Pairs Sphere <-> Sphere Collisions (performed deterministically by thread 0 for <= 64 spheres!)
  if (sid == 0u) {
    for (var iter: u32 = 0u; iter < 2u; iter++) {
      for (var a: u32 = 0u; a < nSph; a++) {
        for (var b: u32 = a + 1u; b < nSph; b++) {
          var sa = spheres[a];
          var sb = spheres[b];
          let delta = sb.posRad.xyz - sa.posRad.xyz;
          let dist = length(delta);
          let minDist = sa.posRad.w + sb.posRad.w;
          if (dist < minDist && dist > 0.0001) {
            let n = delta / dist;
            let pen = minDist - dist;
            let wa = 1.0 / max(0.12, sa.velDens.w);
            let wb = 1.0 / max(0.12, sb.velDens.w);
            let wSum = wa + wb;

            sa.posRad = vec4<f32>(sa.posRad.xyz - n * (pen * wa / wSum), sa.posRad.w);
            sb.posRad = vec4<f32>(sb.posRad.xyz + n * (pen * wb / wSum), sb.posRad.w);

            if (iter == 0u) {
              let rv = sb.velDens.xyz - sa.velDens.xyz;
              let vn = dot(rv, n);
              if (vn < 0.0) {
                let restit = 0.68;
                let jImp = -(1.0 + restit) * vn / wSum;
                sa.velDens = vec4<f32>(sa.velDens.xyz - n * (jImp * wa), sa.velDens.w);
                sb.velDens = vec4<f32>(sb.velDens.xyz + n * (jImp * wb), sb.velDens.w);

                // Tangential spin exchange
                let vt = rv - vn * n;
                let tLen = length(vt);
                if (tLen > 0.01) {
                  let tHat = vt / tLen;
                  let jt = min(0.22 * jImp, tLen / (wSum * 3.5));
                  sa.angGroup = vec4<f32>(sa.angGroup.xyz + cross(n, tHat) * (jt * 2.5 * wa / sa.posRad.w), sa.angGroup.w);
                  sb.angGroup = vec4<f32>(sb.angGroup.xyz + cross(n, tHat) * (jt * 2.5 * wb / sb.posRad.w), sb.angGroup.w);
                }
              }
            }
            spheres[a] = sa;
            spheres[b] = sb;
          }
        }
      }
    }
  }
}

fn spawnWhitewater(pos: vec3<f32>, vel: vec3<f32>, kind: f32, life: f32) {
  let slot = atomicAdd(&wwCounters[0], 1u) % 65536u;
  wwParticles[slot].posLife = vec4<f32>(pos, life);
  wwParticles[slot].velKind = vec4<f32>(vel, kind);
}

// Kernel 7: G2P + RK2 Advection + Sphere Cavity/Crown Impulse + Breaking Wave Whitewater Spawning
@compute @workgroup_size(256)
fn csG2PAndAdvect(@builtin(global_invocation_id) gid: vec3<u32>) {
  let pid = gid.x;
  if (pid >= sim.numParticles) { return; }

  var pos = pPos[pid].xyz;
  var cooldown = max(0.0, pPos[pid].w - sim.dt);
  let oldPvel = pVel[pid].xyz;

  let vNew = sampleFluidVelNew(pos);
  let vOld = sampleFluidVelOld(pos);
  let cDens = sampleCellDensity(pos);

  let vPIC = vNew;
  let vFLIP = oldPvel + (vNew - vOld);

  // Airborne droplets (cDens < 0.45) keep ballistic inertia so splash crowns & rebound jets fly cleanly!
  let airBlend = sCurve(0.25, 0.85, cDens);
  var vel = mix(oldPvel + vec3<f32>(0.0, sim.gravity * sim.dt, 0.0), mix(vPIC, vFLIP, sim.flipRatio), airBlend);

  // Midpoint RK2 advection in fluid, ballistic Euler in air
  let midPos = pos + vel * (0.5 * sim.dt);
  let midV = mix(vel, sampleFluidVelNew(midPos), airBlend * 0.75);
  pos += midV * sim.dt;

  // Two-Way Sphere -> Fluid Particle Contact: carves impact cavity, throws crown splash, entrains wake bubbles!
  let nSph = sim.numSpheres;
  let rng = hashU32(pid * 1973u + sim.stepCounter * 9277u);

  for (var s: u32 = 0u; s < nSph; s++) {
    let sp = spheres[s];
    let sCenter = sp.posRad.xyz;
    let sRad = sp.posRad.w;
    let sVel = sp.velDens.xyz;
    let sDens = sp.velDens.w;

    let diff = pos - sCenter;
    let dist = length(diff);
    if (dist < sRad * 1.04) {
      let dir = select(vec3<f32>(0.0, 1.0, 0.0), diff / dist, dist > 0.0001);
      pos = sCenter + dir * (sRad * 1.045);

      let sSpeed = length(sVel);
      // Momentum coupling weighted by ball density (heavy fast balls drive violent craters & tall crowns!)
      let massCoupling = clamp(sDens / (sDens + 0.55), 0.25, 0.92);
      let relN = dot(vel - sVel, dir);
      if (relN < 0.0) {
        vel -= dir * relN * (1.0 + 0.35 * massCoupling);
      }

      // Crown flare during downward plunge!
      if (sVel.y < -0.55 && dir.y > -0.25) {
        let plunge = min(5.5, -sVel.y) * massCoupling;
        let radialDir = normalize(vec3<f32>(dir.x, 0.0, dir.z) + vec3<f32>(0.001, 0.0, 0.001));
        vel += (radialDir * 0.58 + vec3<f32>(0.0, 0.86, 0.0)) * plunge * 0.72;

        if (cooldown <= 0.0 && rng < 0.28 * massCoupling) {
          let jitter = vec3<f32>(hashU32(pid + 11u) - 0.5, hashU32(pid + 23u) - 0.3, hashU32(pid + 37u) - 0.5) * 0.04;
          // Spawn spray/foam around crown rim OR underwater wake bubbles behind sphere!
          if (cDens > 1.6 && pos.y < 0.44) {
            spawnWhitewater(sCenter + vec3<f32>(jitter.x, sRad * 0.7, jitter.z), vel * 0.35 + vec3<f32>(0.0, 0.4, 0.0), 2.0, 1.2 + rng * 1.6);
          } else {
            spawnWhitewater(pos + jitter, vel * 1.12, 0.0, 0.9 + rng * 0.9);
          }
          cooldown = 0.14;
        }
      }
    }
  }

  // Wave Crest Breaking & Wall Slam Whitewater Generation (derived directly from particle state!)
  let spd = length(vel);
  let accelMag = length(vNew - vOld) / max(0.0005, sim.dt);
  if (cooldown <= 0.0 && cDens > 0.20 && cDens < 2.85 && pos.y > 0.32) {
    // Plunging / overturning crest or far-wall splash criteria
    let isCrestBreak = (spd > 1.18 && (vel.x > 0.75 || pos.x > 1.18) && accelMag > 4.2);
    if (isCrestBreak && rng < 0.085) {
      let jit = vec3<f32>(hashU32(pid + 5u) - 0.5, hashU32(pid + 17u) - 0.5, hashU32(pid + 29u) - 0.5) * 0.032;
      let kind = select(1.0, 0.0, vel.y > 0.45 || rng < 0.38);
      let life = select(1.8 + rng * 2.2, 0.85 + rng * 0.8, kind < 0.5);
      spawnWhitewater(pos + jit, vel + jit * 6.0, kind, life);
      cooldown = 0.18;
    }
  }

  // Enforce smooth domain & bathymetry & moving wavemaker boundaries
  let minWallX = sim.paddleX + 0.008;
  if (pos.x < minWallX) {
    pos.x = minWallX + rng * 0.004;
    vel.x = max(vel.x, sim.paddleVel);
  }
  if (pos.x > TANK_MAX_X - 0.006) {
    pos.x = TANK_MAX_X - 0.006 - rng * 0.003;
    if (vel.x > 0.0) { vel.x = -vel.x * 0.18; }
  }
  if (pos.z < TANK_MIN_Z + 0.006) {
    pos.z = TANK_MIN_Z + 0.006;
    if (vel.z < 0.0) { vel.z = 0.0; }
  }
  if (pos.z > TANK_MAX_Z - 0.006) {
    pos.z = TANK_MAX_Z - 0.006;
    if (vel.z > 0.0) { vel.z = 0.0; }
  }

  let bedY = terrainHeight(pos.x, pos.z) + 0.005;
  if (pos.y < bedY) {
    let bn = terrainNormal(pos.x, pos.z);
    pos.y = bedY;
    let vn = dot(vel, bn);
    if (vn < 0.0) {
      vel -= vn * bn;
    }
  }
  if (pos.y > TANK_MAX_Y - 0.01) {
    pos.y = TANK_MAX_Y - 0.01;
    if (vel.y > 0.0) { vel.y = -vel.y * 0.25; }
  }

  // Clamp extreme outlier velocity
  let maxSpd = 9.5;
  let curSpd = length(vel);
  if (curSpd > maxSpd) {
    vel *= (maxSpd / curSpd);
  }

  // Store local neighbor density in pVel.w so isolated airborne splash droplets can render crisply!
  pPos[pid] = vec4<f32>(pos, cooldown);
  pVel[pid] = vec4<f32>(vel, cDens);
}

// Kernel 8: Unified Spray / Foam / Bubble Whitewater Simulation (Ihmsen et al. 2012)
@compute @workgroup_size(256)
fn csUpdateWhitewater(@builtin(global_invocation_id) gid: vec3<u32>) {
  let wid = gid.x;
  if (wid >= 65536u) { return; }

  var wp = wwParticles[wid];
  var life = wp.posLife.w;
  if (life <= 0.0) { return; }

  var pos = wp.posLife.xyz;
  var vel = wp.velKind.xyz;
  var kind = wp.velKind.w;
  let dt = sim.dt;

  let dens = sampleCellDensity(pos);
  let uGrid = sampleFluidVelNew(pos);

  if (dens < 0.55) {
    // 0: Airborne Spray (ballistic + air drag)
    kind = 0.0;
    vel += vec3<f32>(0.0, sim.gravity * dt, 0.0);
    vel *= exp(-0.85 * dt);
    pos += vel * dt;
    life -= dt * 1.15;
  } else if (dens < 2.85) {
    // 1: Drifting Surface Foam (advected by 3D FLIP surface flow, decays smoothly when wave stops!)
    if (kind < 0.5 && vel.y < -0.5) {
      // Airborne spray droplet just landed back on water surface -> convert to brief ripple foam!
      life = min(life, 0.75);
    }
    kind = 1.0;
    vel = uGrid;
    pos += vel * dt;
    // Gently ride isosurface gradient so foam doesn't sink or float in midair
    let dUp = sampleCellDensity(pos + vec3<f32>(0.0, 0.015, 0.0));
    if (dUp > 1.35) { pos.y += 0.22 * dt; }
    let calmDecay = select(1.45, 0.68, sim.waveRunning > 0.5);
    life -= dt * calmDecay;
    if ((wid & 7u) == 0u) {
      atomicAdd(&wwCounters[1], 1u);
    }
  } else {
    // 2: Underwater Entrained Bubbles (buoyant rise + helical wobble!)
    kind = 2.0;
    let phase = sim.simTime * 11.0 + f32(wid) * 0.37;
    let wobble = vec3<f32>(cos(phase), 0.0, sin(phase)) * 0.16;
    vel = mix(vel, uGrid + vec3<f32>(0.0, 0.62, 0.0) + wobble, min(1.0, 9.0 * dt));
    pos += vel * dt;
    life -= dt * 0.72;
  }

  // Keep inside tank walls & above terrain
  let minX = sim.paddleX + 0.012;
  pos.x = clamp(pos.x, minX, TANK_MAX_X - 0.008);
  pos.z = clamp(pos.z, TANK_MIN_Z + 0.008, TANK_MAX_Z - 0.008);
  let bedY = terrainHeight(pos.x, pos.z) + 0.008;
  if (pos.y < bedY) { pos.y = bedY; life -= dt * 2.0; }
  if (pos.y > TANK_MAX_Y - 0.01) { life = 0.0; }

  wp.posLife = vec4<f32>(pos, max(0.0, life));
  wp.velKind = vec4<f32>(vel, kind);
  wwParticles[wid] = wp;
}
`
      });

      const makeSimPipe = (entry) =>
        dev.createComputePipeline({
          layout: 'auto',
          compute: { module: simShader, entryPoint: entry }
        });

      this.pipeClear = makeSimPipe('csClearAndSolids');
      this.pipeP2G = makeSimPipe('csP2G');
      this.pipeFinalize = makeSimPipe('csFinalizeGrid');
      this.pipeDiv = makeSimPipe('csComputeDivergence');
      this.pipeSOR = makeSimPipe('csPressureSOR');
      this.pipeProject = makeSimPipe('csProjectVelocity');
      this.pipeSpheres = makeSimPipe('csUpdateSpheres');
      this.pipeG2P = makeSimPipe('csG2PAndAdvect');
      this.pipeWW = makeSimPipe('csUpdateWhitewater');

      const makeBG = (pipe, entries) =>
        dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries });

      this.bgClear = makeBG(this.pipeClear, [
        { binding: 0, resource: { buffer: this.simUniformBuf } },
        { binding: 3, resource: { buffer: this.atomicAccumBuf } },
        { binding: 5, resource: { buffer: this.gridPressBuf } },
        { binding: 6, resource: { buffer: this.tankSpheresBuf } }
      ]);

      this.bgP2G = makeBG(this.pipeP2G, [
        { binding: 0, resource: { buffer: this.simUniformBuf } },
        { binding: 1, resource: { buffer: this.posBuf } },
        { binding: 2, resource: { buffer: this.velBuf } },
        { binding: 3, resource: { buffer: this.atomicAccumBuf } }
      ]);

      this.bgFinalize = makeBG(this.pipeFinalize, [
        { binding: 0, resource: { buffer: this.simUniformBuf } },
        { binding: 3, resource: { buffer: this.atomicAccumBuf } },
        { binding: 4, resource: { buffer: this.gridVelBuf } },
        { binding: 5, resource: { buffer: this.gridPressBuf } }
      ]);

      this.bgDiv = makeBG(this.pipeDiv, [
        { binding: 0, resource: { buffer: this.simUniformBuf } },
        { binding: 4, resource: { buffer: this.gridVelBuf } },
        { binding: 5, resource: { buffer: this.gridPressBuf } }
      ]);

      this.bgSORRed = makeBG(this.pipeSOR, [
        { binding: 0, resource: { buffer: this.sorRedBuf } },
        { binding: 5, resource: { buffer: this.gridPressBuf } }
      ]);

      this.bgSORBlack = makeBG(this.pipeSOR, [
        { binding: 0, resource: { buffer: this.sorBlackBuf } },
        { binding: 5, resource: { buffer: this.gridPressBuf } }
      ]);

      this.wwReadbackBuf = dev.createBuffer({
        size: 16,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      this.foamAudioLevel = 0.0;
      this.wallSlamAudioImpulse = 0.0;

      this.bgProject = makeBG(this.pipeProject, [
        { binding: 4, resource: { buffer: this.gridVelBuf } },
        { binding: 5, resource: { buffer: this.gridPressBuf } },
        { binding: 8, resource: { buffer: this.wwCounterBuf } }
      ]);

      this.bgSpheres = makeBG(this.pipeSpheres, [
        { binding: 0, resource: { buffer: this.simUniformBuf } },
        { binding: 4, resource: { buffer: this.gridVelBuf } },
        { binding: 6, resource: { buffer: this.tankSpheresBuf } }
      ]);

      this.bgG2P = makeBG(this.pipeG2P, [
        { binding: 0, resource: { buffer: this.simUniformBuf } },
        { binding: 1, resource: { buffer: this.posBuf } },
        { binding: 2, resource: { buffer: this.velBuf } },
        { binding: 4, resource: { buffer: this.gridVelBuf } },
        { binding: 6, resource: { buffer: this.tankSpheresBuf } },
        { binding: 7, resource: { buffer: this.whitewaterBuf } },
        { binding: 8, resource: { buffer: this.wwCounterBuf } }
      ]);

      this.bgWW = makeBG(this.pipeWW, [
        { binding: 0, resource: { buffer: this.simUniformBuf } },
        { binding: 4, resource: { buffer: this.gridVelBuf } },
        { binding: 7, resource: { buffer: this.whitewaterBuf } },
        { binding: 8, resource: { buffer: this.wwCounterBuf } }
      ]);

      // Shader Module 2: 3D Render Density Field Reconstruction + Real-Time Underwater Caustics
      const fieldShader = dev.createShaderModule({
        code: FLUID_COMMON_WGSL + /* wgsl */ `
@group(0) @binding(0) var<uniform> sim: SimParams;
@group(0) @binding(1) var<storage, read> pPos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> densAtom: array<atomic<u32>>;
@group(0) @binding(3) var outWater3D: texture_storage_3d<rgba16float, write>;
@group(0) @binding(4) var<storage, read_write> causticAtom: array<atomic<u32>>;
@group(0) @binding(5) var outCaustic2D: texture_storage_2d<rgba16float, write>;
@group(0) @binding(6) var<storage, read> spheres: array<TankSphere>;

fn rIdx(ix: u32, iy: u32, iz: u32) -> u32 {
  return (iz * R_NY + iy) * R_NX + ix;
}

@compute @workgroup_size(256)
fn csClearRenderGrids(@builtin(global_invocation_id) gid: vec3<u32>) {
  let id = gid.x;
  if (id < 979776u) {
    atomicStore(&densAtom[id], 0u);
  }
  if (id < 32768u) {
    atomicStore(&causticAtom[id], 0u);
  }
}

@compute @workgroup_size(256)
fn csSplatRenderDensity(@builtin(global_invocation_id) gid: vec3<u32>) {
  let pid = gid.x;
  if (pid >= sim.numParticles) { return; }

  let p = pPos[pid].xyz;
  let gx = (p.x - TANK_MIN_X) / (2.88 / f32(R_NX)) - 0.5;
  let gy = (p.y - TANK_MIN_Y) / (1.12 / f32(R_NY)) - 0.5;
  let gz = (p.z - TANK_MIN_Z) / (0.72 / f32(R_NZ)) - 0.5;

  let cx = i32(round(gx));
  let cy = i32(round(gy));
  let cz = i32(round(gz));

  // Isotropic smooth 3x3x3 spherical kernel (radius 1.45 voxels) for silky liquid surface!
  for (var dz: i32 = -1; dz <= 1; dz++) {
    let iz = cz + dz;
    if (iz < 0 || iz >= i32(R_NZ)) { continue; }
    let rz = f32(iz) - gz;
    for (var dy: i32 = -1; dy <= 1; dy++) {
      let iy = cy + dy;
      if (iy < 0 || iy >= i32(R_NY)) { continue; }
      let ry = f32(iy) - gy;
      for (var dx: i32 = -1; dx <= 1; dx++) {
        let ix = cx + dx;
        if (ix < 0 || ix >= i32(R_NX)) { continue; }
        let rx = f32(ix) - gx;
        let r2 = rx * rx + ry * ry + rz * rz;
        if (r2 < 2.25) {
          let w = (1.0 - r2 / 2.25);
          let w2 = w * w;
          atomicAdd(&densAtom[rIdx(u32(ix), u32(iy), u32(iz))], u32(w2 * 512.0));
        }
      }
    }
  }
}

// Stamp submerged sphere interiors into render density grid so water wets submerged hulls flush with zero air-gap halo!
@compute @workgroup_size(64)
fn csWetSpheres(@builtin(global_invocation_id) gid: vec3<u32>) {
  let sid = gid.x;
  if (sid >= sim.numSpheres) { return; }

  let sp = spheres[sid];
  let eta = sp.colSub.w;
  if (eta < 0.12) { return; }

  let c = sp.posRad.xyz;
  let r = sp.posRad.w * 1.07;
  let wetTopY = c.y + sp.posRad.w * clamp(2.06 * eta - 1.02, -0.95, 1.08);

  let vx = 2.88 / f32(R_NX);
  let vy = 1.12 / f32(R_NY);
  let vz = 0.72 / f32(R_NZ);

  let minIx = max(0, i32(floor((c.x - r - TANK_MIN_X) / vx)));
  let maxIx = min(i32(R_NX) - 1, i32(ceil((c.x + r - TANK_MIN_X) / vx)));
  let minIy = max(0, i32(floor((c.y - r - TANK_MIN_Y) / vy)));
  let maxIy = min(i32(R_NY) - 1, i32(ceil((min(c.y + r, wetTopY) - TANK_MIN_Y) / vy)));
  let minIz = max(0, i32(floor((c.z - r - TANK_MIN_Z) / vz)));
  let maxIz = min(i32(R_NZ) - 1, i32(ceil((c.z + r - TANK_MIN_Z) / vz)));

  for (var iz: i32 = minIz; iz <= maxIz; iz++) {
    let wz = TANK_MIN_Z + (f32(iz) + 0.5) * vz;
    let dz = wz - c.z;
    for (var iy: i32 = minIy; iy <= maxIy; iy++) {
      let wy = TANK_MIN_Y + (f32(iy) + 0.5) * vy;
      if (wy > wetTopY) { continue; }
      let dy = wy - c.y;
      for (var ix: i32 = minIx; ix <= maxIx; ix++) {
        let wx = TANK_MIN_X + (f32(ix) + 0.5) * vx;
        let dx = wx - c.x;
        let d = sqrt(dx * dx + dy * dy + dz * dz);
        if (d <= r) {
          let fillVal = u32(clamp(1.0 - (d / r) * 0.28, 0.72, 1.0) * 760.0);
          atomicMax(&densAtom[rIdx(u32(ix), u32(iy), u32(iz))], fillVal);
        }
      }
    }
  }
}

fn readSmoothDens(ix: i32, iy: i32, iz: i32) -> f32 {
  let x = u32(clamp(ix, 0, i32(R_NX) - 1));
  let y = u32(clamp(iy, 0, i32(R_NY) - 1));
  let z = u32(clamp(iz, 0, i32(R_NZ) - 1));
  return f32(atomicLoad(&densAtom[rIdx(x, y, z)])) / 512.0;
}

@compute @workgroup_size(8, 4, 4)
fn csBakeWaterTex3D(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= R_NX || gid.y >= R_NY || gid.z >= R_NZ) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let iz = i32(gid.z);

  // 7-point 3D Jacobi smooth + central-difference normal baked right into rgba16float!
  let c  = readSmoothDens(ix, iy, iz);
  let xm = readSmoothDens(ix - 1, iy, iz);
  let xp = readSmoothDens(ix + 1, iy, iz);
  let ym = readSmoothDens(ix, iy - 1, iz);
  let yp = readSmoothDens(ix, iy + 1, iz);
  let zm = readSmoothDens(ix, iy, iz - 1);
  let zp = readSmoothDens(ix, iy, iz + 1);

  let smoothD = c * 0.40 + (xm + xp + ym + yp + zm + zp) * 0.10;
  // Outward normal points from high density toward low density (-grad)
  let gx = -(xp - xm);
  let gy = -(yp - ym);
  let gz = -(zp - zm);
  let gLen = length(vec3<f32>(gx, gy, gz));
  let nrm = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(gx, gy, gz) / gLen, gLen > 0.001);

  textureStore(outWater3D, vec3<i32>(ix, iy, iz), vec4<f32>(smoothD, nrm));
}

// Real-time refracted photon caustic splat from actual 3D particle density field!
@compute @workgroup_size(16, 8, 1)
fn csTraceCaustics(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= C_NX || gid.y >= C_NZ) { return; }

  let u = (f32(gid.x) + 0.5) / f32(C_NX);
  let v = (f32(gid.y) + 0.5) / f32(C_NZ);
  let wx = mix(TANK_MIN_X, TANK_MAX_X, u);
  let wz = mix(TANK_MIN_Z, TANK_MAX_Z, v);
  if (wx < sim.paddleX + 0.01) { return; }

  let rx = i32(clamp(u * f32(R_NX), 1.0, f32(R_NX) - 2.0));
  let rz = i32(clamp(v * f32(R_NZ), 1.0, f32(R_NZ) - 2.0));

  // Scan top-down in render density grid to find top free water surface!
  var surfY = -1.0;
  var surfN = vec3<f32>(0.0, 1.0, 0.0);
  let iso = 0.72;

  for (var iy: i32 = i32(R_NY) - 2; iy >= 2; iy--) {
    let dCur = readSmoothDens(rx, iy, rz);
    if (dCur >= iso) {
      let dAbove = readSmoothDens(rx, iy + 1, rz);
      let frac = clamp((iso - dCur) / max(0.001, dAbove - dCur), 0.0, 1.0);
      surfY = TANK_MIN_Y + (f32(iy) + frac + 0.5) * (1.12 / f32(R_NY));

      let nx = -(readSmoothDens(rx + 1, iy, rz) - readSmoothDens(rx - 1, iy, rz));
      let ny = -(dAbove - readSmoothDens(rx, iy - 1, rz));
      let nz = -(readSmoothDens(rx, iy, rz + 1) - readSmoothDens(rx, iy, rz - 1));
      surfN = normalize(vec3<f32>(nx, max(0.25, ny), nz));
      break;
    }
  }

  if (surfY <= 0.0) { return; }

  // Refract studio key light (IOR air/water = 1.0 / 1.333 = 0.75) down onto underwater terrain bed!
  let lightIn = normalize(vec3<f32>(-0.22, -0.94, -0.18));
  let refrDir = refract(lightIn, surfN, 0.75);
  let bedY = terrainHeight(wx, wz);
  let depth = max(0.0, surfY - bedY);
  let hitXZ = vec2<f32>(wx, wz) + refrDir.xz / max(0.25, -refrDir.y) * depth;

  let cu = (hitXZ.x - TANK_MIN_X) / 2.88 * f32(C_NX) - 0.5;
  let cv = (hitXZ.y - TANK_MIN_Z) / 0.72 * f32(C_NZ) - 0.5;
  let cix = i32(floor(cu));
  let ciz = i32(floor(cv));
  let fx = cu - f32(cix);
  let fz = cv - f32(ciz);

  for (var dz: i32 = 0; dz <= 1; dz++) {
    let tz = ciz + dz;
    if (tz < 0 || tz >= i32(C_NZ)) { continue; }
    let wzW = select(1.0 - fz, fz, dz == 1);
    for (var dx: i32 = 0; dx <= 1; dx++) {
      let tx = cix + dx;
      if (tx < 0 || tx >= i32(C_NX)) { continue; }
      let wxW = select(1.0 - fx, fx, dx == 1);
      atomicAdd(&causticAtom[u32(tz) * C_NX + u32(tx)], u32(wxW * wzW * 256.0));
    }
  }
}

@compute @workgroup_size(16, 8, 1)
fn csFinalizeCaustics(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= C_NX || gid.y >= C_NZ) { return; }
  let ix = i32(gid.x);
  let iz = i32(gid.y);

  // Slight 5-tap smooth so caustics shimmer cleanly without pixel aliasing
  let c0 = f32(atomicLoad(&causticAtom[u32(iz) * C_NX + u32(ix)])) / 256.0;
  let cxm = f32(atomicLoad(&causticAtom[u32(iz) * C_NX + u32(max(0, ix - 1))])) / 256.0;
  let cxp = f32(atomicLoad(&causticAtom[u32(iz) * C_NX + u32(min(i32(C_NX) - 1, ix + 1))])) / 256.0;
  let czm = f32(atomicLoad(&causticAtom[u32(max(0, iz - 1)) * C_NX + u32(ix)])) / 256.0;
  let czp = f32(atomicLoad(&causticAtom[u32(min(i32(C_NZ) - 1, iz + 1)) * C_NX + u32(ix)])) / 256.0;

  let avg = c0 * 0.44 + (cxm + cxp + czm + czp) * 0.14;
  textureStore(outCaustic2D, vec2<i32>(ix, iz), vec4<f32>(avg, 0.0, 0.0, 1.0));
}
`
      });

      const makeFieldPipe = (entry) =>
        dev.createComputePipeline({ layout: 'auto', compute: { module: fieldShader, entryPoint: entry } });

      this.pipeClearField = makeFieldPipe('csClearRenderGrids');
      this.pipeSplatDens = makeFieldPipe('csSplatRenderDensity');
      this.pipeWetSpheres = makeFieldPipe('csWetSpheres');
      this.pipeBake3D = makeFieldPipe('csBakeWaterTex3D');
      this.pipeTraceCaustics = makeFieldPipe('csTraceCaustics');
      this.pipeFinalCaustics = makeFieldPipe('csFinalizeCaustics');

      this.bgClearField = dev.createBindGroup({
        layout: this.pipeClearField.getBindGroupLayout(0),
        entries: [
          { binding: 2, resource: { buffer: this.renderDensAtomicBuf } },
          { binding: 4, resource: { buffer: this.causticAtomicBuf } }
        ]
      });

      this.bgSplatDens = dev.createBindGroup({
        layout: this.pipeSplatDens.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.simUniformBuf } },
          { binding: 1, resource: { buffer: this.posBuf } },
          { binding: 2, resource: { buffer: this.renderDensAtomicBuf } }
        ]
      });

      this.bgWetSpheres = dev.createBindGroup({
        layout: this.pipeWetSpheres.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.simUniformBuf } },
          { binding: 2, resource: { buffer: this.renderDensAtomicBuf } },
          { binding: 6, resource: { buffer: this.tankSpheresBuf } }
        ]
      });

      this.bgBake3D = dev.createBindGroup({
        layout: this.pipeBake3D.getBindGroupLayout(0),
        entries: [
          { binding: 2, resource: { buffer: this.renderDensAtomicBuf } },
          { binding: 3, resource: this.waterTex3DView }
        ]
      });

      this.bgTraceCaustics = dev.createBindGroup({
        layout: this.pipeTraceCaustics.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.simUniformBuf } },
          { binding: 2, resource: { buffer: this.renderDensAtomicBuf } },
          { binding: 4, resource: { buffer: this.causticAtomicBuf } }
        ]
      });

      this.bgFinalCaustics = dev.createBindGroup({
        layout: this.pipeFinalCaustics.getBindGroupLayout(0),
        entries: [
          { binding: 4, resource: { buffer: this.causticAtomicBuf } },
          { binding: 5, resource: this.causticTexView }
        ]
      });
    }

    resetTank(withInitialBallsAbove = true, seed = 20261113) {
      const rng = M.createRNG(seed);
      this.simTime = 0.0;
      this.stepCounter = 0;
      this.paddleX = this.paddleRestX;
      this.paddleVel = 0.0;
      this.waveRunning = false;
      this.waveEnvelope = 0.0;
      this.wavePhase = 0.0;
      this.flipRatio = 0.965;

      // 1. Seed resting 3D water particles (4 jittered particles per fluid cell below restWaterHeight)
      const pData = new Float32Array(this.maxParticles * 4);
      const vData = new Float32Array(this.maxParticles * 4);
      let ptr = 0;

      // Tetrahedral 4-point sub-cell offsets inside [0, 1]^3 for uniform isotropic density!
      const subOff = [
        [0.25, 0.25, 0.25],
        [0.75, 0.25, 0.75],
        [0.25, 0.75, 0.75],
        [0.75, 0.75, 0.25]
      ];

      const maxWaterCellY = Math.floor(this.restWaterHeight / CELL_H); // 21 cells -> 0.42m
      for (let k = 0; k < NZ; k++) {
        for (let j = 0; j < maxWaterCellY; j++) {
          for (let i = 0; i < NX; i++) {
            const x0 = TANK_MIN_X + i * CELL_H;
            const y0 = TANK_MIN_Y + j * CELL_H;
            const z0 = TANK_MIN_Z + k * CELL_H;
            if (x0 < this.paddleRestX + 0.01) continue;

            for (let s = 0; s < 4; s++) {
              if (ptr >= this.maxParticles) break;
              const jx = (rng() - 0.5) * 0.22;
              const jy = (rng() - 0.5) * 0.22;
              const jz = (rng() - 0.5) * 0.22;
              const px = x0 + M.clamp(subOff[s][0] + jx, 0.08, 0.92) * CELL_H;
              const py = y0 + M.clamp(subOff[s][1] + jy, 0.08, 0.92) * CELL_H;
              const pz = z0 + M.clamp(subOff[s][2] + jz, 0.08, 0.92) * CELL_H;

              if (px < this.paddleRestX + 0.01) continue;
              if (py < evalTerrainHeightJS(px, pz) + 0.006) continue;

              const p4 = ptr * 4;
              pData[p4] = px;
              pData[p4 + 1] = py;
              pData[p4 + 2] = pz;
              pData[p4 + 3] = 0.0;
              vData[p4 + 3] = 4.0;
              ptr++;
            }
          }
        }
      }

      this.numParticles = ptr;
      this.device.queue.writeBuffer(this.posBuf, 0, pData, 0, ptr * 4);
      this.device.queue.writeBuffer(this.velBuf, 0, vData, 0, ptr * 4);

      // Clear pressure & whitewater buffers
      this.device.queue.writeBuffer(this.gridPressBuf, 0, new Float32Array(MAC_SLICE * 4));
      this.device.queue.writeBuffer(this.whitewaterBuf, 0, new Float32Array(MAX_WHITEWATER * 8));
      this.device.queue.writeBuffer(this.wwCounterBuf, 0, new Uint32Array(4));

      // Clear spheres and optionally spawn a balanced multi-density batch poised right above the water!
      this.numSpheres = 0;
      this.cpuSpheresShadow = [];
      this.latestSphereReadback.fill(0);
      this.device.queue.writeBuffer(this.tankSpheresBuf, 0, this.latestSphereReadback);

      if (withInitialBallsAbove) {
        this.releaseBallBatch(28, 0.14, seed + 7);
      }

      // Bake initial render 3D density + caustics immediately so Frame 0 looks crystal clear!
      const enc = this.device.createCommandEncoder();
      this._writeSimUniforms(1 / 240, 0);
      this.encodeRenderFields(enc);
      this.device.queue.submit([enc.finish()]);
    }

    releaseBallBatch(count = 24, startClearanceAboveWater = 0.24, seed = null) {
      const rng = seed !== null ? M.createRNG(seed) : Math.random;
      // Read latest positions if we already have spheres on GPU
      const baseIdx = this.numSpheres;
      const avail = Math.max(0, MAX_TANK_SPHERES - baseIdx);
      const nAdd = Math.min(count, avail);
      if (nAdd <= 0) {
        // Recycle oldest spheres if full so user can ALWAYS release balls again (`可以再次释放小球`)!
        this.numSpheres = Math.max(0, MAX_TANK_SPHERES - count);
        return this.releaseBallBatch(count, startClearanceAboveWater, seed);
      }

      // Arrange in non-overlapping staggered 3D drop cluster over the deep left-center basin!
      const r = this.ballRadius;
      const spacing = r * 2.28;
      const colsX = 7;
      const colsZ = 4;

      const buf = new Float32Array(nAdd * 24);
      for (let i = 0; i < nAdd; i++) {
        const layer = Math.floor(i / (colsX * colsZ));
        const rem = i % (colsX * colsZ);
        const ix = rem % colsX;
        const iz = Math.floor(rem / colsX);

        const groupIdx = (i + layer) % 4;
        const dens = this.params.densities[groupIdx];
        const col = this.groupColors[groupIdx];

        const bx = -0.88 + ix * spacing * 0.98 + (layer % 2) * 0.04 + (rng() - 0.5) * 0.018;
        const bz = -0.22 + iz * spacing * 0.96 + (ix % 2) * 0.02 + (rng() - 0.5) * 0.016;
        const by = this.restWaterHeight + r + startClearanceAboveWater + layer * (spacing * 1.05) + (ix % 3) * 0.045 + rng() * 0.03;

        // Slight initial downward velocity so action begins immediately without empty waiting!
        const vy0 = -0.65 - rng() * 0.45;
        const vx0 = (rng() - 0.5) * 0.16;
        const vz0 = (rng() - 0.5) * 0.12;

        // Random initial quaternion so stripes start at varied natural angles
        const a1 = rng() * Math.PI * 2, a2 = rng() * Math.PI * 2;
        const qx = Math.sin(a1) * 0.35, qy = Math.cos(a2) * 0.35, qz = Math.sin(a2) * 0.25, qw = 0.85;
        const qLen = Math.hypot(qx, qy, qz, qw);

        const o = i * 24;
        buf[o + 0] = bx; buf[o + 1] = by; buf[o + 2] = bz; buf[o + 3] = r;
        buf[o + 4] = vx0; buf[o + 5] = vy0; buf[o + 6] = vz0; buf[o + 7] = dens;
        buf[o + 8] = (rng() - 0.5) * 1.5; buf[o + 9] = (rng() - 0.5) * 1.5; buf[o + 10] = (rng() - 0.5) * 1.5; buf[o + 11] = groupIdx;
        buf[o + 12] = qx / qLen; buf[o + 13] = qy / qLen; buf[o + 14] = qz / qLen; buf[o + 15] = qw / qLen;
        buf[o + 16] = col[0]; buf[o + 17] = col[1]; buf[o + 18] = col[2]; buf[o + 19] = 0.0;
        buf[o + 20] = bx; buf[o + 21] = by; buf[o + 22] = bz; buf[o + 23] = 0.0;

        this.latestSphereReadback.set(buf.subarray(o, o + 24), (baseIdx + i) * 24);
      }

      this.device.queue.writeBuffer(this.tankSpheresBuf, baseIdx * 96, buf);
      this.numSpheres = baseIdx + nAdd;
    }

    _writeSimUniforms(sdt, sorColor = 0) {
      const f = this.simUniformF32;
      const u = this.simUniformU32;
      f[0] = sdt;
      f[1] = -9.81;
      f[2] = this.paddleX;
      f[3] = this.paddleVel;

      u[4] = this.numParticles;
      u[5] = this.numSpheres;
      u[6] = sorColor;
      u[7] = this.stepCounter;

      f[8] = this.flipRatio ?? 0.965; // FLIP/PIC blend ratio
      f[9] = 0.016; // calibrated density drift & sphere volume displacement gain (m/s)
      f[10] = this.simTime;
      f[11] = this.waveRunning ? 1.0 : 0.0;

      f[12] = this.params.densities[0];
      f[13] = this.params.densities[1];
      f[14] = this.params.densities[2];
      f[15] = this.params.densities[3];

      this.device.queue.writeBuffer(this.simUniformBuf, 0, this.simUniformData);
    }

    step(dt) {
      if (dt <= 0) return;

      const substeps = 4;
      const sdt = dt / substeps;

      // Reset per-frame audio telemetry counters [keep cursor, zero foamCount & wallSlam]
      // Note: cursor at index 0 wraps mod 65536 anyway, we only clear 1 & 2
      this.device.queue.writeBuffer(this.wwCounterBuf, 4, new Uint32Array([0, 0, 0]));

      for (let s = 0; s < substeps; s++) {
        this.simTime += sdt;
        this.stepCounter++;

        // Smoothly update wavemaker piston kinematics (`幅度可以从推出平缓长波一直调到推出破碎浪`)
        const targetEnv = this.waveRunning ? 1.0 : 0.0;
        const rate = this.waveRunning ? 1.6 : 2.2;
        this.waveEnvelope += (targetEnv - this.waveEnvelope) * Math.min(1.0, rate * sdt);
        if (!this.waveRunning && this.waveEnvelope < 0.002) {
          this.waveEnvelope = 0.0;
        }

        const freq = M.clamp(this.params.waveFreq, 0.30, 1.60);
        const omega = 2.0 * Math.PI * freq;
        if (this.waveEnvelope > 0.0005) {
          this.wavePhase += omega * sdt;
        }
        // Stroke amplitude: from 0.012m (gentle long non-breaking swell) up to 0.142m (steep overturning breaker!)
        const strokeAmp = (0.012 + 0.130 * Math.pow(M.clamp(this.params.waveAmp, 0.02, 1.0), 1.30)) * this.waveEnvelope;
        const prevPX = this.paddleX;
        // (1 - cos) * 0.5 keeps paddle strictly >= paddleRestX so no gap opens behind rest stop!
        this.paddleX = this.paddleRestX + strokeAmp * (1.0 - Math.cos(this.wavePhase));
        this.paddleVel = (this.paddleX - prevPX) / sdt;

        // Record entire substep (Clear + P2G + Finalize + Div + 36 Red-Black SOR + Project + Spheres + G2P + Whitewater) in ONE ComputePass!
        this._writeSimUniforms(sdt, 0);
        const enc = this.device.createCommandEncoder();
        const gridGroups = Math.ceil(MAC_SLICE / 256);
        const partGroups = Math.ceil(this.numParticles / 256);

        const pass = enc.beginComputePass();
        pass.setPipeline(this.pipeClear);
        pass.setBindGroup(0, this.bgClear);
        pass.dispatchWorkgroups(gridGroups);

        pass.setPipeline(this.pipeP2G);
        pass.setBindGroup(0, this.bgP2G);
        pass.dispatchWorkgroups(partGroups);

        pass.setPipeline(this.pipeFinalize);
        pass.setBindGroup(0, this.bgFinalize);
        pass.dispatchWorkgroups(gridGroups);

        pass.setPipeline(this.pipeDiv);
        pass.setBindGroup(0, this.bgDiv);
        pass.dispatchWorkgroups(gridGroups);

        pass.setPipeline(this.pipeSOR);
        for (let iter = 0; iter < 18; iter++) {
          pass.setBindGroup(0, this.bgSORRed);
          pass.dispatchWorkgroups(gridGroups);
          pass.setBindGroup(0, this.bgSORBlack);
          pass.dispatchWorkgroups(gridGroups);
        }

        pass.setPipeline(this.pipeProject);
        pass.setBindGroup(0, this.bgProject);
        pass.dispatchWorkgroups(gridGroups);

        if (this.numSpheres > 0) {
          pass.setPipeline(this.pipeSpheres);
          pass.setBindGroup(0, this.bgSpheres);
          pass.dispatchWorkgroups(1);
        }

        pass.setPipeline(this.pipeG2P);
        pass.setBindGroup(0, this.bgG2P);
        pass.dispatchWorkgroups(partGroups);

        pass.setPipeline(this.pipeWW);
        pass.setBindGroup(0, this.bgWW);
        pass.dispatchWorkgroups(MAX_WHITEWATER / 256);

        pass.end();
        this.device.queue.submit([enc.finish()]);
      }

      // Async non-blocking sphere + whitewater telemetry readback for audio events
      this._triggerAsyncSphereTelemetry();
    }

    encodeRenderFields(encoder) {
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.pipeClearField);
      pass.setBindGroup(0, this.bgClearField);
      pass.dispatchWorkgroups(Math.ceil(R_TOTAL / 256));

      if (this.numParticles > 0) {
        pass.setPipeline(this.pipeSplatDens);
        pass.setBindGroup(0, this.bgSplatDens);
        pass.dispatchWorkgroups(Math.ceil(this.numParticles / 256));
      }

      if (this.numSpheres > 0) {
        pass.setPipeline(this.pipeWetSpheres);
        pass.setBindGroup(0, this.bgWetSpheres);
        pass.dispatchWorkgroups(1);
      }

      pass.setPipeline(this.pipeBake3D);
      pass.setBindGroup(0, this.bgBake3D);
      pass.dispatchWorkgroups(Math.ceil(R_NX / 8), Math.ceil(R_NY / 4), Math.ceil(R_NZ / 4));

      pass.setPipeline(this.pipeTraceCaustics);
      pass.setBindGroup(0, this.bgTraceCaustics);
      pass.dispatchWorkgroups(C_NX / 16, C_NZ / 8, 1);

      pass.setPipeline(this.pipeFinalCaustics);
      pass.setBindGroup(0, this.bgFinalCaustics);
      pass.dispatchWorkgroups(C_NX / 16, C_NZ / 8, 1);

      pass.end();
    }

    _triggerAsyncSphereTelemetry() {
      if (this._mappingSpheres || (this.sound && this.sound.mutedForExport)) return;
      this._mappingSpheres = true;
      const enc = this.device.createCommandEncoder();
      enc.copyBufferToBuffer(this.tankSpheresBuf, 0, this.sphereReadbackBuf, 0, MAX_TANK_SPHERES * 96);
      enc.copyBufferToBuffer(this.wwCounterBuf, 0, this.wwReadbackBuf, 0, 16);
      this.device.queue.submit([enc.finish()]);

      Promise.all([
        this.sphereReadbackBuf.mapAsync(GPUMapMode.READ),
        this.wwReadbackBuf.mapAsync(GPUMapMode.READ)
      ]).then(() => {
        const mapped = new Float32Array(this.sphereReadbackBuf.getMappedRange());
        for (let i = 0; i < this.numSpheres; i++) {
          const prevSpd = this.latestSphereReadback[i * 24 + 23];
          const curSpd = mapped[i * 24 + 23];
          if (curSpd > prevSpd + 0.35 && this.sound) {
            const dens = mapped[i * 24 + 7];
            this.sound.playWaterSplash(curSpd, dens);
          }
        }
        this.latestSphereReadback.set(mapped);
        this.sphereReadbackBuf.unmap();

        const wwMap = new Uint32Array(this.wwReadbackBuf.getMappedRange());
        this.foamAudioLevel = Math.min(1.0, (wwMap[1] * 8) / 3200.0);
        this.wallSlamAudioImpulse = Math.min(2.0, wwMap[2] / 30.0);
        this.wwReadbackBuf.unmap();
        this._mappingSpheres = false;
      }).catch(() => {
        try { this.sphereReadbackBuf.unmap(); } catch (_) {}
        try { this.wwReadbackBuf.unmap(); } catch (_) {}
        this._mappingSpheres = false;
      });
    }
  }

  App.TANK_CONSTS = {
    TANK_MIN_X, TANK_MAX_X, TANK_MIN_Y, TANK_MAX_Y, TANK_MIN_Z, TANK_MAX_Z,
    MAX_WHITEWATER, MAX_TANK_SPHERES, evalTerrainHeightJS
  };
  App.FLUID_COMMON_WGSL = FLUID_COMMON_WGSL;
  App.FluidTankGPU = FluidTankGPU;
})();
