// 关键帧属性系统：线性/贝塞尔/定格时间插值、空间路径弧长LUT、路径形变与曲线工具

import { clamp, lerp, evalCubicBezier, buildBezierArcLengthLUT, arcLengthToParam } from './math.js';

let _kfIdCounter = 1;
export function nextKeyframeId() {
  return 'kf_' + (_kfIdCounter++);
}

export function cloneVal(v) {
  if (Array.isArray(v)) return v.map(cloneVal);
  if (v && typeof v === 'object') {
    if (v.contours) {
      return {
        fillRule: v.fillRule || 'nonzero',
        contours: v.contours.map((c) => ({
          closed: !!c.closed,
          points: c.points.map((p) => ({ ...p })),
        })),
      };
    }
    return JSON.parse(JSON.stringify(v));
  }
  return v;
}

export function makeProp(type, defaultValue, opts = {}) {
  return {
    type, // 'number' | 'vec2' | 'vec3' | 'color' | 'path' | 'string' | 'enum' | 'boolean'
    value: cloneVal(defaultValue),
    animated: false,
    keyframes: [],
    expressionEnabled: false,
    expression: '',
    spatial: !!opts.spatial,
    min: opts.min,
    max: opts.max,
    step: opts.step,
    label: opts.label || '',
    unit: opts.unit || '',
  };
}

export function makeKeyframe(time, value, opts = {}) {
  const dim = Array.isArray(value) ? value.length : 1;
  const zeroTangent = dim === 2 ? [0, 0] : [0, 0, 0];
  return {
    id: opts.id || nextKeyframeId(),
    time: Number(time) || 0,
    value: cloneVal(value),
    inInterp: opts.inInterp || 'linear',   // 'linear' | 'bezier' | 'hold'
    outInterp: opts.outInterp || 'linear', // 'linear' | 'bezier' | 'hold'
    inEase: opts.inEase ? { ...opts.inEase } : { influence: 33.33, speed: 0 },
    outEase: opts.outEase ? { ...opts.outEase } : { influence: 33.33, speed: 0 },
    inTangent: opts.inTangent ? [...opts.inTangent] : [...zeroTangent],
    outTangent: opts.outTangent ? [...opts.outTangent] : [...zeroTangent],
    spatialAuto: opts.spatialAuto !== undefined ? !!opts.spatialAuto : false,
  };
}

export function sortKeyframes(prop) {
  if (!prop.keyframes) return;
  prop.keyframes.sort((a, b) => a.time - b.time);
}

export function addOrUpdateKeyframe(prop, time, value, opts = {}) {
  const t = Math.round(time * 10000) / 10000;
  if (!prop.keyframes) prop.keyframes = [];
  const eps = 1e-3;
  const existing = prop.keyframes.find((k) => Math.abs(k.time - t) < eps);
  if (existing) {
    existing.value = cloneVal(value);
    if (opts.inInterp) existing.inInterp = opts.inInterp;
    if (opts.outInterp) existing.outInterp = opts.outInterp;
    if (opts.inEase) existing.inEase = { ...opts.inEase };
    if (opts.outEase) existing.outEase = { ...opts.outEase };
    if (opts.inTangent) existing.inTangent = [...opts.inTangent];
    if (opts.outTangent) existing.outTangent = [...opts.outTangent];
    invalidateSpatialCache(prop);
    return existing;
  }
  const kf = makeKeyframe(t, value, opts);
  prop.keyframes.push(kf);
  sortKeyframes(prop);
  invalidateSpatialCache(prop);
  return kf;
}

export function removeKeyframeById(prop, id) {
  if (!prop.keyframes) return false;
  const idx = prop.keyframes.findIndex((k) => k.id === id);
  if (idx >= 0) {
    prop.keyframes.splice(idx, 1);
    invalidateSpatialCache(prop);
    return true;
  }
  return false;
}

export function invalidateSpatialCache(prop) {
  if (prop && prop._lutCache) prop._lutCache = null;
}

