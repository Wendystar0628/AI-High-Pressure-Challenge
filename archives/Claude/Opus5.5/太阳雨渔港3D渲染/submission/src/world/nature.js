import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GB, T, M } from '../core/builder.js';
import { rand, rr, srand, BASE_BOTTOM, WL } from '../core/G.js';
import { LAY, hillH, seabedH } from './layout.js';
import { wall, windowIn, gableRoof } from './helpers.js';

export const TREES = []; // {x,z,h} for gusts etc.
export const POLE_TOP = new THREE.Vector3();

function blobGeo(r, seed) {
  let g = new THREE.IcosahedronGeometry(r, 2);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const k = 1 + 0.12 * Math.sin(n.x * 5 + seed) * Math.cos(n.y * 4 + seed * 1.3) + 0.08 * Math.sin(n.z * 7 + seed * 2.1);
    v.multiplyScalar(k);
    v.y *= 0.85;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function tree(ctx, x, y, z, s = 1, kind = 'broad') {
  const ph = rand() * 6.28;
  const H = (kind === 'pine' ? 3.6 : 3.0) * s;
  const swayFn = (v) => [Math.max(0, (v.y - y) / H) * 0.55, ph];
  if (kind === 'broad') {
    const lean = rr(-0.25, 0.25);
    ctx.main.add(new THREE.CylinderGeometry(0.09 * s, 0.17 * s, 1.9 * s, 7), { c: [0.45, 0.36, 0.3], t: T.WOOD, l: 0.8 }, M(x, y + 0.9 * s, z, 0, 0, lean * 0.3));
    const base = [0.32 + rr(-0.04, 0.06), 0.56 + rr(-0.05, 0.08), 0.3 + rr(-0.04, 0.04)];
    const n = 5 + Math.floor(rand() * 4);
    const cy = y + 2.1 * s;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand();
      const rad = rr(0.35, 0.8) * s;
      const bx = x + Math.cos(a) * rad + lean * 0.4 * s, bz = z + Math.sin(a) * rad, by = cy + rr(-0.3, 0.5) * s;
      const r = rr(0.55, 0.85) * s;
      const tint = rr(0.92, 1.08);
      ctx.leaf.add(blobGeo(r, rand() * 10), { c: [base[0] * tint, base[1] * tint, base[2] * tint], t: T.LEAF, l: 0.55, sway: swayFn }, M(bx, by, bz));
    }
    ctx.leaf.add(blobGeo(0.75 * s, rand() * 10), { c: base, t: T.LEAF, l: 0.55, sway: swayFn }, M(x + lean * 0.4 * s, cy + 0.65 * s, z));
  } else if (kind === 'pine') {
    // crooked trunk
    const pts = [];
    let px = x, pz = z;
    const dx = rr(-0.5, 0.5), dz = rr(-0.5, 0.5);
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push(new THREE.Vector3(px + dx * t * t * 2 * s, y + t * 3.2 * s, pz + dz * t * t * 2 * s + Math.sin(t * 4) * 0.15 * s));
    }
    ctx.main.tube(pts, 0.12 * s, { c: [0.42, 0.32, 0.28], t: T.WOOD, l: 0.8 }, 16, 6);
    const col = [0.22 + rr(0, 0.05), 0.44 + rr(0, 0.06), 0.33];
    for (let k = 0; k < 4; k++) {
      const p = pts[2 + k] || pts[pts.length - 1];
      const a = rand() * 6.28;
      const r = rr(0.5, 0.9) * s;
      const bx = p.x + Math.cos(a) * 0.6 * s, bz = p.z + Math.sin(a) * 0.6 * s;
      ctx.main.bar(p, [bx, p.y + 0.2 * s, bz], 0.04 * s, { c: [0.42, 0.32, 0.28] }, 4);
      ctx.leaf.add(blobGeo(r, rand() * 10), { c: col, t: T.LEAF, l: 0.55, sway: swayFn }, M(bx, p.y + 0.3 * s, bz, 0, rand() * 3, 0, 1.4, 0.45, 1.1));
    }
  } else if (kind === 'shrub') {
    const base = [0.36 + rr(-0.03, 0.05), 0.6 + rr(-0.05, 0.05), 0.32];
    for (let i = 0; i < 3; i++) ctx.leaf.add(blobGeo(rr(0.35, 0.5) * s, rand() * 10), { c: base, t: T.LEAF, l: 0.5, sway: (v) => [Math.max(0, (v.y - y)) * 0.15, ph] }, M(x + rr(-0.4, 0.4) * s, y + 0.3 * s, z + rr(-0.4, 0.4) * s));
  }
  TREES.push({ x, z, h: H });
}

