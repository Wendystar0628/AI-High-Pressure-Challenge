import * as THREE from 'three';
import { GB, T, M } from '../core/builder.js';
import { U, WL, rand, rr, srand, setLayers } from '../core/G.js';
import { UNIFORMS_GLSL, NOISE_GLSL, FUNCS_GLSL } from '../core/glsl.js';
import { MAT } from '../core/materials.js';
import { SP } from '../core/special.js';
import { LAY, slipY, seabedH } from './layout.js';
import { fishBox, crate, bollard } from './helpers.js';
import { hullGeometry } from './hull.js';
import { POLE_TOP } from './nature.js';

export const PROPS = {
  lamps: [],        // lamp ring centres
  drips: [],        // {pos, ground, period}
  bollards: [],     // positions (top) for mooring & gulls
  perches: [],      // gull perch points
  buoy: null,
  windsock: null,
  skiff: null,
  catHome: new THREE.Vector3(15.1, 0, 8.6),
  umbrella: null,
};

function catenary(a, b, sag, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return pts;
}

function lampPost(ctx, x, y, z, ry = 0) {
  const b = ctx.main;
  const H = 4.3;
  const dark = { c: [0.32, 0.4, 0.44], t: T.PAINT, w: 0.5, l: 1 };
  b.cyl(0.16, 0.2, 0.35, { ...dark, t: T.RUST }, x, y + 0.175, z, 0, 0, 0, 12);
  b.cyl(0.06, 0.085, H, dark, x, y + H / 2, z, 0, 0, 0, 10);
  // curved arm
  const dx = Math.cos(ry), dz = Math.sin(ry);
  const arm = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    arm.push(new THREE.Vector3(x + dx * t * 0.75, y + H + Math.sin(t * Math.PI * 0.5) * 0.35 - t * t * 0.1, z + dz * t * 0.75));
  }
  b.tube(arm, 0.04, dark, 12, 6);
  const cx = x + dx * 0.75, cz = z + dz * 0.75, cy = y + H + 0.12;
  // ring-shaped lamp shade
  b.torus(0.36, 0.075, { c: [0.9, 0.92, 0.9], t: T.PAINT, w: 0.8, l: 1 }, cx, cy, cz, Math.PI / 2, 0, 0, 10, 32);
  b.torus(0.36, 0.035, { c: [1.0, 0.97, 0.86], e: 0.55, w: 0.4 }, cx, cy - 0.06, cz, Math.PI / 2, 0, 0, 6, 32);
  b.cyl(0.07, 0.07, 0.08, dark, cx, cy + 0.06, cz, 0, 0, 0, 8);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.bar([cx, cy + 0.08, cz], [cx + Math.cos(a) * 0.36, cy + 0.02, cz + Math.sin(a) * 0.36], 0.012, dark, 4);
  }
  PROPS.lamps.push(new THREE.Vector3(cx, cy, cz));
  // drips from the ring bottom
  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2;
    PROPS.drips.push({ pos: new THREE.Vector3(cx + Math.cos(a) * 0.36, cy - 0.08, cz + Math.sin(a) * 0.36), ground: y, period: rr(2.5, 5) });
  }
  // beads on the ring
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2;
    ctx.beads.push([cx + Math.cos(a) * 0.36, cy - 0.075, cz + Math.sin(a) * 0.36, rr(0.012, 0.022)]);
  }
  return new THREE.Vector3(x, y + H + 0.3, z);
}

function ladder(ctx, axis, at, along, yTop, yBot, facing) {
  const b = ctx.main;
  const o = { c: [0.55, 0.36, 0.26], t: T.RUST, w: 0.7, l: 0.9 };
  const off = at + facing * 0.22;
  for (const s of [-0.22, 0.22]) {
    const p0 = axis === 'z' ? [off, yTop, along + s] : [along + s, yTop, off];
    const p1 = axis === 'z' ? [off, yBot, along + s] : [along + s, yBot, off];
    b.bar(p0, p1, 0.028, o, 6);
    // top hoops
    const q = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const r = Math.sin(t * Math.PI) * 0.6;
      const d = off - facing * 0.55 * t;
      q.push(axis === 'z' ? new THREE.Vector3(d, yTop + r, along + s) : new THREE.Vector3(along + s, yTop + r, d));
    }
    b.tube(q, 0.026, o, 10, 6);
  }
  for (let y = yTop - 0.15; y > yBot; y -= 0.3) {
    const p0 = axis === 'z' ? [off, y, along - 0.22] : [along - 0.22, y, off];
    const p1 = axis === 'z' ? [off, y, along + 0.22] : [along + 0.22, y, off];
    b.bar(p0, p1, 0.02, o, 5);
  }
  // brackets
  for (const y of [yTop - 0.4, yTop - 1.5, yBot + 0.3]) {
    for (const s of [-0.22, 0.22]) {
      const p0 = axis === 'z' ? [at, y, along + s] : [along + s, y, at];
      const p1 = axis === 'z' ? [off, y, along + s] : [along + s, y, off];
      b.bar(p0, p1, 0.02, o, 4);
    }
  }
}

function mooringRing(ctx, axis, at, along, y, facing) {
  const b = ctx.main;
  const p = axis === 'z' ? [at + facing * 0.03, y, along] : [along, y, at + facing * 0.03];
  b.box(axis === 'z' ? 0.04 : 0.22, 0.22, axis === 'z' ? 0.22 : 0.04, { c: [0.45, 0.32, 0.25], t: T.RUST }, ...p);
  const r = axis === 'z' ? [at + facing * 0.1, y - 0.12, along] : [along, y - 0.12, at + facing * 0.1];
  b.torus(0.12, 0.022, { c: [0.5, 0.3, 0.2], t: T.RUST, w: 0.6 }, ...r, 0, axis === 'z' ? Math.PI / 2 : 0, 0, 6, 16);
}

/** barnacles, oysters and hanging seaweed along a wall near the waterline */
function wallLife(ctx, axis, at, from, to, facing) {
  const b = ctx.main;
  const bar = new THREE.ConeGeometry(0.035, 0.04, 6);
  const oy = new THREE.SphereGeometry(0.06, 6, 4);
  for (let a = from; a < to; a += 0.06) {
    if (rand() > 0.55) continue;
    const y = WL + rr(-0.75, 0.28) * (rand() > 0.3 ? 1 : 0.5);
    const p = (d) => (axis === 'z' ? [at + facing * d, y, a] : [a, y, at + facing * d]);
    const isOy = rand() > 0.82;
    const rx = axis === 'z' ? 0 : facing * Math.PI / 2;
    const rz = axis === 'z' ? -facing * Math.PI / 2 : 0;
    if (isOy) {
      const pp = p(0.05);
      b.add(oy, { c: [0.68, 0.66, 0.6], t: T.BLOCK, l: 0.5 }, M(pp[0], pp[1], pp[2], rx + rand(), rand(), rz, 1.3, 0.5, 1));
    } else {
      const pp = p(0.05);
      const s = rr(0.6, 1.3);
      b.add(bar, { c: [0.86, 0.85, 0.8], t: T.PLAIN, l: 0.35 }, M(pp[0], pp[1], pp[2], rx, 0, rz, s, s, s));
    }
  }
  // hanging seaweed ribbons
  for (let a = from + 0.2; a < to; a += rr(0.18, 0.5)) {
    const top = WL + rr(-0.15, 0.08);
    const len = rr(0.4, 1.3);
    const w = rr(0.04, 0.09);
    const seg = 6;
    const g = new THREE.PlaneGeometry(w, len, 1, seg);
    g.translate(0, -len / 2, 0);
    const ph = rand() * 6.28;
    const col = rand() > 0.5 ? [0.32, 0.5, 0.3] : [0.42, 0.52, 0.26];
    const m = axis === 'z' ? M(at + facing * 0.08, top, a, 0, Math.PI / 2, rr(-0.2, 0.2)) : M(a, top, at + facing * 0.08, 0, 0, rr(-0.2, 0.2));
    ctx.weed.add(g, { c: col, t: T.PLAIN, l: 0.3, sway: (v) => [Math.min(1, (top - v.y) / len) * 1.2, ph] }, m);
  }
}

function seagrass(ctx, x, z, n = 9) {
  const y = seabedH(x, z);
  for (let i = 0; i < n; i++) {
    const len = rr(0.5, 1.4), w = rr(0.04, 0.07);
    const g = new THREE.PlaneGeometry(w, len, 1, 6);
    g.translate(0, len / 2, 0);
    const ph = rand() * 6.28;
    const px = x + rr(-0.35, 0.35), pz = z + rr(-0.35, 0.35);
    ctx.weed.add(g, { c: [0.3 + rr(0, 0.1), 0.55 + rr(0, 0.1), 0.32], t: T.PLAIN, l: 0.25, sway: (v) => [Math.max(0, (v.y - y) / len) * 1.4, ph] }, M(px, y - 0.05, pz, rr(-0.15, 0.15), rand() * 3, rr(-0.15, 0.15)));
  }
}

