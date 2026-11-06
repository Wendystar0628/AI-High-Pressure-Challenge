import * as THREE from 'three';
import { GB, T, M } from '../core/builder.js';
import { U, WL, setLayers, rand, rr, srand, gustAt } from '../core/G.js';
import { MAT } from '../core/materials.js';
import { LAY, groundAt, seabedH } from './layout.js';
import { PROPS } from './props.js';

const tmpV = new THREE.Vector3();

// ======================= GULLS =======================
function gullModel() {
  // black-tailed gull (umineko): white body, slate-grey mantle, black primaries & tail band
  const root = new THREE.Group();
  const body = new GB();
  const white = { c: [0.98, 0.98, 0.97], t: T.PLAIN, w: 0.3, l: 1 };
  body.add(new THREE.CapsuleGeometry(0.072, 0.2, 6, 12), white, M(0, 0, 0, 0, 0, Math.PI / 2, 1, 0.92, 0.95));
  body.sphere(0.066, white, 0.2, 0.055, 0, 1.05, 0.95, 0.92, 12, 8);
  body.add(new THREE.ConeGeometry(0.017, 0.085, 6), { c: [0.98, 0.84, 0.25], l: 0.8 }, M(0.295, 0.045, 0, 0, 0, -Math.PI / 2 - 0.08));
  body.sphere(0.008, { c: [0.85, 0.15, 0.12], l: 0 }, 0.322, 0.038, 0, 1, 1, 1, 6, 4);
  body.sphere(0.011, { c: [0.08, 0.08, 0.08], l: 0 }, 0.235, 0.08, 0.05, 1, 1, 1, 6, 4);
  body.sphere(0.011, { c: [0.08, 0.08, 0.08], l: 0 }, 0.235, 0.08, -0.05, 1, 1, 1, 6, 4);
  // tail with black band
  const ts = new THREE.Shape([new THREE.Vector2(0, -0.045), new THREE.Vector2(-0.16, -0.065), new THREE.Vector2(-0.17, 0.065), new THREE.Vector2(0, 0.045)]);
  const tg = new THREE.ExtrudeGeometry(ts, { depth: 0.012, bevelEnabled: false });
  body.add(tg, { l: 1, cff: (v) => (v.x < -0.11 && v.x > -0.15 ? [0.12, 0.12, 0.13] : [0.97, 0.97, 0.96]) }, M(-0.16, 0.0, 0, Math.PI / 2, 0, 0.05));
  // legs (visible when perched)
  const legs = new GB();
  legs.bar([0.02, -0.06, 0.035], [0.035, -0.2, 0.035], 0.007, { c: [0.98, 0.82, 0.3] }, 4);
  legs.bar([0.02, -0.06, -0.035], [0.035, -0.2, -0.035], 0.007, { c: [0.98, 0.82, 0.3] }, 4);
  legs.box(0.05, 0.006, 0.03, { c: [0.98, 0.82, 0.3] }, 0.05, -0.2, 0.035);
  legs.box(0.05, 0.006, 0.03, { c: [0.98, 0.82, 0.3] }, 0.05, -0.2, -0.035);
  const bm = body.mesh(MAT.toon);
  const lm = legs.mesh(MAT.toonDS);
  root.add(bm, lm);
  const wings = [];
  const grey = [0.56, 0.6, 0.66];
  for (const s of [1, -1]) {
    const inner = new THREE.Group();
    const ib = new GB();
    const isx = new THREE.Shape([new THREE.Vector2(0.075, 0), new THREE.Vector2(0.085, 0.16), new THREE.Vector2(0.06, 0.33), new THREE.Vector2(-0.075, 0.33), new THREE.Vector2(-0.11, 0.16), new THREE.Vector2(-0.1, 0)]);
    const ig = new THREE.ExtrudeGeometry(isx, { depth: 0.014, bevelEnabled: false, curveSegments: 4 });
    ib.add(ig, { l: 1, cff: (v) => (v.x < -0.07 ? [0.94, 0.95, 0.95] : grey) }, M(0, 0.007 * s, 0, s * Math.PI / 2, 0, 0, 1, 1, 1));
    inner.add(ib.mesh(MAT.toonDS));
    const outer = new THREE.Group();
    const ob = new GB();
    const osx = new THREE.Shape([new THREE.Vector2(0.06, 0), new THREE.Vector2(0.05, 0.14), new THREE.Vector2(0.0, 0.3), new THREE.Vector2(-0.05, 0.4), new THREE.Vector2(-0.07, 0.3), new THREE.Vector2(-0.08, 0.12), new THREE.Vector2(-0.075, 0)]);
    const og = new THREE.ExtrudeGeometry(osx, { depth: 0.012, bevelEnabled: false, curveSegments: 4 });
    ob.add(og, { l: 1, cff: (v) => (v.y > 0.16 ? (v.y > 0.33 && v.x < -0.02 ? [0.95, 0.95, 0.95] : [0.1, 0.1, 0.12]) : grey) }, M(0, 0.006 * s, 0, s * Math.PI / 2, 0, 0));
    outer.add(ob.mesh(MAT.toonDS));
    outer.position.z = s * 0.33;
    inner.add(outer);
    inner.position.set(0.03, 0.045, s * 0.055);
    root.add(inner);
    wings.push({ inner, outer, s });
  }
  setLayers(root, {});
  return { root, wings, legs: lm };
}

