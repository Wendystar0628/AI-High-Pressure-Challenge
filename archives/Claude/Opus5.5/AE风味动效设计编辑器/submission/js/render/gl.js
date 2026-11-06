// WebGL 2 基础设施：程序、渲染目标池、几何缓冲
(function (G) {
  'use strict';
  const AE = G.AE;
  const GL = AE.GL = { gl: null, progs: {}, pool: [], inUse: new Set() };

  GL.init = (canvas) => {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('浏览器不支持 WebGL 2');
    GL.gl = gl;
    GL.floatOK = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    GL.maxSamples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 4);
    GL.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    GL.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(GL.quadVAO);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    GL.dyn = { vao: gl.createVertexArray(), buf: gl.createBuffer(), size: 0 };
    GL.white = GL.texFromData(1, 1, new Uint8Array([255, 255, 255, 255]));
    GL.black = GL.texFromData(1, 1, new Uint8Array([0, 0, 0, 0]));
    return gl;
  };
  GL.texFromData = (w, h, data) => {
    const gl = GL.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };

  // ---------- 着色器程序 ----------
  GL.prog = (name, vs, fs) => {
    if (GL.progs[name]) return GL.progs[name];
    const gl = GL.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, '#version 300 es\nprecision highp float;\nprecision highp int;\n' + src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); console.error(name, log, src.split('\n').map((l, i) => (i + 4) + ': ' + l).join('\n')); throw new Error('着色器编译失败 ' + name + ': ' + log); }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aNrm'); gl.bindAttribLocation(p, 2, 'aUV'); gl.bindAttribLocation(p, 3, 'aExtra');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('着色器链接失败 ' + name + ': ' + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const nm = info.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, info.name); }
    const pr = { p, u, name };
    GL.progs[name] = pr;
    return pr;
  };
  GL.use = (pr, uniforms) => {
    const gl = GL.gl; gl.useProgram(pr.p);
    let unit = 0;
    for (const k in uniforms) {
      const loc = pr.u[k]; if (loc === undefined) continue;
      const v = uniforms[k];
      if (v && v.__tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.tex); gl.uniform1i(loc, unit); unit++; }
      else if (v instanceof WebGLTexture) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v); gl.uniform1i(loc, unit); unit++; }
      else if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (typeof v === 'boolean') gl.uniform1i(loc, v ? 1 : 0);
      else if (v && v.int !== undefined) gl.uniform1i(loc, v.int);
      else if (v && v.m4) gl.uniformMatrix4fv(loc, false, v.m4);
      else if (v && v.m3) gl.uniformMatrix3fv(loc, false, v.m3);
      else if (v && v.v4a) gl.uniform4fv(loc, v.v4a);
      else if (v && v.v3a) gl.uniform3fv(loc, v.v3a);
      else if (v && v.fa) gl.uniform1fv(loc, v.fa);
      else if (v && v.ia) gl.uniform1iv(loc, v.ia);
      else if (v && v.length === 2) gl.uniform2f(loc, v[0], v[1]);
      else if (v && v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
      else if (v && v.length === 4) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
      else if (v && v.length === 16) gl.uniformMatrix4fv(loc, false, v instanceof Float32Array ? v : new Float32Array(v));
    }
    return unit;
  };
  GL.m4 = m => ({ m4: m instanceof Float32Array ? m : new Float32Array(m) });
  GL.int = v => ({ int: v });

  // ---------- 渲染目标 ----------
  // kind: 'c' 颜色(16F)；'c8' 8 位颜色；'ms' 多重采样颜色+深度模板（带解析纹理）；'d' 颜色+深度纹理
  GL.target = (w, h, kind = 'c') => {
    w = Math.max(1, Math.min(GL.maxTex, Math.round(w))); h = Math.max(1, Math.min(GL.maxTex, Math.round(h)));
    for (let i = 0; i < GL.pool.length; i++) {
      const t = GL.pool[i];
      if (t.w === w && t.h === h && t.kind === kind) { GL.pool.splice(i, 1); GL.inUse.add(t); return t; }
    }
    const t = GL.makeTarget(w, h, kind); GL.inUse.add(t); return t;
  };
  GL.release = (t) => { if (!t || !GL.inUse.has(t)) return; GL.inUse.delete(t); GL.pool.push(t); if (GL.pool.length > 48) GL.freeTarget(GL.pool.shift()); };
  GL.freeTarget = (t) => { const gl = GL.gl; gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.tex); if (t.msFbo) { gl.deleteFramebuffer(t.msFbo); gl.deleteRenderbuffer(t.msColor); gl.deleteRenderbuffer(t.msDS); } if (t.depthTex) gl.deleteTexture(t.depthTex); };
  GL.trimPool = () => { while (GL.pool.length > 12) GL.freeTarget(GL.pool.shift()); };
  GL.makeTarget = (w, h, kind) => {
    const gl = GL.gl, t = { w, h, kind, __tex: true };
    const f16 = GL.floatOK && kind !== 'c8' && kind !== 'pick';
    t.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    if (f16) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const filt = kind === 'pick' ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    t.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    if (kind === 'd' || kind === 'pick') {
      t.depthTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t.depthTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH24_STENCIL8, w, h, 0, gl.DEPTH_STENCIL, gl.UNSIGNED_INT_24_8, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, t.depthTex, 0);
    }
    if (kind === 'ms' || kind === 'd') {
      t.msFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.msFbo);
      t.msColor = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, t.msColor);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, GL.maxSamples, f16 ? gl.RGBA16F : gl.RGBA8, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, t.msColor);
      t.msDS = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, t.msDS);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, GL.maxSamples, gl.DEPTH24_STENCIL8, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, t.msDS);
    }
    if (kind === 'stencil') {
      t.ds = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, t.ds);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, t.ds);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return t;
  };
  GL.bind = (t, ms) => {
    const gl = GL.gl;
    if (!t) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); return; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, ms && t.msFbo ? t.msFbo : t.fbo);
    gl.viewport(0, 0, t.w, t.h);
  };
  GL.resolve = (t, depth) => {
    const gl = GL.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, t.msFbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, t.fbo);
    gl.blitFramebuffer(0, 0, t.w, t.h, 0, 0, t.w, t.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    if (depth && t.depthTex) gl.blitFramebuffer(0, 0, t.w, t.h, 0, 0, t.w, t.h, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  };
  GL.clear = (r = 0, g = 0, b = 0, a = 0) => { const gl = GL.gl; gl.clearColor(r, g, b, a); gl.clearStencil(0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT); };

  // 全屏四边形
  GL.drawQuad = () => { const gl = GL.gl; gl.bindVertexArray(GL.quadVAO); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null); };
  // 动态二维顶点
  GL.drawDyn = (data, mode, comps = 2) => {
    const gl = GL.gl, d = GL.dyn;
    gl.bindVertexArray(d.vao); gl.bindBuffer(gl.ARRAY_BUFFER, d.buf);
    const arr = data instanceof Float32Array ? data : new Float32Array(data);
    if (arr.byteLength > d.size) { d.size = Math.max(arr.byteLength, d.size * 2, 65536); gl.bufferData(gl.ARRAY_BUFFER, d.size, gl.DYNAMIC_DRAW); }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, comps, gl.FLOAT, false, 0, 0);
    gl.drawArrays(mode, 0, arr.length / comps);
    gl.bindVertexArray(null);
  };
  // 网格缓冲（缓存于网格对象）
  GL.meshVAO = (mesh) => {
    const gl = GL.gl;
    if (mesh._vao && mesh._ver === mesh.ver) return mesh._vao;
    if (!mesh._vao) { mesh._vao = gl.createVertexArray(); mesh._bufs = [gl.createBuffer(), gl.createBuffer(), gl.createBuffer(), gl.createBuffer(), gl.createBuffer()]; }
    gl.bindVertexArray(mesh._vao);
    const set = (i, data, n) => { gl.bindBuffer(gl.ARRAY_BUFFER, mesh._bufs[i]); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, 0, 0); };
    set(0, mesh.pos, 3); set(1, mesh.nrm, 3); set(2, mesh.uv || new Float32Array(mesh.pos.length / 3 * 2), 2);
    set(3, mesh.extra || new Float32Array(mesh.pos.length / 3), 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh._bufs[4]); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    mesh._ver = mesh.ver;
    return mesh._vao;
  };
  GL.freeMesh = (mesh) => { if (!mesh._vao) return; const gl = GL.gl; gl.deleteVertexArray(mesh._vao); mesh._bufs.forEach(b => gl.deleteBuffer(b)); mesh._vao = null; };
  GL.blend = (mode) => {
    const gl = GL.gl;
    if (!mode) { gl.disable(gl.BLEND); return; }
    gl.enable(gl.BLEND);
    if (mode === 'pre') gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else if (mode === 'add') gl.blendFunc(gl.ONE, gl.ONE);
    else if (mode === 'behind') gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
  };
})(typeof window !== 'undefined' ? window : globalThis);
