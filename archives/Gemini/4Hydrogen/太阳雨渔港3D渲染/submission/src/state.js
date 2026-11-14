import * as THREE from 'three';

export const BASE_HALF = 19.0;
export const SLAB_BOTTOM = -5.0;
export const WATER_Y = 0.0;
export const QUAY_Y = 1.4;
export const LANDING_Y = 0.55;
export const TOUR_DURATION = 60.0;

// Shared environment uniforms updated every simulation step and read by toon/water/atmosphere shaders
export const ENV_UNIFORMS = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.58, 0.70, 0.41).normalize() },
  uSunIntensity: { value: 1.0 },
  uCloudCenter: { value: new THREE.Vector2(-24, -24) },
  uCloudRadius: { value: new THREE.Vector2(15, 11) },
  uCloudStrength: { value: 0.0 },
  uWindVec: { value: new THREE.Vector2(-0.78, 0.46) },
  uGustFrontPos: { value: 40.0 },
  uGustStrength: { value: 0.0 },
  uRainDensity: { value: 0.72 },
  uBoat4Pos: { value: new THREE.Vector2(5.5, 5.5) },
  uBoat4Dir: { value: new THREE.Vector2(0, -1) },
  uBoat4Speed: { value: 0.0 },
  uWakeTime: { value: -100.0 },
};

// Deterministic pseudo-random helper
export function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function pulse(start, peakIn, peakOut, end, t) {
  if (t <= start || t >= end) return 0;
  if (t < peakIn) return smoothstep(start, peakIn, t);
  if (t > peakOut) return 1 - smoothstep(peakOut, end, t);
  return 1;
}

// Check if (x, z) lies on the concrete quay / hillside / breakwater footprint
export function isLandXZ(x, z) {
  // West Quay & Hillside
  if (x <= -5.0 && z <= 5.5) return true;
  // Foreground South Quay
  if (x <= 3.5 && z > 5.5) return true;
  // Lower Boarding Platform
  if (x > 3.5 && x <= 5.4 && z >= 7.6 && z <= 12.2) return true;
  // Short Breakwater
  if (x >= -5.5 && x <= 4.3 && z >= -12.6 && z <= -9.8) return true;
  // Lighthouse Pierhead
  const dx = x - 4.2;
  const dz = z + 11.2;
  if (dx * dx + dz * dz <= 2.1 * 2.1) return true;
  return false;
}

// Seabed height across the diorama (always well above SLAB_BOTTOM = -5.0)
export function getSeabedY(x, z) {
  // Distance from main quay edges makes seabed slope gently deeper toward the outer +X / -Z harbor
  const distFromWest = Math.max(0, x + 5.0);
  const distFromSouth = Math.max(0, 5.5 - z);
  const eastDepth = smoothstep(0, 14, distFromWest) * 0.95;
  const northDepth = smoothstep(0, 14, distFromSouth) * 0.45;
  const outerDrop = smoothstep(3.5, 16.0, x) * 0.35;
  const ripple =
    0.16 * Math.sin(x * 0.37 + 0.8) * Math.cos(z * 0.41 - 0.5) +
    0.08 * Math.sin(x * 0.85 - z * 0.65);

  let y = -2.15 - eastDepth - northDepth - outerDrop + ripple;

  // Slipway zone slopes shallower near X in [0.5, 7.5], Z in [12.4, 16.2]
  if (x > 2.5 && x < 8.5 && z > 11.8 && z < 16.8) {
    const t = smoothstep(3.5, 8.5, x);
    const slipY = -0.35 * (1 - t) + -2.2 * t;
    y = Math.max(y, slipY);
  }
  return Math.max(-3.75, Math.min(-1.55, y));
}

// Water surface wave height at (x, z, t) — matches water shader & boat buoyancy
export function getWaterHeight(x, z, t) {
  const w1 = 0.032 * Math.sin(x * 0.68 + z * 0.42 + t * 1.35);
  const w2 = 0.022 * Math.cos(x * 0.51 - z * 0.82 + t * 1.05);
  const w3 = 0.014 * Math.sin(x * 1.35 + z * 1.15 - t * 2.15);
  const gust = ENV_UNIFORMS.uGustStrength.value;
  const gustWave = gust * 0.024 * Math.sin((x * 0.9 - z * 0.55) * 1.8 + t * 4.5);
  return w1 + w2 + w3 + gustWave;
}

// Exact slipway deck top height along X in [0.5, 6.2], Z in [12.6, 16.0]
export function getSlipwayY(x) {
  const u = Math.max(0, Math.min(1, (x - 0.5) / 5.7));
  return QUAY_Y + (-0.45 - QUAY_Y) * u;
}

