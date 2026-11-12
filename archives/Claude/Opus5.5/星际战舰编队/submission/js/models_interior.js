'use strict';
// ---------------------------------------------------------------------------
// Interior halls that live in their own pockets: the power-core atrium and the
// energy loading gallery.  (Bridge and hangar are carved into the flagship.)
// ---------------------------------------------------------------------------

// POWER CORE ATRIUM ~250 wide x ~250 high.  Centre at (C, *, C).
function buildCoreAtrium() {
  const N = 268, H = 262, C = N / 2;
  const g = new Grid(N, H, N);
  const rnd = U.rng(4242);
  const RW = 126; // wall radius (octagon)
  const oct = (x, z) => { const ax = Math.abs(x), az = Math.abs(z); return Math.max(ax, az, (ax + az) * 0.7071); };
  const levels = [34, 78, 122, 166, 210];
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const px = x - C + 0.5, pz = z - C + 0.5; const r = oct(px, pz), rc = Math.hypot(px, pz);
    const ang = Math.atan2(pz, px);
    if (r >= RW && r < RW + 6) {
      // walls with ribs and deep panels
      const rib = Math.abs(((ang / (Math.PI * 2)) * 32 + 64) % 1 - 0.5) < 0.09;
      for (let y = 0; y < H; y++) {
        let m = MAT.WALL;
        const band = (y % 44);
        if (r < RW + 2) { if (rib) m = MAT.HULL2; else if (band > 30 && band < 40) m = MAT.DEEP; else if (band === 41) m = MAT.LAMP_DIM; else if (r < RW + 1) continue; }
        g.d[g.idx(x, y, z)] = m;
      }
      if (rib) for (let y = 4; y < H - 6; y++) g.d[g.idx(x, y, z)] = MAT.HULL2;
    }
    if (r < RW + 6) {
      // floor and ceiling
      for (let y = 0; y < 5; y++) g.d[g.idx(x, y, z)] = y === 4 && (Math.round(rc) % 16 === 0) ? MAT.GLOW_DIM : MAT.FLOOR;
      for (let y = H - 6; y < H; y++) g.d[g.idx(x, y, z)] = MAT.DEEP;
      if (Math.round(rc) % 20 < 3 && rc > 60) g.d[g.idx(x, H - 7, z)] = MAT.DEEP2;
    }
    // platforms: rings between radius 76 and wall, forked spurs reaching inward
    for (let li = 0; li < levels.length; li++) {
      const ly = levels[li];
      const inner = li % 2 ? 92 : 86;
      const spur = (Math.abs(((ang / (Math.PI * 2)) * (li % 2 ? 4 : 6) + li * 0.25 + 64) % 1 - 0.5) < 0.06);
      const spurIn = li % 2 ? 64 : 58;
      const forkGap = Math.abs(((ang / (Math.PI * 2)) * (li % 2 ? 4 : 6) + li * 0.25 + 64) % 1 - 0.5) < 0.012;
      if ((r >= inner && r < RW) || (spur && rc >= spurIn && r < RW && !(forkGap && rc < inner))) {
        for (let y = ly - 4; y <= ly; y++) g.d[g.idx(x, y, z)] = y === ly ? MAT.FLOOR : (y === ly - 4 ? MAT.DEEP : MAT.HULL);
        const edge = (r < inner + 2 && r >= inner) || (spur && rc < spurIn + 2);
        if (edge) { g.d[g.idx(x, ly + 1, z)] = MAT.TRIM; g.d[g.idx(x, ly + 2, z)] = MAT.TRIM; g.d[g.idx(x, ly - 5, z)] = MAT.GLOW_DIM; }
        // underside ribs
        if (Math.round(rc) % 10 === 0) for (let y = ly - 8; y < ly - 4; y++) g.d[g.idx(x, y, z)] = MAT.DEEP;
      }
    }
  }
  // consoles / machinery blocks on platforms
  for (let li = 0; li < levels.length; li++) {
    const ly = levels[li];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + li * 0.3; const rr = 104 + rnd() * 14;
      const x = C + Math.cos(a) * rr, z = C + Math.sin(a) * rr;
      g.box(x - 3, ly + 1, z - 3, x + 3, ly + 6 + rnd() * 5, z + 3, rnd() > 0.5 ? MAT.GUN : MAT.HULL2);
      g.box(x - 2, ly + 7, z - 2, x + 2, ly + 7, z + 2, k % 3 ? MAT.SCREEN : MAT.SCREEN2);
    }
  }
  // core: pedestal, exoskeleton, glass layer, glowing inner column, cap
  for (let k = 0; k < 6; k++) g.cyl('y', C - 0.5, C - 0.5, 58 - k * 5, 5 + k * 4, 8 + k * 4, k % 2 ? MAT.HULL2 : MAT.HULL);
  g.cyl('y', C - 0.5, C - 0.5, 36, 28, 32, MAT.GLOW_DIM);
  for (let k = 0; k < 5; k++) g.cyl('y', C - 0.5, C - 0.5, 50 - k * 4, H - 8 - k * 5, H - 5 - k * 5, k % 2 ? MAT.HULL2 : MAT.HULL);
  g.cyl('y', C - 0.5, C - 0.5, 16, 30, H - 30, MAT.CORE);
  g.cyl('y', C - 0.5, C - 0.5, 21, 30, H - 30, MAT.CORE_GLASS);
  g.cyl('y', C - 0.5, C - 0.5, 19, 30, H - 30, MAT.CORE);
  g.cyl('y', C - 0.5, C - 0.5, 16, 30, H - 30, 0);
  // exoskeleton bars + rings
  for (let a = 0; a < 16; a++) {
    const an = (a / 16) * Math.PI * 2; const x = C + Math.cos(an) * 24, z = C + Math.sin(an) * 24;
    g.box(x - 1.5, 30, z - 1.5, x + 1.5, H - 30, z + 1.5, MAT.CORE_SHELL);
  }
  for (let y = 40; y < H - 34; y += 18) { g.cyl('y', C - 0.5, C - 0.5, 27, y, y + 3, MAT.CORE_SHELL); g.cyl('y', C - 0.5, C - 0.5, 22, y, y + 3, 0); g.cyl('y', C - 0.5, C - 0.5, 26, y + 1, y + 2, MAT.GLOW); g.cyl('y', C - 0.5, C - 0.5, 25, y + 1, y + 2, 0); }
  // massive supports from walls to core (two heights, diagonal)
  const struts = [];
  for (const [yy, a0] of [[100, 0.0], [188, Math.PI / 4]]) {
    for (let k = 0; k < 4; k++) {
      const an = a0 + (k / 4) * Math.PI * 2; const dx = Math.cos(an), dz = Math.sin(an);
      for (let r = 28; r < RW + 2; r += 0.5) {
        const x = C + dx * r, z = C + dz * r; const y = yy + (r - 28) * 0.35;
        g.box(x - 4, y - 5, z - 4, x + 4, y + 4, z + 4, MAT.HULL2);
        g.box(x - 2, y + 5, z - 2, x + 2, y + 5, z + 2, MAT.FLOW_Y);
      }
      struts.push({ a: an, y: yy });
    }
  }
  // collar where struts meet the core
  for (const yy of [100, 188]) { g.cyl('y', C - 0.5, C - 0.5, 34, yy - 7, yy + 6, MAT.HULL); g.cyl('y', C - 0.5, C - 0.5, 28, yy - 7, yy + 6, 0); g.cyl('y', C - 0.5, C - 0.5, 35, yy - 1, yy, MAT.GLOW); }
  // vertical conduits on the walls carrying light up
  for (let k = 0; k < 8; k++) {
    const an = (k / 8) * Math.PI * 2 + 0.2; const x = C + Math.cos(an) * (RW - 2), z = C + Math.sin(an) * (RW - 2);
    g.box(x - 2, 5, z - 2, x + 2, H - 7, z + 2, MAT.DEEP);
    g.box(x - 1, 5, z - 1, x + 1, H - 7, z + 1, MAT.FLOW_Y);
  }
  return { grid: g, origin: [C, 0, C], levels, H, RW };
}

