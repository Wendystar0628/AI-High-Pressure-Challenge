'use strict';
// ---------------------------------------------------------------------------
// Voxel material palette (shared by every object in the film), grid modelling
// helpers and a greedy mesher with per-corner ambient occlusion.
// Every object uses the same 1-unit voxel; size comes only from voxel counts.
// ---------------------------------------------------------------------------

// emission modes (interpreted by the voxel fragment shader)
const EM = { STATIC: 0, ENGINE: 1, CHARGE: 2, FLASH: 3, CHASE_Z: 4, SCREEN: 5, CRACK: 6, PULSE: 7, CHASE_Y: 8, CHASE_X: 9, WINDOW: 10, HOLO: 11 };

const MATDEF = [
  // name, albedo hex, rough, metal, emit hex, emit strength, mode, transparent alpha
  ['EMPTY', '#000000', 1, 0, '#000000', 0, 0, 0],
  ['HULL', '#b9b1a1', 0.55, 0.15, '#000000', 0, 0, 0],       // broad main shell (warm ivory ceramic)
  ['HULL2', '#968e80', 0.6, 0.15, '#000000', 0, 0, 0],       // panel variant
  ['HULL3', '#d2cbbb', 0.5, 0.15, '#000000', 0, 0, 0],       // lighter lip plates
  ['DEEP', '#283240', 0.75, 0.1, '#000000', 0, 0, 0],        // second tone: deep slate structure
  ['DEEP2', '#161b23', 0.85, 0.05, '#000000', 0, 0, 0],      // darkest recesses
  ['TRIM', '#9d978a', 0.18, 0.9, '#000000', 0, 0, 0],        // metal edge strips
  ['ACCENT', '#9b4a2c', 0.5, 0.2, '#000000', 0, 0, 0],       // oxide red markings
  ['GLASS', '#7fdcff', 0.1, 0.3, '#3fb6e0', 0.35, 0, 0.32],  // transparent crystal blocks
  ['GUN', '#4b525c', 0.35, 0.6, '#000000', 0, 0, 0],         // weapon bodies
  ['GLOW', '#9ff6ff', 0.4, 0, '#62f2ff', 5.0, 0, 0],         // static seam light
  ['GLOW_DIM', '#5ab7cc', 0.4, 0, '#2fb4d6', 1.4, 0, 0],
  ['ENGINE', '#bff8ff', 0.4, 0, '#78e6ff', 4.5, EM.ENGINE, 0],
  ['CHARGE', '#3a4c58', 0.4, 0, '#7ff0ff', 14.0, EM.CHARGE, 0],
  ['MUZZLE', '#2a3a44', 0.4, 0, '#8ff4ff', 10.0, EM.FLASH, 0],
  ['WINDOW', '#3a3328', 0.6, 0, '#ffbe7a', 3.2, EM.WINDOW, 0], // tiny warm port lights (scale cue)
  ['CHASE', '#2a3a44', 0.5, 0, '#5ff0ff', 6.0, EM.CHASE_Z, 0], // guide lights
  ['CORE', '#e8fdff', 0.3, 0, '#8ff6ff', 12.0, EM.PULSE, 0],
  ['SCREEN', '#10202a', 0.3, 0, '#4fe3ff', 3.0, EM.SCREEN, 0],
  ['SCREEN2', '#1a1a14', 0.3, 0, '#ffb35c', 2.4, EM.SCREEN, 0],
  ['ROCK', '#6e665d', 0.85, 0, '#000000', 0, 0, 0],
  ['ROCK_D', '#423b35', 0.9, 0, '#000000', 0, 0, 0],
  ['ROCK_L', '#958a7d', 0.8, 0, '#000000', 0, 0, 0],
  ['ROCK_CRACK', '#544b44', 0.9, 0, '#ff5a1a', 4.0, EM.CRACK, 0],
  ['ROCK_V', '#5d6a70', 0.6, 0.3, '#000000', 0, 0, 0],
  ['FLOOR', '#3b424c', 0.6, 0.3, '#000000', 0, 0, 0],
  ['WALL', '#7d776b', 0.6, 0.15, '#000000', 0, 0, 0],
  ['HOLO', '#8ff2ff', 0.2, 0, '#4fdcff', 0.7, EM.HOLO, 0.2],
  ['FLOW_Y', '#2a3a44', 0.5, 0, '#6ff2ff', 7.0, EM.CHASE_Y, 0],
  ['FLOW_X', '#2a3a44', 0.5, 0, '#6ff2ff', 7.0, EM.CHASE_X, 0],
  ['CORE_SHELL', '#3a4350', 0.35, 0.7, '#000000', 0, 0, 0],
  ['ENERGY', '#e8ffff', 0.3, 0, '#8af6ff', 5.0, 0, 0],
  ['MISSILE', '#d8d0c0', 0.45, 0.3, '#000000', 0, 0, 0],
  ['WARN', '#c8562e', 0.5, 0.2, '#ff8a4a', 1.0, 0, 0],
  ['CIWS_GLOW', '#3a2a20', 0.4, 0, '#ffb060', 8.0, EM.FLASH, 0],
  ['CORE_GLASS', '#a6f4ff', 0.1, 0.2, '#5fe8ff', 2.2, EM.PULSE, 0.4],
  ['LAMP', '#f4f0e6', 0.4, 0, '#fff0d8', 4.0, 0, 0],
  ['LAMP_DIM', '#d8d4ca', 0.4, 0, '#ffe6c8', 1.6, 0, 0],
];
const MAT = {};
MATDEF.forEach((m, i) => { MAT[m[0]] = i; });
const NMAT = MATDEF.length;
const MAT_TRANS = new Uint8Array(256);
const MAT_OPQ = new Uint8Array(256);
MATDEF.forEach((m, i) => { MAT_TRANS[i] = m[7] > 0 ? 1 : 0; MAT_OPQ[i] = i > 0 && !(m[7] > 0) ? 1 : 0; });

