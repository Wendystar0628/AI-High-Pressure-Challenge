'use strict';
// ---------------------------------------------------------------------------
// Fleet design language: "split prow + stepped shell plates".
// Every hull reaches forward in a forked prow, its body is wrapped by stacked
// plate bands that step back from each other, deep slate structure shows in the
// grooves between bands and a few cyan seams tie muzzles, engines and slots
// together.  Grid axes: x = width, y = up, z = forward (bow at high z).
// ---------------------------------------------------------------------------

// helpers for symmetric modelling on the right half (dx >= 0); mirrored at the end
function SymModel(nx, ny, nz) {
  const g = new Grid(nx, ny, nz); const CX = nx >> 1;
  const X = (dx) => CX + dx;
  return {
    g, CX, X,
    B: (dx0, y0, z0, dx1, y1, z1, m) => g.box(X(dx0), y0, z0, X(dx1), y1, z1, m),
    C: (dx0, y0, z0, dx1, y1, z1) => g.box(X(dx0), y0, z0, X(dx1), y1, z1, 0),
    P: (dx0, y0, z0, dx1, y1, z1, m, only) => g.paint(X(dx0), y0, z0, X(dx1), y1, z1, m, only),
    E: (dx0, y0, z0, dx1, y1, z1, m) => g.boxE(X(dx0), y0, z0, X(dx1), y1, z1, m),
    // loft with octagonal section centred at dx=c: fn(z) -> {c, hw, y0, y1, ch, m}
    L: (z0, z1, fn, m) => g.loftZ(z0, z1, (z) => { const s = fn(z); if (!s) return null; const c = s.c || 0; return { x0: X(Math.round(c - s.hw)), x1: X(Math.round(c + s.hw) - 1), y0: s.y0, y1: s.y1, ch: s.ch, m: s.m }; }, m),
    // nozzle cavity with stepped lips, axis -z, opening at z0 (rear face) going in to depth
    nozzle(dx, cy, r, z0, depth, lips) {
      const cx = dx === 0 ? CX - 0.5 : X(dx);
      const L = lips || 3;
      // housing
      g.cyl('z', cx, cy, r + L * 2 + 2, z0 + 2 * L, z0 + depth + 6, MAT.HULL2);
      for (let i = 0; i < L; i++) g.cyl('z', cx, cy, r + (L - i) * 2, z0 + i * 2, z0 + i * 2 + 1, i % 2 ? MAT.TRIM : MAT.HULL3);
      g.cyl('z', cx, cy, r + 1, z0, z0 + depth + 4, MAT.DEEP);
      g.cyl('z', cx, cy, r, z0 - 1, z0 + depth, 0);
      // inner rings (inner glowing layer)
      for (let k = 0; k < 3; k++) {
        const zz = z0 + Math.round(depth * (0.35 + k * 0.22));
        g.cyl('z', cx, cy, r, zz, zz + 1, MAT.DEEP2); g.cyl('z', cx, cy, r - 2 - k, zz, zz + 1, 0);
        g.cyl('z', cx, cy, r - 2 - k, zz, zz, MAT.ENGINE); g.cyl('z', cx, cy, r - 3 - k, zz, zz, 0);
      }
      g.cyl('z', cx, cy, r, z0 + depth, z0 + depth + 2, MAT.ENGINE);
      g.cyl('z', cx, cy, r * 0.45, z0 + depth - 3, z0 + depth, MAT.ENGINE);
    },
  };
}

// greeble scatter in a box region on a given face direction
function greebles(g, rnd, x0, y0, z0, x1, y1, z1, n, mats, maxS) {
  for (let i = 0; i < n; i++) {
    const x = Math.round(x0 + rnd() * (x1 - x0)), y = Math.round(y0 + rnd() * (y1 - y0)), z = Math.round(z0 + rnd() * (z1 - z0));
    const sx = 1 + Math.floor(rnd() * maxS), sy = 1 + Math.floor(rnd() * maxS * 0.6), sz = 1 + Math.floor(rnd() * maxS * 1.5);
    g.box(x, y, z, x + sx, y + sy, z + sz, mats[Math.floor(rnd() * mats.length)]);
  }
}


// procedural plating on hull surfaces of the right half (applied before mirroring):
// seams (grooves), inset panels, vent slits, window rows, raised plates, deck hatches, belly ribs
function hullDetail(g, CX, o) {
  const { nx, ny, nz, d } = g; const nxy = nx * ny;
  const isHull = (m) => m === MAT.HULL || m === MAT.HULL2 || m === MAT.HULL3;
  const H = U.hash3; const PZ = o.pz || 26, PY = o.py || 12, PX = o.px || 18, PZ2 = o.pz2 || 30;
  const dens = o.dens || (() => 1);
  const skip = o.skip || (() => false);
  const set = [];
  for (let z = 2; z < nz - 2; z++) {
    const dz = dens(z);
    for (let y = 2; y < ny - 2; y++) for (let x = CX; x < nx - 2; x++) {
      const i = x + nx * y + nxy * z; const m = d[i]; if (!isHull(m)) continue;
      if (!d[i + 1] && d[i - 1] && d[i - 2]) { // side face (+x)
        if (skip(x, y, z)) continue;
        const pz = Math.floor(z / PZ), off = (pz % 2) * (PY >> 1), py = Math.floor((y + off) / PY);
        const h = H(pz, py, 7);
        const sz = z % PZ === 0, sy = (y + off) % PY === 0;
        if (sz || sy) { if (h < 0.3 * dz + 0.12) { set.push(i, 0, i - 1, MAT.DEEP); } else if (h < 0.8) set.push(i, MAT.DEEP); continue; }
        const ly = (y + off) % PY, lz = z % PZ;
        if (h < 0.16 * dz) { set.push(i, 0, i - 1, h < 0.08 ? MAT.DEEP : MAT.HULL2); }
        else if (h < 0.24 * dz) { if (ly === (PY >> 1) && lz > 2 && lz < PZ - 2 && z % 2 === 0) set.push(i, MAT.WINDOW); }
        else if (h < 0.30 * dz) { if (z % 3 === 0 && ly > 2 && ly < PY - 2) set.push(i, 0, i - 1, MAT.DEEP2); }
        else if (h < 0.36 * dz) { if (lz > 1 && lz < PZ - 1 && ly > 1 && ly < PY - 1) set.push(i + 1, MAT.HULL3); }
        else if (h < 0.39 * dz) { if (lz > 3 && lz < PZ - 3 && ly === 2) set.push(i, MAT.ACCENT); }
        else if (h > 0.82) set.push(i, MAT.HULL2);
      } else if (!d[i + nx] && d[i - nx]) { // top face (+y)
        if (skip(x, y, z)) continue;
        const px = Math.floor((x - CX) / PX), pz = Math.floor((z + (px % 2) * (PZ2 >> 1)) / PZ2);
        const h = H(px, pz, 13);
        const sx = (x - CX) % PX === 0, szz = (z + (px % 2) * (PZ2 >> 1)) % PZ2 === 0;
        const lx = (x - CX) % PX, lz = (z + (px % 2) * (PZ2 >> 1)) % PZ2;
        if (sx || szz) { set.push(i, MAT.DEEP); continue; }
        if (h < 0.10 * dz) { if (lx > 2 && lx < PX - 2 && lz > 3 && lz < PZ2 - 3) { const rim = lx === 3 || lx === PX - 3 || lz === 4 || lz === PZ2 - 4; set.push(i + nx, rim ? MAT.TRIM : MAT.HULL2); } }
        else if (h < 0.17 * dz) { if (lx % 4 === 2 && lz > 4 && lz < PZ2 - 4) set.push(i, MAT.GLOW_DIM); }
        else if (h < 0.24 * dz) { if (lx > 1 && lx < PX - 1 && lz > 1 && lz < PZ2 - 1 && d[i - nx]) set.push(i, 0, i - nx, MAT.DEEP); }
        else if (h < 0.30 * dz) { if (lx > 4 && lx < 9 && lz > 5 && lz < 12) { set.push(i + nx, MAT.HULL3); if (lx > 5 && lx < 8 && lz > 6 && lz < 11) set.push(i + 2 * nx, MAT.GUN); } }
        else if (h > 0.84) set.push(i, MAT.HULL2);
      } else if (!d[i - nx] && d[i + nx]) { // bottom face
        if (skip(x, y, z)) continue;
        if (z % 14 < 2 && (x - CX) % 30 > 3) set.push(i - nx, MAT.HULL2);
        else if (z % 14 === 7 && (x - CX) % 9 === 0) set.push(i, MAT.GLOW_DIM);
      }
    }
  }
  for (let k = 0; k < set.length; k += 2) { const i = set[k]; if (i >= 0 && i < d.length) { if (set[k + 1] === 0 || !d[i] || isHull(d[i])) d[i] = set[k + 1]; } }
}

