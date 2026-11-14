/**
 * Forge Studio — Keyframe Animation, Spatial Arc-Length Motion Paths, Speed/Value Curves,
 * Expression Engine (2.4), Parenting & Anchor Invariants (2.2), and Undo/Redo History (2.14)
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const {
    EPS, DEG2RAD, clamp, lerp, smoothstep,
    hashString, hashCombine, fbm1D, Vec2, Vec3, Mat4, uid
  } = Forge.Math;
  const Geo2D = Forge.Geo2D;

  // =========================================================================
  // ANIMATABLE PROPERTY CONSTRUCTORS & CLONING
  // =========================================================================
  function createProp(defaultValue, type = 'scalar', meta = {}) {
    return {
      type, // 'scalar' | 'vec2' | 'vec3' | 'color' | 'path'
      value: cloneValue(defaultValue, type),
      animated: false,
      keyframes: [],
      expressionEnabled: false,
      expression: '',
      lastError: '',
      min: meta.min,
      max: meta.max,
      step: meta.step,
      label: meta.label || ''
    };
  }

  function cloneValue(val, type) {
    if (val === null || val === undefined) return val;
    if (type === 'path' || (Array.isArray(val) && val[0] && val[0].vertices)) {
      return Geo2D.cloneContours(val);
    }
    if (Array.isArray(val)) return val.slice();
    if (val instanceof Number) return val.valueOf();
    return val;
  }

  function unwrapExprValue(v, fallbackType) {
    if (v instanceof Number) return v.valueOf();
    if (Array.isArray(v)) {
      return v.map((x) => (x instanceof Number ? x.valueOf() : Number(x) || 0));
    }
    if (v && typeof v === 'object' && 'value' in v) {
      return unwrapExprValue(v.value, fallbackType);
    }
    return v;
  }

  // =========================================================================
  // TEMPORAL CUBIC BEZIER SOLVER & 3D SPATIAL ARC-LENGTH LUT
  // =========================================================================
  function solveCubicBezierX(x1, x2, targetX) {
    if (targetX <= 0) return 0;
    if (targetX >= 1) return 1;
    const cx1 = clamp(x1, 0.001, 0.999);
    const cx2 = clamp(x2, 0.001, 0.999);
    if (Math.abs(cx1 - 1 / 3) < 1e-4 && Math.abs(cx2 - 2 / 3) < 1e-4) return targetX;

    let lo = 0, hi = 1, t = targetX;
    for (let i = 0; i < 10; i++) {
      const mt = 1 - t;
      const x = 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t;
      const err = x - targetX;
      if (Math.abs(err) < 1e-7) return t;
      if (err < 0) lo = t;
      else hi = t;
      const dx = 3 * mt * mt * cx1 + 6 * mt * t * (cx2 - cx1) + 3 * t * t * (1 - cx2);
      if (dx > 1e-6) {
        const next = t - err / dx;
        t = next > lo && next < hi ? next : 0.5 * (lo + hi);
      } else {
        t = 0.5 * (lo + hi);
      }
    }
    return t;
  }

  function evalCubic1D(v0, c1, c2, v1, s) {
    const ms = 1 - s;
    return ms * ms * ms * v0 + 3 * ms * ms * s * c1 + 3 * ms * s * s * c2 + s * s * s * v1;
  }

  function evalCubic3D(p0, c1, c2, p1, s) {
    const ms = 1 - s;
    const w0 = ms * ms * ms;
    const w1 = 3 * ms * ms * s;
    const w2 = 3 * ms * s * s;
    const w3 = s * s * s;
    const dim = p0.length;
    const out = new Array(dim);
    for (let k = 0; k < dim; k++) {
      out[k] = w0 * p0[k] + w1 * c1[k] + w2 * c2[k] + w3 * p1[k];
    }
    return out;
  }

  // Build spatial segment arc-length LUT so Linear temporal interpolation moves at STRICT constant speed!
  function getSpatialSegmentLUT(kf0, kf1) {
    const p0 = kf0.value;
    const p1 = kf1.value;
    const dim = p0.length;
    const outTan = kf0.spatialOut || new Array(dim).fill(0);
    const inTan = kf1.spatialIn || new Array(dim).fill(0);

    let curved = false;
    for (let k = 0; k < dim; k++) {
      if (Math.abs(outTan[k] || 0) > 1e-4 || Math.abs(inTan[k] || 0) > 1e-4) {
        curved = true;
        break;
      }
    }

    const c1 = new Array(dim);
    const c2 = new Array(dim);
    let chordSq = 0;
    for (let k = 0; k < dim; k++) {
      c1[k] = p0[k] + (outTan[k] || 0);
      c2[k] = p1[k] + (inTan[k] || 0);
      chordSq += (p1[k] - p0[k]) ** 2;
    }

    if (!curved) {
      return { curved: false, p0, c1, c2, p1, totalLength: Math.sqrt(chordSq), cumLen: null, steps: 1 };
    }

    const steps = 96;
    const cumLen = new Float64Array(steps + 1);
    let prev = p0;
    let total = 0;
    cumLen[0] = 0;
    for (let i = 1; i <= steps; i++) {
      const pt = evalCubic3D(p0, c1, c2, p1, i / steps);
      let dSq = 0;
      for (let k = 0; k < dim; k++) dSq += (pt[k] - prev[k]) ** 2;
      total += Math.sqrt(dSq);
      cumLen[i] = total;
      prev = pt;
    }
    return { curved: true, p0, c1, c2, p1, totalLength: total, cumLen, steps };
  }

  function sampleSpatialLUTAtFraction(lut, frac) {
    const f = clamp(frac, 0, 1);
    if (!lut.curved || lut.totalLength <= 1e-6) {
      return lut.p0.map((v, k) => lerp(v, lut.p1[k], f));
    }
    const targetDist = f * lut.totalLength;
    const arr = lut.cumLen;
    let lo = 0, hi = lut.steps;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= targetDist) lo = mid;
      else hi = mid;
    }
    const span = arr[hi] - arr[lo];
    const sub = span > 1e-9 ? (targetDist - arr[lo]) / span : 0;
    const u = (lo + sub) / lut.steps;
    return evalCubic3D(lut.p0, lut.c1, lut.c2, lut.p1, u);
  }

  // Evaluate temporal progress p in [0, 1] (or overshooting) for normalized time u in [0, 1]
  function evalTemporalFraction(kf0, kf1, u, arcLengthOrSpan = 1) {
    const outMode = kf0.outInterp || 'linear';
    const inMode = kf1.inInterp || 'linear';
    if (outMode === 'hold') return 0;
    if (outMode === 'linear' && inMode === 'linear') return u;

    const dt = Math.max(1e-5, kf1.time - kf0.time);
    const outInf = outMode === 'bezier' ? clamp((kf0.outEase?.influence ?? 33.333) / 100, 0.01, 0.99) : 1 / 3;
    const inInf = inMode === 'bezier' ? clamp((kf1.inEase?.influence ?? 33.333) / 100, 0.01, 0.99) : 1 / 3;

    const x1 = outInf;
    const x2 = 1 - inInf;

    let y1, y2;
    if (outMode === 'linear') {
      y1 = x1;
    } else {
      const spdOut = kf0.outEase?.speed ?? 0;
      y1 = Math.abs(arcLengthOrSpan) > 1e-5 ? (spdOut * dt * x1) / arcLengthOrSpan : 0;
    }

    if (inMode === 'linear') {
      y2 = x2;
    } else {
      const spdIn = kf1.inEase?.speed ?? 0;
      y2 = 1 - (Math.abs(arcLengthOrSpan) > 1e-5 ? (spdIn * dt * inInf) / arcLengthOrSpan : 0);
    }

    const s = solveCubicBezierX(x1, x2, u);
    return evalCubic1D(0, y1, y2, 1, s);
  }

  // Evaluate ONLY keyframes (ignoring expressions) at time t
  function evalKeyframesAtTime(prop, t) {
    if (!prop) return 0;
    if (!prop.animated || !prop.keyframes || prop.keyframes.length === 0) {
      return cloneValue(prop.value, prop.type);
    }

    const kfs = prop.keyframes;
    if (kfs.length === 1 || t <= kfs[0].time) {
      return cloneValue(kfs[0].value, prop.type);
    }
    if (t >= kfs[kfs.length - 1].time) {
      return cloneValue(kfs[kfs.length - 1].value, prop.type);
    }

    // Binary search segment [kf0, kf1]
    let lo = 0, hi = kfs.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (kfs[mid].time <= t) lo = mid;
      else hi = mid;
    }
    const kf0 = kfs[lo];
    const kf1 = kfs[hi];
    const dt = kf1.time - kf0.time;
    if (dt <= 1e-7 || kf0.outInterp === 'hold') {
      return cloneValue(kf0.value, prop.type);
    }

    const u = clamp((t - kf0.time) / dt, 0, 1);

    // 1. Path Morphing (Section 2.5)
    if (prop.type === 'path') {
      const p = evalTemporalFraction(kf0, kf1, u, 1);
      return Geo2D.morphContours(kf0.value, kf1.value, clamp(p, 0, 1));
    }

    // 2. Spatial Motion Path (Position properties have kf.spatialOut or prop.isSpatial)
    if (prop.isSpatial && Array.isArray(kf0.value)) {
      const lut = getSpatialSegmentLUT(kf0, kf1);
      const p = evalTemporalFraction(kf0, kf1, u, Math.max(1e-4, lut.totalLength));
      return sampleSpatialLUTAtFraction(lut, p);
    }

    // 3. Scalar Value Interpolation (supporting direct Value Graph Bezier offsets AND speed!)
    if (prop.type === 'scalar' || typeof kf0.value === 'number') {
      const v0 = Number(kf0.value) || 0;
      const v1 = Number(kf1.value) || 0;
      const outMode = kf0.outInterp || 'linear';
      const inMode = kf1.inInterp || 'linear';
      if (outMode === 'linear' && inMode === 'linear') return lerp(v0, v1, u);

      const x1 = outMode === 'bezier' ? clamp((kf0.outEase?.influence ?? 33.333) / 100, 0.01, 0.99) : 1 / 3;
      const x2 = 1 - (inMode === 'bezier' ? clamp((kf1.inEase?.influence ?? 33.333) / 100, 0.01, 0.99) : 1 / 3);
      const s = solveCubicBezierX(x1, x2, u);

      const c1 = outMode === 'linear'
        ? lerp(v0, v1, x1)
        : (kf0.outEase?.offset !== undefined ? v0 + kf0.outEase.offset : v0 + (kf0.outEase?.speed ?? 0) * dt * x1);
      const c2 = inMode === 'linear'
        ? lerp(v0, v1, x2)
        : (kf1.inEase?.offset !== undefined ? v1 + kf1.inEase.offset : v1 - (kf1.inEase?.speed ?? 0) * dt * (1 - x2));
      return evalCubic1D(v0, c1, c2, v1, s);
    }

    // 4. Multi-channel Vector / Color Interpolation
    if (Array.isArray(kf0.value)) {
      const a = kf0.value, b = kf1.value;
      const dist = Math.hypot(...a.map((v, k) => (b[k] ?? v) - v));
      const p = evalTemporalFraction(kf0, kf1, u, Math.max(1, dist));
      return a.map((v, k) => lerp(v, b[k] ?? v, p));
    }

    return cloneValue(kf0.value, prop.type);
  }

  // Compute exact speed (for Position: actual arc-length speed ds/dt along motion path!)
  function getPropSpeedAtTime(prop, t, context = null) {
    if (!prop || prop.type === 'path') return 0;
    const h = 1 / 480;
    const t0 = Math.max(0, t - h);
    const t1 = t + h;
    const span = t1 - t0;
    if (span <= 1e-7) return 0;
    const v0 = context ? evalProp(prop, t0, context) : evalKeyframesAtTime(prop, t0);
    const v1 = context ? evalProp(prop, t1, context) : evalKeyframesAtTime(prop, t1);
    if (Array.isArray(v0) && Array.isArray(v1)) {
      let sq = 0;
      for (let k = 0; k < v0.length; k++) sq += ((v1[k] || 0) - (v0[k] || 0)) ** 2;
      return Math.sqrt(sq) / span;
    }
    return Math.abs((Number(v1) || 0) - (Number(v0) || 0)) / span;
  }

  // =========================================================================
  // KEYFRAME EDITING HELPERS (Auto-key, F9 Easy Ease, Spatial Tangents, Stretch)
  // =========================================================================
  function sortKeyframes(prop) {
    if (prop && prop.keyframes) {
      prop.keyframes.sort((a, b) => a.time - b.time);
    }
  }

  function recomputeSmoothSpatialTangents(prop, index = -1) {
    if (!prop || !prop.isSpatial || !prop.keyframes || prop.keyframes.length < 2) return;
    const kfs = prop.keyframes;
    const start = index >= 0 ? Math.max(0, index - 1) : 0;
    const end = index >= 0 ? Math.min(kfs.length - 1, index + 1) : kfs.length - 1;

    for (let i = start; i <= end; i++) {
      const kf = kfs[i];
      const mode = kf.spatialMode || 'smooth';
      const dim = kf.value.length;
      if (mode === 'linear') {
        kf.spatialIn = new Array(dim).fill(0);
        kf.spatialOut = new Array(dim).fill(0);
        continue;
      }
      if (mode === 'corner') {
        if (!kf.spatialIn) kf.spatialIn = new Array(dim).fill(0);
        if (!kf.spatialOut) kf.spatialOut = new Array(dim).fill(0);
        continue;
      }
      // Only auto-compute if spatialHandles weren't manually customized
      if (kf.spatialCustom) continue;

      if (i === 0) {
        const next = kfs[1].value;
        kf.spatialIn = new Array(dim).fill(0);
        kf.spatialOut = kf.value.map((v, k) => (next[k] - v) * 0.25);
      } else if (i === kfs.length - 1) {
        const prev = kfs[i - 1].value;
        kf.spatialIn = kf.value.map((v, k) => (prev[k] - v) * 0.25);
        kf.spatialOut = new Array(dim).fill(0);
      } else {
        const prev = kfs[i - 1].value;
        const next = kfs[i + 1].value;
        const chord = next.map((v, k) => v - prev[k]);
        const dIn = Math.hypot(...kf.value.map((v, k) => v - prev[k]));
        const dOut = Math.hypot(...next.map((v, k) => v - kf.value[k]));
        const dTot = Math.max(1e-4, dIn + dOut);
        kf.spatialIn = chord.map((c) => (-c * (dIn / dTot)) * 0.3);
        kf.spatialOut = chord.map((c) => (c * (dOut / dTot)) * 0.3);
      }
    }
  }

  function setPropValueAtTime(prop, newValue, t) {
    if (!prop) return null;
    const clean = cloneValue(newValue, prop.type);
    prop.value = cloneValue(clean, prop.type);

    if (!prop.animated) return null;

    let existingIdx = -1;
    for (let i = 0; i < prop.keyframes.length; i++) {
      if (Math.abs(prop.keyframes[i].time - t) < 0.0005) {
        existingIdx = i;
        break;
      }
    }

    if (existingIdx >= 0) {
      prop.keyframes[existingIdx].value = clean;
      if (prop.isSpatial) recomputeSmoothSpatialTangents(prop, existingIdx);
      return prop.keyframes[existingIdx];
    }

    const kf = {
      id: uid('kf'),
      time: Math.max(0, t),
      value: clean,
      inInterp: 'linear',
      outInterp: 'linear',
      inEase: { influence: 33.33, speed: 0 },
      outEase: { influence: 33.33, speed: 0 }
    };
    if (prop.isSpatial && Array.isArray(clean)) {
      kf.spatialMode = 'smooth';
      kf.spatialIn = new Array(clean.length).fill(0);
      kf.spatialOut = new Array(clean.length).fill(0);
    }
    prop.keyframes.push(kf);
    sortKeyframes(prop);
    if (prop.isSpatial) {
      const idx = prop.keyframes.indexOf(kf);
      recomputeSmoothSpatialTangents(prop, idx);
    }
    return kf;
  }

  function togglePropStopwatch(prop, currentTime) {
    if (!prop) return;
    if (!prop.animated) {
      const curVal = evalKeyframesAtTime(prop, currentTime);
      prop.animated = true;
      prop.keyframes = [];
      setPropValueAtTime(prop, curVal, currentTime);
    } else {
      const curVal = evalKeyframesAtTime(prop, currentTime);
      prop.animated = false;
      prop.keyframes = [];
      prop.value = curVal;
    }
  }

  function applyEasyEase(kf, mode = 'both') {
    if (!kf) return;
    if (mode === 'both' || mode === 'in') {
      kf.inInterp = 'bezier';
      kf.inEase = { influence: 33.33, speed: 0, offset: 0 };
    }
    if (mode === 'both' || mode === 'out') {
      kf.outInterp = 'bezier';
      kf.outEase = { influence: 33.33, speed: 0, offset: 0 };
    }
  }

  // Proportional Time-Stretch of selected keyframes (Section 2.3: "按比例拉伸时间")
  function stretchKeyframesTime(keyframes, anchorTime, scaleFactor) {
    if (!keyframes || keyframes.length < 2) return;
    for (const kf of keyframes) {
      kf.time = Math.max(0, anchorTime + (kf.time - anchorTime) * scaleFactor);
    }
  }

  // =========================================================================
  // EXPRESSION ENGINE (Section 2.4)
  // Supports: time, value, deterministic wiggle(freq, amp), loopOut("cycle"|"pingpong"),
  // linear(t,a,b,c,d), ease(t,a,b,c,d), cross-layer/vector refs, valueAtTime(t),
  // dependency evaluation, cycle detection & clear error fallback!
  // =========================================================================
  const _compiledExprCache = new Map();
  let _evalCallStack = [];

  function wrapRefValue(val, evalAtTimeFn) {
    if (Array.isArray(val)) {
      const arr = val.slice();
      Object.defineProperty(arr, 'value', { value: arr.slice(), enumerable: false });
      Object.defineProperty(arr, 'x', { get: () => arr[0], enumerable: false });
      Object.defineProperty(arr, 'y', { get: () => arr[1], enumerable: false });
      Object.defineProperty(arr, 'z', { get: () => arr[2] ?? 0, enumerable: false });
      Object.defineProperty(arr, 'r', { get: () => arr[0], enumerable: false });
      Object.defineProperty(arr, 'g', { get: () => arr[1], enumerable: false });
      Object.defineProperty(arr, 'b', { get: () => arr[2] ?? 0, enumerable: false });
      Object.defineProperty(arr, 'valueAtTime', {
        value: (t) => wrapRefValue(evalAtTimeFn(Number(t) || 0), evalAtTimeFn),
        enumerable: false
      });
      return arr;
    }
    if (typeof val === 'number') {
      // Boxed Number behaves as number in +, -, *, /, Math.* AND carries .value & .valueAtTime(t)!
      // eslint-disable-next-line no-new-wrappers
      const boxed = new Number(val);
      boxed.value = val;
      boxed.valueAtTime = (t) => wrapRefValue(evalAtTimeFn(Number(t) || 0), evalAtTimeFn);
      return boxed;
    }
    return val;
  }

  function exprVecMix(a, b, f) {
    const ua = unwrapExprValue(a);
    const ub = unwrapExprValue(b);
    if (Array.isArray(ua) && Array.isArray(ub)) {
      return ua.map((v, i) => lerp(v, ub[i] ?? v, f));
    }
    return lerp(Number(ua) || 0, Number(ub) || 0, f);
  }

  function exprLinear(t, a, b, c, d) {
    const tv = Number(unwrapExprValue(t)) || 0;
    if (c === undefined && d === undefined) {
      // 3-arg form: linear(t, val1, val2) for t in [0, 1]
      return exprVecMix(a, b, clamp(tv, 0, 1));
    }
    const tMin = Number(unwrapExprValue(a)) || 0;
    const tMax = Number(unwrapExprValue(b)) || 1;
    const span = tMax - tMin;
    const f = Math.abs(span) > 1e-9 ? clamp((tv - tMin) / span, 0, 1) : (tv >= tMax ? 1 : 0);
    return exprVecMix(c, d, f);
  }

  function exprEase(t, a, b, c, d) {
    const tv = Number(unwrapExprValue(t)) || 0;
    if (c === undefined && d === undefined) {
      const f = clamp(tv, 0, 1);
      return exprVecMix(a, b, f * f * (3 - 2 * f));
    }
    const tMin = Number(unwrapExprValue(a)) || 0;
    const tMax = Number(unwrapExprValue(b)) || 1;
    const span = tMax - tMin;
    const u = Math.abs(span) > 1e-9 ? clamp((tv - tMin) / span, 0, 1) : (tv >= tMax ? 1 : 0);
    return exprVecMix(c, d, u * u * (3 - 2 * u));
  }

  function exprEaseIn(t, tMin, tMax, val1, val2) {
    const tv = Number(unwrapExprValue(t)) || 0;
    const a = Number(unwrapExprValue(tMin)) || 0;
    const b = Number(unwrapExprValue(tMax)) || 1;
    const u = Math.abs(b - a) > 1e-9 ? clamp((tv - a) / (b - a), 0, 1) : 0;
    return exprVecMix(val1, val2, u * u);
  }

  function exprEaseOut(t, tMin, tMax, val1, val2) {
    const tv = Number(unwrapExprValue(t)) || 0;
    const a = Number(unwrapExprValue(tMin)) || 0;
    const b = Number(unwrapExprValue(tMax)) || 1;
    const u = Math.abs(b - a) > 1e-9 ? clamp((tv - a) / (b - a), 0, 1) : 0;
    return exprVecMix(val1, val2, 1 - (1 - u) * (1 - u));
  }

  function exprLoopOut(prop, currentTime, type = 'cycle', numKeyframes = 0) {
    if (!prop.animated || !prop.keyframes || prop.keyframes.length < 2) {
      return evalKeyframesAtTime(prop, currentTime);
    }
    const kfs = prop.keyframes;
    const lastIdx = kfs.length - 1;
    const firstIdx = numKeyframes > 0 ? Math.max(0, lastIdx - Math.round(numKeyframes)) : 0;
    const tStart = kfs[firstIdx].time;
    const tEnd = kfs[lastIdx].time;
    const span = tEnd - tStart;
    if (currentTime <= tEnd || span <= 1e-6) {
      return evalKeyframesAtTime(prop, currentTime);
    }

    const elapsed = currentTime - tEnd;
    const segIdx = Math.floor(elapsed / span);
    const rem = elapsed - segIdx * span;

    const mode = String(type || 'cycle').toLowerCase();
    if (mode === 'pingpong') {
      // After tEnd, first pass goes backward from tEnd to tStart!
      const mappedT = segIdx % 2 === 0 ? tEnd - rem : tStart + rem;
      return evalKeyframesAtTime(prop, mappedT);
    }
    if (mode === 'offset') {
      const base = evalKeyframesAtTime(prop, tStart + rem);
      const vStart = kfs[firstIdx].value;
      const vEnd = kfs[lastIdx].value;
      const mult = segIdx + 1;
      if (Array.isArray(base)) {
        return base.map((v, k) => v + (vEnd[k] - vStart[k]) * mult);
      }
      return base + (vEnd - vStart) * mult;
    }
    // Default "cycle"
    return evalKeyframesAtTime(prop, tStart + rem);
  }

  function exprLoopIn(prop, currentTime, type = 'cycle', numKeyframes = 0) {
    if (!prop.animated || !prop.keyframes || prop.keyframes.length < 2) {
      return evalKeyframesAtTime(prop, currentTime);
    }
    const kfs = prop.keyframes;
    const lastIdx = numKeyframes > 0 ? Math.min(kfs.length - 1, Math.round(numKeyframes)) : kfs.length - 1;
    const tStart = kfs[0].time;
    const tEnd = kfs[lastIdx].time;
    const span = tEnd - tStart;
    if (currentTime >= tStart || span <= 1e-6) {
      return evalKeyframesAtTime(prop, currentTime);
    }
    const before = tStart - currentTime;
    const segIdx = Math.floor(before / span);
    const rem = before - segIdx * span;
    const mode = String(type || 'cycle').toLowerCase();
    if (mode === 'pingpong') {
      const mappedT = segIdx % 2 === 0 ? tStart + rem : tEnd - rem;
      return evalKeyframesAtTime(prop, mappedT);
    }
    return evalKeyframesAtTime(prop, tEnd - rem);
  }

  function buildLayerExpressionProxy(layer, comp, project, currentTime) {
    const evalChildProp = (prop, propName) => {
      if (!prop) throw new Error(`属性 "${propName}" 不存在`);
      return wrapRefValue(
        evalProp(prop, currentTime, { project, comp, layer, propKey: propName }),
        (atT) => evalProp(prop, atT, { project, comp, layer, propKey: propName })
      );
    };

    const tr = layer.transform || {};
    const transformProxy = {
      get anchorPoint() { return evalChildProp(tr.anchorPoint, 'transform.anchorPoint'); },
      get position() { return evalChildProp(tr.position, 'transform.position'); },
      get scale() { return evalChildProp(tr.scale, 'transform.scale'); },
      get opacity() { return evalChildProp(tr.opacity, 'transform.opacity'); },
      get rotation() { return evalChildProp(tr.rotationZ || tr.rotation, 'transform.rotation'); },
      get rotationX() { return evalChildProp(tr.rotationX, 'transform.rotationX'); },
      get rotationY() { return evalChildProp(tr.rotationY, 'transform.rotationY'); },
      get rotationZ() { return evalChildProp(tr.rotationZ || tr.rotation, 'transform.rotationZ'); }
    };

    return {
      name: layer.name,
      index: (comp.layers ? comp.layers.indexOf(layer) : 0) + 1,
      inPoint: layer.inPoint ?? 0,
      outPoint: layer.outPoint ?? comp.duration,
      transform: transformProxy,
      effect(nameOrIdx) {
        const list = layer.effects || [];
        const eff = typeof nameOrIdx === 'number'
          ? list[nameOrIdx - 1]
          : list.find((e) => e.name === nameOrIdx || e.type === nameOrIdx);
        if (!eff) throw new Error(`找不到效果 "${nameOrIdx}"`);
        return function (paramName) {
          const p = eff.params ? eff.params[paramName] : null;
          if (!p) throw new Error(`效果 "${eff.name}" 中找不到参数 "${paramName}"`);
          return evalChildProp(p, `effect.${eff.name}.${paramName}`);
        };
      },
      material: layer.material ? new Proxy(layer.material, {
        get(target, key) {
          if (key in target && target[key]?.type) return evalChildProp(target[key], `material.${String(key)}`);
          return target[key];
        }
      }) : {},
      extrude: layer.extrude ? new Proxy(layer.extrude, {
        get(target, key) {
          if (key in target && target[key]?.type) return evalChildProp(target[key], `extrude.${String(key)}`);
          return target[key];
        }
      }) : {},
      deform: layer.deform ? new Proxy(layer.deform, {
        get(target, key) {
          if (key in target && target[key]?.type) return evalChildProp(target[key], `deform.${String(key)}`);
          return target[key];
        }
      }) : {},
      camera: layer.camera ? new Proxy(layer.camera, {
        get(target, key) {
          if (key in target && target[key]?.type) return evalChildProp(target[key], `camera.${String(key)}`);
          return target[key];
        }
      }) : {},
      light: layer.light ? new Proxy(layer.light, {
        get(target, key) {
          if (key in target && target[key]?.type) return evalChildProp(target[key], `light.${String(key)}`);
          return target[key];
        }
      }) : {},
      field: layer.field ? new Proxy(layer.field, {
        get(target, key) {
          if (key in target && target[key]?.type) return evalChildProp(target[key], `field.${String(key)}`);
          return target[key];
        }
      }) : {}
    };
  }

  function buildCompExpressionProxy(comp, project, currentTime) {
    return {
      name: comp.name,
      width: comp.width,
      height: comp.height,
      duration: comp.duration,
      frameDuration: 1 / (comp.fps || 30),
      fps: comp.fps || 30,
      numLayers: comp.layers ? comp.layers.length : 0,
      layer(nameOrIndex) {
        if (!comp.layers) throw new Error('当前合成没有图层');
        let target = null;
        if (typeof nameOrIndex === 'number') {
          target = comp.layers[Math.round(nameOrIndex) - 1];
        } else {
          target = comp.layers.find((l) => l.name === nameOrIndex || l.id === nameOrIndex);
        }
        if (!target) throw new Error(`找不到图层 "${nameOrIndex}"`);
        return buildLayerExpressionProxy(target, comp, project, currentTime);
      }
    };
  }

  function compileExpressionFn(code) {
    if (_compiledExprCache.has(code)) return _compiledExprCache.get(code);
    const trimmed = String(code || '').trim();
    // Support both single-line expressions `wiggle(3, 20)` and multi-statement blocks `const a = ...; a * 2`!
    let fn = null;
    const argNames = [
      'time', 'value', 'valueAtTime', 'wiggle', 'loopOut', 'loopIn',
      'linear', 'ease', 'easeIn', 'easeOut', 'clamp',
      'add', 'sub', 'mul', 'div', 'length', 'normalize',
      'thisComp', 'thisLayer', 'transform', 'comp',
      'index', 'fps', 'duration', 'Math', 'seedRandom'
    ];
    try {
      // Try wrapping as single return expression first if no semicolons/newlines/return
      // eslint-disable-next-line no-new-func
      fn = new Function(...argNames, `"use strict";\nreturn (\n${trimmed}\n);`);
    } catch (_singleErr) {
      // Multi-line statement block: automatically return last expression if no explicit `return`
      const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0 && !/\breturn\b/.test(trimmed)) {
        const last = lines[lines.length - 1].replace(/;+\s*$/, '');
        lines[lines.length - 1] = `return (${last});`;
      }
      // eslint-disable-next-line no-new-func
      fn = new Function(...argNames, `"use strict";\n${lines.join('\n')}`);
    }
    _compiledExprCache.set(code, fn);
    return fn;
  }

  function evalProp(prop, t, context = {}) {
    if (!prop) return 0;
    const kfVal = evalKeyframesAtTime(prop, t);
    if (!prop.expressionEnabled || !prop.expression || !prop.expression.trim()) {
      prop.lastError = '';
      return kfVal;
    }

    if (prop.type === 'path') {
      prop.lastError = '';
      return kfVal;
    }

    const comp = context.comp;
    const layer = context.layer;
    const project = context.project;
    const propKey = context.propKey || prop.label || 'prop';
    const stackId = `${comp ? comp.id : 'c'}:${layer ? layer.id : 'l'}:${propKey}`;
    const exactFrameKey = `${stackId}@${Math.round(t * 10000)}`;

    // Cycle detection (exact timestamp cycle OR deep indirect recursion > 16)
    const samePropCount = _evalCallStack.filter((s) => s.stackId === stackId).length;
    if (_evalCallStack.some((s) => s.exact === exactFrameKey) || samePropCount >= 8 || _evalCallStack.length >= 24) {
      const chain = _evalCallStack.map((s) => `${s.layerName}.${s.propKey}`).concat([`${layer ? layer.name : ''}.${propKey}`]).join(' -> ');
      prop.lastError = `循环引用错误: ${chain}`;
      return kfVal;
    }

    _evalCallStack.push({
      stackId,
      exact: exactFrameKey,
      layerName: layer ? layer.name : '图层',
      propKey
    });

    try {
      const fn = compileExpressionFn(prop.expression);
      let customSeed = hashCombine(
        hashString(layer ? layer.id : 'layer'),
        hashString(propKey)
      );

      const seedRandomFn = (s) => {
        customSeed = hashCombine(customSeed, Math.round(Number(s) * 1000) | 0);
      };

      const wiggleFn = (freq = 2, amp = 10, octaves = 2, ampMult = 0.5, sampleT = t) => {
        const f = Number(unwrapExprValue(freq)) || 0;
        const a = unwrapExprValue(amp);
        const tt = Number(unwrapExprValue(sampleT));
        const useT = Number.isFinite(tt) ? tt : t;
        const base = evalKeyframesAtTime(prop, useT);

        if (Array.isArray(base)) {
          return base.map((v, ch) => {
            const ampCh = Array.isArray(a) ? (a[ch] ?? a[0] ?? 0) : (Number(a) || 0);
            const n = fbm1D(useT * f + ch * 19.37, octaves, ampMult, customSeed + ch * 997);
            return v + n * ampCh;
          });
        }
        const n = fbm1D(useT * f, octaves, ampMult, customSeed);
        return (Number(base) || 0) + n * (Number(a) || 0);
      };

      const valueAtTimeFn = (queryT) => {
        const qt = Number(unwrapExprValue(queryT)) || 0;
        if (Math.abs(qt - t) < 1e-6) return wrapRefValue(kfVal, (tt) => evalKeyframesAtTime(prop, tt));
        return evalProp(prop, qt, context);
      };

      const addFn = (a, b) => {
        const ua = unwrapExprValue(a), ub = unwrapExprValue(b);
        if (Array.isArray(ua) && Array.isArray(ub)) return ua.map((v, i) => v + (ub[i] ?? 0));
        if (Array.isArray(ua)) return ua.map((v) => v + (Number(ub) || 0));
        return (Number(ua) || 0) + (Number(ub) || 0);
      };
      const subFn = (a, b) => {
        const ua = unwrapExprValue(a), ub = unwrapExprValue(b);
        if (Array.isArray(ua) && Array.isArray(ub)) return ua.map((v, i) => v - (ub[i] ?? 0));
        if (Array.isArray(ua)) return ua.map((v) => v - (Number(ub) || 0));
        return (Number(ua) || 0) - (Number(ub) || 0);
      };
      const mulFn = (a, s) => {
        const ua = unwrapExprValue(a), us = Number(unwrapExprValue(s)) || 0;
        return Array.isArray(ua) ? ua.map((v) => v * us) : (Number(ua) || 0) * us;
      };
      const divFn = (a, s) => {
        const ua = unwrapExprValue(a), us = Number(unwrapExprValue(s)) || 1;
        const inv = Math.abs(us) > 1e-9 ? 1 / us : 0;
        return Array.isArray(ua) ? ua.map((v) => v * inv) : (Number(ua) || 0) * inv;
      };
      const lenFn = (a, b) => {
        const ua = unwrapExprValue(a);
        if (b !== undefined) {
          const ub = unwrapExprValue(b);
          if (Array.isArray(ua) && Array.isArray(ub)) {
            return Math.hypot(...ua.map((v, i) => v - (ub[i] ?? 0)));
          }
          return Math.abs((Number(ua) || 0) - (Number(ub) || 0));
        }
        return Array.isArray(ua) ? Math.hypot(...ua) : Math.abs(Number(ua) || 0);
      };
      const normFn = (a) => {
        const ua = unwrapExprValue(a);
        if (!Array.isArray(ua)) return 1;
        const l = Math.hypot(...ua);
        return l > 1e-8 ? ua.map((v) => v / l) : ua.map(() => 0);
      };
      const clampFn = (v, lo, hi) => {
        const uv = unwrapExprValue(v);
        const ulo = unwrapExprValue(lo), uhi = unwrapExprValue(hi);
        if (Array.isArray(uv)) {
          return uv.map((x, i) => clamp(x, Array.isArray(ulo) ? ulo[i] : ulo, Array.isArray(uhi) ? uhi[i] : uhi));
        }
        return clamp(Number(uv) || 0, Number(ulo) || 0, Number(uhi) || 0);
      };

      const thisCompProxy = comp ? buildCompExpressionProxy(comp, project, t) : null;
      const thisLayerProxy = comp && layer ? buildLayerExpressionProxy(layer, comp, project, t) : null;
      const compLookupFn = (compName) => {
        if (!project || !project.compositions) throw new Error('无工程上下文');
        const c = project.compositions.find((it) => it.name === compName || it.id === compName);
        if (!c) throw new Error(`找不到合成 "${compName}"`);
        return buildCompExpressionProxy(c, project, t);
      };

      const rawRes = fn(
        t,
        wrapRefValue(kfVal, (tt) => evalKeyframesAtTime(prop, tt)),
        valueAtTimeFn,
        wiggleFn,
        (tp, nk) => exprLoopOut(prop, t, tp, nk),
        (tp, nk) => exprLoopIn(prop, t, tp, nk),
        exprLinear,
        exprEase,
        exprEaseIn,
        exprEaseOut,
        clampFn,
        addFn,
        subFn,
        mulFn,
        divFn,
        lenFn,
        normFn,
        thisCompProxy,
        thisLayerProxy,
        thisLayerProxy ? thisLayerProxy.transform : {},
        compLookupFn,
        layer && comp && comp.layers ? comp.layers.indexOf(layer) + 1 : 1,
        comp ? comp.fps || 30 : 30,
        comp ? comp.duration || 15 : 15,
        Math,
        seedRandomFn
      );

      const unwrapped = unwrapExprValue(rawRes, prop.type);

      // Coerce result cleanly to match property dimensionality
      let finalVal;
      if (Array.isArray(kfVal)) {
        if (Array.isArray(unwrapped)) {
          finalVal = kfVal.map((defV, idx) => {
            const n = Number(unwrapped[idx]);
            return Number.isFinite(n) ? n : defV;
          });
        } else if (typeof unwrapped === 'number' && Number.isFinite(unwrapped)) {
          finalVal = kfVal.map(() => unwrapped);
        } else {
          throw new Error('表达式返回值类型与向量属性不匹配');
        }
      } else {
        const n = Array.isArray(unwrapped) ? Number(unwrapped[0]) : Number(unwrapped);
        if (!Number.isFinite(n)) throw new Error('表达式返回了非数值 (NaN/undefined)');
        finalVal = n;
      }

      prop.lastError = '';
      return finalVal;
    } catch (err) {
      prop.lastError = err && err.message ? err.message : String(err);
      return kfVal;
    } finally {
      _evalCallStack.pop();
    }
  }

  // =========================================================================
  // LAYER TRANSFORMS, PARENTING & PAN-BEHIND ANCHOR INVARIANTS (Section 2.2)
  // =========================================================================
  function evalLayerLocalTransformValues(layer, t, comp, project) {
    const tr = layer.transform;
    const ctx = { project, comp, layer };
    const anchor = evalProp(tr.anchorPoint, t, { ...ctx, propKey: 'anchorPoint' });
    const pos = evalProp(tr.position, t, { ...ctx, propKey: 'position' });
    const scale = evalProp(tr.scale, t, { ...ctx, propKey: 'scale' });
    const opacity = clamp(evalProp(tr.opacity, t, { ...ctx, propKey: 'opacity' }), 0, 100);

    const a3 = [anchor[0] || 0, anchor[1] || 0, layer.threeD ? (anchor[2] || 0) : 0];
    const p3 = [pos[0] || 0, pos[1] || 0, layer.threeD ? (pos[2] || 0) : 0];
    const s3 = [scale[0] ?? 100, scale[1] ?? 100, layer.threeD ? (scale[2] ?? 100) : 100];

    let r3;
    if (layer.threeD) {
      const rx = tr.rotationX ? evalProp(tr.rotationX, t, { ...ctx, propKey: 'rotationX' }) : 0;
      const ry = tr.rotationY ? evalProp(tr.rotationY, t, { ...ctx, propKey: 'rotationY' }) : 0;
      const rz = evalProp(tr.rotationZ || tr.rotation, t, { ...ctx, propKey: 'rotationZ' });
      r3 = [rx, ry, rz];
    } else {
      const rz = evalProp(tr.rotationZ || tr.rotation, t, { ...ctx, propKey: 'rotation' });
      r3 = [0, 0, rz];
    }

    return { anchor: a3, position: p3, scale: s3, rotation: r3, opacity };
  }

  function getLayerLocalMatrix(layer, t, comp, project) {
    const v = evalLayerLocalTransformValues(layer, t, comp, project);
    return Mat4.fromLayerTransform(v.position, v.rotation, v.scale, v.anchor);
  }

  // Multi-level parenting: inherits Position, Rotation & Scale, NEVER inherits Opacity!
  function getLayerWorldMatrix(layer, t, comp, project, visited = null) {
    if (!layer) return Mat4.identity();
    const localM = getLayerLocalMatrix(layer, t, comp, project);
    if (!layer.parentId || !comp || !comp.layers) return localM;

    const seen = visited || new Set();
    if (seen.has(layer.id)) return localM;
    seen.add(layer.id);

    const parent = comp.layers.find((l) => l.id === layer.parentId);
    if (!parent) return localM;
    const parentWorld = getLayerWorldMatrix(parent, t, comp, project, seen);
    return Mat4.multiply(parentWorld, localM);
  }

  function getParentWorldMatrix(layer, t, comp, project) {
    if (!layer || !layer.parentId || !comp || !comp.layers) return Mat4.identity();
    const parent = comp.layers.find((l) => l.id === layer.parentId);
    if (!parent) return Mat4.identity();
    return getLayerWorldMatrix(parent, t, comp, project);
  }

  function wouldCreateParentCycle(comp, childId, candidateParentId) {
    if (!candidateParentId) return false;
    if (childId === candidateParentId) return true;
    let curId = candidateParentId;
    const guard = new Set();
    while (curId) {
      if (curId === childId) return true;
      if (guard.has(curId)) return true;
      guard.add(curId);
      const l = comp.layers.find((x) => x.id === curId);
      curId = l ? l.parentId : null;
    }
    return false;
  }

  // Set, change, or clear parent while preserving EXACT visual appearance at time t! (Section 2.2)
  function setLayerParentPreservingWorld(comp, layer, newParentId, t, project) {
    const targetId = newParentId || null;
    if (layer.parentId === targetId) return true;
    if (targetId && wouldCreateParentCycle(comp, layer.id, targetId)) return false;

    const worldBefore = getLayerWorldMatrix(layer, t, comp, project);
    const curVals = evalLayerLocalTransformValues(layer, t, comp, project);

    layer.parentId = targetId;

    const newParentWorld = getParentWorldMatrix(layer, t, comp, project);
    const invParent = Mat4.invert(newParentWorld);
    const newLocal = Mat4.multiply(invParent, worldBefore);
    const decomposed = Mat4.decomposeLayerTransform(newLocal, curVals.anchor);

    const tr = layer.transform;
    if (layer.threeD) {
      setPropValueAtTime(tr.position, decomposed.position, t);
      setPropValueAtTime(tr.scale, decomposed.scale, t);
      if (tr.rotationX) setPropValueAtTime(tr.rotationX, decomposed.rotation[0], t);
      if (tr.rotationY) setPropValueAtTime(tr.rotationY, decomposed.rotation[1], t);
      setPropValueAtTime(tr.rotationZ || tr.rotation, decomposed.rotation[2], t);
    } else {
      setPropValueAtTime(tr.position, [decomposed.position[0], decomposed.position[1], 0], t);
      setPropValueAtTime(tr.scale, [decomposed.scale[0], decomposed.scale[1], 100], t);
      setPropValueAtTime(tr.rotationZ || tr.rotation, decomposed.rotation[2], t);
    }
    return true;
  }

  // Pan-Behind / Anchor Point edit: moving anchor alone keeps the layer visually stationary! (Section 2.2)
  function setAnchorPreservingVisual(comp, layer, newAnchor, t, project) {
    const curVals = evalLayerLocalTransformValues(layer, t, comp, project);
    const aNew3 = [
      newAnchor[0] ?? curVals.anchor[0],
      newAnchor[1] ?? curVals.anchor[1],
      layer.threeD ? (newAnchor[2] ?? curVals.anchor[2]) : 0
    ];
    const dA = Vec3.sub(aNew3, curVals.anchor);
    // Delta Position in local parent space = R * S * dA
    const rMat = Mat4.fromEulerDeg(curVals.rotation[0], curVals.rotation[1], curVals.rotation[2]);
    const sMat = Mat4.fromScale(curVals.scale[0] / 100, curVals.scale[1] / 100, curVals.scale[2] / 100);
    const rs = Mat4.multiply(rMat, sMat);
    const dPos = Mat4.transformPoint(rs, dA);
    const pNew = Vec3.add(curVals.position, dPos);

    setPropValueAtTime(layer.transform.anchorPoint, layer.threeD ? aNew3 : [aNew3[0], aNew3[1], 0], t);
    setPropValueAtTime(layer.transform.position, layer.threeD ? pNew : [pNew[0], pNew[1], 0], t);
  }

  // =========================================================================
  // TRANSACTIONAL UNDO / REDO & PROJECT SERIALIZATION (Section 2.14)
  // =========================================================================
  class HistoryManager {
    constructor(maxSteps = 80) {
      this.maxSteps = maxSteps;
      this.undoStack = [];
      this.redoStack = [];
      this.pendingBefore = null;
      this.pendingLabel = '';
      this.onChange = null;
    }

    serialize(project) {
      return JSON.stringify(project);
    }

    deserialize(jsonStr) {
      return JSON.parse(jsonStr);
    }

    clear() {
      this.undoStack = [];
      this.redoStack = [];
      this.pendingBefore = null;
      this.pendingLabel = '';
      if (this.onChange) this.onChange();
    }

    beginTransaction(project, label = '编辑') {
      if (this.pendingBefore === null) {
        this.pendingBefore = this.serialize(project);
        this.pendingLabel = label;
      }
    }

    commitTransaction(project) {
      if (this.pendingBefore === null) return false;
      const after = this.serialize(project);
      const changed = after !== this.pendingBefore;
      if (changed) {
        this.undoStack.push({ label: this.pendingLabel, snapshot: this.pendingBefore });
        if (this.undoStack.length > this.maxSteps) this.undoStack.shift();
        this.redoStack = [];
      }
      this.pendingBefore = null;
      this.pendingLabel = '';
      if (changed && this.onChange) this.onChange();
      return changed;
    }

    cancelTransaction() {
      this.pendingBefore = null;
      this.pendingLabel = '';
    }

    pushSnapshot(beforeSnapshot, afterProject, label = '编辑') {
      const after = this.serialize(afterProject);
      if (after === beforeSnapshot) return false;
      this.undoStack.push({ label, snapshot: beforeSnapshot });
      if (this.undoStack.length > this.maxSteps) this.undoStack.shift();
      this.redoStack = [];
      if (this.onChange) this.onChange();
      return true;
    }

    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }

    undo(currentProject) {
      if (!this.canUndo()) return null;
      this.pendingBefore = null;
      const currentSnap = this.serialize(currentProject);
      const entry = this.undoStack.pop();
      this.redoStack.push({ label: entry.label, snapshot: currentSnap });
      if (this.onChange) this.onChange();
      return this.deserialize(entry.snapshot);
    }

    redo(currentProject) {
      if (!this.canRedo()) return null;
      this.pendingBefore = null;
      const currentSnap = this.serialize(currentProject);
      const entry = this.redoStack.pop();
      this.undoStack.push({ label: entry.label, snapshot: currentSnap });
      if (this.onChange) this.onChange();
      return this.deserialize(entry.snapshot);
    }
  }

  Forge.Anim = {
    createProp,
    cloneValue,
    solveCubicBezierX,
    getSpatialSegmentLUT,
    sampleSpatialLUTAtFraction,
    evalTemporalFraction,
    evalKeyframesAtTime,
    evalProp,
    getPropSpeedAtTime,
    sortKeyframes,
    recomputeSmoothSpatialTangents,
    setPropValueAtTime,
    togglePropStopwatch,
    applyEasyEase,
    stretchKeyframesTime,
    evalLayerLocalTransformValues,
    getLayerLocalMatrix,
    getLayerWorldMatrix,
    getParentWorldMatrix,
    wouldCreateParentCycle,
    setLayerParentPreservingWorld,
    setAnchorPreservingVisual,
    HistoryManager
  };
})();