function stoneWall(b, axis, at, from, to, yb, ytopFn, facing) {
  // ishigaki: rows of rounded stones
  for (let a = from; a < to; a += 0.5) {
    const yt = ytopFn(a + 0.25);
    for (let y = yb; y < yt - 0.1; y += 0.42) {
      const w = rr(0.4, 0.62), h = Math.min(0.44, yt - y);
      const tone = 0.62 + rand() * 0.16;
      const c = [tone, tone * 0.98, tone * 0.93];
      const off = at + facing * rr(-0.02, 0.05);
      if (axis === 'x') b.rbox(w, h, 0.4, 0.08, { c, t: T.BLOCK, l: 0.55 }, a + 0.25 + rr(-0.05, 0.05), y + h / 2, off - facing * 0.18);
      else b.rbox(0.4, h, w, 0.08, { c, t: T.BLOCK, l: 0.55 }, off - facing * 0.18, y + h / 2, a + 0.25 + rr(-0.05, 0.05));
    }
  }
}

function house(ctx, cx, cz, w, d, ridge, front, { wall: wc = [0.95, 0.94, 0.9], roof = [0.42, 0.47, 0.55], two = false } = {}) {
  const b = ctx.main, gl = ctx.glass;
  let hmax = -1e9, hmin = 1e9;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const h = hillH(cx + i * w / 2, cz + j * d / 2);
    hmax = Math.max(hmax, h); hmin = Math.min(hmin, h);
  }
  const fl = hmax + 0.25;
  // foundation / stone platform
  b.box(w + 1.2, fl - hmin + 0.6, d + 1.2, { c: [0.74, 0.72, 0.66], t: T.MASONRY, l: 0.7 }, cx, (fl + hmin - 0.6) / 2, cz);
  b.box(w + 1.2, 0.06, d + 1.2, { c: [0.6, 0.62, 0.55], t: T.GRASS, l: 0.4 }, cx, fl + 0.02, cz);
  const H = two ? 4.3 : 2.4;
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const plaster = { c: wc, t: T.PLAIN, w: 0.2, l: 0.85 };
  const board = { c: [0.32, 0.27, 0.24], t: T.WOOD, w: 0.3, l: 0.85 };
  const winF = { c: [0.4, 0.32, 0.25], t: T.WOOD, l: 0.8 };
  // front openings
  const fo = [];
  const so = [];
  if (front === 'z') { fo.push({ a0: x0 + 0.5, a1: x0 + 1.7, y0: fl + 0.9, y1: fl + 1.9 }, { a0: x1 - 1.4, a1: x1 - 0.5, y0: fl, y1: fl + 2.0 }); }
  else { fo.push({ a0: z0 + 0.5, a1: z0 + 1.7, y0: fl + 0.9, y1: fl + 1.9 }, { a0: z1 - 1.4, a1: z1 - 0.5, y0: fl, y1: fl + 2.0 }); }
  if (two) {
    if (front === 'z') fo.push({ a0: x0 + 0.6, a1: x0 + 2.2, y0: fl + 3.0, y1: fl + 3.9 }, { a0: x1 - 2.0, a1: x1 - 0.6, y0: fl + 3.0, y1: fl + 3.9 });
    else fo.push({ a0: z0 + 0.6, a1: z0 + 2.2, y0: fl + 3.0, y1: fl + 3.9 });
  }
  so.push({ a0: (front === 'z' ? z0 : x0) + 0.8, a1: (front === 'z' ? z0 : x0) + 1.8, y0: fl + 1.0, y1: fl + 1.8 });
  if (front === 'z') {
    wall(b, { axis: 'x', at: z1 - 0.08, from: x0, to: x1, y0: fl, y1: fl + H, thick: 0.16, openings: fo, opts: plaster });
    wall(b, { axis: 'x', at: z0 + 0.08, from: x0, to: x1, y0: fl, y1: fl + H, thick: 0.16, opts: plaster });
    wall(b, { axis: 'z', at: x1 - 0.08, from: z0, to: z1, y0: fl, y1: fl + H, thick: 0.16, openings: so, opts: plaster });
    wall(b, { axis: 'z', at: x0 + 0.08, from: z0, to: z1, y0: fl, y1: fl + H, thick: 0.16, opts: plaster });
    // lower boards
    b.box(w + 0.02, 0.85, 0.04, board, cx, fl + 0.425, z1 + 0.01);
    b.box(0.04, 0.85, d + 0.02, board, x1 + 0.01, fl + 0.425, cz);
    for (const o of fo) windowIn(b, gl, { axis: 'x', at: z1 - 0.02, a0: o.a0, a1: o.a1, y0: o.y0, y1: o.y1, opts: winF, mullions: 1, frame: 0.07 });
    for (const o of so) windowIn(b, gl, { axis: 'z', at: x1 - 0.02, a0: o.a0, a1: o.a1, y0: o.y0, y1: o.y1, opts: winF, mullions: 0, frame: 0.07 });
    // little eave over the door
    b.box(1.3, 0.06, 0.6, { c: roof, t: T.TILE, w: 0.8 }, x1 - 0.95, fl + 2.15, z1 + 0.3, -0.25, 0, 0);
  } else {
    wall(b, { axis: 'z', at: x1 - 0.08, from: z0, to: z1, y0: fl, y1: fl + H, thick: 0.16, openings: fo, opts: plaster });
    wall(b, { axis: 'z', at: x0 + 0.08, from: z0, to: z1, y0: fl, y1: fl + H, thick: 0.16, opts: plaster });
    wall(b, { axis: 'x', at: z1 - 0.08, from: x0, to: x1, y0: fl, y1: fl + H, thick: 0.16, openings: so, opts: plaster });
    wall(b, { axis: 'x', at: z0 + 0.08, from: x0, to: x1, y0: fl, y1: fl + H, thick: 0.16, opts: plaster });
    b.box(0.04, 0.85, d + 0.02, board, x1 + 0.01, fl + 0.425, cz);
    b.box(w + 0.02, 0.85, 0.04, board, cx, fl + 0.425, z1 + 0.01);
    for (const o of fo) windowIn(b, gl, { axis: 'z', at: x1 - 0.02, a0: o.a0, a1: o.a1, y0: o.y0, y1: o.y1, opts: winF, mullions: 1, frame: 0.07 });
    for (const o of so) windowIn(b, gl, { axis: 'x', at: z1 - 0.02, a0: o.a0, a1: o.a1, y0: o.y0, y1: o.y1, opts: winF, mullions: 0, frame: 0.07 });
    b.box(0.6, 0.06, 1.3, { c: roof, t: T.TILE, w: 0.8 }, x1 + 0.3, fl + 2.15, z1 - 0.95, 0, 0, -0.25);
  }
  if (two && front === 'z') {
    // balcony with railing and futon airing on the 2nd floor
    const by = fl + 2.75;
    b.box(w - 0.4, 0.08, 0.7, { c: [0.75, 0.72, 0.68], t: T.CONCRETE, l: 0.9 }, cx, by, z1 + 0.35);
    const rail = { c: [0.55, 0.58, 0.6], t: T.PAINT, w: 0.5, l: 0.8 };
    b.bar([x0 + 0.2, by + 0.85, z1 + 0.68], [x1 - 0.2, by + 0.85, z1 + 0.68], 0.025, rail, 5);
    for (let x = x0 + 0.2; x <= x1 - 0.19; x += 0.18) b.bar([x, by, z1 + 0.68], [x, by + 0.85, z1 + 0.68], 0.012, rail, 4);
    const fut = new THREE.PlaneGeometry(1.2, 0.9, 4, 4);
    fut.translate(0, -0.45, 0);
    ctx.flag.add(fut, { c: [0.95, 0.75, 0.75], t: T.FABRIC, l: 0.7, sway: (v) => [Math.min(1, Math.max(0, (by + 0.9 - v.y) / 0.9)) * 0.5, 2.3], cf: (v) => (Math.floor((v.x - cx) * 6) % 2 ? [0.96, 0.8, 0.8] : [0.98, 0.93, 0.9]) }, M(cx - 0.6, by + 0.88, z1 + 0.72, 0, 0, 0));
    b.rbox(0.6, 0.45, 0.25, 0.03, { c: [0.9, 0.9, 0.88], t: T.PAINT }, x1 - 0.6, by + 0.27, z1 + 0.3);
  }
  // wooden lattice (koshi) on ground floor front windows
  if (front === 'z') {
    const o = fo[0];
    for (let a = o.a0 + 0.08; a < o.a1; a += 0.09) b.box(0.025, o.y1 - o.y0, 0.03, { c: [0.42, 0.32, 0.24], t: T.WOOD, l: 0.5 }, a, (o.y0 + o.y1) / 2, z1 + 0.05);
  }
  // interior hint: dark interior planes behind windows (curtain / shoji)
  b.box(w - 0.4, H - 0.2, d - 0.4, { c: [0.55, 0.5, 0.45], l: 0.0 }, cx, fl + H / 2, cz);
  // roof
  gableRoof(b, {
    cx, cz, along: ridge, len: ridge === 'x' ? w : d, width: ridge === 'x' ? d : w, eaveY: fl + H, rise: 1.0, over: 0.5, thick: 0.14,
    opts: { c: roof, t: T.TILE, w: 0.9, l: 0.9 }, ridgeOpts: { c: [roof[0] * 0.85, roof[1] * 0.85, roof[2] * 0.85], w: 0.8 },
    gableOpts: { c: wc, t: T.PLAIN, l: 0.8 },
  });
  return { fl, x0, x1, z0, z1, H };
}

