// 地形高度函数：渲染与飞行物理共用，确保“在看见的地面上接触”
import { clamp, smoothstep } from './util.js';

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
export function fbm(x, y, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * noise2(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return v;
}

export function terrainHeight(x, z) {
  const base = (fbm(x * 0.013 + 4.2, z * 0.013 - 2.8, 4) - 0.5) * 14;
  const ridge = Math.max(0, fbm(x * 0.004 + 30, z * 0.004 + 11, 3) - 0.55) * 70;
  const lake = -4.8 * Math.exp(-((x - 12) ** 2 + (z - 40) ** 2) / (2 * 70 * 70));
  return base + ridge + lake - 0.5;
}

export function groundAt(pads, x, z) {
  let h = terrainHeight(x, z);
  for (const pad of pads || []) {
    const d = Math.hypot(x - pad.x, z - pad.z);
    const R = (pad.radius || 8) + 16;
    if (d < R) {
      const t = smoothstep(1 - (d - (pad.radius || 8)) / 16);
      h = h * (1 - t) + pad.y * t;
    }
  }
  return h;
}

export function padById(pads, id) {
  return (pads || []).find(p => p.id === id) || (pads || [])[1] || null;
}
