// 确定性粒子、力场、三维碰撞与拖尾模拟引擎（带快照缓存，支持任意跳转/倒放/运动模糊多次取样无重触发）

import { clamp, lerp, hashInts, randFromHash, mat4TransformPoint, mat4TransformVector, evalCubicBezier, DEG2RAD } from '../core/math.js';
import { evalProperty } from '../core/expressions.js';
import { getLayerById, getLayerWorldMatrix, isLayerActiveAtTime } from '../core/project.js';
import { buildSurfaceSampler, samplePointOnMeshSurface, createPrimitiveMesh3D, extrudeMultiPolygonToMesh, deformMesh3D } from '../geometry/mesh3d.js';
import { pathShapeToMultiPolygon, flattenContour } from '../geometry/shapes.js';
import { textToGeometry } from '../geometry/fonts.js';
import { evaluateNodeGraphOutput } from '../nodes/nodeGraph.js';
import { resolveLayerFieldEvaluators, evaluateCombinedFields } from './fields.js';

const SIM_DT = 1 / 60;
const SNAPSHOT_INTERVAL = 15; // 每 0.25 秒保存一次快照

function cloneParticleState(st) {
  return {
    step: st.step,
    nextId: st.nextId,
    emitAccums: [...st.emitAccums],
    prevBurst: [...st.prevBurst],
    particles: st.particles.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      vx: p.vx,
      vy: p.vy,
      vz: p.vz,
      age: p.age,
      life: p.life,
      sizeStart: p.sizeStart,
      sizeEnd: p.sizeEnd,
      cStart: p.cStart,
      cMid: p.cMid,
      cEnd: p.cEnd,
      hitTimer: p.hitTimer,
      hitColor: p.hitColor,
      isSecondary: p.isSecondary,
      trail: p.trail.map((pt) => [pt[0], pt[1], pt[2], pt[3]]),
    })),
  };
}

function isPropStatic(p) {
  return !p || (!p.animated && !p.expressionEnabled);
}

function isLayerStaticGeoAndTransform(layer) {
  if (!layer || layer.parentId) return false;
  const tr = layer.transform;
  if (
    !tr ||
    !isPropStatic(tr.anchorPoint) ||
    !isPropStatic(tr.position) ||
    !isPropStatic(tr.scale) ||
    !isPropStatic(tr.rotationX) ||
    !isPropStatic(tr.rotationY) ||
    !isPropStatic(tr.rotationZ)
  ) {
    return false;
  }
  if (layer.type === 'mesh3d' && layer.mesh3d) {
    const m = layer.mesh3d;
    if (m.sourceType !== 'primitive') return false;
    const d = m.deform;
    if (d && (d.fieldLayerIds?.length || !isPropStatic(d.bendAngle) || !isPropStatic(d.twistAngle) || !isPropStatic(d.dentDepth))) {
      return false;
    }
    return true;
  }
  return false;
}

