'use strict';
// ============ 关键帧插值、空间路径与表达式求值 ============
class CycleError extends Error { constructor(chain, origin) { super('循环引用'); this.chain = chain; this.origin = origin; } }

const Anim = {
  version: 1,           // 工程修改版本（每次修改递增，用于缓存失效）
  memo: new Map(), memoVer: -1,
  errors: new Map(),    // propId -> 错误信息
  stack: [],            // 正在求值的属性 [{id,label}]
  project: null,
  touch() { this.version++; },
  EASE_DEF: () => ({ s: 0, f: 33.333 }),

  // ---------- 关键帧基础 ----------
  isAnimated(p) { return !!(p && p.k && p.k.length); },
  sortKeys(p) { if (p.k) p.k.sort((a, b) => a.t - b.t); },
  keyIndexAt(p, t, eps = 1e-4) { if (!p.k) return -1; return p.k.findIndex(k => Math.abs(k.t - t) < eps); },
  newKey(p, t, v, spatial) {
    const k = { t, v: U.clone(v), ii: 'linear', oi: 'linear', ei: this.EASE_DEF(), eo: this.EASE_DEF() };
    if (spatial) { k.sp = 'auto'; k.ti = null; k.to = null; }
    return k;
  },
  addKey(p, t, v, spatial) {
    if (!p.k) p.k = [];
    const i = this.keyIndexAt(p, t);
    if (i >= 0) { p.k[i].v = U.clone(v); return p.k[i]; }
    const k = this.newKey(p, t, v, spatial);
    // 继承相邻关键帧的插值方式
    const prev = p.k.filter(q => q.t < t).pop();
    if (prev) { k.ii = prev.oi === 'hold' ? 'hold' : prev.ii; k.oi = prev.oi; }
    p.k.push(k); this.sortKeys(p); return k;
  },
  removeKey(p, k) { if (!p.k) return; const i = p.k.indexOf(k); if (i >= 0) p.k.splice(i, 1); if (!p.k.length) { p.k = null; } },
  // 开关动画（秒表）
  toggleAnim(p, tl, curVal, spatial) {
    if (this.isAnimated(p)) { p.v = U.clone(curVal); p.k = null; }
    else { p.k = []; this.addKey(p, tl, curVal, spatial); }
    this.touch();
  },
  // 设置值：开启动画时只在当前时刻创建/更新关键帧
  setValue(p, v, tl, spatial) {
    if (this.isAnimated(p)) this.addKey(p, tl, v, spatial); else p.v = U.clone(v);
    this.touch();
  },

  // ---------- 时间缓动 ----------
  dist(a, b) {
    if (typeof a === 'number') return Math.abs(b - a);
    if (U.isArr(a)) return U.vecDist(a, b);
    return 1;
  },
  // 由时间求进度（0..1），支持贝塞尔缓动、线性与定格
  progress(k0, k1, t, dist) {
    const dt = k1.t - k0.t; if (dt <= 0) return 1;
    const u = (t - k0.t) / dt;
    if (k0.oi === 'hold') return 0;
    if (k0.oi === 'linear' && k1.ii === 'linear') return u;
    if (dist < 1e-9) return u;
    let f0, m0, f1, m1;
    if (k0.oi === 'linear') { f0 = 1 / 3; m0 = 1; } else { f0 = U.clamp((k0.eo?.f ?? 33.3) / 100, 0.001, 1); m0 = (k0.eo?.s ?? 0) * dt / dist; }
    if (k1.ii === 'linear') { f1 = 1 / 3; m1 = 1; } else { f1 = U.clamp((k1.ei?.f ?? 33.3) / 100, 0.001, 1); m1 = (k1.ei?.s ?? 0) * dt / dist; }
    return this.cubicY(f0, m0 * f0, 1 - f1, 1 - m1 * f1, u);
  },
  // 贝塞尔 (0,0)(x1,y1)(x2,y2)(1,1)，求 x=u 时的 y
  cubicY(x1, y1, x2, y2, u) {
    const bx = s => 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s;
    const by = s => 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
    let lo = 0, hi = 1, s = u;
    for (let i = 0; i < 8; i++) {
      const x = bx(s) - u; const dx = 3 * (1 - s) * (1 - s) * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s * s * (1 - x2);
      if (Math.abs(x) < 1e-7) return by(s);
      if (Math.abs(dx) < 1e-6) break; const ns = s - x / dx; if (ns < 0 || ns > 1) break; s = ns;
    }
    for (let i = 0; i < 40; i++) { s = (lo + hi) / 2; if (bx(s) < u) lo = s; else hi = s; }
    return by(s);
  },

  // ---------- 空间插值（位置沿路径匀速） ----------
  spatialTangents(p, i) {
    const k = p.k[i], n = p.k.length;
    const dims = k.v.length;
    const zero = new Array(dims).fill(0);
    if (k.sp === 'linear') return { ti: zero, to: zero };
    if (k.sp === 'manual' && k.ti && k.to) return { ti: k.ti, to: k.to };
    const prev = i > 0 ? p.k[i - 1].v : null, next = i < n - 1 ? p.k[i + 1].v : null;
    if (!prev || !next) {
      // 端点：指向邻点 1/3
      if (next) return { ti: zero, to: U.vecMul(U.vecSub(next, k.v), 0) };
      if (prev) return { ti: U.vecMul(U.vecSub(prev, k.v), 0), to: zero };
      return { ti: zero, to: zero };
    }
    const d = U.vecSub(next, prev); const a = U.vecDist(k.v, prev), b = U.vecDist(next, k.v), s = a + b || 1;
    return { ti: U.vecMul(d, -a / s / 3 * 1.0), to: U.vecMul(d, b / s / 3 * 1.0) };
  },
  segCurve(p, i) {
    const k0 = p.k[i], k1 = p.k[i + 1];
    const a = this.spatialTangents(p, i), b = this.spatialTangents(p, i + 1);
    return [k0.v, U.vecAdd(k0.v, a.to), U.vecAdd(k1.v, b.ti), k1.v];
  },
  bez(P, s) { const m = 1 - s; return P[0].map((_, d) => m * m * m * P[0][d] + 3 * m * m * s * P[1][d] + 3 * m * s * s * P[2][d] + s * s * s * P[3][d]); },
  lutCache: new WeakMap(),
  segLUT(P) {
    const sig = JSON.stringify(P);
    const c = this.lutCache.get(P[0]);
    // P 是临时数组，用签名缓存
    if (!this._lut) this._lut = new Map();
    let L = this._lut.get(sig);
    if (L) return L;
    const N = 48; const pts = []; const len = [0]; let prev = P[0];
    for (let i = 1; i <= N; i++) { const q = this.bez(P, i / N); len.push(len[i - 1] + U.vecDist(prev, q)); prev = q; }
    L = { len, total: len[N], N };
    if (this._lut.size > 4000) this._lut.clear();
    this._lut.set(sig, L); return L;
  },
  bezAtDist(P, L, d) {
    if (L.total < 1e-9) return P[0].slice();
    let lo = 0, hi = L.N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L.len[m] < d) lo = m; else hi = m; }
    const seg = L.len[hi] - L.len[lo]; const f = seg > 0 ? (d - L.len[lo]) / seg : 0;
    return this.bez(P, (lo + f) / L.N);
  },

  // ---------- 关键帧取值（未计表达式），tl 为图层时间 ----------
  keyValue(p, tl, kind) {
    const K = p.k;
    if (!K || !K.length) return p.v;
    if (tl <= K[0].t) return K[0].v;
    const n = K.length;
    if (tl >= K[n - 1].t) return K[n - 1].v;
    let i = 0; while (i < n - 2 && K[i + 1].t <= tl) i++;
    const k0 = K[i], k1 = K[i + 1];
    if (k0.oi === 'hold') return k0.v;
    if (typeof k0.v === 'string') return k0.v;
    if (k0.v && k0.v.c) { // 路径形变
      const u = this.progress(k0, k1, tl, 1);
      return Geo2D.morphPath(k0.v, k1.v, u);
    }
    if (k0.sp !== undefined && U.isArr(k0.v)) {
      const P = this.segCurve(p, i), L = this.segLUT(P);
      const u = this.progress(k0, k1, tl, L.total);
      return this.bezAtDist(P, L, u * L.total);
    }
    const u = this.progress(k0, k1, tl, this.dist(k0.v, k1.v));
    return U.vecLerp(k0.v, k1.v, u);
  },

  // ---------- 最终值（含表达式） ----------
  // owner: {comp, layer}; t 为合成时间
  evalProp(p, comp, layer, t) {
    if (!p) return 0;
    if (this.memoVer !== this.version) { this.memo.clear(); this.memoVer = this.version; }
    const tl = t - (layer ? layer.startTime : 0);
    if (!(p.xOn && p.x && p.x.trim())) return this.keyValue(p, tl);
    const key = p.id + '|' + t;
    const m = this.memo.get(key); if (m !== undefined) return m;
    const base = this.keyValue(p, tl);
    if (this.stack.some(s => s.id === p.id)) {
      const chain = this.stack.slice(this.stack.findIndex(s => s.id === p.id)).map(s => s.label).concat(this.propLabel(p, comp));
      throw new CycleError(chain, p.id);
    }
    this.stack.push({ id: p.id, label: this.propLabel(p, comp) });
    let out;
    try {
      out = Expr.run(p, comp, layer, t, base);
      if (out === undefined || out === null || (typeof out === 'number' && !isFinite(out))) throw new Error('表达式结果无效');
      out = this.coerce(out, base);
      this.errors.delete(p.id);
    } catch (e) {
      this.stack.pop();
      if (e instanceof CycleError) {
        this.errors.set(p.id, '循环引用：' + e.chain.join(' → '));
        if (e.origin !== p.id) throw e;
      } else this.errors.set(p.id, (e && e.message) || String(e));
      this.memo.set(key, base);
      return base;
    }
    this.stack.pop();
    if (this.memo.size > 60000) this.memo.clear();
    this.memo.set(key, out);
    return out;
  },
  coerce(v, base) {
    if (typeof base === 'number') { if (U.isArr(v)) return +v[0]; if (v instanceof Number) return +v; return +v; }
    if (U.isArr(base)) {
      if (typeof v === 'number' || v instanceof Number) return base.map(() => +v);
      if (U.isArr(v)) return base.map((b, i) => (v[i] !== undefined ? +v[i] : b));
    }
    if (typeof base === 'string') return String(v);
    return v;
  },
  propLabel(p, comp) {
    if (!comp) return '属性#' + p.id;
    if (!this._labelCache || this._labelVer !== this.version) { this._labelCache = new Map(); this._labelVer = this.version; }
    if (this._labelCache.has(p.id)) return this._labelCache.get(p.id);
    let s = '属性#' + p.id;
    const o = Model.findPropOwner(comp, p.id);
    if (o) s = `${o.layer.name}.${o.node.label}`;
    this._labelCache.set(p.id, s); return s;
  },

  // ---------- 关键帧批量操作 ----------
  easyEase(p, k, mode) {
    if (mode !== 'out') { k.ii = 'bezier'; k.ei = { s: 0, f: 33.333 }; }
    if (mode !== 'in') { k.oi = 'bezier'; k.eo = { s: 0, f: 33.333 }; }
  },
  setInterp(k, mode) {
    if (mode === 'hold') { k.oi = 'hold'; }
    else if (mode === 'linear') { k.ii = k.oi = 'linear'; }
    else if (mode === 'bezier') { k.ii = k.oi = 'bezier'; if (!k.ei) k.ei = { s: 0, f: 33.3 }; if (!k.eo) k.eo = { s: 0, f: 33.3 }; }
  },
  // 时间速度（单位/秒），数值求导，基于最终值
  speedAt(p, comp, layer, t) {
    const h = 1 / 240;
    const a = this.evalProp(p, comp, layer, t - h), b = this.evalProp(p, comp, layer, t + h);
    if (typeof a === 'number') return (b - a) / (2 * h);
    if (U.isArr(a)) return U.vecDist(a, b) / (2 * h);
    return 0;
  },
};

