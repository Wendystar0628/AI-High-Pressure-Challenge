// Scene 2: 3D WebGPU APIC/FLIP Wave Tank + 4-Level Multigrid Pressure + 2-Way Multi-Density Spheres + Whitewater + Marching Cubes + Caustics
window.SceneTank = (() => {
  'use strict';

  const M = window.AppMath;
  const TS = window.TankShaders;

  const NX = 128, NY = 48, NZ = 32;
  const H = 0.04375;
  const TANK_X = 5.60, TANK_Y = 2.10, TANK_Z = 1.40;
  const MAX_PARTICLES = 589824; // 576 * 1024
  const MAX_WHITEWATER = 65536;
  const MAX_SPHERES = 48;
  const MAX_MC_VERTS = 540000;

  function terrainHeightJS(x, z) {
    const s1 = M.smoothstep(2.10, 3.35, x);
    const s2 = 1.0 - M.smoothstep(3.45, 4.45, x);
    const fx = s1 * s2;
    const fz = 0.28 + 0.72 * M.smoothstep(0.18, 1.06, z);
    return 0.045 + 0.54 * fx * fz;
  }

  function terrainNormalJS(x, z) {
    const eps = 0.02;
    const hx = terrainHeightJS(x + eps, z) - terrainHeightJS(x - eps, z);
    const hz = terrainHeightJS(x, z + eps) - terrainHeightJS(x, z - eps);
    const len = Math.hypot(-hx / (2 * eps), 1.0, -hz / (2 * eps));
    return [(-hx / (2 * eps)) / len, 1.0 / len, (-hz / (2 * eps)) / len];
  }

  function buildTankMeshes(device) {
    const verts = []; // pos(3), norm(3), matId(1) = 7 floats
    const pushTri = (p0, n0, p1, n1, p2, n2, matId) => {
      verts.push(
        p0[0], p0[1], p0[2], n0[0], n0[1], n0[2], matId,
        p1[0], p1[1], p1[2], n1[0], n1[1], n1[2], matId,
        p2[0], p2[1], p2[2], n2[0], n2[1], n2[2], matId
      );
    };
    const pushQuad = (a, b, c, d, n, matId) => {
      pushTri(a, n, b, n, c, n, matId);
      pushTri(a, n, c, n, d, n, matId);
    };
    const pushBox = (x0, y0, z0, x1, y1, z1, matId) => {
      // +Y
      pushQuad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0],matId);
      // -Y
      pushQuad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0],matId);
      // +X
      pushQuad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],matId);
      // -X
      pushQuad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],matId);
      // +Z
      pushQuad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],matId);
      // -Z
      pushQuad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],matId);
    };

    // 1. Sculpted 3D Reef & Tank Bed (matId = 0)
    const gx = 96, gz = 32;
    for (let k = 0; k < gz; k++) {
      const z0 = (k / gz) * TANK_Z;
      const z1 = ((k + 1) / gz) * TANK_Z;
      for (let i = 0; i < gx; i++) {
        const x0 = (i / gx) * TANK_X;
        const x1 = ((i + 1) / gx) * TANK_X;
        const p00 = [x0, terrainHeightJS(x0, z0), z0];
        const p10 = [x1, terrainHeightJS(x1, z0), z0];
        const p11 = [x1, terrainHeightJS(x1, z1), z1];
        const p01 = [x0, terrainHeightJS(x0, z1), z1];
        const n00 = terrainNormalJS(x0, z0);
        const n10 = terrainNormalJS(x1, z0);
        const n11 = terrainNormalJS(x1, z1);
        const n01 = terrainNormalJS(x0, z1);
        pushTri(p00, n00, p01, n01, p11, n11, 0);
        pushTri(p00, n00, p11, n11, p10, n10, 0);
      }
    }
    // Side skirts under terrain so bottom thickness is solid
    pushBox(0, -0.02, 0, TANK_X, 0.045, TANK_Z, 0);

    // 2. Wavemaker Piston Paddle + Actuator Rod (matId = 1, shifts by extraVec.x = paddleX)
    pushBox(-0.045, 0.045, 0.045, 0.0, 1.92, TANK_Z - 0.045, 1);
    pushBox(-0.075, 1.72, 0.03, 0.01, 1.85, TANK_Z - 0.03, 1); // orange-striped top crosshead
    // Twin actuator pistons extending behind paddle
    pushBox(-0.78, 0.92, 0.38, -0.04, 1.00, 0.46, 1);
    pushBox(-0.78, 0.92, TANK_Z - 0.46, -0.04, 1.00, TANK_Z - 0.38, 1);

    // 3. Static Anodized Aluminum Frame Rails & Left Drive Housing (matId = 2)
    const r = 0.024;
    // Bottom rim
    pushBox(-r, -0.02, -r, TANK_X + r, 0.04, r, 2);
    pushBox(-r, -0.02, TANK_Z - r, TANK_X + r, 0.04, TANK_Z + r, 2);
    pushBox(-r, -0.02, -r, r, 0.04, TANK_Z + r, 2);
    pushBox(TANK_X - r, -0.02, -r, TANK_X + r, 0.04, TANK_Z + r, 2);
    // 4 Corner vertical posts
    pushBox(-r, 0, -r, r, TANK_Y + r, r, 2);
    pushBox(TANK_X - r, 0, -r, TANK_X + r, TANK_Y + r, r, 2);
    pushBox(-r, 0, TANK_Z - r, r, TANK_Y + r, TANK_Z + r, 2);
    pushBox(TANK_X - r, 0, TANK_Z - r, TANK_X + r, TANK_Y + r, TANK_Z + r, 2);
    // Top rails
    pushBox(-r, TANK_Y - 0.01, -r, TANK_X + r, TANK_Y + r, r, 2);
    pushBox(-r, TANK_Y - 0.01, TANK_Z - r, TANK_X + r, TANK_Y + r, TANK_Z + r, 2);
    pushBox(-r, TANK_Y - 0.01, -r, r, TANK_Y + r, TANK_Z + r, 2);
    pushBox(TANK_X - r, TANK_Y - 0.01, -r, TANK_X + r, TANK_Y + r, TANK_Z + r, 2);
    // Left actuator drive block & guide rails
    pushBox(-0.68, 0.0, 0.25, -0.45, 1.15, TANK_Z - 0.25, 2);
    pushBox(-0.68, 1.80, 0.14, 0.80, 1.85, 0.18, 2);
    pushBox(-0.68, 1.80, TANK_Z - 0.18, 0.80, 1.85, TANK_Z - 0.14, 2);

    const opaqueData = new Float32Array(verts);
    const opaqueBuf = device.createBuffer({ size: opaqueData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(opaqueBuf, 0, opaqueData);

    // 4. Transparent Glass Panes (Front +Z, Back -Z, Left -X, Right +X)
    const gVerts = [];
    const pushGlassQuad = (a, b, c, d, n) => {
      gVerts.push(
        a[0],a[1],a[2], n[0],n[1],n[2], 3,
        b[0],b[1],b[2], n[0],n[1],n[2], 3,
        c[0],c[1],c[2], n[0],n[1],n[2], 3,
        a[0],a[1],a[2], n[0],n[1],n[2], 3,
        c[0],c[1],c[2], n[0],n[1],n[2], 3,
        d[0],d[1],d[2], n[0],n[1],n[2], 3
      );
    };
    // Outer panes
    pushGlassQuad([0,0,TANK_Z], [TANK_X,0,TANK_Z], [TANK_X,TANK_Y,TANK_Z], [0,TANK_Y,TANK_Z], [0,0,1]);
    pushGlassQuad([TANK_X,0,0], [0,0,0], [0,TANK_Y,0], [TANK_X,TANK_Y,0], [0,0,-1]);
    pushGlassQuad([TANK_X,0,TANK_Z], [TANK_X,0,0], [TANK_X,TANK_Y,0], [TANK_X,TANK_Y,TANK_Z], [1,0,0]);
    pushGlassQuad([0,0,0], [0,0,TANK_Z], [0,TANK_Y,TANK_Z], [0,TANK_Y,0], [-1,0,0]);

    const glassData = new Float32Array(gVerts);
    const glassBuf = device.createBuffer({ size: glassData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(glassBuf, 0, glassData);

    return {
      opaqueBuf, opaqueVertCount: opaqueData.length / 7,
      glassBuf, glassVertCount: glassData.length / 7
    };
  }

  class SceneTank {
    constructor(sharedGpu) {
      this.gpu = sharedGpu;
      this.device = sharedGpu.device;

      this.params = {
        waveAmp: 0.20,       // 0.04 .. 0.36 m half-stroke
        waveFreq: 0.62,      // 0.25 .. 1.10 Hz
        waveEnabled: false,
        densities: [0.34, 0.72, 1.00, 2.45] // 4 distinct groups!
      };

      this.groupColors = [
        [1.00, 0.36, 0.16], // 0: Coral-Orange (超轻浮球)
        [0.98, 0.80, 0.14], // 1: Gold-Yellow  (浅浸浮球)
        [0.06, 0.86, 0.56], // 2: Emerald      (中性悬浮球)
        [0.24, 0.38, 0.96]  // 3: Deep Indigo  (高密度沉球)
      ];

      this.time = 0;
      this.wavePhase = 0;
      this.waveEnvelope = 0; // smooth ramp 0..1 when starting/stopping wavemaker
      this.paddleX = 0.22;
      this.paddleVel = 0.0;
      this.numParticles = 0;
      this.numSpheres = 32;
      this.sphereMeta = [];

      this._statsMapping = false;
      this.lastWaveEnergy = 0;
      this.lastFoamCount = 0;
      this.estimatedWaterLevel = 0.92;

      this._initBuffers();
      this._initComputePipelines();
      this._initRenderPipelines();
      this.resetScene('default');
    }

    _initBuffers() {
      const d = this.device;

      this.simParamsBuf = d.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.extraVecBuf = d.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

      // Fluid Particles: 80 bytes each
      this.particlesBuf = d.createBuffer({ size: MAX_PARTICLES * 80, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      // Whitewater: 32 bytes each
      this.whitewaterBuf = d.createBuffer({ size: MAX_WHITEWATER * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      this.wwCursorBuf = d.createBuffer({ size: 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });

      // Spheres
      this.spheresBuf = d.createBuffer({ size: MAX_SPHERES * 96, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      this.renderSpheresBuf = d.createBuffer({ size: MAX_SPHERES * 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });

      // Stats readback
      this.statsBuf = d.createBuffer({ size: 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      this.statsReadBuf = d.createBuffer({ size: 32, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

      // MAC Grid arrays
      const nCells = NX * NY * NZ;
      const nU = (NX + 1) * NY * NZ;
      const nV = NX * (NY + 1) * NZ;
      const nW = NX * NY * (NZ + 1);

      this.uAccumBuf = d.createBuffer({ size: nU * 4, usage: GPUBufferUsage.STORAGE });
      this.uWeightBuf = d.createBuffer({ size: nU * 4, usage: GPUBufferUsage.STORAGE });
      this.vAccumBuf = d.createBuffer({ size: nV * 4, usage: GPUBufferUsage.STORAGE });
      this.vWeightBuf = d.createBuffer({ size: nV * 4, usage: GPUBufferUsage.STORAGE });
      this.wAccumBuf = d.createBuffer({ size: nW * 4, usage: GPUBufferUsage.STORAGE });
      this.wWeightBuf = d.createBuffer({ size: nW * 4, usage: GPUBufferUsage.STORAGE });

      this.uVelBuf = d.createBuffer({ size: nU * 4, usage: GPUBufferUsage.STORAGE });
      this.uOldBuf = d.createBuffer({ size: nU * 4, usage: GPUBufferUsage.STORAGE });
      this.vVelBuf = d.createBuffer({ size: nV * 4, usage: GPUBufferUsage.STORAGE });
      this.vOldBuf = d.createBuffer({ size: nV * 4, usage: GPUBufferUsage.STORAGE });
      this.wVelBuf = d.createBuffer({ size: nW * 4, usage: GPUBufferUsage.STORAGE });
      this.wOldBuf = d.createBuffer({ size: nW * 4, usage: GPUBufferUsage.STORAGE });

      this.cellDensityAccumBuf = d.createBuffer({ size: nCells * 4, usage: GPUBufferUsage.STORAGE });
      this.cellDensityBuf = d.createBuffer({ size: nCells * 4, usage: GPUBufferUsage.STORAGE });
      this.smoothPhiBuf = d.createBuffer({ size: nCells * 4, usage: GPUBufferUsage.STORAGE });

      // 4-Level Multigrid buffers
      const mgTotal = 196608 + 24576 + 3072 + 384; // 224,640
      this.mgTypeBuf = d.createBuffer({ size: mgTotal * 4, usage: GPUBufferUsage.STORAGE });
      this.mgPBuf = d.createBuffer({ size: mgTotal * 4, usage: GPUBufferUsage.STORAGE });
      this.mgBBuf = d.createBuffer({ size: mgTotal * 4, usage: GPUBufferUsage.STORAGE });
      this.mgRBuf = d.createBuffer({ size: mgTotal * 4, usage: GPUBufferUsage.STORAGE });

      // Static uniform buffers for each MG level + parity [4][2]
      this.mgLevels = [
        { nx: 128, ny: 48, nz: 32, off: 0,      cnx: 128, cny: 48, cnz: 32, coff: 0,      omega: 1.55 },
        { nx: 64,  ny: 24, nz: 16, off: 196608, cnx: 128, cny: 48, cnz: 32, coff: 0,      omega: 1.55 },
        { nx: 32,  ny: 12, nz: 8,  off: 221184, cnx: 64,  cny: 24, cnz: 16, coff: 196608, omega: 1.55 },
        { nx: 16,  ny: 6,  nz: 4,  off: 224256, cnx: 32,  cny: 12, cnz: 8,  coff: 221184, omega: 1.45 }
      ];
      this.mgParamBufs = [];
      for (let lvl = 0; lvl < 4; lvl++) {
        const L = this.mgLevels[lvl];
        this.mgParamBufs[lvl] = [];
        for (let par = 0; par < 2; par++) {
          const buf = d.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
          const ab = new ArrayBuffer(48);
          const i32 = new Int32Array(ab);
          const f32 = new Float32Array(ab);
          i32[0] = L.nx; i32[1] = L.ny; i32[2] = L.nz; i32[3] = L.off;
          i32[4] = L.cnx; i32[5] = L.cny; i32[6] = L.cnz; i32[7] = L.coff;
          i32[8] = par;
          f32[9] = L.omega;
          d.queue.writeBuffer(buf, 0, ab);
          this.mgParamBufs[lvl][par] = buf;
        }
      }

      // Marching cubes buffers
      const triTableData = window.MCTables.TRI_TABLE;
      this.triTableBuf = d.createBuffer({ size: triTableData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      d.queue.writeBuffer(this.triTableBuf, 0, triTableData);

      this.mcVertsBuf = d.createBuffer({ size: MAX_MC_VERTS * 24, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX });
      this.mcDrawArgsBuf = d.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST });

      // Caustics buffers & texture
      this.causticAccumBuf = d.createBuffer({ size: 256 * 64 * 4, usage: GPUBufferUsage.STORAGE });
      this.causticTex = d.createTexture({
        size: [256, 64],
        format: 'rgba16float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      });
      this.causticView = this.causticTex.createView();

      this.tankMeshes = buildTankMeshes(d);
    }

    _makeStorageBGL(entries) {
      return this.device.createBindGroupLayout({
        entries: entries.map(([binding, type, extra]) => ({
          binding,
          visibility: GPUShaderStage.COMPUTE,
          ...(type === 'uniform' ? { buffer: { type: 'uniform' } } :
              type === 'storage' ? { buffer: { type: 'storage' } } :
              type === 'read-only-storage' ? { buffer: { type: 'read-only-storage' } } :
              { storageTexture: { access: 'write-only', format: extra } })
        }))
      });
    }

    _initComputePipelines() {
      const d = this.device;

      // 1. Clear Grid
      const clearBGL = this._makeStorageBGL([
        [0,'storage'],[1,'storage'],[2,'storage'],[3,'storage'],
        [4,'storage'],[5,'storage'],[6,'storage'],[7,'storage'],[8,'storage']
      ]);
      this.clearPipeline = d.createComputePipeline({
        layout: d.createPipelineLayout({ bindGroupLayouts: [clearBGL] }),
        compute: { module: d.createShaderModule({ code: TS.CLEAR_GRID_WGSL }), entryPoint: 'main' }
      });
      this.clearBG = d.createBindGroup({
        layout: clearBGL,
        entries: [
          { binding: 0, resource: { buffer: this.uAccumBuf } },
          { binding: 1, resource: { buffer: this.uWeightBuf } },
          { binding: 2, resource: { buffer: this.vAccumBuf } },
          { binding: 3, resource: { buffer: this.vWeightBuf } },
          { binding: 4, resource: { buffer: this.wAccumBuf } },
          { binding: 5, resource: { buffer: this.wWeightBuf } },
          { binding: 6, resource: { buffer: this.cellDensityAccumBuf } },
          { binding: 7, resource: { buffer: this.mgTypeBuf } },
          { binding: 8, resource: { buffer: this.mgPBuf } }
        ]
      });

      // 2. P2G Scatter
      const p2gBGL = this._makeStorageBGL([
        [0,'uniform'],[1,'read-only-storage'],[2,'storage'],[3,'storage'],
        [4,'storage'],[5,'storage'],[6,'storage'],[7,'storage'],[8,'storage']
      ]);
      this.p2gPipeline = d.createComputePipeline({
        layout: d.createPipelineLayout({ bindGroupLayouts: [p2gBGL] }),
        compute: { module: d.createShaderModule({ code: TS.P2G_SCATTER_WGSL }), entryPoint: 'main' }
      });
      this.p2gBG = d.createBindGroup({
        layout: p2gBGL,
        entries: [
          { binding: 0, resource: { buffer: this.simParamsBuf } },
          { binding: 1, resource: { buffer: this.particlesBuf } },
          { binding: 2, resource: { buffer: this.uAccumBuf } },
          { binding: 3, resource: { buffer: this.uWeightBuf } },
          { binding: 4, resource: { buffer: this.vAccumBuf } },
          { binding: 5, resource: { buffer: this.vWeightBuf } },
          { binding: 6, resource: { buffer: this.wAccumBuf } },
          { binding: 7, resource: { buffer: this.wWeightBuf } },
          { binding: 8, resource: { buffer: this.cellDensityAccumBuf } }
        ]
      });

      // 3. Grid Setup & Boundary Enforce
      const gridBGL = this._makeStorageBGL([
        [0,'uniform'],[1,'read-only-storage'],
        [2,'read-only-storage'],[3,'read-only-storage'],
        [4,'read-only-storage'],[5,'read-only-storage'],
        [6,'read-only-storage'],[7,'read-only-storage'],
        [8,'read-only-storage'],
        [9,'storage'],[10,'storage'],[11,'storage'],[12,'storage'],
        [13,'storage'],[14,'storage'],[15,'storage'],[16,'storage']
      ]);
      const gridLayout = d.createPipelineLayout({ bindGroupLayouts: [gridBGL] });
      const gridMod = d.createShaderModule({ code: TS.GRID_SETUP_WGSL });
      this.classifyPipeline = d.createComputePipeline({ layout: gridLayout, compute: { module: gridMod, entryPoint: 'classifyAndNormalize' } });
      this.enforcePipeline = d.createComputePipeline({ layout: gridLayout, compute: { module: gridMod, entryPoint: 'enforceBoundaries' } });
      this.gridSetupBG = d.createBindGroup({
        layout: gridBGL,
        entries: [
          { binding: 0, resource: { buffer: this.simParamsBuf } },
          { binding: 1, resource: { buffer: this.spheresBuf } },
          { binding: 2, resource: { buffer: this.uAccumBuf } },
          { binding: 3, resource: { buffer: this.uWeightBuf } },
          { binding: 4, resource: { buffer: this.vAccumBuf } },
          { binding: 5, resource: { buffer: this.vWeightBuf } },
          { binding: 6, resource: { buffer: this.wAccumBuf } },
          { binding: 7, resource: { buffer: this.wWeightBuf } },
          { binding: 8, resource: { buffer: this.cellDensityAccumBuf } },
          { binding: 9, resource: { buffer: this.uVelBuf } },
          { binding: 10, resource: { buffer: this.uOldBuf } },
          { binding: 11, resource: { buffer: this.vVelBuf } },
          { binding: 12, resource: { buffer: this.vOldBuf } },
          { binding: 13, resource: { buffer: this.wVelBuf } },
          { binding: 14, resource: { buffer: this.wOldBuf } },
          { binding: 15, resource: { buffer: this.mgTypeBuf } },
          { binding: 16, resource: { buffer: this.cellDensityBuf } }
        ]
      });

      // 4. Multigrid Pressure Solver
      const mgBGL = this._makeStorageBGL([
        [0,'uniform'],[1,'uniform'],
        [2,'storage'],[3,'storage'],[4,'storage'],
        [5,'read-only-storage'],
        [6,'storage'],[7,'storage'],[8,'storage'],[9,'storage']
      ]);
      const mgLayout = d.createPipelineLayout({ bindGroupLayouts: [mgBGL] });
      const mgMod = d.createShaderModule({ code: TS.PRESSURE_MG_WGSL });
      this.divPipeline = d.createComputePipeline({ layout: mgLayout, compute: { module: mgMod, entryPoint: 'computeDivergence' } });
      this.coarseTypePipeline = d.createComputePipeline({ layout: mgLayout, compute: { module: mgMod, entryPoint: 'buildCoarseType' } });
      this.smoothRBPipeline = d.createComputePipeline({ layout: mgLayout, compute: { module: mgMod, entryPoint: 'smoothRB' } });
      this.residualPipeline = d.createComputePipeline({ layout: mgLayout, compute: { module: mgMod, entryPoint: 'computeResidual' } });
      this.restrictPipeline = d.createComputePipeline({ layout: mgLayout, compute: { module: mgMod, entryPoint: 'restrictResidual' } });
      this.prolongatePipeline = d.createComputePipeline({ layout: mgLayout, compute: { module: mgMod, entryPoint: 'prolongate' } });
      this.applyPressurePipeline = d.createComputePipeline({ layout: mgLayout, compute: { module: mgMod, entryPoint: 'applyPressure' } });

      this.mgBGs = [];
      for (let lvl = 0; lvl < 4; lvl++) {
        this.mgBGs[lvl] = [];
        for (let par = 0; par < 2; par++) {
          this.mgBGs[lvl][par] = d.createBindGroup({
            layout: mgBGL,
            entries: [
              { binding: 0, resource: { buffer: this.simParamsBuf } },
              { binding: 1, resource: { buffer: this.mgParamBufs[lvl][par] } },
              { binding: 2, resource: { buffer: this.uVelBuf } },
              { binding: 3, resource: { buffer: this.vVelBuf } },
              { binding: 4, resource: { buffer: this.wVelBuf } },
              { binding: 5, resource: { buffer: this.cellDensityBuf } },
              { binding: 6, resource: { buffer: this.mgTypeBuf } },
              { binding: 7, resource: { buffer: this.mgPBuf } },
              { binding: 8, resource: { buffer: this.mgBBuf } },
              { binding: 9, resource: { buffer: this.mgRBuf } }
            ]
          });
        }
      }

      // 5. G2P Advect
      const g2pBGL = this._makeStorageBGL([
        [0,'uniform'],[1,'read-only-storage'],
        [2,'read-only-storage'],[3,'read-only-storage'],
        [4,'read-only-storage'],[5,'read-only-storage'],
        [6,'read-only-storage'],[7,'read-only-storage'],
        [8,'read-only-storage'],[9,'storage']
      ]);
      this.g2pPipeline = d.createComputePipeline({
        layout: d.createPipelineLayout({ bindGroupLayouts: [g2pBGL] }),
        compute: { module: d.createShaderModule({ code: TS.G2P_ADVECT_WGSL }), entryPoint: 'main' }
      });
      this.g2pBG = d.createBindGroup({
        layout: g2pBGL,
        entries: [
          { binding: 0, resource: { buffer: this.simParamsBuf } },
          { binding: 1, resource: { buffer: this.spheresBuf } },
          { binding: 2, resource: { buffer: this.uVelBuf } },
          { binding: 3, resource: { buffer: this.uOldBuf } },
          { binding: 4, resource: { buffer: this.vVelBuf } },
          { binding: 5, resource: { buffer: this.vOldBuf } },
          { binding: 6, resource: { buffer: this.wVelBuf } },
          { binding: 7, resource: { buffer: this.wOldBuf } },
          { binding: 8, resource: { buffer: this.cellDensityBuf } },
          { binding: 9, resource: { buffer: this.particlesBuf } }
        ]
      });

      // 6. Sphere Hydrodynamics & Collisions
      const spBGL = this._makeStorageBGL([
        [0,'uniform'],[1,'read-only-storage'],[2,'read-only-storage'],
        [3,'read-only-storage'],[4,'read-only-storage'],[5,'read-only-storage'],
        [6,'read-only-storage'],[7,'storage'],[8,'storage'],[9,'storage']
      ]);
      const spLayout = d.createPipelineLayout({ bindGroupLayouts: [spBGL] });
      const spMod = d.createShaderModule({ code: TS.SPHERE_PHYSICS_WGSL });
      this.sphereHydroPipeline = d.createComputePipeline({ layout: spLayout, compute: { module: spMod, entryPoint: 'integrateHydro' } });
      this.sphereColPipeline = d.createComputePipeline({ layout: spLayout, compute: { module: spMod, entryPoint: 'solveCollisionsAndSync' } });
      this.spherePhysBG = d.createBindGroup({
        layout: spBGL,
        entries: [
          { binding: 0, resource: { buffer: this.simParamsBuf } },
          { binding: 1, resource: { buffer: this.uVelBuf } },
          { binding: 2, resource: { buffer: this.vVelBuf } },
          { binding: 3, resource: { buffer: this.wVelBuf } },
          { binding: 4, resource: { buffer: this.cellDensityBuf } },
          { binding: 5, resource: { buffer: this.mgPBuf } },
          { binding: 6, resource: { buffer: this.mgTypeBuf } },
          { binding: 7, resource: { buffer: this.spheresBuf } },
          { binding: 8, resource: { buffer: this.renderSpheresBuf } },
          { binding: 9, resource: { buffer: this.statsBuf } }
        ]
      });

      // 7. Whitewater
      const wwBGL = this._makeStorageBGL([
        [0,'uniform'],[1,'read-only-storage'],[2,'read-only-storage'],
        [3,'read-only-storage'],[4,'read-only-storage'],[5,'read-only-storage'],
        [6,'read-only-storage'],[7,'storage'],[8,'storage'],[9,'storage']
      ]);
      const wwLayout = d.createPipelineLayout({ bindGroupLayouts: [wwBGL] });
      const wwMod = d.createShaderModule({ code: TS.WHITEWATER_WGSL });
      this.wwSpawnFluidPipeline = d.createComputePipeline({ layout: wwLayout, compute: { module: wwMod, entryPoint: 'spawnFromFluid' } });
      this.wwSpawnBubblePipeline = d.createComputePipeline({ layout: wwLayout, compute: { module: wwMod, entryPoint: 'spawnBubblesFromSpheres' } });
      this.wwUpdatePipeline = d.createComputePipeline({ layout: wwLayout, compute: { module: wwMod, entryPoint: 'updateWhitewater' } });
      this.wwBG = d.createBindGroup({
        layout: wwBGL,
        entries: [
          { binding: 0, resource: { buffer: this.simParamsBuf } },
          { binding: 1, resource: { buffer: this.particlesBuf } },
          { binding: 2, resource: { buffer: this.spheresBuf } },
          { binding: 3, resource: { buffer: this.uVelBuf } },
          { binding: 4, resource: { buffer: this.vVelBuf } },
          { binding: 5, resource: { buffer: this.wVelBuf } },
          { binding: 6, resource: { buffer: this.cellDensityBuf } },
          { binding: 7, resource: { buffer: this.whitewaterBuf } },
          { binding: 8, resource: { buffer: this.wwCursorBuf } },
          { binding: 9, resource: { buffer: this.statsBuf } }
        ]
      });

      // 8. Smooth Phi + Marching Cubes + Trace Caustics
      const mcBGL = this._makeStorageBGL([
        [0,'uniform'],[1,'read-only-storage'],[2,'read-only-storage'],
        [3,'storage'],[4,'read-only-storage'],[5,'storage'],[6,'storage'],[7,'storage'],[8,'read-only-storage']
      ]);
      const mcLayout = d.createPipelineLayout({ bindGroupLayouts: [mcBGL] });
      const mcMod = d.createShaderModule({ code: TS.SURFACE_MC_WGSL });
      this.smoothPhiPipeline = d.createComputePipeline({ layout: mcLayout, compute: { module: mcMod, entryPoint: 'buildSmoothPhi' } });
      this.resetMCPipeline = d.createComputePipeline({ layout: mcLayout, compute: { module: mcMod, entryPoint: 'resetMCArgs' } });
      this.mcPipeline = d.createComputePipeline({ layout: mcLayout, compute: { module: mcMod, entryPoint: 'marchingCubes' } });
      this.clearCausticsPipeline = d.createComputePipeline({ layout: mcLayout, compute: { module: mcMod, entryPoint: 'clearCaustics' } });
      this.traceCausticsPipeline = d.createComputePipeline({ layout: mcLayout, compute: { module: mcMod, entryPoint: 'traceCaustics' } });
      this.mcBG = d.createBindGroup({
        layout: mcBGL,
        entries: [
          { binding: 0, resource: { buffer: this.simParamsBuf } },
          { binding: 1, resource: { buffer: this.cellDensityBuf } },
          { binding: 2, resource: { buffer: this.mgTypeBuf } },
          { binding: 3, resource: { buffer: this.smoothPhiBuf } },
          { binding: 4, resource: { buffer: this.triTableBuf } },
          { binding: 5, resource: { buffer: this.mcVertsBuf } },
          { binding: 6, resource: { buffer: this.mcDrawArgsBuf } },
          { binding: 7, resource: { buffer: this.causticAccumBuf } },
          { binding: 8, resource: { buffer: this.spheresBuf } }
        ]
      });

      // 9. Resolve Caustics
      const rcBGL = this._makeStorageBGL([
        [0,'read-only-storage'],[1,'storage-tex','rgba16float']
      ]);
      this.resolveCausticsPipeline = d.createComputePipeline({
        layout: d.createPipelineLayout({ bindGroupLayouts: [rcBGL] }),
        compute: { module: d.createShaderModule({ code: TS.RESOLVE_CAUSTICS_WGSL }), entryPoint: 'main' }
      });
      this.resolveCausticsBG = d.createBindGroup({
        layout: rcBGL,
        entries: [
          { binding: 0, resource: { buffer: this.causticAccumBuf } },
          { binding: 1, resource: this.causticView }
        ]
      });
    }

    _initRenderPipelines() {
      const d = this.device;

      // Tank sphere bind group using tank's causticView and GPU-updated renderSpheresBuf
      this.tankSphereBG = this.gpu.createSphereBindGroup(this.causticView, this.renderSpheresBuf);
      this.tankSphereShadowBG = d.createBindGroup({
        layout: this.gpu.sphereShadowPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuf } },
          { binding: 3, resource: { buffer: this.renderSpheresBuf } }
        ]
      });

      // Opaque Tank (Reef + Wavemaker + Frame)
      const tankVLayout = [{
        arrayStride: 28,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' },
          { shaderLocation: 2, offset: 24, format: 'float32' }
        ]
      }];
      const opMod = d.createShaderModule({ code: TS.OPAQUE_TANK_WGSL });
      this.opaqueTankPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: opMod, entryPoint: 'vsOpaque', buffers: tankVLayout },
        fragment: { module: opMod, entryPoint: 'fsOpaque', targets: [{ format: 'rgba16float' }] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });
      this.opaqueTankShadowPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: opMod, entryPoint: 'vsOpaqueShadow', buffers: tankVLayout },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });
      this.opaqueTankBG = d.createBindGroup({
        layout: this.opaqueTankPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuf } },
          { binding: 1, resource: this.gpu.shadowView },
          { binding: 2, resource: this.gpu.shadowSampler },
          { binding: 3, resource: this.causticView },
          { binding: 4, resource: this.gpu.causticSampler },
          { binding: 5, resource: { buffer: this.extraVecBuf } }
        ]
      });
      this.opaqueTankShadowBG = d.createBindGroup({
        layout: this.opaqueTankShadowPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuf } },
          { binding: 5, resource: { buffer: this.extraVecBuf } }
        ]
      });

      // Water Thickness & Surface pipelines
      const mcVLayout = [{
        arrayStride: 24,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' }
        ]
      }];
      const wThickMod = d.createShaderModule({ code: TS.WATER_THICK_WGSL });
      this.waterThickPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: wThickMod, entryPoint: 'vs', buffers: mcVLayout },
        fragment: {
          module: wThickMod,
          entryPoint: 'fs',
          targets: [{
            format: 'rgba16float',
            blend: {
              color: { operation: 'add', srcFactor: 'one', dstFactor: 'one' },
              alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one' }
            }
          }]
        },
        primitive: { topology: 'triangle-list', cullMode: 'none' }
      });

      const wSurfMod = d.createShaderModule({ code: TS.WATER_SURF_WGSL });
      this.waterSurfPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: wSurfMod, entryPoint: 'vs', buffers: mcVLayout },
        fragment: { module: wSurfMod, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' }
      });

      // Whitewater & Droplets
      const wwMod = d.createShaderModule({ code: TS.WHITEWATER_RENDER_WGSL });
      const alphaBlend = {
        color: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
        alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }
      };
      this.wwRenderPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: wwMod, entryPoint: 'vs' },
        fragment: { module: wwMod, entryPoint: 'fs', targets: [{ format: 'rgba16float', blend: alphaBlend }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'less' }
      });
      this.wwRenderBG = d.createBindGroup({
        layout: this.wwRenderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuf } },
          { binding: 1, resource: { buffer: this.whitewaterBuf } }
        ]
      });

      const drMod = d.createShaderModule({ code: TS.DROPLET_RENDER_WGSL });
      this.dropletRenderPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: drMod, entryPoint: 'vs' },
        fragment: { module: drMod, entryPoint: 'fs', targets: [{ format: 'rgba16float', blend: alphaBlend }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'less' }
      });
      this.dropletRenderBG = d.createBindGroup({
        layout: this.dropletRenderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuf } },
          { binding: 1, resource: { buffer: this.particlesBuf } }
        ]
      });

      // Glass Tank Walls
      const glMod = d.createShaderModule({ code: TS.GLASS_TANK_WGSL });
      this.glassPipeline = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module: glMod, entryPoint: 'vs', buffers: tankVLayout },
        fragment: { module: glMod, entryPoint: 'fs', targets: [{ format: 'rgba16float', blend: alphaBlend }] },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'less' }
      });
      this.glassBG = d.createBindGroup({
        layout: this.glassPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this.gpu.frameUniformBuf } }]
      });

      this.waterThickTex = null;
      this._rebuildSizeDependentBindGroups();
    }

    _rebuildSizeDependentBindGroups() {
      const d = this.device;
      const w = this.gpu.width, h = this.gpu.height;
      if (this.waterThickTex && this.waterThickTex.width === w && this.waterThickTex.height === h) return;

      if (this.waterThickTex) this.waterThickTex.destroy();
      this.waterThickTex = d.createTexture({
        size: [w, h],
        format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });
      this.waterThickView = this.waterThickTex.createView();

      this.waterThickBG = d.createBindGroup({
        layout: this.waterThickPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuf } },
          { binding: 1, resource: this.gpu.opaqueDepthView }
        ]
      });

      this.waterSurfBG = d.createBindGroup({
        layout: this.waterSurfPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.gpu.frameUniformBuf } },
          { binding: 1, resource: this.gpu.opaqueDepthView },
          { binding: 2, resource: this.gpu.opaqueColorView },
          { binding: 3, resource: this.waterThickView },
          { binding: 4, resource: this.gpu.linearSampler },
          { binding: 5, resource: this.gpu.shadowView },
          { binding: 6, resource: this.gpu.shadowSampler }
        ]
      });
    }

    setParam(key, val) {
      if (key === 'waveAmp') this.params.waveAmp = val;
      else if (key === 'waveFreq') this.params.waveFreq = val;
      else if (key === 'waveEnabled') this.params.waveEnabled = !!val;
      else if (key.startsWith('density')) {
        const idx = parseInt(key.replace('density', ''), 10);
        if (idx >= 0 && idx < 4) {
          this.params.densities[idx] = val;
          this._updateSphereDensitiesOnly();
        }
      }
    }

    _updateSphereDensitiesOnly() {
      // Update density field of existing GPU spheres cleanly
      if (!this.sphereMeta.length) return;
      const d = this.device;
      const tmp = new Float32Array(1);
      for (let i = 0; i < this.numSpheres; i++) {
        const g = this.sphereMeta[i].group;
        const rho = this.params.densities[g];
        const R = this.sphereMeta[i].radius;
        const vol = (4 / 3) * Math.PI * R * R * R;
        // Write velDensity.w at offset +28 bytes, and angVelMass.w at offset +44 bytes
        tmp[0] = rho;
        d.queue.writeBuffer(this.spheresBuf, i * 96 + 28, tmp);
        tmp[0] = rho * vol;
        d.queue.writeBuffer(this.spheresBuf, i * 96 + 44, tmp);
      }
    }

    resetScene(preset = 'default') {
      this.time = 0;
      this.wavePhase = 0;
      this.waveEnvelope = 0;
      this.paddleX = 0.22;
      this.paddleVel = 0;
      this.params.waveEnabled = false;
      this.gpu._stageTag = 'tank';
      this.gpu.setStageTransform([3.4, 0.14, 1.35], [2.8, -0.14, 0.70], 2.5);

      const rng = M.mulberry32(202611);
      const pArr = new Float32Array(MAX_PARTICLES * 20); // 80 bytes / 4 = 20 floats
      let pCount = 0;

      // Seed 2x2x2 jittered particles per fluid cell inside calm basin (y <= 0.90m)
      const waterTop = 0.90;
      for (let k = 1; k < NZ - 1; k++) {
        for (let j = 1; j < NY - 1; j++) {
          const cyBase = j * H;
          if (cyBase >= waterTop) continue;
          for (let i = 5; i < NX - 1; i++) {
            const cxBase = i * H;
            const czBase = k * H;
            if (cxBase < this.paddleX + 0.015) continue;
            const th = terrainHeightJS(cxBase + 0.5 * H, czBase + 0.5 * H);
            for (let sz = 0; sz < 2; sz++) {
              for (let sy = 0; sy < 2; sy++) {
                for (let sx = 0; sx < 2; sx++) {
                  if (pCount >= MAX_PARTICLES) break;
                  const px = cxBase + (sx + 0.25 + 0.5 * rng()) * 0.5 * H;
                  const py = cyBase + (sy + 0.25 + 0.5 * rng()) * 0.5 * H;
                  const pz = czBase + (sz + 0.25 + 0.5 * rng()) * 0.5 * H;
                  if (py <= th + 0.01 || py >= waterTop) continue;
                  const o = pCount * 20;
                  pArr[o + 0] = px;
                  pArr[o + 1] = py;
                  pArr[o + 2] = pz;
                  pArr[o + 3] = 1.0; // density
                  pCount++;
                }
              }
            }
          }
        }
      }
      this.numParticles = pCount;
      this.device.queue.writeBuffer(this.particlesBuf, 0, pArr.subarray(0, pCount * 20));

      // Clear whitewater
      const deadWW = new Float32Array(MAX_WHITEWATER * 8);
      for (let i = 0; i < MAX_WHITEWATER; i++) deadWW[i * 8 + 7] = -1;
      this.device.queue.writeBuffer(this.whitewaterBuf, 0, deadWW);
      this.device.queue.writeBuffer(this.wwCursorBuf, 0, new Uint32Array([0]));

      // Spawn 32 spheres (4 groups x 8 spheres) above water surface ready to drop!
      this.releaseSpheres(preset);

      // Run 1 calm surface extraction step so initial frame 0 has full water mesh & caustics ready!
      this._runInitialSurfacePrep();
    }

    releaseSpheres(preset = 'default') {
      const rng = M.mulberry32(77331 + Math.floor(this.time * 10));
      const R = 0.095;
      const vol = (4 / 3) * Math.PI * R * R * R;
      this.numSpheres = 32;
      this.sphereMeta = [];

      const sBuf = new Float32Array(MAX_SPHERES * 24); // 96 bytes = 24 floats
      const rBuf = new Float32Array(MAX_SPHERES * 16);

      for (let i = 0; i < this.numSpheres; i++) {
        // Interleave groups across X and Z so all 4 colors mingle visibly!
        const group = i % 4;
        const rho = this.params.densities[group];
        const col = this.groupColors[group];

        const colIdx = Math.floor(i / 4); // 0..7
        // Position across drop zone x in [0.95, 3.85], z in [0.22, 1.18]
        const x = 0.92 + colIdx * 0.42 + (rng() - 0.5) * 0.14;
        const z = 0.24 + ((group + (colIdx & 1) * 0.5) / 4.2) * 0.94 + (rng() - 0.5) * 0.10;
        // Stagger drop heights and downward impulse so entry craters & splash crowns stand out sharply!
        const baseDropY = preset === 'tank-full' ? 1.32 : 1.42;
        const y = baseDropY + (group * 0.14) + (colIdx % 3) * 0.14 + rng() * 0.10;
        const vy = preset === 'tank-full' ? -2.35 - group * 0.55 : -0.60 - group * 0.25;

        const so = i * 24;
        sBuf[so + 0] = x; sBuf[so + 1] = y; sBuf[so + 2] = M.clamp(z, 0.20, TANK_Z - 0.20); sBuf[so + 3] = R;
        sBuf[so + 4] = (rng() - 0.5) * 0.25; sBuf[so + 5] = vy; sBuf[so + 6] = (rng() - 0.5) * 0.25; sBuf[so + 7] = rho;
        sBuf[so + 8] = 0; sBuf[so + 9] = 0; sBuf[so + 10] = 0; sBuf[so + 11] = rho * vol;
        sBuf[so + 12] = 0; sBuf[so + 13] = 0; sBuf[so + 14] = 0; sBuf[so + 15] = 1;
        sBuf[so + 16] = col[0]; sBuf[so + 17] = col[1]; sBuf[so + 18] = col[2]; sBuf[so + 19] = group;
        sBuf[so + 20] = 0; sBuf[so + 21] = 0;

        const ro = i * 16;
        rBuf[ro + 0] = sBuf[so + 0]; rBuf[ro + 1] = sBuf[so + 1]; rBuf[ro + 2] = sBuf[so + 2]; rBuf[ro + 3] = R;
        rBuf[ro + 4] = col[0]; rBuf[ro + 5] = col[1]; rBuf[ro + 6] = col[2]; rBuf[ro + 7] = 3.0;
        rBuf[ro + 8] = 0; rBuf[ro + 9] = 0; rBuf[ro + 10] = 0; rBuf[ro + 11] = 1;
        rBuf[ro + 12] = 0.18; rBuf[ro + 13] = 0.08; rBuf[ro + 14] = 1.0;

        this.sphereMeta.push({ group, radius: R });
      }
      this.device.queue.writeBuffer(this.spheresBuf, 0, sBuf);
      this.device.queue.writeBuffer(this.renderSpheresBuf, 0, rBuf);
    }

    _writeSimUniforms(dt) {
      const ab = new ArrayBuffer(64);
      const f32 = new Float32Array(ab);
      const u32 = new Uint32Array(ab);
      f32[0] = dt;
      f32[1] = 9.81;
      f32[2] = this.paddleX;
      f32[3] = this.paddleVel;
      f32[4] = 0.90; // flipRatio: 90% FLIP + 10% APIC
      u32[5] = this.numParticles;
      u32[6] = this.numSpheres;
      u32[7] = MAX_WHITEWATER;
      f32[8] = this.time;
      f32[9] = this.params.waveAmp;
      f32[10] = this.params.waveFreq;
      f32[11] = 8.0; // restDensity (2x2x2 particles per cell)
      this.device.queue.writeBuffer(this.simParamsBuf, 0, ab);
      this.device.queue.writeBuffer(this.extraVecBuf, 0, new Float32Array([this.paddleX, this.paddleVel, this.estimatedWaterLevel, 0]));
    }

    _runInitialSurfacePrep() {
      this._writeSimUniforms(1 / 120);
      const enc = this.device.createCommandEncoder();
      const pass = enc.beginComputePass();
      this._encodeGridClearAndP2G(pass);
      pass.setPipeline(this.classifyPipeline);
      pass.setBindGroup(0, this.gridSetupBG);
      pass.dispatchWorkgroups(Math.ceil((NX * (NY + 1) * (NZ + 1)) / 256));
      this._encodeSurfaceAndCaustics(pass);
      pass.end();
      this.device.queue.submit([enc.finish()]);
    }

    _encodeGridClearAndP2G(pass) {
      const maxFaces = (NX + 1) * (NY + 1) * (NZ + 1);
      pass.setPipeline(this.clearPipeline);
      pass.setBindGroup(0, this.clearBG);
      pass.dispatchWorkgroups(Math.ceil(maxFaces / 256));

      pass.setPipeline(this.p2gPipeline);
      pass.setBindGroup(0, this.p2gBG);
      pass.dispatchWorkgroups(Math.ceil(this.numParticles / 256));
    }

    _encodeSurfaceAndCaustics(pass) {
      const nCells = NX * NY * NZ;
      pass.setPipeline(this.smoothPhiPipeline);
      pass.setBindGroup(0, this.mcBG);
      pass.dispatchWorkgroups(Math.ceil(nCells / 256));

      pass.setPipeline(this.resetMCPipeline);
      pass.setBindGroup(0, this.mcBG);
      pass.dispatchWorkgroups(1);

      pass.setPipeline(this.mcPipeline);
      pass.setBindGroup(0, this.mcBG);
      pass.dispatchWorkgroups(Math.ceil((NX - 1) / 8), Math.ceil((NY - 1) / 8), Math.ceil((NZ - 1) / 4));

      pass.setPipeline(this.clearCausticsPipeline);
      pass.setBindGroup(0, this.mcBG);
      pass.dispatchWorkgroups(Math.ceil((256 * 64) / 256));

      pass.setPipeline(this.traceCausticsPipeline);
      pass.setBindGroup(0, this.mcBG);
      pass.dispatchWorkgroups(256 / 16, 64 / 8);

      pass.setPipeline(this.resolveCausticsPipeline);
      pass.setBindGroup(0, this.resolveCausticsBG);
      pass.dispatchWorkgroups(256 / 16, 64 / 8);
    }

    step(dt) {
      // Clear audio event counters once per step
      this.device.queue.writeBuffer(this.statsBuf, 0, new Uint32Array([0, 0, 0, 0]));

      // Smoothly ramp wavemaker envelope on/off
      const targetEnv = this.params.waveEnabled ? 1.0 : 0.0;
      this.waveEnvelope += (targetEnv - this.waveEnvelope) * Math.min(1.0, dt * 2.2);

      const substeps = 2;
      const subDt = dt / substeps;
      const wgGrid = Math.ceil(((NX + 1) * (NY + 1) * (NZ + 1)) / 256);
      const wgCells = Math.ceil((NX * NY * NZ) / 256);
      const wgParts = Math.ceil(this.numParticles / 256);
      const wgWW = Math.ceil(MAX_WHITEWATER / 256);

      for (let s = 0; s < substeps; s++) {
        // Update wavemaker kinematics
        const prevPaddle = this.paddleX;
        if (this.waveEnvelope > 0.002) {
          this.wavePhase += 2.0 * Math.PI * this.params.waveFreq * subDt;
        }
        const amp = this.params.waveAmp * this.waveEnvelope;
        const targetPaddle = 0.22 + amp * (1.0 - Math.cos(this.wavePhase)) * 0.92;
        this.paddleVel = (targetPaddle - prevPaddle) / subDt;
        this.paddleX = targetPaddle;
        this.time += subDt;

        this._writeSimUniforms(subDt);

        const enc = this.device.createCommandEncoder();
        const pass = enc.beginComputePass();

        // 1. Clear + P2G + Classify + Gravity + Enforce Boundaries
        this._encodeGridClearAndP2G(pass);

        pass.setPipeline(this.classifyPipeline);
        pass.setBindGroup(0, this.gridSetupBG);
        pass.dispatchWorkgroups(wgGrid);

        pass.setPipeline(this.enforcePipeline);
        pass.setBindGroup(0, this.gridSetupBG);
        pass.dispatchWorkgroups(wgGrid);

        // 2. Compute Divergence + Build Coarse MG Types
        pass.setPipeline(this.divPipeline);
        pass.setBindGroup(0, this.mgBGs[0][0]);
        pass.dispatchWorkgroups(wgCells);

        for (let lvl = 1; lvl < 4; lvl++) {
          const L = this.mgLevels[lvl];
          pass.setPipeline(this.coarseTypePipeline);
          pass.setBindGroup(0, this.mgBGs[lvl][0]);
          pass.dispatchWorkgroups(Math.ceil((L.nx * L.ny * L.nz) / 256));
        }

        // 3. 3 Geometric Multigrid V-Cycles for accurate hydrostatic balance
        for (let vc = 0; vc < 3; vc++) {
          // Downward sweep: smooth -> residual -> restrict
          const downSweeps = [3, 4, 6];
          for (let lvl = 0; lvl < 3; lvl++) {
            const L = this.mgLevels[lvl];
            const wg = Math.ceil((L.nx * L.ny * L.nz) / 256);
            pass.setPipeline(this.smoothRBPipeline);
            for (let it = 0; it < downSweeps[lvl]; it++) {
              pass.setBindGroup(0, this.mgBGs[lvl][0]); pass.dispatchWorkgroups(wg);
              pass.setBindGroup(0, this.mgBGs[lvl][1]); pass.dispatchWorkgroups(wg);
            }
            pass.setPipeline(this.residualPipeline);
            pass.setBindGroup(0, this.mgBGs[lvl][0]);
            pass.dispatchWorkgroups(wg);

            const NL = this.mgLevels[lvl + 1];
            pass.setPipeline(this.restrictPipeline);
            pass.setBindGroup(0, this.mgBGs[lvl + 1][0]);
            pass.dispatchWorkgroups(Math.ceil((NL.nx * NL.ny * NL.nz) / 256));
          }

          // Coarsest level solve (12 RB passes)
          {
            const L = this.mgLevels[3];
            const wg = Math.ceil((L.nx * L.ny * L.nz) / 256);
            pass.setPipeline(this.smoothRBPipeline);
            for (let it = 0; it < 12; it++) {
              pass.setBindGroup(0, this.mgBGs[3][0]); pass.dispatchWorkgroups(wg);
              pass.setBindGroup(0, this.mgBGs[3][1]); pass.dispatchWorkgroups(wg);
            }
          }

          // Upward sweep: prolongate -> post-smooth
          const upSweeps = [4, 4, 5];
          for (let lvl = 2; lvl >= 0; lvl--) {
            const CL = this.mgLevels[lvl];
            const wgC = Math.ceil((CL.nx * CL.ny * CL.nz) / 256);
            pass.setPipeline(this.prolongatePipeline);
            pass.setBindGroup(0, this.mgBGs[lvl + 1][0]);
            pass.dispatchWorkgroups(wgC);

            pass.setPipeline(this.smoothRBPipeline);
            for (let it = 0; it < upSweeps[lvl]; it++) {
              pass.setBindGroup(0, this.mgBGs[lvl][0]); pass.dispatchWorkgroups(wgC);
              pass.setBindGroup(0, this.mgBGs[lvl][1]); pass.dispatchWorkgroups(wgC);
            }
          }
        }

        // 4. Apply Pressure & Re-enforce Solid Boundaries
        pass.setPipeline(this.applyPressurePipeline);
        pass.setBindGroup(0, this.mgBGs[0][0]);
        pass.dispatchWorkgroups(wgGrid);

        pass.setPipeline(this.enforcePipeline);
        pass.setBindGroup(0, this.gridSetupBG);
        pass.dispatchWorkgroups(wgGrid);

        // 5. G2P Advect Particles
        pass.setPipeline(this.g2pPipeline);
        pass.setBindGroup(0, this.g2pBG);
        pass.dispatchWorkgroups(wgParts);

        // 6. Two-Way Sphere Hydrodynamics & Collisions
        pass.setPipeline(this.sphereHydroPipeline);
        pass.setBindGroup(0, this.spherePhysBG);
        pass.dispatchWorkgroups(1);

        pass.setPipeline(this.sphereColPipeline);
        pass.setBindGroup(0, this.spherePhysBG);
        pass.dispatchWorkgroups(1);

        // 7. Whitewater Spawn & Update
        pass.setPipeline(this.wwSpawnFluidPipeline);
        pass.setBindGroup(0, this.wwBG);
        pass.dispatchWorkgroups(wgParts);

        pass.setPipeline(this.wwSpawnBubblePipeline);
        pass.setBindGroup(0, this.wwBG);
        pass.dispatchWorkgroups(1);

        pass.setPipeline(this.wwUpdatePipeline);
        pass.setBindGroup(0, this.wwBG);
        pass.dispatchWorkgroups(wgWW);

        // On last substep, extract Marching Cubes Water Mesh + Caustics!
        if (s === substeps - 1) {
          this._encodeSurfaceAndCaustics(pass);
        }

        pass.end();
        this.device.queue.submit([enc.finish()]);
      }

      // Non-blocking async stats poll for procedural splash & surf audio
      this._pollAudioStats();
    }

    _pollAudioStats() {
      if (this._statsMapping || window.AppAudio.suppressed) return;
      this._statsMapping = true;
      const enc = this.device.createCommandEncoder();
      enc.copyBufferToBuffer(this.statsBuf, 0, this.statsReadBuf, 0, 16);
      this.device.queue.submit([enc.finish()]);

      this.statsReadBuf.mapAsync(GPUMapMode.READ).then(() => {
        const arr = new Uint32Array(this.statsReadBuf.getMappedRange());
        const splashCount = arr[0];
        const maxSplashSpeed = arr[1] / 1000.0;
        const foamCount = arr[2];
        this.statsReadBuf.unmap();
        this._statsMapping = false;

        if (splashCount > 0) {
          window.AppAudio.playWaterSplash(M.clamp(maxSplashSpeed * 0.22 + splashCount * 0.06, 0.18, 0.95));
        }
        const waveEnergy = Math.abs(this.paddleVel) * 0.65 + this.waveEnvelope * this.params.waveAmp * 1.8;
        const foamNorm = M.clamp(foamCount / 6500.0, 0.0, 1.0);
        this.lastWaveEnergy = waveEnergy;
        this.lastFoamCount = foamCount;
        window.AppAudio.updateSurf(waveEnergy, foamNorm);
      }).catch(() => {
        this._statsMapping = false;
      });
    }

    render(encoder, cam) {
      if (this.gpu._stageTag !== 'tank') {
        this.gpu._stageTag = 'tank';
        this.gpu.setStageTransform([3.4, 0.14, 1.35], [2.8, -0.14, 0.70], 2.5);
      }
      this._rebuildSizeDependentBindGroups();
      this.gpu.updateFrameUniforms(cam, [2.8, 0.45, 0.70], 4.2, this.time, [1.08, this.estimatedWaterLevel, 1.0, 0.48]);
      this.device.queue.writeBuffer(this.extraVecBuf, 0, new Float32Array([this.paddleX, this.paddleVel, this.estimatedWaterLevel, 0]));

      // 1. Shadow Pass (Stage + Reef/Paddle/Frame + Tank Spheres)
      {
        const sPass = encoder.beginRenderPass({
          colorAttachments: [],
          depthStencilAttachment: {
            view: this.gpu.shadowView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });
        sPass.setPipeline(this.gpu.stageShadowPipeline);
        sPass.setBindGroup(0, this.gpu.stageShadowBG);
        sPass.setVertexBuffer(0, this.gpu.boxGeom.vertexBuffer);
        sPass.draw(this.gpu.boxGeom.vertexCount);

        sPass.setPipeline(this.opaqueTankShadowPipeline);
        sPass.setBindGroup(0, this.opaqueTankShadowBG);
        sPass.setVertexBuffer(0, this.tankMeshes.opaqueBuf);
        sPass.draw(this.tankMeshes.opaqueVertCount);

        sPass.setPipeline(this.gpu.sphereShadowPipeline);
        sPass.setBindGroup(0, this.tankSphereShadowBG);
        sPass.setVertexBuffer(0, this.gpu.sphereGeom.vertexBuffer);
        sPass.setIndexBuffer(this.gpu.sphereGeom.indexBuffer, 'uint16');
        sPass.drawIndexed(this.gpu.sphereGeom.indexCount, this.numSpheres);
        sPass.end();
      }

      // 2. Opaque Scene Pass -> opaqueColorTex + opaqueDepthTex
      {
        const oPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this.gpu.opaqueColorView,
            clearValue: { r: 0.08, g: 0.1, b: 0.13, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
          }],
          depthStencilAttachment: {
            view: this.gpu.opaqueDepthView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });
        oPass.setPipeline(this.gpu.backdropPipeline);
        oPass.setBindGroup(0, this.gpu.backdropBG);
        oPass.draw(3);

        oPass.setPipeline(this.gpu.stagePipeline);
        oPass.setBindGroup(0, this.gpu.stageBG);
        oPass.setVertexBuffer(0, this.gpu.boxGeom.vertexBuffer);
        oPass.draw(this.gpu.boxGeom.vertexCount);

        oPass.setPipeline(this.opaqueTankPipeline);
        oPass.setBindGroup(0, this.opaqueTankBG);
        oPass.setVertexBuffer(0, this.tankMeshes.opaqueBuf);
        oPass.draw(this.tankMeshes.opaqueVertCount);

        oPass.setPipeline(this.gpu.spherePipeline);
        oPass.setBindGroup(0, this.tankSphereBG);
        oPass.setVertexBuffer(0, this.gpu.sphereGeom.vertexBuffer);
        oPass.setIndexBuffer(this.gpu.sphereGeom.indexBuffer, 'uint16');
        oPass.drawIndexed(this.gpu.sphereGeom.indexCount, this.numSpheres);
        oPass.end();
      }

      encoder.copyTextureToTexture(
        { texture: this.gpu.opaqueColorTex },
        { texture: this.gpu.hdrColorTex },
        [this.gpu.width, this.gpu.height]
      );
      encoder.copyTextureToTexture(
        { texture: this.gpu.opaqueDepthTex },
        { texture: this.gpu.sceneDepthTex },
        [this.gpu.width, this.gpu.height]
      );

      // 3. Water Optical Thickness Parity Pass
      {
        const tPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this.waterThickView,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store'
          }]
        });
        tPass.setPipeline(this.waterThickPipeline);
        tPass.setBindGroup(0, this.waterThickBG);
        tPass.setVertexBuffer(0, this.mcVertsBuf);
        tPass.drawIndirect(this.mcDrawArgsBuf, 0);
        tPass.end();
      }

      // 4. Water Surface Refraction + Whitewater + Detached Droplets + Bevelled Glass Tank
      {
        const wPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this.gpu.hdrColorView,
            loadOp: 'load',
            storeOp: 'store'
          }],
          depthStencilAttachment: {
            view: this.gpu.sceneDepthView,
            depthLoadOp: 'load',
            depthStoreOp: 'store'
          }
        });
        wPass.setPipeline(this.waterSurfPipeline);
        wPass.setBindGroup(0, this.waterSurfBG);
        wPass.setVertexBuffer(0, this.mcVertsBuf);
        wPass.drawIndirect(this.mcDrawArgsBuf, 0);

        wPass.setPipeline(this.dropletRenderPipeline);
        wPass.setBindGroup(0, this.dropletRenderBG);
        wPass.draw(6, this.numParticles);

        wPass.setPipeline(this.wwRenderPipeline);
        wPass.setBindGroup(0, this.wwRenderBG);
        wPass.draw(6, MAX_WHITEWATER);

        wPass.setPipeline(this.glassPipeline);
        wPass.setBindGroup(0, this.glassBG);
        wPass.setVertexBuffer(0, this.tankMeshes.glassBuf);
        wPass.draw(this.tankMeshes.glassVertCount);
        wPass.end();
      }

      // 5. ACES Tonemap -> Swapchain
      this.gpu.renderToneMap(encoder);
    }
  }

  return { SceneTank };
})();
