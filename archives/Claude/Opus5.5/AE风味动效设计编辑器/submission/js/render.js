'use strict';
// ============ 合成渲染器 ============
const Render = {
  stats: { layers: 0 },
  // ---------- 矢量绘制（模板 + 覆盖，MSAA） ----------
  mat3(A, rs) { return new Float32Array([A[0] * rs, A[1] * rs, 0, A[2] * rs, A[3] * rs, 0, A[4] * rs, A[5] * rs, 1]); },
  affineFromM4(m) { return [m[0], m[1], m[4], m[5], m[12], m[13]]; },
  _coverBox(bb) { return [bb[0], bb[1], bb[2], bb[1], bb[2], bb[3], bb[0], bb[1], bb[2], bb[3], bb[0], bb[3]]; },
  // polys: [[x,y]...]，rule: nonzero/evenodd；style:{color:[r,g,b,a(预乘前)], grad?}
  fillPolys(polys, M3, W, H, style, rule = 'nonzero') {
    const gl = GLX.gl; if (!polys.length) return;
    const tris = []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of polys) { if (p.length < 3) continue; const a = p[0]; for (let i = 1; i < p.length - 1; i++) tris.push(a[0], a[1], p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]); for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[0] > x1) x1 = q[0]; if (q[1] > y1) y1 = q[1]; } }
    if (!tris.length) return;
    this._stencilCover(tris, [x0, y0, x1, y1], M3, W, H, style, rule === 'evenodd' ? 'evenodd' : 'nonzero');
  },
  fillTris(tris, M3, W, H, style) {
    if (!tris.length) return; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < tris.length; i += 2) { const x = tris[i], y = tris[i + 1]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    this._stencilCover(tris, [x0, y0, x1, y1], M3, W, H, style, 'union');
  },
  _stencilCover(tris, bb, M3, W, H, style, mode) {
    const gl = GLX.gl; GLX.use('vec'); GLX.set('uM', M3); GLX.set('uRes', [W, H]);
    const n = GLX.upload(tris);
    gl.enable(gl.STENCIL_TEST); gl.disable(gl.CULL_FACE); gl.colorMask(false, false, false, false); gl.stencilMask(0xff);
    if (mode === 'nonzero') { gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP); gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP); }
    else if (mode === 'evenodd') { gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT); gl.stencilMask(0x01); }
    else { gl.stencilFunc(gl.ALWAYS, 1, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); }
    gl.drawArrays(gl.TRIANGLES, 0, n);
    gl.colorMask(true, true, true, true); gl.stencilMask(0xff);
    gl.stencilFunc(gl.NOTEQUAL, 0, mode === 'evenodd' ? 0x01 : 0xff); gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO);
    const pad = 2; const cb = this._coverBox([bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad]);
    GLX.upload(cb);
    const c = style.color || [1, 1, 1, 1]; const a = c[3] ?? 1;
    GLX.set('uColor', [c[0] * a, c[1] * a, c[2] * a, a]);
    if (style.grad) { GLX.seti('uGrad', style.grad.type === 'linear' ? 1 : 2); GLX.set('uG0', style.grad.p0); GLX.set('uG1', style.grad.p1); GLX.set('uC1', [...style.grad.c1, 1]); GLX.set('uC2', [...style.grad.c2, 1]); } else GLX.seti('uGrad', 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST);
  },
  texQuad(tex, M3, W, H, op = 1) {
    const gl = GLX.gl; GLX.use('texQuad'); GLX.set('uM', M3); GLX.set('uRes', [W, H]); GLX.tex('uTex', tex); GLX.set('uOp', op);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); GLX.drawQuad(); gl.disable(gl.BLEND);
  },

  // ---------- 合成 ----------
  ev(p, comp, L, t) { return Anim.evalProp(p, comp, L, t); },
  isVisual(L) { return !['camera', 'light', 'null', 'synth', 'field'].includes(L.type); },
  is3D(L) { return (L.type === 'geo' || L.type === 'particles' || (L.threeD && ['shape', 'text', 'solid', 'precomp'].includes(L.type))); },
  active(L, t) { return t >= L.inPoint && t < L.outPoint; },
  depth: 0,
  // 渲染整个合成，返回 RT（预乘，透明背景）
  renderComp(comp, t, rs, opts = {}) {
    const W = Math.max(1, Math.round(comp.width * rs)), H = Math.max(1, Math.round(comp.height * rs));
    if (this.depth > 6) { const r = GLX.acquire(W, H); GLX.clear(r); return r; }
    this.depth++;
    let acc = GLX.acquire(W, H); GLX.clear(acc);
    const Ls = comp.layers; const solo = Ls.some(l => l.solo && l.visible);
    const matteSrc = new Set(); Ls.forEach((l, i) => { if (l.matte !== 'none' && i > 0) matteSrc.add(Ls[i - 1].id); });
    const can = L => this.isVisual(L) && L.visible && this.active(L, t) && (!solo || L.solo) && !matteSrc.has(L.id);
    let i = Ls.length - 1;
    while (i >= 0) {
      const L = Ls[i];
      if (!can(L)) { i--; continue; }
      if (this.is3D(L) && L.type !== 'adjustment') {
        const group = []; let j = i;
        while (j >= 0) { const M = Ls[j]; if (can(M) && this.is3D(M)) { group.push(M); j--; } else if (!can(M) || !this.isVisual(M)) { j--; } else break; }
        const rt = Render3D.renderGroup(comp, t, group, rs, W, H, opts);
        if (rt) { acc = this.composite(acc, rt, 1, 'normal'); GLX.release(rt); }
        i = j; continue;
      }
      if (L.type === 'adjustment') { acc = this.adjust(comp, L, t, rs, acc, W, H); i--; continue; }
      const rt = this.renderLayer(comp, L, t, rs, W, H, opts, i);
      if (rt) { acc = this.composite(acc, rt, Xform.opacity(comp, L, t), L.blendMode); GLX.release(rt); }
      i--;
    }
    this.depth--;
    return acc;
  },
  composite(acc, src, op, mode) {
    const out = GLX.acquire(acc.w, acc.h, acc.fmt);
    const m = { normal: 0, add: 1, screen: 2, multiply: 3, overlay: 4 }[mode] || 0;
    GLX.pass('composite', out, () => { GLX.tex('uDst', acc.tex); GLX.tex('uSrc', src.tex); GLX.set('uOp', op); GLX.seti('uMode', m); });
    GLX.release(acc); return out;
  },
  // 图层（2D）完整处理：内容(+运动模糊) → 蒙版 → 操控 → 效果 → 轨道遮罩
  renderLayer(comp, L, t, rs, W, H, opts, idx) {
    let rt;
    const mbOn = comp.mb.on && L.motionBlur && !opts.noMB && !opts.pick;
    if (mbOn) {
      const N = Math.max(2, comp.mb.samples | 0), sh = comp.mb.angle / 360 / comp.fps, ph = comp.mb.phase / 360 / comp.fps;
      rt = GLX.acquire(W, H, 'rgba16f'); GLX.clear(rt);
      for (let k = 0; k < N; k++) {
        const ts = t + ph + sh * (k + 0.5) / N;
        const c = this.layerContent(comp, L, ts, rs, W, H, opts);
        GLX.pass('scale', rt, () => { GLX.tex('uTex', c.tex); GLX.set('uK', 1 / N); }, 'add');
        GLX.release(c);
      }
    } else rt = this.layerContent(comp, L, t, rs, W, H, opts);
    if (opts.pick) return rt;
    const fx = L.effects.filter(e => e.on && !['slider', 'point', 'colorCtl', 'angleCtl', 'puppet'].includes(e.type));
    if (fx.length) { const r2 = GLX.applyEffects(rt, fx, p => this.ev(p, comp, L, t), rs); if (r2 !== rt) { GLX.release(rt); rt = r2; } }
    if (L.matte !== 'none' && idx > 0) {
      const ML = comp.layers[idx - 1];
      let mt;
      if (this.active(ML, t)) mt = this.renderLayer(comp, ML, t, rs, W, H, opts, idx - 1);
      else { mt = GLX.acquire(W, H); GLX.clear(mt); }
      const out = GLX.acquire(W, H, rt.fmt);
      const mode = { alpha: 0, alphaInv: 1, luma: 2, lumaInv: 3 }[L.matte];
      GLX.pass('matte', out, () => { GLX.tex('uTex', rt.tex); GLX.tex('uMatte', mt.tex); GLX.seti('uMode', mode); });
      // 遮罩层自身不透明度
      GLX.release(rt); GLX.release(mt); rt = out;
    }
    return rt;
  },
  // 图层内容 + 蒙版 + 操控（单一时刻）
  layerContent(comp, L, t, rs, W, H, opts) {
    const gl = GLX.gl;
    const M = Xform.layerMatrix(comp, L, t); const A = this.affineFromM4(M); const M3 = this.mat3(A, rs);
    let rt = GLX.acquire(W, H);
    if (L.type === 'precomp') {
      const sub = Model.findComp(Anim.project, L.pre.compId);
      GLX.clear(rt);
      if (sub && sub !== comp) {
        const tt = this.precompTime(comp, L, t);
        const srt = this.renderComp(sub, tt, rs, opts);
        GLX.bind(rt);
        const Mq = this.mat3(Shapes.mulA(A, [sub.width, 0, 0, sub.height, 0, 0]), rs);
        this.texQuad(srt.tex, Mq, W, H, 1);
        GLX.release(srt);
      }
    } else {
      GLX.beginVec(W, H);
      this.drawContent(comp, L, t, M3, W, H, A);
      GLX.endVec(rt);
    }
    // 操控图钉
    const pup = L.effects.find(e => e.type === 'puppet' && e.on && e.pins.length);
    if (pup && !opts.pick) { const r2 = Puppet.apply(comp, L, t, rt, pup, A, rs, W, H); if (r2) { GLX.release(rt); rt = r2; } }
    // 蒙版
    if (L.masks.length) { const m = this.maskRT(comp, L, t, A, rs, W, H); if (m) { const out = GLX.acquire(W, H, rt.fmt); GLX.pass('mulMask', out, () => { GLX.tex('uTex', rt.tex); GLX.tex('uMask', m.tex); }); GLX.release(m); GLX.release(rt); rt = out; } }
    return rt;
  },
  precompTime(comp, L, t) {
    if (L.pre.remapOn) return this.ev(L.pre.remap, comp, L, t);
    return t - L.startTime;
  },
  drawContent(comp, L, t, M3, W, H, A) {
    if (L.type === 'shape') {
      const r = Shapes.evaluate(comp, L, t);
      for (let k = r.rends.length - 1; k >= 0; k--) {
        const rd = r.rends[k]; if (rd.opacity <= 0) continue;
        const polys = rd.conts.flatMap(c => c.polys);
        if (rd.kind === 'fill') this.fillPolys(polys.filter(p => p.pts.length > 2).map(p => p.pts), M3, W, H, { color: [...rd.color, rd.opacity] }, rd.rule);
        else if (rd.kind === 'gfill') this.fillPolys(polys.filter(p => p.pts.length > 2).map(p => p.pts), M3, W, H, { color: [1, 1, 1, rd.opacity], grad: { type: rd.gtype, p0: rd.g[0], p1: rd.g[1], c1: rd.c1, c2: rd.c2 } }, rd.rule);
        else if (rd.kind === 'stroke') { const tris = []; const w = rd.width * (rd.wscale || 1); for (const p of polys) Geo2D.strokeTris(p.pts, p.closed, w, rd.join, rd.cap, tris); this.fillTris(tris, M3, W, H, { color: [...rd.color, rd.opacity] }); }
      }
    } else if (L.type === 'text') {
      const X = L.text; const r = TextL.evaluate(comp, L, t);
      const fill = this.ev(X.fill, comp, L, t), stroke = this.ev(X.stroke, comp, L, t), sw = this.ev(X.strokeW, comp, L, t);
      for (const it of r.items) {
        if (it.op <= 0.001) continue;
        const m = it.m;
        if (it.strokes) {
          const tris = []; for (const s of it.strokes) DuanFont.brushTris(s.b, s.upto, tris, m, it.brushW);
          if (X.fillOn) this.fillTris(tris, M3, W, H, { color: [...fill, it.op] });
          continue;
        }
        const polys = (it.polys || []).map(p => p.map(q => [m[0] * q[0] + m[2] * q[1] + m[4], m[1] * q[0] + m[3] * q[1] + m[5]]));
        if (X.strokeOn && sw > 0) { const tris = []; for (const p of polys) Geo2D.strokeTris(p, true, sw * 2, 'round', 'round', tris); this.fillTris(tris, M3, W, H, { color: [...stroke, it.op] }); }
        if (X.fillOn) this.fillPolys(polys, M3, W, H, { color: [...fill, it.op] }, 'evenodd');
      }
    } else if (L.type === 'solid') {
      const c = this.ev(L.solid.color, comp, L, t);
      this.fillPolys([[[0, 0], [L.solid.w, 0], [L.solid.w, L.solid.h], [0, L.solid.h]]], M3, W, H, { color: [...c, 1] });
    }
  },
  // 蒙版 RT（r 通道 = 覆盖）
  maskRT(comp, L, t, A, rs, W, H) {
    const masks = L.masks.filter(m => m.mode !== 'none'); if (!masks.length) return null;
    let acc = GLX.acquire(W, H); const init = masks[0].mode === 'add' ? 0 : 1; GLX.clear(acc, [init, init, init, 1]);
    const M3 = this.mat3(A, rs);
    for (const m of masks) {
      const path = this.ev(m.path, comp, L, t); const polys = Geo2D.flattenPath(path, 0.4).map(p => p.pts);
      const exp = this.ev(m.expansion, comp, L, t), fe = this.ev(m.feather, comp, L, t), op = this.ev(m.opacity, comp, L, t) / 100;
      let mr = GLX.acquire(W, H); GLX.beginVec(W, H);
      this.fillPolys(polys, M3, W, H, { color: [1, 1, 1, 1] });
      if (Math.abs(exp) > 0.01) {
        const tris = []; for (const p of polys) Geo2D.strokeTris(p, true, Math.abs(exp) * 2, 'round', 'round', tris);
        if (exp > 0) this.fillTris(tris, M3, W, H, { color: [1, 1, 1, 1] });
        else { const gl = GLX.gl; gl.enable(gl.BLEND); this.fillTrisErase(tris, M3, W, H); }
      }
      GLX.endVec(mr);
      if (fe > 0.1) { const b = GLX.blur(mr, fe * rs / 2); GLX.release(mr); mr = b; }
      const out = GLX.acquire(W, H);
      GLX.pass('maskCombine', out, () => { GLX.tex('uAcc', acc.tex); GLX.tex('uM', mr.tex); GLX.seti('uMode', { add: 0, subtract: 1, intersect: 2, difference: 3 }[m.mode] ?? 0); GLX.set('uInv', m.inv ? 1 : 0); GLX.set('uOp', op); });
      GLX.release(acc); GLX.release(mr); acc = out;
    }
    return acc;
  },
  fillTrisErase(tris, M3, W, H) {
    const gl = GLX.gl; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < tris.length; i += 2) { x0 = Math.min(x0, tris[i]); y0 = Math.min(y0, tris[i + 1]); x1 = Math.max(x1, tris[i]); y1 = Math.max(y1, tris[i + 1]); }
    GLX.use('vec'); GLX.set('uM', M3); GLX.set('uRes', [W, H]); const n = GLX.upload(tris);
    gl.enable(gl.STENCIL_TEST); gl.colorMask(false, false, false, false); gl.stencilFunc(gl.ALWAYS, 1, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); gl.drawArrays(gl.TRIANGLES, 0, n);
    gl.colorMask(true, true, true, true); gl.stencilFunc(gl.EQUAL, 1, 0xff); gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO);
    GLX.upload(this._coverBox([x0 - 2, y0 - 2, x1 + 2, y1 + 2])); GLX.seti('uGrad', 0); GLX.set('uColor', [0, 0, 0, 1]);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST);
  },
  // 调整图层：对下方结果应用效果，范围 = 图层矩形 × 蒙版 × 不透明度
  adjust(comp, L, t, rs, acc, W, H) {
    const fx = L.effects.filter(e => e.on && !['slider', 'point', 'colorCtl', 'angleCtl', 'puppet'].includes(e.type));
    if (!fx.length) return acc;
    const eff = GLX.applyEffects(acc, fx, p => this.ev(p, comp, L, t), rs);
    const A = this.affineFromM4(Xform.layerMatrix(comp, L, t));
    // 覆盖区域
    const cov = GLX.acquire(W, H); GLX.beginVec(W, H);
    this.fillPolys([[[0, 0], [L.adj.w, 0], [L.adj.w, L.adj.h], [0, L.adj.h]]], this.mat3(A, rs), W, H, { color: [1, 1, 1, 1] });
    GLX.endVec(cov);
    let cv = cov;
    if (L.masks.length) { const m = this.maskRT(comp, L, t, A, rs, W, H); if (m) { const o2 = GLX.acquire(W, H); GLX.pass('mulMask', o2, () => { GLX.tex('uTex', cov.tex); GLX.tex('uMask', m.tex); }); GLX.release(m); GLX.release(cov); cv = o2; } }
    // 覆盖纹理 alpha → r
    const out = GLX.acquire(W, H, acc.fmt);
    GLX.pass('mixAdj', out, () => { GLX.tex('uA', acc.tex); GLX.tex('uB', eff.tex); GLX.tex('uM', cv.tex); GLX.set('uOp', Xform.opacity(comp, L, t)); });
    GLX.release(cv); if (eff !== acc) GLX.release(eff); GLX.release(acc);
    return out;
  },
  // ---------- 点选：返回最上层可见对象 ----------
  pick(comp, t, x, y, rs = 0.5) {
    const W = Math.max(1, Math.round(comp.width * rs)), H = Math.max(1, Math.round(comp.height * rs));
    const pk = GLX.acquire(W, H); GLX.clear(pk);
    const gl = GLX.gl; const Ls = comp.layers;
    const matteSrc = new Set(); Ls.forEach((l, i) => { if (l.matte !== 'none' && i > 0) matteSrc.add(Ls[i - 1].id); });
    const enc = id => [(id & 255) / 255, ((id >> 8) & 255) / 255, ((id >> 16) & 255) / 255, 1];
    let i = Ls.length - 1;
    const can = L => this.isVisual(L) && L.visible && this.active(L, t) && !matteSrc.has(L.id) && !L.locked;
    while (i >= 0) {
      const L = Ls[i];
      if (!can(L) || L.type === 'adjustment') { i--; continue; }
      if (this.is3D(L)) {
        const group = []; let j = i;
        while (j >= 0) { const M = Ls[j]; if (can(M) && this.is3D(M)) { group.push(M); j--; } else if (!can(M) || !this.isVisual(M)) j--; else break; }
        Render3D.pickGroup(comp, t, group, rs, W, H, pk, enc);
        i = j; continue;
      }
      const rt = this.layerContent(comp, L, t, rs, W, H, { pick: true });
      GLX.bind(pk); GLX.use('pickLayer'); GLX.tex('uTex', rt.tex); GLX.set('uId', enc(L.id)); GLX.drawQuad();
      GLX.release(rt); i--;
    }
    GLX.bind(pk); const px = new Uint8Array(4);
    gl.readPixels(Math.floor(x * rs), Math.floor(H - 1 - y * rs), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    GLX.release(pk);
    const id = px[0] | (px[1] << 8) | (px[2] << 16);
    return px[3] ? id : 0;
  },
};