// 求解三次贝塞尔时间曲线 x(s) = targetX (x0=0, x1=outInf, x2=1-inInf, x3=1)
function solveBezierTimeS(x1, x2, targetX) {
  const u = clamp(targetX, 0, 1);
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  let lo = 0, hi = 1;
  let s = u;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  for (let i = 0; i < 8; i++) {
    const x = ((ax * s + bx) * s + cx) * s;
    const err = x - u;
    if (Math.abs(err) < 1e-7) return s;
    if (err < 0) lo = s;
    else hi = s;
    const dx = (3 * ax * s + 2 * bx) * s + cx;
    if (Math.abs(dx) > 1e-6) {
      const next = s - err / dx;
      s = next > lo && next < hi ? next : 0.5 * (lo + hi);
    } else {
      s = 0.5 * (lo + hi);
    }
  }
  for (let i = 0; i < 16; i++) {
    const x = ((ax * s + bx) * s + cx) * s;
    if (Math.abs(x - u) < 1e-7) break;
    if (x < u) lo = s;
    else hi = s;
    s = 0.5 * (lo + hi);
  }
  return s;
}

function evalScalarSegmentBezier(k0, k1, v0, v1, t, outSpeedOverride = null, inSpeedOverride = null) {
  const dt = k1.time - k0.time;
  if (dt <= 1e-9) return { value: v1, velocity: 0 };
  if (k0.outInterp === 'hold') {
    return { value: v0, velocity: 0 };
  }
  const dv = v1 - v0;
  const avgSpeed = dv / dt;

  if (k0.outInterp === 'linear' && k1.inInterp === 'linear') {
    const frac = clamp((t - k0.time) / dt, 0, 1);
    return { value: v0 + dv * frac, velocity: avgSpeed };
  }

  const outIsLin = k0.outInterp === 'linear';
  const inIsLin = k1.inInterp === 'linear';

  const outInf = clamp(outIsLin ? 0.25 : (k0.outEase?.influence ?? 33.33) / 100, 0.001, 1);
  const inInf = clamp(inIsLin ? 0.25 : (k1.inEase?.influence ?? 33.33) / 100, 0.001, 1);

  const outSpd = outIsLin
    ? avgSpeed
    : (outSpeedOverride !== null ? outSpeedOverride : (k0.outEase?.speed ?? 0));
  const inSpd = inIsLin
    ? avgSpeed
    : (inSpeedOverride !== null ? inSpeedOverride : (k1.inEase?.speed ?? 0));

  const x1 = outInf;
  const x2 = 1 - inInf;
  const y0 = v0;
  const y1 = v0 + outSpd * dt * outInf;
  const y2 = v1 - inSpd * dt * inInf;
  const y3 = v1;

  const targetX = clamp((t - k0.time) / dt, 0, 1);
  const s = solveBezierTimeS(x1, x2, targetX);
  const mt = 1 - s;
  const val = mt * mt * mt * y0 + 3 * mt * mt * s * y1 + 3 * mt * s * s * y2 + s * s * s * y3;

  const dyDs = 3 * mt * mt * (y1 - y0) + 6 * mt * s * (y2 - y1) + 3 * s * s * (y3 - y2);
  const dxDs = 3 * mt * mt * x1 + 6 * mt * s * (x2 - x1) + 3 * s * s * (1 - x2);
  const vel = dxDs > 1e-6 ? dyDs / (dxDs * dt) : avgSpeed;

  return { value: val, velocity: vel };
}

function getSpatialSegmentLUT(prop, segIndex, k0, k1) {
  if (!prop._lutCache) prop._lutCache = new Map();
  const key = `${segIndex}_${k0.id}_${k1.id}_${k0.value.join(',')}_${k1.value.join(',')}_${k0.outTangent.join(',')}_${k1.inTangent.join(',')}`;
  let cached = prop._lutCache.get(key);
  if (cached) return cached;

  const p0 = k0.value;
  const p3 = k1.value;
  const dim = p0.length;
  const p1 = new Array(dim);
  const p2 = new Array(dim);
  for (let i = 0; i < dim; i++) {
    p1[i] = (p0[i] || 0) + (k0.outTangent?.[i] || 0);
    p2[i] = (p3[i] || 0) + (k1.inTangent?.[i] || 0);
  }
  cached = { p0, p1, p2, p3, ...buildBezierArcLengthLUT(p0, p1, p2, p3, 64) };
  prop._lutCache.set(key, cached);
  return cached;
}

