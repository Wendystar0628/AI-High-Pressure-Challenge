import * as THREE from 'three';
import { GB, T, M } from '../core/builder.js';
import { U, rand, rr, srand, setLayers } from '../core/G.js';
import { SP, makeShaft } from '../core/special.js';
import { wall, windowIn, gableRoof, fishBox, crate } from './helpers.js';

export const SHAFTS = [];
export const INTERIOR_DRIPS = [];

export const WH = { X0: -19.6, X1: -11.4, Z0: -9.2, Z1: -0.6, H: 4.4, rise: 1.0 };
export const WR = { X0: -19.4, X1: -14.0, Z0: 8.4, Z1: 12.6, H: 2.9, rise: 1.15 };

export function buildWarehouse(ctx) {
  srand(7);
  const b = ctx.main, gl = ctx.glass, TX = ctx.TX;
  const { X0, X1, Z0, Z1, H, rise } = WH;
  const ext = { c: [0.86, 0.9, 0.9], t: T.CORR, w: 0.35, l: 0.8 };
  const inn = { c: [0.9, 0.89, 0.84], t: T.PLAIN, w: 0.1, l: 0.6, caus: true };
  const tk = 0.06, ti = 0.1;
  // floor (wet)
  b.box(X1 - X0, 0.05, Z1 - Z0, { c: [0.7, 0.73, 0.73], t: T.CONCRETE, w: 1.0, l: 0.3 }, (X0 + X1) / 2, 0.025, (Z0 + Z1) / 2);
  // drainage gutter on the floor
  b.box(0.25, 0.02, Z1 - Z0 - 0.6, { c: [0.35, 0.38, 0.4], t: T.RUST, l: 0.5 }, X1 - 1.3, 0.055, (Z0 + Z1) / 2);
  // --- front wall (x = X1, facing +x): shutter + high windows
  const frontOpen = [
    { a0: -7.0, a1: -2.8, y0: 0, y1: 3.6 },
    { a0: -8.8, a1: -7.5, y0: 2.95, y1: 3.85 },
    { a0: -2.3, a1: -1.0, y0: 2.95, y1: 3.85 },
  ];
  wall(b, { axis: 'z', at: X1 - tk / 2, from: Z0, to: Z1, y0: 0, y1: H, thick: tk, openings: frontOpen, opts: ext });
  wall(b, { axis: 'z', at: X1 - tk - ti / 2, from: Z0 + 0.05, to: Z1 - 0.05, y0: 0, y1: H, thick: ti, openings: frontOpen, opts: inn });
  // side +z (facing camera): two windows + a door
  const sideOpen = [
    { a0: -18.7, a1: -16.7, y0: 0.95, y1: 2.55 },
    { a0: -16.1, a1: -14.1, y0: 0.95, y1: 2.55 },
    { a0: -13.2, a1: -12.2, y0: 0, y1: 2.2 },
  ];
  wall(b, { axis: 'x', at: Z1 - tk / 2, from: X0, to: X1, y0: 0, y1: H, thick: tk, openings: sideOpen, opts: ext });
  wall(b, { axis: 'x', at: Z1 - tk - ti / 2, from: X0 + 0.05, to: X1 - 0.05, y0: 0, y1: H, thick: ti, openings: sideOpen, opts: inn });
  // back -z wall: high windows
  const backOpen = [{ a0: -17.6, a1: -15.8, y0: 3.0, y1: 3.8 }, { a0: -14.6, a1: -12.8, y0: 3.0, y1: 3.8 }];
  wall(b, { axis: 'x', at: Z0 + tk / 2, from: X0, to: X1, y0: 0, y1: H, thick: tk, openings: backOpen, opts: ext });
  wall(b, { axis: 'x', at: Z0 + tk + ti / 2, from: X0 + 0.05, to: X1 - 0.05, y0: 0, y1: H, thick: ti, openings: backOpen, opts: inn });
  // rear -x wall
  wall(b, { axis: 'z', at: X0 + tk / 2, from: Z0, to: Z1, y0: 0, y1: H, thick: tk, opts: ext });
  wall(b, { axis: 'z', at: X0 + tk + ti / 2, from: Z0 + 0.05, to: Z1 - 0.05, y0: 0, y1: H, thick: ti, opts: inn });
  // base skirting (concrete plinth around)
  b.box(X1 - X0 + 0.1, 0.25, 0.1, { c: [0.7, 0.72, 0.72], t: T.CONCRETE, l: 0.6 }, (X0 + X1) / 2, 0.125, Z1 + 0.02);
  // windows
  windowIn(b, gl, { axis: 'z', at: X1 - 0.03, a0: -8.8, a1: -7.5, y0: 2.95, y1: 3.85, mullions: 1 });
  windowIn(b, gl, { axis: 'z', at: X1 - 0.03, a0: -2.3, a1: -1.0, y0: 2.95, y1: 3.85, mullions: 1 });
  windowIn(b, gl, { axis: 'x', at: Z1 - 0.03, a0: -18.7, a1: -16.7, y0: 0.95, y1: 2.55, mullions: 1, transoms: 0 });
  windowIn(b, gl, { axis: 'x', at: Z1 - 0.03, a0: -16.1, a1: -14.1, y0: 0.95, y1: 2.55, mullions: 1 });
  windowIn(b, gl, { axis: 'x', at: Z0 + 0.03, a0: -17.6, a1: -15.8, y0: 3.0, y1: 3.8, mullions: 1 });
  windowIn(b, gl, { axis: 'x', at: Z0 + 0.03, a0: -14.6, a1: -12.8, y0: 3.0, y1: 3.8, mullions: 1 });
  // door (open, swung outward)
  b.box(1.0, 0.06, 0.18, { c: [0.6, 0.64, 0.66], t: T.PAINT }, -12.7, 2.23, Z1 + 0.02);
  b.push(M(-13.2, 0, Z1 + 0.03, 0, -1.25, 0));
  b.box(0.96, 2.16, 0.05, { c: [0.55, 0.66, 0.72], t: T.PAINT, w: 0.4 }, 0.48, 1.09, 0);
  b.box(0.5, 0.6, 0.06, { c: [0.7, 0.8, 0.82], l: 0.5 }, 0.48, 1.6, 0.0);
  b.cyl(0.02, 0.02, 0.14, { c: [0.75, 0.75, 0.72] }, 0.85, 1.05, 0.05, Math.PI / 2, 0, 0, 6);
  b.pop();
  // roof (corrugated) + gables
  gableRoof(b, {
    cx: (X0 + X1) / 2, cz: (Z0 + Z1) / 2, along: 'x', len: X1 - X0, width: Z1 - Z0, eaveY: H, rise, over: 0.45, thick: 0.1,
    opts: { c: [0.56, 0.66, 0.72], t: T.ROOF, w: 0.8, l: 0.9 }, ridgeOpts: { c: [0.5, 0.58, 0.64], t: T.RUST },
    gableOpts: { c: [0.86, 0.9, 0.9], t: T.CORR, w: 0.3, l: 0.8, caus: true }, caus: true,
  });
  // interior ceiling trusses
  for (let x = X0 + 1.4; x < X1 - 0.5; x += 2.2) {
    b.box(0.12, 0.16, Z1 - Z0 - 0.3, { c: [0.78, 0.8, 0.8], t: T.PAINT, caus: true, l: 0.7 }, x, H - 0.1, (Z0 + Z1) / 2);
    b.bar([x, H - 0.1, Z0 + 0.3], [x, H + rise - 0.25, (Z0 + Z1) / 2], 0.05, { c: [0.78, 0.8, 0.8], caus: true, l: 0.6 });
    b.bar([x, H - 0.1, Z1 - 0.3], [x, H + rise - 0.25, (Z0 + Z1) / 2], 0.05, { c: [0.78, 0.8, 0.8], caus: true, l: 0.6 });
  }
  // fluorescent lamps
  for (const z of [-6.5, -3.4]) {
    b.box(1.3, 0.06, 0.18, { c: [0.85, 0.85, 0.82], caus: true }, -15.5, H - 0.25, z);
    b.cyl(0.03, 0.03, 1.2, { c: [0.95, 0.97, 0.95], e: 0.3 }, -15.5, H - 0.3, z, 0, 0, Math.PI / 2, 6);
  }
  // --- roll-up shutter, half raised
  const sz0 = -7.0, sz1 = -2.8, sTop = 3.6, sBot = 2.35;
  b.box(0.08, sTop - sBot, sz1 - sz0, { c: [0.74, 0.78, 0.8], t: T.SHUTTER, w: 0.5, l: 0.8 }, X1 + 0.05, (sTop + sBot) / 2, (sz0 + sz1) / 2);
  b.box(0.14, 0.09, sz1 - sz0, { c: [0.5, 0.54, 0.56], t: T.PAINT, l: 1 }, X1 + 0.06, sBot + 0.045, (sz0 + sz1) / 2);
  b.box(0.18, 0.1, 0.06, { c: [0.35, 0.36, 0.38], l: 0.6 }, X1 + 0.12, sBot + 0.02, (sz0 + sz1) / 2);
  // housing box & guide rails
  b.rbox(0.5, 0.48, sz1 - sz0 + 0.3, 0.05, { c: [0.66, 0.72, 0.75], t: T.PAINT, w: 0.4 }, X1 + 0.25, sTop + 0.22, (sz0 + sz1) / 2);
  for (const z of [sz0 - 0.06, sz1 + 0.06]) b.box(0.16, sTop, 0.12, { c: [0.62, 0.66, 0.68], t: T.PAINT, l: 0.8 }, X1 + 0.08, sTop / 2, z);
  // sign board on the gable
  b.box(0.06, 0.82, 5.3, { c: [0.3, 0.42, 0.55], l: 0.8 }, X1 + 0.06, H + 0.38, -4.9);
  ctx.decal(TX.kumiai, 5.1, 0.72, M(X1 + 0.1, H + 0.38, -4.9, 0, Math.PI / 2, 0), { w: 0.3 });
  // no-entry sign by door
  ctx.decal(TX.noEntry, 0.6, 0.3, M(-13.7, 1.6, Z1 + 0.02, 0, 0, 0), { w: 0.2 });
  // drain pipe & gutter
  b.cyl(0.07, 0.07, X1 - X0 + 0.8, { c: [0.7, 0.74, 0.76], t: T.RUST }, (X0 + X1) / 2, H - 0.05, Z1 + 0.55, 0, 0, Math.PI / 2, 8);
  b.cyl(0.06, 0.06, H, { c: [0.7, 0.74, 0.76], t: T.RUST }, X1 + 0.2, H / 2, Z1 + 0.25, 0, 0, 0, 8);
  // electric meter box
  b.rbox(0.36, 0.5, 0.16, 0.03, { c: [0.85, 0.86, 0.84], t: T.PAINT }, -18.9, 1.7, Z1 + 0.08);
  // outdoor lamp over the door
  b.box(0.08, 0.08, 0.35, { c: [0.3, 0.3, 0.3] }, -12.7, 2.6, Z1 + 0.18);
  b.sphere(0.12, { c: [0.98, 0.95, 0.85], e: 0.2 }, -12.7, 2.5, Z1 + 0.34, 1, 0.8, 1);

  // --- exterior details ---------------------------------------------------------------
  // fire hydrant box on the +z side wall
  b.rbox(0.42, 0.66, 0.16, 0.03, { c: [0.85, 0.2, 0.17], t: T.PAINT, w: 0.6 }, -11.72, 1.0, Z1 + 0.08);
  ctx.decal(TX.hydrant, 0.2, 0.32, M(-11.8, 1.02, Z1 + 0.165), { w: 0.3, l: 0.3 });
  // a faucet with a coiled hose
  b.cyl(0.025, 0.025, 0.15, { c: [0.7, 0.7, 0.7], w: 0.9 }, -15.1, 0.7, Z1 + 0.08, Math.PI / 2, 0, 0, 6);
  for (let k = 0; k < 5; k++) b.torus(0.24 - k * 0.012, 0.022, { c: [0.25, 0.55, 0.35], w: 0.6 }, -15.1, 0.42, Z1 + 0.14 + k * 0.03, 0, 0, 0, 5, 18);
  // pallets leaning on the wall
  for (let k = 0; k < 3; k++) {
    b.push(M(-19.1 + k * 0.06, 0, Z1 + 0.25 + k * 0.1, -0.18, 0, 0));
    for (let j = 0; j < 5; j++) b.box(1.1, 0.02, 0.12, { c: [0.7, 0.56, 0.38], t: T.WOOD, l: 0.7 }, 0, 0.1 + j * 0.25, 0);
    for (const dx of [-0.48, 0, 0.48]) b.box(0.09, 1.1, 0.08, { c: [0.62, 0.48, 0.32], t: T.WOOD, l: 0.7 }, dx, 0.6, -0.05);
    b.pop();
  }
  // "セリ場" sign by the shutter
  b.box(0.04, 0.38, 0.95, { c: [0.5, 0.4, 0.3], t: T.WOOD }, X1 + 0.03, 2.3, -7.75);
  ctx.decal(TX.seriba, 0.9, 0.34, M(X1 + 0.055, 2.3, -7.75, 0, Math.PI / 2, 0), { w: 0.3, l: 0.4 });
  // roof ridge ventilators
  for (const x of [-17.5, -14.0]) {
    b.cyl(0.12, 0.14, 0.25, { c: [0.7, 0.74, 0.76], t: T.PAINT, w: 0.7 }, x, H + rise + 0.15, (Z0 + Z1) / 2, 0, 0, 0, 10);
    b.sphere(0.2, { c: [0.75, 0.78, 0.8], t: T.PAINT, w: 0.8, cf: (v) => (Math.floor(Math.atan2(v.z - (Z0 + Z1) / 2, v.x - x) * 4) % 2 ? [0.68, 0.72, 0.74] : [0.8, 0.83, 0.85]) }, x, H + rise + 0.38, (Z0 + Z1) / 2, 1, 0.8, 1, 12, 8);
  }

  // --- interior props -------------------------------------------------------------
  const iy = 0.05;
  // stacks of fish boxes along -z wall
  for (let i = 0; i < 6; i++) {
    const x = -18.8 + i * 0.95;
    const n = 4 + Math.floor(rand() * 5);
    for (let k = 0; k < n; k++) fishBox(b, x + rr(-0.03, 0.03), iy + k * 0.2, Z0 + 0.6 + rr(-0.03, 0.03), rr(-0.04, 0.04));
  }
  for (let i = 0; i < 3; i++) {
    const n = 3 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) fishBox(b, -18.8 + i * 0.95, iy + k * 0.2, Z0 + 1.1, rr(-0.05, 0.05));
  }
  // blue crates stack
  for (let i = 0; i < 3; i++) for (let k = 0; k < 4 - i; k++) crate(b, -13.2 + i * 0.62, iy + k * 0.3, Z0 + 0.55, rr(-0.05, 0.05));
  // chest freezers
  for (const z of [-5.2, -3.55]) {
    b.rbox(0.95, 0.85, 1.55, 0.05, { c: [0.94, 0.95, 0.94], t: T.PAINT, w: 0.5 }, -19.0, iy + 0.425, z);
    b.rbox(0.98, 0.07, 1.58, 0.03, { c: [0.8, 0.84, 0.86], w: 0.6 }, -19.0, iy + 0.88, z);
    b.box(0.05, 0.05, 0.6, { c: [0.5, 0.52, 0.55] }, -18.5, iy + 0.82, z);
    b.box(0.02, 0.18, 0.3, { c: [0.25, 0.55, 0.85], e: 0.4 }, -18.52, iy + 0.55, z + 0.45);
  }
  // ice cubes in an open box on top of freezer & on floor
  fishBox(b, -18.95, iy + 0.92, -5.2, 0.1, { open: true });
  const ice = [];
  for (let i = 0; i < 26; i++) ice.push([-18.95 + rr(-0.25, 0.25), iy + 0.95 + rr(0, 0.1), -5.2 + rr(-0.15, 0.15)]);
  for (let i = 0; i < 34; i++) { const a = rand() * 6.28, r = rr(0.2, 1.6); ice.push([-16.2 + Math.cos(a) * r * 1.2, iy + 0.04, -4.3 + Math.sin(a) * r]); }
  for (const p of ice) b.rbox(rr(0.06, 0.11), rr(0.05, 0.09), rr(0.06, 0.11), 0.015, { c: [0.86, 0.96, 1.0], w: 1.0, e: 0.15, l: 0.4 }, p[0], p[1], p[2], rand(), rand() * 3, rand());
  // platform scale
  {
    const sx = -14.2, sz = -4.3;
    b.rbox(1.1, 0.1, 0.85, 0.03, { c: [0.62, 0.66, 0.68], t: T.RUST, w: 0.8 }, sx, iy + 0.05, sz);
    b.box(1.0, 0.012, 0.75, { c: [0.72, 0.75, 0.77], w: 0.9, l: 0.2 }, sx, iy + 0.106, sz);
    b.cyl(0.04, 0.05, 1.0, { c: [0.3, 0.45, 0.6], t: T.PAINT }, sx - 0.5, iy + 0.6, sz - 0.38, 0, 0, 0, 8);
    b.cyl(0.24, 0.24, 0.1, { c: [0.3, 0.45, 0.6], t: T.PAINT }, sx - 0.5, iy + 1.25, sz - 0.38, Math.PI / 2, 0.5, 0, 20);
    b.cyl(0.2, 0.2, 0.02, { c: [0.97, 0.97, 0.94], l: 0.3 }, sx - 0.47, iy + 1.25, sz - 0.33, Math.PI / 2, 0.5, 0, 20);
    b.box(0.012, 0.17, 0.01, { c: [0.85, 0.15, 0.1] }, sx - 0.46, iy + 1.3, sz - 0.31, 0.0, 0.5, 0.5);
    // a box on the scale with fish
    fishBox(b, sx, iy + 0.11, sz, 0.2, { open: true });
    for (let i = 0; i < 5; i++) b.sphere(0.08, { c: [0.62, 0.7, 0.78], w: 0.9, l: 0.4 }, sx + rr(-0.2, 0.2), iy + 0.2, sz + rr(-0.1, 0.1), 2.4, 0.6, 0.8);
  }
  // rain boots on back wall rail + rubber aprons
  {
    const wx = X0 + tk + ti + 0.02;
    b.box(0.06, 0.08, 4.4, { c: [0.55, 0.42, 0.3], t: T.WOOD }, wx + 0.03, 1.55, -6.4);
    const cols = [[0.98, 0.82, 0.18], [0.98, 0.82, 0.18], [0.95, 0.95, 0.93], [0.95, 0.95, 0.93], [0.15, 0.16, 0.18], [0.15, 0.16, 0.18], [0.2, 0.28, 0.45], [0.2, 0.28, 0.45]];
    cols.forEach((c, i) => {
      const z = -8.2 + i * 0.42 + (i % 2) * -0.1;
      b.cyl(0.02, 0.02, 0.18, { c: [0.6, 0.6, 0.6] }, wx + 0.1, 1.52, z, 0, 0, Math.PI / 2, 5);
      b.cyl(0.085, 0.075, 0.42, { c, w: 0.7, l: 0.8 }, wx + 0.16, 1.28, z, 0, 0, 0.05, 10);
      b.rbox(0.28, 0.1, 0.13, 0.04, { c, w: 0.7 }, wx + 0.24, 1.04, z);
    });
    for (let i = 0; i < 2; i++) {
      b.cyl(0.02, 0.02, 0.15, { c: [0.6, 0.6, 0.6] }, wx + 0.08, 1.95, -4.6 + i * 0.75, 0, 0, Math.PI / 2, 5);
      b.box(0.03, 1.05, 0.6, { c: [0.95, 0.55, 0.2], t: T.FABRIC, w: 0.6 }, wx + 0.12, 1.42, -4.6 + i * 0.75, 0, 0, 0.03);
    }
    // blackboard with auction prices
    b.box(0.06, 1.3, 1.9, { c: [0.5, 0.38, 0.26], t: T.WOOD }, wx + 0.03, 1.72, -2.1);
    ctx.decal(TX.blackboard, 1.82, 1.24, M(wx + 0.07, 1.72, -2.1, 0, Math.PI / 2, 0), { w: 0.1, l: 0.4 });
    b.box(0.12, 0.04, 1.8, { c: [0.5, 0.38, 0.26], t: T.WOOD }, wx + 0.08, 1.06, -2.1);
    // hose reel
    b.torus(0.32, 0.04, { c: [0.25, 0.55, 0.35], w: 0.6 }, wx + 0.1, 2.45, -5.6, 0, Math.PI / 2, 0, 6, 20);
    b.torus(0.27, 0.04, { c: [0.25, 0.55, 0.35], w: 0.6 }, wx + 0.14, 2.45, -5.6, 0, Math.PI / 2, 0, 6, 20);
    // wall clock & calendar
    b.cyl(0.24, 0.24, 0.05, { c: [0.3, 0.3, 0.3] }, wx + 0.03, 3.3, -6.4, 0, 0, Math.PI / 2, 20);
    ctx.decal(TX.clock, 0.42, 0.42, M(wx + 0.06, 3.3, -6.4, 0, Math.PI / 2, 0), { w: 0.1, l: 0.3, alphaTest: 0.5 });
    ctx.decal(TX.calendar, 0.45, 0.62, M(wx + 0.03, 2.85, -2.1, 0, Math.PI / 2, 0.03), { w: 0.1, l: 0.3 });
  }
  // stainless sink along +z wall interior
  b.box(1.6, 0.85, 0.6, { c: [0.78, 0.82, 0.84], w: 0.9 }, -15.2, iy + 0.43, Z1 - 0.5);
  b.box(1.4, 0.05, 0.45, { c: [0.6, 0.64, 0.66], w: 1 }, -15.2, iy + 0.86, Z1 - 0.5);
  b.cyl(0.02, 0.02, 0.3, { c: [0.8, 0.8, 0.8] }, -15.2, iy + 1.0, Z1 - 0.7, 0.4, 0, 0, 6);
  // hand cart
  b.box(1.0, 0.04, 0.6, { c: [0.35, 0.45, 0.6], t: T.RUST }, -16.6, iy + 0.2, -6.0);
  for (const dx of [-0.4, 0.4]) for (const dz of [-0.22, 0.22]) b.cyl(0.07, 0.07, 0.05, { c: [0.15, 0.15, 0.15] }, -16.6 + dx, iy + 0.07, -6.0 + dz, Math.PI / 2, 0, 0, 10);
  b.bar([-17.1, iy + 0.2, -6.25], [-17.25, iy + 1.0, -6.25], 0.02, { c: [0.6, 0.6, 0.62] });
  b.bar([-17.1, iy + 0.2, -5.75], [-17.25, iy + 1.0, -5.75], 0.02, { c: [0.6, 0.6, 0.62] });
  b.bar([-17.25, iy + 1.0, -6.25], [-17.25, iy + 1.0, -5.75], 0.02, { c: [0.6, 0.6, 0.62] });
  for (let k = 0; k < 3; k++) crate(b, -16.6, iy + 0.22 + k * 0.3, -6.0, 0.03 * k, { c: [0.22, 0.45, 0.8] });

  // light shafts from high windows (sun along -sunDir)
  const sd = U.uSunDir.value.clone().negate();
  const addShaft = (o, size, len, str) => { const s = makeShaft(o, size, len, sd, str); ctx.scene.add(s); SHAFTS.push(s); };
  addShaft(new THREE.Vector3(X1 - 0.1, 3.4, -8.15), [0.3, 1.2], 5.6, 1.6);
  addShaft(new THREE.Vector3(X1 - 0.1, 3.4, -1.65), [0.3, 1.2], 5.0, 1.6);
  addShaft(new THREE.Vector3(-16.7, 3.4, Z0 + 0.1), [1.7, 0.3], 5.0, 0.7);
  addShaft(new THREE.Vector3(-13.7, 3.4, Z0 + 0.1), [1.7, 0.3], 5.0, 0.7);
}

