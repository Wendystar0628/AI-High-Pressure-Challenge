'use strict';
// ---------------------------------------------------------------------------
// Render orchestration, auto-play loop and the videoExport interface.
// ---------------------------------------------------------------------------
const ENV = {
  sunDir: V.norm([-0.56, 0.44, 0.70]),
  sunCol: [2.25, 1.98, 1.66],
  ambUp: [0.050, 0.050, 0.090], ambDown: [0.022, 0.018, 0.028],
  fillDir: V.norm([0.6, -0.25, -0.5]), fillCol: [0.045, 0.085, 0.16],
  planetDir: V.norm([0.62, -0.30, 0.72]),
};
const SCENE_ENV = {
  ext: { exposure: 0.95, fog: [0.010, 0.010, 0.020, 1 / 16000], bloom: 0.016, vignette: 0.55 },
  bridge: { exposure: 1.15, fog: [0.010, 0.010, 0.020, 1 / 16000], bloom: 0.018, vignette: 0.6 },
  core: { exposure: 1.0, fog: [0.006, 0.007, 0.010, 1 / 2200], bloom: 0.02, vignette: 0.6 },
  corridor: { exposure: 1.0, fog: [0.006, 0.007, 0.010, 1 / 2000], bloom: 0.02, vignette: 0.6 },
};

