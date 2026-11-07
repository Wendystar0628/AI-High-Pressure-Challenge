/* PRISM evaluator: keyframes, interpolation, expressions, transforms, shape/text/camera state */
(function () {
  const AE = window.AE, U = AE.U, M = AE.M, G = AE.G, T = AE.T, P = AE.P;
  const E = (AE.Eval = {});

  E.makeCtx = (project, comp, time, opts = {}) => ({
    project, comp, time, cache: new Map(), exprStack: new Set(),
    overrides: opts.overrides || null, errors: [], seeds: new Map(),
    depth: opts.depth || 0, renderScale: opts.renderScale || 1, override: opts.override || null,
    random: null, propsEvaluated: 0
  });

  E.overrideFor = (ctx, layer, key) => {
    if (!ctx || !ctx.overrides || !ctx.comp) return undefined;
    const m = ctx.overrides[layer.id];
    if (!m) return undefined;
    if (Object.prototype.hasOwnProperty.call(m, key)) return m[key];
    return undefined;
  };

  // ---------- interpolation ----------
  function presetOut(k) {
    if (k.outH) return k.outH;
    if (k.out === 'linear') return [1 / 3, 1 / 3];
    if (k.out === 'hold') return null;
    if (k.out === 'custom' && k.outH) return k.outH;
    return [.33, 0];
  }
  function presetIn(k) {
    if (k.inH) return k.inH;
    if (k.in === 'linear') return [2 / 3, 2 / 3];
    if (k.in === 'hold') return [2 / 3, 2 / 3];
    if (k.in === 'custom' && k.inH) return k.inH;
    return [.67, 1];
  }
  E.easeAt = (A, B, x) => {
    if (A.out === 'hold' || A.hold) return 0;
    const o = presetOut(A) || [1 / 3, 1 / 3];
    const i = presetIn(B) || [2 / 3, 2 / 3];
    const fn = U.cubicBezier(o[0], o[1], i[0], i[1]);
    return fn(x);
  };
  E.interpBase = (prop, t) => {
    const keys = prop.keys;
    if (!keys || !keys.length) return prop.value;
    if (t <= keys[0].t) return keys[0].v;
    if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].v;
    let i = 0;
    for (let j = 0; j < keys.length - 1; j++) if (t >= keys[j].t && t <= keys[j + 1].t) { i = j; break; }
    const A = keys[i], B = keys[i + 1];
    if (A.out === 'hold' || A.hold) return A.v;
    const span = B.t - A.t;
    const x = span <= 1e-9 ? 1 : (t - A.t) / span;
    const u = E.easeAt(A, B, x);
    return E.lerpValue(A.v, B.v, u, prop, A, B, x);
  };
  E.lerpValue = (a, b, u, prop, A, B, x) => {
    if (typeof a === 'number' && typeof b === 'number') return U.lerp(a, b, u);
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length === 4 && b.length === 4 && prop && prop.color) return U.lerpColor(a, b, u);
      if (prop && prop.spatial && a.length >= 2 && A && B) {
        return E.spatialValue(a, b, u, prop, A, B, x);
      }
      return a.map((v, i) => U.lerp(v, b[i] == null ? v : b[i], u));
    }
    if (a && b && a.contours && b.contours) {
      return G.morphShapes(a, b, u, { resample: 96 });
    }
    if (typeof a === 'boolean') return u < 1 ? a : b;
    if (typeof a === 'string') return u < 1 ? a : b;
    return u < .5 ? a : b;
  };
  E.spatialHandleOut = (prop, i, A) => {
    if (A.spatialOut) return A.spatialOut;
    if (A.corner) return [0, 0];
    const keys = prop.keys;
    const prev = keys[Math.max(0, i - 1)].v, next = keys[Math.min(keys.length - 1, i + 1)].v;
    return [(next[0] - prev[0]) / 6, (next[1] - prev[1]) / 6, 0];
  };
  E.spatialHandleIn = (prop, i, B) => {
    if (B.spatialIn) return B.spatialIn;
    if (B.corner) return [0, 0];
    const keys = prop.keys;
    const prev = keys[Math.max(0, i - 1)].v, next = keys[Math.min(keys.length - 1, i + 1)].v;
    return [(prev[0] - next[0]) / 6, (prev[1] - next[1]) / 6, 0];
  };
  E.spatialValue = (a, b, u, prop, A, B, x) => {
    const ai = prop.keys.indexOf(A), bi = ai + 1;
    const h0 = E.spatialHandleOut(prop, ai, A), h1 = E.spatialHandleIn(prop, bi, B);
    const p0 = [a[0], a[1]], p1 = [a[0] + h0[0], a[1] + h0[1]], p2 = [b[0] + h1[0], b[1] + h1[1]], p3 = [b[0], b[1]];
    // constant speed along path for linear timing
    const N = 48;
    const samples = [];
    let total = 0;
    for (let i = 0; i <= N; i++) {
      const t = i / N, mt = 1 - t;
      const px = mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0];
      const py = mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1];
      if (i) total += Math.hypot(px - samples[i - 1][0], py - samples[i - 1][1]);
      samples.push([px, py, total]);
    }
    let target = u * total;
    let k = 1; while (k < samples.length - 1 && samples[k][2] < target) k++;
    const t0 = samples[k - 1], t1 = samples[k];
    const f = ((target - t0[2]) / ((t1[2] - t0[2]) || 1));
    const out = [U.lerp(t0[0], t1[0], f), U.lerp(t0[1], t1[1], f)];
    if (a.length > 2) out[2] = U.lerp(a[2] || 0, b[2] || 0, u);
    if (prop.color) out.push(1);
    return out;
  };
  E.motionPath = (prop, steps = 28) => {
    if (!prop || !prop.keys || prop.keys.length < 2) return [];
    const pts = [];
    for (let i = 0; i < prop.keys.length - 1; i++) {
      const A = prop.keys[i], B = prop.keys[i + 1];
      const h0 = E.spatialHandleOut(prop, i, A), h1 = E.spatialHandleIn(prop, i + 1, B);
      const p0 = A.v, p1 = [A.v[0] + h0[0], A.v[1] + h0[1]], p2 = [B.v[0] + h1[0], B.v[1] + h1[1]], p3 = B.v;
      for (let k = 0; k < steps; k++) {
        const t = k / steps, mt = 1 - t;
        pts.push([
          mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
          mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1]
        ]);
      }
    }
    const last = prop.keys[prop.keys.length - 1].v; pts.push([last[0], last[1]]);
    return pts;
  };
  E.speedAt = (prop, t, eps = 1 / 120) => {
    const a = E.interpBase(prop, t - eps), b = E.interpBase(prop, t + eps);
    if (typeof a === 'number') return Math.abs(b - a) / (2 * eps);
    if (Array.isArray(a)) return M.dist(a, b) / (2 * eps);
    return 0;
  };

  // ---------- property evaluation with expressions ----------
  E.propValue = (layer, key, ctx, time) => {
    time = time == null ? ctx.time : time;
    const prop = layer.props[key];
    if (!prop) return undefined;
    const ov = E.overrideFor(ctx, layer, key);
    if (ov !== undefined) return ov;
    const ck = `${layer.id}|${key}|${time.toFixed(4)}|${prop.expr ? 1 : 0}`;
    if (ctx.cache.has(ck)) return ctx.cache.get(ck);
    ctx.propsEvaluated++;
    let base = E.interpBase(prop, time);
    let result = base;
    if (prop.expr && String(prop.expr).trim()) {
      const stackKey = layer.id + '|' + key;
      if (ctx.exprStack.has(stackKey)) {
        const err = `循环引用：${layer.name} · ${key}`;
        prop._exprError = err; ctx.errors.push({ layer, key, error: err });
        ctx.cache.set(ck, base);
        return base;
      }
      ctx.exprStack.add(stackKey);
      try {
        result = E.evalExpr(prop.expr, layer, key, base, ctx, time);
        prop._exprError = null;
      } catch (err) {
        prop._exprError = err.message || String(err);
        ctx.errors.push({ layer, key, error: prop._exprError });
        result = base;
      } finally { ctx.exprStack.delete(stackKey); }
    }
    result = E.unwrap(result);
    ctx.cache.set(ck, result);
    return result;
  };
  E.propAt = (layer, key, time, ctx) => E.propValue(layer, key, ctx, time);
  E.setStaticPlainValue = (layer, key, value, ctx) => { if (layer.props[key]) layer.props[key].value = value; };

  E.unwrap = (v) => {
    if (v == null) return v;
    if (typeof v === 'object') {
      if (v instanceof Number) return Number(v);
      if (v instanceof String) return String(v);
      if (Array.isArray(v)) return v.map(E.unwrap);
      if (v.__arr) return v.__arr.map(E.unwrap);
    }
    return v;
  };
  E.num = (v) => (typeof v === 'number' ? v : (v && v.valueOf ? Number(v.valueOf()) : Number(v) || 0));
  E.vec = (v, len = 3) => {
    if (Array.isArray(v)) return v;
    if (v && v.__arr) return v.__arr;
    return [E.num(v), E.num(v), E.num(v)];
  };

  function makeValProxy(v, layer, propKey, ctx, time) {
    if (Array.isArray(v)) {
      const arr = v.map(x => Array.isArray(x) ? x.slice() : x);
      const define = (name, fn) => Object.defineProperty(arr, name, { value: fn, enumerable: false, configurable: true });
      define('valueAtTime', (t) => makeValProxy(E.propValue(layer, propKey, ctx, t), layer, propKey, ctx, t));
      define('wiggle', (f, a, oct = 1, mult = .5, t2) => makeValProxy(wiggleValue(layer, propKey, ctx, propKey && layer.props[propKey] && layer.props[propKey].value, f, a, oct, mult, t2 == null ? time : t2), layer, propKey, ctx, time));
      define('loopOut', (ty, num) => makeValProxy(loopOutValue(layer, propKey, ctx, ty, num, time), layer, propKey, ctx, time));
      define('toWorld', (p) => E.unwrap(E.toWorld(layer, p, ctx, time, layer.__comp)));
      define('fromWorld', (p) => E.unwrap(E.fromWorld(layer, p, ctx, time, layer.__comp)));
      return arr;
    }
    if (typeof v === 'number') {
      const numObj = Object(v);
      Object.defineProperty(numObj, 'valueAtTime', { value: (t) => makeValProxy(E.propValue(layer, propKey, ctx, t), layer, propKey, ctx, t), enumerable: false });
      Object.defineProperty(numObj, 'wiggle', { value: (f, a, oct = 1, mult = .5, t2) => makeValProxy(wiggleValue(layer, propKey, ctx, E.propValue(layer, propKey, ctx, time), f, a, oct, mult, t2 == null ? time : t2), layer, propKey, ctx, time), enumerable: false });
      Object.defineProperty(numObj, 'loopOut', { value: (ty, n) => makeValProxy(loopOutValue(layer, propKey, ctx, ty, n, time), layer, propKey, ctx, time), enumerable: false });
      return numObj;
    }
    if (typeof v === 'string') {
      const s = Object(v);
      Object.defineProperty(s, 'valueAtTime', { value: (t) => makeValProxy(E.propValue(layer, propKey, ctx, t), layer, propKey, ctx, t), enumerable: false });
      return s;
    }
    return v;
  }

  function wiggleValue(layer, key, ctx, base, freq, amp, octaves, ampMult, time) {
    const seedBase = (ctx.project.seed || 1) * 97 + U.hash(layer.id + key);
    const n = (off) => {
      let total = 0, a = 1, f = 1, max = 0;
      for (let i = 0; i < Math.max(1, octaves); i++) {
        const t = time * (freq || 1) * f + seedBase * .0001 + off * 13.1 + i * 31.7;
        total += U.noise2(t, off * 3.4 + i * 7.7) * a; max += Math.abs(a);
        a *= (ampMult == null ? .5 : ampMult); f *= 2;
      }
      return total;
    };
    const A = amp == null ? 20 : amp;
    if (Array.isArray(base)) return base.map((v, i) => E.num(v) + n(i) * A);
    return E.num(base) + n(0) * A;
  }
  function loopOutValue(layer, key, ctx, type, numKeys, time) {
    const prop = layer.props[key];
    if (!prop || !prop.keys.length) return E.propValue(layer, key, ctx, time);
    const keys = prop.keys;
    let n = numKeys || 0;
    if (!n) n = keys.length - 1;
    const first = keys[Math.max(0, keys.length - 1 - n)].t, last = keys[keys.length - 1].t;
    if (time >= first && time <= last) return E.interpBase(prop, time);
    const period = last - first;
    if (period <= 0) return E.interpBase(prop, time);
    let t = time;
    if (type === 'pingpong') {
      const ph = U.mod((time - first) / period, 2);
      t = first + (ph <= 1 ? ph : 2 - ph) * period;
    } else if (type === 'offset') {
      const k = Math.floor((time - first) / period);
      const val = E.interpBase(prop, first + U.mod(time - first, period));
      const firstV = E.interpBase(prop, first), delta = Array.isArray(val) ? val.map((v, i) => v - firstV[i]) : val - firstV;
      const out = Array.isArray(val) ? val.map((v, i) => v + delta[i] * 0) : val;
      // offset by accumulated delta over cycles (approximate)
      const baseLast = E.interpBase(prop, last), baseFirst = E.interpBase(prop, first);
      const off = Array.isArray(baseLast) ? baseLast.map((v, i) => (v - baseFirst[i]) * k) : (baseLast - baseFirst) * k;
      return Array.isArray(val) ? val.map((v, i) => v + off[i]) : val + off;
    } else {
      t = first + U.mod(time - first, period);
    }
    return E.interpBase(prop, t);
  }

  // ---------- layer & comp proxies ----------
  const TRANSFORM_MAP = { anchorPoint: 'transform.anchor', anchor: 'transform.anchor', position: 'transform.position', scale: 'transform.scale', rotation: 'transform.rotation', rotationX: 'transform.rotation', rotationY: 'transform.rotation', rotationZ: 'transform.rotation', opacity: 'transform.opacity' };

  function getLayerValue(layer, comp, key, ctx, time) {
    if (!layer) return 0;
    const p = key === 'transform.rotation' ? null : null;
    let v = E.propValue(layer, key, ctx, time);
    if (key === 'transform.rotation') return makeRotProxy(v, layer, key, ctx, time);
    return v;
  }
  function makeRotProxy(v, layer, key, ctx, time) {
    return {
      rotation: v,
      valueAtTime: (t) => E.propValue(layer, key, ctx, t),
      wiggle: (f, a) => { const arr = wiggleValue(layer, key, ctx, v, f, a, 1, .5, time); return arr; },
      toWorld: (p) => E.toWorld(layer, p, ctx, time)
    };
  }

  E.layerProxy = function (layer, comp, ctx) {
    if (!layer) return null;
    const time = ctx.time;
    const transformCache = new Map();
    const getT = (aeName) => {
      const map = { anchorPoint: ['transform.anchor', null], position: ['transform.position', null], scale: ['transform.scale', null], rotation: ['transform.rotation', 2], rotationX: ['transform.rotation', 0], rotationY: ['transform.rotation', 1], rotationZ: ['transform.rotation', 2], opacity: ['transform.opacity', null] };
      const [key, compIdx] = map[aeName] || [];
      if (!key) return 0;
      let val = E.propValue(layer, key, ctx, time);
      if (compIdx !== null && Array.isArray(val)) val = val[compIdx] == null ? 0 : val[compIdx];
      return makeValProxy(val, layer, key, ctx, time);
    };
    const transform = new Proxy({}, { get(_, p) { return getT(String(p)); } });
    const layerObj = {
      name: layer.name, index: comp.layers.indexOf(layer) + 1, width: comp.width, height: comp.height,
      inPoint: layer.inPoint, outPoint: layer.outPoint, startTime: layer.startTime,
      transform, toWorld: (p) => E.toWorld(layer, p, ctx, time, comp),
      fromWorld: (p) => E.fromWorld(layer, p, ctx, time, comp),
      toComp: (p) => E.toWorld(layer, p, ctx, time, comp),
      sourceRectAtTime: (t, extents) => {
        const b = E.layerBounds(comp, layer, t == null ? time : t, ctx.project, ctx);
        return { left: b.x, top: b.y, width: b.w, height: b.h };
      },
      effect: (name) => new Proxy({}, {
        get(_, p) {
          const fx = layer.effects.find(f => f.name === name || P.EFFECT_DEFS[f.type] && P.EFFECT_DEFS[f.type].label === name || String(p) === f.type);
          if (!fx) return 0;
          const k = `fx.${fx.id}.${String(p)}`;
          return makeValProxy(E.propValue(layer, k, ctx, time), layer, k, ctx, time);
        }
      }),
      text: { sourceText: layer.text ? layer.text.content : '' },
      marker: { key: null, numKeys: 0 }
    };
    return layerObj;
  };

  E.compProxy = function (comp, project, time, ctx, depth = 0) {
    const inner = ctx && ctx.comp === comp ? ctx : E.makeCtx(project, comp, time, { overrides: ctx ? ctx.overrides : null, depth });
    return {
      name: comp.name, width: comp.width, height: comp.height, duration: comp.duration, fps: comp.fps, time,
      layer: (nameOrIndex) => {
        let layer;
        if (typeof nameOrIndex === 'number') layer = comp.layers[nameOrIndex - 1];
        else layer = comp.layers.find(l => l.name === nameOrIndex) || comp.layers.find(l => l.id === nameOrIndex);
        if (!layer) throw new Error(`找不到图层 "${nameOrIndex}"`);
        const lp = E.layerProxy(layer, comp, inner);
        lp.__layer = layer; lp.__comp = comp;
        return lp;
      },
      marker: { key: () => null, numKeys: 0 }
    };
  };

  E.toWorld = (layer, p, ctx, time, comp) => {
    comp = comp || ctx.comp;
    p = E.vec(p || [0, 0, 0], 3);
    const m = E.worldMatrix(comp, layer, ctx, time);
    return M.transformPoint(m, [E.num(p[0]), E.num(p[1]), E.num(p[2])]);
  };
  E.fromWorld = (layer, p, ctx, time, comp) => {
    comp = comp || ctx.comp;
    p = E.vec(p || [0, 0, 0], 3);
    const m = E.worldMatrix(comp, layer, ctx, time);
    return M.transformPoint(M.invert(m), [E.num(p[0]), E.num(p[1]), E.num(p[2])]);
  };

  // ---------- expression evaluator ----------
  E.evalExpr = function (code, layer, key, base, ctx, time) {
    const project = ctx.project, comp = ctx.comp;
    const thisLayer = E.layerProxy(layer, comp, ctx);
    const thisComp = E.compProxy(comp, project, time, ctx);
    const value = makeValProxy(base, layer, key, ctx, time);
    const self = E;
    const prop = layer.props[key];
    const scope = {
      time, value, thisLayer, thisComp, numKeys: prop.keys.length,
      Math,
      comp: (name) => {
        const c = project.comps.find(c => c.name === name || c.id === name);
        if (!c) throw new Error(`找不到合成 "${name}"`);
        const ictx = E.makeCtx(project, c, time, { overrides: ctx.overrides, depth: (ctx.depth || 0) + 1 });
        return E.compProxy(c, project, time, ictx, (ctx.depth || 0) + 1);
      },
      linear: (t, a, b, c, d) => { t = E.num(t); a = E.num(a); b = E.num(b); return c + (d - c) * U.clamp((t - a) / (b - a || 1)); },
      ease: (t, a, b, c, d) => { const u = U.clamp((E.num(t) - E.num(a)) / (E.num(b) - E.num(a) || 1)); return c + (d - c) * (u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2); },
      valueAtTime: (t) => makeValProxy(E.propValue(layer, key, ctx, t), layer, key, ctx, t),
      wiggle: (f, a, oct = 1, mult = .5, t2) => makeValProxy(wiggleValue(layer, key, ctx, base, f, a, oct, mult, t2 == null ? time : t2), layer, key, ctx, time),
      loopOut: (type, num) => makeValProxy(loopOutValue(layer, key, ctx, type || 'cycle', num || 0, time), layer, key, ctx, time),
      loopIn: (type, num) => makeValProxy(base, layer, key, ctx, time),
      seedRandom: (seed, timeless) => { ctx.random = U.seedRand(Math.floor(E.num(seed)) + (ctx.project.seed || 0)); },
      random: () => ctx.random ? ctx.random() : Math.random(),
      gaussRandom: (seed) => { const r = U.seedRand((seed == null ? 1 : Math.floor(E.num(seed))) + ctx.project.seed); return (r() + r() + r() + r() - 2) / 1; },
      noise: (x, y) => U.noise2(E.num(x) || 0, E.num(y) || 0),
      degreesToRadians: U.rad, radiansToDegrees: U.deg,
      clamp: (v, a, b) => U.clamp(E.num(v), E.num(a), E.num(b)),
      length: (v) => Array.isArray(v) ? M.len(v) : Math.abs(E.num(v)),
      add: (a, b) => Array.isArray(a) ? a.map((x, i) => x + b[i]) : E.num(a) + E.num(b),
      sub: (a, b) => Array.isArray(a) ? a.map((x, i) => x - b[i]) : E.num(a) - E.num(b),
      mul: (a, b) => Array.isArray(a) ? a.map(x => x * b) : E.num(a) * E.num(b),
      toWorld: (p) => E.toWorld(layer, p, ctx, time, comp),
      fromWorld: (p) => E.fromWorld(layer, p, ctx, time, comp),
      hasKeyframes: () => prop.keys.length > 0, numLayers: comp.layers.length,
      marker: { key: () => null }
    };
    const names = Object.keys(scope);
    const vals = names.map(k => scope[k]);
    let fn;
    let src = String(code).trim();
    if (!src) throw new Error('表达式为空');
    let body;
    const hasStatements = /(^|[;{}])\s*(var|let|const|if|for|while|return)\b/.test(src) || /;\s*[^;]*$/.test(src);
    if (hasStatements && !/\breturn\b/.test(src)) {
      const idx = src.lastIndexOf(';');
      if (idx >= 0 && src.slice(idx + 1).trim()) body = src.slice(0, idx + 1) + '\nreturn (' + src.slice(idx + 1).trim() + ');';
      else body = src;
    } else if (hasStatements) body = src;
    else body = 'return (' + src + ');';
    try { fn = new Function(...names, '"use strict";\n' + body); }
    catch (e) { throw new Error('语法错误：' + e.message); }
    let out;
    try { out = fn.apply(null, vals); } catch (e) { throw new Error('求值错误：' + (e.message || e)); }
    if (out && typeof out.then === 'function') throw new Error('表达式不能返回异步结果');
    if (out === undefined) throw new Error('表达式没有返回值');
    return E.unwrap(out);
  };

  // ---------- transforms ----------
  E.layerMatrixLocal = (ctx, layer, time) => {
    const pos = E.vec(E.propValue(layer, 'transform.position', ctx, time), 3);
    const anchor = E.vec(E.propValue(layer, 'transform.anchor', ctx, time), 3);
    const scale = E.vec(E.propValue(layer, 'transform.scale', ctx, time), 3).map(v => (v == null ? 100 : v) / 100);
    const rot = E.vec(E.propValue(layer, 'transform.rotation', ctx, time), 3);
    let m = M.translate(E.num(pos[0]), E.num(pos[1]), E.num(pos[2]));
    m = M.mult(m, M.rotateZ(U.rad(E.num(rot[2]))));
    m = M.mult(m, M.rotateY(U.rad(E.num(rot[1]))));
    m = M.mult(m, M.rotateX(U.rad(E.num(rot[0]))));
    m = M.mult(m, M.scale(scale[0] || .01, scale[1] || .01, scale[2] || .01));
    m = M.mult(m, M.translate(-E.num(anchor[0]), -E.num(anchor[1]), -E.num(anchor[2])));
    return m;
  };
  E.worldMatrix = (comp, layer, ctx, time) => {
    time = time == null ? ctx.time : time;
    const chain = P.parentChain(comp, layer).reverse();
    let m = M.identity();
    for (const l of chain) {
      if (!l) continue;
      m = M.mult(m, E.layerMatrixLocal(ctx, l, time));
    }
    return m;
  };
  E.affineLocal = (ctx, layer, time) => {
    const pos = E.vec(E.propValue(layer, 'transform.position', ctx, time), 3);
    const anchor = E.vec(E.propValue(layer, 'transform.anchor', ctx, time), 3);
    const scale = E.vec(E.propValue(layer, 'transform.scale', ctx, time), 3);
    const rot = E.vec(E.propValue(layer, 'transform.rotation', ctx, time), 3);
    return U.affine.trs(E.num(pos[0]), E.num(pos[1]), U.rad(E.num(rot[2])), (scale[0] || 0) / 100, (scale[1] || 0) / 100, E.num(anchor[0]), E.num(anchor[1]));
  };
  E.worldAffine = (comp, layer, ctx, time) => {
    time = time == null ? ctx.time : time;
    const chain = P.parentChain(comp, layer).reverse();
    let m = U.affine.id();
    for (const l of chain) m = U.affine.mul(m, E.affineLocal(ctx, l, time));
    return m;
  };
  E.layerOpacity = (layer, ctx, time) => {
    const v = E.propValue(layer, 'transform.opacity', ctx, time);
    let o = E.num(v);
    if (layer.type === 'precomp') o *= E.num(E.propValue(layer, 'precomp.opacity', ctx, time)) / 100;
    return U.clamp(o, 0, 100);
  };

  // ---------- layer activity/time ----------
  E.isActive = (comp, layer, t) => {
    if (!layer.visible) return false;
    if (t < layer.inPoint - 1e-6 || t > layer.outPoint + (1 / comp.fps) + 1e-6) return false;
    return true;
  };
  E.innerTime = (comp, layer, t, ctx) => {
    const start = layer.startTime || 0;
    let local = (t - start) * 100 / (layer.stretch || 100) + layer.inPoint;
    if (layer.type === 'precomp') {
      if (layer.precomp.timeRemap) {
        const rt = E.num(E.propValue(layer, 'precomp.time', ctx, t));
        local = rt;
      } else {
        local = (t - layer.inPoint) * (layer.precomp.speed == null ? 1 : layer.precomp.speed / 100) + (layer.precomp.offset || 0);
      }
    }
    return local;
  };

  // ---------- shape eval ----------
  E.shapeItemShape = (layer, item, ctx, time) => {
    const base = `content.${item.id}.`;
    const pos = E.vec(E.propValue(layer, base + 'position', ctx, time) || [0, 0], 2);
    const rot = U.rad(E.num(E.propValue(layer, base + 'rotation', ctx, time)));
    const tr = (s) => {
      let out = G.rotateShape(s, rot);
      return G.translateShape(out, E.num(pos[0]), E.num(pos[1]));
    };
    if (item.type === 'rect') {
      const size = E.vec(E.propValue(layer, base + 'size', ctx, time) || [100, 100], 2);
      const r = E.num(E.propValue(layer, base + 'roundness', ctx, time));
      return tr(G.rect(E.num(size[0]), E.num(size[1]), 0, 0, r));
    }
    if (item.type === 'ellipse') {
      const size = E.vec(E.propValue(layer, base + 'size', ctx, time) || [100, 100], 2);
      return tr(G.ellipse(E.num(size[0]) / 2, E.num(size[1]) / 2));
    }
    if (item.type === 'path') {
      const path = E.propValue(layer, base + 'path', ctx, time);
      return path && path.contours ? tr(path) : { contours: [] };
    }
    return { contours: [] };
  };
  E.evalContents = (layer, ctx, time, parentId = null) => {
    const items = [];
    const children = (layer.contents || []).filter(c => c.parentId === parentId && c.enabled !== false);
    let stack = []; // shapes produced in this group
    let current = null;
    for (const item of children) {
      if (item.type === 'rect' || item.type === 'ellipse' || item.type === 'path') {
        const shape = E.shapeItemShape(layer, item, ctx, time);
        items.push({ shape, item, kind: 'path' });
        current = shape;
      } else if (item.type === 'group') {
        const sub = E.evalContents(layer, ctx, time, item.id);
        const base = `content.${item.id}.`;
        const pos = E.vec(E.propValue(layer, base + 'position', ctx, time) || [0, 0], 2);
        const anchor = E.vec(E.propValue(layer, base + 'anchor', ctx, time) || [0, 0], 2);
        const scale = E.vec(E.propValue(layer, base + 'scale', ctx, time) || [100, 100], 2);
        const rotRaw = E.propValue(layer, base + 'rotation', ctx, time);
        const rot = U.rad(Array.isArray(rotRaw) ? E.num(rotRaw[2] || 0) : E.num(rotRaw));
        const op = E.num(E.propValue(layer, base + 'opacity', ctx, time)) / 100;
        const tr = U.affine.trs(E.num(pos[0]), E.num(pos[1]), rot, E.num(scale[0]) / 100, E.num(scale[1]) / 100, E.num(anchor[0]), E.num(anchor[1]));
        for (const s of sub.items) {
          items.push({ shape: G.transformShape(s.shape, tr), item: s.item, kind: s.kind, opacity: (s.opacity == null ? 1 : s.opacity) * op });
        }
        if (sub.items.length) current = sub.items[sub.items.length - 1].shape;
      } else if (item.type === 'trim') {
        const start = E.num(E.propValue(layer, `content.${item.id}.start`, ctx, time)) / 100;
        const end = E.num(E.propValue(layer, `content.${item.id}.end`, ctx, time)) / 100;
        const offset = E.num(E.propValue(layer, `content.${item.id}.offset`, ctx, time));
        for (const it of items) it.shape = G.trimShape(it.shape, start, end, offset);
      } else if (item.type === 'repeater') {
        const copies = Math.round(E.num(E.propValue(layer, `content.${item.id}.copies`, ctx, time)));
        const pos = E.vec(E.propValue(layer, `content.${item.id}.position`, ctx, time) || [0, 0], 2);
        const rot = E.num(E.propValue(layer, `content.${item.id}.rotation`, ctx, time));
        const scale = E.num(E.propValue(layer, `content.${item.id}.scale`, ctx, time));
        const so = E.num(E.propValue(layer, `content.${item.id}.startOpacity`, ctx, time));
        const eo = E.num(E.propValue(layer, `content.${item.id}.endOpacity`, ctx, time));
        const out = [];
        for (const it of items) {
          const reps = G.repeater(it.shape, { copies, position: pos, rotation: rot, scale: scale - 100, startOpacity: so, endOpacity: eo });
          for (const r of reps) out.push({ shape: r.shape, item: it.item, kind: it.kind, opacity: r.opacity * (it.opacity == null ? 1 : it.opacity) });
        }
        items.length = 0; items.push(...out);
        if (items.length) current = items[items.length - 1].shape;
      } else if (item.type === 'boolean') {
        if (items.length >= 2) {
          const b = items.pop();
          const a = items.pop();
          const op = item.op || 'union';
          const shape = G.boolean(a.shape, b.shape, op);
          items.push({ shape, item, kind: 'boolean', op });
          current = shape;
        }
      } else if (item.type === 'offset') {
        const amt = E.num(E.propValue(layer, `content.${item.id}.amount`, ctx, time));
        for (const it of items) it.shape = G.offsetShape(it.shape, amt);
      }
    }
    return { items, current };
  };
  E.shapeStyles = (layer, ctx, time) => {
    return {
      fillColor: U.colorArr(E.propValue(layer, 'shape.fillColor', ctx, time)),
      fillOpacity: E.num(E.propValue(layer, 'shape.fillOpacity', ctx, time)) / 100,
      fillOn: !!E.propValue(layer, 'shape.fillOn', ctx, time),
      strokeColor: U.colorArr(E.propValue(layer, 'shape.strokeColor', ctx, time)),
      strokeWidth: E.num(E.propValue(layer, 'shape.strokeWidth', ctx, time)),
      strokeOpacity: E.num(E.propValue(layer, 'shape.strokeOpacity', ctx, time)) / 100,
      strokeOn: !!E.propValue(layer, 'shape.strokeOn', ctx, time),
      gradientOn: !!E.propValue(layer, 'shape.gradientOn', ctx, time),
      gradientStart: U.colorArr(E.propValue(layer, 'shape.gradientStart', ctx, time)),
      gradientEnd: U.colorArr(E.propValue(layer, 'shape.gradientEnd', ctx, time)),
      gradientAngle: E.num(E.propValue(layer, 'shape.gradientAngle', ctx, time))
    };
  };
  E.shapeBounds = (layer, ctx, time) => {
    const { items } = E.evalContents(layer, ctx, time);
    let b = { x: Infinity, y: Infinity, w: -Infinity, h: -Infinity };
    for (const it of items) { const bb = G.bounds(it.shape); b.x = Math.min(b.x, bb.x); b.y = Math.min(b.y, bb.y); b.w = Math.max(b.w, bb.x + bb.w); b.h = Math.max(b.h, bb.y + bb.h); }
    if (!isFinite(b.x)) return { x: -10, y: -10, w: 20, h: 20 };
    return { x: b.x, y: b.y, w: b.w - b.x, h: b.h - b.y, cx: (b.x + b.w) / 2, cy: (b.y + b.h) / 2 };
  };

  // ---------- text ----------
  E.textContent = (layer, ctx, time) => {
    const ov = E.overrideFor(ctx, layer, 'text.content');
    if (ov !== undefined) return String(ov);
    return layer.text ? String(layer.text.content) : '';
  };
  E.textStyle = (layer, ctx, time) => {
    const props = {
      content: E.textContent(layer, ctx, time),
      font: layer.text.font, weight: layer.text.weight,
      fontSize: E.num(E.propValue(layer, 'text.fontSize', ctx, time)),
      tracking: E.num(E.propValue(layer, 'text.tracking', ctx, time)),
      lineHeight: E.num(E.propValue(layer, 'text.lineHeight', ctx, time)),
      align: E.propValue(layer, 'text.align', ctx, time),
      justify: layer.text.justify || 'top',
      onPath: !!layer.text.onPath,
      path: E.propValue(layer, 'text.path', ctx, time),
      pathAlign: layer.text.pathAlign, pathOffset: layer.text.pathOffset,
      strokeWidth: E.num(E.propValue(layer, 'text.strokeWidth', ctx, time)),
      strokeColor: U.colorArr(E.propValue(layer, 'text.strokeColor', ctx, time))
    };
    props.animators = (layer.text.animators || []).map(a => {
      const b = `anim.${a.id}.`;
      return {
        ...a,
        start: E.num(E.propValue(layer, b + 'start', ctx, time)),
        end: E.num(E.propValue(layer, b + 'end', ctx, time)),
        offset: E.num(E.propValue(layer, b + 'offset', ctx, time)),
        softness: E.num(E.propValue(layer, b + 'softness', ctx, time)),
        position: E.vec(E.propValue(layer, b + 'position', ctx, time) || [0, 0], 2).map(E.num),
        rotation: E.num(E.propValue(layer, b + 'rotation', ctx, time)),
        scale: E.num(E.propValue(layer, b + 'scale', ctx, time)),
        opacity: E.num(E.propValue(layer, b + 'opacity', ctx, time))
      };
    });
    return props;
  };
  E.textLayout = (layer, ctx, time) => T.layout(layer, E.textStyle(layer, ctx, time), ctx);
  E.textBounds = (layer, ctx, time) => {
    const lay = E.textLayout(layer, ctx, time);
    return T.layoutBounds(lay.glyphs);
  };
  E.textColor = (layer, ctx, time) => ({
    fill: U.colorArr(E.propValue(layer, 'text.fillColor', ctx, time)),
    fillOpacity: E.num(E.propValue(layer, 'text.fillOpacity', ctx, time)) / 100,
    strokeOn: !!E.propValue(layer, 'text.strokeOn', ctx, time),
    strokeColor: U.colorArr(E.propValue(layer, 'text.strokeColor', ctx, time)),
    strokeWidth: E.num(E.propValue(layer, 'text.strokeWidth', ctx, time))
  });

  // ---------- masks/effects/material ----------
  E.masks = (layer, ctx, time) => layer.masks.map(m => ({
    ...m,
    path: E.propValue(layer, `mask.${m.id}.path`, ctx, time),
    feather: E.num(E.propValue(layer, `mask.${m.id}.feather`, ctx, time)),
    opacity: E.num(E.propValue(layer, `mask.${m.id}.opacity`, ctx, time)) / 100,
    inverted: !!E.propValue(layer, `mask.${m.id}.inverted`, ctx, time),
    expansion: E.num(E.propValue(layer, `mask.${m.id}.expansion`, ctx, time)),
    mode: E.propValue(layer, `mask.${m.id}.mode`, ctx, time)
  }));
  E.effects = (layer, ctx, time) => layer.effects.filter(f => f.enabled !== false).map(fx => {
    const def = P.EFFECT_DEFS[fx.type]; if (!def) return null;
    const params = {};
    for (const p of def.params) {
      let v = E.propValue(layer, `fx.${fx.id}.${p.key}`, ctx, time);
      if (v === undefined) v = p.def;
      if (p.color) v = U.colorArr(v);
      params[p.key] = v;
    }
    return { ...fx, params };
  }).filter(Boolean);
  E.material = (layer, ctx, time) => {
    const slots = {};
    for (const slot of ['front', 'side', 'bevel']) {
      slots[slot] = {
        baseColor: U.colorArr(E.propValue(layer, `mat.${slot}.baseColor`, ctx, time)),
        metalness: E.num(E.propValue(layer, `mat.${slot}.metalness`, ctx, time)),
        roughness: E.num(E.propValue(layer, `mat.${slot}.roughness`, ctx, time)),
        emissive: E.num(E.propValue(layer, `mat.${slot}.emissive`, ctx, time)),
        emissiveColor: U.colorArr(E.propValue(layer, `mat.${slot}.emissiveColor`, ctx, time))
      };
    }
    return { slots, env: E.num(E.propValue(layer, 'mat.env', ctx, time)), reflect: E.num(E.propValue(layer, 'mat.reflect', ctx, time)), opacity: E.num(E.propValue(layer, 'mat.opacity', ctx, time)) / 100 };
  };

  // ---------- camera / light / field ----------
  E.cameraState = (comp, layer, ctx, time) => {
    const fov = E.num(E.propValue(layer, 'camera.fov', ctx, time)) || 35;
    const pos = E.vec(E.propValue(layer, 'transform.position', ctx, time), 3).map(E.num);
    let target = layer.camera.target ? layer.camera.target.slice() : [comp.width / 2, comp.height / 2, 0];
    // allow animated target via optional prop
    if (layer.props['camera.target']) target = E.vec(E.propValue(layer, 'camera.target', ctx, time), 3).map(E.num);
    let focus = E.num(E.propValue(layer, 'camera.focus', ctx, time));
    const aperture = E.num(E.propValue(layer, 'camera.aperture', ctx, time));
    const autoFocus = focus <= 0.0001;
    if (autoFocus) focus = M.dist(pos, target);
    const near = Math.max(.1, E.num(E.propValue(layer, 'camera.near', ctx, time)));
    const far = Math.max(near + 100, E.num(E.propValue(layer, 'camera.far', ctx, time)));
    return { layerId: layer.id, pos, target, fov, focus, aperture, autoFocus, near, far };
  };
  E.defaultCamera = (comp) => {
    const fov = 35;
    const dist = (comp.height / 2) / Math.tan(U.rad(fov) / 2);
    return { pos: [comp.width / 2, comp.height / 2, -dist], target: [comp.width / 2, comp.height / 2, 0], fov, focus: dist, aperture: 0, near: 1, far: 20000, default: true };
  };
  E.cameraMatrices = (cam, comp) => {
    const aspect = comp.width / comp.height;
    const view = M.lookAt(cam.pos, cam.target, cam.up || [0, -1, 0]);
    const proj = M.perspective(U.rad(cam.fov), aspect, cam.near, cam.far);
    return { view, proj, vp: M.mult(proj, view), aspect };
  };
  E.lightState = (comp, layer, ctx, time) => {
    const pos = E.vec(E.propValue(layer, 'transform.position', ctx, time), 3).map(E.num);
    const target = layer.light.target || [comp.width / 2, comp.height / 2, 0];
    const color = U.colorArr(E.propValue(layer, 'light.color', ctx, time));
    return {
      id: layer.id, name: layer.name, type: layer.light.type,
      pos, target, color,
      intensity: E.num(E.propValue(layer, 'light.intensity', ctx, time)),
      radius: E.num(E.propValue(layer, 'light.radius', ctx, time)),
      castsShadow: !!layer.light.castsShadow, enabled: !!E.propValue(layer, 'light.enabled', ctx, time),
      shadowSoft: E.num(E.propValue(layer, 'light.shadowSoft', ctx, time))
    };
  };
  E.fieldState = (comp, layer, ctx, time) => {
    const strength = E.num(E.propValue(layer, 'field.strength', ctx, time));
    const radius = E.num(E.propValue(layer, 'field.radius', ctx, time));
    const pos = E.vec(E.propValue(layer, 'transform.position', ctx, time), 3).map(E.num);
    return {
      id: layer.id, name: layer.name, layerId: layer.id,
      type: E.propValue(layer, 'field.type', ctx, time) || layer.field.type,
      axis: layer.field.axis || 'z',
      strength, radius,
      falloff: E.propValue(layer, 'field.falloff', ctx, time) || 'smooth',
      weight: E.num(E.propValue(layer, 'field.weight', ctx, time)),
      speed: E.num(E.propValue(layer, 'field.speed', ctx, time)),
      scale: E.num(E.propValue(layer, 'field.scale', ctx, time)),
      direction: E.vec(E.propValue(layer, 'field.direction', ctx, time) || [1, 0, 0], 3).map(E.num),
      color: U.colorArr(E.propValue(layer, 'field.color', ctx, time)),
      invert: !!E.propValue(layer, 'field.invert', ctx, time),
      visible: !!E.propValue(layer, 'field.visible', ctx, time),
      position: pos, layer
    };
  };
  E.fieldsFor = (comp, layer, ctx, time) => {
    const ids = (layer.geo && layer.geo.fields) || (layer.particles && layer.particles.fields) || [];
    return ids.map(id => comp.layers.find(l => l.id === id && l.type === 'field')).filter(Boolean).map(l => E.fieldState(comp, l, ctx, time));
  };

  // ---------- comp eval ----------
  E.compState = (comp, time, ctx) => {
    const state = { comp, time, layers: [], cameras: [], lights: [], fields: [], map: new Map() };
    for (const layer of comp.layers) {
      const active = E.isActive(comp, layer, time);
      const ls = {
        layer, active,
        opacity: E.layerOpacity(layer, ctx, time),
        blendMode: layer.blendMode,
        matrix: null, affine: null
      };
      if (active) {
        if (layer.type === 'shape' || layer.type === 'text' || layer.type === 'solid' || (layer.type === 'precomp' && layer.precomp.mode === 'flat') || layer.type === 'adjustment' || layer.type === 'null') {
          ls.affine = E.worldAffine(comp, layer, ctx, time);
          ls.matrix = E.worldMatrix(comp, layer, ctx, time);
        } else {
          ls.matrix = E.worldMatrix(comp, layer, ctx, time);
        }
      }
      state.layers.push(ls);
      state.map.set(layer.id, ls);
      if (layer.type === 'camera' && layer.visible) state.cameras.push(layer);
      if (layer.type === 'light' && active) state.lights.push(E.lightState(comp, layer, ctx, time));
      if (layer.type === 'field' && active) state.fields.push(E.fieldState(comp, layer, ctx, time));
    }
    return state;
  };
  E.activeCameraState = (comp, ctx, time) => {
    const camLayer = P.activeCamera(comp);
    if (camLayer && E.isActive(comp, camLayer, time)) return E.cameraState(comp, camLayer, ctx, time);
    return E.defaultCamera(comp);
  };

  // ---------- bounds for overlay/hit ----------
  E.layerBounds = (comp, layer, time, project, ctx) => {
    ctx = ctx || E.makeCtx(project, comp, time);
    const st = E.compState(comp, time, ctx);
    if (layer.type === 'shape') {
      const b = E.shapeBounds(layer, ctx, time);
      const ls = st.map.get(layer.id);
      const aff = ls && ls.affine ? ls.affine : E.worldAffine(comp, layer, ctx, time);
      const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(p => U.affine.apply(aff, p[0], p[1]));
      return polyBounds(corners);
    }
    if (layer.type === 'text') {
      const b = E.textBounds(layer, ctx, time);
      const aff = E.worldAffine(comp, layer, ctx, time);
      const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(p => U.affine.apply(aff, p[0], p[1]));
      return polyBounds(corners);
    }
    if (layer.type === 'solid') {
      const aff = E.worldAffine(comp, layer, ctx, time);
      const corners = [[-comp.width / 2, -comp.height / 2], [comp.width / 2, -comp.height / 2], [comp.width / 2, comp.height / 2], [-comp.width / 2, comp.height / 2]].map(p => U.affine.apply(aff, p[0], p[1]));
      return polyBounds(corners);
    }
    if (layer.type === 'precomp' && layer.precomp.mode === 'flat') {
      const aff = E.worldAffine(comp, layer, ctx, time);
      const corners = [[-comp.width / 2, -comp.height / 2], [comp.width / 2, -comp.height / 2], [comp.width / 2, comp.height / 2], [-comp.width / 2, comp.height / 2]].map(p => U.affine.apply(aff, p[0], p[1]));
      return polyBounds(corners);
    }
    if (layer.type === 'adjustment') {
      return { x: 0, y: 0, w: comp.width, h: comp.height };
    }
    return { x: comp.width / 2 - 40, y: comp.height / 2 - 40, w: 80, h: 80 };
  };
  function polyBounds(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  E.layerCorners = (comp, layer, time, project, ctx) => {
    ctx = ctx || E.makeCtx(project, comp, time);
    const b = E.layerBounds(comp, layer, time, project, ctx);
    const aff = layer.threeD ? null : E.worldAffine(comp, layer, ctx, time);
    if (aff) return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(p => U.affine.apply(aff, p[0], p[1]));
    return null;
  };

  E.seed = (ctx, layer, extra) => (ctx.project.seed || 0) ^ U.hash(layer.id + '|' + extra);
  AE.Eval = E;
})();
