// ============================================================================
// 04_ships_weapons.js
// Procedural 1x1x1 Voxel Builders for Flagship (1120), Aegis Guard (176),
// Lance Vanguard (208), Dart Shuttle (28), and All 4 Physical Weapon Systems.
// ============================================================================
(function (global) {
  'use strict';

  const SF = (global.StarFleet = global.StarFleet || {});
  const { ChunkVoxelGrid, meshVoxelGrid } = SF.Voxel;
  const M = SF.MAT;

  // Helper: build a stepped rectangular thruster nozzle chamber facing -Z
  function buildSteppedNozzle(g, cx, cy, zRim, zFront, halfW, halfH, wallT, emitMat) {
    const x0 = Math.round(cx - halfW), x1 = Math.round(cx + halfW);
    const y0 = Math.round(cy - halfH), y1 = Math.round(cy + halfH);

    // Outer primary ceramic shroud
    g.shellBox(x0 - 4, y0 - 4, zRim + 6, x1 + 4, y1 + 4, zFront, 4, M.HULL_PRIMARY);
    // Stepped mid gunmetal collar
    g.shellBox(x0 - 2, y0 - 2, zRim + 2, x1 + 2, y1 + 2, zFront - 4, 3, M.STRUCT_DARK);
    // Inner forged rim extending to zRim
    g.shellBox(x0, y0, zRim, x1, y1, zRim + 16, wallT, M.WEAPON_BODY);
    // Ochre & silver accent tabs on rim corners
    g.fillBox(x0, y1 - 2, zRim, x0 + 5, y1, zRim + 3, M.TRIM_OCHRE);
    g.fillBox(x1 - 5, y1 - 2, zRim, x1, y1, zRim + 3, M.TRIM_OCHRE);
    g.fillBox(x0, y0, zRim, x0 + 5, y0 + 2, zRim + 3, M.TRIM_OCHRE);
    g.fillBox(x1 - 5, y0, zRim, x1, y0 + 2, zRim + 3, M.TRIM_OCHRE);

    // Carve deep dark chamber interior
    const cavDepth = Math.min(44, Math.max(12, zFront - zRim - 8));
    g.carveBox(x0 + wallT, y0 + wallT, zRim, x1 - wallT, y1 - wallT, zRim + cavDepth);
    // Line inner chamber walls with abyssal dark ribs
    for (let z = zRim + 5; z < zRim + cavDepth - 4; z += 7) {
      g.shellBox(x0 + wallT, y0 + wallT, z, x1 - wallT, y1 - wallT, z + 2, 2, M.TRENCH_ABYSS);
    }

    // Glowing injector throat deep inside chamber
    const zThroat = zRim + cavDepth - 3;
    g.fillBox(x0 + wallT, y0 + wallT, zThroat, x1 - wallT, y1 - wallT, zThroat + 3, emitMat || M.EMIT_CYAN_BRIGHT);
    // Bright white-cyan center core bars
    const coreW = Math.max(2, Math.floor((halfW - wallT) * 0.55));
    const coreH = Math.max(2, Math.floor((halfH - wallT) * 0.55));
    g.fillBox(cx - coreW, cy - coreH, zThroat - 1, cx + coreW, cy + coreH, zThroat + 2, M.EMIT_WHITE_CYAN);

    // Optional splitter vane for huge nozzles
    if (halfW >= 24) {
      g.fillBox(cx - 2, y0 + wallT, zRim + 4, cx + 2, y1 - wallT, zThroat + 2, M.STRUCT_DARK);
      g.fillBox(cx - 1, y0 + wallT + 3, zRim + 6, cx + 1, y1 - wallT - 3, zRim + 9, M.EMIT_CYAN_SOFT);
    }
  }

  // ==========================================================================
  // 1. FLAGSHIP ("Sovereign Cantilever", 1120 voxels long: Z = -560 .. +560)
  // ==========================================================================
  function buildFlagship() {
    const g = new ChunkVoxelGrid();
    const thrusters = [];
    const pulseMounts = [];
    const floatingPodMounts = [];

    // ------------------------------------------------------------------------
    // A. CENTRAL STRUCTURAL SPINE & CORE TRUSS (Z = -475 .. +250)
    // ------------------------------------------------------------------------
    g.shellBox(-18, -30, -470, 34, 34, 245, 5, M.STRUCT_DARK);
    // Deep recessed dark longitudinal spine channels (starboard side full, port side clears hangar X=-116..-20)
    g.shellBox(34, -22, -455, 48, 24, 215, 4, M.TRENCH_ABYSS);
    g.shellBox(-48, -22, -455, -34, 24, -316, 4, M.TRENCH_ABYSS);
    g.shellBox(-48, -22, 80, -34, 24, 215, 4, M.TRENCH_ABYSS);

    // Glowing dorsal & lateral conduit seams running along deep spine
    for (let z = -430; z <= 190; z += 28) {
      g.fillBox(47, -4, z, 49, 4, z + 16, M.EMIT_CYAN_SOFT);
      if (z < -325 || z > 85) {
        g.fillBox(-49, -4, z, -47, 4, z + 16, M.EMIT_CYAN_SOFT);
      }
      g.fillSymX(24, 34, z, 28, 36, z + 14, M.EMIT_CYAN_SOFT);
    }

    // ------------------------------------------------------------------------
    // B. THREE TECTONIC STEPPED ARMOR DISTRICTS (with deep structural canyons)
    //    Note: Port Longitudinal Hangar occupies X = -116..-20, Y = -23..+41, Z = -310..+74
    //    and opens to space through Port Side Mouth at X = -142..-116, Y = -18..+24, Z = -286..-154!
    // ------------------------------------------------------------------------
    // --- District 1: Fore-Mid Cantilevered Shoulders (Z = +80 .. +228) ---
    g.fillSymSteppedLoftZ(80, 228, 6, 30, -28, 108, 38, 24, -22, 82, 32, M.HULL_PRIMARY, 4);
    g.fillSymSteppedLoftZ(84, 220, 8, 18, 36, 92, 46, 16, 30, 68, 40, M.HULL_LIGHT, 4);
    g.fillSymSteppedLoftZ(86, 212, 8, 86, -12, 118, 22, 68, -8, 92, 18, M.HULL_MID, 4);
    g.carveSymX(82, 2, 92, 120, 7, 206);
    g.fillSymX(82, 3, 96, 86, 6, 200, M.EMIT_CYAN_SOFT);
    g.fillSymX(64, 32, 218, 84, 41, 228, M.TRIM_OCHRE);
    g.fillSymX(78, 38, 80, 98, 47, 88, M.TRIM_OCHRE);

    // Structural Canyon #1 (Z = +74 .. +80)
    for (let y = -26; y <= 34; y += 20) {
      g.fillBox(26, y, 75, 92, y + 5, 79, M.RIB_STEEL);
    }

    // --- District 2: Mid-Hull Longitudinal Hangar Wing Section (Z = -316 .. +74) ---
    // Upper armored roof deck over Hangar (Y = +41 .. +50, clears Hangar ceiling Y = +40!)
    g.fillSymSteppedLoftZ(-316, 74, 10, 20, 41, 138, 48, 20, 41, 128, 47, M.HULL_PRIMARY, 4);
    g.fillSymX(34, 48, -295, 114, 52, 58, M.HULL_LIGHT, 3);
    // Lower armored belly slab under Hangar (Y = -36 .. -23, clears Hangar floor Y = -22!)
    g.fillSymSteppedLoftZ(-316, 74, 10, 20, -36, 140, -23, 20, -36, 132, -23, M.HULL_PRIMARY, 4);

    // Port Outer Hull Wall forward of Port Hangar Mouth (Z = -154 .. +74, X = -138 .. -116)
    g.shellBox(-136, -24, -154, -116, 42, 74, 4, M.HULL_MID);
    // Medium-scale stepped ceramic armor laminae & recessed dark structural canyons along the 228-voxel flank!
    g.shellBox(-141,  10, -142, -134, 38, -56, 3, M.HULL_PRIMARY);
    g.shellBox(-141,  10,  -36, -134, 38,  62, 3, M.HULL_PRIMARY);
    g.shellBox(-140, -21, -138, -134, -2, -52, 3, M.HULL_LIGHT);
    g.shellBox(-140, -21,  -32, -134, -2,  58, 3, M.HULL_LIGHT);
    // Deep structural rib buttresses between armor plates (Z = -54..-38)
    for (let y = -18; y <= 32; y += 16) {
      g.fillBox(-140, y, -52, -132, y + 6, -38, M.RIB_STEEL);
    }
    g.fillBox(-138, 14, -49, -135, 28, -41, M.TRIM_OCHRE);
    // Recessed horizontal dark conduit slot with fine glowing cyan seam (1-2 voxels tall, not overly thick)
    g.carveBox(-142, 3, -136, -131, 7, 56);
    g.fillBox(-134, 4, -130, -131, 6, -58, M.EMIT_CYAN_SOFT);
    g.fillBox(-134, 4,  -30, -131, 6,  50, M.EMIT_CYAN_SOFT);
    // Port Outer Hull Wall aft of Port Hangar Mouth (Z = -316 .. -286, X = -138 .. -116)
    g.shellBox(-138, -24, -316, -116, 42, -286, 4, M.HULL_MID);
    g.fillBox(-141, -10, -312, -135, 28, -290, M.HULL_PRIMARY);

    // Port Hangar Mouth Threshold Framing (Z = -286 .. -154, Y = -18 .. +24 — 132 wide x 42 high open aperture!)
    g.fillBox(-140, 24, -290, -116, 41, -150, M.HULL_PRIMARY);
    g.fillBox(-142, -23, -290, -116, -18, -150, M.DECK_DARK);
    // Ochre & glowing threshold beacons framing the Port Hangar Mouth!
    g.fillBox(-140, -22, -156, -132, 30, -150, M.TRIM_OCHRE);
    g.fillBox(-140, -22, -290, -132, 30, -284, M.TRIM_OCHRE);
    g.fillBox(-139, 24, -284, -135, 27, -156, M.EMIT_CYAN_BRIGHT);
    g.fillBox(-141, -19, -282, -136, -17, -158, M.EMIT_AMBER_SOFT);
    // Deck guide strips extending onto the outer port flight lip!
    for (let z = -272; z <= -168; z += 26) {
      g.fillBox(-140, -18, z, -116, -17, z + 4, M.EMIT_AZURE_DEEP);
    }

    // Starboard Symmetrical Exterior Armor & Recessed Auxiliary Bay (X = +48 .. +138, Z = -316 .. +74)
    g.shellBox(48, -24, -154, 136, 41, 74, 4, M.HULL_MID);
    g.shellBox(48, -24, -316, 136, 41, -286, 4, M.HULL_MID);
    // Starboard recessed visual bay pocket (Z = -286 .. -154, X = +88 .. +138)
    g.fillBox(84, -22, -288, 90, 38, -152, M.STRUCT_DARK);
    g.fillBox(88, -23, -288, 140, -18, -152, M.DECK_DARK);
    g.fillBox(88, 24, -288, 138, 41, -152, M.HULL_PRIMARY);
    g.fillBox(132, -22, -156, 140, 30, -150, M.TRIM_OCHRE);
    g.fillBox(132, -22, -290, 140, 30, -284, M.TRIM_OCHRE);
    g.fillBox(135, 24, -284, 139, 27, -156, M.EMIT_CYAN_BRIGHT);
    for (let z = -268; z <= -172; z += 32) {
      g.fillBox(89, -12, z, 92, 16, z + 16, M.EMIT_AZURE_DEEP);
      g.fillBox(92, -18, z + 6, 136, -17, z + 10, M.EMIT_CYAN_SOFT);
    }

    // Ensure exact Hangar interior volume (including deep continuation portal up to Z=+102) & Port Mouth are 100% clear!
    g.carveBox(-117, -22, -310, -20, 40, 102);
    g.carveBox(-146, -17, -285, -115, 24, -155);

    // --- District 3: Aft Broad Reactor & Drive Shoulders (Z = -445 .. -322) ---
    g.fillSymSteppedLoftZ(-445, -322, 8, 28, -32, 132, 34, 30, -32, 126, 44, M.HULL_PRIMARY, 4);
    g.fillSymSteppedLoftZ(-425, -326, 10, 42, 34, 118, 44, 38, 42, 112, 49, M.HULL_LIGHT, 4);
    g.fillSymSteppedLoftZ(-468, -324, 8, 90, -14, 136, 24, 98, -12, 142, 22, M.HULL_MID, 4);
    g.fillSymX(134, 4, -445, 142, 12, -330, M.STRUCT_DARK);
    g.fillSymX(138, 6, -435, 143, 10, -338, M.EMIT_CYAN_SOFT);

    // ------------------------------------------------------------------------
    // C. ELEVATED DORSAL SPINE & MULTI-TIERED COMMAND CITADEL (Y = +34 .. +104)
    // ------------------------------------------------------------------------
    // Forward Dorsal Spine Ridge (Z = -70 .. +215, Y = +36 .. +62)
    g.fillSteppedLoftZ(-70, 215, 8, -26, 36, 26, 62, -18, 34, 18, 50, M.HULL_PRIMARY, 4);
    // Recessed dark dorsal heat-sink trenches along spine
    g.carveBox(-10, 50, -50, 10, 64, 195);
    for (let z = -42; z <= 186; z += 14) {
      g.fillBox(-12, 50, z, 12, 58, z + 5, M.RIB_STEEL);
      g.fillBox(-6, 49, z + 6, 6, 52, z + 11, M.EMIT_CYAN_SOFT);
    }

    // Command Citadel Base & Stepped Superstructure (Z = -310 .. -75, Y = +42 .. +104)
    g.shellBox(-48, 42, -305, 48, 70, -80, 4, M.HULL_MID);
    g.fillSteppedLoftZ(-285, -88, 6, -38, 68, 38, 86, -44, 68, 44, 82, M.HULL_PRIMARY, 4);
    // Wide Cantilevered Bridge Wing Tower (echoing fleet twin-lamina motif! X = -72 .. +72, Y = +80 .. +96)
    g.fillSymSteppedLoftZ(-195, -92, 6, 16, 80, 72, 95, 12, 82, 58, 94, M.HULL_LIGHT, 3);
    g.shellBox(-24, 80, -210, 24, 98, -90, 3, M.HULL_LIGHT);
    // Recessed Panoramic Bridge Observation Aperture at Z = -90 (glowing softly from exterior!)
    g.carveBox(-46, 84, -96, 46, 92, -88);
    g.fillBox(-44, 85, -96, 44, 91, -93, M.EMIT_CYAN_BRIGHT);
    for (let x = -36; x <= 36; x += 18) {
      g.fillBox(x - 1, 84, -94, x + 1, 92, -89, M.RIB_STEEL);
    }
    // Ochre brow & dorsal sensor fins atop Citadel (up to Y = +104)
    g.fillBox(-50, 93, -98, 50, 96, -90, M.TRIM_OCHRE);
    g.fillSymX(20, 96, -200, 26, 104, -120, M.HULL_PRIMARY);
    g.fillSymX(21, 98, -190, 25, 102, -184, M.EMIT_AMBER_SOFT);

    // ------------------------------------------------------------------------
    // D. VENTRAL KEEL, RIB-CAGE ARCHES & BELLY FINS (Y = -30 .. -88)
    //    Ensures underside & diagonal-low camera passes reveal rich architecture!
    // ------------------------------------------------------------------------
    // Deep Ventral Spine Keel (Z = -430 .. +195, Y = -66 .. -30)
    g.fillSteppedLoftZ(-430, 195, 10, -24, -64, 24, -28, -18, -54, 18, -24, M.STRUCT_DARK, 4);
    // Exposed glowing ventral reactor trough along centerline
    g.carveBox(-9, -66, -390, 9, -46, 160);
    g.fillBox(-5, -50, -380, 5, -46, 150, M.EMIT_AZURE_DEEP);
    // 14 Heavy Ventral Rib Arches spanning across the reactor trough & belly flanks!
    for (let z = -375; z <= 145; z += 40) {
      g.fillBox(-26, -66, z, 26, -56, z + 10, M.HULL_MID);
      g.fillSymX(24, -56, z + 1, 68, -32, z + 9, M.RIB_STEEL);
      g.fillSymX(62, -42, z + 2, 68, -36, z + 8, M.TRIM_OCHRE);
    }
    // Twin Cantilevered Ventral Stabilizer Skegs (Z = -395 .. -215, Y = -88 .. -52)
    g.fillSymSteppedLoftZ(-395, -215, 8, 22, -88, 34, -50, 18, -74, 28, -48, M.HULL_PRIMARY, 3);
    g.fillSymX(24, -86, -385, 32, -82, -230, M.TRIM_OCHRE);

    // ------------------------------------------------------------------------
    // E. TWIN-TINE 4-JAW CANTILEVERED BOW & COLOSSAL MAIN BEAM CANNON
    //    Bow spans Z = +220 .. +560 (340 voxels of dramatic forward silhouette!)
    // ------------------------------------------------------------------------
    // 1. Upper Stepped Twin Tines (Z = +215 .. +560, X = +-22 .. +-84, Y = +12 .. +44)
    g.fillSymSteppedLoftZ(215, 390, 6, 26, 12, 84, 42, 22, 14, 58, 36, M.HULL_PRIMARY, 4);
    g.fillSymSteppedLoftZ(390, 560, 5, 22, 14, 58, 36, 18, 17, 31, 29, M.HULL_LIGHT, 3);
    // Recessed dark slot along outer face of upper tines + cyan seam
    g.carveSymX(46, 22, 250, 86, 28, 450);
    g.fillSymX(44, 24, 260, 48, 26, 435, M.EMIT_CYAN_SOFT);
    // Crisp ochre & silver prow tips at Z = +542 .. +560
    g.fillSymX(18, 17, 544, 31, 29, 560, M.TRIM_OCHRE);
    g.fillSymX(19, 21, 554, 28, 25, 562, M.TRIM_SILVER);

    // 2. Lower Cantilevered Chin Tines (Z = +195 .. +508, X = +-22 .. +-68, Y = -36 .. -10)
    g.fillSymSteppedLoftZ(195, 360, 6, 24, -36, 68, -10, 22, -32, 50, -12, M.HULL_MID, 4);
    g.fillSymSteppedLoftZ(360, 508, 5, 22, -32, 50, -12, 18, -25, 30, -15, M.HULL_PRIMARY, 3);
    g.fillSymX(18, -25, 494, 30, -15, 508, M.TRIM_OCHRE);

    // 3. Structural Tie-Braces between Upper & Lower Tines (with through-cavities!)
    for (const tz of [255, 345, 430]) {
      g.fillSymX(28, -12, tz, 42, 14, tz + 12, M.RIB_STEEL);
      g.fillSymX(32, -6, tz + 3, 38, 8, tz + 9, M.EMIT_CYAN_SOFT);
    }

    // 4. COLOSSAL MAIN BEAM CANNON (Z = +125 .. +486, centered at X=0, Y=0!)
    //    Anchored into deep bow spine, occupying the largest weapon volume on the ship!
    // Massive Forged Base Block (Z = +125 .. +250, X = -28..+28, Y = -22..+24)
    g.shellBox(-28, -22, 125, 28, 24, 250, 5, M.WEAPON_BODY);
    g.fillSymX(24, -16, 145, 32, 18, 235, M.RIB_STEEL);
    g.fillBox(-22, 22, 155, 22, 28, 240, M.HULL_MID);
    g.fillBox(-26, -20, 242, 26, 22, 250, M.TRIM_OCHRE);

    // Heavy Segmented Twin-Rail Cannon Barrel (Z = +250 .. +456, X = -19..+19, Y = -16..+16)
    g.shellBox(-19, -16, 250, 19, 16, 456, 4, M.WEAPON_BODY);
    // Upper & lower ceramic-titanium barrel shroud rails
    g.fillBox(-14, 15, 256, 14, 20, 446, M.HULL_PRIMARY);
    g.fillBox(-14, -20, 256, 14, -15, 446, M.HULL_PRIMARY);
    // Carve central barrel channel & 10 sequential capacitor slots along Z = +262 .. +442!
    g.carveBox(-9, -9, 260, 9, 9, 488);
    for (let i = 0; i < 10; i++) {
      const sz = 262 + i * 18;
      // Collar rib
      g.shellBox(-21, -21, sz, 21, 21, sz + 5, 3, M.RIB_STEEL);
      // Carve clean upper/lower capacitor recess in ceramic shroud & fill sequential glowing slots!
      g.carveBox(-11, 18, sz + 6, 11, 21, sz + 16);
      g.carveBox(-11, -21, sz + 6, 11, -18, sz + 16);
      g.fillSymX(18, -11, sz + 7, 21, 11, sz + 15, M.EMIT_CYAN_BRIGHT);
      g.fillBox(-10, 18, sz + 7, 10, 20, sz + 15, M.EMIT_CYAN_BRIGHT);
      g.fillBox(-10, -20, sz + 7, 10, -18, sz + 15, M.EMIT_CYAN_BRIGHT);
    }

    // Terraced Emitter Maw (Z = +450 .. +486)
    g.shellBox(-22, -19, 450, 22, 19, 474, 4, M.STRUCT_DARK);
    g.shellBox(-18, -15, 470, 18, 15, 486, 3, M.WEAPON_BODY);
    g.shellBox(-18, -15, 483, 18, 15, 486, 2, M.TRIM_OCHRE);
    g.carveBox(-12, -10, 452, 12, 10, 488);
    // Deep glowing focal lens inside cannon maw at Z = +454..+460
    g.fillBox(-11, -9, 452, 11, 9, 458, M.EMIT_WHITE_CYAN);
    g.fillSymX(11, -6, 464, 13, 6, 480, M.EMIT_CYAN_BRIGHT);

    // ------------------------------------------------------------------------
    // F. TERRACED 7-NOZZLE STERN (Z = -560 .. -435)
    // ------------------------------------------------------------------------
    // Stepped outer stern shroud framing the 7 nozzles
    g.shellBox(-88, -36, -495, 88, 38, -435, 5, M.HULL_MID);
    g.shellBox(-52, -44, -525, 52, 42, -475, 5, M.STRUCT_DARK);

    // 1. Central Colossal Twin-Chamber Main Nozzle (Z = -560)
    buildSteppedNozzle(g, 0, 0, -560, -485, 32, 24, 4, M.EMIT_CYAN_BRIGHT);
    thrusters.push({ pos: [0, 0, -558], radiusX: 30, radiusY: 22, length: 220 });

    // 2 & 3. Heavy Inner Flanking Nozzles (X = +-64, Y = +2, Z = -540)
    buildSteppedNozzle(g, -64, 2, -540, -472, 20, 19, 3, M.EMIT_CYAN_BRIGHT);
    buildSteppedNozzle(g,  64, 2, -540, -472, 20, 19, 3, M.EMIT_CYAN_BRIGHT);
    thrusters.push({ pos: [-64, 2, -538], radiusX: 18, radiusY: 17, length: 165 });
    thrusters.push({ pos: [ 64, 2, -538], radiusX: 18, radiusY: 17, length: 165 });

    // 4 & 5. Lower Ventral Auxiliary Nozzles (X = +-40, Y = -42, Z = -520)
    buildSteppedNozzle(g, -40, -42, -520, -460, 16, 13, 3, M.EMIT_CYAN_SOFT);
    buildSteppedNozzle(g,  40, -42, -520, -460, 16, 13, 3, M.EMIT_CYAN_SOFT);
    thrusters.push({ pos: [-40, -42, -518], radiusX: 14, radiusY: 11, length: 135 });
    thrusters.push({ pos: [ 40, -42, -518], radiusX: 14, radiusY: 11, length: 135 });

    // 6 & 7. Outer Cantilever Wing Nozzles (X = +-112, Y = +5, Z = -498)
    buildSteppedNozzle(g, -112, 5, -498, -445, 16, 13, 3, M.EMIT_CYAN_BRIGHT);
    buildSteppedNozzle(g,  112, 5, -498, -445, 16, 13, 3, M.EMIT_CYAN_BRIGHT);
    thrusters.push({ pos: [-112, 5, -496], radiusX: 14, radiusY: 11, length: 140 });
    thrusters.push({ pos: [ 112, 5, -496], radiusX: 14, radiusY: 11, length: 140 });

    // ------------------------------------------------------------------------
    // G. PULSE TURRET BARBETTE PEDESTALS & FLOATING POD COORDS
    // ------------------------------------------------------------------------
    const dorsalTurretCoords = [
      [-52, 46, 168], [52, 46, 168],
      [-62, 50,  62], [62, 50,  62],
      [-72, 50, -56], [72, 50, -56],
      [-66, 48, -250], [66, 48, -250]
    ];
    const cheekTurretCoords = [
      [-92, 22, 132], [92, 22, 132],
      [-58, 36, 265], [58, 36, 265]
    ];

    for (const [tx, ty, tz] of dorsalTurretCoords.concat(cheekTurretCoords)) {
      // Stepped octagonal/square voxel barbette collar on hull
      g.fillBox(tx - 11, ty - 6, tz - 11, tx + 11, ty + 2, tz + 11, M.STRUCT_DARK);
      g.fillBox(tx - 9, ty + 2, tz - 9, tx + 9, ty + 4, tz + 9, M.TRIM_OCHRE);
      pulseMounts.push({ pos: [tx, ty + 4, tz], side: Math.sign(tx) });
    }

    // 4 Floating Outrigger Pulse Pods hovering in architectural formation around upper shoulders
    floatingPodMounts.push(
      { pos: [-126, 62,  96], side: -1 },
      { pos: [ 126, 62,  96], side:  1 },
      { pos: [-118, 68, -72], side: -1 },
      { pos: [ 118, 68, -72], side:  1 }
    );

    return {
      mesh: meshVoxelGrid(g),
      thrusters,
      pulseMounts,
      floatingPodMounts,
      mainBeamMuzzle: [0, 2, 494],
      mainBeamStartZ: 260,
      portHangarMouth: { x: -138, y: 2, z: -220, widthZ: 132, heightY: 42 },
      hangarOrigin: [-68, 0, 0],
      bridgeOrigin: [0, 76, 42]
    };
  }

  // ==========================================================================
  // 1B. FLAGSHIP PULSE TURRET HEAD & FLOATING OUTRIGGER PULSE POD (voxelSize=1)
  // ==========================================================================
  function buildPulseTurretHead() {
    const g = new ChunkVoxelGrid();
    // Turret rotating cradle (X = -8..+8, Y = 0..10, Z = -10..+8)
    g.fillBox(-8, 0, -10, 8, 9, 8, M.HULL_PRIMARY);
    g.fillBox(-9, 1, -8, 9, 6, 4, M.STRUCT_DARK);
    g.fillBox(-6, 9, -7, 6, 11, 5, M.HULL_LIGHT);
    g.fillSymX(7, 2, -6, 9, 5, -2, M.TRIM_OCHRE);

    // Twin stepped heavy pulse barrels jutting forward along +Z (Z = +6 .. +24)
    g.fillSymX(3, 3, 6, 6, 7, 22, M.WEAPON_BODY);
    g.fillSymX(3, 7, 8, 6, 8, 17, M.HULL_MID);
    // Glowing recessed cyan emitter muzzles
    g.carveSymX(4, 4, 20, 5, 6, 23);
    g.fillSymX(4, 4, 19, 5, 6, 21, M.EMIT_CYAN_BRIGHT);
    // Side energy capacitor strip
    g.fillSymX(6, 4, 9, 7, 6, 16, M.EMIT_CYAN_SOFT);

    return {
      mesh: meshVoxelGrid(g),
      muzzles: [[-4.5, 5, 23], [4.5, 5, 23]]
    };
  }

  function buildFloatingPulsePod() {
    const g = new ChunkVoxelGrid();
    // Sleek cantilevered twin-tine floating pylon platform (X = -14..+14, Y = -8..+6, Z = -28..+28)
    g.fillSymSteppedLoftZ(-26, 28, 6, 4, -5, 14, 4, 3, -3, 8, 3, M.HULL_PRIMARY, 0);
    g.fillBox(-5, -6, -24, 5, 5, 18, M.STRUCT_DARK);
    g.fillBox(-9, 4, -14, 9, 6, 10, M.TRIM_OCHRE);
    // Hover field underside glow bars & aft micro-thruster
    g.fillSymX(6, -6, -16, 10, -5, 12, M.EMIT_CYAN_SOFT);
    g.fillBox(-4, -3, -28, 4, 2, -25, M.EMIT_CYAN_BRIGHT);
    return {
      mesh: meshVoxelGrid(g),
      turretMount: [0, 6, -2],
      thruster: { pos: [0, -0.5, -28], radiusX: 4, radiusY: 3, length: 26 }
    };
  }

  // ==========================================================================
  // 2. CLOSE-DEFENSE ESCORT: "AEGIS GUARD" (176 voxels long: Z = -88 .. +88)
  //    Compact, thick interlocking carapace + 6 CIWS Sponson Mounts
  // ==========================================================================
  function buildAegisGuard() {
    const g = new ChunkVoxelGrid();

    // Heavy central dark structural core (Z = -72 .. +62, X = -16..+16, Y = -14..+14)
    g.shellBox(-16, -14, -72, 16, 14, 62, 4, M.STRUCT_DARK);

    // Thick interlocking dorsal & ventral ceramic carapace plates
    g.fillSteppedLoftZ(-64, 54, 6, -22, 10, 22, 22, -16, 8, 16, 18, M.HULL_PRIMARY, 4);
    g.fillSteppedLoftZ(-58, 46, 6, -20, -21, 20, -9, -14, -17, 14, -8, M.HULL_MID, 4);
    // Calm raised dorsal ridge with ochre collar
    g.fillBox(-11, 21, -42, 11, 25, 26, M.HULL_LIGHT);
    g.fillBox(-13, 19, 20, 13, 23, 28, M.TRIM_OCHRE);
    // Command slit at Z = +28
    g.fillBox(-8, 18, 27, 8, 20, 30, M.EMIT_CYAN_BRIGHT);

    // Compact blunt twin-jaw stepped bow (Z = +46 .. +88, echoing fleet twin-tine motif!)
    g.fillSymSteppedLoftZ(46, 88, 5, 5, -12, 20, 14, 4, -8, 12, 9, M.HULL_PRIMARY, 3);
    g.fillSymX(4, -8, 82, 12, 9, 88, M.TRIM_OCHRE);
    // Deep recessed dark jaw notch & glowing bow sensor slot
    g.fillBox(-5, -6, 46, 5, 8, 64, M.TRENCH_ABYSS);
    g.fillBox(-3, -2, 62, 3, 4, 66, M.EMIT_CYAN_SOFT);

    // Stubby thick lateral armor shields / short wings (X = +-16 .. +-34, Z = -48 .. +32)
    g.fillSymSteppedLoftZ(-48, 32, 6, 16, -11, 34, 11, 16, -8, 28, 9, M.HULL_MID, 4);
    g.carveSymX(28, -2, -36, 35, 3, 20);
    g.fillSymX(26, -1, -32, 29, 2, 16, M.EMIT_CYAN_SOFT);

    // 6 Prominent Raised CIWS Point-Defense Sponsons
    const ciwsMounts = [
      { pos: [-17, 19,  32], up:  1 },
      { pos: [ 17, 19,  32], up:  1 },
      { pos: [-27, 12, -14], up:  1 },
      { pos: [ 27, 12, -14], up:  1 },
      { pos: [-16, -19, 14], up: -1 },
      { pos: [ 16, -19, 14], up: -1 }
    ];
    for (const m of ciwsMounts) {
      const [mx, my, mz] = m.pos;
      const sy = m.up > 0 ? my - 4 : my;
      g.fillBox(mx - 6, sy, mz - 6, mx + 6, sy + 4, mz + 6, M.RIB_STEEL);
      g.fillBox(mx - 5, m.up > 0 ? my - 1 : my - 1, mz - 5, mx + 5, m.up > 0 ? my + 1 : my + 1, mz + 5, M.TRIM_OCHRE);
    }

    // Stout twin-nozzle stepped stern (Z = -88 .. -64)
    g.shellBox(-24, -16, -78, 24, 16, -60, 4, M.STRUCT_DARK);
    buildSteppedNozzle(g, -11, 0, -88, -66, 9, 10, 2, M.EMIT_CYAN_BRIGHT);
    buildSteppedNozzle(g,  11, 0, -88, -66, 9, 10, 2, M.EMIT_CYAN_BRIGHT);

    return {
      mesh: meshVoxelGrid(g),
      ciwsMounts,
      thrusters: [
        { pos: [-11, 0, -87], radiusX: 8, radiusY: 9, length: 64 },
        { pos: [ 11, 0, -87], radiusX: 8, radiusY: 9, length: 64 }
      ]
    };
  }

  // Articulating Rapid-Fire CIWS Turret (1x1x1 voxel grid)
  function buildCIWSTurret() {
    const g = new ChunkVoxelGrid();
    g.fillBox(-4, 0, -5, 4, 5, 4, M.STRUCT_DARK);
    g.fillBox(-3, 5, -4, 3, 6, 3, M.HULL_LIGHT);
    // Twin rapid-fire stepped rotary-style barrels jutting cleanly forward (Z = +4 .. +14)
    g.fillSymX(1, 2, 4, 3, 4, 13, M.WEAPON_BODY);
    g.fillSymX(2, 3, 13, 2, 3, 15, M.TRIM_SILVER);
    g.fillSymX(1, 3, 6, 3, 5, 9, M.TRIM_OCHRE);
    return {
      mesh: meshVoxelGrid(g),
      muzzles: [[-2, 3, 15.5], [2, 3, 15.5]]
    };
  }

  // ==========================================================================
  // 3. VANGUARD MISSILE CRUISER: "LANCE VANGUARD" (208 voxels: Z = -104 .. +104)
  //    Elongated twin-tine spearhead + Wide Cantilevered Missile Silo Wings
  // ==========================================================================
  function buildLanceVanguard() {
    const g = new ChunkVoxelGrid();
    const launchCells = [];

    // Slender elongated central fuselage (Z = -86 .. +42, X = -14..+14, Y = -11..+13)
    g.shellBox(-14, -11, -86, 14, 13, 42, 3, M.STRUCT_DARK);
    g.fillSteppedLoftZ(-78, 48, 8, -16, 10, 16, 17, -11, 8, 11, 15, M.HULL_PRIMARY, 3);
    g.fillSteppedLoftZ(-72, 36, 8, -13, -15, 13, -9, -9, -13, 9, -8, M.HULL_MID, 3);
    // Sleek dorsal bridge fin
    g.fillBox(-7, 16, -28, 7, 21, 14, M.HULL_LIGHT);
    g.fillBox(-6, 17, 13, 6, 19, 16, M.EMIT_CYAN_BRIGHT);

    // Long graceful forward twin-tine needle prow (Z = +36 .. +104, 68 voxels of reach!)
    g.fillSymSteppedLoftZ(36, 104, 6, 4, -6, 16, 10, 3, -3, 8, 4, M.HULL_LIGHT, 0);
    g.fillSymX(3, -3, 96, 8, 4, 104, M.TRIM_OCHRE);
    // Glowing central conduit rail between forward tines
    g.fillBox(-2, -2, 32, 2, 3, 62, M.TRENCH_ABYSS);
    g.fillBox(-1, 0, 36, 1, 2, 60, M.EMIT_CYAN_SOFT);

    // Wide Swept-Outward Cantilevered Missile Launch Wings (X = +-15 .. +-47, Z = -52 .. +34)
    g.fillSymSteppedLoftZ(-52, 34, 6, 15, -7, 47, 8, 15, -5, 42, 7, M.HULL_PRIMARY, 3);
    g.fillSymX(42, -3, -48, 48, 5, 26, M.HULL_MID);
    g.fillSymX(45, 0, -42, 48, 2, 20, M.EMIT_CYAN_SOFT);
    g.fillSymX(20, 6, 26, 42, 9, 34, M.TRIM_OCHRE);

    // Carve 2x4 = 8 Recessed Vertical/Forward-Cantilevered Missile Silo Cells on EACH wing (16 total!)
    const cellXs = [22, 33];
    const cellZs = [16, 0, -16, -32];
    for (const side of [-1, 1]) {
      for (const cxAbs of cellXs) {
        for (const cz of cellZs) {
          const cx = side * cxAbs;
          // Recessed gunmetal cell collar & deep shaft
          g.fillBox(cx - 4, -5, cz - 5, cx + 4, 9, cz + 5, M.STRUCT_DARK);
          g.carveBox(cx - 3, -3, cz - 3, cx + 3, 10, cz + 3);
          // Open hatch lip in ochre
          g.fillBox(cx - 4, 8, cz - 5, cx + 4, 9, cz - 4, M.TRIM_OCHRE);
          g.fillBox(cx - 4, 8, cz + 4, cx + 4, 9, cz + 5, M.TRIM_OCHRE);
          // Visible seated missile nose cone peeking inside silo!
          g.fillBox(cx - 1, 2, cz - 1, cx + 1, 6, cz + 1, M.HULL_LIGHT);
          g.fillBox(cx - 1, 6, cz - 1, cx + 1, 7, cz + 1, M.EMIT_AMBER_HOT);
          launchCells.push({ pos: [cx, 9, cz], side });
        }
      }
    }

    // Wide Low-Profile 3-Nozzle Stern (Z = -104 .. -80)
    g.shellBox(-30, -10, -94, 30, 11, -78, 3, M.STRUCT_DARK);
    buildSteppedNozzle(g,   0, 0, -104, -82, 8, 8, 2, M.EMIT_CYAN_BRIGHT);
    buildSteppedNozzle(g, -20, 0, -100, -80, 7, 6, 2, M.EMIT_CYAN_SOFT);
    buildSteppedNozzle(g,  20, 0, -100, -80, 7, 6, 2, M.EMIT_CYAN_SOFT);

    return {
      mesh: meshVoxelGrid(g),
      launchCells,
      thrusters: [
        { pos: [  0, 0, -103], radiusX: 7, radiusY: 7, length: 78 },
        { pos: [-20, 0,  -99], radiusX: 6, radiusY: 5, length: 58 },
        { pos: [ 20, 0,  -99], radiusX: 6, radiusY: 5, length: 58 }
      ]
    };
  }

  // Physical Voxel Missile (18 voxels long: Z = -9 .. +9, X = -2..+2, Y = -2..+2, voxelSize = 1.0!)
  function buildVoxelMissile() {
    const g = new ChunkVoxelGrid();
    // Main cylindrical/cruciform ceramic body
    g.fillBox(-1, -1, -7, 1, 1, 6, M.HULL_LIGHT);
    // Mid ordnance collar
    g.fillBox(-1, -1, 1, 1, 1, 3, M.TRIM_OCHRE);
    // Warhead tip (+Z)
    g.fillBox(-1, -1, 6, 1, 1, 7, M.EMIT_AMBER_SOFT);
    g.fillBox(0, 0, 7, 0, 0, 9, M.EMIT_AMBER_HOT);
    // 4 Cruciform tail fins (-Z)
    g.fillBox(-2, 0, -8, 2, 0, -4, M.WEAPON_BODY);
    g.fillBox(0, -2, -8, 0, 2, -4, M.WEAPON_BODY);
    // Forward canard fins
    g.fillBox(-2, 0, 3, 2, 0, 4, M.STRUCT_DARK);
    // Glowing rocket motor nozzle
    g.fillBox(-1, -1, -9, 1, 1, -8, M.EMIT_CYAN_BRIGHT);
    return {
      mesh: meshVoxelGrid(g, { ao: false })
    };
  }

  // ==========================================================================
  // 4. FLEET SHUTTLE: "DART TENDER" (28 voxels long: Z = -14 .. +14, 15 wide, 8 tall)
  //    Distills the fleet's twin-tine motif into a crisp 1/40th-scale craft!
  // ==========================================================================
  function buildDartShuttle() {
    const g = new ChunkVoxelGrid();
    // Main fuselage (Z = -12 .. +8, X = -3..+3, Y = -2..+2)
    g.fillBox(-3, -2, -11, 3, 2, 7, M.HULL_PRIMARY);
    g.fillBox(-2, 2, -8, 2, 3, 4, M.HULL_LIGHT);
    // Twin-tine notched nose (Z = +7 .. +14, X = +-1..+-3)
    g.fillSymX(1, -1, 7, 3, 1, 12, M.HULL_LIGHT);
    g.fillSymX(2, 0, 12, 3, 1, 14, M.TRIM_OCHRE);
    // Smoked canopy & cockpit glow
    g.fillBox(-2, 2, 3, 2, 3, 7, M.STRUCT_DARK);
    g.fillBox(-1, 2, 5, 1, 3, 7, M.EMIT_CYAN_SOFT);
    // Cantilevered stub winglets (X = +-4..+-7, Z = -9 .. +2)
    g.fillSymX(4, -1, -9, 7, 1, 2, M.HULL_MID);
    g.fillSymX(7, 0, -8, 7, 1, 0, M.TRIM_OCHRE);
    // Underside landing skids
    g.fillSymX(2, -3, -8, 3, -2, 4, M.STRUCT_DARK);
    // Twin rear thruster nozzles at Z = -14 .. -11 (recessed dark collar around 1x1 cyan throat!)
    g.fillSymX(1, -1, -14, 3, 1, -11, M.WEAPON_BODY);
    g.fillSymX(2, 0, -14, 2, 0, -13, M.EMIT_CYAN_BRIGHT);

    return {
      mesh: meshVoxelGrid(g),
      thrusters: [
        { pos: [-2, 0, -14], radiusX: 1.4, radiusY: 1.4, length: 14 },
        { pos: [ 2, 0, -14], radiusX: 1.4, radiusY: 1.4, length: 14 }
      ]
    };
  }

  SF.Ships = {
    buildFlagship,
    buildPulseTurretHead,
    buildFloatingPulsePod,
    buildAegisGuard,
    buildCIWSTurret,
    buildLanceVanguard,
    buildVoxelMissile,
    buildDartShuttle
  };
})(window);
