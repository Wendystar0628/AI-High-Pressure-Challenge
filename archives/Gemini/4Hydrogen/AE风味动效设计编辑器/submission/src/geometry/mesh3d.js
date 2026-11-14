// 三维实体挤出、基础三维模型（铁砧/锻锤等）、法线计算与几何变形（弯曲/扭转/锤击压痕/空间场）

import earcutMod from 'earcut';
import { clamp, lerp, DEG2RAD } from '../core/math.js';

const earcut = earcutMod.default || earcutMod;

function signedAreaRing(openPts) {
  let a = 0;
  for (let i = 0; i < openPts.length; i++) {
    const p1 = openPts[i], p2 = openPts[(i + 1) % openPts.length];
    a += p1[0] * p2[1] - p2[0] * p1[1];
  }
  return a * 0.5;
}

// 为环（外环 area>0 或内孔 area<0）计算安全不自交的内缩偏移向量（AE Y向下坐标系，指向实体内部）
function computeSafeInsetOffsets(ringPts, maxInset) {
  const n = ringPts.length;
  if (n < 3 || maxInset <= 1e-4) return ringPts.map(() => [0, 0]);

  const rawDirs = new Array(n);
  const maxSafe = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const prev = ringPts[(i - 1 + n) % n];
    const cur = ringPts[i];
    const next = ringPts[(i + 1) % n];

    let dx0 = cur[0] - prev[0], dy0 = cur[1] - prev[1];
    let dx1 = next[0] - cur[0], dy1 = next[1] - cur[1];
    const l0 = Math.hypot(dx0, dy0) || 1e-5;
    const l1 = Math.hypot(dx1, dy1) || 1e-5;
    dx0 /= l0; dy0 /= l0;
    dx1 /= l1; dy1 /= l1;

    // AE 坐标系（+X右，+Y下）正向外环左侧为实体内部：(-dy, dx)
    const nx0 = -dy0, ny0 = dx0;
    const nx1 = -dy1, ny1 = dx1;
    let mx = nx0 + nx1;
    let my = ny0 + ny1;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-5) {
      mx = nx0; my = ny0;
    } else {
      mx /= ml; my /= ml;
      const dot = clamp(mx * nx0 + my * ny0, 0.45, 1);
      const scale = 1 / dot;
      mx *= scale; my *= scale;
    }
    rawDirs[i] = [mx, my];
    maxSafe[i] = Math.min(maxInset, Math.min(l0, l1) * 0.36);
  }

  // 防止相邻边翻转交叉
  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ox = ringPts[j][0] - ringPts[i][0];
      const oy = ringPts[j][1] - ringPts[i][1];
      const olen2 = ox * ox + oy * oy;
      if (olen2 < 1e-8) continue;
      const ax = ringPts[i][0] + rawDirs[i][0] * maxSafe[i];
      const ay = ringPts[i][1] + rawDirs[i][1] * maxSafe[i];
      const bx = ringPts[j][0] + rawDirs[j][0] * maxSafe[j];
      const by = ringPts[j][1] + rawDirs[j][1] * maxSafe[j];
      const dot = (bx - ax) * ox + (by - ay) * oy;
      if (dot < olen2 * 0.15) {
        maxSafe[i] *= 0.45;
        maxSafe[j] *= 0.45;
      }
    }
  }

  return rawDirs.map((d, i) => [d[0] * maxSafe[i], d[1] * maxSafe[i]]);
}

