/* ============================================================
   particles.js — 确定性粒子模拟、力场、网格碰撞、次级发射与拖尾
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const G = AE.geom;
  const P = AE.particles = {};

  const SIM_FPS = 60;
  const SIM_DT = 1 / SIM_FPS;

  P.SIM_FPS = SIM_FPS;

  // ---------------- 图层网格获取（挤出实体 / 平面） ----------------
  function sample(p, t, layer, ctx) { return p ? A.sample(p, t, layer, ctx) : 0; }

  function geometrySignature(layer, t, ctx) {
    const parts = [layer.id, layer.type, AE.app ? AE.app.project.version : 0];
    const ext = layer.extrude || {};
    parts.push(ext.enabled ? 1 : 0);
    parts.push(U.round(A.n(sample(ext.depth, t, layer, ctx)), 2));
    parts.push(U.round(A.n(sample(ext.bevel, t, layer, ctx)), 2));
    if (layer.type === 'text') {
      const p = AE.text.layerParams(layer, t);
      parts.push(p.text, p.font, p.fontSize, p.tracking, p.lineHeight, p.align, p.weight);
    } else if (layer.type === 'shape') {
      for (const op of (layer.shape.ops || [])) {
        parts.push(op.type, op.enabled === false ? 0 : 1, op.op || '');
        for (const k in op) {
          if (op[k] && op[k]._id) {
            const v = A.sample(op[k], t, layer, ctx);
            parts.push(k, U.round(A.n(v), 2), v && v.x !== undefined ? U.round(v.x, 2) + ':' + U.round(v.y, 2) : '');
          }
        }
        if (op.type === 'path') parts.push(JSON.stringify(op.contours).length);
      }
    } else if (layer.type === 'node3d' || layer.nodes) {
      parts.push(layer.nodes ? layer.nodes.nodes.length : 0);
    }
    for (const pin of (layer.pins || [])) {
      if (!pin.enabled) continue;
      for (const key of ['position', 'target', 'rotation', 'scale', 'radius', 'strength']) {
        const v = pin[key] ? A.sample(pin[key], t, layer, ctx) : 0;
        parts.push(key, U.round(A.n(v), 2), v && v.x !== undefined ? U.round(v.x, 2) + ':' + U.round(v.y, 2) : '');
      }
    }
    const flds = G.resolveFields(layer, t, ctx);
    for (const f of flds) parts.push(f._cacheKey);
    const warp = layer.warp || {};
    for (const key of ['bend', 'twist']) parts.push(U.round(A.n(sample(warp[key], t, layer, ctx)), 2));
    return parts.join('|');
  }

  function localMesh(layer, t, ctx) {
    let contours = [];
    if (layer.type === 'shape') contours = G.evalShapeLayer(layer, t, { ctx });
    else if (layer.type === 'text') contours = AE.text.layerContours(layer, t);
    else if (layer.type === 'node3d' || layer.nodes) {
      const outs = AE.nodes.displayGeometry(layer, t);
      contours = [];
      for (const o of outs) contours = contours.concat(o.contours.map(c => ({ closed: c.closed, alpha: c.alpha, pts: c.pts.map(p => G.pt(p.x, p.y, p.ix, p.iy, p.ox, p.oy)) })));
    }
    if (!contours.length) return null;
    const ext = layer.extrude || {};
    let depth = A.n(sample(ext.depth, t, layer, ctx));
    let bevel = A.n(sample(ext.bevel, t, layer, ctx));
    if (layer.nodes) {
      const outs = AE.nodes.displayGeometry(layer, t);
      for (const o of outs) {
        if (o.depth !== null && o.depth !== undefined) depth = o.depth;
        if (o.bevel !== null && o.bevel !== undefined) bevel = o.bevel;
      }
    }
    const fields = G.resolveFields(layer, t, ctx);
    const pins = G.resolvePins(layer, t, ctx);
    let mesh;
    if (ext.enabled || (layer.nodes && contours.length)) {
      if (fields.length || pins.length) contours = G.deformContours(contours, pins, fields, t);
      mesh = G.extrudeContours(contours, { depth: Math.max(0.5, depth || 30), bevel: bevel || 0 });
    } else {
      if (fields.length || pins.length) contours = G.deformContours(contours, pins, fields, t);
      // 平面轮廓网格（双面）
      const tris = [];
      const groups = G.groupContours(contours).groups;
      for (const grp of groups) {
        const cap = G.triangulateGroup(grp.outer.poly, grp.holes.map(h => h.poly));
        for (const tri of cap) {
          tris.push(tri.map(p => ({ x: p.x, y: p.y, z: 0 })));
          tris.push([tri[2], tri[1], tri[0]].map(p => ({ x: p.x, y: p.y, z: 0 })));
        }
      }
      if (!tris.length) return null;
      const arr = [];
      for (const tri of tris) arr.push(tri);
      // 复用 finalize 逻辑
      const meshTmp = G.extrudeContours(contours, { depth: 0.5, bevel: 0 });
      mesh = meshTmp;
    }
    return mesh;
  }

  P.meshForLayer = function (layer, t, useCache) {
    if (!layer || !layer._comp) return null;
    const ctx = A.newCtx(layer._comp, layer, t);
    const M = A.worldMatrix(layer, t, ctx);
    const sig = geometrySignature(layer, t, ctx) + '|M' + Array.from(M).map(v => U.round(v, 2)).join(',');
    if (useCache !== false && layer._meshCache && layer._meshCache.sig === sig) return layer._meshCache.world;
    const lm = localMesh(layer, t, ctx);
    if (!lm) { layer._meshCache = { sig, world: null }; return null; }
    const tris = lm.flatTris.map(tr => {
      const a = U.m4.applyPoint(M, tr.a), b = U.m4.applyPoint(M, tr.b), c = U.m4.applyPoint(M, tr.c);
      let n = U.vnorm(U.m4.applyDir(M, tr.n));
      if (!isFinite(n.x) || !isFinite(n.y) || !isFinite(n.z) || U.vlen(n) < 1e-6) {
        n = U.vnorm(U.vcross(U.vsub(b, a), U.vsub(c, a)));
      }
      return { a, b, c, n, local: tr };
    });
    const posData = new Float32Array(tris.length * 9);
    const nrmData = new Float32Array(tris.length * 9);
    let wi = 0;
    for (const tr of tris) {
      for (const p of [tr.a, tr.b, tr.c]) {
        posData[wi] = p.x; posData[wi + 1] = p.y; posData[wi + 2] = p.z;
        nrmData[wi] = tr.n.x; nrmData[wi + 1] = tr.n.y; nrmData[wi + 2] = tr.n.z;
        wi += 3;
      }
    }
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const tr of tris) for (const p of [tr.a, tr.b, tr.c]) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
    }
    const world = { tris, bounds: { x0, y0, z0, x1, y1, z1 }, matrix: M, sig, posData, nrmData, primCount: tris.length * 3 };
    layer._meshCache = { sig, world };
    return world;
  };

  // ---------------- 碰撞网格加速 ----------------
  function buildGrid(mesh, cellSize) {
    if (!mesh) return null;
    const cs = cellSize || 90;
    const grid = new Map();
    const tris = mesh.tris;
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      const xs = [t.a.x, t.b.x, t.c.x], ys = [t.a.y, t.b.y, t.c.y], zs = [t.a.z, t.b.z, t.c.z];
      const ix0 = Math.floor(Math.min(...xs) / cs), ix1 = Math.floor(Math.max(...xs) / cs);
      const iy0 = Math.floor(Math.min(...ys) / cs), iy1 = Math.floor(Math.max(...ys) / cs);
      const iz0 = Math.floor(Math.min(...zs) / cs), iz1 = Math.floor(Math.max(...zs) / cs);
      const countX = ix1 - ix0 + 1, countY = iy1 - iy0 + 1, countZ = iz1 - iz0 + 1;
      if (countX * countY * countZ > 800) {
        // 大三角形放入全局
        if (!grid.has('*')) grid.set('*', []);
        grid.get('*').push(i);
        continue;
      }
      for (let ix = ix0; ix <= ix1; ix++) for (let iy = iy0; iy <= iy1; iy++) for (let iz = iz0; iz <= iz1; iz++) {
        const k = ix + ',' + iy + ',' + iz;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
    }
    return { grid, cellSize: cs, bounds: mesh.bounds };
  }

  function segTri(orig, dir, tri) {
    // Möller–Trumbore，dir 为线段向量，t 在 0..1
    const e1x = tri.b.x - tri.a.x, e1y = tri.b.y - tri.a.y, e1z = tri.b.z - tri.a.z;
    const e2x = tri.c.x - tri.a.x, e2y = tri.c.y - tri.a.y, e2z = tri.c.z - tri.a.z;
    const px = dir.y * e2z - dir.z * e2y, py = dir.z * e2x - dir.x * e2z, pz = dir.x * e2y - dir.y * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-9) return null;
    const inv = 1 / det;
    const tx = orig.x - tri.a.x, ty = orig.y - tri.a.y, tz = orig.z - tri.a.z;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) return null;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (dir.x * qx + dir.y * qy + dir.z * qz) * inv;
    if (v < 0 || u + v > 1) return null;
    const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (tt < 1e-5 || tt > 1) return null;
    return tt;
  }

  function collideMesh(mesh, grid, p0, p1, radius) {
    if (!mesh || !grid) return null;
    const b = mesh.bounds;
    const minx = Math.min(p0.x, p1.x) - radius, maxx = Math.max(p0.x, p1.x) + radius;
    const miny = Math.min(p0.y, p1.y) - radius, maxy = Math.max(p0.y, p1.y) + radius;
    const minz = Math.min(p0.z, p1.z) - radius, maxz = Math.max(p0.z, p1.z) + radius;
    if (maxx < b.x0 || minx > b.x1 || maxy < b.y0 || miny > b.y1 || maxz < b.z0 || minz > b.z1) return null;
    const cs = grid.cellSize;
    const dir = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
    const candidates = new Set();
    const ix0 = Math.floor(minx / cs), ix1 = Math.floor(maxx / cs);
    const iy0 = Math.floor(miny / cs), iy1 = Math.floor(maxy / cs);
    const iz0 = Math.floor(minz / cs), iz1 = Math.floor(maxz / cs);
    let n = 0;
    for (let ix = ix0; ix <= ix1 && n < 2400; ix++) for (let iy = iy0; iy <= iy1 && n < 2400; iy++) for (let iz = iz0; iz <= iz1 && n < 2400; iz++) {
      const cell = grid.grid.get(ix + ',' + iy + ',' + iz);
      if (cell) for (const idx of cell) { candidates.add(idx); n++; }
    }
    const glob = grid.grid.get('*');
    if (glob) for (const idx of glob) candidates.add(idx);
    let best = null;
    for (const idx of candidates) {
      const tri = mesh.tris[idx];
      const tt = segTri(p0, dir, tri);
      if (tt !== null && (!best || tt < best.t)) {
        const hit = { x: p0.x + dir.x * tt, y: p0.y + dir.y * tt, z: p0.z + dir.z * tt };
        let nrm = tri.n;
        // 朝向入射方向
        const dot = U.vdot(nrm, dir);
        if (dot > 0) nrm = { x: -nrm.x, y: -nrm.y, z: -nrm.z };
        best = { t: tt, x: hit.x, y: hit.y, z: hit.z, n: nrm, tri };
      }
    }
    return best;
  }

  // ---------------- 采样工具 ----------------
  function randSeed(layer, extra) {
    return U.hashStr((layer.id || 'p') + '|' + (layer.particle.seed || 1) + '|' + extra);
  }
  function rand(rng, a, b) { return a + (b - a) * rng(); }

  function randomCone(dir, spreadRad, rng) {
    const d = U.vnorm(dir);
    const up = Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const u = U.vnorm(U.vcross(up, d));
    const v = U.vcross(d, u);
    const cosA = 1 - rng() * (1 - Math.cos(spreadRad));
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const phi = rng() * Math.PI * 2;
    return U.vnorm({
      x: d.x * cosA + (u.x * Math.cos(phi) + v.x * Math.sin(phi)) * sinA,
      y: d.y * cosA + (u.y * Math.cos(phi) + v.y * Math.sin(phi)) * sinA,
      z: d.z * cosA + (u.z * Math.cos(phi) + v.z * Math.sin(phi)) * sinA
    });
  }

  function sampleContourPoint(contours, rng) {
    const segs = [];
    let total = 0;
    for (const c of contours) {
      const poly = G.flattenContour(c, 1);
      const pts = c.closed ? poly.concat([poly[0]]) : poly;
      for (let i = 1; i < pts.length; i++) {
        const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (l > 1e-6) { segs.push({ a: pts[i - 1], b: pts[i], l }); total += l; }
      }
    }
    if (!segs.length) return null;
    let d = rng() * total;
    for (const s of segs) {
      if (d <= s.l) {
        const f = d / s.l;
        return { x: U.lerp(s.a.x, s.b.x, f), y: U.lerp(s.a.y, s.b.y, f), tx: (s.b.x - s.a.x) / s.l, ty: (s.b.y - s.a.y) / s.l, z: 0 };
      }
      d -= s.l;
    }
    return null;
  }

  function sampleSurface(mesh, rng) {
    if (!mesh || !mesh.tris.length) return null;
    // 面积加权
    let total = 0;
    const areas = new Float64Array(mesh.tris.length);
    for (let i = 0; i < mesh.tris.length; i++) {
      const tr = mesh.tris[i];
      const ab = U.vsub(tr.b, tr.a), ac = U.vsub(tr.c, tr.a);
      const ar = U.vlen(U.vcross(ab, ac)) * 0.5;
      areas[i] = ar; total += ar;
    }
    if (total <= 0) return null;
    let r = rng() * total, idx = 0;
    for (; idx < areas.length - 1; idx++) { if (r <= areas[idx]) break; r -= areas[idx]; }
    const tr = mesh.tris[Math.max(0, Math.min(idx, mesh.tris.length - 1))];
    let u = rng(), v = rng();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    return {
      x: tr.a.x + (tr.b.x - tr.a.x) * u + (tr.c.x - tr.a.x) * v,
      y: tr.a.y + (tr.b.y - tr.a.y) * u + (tr.c.y - tr.a.y) * v,
      z: tr.a.z + (tr.b.z - tr.a.z) * u + (tr.c.z - tr.a.z) * v,
      nx: tr.n.x, ny: tr.n.y, nz: tr.n.z
    };
  }

  // ---------------- 模拟 ----------------
  const SIMS = new Map();

  function simKey(layer) {
    const part = layer.particle;
    return [layer.id, AE.app ? AE.app.project.version : 0, part.seed, part.emitters.length].join('|');
  }

  function resetSim(sim) {
    sim.step = -1;
    sim.particles = [];
    sim.spawnCounter = 0;
    sim.emitterAcc = sim.emitters.map(() => 0);
    sim.burstIdx = sim.emitters.map(() => 0);
    sim.lastTime = -1;
  }

  function getSim(layer) {
    const key = simKey(layer);
    let sim = SIMS.get(layer.id);
    if (!sim || sim.key !== key) {
      sim = {
        key, step: -1, particles: [], spawnCounter: 0, emitterAcc: [], burstIdx: [],
        emitters: layer.particle.emitters, layerId: layer.id, lastTime: -1
      };
      resetSim(sim);
      SIMS.set(layer.id, sim);
    }
    return sim;
  }

  P.invalidate = function (layerId) {
    if (layerId) SIMS.delete(layerId);
    else SIMS.clear();
  };

  function spawnParticle(layer, sim, emitter, t, pos, dir, speedMul, isSecondary, secOpts) {
    const part = layer.particle;
    const idx = sim.spawnCounter++;
    const rng = U.rng(randSeed(layer, idx + ':' + t.toFixed(3)));
    const ctx = layer._simCtx || A.newCtx(layer._comp, layer, t);
    const lifeBase = A.n(A.sample(part.lifetime, t, layer, ctx)) || 1;
    const life = Math.max(0.05, lifeBase * rand(rng, .72, 1.28) * (isSecondary && secOpts ? secOpts.life : 1));
    const speedBase = emitter.speed ? A.n(A.sample(emitter.speed, t, layer, ctx)) : 200;
    const speed = speedBase * rand(rng, 0.55, 1.3) * (speedMul || 1) * (isSecondary && secOpts ? secOpts.speed : 1);
    const spread = (emitter.spread ? A.n(A.sample(emitter.spread, t, layer, ctx)) : 20) * U.DEG;
    let direction = dir || { x: 0, y: 0, z: 1 };
    let v = randomCone(direction, spread, rng);
    const sizeBase = A.n(A.sample(part.size, t, layer, ctx)) || 4;
    const sizeRand = part.sizeRandom ? A.n(A.sample(part.sizeRandom, t, layer, ctx)) / 100 : 0.4;
    const p = {
      id: idx, age: 0, life,
      x: pos.x, y: pos.y, z: pos.z,
      vx: v.x * speed + (isSecondary && secOpts ? secOpts.vx || 0 : 0),
      vy: v.y * speed + (isSecondary && secOpts ? secOpts.vy || 0 : 0),
      vz: v.z * speed + (isSecondary && secOpts ? secOpts.vz || 0 : 0),
      size: sizeBase * rand(rng, 1 - sizeRand, 1 + sizeRand) * (isSecondary && secOpts ? secOpts.size || 1 : 1),
      seed: rng(),
      hit: false, secondary: !!isSecondary,
      emitter: emitter.id,
      trail: [{ x: pos.x, y: pos.y, z: pos.z }],
      color: isSecondary && secOpts ? secOpts.color : null
    };
    sim.particles.push(p);
    if (sim.inStep) sim._newborns.push(p);
    if (sim.particles.length > (part.maxParticles || 3000)) {
      // 丢弃最老的
      sim.particles.splice(0, sim.particles.length - (part.maxParticles || 3000));
    }
    return p;
  }

  function emitterWorld(layer, emitter, t) {
    const ctx = A.newCtx(layer._comp, layer, t);
    const pos = A.vec3(A.sample(emitter.position, t, layer, ctx));
    const M = A.worldMatrix(layer, t, ctx);
    const world = U.m4.applyPoint(M, pos);
    const dir = U.vnorm(U.m4.applyDir(M, A.vec3(A.sample(emitter.direction, t, layer, ctx))));
    return { pos: world, dir, M, ctx };
  }

  function stepSim(layer, sim, step) {
    const t = step / SIM_FPS;
    const prevT = (step - 1) / SIM_FPS;
    const part = layer.particle;
    sim.inStep = true;
    sim._newborns = [];
    const ctx = A.newCtx(layer._comp, layer, t);
    layer._simCtx = ctx;
    const dtn = SIM_DT;
    // 场
    const fields = (part.fieldIds || []).map(id => {
      const fl = layer._comp.layers.find(l => l.id === id);
      return fl && fl.enabled ? AE.fields.resolve(fl, t, ctx) : null;
    }).filter(Boolean);
    const gravity = part.gravity ? A.vec3(A.sample(part.gravity, t, layer, ctx)) : { x: 0, y: 0, z: 0 };
    const wind = part.wind ? A.vec3(A.sample(part.wind, t, layer, ctx)) : { x: 0, y: 0, z: 0 };
    const drag = part.drag ? A.n(A.sample(part.drag, t, layer, ctx)) : 0.2;
    const colliders = [];
    if (part.collisions && part.collisions.enabled) {
      for (const id of (part.collisions.colliders || [])) {
        const cl = layer._comp.layers.find(l => l.id === id);
        if (!cl || !cl.enabled) continue;
        const mesh = P.meshForLayer(cl, t);
        if (!mesh) continue;
        let cache = cl._collisionCache;
        if (!cache || cache.sig !== mesh.sig) {
          cache = { sig: mesh.sig, grid: buildGrid(mesh, 80) };
          cl._collisionCache = cache;
        }
        colliders.push({ layer: cl, mesh, grid: cache.grid });
      }
    }
    // 发射
    for (let ei = 0; ei < part.emitters.length; ei++) {
      const em = part.emitters[ei];
      if (em.enabled === false) continue;
      const ew = emitterWorld(layer, em, t);
      let sourceMesh = null, sourceContours = null;
      if (em.type === 'surface' || em.type === 'curve') {
        const src = layer._comp.layers.find(l => l.id === em.layerId);
        if (src) {
          if (em.type === 'surface') sourceMesh = P.meshForLayer(src, t);
          else {
            let cs = [];
            if (src.type === 'shape') cs = G.evalShapeLayer(src, t);
            else if (src.type === 'text') cs = AE.text.layerContours(src, t);
            const M = A.worldMatrix(src, t);
            sourceContours = cs.map(c => ({ closed: c.closed, alpha: c.alpha, pts: c.pts.map(p => {
              const w = U.m4.applyPoint(M, p);
              return G.pt(w.x, w.y, p.ix, p.iy, p.ox, p.oy);
            }) }));
          }
        }
      }
      const rate = em.rate ? Math.max(0, A.n(A.sample(em.rate, t, layer, ctx))) : 0;
      sim.emitterAcc[ei] += rate * dtn;
      while (sim.emitterAcc[ei] >= 1) {
        sim.emitterAcc[ei] -= 1;
        const rng = U.rng(randSeed(layer, 'emit' + ei + ':' + sim.spawnCounter));
        spawnFromEmitter(layer, sim, em, ew, sourceMesh, sourceContours, rng, t);
      }
      // 爆发
      const bursts = em.bursts || [];
      while (sim.burstIdx[ei] < bursts.length && bursts[sim.burstIdx[ei]].t <= t + 1e-6) {
        const b = bursts[sim.burstIdx[ei]];
        if (b.t > prevT - 1e-6) {
          const count = Math.max(0, Math.round(b.count));
          for (let i = 0; i < count; i++) {
            const rng = U.rng(randSeed(layer, 'burst' + ei + ':' + sim.burstIdx[ei] + ':' + i));
            spawnFromEmitter(layer, sim, em, ew, sourceMesh, sourceContours, rng, t, b.speed);
          }
        }
        sim.burstIdx[ei]++;
      }
    }
    // 更新粒子
    const active = sim.particles.slice();
    const newParticles = [];
    for (const p of active) {
      if (p.age > p.life) continue;
      p.age += dtn;
      if (p.age > p.life) { newParticles.push(p); continue; }
      let ax = gravity.x + wind.x, ay = gravity.y + wind.y, az = gravity.z + wind.z;
      for (const f of fields) {
        const acc = AE.fields.forceAt(f, p, t);
        ax += acc.x; ay += acc.y; az += acc.z;
      }
      p.vx += ax * dtn; p.vy += ay * dtn; p.vz += az * dtn;
      const damp = Math.exp(-drag * dtn);
      p.vx *= damp; p.vy *= damp; p.vz *= damp;
      const p0 = { x: p.x, y: p.y, z: p.z };
      let p1 = { x: p.x + p.vx * dtn, y: p.y + p.vy * dtn, z: p.z + p.vz * dtn };
      // 碰撞
      if (colliders.length) {
        let nearest = null;
        for (const c of colliders) {
          const hit = collideMesh(c.mesh, c.grid, p0, p1, p.size * 0.5);
          if (hit && (!nearest || hit.t < nearest.t)) { nearest = hit; nearest.collider = c; }
        }
        if (nearest) {
          const n = nearest.n;
          const vn = p.vx * n.x + p.vy * n.y + p.vz * n.z;
          const rest = part.collisions.restitution ? Math.max(0, Math.min(1, A.n(A.sample(part.collisions.restitution, t, layer, ctx)))) : 0.45;
          const fric = part.collisions.friction ? Math.max(0, Math.min(1, A.n(A.sample(part.collisions.friction, t, layer, ctx)))) : 0.3;
          if (vn < 0) {
            const tang = {
              x: p.vx - vn * n.x, y: p.vy - vn * n.y, z: p.vz - vn * n.z
            };
            const tv = Math.max(0, 1 - fric * (1 - Math.min(1, Math.abs(vn) / 300)));
            p.vx = (tang.x * tv - n.x * vn * rest);
            p.vy = (tang.y * tv - n.y * vn * rest);
            p.vz = (tang.z * tv - n.z * vn * rest);
            p1 = { x: nearest.x + n.x * 0.6, y: nearest.y + n.y * 0.6, z: nearest.z + n.z * 0.6 };
            if (!p.hit) {
              p.hit = true;
              if (part.collisions.colorOnHit) p.color = A.sample(part.collisions.colorOnHit, t, layer, ctx);
              if (part.collisions.lifeFactor) {
                const lf = A.n(A.sample(part.collisions.lifeFactor, t, layer, ctx)) / 100;
                p.life = p.age + Math.max(0.05, (p.life - p.age) * lf);
              }
              const sec = part.collisions.secondary;
              if (sec && sec.enabled && !p.secondary) {
                const cnt = Math.round(A.n(A.sample(sec.count, t, layer, ctx)));
                const speedMul = A.n(A.sample(sec.speed, t, layer, ctx)) / 100;
                for (let k = 0; k < cnt; k++) {
                  const srng = U.rng(randSeed(layer, 'sec' + p.id + ':' + step + ':' + k));
                  const dir = U.vnorm({ x: n.x + (srng() - .5) * 1.6, y: n.y + (srng() - .5) * 1.6, z: n.z + (srng() - .5) * 1.6 });
                  spawnParticle(layer, sim, { speed: { value: Math.max(60, (sec.speedBase || 260)) }, spread: { value: 50 }, direction: { value: dir } },
                    t, { x: p.x, y: p.y, z: p.z }, dir, speedMul, true, {
                      life: Math.max(0.1, A.n(A.sample(sec.life, t, layer, ctx))) / 1,
                      speed: 1,
                      color: A.sample(sec.color, t, layer, ctx),
                      size: 0.7
                    });
                }
              }
            }
          }
        }
      }
      p.x = p1.x; p.y = p1.y; p.z = p1.z;
      if (part.trails && part.trails.enabled) {
        p.trail.push({ x: p.x, y: p.y, z: p.z });
        if (p.trail.length > 48) p.trail.shift();
      }
      newParticles.push(p);
    }
    sim.particles = newParticles.concat(sim._newborns || []);
    if (sim.particles.length > (part.maxParticles || 3000)) {
      sim.particles.splice(0, sim.particles.length - (part.maxParticles || 3000));
    }
    sim.inStep = false;
    sim.step = step;
    sim.lastTime = t;
  }

  function spawnFromEmitter(layer, sim, em, ew, sourceMesh, sourceContours, rng, t, speedMul) {
    let pos = null, dir = ew.dir;
    if (em.type === 'curve' && sourceContours && sourceContours.length) {
      const c = sampleContourPoint(sourceContours, rng);
      if (c) {
        pos = { x: c.x, y: c.y, z: 0 };
        dir = U.vnorm({ x: c.tx + (rng() - .5) * .6, y: c.ty + (rng() - .5) * .6, z: (rng() - .5) * .4 });
      }
    } else if (em.type === 'surface' && sourceMesh) {
      const s = sampleSurface(sourceMesh, rng);
      if (s) {
        pos = { x: s.x, y: s.y, z: s.z };
        dir = U.vnorm({ x: s.nx + (rng() - .5) * .5, y: s.ny + (rng() - .5) * .5, z: s.nz + (rng() - .5) * .5 });
      }
    }
    if (!pos) {
      const rad = em.radius ? A.n(A.sample(em.radius, t, layer, ew.ctx)) : 0;
      pos = {
        x: ew.pos.x + (rng() - .5) * rad,
        y: ew.pos.y + (rng() - .5) * rad,
        z: ew.pos.z + (rng() - .5) * rad
      };
    }
    if (em.dirMode === 'normal' && sourceMesh) {
      // 保留表面法线方向；surface 分支已处理
    }
    return spawnParticle(layer, sim, em, t, pos, dir, speedMul, false);
  }

  P.ensureTime = function (layer, t) {
    if (!layer || !layer.particle) return null;
    const sim = getSim(layer);
    const step = Math.max(0, Math.round(t * SIM_FPS));
    const maxStep = Math.ceil(((layer._comp ? layer._comp.duration : 15) + 3) * SIM_FPS);
    const target = Math.min(step, maxStep);
    if (target < sim.step) {
      resetSim(sim);
      sim.emitters = layer.particle.emitters;
    }
    if (sim.step < 0) {
      // 从第 0 步开始
      sim.emitterAcc = layer.particle.emitters.map(() => 0);
      sim.burstIdx = layer.particle.emitters.map(() => 0);
      sim.step = -1;
    }
    let guard = 0;
    while (sim.step < target && guard++ < 20000) {
      stepSim(layer, sim, sim.step + 1);
    }
    return sim;
  };

  P.getSim = function (layer, t) { return P.ensureTime(layer, t); };

  // ---------------- 渲染数据 ----------------
  P.getRenderData = function (layer, t) {
    if (!layer || !layer.particle) return { particles: [], trails: [] };
    const sim = P.ensureTime(layer, t);
    if (!sim) return { particles: [], trails: [] };
    const ctx = A.newCtx(layer._comp, layer, t);
    const part = layer.particle;
    const c0 = A.sample(part.colorStart, t, layer, ctx) || '#ffd27a';
    const c1 = A.sample(part.colorMid, t, layer, ctx) || c0;
    const c2 = A.sample(part.colorEnd, t, layer, ctx) || '#ff4b12';
    const ramp = [];
    for (let i = 0; i < 12; i++) {
      const u = i / 11;
      const col = u < 0.5 ? U.mixColor(c0, c1, u * 2) : U.mixColor(c1, c2, (u - 0.5) * 2);
      ramp.push(U.rgb01(col));
    }
    const hitColor = part.collisions && part.collisions.colorOnHit ? U.rgb01(A.sample(part.collisions.colorOnHit, t, layer, ctx)) : [1, .8, .4];
    const sizeEnd = part.sizeEnd ? A.n(A.sample(part.sizeEnd, t, layer, ctx)) / Math.max(1, A.n(A.sample(part.size, t, layer, ctx))) : 0.4;
    const opStart = part.opacityStart ? A.n(A.sample(part.opacityStart, t, layer, ctx)) / 100 : 1;
    const opEnd = part.opacityEnd ? A.n(A.sample(part.opacityEnd, t, layer, ctx)) / 100 : 0;
    const opacity = U.clamp(A.n(A.sample(layer.transform.opacity, t, layer, ctx)), 0, 100) / 100;
    const particles = [];
    for (const p of sim.particles) {
      if (p.age > p.life) continue;
      const u = U.clamp(p.age / p.life, 0, 1);
      const col = p.color ? U.rgb01(p.color) : (p.hit ? hitColor : ramp[Math.min(11, Math.floor(u * 11))]);
      const size = Math.max(0.5, p.size * U.lerp(1, sizeEnd, u));
      const a = U.lerp(opStart, opEnd, u) * opacity;
      if (a <= 0.003) continue;
      particles.push({ x: p.x, y: p.y, z: p.z, size, color: col, alpha: a, age: u });
    }
    const trails = [];
    if (part.trails && part.trails.enabled) {
      const len = part.trails.length ? A.n(A.sample(part.trails.length, t, layer, ctx)) : 10;
      const n = U.clamp(Math.round(len * 10), 2, 48);
      const width = part.trails.width ? Math.max(0.2, A.n(A.sample(part.trails.width, t, layer, ctx))) : 2;
      const trailColor = part.trails.color ? U.rgb01(A.sample(part.trails.color, t, layer, ctx)) : [1, .55, .18];
      const fade = part.trails.opacity ? A.n(A.sample(part.trails.opacity, t, layer, ctx)) / 100 : 0.7;
      for (const p of sim.particles) {
        if (p.age > p.life || p.trail.length < 2) continue;
        const pts = p.trail.slice(-n);
        if (pts.length < 2) continue;
        const tr = [];
        for (let i = 0; i < pts.length; i++) {
          const f = i / (pts.length - 1);
          tr.push({ x: pts[i].x, y: pts[i].y, z: pts[i].z, a: f * f * fade * opacity, w: width * (0.25 + f * 0.75) });
        }
        trails.push({ points: tr, color: p.color ? U.rgb01(p.color) : (p.hit ? hitColor : trailColor) });
      }
    }
    return { particles, trails, simStep: sim.step };
  };

  // 给界面调用的统计
  P.stats = function (layer, t) {
    const sim = P.ensureTime(layer, t);
    return { alive: sim ? sim.particles.length : 0, step: sim ? sim.step : 0 };
  };

  P.reset = function () { SIMS.clear(); };

})(window);
