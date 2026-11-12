'use strict';
// ============ 程序节点：类型定义与按连线求值 ============
// 端口类型：num 标量 / vec 向量 / color 颜色 / geo 几何 / field 场
const PORT_TYPES = { num: { label: '标量', color: '#8fbf6a' }, vec: { label: '向量', color: '#a78bfa' }, color: { label: '颜色', color: '#f2c94c' }, geo: { label: '几何', color: '#4fd1e8' }, field: { label: '场', color: '#ff8a4c' } };

// 几何容器：{uid, mesh?, regions?, curves?, points?}
function GeoC(o) { return Object.assign({ uid: GEO_UID++ }, o); }

const Fields = {
  // 由场图层生成场对象（世界空间）
  fromLayer(comp, L, t) {
    if (!L || L.type !== 'field') return null;
    const F = L.field; const e = p => Anim.evalProp(p, comp, L, t);
    const M = Xform.layerMatrix(comp, L, t); const IM = M4.invert(M);
    const ctr = M4.pt(M, [0, 0, 0]);
    const sc = Math.cbrt(Math.abs(M[0] * (M[5] * M[10] - M[6] * M[9]) - M[4] * (M[1] * M[10] - M[2] * M[9]) + M[8] * (M[1] * M[6] - M[2] * M[5]))) || 1;
    const radius = Math.max(1e-3, e(F.radius) * sc), fall = U.clamp(e(F.falloff) / 100, 0, 1), str = e(F.strength) / 100;
    const nscale = Math.max(1, e(F.scale)), speed = e(F.speed); const dir = V3.norm(M4.dir(M, e(F.dir)));
    const kind = F.kind;
    const fallW = d => { const inner = radius * (1 - fall); if (d <= inner) return 1; if (d >= radius) return 0; const u = (d - inner) / (radius - inner || 1); return 1 - u * u * (3 - 2 * u); };
    let sample;
    if (kind === 'radial') sample = p => { const d = V3.sub(p, ctr); const l = V3.len(d); const w = fallW(l) * str; return { w, v: l > 1e-6 ? V3.mul(d, w / l) : [0, 0, 0] }; };
    else if (kind === 'vortex') sample = p => { const d = V3.sub(p, ctr); const ax = dir; const along = V3.mul(ax, V3.dot(d, ax)); const rad = V3.sub(d, along); const l = V3.len(rad); const w = fallW(V3.len(d)) * str; const tang = l > 1e-6 ? V3.norm(V3.cross(ax, rad)) : [0, 0, 0]; return { w, v: V3.mul(tang, w) }; };
    else if (kind === 'noise') sample = p => { const q = M4.pt(IM, p); const s = 1 / nscale, tt = t * speed; const nx = Noise.n3(q[0] * s + 11.3, q[1] * s, q[2] * s + tt), ny = Noise.n3(q[0] * s, q[1] * s + 37.1, q[2] * s - tt), nz = Noise.n3(q[0] * s - 5.7, q[1] * s + 3.3, q[2] * s + tt * 0.7); const fw = radius > 0 && F.limit ? fallW(V3.dist(p, ctr)) : 1; const w = (nx * 0.5 + 0.5) * str * fw; return { w, v: V3.mul([nx, ny, nz], str * 1.6 * fw) }; };
    else sample = p => { const w = fallW(Math.abs(V3.dot(V3.sub(p, ctr), dir))) * str; return { w, v: V3.mul(dir, w) }; };
    return { sig: 'F' + L.id + ':' + [kind, ...ctr.map(x => x.toFixed(2)), radius.toFixed(2), fall, str.toFixed(4), nscale, kind === 'noise' ? (t * speed).toFixed(4) : 0, ...dir.map(x => x.toFixed(3)), F.limit ? 1 : 0].join(','), sample, layers: [L.id], kind, ctr, radius };
  },
  mix(a, b, mode) {
    if (!a) return b; if (!b) return a;
    const fn = { add: (x, y) => x + y, sub: (x, y) => x - y, mul: (x, y) => x * y, max: Math.max, min: Math.min }[mode] || ((x, y) => x + y);
    return { sig: `(${a.sig}${mode}${b.sig})`, layers: [...a.layers, ...b.layers], kind: 'mix', sample: p => { const A = a.sample(p), B = b.sample(p); let v; if (mode === 'mul') v = V3.mul(A.v, B.w); else if (mode === 'max') v = A.w >= B.w ? A.v : B.v; else if (mode === 'min') v = A.w <= B.w ? A.v : B.v; else if (mode === 'sub') v = V3.sub(A.v, B.v); else v = V3.add(A.v, B.v); return { w: fn(A.w, B.w), v }; } };
  },
};

