// 关键帧插值：时间缓动（线性/贝塞尔/定格，速度+影响）与空间插值（位置路径，弧长匀速）
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, P = AE.Path;
  const A = AE.Anim = {};

  A.isSpatial = prop => prop.spatial === true;
  A.sortKeys = prop => prop.keys.sort((a, b) => a.t - b.t);

  // 自动空间切线（Catmull-Rom 风格）
  function autoTangents(keys, k) {
    const cur = keys[k].v, prev = keys[k - 1], next = keys[k + 1];
    const dim = cur.length;
    if (!prev || !next) return { ti: new Array(dim).fill(0), to: new Array(dim).fill(0) };
    const d = U.sub(next.v, prev.v), dl = U.len(d) || 1;
    const lp = U.dist(cur, prev.v), ln = U.dist(cur, next.v);
    const dir = d.map(x => x / dl);
    return { ti: dir.map(x => -x * lp / 3), to: dir.map(x => x * ln / 3) };
  }
  A.spatialTangents = (keys, k) => {
    const key = keys[k];
    if (key.sp === 'linear') return { ti: key.v.map(() => 0), to: key.v.map(() => 0) };
    if (key.sp === 'auto' || !key.ti || !key.to) return autoTangents(keys, k);
    return { ti: key.ti, to: key.to };
  };
  // 空间段：弧长表（缓存在关键帧运行时字段）
  function segArc(keys, k, spatial) {
    const a = keys[k], b = keys[k + 1];
    const sig = spatial ? JSON.stringify([a.v, b.v, a.sp, b.sp, a.to, b.ti, keys[k - 1] && keys[k - 1].v, keys[k + 2] && keys[k + 2].v]) : '';
    if (a._arc && a._arc.sig === sig) return a._arc;
    const dim = a.v.length, N = 48;
    let p0 = a.v, p3 = b.v, p1 = p0, p2 = p3;
    if (spatial) {
      const ta = A.spatialTangents(keys, k), tb = A.spatialTangents(keys, k + 1);
      p1 = U.add(p0, ta.to); p2 = U.add(p3, tb.ti);
    }
    const pts = [], cum = [0];
    for (let i = 0; i <= N; i++) {
      const t = i / N, mt = 1 - t, c0 = mt * mt * mt, c1 = 3 * mt * mt * t, c2 = 3 * mt * t * t, c3 = t * t * t;
      const q = new Array(dim); for (let d = 0; d < dim; d++) q[d] = c0 * p0[d] + c1 * p1[d] + c2 * p2[d] + c3 * p3[d];
      pts.push(q); if (i) cum.push(cum[i - 1] + U.dist(q, pts[i - 1]));
    }
    a._arc = { sig, pts, cum, L: cum[N], p1, p2 };
    return a._arc;
  }
  A.segArc = segArc;
  function arcPoint(arc, s) {
    const L = arc.L, cum = arc.cum, N = cum.length - 1;
    if (L < 1e-9) return arc.pts[0].slice();
    if (s <= 0) { // 过冲：沿起始切向外推
      const d = U.sub(arc.pts[1], arc.pts[0]), dl = U.len(d) || 1; return U.add(arc.pts[0], U.scale(d, s / dl));
    }
    if (s >= L) { const d = U.sub(arc.pts[N], arc.pts[N - 1]), dl = U.len(d) || 1; return U.add(arc.pts[N], U.scale(d, (s - L) / dl)); }
    let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
    return U.lerpV(arc.pts[lo], arc.pts[hi], f);
  }
  // 段的“幅度”Δs：一维为带符号差，向量为弧长/距离
  function segDelta(prop, keys, k) {
    const a = keys[k], b = keys[k + 1];
    if (typeof a.v === 'number') return b.v - a.v;
    if (Array.isArray(a.v) && typeof a.v[0] === 'number') return A.isSpatial(prop) ? segArc(keys, k, true).L : U.dist(a.v, b.v);
    return 1;
  }
  A.segDelta = segDelta;
  // 自动贝塞尔速度
  function autoSpeed(prop, keys, k) {
    const prev = keys[k - 1], next = keys[k + 1];
    if (!prev || !next) return 0;
    if (typeof keys[k].v === 'number') return (next.v - prev.v) / (next.t - prev.t);
    return (Math.abs(segDelta(prop, keys, k - 1)) + Math.abs(segDelta(prop, keys, k))) / (next.t - prev.t);
  }
  // 时间贝塞尔控制点（时间-幅度平面）
  A.segBezier = (prop, keys, k) => {
    const a = keys[k], b = keys[k + 1], dt = b.t - a.t, ds = segDelta(prop, keys, k);
    let p1, p2;
    if (a.oi === 'bezier') { const f = U.clamp(a.oe.f, 0.001, 1), s = a.auto ? autoSpeed(prop, keys, k) : a.oe.s; p1 = [f * dt, s * f * dt]; }
    else p1 = [dt / 3, ds / 3];
    if (b.ii === 'bezier') { const f = U.clamp(b.ie.f, 0.001, 1), s = b.auto ? autoSpeed(prop, keys, k + 1) : b.ie.s; p2 = [dt - f * dt, ds - s * f * dt]; }
    else p2 = [dt * 2 / 3, ds * 2 / 3];
    return { dt, ds, p1, p2 };
  };
  // 求 x(u)=x 的 u，再得 y
  function bezY(p1, p2, dt, ds, x) {
    const bx = u => { const m = 1 - u; return 3 * m * m * u * p1[0] + 3 * m * u * u * p2[0] + u * u * u * dt; };
    const by = u => { const m = 1 - u; return 3 * m * m * u * p1[1] + 3 * m * u * u * p2[1] + u * u * u * ds; };
    let lo = 0, hi = 1, u = x / (dt || 1);
    for (let i = 0; i < 8; i++) { // 牛顿
      const m = 1 - u, d = 3 * m * m * p1[0] + 6 * m * u * (p2[0] - p1[0]) + 3 * u * u * (dt - p2[0]);
      const e = bx(u) - x; if (Math.abs(e) < 1e-7) return by(u);
      if (Math.abs(d) < 1e-9) break; const nu = u - e / d; if (nu < 0 || nu > 1) break; u = nu;
    }
    for (let i = 0; i < 40; i++) { u = (lo + hi) / 2; if (bx(u) < x) lo = u; else hi = u; }
    return by(u);
  }
  A.bezY = bezY;

  // 段内取值：返回 {s, frac}
  A.segProgress = (prop, keys, k, t) => {
    const a = keys[k];
    const sb = A.segBezier(prop, keys, k);
    const s = bezY(sb.p1, sb.p2, sb.dt, sb.ds, t - a.t);
    return { s, frac: sb.ds ? s / sb.ds : 0, sb };
  };

  // 关键帧值（不含表达式）
  A.valueAt = (prop, t) => {
    const keys = prop.keys;
    if (!prop.anim || !keys.length) return prop.value;
    if (keys.length === 1 || t <= keys[0].t) return keys[0].v;
    const last = keys[keys.length - 1];
    if (t >= last.t) return last.v;
    let lo = 0, hi = keys.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (keys[m].t <= t) lo = m; else hi = m; }
    const a = keys[lo], b = keys[lo + 1];
    if (a.oi === 'hold' || prop.type === 'text' || typeof a.v === 'string' || typeof a.v === 'boolean') return a.v;
    const pr = A.segProgress(prop, keys, lo, t);
    if (typeof a.v === 'number') return a.v + pr.s;
    if (prop.type === 'path') return P.lerpShape(a.v, b.v, pr.frac);
    if (A.isSpatial(prop)) { const arc = segArc(keys, lo, true); return arcPoint(arc, pr.s); }
    return U.lerpV(a.v, b.v, pr.frac);
  };

  // 设置值：开启动画时在时刻 t 创建或更新关键帧
  A.setValue = (prop, t, v) => {
    if (!prop.anim) { prop.value = U.clone(v); return; }
    const eps = 1e-4;
    let k = prop.keys.find(k => Math.abs(k.t - t) < eps);
    if (k) k.v = U.clone(v);
    else {
      const nk = AE.Model.key(t, v);
      // 新关键帧继承相邻关键帧的插值类型
      const prev = [...prop.keys].reverse().find(k => k.t < t);
      if (prev) { nk.ii = prev.oi === 'hold' ? 'hold' : prev.ii; nk.oi = prev.oi; }
      prop.keys.push(nk); A.sortKeys(prop);
    }
    prop.value = U.clone(v);
  };
  A.toggleAnim = (prop, t, cur) => {
    if (prop.anim) { prop.value = U.clone(cur !== undefined ? cur : A.valueAt(prop, t)); prop.anim = false; prop.keys = []; }
    else { prop.anim = true; prop.keys = [AE.Model.key(t, cur !== undefined ? cur : prop.value)]; }
  };
  A.keyAt = (prop, t) => prop.keys.find(k => Math.abs(k.t - t) < 1e-4);
  A.addKey = (prop, t, v, opt) => {
    prop.anim = true;
    let k = A.keyAt(prop, t);
    if (k) { k.v = U.clone(v); if (opt) Object.assign(k, opt); }
    else { k = AE.Model.key(t, v, opt); prop.keys.push(k); A.sortKeys(prop); }
    return k;
  };
  // 缓动：type = 'easy' | 'in' | 'out'
  A.applyEase = (key, type, influence = 1 / 3) => {
    if (type === 'easy' || type === 'in') { key.ii = 'bezier'; key.ie = { s: 0, f: influence }; key.auto = false; }
    if (type === 'easy' || type === 'out') { key.oi = 'bezier'; key.oe = { s: 0, f: influence }; key.auto = false; }
  };
  // 数值导数（速度），返回标量（向量取模长，一维带符号）
  A.velocity = (fn, t, dt = 1 / 240) => {
    const a = fn(t - dt), b = fn(t + dt);
    if (typeof a === 'number') return (b - a) / (2 * dt);
    if (Array.isArray(a)) return U.dist(a, b) / (2 * dt);
    return 0;
  };
  // 拉伸关键帧时间（按比例，速度反比变化）
  A.stretchKeys = (prop, keys, pivot, factor) => {
    for (const k of keys) {
      k.t = pivot + (k.t - pivot) * factor;
      if (factor !== 0) { k.ie.s /= factor; k.oe.s /= factor; }
    }
    A.sortKeys(prop);
  };
})(typeof window !== 'undefined' ? window : globalThis);
