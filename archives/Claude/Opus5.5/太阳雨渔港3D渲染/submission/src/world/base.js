import * as THREE from 'three';
import { GB, T, M } from '../core/builder.js';
import { WL, BASE_BOTTOM, rand, rr, srand, setLayers } from '../core/G.js';
import { LAY, slipY, seabedH } from './layout.js';

const CONC = [0.86, 0.86, 0.83];
const CONC_TOP = [0.8, 0.81, 0.79];

function jitterCol(c, j = 0.05) {
  const k = 1 + (rand() - 0.5) * 2 * j;
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** A rough-block wall along an axis-aligned water face. */
export function blockWall(b, { axis, at, from, to, y0, y1, facing, rowH = 0.85, depth = 0.6 }) {
  // axis 'x': wall runs along x at z=at, facing +/-z ; axis 'z': runs along z at x=at, facing +/-x
  let row = 0;
  for (let y = y0; y < y1 - 0.05; y += rowH, row++) {
    const h = Math.min(rowH, y1 - y);
    let s = from - (row % 2 ? 0.9 : 0.2);
    while (s < to) {
      const len = rr(1.4, 2.3);
      let a = Math.max(s, from), e = Math.min(s + len, to);
      if (e - a > 0.15) {
        const proud = rr(0.0, 0.06);
        const cy = y + h / 2;
        const tone = jitterCol([0.8, 0.8, 0.77], 0.06);
        const L = e - a - 0.05, H = h - 0.05;
        const cx = (a + e) / 2;
        const off = at + facing * (proud - depth / 2 + 0.05);
        if (axis === 'x') b.rbox(L, H, depth, 0.06, { c: tone, t: T.WALL, l: 0.8 }, cx, cy, off);
        else b.rbox(depth, H, L, 0.06, { c: tone, t: T.WALL, l: 0.8 }, off, cy, cx);
      }
      s += len;
    }
  }
}

function coping(b, axis, at, from, to, facing, yTop = 0) {
  const len = to - from;
  const c = (from + to) / 2;
  const o = at + facing * 0.04;
  if (axis === 'x') b.rbox(len, 0.36, 0.7, 0.04, { c: CONC, t: T.CONCRETE, w: 0.5 }, c, yTop - 0.18, o - facing * 0.3);
  else b.rbox(0.7, 0.36, len, 0.04, { c: CONC, t: T.CONCRETE, w: 0.5 }, o - facing * 0.3, yTop - 0.18, c);
}

/** yellow/black curb (car stop) along an edge, segmented */
function curb(b, axis, at, from, to, facing, yTop = 0) {
  let s = from + 0.15;
  while (s < to - 0.4) {
    const len = Math.min(rr(2.6, 3.4), to - 0.15 - s);
    if (len < 0.6) break;
    const c = s + len / 2;
    const o = at - facing * 0.32;
    if (axis === 'x') b.rbox(len, 0.18, 0.26, 0.03, { c: [1, 1, 1], t: T.HAZARD, w: 0.4 }, c, yTop + 0.09, o);
    else b.rbox(0.26, 0.18, len, 0.03, { c: [1, 1, 1], t: T.HAZARD, w: 0.4 }, o, yTop + 0.09, c);
    s += len + 0.35;
  }
}

/** section plate details: blocks + strata visible on the outer side walls of the base */
function sectionWall(b, axis, at, from, to, facing) {
  // concrete slab band at top
  const L = to - from, c = (from + to) / 2;
  const plate = (y0, y1, col, t, proud = 0.012) => {
    const h = y1 - y0;
    if (axis === 'x') b.box(L, h, 0.02, { c: col, t, l: 0.6 }, c, (y0 + y1) / 2, at + facing * proud);
    else b.box(0.02, h, L, { c: col, t, l: 0.6 }, at + facing * proud, (y0 + y1) / 2, c);
  };
  plate(-0.38, 0.0, [0.86, 0.86, 0.84], T.BLOCK);
  plate(-2.75, -0.38, [0.44, 0.45, 0.46], T.PLAIN);       // mortar behind blocks
  plate(-4.45, -2.75, [0.68, 0.63, 0.55], T.FILL);
  plate(BASE_BOTTOM, -4.45, [0.56, 0.52, 0.46], T.FILL);
  // blocks (two rows)
  for (let row = 0; row < 2; row++) {
    const y0 = -0.4 - (row + 1) * 1.17, h = 1.12;
    let s = from - (row ? 1.1 : 0.3);
    while (s < to) {
      const len = rr(1.7, 2.6);
      const a = Math.max(s, from + 0.02), e = Math.min(s + len, to - 0.02);
      if (e - a > 0.3) {
        const tone = jitterCol([0.79, 0.79, 0.77], 0.07);
        const pr = rr(0.03, 0.07);
        if (axis === 'x') b.rbox(e - a - 0.06, h, 0.1, 0.035, { c: tone, t: T.BLOCK, l: 0.7 }, (a + e) / 2, y0 + h / 2, at + facing * pr);
        else b.rbox(0.1, h, e - a - 0.06, 0.035, { c: tone, t: T.BLOCK, l: 0.7 }, at + facing * pr, y0 + h / 2, (a + e) / 2);
      }
      s += len;
    }
  }
  // rubble stones embedded in fill
  const n = Math.floor(L * 1.6);
  for (let i = 0; i < n; i++) {
    const p = from + 0.3 + rand() * (L - 0.6);
    const y = rr(-4.3, -2.95);
    const r = rr(0.12, 0.3);
    const g = new THREE.DodecahedronGeometry(r, 0);
    const tone = jitterCol([0.6, 0.58, 0.55], 0.12);
    if (axis === 'x') b.add(g, { c: tone, t: T.BLOCK, l: 0.5 }, M(p, y, at + facing * 0.01, 0, 0, rand() * 3, 1.3, 0.8, 0.3));
    else b.add(g, { c: tone, t: T.BLOCK, l: 0.5 }, M(at + facing * 0.01, y, p, rand() * 3, 0, 0, 0.3, 0.8, 1.3));
  }
}

export function tetrapodGeo(scale = 1) {
  const b = new GB();
  const dirs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((d) => new THREE.Vector3(...d).normalize());
  for (const d of dirs) {
    const g = new THREE.CylinderGeometry(0.2 * scale, 0.36 * scale, 0.95 * scale, 10, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    const m = new THREE.Matrix4().compose(d.clone().multiplyScalar(0.42 * scale), q, new THREE.Vector3(1, 1, 1));
    b.add(g, { c: [0.85, 0.85, 0.82], t: T.TETRA, l: 0.9 }, m);
  }
  b.add(new THREE.IcosahedronGeometry(0.36 * scale, 1), { c: [0.85, 0.85, 0.82], t: T.TETRA, l: 0.9 });
  return b;
}

export const TETRA_SPOTS = [];

export function buildBase(scene, mats) {
  srand(42);
  const b = new GB();

  // --- plinth (display stand) -------------------------------------------------
  b.rbox(41.4, 0.9, 41.4, 0.12, { c: [0.24, 0.2, 0.17], t: T.WOOD, w: 0.3, l: 1, uvs: [1, 1] }, 0, BASE_BOTTOM - 0.45, 0);
  b.rbox(40.6, 0.12, 40.6, 0.04, { c: [0.32, 0.27, 0.22], t: T.WOOD, l: 0.6 }, 0, BASE_BOTTOM - 0.02, 0);

  // --- quay core volumes --------------------------------------------------------
  const core = (x0, x1, z0, z1, y0, y1) => {
    b.box(x1 - x0, y1 - y0, z1 - z0, { c: CONC_TOP, t: T.CONCRETE, w: 0.45 }, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  };
  const Y0 = BASE_BOTTOM;
  core(-20, -8, -10, 20, Y0, 0);
  core(-8, 1.4, 6, 20, Y0, 0);
  core(1.4, 4.4, 8.6, 20, Y0, 0);
  core(4.4, 9.8, 7.7, 20, Y0, 0);
  core(9.8, 13.4, 6, 20, Y0, 0);
  core(13.4, 16.8, 11, 20, Y0, 0);
  core(16.8, 20, 6, 20, Y0, 0);
  // steps
  const st = LAY.steps;
  core(st.x0, st.x1, 6, 8.6, Y0, -1.0);
  for (let i = 1; i <= st.n; i++) {
    const zf = 8.6 - 0.52 * i;
    b.rbox(st.x1 - st.x0 - 0.02, 0.22, 0.54, 0.03, { c: jitterCol(CONC, 0.03), t: T.CONCRETE, w: 0.7 }, (st.x0 + st.x1) / 2, -0.2 * i - 0.11, zf + 0.26);
    core(st.x0 + 0.01, st.x1 - 0.01, zf, zf + 0.52, Y0 + 0.5, -0.2 * i);
  }
  // platform (lower boarding landing)
  const pl = LAY.plat;
  core(pl.x0, pl.x1, 6, pl.z1, Y0, pl.y);
  coping(b, 'x', 6, pl.x0, pl.x1, -1, pl.y);
  curb(b, 'x', 6, pl.x0 + 0.6, pl.x1 - 0.2, -1, pl.y);
  // slipway ramp (extruded profile in z/y, along x)
  const s = LAY.slip;
  {
    const shape = [[s.zTop, 0], [s.zEnd, s.yEnd], [s.zEnd, Y0], [s.zTop, Y0]];
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(shape.map((p) => new THREE.Vector2(p[0], p[1]))), { depth: s.x1 - s.x0, bevelEnabled: false });
    // shape is in XY; map shape.x -> world z, shape.y -> world y, depth -> world x
    const m = new THREE.Matrix4().set(0, 0, -1, s.x1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
    b.add(g, { c: [0.8, 0.81, 0.79], t: T.CONCRETE, w: 0.8 }, m);
    // ridges on the ramp surface
    for (let z = s.zEnd + 0.4; z < s.zTop - 0.2; z += 0.55) {
      const y = slipY(z);
      const ang = Math.atan2(-s.yEnd, s.zTop - s.zEnd);
      b.box(s.x1 - s.x0 - 0.1, 0.05, 0.08, { c: [0.74, 0.75, 0.73], t: T.CONCRETE, w: 0.8, l: 0.4 }, (s.x0 + s.x1) / 2, y + 0.02, z, ang, 0, 0);
    }
  }

  // --- quay walls with blocks (water faces) -------------------------------------
  const sb = -4.9;
  blockWall(b, { axis: 'z', at: LAY.leftX, from: LAY.bw.z1, to: LAY.frontZ, y0: sb, y1: -0.36, facing: 1 });
  blockWall(b, { axis: 'x', at: LAY.frontZ, from: LAY.leftX, to: st.x0, y0: sb, y1: -0.36, facing: -1 });
  blockWall(b, { axis: 'x', at: LAY.frontZ, from: st.x0, to: st.x1, y0: sb, y1: -1.0, facing: -1 });
  blockWall(b, { axis: 'x', at: LAY.frontZ, from: pl.x0, to: pl.x1, y0: sb, y1: pl.y - 0.36, facing: -1 });
  blockWall(b, { axis: 'x', at: LAY.frontZ, from: pl.x1, to: s.x0, y0: sb, y1: -0.36, facing: -1 });
  blockWall(b, { axis: 'x', at: LAY.frontZ, from: s.x1, to: 20, y0: sb, y1: -0.36, facing: -1 });
  // coping
  coping(b, 'z', LAY.leftX, LAY.bw.z1, LAY.frontZ + 0.35, 1);
  coping(b, 'x', LAY.frontZ, LAY.leftX + 0.35, st.x0, -1);
  coping(b, 'x', LAY.frontZ, pl.x1, s.x0, -1);
  coping(b, 'x', LAY.frontZ, s.x1, 20, -1);
  // curbs (hazard stripes)
  curb(b, 'z', LAY.leftX, LAY.bw.z1 + 0.3, LAY.frontZ - 0.2, 1);
  curb(b, 'x', LAY.frontZ, LAY.leftX - 0.2, st.x0 - 0.1, -1);
  curb(b, 'x', LAY.frontZ, pl.x1 + 0.1, s.x0 - 0.1, -1);
  curb(b, 'x', LAY.frontZ, s.x1 + 0.1, 19.8, -1);
  // curb along the platform recess back edge and the slipway sides
  curb(b, 'x', pl.z1 - 0.32 * 0 + 0.0, pl.x0 + 0.1, pl.x1 - 0.1, -1);
  // side curbs along the steps
  b.rbox(0.22, 0.18, 2.5, 0.03, { c: [1, 1, 1], t: T.HAZARD }, st.x0 - 0.14, 0.09, 7.35);
  b.rbox(0.22, 0.18, 1.0, 0.03, { c: [1, 1, 1], t: T.HAZARD }, st.x1 + 0.14, 0.09, 8.15);

  // --- breakwater ------------------------------------------------------------
  const bw = LAY.bw;
  b.box(bw.x1 - bw.x0, bw.top - Y0, bw.z1 - bw.z0, { c: [0.82, 0.82, 0.8], t: T.CONCRETE, w: 0.5 }, (bw.x0 + bw.x1) / 2, (bw.top + Y0) / 2, (bw.z0 + bw.z1) / 2);
  blockWall(b, { axis: 'x', at: bw.z1, from: bw.x0, to: bw.x1, y0: sb, y1: bw.top - 0.3, facing: 1 });
  blockWall(b, { axis: 'x', at: bw.z0, from: bw.x0 + 0.8, to: bw.x1, y0: sb, y1: bw.top - 0.3, facing: -1 });
  blockWall(b, { axis: 'z', at: bw.x1, from: bw.z0, to: bw.z1, y0: sb, y1: bw.top - 0.3, facing: 1 });
  // parapet wall on the sea side
  b.rbox(bw.x1 - bw.x0 + 0.1, 1.0, 0.55, 0.05, { c: [0.84, 0.84, 0.81], t: T.CONCRETE, w: 0.4 }, (bw.x0 + bw.x1) / 2 + 0.05, bw.top + 0.5, bw.z0 + 0.3);
  // top coping
  b.rbox(bw.x1 - bw.x0, 0.12, bw.z1 - bw.z0 - 0.5, 0.03, { c: [0.8, 0.8, 0.78], t: T.CONCRETE, w: 0.6 }, (bw.x0 + bw.x1) / 2, bw.top + 0.02, (bw.z0 + bw.z1) / 2 + 0.25);
  // lighthouse round base
  const lh = LAY.lh;
  b.cyl(1.75, 1.95, bw.top + 0.25 - Y0, { c: [0.82, 0.82, 0.8], t: T.WALL, w: 0.4 }, lh.x, (bw.top + 0.25 + Y0) / 2, lh.z, 0, 0, 0, 28);
  b.cyl(1.8, 1.8, 0.14, { c: [0.86, 0.86, 0.84], t: T.CONCRETE, w: 0.5 }, lh.x, bw.top + 0.3, lh.z, 0, 0, 0, 28);

  // --- outer section walls -------------------------------------------------------
  sectionWall(b, 'x', 20, -20, 20, 1);               // front
  sectionWall(b, 'z', -20, -10, 20, -1);             // left (quay part)
  sectionWall(b, 'z', 20, LAY.frontZ, 20, 1);        // right (quay part)

  // --- seabed -----------------------------------------------------------------------
  const sbGeo = new THREE.PlaneGeometry(28.6, 26.6, 57, 53);
  sbGeo.rotateX(-Math.PI / 2);
  sbGeo.translate(-8.6 + 14.3, 0, -20 + 13.3);
  const p = sbGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = Math.min(20, p.getX(i)), z = Math.max(-20, p.getZ(i));
    p.setXYZ(i, x, seabedH(x, z), z);
  }
  sbGeo.computeVertexNormals();
  b.add(sbGeo, {
    t: T.SEABED, l: 0.25,
    cf: (v) => {
      const k = 0.92 + 0.1 * Math.sin(v.x * 1.7) * Math.cos(v.z * 1.3);
      const sand = [0.86 * k, 0.82 * k, 0.7 * k];
      return v.y > -3.9 ? [0.74 * k, 0.74 * k, 0.68 * k] : sand;
    },
  });
  // seabed section skirts (right wall z<6, back wall x>-7.2)
  const skirt = (axis, at, from, to, facing) => {
    const n = Math.ceil((to - from) / 0.5);
    const pos = [];
    for (let i = 0; i < n; i++) {
      const a = from + (i / n) * (to - from), c = from + ((i + 1) / n) * (to - from);
      const ha = axis === 'z' ? seabedH(at, a) : seabedH(a, at);
      const hc = axis === 'z' ? seabedH(at, c) : seabedH(c, at);
      const P = (u, y) => (axis === 'z' ? [at, y, u] : [u, y, at]);
      const R = 6;
      for (let k = 0; k < R; k++) {
        const ya0 = ha - (ha - Y0) * (k / R), ya1 = ha - (ha - Y0) * ((k + 1) / R);
        const yc0 = hc - (hc - Y0) * (k / R), yc1 = hc - (hc - Y0) * ((k + 1) / R);
        const q = [P(a, ya1), P(c, yc1), P(c, yc0), P(a, ya1), P(c, yc0), P(a, ya0)];
        for (const v of q) pos.push(...v);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    // ensure facing
    const nrm = g.attributes.normal;
    const want = axis === 'z' ? [facing, 0, 0] : [0, 0, facing];
    if (nrm.getX(0) * want[0] + nrm.getZ(0) * want[2] < 0) {
      for (let i = 0; i < pos.length; i += 9) {
        for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
    }
    b.add(g, {
      t: T.FILL, l: 0.6,
      cff: (v) => {
        const d = (axis === 'z' ? seabedH(at, v.z) : seabedH(v.x, at)) - v.y;
        if (d < 0.2) return [0.84, 0.8, 0.68];
        if (d < 0.55) return [0.72, 0.68, 0.57];
        return [0.6, 0.56, 0.49];
      },
    });
  };
  skirt('z', 20, -20, LAY.frontZ, 1);
  skirt('x', -20, -7.2, 20, -1);

  // rubble at the wall feet
  const rock = (x, y, z, r, tone) => {
    b.add(new THREE.DodecahedronGeometry(r, 0), { c: tone || jitterCol([0.66, 0.66, 0.62], 0.12), t: T.BLOCK, l: 0.5 }, M(x, y, z, rand() * 6, rand() * 6, rand() * 6, rr(0.8, 1.3), rr(0.6, 0.9), rr(0.8, 1.3)));
  };
  for (let z = LAY.bw.z1 + 0.3; z < LAY.frontZ; z += 0.55) {
    for (let k = 0; k < 2; k++) { const x = LAY.leftX + rr(0.2, 1.8); rock(x, seabedH(x, z) + 0.1, z + rr(-0.2, 0.2), rr(0.2, 0.42)); }
  }
  for (let x = LAY.leftX + 0.3; x < 20; x += 0.55) {
    if (x > s.x0 - 0.3 && x < s.x1 + 0.3) continue;
    for (let k = 0; k < 2; k++) { const z = LAY.frontZ - rr(0.2, 1.8); rock(x + rr(-0.2, 0.2), seabedH(x, z) + 0.1, z, rr(0.2, 0.42)); }
  }
  for (let x = bw.x0; x < bw.x1 + 2; x += 0.5) {
    for (let k = 0; k < 2; k++) {
      const z = bw.z1 + rr(0.2, 1.8); rock(x, seabedH(x, z) + 0.1, z, rr(0.2, 0.4));
      const z2 = bw.z0 - rr(0.2, 2.2); rock(x, seabedH(x, z2) + 0.1, z2, rr(0.25, 0.45));
    }
  }
  // scattered stones on the seabed
  for (let i = 0; i < 140; i++) {
    const x = rr(-7.5, 19.8), z = rr(-19.8, 5.5);
    if (z > bw.z0 - 0.5 && z < bw.z1 + 0.5 && x < bw.x1 + 0.5) continue;
    rock(x, seabedH(x, z) + 0.02, z, rr(0.06, 0.2), jitterCol([0.72, 0.7, 0.64], 0.15));
  }

  const mesh = b.mesh(mats.toon);
  mesh.name = 'base';
  setLayers(mesh, {});
  scene.add(mesh);

  // --- tetrapods --------------------------------------------------------------
  const tb = new GB();
  const tetra = tetrapodGeo(1.25);
  const tGeo = tetra.build();
  const placeT = (x, y, z) => {
    const m = M(x, y, z, rand() * 6.28, rand() * 6.28, rand() * 6.28);
    const g = tGeo.clone(); g.applyMatrix4(m);
    tb.parts.push(g);
    TETRA_SPOTS.push(new THREE.Vector3(x, y, z));
  };
  // corner pile at right wall / front arm
  const pile = [[18.9, -1.8, 4.9], [17.4, -1.7, 5.1], [18.8, -1.6, 3.2], [17.6, -0.6, 4.4], [19.0, -0.5, 4.5], [16.4, -1.9, 4.6], [18.2, -2.4, 1.8], [19.1, -1.5, 1.6]];
  pile.forEach((p) => placeT(...p));
  // along the outer side of the breakwater
  for (let x = bw.x0 + 1.2; x < bw.x1 + 1.5; x += 1.25) {
    placeT(x + rr(-0.2, 0.2), -1.5 + rr(-0.2, 0.2), bw.z0 - 1.0 + rr(-0.2, 0.2));
    if (rand() > 0.35) placeT(x + 0.6 + rr(-0.2, 0.2), -0.5 + rr(-0.15, 0.15), bw.z0 - 0.6 + rr(-0.15, 0.15));
    if (rand() > 0.5) placeT(x + 0.3, -2.4, bw.z0 - 2.1 + rr(-0.2, 0.2));
  }
  // around the lighthouse head
  for (let a = -1.2; a < 1.6; a += 0.55) {
    placeT(lh.x + Math.cos(a) * 2.6, -1.4 + rr(-0.3, 0.3), lh.z - Math.sin(a) * 2.6);
  }
  // back-right corner pile
  [[19.0, -1.8, -18.9], [17.6, -1.6, -19.0], [18.9, -1.6, -17.4], [18.3, -0.6, -18.4]].forEach((p) => placeT(...p));
  const tm = tb.mesh(mats.toon);
  tm.name = 'tetrapods';
  setLayers(tm, {});
  scene.add(tm);
  return { mesh, tetra: tm };
}