// Evaluate Boat 4's cruise trajectory (departs at t=52.0s, loops gracefully around breakwater & returns at t=84s)
// Repeats every 90s in free-run mode so tour [0..60s] catches departure cleanly at 55.5s..60s
export function evalBoat4Trajectory(simTime) {
  const period = 90.0;
  const phase = ((simTime % period) + period) % period;
  const departStart = 50.0;
  const returnEnd = 82.0;

  const restPos = new THREE.Vector3(6.62, 0, 9.4);
  const restYaw = 0; // facing -Z (North toward harbor mouth)

  if (phase < departStart || phase > returnEnd) {
    return {
      active: false,
      u: 0,
      pos: restPos,
      yaw: restYaw,
      speed: 0,
      wakeProgress: 0,
    };
  }

  const rawU = (phase - departStart) / (returnEnd - departStart);
  // Smooth ease-in at departure and ease-out at docking
  const u = rawU < 0.12
    ? (rawU / 0.12) * (rawU / 0.12) * 0.08
    : rawU > 0.88
      ? 1.0 - Math.pow((1.0 - rawU) / 0.12, 2) * 0.08
      : 0.08 + ((rawU - 0.12) / 0.76) * 0.84;

  // Catmull-Rom closed/looping path out past lighthouse pierhead, curving gracefully in outer harbor
  const pts = [
    new THREE.Vector3(6.62, 0, 9.4),  // Berth alongside lower boarding platform
    new THREE.Vector3(8.5, 0, 2.2),   // Pulling out into deep fairway channel
    new THREE.Vector3(11.4, 0, -7.2), // Clearing breakwater tip & submerged stone berm
    new THREE.Vector3(12.6, 0, -14.5),// Rounding lighthouse with clean berm clearance
    new THREE.Vector3(15.6, 0, -14.6),// Outer northeast turn
    new THREE.Vector3(15.8, 0, -5.2), // Outer east leg
    new THREE.Vector3(15.0, 0, 5.5),  // Outer southeast leg
    new THREE.Vector3(12.2, 0, 12.6), // Turning back toward berth
    new THREE.Vector3(8.2, 0, 12.0),  // Lining up approach
    new THREE.Vector3(6.62, 0, 9.4),  // Docked back at berth
  ];

  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.45);
  const pos = curve.getPointAt(Math.max(0, Math.min(1, u)));
  const tangent = curve.getTangentAt(Math.max(0, Math.min(1, u)));
  const yaw = Math.atan2(-tangent.x, -tangent.z);

  const speedBell = pulse(0.0, 0.12, 0.85, 1.0, rawU);
  // Smooth blend back to restYaw right before docking
  const dockBlend = smoothstep(0.90, 1.0, rawU);
  const finalYaw = yaw + dockBlend * (Math.atan2(Math.sin(restYaw - yaw), Math.cos(restYaw - yaw)));

  return {
    active: true,
    u: rawU,
    pos,
    yaw: finalYaw,
    speed: speedBell,
    wakeProgress: rawU,
  };
}

export function createSimulationState() {
  return {
    simTime: 0,
    exportMode: false,
    cameraPos: new THREE.Vector3(24, 14, 25),
    cameraTarget: new THREE.Vector3(-1.5, 1.8, -1.0),
    // Stateful reactive elements stepped deterministically at 60Hz
    gullFleeTimer: 0,      // >0 when bollard gull has taken off due to camera proximity
    fishScatterAmount: 0, // 0..1 radial scatter intensity
    fishCooldown: 0,
    catLookAmount: 0,     // 0..1 head-lift gaze toward camera
    drips: [],
    ripples: [],
    gustProgress: -1,
  };
}

export function resetSimulationState(sim) {
  sim.simTime = 0;
  sim.gullFleeTimer = 0;
  sim.fishScatterAmount = 0;
  sim.fishCooldown = 0;
  sim.catLookAmount = 0;
  sim.drips.length = 0;
  sim.ripples.length = 0;
  sim.gustProgress = -1;
  updateEnvironmentAtTime(sim, 0, 0);
}

