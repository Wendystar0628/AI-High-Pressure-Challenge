'use strict';
// ---------------------------------------------------------------------------
// WebGL2 renderer: programs, mesh upload, HDR MSAA target, shadow cascades,
// bloom chain, composite.
// ---------------------------------------------------------------------------
const R = {
  gl: null, W: 0, H: 0, samples: 4,
  progs: {}, quadIdx: null, quadIdxCap: 0,
  stats: { draws: 0, tris: 0 },
};

R.init = function (canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 not available');
  R.gl = gl; R.canvas = canvas;
  if (!gl.getExtension('EXT_color_buffer_float')) console.warn('EXT_color_buffer_float missing');
  gl.getExtension('OES_texture_float_linear');
  R.maxSamples = gl.getParameter(gl.MAX_SAMPLES);
  // programs
  R.progs.voxel = R.program(SH.voxelVS(false), SH.voxelFS);
  R.progs.voxelI = R.program(SH.voxelVS(true), SH.voxelFS);
  R.progs.shadow = R.program(SH.shadowVS(false), SH.shadowFS);
  R.progs.shadowI = R.program(SH.shadowVS(true), SH.shadowFS);
  R.progs.sky = R.program(SH.fullVS, SH.skyFS);
  R.progs.star = R.program(SH.starVS, SH.starFS);
  R.progs.fx = R.program(SH.fxVS, SH.fxFS);
  R.progs.ribbon = R.program(SH.ribbonVS, SH.ribbonFS);
  R.progs.shield = R.program(SH.shieldVS, SH.shieldFS);
  R.progs.down = R.program(SH.fullVS, SH.downFS);
  R.progs.up = R.program(SH.fullVS, SH.upFS);
  R.progs.comp = R.program(SH.fullVS, SH.compFS);
  R.progs.blit = R.program(SH.fullVS, SH.blitFS);
  R.emptyVAO = gl.createVertexArray();
  R.mats = materialUniforms();
  R.ensureQuadIdx(1 << 16);
  R.initShadow(4096);
  R.initFx();
};

R.program = function (vs, fs) {
  const gl = R.gl;
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      console.error(log + '\n' + lines.slice(0, 20000)); throw new Error('shader compile: ' + log);
    }
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const loc = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); loc[name] = gl.getUniformLocation(p, info.name); }
  return { p, loc };
};

R.ensureQuadIdx = function (nq) {
  if (nq <= R.quadIdxCap) return;
  const gl = R.gl; let cap = Math.max(nq, R.quadIdxCap * 2);
  const idx = new Uint32Array(cap * 6);
  for (let q = 0; q < cap; q++) { const b = q * 4, o = q * 6; idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2; idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3; }
  if (!R.quadIdx) R.quadIdx = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.quadIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  R.quadIdxCap = cap;
  // rebind to all existing VAOs
  (R._vaos || []).forEach((v) => { gl.bindVertexArray(v); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.quadIdx); });
  gl.bindVertexArray(null);
};

// upload a trimmed QuadBuf -> mesh {vao, count, min, max, center, radius}
R.upload = function (qb) {
  if (!qb || !qb.n) return null;
  const gl = R.gl; R.ensureQuadIdx(qb.n);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, qb.pos, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.SHORT, false, 8, 0);
  const ab = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ab); gl.bufferData(gl.ARRAY_BUFFER, qb.attr, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribIPointer(1, 4, gl.UNSIGNED_BYTE, 4, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.quadIdx);
  gl.bindVertexArray(null);
  (R._vaos = R._vaos || []).push(vao);
  const c = V.scale(V.add(qb.min, qb.max), 0.5);
  return { vao, count: qb.n * 6, quads: qb.n, min: qb.min, max: qb.max, center: c, radius: V.dist(qb.min, qb.max) * 0.5 };
};

// convert mesher output (single part) into a model {opaque:[mesh], trans:[mesh], min, max}
R.uploadModel = function (buckets, part) {
  const row = buckets[part || 0];
  const m = { opaque: [], trans: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], quads: 0 };
  for (const b of row) {
    const o = R.upload(b.opaque), t = R.upload(b.trans);
    for (const mm of [o, t]) if (mm) { for (let k = 0; k < 3; k++) { m.min[k] = Math.min(m.min[k], mm.min[k]); m.max[k] = Math.max(m.max[k], mm.max[k]); } m.quads += mm.quads; }
    if (o) m.opaque.push(o); if (t) m.trans.push(t);
  }
  return m;
};

// instanced voxel mesh (debris chunks, energy blocks): per-instance pos+scale, quat, extra
R.makeInstanced = function (grid) {
  const b = meshGrid(grid)[0][0].opaque;
  const gl = R.gl; const m = R.upload(b);
  gl.bindVertexArray(m.vao);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib);
  m.icap = 8192; gl.bufferData(gl.ARRAY_BUFFER, 48 * m.icap, gl.DYNAMIC_DRAW);
  for (let k = 0; k < 3; k++) { gl.enableVertexAttribArray(2 + k); gl.vertexAttribPointer(2 + k, 4, gl.FLOAT, false, 48, k * 16); gl.vertexAttribDivisor(2 + k, 1); }
  gl.bindVertexArray(null);
  m.ib = ib; m.instC = [grid.nx / 2, grid.ny / 2, grid.nz / 2]; return m;
};

