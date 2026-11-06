import * as THREE from 'three';

// World constants (1 unit = 1 m)
export const HALF = 20;          // base half-size
export const WL = -1.1;          // water level
export const BASE_BOTTOM = -5.4; // bottom of the base slab
export const SEABED = -4.5;      // nominal seabed height

// Shared uniforms (objects are shared by reference across all shader materials)
export const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.66, 0.68, -0.32).normalize() },
  uSunCol: { value: new THREE.Color(1.1, 1.01, 0.86) },
  uShadeCol: { value: new THREE.Color(0.6, 0.71, 0.78) },
  uSkyCol: { value: new THREE.Color(0.8, 0.93, 0.95) },
  uShadowMap: { value: null },
  uShadowMat: { value: new THREE.Matrix4() },
  uShadowTexel: { value: 1 / 4096 },
  uCloudA: { value: new THREE.Vector4(999, 999, 10, 0) },   // x,z center, radius, strength
  uCloudDir: { value: new THREE.Vector2(1, 0) },
  uSunVis: { value: 1 },
  uWL: { value: WL },
  uGust: { value: new THREE.Vector4(-0.72, 0.69, -200, 0) }, // dir.xy (xz), front pos, strength
  uWindBase: { value: 0.25 },
  uRain: { value: 0.6 },
  uPass: { value: 0 },          // 0 main, 1 normals, 2 shadow depth, 3 reflection
  uFogCol: { value: new THREE.Color(0.86, 0.93, 0.94) },
  uWaterDeep: { value: new THREE.Color(0.10, 0.36, 0.45) },
  uWaterShallow: { value: new THREE.Color(0.42, 0.78, 0.76) },
  uCamFar: { value: 400 },
  uClipY: { value: -1000 },       // discard below (used for puddle reflections)
  uCatLook: { value: 0 },
  uLighthouse: { value: 0 },
  uRainbow: { value: 0 },
  uBeams: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, // sky beam: x,z at ground, radius, strength
  uResolution: { value: new THREE.Vector2(1, 1) },
  tPud: { value: null },
  uPudMat: { value: new THREE.Matrix4() },
  uPudOn: { value: 0 },
};

export const LAYER = { MAIN: 0, SHADOW: 1, OUTLINE: 2, REFL: 3 };

export function setLayers(obj, { main = true, shadow = true, outline = true, refl = true } = {}) {
  obj.traverse((o) => {
    o.layers.disableAll();
    if (main) o.layers.enable(LAYER.MAIN);
    if (shadow) o.layers.enable(LAYER.SHADOW);
    if (outline) o.layers.enable(LAYER.OUTLINE);
    if (refl) o.layers.enable(LAYER.REFL);
  });
  return obj;
}

// deterministic random
let _seed = 1337;
export function rand() {
  _seed = (_seed * 16807) % 2147483647;
  return (_seed - 1) / 2147483646;
}
export function srand(s) { _seed = s; }
export const randomState = { get seed() { return _seed; }, set seed(s) { _seed = s; } };
export const rr = (a, b) => a + (b - a) * rand();
export const pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];

// CPU mirror of the gust function used in shaders
export function gustAt(x, z) {
  const g = U.uGust.value;
  const s = x * g.x + z * g.y;
  const d = g.z - s;
  if (d <= 0) return 0;
  const rise = Math.min(1, d / 3);
  return rise * rise * (3 - 2 * rise) * Math.exp(-d / 16) * g.w;
}
export function windAt(x, z, t) {
  return U.uWindBase.value * (0.75 + 0.25 * Math.sin(t * 0.7 + x * 0.21 + z * 0.13)) + gustAt(x, z);
}
export function cloudAt(x, z) {
  const c = U.uCloudA.value;
  const dx = x - c.x, dz = z - c.y;
  const r = Math.sqrt(dx * dx + dz * dz);
  const m = 1 - smooth(c.z - 5, c.z + 2, r);
  return 1 - m * c.w;
}
export function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