// material uniform arrays (vec4 albedo+rough, vec4 emit+mode, vec4 metal,alpha,..)
function materialUniforms() {
  const A = new Float32Array(64 * 4), E = new Float32Array(64 * 4), P = new Float32Array(64 * 4);
  MATDEF.forEach((m, i) => {
    const a = U.lin(m[1]), e = U.lin(m[4]);
    A.set([a[0], a[1], a[2], m[2]], i * 4);
    E.set([e[0] * m[5], e[1] * m[5], e[2] * m[5], m[6]], i * 4);
    P.set([m[3], m[7], 0, 0], i * 4);
  });
  return { A, E, P };
}

// ---------------------------------------------------------------------------
class Grid {
  constructor(nx, ny, nz) {
    this.nx = nx; this.ny = ny; this.nz = nz;
    this.d = new Uint8Array(nx * ny * nz);
  }
  idx(x, y, z) { return x + this.nx * (y + this.ny * z); }
  in(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.nx && y < this.ny && z < this.nz; }
  get(x, y, z) { return this.in(x, y, z) ? this.d[x + this.nx * (y + this.ny * z)] : 0; }
  set(x, y, z, m) { if (this.in(x, y, z)) this.d[x + this.nx * (y + this.ny * z)] = m; }
  // inclusive box fill
  box(x0, y0, z0, x1, y1, z1, m) {
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0)); z0 = Math.max(0, Math.round(z0));
    x1 = Math.min(this.nx - 1, Math.round(x1)); y1 = Math.min(this.ny - 1, Math.round(y1)); z1 = Math.min(this.nz - 1, Math.round(z1));
    if (x1 < x0 || y1 < y0 || z1 < z0) return;
    const d = this.d, nx = this.nx, nxy = nx * this.ny;
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) { const b = z * nxy + y * nx; d.fill(m, b + x0, b + x1 + 1); }
  }
  // paint only existing solid voxels (or only those matching `only`)
  paint(x0, y0, z0, x1, y1, z1, m, only) {
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0)); z0 = Math.max(0, Math.round(z0));
    x1 = Math.min(this.nx - 1, Math.round(x1)); y1 = Math.min(this.ny - 1, Math.round(y1)); z1 = Math.min(this.nz - 1, Math.round(z1));
    const d = this.d, nx = this.nx, nxy = nx * this.ny;
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = z * nxy + y * nx + x; const c = d[i];
      if (c && (only === undefined || c === only)) d[i] = m;
    }
  }
  // fill only empty cells
  boxE(x0, y0, z0, x1, y1, z1, m) {
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0)); z0 = Math.max(0, Math.round(z0));
    x1 = Math.min(this.nx - 1, Math.round(x1)); y1 = Math.min(this.ny - 1, Math.round(y1)); z1 = Math.min(this.nz - 1, Math.round(z1));
    const d = this.d, nx = this.nx, nxy = nx * this.ny;
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = z * nxy + y * nx + x; if (!d[i]) d[i] = m; }
  }
  ellipsoid(cx, cy, cz, rx, ry, rz, m) {
    for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dz = (z - cz) / rz, dy = (y - cy) / ry; const r2 = 1 - dz * dz - dy * dy; if (r2 < 0) continue;
      const hw = rx * Math.sqrt(r2); this.box(Math.round(cx - hw), y, z, Math.round(cx + hw), y, z, m);
    }
  }
  // cylinder along an axis ('x','y','z'); c1,c2 are the other two coords
  cyl(axis, c1, c2, r, a0, a1, m, r1) {
    const rr1 = r1 === undefined ? r : r1;
    for (let a = Math.round(a0); a <= Math.round(a1); a++) {
      const t = a1 === a0 ? 0 : (a - a0) / (a1 - a0); const rad = r + (rr1 - r) * t;
      for (let i = Math.floor(-rad); i <= Math.ceil(rad); i++) {
        const h = Math.sqrt(Math.max(0, rad * rad - i * i)); if (rad * rad - i * i < 0) continue;
        const j0 = Math.round(c2 - h), j1 = Math.round(c2 + h);
        if (axis === 'z') this.box(Math.round(c1 + i), j0, a, Math.round(c1 + i), j1, a, m);
        else if (axis === 'x') this.box(a, Math.round(c1 + i), j0, a, Math.round(c1 + i), j1, m);
        else this.box(Math.round(c1 + i), a, j0, Math.round(c1 + i), a, j1, m);
      }
    }
  }
  // octagonal (chamfered) prism slice fill along z; fn(z) -> {x0,x1,y0,y1,ch} or null
  loftZ(z0, z1, fn, m) {
    for (let z = Math.round(z0); z <= Math.round(z1); z++) {
      const s = fn(z); if (!s) continue;
      const ch = Math.max(0, Math.round(s.ch || 0)); const y0 = Math.round(s.y0), y1 = Math.round(s.y1);
      for (let y = y0; y <= y1; y++) {
        const e = Math.max(0, ch - Math.min(y - y0, y1 - y));
        this.box(Math.round(s.x0) + e, y, z, Math.round(s.x1) - e, y, z, s.m || m);
      }
    }
  }
  mirrorX() {
    const { nx, ny, nz, d } = this;
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) {
      const b = (z * ny + y) * nx;
      for (let x = 0; x < (nx >> 1); x++) d[b + x] = d[b + nx - 1 - x];
    }
  }
  count() { let c = 0; for (let i = 0; i < this.d.length; i++) if (this.d[i]) c++; return c; }
}

