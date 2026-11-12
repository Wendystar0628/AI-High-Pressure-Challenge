'use strict';
// ============ 三维渲染：PBR 材质、自生成环境、阴影、粒子、拖尾、景深 ============
const Render3D = {
  envKey: '', SHADOW: 2048,
  // ---------- 资源 ----------
  meshVAO(m) {
    const gl = GLX.gl;
    if (m._gpu && m._gpu.gen === GLX.ctxGen) { m._gpu.used = GLX.frame; return m._gpu; }
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, m.pos, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, m.nrm, gl.STATIC_DRAW); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    let cb = null; if (m.col) { cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, m.col, gl.STATIC_DRAW); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0); } else { gl.disableVertexAttribArray(2); gl.vertexAttrib4f(2, 1, 1, 1, 1); }
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    m._gpu = { vao, bufs: [pb, nb, cb, ib], n: m.idx.length, used: GLX.frame, gen: GLX.ctxGen };
    (this.live || (this.live = [])).push(m);
    if (this.live.length > 64) this.gcMeshes();
    return m._gpu;
  },
  gcMeshes() {
    const gl = GLX.gl; const keep = [];
    for (const m of this.live) { if (m._gpu && GLX.frame - m._gpu.used > 3) { m._gpu.bufs.forEach(b => b && gl.deleteBuffer(b)); gl.deleteVertexArray(m._gpu.vao); m._gpu = null; } else keep.push(m); }
    this.live = keep;
  },
  // 环境立方体贴图（程序生成）
  env(comp) {
    const gl = GLX.gl; const e = comp.env || { preset: 'forge', intensity: 1, rotation: 0 };
    if (this.envTex && this.envKey === e.preset) return this.envTex;
    const S = 128;
    if (!this.envTex) { this.envTex = gl.createTexture(); }
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.envTex);
    for (let f = 0; f < 6; f++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, 0, gl.RGBA16F, S, S, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, S, S);
    GLX.use('envGen'); gl.disable(gl.BLEND);
    for (let f = 0; f < 6; f++) { gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, this.envTex, 0); GLX.seti('uFace', f); GLX.set('uSize', S); GLX.seti('uPreset', { forge: 0, studio: 1, sky: 2 }[e.preset] ?? 0); GLX.drawQuad(); }
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.envTex); gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.deleteFramebuffer(fbo); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.envKey = e.preset; this.envLod = Math.log2(S); return this.envTex;
  },
  shadowFBO() {
    const gl = GLX.gl; if (this._sh) return this._sh; const S = this.SHADOW;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, S, S, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    this._sh = { tex, fbo, S }; return this._sh;
  },
  sceneFBO(W, H) {
    const gl = GLX.gl; if (this._sc && this._sc.w === W && this._sc.h === H) return this._sc;
    if (this._sc) { const s = this._sc; gl.deleteFramebuffer(s.fbo); gl.deleteRenderbuffer(s.c); gl.deleteRenderbuffer(s.d); gl.deleteFramebuffer(s.rfbo); gl.deleteTexture(s.ctex); gl.deleteTexture(s.dtex); gl.deleteFramebuffer(s.dfbo); }
    const smp = GLX.maxSamples;
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const c = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, c); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, smp, gl.RGBA16F, W, H); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c);
    const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, smp, gl.DEPTH24_STENCIL8, W, H); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, d);
    // 解析目标
    const ctex = GLX.makeTex(W, H, null, 'rgba16f'); const rfbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, rfbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ctex, 0);
    const dtex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dtex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH24_STENCIL8, W, H, 0, gl.DEPTH_STENCIL, gl.UNSIGNED_INT_24_8, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const dfbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, dfbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, dtex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this._sc = { fbo, c, d, rfbo, ctex, dtex, dfbo, w: W, h: H }; return this._sc;
  },
  pickFBO(W, H) {
    const gl = GLX.gl; if (this._pk && this._pk.w === W && this._pk.h === H) return this._pk;
    const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, W, H);
    this._pk = { d, w: W, h: H }; return this._pk;
  },

  // ---------- 场景收集 ----------
  ev(p, comp, L, t) { return Anim.evalProp(p, comp, L, t); },
  lights(comp, t) {
    const out = [];
    for (const L of comp.layers) {
      if (L.type !== 'light' || !L.visible || t < L.inPoint || t >= L.outPoint) continue;
      const e = p => this.ev(p, comp, L, t); const PM = Xform.parentMatrix(comp, L, t);
      const pos = M4.pt(PM, e(L.tr.position)); const I = e(L.light.intensity) / 100; const c = e(L.light.color);
      const o = { layer: L, kind: L.light.kind, pos, color: [c[0] * I, c[1] * I, c[2] * I], shadows: L.light.shadows, dark: e(L.light.darkness) / 100, soft: e(L.light.softness) };
      if (L.light.kind === 'parallel') { const poi = M4.pt(PM, e(L.light.poi)); o.dir = V3.norm(V3.sub(poi, pos)); o.poi = poi; }
      out.push(o);
    }
    return out;
  },
  // 对象：{layer, kind:'mesh'|'plane'|'particles', mesh, model, mat...}
  collect(comp, t, group, rs, mbT) {
    const objs = [];
    for (const L of group) {
      const tt = mbT && L.motionBlur ? mbT : t;
      if (L.type === 'geo') {
        const mesh = Scene.layerMesh(comp, L, tt); if (!mesh || !mesh.idx.length) continue;
        const e = p => this.ev(p, comp, L, tt); const m = L.mat;
        const emit = e(m.emit), es = e(m.emitStr);
        objs.push({ layer: L, kind: 'mesh', mesh, model: Xform.layerMatrix(comp, L, tt), base: e(m.base), metal: e(m.metal), rough: e(m.rough), emit: [emit[0] * es, emit[1] * es, emit[2] * es], op: U.clamp(e(m.opacity) / 100, 0, 1) * Xform.opacity(comp, L, tt), cast: L.castShadow, recv: L.recvShadow });
      } else if (L.type === 'particles') {
        objs.push({ layer: L, kind: 'particles', t: tt });
      } else {
        objs.push({ layer: L, kind: 'plane', t: tt });
      }
    }
    return objs;
  },
  // 2D 图层 → 图层空间纹理
  planeTex(comp, L, t, rs) {
    let bb;
    if (L.type === 'solid') bb = [0, 0, L.solid.w, L.solid.h];
    else if (L.type === 'precomp') { const s = Model.findComp(Anim.project, L.pre.compId); bb = s ? [0, 0, s.width, s.height] : [0, 0, 1, 1]; }
    else if (L.type === 'text') { bb = TextL.bbox(comp, L, t); const pd = 20; bb = [bb[0] - pd, bb[1] - pd, bb[2] + pd, bb[3] + pd]; }
    else { const P = Shapes.allPolys(comp, L, t); if (!P.length) return null; bb = Geo2D.bbox(P); const pd = 30; bb = [bb[0] - pd, bb[1] - pd, bb[2] + pd, bb[3] + pd]; }
    const bw = Math.max(1, bb[2] - bb[0]), bh = Math.max(1, bb[3] - bb[1]);
    const sc = Math.min(rs * 1.5, 2048 / Math.max(bw, bh));
    const W = Math.ceil(bw * sc), H = Math.ceil(bh * sc);
    const rt = GLX.acquire(W, H);
    const A = [sc, 0, 0, sc, -bb[0] * sc, -bb[1] * sc];
    if (L.type === 'precomp') {
      GLX.clear(rt); const sub = Model.findComp(Anim.project, L.pre.compId);
      if (sub && sub !== comp) { const srt = Render.renderComp(sub, Render.precompTime(comp, L, t), sc, {}); GLX.bind(rt); Render.texQuad(srt.tex, Render.mat3([sub.width * sc, 0, 0, sub.height * sc, 0, 0], 1), W, H, 1); GLX.release(srt); }
    } else { GLX.beginVec(W, H); Render.drawContent(comp, L, t, Render.mat3(A, 1), W, H, A); GLX.endVec(rt); }
    if (L.masks.length) { const m = Render.maskRT(comp, L, t, A, 1, W, H); if (m) { const o = GLX.acquire(W, H); GLX.pass('mulMask', o, () => { GLX.tex('uTex', rt.tex); GLX.tex('uMask', m.tex); }); GLX.release(m); GLX.release(rt); return { rt: o, bb }; } }
    return { rt, bb };
  },

  // ---------- 渲染组 ----------
  renderGroup(comp, t, group, rs, W, H, opts) {
    const gl = GLX.gl;
    const mbOn = comp.mb.on && !opts.noMB && (group.some(l => l.motionBlur) || (Xform.activeCamera(comp, t) || {}).motionBlur);
    const N = mbOn ? Math.max(2, comp.mb.samples | 0) : 1;
    let acc = null;
    if (N > 1) { acc = GLX.acquire(W, H, 'rgba16f'); GLX.clear(acc); }
    let single = null;
    for (let k = 0; k < N; k++) {
      const ts = N > 1 ? t + comp.mb.phase / 360 / comp.fps + comp.mb.angle / 360 / comp.fps * (k + 0.5) / N : null;
      const r = this.renderOnce(comp, t, group, rs, W, H, ts, opts);
      if (N > 1) { GLX.pass('scale', acc, () => { GLX.tex('uTex', r.tex); GLX.set('uK', 1 / N); }, 'add'); GLX.release(r); }
      else single = r;
    }
    const hdr = single || acc;
    // 色调映射 → 8 位预乘
    const out = GLX.acquire(W, H);
    GLX.pass('tonemap', out, () => { GLX.tex('uTex', hdr.tex); GLX.set('uExp', 1); });
    GLX.release(hdr);
    return out;
  },
  renderOnce(comp, t, group, rs, W, H, mbT, opts) {
    const gl = GLX.gl;
    const camL = Xform.activeCamera(comp, t);
    const cam = Xform.camera(comp, mbT && camL && camL.motionBlur ? mbT : t);
    const lights = this.lights(comp, t);
    const objs = this.collect(comp, t, group, rs, mbT);
    const envTex = this.env(comp);
    // 阴影
    let shadow = null;
    const sl = lights.findIndex(l => l.shadows && l.kind !== 'ambient');
    if (sl >= 0) shadow = this.renderShadow(comp, objs, lights[sl], t);
    // 平面纹理
    const planes = [];
    for (const o of objs) if (o.kind === 'plane') { const pt = this.planeTex(comp, o.layer, o.t, rs); if (pt) { o.pt = pt; o.model = Xform.layerMatrix(comp, o.layer, o.t); o.op = Xform.opacity(comp, o.layer, o.t); planes.push(o); } }
    const S = this.sceneFBO(W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.fbo); gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    // 不透明网格
    const env = comp.env || { intensity: 1, rotation: 0 };
    const setCommon = () => {
      GLX.set('uVP', M4.f32(cam.vp)); GLX.set('uEye', cam.eye);
      GLX.tex('uEnv', envTex, gl.TEXTURE_CUBE_MAP); GLX.set('uEnvI', env.intensity); GLX.set('uEnvLod', this.envLod - 1); GLX.set('uEnvRot', U.rad(env.rotation || 0));
      const nl = Math.min(6, lights.length); GLX.seti('uNL', nl);
      const LP = new Float32Array(24), LC = new Float32Array(18), LD = new Float32Array(18);
      lights.slice(0, 6).forEach((l, i) => { LP.set([...l.pos, l.kind === 'parallel' ? 0 : l.kind === 'point' ? 1 : 2], i * 4); LC.set(l.color, i * 3); LD.set(l.dir || [0, 1, 0], i * 3); });
      GLX.setv('uLP', LP, 4); GLX.setv('uLC', LC, 3); GLX.setv('uLD', LD, 3);
      GLX.seti('uShL', shadow ? sl : -1);
      if (shadow) { GLX.tex('uSh', shadow.tex); GLX.set('uShM', M4.f32(shadow.vp)); GLX.set('uShDark', lights[sl].dark); GLX.set('uShSoft', 1 + lights[sl].soft); GLX.set('uShTexel', 1 / this.SHADOW); GLX.set('uShBias', shadow.bias); }
      else { GLX.tex('uSh', this.dummyShadow()); }
    };
    GLX.use('mesh'); setCommon();
    const drawMesh = o => {
      const g = this.meshVAO(o.mesh);
      GLX.set('uModel', M4.f32(o.model)); GLX.set('uNM', M4.normalMat(o.model));
      GLX.set('uBase', o.base); GLX.set('uMetal', o.metal); GLX.set('uRough', o.rough); GLX.set('uEmit', o.emit); GLX.set('uOp', o.op); GLX.set('uRecv', o.recv ? 1 : 0);
      gl.bindVertexArray(g.vao); gl.drawElements(gl.TRIANGLES, g.n, gl.UNSIGNED_INT, 0);
    };
    for (const o of objs) if (o.kind === 'mesh' && o.op >= 0.999) drawMesh(o);
    // 平面（alpha-to-coverage，按深度遮挡）
    if (planes.length) {
      GLX.use('plane3d'); GLX.set('uVP', M4.f32(cam.vp));
      gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
      for (const o of planes) {
        const bb = o.pt.bb; const M = M4.mul(o.model, M4.mul(M4.translate(bb[0], bb[1], 0), M4.scale(bb[2] - bb[0], bb[3] - bb[1], 1)));
        GLX.set('uModel', M4.f32(M)); GLX.tex('uTex', o.pt.rt.tex); GLX.set('uOp', o.op); GLX.drawQuad();
      }
      gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    }
    // 半透明网格（由远到近）
    const trans = objs.filter(o => o.kind === 'mesh' && o.op < 0.999 && o.op > 0.001);
    if (trans.length) {
      trans.sort((a, b) => V3.dist(M4.pt(b.model, [0, 0, 0]), cam.eye) - V3.dist(M4.pt(a.model, [0, 0, 0]), cam.eye));
      GLX.use('mesh'); setCommon(); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      for (const o of trans) drawMesh(o);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    // 粒子与拖尾（加色，深度测试不写入）
    for (const o of objs) if (o.kind === 'particles') this.drawParticles(comp, o.layer, o.t, cam, rs);
    gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(null);
    // 解析
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S.rfbo); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S.dfbo); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (const o of planes) GLX.release(o.pt.rt);
    const out = GLX.acquire(W, H, 'rgba16f');
    if (cam.dof && !opts.noDOF) {
      GLX.pass('dof', out, () => { GLX.tex('uTex', S.ctex); GLX.tex('uDepth', S.dtex); GLX.set('uTexel', [1 / W, 1 / H]); GLX.set('uNF', [cam.near, cam.far]); GLX.set('uFocus', cam.focus); GLX.set('uAp', cam.aperture * rs); GLX.set('uZoom', cam.zoom); GLX.set('uMaxR', Math.min(36, 24 * rs + 4)); });
    } else GLX.pass('copy', out, () => GLX.tex('uTex', S.ctex));
    return out;
  },
  dummyShadow() {
    if (this._dsh) return this._dsh; const gl = GLX.gl; const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, 1, 1, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, new Uint32Array([0xffffffff]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return (this._dsh = t);
  },
  renderShadow(comp, objs, light, t) {
    const gl = GLX.gl; const casters = objs.filter(o => o.kind === 'mesh' && o.cast);
    if (!casters.length) return null;
    // 场景包围球
    let bmin = [1e9, 1e9, 1e9], bmax = [-1e9, -1e9, -1e9];
    for (const o of objs) if (o.kind === 'mesh') { const b = Geo3D.bounds(o.mesh); for (const c of [[b[0], b[1], b[2]], [b[3], b[4], b[5]], [b[0], b[4], b[2]], [b[3], b[1], b[5]], [b[0], b[1], b[5]], [b[3], b[4], b[2]]]) { const w = M4.pt(o.model, c); for (let k = 0; k < 3; k++) { bmin[k] = Math.min(bmin[k], w[k]); bmax[k] = Math.max(bmax[k], w[k]); } } }
    const ctr = V3.mul(V3.add(bmin, bmax), 0.5); const R = Math.max(10, V3.dist(bmin, bmax) / 2);
    let vp, bias;
    if (light.kind === 'parallel') {
      const eye = V3.sub(ctr, V3.mul(light.dir, R * 2)); const up = Math.abs(light.dir[1]) > 0.9 ? [0, 0, 1] : [0, -1, 0];
      vp = M4.mul(M4.ortho(-R, R, -R, R, R * 0.5, R * 3.5), M4.lookAt(eye, ctr, up)); bias = R * 0.004;
    } else {
      const d = V3.dist(light.pos, ctr); const fov = 2 * Math.atan(R / Math.max(d, R * 1.01)) * 1.1; const up = [0, -1, 0];
      vp = M4.mul(M4.perspective(Math.min(fov, 2.6), 1, Math.max(1, d - R * 1.5), d + R * 1.5), M4.lookAt(light.pos, ctr, up)); bias = R * 0.004;
    }
    const sh = this.shadowFBO();
    gl.bindFramebuffer(gl.FRAMEBUFFER, sh.fbo); gl.viewport(0, 0, sh.S, sh.S); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 4);
    GLX.use('depth'); GLX.set('uVP', M4.f32(vp));
    for (const o of casters) { const g = this.meshVAO(o.mesh); GLX.set('uModel', M4.f32(o.model)); gl.bindVertexArray(g.vao); gl.drawElements(gl.TRIANGLES, g.n, gl.UNSIGNED_INT, 0); }
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.bindVertexArray(null);
    return { tex: sh.tex, vp, bias };
  },
  // ---------- 粒子 ----------
  drawParticles(comp, L, t, cam, rs) {
    const gl = GLX.gl; const st = Particles.state(comp, L, t); if (!st || !st.n) return;
    const S = L.ps; const e = p => this.ev(p, comp, L, t);
    // 拖尾
    if (S.trail.on && st.trails) {
      const tc = e(S.trail.color), tw = e(S.trail.width), fade = e(S.trail.fade) / 100;
      const data = [];
      for (const tr of st.trails) {
        const P = tr.pts; if (P.length < 2) continue;
        for (let i = 0; i < P.length - 1; i++) {
          const a = P[i], b = P[i + 1]; const d = V3.sub(b, a); if (V3.len(d) < 1e-3) continue;
          const va = V3.sub(cam.eye, a); let side = V3.norm(V3.cross(d, va));
          const ua = i / (P.length - 1), ub = (i + 1) / (P.length - 1);
          const wa = tw * (0.25 + 0.75 * ua) * 0.5, wb = tw * (0.25 + 0.75 * ub) * 0.5;
          const aa = tr.a * (1 - fade * (1 - ua)), ab = tr.a * (1 - fade * (1 - ub));
          const c = [tc[0] * tr.c[0], tc[1] * tr.c[1], tc[2] * tr.c[2]];
          const A1 = V3.add(a, V3.mul(side, wa)), A2 = V3.sub(a, V3.mul(side, wa)), B1 = V3.add(b, V3.mul(side, wb)), B2 = V3.sub(b, V3.mul(side, wb));
          const push = (p, al) => data.push(p[0], p[1], p[2], c[0] * al, c[1] * al, c[2] * al, al * 0.5);
          push(A1, aa); push(B1, ab); push(B2, ab); push(A1, aa); push(B2, ab); push(A2, aa);
        }
      }
      if (data.length) {
        if (!this._trVAO) { this._trVAO = gl.createVertexArray(); gl.bindVertexArray(this._trVAO); this._trBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this._trBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12); }
        gl.bindVertexArray(this._trVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this._trBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
        GLX.use('trail'); GLX.set('uVP', M4.f32(cam.vp)); GLX.set('uGlow', e(S.look.glow));
        gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        gl.drawArrays(gl.TRIANGLES, 0, data.length / 7);
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
    }
    if (!this._pVAO) {
      this._pVAO = gl.createVertexArray(); gl.bindVertexArray(this._pVAO); this._pBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this._pBuf);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(0, 1);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(1, 1);
    }
    gl.bindVertexArray(this._pVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this._pBuf); gl.bufferData(gl.ARRAY_BUFFER, st.inst, gl.DYNAMIC_DRAW);
    GLX.use('particle'); GLX.set('uView', M4.f32(cam.view)); GLX.set('uProj', M4.f32(cam.proj)); GLX.set('uGlow', e(S.look.glow));
    gl.enable(gl.BLEND); if (S.look.additive) gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, st.n); gl.depthMask(true); gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  },
  // ---------- 点选 ----------
  pickGroup(comp, t, group, rs, W, H, pk, enc) {
    const gl = GLX.gl; const cam = Xform.camera(comp, t); const objs = this.collect(comp, t, group, rs, null);
    const P = this.pickFBO(W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pk.fbo); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, P.d); gl.viewport(0, 0, W, H);
    gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
    for (const o of objs) {
      if (o.kind === 'mesh') { if (o.layer.locked) continue; GLX.use('pickMesh'); GLX.set('uVP', M4.f32(cam.vp)); GLX.set('uModel', M4.f32(o.model)); GLX.set('uId', enc(o.layer.id)); const g = this.meshVAO(o.mesh); gl.bindVertexArray(g.vao); gl.drawElements(gl.TRIANGLES, g.n, gl.UNSIGNED_INT, 0); }
      else if (o.kind === 'plane') { const pt = this.planeTex(comp, o.layer, t, rs); if (!pt) continue; const bb = pt.bb; const M = M4.mul(Xform.layerMatrix(comp, o.layer, t), M4.mul(M4.translate(bb[0], bb[1], 0), M4.scale(bb[2] - bb[0], bb[3] - bb[1], 1))); gl.bindFramebuffer(gl.FRAMEBUFFER, pk.fbo); gl.viewport(0, 0, W, H); GLX.use('pickPlane'); GLX.set('uVP', M4.f32(cam.vp)); GLX.set('uModel', M4.f32(M)); GLX.tex('uTex', pt.rt.tex); GLX.set('uId', enc(o.layer.id)); GLX.drawQuad(); GLX.release(pt.rt); }
    }
    gl.disable(gl.DEPTH_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, pk.fbo); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, null); gl.bindVertexArray(null);
  },
};