export function buildHill(ctx) {
  srand(99);
  const b = ctx.main;
  const { x0, x1, z0, z1 } = LAY.hill;
  // terrain
  const nx = 40, nz = 32;
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, hillH(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  b.add(g, { t: T.GRASS, l: 0.35, cf: (v) => { const k = 0.95 + 0.08 * Math.sin(v.x * 1.3 + v.z); return [0.56 * k, 0.72 * k, 0.4 * k]; } });
  // section skirts (left wall x=-20 and back wall z=-20)
  const skirt = (axis, at, from, to, facing) => {
    const n = Math.ceil((to - from) / 0.16);
    const pos = [];
    // subdivide vertically so the soil layers get crisp colour bands
    const rows = 40;
    for (let i = 0; i < n; i++) {
      const a = from + (i / n) * (to - from), c = from + ((i + 1) / n) * (to - from);
      const ha = axis === 'z' ? hillH(at, a) : hillH(a, at);
      const hc = axis === 'z' ? hillH(at, c) : hillH(c, at);
      const P = (u, y) => (axis === 'z' ? [at, y, u] : [u, y, at]);
      const yAt = (h, k) => { const d = Math.pow(k / rows, 1.6) * (h - BASE_BOTTOM); return h - d; };
      for (let k = 0; k < rows; k++) {
        const a0 = yAt(ha, k), a1 = yAt(ha, k + 1), c0 = yAt(hc, k), c1 = yAt(hc, k + 1);
        const q = [P(a, a1), P(c, c0), P(c, c1), P(a, a1), P(a, a0), P(c, c0)];
        for (const v of q) pos.push(...v);
      }
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    gg.computeVertexNormals();
    const nrm = gg.attributes.normal;
    const want = axis === 'z' ? facing * nrm.getX(0) : facing * nrm.getZ(0);
    if (want < 0) {
      for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
      gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      gg.computeVertexNormals();
    }
    b.add(gg, {
      t: T.FILL, l: 0.7,
      cff: (v) => {
        const top = axis === 'z' ? hillH(at, v.z) : hillH(v.x, at);
        const d = top - v.y;
        const wob = 0.12 * Math.sin(v.z * 2.3 + v.x * 1.7) + 0.08 * Math.sin(v.z * 5.1 - v.x * 3.3);
        if (d < 0.16) return [0.5, 0.68, 0.36];
        if (d < 1.0 + wob) return [0.46, 0.36, 0.28];
        if (d < 3.4 + wob * 2.0) return [0.68, 0.53, 0.38];
        if (v.y > -3.0 + wob) return [0.63, 0.58, 0.52];
        return [0.53, 0.5, 0.46];
      },
    });
    // embedded rocks & roots
    for (let i = 0; i < (to - from) * 1.2; i++) {
      const a = from + rand() * (to - from);
      const top = axis === 'z' ? hillH(at, a) : hillH(a, at);
      const y = rr(-4.6, top - 0.6);
      const r = rr(0.12, 0.35);
      const tone = 0.55 + rand() * 0.15;
      const m = axis === 'z' ? M(at + facing * 0.01, y, a, rand() * 3, 0, 0, 0.3, 0.8, 1.3) : M(a, y, at + facing * 0.01, 0, 0, rand() * 3, 1.3, 0.8, 0.3);
      b.add(new THREE.DodecahedronGeometry(r, 0), { c: [tone, tone * 0.96, tone * 0.9], t: T.BLOCK, l: 0.5 }, m);
    }
    for (let i = 0; i < (to - from) * 0.8; i++) {
      const a = from + rand() * (to - from);
      const top = axis === 'z' ? hillH(at, a) : hillH(a, at);
      const pts = [];
      let u = a, y = top - 0.1;
      for (let k = 0; k < 5; k++) { pts.push(axis === 'z' ? [at + facing * 0.02, y, u] : [u, y, at + facing * 0.02]); u += rr(-0.25, 0.25); y -= rr(0.15, 0.35); }
      b.tube(pts, 0.025, { c: [0.4, 0.3, 0.22], l: 0.4 }, 12, 4);
    }
  };
  skirt('z', -20, z0, z1, -1);
  skirt('x', -20, x0, x1, -1);
  // stone wall at the sea edge (x = x1) from seabed up to terrain, and quay edge (z = z1)
  stoneWall(b, 'z', x1, z0, LAY.bw.z0, -4.8, (z) => hillH(x1 - 0.05, z), 1);
  stoneWall(b, 'x', z1, x0 + 0.05, -7.6, 0, (x) => hillH(x, z1 - 0.05), 1);
  // fill under the stone walls (solid)
  b.box(0.6, 5.0, LAY.bw.z0 - z0, { c: [0.5, 0.5, 0.48], l: 0.2 }, x1 - 0.35, -2.4, (z0 + LAY.bw.z0) / 2);

  // houses
  const h1 = house(ctx, -16.0, -16.9, 4.0, 3.2, 'x', 'z', { two: true, roof: [0.4, 0.45, 0.54] });
  const h2 = house(ctx, -11.2, -15.8, 3.0, 3.4, 'z', 'x', { roof: [0.46, 0.5, 0.56], wall: [0.96, 0.93, 0.86] });
  const h3 = house(ctx, -18.0, -12.4, 2.8, 2.3, 'x', 'z', { roof: [0.5, 0.42, 0.38], wall: [0.93, 0.9, 0.84] });
  // laundry on a pole by house 2 (cloth flutters)
  {
    const lx = h2.x1 + 1.0, fz = (h2.z0 + h2.z1) / 2, fy = h2.fl;
    b.bar([lx, fy, fz - 1.3], [lx, fy + 1.7, fz - 1.3], 0.03, { c: [0.6, 0.6, 0.6] });
    b.bar([lx, fy, fz + 1.3], [lx, fy + 1.7, fz + 1.3], 0.03, { c: [0.6, 0.6, 0.6] });
    b.bar([lx, fy + 1.7, fz - 1.3], [lx, fy + 1.7, fz + 1.3], 0.02, { c: [0.75, 0.75, 0.75] });
    const cols = [[0.96, 0.96, 0.94], [0.55, 0.75, 0.92], [0.98, 0.78, 0.75], [0.95, 0.9, 0.6]];
    cols.forEach((c, i) => {
      const z = fz - 0.9 + i * 0.6;
      const pg = new THREE.PlaneGeometry(0.45, 0.6, 3, 4);
      pg.translate(0, -0.3, 0);
      ctx.flag.add(pg, { c, t: T.FABRIC, l: 0.6, sway: (v) => [Math.min(1, Math.max(0, (fy + 1.7 - v.y) / 0.6)), i * 1.7] }, M(lx, fy + 1.69, z, 0, Math.PI / 2, 0));
    });
  }
  // AC units & details
  b.rbox(0.7, 0.55, 0.28, 0.03, { c: [0.9, 0.9, 0.88], t: T.PAINT }, h1.x1 + 0.2, h1.fl + 0.3, h1.z0 + 0.6);
  b.cyl(0.18, 0.18, 0.02, { c: [0.3, 0.3, 0.3] }, h1.x1 + 0.35, h1.fl + 0.3, h1.z0 + 0.6, 0, 0, Math.PI / 2, 12);
  // potted plants in front of house 3
  for (let i = 0; i < 4; i++) {
    const px = h3.x0 + 0.5 + i * 0.5, pz = h3.z1 + 0.4;
    b.cyl(0.12, 0.09, 0.2, { c: [0.72, 0.45, 0.32] }, px, h3.fl + 0.1, pz, 0, 0, 0, 10);
    tree(ctx, px, h3.fl + 0.15, pz, 0.35, 'shrub');
  }
  // mailbox
  b.rbox(0.3, 0.4, 0.2, 0.03, { c: [0.85, 0.25, 0.2], t: T.PAINT }, h2.x1 + 0.4, h2.fl + 1.0, h2.z1 + 0.3);
  b.bar([h2.x1 + 0.4, h2.fl, h2.z1 + 0.3], [h2.x1 + 0.4, h2.fl + 0.8, h2.z1 + 0.3], 0.03, { c: [0.4, 0.4, 0.4] });

  // small seaside shrine with a red torii facing the harbour mouth
  const sx = -8.9, sz = -16.6, sy = hillH(sx, sz);
  {
    b.box(1.6, 0.35, 1.6, { c: [0.68, 0.67, 0.62], t: T.BLOCK, l: 0.8 }, sx - 0.4, sy + 0.05, sz);
    // hokora
    b.box(0.5, 0.25, 0.5, { c: [0.66, 0.65, 0.6], t: T.BLOCK }, sx - 0.75, sy + 0.35, sz);
    b.box(0.42, 0.45, 0.42, { c: [0.62, 0.45, 0.3], t: T.WOOD, l: 0.9 }, sx - 0.75, sy + 0.7, sz);
    b.box(0.03, 0.3, 0.24, { c: [0.85, 0.75, 0.4], w: 0.6 }, sx - 0.53, sy + 0.72, sz);
    gableRoof(b, { cx: sx - 0.75, cz: sz, along: 'x', len: 0.5, width: 0.5, eaveY: sy + 0.92, rise: 0.22, over: 0.1, thick: 0.05, opts: { c: [0.35, 0.36, 0.38], t: T.TILE, w: 0.8, l: 0.9 }, gableOpts: { c: [0.62, 0.45, 0.3], t: T.WOOD } });
    // offerings: tiny cup & sake bottle
    b.cyl(0.03, 0.03, 0.12, { c: [0.95, 0.95, 0.92] }, sx - 0.45, sy + 0.29, sz + 0.12, 0, 0, 0, 8);
    b.cyl(0.04, 0.03, 0.03, { c: [0.95, 0.95, 0.92] }, sx - 0.45, sy + 0.25, sz - 0.12, 0, 0, 0, 8);
    // torii
    const red = { c: [0.86, 0.26, 0.18], t: T.PAINT, w: 0.5, l: 1 };
    const tx = sx + 0.25;
    for (const dz of [-0.45, 0.45]) {
      b.cyl(0.05, 0.06, 1.55, red, tx, sy + 0.95, sz + dz, 0, 0, 0, 10);
      b.cyl(0.075, 0.075, 0.12, { c: [0.15, 0.15, 0.15] }, tx, sy + 0.23, sz + dz, 0, 0, 0, 10);
    }
    b.box(0.08, 0.07, 1.05, red, tx, sy + 1.42, sz);
    const kas = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8 - 0.5; kas.push(new THREE.Vector3(tx, sy + 1.72 + t * t * 0.25, sz + t * 1.4)); }
    b.tube(kas, 0.05, red, 16, 6);
    b.tube(kas.map((p) => p.clone().add(new THREE.Vector3(0, 0.07, 0))), 0.045, { c: [0.12, 0.12, 0.13], l: 1 }, 16, 6);
    b.box(0.06, 0.28, 0.04, { c: [0.2, 0.2, 0.22] }, tx + 0.01, sy + 1.57, sz);
    // stone lanterns
    for (const dz of [-0.75, 0.75]) {
      const lx = sx + 0.05, lz = sz + dz;
      const st = { c: [0.66, 0.66, 0.62], t: T.BLOCK, l: 0.9 };
      b.box(0.28, 0.08, 0.28, st, lx, sy + 0.25, lz);
      b.cyl(0.05, 0.06, 0.35, st, lx, sy + 0.45, lz, 0, 0, 0, 8);
      b.box(0.22, 0.06, 0.22, st, lx, sy + 0.65, lz);
      b.box(0.16, 0.16, 0.16, { c: [0.62, 0.62, 0.58], t: T.BLOCK }, lx, sy + 0.76, lz);
      b.cyl(0.0, 0.17, 0.12, st, lx, sy + 0.9, lz, 0, Math.PI / 4, 0, 4);
      b.sphere(0.03, st, lx, sy + 0.98, lz);
    }
  }
  // stone path / stairs from the quay up the hill
  const path = [[-8.6, -10.2], [-9.2, -11.4], [-9.6, -12.6], [-10.2, -13.4], [-11.0, -13.6], [-12.4, -13.7], [-13.6, -14.2], [-14.4, -14.9]];
  const curve = new THREE.CatmullRomCurve3(path.map((q) => new THREE.Vector3(q[0], 0, q[1])));
  for (let i = 0; i <= 26; i++) {
    const q = curve.getPoint(i / 26);
    const tg = curve.getTangent(i / 26);
    const h = Math.max(hillH(q.x, q.z), 0) + 0.02;
    b.rbox(1.0, 0.16, 0.42, 0.04, { c: [0.74, 0.72, 0.68], t: T.BLOCK, w: 0.6, l: 0.7 }, q.x, h, q.z, 0, Math.atan2(tg.x, tg.z), 0);
  }
  // utility pole
  const ux = -9.0, uz = -12.9, uy = hillH(ux, uz);
  b.cyl(0.12, 0.16, 8.0, { c: [0.72, 0.72, 0.7], t: T.CONCRETE, l: 0.9 }, ux, uy + 4.0, uz, 0, 0, 0, 10);
  b.box(1.6, 0.1, 0.1, { c: [0.45, 0.45, 0.45], t: T.RUST }, ux, uy + 7.5, uz, 0, 0.7, 0);
  for (const s of [-0.65, 0, 0.65]) b.cyl(0.05, 0.06, 0.16, { c: [0.85, 0.85, 0.82] }, ux + Math.cos(0.7) * s, uy + 7.62, uz - Math.sin(0.7) * s, 0, 0, 0, 8);
  b.cyl(0.25, 0.25, 0.7, { c: [0.6, 0.62, 0.62], t: T.RUST }, ux + 0.3, uy + 6.5, uz, 0, 0, 0, 12);
  POLE_TOP.set(ux, uy + 7.7, uz);

  // trees: cover the hill
  const avoid = [h1, h2, h3].map((h) => ({ x0: h.x0 - 0.55, x1: h.x1 + 0.55, z0: h.z0 - 0.55, z1: h.z1 + 0.65 }));
  const pathPts = curve.getPoints(40);
  const free = (x, z) => {
    for (const a of avoid) if (x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1) return false;
    for (const q of pathPts) if (Math.hypot(q.x - x, q.z - z) < 1.0) return false;
    if (Math.hypot(x - ux, z - uz) < 0.7) return false;
    if (Math.hypot(x - sx, z - sz) < 1.6) return false;
    return true;
  };
  let placed = 0;
  for (let i = 0; i < 1400 && placed < 70; i++) {
    const x = rr(x0 + 0.6, x1 - 0.5), z = rr(z0 + 0.6, z1 - 0.4);
    if (!free(x, z)) continue;
    const near = TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 1.15);
    if (near) continue;
    const h = hillH(x, z);
    const edge = x > x1 - 2.2 || z > z1 - 1.5;
    tree(ctx, x, h - 0.05, z, rr(0.65, 1.1) * (edge ? 0.85 : 1), edge && rand() > 0.45 ? 'pine' : (rand() > 0.88 ? 'shrub' : 'broad'));
    placed++;
  }
  for (let i = 0; i < 30; i++) {
    const x = rr(x0 + 0.4, x1 - 0.3), z = rr(z0 + 0.4, z1 - 0.3);
    if (!free(x, z)) continue;
    tree(ctx, x, hillH(x, z) - 0.05, z, rr(0.5, 0.9), 'shrub');
  }
  return { houses: [h1, h2, h3] };
}