export function buildGulls(scene) {
  srand(77);
  const gulls = [];
  for (let i = 0; i < 6; i++) {
    const m = gullModel();
    scene.add(m.root);
    gulls.push({
      ...m,
      mode: 'circle',
      cx: rr(-4, 8), cz: rr(-8, 4), r: rr(7, 13), h: rr(7, 12), w: rr(0.18, 0.3) * (rand() > 0.5 ? 1 : -1),
      a: rand() * 6.28, flapT: rand() * 5, flapping: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), perch: null, t0: 0, from: new THREE.Vector3(), stayUntil: 0, cool: rr(5, 20), fold: 0, phase: rand() * 6,
    });
  }
  const perchTaken = new Set();
  function circlePos(g, t, out) {
    const a = g.a;
    out.set(g.cx + Math.cos(a) * g.r, g.h + Math.sin(t * 0.3 + g.phase) * 1.2, g.cz + Math.sin(a) * g.r * 0.8);
    return out;
  }
  const api = {
    gulls,
    videoState: { perchTaken },
    requestLanding(now, boats) {
      const free = gulls.filter((g) => g.mode === 'circle' && g.cool <= 0);
      if (!free.length) return false;
      const g = free[Math.floor(rand() * free.length)];
      const opts = [];
      PROPS.perches.forEach((p, i) => { if (!perchTaken.has('p' + i)) opts.push({ key: 'p' + i, get: () => p, water: false }); });
      for (const b of boats) {
        if (!b.cabin) continue;
        const key = 'b' + b.def.id;
        if (perchTaken.has(key) || b.def.id === 'B4') continue;
        const local = new THREE.Vector3((b.cabin.cx0 + b.cabin.cx1) / 2 + 0.25, b.cabin.y0 + b.cabin.hc + 0.4, b.cabin.cw / 2 - 0.05);
        opts.push({ key, get: () => local.clone().applyMatrix4(b.group.matrixWorld), water: false, boat: b });
      }
      const wx = rr(-4, 14), wz = rr(-7, 2);
      opts.push({ key: 'w' + Math.floor(rand() * 999), get: () => new THREE.Vector3(wx, WL + 0.06 + Math.sin(performance.now() * 0.0011 + wx) * 0.04, wz), water: true });
      const o = opts[Math.floor(rand() * opts.length)];
      perchTaken.add(o.key);
      g.mode = 'approach'; g.perch = o; g.t0 = now; g.from.copy(g.pos); g.stayUntil = now + rr(12, 26);
      return true;
    },
    requestSkim(now) {
      const free = gulls.filter((g) => g.mode === 'circle');
      if (!free.length) return;
      const g = free[0];
      g.mode = 'skim'; g.t0 = now; g.from.copy(g.pos);
    },
    update(now, dt, camera) {
      for (const g of gulls) {
        g.cool -= dt;
        const prev = g.pos.clone();
        let flap = 0, fold = 0, bank = 0;
        if (g.mode === 'circle') {
          g.a += g.w * dt;
          circlePos(g, now, g.pos);
          g.flapT -= dt;
          if (g.flapT < 0) { g.flapping = rr(1.0, 2.2); g.flapT = rr(4, 9); }
          g.flapping -= dt;
          flap = g.flapping > 0 ? 1 : 0;
          bank = -Math.sign(g.w) * 0.35;
        } else if (g.mode === 'skim') {
          const el = now - g.t0;
          const T = 9;
          g.a += g.w * dt * 1.3;
          const target = circlePos(g, now, tmpV.clone());
          const dip = Math.sin(Math.min(1, el / T) * Math.PI);
          g.pos.copy(target);
          g.pos.y = THREE.MathUtils.lerp(target.y, WL + 0.35, dip * dip);
          flap = el < 1.5 || el > T - 2.5 ? 1 : 0;
          bank = -Math.sign(g.w) * 0.2;
          if (el > T) g.mode = 'circle';
        } else if (g.mode === 'approach') {
          const el = now - g.t0;
          const T = 6;
          const k = Math.min(1, el / T);
          const target = g.perch.get();
          const e = k * k * (3 - 2 * k);
          const mid = g.from.clone().lerp(target, 0.5); mid.y += 2.5;
          const a = g.from.clone().lerp(mid, e), b = mid.clone().lerp(target, e);
          g.pos.copy(a.lerp(b, e));
          flap = k > 0.7 ? 1 : (k < 0.2 ? 1 : 0);
          if (k >= 1) { g.mode = 'perched'; g.t0 = now; }
        } else if (g.mode === 'perched') {
          const target = g.perch.get();
          g.pos.copy(target);
          fold = Math.min(1, (now - g.t0) / 0.8);
          const camD = camera.position.distanceTo(g.pos);
          if (now > g.stayUntil || camD < 8) {
            g.mode = 'takeoff'; g.t0 = now; g.from.copy(g.pos);
            perchTaken.delete(g.perch.key);
          }
        } else if (g.mode === 'takeoff') {
          const el = now - g.t0;
          const target = circlePos(g, now, tmpV.clone());
          const k = Math.min(1, el / 5);
          g.pos.copy(g.from).lerp(target, k * k);
          g.pos.y = THREE.MathUtils.lerp(g.from.y, target.y, Math.min(1, el / 3));
          flap = 1.6;
          g.a += g.w * dt;
          if (k >= 1) { g.mode = 'circle'; g.cool = rr(15, 35); }
        }
        g.vel.subVectors(g.pos, prev);
        // orientation
        const r = g.root;
        r.position.copy(g.pos);
        if (g.mode === 'perched') {
          const yaw = r.rotation.y;
          r.rotation.set(0, yaw, 0, 'YXZ');
          r.position.y += 0.2 + (g.perch.water ? -0.12 : 0);
          if (g.perch.water) r.rotation.z = Math.sin(now * 1.3) * 0.08;
          // look around
          r.rotation.y += Math.sin(now * 0.7 + g.phase) * 0.004;
        } else if (g.vel.lengthSq() > 1e-8) {
          const yaw = Math.atan2(-g.vel.z, g.vel.x);
          const pitch = Math.atan2(g.vel.y, Math.hypot(g.vel.x, g.vel.z));
          r.rotation.set(0, yaw, 0, 'YXZ');
          r.rotateZ(pitch * 0.6);
          r.rotateX(bank);
        }
        g.legs.visible = g.mode === 'perched' || (g.mode === 'approach' && now - g.t0 > 4.5);
        g.fold = THREE.MathUtils.lerp(g.fold, fold, Math.min(1, dt * 6));
        const fl = flap ? Math.sin(now * (flap > 1 ? 16 : 11) + g.phase) : 0;
        for (const w of g.wings) {
          const glide = 0.08;
          const up = (fl * 0.75 + glide) * (1 - g.fold);
          w.inner.rotation.set(-w.s * up, 0, 0);
          w.outer.rotation.set(-w.s * (fl * 0.35 - 0.05) * (1 - g.fold), 0, 0);
          // folded: wings tucked along the body
          w.inner.rotation.y = -w.s * g.fold * 1.5;
          w.inner.rotation.x += w.s * g.fold * 0.1;
          w.outer.rotation.y = -w.s * g.fold * 0.1;
          w.inner.scale.setScalar(1 - g.fold * 0.42);
        }
      }
    },
  };
  return api;
}

