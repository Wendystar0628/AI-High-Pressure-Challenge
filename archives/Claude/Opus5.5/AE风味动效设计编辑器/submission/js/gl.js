'use strict';
// ============ WebGL2 核心：着色器、渲染目标池、全屏通道与效果 ============
const GLX = {
  gl: null, progs: {}, pool: [], frame: 0,
  init(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, stencil: false, depth: false });
    if (!gl) throw new Error('需要 WebGL 2');
    this.gl = gl;
    this.extCBF = gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.maxSamples = Math.min(8, gl.getParameter(gl.MAX_SAMPLES));
    // 全屏四边形
    this.quadVAO = gl.createVertexArray(); gl.bindVertexArray(this.quadVAO);
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // 动态顶点缓冲（矢量路径）
    this.dynVAO = gl.createVertexArray(); gl.bindVertexArray(this.dynVAO);
    this.dynBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf); gl.bufferData(gl.ARRAY_BUFFER, 1 << 20, gl.DYNAMIC_DRAW); this.dynSize = 1 << 20;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.white = this.makeTex(1, 1, new Uint8Array([255, 255, 255, 255]));
  },
  makeTex(w, h, data, fmt = 'rgba8', filter) {
    const gl = this.gl; const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    const F = this.fmt(fmt);
    gl.texImage2D(gl.TEXTURE_2D, 0, F.internal, w, h, 0, F.format, F.type, data || null);
    const fl = filter || gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, fl); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, fl);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  },
  fmt(f) { const gl = this.gl; if (f === 'rgba16f') return { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT }; if (f === 'r32f') return { internal: gl.R32F, format: gl.RED, type: gl.FLOAT }; return { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE }; },
  // ---- 渲染目标池 ----
  acquire(w, h, fmt = 'rgba8') {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const i = this.pool.findIndex(r => r.free && r.w === w && r.h === h && r.fmt === fmt);
    if (i >= 0) { const r = this.pool[i]; r.free = false; r.used = this.frame; return r; }
    const gl = this.gl; const tex = this.makeTex(w, h, null, fmt); const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const r = { tex, fbo, w, h, fmt, free: false, used: this.frame }; this.pool.push(r); return r;
  },
  release(r) { if (r) r.free = true; },
  gc() { // 回收长期未用
    const gl = this.gl; this.frame++;
    for (let i = this.pool.length - 1; i >= 0; i--) { const r = this.pool[i]; if (r.free && this.frame - r.used > 90) { gl.deleteTexture(r.tex); gl.deleteFramebuffer(r.fbo); this.pool.splice(i, 1); } }
    for (const r of this.pool) if (!r.free) { /* 泄漏保护 */ if (this.frame - r.used > 600) r.free = true; }
  },
  bind(rt) { const gl = this.gl; if (rt) { gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo); gl.viewport(0, 0, rt.w, rt.h); } else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); } },
  clear(rt, c = [0, 0, 0, 0]) { const gl = this.gl; this.bind(rt); gl.disable(gl.SCISSOR_TEST); gl.clearColor(c[0], c[1], c[2], c[3]); gl.clear(gl.COLOR_BUFFER_BIT); },
  // ---- MSAA 矢量绘制目标 ----
  msaa(w, h) {
    const gl = this.gl;
    if (this._ms && this._ms.w === w && this._ms.h === h) return this._ms;
    if (this._ms) { gl.deleteFramebuffer(this._ms.fbo); gl.deleteRenderbuffer(this._ms.c); gl.deleteRenderbuffer(this._ms.ds); }
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const c = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, c); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.maxSamples, gl.RGBA8, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c);
    const ds = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, ds); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.maxSamples, gl.DEPTH24_STENCIL8, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, ds);
    this._ms = { fbo, c, ds, w, h }; return this._ms;
  },
  beginVec(w, h) { const gl = this.gl; const ms = this.msaa(w, h); gl.bindFramebuffer(gl.FRAMEBUFFER, ms.fbo); gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT); return ms; },
  endVec(rt) { const gl = this.gl; const ms = this._ms; gl.bindFramebuffer(gl.READ_FRAMEBUFFER, ms.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, rt.fbo); gl.blitFramebuffer(0, 0, ms.w, ms.h, 0, 0, rt.w, rt.h, gl.COLOR_BUFFER_BIT, gl.NEAREST); gl.bindFramebuffer(gl.FRAMEBUFFER, null); },
  // ---- 着色器 ----
  compile(name, vs, fs) {
    const gl = this.gl;
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, '#version 300 es\nprecision highp float;\nprecision highp int;\n' + src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(name, gl.getShaderInfoLog(s), src); throw new Error('着色器编译失败: ' + name + ' ' + gl.getShaderInfoLog(s)); } return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('链接失败: ' + name + gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
    const a = {}; const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
    return (this.progs[name] = { p, u, a, name });
  },
  use(name) {
    let P = this.progs[name];
    if (!P) { const d = Shaders[name]; if (!d) throw new Error('无着色器 ' + name); P = this.compile(name, d.vs || Shaders.VS_QUAD, d.fs); }
    this.gl.useProgram(P.p); this._cur = P; this._tu = 0; return P;
  },
  // 设置 uniform（按类型推断）
  set(name, v) {
    const gl = this.gl; const loc = this._cur.u[name]; if (loc === undefined || loc === null) return;
    if (typeof v === 'number') gl.uniform1f(loc, v);
    else if (typeof v === 'boolean') gl.uniform1i(loc, v ? 1 : 0);
    else if (v.length === 2) gl.uniform2fv(loc, v); else if (v.length === 3) gl.uniform3fv(loc, v); else if (v.length === 4) gl.uniform4fv(loc, v);
    else if (v.length === 9) gl.uniformMatrix3fv(loc, false, v); else if (v.length === 16) gl.uniformMatrix4fv(loc, false, v instanceof Float32Array ? v : new Float32Array(v));
    else gl.uniform1fv(loc, v);
  },
  seti(name, v) { const loc = this._cur.u[name]; if (loc != null) this.gl.uniform1i(loc, v); },
  setv(name, arr, n) { const gl = this.gl; const loc = this._cur.u[name]; if (loc == null) return; if (n === 3) gl.uniform3fv(loc, arr); else if (n === 4) gl.uniform4fv(loc, arr); else gl.uniform1fv(loc, arr); },
  tex(name, t, target) { const gl = this.gl; const loc = this._cur.u[name]; if (loc == null) return; const unit = this._tu++; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target || gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); },
  drawQuad() { const gl = this.gl; gl.bindVertexArray(this.quadVAO); gl.drawArrays(gl.TRIANGLES, 0, 6); },
  // 全屏通道：输出到 dst
  pass(name, dst, setup, blend) {
    const gl = this.gl; this.bind(dst); this.use(name);
    if (blend === 'add') { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); } else if (blend === 'over') { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); } else gl.disable(gl.BLEND);
    this.set('uFull', 1);
    setup && setup();
    this.drawQuad(); gl.disable(gl.BLEND);
  },
  // 上传动态顶点
  upload(arr) {
    const gl = this.gl; const data = arr instanceof Float32Array ? arr : new Float32Array(arr);
    gl.bindVertexArray(this.dynVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
    if (data.byteLength > this.dynSize) { this.dynSize = data.byteLength * 2; gl.bufferData(gl.ARRAY_BUFFER, this.dynSize, gl.DYNAMIC_DRAW); }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data); return data.length / 2;
  },

  // ---------- 效果 ----------
  copy(src, dst) { this.pass('copy', dst, () => this.tex('uTex', src.tex)); },
  // 高斯模糊（sigma 以像素计），返回新 RT（调用方负责释放 src）
  blur(src, sigma, dirMask = [1, 1]) {
    if (sigma < 0.3) { const o = this.acquire(src.w, src.h, src.fmt); this.copy(src, o); return o; }
    let cur = src, scale = 1, owned = false; const chain = [];
    while (sigma / scale > 5 && cur.w > 8 && cur.h > 8) {
      const d = this.acquire(Math.ceil(cur.w / 2), Math.ceil(cur.h / 2), src.fmt); this.pass('down', d, () => { this.tex('uTex', cur.tex); this.set('uTexel', [1 / cur.w, 1 / cur.h]); });
      if (owned) chain.push(cur); cur = d; owned = true; scale *= 2;
    }
    const s = sigma / scale;
    const tmp = this.acquire(cur.w, cur.h, src.fmt), out = this.acquire(cur.w, cur.h, src.fmt);
    this.pass('blur', tmp, () => { this.tex('uTex', cur.tex); this.set('uDir', [dirMask[0] / cur.w, 0]); this.set('uSigma', s); });
    this.pass('blur', out, () => { this.tex('uTex', tmp.tex); this.set('uDir', [0, dirMask[1] / cur.h]); this.set('uSigma', s); });
    this.release(tmp); if (owned) this.release(cur); chain.forEach(c => this.release(c));
    if (scale === 1) return out;
    const up = this.acquire(src.w, src.h, src.fmt); this.pass('copy', up, () => this.tex('uTex', out.tex)); this.release(out); return up;
  },
  // 效果栈：对 RT 依次处理，返回新 RT；ctx 提供求值
  applyEffects(rt, effects, ev, rs) {
    let cur = rt;
    for (const e of effects) {
      if (!e.on) continue;
      const P = k => ev(e.p[k]);
      let nx = null;
      switch (e.type) {
        case 'blur': { const r = P('radius') * rs; if (r > 0.2) nx = this.blur(cur, r / 2); break; }
        case 'glow': {
          const th = P('threshold') / 100, r = P('radius') * rs, I = P('intensity'), tint = P('tint');
          const br = this.acquire(cur.w, cur.h, cur.fmt);
          this.pass('bright', br, () => { this.tex('uTex', cur.tex); this.set('uTh', th); this.set('uTint', tint); });
          const bl = this.blur(br, Math.max(0.5, r / 2)); this.release(br);
          const bl2 = this.blur(bl, Math.max(0.5, r / 6));
          nx = this.acquire(cur.w, cur.h, cur.fmt);
          this.pass('glowAdd', nx, () => { this.tex('uTex', cur.tex); this.tex('uGlow', bl.tex); this.tex('uGlow2', bl2.tex); this.set('uI', I); });
          this.release(bl); this.release(bl2); break;
        }
        case 'shadow': {
          const c = P('color'), op = P('opacity') / 100, ang = U.rad(P('angle')), dist = P('distance') * rs, soft = P('softness') * rs;
          const sh = this.acquire(cur.w, cur.h, cur.fmt);
          this.pass('shadowMake', sh, () => { this.tex('uTex', cur.tex); this.set('uOff', [Math.sin(ang) * dist / cur.w, -Math.cos(ang) * dist / cur.h]); this.set('uColor', [c[0], c[1], c[2], op]); });
          const sb = this.blur(sh, Math.max(0.3, soft / 2)); this.release(sh);
          nx = this.acquire(cur.w, cur.h, cur.fmt);
          this.pass('under', nx, () => { this.tex('uTex', cur.tex); this.tex('uUnder', sb.tex); });
          this.release(sb); break;
        }
        case 'hsl': { nx = this.acquire(cur.w, cur.h, cur.fmt); this.pass('hsl', nx, () => { this.tex('uTex', cur.tex); this.set('uHSL', [P('hue') / 360, P('sat') / 100, P('light') / 100]); }); break; }
        case 'tint': { nx = this.acquire(cur.w, cur.h, cur.fmt); this.pass('tint', nx, () => { this.tex('uTex', cur.tex); this.set('uBlack', P('black')); this.set('uWhite', P('white')); this.set('uAmt', P('amount') / 100); }); break; }
      }
      if (nx) { if (cur !== rt) this.release(cur); cur = nx; }
    }
    return cur;
  },
};