// 加密 2D 三角帽面以便后续弯曲/扭转/场变形保持曲面光滑
function subdivideCapTriangles(pts2D, tris, maxEdgeLen = 34) {
  const verts = [];
  for (const p of pts2D) verts.push(p[0], p[1]);
  let indices = Array.from(tris);

  for (let pass = 0; pass < 2; pass++) {
    const edgeMid = new Map();
    const keyOf = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
    let splitAny = false;
    const ensureMid = (a, b) => {
      const k = keyOf(a, b);
      if (edgeMid.has(k)) return edgeMid.get(k);
      const len = Math.hypot(verts[b * 2] - verts[a * 2], verts[b * 2 + 1] - verts[a * 2 + 1]);
      if (len <= maxEdgeLen) return -1;
      const idx = verts.length / 2;
      verts.push((verts[a * 2] + verts[b * 2]) * 0.5, (verts[a * 2 + 1] + verts[b * 2 + 1]) * 0.5);
      edgeMid.set(k, idx);
      splitAny = true;
      return idx;
    };
    for (let i = 0; i < indices.length; i += 3) {
      ensureMid(indices[i], indices[i + 1]);
      ensureMid(indices[i + 1], indices[i + 2]);
      ensureMid(indices[i + 2], indices[i]);
    }
    if (!splitAny) break;
    const next = [];
    for (let i = 0; i < indices.length; i += 3) {
      const v0 = indices[i], v1 = indices[i + 1], v2 = indices[i + 2];
      const m01 = edgeMid.get(keyOf(v0, v1)) ?? -1;
      const m12 = edgeMid.get(keyOf(v1, v2)) ?? -1;
      const m20 = edgeMid.get(keyOf(v2, v0)) ?? -1;
      const cnt = (m01 >= 0 ? 1 : 0) + (m12 >= 0 ? 1 : 0) + (m20 >= 0 ? 1 : 0);
      if (cnt === 0) next.push(v0, v1, v2);
      else if (cnt === 3) next.push(v0, m01, m20, m01, v1, m12, m20, m12, v2, m01, m12, m20);
      else if (cnt === 2) {
        let a = v0, b = v1, c = v2, mab = m01, mbc = m12;
        if (m01 < 0) { a = v1; b = v2; c = v0; mab = m12; mbc = m20; }
        else if (m12 < 0) { a = v2; b = v0; c = v1; mab = m20; mbc = m01; }
        next.push(b, mbc, mab, a, mab, c, mab, mbc, c);
      } else {
        let a = v0, b = v1, c = v2, mab = m01;
        if (m12 >= 0) { a = v1; b = v2; c = v0; mab = m12; }
        else if (m20 >= 0) { a = v2; b = v0; c = v1; mab = m20; }
        next.push(a, mab, c, mab, b, c);
      }
    }
    indices = next;
  }

  return { verts, indices };
}