export function buildWaitingRoom(ctx) {
  srand(11);
  const b = ctx.main, gl = ctx.glass, TX = ctx.TX;
  const { X0, X1, Z0, Z1, H, rise } = WR;
  const plaster = { c: [0.95, 0.92, 0.84], t: T.PLAIN, w: 0.2, l: 0.8 };
  const inner = { c: [0.94, 0.91, 0.82], t: T.PLAIN, w: 0.05, l: 0.6 };
  const frame = { c: [0.78, 0.8, 0.8], t: T.PLAIN, w: 0.5, l: 0.9 };
  // floor slab & tiles
  b.box(X1 - X0 + 0.3, 0.12, Z1 - Z0 + 0.3, { c: [0.78, 0.79, 0.77], t: T.CONCRETE, l: 0.7 }, (X0 + X1) / 2, 0.06, (Z0 + Z1) / 2);
  b.box(X1 - X0 - 0.2, 0.01, Z1 - Z0 - 0.2, {
    c: [0.8, 0.8, 0.78], w: 0.6, l: 0.2,
    cf: (v) => ((Math.floor(v.x * 2.5) + Math.floor(v.z * 2.5)) % 2 === 0 ? [0.84, 0.82, 0.76] : [0.72, 0.74, 0.72]),
  }, (X0 + X1) / 2, 0.125, (Z0 + Z1) / 2);
  const y0 = 0.12;
  // solid walls -x and -z
  wall(b, { axis: 'z', at: X0 + 0.08, from: Z0, to: Z1, y0, y1: H, thick: 0.16, opts: plaster });
  wall(b, { axis: 'x', at: Z0 + 0.08, from: X0, to: X1, y0, y1: H, thick: 0.16, opts: plaster });
  // wainscot tiles outside
  b.box(0.04, 0.8, Z1 - Z0, { c: [0.52, 0.64, 0.7], t: T.PLAIN, w: 0.6 }, X0 - 0.02, y0 + 0.4, (Z0 + Z1) / 2);
  b.box(X1 - X0, 0.8, 0.04, { c: [0.52, 0.64, 0.7], t: T.PLAIN, w: 0.6 }, (X0 + X1) / 2, y0 + 0.4, Z0 - 0.02);
  // inner wainscot (wood)
  b.box(0.03, 0.9, Z1 - Z0 - 0.3, { c: [0.7, 0.55, 0.38], t: T.WOOD, l: 0.5 }, X0 + 0.175, y0 + 0.45, (Z0 + Z1) / 2);
  b.box(X1 - X0 - 0.3, 0.9, 0.03, { c: [0.7, 0.55, 0.38], t: T.WOOD, l: 0.5 }, (X0 + X1) / 2, y0 + 0.45, Z0 + 0.175);
  // glass curtain walls: +z (front) and +x (side)
  const postsZ = [X0 + 0.08, -17.6, -15.8, X1 - 0.05];
  for (const x of postsZ) b.box(0.09, H - y0, 0.09, frame, x, (H + y0) / 2, Z1 - 0.05);
  b.box(X1 - X0, 0.1, 0.12, frame, (X0 + X1) / 2, y0 + 0.05, Z1 - 0.05);
  b.box(X1 - X0, 0.14, 0.14, frame, (X0 + X1) / 2, H - 0.07, Z1 - 0.05);
  b.box(X1 - X0, 0.05, 0.08, frame, (X0 + X1) / 2, 1.0, Z1 - 0.05);
  gl.box(X1 - X0 - 0.1, H - y0 - 0.2, 0.012, {}, (X0 + X1) / 2, (H + y0) / 2, Z1 - 0.05);
  const postsX = [Z0 + 0.1, 10.0, 11.3];
  for (const z of postsX) b.box(0.09, H - y0, 0.09, frame, X1 - 0.05, (H + y0) / 2, z);
  b.box(0.12, 0.1, Z1 - Z0, frame, X1 - 0.05, y0 + 0.05, (Z0 + Z1) / 2);
  b.box(0.14, 0.14, Z1 - Z0, frame, X1 - 0.05, H - 0.07, (Z0 + Z1) / 2);
  gl.box(0.012, H - y0 - 0.2, 10.0 - Z0 - 0.15, {}, X1 - 0.05, (H + y0) / 2, (Z0 + 10.0) / 2);
  // sliding door (one leaf slid open behind the fixed pane), opening between z 11.3..12.55
  b.box(0.05, H - y0 - 0.25, 0.05, frame, X1 - 0.12, (H + y0) / 2 - 0.05, 10.05);
  b.box(0.05, H - y0 - 0.25, 0.05, frame, X1 - 0.12, (H + y0) / 2 - 0.05, 11.25);
  gl.box(0.012, H - y0 - 0.35, 1.15, {}, X1 - 0.12, (H + y0) / 2 - 0.05, 10.65);
  gl.box(0.012, H - y0 - 0.2, 1.15, {}, X1 - 0.05, (H + y0) / 2, 10.65 + 0.0);
  b.box(0.06, 0.25, 0.04, { c: [0.3, 0.3, 0.3] }, X1 - 0.16, 1.1, 11.2);
  // entrance mat
  b.box(0.9, 0.02, 1.1, { c: [0.35, 0.42, 0.38], t: T.FABRIC, l: 0.4 }, X1 + 0.55, 0.01, 11.9);
  // roof (kawara)
  gableRoof(b, {
    cx: (X0 + X1) / 2, cz: (Z0 + Z1) / 2, along: 'x', len: X1 - X0, width: Z1 - Z0, eaveY: H, rise, over: 0.55, thick: 0.14,
    opts: { c: [0.42, 0.5, 0.58], t: T.TILE, w: 0.9, l: 0.9 }, ridgeOpts: { c: [0.36, 0.42, 0.5], t: T.PLAIN, w: 0.8 },
    gableOpts: { c: [0.95, 0.92, 0.84], t: T.PLAIN, l: 0.8 },
  });
  // ceiling
  b.box(X1 - X0 - 0.1, 0.04, Z1 - Z0 - 0.1, { c: [0.92, 0.9, 0.84], l: 0.4, caus: true }, (X0 + X1) / 2, H - 0.02, (Z0 + Z1) / 2);
  b.box(0.8, 0.05, 0.25, { c: [0.98, 0.98, 0.95], e: 0.4, caus: true }, (X0 + X1) / 2, H - 0.07, (Z0 + Z1) / 2);
  // sign above door on gable
  ctx.decal(TX.waitSign, 1.6, 0.4, M(X1 + 0.02, H + 0.3, (Z0 + Z1) / 2, 0, Math.PI / 2, 0), { w: 0.2 });
  // gutter
  b.cyl(0.06, 0.06, X1 - X0 + 1.1, { c: [0.65, 0.7, 0.72], t: T.RUST }, (X0 + X1) / 2, H - 0.1, Z1 + 0.62, 0, 0, Math.PI / 2, 8);

  // --- interior ------------------------------------------------------------
  const fy = 0.13;
  // long wooden bench along the -x wall, facing +x
  const bench = (x, z, len, ry) => {
    b.push(M(x, fy, z, 0, ry, 0));
    const wood = { c: [0.72, 0.52, 0.32], t: T.WOOD, w: 0.3, l: 0.8 };
    for (let i = 0; i < 3; i++) b.box(len, 0.04, 0.12, wood, 0, 0.44, -0.15 + i * 0.14, 0, 0, 0);
    b.box(len, 0.1, 0.03, wood, 0, 0.66, -0.24, 0.25, 0, 0);
    b.box(len, 0.1, 0.03, wood, 0, 0.82, -0.27, 0.25, 0, 0);
    for (const dx of [-len / 2 + 0.12, len / 2 - 0.12]) {
      b.box(0.06, 0.44, 0.06, { c: [0.45, 0.33, 0.22], t: T.WOOD }, dx, 0.22, 0.12);
      b.box(0.06, 0.86, 0.06, { c: [0.45, 0.33, 0.22], t: T.WOOD }, dx, 0.43, -0.24, 0.12, 0, 0);
    }
    b.pop();
  };
  bench(X0 + 0.55, (Z0 + Z1) / 2 + 0.2, 2.8, Math.PI / 2);
  bench((X0 + X1) / 2 + 0.4, Z0 + 0.55, 2.0, 0);
  // a forgotten towel on the bench
  b.rbox(0.35, 0.03, 0.22, 0.01, { c: [0.98, 0.72, 0.72], t: T.FABRIC }, X0 + 0.55, fy + 0.475, 11.4, 0, 0.3, 0);
  // timetable on -z wall (faces +z, visible through the front glass)
  ctx.decal(TX.timetable, 0.95, 1.27, M(-15.4, 1.95, Z0 + 0.17, 0, 0, 0), { w: 0.1, l: 0.4 });
  ctx.decal(TX.poster, 0.6, 0.8, M(-17.9, 1.85, Z0 + 0.17, 0, 0, -0.02), { w: 0.1, l: 0.4 });
  // wall clock (slightly tilted)
  b.push(M(-16.6, 2.45, Z0 + 0.2, 0, 0, 0.13));
  b.cyl(0.22, 0.22, 0.06, { c: [0.55, 0.36, 0.22], t: T.WOOD }, 0, 0, 0, Math.PI / 2, 0, 0, 20);
  b.pop();
  ctx.decal(TX.clock, 0.37, 0.37, M(-16.6, 2.45, Z0 + 0.24, 0, 0, 0.13), { w: 0.1, l: 0.3, alphaTest: 0.5 });
  // corner cabinet with kettle + pothos (+x,-z corner? -> use -x,-z corner)
  const cx = X0 + 0.45, cz = Z0 + 0.42;
  b.rbox(0.7, 0.75, 0.55, 0.02, { c: [0.66, 0.5, 0.34], t: T.WOOD, l: 0.8 }, cx + 0.12, fy + 0.375, cz);
  b.box(0.02, 0.6, 0.01, { c: [0.4, 0.3, 0.2] }, cx + 0.12, fy + 0.4, cz + 0.28);
  // electric hot-water pot (魔法瓶)
  b.cyl(0.11, 0.12, 0.3, { c: [0.95, 0.94, 0.9], w: 0.6, l: 0.8 }, cx + 0.3, fy + 0.9, cz - 0.05, 0, 0, 0, 16);
  b.cyl(0.1, 0.11, 0.06, { c: [0.85, 0.42, 0.35], w: 0.6 }, cx + 0.3, fy + 1.08, cz - 0.05, 0, 0, 0, 16);
  b.box(0.05, 0.04, 0.05, { c: [0.3, 0.3, 0.3] }, cx + 0.42, fy + 1.0, cz - 0.05);
  b.torus(0.07, 0.012, { c: [0.3, 0.3, 0.3] }, cx + 0.3, fy + 1.13, cz - 0.05, 0, 0, 0, 5, 14, Math.PI);
  // tea cups
  b.cyl(0.035, 0.03, 0.07, { c: [0.85, 0.9, 0.85] }, cx + 0.05, fy + 0.79, cz + 0.1, 0, 0, 0, 10);
  b.cyl(0.035, 0.03, 0.07, { c: [0.6, 0.75, 0.82] }, cx - 0.05, fy + 0.79, cz + 0.02, 0, 0, 0, 10);
  // pothos on the floor in corner + vines
  const px = X0 + 0.4, pz = Z0 + 1.15;
  b.cyl(0.18, 0.13, 0.3, { c: [0.75, 0.48, 0.35], l: 0.8 }, px, fy + 0.15, pz, 0, 0, 0, 14);
  b.cyl(0.17, 0.17, 0.02, { c: [0.3, 0.22, 0.16] }, px, fy + 0.29, pz, 0, 0, 0, 14);
  const leafG = new THREE.SphereGeometry(0.07, 6, 4);
  leafG.scale(1, 0.3, 1.4);
  for (let v = 0; v < 7; v++) {
    const a = (v / 7) * Math.PI * 2;
    const len = rr(0.4, 1.0);
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const up = v < 3 ? t * len * 0.9 : 0.2 - t * len * 0.7;
      pts.push(new THREE.Vector3(px + Math.cos(a) * t * 0.35, fy + 0.32 + Math.max(-0.28, up), pz + Math.sin(a) * t * 0.35));
    }
    b.tube(pts, 0.008, { c: [0.3, 0.5, 0.25] }, 10, 4);
    for (let k = 1; k <= 8; k++) {
      const p = pts[k];
      b.add(leafG, { c: [0.32 + rand() * 0.15, 0.62 + rand() * 0.15, 0.25], t: T.LEAF, l: 0.5 }, M(p.x + rr(-0.04, 0.04), p.y, p.z + rr(-0.04, 0.04), rr(-0.5, 0.5), rand() * 6, rr(-0.4, 0.4)));
    }
  }
  // old radio on side table near the bench
  const rx = X0 + 0.45, rz = Z1 - 0.55;
  b.rbox(0.5, 0.5, 0.45, 0.02, { c: [0.6, 0.45, 0.3], t: T.WOOD }, rx, fy + 0.25, rz);
  b.rbox(0.42, 0.24, 0.16, 0.03, { c: [0.55, 0.36, 0.22], t: T.WOOD, w: 0.5 }, rx, fy + 0.62, rz, 0, 0.4, 0);
  b.push(M(rx, fy + 0.62, rz, 0, 0.4, 0));
  b.box(0.18, 0.16, 0.01, { c: [0.85, 0.8, 0.68], cf: (v) => (Math.floor((v.y) * 60) % 2 ? [0.75, 0.7, 0.58] : [0.88, 0.82, 0.7]) }, -0.09, 0, 0.08);
  b.cyl(0.03, 0.03, 0.03, { c: [0.2, 0.2, 0.2] }, 0.12, -0.03, 0.08, Math.PI / 2, 0, 0, 10);
  b.cyl(0.03, 0.03, 0.03, { c: [0.2, 0.2, 0.2] }, 0.12, 0.05, 0.08, Math.PI / 2, 0, 0, 10);
  b.bar([0.15, 0.12, -0.05], [0.28, 0.45, -0.1], 0.006, { c: [0.75, 0.75, 0.75] });
  b.pop();
  ctx.decal(TX.radio, 0.14, 0.07, M(rx + Math.sin(0.4) * 0.081 + 0.03, fy + 0.62, rz + Math.cos(0.4) * 0.081 - 0.02, 0, 0.4, 0), { w: 0.2, l: 0.2 });
  // trash bin, fire extinguisher, umbrella stand
  b.cyl(0.16, 0.14, 0.45, { c: [0.35, 0.5, 0.55], w: 0.4 }, X1 - 0.45, fy + 0.225, Z0 + 0.4, 0, 0, 0, 14);
  b.cyl(0.08, 0.08, 0.45, { c: [0.85, 0.18, 0.15], w: 0.6 }, X1 - 0.25, fy + 0.25, Z0 + 0.95, 0, 0, 0, 10);
  b.box(0.06, 0.08, 0.08, { c: [0.2, 0.2, 0.2] }, X1 - 0.25, fy + 0.52, Z0 + 0.95);
}