const NodeTypes = {
  // ---- 输入 ----
  textOutline: { label: '文字轮廓', cat: '输入', desc: '读取文字图层的字形轮廓（含孔洞）作为二维区域几何。', out: [{ n: 'geo', t: 'geo', label: '轮廓' }],
    params: { layer: { t: 'layer', filter: 'text', label: '文字图层' }, center: { t: 'bool', def: true, label: '居中' }, anim: { t: 'bool', def: false, label: '含文字动画' } },
    eval(c, I, P) {
      const L = Model.findLayer(c.comp, P.layer); if (!L || L.type !== 'text') return { geo: null };
      const sig = 'to' + JSON.stringify([Anim.evalProp(L.text.source, c.comp, L, c.t), L.text.font, Anim.evalProp(L.text.size, c.comp, L, c.t), Anim.evalProp(L.text.leading, c.comp, L, c.t), Anim.evalProp(L.text.tracking, c.comp, L, c.t), L.text.align, P.center, P.anim ? c.t : 0, P.anim ? Anim.version : 0]);
      return c.cached(sig, () => {
        let polys = TextL.polys(c.comp, L, c.t, { noAnim: !P.anim });
        if (P.center && polys.length) { const bb = Geo2D.bbox(polys); const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2; polys = polys.map(p => p.map(q => [q[0] - cx, q[1] - cy])); }
        const regions = Geo2D.regions(polys);
        return { geo: GeoC({ regions, curves: polys.map(p => ({ pts: p.map(q => [q[0], q[1], 0]), closed: true })) }) };
      });
    } },
  textStrokes: { label: '文字笔画', cat: '输入', desc: '读取内置字库的笔画中线（按笔顺）作为曲线几何。', out: [{ n: 'geo', t: 'geo', label: '笔画曲线' }],
    params: { layer: { t: 'layer', filter: 'text', label: '文字图层' }, center: { t: 'bool', def: true, label: '居中' } },
    eval(c, I, P) {
      const L = Model.findLayer(c.comp, P.layer); if (!L || L.type !== 'text') return { geo: null };
      const lines = TextL.strokeLines(c.comp, L, c.t); let off = [0, 0];
      if (P.center) { const all = TextL.polys(c.comp, L, c.t, { noAnim: true }); if (all.length) { const bb = Geo2D.bbox(all); off = [-(bb[0] + bb[2]) / 2, -(bb[1] + bb[3]) / 2]; } }
      return { geo: GeoC({ curves: lines.map(l => ({ pts: l.pts.map(q => [q[0] + off[0], q[1] + off[1], 0]), closed: false })) }) };
    } },
  shapePath: { label: '形状路径', cat: '输入', desc: '读取形状图层的全部路径（经修剪、重复器、合并后的结果）。', out: [{ n: 'geo', t: 'geo', label: '路径' }],
    params: { layer: { t: 'layer', filter: 'shape', label: '形状图层' }, center: { t: 'bool', def: false, label: '居中' } },
    eval(c, I, P) {
      const L = Model.findLayer(c.comp, P.layer); if (!L || L.type !== 'shape') return { geo: null };
      let polys = Shapes.allPolys(c.comp, L, c.t);
      if (P.center && polys.length) { const bb = Geo2D.bbox(polys); const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2; polys = polys.map(p => ({ pts: p.pts.map(q => [q[0] - cx, q[1] - cy]), closed: p.closed })); }
      const sig = 'sp' + U.hash(JSON.stringify(polys.map(p => p.pts.length)) + JSON.stringify(polys.slice(0, 3)));
      return c.cached(sig + polys.length + JSON.stringify(polys).length, () => ({ geo: GeoC({ regions: Geo2D.regions(polys.filter(p => p.closed && p.pts.length > 2).map(p => p.pts)), curves: polys.map(p => ({ pts: p.pts.map(q => [q[0], q[1], 0]), closed: p.closed })) }) }));
    } },
  primitive: { label: '基础形体', cat: '输入', desc: '生成立方体、球、平面、圆柱或圆环网格。', out: [{ n: 'geo', t: 'geo', label: '网格' }],
    in: [{ n: 'size', t: 'vec', label: '尺寸', p: 'size' }],
    params: { kind: { t: 'enum', opts: { box: '立方体', sphere: '球体', plane: '平面', ground: '地面', cylinder: '圆柱', torus: '圆环' }, def: 'box', label: '类型' }, size: { t: 'vec', def: [200, 200, 200], label: '尺寸', anim: true } },
    eval(c, I, P) { const s = I.size; return c.cached('pr' + P.kind + s.join(','), () => ({ geo: GeoC({ mesh: Scene.primitive(P.kind, s) }) })); } },
  number: { label: '数值', cat: '数学', desc: '输出一个可动画的标量。', in: [{ n: 'v', t: 'num', label: '值', p: 'v' }], out: [{ n: 'v', t: 'num', label: '值' }], params: { v: { t: 'num', def: 1, label: '值', anim: true } }, eval(c, I) { return { v: I.v }; } },
  vector: { label: '向量', cat: '数学', desc: '输出一个可动画的三维向量。', in: [{ n: 'v', t: 'vec', label: '值', p: 'v' }], out: [{ n: 'v', t: 'vec', label: '向量' }], params: { v: { t: 'vec', def: [0, 0, 0], label: '值', anim: true } }, eval(c, I) { return { v: I.v }; } },
  color: { label: '颜色', cat: '数学', desc: '输出颜色。', in: [{ n: 'v', t: 'color', label: '颜色', p: 'v' }], out: [{ n: 'v', t: 'color', label: '颜色' }], params: { v: { t: 'color', def: [1, 0.5, 0.2], label: '颜色', anim: true } }, eval(c, I) { return { v: I.v }; } },
  time: { label: '时间', cat: '数学', desc: '当前合成时间（秒）。', out: [{ n: 't', t: 'num', label: '秒' }], params: {}, eval(c) { return { t: c.t }; } },
  math: { label: '运算', cat: '数学', desc: '对两个标量做运算。', in: [{ n: 'a', t: 'num', label: 'A', p: 'a' }, { n: 'b', t: 'num', label: 'B', p: 'b' }], out: [{ n: 'r', t: 'num', label: '结果' }],
    params: { op: { t: 'enum', opts: { add: 'A+B', sub: 'A−B', mul: 'A×B', div: 'A÷B', max: '最大', min: '最小', sin: 'sin(A)·B' }, def: 'mul', label: '运算' }, a: { t: 'num', def: 1, label: 'A', anim: true }, b: { t: 'num', def: 1, label: 'B', anim: true } },
    eval(c, I, P) { const a = I.a, b = I.b; const r = { add: a + b, sub: a - b, mul: a * b, div: b ? a / b : 0, max: Math.max(a, b), min: Math.min(a, b), sin: Math.sin(a) * b }[P.op]; return { r }; } },
  // ---- 几何处理 ----
  extrude: { label: '挤出', cat: '几何', desc: '把闭合轮廓（含孔洞）挤出为带前后面、侧壁与圆角倒角的实体。', in: [{ n: 'geo', t: 'geo', label: '轮廓' }, { n: 'depth', t: 'num', label: '深度', p: 'depth' }, { n: 'bevel', t: 'num', label: '倒角', p: 'bevel' }], out: [{ n: 'geo', t: 'geo', label: '实体' }],
    params: { depth: { t: 'num', def: 120, label: '深度', anim: true, min: 0 }, bevel: { t: 'num', def: 10, label: '倒角', anim: true, min: 0 }, segs: { t: 'num', def: 3, label: '倒角段数', min: 1, max: 8 }, spacing: { t: 'num', def: 9, label: '网格间距', min: 2 } },
    eval(c, I, P) {
      const g = I.geo; if (!g || !g.regions) return { geo: null };
      const D = Math.max(0.5, I.depth), B = Math.max(0, I.bevel);
      return c.cached('ex' + g.uid + ':' + D.toFixed(2) + ':' + B.toFixed(2) + ':' + P.segs + ':' + P.spacing, () => ({ geo: GeoC({ mesh: Geo3D.extrude(g.regions, { depth: D, bevel: B, bevelSegs: Math.round(P.segs), spacing: Math.max(2, P.spacing) }), regions: g.regions }) }));
    } },
  mesh2d: { label: '三角网格化', cat: '几何', desc: '把轮廓区域剖分为带内部顶点的三角网格（凹部与孔洞有效）。', in: [{ n: 'geo', t: 'geo', label: '轮廓' }], out: [{ n: 'geo', t: 'geo', label: '网格' }],
    params: { spacing: { t: 'num', def: 16, label: '网格间距', min: 2 } },
    eval(c, I, P) {
      const g = I.geo; if (!g || !g.regions) return { geo: null };
      return c.cached('m2' + g.uid + ':' + P.spacing, () => {
        const ms = g.regions.map(r => { const m = Geo2D.mesh(r.outer, r.holes, Math.max(2, P.spacing)); const pos = [], nrm = []; for (const p of m.pts) { pos.push(p[0], p[1], 0); nrm.push(0, 0, -1); } return Geo3D.mesh(pos, nrm, m.tris); });
        return { geo: GeoC({ mesh: Geo3D.merge(ms), regions: g.regions }) };
      });
    } },
  pinWarp: { label: '图钉变形', cat: '几何', desc: '以位置/旋转/缩放图钉（可动画）对几何做无撕裂的刚性变形。', in: [{ n: 'geo', t: 'geo', label: '几何' }], out: [{ n: 'geo', t: 'geo', label: '变形后' }],
    params: { pins: { t: 'pins', def: [], label: '图钉' } },
    eval(c, I, P, node) {
      const g = I.geo; if (!g) return { geo: null };
      const pins = (node.pins || []).map(pn => { const o = Anim.evalProp(pn.off, c.comp, null, c.t); return { p: pn.rest, q: [pn.rest[0] + o[0], pn.rest[1] + o[1]], rot: Anim.evalProp(pn.rot, c.comp, null, c.t), scl: Anim.evalProp(pn.scl, c.comp, null, c.t) / 100 }; });
      if (!pins.length) return { geo: g };
      const f2 = Puppet.deformer(pins); const f3 = p => { const q = f2([p[0], p[1]]); return [q[0], q[1], p[2]]; };
      const sig = 'pw' + g.uid + JSON.stringify(pins);
      return c.cached(sig, () => ({ geo: Scene.deformGeo(g, f3) }));
    } },
  transform: { label: '变换', cat: '几何', desc: '平移、旋转（度）、缩放（%）几何。', in: [{ n: 'geo', t: 'geo', label: '几何' }, { n: 'tr', t: 'vec', label: '平移', p: 'tr' }, { n: 'rot', t: 'vec', label: '旋转', p: 'rot' }, { n: 'scl', t: 'vec', label: '缩放', p: 'scl' }], out: [{ n: 'geo', t: 'geo', label: '几何' }],
    params: { tr: { t: 'vec', def: [0, 0, 0], label: '平移', anim: true }, rot: { t: 'vec', def: [0, 0, 0], label: '旋转', anim: true }, scl: { t: 'vec', def: [100, 100, 100], label: '缩放', anim: true } },
    eval(c, I) {
      const g = I.geo; if (!g) return { geo: null };
      let M = M4.translate(...I.tr); M = M4.mul(M, M4.rotX(U.rad(I.rot[0]))); M = M4.mul(M, M4.rotY(U.rad(I.rot[1]))); M = M4.mul(M, M4.rotZ(U.rad(I.rot[2]))); M = M4.mul(M, M4.scale(I.scl[0] / 100, I.scl[1] / 100, I.scl[2] / 100));
      return c.cached('tf' + g.uid + JSON.stringify([I.tr, I.rot, I.scl]), () => ({ geo: Scene.deformGeo(g, p => M4.pt(M, p), true) }));
    } },
  bend: { label: '弯曲', cat: '变形', desc: '沿指定方向把几何弯成圆弧。', in: [{ n: 'geo', t: 'geo', label: '几何' }, { n: 'angle', t: 'num', label: '角度', p: 'angle' }], out: [{ n: 'geo', t: 'geo', label: '几何' }],
    params: { angle: { t: 'num', def: 30, label: '角度', anim: true }, length: { t: 'num', def: 600, label: '弯曲长度', min: 1 }, dir: { t: 'num', def: 0, label: '方向°' } },
    eval(c, I, P) { const g = I.geo; if (!g) return { geo: null }; return c.cached('bd' + g.uid + ':' + I.angle + ':' + P.length + ':' + P.dir, () => ({ geo: Scene.deformGeo(g, Geo3D.bendFn(I.angle, P.length, P.dir)) })); } },
  twist: { label: '扭转', cat: '变形', desc: '绕轴按位置线性扭转几何。', in: [{ n: 'geo', t: 'geo', label: '几何' }, { n: 'angle', t: 'num', label: '角度', p: 'angle' }], out: [{ n: 'geo', t: 'geo', label: '几何' }],
    params: { angle: { t: 'num', def: 45, label: '角度', anim: true }, length: { t: 'num', def: 600, label: '长度', min: 1 }, axis: { t: 'enum', opts: { y: 'Y 轴', x: 'X 轴', z: 'Z 轴' }, def: 'y', label: '轴' } },
    eval(c, I, P) { const g = I.geo; if (!g) return { geo: null }; return c.cached('tw' + g.uid + ':' + I.angle + ':' + P.length + P.axis, () => ({ geo: Scene.deformGeo(g, Geo3D.twistFn(I.angle, P.length, P.axis)) })); } },
  fieldDeform: { label: '场变形', cat: '变形', desc: '用空间场驱动顶点位移；法线随之重算。场以世界坐标求值（经参考图层变换）。', in: [{ n: 'geo', t: 'geo', label: '几何' }, { n: 'field', t: 'field', label: '场' }, { n: 'amount', t: 'num', label: '强度', p: 'amount' }, { n: 'axis', t: 'vec', label: '方向', p: 'axis' }], out: [{ n: 'geo', t: 'geo', label: '几何' }],
    params: { amount: { t: 'num', def: 50, label: '强度', anim: true }, mode: { t: 'enum', opts: { axis: '沿方向', normal: '沿法线', field: '沿场向量' }, def: 'axis', label: '位移方式' }, axis: { t: 'vec', def: [0, 0, 1], label: '方向', anim: true }, space: { t: 'layer', filter: 'any', label: '参考图层' } },
    eval(c, I, P) {
      const g = I.geo, F = I.field; if (!g) return { geo: null }; if (!F || !g.mesh) return { geo: g };
      const S = Model.findLayer(c.comp, P.space); const M = S ? Xform.layerMatrix(c.comp, S, c.t) : M4.ident(); const IM = M4.invert(M);
      const amt = I.amount, ax = V3.norm(I.axis);
      return c.cached('fd' + g.uid + F.sig + ':' + amt + P.mode + ax.join(',') + (S ? S.id + JSON.stringify(Array.from(M)) : ''), () => {
        const m = g.mesh; let f;
        if (P.mode === 'field') f = p => { const w = M4.pt(M, p); const s = F.sample(w); const v = M4.dir(IM, s.v); return [p[0] + v[0] * amt, p[1] + v[1] * amt, p[2] + v[2] * amt]; };
        else if (P.mode === 'normal') { // 法线位移：用原法线
          const pos = new Float32Array(m.pos.length); for (let i = 0; i < m.pos.length; i += 3) { const p = [m.pos[i], m.pos[i + 1], m.pos[i + 2]]; const s = F.sample(M4.pt(M, p)); for (let k = 0; k < 3; k++) pos[i + k] = p[k] + m.nrm[i + k] * s.w * amt; }
          const mm = Scene.recomputeNormals(Geo3D.mesh(pos, m.nrm, m.idx, m.col ? { col: m.col } : null)); return { geo: GeoC({ mesh: mm, regions: g.regions }) };
        } else f = p => { const s = F.sample(M4.pt(M, p)); const d = s.w * amt; return [p[0] + ax[0] * d, p[1] + ax[1] * d, p[2] + ax[2] * d]; };
        return { geo: Scene.deformGeo(g, f) };
      });
    } },
  heat: { label: '场着色', cat: '变形', desc: '按场强写入顶点发光权重（用于局部灼热），输出几何。', in: [{ n: 'geo', t: 'geo', label: '几何' }, { n: 'field', t: 'field', label: '场' }, { n: 'amount', t: 'num', label: '强度', p: 'amount' }], out: [{ n: 'geo', t: 'geo', label: '几何' }],
    params: { amount: { t: 'num', def: 1, label: '强度', anim: true }, base: { t: 'num', def: 1, label: '基础权重' }, space: { t: 'layer', filter: 'any', label: '参考图层' } },
    eval(c, I, P) {
      const g = I.geo, F = I.field; if (!g || !g.mesh) return { geo: g };
      const S = Model.findLayer(c.comp, P.space); const M = S ? Xform.layerMatrix(c.comp, S, c.t) : M4.ident();
      return c.cached('ht' + g.uid + (F ? F.sig : '') + I.amount + P.base, () => {
        const m = g.mesh; const n = m.pos.length / 3; const col = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) { const w = F ? F.sample(M4.pt(M, [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]])).w : 0; col[i * 4] = 1; col[i * 4 + 1] = 1; col[i * 4 + 2] = 1; col[i * 4 + 3] = P.base + Math.max(0, w) * I.amount; }
        return { geo: GeoC({ mesh: Geo3D.mesh(m.pos, m.nrm, m.idx, { col }), regions: g.regions }) };
      });
    } },
  merge: { label: '合并几何', cat: '几何', desc: '把两路几何合为一个。', in: [{ n: 'a', t: 'geo', label: 'A' }, { n: 'b', t: 'geo', label: 'B' }], out: [{ n: 'geo', t: 'geo', label: '几何' }], params: {},
    eval(c, I) { const a = I.a, b = I.b; if (!a) return { geo: b }; if (!b) return { geo: a }; return c.cached('mg' + a.uid + ':' + b.uid, () => ({ geo: GeoC({ mesh: Geo3D.merge([a.mesh, b.mesh]), regions: (a.regions || []).concat(b.regions || []), curves: (a.curves || []).concat(b.curves || []), points: a.points || b.points }) })); } },
  resample: { label: '重采样', cat: '几何', desc: '按等弧长重新分布曲线上的点。', in: [{ n: 'geo', t: 'geo', label: '曲线' }], out: [{ n: 'geo', t: 'geo', label: '曲线' }], params: { spacing: { t: 'num', def: 20, label: '间距', min: 1 } },
    eval(c, I, P) { const g = I.geo; if (!g || !g.curves) return { geo: g }; return c.cached('rs' + g.uid + P.spacing, () => ({ geo: GeoC({ curves: g.curves.map(cv => { const p2 = Geo2D.resampleSpacing(cv.pts.map(q => [q[0], q[1]]), cv.closed, P.spacing); return { pts: p2.map(q => [q[0], q[1], 0]), closed: cv.closed }; }), regions: g.regions }) })); } },
  scatter: { label: '表面散布', cat: '分布', desc: '在网格表面按面积（可乘场强）随机分布点，输出点几何（含法线）。', in: [{ n: 'geo', t: 'geo', label: '网格' }, { n: 'field', t: 'field', label: '密度场' }, { n: 'count', t: 'num', label: '数量', p: 'count' }], out: [{ n: 'geo', t: 'geo', label: '点' }],
    params: { count: { t: 'num', def: 60, label: '数量', anim: true, min: 0 }, seed: { t: 'num', def: 1, label: '种子' }, space: { t: 'layer', filter: 'any', label: '参考图层' } },
    eval(c, I, P) {
      const g = I.geo; if (!g || !g.mesh) return { geo: null }; const n = Math.max(0, Math.round(I.count));
      const S = Model.findLayer(c.comp, P.space); const M = S ? Xform.layerMatrix(c.comp, S, c.t) : M4.ident(); const F = I.field;
      return c.cached('sc' + g.uid + n + P.seed + (F ? F.sig : ''), () => {
        const C = Geo3D.cdf(g.mesh, F ? (p) => F.sample(M4.pt(M, p)).w : null); const pos = [], nrm = [];
        for (let i = 0; i < n; i++) { const s = Geo3D.sample(g.mesh, C, U.rand01(P.seed, i, 1), U.rand01(P.seed, i, 2), U.rand01(P.seed, i, 3)); if (s) { pos.push(s.p); nrm.push(s.n); } }
        return { geo: GeoC({ points: { pos, nrm } }) };
      });
    } },
  copyToPoints: { label: '复制到点', cat: '分布', desc: '把实例几何复制到每个点上（沿法线朝向）。', in: [{ n: 'inst', t: 'geo', label: '实例' }, { n: 'pts', t: 'geo', label: '点' }, { n: 'scale', t: 'num', label: '缩放', p: 'scale' }], out: [{ n: 'geo', t: 'geo', label: '网格' }],
    params: { scale: { t: 'num', def: 100, label: '缩放 %', anim: true }, align: { t: 'bool', def: true, label: '对齐法线' } },
    eval(c, I, P) {
      const a = I.inst, b = I.pts; if (!a || !a.mesh || !b) return { geo: null };
      const pts = b.points ? b.points : b.mesh ? { pos: Array.from({ length: b.mesh.pos.length / 3 }, (_, i) => [b.mesh.pos[i * 3], b.mesh.pos[i * 3 + 1], b.mesh.pos[i * 3 + 2]]), nrm: Array.from({ length: b.mesh.pos.length / 3 }, (_, i) => [b.mesh.nrm[i * 3], b.mesh.nrm[i * 3 + 1], b.mesh.nrm[i * 3 + 2]]) } : null;
      if (!pts) return { geo: null };
      return c.cached('cp' + a.uid + ':' + b.uid + I.scale + P.align, () => {
        const ms = pts.pos.slice(0, 4000).map((p, i) => { let M = M4.translate(p[0], p[1], p[2]); if (P.align && pts.nrm[i]) { const n = pts.nrm[i]; const z = [0, 0, -1]; const ax = V3.cross(z, n); const s = V3.len(ax), cth = V3.dot(z, n); if (s > 1e-5) { const ang = Math.atan2(s, cth); const k = V3.norm(ax); M = M4.mul(M, Scene.axisAngle(k, ang)); } } M = M4.mul(M, M4.scale(I.scale / 100, I.scale / 100, I.scale / 100)); return Geo3D.transform(a.mesh, M); });
        return { geo: GeoC({ mesh: Geo3D.merge(ms) }) };
      });
    } },
  // ---- 场 ----
  fieldLayer: { label: '场图层', cat: '场', desc: '引用一个场图层（可移动、可动画），输出场。', out: [{ n: 'field', t: 'field', label: '场' }], params: { layer: { t: 'layer', filter: 'field', label: '场图层' } },
    eval(c, I, P) { return { field: Fields.fromLayer(c.comp, Model.findLayer(c.comp, P.layer), c.t) }; } },
  fieldMix: { label: '场混合', cat: '场', desc: '按相加、相减、相乘、最大、最小混合两个场。', in: [{ n: 'a', t: 'field', label: 'A' }, { n: 'b', t: 'field', label: 'B' }], out: [{ n: 'field', t: 'field', label: '场' }],
    params: { mode: { t: 'enum', opts: { add: '相加', sub: '相减', mul: '相乘', max: '最大', min: '最小' }, def: 'add', label: '混合' } },
    eval(c, I, P) { return { field: Fields.mix(I.a, I.b, P.mode) }; } },
  // ---- 使用者（输出） ----
  display: { label: '显示', cat: '输出', consumer: true, desc: '把几何显示到三维几何图层（图层的变换与材质作用于它）。', in: [{ n: 'geo', t: 'geo', label: '几何' }], params: { layer: { t: 'layer', filter: 'geo', label: '三维几何图层' } }, eval() { return {}; } },
  emitter: { label: '粒子发射源', cat: '输出', consumer: true, desc: '把几何（当前变形后的结果）作为粒子图层的发射表面；可用场限定发射区域。', in: [{ n: 'geo', t: 'geo', label: '几何' }, { n: 'field', t: 'field', label: '权重场' }], params: { layer: { t: 'layer', filter: 'particles', label: '粒子图层' }, em: { t: 'num', def: 0, label: '发射器序号' }, space: { t: 'layer', filter: 'any', label: '参考图层' } }, eval() { return {}; } },
  collider: { label: '碰撞体', cat: '输出', consumer: true, desc: '让几何参与粒子碰撞（使用当前表面、法线与运动）。', in: [{ n: 'geo', t: 'geo', label: '几何' }], params: { layer: { t: 'layer', filter: 'particles', label: '粒子图层（空=全部）' }, space: { t: 'layer', filter: 'any', label: '参考图层' } }, eval() { return {}; } },
  particleField: { label: '场力', cat: '输出', consumer: true, desc: '把场作为力作用于粒子运动。', in: [{ n: 'field', t: 'field', label: '场' }, { n: 'strength', t: 'num', label: '强度', p: 'strength' }], params: { layer: { t: 'layer', filter: 'particles', label: '粒子图层' }, strength: { t: 'num', def: 300, label: '强度', anim: true } }, eval() { return {}; } },
  // ---- 组 ----
  group: { label: '节点组', cat: '组', desc: '封装的节点组，双击进入。', params: {}, eval(c, I, P, node) { return NodeEval.evalGroup(c, node, I); } },
  groupIn: { label: '组输入', cat: '组', hidden: true, params: {}, eval(c, I, P, node) { return c.groupInputs || {}; } },
  groupOut: { label: '组输出', cat: '组', hidden: true, consumer: true, params: {}, eval() { return {}; } },
};

