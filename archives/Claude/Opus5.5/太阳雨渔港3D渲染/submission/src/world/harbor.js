import * as THREE from 'three';
import { GB, T, M } from '../core/builder.js';
import { U, WL, gustAt, setLayers, smooth } from '../core/G.js';
import { MAT } from '../core/materials.js';
import { buildBoat } from './boats.js';
import { PROPS } from './props.js';
import { wakeUniform, foamSpots, WAKE_N } from './water.js';
import { TETRA_SPOTS } from './base.js';
import { LAY } from './layout.js';

/** Dynamic rope (catenary tube) updated every frame */
export class Rope {
  constructor(scene, radius = 0.035, segs = 18, radial = 6, color = [0.88, 0.42, 0.2]) {
    this.r = radius; this.n = segs; this.k = radial;
    const vc = (segs + 1) * (radial + 1);
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(vc * 3);
    this.nor = new Float32Array(vc * 3);
    const uv = new Float32Array(vc * 2), col = new Float32Array(vc * 3), surf = new Float32Array(vc * 4), aux = new Float32Array(vc * 2);
    for (let i = 0; i <= segs; i++) for (let j = 0; j <= radial; j++) {
      const v = i * (radial + 1) + j;
      uv[v * 2] = i / segs; uv[v * 2 + 1] = j / radial;
      col.set(color, v * 3);
      surf.set([T.ROPE, 0.5, 0, 0.9], v * 4);
    }
    const idx = [];
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('acol', new THREE.BufferAttribute(col, 3));
    g.setAttribute('surf', new THREE.BufferAttribute(surf, 4));
    g.setAttribute('aux', new THREE.BufferAttribute(aux, 2));
    this.geo = g;
    this.mesh = new THREE.Mesh(g, MAT.toon);
    this.mesh.frustumCulled = false;
    setLayers(this.mesh, {});
    scene.add(this.mesh);
    this.pts = Array.from({ length: segs + 1 }, () => new THREE.Vector3());
  }
  update(a, b, length, visible = 1) {
    this.mesh.visible = visible > 0.01;
    if (!this.mesh.visible) return;
    const d = a.distanceTo(b);
    const slack = Math.max(0, length - d);
    const sag = Math.min(1.6, Math.sqrt((3 * length * slack) / 8) + 0.03);
    // when visible<1, the far end retracts toward a (casting off / tying up)
    const bb = new THREE.Vector3().lerpVectors(a, b, visible);
    for (let i = 0; i <= this.n; i++) {
      const t = i / this.n;
      this.pts[i].lerpVectors(a, bb, t);
      this.pts[i].y -= sag * 4 * t * (1 - t) * visible;
    }
    const up = new THREE.Vector3(0, 1, 0), T_ = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
    for (let i = 0; i <= this.n; i++) {
      const p0 = this.pts[Math.max(0, i - 1)], p1 = this.pts[Math.min(this.n, i + 1)];
      T_.subVectors(p1, p0).normalize();
      N.crossVectors(T_, up);
      if (N.lengthSq() < 1e-6) N.set(1, 0, 0);
      N.normalize();
      B.crossVectors(N, T_).normalize();
      for (let j = 0; j <= this.k; j++) {
        const th = (j / this.k) * Math.PI * 2;
        const c = Math.cos(th), s = Math.sin(th);
        const nx = N.x * c + B.x * s, ny = N.y * c + B.y * s, nz = N.z * c + B.z * s;
        const v = (i * (this.k + 1) + j) * 3;
        const p = this.pts[i];
        this.pos[v] = p.x + nx * this.r; this.pos[v + 1] = p.y + ny * this.r; this.pos[v + 2] = p.z + nz * this.r;
        this.nor[v] = nx; this.nor[v + 1] = ny; this.nor[v + 2] = nz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

// --- wake wave sources -------------------------------------------------------------------------
const sources = []; // {x,z,t0,amp}
export function emitWave(x, z, amp, now) {
  sources.push({ x, z, t0: now, amp });
  if (sources.length > WAKE_N) sources.shift();
}
export function waveAt(x, z, now) {
  let h = 0, env = 0;
  for (const s of sources) {
    const age = now - s.t0;
    if (age > 40) continue;
    const d = Math.hypot(x - s.x, z - s.z);
    const xx = d - age * 1.6;
    const e = Math.exp(-xx * xx * 1.2) * Math.exp(-age * 0.09) * s.amp;
    h += Math.sin(xx * 5.5) * e;
    env += e;
  }
  return { h, env };
}
function syncWakeUniform(now) {
  const arr = wakeUniform.value;
  for (let i = 0; i < WAKE_N; i++) {
    const s = sources[i];
    if (s) arr[i].set(s.x, s.z, now - s.t0, s.amp);
    else arr[i].set(0, 0, 999, 0);
  }
}

// --- departure route for the outermost boat -----------------------------------------------------
const ROUTE = [
  [7.1, 4.45], [10.0, 4.2], [13.2, 3.1], [15.4, 0.8], [16.3, -3.0], [16.0, -7.5], [14.6, -12.4], [11.6, -15.4], [6.5, -16.3],
  [1.5, -16.0], [-2.2, -15.6], [-4.2, -16.8], [-3.0, -18.6], [1.5, -18.9], [7.5, -18.5], [13.0, -16.8], [16.6, -13.0], [17.6, -8.0],
  [16.8, -3.2], [13.5, -0.8], [10.0, -1.6], [6.5, -2.7], [3.7, -1.6], [3.0, 0.5], [4.1, 2.5], [5.6, 3.9], [7.1, 4.45],
];

export function buildHarbor(scene, TX) {
  const defs = [
    { id: 'B1', kind: 'cabin', L: 7.0, name: TX.boatName1, pos: [-6.15, 2.25], ry: Math.PI / 2, fender: -1, seed: 3, stripe: [0.18, 0.34, 0.55], bottom: [0.7, 0.27, 0.24] },
    { id: 'B2', kind: 'sport', L: 7.0, name: TX.boatName3, pos: [-6.15, -5.2], ry: Math.PI / 2, fender: -1, seed: 5, stripe: [0.15, 0.45, 0.62], bottom: [0.2, 0.32, 0.45], sheerStripe: [0.2, 0.5, 0.7], flagColor: [0.2, 0.5, 0.85] },
    { id: 'B3', kind: 'open', L: 5.4, B: 1.95, name: TX.boatName2, pos: [-1.7, 4.72], ry: Math.PI, fender: -1, seed: 7, stripe: [0.25, 0.55, 0.4], bottom: [0.65, 0.3, 0.25] },
    { id: 'B4', kind: 'cabin', L: 7.4, name: TX.boatName4, pos: [7.1, 4.45], ry: 0, fender: 1, seed: 9, stripe: [0.6, 0.2, 0.2], bottom: [0.25, 0.4, 0.5], flagColor: [0.98, 0.8, 0.2] },
  ];
  const boats = [];
  const tmp = new THREE.Vector3();
  for (const d of defs) {
    const bt = buildBoat(TX, { kind: d.kind, L: d.L, B: d.B || 2.45, name: d.name, fenderSide: d.fender, seed: d.seed, stripe: d.stripe, bottom: d.bottom, sheerStripe: d.sheerStripe, flagColor: d.flagColor });
    const g = bt.group;
    g.position.set(d.pos[0], WL, d.pos[1]);
    g.rotation.set(0, d.ry, 0, 'YXZ');
    scene.add(g);
    g.updateMatrixWorld(true);
    // mooring lines: nearest bollard for each cleat
    const lines = [];
    for (const key of ['bow', 'stern']) {
      tmp.copy(bt.cleats[key]).applyMatrix4(g.matrixWorld);
      let best = null, bd = 1e9;
      for (const p of PROPS.bollards) { const dd = p.distanceTo(tmp); if (dd < bd) { bd = dd; best = p; } }
      const rope = new Rope(scene, 0.042, 20, 6, [0.93, 0.4, 0.17]);
      lines.push({ key, rope, bollard: best.clone().add(new THREE.Vector3(0, -0.22, 0)), len: bd * 1.06 + 0.3, vis: 1 });
      // eye loop around the bollard neck
      const eye = new GB();
      eye.torus(0.2, 0.04, { c: [0.93, 0.4, 0.17], t: T.ROPE, w: 0.5, uvs: [3, 1] }, best.x, best.y - 0.22, best.z, Math.PI / 2 + 0.12, 0, 0.1, 6, 18);
      const em = eye.mesh(MAT.toon);
      setLayers(em, {});
      scene.add(em);
    }
    const ph = d.seed * 1.37;
    boats.push({
      ...bt, def: d, lines, home: new THREE.Vector3(d.pos[0], WL, d.pos[1]), ry: d.ry,
      ph: [ph, ph * 1.7, ph * 2.3, ph * 0.6, ph * 3.1, ph * 1.1, ph * 2.7],
      freq: [0.85 + (d.seed % 3) * 0.07, 0.7 + (d.seed % 4) * 0.05, 0.55 + (d.seed % 5) * 0.03, 0.29 + (d.seed % 3) * 0.04],
      state: 'moored', bump: 0, bumpV: 0, lastBump: 0, wake: { h: 0, env: 0 },
    });
  }
  // a small boat hauled out on stands for repairs (static), with a ladder and a tarp
  {
    const dry = buildBoat(TX, { kind: 'open', L: 5.2, B: 1.9, name: TX.boatName2, fenderSide: 1, seed: 21, stripe: [0.2, 0.42, 0.62], bottom: [0.72, 0.3, 0.24] });
    const g = dry.group;
    g.position.set(9.6, 0.62, 15.6);
    g.rotation.set(0, 0.35, 0, 'YXZ');
    g.rotateX(0.04);
    scene.add(g);
    g.updateMatrixWorld(true);
    const sb = new GB();
    const wood = { c: [0.55, 0.42, 0.3], t: T.WOOD, w: 0.6, l: 0.9 };
    for (const lx of [-1.6, 0.0, 1.5]) {
      const p = new THREE.Vector3(lx, -0.62 + 0.15, 0).applyMatrix4(g.matrixWorld);
      sb.box(0.5, 0.3, 0.9, wood, p.x, 0.15, p.z, 0, 0.35, 0);
      sb.box(0.45, 0.22, 0.8, wood, p.x, 0.41, p.z, 0, 0.35 + 1.57, 0);
    }
    for (const [lx, lz] of [[-1.0, 1.15], [-1.0, -1.15], [1.0, 1.15], [1.0, -1.15]]) {
      const top = new THREE.Vector3(lx, 0.35, lz * 0.82).applyMatrix4(g.matrixWorld);
      const foot = new THREE.Vector3(lx, 0, lz * 1.45).applyMatrix4(g.matrixWorld);
      foot.y = 0;
      sb.bar(foot, top, 0.035, { c: [0.85, 0.4, 0.2], t: T.RUST }, 6);
      sb.box(0.18, 0.04, 0.18, { c: [0.3, 0.3, 0.3] }, foot.x, 0.02, foot.z);
    }
    // ladder leaning on the hull
    const la = new THREE.Vector3(0.6, 1.45, 1.05).applyMatrix4(g.matrixWorld);
    const lb = new THREE.Vector3(0.6, -0.62, 2.0).applyMatrix4(g.matrixWorld); lb.y = 0;
    const side = new THREE.Vector3(0.22, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35);
    sb.bar(la.clone().add(side), lb.clone().add(side), 0.025, { c: [0.75, 0.76, 0.78], w: 0.6 }, 5);
    sb.bar(la.clone().sub(side), lb.clone().sub(side), 0.025, { c: [0.75, 0.76, 0.78], w: 0.6 }, 5);
    for (let k = 1; k < 6; k++) { const t = k / 6; const p = la.clone().lerp(lb, t); sb.bar(p.clone().add(side), p.clone().sub(side), 0.018, { c: [0.75, 0.76, 0.78] }, 4); }
    // paint tin + brush under the hull
    sb.cyl(0.09, 0.09, 0.14, { c: [0.85, 0.3, 0.25], w: 0.5 }, 9.9, 0.07, 17.1, 0, 0, 0, 12);
    sb.bar([10.05, 0.14, 17.1], [10.3, 0.05, 17.3], 0.012, { c: [0.6, 0.45, 0.3] }, 4);
    const sm = sb.mesh(MAT.toon);
    setLayers(sm, {});
    scene.add(sm);
  }
  const route = new THREE.CatmullRomCurve3(ROUTE.map((p) => new THREE.Vector3(p[0], WL, p[1])), false, 'catmullrom', 0.5);
  const routeLen = route.getLength();

  // wall/tetrapod sample points for splash foam
  const splashPts = [];
  for (let z = LAY.bw.z1 + 0.5; z < LAY.frontZ; z += 1.6) splashPts.push([LAY.leftX + 0.1, z]);
  for (let x = LAY.leftX + 0.5; x < 20; x += 1.6) splashPts.push([x, LAY.frontZ - 0.1]);
  for (let x = LAY.bw.x0; x < LAY.bw.x1; x += 1.6) { splashPts.push([x, LAY.bw.z1 + 0.1]); splashPts.push([x, LAY.bw.z0 - 0.9]); }
  for (const t of TETRA_SPOTS) if (t.y > -2.0) splashPts.push([t.x, t.z]);
  const splashLevel = new Float32Array(splashPts.length);

  const H = {
    boats, route, routeLen, depart: null, distantBoat: null,
    videoState: { sources, splashLevel },
    busy() { return !!this.depart; },
    startDeparture(now) {
      if (this.depart) return false;
      this.depart = { t0: now, phase: 'cast', s: 0, speed: 0, lastEmit: 0 };
      return true;
    },
    update(now, dt) {
      const B4 = boats[3];
      // departure FSM
      if (this.depart) {
        const D = this.depart;
        const el = now - D.t0;
        if (D.phase === 'cast') {
          for (const l of B4.lines) l.vis = Math.max(0, 1 - el / 2.5);
          if (el > 3.2) { D.phase = 'run'; D.tRun = now; }
        } else if (D.phase === 'run') {
          const remain = routeLen - D.s;
          const target = remain < 9 ? Math.max(0.35, remain * 0.28) : (D.s < 6 ? 0.8 + D.s * 0.35 : 2.6);
          D.speed += (target - D.speed) * Math.min(1, dt * 0.8);
          D.s = Math.min(routeLen, D.s + D.speed * dt);
          if (D.s >= routeLen - 0.02) { D.phase = 'tie'; D.tTie = now; }
          // emit wake sources at the stern
          if (now - D.lastEmit > 0.32 && D.speed > 0.4) {
            D.lastEmit = now;
            const u = D.s / routeLen;
            const p = route.getPointAt(u), tg = route.getTangentAt(u);
            emitWave(p.x - tg.x * 3.2, p.z - tg.z * 3.2, Math.min(1, D.speed / 2.6) * 0.9, now);
          }
        } else if (D.phase === 'tie') {
          const e2 = now - D.tTie;
          for (const l of B4.lines) l.vis = Math.min(1, e2 / 2.5);
          if (e2 > 3) { this.depart = null; }
        }
      }
      syncWakeUniform(now);

      for (const bt of boats) {
        const g = bt.group;
        const p = bt.ph, f = bt.freq;
        const t = now;
        let base = bt.home, yaw = bt.ry;
        let moving = false, speed = 0;
        if (bt === boats[3] && this.depart && this.depart.phase !== 'cast') {
          const u = this.depart.s / routeLen;
          const pt = route.getPointAt(Math.min(1, u));
          const tg = route.getTangentAt(Math.min(0.9999, u));
          base = pt;
          yaw = Math.atan2(-tg.z, tg.x);
          moving = this.depart.phase === 'run';
          speed = this.depart.speed;
        }
        const w = waveAt(base.x, base.z, now);
        bt.wake = w;
        const gust = gustAt(base.x, base.z);
        let heave = 0.04 * Math.sin(f[0] * t + p[0]) + 0.018 * Math.sin(1.7 * t + p[1]) + w.h * 0.18;
        let roll = 0.028 * Math.sin(f[1] * t + p[2]) + 0.01 * Math.sin(1.9 * t + p[3]) + w.h * 0.12 + gust * 0.05;
        let pitch = 0.012 * Math.sin(f[2] * t + p[4]) + w.h * 0.05 + (moving ? -0.03 * Math.min(1, speed / 2) : 0);
        // lateral sway relative to the quay; tyres bump the wall
        let sway = 0;
        if (!moving && !(bt === boats[3] && this.depart)) {
          const raw = 0.1 * Math.sin(f[3] * t + p[5]) + 0.05 * Math.sin(0.53 * t + p[6]) + w.env * 0.12;
          sway = raw;
          if (raw < -0.09) {
            sway = -0.09 + (raw + 0.09) * -0.25;
            if (now - bt.lastBump > 2.5) { bt.lastBump = now; bt.bumpV = 0.06; }
          }
          bt.bump += bt.bumpV * dt * 10; bt.bumpV -= bt.bump * dt * 30; bt.bumpV *= Math.exp(-dt * 6);
          bt.bump *= Math.exp(-dt * 3);
        }
        const fs = bt.def.fender; // fender side (local z sign); sway pushes away from wall
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const lz = -fs * (sway + 0.1) + fs * 0.1; // local z offset
        const lx = moving ? 0 : 0.06 * Math.sin(0.23 * t + p[1]);
        const ox = lx * cy + lz * sy, oz = -lx * sy + lz * cy;
        g.position.set(base.x + ox, WL + heave, base.z + oz);
        g.rotation.set(0, yaw + 0.012 * Math.sin(0.27 * t + p[2]), 0, 'YXZ');
        g.rotateX(roll + bt.bump * fs * 2.0);
        g.rotateZ(pitch);
        g.updateMatrixWorld(true);
        // ropes
        for (const l of bt.lines) {
          const a = bt.cleats[l.key].clone().applyMatrix4(g.matrixWorld);
          l.rope.update(a, l.bollard, l.len, l.vis);
        }
      }
      // buoy bobbing (with wake)
      if (PROPS.buoy) {
        const b = PROPS.buoy;
        const w = waveAt(b.position.x, b.position.z, now);
        b.position.y = WL + 0.05 * Math.sin(now * 1.1) + 0.02 * Math.sin(now * 2.3 + 1) + w.h * 0.25;
        b.rotation.set(0.08 * Math.sin(now * 0.9) + w.h * 0.25, now * 0.05, 0.07 * Math.sin(now * 1.3 + 2) + w.h * 0.2);
      }
      // splash foam where the wake hits walls / tetrapods + gentle permanent foam at the tetrapods
      const fs = foamSpots.value;
      const cand = [];
      for (let i = 0; i < splashPts.length; i++) {
        const [x, z] = splashPts[i];
        const w = waveAt(x, z, now);
        splashLevel[i] = Math.max(splashLevel[i] * Math.exp(-dt * 1.2), Math.min(1.2, w.env * 2.2));
        if (splashLevel[i] > 0.12) cand.push([splashLevel[i], x, z]);
      }
      cand.sort((a, b) => b[0] - a[0]);
      for (let i = 0; i < 8; i++) {
        if (i < cand.length) fs[i].set(cand[i][1], cand[i][2], 0.6 + cand[i][0] * 0.9, Math.min(1, cand[i][0] * 1.6));
        else fs[i].set(0, 0, 0, 0);
      }
      // gentle, ever-churning foam between the tetrapod piles (each with its own rhythm)
      const piles = [[18.3, 4.2, 1.7, 0.0], [18.6, 2.0, 1.3, 1.7], [LAY.lh.x + 1.6, LAY.lh.z - 1.8, 1.5, 3.1], [2.0, LAY.bw.z0 - 1.3, 1.6, 4.4]];
      piles.forEach((p, k) => {
        const pulse = 0.5 + 0.5 * Math.sin(now * (0.55 + k * 0.13) + p[3]);
        fs[8 + k].set(p[0] + Math.sin(now * 0.3 + k) * 0.3, p[1], p[2] * (0.7 + 0.4 * pulse), 0.55 + 0.45 * pulse);
      });
    },
  };
  return H;
}