// ---------------------------------------------------------------------------
// Quad buffers
class QuadBuf {
  constructor(cap) { this.cap = cap || 1024; this.n = 0; this.pos = new Int16Array(this.cap * 16); this.attr = new Uint8Array(this.cap * 16); this.min = [1e9, 1e9, 1e9]; this.max = [-1e9, -1e9, -1e9]; }
  grow() {
    this.cap *= 2; const p = new Int16Array(this.cap * 16); p.set(this.pos); this.pos = p;
    const a = new Uint8Array(this.cap * 16); a.set(this.attr); this.attr = a;
  }
  // corners: array of 4 [x,y,z]; ao: 4 values (0..3); n: normal index; m: material
  push(c, ao, n, m) {
    if (this.n >= this.cap) this.grow();
    let o = this.n * 16;
    const flip = ao[0] + ao[2] < ao[1] + ao[3];
    for (let k = 0; k < 4; k++) {
      const kk = flip ? (k + 1) & 3 : k; const p = c[kk];
      this.pos[o] = p[0]; this.pos[o + 1] = p[1]; this.pos[o + 2] = p[2]; this.pos[o + 3] = 0;
      this.attr[o] = n; this.attr[o + 1] = m; this.attr[o + 2] = ao[kk]; this.attr[o + 3] = 0;
      o += 4;
      if (p[0] < this.min[0]) this.min[0] = p[0]; if (p[1] < this.min[1]) this.min[1] = p[1]; if (p[2] < this.min[2]) this.min[2] = p[2];
      if (p[0] > this.max[0]) this.max[0] = p[0]; if (p[1] > this.max[1]) this.max[1] = p[1]; if (p[2] > this.max[2]) this.max[2] = p[2];
    }
    this.n++;
  }
  trim() { return { pos: this.pos.subarray(0, this.n * 16), attr: this.attr.subarray(0, this.n * 16), n: this.n, min: this.min.slice(), max: this.max.slice() }; }
}

