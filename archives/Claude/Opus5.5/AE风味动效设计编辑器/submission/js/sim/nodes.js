// 程序节点：类型化端口（标量/向量/颜色/几何/场），按依赖求值；空间场；节点组（公开参数、复用）
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, M4 = U.M4, P = AE.Path, Poly = AE.Poly, E = AE.Eval, Mdl = AE.Model, C = AE.Content, Mesh = AE.Mesh;
  const N = AE.Nodes = {};
  const F = AE.Fields = {};
  const S = (id, name, type) => ({ id, name, type });
  N.TYPES = { scalar: { name: '标量', color: '#9aa4b5' }, vector: { name: '向量', color: '#7f8cff' }, color: { name: '颜色', color: '#f2c14e' }, geometry: { name: '几何', color: '#3ecf8e' }, field: { name: '场', color: '#ff6b9a' } };
  const num = Mdl.num, v3 = Mdl.v3, col = Mdl.col;

  // ---------- 场对象 ----------
  // {s(p)→标量, v(p)→向量, vis:[{c,r,kind}]}
  const fall = (d, r, k) => { const x = U.clamp(1 - d / Math.max(1e-3, r), 0, 1); return Math.pow(x * x * (3 - 2 * x), Math.max(0.05, k)); };
  F.dist = (c, r, k, str) => ({ s: p => fall(U.dist(p, c), r, k) * str, v: p => { const d = U.sub(p, c), l = U.len(d) || 1; const f = fall(l, r, k) * str; return [d[0] / l * f, d[1] / l * f, d[2] / l * f]; }, vis: [{ c, r, kind: 'dist', str }] });
  F.noise = (sc, sp, str, t, seed) => ({ s: p => U.fbm3(p[0] / sc + seed, p[1] / sc, p[2] / sc + t * sp, 2) * str, v: p => U.curl3(p[0] / sc + seed, p[1] / sc, p[2] / sc, t * sp).map(x => x * str * 0.35), vis: [] });
  F.vortex = (c, ax, r, k, str) => { const a = U.norm(ax); return { s: p => fall(U.dist(p, c), r, k) * str, v: p => { const d = U.sub(p, c), f = fall(U.len(d), r, k) * str; const cr = U.cross(a, d), l = U.len(cr) || 1; return [cr[0] / l * f, cr[1] / l * f, cr[2] / l * f]; }, vis: [{ c, r, kind: 'vortex', ax: a, str }] }; };
  F.mix = (A, B, mode, k) => {
    if (!A) return B; if (!B) return A;
    const op = mode === 'mul' ? (a, b) => a * b : mode === 'max' ? Math.max : mode === 'min' ? Math.min : mode === 'sub' ? (a, b) => a - b : mode === 'lerp' ? (a, b) => a + (b - a) * k : (a, b) => a + b;
    return { s: p => op(A.s(p), B.s(p)), v: p => { const a = A.v(p), b = B.v(p); return [op(a[0], b[0]), op(a[1], b[1]), op(a[2], b[2])]; }, vis: A.vis.concat(B.vis) };
  };
  F.zero = { s: () => 0, v: () => [0, 0, 0], vis: [] };
  F.named = (comp, name, t, ctx) => { const f = N.output(comp, name, t, ctx); return f && f.s ? f : null; };
  F.sampleNamed = (comp, name, p, t, ctx) => { const f = F.named(comp, name, t, ctx); return f ? f.s(p) : 0; };
  F.sampleNamedVec = (comp, name, p, t, ctx) => { const f = F.named(comp, name, t, ctx); return f ? f.v(p) : [0, 0, 0]; };

  // ---------- 几何辅助 ----------
  const geo = (o) => Object.assign({ paths: null, mesh: null, points: null }, o);
  const xformGeo = (g, m) => {
    if (!g) return g;
    const out = geo({});
    if (g.paths) out.paths = g.paths.map(pl => { const q = []; for (let k = 0; k < pl.p.length; k += 2) { const r = M4.apply(m, [pl.p[k], pl.p[k + 1], 0]); q.push(r[0], r[1]); } return { c: pl.c, p: q }; });
    if (g.mesh) { const mm = Mesh.merge([{ mesh: g.mesh, m }]); out.mesh = mm; }
    if (g.points) { const n = g.points.n, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const r = M4.apply(m, [g.points.pos[3 * i], g.points.pos[3 * i + 1], g.points.pos[3 * i + 2]]); pos.set(r, 3 * i); } out.points = Object.assign({}, g.points, { pos }); }
    return out;
  };
  N.xformGeo = xformGeo;
  const mkPoints = (arr, attrs) => { const n = arr.length / 3; return { pos: new Float32Array(arr), n, id: attrs && attrs.id || Float32Array.from({ length: n }, (_, i) => i), idx: Float32Array.from({ length: n }, (_, i) => i), age: attrs && attrs.age, life: attrs && attrs.life, rot: attrs && attrs.rot, scale: attrs && attrs.scale, col: attrs && attrs.col }; };

  // ---------- 节点定义 ----------
  N.DEFS = {
    pathIn: { name: '路径输入', cat: '输入', out: [S('geo', '几何', 'geometry')], params: () => ({ layer: null, world: true }),
      eval: (n, I, V, ctx, t) => { const l = n.params.layer && E.layer(ctx.comp, n.params.layer); if (!l) return { geo: null }; const g = C.shapeGeometry(l, t, ctx, 0.6); const W = E.world(l, t, ctx); return { geo: xformGeo(geo({ paths: g.paths.map(p => ({ c: p.c, p: p.p.slice() })) }), n.params.world ? W : M4.ident()) }; } },
    textIn: { name: '文字输入', cat: '输入', out: [S('geo', '轮廓', 'geometry'), S('chars', '字符点', 'geometry')], params: () => ({ layer: null }),
      eval: (n, I, V, ctx, t) => {
        const l = n.params.layer && E.layer(ctx.comp, n.params.layer); if (!l || l.type !== 'text') return { geo: null, chars: null };
        const tg = C.textGeometry(l, t, ctx), W = E.world(l, t, ctx);
        const cp = []; tg.placements.items.forEach(it => cp.push(it.pos3[0], it.pos3[1], it.pos3[2]));
        const pts = mkPoints(cp, { id: Float32Array.from(tg.placements.items.map(it => it.c.idx)) });
        return { geo: xformGeo(geo({ paths: tg.polys }), W), chars: xformGeo(geo({ points: pts }), W) };
      } },
    time: { name: '时间', cat: '输入', out: [S('t', '秒', 'scalar')], params: () => ({ speed: num(1) }), eval: (n, I, V, ctx, t) => ({ t: t * V('speed') }) },
    value: { name: '数值', cat: '输入', out: [S('v', '值', 'scalar')], params: () => ({ value: num(1) }), eval: (n, I, V) => ({ v: V('value') }) },
    vector: { name: '向量', cat: '输入', out: [S('v', '向量', 'vector')], params: () => ({ value: v3([0, 0, 0]) }), eval: (n, I, V) => ({ v: V('value') }) },
    color: { name: '颜色', cat: '输入', out: [S('c', '颜色', 'color')], params: () => ({ color: col([1, 0.6, 0.2, 1]) }), eval: (n, I, V) => ({ c: V('color') }) },
    layerPos: { name: '图层位置', cat: '输入', out: [S('p', '世界位置', 'vector')], params: () => ({ layer: null }),
      eval: (n, I, V, ctx, t) => { const l = n.params.layer && E.layer(ctx.comp, n.params.layer); if (!l) return { p: [0, 0, 0] }; const W = E.world(l, t, ctx); return { p: [W[12], W[13], W[14]] }; } },
    particlesIn: { name: '粒子点', cat: '输入', out: [S('pts', '粒子', 'geometry')], params: () => ({ layer: null, every: num(1) }),
      eval: (n, I, V, ctx, t) => {
        const l = n.params.layer && E.layer(ctx.comp, n.params.layer); if (!l || !AE.Particles) return { pts: null };
        const st = AE.Particles.state(l, t, ctx); if (!st) return { pts: null };
        const ev = Math.max(1, Math.round(V('every'))), keep = [];
        for (let i = 0; i < st.count; i++) if (Math.round(st.ids[i]) % ev === 0) keep.push(i);
        const m = keep.length, pos = new Float32Array(m * 3), id = new Float32Array(m), age = new Float32Array(m), life = new Float32Array(m), sc = new Float32Array(m), rot = new Float32Array(m);
        keep.forEach((i, j) => { pos[3 * j] = st.pos[3 * i]; pos[3 * j + 1] = st.pos[3 * i + 1]; pos[3 * j + 2] = st.pos[3 * i + 2]; id[j] = st.ids[i]; age[j] = st.ages[i]; life[j] = st.lifes[i]; sc[j] = Math.sin(Math.PI * U.clamp(st.ages[i] / Math.max(1e-3, st.lifes[i]), 0, 1)); rot[j] = st.rot[i] / U.deg; });
        return { pts: geo({ points: { pos, n: m, id, idx: Float32Array.from({ length: m }, (_, i) => i), age, life, scale: sc, rot } }) };
      } },
    gridPoints: { name: '网格分布', cat: '分布', out: [S('pts', '点', 'geometry')], params: () => ({ cols: num(6), rows: num(4), spacing: Mdl.v2([120, 120]), center: v3([960, 540, 0]) }),
      eval: (n, I, V) => { const c = Math.max(1, Math.round(V('cols'))), r = Math.max(1, Math.round(V('rows'))), sp = V('spacing'), ct = V('center'); const a = []; for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) a.push(ct[0] + (i - (c - 1) / 2) * sp[0], ct[1] + (j - (r - 1) / 2) * sp[1], ct[2]); return { pts: geo({ points: mkPoints(a) }) }; } },
    circlePoints: { name: '圆周分布', cat: '分布', out: [S('pts', '点', 'geometry')], params: () => ({ count: num(12), radius: num(300), center: v3([960, 540, 0]), phase: num(0), tilt: num(0) }),
      eval: (n, I, V) => { const c = Math.max(1, Math.round(V('count'))), r = V('radius'), ct = V('center'), ph = V('phase') * U.deg, tl = V('tilt') * U.deg; const a = [], rot = []; for (let i = 0; i < c; i++) { const ang = i / c * Math.PI * 2 + ph; a.push(ct[0] + Math.cos(ang) * r, ct[1] + Math.sin(ang) * r * Math.cos(tl), ct[2] + Math.sin(ang) * r * Math.sin(tl)); rot.push(ang / U.deg + 90); } return { pts: geo({ points: mkPoints(a, { rot: Float32Array.from(rot) }) }) }; } },
    pointsOnPath: { name: '沿路径分布', cat: '分布', in: [S('geo', '路径', 'geometry')], out: [S('pts', '点', 'geometry')], params: () => ({ count: num(16), offset: num(0) }),
      eval: (n, I, V) => {
        const g = I.geo; if (!g || !g.paths || !g.paths.length) return { pts: null };
        const pl = g.paths[0], cum = P.cumLen(pl), L = cum[cum.length - 1], c = Math.max(1, Math.round(V('count'))), off = V('offset') / 100;
        const a = [], rot = [];
        for (let i = 0; i < c; i++) { const s = ((i / (pl.c ? c : Math.max(1, c - 1)) + off) % 1 + 1) % 1 * L; const pt = P.pointAt(pl, cum, s); a.push(pt.x, pt.y, 0); rot.push(Math.atan2(pt.ty, pt.tx) / U.deg); }
        return { pts: geo({ points: mkPoints(a, { rot: Float32Array.from(rot) }) }) };
      } },
    instance: { name: '重复实例', cat: '分布', in: [S('geo', '几何', 'geometry'), S('pts', '点', 'geometry'), S('field', '场(缩放)', 'field')], out: [S('geo', '实例几何', 'geometry')], params: () => ({ align: true, scale: num(1), fieldScale: num(0.8) }),
      eval: (n, I, V) => {
        const g = I.geo, pts = I.pts && I.pts.points; if (!g || !pts) return { geo: null };
        const out = geo({ paths: [], points: null }); const meshes = [];
        let cx = 0, cy = 0, cz = 0; // 源几何中心
        if (g.paths && g.paths.length) { const b = P.bounds(g.paths); cx = (b[0] + b[2]) / 2; cy = (b[1] + b[3]) / 2; }
        else if (g.mesh) { const b = g.mesh.bb; cx = (b[0] + b[3]) / 2; cy = (b[1] + b[4]) / 2; cz = (b[2] + b[5]) / 2; }
        const sc0 = V('scale'), fs = V('fieldScale');
        for (let i = 0; i < pts.n; i++) {
          const px = pts.pos[3 * i], py = pts.pos[3 * i + 1], pz = pts.pos[3 * i + 2];
          let s = sc0 * (pts.scale ? pts.scale[i] : 1);
          if (I.field) s *= Math.max(0, 1 + I.field.s([px, py, pz]) * fs);
          if (s <= 1e-4) continue;
          let m = M4.trans(px, py, pz);
          if (n.params.align && pts.rot) m = M4.mul(m, M4.rotZ(pts.rot[i] * U.deg));
          m = M4.mul(m, M4.scale(s, s, s)); m = M4.mul(m, M4.trans(-cx, -cy, -cz));
          if (g.paths) for (const pl of g.paths) { const q = []; for (let k = 0; k < pl.p.length; k += 2) { const r = M4.apply(m, [pl.p[k], pl.p[k + 1], 0]); q.push(r[0], r[1]); } out.paths.push({ c: pl.c, p: q, inst: pts.id ? pts.id[i] : i }); }
          if (g.mesh) meshes.push({ mesh: g.mesh, m });
        }
        if (meshes.length) out.mesh = Mesh.merge(meshes);
        return { geo: out };
      } },
    transform: { name: '变换', cat: '变换', in: [S('geo', '几何', 'geometry')], out: [S('geo', '几何', 'geometry')], params: () => ({ translate: v3([0, 0, 0]), rotate: num(0), scale: num(100), pivot: v3([960, 540, 0]) }),
      eval: (n, I, V) => { if (!I.geo) return { geo: null }; const pv = V('pivot'), tr = V('translate'), s = V('scale') / 100; let m = M4.trans(pv[0] + tr[0], pv[1] + tr[1], pv[2] + tr[2]); m = M4.mul(m, M4.rotZ(V('rotate') * U.deg)); m = M4.mul(m, M4.scale(s, s, s)); m = M4.mul(m, M4.trans(-pv[0], -pv[1], -pv[2])); return { geo: xformGeo(I.geo, m) }; } },
    resample: { name: '重采样', cat: '处理', in: [S('geo', '几何', 'geometry')], out: [S('geo', '几何', 'geometry')], params: () => ({ spacing: num(10) }),
      eval: (n, I, V) => { if (!I.geo || !I.geo.paths) return { geo: I.geo }; const sp = Math.max(1, V('spacing')); return { geo: geo({ paths: I.geo.paths.map(p => P.resample(p, Math.max(4, Math.round(P.polyLength(p) / sp)))) }) }; } },
    boolean: { name: '布尔', cat: '处理', in: [S('a', 'A', 'geometry'), S('b', 'B', 'geometry')], out: [S('geo', '结果', 'geometry')], params: () => ({ op: 'union' }),
      eval: (n, I) => { const a = I.a && I.a.paths || [], b = I.b && I.b.paths || []; if (!a.length) return { geo: I.b }; if (!b.length) return { geo: I.a }; return { geo: geo({ paths: Poly.boolean(a.filter(p => p.c), b.filter(p => p.c), n.params.op) }) }; } },
    merge: { name: '合并', cat: '处理', in: [S('a', 'A', 'geometry'), S('b', 'B', 'geometry')], out: [S('geo', '几何', 'geometry')], params: () => ({}),
      eval: (n, I) => { const a = I.a, b = I.b; if (!a) return { geo: b }; if (!b) return { geo: a }; const out = geo({ paths: (a.paths || []).concat(b.paths || []) }); if (a.mesh && b.mesh) out.mesh = Mesh.merge([{ mesh: a.mesh, m: null }, { mesh: b.mesh, m: null }]); else out.mesh = a.mesh || b.mesh; return { geo: out }; } },
    extrude: { name: '挤出', cat: '处理', in: [S('geo', '轮廓', 'geometry')], out: [S('geo', '实体', 'geometry')], params: () => ({ depth: num(80), bevel: num(8), segs: num(3) }),
      eval: (n, I, V) => {
        if (!I.geo || !I.geo.paths) return { geo: null };
        const d = V('depth'), b = V('bevel'), s = Math.round(V('segs'));
        const key = AE.R3.hashPolys(I.geo.paths) + ':' + d + ':' + b + ':' + s;
        if (n._ex && n._ex.key === key) return { geo: geo({ mesh: n._ex.mesh, paths: I.geo.paths }) };
        const m = Mesh.extrude(I.geo.paths.filter(p => p.c), d, b, s); n._ex = { key, mesh: m };
        return { geo: geo({ mesh: m, paths: I.geo.paths }) };
      } },
    bend: { name: '弯曲', cat: '处理', in: [S('geo', '几何', 'geometry')], out: [S('geo', '几何', 'geometry')], params: () => ({ angle: num(60), range: num(600), center: num(960), axis: 'x' }),
      eval: (n, I, V) => deformNode(I.geo, Mesh.bendFn(V('angle'), n.params.axis, V('center'), Math.max(1, V('range')))) },
    twist: { name: '扭转', cat: '处理', in: [S('geo', '几何', 'geometry')], out: [S('geo', '几何', 'geometry')], params: () => ({ angle: num(90), range: num(400), center: num(540), axis: 'y' }),
      eval: (n, I, V) => { const ax = n.params.axis || 'y', c = V('center'); const base = Mesh.twistFn(V('angle'), ax, Math.max(1, V('range'))); const ai = ax === 'x' ? 0 : ax === 'z' ? 2 : 1; return deformNode(I.geo, p => { const q = p.slice(); q[ai] -= c; const r = base(q); r[ai] += c; return r; }); } },
    fieldDeform: { name: '场变形', cat: '处理', in: [S('geo', '几何', 'geometry'), S('field', '场', 'field')], out: [S('geo', '几何', 'geometry')], params: () => ({ amount: num(40), mode: 'vector', resample: num(6) }),
      eval: (n, I, V) => {
        const f = I.field, g = I.geo; if (!f || !g) return { geo: g };
        const a = V('amount'), mode = n.params.mode;
        const fn = p => { if (mode === 'vector') { const v = f.v(p); return [p[0] + v[0] * a, p[1] + v[1] * a, p[2] + v[2] * a]; } const s = f.s(p) * a; return [p[0], p[1] - s, p[2]]; };
        let src = g;
        if (g.paths && !g.mesh) { const sp = Math.max(1, V('resample')); src = geo({ paths: g.paths.map(p => P.resample(p, Math.max(8, Math.round(P.polyLength(p) / sp)))) }); }
        return deformNode(src, fn);
      } },
    attrExpr: { name: '逐元素表达式', cat: '处理', in: [S('geo', '几何', 'geometry')], out: [S('geo', '几何', 'geometry')], params: () => ({ expr: 'pos + [0, Math.sin(time*3 + idx*0.4)*20, 0]' }),
      eval: (n, I, V, ctx, t) => {
        const g = I.geo; if (!g) return { geo: null };
        const src = n.params.expr || 'pos';
        const run = (p, i, cnt, extra) => { const r = E.evalElementExpr(src, p, t, ctx, Object.assign({ pos: p, idx: i, count: cnt, id: i }, extra)); if (r.err) n._err = r.err; else n._err = null; return r.v; };
        const out = geo({});
        if (g.points) { const pts = g.points, pos = new Float32Array(pts.pos.length); for (let i = 0; i < pts.n; i++) { const r = run([pts.pos[3 * i], pts.pos[3 * i + 1], pts.pos[3 * i + 2]], i, pts.n, { id: pts.id ? pts.id[i] : i, age: pts.age ? pts.age[i] : 0, life: pts.life ? pts.life[i] : 1 }); pos[3 * i] = r[0]; pos[3 * i + 1] = r[1]; pos[3 * i + 2] = r[2] || 0; } out.points = Object.assign({}, pts, { pos }); }
        if (g.paths) { let vi = 0; const cnt = g.paths.reduce((a, p) => a + p.p.length / 2, 0); out.paths = g.paths.map(pl => { const q = pl.p.slice(); for (let k = 0; k < q.length; k += 2) { const r = run([q[k], q[k + 1], 0], vi++, cnt, {}); q[k] = r[0]; q[k + 1] = r[1]; } return { c: pl.c, p: q }; }); }
        if (g.mesh) { const m = Mesh.clone(g.mesh); const n3 = m.pos.length / 3; Mesh.deform(m, (p, i) => run(p, i, n3, {})); out.mesh = m; }
        return { geo: out };
      } },
    fieldDist: { name: '距离衰减场', cat: '场', in: [S('center', '中心', 'vector')], out: [S('field', '场', 'field')], params: () => ({ center: v3([960, 540, 0]), radius: num(400), falloff: num(1), strength: num(1) }),
      eval: (n, I, V) => ({ field: F.dist(I.center || V('center'), V('radius'), V('falloff'), V('strength')) }) },
    fieldNoise: { name: '噪声场', cat: '场', out: [S('field', '场', 'field')], params: () => ({ noiseScale: num(300), speed: num(0.3), strength: num(1), seed: num(0) }),
      eval: (n, I, V, ctx, t) => ({ field: F.noise(Math.max(1, V('noiseScale')), V('speed'), V('strength'), t, V('seed')) }) },
    fieldVortex: { name: '旋涡场', cat: '场', in: [S('center', '中心', 'vector')], out: [S('field', '场', 'field')], params: () => ({ center: v3([960, 540, 0]), axis: v3([0, 0, 1]), radius: num(500), falloff: num(0.6), strength: num(1) }),
      eval: (n, I, V) => ({ field: F.vortex(I.center || V('center'), V('axis'), V('radius'), V('falloff'), V('strength')) }) },
    fieldMix: { name: '混合场', cat: '场', in: [S('a', 'A', 'field'), S('b', 'B', 'field'), S('k', '系数', 'scalar')], out: [S('field', '场', 'field')], params: () => ({ mode: 'add', k: num(0.5) }),
      eval: (n, I, V) => ({ field: F.mix(I.a, I.b, n.params.mode, I.k !== undefined && I.k !== null ? I.k : V('k')) }) },
    fieldSample: { name: '场采样', cat: '场', in: [S('field', '场', 'field'), S('p', '位置', 'vector')], out: [S('v', '值', 'scalar'), S('vec', '向量', 'vector')], params: () => ({}),
      eval: (n, I) => { const f = I.field || F.zero, p = I.p || [0, 0, 0]; return { v: f.s(p), vec: f.v(p) }; } },
    math: { name: '数学', cat: '数学', in: [S('a', 'A', 'scalar'), S('b', 'B', 'scalar')], out: [S('v', '结果', 'scalar')], params: () => ({ op: 'add', a: num(0), b: num(1) }),
      eval: (n, I, V) => { const a = I.a !== undefined && I.a !== null ? I.a : V('a'), b = I.b !== undefined && I.b !== null ? I.b : V('b'); const o = n.params.op; return { v: o === 'mul' ? a * b : o === 'sub' ? a - b : o === 'div' ? a / (b || 1e-9) : o === 'sin' ? Math.sin(a) * b : o === 'max' ? Math.max(a, b) : o === 'min' ? Math.min(a, b) : o === 'pow' ? Math.pow(a, b) : a + b }; } },
    vecMath: { name: '向量运算', cat: '数学', in: [S('a', 'A', 'vector'), S('b', 'B', 'vector'), S('k', '标量', 'scalar')], out: [S('v', '结果', 'vector')], params: () => ({ op: 'add', b: v3([0, 0, 0]), k: num(1) }),
      eval: (n, I, V) => { const a = I.a || [0, 0, 0], b = I.b || V('b'), k = I.k !== undefined && I.k !== null ? I.k : V('k'); const o = n.params.op; return { v: o === 'scale' ? a.map(x => x * k) : o === 'sub' ? U.sub(a, b) : U.add(a, b).map(x => x * (o === 'add' ? 1 : 1)) }; } },
    mix: { name: '混合', cat: '数学', in: [S('a', 'A', 'color'), S('b', 'B', 'color'), S('t', '比例', 'scalar')], out: [S('c', '颜色', 'color')], params: () => ({ t: num(0.5) }),
      eval: (n, I, V) => ({ c: U.lerpV(I.a || [0, 0, 0, 1], I.b || [1, 1, 1, 1], I.t !== undefined && I.t !== null ? I.t : V('t')) }) },
    geoOut: { name: '几何输出', cat: '输出', in: [S('geo', '几何', 'geometry')], out: [], params: () => ({ name: '几何' }), out_: true, eval: (n, I) => ({ _out: I.geo }) },
    emitOut: { name: '发射器', cat: '输出', in: [S('geo', '发射源', 'geometry')], out: [], params: () => ({ name: '发射源' }), out_: true, eval: (n, I) => ({ _out: I.geo }) },
    colliderOut: { name: '碰撞体', cat: '输出', in: [S('geo', '碰撞几何', 'geometry')], out: [], params: () => ({ name: '碰撞体' }), out_: true, eval: (n, I) => ({ _out: I.geo }) },
    fieldOut: { name: '场输出', cat: '输出', in: [S('field', '场', 'field')], out: [], params: () => ({ name: '场' }), out_: true, eval: (n, I) => ({ _out: I.field }) },
    valueOut: { name: '数值输出', cat: '输出', in: [S('v', '值', 'scalar')], out: [], params: () => ({ name: '数值' }), out_: true, eval: (n, I) => ({ _out: I.v }) },
    group: { name: '节点组', cat: '组', dyn: true, params: () => ({ def: null }), eval: null },
    groupIn: { name: '组输入', cat: '组', dyn: true, params: () => ({}), eval: null },
    groupOut: { name: '组输出', cat: '组', dyn: true, params: () => ({}), eval: null },
  };
  function deformNode(g, fn) {
    if (!g) return { geo: null };
    const out = geo({});
    if (g.paths) out.paths = g.paths.map(pl => { const q = pl.p.slice(); for (let k = 0; k < q.length; k += 2) { const r = fn([q[k], q[k + 1], 0]); q[k] = r[0]; q[k + 1] = r[1]; } return { c: pl.c, p: q }; });
    if (g.mesh) { const m = Mesh.clone(g.mesh); m.rest = g.mesh.pos; m.restN = g.mesh.nrm; Mesh.deform(m, fn); out.mesh = m; }
    if (g.points) { const pos = new Float32Array(g.points.pos.length); for (let i = 0; i < g.points.n; i++) pos.set(fn([g.points.pos[3 * i], g.points.pos[3 * i + 1], g.points.pos[3 * i + 2]]), 3 * i); out.points = Object.assign({}, g.points, { pos }); }
    return { geo: out };
  }
  N.def = (type) => N.DEFS[type];
  // 端口（组节点动态）
  N.inputs = (node, proj) => {
    if (node.type === 'group') { const d = N.groupDef(proj || E.project, node.params.def); return d ? d.inputs.map(x => S(x.id, x.name, x.type)) : []; }
    if (node.type === 'groupOut') { return (node.ports || []).map(x => S(x.id, x.name, x.type)); }
    if (node.type === 'groupIn') return [];
    return N.DEFS[node.type].in || [];
  };
  N.outputs = (node, proj) => {
    if (node.type === 'group') { const d = N.groupDef(proj || E.project, node.params.def); return d ? d.outputs.map(x => S(x.id, x.name, x.type)) : []; }
    if (node.type === 'groupIn') return (node.ports || []).map(x => S(x.id, x.name, x.type));
    if (node.type === 'groupOut') return [];
    return N.DEFS[node.type].out || [];
  };
  N.create = (type, x, y) => {
    const d = N.DEFS[type];
    const n = { id: Mdl.newId('nd'), type, name: d.name, x: x || 0, y: y || 0, params: d.params() };
    return n;
  };
  N.groupDef = (proj, id) => (proj && proj.nodeGroups || []).find(g => g.id === id);

  // ---------- 求值 ----------
  const memo = new Map(); let memoKey = '';
  N.evalNode = (graph, node, t, ctx, stackDepth = 0, groupCtx = null) => {
    const key = E.rev + '|' + t + '|' + ctx.inst.key;
    if (key !== memoKey) { memo.clear(); memoKey = key; }
    const mk = (groupCtx ? groupCtx.key + '/' : '') + node.id;
    if (memo.has(mk)) { const v = memo.get(mk); if (v === 'pending') throw new Error('节点循环连接'); return v; }
    if (stackDepth > 64) throw new Error('节点嵌套过深');
    memo.set(mk, 'pending');
    const inputs = {};
    for (const s of N.inputs(node)) {
      const link = graph.links.find(l => l.to[0] === node.id && l.to[1] === s.id);
      if (!link) continue;
      const src = graph.nodes.find(n => n.id === link.from[0]); if (!src) continue;
      const r = N.evalNode(graph, src, t, ctx, stackDepth + 1, groupCtx);
      inputs[s.id] = r ? r[link.from[1]] : null;
    }
    const V = (k) => { const p = node.params[k]; return Mdl.isProp(p) ? E.prop(p, t, ctx, null) : p; };
    let res;
    try {
      if (node.type === 'group') res = evalGroup(node, inputs, t, ctx, stackDepth);
      else if (node.type === 'groupIn') res = groupCtx ? groupCtx.inputs : {};
      else res = N.DEFS[node.type].eval(node, inputs, V, ctx, t) || {};
      node._err = node._err && node.type === 'attrExpr' ? node._err : null;
    } catch (e) { node._err = e.message; res = {}; }
    memo.set(mk, res);
    node._last = summarize(res);
    return res;
  };
  function evalGroup(node, inputs, t, ctx, depth) {
    const d = N.groupDef(E.project, node.params.def); if (!d) return {};
    // 公开参数：实例值覆盖组内节点参数
    const saved = [];
    for (const ex of d.exposed || []) {
      const inner = d.graph.nodes.find(n => n.id === ex.node); const ov = node.params['x_' + ex.id];
      if (inner && ov && Mdl.isProp(ov)) { saved.push([inner, ex.param, inner.params[ex.param]]); inner.params[ex.param] = ov; }
    }
    try {
      const out = d.graph.nodes.find(n => n.type === 'groupOut'); if (!out) return {};
      const gctx = { key: node.id, inputs };
      const res = {};
      for (const s of out.ports || []) {
        const link = d.graph.links.find(l => l.to[0] === out.id && l.to[1] === s.id); if (!link) continue;
        const src = d.graph.nodes.find(n => n.id === link.from[0]); if (!src) continue;
        const r = N.evalNode(d.graph, src, t, ctx, depth + 1, gctx);
        res[s.id] = r ? r[link.from[1]] : null;
      }
      return res;
    } finally { for (const [n, k, v] of saved) n.params[k] = v; }
  }
  function summarize(res) {
    const parts = [];
    for (const k in res) {
      const v = res[k]; if (v === null || v === undefined) continue;
      if (typeof v === 'number') parts.push(U.fmt(v, 2));
      else if (Array.isArray(v)) parts.push('[' + v.slice(0, 3).map(x => U.fmt(x, 1)).join(',') + ']');
      else if (v.s && v.v) parts.push('场');
      else if (v.paths || v.mesh || v.points) { const a = []; if (v.paths) a.push(v.paths.length + ' 轮廓'); if (v.mesh) a.push((v.mesh.idx.length / 3 | 0) + ' 面'); if (v.points) a.push(v.points.n + ' 点'); parts.push(a.join(' / ')); }
    }
    return parts.join('  ');
  }
  // 按名称取输出
  N.output = (comp, name, t, ctx) => {
    if (!comp || !comp.graph) return null;
    const node = comp.graph.nodes.find(n => N.DEFS[n.type] && N.DEFS[n.type].out_ && n.params.name === name);
    if (!node) return null;
    try { const r = N.evalNode(comp.graph, node, t, ctx); return r ? r._out : null; } catch (e) { node._err = e.message; return null; }
  };
  N.outputNames = (comp, types) => comp.graph.nodes.filter(n => N.DEFS[n.type] && N.DEFS[n.type].out_ && (!types || types.includes(n.type))).map(n => n.params.name);
  N.canConnect = (graph, from, to) => {
    const a = graph.nodes.find(n => n.id === from[0]), b = graph.nodes.find(n => n.id === to[0]);
    if (!a || !b || a === b) return false;
    const o = N.outputs(a).find(s => s.id === from[1]), i = N.inputs(b).find(s => s.id === to[1]);
    if (!o || !i) return false;
    if (o.type !== i.type && !(o.type === 'scalar' && i.type === 'vector') && !(o.type === 'vector' && i.type === 'color')) return false;
    // 防止成环
    const reach = (id, seen = new Set()) => { if (id === a.id) return true; if (seen.has(id)) return false; seen.add(id); return graph.links.filter(l => l.from[0] === id).some(l => reach(l.to[0], seen)); };
    return !reach(b.id);
  };
  N.connect = (graph, from, to) => {
    graph.links = graph.links.filter(l => !(l.to[0] === to[0] && l.to[1] === to[1]));
    graph.links.push({ id: Mdl.newId('lk'), from, to });
  };
  // 封装为节点组：选中节点 → 组定义 + 组实例节点
  N.encapsulate = (proj, graph, ids, name) => {
    const sel = graph.nodes.filter(n => ids.includes(n.id)); if (!sel.length) return null;
    const inner = { nodes: sel.map(n => n), links: graph.links.filter(l => ids.includes(l.from[0]) && ids.includes(l.to[0])) };
    const inLinks = graph.links.filter(l => !ids.includes(l.from[0]) && ids.includes(l.to[0]));
    const outLinks = graph.links.filter(l => ids.includes(l.from[0]) && !ids.includes(l.to[0]));
    const gin = { id: Mdl.newId('nd'), type: 'groupIn', name: '组输入', x: Math.min(...sel.map(n => n.x)) - 220, y: sel[0].y, params: {}, ports: [] };
    const gout = { id: Mdl.newId('nd'), type: 'groupOut', name: '组输出', x: Math.max(...sel.map(n => n.x)) + 220, y: sel[0].y, params: {}, ports: [] };
    const def = { id: Mdl.newId('ng'), name: name || '节点组', inputs: [], outputs: [], exposed: [], graph: inner };
    const gnode = { id: Mdl.newId('nd'), type: 'group', name: def.name, x: sel.reduce((a, n) => a + n.x, 0) / sel.length, y: sel.reduce((a, n) => a + n.y, 0) / sel.length, params: { def: def.id } };
    const newLinks = graph.links.filter(l => !ids.includes(l.from[0]) && !ids.includes(l.to[0]));
    inLinks.forEach((l, i) => {
      const tn = sel.find(n => n.id === l.to[0]); const sock = N.inputs(tn).find(s => s.id === l.to[1]);
      const pid = 'i' + i; def.inputs.push({ id: pid, name: sock.name, type: sock.type }); gin.ports.push({ id: pid, name: sock.name, type: sock.type });
      inner.links.push({ id: Mdl.newId('lk'), from: [gin.id, pid], to: l.to });
      newLinks.push({ id: Mdl.newId('lk'), from: l.from, to: [gnode.id, pid] });
    });
    const outMap = new Map();
    outLinks.forEach((l) => {
      const k = l.from.join(':');
      if (!outMap.has(k)) { const sn = sel.find(n => n.id === l.from[0]); const sock = N.outputs(sn).find(s => s.id === l.from[1]); const pid = 'o' + outMap.size; outMap.set(k, pid); def.outputs.push({ id: pid, name: sock.name, type: sock.type }); gout.ports.push({ id: pid, name: sock.name, type: sock.type }); inner.links.push({ id: Mdl.newId('lk'), from: l.from, to: [gout.id, pid] }); }
      newLinks.push({ id: Mdl.newId('lk'), from: [gnode.id, outMap.get(k)], to: l.to });
    });
    inner.nodes.push(gin, gout);
    // 默认公开所有可动画数值参数
    for (const n of sel) for (const k in n.params) { const p = n.params[k]; if (Mdl.isProp(p) && (p.type === 'num' || p.type === 'vec3' || p.type === 'color')) { const id = Mdl.newId('ex'); def.exposed.push({ id, name: n.name + '·' + Mdl.label(k), node: n.id, param: k }); gnode.params['x_' + id] = U.clone(p); } }
    graph.nodes = graph.nodes.filter(n => !ids.includes(n.id)); graph.nodes.push(gnode); graph.links = newLinks;
    proj.nodeGroups = proj.nodeGroups || []; proj.nodeGroups.push(def);
    return gnode;
  };
  N.instantiateGroup = (proj, defId, x, y) => {
    const def = N.groupDef(proj, defId); if (!def) return null;
    const g = { id: Mdl.newId('nd'), type: 'group', name: def.name, x, y, params: { def: def.id } };
    for (const ex of def.exposed) { const inner = def.graph.nodes.find(n => n.id === ex.node); if (inner) g.params['x_' + ex.id] = U.clone(inner.params[ex.param]); }
    return g;
  };
  // 场可视化：收集当前合成的场节点影响范围
  N.fieldVis = (comp, t, ctx) => {
    const out = [];
    for (const n of comp.graph.nodes) {
      if (!['fieldDist', 'fieldVortex'].includes(n.type)) continue;
      try { const r = N.evalNode(comp.graph, n, t, ctx); if (r.field) for (const v of r.field.vis) out.push(Object.assign({ node: n }, v)); } catch (e) { }
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