// 统一解析粒子发射源或碰撞体引用的几何体（来自节点输出或场景图层）
export function resolveWorldGeometryForLayerOrNode(project, comp, layerId, nodeBinding, time) {
  const targetLayer = layerId ? getLayerById(comp, layerId) : null;
  const isStatic = !nodeBinding?.graphId && targetLayer && isLayerStaticGeoAndTransform(targetLayer);
  if (!comp._worldGeoCache) comp._worldGeoCache = new Map();
  const rev = project.revision || 1;
  const tKey = isStatic ? 'STATIC' : time.toFixed(5);
  const gKey = `${rev}_${comp.id}_${layerId || ''}_${nodeBinding?.graphId || ''}_${nodeBinding?.outputNodeId || ''}_${tKey}`;
  if (comp._worldGeoCache.has(gKey)) {
    const hit = comp._worldGeoCache.get(gKey);
    comp._worldGeoCache.delete(gKey);
    comp._worldGeoCache.set(gKey, hit);
    return hit;
  }

  let localMesh = null;
  let worldM = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  if (targetLayer) {
    worldM = getLayerWorldMatrix(project, comp, targetLayer, time);
  }

  if (nodeBinding?.graphId) {
    const out = evaluateNodeGraphOutput(project, comp, nodeBinding.graphId, nodeBinding.outputNodeId, time);
    if (out?.kind === 'mesh3d') {
      localMesh = out.mesh;
    } else if (out?.kind === 'path2d') {
      const mp = out.cleanMultiPolygon || pathShapeToMultiPolygon(out.cleanOutlinePath || out.rawStrokePath, 6);
      localMesh = extrudeMultiPolygonToMesh(mp, { depth: 6, bevelSize: 0, bevelThickness: 0 });
    }
  } else if (targetLayer) {
    if (targetLayer.type === 'mesh3d') {
      localMesh = evaluateMesh3DLayerLocal(project, comp, targetLayer, time);
    } else if (targetLayer.type === 'text') {
      const fs = evalProperty(project, comp, targetLayer, 'text.fontSize', time);
      const lh = evalProperty(project, comp, targetLayer, 'text.lineHeight', time);
      const tr = evalProperty(project, comp, targetLayer, 'text.tracking', time);
      const g = textToGeometry(targetLayer.text.content, {
        fontId: targetLayer.text.fontId,
        fontSize: fs,
        lineHeight: lh,
        tracking: tr,
        align: targetLayer.text.align,
      });
      localMesh = extrudeMultiPolygonToMesh(g.cleanMultiPolygon, { depth: 4, bevelSize: 0, bevelThickness: 0 });
    } else if (targetLayer.type === 'shape') {
      const path = evalProperty(project, comp, targetLayer, 'shape.path', time);
      const mp = pathShapeToMultiPolygon(path, 6);
      localMesh = extrudeMultiPolygonToMesh(mp, { depth: 4, bevelSize: 0, bevelThickness: 0 });
    }
  }

  if (!localMesh || localMesh.triangleCount === 0) {
    comp._worldGeoCache.set(gKey, null);
    return null;
  }

  // 若本地网格与世界变换矩阵与此前完全一致（如变形平台期），直接复用对应世界坐标网格及其空间哈希
  if (!comp._meshToWorldCache) comp._meshToWorldCache = new WeakMap();
  const wmKey = worldM.map((v) => v.toFixed(4)).join(',');
  let mMap = comp._meshToWorldCache.get(localMesh);
  if (mMap && mMap.has(wmKey)) {
    const cachedWorld = mMap.get(wmKey);
    comp._worldGeoCache.set(gKey, cachedWorld);
    return cachedWorld;
  }

  // 将局部网格顶点及法线变换到 AE 世界坐标（供真实表面碰撞与表面发射）
  const nVerts = localMesh.vertexCount;
  const worldPos = new Float32Array(nVerts * 3);
  const worldNorm = new Float32Array(nVerts * 3);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < nVerts; i++) {
    const p = mat4TransformPoint(worldM, [
      localMesh.positions[i * 3],
      localMesh.positions[i * 3 + 1],
      localMesh.positions[i * 3 + 2],
    ]);
    worldPos[i * 3] = p[0];
    worldPos[i * 3 + 1] = p[1];
    worldPos[i * 3 + 2] = p[2];
    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
    if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2];

    const n = mat4TransformVector(worldM, [
      localMesh.normals[i * 3],
      localMesh.normals[i * 3 + 1],
      localMesh.normals[i * 3 + 2],
    ]);
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    worldNorm[i * 3] = n[0] / nl;
    worldNorm[i * 3 + 1] = n[1] / nl;
    worldNorm[i * 3 + 2] = n[2] / nl;
  }

  const worldGeo = {
    positions: worldPos,
    normals: worldNorm,
    indices: localMesh.indices,
    vertexCount: nVerts,
    triangleCount: localMesh.triangleCount,
    bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
    worldM,
  };
  if (!mMap) {
    mMap = new Map();
    comp._meshToWorldCache.set(localMesh, mMap);
  }
  mMap.set(wmKey, worldGeo);
  if (mMap.size > 16) {
    mMap.delete(mMap.keys().next().value);
  }
  comp._worldGeoCache.set(gKey, worldGeo);
  if (comp._worldGeoCache.size > 48) {
    const oldest = comp._worldGeoCache.keys().next().value;
    comp._worldGeoCache.delete(oldest);
  }
  return worldGeo;
}

// 计算 mesh3d 图层在本地坐标系下的当前（含变形）几何体
export function evaluateMesh3DLayerLocal(project, comp, layer, time) {
  const m = layer.mesh3d;
  if (!m) return null;
  let baseMesh = null;

  if (m.sourceType === 'node' && m.nodeBinding?.graphId) {
    const out = evaluateNodeGraphOutput(project, comp, m.nodeBinding.graphId, m.nodeBinding.outputNodeId, time);
    if (out?.kind === 'mesh3d') {
      baseMesh = out.mesh;
    } else if (out?.kind === 'path2d') {
      const depth = evalProperty(project, comp, layer, 'mesh3d.extrude.depth', time);
      const bevelSize = evalProperty(project, comp, layer, 'mesh3d.extrude.bevelSize', time);
      const bevelThick = evalProperty(project, comp, layer, 'mesh3d.extrude.bevelThickness', time);
      const mp = out.cleanMultiPolygon || pathShapeToMultiPolygon(out.cleanOutlinePath || out.rawStrokePath, 8);
      baseMesh = extrudeMultiPolygonToMesh(mp, {
        depth,
        bevelSize,
        bevelThickness: bevelThick,
        bevelSegments: m.extrude.bevelSegments || 3,
      });
    }
  } else if (m.sourceType === 'layer' && m.sourceLayerId) {
    const src = getLayerById(comp, m.sourceLayerId);
    const depth = evalProperty(project, comp, layer, 'mesh3d.extrude.depth', time);
    const bevelSize = evalProperty(project, comp, layer, 'mesh3d.extrude.bevelSize', time);
    const bevelThick = evalProperty(project, comp, layer, 'mesh3d.extrude.bevelThickness', time);
    if (src && src.type === 'text') {
      const fs = evalProperty(project, comp, src, 'text.fontSize', time);
      const lh = evalProperty(project, comp, src, 'text.lineHeight', time);
      const tr = evalProperty(project, comp, src, 'text.tracking', time);
      const g = textToGeometry(src.text.content, {
        fontId: src.text.fontId,
        fontSize: fs,
        lineHeight: lh,
        tracking: tr,
        align: src.text.align,
      });
      baseMesh = extrudeMultiPolygonToMesh(g.cleanMultiPolygon, {
        depth,
        bevelSize,
        bevelThickness: bevelThick,
        bevelSegments: m.extrude.bevelSegments || 3,
      });
    } else if (src && src.type === 'shape') {
      const path = evalProperty(project, comp, src, 'shape.path', time);
      const mp = pathShapeToMultiPolygon(path, 8);
      baseMesh = extrudeMultiPolygonToMesh(mp, {
        depth,
        bevelSize,
        bevelThickness: bevelThick,
        bevelSegments: m.extrude.bevelSegments || 3,
      });
    }
  } else {
    baseMesh = createPrimitiveMesh3D(m.primitive || 'box', m.primitiveSize || [240, 240, 60]);
  }

  if (!baseMesh || baseMesh.triangleCount === 0) return baseMesh;

  // 图层自身的弯曲/扭转/压痕/场变形
  const bendAngle = evalProperty(project, comp, layer, 'mesh3d.deform.bendAngle', time);
  const twistAngle = evalProperty(project, comp, layer, 'mesh3d.deform.twistAngle', time);
  const dentDepth = evalProperty(project, comp, layer, 'mesh3d.deform.dentDepth', time);
  const dentCenter = evalProperty(project, comp, layer, 'mesh3d.deform.dentCenter', time);
  const dentRadius = evalProperty(project, comp, layer, 'mesh3d.deform.dentRadius', time);

  const fieldEvals = m.deform.fieldLayerIds?.length
    ? resolveLayerFieldEvaluators(project, comp, m.deform.fieldLayerIds, time)
    : [];
  if (
    Math.abs(bendAngle) < 1e-4 &&
    Math.abs(twistAngle) < 1e-4 &&
    Math.abs(dentDepth) < 1e-4 &&
    fieldEvals.length === 0
  ) {
    return baseMesh;
  }
  const layerWorldM = fieldEvals.length ? getLayerWorldMatrix(project, comp, layer, time) : null;

  return deformMesh3D(baseMesh, {
    bendAngle,
    bendAxis: m.deform.bendAxis || 'y',
    twistAngle,
    twistAxis: m.deform.twistAxis || 'y',
    dentDepth,
    dentCenter,
    dentRadius,
    fieldEvalFn: fieldEvals.length
      ? (lx, ly, lz, t) => {
          const wp = mat4TransformPoint(layerWorldM, [lx, ly, lz]);
          return evaluateCombinedFields(fieldEvals, wp[0], wp[1], wp[2], t);
        }
      : null,
    time,
  });
}