// ---------- 3D 着色器 ----------
Object.assign(Shaders, {
  envGen: { fs: `uniform int uFace; uniform float uSize; uniform int uPreset; out vec4 o;
    float box(vec3 d, vec3 c, float s){ return smoothstep(cos(s*1.25), cos(s), dot(d, normalize(c))); }
    vec3 env(vec3 d){ float up=-d.y; vec3 c;
      if(uPreset==0){ // 锻炉：暗场，暖色顶光、炉火底光、冷色轮廓
        c=mix(vec3(0.010,0.009,0.010), vec3(0.030,0.028,0.034), smoothstep(-0.3,0.8,up));
        c+=vec3(0.25,0.10,0.03)*smoothstep(0.05,-0.7,up)*0.6;
        c+=vec3(5.0,3.6,2.4)*box(d,vec3(-0.5,-1.0,-0.6),0.36);
        c+=vec3(1.0,1.6,2.6)*box(d,vec3(1.0,-0.25,0.6),0.18)*1.4;
        c+=vec3(3.0,1.1,0.3)*box(d,vec3(0.2,0.7,-1.0),0.30);
        c+=vec3(0.9,0.85,0.8)*box(d,vec3(0.0,-0.2,-1.0),0.55)*0.35;
      } else if(uPreset==1){ // 工作室
        c=mix(vec3(0.10),vec3(0.42),smoothstep(-0.5,0.9,up));
        c+=vec3(3.0)*box(d,vec3(-0.6,-0.8,-0.5),0.35)+vec3(1.8)*box(d,vec3(0.8,-0.4,0.2),0.25);
      } else { // 天空
        c=mix(vec3(0.25,0.22,0.2), mix(vec3(0.55,0.7,0.95),vec3(0.15,0.3,0.7),smoothstep(0.0,0.9,up)), smoothstep(-0.05,0.05,up));
        c+=vec3(30.0,26.0,20.0)*smoothstep(0.9993,0.9997,dot(d,normalize(vec3(-0.4,-0.6,-0.5))));
      }
      return c; }
    void main(){ vec2 st=gl_FragCoord.xy/uSize*2.0-1.0; float sc=st.x, tc=st.y; vec3 d;
      if(uFace==0) d=vec3(1.0,-tc,-sc); else if(uFace==1) d=vec3(-1.0,-tc,sc); else if(uFace==2) d=vec3(sc,1.0,tc); else if(uFace==3) d=vec3(sc,-1.0,-tc); else if(uFace==4) d=vec3(sc,-tc,1.0); else d=vec3(-sc,-tc,-1.0);
      o=vec4(env(normalize(d)),1.0); }` },
  depth: { vs: `layout(location=0) in vec3 aPos; uniform mat4 uVP,uModel; void main(){ gl_Position=uVP*uModel*vec4(aPos,1.0); }`, fs: `void main(){}` },
  pickMesh: { vs: `layout(location=0) in vec3 aPos; uniform mat4 uVP,uModel; void main(){ gl_Position=uVP*uModel*vec4(aPos,1.0); }`, fs: `uniform vec4 uId; out vec4 o; void main(){ o=uId; }` },
  pickPlane: { vs: `layout(location=0) in vec2 aPos; uniform mat4 uVP,uModel; out vec2 vUV; void main(){ vUV=vec2(aPos.x,1.0-aPos.y); gl_Position=uVP*uModel*vec4(aPos,0.0,1.0); }`, fs: `in vec2 vUV; uniform sampler2D uTex; uniform vec4 uId; out vec4 o; void main(){ if(texture(uTex,vUV).a<0.08) discard; o=uId; }` },
  plane3d: { vs: `layout(location=0) in vec2 aPos; uniform mat4 uVP,uModel; out vec2 vUV; void main(){ vUV=vec2(aPos.x,1.0-aPos.y); gl_Position=uVP*uModel*vec4(aPos,0.0,1.0); }`,
    fs: `in vec2 vUV; uniform sampler2D uTex; uniform float uOp; out vec4 o; void main(){ vec4 c=texture(uTex,vUV)*uOp; if(c.a<0.004) discard; vec3 lin=pow(max(c.rgb/max(c.a,1e-4),vec3(0)),vec3(2.2)); o=vec4(lin,c.a); }` },
  mesh: {
    vs: `layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec4 aCol; uniform mat4 uVP,uModel; uniform mat3 uNM; out vec3 vW; out vec3 vN; out vec4 vC;
      void main(){ vec4 w=uModel*vec4(aPos,1.0); vW=w.xyz; vN=normalize(uNM*aNrm); vC=aCol; gl_Position=uVP*w; }`,
    fs: `in vec3 vW; in vec3 vN; in vec4 vC; out vec4 o;
      uniform vec3 uEye,uBase,uEmit; uniform float uMetal,uRough,uOp,uRecv;
      uniform samplerCube uEnv; uniform float uEnvI,uEnvLod,uEnvRot;
      uniform int uNL; uniform vec4 uLP[6]; uniform vec3 uLC[6]; uniform vec3 uLD[6];
      uniform highp sampler2DShadow uSh; uniform mat4 uShM; uniform int uShL; uniform float uShDark,uShSoft,uShTexel,uShBias;
      const float PI=3.14159265;
      vec3 rotY(vec3 d,float a){ float c=cos(a),s=sin(a); return vec3(c*d.x+s*d.z,d.y,-s*d.x+c*d.z); }
      vec3 envBRDF(vec3 f0,float r,float NoV){ const vec4 c0=vec4(-1.0,-0.0275,-0.572,0.022); const vec4 c1=vec4(1.0,0.0425,1.04,-0.04); vec4 q=r*c0+c1; float a004=min(q.x*q.x,exp2(-9.28*NoV))*q.x+q.y; vec2 AB=vec2(-1.04,1.04)*a004+q.zw; return f0*AB.x+AB.y; }
      float shadowF(vec3 w,vec3 n){ vec4 p=uShM*vec4(w+n*uShBias,1.0); p.xyz/=p.w; p.xyz=p.xyz*0.5+0.5; if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0||p.z>1.0) return 1.0;
        float s=0.0; vec2 k[12]=vec2[](vec2(-0.326,-0.406),vec2(-0.840,-0.074),vec2(-0.696,0.457),vec2(-0.203,0.621),vec2(0.962,-0.195),vec2(0.473,-0.480),vec2(0.519,0.767),vec2(0.185,-0.893),vec2(0.507,0.064),vec2(0.896,0.412),vec2(-0.322,-0.933),vec2(-0.792,-0.598));
        for(int i=0;i<12;i++) s+=texture(uSh,vec3(p.xy+k[i]*uShSoft*uShTexel*1.5,p.z-0.0008)); return s/12.0; }
      void main(){
        vec3 N=normalize(vN); vec3 V=normalize(uEye-vW); if(dot(N,V)<0.0 && !gl_FrontFacing) N=-N;
        float rough=clamp(uRough,0.04,1.0), a=rough*rough; vec3 base=uBase*vC.rgb; float metal=clamp(uMetal,0.0,1.0);
        vec3 f0=mix(vec3(0.04),base,metal); vec3 dif=base*(1.0-metal); float NoV=max(dot(N,V),1e-4);
        vec3 col=vec3(0);
        for(int i=0;i<6;i++){ if(i>=uNL) break; vec3 L;
          if(uLP[i].w==0.0) L=-normalize(uLD[i]); else if(uLP[i].w==1.0) L=normalize(uLP[i].xyz-vW); else { col+=dif*uLC[i]; continue; }
          float NoL=max(dot(N,L),0.0); if(NoL<=0.0) continue;
          vec3 H=normalize(L+V); float NoH=max(dot(N,H),0.0), VoH=max(dot(V,H),0.0);
          vec3 F=f0+(1.0-f0)*pow(1.0-VoH,5.0); float a2=a*a; float dd=NoH*NoH*(a2-1.0)+1.0; float D=a2/(PI*dd*dd);
          float k=a*0.5; float Vis=0.25/((NoV*(1.0-k)+k)*(NoL*(1.0-k)+k));
          vec3 spec=D*Vis*F; vec3 kd=(1.0-F)*dif/PI;
          float sh=1.0; if(i==uShL && uRecv>0.5) sh=mix(1.0,shadowF(vW,N),uShDark);
          col+=(kd+spec)*uLC[i]*NoL*sh*PI;
        }
        vec3 R=reflect(-V,N);
        vec3 eS=textureLod(uEnv,rotY(R,uEnvRot),rough*uEnvLod).rgb, eD=textureLod(uEnv,rotY(N,uEnvRot),uEnvLod).rgb;
        col+=(eD*dif+eS*envBRDF(f0,rough,NoV))*uEnvI;
        col+=uEmit*vC.a;
        o=vec4(col*uOp,uOp);
      }` },
  particle: {
    vs: `layout(location=0) in vec4 aP; layout(location=1) in vec4 aC; uniform mat4 uView,uProj; out vec2 vQ; out vec4 vC;
      void main(){ int id=gl_VertexID; vec2 q=vec2(id==1||id==2||id==4?1.0:-1.0, id==2||id==4||id==5?1.0:-1.0); vQ=q; vC=aC;
        vec4 v=uView*vec4(aP.xyz,1.0); v.xy+=q*aP.w; gl_Position=uProj*v; }`,
    fs: `in vec2 vQ; in vec4 vC; uniform float uGlow; out vec4 o; void main(){ float r=length(vQ); if(r>1.0) discard; float f=pow(1.0-r,1.6)+0.6*exp(-r*r*12.0); float a=vC.a*f; o=vec4(vC.rgb*a*uGlow, a*0.6); }` },
  trail: {
    vs: `layout(location=0) in vec3 aPos; layout(location=1) in vec4 aC; uniform mat4 uVP; out vec4 vC; void main(){ vC=aC; gl_Position=uVP*vec4(aPos,1.0); }`,
    fs: `in vec4 vC; uniform float uGlow; out vec4 o; void main(){ o=vec4(vC.rgb*uGlow, vC.a); }` },
  dof: { fs: `in vec2 vUV; uniform sampler2D uTex,uDepth; uniform vec2 uTexel,uNF; uniform float uFocus,uAp,uZoom,uMaxR; out vec4 o;
    float lin(float d){ float z=d*2.0-1.0; return 2.0*uNF.x*uNF.y/(uNF.y+uNF.x-z*(uNF.y-uNF.x)); }
    float coc(float d){ if(d>=1.0) return 0.0; float z=lin(d); return clamp(uAp*abs(z-uFocus)/z*(uZoom/uFocus)*0.5, 0.0, uMaxR); }
    void main(){ float cd=texture(uDepth,vUV).r; float cz=cd>=1.0?1e9:lin(cd); float cs=coc(cd);
      vec4 col=texture(uTex,vUV); float tot=1.0; float rad=0.5; float stepK=max(0.5,uMaxR*uMaxR/220.0);
      for(float ang=0.0; rad<uMaxR; ang+=2.39996323){ vec2 tc=vUV+vec2(cos(ang),sin(ang))*uTexel*rad; float sd=texture(uDepth,tc).r; float ss=coc(sd); float sz=sd>=1.0?1e9:lin(sd);
        if(sz>cz) ss=clamp(ss,0.0,cs*2.0); float m=smoothstep(rad-0.5,rad+0.5,ss); col+=mix(col/tot,texture(uTex,tc),m); tot+=1.0; rad+=stepK/rad; }
      o=col/tot; }` },
});
