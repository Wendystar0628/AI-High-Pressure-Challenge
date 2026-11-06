import * as THREE from 'three';
import { GB, T, M } from '../core/builder.js';
import { U, WL, rand, rr, srand, setLayers } from '../core/G.js';
import { MAT } from '../core/materials.js';
import { SP, texMat, makeShaft } from '../core/special.js';
import { hullGeometry } from './hull.js';
import { wall, windowIn, fishBox, crate } from './helpers.js';

const WHITE = [0.95, 0.96, 0.95];

function decalMesh(tex, w, h, m, opts = {}) {
  const b = new GB();
  b.add(new THREE.PlaneGeometry(w, h), { c: [1, 1, 1], w: opts.w || 0.3, e: opts.e || 0, l: opts.l === undefined ? 0.4 : opts.l }, m);
  return b.mesh(texMat(tex, { side: opts.side || THREE.FrontSide, alphaTest: opts.alphaTest || 0 }));
}

/**
 * Build a boat group. kind: 'cabin' | 'sport' | 'open'
 * Local frame: +x bow, +y up (0 = waterline), +z starboard.
 */
export function buildBoat(TX, opts) {
  srand(opts.seed || 1);
  const { kind = 'cabin', L = 7.4, B = 2.45, name = null, stripe = [0.2, 0.32, 0.55], bottom = [0.7, 0.27, 0.24], fenderSide = -1 } = opts;
  const group = new THREE.Group();
  const hg = hullGeometry({ L, B, freeboard: kind === 'open' ? 0.75 : 0.95, draft: kind === 'open' ? 0.4 : 0.55, sheer: kind === 'sport' ? 0.5 : 0.42, transom: kind === 'sport' ? 0.86 : 0.8 });
  const uOf = (x) => x / L + 0.5;
  const gunY = (x) => hg.deckY(uOf(x));
  const dk = (x) => gunY(x) - 0.32;
  const hw = (x) => hg.halfW(uOf(x));

  // hull shell (double sided)
  const hb = new GB();
  hb.add(hg.shell, {
    t: T.HULL, w: 0.55, l: 1,
    cf: (v, n) => {
      if (n.y > 0.6 && v.y > 0.3) return [0.86, 0.88, 0.88];
      if (v.y < 0.03) return bottom;
      if (v.y < 0.15) return stripe;
      if (opts.sheerStripe && v.y > gunY(v.x) - 0.22) return opts.sheerStripe;
      return WHITE;
    },
  });
  hb.add(hg.transom, { t: T.HULL, w: 0.5, cf: (v) => (v.y < 0.03 ? bottom : v.y < 0.15 ? stripe : WHITE) });
  const hull = hb.mesh(MAT.toonDS);
  group.add(hull);

  const b = new GB();
  const gl = new GB();
  const beads = [];
  const drips = [];
  const extra = [];
  // deck
  b.add(hg.deck, { c: kind === 'sport' ? [0.9, 0.9, 0.86] : [0.66, 0.72, 0.7], t: T.PLAIN, w: 0.8, l: 0.5 });
  // gunwale caps & rub rails
  for (const s of [1, -1]) {
    const pts = hg.gun.map((p) => new THREE.Vector3(p.x, p.y + 0.02, p.z * s * 1.0));
    b.tube(pts, 0.045, { c: kind === 'open' ? [0.62, 0.48, 0.34] : [0.92, 0.93, 0.92], t: kind === 'open' ? T.WOOD : T.PAINT, w: 0.7, l: 1 }, 40, 6);
    const rub = hg.gun.map((p) => new THREE.Vector3(p.x, p.y - 0.2, p.z * s * 1.03));
    b.tube(rub.slice(0, -2), 0.035, { c: [0.3, 0.33, 0.36], w: 0.5, l: 0.8 }, 40, 5);
    // inner bulwark face
    const inner = hg.gun.map((p) => new THREE.Vector3(p.x, p.y - 0.16, p.z * s * 0.96));
    b.tube(inner.slice(1, -3), 0.03, { c: [0.85, 0.87, 0.86] }, 30, 4);
    // beads along gunwale
    for (let i = 2; i < hg.gun.length - 3; i++) {
      if (rand() > 0.6) continue;
      const p = hg.gun[i];
      beads.push([p.x + rr(-0.1, 0.1), p.y + 0.06, p.z * s, rr(0.012, 0.02)]);
    }
    for (let k = 0; k < 4; k++) {
      const i = 3 + Math.floor(rand() * (hg.gun.length - 8));
      const p = hg.gun[i];
      drips.push({ local: new THREE.Vector3(p.x, p.y - 0.25, p.z * s * 1.08), period: rr(2.5, 6) });
    }
  }
  // stem / bow fitting
  b.cyl(0.06, 0.06, 0.12, { c: [0.7, 0.7, 0.7], w: 0.8 }, L / 2 - 0.35, gunY(L / 2 - 0.35) + 0.04, 0, 0, 0, 0, 8);
  // cleats (mooring points)
  const cleats = {
    bow: new THREE.Vector3(L / 2 - 0.6, gunY(L / 2 - 0.6) + 0.05, 0),
    stern: new THREE.Vector3(-L / 2 + 0.35, gunY(-L / 2 + 0.35) + 0.05, fenderSide * hw(-L / 2 + 0.35) * 0.7),
  };
  for (const c of Object.values(cleats)) {
    b.box(0.22, 0.05, 0.05, { c: [0.8, 0.8, 0.78], w: 0.8 }, c.x, c.y, c.z);
    b.box(0.05, 0.06, 0.05, { c: [0.8, 0.8, 0.78] }, c.x, c.y - 0.04, c.z);
  }
  // tyre fenders hanging on quay side
  const fenders = [];
  for (const fx of [-L * 0.28, 0.0, L * 0.22]) {
    const gy = gunY(fx);
    const z = fenderSide * (hw(fx) + 0.17);
    b.torus(0.24, 0.1, { c: [0.13, 0.13, 0.14], w: 0.4, l: 0.9 }, fx, gy - 0.55, z, 0, 0, 0, 8, 16);
    b.bar([fx, gy + 0.02, z * 0.9], [fx, gy - 0.32, z], 0.012, { c: [0.85, 0.82, 0.7], t: T.ROPE }, 4);
    fenders.push(new THREE.Vector3(fx, gy - 0.55, z));
  }
  // name on bows (both sides)
  if (name) {
    for (const s of [1, -1]) {
      const x = L * 0.28;
      const z = s * (hw(x) + 0.03);
      const m = M(x, gunY(x) - 0.33, z, 0, s > 0 ? 0 : Math.PI, 0);
      extra.push(decalMesh(name, 1.5, 0.28, m, { alphaTest: 0.4, l: 0.0 }));
    }
    extra.push(decalMesh(name, 1.1, 0.2, M(-L / 2 - 0.02, 0.55, 0, 0, -Math.PI / 2, 0), { alphaTest: 0.4, l: 0 }));
  }

  // --- superstructure ------------------------------------------------------------
  const interiorOpts = { caus: true };
  let cabin = null;
  if (kind === 'cabin' || kind === 'sport') {
    const cw = kind === 'sport' ? 1.95 : 1.75;
    const cx0 = kind === 'sport' ? -0.6 : -1.5, cx1 = kind === 'sport' ? 1.5 : 0.35;
    const y0 = Math.max(dk(cx0), dk(cx1)) + 0.02;
    const hc = kind === 'sport' ? 1.65 : 1.8;
    const zA = -cw / 2, zB = cw / 2;
    const paint = { c: WHITE, t: T.PAINT, w: 0.6, l: 1 };
    const innerC = { c: [0.88, 0.88, 0.84], t: T.PLAIN, w: 0.1, l: 0.6, caus: true };
    // floor
    b.box(cx1 - cx0, 0.05, cw, { c: [0.55, 0.45, 0.35], t: T.WOOD, w: 0.4, l: 0.5 }, (cx0 + cx1) / 2, y0, 0);
    // side walls with windows
    const sideWins = kind === 'sport'
      ? [{ a0: cx0 + 0.25, a1: cx0 + 1.0, y0: y0 + 0.9, y1: y0 + 1.42 }, { a0: cx0 + 1.15, a1: cx1 - 0.15, y0: y0 + 0.9, y1: y0 + 1.42 }]
      : [{ a0: cx0 + 0.2, a1: cx0 + 0.9, y0: y0 + 0.95, y1: y0 + 1.55 }, { a0: cx0 + 1.0, a1: cx1 - 0.15, y0: y0 + 0.95, y1: y0 + 1.55 }];
    for (const s of [-1, 1]) {
      wall(b, { axis: 'x', at: s * (cw / 2 - 0.03), from: cx0, to: cx1, y0, y1: y0 + hc, thick: 0.06, openings: sideWins, opts: paint });
      for (const o of sideWins) windowIn(b, gl, { axis: 'x', at: s * (cw / 2 - 0.03), a0: o.a0, a1: o.a1, y0: o.y0, y1: o.y1, frame: 0.04, depth: 0.08, mullions: 0, opts: { c: [0.75, 0.78, 0.8], w: 0.6 } });
    }
    // front wall with windshield (3 panes)
    const fw = [{ a0: zA + 0.1, a1: -0.32, y0: y0 + 0.95, y1: y0 + 1.6 }, { a0: -0.27, a1: 0.27, y0: y0 + 0.95, y1: y0 + 1.6 }, { a0: 0.32, a1: zB - 0.1, y0: y0 + 0.95, y1: y0 + 1.6 }];
    wall(b, { axis: 'z', at: cx1 - 0.03, from: zA, to: zB, y0, y1: y0 + hc, thick: 0.06, openings: fw, opts: paint });
    for (const o of fw) windowIn(b, gl, { axis: 'z', at: cx1 - 0.03, a0: o.a0, a1: o.a1, y0: o.y0, y1: o.y1, frame: 0.04, depth: 0.08, mullions: 0, opts: { c: [0.75, 0.78, 0.8] } });
    // rear wall with open door (starboard half) and small window
    const rw = [{ a0: 0.05, a1: zB - 0.12, y0: y0 + 0.02, y1: y0 + 1.62 }, { a0: zA + 0.15, a1: -0.15, y0: y0 + 1.0, y1: y0 + 1.5 }];
    wall(b, { axis: 'z', at: cx0 + 0.03, from: zA, to: zB, y0, y1: y0 + hc, thick: 0.06, openings: rw, opts: paint });
    windowIn(b, gl, { axis: 'z', at: cx0 + 0.03, a0: zA + 0.15, a1: -0.15, y0: y0 + 1.0, y1: y0 + 1.5, frame: 0.04, depth: 0.08, mullions: 0, opts: { c: [0.75, 0.78, 0.8] } });
    // open door leaf (swung against the outside of the side wall)
    b.push(M(cx0 - 0.02, y0, 0.07, 0, Math.PI - 0.22, 0));
    b.box(0.72, 1.58, 0.04, paint, 0.38, 0.81, 0.03);
    windowIn(b, gl, { axis: 'x', at: 0.03, a0: 0.15, a1: 0.6, y0: 0.95, y1: 1.4, frame: 0.03, depth: 0.06, mullions: 0, opts: { c: [0.75, 0.78, 0.8] } });
    b.pop();
    // inner wall lining (for interior colour) - thin layer
    b.box(cx1 - cx0 - 0.12, 0.85, 0.02, innerC, (cx0 + cx1) / 2, y0 + 0.45, zA + 0.07);
    b.box(cx1 - cx0 - 0.12, 0.85, 0.02, innerC, (cx0 + cx1) / 2, y0 + 0.45, zB - 0.07);
    // roof (with overhang) - underside caustics
    b.rbox(cx1 - cx0 + 0.35, 0.08, cw + 0.2, 0.03, { c: WHITE, t: T.PAINT, w: 0.7, l: 1, caus: true }, (cx0 + cx1) / 2 - 0.05, y0 + hc + 0.04, 0);
    b.box(cx1 - cx0 - 0.1, 0.02, cw - 0.1, { c: [0.92, 0.92, 0.88], caus: true, l: 0.3 }, (cx0 + cx1) / 2, y0 + hc - 0.01, 0);
    // roof rail
    for (const s of [-1, 1]) {
      b.bar([cx0 + 0.1, y0 + hc + 0.08, s * (cw / 2 - 0.05)], [cx0 + 0.1, y0 + hc + 0.32, s * (cw / 2 - 0.05)], 0.02, { c: [0.85, 0.86, 0.86], w: 0.8 }, 5);
      b.bar([cx1 - 0.1, y0 + hc + 0.08, s * (cw / 2 - 0.05)], [cx1 - 0.1, y0 + hc + 0.32, s * (cw / 2 - 0.05)], 0.02, { c: [0.85, 0.86, 0.86], w: 0.8 }, 5);
      b.bar([cx0 + 0.1, y0 + hc + 0.32, s * (cw / 2 - 0.05)], [cx1 - 0.1, y0 + hc + 0.32, s * (cw / 2 - 0.05)], 0.02, { c: [0.85, 0.86, 0.86], w: 0.8 }, 5);
    }
    const ry = y0 + hc + 0.08;
    // mast + radar dome + antennas + searchlight
    const mx = (cx0 + cx1) / 2 - 0.1;
    b.cyl(0.04, 0.05, 1.5, { c: [0.85, 0.86, 0.86], t: T.PAINT }, mx, ry + 0.75, 0, 0, 0, 0, 8);
    b.box(0.08, 0.05, 1.2, { c: [0.85, 0.86, 0.86], t: T.PAINT }, mx, ry + 1.2, 0);
    b.cyl(0.32, 0.32, 0.16, { c: WHITE, w: 0.7, l: 1 }, mx + 0.45, ry + 0.25, -0.35, 0, 0, 0, 20);
    b.lathe([[0.32, 0], [0.3, 0.06], [0.2, 0.13], [0, 0.15]], { c: WHITE, w: 0.7 }, mx + 0.45, ry + 0.33, -0.35, 20);
    b.cyl(0.05, 0.08, 0.12, { c: [0.7, 0.7, 0.7] }, mx + 0.45, ry + 0.06, -0.35, 0, 0, 0, 8);
    b.bar([mx - 0.3, ry, 0.6], [mx - 0.45, ry + 2.3, 0.62], 0.012, { c: [0.95, 0.95, 0.95] }, 4);
    b.bar([mx - 0.2, ry, -0.65], [mx - 0.35, ry + 1.8, -0.7], 0.012, { c: [0.25, 0.25, 0.25] }, 4);
    b.bar([mx + 0.1, ry + 1.2, 0.5], [mx + 0.1, ry + 2.0, 0.5], 0.01, { c: [0.95, 0.95, 0.95] }, 4);
    b.cyl(0.11, 0.11, 0.22, { c: [0.3, 0.32, 0.34], w: 0.6 }, cx1 - 0.25, ry + 0.2, 0.45, 0, 0, Math.PI / 2, 12);
    b.cyl(0.1, 0.1, 0.02, { c: [1.0, 0.97, 0.85], e: 0.5 }, cx1 - 0.13, ry + 0.2, 0.45, 0, 0, Math.PI / 2, 12);
    // horn
    b.cyl(0.02, 0.07, 0.25, { c: [0.85, 0.85, 0.82] }, cx1 - 0.25, ry + 0.12, -0.6, 0, 0, -Math.PI / 2, 8);
    // nav lights
    b.box(0.08, 0.08, 0.06, { c: [0.2, 0.75, 0.3], e: 0.3 }, cx1 - 0.3, ry + 0.06, zB + 0.04);
    b.box(0.08, 0.08, 0.06, { c: [0.9, 0.2, 0.2], e: 0.3 }, cx1 - 0.3, ry + 0.06, zA - 0.04);
    // life ring on cabin side
    for (const s of [fenderSide * -1]) {
      b.torus(0.27, 0.07, {
        c: [1, 1, 1], w: 0.6, l: 1,
        cfl: (v) => { const a = Math.atan2(v.y, v.x); return Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 2 ? [0.98, 0.98, 0.96] : [0.98, 0.45, 0.14]; },
      }, cx0 + 0.55, y0 + 0.62, s * (cw / 2 + 0.08), 0, 0, 0, 8, 24);
      b.box(0.06, 0.12, 0.04, { c: [0.6, 0.6, 0.6] }, cx0 + 0.55, y0 + 0.92, s * (cw / 2 + 0.03));
    }

    // --- interior ------------------------------------------------------------
    const ix = cx1 - 0.32;
    // dashboard
    b.box(0.5, 0.95, cw - 0.16, { c: [0.6, 0.62, 0.62], t: T.PAINT, l: 0.7 }, cx1 - 0.3, y0 + 0.475, 0);
    b.box(0.55, 0.05, cw - 0.16, { c: [0.35, 0.37, 0.38], l: 0.6 }, cx1 - 0.3, y0 + 0.95, 0, 0, 0, -0.18);
    // steering wheel (on starboard side)
    const wz = 0.42;
    b.push(M(ix - 0.32, y0 + 1.0, wz, 0, 0, 0.35));
    b.cyl(0.03, 0.03, 0.22, { c: [0.3, 0.3, 0.3] }, 0.1, 0, 0, 0, 0, Math.PI / 2, 6);
    b.torus(0.2, 0.022, { c: [0.55, 0.38, 0.22], t: T.WOOD, w: 0.6, l: 1 }, 0, 0, 0, 0, Math.PI / 2, 0, 6, 20);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.bar([0, 0, 0], [0, Math.cos(a) * 0.27, Math.sin(a) * 0.27], 0.012, { c: [0.55, 0.38, 0.22], t: T.WOOD }, 4);
      b.sphere(0.022, { c: [0.55, 0.38, 0.22] }, 0, Math.cos(a) * 0.28, Math.sin(a) * 0.28, 1, 1, 1, 6, 4);
    }
    b.sphere(0.05, { c: [0.75, 0.62, 0.3], w: 0.8 }, 0, 0, 0, 1, 1, 1, 8, 6);
    b.pop();
    // throttle lever & compass
    b.bar([ix - 0.1, y0 + 0.97, 0.75], [ix - 0.25, y0 + 1.15, 0.75], 0.012, { c: [0.2, 0.2, 0.2] }, 4);
    b.sphere(0.035, { c: [0.85, 0.2, 0.15] }, ix - 0.25, y0 + 1.16, 0.75);
    b.cyl(0.07, 0.08, 0.06, { c: [0.15, 0.15, 0.15] }, ix - 0.05, y0 + 1.02, 0.05, 0, 0, 0, 12);
    b.sphere(0.06, { c: [0.85, 0.92, 0.95], w: 1 }, ix - 0.05, y0 + 1.06, 0.05, 1, 0.6, 1, 10, 6);
    // radar & fish finder units on the dash (screens face aft)
    const screen = (kindS, z, w, h) => {
      b.rbox(0.22, h + 0.08, w + 0.08, 0.02, { c: [0.18, 0.19, 0.2], l: 0.9 }, ix - 0.02, y0 + 1.05 + h / 2, z, 0, 0.45, 0.22);
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), SP.screen(kindS));
      sm.position.set(ix - 0.135 + Math.sin(0.22) * -0.0, y0 + 1.05 + h / 2 - 0.0, z);
      sm.rotation.set(0, -Math.PI / 2 + 0.45, 0, 'YXZ');
      sm.rotateX(-0.22);
      sm.position.x -= 0.0;
      extra.push(sm);
    };
    screen(0, -0.18, 0.26, 0.24);
    screen(1, -0.58, 0.24, 0.2);
    // VHF radio + handset
    b.box(0.12, 0.06, 0.2, { c: [0.15, 0.15, 0.15] }, ix + 0.0, y0 + 1.66, -0.45);
    b.box(0.05, 0.03, 0.06, { c: [0.3, 0.9, 0.5], e: 0.6 }, ix - 0.07, y0 + 1.66, -0.45);
    b.rbox(0.05, 0.12, 0.08, 0.015, { c: [0.15, 0.15, 0.15] }, ix - 0.05, y0 + 1.5, -0.2);
    // --- port-side inner wall (faces the starboard windows, i.e. the usual viewer) ---
    const pw = zA + 0.075;
    // clipboards with chart & tide table, under the port windows
    b.box(0.4, 0.5, 0.02, { c: [0.55, 0.42, 0.3], t: T.WOOD }, cx0 + 1.02, y0 + 0.66, pw, 0, 0, 0.03);
    b.box(0.12, 0.04, 0.03, { c: [0.6, 0.6, 0.62], w: 0.8 }, cx0 + 1.02, y0 + 0.89, pw + 0.015, 0, 0, 0.03);
    extra.push(decalMesh(TX.chart, 0.36, 0.44, M(cx0 + 1.02, y0 + 0.65, pw + 0.013, 0, 0, 0.03)));
    b.box(0.32, 0.42, 0.02, { c: [0.55, 0.42, 0.3], t: T.WOOD }, cx0 + 1.45, y0 + 0.62, pw, 0, 0, -0.06);
    extra.push(decalMesh(TX.tide, 0.28, 0.36, M(cx0 + 1.45, y0 + 0.61, pw + 0.013, 0, 0, -0.06)));
    // catch photos & charm tucked into the port window frame
    extra.push(decalMesh(TX.photo, 0.2, 0.15, M(cx0 + 1.12, y0 + 1.42, pw + 0.02, 0, 0, 0.08)));
    extra.push(decalMesh(TX.photo2, 0.18, 0.135, M(cx0 + 1.32, y0 + 1.47, pw + 0.02, 0, 0, -0.06)));
    extra.push(decalMesh(TX.photo, 0.16, 0.12, M(cx0 + 0.32, y0 + 1.66, pw + 0.02, 0, 0, -0.1)));
    b.bar([cx0 + 0.75, y0 + 1.6, pw + 0.02], [cx0 + 0.75, y0 + 1.45, pw + 0.03], 0.004, { c: [0.85, 0.2, 0.2] }, 3);
    b.box(0.065, 0.095, 0.014, { c: [0.85, 0.15, 0.15] }, cx0 + 0.75, y0 + 1.4, pw + 0.035);
    extra.push(decalMesh(TX.omamori, 0.06, 0.09, M(cx0 + 0.75, y0 + 1.4, pw + 0.043, 0, 0, 0)));
    // a second charm hanging from the windshield frame
    b.bar([cx1 - 0.06, y0 + 1.6, -0.3], [cx1 - 0.06, y0 + 1.47, -0.3], 0.004, { c: [0.9, 0.75, 0.2] }, 3);
    b.box(0.014, 0.08, 0.055, { c: [0.2, 0.45, 0.75] }, cx1 - 0.06, y0 + 1.43, -0.3);
    // yellow raincoat on a hook by the door (port rear corner)
    {
      const hx = cx0 + 0.32, hz = pw + 0.12;
      b.bar([hx, y0 + 1.66, pw], [hx, y0 + 1.66, pw + 0.12], 0.012, { c: [0.6, 0.6, 0.6] }, 4);
      const coat = { c: [0.98, 0.84, 0.15], t: T.FABRIC, w: 0.75, l: 1 };
      b.push(M(hx, y0 + 1.6, hz, 0.04, 0, 0.03));
      b.add(new THREE.CylinderGeometry(0.11, 0.2, 0.62, 12, 1), coat, M(0, -0.38, 0, 0, 0, 0, 1, 1, 0.42));
      b.add(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), coat, M(0, -0.06, -0.01, 0, 0, 0, 1.05, 0.8, 0.55));
      b.add(new THREE.CylinderGeometry(0.04, 0.055, 0.48, 6, 1), coat, M(-0.14, -0.33, 0.02, 0, 0, 0.12));
      b.add(new THREE.CylinderGeometry(0.04, 0.055, 0.48, 6, 1), coat, M(0.14, -0.33, 0.02, 0, 0, -0.12));
      b.box(0.012, 0.42, 0.01, { c: [0.85, 0.7, 0.1] }, 0, -0.42, 0.085);
      for (let k = 0; k < 4; k++) b.sphere(0.012, { c: [0.85, 0.85, 0.85] }, 0.015, -0.24 - k * 0.1, 0.088);
      b.pop();
    }
    // thermos + enamel mug on the dashboard corner (port side)
    b.cyl(0.055, 0.055, 0.28, { c: [0.25, 0.45, 0.7], w: 0.8, l: 1 }, cx1 - 0.38, y0 + 1.11, zA + 0.32, 0, 0, 0, 12);
    b.cyl(0.048, 0.055, 0.06, { c: [0.82, 0.82, 0.82], w: 0.9 }, cx1 - 0.38, y0 + 1.28, zA + 0.32, 0, 0, 0, 12);
    b.cyl(0.042, 0.042, 0.08, { c: [0.97, 0.97, 0.95], w: 0.7, l: 1 }, cx1 - 0.48, y0 + 1.01, zA + 0.48, 0, 0, 0, 12);
    b.cyl(0.044, 0.044, 0.012, { c: [0.25, 0.4, 0.7] }, cx1 - 0.48, y0 + 1.05, zA + 0.48, 0, 0, 0, 12);
    b.torus(0.028, 0.008, { c: [0.97, 0.97, 0.95] }, cx1 - 0.48, y0 + 1.01, zA + 0.53, 0, Math.PI / 2, 0, 4, 10);
    // a stool
    b.cyl(0.16, 0.16, 0.05, { c: [0.25, 0.3, 0.45], w: 0.4 }, ix - 0.7, y0 + 0.62, 0.35, 0, 0, 0, 12);
    b.cyl(0.03, 0.03, 0.6, { c: [0.6, 0.6, 0.6] }, ix - 0.7, y0 + 0.31, 0.35, 0, 0, 0, 6);
    // ceiling light
    b.box(0.25, 0.03, 0.1, { c: [0.98, 0.97, 0.9], e: 0.35, caus: true }, (cx0 + cx1) / 2, y0 + hc - 0.04, 0);
    cabin = { cx0, cx1, y0, hc, cw };
    // sun shaft through starboard windows
    const sd = U.uSunDir.value.clone().negate();
    const sh = makeShaft(new THREE.Vector3(cx0 + 0.55, y0 + 1.4, 0), [0.5, 0.35], 1.7, sd, 0.55);
    sh.userData.local = true;
    extra.push(sh);

    // sunshade iron frame over the aft deck
    if (kind === 'cabin') {
      const fx0 = -L / 2 + 0.35, fx1 = cx0 - 0.05, fy = ry + 0.1;
      const iron = { c: [0.5, 0.45, 0.42], t: T.RUST, w: 0.4, l: 1 };
      for (const s of [-1, 1]) {
        const zz = s * (hw(fx0) - 0.12);
        b.bar([fx0, dk(fx0), zz], [fx0, fy, zz], 0.025, iron, 6);
        b.bar([fx0, fy, zz], [fx1, fy, s * (cw / 2 - 0.05)], 0.025, iron, 6);
      }
      b.bar([fx0, fy, -(hw(fx0) - 0.12)], [fx0, fy, hw(fx0) - 0.12], 0.025, iron, 6);
      for (let k = 1; k < 4; k++) {
        const x = fx0 + ((fx1 - fx0) * k) / 4;
        b.bar([x, fy, -(cw / 2)], [x, fy, cw / 2], 0.018, iron, 5);
      }
      // a partly rolled blue tarp on the frame
      b.add(new THREE.CylinderGeometry(0.12, 0.12, cw + 0.2, 10), { c: [0.25, 0.5, 0.8], t: T.FABRIC, w: 0.7, l: 0.9 }, M(fx1 - 0.15, fy + 0.1, 0, Math.PI / 2, 0, 0));
      const tarp = new THREE.PlaneGeometry(0.9, cw + 0.15, 4, 4);
      const tp = tarp.attributes.position;
      for (let i = 0; i < tp.count; i++) tp.setZ(i, Math.sin(tp.getX(i) * 4) * 0.03);
      tarp.computeVertexNormals();
      b.add(tarp, { c: [0.25, 0.5, 0.8], t: T.FABRIC, w: 0.7, l: 0.7 }, M(fx1 - 0.65, fy + 0.03, 0, -Math.PI / 2, 0, 0));
      // aft deck clutter
      for (let k = 0; k < 3; k++) fishBox(b, -L / 2 + 0.9, dk(-L / 2 + 0.9) + k * 0.2, 0.45, 0.1 * k);
      fishBox(b, -L / 2 + 1.6, dk(-L / 2 + 1.6), -0.4, 0.3, { open: true, c: [0.95, 0.96, 0.95] });
      for (let k = 0; k < 4; k++) b.torus(0.28 - k * 0.04, 0.035, { c: [0.85, 0.42, 0.2], t: T.ROPE, w: 0.6 }, -L / 2 + 1.0, dk(-L / 2 + 1.0) + 0.04 + k * 0.01, -0.55, Math.PI / 2, 0, 0, 5, 16);
      // line hauler on foredeck
      b.cyl(0.14, 0.14, 0.2, { c: [0.75, 0.4, 0.2], t: T.RUST }, cx1 + 0.6, dk(cx1 + 0.6) + 0.5, 0.55, Math.PI / 2, 0, 0, 12);
      b.bar([cx1 + 0.6, dk(cx1 + 0.6), 0.55], [cx1 + 0.6, dk(cx1 + 0.6) + 0.45, 0.55], 0.04, { c: [0.6, 0.6, 0.6] }, 6);
      // bonten flag pole (fishing marker buoy with flag) lying on the foredeck
      b.bar([cx1 + 0.4, dk(cx1 + 0.4) + 0.12, -0.6], [L / 2 - 0.8, dk(L / 2 - 0.8) + 0.2, -0.3], 0.02, { c: [0.75, 0.62, 0.4], t: T.WOOD }, 5);
      b.sphere(0.16, { c: [0.98, 0.55, 0.15], w: 0.7 }, cx1 + 1.1, dk(cx1 + 1.1) + 0.2, -0.5, 1, 1, 1, 10, 8);
      // net pile
      b.sphere(0.4, { c: [0.3, 0.55, 0.5], l: 0.5 }, cx1 + 1.4, dk(cx1 + 1.4) + 0.05, 0.1, 1.3, 0.4, 1.0, 10, 6);
    } else {
      // sport boat: T-top rails, rod holders with rods, cockpit seats
      const iron = { c: [0.9, 0.9, 0.92], w: 0.8, l: 1 };
      for (const s of [-1, 1]) {
        b.bar([cx0 - 0.1, ry, s * 0.75], [-L / 2 + 0.8, ry + 0.25, s * 0.75], 0.025, iron, 6);
        b.bar([-L / 2 + 0.8, ry + 0.25, s * 0.75], [-L / 2 + 0.8, dk(-L / 2 + 0.8), s * (hw(-L / 2 + 0.8) - 0.1)], 0.025, iron, 6);
      }
      b.bar([-L / 2 + 0.8, ry + 0.25, -0.75], [-L / 2 + 0.8, ry + 0.25, 0.75], 0.025, iron, 6);
      for (const [x, z, a] of [[-L / 2 + 0.6, 0.85, 0.35], [-L / 2 + 0.6, -0.85, -0.35], [-L / 2 + 1.3, 0.95, 0.5], [-L / 2 + 1.3, -0.95, -0.5]]) {
        const yb = gunY(x);
        b.cyl(0.03, 0.03, 0.25, { c: [0.85, 0.85, 0.88] }, x, yb, z, a * 0.5, 0, 0, 6);
        b.bar([x, yb + 0.1, z], [x - 0.3, yb + 2.6, z + a * 1.2], 0.008, { c: [0.15, 0.15, 0.18] }, 3);
        b.cyl(0.035, 0.035, 0.12, { c: [0.2, 0.2, 0.22] }, x - 0.04, yb + 0.35, z + a * 0.16, 0, 0, 0, 8);
      }
      for (const z of [-0.5, 0.5]) b.rbox(0.45, 0.4, 0.5, 0.08, { c: [0.92, 0.9, 0.84], w: 0.5 }, -L / 2 + 1.0, dk(-L / 2 + 1.0) + 0.2, z);
      crate(b, -L / 2 + 1.8, dk(-L / 2 + 1.8), 0, 0.2, { c: [0.85, 0.85, 0.82] });
      // bow rail
      const pr = [];
      for (let k = 0; k <= 8; k++) {
        const x = cx1 + 0.4 + (L / 2 - 0.5 - cx1 - 0.4) * (k / 8);
        pr.push(new THREE.Vector3(x, gunY(x) + 0.42, hw(x) * 0.88));
      }
      const pl = pr.map((p) => new THREE.Vector3(p.x, p.y, -p.z)).reverse();
      b.tube([...pr, ...pl.slice(1)], 0.018, { c: [0.9, 0.9, 0.92], w: 0.8 }, 40, 5);
      for (let k = 0; k <= 8; k += 2) { b.bar([pr[k].x, pr[k].y - 0.42, pr[k].z], pr[k], 0.015, { c: [0.9, 0.9, 0.92] }, 4); b.bar([pr[k].x, pr[k].y - 0.42, -pr[k].z], [pr[k].x, pr[k].y, -pr[k].z], 0.015, { c: [0.9, 0.9, 0.92] }, 4); }
    }
    // little flag on the mast
    const fg = new THREE.PlaneGeometry(0.45, 0.3, 4, 2);
    fg.translate(-0.225, 0, 0);
    const flagB = new GB();
    const fc = opts.flagColor || [0.95, 0.3, 0.25];
    flagB.add(fg, { c: fc, t: T.FABRIC, l: 0.6, sway: (v) => [Math.min(1, Math.abs(v.x - mx) / 0.45), rand() * 6], cf: (v) => (v.y > ry + 1.38 ? [0.98, 0.98, 0.95] : fc) }, M(mx, ry + 1.35, 0));
    const flag = flagB.mesh(MAT.flag);
    extra.push(flag);
  } else {
    // open boat: small centre console, outboard engine, bonten flags
    const x = 0.2, y0 = dk(0.2) + 0.02;
    b.rbox(0.6, 0.9, 0.7, 0.04, { c: WHITE, t: T.PAINT, w: 0.6 }, x, y0 + 0.45, 0);
    b.box(0.05, 0.4, 0.66, { c: [0.3, 0.3, 0.3] }, x + 0.3, y0 + 1.05, 0, 0, 0, -0.35);
    gl.box(0.02, 0.36, 0.6, {}, x + 0.33, y0 + 1.05, 0, 0, 0, -0.35);
    b.push(M(x - 0.32, y0 + 0.75, 0.0, 0, 0, 0.5));
    b.torus(0.16, 0.018, { c: [0.2, 0.2, 0.2] }, 0, 0, 0, 0, Math.PI / 2, 0, 6, 16);
    b.pop();
    // outboard
    const ox = -L / 2 - 0.1;
    b.rbox(0.45, 0.55, 0.38, 0.08, { c: [0.85, 0.86, 0.88], w: 0.7, l: 1 }, ox - 0.1, gunY(-L / 2) + 0.2, 0);
    b.box(0.12, 0.9, 0.12, { c: [0.25, 0.25, 0.27] }, ox - 0.12, gunY(-L / 2) - 0.4, 0);
    b.cyl(0.11, 0.11, 0.06, { c: [0.25, 0.25, 0.27] }, ox - 0.12, -0.55, 0, 0, 0, Math.PI / 2, 10);
    // bonten flag poles standing in a holder
    for (const [z, c] of [[0.6, [0.95, 0.25, 0.25]], [0.7, [0.25, 0.45, 0.9]], [0.5, [0.98, 0.85, 0.2]]]) {
      const px = -L / 2 + 0.7 + z * 0.3;
      b.bar([px, dk(px), z - 0.1], [px + 0.1, dk(px) + 3.1, z - 0.15], 0.015, { c: [0.75, 0.62, 0.4], t: T.WOOD }, 4);
      b.sphere(0.16, { c: [0.98, 0.55, 0.15], w: 0.7 }, px + 0.02, dk(px) + 0.5, z - 0.1, 1, 1, 1, 8, 6);
      const fg = new THREE.PlaneGeometry(0.35, 0.25, 3, 2);
      fg.translate(-0.175, 0, 0);
      const flagB = new GB();
      flagB.add(fg, { c, t: T.FABRIC, l: 0.6, sway: (v) => [Math.min(1, Math.abs(v.x - px - 0.1) / 0.35), z * 9] }, M(px + 0.1, dk(px) + 2.95, z - 0.15));
      extra.push(flagB.mesh(MAT.flag));
    }
    for (let k = 0; k < 2; k++) fishBox(b, 1.4, dk(1.4) + k * 0.2, 0.3, 0.1);
    fishBox(b, -1.0, dk(-1.0), -0.35, -0.2, { open: true });
    b.sphere(0.35, { c: [0.32, 0.5, 0.55], l: 0.5 }, 1.8, dk(1.8) + 0.05, -0.35, 1.2, 0.45, 0.9, 10, 6);
    b.lathe([[0, 0], [0.14, 0], [0.18, 0.28], [0.16, 0.28], [0.13, 0.03], [0, 0.03]], { c: [0.95, 0.85, 0.2], w: 0.7 }, -1.6, dk(-1.6), 0.4, 14);
  }

  const main = b.mesh(MAT.toon);
  group.add(main);
  if (!gl.isEmpty()) {
    const g = new THREE.Mesh(gl.build(), SP.glass);
    g.renderOrder = 4;
    g.userData.glass = true;
    group.add(g);
  }
  for (const e of extra) group.add(e);
  if (beads.length) {
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), SP.drop, beads.length);
    const m = new THREE.Matrix4();
    beads.forEach((bd, i) => { m.compose(new THREE.Vector3(bd[0], bd[1], bd[2]), new THREE.Quaternion(), new THREE.Vector3(bd[3], bd[3] * 0.7, bd[3])); im.setMatrixAt(i, m); });
    im.userData.beads = true;
    group.add(im);
  }
  // layers
  setLayers(group, {});
  group.traverse((o) => {
    if (o.userData.glass || o.userData.beads || o.userData.local) { o.layers.disableAll(); o.layers.enable(0); }
  });
  return { group, cleats, fenders, drips, L, B, cabin, gunY, hw, kind };
}