export function buildLighthouse(ctx) {
  const b = ctx.main, gl = ctx.glass;
  const { x, z } = LAY.lh;
  const y0 = LAY.bw.top + 0.37;
  const H = 5.2;
  const red = [0.86, 0.26, 0.24], white = [0.96, 0.96, 0.94];
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const t0 = i / bands, t1 = (i + 1) / bands;
    const r0 = 0.78 - 0.22 * t0, r1 = 0.78 - 0.22 * t1;
    b.cyl(r1, r0, H / bands, { c: i % 2 ? white : red, t: T.PAINT, w: 0.5, l: i ? 0.4 : 1 }, x, y0 + (t0 + t1) / 2 * H, z, 0, 0, 0, 24);
  }
  // door & small windows
  b.box(0.06, 1.1, 0.55, { c: [0.3, 0.42, 0.5], t: T.PAINT }, x + 0.76, y0 + 0.55, z, 0, 0, 0.04);
  b.box(0.05, 0.3, 0.2, { c: [0.25, 0.32, 0.38] }, x + 0.64, y0 + 2.6, z, 0, 0, 0.04);
  // gallery
  const gy = y0 + H;
  b.cyl(0.85, 0.7, 0.14, { c: white, t: T.PAINT, w: 0.6 }, x, gy + 0.07, z, 0, 0, 0, 24);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.bar([x + Math.cos(a) * 0.8, gy + 0.14, z + Math.sin(a) * 0.8], [x + Math.cos(a) * 0.8, gy + 0.62, z + Math.sin(a) * 0.8], 0.015, { c: red, l: 0.6 }, 4);
  }
  b.torus(0.8, 0.025, { c: red }, x, gy + 0.62, z, Math.PI / 2, 0, 0, 5, 32);
  // lantern room
  b.cyl(0.42, 0.42, 0.18, { c: white, t: T.PAINT }, x, gy + 0.23, z, 0, 0, 0, 20);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.bar([x + Math.cos(a) * 0.4, gy + 0.3, z + Math.sin(a) * 0.4], [x + Math.cos(a) * 0.4, gy + 0.95, z + Math.sin(a) * 0.4], 0.018, { c: red, l: 0.6 }, 4);
  }
  gl.cyl(0.4, 0.4, 0.65, {}, x, gy + 0.62, z, 0, 0, 0, 20, true);
  b.lathe([[0.48, 0], [0.45, 0.08], [0.32, 0.28], [0.12, 0.42], [0.0, 0.46]], { c: red, t: T.PAINT, w: 0.6 }, x, gy + 0.95, z, 20);
  b.sphere(0.07, { c: red }, x, gy + 1.45, z);
  b.bar([x, gy + 1.45, z], [x, gy + 1.9, z], 0.012, { c: [0.3, 0.3, 0.3] }, 4);
  return new THREE.Vector3(x, gy + 0.6, z);
}