const RENDER = {};
RENDER.frame = function (fr) {
  const gl = R.gl; const W_ = R.W, H_ = R.H; const cam = fr.cam;
  const env = SCENE_ENV[fr.scene] || SCENE_ENV.ext;
  const interior = fr.scene === 'core' || fr.scene === 'corridor';
  const near = cam.near || 1, far = interior ? 4000 : 60000;
  const aspect = W_ / H_;
  const fwd = V.norm(V.sub(cam.target, cam.pos));
  const up = Q.rot(Q.axis(fwd, cam.roll || 0), [0, 1, 0]);
  const view = M.lookAt(cam.pos, cam.target, up);
  const proj = M.persp(cam.fov * Math.PI / 180, aspect, near, far);
  const vp = M.mul(proj, view);
  const planes = R.frustumPlanes(vp);
  const right = [view[0], view[4], view[8]], camUp = [view[1], view[5], view[9]];
  R.stats.draws = 0; R.stats.tris = 0;

  // ---------------- shadows
  if (fr.shadow) RENDER.shadows(fr, cam, fwd);

  // ---------------- main HDR pass
  gl.bindFramebuffer(gl.FRAMEBUFFER, R.rt.msFbo);
  gl.viewport(0, 0, W_, H_);
  gl.clearColor(0, 0, 0, 1); gl.clearDepth(1);
  gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  if (fr.sky) {
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    const p = R.progs.sky; gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.loc.uInvVP, false, M.invert(M.mul(proj, M.lookAt([0, 0, 0], fwd, up))));
    gl.uniform3fv(p.loc.uSunDir, ENV.sunDir); gl.uniform3fv(p.loc.uPlanetDir, ENV.planetDir);
    gl.uniform1f(p.loc.uTime, fr.t); gl.uniform1f(p.loc.uExposureSky, 1.0);
    gl.bindVertexArray(R.emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    // stars
    const s = R.progs.star; gl.useProgram(s.p);
    const vr = M.lookAt([0, 0, 0], fwd, up);
    gl.uniformMatrix4fv(s.loc.uVPRot, false, M.mul(proj, vr)); gl.uniform1f(s.loc.uPx, Math.max(1, H_ / 1080));
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(A.stars.vao); gl.drawArrays(gl.POINTS, 0, A.stars.n);
    gl.disable(gl.BLEND);
  }
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
  // voxel opaque
  const vprog = R.progs.voxel;
  RENDER.voxelGlobals(vprog, fr, vp, cam, env, interior);
  for (const d of fr.draws) RENDER.drawModel(vprog, d, d.model.opaque, planes);
  // instanced
  if (fr.inst.length) {
    const ip = R.progs.voxelI; RENDER.voxelGlobals(ip, fr, vp, cam, env, interior);
    RENDER.perDraw(ip, { M: M.ident(), u: { thrust: 1, charge: [0, 0], flash: 0, pulse: 1, heat: [0, 0, 14, 0], shield: [0, 0, 0, 0], sunAmt: interior ? 0 : 1, ambAmt: interior ? 0.4 : 1, emitMul: 1, chase: 0.641 } });
    for (const it of fr.inst) {
      gl.uniform3fv(ip.loc.uInstC, it.mesh.instC);
      gl.bindVertexArray(it.mesh.vao); gl.bindBuffer(gl.ARRAY_BUFFER, it.mesh.ib);
      const n = Math.min(it.count, it.mesh.icap);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, it.data, 0, n * 12);
      gl.drawElementsInstanced(gl.TRIANGLES, it.mesh.count, gl.UNSIGNED_INT, 0, n);
      R.stats.draws++;
    }
  }
  // transparent voxels
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  gl.useProgram(vprog.p); gl.uniform1f(vprog.loc.uAlphaPass, 1);
  for (const d of fr.draws) if (d.model.trans.length) RENDER.drawModel(vprog, d, d.model.trans, planes);
  gl.uniform1f(vprog.loc.uAlphaPass, 0);
  // additive effects
  gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.CULL_FACE);
  if (fr.shields.length) {
    const sp = R.progs.shield; gl.useProgram(sp.p);
    gl.uniformMatrix4fv(sp.loc.uVP, false, vp); gl.uniform3fv(sp.loc.uCamPos, cam.pos); gl.uniform1f(sp.loc.uTime, fr.t);
    gl.uniform3fv(sp.loc.uCol, SHIELD_COL);
    gl.bindVertexArray(R.sphVAO);
    for (const s of fr.shields) {
      if (s.state[3] <= 0.001) continue;
      const rr = Math.max(s.radii[0], s.radii[1], s.radii[2]);
      if (!R.sphereVisible(planes, [s.M[12], s.M[13], s.M[14]], rr * 1.1)) continue;
      gl.uniformMatrix4fv(sp.loc.uModel, false, s.M); gl.uniform3fv(sp.loc.uRadii, s.radii); gl.uniform1f(sp.loc.uExpand, s.expand);
      gl.uniform4fv(sp.loc.uState, s.state); gl.uniform4fv(sp.loc.uRipple, s.ripple); gl.uniform1f(sp.loc.uSeed, s.seed);
      gl.drawElements(gl.TRIANGLES, R.sphCount, gl.UNSIGNED_SHORT, 0);
    }
  }
  if (RIB.n) {
    const rp = R.progs.ribbon; gl.useProgram(rp.p);
    gl.uniformMatrix4fv(rp.loc.uVP, false, vp); gl.uniform1f(rp.loc.uTime, fr.t);
    gl.bindVertexArray(R.ribVAO); gl.bindBuffer(gl.ARRAY_BUFFER, R.ribBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, R.ribData, 0, RIB.n * 9);
    gl.drawArrays(gl.TRIANGLES, 0, RIB.n);
  }
  if (FX.n) {
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const fp = R.progs.fx; gl.useProgram(fp.p);
    gl.uniformMatrix4fv(fp.loc.uVP, false, vp); gl.uniform3fv(fp.loc.uCamPos, cam.pos);
    gl.uniform3fv(fp.loc.uCamRight, right); gl.uniform3fv(fp.loc.uCamUp, camUp); gl.uniform1f(fp.loc.uTime, fr.t);
    gl.bindVertexArray(R.fxVAO); gl.bindBuffer(gl.ARRAY_BUFFER, R.fxBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, R.fxData, 0, FX.n * 16);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, FX.n);
  }
  gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
  gl.bindVertexArray(null);

  // ---------------- resolve + bloom + composite
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, R.rt.msFbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, R.rt.sceneFbo);
  gl.blitFramebuffer(0, 0, W_, H_, 0, 0, W_, H_, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  gl.disable(gl.DEPTH_TEST);
  const bl = R.rt.bloom;
  const dp = R.progs.down; gl.useProgram(dp.p); gl.bindVertexArray(R.emptyVAO);
  let src = R.rt.scene, sw = W_, sh = H_;
  for (let i = 0; i < bl.length; i++) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, bl[i].f); gl.viewport(0, 0, bl[i].w, bl[i].h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(dp.loc.uTex, 0);
    gl.uniform2f(dp.loc.uTexel, 1 / sw, 1 / sh); gl.uniform1f(dp.loc.uFirst, i === 0 ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    src = bl[i].t; sw = bl[i].w; sh = bl[i].h;
  }
  const upP = R.progs.up; gl.useProgram(upP.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = bl.length - 1; i > 0; i--) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, bl[i - 1].f); gl.viewport(0, 0, bl[i - 1].w, bl[i - 1].h);
    gl.bindTexture(gl.TEXTURE_2D, bl[i].t); gl.uniform1i(upP.loc.uTex, 0);
    gl.uniform2f(upP.loc.uTexel, 1 / bl[i].w, 1 / bl[i].h); gl.uniform1f(upP.loc.uW, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W_, H_);
  const cp = R.progs.comp; gl.useProgram(cp.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.rt.scene); gl.uniform1i(cp.loc.uScene, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bl[0].t); gl.uniform1i(cp.loc.uBloom, 1);
  gl.uniform1f(cp.loc.uExposure, env.exposure); gl.uniform1f(cp.loc.uBloomAmt, env.bloom);
  gl.uniform2f(cp.loc.uRes, W_, H_); gl.uniform4f(cp.loc.uGrade, env.vignette, 0, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.activeTexture(gl.TEXTURE0);
};

