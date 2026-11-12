// Main: build world, render loop, renderAt(t), videoExport
(function (global) {
  'use strict';
  const G = global.GL;
  const gl = G.gl;
  const { M4, V3, U, PAL, MODELS, WORLD, TIMELINE, FX } = global;
  const { lerp, clamp, smoothstep, smootherstep, mulberry32 } = U;
  const DUR = WORLD.DUR;

  const canvas = G.canvas;
  const loading = document.getElementById('loading');

  // =============== RESIZE ===============
  let W = 1280, H = 720, DPR = 1;
  function resize() {
    const maxW = Math.min(window.innerWidth || 1600, 3840);
    const maxH = Math.min(window.innerHeight || 900, 2160);
    DPR = (window.devicePixelRatio && window.devicePixelRatio > 1 && maxW < 2400) ? Math.min(window.devicePixelRatio, 1.5) : 1;
    W = Math.floor(maxW * DPR);
    H = Math.floor(maxH * DPR);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    buildFramebuffers();
  }

  // =============== FRAMEBUFFERS ===============
  let sceneFBO, brightFBO, blurA, blurB, blurC, blurD;
  function buildFramebuffers() {
    const w = W, h = H;
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    const qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    sceneFBO = G.createDepthFBO(w, h, G.HDR_FMT, G.HDR_TYPE);
    brightFBO = G.createTexFBO(hw, hh, G.HDR_FMT, G.HDR_TYPE);
    blurA = G.createTexFBO(hw, hh, G.HDR_FMT, G.HDR_TYPE);
    blurB = G.createTexFBO(hw, hh, G.HDR_FMT, G.HDR_TYPE);
    blurC = G.createTexFBO(qw, qh, G.HDR_FMT, G.HDR_TYPE);
    blurD = G.createTexFBO(qw, qh, G.HDR_FMT, G.HDR_TYPE);
  }

  // =============== STATIC BATCHES ===============
  const batches = {}; // name -> voxel batch
  const chunkBatches = []; // asteroid chunks with metadata
  const rockBatches = [];
  const farRockBatches = [];

  function upload(name, voxels) {
    const n = voxels.count();
    const cap = Math.max(n, 1);
    const b = G.createVoxelBatch(cap);
    const data = voxels.pack();
    G.uploadVoxelBatch(b, data, n);
    b.bounds = voxels.bounds();
    batches[name] = b;
    return b;
  }

  let craftMesh = null;
  let escortMesh = null;
  let vanguardMesh = null;
  let flagTurretSites = [];

  function buildWorld() {
    loading.textContent = '正在建造旗舰…';
    const flag = MODELS.buildFlagship();
    upload('flag', flag.voxels);
    flagTurretSites = flag.turretSites || [];

    loading.textContent = '正在建造舰内空间…';
    upload('bridge', WORLD.buildBridge());
    upload('reactor', WORLD.buildReactor());
    upload('hangar', WORLD.buildHangar());
    upload('corridor', WORLD.buildCorridor());

    loading.textContent = '正在集结护卫舰…';
    const fleet = WORLD.buildFleet();
    escortMesh = upload('escort', fleet.escorts[0].voxels);
    vanguardMesh = upload('vanguard', fleet.vanguards[0].voxels);
    craftMesh = upload('craft', fleet.craft.voxels);
    worldFleet = fleet;

    loading.textContent = '正在布置陨石…';
    const field = WORLD.buildAsteroidField();
    for (let i = 0; i < field.targets.length; i++) {
      const tgt = field.targets[i];
      for (let c = 0; c < tgt.chunks.length; c++) {
        const ch = tgt.chunks[c];
        const b = G.createVoxelBatch(Math.max(ch.voxels.count(), 1));
        G.uploadVoxelBatch(b, ch.voxels.pack(), ch.voxels.count());
        chunkBatches.push({ batch: b, target: i, chunk: ch, pos: tgt.pos });
      }
    }
    for (let i = 0; i < field.rocks.length; i++) {
      const rk = field.rocks[i];
      // merge all chunks (no fracture) into one batch at local coords
      const merged = new global.Voxels(1);
      for (let c = 0; c < rk.chunks.length; c++) {
        merged.merge(rk.chunks[c].voxels, rk.chunks[c].center[0], rk.chunks[c].center[1], rk.chunks[c].center[2]);
      }
      const b = G.createVoxelBatch(Math.max(merged.count(), 1));
      G.uploadVoxelBatch(b, merged.pack(), merged.count());
      rockBatches.push({ batch: b, pos: rk.pos, seed: rk.id });
    }
    for (let i = 0; i < field.farRocks.length; i++) {
      const rk = field.farRocks[i];
      const merged = new global.Voxels(1);
      for (let c = 0; c < rk.chunks.length; c++) {
        merged.merge(rk.chunks[c].voxels, rk.chunks[c].center[0], rk.chunks[c].center[1], rk.chunks[c].center[2]);
      }
      const b = G.createVoxelBatch(Math.max(merged.count(), 1));
      G.uploadVoxelBatch(b, merged.pack(), merged.count());
      farRockBatches.push({ batch: b, pos: rk.pos, seed: rk.id });
    }
    worldField = field;
  }

  let worldFleet = null, worldField = null;

  // =============== DYNAMIC MESHES ===============
  let glowMesh = null, pointMesh = null;

  // =============== SHIP TRANSFORMS ===============
  // formation spread before attack + gentle drift
  function formationSpread(t) {
    return smoothstep(48, 56, t) * (1 - smootherstep(63, 72, t));
  }

  function escortWorld(i, t) {
    const p = worldFleet.escortPos[i];
    const spread = formationSpread(t);
    const sgn = p[2] >= 0 ? 1 : -1;
    const drift = Math.sin(t * 0.11 + i * 1.7) * 7;
    const driftY = Math.sin(t * 0.09 + i * 2.3) * 5;
    return {
      pos: [p[0] + drift, p[1] + driftY, p[2] + sgn * spread * 90],
      rot: [p[3] * 0.3 + Math.sin(t * 0.07 + i) * 0.012, p[4] + Math.sin(t * 0.05 + i * 1.3) * 0.02, Math.sin(t * 0.06 + i * 0.9) * 0.012]
    };
  }

  function vanguardWorld(i, t) {
    const p = worldFleet.vanguardPos[i];
    const spread = formationSpread(t);
    const sgn = p[2] >= 0 ? 1 : -1;
    return {
      pos: [p[0] + Math.sin(t * 0.08 + i * 1.1) * 9, p[1] + Math.sin(t * 0.06 + i * 1.9) * 6, p[2] + sgn * spread * 70],
      rot: [p[3] * 0.3, p[4] + Math.sin(t * 0.05 + i * 0.8) * 0.018, Math.sin(t * 0.07 + i * 1.4) * 0.01]
    };
  }

  // =============== LIGHTS ===============
  const SUN_DIR = V3.norm([-0.55, 0.38, 0.74]); // toward sun
  function computeLights(t, camPos) {
    const sun = [1.05, 0.95, 0.82];
    const ambSky = [0.14, 0.17, 0.25];
    const ambGround = [0.05, 0.06, 0.10];
    const points = [];
    // engine glow at flagship stern
    points.push({ pos: [-620, 0, 0], color: [1.0, 0.45, 0.18], radius: 420 });
    // main beam event light
    const beamPow = (t > 56.5 && t < 63.4) ? 1 : 0;
    if (beamPow) {
      points.push({ pos: [1300, 40, -260], color: [1.6, 1.0, 0.55], radius: 1400 });
      points.push({ pos: [2100, 120, -520], color: [1.8, 1.1, 0.6], radius: 700 });
    }
    // missile / hit flashes
    const dt0 = t - 68.5;
    if (dt0 > 0 && dt0 < 4) {
      const a = Math.exp(-dt0 * 1.1);
      points.push({ pos: [2350, -80, 260], color: [1.7 * a, 1.0 * a, 0.55 * a], radius: 900 });
    }
    const dt1 = t - 70.2;
    if (dt1 > 0 && dt1 < 4) {
      const a = Math.exp(-dt1 * 1.1);
      points.push({ pos: [2550, 180, -180], color: [1.7 * a, 1.0 * a, 0.55 * a], radius: 900 });
    }
    // interior lights
    if (t >= 35 && t < 42.5) {
      points.push({ pos: [437, 85, 0], color: [0.5, 0.85, 1.1], radius: 160 });
      points.push({ pos: [500, 70, 0], color: [0.35, 0.55, 0.8], radius: 140 });
    }
    if (t >= 42.5 && t < 50) {
      points.push({ pos: [70, 0, 0], color: [0.65, 1.15, 1.35], radius: 320 });
      points.push({ pos: [70, 80, 0], color: [0.35, 0.7, 0.95], radius: 260 });
    }
    if (t >= 50 && t < 56) {
      points.push({ pos: [-440, -60, 0], color: [0.55, 1.0, 1.2], radius: 220 });
      points.push({ pos: [-250, -55, 0], color: [0.3, 0.6, 0.8], radius: 200 });
    }
    if (t >= 26 && t < 35) {
      points.push({ pos: [-235, -5, 100], color: [0.45, 0.85, 1.05], radius: 200 });
    }
    // shield ambient tint
    const sh = WORLD.shieldState(t, 0, 1);
    if (sh.alpha > 0.02) {
      points.push({ pos: [0, 60, 0], color: [0.35 * sh.alpha, 0.6 * sh.alpha, 1.0 * sh.alpha], radius: 900 });
    }
    return { sun, ambSky, ambGround, points: points.slice(0, 6) };
  }

  // =============== VOXEL DRAW ===============
  function setVoxelUniforms(prog, view, proj, camPos, lights) {
    const u = prog.u;
    gl.uniformMatrix4fv(u.uProj, false, proj);
    gl.uniformMatrix4fv(u.uView, false, view);
    gl.uniform3fv(u.uCamPos, camPos);
    gl.uniform3fv(u.uSunDir, SUN_DIR);
    gl.uniform3fv(u.uSunColor, lights.sun);
    gl.uniform3fv(u.uAmbSky, lights.ambSky);
    gl.uniform3fv(u.uAmbGround, lights.ambGround);
    const n = lights.points.length;
    gl.uniform1i(u.uPointCount, n);
    if (n > 0) {
      const pp = new Float32Array(18), pc = new Float32Array(18), pr = new Float32Array(6);
      for (let i = 0; i < n; i++) {
        pp[i * 3] = lights.points[i].pos[0]; pp[i * 3 + 1] = lights.points[i].pos[1]; pp[i * 3 + 2] = lights.points[i].pos[2];
        pc[i * 3] = lights.points[i].color[0]; pc[i * 3 + 1] = lights.points[i].color[1]; pc[i * 3 + 2] = lights.points[i].color[2];
        pr[i] = lights.points[i].radius;
      }
      gl.uniform3fv(u.uPointPos, pp);
      gl.uniform3fv(u.uPointColor, pc);
      gl.uniform1fv(u.uPointRadius, pr);
    }
    gl.uniform1f(u.uFogDensity, 0.00012);
    gl.uniform3f(u.uFogColor, 0.035, 0.05, 0.09);
    gl.uniform1f(u.uEmissiveBoost, 1.35);
  }

  function drawBatch(batch, model) {
    if (!batch || batch.count <= 0) return;
    gl.uniformMatrix4fv(G.voxelProg.u.uModel, false, model);
    G.drawVoxelBatch(batch);
  }

  // =============== RENDER ONE FRAME ===============
  const IDENT = M4.identity();
  let flashes = [];

  function renderAt(t) {
    t = ((t % DUR) + DUR) % DUR;
    flashes = [];
    global.__flashes = flashes;

    const cam = TIMELINE.cameraAt(t);
    const camPos = cam.pos;
    const aspect = W / H;
    const fovR = cam.fov * Math.PI / 180;
    const proj = M4.perspective(fovR, aspect, 1.5, 36000);
    const view = M4.lookAt(camPos, cam.look, [0, 1, 0]);
    const lights = computeLights(t, camPos);

    // interior mode: hide flagship hull
    const interiorMode = (t >= 34.9 && t < 56.15);

    // ---- pass 1: scene HDR ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO.fbo);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.01, 0.015, 0.03, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // sky
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(G.skyProg.prog);
    // inv view-proj
    const vp = M4.mul(proj, view);
    const invVP = M4.invert(vp);
    gl.uniformMatrix4fv(G.skyProg.u.uInvViewProj, false, invVP);
    gl.uniform3fv(G.skyProg.u.uCamPos, camPos);
    gl.uniform1f(G.skyProg.u.uTime, t);
    gl.bindVertexArray(G.fsVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    // opaque voxels
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.useProgram(G.voxelProg.prog);
    setVoxelUniforms(G.voxelProg, view, proj, camPos, lights);

    // flagship + interiors
    if (!interiorMode) drawBatch(batches.flag, IDENT);
    drawBatch(batches.bridge, IDENT);
    drawBatch(batches.reactor, IDENT);
    drawBatch(batches.hangar, IDENT);
    drawBatch(batches.corridor, IDENT);

    // escorts
    for (let i = 0; i < worldFleet.escortPos.length; i++) {
      const w = escortWorld(i, t);
      const m = M4.trs(w.pos, w.rot, [1, 1, 1]);
      drawBatch(escortMesh, m);
    }
    // vanguards
    for (let i = 0; i < worldFleet.vanguardPos.length; i++) {
      const w = vanguardWorld(i, t);
      const m = M4.trs(w.pos, w.rot, [1, 1, 1]);
      drawBatch(vanguardMesh, m);
    }
    // small craft
    for (let i = 0; i < 6; i++) {
      const cs = WORLD.craftState(t, i);
      const m = M4.trs(cs.pos, cs.rot, [1, 1, 1]);
      drawBatch(craftMesh, m);
    }

    // asteroid target chunks (fracture)
    for (let i = 0; i < chunkBatches.length; i++) {
      const cb = chunkBatches[i];
      const tr = WORLD.chunkTransform(cb.target, cb.chunk, t);
      const pos = [cb.pos[0] + tr.pos[0], cb.pos[1] + tr.pos[1], cb.pos[2] + tr.pos[2]];
      const m = M4.trs(pos, tr.rot, [1, 1, 1]);
      drawBatch(cb.batch, m);
    }
    // rocks + far rocks (gentle drift)
    for (let i = 0; i < rockBatches.length; i++) {
      const rb = rockBatches[i];
      const pos = [rb.pos[0] + Math.sin(t * 0.05 + i) * 4, rb.pos[1] + Math.sin(t * 0.04 + i * 2) * 4, rb.pos[2]];
      const m = M4.trs(pos, [0, 0, 0], [1, 1, 1]);
      drawBatch(rb.batch, m);
    }
    for (let i = 0; i < farRockBatches.length; i++) {
      const rb = farRockBatches[i];
      const m = M4.trs(rb.pos, [0, 0, 0], [1, 1, 1]);
      drawBatch(rb.batch, m);
    }

    // ---- pass 2: glow effects ----
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // additive

    // build dynamic geometry
    const B = new FX.Builder(28000);
    B.reset();

    // engine flames: flagship
    const thrust = WORLD.thrustAt(t);
    const flagNozzles = [
      { pos: [-525, 0, 0], dir: [-1, 0, 0], r: 34, len: 210 },
      { pos: [-525, 52, 0], dir: [-1, 0, 0], r: 23, len: 170 },
      { pos: [-525, -52, 0], dir: [-1, 0, 0], r: 23, len: 170 },
      { pos: [-525, 24, -66], dir: [-1, 0, 0], r: 21, len: 160 },
      { pos: [-525, 24, 66], dir: [-1, 0, 0], r: 21, len: 160 },
      { pos: [-525, -36, -70], dir: [-1, 0, 0], r: 18, len: 145 },
      { pos: [-525, -36, 70], dir: [-1, 0, 0], r: 18, len: 145 }
    ];
    if (!interiorMode) {
      FX.engineFlames(B, { nozzles: flagNozzles, seed: 1 }, t);
      // escort flames
      for (let i = 0; i < worldFleet.escortPos.length; i++) {
        const w = escortWorld(i, t);
        const noz = [
          { pos: V3.add(w.pos, [-108, 0, 0]), dir: [-1, 0, 0], r: 12, len: 85 },
          { pos: V3.add(w.pos, [-104, -14, -18]), dir: [-1, 0, 0], r: 8, len: 70 },
          { pos: V3.add(w.pos, [-104, -14, 18]), dir: [-1, 0, 0], r: 8, len: 70 }
        ];
        FX.engineFlames(B, { nozzles: noz, seed: i }, t);
      }
      // vanguard flames
      for (let i = 0; i < worldFleet.vanguardPos.length; i++) {
        const w = vanguardWorld(i, t);
        const noz = [
          { pos: V3.add(w.pos, [-98, 0, 0]), dir: [-1, 0, 0], r: 11, len: 78 },
          { pos: V3.add(w.pos, [-95, -14, -18]), dir: [-1, 0, 0], r: 7, len: 62 },
          { pos: V3.add(w.pos, [-95, -14, 18]), dir: [-1, 0, 0], r: 7, len: 62 }
        ];
        FX.engineFlames(B, { nozzles: noz, seed: i }, t);
      }
    }
    // craft flames
    for (let i = 0; i < 6; i++) {
      const cs = WORLD.craftState(t, i);
      const noz = [
        { pos: V3.add(cs.pos, [-14, 0, -3]), dir: [-1, 0, 0], r: 2.6, len: 22 },
        { pos: V3.add(cs.pos, [-14, 0, 3]), dir: [-1, 0, 0], r: 2.6, len: 22 }
      ];
      FX.engineFlames(B, { nozzles: noz, seed: i }, t);
    }

    // main beam
    if (!interiorMode) {
      const muzzle = [533, -22, 0];
      const target = [2100, 120, -520];
      const out = {};
      FX.mainBeam(B, t, muzzle, target, out);
      if (out.flash) flashes.push({ pos: out.flash.pos, power: out.flash.power, size: 80 * out.flash.power });
    }

    // pulses
    if (!interiorMode) FX.pulseShots(B, t, flashes);

    // CIWS
    if (!interiorMode) FX.ciwsStreams(B, t);

    // missiles
    if (!interiorMode) FX.missiles(B, t, flashes);

    // hit glows
    if (!interiorMode) FX.hitGlows(B, t);

    // interior dynamic glows
    FX.interiorMotion(B, t);

    // shields
    {
      const allShips = [[0, 0, 0]];
      for (let i = 0; i < worldFleet.escortPos.length; i++) allShips.push(escortWorld(i, t).pos);
      for (let i = 0; i < worldFleet.vanguardPos.length; i++) allShips.push(vanguardWorld(i, t).pos);
      const radii = [640];
      for (let i = 0; i < 12; i++) radii.push(160);
      for (let i = 0; i < 12; i++) radii.push(145);
      for (let i = 0; i < allShips.length; i++) {
        const s = WORLD.shieldState(t, i, allShips.length);
        if (s.alpha <= 0.01) continue;
        FX.shieldShell(B, allShips[i], radii[i] || 150, s.alpha, s.expand, PAL.shield, t, i * 1.3, camPos);
      }
    }

    // upload glow
    if (glowMesh && B.count > 0) {
      gl.useProgram(G.glowProg.prog);
      gl.uniformMatrix4fv(G.glowProg.u.uProj, false, proj);
      gl.uniformMatrix4fv(G.glowProg.u.uView, false, view);
      gl.uniform3fv(G.glowProg.u.uCamPos, camPos);
      gl.uniform1f(G.glowProg.u.uGlobalAlpha, 1.0);
      gl.bindVertexArray(glowMesh.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, glowMesh.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, B.data, 0, B.count * 11);
      gl.drawArrays(gl.TRIANGLES, 0, B.count);
      gl.bindVertexArray(null);
    }

    // points
    if (pointMesh) {
      const P = pointMesh;
      FX.fillPoints(P, t, camPos);
      if (P.count > 0) {
        gl.useProgram(G.pointProg.prog);
        gl.uniformMatrix4fv(G.pointProg.u.uProj, false, proj);
        gl.uniformMatrix4fv(G.pointProg.u.uView, false, view);
        gl.uniform1f(G.pointProg.u.uPixelRatio, DPR);
        gl.bindVertexArray(P.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, P.vbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, P.data, 0, P.count * 8);
        gl.drawArrays(gl.POINTS, 0, P.count);
        gl.bindVertexArray(null);
      }
    }

    gl.disable(gl.BLEND);
    gl.depthMask(true);

    // ---- bloom ----
    // bright pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, brightFBO.fbo);
    gl.viewport(0, 0, brightFBO.w, brightFBO.h);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(G.brightProg.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneFBO.tex);
    gl.uniform1i(G.brightProg.u.uTex, 0);
    gl.uniform1f(G.brightProg.u.uThreshold, 0.55);
    gl.bindVertexArray(G.fsVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // blur half res (2 passes)
    gl.useProgram(G.blurProg.prog);
    gl.uniform1i(G.blurProg.u.uTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurA.fbo);
    gl.viewport(0, 0, blurA.w, blurA.h);
    gl.bindTexture(gl.TEXTURE_2D, brightFBO.tex);
    gl.uniform2f(G.blurProg.u.uDir, 1.4 / blurA.w, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurB.fbo);
    gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
    gl.uniform2f(G.blurProg.u.uDir, 0, 1.4 / blurA.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // downsample to quarter + blur (wide glow)
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurC.fbo);
    gl.viewport(0, 0, blurC.w, blurC.h);
    gl.bindTexture(gl.TEXTURE_2D, blurB.tex);
    gl.uniform2f(G.blurProg.u.uDir, 2.0 / blurC.w, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurD.fbo);
    gl.bindTexture(gl.TEXTURE_2D, blurC.tex);
    gl.uniform2f(G.blurProg.u.uDir, 0, 2.0 / blurC.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(G.compositeProg.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneFBO.tex);
    gl.uniform1i(G.compositeProg.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blurB.tex);
    gl.uniform1i(G.compositeProg.u.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, blurD.tex);
    gl.uniform1i(G.compositeProg.u.uBloom2, 2);
    gl.uniform1f(G.compositeProg.u.uBloomStrength, 0.85);
    gl.uniform1f(G.compositeProg.u.uExposure, 0.92);
    gl.uniform1f(G.compositeProg.u.uTime, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  }

  // =============== AUTO LOOP ===============
  let startMs = 0;
  let playing = true;

  function loop(now) {
    if (!TIMELINE.isExporting() && playing && !global.__noLoop) {
      const t = ((now - startMs) / 1000) % DUR;
      renderAt(t);
    }
    requestAnimationFrame(loop);
  }

  // =============== BOOT ===============
  function boot() {
    resize();
    window.addEventListener('resize', resize);
    glowMesh = G.createDynMesh(28000);
    pointMesh = G.createPointMesh(8000);
    buildWorld();
    TIMELINE.installExport(renderAt, function () {
      startMs = performance.now() - (TIMELINE.exportTime() * 1000);
      playing = true;
    });
    loading.style.display = 'none';
    startMs = performance.now();
    // render one frame immediately
    renderAt(0);
    // debug: #<t> freezes at that time
    const hashT = parseFloat((location.hash || '').slice(1));
    if (!isNaN(hashT)) {
      global.__noLoop = true;
      renderAt(hashT);
    }
    requestAnimationFrame(loop);
    global.__ready = true;
    global.__dbg = function () {
      const counts = {};
      for (const k in batches) counts[k] = batches[k].count;
      return {
        counts,
        chunks: chunkBatches.length,
        rocks: rockBatches.length,
        flag: batches.flag ? batches.flag.count : -1
      };
    };
  }

  // error surface
  window.addEventListener('error', function (e) {
    console.error(e.message);
    if (loading) loading.textContent = '出错: ' + e.message;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