// 供曲线编辑器直接读取标准化时间曲线（值/进度）
export function evalTemporalProgress(k0, k1, t, totalArcLength = 1) {
  const dt = k1.time - k0.time;
  if (dt <= 1e-9) return { progress: 1, speed: 0 };
  if (k0.outInterp === 'hold') return { progress: 0, speed: 0 };
  const scale = totalArcLength > 1e-6 ? totalArcLength : 1;
  const outSpdNorm = (k0.outEase?.speed ?? 0) / scale;
  const inSpdNorm = (k1.inEase?.speed ?? 0) / scale;
  const res = evalScalarSegmentBezier(k0, k1, 0, 1, t, outSpdNorm, inSpdNorm);
  return {
    progress: res.value,
    speed: res.velocity * totalArcLength,
  };
}

// 评估属性静态/关键帧值（不含表达式）
export function evalPropertyKeyframeValue(prop, time) {
  if (!prop) return 0;
  const kfs = prop.keyframes;
  if (!prop.animated || !kfs || kfs.length === 0) {
    return cloneVal(prop.value);
  }
  if (kfs.length === 1 || time <= kfs[0].time) {
    return cloneVal(kfs[0].value);
  }
  const last = kfs[kfs.length - 1];
  if (time >= last.time) {
    return cloneVal(last.value);
  }

  let segIdx = 0;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (time >= kfs[i].time && time <= kfs[i + 1].time) {
      segIdx = i;
      break;
    }
  }
  const k0 = kfs[segIdx];
  const k1 = kfs[segIdx + 1];

  if (k0.outInterp === 'hold') {
    return cloneVal(k0.value);
  }

  if (prop.type === 'number') {
    return evalScalarSegmentBezier(k0, k1, k0.value, k1.value, time).value;
  }

  if (prop.type === 'boolean' || prop.type === 'string' || prop.type === 'enum') {
    return cloneVal(k0.value);
  }

  if (prop.type === 'path') {
    const prog = evalTemporalProgress(k0, k1, time, 1).progress;
    return morphPathShapes(k0.value, k1.value, prog);
  }

  if (prop.spatial && Array.isArray(k0.value)) {
    const lut = getSpatialSegmentLUT(prop, segIdx, k0, k1);
    const L = lut.totalLength;
    if (L <= 1e-8) return cloneVal(k0.value);
    const { progress } = evalTemporalProgress(k0, k1, time, L);
    const targetLen = clamp(progress, 0, 1) * L;
    const s = arcLengthToParam(lut, targetLen);
    return evalCubicBezier(lut.p0, lut.p1, lut.p2, lut.p3, s);
  }

  if (Array.isArray(k0.value)) {
    const out = new Array(k0.value.length);
    // 向量按最大变化轴或独立速度插值
    const dt = k1.time - k0.time;
    const usePerCompSpeed = Array.isArray(k0.outEase?.speed) || Array.isArray(k1.inEase?.speed);
    if (usePerCompSpeed) {
      for (let c = 0; c < k0.value.length; c++) {
        const sOut = Array.isArray(k0.outEase?.speed) ? k0.outEase.speed[c] : (k0.outEase?.speed ?? 0);
        const sIn = Array.isArray(k1.inEase?.speed) ? k1.inEase.speed[c] : (k1.inEase?.speed ?? 0);
        out[c] = evalScalarSegmentBezier(k0, k1, k0.value[c], k1.value[c], time, sOut, sIn).value;
      }
    } else {
      let maxMag = 0;
      for (let c = 0; c < k0.value.length; c++) {
        maxMag = Math.max(maxMag, Math.abs((k1.value[c] ?? 0) - (k0.value[c] ?? 0)));
      }
      const { progress } = evalTemporalProgress(k0, k1, time, maxMag || 1);
      for (let c = 0; c < k0.value.length; c++) {
        out[c] = lerp(k0.value[c] ?? 0, k1.value[c] ?? 0, progress);
      }
      void dt;
    }
    return out;
  }

  return cloneVal(k0.value);
}

