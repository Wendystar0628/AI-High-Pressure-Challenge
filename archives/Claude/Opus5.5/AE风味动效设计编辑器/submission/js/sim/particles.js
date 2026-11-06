// 粒子：确定性固定步长模拟（检查点缓存）、点/曲线/表面发射、力场、网格碰撞（含表面速度）、事件与次级发射、轨迹拖尾
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, M4 = U.M4, P = AE.Path, E = AE.Eval, Mesh = AE.Mesh, C = AE.Content;
  const PS = AE.Particles = { stats: { steps: 0, resets: 0 } };
  const TRAIL_N = 24;

  function newState(cap) {
    return {
      n: 0, cap, t: 0, step: 0, nextId: 0,
      pos: new Float32Array(cap * 3), vel: new Float32Array(cap * 3), age: new Float32Array(cap), life: new Float32Array(cap),
      mass: new Float32Array(cap), size: new Float32Array(cap), seed: new Float32Array(cap), id: new Float32Array(cap),
      col: new Float32Array(cap * 4), hasCol: new Uint8Array(cap), gen: new Uint8Array(cap), hit: new Uint8Array(cap), em: new Uint8Array(cap),
      tr: new Float32Array(cap * TRAIL_N * 3), trN: new Uint8Array(cap), trH: new Uint8Array(cap),
      emitAcc: [], events: 0,
    };
  }
  function cloneState(s) {
    const n = s.n, c = newState(s.cap);
    c.n = n; c.t = s.t; c.step = s.step; c.nextId = s.nextId; c.emitAcc = s.emitAcc.slice(); c.events = s.events;
    for (const k of ['pos', 'vel', 'col', 'tr']) { const per = k === 'pos' || k === 'vel' ? 3 : k === 'col' ? 4 : TRAIL_N * 3; c[k].set(s[k].subarray(0, n * per)); }
    for (const k of ['age', 'life', 'mass', 'size', 'seed', 'id', 'hasCol', 'gen', 'hit', 'em', 'trN', 'trH']) c[k].set(s[k].subarray(0, n));
    return c;
  }
  function kill(s, i) { // 与末尾交换
    const j = s.n - 1;
    if (i !== j) {
      for (const k of ['pos', 'vel']) for (let d = 0; d < 3; d++) s[k][3 * i + d] = s[k][3 * j + d];
      for (let d = 0; d < 4; d++) s.col[4 * i + d] = s.col[4 * j + d];
      s.tr.copyWithin(i * TRAIL_N * 3, j * TRAIL_N * 3, (j + 1) * TRAIL_N * 3);
      for (const k of ['age', 'life', 'mass', 'size', 'seed', 'id', 'hasCol', 'gen', 'hit', 'em', 'trN', 'trH']) s[k][i] = s[k][j];
    }
    s.n--;
  }
  function spawn(s, p, v, life, mass, size, seed, gen, em, color) {
    if (s.n >= s.cap) return -1;
    const i = s.n++;
    s.pos[3 * i] = p[0]; s.pos[3 * i + 1] = p[1]; s.pos[3 * i + 2] = p[2];
    s.vel[3 * i] = v[0]; s.vel[3 * i + 1] = v[1]; s.vel[3 * i + 2] = v[2];
    s.age[i] = 0; s.life[i] = life; s.mass[i] = mass; s.size[i] = size; s.seed[i] = seed; s.id[i] = s.nextId++;
    s.gen[i] = gen; s.hit[i] = 0; s.em[i] = em; s.hasCol[i] = color ? 1 : 0;
    if (color) for (let d = 0; d < 4; d++) s.col[4 * i + d] = color[d] === undefined ? 1 : color[d];
    s.trN[i] = 0; s.trH[i] = 0;
    return i;
  }

  // ---------- 源几何 ----------
  // 返回世界空间 {kind, pos(fn), tris} 等
  function emitterSource(em, layer, t, ctx) {
    const comp = ctx.comp;
    if (em.kind === 'point') { const p = E.prop(em.position, t, ctx, layer); return { kind: 'point', p }; }
    let g = null;
    if (em.layer) {
      const sl = E.layer(comp, em.layer);
      if (!sl) return null;
      if (sl.type === 'geo3d') { const m = AE.R3.geoMesh(sl, t, ctx); if (m) g = { mesh: Mesh.worldTris(m, E.world(sl, t, ctx)) }; }
      else if (sl.type === 'shape' || sl.type === 'text') { const W = E.world(sl, t, ctx); const polys = em.kind === 'surface' ? C.layerGeometry(sl, t, ctx, 1) : C.shapeGeometry(sl, t, ctx, 1).paths; g = { paths: polys, W }; if (sl.type === 'text') g.paths = C.textGeometry(sl, t, ctx).polys; }
      else { const W = E.world(sl, t, ctx); return { kind: 'point', p: [W[12], W[13], W[14]] }; }
    } else if (em.output && AE.Nodes) {
      const ng = AE.Nodes.output(comp, em.output, t, ctx);
      if (ng) { if (ng.mesh) g = { mesh: { pos: ng.mesh.pos, nrm: ng.mesh.nrm, idx: ng.mesh.idx } }; else if (ng.paths) g = { paths: ng.paths, W: M4.ident() }; else if (ng.points) g = { points: ng.points }; }
    }
    if (!g) return null;
    if (g.mesh) {
      const m = g.mesh, idx = m.idx, nt = idx.length / 3, cum = new Float64Array(nt + 1);
      for (let k = 0; k < nt; k++) {
        const a = idx[3 * k] * 3, b = idx[3 * k + 1] * 3, c = idx[3 * k + 2] * 3, p = m.pos;
        const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
        cum[k + 1] = cum[k] + Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      }
      return { kind: 'surface', m, cum };
    }
    if (g.points) return { kind: 'points', pts: g.points };
    if (g.paths && g.paths.length) {
      const pl = g.paths.map(p => ({ pl: p, cum: P.cumLen(p) })); const tot = pl.reduce((a, x) => a + x.cum[x.cum.length - 1], 0);
      return { kind: 'curve', pl, tot, W: g.W };
    }
    return null;
  }
  // 在源上按随机数取点 → {p, n}
  function sampleSource(src, r1, r2, r3) {
    if (src.kind === 'point') return { p: src.p.slice(), n: null };
    if (src.kind === 'points') { const n = src.pts.n; if (!n) return null; const i = Math.min(n - 1, Math.floor(r1 * n)); return { p: [src.pts.pos[3 * i], src.pts.pos[3 * i + 1], src.pts.pos[3 * i + 2]], n: null }; }
    if (src.kind === 'curve') {
      let s = r1 * src.tot;
      for (const x of src.pl) { const L = x.cum[x.cum.length - 1]; if (s <= L || x === src.pl[src.pl.length - 1]) { const pt = P.pointAt(x.pl, x.cum, s); const w = M4.apply(src.W, [pt.x, pt.y, 0]); const tn = M4.applyDir(src.W, [pt.ty, -pt.tx, 0]); return { p: w, n: U.norm(tn) }; } s -= L; }
      return null;
    }
    if (src.kind === 'surface') {
      const cum = src.cum, nt = cum.length - 1, tot = cum[nt]; if (tot <= 0) return null;
      const target = r1 * tot; let lo = 0, hi = nt; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= target) lo = m; else hi = m; }
      const m = src.m, idx = m.idx, a = idx[3 * lo] * 3, b = idx[3 * lo + 1] * 3, c = idx[3 * lo + 2] * 3;
      let u = r2, v = r3; if (u + v > 1) { u = 1 - u; v = 1 - v; } const w = 1 - u - v;
      const p = [0, 1, 2].map(d => m.pos[a + d] * w + m.pos[b + d] * u + m.pos[c + d] * v);
      const n = U.norm([0, 1, 2].map(d => m.nrm[a + d] * w + m.nrm[b + d] * u + m.nrm[c + d] * v));
      return { p, n };
    }
    return null;
  }
  // 碰撞体（世界空间三角形 + 网格哈希）
  function colliderGeom(co, layer, t, ctx) {
    const comp = ctx.comp;
    if (co.kind === 'plane') {
      const sl = co.layer && E.layer(comp, co.layer); if (!sl) return null;
      const W = E.world(sl, t, ctx);
      if (sl.type === 'geo3d' && sl.geo.source.kind === 'plane') { const n = U.norm(M4.applyDir(W, [0, -1, 0])); return { kind: 'plane', p: [W[12], W[13], W[14]], n }; }
      const n = U.norm(M4.applyDir(W, [0, 0, -1])); return { kind: 'plane', p: M4.apply(W, [0, 0, 0]), n };
    }
    let mesh = null;
    if (co.layer) { const sl = E.layer(comp, co.layer); if (sl && sl.type === 'geo3d') { const m = AE.R3.geoMesh(sl, t, ctx); if (m) mesh = Mesh.worldTris(m, E.world(sl, t, ctx)); } }
    else if (co.output && AE.Nodes) { const g = AE.Nodes.output(comp, co.output, t, ctx); if (g && g.mesh) mesh = { pos: g.mesh.pos, nrm: g.mesh.nrm, idx: g.mesh.idx }; }
    if (!mesh) return null;
    return { kind: 'mesh', m: mesh };
  }
  function buildHash(m, cell) {
    const idx = m.idx, p = m.pos, map = new Map(), nt = idx.length / 3;
    const key = (x, y, z) => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
    for (let k = 0; k < nt; k++) {
      const a = idx[3 * k] * 3, b = idx[3 * k + 1] * 3, c = idx[3 * k + 2] * 3;
      const x0 = Math.floor(Math.min(p[a], p[b], p[c]) / cell), x1 = Math.floor(Math.max(p[a], p[b], p[c]) / cell);
      const y0 = Math.floor(Math.min(p[a + 1], p[b + 1], p[c + 1]) / cell), y1 = Math.floor(Math.max(p[a + 1], p[b + 1], p[c + 1]) / cell);
      const z0 = Math.floor(Math.min(p[a + 2], p[b + 2], p[c + 2]) / cell), z1 = Math.floor(Math.max(p[a + 2], p[b + 2], p[c + 2]) / cell);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const kk = key(x, y, z); let l = map.get(kk); if (!l) map.set(kk, l = []); l.push(k); }
    }
    return { map, cell, key };
  }
  // 线段与三角形求交（Möller–Trumbore）
  function segTri(o, d, p, a, b, c) {
    const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2], e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
    const hx = d[1] * e2z - d[2] * e2y, hy = d[2] * e2x - d[0] * e2z, hz = d[0] * e2y - d[1] * e2x;
    const det = e1x * hx + e1y * hy + e1z * hz; if (Math.abs(det) < 1e-9) return null;
    const f = 1 / det, sx = o[0] - p[a], sy = o[1] - p[a + 1], sz = o[2] - p[a + 2];
    const u = f * (sx * hx + sy * hy + sz * hz); if (u < 0 || u > 1) return null;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = f * (d[0] * qx + d[1] * qy + d[2] * qz); if (v < 0 || u + v > 1) return null;
    const tt = f * (e2x * qx + e2y * qy + e2z * qz); if (tt < 0 || tt > 1) return null;
    return { t: tt, u, v };
  }

  // ---------- 模拟 ----------
  function sigOf(layer, ctx) {
    const comp = ctx.comp, ids = new Set();
    const P = layer.particles;
    for (const e of P.emitters) if (e.layer) ids.add(e.layer);
    for (const c of P.colliders) if (c.layer) ids.add(c.layer);
    for (const f of P.forces) if (f.layer) ids.add(f.layer);
    const addDeps = (id, d = 0) => { const l = E.layer(comp, id); if (!l || d > 6) return; if (l.parent) { ids.add(l.parent); addDeps(l.parent, d + 1); } if (l.geo && l.geo.source.from && l.geo.source.from.layer) { ids.add(l.geo.source.from.layer); addDeps(l.geo.source.from.layer, d + 1); } };
    for (const id of Array.from(ids)) addDeps(id);
    const parts = [AE.Model.serialize(layer.particles), layer.inPoint, layer.outPoint, JSON.stringify(Array.from(ids).map(id => { const l = E.layer(comp, id); return l ? AE.Model.serialize(l) : ''; })), AE.Model.serialize(comp.graph), comp.fps, ctx.inst.key, E.project.seed];
    if (ctx.inst.ovr) parts.push(JSON.stringify(Array.from(ctx.inst.ovr.entries()).map(([k, o]) => [k, AE.Model.serialize(o.prop), ctx.inst.outerT])));
    return parts.join('#');
  }
  function getCache(layer, ctx) {
    const caches = layer._ps || (layer._ps = new Map());
    let c = caches.get(ctx.inst.key);
    if (!c || c.rev !== E.rev) {
      const sig = sigOf(layer, ctx);
      if (!c || c.sig !== sig) { c = { sig, checkpoints: [], work: null, rev: E.rev }; caches.set(ctx.inst.key, c); PS.stats.resets++; }
      c.rev = E.rev;
    }
    return c;
  }
  PS.invalidate = (layer) => { if (layer._ps) layer._ps.clear(); };
  PS.CHECK_EVERY = 0.25;

  function stepSim(s, layer, ctx, dt, gc) {
    const memo = (key, tt, fn) => { const k = key + '@' + tt.toFixed(6); if (gc.has(k)) return gc.get(k); const v = fn(); gc.set(k, v); if (gc.size > 48) gc.delete(gc.keys().next().value); return v; };
    const Pp = layer.particles, comp = ctx.comp;
    const t0 = layer.inPoint + s.t, t1 = t0 + dt;
    const V = (p, tt) => E.prop(p, tt === undefined ? t0 : tt, ctx, layer);
    const seed = Pp.seed + U.strSeed(layer.id) % 1000 + (E.project.seed % 997);
    // 发射
    Pp.emitters.forEach((em, ei) => {
      if (em.on === false) return;
      const rate = Math.max(0, V(em.rate));
      let acc = (s.emitAcc[ei] || 0) + rate * dt;
      let count = Math.floor(acc); acc -= count; s.emitAcc[ei] = acc;
      for (const b of em.bursts || []) { if (b.t >= s.t && b.t < s.t + dt) count += b.count; }
      if (!count) return;
      const SQ = 1 / 30, tq = Math.round(t0 / SQ) * SQ; // 源几何按 1/30 秒取样（确定性）
      const src = memo('em' + ei, tq, () => emitterSource(em, layer, tq, ctx)); if (!src) return;
      const srcPrev = em.inherit && V(em.inherit) > 0 ? memo('em' + ei, tq - SQ, () => emitterSource(em, layer, tq - SQ, ctx)) : null;
      const sp = V(em.speed), spread = V(em.spread) * U.deg, life = V(em.life), drag = V(em.drag), inh = V(em.inherit);
      const dir0 = U.norm(V(em.direction).map((x, i) => x || (i === 1 ? 1e-6 : 0)));
      const c = em.color ? V(em.color) : null;
      for (let k = 0; k < count; k++) {
        const pidx = s.nextId, h = (n) => U.hash(seed, ei, pidx, n);
        const smp = sampleSource(src, h(1), h(2), h(3)); if (!smp) continue;
        let dir = em.useNormal && smp.n ? smp.n : dir0;
        // 圆锥扩散
        const ang = spread * Math.sqrt(h(4)), az = h(5) * Math.PI * 2;
        const ortho = Math.abs(dir[1]) < 0.9 ? U.norm(U.cross(dir, [0, 1, 0])) : U.norm(U.cross(dir, [1, 0, 0]));
        const ortho2 = U.cross(dir, ortho);
        const d = U.norm(U.add(U.scale(dir, Math.cos(ang)), U.add(U.scale(ortho, Math.sin(ang) * Math.cos(az)), U.scale(ortho2, Math.sin(ang) * Math.sin(az)))));
        const speed = sp * (1 + (h(6) * 2 - 1) * (em.speedRand || 0));
        let v = U.scale(d, speed);
        if (srcPrev && inh) { const sp2 = sampleSource(srcPrev, h(1), h(2), h(3)); if (sp2) v = U.add(v, U.scale(U.sub(smp.p, sp2.p), inh / SQ)); }
        // 步内错开，避免成团
        const sub = (k + 0.5) / count;
        const p = U.add(smp.p, U.scale(v, dt * (1 - sub)));
        spawn(s, p, v, life * (1 + (h(7) * 2 - 1) * (em.lifeRand || 0)), (em.mass || 1) * (1 + (h(8) * 2 - 1) * (em.massRand || 0)), (em.size || 1) * (1 + (h(9) * 2 - 1) * (em.sizeRand || 0)), h(10), 0, ei, c && (c[0] !== 1 || c[1] !== 1 || c[2] !== 1) ? c : null);
      }
    });
    // 力
    const forces = Pp.forces.filter(f => f.on !== false).map(f => {
      const o = { type: f.type, str: V(f.strength) };
      if (f.direction) o.dir = U.norm(V(f.direction));
      if (f.position) { o.pos = f.layer ? (() => { const l = E.layer(comp, f.layer); if (!l) return V(f.position); const W = E.world(l, t0, ctx); return [W[12], W[13], W[14]]; })() : V(f.position); o.r = V(f.radius); o.k = V(f.falloff); }
      if (f.axis) o.ax = U.norm(V(f.axis));
      if (f.type === 'noise') { o.sc = Math.max(1, V(f.noiseScale)); o.sp = V(f.speed); }
      if (f.type === 'field' && f.field && AE.Fields) o.fld = AE.Fields.named(comp, f.field, t0, ctx);
      return o;
    });
    // 碰撞体（t0 与 t1 两个时刻，得到表面速度）
    const cols = Pp.colliders.filter(c => c.on !== false).map((c, ci) => {
      const g0 = memo('co' + ci, t0, () => colliderGeom(c, layer, t0, ctx)); if (!g0) return null;
      const o = { c, g: g0, bounce: V(c.bounce), fric: V(c.friction), ev: c.event ? Pp.events.find(e => e.id === c.event && e.on !== false) : null };
      if (g0.kind === 'mesh') {
        const g1 = memo('co' + ci, t1, () => colliderGeom(c, layer, t1, ctx));
        o.m1 = g1 && g1.m.pos.length === g0.m.pos.length ? g1.m : g0.m;
        // 以 t1 网格做哈希
        let L = 0, nt = Math.min(200, o.m1.idx.length / 3); for (let k = 0; k < nt; k++) { const a = o.m1.idx[3 * k] * 3, b = o.m1.idx[3 * k + 1] * 3; L += Math.hypot(o.m1.pos[b] - o.m1.pos[a], o.m1.pos[b + 1] - o.m1.pos[a + 1], o.m1.pos[b + 2] - o.m1.pos[a + 2]); }
        o.hash = o.m1._hash || (o.m1._hash = buildHash(o.m1, Math.max(10, L / Math.max(1, nt) * 2)));
      } else if (g0.kind === 'plane') { const g1 = memo('co' + ci, t1, () => colliderGeom(c, layer, t1, ctx)); o.g1 = g1 || g0; }
      return o;
    }).filter(Boolean);
    const look = Pp.look;
    const newSpawns = [];
    for (let i = 0; i < s.n; i++) {
      const px = s.pos[3 * i], py = s.pos[3 * i + 1], pz = s.pos[3 * i + 2];
      let ax = 0, ay = 0, az = 0;
      const im = 1 / Math.max(0.01, s.mass[i]);
      for (const f of forces) {
        if (f.type === 'gravity') { ax += f.dir[0] * f.str; ay += f.dir[1] * f.str; az += f.dir[2] * f.str; }
        else if (f.type === 'direction') { ax += f.dir[0] * f.str * im; ay += f.dir[1] * f.str * im; az += f.dir[2] * f.str * im; }
        else if (f.type === 'attract') { const dx = f.pos[0] - px, dy = f.pos[1] - py, dz = f.pos[2] - pz, d = Math.hypot(dx, dy, dz) || 1; const w = U.clamp(1 - d / f.r, 0, 1); const k = f.str * Math.pow(w, f.k) * im / d; ax += dx * k; ay += dy * k; az += dz * k; }
        else if (f.type === 'vortex') { const dx = px - f.pos[0], dy = py - f.pos[1], dz = pz - f.pos[2], d = Math.hypot(dx, dy, dz) || 1; const w = Math.pow(U.clamp(1 - d / f.r, 0, 1), f.k); const cx = f.ax[1] * dz - f.ax[2] * dy, cy = f.ax[2] * dx - f.ax[0] * dz, cz = f.ax[0] * dy - f.ax[1] * dx, cl = Math.hypot(cx, cy, cz) || 1; const k = f.str * w * im / cl; ax += cx * k; ay += cy * k; az += cz * k; }
        else if (f.type === 'noise') { const c = U.curl3(px / f.sc, py / f.sc, pz / f.sc, t0 * f.sp); ax += c[0] * f.str * im; ay += c[1] * f.str * im; az += c[2] * f.str * im; }
        else if (f.type === 'field' && f.fld) { const v = f.fld.v([px, py, pz]); ax += v[0] * f.str * im; ay += v[1] * f.str * im; az += v[2] * f.str * im; }
      }
      const em = Pp.emitters[s.em[i]] || Pp.emitters[0];
      const drag = em ? Math.max(0, V(em.drag)) : 0;
      const damp = Math.exp(-drag * dt);
      let vx = (s.vel[3 * i] + ax * dt) * damp, vy = (s.vel[3 * i + 1] + ay * dt) * damp, vz = (s.vel[3 * i + 2] + az * dt) * damp;
      let nx = px + vx * dt, ny = py + vy * dt, nz = pz + vz * dt;
      // 碰撞
      for (const co of cols) {
        let hit = null;
        if (co.g.kind === 'plane') {
          const pl0 = co.g, pl1 = co.g1;
          const d0 = (px - pl0.p[0]) * pl0.n[0] + (py - pl0.p[1]) * pl0.n[1] + (pz - pl0.p[2]) * pl0.n[2];
          const d1 = (nx - pl1.p[0]) * pl1.n[0] + (ny - pl1.p[1]) * pl1.n[1] + (nz - pl1.p[2]) * pl1.n[2];
          if (d0 >= -1e-3 && d1 < 0) { const f = d0 / (d0 - d1 || 1); hit = { p: [px + (nx - px) * f, py + (ny - py) * f, pz + (nz - pz) * f], n: pl1.n, sv: U.scale(U.sub(pl1.p, pl0.p), 1 / dt) }; }
        } else if (co.g.kind === 'mesh') {
          const m1 = co.m1, m0 = co.g.m, hs = co.hash, cell = hs.cell;
          const o = [px, py, pz], d = [nx - px, ny - py, nz - pz];
          const x0 = Math.floor(Math.min(px, nx) / cell), x1 = Math.floor(Math.max(px, nx) / cell), y0 = Math.floor(Math.min(py, ny) / cell), y1 = Math.floor(Math.max(py, ny) / cell), z0 = Math.floor(Math.min(pz, nz) / cell), z1 = Math.floor(Math.max(pz, nz) / cell);
          if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 64) continue;
          let best = null, bt = 2, bk = -1;
          for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
            const l = hs.map.get(hs.key(x, y, z)); if (!l) continue;
            for (const k of l) { const r = segTri(o, d, m1.pos, m1.idx[3 * k] * 3, m1.idx[3 * k + 1] * 3, m1.idx[3 * k + 2] * 3); if (r && r.t < bt) { bt = r.t; best = r; bk = k; } }
          }
          if (best) {
            const a = m1.idx[3 * bk] * 3, b = m1.idx[3 * bk + 1] * 3, c = m1.idx[3 * bk + 2] * 3, w = 1 - best.u - best.v;
            const hp = [0, 1, 2].map(q => m1.pos[a + q] * w + m1.pos[b + q] * best.u + m1.pos[c + q] * best.v);
            // 几何法线（面法线），朝向来流方向
            const e1 = [m1.pos[b] - m1.pos[a], m1.pos[b + 1] - m1.pos[a + 1], m1.pos[b + 2] - m1.pos[a + 2]], e2 = [m1.pos[c] - m1.pos[a], m1.pos[c + 1] - m1.pos[a + 1], m1.pos[c + 2] - m1.pos[a + 2]];
            let n = U.norm(U.cross(e1, e2)); if (U.dot(n, d) > 0) n = U.scale(n, -1);
            const sv = m0 !== m1 ? [0, 1, 2].map(q => ((m1.pos[a + q] - m0.pos[a + q]) * w + (m1.pos[b + q] - m0.pos[b + q]) * best.u + (m1.pos[c + q] - m0.pos[c + q]) * best.v) / dt) : [0, 0, 0];
            hit = { p: hp, n, sv };
          }
        }
        if (hit) {
          // 相对速度反弹 + 摩擦
          const rv = [vx - hit.sv[0], vy - hit.sv[1], vz - hit.sv[2]];
          const vn = U.dot(rv, hit.n);
          if (vn < 0) {
            const vnv = U.scale(hit.n, vn), vt = U.sub(rv, vnv);
            const out = U.add(U.scale(vt, 1 - co.fric), U.scale(vnv, -co.bounce));
            vx = out[0] + hit.sv[0]; vy = out[1] + hit.sv[1]; vz = out[2] + hit.sv[2];
          }
          nx = hit.p[0] + hit.n[0] * 0.6; ny = hit.p[1] + hit.n[1] * 0.6; nz = hit.p[2] + hit.n[2] * 0.6;
          const ev = co.ev;
          if (ev && (!ev.once || !s.hit[i])) {
            s.events++;
            if (ev.setColor) { const c = V(ev.color); s.col[4 * i] = c[0]; s.col[4 * i + 1] = c[1]; s.col[4 * i + 2] = c[2]; s.col[4 * i + 3] = c[3] === undefined ? 1 : c[3]; s.hasCol[i] = 1; }
            const ls = V(ev.lifeScale); if (ls !== 1) s.life[i] = s.age[i] + (s.life[i] - s.age[i]) * ls;
            const imp = V(ev.impulse); vx += imp[0]; vy += imp[1]; vz += imp[2];
            const ns = s.gen[i] === 0 ? Math.round(V(ev.spawn)) : 0;
            if (ns > 0) newSpawns.push({ p: [nx, ny, nz], n: hit.n, v: [vx, vy, vz], cnt: ns, ev, id: s.id[i], col: s.hasCol[i] ? [s.col[4 * i], s.col[4 * i + 1], s.col[4 * i + 2], s.col[4 * i + 3]] : null });
          }
          s.hit[i] = 1;
        }
      }
      s.pos[3 * i] = nx; s.pos[3 * i + 1] = ny; s.pos[3 * i + 2] = nz;
      s.vel[3 * i] = vx; s.vel[3 * i + 1] = vy; s.vel[3 * i + 2] = vz;
      s.age[i] += dt;
    }
    // 次级发射
    for (const sp of newSpawns) {
      for (let k = 0; k < sp.cnt; k++) {
        const h = (n) => U.hash(seed, 777, sp.id, k, n);
        const dir = U.norm(U.add(U.scale(sp.n, 0.7 + h(1) * 0.6), [(h(2) - 0.5) * 1.6, (h(3) - 0.5) * 1.6, (h(4) - 0.5) * 1.6]));
        const v = U.add(U.scale(dir, V(sp.ev.spawnSpeed) * (0.5 + h(5) * 0.8)), U.scale(sp.v, 0.25));
        spawn(s, sp.p, v, V(sp.ev.spawnLife) * (0.6 + h(6) * 0.8), 0.4, (sp.ev.spawnSize || 0.5) * (0.6 + h(7) * 0.8), h(8), 1, 0, sp.col || V(sp.ev.color));
      }
    }
    // 死亡
    for (let i = s.n - 1; i >= 0; i--) if (s.age[i] >= s.life[i]) kill(s, i);
    // 轨迹
    for (let i = 0; i < s.n; i++) {
      const h = s.trH[i], o = (i * TRAIL_N + h) * 3;
      s.tr[o] = s.pos[3 * i]; s.tr[o + 1] = s.pos[3 * i + 1]; s.tr[o + 2] = s.pos[3 * i + 2];
      s.trH[i] = (h + 1) % TRAIL_N; if (s.trN[i] < TRAIL_N) s.trN[i]++;
    }
    s.t += dt; s.step++;
    PS.stats.steps++;
  }
  // 推进到时刻 lt（图层局部时间）
  function advance(layer, ctx, cache, lt) {
    const rate = layer.particles.step || 60, dt = 1 / rate;
    const target = Math.max(0, Math.floor(lt * rate + 1e-6));
    let s = null;
    if (cache.work && cache.work.step <= target) s = cache.work;
    else {
      let cp = null; for (const c of cache.checkpoints) if (c.step <= target && (!cp || c.step > cp.step)) cp = c;
      s = cp ? cloneState(cp) : newState(layer.particles.max || 4000);
    }
    const every = Math.max(1, Math.round(PS.CHECK_EVERY * rate));
    const gc = cache.geo || (cache.geo = new Map());
    const t0 = performance.now();
    while (s.step < target) {
      stepSim(s, layer, ctx, dt, gc);
      if (s.step % every === 0 && !cache.checkpoints.some(c => c.step === s.step)) {
        cache.checkpoints.push(cloneState(s));
        if (cache.checkpoints.length > 160) cache.checkpoints.splice(1, 1);
      }
    }
    PS.stats.lastMs = performance.now() - t0;
    cache.work = s;
    return s;
  }
  // 公开：时刻 t 的可视状态
  PS.state = (layer, t, ctx) => {
    if (!layer.particles) return null;
    const lt = t - layer.inPoint;
    if (lt < 0) return null;
    const cache = getCache(layer, ctx);
    const rate = layer.particles.step || 60;
    const s = advance(layer, ctx, cache, lt);
    const frac = lt - s.step / rate; // 步内余量（外推，子帧取样用）
    const Pp = layer.particles, look = Pp.look, n = s.n;
    const out = { count: n, pos: new Float32Array(n * 3), col: new Float32Array(n * 4), size: new Float32Array(n), rot: new Float32Array(n), axis: new Float32Array(n * 3), ids: new Float32Array(n), ages: new Float32Array(n), lifes: new Float32Array(n), trails: null, events: s.events };
    const spin = E.prop(look.spin, t, ctx, layer);
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < 3; d++) out.pos[3 * i + d] = s.pos[3 * i + d] + s.vel[3 * i + d] * frac;
      const lf = U.clamp((s.age[i] + frac) / Math.max(1e-3, s.life[i]), 0, 1);
      let c = U.gradient(look.colorLife, lf);
      if (s.hasCol[i]) c = [s.col[4 * i] * (0.5 + 0.5 * c[0]), s.col[4 * i + 1] * (0.5 + 0.5 * c[1]), s.col[4 * i + 2] * (0.5 + 0.5 * c[2]), c[3]];
      const oa = U.curve(look.opacityLife, lf);
      out.col[4 * i] = c[0]; out.col[4 * i + 1] = c[1]; out.col[4 * i + 2] = c[2]; out.col[4 * i + 3] = (c[3] === undefined ? 1 : c[3]) * oa;
      out.size[i] = s.size[i] * U.curve(look.sizeLife, lf) * (s.gen[i] ? 0.8 : 1);
      out.rot[i] = s.seed[i] * 6.283 + spin * U.deg * (s.age[i] + frac) * (s.seed[i] > 0.5 ? 1 : -1);
      const a = U.norm([s.seed[i] - 0.5, 0.7, U.hash(s.id[i], 3) - 0.5]); out.axis.set(a, 3 * i);
      out.ids[i] = s.id[i]; out.ages[i] = s.age[i]; out.lifes[i] = s.life[i];
    }
    const tr = Pp.trail;
    if (tr && tr.on) {
      const len = Math.max(0.02, E.prop(tr.length, t, ctx, layer)), K = Math.min(TRAIL_N, Math.max(2, Math.round(len * rate)));
      out.trails = [];
      for (let i = 0; i < n; i++) {
        const cnt = Math.min(s.trN[i], K); if (cnt < 2) continue;
        const pts = new Float32Array((cnt + 1) * 3);
        for (let k = 0; k < cnt; k++) { const h = (s.trH[i] - cnt + k + TRAIL_N * 2) % TRAIL_N, o = (i * TRAIL_N + h) * 3; pts[3 * k] = s.tr[o]; pts[3 * k + 1] = s.tr[o + 1]; pts[3 * k + 2] = s.tr[o + 2]; }
        pts[3 * cnt] = out.pos[3 * i]; pts[3 * cnt + 1] = out.pos[3 * i + 1]; pts[3 * cnt + 2] = out.pos[3 * i + 2];
        out.trails.push({ pts, col: [out.col[4 * i], out.col[4 * i + 1], out.col[4 * i + 2], 1], a: out.col[4 * i + 3], w: s.gen[i] ? 0.6 : 1 });
      }
    }
    return out;
  };
  // 运行统计
  PS.info = (layer, ctx) => { const c = layer._ps && layer._ps.get(ctx.inst.key); return c ? { checkpoints: c.checkpoints.length, count: c.work ? c.work.n : 0, events: c.work ? c.work.events : 0, t: c.work ? c.work.t : 0 } : null; };
  PS.recompute = (layer) => { PS.invalidate(layer); };
})(typeof window !== 'undefined' ? window : globalThis);
