import { clamp, lerp, smoothstep, pulseWindow } from './prng.js';

// Curated Sunshower Japanese Harbor Palette (High-key, Sea-glass Cyan, Teal Shadows, Warm Gold Accents)
export const PALETTE = {
  skyZenith: 0xc2e6ee,
  skyHorizon: 0xe6f6f7,
  skySunGlow: 0xfff8e2,
  fogColor: 0xd9f0f3,

  sunLight: 0xfff3cf,
  skyAmbient: 0xcce8ef,
  groundBounce: 0x8abec4,
  shadowTeal: 0x2c6070,       // Deep sea-teal shadow (never muddy black)
  inkOutline: 0x264e5b,       // Crisp delicate blue-teal ink line

  concreteLight: 0xe3e9ea,
  concreteMid: 0xcdd6d8,
  concreteWet: 0xb7c5c9,
  seawallBlock: 0xbac5c7,
  seawallTide: 0x5c7573,
  plinthTrim: 0x455a61,

  waterShallow: 0x6fd0cb,
  waterMid: 0x43afa9,
  waterDeep: 0x215c73,
  waterCrossSection: 0x48b8b2,
  foamWhite: 0xf4fcfc,

  boatWhite: 0xf5fafa,
  boatDeck: 0xdbe6e8,
  boatTrimBlue: 0x3b849e,
  boatTrimTeal: 0x2f7d7d,
  boatRust: 0xb56545,

  hazardYellow: 0xf2c138,
  hazardBlack: 0x2a353b,
  ropeOrange: 0xe26a3b,
  ropeWet: 0x8e3b22,
  lifebuoyOrange: 0xee6d38,
  raincoatYellow: 0xf4c842,
  brassGold: 0xffe28a,

  bollardBlack: 0x263137,
  lighthouseRed: 0xd9534a,
  lighthouseWhite: 0xf7fbfb,
  woodWarm: 0xb88658,
  woodWeathered: 0x8c7b6b,
  roofTile: 0x475b66,
  foliageDark: 0x387568,
  foliageMid: 0x52957b,
  foliageLight: 0x79ba8e,
};

export const WORLD_CYCLE = 60.0; // Matches 60s tour cleanly and loops seamlessly in live mode

/**
 * Evaluates global sunshower weather state deterministically at time `t` (seconds).
 * Coordinates gusts, cloud passes, rain density, rainbow, and rare daytime lighthouse lamp
 * so at most ONE major atmospheric event happens at any moment.
 */
export function evaluateWeather(t) {
  const tc = ((t % WORLD_CYCLE) + WORLD_CYCLE) % WORLD_CYCLE;

  // 1. Rain density: oscillates gently between light drizzle (0.30) and fuller sunshower (0.85)
  // Lulls around tc = 10..22s (cat strolls, faint rainbow appears) and 53..59s
  let rainDensity = 0.56
    - 0.26 * pulseWindow(tc, 8.5, 11.5, 19.5, 23.0)
    + 0.28 * pulseWindow(tc, 23.5, 26.5, 34.0, 38.5)
    - 0.18 * pulseWindow(tc, 52.0, 54.5, 58.0, 59.8);
  rainDensity = clamp(rainDensity, 0.26, 0.88);

  // 2. Faint anime rainbow appears briefly when rain eases (around tc = 11.0 .. 20.5s)
  const rainbowOpacity = 0.34 * pulseWindow(tc, 10.8, 13.2, 17.8, 21.0);

  // 3. Sea Gust #1 (tc = 23.8 .. 31.2s): sweeps from outer sea (+X, -Z) toward quay & hillside (-X, +Z)
  // Also a gentle minor breeze swell around tc = 0..4s
  const gust1Active = pulseWindow(tc, 23.5, 24.8, 29.0, 31.8);
  // Gust wave-front distance traveled across the harbor (starts at -22, sweeps to +32 at 6.2 u/s)
  const gust1Front = (tc - 23.5) * 6.2 - 20.0;

  // 4. Thin cloud drifting over the sun:
  // Sweep 1: subtle thin cloud edge around tc = 18..22s (very mild)
  // Sweep 2: main cloud shadow + rare daytime lighthouse moment around tc = 47.5 .. 53.8s!
  const cloudEvent = pulseWindow(tc, 47.2, 49.0, 52.0, 54.2);
  // Cloud band position sweeping along axis (-0.75*x + 0.66*z) from -28 to +28
  const cloudCenter = lerp(-32, 32, clamp((tc - 46.5) / 8.2, 0, 1));

  // Rare daytime dimming that triggers the small breakwater lighthouse to glow once in daylight!
  const skyDimming = 0.36 * pulseWindow(tc, 48.2, 49.6, 52.2, 53.8);
  const lighthouseDayGlow = pulseWindow(tc, 48.6, 49.5, 52.4, 53.5);

  // Base steady gentle sea breeze
  const baseBreeze = 0.22 + 0.06 * Math.sin(t * 0.7) + 0.04 * Math.sin(t * 1.31);

  return {
    tc,
    rainDensity,
    rainbowOpacity,
    gust1Active,
    gust1Front,
    cloudEvent,
    cloudCenter,
    skyDimming,
    lighthouseDayGlow,
    baseBreeze,
  };
}

/**
 * Spatial wind strength at world position (x, z) at time t.
 * Sea gust originates from outer sea (+X, -Z) and propagates along (-0.76, +0.65)
 * so water ripples -> breakwater flag -> quay nets/floats -> hillside trees react IN SEQUENCE!
 */
export function getWindAt(x, z, t, weather) {
  const w = weather || evaluateWeather(t);
  // Projection along gust travel path: outer sea (+18, -18) has proj ~ -25.4; hillside (-16, -15) / quay (-12, +10) has proj > 0
  const proj = -0.76 * x + 0.65 * z;
  const distBehindFront = w.gust1Front - proj;
  // Bell-shaped gust envelope behind the advancing wave front (width ~ 16 units)
  let localGust = 0;
  if (w.gust1Active > 0.001 && distBehindFront > -2.0 && distBehindFront < 22.0) {
    const rise = smoothstep(-2.0, 3.5, distBehindFront);
    const fall = 1.0 - smoothstep(10.0, 22.0, distBehindFront);
    localGust = rise * fall * w.gust1Active * 0.85;
  }
  const flutter = 0.06 * Math.sin(t * 3.1 - proj * 0.35) + 0.04 * Math.sin(t * 5.3 - proj * 0.5);
  return {
    strength: w.baseBreeze + localGust + flutter * (0.4 + localGust),
    gustOnly: localGust,
    dirX: -0.76,
    dirZ: 0.65,
  };
}

/**
 * Spatial sunlight multiplier (0.35 .. 1.0) at world position (x, z) as thin clouds pass.
 */
export function getSunlightAt(x, z, weather) {
  if (weather.cloudEvent <= 0.001) return 1.0;
  const axis = -0.75 * x + 0.66 * z;
  const dist = Math.abs(axis - weather.cloudCenter);
  const bandShadow = (1.0 - smoothstep(4.0, 15.0, dist)) * weather.cloudEvent * 0.58;
  return clamp(1.0 - bandShadow, 0.36, 1.0);
}