function gridCellKey(cx, cy, cz) {
  if (cx >= -16 && cx <= 239 && cy >= -16 && cy <= 239 && cz >= -16 && cz <= 239) {
    return (cx + 16) | ((cy + 16) << 8) | ((cz + 16) << 16);
  }
  return `${cx}_${cy}_${cz}`;
}

// 为碰撞体构建统一 3D 网格空间哈希加速结构（挂在网格对象上避免重复构建）
function buildColliderGrid(mesh) {
  if (mesh._colliderGrid) return mesh._colliderGrid;
  const b = mesh.bounds;
  const pad = 12;
  const minX = b.min[0] - pad, minY = b.min[1] - pad, minZ = b.min[2] - pad;
  const maxX = b.max[0] + pad, maxY = b.max[1] + pad, maxZ = b.max[2] + pad;
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1);
  const cellSize = Math.max(18, span / 10);
  const cells = new Map();

  const { positions, indices, triangleCount } = mesh;
  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3], i1 = indices[t * 3 + 1], i2 = indices[t * 3 + 2];
    const tMinX = Math.min(positions[i0 * 3], positions[i1 * 3], positions[i2 * 3]);
    const tMaxX = Math.max(positions[i0 * 3], positions[i1 * 3], positions[i2 * 3]);
    const tMinY = Math.min(positions[i0 * 3 + 1], positions[i1 * 3 + 1], positions[i2 * 3 + 1]);
    const tMaxY = Math.max(positions[i0 * 3 + 1], positions[i1 * 3 + 1], positions[i2 * 3 + 1]);
    const tMinZ = Math.min(positions[i0 * 3 + 2], positions[i1 * 3 + 2], positions[i2 * 3 + 2]);
    const tMaxZ = Math.max(positions[i0 * 3 + 2], positions[i1 * 3 + 2], positions[i2 * 3 + 2]);

    const x0 = Math.floor((tMinX - minX) / cellSize);
    const x1 = Math.floor((tMaxX - minX) / cellSize);
    const y0 = Math.floor((tMinY - minY) / cellSize);
    const y1 = Math.floor((tMaxY - minY) / cellSize);
    const z0 = Math.floor((tMinZ - minZ) / cellSize);
    const z1 = Math.floor((tMaxZ - minZ) / cellSize);

    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        for (let cz = z0; cz <= z1; cz++) {
          const key = gridCellKey(cx, cy, cz);
          let arr = cells.get(key);
          if (!arr) { arr = []; cells.set(key, arr); }
          arr.push(t);
        }
      }
    }
  }
  const grid = { minX, minY, minZ, maxX, maxY, maxZ, cellSize, cells };
  mesh._colliderGrid = grid;
  return grid;
}