// ============ 表达式 ============
const Expr = {
  runner: new Function('__s', '__c', 'with(__s){ return eval(__c); }'),
  run(p, comp, layer, t, base) {
    const prev = this.curT;
    try { const S = this.scope(p, comp, layer, t, base); return this.unwrap(this.runner(S, p.x)); }
    finally { this.curT = prev; }
  },
  unwrap(v) {
    if (v instanceof Number) return +v;
    if (v instanceof String) return String(v);
    if (U.isArr(v)) return v.map(x => x instanceof Number ? +x : x);
    if (v && typeof v === 'object' && '__val' in v) return v.__val;
    return v;
  },
  vec(v) { return U.isArr(v) ? v : [v]; },
  // 包装属性值，附带 valueAtTime 等
  wrap(val, p, comp, layer) {
    let w;
    if (typeof val === 'number') w = new Number(val);
    else if (U.isArr(val)) w = val.slice();
    else if (typeof val === 'string') w = new String(val);
    else w = { __val: val };
    const self = this;
    Object.defineProperty(w, 'value', { get: () => Anim.evalProp(p, comp, layer, self.curT), enumerable: false });
    w.valueAtTime = tt => self.wrapPlain(Anim.evalProp(p, comp, layer, +tt));
    w.velocityAtTime = tt => { const a = Anim.evalProp(p, comp, layer, tt - 0.005), b = Anim.evalProp(p, comp, layer, tt + 0.005); return U.isArr(a) ? a.map((x, i) => (b[i] - x) / 0.01) : (b - a) / 0.01; };
    Object.defineProperty(w, 'numKeys', { get: () => p.k ? p.k.length : 0, enumerable: false });
    w.key = i => { const k = p.k && p.k[i - 1]; return k ? { time: k.t + (layer ? layer.startTime : 0), value: k.v } : null; };
    Object.defineProperty(w, 'speed', { get: () => Anim.speedAt(p, comp, layer, self.curT), enumerable: false });
    return w;
  },
  wrapPlain(v) { return U.isArr(v) ? v.slice() : v; },
  curT: 0,
  _lpCache: new Map(), _lpVer: -1,
  layerProxy(comp, layer) {
    if (!layer) return null;
    if (this._lpVer !== Anim.version) { this._lpCache.clear(); this._lpVer = Anim.version; }
    let c = this._lpCache.get(layer.id);
    if (!c) { c = this._layerProxy(comp, layer); this._lpCache.set(layer.id, c); }
    return c;
  },
  _layerProxy(comp, layer) {
    const self = this;
    const tree = Model.tree(layer, comp);
    const build = nodes => {
      const o = {};
      for (const n of nodes) {
        const names = [n.key, n.label, n.name].filter(Boolean);
        if (n.prop) {
          for (const nm of names) if (!(nm in o)) Object.defineProperty(o, nm, { get: () => self.wrap(Anim.evalProp(n.prop, comp, layer, self.curT), n.prop, comp, layer), enumerable: true, configurable: true });
        } else if (n.children) {
          const sub = build(n.children);
          for (const nm of names) if (!(nm in o) || n.name) o[nm] = sub;
        }
      }
      return o;
    };
    const root = build(tree);
    const P = {
      name: layer.name, index: comp.layers.indexOf(layer) + 1, inPoint: layer.inPoint, outPoint: layer.outPoint, startTime: layer.startTime,
      transform: root.transform || {},
      effect(name) {
        const e = layer.effects.find(x => x.name === name) || (typeof name === 'number' ? layer.effects[name - 1] : null);
        if (!e) throw new Error(`图层「${layer.name}」没有效果「${name}」`);
        const def = Model.EFFECTS[e.type];
        const get = pn => {
          let key = Object.keys(def.params).find(k => k === pn || def.params[k].label === pn || pn === undefined);
          if (typeof pn === 'number') key = Object.keys(def.params)[pn - 1];
          if (!key) throw new Error(`效果「${name}」没有参数「${pn}」`);
          return self.wrap(Anim.evalProp(e.p[key], comp, layer, self.curT), e.p[key], comp, layer);
        };
        const f = pn => get(pn);
        const first = Object.keys(def.params)[0];
        Object.defineProperty(f, 'value', { get: () => get(first) });
        f.param = get;
        for (const k of Object.keys(def.params)) Object.defineProperty(f, k, { get: () => get(k) });
        return f;
      },
      content(name) { const r = root.contents && root.contents[name]; if (!r) throw new Error(`没有内容「${name}」`); const o = Object.assign({}, r); o.content = n2 => { if (!r[n2]) throw new Error(`没有内容「${n2}」`); return r[n2]; }; return o; },
      prop(name) { const fl = Model.flatProps(layer).find(f => f.node.label === name || f.node.key === name); if (!fl) throw new Error(`没有属性「${name}」`); return self.wrap(Anim.evalProp(fl.node.prop, comp, layer, self.curT), fl.node.prop, comp, layer); },
      toComp(pt) { const m = Xform.layerMatrix(comp, layer, self.curT); return M4.pt(m, pt).slice(0, U.isArr(pt) ? pt.length : 2); },
      fromComp(pt) { const m = M4.invert(Xform.layerMatrix(comp, layer, self.curT)); return M4.pt(m, pt).slice(0, pt.length); },
    };
    for (const k in root) if (!(k in P)) Object.defineProperty(P, k, Object.getOwnPropertyDescriptor(root, k));
    // 快捷：position/scale 等
    for (const k of ['position', 'anchorPoint', 'scale', 'rotation', 'opacity', 'xRotation', 'yRotation']) if (P.transform && k in P.transform && !(k in P)) Object.defineProperty(P, k, { get: () => P.transform[k] });
    if (layer.type === 'text') P.text = { get sourceText() { return Anim.evalProp(layer.text.source, comp, layer, self.curT); } };
    if (layer.type === 'precomp') P.source = { name: (Model.findComp(Anim.project, layer.pre.compId) || {}).name };
    return P;
  },
  compProxy(comp) {
    const self = this;
    return {
      name: comp.name, width: comp.width, height: comp.height, duration: comp.duration, frameDuration: 1 / comp.fps, numLayers: comp.layers.length,
      layer(n) {
        const L = typeof n === 'number' ? comp.layers[n - 1] : comp.layers.find(l => l.name === n);
        if (!L) throw new Error(`找不到图层「${n}」`);
        return self.layerProxy(comp, L);
      },
    };
  },
  scope(p, comp, layer, t, base) {
    const self = this;
    this.curT = t;
    const seed = p.id;
    const tl = t - (layer ? layer.startTime : 0);
    const thisLayer = layer ? this.layerProxy(comp, layer) : null;
    const S = {
      time: t, value: U.isArr(base) ? base.slice() : base, thisComp: this.compProxy(comp), thisLayer, thisProperty: this.wrap(base, p, comp, layer),
      comp: name => { const c = Anim.project.comps.find(x => x.name === name); if (!c) throw new Error(`找不到合成「${name}」`); return self.compProxy(c); },
      transform: thisLayer ? thisLayer.transform : {},
      effect: thisLayer ? thisLayer.effect : () => { throw new Error('无图层'); },
      content: thisLayer ? thisLayer.content : null,
      index: thisLayer ? thisLayer.index : 0, inPoint: layer ? layer.inPoint : 0, outPoint: layer ? layer.outPoint : comp.duration,
      wiggle(freq, amp, oct = 1, mult = 0.5, tt = t) {
        const v = base;
        const n = d => Noise.fbm(tt * freq + 0.37, d * 17.13 + (seed % 997) * 0.731, (seed % 113) * 0.19 + 0.5, oct, mult) * 1.6;
        if (U.isArr(v)) return v.map((x, d) => x + n(d) * amp);
        return v + n(0) * amp;
      },
      loopOut(type = 'cycle', num = 0) { return self.loop(p, comp, layer, t, type, num, true, base); },
      loopIn(type = 'cycle', num = 0) { return self.loop(p, comp, layer, t, type, num, false, base); },
      linear(x, a, b, c, d) { if (c === undefined) { c = a; d = b; a = 0; b = 1; } const u = U.clamp((x - a) / ((b - a) || 1e-9), 0, 1); return self.mix(c, d, u); },
      ease(x, a, b, c, d) { if (c === undefined) { c = a; d = b; a = 0; b = 1; } const u = U.clamp((x - a) / ((b - a) || 1e-9), 0, 1); return self.mix(c, d, u * u * (3 - 2 * u)); },
      easeIn(x, a, b, c, d) { if (c === undefined) { c = a; d = b; a = 0; b = 1; } const u = U.clamp((x - a) / ((b - a) || 1e-9), 0, 1); return self.mix(c, d, u * u); },
      easeOut(x, a, b, c, d) { if (c === undefined) { c = a; d = b; a = 0; b = 1; } const u = U.clamp((x - a) / ((b - a) || 1e-9), 0, 1); return self.mix(c, d, 1 - (1 - u) * (1 - u)); },
      clamp: (x, a, b) => U.isArr(x) ? x.map((v, i) => U.clamp(v, U.isArr(a) ? a[i] : a, U.isArr(b) ? b[i] : b)) : U.clamp(x, a, b),
      add: (a, b) => U.vecAdd(self.unwrap(a), self.unwrap(b)), sub: (a, b) => U.vecSub(self.unwrap(a), self.unwrap(b)),
      mul: (a, s) => U.vecMul(self.unwrap(a), +s), div: (a, s) => U.vecMul(self.unwrap(a), 1 / s),
      length: (a, b) => b === undefined ? U.vecLen(self.unwrap(a)) : U.vecDist(self.unwrap(a), self.unwrap(b)),
      normalize: a => { a = self.unwrap(a); const l = U.vecLen(a) || 1; return U.vecMul(a, 1 / l); },
      dot: (a, b) => self.unwrap(a).reduce((s, x, i) => s + x * self.unwrap(b)[i], 0),
      degreesToRadians: d => d * Math.PI / 180, radiansToDegrees: r => r * 180 / Math.PI,
      timeToFrames: (tt = t) => Math.round(tt * comp.fps), framesToTime: f => f / comp.fps,
      random(a, b) { const r = U.rand01(seed, Math.round(t * comp.fps * 16), self._rc++); if (a === undefined) return r; if (b === undefined) return r * a; return a + r * (b - a); },
      noise: x => Noise.n3(+x, 0.5, 0.5),
      valueAtTime: tt => Anim.keyValue(p, tt - (layer ? layer.startTime : 0)),
      sin: Math.sin, cos: Math.cos, abs: Math.abs, min: Math.min, max: Math.max, floor: Math.floor, round: Math.round, pow: Math.pow, sqrt: Math.sqrt, PI: Math.PI, Math,
    };
    this._rc = 0;
    return S;
  },
  mix(a, b, u) { a = this.unwrap(a); b = this.unwrap(b); if (U.isArr(a)) return a.map((x, i) => x + ((U.isArr(b) ? b[i] : b) - x) * u); return a + (b - a) * u; },
  loop(p, comp, layer, t, type, num, out, base) {
    const K = p.k; if (!K || K.length < 2) return base;
    const st = layer ? layer.startTime : 0, tl = t - st;
    const n = K.length;
    let a, b;
    if (out) { b = K[n - 1]; a = num > 0 ? K[Math.max(0, n - 1 - num)] : K[0]; if (tl <= b.t) return base; }
    else { a = K[0]; b = num > 0 ? K[Math.min(n - 1, num)] : K[n - 1]; if (tl >= a.t) return base; }
    const dur = b.t - a.t; if (dur <= 0) return base;
    const kv = tt => Anim.keyValue(p, tt);
    const rel = out ? tl - b.t : a.t - tl;
    const cyc = Math.floor(rel / dur), frac = rel - cyc * dur;
    switch (type) {
      case 'pingpong': {
        const fwd = cyc % 2 === 0;
        if (out) return kv(fwd ? b.t - frac : a.t + frac);
        return kv(fwd ? a.t + frac : b.t - frac);
      }
      case 'offset': {
        const d = U.vecSub(kv(b.t), kv(a.t));
        if (out) return U.vecAdd(kv(a.t + frac), U.vecMul(d, cyc + 1));
        return U.vecSub(kv(b.t - frac), U.vecMul(d, cyc + 1));
      }
      case 'continue': {
        const h = 0.01;
        if (out) { const v = U.vecMul(U.vecSub(kv(b.t), kv(b.t - h)), 1 / h); return U.vecAdd(kv(b.t), U.vecMul(v, tl - b.t)); }
        const v = U.vecMul(U.vecSub(kv(a.t + h), kv(a.t)), 1 / h); return U.vecSub(kv(a.t), U.vecMul(v, a.t - tl));
      }
      default: // cycle
        if (out) return kv(a.t + frac);
        return kv(b.t - frac);
    }
  },
};