// ============ 着色器源码 ============
const Shaders = {
  VS_QUAD: `layout(location=0) in vec2 aPos; out vec2 vUV; void main(){ vUV=aPos; gl_Position=vec4(aPos*2.0-1.0,0,1); }`,
  copy: { fs: `in vec2 vUV; uniform sampler2D uTex; out vec4 o; void main(){ o=texture(uTex,vUV); }` },
  down: { fs: `in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; out vec4 o; void main(){ vec2 d=uTexel*0.5; o=(texture(uTex,vUV+vec2(-d.x,-d.y))+texture(uTex,vUV+vec2(d.x,-d.y))+texture(uTex,vUV+vec2(-d.x,d.y))+texture(uTex,vUV+vec2(d.x,d.y)))*0.25; }` },
  blur: { fs: `in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir; uniform float uSigma; out vec4 o;
    void main(){ float s=max(uSigma,0.01); int R=int(min(ceil(s*3.0),24.0)); vec4 acc=vec4(0); float wt=0.0;
      for(int i=-24;i<=24;i++){ if(i<-R||i>R) continue; float w=exp(-float(i*i)/(2.0*s*s)); acc+=texture(uTex,vUV+uDir*float(i))*w; wt+=w; }
      o=acc/wt; }` },
  bright: { fs: `in vec2 vUV; uniform sampler2D uTex; uniform float uTh; uniform vec3 uTint; out vec4 o;
    void main(){ vec4 c=texture(uTex,vUV); vec3 u=c.a>0.0?c.rgb/c.a:vec3(0); float l=max(max(u.r,u.g),u.b); float k=smoothstep(uTh-0.08,uTh+0.08,l); o=vec4(c.rgb*k*uTint, c.a*k); }` },
  glowAdd: { fs: `in vec2 vUV; uniform sampler2D uTex,uGlow,uGlow2; uniform float uI; out vec4 o;
    void main(){ vec4 c=texture(uTex,vUV); vec4 g=(texture(uGlow,vUV)*0.65+texture(uGlow2,vUV)*0.35)*uI; o=vec4(c.rgb+g.rgb, clamp(c.a+g.a*(1.0-c.a),0.0,1.0)); }` },
  shadowMake: { fs: `in vec2 vUV; uniform sampler2D uTex; uniform vec2 uOff; uniform vec4 uColor; out vec4 o;
    void main(){ float a=texture(uTex,vUV-vec2(uOff.x,-uOff.y)).a*uColor.a; o=vec4(uColor.rgb*a,a); }` },
  under: { fs: `in vec2 vUV; uniform sampler2D uTex,uUnder; out vec4 o; void main(){ vec4 c=texture(uTex,vUV), u=texture(uUnder,vUV); o=c+u*(1.0-c.a); }` },
  hsl: { fs: `in vec2 vUV; uniform sampler2D uTex; uniform vec3 uHSL; out vec4 o;
    vec3 rgb2hsl(vec3 c){ float mx=max(max(c.r,c.g),c.b), mn=min(min(c.r,c.g),c.b); float l=(mx+mn)*0.5; float h=0.0,s=0.0; if(mx>mn){ float d=mx-mn; s=l>0.5?d/(2.0-mx-mn):d/(mx+mn); if(mx==c.r) h=(c.g-c.b)/d+(c.g<c.b?6.0:0.0); else if(mx==c.g) h=(c.b-c.r)/d+2.0; else h=(c.r-c.g)/d+4.0; h/=6.0; } return vec3(h,s,l); }
    float hue2(float p,float q,float t){ t=fract(t); if(t<1.0/6.0) return p+(q-p)*6.0*t; if(t<0.5) return q; if(t<2.0/3.0) return p+(q-p)*(2.0/3.0-t)*6.0; return p; }
    vec3 hsl2rgb(vec3 h){ if(h.y<=0.0) return vec3(h.z); float q=h.z<0.5?h.z*(1.0+h.y):h.z+h.y-h.z*h.y; float p=2.0*h.z-q; return vec3(hue2(p,q,h.x+1.0/3.0),hue2(p,q,h.x),hue2(p,q,h.x-1.0/3.0)); }
    void main(){ vec4 c=texture(uTex,vUV); if(c.a<=0.0){o=c;return;} vec3 u=c.rgb/c.a; vec3 h=rgb2hsl(clamp(u,0.0,1.0)); h.x=fract(h.x+uHSL.x); h.y=clamp(h.y*(1.0+uHSL.y),0.0,1.0); vec3 r=hsl2rgb(h); r=uHSL.z>=0.0? mix(r,vec3(1),uHSL.z) : r*(1.0+uHSL.z); o=vec4(r*c.a,c.a); }` },
  tint: { fs: `in vec2 vUV; uniform sampler2D uTex; uniform vec3 uBlack,uWhite; uniform float uAmt; out vec4 o;
    void main(){ vec4 c=texture(uTex,vUV); if(c.a<=0.0){o=c;return;} vec3 u=c.rgb/c.a; float l=dot(u,vec3(0.299,0.587,0.114)); vec3 r=mix(u,mix(uBlack,uWhite,l),uAmt); o=vec4(r*c.a,c.a); }` },
  // 合成混合（预乘）
  composite: { fs: `in vec2 vUV; uniform sampler2D uDst,uSrc; uniform float uOp; uniform int uMode; out vec4 o;
    void main(){ vec4 s=texture(uSrc,vUV)*uOp, d=texture(uDst,vUV);
      if(uMode==0){ o=s+d*(1.0-s.a); return; }
      vec3 Cs=s.a>0.0?s.rgb/s.a:vec3(0), Cb=d.a>0.0?d.rgb/d.a:vec3(0); vec3 B;
      if(uMode==1) B=min(Cb+Cs,vec3(1)); else if(uMode==2) B=Cb+Cs-Cb*Cs; else if(uMode==3) B=Cb*Cs;
      else B=vec3(Cb.r<=0.5?2.0*Cb.r*Cs.r:1.0-2.0*(1.0-Cb.r)*(1.0-Cs.r), Cb.g<=0.5?2.0*Cb.g*Cs.g:1.0-2.0*(1.0-Cb.g)*(1.0-Cs.g), Cb.b<=0.5?2.0*Cb.b*Cs.b:1.0-2.0*(1.0-Cb.b)*(1.0-Cs.b));
      o=vec4(s.rgb*(1.0-d.a)+d.rgb*(1.0-s.a)+s.a*d.a*B, s.a+d.a*(1.0-s.a)); }` },
  mulMask: { fs: `in vec2 vUV; uniform sampler2D uTex,uMask; out vec4 o; void main(){ o=texture(uTex,vUV)*texture(uMask,vUV).r; }` },
  matte: { fs: `in vec2 vUV; uniform sampler2D uTex,uMatte; uniform int uMode; out vec4 o;
    void main(){ vec4 m=texture(uMatte,vUV); float f; if(uMode<2) f=m.a; else { vec3 u=m.a>0.0?m.rgb/m.a:vec3(0); f=dot(u,vec3(0.299,0.587,0.114))*m.a; } if(uMode==1||uMode==3) f=1.0-f; o=texture(uTex,vUV)*f; }` },
  maskCombine: { fs: `in vec2 vUV; uniform sampler2D uAcc,uM; uniform int uMode; uniform float uInv,uOp; out vec4 o;
    void main(){ float a=texture(uAcc,vUV).r; float m=texture(uM,vUV).a; if(uInv>0.5) m=1.0-m; m*=uOp; float r;
      if(uMode==0) r=a+m-a*m; else if(uMode==1) r=a*(1.0-m); else if(uMode==2) r=a*m; else if(uMode==3) r=abs(a-m); else r=a; o=vec4(r,r,r,1); }` },
  mixAdj: { fs: `in vec2 vUV; uniform sampler2D uA,uB,uM; uniform float uOp; out vec4 o; void main(){ float m=texture(uM,vUV).r*uOp; o=mix(texture(uA,vUV),texture(uB,vUV),m); }` },
  scale: { fs: `in vec2 vUV; uniform sampler2D uTex; uniform float uK; out vec4 o; void main(){ o=texture(uTex,vUV)*uK; }` },
  pickLayer: { fs: `in vec2 vUV; uniform sampler2D uTex; uniform vec4 uId; out vec4 o; void main(){ if(texture(uTex,vUV).a<0.08) discard; o=uId; }` },
  tonemap: { fs: `in vec2 vUV; uniform sampler2D uTex; uniform float uExp; out vec4 o;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
    void main(){ vec4 c=texture(uTex,vUV); float a=clamp(c.a,0.0,1.0); vec3 col=aces(max(c.rgb*uExp,vec3(0))); col=pow(col,vec3(1.0/2.2)); float lum=max(max(col.r,col.g),col.b); a=max(a,min(1.0,lum)); o=vec4(col,a); }` },
  // 视图：棋盘格/背景色 + 合成图
  view: { vs: `layout(location=0) in vec2 aPos; uniform vec4 uRect; out vec2 vUV; out vec2 vPx; void main(){ vUV=aPos; vec2 p=uRect.xy+aPos*uRect.zw; vPx=p; gl_Position=vec4(p*2.0-1.0,0,1); }`,
    fs: `in vec2 vUV; in vec2 vPx; uniform sampler2D uTex; uniform vec3 uBg; uniform float uChecker; uniform vec2 uScreen; out vec4 o;
    void main(){ vec4 c=texture(uTex,vUV); vec3 bg=uBg; if(uChecker>0.5){ vec2 q=floor(vPx*uScreen/12.0); float k=mod(q.x+q.y,2.0); bg=mix(vec3(0.16),vec3(0.22),k); } o=vec4(c.rgb+bg*(1.0-c.a),1.0); }` },
  // 矢量填充（模板 + 覆盖）
  vec: { vs: `layout(location=0) in vec2 aPos; uniform mat3 uM; uniform vec2 uRes; out vec2 vL; void main(){ vL=aPos; vec3 p=uM*vec3(aPos,1.0); gl_Position=vec4(p.x/uRes.x*2.0-1.0, 1.0-p.y/uRes.y*2.0, 0, 1); }`,
    fs: `in vec2 vL; uniform vec4 uColor; uniform int uGrad; uniform vec2 uG0,uG1; uniform vec4 uC1,uC2; out vec4 o;
    void main(){ if(uGrad==0){ o=uColor; return; } float t; if(uGrad==1){ vec2 d=uG1-uG0; t=dot(vL-uG0,d)/max(dot(d,d),1e-6); } else { t=length(vL-uG0)/max(length(uG1-uG0),1e-6); } t=clamp(t,0.0,1.0); vec4 c=mix(uC1,uC2,t); o=vec4(c.rgb*c.a,c.a)*uColor.a; }` },
  // 纹理四边形（单位方块 → 像素）
  texQuad: { vs: `layout(location=0) in vec2 aPos; uniform mat3 uM; uniform vec2 uRes; out vec2 vUV; void main(){ vUV=vec2(aPos.x,1.0-aPos.y); vec3 p=uM*vec3(aPos,1.0); gl_Position=vec4(p.x/uRes.x*2.0-1.0, 1.0-p.y/uRes.y*2.0, 0, 1); }`,
    fs: `in vec2 vUV; uniform sampler2D uTex; uniform float uOp; out vec4 o; void main(){ o=texture(uTex,vUV)*uOp; }` },
};