// ============ 操控图钉（移动最小二乘刚性变形） ============
const Puppet = {
  meshCache: new Map(),
  // 本图层的静止网格（图层空间）
  mesh(comp, L, eff, t) {
    const dens = eff.p.density || 24;
    const sig = eff.id + ':' + dens + ':' + (eff.meshT ?? 0) + ':' + Anim.version;
    const c = this.meshCache.get(eff.id);
    if (c && (c.sig === sig || (c.dens === dens && c.meshT === eff.meshT && c.contentSig === this.contentSig(L)))) return c.mesh;
    const tt = eff.meshT ?? t;
    let polys = [];
    if (L.type === 'shape') polys = Shapes.allPolys(comp, L, tt).filter(p => p.closed !== false || true).map(p => p.pts).filter(p => p.length > 2);
    else if (L.type === 'text') polys = TextL.polys(comp, L, tt);
    else if (L.type === 'solid') polys = [[[0, 0], [L.solid.w, 0], [L.solid.w, L.solid.h], [0, L.solid.h]]];
    else if (L.type === 'precomp') { const s = Model.findComp(Anim.project, L.pre.compId); if (s) polys = [[[0, 0], [s.width, 0], [s.width, s.height], [0, s.height]]]; }
    if (!polys.length) return null;
    const bb = Geo2D.bbox(polys); const size = Math.max(bb[2] - bb[0], bb[3] - bb[1]);
    const grow = size * 0.015;
    const outl = Geo2D.traceRaster([bb[0] - grow * 2, bb[1] - grow * 2, bb[2] + grow * 2, bb[3] + grow * 2], 400, ctx => {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = grow * 2; ctx.lineJoin = 'round';
      ctx.beginPath(); for (const p of polys) { ctx.moveTo(p[0][0], p[0][1]); for (const q of p) ctx.lineTo(q[0], q[1]); ctx.closePath(); } ctx.fill('nonzero'); ctx.stroke();
    }, 0.8);
    const regs = Geo2D.regions(outl); const h = size / dens;
    const pts = [], tris = [];
    for (const r of regs) { const m = Geo2D.mesh(r.outer, r.holes, h); const o = pts.length; pts.push(...m.pts); for (const i of m.tris) tris.push(i + o); }
    const mesh = { pts, tris };
    this.meshCache.set(eff.id, { sig, mesh, dens, meshT: eff.meshT, contentSig: this.contentSig(L) });
    return mesh;
  },
  contentSig(L) { return U.hash(JSON.stringify(L.contents || L.text || L.solid || L.pre || '')); },
  // MLS 刚性变形 + 图钉旋转/缩放
  deformer(pins) {
    const P = pins.map(p => p.p), Q = pins.map(p => p.q);
    return v => {
      if (pins.length === 1) { const p = pins[0]; const r = U.rad(p.rot), s = p.scl; const dx = v[0] - p.p[0], dy = v[1] - p.p[1]; return [p.q[0] + (Math.cos(r) * dx - Math.sin(r) * dy) * s, p.q[1] + (Math.sin(r) * dx + Math.cos(r) * dy) * s]; }
      let sw = 0, px = 0, py = 0, qx = 0, qy = 0; const w = [];
      for (let i = 0; i < P.length; i++) { const d2 = (P[i][0] - v[0]) ** 2 + (P[i][1] - v[1]) ** 2; if (d2 < 1e-8) { /* 落在图钉上 */ } const wi = 1 / Math.max(d2, 1e-6); w.push(wi); sw += wi; px += wi * P[i][0]; py += wi * P[i][1]; qx += wi * Q[i][0]; qy += wi * Q[i][1]; }
      px /= sw; py /= sw; qx /= sw; qy /= sw;
      const dx = v[0] - px, dy = v[1] - py; const dpx = dy, dpy = -dx;
      let fx = 0, fy = 0, rot = 0, scl = 0;
      for (let i = 0; i < P.length; i++) {
        const ax = P[i][0] - px, ay = P[i][1] - py, bx = Q[i][0] - qx, by = Q[i][1] - qy;
        const m00 = ax * dx + ay * dy, m01 = ax * dpx + ay * dpy, m10 = ay * dx - ax * dy, m11 = ay * dpx - ax * dpy;
        fx += w[i] * (bx * m00 + by * m10); fy += w[i] * (bx * m01 + by * m11);
        rot += w[i] * pins[i].rot; scl += w[i] * pins[i].scl;
      }
      rot /= sw; scl /= sw;
      const L = Math.hypot(dx, dy), fl = Math.hypot(fx, fy) || 1;
      let ox = L * fx / fl, oy = L * fy / fl;
      if (rot || scl !== 1) { const r = U.rad(rot), c = Math.cos(r), s = Math.sin(r); const nx = (c * ox - s * oy) * scl, ny = (s * ox + c * oy) * scl; ox = nx; oy = ny; }
      return [ox + qx, oy + qy];
    };
  },
  pinState(comp, L, t, eff) { return eff.pins.map(pn => { const o = Anim.evalProp(pn.off, comp, L, t); return { p: pn.rest, q: [pn.rest[0] + o[0], pn.rest[1] + o[1]], rot: Anim.evalProp(pn.rot, comp, L, t), scl: Anim.evalProp(pn.scl, comp, L, t) / 100, id: pn.id }; }); },
  apply(comp, L, t, rt, eff, A, rs, W, H) {
    const mesh = this.mesh(comp, L, eff, t); if (!mesh) return null;
    const f = this.deformer(this.pinState(comp, L, t, eff));
    const gl = GLX.gl;
    const data = new Float32Array(mesh.tris.length * 4); let k = 0;
    for (const i of mesh.tris) { const v = mesh.pts[i]; const d = f(v); const a = Shapes.apA(A, v), b = Shapes.apA(A, d); data[k++] = b[0] * rs; data[k++] = b[1] * rs; data[k++] = a[0] * rs / W; data[k++] = 1 - a[1] * rs / H; }
    if (!this.vao) { this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao); this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8); }
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const out = GLX.acquire(W, H); GLX.clear(out); GLX.bind(out);
    GLX.use('puppet'); GLX.set('uRes', [W, H]); GLX.tex('uTex', rt.tex);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.drawArrays(gl.TRIANGLES, 0, mesh.tris.length); gl.disable(gl.BLEND);
    return out;
  },
};
Shaders.puppet = {
  vs: `layout(location=0) in vec2 aPos; layout(location=1) in vec2 aUV; uniform vec2 uRes; out vec2 vUV; void main(){ vUV=aUV; gl_Position=vec4(aPos.x/uRes.x*2.0-1.0, 1.0-aPos.y/uRes.y*2.0,0,1); }`,
  fs: `in vec2 vUV; uniform sampler2D uTex; out vec4 o; void main(){ o=texture(uTex,vUV); }`,
};
