// ============================================================================
// 02_palette_materials.js
// Unified Fleet Color Language, Asteroid Strata & Voxel Material Definitions
// ============================================================================
(function (global) {
  'use strict';

  const SF = (global.StarFleet = global.StarFleet || {});

  const ID = {
    AIR: 0,
    // Fleet Primary Hull (Ceramic-Titanium Stepped Laminae)
    HULL_PRIMARY: 1,
    HULL_LIGHT: 2,
    HULL_MID: 3,

    // Fleet Secondary Deep Structure (Carbon-Obsidian & Gunmetal Ribs)
    STRUCT_DARK: 4,
    TRENCH_ABYSS: 5,
    RIB_STEEL: 6,
    WEAPON_BODY: 7,

    // Metallic Accents
    TRIM_OCHRE: 8,
    TRIM_SILVER: 9,

    // Solid Emissive Voxel Elements (keep 1x1x1 voxel cell structure!)
    EMIT_CYAN_SOFT: 10,
    EMIT_CYAN_BRIGHT: 11,
    EMIT_AZURE_DEEP: 12,
    EMIT_AMBER_SOFT: 13,
    EMIT_AMBER_HOT: 14,
    EMIT_WHITE_CYAN: 15,

    // Interior Architectural Surfaces
    DECK_DARK: 16,
    DECK_MARK: 17,

    // Asteroid Geological Strata & Fracture Planes
    ROCK_LIGHT: 20,
    ROCK_MID: 21,
    ROCK_DARK: 22,
    ROCK_OCHRE: 23,
    ROCK_FRACTURE_COOL: 24,
    ROCK_FRACTURE_VEIN: 25,

    // Translucent Solid Voxel Elements (>= 40)
    TRANS_CYAN_HOLO: 40,
    TRANS_AMBER_HOLO: 41,
    TRANS_GLASS_DARK: 42,
    TRANS_CORE_CRYSTAL: 43
  };

  function hexToLinear(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    const sr = ((n >> 16) & 255) / 255;
    const sg = ((n >> 8) & 255) / 255;
    const sb = (n & 255) / 255;
    return [
      Math.pow(sr, 2.2),
      Math.pow(sg, 2.2),
      Math.pow(sb, 2.2)
    ];
  }

  const MAX_MATS = 64;
  // Packed float arrays for GPU uniform upload:
  // matDataA[i*4 + 0..3] = [albedoR, albedoG, albedoB, roughness]
  // matDataB[i*4 + 0..3] = [emissiveR, emissiveG, emissiveB, metallic + floor(edgeStrength*10)*0 -> let's store metallic in .w and alpha/flags in matDataC]
  const matDataA = new Float32Array(MAX_MATS * 4);
  const matDataB = new Float32Array(MAX_MATS * 4);
  const matDataC = new Float32Array(MAX_MATS * 4); // [metallic, edgeHighlight, alpha, flags]
  const isTranslucent = new Uint8Array(MAX_MATS);

  function defMat(id, opts) {
    const alb = hexToLinear(opts.albedo || '#808080');
    const emi = opts.emissiveColor ? hexToLinear(opts.emissiveColor) : [0, 0, 0];
    const emiInt = opts.emissive || 0.0;
    const rough = opts.roughness !== undefined ? opts.roughness : 0.5;
    const metal = opts.metallic !== undefined ? opts.metallic : 0.2;
    const edge = opts.edge !== undefined ? opts.edge : 0.5;
    const alpha = opts.alpha !== undefined ? opts.alpha : 1.0;
    const flags = opts.flags || 0.0; // 1 = dynamic emissive channel, 2 = fracture face

    const o = id * 4;
    matDataA[o + 0] = alb[0];
    matDataA[o + 1] = alb[1];
    matDataA[o + 2] = alb[2];
    matDataA[o + 3] = rough;

    matDataB[o + 0] = emi[0] * emiInt;
    matDataB[o + 1] = emi[1] * emiInt;
    matDataB[o + 2] = emi[2] * emiInt;
    matDataB[o + 3] = emiInt;

    matDataC[o + 0] = metal;
    matDataC[o + 1] = edge;
    matDataC[o + 2] = alpha;
    matDataC[o + 3] = flags;

    if (alpha < 0.999) {
      isTranslucent[id] = 1;
    }
  }

  // --- Populate Unified Fleet & World Palette ---
  // 1. Primary Hull Laminae: broad soft reflection + crisp bevel edge highlight
  defMat(ID.HULL_PRIMARY, { albedo: '#CFD8E4', roughness: 0.43, metallic: 0.28, edge: 0.95 });
  defMat(ID.HULL_LIGHT,   { albedo: '#E3EBF5', roughness: 0.36, metallic: 0.34, edge: 1.00 });
  defMat(ID.HULL_MID,     { albedo: '#9AA8BC', roughness: 0.47, metallic: 0.32, edge: 0.85 });

  // 2. Deep Recessed Structure: absorbs more light, frames bright laminae
  defMat(ID.STRUCT_DARK,  { albedo: '#272F3D', roughness: 0.64, metallic: 0.45, edge: 0.62 });
  defMat(ID.TRENCH_ABYSS, { albedo: '#141923', roughness: 0.80, metallic: 0.22, edge: 0.25 });
  defMat(ID.RIB_STEEL,    { albedo: '#404A5C', roughness: 0.50, metallic: 0.58, edge: 0.88 });
  defMat(ID.WEAPON_BODY,  { albedo: '#323A48', roughness: 0.44, metallic: 0.64, edge: 0.96 });

  // 3. Collar & Trim Accents
  defMat(ID.TRIM_OCHRE,   { albedo: '#CE8E3F', roughness: 0.34, metallic: 0.78, edge: 1.00 });
  defMat(ID.TRIM_SILVER,  { albedo: '#DCE6F4', roughness: 0.26, metallic: 0.82, edge: 1.00 });

  // 4. Solid Emissive Voxel Components (flags = 1 allows optional dynamic modulation per draw)
  defMat(ID.EMIT_CYAN_SOFT,   { albedo: '#185068', roughness: 0.30, metallic: 0.1, edge: 0.5, emissiveColor: '#22CEFF', emissive: 1.85, flags: 1 });
  defMat(ID.EMIT_CYAN_BRIGHT, { albedo: '#40A8C8', roughness: 0.22, metallic: 0.1, edge: 0.6, emissiveColor: '#5AF2FF', emissive: 4.20, flags: 1 });
  defMat(ID.EMIT_AZURE_DEEP,  { albedo: '#123870', roughness: 0.32, metallic: 0.1, edge: 0.5, emissiveColor: '#1E8EFF', emissive: 2.30, flags: 1 });
  defMat(ID.EMIT_AMBER_SOFT,  { albedo: '#683812', roughness: 0.32, metallic: 0.1, edge: 0.5, emissiveColor: '#FF9828', emissive: 2.20, flags: 1 });
  defMat(ID.EMIT_AMBER_HOT,   { albedo: '#905818', roughness: 0.24, metallic: 0.1, edge: 0.6, emissiveColor: '#FFC456', emissive: 4.10, flags: 1 });
  defMat(ID.EMIT_WHITE_CYAN,  { albedo: '#88E8FF', roughness: 0.18, metallic: 0.1, edge: 0.7, emissiveColor: '#B8FAFF', emissive: 5.80, flags: 1 });

  // 5. Interior Decking
  defMat(ID.DECK_DARK,    { albedo: '#1F2633', roughness: 0.56, metallic: 0.36, edge: 0.55 });
  defMat(ID.DECK_MARK,    { albedo: '#6D7C92', roughness: 0.48, metallic: 0.40, edge: 0.72 });

  // 6. Voxel Asteroid Strata & Fracture Surfaces
  defMat(ID.ROCK_LIGHT,         { albedo: '#837C75', roughness: 0.86, metallic: 0.05, edge: 0.26 });
  defMat(ID.ROCK_MID,           { albedo: '#5C5654', roughness: 0.89, metallic: 0.06, edge: 0.20 });
  defMat(ID.ROCK_DARK,          { albedo: '#343035', roughness: 0.93, metallic: 0.08, edge: 0.14 });
  defMat(ID.ROCK_OCHRE,         { albedo: '#725B4A', roughness: 0.85, metallic: 0.12, edge: 0.24 });
  defMat(ID.ROCK_FRACTURE_COOL, { albedo: '#494043', roughness: 0.76, metallic: 0.16, edge: 0.36, flags: 2 });
  defMat(ID.ROCK_FRACTURE_VEIN, { albedo: '#66483A', roughness: 0.70, metallic: 0.18, edge: 0.42, flags: 3 });

  // 7. Translucent Solid Voxels (keep 1x1x1 crystalline block granularity!)
  defMat(ID.TRANS_CYAN_HOLO,    { albedo: '#1C90B8', roughness: 0.18, metallic: 0.10, edge: 0.95, alpha: 0.46, emissiveColor: '#36E6FF', emissive: 2.00, flags: 1 });
  defMat(ID.TRANS_AMBER_HOLO,   { albedo: '#A85818', roughness: 0.18, metallic: 0.10, edge: 0.95, alpha: 0.54, emissiveColor: '#FF9E30', emissive: 2.40, flags: 1 });
  defMat(ID.TRANS_GLASS_DARK,   { albedo: '#3C5C7E', roughness: 0.14, metallic: 0.20, edge: 0.85, alpha: 0.36, emissiveColor: '#1E6898', emissive: 0.25 });
  defMat(ID.TRANS_CORE_CRYSTAL, { albedo: '#34B8DC', roughness: 0.15, metallic: 0.15, edge: 1.00, alpha: 0.62, emissiveColor: '#66F4FF', emissive: 3.10, flags: 1 });

  SF.MAT = ID;
  SF.Palette = {
    MAX_MATS,
    matDataA,
    matDataB,
    matDataC,
    isTranslucent,
    hexToLinear
  };
})(window);