// ---------------------------------------------------------------------------
// FLAGSHIP  (1120 voxels bow to stern)
// ---------------------------------------------------------------------------
function buildFlagship() {
  const S = SymModel(340, 262, 1120); const { g, B, C, P, E, L, X, CX } = S;
  const rnd = U.rng(1234);
  const lerp = U.lerp, sm = U.smooth;
  // ---- main body: telescoping shell segments, each one stepping in toward the bow
  const SEG = [[70, 180], [180, 290], [290, 400], [400, 510], [510, 620], [620, 726]];
  const segHW = (k, z) => { const [a, b2] = SEG[k]; return lerp(114 - 8 * k, 107 - 8 * k, (z - a) / (b2 - a)); };
  const segY0 = (k, z) => { const [a, b2] = SEG[k]; return lerp(46 + 3 * k, 49 + 3 * k, (z - a) / (b2 - a)); };
  const segY1 = (k, z) => { const [a, b2] = SEG[k]; return lerp(176 - 2 * k, 172 - 2 * k, (z - a) / (b2 - a)); };
  const segOf = (z) => { for (let k = 0; k < SEG.length; k++) if (z < SEG[k][1]) return k; return SEG.length - 1; };
  const bodyHW = (z) => z < 70 ? 100 : z > 726 ? 60 : segHW(segOf(z), z);
  const bodyY0 = (z) => z < 70 ? 52 : z > 726 ? 64 : segY0(segOf(z), z);
  const bodyY1 = (z) => z < 70 ? 168 : z > 726 ? 160 : segY1(segOf(z), z);
  L(60, 740, (z) => ({ hw: bodyHW(Math.min(z, 726)) - 8, y0: bodyY0(Math.min(z, 726)) + 6, y1: bodyY1(Math.min(z, 726)) - 6, ch: 20 }), MAT.DEEP);
  SEG.forEach(([a, b2], k) => {
    // shell segment proper (front 9 voxels are a deep collar showing the step)
    L(a, b2 - 9, (z) => ({ hw: segHW(k, z), y0: segY0(k, z), y1: segY1(k, z), ch: 22 }), k % 2 ? MAT.HULL2 : MAT.HULL);
    L(b2 - 9, b2, (z) => ({ hw: segHW(k, z) - 5, y0: segY0(k, z) + 5, y1: segY1(k, z) - 4, ch: 20 }), MAT.DEEP);
    // rear lip (the widest rim of each segment): bright stepped plate + trim line
    L(a, a + 6, (z) => ({ hw: segHW(k, a) + 3, y0: segY0(k, a) - 2, y1: segY1(k, a) + 2, ch: 24 }), MAT.HULL3);
    L(a + 6, a + 8, (z) => ({ hw: segHW(k, a) + 2, y0: segY0(k, a) + 8, y1: segY1(k, a) - 6, ch: 23 }), MAT.TRIM);
    // upper flank scale: wedge plate that stands proud at its rear edge
    L(a + 8, b2 - 14, (z) => ({ hw: segHW(k, z) + 4 * (1 - (z - a - 8) / (b2 - a - 22)), y0: 140 - 2 * k, y1: segY1(k, z) - 6, ch: 6 }), MAT.HULL);
    // joint lights in the collar
    for (let y = 70; y < 160; y += 18) B(segHW(k, b2) - 6, y, b2 - 6, segHW(k, b2) - 4, y + 6, b2 - 4, MAT.GLOW_DIM);
  });
  // side trench (deep groove band) with crossing beams and flowing conduit
  for (let z = 90; z < 726; z++) {
    const hw = Math.round(bodyHW(z)); C(hw - 12, 100, z, hw + 6, 113, z); B(hw - 13, 100, z, hw - 12, 113, z, MAT.DEEP);
    if (z % 30 < 5) B(hw - 12, 102, z, hw - 1, 111, z, MAT.HULL3);
    if (z % 30 === 2) B(hw - 12, 104, z, hw, 109, z, MAT.TRIM);
    B(hw - 12, 100, z, hw - 9, 101, z, MAT.CHASE);
  }
  // upper side windows (tiny warm port lights = scale cue)
  for (let z = 190; z < 700; z += 4) { if ((z % 110) < 80) { const hw = Math.round(bodyHW(z)); B(hw + 1, 156, z, hw + 1, 156, z + 1, MAT.WINDOW); B(hw + 1, 150, z + 2, hw + 1, 150, z + 2, MAT.WINDOW); } }
  // ---- ventral keel blade (deepest amidships), ribs and blisters
  const keelY0 = (z) => 48 - 34 * sm(250, 430, z) * (1 - sm(560, 720, z));
  L(240, 730, (z) => ({ hw: lerp(38, 18, sm(240, 730, z)), y0: keelY0(z) + 6, y1: 52, ch: 8 }), MAT.DEEP);
  L(240, 730, (z) => ({ hw: lerp(30, 14, sm(240, 730, z)), y0: keelY0(z), y1: 52, ch: 6 }), MAT.HULL2);
  for (let z = 256; z < 720; z += 20) { const hw = Math.round(lerp(38, 18, sm(240, 730, z))); B(hw - 2, Math.round(keelY0(z)) + 4, z, hw + 1, 50, z + 3, MAT.HULL); }
  for (let z = 270; z < 700; z += 60) B(0, Math.round(keelY0(z)) - 1, z, 6, Math.round(keelY0(z)), z + 30, MAT.GLOW_DIM);
  L(300, 620, (z) => ({ c: 70, hw: 22, y0: lerp(40, 32, sm(300, 380, z) - sm(560, 620, z)), y1: 52, ch: 6 }), MAT.HULL);
  for (let z = 200; z < 716; z += 22) B(48, 42, z, Math.round(bodyHW(z)) - 6, 56, z + 4, MAT.HULL3);
  for (let z = 211; z < 716; z += 22) B(50, 47, z, Math.round(bodyHW(z)) - 8, 50, z + 9, MAT.DEEP);
  // ---- dorsal tiers rising toward the crown (stepped wedge)
  const t2Y1 = (z) => lerp(198, 214, sm(220, 640, z));
  const spY1 = (z) => lerp(212, 242, sm(270, 640, z));
  L(150, 740, (z) => ({ hw: lerp(60, 76, sm(150, 260, z)) - 22 * sm(640, 740, z), y0: 166, y1: lerp(182, 190, sm(150, 640, z)), ch: 6 }), MAT.HULL);
  for (let z = 236; z < 730; z += 96) C(0, 180, z, 90, 190, z + 4);
  L(220, 730, (z) => ({ hw: 54 - 12 * sm(640, 730, z), y0: 184, y1: t2Y1(z) - 4, ch: 5 }), MAT.DEEP);
  for (let k = 0; k < 6; k++) { const z0 = 226 + k * 84; L(z0, z0 + 76, (z) => ({ hw: 56 - 12 * sm(640, 730, z), y0: t2Y1(z) - 5, y1: t2Y1(z), ch: 4 }), k % 2 ? MAT.HULL2 : MAT.HULL); }
  L(270, 650, (z) => ({ hw: 22, y0: 200, y1: spY1(z) - 3, ch: 4 }), MAT.DEEP);
  L(270, 650, (z) => ({ hw: 24, y0: spY1(z) - 4, y1: spY1(z), ch: 3 }), MAT.HULL);
  // spine fins with through-gaps (rising)
  for (let z = 280; z < 640; z += 40) {
    const top = Math.round(spY1(z) + 14 - ((z / 40) % 2) * 5);
    B(0, Math.round(spY1(z)), z, 12, top, z + 14, MAT.HULL3);
    B(13, Math.round(spY1(z)) - 14, z + 2, 30, Math.round(spY1(z)) - 4, z + 12, MAT.HULL2);
    C(0, Math.round(spY1(z)) + 3, z + 4, 12, top - 4, z + 8);
    B(0, top, z, 3, top + 1, z + 14, MAT.TRIM);
  }
  B(0, 208, 270, 2, 210, 650, MAT.GLOW);
  // ---- bridge crown (interior is a full command hall, see buildBridgeInto)
  L(640, 796, (z) => ({ hw: 76 - 6 * sm(780, 796, z), y0: 184, y1: 258 - 6 * sm(770, 796, z), ch: 14 }), MAT.HULL);
  L(630, 650, (z) => ({ hw: 82, y0: 190, y1: 236, ch: 10 }), MAT.HULL2);
  B(70, 200, 660, 80, 246, 780, MAT.HULL3);
  for (let z = 664; z < 780; z += 12) B(78, 206, z, 82, 240, z + 6, MAT.HULL2);
  B(0, 258, 680, 30, 261, 760, MAT.HULL2);
  B(30, 252, 690, 50, 258, 750, MAT.HULL3);
  // mast & sensor blocks
  B(0, 258, 700, 2, 261, 720, MAT.TRIM);
  // stepped visor over the observation opening and swept crown fins (forked crest)
  for (let k = 0; k < 3; k++) L(782 + k * 4, 790 + k * 4, (z) => ({ hw: 66 - k * 8, y0: 246 - k * 2, y1: 252 - k * 3, ch: 6 }), k % 2 ? MAT.HULL3 : MAT.HULL);
  for (let k = 0; k < 4; k++) { const z0 = 650 + k * 34; B(70, 216, z0, 84 - k * 2, 252 - k * 6, z0 + 22, k % 2 ? MAT.HULL2 : MAT.HULL3); B(84 - k * 2, 228, z0 + 4, 85 - k * 2, 240 - k * 6, z0 + 18, MAT.DEEP); }
  for (let k = 0; k < 2; k++) { B(18 + k * 22, 258, 660 + k * 10, 24 + k * 22, 268 - k * 3, 700 + k * 10, MAT.HULL2); B(18 + k * 22, 268 - k * 3, 664 + k * 10, 24 + k * 22, 268 - k * 3, 696 + k * 10, MAT.TRIM); }
  // ---- side sponsons (hangar wings)
  const spZ0 = 240, spZ1 = 744;
  const spHW = (z) => lerp(150, 168, sm(spZ0, spZ0 + 40, z)) - 70 * sm(692, spZ1, z);
  L(spZ0, spZ1, (z) => ({ c: 0, hw: spHW(z), y0: 74 + 14 * sm(692, spZ1, z), y1: 146 - 12 * sm(692, spZ1, z), ch: 12 }), MAT.HULL);
  // stepped outer plates on sponson
  for (let z = spZ0 + 30; z < 690; z += 64) {
    L(z, z + 56, (zz) => ({ c: 0, hw: spHW(zz) + 3, y0: 84, y1: 136, ch: 10 }), MAT.HULL2);
    B(spHW(z + 28) + 3, 108, z, spHW(z + 28) + 4, 112, z + 56, MAT.DEEP);
  }
  // sponson under-skirt: recessed deep band with ribs (second tone dividing the masses)
  for (let z = spZ0 + 8; z < 760; z++) {
    const hw = Math.round(spHW(z)); if (z > 690) break;
    C(hw - 6, 74, z, hw + 4, 89, z); B(hw - 7, 74, z, hw - 6, 89, z, MAT.DEEP);
    if (z % 16 < 3) B(hw - 6, 74, z, hw - 2, 89, z, MAT.HULL2);
    if (z % 16 === 9) B(hw - 6, 86, z, hw - 5, 86, z, MAT.GLOW_DIM);
  }
  // sponson top deck with turret pedestals
  L(spZ0 + 20, 696, (z) => ({ c: 128, hw: 32, y0: 146, y1: 150, ch: 2 }), MAT.HULL3);
  B(100, 146, spZ0 + 20, 104, 149, 696, MAT.DEEP);
  const turretMounts = [];
  for (let i = 0; i < 8; i++) {
    const z = 292 + i * 56;
    g.cyl('y', X(130), z, 12, 150, 153, MAT.HULL2); g.cyl('y', X(130), z, 9, 154, 155, MAT.TRIM);
    g.cyl('y', X(130), z, 7, 150, 156, MAT.DEEP);
    greebles(g, rnd, X(112), 150, z - 14, X(148), 152, z + 14, 6, [MAT.HULL2, MAT.DEEP, MAT.TRIM], 3);
    turretMounts.push({ g: [X(130), 156, z], side: 1 }); turretMounts.push({ g: [339 - X(130), 156, z], side: -1 });
  }
  // dorsal turrets on tier 1
  for (const z of [200, 742]) {
    g.cyl('y', X(44), z, 11, 186, 190, MAT.HULL2); g.cyl('y', X(44), z, 7, 186, 191, MAT.DEEP);
    turretMounts.push({ g: [X(44), 191, z], side: 1 }); turretMounts.push({ g: [339 - X(44), 191, z], side: -1 });
  }
  // sponson rear: stepped tail with side engine
  L(spZ0 - 30, spZ0, (z) => ({ c: 132, hw: 26 - 8 * sm(spZ0 - 10, spZ0 - 30, z), y0: 84, y1: 136, ch: 10 }), MAT.HULL2);
  S.nozzle(132, 110, 13, spZ0 - 30, 26, 2);
  // sponson root truss (through gaps between body and wing)
  for (let z = spZ0 + 6; z < spZ0 + 60; z += 14) { C(104, 86, z, 118, 134, z + 8); }
  // ---- HANGAR inside the sponson (both sides, camera uses the port one)
  const hg = { dx0: 70, dx1: 156, y0: 80, y1: 140, z0: 304, z1: 690, mouthZ0: 592, mouthZ1: 686 };
  buildHangarInto(S, hg, rnd);
  // ---- bow prongs (the split prow)
  const prC = (z) => lerp(56, 72, sm(660, 1000, z)) - 14 * sm(1030, 1119, z);
  const prHW = (z) => lerp(44, 17, sm(660, 1080, z)) - 9 * sm(1080, 1119, z);
  const prY0 = (z) => lerp(54, 94, sm(700, 1119, z));
  const prY1 = (z) => lerp(188, 146, sm(700, 1119, z));
  L(640, 1119, (z) => ({ c: prC(z), hw: prHW(z), y0: prY0(z), y1: prY1(z), ch: 10 }), MAT.HULL);
  // terraced top steps
  for (let k = 0; k < 6; k++) {
    const z0 = 736 + k * 62;
    L(z0, z0 + 40, (z) => ({ c: prC(z) + 3, hw: prHW(z) - 6, y0: prY1(z), y1: prY1(z) + 6 - k * 0.5, ch: 4 }), k % 2 ? MAT.HULL3 : MAT.HULL2);
    L(z0 + 4, z0 + 36, (z) => ({ c: prC(z) + 3, hw: prHW(z) - 12, y0: prY1(z) + 6, y1: prY1(z) + 9, ch: 3 }), MAT.HULL);
  }
  // outer layered plates on prongs
  for (let k = 0; k < 8; k++) {
    const z0 = 730 + k * 48;
    L(z0, z0 + 42, (z) => ({ c: prC(z) + prHW(z) - 2, hw: 5, y0: prY0(z) + 10, y1: prY1(z) - 12, ch: 3 }), k % 2 ? MAT.HULL2 : MAT.HULL);
    B(prC(z0 + 20) + prHW(z0 + 20) + 1, prY0(z0) + 28, z0, prC(z0 + 20) + prHW(z0 + 20) + 4, prY0(z0) + 30, z0 + 42, MAT.DEEP);
  }
  // inner faces: deep slots with seam lights facing the cannon
  for (let z = 740; z < 1090; z += 26) {
    const ix = Math.round(prC(z) - prHW(z));
    B(ix - 1, 104, z, ix + 3, 134, z + 18, MAT.DEEP2);
    B(ix - 1, 106, z + 2, ix, 132, z + 16, MAT.GLOW_DIM);
    B(ix - 3, 100, z + 18, ix + 1, 138, z + 22, MAT.HULL3);
  }
  // prong tips fork again (small notch)
  C(40, 116, 1086, 100, 124, 1119);
  B(prC(1100) - 6, 112, 1086, prC(1100) + 6, 115, 1088, MAT.GLOW);
  // accent marks near the tips
  for (let z = 1030; z < 1080; z += 8) P(80, prY1(z) - 4, z, 90, prY1(z) + 12, z + 3, MAT.ACCENT);
  // prong undersides: ribs
  for (let z = 790; z < 1080; z += 18) B(prC(z) - prHW(z) + 6, prY0(z) - 3, z, prC(z) + prHW(z) - 6, prY0(z), z + 4, MAT.HULL2);
  // ---- main beam cannon (biggest weapon) grows from the body into the split
  L(700, 830, (z) => ({ hw: lerp(48, 26, sm(720, 830, z)), y0: lerp(70, 92, sm(720, 830, z)), y1: lerp(166, 146, sm(720, 830, z)), ch: 14 }), MAT.GUN);
  for (let k = 0; k < 5; k++) L(730 + k * 20, 736 + k * 20, (z) => ({ hw: lerp(52, 30, sm(720, 830, z)), y0: lerp(66, 89, sm(720, 830, z)), y1: lerp(170, 150, sm(720, 830, z)), ch: 15 }), MAT.HULL3);
  for (let k = 0; k < 5; k++) B(0, Math.round(lerp(166, 148, sm(720, 830, 738 + k * 20))) + 2, 738 + k * 20, 18, Math.round(lerp(166, 148, sm(720, 830, 738 + k * 20))) + 3, 746 + k * 20, MAT.CHARGE);
  L(810, 1080, (z) => ({ hw: lerp(22, 16, sm(810, 1080, z)), y0: lerp(96, 102, sm(810, 1080, z)), y1: lerp(140, 134, sm(810, 1080, z)), ch: 7 }), MAT.GUN);
  // collars
  for (let z = 836; z < 1070; z += 42) L(z, z + 7, (zz) => ({ hw: lerp(28, 22, sm(810, 1080, zz)), y0: lerp(90, 96, sm(810, 1080, zz)), y1: lerp(146, 140, sm(810, 1080, zz)), ch: 8 }), MAT.HULL);
  // charge slots on sides and top
  for (let z = 814; z < 1076; z += 10) {
    const hw = Math.round(lerp(22, 16, sm(810, 1080, z)));
    B(hw - 1, 110, z, hw, 126, z + 6, MAT.CHARGE);
    B(0, Math.round(lerp(140, 134, sm(860, 1080, z))), z, 4, Math.round(lerp(140, 134, sm(860, 1080, z))), z + 6, MAT.CHARGE);
  }
  // muzzle: four-pronged emitter around a deep glowing bore
  L(1074, 1100, (z) => ({ hw: 20, y0: 94, y1: 142, ch: 9 }), MAT.GUN);
  C(-30, 110, 1086, 30, 126, 1101); C(4, 90, 1086, 30, 146, 1101);
  g.cyl('z', CX - 0.5, 118, 9, 1060, 1101, 0);
  g.cyl('z', CX - 0.5, 118, 11, 1058, 1062, MAT.MUZZLE);
  g.cyl('z', CX - 0.5, 118, 5, 1062, 1072, MAT.CORE);
  for (let z = 1066; z < 1098; z += 8) { g.cyl('z', CX - 0.5, 118, 10, z, z, MAT.CHARGE); g.cyl('z', CX - 0.5, 118, 9, z, z, 0); }
  // supports between barrel and prongs
  for (const z of [870, 950, 1030]) { B(16, 112, z, Math.round(prC(z) - prHW(z)) + 2, 122, z + 8, MAT.HULL2); B(16, 116, z + 2, Math.round(prC(z) - prHW(z)), 117, z + 6, MAT.GLOW_DIM); }
  // ---- stern engine block
  L(20, 76, (z) => ({ hw: lerp(84, 96, sm(20, 76, z)), y0: lerp(62, 58, sm(20, 76, z)), y1: lerp(164, 168, sm(20, 76, z)), ch: 24 }), MAT.HULL2);
  L(8, 22, (z) => ({ hw: 78, y0: 70, y1: 156, ch: 22 }), MAT.DEEP);
  for (let z = 30; z < 76; z += 12) L(z, z + 6, (zz) => ({ hw: 100, y0: 66, y1: 162, ch: 26 }), MAT.HULL);
  S.nozzle(0, 112, 26, 0, 48, 3);
  S.nozzle(52, 148, 15, 4, 34, 2);
  S.nozzle(52, 78, 15, 4, 34, 2);
  S.nozzle(88, 112, 13, 10, 30, 2);
  // stern fins
  for (const y of [40, 186]) L(20, 120, (z) => ({ c: 70, hw: 6, y0: y === 40 ? lerp(40, 58, sm(20, 120, z)) : 168, y1: y === 40 ? 64 : lerp(186, 172, sm(20, 120, z)), ch: 2 }), MAT.HULL3);
  // ---- detail scatter around transitions
  greebles(g, rnd, X(60), 186, 210, X(90), 190, 800, 60, [MAT.HULL2, MAT.DEEP, MAT.TRIM, MAT.HULL3], 4);
  greebles(g, rnd, X(30), 202, 230, X(52), 205, 640, 50, [MAT.HULL2, MAT.DEEP, MAT.HULL3], 3);
  greebles(g, rnd, X(70), 160, 40, X(100), 168, 170, 40, [MAT.HULL2, MAT.DEEP, MAT.TRIM], 4);
  greebles(g, rnd, X(34), 140, 820, X(56), 170, 900, 30, [MAT.HULL2, MAT.DEEP, MAT.GUN], 4);
  // markings on sponson fronts
  P(150, 120, 700, 170, 126, 760, MAT.ACCENT);
  // plating pass (denser near the stern, the bow root, crown and hangar mouth; quieter mid-flank)
  const bmp = U.bump;
  hullDetail(g, CX, {
    pz: 34, py: 16, px: 22, pz2: 36,
    dens: (z) => 0.3 + 0.75 * Math.max(bmp(z, 20, 60, 170, 250), bmp(z, 560, 600, 700, 760), bmp(z, 730, 780, 880, 960), 0.35 * bmp(z, 250, 300, 520, 560)),
    skip: (x, y, z) => (x - CX >= hg.dx0 - 6 && x - CX <= hg.dx1 + 14 && y >= hg.y0 - 8 && y <= hg.y1 + 10 && z >= hg.z0 - 8 && z <= hg.z1 + 8 && x - CX < 160) || (y > 186 && z > 640 && z < 800 && x - CX < 70),
  });
  S.g.mirrorX();
  // asymmetric hull numbers (a few accent blocks on port flank only)
  for (let i = 0; i < 5; i++) g.paint(CX - 168, 92, 470 + i * 7, CX - 160, 100, 473 + i * 7, i % 2 ? MAT.ACCENT : MAT.HULL3);
  // bridge interior (needs mirrored shell first)
  const br = buildBridgeInto(g, CX);
  const origin = [CX, 118, 560];
  const L2 = (p) => [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
  const nozzles = [
    { p: [CX - 0.5, 112, 0], r: 26 }, { p: [X(52), 148, 4], r: 15 }, { p: [339 - X(52), 148, 4], r: 15 },
    { p: [X(52), 78, 4], r: 15 }, { p: [339 - X(52), 78, 4], r: 15 }, { p: [X(88), 112, 10], r: 13 }, { p: [339 - X(88), 112, 10], r: 13 },
    { p: [X(132), 110, spZ0 - 30], r: 13 }, { p: [339 - X(132), 110, spZ0 - 30], r: 13 },
  ].map((n) => ({ p: L2(n.p), r: n.r }));
  return {
    grid: g, origin,
    meta: {
      nozzles, turretMounts: turretMounts.map((t) => ({ p: L2(t.g), side: t.side })),
      muzzle: L2([CX - 0.5, 118, 1100]), chargeAxis: [736, 1076, 28, 0],
      hangar: { x0: hg.dx0, x1: hg.dx1, y0: hg.y0 - origin[1], y1: hg.y1 - origin[1], z0: hg.z0 - origin[2], z1: hg.z1 - origin[2], mz0: hg.mouthZ0 - origin[2], mz1: hg.mouthZ1 - origin[2], outer: 168, berths: hg.berths.map(L2) },
      bridge: { min: L2(br.min), max: L2(br.max), hub: L2(br.hub), window: L2(br.window), consoles: br.consoles.map(L2) },
      shield: { c: [0, 10, 10], r: [215, 175, 640] },
      length: 1120,
    },
    classify: (x, y, z) => {
      if (x >= br.min[0] && x <= br.max[0] && y >= br.min[1] && y <= br.max[1] && z >= br.min[2] && z <= br.max[2]) return 1;
      const ax = Math.abs(x - CX + 0.5);
      if (ax >= hg.dx0 + 2 && ax <= hg.dx1 - 1 && y > hg.y0 && y < hg.y1 && z > hg.z0 && z < hg.z1) return 2;
      return 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Hangar: long bay inside each sponson; side mouth at forward end, berths both
// sides, overhead bridges, maintenance frames, inner hatch, lit far end.
// ---------------------------------------------------------------------------
function buildHangarInto(S, h, rnd) {
  const { g, B, C, X } = S;
  const outer = 168;
  // carve volume
  C(h.dx0, h.y0, h.z0, h.dx1, h.y1, h.z1);
  // shell lining
  B(h.dx0 - 4, h.y0 - 6, h.z0 - 6, h.dx0 - 1, h.y1 + 6, h.z1 + 6, MAT.WALL);
  B(h.dx1 + 1, h.y0 - 6, h.z0 - 6, h.dx1 + 4, h.y1 + 6, h.z1 + 6, MAT.WALL);
  B(h.dx0, h.y0 - 6, h.z0 - 6, h.dx1, h.y0 - 1, h.z1 + 6, MAT.FLOOR);
  B(h.dx0, h.y1 + 1, h.z0 - 6, h.dx1, h.y1 + 8, h.z1 + 6, MAT.DEEP);
  B(h.dx0, h.y0, h.z0 - 6, h.dx1, h.y1, h.z0 - 1, MAT.WALL);
  B(h.dx0, h.y0, h.z1 + 1, h.dx1, h.y1, h.z1 + 6, MAT.WALL);
  const cxm = Math.round((h.dx0 + h.dx1) / 2);
  // far end: lit back wall with a bright aperture
  B(cxm - 26, h.y0 + 6, h.z0 - 2, cxm + 26, h.y1 - 8, h.z0 - 1, MAT.DEEP);
  B(cxm - 20, h.y0 + 10, h.z0 - 2, cxm + 20, h.y1 - 14, h.z0 - 2, MAT.LAMP);
  for (let k = 0; k < 4; k++) B(cxm - 24 + k * 2, h.y0 + 6 + k * 2, h.z0 + k * 2, cxm + 24 - k * 2, h.y0 + 7 + k * 2, h.z0 + k * 2 + 1, MAT.HULL3);
  // upper gallery: ceiling girders (dark upper level)
  for (let z = h.z0 + 6; z < h.z1; z += 18) B(h.dx0, h.y1 - 6, z, h.dx1, h.y1, z + 3, MAT.DEEP);
  for (let x = h.dx0 + 8; x < h.dx1; x += 16) B(x, h.y1 - 3, h.z0, x + 2, h.y1, h.z1, MAT.DEEP2);
  // lit strips on the inner upper wall
  for (let z = h.z0 + 10; z < h.z1; z += 36) B(h.dx0, h.y1 - 14, z, h.dx0, h.y1 - 12, z + 20, MAT.LAMP_DIM);
  // berths: alcoves on both side walls (recessed)
  const berths = [];
  const bayLen = 34;
  for (const z of [h.z0 + 14, h.z0 + 56, h.z0 + 98, h.z0 + 162, h.z0 + 204, h.z0 + 246]) {
    for (const side of [0, 1]) {
      const wx = side ? h.dx1 : h.dx0;
      const dir = side ? 1 : -1;
      // alcove carved into the wall beyond the hangar volume
      const xa = side ? h.dx1 - 18 : h.dx0, xb = side ? h.dx1 : h.dx0 + 18;
      // pad + frame inside the bay volume along the wall
      B(xa, h.y0, z, xb, h.y0 + 2, z + bayLen, MAT.FLOOR);
      B(xa, h.y0 + 3, z - 3, xb, h.y0 + 30, z - 1, MAT.HULL2);
      B(xa, h.y0 + 28, z - 3, xb, h.y0 + 32, z + bayLen + 3, MAT.HULL2);
      B(xa, h.y0 + 3, z + bayLen + 1, xb, h.y0 + 30, z + bayLen + 3, MAT.HULL2);
      B(side ? xb - 1 : xa, h.y0 + 3, z, side ? xb : xa + 1, h.y0 + 28, z + bayLen, MAT.DEEP);
      B(xa + 2, h.y0 + 3, z + 4, xb - 2, h.y0 + 3, z + bayLen - 4, MAT.CHASE);
      B(side ? xa : xb, h.y0 + 31, z, side ? xa : xb, h.y0 + 31, z + bayLen, MAT.LAMP_DIM);
      // abstract maintenance frame: arm reaching from the upper wall
      B(side ? xa - 2 : xb, h.y0 + 34, z + 12, side ? xa : xb + 2, h.y0 + 36, z + 22, MAT.GUN);
      B(side ? xa - 6 : xb + 2, h.y0 + 30, z + 14, side ? xa - 3 : xb + 5, h.y0 + 34, z + 20, MAT.TRIM);
      berths.push([X(side ? h.dx1 - 9 : h.dx0 + 9), h.y0 + 6, z + bayLen / 2]);
    }
  }
  // floor: guide light lanes converging to the far end + grid
  for (let z = h.z0; z < h.z1; z += 1) { if (z % 6 < 3) { B(cxm - 14, h.y0 - 1, z, cxm - 13, h.y0 - 1, z, MAT.CHASE); B(cxm + 13, h.y0 - 1, z, cxm + 14, h.y0 - 1, z, MAT.CHASE); } }
  for (let z = h.z0; z < h.z1; z += 12) B(h.dx0 + 18, h.y0 - 1, z, h.dx1 - 18, h.y0 - 1, z, MAT.DEEP);
  // overhead bridges spanning the bay
  for (const z of [h.z0 + 70, h.z0 + 170, h.z0 + 250]) {
    B(h.dx0, h.y1 - 22, z, h.dx1, h.y1 - 16, z + 7, MAT.HULL2);
    B(h.dx0, h.y1 - 24, z + 1, h.dx1, h.y1 - 23, z + 6, MAT.TRIM);
    B(h.dx0, h.y1 - 15, z + 2, h.dx1, h.y1 - 15, z + 5, MAT.LAMP);
    for (let x = h.dx0 + 6; x < h.dx1; x += 10) B(x, h.y1 - 16, z, x + 1, h.y1, z + 7, MAT.DEEP);
  }
  // inner (second) hatch: thick stepped frame narrowing the bay
  const hz = h.z0 + 142;
  for (let k = 0; k < 3; k++) {
    const in_ = 6 + k * 3;
    B(h.dx0, h.y0, hz + k * 4, h.dx0 + in_, h.y1, hz + k * 4 + 3, k === 1 ? MAT.DEEP : MAT.HULL);
    B(h.dx1 - in_, h.y0, hz + k * 4, h.dx1, h.y1, hz + k * 4 + 3, k === 1 ? MAT.DEEP : MAT.HULL);
    B(h.dx0, h.y1 - in_, hz + k * 4, h.dx1, h.y1, hz + k * 4 + 3, k === 1 ? MAT.DEEP : MAT.HULL);
  }
  B(h.dx0 + 12, h.y1 - 12, hz + 4, h.dx1 - 12, h.y1 - 12, hz + 6, MAT.GLOW);
  B(h.dx0 + 8, h.y0, hz + 4, h.dx0 + 9, h.y1 - 12, hz + 6, MAT.GLOW_DIM);
  B(h.dx1 - 9, h.y0, hz + 4, h.dx1 - 8, h.y1 - 12, hz + 6, MAT.GLOW_DIM);
  // mouth: open the outer wall at the forward end, stepped recessed frames
  C(h.dx1 - 2, h.y0 + 2, h.mouthZ0, outer + 4, h.y1 - 4, h.mouthZ1);
  for (let k = 0; k < 4; k++) {
    const d = k * 3; const xo = outer - k * 4;
    B(xo - 3, h.y0 - 4 + d, h.mouthZ0 - 6 + d, xo, h.y0 + 1 + d, h.mouthZ1 + 6 - d, k % 2 ? MAT.HULL3 : MAT.HULL2);
    B(xo - 3, h.y1 - 3 - d, h.mouthZ0 - 6 + d, xo, h.y1 + 2 - d, h.mouthZ1 + 6 - d, k % 2 ? MAT.HULL3 : MAT.HULL2);
    B(xo - 3, h.y0 - 4 + d, h.mouthZ0 - 6 + d, xo, h.y1 + 2 - d, h.mouthZ0 - 2 + d, k % 2 ? MAT.HULL3 : MAT.HULL2);
    B(xo - 3, h.y0 - 4 + d, h.mouthZ1 + 2 - d, xo, h.y1 + 2 - d, h.mouthZ1 + 6 - d, k % 2 ? MAT.HULL3 : MAT.HULL2);
  }
  // launch bay opposite the mouth: ribbed inner wall, gantry, deck markings
  for (let z = h.mouthZ0 - 4; z < h.z1; z += 14) {
    B(h.dx0, h.y0, z, h.dx0 + 3, h.y1, z + 3, MAT.HULL2);
    B(h.dx0 + 3, h.y0 + 8, z + 1, h.dx0 + 4, h.y1 - 8, z + 2, MAT.DEEP);
  }
  for (let z = h.mouthZ0 + 3; z < h.z1 - 4; z += 14) { B(h.dx0, h.y0 + 30, z, h.dx0, h.y0 + 32, z + 8, MAT.LAMP_DIM); B(h.dx0, h.y0 + 12, z + 2, h.dx0 + 1, h.y0 + 22, z + 6, MAT.DEEP2); }
  B(h.dx0 + 4, h.y1 - 12, h.mouthZ0 + 10, h.dx1 - 4, h.y1 - 8, h.mouthZ0 + 16, MAT.GUN);
  B(h.dx0 + 4, h.y1 - 13, h.mouthZ0 + 11, h.dx1 - 4, h.y1 - 13, h.mouthZ0 + 15, MAT.GLOW_DIM);
  B(Math.round((h.dx0 + h.dx1) / 2) - 3, h.y1 - 17, h.mouthZ0 + 9, Math.round((h.dx0 + h.dx1) / 2) + 3, h.y1 - 13, h.mouthZ0 + 17, MAT.HULL3);
  for (let x = h.dx0 + 10; x < h.dx1 - 10; x += 8) B(x, h.y0 - 1, h.mouthZ0 + 30, x + 4, h.y0 - 1, h.mouthZ0 + 33, MAT.WARN);
  // lip lights and landing deck extension at the mouth
  B(h.dx1 - 2, h.y0 - 2, h.mouthZ0 + 4, outer - 10, h.y0, h.mouthZ1 - 4, MAT.FLOOR);
  for (let z = h.mouthZ0 + 6; z < h.mouthZ1 - 4; z += 8) B(outer - 14, h.y0 + 1, z, outer - 12, h.y0 + 1, z + 3, MAT.GLOW);
  B(outer - 13, h.y1 - 6, h.mouthZ0, outer - 12, h.y1 - 5, h.mouthZ1, MAT.GLOW_DIM);
  h.berths = berths;
}

// ---------------------------------------------------------------------------
// Bridge: command hall ~130 wide x 130 deep x 60 high inside the crown.
// ---------------------------------------------------------------------------
function buildBridgeInto(g, CX) {
  const x0 = CX - 65, x1 = CX + 64, y0 = 192, y1 = 252, z0 = 652, z1 = 782;
  g.box(x0, y0, z0, x1, y1, z1, 0);
  // walls lining
  g.box(x0 - 3, y0 - 3, z0 - 3, x0 - 1, y1 + 3, z1 + 3, MAT.WALL);
  g.box(x1 + 1, y0 - 3, z0 - 3, x1 + 3, y1 + 3, z1 + 3, MAT.WALL);
  g.box(x0, y0 - 3, z0 - 3, x1, y0 - 1, z1 + 3, MAT.FLOOR);
  g.box(x0, y1 + 1, z0 - 3, x1, y1 + 3, z1 + 3, MAT.DEEP);
  g.box(x0, y0, z0 - 3, x1, y1, z0 - 1, MAT.WALL);
  // front observation opening (crown front face) with forked mullions
  const wy0 = y0 + 10, wy1 = y1 - 8;
  g.box(x0 + 8, wy0, z1 - 2, x1 - 8, wy1, z1 + 14, 0);
  for (const dx of [-44, -15, 15, 44]) {
    g.box(CX + dx - 2, wy0, z1 - 1, CX + dx + 1, wy1, z1 + 3, MAT.HULL2);
    g.box(CX + dx - 1, wy0, z1 + 3, CX + dx, wy1, z1 + 8, MAT.TRIM);
  }
  g.box(x0 + 8, wy0 + 15, z1 - 1, x1 - 8, wy0 + 16, z1 + 2, MAT.HULL2);
  g.box(x0 + 8, wy1 - 1, z1 - 2, x1 - 8, wy1, z1 + 14, MAT.HULL3);
  g.box(x0 + 8, wy0 - 1, z1 - 2, x1 - 8, wy0, z1 + 14, MAT.HULL3);
  g.box(x0 + 8, wy0, z1 + 6, x1 - 8, wy0, z1 + 6, MAT.GLOW_DIM);
  // side tiers: two raised platforms per side with console rows
  const consoles = [];
  for (const side of [-1, 1]) {
    for (let t = 0; t < 2; t++) {
      const py = y0 + 6 + t * 13; const xi = side < 0 ? x0 : x1; const w = 34 - t * 12;
      const xa = side < 0 ? xi : xi - w, xb = side < 0 ? xi + w : xi;
      g.box(xa, y0, z0 + 8, xb, py, z1 - 16, t ? MAT.HULL2 : MAT.FLOOR);
      g.box(side < 0 ? xb : xa, py - 1, z0 + 8, side < 0 ? xb : xa, py, z1 - 16, MAT.GLOW_DIM);
      g.box(xa, py, z0 + 8, xb, py, z1 - 16, MAT.FLOOR);
      // consoles along the tier edge
      for (let z = z0 + 16; z < z1 - 24; z += 16) {
        const ex = side < 0 ? xb - 6 : xa + 2;
        g.box(ex, py + 1, z, ex + 4, py + 5, z + 10, MAT.GUN);
        g.box(ex, py + 6, z, ex + 4, py + 6, z + 10, MAT.SCREEN);
        g.box(side < 0 ? ex : ex + 4, py + 6, z + 1, side < 0 ? ex : ex + 4, py + 10, z + 9, (z / 16) % 3 === 0 ? MAT.SCREEN2 : MAT.SCREEN);
        consoles.push([ex + 2, py + 7, z + 5]);
      }
      // hanging display panels above tiers
      for (let z = z0 + 24; z < z1 - 30; z += 34) {
        const hx = side < 0 ? x0 + 14 + t * 10 : x1 - 18 - t * 10;
        g.box(hx + 1, y1 - 20 + t * 3, z, hx + 2, y1 - 11, z + 18, MAT.HOLO);
        g.box(hx, y1 - 10, z, hx + 3, y1 - 10, z + 18, MAT.GUN);
        g.box(hx + 1, y1 - 9, z + 8, hx + 2, y1, z + 9, MAT.DEEP);
      }
    }
    // stair steps from floor to tiers
    for (let k = 0; k < 6; k++) { const xi = side < 0 ? x0 + 34 + k : x1 - 34 - k; g.box(xi, y0, z1 - 30, xi, y0 + 6 - k, z1 - 22, MAT.HULL3); }
  }
  // central command hub: stepped octagonal base
  const hx = CX - 0.5, hz = z0 + 62;
  for (let k = 0; k < 5; k++) { const r = 26 - k * 4; g.cyl('y', hx, hz, r, y0 + k * 2, y0 + k * 2 + 1, k % 2 ? MAT.HULL2 : MAT.HULL3); }
  g.cyl('y', hx, hz, 8, y0 + 10, y0 + 15, MAT.GUN);
  g.cyl('y', hx, hz, 22, y0 + 1, y0 + 1, MAT.GLOW_DIM); g.cyl('y', hx, hz, 21, y0 + 1, y0 + 1, MAT.HULL2);
  // suspended display ring structure over the hub
  for (let a = 0; a < 12; a++) {
    const an = (a / 12) * Math.PI * 2; const px = hx + Math.cos(an) * 30, pz = hz + Math.sin(an) * 30;
    g.box(px - 2, y1 - 22, pz - 2, px + 2, y1 - 21, pz + 2, MAT.GUN); g.box(px - 1, y1 - 20, pz - 1, px + 1, y1 - 15, pz + 1, a % 2 ? MAT.HOLO : MAT.SCREEN);
    g.box(px, y1 - 13, pz, px, y1, pz, MAT.DEEP);
  }
  // ceiling spanning beams (stepped arches)
  for (let z = z0 + 10; z < z1; z += 26) {
    g.box(x0, y1 - 6, z, x1, y1, z + 5, MAT.HULL2);
    g.box(x0, y1 - 8, z + 1, x1, y1 - 7, z + 4, MAT.DEEP);
    g.box(x0 + 30, y1 - 9, z + 2, x1 - 30, y1 - 9, z + 3, MAT.LAMP_DIM);
    for (const s of [-1, 1]) { const xb = s < 0 ? x0 : x1 - 6; g.box(xb, y0, z, xb + 6, y1, z + 5, MAT.HULL2); g.box(s < 0 ? xb + 6 : xb, y0 + 30, z + 1, s < 0 ? xb + 6 : xb, y1 - 8, z + 4, MAT.GLOW_DIM); }
  }
  // front console arc facing the window
  for (let a = -5; a <= 5; a++) {
    const px = CX + a * 9, pz = z1 - 14 - Math.abs(a) * 1.2;
    g.box(px - 3, y0, pz, px + 3, y0 + 4, pz + 4, MAT.GUN);
    g.box(px - 3, y0 + 5, pz, px + 3, y0 + 5, pz + 4, a % 2 ? MAT.SCREEN2 : MAT.SCREEN);
  }
  return { min: [x0 - 1, y0 - 1, z0 - 1], max: [x1 + 1, y1 + 1, z1 + 14], hub: [CX, y0 + 30, hz], window: [CX, (wy0 + wy1) / 2, z1 + 6], consoles };
}

// ---------------------------------------------------------------------------
// GUARD (近卫) ~168 long: compact, thick, short wings, CIWS barbettes
// ---------------------------------------------------------------------------
function buildGuard() {
  const S = SymModel(112, 72, 168); const { g, B, C, P, L, X, CX } = S;
  const lerp = U.lerp, sm = U.smooth; const rnd = U.rng(77);
  const hw = (z) => lerp(16, 30, sm(10, 52, z)) - 18 * sm(104, 150, z);
  const y0 = (z) => lerp(24, 14, sm(10, 52, z)) + 12 * sm(116, 160, z);
  const y1 = (z) => lerp(46, 56, sm(10, 52, z)) - 12 * sm(112, 160, z);
  L(8, 160, (z) => ({ hw: hw(z) - 3, y0: y0(z) + 3, y1: y1(z) - 2, ch: 9 }), MAT.DEEP);
  [[8, 50], [54, 92], [96, 130], [134, 160]].forEach(([a, b], i) => L(a, b, (z) => ({ hw: hw(z) + (i % 2), y0: y0(z), y1: y1(z), ch: 10 }), i % 2 ? MAT.HULL2 : MAT.HULL));
  // stacked dorsal plates
  L(30, 122, (z) => ({ hw: 24 - 6 * sm(100, 122, z), y0: 54, y1: 59, ch: 3 }), MAT.HULL3);
  L(48, 108, (z) => ({ hw: 16, y0: 59, y1: 63, ch: 3 }), MAT.HULL);
  L(60, 96, (z) => ({ hw: 9, y0: 63, y1: 66, ch: 2 }), MAT.HULL3);
  B(0, 66, 66, 1, 70, 84, MAT.HULL2); B(0, 70, 66, 1, 70, 78, MAT.TRIM);
  B(10, 59, 48, 12, 62, 108, MAT.DEEP);
  B(0, 63, 50, 3, 63, 58, MAT.GLOW_DIM);
  // overlapping side shells
  L(36, 132, (z) => ({ hw: 33 - 4 * sm(110, 132, z), y0: 26, y1: 44, ch: 6 }), MAT.HULL);
  B(30, 33, 36, 35, 36, 132, MAT.DEEP);
  // short wings
  L(54, 116, (z) => ({ hw: lerp(52, 36, sm(90, 116, z)), y0: 30, y1: 38, ch: 3 }), MAT.HULL2);
  L(60, 108, (z) => ({ hw: lerp(48, 34, sm(86, 108, z)), y0: 38, y1: 41, ch: 2 }), MAT.HULL3);
  B(34, 31, 54, 54, 33, 60, MAT.DEEP);
  for (let z = 62; z < 110; z += 8) B(36, 29, z, 50, 29, z + 3, MAT.DEEP);
  // CIWS barbettes (protruding mounts)
  const mounts = [];
  for (const z of [66, 94]) { B(42, 38, z - 5, 52, 43, z + 5, MAT.HULL3); B(44, 43, z - 3, 50, 44, z + 3, MAT.TRIM); mounts.push([X(47), 44, z], [111 - X(47), 44, z]); }
  B(-4, 63, 84, 4, 67, 92, MAT.HULL3); mounts.push([CX - 0.5, 67, 88]);
  B(-4, 9, 76, 4, 14, 84, MAT.HULL3); mounts.push([CX - 0.5, 9, 80]);
  // bow: forked beak (two jaws around a dark glowing slot)
  L(128, 167, (z) => ({ c: 11, hw: lerp(10, 4, sm(128, 167, z)), y0: lerp(24, 31, sm(128, 167, z)), y1: lerp(50, 41, sm(128, 167, z)), ch: 3 }), MAT.HULL);
  L(132, 160, (z) => ({ c: 15, hw: 3, y0: 40, y1: lerp(52, 44, sm(132, 160, z)), ch: 1 }), MAT.HULL3);
  C(0, 27, 140, 4, 48, 167);
  B(0, 28, 134, 4, 47, 140, MAT.DEEP2);
  B(0, 33, 136, 2, 41, 140, MAT.GLOW);
  B(5, 36, 150, 6, 37, 162, MAT.GLOW_DIM);
  // stern
  L(0, 12, (z) => ({ hw: 26, y0: 20, y1: 50, ch: 8 }), MAT.HULL2);
  S.nozzle(0, 35, 10, 0, 14, 2);
  S.nozzle(19, 28, 6, 2, 10, 1);
  // windows, accent
  for (let z = 40; z < 128; z += 3) if (z % 30 < 20) B(hw(z), 48, z, hw(z) + 1, 48, z, MAT.WINDOW);
  P(28, 40, 120, 34, 44, 126, MAT.ACCENT);
  greebles(g, rnd, X(14), 54, 20, X(26), 56, 130, 18, [MAT.HULL2, MAT.DEEP, MAT.TRIM], 3);
  hullDetail(g, CX, { pz: 14, py: 8, px: 9, pz2: 16, dens: () => 0.8 });
  g.mirrorX();
  const origin = [CX, 36, 84];
  const L2 = (p) => [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
  return {
    grid: g, origin,
    meta: {
      nozzles: [{ p: L2([CX - 0.5, 35, 0]), r: 10 }, { p: L2([X(19), 28, 2]), r: 6 }, { p: L2([111 - X(19), 28, 2]), r: 6 }],
      mounts: mounts.map(L2), shield: { c: [0, 2, 0], r: [70, 48, 112] }, length: 168,
    },
  };
}

// ---------------------------------------------------------------------------
// VANGUARD (前卫) ~212 long: slender, long split prow, missile outriggers
// ---------------------------------------------------------------------------
function buildVanguard() {
  const S = SymModel(132, 52, 212); const { g, B, C, P, L, X, CX } = S;
  const lerp = U.lerp, sm = U.smooth; const rnd = U.rng(99);
  const hw = (z) => lerp(12, 17, sm(4, 60, z)) - 5 * sm(130, 170, z);
  L(4, 172, (z) => ({ hw: hw(z) - 2, y0: 14, y1: 33, ch: 5 }), MAT.DEEP);
  [[4, 56], [60, 112], [116, 172]].forEach(([a, b], i) => L(a, b, (z) => ({ hw: hw(z) + (i % 2), y0: 12 + (i % 2), y1: 34 - 2 * sm(140, 172, z), ch: 6 }), i % 2 ? MAT.HULL2 : MAT.HULL));
  // long split prow
  L(150, 211, (z) => ({ c: 10, hw: lerp(6, 3, sm(150, 211, z)), y0: lerp(14, 20, sm(150, 211, z)), y1: lerp(32, 26, sm(150, 211, z)), ch: 2 }), MAT.HULL);
  L(160, 205, (z) => ({ c: 13, hw: 2, y0: 24, y1: 28, ch: 0 }), MAT.HULL3);
  C(0, 15, 172, 5, 31, 211);
  B(0, 20, 168, 4, 26, 172, MAT.GLOW);
  B(9, 21, 175, 10, 22, 205, MAT.GLOW_DIM);
  // dorsal fin
  L(36, 126, (z) => ({ hw: 3, y0: 34, y1: lerp(38, 44, sm(36, 100, z)) - 6 * sm(100, 126, z), ch: 0 }), MAT.HULL3);
  // outrigger arms
  for (const [a, b] of [[70, 84], [118, 128]]) { B(16, 20, a, 44, 25, b, MAT.HULL2); B(16, 22, a + 2, 44, 23, b - 2, MAT.DEEP); }
  // missile pods with launch slot rows
  L(46, 156, (z) => ({ c: 53, hw: lerp(5, 9, sm(46, 60, z)) - 4 * sm(140, 156, z), y0: lerp(20, 13, sm(46, 64, z)), y1: lerp(28, 33, sm(46, 64, z)) - 5 * sm(136, 156, z), ch: 3 }), MAT.HULL);
  L(52, 150, (z) => ({ c: 53, hw: 10, y0: 18, y1: 22, ch: 1 }), MAT.HULL2);
  const slots = [];
  for (let z = 62; z <= 136; z += 9) {
    for (const dx of [49, 56]) {
      B(dx - 1, 28, z - 1, dx + 1, 33, z + 1, 0);
      B(dx - 1, 28, z - 1, dx + 1, 28, z + 1, MAT.DEEP2);
      B(dx, 29, z, dx, 30, z, MAT.WARN);
      slots.push([X(dx), 33, z], [131 - X(dx), 33, z]);
    }
    B(46, 33, z - 2, 60, 33, z - 2, MAT.DEEP);
  }
  B(62, 22, 60, 62, 24, 140, MAT.GLOW_DIM);
  S.nozzle(53, 23, 4, 40, 6, 1);
  // stern engines
  L(0, 8, (z) => ({ hw: 18, y0: 12, y1: 34, ch: 5 }), MAT.HULL2);
  S.nozzle(8, 23, 6, 0, 10, 1);
  for (let z = 20; z < 150; z += 3) if (z % 24 < 14) B(hw(z), 28, z, hw(z) + 1, 28, z, MAT.WINDOW);
  P(14, 24, 100, 18, 30, 106, MAT.ACCENT);
  greebles(g, rnd, X(6), 33, 16, X(14), 35, 140, 16, [MAT.HULL2, MAT.DEEP, MAT.TRIM], 2);
  hullDetail(g, CX, { pz: 16, py: 7, px: 8, pz2: 18, dens: () => 0.7 });
  g.mirrorX();
  const origin = [CX, 24, 106];
  const L2 = (p) => [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
  return {
    grid: g, origin,
    meta: {
      nozzles: [{ p: L2([X(8), 23, 0]), r: 6 }, { p: L2([131 - X(8), 23, 0]), r: 6 }, { p: L2([X(53), 23, 40]), r: 4 }, { p: L2([131 - X(53), 23, 40]), r: 4 }],
      slots: slots.map(L2), shield: { c: [0, 2, 4], r: [76, 34, 130] }, length: 212,
    },
  };
}

// ---------------------------------------------------------------------------
// small craft ~30 long (1/37 of the flagship)
function buildCraft() {
  const S = SymModel(22, 10, 31); const { g, B, C, X } = S;
  B(0, 2, 4, 3, 6, 21, MAT.HULL2);
  B(0, 6, 7, 2, 7, 16, MAT.HULL);
  B(0, 6, 15, 1, 7, 19, MAT.GLASS);
  B(3, 3, 6, 3, 5, 20, MAT.DEEP);
  // forked nose: two jaws with a dark slot between
  B(1, 2, 21, 3, 5, 30, MAT.HULL);
  B(2, 5, 22, 3, 5, 28, MAT.HULL3);
  C(0, 3, 22, 0, 5, 30); B(0, 3, 21, 0, 4, 21, MAT.GLOW);
  // swept side pods
  B(4, 3, 5, 8, 3, 15, MAT.HULL2);
  B(7, 2, 4, 9, 5, 12, MAT.HULL);
  B(8, 5, 5, 8, 5, 10, MAT.ACCENT);
  B(9, 3, 11, 9, 4, 12, MAT.GLOW);
  B(7, 2, 3, 9, 4, 3, MAT.DEEP);
  // engines
  B(1, 1, 0, 4, 5, 3, MAT.DEEP);
  B(2, 2, 0, 3, 4, 0, MAT.ENGINE);
  B(0, 7, 4, 0, 7, 9, MAT.GLOW_DIM);
  g.mirrorX();
  return { grid: g, origin: [11, 4, 15], meta: { nozzles: [{ p: [X(2.5) - 11, -1, -15], r: 1.6 }, { p: [21 - X(2.5) - 11, -1, -15], r: 1.6 }] } };
}

// pulse turret head (rotates), pivot at origin
function buildPulseTurret() {
  const S = SymModel(26, 16, 40); const { g, B, C, L, X } = S;
  L(0, 24, (z) => ({ hw: 11 - 3 * U.smooth(16, 24, z), y0: 0, y1: 9 - 2 * U.smooth(14, 24, z), ch: 3 }), MAT.HULL);
  B(0, 9, 4, 6, 11, 16, MAT.HULL3);
  B(0, 3, 0, 12, 5, 3, MAT.DEEP);
  for (const dx of [5]) {
    B(dx - 2, 3, 18, dx + 2, 7, 34, MAT.GUN);
    B(dx - 2, 3, 34, dx - 1, 7, 39, MAT.GUN); B(dx + 1, 3, 34, dx + 2, 7, 39, MAT.GUN);
    B(dx, 4, 33, dx, 6, 36, MAT.MUZZLE);
    B(dx - 3, 2, 22, dx + 3, 8, 25, MAT.HULL2);
    B(dx - 2, 8, 26, dx + 2, 8, 30, MAT.MUZZLE);
  }
  B(10, 4, 6, 11, 5, 14, MAT.GLOW_DIM);
  g.mirrorX();
  const CXp = 13;
  return { grid: g, origin: [CXp, 1, 10], meta: { muzzles: [[X(5) - CXp, 4, 29], [25 - X(5) - CXp, 4, 29]] } };
}

// CIWS head: compact gun block with three short barrels
function buildCIWS() {
  const S = SymModel(14, 11, 27); const { g, B, X } = S;
  B(0, 0, 0, 5, 7, 10, MAT.GUN);
  B(0, 7, 1, 3, 8, 8, MAT.HULL3);
  B(5, 1, 2, 6, 6, 8, MAT.HULL2);
  B(0, 0, 0, 5, 1, 2, MAT.DEEP);
  // three barrels in a short cluster, shrouded at the root
  B(0, 1, 10, 3, 6, 13, MAT.HULL2);
  for (const [dx, y] of [[0, 2], [2, 4], [2, 1]]) { B(dx, y, 10, dx, y, 25, MAT.GUN); B(dx, y, 24, dx, y, 25, MAT.CIWS_GLOW); }
  B(0, 3, 18, 3, 4, 19, MAT.TRIM);
  B(4, 3, 3, 5, 4, 7, MAT.CIWS_GLOW);
  g.mirrorX();
  return { grid: g, origin: [7, 3, 5], meta: { muzzle: [0, 0, 20] } };
}

function buildMissile() {
  const g = new Grid(3, 3, 13);
  g.box(0, 0, 1, 2, 2, 10, MAT.MISSILE); g.box(1, 1, 11, 1, 1, 12, MAT.WARN); g.box(0, 1, 11, 2, 1, 11, MAT.MISSILE); g.box(1, 0, 11, 1, 2, 11, MAT.MISSILE);
  g.box(1, 1, 0, 1, 1, 0, MAT.ENGINE); g.box(0, 0, 2, 0, 0, 4, MAT.HULL2); g.box(2, 2, 2, 2, 2, 4, MAT.HULL2); g.box(1, 1, 6, 1, 1, 8, MAT.ACCENT);
  return { grid: g, origin: [1.5, 1.5, 6] };
}
