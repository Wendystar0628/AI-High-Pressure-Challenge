'use strict';
// ============ 变换、形状内容求值、文字排版与动画器 ============
const Xform = {
  ev(p, comp, layer, t) { return Anim.evalProp(p, comp, layer, t); },
  // 本地矩阵：T(位置)·Rx·Ry·Rz·S·T(-锚点)
  local(comp, layer, t) {
    const tr = layer.tr; const e = p => this.ev(p, comp, layer, t);
    const p = e(tr.position), a = (layer.type === 'camera' || layer.type === 'light') ? [0, 0, 0] : e(tr.anchor), s = (layer.type === 'camera' || layer.type === 'light') ? [100, 100, 100] : e(tr.scale);
    const d3 = layer.threeD;
    let M = M4.translate(p[0], p[1], d3 ? (p[2] || 0) : 0);
    if (d3) { M = M4.mul(M, M4.rotX(U.rad(e(tr.rotX)))); M = M4.mul(M, M4.rotY(U.rad(e(tr.rotY)))); }
    M = M4.mul(M, M4.rotZ(U.rad(e(tr.rotation))));
    M = M4.mul(M, M4.scale(s[0] / 100, s[1] / 100, d3 ? (s[2] ?? 100) / 100 : 1));
    M = M4.mul(M, M4.translate(-a[0], -a[1], d3 ? -(a[2] || 0) : 0));
    return M;
  },
  parentMatrix(comp, layer, t, depth = 0) {
    if (!layer.parent || depth > 32) return M4.ident();
    const P = comp.layers.find(l => l.id === layer.parent);
    if (!P) return M4.ident();
    return this.layerMatrix(comp, P, t, depth + 1);
  },
  layerMatrix(comp, layer, t, depth = 0) {
    return M4.mul(this.parentMatrix(comp, layer, t, depth), this.local(comp, layer, t));
  },
  // 父级不继承不透明度
  opacity(comp, layer, t) { return U.clamp(this.ev(layer.tr.opacity, comp, layer, t) / 100, 0, 1); },
  // 世界坐标中某个本地点（例如摄像机目标点在父级空间）
  parentPoint(comp, layer, t, p) { return M4.pt(this.parentMatrix(comp, layer, t), p); },
  // 摄像机 {eye, target, zoom, view, proj...}
  camera(comp, t, layer) {
    const cam = layer || this.activeCamera(comp, t);
    const w = comp.width, h = comp.height;
    let eye, target, zoom, focus, aperture, dof = false, roll = 0;
    if (cam) {
      const e = p => this.ev(p, comp, cam, t);
      const PM = this.parentMatrix(comp, cam, t);
      eye = M4.pt(PM, e(cam.tr.position)); target = M4.pt(PM, e(cam.cam.poi));
      zoom = e(cam.cam.zoom); focus = e(cam.cam.focus); aperture = e(cam.cam.aperture); dof = cam.cam.dof && aperture > 0; roll = e(cam.tr.rotation);
    } else { zoom = 2666.7 * h / 1080; eye = [w / 2, h / 2, -zoom]; target = [w / 2, h / 2, 0]; focus = zoom; aperture = 0; }
    let up = [0, -1, 0];
    let view = M4.lookAt(eye, target, up);
    if (roll) view = M4.mul(M4.rotZ(-U.rad(roll)), view);
    const fovy = 2 * Math.atan(h / 2 / zoom);
    const near = Math.max(1, zoom * 0.01), far = zoom * 40 + 20000;
    const proj = M4.perspective(fovy, w / h, near, far);
    return { eye, target, zoom, focus, aperture, dof, view, proj, vp: M4.mul(proj, view), fovy, near, far, layer: cam };
  },
  activeCamera(comp, t) { return comp.layers.find(l => l.type === 'camera' && l.visible && t >= l.inPoint && t < l.outPoint) || null; },
  // 世界点 → 合成像素
  project(cam, comp, p) {
    const c = M4.pt4(cam.vp, p); if (c[3] <= 1e-6) return null;
    return [(c[0] / c[3] * 0.5 + 0.5) * comp.width, (1 - (c[1] / c[3] * 0.5 + 0.5)) * comp.height, c[3]];
  },
  // 图层在合成中的二维矩阵（3D 图层经摄像机投影时返回 null）
  isActive(layer, t) { return t >= layer.inPoint && t < layer.outPoint; },
};

