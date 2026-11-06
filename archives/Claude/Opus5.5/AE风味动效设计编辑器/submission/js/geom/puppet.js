// 网格图钉变形：轮廓三角网格（凹部/孔洞）、位置/旋转/缩放图钉（MLS 刚性）、局部刚性区域、前后关系（叠放→局部深度）、场驱动、固定拓扑绑定输出
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, M4 = U.M4, P = AE.Path, Poly = AE.Poly, E = AE.Eval, Mdl = AE.Model, C = AE.Content;
  const PP = AE.Puppet = {};
  PP.create = () => ({ on: true, density: Mdl.num(28), rigidity: Mdl.num(1.4), pins: [], starch: [], overlap: [], field: '', fieldAmount: Mdl.num(0), bound: null });
  PP.pin = (rest, name) => ({ id: Mdl.newId('pn'), name: name || '图钉', rest: rest.slice(0, 2), pos: Mdl.v2(rest.slice(0, 2)), rot: Mdl.num(0), scale: Mdl.num(100), weight: Mdl.num(1) });

  // ---------- 网格生成 ----------
  function restPolys(layer, t, ctx) {
    if (layer.type === 'shape' || layer.type === 'text') return C.layerGeometry(layer, t, ctx, 1).filter(p => p.c && p.p.length >= 6);
    const b = AE.R.contentBounds(layer, t, ctx); if (!b) return [];
    return [{ c: true, p: [b[0], b[1], b[2], b[1], b[2], b[3], b[0], b[3]] }];
  }
  const topoKey = (polys) => polys.length + ':' + polys.map(p => p.p.length).join(',');
  // 三角化 + 红绿细分到目标边长
  function buildMesh(polys, h) {
    // 重采样轮廓：边长约 h
    const rs = polys.map(p => { const L = P.polyLength(p); const n = Math.max(6, Math.round(L / h)); return { c: true, p: P.resample(p, n).p }; });
    const tri = Poly.triangulateAll(rs);
    let pts = tri.pts.slice(), idx = tri.idx.slice();
    for (let it = 0; it < 5; it++) {
      const em = new Map(); let any = false;
      const ek = (a, b) => a < b ? a + '_' + b : b + '_' + a;
      const len = (a, b) => Math.hypot(pts[2 * a] - pts[2 * b], pts[2 * a + 1] - pts[2 * b + 1]);
      for (let k = 0; k < idx.length; k += 3) for (let e = 0; e < 3; e++) { const a = idx[k + e], b = idx[k + (e + 1) % 3]; if (len(a, b) > h * 1.4 && !em.has(ek(a, b))) { em.set(ek(a, b), -1); any = true; } }
      if (!any) break;
      for (const key of em.keys()) { const [a, b] = key.split('_').map(Number); em.set(key, pts.length / 2); pts.push((pts[2 * a] + pts[2 * b]) / 2, (pts[2 * a + 1] + pts[2 * b + 1]) / 2); }
      const out = [];
      for (let k = 0; k < idx.length; k += 3) {
        const v = [idx[k], idx[k + 1], idx[k + 2]], m = [0, 1, 2].map(e => em.has(ek(v[e], v[(e + 1) % 3])) ? em.get(ek(v[e], v[(e + 1) % 3])) : -1);
        const cnt = m.filter(x => x >= 0).length;
        if (cnt === 0) out.push(...v);
        else if (cnt === 3) out.push(v[0], m[0], m[2], m[0], v[1], m[1], m[2], m[1], v[2], m[0], m[1], m[2]);
        else if (cnt === 1) { const e = m.findIndex(x => x >= 0); const a = v[e], b = v[(e + 1) % 3], c = v[(e + 2) % 3]; out.push(a, m[e], c, m[e], b, c); }
        else { const e = m.findIndex(x => x < 0); const a = v[e], b = v[(e + 1) % 3], c = v[(e + 2) % 3]; const mb = m[(e + 1) % 3], mc = m[(e + 2) % 3]; out.push(a, b, mb, a, mb, mc, mc, mb, c); }
      }
      idx = out;
    }
    return { pts, idx, outline: rs };
  }
  PP.bind = (layer, t, ctx) => {
    const pu = layer.puppet;
    const polys = restPolys(layer, t, ctx);
    const h = Math.max(6, E.prop(pu.density, t, ctx, layer));
    const m = buildMesh(polys, h);
    pu.bound = { topo: topoKey(polys), t, h, count: m.pts.length / 2, tris: m.idx.length / 3 };
    layer._pm = { key: JSON.stringify(pu.bound), mesh: m };
    return m;
  };
  function getBound(layer, ctx) {
    const pu = layer.puppet;
    if (!pu.bound) PP.bind(layer, 0, ctx);
    const key = JSON.stringify(pu.bound);
    if (!layer._pm || layer._pm.key !== key) {
      const polys = restPolys(layer, pu.bound.t, ctx);
      layer._pm = { key, mesh: buildMesh(polys, pu.bound.h) };
    }
    return layer._pm.mesh;
  }
  // ---------- 变形函数 ----------
  function controls(layer, t, ctx) {
    const pu = layer.puppet, ps = [], qs = [], ws = [];
    for (const pin of pu.pins) {
      const q = E.prop(pin.pos, t, ctx, layer), rot = E.prop(pin.rot, t, ctx, layer) * U.deg, sc = E.prop(pin.scale, t, ctx, layer) / 100, w = Math.max(0.01, E.prop(pin.weight, t, ctx, layer));
      ps.push(pin.rest); qs.push(q); ws.push(w);
      if (rot !== 0 || sc !== 1 || pin.kind === 'rot') {
        const r = pu.bound ? pu.bound.h * 2 : 40;
        for (const a of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) { ps.push([pin.rest[0] + Math.cos(a) * r, pin.rest[1] + Math.sin(a) * r]); qs.push([q[0] + Math.cos(a + rot) * r * sc, q[1] + Math.sin(a + rot) * r * sc]); ws.push(w * 0.8); }
      }
    }
    return { ps, qs, ws };
  }
  function mls(v, c, alpha) {
    const n = c.ps.length;
    if (!n) return v.slice();
    let sw = 0, px = 0, py = 0, qx = 0, qy = 0;
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const dx = c.ps[i][0] - v[0], dy = c.ps[i][1] - v[1], d2 = dx * dx + dy * dy;
      if (d2 < 1e-8) return c.qs[i].slice();
      w[i] = c.ws[i] / Math.pow(d2, alpha); sw += w[i];
      px += w[i] * c.ps[i][0]; py += w[i] * c.ps[i][1]; qx += w[i] * c.qs[i][0]; qy += w[i] * c.qs[i][1];
    }
    px /= sw; py /= sw; qx /= sw; qy /= sw;
    if (n === 1) return [v[0] - px + qx, v[1] - py + qy];
    const vx = v[0] - px, vy = v[1] - py;
    let fx = 0, fy = 0;
    for (let i = 0; i < n; i++) {
      const phx = c.ps[i][0] - px, phy = c.ps[i][1] - py, qhx = c.qs[i][0] - qx, qhy = c.qs[i][1] - qy;
      // A = w [p̂; -p̂⊥][v; -v⊥]^T, ⊥(x,y)=(-y,x)
      const a11 = w[i] * (phx * vx + phy * vy), a12 = w[i] * (phx * vy - phy * vx);
      const a21 = -a12, a22 = a11;
      fx += qhx * a11 + qhy * a21; fy += qhx * a12 + qhy * a22;
    }
    const L = Math.hypot(fx, fy) || 1, r = Math.hypot(vx, vy);
    return [fx / L * r + qx, fy / L * r + qy];
  }
  // 最佳刚性变换（Procrustes）
  function fitRigid(src, dst, wts) {
    let sw = 0, sx = 0, sy = 0, dx = 0, dy = 0;
    for (let i = 0; i < src.length; i++) { const w = wts[i]; sw += w; sx += w * src[i][0]; sy += w * src[i][1]; dx += w * dst[i][0]; dy += w * dst[i][1]; }
    if (sw < 1e-9) return null;
    sx /= sw; sy /= sw; dx /= sw; dy /= sw;
    let a = 0, b = 0;
    for (let i = 0; i < src.length; i++) { const w = wts[i], ux = src[i][0] - sx, uy = src[i][1] - sy, vx = dst[i][0] - dx, vy = dst[i][1] - dy; a += w * (ux * vx + uy * vy); b += w * (ux * vy - uy * vx); }
    const th = Math.atan2(b, a), c = Math.cos(th), s = Math.sin(th);
    return (p) => [c * (p[0] - sx) - s * (p[1] - sy) + dx, s * (p[0] - sx) + c * (p[1] - sy) + dy];
  }
  // 变形一组点（rest → 当前）
  function deformPoints(layer, t, ctx, restPts) {
    const pu = layer.puppet, c = controls(layer, t, ctx), alpha = Math.max(0.2, E.prop(pu.rigidity, t, ctx, layer));
    const n = restPts.length / 2, out = new Float64Array(restPts.length);
    for (let i = 0; i < n; i++) { const r = mls([restPts[2 * i], restPts[2 * i + 1]], c, alpha); out[2 * i] = r[0]; out[2 * i + 1] = r[1]; }
    // 局部刚性：区域内向最佳刚性变换靠拢
    for (const st of pu.starch) {
      const R = Math.max(1, E.prop(st.radius, t, ctx, layer)), amt = U.clamp(E.prop(st.amount, t, ctx, layer), 0, 1);
      const src = [], dst = [], w = [];
      for (let i = 0; i < n; i++) { const d = Math.hypot(restPts[2 * i] - st.rest[0], restPts[2 * i + 1] - st.rest[1]); if (d < R) { src.push([restPts[2 * i], restPts[2 * i + 1]]); dst.push([out[2 * i], out[2 * i + 1]]); w.push(1 - d / R); } }
      const f = fitRigid(src, dst, w); if (!f) continue;
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(restPts[2 * i] - st.rest[0], restPts[2 * i + 1] - st.rest[1]); if (d >= R * 1.6) continue;
        const k = amt * U.smooth(R * 1.6, R * 0.7, d);
        const r = f([restPts[2 * i], restPts[2 * i + 1]]); out[2 * i] += (r[0] - out[2 * i]) * k; out[2 * i + 1] += (r[1] - out[2 * i + 1]) * k;
      }
    }
    // 场驱动
    if (pu.field && AE.Fields) {
      const amt = E.prop(pu.fieldAmount, t, ctx, layer);
      if (amt) { const W = E.world(layer, t, ctx), Wi = M4.inv(W); for (let i = 0; i < n; i++) { const wp = M4.apply(W, [out[2 * i], out[2 * i + 1], 0]); const f = AE.Fields.sampleNamedVec(ctx.comp, pu.field, wp, t, ctx); const l = M4.applyDir(Wi, f); out[2 * i] += l[0] * amt; out[2 * i + 1] += l[1] * amt; } }
    }
    return out;
  }
  function depthAt(layer, t, ctx, x, y) {
    let d = 0;
    for (const o of layer.puppet.overlap) { const R = Math.max(1, E.prop(o.radius, t, ctx, layer)); const dd = Math.hypot(x - o.rest[0], y - o.rest[1]); if (dd < R) d += E.prop(o.inFront, t, ctx, layer) / 100 * U.smooth(R, R * 0.4, dd); }
    return d;
  }
  // 当前网格：{rest, pos, depth, idx}
  PP.mesh = (layer, t, ctx) => {
    const pu = layer.puppet; if (!pu || !pu.on) return null;
    const m = getBound(layer, ctx);
    const key = E.rev + '|' + t + '|' + ctx.inst.key;
    if (layer._pmc && layer._pmc.key === key) return layer._pmc.v;
    const pos = deformPoints(layer, t, ctx, m.pts);
    const n = m.pts.length / 2, depth = new Float32Array(n);
    for (let i = 0; i < n; i++) depth[i] = depthAt(layer, t, ctx, m.pts[2 * i], m.pts[2 * i + 1]);
    const v = { rest: m.pts, pos, depth, idx: m.idx };
    layer._pmc = { key, v };
    return v;
  };
  // 变形后的轮廓（固定拓扑；保持拓扑的源修改直接更新）
  PP.deformedOutline = (layer, t, ctx) => {
    const pu = layer.puppet; if (!pu || !pu.on) return null;
    const m = getBound(layer, ctx);
    let outline = m.outline;
    const cur = restPolys(layer, pu.bound.t, ctx);
    PP.status = topoKey(cur) === pu.bound.topo ? 'ok' : 'rebind';
    if (PP.status === 'ok') { const h = pu.bound.h; outline = cur.map((p, i) => ({ c: true, p: P.resample(p, m.outline[i] ? m.outline[i].p.length / 2 : Math.max(6, Math.round(P.polyLength(p) / h))).p })); }
    return outline.map(pl => { const d = deformPoints(layer, t, ctx, pl.p); return { c: true, p: Array.from(d) }; });
  };
  PP.depthField = (layer, t, ctx) => (x, y) => depthAt(layer, t, ctx, x, y);

  // ---------- 渲染（二维：纹理网格 + 叠放深度） ----------
  let prog = null;
  function getProg() {
    return prog || (prog = AE.GL.prog('puppet', `layout(location=0) in vec2 aPos; layout(location=1) in vec2 aUV; layout(location=2) in float aD; uniform mat4 uM; out vec2 vUV; void main(){ vUV=aUV; vec4 p = uM*vec4(aPos,0.0,1.0); p.z = -aD*0.1*p.w; gl_Position = p; }`,
      `in vec2 vUV; out vec4 o; uniform sampler2D uTex; void main(){ vec4 c = texture(uTex, vUV); if(c.a<0.01) discard; o = c; }`));
  }
  let vao = null, bufs = null;
  PP.drawLayer = (layer, t, ctx, M, pxPer, opts) => {
    const gl = AE.GL.gl, R = AE.R;
    const mesh = PP.mesh(layer, t, ctx); if (!mesh) return false;
    const b = AE.R.contentBounds(layer, t, ctx); if (!b) return true;
    const pad = 4, rect = [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
    // 内容（未变形）先渲染为纹理
    let s = Math.min(pxPer * 1.25, 2048 / Math.max(rect[2] - rect[0], rect[3] - rect[1]));
    const sp = R.space(rect, (rect[2] - rect[0]) * s, (rect[3] - rect[1]) * s);
    const T = AE.GL.target(sp.w, sp.h, 'ms');
    AE.GL.bind(T, true); AE.GL.clear();
    R.drawContent(layer, t, ctx, sp.proj, s, Object.assign({}, opts, { noPuppet: true }));
    AE.GL.resolve(T);
    const n = mesh.rest.length / 2, pos = new Float32Array(n * 2), uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { pos[2 * i] = mesh.pos[2 * i]; pos[2 * i + 1] = mesh.pos[2 * i + 1]; uv[2 * i] = (mesh.rest[2 * i] - rect[0]) / (rect[2] - rect[0]); uv[2 * i + 1] = 1 - (mesh.rest[2 * i + 1] - rect[1]) / (rect[3] - rect[1]); }
    // 回到调用者的多重采样目标
    const caller = opts && opts._target;
    if (!vao) { vao = gl.createVertexArray(); bufs = [gl.createBuffer(), gl.createBuffer(), gl.createBuffer(), gl.createBuffer()]; }
    gl.bindVertexArray(vao);
    const set = (i, d, k) => { gl.bindBuffer(gl.ARRAY_BUFFER, bufs[i]); gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, k, gl.FLOAT, false, 0, 0); };
    set(0, pos, 2); set(1, uv, 2); set(2, mesh.depth, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs[3]); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mesh.idx), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    if (caller) AE.GL.bind(caller, true);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.DEPTH_BUFFER_BIT);
    AE.GL.blend('pre');
    AE.GL.use(getProg(), { uM: AE.GL.m4(M), uTex: T });
    gl.bindVertexArray(vao); gl.drawElements(gl.TRIANGLES, mesh.idx.length, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST); AE.GL.blend(null);
    AE.GL.release(T);
    return true;
  };

  // ---------- 画布：网格与图钉 ----------
  PP.drawGizmo = (ox, l, ch, LP, V) => {
    const pu = l.puppet; if (!pu || !pu.on) return;
    const m = PP.mesh(l, ch.t, ch.ctx); if (!m) return;
    if (V.show.mesh) {
      ox.strokeStyle = 'rgba(255,209,102,.28)'; ox.lineWidth = 0.6; ox.beginPath();
      const sp = (i) => LP(l, [m.pos[2 * i], m.pos[2 * i + 1], 0]);
      const cache = new Array(m.pos.length / 2);
      const g = (i) => cache[i] || (cache[i] = sp(i));
      for (let k = 0; k < m.idx.length; k += 3) { const a = g(m.idx[k]), b = g(m.idx[k + 1]), c = g(m.idx[k + 2]); if (!a || !b || !c) continue; ox.moveTo(a[0], a[1]); ox.lineTo(b[0], b[1]); ox.lineTo(c[0], c[1]); ox.closePath(); }
      ox.stroke();
    }
    for (const st of pu.starch) { const c = LP(l, [st.rest[0], st.rest[1], 0]), e = LP(l, [st.rest[0] + E.prop(st.radius, ch.t, ch.ctx, l), st.rest[1], 0]); if (!c || !e) continue; ox.strokeStyle = 'rgba(76,201,240,.8)'; ox.setLineDash([4, 3]); ox.beginPath(); ox.arc(c[0], c[1], Math.hypot(e[0] - c[0], e[1] - c[1]), 0, 7); ox.stroke(); ox.setLineDash([]); ox.fillStyle = '#4cc9f0'; ox.font = '10px sans-serif'; ox.fillText('刚性', c[0] + 4, c[1] - 4); }
    for (const o of pu.overlap) { const c = LP(l, [o.rest[0], o.rest[1], 0]); if (!c) continue; ox.strokeStyle = 'rgba(62,207,142,.85)'; ox.beginPath(); ox.arc(c[0], c[1], 7, 0, 7); ox.stroke(); ox.fillStyle = '#3ecf8e'; ox.font = '10px sans-serif'; ox.fillText('前后 ' + U.fmt(E.prop(o.inFront, ch.t, ch.ctx, l), 0), c[0] + 9, c[1] + 3); }
    for (const pin of pu.pins) {
      const q = E.prop(pin.pos, ch.t, ch.ctx, l), s = LP(l, [q[0], q[1], 0]); if (!s) continue;
      const sel = App().sel.pin === pin.id;
      ox.fillStyle = sel ? '#ff9f43' : '#ffd166'; ox.strokeStyle = '#16191f'; ox.lineWidth = 1.5; ox.beginPath(); ox.arc(s[0], s[1], sel ? 6 : 5, 0, 7); ox.fill(); ox.stroke();
      const rot = E.prop(pin.rot, ch.t, ch.ctx, l); if (rot) { ox.strokeStyle = '#ffd166'; ox.beginPath(); ox.moveTo(s[0], s[1]); ox.lineTo(s[0] + Math.cos(rot * U.deg) * 16, s[1] + Math.sin(rot * U.deg) * 16); ox.stroke(); }
      V.handles.push({ kind: 'pin', layer: l, pin, x: s[0], y: s[1], r: 8 });
    }
  };
  const App = () => AE.App;
  PP.addPinAt = (l, cp, starch, ch) => {
    if (!['shape', 'text', 'precomp', 'solid'].includes(l.type)) { AE.W.toast('图钉可用于形状、文字、纯色与预合成图层'); return; }
    const Wi = M4.inv(E.world(l, ch.t, ch.ctx)); const p = M4.apply(Wi, [cp[0], cp[1], 0]);
    App().edit(starch ? '添加刚性区域' : '添加图钉', () => {
      if (!l.puppet) { l.puppet = PP.create(); PP.bind(l, ch.t, ch.ctx); }
      // 静止位置：反解当前变形（近似：用最近网格点）
      const m = PP.mesh(l, ch.t, ch.ctx); let rest = [p[0], p[1]];
      if (m && l.puppet.pins.length) { let bi = 0, bd = Infinity; for (let i = 0; i < m.pos.length / 2; i++) { const d = Math.hypot(m.pos[2 * i] - p[0], m.pos[2 * i + 1] - p[1]); if (d < bd) { bd = d; bi = i; } } rest = [m.rest[2 * bi] + (p[0] - m.pos[2 * bi]), m.rest[2 * bi + 1] + (p[1] - m.pos[2 * bi + 1])]; }
      if (starch) l.puppet.starch.push({ id: Mdl.newId('st'), rest, radius: Mdl.num(60), amount: Mdl.num(1) });
      else { const pin = PP.pin(rest, '图钉 ' + (l.puppet.pins.length + 1)); pin.pos.value = [p[0], p[1]]; l.puppet.pins.push(pin); App().sel.pin = pin.id; }
    });
  };
  PP.dragPin = (e, h, x, y, ch, V) => {
    const l = h.layer, pin = h.pin, Wi = M4.inv(E.world(l, ch.t, ch.ctx));
    App().sel.pin = pin.id;
    const q0 = E.prop(pin.pos, ch.t, ch.ctx, l).slice(); let st = false;
    const mm = (ev) => {
      const r = ev.target.closest ? null : null;
      const rc = document.getElementById('viewer').getBoundingClientRect();
      const c0 = V.s2c([x, y]), c1 = V.s2c([ev.clientX - rc.left, ev.clientY - rc.top]);
      const d = M4.applyDir(Wi, [c1[0] - c0[0], c1[1] - c0[1], 0]);
      if (!st) { st = true; App().beginOp(); }
      App().writeProp(pin.pos, [q0[0] + d[0], q0[1] + d[1]]); E.bump(); App().mark('viewer', 'props', 'timeline');
    };
    const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); if (st) App().endOp('移动图钉'); App().mark(); };
    addEventListener('mousemove', mm); addEventListener('mouseup', mu);
  };
  // ---------- 属性面板 ----------
  PP.panel = (l, h) => {
    const W = AE.W, el = W.el, A = App();
    const pu = l.puppet;
    if (!pu) return h.sect('l:puppet', '网格图钉变形', [el('div', { class: 'small', text: '用图钉工具（P）在图层上单击添加图钉；或：' }), h.btn('生成网格并启用', () => A.edit('启用图钉变形', () => { l.puppet = PP.create(); PP.bind(l, A.t(), A.ctx()); }))]);
    const m = PP.mesh(l, A.t(), A.ctx());
    const dout = PP.deformedOutline(l, A.t(), A.ctx());
    const fo = { '': '（无）' }; for (const n of AE.Nodes.outputNames(A.comp(), ['fieldOut'])) fo[n] = n;
    const body = [
      h.row('启用', h.chk(pu.on, v => A.edit('图钉变形', () => { pu.on = v; }))),
      el('div', { class: 'small', text: m ? `网格 ${m.rest.length / 2} 顶点 · ${m.idx.length / 3} 三角形 · 绑定于 ${pu.bound.t.toFixed(2)}s · ` + (PP.status === 'rebind' ? '⚠ 源拓扑已改变，请重新绑定' : '拓扑一致（源修改直接更新）') : '' }),
      h.propRow(l, pu.density, '网格密度(边长)'), h.propRow(l, pu.rigidity, '整体刚性', { step: 0.01 }),
      h.row('', h.btn('重新绑定', () => A.edit('重新绑定网格', () => PP.bind(l, A.t(), A.ctx()))), h.btn('重置图钉', () => A.edit('重置图钉', () => { for (const p of pu.pins) { p.pos.anim = false; p.pos.keys = []; p.pos.value = p.rest.slice(); p.rot.value = 0; p.scale.value = 100; } })), h.btn('删除变形', () => A.edit('删除图钉变形', () => { delete l.puppet; }))),
      h.row('场驱动', h.sel(fo, pu.field || '', v => A.edit('图钉场', () => { pu.field = v; }))), pu.field ? h.propRow(l, pu.fieldAmount, '场强度') : null,
    ].filter(Boolean);
    pu.pins.forEach((p, i) => { body.push(el('div', { class: 'sub-h' }, el('span', { text: p.name }), el('span', { class: 'acts' }, h.ib('trash', '删除', () => A.edit('删除图钉', () => pu.pins.splice(i, 1)))))); body.push(h.propRow(l, p.pos, '位置'), h.propRow(l, p.rot, '旋转'), h.propRow(l, p.scale, '缩放'), h.propRow(l, p.weight, '影响权重', { step: 0.01 })); });
    pu.starch.forEach((s, i) => { body.push(el('div', { class: 'sub-h' }, el('span', { text: '局部刚性区域 ' + (i + 1) }), el('span', { class: 'acts' }, h.ib('trash', '删除', () => A.edit('删除刚性', () => pu.starch.splice(i, 1)))))); body.push(h.propRow(l, s.radius, '半径'), h.propRow(l, s.amount, '刚性', { step: 0.01 })); });
    pu.overlap.forEach((o, i) => { body.push(el('div', { class: 'sub-h' }, el('span', { text: '前后关系 ' + (i + 1) }), el('span', { class: 'acts' }, h.ib('trash', '删除', () => A.edit('删除前后', () => pu.overlap.splice(i, 1)))))); body.push(h.propRow(l, o.radius, '范围'), h.propRow(l, o.inFront, '前后（越大越靠前）')); });
    const b = AE.R.contentBounds(l, A.t(), A.ctx()) || [0, 0, 100, 100], c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    body.push(h.row('', h.btn('＋ 刚性区域', () => A.edit('添加刚性区域', () => pu.starch.push({ id: Mdl.newId('st'), rest: c, radius: Mdl.num(80), amount: Mdl.num(1) }))), h.btn('＋ 前后关系', () => A.edit('添加前后关系', () => pu.overlap.push({ id: Mdl.newId('ov'), rest: c, radius: Mdl.num(120), inFront: Mdl.num(50) })))));
    body.push(el('div', { class: 'small', text: '变形结果是真实几何：可作为挤出实体的源（三维几何层 › 挤出 › 源图层），叠放值进入三维时转换为局部深度。' }));
    return h.sect('l:puppet', '网格图钉变形（' + pu.pins.length + ' 图钉）', body);
  };
})(typeof window !== 'undefined' ? window : globalThis);