RENDER.voxelGlobals = function (p, fr, vp, cam, env, interior) {
  const gl = R.gl; gl.useProgram(p.p); const l = p.loc;
  gl.uniformMatrix4fv(l.uVP, false, vp); gl.uniform3fv(l.uCamPos, cam.pos);
  gl.uniform4fv(l.uMatA, R.mats.A); gl.uniform4fv(l.uMatE, R.mats.E); gl.uniform4fv(l.uMatP, R.mats.P);
  gl.uniform3fv(l.uSunDir, ENV.sunDir); gl.uniform3fv(l.uSunCol, ENV.sunCol);
  gl.uniform3fv(l.uAmbUp, interior ? [0.03, 0.028, 0.027] : ENV.ambUp); gl.uniform3fv(l.uAmbDown, interior ? [0.014, 0.012, 0.011] : ENV.ambDown);
  gl.uniform3fv(l.uFillDir, ENV.fillDir); gl.uniform3fv(l.uFillCol, interior ? [0.01, 0.03, 0.04] : ENV.fillCol);
  gl.uniform1f(l.uTime, fr.t); gl.uniform4fv(l.uFog, env.fog); gl.uniform1f(l.uAlphaPass, 0);
  gl.uniform3fv(l.uShieldCol, SHIELD_COL);
  const n = fr.lights.length; const lp = new Float32Array(160), lc = new Float32Array(160);
  fr.lights.forEach((L, i) => { lp.set([L.p[0], L.p[1], L.p[2], L.rad], i * 4); lc.set([L.col[0], L.col[1], L.col[2], 0], i * 4); });
  gl.uniform4fv(l.uLights, lp); gl.uniform4fv(l.uLightC, lc); gl.uniform1i(l.uNumLights, n);
  if (fr.beam) { gl.uniform3fv(l.uBeamA, fr.beam.a); gl.uniform3fv(l.uBeamB, fr.beam.b); gl.uniform4f(l.uBeamC, fr.beam.c[0], fr.beam.c[1], fr.beam.c[2], fr.beam.r); }
  else gl.uniform4f(l.uBeamC, 0, 0, 0, 0);
  gl.uniform1f(l.uShadowOn, fr.shadow ? 1 : 0);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, R.shadow[0].t); gl.uniform1i(l.uShadow0, 2);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, R.shadow[1].t); gl.uniform1i(l.uShadow1, 3);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniformMatrix4fv(l.uShadowM0, false, R.shadow[0].m); gl.uniformMatrix4fv(l.uShadowM1, false, R.shadow[1].m);
};

