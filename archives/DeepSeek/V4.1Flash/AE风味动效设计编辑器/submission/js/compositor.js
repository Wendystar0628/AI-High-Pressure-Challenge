/* ============================================================
   compositor.js — 图层源、蒙版、效果、遮罩、混合与预合成
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const M = AE.model;
  const G = AE.geom;
  const T = AE.text;
  const GL = AE.gl;
  const C = AE.compositor = {};

  let gl = null, ready = false, fx = {};
  let pool = [];
  let poolW = 0, poolH = 0;
  let canvasCache = new Map();
  let maskCanvasCache = new Map();
  let uploadLog = 0;
  const BLEND = { normal: 0, add: 1, screen: 2, multiply: 3, overlay: 4 };

  function init() {
    if (ready) return true;
    if (!GL.isSupported || !GL.isSupported()) return false;
    gl = GL.getGL();
    if (!gl) return false;
    if (!GL.compositeReady) GL.setupComposite();
    fx.mix = GL.compileProgram(GL.VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uA, uB;
      uniform vec2 uRes;
      uniform float uK;
      out vec4 o;
      void main(){
        vec2 uv = gl_FragCoord.xy/uRes;
        o = mix(texture(uB, uv), texture(uA, uv), uK);
      }`);
    fx.glowPre = GL.compileProgram(GL.VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uTex;
      uniform vec2 uRes;
      uniform vec3 uColor;
      uniform float uThreshold, uIntensity;
      out vec4 o;
      void main(){
        vec2 uv = gl_FragCoord.xy/uRes;
        vec4 c = texture(uTex, uv);
        float lum = dot(c.rgb / max(c.a, 0.001), vec3(0.299,0.587,0.114));
        float k = smoothstep(uThreshold, uThreshold + 0.18, lum);
        vec3 col = c.rgb * uColor * k * uIntensity;
        float a = c.a * k * uIntensity;
        o = vec4(col, a);
      }`);
    fx.shadowPre = GL.compileProgram(GL.VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uTex;
      uniform vec2 uRes;
      uniform vec2 uOffset;
      uniform vec3 uColor;
      uniform float uOpacity;
      out vec4 o;
      void main(){
        vec2 uv = gl_FragCoord.xy/uRes;
        vec4 c = texture(uTex, uv - uOffset);
        o = vec4(uColor * c.a * uOpacity, c.a * uOpacity);
      }`);
    fx.under = GL.compileProgram(GL.VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uA, uB;
      uniform vec2 uRes;
      out vec4 o;
      void main(){
        vec2 uv = gl_FragCoord.xy/uRes;
        vec4 sh = texture(uA, uv);
        vec4 src = texture(uB, uv);
        o = sh + src * (1.0 - sh.a);
      }`);
    ready = true;
    return true;
  }
  C.init = init;

  // ---------------- 目标池 ----------------
  function clearPool() {
    for (const t of pool) GL.freeTarget(t);
    pool = [];
    canvasCache.clear();
    maskCanvasCache.clear();
  }
  function acquire() {
    const s = GL.getSize();
    if (s.w !== poolW || s.h !== poolH) {
      clearPool();
      poolW = s.w; poolH = s.h;
    }
    if (pool.length) return pool.pop();
    return GL.makeTarget(s.w, s.h, {});
  }
  function release(t) {
    if (!t) return;
    if (pool.length < 28) pool.push(t);
    else GL.freeTarget(t);
  }
  function useTarget(t) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
  }
  function useScreen() {
    const s = GL.getSize();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, s.w, s.h);
  }
  function bindTex(unit, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }
  function drawPassTo(target, prog) {
    useTarget(target);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(prog);
    gl.uniform2f(prog.u.uRes, target.w, target.h);
    GL.drawFullscreen();
    gl.enable(gl.DEPTH_TEST);
  }

  // ---------------- 画布与源 ----------------
  function getCanvas(key) {
    const s = GL.getSize();
    let rec = canvasCache.get(key);
    if (!rec || rec.canvas.width !== s.w || rec.canvas.height !== s.h) {
      const canvas = document.createElement('canvas');
      canvas.width = s.w; canvas.height = s.h;
      rec = { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) };
      canvasCache.set(key, rec);
    }
    return rec;
  }
  function getMaskCanvas(key) {
    const s = GL.getSize();
    let rec = maskCanvasCache.get(key);
    if (!rec || rec.canvas.width !== s.w || rec.canvas.height !== s.h) {
      const canvas = document.createElement('canvas');
      canvas.width = s.w; canvas.height = s.h;
      const scratch = document.createElement('canvas');
      scratch.width = s.w; scratch.height = s.h;
      rec = { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }), scratch, sctx: scratch.getContext('2d') };
      maskCanvasCache.set(key, rec);
    }
    return rec;
  }

  function drawLayerContent(layer, t, canvas, natW, natH, comp) {
    const ctx = canvas.getContext('2d');
    const s = GL.getSize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    ctx.save();
    ctx.setTransform(s.w / natW, 0, 0, s.h / natH, s.w / 2, s.h / 2);
    const ctxA = A.newCtx(comp, layer, t);
    if (layer.type === 'text') {
      T.drawLayer(ctx, layer, t);
    } else if (layer.type === 'shape') {
      const contours = G.evalShapeLayer(layer, t, { ctx: ctxA });
      if (!contours.length) { ctx.restore(); return; }
      const shape = layer.shape;
      const fill = shape.fill;
      let fillOn = fill && fill.enabled;
      let fillColor = fill ? A.sample(fill.color, t, layer, ctxA) : null;
      let fillOpacity = fill ? U.clamp(A.n(A.sample(fill.opacity, t, layer, ctxA)), 0, 100) / 100 : 1;
      if (fillOn && fillOpacity > 0.001) {
        let gradient = null;
        const gt = fill.gradient && fill.gradient.type;
        if (gt === 'linear' || gt === 'radial') {
          const c2 = A.sample(fill.gradient.color2, t, layer, ctxA);
          const angle = A.n(A.sample(fill.gradient.angle, t, layer, ctxA)) * U.DEG;
          const b = G.bounds(contours);
          const cx = 0, cy = 0, r = Math.max(60, Math.max(b.w, b.h) / 2);
          if (gt === 'linear') {
            const dx = Math.cos(angle) * r, dy = Math.sin(angle) * r;
            gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
          } else {
            gradient = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
          }
          gradient.addColorStop(0, fillColor);
          gradient.addColorStop(1, c2);
        }
        const old = ctx.globalAlpha;
        ctx.globalAlpha = old * fillOpacity;
        G.drawContours(ctx, contours, { fill: fillColor, gradient: gradient ? () => gradient : null, fillRule: 'evenodd' });
        ctx.globalAlpha = old;
      }
      const stroke = shape.stroke;
      if (stroke && stroke.enabled) {
        const sw = A.n(A.sample(stroke.width, t, layer, ctxA));
        const so = U.clamp(A.n(A.sample(stroke.opacity, t, layer, ctxA)), 0, 100) / 100;
        if (sw > 0.01 && so > 0.001) {
          ctx.globalAlpha *= so;
          G.drawContours(ctx, contours, { stroke: A.sample(stroke.color, t, layer, ctxA), lineWidth: sw });
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();
  }

  function getShapeSource(layer, t, comp) {
    const rec = getCanvas(layer.id);
    drawLayerContent(layer, t, rec.canvas, comp.width, comp.height, comp);
    return {
      tex: GL.canvasTexture(rec.canvas), natW: comp.width, natH: comp.height,
      canvas: rec.canvas, release: null, flip: 0
    };
  }
  function getPrecompSource(layer, t, comp, depth) {
    const project = (AE.app && AE.app.project) || null;
    const nested = project ? project.comps.find(c => c.id === (layer.precomp && layer.precomp.compId)) : null;
    if (!nested) return null;
    let nt = t;
    const remap = layer.precomp.timeRemap;
    if (remap && remap.enabled) {
      const ctx = A.newCtx(comp, layer, t);
      if (remap.freeze) nt = A.n(A.sample(remap.offset, t, layer, ctx));
      else {
        const speed = A.n(A.sample(remap.speed, t, layer, ctx)) / 100;
        const offset = A.n(A.sample(remap.offset, t, layer, ctx));
        nt = (t - layer.inPoint) * speed + offset;
      }
    }
    nt = U.clamp(nt, 0, nested.duration);
    const res = renderComp(nested, nt, depth + 1);
    if (!res) return null;
    return {
      tex: res.tex, natW: nested.width, natH: nested.height,
      release: () => release(res.target), flip: 1
    };
  }

  // ---------------- 蒙版 ----------------
  function getMaskTexture(layer, t, natW, natH, comp) {
    if (!layer.masks || !layer.masks.length) return null;
    const rec = getMaskCanvas(layer.id);
    const cw = rec.canvas.width, ch = rec.canvas.height;
    const ctx = rec.ctx, sctx = rec.sctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const sx = cw / natW, sy = ch / natH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const mask of layer.masks) {
      if (mask.enabled === false) continue;
      const ctxA = A.newCtx(comp, layer, t);
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, cw, ch);
      sctx.save();
      sctx.setTransform(sx, 0, 0, sy, cw / 2, ch / 2);
      const contours = M.maskContours(mask, t, layer);
      const feather = Math.max(0, A.n(A.sample(mask.feather, t, layer, ctxA)));
      const opacity = U.clamp(A.n(A.sample(mask.opacity, t, layer, ctxA)), 0, 100) / 100;
      sctx.filter = feather > 0.2 ? `blur(${feather * sx}px)` : 'none';
      if (mask.inverted) {
        sctx.fillStyle = '#fff';
        sctx.fillRect(-natW / 2, -natH / 2, natW, natH);
        sctx.globalCompositeOperation = 'destination-out';
        G.toCanvasPath(sctx, contours);
        sctx.fillStyle = '#fff';
        sctx.fill('evenodd');
      } else {
        G.toCanvasPath(sctx, contours);
        sctx.fillStyle = '#fff';
        sctx.fill('evenodd');
      }
      sctx.restore();
      sctx.filter = 'none';
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = mask.mode === 'subtract' ? 'destination-out' : 'lighter';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(rec.scratch, 0, 0);
      ctx.restore();
    }
    return GL.canvasTexture(rec.canvas);
  }

  // ---------------- 效果 ----------------
  function blurPass(srcTex, w, h, radiusPx) {
    const t1 = acquire();
    useTarget(t1);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.useProgram(GL.getPrograms().blur);
    gl.uniform2f(GL.getPrograms().blur.u.uRes, w, h);
    gl.uniform2f(GL.getPrograms().blur.u.uDir, 1, 0);
    gl.uniform1f(GL.getPrograms().blur.u.uRadius, radiusPx);
    bindTex(0, srcTex);
    gl.uniform1i(GL.getPrograms().blur.u.uTex, 0);
    GL.drawFullscreen();
    const t2 = acquire();
    useTarget(t2);
    gl.useProgram(GL.getPrograms().blur);
    gl.uniform2f(GL.getPrograms().blur.u.uRes, w, h);
    gl.uniform2f(GL.getPrograms().blur.u.uDir, 0, 1);
    gl.uniform1f(GL.getPrograms().blur.u.uRadius, radiusPx);
    bindTex(0, t1.tex);
    gl.uniform1i(GL.getPrograms().blur.u.uTex, 0);
    GL.drawFullscreen();
    gl.enable(gl.DEPTH_TEST);
    release(t1);
    return t2;
  }
  function mixTextures(aTex, bTex, w, h, k) {
    const t = acquire();
    useTarget(t);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.useProgram(fx.mix);
    gl.uniform2f(fx.mix.u.uRes, w, h);
    gl.uniform1f(fx.mix.u.uK, k);
    bindTex(0, aTex); gl.uniform1i(fx.mix.u.uA, 0);
    bindTex(1, bTex); gl.uniform1i(fx.mix.u.uB, 1);
    GL.drawFullscreen();
    gl.enable(gl.DEPTH_TEST);
    return t;
  }

  function applyEffects(layer, t, srcTex, natW, natH, comp) {
    const ctx = A.newCtx(comp, layer, t);
    const s = GL.getSize();
    const scale = s.w / Math.max(1, natW);
    let curTex = srcTex, curTarget = null;
    for (let idx = 0; idx < layer.effects.length; idx++) {
      const e = layer.effects[idx];
      if (e.enabled === false) continue;
      const prevTex = curTex, prevTarget = curTarget;
      let outTarget = null;
      let mixOpacity = 1;
      if (e.type === 'blur') {
        const r = Math.max(0, A.n(A.sample(e.params.radius, t, layer, ctx))) * scale;
        if (r < 0.2) continue;
        outTarget = blurPass(prevTex, s.w, s.h, r);
        mixOpacity = U.clamp(A.n(A.sample(e.params.opacity, t, layer, ctx)), 0, 100) / 100;
      } else if (e.type === 'glow') {
        const r = Math.max(0, A.n(A.sample(e.params.radius, t, layer, ctx))) * scale;
        const intensity = U.clamp(A.n(A.sample(e.params.intensity, t, layer, ctx)) / 100, 0, 8);
        const threshold = U.clamp(A.n(A.sample(e.params.threshold, t, layer, ctx)) / 100, 0, 0.98);
        const color = U.rgb01(A.sample(e.params.color, t, layer, ctx));
        if (r < 0.2) continue;
        const pre = acquire();
        useTarget(pre);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        gl.useProgram(fx.glowPre);
        gl.uniform2f(fx.glowPre.u.uRes, s.w, s.h);
        gl.uniform3f(fx.glowPre.u.uColor, color[0], color[1], color[2]);
        gl.uniform1f(fx.glowPre.u.uThreshold, threshold);
        gl.uniform1f(fx.glowPre.u.uIntensity, intensity * 1.6);
        bindTex(0, prevTex); gl.uniform1i(fx.glowPre.u.uTex, 0);
        GL.drawFullscreen();
        gl.enable(gl.DEPTH_TEST);
        const blurT = blurPass(pre.tex, s.w, s.h, r);
        release(pre);
        const addT = acquire();
        useTarget(addT);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        gl.useProgram(GL.getPrograms().add);
        gl.uniform2f(GL.getPrograms().add.u.uRes, s.w, s.h);
        gl.uniform1f(GL.getPrograms().add.u.uWeight, 1);
        gl.uniform4f(GL.getPrograms().add.u.uTintA, 1, 1, 1, 1);
        bindTex(0, blurT.tex); gl.uniform1i(GL.getPrograms().add.u.uA, 0);
        bindTex(1, prevTex); gl.uniform1i(GL.getPrograms().add.u.uB, 1);
        GL.drawFullscreen();
        gl.enable(gl.DEPTH_TEST);
        release(blurT);
        outTarget = addT;
        mixOpacity = U.clamp(A.n(A.sample(e.params.opacity, t, layer, ctx)), 0, 100) / 100;
      } else if (e.type === 'shadow') {
        const dist = Math.max(0, A.n(A.sample(e.params.distance, t, layer, ctx))) * scale;
        const angle = A.n(A.sample(e.params.angle, t, layer, ctx)) * U.DEG;
        const soft = Math.max(0, A.n(A.sample(e.params.softness, t, layer, ctx))) * scale;
        const op = U.clamp(A.n(A.sample(e.params.opacity, t, layer, ctx)), 0, 100) / 100;
        const color = U.rgb01(A.sample(e.params.color, t, layer, ctx));
        const pre = acquire();
        useTarget(pre);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        gl.useProgram(fx.shadowPre);
        gl.uniform2f(fx.shadowPre.u.uRes, s.w, s.h);
        gl.uniform2f(fx.shadowPre.u.uOffset, Math.cos(angle) * dist / s.w, -Math.sin(angle) * dist / s.h);
        gl.uniform3f(fx.shadowPre.u.uColor, color[0], color[1], color[2]);
        gl.uniform1f(fx.shadowPre.u.uOpacity, op);
        bindTex(0, prevTex); gl.uniform1i(fx.shadowPre.u.uTex, 0);
        GL.drawFullscreen();
        gl.enable(gl.DEPTH_TEST);
        const blurT = blurPass(pre.tex, s.w, s.h, soft);
        release(pre);
        const underT = acquire();
        useTarget(underT);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        gl.useProgram(fx.under);
        gl.uniform2f(fx.under.u.uRes, s.w, s.h);
        bindTex(0, blurT.tex); gl.uniform1i(fx.under.u.uA, 0);
        bindTex(1, prevTex); gl.uniform1i(fx.under.u.uB, 1);
        GL.drawFullscreen();
        gl.enable(gl.DEPTH_TEST);
        release(blurT);
        outTarget = underT;
      } else if (e.type === 'hsl') {
        const hue = A.n(A.sample(e.params.hue, t, layer, ctx));
        const sat = A.n(A.sample(e.params.saturation, t, layer, ctx)) / 100;
        const light = A.n(A.sample(e.params.lightness, t, layer, ctx)) / 100;
        if (Math.abs(hue) < 0.01 && Math.abs(sat - 1) < 0.01 && Math.abs(light - 1) < 0.01) continue;
        const tgt = acquire();
        useTarget(tgt);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        gl.useProgram(GL.getPrograms().hsl);
        gl.uniform2f(GL.getPrograms().hsl.u.uRes, s.w, s.h);
        gl.uniform1f(GL.getPrograms().hsl.u.uHue, hue);
        gl.uniform1f(GL.getPrograms().hsl.u.uSat, sat);
        gl.uniform1f(GL.getPrograms().hsl.u.uLight, light);
        gl.uniform1f(GL.getPrograms().hsl.u.uOp, 1);
        bindTex(0, prevTex); gl.uniform1i(GL.getPrograms().hsl.u.uTex, 0);
        GL.drawFullscreen();
        gl.enable(gl.DEPTH_TEST);
        outTarget = tgt;
        mixOpacity = U.clamp(A.n(A.sample(e.params.opacity, t, layer, ctx)), 0, 100) / 100;
      }
      if (!outTarget) continue;
      if (mixOpacity < 0.999) {
        const m = mixTextures(outTarget.tex, prevTex, s.w, s.h, mixOpacity);
        release(outTarget);
        if (prevTarget) release(prevTarget);
        curTarget = m; curTex = m.tex;
      } else {
        if (prevTarget) release(prevTarget);
        curTarget = outTarget; curTex = outTarget.tex;
      }
    }
    return { tex: curTex, target: curTarget };
  }

  // ---------------- 合成工具 ----------------
  function paintBackground(target, comp) {
    useTarget(target);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    const alpha = (comp.bgAlpha === undefined ? 100 : comp.bgAlpha) / 100;
    if (alpha <= 0.001) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } else {
      const c = U.rgb01(comp.bgColor || '#0a0b0e');
      const prog = GL.getPrograms().bg;
      gl.useProgram(prog);
      gl.uniform2f(prog.u.uRes, target.w, target.h);
      gl.uniform4f(prog.u.uColor, c[0] * alpha, c[1] * alpha, c[2] * alpha, alpha);
      GL.drawFullscreen();
    }
    gl.enable(gl.DEPTH_TEST);
  }

  function invMat3(m) {
    const m2 = { a: m[0], b: m[1], c: m[4], d: m[5], e: m[12], f: m[13] };
    const inv = A.invert2D(m2);
    return new Float32Array([inv.a, inv.b, 0, inv.c, inv.d, 0, inv.e, inv.f, 1]);
  }

  function drawLayerProgram(target, opts) {
    const prog = GL.getPrograms().layer;
    useTarget(target);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(prog);
    const s = GL.getSize();
    const comp = opts.comp;
    gl.uniform2f(prog.u.uRes, s.w, s.h);
    gl.uniform2f(prog.u.uCompSize, comp.width, comp.height);
    gl.uniform2f(prog.u.uSrcSize, opts.srcW || comp.width, opts.srcH || comp.height);
    gl.uniformMatrix3fv(prog.u.uInvWorld, false, opts.invWorld || new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
    gl.uniform1f(prog.u.uHasSrc, opts.hasSrc === false ? 0 : 1);
    gl.uniform1f(prog.u.uHasDst, opts.hasDst === false ? 0 : 1);
    gl.uniform1f(prog.u.uHasMask, opts.maskTex ? 1 : 0);
    gl.uniform1f(prog.u.uHasMatte, opts.matteTex ? 1 : 0);
    gl.uniform1f(prog.u.uFlipSrc, opts.flipSrc ? 1 : 0);
    gl.uniform1f(prog.u.uMatteType, opts.matteType === 'luma' ? 1 : 0);
    gl.uniform1f(prog.u.uMatteInvert, opts.matteInvert ? 1 : 0);
    gl.uniform1f(prog.u.uOpacity, opts.opacity === undefined ? 1 : opts.opacity);
    gl.uniform1f(prog.u.uAlphaScale, opts.alphaScale === undefined ? 1 : opts.alphaScale);
    gl.uniform1i(prog.u.uBlend, opts.blend === undefined ? 0 : opts.blend);
    if (opts.srcTex) { bindTex(0, opts.srcTex); gl.uniform1i(prog.u.uSrc, 0); }
    if (opts.dstTex) { bindTex(1, opts.dstTex); gl.uniform1i(prog.u.uDst, 1); }
    if (opts.maskTex) { bindTex(2, opts.maskTex); gl.uniform1i(prog.u.uMask, 2); }
    if (opts.matteTex) { bindTex(3, opts.matteTex); gl.uniform1i(prog.u.uMatte, 3); }
    GL.drawFullscreen();
    gl.enable(gl.DEPTH_TEST);
  }

  // 将图层（含蒙版/效果/遮罩）变换渲染到 comp 空间目标
  function renderLayerToComp(layer, t, comp, srcTex, srcW, srcH, maskTex, matte, useLayerTime, flipSrc) {
    const target = acquire();
    useTarget(target);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const ctx = A.newCtx(comp, layer, useLayerTime === undefined ? t : useLayerTime);
    const m = A.worldMatrix(layer, useLayerTime === undefined ? t : useLayerTime, ctx);
    drawLayerProgram(target, {
      comp, srcTex, dstTex: null, hasDst: false, srcW, srcH,
      invWorld: invMat3(m), maskTex, matteTex: matte ? matte.tex : null,
      matteType: matte ? matte.type : null, matteInvert: matte ? matte.invert : false,
      opacity: 1, blend: 0, flipSrc: !!flipSrc
    });
    return target;
  }

  function matteTexture(comp, layer, t, depth, cache) {
    if (!layer.matte || !layer.matte.type || !layer.matte.layerId) return null;
    const src = comp.layers.find(l => l.id === layer.matte.layerId);
    if (!src || !src.enabled) return null;
    if (M.renders3D(src)) return null;
    const key = src.id;
    if (cache.has(key)) return cache.get(key);
    cache.set(key, null);
    if (t < src.inPoint || t > src.outPoint) return null;
    const source = getLayerSource(src, t, comp, depth);
    if (!source) return null;
    const fxRes = applyEffects(src, t, source.tex, source.natW, source.natH, comp);
    const mask = getMaskTexture(src, t, source.natW, source.natH, comp);
    const target = renderLayerToComp(src, t, comp, fxRes.tex, source.natW, source.natH, mask, null, t, source.flip);
    if (fxRes.target) release(fxRes.target);
    if (source.release) source.release();
    const info = { tex: target.tex, target, type: layer.matte.type, invert: layer.matte.invert };
    cache.set(key, info);
    return info;
  }

  function getLayerSource(layer, t, comp, depth) {
    if (layer.type === 'precomp') return getPrecompSource(layer, t, comp, depth);
    if (layer.type === 'shape' || layer.type === 'text') return getShapeSource(layer, t, comp);
    return null;
  }

  // ---------------- 单层合成 ----------------
  function composite2D(comp, layer, t, read, write, depth, matteCache) {
    const ctx = A.newCtx(comp, layer, t);
    const opacity = U.clamp(A.n(A.sample(layer.transform.opacity, t, layer, ctx)), 0, 100) / 100;
    if (opacity <= 0.001) return false;
    const source = getLayerSource(layer, t, comp, depth);
    if (!source) return false;
    const maskTex = getMaskTexture(layer, t, source.natW, source.natH, comp);
    const matte = matteTexture(comp, layer, t, depth, matteCache);
    const fxRes = applyEffects(layer, t, source.tex, source.natW, source.natH, comp);
    const mat3 = invMat3(A.worldMatrix(layer, t, ctx));
    const useMB = layer.motionBlur && comp.motionBlur && comp.motionBlur.enabled;
    if (!useMB) {
      drawLayerProgram(write, {
        comp, srcTex: fxRes.tex, dstTex: read.tex, hasDst: true, srcW: source.natW, srcH: source.natH,
        invWorld: mat3, maskTex, matteTex: matte ? matte.tex : null,
        matteType: matte ? matte.type : null, matteInvert: matte ? matte.invert : false,
        opacity, blend: BLEND[layer.blend] || 0, flipSrc: !!source.flip
      });
    } else {
      const samples = U.clamp(Math.round(comp.motionBlur.samples || 4), 2, 8);
      const shutter = (comp.motionBlur.shutterAngle / 360) / comp.fps;
      const phase = comp.motionBlur.phase || 0;
      let accRead = acquire(), accWrite = acquire();
      useTarget(accRead);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const addProg = GL.getPrograms().add;
      for (let i = 0; i < samples; i++) {
        const f = samples === 1 ? 0.5 : i / (samples - 1);
        const st = t + (phase + f - 0.5) * shutter;
        const tmp = renderLayerToComp(layer, t, comp, fxRes.tex, source.natW, source.natH, maskTex, matte, st, source.flip);
        useTarget(accWrite);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(addProg);
        gl.uniform2f(addProg.u.uRes, accWrite.w, accWrite.h);
        gl.uniform1f(addProg.u.uWeight, 1 / samples);
        gl.uniform4f(addProg.u.uTintA, 1, 1, 1, 1);
        bindTex(0, tmp.tex); gl.uniform1i(addProg.u.uA, 0);
        bindTex(1, accRead.tex); gl.uniform1i(addProg.u.uB, 1);
        GL.drawFullscreen();
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        release(tmp);
        const sw = accRead; accRead = accWrite; accWrite = sw;
      }
      drawLayerProgram(write, {
        comp, srcTex: accRead.tex, dstTex: read.tex, hasDst: true,
        srcW: comp.width, srcH: comp.height,
        invWorld: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        opacity, blend: BLEND[layer.blend] || 0, flipSrc: true
      });
      release(accRead); release(accWrite);
    }
    if (fxRes.target) release(fxRes.target);
    if (source.release) source.release();
    return true;
  }

  function adjustment(comp, layer, t, read, write, depth) {
    const ctx = A.newCtx(comp, layer, t);
    const opacity = U.clamp(A.n(A.sample(layer.transform.opacity, t, layer, ctx)), 0, 100) / 100;
    if (opacity <= 0.001) return false;
    if (!layer.effects.length) return false;
    const s = GL.getSize();
    // 拷贝累计缓冲
    const copy = acquire();
    useTarget(copy);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    const cp = GL.getPrograms().copy2;
    gl.useProgram(cp);
    gl.uniform2f(cp.u.uRes, s.w, s.h);
    gl.uniform4f(cp.u.uTint, 1, 1, 1, 1);
    bindTex(0, read.tex); gl.uniform1i(cp.u.uTex, 0);
    GL.drawFullscreen();
    gl.enable(gl.DEPTH_TEST);
    const maskTex = getMaskTexture(layer, t, comp.width, comp.height, comp);
    const fxRes = applyEffects(layer, t, copy.tex, comp.width, comp.height, comp);
    release(copy);
    drawLayerProgram(write, {
      comp, srcTex: fxRes.tex, dstTex: read.tex, hasDst: true,
      srcW: comp.width, srcH: comp.height,
      invWorld: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
      maskTex, opacity, blend: 0, flipSrc: true
    });
    if (fxRes.target) release(fxRes.target);
    return true;
  }

  function compositeScene(comp, sceneRes, read, write) {
    if (!sceneRes) return false;
    const W = comp.width, H = comp.height;
    drawLayerProgram(write, {
      comp, srcTex: sceneRes.colorTex, dstTex: read.tex, hasDst: true,
      srcW: comp.width, srcH: comp.height,
      invWorld: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
      opacity: 1, blend: 0, flipSrc: true
    });
    return true;
  }

  function layerVisible(layer, t) {
    return layer.enabled && t >= layer.inPoint - 1e-6 && t <= layer.outPoint + 1e-6;
  }
  function needs3D(comp, t) {
    for (const l of comp.layers) {
      if (!layerVisible(l, t)) continue;
      if (l.type === 'particle') return true;
      if (M.renders3D(l)) return true;
    }
    return false;
  }

  // ---------------- 合成递归 ----------------
  function renderComp(comp, t, depth) {
    if (depth > 5) return null;
    const s = GL.getSize();
    let read = acquire(), write = acquire();
    paintBackground(read, comp);
    const wantsScene = needs3D(comp, t);
    let sceneRes = null;
    if (wantsScene) {
      try {
        sceneRes = GL.renderScene(comp, t, {
          width: s.w, height: s.h,
          freeView: AE.app && AE.app.view && AE.app.view.viewMode === 'free'
        });
      } catch (e) {
        console.error('3D 渲染失败', e);
        sceneRes = null;
      }
    }
    let sceneInsert = -1;
    if (wantsScene) {
      for (let i = comp.layers.length - 1; i >= 0; i--) {
        const l = comp.layers[i];
        if (layerVisible(l, t) && (M.renders3D(l) || l.type === 'particle')) { sceneInsert = i; break; }
      }
    }
    let sceneDone = false;
    const matteCache = new Map();
    for (let i = comp.layers.length - 1; i >= 0; i--) {
      if (sceneInsert === i && sceneRes && !sceneDone) {
        if (compositeScene(comp, sceneRes, read, write)) {
          const tmp = read; read = write; write = tmp;
          sceneDone = true;
        }
      }
      const layer = comp.layers[i];
      if (!layerVisible(layer, t)) continue;
      if (layer.type === 'camera' || layer.type === 'light' || layer.type === 'field' || layer.type === 'sound' || layer.type === 'null') continue;
      if (M.renders3D(layer)) continue;
      let did = false;
      if (layer.type === 'adjustment') did = adjustment(comp, layer, t, read, write, depth);
      else did = composite2D(comp, layer, t, read, write, depth, matteCache);
      if (did) {
        const tmp = read; read = write; write = tmp;
      }
    }
    if (!sceneDone && sceneRes) {
      if (compositeScene(comp, sceneRes, read, write)) {
        const tmp = read; read = write; write = tmp;
      }
    }
    // 释放遮罩临时目标
    for (const [, info] of matteCache) if (info && info.target) release(info.target);
    release(write);
    return { tex: read.tex, target: read };
  }

  C.renderComp = function (comp, t) {
    if (!init()) return null;
    return renderComp(comp, t || 0, 0);
  };

  C.renderFrame = function (comp, t) {
    if (!init()) return false;
    const s = GL.getSize();
    const res = renderComp(comp, t, 0);
    if (!res) return false;
    useScreen();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const prog = GL.getPrograms().copy;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(prog);
    gl.uniform2f(prog.u.uRes, s.w, s.h);
    gl.uniform4f(prog.u.uTint, 1, 1, 1, 1);
    bindTex(0, res.tex); gl.uniform1i(prog.u.uTex, 0);
    GL.drawFullscreen();
    gl.enable(gl.DEPTH_TEST);
    release(res.target);
    comp._lastFrame = { t, size: s };
    return true;
  };

  C.getLayerSourceCanvas = function (layer, t, comp) {
    if (!init()) return null;
    if (layer.type === 'shape' || layer.type === 'text') {
      const rec = getCanvas(layer.id);
      drawLayerContent(layer, t, rec.canvas, comp.width, comp.height, comp);
      return rec.canvas;
    }
    return null;
  };

  // 屏幕坐标 -> 源坐标
  C.layerHit = function (comp, layer, t, cx, cy) {
    if (!layerVisible(layer, t)) return false;
    if (layer.type === 'shape' || layer.type === 'text') {
      const ctx = A.newCtx(comp, layer, t);
      const m = A.worldMatrix(layer, t, ctx);
      const inv = A.invert2D(A.matrix2D(m));
      const sx = inv.a * cx + inv.c * cy + inv.e;
      const sy = inv.b * cx + inv.d * cy + inv.f;
      const canvas = C.getLayerSourceCanvas(layer, t, comp);
      if (!canvas) return false;
      const s = GL.getSize();
      const px = Math.floor((sx / comp.width + 0.5) * canvas.width);
      const py = Math.floor((sy / comp.height + 0.5) * canvas.height);
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return false;
      const c = canvas.getContext('2d').getImageData(px, py, 1, 1).data;
      return c[3] > 10;
    }
    return false;
  };

  C.clearCaches = function () {
    clearPool();
    A.clearCache();
  };

})(window);