// ======================= CAT =======================
function catModel() {
  const root = new THREE.Group();
  const bodyG = new THREE.Group();
  root.add(bodyG);
  const white = [0.97, 0.95, 0.9], orange = [0.94, 0.6, 0.28], dark = [0.3, 0.25, 0.23], pink = [0.95, 0.62, 0.66];
  const calico = (v) => {
    const k1 = Math.sin(v.x * 13.0 + 0.6) + Math.cos(v.z * 11.0 + v.y * 6.0);
    const k2 = Math.sin(v.x * 9.0 - 2.0) * Math.cos(v.y * 14.0) + Math.sin(v.z * 7.0 + 1.0);
    if (v.y < -0.045) return white;
    if (k2 > 0.95) return dark;
    if (k1 > 0.55) return orange;
    return white;
  };
  const b = new GB();
  // torso (capsule along x) + chest + haunch
  b.add(new THREE.CapsuleGeometry(0.095, 0.2, 6, 14), { t: T.FABRIC, w: 0.15, l: 1, cff: (v) => calico(new THREE.Vector3(v.y, v.x, v.z)) }, M(0, 0, 0, 0, 0, Math.PI / 2, 1, 1, 0.9));
  b.sphere(0.09, { t: T.FABRIC, l: 1, cff: (v) => (v.y < 0.0 ? white : calico(v.clone().add(new THREE.Vector3(0.15, 0, 0)))) }, 0.15, 0.035, 0, 1, 1, 0.9, 12, 8);
  b.sphere(0.1, { t: T.FABRIC, l: 1, cff: (v) => calico(v.clone().add(new THREE.Vector3(-0.14, 0, 0))) }, -0.14, 0.01, 0, 1, 0.95, 0.95, 12, 8);
  bodyG.add(b.mesh(MAT.toon));
  // head
  const head = new THREE.Group();
  const hb = new GB();
  hb.sphere(0.092, { t: T.FABRIC, l: 1, cff: (v) => (v.x > 0.035 && v.y < 0.02 ? white : (v.y > 0.02 && v.z > -0.02 ? orange : (v.z < -0.03 && v.y > 0.0 ? dark : white))) }, 0, 0, 0, 0.95, 0.86, 1.08, 16, 12);
  hb.sphere(0.04, { c: white, l: 0.5 }, 0.07, -0.028, 0.026, 1, 0.8, 1, 8, 6);
  hb.sphere(0.04, { c: white, l: 0.5 }, 0.07, -0.028, -0.026, 1, 0.8, 1, 8, 6);
  // ears
  for (const s2 of [1, -1]) {
    hb.add(new THREE.ConeGeometry(0.038, 0.075, 4), { c: s2 > 0 ? orange : dark, l: 1 }, M(-0.005, 0.085, s2 * 0.05, -s2 * 0.32, Math.PI / 4, 0, 1, 1, 0.55));
    hb.add(new THREE.ConeGeometry(0.024, 0.05, 4), { c: pink, l: 0.3 }, M(0.008, 0.08, s2 * 0.05, -s2 * 0.32, Math.PI / 4, 0, 1, 1, 0.3));
    // anime eyes: dark ovals with a bright highlight
    hb.sphere(0.019, { c: [0.12, 0.14, 0.12], l: 0.2, w: 1 }, 0.078, 0.012, s2 * 0.036, 0.6, 1.25, 1, 8, 6);
    hb.sphere(0.006, { c: [1, 1, 1], e: 0.8, l: 0 }, 0.088, 0.02, s2 * 0.032, 1, 1, 1, 6, 4);
    // whiskers
    for (const dy of [-0.004, -0.016]) hb.bar([0.1, -0.025, s2 * 0.03], [0.09, -0.02 + dy, s2 * 0.13], 0.0016, { c: [0.98, 0.98, 0.98], l: 0 }, 3);
  }
  hb.sphere(0.009, { c: pink, l: 0 }, 0.104, -0.012, 0, 1, 0.8, 1.2, 6, 4);
  head.add(hb.mesh(MAT.toon));
  head.position.set(0.25, 0.085, 0);
  bodyG.add(head);
  // legs
  const legs = [];
  for (const [x, z] of [[0.15, 0.055], [0.15, -0.055], [-0.15, 0.06], [-0.15, -0.06]]) {
    const pivot = new THREE.Group();
    const lb = new GB();
    lb.add(new THREE.CapsuleGeometry(0.024, 0.11, 4, 8), { c: white, l: 0.9 }, M(0, -0.075, 0));
    lb.sphere(0.03, { c: white, l: 0.6 }, 0.012, -0.15, 0, 1.25, 0.65, 1, 8, 5);
    pivot.add(lb.mesh(MAT.toon));
    pivot.position.set(x, -0.03, z);
    bodyG.add(pivot);
    legs.push(pivot);
  }
  // tail: chain of overlapping capsules
  const tail = [];
  let parent = bodyG;
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Group();
    const tb = new GB();
    tb.add(new THREE.CapsuleGeometry(0.02 - i * 0.0012, 0.05, 3, 8), { c: i > 4 ? dark : (i % 3 === 1 ? white : orange), l: 0.9 }, M(0, 0.035, 0));
    seg.add(tb.mesh(MAT.toon));
    seg.position.set(i === 0 ? -0.22 : 0, i === 0 ? 0.03 : 0.062, 0);
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }
  setLayers(root, {});
  return { root, bodyG, head, legs, tail };
}

