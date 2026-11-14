// All WGSL compute & render shaders for Scene 2 (3D APIC/FLIP Wave Tank + Multigrid + 2-Way Spheres + Whitewater + Marching Cubes + Refraction + Caustics)
window.TankShaders = (() => {
  'use strict';

  const TANK_CONSTANTS = /* wgsl */`
    const NX: i32 = 128;
    const NY: i32 = 48;
    const NZ: i32 = 32;
    const H: f32 = 0.04375;
    const INV_H: f32 = 22.857142857;
    const TANK_X: f32 = 5.60;
    const TANK_Y: f32 = 2.10;
    const TANK_Z: f32 = 1.40;
    const FP_SCALE: f32 = 65536.0;
    const INV_FP_SCALE: f32 = 1.0 / 65536.0;
    const CELL_AIR: u32 = 0u;
    const CELL_FLUID: u32 = 1u;
    const CELL_SOLID: u32 = 2u;

    struct TankSimParams {
      dt: f32,
      gravity: f32,
      paddleX: f32,
      paddleVel: f32,
      flipRatio: f32,
      numParticles: u32,
      numSpheres: u32,
      maxWhitewater: u32,
      time: f32,
      waveAmp: f32,
      waveFreq: f32,
      restDensity: f32,
    };

    struct FluidParticle {
      pos: vec3<f32>,
      density: f32,
      vel: vec3<f32>,
      tag: f32,
      c0: vec4<f32>,
      c1: vec4<f32>,
      c2: vec4<f32>,
    };

    struct TankSphere {
      posRadius: vec4<f32>,
      velDensity: vec4<f32>,
      angVelMass: vec4<f32>,
      rotQuat: vec4<f32>,
      colorMeta: vec4<f32>,
      prevState: vec4<f32>, // x = prevSubmerged, y = plungeCooldown, z = unused, w = unused
    };

    struct WhitewaterParticle {
      pos: vec3<f32>,
      life: f32,
      vel: vec3<f32>,
      kind: f32, // 0=spray, 1=foam, 2=bubble, -1=dead
    };

    struct RenderSphereInstance {
      posRadius: vec4<f32>,
      colorMat: vec4<f32>,
      rotQuat: vec4<f32>,
      extra: vec4<f32>,
    };

    fn terrainHeight(x: f32, z: f32) -> f32 {
      // Smooth asymmetric 3D reef / shoal + side bypass channel
      let s1 = smoothstep(2.10, 3.35, x);
      let s2 = 1.0 - smoothstep(3.45, 4.45, x);
      let fx = s1 * s2;
      let fz = 0.28 + 0.72 * smoothstep(0.18, 1.06, z);
      return 0.045 + 0.54 * fx * fz;
    }

    fn terrainNormal(x: f32, z: f32) -> vec3<f32> {
      let eps = 0.02;
      let hx = terrainHeight(x + eps, z) - terrainHeight(x - eps, z);
      let hz = terrainHeight(x, z + eps) - terrainHeight(x, z - eps);
      return normalize(vec3<f32>(-hx / (2.0 * eps), 1.0, -hz / (2.0 * eps)));
    }

    fn cellIdx(i: i32, j: i32, k: i32) -> u32 {
      return u32((k * NY + j) * NX + i);
    }
    fn uIdx(i: i32, j: i32, k: i32) -> u32 {
      return u32((k * NY + j) * (NX + 1) + i);
    }
    fn vIdx(i: i32, j: i32, k: i32) -> u32 {
      return u32((k * (NY + 1) + j) * NX + i);
    }
    fn wIdx(i: i32, j: i32, k: i32) -> u32 {
      return u32((k * NY + j) * NX + i);
    }

    fn bSplineWeights(d: f32) -> vec3<f32> {
      // d in [-0.5, 0.5] relative to center node
      return vec3<f32>(
        0.5 * (0.5 - d) * (0.5 - d),
        0.75 - d * d,
        0.5 * (0.5 + d) * (0.5 + d)
      );
    }

    fn hashU32(x_in: u32) -> f32 {
      var x = x_in;
      x = ((x >> 16u) ^ x) * 0x45d9f3bu;
      x = ((x >> 16u) ^ x) * 0x45d9f3bu;
      x = (x >> 16u) ^ x;
      return f32(x) / 4294967296.0;
    }
  `;

  // 1. Clear MAC Grid & Density
  const CLEAR_GRID_WGSL = TANK_CONSTANTS + /* wgsl */`
    @group(0) @binding(0) var<storage, read_write> uAccum: array<atomic<i32>>;
    @group(0) @binding(1) var<storage, read_write> uWeight: array<atomic<i32>>;
    @group(0) @binding(2) var<storage, read_write> vAccum: array<atomic<i32>>;
    @group(0) @binding(3) var<storage, read_write> vWeight: array<atomic<i32>>;
    @group(0) @binding(4) var<storage, read_write> wAccum: array<atomic<i32>>;
    @group(0) @binding(5) var<storage, read_write> wWeight: array<atomic<i32>>;
    @group(0) @binding(6) var<storage, read_write> cellDensityAccum: array<atomic<i32>>;
    @group(0) @binding(7) var<storage, read_write> cellType: array<u32>;
    @group(0) @binding(8) var<storage, read_write> mgP: array<f32>;

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let id = gid.x;
      if (id < u32((NX + 1) * NY * NZ)) {
        atomicStore(&uAccum[id], 0);
        atomicStore(&uWeight[id], 0);
      }
      if (id < u32(NX * (NY + 1) * NZ)) {
        atomicStore(&vAccum[id], 0);
        atomicStore(&vWeight[id], 0);
      }
      if (id < u32(NX * NY * (NZ + 1))) {
        atomicStore(&wAccum[id], 0);
        atomicStore(&wWeight[id], 0);
      }
      if (id < u32(NX * NY * NZ)) {
        atomicStore(&cellDensityAccum[id], 0);
        cellType[id] = CELL_AIR;
        mgP[id] = 0.0;
      }
    }
  `;

  // 2. P2G Scatter (Quadratic B-Spline APIC onto MAC faces + trilinear cell density)
  const P2G_SCATTER_WGSL = TANK_CONSTANTS + /* wgsl */`
    @group(0) @binding(0) var<uniform> sim: TankSimParams;
    @group(0) @binding(1) var<storage, read> particles: array<FluidParticle>;
    @group(0) @binding(2) var<storage, read_write> uAccum: array<atomic<i32>>;
    @group(0) @binding(3) var<storage, read_write> uWeight: array<atomic<i32>>;
    @group(0) @binding(4) var<storage, read_write> vAccum: array<atomic<i32>>;
    @group(0) @binding(5) var<storage, read_write> vWeight: array<atomic<i32>>;
    @group(0) @binding(6) var<storage, read_write> wAccum: array<atomic<i32>>;
    @group(0) @binding(7) var<storage, read_write> wWeight: array<atomic<i32>>;
    @group(0) @binding(8) var<storage, read_write> cellDensityAccum: array<atomic<i32>>;

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let pid = gid.x;
      if (pid >= sim.numParticles) { return; }
      let p = particles[pid];
      let gp = p.pos * INV_H;

      // Splat density onto 2x2x2 cell centers (offset -0.5)
      {
        let dc = gp - vec3<f32>(0.5);
        let b = vec3<i32>(floor(dc));
        let f = dc - vec3<f32>(b);
        for (var dk = 0; dk <= 1; dk++) {
          let k = b.z + dk;
          if (k < 0 || k >= NZ) { continue; }
          let wz = select(1.0 - f.z, f.z, dk == 1);
          for (var dj = 0; dj <= 1; dj++) {
            let j = b.y + dj;
            if (j < 0 || j >= NY) { continue; }
            let wy = select(1.0 - f.y, f.y, dj == 1);
            for (var di = 0; di <= 1; di++) {
              let i = b.x + di;
              if (i < 0 || i >= NX) { continue; }
              let wx = select(1.0 - f.x, f.x, di == 1);
              let w = wx * wy * wz;
              atomicAdd(&cellDensityAccum[cellIdx(i, j, k)], i32(w * 1024.0 + 0.5));
            }
          }
        }
      }

      // Splat u-faces (0, 0.5, 0.5)
      {
        let fu = gp - vec3<f32>(0.0, 0.5, 0.5);
        let cu = vec3<i32>(floor(fu + 0.5));
        let du = fu - vec3<f32>(cu);
        let wx = bSplineWeights(du.x);
        let wy = bSplineWeights(du.y);
        let wz = bSplineWeights(du.z);
        for (var dk = -1; dk <= 1; dk++) {
          let k = cu.z + dk;
          if (k < 0 || k >= NZ) { continue; }
          let wzk = wz[dk + 1];
          for (var dj = -1; dj <= 1; dj++) {
            let j = cu.y + dj;
            if (j < 0 || j >= NY) { continue; }
            let wyj = wy[dj + 1] * wzk;
            for (var di = -1; di <= 1; di++) {
              let i = cu.x + di;
              if (i < 0 || i > NX) { continue; }
              let w = wx[di + 1] * wyj;
              if (w <= 1e-6) { continue; }
              let dpos = vec3<f32>(f32(i) - fu.x, f32(j) - fu.y, f32(k) - fu.z) * H;
              let val = clamp(p.vel.x + dot(p.c0.xyz, dpos), -22.0, 22.0);
              let idx = uIdx(i, j, k);
              atomicAdd(&uWeight[idx], i32(w * FP_SCALE + 0.5));
              atomicAdd(&uAccum[idx], i32(round(w * val * FP_SCALE)));
            }
          }
        }
      }

      // Splat v-faces (0.5, 0, 0.5)
      {
        let fv = gp - vec3<f32>(0.5, 0.0, 0.5);
        let cv = vec3<i32>(floor(fv + 0.5));
        let dv = fv - vec3<f32>(cv);
        let wx = bSplineWeights(dv.x);
        let wy = bSplineWeights(dv.y);
        let wz = bSplineWeights(dv.z);
        for (var dk = -1; dk <= 1; dk++) {
          let k = cv.z + dk;
          if (k < 0 || k >= NZ) { continue; }
          let wzk = wz[dk + 1];
          for (var dj = -1; dj <= 1; dj++) {
            let j = cv.y + dj;
            if (j < 0 || j > NY) { continue; }
            let wyj = wy[dj + 1] * wzk;
            for (var di = -1; di <= 1; di++) {
              let i = cv.x + di;
              if (i < 0 || i >= NX) { continue; }
              let w = wx[di + 1] * wyj;
              if (w <= 1e-6) { continue; }
              let dpos = vec3<f32>(f32(i) - fv.x, f32(j) - fv.y, f32(k) - fv.z) * H;
              let val = clamp(p.vel.y + dot(p.c1.xyz, dpos), -22.0, 22.0);
              let idx = vIdx(i, j, k);
              atomicAdd(&vWeight[idx], i32(w * FP_SCALE + 0.5));
              atomicAdd(&vAccum[idx], i32(round(w * val * FP_SCALE)));
            }
          }
        }
      }

      // Splat w-faces (0.5, 0.5, 0)
      {
        let fw = gp - vec3<f32>(0.5, 0.5, 0.0);
        let cw = vec3<i32>(floor(fw + 0.5));
        let dw = fw - vec3<f32>(cw);
        let wx = bSplineWeights(dw.x);
        let wy = bSplineWeights(dw.y);
        let wz = bSplineWeights(dw.z);
        for (var dk = -1; dk <= 1; dk++) {
          let k = cw.z + dk;
          if (k < 0 || k > NZ) { continue; }
          let wzk = wz[dk + 1];
          for (var dj = -1; dj <= 1; dj++) {
            let j = cw.y + dj;
            if (j < 0 || j >= NY) { continue; }
            let wyj = wy[dj + 1] * wzk;
            for (var di = -1; di <= 1; di++) {
              let i = cw.x + di;
              if (i < 0 || i >= NX) { continue; }
              let w = wx[di + 1] * wyj;
              if (w <= 1e-6) { continue; }
              let dpos = vec3<f32>(f32(i) - fw.x, f32(j) - fw.y, f32(k) - fw.z) * H;
              let val = clamp(p.vel.z + dot(p.c2.xyz, dpos), -22.0, 22.0);
              let idx = wIdx(i, j, k);
              atomicAdd(&wWeight[idx], i32(w * FP_SCALE + 0.5));
              atomicAdd(&wAccum[idx], i32(round(w * val * FP_SCALE)));
            }
          }
        }
      }
    }
  `;

  // 3. Normalize MAC Grid, Classify Cells (SOLID walls, wavemaker, reef, spheres), Apply Gravity
  const GRID_SETUP_WGSL = TANK_CONSTANTS + /* wgsl */`
    @group(0) @binding(0) var<uniform> sim: TankSimParams;
    @group(0) @binding(1) var<storage, read> spheres: array<TankSphere>;
    @group(0) @binding(2) var<storage, read> uAccum: array<i32>;
    @group(0) @binding(3) var<storage, read> uWeight: array<i32>;
    @group(0) @binding(4) var<storage, read> vAccum: array<i32>;
    @group(0) @binding(5) var<storage, read> vWeight: array<i32>;
    @group(0) @binding(6) var<storage, read> wAccum: array<i32>;
    @group(0) @binding(7) var<storage, read> wWeight: array<i32>;
    @group(0) @binding(8) var<storage, read> cellDensityAccum: array<i32>;
    @group(0) @binding(9) var<storage, read_write> uVel: array<f32>;
    @group(0) @binding(10) var<storage, read_write> uOld: array<f32>;
    @group(0) @binding(11) var<storage, read_write> vVel: array<f32>;
    @group(0) @binding(12) var<storage, read_write> vOld: array<f32>;
    @group(0) @binding(13) var<storage, read_write> wVel: array<f32>;
    @group(0) @binding(14) var<storage, read_write> wOld: array<f32>;
    @group(0) @binding(15) var<storage, read_write> cellType: array<u32>;
    @group(0) @binding(16) var<storage, read_write> cellDensity: array<f32>;

    @compute @workgroup_size(256)
    fn classifyAndNormalize(@builtin(global_invocation_id) gid: vec3<u32>) {
      let id = gid.x;
      if (id < u32((NX + 1) * NY * NZ)) {
        let w = uWeight[id];
        let val = select(0.0, f32(uAccum[id]) / f32(w), w > 0);
        uVel[id] = val;
        uOld[id] = val;
      }
      if (id < u32(NX * (NY + 1) * NZ)) {
        let w = vWeight[id];
        var val = select(0.0, f32(vAccum[id]) / f32(w), w > 0);
        vOld[id] = val;
        if (w > 0) { val -= sim.gravity * sim.dt; }
        vVel[id] = val;
      }
      if (id < u32(NX * NY * (NZ + 1))) {
        let w = wWeight[id];
        let val = select(0.0, f32(wAccum[id]) / f32(w), w > 0);
        wVel[id] = val;
        wOld[id] = val;
      }
      if (id < u32(NX * NY * NZ)) {
        let i = i32(id % u32(NX));
        let j = i32((id / u32(NX)) % u32(NY));
        let k = i32(id / u32(NX * NY));
        let cx = (f32(i) + 0.5) * H;
        let cy = (f32(j) + 0.5) * H;
        let cz = (f32(k) + 0.5) * H;
        let dNorm = f32(cellDensityAccum[id]) / (1024.0 * sim.restDensity);
        cellDensity[id] = dNorm;

        var ctype = CELL_AIR;
        if (i == 0 || i == NX - 1 || j == 0 || k == 0 || k == NZ - 1 || cx < sim.paddleX || cy < terrainHeight(cx, cz)) {
          ctype = CELL_SOLID;
        } else {
          // Check sphere occupation (fluid displaced by spheres!)
          var insideSphere = false;
          for (var s: u32 = 0u; s < sim.numSpheres; s++) {
            let sp = spheres[s];
            let d = length(vec3<f32>(cx, cy, cz) - sp.posRadius.xyz);
            if (d < sp.posRadius.w * 0.90) {
              insideSphere = true;
              break;
            }
          }
          if (insideSphere) {
            ctype = CELL_SOLID;
          } else if (dNorm > 0.08) {
            ctype = CELL_FLUID;
          }
        }
        cellType[id] = ctype;
      }
    }

    @compute @workgroup_size(256)
    fn enforceBoundaries(@builtin(global_invocation_id) gid: vec3<u32>) {
      let id = gid.x;
      // Enforce u faces touching SOLID
      if (id < u32((NX + 1) * NY * NZ)) {
        let i = i32(id % u32(NX + 1));
        let j = i32((id / u32(NX + 1)) % u32(NY));
        let k = i32(id / u32((NX + 1) * NY));
        if (i == 0 || i == NX) {
          uVel[id] = 0.0;
        } else {
          let tL = cellType[cellIdx(i - 1, j, k)];
          let tR = cellType[cellIdx(i, j, k)];
          if (tL == CELL_SOLID || tR == CELL_SOLID) {
            let fx = f32(i) * H;
            let fy = (f32(j) + 0.5) * H;
            let fz = (f32(k) + 0.5) * H;
            var sv = 0.0;
            if (fx <= sim.paddleX + H * 1.1 && fy >= terrainHeight(fx, fz)) {
              sv = sim.paddleVel;
            } else {
              // Sphere solid velocity contribution
              for (var s: u32 = 0u; s < sim.numSpheres; s++) {
                let sp = spheres[s];
                if (length(vec3<f32>(fx, fy, fz) - sp.posRadius.xyz) < sp.posRadius.w * 1.05) {
                  let couple = clamp(sp.velDensity.w / (sp.velDensity.w + 0.45), 0.35, 0.95);
                  sv = sp.velDensity.x * couple;
                  break;
                }
              }
            }
            uVel[id] = sv;
          }
        }
      }

      // Enforce v faces touching SOLID
      if (id < u32(NX * (NY + 1) * NZ)) {
        let i = i32(id % u32(NX));
        let j = i32((id / u32(NX)) % u32(NY + 1));
        let k = i32(id / u32(NX * (NY + 1)));
        if (j == 0) {
          vVel[id] = 0.0;
        } else if (j < NY) {
          let tB = cellType[cellIdx(i, j - 1, k)];
          let tT = cellType[cellIdx(i, j, k)];
          if (tB == CELL_SOLID || tT == CELL_SOLID) {
            let fx = (f32(i) + 0.5) * H;
            let fy = f32(j) * H;
            let fz = (f32(k) + 0.5) * H;
            var sv = 0.0;
            for (var s: u32 = 0u; s < sim.numSpheres; s++) {
              let sp = spheres[s];
              if (length(vec3<f32>(fx, fy, fz) - sp.posRadius.xyz) < sp.posRadius.w * 1.05) {
                let couple = clamp(sp.velDensity.w / (sp.velDensity.w + 0.45), 0.35, 0.95);
                sv = sp.velDensity.y * couple;
                break;
              }
            }
            vVel[id] = sv;
          }
        }
      }

      // Enforce w faces touching SOLID
      if (id < u32(NX * NY * (NZ + 1))) {
        let i = i32(id % u32(NX));
        let j = i32((id / u32(NX)) % u32(NY));
        let k = i32(id / u32(NX * NY));
        if (k == 0 || k == NZ) {
          wVel[id] = 0.0;
        } else {
          let t0 = cellType[cellIdx(i, j, k - 1)];
          let t1 = cellType[cellIdx(i, j, k)];
          if (t0 == CELL_SOLID || t1 == CELL_SOLID) {
            let fx = (f32(i) + 0.5) * H;
            let fy = (f32(j) + 0.5) * H;
            let fz = f32(k) * H;
            var sv = 0.0;
            for (var s: u32 = 0u; s < sim.numSpheres; s++) {
              let sp = spheres[s];
              if (length(vec3<f32>(fx, fy, fz) - sp.posRadius.xyz) < sp.posRadius.w * 1.05) {
                let couple = clamp(sp.velDensity.w / (sp.velDensity.w + 0.45), 0.35, 0.95);
                sv = sp.velDensity.z * couple;
                break;
              }
            }
            wVel[id] = sv;
          }
        }
      }
    }
  `;

  // 4. Multigrid Pressure Solver (Divergence + 4-level Restrict / Red-Black SOR / Prolongate + Pressure Apply)
  const PRESSURE_MG_WGSL = TANK_CONSTANTS + /* wgsl */`
    struct MGParams {
      nx: i32,
      ny: i32,
      nz: i32,
      off: i32,
      childNx: i32,
      childNy: i32,
      childNz: i32,
      childOff: i32,
      parity: i32,
      omega: f32,
      pad0: f32,
      pad1: f32,
    };

    @group(0) @binding(0) var<uniform> sim: TankSimParams;
    @group(0) @binding(1) var<uniform> mg: MGParams;
    @group(0) @binding(2) var<storage, read_write> uVel: array<f32>;
    @group(0) @binding(3) var<storage, read_write> vVel: array<f32>;
    @group(0) @binding(4) var<storage, read_write> wVel: array<f32>;
    @group(0) @binding(5) var<storage, read> cellDensity: array<f32>;
    @group(0) @binding(6) var<storage, read_write> mgType: array<u32>;
    @group(0) @binding(7) var<storage, read_write> mgP: array<f32>;
    @group(0) @binding(8) var<storage, read_write> mgB: array<f32>;
    @group(0) @binding(9) var<storage, read_write> mgR: array<f32>;

    @compute @workgroup_size(256)
    fn computeDivergence(@builtin(global_invocation_id) gid: vec3<u32>) {
      let id = gid.x;
      if (id >= u32(NX * NY * NZ)) { return; }
      let t = mgType[id];
      if (t != CELL_FLUID) {
        mgB[id] = 0.0;
        mgP[id] = 0.0;
        return;
      }
      let i = i32(id % u32(NX));
      let j = i32((id / u32(NX)) % u32(NY));
      let k = i32(id / u32(NX * NY));

      let div = (uVel[uIdx(i + 1, j, k)] - uVel[uIdx(i, j, k)]
               + vVel[vIdx(i, j + 1, k)] - vVel[vIdx(i, j, k)]
               + wVel[wIdx(i, j, k + 1)] - wVel[wIdx(i, j, k)]) * INV_H;

      // Mild volume restoration where fluid is compressed (raises water level cleanly when spheres submerge!)
      let dErr = clamp(cellDensity[id] - 1.0, 0.0, 1.2);
      let isInterior = (mgType[cellIdx(i, min(j + 1, NY - 1), k)] != CELL_AIR);
      let volFix = select(0.0, 0.35 * dErr / sim.dt, isInterior);

      mgB[id] = -(div - volFix) * (H * H);
      mgP[id] = 0.0;
    }

    @compute @workgroup_size(256)
    fn buildCoarseType(@builtin(global_invocation_id) gid: vec3<u32>) {
      let id = i32(gid.x);
      let total = mg.nx * mg.ny * mg.nz;
      if (id >= total) { return; }
      let i = id % mg.nx;
      let j = (id / mg.nx) % mg.ny;
      let k = id / (mg.nx * mg.ny);

      var hasAir = false;
      var hasFluid = false;
      for (var dk = 0; dk < 2; dk++) {
        for (var dj = 0; dj < 2; dj++) {
          for (var di = 0; di < 2; di++) {
            let ci = i * 2 + di;
            let cj = j * 2 + dj;
            let ck = k * 2 + dk;
            let cIdx = mg.childOff + (ck * mg.childNy + cj) * mg.childNx + ci;
            let ct = mgType[cIdx];
            if (ct == CELL_AIR) { hasAir = true; }
            else if (ct == CELL_FLUID) { hasFluid = true; }
          }
        }
      }
      let outIdx = mg.off + id;
      if (hasAir) { mgType[outIdx] = CELL_AIR; }
      else if (hasFluid) { mgType[outIdx] = CELL_FLUID; }
      else { mgType[outIdx] = CELL_SOLID; }
      mgP[outIdx] = 0.0;
    }

    @compute @workgroup_size(256)
    fn smoothRB(@builtin(global_invocation_id) gid: vec3<u32>) {
      let id = i32(gid.x);
      let total = mg.nx * mg.ny * mg.nz;
      if (id >= total) { return; }
      let i = id % mg.nx;
      let j = (id / mg.nx) % mg.ny;
      let k = id / (mg.nx * mg.ny);
      if (((i + j + k) & 1) != mg.parity) { return; }

      let idx = mg.off + id;
      if (mgType[idx] != CELL_FLUID) { return; }

      var numOpen: f32 = 0.0;
      var sumNb: f32 = 0.0;
      let strideY = mg.nx;
      let strideZ = mg.nx * mg.ny;

      if (i > 0) {
        let nb = idx - 1;
        let t = mgType[nb];
        if (t != CELL_SOLID) { numOpen += 1.0; if (t == CELL_FLUID) { sumNb += mgP[nb]; } }
      }
      if (i + 1 < mg.nx) {
        let nb = idx + 1;
        let t = mgType[nb];
        if (t != CELL_SOLID) { numOpen += 1.0; if (t == CELL_FLUID) { sumNb += mgP[nb]; } }
      }
      if (j > 0) {
        let nb = idx - strideY;
        let t = mgType[nb];
        if (t != CELL_SOLID) { numOpen += 1.0; if (t == CELL_FLUID) { sumNb += mgP[nb]; } }
      }
      if (j + 1 < mg.ny) {
        let nb = idx + strideY;
        let t = mgType[nb];
        if (t != CELL_SOLID) { numOpen += 1.0; if (t == CELL_FLUID) { sumNb += mgP[nb]; } }
      }
      if (k > 0) {
        let nb = idx - strideZ;
        let t = mgType[nb];
        if (t != CELL_SOLID) { numOpen += 1.0; if (t == CELL_FLUID) { sumNb += mgP[nb]; } }
      }
      if (k + 1 < mg.nz) {
        let nb = idx + strideZ;
        let t = mgType[nb];
        if (t != CELL_SOLID) { numOpen += 1.0; if (t == CELL_FLUID) { sumNb += mgP[nb]; } }
      }

      if (numOpen > 0.5) {
        let pTarget = (mgB[idx] + sumNb) / numOpen;
        mgP[idx] = mgP[idx] + mg.omega * (pTarget - mgP[idx]);
      }
    }

    @compute @workgroup_size(256)
    fn computeResidual(@builtin(global_invocation_id) gid: vec3<u32>) {
      let id = i32(gid.x);
      let total = mg.nx * mg.ny * mg.nz;
      if (id >= total) { return; }
      let idx = mg.off + id;
      if (mgType[idx] != CELL_FLUID) {
        mgR[idx] = 0.0;
        return;
      }
      let i = id % mg.nx;
      let j = (id / mg.nx) % mg.ny;
      let k = id / (mg.nx * mg.ny);
      let strideY = mg.nx;
      let strideZ = mg.nx * mg.ny;

      var numOpen: f32 = 0.0;
      var sumNb: f32 = 0.0;
      if (i > 0) { let t = mgType[idx - 1]; if (t != CELL_SOLID) { numOpen += 1.0; if (t == CELL_FLUID) { sumNb += mgP[idx - 1]; } } }
      if (i + 1 < mg.nx) { let t = mgType[idx + 1]; if (t != CELL_SOLID) { numOpen += 1.0; if (t == CELL_FLUID) { sumNb += mgP[idx + 1]; } } }
      if (j > 0) { let t = mgType[idx - strideY]; if (t != CELL_SOLID) { numOpen += 1.0; if (t == CELL_FLUID) { sumNb += mgP[idx - strideY]; } } }
      if (j + 1 < mg.ny) { let t = mgType[idx + strideY]; if (t != CELL_SOLID) { numOpen += 1.0; if (t == CELL_FLUID) { sumNb += mgP[idx + strideY]; } } }
      if (k > 0) { let t = mgType[idx - strideZ]; if (t != CELL_SOLID) { numOpen += 1.0; if (t == CELL_FLUID) { sumNb += mgP[idx - strideZ]; } } }
      if (k + 1 < mg.nz) { let t = mgType[idx + strideZ]; if (t != CELL_SOLID) { numOpen += 1.0; if (t == CELL_FLUID) { sumNb += mgP[idx + strideZ]; } } }

      mgR[idx] = mgB[idx] - (numOpen * mgP[idx] - sumNb);
    }

    @compute @workgroup_size(256)
    fn restrictResidual(@builtin(global_invocation_id) gid: vec3<u32>) {
      let id = i32(gid.x);
      let total = mg.nx * mg.ny * mg.nz;
      if (id >= total) { return; }
      let outIdx = mg.off + id;
      mgP[outIdx] = 0.0;
      if (mgType[outIdx] != CELL_FLUID) {
        mgB[outIdx] = 0.0;
        return;
      }
      let i = id % mg.nx;
      let j = (id / mg.nx) % mg.ny;
      let k = id / (mg.nx * mg.ny);
      var sumR = 0.0;
      for (var dk = 0; dk < 2; dk++) {
        for (var dj = 0; dj < 2; dj++) {
          for (var di = 0; di < 2; di++) {
            let cIdx = mg.childOff + ((k * 2 + dk) * mg.childNy + (j * 2 + dj)) * mg.childNx + (i * 2 + di);
            sumR += mgR[cIdx];
          }
        }
      }
      mgB[outIdx] = 0.5 * sumR;
    }

    @compute @workgroup_size(256)
    fn prolongate(@builtin(global_invocation_id) gid: vec3<u32>) {
      let id = i32(gid.x);
      let total = mg.childNx * mg.childNy * mg.childNz;
      if (id >= total) { return; }
      let cIdx = mg.childOff + id;
      if (mgType[cIdx] != CELL_FLUID) { return; }

      let ci = id % mg.childNx;
      let cj = (id / mg.childNx) % mg.childNy;
      let ck = id / (mg.childNx * mg.childNy);

      let pi = ci / 2;
      let pj = cj / 2;
      let pk = ck / 2;
      let coarseVal = mgP[mg.off + (pk * mg.ny + pj) * mg.nx + pi];
      mgP[cIdx] += coarseVal;
    }

    @compute @workgroup_size(256)
    fn applyPressure(@builtin(global_invocation_id) gid: vec3<u32>) {
      let id = gid.x;
      if (id < u32((NX + 1) * NY * NZ)) {
        let i = i32(id % u32(NX + 1));
        let j = i32((id / u32(NX + 1)) % u32(NY));
        let k = i32(id / u32((NX + 1) * NY));
        if (i > 0 && i < NX) {
          let cL = cellIdx(i - 1, j, k);
          let cR = cellIdx(i, j, k);
          let tL = mgType[cL];
          let tR = mgType[cR];
          if (tL != CELL_SOLID && tR != CELL_SOLID && (tL == CELL_FLUID || tR == CELL_FLUID)) {
            uVel[id] -= (mgP[cR] - mgP[cL]) * INV_H;
          }
        }
      }
      if (id < u32(NX * (NY + 1) * NZ)) {
        let i = i32(id % u32(NX));
        let j = i32((id / u32(NX)) % u32(NY + 1));
        let k = i32(id / u32(NX * (NY + 1)));
        if (j > 0 && j < NY) {
          let cB = cellIdx(i, j - 1, k);
          let cT = cellIdx(i, j, k);
          let tB = mgType[cB];
          let tT = mgType[cT];
          if (tB != CELL_SOLID && tT != CELL_SOLID && (tB == CELL_FLUID || tT == CELL_FLUID)) {
            vVel[id] -= (mgP[cT] - mgP[cB]) * INV_H;
          }
        }
      }
      if (id < u32(NX * NY * (NZ + 1))) {
        let i = i32(id % u32(NX));
        let j = i32((id / u32(NX)) % u32(NY));
        let k = i32(id / u32(NX * NY));
        if (k > 0 && k < NZ) {
          let c0 = cellIdx(i, j, k - 1);
          let c1 = cellIdx(i, j, k);
          let t0 = mgType[c0];
          let t1 = mgType[c1];
          if (t0 != CELL_SOLID && t1 != CELL_SOLID && (t0 == CELL_FLUID || t1 == CELL_FLUID)) {
            wVel[id] -= (mgP[c1] - mgP[c0]) * INV_H;
          }
        }
      }
    }
  `;

  // 5. G2P + Particle Advection + Solid/Sphere Push-Out
  const G2P_ADVECT_WGSL = TANK_CONSTANTS + /* wgsl */`
    @group(0) @binding(0) var<uniform> sim: TankSimParams;
    @group(0) @binding(1) var<storage, read> spheres: array<TankSphere>;
    @group(0) @binding(2) var<storage, read> uVel: array<f32>;
    @group(0) @binding(3) var<storage, read> uOld: array<f32>;
    @group(0) @binding(4) var<storage, read> vVel: array<f32>;
    @group(0) @binding(5) var<storage, read> vOld: array<f32>;
    @group(0) @binding(6) var<storage, read> wVel: array<f32>;
    @group(0) @binding(7) var<storage, read> wOld: array<f32>;
    @group(0) @binding(8) var<storage, read> cellDensity: array<f32>;
    @group(0) @binding(9) var<storage, read_write> particles: array<FluidParticle>;

    fn sampleDensity(pos: vec3<f32>) -> f32 {
      let dc = pos * INV_H - vec3<f32>(0.5);
      let b = clamp(vec3<i32>(floor(dc)), vec3<i32>(0), vec3<i32>(NX - 2, NY - 2, NZ - 2));
      let f = clamp(dc - vec3<f32>(b), vec3<f32>(0.0), vec3<f32>(1.0));
      let d000 = cellDensity[cellIdx(b.x, b.y, b.z)];
      let d100 = cellDensity[cellIdx(b.x + 1, b.y, b.z)];
      let d010 = cellDensity[cellIdx(b.x, b.y + 1, b.z)];
      let d110 = cellDensity[cellIdx(b.x + 1, b.y + 1, b.z)];
      let d001 = cellDensity[cellIdx(b.x, b.y, b.z + 1)];
      let d101 = cellDensity[cellIdx(b.x + 1, b.y, b.z + 1)];
      let d011 = cellDensity[cellIdx(b.x, b.y + 1, b.z + 1)];
      let d111 = cellDensity[cellIdx(b.x + 1, b.y + 1, b.z + 1)];
      let x00 = mix(d000, d100, f.x);
      let x10 = mix(d010, d110, f.x);
      let x01 = mix(d001, d101, f.x);
      let x11 = mix(d011, d111, f.x);
      return mix(mix(x00, x10, f.y), mix(x01, x11, f.y), f.z);
    }

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let pid = gid.x;
      if (pid >= sim.numParticles) { return; }
      var p = particles[pid];
      let gp = p.pos * INV_H;
      let dpScale = 4.0 * INV_H * INV_H;

      var uApic = 0.0; var uDiff = 0.0; var c0 = vec3<f32>(0.0);
      {
        let fu = gp - vec3<f32>(0.0, 0.5, 0.5);
        let cu = vec3<i32>(floor(fu + 0.5));
        let du = fu - vec3<f32>(cu);
        let wx = bSplineWeights(du.x);
        let wy = bSplineWeights(du.y);
        let wz = bSplineWeights(du.z);
        for (var dk = -1; dk <= 1; dk++) {
          let k = clamp(cu.z + dk, 0, NZ - 1);
          let wzk = wz[dk + 1];
          for (var dj = -1; dj <= 1; dj++) {
            let j = clamp(cu.y + dj, 0, NY - 1);
            let wyj = wy[dj + 1] * wzk;
            for (var di = -1; di <= 1; di++) {
              let i = clamp(cu.x + di, 0, NX);
              let w = wx[di + 1] * wyj;
              let idx = uIdx(i, j, k);
              let un = uVel[idx];
              let uo = uOld[idx];
              uApic += w * un;
              uDiff += w * (un - uo);
              let dpos = vec3<f32>(f32(i) - fu.x, f32(j) - fu.y, f32(k) - fu.z) * H;
              c0 += dpScale * w * un * dpos;
            }
          }
        }
      }

      var vApic = 0.0; var vDiff = 0.0; var c1 = vec3<f32>(0.0);
      {
        let fv = gp - vec3<f32>(0.5, 0.0, 0.5);
        let cv = vec3<i32>(floor(fv + 0.5));
        let dv = fv - vec3<f32>(cv);
        let wx = bSplineWeights(dv.x);
        let wy = bSplineWeights(dv.y);
        let wz = bSplineWeights(dv.z);
        for (var dk = -1; dk <= 1; dk++) {
          let k = clamp(cv.z + dk, 0, NZ - 1);
          let wzk = wz[dk + 1];
          for (var dj = -1; dj <= 1; dj++) {
            let j = clamp(cv.y + dj, 0, NY);
            let wyj = wy[dj + 1] * wzk;
            for (var di = -1; di <= 1; di++) {
              let i = clamp(cv.x + di, 0, NX - 1);
              let w = wx[di + 1] * wyj;
              let idx = vIdx(i, j, k);
              let vn = vVel[idx];
              let vo = vOld[idx];
              vApic += w * vn;
              vDiff += w * (vn - vo);
              let dpos = vec3<f32>(f32(i) - fv.x, f32(j) - fv.y, f32(k) - fv.z) * H;
              c1 += dpScale * w * vn * dpos;
            }
          }
        }
      }

      var wApic = 0.0; var wDiff = 0.0; var c2 = vec3<f32>(0.0);
      {
        let fw = gp - vec3<f32>(0.5, 0.5, 0.0);
        let cw = vec3<i32>(floor(fw + 0.5));
        let dw = fw - vec3<f32>(cw);
        let wx = bSplineWeights(dw.x);
        let wy = bSplineWeights(dw.y);
        let wz = bSplineWeights(dw.z);
        for (var dk = -1; dk <= 1; dk++) {
          let k = clamp(cw.z + dk, 0, NZ);
          let wzk = wz[dk + 1];
          for (var dj = -1; dj <= 1; dj++) {
            let j = clamp(cw.y + dj, 0, NY - 1);
            let wyj = wy[dj + 1] * wzk;
            for (var di = -1; di <= 1; di++) {
              let i = clamp(cw.x + di, 0, NX - 1);
              let w = wx[di + 1] * wyj;
              let idx = wIdx(i, j, k);
              let wn = wVel[idx];
              let wo = wOld[idx];
              wApic += w * wn;
              wDiff += w * (wn - wo);
              let dpos = vec3<f32>(f32(i) - fw.x, f32(j) - fw.y, f32(k) - fw.z) * H;
              c2 += dpScale * w * wn * dpos;
            }
          }
        }
      }

      let apicVel = vec3<f32>(uApic, vApic, wApic);
      let flipVel = p.vel + vec3<f32>(uDiff, vDiff, wDiff);
      var newVel = mix(apicVel, flipVel, sim.flipRatio);

      // Update particle density state before advection
      let dens = sampleDensity(p.pos);
      p.density = dens;
      if (dens < 0.14 && p.pos.y > 0.2) {
        // Ballistic isolated droplet feels pure gravity
        newVel.y -= sim.gravity * sim.dt * 0.25;
      }
      newVel = clamp(newVel, vec3<f32>(-18.0), vec3<f32>(18.0));

      // Midpoint / semi-implicit advection
      var pos = p.pos + newVel * sim.dt;

      // Enforce tank glass walls, wavemaker piston, and 3D terrain
      let minX = max(H * 1.05, sim.paddleX + 0.014);
      let maxX = TANK_X - H * 1.05;
      let minZ = H * 1.05;
      let maxZ = TANK_Z - H * 1.05;

      if (pos.x < minX) {
        pos.x = minX;
        newVel.x = max(newVel.x, sim.paddleVel);
      } else if (pos.x > maxX) {
        pos.x = maxX;
        newVel.x = min(newVel.x, 0.0);
      }

      if (pos.z < minZ) {
        pos.z = minZ;
        newVel.z = max(newVel.z, 0.0);
      } else if (pos.z > maxZ) {
        pos.z = maxZ;
        newVel.z = min(newVel.z, 0.0);
      }

      let th = terrainHeight(pos.x, pos.z) + 0.012;
      if (pos.y < th) {
        pos.y = th;
        let tn = terrainNormal(pos.x, pos.z);
        let vn = dot(newVel, tn);
        if (vn < 0.0) { newVel -= vn * tn; }
      }
      if (pos.y > TANK_Y - H * 1.1) {
        pos.y = TANK_Y - H * 1.1;
        newVel.y = min(newVel.y, 0.0);
      }

      // Push fluid particles out of rigid spheres (creates crisp impact craters & displaced crowns!)
      for (var s: u32 = 0u; s < sim.numSpheres; s++) {
        let sp = spheres[s];
        let diff = pos - sp.posRadius.xyz;
        let d = length(diff);
        let r = sp.posRadius.w + 0.008;
        if (d < r && d > 1e-5) {
          let n = diff / d;
          pos = sp.posRadius.xyz + n * r;
          let relVn = dot(newVel - sp.velDensity.xyz, n);
          if (relVn < 0.0) {
            newVel -= relVn * n * 0.9;
          }
        }
      }

      p.pos = pos;
      p.vel = newVel;
      p.c0 = vec4<f32>(c0, 0.0);
      p.c1 = vec4<f32>(c1, 0.0);
      p.c2 = vec4<f32>(c2, 0.0);
      particles[pid] = p;
    }
  `;

  // 6. Two-Way Sphere Hydrodynamics + Rigid Collision + Render Buffer Sync
  const SPHERE_PHYSICS_WGSL = TANK_CONSTANTS + /* wgsl */`
    @group(0) @binding(0) var<uniform> sim: TankSimParams;
    @group(0) @binding(1) var<storage, read> uVel: array<f32>;
    @group(0) @binding(2) var<storage, read> vVel: array<f32>;
    @group(0) @binding(3) var<storage, read> wVel: array<f32>;
    @group(0) @binding(4) var<storage, read> cellDensity: array<f32>;
    @group(0) @binding(5) var<storage, read> mgP: array<f32>;
    @group(0) @binding(6) var<storage, read> cellType: array<u32>;
    @group(0) @binding(7) var<storage, read_write> spheres: array<TankSphere>;
    @group(0) @binding(8) var<storage, read_write> renderSpheres: array<RenderSphereInstance>;
    @group(0) @binding(9) var<storage, read_write> statsOut: array<atomic<u32>>; // [0]=splashCount, [1]=maxSplashSpeed*1000, [2]=foamCount, [3]=waveEnergy*1000

    fn sampleField(pos: vec3<f32>) -> vec4<f32> {
      // returns (vx, vy, vz, density)
      let gp = clamp(pos * INV_H, vec3<f32>(0.5), vec3<f32>(f32(NX) - 1.5, f32(NY) - 1.5, f32(NZ) - 1.5));
      let i = clamp(i32(gp.x), 0, NX - 2);
      let j = clamp(i32(gp.y), 0, NY - 2);
      let k = clamp(i32(gp.z), 0, NZ - 2);
      let vx = 0.5 * (uVel[uIdx(i, j, k)] + uVel[uIdx(i + 1, j, k)]);
      let vy = 0.5 * (vVel[vIdx(i, j, k)] + vVel[vIdx(i, j + 1, k)]);
      let vz = 0.5 * (wVel[wIdx(i, j, k)] + wVel[wIdx(i, j, k + 1)]);
      let d = cellDensity[cellIdx(i, j, k)];
      return vec4<f32>(vx, vy, vz, d);
    }

    fn sampleFluidPressure(pos: vec3<f32>) -> f32 {
      let gp = pos * INV_H - vec3<f32>(0.5);
      let b = clamp(vec3<i32>(floor(gp)), vec3<i32>(0), vec3<i32>(NX - 2, NY - 2, NZ - 2));
      let f = clamp(gp - vec3<f32>(b), vec3<f32>(0.0), vec3<f32>(1.0));
      var sumP = 0.0;
      var sumW = 0.0;
      for (var dk = 0; dk <= 1; dk++) {
        let wz = select(1.0 - f.z, f.z, dk == 1);
        for (var dj = 0; dj <= 1; dj++) {
          let wy = select(1.0 - f.y, f.y, dj == 1);
          for (var di = 0; di <= 1; di++) {
            let wx = select(1.0 - f.x, f.x, di == 1);
            let w = wx * wy * wz;
            let ci = b.x + di;
            let cj = b.y + dj;
            let ck = b.z + dk;
            let idx = cellIdx(ci, cj, ck);
            let t = cellType[idx];
            if (t == CELL_FLUID) {
              sumP += w * mgP[idx];
              sumW += w;
            } else if (t == CELL_SOLID) {
              // Extrapolate local hydrostatic pressure from nearest fluid cell above so resting spheres keep full buoyancy!
              let cy = (f32(cj) + 0.5) * H;
              var foundP = 0.0;
              for (var up = 1; up <= 8; up++) {
                if (cj + up >= NY) { break; }
                let uIdxC = cellIdx(ci, cj + up, ck);
                let ut = cellType[uIdxC];
                if (ut == CELL_AIR) { break; }
                if (ut == CELL_FLUID) {
                  foundP = mgP[uIdxC] + sim.gravity * sim.dt * f32(up) * H;
                  break;
                }
              }
              if (foundP > 0.0) {
                sumP += w * foundP;
                sumW += w;
              }
            }
          }
        }
      }
      if (sumW > 1e-4) {
        // mgP stores (p_phys * dt / rho) -> divide by dt to get (p_phys / rho)
        return (sumP / sumW) / max(sim.dt, 1e-4);
      }
      return 0.0;
    }

    @compute @workgroup_size(64)
    fn integrateHydro(@builtin(global_invocation_id) gid: vec3<u32>) {
      let idx = gid.x;
      if (idx >= sim.numSpheres) { return; }
      var s = spheres[idx];
      let c = s.posRadius.xyz;
      let R = s.posRadius.w;
      let rhoS = s.velDensity.w;
      let volS = (4.0 / 3.0) * 3.14159265 * R * R * R;
      let mS = rhoS * volS;

      // 64-point Fibonacci sphere quadrature for pressure gradient, submerged fraction, fluid vel & shear torque!
      let probeR = R + 0.56 * H;
      let N_PTS = 64;
      let dArea = (4.0 * 3.14159265 * R * R) / f32(N_PTS);
      let goldenAngle = 2.39996323;

      var fPressure = vec3<f32>(0.0);
      var avgFluidVel = vec3<f32>(0.0);
      var torqueSum = vec3<f32>(0.0);
      var subCount = 0.0;

      for (var k = 0; k < N_PTS; k++) {
        let t = (f32(k) + 0.5) / f32(N_PTS);
        let y = 1.0 - 2.0 * t;
        let rxy = sqrt(max(0.0, 1.0 - y * y));
        let theta = goldenAngle * f32(k);
        let n = vec3<f32>(rxy * cos(theta), y, rxy * sin(theta));
        let xProbe = c + n * probeR;

        let fld = sampleField(xProbe);
        let isWet = smoothstep(0.06, 0.35, fld.w);
        if (isWet > 0.05) {
          let pVal = sampleFluidPressure(xProbe);
          // Surface integral of -n * P(c + probeR * n) dArea scales linearly with (probeR / R), so divide by (probeR / R)!
          let volScale = R / probeR;
          fPressure -= n * (pVal * dArea * volScale * isWet);
          avgFluidVel += fld.xyz * isWet;
          subCount += isWet;

          // Surface shear torque
          let vRelPt = fld.xyz - (s.velDensity.xyz + cross(s.angVelMass.xyz, n * R));
          torqueSum += cross(n * R, vRelPt) * isWet;
        }
      }

      let subFrac = clamp(subCount / f32(N_PTS), 0.0, 1.0);
      if (subCount > 0.5) {
        avgFluidVel /= subCount;
      }

      // Gravity + Hydrodynamic Pressure (Archimedes + Dynamic Wave Pressure) + Drag
      var vel = s.velDensity.xyz;
      var angVel = s.angVelMass.xyz;

      let fGrav = vec3<f32>(0.0, -mS * sim.gravity, 0.0);
      let relV = avgFluidVel - vel;
      let areaCross = 3.14159265 * R * R * subFrac;
      // Realistic quadratic form drag + slight linear Stokes damping for calm settling
      let Cd = 0.52;
      let fDrag = 0.5 * Cd * areaCross * length(relV) * relV + (1.8 * R * subFrac) * relV;

      // Water entry splash sound event detection
      let prevSub = s.prevState.x;
      var cool = max(0.0, s.prevState.y - sim.dt);
      if (prevSub < 0.08 && subFrac >= 0.08 && vel.y < -0.65 && cool <= 0.0) {
        atomicAdd(&statsOut[0], 1u);
        atomicMax(&statsOut[1], u32(clamp(-vel.y * 1000.0, 0.0, 20000.0)));
        cool = 0.18;
      }

      // Physical Virtual Added Mass m_eff = m_s + 0.5 * rho_w * V_sub eliminates light-sphere oscillation!
      let mEff = mS + 0.5 * volS * subFrac;
      let totalForce = fGrav + fPressure + fDrag;
      vel += (totalForce / mEff) * sim.dt;

      // Inertia I = 0.4 * mS * R^2
      let inertia = max(1e-5, 0.4 * mS * R * R + 0.1 * volS * R * R * subFrac);
      let dragTorque = torqueSum * (0.045 * R * R / f32(N_PTS));
      angVel += (dragTorque / inertia) * sim.dt;
      angVel *= pow(0.92, sim.dt * 60.0 * subFrac);

      s.posRadius = vec4<f32>(c + vel * sim.dt, R);
      s.velDensity = vec4<f32>(vel, rhoS);
      s.angVelMass = vec4<f32>(angVel, mS);
      s.prevState = vec4<f32>(subFrac, cool, 0.0, 0.0);
      spheres[idx] = s;
    }

    @compute @workgroup_size(1)
    fn solveCollisionsAndSync() {
      let N = sim.numSpheres;
      // 4 PBD/impulse collision iterations between spheres, walls, wavemaker, and 3D reef terrain
      for (var iter = 0; iter < 4; iter++) {
        // Sphere-Sphere collisions
        for (var i: u32 = 0u; i < N; i++) {
          var A = spheres[i];
          for (var j: u32 = i + 1u; j < N; j++) {
            var B = spheres[j];
            let diff = B.posRadius.xyz - A.posRadius.xyz;
            let rSum = A.posRadius.w + B.posRadius.w;
            let d2 = dot(diff, diff);
            if (d2 < rSum * rSum && d2 > 1e-8) {
              let dist = sqrt(d2);
              let n = diff / dist;
              let pen = rSum - dist;
              let invMa = 1.0 / max(1e-5, A.angVelMass.w);
              let invMb = 1.0 / max(1e-5, B.angVelMass.w);
              let invSum = invMa + invMb;
              A.posRadius = vec4<f32>(A.posRadius.xyz - n * (pen * invMa / invSum), A.posRadius.w);
              B.posRadius = vec4<f32>(B.posRadius.xyz + n * (pen * invMb / invSum), B.posRadius.w);

              let rvx = B.velDensity.xyz - A.velDensity.xyz;
              let vn = dot(rvx, n);
              if (vn < 0.0) {
                let e = 0.55;
                let jImp = -(1.0 + e) * vn / invSum;
                A.velDensity = vec4<f32>(A.velDensity.xyz - n * (jImp * invMa), A.velDensity.w);
                B.velDensity = vec4<f32>(B.velDensity.xyz + n * (jImp * invMb), B.velDensity.w);
              }
              spheres[i] = A;
              spheres[j] = B;
            }
          }
        }

        // Sphere vs Tank Walls, Wavemaker Paddle, and 3D Terrain
        for (var i: u32 = 0u; i < N; i++) {
          var S = spheres[i];
          var p = S.posRadius.xyz;
          var v = S.velDensity.xyz;
          var w = S.angVelMass.xyz;
          let R = S.posRadius.w;

          let minX = max(H + R, sim.paddleX + R + 0.004);
          let maxX = TANK_X - H - R;
          let minZ = H + R;
          let maxZ = TANK_Z - H - R;

          if (p.x < minX) {
            p.x = minX;
            if (v.x < sim.paddleVel) { v.x = sim.paddleVel + max(0.0, sim.paddleVel - v.x) * 0.45; }
          } else if (p.x > maxX) {
            p.x = maxX;
            if (v.x > 0.0) { v.x = -v.x * 0.52; }
          }
          if (p.z < minZ) {
            p.z = minZ;
            if (v.z < 0.0) { v.z = -v.z * 0.52; }
          } else if (p.z > maxZ) {
            p.z = maxZ;
            if (v.z > 0.0) { v.z = -v.z * 0.52; }
          }

          let th = terrainHeight(p.x, p.z);
          let tn = terrainNormal(p.x, p.z);
          // Account for local slope so sphere sits cleanly outside sloped terrain
          let minCenterY = th + R / max(0.4, tn.y);
          if (p.y < minCenterY) {
            p.y = minCenterY;
            let vn = dot(v, tn);
            if (vn < 0.0) {
              v -= (1.0 + 0.25) * vn * tn;
            }
            // Rolling contact friction on terrain
            let vt = v - dot(v, tn) * tn;
            v -= vt * 0.015;
            w = cross(tn, vt) / R;
          }
          if (p.y > TANK_Y + 0.6) {
            p.y = TANK_Y + 0.6;
            v.y = min(v.y, 0.0);
          }

          S.posRadius = vec4<f32>(p, R);
          S.velDensity = vec4<f32>(v, S.velDensity.w);
          S.angVelMass = vec4<f32>(w, S.angVelMass.w);
          spheres[i] = S;
        }
      }

      // Integrate sphere visual rotation quaternion & copy to RenderSphereInstance buffer
      for (var i: u32 = 0u; i < N; i++) {
        var S = spheres[i];
        let w = S.angVelMass.xyz;
        let wLen = length(w);
        var q = S.rotQuat;
        if (wLen > 1e-5) {
          let halfA = 0.5 * wLen * sim.dt;
          let s = sin(halfA) / wLen;
          let dq = vec4<f32>(w * s, cos(halfA));
          let nq = vec4<f32>(
            dq.w * q.x + dq.x * q.w + dq.y * q.z - dq.z * q.y,
            dq.w * q.y - dq.x * q.z + dq.y * q.w + dq.z * q.x,
            dq.w * q.z + dq.x * q.y - dq.y * q.x + dq.z * q.w,
            dq.w * q.w - dq.x * q.x - dq.y * q.y - dq.z * q.z
          );
          q = normalize(nq);
          S.rotQuat = q;
          spheres[i] = S;
        }
        var inst: RenderSphereInstance;
        inst.posRadius = S.posRadius;
        inst.colorMat = vec4<f32>(S.colorMeta.rgb, 3.0); // matType 3 = glossy colored density sphere
        inst.rotQuat = q;
        inst.extra = vec4<f32>(0.18, 0.08, 1.0, 0.0);
        renderSpheres[i] = inst;
      }
    }
  `;

  // 7. Whitewater Spawn & Advection (Spray, Surface Foam, Entrained Underwater Bubbles)
  const WHITEWATER_WGSL = TANK_CONSTANTS + /* wgsl */`
    @group(0) @binding(0) var<uniform> sim: TankSimParams;
    @group(0) @binding(1) var<storage, read> particles: array<FluidParticle>;
    @group(0) @binding(2) var<storage, read> spheres: array<TankSphere>;
    @group(0) @binding(3) var<storage, read> uVel: array<f32>;
    @group(0) @binding(4) var<storage, read> vVel: array<f32>;
    @group(0) @binding(5) var<storage, read> wVel: array<f32>;
    @group(0) @binding(6) var<storage, read> cellDensity: array<f32>;
    @group(0) @binding(7) var<storage, read_write> ww: array<WhitewaterParticle>;
    @group(0) @binding(8) var<storage, read_write> wwCursor: atomic<u32>;
    @group(0) @binding(9) var<storage, read_write> statsOut: array<atomic<u32>>;

    fn sampleFieldWW(pos: vec3<f32>) -> vec4<f32> {
      let gp = clamp(pos * INV_H, vec3<f32>(0.5), vec3<f32>(f32(NX) - 1.5, f32(NY) - 1.5, f32(NZ) - 1.5));
      let i = clamp(i32(gp.x), 0, NX - 2);
      let j = clamp(i32(gp.y), 0, NY - 2);
      let k = clamp(i32(gp.z), 0, NZ - 2);
      let vx = 0.5 * (uVel[uIdx(i, j, k)] + uVel[uIdx(i + 1, j, k)]);
      let vy = 0.5 * (vVel[vIdx(i, j, k)] + vVel[vIdx(i, j + 1, k)]);
      let vz = 0.5 * (wVel[wIdx(i, j, k)] + wVel[wIdx(i, j, k + 1)]);
      let d = cellDensity[cellIdx(i, j, k)];
      return vec4<f32>(vx, vy, vz, d);
    }

    @compute @workgroup_size(256)
    fn spawnFromFluid(@builtin(global_invocation_id) gid: vec3<u32>) {
      let pid = gid.x;
      if (pid >= sim.numParticles) { return; }
      // Stride check for efficiency & clean budget control
      if ((pid & 3u) != (u32(sim.time * 60.0) & 3u)) { return; }

      let p = particles[pid];
      let spd = length(p.vel);
      // Spawn foam/spray at fast breaking crests, sphere entry splash rims (upward jet), and wall impact
      let isSurface = p.density > 0.12 && p.density < 0.72;
      let isSplashJet = p.density > 0.08 && p.density < 0.68 && p.vel.y > 0.55 && spd > 1.15;
      let isPlunging = p.pos.y > 0.92 && spd > 1.75;
      if ((isSurface && (spd > 1.95 || isPlunging)) || isSplashJet) {
        let r = hashU32(pid ^ u32(sim.time * 997.0));
        let chance = clamp((spd - 1.10) * 0.065, 0.0, 0.16);
        if (r < chance) {
          let slot = atomicAdd(&wwCursor, 1u) % sim.maxWhitewater;
          var w: WhitewaterParticle;
          let jit = vec3<f32>(hashU32(pid + 1u) - 0.5, hashU32(pid + 2u) - 0.5, hashU32(pid + 3u) - 0.5) * 0.035;
          w.pos = p.pos + jit;
          w.vel = p.vel + jit * 6.0;
          w.life = 1.6 + hashU32(pid + 7u) * 2.4;
          w.kind = select(1.0, 0.0, p.density < 0.30 && p.vel.y > 0.45);
          ww[slot] = w;
        }
      }
    }

    @compute @workgroup_size(64)
    fn spawnBubblesFromSpheres(@builtin(global_invocation_id) gid: vec3<u32>) {
      let sid = gid.x;
      if (sid >= sim.numSpheres) { return; }
      let sp = spheres[sid];
      let spd = length(sp.velDensity.xyz);
      let subFrac = sp.prevState.x;
      if (subFrac > 0.08 && spd > 0.70) {
        let count = i32(clamp(spd * 2.5, 1.0, 7.0));
        for (var c = 0; c < count; c++) {
          let slot = atomicAdd(&wwCursor, 1u) % sim.maxWhitewater;
          let seed = sid * 131u + u32(sim.time * 1000.0) + u32(c) * 17u;
          let a = hashU32(seed) * 6.28318;
          let rr = sp.posRadius.w * (0.4 + 0.65 * hashU32(seed + 1u));
          let wakeDir = -normalize(sp.velDensity.xyz + vec3<f32>(0.0, -0.01, 0.0));
          var w: WhitewaterParticle;
          w.pos = sp.posRadius.xyz + wakeDir * sp.posRadius.w * 0.65 + vec3<f32>(cos(a) * rr, 0.02, sin(a) * rr);
          w.vel = sp.velDensity.xyz * 0.35 + vec3<f32>(cos(a) * 0.25, 0.22, sin(a) * 0.25);
          w.life = 1.4 + hashU32(seed + 5u) * 1.8;
          w.kind = 2.0; // underwater entrained bubble!
          ww[slot] = w;
        }
      }
    }

    @compute @workgroup_size(256)
    fn updateWhitewater(@builtin(global_invocation_id) gid: vec3<u32>) {
      let wid = gid.x;
      if (wid >= sim.maxWhitewater) { return; }
      var w = ww[wid];
      if (w.kind < -0.5 || w.life <= 0.0) {
        w.kind = -1.0;
        ww[wid] = w;
        return;
      }

      let fld = sampleFieldWW(w.pos);
      let dt = sim.dt;
      let calmDecay = select(1.0, 3.6, length(fld.xyz) < 0.35);

      if (w.kind < 0.5) {
        // Spray droplet: ballistic flight, transitions to surface foam upon re-entry
        w.vel.y -= sim.gravity * dt;
        w.vel *= (1.0 - 0.35 * dt);
        w.pos += w.vel * dt;
        w.life -= dt * 1.4;
        if (fld.w > 0.45 && w.vel.y < 0.0) {
          w.kind = 1.0;
          w.life = min(w.life + 1.0, 2.4);
          w.vel = fld.xyz;
        }
      } else if (w.kind < 1.5) {
        // Surface foam: drifts with surface fluid velocity, dissipates faster once waves calm
        w.vel = mix(w.vel, fld.xyz, clamp(10.0 * dt, 0.0, 1.0));
        if (fld.w < 0.16) {
          w.vel.y -= sim.gravity * 0.8 * dt;
        } else if (fld.w > 0.65) {
          // Buoyant rise to stay on top of wave surface
          w.vel.y += 1.6 * dt;
        }
        w.pos += w.vel * dt;
        w.life -= dt * 0.46 * calmDecay;
        atomicAdd(&statsOut[2], 1u);
      } else {
        // Underwater bubble: swirls with 3D fluid + rises buoyantly, pops into foam at surface
        w.vel = mix(w.vel, fld.xyz + vec3<f32>(0.0, 0.52, 0.0), clamp(6.0 * dt, 0.0, 1.0));
        w.pos += w.vel * dt;
        w.life -= dt * 0.72 * calmDecay;
        if (fld.w < 0.35 && w.pos.y > 0.4) {
          w.kind = 1.0;
          w.life = min(w.life, 0.65);
        }
      }

      // Keep inside tank
      let minX = max(H * 1.1, sim.paddleX + 0.015);
      w.pos.x = clamp(w.pos.x, minX, TANK_X - H * 1.1);
      w.pos.z = clamp(w.pos.z, H * 1.1, TANK_Z - H * 1.1);
      let th = terrainHeight(w.pos.x, w.pos.z) + 0.015;
      if (w.pos.y < th) { w.pos.y = th; w.vel.y = max(0.0, w.vel.y); }
      if (w.pos.y > TANK_Y - 0.02) { w.life = 0.0; }

      ww[wid] = w;
    }
  `;

  // 8. Smoothed Density Field + GPU Marching Cubes Surface Extraction + Caustics Map
  const SURFACE_MC_WGSL = TANK_CONSTANTS + /* wgsl */`
    struct DrawIndirectArgs {
      vertexCount: atomic<u32>,
      instanceCount: u32,
      firstVertex: u32,
      firstInstance: u32,
    };

    struct MCVert {
      px: f32, py: f32, pz: f32,
      nx: f32, ny: f32, nz: f32,
    };

    @group(0) @binding(0) var<uniform> sim: TankSimParams;
    @group(0) @binding(1) var<storage, read> cellDensity: array<f32>;
    @group(0) @binding(2) var<storage, read> cellType: array<u32>;
    @group(0) @binding(3) var<storage, read_write> smoothPhi: array<f32>;
    @group(0) @binding(4) var<storage, read> triTable: array<i32>;
    @group(0) @binding(5) var<storage, read_write> mcVerts: array<MCVert>;
    @group(0) @binding(6) var<storage, read_write> drawArgs: DrawIndirectArgs;
    @group(0) @binding(7) var<storage, read_write> causticAccum: array<atomic<u32>>;
    @group(0) @binding(8) var<storage, read> spheres: array<TankSphere>;

    @compute @workgroup_size(256)
    fn buildSmoothPhi(@builtin(global_invocation_id) gid: vec3<u32>) {
      let id = gid.x;
      if (id >= u32(NX * NY * NZ)) { return; }
      let i = i32(id % u32(NX));
      let j = i32((id / u32(NX)) % u32(NY));
      let k = i32(id / u32(NX * NY));

      // Clamp outer tank walls and wavemaker to 0 so MC forms closed clean water faces flush against glass
      let cx = (f32(i) + 0.5) * H;
      let cy = (f32(j) + 0.5) * H;
      let cz = (f32(k) + 0.5) * H;
      if (i == 0 || i == NX - 1 || j == 0 || j == NY - 1 || k == 0 || k == NZ - 1 || cx <= sim.paddleX + 0.004 || cy <= terrainHeight(cx, cz) - 0.025) {
        smoothPhi[id] = 0.0;
        return;
      }

      // 3x3x3 Gaussian-like smooth of particle density; fill submerged solid-sphere interiors from surrounding wet fluid so MC never extracts air pockets clipping spheres!
      var isSphereCell = false;
      if (cellType[id] == CELL_SOLID && cy > terrainHeight(cx, cz) + H * 0.4 && cx > sim.paddleX && cx < TANK_X - H && cz > H && cz < TANK_Z - H) {
        for (var s: u32 = 0u; s < sim.numSpheres; s++) {
          let sp = spheres[s];
          if (length(vec3<f32>(cx, cy, cz) - sp.posRadius.xyz) < sp.posRadius.w * 1.12) {
            isSphereCell = true;
            break;
          }
        }
      }

      var sum = 0.0;
      var wSum = 0.0;
      var wetCount = 0u;
      var wetAboveOrEq = 0u;
      var wetSum = 0.0;
      for (var dk = -1; dk <= 1; dk++) {
        for (var dj = -1; dj <= 1; dj++) {
          for (var di = -1; di <= 1; di++) {
            let ni = i + di;
            let nj = j + dj;
            let nk = k + dk;
            let w = select(select(1.0, 2.0, abs(di) + abs(dj) + abs(dk) <= 1), 4.0, di == 0 && dj == 0 && dk == 0);
            let nIdx = cellIdx(ni, nj, nk);
            let nCx = (f32(ni) + 0.5) * H;
            let nCy = (f32(nj) + 0.5) * H;
            let nCz = (f32(nk) + 0.5) * H;
            var val = cellDensity[nIdx];
            if (cellType[nIdx] != CELL_SOLID && val > 0.35) {
              wetCount++;
              wetSum += val;
              if (dj >= 0) { wetAboveOrEq++; }
            }
            if (cellType[nIdx] == CELL_SOLID && val < 0.01 && nCy < 1.25 && nCx > sim.paddleX && nCx < TANK_X - H && nCz > H && nCz < TANK_Z - H) {
              for (var s: u32 = 0u; s < sim.numSpheres; s++) {
                let sp = spheres[s];
                if (length(vec3<f32>(nCx, nCy, nCz) - sp.posRadius.xyz) < sp.posRadius.w * 1.05) {
                  val = max(cellDensity[id], 0.85);
                  break;
                }
              }
            }
            sum += w * val;
            wSum += w;
          }
        }
      }
      var res = sum / wSum;
      if (isSphereCell && wetCount >= 2u && wetAboveOrEq >= 1u) {
        res = max(res, wetSum / f32(wetCount));
      }
      smoothPhi[id] = res;
    }

    fn phiAt(i: i32, j: i32, k: i32) -> f32 {
      if (i < 0 || i >= NX || j < 0 || j >= NY || k < 0 || k >= NZ) { return 0.0; }
      return smoothPhi[cellIdx(i, j, k)];
    }

    fn gradNormal(i: i32, j: i32, k: i32) -> vec3<f32> {
      // Outward normal points from high phi (water) to low phi (air): -grad(phi)
      let gx = phiAt(i + 1, j, k) - phiAt(i - 1, j, k);
      let gy = phiAt(i, j + 1, k) - phiAt(i, j - 1, k);
      let gz = phiAt(i, j, k + 1) - phiAt(i, j, k - 1);
      let g = vec3<f32>(-gx, -gy, -gz);
      let l = length(g);
      return select(vec3<f32>(0.0, 1.0, 0.0), g / l, l > 1e-6);
    }

    @compute @workgroup_size(1)
    fn resetMCArgs() {
      atomicStore(&drawArgs.vertexCount, 0u);
      drawArgs.instanceCount = 1u;
      drawArgs.firstVertex = 0u;
      drawArgs.firstInstance = 0u;
    }

    @compute @workgroup_size(8, 8, 4)
    fn marchingCubes(@builtin(global_invocation_id) gid: vec3<u32>) {
      let i = i32(gid.x);
      let j = i32(gid.y);
      let k = i32(gid.z);
      if (i >= NX - 1 || j >= NY - 1 || k >= NZ - 1) { return; }

      let iso: f32 = 0.38;
      // 8 corners in standard Paul Bourke convention
      let ci = array<i32, 8>(i, i+1, i+1, i, i, i+1, i+1, i);
      let cj = array<i32, 8>(j, j, j+1, j+1, j, j, j+1, j+1);
      let ck = array<i32, 8>(k, k, k, k, k+1, k+1, k+1, k+1);

      var val: array<f32, 8>;
      var cubeIndex: u32 = 0u;
      for (var c = 0; c < 8; c++) {
        val[c] = phiAt(ci[c], cj[c], ck[c]);
        if (val[c] >= iso) { cubeIndex |= (1u << u32(c)); }
      }
      if (cubeIndex == 0u || cubeIndex == 255u) { return; }

      // Compute vertex positions & smooth normals at corners
      var pCorner: array<vec3<f32>, 8>;
      var nCorner: array<vec3<f32>, 8>;
      for (var c = 0; c < 8; c++) {
        // Snap glass-wall edges gently toward exact inner glass plane
        var px = (f32(ci[c]) + 0.5) * H;
        let py = (f32(cj[c]) + 0.5) * H;
        var pz = (f32(ck[c]) + 0.5) * H;
        if (ci[c] == 0) { px = max(px, H * 0.52); }
        pCorner[c] = vec3<f32>(px, py, pz);
        nCorner[c] = gradNormal(ci[c], cj[c], ck[c]);
      }

      // 12 edges corner pairs
      let e0 = array<i32, 12>(0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3);
      let e1 = array<i32, 12>(1, 2, 3, 0, 5, 6, 7, 4, 4, 5, 6, 7);

      var vertP: array<vec3<f32>, 12>;
      var vertN: array<vec3<f32>, 12>;
      for (var e = 0; e < 12; e++) {
        let a = e0[e];
        let b = e1[e];
        let va = val[a];
        let vb = val[b];
        if ((va >= iso) != (vb >= iso)) {
          let t = clamp((iso - va) / (vb - va + 1e-8), 0.0, 1.0);
          vertP[e] = mix(pCorner[a], pCorner[b], t);
          vertN[e] = normalize(mix(nCorner[a], nCorner[b], t));
        }
      }

      let baseRow = i32(cubeIndex) * 16;
      var triCount = 0;
      for (var m = 0; m < 15; m += 3) {
        if (triTable[baseRow + m] < 0) { break; }
        triCount++;
      }
      if (triCount == 0) { return; }

      let vStart = atomicAdd(&drawArgs.vertexCount, u32(triCount * 3));
      // Max buffer safety cap = 540,000 vertices
      if (vStart + u32(triCount * 3) >= 540000u) { return; }

      for (var t = 0; t < triCount; t++) {
        let i0 = triTable[baseRow + t * 3 + 0];
        let i1 = triTable[baseRow + t * 3 + 1];
        let i2 = triTable[baseRow + t * 3 + 2];

        var p0 = vertP[i0]; var n0 = vertN[i0];
        var p1 = vertP[i1]; var n1 = vertN[i1];
        var p2 = vertP[i2]; var n2 = vertN[i2];

        // Enforce outward winding consistent with -grad(phi)
        let faceN = cross(p1 - p0, p2 - p0);
        let avgN = n0 + n1 + n2;
        if (dot(faceN, avgN) < 0.0) {
          let tp = p1; p1 = p2; p2 = tp;
          let tn = n1; n1 = n2; n2 = tn;
        }

        let o = vStart + u32(t * 3);
        mcVerts[o + 0u] = MCVert(p0.x, p0.y, p0.z, n0.x, n0.y, n0.z);
        mcVerts[o + 1u] = MCVert(p1.x, p1.y, p1.z, n1.x, n1.y, n1.z);
        mcVerts[o + 2u] = MCVert(p2.x, p2.y, p2.z, n2.x, n2.y, n2.z);
      }
    }

    // Caustics ray trace from 256 x 64 sunlight grid through water top surface onto 256 x 64 caustic map
    @compute @workgroup_size(256)
    fn clearCaustics(@builtin(global_invocation_id) gid: vec3<u32>) {
      if (gid.x < 256u * 64u) {
        atomicStore(&causticAccum[gid.x], 0u);
      }
    }

    @compute @workgroup_size(16, 8)
    fn traceCaustics(@builtin(global_invocation_id) gid: vec3<u32>) {
      if (gid.x >= 256u || gid.y >= 64u) { return; }
      let wx = (f32(gid.x) + 0.5) / 256.0 * TANK_X;
      let wz = (f32(gid.y) + 0.5) / 64.0 * TANK_Z;
      if (wx < sim.paddleX + 0.06 || wx > TANK_X - 0.06 || wz < 0.06 || wz > TANK_Z - 0.06) { return; }

      let gi = clamp(i32(wx * INV_H), 1, NX - 2);
      let gk = clamp(i32(wz * INV_H), 1, NZ - 2);

      // Find top water surface cell in column (gi, *, gk)
      var topJ = -1;
      for (var j = NY - 2; j >= 1; j--) {
        if (phiAt(gi, j, gk) >= 0.36) {
          topJ = j;
          break;
        }
      }
      if (topJ < 1) { return; }

      let n = gradNormal(gi, topJ, gk);
      let wy = (f32(topJ) + 0.5) * H;
      let sunIn = normalize(vec3<f32>(0.36, -0.88, -0.30));
      // Snell refraction eta = 1 / 1.333
      let eta = 0.75;
      let cosi = -dot(sunIn, n);
      let k = 1.0 - eta * eta * (1.0 - cosi * cosi);
      let refr = select(sunIn, eta * sunIn + (eta * cosi - sqrt(max(0.0, k))) * n, k > 0.0);

      // Intersect down to average bed height ~0.22m
      let bedY = terrainHeight(wx, wz);
      let tHit = max(0.0, (bedY - wy) / min(-0.2, refr.y));
      let hitX = wx + refr.x * tHit;
      let hitZ = wz + refr.z * tHit;

      let cx = i32(hitX / TANK_X * 256.0);
      let cz = i32(hitZ / TANK_Z * 64.0);
      if (cx >= 1 && cx < 255 && cz >= 1 && cz < 63) {
        // Splat soft 3x3 caustic energy kernel
        for (var dz = -1; dz <= 1; dz++) {
          for (var dx = -1; dx <= 1; dx++) {
            let w = select(select(12u, 22u, abs(dx) + abs(dz) == 1), 36u, dx == 0 && dz == 0);
            atomicAdd(&causticAccum[u32((cz + dz) * 256 + (cx + dx))], w);
          }
        }
      }
    }
  `;

  // 9. Resolve Caustics atomic buffer -> rgba16float smooth texture
  const RESOLVE_CAUSTICS_WGSL = /* wgsl */`
    @group(0) @binding(0) var<storage, read> causticAccum: array<u32>;
    @group(0) @binding(1) var causticOutTex: texture_storage_2d<rgba16float, write>;

    @compute @workgroup_size(16, 8)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      if (gid.x >= 256u || gid.y >= 64u) { return; }
      let idx = gid.y * 256u + gid.x;
      // 3x3 weighted sum normalized around ~160.0 for calm surface
      let raw = f32(causticAccum[idx]) / 170.0;
      let val = clamp(pow(raw, 1.35) * 0.95, 0.0, 2.8);
      textureStore(causticOutTex, vec2<i32>(i32(gid.x), i32(gid.y)), vec4<f32>(val, val, val, 1.0));
    }
  `;

  // 10a. Opaque Tank (Reef + Bed + Wavemaker Paddle + Frame)
  const OPAQUE_TANK_WGSL = window.GpuCore.SHADER_COMMON + /* wgsl */`
    @group(0) @binding(0) var<uniform> u: FrameUniforms;
    @group(0) @binding(1) var shadowTex: texture_depth_2d;
    @group(0) @binding(2) var shadowSamp: sampler_comparison;
    @group(0) @binding(3) var causticTex: texture_2d<f32>;
    @group(0) @binding(4) var causticSamp: sampler;
    @group(0) @binding(5) var<uniform> extraVec: vec4<f32>; // x = paddleX, y = paddleVel, z = waterLevel, w = glassFlag

    struct VIn {
      @location(0) pos: vec3<f32>,
      @location(1) norm: vec3<f32>,
      @location(2) matId: f32, // 0=reef/bed, 1=paddle/metal, 2=tank frame
    };

    struct VOut {
      @builtin(position) pos: vec4<f32>,
      @location(0) wPos: vec3<f32>,
      @location(1) wNorm: vec3<f32>,
      @location(2) matId: f32,
    };

    @vertex
    fn vsOpaque(in: VIn) -> VOut {
      var out: VOut;
      var wp = in.pos;
      if (in.matId > 0.5 && in.matId < 1.5) {
        wp.x += extraVec.x;
      }
      out.wPos = wp;
      out.wNorm = in.norm;
      out.matId = in.matId;
      out.pos = u.viewProj * vec4<f32>(wp, 1.0);
      return out;
    }

    @vertex
    fn vsOpaqueShadow(in: VIn) -> @builtin(position) vec4<f32> {
      var wp = in.pos;
      if (in.matId > 0.5 && in.matId < 1.5) { wp.x += extraVec.x; }
      return u.lightViewProj * vec4<f32>(wp, 1.0);
    }

    @fragment
    fn fsOpaque(in: VOut) -> @location(0) vec4<f32> {
      let N = normalize(in.wNorm);
      let V = normalize(u.eyePos.xyz - in.wPos);
      let L = normalize(u.lightDir.xyz);
      let shadow = sampleShadowPCF(shadowTex, shadowSamp, in.wPos, N, u.lightViewProj, L);
      let ndl = max(dot(N, L), 0.0);

      var albedo = vec3<f32>(0.62, 0.65, 0.68);
      var rough = 0.55;
      var metal = 0.05;

      if (in.matId < 0.5) {
        let n1 = valueNoise3(in.wPos * 4.5);
        let n2 = valueNoise3(in.wPos * 18.0);
        let heightBlend = smoothstep(0.06, 0.48, in.wPos.y);
        let bedCol = vec3<f32>(0.54, 0.58, 0.62) + (n2 - 0.5) * 0.06;
        let reefCol = vec3<f32>(0.52, 0.49, 0.45) + (n1 - 0.5) * 0.10 + (n2 - 0.5) * 0.05;
        albedo = mix(bedCol, reefCol, heightBlend);
        let contour = smoothstep(0.015, 0.002, abs(fract(in.wPos.y * 10.0) - 0.5) * 0.1);
        albedo = mix(albedo, albedo * 0.80, contour * heightBlend * 0.45);
        rough = 0.72;
      } else if (in.matId < 1.5) {
        let brush = valueNoise3(vec3<f32>(in.wPos.x * 6.0, in.wPos.y * 36.0, in.wPos.z * 6.0));
        albedo = vec3<f32>(0.72, 0.76, 0.80) * (0.88 + 0.24 * brush);
        if (in.wPos.y > 1.72 && in.wPos.y < 1.84) {
          albedo = vec3<f32>(0.92, 0.42, 0.14);
          rough = 0.30;
          metal = 0.25;
        } else {
          rough = 0.26;
          metal = 0.88;
        }
      } else {
        albedo = vec3<f32>(0.18, 0.21, 0.25);
        rough = 0.35;
        metal = 0.75;
      }

      var caustic = vec3<f32>(0.0);
      if (in.wPos.y < extraVec.z + 0.18 && in.matId < 1.8) {
        let cuv = vec2<f32>(in.wPos.x / 5.60, in.wPos.z / 1.40);
        if (cuv.x > 0.01 && cuv.x < 0.99 && cuv.y > 0.01 && cuv.y < 0.99) {
          let cVal = textureSampleLevel(causticTex, causticSamp, cuv, 0.0).r;
          let wet = smoothstep(extraVec.z + 0.06, extraVec.z - 0.05, in.wPos.y);
          caustic = vec3<f32>(0.72, 0.95, 1.0) * cVal * wet * max(N.y * 0.7 + 0.3, 0.15) * u.sceneParams.w;
        }
      }

      let H = normalize(L + V);
      let ndh = max(dot(N, H), 0.0);
      let ndv = max(dot(N, V), 0.001);
      let F0 = mix(vec3<f32>(0.04), albedo, metal);
      let F = F0 + (vec3<f32>(1.0) - F0) * pow(1.0 - ndv, 5.0);
      let spec = pow(ndh, mix(140.0, 18.0, rough)) * mix(0.6, 0.08, rough);
      let env = studioEnv(reflect(-V, N), rough);
      let hemi = mix(vec3<f32>(0.22, 0.25, 0.29), vec3<f32>(0.55, 0.59, 0.65), N.y * 0.5 + 0.5);
      let kD = (1.0 - metal) * (vec3<f32>(1.0) - F);
      let direct = vec3<f32>(1.42, 1.38, 1.32) * ndl * (0.16 + 0.84 * shadow) + caustic;
      let col = kD * albedo * (hemi * 0.64 + direct) + F * env * mix(0.35, 1.15, metal) + F * spec * (0.2 + 0.8 * shadow) * 1.5;
      return vec4<f32>(col, 1.0);
    }
  `;

  // 10b. Water Optical Thickness Parity Pass
  const WATER_THICK_WGSL = window.GpuCore.SHADER_COMMON + /* wgsl */`
    @group(0) @binding(0) var<uniform> uw: FrameUniforms;
    @group(0) @binding(1) var opaqueDepthTexW: texture_depth_2d;

    struct WIn {
      @location(0) pos: vec3<f32>,
      @location(1) norm: vec3<f32>,
    };
    struct WOut {
      @builtin(position) pos: vec4<f32>,
      @location(0) viewZ: f32,
    };

    @vertex
    fn vs(in: WIn) -> WOut {
      var out: WOut;
      out.pos = uw.viewProj * vec4<f32>(in.pos, 1.0);
      out.viewZ = -(uw.view * vec4<f32>(in.pos, 1.0)).z;
      return out;
    }

    @fragment
    fn fs(in: WOut, @builtin(front_facing) isFront: bool) -> @location(0) vec4<f32> {
      let pix = vec2<i32>(in.pos.xy);
      if (in.pos.z >= textureLoad(opaqueDepthTexW, pix, 0)) { discard; }
      let s = select(1.0, -1.0, isFront);
      return vec4<f32>(s * in.viewZ, -s, 0.0, 1.0);
    }
  `;

  // 10c. Water Surface Refraction + Beer-Lambert + Studio Reflections
  const WATER_SURF_WGSL = window.GpuCore.SHADER_COMMON + /* wgsl */`
    @group(0) @binding(0) var<uniform> uw: FrameUniforms;
    @group(0) @binding(1) var opaqueDepthTexW: texture_depth_2d;
    @group(0) @binding(2) var opaqueColorTexW: texture_2d<f32>;
    @group(0) @binding(3) var waterThickTex: texture_2d<f32>;
    @group(0) @binding(4) var linearSampW: sampler;
    @group(0) @binding(5) var shadowTexW: texture_depth_2d;
    @group(0) @binding(6) var shadowSampW: sampler_comparison;

    struct WIn {
      @location(0) pos: vec3<f32>,
      @location(1) norm: vec3<f32>,
    };
    struct WOut {
      @builtin(position) pos: vec4<f32>,
      @location(0) wPos: vec3<f32>,
      @location(1) wNorm: vec3<f32>,
    };

    @vertex
    fn vs(in: WIn) -> WOut {
      var out: WOut;
      out.pos = uw.viewProj * vec4<f32>(in.pos, 1.0);
      out.wPos = in.pos;
      out.wNorm = in.norm;
      return out;
    }

    fn getOpaqueZ(uv: vec2<f32>, d: f32) -> f32 {
      let ndc = vec4<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, d, 1.0);
      let wp = uw.invViewProj * ndc;
      return -(uw.view * vec4<f32>(wp.xyz / wp.w, 1.0)).z;
    }

    @fragment
    fn fs(in: WOut) -> @location(0) vec4<f32> {
      var N = normalize(in.wNorm);
      let V = normalize(uw.eyePos.xyz - in.wPos);
      if (dot(N, V) < 0.0) { N = -N; }
      let L = normalize(uw.lightDir.xyz);

      let screenUV = in.pos.xy * uw.screenSize.zw;
      let pix = vec2<i32>(in.pos.xy);
      let opDepth = textureLoad(opaqueDepthTexW, pix, 0);
      let opZ = getOpaqueZ(screenUV, opDepth);
      let thickData = textureLoad(waterThickTex, pix, 0);

      var thickness = thickData.r;
      if (thickData.g > 0.5) {
        thickness += opZ * thickData.g;
      }
      thickness = clamp(thickness, 0.04, 3.2);

      let isSideWall = abs(N.y) < 0.32;
      let viewN = (uw.view * vec4<f32>(N, 0.0)).xyz;
      let refrWallMul = select(1.0, 0.08, isSideWall);
      let refrScale = mix(0.018, 0.048, clamp(thickness * 0.5, 0.0, 1.0)) * refrWallMul;
      let refrUV = clamp(screenUV - viewN.xy * refrScale * vec2<f32>(1.0, -1.0), vec2<f32>(0.002), vec2<f32>(0.998));
      let bgCol = textureSampleLevel(opaqueColorTexW, linearSampW, refrUV, 0.0).rgb;

      let absorbSigma = vec3<f32>(0.38, 0.11, 0.055);
      let transmittance = exp(-absorbSigma * thickness);
      let waterBodyCol = bgCol * transmittance;

      let shadow = sampleShadowPCF(shadowTexW, shadowSampW, in.wPos, N, uw.lightViewProj, L);
      let backScatter = pow(clamp(dot(V, -L + N * 0.5), 0.0, 1.0), 3.0);
      let scatterCol = vec3<f32>(0.08, 0.42, 0.52) * (0.28 + 0.72 * shadow) * (0.25 + 0.75 * backScatter) * (1.0 - transmittance.r) * 0.55;

      let ndv = max(dot(N, V), 0.001);
      let F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
      let R = reflect(-V, N);
      let env = studioEnv(R, 0.025);

      let H = normalize(L + V);
      let spec = pow(max(dot(N, H), 0.0), 360.0) * 1.8 * (0.25 + 0.75 * shadow);

      let reflWeight = select(clamp(F * 0.92, 0.02, 0.85), clamp(F * 0.18, 0.01, 0.15), isSideWall);

      let outCol = mix(waterBodyCol + scatterCol, env, reflWeight) + vec3<f32>(1.0, 0.99, 0.96) * spec;
      return vec4<f32>(outCol, 1.0);
    }
  `;

  // 10d. Whitewater (Spray, Foam, Bubbles)
  const WHITEWATER_RENDER_WGSL = window.GpuCore.SHADER_COMMON + /* wgsl */`
    struct WWParticleIn {
      pos: vec3<f32>,
      life: f32,
      vel: vec3<f32>,
      kind: f32,
    };

    @group(0) @binding(0) var<uniform> u: FrameUniforms;
    @group(0) @binding(1) var<storage, read> wwParticles: array<WWParticleIn>;

    struct WWOut {
      @builtin(position) pos: vec4<f32>,
      @location(0) uv: vec2<f32>,
      @location(1) kind: f32,
      @location(2) alpha: f32,
    };

    @vertex
    fn vs(@builtin(vertex_index) vid: u32, @builtin(instance_index) inst: u32) -> WWOut {
      var out: WWOut;
      let w = wwParticles[inst];
      if (w.kind < -0.5 || w.life <= 0.0) {
        out.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
        out.uv = vec2<f32>(0.0);
        out.kind = -1.0;
        out.alpha = 0.0;
        return out;
      }
      var quad = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
      );
      let q = quad[vid];
      let viewPos = (u.view * vec4<f32>(w.pos, 1.0)).xyz;
      let jSeed = hash31(vec3<f32>(f32(inst) * 0.13, 1.7, 3.1));
      let baseSz = select(select(0.0085, 0.0155, w.kind > 0.5), 0.009, w.kind > 1.5);
      let sz = baseSz * (0.72 + 0.56 * jSeed);
      out.pos = u.proj * vec4<f32>(viewPos + vec3<f32>(q * sz, 0.0), 1.0);
      out.uv = q;
      out.kind = w.kind;
      out.alpha = clamp(w.life * 0.65, 0.0, 0.88);
      return out;
    }

    @fragment
    fn fs(in: WWOut) -> @location(0) vec4<f32> {
      let r2 = dot(in.uv, in.uv);
      if (r2 > 1.0 || in.alpha <= 0.01) { discard; }
      let falloff = pow(1.0 - r2, 2.8);
      if (in.kind > 1.5) {
        let rim = smoothstep(0.28, 0.80, r2) * (1.0 - smoothstep(0.80, 1.0, r2));
        let col = vec3<f32>(0.78, 0.94, 1.0) * (0.32 + 1.15 * rim);
        let a = (0.16 + 0.36 * rim) * in.alpha;
        return vec4<f32>(col * a, a);
      } else if (in.kind > 0.5) {
        let a = falloff * in.alpha * 0.42;
        return vec4<f32>(vec3<f32>(0.93, 0.97, 1.0) * a, a);
      } else {
        let a = falloff * in.alpha * 0.50;
        return vec4<f32>(vec3<f32>(0.90, 0.96, 1.0) * a, a);
      }
    }
  `;

  // 10e. Detached Ballistic Water Droplets
  const DROPLET_RENDER_WGSL = window.GpuCore.SHADER_COMMON + /* wgsl */`
    struct FluidPIn {
      pos: vec3<f32>,
      density: f32,
      vel: vec3<f32>,
      tag: f32,
      c0: vec4<f32>,
      c1: vec4<f32>,
      c2: vec4<f32>,
    };

    @group(0) @binding(0) var<uniform> u: FrameUniforms;
    @group(0) @binding(1) var<storage, read> fluidPts: array<FluidPIn>;

    struct WWOut {
      @builtin(position) pos: vec4<f32>,
      @location(0) uv: vec2<f32>,
      @location(1) alpha: f32,
    };

    @vertex
    fn vs(@builtin(vertex_index) vid: u32, @builtin(instance_index) inst: u32) -> WWOut {
      var out: WWOut;
      let p = fluidPts[inst];
      if (p.density >= 0.25 || p.pos.y < 0.08) {
        out.pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
        out.uv = vec2<f32>(0.0);
        out.alpha = 0.0;
        return out;
      }
      var quad = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
      );
      let q = quad[vid];
      let viewPos = (u.view * vec4<f32>(p.pos, 1.0)).xyz;
      out.pos = u.proj * vec4<f32>(viewPos + vec3<f32>(q * 0.016, 0.0), 1.0);
      out.uv = q;
      out.alpha = 1.0;
      return out;
    }

    @fragment
    fn fs(in: WWOut) -> @location(0) vec4<f32> {
      let r2 = dot(in.uv, in.uv);
      if (r2 > 1.0 || in.alpha <= 0.01) { discard; }
      let spec = smoothstep(0.6, 0.0, length(in.uv - vec2<f32>(-0.28, 0.32)));
      let col = mix(vec3<f32>(0.55, 0.85, 0.96), vec3<f32>(1.0), spec * 0.85);
      let a = (1.0 - r2) * 0.72;
      return vec4<f32>(col * a, a);
    }
  `;

  // 10f. Glass Tank Outer Walls (Crisp bevel edge highlights, non-obstructing interior view)
  const GLASS_TANK_WGSL = window.GpuCore.SHADER_COMMON + /* wgsl */`
    @group(0) @binding(0) var<uniform> u: FrameUniforms;

    struct VIn {
      @location(0) pos: vec3<f32>,
      @location(1) norm: vec3<f32>,
      @location(2) matId: f32,
    };
    struct VOut {
      @builtin(position) pos: vec4<f32>,
      @location(0) wPos: vec3<f32>,
      @location(1) wNorm: vec3<f32>,
    };

    @vertex
    fn vs(in: VIn) -> VOut {
      var out: VOut;
      out.wPos = in.pos;
      out.wNorm = in.norm;
      out.pos = u.viewProj * vec4<f32>(in.pos, 1.0);
      return out;
    }

    @fragment
    fn fs(in: VOut) -> @location(0) vec4<f32> {
      let N = normalize(in.wNorm);
      let V = normalize(u.eyePos.xyz - in.wPos);
      let ndv = abs(dot(N, V));

      let ex = min(in.wPos.x, 5.60 - in.wPos.x);
      let ey = min(in.wPos.y, 2.10 - in.wPos.y);
      let ez = min(in.wPos.z, 1.40 - in.wPos.z);
      let minEdge = select(min(ex, ey), min(ez, ey), abs(N.x) > 0.5);
      let edgeBevel = 1.0 - smoothstep(0.0, 0.022, minEdge);

      var tickMask = 0.0;
      if (abs(N.z) > 0.8 && in.wPos.z > 1.35 && in.wPos.x > 0.48 && in.wPos.x < 0.60 && in.wPos.y > 0.55 && in.wPos.y < 1.35) {
        let ty = fract(in.wPos.y * 20.0);
        let major = fract(in.wPos.y * 5.0);
        let isTick = smoothstep(0.10, 0.02, abs(ty - 0.5));
        let lenMask = select(smoothstep(0.55, 0.53, in.wPos.x), 1.0, abs(major - 0.5) < 0.14);
        tickMask = isTick * lenMask * 0.55;
      }

      let F = 0.025 + 0.975 * pow(1.0 - ndv, 5.0);
      let R = reflect(-V, N);
      let env = studioEnv(R, 0.04);

      let edgeCol = vec3<f32>(0.74, 0.92, 0.98) * (0.45 + 0.85 * edgeBevel);
      let baseAlpha = clamp(F * 0.16 + edgeBevel * 0.44 + tickMask * 0.55, 0.02, 0.68);
      let outCol = env * (F * 0.18) + edgeCol * (edgeBevel * 0.55) + vec3<f32>(0.85, 0.95, 1.0) * tickMask;
      return vec4<f32>(outCol, baseAlpha);
    }
  `;

  return {
    TANK_CONSTANTS,
    CLEAR_GRID_WGSL,
    P2G_SCATTER_WGSL,
    GRID_SETUP_WGSL,
    PRESSURE_MG_WGSL,
    G2P_ADVECT_WGSL,
    SPHERE_PHYSICS_WGSL,
    WHITEWATER_WGSL,
    SURFACE_MC_WGSL,
    RESOLVE_CAUSTICS_WGSL,
    OPAQUE_TANK_WGSL,
    WATER_THICK_WGSL,
    WATER_SURF_WGSL,
    WHITEWATER_RENDER_WGSL,
    DROPLET_RENDER_WGSL,
    GLASS_TANK_WGSL
  };
})();