// Deterministic environment evaluation + fixed-step reactive updates
export function updateEnvironmentAtTime(sim, t, dt) {
  sim.simTime = t;
  ENV_UNIFORMS.uTime.value = t;

  // 1. Rain intensity undulation (always solar rain; dips softly around t=52.5..55.5 for rainbow
  //    AND dips smoothly into light drizzle during post-60s stroll windows t%84 in [62, 78]!)
  const baseRainCycle = 0.65 + 0.25 * Math.sin(t * 0.16 + 0.5) + 0.1 * Math.cos(t * 0.29);
  const tourRainbowDip = pulse(49.5, 52.0, 54.8, 57.5, t % 60);
  const strollDrizzleDip = t > 59.0 ? pulse(60.0, 62.5, 76.5, 81.5, t % 84) : 0.0;
  const rainDensity = Math.max(0.24, Math.min(1.0, baseRainCycle * (1 - 0.62 * tourRainbowDip) * (1 - 0.58 * strollDrizzleDip)));
  ENV_UNIFORMS.uRainDensity.value = rainDensity;

  // 2. Wind gust wavefront sweeping diagonally from outer sea (+X, -Z) toward (-X, +Z)
  // Cycle every 30s, first gust starts cleanly at t=24.5s (aligned with Shot 6!)
  const gustCycle = ((t - 24.5) % 30.0 + 30.0) % 30.0;
  const gustActive = t >= 24.0 && gustCycle < 6.5;
  const gustStrength = gustActive ? pulse(0.0, 1.2, 4.2, 6.5, gustCycle) : 0.0;
  // Wavefront scalar s = dot(worldXZ, normalize(-0.78, 0.46)) starts at -26 (offshore) -> +26 (inshore)
  const gustFront = gustActive ? -26.0 + (gustCycle / 6.5) * 52.0 : 40.0;
  ENV_UNIFORMS.uGustStrength.value = gustStrength;
  ENV_UNIFORMS.uGustFrontPos.value = gustFront;

  // 3. Drifting thin clouds passing over sun & diorama
  // Cloud sweeps softly across around t=38..46 (Shot 8/9 edge) and t=12..19 (subtle)
  const cloudT = ((t + 8.0) % 28.0) / 28.0;
  const cx = -34 + cloudT * 68;
  const cz = -24 + cloudT * 48;
  ENV_UNIFORMS.uCloudCenter.value.set(cx, cz);

  // Brief overall gentle dimming around t=51..55 so lighthouse lights up warmly once during daytime!
  const skyDimDip = pulse(50.5, 52.0, 54.0, 55.8, t % 60);
  const sunIntensity = 1.0 - 0.24 * skyDimDip;
  ENV_UNIFORMS.uSunIntensity.value = sunIntensity;

  // 4. Boat 4 kinematics -> wake uniforms
  const b4 = evalBoat4Trajectory(t);
  ENV_UNIFORMS.uBoat4Pos.value.set(b4.pos.x, b4.pos.z);
  ENV_UNIFORMS.uBoat4Dir.value.set(-Math.sin(b4.yaw), -Math.cos(b4.yaw));
  ENV_UNIFORMS.uBoat4Speed.value = b4.speed;

  // 5. Proximity-based reactive behaviors (deterministic under fixed dt)
  if (dt > 0) {
    // Bollard gull at (-4.2, 1.93, 5.85) — lets camera frame peaceful perch first then startle!
    const gullAnchor = new THREE.Vector3(-4.2, 1.93, 5.85);
    const distToGull = sim.cameraPos.distanceTo(gullAnchor);
    if (distToGull < 3.65 && sim.gullFleeTimer <= 0) {
      sim.gullFleeTimer = 0.001; // trigger takeoff flight
    }
    if (sim.gullFleeTimer > 0) {
      sim.gullFleeTimer += dt;
      if (sim.gullFleeTimer > 14.0 && distToGull > 7.0) {
        sim.gullFleeTimer = 0; // returns peacefully once camera pulls back
      }
    }

    // Harbor cat under overturned skiff (+2.55, 0.78, 14.15)
    const catAnchor = new THREE.Vector3(2.55, 0.78, 14.15);
    const distToCat = sim.cameraPos.distanceTo(catAnchor);
    const wantCatLook = distToCat < 5.2 ? 1.0 : 0.0;
    sim.catLookAmount += (wantCatLook - sim.catLookAmount) * Math.min(1, dt * 4.0);

    // Underwater fish school center (+10.6, -1.5, 3.6)
    const fishAnchor = new THREE.Vector3(10.6, -1.5, 3.6);
    const distToFish = sim.cameraPos.distanceTo(fishAnchor);
    if (distToFish < 9.5 && sim.fishCooldown <= 0) {
      sim.fishScatterAmount = Math.min(1.0, sim.fishScatterAmount + dt * 2.8);
      if (sim.fishScatterAmount > 0.92) {
        sim.fishCooldown = 5.5;
      }
    } else {
      if (sim.fishCooldown > 0) sim.fishCooldown = Math.max(0, sim.fishCooldown - dt);
      const decayRate = distToFish < 9.5 && sim.fishCooldown > 2.5 ? 0.15 : 0.45;
      sim.fishScatterAmount = Math.max(0, sim.fishScatterAmount - dt * decayRate);
    }
  }
}