const NOHITS = new Float32Array(16);
RENDER.perDraw = function (p, d) {
  const gl = R.gl, l = p.loc, u = d.u;
  gl.uniformMatrix4fv(l.uModel, false, d.M);
  gl.uniform1f(l.uThrust, u.thrust); gl.uniform2fv(l.uCharge, u.charge); gl.uniform1f(l.uFlash, u.flash); gl.uniform1f(l.uPulse, u.pulse);
  gl.uniform4fv(l.uChargeAxis, u.chargeAxis || [0, 1, 1, 0]);
  gl.uniform4fv(l.uHits, u.hits || NOHITS); gl.uniform4fv(l.uHeat, u.heat); gl.uniform4fv(l.uShield, u.shield);
  gl.uniform1f(l.uSunAmt, u.sunAmt); gl.uniform1f(l.uAmbAmt, u.ambAmt); gl.uniform1f(l.uEmitMul, u.emitMul); gl.uniform1f(l.uChaseSpeed, u.chase);
};

RENDER.drawModel = function (p, d, meshes, planes) {
  if (!meshes || !meshes.length) return;
  const gl = R.gl; const Mm = d.M;
  // whole-model cull
  const mc = M.xform(Mm, V.scale(V.add(d.model.min, d.model.max), 0.5)); const mr = V.dist(d.model.min, d.model.max) * 0.5;
  if (!R.sphereVisible(planes, mc, mr)) return;
  let set = false;
  for (const m of meshes) {
    if (d.sections && meshes.length > 1) { const c = M.xform(Mm, m.center); if (!R.sphereVisible(planes, c, m.radius)) continue; }
    if (!set) { RENDER.perDraw(p, d); set = true; }
    gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
    R.stats.draws++; R.stats.tris += m.count / 3;
  }
};