const NodeEval = {
  memo: new Map(), memoVer: -1,
  ports(node) {
    const T = NodeTypes[node.type];
    if (node.type === 'group') return { in: node.ports.in, out: node.ports.out };
    if (node.type === 'groupIn') return { in: [], out: node.ports || [] };
    if (node.type === 'groupOut') return { in: node.ports || [], out: [] };
    return { in: T.in || [], out: T.out || [] };
  },
  newNode(type, x = 0, y = 0) {
    const T = NodeTypes[type]; const n = { id: Model.nid(), type, x, y, p: {} };
    for (const [k, d] of Object.entries(T.params || {})) { if (d.t === 'pins') { n.pins = []; continue; } n.p[k] = d.anim ? Model.P(d.def) : U.clone(d.def ?? (d.t === 'layer' ? null : 0)); }
    return n;
  },
  // 参数值（可动画参数为 P）
  param(c, node, k) { const v = node.p[k]; return Model.isProp(v) ? Anim.evalProp(v, c.comp, null, c.t) : v; },
  // 求值：返回节点 node 的所有输出
  evalNode(c, graph, node) {
    if (this.memoVer !== Anim.version) { this.memo.clear(); this.memoVer = Anim.version; }
    const key = node.id + '@' + c.t + (c.gkey || '');
    if (this.memo.has(key)) return this.memo.get(key);
    if (c.stack.includes(node.id)) throw new Error('节点存在环路');
    c.stack.push(node.id);
    const T = NodeTypes[node.type]; const I = {}; const P = {};
    for (const k in node.p) P[k] = this.param(c, node, k);
    const ports = this.ports(node);
    for (const ip of ports.in) {
      const lk = graph.links.find(l => l.to === node.id && l.ti === ip.n);
      if (lk) { const src = graph.nodes.find(n => n.id === lk.from); I[ip.n] = src ? this.evalNode(c, graph, src)[lk.fo] : undefined; if (I[ip.n] === undefined && ip.p) I[ip.n] = P[ip.p]; }
      else I[ip.n] = ip.p ? P[ip.p] : undefined;
      if (ip.t === 'num' && typeof I[ip.n] !== 'number') I[ip.n] = U.isArr(I[ip.n]) ? I[ip.n][0] : (I[ip.n] ?? 0);
      if (ip.t === 'vec' && typeof I[ip.n] === 'number') I[ip.n] = [I[ip.n], I[ip.n], I[ip.n]];
    }
    let out;
    const cc = Object.assign({}, c, { cached: (sig, fn) => { let e = this.nodeCache.get(node); if (!e) this.nodeCache.set(node, e = []); const hit = e.find(x => x.sig === sig); if (hit) return hit.out; const o = fn(); e.unshift({ sig, out: o }); if (e.length > 6) e.pop(); return o; } });
    try { out = T.eval(cc, I, P, node) || {}; node._err = null; }
    catch (err) { node._err = err.message; out = {}; console.warn('节点错误', T.label, err); }
    c.stack.pop();
    node._last = out; node._lastT = c.t;
    if (this.memo.size > 4000) this.memo.clear();
    this.memo.set(key, out);
    return out;
  },
  nodeCache: new WeakMap(),
  ctx(comp, t) { return { comp, t, stack: [] }; },
  // 求某个使用者节点的输入值
  input(c, graph, node, port) {
    const lk = graph.links.find(l => l.to === node.id && l.ti === port); if (!lk) { const ip = this.ports(node).in.find(p => p.n === port); return ip && ip.p ? this.param(c, node, ip.p) : null; }
    const src = graph.nodes.find(n => n.id === lk.from); if (!src) return null;
    return this.evalNode(c, graph, src)[lk.fo];
  },
  evalGroup(c, node, I) {
    const sub = node.sub; const out = {};
    const gc = Object.assign({}, c, { groupInputs: I, gkey: (c.gkey || '') + '/' + node.id, stack: [] });
    const go = sub.nodes.find(n => n.type === 'groupOut'); if (!go) return out;
    for (const p of node.ports.out) out[p.n] = this.input(gc, sub, go, p.n);
    return out;
  },
  // 遍历所有使用者（含组内）
  consumers(comp, type) {
    const res = [];
    const walk = (g, path) => { for (const n of g.nodes) { if (n.type === type) res.push({ node: n, graph: g, path }); if (n.type === 'group' && n.sub) walk(n.sub, path.concat(n)); } };
    walk(comp.graph, []); return res;
  },
  // 在使用者所在的图中求输入（组内使用者需要组输入上下文——简化：仅支持顶层或无组输入依赖）
  consumerInput(comp, t, cons, port) {
    const c = this.ctx(comp, t);
    if (cons.path.length) {
      // 自顶向下构造组输入
      let g = comp.graph; let gc = c;
      for (const grp of cons.path) { const I = {}; for (const ip of grp.ports.in) I[ip.n] = this.input(gc, g, grp, ip.n); gc = Object.assign({}, gc, { groupInputs: I, gkey: (gc.gkey || '') + '/' + grp.id, stack: [] }); g = grp.sub; }
      return this.input(gc, cons.graph, cons.node, port);
    }
    return this.input(c, comp.graph, cons.node, port);
  },
  describe(v, t) {
    if (v === undefined || v === null) return '—';
    if (typeof v === 'number') return U.fmt(v, 2);
    if (U.isArr(v)) return '[' + v.map(x => U.fmt(x, 1)).join(', ') + ']';
    if (v.sample) return '场 · ' + ({ radial: '距离衰减', noise: '噪声', vortex: '旋涡', linear: '线性', mix: '混合' }[v.kind] || v.kind);
    if (v.uid) { const s = []; if (v.mesh) s.push(`${Geo3D.count(v.mesh)} 顶点 / ${v.mesh.idx.length / 3} 三角形`); if (v.regions) s.push(`${v.regions.length} 区域 · ${v.regions.reduce((a, r) => a + r.holes.length, 0)} 孔`); if (v.curves && !v.mesh) s.push(`${v.curves.length} 曲线`); if (v.points) s.push(`${v.points.pos.length} 点`); return s.join(' · ') || '空几何'; }
    return String(v);
  },
};