// rotating rings around the core (separate meshes)
function buildCoreRing(rIn, rOut, th, segs, seed) {
  const N = Math.ceil(rOut * 2) + 4, C = N / 2; const g = new Grid(N, th + 4, N); const rnd = U.rng(seed);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const px = x - C + 0.5, pz = z - C + 0.5; const r = Math.hypot(px, pz); const a = Math.atan2(pz, px);
    if (r < rIn || r > rOut) continue;
    const s = ((a / (Math.PI * 2)) * segs + 64) % 1;
    if (s < 0.08) continue; // gaps between segments
    const lip = r > rOut - 2.5 || r < rIn + 1.5;
    for (let y = 2; y < th + 2; y++) {
      let m = lip ? MAT.HULL3 : MAT.CORE_SHELL;
      if (!lip && (y === 2 || y === th + 1)) m = MAT.HULL2;
      if (!lip && y === Math.floor(th / 2) + 2 && s > 0.2 && s < 0.9) m = MAT.GLOW;
      g.d[g.idx(x, y, z)] = m;
    }
    if (s > 0.42 && s < 0.58 && r > rOut - 4) { g.d[g.idx(x, 0, z)] = MAT.HULL2; g.d[g.idx(x, 1, z)] = MAT.HULL2; g.d[g.idx(x, th + 2, z)] = MAT.HULL2; g.d[g.idx(x, th + 3, z)] = MAT.TRIM; }
  }
  return { grid: g, origin: [C, (th + 4) / 2, C] };
}

