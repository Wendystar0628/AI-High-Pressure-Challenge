/* expr.js — 表达式引擎：求值、引用、循环检测 */
(function(global) {
'use strict';

const Expr = {};

// 求值栈：检测循环引用  key = layerId.propPath.t
let evalStack = [];
let evalDepth = 0;
const MAX_DEPTH = 32;

Expr.lastError = null;

// 数值化
function toNum(v) {
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v[0] || 0;
  return 0;
}
function toArray(v) {
  if (typeof v === 'number') return [v];
  if (Array.isArray(v)) return v.slice();
  return [0, 0, 0];
}

// 可复现 wiggle：基于 layer id hash + 时间
function makeWiggle(layerId) {
  let seed = 0;
  for (let i = 0; i < layerId.length; i++) seed = (seed * 31 + layerId.charCodeAt(i)) | 0;
  return function wiggle(freq, amp, octaves = 2, ampMult = 0.5) {
    const t = this.__time || 0;
    const dims = Array.isArray(this.value) ? this.value.length : 1;
    const out = [];
    for (let d = 0; d < dims; d++) {
      let v = 0, a = amp, f = freq;
      for (let o = 0; o < octaves; o++) {
        v += a * U.valueNoise2(t * f, d * 13.7 + o * 7.3, seed + o * 991);
        f *= 2; a *= ampMult;
      }
      out.push(v);
    }
    return dims === 1 ? out[0] : out;
  };
}

// 属性代理：支持 valueAtTime / value / 其他
function makePropProxy(evaluator, layer, propPath, time, valueNow) {
  const proxy = {
    value: valueNow,
    __time: time,
    __layer: layer,
    __path: propPath,
    valueAtTime(t) {
      return evaluator(layer, propPath, t);
    }
  };
  return proxy;
}

// 向量分量代理：v.x v.y v.z 或 [0]
function vecProxy(arr, base) {
  const o = Object.create(base || null);
  if (Array.isArray(arr)) {
    o[0] = arr[0]; o[1] = arr[1]; o[2] = arr[2];
    o.x = arr[0]; o.y = arr[1]; o.z = arr[2];
    o.length = arr.length;
  }
  return o;
}

// 线性映射 / 缓动映射
function linearFn(t, tMin, tMax, v1, v2) {
  if (Array.isArray(t)) {
    // 多维
    return toArray(v1).map((_, i) => linearFn(t[i] != null ? t[i] : 0, tMin, tMax, toArray(v1)[i], toArray(v2)[i]));
  }
  if (Math.abs(tMax - tMin) < 1e-12) return U.deepClone(v1);
  const u = U.clamp((t - tMin) / (tMax - tMin), 0, 1);
  return Interp.lerpValue(v1, v2, u);
}
function easeFn(t, tMin, tMax, v1, v2) {
  if (Array.isArray(t)) {
    return toArray(v1).map((_, i) => easeFn(t[i] != null ? t[i] : 0, tMin, tMax, toArray(v1)[i], toArray(v2)[i]));
  }
  if (Math.abs(tMax - tMin) < 1e-12) return U.deepClone(v1);
  const u = U.clamp((t - tMin) / (tMax - tMin), 0, 1);
  return Interp.lerpValue(v1, v2, U.smoothstep(u));
}

// loopOut
function makeLoopOut(propProxy, evaluator, layer, propPath) {
  return function loopOut(type = 'cycle', numKeyframes = 0) {
    const anim = getAnim(layer, propPath);
    if (!anim || !anim.kfs || anim.kfs.length < 2) return propProxy.value;
    const t = propProxy.__time;
    const kfs = anim.kfs;
    const lastT = kfs[kfs.length - 1].t;
    const firstT = kfs[0].t;
    if (t < lastT) return propProxy.value; // 未超过最后关键帧
    const span = lastT - firstT;
    if (span < 1e-9) return propProxy.value;
    type = String(type).replace(/"/g, '');
    if (type === 'pingpong') {
      const cycle = (t - lastT) % (span * 2);
      const tt = cycle <= span ? lastT - cycle : firstT + (cycle - span);
      return evaluator(layer, propPath, tt);
    }
    // cycle 默认
    const tt = firstT + ((t - lastT) % span);
    return evaluator(layer, propPath, tt);
  };
}

// 取 anim 对象
function getAnim(layer, propPath) {
  const parts = propPath.split('.');
  let obj = layer;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj) return null;
    obj = obj[parts[i]];
  }
  const leaf = parts[parts.length - 1];
  if (!obj) return null;
  const v = obj[leaf];
  return Model.isAnim(v) ? v : null;
}

// thisComp / thisLayer 构建
function makeCompProxy(evaluator, comp, layer, time, getLayerValue) {
  return {
    name: comp.name,
    width: comp.width,
    height: comp.height,
    duration: comp.duration,
    frameDuration: 1 / comp.fps,
    numLayers: comp.layers.length,
    layer(nameOrIndex) {
      let target = null;
      if (typeof nameOrIndex === 'number') {
        target = comp.layers[nameOrIndex - 1] || comp.layers[nameOrIndex] || null;
      } else {
        const nm = String(nameOrIndex).replace(/^["']|["']$/g, '');
        target = comp.layers.find(l => l.name === nm) || null;
      }
      if (!target) throw new Error('找不到图层: ' + nameOrIndex);
      return makeLayerProxy(evaluator, comp, target, time);
    }
  };
}

function makeLayerProxy(evaluator, comp, layer, time) {
  const proxy = {
    name: layer.name,
    index: comp.layers.indexOf(layer) + 1,
    __layer: layer,
    __time: time,
    transform: {},
    text: layer.text ? { sourceText: layer.text.text } : undefined
  };
  const paths = ['position', 'anchor', 'scale', 'rotation', 'rotationX', 'rotationY', 'opacity'];
  paths.forEach(p => {
    Object.defineProperty(proxy.transform, p, {
      get() {
        const val = evaluator(layer, 'transform.' + p, time);
        const propProxy = makePropProxy(evaluator, layer, 'transform.' + p, time, val);
        propProxy.valueAtTime = (t) => evaluator(layer, 'transform.' + p, t);
        return vecProxy(toArray(val), propProxy);
      },
      configurable: true
    });
  });
  return proxy;
}

// 主求值：返回属性在 time 的最终值（含表达式）
// evaluator 由外部注入以支持跨层（保持纯净可测）
Expr.evalProp = function(anim, layer, propPath, time, ctx) {
  if (!anim) return null;
  // 无表达式
  if (!anim.exprOn || !anim.expr || !anim.expr.trim()) {
    return Interp.evaluateKfs(anim, time);
  }

  const key = (layer ? layer.id : '?') + '|' + propPath + '|' + time.toFixed(6);
  if (evalStack.includes(key) || evalDepth > MAX_DEPTH) {
    Expr.lastError = { prop: propPath, layer: layer ? layer.name : '', msg: '表达式循环引用，已退回关键帧值' };
    evalStack = [];
    evalDepth = 0;
    return Interp.evaluateKfs(anim, time);
  }

  evalStack.push(key);
  evalDepth++;
  try {
    const baseValue = Interp.evaluateKfs(anim, time);
    const evaluator = ctx.evalAt; // (layer, path, t) => value
    const comp = ctx.comp;

    const wiggle = makeWiggle(layer ? layer.id : 'global');
    const propProxy = makePropProxy(evaluator, layer, propPath, time, baseValue);

    const env = {
      time,
      value: baseValue,
      valueAtTime: (t) => evaluator(layer, propPath, t),
      loopOut: makeLoopOut(propProxy, evaluator, layer, propPath),
      linear: linearFn,
      ease: easeFn,
      wiggle: function(freq, amp) { return wiggle.call(propProxy, freq, amp); },
      clamp: (v, a, b) => U.clamp(Array.isArray(v) ? v[0] : v, a, b),
      length: (a, b) => {
        if (b === undefined) return U.vlen(Array.isArray(a) ? { x: a[0], y: a[1], z: a[2] } : a);
        return U.vlen(U.vsub(Array.isArray(a) ? { x: a[0], y: a[1], z: a[2] } : a, Array.isArray(b) ? { x: b[0], y: b[1], z: b[2] } : b));
      },
      normalize: (v) => {
        const n = U.vnorm(Array.isArray(v) ? { x: v[0], y: v[1], z: v[2] || 0 } : v);
        return [n.x, n.y, n.z];
      },
      add: (a, b) => toArray(a).map((v, i) => v + (toArray(b)[i] || 0)),
      sub: (a, b) => toArray(a).map((v, i) => v - (toArray(b)[i] || 0)),
      mul: (a, b) => toArray(a).map((v, i) => v * (toArray(b)[i] != null ? toArray(b)[i] : toNum(b))),
      sin: Math.sin, cos: Math.cos, tan: Math.tan,
      abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
      min: Math.min, max: Math.max, pow: Math.pow, sqrt: Math.sqrt,
      PI: Math.PI, E: Math.E,
      random: () => 0.5, // 确定性
      thisComp: makeCompProxy(evaluator, comp, layer, time),
      thisLayer: makeLayerProxy(evaluator, comp, layer, time),
      posterizeTime: (fps) => { /* 近似：量化 time */ },
      framesToTime: (f) => f / comp.fps,
      timeToFrames: (t) => Math.round(t * comp.fps),
      // 向量
      vec2: (x, y) => [x, y || 0],
      vec3: (x, y, z) => [x, y || 0, z || 0],
      color: (r, g, b, a) => ({ r, g, b, a: a != null ? a : 1 })
    };

    // 编译表达式：允许直接访问 time/value 等
    const argNames = Object.keys(env);
    const argVals = argNames.map(k => env[k]);
    let code = anim.expr;
    // 允许中文注释
    const fn = new Function(...argNames, '"use strict"; return (function(){ ' + code + ' })();');
    let result = fn(...argVals);

    // 结果规范化
    if (result && result.value !== undefined && Array.isArray(result.value)) result = result.value;
    if (result && result.x !== undefined) result = [result.x, result.y, result.z || 0];
    if (result === undefined || result === null) result = baseValue;

    // 维度匹配
    if (anim.dims >= 2 && typeof result === 'number') {
      result = new Array(anim.dims).fill(result);
    }
    if (Array.isArray(baseValue) && typeof result === 'number') {
      result = baseValue.map(() => result);
    }

    evalStack.pop();
    evalDepth--;
    Expr.lastError = null;
    return result;
  } catch (err) {
    evalStack.pop();
    evalDepth--;
    if (evalDepth === 0) evalStack = [];
    Expr.lastError = {
      prop: propPath,
      layer: layer ? layer.name : '',
      msg: err.message || String(err)
    };
    return Interp.evaluateKfs(anim, time);
  }
};

// 检查表达式语法
Expr.validate = function(code) {
  try {
    const fn = new Function('time', 'value', 'wiggle', 'loopOut', 'linear', 'ease',
      'thisComp', 'thisLayer', 'valueAtTime',
      '"use strict"; return (function(){ ' + code + ' })();');
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
};

Expr.resetStack = function() { evalStack = []; evalDepth = 0; };

global.Expr = Expr;
})(window);
