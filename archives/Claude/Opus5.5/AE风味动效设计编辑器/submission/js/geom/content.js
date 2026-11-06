// 图层内容求值：形状组（路径/填充/描边/修剪/重复/布尔/形变/场位移）与文字（排版/动画器/路径文字）
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, P = AE.Path, Poly = AE.Poly, E = AE.Eval, F = AE.Font;
  const C = AE.Content = {};
  const aff = P.aff;

  // ---------- 形状 ----------
  // 绘制项：{kind:'fill'|'stroke', polys, color, opacity, rule, width, join, cap, grad}
  C.shape = (layer, t, ctx, tol) => {
    const r = evalItems(layer.content || [], t, ctx, layer, tol);
    return r.draws;
  };
  // 几何（填充区域的闭合轮廓，图层空间）
  C.shapeGeometry = (layer, t, ctx, tol) => {
    const r = evalItems(layer.content || [], t, ctx, layer, tol);
    const fills = r.draws.filter(d => d.kind === 'fill');
    let polys = [];
    if (fills.length) for (const f of fills) polys = polys.concat(f.polys.filter(p => p.c));
    else polys = r.paths.filter(p => p.c);
    return { polys, paths: r.paths, draws: r.draws };
  };
  function V(prop, t, ctx, layer) { return E.prop(prop, t, ctx, layer); }
  function groupMatrix(tf, t, ctx, layer) {
    return aff.trs(V(tf.position, t, ctx, layer), V(tf.anchor, t, ctx, layer), V(tf.scale, t, ctx, layer), V(tf.rotation, t, ctx, layer), tf.skew ? V(tf.skew, t, ctx, layer) : 0);
  }
  function xformDraw(d, m, opMul) {
    const s = aff.scaleOf(m);
    const nd = Object.assign({}, d, { polys: d.polys.map(p => P.xformPoly(p, m)), opacity: d.opacity * opMul });
    if (d.kind === 'stroke') nd.width = d.width * s;
    if (d.grad) nd.grad = Object.assign({}, d.grad, { s: aff.pt(m, d.grad.s[0], d.grad.s[1]), e: aff.pt(m, d.grad.e[0], d.grad.e[1]) });
    return nd;
  }
  function evalItems(items, t, ctx, layer, tol) {
    let paths = [], draws = [];
    for (const it of items) {
      if (it.on === false) continue;
      switch (it.type) {
        case 'rect': { const s = V(it.size, t, ctx, layer), p = V(it.position, t, ctx, layer); paths.push(P.flatten(P.rect(p[0], p[1], s[0], s[1], V(it.roundness, t, ctx, layer)), tol)); break; }
        case 'ellipse': { const s = V(it.size, t, ctx, layer), p = V(it.position, t, ctx, layer); paths.push(P.flatten(P.ellipse(p[0], p[1], s[0], s[1]), tol)); break; }
        case 'star': { const p = V(it.position, t, ctx, layer); paths.push(P.flatten(P.star(p[0], p[1], Math.max(3, Math.round(V(it.points, t, ctx, layer))), V(it.outerRadius, t, ctx, layer), V(it.innerRadius, t, ctx, layer), V(it.roundness, t, ctx, layer), V(it.rotation, t, ctx, layer), it.polygon), tol)); break; }
        case 'path': { const sh = V(it.path, t, ctx, layer) || []; for (const c of sh) paths.push(P.flatten(c, tol)); break; }
        case 'group': {
          const sub = evalItems(it.items || [], t, ctx, layer, tol);
          const m = groupMatrix(it.transform, t, ctx, layer), op = U.clamp(V(it.transform.opacity, t, ctx, layer) / 100, 0, 1);
          for (const p of sub.paths) paths.push(P.xformPoly(p, m));
          for (const d of sub.draws) draws.push(xformDraw(d, m, op));
          break;
        }
        case 'fill': draws.push({ kind: 'fill', polys: paths.slice(), color: V(it.color, t, ctx, layer), opacity: V(it.opacity, t, ctx, layer) / 100, rule: it.rule || 'nonzero', blend: it.blend, srcId: it.id }); break;
        case 'gfill': {
          const s = V(it.start, t, ctx, layer), e = V(it.end, t, ctx, layer);
          draws.push({ kind: 'fill', polys: paths.slice(), color: [1, 1, 1, 1], opacity: V(it.opacity, t, ctx, layer) / 100, rule: it.rule || 'nonzero', grad: { type: it.kind === 'radial' ? 1 : 0, s, e, stops: it.stops }, srcId: it.id });
          break;
        }
        case 'stroke': {
          let ps = paths.slice();
          const dash = V(it.dash, t, ctx, layer), gap = V(it.gap, t, ctx, layer);
          if (dash > 0.5) ps = dashPolys(ps, dash, gap || dash, V(it.dashOffset, t, ctx, layer));
          draws.push({ kind: 'stroke', polys: ps, color: V(it.color, t, ctx, layer), opacity: V(it.opacity, t, ctx, layer) / 100, width: V(it.width, t, ctx, layer), join: it.join, cap: it.cap, srcId: it.id });
          break;
        }
        case 'trim': paths = P.trim(paths, V(it.start, t, ctx, layer), V(it.end, t, ctx, layer), V(it.offset, t, ctx, layer), it.mode === 'individual' ? 'individual' : 'simul'); break;
        case 'merge': {
          const closed = paths.filter(p => p.c && p.p.length >= 6);
          if (closed.length < 2) break;
          const mode = it.mode || 'union';
          if (mode === 'union') {
            let acc = [closed[0]]; for (let k = 1; k < closed.length; k++) acc = Poly.boolean(acc, [closed[k]], 'union'); paths = acc;
          } else {
            let acc = [closed[0]]; for (let k = 1; k < closed.length; k++) acc = Poly.boolean(acc, [closed[k]], mode === 'exclude' ? 'xor' : mode); paths = acc;
          }
          break;
        }
        case 'repeater': {
          const n = Math.max(0, Math.round(V(it.copies, t, ctx, layer))), off = V(it.offset, t, ctx, layer), tf = it.transform;
          const pos = V(tf.position, t, ctx, layer), anc = V(tf.anchor, t, ctx, layer), sc = V(tf.scale, t, ctx, layer), rot = V(tf.rotation, t, ctx, layer);
          const so = V(tf.startOpacity, t, ctx, layer) / 100, eo = V(tf.endOpacity, t, ctx, layer) / 100;
          const np = [], nd = [];
          const order = [];
          for (let k = 0; k < n; k++) order.push(k);
          if (it.composite === 'below') order.reverse();
          for (const k of order) {
            const i = k + off;
            const m = aff.trs([pos[0] * i + anc[0], pos[1] * i + anc[1]], anc, [Math.pow(sc[0] / 100, i) * 100, Math.pow(sc[1] / 100, i) * 100], rot * i);
            const op = n > 1 ? U.lerp(so, eo, k / (n - 1)) : so;
            for (const p of paths) np.push(Object.assign(P.xformPoly(p, m), { inst: k }));
            for (const d of draws) nd.push(Object.assign(xformDraw(d, m, op), { inst: k }));
          }
          paths = np; draws = nd;
          break;
        }
        case 'morph': {
          const tgt = V(it.target, t, ctx, layer) || [];
          const B = tgt.map(c => P.flatten(c, tol));
          const prog = U.clamp(V(it.progress, t, ctx, layer) / 100, -0.5, 1.5);
          const ns = Math.max(8, Math.round(V(it.samples, t, ctx, layer)));
          if (B.length && paths.length) paths = P.morph(paths, B, prog, it.mapping, ns);
          break;
        }
        case 'resample': { const sp = Math.max(1, V(it.spacing, t, ctx, layer)); paths = paths.map(p => P.resample(p, Math.max(4, Math.round(P.polyLength(p) / sp)))); break; }
        case 'displace': {
          const amt = V(it.amount, t, ctx, layer), sp = Math.max(1, V(it.resample, t, ctx, layer));
          if (!AE.Fields || !it.field) break;
          const W = E.world(layer, t, ctx);
          paths = paths.map(p => {
            const q = P.resample(p, Math.max(8, Math.round(P.polyLength(p) / sp)));
            const out = q.p.slice();
            for (let k = 0; k < out.length; k += 2) {
              const wp = U.M4.apply(W, [out[k], out[k + 1], 0]);
              const f = AE.Fields.sampleNamedVec(ctx.comp, it.field, wp, t, ctx);
              out[k] += f[0] * amt; out[k + 1] += f[1] * amt;
            }
            return { c: q.c, p: out };
          });
          break;
        }
        case 'nodeGeo': {
          if (!AE.Nodes || !it.output) break;
          const g = AE.Nodes.output(ctx.comp, it.output, t, ctx);
          if (g && g.paths) for (const p of g.paths) paths.push({ c: p.c, p: p.p.slice() });
          break;
        }
      }
    }
    return { paths, draws };
  }
  function dashPolys(polys, dash, gap, offset) {
    const out = [], per = dash + gap;
    for (const pl of polys) {
      const cum = P.cumLen(pl), L = cum[cum.length - 1];
      let s = -(((offset % per) + per) % per);
      while (s < L) { const a = Math.max(0, s), b = Math.min(L, s + dash); if (b > a) { const r = P.subPoly(pl, cum, a, b); if (r) out.push(r); } s += per; }
    }
    return out;
  }
  C.drawBounds = (draws) => {
    let b = null;
    for (const d of draws) {
      const bb = P.bounds(d.polys); if (!bb) continue;
      const pad = d.kind === 'stroke' ? d.width / 2 + 1 : 1;
      const x = [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad];
      b = b ? [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])] : x;
    }
    return b;
  };

  // ---------- 文字 ----------
  // 排版：返回字符单元 [{ch, line, word, idx, x, y(基线), adv, polys(em)}]
  C.layoutText = (layer, t, ctx) => {
    const T = layer.text;
    const str = String(V(T.source, t, ctx, layer));
    const size = V(T.size, t, ctx, layer), track = V(T.tracking, t, ctx, layer) / 1000, lead = V(T.leading, t, ctx, layer);
    const lines = str.split('\n');
    const chars = []; let idx = 0, word = 0, nonSpace = 0;
    const lineH = size * lead;
    lines.forEach((ln, li) => {
      const arr = Array.from(ln);
      const gl = arr.map(ch => F.glyph(ch, T.font, T.weight));
      let w = 0; gl.forEach((g, k) => { w += g.adv * size + (k < gl.length - 1 ? track * size : 0); });
      let x = T.align === 'left' ? 0 : T.align === 'right' ? -w : -w / 2;
      let inWord = false;
      arr.forEach((ch, k) => {
        const g = gl[k], sp = /\s/.test(ch);
        if (!sp && !inWord) { inWord = true; } if (sp && inWord) { inWord = false; word++; }
        chars.push({ ch, line: li, word: sp ? -1 : word, idx: idx++, ci: sp ? -1 : nonSpace, x, y: li * lineH, adv: g.adv * size, size, polys: g.polys, space: sp });
        if (!sp) nonSpace++;
        x += g.adv * size + track * size;
      });
      if (inWord) word++;
    });
    // 垂直居中：整体以首行基线上移半个字高为原点
    const totalH = (lines.length - 1) * lineH;
    const dy = -totalH / 2 + size * 0.36;
    for (const c of chars) c.y += dy;
    return { chars, size, lines: lines.length, words: word, nonSpace };
  };
  // 选择器权重
  C.selectorAmount = (sel, u, N, t, ctx, layer) => {
    let s = V(sel.start, t, ctx, layer) / 100, e = V(sel.end, t, ctx, layer) / 100;
    const off = V(sel.offset, t, ctx, layer) / 100, soft = V(sel.softness, t, ctx, layer) / 100;
    if (s > e) [s, e] = [e, s];
    s += off; e += off;
    if (sel.reverse) u = N - 1 - u;
    const a = u / N, b = (u + 1) / N, c = (u + 0.5) / N;
    const shape = sel.shape || 'square';
    let amt;
    if (shape === 'square') {
      if (soft > 0) amt = U.smooth(s - soft / 2, s + soft / 2, c) * (1 - U.smooth(e - soft / 2, e + soft / 2, c));
      else amt = U.clamp((Math.min(b, e) - Math.max(a, s)) * N, 0, 1);
    } else {
      const x = (c - s) / ((e - s) || 1e-9);
      if (x < 0 || x > 1) amt = shape === 'rampUp' ? (x > 1 ? 1 : 0) : shape === 'rampDown' ? (x < 0 ? 1 : 0) : 0;
      else if (shape === 'rampUp') amt = x;
      else if (shape === 'rampDown') amt = 1 - x;
      else if (shape === 'triangle') amt = 1 - Math.abs(2 * x - 1);
      else if (shape === 'round') amt = Math.sqrt(Math.max(0, 1 - Math.pow(2 * x - 1, 2)));
      else amt = 0.5 - 0.5 * Math.cos(x * Math.PI * 2);
    }
    return U.clamp(amt, 0, 1);
  };
  // 逐字变换：返回 [{c, m(2D 仿射, em→图层), op, hue, pos3:[x,y,z], rot3:[rx,ry,rz], scl}]
  C.textPlacements = (layer, t, ctx, tol) => {
    const T = layer.text, lay = C.layoutText(layer, t, ctx);
    const anims = (T.animators || []).filter(a => a.on !== false);
    // 路径文字
    let path = null;
    if (T.path && T.path.mask) {
      const mk = layer.masks.find(m => m.id === T.path.mask);
      if (mk) { const sh = V(mk.path, t, ctx, layer); if (sh && sh[0]) { const pl = P.flatten(sh[0], 0.5); path = { pl, cum: P.cumLen(pl) }; } }
    }
    const margin = path ? V(T.path.margin, t, ctx, layer) : 0;
    const out = [];
    const extraTrack = new Float64Array(lay.chars.length);
    for (const a of anims) if (a.use.tracking) {
      for (const c of lay.chars) { const am = unitAmount(a.sel, c, lay, t, ctx, layer); extraTrack[c.idx] = V(a.props.tracking, t, ctx, layer) / 1000 * c.size * am; }
    }
    // 累计字距偏移（按行）
    const shiftX = new Float64Array(lay.chars.length);
    let acc = 0, curLine = -1;
    for (const c of lay.chars) { if (c.line !== curLine) { curLine = c.line; acc = 0; } shiftX[c.idx] = acc; acc += extraTrack[c.idx]; }
    for (const c of lay.chars) {
      if (c.space) continue;
      let px = 0, py = 0, pz = 0, rot = 0, rx = 0, ry = 0, sx = 1, sy = 1, op = 1, hue = 0;
      for (const a of anims) {
        const am = unitAmount(a.sel, c, lay, t, ctx, layer);
        if (am <= 0) continue;
        if (a.use.position) { const p = V(a.props.position, t, ctx, layer); px += p[0] * am; py += p[1] * am; pz += (p[2] || 0) * am; }
        if (a.use.rotation) rot += V(a.props.rotation, t, ctx, layer) * am;
        if (a.use.rotX && a.props.rotX) rx += V(a.props.rotX, t, ctx, layer) * am;
        if (a.use.rotY && a.props.rotY) ry += V(a.props.rotY, t, ctx, layer) * am;
        if (a.use.scale) { const s = V(a.props.scale, t, ctx, layer); sx *= 1 + (s[0] / 100 - 1) * am; sy *= 1 + (s[1] / 100 - 1) * am; }
        if (a.use.opacity) op *= 1 + (V(a.props.opacity, t, ctx, layer) / 100 - 1) * am;
        if (a.use.fillHue) hue += V(a.props.fillHue, t, ctx, layer) * am;
      }
      // 字符中心（绕自身中心变化）
      const cxl = c.adv / 2, cyl = -c.size * 0.36;
      let baseX = c.x + shiftX[c.idx] + cxl, baseY = c.y + cyl, baseRot = 0;
      if (path) {
        const s = margin + c.x + shiftX[c.idx] + cxl - (lay.chars[0] ? lay.chars[0].x : 0);
        const L = path.cum[path.cum.length - 1];
        const pt = P.pointAt(path.pl, path.cum, T.path.reverse ? L - s : s);
        const tx = T.path.reverse ? -pt.tx : pt.tx, ty = T.path.reverse ? -pt.ty : pt.ty;
        const nx = ty, ny = -tx; // 路径左侧法线
        const lineOff = c.line * c.size * V(T.leading, t, ctx, layer) + cyl; // 基线位于路径上，后续行向下
        baseX = pt.x - nx * lineOff; baseY = pt.y - ny * lineOff;
        baseRot = T.path.perpendicular !== false ? Math.atan2(ty, tx) / U.deg : 0;
      }
      // em → 字符局部（以字符中心为原点）→ 旋转缩放 → 位置
      let m = [c.size, 0, 0, c.size, -cxl, -cyl];
      m = aff.mul(aff.trs([baseX + px, baseY + py], [0, 0], [sx * 100, sy * 100], rot + baseRot), m);
      out.push({ c, m, op: U.clamp(op, 0, 1), hue, pos3: [baseX + px, baseY + py, pz], rot3: [rx, ry, rot + baseRot], scl: [sx, sy], local: [c.size, -cxl, -cyl] });
    }
    return { lay, items: out };
  };
  function unitAmount(sel, c, lay, t, ctx, layer) {
    const based = sel.basedOn || 'chars';
    if (based === 'words') return c.word < 0 ? 0 : C.selectorAmount(sel, c.word, Math.max(1, lay.words), t, ctx, layer);
    if (based === 'lines') return C.selectorAmount(sel, c.line, Math.max(1, lay.lines), t, ctx, layer);
    return C.selectorAmount(sel, c.ci, Math.max(1, lay.nonSpace), t, ctx, layer);
  }
  C.text = (layer, t, ctx, tol) => {
    const T = layer.text, pl = C.textPlacements(layer, t, ctx, tol);
    const fill = V(T.fill, t, ctx, layer), sw = V(T.strokeWidth, t, ctx, layer), sc = V(T.strokeColor, t, ctx, layer);
    const draws = [];
    for (const it of pl.items) {
      const polys = it.c.polys.map(p => P.xformPoly(p, it.m));
      let col = fill;
      if (it.hue) { const h = U.rgb2hsl(fill); h[0] = (h[0] + it.hue / 360) % 1; col = U.hsl2rgb(h); }
      if (sw > 0) draws.push({ kind: 'stroke', polys, color: sc, opacity: it.op, width: sw, join: 'round', cap: 'round', ch: it.c.idx });
      draws.push({ kind: 'fill', polys, color: col, opacity: it.op, rule: 'evenodd', ch: it.c.idx });
    }
    return draws;
  };
  C.textGeometry = (layer, t, ctx) => {
    const pl = C.textPlacements(layer, t, ctx, 0.5);
    let polys = [];
    for (const it of pl.items) polys = polys.concat(it.c.polys.map(p => P.xformPoly(p, it.m)));
    return { polys, placements: pl };
  };
  // 统一：图层的二维几何（供挤出、网格、发射、碰撞）
  C.layerGeometry = (layer, t, ctx, tol = 0.5) => {
    if (layer.type === 'shape') return C.shapeGeometry(layer, t, ctx, tol).polys;
    if (layer.type === 'text') return C.textGeometry(layer, t, ctx).polys;
    if (layer.type === 'solid') return [{ c: true, p: [0, 0, layer.solid.width, 0, layer.solid.width, layer.solid.height, 0, layer.solid.height] }];
    return [];
  };
  C.layerDraws = (layer, t, ctx, tol) => {
    if (layer.type === 'shape') return C.shape(layer, t, ctx, tol);
    if (layer.type === 'text') return C.text(layer, t, ctx, tol);
    if (layer.type === 'solid') { const c = V(layer.solid.color, t, ctx, layer); return [{ kind: 'fill', polys: [{ c: true, p: [0, 0, layer.solid.width, 0, layer.solid.width, layer.solid.height, 0, layer.solid.height] }], color: c, opacity: 1, rule: 'nonzero' }]; }
    return [];
  };
})(typeof window !== 'undefined' ? window : globalThis);