// 计算属性在 time 时刻的变化速率（供速度曲线使用；对空间位置返回沿运动路径的实际速度）
export function evalPropertySpeed(prop, time, compIndex = 0) {
  if (!prop || !prop.animated || !prop.keyframes || prop.keyframes.length < 2) return 0;
  const kfs = prop.keyframes;
  if (time < kfs[0].time || time > kfs[kfs.length - 1].time) return 0;

  let segIdx = 0;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (time >= kfs[i].time && time <= kfs[i + 1].time) {
      segIdx = i;
      break;
    }
  }
  const k0 = kfs[segIdx];
  const k1 = kfs[segIdx + 1];
  if (k0.outInterp === 'hold') return 0;

  if (prop.type === 'number') {
    return evalScalarSegmentBezier(k0, k1, k0.value, k1.value, time).velocity;
  }

  if (prop.spatial && Array.isArray(k0.value)) {
    const lut = getSpatialSegmentLUT(prop, segIdx, k0, k1);
    return evalTemporalProgress(k0, k1, time, lut.totalLength).speed;
  }

  if (Array.isArray(k0.value)) {
    if (compIndex >= 0 && compIndex < k0.value.length) {
      let maxMag = 0;
      for (let c = 0; c < k0.value.length; c++) {
        maxMag = Math.max(maxMag, Math.abs((k1.value[c] ?? 0) - (k0.value[c] ?? 0)));
      }
      const { speed } = evalTemporalProgress(k0, k1, time, maxMag || 1);
      const dv = (k1.value[compIndex] ?? 0) - (k0.value[compIndex] ?? 0);
      return maxMag > 1e-6 ? speed * (dv / maxMag) : 0;
    }
    let sq = 0;
    for (let c = 0; c < k0.value.length; c++) {
      const d = (k1.value[c] ?? 0) - (k0.value[c] ?? 0);
      sq += d * d;
    }
    const mag = Math.sqrt(sq);
    return evalTemporalProgress(k0, k1, time, mag || 1).speed;
  }

  return 0;
}

export function getSpatialSegmentLength(prop, segIdx) {
  const kfs = prop.keyframes;
  if (!kfs || segIdx < 0 || segIdx >= kfs.length - 1) return 0;
  return getSpatialSegmentLUT(prop, segIdx, kfs[segIdx], kfs[segIdx + 1]).totalLength;
}

export function applyEasyEaseToKeyframes(prop, kfIds, mode = 'both') {
  if (!prop.keyframes) return;
  const set = new Set(kfIds);
  for (const kf of prop.keyframes) {
    if (!set.has(kf.id)) continue;
    if (mode === 'both' || mode === 'in') {
      kf.inInterp = 'bezier';
      kf.inEase = { influence: 33.33, speed: 0 };
    }
    if (mode === 'both' || mode === 'out') {
      kf.outInterp = 'bezier';
      kf.outEase = { influence: 33.33, speed: 0 };
    }
  }
}

export function stretchKeyframes(prop, kfIds, anchorTime, scaleFactor) {
  if (!prop.keyframes || Math.abs(scaleFactor) < 1e-4) return;
  const set = new Set(kfIds);
  for (const kf of prop.keyframes) {
    if (!set.has(kf.id)) continue;
    kf.time = Math.max(0, anchorTime + (kf.time - anchorTime) * scaleFactor);
  }
  sortKeyframes(prop);
  invalidateSpatialCache(prop);
}

// ---- 路径形状形变（支持含孔洞的多个轮廓一一对应） ----

function contourSignedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    a += p1.x * p2.y - p2.x * p1.y;
  }
  return a * 0.5;
}

function sampleContourUniform(contour, numPts) {
  const pts = contour.points;
  if (!pts || pts.length === 0) return [];
  if (pts.length === 1) return Array.from({ length: numPts }, () => ({ ...pts[0] }));

  // 采样每个贝塞尔段并按弧长均匀重采样
  const dense = [];
  const segCount = contour.closed ? pts.length : pts.length - 1;
  const sub = 12;
  for (let i = 0; i < segCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const p0 = [a.x, a.y];
    const p1 = [a.x + (a.outX || 0), a.y + (a.outY || 0)];
    const p2 = [b.x + (b.inX || 0), b.y + (b.inY || 0)];
    const p3 = [b.x, b.y];
    for (let s = 0; s < sub; s++) {
      const t = s / sub;
      const xy = evalCubicBezier(p0, p1, p2, p3, t);
      dense.push({ x: xy[0], y: xy[1] });
    }
  }
  if (!contour.closed) {
    const last = pts[pts.length - 1];
    dense.push({ x: last.x, y: last.y });
  }
  if (dense.length < 2) return Array.from({ length: numPts }, () => ({ x: dense[0].x, y: dense[0].y }));

  const cum = [0];
  let total = 0;
  const edgeLenCount = contour.closed ? dense.length : dense.length - 1;
  for (let i = 0; i < edgeLenCount; i++) {
    const p = dense[i];
    const q = dense[(i + 1) % dense.length];
    total += Math.hypot(q.x - p.x, q.y - p.y);
    cum.push(total);
  }
  if (total < 1e-6) return Array.from({ length: numPts }, () => ({ x: dense[0].x, y: dense[0].y }));

  const out = [];
  for (let i = 0; i < numPts; i++) {
    const target = contour.closed ? (i / numPts) * total : (i / (numPts - 1)) * total;
    let idx = 0;
    while (idx < cum.length - 2 && cum[idx + 1] < target) idx++;
    const segL = cum[idx + 1] - cum[idx];
    const f = segL > 1e-8 ? (target - cum[idx]) / segL : 0;
    const p = dense[idx];
    const q = dense[(idx + 1) % dense.length];
    out.push({ x: lerp(p.x, q.x, f), y: lerp(p.y, q.y, f) });
  }
  return out;
}