// ENERGY LOADING GALLERY ~372 long x ~116 wide x ~76 high.  Entrance z=0, glowing aperture at the far end.
function buildCorridor() {
  const NX = 124, NY = 86, NZ = 380, CX = NX / 2;
  const g = new Grid(NX, NY, NZ);
  const rnd = U.rng(777);
  const W0 = 4, W1 = NX - 5, F = 4, CEIL = 80;
  // shell
  g.box(0, 0, 0, NX - 1, F, NZ - 1, MAT.FLOOR);
  g.box(0, CEIL, 0, NX - 1, NY - 1, NZ - 1, MAT.DEEP);
  g.box(0, 0, 0, W0, NY - 1, NZ - 1, MAT.DEEP); g.box(W1, 0, 0, NX - 1, NY - 1, NZ - 1, MAT.DEEP);
  g.box(0, 0, 0, NX - 1, NY - 1, 2, MAT.WALL);
  // wall paneling
  for (let z = 4; z < NZ - 20; z += 12) for (const s of [0, 1]) { const x = s ? W1 - 1 : W0 + 1; g.box(x, 8, z, x, CEIL - 6, z + 9, MAT.WALL); g.box(x, 30, z + 2, x, 31, z + 7, MAT.LAMP_DIM); }
  // floor grooves (tracks for light blocks) and ceiling grooves
  const tracks = [CX - 14, CX + 13, CX - 3, CX + 2];
  for (const tx of tracks.slice(0, 2)) { g.box(tx - 2, F - 2, 3, tx + 2, F, NZ - 30, 0); g.box(tx - 2, F - 3, 3, tx + 2, F - 3, NZ - 30, MAT.DEEP2); g.box(tx - 3, F, 3, tx - 3, F, NZ - 30, MAT.GLOW_DIM); g.box(tx + 3, F, 3, tx + 3, F, NZ - 30, MAT.GLOW_DIM); }
  for (const tx of [CX - 3, CX + 2]) { g.box(tx - 2, CEIL, 3, tx + 2, CEIL + 2, NZ - 30, 0); g.box(tx - 2, CEIL + 3, 3, tx + 2, CEIL + 3, NZ - 30, MAT.DEEP2); }
  // loading devices: tall units on both sides
  const units = [];
  for (let z = 18; z < NZ - 50; z += 44) {
    for (const s of [-1, 1]) {
      const xa = s < 0 ? W0 + 1 : CX + 22, xb = s < 0 ? CX - 23 : W1 - 1;
      // heavy outer frame
      g.box(xa, F, z, xb, F + 6, z + 30, MAT.GUN);
      g.box(xa, F + 6, z, xb, 66, z + 4, MAT.HULL2); g.box(xa, F + 6, z + 26, xb, 66, z + 30, MAT.HULL2);
      g.box(xa, 62, z, xb, 68, z + 30, MAT.GUN); g.box(xa, 68, z + 2, xb, 68, z + 28, MAT.HULL3);
      // deep interlayer with glowing core cells
      g.box(xa + 2, F + 7, z + 5, xb - 2, 61, z + 25, MAT.DEEP);
      for (let y = F + 10; y < 58; y += 9) {
        const inn = s < 0 ? xb - 3 : xa + 3;
        g.box(s < 0 ? inn - 12 : inn, y, z + 8, s < 0 ? inn : inn + 12, y + 5, z + 22, MAT.GUN);
        g.box(s < 0 ? inn - 10 : inn + 1, y + 1, z + 10, s < 0 ? inn + 1 : inn + 10, y + 4, z + 20, MAT.ENERGY);
      }
      // vertical conduit on the face
      const fx = s < 0 ? xb : xa;
      g.box(fx, F + 7, z + 13, fx, 61, z + 17, MAT.FLOW_Y);
      g.box(fx - 1, 66, z + 2, fx + 1, 70, z + 28, MAT.HULL3);
      units.push({ z: z + 15, s });
    }
  }
  // big portal frames receding (stepped profile)
  for (let z = 10; z < NZ - 40; z += 62) {
    for (let k = 0; k < 3; k++) {
      const ins = k * 3;
      g.box(W0, F, z + k * 3, W0 + 10 + ins, CEIL, z + k * 3 + 2, k === 1 ? MAT.DEEP : k ? MAT.GUN : MAT.HULL2);
      g.box(W1 - 10 - ins, F, z + k * 3, W1, CEIL, z + k * 3 + 2, k === 1 ? MAT.DEEP : k ? MAT.GUN : MAT.HULL2);
      g.box(W0, CEIL - 10 - ins, z + k * 3, W1, CEIL, z + k * 3 + 2, k === 1 ? MAT.DEEP : k ? MAT.GUN : MAT.HULL2);
    }
    g.box(W0 + 16, CEIL - 17, z + 3, W1 - 16, CEIL - 17, z + 5, MAT.GLOW);
    g.box(W0 + 10, CEIL - 22, z + 2, W0 + 13, CEIL - 10, z + 6, MAT.HULL3); g.box(W1 - 13, CEIL - 22, z + 2, W1 - 10, CEIL - 10, z + 6, MAT.HULL3);
  }
  // suspended conductor elements from the ceiling
  for (let z = 40; z < NZ - 50; z += 31) {
    g.box(CX - 1, CEIL - 26, z, CX, CEIL - 1, z + 1, MAT.DEEP);
    g.box(CX - 6, CEIL - 34, z - 3, CX + 5, CEIL - 27, z + 4, MAT.HULL2);
    g.box(CX - 4, CEIL - 33, z - 1, CX + 3, CEIL - 28, z + 2, MAT.GLASS);
    g.box(CX - 2, CEIL - 32, z, CX + 1, CEIL - 29, z + 1, MAT.ENERGY);
  }
  // upper connecting girders with flowing light
  for (const s of [-1, 1]) { const x = s < 0 ? CX - 24 : CX + 23; g.box(x - 1, 68, 4, x + 1, 70, NZ - 30, MAT.HULL2); g.box(x, 71, 4, x, 71, NZ - 30, MAT.CHASE); }
  // end aperture: wider glowing cavity
  const EZ = NZ - 30;
  g.box(W0, F, EZ, W1, CEIL, NZ - 1, MAT.HULL);
  for (let k = 0; k < 5; k++) { g.cyl('z', CX - 0.5, 42, 38 - k * 3, EZ + k * 4, EZ + k * 4 + 3, 0); if (k < 4) g.cyl('z', CX - 0.5, 42, 39 - k * 3, EZ + k * 4 + 3, EZ + k * 4 + 3, k % 2 ? MAT.TRIM : MAT.HULL3); }
  g.cyl('z', CX - 0.5, 42, 27, EZ + 20, NZ - 6, 0);
  g.cyl('z', CX - 0.5, 42, 27, NZ - 6, NZ - 4, MAT.CORE);
  g.cyl('z', CX - 0.5, 42, 30, EZ + 23, EZ + 24, MAT.GLOW);
  for (let a = 0; a < 6; a++) { const an = (a / 6) * Math.PI * 2; g.box(CX + Math.cos(an) * 33 - 2, 42 + Math.sin(an) * 33 - 2, EZ - 4, CX + Math.cos(an) * 33 + 2, 42 + Math.sin(an) * 33 + 2, EZ, MAT.HULL2); }
  return { grid: g, origin: [CX, 0, 0], units, tracks, NZ, CEIL, F, endZ: NZ - 5 };
}

// clamp mechanism (opens and closes across the gallery's central gap)
function buildClamp() {
  const g = new Grid(14, 40, 18);
  g.box(0, 0, 0, 13, 39, 17, MAT.HULL2);
  g.box(10, 2, 2, 13, 37, 15, MAT.DEEP);
  g.box(13, 6, 4, 13, 33, 6, MAT.GLOW); g.box(13, 6, 11, 13, 33, 13, MAT.GLOW);
  g.box(0, 18, 0, 9, 21, 17, MAT.HULL3);
  g.box(4, 0, 5, 9, 39, 12, MAT.GUN);
  return { grid: g, origin: [0, 0, 9] };
}