// 挤出含凹部与孔洞的 MultiPolygon 为完整闭合 3D 实体（局部 AE 坐标，Z 围绕 0 对称）
export function extrudeMultiPolygonToMesh(mp, opts = {}) {
  const depth = Math.max(0.5, opts.depth ?? 48);
  const bevelSize = Math.max(0, opts.bevelSize ?? 5);
  const bevelThickness = bevelSize > 0 ? Math.max(0, opts.bevelThickness ?? 5) : 0;
  const bevelSegs = bevelSize > 0 && bevelThickness > 0 ? Math.max(1, Math.min(6, Math.round(opts.bevelSegments ?? 3))) : 0;
  const wallSegs = Math.max(1, Math.round(opts.wallSegments ?? 2));

  const halfD = depth * 0.5;
  const positions = [];
  const uvs = [];
  const indices = [];

  const pushVert = (x, y, z, u = 0, v = 0) => {
    const idx = positions.length / 3;
    positions.push(x, y, z);
    uvs.push(u, v);
    return idx;
  };

  // 计算整体 UV 归一化范围
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const poly of mp) {
    for (const ring of poly) {
      for (const p of ring) {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      }
    }
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  for (const poly of mp) {
    if (!poly || poly.length === 0) continue;

    // 整理环并确保方向：外环 area>0，孔洞 area<0
    const rings = [];
    for (let r = 0; r < poly.length; r++) {
      const raw = poly[r];
      if (!raw || raw.length < 4) continue;
      let open = raw.slice(0, -1).map((p) => [p[0], p[1]]);
      const area = signedAreaRing(open);
      if (Math.abs(area) < 1e-4) continue;
      if (r === 0 && area < 0) open = open.reverse();
      if (r > 0 && area > 0) open = open.reverse();
      const offsets = computeSafeInsetOffsets(open, bevelSize);
      rings.push({ open, offsets });
    }
    if (rings.length === 0) continue;

    // 构建侧壁 + 前后倒角剖面环序列（从前帽内沿 -> 前基底 -> 后基底 -> 后帽内沿）
    // profileSteps: [ { fracInset, z }, ... ]
    const profile = [];
    if (bevelSegs > 0) {
      for (let s = bevelSegs; s >= 1; s--) {
        const ang = (s / bevelSegs) * (Math.PI * 0.5);
        profile.push({
          insetFrac: 1 - Math.cos(ang),
          z: -halfD - Math.sin(ang) * bevelThickness,
        });
      }
    }
    for (let w = 0; w <= wallSegs; w++) {
      profile.push({
        insetFrac: 0,
        z: lerp(-halfD, halfD, w / wallSegs),
      });
    }
    if (bevelSegs > 0) {
      for (let s = 1; s <= bevelSegs; s++) {
        const ang = (s / bevelSegs) * (Math.PI * 0.5);
        profile.push({
          insetFrac: 1 - Math.cos(ang),
          z: halfD + Math.sin(ang) * bevelThickness,
        });
      }
    }

    // 为每个环生成侧壁与倒角条带
    const frontCapRings = [];
    const backCapRings = [];

    for (const ring of rings) {
      const m = ring.open.length;
      const ringSlices = [];

      // 累加弧长作 UV.u
      const ringLen = [0];
      let tot = 0;
      for (let i = 0; i < m; i++) {
        const a = ring.open[i], b = ring.open[(i + 1) % m];
        tot += Math.hypot(b[0] - a[0], b[1] - a[1]);
        ringLen.push(tot);
      }

      for (let pIdx = 0; pIdx < profile.length; pIdx++) {
        const prof = profile[pIdx];
        const row = [];
        for (let i = 0; i <= m; i++) {
          const vi = i % m;
          const base = ring.open[vi];
          const off = ring.offsets[vi];
          const x = base[0] + off[0] * prof.insetFrac;
          const y = base[1] + off[1] * prof.insetFrac;
          const u = tot > 1e-4 ? ringLen[i] / tot : 0;
          const v = (prof.z + halfD + bevelThickness) / (depth + 2 * bevelThickness);
          row.push(pushVert(x, y, prof.z, u, v));
        }
        ringSlices.push(row);

        if (pIdx === 0) {
          frontCapRings.push(
            ring.open.map((b, i) => [
              b[0] + ring.offsets[i][0] * prof.insetFrac,
              b[1] + ring.offsets[i][1] * prof.insetFrac,
            ])
          );
        }
        if (pIdx === profile.length - 1) {
          backCapRings.push(
            ring.open.map((b, i) => [
              b[0] + ring.offsets[i][0] * prof.insetFrac,
              b[1] + ring.offsets[i][1] * prof.insetFrac,
            ])
          );
        }
      }

      // 连接条带：从前至后沿环面形成外法向（对孔洞自然朝向孔内）
      for (let pIdx = 0; pIdx < profile.length - 1; pIdx++) {
        const rowA = ringSlices[pIdx];
        const rowB = ringSlices[pIdx + 1];
        for (let i = 0; i < m; i++) {
          const a0 = rowA[i], a1 = rowA[i + 1];
          const b0 = rowB[i], b1 = rowB[i + 1];
          // 验证过的正确右手系绕向（AE Y-down -> GL (x, -y, -z)）
          indices.push(a0, a1, b1, a0, b1, b0);
        }
      }
    }

    // 前盖面（z = -halfD - bevelThickness）
    const frontFlat = [];
    const frontPts = [];
    const frontHoles = [];
    for (let r = 0; r < frontCapRings.length; r++) {
      if (r > 0) frontHoles.push(frontFlat.length / 2);
      for (const p of frontCapRings[r]) {
        frontFlat.push(p[0], p[1]);
        frontPts.push(p);
      }
    }
    const rawFrontTris = earcut(frontFlat, frontHoles.length ? frontHoles : undefined);
    const subFront = subdivideCapTriangles(frontPts, rawFrontTris, opts.capMaxEdge ?? 42);
    const zFront = -halfD - bevelThickness;
    const fBase = positions.length / 3;
    for (let i = 0; i < subFront.verts.length; i += 2) {
      const x = subFront.verts[i], y = subFront.verts[i + 1];
      pushVert(x, y, zFront, (x - minX) / spanX, (y - minY) / spanY);
    }
    for (let i = 0; i < subFront.indices.length; i += 3) {
      // 前表面朝向 -Z_ae (+Z_gl)，需反转 earcut 顺序
      indices.push(
        fBase + subFront.indices[i + 2],
        fBase + subFront.indices[i + 1],
        fBase + subFront.indices[i]
      );
    }

    // 后盖面（z = +halfD + bevelThickness）
    const backFlat = [];
    const backPts = [];
    const backHoles = [];
    for (let r = 0; r < backCapRings.length; r++) {
      if (r > 0) backHoles.push(backFlat.length / 2);
      for (const p of backCapRings[r]) {
        backFlat.push(p[0], p[1]);
        backPts.push(p);
      }
    }
    const rawBackTris = earcut(backFlat, backHoles.length ? backHoles : undefined);
    const subBack = subdivideCapTriangles(backPts, rawBackTris, opts.capMaxEdge ?? 42);
    const zBack = halfD + bevelThickness;
    const bBase = positions.length / 3;
    for (let i = 0; i < subBack.verts.length; i += 2) {
      const x = subBack.verts[i], y = subBack.verts[i + 1];
      pushVert(x, y, zBack, (x - minX) / spanX, (y - minY) / spanY);
    }
    for (let i = 0; i < subBack.indices.length; i += 3) {
      indices.push(
        bBase + subBack.indices[i],
        bBase + subBack.indices[i + 1],
        bBase + subBack.indices[i + 2]
      );
    }
  }

  return finalizeMesh3D(positions, uvs, indices, opts.creaseAngle ?? 42);
}

