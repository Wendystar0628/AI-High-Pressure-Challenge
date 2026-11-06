// 求值：属性（关键帧 + 表达式 + 实例覆盖）、图层变换与父级链、预合成时间映射
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, M4 = U.M4, A = AE.Anim, X = AE.Expr, Mdl = AE.Model;
  const E = AE.Eval = { rev: 1, project: null };
  E.bump = () => { E.rev++; };

  // ---------- 索引 ----------
  let indexedRev = -1;
  E.index = (proj) => {
    if (indexedRev === E.rev && E.project === proj) return;
    E.project = proj; indexedRev = E.rev;
    proj._compById = new Map(proj.comps.map(c => [c.id, c]));
    proj._compByName = new Map(proj.comps.map(c => [c.name, c]));
    for (const c of proj.comps) {
      c._byId = new Map(); c._byName = new Map();
      c.layers.forEach((l, i) => {
        c._byId.set(l.id, l); if (!c._byName.has(l.name)) c._byName.set(l.name, l);
        l._comp = c; l._index = i + 1;
        Mdl.eachProp(l, (p, path) => { p._path = path; p._lid = l.id; p._layer = l; });
      });
      for (const n of c.graph.nodes) Mdl.eachProp(n.params, (p, path) => { p._path = 'node.' + n.id + '.' + path; p._lid = 'graph'; p._layer = null; p._node = n; p._comp = c; });
    }
  };
  E.comp = (id) => {
    const app = AE.App && AE.App.proj;
    if (app && E.project !== app) E.index(app);
    return (E.project && E.project._compById && E.project._compById.get(id)) || (E.project && E.project.comps.find(c => c.id === id));
  };
  E.layer = (comp, id) => (comp._byId && comp._byId.get(id)) || comp.layers.find(l => l.id === id);

  // ---------- 实例上下文 ----------
  // ctx: {comp, inst:{key, ovr:Map, outerT, parent}, time?}
  const rootCache = new Map();
  E.root = (comp) => {
    let c = rootCache.get(comp.id);
    if (!c || c.comp !== comp) { c = { comp, inst: { key: comp.id, ovr: null, outerT: 0, parent: null, depth: 0 } }; rootCache.set(comp.id, c); }
    return c;
  };
  const instCache = new Map(); let instRev = -1;
  E.child = (ctx, layer, outerT) => {
    if (instRev !== E.rev) { instCache.clear(); instRev = E.rev; }
    const src = E.comp(layer.precomp.source);
    if (!src) return null;
    const key = ctx.inst.key + '/' + layer.id;
    const ck = key + '@' + outerT;
    let c = instCache.get(ck);
    if (c) return c;
    let ovr = null;
    const ov = layer.precomp.overrides || {};
    for (const prm of src.params || []) {
      const o = ov[prm.id];
      if (o && o.on !== false && o.prop) { if (!ovr) ovr = new Map(); ovr.set(prm.layer + '|' + prm.path, { prop: o.prop, ctx, layer }); }
    }
    // 继承外层覆盖（多层嵌套逐层对应）
    c = { comp: src, inst: { key, ovr, outerT, parent: ctx.inst, parentCtx: ctx, layer, depth: ctx.inst.depth + 1 } };
    if (instCache.size > 5000) instCache.clear();
    instCache.set(ck, c);
    return c;
  };
  // 预合成内部时刻
  E.innerTime = (layer, t, ctx) => {
    const pc = layer.precomp, src = E.comp(pc.source);
    if (pc.remapOn) return E.prop(pc.remap, t, ctx, layer);
    const sp = (pc.speed === undefined ? 100 : pc.speed) / 100;
    if (sp < 0) return (src ? src.duration : 0) + (t - layer.startTime) * sp;
    return (t - layer.startTime) * sp;
  };

  // ---------- 属性求值 ----------
  const stack = [];
  class CycleError extends Error { constructor(msg, origin) { super(msg); this.cycle = true; this.origin = origin; } }
  E.raw = (prop, t) => A.valueAt(prop, t);
  E.prop = (prop, t, ctx, layer) => {
    const inst = ctx.inst;
    if (inst.ovr && prop._lid) {
      const o = inst.ovr.get(prop._lid + '|' + prop._path);
      if (o) return E.prop(o.prop, inst.outerT, o.ctx, o.layer);
    }
    const c = prop._c;
    if (c && c.rev === E.rev && c.t === t && c.inst === inst) return c.v;
    let v = A.valueAt(prop, t);
    if (prop.exprOn && prop.expr) v = runExpr(prop, v, t, ctx, layer || prop._layer);
    prop._c = { rev: E.rev, t, inst, v };
    return v;
  };
  E.propRaw = (prop, t, ctx) => { // 覆盖后但不含表达式
    const inst = ctx.inst;
    if (inst.ovr && prop._lid) { const o = inst.ovr.get(prop._lid + '|' + prop._path); if (o) return E.prop(o.prop, inst.outerT, o.ctx, o.layer); }
    return A.valueAt(prop, t);
  };
  function runExpr(prop, base, t, ctx, layer) {
    const comp = ctx.comp;
    const c = X.compile(prop.expr);
    if (c.error) { prop._err = c.error; return base; }
    for (const s of stack) if (s.p === prop && s.inst === ctx.inst) {
      const names = stack.slice(stack.indexOf(s)).map(e => (e.p._layer ? e.p._layer.name + '.' : '') + e.p._path).concat([(prop._layer ? prop._layer.name + '.' : '') + prop._path]);
      throw new CycleError('循环引用：' + names.join(' → '), prop);
    }
    stack.push({ p: prop, inst: ctx.inst });
    try {
      const env = E.env(prop, base, t, ctx, layer, null);
      let r = X.rt.$v(c.fn.apply(null, env));
      r = coerce(r, base);
      if (r === undefined) throw new Error('表达式没有返回值');
      prop._err = null;
      return r;
    } catch (e) {
      prop._err = e.cycle ? e.message : ('运行错误：' + e.message);
      if (e.cycle && e.origin !== prop) throw e;
      return base;
    } finally { stack.pop(); }
  }
  function coerce(r, base) {
    if (r && r.__prop) r = r.value;
    if (typeof base === 'number') { if (Array.isArray(r)) r = r[0]; if (typeof r !== 'number' || !isFinite(r)) throw new Error('结果应为数值'); return r; }
    if (Array.isArray(base) && typeof base[0] === 'number') {
      if (typeof r === 'number') return base.map(() => r);
      if (!Array.isArray(r)) throw new Error('结果应为数组');
      const out = base.slice(); for (let i = 0; i < out.length; i++) if (typeof r[i] === 'number' && isFinite(r[i])) out[i] = r[i];
      return out;
    }
    if (typeof base === 'string') return String(r);
    return r;
  }

  // ---------- 表达式环境 ----------
  class PropRef {
    constructor(prop, layer, ctx, t, self) { this.prop = prop; this.layer = layer; this.ctx = ctx; this.t = t; this.self = self; this.__prop = true; }
    get value() { return this.self ? A.valueAt(this.prop, this.t) : E.prop(this.prop, this.t, this.ctx, this.layer); }
    valueOf() { const v = this.value; return Array.isArray(v) ? v[0] : v; }
    toString() { return String(this.value); }
    valueAtTime(t) { t = X.rt.$v(t); return this.self ? E.propRaw(this.prop, t, this.ctx) : E.prop(this.prop, t, this.ctx, this.layer); }
    velocityAtTime(t) { const d = 1 / 240; return X.rt.$div(X.rt.$sub(this.valueAtTime(t + d), this.valueAtTime(t - d)), 2 * d); }
    get velocity() { return this.velocityAtTime(this.t); }
    get speed() { const v = this.velocity; return Array.isArray(v) ? U.len(v) : Math.abs(v); }
    get numKeys() { return this.prop.anim ? this.prop.keys.length : 0; }
    key(i) { const k = this.prop.keys[i - 1]; return k ? { time: k.t, value: k.v, index: i } : null; }
    nearestKey(t) { let best = null, bd = Infinity; this.prop.keys.forEach((k, i) => { const d = Math.abs(k.t - t); if (d < bd) { bd = d; best = { time: k.t, value: k.v, index: i + 1 }; } }); return best; }
    get length() { const v = this.value; return Array.isArray(v) ? v.length : 1; }
  }
  E.PropRef = PropRef;
  function layerRef(layer, ctx, t) {
    if (!layer) throw new Error('找不到图层');
    const P = (prop) => prop ? new PropRef(prop, layer, ctx, t) : undefined;
    const tf = layer.transform;
    const transform = { position: P(tf.position), scale: P(tf.scale), rotation: P(tf.rotation), zRotation: P(tf.rotation), xRotation: P(tf.rotX), yRotation: P(tf.rotY), opacity: P(tf.opacity), anchorPoint: P(tf.anchor) };
    const ref = {
      name: layer.name, index: layer._index, inPoint: layer.inPoint, outPoint: layer.outPoint, startTime: layer.startTime,
      transform, position: transform.position, scale: transform.scale, rotation: transform.rotation, opacity: transform.opacity, anchorPoint: transform.anchorPoint,
      toWorld: (p, tt) => M4.apply(E.world(layer, tt === undefined ? t : X.rt.$v(tt), ctx), X.rt.$v(p)),
      fromWorld: (p, tt) => M4.apply(M4.inv(E.world(layer, tt === undefined ? t : X.rt.$v(tt), ctx)), X.rt.$v(p)),
      toComp: (p, tt) => ref.toWorld(p, tt), fromComp: (p, tt) => ref.fromWorld(p, tt),
      effect: (name) => {
        const fx = layer.effects.find(e => e.name === name || e.type === name) || (typeof name === 'number' ? layer.effects[name - 1] : null);
        if (!fx) throw new Error('找不到效果 “' + name + '”');
        const f = (pn) => { const key = Object.keys(fx.p).find(k => k === pn || Mdl.label(k) === pn); if (!key) throw new Error('效果中没有参数 “' + pn + '”'); return P(fx.p[key]); };
        for (const k in fx.p) { f[k] = P(fx.p[k]); f[Mdl.label(k)] = f[k]; }
        return f;
      },
      prop: (path) => { const p = Mdl.getPath(layer, path); if (!Mdl.isProp(p)) throw new Error('属性路径无效 “' + path + '”'); return P(p); },
      content: (name) => contentRef(layer, layer.content || [], name, ctx, t),
      text: layer.text ? { sourceText: P(layer.text.source), fontSize: P(layer.text.size) } : undefined,
      pointOfInterest: layer.camera ? P(layer.camera.poi) : layer.light ? P(layer.light.poi) : undefined,
      zoom: layer.camera ? P(layer.camera.zoom) : undefined, focusDistance: layer.camera ? P(layer.camera.focus) : undefined, aperture: layer.camera ? P(layer.camera.aperture) : undefined,
      intensity: layer.light ? P(layer.light.intensity) : undefined, color: layer.light ? P(layer.light.color) : undefined,
      timeRemap: layer.precomp ? P(layer.precomp.remap) : undefined,
    };
    return ref;
  }
  function contentRef(layer, items, name, ctx, t) {
    const it = items.find(i => i.name === name) || (typeof name === 'number' ? items[name - 1] : null);
    if (!it) throw new Error('找不到内容 “' + name + '”');
    const f = (n) => contentRef(layer, it.items || [], n, ctx, t);
    for (const k in it) { if (Mdl.isProp(it[k])) f[k] = new PropRef(it[k], layer, ctx, t); }
    if (it.transform) { f.transform = {}; for (const k in it.transform) f.transform[k] = new PropRef(it.transform[k], layer, ctx, t); }
    f.content = f;
    return f;
  }
  function compRef(comp, ctx, t) {
    return {
      name: comp.name, width: comp.width, height: comp.height, duration: comp.duration, frameDuration: 1 / comp.fps, numLayers: comp.layers.length,
      layer: (n) => {
        n = X.rt.$v(n);
        const l = typeof n === 'number' ? comp.layers[n - 1] : (comp._byName && comp._byName.get(n)) || comp.layers.find(l => l.name === n);
        if (!l) throw new Error('找不到图层 “' + n + '”');
        return layerRef(l, ctx, t);
      },
      marker: { key: (i) => { const m = comp.markers[i - 1]; return m ? { time: m.t, comment: m.label } : null; }, numKeys: comp.markers.length },
    };
  }
  // 扩展变量（粒子 / 节点逐元素）
  E.env = (prop, base, t, ctx, layer, extra) => {
    const comp = ctx.comp, R = X.rt;
    const seedBase = (E.project ? E.project.seed : 0) + ':' + (layer ? layer.id : 'g') + ':' + (prop ? prop._path : '');
    let rngSeed = seedBase, timeless = false, rcount = 0;
    const rnd = () => { rcount++; return U.hash(rngSeed, timeless ? 0 : Math.round(t * 600), rcount); };
    const thisLayer = layer ? layerRef(layer, ctx, t) : null;
    const thisProp = prop ? new PropRef(prop, layer, ctx, t, true) : null;
    const keys = prop ? prop.keys : [];
    const kv = (tt) => prop ? E.propRaw(prop, tt, ctx) : base;
    const loop = (type, n, isOut) => {
      type = type || 'cycle';
      if (!prop || !prop.anim || keys.length < 2) return base;
      n = n || 0;
      const first = isOut ? keys[n > 0 ? Math.max(0, keys.length - 1 - n) : 0] : keys[0];
      const last = isOut ? keys[keys.length - 1] : keys[n > 0 ? Math.min(keys.length - 1, n) : keys.length - 1];
      const T0 = first.t, T1 = last.t, P = T1 - T0;
      if (P <= 0) return base;
      if (isOut && t <= T1) return base;
      if (!isOut && t >= T0) return base;
      const d = isOut ? t - T0 : T1 - t;
      const cyc = Math.floor(d / P), ph = d - cyc * P;
      if (type === 'cycle') return kv(isOut ? T0 + ph : T1 - ph);
      if (type === 'pingpong') return kv(cyc % 2 === 0 ? (isOut ? T0 + ph : T1 - ph) : (isOut ? T1 - ph : T0 + ph));
      if (type === 'offset') { const dv = R.$sub(last.v, first.v); return isOut ? R.$add(kv(T0 + ph), R.$mul(dv, cyc)) : R.$sub(kv(T1 - ph), R.$mul(dv, cyc)); }
      if (type === 'continue') { const e = 1 / 240, edge = isOut ? T1 : T0; const vel = R.$div(R.$sub(kv(edge + (isOut ? 0 : e)), kv(edge - (isOut ? e : 0))), e); return R.$add(kv(edge), R.$mul(vel, t - edge)); }
      return base;
    };
    const env = {
      $: null, time: t, value: base, thisComp: compRef(comp, ctx, t), thisLayer, thisProperty: thisProp,
      comp: (name) => { const c = E.project._compByName.get(name); if (!c) throw new Error('找不到合成 “' + name + '”'); return compRef(c, E.root(c), t); },
      index: layer ? layer._index : 0, inPoint: layer ? layer.inPoint : 0, outPoint: layer ? layer.outPoint : 0,
      transform: thisLayer && thisLayer.transform, position: thisLayer && thisLayer.position, scale: thisLayer && thisLayer.scale, rotation: thisLayer && thisLayer.rotation, opacity: thisLayer && thisLayer.opacity, anchorPoint: thisLayer && thisLayer.anchorPoint,
      wiggle: (freq, amp, oct = 1, mult = 0.5, tt) => {
        freq = R.$v(freq); amp = R.$v(amp); tt = tt === undefined ? t : R.$v(tt);
        const v = tt === t ? base : kv(tt);
        const w = (d) => { let s = 0, a = 1, f = freq, n = 0; for (let o = 0; o < oct; o++) { s += a * U.noise1(tt * f + d * 17.3, U.strSeed(seedBase + d + ':' + o)); n += a; a *= mult; f *= 2; } return s / Math.max(1, n * 0.7) * amp; };
        if (typeof v === 'number') return v + w(0);
        return v.map((x, d) => x + w(d));
      },
      loopOut: (type, n) => loop(type, n, true), loopIn: (type, n) => loop(type, n, false),
      linear: R.linear, ease: R.ease, easeIn: R.easeIn, easeOut: R.easeOut, clamp: R.clamp,
      random: (a, b) => {
        a = R.$v(a); b = R.$v(b);
        if (a === undefined) return rnd();
        if (b === undefined) { if (Array.isArray(a)) return a.map(x => x * rnd()); return a * rnd(); }
        if (Array.isArray(a)) return a.map((x, i) => x + (b[i] - x) * rnd());
        return a + (b - a) * rnd();
      },
      gaussRandom: (a, b) => { const g = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return (s - 3) / 3 * 0.5 + 0.5; }; a = R.$v(a); b = R.$v(b); if (a === undefined) return g(); if (b === undefined) return a * g(); return a + (b - a) * g(); },
      seedRandom: (s, tl) => { rngSeed = seedBase + '#' + R.$v(s); timeless = !!tl; rcount = 0; },
      noise: (p) => { p = R.$v(p); if (typeof p === 'number') return U.noise3(p, 0.37, 0.71); return U.noise3(p[0] || 0, p[1] || 0, p[2] || 0); },
      valueAtTime: (tt) => kv(R.$v(tt)),
      velocity: thisProp ? thisProp.velocity : 0, speed: thisProp ? thisProp.speed : 0, numKeys: keys.length, key: (i) => thisProp && thisProp.key(i),
      toWorld: thisLayer ? thisLayer.toWorld : (p) => R.$v(p), fromWorld: thisLayer ? thisLayer.fromWorld : (p) => R.$v(p),
      toComp: thisLayer ? thisLayer.toWorld : (p) => R.$v(p), fromComp: thisLayer ? thisLayer.fromWorld : (p) => R.$v(p),
      effect: thisLayer ? thisLayer.effect : () => { throw new Error('没有图层'); }, text: thisLayer && thisLayer.text,
      length: R.length, normalize: R.normalize, dot: R.dot, cross: R.cross, add: R.add, sub: R.sub, mul: R.mul, div: R.div,
      degreesToRadians: R.degreesToRadians, radiansToDegrees: R.radiansToDegrees,
      framesToTime: (f) => R.$v(f) / comp.fps, timeToFrames: (tt) => Math.round((tt === undefined ? t : R.$v(tt)) * comp.fps),
      hslToRgb: R.hslToRgb, rgbToHsl: R.rgbToHsl,
      lookAt: (from, to) => { from = R.$v(from); to = R.$v(to); const d = U.sub(to, from); return [Math.atan2(d[1], Math.hypot(d[0], d[2])) / -U.deg, Math.atan2(d[0], d[2]) / U.deg, 0]; },
      id: 0, age: 0, life: 0, pos: [0, 0, 0], idx: 0, count: 1, thisParticle: null, width: comp.width, height: comp.height,
      field: (name, p) => AE.Fields ? AE.Fields.sampleNamed(comp, name, R.$v(p), t, ctx) : 0,
    };
    if (extra) Object.assign(env, extra);
    const arr = new Array(X.PARAMS.length);
    for (let i = 0; i < X.PARAMS.length; i++) { const n = X.PARAMS[i]; arr[i] = n[0] === '$' && n.length > 1 ? R[n] : env[n]; }
    return arr;
  };
  // 逐元素表达式（节点、粒子）
  E.evalElementExpr = (src, base, t, ctx, extra) => {
    const c = X.compile(src);
    if (c.error) return { v: base, err: c.error };
    try { return { v: coerce(X.rt.$v(c.fn.apply(null, E.env(null, base, t, ctx, null, extra))), base) }; }
    catch (e) { return { v: base, err: '运行错误：' + e.message }; }
  };

  // ---------- 图层变换 ----------
  const is3D = l => !!l.threeD;
  E.is3D = is3D;
  E.local = (layer, t, ctx) => {
    const tf = layer.transform;
    const p = E.prop(tf.position, t, ctx, layer), a = E.prop(tf.anchor, t, ctx, layer), s = E.prop(tf.scale, t, ctx, layer), rz = E.prop(tf.rotation, t, ctx, layer);
    if (layer.type === 'camera' || (layer.type === 'light' && layer.light.kind !== 'point')) {
      const poi = layer.camera ? E.prop(layer.camera.poi, t, ctx, layer) : E.prop(layer.light.poi, t, ctx, layer);
      const view = M4.lookAt(p, poi, rz * U.deg);
      return M4.inv(view);
    }
    if (!is3D(layer)) {
      return M4.mul(M4.mul(M4.mul(M4.trans(p[0], p[1], 0), M4.rotZ(rz * U.deg)), M4.scale(s[0] / 100, s[1] / 100, 1)), M4.trans(-a[0], -a[1], 0));
    }
    const rx = E.prop(tf.rotX, t, ctx, layer), ry = E.prop(tf.rotY, t, ctx, layer);
    let m = M4.trans(p[0], p[1], p[2] || 0);
    m = M4.mul(m, M4.rotX(rx * U.deg)); m = M4.mul(m, M4.rotY(ry * U.deg)); m = M4.mul(m, M4.rotZ(rz * U.deg));
    m = M4.mul(m, M4.scale(s[0] / 100, s[1] / 100, (s[2] === undefined ? 100 : s[2]) / 100));
    return M4.mul(m, M4.trans(-a[0], -a[1], -(a[2] || 0)));
  };
  E.parentWorld = (layer, t, ctx, depth = 0) => {
    if (!layer.parent || depth > 32) return null;
    const par = E.layer(ctx.comp, layer.parent);
    if (!par) return null;
    let pw = E.world(par, t, ctx, depth + 1);
    if (!is3D(layer)) pw = M4.flatten(pw);
    return pw;
  };
  E.world = (layer, t, ctx, depth = 0) => {
    const c = layer._wc;
    if (c && c.rev === E.rev && c.t === t && c.inst === ctx.inst) return c.m;
    let m = E.local(layer, t, ctx);
    const pw = E.parentWorld(layer, t, ctx, depth);
    if (pw) m = M4.mul(pw, m);
    if (!is3D(layer)) m = M4.flatten(m);
    layer._wc = { rev: E.rev, t, inst: ctx.inst, m };
    return m;
  };
  E.opacity = (layer, t, ctx) => U.clamp(E.prop(layer.transform.opacity, t, ctx, layer) / 100, 0, 1);
  E.activeAt = (layer, t) => t >= layer.inPoint - 1e-9 && t < layer.outPoint - 1e-9;
  // 活动摄像机：最上层且在入出点内
  E.activeCamera = (comp, t) => comp.layers.find(l => l.type === 'camera' && l.visible && E.activeAt(l, t)) || null;
  E.cameraAt = (comp, t, ctx) => {
    const cam = E.activeCamera(comp, t);
    const defZoom = comp.width / 2 / Math.tan(39.6 * U.deg / 2);
    if (!cam) {
      const eye = [comp.width / 2, comp.height / 2, -defZoom];
      return { layer: null, view: M4.lookAt(eye, [comp.width / 2, comp.height / 2, 0]), eye, zoom: defZoom, fov: 2 * Math.atan(comp.height / 2 / defZoom), focus: defZoom, aperture: 0, dof: false, blur: 1 };
    }
    const w = E.world(cam, t, ctx);
    const zoom = Math.max(1, E.prop(cam.camera.zoom, t, ctx, cam));
    return {
      layer: cam, view: M4.inv(w), eye: [w[12], w[13], w[14]], zoom, fov: 2 * Math.atan(comp.height / 2 / zoom),
      focus: E.prop(cam.camera.focus, t, ctx, cam), aperture: E.prop(cam.camera.aperture, t, ctx, cam), dof: cam.camera.dof, blur: E.prop(cam.camera.blurLevel, t, ctx, cam) / 100
    };
  };

  // 设父级并保留当前画面
  E.setParent = (comp, layer, parentId, t) => {
    const ctx = E.root(comp);
    E.bump();
    const W = E.world(layer, t, ctx);
    const oldPW = E.parentWorld(layer, t, ctx) || M4.ident();
    layer.parent = parentId || null;
    E.bump();
    const newPW = E.parentWorld(layer, t, ctx) || M4.ident();
    const D = M4.mul(M4.inv(newPW), oldPW); // 旧父空间 → 新父空间
    rebaseTransform(layer, D, t);
    E.bump();
  };
  function rebaseTransform(layer, D, t) {
    const tf = layer.transform, three = is3D(layer);
    const conv = (pos, rot, scl, anc, rx, ry) => {
      let L = three ? M4.mul(M4.mul(M4.mul(M4.mul(M4.trans(pos[0], pos[1], pos[2] || 0), M4.rotX(rx * U.deg)), M4.rotY(ry * U.deg)), M4.rotZ(rot * U.deg)), M4.scale(scl[0] / 100, scl[1] / 100, (scl[2] || 100) / 100))
        : M4.mul(M4.mul(M4.trans(pos[0], pos[1], 0), M4.rotZ(rot * U.deg)), M4.scale(scl[0] / 100, scl[1] / 100, 1));
      L = M4.mul(D, L);
      if (!three) L = M4.flatten(L);
      const d = M4.decompose(L);
      return { pos: [d.pos[0], d.pos[1], three ? d.pos[2] : (pos[2] || 0)], rot: d.rot[2], scl: [d.scale[0] * 100, d.scale[1] * 100, three ? d.scale[2] * 100 : (scl[2] || 100)], rx: d.rot[0], ry: d.rot[1] };
    };
    const cur = (p) => A.valueAt(p, t);
    const r = conv(cur(tf.position), cur(tf.rotation), cur(tf.scale), cur(tf.anchor), cur(tf.rotX), cur(tf.rotY));
    const c0 = { pos: cur(tf.position), rot: cur(tf.rotation), scl: cur(tf.scale), rx: cur(tf.rotX), ry: cur(tf.rotY) };
    const apply = (prop, newCur, oldCur, fn) => {
      if (!prop.anim) { prop.value = newCur; return; }
      for (const k of prop.keys) k.v = fn(k.v);
    };
    // 关键帧按同一变换修正
    if (tf.position.anim) for (const k of tf.position.keys) { const q = conv(k.v, c0.rot, c0.scl, null, c0.rx, c0.ry); k.v = q.pos; if (k.ti && k.sp !== 'auto') { k.ti = M4.applyDir(D, k.ti).slice(0, k.v.length); k.to = M4.applyDir(D, k.to).slice(0, k.v.length); } }
    else tf.position.value = r.pos;
    const drot = r.rot - c0.rot, drx = r.rx - c0.rx, dry = r.ry - c0.ry;
    apply(tf.rotation, r.rot, c0.rot, v => v + drot);
    if (three) { apply(tf.rotX, r.rx, c0.rx, v => v + drx); apply(tf.rotY, r.ry, c0.ry, v => v + dry); }
    const sr = r.scl.map((x, i) => x / (c0.scl[i] || 1));
    apply(tf.scale, r.scl, c0.scl, v => v.map((x, i) => x * sr[i]));
  }
  // 单独移动锚点，画面位置不变
  E.moveAnchor = (layer, t, ctx, newAnchor) => {
    const tf = layer.transform;
    const a0 = A.valueAt(tf.anchor, t);
    const L0 = E.local(layer, t, ctx);
    const pa0 = M4.apply(L0, a0); // 旧锚点在父空间的位置 = position
    A.setValue(tf.anchor, t, newAnchor.slice(0, a0.length));
    E.bump();
    const L1 = E.local(layer, t, ctx);
    const pa1 = M4.apply(L1, newAnchor);
    // 新锚点在父空间应位于旧矩阵映射处
    const want = M4.apply(L0, newAnchor);
    const pos = A.valueAt(tf.position, t);
    const np = pos.map((x, i) => x + (want[i] - pa1[i]) * (i < 2 || is3D(layer) ? 1 : 0));
    A.setValue(tf.position, t, np);
    E.bump();
  };
})(typeof window !== 'undefined' ? window : globalThis);