function alignClosedPhase(ptsA, ptsB) {
  const n = ptsA.length;
  let bestShift = 0;
  let bestDist = Infinity;
  for (let shift = 0; shift < n; shift++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const a = ptsA[i];
      const b = ptsB[(i + shift) % n];
      const dx = a.x - b.x, dy = a.y - b.y;
      sum += dx * dx + dy * dy;
    }
    if (sum < bestDist) {
      bestDist = sum;
      bestShift = shift;
    }
  }
  if (bestShift === 0) return ptsB;
  const rotated = new Array(n);
  for (let i = 0; i < n; i++) rotated[i] = ptsB[(i + bestShift) % n];
  return rotated;
}

function contourCentroid(pts) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  return pts.length ? { x: cx / pts.length, y: cy / pts.length } : { x: 0, y: 0 };
}

function matchAndMorphContourGroup(listA, listB, t, sampleCount, closed) {
  const n = Math.max(listA.length, listB.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const cA = listA[i];
    const cB = listB[i];
    let sampA, sampB;
    if (cA && cB) {
      sampA = sampleContourUniform(cA, sampleCount);
      sampB = sampleContourUniform(cB, sampleCount);
      if (closed) sampB = alignClosedPhase(sampA, sampB);
    } else if (cA) {
      sampA = sampleContourUniform(cA, sampleCount);
      const cen = contourCentroid(sampA);
      sampB = sampA.map(() => ({ x: cen.x, y: cen.y }));
    } else {
      sampB = sampleContourUniform(cB, sampleCount);
      const cen = contourCentroid(sampB);
      sampA = sampB.map(() => ({ x: cen.x, y: cen.y }));
    }
    const pts = [];
    for (let k = 0; k < sampleCount; k++) {
      const x = lerp(sampA[k].x, sampB[k].x, t);
      const y = lerp(sampA[k].y, sampB[k].y, t);
      pts.push({ x, y, inX: 0, inY: 0, outX: 0, outY: 0 });
    }
    out.push({ closed, points: pts, isHole: listA[i]?.isHole || listB[i]?.isHole || false });
  }
  return out;
}

// 在两个含多轮廓与孔洞的 PathShape 之间平滑形变
export function morphPathShapes(pathA, pathB, t) {
  if (!pathA || !pathA.contours) return cloneVal(pathB);
  if (!pathB || !pathB.contours) return cloneVal(pathA);
  if (t <= 0) return cloneVal(pathA);
  if (t >= 1) return cloneVal(pathB);

  const classify = (p) => {
    const outers = [];
    const holes = [];
    const open = [];
    for (const c of p.contours) {
      if (!c.closed) {
        open.push(c);
      } else {
        const area = contourSignedArea(c.points);
        if (c.isHole || area < 0) holes.push({ ...c, isHole: true });
        else outers.push({ ...c, isHole: false });
      }
    }
    return { outers, holes, open };
  };

  const gA = classify(pathA);
  const gB = classify(pathB);
  const N = 48;
  const contours = [
    ...matchAndMorphContourGroup(gA.outers, gB.outers, t, N, true),
    ...matchAndMorphContourGroup(gA.holes, gB.holes, t, N, true),
    ...matchAndMorphContourGroup(gA.open, gB.open, t, N, false),
  ];
  return { fillRule: pathA.fillRule || 'nonzero', contours };
}
