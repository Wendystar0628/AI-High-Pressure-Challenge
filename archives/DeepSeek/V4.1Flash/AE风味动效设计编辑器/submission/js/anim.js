/* ============================================================
   anim.js — 属性、关键帧、插值、变换矩阵、表达式求值入口
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim = {};

  let PROP_ID = 1;
  const CACHE = new Map();
  A.cacheStats = { hit: 0, miss: 0 };
  A.version = 0;

  A.clearCache = function () { CACHE.clear(); A.version++; };
  A.clearExprErrors = function () {};

  // ---------------- 属性构造 ----------------
  A.prop = function (value, opts) {
    opts = opts || {};
    return {
      _id: PROP_ID++,
      value: value,
      type: opts.type || (typeof value === 'number' ? 'number' : (Array.isArray(value) ? 'vec' : 'number')),
      keyframes: null,
      expression: '',
      exprError: null,
      unit: opts.unit || '',
      label: opts.label || '',
      min: opts.min, max: opts.max, step: opts.step,
      default: opts.default !== undefined ? opts.default : U.deepClone(value),
      _cacheVersion: -1,
      _cachedT: -1e9, _cachedV: null
    };
  };
  A.vec = function (x, y, z) { return A.prop({ x: x || 0, y: y || 0, z: z || 0 }, { type: 'vec' }); };
  A.num = function (v, opts) { return A.prop(v || 0, Object.assign({ type: 'number' }, opts)); };
  A.isAnimated = function (p) { return !!(p && p.keyframes && p.keyframes.length); };
  A.hasExpr = function (p) { return !!(p && p.expression && p.expression.trim()); };

  A.propValue = function (p) {
    if (!p) return 0;
    return p.value;
  };

  // 数值转换
  A.n = function (v) {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (Array.isArray(v)) return v[0] || 0;
    if (typeof v === 'object') {
      if (v.__num !== undefined) return +v.__num;
      if ('x' in v) return v.x;
      if ('value' in v && typeof v.value === 'number') return v.value;
    }
    const n = Number(v);
    return isFinite(n) ? n : 0;
  };
  A.vec3 = function (v) {
    if (v == null) return { x: 0, y: 0, z: 0 };
    if (typeof v === 'number') return { x: v, y: v, z: v };
    if (Array.isArray(v)) return { x: +v[0] || 0, y: +v[1] || 0, z: +(v[2] || 0) };
    return { x: +v.x || 0, y: +v.y || 0, z: +(v.z || 0) };
  };
  A.cloneVal = function (v, type) {
    if (type === 'vec' || Array.isArray(v) || (v && typeof v === 'object' && 'x' in v)) {
      const p = A.vec3(v); return { x: p.x, y: p.y, z: p.z };
    }
    return v;
  };

  // ---------------- 关键帧 ----------------
  const DEF_IN = () => ({ x: 1 / 3, y: 1 / 3 });
  const DEF_OUT = () => ({ x: 1 / 3, y: 1 / 3 });
  A.makeKeyframe = function (t, v, spatial) {
    const vv = (v && typeof v === 'object') ? U.deepClone(v) : v;
    return {
      t: +t,
      v: vv,
      in: DEF_IN(), out: DEF_OUT(),
      inType: 'bezier', outType: 'bezier',
      sIn: spatial ? U.deepClone(spatial) : { x: 0, y: 0, z: 0 },
      sOut: spatial ? U.deepClone(spatial) : { x: 0, y: 0, z: 0 },
      selected: false
    };
  };
  A.sortKeys = function (p) { if (p.keyframes) p.keyframes.sort((a, b) => a.t - b.t); };
  A.keyAt = function (p, t, eps) {
    if (!p.keyframes) return null;
    eps = eps === undefined ? 1e-4 : eps;
    for (const k of p.keyframes) if (Math.abs(k.t - t) <= eps) return k;
    return null;
  };
  A.addKey = function (p, t, v, opts) {
    opts = opts || {};
    if (!p.keyframes) p.keyframes = [];
    let k = A.keyAt(p, t);
    if (k) {
      k.v = A.cloneVal(v, p.type);
    } else {
      k = A.makeKeyframe(t, v, p.type === 'vec');
      p.keyframes.push(k);
      A.sortKeys(p);
    }
    p._cacheVersion = -1;
    if (opts.ease) A.setKeyEase(k, opts.ease);
    A.clearCache();
    return k;
  };
  A.removeKey = function (p, k) {
    if (!p.keyframes) return;
    const i = p.keyframes.indexOf(k);
    if (i >= 0) p.keyframes.splice(i, 1);
    if (p.keyframes.length === 0) p.keyframes = null;
    A.clearCache();
  };
  A.removeKeyAt = function (p, t) {
    const k = A.keyAt(p, t);
    if (k) A.removeKey(p, k);
  };
  A.setKeyEase = function (k, mode) {
    if (mode === 'linear') {
      k.in = { x: 1 / 3, y: 1 / 3 }; k.out = { x: 1 / 3, y: 1 / 3 };
      k.inType = 'linear'; k.outType = 'linear';
    } else if (mode === 'hold') {
      k.outType = 'hold';
    } else { // ease / bezier
      k.in = { x: 0.5, y: 0 }; k.out = { x: 0.5, y: 0 };
      k.inType = 'bezier'; k.outType = 'bezier';
    }
    A.clearCache();
  };
  A.toggleStopwatch = function (p, t, currentValue) {
    if (A.isAnimated(p)) {
      // 关闭动画 -> 保留当前值
      const k = A.keyAt(p, t);
      const v = k ? U.deepClone(k.v) : (p.keyframes && p.keyframes.length ? A.rawAt(p, t) : p.value);
      p.value = A.cloneVal(v, p.type);
      p.keyframes = null;
    } else {
      p.keyframes = [A.makeKeyframe(t, currentValue !== undefined ? currentValue : p.value, p.type === 'vec')];
      p.value = A.cloneVal(currentValue !== undefined ? currentValue : p.value, p.type);
    }
    A.clearCache();
    return A.isAnimated(p);
  };
  A.frameT = function (t, fps) { return Math.round(t * fps) / fps; };

  // 求原始值（无表达式）
  A.rawAt = function (p, t) {
    if (!p) return 0;
    const ks = p.keyframes;
    if (!ks || !ks.length) return p.value;
    if (ks.length === 1) return ks[0].v;
    if (t <= ks[0].t) return ks[0].v;
    if (t >= ks[ks.length - 1].t) return ks[ks.length - 1].v;
    let i = 0;
    // 二分找区间
    let lo = 0, hi = ks.length - 1;
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (ks[mid].t <= t) lo = mid; else hi = mid; }
    i = lo;
    const k0 = ks[i], k1 = ks[i + 1];
    if (!k1) return k0.v;
    if (k0.outType === 'hold' || k1.inType === 'hold') return k0.v;
    const dt = k1.t - k0.t;
    let u = dt <= 1e-9 ? 1 : (t - k0.t) / dt;
    const useEase = k0.outType !== 'linear' || k1.inType !== 'linear';
    let ue = u;
    if (useEase) {
      const h0 = (k0.outType === 'linear') ? { x: 1 / 3, y: 1 / 3 } : k0.out;
      const h1 = (k1.inType === 'linear') ? { x: 1 / 3, y: 1 / 3 } : k1.in;
      ue = U.easeCurve(
        U.clamp(h0.x, 0.001, 0.999), h0.y,
        U.clamp(1 - h1.x, 0.001, 0.999), 1 - h1.y
      )(u);
    }
    // 空间路径（位置）
    if (p.type === 'vec' && (k0.sOut || k1.sIn) && (U.vlen(k0.sOut || {}) > 1e-4 || U.vlen(k1.sIn || {}) > 1e-4)) {
      const p0 = A.vec3(k0.v), p3 = A.vec3(k1.v);
      const p1 = U.vadd(p0, A.vec3(k0.sOut));
      const p2 = U.vsub(p3, A.vec3(k1.sIn));
      const lut = U.arcLengthLUT(p0, p1, p2, p3, 32);
      const pt = U.bezierAtLength(p0, p1, p2, p3, lut, ue * lut.length);
      return { x: pt.x, y: pt.y, z: pt.z };
    }
    if (p.type === 'color') {
      const c0 = U.hexToRgb(k0.v), c1 = U.hexToRgb(k1.v);
      return U.rgbToHex(U.lerp(c0.r, c1.r, ue), U.lerp(c0.g, c1.g, ue), U.lerp(c0.b, c1.b, ue));
    }
    if (p.type === 'vec') {
      const a = A.vec3(k0.v), b = A.vec3(k1.v);
      return { x: U.lerp(a.x, b.x, ue), y: U.lerp(a.y, b.y, ue), z: U.lerp(a.z, b.z, ue) };
    }
    return U.lerp(A.n(k0.v), A.n(k1.v), ue);
  };

  // 时间求值上下文
  A.newCtx = function (comp, layer, time) {
    return { comp: comp, layer: layer, time: time, stack: [], cache: null, depth: 0, queried: time };
  };

  // 求值（含表达式）
  A.sample = function (p, t, layer, ctx) {
    if (!p) return 0;
    if (!ctx) {
      ctx = { comp: layer && layer._comp, layer: layer, time: t, stack: [], depth: 0 };
    }
    ctx.depth = ctx.depth || 0;
    const base = A.rawAt(p, t);
    if (!A.hasExpr(p)) return base;
    const key = p._id + '@' + (+t).toFixed(6);
    if (ctx.stack.indexOf(key) >= 0) {
      p.exprError = '循环引用：表达式引用回自身（' + (p.label || '属性') + '）';
      return base;
    }
    if (ctx.depth > 24) {
      p.exprError = '引用层级过深，已退回关键帧值';
      return base;
    }
    if (CACHE.has(key)) {
      A.cacheStats.hit++;
      const hit = CACHE.get(key);
      if (hit.err) { p.exprError = hit.err; if (hit.fallback !== undefined) return hit.fallback; }
      if (hit.value !== undefined) { p.exprError = null; return A.cloneVal(hit.value, p.type); }
    }
    A.cacheStats.miss++;
    ctx.stack.push(key);
    ctx.depth++;
    let val, err = null;
    try {
      if (!AE.expr) throw new Error('表达式引擎未载入');
      val = AE.expr.evaluate(p, t, layer, ctx, base);
      if (val === undefined) val = base;
      val = A.coerceResult(val, p, base);
    } catch (e) {
      err = String(e && e.message ? e.message : e);
      val = base;
    }
    ctx.depth--;
    ctx.stack.pop();
    p.exprError = err;
    CACHE.set(key, { value: err ? undefined : A.cloneVal(val, p.type), err: err, fallback: err ? A.cloneVal(base, p.type) : undefined });
    if (CACHE.size > 6000) { const it = CACHE.keys(); for (let i = 0; i < 2000; i++) { const k = it.next(); if (k.done) break; CACHE.delete(k.value); } }
    return val;
  };

  A.coerceResult = function (v, p, fallback) {
    if (p.type === 'number') {
      const n = A.n(v);
      return isFinite(n) ? n : A.n(fallback);
    }
    if (p.type === 'vec') {
      if (typeof v === 'number') return { x: v, y: v, z: v };
      if (Array.isArray(v)) {
        return { x: A.n(v[0]), y: A.n(v[1] !== undefined ? v[1] : v[0]), z: A.n(v[2] !== undefined ? v[2] : 0) };
      }
      if (v && typeof v === 'object') return { x: A.n(v.x), y: A.n(v.y !== undefined ? v.y : v.x), z: A.n(v.z !== undefined ? v.z : 0) };
      return A.vec3(fallback);
    }
    if (p.type === 'color') {
      if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) return v;
      if (Array.isArray(v)) return U.rgbToHex(A.n(v[0]) * 255, A.n(v[1]) * 255, A.n(v[2]) * 255);
      return fallback;
    }
    return v;
  };

  // UI 便捷求值
  A.valueAt = function (p, t, layer) {
    return A.sample(p, t, layer, A.newCtx(layer && layer._comp, layer, t));
  };

  // 关键帧时间集合
  A.keyTimes = function (p) { return (p.keyframes || []).map(k => k.t); };
  A.nearestKey = function (p, t, dir) {
    const ks = p.keyframes || [];
    if (!ks.length) return null;
    if (dir > 0) {
      for (const k of ks) if (k.t > t + 1e-4) return k;
      return null;
    } else if (dir < 0) {
      for (let i = ks.length - 1; i >= 0; i--) if (ks[i].t < t - 1e-4) return ks[i];
      return null;
    }
    let best = ks[0], bd = Infinity;
    for (const k of ks) { const d = Math.abs(k.t - t); if (d < bd) { bd = d; best = k; } }
    return best;
  };

  // ---------------- 变换 ----------------
  A.getTransform = function (layer) {
    const d = layer.defaults && layer.defaults.transform;
    const t = layer.transform;
    return t;
  };
  A.TRANSFORM_PROPS = ['anchor', 'position', 'scale', 'rotation', 'rotationX', 'rotationY', 'opacity'];

  A.is3D = function (layer) {
    return !!(layer.threeD || layer.type === 'camera' || layer.type === 'light' ||
      layer.type === 'particle' || layer.type === 'field' ||
      (layer.extrude && layer.extrude.enabled) ||
      (layer.type === 'shape' && layer.extrude && layer.extrude.enabled) ||
      (layer.type === 'text' && layer.extrude && layer.extrude.enabled) ||
      layer.type === 'node3d');
  };

  A.sampleTransform = function (layer, t, ctx) {
    const tr = layer.transform;
    const c = ctx || A.newCtx(layer._comp, layer, t);
    const anchor = A.vec3(A.sample(tr.anchor, t, layer, c));
    const pos = A.sample(tr.position, t, layer, c);
    let position = typeof pos === 'number' ? { x: pos, y: 0, z: 0 } : A.vec3(pos);
    const sc = A.sample(tr.scale, t, layer, c);
    let scale = A.vec3(sc);
    if (layer.scaleFrom2D && !A.is3D(layer)) { scale.z = 1; }
    const rotation = A.n(A.sample(tr.rotation, t, layer, c));
    const rotationX = A.n(A.sample(tr.rotationX, t, layer, c));
    const rotationY = A.n(A.sample(tr.rotationY, t, layer, c));
    const opacity = U.clamp(A.n(A.sample(tr.opacity, t, layer, c)), 0, 100);
    return { anchor, position, scale, rotation, rotationX, rotationY, opacity };
  };

  A.localMatrix = function (layer, tr) {
    let m = U.m4.translation(tr.position.x, tr.position.y, tr.position.z || 0);
    m = U.m4.mul(m, U.m4.euler(tr.rotationX * U.DEG, tr.rotationY * U.DEG, tr.rotation * U.DEG));
    m = U.m4.mul(m, U.m4.scaling(tr.scale.x / 100, tr.scale.y / 100, (tr.scale.z === undefined ? 1 : tr.scale.z) / 100));
    m = U.m4.mul(m, U.m4.translation(-tr.anchor.x, -tr.anchor.y, -(tr.anchor.z || 0)));
    return m;
  };

  A.getParent = function (layer, comp) {
    if (!layer.parentId) return null;
    comp = comp || layer._comp;
    if (!comp) return null;
    return comp.layers.find(l => l.id === layer.parentId) || null;
  };

  A.worldMatrix = function (layer, t, ctx, guard) {
    const tr = A.sampleTransform(layer, t, ctx);
    let m = A.localMatrix(layer, tr);
    guard = guard || {};
    if (guard[layer.id]) return m;
    guard[layer.id] = 1;
    const parent = A.getParent(layer, ctx && ctx.comp);
    if (parent && !parent._hidden) {
      const pm = A.worldMatrix(parent, t, ctx, guard);
      m = U.m4.mul(pm, m);
    }
    return m;
  };

  A.worldMatrixAt = function (layer, t) {
    return A.worldMatrix(layer, t, A.newCtx(layer._comp, layer, t));
  };

  // 2D 仿射矩阵（Canvas / 着色器）
  A.matrix2D = function (m) {
    return {
      a: m[0], b: m[1], c: m[4], d: m[5],
      e: m[12], f: m[13]
    };
  };
  A.invert2D = function (M) {
    const det = M.a * M.d - M.b * M.c || 1e-9;
    return {
      a: M.d / det, b: -M.b / det, c: -M.c / det, d: M.a / det,
      e: (M.c * M.f - M.d * M.e) / det,
      f: (M.b * M.e - M.a * M.f) / det
    };
  };

  // 改变锚点但保持画面位置
  A.setAnchorPreserving = function (layer, newAnchor, t) {
    t = t === undefined ? (AE.app ? AE.app.time : 0) : t;
    const comp = layer._comp;
    const ctx = A.newCtx(comp, layer, t);
    const world = A.worldMatrix(layer, t, ctx);
    const oldAnchor = A.vec3(A.sample(layer.transform.anchor, t, layer, ctx));
    const P = U.m4.applyPoint(world, oldAnchor);
    const parent = A.getParent(layer, comp);
    let parentM = U.m4.identity();
    if (parent) parentM = A.worldMatrix(parent, t, A.newCtx(comp, parent, t));
    const localPos = U.m4.applyPoint(U.m4.invert(parentM), P);
    // 先设置锚点
    A.setPropAt(layer.transform.anchor, t, layer, newAnchor);
    A.setPropAt(layer.transform.position, t, layer, { x: localPos.x, y: localPos.y, z: localPos.z });
    A.clearCache();
  };

  // 设置父级但保持画面位置
  A.setParentPreserving = function (layer, newParentId, t) {
    t = t === undefined ? (AE.app ? AE.app.time : 0) : t;
    const comp = layer._comp;
    const ctx = A.newCtx(comp, layer, t);
    const world = A.worldMatrix(layer, t, ctx);
    layer.parentId = newParentId || null;
    const parent = A.getParent(layer, comp);
    let parentM = U.m4.identity();
    if (parent) parentM = A.worldMatrix(parent, t, A.newCtx(comp, parent, t));
    const local = U.m4.mul(U.m4.invert(parentM), world);
    const anchor = A.vec3(A.sample(layer.transform.anchor, t, layer, ctx));
    const position = U.m4.applyPoint(local, anchor);
    const d = U.m4.decompose(local);
    const tr = layer.transform;
    A.setPropAt(tr.position, t, layer, position);
    A.setPropAt(tr.scale, t, layer, d.scale);
    A.setPropAt(tr.rotation, t, layer, d.rotation.z * U.RAD);
    if (A.is3D(layer)) {
      A.setPropAt(tr.rotationX, t, layer, d.rotation.x * U.RAD);
      A.setPropAt(tr.rotationY, t, layer, d.rotation.y * U.RAD);
    }
    A.clearCache();
  };

  // 设置属性（动画则写关键帧）
  A.setPropAt = function (p, t, layer, value, opts) {
    if (A.isAnimated(p)) {
      return A.addKey(p, t, value, opts);
    }
    p.value = A.cloneVal(value, p.type);
    A.clearCache();
    return null;
  };

  // 表达式属性访问
  A.propPathRegistry = function (layer) {
    return {
      'transform.anchorPoint': layer.transform.anchor,
      'transform.position': layer.transform.position,
      'transform.scale': layer.transform.scale,
      'transform.rotation': layer.transform.rotation,
      'transform.rotationX': layer.transform.rotationX,
      'transform.rotationY': layer.transform.rotationY,
      'transform.opacity': layer.transform.opacity
    };
  };
  A.getPropByPath = function (layer, path) {
    if (!layer || !path) return null;
    if (path === 'anchorPoint') return layer.transform.anchor;
    const reg = A.propPathRegistry(layer);
    if (reg[path]) return reg[path];
    if (path.startsWith('transform.')) {
      const k = path.slice(10);
      return reg['transform.' + k] || null;
    }
    if (path.startsWith('fx.')) {
      const [, fxId, pid] = path.split('.');
      const fx = (layer.effects || []).find(f => f.id === fxId);
      if (fx) return fx.params[pid];
    }
    if (path.startsWith('mask.')) {
      const [, mid, pid] = path.split('.');
      const mk = (layer.masks || []).find(f => f.id === mid);
      if (mk) return mk[pid];
    }
    return null;
  };
  A.propPathLabel = function (layer, path) {
    const map = {
      'transform.anchor': '锚点', 'anchorPoint': '锚点',
      'transform.position': '位置', 'transform.scale': '缩放',
      'transform.rotation': '旋转', 'transform.rotationX': 'X 旋转', 'transform.rotationY': 'Y 旋转',
      'transform.opacity': '不透明度'
    };
    return map[path] || path;
  };

  // 速度（数值微分，用于速度曲线）
  A.velocity = function (p, t, layer) {
    const dt = 1 / 240;
    const a = A.valueAt(p, t - dt, layer);
    const b = A.valueAt(p, t + dt, layer);
    if (p.type === 'vec') {
      const va = A.vec3(a), vb = A.vec3(b);
      return { x: (vb.x - va.x) / (2 * dt), y: (vb.y - va.y) / (2 * dt), z: (vb.z - va.z) / (2 * dt),
               speed: Math.hypot(vb.x - va.x, vb.y - va.y, vb.z - va.z) / (2 * dt) };
    }
    return (A.n(b) - A.n(a)) / (2 * dt);
  };

  // 采样一条曲线（用于曲线视图）
  A.sampleCurve = function (p, t0, t1, n, layer, mode) {
    const arr = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * i / n;
      if (mode === 'speed') {
        const v = A.velocity(p, t, layer);
        arr.push(p.type === 'vec' ? v.speed : Math.abs(v));
      } else {
        const v = A.valueAt(p, t, layer);
        arr.push(p.type === 'vec' ? v.x : A.n(v));
      }
    }
    return arr;
  };

})(window);
