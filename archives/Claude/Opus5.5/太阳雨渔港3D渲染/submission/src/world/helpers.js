import * as THREE from 'three';
import { GB, T, M } from '../core/builder.js';
import { rand, rr } from '../core/G.js';

/**
 * Wall with rectangular openings.
 * axis 'x': runs along x at z=at ; axis 'z': runs along z at x=at.
 * openings: [{a0, a1, y0, y1}] in wall coordinates (a along the axis)
 */
export function wall(b, { axis, at, from, to, y0, y1, thick = 0.15, openings = [], opts }) {
  const cuts = new Set([from, to]);
  for (const o of openings) { cuts.add(Math.max(from, o.a0)); cuts.add(Math.min(to, o.a1)); }
  const xs = [...cuts].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a0 = xs[i], a1 = xs[i + 1];
    if (a1 - a0 < 1e-3) continue;
    const mid = (a0 + a1) / 2;
    const holes = openings.filter((o) => o.a0 <= mid && o.a1 >= mid).sort((p, q) => p.y0 - q.y0);
    let y = y0;
    const segs = [];
    for (const h of holes) { if (h.y0 > y) segs.push([y, h.y0]); y = Math.max(y, h.y1); }
    if (y < y1) segs.push([y, y1]);
    for (const [s0, s1] of segs) {
      if (s1 - s0 < 1e-3) continue;
      if (axis === 'x') b.box(a1 - a0, s1 - s0, thick, opts, mid, (s0 + s1) / 2, at);
      else b.box(thick, s1 - s0, a1 - a0, opts, at, (s0 + s1) / 2, mid);
    }
  }
}

/** window frame + glass pane in an opening */
export function windowIn(b, glass, { axis, at, a0, a1, y0, y1, frame = 0.06, depth = 0.12, opts, mullions = 1, transoms = 0, glassOff = 0 }) {
  const fo = opts || { c: [0.82, 0.84, 0.86], t: T.PLAIN, w: 0.5 };
  const W = a1 - a0, H = y1 - y0, cx = (a0 + a1) / 2, cy = (y0 + y1) / 2;
  const put = (w, h, a, y) => {
    if (axis === 'x') b.box(w, h, depth, fo, a, y, at);
    else b.box(depth, h, w, fo, at, y, a);
  };
  put(W, frame, cx, y0 + frame / 2);
  put(W, frame, cx, y1 - frame / 2);
  put(frame, H, a0 + frame / 2, cy);
  put(frame, H, a1 - frame / 2, cy);
  for (let i = 1; i < mullions + 1; i++) {
    const a = a0 + (W * i) / (mullions + 1);
    if (mullions > 0 && i <= mullions) put(frame * 0.8, H, a, cy);
  }
  for (let i = 1; i <= transoms; i++) put(W, frame * 0.8, cx, y0 + (H * i) / (transoms + 1));
  if (glass) {
    if (axis === 'x') glass.box(W - frame, H - frame, 0.01, {}, cx, cy, at + glassOff);
    else glass.box(0.01, H - frame, W - frame, {}, at + glassOff, cy, cx);
  }
}