// 角度阈值折痕法线计算（锐边保留清晰高光棱角，倒角与曲面光滑过渡）
export function finalizeMesh3D(positionsArr, uvsArr, indicesArr, creaseAngleDeg = 42) {
  const posIn = positionsArr instanceof Float32Array ? positionsArr : new Float32Array(positionsArr);
  const uvIn = uvsArr instanceof Float32Array ? uvsArr : new Float32Array(uvsArr);
  const idxIn = indicesArr instanceof Uint32Array ? indicesArr : new Uint32Array(indicesArr);

  const triCount = idxIn.length / 3;
  if (triCount === 0) {
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      uvs: new Float32Array(0),
      indices: new Uint32Array(0),
      vertexCount: 0,
      triangleCount: 0,
      bounds: { min: [0, 0, 0], max: [0, 0, 0] },
    };
  }

  // 1. 按位置聚合同位置输入顶点（仅对输入顶点数建一次空间哈希，并焊合同位置+同法线+同UV角点）
  const inVertCount = posIn.length / 3;
  const posGroupMap = new Map();
  const posGroupOfVert = new Int32Array(inVertCount);
  const groupFaces = [];
  for (let vi = 0; vi < inVertCount; vi++) {
    const px = posIn[vi * 3], py = posIn[vi * 3 + 1], pz = posIn[vi * 3 + 2];
    const key = `${Math.round(px * 100)}_${Math.round(py * 100)}_${Math.round(pz * 100)}`;
    let gid = posGroupMap.get(key);
    if (gid === undefined) {
      gid = groupFaces.length;
      posGroupMap.set(key, gid);
      groupFaces.push([]);
    }
    posGroupOfVert[vi] = gid;
  }

  // 2. 计算面法线并登记各空间位置组关联的邻接面
  const faceNormals = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    const i0 = idxIn[t * 3], i1 = idxIn[t * 3 + 1], i2 = idxIn[t * 3 + 2];
    const ax = posIn[i0 * 3], ay = posIn[i0 * 3 + 1], az = posIn[i0 * 3 + 2];
    const bx = posIn[i1 * 3], by = posIn[i1 * 3 + 1], bz = posIn[i1 * 3 + 2];
    const cx = posIn[i2 * 3], cy = posIn[i2 * 3 + 1], cz = posIn[i2 * 3 + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    faceNormals[t * 3] = nx / len;
    faceNormals[t * 3 + 1] = ny / len;
    faceNormals[t * 3 + 2] = nz / len;

    const g0 = posGroupOfVert[i0], g1 = posGroupOfVert[i1], g2 = posGroupOfVert[i2];
    groupFaces[g0].push(t);
    if (g1 !== g0) groupFaces[g1].push(t);
    if (g2 !== g0 && g2 !== g1) groupFaces[g2].push(t);
  }

  // 3. 折痕阈值光滑法线 + 焊合共法线顶点（锐边折痕拆开，平面与倒角曲面自动共享索引）
  const cosThresh = Math.cos(creaseAngleDeg * DEG2RAD);
  const weldMap = new Map();
  const outPosArr = [];
  const outNormArr = [];
  const outUVArr = [];
  const outIdx = new Uint32Array(triCount * 3);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let t = 0; t < triCount; t++) {
    const fnx = faceNormals[t * 3], fny = faceNormals[t * 3 + 1], fnz = faceNormals[t * 3 + 2];
    for (let k = 0; k < 3; k++) {
      const vi = idxIn[t * 3 + k];
      const gid = posGroupOfVert[vi];
      const adj = groupFaces[gid];
      let sx = 0, sy = 0, sz = 0;
      for (let a = 0; a < adj.length; a++) {
        const ft = adj[a];
        const anx = faceNormals[ft * 3], any = faceNormals[ft * 3 + 1], anz = faceNormals[ft * 3 + 2];
        if (fnx * anx + fny * any + fnz * anz >= cosThresh) {
          sx += anx; sy += any; sz += anz;
        }
      }
      const sl = Math.hypot(sx, sy, sz) || 1;
      const nx = sx / sl, ny = sy / sl, nz = sz / sl;
      const u = uvIn[vi * 2] || 0;
      const v = uvIn[vi * 2 + 1] || 0;
      const wKey = `${gid}_${Math.round(nx * 64)}_${Math.round(ny * 64)}_${Math.round(nz * 64)}_${Math.round(u * 256)}_${Math.round(v * 256)}`;
      let ov = weldMap.get(wKey);
      if (ov === undefined) {
        ov = outPosArr.length / 3;
        weldMap.set(wKey, ov);
        const px = posIn[vi * 3], py = posIn[vi * 3 + 1], pz = posIn[vi * 3 + 2];
        outPosArr.push(px, py, pz);
        outNormArr.push(nx, ny, nz);
        outUVArr.push(u, v);
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
        if (pz < minZ) minZ = pz; if (pz > maxZ) maxZ = pz;
      }
      outIdx[t * 3 + k] = ov;
    }
  }

  return {
    positions: new Float32Array(outPosArr),
    normals: new Float32Array(outNormArr),
    uvs: new Float32Array(outUVArr),
    indices: outIdx,
    vertexCount: outPosArr.length / 3,
    triangleCount: triCount,
    bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
  };
}