RENDER.shadows = function (fr, cam, fwd) {
  const gl = R.gl; const L = ENV.sunDir;
  const casc = [
    { c: V.madd(cam.pos, fwd, 160), r: 260 },
    { c: V.madd(cam.pos, fwd, 1500), r: 2400 },
  ];
  const sp = R.progs.shadow, spi = R.progs.shadowI;
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
  gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2.0);
  casc.forEach((cs, ci) => {
    const S = R.shadowSize; const r = cs.r;
    const lv0 = M.lookAt([0, 0, 0], V.neg(L), [0, 1, 0]);
    // snap center to texel grid in light space
    const lc = M.xform(lv0, cs.c); const tx = (2 * r) / S;
    lc[0] = Math.round(lc[0] / tx) * tx; lc[1] = Math.round(lc[1] / tx) * tx;
    const inv = M.invert(lv0); const c = M.xform(inv, lc);
    const view = M.lookAt(V.madd(c, L, 5000), c, [0, 1, 0]);
    const proj = M.ortho(-r, r, -r, r, 1, 10000);
    const vp = M.mul(proj, view);
    R.shadow[ci].m = vp;
    const planes = R.frustumPlanes(vp);
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.shadow[ci].f); gl.viewport(0, 0, S, S);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(sp.p); gl.uniformMatrix4fv(sp.loc.uVP, false, vp);
    for (const d of fr.draws) {
      if (d.cast === false) continue;
      const mc = M.xform(d.M, V.scale(V.add(d.model.min, d.model.max), 0.5)); const mr = V.dist(d.model.min, d.model.max) * 0.5;
      if (!R.sphereVisible(planes, mc, mr)) continue;
      // tiny far objects do not need to cast into the wide cascade
      if (ci === 1 && mr < 6) continue;
      let set = false;
      for (const m of d.model.opaque) {
        if (d.model.opaque.length > 1) { const c2 = M.xform(d.M, m.center); if (!R.sphereVisible(planes, c2, m.radius)) continue; }
        if (!set) { gl.uniformMatrix4fv(sp.loc.uModel, false, d.M); set = true; }
        gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
      }
    }
    if (ci === 0 && fr.inst.length) {
      gl.useProgram(spi.p); gl.uniformMatrix4fv(spi.loc.uVP, false, vp);
      for (const it of fr.inst) {
        gl.uniform3fv(spi.loc.uInstC, it.mesh.instC);
        gl.bindVertexArray(it.mesh.vao); gl.bindBuffer(gl.ARRAY_BUFFER, it.mesh.ib);
        const n = Math.min(it.count, it.mesh.icap);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, it.data, 0, n * 12);
        gl.drawElementsInstanced(gl.TRIANGLES, it.mesh.count, gl.UNSIGNED_INT, 0, n);
      }
    }
  });
  gl.disable(gl.POLYGON_OFFSET_FILL); gl.cullFace(gl.BACK);
  gl.bindVertexArray(null);
};

// ---------------------------------------------------------------------------
const APP = { ready: false, exporting: false, start: 0, lastT: 0 };
let readyResolve; const readyP = new Promise((r) => { readyResolve = r; });

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  let w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
  const s = Math.min(1, 3840 / w, 2160 / h); w = Math.max(16, Math.round(w * s)); h = Math.max(16, Math.round(h * s));
  R.resize(w, h);
}

function renderAt(t) {
  fitCanvas();
  const fr = FR.build(t);
  RENDER.frame(fr);
  APP.lastT = t;
}

function loop() {
  if (APP.ready && !APP.exporting) {
    const t = ((performance.now() - APP.start) / 1000) % TL.T;
    renderAt(t);
  }
  requestAnimationFrame(loop);
}

async function boot() {
  const canvas = document.getElementById('c');
  const bar = document.getElementById('bar');
  R.init(canvas);
  fitCanvas();
  await A.build((f) => { if (bar) bar.style.width = (f * 100).toFixed(1) + '%'; });
  W.init(); FR.init(); CAM.init();
  // warm up shaders / buffers
  renderAt(0);
  const ld = document.getElementById('load'); if (ld) ld.remove();
  APP.ready = true; APP.start = performance.now();
  readyResolve();
  requestAnimationFrame(loop);
}

const nextFrame = () => new Promise((res) => { let done = false; const f = () => { if (!done) { done = true; res(); } }; requestAnimationFrame(() => requestAnimationFrame(f)); setTimeout(f, 120); });

window.videoExport = {
  runs: ['tour'],
  _fps: 60,
  async begin(runId, opts) {
    await readyP;
    APP.exporting = true;
    this._fps = (opts && opts.fps) || 60;
    return { frames: Math.round(TL.T * this._fps) };
  },
  async frame(i) {
    await readyP;
    APP.exporting = true;
    const t = Math.min(TL.T - 1e-6, i / this._fps);
    renderAt(t);
    R.gl.finish();
    await nextFrame();
  },
  end() {
    APP.exporting = false;
    APP.start = performance.now() - APP.lastT * 1000;
  },
};
window.__debug = { renderAt, TL, CAM, W, FR, R, A };

window.addEventListener('load', () => { boot().catch((e) => { console.error(e); const ld = document.getElementById('load'); if (ld) ld.textContent = 'Error: ' + e.message; }); });
