// World assembly: interiors, fleet formation, asteroids, dynamic state as f(t)
(function (global) {
  'use strict';
  const { Voxels, PAL, M4, V3, U, MODELS } = global;
  const { lerp, clamp, smoothstep, smootherstep, wrapDelta, mulberry32 } = U;

  const DUR = 78; // one loop in seconds

  // ===================== INTERIORS =====================
  // All interior builders return Voxels in flagship-local coordinates
  // (so they sit inside the hull carves).

  // ---- 2.6 舰桥: ~130 wide × 130 deep × 60 high ----
  function buildBridge() {
    const v = new Voxels(900);
    const X0 = 372, X1 = 516, Y0 = 58, Y1 = 112, Z0 = -52, Z1 = 52;
    // floor
    v.box(X0, Y0, Z0, X1, Y0 + 3, Z1, PAL.interior, 0, 0.1);
    // floor edge glow
    for (let z = Z0 + 4; z <= Z1 - 4; z += 8) {
      v.box(X0 + 4, Y0 + 3, z, X1 - 8, Y0 + 3, z + 2, PAL.interiorGlow, 0.7);
    }
    // ceiling
    v.box(X0, Y1 - 3, Z0, X1, Y1, Z1, PAL.interiorDark, 0, 0.1);
    // side walls (lower) + upper gallery
    for (const s of [-1, 1]) {
      v.box(X0, Y0, s * Z1 - s * 3, X1, Y0 + 18, Z1 * s, PAL.interior, 0, 0.1);
      // gallery platform
      v.box(X0 + 6, Y0 + 26, s * (Z1 - 26), X1 - 20, Y0 + 30, s * Z1, PAL.interior, 0, 0.1);
      // gallery rail
      v.box(X0 + 6, Y0 + 30, s * (Z1 - 26), X1 - 20, Y0 + 34, s * (Z1 - 23), PAL.interiorDark, 0);
      // consoles along both sides
      for (let x = X0 + 14; x < X1 - 24; x += 18) {
        v.box(x, Y0 + 4, s * (Z1 - 20), x + 10, Y0 + 14, s * (Z1 - 8), PAL.interiorDark, 0, 0.1);
        v.box(x + 1, Y0 + 14, s * (Z1 - 19), x + 9, Y0 + 17, s * (Z1 - 10), PAL.interiorGlow, 1.1);
        // upper consoles
        v.box(x + 2, Y0 + 30, s * (Z1 - 22), x + 9, Y0 + 38, s * (Z1 - 12), PAL.interiorDark, 0);
        v.box(x + 3, Y0 + 38, s * (Z1 - 21), x + 8, Y0 + 41, s * (Z1 - 13), PAL.interiorGlow, 1.0);
        // glowing screen panel above
        v.box(x + 2, Y0 + 18, s * (Z1 - 18), x + 8, Y0 + 27, s * (Z1 - 17), PAL.interiorGlow, 0.55);
      }
    }

    // ---- central command hub (layered base + suspended display) ----
    const cx = X0 + 62, cz = 0;
    v.box(cx - 22, Y0 + 3, cz - 22, cx + 22, Y0 + 10, cz + 22, PAL.interiorDark, 0, 0.1);
    v.box(cx - 16, Y0 + 10, cz - 16, cx + 16, Y0 + 18, cz + 16, PAL.interior, 0, 0.1);
    v.box(cx - 10, Y0 + 18, cz - 10, cx + 10, Y0 + 24, cz + 10, PAL.interiorDark, 0, 0.1);
    v.box(cx - 7, Y0 + 24, cz - 7, cx + 7, Y0 + 28, cz + 7, PAL.interiorGlow, 1.0);
    // suspended display structure (hollow ring + panels)
    v.box(cx - 16, Y0 + 40, cz - 16, cx + 16, Y0 + 43, cz + 16, PAL.interiorDark, 0);
    v.box(cx - 16, Y0 + 43, cz - 16, cx - 12, Y0 + 52, cz + 16, PAL.interior, 0);
    v.box(cx + 12, Y0 + 43, cz - 16, cx + 16, Y0 + 52, cz + 16, PAL.interior, 0);
    v.box(cx - 16, Y0 + 43, cz - 16, cx + 16, Y0 + 52, cz - 12, PAL.interior, 0);
    v.box(cx - 16, Y0 + 43, cz + 12, cx + 16, Y0 + 52, cz + 16, PAL.interior, 0);
    // glowing display panels (facing inward)
    for (const s of [-1, 1]) {
      v.box(cx - 11, Y0 + 44, s * 12, cx + 11, Y0 + 51, s * 13, PAL.interiorGlow, 0.9);
      v.box(s * 12 + cx, Y0 + 44, cz - 11, s * 13 + cx, Y0 + 51, cz + 11, PAL.interiorGlow, 0.75);
    }
    // vertical light column
    for (let y = Y0 + 28; y < Y0 + 40; y += 2) {
      v.box(cx - 3, y, cz - 3, cx + 3, y + 1, cz + 3, PAL.interiorGlow, 1.2);
    }

    // ---- overhead beams crossing the hall ----
    for (let x = X0 + 20; x < X1 - 10; x += 30) {
      v.box(x, Y1 - 22, Z0 + 2, x + 5, Y1 - 8, Z1 - 2, PAL.interiorDark, 0, 0.1);
      v.box(x + 1, Y1 - 8, Z0 + 6, x + 4, Y1 - 5, Z1 - 6, PAL.interior, 0);
    }
    // hanging display boards
    for (let x = X0 + 30; x < X1 - 20; x += 36) {
      v.box(x, Y1 - 34, -12, x + 18, Y1 - 30, 12, PAL.interiorDark, 0);
      v.box(x + 1, Y1 - 33, -10, x + 17, Y1 - 31, 10, PAL.interiorGlow, 0.8);
    }

    // ---- forward viewport: open at X1 side, with frame mullions ----
    // frame top/bottom
    v.box(X1 - 6, Y0 + 3, Z0, X1, Y0 + 10, Z1, PAL.interior, 0, 0.1);
    v.box(X1 - 6, Y1 - 12, Z0, X1, Y1, Z1, PAL.interior, 0, 0.1);
    // mullions
    for (const z of [-38, -14, 14, 38]) {
      v.box(X1 - 8, Y0 + 10, z - 2, X1, Y1 - 12, z + 2, PAL.interiorDark, 0);
    }
    // frame side columns
    for (const s of [-1, 1]) {
      v.box(X1 - 10, Y0 + 3, s * (Z1 - 6), X1, Y1 - 6, Z1 * s, PAL.interiorDark, 0, 0.1);
    }
    // viewport glow edge
    for (let y = Y0 + 10; y < Y1 - 12; y += 6) {
      v.push(X1 - 3, y, Z0 + 2, PAL.interiorGlow[0], PAL.interiorGlow[1], PAL.interiorGlow[2], 0.7, 0.5);
      v.push(X1 - 3, y, Z1 - 2, PAL.interiorGlow[0], PAL.interiorGlow[1], PAL.interiorGlow[2], 0.7, 0.5);
    }

    return v;
  }

  // ---- 2.7 动力核心中庭: ~250 × 250 × 250 ----
  function buildReactor() {
    const v = new Voxels(901);
    const X0 = -55, X1 = 195, Y0 = -118, Y1 = 125, Z0 = -118, Z1 = 118;
    const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2, cz = 0;

    // ---- outer walls (thick panels + pillars) ----
    for (let x = X0; x <= X1; x += 2) {
      for (const s of [-1, 1]) {
        // solid side walls with periodic pillar bumps
        v.box(x, Y0, s * Z0, x + 1, Y1, s * (Z0 + 4), PAL.interiorDark, 0, 0.1);
        if (x % 18 < 2) {
          v.box(x, Y0, s * (Z0 + 4), x + 3, Y1, s * (Z0 + 12), PAL.interior, 0, 0.1);
        }
      }
    }
    // end walls
    v.box(X0, Y0, Z0, X0 + 5, Y1, Z1, PAL.interiorDark, 0, 0.1);
    v.box(X1 - 5, Y0, Z0, X1, Y1, Z1, PAL.interiorDark, 0, 0.1);
    // ceiling & floor
    v.box(X0, Y1 - 4, Z0, X1, Y1, Z1, PAL.interiorDark, 0, 0.1);
    v.box(X0, Y0, Z0, X1, Y0 + 4, Z1, PAL.interiorDark, 0, 0.1);

    // ---- multi-level ring platforms (5 levels) ----
    const levels = [-96, -48, 0, 48, 96];
    for (let li = 0; li < levels.length; li++) {
      const y = levels[li];
      // ring platform (hollow, around core)
      const rIn = 58, rOut = 108;
      // build ring as 4 slabs (square ring, stepped)
      v.box(cx - rOut, y, cz - rOut, cx + rOut, y + 4, cz - rIn, PAL.interior, 0, 0.1);
      v.box(cx - rOut, y, cz + rIn, cx + rOut, y + 4, cz + rOut, PAL.interior, 0, 0.1);
      v.box(cx - rOut, y, cz - rIn, cx - rIn, y + 4, cz + rIn, PAL.interior, 0, 0.1);
      v.box(cx + rIn, y, cz - rIn, cx + rOut, y + 4, cz + rIn, PAL.interior, 0, 0.1);
      // edge glow
      for (let x = cx - rIn; x <= cx + rIn; x += 6) {
        v.push(x, y + 4, cz - rIn, PAL.interiorGlow[0], PAL.interiorGlow[1], PAL.interiorGlow[2], 0.55, 0.5);
        v.push(x, y + 4, cz + rIn, PAL.interiorGlow[0], PAL.interiorGlow[1], PAL.interiorGlow[2], 0.55, 0.5);
      }
      for (let z = cz - rIn; z <= cz + rIn; z += 6) {
        v.push(cx - rIn, y + 4, z, PAL.interiorGlow[0], PAL.interiorGlow[1], PAL.interiorGlow[2], 0.55, 0.5);
        v.push(cx + rIn, y + 4, z, PAL.interiorGlow[0], PAL.interiorGlow[1], PAL.interiorGlow[2], 0.55, 0.5);
      }
      // railings
      for (let x = cx - rIn; x <= cx + rIn; x += 8) {
        v.push(x, y + 8, cz - rIn, PAL.interior[0], PAL.interior[1], PAL.interior[2], 0, 0.5);
        v.push(x, y + 8, cz + rIn, PAL.interior[0], PAL.interior[1], PAL.interior[2], 0, 0.5);
      }
    }

    // ---- massive supports from walls to core ----
    for (let li = 0; li < levels.length; li++) {
      const y = levels[li] + 20;
      for (const s of [-1, 1]) {
        v.box(cx - 96, y, s * 70, cx - 40, y + 10, s * 82, PAL.interior, 0, 0.1);
        v.box(cx + 40, y, s * 70, cx + 96, y + 10, s * 82, PAL.interior, 0, 0.1);
        v.box(cx - 60, y, s * 56, cx - 40, y + 8, s * 82, PAL.interiorDark, 0);
        v.box(cx + 40, y, s * 56, cx + 60, y + 8, s * 82, PAL.interiorDark, 0);
      }
    }

    // ---- central core: outer frame (dark) + glowing inner column ----
    const cr = 30;
    for (let y = Y0 + 12; y < Y1 - 12; y += 2) {
      const phase = (y * 0.06) % (Math.PI * 2);
      // outer frame: octagonal dark ribs
      for (let a = 0; a < 8; a++) {
        const th = a / 8 * Math.PI * 2 + phase * 0.12;
        const px = Math.round(Math.cos(th) * cr);
        const pz = Math.round(Math.sin(th) * cr);
        v.push(cx + px, y, cz + pz, PAL.interior[0], PAL.interior[1], PAL.interior[2], 0, 0.5);
        v.push(cx + px, y, cz + pz + Math.sign(pz || 1), PAL.interiorDark[0], PAL.interiorDark[1], PAL.interiorDark[2], 0, 0.5);
      }
      // ring connectors every 8 units
      if (y % 8 === 0) {
        for (let a = 0; a < 16; a++) {
          const th = a / 16 * Math.PI * 2;
          const px = Math.round(Math.cos(th) * cr);
          const pz = Math.round(Math.sin(th) * cr);
          v.push(cx + px, y, cz + pz, PAL.interiorDark[0], PAL.interiorDark[1], PAL.interiorDark[2], 0, 0.5);
        }
      }
      // inner glowing column (regular, bright)
      if (y % 2 === 0) {
        const glow = 1.0 + 0.5 * Math.sin(y * 0.10);
        for (let dx = -5; dx <= 5; dx += 2) {
          for (let dz = -5; dz <= 5; dz += 2) {
            if (dx * dx + dz * dz > 30) continue;
            v.push(cx + dx, y, cz + dz, PAL.interiorGlow[0], PAL.interiorGlow[1], PAL.interiorGlow[2], glow, 0.5);
          }
        }
      }
    }

    // ---- rotating ring bands (clean flat rings at 4 heights) ----
    const bands = [
      { y: -62, R: 46, w: 3 },
      { y: -12, R: 50, w: 4 },
      { y: 40, R: 44, w: 3 },
      { y: 86, R: 38, w: 3 }
    ];
    for (let bi = 0; bi < bands.length; bi++) {
      const b = bands[bi];
      for (let a = 0; a < 64; a++) {
        if ((a + bi * 5) % 9 === 0) continue; // periodic gaps
        const th = a / 64 * Math.PI * 2;
        const px = Math.round(Math.cos(th) * b.R);
        const pz = Math.round(Math.sin(th) * b.R);
        // flat band of voxels
        for (let w = -b.w; w <= b.w; w++) {
          const qx = Math.round(Math.cos(th) * (b.R + w));
          const qz = Math.round(Math.sin(th) * (b.R + w));
          v.push(cx + qx, b.y, cz + qz, PAL.interior[0], PAL.interior[1], PAL.interior[2], 0, 0.5);
          if (Math.abs(w) === b.w) {
            v.push(cx + qx, b.y + 1, cz + qz, PAL.interiorDark[0], PAL.interiorDark[1], PAL.interiorDark[2], 0, 0.5);
          }
        }
        if (a % 4 === 0) {
          v.push(cx + px, b.y + 1, cz + pz, PAL.interiorGlow[0], PAL.interiorGlow[1], PAL.interiorGlow[2], 0.9, 0.5);
        }
      }
    }

    // ---- hanging abstract machines (structured panels, fewer) ----
    const rng = mulberry32(55);
    for (let i = 0; i < 6; i++) {
      const x = X0 + 50 + rng() * (X1 - X0 - 100);
      const z = (rng() > 0.5 ? 1 : -1) * (70 + rng() * 30);
      const y = Y0 + 40 + rng() * (Y1 - Y0 - 80);
      const sx = 20 + Math.floor(rng() * 16);
      v.box(x, y, z - 8, x + sx, y + 22, z + 8, PAL.interiorDark, 0, 0.1);
      v.box(x + 3, y + 3, z - 5, x + sx - 3, y + 19, z + 5, PAL.interior, 0);
      v.box(x + 5, y + 6, z - 3, x + sx - 5, y + 16, z + 3, PAL.interiorGlow, 0.75);
    }

    return v;
  }

  // ---- 2.8 贯通式机库: ~360 long × 100 wide × 80 high ----
  function buildHangar() {
    const v = new Voxels(902);
    const X0 = -415, X1 = -55, Y0 = -55, Y1 = 42, Z0 = 48, Z1 = 158;
    // floor with guide lights
    v.box(X0, Y0, Z0, X1, Y0 + 3, Z1, PAL.interior, 0, 0.1);
    for (let x = X0 + 8; x < X1 - 8; x += 14) {
      v.box(x, Y0 + 3, Z0 + 20, x + 3, Y0 + 3, Z1 - 20, PAL.interiorGlow, 0.55);
    }
    // ceiling (darker, with beams)
    v.box(X0, Y1 - 3, Z0, X1, Y1, Z1, PAL.interiorDark, 0, 0.1);
    for (let x = X0 + 10; x < X1; x += 26) {
      v.box(x, Y1 - 18, Z0 + 2, x + 5, Y1 - 3, Z1 - 2, PAL.interiorDark, 0, 0.1);
    }
    // inner wall (z = Z0 side) with parked alcoves
    v.box(X0, Y0, Z0, X1, Y1, Z0 + 4, PAL.interior, 0, 0.1);
    for (let x = X0 + 16; x < X1 - 30; x += 34) {
      // alcove recess
      v.box(x, Y0 + 3, Z0 + 4, x + 18, Y0 + 26, Z0 + 14, PAL.interiorDark, 0);
      v.box(x + 2, Y0 + 26, Z0 + 4, x + 16, Y0 + 28, Z0 + 12, PAL.interiorGlow, 0.5);
      // cradle marks
      v.box(x + 3, Y0 + 3, Z0 + 14, x + 6, Y0 + 5, Z0 + 20, PAL.interiorDark, 0);
      v.box(x + 12, Y0 + 3, Z0 + 14, x + 15, Y0 + 5, Z0 + 20, PAL.interiorDark, 0);
    }
    // outer side (z = Z1) is the opening side: only low wall + frame posts
    v.box(X0, Y0, Z1 - 4, X1, Y0 + 12, Z1, PAL.interior, 0, 0.1);
    for (let x = X0 + 12; x < X1; x += 40) {
      v.box(x, Y0, Z1 - 6, x + 6, Y1, Z1, PAL.interiorDark, 0, 0.1);
    }
    // bridge frames crossing overhead (3 spans)
    for (const bx of [-330, -230, -130]) {
      v.box(bx, Y0 + 30, Z0 + 6, bx + 10, Y0 + 42, Z1 - 6, PAL.interiorDark, 0, 0.1);
      v.box(bx + 2, Y0 + 42, Z0 + 10, bx + 8, Y0 + 45, Z1 - 10, PAL.interior, 0);
      // glow strip on bridge
      v.box(bx + 1, Y0 + 30, Z0 + 8, bx + 9, Y0 + 32, Z1 - 8, PAL.interiorGlow, 0.5);
    }
    // maintenance arms (abstract)
    for (const mx of [-280, -180, -80]) {
      for (const s of [-1, 1]) {
        v.box(mx, Y0 + 8, Z0 + 8, mx + 14, Y0 + 16, Z0 + 26, PAL.interiorDark, 0);
        v.box(mx + 2, Y0 + 16, Z0 + 16, mx + 6, Y0 + 40, Z0 + 20, PAL.interior, 0);
        v.box(mx + 3, Y0 + 40, Z0 + 12, mx + 5, Y0 + 44, Z0 + 28, PAL.interiorGlow, 0.6);
      }
    }
    // far second hatch (end of hangar, receding)
    v.box(X0, Y0, Z0, X0 + 10, Y1, Z1, PAL.interiorDark, 0, 0.1);
    v.box(X0 + 10, Y0 + 10, Z0 + 16, X0 + 12, Y1 - 12, Z1 - 16, PAL.interiorGlow, 0.65);
    // parked small craft in alcoves (static, for scale)
    for (let i = 0; i < 4; i++) {
      const px = -370 + i * 72;
      const pz = Z0 + 26;
      const py = Y0 + 6;
      // simple craft silhouette: body + nose + engines
      v.box(px - 12, py, pz - 5, px + 8, py + 6, pz + 5, PAL.hull, 0, 0.12);
      v.box(px + 8, py + 1, pz - 2, px + 15, py + 5, pz + 2, PAL.hullLight, 0, 0.12);
      v.box(px - 13, py + 1, pz - 3, px - 10, py + 5, pz + 3, PAL.glowAmberDim, 0.55);
      v.box(px - 4, py + 6, pz - 2, px + 3, py + 8, pz + 2, PAL.hullDark, 0);
    }
    // near end (toward bow) partial bulkhead with opening
    v.box(X1 - 8, Y0, Z0, X1, Y1, Z0 + 22, PAL.interiorDark, 0, 0.1);
    v.box(X1 - 8, Y0, Z1 - 22, X1, Y1, Z1, PAL.interiorDark, 0, 0.1);
    v.box(X1 - 8, Y0, Z0 + 22, X1, Y0 + 12, Z1 - 22, PAL.interiorDark, 0);
    v.box(X1 - 8, Y1 - 14, Z0 + 22, X1, Y1, Z1 - 22, PAL.interiorDark, 0);

    return v;
  }

  // ---- 2.8 能量装填与导能长廊: ~350 long × 110 wide × 70 high ----
  function buildCorridor() {
    const v = new Voxels(903);
    const X0 = -445, X1 = -95, Y0 = -105, Y1 = -32, Z0 = -62, Z1 = 62;
    // floor
    v.box(X0, Y0, Z0, X1, Y0 + 3, Z1, PAL.interiorDark, 0, 0.1);
    // central guide channel glow
    v.box(X0 + 4, Y0 + 3, -6, X1 - 4, Y0 + 3, 6, PAL.interiorGlow, 0.7);
    // ceiling
    v.box(X0, Y1 - 3, Z0, X1, Y1, Z1, PAL.interiorDark, 0, 0.1);
    // side walls
    for (const s of [-1, 1]) {
      v.box(X0, Y0, s * Z0, X1, Y1, s * (Z0 + 3), PAL.interiorDark, 0, 0.1);
    }

    // ---- rows of tall loading devices on both sides ----
    for (let x = X0 + 16; x < X1 - 30; x += 30) {
      for (const s of [-1, 1]) {
        const z = s * 34;
        // heavy outer frame
        v.box(x, Y0 + 3, z - 12, x + 16, Y1 - 8, z + 12, PAL.interior, 0, 0.1);
        v.box(x + 2, Y0 + 5, z - 9, x + 14, Y1 - 12, z + 9, PAL.interiorDark, 0);
        // inner bright core
        v.box(x + 5, Y0 + 8, z - 5, x + 11, Y1 - 18, z + 5, PAL.interiorGlow, 1.1);
        // slot rows (dark slots)
        for (let y = Y0 + 12; y < Y1 - 20; y += 8) {
          v.box(x + 3, y, z - 11, x + 13, y + 3, z - 9, PAL.deep, 0);
          v.box(x + 3, y, z + 9, x + 13, y + 3, z + 11, PAL.deep, 0);
        }
      }
    }

    // ---- big frame portals crossing the corridor every ~60 ----
    for (let x = X0 + 30; x < X1 - 20; x += 60) {
      v.box(x, Y0, Z0, x + 8, Y1, Z0 + 10, PAL.interior, 0, 0.1);
      v.box(x, Y0, Z1 - 10, x + 8, Y1, Z1, PAL.interior, 0, 0.1);
      v.box(x, Y1 - 14, Z0, x + 8, Y1, Z1, PAL.interior, 0, 0.1);
      v.box(x + 1, Y0 + 3, Z0 + 3, x + 7, Y0 + 5, Z1 - 3, PAL.interiorGlow, 0.5);
    }

    // ---- suspended energy conduits (upper) ----
    for (const s of [-1, 1]) {
      for (let x = X0 + 10; x < X1 - 10; x += 4) {
        if (x % 12 < 4) {
          v.push(x, Y1 - 8, s * 18, PAL.interiorGlow[0], PAL.interiorGlow[1], PAL.interiorGlow[2], 0.9, 0.5);
          v.push(x, Y1 - 10, s * 22, PAL.interiorGlow[0], PAL.interiorGlow[1], PAL.interiorGlow[2], 0.5, 0.5);
        }
      }
    }

    // ---- far glowing chamber mouth ----
    v.box(X0, Y0, Z0, X0 + 8, Y1, Z1, PAL.interiorDark, 0, 0.1);
    v.box(X0 + 8, Y0 + 6, Z0 + 12, X0 + 10, Y1 - 6, Z1 - 12, PAL.interiorGlow, 1.3);

    return v;
  }

  // ===================== FLEET =====================
  function buildFleet() {
    const flag = MODELS.buildFlagship();
    const escorts = [];
    const vanguards = [];
    const craft = MODELS.buildSmallCraft();

    // escort formation: sides, rear, different heights
    const escortPos = [
      [220, 60, -320, 0.06, -0.02],
      [140, -40, -360, 0.10, 0.03],
      [-80, 80, -330, 0.02, -0.05],
      [-260, 20, -350, -0.04, 0.02],
      [220, 60, 320, -0.06, 0.02],
      [140, -40, 360, -0.10, -0.03],
      [-80, 80, 330, -0.02, 0.05],
      [-260, 20, 350, 0.04, -0.02],
      [-420, -60, -240, 0.12, 0.04],
      [-440, -70, 250, -0.12, -0.04],
      [-380, 120, -200, 0.08, -0.08],
      [-380, 120, 210, -0.08, 0.08]
    ];
    for (let i = 0; i < escortPos.length; i++) {
      escorts.push(MODELS.buildEscort(i));
    }

    // vanguard formation: ahead and outer
    const vanguardPos = [
      [700, 30, -180, 0.08, 0.0], [820, -20, -420, 0.14, -0.04],
      [900, 60, -700, 0.10, 0.02], [760, -50, 200, -0.08, 0.02],
      [860, 20, 460, -0.12, -0.02], [950, 70, 760, -0.10, 0.05],
      [1150, -30, -300, 0.18, 0.0], [1250, 40, -620, 0.15, -0.03],
      [1200, -60, 320, -0.16, 0.02], [1320, 20, 640, -0.14, -0.02],
      [1500, 10, -100, 0.20, 0.01], [1550, -40, 250, -0.18, -0.01]
    ];
    for (let i = 0; i < vanguardPos.length; i++) {
      vanguards.push(MODELS.buildVanguard(i));
    }

    return { flag, escorts, vanguards, craft, escortPos, vanguardPos };
  }

  // ===================== ASTEROID FIELD =====================
  function buildAsteroidField() {
    // cluster A (battle target) ahead-left of fleet; cluster B far ahead (loop scenery)
    const targets = [];
    // 3 big targets
    const bigDefs = [
      { pos: [2100, 120, -520], size: 105, chunks: 9, seed: 11 },
      { pos: [2350, -80, 260], size: 92, chunks: 8, seed: 22 },
      { pos: [2550, 180, -180], size: 80, chunks: 7, seed: 33 }
    ];
    for (let i = 0; i < bigDefs.length; i++) {
      const d = bigDefs[i];
      const ast = MODELS.buildAsteroid(d.seed, d.size, d.chunks);
      targets.push({ ...ast, pos: d.pos, id: i });
    }
    // medium/small rocks scattered around (not fractured)
    const rng = mulberry32(909);
    const rocks = [];
    for (let i = 0; i < 16; i++) {
      const r = 16 + rng() * 28;
      const ast = MODELS.buildAsteroid(200 + i, r, 3);
      rocks.push({
        ...ast,
        pos: [
          1500 + rng() * 1600,
          (rng() - 0.5) * 700,
          (rng() - 0.5) * 1400
        ],
        id: 100 + i
      });
    }
    // far cluster for loop scenery (not destroyed)
    const farRocks = [];
    for (let i = 0; i < 8; i++) {
      const r = 28 + rng() * 42;
      const ast = MODELS.buildAsteroid(400 + i, r, 4);
      farRocks.push({
        ...ast,
        pos: [4200 + rng() * 2200, (rng() - 0.5) * 900, (rng() - 0.5) * 2000],
        id: 200 + i
      });
    }
    // debris bits for hits
    const debris = [];
    for (let i = 0; i < 3; i++) {
      debris.push(MODELS.buildDebrisBits(30 + i, 26));
    }
    return { targets, rocks, farRocks, debris };
  }

  // ===================== DYNAMIC STATE =====================
  // Everything is a pure function of global time t ∈ [0, DUR).

  // Engine thrust factor (wraps: boost at end continues into start)
  function thrustAt(t) {
    // base 0.55, boost ramps 72→75 to 1.0, decays through loop back to 0.55
    const dt = wrapDelta(72, t, DUR);          // seconds since boost start (wrapped)
    let boost;
    if (dt < 3) boost = smootherstep(0, 3, dt);
    else boost = Math.exp(-(dt - 3) * 0.12);
    return 0.55 + 0.55 * boost;
  }

  // Shield activation / fade — staggered per ship, wrap-around fade so loop is seamless
  function shieldState(t, shipIndex, shipCount) {
    const start = 72.2 + shipIndex * 0.16;
    const dt = wrapDelta(start, t, DUR);
    if (dt > 16) return { alpha: 0, expand: 0 };
    const expand = smootherstep(0, 1.6, dt);
    const fadeIn = smootherstep(0, 1.2, dt);
    const fadeOut = 1 - smoothstep(2.5, 13, dt);
    return { alpha: fadeIn * fadeOut * 0.5, expand };
  }

  // Small craft flight paths (periodic over DUR)
  function craftState(t, i) {
    const n = 6;
    const phase = (t / DUR + i / n) % 1;
    // loop: exit hangar → fly alongside → return
    // local path relative to flagship
    const p = phase;
    let pos, glow;
    if (p < 0.45) {
      // launch out from hangar
      const u = p / 0.45;
      const e = smootherstep(0, 1, u);
      pos = [
        lerp(-220, -40, e) + Math.sin(u * 6 + i) * 18,
        lerp(-4, 30, e) + Math.sin(u * 4 + i * 2) * 22,
        lerp(160, 320 + i * 26, e)
      ];
      glow = 1;
    } else if (p < 0.75) {
      // alongside flight
      const u = (p - 0.45) / 0.30;
      pos = [
        lerp(-40, 260, u) + Math.sin(u * 5 + i) * 14,
        30 + Math.sin(u * 3.5 + i * 1.7) * 36,
        320 + i * 26 - u * 90
      ];
      glow = 1;
    } else {
      // return to hangar
      const u = (p - 0.75) / 0.25;
      const e = smootherstep(0, 1, u);
      pos = [
        lerp(260, -220, e),
        lerp(30, -4, e) + Math.sin(u * 3) * 12 * (1 - e),
        lerp(320 + i * 26 - 90, 160, e)
      ];
      glow = 1;
    }
    // gentle roll
    const rot = [Math.sin(phase * 6.28 + i) * 0.35, Math.sin(phase * 4.2 + i * 1.3) * 0.5, Math.sin(phase * 5.1 + i * 0.7) * 0.4];
    return { pos, rot, glow };
  }

  // Asteroid chunk separation as f(t)
  // hitTimes per target: beam hits big 0 at 56.6; pulses hit 0/1 at 62-65; missiles hit 1/2 at 66-71
  const HIT_SCHEDULE = {
    // targetId: { tBreak, beam: bool }
    0: { tBreak: 58.4, beam: true },
    1: { tBreak: 64.0, beam: false },
    2: { tBreak: 69.2, beam: false }
  };

  function chunkTransform(targetId, chunk, t) {
    const sched = HIT_SCHEDULE[targetId];
    if (!sched) return { pos: chunk.center, rot: [0, 0, 0], broken: 0 };
    const dt = t - (sched.tBreak + chunk.breakDelay);
    if (dt <= 0) return { pos: chunk.center, rot: [0, 0, 0], broken: 0 };
    const broken = clamp(dt / 0.6, 0, 1);
    // ease-out drift
    const k = 1 - Math.exp(-dt * 0.55);
    const pos = [
      chunk.center[0] + chunk.breakVel[0] * k * 8,
      chunk.center[1] + chunk.breakVel[1] * k * 8,
      chunk.center[2] + chunk.breakVel[2] * k * 8
    ];
    const rot = [
      chunk.breakSpin[0] * dt,
      chunk.breakSpin[1] * dt,
      chunk.breakSpin[2] * dt
    ];
    return { pos, rot, broken };
  }

  global.WORLD = {
    DUR,
    buildBridge, buildReactor, buildHangar, buildCorridor,
    buildFleet, buildAsteroidField,
    thrustAt, shieldState, craftState, chunkTransform, HIT_SCHEDULE
  };
})(window);
