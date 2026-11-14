// 表达式引擎：支持 time/value/wiggle/loopOut/linear/ease/跨图层引用/valueAtTime/循环依赖检测

import { clamp, lerp, fbm1D, hashString, mulberry32 } from './math.js';
import { evalPropertyKeyframeValue, cloneVal } from './property.js';

const _compiledCache = new Map();

function compileExpression(code) {
  let fn = _compiledCache.get(code);
  if (fn) return fn;
  const trimmed = code.trim();
  // 支持单行表达式自动 return，或多行显式 return
  let body;
  if (!trimmed.includes('\n') && !trimmed.includes('return ') && !trimmed.includes(';')) {
    body = `return (${trimmed});`;
  } else if (!/\breturn\b/.test(trimmed)) {
    const lines = trimmed.split('\n');
    const last = lines.pop().trim().replace(/;$/, '');
    body = `${lines.join('\n')}\nreturn (${last});`;
  } else {
    body = trimmed;
  }
  fn = new Function(
    'time',
    'value',
    'index',
    'width',
    'height',
    'fps',
    'duration',
    'inPoint',
    'outPoint',
    'thisComp',
    'thisLayer',
    'thisProperty',
    'wiggle',
    'loopOut',
    'loopIn',
    'linear',
    'ease',
    'easeIn',
    'easeOut',
    'clamp',
    'length',
    'normalize',
    'dot',
    'cross',
    'add',
    'sub',
    'mul',
    'div',
    'degreesToRadians',
    'radiansToDegrees',
    'random',
    'seedRandom',
    'noise',
    'valueAtTime',
    body
  );
  if (_compiledCache.size > 500) _compiledCache.clear();
  _compiledCache.set(code, fn);
  return fn;
}

// 按路径读取图层上的 Property 对象
export function resolvePropertyByPath(layer, propPath) {
  if (!layer || !propPath) return null;
  // 支持别名 transform.rotation -> 2D rotation 或 3D rotationZ
  const parts = propPath.split('.');
  let cur = layer;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (cur == null) return null;
    if (Array.isArray(cur)) {
      const idx = Number(key);
      cur = Number.isInteger(idx) ? cur[idx] : cur.find((item) => item && (item.name === key || item.id === key));
    } else {
      if (key === 'rotation' && cur === layer.transform && layer.is3D && cur.rotationZ) {
        cur = cur.rotationZ;
      } else {
        cur = cur[key];
      }
    }
  }
  if (cur && typeof cur === 'object' && 'type' in cur && 'value' in cur) {
    return cur;
  }
  return null;
}