export function buildVending(ctx, x, z, ry) {
  const b = ctx.main, TX = ctx.TX;
  b.push(M(x, 0, z, 0, ry, 0));
  // body
  b.rbox(1.0, 1.83, 0.75, 0.03, { c: [0.25, 0.48, 0.78], t: T.PAINT, w: 0.6, l: 1 }, 0, 0.93, 0);
  b.box(0.92, 0.06, 0.7, { c: [0.3, 0.3, 0.32] }, 0, 0.03, 0);
  b.pop();
  // front decal (glowing display)
  const m = M(x, 0, z, 0, ry, 0).multiply(M(0, 0.95, 0.38, 0, 0, 0));
  ctx.decal(TX.vending, 0.92, 1.8, m, { e: 0.55, w: 0.5, l: 0.6 });
  // glow light
  // rusty awning
  b.push(M(x, 0, z, 0, ry, 0));
  b.box(1.4, 0.05, 1.0, { c: [0.62, 0.55, 0.48], t: T.RUST, w: 0.6, l: 1 }, 0, 2.2, 0.2, 0.12, 0, 0);
  for (let i = -3; i <= 3; i++) b.box(0.04, 0.03, 1.0, { c: [0.55, 0.45, 0.38], t: T.RUST }, i * 0.2, 2.24, 0.2, 0.12, 0, 0);
  b.bar([-0.6, 2.18, 0.65], [-0.6, 1.6, -0.3], 0.025, { c: [0.45, 0.35, 0.3], t: T.RUST });
  b.bar([0.6, 2.18, 0.65], [0.6, 1.6, -0.3], 0.025, { c: [0.45, 0.35, 0.3], t: T.RUST });
  // recycle bin next to it
  b.rbox(0.42, 0.75, 0.38, 0.03, { c: [0.25, 0.48, 0.78], t: T.PAINT, w: 0.5 }, 0.8, 0.375, 0.05);
  b.cyl(0.07, 0.07, 0.02, { c: [0.1, 0.1, 0.1] }, 0.8, 0.6, 0.25, Math.PI / 2, 0, 0, 12);
  b.cyl(0.07, 0.07, 0.02, { c: [0.1, 0.1, 0.1] }, 0.8, 0.4, 0.25, Math.PI / 2, 0, 0, 12);
  b.pop();
}