// 线段 p0->p1 与三角形的精确相交或近表面穿透测试
function testSegmentVsTriangle(px0, py0, pz0, px1, py1, pz1, ax, ay, az, bx, by, bz, cx, cy, cz, margin = 3.5) {
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
  const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
  let nx = e1y * e2z - e1z * e2y;
  let ny = e1z * e2x - e1x * e2z;
  let nz = e1x * e2y - e1y * e2x;
  const area2 = Math.hypot(nx, ny, nz);
  if (area2 < 1e-6) return null;
  nx /= area2; ny /= area2; nz /= area2;

  const d0 = (px0 - ax) * nx + (py0 - ay) * ny + (pz0 - az) * nz;
  const d1 = (px1 - ax) * nx + (py1 - ay) * ny + (pz1 - az) * nz;

  // 粒子从正面或表面薄层穿过（d0 >= -margin 且 d1 <= margin 且 d1 < d0）
  if (!(d0 >= -margin * 1.6 && d1 <= margin && d1 < d0)) return null;

  const denom = d0 - d1;
  const t = denom > 1e-6 ? clamp(d0 / denom, 0, 1) : 1;
  const hx = lerp(px0, px1, t);
  const hy = lerp(py0, py1, t);
  const hz = lerp(pz0, pz1, t);

  // 重心坐标检查落入三角形（含小容差防止边缘漏穿）
  const v0x = cx - ax, v0y = cy - ay, v0z = cz - az;
  const v1x = bx - ax, v1y = by - ay, v1z = bz - az;
  const v2x = hx - ax, v2y = hy - ay, v2z = hz - az;
  const d00 = v0x * v0x + v0y * v0y + v0z * v0z;
  const d01 = v0x * v1x + v0y * v1y + v0z * v1z;
  const d02 = v0x * v2x + v0y * v2y + v0z * v2z;
  const d11 = v1x * v1x + v1y * v1y + v1z * v1z;
  const d12 = v1x * v2x + v1y * v2y + v1z * v2z;
  const invDenom = 1 / (d00 * d11 - d01 * d01 || 1e-9);
  const u = (d11 * d02 - d01 * d12) * invDenom;
  const v = (d00 * d12 - d01 * d02) * invDenom;
  if (u >= -0.06 && v >= -0.06 && u + v <= 1.12) {
    const b0 = clamp(1 - u - v, 0, 1);
    const b1 = clamp(v, 0, 1);
    const b2 = clamp(u, 0, 1);
    return { t, hitPos: [hx, hy, hz], normal: [nx, ny, nz], bary: [b0, b1, b2] };
  }
  return null;
}

function sampleCurvePoint(pathShape, u) {
  if (!pathShape || !pathShape.contours || pathShape.contours.length === 0) {
    return { pos: [0, 0, 0], normal: [0, -1, 0] };
  }
  const pts = flattenContour(pathShape.contours[0], 10);
  if (pts.length < 2) return { pos: [pts[0]?.[0] || 0, pts[0]?.[1] || 0, 0], normal: [0, -1, 0] };
  const idx = clamp(Math.floor(u * (pts.length - 1)), 0, pts.length - 2);
  const f = u * (pts.length - 1) - idx;
  const a = pts[idx], b = pts[idx + 1];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const dl = Math.hypot(dx, dy) || 1;
  return {
    pos: [lerp(a[0], b[0], f), lerp(a[1], b[1], f), 0],
    normal: [-dy / dl, dx / dl, 0],
  };
}

function randomConeDirection(normal, spreadDeg, r1, r2) {
  const spreadRad = clamp(spreadDeg, 0, 180) * DEG2RAD;
  const nx = normal[0], ny = normal[1], nz = normal[2];
  // 构造正交基
  const up = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let tx = up[1] * nz - up[2] * ny;
  let ty = up[2] * nx - up[0] * nz;
  let tz = up[0] * ny - up[1] * nx;
  const tl = Math.hypot(tx, ty, tz) || 1;
  tx /= tl; ty /= tl; tz /= tl;
  const bx = ny * tz - nz * ty;
  const by = nz * tx - nx * tz;
  const bz = nx * ty - ny * tx;

  const cosCone = Math.cos(spreadRad);
  const z = lerp(cosCone, 1, r1);
  const sinTheta = Math.sqrt(Math.max(0, 1 - z * z));
  const phi = r2 * Math.PI * 2;
  const x = Math.cos(phi) * sinTheta;
  const y = Math.sin(phi) * sinTheta;

  return [
    tx * x + bx * y + nx * z,
    ty * x + by * y + ny * z,
    tz * x + bz * y + nz * z,
  ];
}

