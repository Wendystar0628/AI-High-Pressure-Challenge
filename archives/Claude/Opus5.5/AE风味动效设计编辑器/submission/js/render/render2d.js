// 二维合成管线：形状模板填充、蒙版、效果、混合模式、轨道遮罩、调整层、预合成、运动模糊
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, M4 = U.M4, P = AE.Path, E = AE.Eval, GL = AE.GL, C = AE.Content;
  const R = AE.R = { stats: { layers: 0, frames: 0 } };

  const FSV = `layout(location=0) in vec2 aPos; out vec2 vUV; void main(){ vUV=aPos; gl_Position=vec4(aPos*2.0-1.0,0.0,1.0); }`;
  const SH = {
    fan: [`layout(location=0) in vec2 aPos; uniform mat4 uM; void main(){ gl_Position = uM*vec4(aPos,0.0,1.0); }`, `out vec4 o; void main(){ o=vec4(1.0); }`],
    cover: [`layout(location=0) in vec2 aPos; uniform mat4 uM; out vec2 vL; void main(){ vL=aPos; gl_Position = uM*vec4(aPos,0.0,1.0); }`,
      `in vec2 vL; out vec4 o; uniform vec4 uColor; uniform int uGT; uniform vec2 uGS; uniform vec2 uGE; uniform vec4 uSC[8]; uniform float uST[8]; uniform int uSN; uniform float uOp;
      void main(){
        vec4 c = uColor;
        if(uGT>0){
          float t; vec2 d=uGE-uGS;
          if(uGT==1) t = dot(vL-uGS,d)/max(dot(d,d),1e-6); else t = length(vL-uGS)/max(length(d),1e-6);
          t=clamp(t,0.0,1.0); c=uSC[0];
          for(int i=1;i<8;i++){ if(i>=uSN) break; float a=uST[i-1], b=uST[i]; if(t>=a){ c = mix(uSC[i-1],uSC[i],clamp((t-a)/max(b-a,1e-5),0.0,1.0)); } }
          c = vec4(c.rgb*c.a, c.a);
        }
        o = c*uOp;
      }`],
    tex: [`layout(location=0) in vec2 aPos; uniform mat4 uM; uniform vec4 uRect; uniform vec4 uUV; out vec2 vUV; void main(){ vUV = mix(uUV.xy, uUV.zw, aPos); gl_Position = uM*vec4(mix(uRect.xy,uRect.zw,aPos),0.0,1.0); }`,
      `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform float uOp; void main(){ o = texture(uTex,vUV)*uOp; }`],
    copy: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform float uOp; void main(){ o=texture(uTex,vUV)*uOp; }`],
    comp: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uDst; uniform sampler2D uSrc; uniform sampler2D uMat; uniform int uMode; uniform int uMM; uniform float uOp;
      void main(){
        vec4 d=texture(uDst,vUV); vec4 s=texture(uSrc,vUV)*uOp;
        if(uMM>0){ vec4 m=texture(uMat,vUV); float f = uMM==1?m.a: uMM==2?1.0-m.a: uMM==3? dot(m.rgb,vec3(0.2126,0.7152,0.0722)) : 1.0-dot(m.rgb,vec3(0.2126,0.7152,0.0722)); s*=clamp(f,0.0,1.0); }
        if(uMode==1){ o = vec4(d.rgb+s.rgb, s.a+d.a-s.a*d.a); return; }
        vec3 cs = s.a>1e-5? s.rgb/s.a : vec3(0.0); vec3 cb = d.a>1e-5? d.rgb/d.a : vec3(0.0);
        vec3 B = cs;
        if(uMode==2) B = cs+cb-cs*cb;
        else if(uMode==3) B = cs*cb;
        else if(uMode==4) B = mix(2.0*cs*cb, 1.0-2.0*(1.0-cs)*(1.0-cb), step(0.5,cb));
        vec3 co = s.rgb*(1.0-d.a) + d.rgb*(1.0-s.a) + s.a*d.a*B;
        o = vec4(co, s.a + d.a*(1.0-s.a));
      }`],
    maskComb: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uAcc; uniform sampler2D uM; uniform int uMode; uniform int uInv; uniform int uFirst;
      void main(){ float a = uFirst==1 ? (uMode==1?1.0:0.0) : texture(uAcc,vUV).r; float m = texture(uM,vUV).a; if(uInv==1) m = 1.0-m;
        float r = uMode==0 ? a+m-a*m : uMode==1 ? a*(1.0-m) : uMode==2 ? (uFirst==1? m : a*m) : max(a,m);
        o = vec4(r,r,r,r); }`],
    applyMask: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform sampler2D uM; void main(){ o = texture(uTex,vUV)*texture(uM,vUV).r; }`],
    blur: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec2 uDir; uniform float uSigma; uniform int uN;
      void main(){ vec4 s=texture(uTex,vUV); float w=1.0; for(int i=1;i<=64;i++){ if(i>uN) break; float x=float(i); float k=exp(-x*x/(2.0*uSigma*uSigma)); s += (texture(uTex,vUV+uDir*x)+texture(uTex,vUV-uDir*x))*k; w+=2.0*k; } o = s/w; }`],
    down: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec2 uPx; void main(){ o = 0.25*(texture(uTex,vUV+uPx*vec2(-0.5,-0.5))+texture(uTex,vUV+uPx*vec2(0.5,-0.5))+texture(uTex,vUV+uPx*vec2(-0.5,0.5))+texture(uTex,vUV+uPx*vec2(0.5,0.5))); }`],
    thresh: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform float uT; uniform vec4 uCol; uniform int uUseCol;
      void main(){ vec4 c=texture(uTex,vUV); vec3 u = c.a>1e-5? c.rgb/c.a : vec3(0.0); float l = max(max(u.r,u.g),u.b); float k = smoothstep(uT, min(uT+0.25,1.0001), l)*c.a; vec3 col = uUseCol==1? uCol.rgb*l : u; o = vec4(col*k, k); }`],
    addTex: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uA; uniform sampler2D uB; uniform float uK; void main(){ vec4 a=texture(uA,vUV); vec4 b=texture(uB,vUV)*uK; o = vec4(a.rgb+b.rgb, clamp(a.a+b.a-a.a*b.a,0.0,1.0)); }`],
    shadow: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec2 uOff; uniform vec4 uCol; void main(){ float a = texture(uTex, vUV-uOff).a; o = vec4(uCol.rgb*uCol.a*a, uCol.a*a); }`],
    over: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uA; uniform sampler2D uB; void main(){ vec4 a=texture(uA,vUV), b=texture(uB,vUV); o = a + b*(1.0-a.a); }`],
    hsl: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform float uH; uniform float uS; uniform float uL;
      vec3 rgb2hsl(vec3 c){ float mx=max(max(c.r,c.g),c.b), mn=min(min(c.r,c.g),c.b), l=(mx+mn)*0.5, h=0.0, s=0.0; if(mx>mn){ float d=mx-mn; s = l>0.5? d/(2.0-mx-mn) : d/(mx+mn); if(mx==c.r) h=(c.g-c.b)/d+(c.g<c.b?6.0:0.0); else if(mx==c.g) h=(c.b-c.r)/d+2.0; else h=(c.r-c.g)/d+4.0; h/=6.0; } return vec3(h,s,l); }
      float h2r(float p,float q,float t){ t=fract(t); if(t<1.0/6.0) return p+(q-p)*6.0*t; if(t<0.5) return q; if(t<2.0/3.0) return p+(q-p)*(2.0/3.0-t)*6.0; return p; }
      vec3 hsl2rgb(vec3 c){ if(c.y<=0.0) return vec3(c.z); float q = c.z<0.5? c.z*(1.0+c.y) : c.z+c.y-c.z*c.y; float p=2.0*c.z-q; return vec3(h2r(p,q,c.x+1.0/3.0),h2r(p,q,c.x),h2r(p,q,c.x-1.0/3.0)); }
      void main(){ vec4 c=texture(uTex,vUV); if(c.a<1e-5){ o=c; return; } vec3 u=c.rgb/c.a; vec3 h=rgb2hsl(clamp(u,0.0,1.0)); h.x=fract(h.x+uH); h.y=clamp(h.y*(1.0+uS),0.0,1.0); vec3 r=hsl2rgb(h);
        if(uL>0.0) r = mix(r,vec3(1.0),uL); else r = r*(1.0+uL); o = vec4(r*c.a,c.a); }`],
    tint: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec4 uCol; uniform float uK; void main(){ vec4 c=texture(uTex,vUV); vec3 u = c.a>1e-5? c.rgb/c.a:vec3(0.0); float l=dot(u,vec3(0.2126,0.7152,0.0722)); vec3 r = mix(u, uCol.rgb*l*1.6, uK); o=vec4(r*c.a,c.a); }`],
    mixAdj: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uA; uniform sampler2D uB; uniform sampler2D uM; uniform float uOp; uniform int uHasM; void main(){ float k = uOp*(uHasM==1? texture(uM,vUV).r : 1.0); o = mix(texture(uA,vUV), texture(uB,vUV), k); }`],
    accum: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform float uK; void main(){ o = texture(uTex,vUV)*uK; }`],
    tdSlice: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform sampler2D uMap; uniform float uK; uniform float uN; uniform int uInv; uniform vec2 uMOff; uniform float uMScale;
      void main(){ vec2 muv = (vUV - 0.5 - uMOff)/uMScale + 0.5; vec4 m = texture(uMap, muv); float l = dot(m.rgb, vec3(0.2126,0.7152,0.0722)); if(uInv==1) l = 1.0-l; float x = l*(uN-1.0); float w = max(0.0, 1.0-abs(x-uK)); o = texture(uTex,vUV)*w; }`],
    echoMax: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uA; uniform sampler2D uB; uniform float uK; void main(){ o = max(texture(uA,vUV), texture(uB,vUV)*uK); }`],
    screenK: [FSV, `in vec2 vUV; out vec4 o; uniform sampler2D uA; uniform sampler2D uB; uniform float uK; void main(){ vec4 a=texture(uA,vUV), b=texture(uB,vUV)*uK; o = a+b-a*b; }`],
  };
  R.prog = (n) => GL.prog(n, SH[n][0], SH[n][1]);
  R.SH = SH;

  // ---------- 形状几何 → 三角形 ----------
  function fanTris(polys) {
    let n = 0; for (const p of polys) if (p.p.length >= 6) n += (p.p.length / 2 - 2) * 6;
    const out = new Float32Array(n); let o = 0;
    for (const pl of polys) {
      const p = pl.p, m = p.length / 2; if (m < 3) continue;
      for (let k = 1; k < m - 1; k++) { out[o++] = p[0]; out[o++] = p[1]; out[o++] = p[2 * k]; out[o++] = p[2 * k + 1]; out[o++] = p[2 * k + 2]; out[o++] = p[2 * k + 3]; }
    }
    return out;
  }
  function strokeTris(polys, w, join, cap, pxPer) {
    const hw = w / 2, out = [];
    const nSeg = U.clamp(Math.ceil(hw * pxPer * 0.9), 6, 48);
    const circle = (x, y) => { for (let k = 0; k < nSeg; k++) { const a0 = k / nSeg * Math.PI * 2, a1 = (k + 1) / nSeg * Math.PI * 2; out.push(x, y, x + Math.cos(a0) * hw, y + Math.sin(a0) * hw, x + Math.cos(a1) * hw, y + Math.sin(a1) * hw); } };
    for (const pl of polys) {
      const p = pl.p, m = p.length / 2; if (m < 2) { if (m === 1 && cap === 'round') circle(p[0], p[1]); continue; }
      const closed = pl.c && m > 2, segs = closed ? m : m - 1;
      const dirs = [];
      for (let k = 0; k < segs; k++) {
        const a = k, b = (k + 1) % m;
        let dx = p[2 * b] - p[2 * a], dy = p[2 * b + 1] - p[2 * a + 1]; const L = Math.hypot(dx, dy);
        if (L < 1e-9) { dirs.push(null); continue; }
        dx /= L; dy /= L; dirs.push([dx, dy]);
        let ax = p[2 * a], ay = p[2 * a + 1], bx = p[2 * b], by = p[2 * b + 1];
        if (!closed && cap === 'square') { if (k === 0) { ax -= dx * hw; ay -= dy * hw; } if (k === segs - 1) { bx += dx * hw; by += dy * hw; } }
        const nx = -dy * hw, ny = dx * hw;
        out.push(ax + nx, ay + ny, ax - nx, ay - ny, bx + nx, by + ny, bx + nx, by + ny, ax - nx, ay - ny, bx - nx, by - ny);
      }
      // 连接
      const nj = closed ? m : m;
      for (let k = 0; k < nj; k++) {
        const isEnd = !closed && (k === 0 || k === m - 1);
        const x = p[2 * k], y = p[2 * k + 1];
        if (isEnd) { if (cap === 'round') circle(x, y); continue; }
        if (join === 'round') { circle(x, y); continue; }
        const d1 = dirs[(k - 1 + segs) % segs], d2 = dirs[k % segs];
        if (!d1 || !d2) continue;
        const cr = d1[0] * d2[1] - d1[1] * d2[0]; if (Math.abs(cr) < 1e-6) continue;
        const s = cr > 0 ? -1 : 1;
        const n1 = [-d1[1] * hw * s, d1[0] * hw * s], n2 = [-d2[1] * hw * s, d2[0] * hw * s];
        out.push(x, y, x + n1[0], y + n1[1], x + n2[0], y + n2[1]);
        if (join === 'miter') {
          const mx = n1[0] + n2[0], my = n1[1] + n2[1], ml = Math.hypot(mx, my);
          const cos = ml / (2 * hw); const lim = 4;
          if (cos > 1 / lim) { const L2 = hw / cos; out.push(x + n1[0], y + n1[1], x + mx / ml * L2, y + my / ml * L2, x + n2[0], y + n2[1]); }
        }
      }
    }
    return new Float32Array(out);
  }
  R.strokeTris = strokeTris; R.fanTris = fanTris;
  // 在当前多重采样目标上绘制若干绘制项（图层空间），M：图层空间→NDC
  R.drawItems = (draws, M, pxPer, opMul = 1) => {
    const gl = GL.gl;
    const fan = R.prog('fan'), cover = R.prog('cover');
    gl.enable(gl.STENCIL_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.DEPTH_TEST);
    const m4 = GL.m4(M);
    for (const d of draws) {
      if (!d.polys.length) continue;
      const op = d.opacity * opMul * (d.color[3] === undefined ? 1 : d.color[3]);
      if (op <= 0.001) continue;
      let tris;
      if (d.kind === 'fill') tris = fanTris(d.polys.filter(p => p.c !== false || p.p.length >= 6));
      else tris = strokeTris(d.polys, Math.max(0.01, d.width), d.join || 'round', d.cap || 'round', pxPer);
      if (!tris.length) continue;
      // 模板
      gl.colorMask(false, false, false, false); GL.blend(null);
      gl.stencilFunc(gl.ALWAYS, 0, 0xff);
      if (d.kind === 'fill' && d.rule === 'evenodd') gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
      else if (d.kind === 'fill') { gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP); gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP); }
      else gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR_WRAP);
      GL.use(fan, { uM: m4 });
      GL.drawDyn(tris, gl.TRIANGLES);
      // 覆盖
      gl.colorMask(true, true, true, true); GL.blend('pre');
      gl.stencilFunc(gl.NOTEQUAL, 0, d.kind === 'fill' && d.rule === 'evenodd' ? 1 : 0xff);
      gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = 0; k < tris.length; k += 2) { const x = tris[k], y = tris[k + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const c = d.color;
      const u = { uM: m4, uColor: [c[0], c[1], c[2], 1], uOp: op, uGT: GL.int(0) };
      if (d.grad) {
        const st = d.grad.stops.slice(0, 8), cols = new Float32Array(32), ts = new Float32Array(8);
        st.forEach((s, i) => { ts[i] = s[0]; cols.set([s[1][0], s[1][1], s[1][2], s[1][3] === undefined ? 1 : s[1][3]], i * 4); });
        Object.assign(u, { uGT: GL.int(d.grad.type + 1), uGS: d.grad.s, uGE: d.grad.e, uSC: { v4a: cols }, uST: { fa: ts }, uSN: GL.int(st.length), uOp: d.opacity * opMul });
      }
      GL.use(cover, u);
      GL.drawDyn(new Float32Array([x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1]), gl.TRIANGLES);
    }
    gl.disable(gl.STENCIL_TEST);
    GL.blend(null);
  };
  // 纹理四边形
  R.drawTex = (tex, rect, M, op = 1, uv = [0, 0, 1, 1]) => {
    GL.blend('pre');
    GL.use(R.prog('tex'), { uM: GL.m4(M), uRect: rect, uUV: uv, uTex: tex, uOp: op });
    GL.drawQuad();
    GL.blend(null);
  };
  R.fs = (name, out, uniforms, blend) => { GL.bind(out); if (blend) GL.blend(blend); else GL.blend(null); GL.use(R.prog(name), uniforms); GL.drawQuad(); GL.blend(null); return out; };
  R.copyTex = (src, op = 1) => { const t = GL.target(src.w, src.h, 'c'); R.fs('copy', t, { uTex: src, uOp: op }); return t; };

  // ---------- 模糊 ----------
  R.blur = (src, sigma, dirMask = 3) => {
    if (sigma < 0.3) return R.copyTex(src);
    let cur = src, w = src.w, h = src.h, level = 0, owned = false;
    let s = sigma;
    while (s > 6 && w > 8 && h > 8) { // 降采样
      const nw = Math.ceil(w / 2), nh = Math.ceil(h / 2), t = GL.target(nw, nh, 'c');
      R.fs('down', t, { uTex: cur, uPx: [1 / w, 1 / h] });
      if (owned) GL.release(cur);
      cur = t; owned = true; w = nw; h = nh; s /= 2; level++;
    }
    const n = Math.min(64, Math.ceil(s * 3));
    const a = GL.target(w, h, 'c'), b = GL.target(w, h, 'c');
    if (dirMask & 1) R.fs('blur', a, { uTex: cur, uDir: [1 / w, 0], uSigma: s, uN: GL.int(n) }); else R.fs('copy', a, { uTex: cur, uOp: 1 });
    if (dirMask & 2) R.fs('blur', b, { uTex: a, uDir: [0, 1 / h], uSigma: s, uN: GL.int(n) }); else R.fs('copy', b, { uTex: a, uOp: 1 });
    GL.release(a); if (owned) GL.release(cur);
    if (level === 0) return b;
    const out = GL.target(src.w, src.h, 'c'); R.fs('copy', out, { uTex: b, uOp: 1 }); GL.release(b);
    return out;
  };

  // ---------- 空间 ----------
  // space: {rect:[x0,y0,x1,y1](合成像素), w,h(像素), scale(像素/合成像素), proj}
  R.space = (rect, w, h) => ({ rect, w: Math.round(w), h: Math.round(h), scale: w / (rect[2] - rect[0]), proj: M4.ortho2D(rect[0], rect[1], rect[2], rect[3]) });
  const layerScale = (W) => Math.sqrt(Math.abs(W[0] * W[5] - W[1] * W[4])) || 1;
  R.layerScale = layerScale;

  // ---------- 图层内容 ----------
  // 在当前绑定的多重采样目标上绘制图层内容；M：图层空间→NDC，pxPer：每图层单位像素数
  R.drawContent = (layer, t, ctx, M, pxPer, opts) => {
    if (layer.puppet && layer.puppet.on && AE.Puppet && !(opts && opts.noPuppet)) { if (AE.Puppet.drawLayer(layer, t, ctx, M, pxPer, opts)) return; }
    const tol = 0.3 / Math.max(1e-3, pxPer);
    if (layer.type === 'shape' || layer.type === 'text' || layer.type === 'solid') {
      const draws = C.layerDraws(layer, t, ctx, tol);
      R.drawItems(draws, M, pxPer);
    } else if (layer.type === 'precomp') {
      const src = E.comp(layer.precomp.source); if (!src) return;
      const inner = R.precompTexture(layer, t, ctx, pxPer, opts);
      if (opts && opts._target) GL.bind(opts._target, true);
      if (inner) { R.drawTex(inner, [0, 0, src.width, src.height], M, 1); GL.release(inner); }
    }
  };
  R.precompTexture = (layer, t, ctx, pxPer, opts = {}) => {
    const src = E.comp(layer.precomp.source); if (!src) return null;
    const cctx = E.child(ctx, layer, t); if (!cctx) return null;
    if (cctx.inst.depth > 12) return null;
    const it = E.innerTime(layer, t, ctx);
    let s = Math.min(pxPer, 2.5, GL.maxTex / src.width, GL.maxTex / src.height);
    s = Math.max(s, 0.05);
    const sp = R.space([0, 0, src.width, src.height], src.width * s, src.height * s);
    return R.renderComp(src, it, cctx, sp, { bg: false, mbOffset: opts.mbOffset || 0, mbParent: layer.motionBlur, quality: opts.quality });
  };
  // 图层内容边界（图层空间）
  R.contentBounds = (layer, t, ctx) => {
    if (layer.type === 'precomp') { const s = E.comp(layer.precomp.source); return s ? [0, 0, s.width, s.height] : null; }
    if (layer.type === 'solid') return [0, 0, layer.solid.width, layer.solid.height];
    if (layer.type === 'shape' || layer.type === 'text') return C.drawBounds(C.layerDraws(layer, t, ctx, 1));
    return null;
  };
  R.effectPad = (layer, t, ctx) => {
    let pad = 0;
    for (const fx of layer.effects) {
      if (!fx.on) continue;
      const v = (k) => E.prop(fx.p[k], t, ctx, layer);
      if (fx.type === 'blur') pad += v('radius') * 1.6;
      if (fx.type === 'glow') pad += v('radius') * 2;
      if (fx.type === 'shadow') pad += v('distance') + v('softness') * 1.6;
    }
    for (const m of layer.masks) if (m.on !== false) pad = Math.max(pad, Math.abs(E.prop(m.expansion, t, ctx, layer)));
    return pad;
  };

  // 渲染单个二维图层到视图空间（内容→蒙版→效果；变换在光栅化时应用）
  R.layerTex = (layer, t, ctx, space, opts = {}) => {
    const W = opts.world || E.world(layer, t, ctx);
    const M = M4.mul(space.proj, W);
    const ls = layerScale(W);
    const pxPer = space.scale * ls;
    const render = (tt) => {
      const Wt = tt === t ? W : E.world(layer, tt, ctx), Mt = M4.mul(space.proj, Wt);
      const T = GL.target(space.w, space.h, 'ms');
      GL.bind(T, true); GL.clear();
      R.drawContent(layer, tt, ctx, Mt, space.scale * layerScale(Wt), Object.assign({}, opts, { _target: T }));
      GL.resolve(T);
      let out = T;
      if (layer.masks.length) { const mk = R.maskTex(layer, tt, ctx, space, Mt, space.scale * layerScale(Wt)); if (mk) { const o2 = GL.target(space.w, space.h, 'c'); R.fs('applyMask', o2, { uTex: out, uM: mk }); GL.release(mk); GL.release(out); out = o2; } }
      return out;
    };
    let tex = render(t);
    tex = R.applyEffects(layer, tex, t, ctx, space, pxPer, (tt, upto) => {
      let x = render(tt);
      return R.applyEffects(layer, x, tt, ctx, space, pxPer, null, upto);
    });
    return tex;
  };
  // 局部空间纹理（用于三维表面）：返回 {tex, rect}
  R.layerTexLocal = (layer, t, ctx, pxPer, opts = {}) => {
    const b0 = R.contentBounds(layer, t, ctx);
    if (!b0) return null;
    const pad = R.effectPad(layer, t, ctx) + 2;
    let rect = [b0[0] - pad, b0[1] - pad, b0[2] + pad, b0[3] + pad];
    let w = (rect[2] - rect[0]) * pxPer, h = (rect[3] - rect[1]) * pxPer;
    const cap = 2048 / Math.max(w, h); if (cap < 1) { w *= cap; h *= cap; pxPer *= cap; }
    if (w < 1 || h < 1) return null;
    const space = R.space(rect, w, h);
    const tex = R.layerTex(layer, t, ctx, space, Object.assign({}, opts, { world: M4.ident() }));
    return { tex, rect };
  };
  // 蒙版覆盖（R 通道）
  R.maskTex = (layer, t, ctx, space, M, pxPer) => {
    const masks = layer.masks.filter(m => m.on !== false && m.mode !== 'none');
    if (!masks.length) return null;
    let acc = GL.target(space.w, space.h, 'c8');
    masks.forEach((mk, i) => {
      const sh = E.prop(mk.path, t, ctx, layer) || [];
      let polys = sh.map(c => P.flatten(c, 0.3 / pxPer));
      const ex = E.prop(mk.expansion, t, ctx, layer);
      if (Math.abs(ex) > 0.01) polys = polys.map(p => ({ c: true, p: P.offsetPoly(p.p, ex, true, 2) }));
      const T = GL.target(space.w, space.h, 'ms');
      GL.bind(T, true); GL.clear();
      R.drawItems([{ kind: 'fill', polys, color: [1, 1, 1, 1], opacity: U.clamp(E.prop(mk.opacity, t, ctx, layer) / 100, 0, 1), rule: 'nonzero' }], M, pxPer);
      GL.resolve(T);
      let m = T;
      const fe = E.prop(mk.feather, t, ctx, layer);
      if (fe > 0.1) { const b = R.blur(T, fe * pxPer * 0.5); GL.release(T); m = b; }
      const out = GL.target(space.w, space.h, 'c8');
      const mode = { add: 0, subtract: 1, intersect: 2, lighten: 3 }[mk.mode] || 0;
      R.fs('maskComb', out, { uAcc: acc, uM: m, uMode: GL.int(mode), uInv: GL.int(mk.inverted ? 1 : 0), uFirst: GL.int(i === 0 ? 1 : 0) });
      GL.release(m); GL.release(acc); acc = out;
    });
    return acc;
  };
  // 效果链
  R.applyEffects = (layer, tex, t, ctx, space, pxPer, renderAt, upto) => {
    const list = layer.effects;
    const n = upto === undefined ? list.length : upto;
    for (let i = 0; i < n; i++) {
      const fx = list[i]; if (!fx.on) continue;
      const out = R.effect(fx, tex, layer, t, ctx, space, pxPer, renderAt ? (tt) => renderAt(tt, i) : null);
      if (out !== tex) { GL.release(tex); tex = out; }
    }
    return tex;
  };
  R.effect = (fx, tex, layer, t, ctx, space, pxPer, renderAt) => {
    const v = (k) => E.prop(fx.p[k], t, ctx, layer);
    switch (fx.type) {
      case 'blur': return R.blur(tex, v('radius') * pxPer * 0.5);
      case 'glow': {
        const th = GL.target(tex.w, tex.h, 'c');
        const col = v('color');
        R.fs('thresh', th, { uTex: tex, uT: U.clamp(v('threshold') / 100, 0, 0.999), uCol: col, uUseCol: GL.int(fx.useColor ? 1 : 0) });
        const r = v('radius') * pxPer;
        const b1 = R.blur(th, r * 0.25), b2 = R.blur(th, r * 0.6);
        GL.release(th);
        const out = GL.target(tex.w, tex.h, 'c'), mid = GL.target(tex.w, tex.h, 'c');
        const k = v('intensity');
        R.fs('addTex', mid, { uA: tex, uB: b1, uK: k * 0.6 });
        R.fs('addTex', out, { uA: mid, uB: b2, uK: k * 0.8 });
        GL.release(b1); GL.release(b2); GL.release(mid);
        return out;
      }
      case 'shadow': {
        const ang = v('angle') * U.deg, dist = v('distance') * pxPer;
        // 画面方向：角度 0 = 向上，顺时针（与 AE 一致），屏幕坐标 y 向下
        const ox = Math.sin(ang) * dist / tex.w, oy = -Math.cos(ang) * dist / tex.h;
        const sh = GL.target(tex.w, tex.h, 'c');
        const col = v('color');
        R.fs('shadow', sh, { uTex: tex, uOff: [ox, -oy], uCol: [col[0], col[1], col[2], U.clamp(v('opacity') / 100, 0, 1)] });
        const bl = R.blur(sh, v('softness') * pxPer * 0.5); GL.release(sh);
        const out = GL.target(tex.w, tex.h, 'c');
        R.fs('over', out, { uA: tex, uB: bl }); GL.release(bl);
        return out;
      }
      case 'hsl': { const out = GL.target(tex.w, tex.h, 'c'); R.fs('hsl', out, { uTex: tex, uH: v('hue') / 360, uS: v('sat') / 100, uL: v('light') / 100 }); return out; }
      case 'tint': { const out = GL.target(tex.w, tex.h, 'c'); R.fs('tint', out, { uTex: tex, uCol: v('color'), uK: U.clamp(v('amount') / 100, 0, 1) }); return out; }
      case 'echo': {
        if (!renderAt) return tex;
        const dt = v('time'), n = Math.max(0, Math.min(32, Math.round(v('count')))), decay = v('decay');
        let acc = R.copyTex(tex);
        const mode = fx.mode || 'add';
        for (let k = 1; k <= n; k++) {
          const e = renderAt(t + dt * k);
          const out = GL.target(tex.w, tex.h, 'c'), K = Math.pow(decay, k);
          if (mode === 'max') R.fs('echoMax', out, { uA: acc, uB: e, uK: K });
          else if (mode === 'screen') R.fs('screenK', out, { uA: acc, uB: e, uK: K });
          else if (mode === 'behind') { const tmp = GL.target(tex.w, tex.h, 'c'); R.fs('copy', tmp, { uTex: e, uOp: K }); R.fs('over', out, { uA: acc, uB: tmp }); GL.release(tmp); }
          else R.fs('addTex', out, { uA: acc, uB: e, uK: K });
          GL.release(e); GL.release(acc); acc = out;
        }
        return acc;
      }
      case 'timeDisplace': {
        if (!renderAt) return tex;
        const comp = ctx.comp, ml = fx.mapLayer ? E.layer(comp, fx.mapLayer) : null;
        if (!ml) return tex;
        const map = R.layerTex(ml, t, ctx, space, { forMatte: true });
        const N = Math.max(2, Math.min(24, Math.round(v('slices')))), maxS = v('maxShift');
        const off = v('mapOffset'), msc = Math.max(1, v('mapScale')) / 100;
        const acc = GL.target(tex.w, tex.h, 'c');
        GL.bind(acc); GL.clear();
        for (let k = 0; k < N; k++) {
          const tt = t - maxS * k / (N - 1);
          const sl = k === 0 ? tex : renderAt(tt);
          R.fs('tdSlice', acc, { uTex: sl, uMap: map, uK: k, uN: N, uInv: GL.int(fx.invert ? 1 : 0), uMOff: [off[0] / (space.rect[2] - space.rect[0]), off[1] / (space.rect[3] - space.rect[1])], uMScale: msc }, 'add');
          if (sl !== tex) GL.release(sl);
        }
        GL.release(map);
        return acc;
      }
    }
    return tex;
  };
  // 合成一层：dst ← blend(dst, src)
  R.composite = (dst, src, mode, op, matte, mm) => {
    const out = GL.target(dst.w, dst.h, 'c');
    const MODES = { normal: 0, add: 1, screen: 2, multiply: 3, overlay: 4 };
    const MM = { alpha: 1, alphaInv: 2, luma: 3, lumaInv: 4 };
    R.fs('comp', out, { uDst: dst, uSrc: src, uMat: matte || GL.white, uMode: GL.int(MODES[mode] || 0), uMM: GL.int(matte ? (MM[mm] || 1) : 0), uOp: op });
    GL.release(dst);
    return out;
  };

  // ---------- 合成渲染 ----------
  const RENDERABLE = new Set(['shape', 'text', 'solid', 'precomp', 'geo3d', 'particles']);
  R.layerTime = (layer, t, opts, comp) => (comp.motionBlur && comp.motionBlur.on && (layer.motionBlur || opts.mbParent) ? t + (opts.mbOffset || 0) : t);
  R.renderComp = (comp, t, ctx, space, opts = {}) => {
    E.index(E.project);
    let acc = GL.target(space.w, space.h, 'c');
    GL.bind(acc);
    if (opts.bg !== false) { const b = comp.bg; GL.clear(b[0] * b[3], b[1] * b[3], b[2] * b[3], b[3]); } else GL.clear();
    const layers = comp.layers;
    const solo = layers.some(l => l.solo);
    const visible = (l) => l.visible && (!solo || l.solo || l.type === 'camera' || l.type === 'light') && E.activeAt(l, t);
    let group = null;
    const flush = () => {
      if (!group || !group.length) { group = null; return; }
      if (AE.R3) {
        const tex = AE.R3.renderGroup(comp, group, t, ctx, space, opts);
        if (tex) acc = R.composite(acc, tex, 'normal', 1), GL.release(tex);
      }
      group = null;
    };
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (!RENDERABLE.has(l.type) && l.type !== 'adjust') continue;
      if (!visible(l)) continue;
      if (opts.exclude && opts.exclude.has(l.id)) continue;
      const lt = R.layerTime(l, t, opts, comp);
      R.stats.layers++;
      const isolated3D = l.threeD && (l.type === 'geo3d' || l.type === 'particles' || (l.type === 'precomp' && l.precomp.space === 'keep3d')) && (l.effects.some(f => f.on) || l.masks.length > 0 || !!l.matte || l.blend !== 'normal');
      if (l.threeD && l.type !== 'adjust' && !isolated3D && !l.matte && l.blend === 'normal') { (group = group || []).push(l); continue; }
      if (l.threeD && isolated3D) R.stats.offscreen = (R.stats.offscreen || 0) + 1;
      flush();
      if (l.type === 'adjust') { acc = R.adjust(l, acc, lt, ctx, space, opts); continue; }
      let tex;
      if (l.threeD) {
        // 离屏边界：整组三维内容先渲染为画面，再做蒙版/效果/混合
        tex = AE.R3 ? AE.R3.renderGroup(comp, [l], lt, ctx, space, opts) : null;
        if (!tex) continue;
        if (isolated3D) tex = R.postProcess(l, tex, lt, ctx, space);
      } else tex = R.layerTex(l, lt, ctx, space, opts);
      let matte = null;
      if (l.matte) { const ml = E.layer(comp, l.matte.layer); if (ml && ml !== l) matte = ml.threeD && AE.R3 ? AE.R3.renderGroup(comp, [ml], R.layerTime(ml, t, opts, comp), ctx, space, opts) : R.layerTex(ml, R.layerTime(ml, t, opts, comp), ctx, space, opts); }
      acc = R.composite(acc, tex, l.blend || 'normal', l.threeD ? 1 : E.opacity(l, lt, ctx), matte, l.matte && l.matte.mode);
      GL.release(tex); if (matte) GL.release(matte);
    }
    flush();
    return acc;
  };
  // 离屏三维组的蒙版与效果（视图空间）
  R.postProcess = (layer, tex, t, ctx, space) => {
    const W = E.world(layer, t, ctx), M = M4.mul(space.proj, W);
    if (layer.masks.length) { const mk = R.maskTex(layer, t, ctx, space, M, space.scale * layerScale(W)); if (mk) { const o2 = GL.target(space.w, space.h, 'c'); R.fs('applyMask', o2, { uTex: tex, uM: mk }); GL.release(mk); GL.release(tex); tex = o2; } }
    return R.applyEffects(layer, tex, t, ctx, space, space.scale, null);
  };
  R.adjust = (layer, acc, t, ctx, space, opts) => {
    const W = E.world(layer, t, ctx), M = M4.mul(space.proj, W);
    const op = E.opacity(layer, t, ctx);
    let fx = R.copyTex(acc);
    fx = R.applyEffects(layer, fx, t, ctx, space, space.scale * layerScale(W), null);
    const mk = layer.masks.length ? R.maskTex(layer, t, ctx, space, M, space.scale) : null;
    const out = GL.target(acc.w, acc.h, 'c');
    R.fs('mixAdj', out, { uA: acc, uB: fx, uM: mk || GL.white, uOp: op, uHasM: GL.int(mk ? 1 : 0) });
    GL.release(fx); if (mk) GL.release(mk); GL.release(acc);
    return out;
  };
  // 帧渲染：快门区间内多次取样（运动模糊）
  R.anyMB = (comp, depth = 0) => {
    if (!comp.motionBlur || !comp.motionBlur.on || depth > 6) return false;
    for (const l of comp.layers) {
      if (!l.visible) continue;
      if (l.motionBlur) return true;
      if (l.type === 'precomp') { const s = E.comp(l.precomp.source); if (s && R.anyMB(s, depth + 1)) return true; }
    }
    return false;
  };
  R.renderFrame = (comp, t, space, opts = {}) => {
    const ctx = opts.ctx || E.root(comp);
    const mb = comp.motionBlur;
    const N = opts.mbSamples !== undefined ? opts.mbSamples : (mb ? mb.samples : 1);
    if (!mb || !mb.on || N <= 1 || !R.anyMB(comp)) return R.renderComp(comp, t, ctx, space, opts);
    const fd = 1 / comp.fps, shutter = (mb.angle / 360) * fd, start = (mb.phase / 360) * fd;
    const acc = GL.target(space.w, space.h, 'c');
    GL.bind(acc); GL.clear();
    for (let k = 0; k < N; k++) {
      const off = start + (k + 0.5) / N * shutter;
      const fr = R.renderComp(comp, t, ctx, space, Object.assign({}, opts, { mbOffset: off }));
      R.fs('accum', acc, { uTex: fr, uK: 1 / N }, 'add');
      GL.release(fr);
    }
    return acc;
  };
})(typeof window !== 'undefined' ? window : globalThis);
