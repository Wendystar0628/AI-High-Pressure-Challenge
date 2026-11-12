'use strict';
// ============ 粒子：确定性固定步长模拟、快照缓存、碰撞与次级发射 ============
const Particles = {
  DT: 1 / 60, SNAP: 30, TRAIL: 24,
  caches: new Map(), srcCache: new WeakMap(),
  ev(p, comp, L, t) { return Anim.evalProp(p, comp, L, t); },
  // ---- 依赖签名（只在工程版本变化时重算） ----
  sig(comp, L) {
    const ids = new Set([L.id]);
    const walk = g => { for (const n of g.nodes) { for (const k in n.p) { const d = (NodeTypes[n.type].params || {})[k]; if (d && d.t === 'layer' && n.p[k]) ids.add(n.p[k]); } if (n.sub) walk(n.sub); } };
    walk(comp.graph);
    for (const id of L.ps.fields) ids.add(id); for (const id of L.ps.collide.layers) ids.add(id); for (const e of L.ps.emitters) if (e.srcLayer) ids.add(e.srcLayer);
    // 父级链
    for (const id of [...ids]) { let x = Model.findLayer(comp, id); let g = 0; while (x && x.parent && g++ < 20) { ids.add(x.parent); x = Model.findLayer(comp, x.parent); } }
    const parts = [...ids].sort().map(id => { const x = Model.findLayer(comp, id); return x ? Model.json(x) : ''; });
    return U.hash(parts.join('|') + Model.json(comp.graph) + comp.fps);
  },
  cache(comp, L) {
    let c = this.caches.get(L.id);
    if (c && c.ver === Anim.version) return c;
    const s = this.sig(comp, L);
    if (!c || c.sig !== s) { c = { sig: s, snaps: new Map(), cur: null, ver: Anim.version, stats: { steps: 0 } }; this.caches.set(L.id, c); }
    c.ver = Anim.version; return c;
  },
  invalidateAll() { this.caches.clear(); },
  newState(cap) {
    const f = () => new Float32Array(cap);
    return { n: 0, cap, k: -1, px: f(), py: f(), pz: f(), vx: f(), vy: f(), vz: f(), age: f(), life: f(), sz: f(), hit: new Float32Array(cap).fill(-1), id: new Float64Array(cap), em: new Int16Array(cap),
      tr: new Float32Array(cap * this.TRAIL * 3), trN: new Uint8Array(cap), acc: [], spawn: [], subSpawn: 0, events: 0 };
  },
  cloneState(s) {
    const o = { n: s.n, cap: s.cap, k: s.k, acc: s.acc.slice(), spawn: s.spawn.slice(), subSpawn: s.subSpawn, events: s.events };
    for (const key of ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'age', 'life', 'sz', 'hit', 'id', 'em', 'tr', 'trN']) o[key] = s[key].slice();
    return o;
  },
  // ---- 取得第 k 步的状态（不重复推进） ----
  stepState(comp, L, k) {
    const c = this.cache(comp, L);
    if (c.cur && c.cur.k === k) return c.cur;
    let st = null;
    if (c.cur && c.cur.k < k && k - c.cur.k < 600) st = c.cur;
    else {
      let best = -1; for (const sk of c.snaps.keys()) if (sk <= k && sk > best) best = sk;
      st = best >= 0 ? this.cloneState(c.snaps.get(best)) : null;
      if (c.cur && c.cur.k < k && c.cur.k > best) st = c.cur;
    }
    if (!st) { st = this.newState(Math.max(16, L.ps.max | 0)); st.k = -1; }
    if (st === c.cur) { /* 继续推进 */ } else st = st === c.cur ? st : st;
    while (st.k < k) {
      this.step(comp, L, st, st.k + 1);
      c.stats.steps++;
      if (st.k % this.SNAP === 0 && !c.snaps.has(st.k)) c.snaps.set(st.k, this.cloneState(st));
    }
    c.cur = st; return st;
  },
  // ---- 单步 ----
  colliders(comp, L, t) {
    const out = [];
    for (const cons of NodeEval.consumers(comp, 'collider')) {
      if (cons.node.p.layer && cons.node.p.layer !== L.id) continue;
      let g; try { g = NodeEval.consumerInput(comp, t, cons, 'geo'); } catch (e) { continue; }
      if (!g || !g.mesh) continue;
      const S = Model.findLayer(comp, cons.node.p.space); const M = S ? Xform.layerMatrix(comp, S, t) : M4.ident();
      out.push({ key: 'n' + cons.node.id, mesh: g.mesh, M });
    }
    for (const id of L.ps.collide.layers) {
      const C = Model.findLayer(comp, id); if (!C || !Render.active(C, t)) continue;
      let mesh = null; if (C.type === 'geo') mesh = Scene.layerMesh(comp, C, t);
      else if (C.type === 'solid') { const w = C.solid.w, h = C.solid.h; mesh = Geo3D.mesh([0, 0, 0, w, 0, 0, w, h, 0, 0, h, 0], [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1], [0, 1, 2, 0, 2, 3]); }
      if (mesh) out.push({ key: 'l' + id, mesh, M: Xform.layerMatrix(comp, C, t) });
    }
    return out;
  },
  worldMesh(cache, col) {
    const g = cache.wms || (cache.wms = new Map());
    const msig = col.mesh.uid + ':' + Array.from(col.M).map(x => x.toFixed(3)).join(',');
    let wm = g.get(msig); if (!wm) { wm = Geo3D.transform(col.mesh, col.M); if (g.size > 12) g.clear(); g.set(msig, wm); }
    return { wm, msig };
  },
  gridFor(cache, col, prevCol) {
    const g = cache.grids || (cache.grids = new Map());
    const cur = this.worldMesh(cache, col), prev = prevCol ? this.worldMesh(cache, prevCol) : null;
    const key = col.key + '|' + cur.msig + '|' + (prev ? prev.msig : '');
    let e = g.get(col.key);
    if (e && e.key === key) return e.grid;
    const grid = Geo3D.grid(cur.wm, prev && prev.msig !== cur.msig && prev.wm.pos.length === cur.wm.pos.length ? prev.wm : null);
    g.set(col.key, { key, grid }); return grid;
  },
  emitSource(comp, L, em, ei, t) {
    if (em.kind === 'geometry') {
      const cons = NodeEval.consumers(comp, 'emitter').find(c => c.node.p.layer === L.id && (c.node.p.em | 0) === ei);
      if (!cons) return null;
      let g, F; try { g = NodeEval.consumerInput(comp, t, cons, 'geo'); F = NodeEval.consumerInput(comp, t, cons, 'field'); } catch (e) { return null; }
      if (!g || !g.mesh) return null;
      const S = Model.findLayer(comp, cons.node.p.space); const M = S ? Xform.layerMatrix(comp, S, t) : M4.ident();
      const key = g.mesh.uid + (F ? F.sig : '') + Array.from(M).join(',');
      let sc = this.srcCache.get(em);
      if (!sc || sc.key !== key) { const C = Geo3D.cdf(g.mesh, F ? p => Math.max(0, F.sample(M4.pt(M, p)).w) : null); sc = { key, C }; this.srcCache.set(em, sc); }
      return { kind: 'geo', mesh: g.mesh, C: sc.C, M, NM: M4.invert(M) };
    }
    if (em.kind === 'curve') {
      const S = Model.findLayer(comp, em.srcLayer); if (!S) return null;
      let polys = []; if (S.type === 'shape') polys = Shapes.allPolys(comp, S, t).map(p => p.pts); else if (S.type === 'text') polys = TextL.polys(comp, S, t);
      if (!polys.length) return null; const M = Xform.layerMatrix(comp, S, t);
      const lens = polys.map(p => Geo2D.polyLen(p, true)); return { kind: 'curve', polys, lens, tot: lens.reduce((a, b) => a + b, 0), M };
    }
    return { kind: 'point', M: Xform.layerMatrix(comp, L, t), pos: this.ev(em.pos, comp, L, t) };
  },
  step(comp, L, st, k) {
    const S = L.ps; const dt = this.DT; const t = L.inPoint - (S.prewarm || 0) + k * dt; const e = p => this.ev(p, comp, L, t);
    const cache = this.caches.get(L.id);
    const g = e(S.gravity), wind = e(S.wind), drag = Math.max(0, e(S.drag));
    const att = S.attract, attS = e(att.strength), attP = attS ? e(att.pos) : null, attR = attS ? Math.max(1, e(att.radius)) : 1;
    // 场力
    const fieldForces = [];
    for (const cons of NodeEval.consumers(comp, 'particleField')) { if (cons.node.p.layer !== L.id) continue; try { const F = NodeEval.consumerInput(comp, t, cons, 'field'); const s = NodeEval.consumerInput(comp, t, cons, 'strength'); if (F) fieldForces.push({ F, s: s ?? 300 }); } catch (er) { } }
    const fs = e(S.fieldStrength) / 100 * 300;
    for (const id of S.fields) { const F = Fields.fromLayer(comp, Model.findLayer(comp, id), t); if (F) fieldForces.push({ F, s: fs }); }
    // ---- 积分 ----
    const n0 = st.n; const damp = Math.exp(-drag * dt);
    const cols = st.n ? this.colliders(comp, L, t) : [];
    const prevCols = st.n ? this.colliders(comp, L, t - dt) : [];
    const grids = cols.map(c => this.gridFor(cache, c, prevCols.find(q => q.key === c.key)));
    const C = S.collide; const bounce = e(C.bounce), fric = e(C.friction), gy = C.ground ? e(C.groundY) : null;
    const hitLifeK = e(C.hitLife) / 100; const subN = C.subCount | 0; const subSpeed = e(C.subSpeed);
    const births = [];
    for (let i = 0; i < st.n; i++) {
      let ax = g[0] + wind[0], ay = g[1] + wind[1], az = g[2] + wind[2];
      const p = [st.px[i], st.py[i], st.pz[i]];
      if (attS) { const d = V3.sub(attP, p); const l = V3.len(d) || 1; const f = attS * Math.max(0, 1 - l / attR); ax += d[0] / l * f; ay += d[1] / l * f; az += d[2] / l * f; }
      for (const ff of fieldForces) { const s = ff.F.sample(p); ax += s.v[0] * ff.s; ay += s.v[1] * ff.s; az += s.v[2] * ff.s; }
      let vx = (st.vx[i] + ax * dt) * damp, vy = (st.vy[i] + ay * dt) * damp, vz = (st.vz[i] + az * dt) * damp;
      let nx = p[0] + vx * dt, ny = p[1] + vy * dt, nz = p[2] + vz * dt;
      // 碰撞
      let hit = null;
      if (gy !== null && ny > gy && p[1] <= gy + 0.01) { const f = (gy - p[1]) / ((ny - p[1]) || 1); hit = { p: [p[0] + (nx - p[0]) * f, gy, p[2] + (nz - p[2]) * f], n: [0, -1, 0], t: f }; }
      for (const G of grids) { const h = Geo3D.raycast(G, p, [nx, ny, nz]); if (h && (!hit || h.t < hit.t)) hit = h; }
      if (hit) {
        let n = hit.n; const v = [vx, vy, vz]; const sv = hit.disp ? V3.mul(hit.disp, 1 / dt) : [0, 0, 0];
        let rel = V3.sub(v, sv); if (V3.dot(rel, n) > 0) n = V3.mul(n, -1);
        const vn = V3.mul(n, V3.dot(rel, n)), vt = V3.sub(rel, vn);
        const out = V3.add(V3.add(V3.mul(vn, -bounce), V3.mul(vt, 1 - fric)), sv);
        vx = out[0]; vy = out[1]; vz = out[2];
        nx = hit.p[0] + n[0] * 0.6; ny = hit.p[1] + n[1] * 0.6; nz = hit.p[2] + n[2] * 0.6;
        // 事件：只在模拟推进时触发一次
        if (st.hit[i] < 0) { st.hit[i] = st.age[i]; st.events++; if (C.onHit === 'life' || C.onHit === 'both') st.life[i] = st.age[i] + (st.life[i] - st.age[i]) * hitLifeK; }
        if (subN > 0 && st.em[i] >= 0 && births.length < 400) for (let s = 0; s < subN; s++) births.push({ p: [nx, ny, nz], n, v: out, pid: st.id[i], s });
      }
      st.vx[i] = vx; st.vy[i] = vy; st.vz[i] = vz; st.px[i] = nx; st.py[i] = ny; st.pz[i] = nz;
      st.age[i] += dt;
    }
    // 移除死亡
    let w = 0;
    for (let i = 0; i < st.n; i++) {
      if (st.age[i] >= st.life[i]) continue;
      if (w !== i) this.move(st, i, w);
      w++;
    }
    st.n = w;
    // 次级发射
    for (const b of births) {
      if (st.n >= st.cap) break;
      const j = st.n++; const sid = st.subSpawn++;
      const r = q => U.rand01(S.seed, 9999, sid, q);
      const dir = V3.norm(V3.add(b.n, [(r(1) - 0.5) * 1.6, (r(2) - 0.5) * 1.6, (r(3) - 0.5) * 1.6]));
      const sp = subSpeed * (0.5 + r(4));
      this.init(st, j, b.p, V3.add(V3.mul(dir, sp), V3.mul(b.v, 0.2)), 0.25 + r(5) * 0.45, 0.55, -1, 1e9 + sid);
      st.hit[j] = 0;
    }
    // ---- 发射 ----
    S.emitters.forEach((em, ei) => {
      if (!em.on) return;
      if (st.acc[ei] === undefined) { st.acc[ei] = 0; st.spawn[ei] = 0; }
      const rate = Math.max(0, this.ev(em.rate, comp, L, t));
      st.acc[ei] += rate * dt; let cnt = Math.floor(st.acc[ei]); st.acc[ei] -= cnt;
      if (!cnt) return;
      const src = this.emitSource(comp, L, em, ei, t); if (!src) return;
      const prevSrc = src.kind === 'point' ? this.emitSource(comp, L, em, ei, t - dt) : null;
      const speed = this.ev(em.speed, comp, L, t), sr = this.ev(em.speedRand, comp, L, t) / 100, life = this.ev(em.life, comp, L, t), lr = this.ev(em.lifeRand, comp, L, t) / 100;
      const spread = U.rad(this.ev(em.spread, comp, L, t)), dir0 = V3.norm(this.ev(em.dir, comp, L, t)), inh = this.ev(em.inherit, comp, L, t) / 100, szr = this.ev(em.sizeRand, comp, L, t) / 100;
      for (let q = 0; q < cnt && st.n < st.cap; q++) {
        const id = st.spawn[ei]++; const r = m => U.rand01(S.seed, ei, id, m);
        let p, base = dir0, ev = [0, 0, 0];
        const frac = r(9);
        if (src.kind === 'point') {
          const a = M4.pt(src.M, src.pos), b0 = prevSrc ? M4.pt(prevSrc.M, prevSrc.pos) : a;
          p = V3.lerp(b0, a, frac); ev = V3.mul(V3.sub(a, b0), 1 / dt * inh); base = V3.norm(M4.dir(src.M, dir0));
        } else if (src.kind === 'geo') {
          const s = Geo3D.sample(src.mesh, src.C, r(1), r(2), r(3)); if (!s) continue;
          p = M4.pt(src.M, s.p); const wn = V3.norm([src.NM[0] * s.n[0] + src.NM[1] * s.n[1] + src.NM[2] * s.n[2], src.NM[4] * s.n[0] + src.NM[5] * s.n[1] + src.NM[6] * s.n[2], src.NM[8] * s.n[0] + src.NM[9] * s.n[1] + src.NM[10] * s.n[2]]);
          base = em.useNormal ? V3.norm(V3.add(wn, V3.mul(dir0, 0.6))) : dir0;
        } else {
          let d = r(1) * src.tot, pi = 0; while (pi < src.lens.length - 1 && d > src.lens[pi]) { d -= src.lens[pi]; pi++; }
          const pa = Geo2D.pointAt(src.polys[pi], true, d); p = M4.pt(src.M, [pa.p[0], pa.p[1], 0]);
          if (em.useNormal) base = V3.norm(M4.dir(src.M, [-pa.t[1], pa.t[0], 0]));
        }
        // 锥形扩散
        const ang = spread * Math.sqrt(r(4)), rot = r(5) * Math.PI * 2;
        const tmp = Math.abs(base[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const u = V3.norm(V3.cross(base, tmp)), v = V3.cross(base, u);
        const d = V3.norm(V3.add(V3.mul(base, Math.cos(ang)), V3.add(V3.mul(u, Math.sin(ang) * Math.cos(rot)), V3.mul(v, Math.sin(ang) * Math.sin(rot)))));
        const sp = speed * (1 + (r(6) - 0.5) * 2 * sr);
        const vel = V3.add(V3.mul(d, sp), ev);
        const lf = Math.max(0.02, life * (1 + (r(7) - 0.5) * 2 * lr));
        const j = st.n++;
        this.init(st, j, V3.add(p, V3.mul(vel, dt * frac)), vel, lf, 1 + (r(8) - 0.5) * 2 * szr, ei, ei * 1e7 + id);
        st.age[j] = dt * frac;
      }
    });
    // 拖尾记录
    const T = this.TRAIL;
    for (let i = 0; i < st.n; i++) { const c = st.trN[i]; const base = i * T * 3; if (c >= T) st.tr.copyWithin(base, base + 3, base + T * 3); const k2 = Math.min(c, T - 1); st.tr[base + k2 * 3] = st.px[i]; st.tr[base + k2 * 3 + 1] = st.py[i]; st.tr[base + k2 * 3 + 2] = st.pz[i]; st.trN[i] = Math.min(T, c + 1); }
    st.k = k;
  },
  init(st, j, p, v, life, sz, em, id) { st.px[j] = p[0]; st.py[j] = p[1]; st.pz[j] = p[2]; st.vx[j] = v[0]; st.vy[j] = v[1]; st.vz[j] = v[2]; st.age[j] = 0; st.life[j] = life; st.sz[j] = sz; st.em[j] = em; st.id[j] = id; st.hit[j] = -1; st.trN[j] = 0; },
  move(st, i, w) {
    for (const key of ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'age', 'life', 'sz', 'hit', 'id', 'em', 'trN']) st[key][w] = st[key][i];
    const T = this.TRAIL * 3; st.tr.copyWithin(w * T, i * T, i * T + T);
  },
  // ---- 渲染状态（时刻 t，可为任意小数，按速度外推，不推进模拟） ----
  state(comp, L, t) {
    if (t < L.inPoint || t >= L.outPoint) return null;
    const rel = (t - L.inPoint + (L.ps.prewarm || 0)) / this.DT; const k = Math.floor(rel + 1e-6); const f = (rel - k) * this.DT;
    const st = this.stepState(comp, L, k);
    const S = L.ps; const e = p => this.ev(p, comp, L, t);
    const size = e(S.look.size), sizeE = e(S.look.sizeEnd), c0 = e(S.look.c0), c1 = e(S.look.c1), o0 = e(S.look.op0) / 100, o1 = e(S.look.op1) / 100, hc = e(S.collide.hitColor);
    const hitColor = S.collide.onHit === 'color' || S.collide.onHit === 'both';
    const n = st.n; const inst = new Float32Array(n * 8);
    const trailOn = S.trail.on; const tlen = trailOn ? e(S.trail.length) : 0; const tN = Math.min(this.TRAIL, Math.round(tlen / this.DT));
    const trails = trailOn ? [] : null;
    for (let i = 0; i < n; i++) {
      const u = U.clamp((st.age[i] + f) / st.life[i], 0, 1);
      const x = st.px[i] + st.vx[i] * f, y = st.py[i] + st.vy[i] * f, z = st.pz[i] + st.vz[i] * f;
      let col = U.vecLerp(c0, c1, u); if (hitColor && st.hit[i] >= 0) col = U.vecLerp(col, hc, U.clamp(1 - (st.age[i] - st.hit[i]) * 2, 0.35, 1));
      const a = U.lerp(o0, o1, u); const s = U.lerp(size, sizeE, u) * st.sz[i] * 0.5;
      inst.set([x, y, z, s, col[0], col[1], col[2], a], i * 8);
      if (trails && tN > 1) { const c = st.trN[i]; const m = Math.min(c, tN); const pts = []; const base = i * this.TRAIL * 3; for (let q = c - m; q < c; q++) pts.push([st.tr[base + q * 3], st.tr[base + q * 3 + 1], st.tr[base + q * 3 + 2]]); pts.push([x, y, z]); trails.push({ pts, c: col, a }); }
    }
    return { n, inst, trails, events: st.events, step: st.k };
  },
};