export function buildCat(scene) {
  const m = catModel();
  scene.add(m.root);
  const home = PROPS.catHome.clone();
  const nodes = {
    H: [home.x, home.z], A: [15.2, 12.3], B: [11.6, 12.6], C: [8.6, 12.0], D: [4.6, 11.4], E: [0.4, 12.6], F: [-2.6, 13.0],
    G: [-7.4, 12.8], I: [2.2, 17.2], J: [7.0, 18.6], K: [13.6, 17.8], Lx: [17.6, 14.4], N: [-3.2, 17.6], P: [-9.6, 16.0], Q: [-1.8, 9.6], R: [4.0, 14.2],
  };
  const edges = { H: ['A'], A: ['H', 'B', 'K', 'Lx'], B: ['A', 'C', 'R'], C: ['B', 'D', 'R'], D: ['C', 'E', 'R'], E: ['D', 'F', 'I', 'Q', 'R'], F: ['E', 'G', 'N', 'Q'], G: ['F', 'P'], I: ['E', 'J', 'N', 'R'], J: ['I', 'K', 'R'], K: ['J', 'A', 'Lx'], Lx: ['K', 'A'], N: ['F', 'I', 'P'], P: ['G', 'N'], Q: ['E', 'F'], R: ['B', 'C', 'D', 'E', 'I', 'J'] };
  const hy = (x, z) => groundAt(x, z);
  const cat = {
    m, state: 'hide', path: [], seg: 0, segT: 0, pos: new THREE.Vector3(home.x, home.y, home.z), yaw: Math.PI / 2, speed: 0,
    pauseUntil: 0, lookAt: 0, gait: 0, headYaw: 0, headPitch: 0, wantHome: false, sitting: 0,
    goOut(now) {
      if (this.state !== 'hide') return;
      // build a random walk that differs every time
      let cur = 'H';
      const route = ['H', 'A'];
      cur = 'A';
      const steps = 3 + Math.floor(rand() * 4);
      let prev = 'H';
      for (let i = 0; i < steps; i++) {
        const opts = edges[cur].filter((n) => n !== 'H' && n !== prev);
        const nx = opts[Math.floor(rand() * opts.length)];
        prev = cur; cur = nx;
        route.push(nx);
      }
      this.path = route.map((k) => {
        const [x, z] = nodes[k];
        return new THREE.Vector3(x + rr(-0.5, 0.5) * (k === 'H' ? 0 : 1), 0, z + rr(-0.5, 0.5) * (k === 'H' ? 0 : 1));
      });
      this.path[0].copy(home);
      this.pauses = this.path.map((_, i) => (i > 1 && rand() > 0.45 ? rr(2.5, 6) : 0));
      this.seg = 0; this.segT = 0; this.state = 'walk'; this.wantHome = false; this.speed = 0.55;
      this.graphPath = route;
    },
    goHome() {
      if (this.state === 'hide' || this.state === 'home') return;
      // path back through graph (BFS)
      const cur = this.graphPath ? this.graphPath[Math.min(this.graphPath.length - 1, this.seg + 1)] : 'A';
      const q = [[cur]], seen = new Set([cur]);
      let found = null;
      while (q.length) {
        const p = q.shift();
        const last = p[p.length - 1];
        if (last === 'H') { found = p; break; }
        for (const n of edges[last]) if (!seen.has(n)) { seen.add(n); q.push([...p, n]); }
      }
      const pts = [this.pos.clone()];
      for (const k of found || ['H']) {
        const [x, z] = nodes[k];
        pts.push(k === 'H' ? home.clone() : new THREE.Vector3(x, 0, z));
      }
      this.path = pts; this.pauses = pts.map(() => 0); this.seg = 0; this.segT = 0; this.state = 'home'; this.speed = 1.6;
    },
    update(now, dt, camera) {
      const r = m.root;
      let moving = false;
      const camD = camera.position.distanceTo(this.pos);
      if (this.state === 'walk' || this.state === 'home') {
        if (now < this.pauseUntil) {
          this.sitting = Math.min(1, this.sitting + dt * 2);
        } else {
          this.sitting = Math.max(0, this.sitting - dt * 3);
          const a = this.path[this.seg], b = this.path[this.seg + 1];
          if (!b) {
            if (this.state === 'home') { this.state = 'hide'; this.pos.copy(home); }
            else { this.goHome(); }
          } else {
            const d = Math.hypot(b.x - a.x, b.z - a.z);
            this.segT += (this.speed * dt) / Math.max(d, 0.01);
            if (this.segT >= 1) {
              this.segT = 0; this.seg++;
              const pz = this.pauses[this.seg] || 0;
              if (pz > 0) this.pauseUntil = now + pz;
            }
            const aa = this.path[this.seg], bb = this.path[this.seg + 1] || aa;
            const k = this.segT;
            this.pos.set(aa.x + (bb.x - aa.x) * k, 0, aa.z + (bb.z - aa.z) * k);
            const tyaw = Math.atan2(-(bb.z - aa.z), bb.x - aa.x);
            let dy = tyaw - this.yaw;
            while (dy > Math.PI) dy -= Math.PI * 2;
            while (dy < -Math.PI) dy += Math.PI * 2;
            this.yaw += dy * Math.min(1, dt * 6);
            moving = true;
          }
        }
      } else if (this.state === 'hide') {
        this.pos.copy(home);
        this.sitting = 1;
        this.yaw += (Math.PI / 2 - this.yaw) * Math.min(1, dt * 3);
      }
      this.pos.y = hy(this.pos.x, this.pos.z);
      if (this.state === 'hide') this.pos.y = home.y;
      // gait
      if (moving) this.gait += dt * this.speed * 11;
      const sw = moving ? 1 : 0;
      r.position.copy(this.pos);
      r.rotation.set(0, this.yaw, 0, 'YXZ');
      const lying = this.state === 'hide' ? 1 : 0;
      m.bodyG.position.y = 0.2 - 0.07 * this.sitting - 0.05 * lying + Math.abs(Math.sin(this.gait)) * 0.012 * sw;
      m.bodyG.rotation.z = this.sitting * (lying ? 0 : 0.35);
      m.legs.forEach((l, i) => {
        const ph = i === 0 || i === 3 ? 0 : Math.PI;
        l.rotation.z = Math.sin(this.gait + ph) * 0.6 * sw + (i >= 2 ? -this.sitting * 0.9 * (1 - lying) : 0) + lying * (i < 2 ? 1.2 : -1.2);
      });
      m.tail.forEach((s, i) => {
        s.rotation.z = (i === 0 ? -0.75 + 0.45 * sw : 0.16) + Math.sin(now * (lying ? 1.2 : 2.0) - i * 0.6) * 0.12 - lying * 0.18;
        s.rotation.x = Math.sin(now * 0.9 - i * 0.5) * 0.1 + (lying ? 0.25 : 0);
      });
      // look at the camera when it comes close
      let tyaw = Math.sin(now * 0.4) * 0.3 * (1 - sw), tp = 0;
      if (camD < 9) {
        const lp = camera.position.clone();
        const dx = lp.x - this.pos.x, dz = lp.z - this.pos.z;
        let ang = Math.atan2(-dz, dx) - this.yaw;
        while (ang > Math.PI) ang -= Math.PI * 2;
        while (ang < -Math.PI) ang += Math.PI * 2;
        tyaw = THREE.MathUtils.clamp(ang, -1.3, 1.3);
        tp = THREE.MathUtils.clamp(Math.atan2(lp.y - this.pos.y, Math.hypot(dx, dz)), -0.2, 0.8);
      }
      this.headYaw += (tyaw - this.headYaw) * Math.min(1, dt * 4);
      this.headPitch += (tp - this.headPitch) * Math.min(1, dt * 4);
      m.head.rotation.set(0, this.headYaw, this.headPitch, 'YXZ');
    },
  };
  return cat;
}

