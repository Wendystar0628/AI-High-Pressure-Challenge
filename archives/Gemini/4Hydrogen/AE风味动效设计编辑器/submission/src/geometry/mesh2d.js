// 2D 网格三角剖分（带孔洞与零T型结点加密）及图钉（Puppet Pin）光滑无撕裂变形

import earcutMod from 'earcut';
import { clamp, DEG2RAD } from '../core/math.js';

const earcut = earcutMod.default || earcutMod;

// 将规范化 MultiPolygon 剖分为 2D 三角网格，并执行保形红绿加密以支持光滑图钉变形
export function triangulateMultiPolygon(mp, maxEdgeLen = 28, maxPasses = 2) {
  let verts = []; // [x0, y0, x1, y1, ...]
  let indices = [];

  for (const poly of mp) {
    if (!poly || poly.length === 0) continue;
    const flat = [];
    const holeIndices = [];
    for (let r = 0; r < poly.length; r++) {
      const ring = poly[r];
      if (!ring || ring.length < 4) continue;
      if (r > 0) holeIndices.push(flat.length / 2);
      for (let i = 0; i < ring.length - 1; i++) {
        flat.push(ring[i][0], ring[i][1]);
      }
    }
    if (flat.length < 6) continue;
    const tris = earcut(flat, holeIndices.length > 0 ? holeIndices : undefined);
    const baseVertex = verts.length / 2;
    for (let i = 0; i < flat.length; i++) verts.push(flat[i]);
    for (let i = 0; i < tris.length; i++) indices.push(baseVertex + tris[i]);
  }

  if (maxEdgeLen > 0 && indices.length > 0) {
    for (let pass = 0; pass < maxPasses; pass++) {
      const res = refineMeshRedGreen(verts, indices, maxEdgeLen);
      verts = res.verts;
      indices = res.indices;
      if (!res.didSplit) break;
    }
  }

  return {
    positions: new Float32Array(verts),
    indices: new Uint32Array(indices),
    vertexCount: verts.length / 2,
    triangleCount: indices.length / 3,
  };
}

function refineMeshRedGreen(verts, indices, maxEdgeLen) {
  const edgeMidpoint = new Map();
  const getEdgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  let didSplit = false;

  const ensureMidpoint = (a, b) => {
    const key = getEdgeKey(a, b);
    if (edgeMidpoint.has(key)) return edgeMidpoint.get(key);
    const ax = verts[a * 2], ay = verts[a * 2 + 1];
    const bx = verts[b * 2], by = verts[b * 2 + 1];
    const len = Math.hypot(bx - ax, by - ay);
    if (len <= maxEdgeLen) return -1;
    const midIdx = verts.length / 2;
    verts.push((ax + bx) * 0.5, (ay + by) * 0.5);
    edgeMidpoint.set(key, midIdx);
    didSplit = true;
    return midIdx;
  };

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    ensureMidpoint(a, b);
    ensureMidpoint(b, c);
    ensureMidpoint(c, a);
  }

  if (!didSplit) return { verts, indices, didSplit: false };

  const newIndices = [];
  for (let i = 0; i < indices.length; i += 3) {
    const v0 = indices[i], v1 = indices[i + 1], v2 = indices[i + 2];
    const m01 = edgeMidpoint.get(getEdgeKey(v0, v1)) ?? -1;
    const m12 = edgeMidpoint.get(getEdgeKey(v1, v2)) ?? -1;
    const m20 = edgeMidpoint.get(getEdgeKey(v2, v0)) ?? -1;

    const count = (m01 >= 0 ? 1 : 0) + (m12 >= 0 ? 1 : 0) + (m20 >= 0 ? 1 : 0);
    if (count === 0) {
      newIndices.push(v0, v1, v2);
    } else if (count === 3) {
      newIndices.push(v0, m01, m20, m01, v1, m12, m20, m12, v2, m01, m12, m20);
    } else if (count === 2) {
      // 旋转使未切分的边在最后
      let a = v0, b = v1, c = v2, mab = m01, mbc = m12;
      if (m01 < 0) {
        a = v1; b = v2; c = v0; mab = m12; mbc = m20;
      } else if (m12 < 0) {
        a = v2; b = v0; c = v1; mab = m20; mbc = m01;
      }
      newIndices.push(b, mbc, mab, a, mab, c, mab, mbc, c);
    } else {
      let a = v0, b = v1, c = v2, mab = m01;
      if (m12 >= 0) {
        a = v1; b = v2; c = v0; mab = m12;
      } else if (m20 >= 0) {
        a = v2; b = v0; c = v1; mab = m20;
      }
      newIndices.push(a, mab, c, mab, b, c);
    }
  }

  return { verts, indices: newIndices, didSplit: true };
}

// 多图钉（Puppet Pin）位置、旋转与缩放光滑权重变形（单位分解权重保证不断裂、不撕裂）
export function deformMesh2DWithPins(mesh2d, pins) {
  if (!mesh2d || !pins || pins.length === 0) return mesh2d;
  const src = mesh2d.positions;
  const out = new Float32Array(src.length);
  const n = src.length / 2;

  const pinMatrices = pins.map((pin) => {
    const rx = pin.restPos[0] || 0;
    const ry = pin.restPos[1] || 0;
    const px = pin.evalPos?.[0] ?? pin.restPos[0];
    const py = pin.evalPos?.[1] ?? pin.restPos[1];
    const rot = (pin.evalRotation ?? 0) * DEG2RAD;
    const sx = (pin.evalScale?.[0] ?? 100) / 100;
    const sy = (pin.evalScale?.[1] ?? 100) / 100;
    const rad = Math.max(20, pin.radius || 180);
    return {
      rx,
      ry,
      px,
      py,
      cos: Math.cos(rot),
      sin: Math.sin(rot),
      sx,
      sy,
      invR2: 1 / (rad * rad),
    };
  });

  for (let i = 0; i < n; i++) {
    const x = src[i * 2];
    const y = src[i * 2 + 1];

    if (pinMatrices.length === 1) {
      const pm = pinMatrices[0];
      const dx = x - pm.rx;
      const dy = y - pm.ry;
      const d2 = dx * dx + dy * dy;
      const w = Math.exp(-d2 * pm.invR2 * 1.4);
      const lx = dx * pm.sx;
      const ly = dy * pm.sy;
      const tx = pm.px + lx * pm.cos - ly * pm.sin;
      const ty = pm.py + lx * pm.sin + ly * pm.cos;
      out[i * 2] = x + (tx - x) * clamp(w, 0, 1);
      out[i * 2 + 1] = y + (ty - y) * clamp(w, 0, 1);
      continue;
    }

    let wSum = 0;
    let sumX = 0;
    let sumY = 0;
    for (let k = 0; k < pinMatrices.length; k++) {
      const pm = pinMatrices[k];
      const dx = x - pm.rx;
      const dy = y - pm.ry;
      const d2 = dx * dx + dy * dy;
      const w = 1 / Math.pow(d2 * pm.invR2 + 0.008, 1.85);
      const lx = dx * pm.sx;
      const ly = dy * pm.sy;
      const tx = pm.px + lx * pm.cos - ly * pm.sin;
      const ty = pm.py + lx * pm.sin + ly * pm.cos;
      sumX += w * tx;
      sumY += w * ty;
      wSum += w;
    }
    out[i * 2] = sumX / (wSum || 1);
    out[i * 2 + 1] = sumY / (wSum || 1);
  }

  return {
    positions: out,
    indices: mesh2d.indices,
    vertexCount: mesh2d.vertexCount,
    triangleCount: mesh2d.triangleCount,
  };
}