export function buildProps(ctx) {
  srand(2024);
  const b = ctx.main;
  ctx.beads = [];

  // --- lamp posts --------------------------------------------------------------
  const lampTops = [];
  lampTops.push(lampPost(ctx, -9.0, 0, 5.3, -Math.PI * 0.75));
  lampTops.push(lampPost(ctx, 0.7, 0, 9.0, -Math.PI / 2));
  lampTops.push(lampPost(ctx, 12.2, 0, 7.1, -Math.PI / 2));
  lampTops.push(lampPost(ctx, -6.4, LAY.bw.top, -10.0, 0));

  // electric wires: pole on hill -> lamp1 -> lamp2 -> lamp3, and lamp4
  const wire = { c: [0.15, 0.17, 0.2], l: 0.8 };
  const chain = [POLE_TOP.clone(), lampTops[0], lampTops[1], lampTops[2]];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i], c = chain[i + 1];
    const d = a.distanceTo(c);
    b.tube(catenary(a, c, d * 0.04, 20), 0.014, wire, 24, 4);
    b.tube(catenary(a.clone().add(new THREE.Vector3(0, -0.25, 0)), c.clone().add(new THREE.Vector3(0, -0.2, 0)), d * 0.05, 20), 0.01, wire, 24, 4);
  }
  b.tube(catenary(POLE_TOP.clone(), lampTops[3], 0.25, 16), 0.012, wire, 20, 4);
  // a long wire crossing the sky toward the far edge (to the right wall)
  b.tube(catenary(lampTops[2], new THREE.Vector3(19.8, 6.0, 15.5), 0.35, 16), 0.012, wire, 20, 4);
  b.cyl(0.1, 0.13, 6.6, { c: [0.72, 0.72, 0.7], t: T.CONCRETE }, 19.6, 3.3, 15.5, 0, 0, 0, 10);
  b.box(1.0, 0.08, 0.08, { c: [0.45, 0.45, 0.45], t: T.RUST }, 19.6, 6.1, 15.5);
  // small birds-on-wire perches
  PROPS.perches.push(new THREE.Vector3().lerpVectors(lampTops[1], lampTops[2], 0.45).add(new THREE.Vector3(0, -0.18, 0)));

  // --- bollards ------------------------------------------------------------------
  const bl = [];
  for (const z of [4.9, 1.4, -2.0, -5.4, -8.6]) bl.push([LAY.leftX - 0.75, 0, z]);
  for (const x of [-5.4, -0.6, 10.3, 12.9, 18.4]) bl.push([x, 0, LAY.frontZ + 0.75]);
  for (const x of [5.2, 9.3]) bl.push([x, LAY.plat.y, LAY.frontZ + 0.55]);
  for (const x of [-4.0, 1.5]) bl.push([x, LAY.bw.top + 0.05, LAY.bw.z1 - 0.5]);
  for (const p of bl) {
    bollard(b, p[0], p[2], p[1], 1);
    PROPS.bollards.push(new THREE.Vector3(p[0], p[1] + 0.68, p[2]));
    PROPS.perches.push(new THREE.Vector3(p[0], p[1] + 0.69, p[2]));
  }
  // thick rope wrapped around a bollard, draping into the water
  {
    const bx = LAY.leftX - 0.75, bz = -8.6;
    for (let k = 0; k < 4; k++) b.torus(0.2 + k * 0.012, 0.045, { c: [0.85, 0.42, 0.22], t: T.ROPE, w: 0.6, uvs: [3, 1] }, bx, 0.3 + k * 0.075, bz, Math.PI / 2 + rr(-0.08, 0.08), 0, rr(-0.1, 0.1), 6, 20);
    const pts = [new THREE.Vector3(bx + 0.2, 0.36, bz + 0.05), new THREE.Vector3(bx + 0.55, 0.3, bz + 0.1), new THREE.Vector3(LAY.leftX + 0.1, 0.27, bz + 0.2), new THREE.Vector3(LAY.leftX + 0.35, -0.3, bz + 0.3), new THREE.Vector3(LAY.leftX + 0.6, -1.0, bz + 0.45), new THREE.Vector3(LAY.leftX + 1.1, -1.7, bz + 0.7), new THREE.Vector3(LAY.leftX + 1.6, -2.4, bz + 0.6), new THREE.Vector3(LAY.leftX + 2.4, -3.2, bz + 0.2)];
    b.tube(pts, 0.05, { c: [0.85, 0.42, 0.22], t: T.ROPE, w: 0.5, uvs: [10, 1] }, 40, 7);
    // a coil on the ground
    for (let k = 0; k < 5; k++) b.torus(0.32 - k * 0.04, 0.04, { c: [0.85, 0.42, 0.22], t: T.ROPE, w: 0.5, uvs: [4, 1] }, bx - 0.9, 0.04 + k * 0.012, bz + 0.3, Math.PI / 2, 0, 0, 6, 20);
  }
  // black rubber fenders on the left wall
  for (const z of [3.3, -0.5, -4.0, -7.2]) {
    b.rbox(0.3, 1.2, 0.5, 0.06, { c: [0.14, 0.15, 0.16], w: 0.5, l: 0.9 }, LAY.leftX + 0.18, -0.95, z);
  }
  for (const x of [-3.0, 2.2 + 4.0, 15.0]) {
    if (x > LAY.slip.x0 - 0.5 && x < LAY.slip.x1 + 0.5) continue;
    b.rbox(0.5, 1.2, 0.3, 0.06, { c: [0.14, 0.15, 0.16], w: 0.5, l: 0.9 }, x, -0.95 + (x > 4 && x < 10 ? -0.3 : 0), LAY.frontZ - 0.18);
  }

  // --- ladders & mooring rings ------------------------------------------------------
  ladder(ctx, 'z', LAY.leftX, -9.0 + 0.0, 0.0, -2.8, 1);
  ladder(ctx, 'x', LAY.frontZ, 11.2, 0.0, -2.8, -1);
  ladder(ctx, 'x', LAY.frontZ, -7.2, 0.0, -2.6, -1);
  for (let z = -8.0; z < 5.5; z += 2.6) mooringRing(ctx, 'z', LAY.leftX, z + 0.4, -0.6, 1);
  for (const x of [-4.5, 0.4, 10.6, 13.0, 18.0]) mooringRing(ctx, 'x', LAY.frontZ, x, -0.6, -1);
  // barnacles & seaweed
  wallLife(ctx, 'z', LAY.leftX + 0.0, LAY.bw.z1 + 0.1, LAY.frontZ - 0.1, 1);
  wallLife(ctx, 'x', LAY.frontZ, LAY.leftX + 0.1, LAY.slip.x0 - 0.1, -1);
  wallLife(ctx, 'x', LAY.frontZ, LAY.slip.x1 + 0.1, 19.9, -1);
  wallLife(ctx, 'x', LAY.bw.z1, LAY.bw.x0 + 0.2, LAY.bw.x1, 1);
  // seagrass clumps on the seabed (several near the right section wall)
  for (const p of [[17.5, -3], [18.6, -8.5], [16.0, -13.5], [18.9, 0.5], [12, -5], [6, -1], [-3, 2], [-5, -5], [2, -7.5], [14.5, -17.5], [9, -16.5], [18.5, -16.0], [3, -18.5], [-4, -17]]) seagrass(ctx, p[0], p[1], 6 + Math.floor(rand() * 6));

  // --- fish boxes & crates ----------------------------------------------------------
  // in front of warehouse
  for (let i = 0; i < 3; i++) for (let k = 0; k < 5 - i; k++) fishBox(b, -10.6 + i * 0.66, k * 0.2, -8.3, rr(-0.06, 0.06));
  for (let k = 0; k < 4; k++) crate(b, -10.4, k * 0.3, -7.4, rr(-0.06, 0.06));
  for (let k = 0; k < 3; k++) crate(b, -9.8, k * 0.3, -7.45, rr(-0.06, 0.06));
  for (let k = 0; k < 2; k++) crate(b, -10.1, k * 0.3, -6.85, 0.3 + rr(-0.06, 0.06));
  // on the front quay near the corner
  for (let i = 0; i < 2; i++) for (let k = 0; k < 6 - i * 2; k++) fishBox(b, -6.6 + i * 0.66, k * 0.2, 9.4, rr(-0.06, 0.06));
  fishBox(b, -5.3, 0, 9.5, 0.4, { open: true });
  for (let k = 0; k < 3; k++) crate(b, -6.3, k * 0.3, 10.2, rr(-0.06, 0.06));
  for (let k = 0; k < 2; k++) crate(b, -5.7, k * 0.3, 10.25, 0.15);
  // near the platform
  for (let k = 0; k < 4; k++) fishBox(b, 6.6, k * 0.2, 9.9, rr(-0.06, 0.06));
  for (let k = 0; k < 2; k++) crate(b, 7.3, k * 0.3, 9.9, 0.1);

  // --- net drying rack + float strings ----------------------------------------------------
  {
    const x0 = -4.8, x1 = -1.0, z = 15.2, h = 1.9;
    const pipe = { c: [0.48, 0.42, 0.38], t: T.RUST, w: 0.5, l: 0.9 };
    for (const x of [x0, (x0 + x1) / 2, x1]) {
      b.bar([x, 0, z - 0.6], [x, h, z], 0.035, pipe, 6);
      b.bar([x, 0, z + 0.6], [x, h, z], 0.035, pipe, 6);
    }
    b.bar([x0 - 0.1, h, z], [x1 + 0.1, h, z], 0.035, pipe, 6);
    b.bar([x0, 0.6, z - 0.42], [x1, 0.6, z - 0.42], 0.025, pipe, 6);
    b.bar([x0, 0.6, z + 0.42], [x1, 0.6, z + 0.42], 0.025, pipe, 6);
    // net draped over the top bar (both sides), with folds
    const ng = new THREE.PlaneGeometry(x1 - x0 - 0.1, 3.6, 24, 24);
    const p = ng.attributes.position;
    const sw = [];
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = p.getY(i); // v from -1.8..1.8 across the bar
      const s = v / 1.8;
      const zz = z + Math.sin(s * Math.PI / 2) * 0.62 * (Math.abs(s) > 0.15 ? 1 : Math.abs(s) / 0.15) + 0.06 * Math.sin(u * 7 + v * 3);
      const yy = h + 0.02 - Math.abs(v) * 0.5 - Math.max(0, Math.abs(v) - 0.6) * 0.45 + 0.05 * Math.sin(u * 5.0 + v * 2);
      p.setXYZ(i, (x0 + x1) / 2 + u, Math.max(0.08, yy), zz);
    }
    ng.computeVertexNormals();
    ctx.net.add(ng, { c: [0.28, 0.55, 0.52], t: T.PLAIN, l: 0.25, sway: (v) => [Math.max(0, (h - v.y) / h) * 0.8 + 0.1, v.x * 0.7] });
    // float strings hung along the lower rails
    const floatCols = [[0.98, 0.55, 0.18], [0.96, 0.96, 0.92], [0.98, 0.78, 0.2]];
    for (const zz of [z - 0.48, z + 0.48]) {
      const pts = catenary(new THREE.Vector3(x0, 0.62, zz), new THREE.Vector3(x1, 0.62, zz), 0.25, 24);
      b.tube(pts, 0.012, { c: [0.85, 0.85, 0.8], t: T.ROPE }, 30, 4);
      for (let i = 2; i < pts.length - 1; i += 2) {
        const q = pts[i];
        b.sphere(0.07, { c: floatCols[i % 3], w: 0.7, l: 0.7 }, q.x, q.y - 0.05, q.z + (zz > z ? 0.03 : -0.03), 1, 0.85, 1, 10, 6);
      }
    }
    // pile of floats & net on a pallet
    b.box(1.2, 0.12, 1.0, { c: [0.62, 0.5, 0.36], t: T.WOOD }, 1.0, 0.06, 15.3);
    for (let i = 0; i < 26; i++) {
      const fx = 1.0 + rr(-0.5, 0.5), fz = 15.3 + rr(-0.4, 0.4);
      b.sphere(0.12, { c: floatCols[i % 3], w: 0.7, l: 0.7 }, fx, 0.2 + rr(0, 0.3) * (1 - Math.abs(fx - 1.0)), fz, 1, 0.9, 1, 10, 6);
    }
    for (let i = 0; i < 6; i++) b.sphere(rr(0.22, 0.32), { c: [0.24, 0.46, 0.44], t: T.FABRIC, l: 0.5 }, 1.6 + rr(-0.35, 0.35), 0.05, 14.4 + rr(-0.3, 0.3), 1.2, 0.5, 1.0, 10, 6);
  }

  // --- oil drums, tires, cones --------------------------------------------------------
  const drum = (x, z, c, tip = 0) => {
    b.cyl(0.29, 0.29, 0.88, { c, t: T.PAINT, w: 0.6, l: 1 }, x, 0.44, z, tip, 0, 0, 14);
    for (const y of [0.3, 0.6]) b.torus(0.293, 0.015, { c: [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8] }, x, y, z, Math.PI / 2, 0, 0, 4, 18);
  };
  drum(-11.0, 2.6, [0.25, 0.42, 0.7]); drum(-10.35, 2.8, [0.82, 0.28, 0.22]); drum(-10.7, 3.4, [0.25, 0.42, 0.7]);
  for (let k = 0; k < 4; k++) b.torus(0.36, 0.13, { c: [0.13, 0.13, 0.14], w: 0.4, l: 0.9 }, 10.8, 0.13 + k * 0.25, 9.6, Math.PI / 2, 0, rr(-0.05, 0.05), 8, 18);
  for (const p of [[13.0, 10.8], [17.2, 11.2]]) {
    b.cyl(0.03, 0.18, 0.55, { c: [0.98, 0.45, 0.15], w: 0.6, cf: (v) => (v.y > 0.3 && v.y < 0.42 ? [0.96, 0.96, 0.95] : [0.98, 0.45, 0.15]) }, p[0], 0.3, p[1], 0, 0, 0, 12);
    b.box(0.4, 0.04, 0.4, { c: [0.15, 0.15, 0.15] }, p[0], 0.02, p[1]);
  }

  // --- winch at slipway top + cable --------------------------------------------------------------
  const s = LAY.slip;
  const wx = (s.x0 + s.x1) / 2, wz = s.zTop + 1.2;
  {
    const rust = { c: [0.5, 0.36, 0.28], t: T.RUST, w: 0.4, l: 1 };
    b.box(1.3, 0.12, 0.9, rust, wx, 0.06, wz);
    for (const dx of [-0.5, 0.5]) b.box(0.08, 0.8, 0.7, rust, wx + dx, 0.5, wz);
    b.cyl(0.18, 0.18, 0.9, { c: [0.45, 0.3, 0.24], t: T.RUST }, wx, 0.6, wz, 0, 0, Math.PI / 2, 14);
    for (let k = 0; k < 7; k++) b.torus(0.2, 0.02, { c: [0.35, 0.33, 0.32], t: T.RUST }, wx - 0.36 + k * 0.12, 0.6, wz, 0, Math.PI / 2, 0, 4, 16);
    b.cyl(0.3, 0.3, 0.05, { c: [0.45, 0.32, 0.25], t: T.RUST }, wx + 0.58, 0.6, wz, 0, 0, Math.PI / 2, 18);
    b.cyl(0.12, 0.12, 0.06, { c: [0.45, 0.32, 0.25], t: T.RUST }, wx + 0.58, 0.85, wz - 0.25, 0, 0, Math.PI / 2, 10);
    b.bar([wx + 0.62, 0.6, wz], [wx + 0.62, 0.95, wz + 0.25], 0.03, rust, 6);
    b.bar([wx + 0.62, 0.95, wz + 0.25], [wx + 0.85, 0.95, wz + 0.25], 0.035, { c: [0.3, 0.25, 0.2] }, 6);
    // cable down the ramp to the skiff
    b.tube([[wx, 0.45, wz - 0.15], [wx, 0.1, wz - 1.0], [wx + 0.05, slipY(10.0) + 0.15, 10.0], [wx + 0.05, slipY(9.2) + 0.32, 9.2]].map((q) => new THREE.Vector3(...q)), 0.018, { c: [0.35, 0.33, 0.32], t: T.RUST }, 16, 5);
  }
  // --- overturned wooden skiff, half pulled up the slipway -----------------------------
  {
    const hg = hullGeometry({ L: 3.8, B: 1.35, freeboard: 0.45, draft: 0.12, sheer: 0.18, transom: 0.7, nu: 18, nv: 6, flare: 0.08 });
    const sk = new GB();
    const ang = Math.atan2(-s.yEnd, s.zTop - s.zEnd);
    const cz = 8.4, cy = slipY(cz) + 0.5;
    // flip (rotate 180 deg about the length axis) and align with the ramp (bow uphill toward +z)
    const m = new THREE.Matrix4().makeTranslation(wx, cy, cz)
      .multiply(new THREE.Matrix4().makeRotationX(ang))
      .multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI));
    sk.add(hg.shell, { t: T.WOOD, w: 0.6, l: 1, uvs: [1, 1], cf: (v) => [0.56, 0.42, 0.3] }, m);
    sk.add(hg.transom, { c: [0.5, 0.38, 0.27], t: T.WOOD, w: 0.6 }, m);
    // painted stripe & keel strip
    const km = m.clone().multiply(M(0, -0.12, 0));
    const keel = new THREE.BoxGeometry(3.6, 0.07, 0.09);
    sk.add(keel, { c: [0.35, 0.28, 0.22], t: T.WOOD }, m.clone().multiply(M(0, -0.13, 0)));
    // blocks propping the stern side up a little so the cat fits underneath
    sk.box(0.35, 0.22, 0.25, { c: [0.5, 0.4, 0.3], t: T.WOOD }, wx - 0.5, slipY(7.0) + 0.1, 7.0, ang, 0, 0);
    sk.box(0.35, 0.22, 0.25, { c: [0.5, 0.4, 0.3], t: T.WOOD }, wx + 0.5, slipY(7.0) + 0.1, 7.0, ang, 0, 0);
    const mesh = sk.mesh(MAT.toonDS);
    ctx.scene.add(mesh);
    setLayers(mesh, {});
    PROPS.skiff = mesh;
    PROPS.catHome.set(wx, slipY(8.4) + 0.05, 8.4);
    // drips from the skiff gunwale
    PROPS.drips.push({ pos: new THREE.Vector3(wx + 0.68, slipY(8.0) + 0.05, 8.0), ground: slipY(8.0), period: 3.2 });
  }

  // --- small davit crane at the edge -------------------------------------------------------
  {
    const cx = 9.95, cz = LAY.frontZ + 0.55;
    const paint = { c: [0.95, 0.75, 0.2], t: T.PAINT, w: 0.5, l: 1 };
    b.cyl(0.25, 0.3, 0.2, { c: [0.6, 0.6, 0.58], t: T.CONCRETE }, cx, 0.1, cz, 0, 0, 0, 12);
    b.cyl(0.09, 0.11, 2.6, paint, cx, 1.4, cz, 0, 0, 0, 10);
    b.bar([cx, 2.6, cz], [cx, 2.95, cz - 1.5], 0.07, paint, 8);
    b.bar([cx, 1.6, cz], [cx, 2.75, cz - 0.95], 0.04, paint, 6);
    b.cyl(0.09, 0.09, 0.08, { c: [0.3, 0.3, 0.3], t: T.RUST }, cx, 2.9, cz - 1.5, 0, 0, Math.PI / 2, 10);
    b.bar([cx, 2.85, cz - 1.5], [cx, 1.2, cz - 1.5], 0.01, { c: [0.3, 0.3, 0.3] }, 4);
    b.torus(0.06, 0.015, { c: [0.35, 0.3, 0.28], t: T.RUST }, cx, 1.14, cz - 1.5, 0, 0, 0, 4, 10, Math.PI * 1.4);
    // hand crank winch on the post
    b.cyl(0.08, 0.08, 0.2, { c: [0.45, 0.32, 0.25], t: T.RUST }, cx + 0.15, 1.2, cz, 0, 0, Math.PI / 2, 10);
    b.bar([cx + 0.27, 1.2, cz], [cx + 0.27, 1.38, cz + 0.12], 0.02, { c: [0.4, 0.3, 0.25], t: T.RUST }, 4);
  }

  // --- harbour sign ----------------------------------------------------------------------
  {
    const sx = 7.6, sz = 8.95, ry = 0.25;
    b.push(M(sx, 0, sz, 0, ry, 0));
    for (const dx of [-0.75, 0.75]) b.cyl(0.04, 0.045, 2.1, { c: [0.6, 0.62, 0.62], t: T.RUST }, dx, 1.05, -0.03, 0, 0, 0, 8);
    b.box(1.75, 1.15, 0.05, { c: [0.78, 0.79, 0.78], t: T.PAINT, w: 0.5 }, 0, 1.55, -0.05);
    b.pop();
    ctx.decal(ctx.TX.portSign, 1.7, 1.06, M(sx, 0, sz, 0, ry, 0).multiply(M(0, 1.55, -0.02)), { w: 0.3, l: 0.8 });
  }

  // --- windsock + flag pole -------------------------------------------------------------------
  {
    const px = 18.6, pz = 9.3;
    b.cyl(0.05, 0.06, 4.2, { c: [0.85, 0.86, 0.85], t: T.PAINT }, px, 2.1, pz, 0, 0, 0, 8);
    b.cyl(0.12, 0.15, 0.2, { c: [0.6, 0.6, 0.6], t: T.CONCRETE }, px, 0.1, pz, 0, 0, 0, 10);
    const sock = new THREE.Group();
    const sb = new GB();
    sb.torus(0.17, 0.015, { c: [0.7, 0.7, 0.7] }, 0, 0, 0, 0, Math.PI / 2, 0, 4, 16);
    sock.add(sb.mesh(MAT.toon));
    const segs = [];
    let parent = sock;
    for (let i = 0; i < 5; i++) {
      const g = new GB();
      const r0 = 0.17 - i * 0.022, r1 = 0.17 - (i + 1) * 0.022;
      const c = i % 2 ? [0.97, 0.97, 0.95] : [0.95, 0.35, 0.18];
      g.cyl(r1, r0, 0.3, { c, t: T.FABRIC, w: 0.5, l: 0.7 }, 0.15, 0, 0, 0, 0, -Math.PI / 2, 12, true);
      const m = g.mesh(MAT.toonDS);
      const holder = new THREE.Group();
      holder.add(m);
      holder.position.x = i === 0 ? 0 : 0.3;
      parent.add(holder);
      segs.push(holder);
      parent = holder;
    }
    sock.position.set(px, 4.15, pz);
    setLayers(sock, {});
    ctx.scene.add(sock);
    PROPS.windsock = { group: sock, segs, x: px, z: pz };
    // small pennant flag on the pole top
    const fg = new THREE.PlaneGeometry(0.6, 0.35, 12, 6);
    fg.translate(0.3, 0, 0);
    const flag = new GB();
    flag.add(fg, { c: [0.2, 0.45, 0.85], t: T.FABRIC, l: 0.6, sway: (v) => [v.x / 0.6, 0.3], cff: (v) => (v.y > 0.0 ? [0.95, 0.95, 0.92] : [0.2, 0.45, 0.85]) });
    const fm = flag.mesh(MAT.flag);
    fm.position.set(px, 4.45, pz);
    setLayers(fm, {});
    ctx.scene.add(fm);
    PROPS.flags = [{ mesh: fm, x: px, z: pz, y: 4.45 }];
  }
  // co-op flag pole by the warehouse
  {
    const px = -11.0, pz = 0.1;
    b.cyl(0.04, 0.05, 5.0, { c: [0.85, 0.86, 0.85], t: T.PAINT }, px, 2.5, pz, 0, 0, 0, 8);
    b.sphere(0.07, { c: [0.9, 0.75, 0.3], w: 0.8 }, px, 5.05, pz);
    const fg = new THREE.PlaneGeometry(1.2, 0.8, 30, 20);
    fg.translate(0.6, 0, 0);
    const flag = new GB();
    flag.add(fg, { c: [0.95, 0.95, 0.92], t: T.FABRIC, l: 0.6, sway: (v) => [v.x / 1.2, 1.1], cff: (v) => { const dx = v.x - 0.6, dy = v.y; return Math.hypot(dx, dy * 1.1) < 0.22 ? [0.85, 0.2, 0.2] : (Math.abs(dy) > 0.3 ? [0.2, 0.4, 0.75] : [0.95, 0.95, 0.92]); } });
    const fm = flag.mesh(MAT.flag);
    fm.position.set(px, 4.55, pz);
    setLayers(fm, {});
    ctx.scene.add(fm);
    PROPS.flags.push({ mesh: fm, x: px, z: pz, y: 4.55 });
  }

  // --- long-handled net & bucket leaning on warehouse wall ----------------------------------
  {
    const x = -11.25, z = -0.9;
    b.bar([x + 0.55, 0.02, z + 0.05], [x + 0.06, 2.5, z - 0.05], 0.022, { c: [0.75, 0.62, 0.42], t: T.WOOD }, 6);
    b.torus(0.22, 0.015, { c: [0.6, 0.6, 0.6] }, x + 0.04, 2.66, z - 0.06, 0.2, Math.PI / 2, 0.2, 4, 16);
    const ng = new THREE.ConeGeometry(0.2, 0.35, 10, 2, true);
    b.add(ng, { c: [0.3, 0.55, 0.45], t: T.FABRIC, l: 0.4 }, M(x + 0.1, 2.5, z - 0.06, 0, 0, 0.2));
    b.bar([x + 0.95, 0.02, z + 0.4], [x + 0.08, 2.0, z + 0.32], 0.02, { c: [0.6, 0.62, 0.66], t: T.RUST }, 6);
    b.torus(0.18, 0.012, { c: [0.6, 0.6, 0.6] }, x + 0.05, 2.15, z + 0.32, 0.2, Math.PI / 2, 0.2, 4, 14);
    // bucket
    b.lathe([[0, 0], [0.16, 0], [0.2, 0.32], [0.21, 0.33], [0.19, 0.33], [0.155, 0.03], [0, 0.03]], { c: [0.25, 0.55, 0.8], w: 0.7, l: 0.9 }, x + 0.55, 0, z + 0.85, 16);
    b.torus(0.19, 0.008, { c: [0.6, 0.6, 0.6] }, x + 0.55, 0.38, z + 0.85, 0.3, 0, 0, 4, 12, Math.PI);
    b.cyl(0.17, 0.17, 0.01, { c: [0.45, 0.72, 0.8], w: 1 }, x + 0.55, 0.24, z + 0.85, 0, 0, 0, 14);
  }

  // --- bicycle by the waiting room (someone just left) -----------------------------------
  {
    const x = -13.2, z = 13.4, ry = 0.35;
    b.push(M(x, 0, z, 0, ry, 0.12));
    const fr = { c: [0.25, 0.55, 0.62], t: T.PAINT, w: 0.6 };
    for (const dx of [-0.52, 0.52]) {
      b.torus(0.33, 0.02, { c: [0.15, 0.15, 0.15] }, dx, 0.35, 0, 0, 0, 0, 5, 24);
      for (let k = 0; k < 6; k++) b.bar([dx, 0.35, 0], [dx + Math.cos(k) * 0.31, 0.35 + Math.sin(k) * 0.31, 0], 0.004, { c: [0.7, 0.7, 0.7] }, 3);
    }
    b.bar([-0.52, 0.35, 0], [-0.05, 0.38, 0], 0.02, fr, 6);
    b.bar([-0.05, 0.38, 0], [0.38, 0.75, 0], 0.022, fr, 6);
    b.bar([-0.05, 0.38, 0], [-0.18, 0.78, 0], 0.022, fr, 6);
    b.bar([-0.18, 0.78, 0], [0.36, 0.8, 0], 0.022, fr, 6);
    b.bar([0.52, 0.35, 0], [0.4, 0.95, 0], 0.02, fr, 6);
    b.bar([0.4, 0.95, -0.25], [0.4, 0.95, 0.25], 0.015, { c: [0.6, 0.6, 0.6] }, 5);
    b.rbox(0.24, 0.06, 0.12, 0.02, { c: [0.15, 0.15, 0.15] }, -0.2, 0.84, 0);
    b.box(0.3, 0.2, 0.25, { c: [0.6, 0.6, 0.62], t: T.RUST }, 0.55, 0.9, 0);
    b.pop();
  }
  // outdoor bench facing the harbour
  {
    const x = -11.6, z = 8.2;
    const wood = { c: [0.66, 0.5, 0.34], t: T.WOOD, w: 0.6, l: 0.9 };
    for (let i = 0; i < 3; i++) b.box(1.8, 0.04, 0.12, wood, x, 0.44, z - 0.14 + i * 0.14);
    for (const dx of [-0.7, 0.7]) b.box(0.06, 0.44, 0.4, { c: [0.35, 0.36, 0.38], t: T.RUST }, x + dx, 0.22, z);
    // a juice can left behind
    b.cyl(0.033, 0.033, 0.12, { c: [0.95, 0.55, 0.15], w: 0.8 }, x + 0.5, 0.52, z + 0.05, 0, 0, 0, 10);
  }

  // --- two silver-grey instrument hard cases + umbrella -------------------------------------
  {
    const silver = { c: [0.78, 0.8, 0.82], t: T.PLAIN, w: 0.85, l: 1 };
    // violin-like contoured case
    const vs = new THREE.Shape();
    vs.moveTo(-0.38, 0); vs.bezierCurveTo(-0.38, 0.17, -0.24, 0.18, -0.16, 0.15); vs.bezierCurveTo(-0.06, 0.1, 0.04, 0.09, 0.12, 0.08);
    vs.lineTo(0.36, 0.055); vs.quadraticCurveTo(0.43, 0, 0.36, -0.055); vs.lineTo(0.12, -0.08); vs.bezierCurveTo(0.04, -0.09, -0.06, -0.1, -0.16, -0.15);
    vs.bezierCurveTo(-0.24, -0.18, -0.38, -0.17, -0.38, 0);
    const vg = new THREE.ExtrudeGeometry(vs, { depth: 0.1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 10 });
    const cx = 2.7, cz = 10.3;
    b.add(vg, silver, M(cx, 0.04, cz, -Math.PI / 2, 0.15, 0));
    b.torus(0.06, 0.012, { c: [0.2, 0.2, 0.2] }, cx + 0.05, 0.19, cz - 0.01, 0, 0.15, 0, 4, 10, Math.PI);
    // rectangular case (e.g. trumpet), side by side
    b.rbox(0.62, 0.17, 0.32, 0.05, silver, cx + 0.05, 0.1, cz + 0.55, 0, 0.12, 0);
    b.rbox(0.3, 0.06, 0.2, 0.04, silver, cx + 0.2, 0.2, cz + 0.55, 0, 0.12, 0);
    b.torus(0.05, 0.012, { c: [0.2, 0.2, 0.2] }, cx + 0.05, 0.2, cz + 0.4, 0, 0.12, 0, 4, 10, Math.PI);
    for (const dx of [-0.2, 0.25]) b.box(0.04, 0.03, 0.02, { c: [0.85, 0.75, 0.35], w: 1 }, cx + dx, 0.15, cz + 0.39);
    // name tag
    b.box(0.07, 0.1, 0.005, { c: [0.98, 0.7, 0.75] }, cx + 0.3, 0.12, cz + 0.72, 0, 0.12, 0.1);
    // rain beads on cases
    for (let i = 0; i < 30; i++) ctx.beads.push([cx + rr(-0.6, 0.6), 0.2, cz + rr(-0.15, 0.1), rr(0.008, 0.014)]);
    for (let i = 0; i < 20; i++) ctx.beads.push([cx + rr(-0.25, 0.35), 0.19, cz + 0.55 + rr(-0.12, 0.12), rr(0.008, 0.014)]);
  }
  {
    // transparent umbrella leaning on the step side curb
    const ux = LAY.steps.x0 - 0.35, uz = 7.75;
    const g = new THREE.Group();
    const ub = new GB();
    const R = 0.5, Hc = 0.16;
    // ribs
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pts = [];
      for (let k = 0; k <= 5; k++) { const t = k / 5; const r = R * t; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sqrt(0.3844 - r * r) - 0.52 - 0.01, Math.sin(a) * r)); }
      ub.tube(pts, 0.005, { c: [0.85, 0.87, 0.9] }, 8, 3);
    }
    ub.bar([0, 0.05, 0], [0, -0.85, 0], 0.01, { c: [0.85, 0.85, 0.88] }, 6);
    const hook = [];
    for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI; hook.push(new THREE.Vector3(Math.cos(a) * 0.06 - 0.06, -0.85 - Math.sin(a) * 0.06 * 0, 0).add(new THREE.Vector3(0, -Math.sin(a) * 0.07, 0))); }
    ub.tube([new THREE.Vector3(0, -0.85, 0), new THREE.Vector3(0, -0.92, 0), new THREE.Vector3(-0.05, -0.97, 0), new THREE.Vector3(-0.1, -0.93, 0)], 0.016, { c: [0.92, 0.92, 0.95], w: 0.5 }, 10, 6);
    ub.sphere(0.02, { c: [0.9, 0.9, 0.92] }, 0, 0.06, 0);
    ub.add(new THREE.TorusGeometry(0.5, 0.006, 4, 40), { c: [0.88, 0.92, 0.95], l: 1 }, M(0, Math.sqrt(0.3844 - 0.25) - 0.52 - 0.005, 0, Math.PI / 2, 0, 0));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ub.sphere(0.012, { c: [0.85, 0.85, 0.88] }, Math.cos(a) * 0.5, -0.155, Math.sin(a) * 0.5); }
    g.add(ub.mesh(MAT.toon));
    // canopy (transparent)
    const cg = new GB();
    const can = new THREE.SphereGeometry(0.62, 16, 6, 0, Math.PI * 2, 0, 0.95);
    can.translate(0, -0.52, 0);
    cg.add(can, {});
    const umat = SP.glass.clone();
    umat.uniforms = { ...SP.glass.uniforms, uTint: { value: new THREE.Color(0.9, 0.95, 0.97) }, uBase: { value: 0.2 } };
    const cm = new THREE.Mesh(cg.build(), umat);
    cm.renderOrder = 4;
    g.add(cm);
    g.position.set(ux, 0.95, uz);
    g.rotation.set(0.0, 0.3, 0.95);
    setLayers(g, {});
    cm.layers.disableAll(); cm.layers.enable(0);
    ctx.scene.add(g);
    g.updateMatrixWorld(true);
    // beads on the canopy & drip points at rib tips
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.PI * 2, t = Math.sqrt(rand()) * 0.95;
      const r = R * t;
      const p = new THREE.Vector3(Math.cos(a) * r, Math.sqrt(0.3844 - r * r) - 0.52 + 0.012, Math.sin(a) * r);
      p.applyMatrix4(g.matrixWorld);
      ctx.beads.push([p.x, p.y, p.z, rr(0.008, 0.016)]);
    }
    for (let i = 0; i < 8; i += 2) {
      const a = (i / 8) * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * R, -Hc - 0.02, Math.sin(a) * R).applyMatrix4(g.matrixWorld);
      if (p.y > 0.15) PROPS.drips.push({ pos: p, ground: 0, period: rr(2.2, 4.0) });
    }
    PROPS.umbrella = g;
  }

  // --- mooring buoy with faded number (floating) ------------------------------------------------
  {
    const g = new THREE.Group();
    const bb = new GB();
    bb.sphere(0.45, { c: [0.95, 0.5, 0.22], t: T.PAINT, w: 0.7, l: 1, cf: (v) => (v.y > 0.12 ? [0.96, 0.95, 0.92] : [0.93, 0.48, 0.22]) }, 0, 0.12, 0, 1, 0.9, 1, 20, 12);
    bb.torus(0.18, 0.03, { c: [0.45, 0.32, 0.25], t: T.RUST }, 0, 0.58, 0, 0, 0, 0, 5, 12);
    bb.cyl(0.04, 0.04, 0.12, { c: [0.45, 0.32, 0.25], t: T.RUST }, 0, 0.5, 0, 0, 0, 0, 6);
    g.add(bb.mesh(MAT.toon));
    // number band (decal ring)
    const ring = new THREE.CylinderGeometry(0.452, 0.452, 0.24, 24, 1, true);
    const rb = new GB(); rb.add(ring, { c: [1, 1, 1], t: T.PAINT, w: 0.6 }, M(0, 0.0, 0));
    const tm = new THREE.Mesh(rb.build(), ctx.decalMat(ctx.TX.buoyNum));
    g.add(tm);
    setLayers(g, {});
    g.position.set(9.8, WL, -3.2);
    ctx.scene.add(g);
    PROPS.buoy = g;
    PROPS.perches.push(new THREE.Vector3(9.8, WL + 0.62, -3.2));
    // chain to sinker
    const sy = seabedH(10.6, -3.8);
    b.box(0.6, 0.4, 0.6, { c: [0.6, 0.6, 0.58], t: T.BLOCK }, 10.6, sy + 0.1, -3.8);
    const cp = [new THREE.Vector3(9.8, WL - 0.35, -3.2), new THREE.Vector3(10.1, WL - 1.5, -3.4), new THREE.Vector3(10.4, sy + 0.8, -3.7), new THREE.Vector3(10.55, sy + 0.32, -3.8)];
    const curve = new THREE.CatmullRomCurve3(cp);
    for (let i = 0; i < 26; i++) {
      const p = curve.getPoint(i / 26), q = curve.getPoint(Math.min(1, (i + 1) / 26));
      const d = q.clone().sub(p).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      const e = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
      b.add(new THREE.TorusGeometry(0.06, 0.018, 4, 10), { c: [0.42, 0.3, 0.24], t: T.RUST, l: 0.6 }, M(p.x, p.y, p.z, e.x, e.y + (i % 2) * Math.PI / 2, e.z, 1, 1.6, 1));
    }
  }

  // --- underwater junk: old tyre, anchor + chain, bottle ------------------------------
  {
    const tx = 17.6, tz = -6.2, ty = seabedH(tx, tz);
    b.torus(0.42, 0.16, { c: [0.16, 0.17, 0.18], w: 0.3, l: 0.8 }, tx, ty + 0.12, tz, Math.PI / 2 + 0.25, 0.4, 0, 8, 20);
    // anchor
    const ax = 18.2, az = -11.0, ay = seabedH(ax, az);
    const rust = { c: [0.46, 0.33, 0.27], t: T.RUST, l: 0.8 };
    b.push(M(ax, ay + 0.15, az, 0, 0.6, 1.2));
    b.cyl(0.05, 0.05, 1.3, rust, 0, 0, 0, 0, 0, 0, 8);
    b.torus(0.45, 0.05, rust, 0, -0.45, 0, 0, 0, Math.PI, 6, 16, Math.PI);
    b.add(new THREE.ConeGeometry(0.1, 0.25, 6), rust, M(0.45, -0.32, 0, 0, 0, 0));
    b.add(new THREE.ConeGeometry(0.1, 0.25, 6), rust, M(-0.45, -0.32, 0, 0, 0, 0));
    b.bar([-0.3, 0.55, 0], [0.3, 0.55, 0], 0.035, rust, 6);
    b.torus(0.09, 0.025, rust, 0, 0.72, 0, 0, 0, 0, 5, 10);
    b.pop();
    // chain from the anchor across the seabed toward the section wall
    let cxp = ax - 0.5, czp = az + 0.2;
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const x = cxp - t * 3.5 + Math.sin(t * 6) * 0.4, z = czp + t * 4.2;
      const y = seabedH(x, z) + 0.05;
      b.add(new THREE.TorusGeometry(0.07, 0.02, 4, 10), rust, M(x, y, z, Math.PI / 2 * (i % 2), 0.7 + Math.sin(t * 6) * 0.4, 0, 1, 1.6, 1));
    }
    // glass bottle
    b.cyl(0.05, 0.05, 0.22, { c: [0.45, 0.75, 0.55], w: 1, e: 0.2 }, 15.5, seabedH(15.5, -2.0) + 0.05, -2.0, Math.PI / 2, 0.8, 0, 8);
    // starfish & urchins
    for (const p of [[16.8, -9.5], [19.0, -4.5], [13, -14]]) {
      const y = seabedH(p[0], p[1]) + 0.02;
      for (let k = 0; k < 5; k++) b.add(new THREE.ConeGeometry(0.04, 0.16, 4), { c: [0.95, 0.5, 0.3], l: 0.4 }, M(p[0] + Math.cos(k * 1.256) * 0.07, y, p[1] + Math.sin(k * 1.256) * 0.07, Math.PI / 2, -k * 1.256 + Math.PI / 2, 0));
    }
    for (const p of [[18.8, -1.8], [17.2, -14.8], [19.3, -10.2]]) {
      const y = seabedH(p[0], p[1]);
      b.sphere(0.1, { c: [0.25, 0.18, 0.3], l: 0.4 }, p[0], y + 0.05, p[1], 1, 0.7, 1, 8, 6);
      for (let k = 0; k < 14; k++) { const d = new THREE.Vector3(rr(-1, 1), rr(0.1, 1), rr(-1, 1)).normalize(); b.bar([p[0], y + 0.05, p[1]], [p[0] + d.x * 0.2, y + 0.05 + d.y * 0.2, p[1] + d.z * 0.2], 0.006, { c: [0.25, 0.18, 0.3], l: 0.3 }, 3); }
    }
  }

  // --- parked kei truck (someone just stepped away) ---------------------------------------
  {
    const kx = -3.2, kz = 18.2, kry = 0.08;
    b.push(M(kx, 0, kz, 0, kry, 0));
    ctx.glass.push(M(kx, 0, kz, 0, kry, 0));
    const wht = { c: [0.95, 0.95, 0.94], t: T.PAINT, w: 0.8, l: 1 };
    b.box(3.3, 0.22, 1.36, { c: [0.25, 0.26, 0.28], t: T.RUST, l: 0.8 }, 0, 0.42, 0);
    // cab
    b.rbox(0.95, 0.75, 1.42, 0.08, wht, 1.18, 0.86, 0);
    b.rbox(0.78, 0.62, 1.38, 0.08, wht, 1.05, 1.5, 0);
    ctx.glass.box(0.02, 0.48, 1.18, {}, 1.45, 1.52, 0, 0, 0, 0.32);
    ctx.glass.box(0.55, 0.42, 0.02, {}, 1.06, 1.52, 0.7);
    ctx.glass.box(0.55, 0.42, 0.02, {}, 1.06, 1.52, -0.7);
    b.box(0.6, 0.4, 1.3, { c: [0.3, 0.32, 0.34], l: 0.2 }, 1.0, 1.45, 0);
    b.box(0.06, 0.16, 1.3, { c: [0.75, 0.76, 0.78], w: 0.8 }, 1.67, 0.55, 0);
    for (const z of [-0.5, 0.5]) b.box(0.03, 0.1, 0.22, { c: [1.0, 0.98, 0.9], e: 0.3 }, 1.66, 0.82, z);
    b.box(0.02, 0.12, 0.3, { c: [0.95, 0.85, 0.2] }, 1.68, 0.52, 0);
    for (const z of [-0.78, 0.78]) b.box(0.05, 0.14, 0.06, { c: [0.2, 0.2, 0.2] }, 1.4, 1.35, z);
    // bed with gates
    b.box(2.2, 0.06, 1.38, { c: [0.6, 0.62, 0.64], t: T.RUST, w: 0.8 }, -0.5, 0.58, 0);
    for (const z of [-0.68, 0.68]) b.box(2.2, 0.3, 0.04, wht, -0.5, 0.76, z);
    b.box(0.04, 0.3, 1.38, wht, -1.6, 0.76, 0);
    b.box(0.05, 0.42, 1.38, wht, 0.6, 0.8, 0);
    b.bar([0.62, 0.98, -0.65], [0.62, 1.55, -0.65], 0.02, { c: [0.6, 0.6, 0.6] }, 4);
    b.bar([0.62, 0.98, 0.65], [0.62, 1.55, 0.65], 0.02, { c: [0.6, 0.6, 0.6] }, 4);
    b.bar([0.62, 1.55, -0.65], [0.62, 1.55, 0.65], 0.02, { c: [0.6, 0.6, 0.6] }, 4);
    // wheels
    for (const x of [-1.1, 1.1]) for (const z of [-0.6, 0.6]) {
      b.cyl(0.27, 0.27, 0.18, { c: [0.12, 0.12, 0.13], l: 1 }, x, 0.27, z, Math.PI / 2, 0, 0, 16);
      b.cyl(0.13, 0.13, 0.19, { c: [0.8, 0.8, 0.8], w: 0.8 }, x, 0.27, z, Math.PI / 2, 0, 0, 12);
    }
    // cargo
    for (let k = 0; k < 3; k++) fishBox(b, -1.0, 0.61 + k * 0.2, -0.3, 0.05 * k);
    for (let k = 0; k < 2; k++) crate(b, -0.2, 0.61 + k * 0.3, 0.3, 0.1);
    for (let k = 0; k < 4; k++) b.torus(0.3 - k * 0.05, 0.035, { c: [0.85, 0.42, 0.2], t: T.ROPE, w: 0.6 }, -1.1, 0.66 + k * 0.012, 0.35, Math.PI / 2, 0, 0, 5, 16);
    b.pop();
    ctx.glass.pop();
    // beads on the cab roof
    for (let i = 0; i < 30; i++) {
      const lx = 0.75 + rand() * 0.6, lz = rr(-0.6, 0.6);
      ctx.beads.push([kx + lx * Math.cos(kry) + lz * Math.sin(kry), 1.82, kz - lx * Math.sin(kry) + lz * Math.cos(kry), rr(0.01, 0.018)]);
    }
  }
  // --- life ring stand ------------------------------------------------------------------------
  {
    const x = -2.6, z = 7.3;
    b.box(0.08, 1.2, 0.08, { c: [0.85, 0.85, 0.83], t: T.PAINT }, x, 0.6, z);
    b.box(0.75, 0.75, 0.16, { c: [0.85, 0.25, 0.2], t: T.PAINT, w: 0.6 }, x, 1.2, z);
    b.torus(0.26, 0.07, { c: [1, 1, 1], w: 0.6, l: 1, cfl: (v) => { const a = Math.atan2(v.y, v.x); return Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 2 ? [0.98, 0.98, 0.96] : [0.98, 0.45, 0.14]; } }, x, 1.2, z + 0.12, 0, 0, 0, 8, 24);
  }
  // --- octopus pots & cages near the net rack ------------------------------------------------------
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) {
    b.cyl(0.13, 0.15, 0.36, { c: [0.16, 0.17, 0.18], w: 0.7, l: 0.9 }, -7.4 + i * 0.32, 0.18 + 0.0, 15.2 + k * 0.32, Math.PI / 2, 0.0, 0, 10, true);
  }
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3 - i; k++) {
    b.cyl(0.13, 0.15, 0.36, { c: [0.16, 0.17, 0.18], w: 0.7, l: 0.9 }, -7.25 + k * 0.32 + i * 0.16, 0.42 + i * 0.25, 15.2 + 0.32, Math.PI / 2, 0, 0, 10, true);
  }
  for (let k = 0; k < 3; k++) {
    b.box(0.8, 0.4, 0.55, { c: [0.25, 0.5, 0.42], t: T.FABRIC, l: 0.8, cf: (v, n) => (Math.abs(n.y) > 0.5 ? [0.25, 0.5, 0.42] : ((Math.floor(v.x * 14) + Math.floor(v.y * 14)) % 2 ? [0.2, 0.42, 0.36] : [0.3, 0.58, 0.5])) }, -8.6, 0.2 + k * 0.42, 17.2, 0, 0.1 * k, 0);
  }
  // --- styrofoam planters with green onions by the waiting room --------------------------------------
  for (let i = 0; i < 3; i++) {
    const x = -18.6 + i * 0.9, z = 13.3;
    b.rbox(0.7, 0.28, 0.4, 0.02, { c: [0.97, 0.97, 0.95], l: 0.8 }, x, 0.14, z);
    b.box(0.64, 0.02, 0.34, { c: [0.4, 0.3, 0.22] }, x, 0.27, z);
    for (let k = 0; k < 9; k++) {
      const px = x + rr(-0.28, 0.28), pz = z + rr(-0.14, 0.14), h = rr(0.18, 0.4);
      ctx.leaf.add(new THREE.CylinderGeometry(0.008, 0.012, h, 4), { c: [0.35, 0.68, 0.3], t: T.PLAIN, l: 0.4, sway: [0.3, rand() * 6] }, M(px, 0.28 + h / 2, pz, rr(-0.2, 0.2), 0, rr(-0.2, 0.2)));
    }
  }
  // --- weeds in cracks along quay edges & building feet ----------------------------------------
  const weedG = new THREE.ConeGeometry(0.05, 0.16, 4);
  const tuft = (x, y, z) => {
    for (let k = 0; k < 4; k++) ctx.leaf.add(weedG, { c: [0.42 + rr(0, 0.1), 0.66, 0.3], t: T.PLAIN, l: 0.4, sway: [0.15, rand() * 6] }, M(x + rr(-0.06, 0.06), y + 0.07, z + rr(-0.06, 0.06), rr(-0.4, 0.4), rand() * 3, rr(-0.4, 0.4), 0.6, rr(0.7, 1.3), 0.6));
  };
  for (let i = 0; i < 26; i++) tuft(rr(-19.5, 19.5), 0, rr(19.6, 19.85));
  for (let i = 0; i < 10; i++) tuft(rr(-11.3, -11.1), 0, rr(-9.0, -1.0));
  for (let i = 0; i < 8; i++) tuft(rr(-19.3, -13.9), 0, rr(12.7, 12.9));
  for (let i = 0; i < 12; i++) tuft(rr(-7.5, 19), 0, rr(6.8, 7.1));

  // --- fishing gear left on the breakwater (someone stepped away for a moment) -------------
  {
    const y = LAY.bw.top + 0.08;
    const fx = 2.6, fz = -10.4;
    // folding chair
    const fr = { c: [0.55, 0.58, 0.6], w: 0.6, l: 0.9 };
    b.bar([fx - 0.2, y, fz - 0.2], [fx + 0.2, y + 0.42, fz + 0.2], 0.012, fr, 4);
    b.bar([fx + 0.2, y, fz - 0.2], [fx - 0.2, y + 0.42, fz + 0.2], 0.012, fr, 4);
    b.bar([fx - 0.2, y, fz + 0.2], [fx + 0.2, y + 0.42, fz - 0.2], 0.012, fr, 4);
    b.bar([fx + 0.2, y, fz + 0.2], [fx - 0.2, y + 0.42, fz - 0.2], 0.012, fr, 4);
    b.box(0.42, 0.02, 0.42, { c: [0.25, 0.45, 0.35], t: T.FABRIC, w: 0.7 }, fx, y + 0.42, fz);
    // cooler box
    b.rbox(0.55, 0.36, 0.34, 0.04, { c: [0.95, 0.95, 0.92], w: 0.7, l: 1, cf: (v) => (v.y > y + 0.3 ? [0.3, 0.55, 0.85] : [0.95, 0.95, 0.92]) }, fx + 0.7, y + 0.18, fz + 0.1);
    // bucket with a rope
    b.lathe([[0, 0], [0.13, 0], [0.16, 0.24], [0.15, 0.24], [0.12, 0.02], [0, 0.02]], { c: [0.98, 0.6, 0.2], w: 0.7, l: 0.9 }, fx - 0.55, y, fz + 0.15, 14);
    // rods leaning on the parapet, lines over the wall into the sea
    for (const [dx, h] of [[0.0, 3.1], [0.45, 2.7]]) {
      const base = new THREE.Vector3(fx - 0.3 + dx, y, fz + 0.45);
      const tip = new THREE.Vector3(fx - 0.1 + dx, y + h * 0.75, LAY.bw.z0 - 0.9);
      b.bar(base, tip, 0.012, { c: [0.15, 0.15, 0.18], l: 1 }, 4);
      b.cyl(0.03, 0.03, 0.06, { c: [0.6, 0.6, 0.62] }, base.x + (tip.x - base.x) * 0.15, base.y + (tip.y - base.y) * 0.15, base.z + (tip.z - base.z) * 0.15, 0.9, 0, 0, 8);
      b.tube([tip, new THREE.Vector3(tip.x, WL + 0.6, tip.z - 1.2), new THREE.Vector3(tip.x + 0.1, WL - 0.6, tip.z - 2.2)], 0.003, { c: [0.9, 0.9, 0.9], l: 0.3 }, 10, 3);
    }
    // tackle box
    b.rbox(0.3, 0.14, 0.18, 0.02, { c: [0.25, 0.55, 0.45], w: 0.6 }, fx + 0.3, y + 0.07, fz - 0.35, 0, 0.3, 0);
    for (let i = 0; i < 16; i++) ctx.beads.push([fx + 0.7 + rr(-0.24, 0.24), y + 0.37, fz + 0.1 + rr(-0.14, 0.14), rr(0.008, 0.014)]);
  }

  // --- net spread out on the ground for mending, with a float line along one edge -------------
  {
    const ng = new THREE.PlaneGeometry(3.6, 2.4, 18, 12);
    ng.rotateX(-Math.PI / 2);
    const p = ng.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, 0.03 + 0.03 * Math.max(0, Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 2.3)));
    ng.computeVertexNormals();
    ctx.net.add(ng, { c: [0.85, 0.42, 0.25], t: T.PLAIN, l: 0.2, sway: [0, 0] }, M(3.4, 0, 16.8, 0, 0.18, 0));
    const fl = [];
    for (let k = 0; k <= 14; k++) { const t = k / 14; fl.push(new THREE.Vector3(1.7 + t * 3.5, 0.05, 15.2 + t * 0.62 + Math.sin(t * 9) * 0.08)); }
    b.tube(fl, 0.015, { c: [0.9, 0.88, 0.8], t: T.ROPE }, 30, 4);
    for (let k = 1; k < 14; k += 2) b.sphere(0.075, { c: k % 4 === 1 ? [0.98, 0.55, 0.18] : [0.97, 0.97, 0.93], w: 0.7, l: 0.7 }, fl[k].x, 0.08, fl[k].z, 1, 0.8, 1, 10, 6);
    // a mending stool, shuttle & coil next to it
    b.cyl(0.16, 0.16, 0.04, { c: [0.3, 0.5, 0.75], w: 0.5 }, 5.6, 0.36, 17.9, 0, 0, 0, 12);
    for (const [dx, dz] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) b.bar([5.6 + dx, 0, 17.9 + dz], [5.6 + dx * 0.6, 0.34, 17.9 + dz * 0.6], 0.012, { c: [0.6, 0.6, 0.62] }, 4);
    b.box(0.2, 0.012, 0.05, { c: [0.95, 0.85, 0.3] }, 5.2, 0.04, 17.4, 0, 0.6, 0);
    for (let k = 0; k < 6; k++) b.torus(0.22 - k * 0.025, 0.02, { c: [0.2, 0.6, 0.55], t: T.ROPE }, 6.1, 0.03 + k * 0.012, 17.3, Math.PI / 2, 0, 0, 4, 14);
  }
  // --- tarp-covered pile ----------------------------------------------------------------
  {
    const tg = new THREE.BoxGeometry(1.8, 0.9, 1.2, 6, 3, 4);
    const p = tg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = (y + 0.45) / 0.9;
      p.setXYZ(i, x * (1 - k * 0.12) + Math.sin(z * 9 + y * 4) * 0.03, y + Math.sin(x * 5) * Math.cos(z * 4) * 0.05 * k, z * (1 - k * 0.1) + Math.sin(x * 7) * 0.03);
    }
    tg.computeVertexNormals();
    b.add(tg, { c: [0.22, 0.48, 0.82], t: T.FABRIC, w: 0.85, l: 1 }, M(-12.6, 0.45, 18.4, 0, 0.2, 0));
    for (const dx of [-0.7, 0.0, 0.7]) b.bar([-12.6 + dx, 0.92, 17.6], [-12.6 + dx, 0.02, 17.4], 0.01, { c: [0.9, 0.9, 0.85], t: T.ROPE }, 3);
    b.box(0.3, 0.2, 0.3, { c: [0.85, 0.85, 0.83], t: T.CONCRETE }, -11.5, 0.1, 17.6);
  }

  // --- extra drip points: overflowing gutter, awning edge, lighthouse gallery, truck roof -------
  for (let i = 0; i < 6; i++) PROPS.drips.push({ pos: new THREE.Vector3(-19.6 + 0.2 + i * 1.05 + rr(-0.2, 0.2), 2.74, 12.6 + 0.62 + 0.05), ground: 0, period: rr(1.6, 3.4) });
  for (let i = 0; i < 3; i++) PROPS.drips.push({ pos: new THREE.Vector3(-19.2 + 0.68, 2.06, 15.6 - 0.5 + i * 0.5), ground: 0, period: rr(2.0, 3.8) });
  for (let i = 0; i < 4; i++) { const a = -0.6 + i * 0.6; PROPS.drips.push({ pos: new THREE.Vector3(LAY.lh.x + Math.cos(a) * 0.86, LAY.bw.top + 0.37 + 5.2 + 0.0, LAY.lh.z + Math.sin(a) * 0.86), ground: LAY.bw.top + 0.37, period: rr(2.5, 4.5) }); }
  for (let i = 0; i < 3; i++) PROPS.drips.push({ pos: new THREE.Vector3(-3.2 + 1.45 + 0.1 * i, 1.78, 18.2 + 0.7 - 0.25 * i), ground: 0, period: rr(2.6, 4.2) });

  // --- drains, manholes, painted marks on the quay ----------------------------------------
  for (const p of [[-2, 12], [6, 16], [-12, -3.5]]) {
    b.cyl(0.32, 0.32, 0.02, { c: [0.35, 0.36, 0.38], t: T.RUST, w: 0.9, l: 0.6 }, p[0], 0.01, p[1], 0, 0, 0, 20);
  }
  for (let x = -6; x < 12; x += 3.9) {
    b.box(1.2, 0.012, 0.35, { c: [0.25, 0.27, 0.28], t: T.RUST, w: 0.9, l: 0.4, cf: (v) => (Math.floor(v.x * 12) % 2 ? [0.3, 0.32, 0.33] : [0.18, 0.2, 0.22]) }, x, 0.006, 19.2);
  }
  // faded white painted lines (parking / walkway)
  for (const z of [11.4, 17.8]) b.box(14, 0.008, 0.12, { c: [0.95, 0.95, 0.92], w: 0.6, l: 0.0 }, 3.5, 0.004, z);

  return PROPS;
}