/** gable roof. along: ridge direction ('x' or 'z'). */
export function gableRoof(b, { cx, cz, along = 'x', len, width, eaveY, rise, over = 0.4, thick = 0.12, opts, ridgeOpts, gableOpts, caus = false, tiles = false }) {
  const half = width / 2;
  const ang = Math.atan2(rise, half);
  const slopeW = (half + over) / Math.cos(ang);
  const L = len + over * 2;
  const o = { ...opts, caus, uvs: tiles ? [L, slopeW] : [L, slopeW] };
  for (const s of [-1, 1]) {
    const dc = s * (half + over) / 2;
    const yc = eaveY + rise - ((half + over) / 2) * Math.tan(ang);
    const nOff = thick / 2;
    // offset downward along slab normal
    const ny = Math.cos(ang), nh = Math.sin(ang) * s;
    if (along === 'x') {
      const g = new THREE.BoxGeometry(L, thick, slopeW);
      // fix uv on top face so uv.x spans length (meters) and uv.y spans slope
      b.add(g, o, M(cx, yc - ny * nOff, cz + dc - nh * nOff, s * ang, 0, 0));
    } else {
      const g = new THREE.BoxGeometry(slopeW, thick, L);
      b.add(g, { ...o, uvs: [slopeW, L] }, M(cx + dc - nh * nOff, yc - ny * nOff, cz, 0, 0, -s * ang));
    }
  }
  // ridge cap
  const ro = ridgeOpts || opts;
  if (along === 'x') b.cyl(0.13, 0.13, L, ro, cx, eaveY + rise + 0.02, cz, 0, 0, Math.PI / 2, 8);
  else b.cyl(0.13, 0.13, L, ro, cx, eaveY + rise + 0.02, cz, Math.PI / 2, 0, 0, 8);
  // gable triangles
  if (gableOpts) {
    const shape = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, rise)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
    g.translate(0, 0, -0.07);
    for (const s of [-1, 1]) {
      if (along === 'x') b.add(g, gableOpts, M(cx + s * (len / 2 - 0.07), eaveY, cz, 0, Math.PI / 2, 0));
      else b.add(g, gableOpts, M(cx, eaveY, cz + s * (len / 2 - 0.07), 0, 0, 0));
    }
  }
}

/** plastic fish box (open top if open=true) */
export function fishBox(b, x, y, z, ry = 0, { c = [0.95, 0.96, 0.95], open = false, w = 0.62, d = 0.42, h = 0.2, wet = 0.8 } = {}) {
  const o = { c, t: T.PLAIN, w: wet, l: 0.7 };
  b.push(M(x, y, z, 0, ry, 0));
  if (!open) {
    b.rbox(w, h, d, 0.03, o, 0, h / 2, 0);
    b.box(w * 0.86, 0.012, d * 0.8, { c: [c[0] * 0.86, c[1] * 0.88, c[2] * 0.9], l: 0.2 }, 0, h + 0.003, 0);
  } else {
    const t = 0.03;
    b.box(w, t, d, o, 0, t / 2, 0);
    b.box(w, h, t, o, 0, h / 2, d / 2 - t / 2);
    b.box(w, h, t, o, 0, h / 2, -d / 2 + t / 2);
    b.box(t, h, d, o, w / 2 - t / 2, h / 2, 0);
    b.box(t, h, d, o, -w / 2 + t / 2, h / 2, 0);
  }
  // rim lip
  b.box(w + 0.03, 0.025, d + 0.03, o, 0, h - 0.0125, 0);
  b.pop();
}

/** blue plastic crate with slots */
export function crate(b, x, y, z, ry = 0, { c = [0.2, 0.42, 0.78], w = 0.55, d = 0.38, h = 0.3 } = {}) {
  b.push(M(x, y, z, 0, ry, 0));
  b.rbox(w, h, d, 0.02, {
    c, t: T.PLAIN, w: 0.8, l: 0.7,
    cf: (v, n) => {
      const ly = (v.y - y);
      const slot = Math.abs(n.y) < 0.5 && ((Math.floor(ly * 18) % 2 === 1) && ly > 0.05 && ly < h - 0.05) ? 0.62 : 1;
      return [c[0] * slot, c[1] * slot, c[2] * slot];
    },
  }, 0, h / 2, 0);
  b.box(w + 0.02, 0.03, d + 0.02, { c: [c[0] * 1.05, c[1] * 1.05, c[2] * 1.05], w: 0.8, l: 0.5 }, 0, h - 0.015, 0);
  b.pop();
}

/** cast iron bollard (系船柱) */
export function bollard(b, x, z, y = 0, s = 1) {
  const o = { c: [0.15, 0.16, 0.17], t: T.PLAIN, w: 0.15, l: 1 };
  b.cyl(0.24 * s, 0.28 * s, 0.08 * s, o, x, y + 0.04 * s, z, 0, 0, 0, 16);
  b.lathe([[0.0, 0], [0.2, 0], [0.17, 0.12], [0.15, 0.38], [0.17, 0.48], [0.27, 0.55], [0.28, 0.6], [0.24, 0.66], [0, 0.68]].map((p) => [p[0] * s, p[1] * s]), o, x, y + 0.06 * s, z, 18);
}