// 重新计算变形后网格的法线与包围盒（直接用于光照、阴影、点击与粒子碰撞）
export function recomputeMesh3DNormalsAndBounds(mesh, creaseAngleDeg = 42) {
  if (!mesh || mesh.triangleCount === 0) return mesh;
  return finalizeMesh3D(mesh.positions, mesh.uvs, mesh.indices, creaseAngleDeg);
}

// 网格变形：弯曲、扭转、锻打局部受力压痕与空间场顶点变形
export function deformMesh3D(mesh, opts = {}) {
  if (!mesh || mesh.vertexCount === 0) return mesh;
  const bendAngle = opts.bendAngle || 0;
  const bendAxis = opts.bendAxis || 'y';
  const twistAngle = opts.twistAngle || 0;
  const twistAxis = opts.twistAxis || 'y';
  const dentDepth = opts.dentDepth || 0;
  const dentCenter = opts.dentCenter || [0, 0, 0];
  const dentRadius = Math.max(10, opts.dentRadius || 110);
  const fieldEvalFn = opts.fieldEvalFn || null;
  const time = opts.time || 0;

  const hasBend = Math.abs(bendAngle) > 1e-3;
  const hasTwist = Math.abs(twistAngle) > 1e-3;
  const hasDent = Math.abs(dentDepth) > 1e-3;
  const hasField = !!fieldEvalFn;

  if (!hasBend && !hasTwist && !hasDent && !hasField) return mesh;

  const bmin = mesh.bounds?.min || [-100, -100, -30];
  const bmax = mesh.bounds?.max || [100, 100, 30];
  const span = [
    Math.max(1, bmax[0] - bmin[0]),
    Math.max(1, bmax[1] - bmin[1]),
    Math.max(1, bmax[2] - bmin[2]),
  ];
  const mid = [
    (bmin[0] + bmax[0]) * 0.5,
    (bmin[1] + bmax[1]) * 0.5,
    (bmin[2] + bmax[2]) * 0.5,
  ];

  const src = mesh.positions;
  const out = new Float32Array(src.length);

  for (let i = 0; i < src.length; i += 3) {
    let x = src[i], y = src[i + 1], z = src[i + 2];

    // 1. 锤击局部塑性变形（压痕 + 周围金属挤出隆起）
    if (hasDent) {
      const dx = x - dentCenter[0];
      const dy = y - dentCenter[1];
      const dz = z - dentCenter[2];
      const d = Math.hypot(dx, dy, dz * 0.5);
      if (d < dentRadius * 1.45) {
        const u = d / dentRadius;
        // 核心区域向 Z 轴（或Y向下）压陷，外圈微弱隆起模拟金属锻打流动
        const core = Math.exp(-u * u * 2.6);
        const rim = u > 0.65 && u < 1.45 ? Math.sin(((u - 0.65) / 0.8) * Math.PI) * 0.18 : 0;
        const factor = core - rim;
        y += dentDepth * factor * 0.45;
        z += dentDepth * factor * 0.85;
        // 横向轻微延展
        if (d > 1e-4) {
          const push = Math.abs(dentDepth) * 0.14 * core;
          x += (dx / d) * push;
        }
      }
    }

    // 2. 扭转
    if (hasTwist) {
      const radTotal = twistAngle * DEG2RAD;
      if (twistAxis === 'y') {
        const u = (y - mid[1]) / (span[1] * 0.5);
        const a = u * radTotal * 0.5;
        const c = Math.cos(a), s = Math.sin(a);
        const rx = x - mid[0], rz = z - mid[2];
        x = mid[0] + rx * c - rz * s;
        z = mid[2] + rx * s + rz * c;
      } else if (twistAxis === 'x') {
        const u = (x - mid[0]) / (span[0] * 0.5);
        const a = u * radTotal * 0.5;
        const c = Math.cos(a), s = Math.sin(a);
        const ry = y - mid[1], rz = z - mid[2];
        y = mid[1] + ry * c - rz * s;
        z = mid[2] + ry * s + rz * c;
      } else {
        const u = (z - mid[2]) / (span[2] * 0.5);
        const a = u * radTotal * 0.5;
        const c = Math.cos(a), s = Math.sin(a);
        const rx = x - mid[0], ry = y - mid[1];
        x = mid[0] + rx * c - ry * s;
        y = mid[1] + rx * s + ry * c;
      }
    }

    // 3. 弯曲
    if (hasBend) {
      const rad = bendAngle * DEG2RAD;
      if (bendAxis === 'y') {
        const L = span[0];
        const R = L / rad;
        const theta = ((x - mid[0]) / L) * rad;
        const dist = R - (z - mid[2]);
        x = mid[0] + dist * Math.sin(theta);
        z = mid[2] + R - dist * Math.cos(theta);
      } else if (bendAxis === 'x') {
        const L = span[1];
        const R = L / rad;
        const theta = ((y - mid[1]) / L) * rad;
        const dist = R - (z - mid[2]);
        y = mid[1] + dist * Math.sin(theta);
        z = mid[2] + R - dist * Math.cos(theta);
      } else {
        const L = span[0];
        const R = L / rad;
        const theta = ((x - mid[0]) / L) * rad;
        const dist = R - (y - mid[1]);
        x = mid[0] + dist * Math.sin(theta);
        y = mid[1] + R - dist * Math.cos(theta);
      }
    }

    // 4. 空间场驱动顶点变形
    if (hasField) {
      const disp = fieldEvalFn(x, y, z, time);
      x += disp[0];
      y += disp[1];
      z += disp[2];
    }

    out[i] = x;
    out[i + 1] = y;
    out[i + 2] = z;
  }

  return finalizeMesh3D(out, mesh.uvs, mesh.indices, opts.creaseAngle ?? 46);
}