// 模拟粒子图层在 targetTime 的完整状态（全确定性快照缓存，支持跳转、倒放与运动模糊多次取样）
export function evaluateParticleSystemAtTime(project, comp, layer, targetTime) {
  if (!layer || layer.type !== 'particle' || !layer.particle) {
    return { particles: [], trailWidth: 3, trailColor: [1, 0.6, 0.2, 1], trailFade: 0.85, trailEnabled: false };
  }

  const startT = Math.max(0, layer.inPoint || 0);
  if (targetTime < startT - 1e-4) {
    return { particles: [], trailWidth: 3, trailColor: [1, 0.6, 0.2, 1], trailFade: 0.85, trailEnabled: false };
  }

  const revKey = `${project.revision || 1}_${comp.id}_${layer.id}`;
  if (!layer._simCache || layer._simCache.revKey !== revKey) {
    layer._simCache = { revKey, snapshots: new Map() };
  }
  const cache = layer._simCache;

  const clampedTime = Math.max(startT, Math.min(comp.duration, targetTime));
  const relTime = clampedTime - startT;
  const targetStep = Math.floor(relTime / SIM_DT);
  const fracStep = (relTime - targetStep * SIM_DT) / SIM_DT;

  // 寻找 <= targetStep 最近的快照
  let snapStep = 0;
  let state = null;
  for (let s = Math.floor(targetStep / SNAPSHOT_INTERVAL) * SNAPSHOT_INTERVAL; s >= 0; s -= SNAPSHOT_INTERVAL) {
    if (cache.snapshots.has(s)) {
      snapStep = s;
      state = cloneParticleState(cache.snapshots.get(s));
      break;
    }
  }

  if (!state) {
    state = {
      step: 0,
      nextId: 1,
      emitAccums: layer.particle.emitters.map(() => 0),
      prevBurst: layer.particle.emitters.map(() => 0),
      particles: [],
    };
    cache.snapshots.set(0, cloneParticleState(state));
  }

  const pSys = layer.particle;
  const seed = pSys.seed || 2026;
  const maxStepsNeeded = targetStep + (fracStep > 1e-4 ? 1 : 0);

  let prevStepState = null;
  const prevMeshByCol = new Map();
  const stepTestedSet = new Set();

  for (let step = snapStep; step <= maxStepsNeeded; step++) {
    if (step === targetStep && fracStep > 1e-4) {
      prevStepState = cloneParticleState(state);
    }
    if (step === maxStepsNeeded) break;

    const tCur = startT + step * SIM_DT;
    const tPrev = Math.max(0, tCur - SIM_DT);

    // 1. 解析本步世界变换、物理场（仅在有存活粒子时解析碰撞体以节省空步开销）
    const layerWorldM = getLayerWorldMatrix(project, comp, layer, tCur);
    const layerWorldPrevM = getLayerWorldMatrix(project, comp, layer, tPrev);
    const gravity = evalProperty(project, comp, layer, 'particle.physics.gravity', tCur);
    const dirForce = evalProperty(project, comp, layer, 'particle.physics.directionalForce', tCur);
    const attractPos = evalProperty(project, comp, layer, 'particle.physics.attractPos', tCur);
    const attractStr = evalProperty(project, comp, layer, 'particle.physics.attractStrength', tCur);
    const drag = Math.max(0, evalProperty(project, comp, layer, 'particle.physics.drag', tCur));
    const trailEnabled = !!pSys.trail?.enabled;
    const trailLength = trailEnabled ? Math.max(0.02, evalProperty(project, comp, layer, 'particle.trail.length', tCur)) : 0;

    const fieldEvals = resolveLayerFieldEvaluators(project, comp, pSys.physics.fieldLayerIds, tCur);

    const activeColliders = [];
    if (state.particles.length > 0) {
      // 动态碰撞体以 30Hz（每两 1/60s 物理子步更新一次）刷新变形与空间哈希，兼具真实运动速度与高帧率 Seek 性能
      const colSampleT = Math.round(tCur * 30) / 30;
      const colPrevT = Math.max(0, colSampleT - 1 / 30);
      for (let cIdx = 0; cIdx < (pSys.colliders || []).length; cIdx++) {
        const col = pSys.colliders[cIdx];
        if (!col.enabled) continue;
        const curMesh = resolveWorldGeometryForLayerOrNode(project, comp, col.layerId, col.nodeBinding, colSampleT);
        if (!curMesh) continue;
        const prevMesh = prevMeshByCol.has(cIdx)
          ? prevMeshByCol.get(cIdx)
          : resolveWorldGeometryForLayerOrNode(project, comp, col.layerId, col.nodeBinding, colPrevT);
        prevMeshByCol.set(cIdx, curMesh);
        const grid = buildColliderGrid(curMesh);
        activeColliders.push({ col, curMesh, prevMesh, grid });
      }
    } else {
      prevMeshByCol.clear();
    }

    // 2. 从所有启用发射器生成粒子
    for (let eIdx = 0; eIdx < pSys.emitters.length; eIdx++) {
      const em = pSys.emitters[eIdx];
      if (!em.enabled) continue;
      const prefix = `particle.emitters.${eIdx}`;
      const rate = Math.max(0, evalProperty(project, comp, layer, `${prefix}.rate`, tCur));
      const burst = Math.max(0, evalProperty(project, comp, layer, `${prefix}.burst`, tCur));
      const speed = evalProperty(project, comp, layer, `${prefix}.speed`, tCur);
      const spread = evalProperty(project, comp, layer, `${prefix}.spread`, tCur);
      const life = Math.max(0.05, evalProperty(project, comp, layer, `${prefix}.life`, tCur));
      const sizeStart = evalProperty(project, comp, layer, `${prefix}.sizeStart`, tCur);
      const sizeEnd = evalProperty(project, comp, layer, `${prefix}.sizeEnd`, tCur);
      const cStart = evalProperty(project, comp, layer, `${prefix}.colorStart`, tCur);
      const cMid = evalProperty(project, comp, layer, `${prefix}.colorMid`, tCur);
      const cEnd = evalProperty(project, comp, layer, `${prefix}.colorEnd`, tCur);
      const localEmPos = evalProperty(project, comp, layer, `${prefix}.position`, tCur);

      state.emitAccums[eIdx] += rate * SIM_DT;
      let spawnCount = Math.floor(state.emitAccums[eIdx]);
      state.emitAccums[eIdx] -= spawnCount;

      // 爆发脉冲检测（上升沿或步进正脉冲）
      const prevB = state.prevBurst[eIdx] || 0;
      if (burst > 0.5 && prevB <= 0.5) {
        spawnCount += Math.round(burst);
      }
      state.prevBurst[eIdx] = burst;

      if (spawnCount <= 0) continue;

      let sampler = null;
      let prevGeo = null;
      let curGeo = null;
      if (em.sourceType === 'geometry') {
        curGeo = resolveWorldGeometryForLayerOrNode(project, comp, em.sourceLayerId, em.nodeBinding, tCur);
        if (curGeo) {
          sampler = buildSurfaceSampler(curGeo);
          if (Math.abs(em.inheritVelocity || 0) > 1e-6) {
            prevGeo = resolveWorldGeometryForLayerOrNode(project, comp, em.sourceLayerId, em.nodeBinding, tPrev);
          }
        }
      }

      for (let k = 0; k < spawnCount; k++) {
        const hBase = hashInts(seed, step, eIdx, k);
        const r0 = randFromHash(hBase, 1);
        const r1 = randFromHash(hBase, 2);
        const r2 = randFromHash(hBase, 3);
        const r3 = randFromHash(hBase, 4);
        const r4 = randFromHash(hBase, 5);
        const r5 = randFromHash(hBase, 6);

        let wPos, wNorm, wVel = [0, 0, 0];
        if (em.sourceType === 'geometry' && sampler) {
          const samp = samplePointOnMeshSurface(sampler, r0, r1, r2);
          wPos = samp.pos;
          wNorm = samp.normal;
          if (em.inheritVelocity && prevGeo) {
            // 使用发射体整体质心位移近似继承表面运动速度
            const cCur = [
              (curGeo.bounds.min[0] + curGeo.bounds.max[0]) * 0.5,
              (curGeo.bounds.min[1] + curGeo.bounds.max[1]) * 0.5,
              (curGeo.bounds.min[2] + curGeo.bounds.max[2]) * 0.5,
            ];
            const cPrev = [
              (prevGeo.bounds.min[0] + prevGeo.bounds.max[0]) * 0.5,
              (prevGeo.bounds.min[1] + prevGeo.bounds.max[1]) * 0.5,
              (prevGeo.bounds.min[2] + prevGeo.bounds.max[2]) * 0.5,
            ];
            wVel = [
              ((cCur[0] - cPrev[0]) / SIM_DT) * em.inheritVelocity,
              ((cCur[1] - cPrev[1]) / SIM_DT) * em.inheritVelocity,
              ((cCur[2] - cPrev[2]) / SIM_DT) * em.inheritVelocity,
            ];
          }
        } else if (em.sourceType === 'curve') {
          const curvePath = evalProperty(project, comp, layer, `${prefix}.curvePath`, tCur);
          const sc = sampleCurvePoint(curvePath, r0);
          wPos = mat4TransformPoint(layerWorldM, [sc.pos[0] + localEmPos[0], sc.pos[1] + localEmPos[1], localEmPos[2]]);
          const wPosPrev = mat4TransformPoint(layerWorldPrevM, [sc.pos[0] + localEmPos[0], sc.pos[1] + localEmPos[1], localEmPos[2]]);
          wNorm = mat4TransformVector(layerWorldM, sc.normal);
          const nl = Math.hypot(wNorm[0], wNorm[1], wNorm[2]) || 1;
          wNorm = [wNorm[0] / nl, wNorm[1] / nl, wNorm[2] / nl];
          if (em.inheritVelocity) {
            wVel = [
              ((wPos[0] - wPosPrev[0]) / SIM_DT) * em.inheritVelocity,
              ((wPos[1] - wPosPrev[1]) / SIM_DT) * em.inheritVelocity,
              ((wPos[2] - wPosPrev[2]) / SIM_DT) * em.inheritVelocity,
            ];
          }
        } else {
          wPos = mat4TransformPoint(layerWorldM, localEmPos);
          const wPosPrev = mat4TransformPoint(layerWorldPrevM, localEmPos);
          wNorm = [0, -1, 0];
          if (em.inheritVelocity) {
            wVel = [
              ((wPos[0] - wPosPrev[0]) / SIM_DT) * em.inheritVelocity,
              ((wPos[1] - wPosPrev[1]) / SIM_DT) * em.inheritVelocity,
              ((wPos[2] - wPosPrev[2]) / SIM_DT) * em.inheritVelocity,
            ];
          }
        }

        const dir = randomConeDirection(wNorm, spread, r3, r4);
        const spdVar = speed * (0.72 + r5 * 0.56);
        const lifeVar = life * (0.75 + randFromHash(hBase, 7) * 0.5);

        state.particles.push({
          id: state.nextId++,
          x: wPos[0],
          y: wPos[1],
          z: wPos[2],
          vx: dir[0] * spdVar + wVel[0],
          vy: dir[1] * spdVar + wVel[1],
          vz: dir[2] * spdVar + wVel[2],
          age: 0,
          life: lifeVar,
          sizeStart,
          sizeEnd,
          cStart: [...cStart],
          cMid: [...cMid],
          cEnd: [...cEnd],
          hitTimer: 0,
          hitColor: null,
          isSecondary: false,
          trail: trailEnabled ? [[tCur, wPos[0], wPos[1], wPos[2]]] : [],
        });
      }
    }

    // 3. 推进所有存活粒子并执行力场 + 碰撞 + 拖尾记录
    const nextParticles = [];
    const secondarySpawns = [];

    for (let i = 0; i < state.particles.length; i++) {
      const pt = state.particles[i];
      pt.age += SIM_DT;
      if (pt.age >= pt.life) continue;

      if (pt.hitTimer > 0) pt.hitTimer = Math.max(0, pt.hitTimer - SIM_DT);

      // 累加外力：重力 + 方向力 + 吸引/排斥 + 2.8 空间场
      let ax = (gravity[0] || 0) + (dirForce[0] || 0);
      let ay = (gravity[1] || 0) + (dirForce[1] || 0);
      let az = (gravity[2] || 0) + (dirForce[2] || 0);

      if (Math.abs(attractStr) > 1e-3) {
        const dx = (attractPos[0] || 0) - pt.x;
        const dy = (attractPos[1] || 0) - pt.y;
        const dz = (attractPos[2] || 0) - pt.z;
        const d2 = dx * dx + dy * dy + dz * dz + 400;
        const d = Math.sqrt(d2);
        const f = attractStr / Math.max(1, d * 0.05);
        ax += (dx / d) * f;
        ay += (dy / d) * f;
        az += (dz / d) * f;
      }

      if (fieldEvals.length > 0) {
        const fv = evaluateCombinedFields(fieldEvals, pt.x, pt.y, pt.z, tCur);
        ax += fv[0] * 12;
        ay += fv[1] * 12;
        az += fv[2] * 12;
      }

      // 阻力阻尼
      const damp = Math.exp(-drag * SIM_DT);
      pt.vx = (pt.vx + ax * SIM_DT) * damp;
      pt.vy = (pt.vy + ay * SIM_DT) * damp;
      pt.vz = (pt.vz + az * SIM_DT) * damp;

      const ox = pt.x, oy = pt.y, oz = pt.z;
      let nx = ox + pt.vx * SIM_DT;
      let ny = oy + pt.vy * SIM_DT;
      let nz = oz + pt.vz * SIM_DT;

      // 碰撞检测（真实表面、法线与碰撞体运动速度）
      for (const ac of activeColliders) {
        const g = ac.grid;
        const minPX = Math.min(ox, nx), maxPX = Math.max(ox, nx);
        const minPY = Math.min(oy, ny), maxPY = Math.max(oy, ny);
        const minPZ = Math.min(oz, nz), maxPZ = Math.max(oz, nz);
        if (maxPX < g.minX || minPX > g.maxX || maxPY < g.minY || minPY > g.maxY || maxPZ < g.minZ || minPZ > g.maxZ) {
          continue;
        }

        const cx0 = Math.floor((minPX - g.minX) / g.cellSize);
        const cx1 = Math.floor((maxPX - g.minX) / g.cellSize);
        const cy0 = Math.floor((minPY - g.minY) / g.cellSize);
        const cy1 = Math.floor((maxPY - g.minY) / g.cellSize);
        const cz0 = Math.floor((minPZ - g.minZ) / g.cellSize);
        const cz1 = Math.floor((maxPZ - g.minZ) / g.cellSize);

        stepTestedSet.clear();
        const tested = stepTestedSet;
        let bestHit = null;
        const { positions, indices } = ac.curMesh;

        for (let cx = cx0; cx <= cx1; cx++) {
          for (let cy = cy0; cy <= cy1; cy++) {
            for (let cz = cz0; cz <= cz1; cz++) {
              const list = g.cells.get(gridCellKey(cx, cy, cz));
              if (!list) continue;
              for (const tIdx of list) {
                if (tested.has(tIdx)) continue;
                tested.add(tIdx);
                const i0 = indices[tIdx * 3], i1 = indices[tIdx * 3 + 1], i2 = indices[tIdx * 3 + 2];
                const hit = testSegmentVsTriangle(
                  ox, oy, oz, nx, ny, nz,
                  positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2],
                  positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2],
                  positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2],
                  4.0
                );
                if (hit && (!bestHit || hit.t < bestHit.t)) {
                  bestHit = { ...hit, tIdx, i0, i1, i2 };
                }
              }
            }
          }
        }

        if (bestHit) {
          // 计算碰撞表面运动速度
          let surfVx = 0, surfVy = 0, surfVz = 0;
          if (ac.prevMesh && ac.prevMesh.positions.length === ac.curMesh.positions.length) {
            const pPos = ac.prevMesh.positions;
            const [b0, b1, b2] = bestHit.bary;
            const prevHx = pPos[bestHit.i0 * 3] * b0 + pPos[bestHit.i1 * 3] * b1 + pPos[bestHit.i2 * 3] * b2;
            const prevHy = pPos[bestHit.i0 * 3 + 1] * b0 + pPos[bestHit.i1 * 3 + 1] * b1 + pPos[bestHit.i2 * 3 + 1] * b2;
            const prevHz = pPos[bestHit.i0 * 3 + 2] * b0 + pPos[bestHit.i1 * 3 + 2] * b1 + pPos[bestHit.i2 * 3 + 2] * b2;
            surfVx = (bestHit.hitPos[0] - prevHx) / SIM_DT;
            surfVy = (bestHit.hitPos[1] - prevHy) / SIM_DT;
            surfVz = (bestHit.hitPos[2] - prevHz) / SIM_DT;
          }

          const N = bestHit.normal;
          const rvx = pt.vx - surfVx;
          const rvy = pt.vy - surfVy;
          const rvz = pt.vz - surfVz;
          const vn = rvx * N[0] + rvy * N[1] + rvz * N[2];
          if (vn < 0) {
            const rest = clamp(ac.col.restitution ?? 0.55, 0, 1.2);
            const fric = clamp(ac.col.friction ?? 0.25, 0, 1);
            const vtx = rvx - vn * N[0];
            const vty = rvy - vn * N[1];
            const vtz = rvz - vn * N[2];

            pt.vx = vtx * (1 - fric) - vn * rest * N[0] + surfVx;
            pt.vy = vty * (1 - fric) - vn * rest * N[1] + surfVy;
            pt.vz = vtz * (1 - fric) - vn * rest * N[2] + surfVz;

            nx = bestHit.hitPos[0] + N[0] * 2.2;
            ny = bestHit.hitPos[1] + N[1] * 2.2;
            nz = bestHit.hitPos[2] + N[2] * 2.2;

            // 碰撞触发颜色/寿命变化与次级发射
            if (ac.col.hitColor) {
              pt.hitTimer = 0.28;
              pt.hitColor = [...ac.col.hitColor];
            }
            if (ac.col.hitLifeDelta) {
              pt.life = Math.max(pt.age + 0.04, pt.life + ac.col.hitLifeDelta);
            }
            const secCnt = !pt.isSecondary ? Math.min(4, Math.round(ac.col.secondaryEmitCount || 0)) : 0;
            if (secCnt > 0 && Math.hypot(pt.vx, pt.vy, pt.vz) > 45) {
              for (let s = 0; s < secCnt; s++) {
                const sh = hashInts(seed, step, pt.id, s + 99);
                const sDir = randomConeDirection(N, 55, randFromHash(sh, 1), randFromHash(sh, 2));
                const sSpd = (ac.col.secondarySpeed || 130) * (0.65 + randFromHash(sh, 3) * 0.7);
                secondarySpawns.push({
                  id: state.nextId++,
                  x: nx,
                  y: ny,
                  z: nz,
                  vx: sDir[0] * sSpd + surfVx,
                  vy: sDir[1] * sSpd + surfVy,
                  vz: sDir[2] * sSpd + surfVz,
                  age: 0,
                  life: 0.35 + randFromHash(sh, 4) * 0.35,
                  sizeStart: pt.sizeStart * 0.6,
                  sizeEnd: 0.5,
                  cStart: ac.col.hitColor ? [...ac.col.hitColor] : [...pt.cStart],
                  cMid: [...pt.cMid],
                  cEnd: [...pt.cEnd],
                  hitTimer: 0,
                  hitColor: null,
                  isSecondary: true,
                  trail: trailEnabled ? [[tCur + SIM_DT, nx, ny, nz]] : [],
                });
              }
            }
          }
          break;
        }
      }

      pt.x = nx;
      pt.y = ny;
      pt.z = nz;

      if (trailEnabled) {
        pt.trail.push([tCur + SIM_DT, nx, ny, nz]);
        const cutoff = tCur + SIM_DT - trailLength;
        while (pt.trail.length > 2 && pt.trail[1][0] < cutoff) {
          pt.trail.shift();
        }
      }

      nextParticles.push(pt);
    }

    if (secondarySpawns.length > 0) {
      for (const sp of secondarySpawns) nextParticles.push(sp);
    }
    // 合理上限保证交互流畅
    if (nextParticles.length > 3500) {
      nextParticles.splice(0, nextParticles.length - 3500);
    }
    state.particles = nextParticles;
    state.step = step + 1;

    if (state.step % SNAPSHOT_INTERVAL === 0 && !cache.snapshots.has(state.step)) {
      cache.snapshots.set(state.step, cloneParticleState(state));
    }
  }

  // 子步插值（使 60fps 导出及慢动作运动模糊无比顺滑）
  let finalParticles = state.particles;
  if (prevStepState && fracStep > 1e-4) {
    const prevMap = new Map(prevStepState.particles.map((p) => [p.id, p]));
    finalParticles = state.particles.map((p) => {
      const old = prevMap.get(p.id);
      if (!old) return p;
      return {
        ...p,
        x: lerp(old.x, p.x, fracStep),
        y: lerp(old.y, p.y, fracStep),
        z: lerp(old.z, p.z, fracStep),
        age: lerp(old.age, p.age, fracStep),
      };
    });
  }

  // 计算渲染用颜色与尺寸
  const renderList = finalParticles.map((pt) => {
    const u = clamp(pt.age / pt.life, 0, 1);
    const size = lerp(pt.sizeStart, pt.sizeEnd, u);
    let r, g, b, a;
    if (u < 0.45) {
      const k = u / 0.45;
      r = lerp(pt.cStart[0], pt.cMid[0], k);
      g = lerp(pt.cStart[1], pt.cMid[1], k);
      b = lerp(pt.cStart[2], pt.cMid[2], k);
      a = lerp(pt.cStart[3] ?? 1, pt.cMid[3] ?? 1, k);
    } else {
      const k = (u - 0.45) / 0.55;
      r = lerp(pt.cMid[0], pt.cEnd[0], k);
      g = lerp(pt.cMid[1], pt.cEnd[1], k);
      b = lerp(pt.cMid[2], pt.cEnd[2], k);
      a = lerp(pt.cMid[3] ?? 1, pt.cEnd[3] ?? 0, k);
    }
    if (pt.hitTimer > 0 && pt.hitColor) {
      const f = clamp(pt.hitTimer / 0.28, 0, 1);
      r = lerp(r, pt.hitColor[0], f);
      g = lerp(g, pt.hitColor[1], f);
      b = lerp(b, pt.hitColor[2], f);
    }
    return {
      id: pt.id,
      x: pt.x,
      y: pt.y,
      z: pt.z,
      size,
      color: [r, g, b, a],
      trail: pt.trail,
    };
  });

  const trailWidth = evalProperty(project, comp, layer, 'particle.trail.width', clampedTime);
  const trailColor = evalProperty(project, comp, layer, 'particle.trail.color', clampedTime);
  const trailFade = evalProperty(project, comp, layer, 'particle.trail.fade', clampedTime);

  return {
    particles: renderList,
    trailEnabled: !!pSys.trail?.enabled,
    trailWidth,
    trailColor,
    trailFade,
  };
}