// 创建带 .valueAtTime(t) 与数值/向量协同能力的值包装器
function wrapExprValue(rawVal, atTimeFn) {
  if (Array.isArray(rawVal)) {
    const arr = rawVal.map((v) => Number(v) || 0);
    return new Proxy(arr, {
      get(target, prop, receiver) {
        if (prop === 'valueAtTime') {
          return (t) => wrapExprValue(atTimeFn(Number(t) || 0), atTimeFn);
        }
        if (prop === '__raw') return target;
        if (prop === 'x') return wrapExprValue(target[0] ?? 0, (t) => atTimeFn(t)[0] ?? 0);
        if (prop === 'y') return wrapExprValue(target[1] ?? 0, (t) => atTimeFn(t)[1] ?? 0);
        if (prop === 'z') return wrapExprValue(target[2] ?? 0, (t) => atTimeFn(t)[2] ?? 0);
        if (prop === 'w') return wrapExprValue(target[3] ?? 0, (t) => atTimeFn(t)[3] ?? 0);
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          const idx = Number(prop);
          return wrapExprValue(target[idx] ?? 0, (t) => atTimeFn(t)[idx] ?? 0);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }
  if (typeof rawVal === 'number') {
    const box = {
      __raw: rawVal,
      valueOf() {
        return rawVal;
      },
      toString() {
        return String(rawVal);
      },
      [Symbol.toPrimitive](hint) {
        return hint === 'string' ? String(rawVal) : rawVal;
      },
      valueAtTime(t) {
        return wrapExprValue(atTimeFn(Number(t) || 0), atTimeFn);
      },
    };
    return box;
  }
  return rawVal;
}

function unwrapExprResult(val, fallback) {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (typeof val === 'object') {
    if ('__raw' in val) return cloneVal(val.__raw);
    if (Array.isArray(val)) {
      return val.map((item, i) => {
        const n = typeof item === 'object' && item && '__raw' in item ? item.__raw : Number(item);
        return Number.isFinite(n) ? n : (Array.isArray(fallback) ? (fallback[i] ?? 0) : 0);
      });
    }
  }
  return val;
}

function unwrapArg(v) {
  if (v && typeof v === 'object' && '__raw' in v) return v.__raw;
  if (Array.isArray(v)) return v.map(unwrapArg);
  return v;
}

function interpNumericOrVec(v1, v2, u) {
  const a = unwrapArg(v1);
  const b = unwrapArg(v2);
  if (Array.isArray(a) || Array.isArray(b)) {
    const arrA = Array.isArray(a) ? a : [a];
    const arrB = Array.isArray(b) ? b : [b];
    const len = Math.max(arrA.length, arrB.length);
    const out = new Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = lerp(Number(arrA[i] ?? 0), Number(arrB[i] ?? 0), u);
    }
    return out;
  }
  return lerp(Number(a) || 0, Number(b) || 0, u);
}

function createLayerProxy(project, comp, layer, time, evalStack, errors) {
  if (!layer) {
    throw new Error('找不到引用的图层');
  }

  const makeSectionProxy = (prefix) =>
    new Proxy(
      {},
      {
        get(_t, propKey) {
          if (typeof propKey !== 'string') return undefined;
          const fullPath = prefix ? `${prefix}.${propKey}` : propKey;
          const propObj = resolvePropertyByPath(layer, fullPath);
          if (propObj) {
            const val = evalProperty(project, comp, layer, fullPath, time, evalStack, errors);
            return wrapExprValue(val, (qt) =>
              evalProperty(project, comp, layer, fullPath, qt, evalStack, errors)
            );
          }
          // 继续向下访问子对象
          return makeSectionProxy(fullPath);
        },
      }
    );

  const layerIndex = comp.layers.indexOf(layer) + 1;

  return {
    name: layer.name,
    index: layerIndex,
    inPoint: layer.inPoint,
    outPoint: layer.outPoint,
    startTime: layer.startTime || 0,
    transform: makeSectionProxy('transform'),
    mesh3d: makeSectionProxy('mesh3d'),
    material: makeSectionProxy('mesh3d.material'),
    extrude: makeSectionProxy('mesh3d.extrude'),
    deform: makeSectionProxy('mesh3d.deform'),
    text: makeSectionProxy('text'),
    shape: makeSectionProxy('shape'),
    camera: makeSectionProxy('camera'),
    light: makeSectionProxy('light'),
    particle: makeSectionProxy('particle'),
    field: makeSectionProxy('spatialField'),
    spatialField: makeSectionProxy('spatialField'),
    audio: makeSectionProxy('audio'),
    timeRemap: layer.precomp?.timeRemap
      ? wrapExprValue(
          evalProperty(project, comp, layer, 'precomp.timeRemap', time, evalStack, errors),
          (qt) => evalProperty(project, comp, layer, 'precomp.timeRemap', qt, evalStack, errors)
        )
      : undefined,
    effect(nameOrIdx) {
      const idx =
        typeof nameOrIdx === 'number'
          ? nameOrIdx - 1
          : (layer.effects || []).findIndex((e) => e.name === nameOrIdx || e.type === nameOrIdx);
      if (idx < 0 || !layer.effects?.[idx]) {
        throw new Error(`图层 "${layer.name}" 中找不到效果 "${nameOrIdx}"`);
      }
      return makeSectionProxy(`effects.${idx}.params`);
    },
    content(nameOrIdx) {
      const ops = layer.shape?.operators || layer.operators || [];
      const prefix = layer.shape?.operators ? 'shape.operators' : 'operators';
      const idx =
        typeof nameOrIdx === 'number'
          ? nameOrIdx - 1
          : ops.findIndex((o) => o.name === nameOrIdx || o.type === nameOrIdx);
      if (idx < 0 || !ops[idx]) {
        throw new Error(`图层 "${layer.name}" 中找不到形状操作 "${nameOrIdx}"`);
      }
      return makeSectionProxy(`${prefix}.${idx}.params`);
    },
    toWorld(pt = [0, 0, 0]) {
      return pt;
    },
  };
}

function evalLoopOut(prop, time, type = 'cycle', numKeyframes = 0) {
  const kfs = prop.keyframes;
  if (!kfs || kfs.length < 2) return evalPropertyKeyframeValue(prop, time);
  const last = kfs[kfs.length - 1];
  if (time <= last.time) return evalPropertyKeyframeValue(prop, time);

  const count = numKeyframes > 0 ? Math.min(kfs.length, numKeyframes + 1) : kfs.length;
  const startKf = kfs[kfs.length - count];
  const dur = last.time - startKf.time;
  if (dur <= 1e-6) return cloneVal(last.value);

  const dt = time - startKf.time;
  const mode = String(type || 'cycle').toLowerCase();

  if (mode === 'pingpong') {
    const cycleIdx = Math.floor(dt / dur);
    const rem = dt - cycleIdx * dur;
    const localT = cycleIdx % 2 === 1 ? last.time - rem : startKf.time + rem;
    return evalPropertyKeyframeValue(prop, localT);
  }

  if (mode === 'offset') {
    const cycles = Math.floor(dt / dur);
    const rem = dt - cycles * dur;
    const base = evalPropertyKeyframeValue(prop, startKf.time + rem);
    const delta = Array.isArray(last.value)
      ? last.value.map((v, i) => v - (startKf.value[i] ?? 0))
      : last.value - startKf.value;
    if (Array.isArray(base)) {
      return base.map((v, i) => v + delta[i] * cycles);
    }
    return base + delta * cycles;
  }

  if (mode === 'continue') {
    const prev = kfs[kfs.length - 2];
    const segDt = Math.max(1e-5, last.time - prev.time);
    const eps = Math.min(1e-3, segDt * 0.25);
    const v1 = evalPropertyKeyframeValue(prop, last.time);
    const v0 = evalPropertyKeyframeValue(prop, last.time - eps);
    const extra = time - last.time;
    if (Array.isArray(v1)) {
      return v1.map((val, i) => val + ((val - v0[i]) / eps) * extra);
    }
    return v1 + ((v1 - v0) / eps) * extra;
  }

  // cycle
  const rem = dt % dur;
  return evalPropertyKeyframeValue(prop, startKf.time + rem);
}

function evalLoopIn(prop, time, type = 'cycle', numKeyframes = 0) {
  const kfs = prop.keyframes;
  if (!kfs || kfs.length < 2) return evalPropertyKeyframeValue(prop, time);
  const first = kfs[0];
  if (time >= first.time) return evalPropertyKeyframeValue(prop, time);

  const count = numKeyframes > 0 ? Math.min(kfs.length, numKeyframes + 1) : kfs.length;
  const endKf = kfs[count - 1];
  const dur = endKf.time - first.time;
  if (dur <= 1e-6) return cloneVal(first.value);

  const dt = endKf.time - time;
  const mode = String(type || 'cycle').toLowerCase();
  if (mode === 'pingpong') {
    const cycleIdx = Math.floor(dt / dur);
    const rem = dt - cycleIdx * dur;
    const localT = cycleIdx % 2 === 1 ? first.time + rem : endKf.time - rem;
    return evalPropertyKeyframeValue(prop, localT);
  }
  const rem = dt % dur;
  return evalPropertyKeyframeValue(prop, endKf.time - rem);
}

// 统一属性求值入口（包含关键帧与表达式、依赖循环检测）
export function evalProperty(project, comp, layer, propPath, time, evalStack = null, errors = null) {
  const prop = resolvePropertyByPath(layer, propPath);
  if (!prop) return 0;

  const baseVal = evalPropertyKeyframeValue(prop, time);
  if (!prop.expressionEnabled || !prop.expression || !prop.expression.trim()) {
    if (layer._exprErrors) delete layer._exprErrors[propPath];
    return baseVal;
  }

  const stack = evalStack || new Set();
  const key = `${comp.id}::${layer.id}::${propPath}`;
  if (stack.has(key)) {
    const msg = `表达式循环依赖: ${layer.name}.${propPath}`;
    if (errors) errors.set(key, msg);
    if (!layer._exprErrors) layer._exprErrors = {};
    layer._exprErrors[propPath] = msg;
    return baseVal;
  }

  stack.add(key);
  try {
    const fn = compileExpression(prop.expression);
    const seedBase = hashString(`${layer.id}:${propPath}`);
    let customSeed = seedBase;

    const thisCompProxy = {
      width: comp.width,
      height: comp.height,
      duration: comp.duration,
      frameDuration: 1 / (comp.fps || 30),
      fps: comp.fps || 30,
      numLayers: comp.layers.length,
      layer(nameOrIdx) {
        let target = null;
        if (typeof nameOrIdx === 'number') {
          target = comp.layers[nameOrIdx - 1];
        } else {
          target = comp.layers.find((l) => l.name === String(nameOrIdx));
        }
        return createLayerProxy(project, comp, target, time, stack, errors);
      },
    };

    const thisLayerProxy = createLayerProxy(project, comp, layer, time, stack, errors);
    const thisPropProxy = {
      value: wrapExprValue(baseVal, (qt) => evalPropertyKeyframeValue(prop, qt)),
      numKeys: prop.keyframes ? prop.keyframes.length : 0,
      valueAtTime(qt) {
        return wrapExprValue(evalPropertyKeyframeValue(prop, Number(qt) || 0), (t2) =>
          evalPropertyKeyframeValue(prop, t2)
        );
      },
    };

    const wiggleFn = (freq = 2, amp = 10, octaves = 1, ampMult = 0.5, t = time) => {
      const f = Number(freq) || 0;
      const a = unwrapArg(amp);
      const wt = Number(t);
      const x = wt * f;
      if (Array.isArray(baseVal)) {
        return baseVal.map((bv, idx) => {
          const ampVal = Array.isArray(a) ? Number(a[idx] ?? a[0] ?? 0) : Number(a) || 0;
          return bv + fbm1D(x + idx * 31.7, octaves, ampMult, seedBase + idx * 977) * ampVal;
        });
      }
      return Number(baseVal) + fbm1D(x, octaves, ampMult, seedBase) * (Number(a) || 0);
    };

    const linearFn = (t, a, b, c, d) => {
      const tv = Number(unwrapArg(t));
      if (d === undefined) {
        return interpNumericOrVec(a, b, clamp(tv, 0, 1));
      }
      const minT = Number(unwrapArg(a));
      const maxT = Number(unwrapArg(b));
      const u = Math.abs(maxT - minT) < 1e-9 ? 0 : clamp((tv - minT) / (maxT - minT), 0, 1);
      return interpNumericOrVec(c, d, u);
    };

    const easeFn = (t, a, b, c, d) => {
      const tv = Number(unwrapArg(t));
      let u, v1, v2;
      if (d === undefined) {
        u = clamp(tv, 0, 1);
        v1 = a;
        v2 = b;
      } else {
        const minT = Number(unwrapArg(a));
        const maxT = Number(unwrapArg(b));
        u = Math.abs(maxT - minT) < 1e-9 ? 0 : clamp((tv - minT) / (maxT - minT), 0, 1);
        v1 = c;
        v2 = d;
      }
      const s = u * u * (3 - 2 * u);
      return interpNumericOrVec(v1, v2, s);
    };

    const easeInFn = (t, a, b, c, d) => {
      const tv = Number(unwrapArg(t));
      let u, v1, v2;
      if (d === undefined) { u = clamp(tv, 0, 1); v1 = a; v2 = b; }
      else {
        const minT = Number(unwrapArg(a)), maxT = Number(unwrapArg(b));
        u = Math.abs(maxT - minT) < 1e-9 ? 0 : clamp((tv - minT) / (maxT - minT), 0, 1);
        v1 = c; v2 = d;
      }
      return interpNumericOrVec(v1, v2, u * u);
    };

    const easeOutFn = (t, a, b, c, d) => {
      const tv = Number(unwrapArg(t));
      let u, v1, v2;
      if (d === undefined) { u = clamp(tv, 0, 1); v1 = a; v2 = b; }
      else {
        const minT = Number(unwrapArg(a)), maxT = Number(unwrapArg(b));
        u = Math.abs(maxT - minT) < 1e-9 ? 0 : clamp((tv - minT) / (maxT - minT), 0, 1);
        v1 = c; v2 = d;
      }
      return interpNumericOrVec(v1, v2, 1 - (1 - u) * (1 - u));
    };

    const vecOp = (a, b, fn2) => {
      const ua = unwrapArg(a);
      const ub = unwrapArg(b);
      if (Array.isArray(ua) || Array.isArray(ub)) {
        const arrA = Array.isArray(ua) ? ua : new Array(ub.length).fill(ua);
        const arrB = Array.isArray(ub) ? ub : new Array(ua.length).fill(ub);
        return arrA.map((v, i) => fn2(Number(v) || 0, Number(arrB[i] ?? 0)));
      }
      return fn2(Number(ua) || 0, Number(ub) || 0);
    };

    const lengthFn = (a, b) => {
      const ua = unwrapArg(a);
      if (b !== undefined) {
        const ub = unwrapArg(b);
        const d = vecOp(ua, ub, (x, y) => x - y);
        return Array.isArray(d) ? Math.hypot(...d) : Math.abs(d);
      }
      return Array.isArray(ua) ? Math.hypot(...ua) : Math.abs(Number(ua) || 0);
    };

    const normalizeFn = (v) => {
      const uv = unwrapArg(v);
      const len = lengthFn(uv) || 1;
      return Array.isArray(uv) ? uv.map((x) => x / len) : uv / len;
    };

    const dotFn = (a, b) => {
      const ua = unwrapArg(a), ub = unwrapArg(b);
      let s = 0;
      for (let i = 0; i < Math.min(ua.length, ub.length); i++) s += ua[i] * ub[i];
      return s;
    };

    const crossFn = (a, b) => {
      const ua = unwrapArg(a), ub = unwrapArg(b);
      return [
        (ua[1] || 0) * (ub[2] || 0) - (ua[2] || 0) * (ub[1] || 0),
        (ua[2] || 0) * (ub[0] || 0) - (ua[0] || 0) * (ub[2] || 0),
        (ua[0] || 0) * (ub[1] || 0) - (ua[1] || 0) * (ub[0] || 0),
      ];
    };

    const seedRandomFn = (seed, timeless = false) => {
      const frameSalt = timeless ? 0 : Math.round(time * (comp.fps || 30));
      customSeed = (Number(seed) || 0) * 73856093 ^ seedBase ^ frameSalt;
    };

    const randomFn = (minOrMax = 1, max) => {
      const rng = mulberry32((customSeed++) ^ Math.round(time * 1000));
      const r = rng();
      if (max === undefined) return r * Number(unwrapArg(minOrMax));
      const lo = Number(unwrapArg(minOrMax));
      const hi = Number(unwrapArg(max));
      return lerp(lo, hi, r);
    };

    const noiseFn = (v) => {
      const uv = unwrapArg(v);
      const x = Array.isArray(uv) ? (uv[0] || 0) + (uv[1] || 0) * 13.7 : Number(uv) || 0;
      return fbm1D(x, 2, 0.5, seedBase);
    };

    const layerIdx = comp.layers.indexOf(layer) + 1;
    const rawValWrapped = wrapExprValue(baseVal, (qt) => evalPropertyKeyframeValue(prop, qt));

    const result = fn(
      time,
      rawValWrapped,
      layerIdx,
      comp.width,
      comp.height,
      comp.fps || 30,
      comp.duration,
      layer.inPoint,
      layer.outPoint,
      thisCompProxy,
      thisLayerProxy,
      thisPropProxy,
      wiggleFn,
      (type, n) => evalLoopOut(prop, time, type, n),
      (type, n) => evalLoopIn(prop, time, type, n),
      linearFn,
      easeFn,
      easeInFn,
      easeOutFn,
      (v, lo, hi) => {
        const uv = unwrapArg(v);
        if (Array.isArray(uv)) return uv.map((c, i) => clamp(c, Array.isArray(lo) ? lo[i] : lo, Array.isArray(hi) ? hi[i] : hi));
        return clamp(Number(uv), Number(lo), Number(hi));
      },
      lengthFn,
      normalizeFn,
      dotFn,
      crossFn,
      (a, b) => vecOp(a, b, (x, y) => x + y),
      (a, b) => vecOp(a, b, (x, y) => x - y),
      (a, b) => vecOp(a, b, (x, y) => x * y),
      (a, b) => vecOp(a, b, (x, y) => (Math.abs(y) > 1e-9 ? x / y : 0)),
      (d) => (Number(unwrapArg(d)) * Math.PI) / 180,
      (r) => (Number(unwrapArg(r)) * 180) / Math.PI,
      randomFn,
      seedRandomFn,
      noiseFn,
      (qt) => wrapExprValue(evalPropertyKeyframeValue(prop, Number(qt) || 0), (t2) => evalPropertyKeyframeValue(prop, t2))
    );

    const unwrapped = unwrapExprResult(result, baseVal);
    if (layer._exprErrors) delete layer._exprErrors[propPath];
    return unwrapped;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (errors) errors.set(key, msg);
    if (!layer._exprErrors) layer._exprErrors = {};
    layer._exprErrors[propPath] = msg;
    return baseVal;
  } finally {
    stack.delete(key);
  }
}

export function sampleExpressionCurve(project, comp, layer, propPath, tStart, tEnd, samples = 160) {
  const out = [];
  for (let i = 0; i <= samples; i++) {
    const t = lerp(tStart, tEnd, i / samples);
    const val = evalProperty(project, comp, layer, propPath, t);
    out.push({ time: t, value: val });
  }
  return out;
}
