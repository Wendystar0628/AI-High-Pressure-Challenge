/* PRISM deterministic particle simulation: emitters, fields, collisions, events, trails */
(function () {
  const AE = window.AE, U = AE.U, M = AE.M, Mesh = AE.Mesh, P = AE.P, E = AE.Eval;
  const Pt = (AE.Particles = {});
  const DT = 1 / 60;

  function layerSeed(project, layer) { return (project.seed || 0) * 131 + U.hash(layer.id) * 7; }

  Pt.simulate = function (comp, layer, time, ctx, sources) {
    const key = simulationKey(comp, layer, ctx);
    const targetTick = Math.max(0, Math.floor(Math.max(0, time) / DT + 1e-6));
    let sim = layer._sim;
    if (!sim || sim.key !== key || targetTick < sim.tick) {
      sim = {
        key, simTime: 0, particles: [], nextId: 1, emitAcc: 0, trails: [], events: [], secondary: [],
        collisions: 0, emitted: 0, rng: U.seedRand(layerSeed(ctx.project, layer)), result: null,
        tick: 0, fields: [], cache: new Map()
      };
      layer._sim = sim;
    }
    const maxSteps = 2000;
    let steps = 0;
    // advance strictly on a fixed tick grid so query history cannot change the state
    while (sim.tick < targetTick && steps++ < maxSteps) {
      step(comp, layer, sim, ctx, sources, DT);
      sim.tick++;
      sim.simTime = sim.tick * DT;
    }
    sim.simTime = sim.tick * DT;
    sim.result = collect(sim, layer);
    return sim.result;
  };

  function simulationKey(comp, layer, ctx) {
    const p = layer.particles || {};
    const fieldIds = (p.fields || []).join(',');
    const params = ['rate', 'lifetime', 'speed', 'spread', 'mass', 'drag', 'gravity', 'size', 'sizeVar', 'emitterRadius', 'collision', 'restitution', 'seed', 'rotationSpeed', 'opacity']
      .map(k => layer.props['particle.' + k] ? E.interpBase(layer.props['particle.' + k], 0) : '').join('|');
    return `${comp.id}|${layer.id}|${ctx.project._rev || 0}|${params}|${p.emitter && p.emitter.layerId}|${p.collisionLayerId}|${fieldIds}|${ctx.project.seed}`;
  }

  function collect(sim, layer) {
    return {
      particles: sim.particles, trails: sim.trails, events: sim.events, collisions: sim.collisions,
      emitted: sim.emitted, count: sim.particles.length, simTime: sim.simTime,
      ticks: sim.tick, fields: sim.fields
    };
  }

  function step(comp, layer, sim, ctx, sources, dt) {
    const p = layer.particles;
    const ev = (k, d) => E.num(E.propValue(layer, 'particle.' + k, ctx, sim.simTime)) || d;
    const rate = Math.max(0, ev('rate', 0));
    const lifetime = Math.max(.05, ev('lifetime', 2));
    const speed = ev('speed', 200);
    const spread = U.rad(ev('spread', 50));
    const mass = Math.max(.01, ev('mass', 1));
    const drag = Math.max(0, ev('drag', .1));
    const gravity = ev('gravity', .3);
    const size = ev('size', 5);
    const sizeVar = ev('sizeVar', .5);
    const max = Math.round(E.num(E.propValue(layer, 'particle.max', ctx, sim.simTime)) || 1800);
    const emitter = p.emitter || { type: 'point' };
    // collect fields at sim time
    const fields = [];
    for (const fid of (p.fields || [])) {
      const fl = comp.layers.find(l => l.id === fid && l.type === 'field');
      if (fl) fields.push(E.fieldState(comp, fl, E.makeCtx(ctx.project, comp, sim.simTime), sim.simTime));
    }
    sim.fields = fields;
    let src = null;
    try {
      if (emitter.layerId && sources && sources.getSource) src = sources.getSource(emitter.layerId, sim.simTime);
      else if (emitter.type === 'point') src = { points: [[emitter.x || 0, emitter.y || 0, emitter.z || 0]] };
    } catch (e) { src = null; }
    // emission
    sim.emitAcc += rate * dt;
    const emitCount = Math.min(60, Math.floor(sim.emitAcc));
    sim.emitAcc -= emitCount;
    for (let n = 0; n < emitCount; n++) {
      if (sim.particles.length >= max) break;
      const rnd = U.seedRand(layerSeed(ctx.project, layer) + sim.nextId * 7919 + Math.floor(sim.simTime * 1000) * 13);
      const id = sim.nextId++;
      let pos, normal = null;
      if (src && src.mesh && src.mesh.pos && src.mesh.pos.length) {
        const sample = sampleMesh(src.mesh, rnd);
        pos = sample.pos; normal = sample.normal;
      } else if (src && src.paths && src.paths.length) {
        const all = [];
        for (const path of src.paths) for (const pt of path) all.push(pt);
        const pt = all[Math.floor(rnd() * all.length) % Math.max(1, all.length)] || [0, 0, 0];
        pos = [pt[0], pt[1], pt[2] || 0];
      } else if (src && src.points && src.points.length) {
        const pt = src.points[Math.floor(rnd() * src.points.length) % src.points.length];
        pos = [pt[0], pt[1], pt[2] || 0];
      } else {
        const ang = rnd() * Math.PI * 2, r = emitter.radius || ev('emitterRadius', 200) * Math.sqrt(rnd());
        pos = [Math.cos(ang) * r, Math.sin(ang) * r, (rnd() - .5) * (emitter.depth || 0)];
      }
      let dir;
      if (normal) {
        dir = M.norm([normal[0] + (rnd() - .5) * .4, normal[1] + (rnd() - .5) * .4, normal[2] + (rnd() - .5) * .4]);
      } else {
        const a = rnd() * Math.PI * 2, z = (rnd() - .5) * 2;
        dir = [Math.cos(a) * Math.sqrt(1 - z * z), Math.sin(a) * Math.sqrt(1 - z * z), z];
      }
      // cone spread around direction
      const sp = Math.sin(spread) * (rnd() - .5), az = rnd() * Math.PI * 2;
      dir = M.norm([dir[0] + Math.cos(az) * sp, dir[1] + Math.sin(az) * sp, dir[2] + Math.sin(az) * sp * .5]);
      const spd = speed * (0.6 + rnd() * .8);
      sim.particles.push({
        id, p: pos, v: [dir[0] * spd, dir[1] * spd, dir[2] * spd],
        age: 0, life: lifetime * (.7 + rnd() * .6), seed: rnd(), size: size * (1 + (rnd() - .5) * 2 * sizeVar),
        rot: rnd() * Math.PI * 2, rotV: (rnd() - .5) * 2 * (E.num(E.propValue(layer, 'particle.rotationSpeed', ctx, sim.simTime)) || 0),
        colorT: rnd(), event: false, type: 0, hist: [pos.slice()], hit: 0, state: 'alive'
      });
      sim.emitted++;
    }
    // collider
    let collider = null;
    if (p.collisionLayerId && sources && sources.getSource) {
      try { collider = sources.getSource(p.collisionLayerId, sim.simTime); } catch (e) { collider = null; }
    }
    let tris = null;
    if (collider && collider.mesh && layer.props['particle.collision'] && E.num(E.propValue(layer, 'particle.collision', ctx, sim.simTime)) > 0) {
      if (!sim.colliderCache) sim.colliderCache = new Map();
      const ck = sim.tick;
      if (!sim.colliderCache.has(ck)) {
        tris = Mesh.triangles(collider.mesh, collider.matrix);
        const bbox = Mesh.computeBBox(collider.mesh);
        sim.colliderCache.set(ck, { tris, bbox });
        if (sim.colliderCache.size > 8) sim.colliderCache.delete(sim.colliderCache.keys().next().value);
      } else { const c = sim.colliderCache.get(ck); tris = c.tris; }
    }
    const restitution = E.num(E.propValue(layer, 'particle.restitution', ctx, sim.simTime)) || .45;
    const friction = E.num(E.propValue(layer, 'particle.friction', ctx, sim.simTime)) || .6;
    const eventColor = (layer.particles.events && layer.particles.events.color) || [.4, 1, .9, 1];
    // update
    for (let i = sim.particles.length - 1; i >= 0; i--) {
      const q = sim.particles[i];
      q.age += dt;
      if (q.age >= q.life) { sim.particles.splice(i, 1); continue; }
      let ax = 0, ay = gravity * 60, az = 0;
      for (const f of fields) {
        const d = Mesh.fieldAt(f, q.p, sim.simTime);
        const k = .55;
        ax += d[0] * k; ay += d[1] * k; az += d[2] * k;
      }
      // drag
      ax -= q.v[0] * drag * 4; ay -= q.v[1] * drag * 4; az -= q.v[2] * drag * 4;
      q.v[0] += ax * dt / mass; q.v[1] += ay * dt / mass; q.v[2] += az * dt / mass;
      q.p[0] += q.v[0] * dt; q.p[1] += q.v[1] * dt; q.p[2] += q.v[2] * dt;
      q.rot += q.rotV * dt;
      // collision
      if (tris && q.hit <= 0) {
        const col = Mesh.collideSphere(q.p, Math.max(2, q.size * .45), tris, q.v);
        if (col) {
          q.p = M.add(col.point, M.mul(col.normal, Math.max(2, q.size * .5)));
          const vn = M.dot(q.v, col.normal);
          const vnV = M.mul(col.normal, vn), vt = M.sub(q.v, vnV);
          q.v = M.add(M.mul(vt, friction), M.mul(col.normal, -vn * restitution));
          // impulse outward + event
          q.event = true;
          q.hit = .35;
          q.life = Math.min(q.life, q.age + .55 + q.seed * .4);
          q.v = M.add(q.v, M.mul(col.normal, 55 + q.seed * 60));
          sim.collisions++;
          if (sim.events.length < 32) sim.events.push({ t: sim.simTime, p: q.p.slice(), n: col.normal.slice(), color: eventColor });
          if (layer.particles.events && layer.particles.events.enabled !== false && sim.particles.length < max) {
            const sec = Math.min(4, layer.particles.events.secondary || 2);
            for (let s = 0; s < sec; s++) {
              const rr = U.seedRand(Math.floor(sim.simTime * 10000) + q.id * 13 + s * 7);
              const dir = M.norm([col.normal[0] + (rr() - .5) * 1.4, col.normal[1] + (rr() - .5) * 1.4, col.normal[2] + (rr() - .5) * 1.4]);
              sim.particles.push({
                id: sim.nextId++, p: q.p.slice(), v: M.mul(dir, 80 + rr() * 160),
                age: 0, life: .35 + rr() * .5, seed: rr(), size: q.size * (.4 + rr() * .5),
                rot: rr() * 6, rotV: (rr() - .5) * 6, colorT: .9, event: true, type: 1, hist: [q.p.slice()], hit: 0, state: 'alive'
              });
              sim.emitted++;
            }
          }
        }
      }
      if (q.hit > 0) q.hit -= dt;
      // trail history (every other tick for speed)
      if (sim.tick % 2 === 0) {
        q.hist.push([q.p[0], q.p[1], q.p[2]]);
        const maxHist = Math.max(3, Math.round(E.num(E.propValue(layer, 'particle.trailLength', ctx, sim.simTime)) || layer.particles.trails.length || 12));
        if (q.hist.length > maxHist) q.hist.shift();
      }
      if (q.p[1] > 4000 || Math.abs(q.p[0]) > 8000) { sim.particles.splice(i, 1); }
    }
    if (sim.events.length > 32) sim.events.splice(0, sim.events.length - 32);
  }

  function sampleMesh(mesh, rnd) {
    const n = mesh.idx.length / 3;
    const tri = Math.floor(rnd() * n) * 3;
    const ia = mesh.idx[tri] * 3, ib = mesh.idx[tri + 1] * 3, ic = mesh.idx[tri + 2] * 3;
    let a = [mesh.pos[ia], mesh.pos[ia + 1], mesh.pos[ia + 2]];
    let b = [mesh.pos[ib], mesh.pos[ib + 1], mesh.pos[ib + 2]];
    let c = [mesh.pos[ic], mesh.pos[ic + 1], mesh.pos[ic + 2]];
    let u = rnd(), v = rnd();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    const pos = [a[0] * w + b[0] * u + c[0] * v, a[1] * w + b[1] * u + c[1] * v, a[2] * w + b[2] * u + c[2] * v];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = M.norm(M.cross(e1, e2));
    return { pos, normal };
  }

  Pt.particleColor = (layer, q, ctx, time) => {
    const t = U.clamp(q.age / q.life);
    const cA = U.colorArr(E.propValue(layer, 'particle.colorA', ctx, time));
    const cB = U.colorArr(E.propValue(layer, 'particle.colorB', ctx, time));
    let col = U.lerpColor(cA, cB, U.easeOut(t));
    if (q.event) {
      const evc = (layer.particles.events && layer.particles.events.color) || [.4, 1, .9, 1];
      col = U.lerpColor(col, U.colorArr(evc), .85);
    }
    const fadeIn = U.clamp(t * 10), fadeOut = U.clamp((1 - t) * 3.2);
    col[3] = U.clamp(col[3]) * fadeIn * fadeOut;
    return col;
  };
  Pt.reset = (layer) => { layer._sim = null; };
  AE.Particles = Pt;
})();
