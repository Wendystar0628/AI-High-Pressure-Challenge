// 空间场系统：距离衰减、噪声、旋涡、方向场与混合，同时作用于几何顶点变形与粒子运动

import { clamp, lerp, curlNoise3D, noise3D, mat4TransformPoint } from '../core/math.js';
import { evalProperty } from '../core/expressions.js';
import { getLayerById, getLayerWorldMatrix, isLayerActiveAtTime } from '../core/project.js';

export function evaluateSingleFieldAtPoint(fieldDef, fieldWorldPos, px, py, pz, time, evalParams = null) {
  if (!fieldDef || !fieldDef.enabled) return { vec: [0, 0, 0], weight: 0 };

  const fx = fieldWorldPos[0] || 0;
  const fy = fieldWorldPos[1] || 0;
  const fz = fieldWorldPos[2] || 0;

  const strength = evalParams?.strength ?? fieldDef.strength?.value ?? 40;
  const radius = Math.max(1, evalParams?.radius ?? fieldDef.radius?.value ?? 240);
  const falloffPow = Math.max(0.1, evalParams?.falloff ?? fieldDef.falloff?.value ?? 1.5);
  const freq = evalParams?.frequency ?? fieldDef.frequency?.value ?? 0.012;
  const speed = evalParams?.speed ?? fieldDef.speed?.value ?? 1.2;
  const dir = evalParams?.direction ?? fieldDef.direction?.value ?? [0, -1, 0];

  const dx = px - fx;
  const dy = py - fy;
  const dz = pz - fz;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > radius && fieldDef.kind !== 'directional') {
    return { vec: [0, 0, 0], weight: 0 };
  }

  const normD = clamp(dist / radius, 0, 1);
  const weight = fieldDef.kind === 'directional' ? 1 : Math.pow(1 - normD, falloffPow);

  let vx = 0, vy = 0, vz = 0;

  if (fieldDef.kind === 'distanceFalloff') {
    // 径向冲击/排斥衰减场：沿中心向外推开（或负强度向内吸聚）
    if (dist > 1e-5) {
      vx = (dx / dist) * strength * weight;
      vy = (dy / dist) * strength * weight;
      vz = (dz / dist) * strength * weight;
    } else {
      vy = -strength * weight;
    }
  } else if (fieldDef.kind === 'noise') {
    const tShift = time * speed;
    const c = curlNoise3D(px * freq + tShift * 0.4, py * freq - tShift * 0.3, pz * freq + tShift * 0.2, 421);
    const n3 = noise3D(px * freq * 0.7, py * freq * 0.7, pz * freq * 0.7 + tShift, 991);
    vx = (c[0] * 0.8 + n3 * 0.2) * strength * weight;
    vy = (c[1] * 0.8 + n3 * 0.2) * strength * weight;
    vz = c[2] * strength * weight;
  } else if (fieldDef.kind === 'vortex') {
    // 绕给定轴向旋转的旋涡场（带轻微向心/上升螺旋分量）
    const axLen = Math.hypot(dir[0] || 0, dir[1] || 0, dir[2] || 0) || 1;
    const ax = (dir[0] || 0) / axLen;
    const ay = (dir[1] ?? -1) / axLen;
    const az = (dir[2] || 0) / axLen;
    // tang = axis x r
    const tx = ay * dz - az * dy;
    const ty = az * dx - ax * dz;
    const tz = ax * dy - ay * dx;
    const tl = Math.hypot(tx, ty, tz) || 1;
    const swirl = strength * weight;
    vx = (tx / tl) * swirl + ax * swirl * 0.18;
    vy = (ty / tl) * swirl + ay * swirl * 0.18;
    vz = (tz / tl) * swirl + az * swirl * 0.18;
  } else if (fieldDef.kind === 'attract') {
    if (dist > 1e-4) {
      vx = (-dx / dist) * strength * weight;
      vy = (-dy / dist) * strength * weight;
      vz = (-dz / dist) * strength * weight;
    }
  } else {
    // directional
    const dl = Math.hypot(dir[0] || 0, dir[1] || 0, dir[2] || 0) || 1;
    vx = ((dir[0] || 0) / dl) * strength * weight;
    vy = ((dir[1] || 0) / dl) * strength * weight;
    vz = ((dir[2] || 0) / dl) * strength * weight;
  }

  return { vec: [vx, vy, vz], weight };
}

// 从场景中的场控制图层列表采样并混合总场向量（支持位置与动画关键帧/表达式）
export function resolveLayerFieldEvaluators(project, comp, fieldLayerIds, time) {
  const evaluators = [];
  const ids = fieldLayerIds && fieldLayerIds.length > 0
    ? fieldLayerIds
    : comp.layers.filter((l) => l.spatialField && l.spatialField.enabled).map((l) => l.id);

  for (const id of ids) {
    const lyr = getLayerById(comp, id);
    if (!lyr || !lyr.spatialField || !lyr.spatialField.enabled) continue;
    if (!isLayerActiveAtTime(lyr, time)) continue;
    const worldM = getLayerWorldMatrix(project, comp, lyr, time);
    const worldPos = mat4TransformPoint(worldM, [0, 0, 0]);
    const prefix = 'spatialField';
    const evalParams = {
      strength: evalProperty(project, comp, lyr, `${prefix}.strength`, time),
      radius: evalProperty(project, comp, lyr, `${prefix}.radius`, time),
      falloff: evalProperty(project, comp, lyr, `${prefix}.falloff`, time),
      frequency: evalProperty(project, comp, lyr, `${prefix}.frequency`, time),
      speed: evalProperty(project, comp, lyr, `${prefix}.speed`, time),
      direction: evalProperty(project, comp, lyr, `${prefix}.direction`, time),
    };
    evaluators.push({
      layer: lyr,
      field: lyr.spatialField,
      worldPos,
      evalParams,
    });
  }
  return evaluators;
}

export function evaluateCombinedFields(evaluators, px, py, pz, time) {
  let sx = 0, sy = 0, sz = 0;
  for (const item of evaluators) {
    const { vec, weight } = evaluateSingleFieldAtPoint(item.field, item.worldPos, px, py, pz, time, item.evalParams);
    const mode = item.field.blendMode || 'add';
    if (mode === 'multiply') {
      const f = clamp(weight, 0, 2);
      sx = sx * f + vec[0] * 0.25;
      sy = sy * f + vec[1] * 0.25;
      sz = sz * f + vec[2] * 0.25;
    } else if (mode === 'mix') {
      const m = clamp(weight, 0, 1);
      sx = lerp(sx, vec[0], m);
      sy = lerp(sy, vec[1], m);
      sz = lerp(sz, vec[2], m);
    } else {
      sx += vec[0];
      sy += vec[1];
      sz += vec[2];
    }
  }
  return [sx, sy, sz];
}
