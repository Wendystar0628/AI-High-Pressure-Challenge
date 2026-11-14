// ============================================================================
// 09_renderer_main.js
// WebGL 2 Real-Time Renderer, HDR MSAA + Multi-Mip Bloom Pipeline,
// Dynamic Scene Evaluation & Deterministic window.videoExport Interface.
// ============================================================================
(function (global) {
  'use strict';

  const SF = (global.StarFleet = global.StarFleet || {});
  const { clamp, saturate, lerp, smoothstep, smootherstep, V3, M4, evalCatmullRom3, evalCatmullRomTangent3, evalTimedSpline3, hash1 } = SF.Math;
  const Shaders = SF.Shaders;

  // --- WebGL2 Shader Compilation Helpers ---
  function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('Shader compile error:\n' + log);
    }
    return sh;
  }

  function createProgram(gl, vsSrc, fsSrc) {
    const prog = gl.createProgram();
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error('Program link error:\n' + log);
    }
    const uniforms = {};
    const nU = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nU; i++) {
      const info = gl.getActiveUniform(prog, i);
      const baseName = info.name.replace(/\[0\]$/, '');
      uniforms[baseName] = gl.getUniformLocation(prog, baseName);
    }
    return { prog, u: uniforms };
  }

  // --- Upload Greedy-Meshed Voxel Pair (Opaque + Translucent) ---
  function uploadVoxelMeshPair(gl, pair) {
    function makeSub(md) {
      if (!md || md.indexCount === 0) return null;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, md.vertexBuffer, gl.STATIC_DRAW);

      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);

      gl.enableVertexAttribArray(1);
      gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_INT, 16, 12);

      const ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, md.indices, gl.STATIC_DRAW);

      gl.bindVertexArray(null);
      return { vao, vbo, ibo, count: md.indexCount };
    }
    return {
      opaque: makeSub(pair.opaque),
      translucent: makeSub(pair.translucent),
      bounds: pair.bounds
    };
  }

  // --- Create 3-Fin Volumetric Thruster Plume Mesh ---
  function createPlumeGeometry(gl) {
    const verts = [];
    const idx = [];
    const slices = 16;
    const angles = [0, Math.PI / 3, (2 * Math.PI) / 3];
    for (let a = 0; a < angles.length; a++) {
      const ang = angles[a];
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const baseV = (verts.length / 3);
      for (let i = 0; i <= slices; i++) {
        const t = i / slices;
        // Pack local x, y=t, z along rotated fin! Wait: PLUME_VS uses a_pos.x as fin u [-1..1] for UV AND position!
        // Let's keep 2 crossed fins via model rotation in JS or encode actual 3D offset cleanly:
        // Wait: in PLUME_VS: wp = u_model * vec4(a_pos.x, a_pos.z, -a_pos.y, 1.0), v_uv = vec2(a_pos.x, a_pos.y).
        // Let's draw 2 orthogonal fins (horizontal + vertical) or rotate u_model! Two draw calls or 1 horizontal + 1 vertical via model roll!
        // Even faster: let's add a_uv attribute to Plume or draw 2 rolled passes (`roll=0` and `roll=PI/2`)!
        // Actually 2 passes (`roll=0`, `roll=PI/2`) on a 32-triangle strip is tiny—let's check: 37 ships * 2.5 thrusters * 2 = 185 tiny strips (< 0.05ms)!
        verts.push(-1, t, 0,  1, t, 0);
      }
      for (let i = 0; i < slices; i++) {
        const v0 = baseV + i * 2;
        idx.push(v0, v0 + 1, v0 + 3, v0, v0 + 3, v0 + 2);
      }
      break; // Single clean subdivided blade; drawn crossed at 0 and 90 deg roll so v_uv.x is exact [-1..+1] on both fins!
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: idx.length };
  }

  // --- Create Conformal Sculpted Fleet Shield Envelope Mesh ---
  // Echoes the fleet's Twin-Tine Prow & Cantilevered Wing silhouette!
  function createShieldGeometry(gl) {
    const segU = 48, segV = 32;
    const verts = []; // [px, py, pz, nx, ny, nz]
    const idx = [];

    function sculptPoint(out, th, ph) {
      // ph in [0..PI] from +Z (bow, ph=0) to -Z (stern, ph=PI)
      const z = Math.cos(ph);
      const rRing = Math.sin(ph);
      let x = Math.cos(th) * rRing;
      let y = Math.sin(th) * rRing;

      // Flatten top/bottom slightly and flare cantilevered lateral wings!
      const wingFlare = 1.0 + 0.24 * Math.pow(Math.abs(Math.cos(th)), 3.0) * smoothstep(-0.7, 0.2, z);
      x *= wingFlare;
      y *= 0.86;

      // Subtle twin-tine prow sculpting near +Z bow!
      const bowPinch = smoothstep(0.45, 0.98, z) * (1.0 - 0.16 * Math.exp(-x * x * 12.0));
      const zOut = z + 0.05 * bowPinch * Math.abs(x);

      out[0] = x;
      out[1] = y;
      out[2] = zOut;
    }

    const p = [0, 0, 0], px1 = [0, 0, 0], py1 = [0, 0, 0], d1 = [0, 0, 0], d2 = [0, 0, 0], n = [0, 0, 0];
    const eps = 0.01;
    for (let iv = 0; iv <= segV; iv++) {
      const ph = (iv / segV) * Math.PI;
      for (let iu = 0; iu <= segU; iu++) {
        const th = (iu / segU) * Math.PI * 2.0;
        sculptPoint(p, th, ph);
        sculptPoint(px1, th + eps, clamp(ph, 0.02, Math.PI - 0.02));
        sculptPoint(py1, th, clamp(ph + eps, 0.02, Math.PI - 0.01));
        V3.sub(d1, px1, p);
        V3.sub(d2, py1, p);
        V3.cross(n, d2, d1);
        if (V3.len(n) < 1e-6) {
          V3.normalize(n, p);
        } else {
          V3.normalize(n, n);
          if (V3.dot(n, p) < 0) V3.scale(n, n, -1);
        }
        verts.push(p[0], p[1], p[2], n[0], n[1], n[2]);
      }
    }

    const row = segU + 1;
    for (let iv = 0; iv < segV; iv++) {
      for (let iu = 0; iu < segU; iu++) {
        const a = iv * row + iu;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: idx.length };
  }

  // --- Streaming Camera-Billboarded Ribbon Batcher ---
  class RibbonBatcher {
    constructor(gl, maxVerts = 24576) {
      this.gl = gl;
      this.data = new Float32Array(maxVerts * 10); // [p0x,p0y,p0z, p1x,p1y,p1z, u,side,halfW,style]
      this.indices = new Uint16Array((maxVerts / 2) * 6);
      this.vCount = 0;
      this.iCount = 0;

      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      this.vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);

      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);

      this.ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices.byteLength, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(null);
    }

    reset() {
      this.vCount = 0;
      this.iCount = 0;
    }

    // Add a polyline ribbon of N >= 2 points: pts = [[x,y,z, u, halfW, style], ...]
    addChain(pts) {
      const n = pts.length;
      if (n < 2 || this.vCount + n * 2 > 24000) return;
      const baseV = this.vCount;
      let o = baseV * 10;
      for (let i = 0; i < n; i++) {
        const cur = pts[i];
        const nxt = i < n - 1 ? pts[i + 1] : [
          cur[0] + (cur[0] - pts[i - 1][0]),
          cur[1] + (cur[1] - pts[i - 1][1]),
          cur[2] + (cur[2] - pts[i - 1][2])
        ];
        for (let side = -1; side <= 1; side += 2) {
          this.data[o + 0] = cur[0]; this.data[o + 1] = cur[1]; this.data[o + 2] = cur[2];
          this.data[o + 3] = nxt[0]; this.data[o + 4] = nxt[1]; this.data[o + 5] = nxt[2];
          this.data[o + 6] = cur[3]; this.data[o + 7] = side;   this.data[o + 8] = cur[4]; this.data[o + 9] = cur[5];
          o += 10;
        }
      }
      this.vCount += n * 2;
      let ic = this.iCount;
      for (let i = 0; i < n - 1; i++) {
        const v0 = baseV + i * 2;
        this.indices[ic++] = v0;     this.indices[ic++] = v0 + 1; this.indices[ic++] = v0 + 3;
        this.indices[ic++] = v0;     this.indices[ic++] = v0 + 3; this.indices[ic++] = v0 + 2;
      }
      this.iCount = ic;
    }

    addSegment(p0, p1, halfW, style = 1.0) {
      this.addChain([
        [p0[0], p0[1], p0[2], 0.0, halfW, style],
        [p1[0], p1[1], p1[2], 1.0, halfW, style]
      ]);
    }

    flush() {
      if (this.iCount === 0) return;
      const gl = this.gl;
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.vCount * 10));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, this.indices.subarray(0, this.iCount));
      gl.drawElements(gl.TRIANGLES, this.iCount, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);
    }
  }

  // --- Instanced Billboard Particle Batcher ---
  class ParticleBatcher {
    constructor(gl, maxParticles = 4096) {
      this.gl = gl;
      this.max = maxParticles;
      this.instData = new Float32Array(maxParticles * 8); // [x,y,z,rad, r,g,b,kind]
      this.count = 0;

      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);

      const quadVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  1,  1,
        -1, -1,  1,  1, -1,  1
      ]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);

      this.instVBO = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instVBO);
      gl.bufferData(gl.ARRAY_BUFFER, this.instData.byteLength, gl.DYNAMIC_DRAW);

      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
      gl.vertexAttribDivisor(1, 1);

      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
      gl.vertexAttribDivisor(2, 1);

      gl.bindVertexArray(null);
    }

    reset() {
      this.count = 0;
    }

    push(x, y, z, radius, r, g, b, kind = 0) {
      if (this.count >= this.max || radius <= 0.01) return;
      const o = this.count * 8;
      this.instData[o + 0] = x; this.instData[o + 1] = y; this.instData[o + 2] = z; this.instData[o + 3] = radius;
      this.instData[o + 4] = r; this.instData[o + 5] = g; this.instData[o + 6] = b; this.instData[o + 7] = kind;
      this.count++;
    }

    flush() {
      if (this.count === 0) return;
      const gl = this.gl;
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instVBO);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instData.subarray(0, this.count * 8));
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
      gl.bindVertexArray(null);
    }
  }

  // ==========================================================================
  // MAIN APPLICATION BOOTSTRAP
  // ==========================================================================
  function initApp() {
    const canvas = document.getElementById('stage');
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false, // We use explicit 4x MSAA HDR RGBA16F FBO!
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true // Ensures screenshot / videoExport readback always sees exact rendered frame!
    });

    if (!gl) {
      throw new Error('WebGL 2 is required.');
    }

    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('EXT_float_blend');

    // --- 1. Compile All Shader Programs ---
    const progs = {
      shadow:    createProgram(gl, Shaders.SHADOW_VS, Shaders.SHADOW_FS),
      sky:       createProgram(gl, Shaders.FULLSCREEN_VS, Shaders.SKY_FS),
      voxel:     createProgram(gl, Shaders.VOXEL_VS, Shaders.VOXEL_FS),
      plume:     createProgram(gl, Shaders.PLUME_VS, Shaders.PLUME_FS),
      ribbon:    createProgram(gl, Shaders.RIBBON_VS, Shaders.RIBBON_FS),
      shield:    createProgram(gl, Shaders.SHIELD_VS, Shaders.SHIELD_FS),
      particle:  createProgram(gl, Shaders.PARTICLE_VS, Shaders.PARTICLE_FS),
      bloomPre:  createProgram(gl, Shaders.FULLSCREEN_VS, Shaders.BLOOM_PREFILTER_FS),
      bloomDown: createProgram(gl, Shaders.FULLSCREEN_VS, Shaders.BLOOM_DOWN_FS),
      bloomUp:   createProgram(gl, Shaders.FULLSCREEN_VS, Shaders.BLOOM_UP_FS),
      composite: createProgram(gl, Shaders.FULLSCREEN_VS, Shaders.COMPOSITE_FS)
    };

    const emptyVAO = gl.createVertexArray();

    // Upload static material palette uniforms once to voxel program
    gl.useProgram(progs.voxel.prog);
    gl.uniform4fv(progs.voxel.u.u_matA, SF.Palette.matDataA);
    gl.uniform4fv(progs.voxel.u.u_matB, SF.Palette.matDataB);
    gl.uniform4fv(progs.voxel.u.u_matC, SF.Palette.matDataC);
    gl.uniform1i(progs.voxel.u.u_shadowMap, 0);

    // --- 2. Build All 1x1x1 Procedural Voxel Assets ---
    const flagshipRaw = SF.Ships.buildFlagship();
    const pulseTurretRaw = SF.Ships.buildPulseTurretHead();
    const floatPodRaw = SF.Ships.buildFloatingPulsePod();
    const guardRaw = SF.Ships.buildAegisGuard();
    const ciwsRaw = SF.Ships.buildCIWSTurret();
    const vanguardRaw = SF.Ships.buildLanceVanguard();
    const missileRaw = SF.Ships.buildVoxelMissile();
    const shuttleRaw = SF.Ships.buildDartShuttle();

    const hangarRaw = SF.Interiors.buildThroughHangar();
    const maintArmRaw = SF.Interiors.buildHangarMaintArm();
    const atriumRaw = SF.Interiors.buildPowerCoreAtrium();
    const coreRingsRaw = SF.Interiors.buildPowerCoreRings();
    const corridorRaw = SF.Interiors.buildEnergyCorridor();
    const corridorDynRaw = SF.Interiors.buildCorridorDynamicParts();
    const bridgeRaw = SF.Interiors.buildCommandBridge();
    const bridgeHoloRaw = SF.Interiors.buildBridgeHoloElements();

    // 7 Hero Destructible Voxel Asteroids + Small Shard & Intact Archetypes
    const destructibleSpecs = [
      { rx: 56, ry: 44, rz: 50, seed: 1001, mode: 'beam_pulse' },
      { rx: 42, ry: 34, rz: 38, seed: 2002, mode: 'pulse_barrage' },
      { rx: 50, ry: 40, rz: 45, seed: 3003, mode: 'missile_shatter' },
      { rx: 45, ry: 37, rz: 41, seed: 4004, mode: 'missile_shatter' },
      { rx: 24, ry: 20, rz: 22, seed: 5005, mode: 'ciws_shred' },
      { rx: 22, ry: 18, rz: 20, seed: 6006, mode: 'ciws_shred' },
      { rx: 25, ry: 21, rz: 23, seed: 7007, mode: 'ciws_shred' }
    ];
    const heroAsteroidAssets = destructibleSpecs.map((s) => {
      const da = SF.Asteroids.buildDestructibleAsteroid(s.rx, s.ry, s.rz, s.seed, s.mode);
      return {
        mode: da.mode,
        radius: da.radius,
        pieces: da.pieces.map((p) => ({
          gpuMesh: uploadVoxelMeshPair(gl, p.mesh),
          pivot: p.pivot,
          kind: p.kind,
          dir: p.dir,
          spin: p.spin,
          delay: p.delay
        }))
      };
    });

    const shardMeshes = SF.Asteroids.buildSmallShardArchetypes().map((m) => uploadVoxelMeshPair(gl, m));
    const intactAsteroidMeshes = SF.Asteroids.buildIntactAsteroidArchetypes().map((a) => ({
      gpuMesh: uploadVoxelMeshPair(gl, a.mesh),
      radius: a.radius
    }));

    const gpuAssets = {
      flagship: { ...flagshipRaw, gpuMesh: uploadVoxelMeshPair(gl, flagshipRaw.mesh) },
      pulseTurret: { ...pulseTurretRaw, gpuMesh: uploadVoxelMeshPair(gl, pulseTurretRaw.mesh) },
      floatingPod: { ...floatPodRaw, gpuMesh: uploadVoxelMeshPair(gl, floatPodRaw.mesh) },
      aegisGuard: { ...guardRaw, gpuMesh: uploadVoxelMeshPair(gl, guardRaw.mesh) },
      ciwsTurret: { ...ciwsRaw, gpuMesh: uploadVoxelMeshPair(gl, ciwsRaw.mesh) },
      lanceVanguard: { ...vanguardRaw, gpuMesh: uploadVoxelMeshPair(gl, vanguardRaw.mesh) },
      voxelMissile: { ...missileRaw, gpuMesh: uploadVoxelMeshPair(gl, missileRaw.mesh) },
      dartShuttle: { ...shuttleRaw, gpuMesh: uploadVoxelMeshPair(gl, shuttleRaw.mesh) },

      throughHangar: { ...hangarRaw, gpuMesh: uploadVoxelMeshPair(gl, hangarRaw.mesh) },
      maintArm: { gpuMesh: uploadVoxelMeshPair(gl, maintArmRaw.mesh) },
      powerCoreAtrium: { ...atriumRaw, gpuMesh: uploadVoxelMeshPair(gl, atriumRaw.mesh) },
      coreRings: coreRingsRaw.map((m) => uploadVoxelMeshPair(gl, m)),
      energyCorridor: { ...corridorRaw, gpuMesh: uploadVoxelMeshPair(gl, corridorRaw.mesh) },
      energyBlock: { gpuMesh: uploadVoxelMeshPair(gl, corridorDynRaw.energyBlockMesh) },
      loaderJaw: { gpuMesh: uploadVoxelMeshPair(gl, corridorDynRaw.loaderJawMesh) },
      commandBridge: { ...bridgeRaw, gpuMesh: uploadVoxelMeshPair(gl, bridgeRaw.mesh) },
      bridgeHolo: {
        flagship: uploadVoxelMeshPair(gl, bridgeHoloRaw.holoFlagship),
        escort: uploadVoxelMeshPair(gl, bridgeHoloRaw.holoEscort),
        target: uploadVoxelMeshPair(gl, bridgeHoloRaw.holoTarget),
        lineSeg: uploadVoxelMeshPair(gl, bridgeHoloRaw.holoLineSeg)
      },

      heroAsteroids: heroAsteroidAssets,
      shardArchetypes: shardMeshes,
      intactAsteroids: intactAsteroidMeshes
    };

    const plumeGeom = createPlumeGeometry(gl);
    const shieldGeom = createShieldGeometry(gl);
    const ribbonBatch = new RibbonBatcher(gl, 24576);
    const particleBatch = new ParticleBatcher(gl, 4096);

    const director = new SF.FleetDirector(gpuAssets);

    // --- 3. Create 4096x4096 Directional Shadow Map FBO ---
    const SHADOW_RES = 4096;
    const shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHADOW_RES, SHADOW_RES);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);

    const shadowFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // --- 4. Dynamic Resolution HDR MSAA + 5-Mip Bloom Targets (up to 3840x2160) ---
    let fbWidth = 0, fbHeight = 0;
    let msaaFBO = null, msaaColorRB = null, msaaDepthRB = null;
    let resolveFBO = null, resolveTex = null;
    let bloomMips = []; // 5 mip levels: [{ w, h, downTex, downFBO, upTex, upFBO }]

    function makeHDRTex(w, h) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fbo };
    }

    function ensureFramebuffers() {
      const dpr = Math.min(2.0, global.devicePixelRatio || 1.0);
      const targetW = clamp(Math.round(global.innerWidth * dpr), 64, 3840);
      const targetH = clamp(Math.round(global.innerHeight * dpr), 64, 2160);
      if (targetW === fbWidth && targetH === fbHeight) return;

      fbWidth = targetW;
      fbHeight = targetH;
      canvas.width = fbWidth;
      canvas.height = fbHeight;

      if (msaaFBO) {
        gl.deleteFramebuffer(msaaFBO);
        gl.deleteRenderbuffer(msaaColorRB);
        gl.deleteRenderbuffer(msaaDepthRB);
        gl.deleteFramebuffer(resolveFBO);
        gl.deleteTexture(resolveTex);
        for (const m of bloomMips) {
          gl.deleteFramebuffer(m.downFBO); gl.deleteTexture(m.downTex);
          gl.deleteFramebuffer(m.upFBO);   gl.deleteTexture(m.upTex);
        }
      }

      const maxSamples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
      msaaFBO = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFBO);

      msaaColorRB = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, msaaColorRB);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, maxSamples, gl.RGBA16F, fbWidth, fbHeight);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msaaColorRB);

      msaaDepthRB = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, msaaDepthRB);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, maxSamples, gl.DEPTH_COMPONENT24, fbWidth, fbHeight);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, msaaDepthRB);

      const res = makeHDRTex(fbWidth, fbHeight);
      resolveTex = res.tex;
      resolveFBO = res.fbo;

      bloomMips = [];
      let bw = Math.max(2, fbWidth >> 1);
      let bh = Math.max(2, fbHeight >> 1);
      for (let i = 0; i < 5; i++) {
        const dn = makeHDRTex(bw, bh);
        const up = makeHDRTex(bw, bh);
        bloomMips.push({ w: bw, h: bh, downTex: dn.tex, downFBO: dn.fbo, upTex: up.tex, upFBO: up.fbo });
        bw = Math.max(2, bw >> 1);
        bh = Math.max(2, bh >> 1);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // --- 5. Reusable Scratch Matrices & Scene Draw Lists ---
    const matView = M4.create();
    const matProj = M4.create();
    const matVP = M4.create();
    const matInvVP = M4.create();
    const matLightView = M4.create();
    const matLightProj = M4.create();
    const matLightVP = M4.create();
    const tmpM = M4.create();
    const sunDir = V3.normalize(V3.create(), [0.62, 0.44, 0.65]);

    const pointLightPosRad = new Float32Array(20 * 4);
    const pointLightCol = new Float32Array(20 * 4);
    let numPointLights = 0;

    function addPointLight(x, y, z, radius, r, g, b) {
      if (numPointLights >= 20 || radius <= 1.0) return;
      const o = numPointLights * 4;
      pointLightPosRad[o + 0] = x;
      pointLightPosRad[o + 1] = y;
      pointLightPosRad[o + 2] = z;
      pointLightPosRad[o + 3] = 1.0 / radius;
      pointLightCol[o + 0] = r;
      pointLightCol[o + 1] = g;
      pointLightCol[o + 2] = b;
      pointLightCol[o + 3] = 1.0;
      numPointLights++;
    }

    // Draw queue per frame: { gpuMesh, model: Float32Array(16), castShadow, specialMode, sp0, sp1, sp2, sp3 }
    const voxelQueue = [];
    const plumeQueue = [];
    const shieldQueue = [];

    function pushVoxelDraw(gpuMesh, modelMat, castShadow = true, specialMode = 0, s0 = 0, s1 = 0, s2 = 0, s3 = 0) {
      if (!gpuMesh) return;
      const copyM = new Float32Array(16);
      copyM.set(modelMat);
      voxelQueue.push({ gpuMesh, model: copyM, castShadow, specialMode, s0, s1, s2, s3 });
    }

    function pushShipThrusters(shipModel, thrusterList, surge, seedBase, opacity = 1.0) {
      const lengthMul = 1.0 + surge * 0.85;
      for (let i = 0; i < thrusterList.length; i++) {
        const th = thrusterList[i];
        const wp = [0, 0, 0], wd = [0, 0, 0];
        M4.transformPoint(wp, shipModel, th.pos);
        M4.transformDir(wd, shipModel, [0, 0, 1]); // Ship +Z forward; PLUME_VS extends along -Z!
        plumeQueue.push({
          pos: wp,
          dir: wd,
          rx: th.radiusX * (1.0 + surge * 0.16),
          ry: th.radiusY * (1.0 + surge * 0.16),
          len: th.length * lengthMul,
          surge,
          seed: seedBase + i * 1.7,
          opacity
        });
      }
    }

    // ========================================================================
    // STATELESS GLOBAL FRAME RENDERER: renderFrameAtGlobalTime(t)
    // ========================================================================
    let lastRenderedTime = 0.0;
    let flagshipTurretMuzzles = null;

    function renderFrameAtGlobalTime(rawT) {
      let t = rawT % SF.LOOP_DURATION;
      if (t < 0) t += SF.LOOP_DURATION;
      lastRenderedTime = t;

      ensureFramebuffers();

      voxelQueue.length = 0;
      plumeQueue.length = 0;
      shieldQueue.length = 0;
      numPointLights = 0;
      particleBatch.reset();

      const cam = director.evalCamera(t);
      const aspect = fbWidth / fbHeight;
      M4.lookAt(matView, cam.pos, cam.target, cam.up);
      M4.perspective(matProj, (cam.fovDeg * Math.PI) / 180.0, aspect, 1.8, 12000.0);
      M4.multiply(matVP, matProj, matView);

      // Compute skybox view-only inverse VP (zero translation)
      const matViewRot = M4.copy(M4.create(), matView);
      matViewRot[12] = 0; matViewRot[13] = 0; matViewRot[14] = 0;
      M4.multiply(tmpM, matProj, matViewRot);
      M4.invertRigidOrGeneral(matInvVP, tmpM);

      // Camera right & up vectors for billboarding
      const camRight = [matView[0], matView[4], matView[8]];
      const camUp    = [matView[1], matView[5], matView[9]];

      // Default lighting & beam light state
      let sunColor = [1.85, 1.66, 1.42];
      let ambTop   = [0.15, 0.23, 0.38];
      let ambBot   = [0.06, 0.09, 0.16];
      let shadowStrength = 1.0;
      let renderSky = true;
      let beamStart = [0, 0, 0];
      let beamEnd   = [0, 0, 1];
      let beamColI  = [0.22, 0.86, 1.0, 0.0];

      // ======================================================================
      // MODE A: POWER CORE ATRIUM (Shot 3: t = 23.5 .. 30.5s)
      // ======================================================================
      if (cam.mode === 'atrium') {
        renderSky = false;
        shadowStrength = 0.0;
        sunColor = [0.22, 0.34, 0.48];
        ambTop   = [0.08, 0.16, 0.28];
        ambBot   = [0.04, 0.09, 0.18];

        M4.identity(tmpM);
        pushVoxelDraw(gpuAssets.powerCoreAtrium.gpuMesh, tmpM, false, 2, 0, 0, 0, 0);

        // 4 Counter-rotating & gently tilting Voxel Core Rings!
        const ringSpeeds = [0.38, -0.27, 0.21, -0.15];
        const ringTilts  = [0.10, -0.18, 0.24, -0.12];
        for (let i = 0; i < gpuAssets.coreRings.length; i++) {
          const yaw = t * ringSpeeds[i] + i * 1.1;
          const pitch = Math.sin(t * 0.45 + i * 1.7) * ringTilts[i];
          const roll  = Math.cos(t * 0.38 + i * 2.1) * ringTilts[i] * 0.8;
          const yShift = Math.sin(t * 0.7 + i * 1.5) * 4.0;
          M4.fromRigidEuler(tmpM, 0, yShift, 0, yaw, pitch, roll);
          pushVoxelDraw(gpuAssets.coreRings[i], tmpM, false, 2);
        }

        // Breathing Core & Traveling Radial Strut Lights!
        const breath = 0.85 + 0.38 * Math.sin(t * 2.1);
        addPointLight(0,   0, 0, 260, 0.45 * breath, 2.25 * breath, 3.10 * breath);
        addPointLight(0,  78, 0, 195, 0.25 * breath, 1.35 * breath, 2.15 * breath);
        addPointLight(0, -78, 0, 195, 0.25 * breath, 1.35 * breath, 2.15 * breath);
        const pulseR = 36 + ((t * 48) % 86);
        addPointLight( pulseR, 14, 0, 95, 0.3, 1.4, 2.0);
        addPointLight(-pulseR, 14, 0, 95, 0.3, 1.4, 2.0);
        addPointLight(0, -66,  pulseR, 95, 0.3, 1.4, 2.0);
        addPointLight(0,  94, -pulseR, 95, 0.3, 1.4, 2.0);

        // Ambient floating core energy motes inside the Atrium chasm
        for (let i = 0; i < 90; i++) {
          const ang = hash1(i * 3.1) * Math.PI * 2 + t * 0.18;
          const rad = 22 + hash1(i * 7.7) * 78;
          const py = (((hash1(i * 11.3) * 240 + t * 18) % 240) - 120);
          particleBatch.push(Math.cos(ang) * rad, py, Math.sin(ang) * rad, 1.4, 0.22, 0.85, 1.2, 3);
        }
        particleBatch.push(0, 0, 0, 42 * breath, 0.18, 0.78, 1.15, 0);
      }

      // ======================================================================
      // MODE B: ENERGY LOADING & CONDUCTION CORRIDOR (Shot 4: t = 30.5 .. 36.8s)
      // ======================================================================
      else if (cam.mode === 'corridor') {
        renderSky = false;
        shadowStrength = 0.0;
        sunColor = [0.25, 0.35, 0.48];
        ambTop   = [0.09, 0.15, 0.26];
        ambBot   = [0.05, 0.08, 0.15];

        M4.identity(tmpM);
        pushVoxelDraw(gpuAssets.energyCorridor.gpuMesh, tmpM, false, 3);

        // 1. Batch-Advancing Glowing Voxel Energy Blocks along Port & Starboard Rail Troughs!
        const blockSpacing = 54.0;
        for (let i = 0; i < 7; i++) {
          // Stepped intermittent advance: surges forward, pauses briefly as clamps engage, then surges again!
          const rawPhase = t * 0.85 + i * 0.42;
          const stepFloor = Math.floor(rawPhase);
          const stepFrac = rawPhase - stepFloor;
          const pulsedProgress = stepFloor + smoothstep(0.15, 0.85, stepFrac);
          const zPos = ((pulsedProgress * blockSpacing) % 336.0) - 172.0;

          for (const side of [-1, 1]) {
            const bx = side * 22;
            M4.fromRigidEuler(tmpM, bx, -9, zPos, 0, 0, 0);
            pushVoxelDraw(gpuAssets.energyBlock.gpuMesh, tmpM, false, 0);
          }
          if (i % 2 === 0) {
            addPointLight(0, -6, zPos, 78, 0.25, 1.25, 1.85);
          }
        }

        // 2. Six Pairs of Abstract Clamping Voxel Loader Jaws (closing & opening rhythmically!)
        for (const anc of gpuAssets.energyCorridor.loaderJawAnchors) {
          const clampCycle = Math.sin(t * 2.2 - anc.index * 0.85) * 0.5 + 0.5;
          const xDist = lerp(29.0, 21.0, smoothstep(0.2, 0.8, clampCycle));
          // +X jaw faces -X (yaw = 0), -X jaw faces +X (yaw = PI)
          M4.fromRigidEuler(tmpM,  xDist, -8, anc.z, 0, 0, 0);
          pushVoxelDraw(gpuAssets.loaderJaw.gpuMesh, tmpM, false, 0);
          M4.fromRigidEuler(tmpM, -xDist, -8, anc.z, Math.PI, 0, 0);
          pushVoxelDraw(gpuAssets.loaderJaw.gpuMesh, tmpM, false, 0);

          if (clampCycle > 0.78) {
            const flash = (clampCycle - 0.78) / 0.22;
            particleBatch.push( 18, -8, anc.z, 6.5 * flash, 1.1, 0.65, 0.2, 0);
            particleBatch.push(-18, -8, anc.z, 6.5 * flash, 1.1, 0.65, 0.2, 0);
          }
        }

        // Far Blazing Convergence Cavity Light!
        addPointLight(0, 2, 196, 235, 1.35, 2.85, 3.60);
        addPointLight(0, 2, 152, 145, 0.45, 1.35, 2.05);
        addPointLight(0, 18, -40, 140, 0.20, 0.85, 1.45);
        particleBatch.push(0, 2, 206, 28, 0.45, 1.05, 1.35, 0);
      }

      // ======================================================================
      // MODE C: EXTERIOR FLEET, LONGITUDINAL HANGAR & COMMAND BRIDGE VISTA!
      // ======================================================================
      else {
        const isBridge = (cam.mode === 'bridge');

        // 1. Evaluate all 37 Warships (1 Flagship + 18 Guards + 18 Vanguards)
        const shipStates = new Array(director.ships.length);
        const shipModels = new Array(director.ships.length);

        // Compute Flagship Main Beam charge / firing state first (t = 43.4 .. 51.2s)
        let cannonChargeParam = 0.0;
        if (t >= 43.35 && t <= 51.3) {
          if (t < 45.2) {
            cannonChargeParam = smoothstep(43.35, 45.15, t);
          } else if (t <= 50.3) {
            cannonChargeParam = 1.15;
          } else {
            cannonChargeParam = 1.0 - smoothstep(50.3, 51.25, t);
          }
        }

        for (let i = 0; i < director.ships.length; i++) {
          const sh = director.ships[i];
          const st = director.evalShipState(sh, t);
          shipStates[i] = st;
          const m = M4.fromRigidEuler(M4.create(), st.pos[0], st.pos[1], st.pos[2], st.yaw, st.pitch, st.roll);
          shipModels[i] = m;

          if (sh.type === 'flagship') {
            const waveWorldZ = st.shieldWaveZ > -1.5 ? st.shieldWaveZ * 560.0 : -9999.0;
            const bridgeClipZ = gpuAssets.flagship.bridgeOrigin[2] + 62.0;
            pushVoxelDraw(
              gpuAssets.flagship.gpuMesh, m, !isBridge,
              isBridge ? 5 : 1,
              isBridge ? bridgeClipZ : cannonChargeParam,
              st.shieldIntensity, waveWorldZ, st.hullShieldReflect
            );

            if (!isBridge) {
              // Embedded 384-Voxel Longitudinal Through-Hangar inside Flagship at (-68, 0, 0)!
              const hm = M4.create();
              M4.fromRigidEuler(tmpM, -68, 0, 0, 0, 0, 0);
              M4.multiply(hm, m, tmpM);
              pushVoxelDraw(gpuAssets.throughHangar.gpuMesh, hm, false, 0);

              // Hangar Abstract Maintenance Arms & Parked Shuttles!
              for (let mi = 0; mi < gpuAssets.throughHangar.maintMountCoords.length; mi++) {
                const mc = gpuAssets.throughHangar.maintMountCoords[mi];
                const slideZ = Math.sin(t * 0.9 + mi * 1.4) * 5.0;
                const slideY = Math.cos(t * 1.3 + mi * 0.9) * 1.8;
                M4.fromRigidEuler(tmpM, mc.pos[0], mc.pos[1] + slideY, mc.pos[2] + slideZ, mc.side > 0 ? 0 : Math.PI, 0, 0);
                const am = M4.multiply(M4.create(), hm, tmpM);
                pushVoxelDraw(gpuAssets.maintArm.gpuMesh, am, false, 0);
              }
              for (const berth of director.parkedShuttleBerths) {
                M4.fromRigidEuler(tmpM, berth.pos[0], berth.pos[1] + 2, berth.pos[2], berth.side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5, 0, 0);
                const sm = M4.multiply(M4.create(), hm, tmpM);
                pushVoxelDraw(gpuAssets.dartShuttle.gpuMesh, sm, false, 0);
              }
            }

            // If camera is near/inside Port Hangar (Shot 2: t = 14 .. 23.6s), illuminate Hangar interior richly!
            if (t >= 13.5 && t <= 23.6) {
              addPointLight(st.pos[0] - 135, st.pos[1] + 8,  st.pos[2] - 220, 145, 0.35, 1.35, 2.10);
              addPointLight(st.pos[0] -  68, st.pos[1] + 12, st.pos[2] - 140, 155, 0.30, 1.15, 1.85);
              addPointLight(st.pos[0] -  68, st.pos[1] + 12, st.pos[2] -  30, 155, 0.30, 1.15, 1.85);
              addPointLight(st.pos[0] -  68, st.pos[1] + 10, st.pos[2] +  52, 145, 0.55, 1.65, 2.35);
              addPointLight(st.pos[0] -  68, st.pos[1] +  6, st.pos[2] +  84, 125, 0.85, 2.25, 2.95);
            }

            // Flagship Thruster Plumes & Stern Dynamic Propulsion Light!
            if (!isBridge) {
              pushShipThrusters(m, gpuAssets.flagship.thrusters, st.surge, 1.0);
              const sternGlow = 1.0 + st.surge * 1.45;
              addPointLight(st.pos[0], st.pos[1], st.pos[2] - 575, 340, 0.28 * sternGlow, 1.55 * sternGlow, 2.45 * sternGlow);
            }

            // Flagship 12 Hull Pulse Turrets + 4 Floating Outrigger Pulse Pods!
            const aimTarget = (t >= 44.0 && t <= 53.5)
              ? director.getHeroAsteroidBaseWorldPos(0, t)
              : [st.pos[0], st.pos[1] + 20, st.pos[2] + 1600];

            const allTurretWorldMuzzles = [];
            for (let ti = 0; ti < gpuAssets.flagship.pulseMounts.length; ti++) {
              const pm = gpuAssets.flagship.pulseMounts[ti];
              const wMount = M4.transformPoint([0, 0, 0], m, pm.pos);
              const dx = aimTarget[0] - wMount[0], dy = aimTarget[1] - wMount[1], dz = aimTarget[2] - wMount[2];
              const yaw = Math.atan2(dx, dz) * 0.55;
              const pitch = -clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.35, 0.45);
              const tm = M4.fromRigidEuler(M4.create(), wMount[0], wMount[1], wMount[2], st.yaw + yaw, st.pitch + pitch, st.roll);
              if (!isBridge || wMount[2] > 115.0) {
                pushVoxelDraw(gpuAssets.pulseTurret.gpuMesh, tm, true, 0);
              }
              allTurretWorldMuzzles.push([
                M4.transformPoint([0, 0, 0], tm, gpuAssets.pulseTurret.muzzles[0]),
                M4.transformPoint([0, 0, 0], tm, gpuAssets.pulseTurret.muzzles[1])
              ]);
            }

            for (let fi = 0; fi < gpuAssets.flagship.floatingPodMounts.length; fi++) {
              const fm = gpuAssets.flagship.floatingPodMounts[fi];
              const hoverY = Math.sin(t * 1.6 + fi * 1.5) * 3.2;
              const localPodPos = [fm.pos[0], fm.pos[1] + hoverY, fm.pos[2]];
              const wPod = M4.transformPoint([0, 0, 0], m, localPodPos);
              const pm = M4.fromRigidEuler(M4.create(), wPod[0], wPod[1], wPod[2], st.yaw, st.pitch, st.roll);
              if (!isBridge || wPod[2] > 115.0) {
                pushVoxelDraw(gpuAssets.floatingPod.gpuMesh, pm, true, 0);
              }
              if (!isBridge) {
                pushShipThrusters(pm, [gpuAssets.floatingPod.thruster], st.surge, 20 + fi);
              }
              const wTur = M4.transformPoint([0, 0, 0], pm, gpuAssets.floatingPod.turretMount);
              const dx = aimTarget[0] - wTur[0], dy = aimTarget[1] - wTur[1], dz = aimTarget[2] - wTur[2];
              const yaw = Math.atan2(dx, dz) * 0.65;
              const pitch = -clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.4, 0.45);
              const tm = M4.fromRigidEuler(M4.create(), wTur[0], wTur[1], wTur[2], st.yaw + yaw, st.pitch + pitch, st.roll);
              if (!isBridge || wPod[2] > 115.0) {
                pushVoxelDraw(gpuAssets.pulseTurret.gpuMesh, tm, true, 0);
              }
              allTurretWorldMuzzles.push([
                M4.transformPoint([0, 0, 0], tm, gpuAssets.pulseTurret.muzzles[0]),
                M4.transformPoint([0, 0, 0], tm, gpuAssets.pulseTurret.muzzles[1])
              ]);
            }
            flagshipTurretMuzzles = allTurretWorldMuzzles;

            if (st.shieldIntensity > 0.002 && !isBridge) {
              shieldQueue.push({
                model: m,
                halfExtents: [164, 118, 605],
                inflate: st.shieldInflate,
                waveZ: st.shieldWaveZ,
                intensity: st.shieldIntensity,
                seed: 0.13
              });
            }
          } else if (sh.type === 'guard') {
            const waveWorldZ = st.shieldWaveZ > -1.5 ? st.shieldWaveZ * 88.0 : -9999.0;
            pushVoxelDraw(gpuAssets.aegisGuard.gpuMesh, m, sh.guardIdx < 8, 0, 0, st.shieldIntensity, waveWorldZ, st.hullShieldReflect);
            pushShipThrusters(m, gpuAssets.aegisGuard.thrusters, st.surge, 30 + sh.id);

            // Articulating 6 CIWS Sponson Turrets on near Guard ships!
            if (sh.guardIdx < 8) {
              const ciwsTarget = (t >= 50.5 && t <= 58.0)
                ? director.getHeroAsteroidBaseWorldPos(sh.guardIdx === 3 ? 5 : (sh.guardIdx === 0 ? 6 : 4), t)
                : [st.pos[0], st.pos[1], st.pos[2] + 600];
              for (let ci = 0; ci < gpuAssets.aegisGuard.ciwsMounts.length; ci++) {
                const cm = gpuAssets.aegisGuard.ciwsMounts[ci];
                const wMount = M4.transformPoint([0, 0, 0], m, cm.pos);
                const dx = ciwsTarget[0] - wMount[0], dy = ciwsTarget[1] - wMount[1], dz = ciwsTarget[2] - wMount[2];
                const yaw = clamp(Math.atan2(dx, dz), -1.1, 1.1);
                const pitch = -clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.6, 0.6);
                const rollFlip = cm.up < 0 ? Math.PI : 0.0;
                const tm = M4.fromRigidEuler(M4.create(), wMount[0], wMount[1], wMount[2], st.yaw + yaw, st.pitch + pitch, st.roll + rollFlip);
                pushVoxelDraw(gpuAssets.ciwsTurret.gpuMesh, tm, false, 0);
              }
            }

            if (st.shieldIntensity > 0.002) {
              shieldQueue.push({
                model: m,
                halfExtents: [44, 32, 104],
                inflate: st.shieldInflate,
                waveZ: st.shieldWaveZ,
                intensity: st.shieldIntensity,
                seed: (sh.id * 0.37) % 1.0
              });
            }
          } else {
            // Lance Vanguard Missile Cruiser
            const waveWorldZ = st.shieldWaveZ > -1.5 ? st.shieldWaveZ * 104.0 : -9999.0;
            pushVoxelDraw(gpuAssets.lanceVanguard.gpuMesh, m, sh.vanguardIdx < 8, 0, 0, st.shieldIntensity, waveWorldZ, st.hullShieldReflect);
            pushShipThrusters(m, gpuAssets.lanceVanguard.thrusters, st.surge, 80 + sh.id);

            if (st.shieldIntensity > 0.002) {
              shieldQueue.push({
                model: m,
                halfExtents: [58, 28, 122],
                inflate: st.shieldInflate,
                waveZ: st.shieldWaveZ,
                intensity: st.shieldIntensity,
                seed: (sh.id * 0.51) % 1.0
              });
            }
          }
        }

        // 2. If inside Command Bridge (Shot 5: t = 36.8 .. 43.2s), render Bridge Hall + Live 3D Voxel Hologram!
        if (isBridge) {
          shadowStrength = 0.55;
          ambTop = [0.11, 0.19, 0.32];
          ambBot = [0.06, 0.10, 0.18];

          const bo = gpuAssets.flagship.bridgeOrigin;
          const bm = M4.fromRigidEuler(M4.create(), bo[0], bo[1], bo[2], 0, 0, 0);
          pushVoxelDraw(gpuAssets.commandBridge.gpuMesh, bm, false, 0);

          // Live 3D Voxel Tactical Hologram floating above Central Command Nexus!
          const nx = bo[0] + gpuAssets.commandBridge.nexusCenter[0];
          const ny = bo[1] + gpuAssets.commandBridge.nexusCenter[1] + 1.5 + Math.sin(t * 1.8) * 0.6;
          const nz = bo[2] + gpuAssets.commandBridge.nexusCenter[2];

          M4.fromRigidEuler(tmpM, nx, ny, nz, Math.sin(t * 0.4) * 0.08, 0, 0);
          pushVoxelDraw(gpuAssets.bridgeHolo.flagship, tmpM, false, 0);

          // Flanking Holo Escort Blips & Moving Trajectory Line Segments
          const holoOffsets = [
            [-12, 2, 5], [12, 2, 5], [-16, -1, -4], [16, -1, -4], [-9, 5, 13], [9, 5, 13]
          ];
          for (let hi = 0; hi < holoOffsets.length; hi++) {
            const ho = holoOffsets[hi];
            const driftX = ho[0] * (1.0 + 0.18 * director.getCombatSpread(t));
            M4.fromRigidEuler(tmpM, nx + driftX, ny + ho[1], nz + ho[2], 0, 0, 0);
            pushVoxelDraw(gpuAssets.bridgeHolo.escort, tmpM, false, 0);

            const lineZ = ((t * 6.0 + hi * 3.5) % 20.0) - 10.0;
            M4.fromRigidEuler(tmpM, nx + driftX * 0.78, ny + ho[1] - 1, nz + lineZ, 0, 0, 0);
            pushVoxelDraw(gpuAssets.bridgeHolo.lineSeg, tmpM, false, 0);
          }

          // Approaching Amber Holo Asteroid Target Marker ahead of Holo Flagship!
          const targetZ = 19.0 - smoothstep(36.5, 43.5, t) * 5.0;
          M4.fromRigidEuler(tmpM, nx + 4, ny + 2, nz + targetZ, t * 0.6, t * 0.4, 0);
          pushVoxelDraw(gpuAssets.bridgeHolo.target, tmpM, false, 0);

          // Local Bridge Hologram & Console Gallery Lights!
          addPointLight(nx, ny + 2, nz, 82, 0.35, 1.55, 2.35);
          addPointLight(bo[0] - 38, bo[1] + 5, bo[2] - 10, 62, 0.25, 0.90, 1.45);
          addPointLight(bo[0] + 38, bo[1] + 5, bo[2] - 10, 62, 0.38, 0.72, 1.15);
          particleBatch.push(nx, ny + 1, nz, 15, 0.14, 0.65, 1.0, 0);
        }

        // 3. Active Hull-Skimming & Hangar Launch/Recovery Shuttles (28 voxels long!)
        {
          const sp = [0, 0, 0], stang = [0, 0, 1];
          for (let li = 0; li < director.hullShuttleLoops.length; li++) {
            const lp = director.hullShuttleLoops[li];
            const u = ((t / SF.LOOP_DURATION) * lp.cycles + lp.phase) % 1.0;
            evalCatmullRom3(sp, lp.pts, u, true);
            if (isBridge && sp[2] < 135.0) continue;
            evalCatmullRomTangent3(stang, lp.pts, u, true);
            const sm = M4.fromPosDirScale(M4.create(), sp, stang, 0.25 * Math.sin(u * Math.PI * 4), 1, 1, 1);
            pushVoxelDraw(gpuAssets.dartShuttle.gpuMesh, sm, false, 0);
            pushShipThrusters(sm, gpuAssets.dartShuttle.thrusters, shipStates[0].surge * 0.5, 200 + li);
          }

          // Hero Shot-2 Inbound & Outbound Hangar Shuttles!
          if (!isBridge && t >= 10.5 && t <= 24.5) {
            for (const [keys, seedOff] of [[director.heroInboundKeys, 220], [director.heroOutboundKeys, 225]]) {
              evalTimedSpline3(sp, keys, t);
              const spNext = [0, 0, 0];
              evalTimedSpline3(spNext, keys, t + 0.05);
              V3.sub(stang, spNext, sp);
              if (V3.len(stang) < 1e-4) V3.set(stang, 0, 0, 1); else V3.normalize(stang, stang);
              const sm = M4.fromPosDirScale(M4.create(), sp, stang, 0.0, 1, 1, 1);
              pushVoxelDraw(gpuAssets.dartShuttle.gpuMesh, sm, false, 0);
              pushShipThrusters(sm, gpuAssets.dartShuttle.thrusters, 0.2, seedOff, 0.85);
            }
          }
        }

        // 4. Voxel Asteroid Clusters (Pass -1 = Receding Previous Cluster; Pass 0 = Combat Cluster A; Pass 1 = Next Incoming Cluster B!)
        //    Looping [-1, 0, 1] with effT = t - passIdx * LOOP_DURATION guarantees 100.000% bit-exact
        //    continuity of every asteroid, slab, boulder, and shard across the t = 78.0s -> 0.0s seam!
        for (const passIdx of [-1, 0, 1]) {
          const clusterZ = director.getClusterWorldZ(t, passIdx);
          if (clusterZ > 4500 || clusterZ < -2250) continue;
          const effT = t - passIdx * SF.LOOP_DURATION;

          // Intact surrounding asteroids in this cluster
          const rotPhase = effT / SF.LOOP_DURATION;
          for (let ia = 0; ia < director.intactAsteroids.length; ia++) {
            const ast = director.intactAsteroids[ia];
            const wz = clusterZ + ast.offset[2];
            if (wz < -2060 || wz > 4400) continue;
            const trailFade = smoothstep(-1350, -2050, wz);
            const arch = gpuAssets.intactAsteroids[ast.archIdx];
            const rx = ast.rot0[0] + rotPhase * ast.rotCycles[0] * Math.PI * 2;
            const ry = ast.rot0[1] + rotPhase * ast.rotCycles[1] * Math.PI * 2;
            const rz = ast.rot0[2] + rotPhase * ast.rotCycles[2] * Math.PI * 2;
            M4.fromRigidEuler(tmpM, ast.offset[0], ast.offset[1], wz, ry, rx, rz);
            pushVoxelDraw(
              arch.gpuMesh, tmpM, wz > -200 && wz < 1800,
              trailFade > 0.001 ? 4 : 0,
              0, trailFade, 0, 0
            );
          }

          // 7 Hero Destructible Asteroids (intact when effT < hitStart; fractured for effT >= hitStart!)
          for (let hi = 0; hi < director.heroAsteroids.length; hi++) {
            const ha = director.heroAsteroids[hi];
            const asset = gpuAssets.heroAsteroids[ha.assetIdx];
            const baseX = ha.offset[0];
            const baseY = ha.offset[1];
            const baseZ = clusterZ + ha.offset[2];
            if (baseZ < -2150 || baseZ > 4400) continue;

            // Compute internal fracture heat (glows molten amber-white during cleave, then cools into dark rock!)
            let fractureHeat = 0.0;
            if (effT >= ha.hitStart) {
              const dtHit = effT - ha.hitStart;
              const rise = smoothstep(0.0, Math.max(0.25, ha.cleaveTime - ha.hitStart + 0.30), dtHit);
              const cool = 1.0 - smoothstep(ha.cleaveTime - ha.hitStart + 0.45, ha.cleaveTime - ha.hitStart + 4.8, dtHit);
              fractureHeat = rise * cool * (ha.mode === 'beam_pulse' ? 1.25 : 1.05);
            }

            for (let pi = 0; pi < asset.pieces.length; pi++) {
              const pc = asset.pieces[pi];
              let sepDist = 0.0;
              let spinAng = 0.0;

              let triggerT = ha.cleaveTime + pc.delay;
              if (pc.kind === 'pulse_chunk') {
                triggerT = ha.hitStart + pc.delay;
              }
              if (effT > triggerT) {
                const dtSep = effT - triggerT;
                const easeSep = dtSep * smoothstep(0.0, 0.55, dtSep);
                const dampedSep = easeSep / (1.0 + easeSep * 0.032);
                const speed = pc.kind === 'slab' ? 14.5 : (pc.kind === 'core' ? 5.2 : 28.0);
                sepDist = dampedSep * speed;
                spinAng = easeSep * 0.92;
              }

              // Outward lane-parting velocity component ensures cleaved boulders sweep cleanly
              // around the Flagship's 328x236 shield corridor as the fleet advances through the field!
              const laneSignX = baseX >= 0 ? 1.0 : -1.0;
              const laneSignY = baseY >= 0 ? 1.0 : -1.0;
              const lanePushX = sepDist > 0 ? laneSignX * sepDist * (hi <= 1 ? 0.78 : 0.42) : 0.0;
              const lanePushY = sepDist > 0 ? laneSignY * sepDist * (hi <= 1 ? 0.46 : 0.25) : 0.0;

              const px = baseX + pc.pivot[0] + pc.dir[0] * sepDist + lanePushX;
              const py = baseY + pc.pivot[1] + pc.dir[1] * sepDist + lanePushY;
              const pz = baseZ + pc.pivot[2] + pc.dir[2] * sepDist;
              if (pz < -2060) continue;
              const pieceFade = smoothstep(-1350, -2050, pz);
              M4.fromRigidEuler(tmpM, px, py, pz, pc.spin[0] * spinAng, pc.spin[1] * spinAng, pc.spin[2] * spinAng);
              pushVoxelDraw(pc.gpuMesh, tmpM, pz > -100 && pz < 1500, 4, fractureHeat, pieceFade, 0, 0);
            }

            // Impact Corona, Fissure Flash & Lingering Asteroid Dust Puffs
            if (effT >= ha.hitStart && effT <= ha.cleaveTime + 8.5) {
              const dtC = effT - ha.cleaveTime;
              if (dtC > -0.45 && dtC < 1.25) {
                const burst = Math.exp(-Math.pow(dtC * 1.85, 2.0));
                const rFlash = asset.radius * (0.52 + 0.38 * saturate(dtC + 0.25));
                particleBatch.push(baseX, baseY, baseZ, rFlash, 1.15 * burst, 0.65 * burst, 0.26 * burst, 0);
                addPointLight(baseX, baseY, baseZ, asset.radius * 4.2, 2.2 * burst, 1.30 * burst, 0.58 * burst);
              }
              if (dtC > -0.08 && dtC < 1.15) {
                const ringP = saturate((dtC + 0.08) / 1.23);
                const fadeR = 1.0 - ringP;
                particleBatch.push(baseX, baseY, baseZ, asset.radius * (0.55 + 2.1 * ringP), 0.95 * fadeR, 0.68 * fadeR, 0.32 * fadeR, 1);
              }
              if (dtC > 0.0 && dtC < 7.5) {
                const dustP = dtC / 7.5;
                const dustAlpha = smoothstep(0.0, 0.12, dustP) * (1.0 - smoothstep(0.35, 1.0, dustP));
                for (let di = 0; di < 4; di++) {
                  const ox = (hash1(hi * 17 + di * 3) - 0.5) * (28 + dtC * 16);
                  const oy = (hash1(hi * 23 + di * 5) - 0.5) * (24 + dtC * 14);
                  const oz = (hash1(hi * 31 + di * 7) - 0.5) * (28 + dtC * 16);
                  particleBatch.push(baseX + ox, baseY + oy, baseZ + oz, 22 + dtC * 7, 0.20 * dustAlpha, 0.18 * dustAlpha, 0.17 * dustAlpha, 2);
                }
              }
            }
          }

          // Small Solid 1x1x1..7x5x5 Voxel Shards flying out of fractured Hero Asteroids!
          if (effT >= 46.5 && effT <= 86.0) {
            for (let si = 0; si < director.shardBursts.length; si++) {
              const sb = director.shardBursts[si];
              if (effT < sb.spawnTime) continue;
              const dtS = effT - sb.spawnTime;
              if (dtS > 28.0) continue;
              const dampedDt = dtS / (1.0 + dtS * 0.04);
              const ha = director.heroAsteroids[sb.parentId];
              const bx = ha.offset[0] + sb.localOrigin[0] + sb.vel[0] * dampedDt;
              const by = ha.offset[1] + sb.localOrigin[1] + sb.vel[1] * dampedDt;
              const bz = clusterZ + ha.offset[2] + sb.localOrigin[2] + sb.vel[2] * dampedDt;
              if (bz < -2060) continue;
              const shardFade = Math.max(smoothstep(18.0, 27.5, dtS), smoothstep(-1350, -2050, bz));
              const shardHeat = Math.max(0.0, 1.35 - dtS * 0.85);
              M4.fromRigidEuler(tmpM, bx, by, bz, sb.spin[0] * dtS, sb.spin[1] * dtS, sb.spin[2] * dtS);
              pushVoxelDraw(gpuAssets.shardArchetypes[sb.archIdx], tmpM, false, 4, shardHeat, shardFade, 0, 0);
            }
          }
        }

        // 5. Physical Voxel Missiles in Flight (Weapon #4: t = 53.05 .. 59.10s)
        if (t >= 53.0 && t <= 59.5) {
          const mp = [0, 0, 0], mpNext = [0, 0, 0], mDir = [0, 0, 1];
          for (let mi = 0; mi < director.missiles.length; mi++) {
            const m = director.missiles[mi];
            if (t < m.tLaunch || t > m.tHit) continue;
            director.evalMissilePos(mp, m, t);
            director.evalMissilePos(mpNext, m, Math.min(m.tHit, t + 0.03));
            V3.sub(mDir, mpNext, mp);
            if (V3.len(mDir) < 1e-4) V3.set(mDir, 0, 0, 1); else V3.normalize(mDir, mDir);

            const mm = M4.fromPosDirScale(M4.create(), mp, mDir, t * 3.0 + mi, 1, 1, 1);
            pushVoxelDraw(gpuAssets.voxelMissile.gpuMesh, mm, false, 0);

            // Bright tail flare once ignited!
            if (t >= m.tIgnite) {
              const tailPos = [mp[0] - mDir[0] * 9.5, mp[1] - mDir[1] * 9.5, mp[2] - mDir[2] * 9.5];
              const igBoost = 1.0 + 1.2 * Math.exp(-(t - m.tIgnite) * 6.0);
              particleBatch.push(tailPos[0], tailPos[1], tailPos[2], 7.5 * igBoost, 1.35, 0.85, 0.32, 0);
            }
          }
        }

        // 6. Main Beam Cannon Charge Muzzle Effects & Capsule Illumination!
        if (t >= 43.4 && t <= 51.3) {
          const fsModel = shipModels[0];
          const muzzleW = M4.transformPoint([0, 0, 0], fsModel, gpuAssets.flagship.mainBeamMuzzle);
          const targetW = director.getHeroAsteroidBaseWorldPos(0, t);
          targetW[0] -= 18; // Strike right into the central fault cleft of Asteroid #1!

          if (t < 45.2) {
            // Condensing muzzle energy sphere + inward rings during charge!
            const cp = smoothstep(43.4, 45.2, t);
            particleBatch.push(muzzleW[0], muzzleW[1], muzzleW[2], 8 + cp * 26, 0.35 * cp, 1.35 * cp, 1.85 * cp, 0);
            const ringR = 46 * (1.0 - ((t * 2.4) % 1.0));
            particleBatch.push(muzzleW[0], muzzleW[1], muzzleW[2] + 4, ringR, 0.25 * cp, 0.95 * cp, 1.4 * cp, 1);
            addPointLight(muzzleW[0], muzzleW[1], muzzleW[2] + 10, 190, 0.45 * cp, 1.95 * cp, 2.85 * cp);
          } else {
            // Active Firing (45.2 .. 50.3s) & Detach Decay (50.3 .. 51.25s)!
            const detachP = t > 50.3 ? smoothstep(50.3, 51.25, t) : 0.0;
            const beamInt = (1.0 - detachP * 0.85) * smoothstep(45.2, 45.32, t);
            V3.copy(beamStart, muzzleW);
            V3.copy(beamEnd, targetW);
            beamColI = [0.22, 0.88, 1.0, 2.15 * beamInt];

            // Muzzle shock rings & flare
            if (detachP < 0.35) {
              particleBatch.push(muzzleW[0], muzzleW[1], muzzleW[2], 24 * (1.0 - detachP * 2.0), 0.50, 1.50, 2.05, 0);
              const shockP = (t - 45.2) % 0.55 / 0.55;
              particleBatch.push(muzzleW[0], muzzleW[1], muzzleW[2] + 6, 14 + shockP * 44, (1 - shockP) * 0.55, (1 - shockP) * 1.3, (1 - shockP) * 1.8, 1);
            }
            // Target Asteroid #1 focused cleft impact flare!
            particleBatch.push(targetW[0], targetW[1], targetW[2] - 20, 22 * beamInt, 0.75 * beamInt, 1.35 * beamInt, 1.85 * beamInt, 0);
          }
        }

        // 7. Periodic 3D Space Parallax Motes (illuminated dynamically when close to ships/combat!)
        if (!isBridge) {
          const travel = director.getTravelDistance(t);
          const wrapZ = director.dustWrapZ;
          const surge = director.getSurgeFactor(t);
          for (let i = 0; i < director.spaceMotes.length; i++) {
            const sm = director.spaceMotes[i];
            // Wrap symmetrically around camera Z in [-wrapZ*0.5 .. +wrapZ*0.5]!
            let relZ = (sm.z0 - travel - cam.pos[2]) % wrapZ;
            if (relZ < -wrapZ * 0.5) relZ += wrapZ;
            if (relZ >  wrapZ * 0.5) relZ -= wrapZ;
            const wz = cam.pos[2] + relZ;
            const distCam = Math.hypot(sm.x - cam.pos[0], sm.y - cam.pos[1], wz - cam.pos[2]);
            if (distCam > 850 || distCam < 8) continue;

            // Subtle ambient visibility + dramatic brightening near thrusters, shields & weapon fire!
            let lum = 0.08 + surge * 0.14;
            if (beamColI[3] > 0.1 && Math.abs(sm.x) < 220 && wz > 380 && wz < 1050) lum += 0.55;
            if (wz < -420 && wz > -780 && Math.hypot(sm.x, sm.y) < 220) lum += 0.45 * (1 + surge);
            const fadeDist = 1.0 - smoothstep(420, 850, distCam);
            const b = sm.bright * lum * fadeDist;
            particleBatch.push(sm.x, sm.y, wz, sm.size, b * 0.55, b * 0.85, b * 1.15, 3);
          }
        }
      }

      // ======================================================================
      // PASS 1: 4096x4096 DIRECTIONAL SHADOW MAP
      // ======================================================================
      if (shadowStrength > 0.01) {
        // Focus shadow frustum around camera look region for crisp voxel self-shadows!
        const focus = [
          lerp(cam.pos[0], cam.target[0], 0.65),
          lerp(cam.pos[1], cam.target[1], 0.65),
          lerp(cam.pos[2], cam.target[2], 0.65)
        ];
        const eyeS = [
          focus[0] + sunDir[0] * 1600,
          focus[1] + sunDir[1] * 1600,
          focus[2] + sunDir[2] * 1600
        ];
        M4.lookAt(matLightView, eyeS, focus, [0, 1, 0]);
        M4.ortho(matLightProj, -780, 780, -780, 780, 150, 3400);
        M4.multiply(matLightVP, matLightProj, matLightView);

        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
        gl.viewport(0, 0, SHADOW_RES, SHADOW_RES);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LESS);
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        gl.useProgram(progs.shadow.prog);
        gl.uniformMatrix4fv(progs.shadow.u.u_lightVP, false, matLightVP);

        for (let i = 0; i < voxelQueue.length; i++) {
          const item = voxelQueue[i];
          if (!item.castShadow || !item.gpuMesh.opaque) continue;
          gl.uniformMatrix4fv(progs.shadow.u.u_model, false, item.model);
          gl.bindVertexArray(item.gpuMesh.opaque.vao);
          gl.drawElements(gl.TRIANGLES, item.gpuMesh.opaque.count, gl.UNSIGNED_INT, 0);
        }
        gl.bindVertexArray(null);
      }

      // ======================================================================
      // PASS 2: HDR 4x MSAA SCENE RENDERING
      // ======================================================================
      gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFBO);
      gl.viewport(0, 0, fbWidth, fbHeight);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.clearColor(0.008, 0.013, 0.025, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // 2A. Cosmic Skybox, Nebula & Lit Celestial Planet Crescent
      if (renderSky) {
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        gl.useProgram(progs.sky.prog);
        gl.uniformMatrix4fv(progs.sky.u.u_invViewProj, false, matInvVP);
        gl.uniform3fv(progs.sky.u.u_sunDir, sunDir);
        gl.uniform1f(progs.sky.u.u_time, t);
        gl.bindVertexArray(emptyVAO);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
      }

      // 2B. Opaque 1x1x1 Voxel Meshes
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);

      const vp = progs.voxel;
      gl.useProgram(vp.prog);
      gl.uniformMatrix4fv(vp.u.u_viewProj, false, matVP);
      gl.uniformMatrix4fv(vp.u.u_lightVP, false, matLightVP);
      gl.uniform3fv(vp.u.u_camPos, cam.pos);
      gl.uniform3fv(vp.u.u_sunDir, sunDir);
      gl.uniform3fv(vp.u.u_sunColor, sunColor);
      gl.uniform3fv(vp.u.u_ambTop, ambTop);
      gl.uniform3fv(vp.u.u_ambBot, ambBot);
      gl.uniform1f(vp.u.u_shadowStrength, shadowStrength);
      gl.uniform1f(vp.u.u_time, t);

      gl.uniform1i(vp.u.u_numPointLights, numPointLights);
      if (numPointLights > 0) {
        gl.uniform4fv(vp.u.u_pointLightPosRad, pointLightPosRad);
        gl.uniform4fv(vp.u.u_pointLightCol, pointLightCol);
      }
      gl.uniform3fv(vp.u.u_beamStart, beamStart);
      gl.uniform3fv(vp.u.u_beamEnd, beamEnd);
      gl.uniform4fv(vp.u.u_beamLightCol, beamColI);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, shadowTex);

      for (let i = 0; i < voxelQueue.length; i++) {
        const item = voxelQueue[i];
        if (!item.gpuMesh.opaque) continue;
        gl.uniformMatrix4fv(vp.u.u_model, false, item.model);
        gl.uniform1i(vp.u.u_specialMode, item.specialMode);
        gl.uniform4f(vp.u.u_specialParams, item.s0, item.s1, item.s2, item.s3);
        gl.bindVertexArray(item.gpuMesh.opaque.vao);
        gl.drawElements(gl.TRIANGLES, item.gpuMesh.opaque.count, gl.UNSIGNED_INT, 0);
      }

      // 2C. Translucent Solid 1x1x1 Voxel Meshes (Holograms, Core Crystals, Display Panels)
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);

      for (let i = 0; i < voxelQueue.length; i++) {
        const item = voxelQueue[i];
        if (!item.gpuMesh.translucent) continue;
        gl.uniformMatrix4fv(vp.u.u_model, false, item.model);
        gl.uniform1i(vp.u.u_specialMode, item.specialMode);
        gl.uniform4f(vp.u.u_specialParams, item.s0, item.s1, item.s2, item.s3);
        gl.bindVertexArray(item.gpuMesh.translucent.vao);
        gl.drawElements(gl.TRIANGLES, item.gpuMesh.translucent.count, gl.UNSIGNED_INT, 0);
      }
      gl.bindVertexArray(null);

      // 2D. Continuous Light & Medium VFX (Thrusters, Beams, Bolts, Tracers, Trails, Shields, Particles)
      // --- Thruster Plumes (Additive) ---
      if (plumeQueue.length > 0) {
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(progs.plume.prog);
        gl.uniformMatrix4fv(progs.plume.u.u_viewProj, false, matVP);
        gl.uniform1f(progs.plume.u.u_time, t);
        gl.bindVertexArray(plumeGeom.vao);

        for (let i = 0; i < plumeQueue.length; i++) {
          const pl = plumeQueue[i];
          gl.uniform4f(progs.plume.u.u_plumeParams, pl.surge, pl.seed, 1.0, pl.opacity * 0.65);
          // Crossed horizontal + vertical volumetric blades
          M4.fromPosDirScale(tmpM, pl.pos, pl.dir, 0.0, pl.rx * 1.45, pl.ry * 1.45, pl.len);
          gl.uniformMatrix4fv(progs.plume.u.u_model, false, tmpM);
          gl.drawElements(gl.TRIANGLES, plumeGeom.count, gl.UNSIGNED_SHORT, 0);

          M4.fromPosDirScale(tmpM, pl.pos, pl.dir, Math.PI * 0.5, pl.ry * 1.45, pl.rx * 1.45, pl.len);
          gl.uniformMatrix4fv(progs.plume.u.u_model, false, tmpM);
          gl.drawElements(gl.TRIANGLES, plumeGeom.count, gl.UNSIGNED_SHORT, 0);
        }
        gl.bindVertexArray(null);
      }

      // --- Weapon Ribbons (Main Beam, Pulse Bolts, CIWS Tracers, Missile Trails) ---
      if (cam.mode === 'exterior') {
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(progs.ribbon.prog);
        gl.uniformMatrix4fv(progs.ribbon.u.u_viewProj, false, matVP);
        gl.uniform3fv(progs.ribbon.u.u_camPos, cam.pos);
        gl.uniform1f(progs.ribbon.u.u_time, t);

        // Kind 0: Flagship Main Energy Beam (t = 45.2 .. 51.25s)
        if (t >= 45.2 && t <= 51.25) {
          ribbonBatch.reset();
          const detachHead = t > 50.3 ? smoothstep(50.3, 51.20, t) : 0.0;
          const widthScale = t > 50.3 ? lerp(1.0, 0.32, detachHead) : smoothstep(45.2, 45.38, t);
          const chain = [];
          const N_SEG = 28;
          for (let s = 0; s <= N_SEG; s++) {
            const u = s / N_SEG;
            const px = lerp(beamStart[0], beamEnd[0], u);
            const py = lerp(beamStart[1], beamEnd[1], u);
            const pz = lerp(beamStart[2], beamEnd[2], u);
            chain.push([px, py, pz, u, 16.0 * widthScale, 1.0]);
          }
          ribbonBatch.addChain(chain);
          gl.uniform1i(progs.ribbon.u.u_ribbonKind, 0);
          gl.uniform4f(progs.ribbon.u.u_ribbonParams, 1.15, detachHead, 0.0, 0.0);
          ribbonBatch.flush();
        }

        // Kind 1: Flagship Pulse Turret Energy Bolts (t = 46.3 .. 52.8s)
        if (t >= 46.3 && t <= 52.8 && flagshipTurretMuzzles) {
          ribbonBatch.reset();
          for (let si = 0; si < director.pulseShots.length; si++) {
            const ps = director.pulseShots[si];
            if (t < ps.tFire - 0.05 || t > ps.tHit + 0.18) continue;
            const muzzles = flagshipTurretMuzzles[ps.turretIdx];
            if (!muzzles) continue;
            const pStart = muzzles[ps.barrelIdx];
            const targBase = director.getHeroAsteroidBaseWorldPos(ps.targetHeroIdx, ps.tHit);
            const pEnd = [
              targBase[0] + ps.targetJitter[0],
              targBase[1] + ps.targetJitter[1],
              targBase[2] + ps.targetJitter[2] - 24
            ];

            // Muzzle flash on turret & hull armor!
            if (t >= ps.tFire && t < ps.tFire + 0.11) {
              const mf = 1.0 - (t - ps.tFire) / 0.11;
              particleBatch.push(pStart[0], pStart[1], pStart[2] + 3, 9.5 * mf, 0.35 * mf, 1.45 * mf, 2.1 * mf, 0);
              if (si % 2 === 0) addPointLight(pStart[0], pStart[1] + 4, pStart[2], 75, 0.3 * mf, 1.3 * mf, 1.9 * mf);
            }

            // Bolt in flight (short comet tail -> bright head!)
            if (t >= ps.tFire && t <= ps.tHit) {
              const uHead = saturate((t - ps.tFire) / (ps.tHit - ps.tFire));
              const uTail = Math.max(0.0, uHead - 0.16);
              const bHead = V3.lerp([0, 0, 0], pStart, pEnd, uHead);
              const bTail = V3.lerp([0, 0, 0], pStart, pEnd, uTail);
              ribbonBatch.addSegment(bTail, bHead, 6.8, 1.15);
            }

            // Stepped crater impact flash!
            if (t >= ps.tHit && t < ps.tHit + 0.18) {
              const hf = 1.0 - (t - ps.tHit) / 0.18;
              particleBatch.push(pEnd[0], pEnd[1], pEnd[2], 18 * hf, 0.65 * hf, 1.45 * hf, 2.0 * hf, 0);
            }
          }
          gl.uniform1i(progs.ribbon.u.u_ribbonKind, 1);
          ribbonBatch.flush();
        }

        // Kind 2: Aegis Guard Rapid-Fire CIWS Point-Defense Streams (t = 51.6 .. 57.4s)
        if (t >= 51.6 && t <= 57.5) {
          ribbonBatch.reset();
          for (let bi = 0; bi < director.ciwsBursts.length; bi++) {
            const cb = director.ciwsBursts[bi];
            const guardState = director.evalShipState(director.ships[cb.shipIdx], t);
            const guardModel = M4.fromRigidEuler(M4.create(), guardState.pos[0], guardState.pos[1], guardState.pos[2], guardState.yaw, guardState.pitch, guardState.roll);
            const targBase = director.getHeroAsteroidBaseWorldPos(cb.targetHeroIdx, t);

            for (let si = 0; si < cb.sponsonIndices.length; si++) {
              const spIdx = cb.sponsonIndices[si];
              const cm = gpuAssets.aegisGuard.ciwsMounts[spIdx];
              const wMount = M4.transformPoint([0, 0, 0], guardModel, cm.pos);

              // Alternating rapid short bursts: 14 rounds/sec!
              const shotRate = 14.0;
              const flightDur = 0.48;
              const firstIdx = Math.max(0, Math.floor((t - flightDur - cb.tStart) * shotRate));
              const lastIdx  = Math.floor((Math.min(t, cb.tEnd) - cb.tStart) * shotRate);

              for (let k = firstIdx; k <= lastIdx; k++) {
                // Short tactical pause every 11 rounds for realistic staccato cadence!
                if ((k % 13) >= 10) continue;
                const tShot = cb.tStart + (k + (si % 2) * 0.5) / shotRate;
                if (tShot > cb.tEnd || t < tShot) continue;
                const u = (t - tShot) / flightDur;
                if (u > 1.08) continue;

                const barrelOff = ((k & 1) === 0 ? -2.2 : 2.2);
                const p0 = [wMount[0] + barrelOff, wMount[1] + 2.5 * cm.up, wMount[2] + 12];
                const p1 = [
                  targBase[0] + (hash1(k * 7.1 + si) - 0.5) * 24,
                  targBase[1] + (hash1(k * 13.3 + bi) - 0.5) * 22,
                  targBase[2] + (hash1(k * 19.7 + spIdx) - 0.5) * 20 - 14
                ];

                if (u < 0.12) {
                  particleBatch.push(p0[0], p0[1], p0[2], 3.8 * (1 - u / 0.12), 0.75, 1.15, 1.55, 0);
                }
                if (u <= 1.0) {
                  const uTail = Math.max(0.0, u - 0.11);
                  const d0 = V3.lerp([0, 0, 0], p0, p1, uTail);
                  const d1 = V3.lerp([0, 0, 0], p0, p1, u);
                  ribbonBatch.addSegment(d0, d1, 2.2, 1.1);
                } else {
                  const spk = 1.0 - (u - 1.0) / 0.08;
                  particleBatch.push(p1[0], p1[1], p1[2], 6.5 * spk, 1.2 * spk, 0.9 * spk, 0.45 * spk, 0);
                }
              }

              // Faint cooling barrel ember right after cease-fire (cb.tEnd .. cb.tEnd + 0.65s)
              if (t > cb.tEnd && t < cb.tEnd + 0.65) {
                const cool = 1.0 - (t - cb.tEnd) / 0.65;
                particleBatch.push(wMount[0], wMount[1] + 2 * cm.up, wMount[2] + 12, 2.6 * cool, 0.9 * cool, 0.45 * cool, 0.15 * cool, 0);
              }
            }
          }
          gl.uniform1i(progs.ribbon.u.u_ribbonKind, 2);
          ribbonBatch.flush();
        }

        // Kind 3: Lance Vanguard Long Modulated Missile Trails (linger & loosen after impact! t = 53.3 .. 61.8s)
        if (t >= 53.3 && t <= 61.8) {
          ribbonBatch.reset();
          const pt = [0, 0, 0];
          for (let mi = 0; mi < director.missiles.length; mi++) {
            const m = director.missiles[mi];
            if (t < m.tIgnite) continue;
            const postHit = Math.max(0.0, t - m.tHit);
            if (postHit > 2.45) continue;

            const headT = Math.min(t, m.tHit);
            const trailTimeSpan = 1.55;
            const tailT = Math.max(m.tIgnite, headT - trailTimeSpan - postHit * 0.35);
            if (headT - tailT < 0.03) continue;

            const lingerFade = 1.0 - smoothstep(0.15, 2.35, postHit);
            const loosenWidth = 1.0 + postHit * 0.55;
            const chain = [];
            const S = 18;
            for (let s = 0; s <= S; s++) {
              const frac = s / S;
              const tau = lerp(tailT, headT, frac);
              director.evalMissilePos(pt, m, tau);
              // Slight turbulent drift as wake loosens after detonation
              const drift = postHit * 3.2 * Math.sin(frac * 9.0 + m.seed);
              const hw = lerp(3.4, 1.25, frac) * loosenWidth;
              chain.push([pt[0] + drift, pt[1] + drift * 0.6, pt[2], frac, hw, lingerFade]);
            }
            ribbonBatch.addChain(chain);
          }
          gl.uniform1i(progs.ribbon.u.u_ribbonKind, 3);
          ribbonBatch.flush();
        }
      }

      // --- Sculpted Fleet-Wide Energy Shields (Back-Faces then Front-Faces) ---
      if (shieldQueue.length > 0) {
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.enable(gl.CULL_FACE);
        gl.useProgram(progs.shield.prog);
        gl.uniformMatrix4fv(progs.shield.u.u_viewProj, false, matVP);
        gl.uniform3fv(progs.shield.u.u_camPos, cam.pos);
        gl.uniform1f(progs.shield.u.u_time, t);
        gl.bindVertexArray(shieldGeom.vao);

        for (const faceMode of [gl.FRONT, gl.BACK]) {
          gl.cullFace(faceMode);
          for (let i = 0; i < shieldQueue.length; i++) {
            const sq = shieldQueue[i];
            gl.uniformMatrix4fv(progs.shield.u.u_model, false, sq.model);
            gl.uniform3fv(progs.shield.u.u_halfExtents, sq.halfExtents);
            gl.uniform4f(progs.shield.u.u_shieldState, sq.inflate, sq.waveZ, sq.intensity, sq.seed);
            gl.drawElements(gl.TRIANGLES, shieldGeom.count, gl.UNSIGNED_SHORT, 0);
          }
        }
        gl.bindVertexArray(null);
      }

      // --- Instanced Particles, Shock Rings, Dust Clouds & Space Parallax Motes ---
      gl.disable(gl.CULL_FACE);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(progs.particle.prog);
      gl.uniformMatrix4fv(progs.particle.u.u_viewProj, false, matVP);
      gl.uniform3fv(progs.particle.u.u_camRight, camRight);
      gl.uniform3fv(progs.particle.u.u_camUp, camUp);
      particleBatch.flush();

      // ======================================================================
      // PASS 3: RESOLVE 4x MSAA -> 5-MIP HDR BLOOM -> CHROMA-PRESERVING COMPOSITE
      // ======================================================================
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);

      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msaaFBO);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, resolveFBO);
      gl.blitFramebuffer(0, 0, fbWidth, fbHeight, 0, 0, fbWidth, fbHeight, gl.COLOR_BUFFER_BIT, gl.LINEAR);

      gl.bindVertexArray(emptyVAO);

      // 3A. Prefilter & Downsample Mip Chain (0..4)
      for (let i = 0; i < bloomMips.length; i++) {
        const mip = bloomMips[i];
        gl.bindFramebuffer(gl.FRAMEBUFFER, mip.downFBO);
        gl.viewport(0, 0, mip.w, mip.h);
        if (i === 0) {
          gl.useProgram(progs.bloomPre.prog);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, resolveTex);
          gl.uniform1i(progs.bloomPre.u.u_tex, 0);
          gl.uniform2f(progs.bloomPre.u.u_texelSize, 1.0 / fbWidth, 1.0 / fbHeight);
        } else {
          const prev = bloomMips[i - 1];
          gl.useProgram(progs.bloomDown.prog);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, prev.downTex);
          gl.uniform1i(progs.bloomDown.u.u_tex, 0);
          gl.uniform2f(progs.bloomDown.u.u_texelSize, 1.0 / prev.w, 1.0 / prev.h);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      // 3B. Upsample & Accumulate Mip Chain (4 -> 0)
      gl.useProgram(progs.bloomUp.prog);
      gl.uniform1i(progs.bloomUp.u.u_tex, 0);
      for (let i = bloomMips.length - 1; i >= 0; i--) {
        const dst = bloomMips[i];
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.upFBO);
        gl.viewport(0, 0, dst.w, dst.h);

        // Copy current downTex into upFBO first, then additively upsample deeper mip!
        gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, dst.downTex);
        gl.uniform2f(progs.bloomUp.u.u_texelSize, 0.0, 0.0);
        gl.uniform1f(progs.bloomUp.u.u_weight, 1.0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        if (i < bloomMips.length - 1) {
          const deeper = bloomMips[i + 1];
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE);
          gl.bindTexture(gl.TEXTURE_2D, deeper.upTex);
          gl.uniform2f(progs.bloomUp.u.u_texelSize, 1.0 / deeper.w, 1.0 / deeper.h);
          gl.uniform1f(progs.bloomUp.u.u_weight, 0.72);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
      }
      gl.disable(gl.BLEND);

      // 3C. Final Chroma-Preserving Filmic Composite to Default Framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, fbWidth, fbHeight);
      gl.useProgram(progs.composite.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, resolveTex);
      gl.uniform1i(progs.composite.u.u_sceneTex, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, bloomMips[0].upTex);
      gl.uniform1i(progs.composite.u.u_bloomTex, 1);

      gl.uniform1f(progs.composite.u.u_bloomStrength, 0.19);
      gl.uniform1f(progs.composite.u.u_exposure, 0.96);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }

    // ========================================================================
    // REAL-TIME AUTO-PLAY & DETERMINISTIC window.videoExport INTERFACE
    // ========================================================================
    let exportMode = false;
    let exportFps = 60;
    let exportStartFrame = 0;
    let exportFrameCount = 0;
    let playAnchorWallMs = performance.now();
    let playAnchorSimSec = 0.0;

    global.videoExport = {
      runs: SF.EXPORT_RUNS.map((r) => r.id),

      async begin(runId, opts) {
        const fps = (opts && Number(opts.fps) > 0) ? Number(opts.fps) : 60;
        const run = SF.EXPORT_RUNS.find((r) => r.id === runId) || SF.EXPORT_RUNS[0];
        exportMode = true;
        exportFps = fps;
        exportStartFrame = Math.round(run.start * fps);
        const endFrame = Math.round(run.end * fps);
        exportFrameCount = Math.max(1, endFrame - exportStartFrame);

        renderFrameAtGlobalTime(exportStartFrame / fps);
        gl.finish();
        return { frames: exportFrameCount };
      },

      async frame(i) {
        exportMode = true;
        const idx = Number(i) || 0;
        const globalT = (exportStartFrame + idx) / exportFps;
        renderFrameAtGlobalTime(globalT);
        gl.finish();
      },

      end() {
        exportMode = false;
        playAnchorWallMs = performance.now();
        playAnchorSimSec = lastRenderedTime;
      }
    };

    function tick(nowMs) {
      if (!exportMode) {
        const simT = playAnchorSimSec + (nowMs - playAnchorWallMs) * 0.001;
        renderFrameAtGlobalTime(simT);
      }
      requestAnimationFrame(tick);
    }

    // Render initial t=0 frame immediately, then start continuous loop
    renderFrameAtGlobalTime(0.0);
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})(window);
