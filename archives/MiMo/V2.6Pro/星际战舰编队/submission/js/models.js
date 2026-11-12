// Ship / craft / asteroid voxel model generators
(function (global) {
  'use strict';
  const { Voxels, PAL } = global;
  const { lerp, clamp, mulberry32 } = global.U;

  // ============================== FLAGSHIP ==============================
  // length 1100 (x -550..+550), forward = +X
  const FLAG_LEN = 1100;

  function flagshipHullSections() {
    return [
      { x: -550, zr: 58, yr: 52, exp: 2.6 },
      { x: -505, zr: 92, yr: 80, exp: 2.5 },
      { x: -430, zr: 124, yr: 104, exp: 2.4 },
      { x: -345, zr: 148, yr: 124, exp: 2.35 },
      { x: -250, zr: 164, yr: 142, exp: 2.3 },
      { x: -130, zr: 173, yr: 155, exp: 2.3 },
      { x: -10, zr: 176, yr: 160, exp: 2.3 },
      { x: 110, zr: 173, yr: 156, exp: 2.3 },
      { x: 215, zr: 163, yr: 148, exp: 2.35 },
      { x: 315, zr: 146, yr: 134, exp: 2.4 },
      { x: 395, zr: 122, yr: 116, exp: 2.5 },
      { x: 455, zr: 98, yr: 96, exp: 2.55 },
      { x: 505, zr: 76, yr: 76, exp: 2.6 },
      { x: 550, zr: 48, yr: 48, exp: 2.7 }
    ];
  }

  const FLAG_CARVES = [
    { x0: 372, y0: 58, z0: -52, x1: 516, y1: 112, z1: 52 },   // bridge (dorsal-front blister)
    { x0: -55, y0: -118, z0: -118, x1: 195, y1: 125, z1: 118 }, // reactor
    { x0: -415, y0: -55, z0: 48, x1: -55, y1: 42, z1: 158 },    // hangar (opens +Z)
    { x0: -445, y0: -105, z0: -62, x1: -95, y1: -32, z1: 62 }   // corridor
  ];

  function inAnyCarve(x, y, z) {
    for (let i = 0; i < FLAG_CARVES.length; i++) {
      const c = FLAG_CARVES[i];
      if (x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1 && z >= c.z0 && z <= c.z1) return true;
    }
    return false;
  }

  function buildFlagship(opts) {
    opts = opts || {};
    const v = new Voxels(101);
    const detail = opts.detail !== undefined ? opts.detail : 1;

    // ---- main hull loft (shell) ----
    v.hullLoft(flagshipHullSections(), PAL.hull, 0, 2, 0.14);
    // filter carved regions
    filterCarves(v);

    // ---- dark recessed grooves: horizontal bands along hull ----
    const groove = PAL.deep;
    for (let x = -520; x <= 500; x += 10) {
      const sec = sectionAt(flagshipHullSections(), x);
      // side grooves at several heights
      const hs = [-0.55, -0.15, 0.35, 0.72];
      for (let hi = 0; hi < hs.length; hi++) {
        const ny = hs[hi];
        const zr = sec.zr * Math.pow(Math.max(1 - Math.pow(Math.abs(ny), sec.exp), 0), 1 / sec.exp);
        const y = Math.round(ny * sec.yr);
        for (const s of [-1, 1]) {
          const z = Math.round(s * zr);
          // a short recessed band of 3 voxels
          v.push(x, y, z, groove[0], groove[1], groove[2], 0, 0.5);
          v.push(x, y + 1, z, groove[0], groove[1], groove[2], 0, 0.5);
          if ((x % 20) < 10) v.push(x, y - 1, z, groove[0], groove[1], groove[2], 0, 0.5);
        }
      }
    }

    // ---- armored plate rows (terraced lamellar) on dorsal & sides ----
    if (detail > 0.3) addLamellarPlates(v);

    // ---- dorsal superstructure (stepped ridge) ----
    addDorsalSpine(v);

    // ---- belly keel & ribs ----
    addBellyRibs(v);

    // ---- side sponsons ----
    addSponsons(v);

    // ---- glow strips (energy seams) ----
    addGlowSeams(v);

    // ---- bow fork prongs ----
    addBowProngs(v);

    // ---- main beam cannon ----
    addMainCannon(v);

    // ---- engine cluster ----
    addEngines(v);

    // ---- hangar exterior frame ----
    addHangarFrame(v);

    // ---- pulse turrets ----
    const turretSites = [];
    if (detail > 0.2) {
      const spots = [
        [200, 130, -48], [200, 130, 48], [60, 142, -62], [60, 142, 62],
        [-100, 138, -80], [-100, 138, 80], [-250, 126, -96], [-250, 126, 96],
        [320, 116, -36], [320, 116, 36],
        [-40, 30, -176], [-40, 30, 176], [-300, 16, -158], [-300, 16, 158]
      ];
      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        if (inAnyCarve(s[0], s[1], s[2])) continue;
        addPulseTurret(v, s[0], s[1], s[2], i % 2 === 0 ? 1 : -1);
        turretSites.push(s);
      }
    }

    return { voxels: v, turretSites, length: FLAG_LEN };
  }

  function sectionAt(secs, x) {
    for (let i = 0; i < secs.length - 1; i++) {
      if (x >= secs[i].x && x <= secs[i + 1].x) {
        const t = (x - secs[i].x) / (secs[i + 1].x - secs[i].x || 1);
        return {
          zr: lerp(secs[i].zr, secs[i + 1].zr, t),
          yr: lerp(secs[i].yr, secs[i + 1].yr, t),
          exp: lerp(secs[i].exp || 2.4, secs[i + 1].exp || 2.4, t)
        };
      }
    }
    return { zr: secs[0].zr, yr: secs[0].yr, exp: 2.4 };
  }

  function filterCarves(v) {
    const out = new Voxels(1);
    const it = v.items;
    for (let i = 0; i < v.n; i++) {
      const o = i * 8;
      const x = it[o], y = it[o + 1], z = it[o + 2];
      if (!inAnyCarve(x, y, z)) {
        out.push(it[o], it[o + 1], it[o + 2], it[o + 3], it[o + 4], it[o + 5], it[o + 6], it[o + 7]);
      }
    }
    v.items = out.items;
    v.n = out.n;
    v.cap = out.cap;
  }

  function addLamellarPlates(v) {
    const rng = mulberry32(77);
    // rows of stepped armor plates on dorsal and flanks
    for (let x = -460; x <= 420; x += 22) {
      const sec = sectionAt(flagshipHullSections(), x);
      // dorsal plates
      const pw = 16 + Math.floor(rng() * 14);
      const pd = 8 + Math.floor(rng() * 8);
      const py = Math.floor(sec.yr * 0.86);
      const hcol = rng() > 0.5 ? PAL.hullLight : PAL.hull;
      v.box(x, py, -pw, x + pd, py + 4, pw, hcol, 0, 0.1);
      v.box(x + 1, py + 4, -pw + 4, x + pd - 1, py + 7, pw - 4, PAL.hullLight, 0, 0.1);
      // flank plates
      for (const s of [-1, 1]) {
        const z = Math.floor(sec.zr * 0.93);
        const y = Math.floor((rng() - 0.4) * sec.yr * 0.7);
        v.box(x, y - 8, s * z, x + pd + 5, y + 8, s * (z + 5), hcol, 0, 0.1);
        v.box(x + 1, y - 4, s * (z + 5), x + pd + 3, y + 4, s * (z + 8), PAL.hullLight, 0, 0.1);
      }
    }
  }

  function addDorsalSpine(v) {
    // stepped ridge blocks along the top (hull top ≈ 155-160 mid)
    const blocks = [
      [-240, -70, 142, 70], [-70, 130, 150, 84], [130, 270, 140, 64], [270, 368, 122, 46]
    ];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      v.box(b[0], b[2], -b[3], b[1], b[2] + 18, b[3], PAL.hullDark, 0, 0.1);
      v.box(b[0] + 5, b[2] + 18, -b[3] + 10, b[1] - 5, b[2] + 28, b[3] - 10, PAL.hull, 0, 0.1);
      v.box(b[0] + 12, b[2] + 28, -b[3] + 20, b[1] - 12, b[2] + 36, b[3] - 20, PAL.hullLight, 0, 0.1);
    }
  }

  function addBellyRibs(v) {
    for (let x = -470; x <= 380; x += 34) {
      const sec = sectionAt(flagshipHullSections(), x);
      const y = -Math.floor(sec.yr * 0.92);
      const w = Math.floor(sec.zr * 0.55);
      v.box(x, y - 10, -w, x + 10, y, w, PAL.hullDark, 0, 0.1);
      v.box(x + 2, y - 18, -w + 8, x + 8, y - 10, w - 8, PAL.deep2, 0, 0.1);
    }
  }

  function addSponsons(v) {
    // elongated side pods
    const pods = [[-330, -110], [-50, 175]];
    for (let pi = 0; pi < pods.length; pi++) {
      const a = pods[pi][0], b = pods[pi][1];
      for (const s of [-1, 1]) {
        const z0 = s * 172, z1 = s * 206;
        v.box(a, -30, Math.min(z0, z1), b, 40, Math.max(z0, z1), PAL.hullDark, 0, 0.1);
        v.box(a + 8, -22, Math.min(z0, z1) - s * 2, b - 8, 32, Math.max(z0, z1) + s * 2, PAL.hull, 0, 0.1);
        v.box(a + 12, -16, s * 208, b - 12, -10, s * 211, PAL.glowCyanDim, 0.55);
      }
    }
  }

  function addGlowSeams(v) {
    // long energy seams along the flanks
    for (let x = -500; x <= 470; x += 4) {
      const sec = sectionAt(flagshipHullSections(), x);
      const z = Math.floor(sec.zr * 0.98);
      const y = Math.floor(sec.yr * 0.05);
      for (const s of [-1, 1]) {
        if ((x + (s > 0 ? 2 : 0)) % 8 < 4) {
          v.push(x, y, s * z, PAL.glowCyan[0], PAL.glowCyan[1], PAL.glowCyan[2], 0.85, 0.5);
        }
      }
    }
    // dorsal seam
    for (let x = -300; x <= 340; x += 4) {
      const sec = sectionAt(flagshipHullSections(), x);
      const y = Math.floor(sec.yr * 0.98);
      if (x % 8 < 4) v.push(x, y, 0, PAL.glowCyan[0], PAL.glowCyan[1], PAL.glowCyan[2], 0.8, 0.5);
    }
  }

  function addBowProngs(v) {
    // two fork prongs stepping forward (outside bridge carve z ±52)
    for (const s of [-1, 1]) {
      const zc = s * 92;
      // main prong body with terraced steps
      v.box(420, -34, zc - 30, 520, 42, zc + 30, PAL.hull, 0, 0.12);
      v.box(465, -24, zc - 22, 548, 32, zc + 22, PAL.hullLight, 0, 0.12);
      v.box(505, -15, zc - 15, 566, 22, zc + 15, PAL.hullDark, 0, 0.12);
      // bright tip
      v.box(552, -9, zc - 9, 578, 14, zc + 9, PAL.edge, 0, 0.1);
      v.box(572, -5, zc - 5, 584, 10, zc + 5, PAL.hullLight, 0, 0.1);
      // inner dark channel
      v.box(430, -12, zc - s * 26, 545, 10, zc - s * 20, PAL.deep, 0);
      // glow line along prong
      for (let x = 445; x <= 575; x += 4) {
        v.push(x, 12, zc, PAL.glowCyan[0], PAL.glowCyan[1], PAL.glowCyan[2], 1.0, 0.5);
        v.push(x, -10, zc, PAL.glowCyanDim[0], PAL.glowCyanDim[1], PAL.glowCyanDim[2], 0.6, 0.5);
      }
      // stepped outer fins
      v.box(480, 22, zc + s * 22, 540, 32, zc + s * 34, PAL.hullDark, 0, 0.12);
      v.box(500, -28, zc + s * 22, 555, -18, zc + s * 32, PAL.hullDark, 0, 0.12);
    }
    // cross braces between prongs (below bridge)
    v.box(465, -28, -58, 485, -8, 58, PAL.hullDark, 0);
    v.box(505, -22, -48, 520, -4, 48, PAL.hullDark, 0);
    v.box(535, -16, -38, 548, -6, 38, PAL.hullDark, 0);
  }

  function addMainCannon(v) {
    // wide base → barrel → glowing muzzle, centered below bridge
    v.box(190, -52, -58, 320, -4, 58, PAL.deep2, 0, 0.1);
    v.box(215, -42, -44, 345, -12, 44, PAL.hullDark, 0, 0.1);
    v.box(245, -34, -32, 370, -16, 32, PAL.hull, 0, 0.1);
    // barrel
    v.box(330, -30, -18, 475, -12, 18, PAL.hullDark, 0, 0.1);
    v.box(345, -26, -13, 488, -16, 13, PAL.hull, 0, 0.1);
    v.box(375, -23, -9, 505, -19, 9, PAL.deep, 0);
    for (let x = 345; x <= 510; x += 4) {
      v.push(x, -24, -15, PAL.glowAmber[0], PAL.glowAmber[1], PAL.glowAmber[2], 0.75, 0.5);
      v.push(x, -24, 15, PAL.glowAmber[0], PAL.glowAmber[1], PAL.glowAmber[2], 0.75, 0.5);
      if (x % 8 < 4) v.push(x, -18, 0, PAL.glowAmberDim[0], PAL.glowAmberDim[1], PAL.glowAmberDim[2], 0.6, 0.5);
    }
    // muzzle ring + deep glowing mouth
    v.cyl('x', 505, 524, 0, -22, 0, 28, PAL.hullLight, 0, true);
    v.cyl('x', 520, 530, 0, -22, 0, 20, PAL.deep, 0);
    v.cyl('x', 526, 533, 0, -22, 0, 13, PAL.glowAmber, 1.6);
    for (const s of [-1, 1]) {
      v.box(500, -42, s * 22, 524, -2, s * 36, PAL.hullDark, 0, 0.1);
    }
    v.box(500, -4, -18, 524, 8, 18, PAL.hullDark, 0, 0.1);
    v.box(500, -48, -18, 524, -36, 18, PAL.hullDark, 0, 0.1);
  }

  function addEngines(v) {
    // stern frame (hull at -550: zr≈58, yr≈52 — engines sit in a wider bell)
    v.box(-556, -72, -92, -500, 72, 92, PAL.hullDark, 0, 0.1);
    v.box(-544, -58, -76, -488, 58, 76, PAL.deep2, 0, 0.1);
    // explicit nozzle positions (y, z, radius)
    const nz = [
      [0, 0, 40], [52, 0, 28], [-52, 0, 28],
      [24, -66, 26], [24, 66, 26], [-36, -70, 22], [-36, 70, 22]
    ];
    for (let i = 0; i < nz.length; i++) {
      const y = nz[i][0], z = nz[i][1], r = nz[i][2];
      v.cyl('x', -552, -522, 0, y, z, r + 8, PAL.hull, 0, true);
      v.cyl('x', -542, -518, 0, y, z, r + 3, PAL.hullDark, 0, true);
      v.cyl('x', -534, -514, 0, y, z, r - 2, PAL.deep, 0, true);
      v.cyl('x', -530, -514, 0, y, z, Math.max(r - 12, 8), PAL.glowAmber, 1.5);
      v.cyl('x', -526, -514, 0, y, z, Math.max(r - 20, 5), PAL.glowAmber, 2.2);
    }
  }

  function addHangarFrame(v) {
    // frame around the side opening (z+) — four edge strips, NOT a solid panel
    // opening spans x -415..-55, y -55..42 at z≈158
    // top & bottom rails
    v.box(-422, 46, 148, -48, 58, 170, PAL.hullDark, 0, 0.1);
    v.box(-422, -68, 148, -48, -55, 170, PAL.hullDark, 0, 0.1);
    // left & right posts
    v.box(-422, -55, 148, -408, 46, 170, PAL.hullDark, 0, 0.1);
    v.box(-62, -55, 148, -48, 46, 170, PAL.hullDark, 0, 0.1);
    // lip edges (thin, along top/bottom)
    v.box(-416, 42, 166, -54, 48, 176, PAL.hullLight, 0, 0.1);
    v.box(-416, -58, 166, -54, -52, 176, PAL.hullLight, 0, 0.1);
    // glow guides around opening
    for (let x = -412; x <= -58; x += 10) {
      v.push(x, -52, 172, PAL.glowCyan[0], PAL.glowCyan[1], PAL.glowCyan[2], 0.9, 0.5);
      v.push(x, 50, 172, PAL.glowCyan[0], PAL.glowCyan[1], PAL.glowCyan[2], 0.9, 0.5);
    }
    for (let y = -48; y <= 42; y += 10) {
      v.push(-416, y, 172, PAL.glowCyan[0], PAL.glowCyan[1], PAL.glowCyan[2], 0.9, 0.5);
      v.push(-58, y, 172, PAL.glowCyan[0], PAL.glowCyan[1], PAL.glowCyan[2], 0.9, 0.5);
    }
  }

  function addPulseTurret(v, x, y, z, facing) {
    // base + rotating block + twin barrels
    v.box(x - 12, y - 10, z - 12, x + 12, y, z + 12, PAL.hullDark, 0, 0.1);
    v.box(x - 10, y, z - 10, x + 10, y + 10, z + 10, PAL.hull, 0, 0.1);
    v.box(x - 6, y + 10, z - 6, x + 6, y + 17, z + 6, PAL.hullLight, 0, 0.1);
    const d = facing >= 0 ? 1 : -1;
    for (const s of [-1, 1]) {
      v.box(x + d * 5, y + 7, z + s * 5 - 2, x + d * 32, y + 12, z + s * 5 + 2, PAL.deep2, 0);
      v.box(x + d * 30, y + 7, z + s * 5 - 2, x + d * 34, y + 12, z + s * 5 + 2, PAL.glowCyanDim, 0.7);
    }
    v.box(x + d * 2, y + 12, z - 5, x + d * 14, y + 16, z + 5, PAL.hullDark, 0);
  }

  // ============================== ESCORT (近卫) ==============================
  // compact thick, length ~220 (1/5 of flagship)
  function buildEscort(seed) {
    const v = new Voxels(200 + (seed || 0) * 13);
    const L = 220, H = 110, W = 96; // x -110..110, y -55..55, z -48..48
    const secs = [
      { x: -110, zr: 22, yr: 20, exp: 2.4 },
      { x: -85, zr: 38, yr: 34, exp: 2.3 },
      { x: -40, zr: 48, yr: 42, exp: 2.25 },
      { x: 10, zr: 50, yr: 44, exp: 2.25 },
      { x: 55, zr: 42, yr: 36, exp: 2.3 },
      { x: 85, zr: 28, yr: 24, exp: 2.4 },
      { x: 110, zr: 14, yr: 12, exp: 2.5 }
    ];
    v.hullLoft(secs, PAL.hull, 0, 2, 0.14);

    // short wings / stacked shell plates
    for (const s of [-1, 1]) {
      v.box(-30, -18, s * 46, 45, 16, s * 72, PAL.hullDark, 0, 0.12);
      v.box(-22, -12, s * 72, 38, 10, s * 80, PAL.hull, 0, 0.12);
      v.box(-14, -6, s * 80, 30, 4, s * 84, PAL.hullLight, 0, 0.12);
    }

    // dorsal stepped block
    v.box(-30, 42, -18, 40, 58, 18, PAL.hullDark, 0, 0.1);
    v.box(-20, 58, -12, 30, 68, 12, PAL.hull, 0, 0.1);
    v.box(-10, 68, -7, 20, 74, 7, PAL.hullLight, 0, 0.1);

    // belly rib
    v.box(-55, -52, -16, 55, -42, 16, PAL.hullDark, 0, 0.1);

    // nose fork (small)
    for (const s of [-1, 1]) {
      v.box(85, -8, s * 8 - 2, 118, 12, s * 8 + 6, PAL.hullLight, 0, 0.12);
      v.box(110, -5, s * 8 - 1, 124, 8, s * 8 + 5, PAL.edge, 0, 0.1);
    }

    // glow seams
    for (let x = -95; x <= 100; x += 5) {
      const sec = sectionAt(secs, x);
      const z = Math.floor(sec.zr * 0.98);
      const y = Math.floor(sec.yr * 0.1);
      for (const s of [-1, 1]) {
        if ((x + (s > 0 ? 2 : 0)) % 10 < 5) {
          v.push(x, y, s * z, PAL.glowCyan[0], PAL.glowCyan[1], PAL.glowCyan[2], 0.85, 0.5);
        }
      }
    }

    // CIWS mounts (速射近防炮) — group of 4 on each side
    const ciws = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = -40 + i * 36;
        const z = s * 46;
        addCIWS(v, x, 30, z, s);
        ciws.push([x, 38, z + s * 10, s]);
      }
    }

    // engines: 2 big + 2 small
    addSmallEngines(v, [[0, 0, 20], [-22, 0, 13], [22, 0, 13]], -108);

    return { voxels: v, length: L, ciws };
  }

  function addCIWS(v, x, y, z, s) {
    v.box(x - 7, y - 6, z - 7, x + 7, y, z + 7, PAL.hullDark, 0, 0.1);
    v.box(x - 5, y, z - 5, x + 5, y + 8, z + 5, PAL.hull, 0, 0.1);
    // barrel cluster (rotating toward +X)
    for (let k = -1; k <= 1; k++) {
      v.box(x + 4, y + 3 + k * 3, z + s * 3 - 1, x + 22, y + 5 + k * 3, z + s * 3 + 1, PAL.deep2, 0);
    }
    v.box(x + 20, y + 2, z + s * 3 - 2, x + 24, y + 8, z + s * 3 + 2, PAL.glowCyanDim, 0.7);
  }

  function addSmallEngines(v, list, xBack) {
    for (let i = 0; i < list.length; i++) {
      const y = list[i][0], z = list[i][1], r = list[i][2];
      // note list is [y,z,r]
      const yy = list[i][0], zz = list[i][1], rr = list[i][2];
      v.cyl('x', xBack - 12, xBack + 6, 0, yy, zz, rr + 4, PAL.hullDark, 0, true);
      v.cyl('x', xBack - 6, xBack + 2, 0, yy, zz, rr - 2, PAL.glowAmber, 1.4);
    }
  }

  // ============================== VANGUARD (前卫) ==============================
  // elongated, missile racks, length ~200
  function buildVanguard(seed) {
    const v = new Voxels(300 + (seed || 0) * 17);
    const secs = [
      { x: -100, zr: 18, yr: 16, exp: 2.5 },
      { x: -75, zr: 30, yr: 26, exp: 2.4 },
      { x: -35, zr: 38, yr: 32, exp: 2.3 },
      { x: 15, zr: 40, yr: 34, exp: 2.3 },
      { x: 55, zr: 34, yr: 28, exp: 2.35 },
      { x: 85, zr: 22, yr: 18, exp: 2.45 },
      { x: 100, zr: 11, yr: 9, exp: 2.55 }
    ];
    v.hullLoft(secs, PAL.hull, 0, 2, 0.14);

    // missile racks: rows of tubes on both sides
    for (const s of [-1, 1]) {
      // rack housing
      v.box(-35, -16, s * 38, 55, 22, s * 58, PAL.hullDark, 0, 0.1);
      v.box(-28, -10, s * 58, 48, 16, s * 66, PAL.hull, 0, 0.1);
      // tube openings (dark) in rows
      for (let ix = 0; ix < 6; ix++) {
        for (let iy = 0; iy < 3; iy++) {
          const x = -22 + ix * 12;
          const y = -6 + iy * 8;
          v.box(x, y, s * 66, x + 7, y + 5, s * 70, PAL.deep, 0);
          v.box(x + 1, y + 1, s * 68, x + 6, y + 4, s * 71, PAL.glowAmberDim, 0.55);
        }
      }
    }

    // long dorsal spine
    v.box(-60, 32, -8, 70, 42, 8, PAL.hullDark, 0, 0.1);
    v.box(-50, 42, -5, 60, 50, 5, PAL.hull, 0, 0.1);
    v.box(-40, 50, -3, 50, 55, 3, PAL.hullLight, 0, 0.1);

    // forked nose
    for (const s of [-1, 1]) {
      v.box(70, -6, s * 6 - 3, 108, 10, s * 6 + 3, PAL.hullLight, 0, 0.12);
    }
    v.box(88, -3, -3, 112, 6, 3, PAL.edge, 0, 0.1);

    // belly fin
    v.box(-30, -42, -4, 50, -30, 4, PAL.hullDark, 0, 0.1);

    // glow seams
    for (let x = -88; x <= 92; x += 5) {
      const sec = sectionAt(secs, x);
      const z = Math.floor(sec.zr * 0.98);
      const y = Math.floor(sec.yr * 0.0);
      for (const s of [-1, 1]) {
        if ((x + (s > 0 ? 2 : 0)) % 10 < 5) {
          v.push(x, y, s * z, PAL.glowCyan[0], PAL.glowCyan[1], PAL.glowCyan[2], 0.85, 0.5);
        }
      }
    }

    addSmallEngines(v, [[0, 0, 14], [-14, -18, 10], [-14, 18, 10]], -98);

    return { voxels: v, length: 200 };
  }

  // ============================== SMALL CRAFT ==============================
  function buildSmallCraft() {
    const v = new Voxels(400);
    // 30 long x 12 wide x 9 tall — dart with fork + engines
    v.box(-12, -3, -5, 8, 3, 5, PAL.hull, 0, 0.12);
    v.box(-8, -2, -4, 12, 2, 4, PAL.hullLight, 0, 0.12);
    // nose fork
    for (const s of [-1, 1]) {
      v.box(8, -1, s * 2 - 1, 15, 2, s * 2 + 1, PAL.hullLight, 0, 0.12);
      v.box(14, 0, s * 2 - 1, 16, 1, s * 2 + 1, PAL.edge, 0, 0.1);
    }
    // cockpit / dorsal
    v.box(-2, 3, -2, 5, 5, 2, PAL.hullDark, 0, 0.1);
    v.box(2, 5, -1, 7, 6, 1, PAL.glowCyanDim, 0.6);
    // wings
    for (const s of [-1, 1]) {
      v.box(-6, -1, s * 5, 4, 1, s * 8, PAL.hullDark, 0, 0.12);
    }
    // engines
    v.cyl('x', -14, -10, 0, 0, -3, 2.2, PAL.glowAmber, 1.2);
    v.cyl('x', -14, -10, 0, 0, 3, 2.2, PAL.glowAmber, 1.2);
    v.box(-13, -2, -5, -10, 2, -1, PAL.deep2, 0);
    v.box(-13, -2, 1, -10, 2, 5, PAL.deep2, 0);
    return { voxels: v, length: 30 };
  }

  // ============================== ASTEROID ==============================
  // returns list of chunks: each chunk = {voxels, center, radius, breakVel, breakSpin}
  function buildAsteroid(seed, size, chunkCount) {
    const rng = mulberry32(seed);
    const chunks = [];
    const R = size;
    const centers = [];
    for (let i = 0; i < chunkCount; i++) {
      const u = rng() * 2 - 1;
      const th = rng() * Math.PI * 2;
      const rr = R * Math.pow(rng(), 0.55) * 0.72;
      const sp = Math.sqrt(1 - u * u);
      centers.push([rr * sp * Math.cos(th), rr * u, rr * sp * Math.sin(th), R * (0.28 + rng() * 0.34)]);
    }
    for (let i = 0; i < centers.length; i++) {
      const c = centers[i];
      const v = new Voxels(500 + i + seed);
      const cr = c[3];
      const R2 = Math.ceil(cr) + 2;
      // near-surface extraction: keep a 2-3 voxel shell + irregular boundary + crack faces
      for (let x = -R2; x <= R2; x++) {
        for (let y = -R2; y <= R2; y++) {
          for (let z = -R2; z <= R2; z++) {
            const dist = Math.sqrt(x * x + y * y + z * z);
            const d = dist / cr;
            const wob = 0.09 * Math.sin(x * 0.30 + seed) + 0.07 * Math.cos(y * 0.36 - seed * 0.5) +
              0.06 * Math.sin(z * 0.33 + i * 1.3);
            const surf = d + wob;
            const crack = Math.abs(Math.sin(x * 0.22 + y * 0.19 + z * 0.24 + i * 1.7));
            const nearSurf = surf > 1.0 - 3.0 / cr && surf <= 1.03;
            const crackFace = crack < 0.08 && d > 0.40 && d < 1.0;
            if (!nearSurf && !crackFace) continue;
            let col;
            if (crack < 0.10) col = PAL.rockDark;
            else if (surf > 0.94) col = PAL.rockLight;
            else col = PAL.rock;
            const shade = 0.68 + 0.32 * clamp(1 - d, 0, 1);
            v.push(x, y, z, col[0] * shade, col[1] * shade, col[2] * shade, 0, 0.5 + (rng() - 0.5) * 0.12);
          }
        }
      }
      const dir = V3.norm([c[0] + (rng() - 0.5) * 0.6, c[1] + (rng() - 0.5) * 0.6, c[2] + (rng() - 0.5) * 0.6]);
      const speed = 6 + rng() * 14;
      chunks.push({
        voxels: v,
        center: [c[0], c[1], c[2]],
        radius: cr,
        breakVel: [dir[0] * speed, dir[1] * speed, dir[2] * speed],
        breakSpin: [(rng() - 0.5) * 1.2, (rng() - 0.5) * 1.2, (rng() - 0.5) * 1.2],
        breakDelay: rng() * 0.45,
        id: i
      });
    }
    return { chunks, radius: R, seed };
  }

  // small debris bits (for fine fracture spray)
  function buildDebrisBits(seed, count) {
    const rng = mulberry32(seed);
    const bits = [];
    for (let i = 0; i < count; i++) {
      const v = new Voxels(700 + i + seed);
      const s = 1 + Math.floor(rng() * 2);
      v.box(-s, -s, -s, s, s, s, [
        PAL.rock[0] * (0.8 + rng() * 0.4),
        PAL.rock[1] * (0.8 + rng() * 0.4),
        PAL.rock[2] * (0.8 + rng() * 0.4)
      ], 0, 0.2);
      const th = rng() * Math.PI * 2, ph = Math.acos(rng() * 2 - 1);
      const sp = 18 + rng() * 40;
      bits.push({
        voxels: v,
        vel: [Math.sin(ph) * Math.cos(th) * sp, Math.sin(ph) * Math.sin(th) * sp, Math.cos(ph) * sp],
        spin: [(rng() - 0.5) * 3, (rng() - 0.5) * 3, (rng() - 0.5) * 3],
        delay: rng() * 0.5
      });
    }
    return bits;
  }

  global.MODELS = {
    buildFlagship, buildEscort, buildVanguard, buildSmallCraft,
    buildAsteroid, buildDebrisBits, sectionAt, flagshipHullSections,
    FLAG_CARVES, inAnyCarve
  };
})(window);