// --- puddles with posterised reflections ---------------------------------------------------------
export function buildPuddles(scene, refl) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, tRefl: refl.tex, uReflMat: refl.texMat },
    transparent: true,
    depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: /* glsl */ `
      attribute float aEdge;
      varying vec3 vWP; varying float vEdge;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWP = wp.xyz; vEdge = aEdge; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      uniform sampler2D tRefl; uniform mat4 uReflMat;
      varying vec3 vWP; varying float vEdge;
      ${NOISE_GLSL}
      ${FUNCS_GLSL}
      void main(){
        vec2 p = vWP.xz;
        float t = uTime;
        vec2 grad = vec2(0.0);
        float rings = 0.0;
        float cs = 0.32;
        vec2 cell = floor(p / cs);
        for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++){
          vec2 c = cell + vec2(float(i), float(j));
          vec2 h = hash22(c);
          float period = 1.1 + h.y*0.8;
          float tt = t/period + h.x;
          float k = floor(tt);
          float age = fract(tt);
          if (hash12(c + k*3.17) > 0.2 + uRain*0.7) continue;
          vec2 ctr = (c + 0.2 + 0.6*hash22(c + k*1.71)) * cs;
          vec2 dv = p - ctr;
          float d = length(dv);
          float w = 1.0 - smoothstep(0.0, 0.012, abs(d - age*0.2));
          rings += w*(1.0 - age);
          grad += dv/max(d,1e-3) * w * (1.0 - age) * 0.5;
        }
        vec4 rc = uReflMat * vec4(vWP, 1.0);
        vec2 ruv = rc.xy / rc.w + grad*0.01;
        ruv.x += (vnoise(vec2(floor(vWP.z*14.0), t*0.5)) - 0.5)*0.004;
        vec4 refl = texture2D(tRefl, ruv);
        vec3 V = normalize(cameraPosition - vWP);
        float fr = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.0);
        vec3 sky = mix(vec3(0.74, 0.87, 0.9), vec3(0.88, 0.95, 0.96), fr);
        float rl = dot(refl.rgb, vec3(0.3, 0.55, 0.15));
        vec3 rcol = rl > 0.8 ? vec3(0.86, 0.93, 0.94) : (rl > 0.5 ? vec3(0.58, 0.72, 0.76) : vec3(0.42, 0.55, 0.62));
        vec3 col = mix(sky, rcol, smoothstep(0.4, 0.6, refl.a) * 0.85);
        col = mix(col, vec3(0.95, 1.0, 1.0), clamp(rings, 0.0, 1.0)*0.5);
        float cl = cloudAt(p) * uSunVis;
        col *= mix(0.86, 1.0, cl);
        // darker wet rim
        float rim = smoothstep(0.7, 0.9, vEdge);
        col = mix(col, col*vec3(0.78, 0.82, 0.84), rim*0.6);
        float a = (1.0 - smoothstep(0.88, 1.0, vEdge)) * 0.8;
        if (uPass > 0.5) discard;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const spots = [[2.2, 11.6, 1.2, 0.8], [-2.6, 8.6, 0.9, 0.6], [8.6, 11.0, 1.1, 0.7], [-9.9, 2.6, 0.8, 1.2], [13.4, 15.0, 0.7, 0.5], [-5.6, 17.2, 1.3, 0.7], [-12.4, -3.6, 0.9, 0.7], [14.0, 16.5, 0.8, 0.6], [-16.0, -4.0, 0.9, 0.6]];
  const group = new THREE.Group();
  for (const [x, z, rx, rz] of spots) {
    const seg = 28;
    const pos = [], edge = [];
    const rad = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      rad.push(1 + 0.18 * Math.sin(a * 3 + x) + 0.1 * Math.sin(a * 5 + z));
    }
    const ring = (k, f) => { const a = (k / seg) * Math.PI * 2; return [x + Math.cos(a) * rx * rad[k % seg] * f, 0.012, z + Math.sin(a) * rz * rad[k % seg] * f]; };
    for (let i = 0; i < seg; i++) {
      const c = [x, 0.012, z];
      const a0 = ring(i, 0.75), a1 = ring(i + 1, 0.75), b0 = ring(i, 1.0), b1 = ring(i + 1, 1.0);
      pos.push(...c, ...a1, ...a0); edge.push(0, 0.75, 0.75);
      pos.push(...a0, ...a1, ...b1); edge.push(0.75, 0.75, 1);
      pos.push(...a0, ...b1, ...b0); edge.push(0.75, 1, 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 1;
    group.add(m);
  }
  setLayers(group, { main: true, shadow: false, outline: false, refl: false });
  scene.add(group);
  return group;
}