// ============ 形状图层 ============
const Shapes = {
  ev(p, ctx) { return Anim.evalProp(p, ctx.comp, ctx.layer, ctx.t); },
  groupMat(tr, ctx) {
    const a = this.ev(tr.anchor, ctx), p = this.ev(tr.position, ctx), s = this.ev(tr.scale, ctx), r = this.ev(tr.rotation, ctx);
    return this.affine(p, r, s, a);
  },
  affine(p, rDeg, s, a) { // 2x3 [a,b,c,d,e,f]
    const r = U.rad(rDeg), c = Math.cos(r), sn = Math.sin(r), sx = s[0] / 100, sy = s[1] / 100;
    const A = c * sx, B = sn * sx, C = -sn * sy, D = c * sy;
    return [A, B, C, D, p[0] - (A * a[0] + C * a[1]), p[1] - (B * a[0] + D * a[1])];
  },
  mulA(m, n) { return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; },
  apA(m, p) { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; },
  powA(m, k) { let r = [1, 0, 0, 1, 0, 0]; for (let i = 0; i < k; i++) r = this.mulA(m, r); return r; },
  // 求值：返回 {rends:[{kind, conts, color, opacity, width, ...}], conts}
  evaluate(comp, layer, t) {
    const ctx = { comp, layer, t };
    const r = this.evalItems(layer.contents, ctx);
    return r;
  },
  itemPath(it, ctx) {
    if (it.type === 'rect') { const s = this.ev(it.size, ctx), p = this.ev(it.pos, ctx); return { c: [Geo2D.rect(p[0], p[1], s[0], s[1], this.ev(it.round, ctx))] }; }
    if (it.type === 'ellipse') { const s = this.ev(it.size, ctx), p = this.ev(it.pos, ctx); return { c: [Geo2D.ellipse(p[0], p[1], s[0], s[1])] }; }
    if (it.type === 'path') return this.ev(it.path, ctx);
    return { c: [] };
  },
  evalItems(items, ctx) {
    let conts = [], rends = [];
    for (const it of items) {
      if (!it.on) continue;
      switch (it.type) {
        case 'rect': case 'ellipse': case 'path': conts.push({ polys: Geo2D.flattenPath(this.itemPath(it, ctx), 0.35), src: it.id }); break;
        case 'group': {
          const r = this.evalItems(it.items, ctx); const M = this.groupMat(it.tr, ctx); const op = this.ev(it.tr.opacity, ctx) / 100;
          for (const c of r.conts) c.polys = c.polys.map(p => ({ pts: p.pts.map(q => this.apA(M, q)), closed: p.closed }));
          const sc = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]));
          for (const rd of r.rends) { rd.opacity *= op; rd.wscale = (rd.wscale || 1) * sc; if (rd.g) rd.g = rd.g.map(q => this.apA(M, q)); }
          // 已被子组渲染器引用的容器在本组仍可被后续操作处理
          conts.push(...r.conts); rends.push(...r.rends); break;
        }
        case 'fill': rends.push({ kind: 'fill', conts: conts.slice(), color: this.ev(it.color, ctx), opacity: this.ev(it.opacity, ctx) / 100, rule: it.rule }); break;
        case 'gfill': rends.push({ kind: 'gfill', conts: conts.slice(), gtype: it.gtype, g: [this.ev(it.start, ctx), this.ev(it.end, ctx)], c1: this.ev(it.c1, ctx), c2: this.ev(it.c2, ctx), opacity: this.ev(it.opacity, ctx) / 100, rule: it.rule }); break;
        case 'stroke': rends.push({ kind: 'stroke', conts: conts.slice(), color: this.ev(it.color, ctx), opacity: this.ev(it.opacity, ctx) / 100, width: this.ev(it.width, ctx), join: it.join, cap: it.cap }); break;
        case 'trim': {
          const s = U.clamp(this.ev(it.start, ctx) / 100, 0, 1), e = U.clamp(this.ev(it.end, ctx) / 100, 0, 1), off = this.ev(it.offset, ctx) / 360;
          if (it.mode === 'indiv') {
            const all = []; conts.forEach((c, ci) => c.polys.forEach(p => all.push({ p, ci })));
            const res = Geo2D.trim(all.map(a => a.p), s, e, off, 'indiv');
            // 按顺序回填
            const lens = all.map(a => Geo2D.polyLen(a.p.pts, a.p.closed)); const tot = lens.reduce((x, y) => x + y, 0) || 1;
            const byC = conts.map(() => []); let acc = 0; const A = (Math.min(s, e) + off) * tot, B = (Math.max(s, e) + off) * tot;
            all.forEach((a, i) => { const l0 = acc, l1 = acc + lens[i]; acc = l1; const lo = Math.max(A, l0), hi = Math.min(B, l1); if (hi > lo && lens[i] > 0) { const q = Geo2D.trim([a.p], (lo - l0) / lens[i], (hi - l0) / lens[i], 0, 'simul'); byC[a.ci].push(...q); } });
            conts.forEach((c, i) => { c.polys = byC[i]; });
          } else for (const c of conts) c.polys = Geo2D.trim(c.polys, s, e, off, 'simul');
          break;
        }
        case 'merge': {
          let polys;
          if (it.mode === 'merge') polys = conts.flatMap(c => c.polys);
          else {
            const groups = conts.map(c => c.polys.filter(p => p.pts.length > 2).map(p => p.pts)).filter(g => g.length);
            const key = it.mode + JSON.stringify(groups).length + ':' + U.hash(JSON.stringify(groups));
            polys = this._mergeCache.get(key);
            if (!polys) { polys = Geo2D.boolean(groups, it.mode).map(p => ({ pts: p, closed: true })); if (this._mergeCache.size > 200) this._mergeCache.clear(); this._mergeCache.set(key, polys); }
            polys = polys.map(p => ({ pts: p.pts, closed: true }));
          }
          for (const c of conts) c.polys = [];
          conts = [{ polys, src: it.id }];
          break;
        }
        case 'repeater': {
          const n = Math.max(0, Math.round(this.ev(it.copies, ctx))), off = this.ev(it.offset, ctx);
          const a = this.ev(it.anchor, ctx), p = this.ev(it.position, ctx), s = this.ev(it.scale, ctx), r = this.ev(it.rotation, ctx);
          const so = this.ev(it.so, ctx) / 100, eo = this.ev(it.eo, ctx) / 100;
          const nc = [], nr = [];
          for (let k = 0; k < n; k++) {
            const kk = k + off;
            const M = this.affine([a[0] + p[0] * kk, a[1] + p[1] * kk], r * kk, [100 * Math.pow(s[0] / 100, kk), 100 * Math.pow(s[1] / 100, kk)], a);
            const map = new Map();
            for (const c of conts) { const cc = { polys: c.polys.map(q => ({ pts: q.pts.map(v => this.apA(M, v)), closed: q.closed })), src: c.src }; map.set(c, cc); nc.push(cc); }
            const op = n > 1 ? U.lerp(so, eo, k / (n - 1)) : so;
            const sc = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]));
            const copies = rends.map(rd => Object.assign({}, rd, { conts: rd.conts.map(c => map.get(c) || c), opacity: rd.opacity * op, wscale: (rd.wscale || 1) * sc, g: rd.g ? rd.g.map(q => this.apA(M, q)) : rd.g }));
            if (it.composite === 'above') nr.unshift(...copies); else nr.push(...copies);
          }
          conts = nc; rends = nr; break;
        }
      }
    }
    return { conts, rends };
  },
  _mergeCache: new Map(),
  // 图层全部轮廓（图层空间）
  allPolys(comp, layer, t) { return this.evaluate(comp, layer, t).conts.flatMap(c => c.polys); },
};