// ---- 基础三维几何与“锻字”专用三维工具模型（铁砧、锻锤） ----

function buildBoxRaw(w, h, d, sx = 1, sy = 1, sz = 1, cy = 0, cz = 0) {
  const hw = w * 0.5, hh = h * 0.5, hd = d * 0.5;
  const pos = [];
  const uv = [];
  const idx = [];
  // 遵循 AE (+X右, +Y下, +Z入屏) 下各面向外的正确绕向（经 (x,-y,-z) 后仍为 CCW）
  const addQuadFace = (uSteps, vSteps, ptFn) => {
    const base = pos.length / 3;
    for (let j = 0; j <= vSteps; j++) {
      for (let i = 0; i <= uSteps; i++) {
        const u = i / uSteps, v = j / vSteps;
        const p = ptFn(u, v);
        pos.push(p[0], p[1] + cy, p[2] + cz);
        uv.push(u, v);
      }
    }
    const stride = uSteps + 1;
    for (let j = 0; j < vSteps; j++) {
      for (let i = 0; i < uSteps; i++) {
        const a = base + j * stride + i;
        const b = a + 1;
        const c = a + stride + 1;
        const d0 = a + stride;
        idx.push(a, b, c, a, c, d0);
      }
    }
  };
  // 前 (-Z_ae)
  addQuadFace(sx, sy, (u, v) => [lerp(-hw, hw, u), lerp(hh, -hh, v), -hd]);
  // 后 (+Z_ae)
  addQuadFace(sx, sy, (u, v) => [lerp(hw, -hw, u), lerp(hh, -hh, v), hd]);
  // 顶 (-Y_ae)
  addQuadFace(sx, sz, (u, v) => [lerp(-hw, hw, u), -hh, lerp(-hd, hd, v)]);
  // 底 (+Y_ae)
  addQuadFace(sx, sz, (u, v) => [lerp(-hw, hw, u), hh, lerp(hd, -hd, v)]);
  // 右 (+X_ae)
  addQuadFace(sz, sy, (u, v) => [hw, lerp(hh, -hh, v), lerp(-hd, hd, u)]);
  // 左 (-X_ae)
  addQuadFace(sz, sy, (u, v) => [-hw, lerp(hh, -hh, v), lerp(hd, -hd, u)]);

  return { pos, uv, idx };
}