// growable int32 list
class IList {
  constructor(c) { this.a = new Int32Array(c || 4096); this.n = 0; }
  push(v) { if (this.n >= this.a.length) { const b = new Int32Array(this.a.length * 2); b.set(this.a); this.a = b; } this.a[this.n++] = v; }
}

// Greedy mesh.  opt: { parts: Uint8Array|null, nParts, secSize (split along z), crackMat }
// Pass 1 scans the grid once in memory order and records every visible face;
// pass 2 merges faces slice by slice (greedy) with identical material/AO/part keys.
// returns buckets[part][sec] = { opaque, trans }
function meshGrid(g, opt) {
  opt = opt || {};
  const { nx, ny, nz, d } = g;
  const parts = opt.parts || null, nParts = opt.nParts || 1;
  const secSize = opt.secSize || 1e9, nSec = Math.max(1, Math.ceil(nz / secSize));
  const CRACK = opt.crackMat || 0;
  const TR = MAT_TRANS, OPQ = MAT_OPQ;
  const dims = [nx, ny, nz], strides = [1, nx, nx * ny];
  const buckets = [];
  for (let p = 0; p < nParts; p++) { buckets.push([]); for (let s = 0; s < nSec; s++) buckets[p].push({ opaque: new QuadBuf(256), trans: new QuadBuf(16) }); }
  // face lists per axis: [plane*2+side, i, j, key]
  const F = [0, 1, 2].map(() => ({ g: new IList(), i: new IList(), j: new IList(), k: new IList() }));
  const occ = (dd, plane, i, j) => {
    const u = (dd + 1) % 3, v = (dd + 2) % 3;
    if (plane < 0 || plane >= dims[dd] || i < 0 || j < 0 || i >= dims[u] || j >= dims[v]) return 0;
    return OPQ[d[plane * strides[dd] + i * strides[u] + j * strides[v]]];
  };
  const aoKey = (dd, plane, i, j) => {
    if (plane < 0 || plane >= dims[dd]) return 255;
    const s00 = occ(dd, plane, i - 1, j - 1), s10 = occ(dd, plane, i, j - 1), s20 = occ(dd, plane, i + 1, j - 1);
    const s01 = occ(dd, plane, i - 1, j), s21 = occ(dd, plane, i + 1, j);
    const s02 = occ(dd, plane, i - 1, j + 1), s12 = occ(dd, plane, i, j + 1), s22 = occ(dd, plane, i + 1, j + 1);
    const f = (a, b, c) => (a && b ? 0 : 3 - a - b - c);
    return f(s01, s10, s00) | (f(s21, s10, s20) << 2) | (f(s21, s12, s22) << 4) | (f(s01, s12, s02) << 6);
  };
  // record faces between cell a (coord c along dd) and cell b (coord c+1)
  const handle = (dd, ia, ib, a, b, c, x, y, z) => {
    const i = dd === 0 ? y : dd === 1 ? z : x, j = dd === 0 ? z : dd === 1 ? x : y;
    let fa = 0, fb = 0, crack = false;
    const pa = parts && a ? parts[ia] : 0, pb = parts && b ? parts[ib] : 0;
    if (a && b) {
      const ta = TR[a], tb = TR[b];
      if (pa !== pb && !ta && !tb) { fa = 1; fb = 1; crack = !!CRACK; }
      else if (ta && tb) { if (a !== b) { fa = 1; fb = 1; } }
      else if (ta && !tb) fb = 1;
      else if (!ta && tb) fa = 1;
    } else if (a) fa = 1; else fb = 1;
    const L = F[dd], plane = c + 1;
    if (fa) {
      const k = TR[a] || crack ? 255 : aoKey(dd, c + 1, i, j);
      L.g.push(plane * 2); L.i.push(i); L.j.push(j); L.k.push((crack ? CRACK : a) | (k << 8) | (pa << 16));
    }
    if (fb) {
      const k = TR[b] || crack ? 255 : aoKey(dd, c, i, j);
      L.g.push(plane * 2 + 1); L.i.push(i); L.j.push(j); L.k.push((crack ? CRACK : b) | (k << 8) | (pb << 16));
    }
  };
  const nxy = nx * ny;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) {
    const base = z * nxy + y * nx;
    for (let x = 0; x < nx; x++) {
      const ia = base + x, a = d[ia];
      // +x
      let ib = ia + 1, b = x < nx - 1 ? d[ib] : 0;
      if (a !== b || (parts && a && parts[ia] !== parts[ib])) handle(0, ia, ib, a, b, x, x, y, z);
      ib = ia + nx; b = y < ny - 1 ? d[ib] : 0;
      if (a !== b || (parts && a && parts[ia] !== parts[ib])) handle(1, ia, ib, a, b, y, x, y, z);
      ib = ia + nxy; b = z < nz - 1 ? d[ib] : 0;
      if (a !== b || (parts && a && parts[ia] !== parts[ib])) handle(2, ia, ib, a, b, z, x, y, z);
      if (a) { // lower boundary faces
        if (x === 0) handle(0, -1, ia, 0, a, -1, x, y, z);
        if (y === 0) handle(1, -1, ia, 0, a, -1, x, y, z);
        if (z === 0) handle(2, -1, ia, 0, a, -1, x, y, z);
      }
    }
  }
  // pass 2: per axis, bucket faces by (plane, side) and greedy-merge
  const ao = [3, 3, 3, 3];
  for (let dd = 0; dd < 3; dd++) {
    const u = (dd + 1) % 3, v = (dd + 2) % 3, du = dims[u], dv = dims[v];
    const L = F[dd], N = L.g.n; if (!N) continue;
    const ng = (dims[dd] + 1) * 2;
    const cnt = new Int32Array(ng + 1);
    for (let f = 0; f < N; f++) cnt[L.g.a[f] + 1]++;
    for (let q = 0; q < ng; q++) cnt[q + 1] += cnt[q];
    const order = new Int32Array(N); const fillp = cnt.slice();
    for (let f = 0; f < N; f++) order[fillp[L.g.a[f]]++] = f;
    const mask = new Int32Array(du * dv);
    for (let grp = 0; grp < ng; grp++) {
      const s0 = cnt[grp], s1 = cnt[grp + 1]; if (s0 === s1) continue;
      const plane = grp >> 1, side = grp & 1, nIdx = dd * 2 + side;
      let i0 = 1e9, i1 = -1, j0 = 1e9, j1 = -1;
      for (let q = s0; q < s1; q++) {
        const f = order[q], i = L.i.a[f], j = L.j.a[f];
        mask[i + j * du] = L.k.a[f];
        if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
      }
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1;) {
          const n = i + j * du; const c = mask[n];
          if (!c) { i++; continue; }
          let w = 1; while (i + w <= i1 && mask[n + w] === c) w++;
          let h = 1;
          outer: for (; j + h <= j1; h++) { const r = n + h * du; for (let k = 0; k < w; k++) if (mask[r + k] !== c) break outer; }
          for (let hh = 0; hh < h; hh++) mask.fill(0, n + hh * du, n + hh * du + w);
          const mat = c & 255, aok = (c >> 8) & 255, part = (c >> 16) & 255;
          ao[0] = aok & 3; ao[1] = (aok >> 2) & 3; ao[2] = (aok >> 4) & 3; ao[3] = (aok >> 6) & 3;
          const P = (uu, vv) => { const p = [0, 0, 0]; p[dd] = plane; p[u] = uu; p[v] = vv; return p; };
          let corners, aos;
          if (side === 0) { corners = [P(i, j), P(i + w, j), P(i + w, j + h), P(i, j + h)]; aos = [ao[0], ao[1], ao[2], ao[3]]; }
          else { corners = [P(i, j), P(i, j + h), P(i + w, j + h), P(i + w, j)]; aos = [ao[0], ao[3], ao[2], ao[1]]; }
          const zc = dd === 2 ? plane : (u === 2 ? i + w * 0.5 : j + h * 0.5);
          const sec = Math.min(nSec - 1, Math.max(0, Math.floor(zc / secSize)));
          const pp = opt.classify ? opt.classify(corners[0][0] * 0.5 + corners[2][0] * 0.5, corners[0][1] * 0.5 + corners[2][1] * 0.5, corners[0][2] * 0.5 + corners[2][2] * 0.5) : part;
          const bk = buckets[Math.min(pp, nParts - 1)][sec];
          (TR[mat] ? bk.trans : bk.opaque).push(corners, aos, nIdx, mat);
          i += w;
        }
      }
    }
  }
  return buckets.map((row) => row.map((b) => ({ opaque: b.opaque.trim(), trans: b.trans.trim() })));
}