// ---------------------------------------------------------------- targets
R.tex = function (w, h, ifmt, fmt, type, filter) {
  const gl = R.gl; const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
};
R.fbo = function (tex, depthTex) {
  const gl = R.gl; const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  if (tex) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (depthTex) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0);
  return f;
};

R.resize = function (w, h) {
  const gl = R.gl;
  if (w === R.W && h === R.H) return;
  R.W = w; R.H = h; R.canvas.width = w; R.canvas.height = h;
  R.samples = Math.min(R.maxSamples, w * h > 2560 * 1440 ? 2 : 4);
  // free old
  if (R.rt) { for (const k of ['msColor', 'msDepth']) gl.deleteRenderbuffer(R.rt[k]); for (const t of R.rt.texs) gl.deleteTexture(t); for (const f of R.rt.fbos) gl.deleteFramebuffer(f); }
  const rt = { texs: [], fbos: [] };
  rt.msFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, rt.msFbo);
  rt.msColor = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rt.msColor);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, R.samples, gl.RGBA16F, w, h);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rt.msColor);
  rt.msDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rt.msDepth);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, R.samples, gl.DEPTH_COMPONENT32F, w, h);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rt.msDepth);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) console.error('MS fbo incomplete');
  rt.fbos.push(rt.msFbo);
  rt.scene = R.tex(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT); rt.texs.push(rt.scene);
  rt.sceneFbo = R.fbo(rt.scene); rt.fbos.push(rt.sceneFbo);
  // bloom chain
  rt.bloom = [];
  let bw = w, bh = h;
  for (let i = 0; i < 7; i++) {
    bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1);
    const t = R.tex(bw, bh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT); const f = R.fbo(t);
    rt.texs.push(t); rt.fbos.push(f); rt.bloom.push({ t, f, w: bw, h: bh });
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  R.rt = rt;
};

R.initShadow = function (size) {
  const gl = R.gl; R.shadowSize = size; R.shadow = [];
  for (let i = 0; i < 2; i++) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    R.shadow.push({ t, f, m: M.ident() });
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

// ---------------------------------------------------------------- FX buffers
R.initFx = function () {
  const gl = R.gl;
  R.fxCap = 65536;
  R.fxData = new Float32Array(R.fxCap * 16);
  R.fxVAO = gl.createVertexArray(); gl.bindVertexArray(R.fxVAO);
  const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 1, 1, 0, -1, 1, 1, 0, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  R.fxBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, R.fxBuf);
  gl.bufferData(gl.ARRAY_BUFFER, R.fxData.byteLength, gl.DYNAMIC_DRAW);
  for (let k = 0; k < 4; k++) { gl.enableVertexAttribArray(1 + k); gl.vertexAttribPointer(1 + k, 4, gl.FLOAT, false, 64, k * 16); gl.vertexAttribDivisor(1 + k, 1); }
  gl.bindVertexArray(null);
  // ribbons
  R.ribCap = 120000;
  R.ribData = new Float32Array(R.ribCap * 9);
  R.ribVAO = gl.createVertexArray(); gl.bindVertexArray(R.ribVAO);
  R.ribBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, R.ribBuf);
  gl.bufferData(gl.ARRAY_BUFFER, R.ribData.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 36, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 36, 28);
  gl.bindVertexArray(null);
  // shield sphere
  const pos = [], idx = []; const NU = 72, NV = 40;
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const th = (j / NV) * Math.PI, ph = (i / NU) * Math.PI * 2;
    // z is the long axis
    pos.push(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th));
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  R.sphVAO = gl.createVertexArray(); gl.bindVertexArray(R.sphVAO);
  const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const si = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, si); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  R.sphCount = idx.length;
  gl.bindVertexArray(null);
};

// ---------------------------------------------------------------- frustum
R.frustumPlanes = function (m) {
  const p = [];
  const row = (r) => [m[r], m[4 + r], m[8 + r], m[12 + r]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  for (const [a, s] of [[r0, 1], [r0, -1], [r1, 1], [r1, -1], [r2, 1], [r2, -1]]) {
    const pl = [r3[0] + s * a[0], r3[1] + s * a[1], r3[2] + s * a[2], r3[3] + s * a[3]];
    const l = Math.hypot(pl[0], pl[1], pl[2]); p.push(pl.map((x) => x / l));
  }
  return p;
};
R.sphereVisible = function (planes, c, r) {
  for (const p of planes) if (p[0] * c[0] + p[1] * c[1] + p[2] * c[2] + p[3] < -r) return false;
  return true;
};