function mergeRawMeshes(parts) {
  const pos = [], uv = [], idx = [];
  for (const p of parts) {
    const base = pos.length / 3;
    for (let i = 0; i < p.pos.length; i++) pos.push(p.pos[i]);
    for (let i = 0; i < p.uv.length; i++) uv.push(p.uv[i]);
    for (let i = 0; i < p.idx.length; i++) idx.push(base + p.idx[i]);
  }
  return { pos, uv, idx };
}

export function createPrimitiveMesh3D(kind = 'box', size = [240, 240, 60]) {
  const w = size[0] || 240;
  const h = size[1] || 240;
  const d = size[2] || 60;

  if (kind === 'plane') {
    const segs = 16;
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= segs; j++) {
      for (let i = 0; i <= segs; i++) {
        const u = i / segs, v = j / segs;
        pos.push(lerp(-w * 0.5, w * 0.5, u), lerp(h * 0.5, -h * 0.5, v), 0);
        uv.push(u, v);
      }
    }
    const stride = segs + 1;
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < segs; i++) {
        const a = j * stride + i, b = a + 1, c = a + stride + 1, d0 = a + stride;
        idx.push(a, b, c, a, c, d0);
      }
    }
    return finalizeMesh3D(pos, uv, idx, 45);
  }

  if (kind === 'sphere') {
    const r = Math.min(w, h) * 0.5;
    const rings = 20, segs = 28;
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= rings; j++) {
      const v = j / rings;
      const phi = v * Math.PI;
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const theta = u * Math.PI * 2;
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = -r * Math.cos(phi);
        const z = -r * Math.sin(phi) * Math.sin(theta);
        pos.push(x, y, z);
        uv.push(u, v);
      }
    }
    const stride = segs + 1;
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < segs; i++) {
        const a = j * stride + i, b = a + 1, c = a + stride + 1, d0 = a + stride;
        idx.push(a, d0, c, a, c, b);
      }
    }
    return finalizeMesh3D(pos, uv, idx, 70);
  }

  if (kind === 'cylinder') {
    const r = w * 0.5;
    const segs = 28;
    const ring = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      ring.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    ring.push([...ring[0]]);
    return extrudeMultiPolygonToMesh([[ring]], { depth: d, bevelSize: Math.min(4, d * 0.1), bevelThickness: Math.min(4, d * 0.1), bevelSegments: 2 });
  }

  if (kind === 'anvil') {
    // 锻造铁砧（平台面、收腰躯干、阶梯底座，局部 Y=0 对齐顶面以便字块座落）
    const topSlab = buildBoxRaw(w, h * 0.24, d, 8, 2, 6, h * 0.12, 0);
    const waist = buildBoxRaw(w * 0.62, h * 0.44, d * 0.64, 4, 2, 4, h * 0.46, 0);
    const foot = buildBoxRaw(w * 0.92, h * 0.32, d * 0.88, 6, 2, 5, h * 0.84, 0);
    const merged = mergeRawMeshes([topSlab, waist, foot]);
    return finalizeMesh3D(merged.pos, merged.uv, merged.idx, 35);
  }

  if (kind === 'hammer') {
    // 锻锤（局部 (0,0,0) 在锤头重心底部，长柄向上延伸便于围绕手柄枢轴挥舞）
    const headCore = buildBoxRaw(w, h * 0.56, d, 4, 3, 3, -h * 0.28, 0);
    const strikeFace = buildBoxRaw(w * 0.86, h * 0.18, d * 0.86, 3, 1, 3, h * 0.08, 0);
    const topCap = buildBoxRaw(w * 0.72, h * 0.16, d * 0.72, 3, 1, 3, -h * 0.62, 0);
    const handle = buildBoxRaw(w * 0.22, h * 3.2, d * 0.22, 2, 4, 2, -h * 2.1, 0);
    const merged = mergeRawMeshes([headCore, strikeFace, topCap, handle]);
    return finalizeMesh3D(merged.pos, merged.uv, merged.idx, 35);
  }

  // box
  const box = buildBoxRaw(w, h, d, 6, 6, 4);
  return finalizeMesh3D(box.pos, box.uv, box.idx, 35);
}

