// ============================================================================
// 06_interiors.js
// Procedural 1x1x1 Voxel Builders for the 4 Flagship Conceptual Interiors:
//   1. Through-Deck Shuttle Hangar (384 x 98 x 68) + Abstract Clamps
//   2. Power Core Atrium (256 x 264 x 256) + 4 Rotating Voxel Rings
//   3. Energy Loading & Conduction Corridor (368 x 104 x 76) + Loader Jaws & Energy Blocks
//   4. Wide Command Bridge (136 x 140 x 64) + Live 3D Voxel Fleet Hologram
// ============================================================================
(function (global) {
  'use strict';

  const SF = (global.StarFleet = global.StarFleet || {});
  const { ChunkVoxelGrid, meshVoxelGrid } = SF.Voxel;
  const M = SF.MAT;

  // ==========================================================================
  // 1. THROUGH-DECK SHUTTLE HANGAR (Length = 384 along Z: Z = -310 .. +74,
  //    Width = 96 along X: X = -48 .. +48, Height = 62 along Y: Y = -22 .. +40)
  //    Embedded directly inside the Flagship at (-68, 0, 0) so X_local = -48
  //    (Flagship X = -116) opens straight out the 132-wide Port Hangar Mouth
  //    (Z = -286 .. -154) into space!
  // ==========================================================================
  function buildThroughHangar() {
    const g = new ChunkVoxelGrid();
    const berths = [];
    const maintMountCoords = [];

    // Floor deck (Y = -22 .. -18, Z = -310 .. +74, X = -48 .. +48)
    g.fillBox(-48, -22, -310, 48, -18, 74, M.DECK_DARK);
    // Central recessed flight runway & glowing cyan/azure guide strips along Z!
    g.fillBox(-15, -18, -302, 15, -17, 68, M.STRUCT_DARK);
    g.fillBox(-14, -17, -300, -12, -17, 66, M.EMIT_CYAN_SOFT);
    g.fillBox( 12, -17, -300,  14, -17, 66, M.EMIT_CYAN_SOFT);
    // Runway centerline chevrons converging toward the far +Z portal
    for (let z = -292; z <= 54; z += 22) {
      g.fillBox(-2, -17, z, 2, -17, z + 10, M.EMIT_AZURE_DEEP);
    }
    // Side approach guide strips leading from the Port Side Mouth (X = -48, Z = -286..-154) onto the runway!
    for (let z = -270; z <= -172; z += 26) {
      g.fillBox(-48, -17, z, -14, -17, z + 4, M.EMIT_CYAN_BRIGHT);
    }

    // Dark vaulted upper ceiling & heavy transverse roof ribs (Y = +28 .. +40)
    g.fillBox(-48, 36, -310, 48, 40, 74, M.TRENCH_ABYSS);
    g.fillBox(-48, 31, -152, -28, 36, 74, M.STRUCT_DARK);
    g.fillBox( 28, 31, -310,  48, 36, 74, M.STRUCT_DARK);
    for (let z = -296; z <= 58; z += 32) {
      g.fillBox(-46, 29, z - 3, 46, 36, z + 3, M.RIB_STEEL);
      g.fillBox(-20, 28, z - 2, 20, 30, z + 2, M.EMIT_CYAN_SOFT);
      // Glowing upper inner wall panels
      g.fillBox( 44, 22, z + 8, 47, 29, z + 22, M.HULL_MID);
      g.fillBox( 43, 24, z + 10, 44, 27, z + 20, M.EMIT_AZURE_DEEP);
      if (z > -150) {
        g.fillBox(-47, 22, z + 8, -44, 29, z + 22, M.HULL_MID);
        g.fillBox(-44, 24, z + 10, -43, 27, z + 20, M.EMIT_AZURE_DEEP);
      }
    }

    // Aft End Bulkhead (Z = -312 .. -306) & Side Enclosing Walls (leaving Port Mouth X = -48, Z = -286..-154 wide open!)
    g.fillBox(-48, -18, -312, 48, 38, -306, M.STRUCT_DARK);
    g.fillBox(-24, -10, -306, 24, 20, -303, M.HULL_MID);
    g.fillBox(-18, -4, -303, 18, 14, -302, M.EMIT_AZURE_DEEP);

    // Starboard inner wall (+X = +45..+48, continuous along all 384 voxels)
    g.fillBox(45, -18, -310, 48, 38, 74, M.STRUCT_DARK);
    // Port outer wall (-X = -48..-45, open across Z = -286 .. -154!)
    g.fillBox(-48, -18, -310, -45, 38, -286, M.STRUCT_DARK);
    g.fillBox(-48, -18, -154, -45, 38,   74, M.STRUCT_DARK);

    // Recessed Docking Alcoves along BOTH sides:
    // +X wall has 7 berths from Z = -298 .. +44; -X wall has 4 berths forward of mouth from Z = -148 .. +44!
    for (let i = 0; i <= 7; i++) {
      const pz = -300 + i * 48;
      // +X pier
      g.fillBox(23, -17, pz - 4, 45, 22, pz + 4, M.HULL_PRIMARY);
      g.fillBox(22, -17, pz - 2, 25, 19, pz + 2, M.TRIM_OCHRE);
      g.fillBox(22, -11, pz - 1, 23, 14, pz + 1, M.EMIT_CYAN_SOFT);

      // -X pier (only forward of Port Side Mouth, i >= 3 -> pz >= -156)
      if (pz >= -154) {
        g.fillBox(-45, -17, pz - 4, -23, 22, pz + 4, M.HULL_PRIMARY);
        g.fillBox(-25, -17, pz - 2, -22, 19, pz + 2, M.TRIM_OCHRE);
        g.fillBox(-23, -11, pz - 1, -22, 14, pz + 1, M.EMIT_CYAN_SOFT);
      }

      if (i < 7) {
        const bz = pz + 24;
        // +X berth pad
        g.fillBox(26, -17, bz - 15, 43, -16, bz + 15, M.DECK_MARK);
        g.fillBox(28, -16, bz - 12, 29, -16, bz + 12, M.EMIT_AMBER_SOFT);
        g.fillBox(43, -8, bz - 10, 45, 6, bz + 10, M.EMIT_AZURE_DEEP);
        berths.push({ pos: [34, -13, bz], side: 1, index: i });
        if (i % 2 === 1) maintMountCoords.push({ pos: [29, 12, bz], side: 1 });

        // -X berth pad (for berths forward of mouth: bz > -140)
        if (bz > -140) {
          g.fillBox(-43, -17, bz - 15, -26, -16, bz + 15, M.DECK_MARK);
          g.fillBox(-29, -16, bz - 12, -28, -16, bz + 12, M.EMIT_AMBER_SOFT);
          g.fillBox(-45, -8, bz - 10, -43, 6, bz + 10, M.EMIT_AZURE_DEEP);
          berths.push({ pos: [-34, -13, bz], side: -1, index: i });
          if (i % 2 === 0) maintMountCoords.push({ pos: [-29, 12, bz], side: -1 });
        }
      }
    }

    // 3 Spanning Overhead Gantry Bridges dividing the 384-voxel Hangar into monumental bays!
    // Positioned at Y = +14 .. +23 so lower flight lane Y = -16 .. +12 (28 voxels high!) is 100% clear!
    for (const gz of [-195, -96, -4]) {
      g.fillBox(-44, 14, gz - 7, 44, 23, gz + 7, M.HULL_MID);
      g.fillBox(-34, 17, gz - 9, 34, 21, gz + 9, M.STRUCT_DARK);
      g.carveBox(-14, 13, gz - 8, 14, 16, gz + 8);
      g.fillBox(-16, 16, gz - 5, 16, 17, gz + 5, M.TRIM_OCHRE);
      g.fillBox(-12, 15, gz - 3, 12, 16, gz + 3, M.EMIT_CYAN_BRIGHT);
    }

    // Deep Secondary Inner Bay Portal & Far Glowing Continuation Chamber at +Z (Z = +42 .. +96)!
    g.fillBox(-46, -17, 42, -19, 36, 56, M.HULL_PRIMARY);
    g.fillBox( 19, -17, 42,  46, 36, 56, M.HULL_PRIMARY);
    g.fillBox(-19,  19, 42,  19, 36, 56, M.HULL_PRIMARY);
    g.fillBox(-21, -17, 40, -18, 21, 44, M.TRIM_OCHRE);
    g.fillBox( 18, -17, 40,  21, 21, 44, M.TRIM_OCHRE);
    g.fillBox(-21,  18, 40,  21, 21, 44, M.TRIM_OCHRE);
    // Beyond the second portal (Z = +56 .. +96): open continuation bay with structural rib arches & radiant guide rails!
    g.shellBox(-34, -20, 56, 34, 30, 96, 3, M.STRUCT_DARK);
    g.carveBox(-30, -17, 54, 30, 26, 92);
    for (let z = 62; z <= 86; z += 12) {
      g.fillSymX(24, -17, z, 30, 25, z + 4, M.RIB_STEEL);
      g.fillBox(-30, 21, z, 30, 26, z + 4, M.RIB_STEEL);
      g.fillSymX(26, -12, z + 5, 29, 18, z + 9, M.EMIT_CYAN_BRIGHT);
      g.fillBox(-14, 22, z + 5, 14, 24, z + 8, M.EMIT_CYAN_SOFT);
    }
    g.fillBox(-14, -17, 56, -11, -16, 91, M.EMIT_CYAN_BRIGHT);
    g.fillBox( 11, -17, 56,  14, -16, 91, M.EMIT_CYAN_BRIGHT);
    g.fillBox(-3,  -17, 58,   3, -16, 88, M.EMIT_AMBER_SOFT);
    // Deep inner airlock/reactor bulkhead with glowing portal slits at Z = +92
    g.fillBox(-26, -15, 91, 26, 22, 93, M.HULL_MID);
    g.fillSymX(16, -12, 90, 20, 16, 92, M.TRIM_OCHRE);
    g.fillBox(-12, -8, 90, 12, 12, 92, M.EMIT_WHITE_CYAN);

    return {
      mesh: meshVoxelGrid(g),
      berths,
      maintMountCoords
    };
  }

  // Abstract Non-Humanoid Voxel Maintenance Rig (articulating geometric gantry clamp, voxelSize = 1.0)
  function buildHangarMaintArm() {
    const g = new ChunkVoxelGrid();
    // Sliding carriage block
    g.fillBox(-4, -2, -5, 4, 4, 5, M.STRUCT_DARK);
    g.fillBox(-3, 0, -6, 3, 3, 6, M.TRIM_OCHRE);
    // Vertical telescopic column & twin stepped geometric sensor/clamp prongs (strictly non-humanoid!)
    g.fillBox(-2, -12, -2, 2, -2, 2, M.RIB_STEEL);
    g.fillBox(-5, -16, -4, -2, -11, 4, M.HULL_PRIMARY);
    g.fillBox( 2, -16, -4,  5, -11, 4, M.HULL_PRIMARY);
    g.fillBox(-2, -15, -1,  2, -14, 1, M.EMIT_AMBER_HOT);
    return { mesh: meshVoxelGrid(g) };
  }

  // ==========================================================================
  // 2. POWER CORE ATRIUM (256 wide x 264 high x 256 deep:
  //    X = -128..+128, Y = -132..+132, Z = -128..+128)
  // ==========================================================================
  function buildPowerCoreAtrium() {
    const g = new ChunkVoxelGrid();

    // 1. Monumental Octagonal Outer Enclosing Atrium Walls (R_wall ~ 122..128)
    g.shellBox(-128, -132, -128, 128, 132, 128, 4, M.TRENCH_ABYSS);
    // Corner chamfer piers (turning square box into dramatic stepped octagonal hall!)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const w0 = 78 + i * 8;
          const d0 = 126 - i * 8;
          g.fillBox(sx > 0 ? w0 : -126, -130, sz > 0 ? d0 - 8 : -d0, sx > 0 ? 126 : -w0, 130, sz > 0 ? d0 : -d0 + 8, M.STRUCT_DARK);
        }
      }
    }
    // Vertical wall pilasters & recessed glowing azure energy risers along distant walls
    for (const c of [-64, 0, 64]) {
      g.fillSymX(118, -128, c - 8, 125, 128, c + 8, M.RIB_STEEL);
      g.fillSymX(121, -120, c - 2, 123, 120, c + 2, M.EMIT_AZURE_DEEP);
      g.fillBox(c - 8, -128, -125, c + 8, 128, -118, M.RIB_STEEL);
      g.fillBox(c - 8, -128,  118, c + 8, 128,  125, M.RIB_STEEL);
      g.fillBox(c - 2, -120, -123, c + 2, 120, -121, M.EMIT_AZURE_DEEP);
      g.fillBox(c - 2, -120,  121, c + 2, 120,  123, M.EMIT_AZURE_DEEP);
    }

    // 2. Six Stacked Ring & Twin-Tine Cantilevered Platform Levels!
    //    Y = -100, -60, -20, +20, +60, +100 — preserving wide central void (R_inner = 72..80)!
    const levelYs = [-100, -60, -20, 20, 60, 100];
    for (let li = 0; li < levelYs.length; li++) {
      const py = levelYs[li];
      const innerR = 74 + (li % 2) * 6;

      // Perimeter ring gallery around all 4 walls
      g.fillSymX(innerR, py - 4, -122, 122, py + 1, 122, M.HULL_PRIMARY);
      g.fillBox(-innerR, py - 4, -122, innerR, py + 1, -innerR, M.HULL_PRIMARY);
      g.fillBox(-innerR, py - 4,  innerR, innerR, py + 1,  122, M.HULL_PRIMARY);

      // Dark structural underside ribs (catch upward glow from the breathing Core!)
      g.fillSymX(innerR + 2, py - 7, -116, 118, py - 4, 116, M.STRUCT_DARK);
      g.fillBox(-innerR, py - 7, -118, innerR, py - 4, -innerR - 2, M.STRUCT_DARK);
      g.fillBox(-innerR, py - 7,  innerR + 2, innerR, py - 4,  118, M.STRUCT_DARK);

      // Crisp inner rim trim & cyan safety light strip
      g.fillSymX(innerR - 2, py - 2, -innerR, innerR, py + 2, innerR, M.HULL_LIGHT);
      g.fillBox(-innerR, py - 2, -innerR, innerR, py + 2, -innerR + 2, M.HULL_LIGHT);
      g.fillBox(-innerR, py - 2, innerR - 2, innerR, py + 2, innerR, M.HULL_LIGHT);
      g.fillSymX(innerR - 3, py - 1, -innerR + 12, innerR - 2, py, innerR - 12, M.EMIT_CYAN_SOFT);

      // 4 Cantilevered Twin-Tine Observation Forks jutting toward the central void (alternating angles per floor!)
      const forkOffset = (li % 2 === 0) ? 0 : 28;
      // X-axis twin-tine balconies (stop at X = +-56, leaving R < 56 completely open!)
      g.fillSymX(56, py - 3, forkOffset - 16, innerR, py + 1, forkOffset - 5, M.HULL_LIGHT);
      g.fillSymX(56, py - 3, forkOffset + 5,  innerR, py + 1, forkOffset + 16, M.HULL_LIGHT);
      g.fillSymX(55, py - 2, forkOffset - 15, 58, py + 2, forkOffset - 6, M.TRIM_OCHRE);
      g.fillSymX(55, py - 2, forkOffset + 6,  58, py + 2, forkOffset + 15, M.TRIM_OCHRE);

      // Z-axis twin-tine balconies
      for (const sz of [-1, 1]) {
        const zA = sz * 56, zB = sz * innerR;
        const zMin = Math.min(zA, zB), zMax = Math.max(zA, zB);
        g.fillBox(-forkOffset - 16, py - 3, zMin, -forkOffset - 5, py + 1, zMax, M.HULL_MID);
        g.fillBox(-forkOffset + 5,  py - 3, zMin, -forkOffset + 16, py + 1, zMax, M.HULL_MID);
      }
    }

    // 3. Six Massive Radial Buttress Struts spanning from outer walls to Core Collar (at Y = -66, +14, +94)
    for (const [by, axis] of [[-66, 'x'], [14, 'z'], [94, 'x']]) {
      if (axis === 'x') {
        g.fillSymX(34, by - 7, -11, 122, by + 7, 11, M.STRUCT_DARK, 3);
        g.fillSymX(38, by + 7, -8, 116, by + 10, 8, M.HULL_PRIMARY);
        g.fillSymX(34, by - 3, -12, 118, by + 3, -10, M.EMIT_CYAN_BRIGHT);
        g.fillSymX(34, by - 3,  10, 118, by + 3,  12, M.EMIT_CYAN_BRIGHT);
        g.fillSymX(32, by - 9, -13, 38, by + 9, 13, M.TRIM_OCHRE);
      } else {
        for (const sz of [-1, 1]) {
          const z0 = sz < 0 ? -122 : 34;
          const z1 = sz < 0 ? -34 : 122;
          g.shellBox(-11, by - 7, z0, 11, by + 7, z1, 3, M.STRUCT_DARK);
          g.fillBox(-8, by + 7, z0 + 4, 8, by + 10, z1 - 4, M.HULL_PRIMARY);
          g.fillBox(-12, by - 3, z0, -10, by + 3, z1, M.EMIT_CYAN_BRIGHT);
          g.fillBox( 10, by - 3, z0,  12, by + 3, z1, M.EMIT_CYAN_BRIGHT);
          const cz = sz < 0 ? -38 : 32;
          g.fillBox(-13, by - 9, cz, 13, by + 9, cz + 6, M.TRIM_OCHRE);
        }
      }
    }

    // 4. Central Power Core Column: Voxel Exoskeletal Cage + Breathing Glowing Inner Lattice!
    //    Spans entire vertical height Y = -130 .. +130 at center (X, Z in [-22..+22])
    // Upper & lower heavy magnetic containment pedestals
    g.fillCylinder('y', -132, -82, 0, 0, 28, 14, M.STRUCT_DARK);
    g.fillCylinder('y',  82,  132, 0, 0, 28, 14, M.STRUCT_DARK);
    g.fillCylinder('y', -84, -76, 0, 0, 24, 15, M.TRIM_OCHRE);
    g.fillCylinder('y',  76,  84, 0, 0, 24, 15, M.TRIM_OCHRE);

    // 4 Heavy Exoskeletal Vertical Cage Columns around R ~ 19
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        g.fillBox(sx * 14, -82, sz * 14, sx * 20, 82, sz * 20, M.WEAPON_BODY);
        for (let y = -68; y <= 68; y += 22) {
          g.fillBox(sx * 13, y - 2, sz * 13, sx * 21, y + 2, sz * 21, M.TRIM_OCHRE);
        }
      }
    }

    // Glowing Inner Crystalline Core Column (Y = -118 .. +118) + Central Heart Bulge (Y = -36 .. +36)
    g.fillCylinder('y', -118, 118, 0, 0, 10, 0, M.EMIT_WHITE_CYAN);
    g.fillCylinder('y', -42, 42, 0, 0, 15, 10, M.EMIT_CYAN_BRIGHT);
    // Translucent 1x1x1 Crystalline Voxel Jacket around core heart (keeps visible voxel crystal cells!)
    g.fillCylinder('y', -34, 34, 0, 0, 18, 15, M.TRANS_CORE_CRYSTAL);
    // Stepped amber plasma injector nodes at Y = +-24
    g.fillCylinder('y', -27, -23, 0, 0, 17, 13, M.EMIT_AMBER_HOT);
    g.fillCylinder('y',  23,  27, 0, 0, 17, 13, M.EMIT_AMBER_HOT);

    return {
      mesh: meshVoxelGrid(g)
    };
  }

  // Build the 4 Counter-Rotating & Precessing Voxel Core Rings (voxelSize = 1.0!)
  function buildPowerCoreRings() {
    const ringSpecs = [
      { rIn: 25, rOut: 32, h: 9, segGap: false, emitMat: M.EMIT_CYAN_BRIGHT },
      { rIn: 35, rOut: 43, h: 11, segGap: true,  emitMat: M.EMIT_AMBER_SOFT },
      { rIn: 46, rOut: 54, h: 8, segGap: false, emitMat: M.EMIT_CYAN_SOFT },
      { rIn: 56, rOut: 64, h: 12, segGap: true,  emitMat: M.EMIT_CYAN_BRIGHT }
    ];

    return ringSpecs.map((sp, idx) => {
      const g = new ChunkVoxelGrid();
      const hh = Math.floor(sp.h / 2);
      g.fillCylinder('y', -hh, hh, 0, 0, sp.rOut, sp.rIn, idx % 2 === 0 ? M.HULL_PRIMARY : M.STRUCT_DARK);
      // Inner glowing energy liner
      g.fillCylinder('y', -hh + 2, hh - 2, 0, 0, sp.rIn + 2, sp.rIn - 1, sp.emitMat);
      // 4 Heavy coupling nodes & ochre collars at cardinal axes (up close these look massive!)
      for (let k = 0; k < 4; k++) {
        const isX = (k % 2 === 0);
        const s = k < 2 ? 1 : -1;
        if (isX) {
          const x0 = s > 0 ? sp.rIn - 2 : -sp.rOut - 3;
          const x1 = s > 0 ? sp.rOut + 3 : -sp.rIn + 2;
          g.fillBox(x0, -hh - 2, -6, x1, hh + 2, 6, M.RIB_STEEL);
          g.fillBox(x0 + 1, -hh - 3, -4, x1 - 1, hh + 3, 4, M.TRIM_OCHRE);
        } else {
          const z0 = s > 0 ? sp.rIn - 2 : -sp.rOut - 3;
          const z1 = s > 0 ? sp.rOut + 3 : -sp.rIn + 2;
          g.fillBox(-6, -hh - 2, z0, 6, hh + 2, z1, M.RIB_STEEL);
          g.fillBox(-4, -hh - 3, z0 + 1, 4, hh + 3, z1 - 1, M.TRIM_OCHRE);
        }
      }
      // Optional segmented gaps so rotating/offset rings reveal behind-layers!
      if (sp.segGap) {
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const c = Math.round(sp.rOut * 0.68);
            g.carveBox(sx * c - 8, -hh - 4, sz * c - 8, sx * c + 8, hh + 4, sz * c + 8);
          }
        }
      }
      return meshVoxelGrid(g);
    });
  }

  // ==========================================================================
  // 3. ENERGY LOADING & CONDUCTION CORRIDOR (368 long x 104 wide x 76 high:
  //    Z = -184..+184, X = -52..+52, Y = -36..+40)
  // ==========================================================================
  function buildEnergyCorridor() {
    const g = new ChunkVoxelGrid();
    const loaderJawAnchors = [];

    // Enclosing outer floor, ceiling, and deep side shells
    g.fillBox(-52, -37, -184, 52, -32, 184, M.DECK_DARK);
    g.fillBox(-52,  36, -184, 52,  41, 184, M.TRENCH_ABYSS);
    g.fillSymX(48, -32, -184, 53, 37, 184, M.STRUCT_DARK);

    // Lower central abyssal power trench (X = -10..+10, Y = -32..-22) with flowing conduit bars
    g.fillSymX(10, -32, -180, 18, -20, 160, M.HULL_MID);
    g.fillBox(-6, -31, -178, 6, -29, 168, M.EMIT_AZURE_DEEP);
    for (let z = -170; z <= 155; z += 18) {
      g.fillBox(-12, -23, z, 12, -21, z + 5, M.RIB_STEEL);
    }

    // Dual Longitudinal Energy Rail Troughs along X = +-22, Y = -14 .. -4
    // (Glowing Energy Blocks march forward along these exact troughs!)
    g.fillSymX(17, -20, -178, 27, -13, 156, M.STRUCT_DARK);
    g.fillSymX(20, -14, -176, 24, -13, 154, M.EMIT_CYAN_SOFT);

    // Overhead Suspended Conduction Spine (Y = +22 .. +35, X = -12..+12)
    // Leaves central camera flight channel X = -15..+15, Y = -16..+19 completely unobstructed!
    g.fillSymX(6, 24, -178, 13, 34, 158, M.HULL_PRIMARY);
    g.fillBox(-6, 28, -178, 6, 35, 158, M.STRUCT_DARK);
    for (let z = -170; z <= 150; z += 16) {
      g.fillBox(-14, 22, z, 14, 26, z + 6, M.TRIM_OCHRE);
      g.fillBox(-4, 25, z + 7, 4, 28, z + 14, M.EMIT_CYAN_BRIGHT);
    }

    // 8 Monumental Portal Frames & Towering Lateral Loading Apparatus (every 42 voxels along Z!)
    for (let i = 0; i < 8; i++) {
      const fz = -158 + i * 42;
      // Heavy Stepped Portal Arch spanning floor-to-ceiling around the central void
      g.fillSymX(28, -32, fz - 6, 48, 36, fz + 6, M.HULL_PRIMARY);
      g.fillBox(-48, 22, fz - 5, 48, 36, fz + 5, M.HULL_MID);
      g.fillSymX(26, -20, fz - 3, 29, 24, fz + 3, M.TRIM_OCHRE);

      // Towering Columnar Energy Loader Unit between portal frames (fz + 10 .. fz + 32)
      if (i < 7) {
        const uz0 = fz + 10, uz1 = fz + 32;
        // Heavy ceramic outer frame + dark recessed mid-layer + blazing inner core!
        g.fillSymX(32, -28, uz0, 47, 30, uz1, M.STRUCT_DARK);
        g.fillSymX(30,  12, uz0 + 2, 45, 26, uz1 - 2, M.HULL_LIGHT);
        g.fillSymX(30, -26, uz0 + 2, 45, -14, uz1 - 2, M.HULL_LIGHT);
        // Glowing vertical capacitor core inside loader tower
        g.fillSymX(34, -12, uz0 + 5, 39, 10, uz1 - 5, M.EMIT_CYAN_BRIGHT);
        g.fillSymX(33, -10, uz0 + 7, 35,  8, uz1 - 7, M.TRANS_CORE_CRYSTAL);
        // Vertical conduit riser connecting floor trough to overhead spine
        g.fillSymX(29, -28, fz - 1, 31, 28, fz + 1, M.EMIT_AZURE_DEEP);

        if (i % 1 === 0) {
          loaderJawAnchors.push({ z: (uz0 + uz1) * 0.5, index: i });
        }
      }
    }

    // Wide Blazing Weapon Convergence Cavity at Far End (Z = +150 .. +218)!
    // Carve front opening first so shellBox doesn't seal off Z = 150..153!
    g.shellBox(-52, -36, 150, 52, 40, 218, 4, M.STRUCT_DARK);
    g.carveBox(-47, -31, 148, 47, 35, 212);
    g.fillCylinder('z', 154, 174, 0, 2, 44, 33, M.HULL_PRIMARY);
    g.fillCylinder('z', 164, 170, 0, 2, 36, 30, M.TRIM_OCHRE);
    g.fillCylinder('z', 174, 198, 0, 2, 38, 25, M.WEAPON_BODY);
    g.fillCylinder('z', 184, 192, 0, 2, 28, 23, M.EMIT_CYAN_BRIGHT);
    g.fillCylinder('z', 198, 214, 0, 2, 27, 15, M.STRUCT_DARK);
    // 4 Stepped Radial Conduction Blades converging into the focal lens!
    g.fillSymX(16, -1, 162, 34, 5, 208, M.RIB_STEEL);
    g.fillSymX(17,  1, 166, 32, 3, 204, M.EMIT_CYAN_BRIGHT);
    g.fillBox(-3, 17, 162, 3, 34, 208, M.RIB_STEEL);
    g.fillBox(-3, -29, 162, 3, -13, 208, M.RIB_STEEL);
    // Deep blazing focal emitter ring & heart at Z = +206 .. +215!
    g.fillCylinder('z', 206, 212, 0, 2, 18, 10, M.EMIT_AMBER_HOT);
    g.fillCylinder('z', 210, 215, 0, 2, 11,  0, M.EMIT_WHITE_CYAN);

    return {
      mesh: meshVoxelGrid(g),
      loaderJawAnchors
    };
  }

  // Dynamic Voxel Energy Cartridge Block & Clamping Loader Jaw (voxelSize = 1.0!)
  function buildCorridorDynamicParts() {
    // 1. Glowing Voxel Energy Block (8 x 7 x 14 voxels, solid + crystalline core)
    const gb = new ChunkVoxelGrid();
    gb.fillBox(-3, -3, -7, 3, 3, 7, M.WEAPON_BODY);
    gb.fillBox(-4, -2, -5, 4, 2, 5, M.EMIT_CYAN_BRIGHT);
    gb.fillBox(-2,  2, -5, 2, 4, 5, M.EMIT_WHITE_CYAN);
    gb.fillBox(-3, -1,  5, 3, 1, 7, M.EMIT_AMBER_HOT);

    // 2. Abstract Clamping Loader Jaw (non-humanoid stepped mechanical clamp, port/+X mirrored via rotation or symmetric)
    const gj = new ChunkVoxelGrid();
    gj.fillBox(-5, -7, -6, 5, 7, 6, M.HULL_PRIMARY);
    gj.fillBox(-6, -5, -4, 4, 5, 4, M.STRUCT_DARK);
    // Stepped upper & lower C-clamp jaws facing toward center (-X in +X side local, we'll build two-sided or orient via yaw!)
    gj.fillBox(-10,  3, -5, -4,  7, 5, M.RIB_STEEL);
    gj.fillBox(-10, -7, -5, -4, -3, 5, M.RIB_STEEL);
    gj.fillBox(-11,  3, -3, -9,  6, 3, M.TRIM_OCHRE);
    gj.fillBox(-11, -6, -3, -9, -3, 3, M.TRIM_OCHRE);
    gj.fillBox(-6,  -2, -2, -4,  2, 2, M.EMIT_AMBER_SOFT);

    return {
      energyBlockMesh: meshVoxelGrid(gb),
      loaderJawMesh: meshVoxelGrid(gj)
    };
  }

  // ==========================================================================
  // 4. WIDE COMMAND BRIDGE (136 wide x 140 deep x 64 high:
  //    X = -68..+68, Y = -18..+46, Z = -70..+70)
  //    Panoramic Forward Observation Opening at Z = +66..+70 (108 wide x 36 tall)
  //    reveals the live sailing Fleet & Flagship Twin-Tine Bow outside!
  // ==========================================================================
  function buildCommandBridge() {
    const g = new ChunkVoxelGrid();

    // 1. Stepped Multi-Level Bridge Deck, Side Walls, Rear Bulkhead & Vaulted Ceiling
    g.fillBox(-68, -20, -70, 68, -16, 70, M.DECK_DARK);
    // Central sunken command amphitheater floor (X = -24..+24, Z = -38..+36)
    g.fillBox(-24, -16, -38, 24, -15, 36, M.STRUCT_DARK);
    // Glowing floor perimeter lines around central hall
    g.fillSymX(23, -15, -36, 24, -15, 34, M.EMIT_CYAN_SOFT);
    g.fillBox(-23, -15, 34, 23, -15, 35, M.EMIT_CYAN_SOFT);

    // Side Enclosing Armored Walls (X = +-66..+-70) & Rear Command Bulkhead (Z = -72..-66)
    g.fillSymX(66, -18, -70, 70, 44, 70, M.STRUCT_DARK);
    g.fillBox(-68, -18, -72, 68, 44, -66, M.STRUCT_DARK);
    // Rear glowing status wall panels
    for (let x = -48; x <= 48; x += 24) {
      g.fillBox(x - 8, -4, -66, x + 8, 18, -64, M.HULL_MID);
      g.fillBox(x - 6,  0, -64, x + 6, 14, -63, M.TRANS_CYAN_HOLO);
    }

    // Vaulted Stepped Ceiling & 4 Spanning Overhead Arch-Trusses (Y = +32 .. +46)
    g.fillBox(-68, 42, -70, 68, 46, 68, M.TRENCH_ABYSS);
    g.fillSymX(42, 36, -70, 68, 42, 68, M.HULL_MID);
    for (const az of [-46, -12, 22, 52]) {
      // Spanning structural arch across the 136-voxel hall!
      g.fillBox(-66, 33, az - 4, 66, 42, az + 4, M.HULL_PRIMARY);
      g.fillSymX(52, -16, az - 4, 66, 34, az + 4, M.HULL_PRIMARY);
      g.fillBox(-44, 31, az - 2, 44, 33, az + 2, M.RIB_STEEL);
      g.fillBox(-32, 30, az - 1, 32, 31, az + 1, M.EMIT_CYAN_SOFT);
    }

    // 2. Three Stepped Lateral Control Platform Tiers (X = +-25 .. +-65) + Elevated Mezzanine!
    //    Tier 1: X = +-25..+-38, Y = -13
    //    Tier 2: X = +-39..+-52, Y = -8
    //    Tier 3: X = +-53..+-65, Y = -2
    //    Upper Mezzanine Balcony: X = +-48..+-65, Y = +15
    const tiers = [
      { x0: 25, x1: 38, y: -13, zStart: -56, zEnd: 46 },
      { x0: 39, x1: 52, y:  -8, zStart: -58, zEnd: 42 },
      { x0: 53, x1: 65, y:  -2, zStart: -60, zEnd: 36 }
    ];

    for (let ti = 0; ti < tiers.length; ti++) {
      const T = tiers[ti];
      g.fillSymX(T.x0, -16, T.zStart, T.x1, T.y, T.zEnd, M.DECK_DARK);
      g.fillSymX(T.x0, T.y, T.zStart, T.x0 + 1, T.y + 1, T.zEnd, M.DECK_MARK);
      g.fillSymX(T.x0, T.y - 1, T.zStart + 4, T.x0, T.y, T.zEnd - 4, M.EMIT_AZURE_DEEP);

      // Populate rows of Voxel Console Desks + Floating Translucent Display Panels!
      for (let cz = T.zStart + 8; cz <= T.zEnd - 8; cz += 16) {
        const cx0 = T.x0 + 3, cx1 = T.x0 + 9;
        // Dark gunmetal console pedestal with ceramic trim & glowing angled desktop interface
        g.fillSymX(cx0, T.y + 1, cz - 5, cx1, T.y + 4, cz + 5, M.STRUCT_DARK);
        g.fillSymX(cx0, T.y + 4, cz - 5, cx0 + 1, T.y + 5, cz + 5, M.HULL_LIGHT);
        g.fillSymX(cx0 + 2, T.y + 4, cz - 4, cx1 - 1, T.y + 5, cz + 4,
          ((cz + ti * 7) % 3 === 0) ? M.EMIT_AMBER_SOFT : M.EMIT_CYAN_BRIGHT);
        // Overhead suspended translucent voxel display screens!
        const dispH = (ti === 1 && (cz === -12 || cz === 20)) ? 7 : 5;
        g.fillSymX(cx0 + 2, T.y + 7, cz - 5, cx0 + 2, T.y + 7 + dispH, cz + 5,
          ((cz + ti) % 4 === 0) ? M.TRANS_AMBER_HOLO : M.TRANS_CYAN_HOLO);
        g.fillSymX(cx0 + 2, T.y + 5, cz - 5, cx0 + 2, T.y + 7, cz - 5, M.RIB_STEEL);
        g.fillSymX(cx0 + 2, T.y + 5, cz + 5, cx0 + 2, T.y + 7, cz + 5, M.RIB_STEEL);
      }
    }

    // Elevated Upper Mezzanine Galleries along X = +-48..+-65, Y = +14..+17
    g.fillSymX(48, 14, -62, 65, 17, 32, M.HULL_MID);
    g.fillSymX(47, 17, -60, 49, 20, 30, M.TRIM_OCHRE);
    g.fillSymX(47, 15, -58, 47, 16, 28, M.EMIT_CYAN_SOFT);
    for (let cz = -48; cz <= 18; cz += 22) {
      g.fillSymX(52, 18, cz - 5, 57, 21, cz + 5, M.STRUCT_DARK);
      g.fillSymX(53, 21, cz - 4, 56, 22, cz + 4, M.EMIT_CYAN_SOFT);
      g.fillSymX(52, 24, cz - 5, 52, 29, cz + 5, M.TRANS_CYAN_HOLO);
    }

    // 3. Central Command Nexus (centered at X = 0, Z = -4)
    //    Stepped Octagonal Plinth Base + Overhead Suspended Projection Crown!
    g.fillCylinder('y', -15, -12, 0, -4, 17, 0, M.HULL_PRIMARY);
    g.fillCylinder('y', -12,  -9, 0, -4, 13, 0, M.STRUCT_DARK);
    g.fillCylinder('y',  -9,  -7, 0, -4, 10, 6, M.TRIM_OCHRE);
    g.fillCylinder('y',  -8,  -6, 0, -4,  6, 0, M.EMIT_CYAN_BRIGHT);
    // 4 Radial Nexus Console Pods around plinth
    for (const [nx, nz] of [[-14, -4], [14, -4], [0, -18], [0, 10]]) {
      g.fillBox(nx - 3, -11, nz - 3, nx + 3, -8, nz + 3, M.HULL_LIGHT);
      g.fillBox(nx - 2,  -8, nz - 2, nx + 2, -7, nz + 2, M.EMIT_CYAN_SOFT);
    }

    // Overhead Suspended Projection Crown (hanging from ceiling at Y = +19 .. +32, X=0, Z=-4)
    g.fillCylinder('y', 26, 32, 0, -4, 15, 9, M.HULL_PRIMARY);
    g.fillCylinder('y', 21, 26, 0, -4, 11, 7, M.STRUCT_DARK);
    g.fillCylinder('y', 19, 21, 0, -4,  9, 6, M.TRIM_OCHRE);
    g.fillCylinder('y', 20, 22, 0, -4,  6, 0, M.EMIT_CYAN_BRIGHT);
    // 4 Cantilevered Holo-Frame Fins around the upper crown
    g.fillSymX(11, 20, -6, 17, 27, -2, M.HULL_LIGHT);
    g.fillBox(-2, 20, -21, 2, 27, -15, M.HULL_LIGHT);
    g.fillBox(-2, 20,   7, 2, 27,  13, M.HULL_LIGHT);

    // 4. Massive Panoramic Forward Observation Opening (Z = +62 .. +70)
    //    Opening spans X = -54 .. +54 (108 voxels wide!), Y = -8 .. +28 (36 voxels tall!)
    //    Left completely clear of opaque backwall so real exterior Flagship Bow + Fleet + Nebula shine right in!
    // Lower panoramic sill & stepped brow lintel
    g.fillBox(-66, -18, 58, 66, -8, 70, M.HULL_PRIMARY);
    g.fillBox(-56,  -8, 60, 56, -6, 66, M.TRIM_OCHRE);
    g.fillBox(-66,  28, 58, 66, 44, 70, M.HULL_PRIMARY);
    g.fillBox(-56,  26, 60, 56, 28, 66, M.TRIM_OCHRE);
    // Lateral framing piers
    g.fillSymX(54, -8, 58, 66, 28, 70, M.HULL_PRIMARY);
    // Two slender angled structural mullions at X = +-28 framing the triple-bay panoramic vista!
    g.fillSymX(27, -7, 64, 30, 27, 68, M.RIB_STEEL);
    g.fillSymX(28, -6, 63, 29, 26, 64, M.EMIT_CYAN_SOFT);

    return {
      mesh: meshVoxelGrid(g),
      nexusCenter: [0, 5, -4]
    };
  }

  // Live 3D Voxel Tactical Hologram Elements inside the Bridge Nexus (voxelSize = 1.0!)
  function buildBridgeHoloElements() {
    // 1. Miniature Translucent Voxel Flagship Silhouette (26 voxels long x 9 wide x 5 tall)
    const gf = new ChunkVoxelGrid();
    gf.fillBox(-2, -1, -12, 2, 1, 6, M.TRANS_CYAN_HOLO);
    gf.fillSymX(3, 0, -8, 4, 1, 3, M.TRANS_CYAN_HOLO);
    gf.fillSymX(1, 0, 6, 3, 1, 13, M.EMIT_CYAN_BRIGHT);
    gf.fillBox(-1, 2, -6, 1, 3, 0, M.EMIT_WHITE_CYAN);
    // Faint tactical holo base ring around miniature flagship
    gf.fillCylinder('y', -4, -4, 0, 0, 15, 14, M.TRANS_CYAN_HOLO);

    // 2. Miniature Voxel Escort Blip + Trajectory Node
    const ge = new ChunkVoxelGrid();
    ge.fillBox(-1, 0, -2, 1, 0, 1, M.TRANS_CYAN_HOLO);
    ge.set(0, 0, 2, M.EMIT_CYAN_BRIGHT);

    // 3. Miniature Voxel Asteroid Target Cluster Marker (amber translucent voxel cluster + target ring)
    const ga = new ChunkVoxelGrid();
    ga.fillBox(-2, -1, -2, 2, 1, 2, M.TRANS_AMBER_HOLO);
    ga.fillBox(-1, 0, 0, 2, 2, 2, M.EMIT_AMBER_HOT);
    ga.fillCylinder('y', -2, -2, 0, 0, 6, 5, M.EMIT_AMBER_SOFT);

    // 4. Voxel Trajectory Waypoint Ribbon Segment (1x1x4)
    const gr = new ChunkVoxelGrid();
    gr.fillBox(0, 0, -2, 0, 0, 1, M.TRANS_CYAN_HOLO);
    gr.set(0, 0, 2, M.EMIT_CYAN_BRIGHT);

    return {
      holoFlagship: meshVoxelGrid(gf, { ao: false }),
      holoEscort: meshVoxelGrid(ge, { ao: false }),
      holoTarget: meshVoxelGrid(ga, { ao: false }),
      holoLineSeg: meshVoxelGrid(gr, { ao: false })
    };
  }

  SF.Interiors = {
    buildThroughHangar,
    buildHangarMaintArm,
    buildPowerCoreAtrium,
    buildPowerCoreRings,
    buildEnergyCorridor,
    buildCorridorDynamicParts,
    buildCommandBridge,
    buildBridgeHoloElements
  };
})(window);