// ======================= FISH =======================
export function buildFish(scene) {
  const fb = new GB();
  fb.lathe([[0, -0.11], [0.025, -0.08], [0.035, -0.02], [0.03, 0.05], [0.012, 0.09], [0, 0.1]], { c: [1, 1, 1], t: T.PLAIN, w: 0.8, l: 0.6, cf: (v) => (v.z > 0.012 ? [0.42, 0.55, 0.62] : [0.92, 0.95, 0.96]) }, 0, 0, 0, 10, 0, 0, Math.PI / 2);
  fb.add(new THREE.ConeGeometry(0.035, 0.06, 3), { c: [0.6, 0.7, 0.75], l: 0.6 }, M(0.13, 0, 0, 0, 0, Math.PI / 2, 1, 1, 0.3));
  const geo = fb.build();
  const schools = [
    { n: 22, c: new THREE.Vector3(17.2, -2.8, -5), path: (t) => new THREE.Vector3(17.6 + Math.sin(t * 0.11) * 1.4, -2.6 + Math.sin(t * 0.23) * 0.5, -6 + Math.sin(t * 0.07) * 7.5), scale: 1.9 },
    { n: 10, c: new THREE.Vector3(-5, -2.5, -2), path: (t) => new THREE.Vector3(-4.6 + Math.sin(t * 0.13 + 1) * 1.2, -2.6 + Math.sin(t * 0.2) * 0.4, -2.5 + Math.sin(t * 0.09 + 2) * 4.5), scale: 1.2 },
    { n: 8, c: new THREE.Vector3(10, -3, -15), path: (t) => new THREE.Vector3(9 + Math.sin(t * 0.1) * 6, -3.0 + Math.sin(t * 0.3) * 0.4, -16 + Math.cos(t * 0.1) * 2.2), scale: 1.6 },
  ];
  const total = schools.reduce((a, s) => a + s.n, 0);
  const im = new THREE.InstancedMesh(geo, MAT.toon, total);
  im.frustumCulled = false;
  setLayers(im, { refl: false });
  scene.add(im);
  const fish = [];
  schools.forEach((s, si) => {
    s.scatter = 0; s.lastScatter = -99;
    for (let i = 0; i < s.n; i++) fish.push({ s, off: new THREE.Vector3(rr(-1, 1), rr(-0.4, 0.4), rr(-1, 1)), ph: rand() * 6.28, sp: rr(0.6, 1.2), pos: s.c.clone(), yaw: 0 });
  });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
  return {
    videoState: { schools, fish },
    update(now, dt, camera) {
      for (const s of schools) {
        const c = s.path(now);
        s.center = c;
        const d = camera.position.distanceTo(c);
        if (d < 11 && now - s.lastScatter > 12) { s.lastScatter = now; }
        const target = now - s.lastScatter < 5 ? 1 : 0;
        s.scatter += (target - s.scatter) * Math.min(1, dt * (target ? 3 : 0.4));
      }
      fish.forEach((f, i) => {
        const s = f.s;
        const spread = 1 + s.scatter * 2.4;
        const o = f.off;
        const tgt = new THREE.Vector3(
          s.center.x + (o.x * Math.cos(now * 0.3 * f.sp + f.ph) - o.z * Math.sin(now * 0.3 * f.sp)) * spread,
          Math.min(WL - 0.4, s.center.y + o.y * spread + Math.sin(now * f.sp + f.ph) * 0.1),
          s.center.z + (o.z * Math.cos(now * 0.3 * f.sp + f.ph) + o.x * Math.sin(now * 0.3 * f.sp)) * spread,
        );
        tgt.x = Math.min(19.6, Math.max(LAY.leftX + 0.6, tgt.x));
        tgt.z = Math.min(LAY.frontZ - 0.6, Math.max(-19.6, tgt.z));
        tgt.y = Math.max(seabedH(tgt.x, tgt.z) + 0.3, tgt.y);
        const prev = f.pos.clone();
        f.pos.lerp(tgt, Math.min(1, dt * (1.2 + s.scatter * 3)));
        const v = f.pos.clone().sub(prev);
        if (v.lengthSq() > 1e-7) {
          const ty = Math.atan2(-v.z, v.x);
          let dy = ty - f.yaw;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          f.yaw += dy * Math.min(1, dt * 5);
        }
        e.set(0, f.yaw + Math.sin(now * 9 * f.sp + f.ph) * 0.12, 0, 'YXZ');
        q.setFromEuler(e);
        sc.setScalar(s.scale);
        // fish geometry points along -x (head at -x) -> rotate PI
        const qq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
        m.compose(f.pos, qq, sc);
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
}

// ======================= DISTANT BOATS =======================
export function buildDistantBoat(scene) {
  const b = new GB();
  b.box(9, 1.6, 2.8, { c: [0.92, 0.93, 0.92], t: T.PAINT, l: 0.5 }, 0, 0.5, 0);
  b.box(2.6, 2.0, 2.2, { c: [0.95, 0.95, 0.95], t: T.PAINT, l: 0.5 }, -1.2, 2.2, 0);
  b.cyl(0.08, 0.08, 3.5, { c: [0.85, 0.85, 0.85] }, -1.2, 4.5, 0, 0, 0, 0, 6);
  b.box(9.1, 0.25, 2.9, { c: [0.25, 0.35, 0.5], l: 0.4 }, 0, -0.15, 0);
  const g = b.mesh(MAT.toon);
  // wake
  const wb = new GB();
  wb.box(16, 0.02, 1.0, { c: [0.97, 1.0, 1.0], e: 0.4, l: 0 }, -12, -0.25, 0);
  const wake = wb.mesh(MAT.toon);
  const group = new THREE.Group();
  group.add(g, wake);
  setLayers(group, { shadow: false, outline: true, refl: false });
  scene.add(group);
  group.visible = false;
  return {
    active: false, t0: 0,
    start(now) { this.active = true; this.t0 = now; this.dir = rand() > 0.5 ? 1 : -1; this.z = rr(-150, -132); group.visible = true; },
    update(now) {
      if (!this.active) return;
      const el = now - this.t0;
      const x = -170 + el * 4.5;
      group.position.set(this.dir * x, WL - 0.1 + Math.sin(now * 0.8) * 0.15, this.z);
      group.rotation.y = this.dir > 0 ? 0 : Math.PI;
      if (el > 340 / 4.5) { this.active = false; group.visible = false; }
    },
  };
}