// 计算网格三角面面积加权分布（供粒子几何表面发射使用）
export function buildSurfaceSampler(mesh) {
  if (!mesh || mesh.triangleCount === 0) return null;
  const pos = mesh.positions;
  const idx = mesh.indices;
  const n = mesh.triangleCount;
  const cumAreas = new Float64Array(n);
  let total = 0;

  for (let t = 0; t < n; t++) {
    const i0 = idx[t * 3], i1 = idx[t * 3 + 1], i2 = idx[t * 3 + 2];
    const ax = pos[i0 * 3], ay = pos[i0 * 3 + 1], az = pos[i0 * 3 + 2];
    const ux = pos[i1 * 3] - ax, uy = pos[i1 * 3 + 1] - ay, uz = pos[i1 * 3 + 2] - az;
    const vx = pos[i2 * 3] - ax, vy = pos[i2 * 3 + 1] - ay, vz = pos[i2 * 3 + 2] - az;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    const area = 0.5 * Math.hypot(cx, cy, cz);
    total += area;
    cumAreas[t] = total;
  }

  return { mesh, cumAreas, totalArea: total };
}

export function samplePointOnMeshSurface(sampler, r0, r1, r2) {
  if (!sampler || sampler.totalArea <= 1e-8) {
    return { pos: [0, 0, 0], normal: [0, -1, 0] };
  }
  const target = r0 * sampler.totalArea;
  const arr = sampler.cumAreas;
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const t = lo;
  const { positions, normals, indices } = sampler.mesh;
  const i0 = indices[t * 3], i1 = indices[t * 3 + 1], i2 = indices[t * 3 + 2];

  // 均匀重心坐标
  const su = Math.sqrt(r1);
  const b0 = 1 - su;
  const b1 = su * (1 - r2);
  const b2 = su * r2;

  const px = positions[i0 * 3] * b0 + positions[i1 * 3] * b1 + positions[i2 * 3] * b2;
  const py = positions[i0 * 3 + 1] * b0 + positions[i1 * 3 + 1] * b1 + positions[i2 * 3 + 1] * b2;
  const pz = positions[i0 * 3 + 2] * b0 + positions[i1 * 3 + 2] * b1 + positions[i2 * 3 + 2] * b2;

  let nx = normals[i0 * 3] * b0 + normals[i1 * 3] * b1 + normals[i2 * 3] * b2;
  let ny = normals[i0 * 3 + 1] * b0 + normals[i1 * 3 + 1] * b1 + normals[i2 * 3 + 1] * b2;
  let nz = normals[i0 * 3 + 2] * b0 + normals[i1 * 3 + 2] * b1 + normals[i2 * 3 + 2] * b2;
  const nl = Math.hypot(nx, ny, nz) || 1;
  return { pos: [px, py, pz], normal: [nx / nl, ny / nl, nz / nl] };
}
