// Layout of the diorama (top view, x right, z toward the default viewer)
import { WL } from '../core/G.js';

export const LAY = {
  frontZ: 6,          // front arm water face (front arm occupies z in [6,20])
  leftX: -8,          // left arm water face (left arm occupies x in [-20,-8])
  leftEndZ: -10,      // left arm ends; hill beyond
  bw: { x0: -8, x1: 6.2, z0: -11.8, z1: -9.4, top: 0.35 },  // breakwater
  lh: { x: 7.5, z: -10.6 }, // lighthouse
  steps: { x0: 1.4, x1: 4.4, z1: 8.6, n: 5 },
  plat: { x0: 4.4, x1: 9.8, z1: 7.7, y: -0.5 },
  slip: { x0: 13.4, x1: 16.8, zTop: 11.0, zEnd: 3.0, yEnd: -2.4 },
  hill: { x0: -20, x1: -7.2, z0: -20, z1: -10 },
};

// slipway ramp surface height
export function slipY(z) {
  const s = LAY.slip;
  const t = Math.min(1, Math.max(0, (s.zTop - z) / (s.zTop - s.zEnd)));
  return t * s.yEnd;
}

// hill height field (back-left corner)
export function hillH(x, z) {
  const u = Math.max(0, Math.min(1, (x + 20) / 12.8)); // 0 at left wall, 1 at x=-7.2
  const v = Math.max(0, Math.min(1, (z + 20) / 10));   // 0 at back wall, 1 at z=-10
  const h = 6.6 * (1 - Math.pow(u, 1.8)) * (1 - Math.pow(v, 2.0)) + 1.0 * (1 - u) * (1 - v);
  const bump = 0.35 * Math.sin(x * 0.9 + 1.0) * Math.cos(z * 0.7) * (1 - u) * (1 - v);
  return Math.max(1.0, h + bump + 0.9);
}

// rough height of the ground the rain falls onto
export function groundAt(x, z) {
  if (x < LAY.hill.x1 && z < LAY.hill.z1) return hillH(x, z);
  if (z > LAY.frontZ) {
    const s = LAY.slip;
    if (x > s.x0 && x < s.x1 && z < s.zTop) return slipY(z);
    return 0;
  }
  if (x < LAY.leftX) return 0;
  if (z > LAY.bw.z0 && z < LAY.bw.z1 && x < LAY.bw.x1) return LAY.bw.top;
  return WL;
}

export function seabedH(x, z) {
  let h = -4.55 + 0.16 * Math.sin(x * 0.37 + z * 0.21) + 0.1 * Math.sin(x * 0.91 - z * 0.63) + 0.07 * Math.cos(z * 1.3 + x * 0.2);
  const dWallL = Math.abs(x - LAY.leftX);
  const dWallF = Math.abs(z - LAY.frontZ);
  const bwc = (LAY.bw.z0 + LAY.bw.z1) / 2;
  const dBw = Math.max(0, Math.abs(z - bwc) - 1.2);
  let mound = 0;
  if (z < LAY.frontZ + 1 && z > LAY.bw.z1 - 1) mound = Math.max(mound, Math.max(0, 1 - dWallL / 2.4));
  if (x > LAY.leftX - 1) mound = Math.max(mound, Math.max(0, 1 - dWallF / 2.4));
  if (x < LAY.bw.x1 + 2.5) mound = Math.max(mound, Math.max(0, 1 - dBw / 3.0) * 1.15);
  const dl = Math.hypot(x - LAY.lh.x, z - LAY.lh.z);
  mound = Math.max(mound, Math.max(0, 1 - (dl - 1.5) / 3.0) * 1.15);
  h += mound * mound * 0.95;
  h -= 0.25 * Math.max(0, Math.min(1, (x - 8) / 8));
  return Math.min(h, -3.3);
}
