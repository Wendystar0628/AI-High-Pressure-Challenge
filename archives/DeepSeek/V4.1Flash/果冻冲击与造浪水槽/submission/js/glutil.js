/* glutil.js — WebGL2 helpers: programs, meshes, render targets, geometry (global GLU) */
(function () {
  'use strict';

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      console.error('Shader compile error:\n' + log + '\n--- source ---\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
      throw new Error('Shader compile failed: ' + log);
    }
    return sh;
  }

  class Program {
    constructor(gl, vs, fs, name) {
      this.gl = gl; this.name = name || 'program';
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
      gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(p);
        throw new Error('Program link failed (' + this.name + '): ' + log);
      }
      this.p = p;
      this.u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        const nm = info.name.replace(/\[0\]$/, '');
        this.u[nm] = gl.getUniformLocation(p, nm);
      }
    }
    use() { this.gl.useProgram(this.p); return this; }
    m4(n, v) { const l = this.u[n]; if (l) this.gl.uniformMatrix4fv(l, false, v); return this; }
    m3(n, v) { const l = this.u[n]; if (l) this.gl.uniformMatrix3fv(l, false, v); return this; }
    f(n, v) { const l = this.u[n]; if (l !== undefined) this.gl.uniform1f(l, v); return this; }
    i(n, v) { const l = this.u[n]; if (l !== undefined) this.gl.uniform1i(l, v); return this; }
    v2(n, x, y) { const l = this.u[n]; if (l) this.gl.uniform2f(l, x, y); return this; }
    v3(n, v) { const l = this.u[n]; if (l) this.gl.uniform3f(l, v[0], v[1], v[2]); return this; }
    v4(n, x, y, z, w) { const l = this.u[n]; if (l) this.gl.uniform4f(l, x, y, z, w); return this; }
    v3a(n, arr) { const l = this.u[n]; if (l) this.gl.uniform3fv(l, arr); return this; }
    fv(n, arr) { const l = this.u[n]; if (l) this.gl.uniform1fv(l, arr); return this; }
  }

  class Mesh {
    constructor(gl, data) {
      this.gl = gl;
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      this.buffers = [];
      const attrs = data.attributes;
      for (const name in attrs) {
        const a = attrs[name];
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, a.data, a.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
        const loc = data.locations ? data.locations[name] : undefined;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, a.size, gl.FLOAT, false, 0, 0);
        this.buffers.push({ name, buf, size: a.size, data: a.data, location: loc, dynamic: !!a.dynamic });
      }
      this.index = null;
      if (data.indices) {
        this.index = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, data.dynamicIndex ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
        this.indexCount = data.indices.length;
        this.indexType = data.indexType || gl.UNSIGNED_INT;
      } else {
        const first = data.attributes[Object.keys(data.attributes)[0]];
        this.vertexCount = first.data.length / first.size;
      }
      gl.bindVertexArray(null);
      this.mode = data.mode !== undefined ? data.mode : gl.TRIANGLES;
    }
    upload(name, data) {
      const b = this.buffers.find(x => x.name === name);
      if (!b) return;
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, b.buf);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, data, b.dynamic ? this.gl.DYNAMIC_DRAW : this.gl.STATIC_DRAW);
    }
    draw(count) {
      const gl = this.gl;
      gl.bindVertexArray(this.vao);
      if (this.index) gl.drawElements(this.mode, count === undefined ? this.indexCount : count, this.indexType, 0);
      else gl.drawArrays(this.mode, 0, count === undefined ? this.vertexCount : count);
      gl.bindVertexArray(null);
    }
  }

  function createMesh(gl, opts) {
    // opts: {pos, normal, uv, color, extra:{name:{data,size}}, indices, mode, dynamic}
    const attributes = {};
    const locations = { aPos: 0, aNormal: 1, aUV: 2, aColor: 3, aExtra: 4, aExtra2: 5, aFoo: 6 };
    let loc = 0;
    if (opts.pos) { attributes.aPos = { data: opts.pos, size: 3, dynamic: opts.dynamic }; }
    if (opts.normal) { attributes.aNormal = { data: opts.normal, size: 3, dynamic: opts.dynamic }; }
    if (opts.uv) { attributes.aUV = { data: opts.uv, size: 2, dynamic: opts.dynamic }; }
    if (opts.color) { attributes.aColor = { data: opts.color, size: opts.colorSize || 4, dynamic: opts.dynamic }; }
    if (opts.extra) for (const k in opts.extra) attributes[k] = Object.assign({ dynamic: opts.dynamic }, opts.extra[k]);
    // stable locations, use insertion order
    let li = 0;
    for (const k in attributes) { locations[k] = li++; }
    return new Mesh(gl, { attributes, indices: opts.indices, locations, mode: opts.mode, dynamicIndex: opts.dynamicIndex });
  }

  class RenderTarget {
    constructor(gl, w, h, opts = {}) {
      this.gl = gl; this.w = Math.max(1, w | 0); this.h = Math.max(1, h | 0);
      this.opts = opts;
      this.color = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.color);
      const internal = opts.float ? gl.RGBA16F : gl.RGBA8;
      const type = opts.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, this.w, this.h, 0, gl.RGBA, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.nearest ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts.nearest ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.color, 0);
      this.depth = null;
      if (opts.depth) {
        if (opts.depthTexture) {
          this.depth = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, this.depth);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.w, this.h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depth, 0);
        } else {
          this.depth = gl.createRenderbuffer();
          gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
          gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this.w, this.h);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
        }
      }
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) console.warn('FBO incomplete', status, this.w, this.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    bind() {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, this.w, this.h);
    }
    resize(w, h) {
      this.dispose();
      const t = new RenderTarget(this.gl, w, h, this.opts);
      Object.assign(this, t);
    }
    dispose() {
      const gl = this.gl;
      gl.deleteTexture(this.color);
      gl.deleteFramebuffer(this.fbo);
      if (this.depth) { if (this.opts.depthTexture) gl.deleteTexture(this.depth); else gl.deleteRenderbuffer(this.depth); }
    }
  }

  function fullscreenQuad(gl) {
    const m = createMesh(gl, {
      pos: new Float32Array([-1,-1,0, 1,-1,0, -1,1,0, 1,1,0]),
      uv: new Float32Array([0,0, 1,0, 0,1, 1,1]),
      indices: new Uint16Array([0,1,2,2,1,3])
    });
    return m;
  }

  function makeSphere(gl, seg = 48, rings = 32) {
    const pos = [], nor = [], idx = [];
    for (let j = 0; j <= rings; j++) {
      const v = j / rings, phi = v * Math.PI;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg, theta = u * Math.PI * 2;
        const x = Math.sin(phi) * Math.cos(theta), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(theta);
        pos.push(x, y, z); nor.push(x, y, z);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return createMesh(gl, { pos: new Float32Array(pos), normal: new Float32Array(nor), indices: new Uint32Array(idx) });
  }

  function makeSkySphere(gl, seg = 48, rings = 24) { return makeSphere(gl, seg, rings); }

  function makeSilkBox(gl, sx, sy, sz) {
    // simple beveled box via 6 face quads plus chamfer? use plain box
    const p = [], n = [], idx = [];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const faces = [
      { n: [0,1,0], v: [[-hx,hy,-hz],[hx,hy,-hz],[hx,hy,hz],[-hx,hy,hz]] },
      { n: [0,-1,0], v: [[-hx,-hy,hz],[hx,-hy,hz],[hx,-hy,-hz],[-hx,-hy,-hz]] },
      { n: [1,0,0], v: [[hx,-hy,-hz],[hx,-hy,hz],[hx,hy,hz],[hx,hy,-hz]] },
      { n: [-1,0,0], v: [[-hx,-hy,hz],[-hx,-hy,-hz],[-hx,hy,-hz],[-hx,hy,hz]] },
      { n: [0,0,1], v: [[-hx,-hy,hz],[-hx,hy,hz],[hx,hy,hz],[hx,-hy,hz]] },
      { n: [0,0,-1], v: [[hx,-hy,-hz],[hx,hy,-hz],[-hx,hy,-hz],[-hx,-hy,-hz]] }
    ];
    for (const f of faces) {
      const base = p.length / 3;
      for (const v of f.v) { p.push(v[0], v[1], v[2]); n.push(f.n[0], f.n[1], f.n[2]); }
      idx.push(base, base+1, base+2, base, base+2, base+3);
    }
    return createMesh(gl, { pos: new Float32Array(p), normal: new Float32Array(n), indices: new Uint32Array(idx) });
  }

  // rounded box: sample the outer cube, project onto the inner box and offset by r
  function makeRoundedBox(gl, sx, sy, sz, radius, seg = 4) {
    const p = [], n = [], idx = [];
    const r = Math.min(radius, sx/2, sy/2, sz/2);
    const hx = sx/2 - r, hy = sy/2 - r, hz = sz/2 - r;
    const N = Math.max(1, seg);
    const faces = [
      { axis: 0, sign: 1 }, { axis: 0, sign: -1 },
      { axis: 1, sign: 1 }, { axis: 1, sign: -1 },
      { axis: 2, sign: 1 }, { axis: 2, sign: -1 }
    ];
    for (const f of faces) {
      const base = p.length / 3;
      const U = (f.axis === 0 ? hy : hx) + r;
      const V = (f.axis === 2 ? hy : hz) + r;
      for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) {
        const u = a / N * 2 - 1, v = b / N * 2 - 1;
        let x, y, z;
        if (f.axis === 0) { x = f.sign * (hx + r); y = v * U; z = u * V; }
        else if (f.axis === 1) { y = f.sign * (hy + r); x = u * U; z = v * V; }
        else { z = f.sign * (hz + r); x = u * U; y = v * V; }
        const cx = Math.max(-hx, Math.min(hx, x)), cy = Math.max(-hy, Math.min(hy, y)), cz = Math.max(-hz, Math.min(hz, z));
        let nx = x - cx, ny = y - cy, nz = z - cz;
        const L = Math.hypot(nx, ny, nz) || 1;
        nx /= L; ny /= L; nz /= L;
        p.push(cx + nx * r, cy + ny * r, cz + nz * r);
        n.push(nx, ny, nz);
      }
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
        const i0 = base + a * (N + 1) + b;
        const i1 = i0 + 1, i2 = i0 + N + 1, i3 = i2 + 1;
        // orient every triangle using the generated normal to guarantee CCW outside
        const tryTri = (A, B, C) => {
          const ax = p[A*3], ay = p[A*3+1], az = p[A*3+2];
          const bx = p[B*3], by = p[B*3+1], bz = p[B*3+2];
          const cx2 = p[C*3], cy2 = p[C*3+1], cz2 = p[C*3+2];
          const ux = bx-ax, uy = by-ay, uz = bz-az;
          const vx = cx2-ax, vy = cy2-ay, vz = cz2-az;
          const fx = uy*vz-uz*vy, fy = uz*vx-ux*vz, fz = ux*vy-uy*vx;
          const nx = n[A*3]+n[B*3]+n[C*3], ny = n[A*3+1]+n[B*3+1]+n[C*3+1], nz = n[A*3+2]+n[B*3+2]+n[C*3+2];
          if (fx*nx + fy*ny + fz*nz >= 0) idx.push(A, B, C); else idx.push(A, C, B);
        };
        tryTri(i0, i2, i1);
        tryTri(i1, i2, i3);
      }
    }
    return createMesh(gl, { pos: new Float32Array(p), normal: new Float32Array(n), indices: new Uint32Array(idx) });
  }

  function makePlane(gl, sx, sz, sub = 1) {
    const p = [], n = [], idx = [];
    for (let j = 0; j <= sub; j++) for (let i = 0; i <= sub; i++) {
      p.push((i/sub - .5) * sx, 0, (j/sub - .5) * sz);
      n.push(0, 1, 0);
    }
    for (let j = 0; j < sub; j++) for (let i = 0; i < sub; i++) {
      const a = j*(sub+1)+i;
      idx.push(a, a+sub+1, a+1, a+1, a+sub+1, a+sub+2);
    }
    return createMesh(gl, { pos: new Float32Array(p), normal: new Float32Array(n), indices: new Uint32Array(idx) });
  }

  // dynamic triangle mesh helper: pos + normal + extra float attrs, non-indexed
  class DynMesh {
    constructor(gl, maxVerts, extra = []) {
      this.gl = gl; this.maxVerts = maxVerts; this.extraNames = extra;
      const attributes = { aPos: { size: 3, data: new Float32Array(maxVerts * 3), dynamic: true }, aNormal: { size: 3, data: new Float32Array(maxVerts * 3), dynamic: true } };
      const locations = { aPos: 0, aNormal: 1 };
      let li = 2;
      this.extraArrays = {};
      for (const e of extra) { attributes[e.name] = { size: e.size, data: new Float32Array(maxVerts * e.size), dynamic: true }; locations[e.name] = li++; this.extraArrays[e.name] = attributes[e.name].data; }
      this.mesh = new Mesh(gl, { attributes, locations });
      this.locations = locations;
    }
    get pos() { return this.mesh.buffers[0].data; }
    get normal() { return this.mesh.buffers[1].data; }
    uploadPosition(count) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.buffers[0].buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.pos.subarray(0, count * 3));
    }
    uploadAll(count) {
      const gl = this.gl;
      for (const b of this.mesh.buffers) {
        gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, b.data.subarray(0, count * b.size));
      }
    }
    draw(count) { if (count > 0) this.mesh.draw(count); }
  }

  function createEnvTexture(gl) {
    // procedural studio equirect: gradient + softboxes + warm key glow
    const W = 512, H = 256, data = new Uint8Array(W * H * 4);
    const srgb = (x) => Math.max(0, Math.min(255, Math.round(x * 255)));
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1); // 0 top
      for (let x = 0; x < W; x++) {
        const u = x / (W - 1);
        const theta = (u * 2 - 1) * Math.PI;
        const phi = v * Math.PI;
        const dx = Math.sin(phi) * Math.cos(theta), dy = Math.cos(phi), dz = Math.sin(phi) * Math.sin(theta);
        let r, g, b;
        const upward = Math.max(0, dy);
        const horizon = Math.exp(-Math.pow((v - 0.52) * 5.2, 2));
        r = 0.030 + upward * 0.10 + horizon * 0.055;
        g = 0.038 + upward * 0.115 + horizon * 0.065;
        b = 0.046 + upward * 0.13 + horizon * 0.075;
        // broad cool sky glow
        const glow = Math.pow(Math.max(0, -dz * 0.7 + dx * 0.3 + 0.5), 4) * (1 - Math.abs(v - 0.36) * 1.7);
        r += Math.max(0, glow) * 0.06; g += Math.max(0, glow) * 0.10; b += Math.max(0, glow) * 0.14;
        // warm key softbox (front-left, high)
        const k = Math.exp(-(Math.pow((u - 0.86) / 0.085, 2) + Math.pow((v - 0.30) / 0.11, 2)));
        r += k * 3.6; g += k * 3.15; b += k * 2.5;
        // cool rim strip (rear-right)
        const c = Math.exp(-(Math.pow((u - 0.30) / 0.05, 2) + Math.pow((v - 0.36) / 0.19, 2)));
        r += c * 0.7; g += c * 1.35; b += c * 1.9;
        // small overhead strip
        const o = Math.exp(-(Math.pow((u - 0.64) / 0.18, 2) + Math.pow((v - 0.10) / 0.03, 2)));
        r += o * 1.25; g += o * 1.35; b += o * 1.4;
        // broad front fill for glossy highlights
        const ff = Math.exp(-(Math.pow((u - 0.76) / 0.22, 2) + Math.pow((v - 0.42) / 0.16, 2)));
        r += ff * 0.12; g += ff * 0.15; b += ff * 0.17;
        // floor bounce
        if (dy < 0) { const f = Math.min(1, -dy * 1.6); r += f*0.025; g += f*0.036; b += f*0.04; }
        const q = (y * W + x) * 4;
        data[q] = srgb(r); data[q+1] = srgb(g); data[q+2] = srgb(b); data[q+3] = 255;
      }
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function bindTexture(gl, tex, unit, target) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target || gl.TEXTURE_2D, tex);
  }

  window.GLU = { Program, Mesh, RenderTarget, createMesh, fullscreenQuad, makeSphere, makeSkySphere, makeSilkBox, makeRoundedBox, makePlane, DynMesh, createEnvTexture, bindTexture, compile };
})();