// ============ 场景：图层网格 ============
const Scene = {
  primCache: new Map(),
  primitive(kind, s) {
    const key = kind + s.map(x => x.toFixed(1)).join(',');
    let m = this.primCache.get(key); if (m) return m;
    switch (kind) {
      case 'sphere': m = Geo3D.sphere(s[0] / 2, 40); break;
      case 'plane': m = Geo3D.plane(s[0], s[1], 24); break;
      case 'ground': m = Geo3D.ground(s[0], s[2] || s[1], 32); break;
      case 'cylinder': m = Geo3D.cylinder(s[0] / 2, s[1], 40); break;
      case 'torus': m = Geo3D.torus(s[0] / 2, s[1] / 4, 64); break;
      default: m = Geo3D.box(s[0], s[1], s[2], 10);
    }
    if (this.primCache.size > 50) this.primCache.clear();
    this.primCache.set(key, m); return m;
  },
  axisAngle(k, a) { const c = Math.cos(a), s = Math.sin(a), t = 1 - c; const [x, y, z] = k; const m = M4.ident(); m[0] = t * x * x + c; m[1] = t * x * y + s * z; m[2] = t * x * z - s * y; m[4] = t * x * y - s * z; m[5] = t * y * y + c; m[6] = t * y * z + s * x; m[8] = t * x * z + s * y; m[9] = t * y * z - s * x; m[10] = t * z * z + c; return m; },
  deformGeo(g, f, linear) {
    const o = {};
    if (g.mesh) o.mesh = Geo3D.deform(g.mesh, f);
    if (g.curves) o.curves = g.curves.map(c => ({ pts: c.pts.map(f), closed: c.closed }));
    if (g.regions) o.regions = g.regions.map(r => ({ outer: r.outer.map(p => f([p[0], p[1], 0]).slice(0, 2)), holes: r.holes.map(h => h.map(p => f([p[0], p[1], 0]).slice(0, 2))) }));
    if (g.points) o.points = { pos: g.points.pos.map(f), nrm: g.points.nrm };
    return GeoC(o);
  },
  recomputeNormals(m) {
    const n = m.pos.length / 3; const nrm = new Float32Array(m.pos.length); const P = m.pos;
    for (let t = 0; t < m.idx.length; t += 3) { const a = m.idx[t] * 3, b = m.idx[t + 1] * 3, c = m.idx[t + 2] * 3; const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]]; const fn = V3.cross(e1, e2); for (const v of [a, b, c]) { nrm[v] += fn[0]; nrm[v + 1] += fn[1]; nrm[v + 2] += fn[2]; } }
    for (let i = 0; i < n; i++) { const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1; const o = [m.nrm[i * 3], m.nrm[i * 3 + 1], m.nrm[i * 3 + 2]]; let x = nrm[i * 3] / l, y = nrm[i * 3 + 1] / l, z = nrm[i * 3 + 2] / l; if (x * o[0] + y * o[1] + z * o[2] < 0) { x = -x; y = -y; z = -z; } nrm[i * 3] = x; nrm[i * 3 + 1] = y; nrm[i * 3 + 2] = z; }
    return Geo3D.mesh(m.pos, nrm, m.idx, m.col ? { col: m.col } : null);
  },
  // 图层的网格（图层空间）
  layerGeo(comp, L, t) {
    if (L.type !== 'geo') return null;
    if (L.geo.src === 'nodes') {
      const cons = NodeEval.consumers(comp, 'display').find(c => c.node.p.layer === L.id);
      if (!cons) return null;
      try { return NodeEval.consumerInput(comp, t, cons, 'geo'); } catch (e) { console.warn(e); return null; }
    }
    const d = Anim.evalProp(L.geo.dims, comp, L, t);
    return { mesh: this.primitive(L.geo.src, d) };
  },
  layerMesh(comp, L, t) {
    const g = this.layerGeo(comp, L, t); if (!g) return null;
    if (g.mesh) return g.mesh;
    if (g.regions && g.regions.length) { // 自动平面三角化
      const key = 'flat' + g.uid; let m = this.primCache.get(key);
      if (!m) { const ms = g.regions.map(r => { const e = Geo2D.earcut(r.outer, r.holes); const pos = [], nrm = []; for (const p of e.pts) { pos.push(p[0], p[1], 0); nrm.push(0, 0, -1); } return Geo3D.mesh(pos, nrm, e.tris); }); m = Geo3D.merge(ms); this.primCache.set(key, m); }
      return m;
    }
    return null;
  },
};