// ============ 文字 ============
const TextL = {
  ev(p, comp, layer, t) { return Anim.evalProp(p, comp, layer, t); },
  layout(comp, layer, t) {
    const X = layer.text; const src = String(this.ev(X.source, comp, layer, t) ?? '');
    const size = this.ev(X.size, comp, layer, t), lead = this.ev(X.leading, comp, layer, t), track = this.ev(X.tracking, comp, layer, t);
    const sc = size / 1000; const lines = src.split('\n');
    const chars = []; let ci = 0, wi = 0;
    lines.forEach((ln, li) => {
      const arr = [...ln]; const gl = arr.map(ch => Fonts.glyph(X.font, ch));
      const width = gl.reduce((s, g) => s + g.adv * sc + track * sc, 0) - (arr.length ? track * sc : 0);
      let x = X.align === 'left' ? 0 : X.align === 'right' ? -width : -width / 2;
      const y = li * lead;
      let inWord = false;
      arr.forEach((ch, k) => {
        const g = gl[k];
        const space = !!g.space;
        if (space) { if (inWord) { wi++; inWord = false; } } else inWord = true;
        chars.push({ ch, x, y, sc, size, g, line: li, word: wi, index: ci, space, cx: x + g.adv * sc / 2, cy: y - 0.38 * size });
        ci++; x += g.adv * sc + track * sc;
      });
      if (inWord) wi++;
    });
    return { chars, lines: lines.length, nChars: ci, nWords: wi, size };
  },
  // 范围选择器：返回每个字符的数量 0..1
  selAmount(sel, unitIdx, nUnits, comp, layer, t) {
    let s = this.ev(sel.start, comp, layer, t) / 100, e = this.ev(sel.end, comp, layer, t) / 100; const off = this.ev(sel.offset, comp, layer, t) / 100, soft = this.ev(sel.soft, comp, layer, t) / 100;
    if (s > e) [s, e] = [e, s]; s += off; e += off;
    const u0 = unitIdx / nUnits, u1 = (unitIdx + 1) / nUnits;
    if (soft <= 1e-4) { const ov = Math.max(0, Math.min(u1, e) - Math.max(u0, s)); return U.clamp(ov * nUnits, 0, 1); }
    const c = (u0 + u1) / 2; const w = soft;
    const a = U.smooth(s - w / 2, s + w / 2, c), b = 1 - U.smooth(e - w / 2, e + w / 2, c);
    return U.clamp(Math.min(a, b), 0, 1);
  },
  // 返回字符变换后的绘制数据
  evaluate(comp, layer, t, opts = {}) {
    const X = layer.text; const L = this.layout(comp, layer, t);
    const anims = opts.noAnim ? [] : X.animators.map(a => ({ a, pos: this.ev(a.position, comp, layer, t), rot: this.ev(a.rotation, comp, layer, t), scl: this.ev(a.scale, comp, layer, t), op: this.ev(a.opacity, comp, layer, t) }));
    const writeOn = X.write.on && !opts.noWrite;
    const prog = writeOn ? U.clamp(this.ev(X.write.progress, comp, layer, t) / 100, 0, 1) : 1;
    const brushW = this.ev(X.write.brush, comp, layer, t);
    // 书写：按笔画长度分配进度
    let strokeList = [];
    if (writeOn) {
      for (const c of L.chars) { if (c.space) continue; if (c.g.strokes) c.g.strokes.forEach((s, si) => { const b = DuanFont.brush(s); strokeList.push({ c, si, b, w: b.len + 140 }); }); else strokeList.push({ c, si: -1, w: 900 }); }
    }
    const totW = strokeList.reduce((s, x) => s + x.w, 0) || 1; let accW = 0; const written = new Map();
    for (const s of strokeList) { const a0 = accW / totW, a1 = (accW + s.w) / totW; accW += s.w; const f = U.clamp((prog - a0) / (a1 - a0), 0, 1); if (!written.has(s.c)) written.set(s.c, []); written.get(s.c).push({ si: s.si, b: s.b, f, len: s.b ? s.b.len : 0 }); }
    const out = [];
    for (const c of L.chars) {
      if (c.space) continue;
      let px = 0, py = 0, pz = 0, rot = 0, sx = 1, sy = 1, op = 1;
      for (const an of anims) {
        const un = an.a.sel.units; const idx = un === 'word' ? c.word : un === 'line' ? c.line : c.index; const n = un === 'word' ? L.nWords : un === 'line' ? L.lines : L.nChars;
        const amt = this.selAmount(an.a.sel, idx, Math.max(1, n), comp, layer, t);
        if (!amt) continue;
        px += an.pos[0] * amt; py += an.pos[1] * amt; pz += (an.pos[2] || 0) * amt; rot += an.rot * amt;
        sx *= U.lerp(1, an.scl[0] / 100, amt); sy *= U.lerp(1, an.scl[1] / 100, amt); op *= U.lerp(1, an.op / 100, amt);
      }
      // 字符矩阵：绕字符中心
      const r = U.rad(rot), cs = Math.cos(r), sn = Math.sin(r);
      const A = cs * sx * c.sc, B = sn * sx * c.sc, C = -sn * sy * c.sc, D = cs * sy * c.sc;
      // 字形坐标 (gx,gy) → 字符原点 (c.x + gx*sc, c.y + (gy-880)*sc)，再绕中心变换
      const ox = c.x, oy = c.y - 880 * c.sc; // 字形框左上角
      // p = center + R S (q - center), q = o + g*sc
      const ccx = c.cx, ccy = c.cy;
      const E = ccx + px + (cs * sx * (ox - ccx) - sn * sy * (oy - ccy)), F = ccy + py + (sn * sx * (ox - ccx) + cs * sy * (oy - ccy));
      const m = [A, B, C, D, E, F];
      const item = { c, m, op, z: pz };
      if (writeOn) {
        const ws = written.get(c) || [];
        if (c.g.strokes) item.strokes = ws.filter(w => w.f > 0).map(w => ({ b: w.b, upto: w.f * w.len, f: w.f })), item.brushW = brushW;
        else item.op *= ws.length ? ws[0].f : 1, item.polys = c.g.polys;
        item.progress = ws.length ? ws.reduce((s, w) => s + w.f, 0) / ws.length : 1;
      } else item.polys = c.g.polys;
      out.push(item);
    }
    return { items: out, layout: L };
  },
  // 字形轮廓（图层空间）：[[x,y]] 数组列表
  polys(comp, layer, t, opts = {}) {
    const r = this.evaluate(comp, layer, t, Object.assign({ noWrite: true }, opts));
    const out = [];
    for (const it of r.items) if (it.polys) for (const p of it.polys) out.push(p.map(q => [it.m[0] * q[0] + it.m[2] * q[1] + it.m[4], it.m[1] * q[0] + it.m[3] * q[1] + it.m[5]]));
    return out;
  },
  // 笔画中线（图层空间），用于节点“文字笔画”
  strokeLines(comp, layer, t) {
    const r = this.evaluate(comp, layer, t, { noWrite: true }); const out = [];
    for (const it of r.items) if (it.c.g.strokes) for (const s of it.c.g.strokes) { const b = DuanFont.brush(s); out.push({ pts: b.pts.map(q => [it.m[0] * q[0] + it.m[2] * q[1] + it.m[4], it.m[1] * q[0] + it.m[3] * q[1] + it.m[5]]), closed: false, w: b.w.map(w => w * Math.sqrt(Math.abs(it.m[0] * it.m[3] - it.m[1] * it.m[2]))) }); }
    return out;
  },
  bbox(comp, layer, t) {
    const P = this.polys(comp, layer, t);
    if (!P.length) { const s = this.ev(layer.text.size, comp, layer, t); return [-s / 2, -s, s / 2, 0]; }
    return Geo2D.bbox(P);
  },
};
