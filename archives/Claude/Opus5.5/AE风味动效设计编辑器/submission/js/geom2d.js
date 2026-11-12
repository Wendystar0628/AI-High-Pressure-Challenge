'use strict';
// ============ 二维几何：路径、展平、修剪、布尔、三角化、网格、形变 ============
const KAPPA = 0.5522847498;
const Geo2D = {
  // ---------- 路径构造 ----------
  contour(v, closed = true, i, o) { return { closed, v: v.map(p => [p[0], p[1]]), i: i || v.map(() => [0, 0]), o: o || v.map(() => [0, 0]) }; },
  rect(cx, cy, w, h, r = 0) {
    const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
    r = Math.min(Math.abs(r), Math.abs(w) / 2, Math.abs(h) / 2);
    if (r <= 0) return this.contour([[x1, y0], [x1, y1], [x0, y1], [x0, y0]]);
    const k = r * KAPPA;
    return { closed: true,
      v: [[x1, y0 + r], [x1, y1 - r], [x1 - r, y1], [x0 + r, y1], [x0, y1 - r], [x0, y0 + r], [x0 + r, y0], [x1 - r, y0]],
      i: [[0, -k], [0, 0], [k, 0], [0, 0], [0, k], [0, 0], [-k, 0], [0, 0]],
      o: [[0, 0], [0, k], [0, 0], [-k, 0], [0, 0], [0, -k], [0, 0], [k, 0]] };
  },
  ellipse(cx, cy, w, h) {
    const rx = w / 2, ry = h / 2, kx = rx * KAPPA, ky = ry * KAPPA;
    return { closed: true, v: [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]], i: [[-kx, 0], [0, -ky], [kx, 0], [0, ky]], o: [[kx, 0], [0, ky], [-kx, 0], [0, -ky]] };
  },
  polyToContour(pts, closed = true) { return this.contour(pts, closed); },
  pathBBox(path) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const c of path.c) for (const p of c.v) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return [x0, y0, x1, y1]; },
  transformPath(path, fn) { return { c: path.c.map(c => ({ closed: c.closed, v: c.v.map(p => fn(p)), i: c.i.map((d, k) => { const a = fn(c.v[k]), b = fn([c.v[k][0] + d[0], c.v[k][1] + d[1]]); return [b[0] - a[0], b[1] - a[1]]; }), o: c.o.map((d, k) => { const a = fn(c.v[k]), b = fn([c.v[k][0] + d[0], c.v[k][1] + d[1]]); return [b[0] - a[0], b[1] - a[1]]; }) })) }; },

  // ---------- 展平为折线 ----------
  // 返回 {pts:[[x,y]], closed}
  flatten(c, tol = 0.5) {
    const n = c.v.length; const out = [];
    if (!n) return { pts: out, closed: c.closed };
    const segs = c.closed ? n : n - 1;
    out.push(c.v[0].slice());
    for (let s = 0; s < segs; s++) {
      const a = c.v[s], b = c.v[(s + 1) % n], o = c.o[s] || [0, 0], ii = c.i[(s + 1) % n] || [0, 0];
      if (!o[0] && !o[1] && !ii[0] && !ii[1]) { out.push(b.slice()); continue; }
      const p1 = [a[0] + o[0], a[1] + o[1]], p2 = [b[0] + ii[0], b[1] + ii[1]];
      const len = Math.hypot(p1[0] - a[0], p1[1] - a[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(b[0] - p2[0], b[1] - p2[1]);
      const N = U.clamp(Math.ceil(Math.sqrt(len / tol) * 1.2), 2, 200);
      for (let k = 1; k <= N; k++) {
        const t = k / N, m = 1 - t;
        out.push([m * m * m * a[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * b[0], m * m * m * a[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * b[1]]);
      }
    }
    if (c.closed && out.length > 1) { const f = out[0], l = out[out.length - 1]; if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6) out.pop(); }
    return { pts: out, closed: c.closed };
  },
  flattenPath(path, tol) { return path.c.map(c => this.flatten(c, tol)).filter(p => p.pts.length > 1); },

  // ---------- 多边形工具 ----------
  area(pts) { let s = 0; for (let i = 0, n = pts.length; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; },
  inside(pt, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (((a[1] > pt[1]) !== (b[1] > pt[1])) && (pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0])) c = !c; } return c; },
  centroid(pts) { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; },
  bbox(polys) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const P of polys) for (const p of (P.pts || P)) { if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1]; } return [x0, y0, x1, y1]; },
  polyLen(pts, closed) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); return L; },
  // 按等弧长重采样
  resample(pts, closed, n) {
    const P = closed ? pts.concat([pts[0]]) : pts;
    const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = cum[cum.length - 1]; const out = []; let j = 0;
    const cnt = closed ? n : n - 1;
    for (let k = 0; k < n; k++) {
      const d = L * k / cnt;
      while (j < cum.length - 2 && cum[j + 1] < d) j++;
      const seg = cum[j + 1] - cum[j]; const f = seg > 0 ? (d - cum[j]) / seg : 0;
      out.push([P[j][0] + (P[j + 1][0] - P[j][0]) * f, P[j][1] + (P[j + 1][1] - P[j][1]) * f]);
    }
    return out;
  },
  resampleSpacing(pts, closed, h) { const L = this.polyLen(pts, closed); const n = Math.max(closed ? 3 : 2, Math.round(L / h)); return this.resample(pts, closed, n); },
  pointAt(pts, closed, d) { // 弧长 d 处的点与切线
    const P = closed ? pts.concat([pts[0]]) : pts; let acc = 0;
    for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (acc + l >= d || i === P.length - 1) { const f = l > 0 ? U.clamp((d - acc) / l, 0, 1) : 0; return { p: [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f], t: l > 0 ? [(P[i][0] - P[i - 1][0]) / l, (P[i][1] - P[i - 1][1]) / l] : [1, 0] }; } acc += l; }
    return { p: P[0] ? P[0].slice() : [0, 0], t: [1, 0] };
  },
  // Douglas-Peucker
  simplify(pts, tol, closed) {
    if (pts.length < 4) return pts;
    if (closed) {
      // 选最远两点切开
      let a = 0, b = 0, best = -1; const p0 = pts[0];
      for (let i = 1; i < pts.length; i++) { const d = (pts[i][0] - p0[0]) ** 2 + (pts[i][1] - p0[1]) ** 2; if (d > best) { best = d; b = i; } }
      const A = this.simplify(pts.slice(a, b + 1), tol, false), B = this.simplify(pts.slice(b).concat([pts[0]]), tol, false);
      return A.slice(0, -1).concat(B.slice(0, -1));
    }
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const st = [[0, pts.length - 1]]; const t2 = tol * tol;
    while (st.length) {
      const [i0, i1] = st.pop(); const a = pts[i0], b = pts[i1]; const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      let mi = -1, md = t2;
      for (let i = i0 + 1; i < i1; i++) { const p = pts[i]; let d; if (L2 < 1e-12) d = (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2; else { const c = (dx * (p[1] - a[1]) - dy * (p[0] - a[0])); d = c * c / L2; } if (d > md) { md = d; mi = i; } }
      if (mi >= 0) { keep[mi] = 1; st.push([i0, mi], [mi, i1]); }
    }
    return pts.filter((_, i) => keep[i]);
  },
  // 轮廓 → 区域 [{outer, holes}]（按包含深度，奇偶规则）
  regions(polys) {
    const P = polys.filter(p => p.length >= 3 && Math.abs(this.area(p)) > 1e-6);
    const depth = P.map((p, i) => { let d = 0; const t = p[0]; for (let j = 0; j < P.length; j++) if (j !== i && this.inside(this.innerPoint(p), P[j])) d++; return d; });
    const regs = [];
    P.forEach((p, i) => { if (depth[i] % 2 === 0) regs.push({ outer: this.area(p) > 0 ? p : p.slice().reverse(), holes: [], idx: i, d: depth[i] }); });
    P.forEach((p, i) => {
      if (depth[i] % 2 === 1) {
        let best = null; const ip = this.innerPoint(p);
        for (const r of regs) if (r.d === depth[i] - 1 && this.inside(ip, r.outer)) { if (!best || Math.abs(this.area(r.outer)) < Math.abs(this.area(best.outer))) best = r; }
        if (best) best.holes.push(this.area(p) < 0 ? p : p.slice().reverse());
      }
    });
    return regs.map(r => ({ outer: r.outer, holes: r.holes }));
  },
  innerPoint(p) { // 轮廓上一点稍向内偏移（用于包含判断，避免顶点重合）
    const a = p[0], b = p[1]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  },

  // ---------- 修剪 ----------
  // polys: [{pts, closed}]；s,e,off ∈ [0,1]
  trim(polys, s, e, off, mode) {
    if (s > e) [s, e] = [e, s];
    if (e - s >= 0.99999) return polys;
    if (e - s <= 1e-6) return [];
    const cut = (pts, closed, a, b) => { // a<b, 弧长
      const P = closed ? pts.concat([pts[0]]) : pts; const out = []; let acc = 0;
      for (let i = 1; i < P.length; i++) {
        const p0 = P[i - 1], p1 = P[i], l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const s0 = acc, s1 = acc + l; acc = s1;
        if (s1 < a || s0 > b || l === 0) continue;
        const f0 = U.clamp((a - s0) / l, 0, 1), f1 = U.clamp((b - s0) / l, 0, 1);
        const q0 = [p0[0] + (p1[0] - p0[0]) * f0, p0[1] + (p1[1] - p0[1]) * f0], q1 = [p0[0] + (p1[0] - p0[0]) * f1, p0[1] + (p1[1] - p0[1]) * f1];
        if (!out.length) out.push(q0); out.push(q1);
      }
      return out;
    };
    const one = (pts, closed, L, a, b) => { // a,b 为 [0,1]，可越界（闭合环绕）
      a += off; b += off;
      if (closed) {
        const fa = a - Math.floor(a); let fb = fa + (b - a);
        if (fb <= 1) return [{ pts: cut(pts, closed, fa * L, fb * L), closed: false }];
        const A = cut(pts, closed, fa * L, L), B = cut(pts, closed, 0, (fb - 1) * L);
        return [{ pts: A.concat(B.slice(1)), closed: false }];
      }
      a = U.clamp(a, 0, 1); b = U.clamp(b, 0, 1); if (b <= a) return [];
      return [{ pts: cut(pts, closed, a * L, b * L), closed: false }];
    };
    const res = [];
    if (mode === 'indiv') {
      const lens = polys.map(p => this.polyLen(p.pts, p.closed)); const tot = lens.reduce((x, y) => x + y, 0) || 1;
      let acc = 0; const A = (s + off) * tot, B = (e + off) * tot;
      polys.forEach((p, i) => {
        const l0 = acc, l1 = acc + lens[i]; acc = l1;
        const a = Math.max(A, l0), b = Math.min(B, l1);
        if (b > a && lens[i] > 0) res.push({ pts: cut(p.pts, p.closed, a - l0, b - l0), closed: false });
      });
      return res.filter(p => p.pts.length > 1);
    }
    for (const p of polys) { const L = this.polyLen(p.pts, p.closed); for (const q of one(p.pts, p.closed, L, s, e)) if (q.pts.length > 1) res.push(q); }
    return res;
  },

  // ---------- 栅格化 + 行进方块追踪（用于布尔运算与字形并集） ----------
  _cv: null,
  rasterCanvas(w, h) { if (!this._cv) this._cv = document.createElement('canvas'); const c = this._cv; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, w, h); return ctx; },
  // draw(ctx) 在给定变换下绘制；返回轮廓（原坐标系）
  traceRaster(bb, res, draw, tol = 0.4) {
    const pad = 3; const bw = Math.max(bb[2] - bb[0], 1e-3), bh = Math.max(bb[3] - bb[1], 1e-3);
    const sc = res / Math.max(bw, bh);
    const W = Math.ceil(bw * sc) + pad * 2, H = Math.ceil(bh * sc) + pad * 2;
    const ctx = this.rasterCanvas(W, H);
    ctx.setTransform(sc, 0, 0, sc, pad - bb[0] * sc, pad - bb[1] * sc);
    draw(ctx, sc);
    const img = ctx.getImageData(0, 0, W, H).data;
    const f = new Float32Array(W * H); for (let i = 0; i < W * H; i++) f[i] = img[i * 4 + 3] / 255;
    const cs = this.marching(f, W, H, 0.5);
    return cs.map(c => this.simplify(c, tol, true).map(p => [(p[0] - pad) / sc + bb[0], (p[1] - pad) / sc + bb[1]])).filter(c => c.length >= 3);
  },
  marching(f, W, H, th) {
    const v = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : f[y * W + x];
    const ekey = (x, y, vert) => ((y + 1) * (W + 2) + (x + 1)) * 2 + (vert ? 1 : 0);
    const ept = (x, y, vert) => { // 边上交点
      const a = v(x, y), b = vert ? v(x, y + 1) : v(x + 1, y); const t = (th - a) / ((b - a) || 1e-9); const tt = U.clamp(t, 0, 1);
      return vert ? [x + 0.5, y + tt + 0.5] : [x + tt + 0.5, y + 0.5];
    };
    const next = new Map(); const pts = new Map();
    for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
      const a = v(x, y) > th, b = v(x + 1, y) > th, c = v(x + 1, y + 1) > th, d = v(x, y + 1) > th;
      const code = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const E = { T: [x, y, false], R: [x + 1, y, true], B: [x, y + 1, false], L: [x, y, true] };
      let pairs;
      switch (code) {
        case 1: case 14: pairs = [['L', 'B']]; break;
        case 2: case 13: pairs = [['B', 'R']]; break;
        case 3: case 12: pairs = [['L', 'R']]; break;
        case 4: case 11: pairs = [['T', 'R']]; break;
        case 6: case 9: pairs = [['T', 'B']]; break;
        case 7: case 8: pairs = [['L', 'T']]; break;
        case 5: case 10: {
          const ctr = (v(x, y) + v(x + 1, y) + v(x + 1, y + 1) + v(x, y + 1)) / 4 > th;
          if (code === 5) pairs = ctr ? [['L', 'T'], ['B', 'R']] : [['L', 'B'], ['T', 'R']];
          else pairs = ctr ? [['L', 'B'], ['T', 'R']] : [['L', 'T'], ['B', 'R']];
          break;
        }
      }
      for (const [e1, e2] of pairs) {
        const A = E[e1], B2 = E[e2];
        const k1 = ekey(A[0], A[1], A[2]), k2 = ekey(B2[0], B2[1], B2[2]);
        const p1 = pts.get(k1) || ept(A[0], A[1], A[2]); pts.set(k1, p1);
        const p2 = pts.get(k2) || ept(B2[0], B2[1], B2[2]); pts.set(k2, p2);
        // 定向：高值在右侧（y 向下坐标）
        const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, dx = p2[0] - p1[0], dy = p2[1] - p1[1];
        const rx = -dy, ry = dx; const ln = Math.hypot(rx, ry) || 1;
        const sx = mx + rx / ln * 0.3 - 0.5, sy = my + ry / ln * 0.3 - 0.5;
        const bil = (px, py) => { const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0; return (v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx) * (1 - fy) + (v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx) * fy; };
        const tx = mx - rx / ln * 0.3 - 0.5, ty = my - ry / ln * 0.3 - 0.5;
        if (bil(sx, sy) >= bil(tx, ty)) next.set(k1, k2); else next.set(k2, k1);
      }
    }
    const out = []; const used = new Set();
    for (const [k0] of next) {
      if (used.has(k0)) continue;
      const poly = []; let k = k0; let guard = 0;
      while (!used.has(k) && guard++ < 1e7) { used.add(k); poly.push(pts.get(k)); k = next.get(k); if (k === undefined) break; }
      if (poly.length >= 3) out.push(poly);
    }
    return out;
  },
  // 布尔运算：A、B 为折线轮廓数组（[[x,y]...]），op: union/subtract/intersect/exclude
  boolean(groups, op, res = 900) {
    const all = groups.flat(); if (!all.length) return [];
    const bb = this.bbox(all);
    const pathOf = (ctx, polys) => { ctx.beginPath(); for (const p of polys) { ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); } };
    return this.traceRaster(bb, res, ctx => {
      ctx.fillStyle = '#fff';
      groups.forEach((g, i) => {
        if (!g.length) return;
        ctx.globalCompositeOperation = i === 0 ? 'source-over' : ({ union: 'source-over', subtract: 'destination-out', intersect: 'destination-in', exclude: 'xor' }[op] || 'source-over');
        pathOf(ctx, g); ctx.fill('nonzero');
      });
    });
  },

  // ---------- 耳切三角化（带孔） ----------
  // 输入 outer:[[x,y]], holes:[[[x,y]]]；返回 {pts:[[x,y]], tris:[i...]}
  earcut(outer, holes = []) {
    const data = []; const holeIdx = [];
    for (const p of outer) data.push(p[0], p[1]);
    for (const h of holes) { holeIdx.push(data.length / 2); for (const p of h) data.push(p[0], p[1]); }
    const tris = Earcut(data, holeIdx, 2);
    const pts = []; for (let i = 0; i < data.length; i += 2) pts.push([data[i], data[i + 1]]);
    return { pts, tris };
  },

  // ---------- 内部带点的约束 Delaunay 网格（图钉、挤出前面、变形） ----------
  mesh(outer, holes, h) {
    const O = this.resampleSpacing(outer, true, h);
    const Hs = holes.map(q => this.resampleSpacing(q, true, h)).filter(q => q.length >= 3);
    const base = this.earcut(O, Hs);
    const pts = base.pts.map(p => [p[0], p[1]]); const nb = pts.length;
    const T = [];
    for (let i = 0; i < base.tris.length; i += 3) T.push(base.tris[i], base.tris[i + 1], base.tris[i + 2]);
    const M = new TriMesh(pts, T);
    M.delaunay();
    // 内部网格点（三角格，偏离边界）
    const bb = this.bbox([O]); const rows = h * Math.sqrt(3) / 2; const loops = [O, ...Hs];
    const segDist = (p) => { let md = 1e18; for (const L of loops) for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; const dx = b[0] - a[0], dy = b[1] - a[1]; const t = U.clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1); const d = (a[0] + dx * t - p[0]) ** 2 + (a[1] + dy * t - p[1]) ** 2; if (d < md) md = d; } return Math.sqrt(md); };
    let r = 0;
    for (let y = bb[1] + rows * 0.5; y < bb[3]; y += rows, r++) for (let x = bb[0] + (r % 2 ? h / 2 : 0) + h * 0.25; x < bb[2]; x += h) {
      const p = [x + (U.rand01(r, x | 0) - 0.5) * h * 0.02, y + (U.rand01(x | 0, r) - 0.5) * h * 0.02];
      if (!this.inside(p, O) || Hs.some(q => this.inside(p, q))) continue;
      if (segDist(p) < h * 0.55) continue;
      M.insert(p);
    }
    return { pts: M.pts, tris: M.T, nBoundary: nb, loops: [O.length, ...Hs.map(q => q.length)] };
  },

  // ---------- 路径形变 ----------
  _morphCache: new WeakMap(),
  sameTopo(a, b) { if (a.c.length !== b.c.length) return false; for (let i = 0; i < a.c.length; i++) if (a.c[i].v.length !== b.c[i].v.length || a.c[i].closed !== b.c[i].closed) return false; return true; },
  morphPath(A, B, u) {
    if (u <= 0) return A; if (u >= 1) return B;
    if (this.sameTopo(A, B)) {
      const L = (x, y) => [x[0] + (y[0] - x[0]) * u, x[1] + (y[1] - x[1]) * u];
      return { c: A.c.map((c, i) => ({ closed: c.closed, v: c.v.map((p, k) => L(p, B.c[i].v[k])), i: c.i.map((p, k) => L(p, B.c[i].i[k])), o: c.o.map((p, k) => L(p, B.c[i].o[k])) })) };
    }
    let m = this._morphCache.get(A); if (!m) { m = new WeakMap(); this._morphCache.set(A, m); }
    let corr = m.get(B); if (!corr) { corr = this.correspond(A, B); m.set(B, corr); }
    return { c: corr.map(([pa, pb, closed]) => { const v = pa.map((p, k) => [p[0] + (pb[k][0] - p[0]) * u, p[1] + (pb[k][1] - p[1]) * u]); return { closed, v, i: v.map(() => [0, 0]), o: v.map(() => [0, 0]) }; }) };
  },
  // 建立轮廓对应：外轮廓对外轮廓、孔对孔，点数统一并对齐起点
  correspond(A, B) {
    const fa = this.flattenPath(A, 0.5), fb = this.flattenPath(B, 0.5);
    const cls = F => { const pol = F.map(f => f.pts); const depth = pol.map((p, i) => pol.filter((q, j) => j !== i && q.length > 2 && this.inside(this.centroid(p), q)).length); return F.map((f, i) => ({ f, hole: depth[i] % 2 === 1, c: this.centroid(f.pts), a: Math.abs(this.area(f.pts)) })); };
    const ca = cls(fa), cb = cls(fb);
    const pairs = []; const usedB = new Set();
    for (const hole of [false, true]) {
      const As = ca.filter(x => x.hole === hole).sort((x, y) => y.a - x.a), Bs = cb.filter(x => x.hole === hole).sort((x, y) => y.a - x.a);
      for (const a of As) {
        let best = null, bd = 1e18;
        for (const b of Bs) { if (usedB.has(b)) continue; const d = Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]); if (d < bd) { bd = d; best = b; } }
        if (best) { usedB.add(best); pairs.push([a, best]); } else pairs.push([a, { f: { pts: [a.c, a.c, a.c], closed: a.f.closed }, c: a.c }]);
      }
      for (const b of Bs) if (!usedB.has(b)) pairs.push([{ f: { pts: [b.c, b.c, b.c], closed: b.f.closed }, c: b.c }, b]);
    }
    return pairs.map(([a, b]) => {
      const closed = a.f.closed && b.f.closed;
      const n = U.clamp(Math.max(a.f.pts.length, b.f.pts.length, 24), 24, 400);
      let pa = this.resample(a.f.pts, closed, n), pb = this.resample(b.f.pts, closed, n);
      if (closed) {
        if ((this.area(pa) > 0) !== (this.area(pb) > 0)) pb = pb.reverse();
        let best = 0, bd = 1e18; const step = Math.max(1, Math.floor(n / 96));
        for (let s = 0; s < n; s += step) { let d = 0; for (let k = 0; k < n; k += 2) { const q = pb[(k + s) % n]; d += (pa[k][0] - q[0]) ** 2 + (pa[k][1] - q[1]) ** 2; } if (d < bd) { bd = d; best = s; } }
        pb = pb.slice(best).concat(pb.slice(0, best));
      }
      return [pa, pb, closed];
    });
  },

  // ---------- 描边几何（三角形列表，Float32 xy） ----------
  strokeTris(pts, closed, w, join = 'round', cap = 'round', out = []) {
    const n = pts.length; if (n < 2 || w <= 0) return out;
    const r = w / 2;
    const seg = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 1e-9) return; const nx = -dy / l * r, ny = dx / l * r; out.push(a[0] + nx, a[1] + ny, b[0] + nx, b[1] + ny, b[0] - nx, b[1] - ny, a[0] + nx, a[1] + ny, b[0] - nx, b[1] - ny, a[0] - nx, a[1] - ny); };
    const disc = (c, rr) => { const N = U.clamp(Math.ceil(rr * 0.8), 8, 32); for (let k = 0; k < N; k++) { const a0 = k / N * Math.PI * 2, a1 = (k + 1) / N * Math.PI * 2; out.push(c[0], c[1], c[0] + Math.cos(a0) * rr, c[1] + Math.sin(a0) * rr, c[0] + Math.cos(a1) * rr, c[1] + Math.sin(a1) * rr); } };
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) seg(pts[i], pts[(i + 1) % n]);
    // 连接
    for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
      const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      if (join === 'round') disc(p, r);
      else {
        const d1 = V2n(p[0] - a[0], p[1] - a[1]), d2 = V2n(b[0] - p[0], b[1] - p[1]);
        const cr = d1[0] * d2[1] - d1[1] * d2[0]; const s = cr > 0 ? -1 : 1;
        const n1 = [-d1[1] * r * s, d1[0] * r * s], n2 = [-d2[1] * r * s, d2[0] * r * s];
        out.push(p[0], p[1], p[0] + n1[0], p[1] + n1[1], p[0] + n2[0], p[1] + n2[1]);
        if (join === 'miter') { const m = V2n(n1[0] + n2[0], n1[1] + n2[1]); const cosH = (m[0] * n1[0] + m[1] * n1[1]) / r; if (cosH > 0.25) { const ml = r / cosH; out.push(p[0] + n1[0], p[1] + n1[1], p[0] + m[0] * ml, p[1] + m[1] * ml, p[0] + n2[0], p[1] + n2[1]); } }
      }
    }
    if (!closed) {
      if (cap === 'round') { disc(pts[0], r); disc(pts[n - 1], r); }
      else if (cap === 'square') { const ext = (a, b) => { const d = V2n(a[0] - b[0], a[1] - b[1]); seg([a[0] + d[0] * r, a[1] + d[1] * r], a); }; ext(pts[0], pts[1]); ext(pts[n - 1], pts[n - 2]); }
    }
    return out;
  },
};
function V2n(x, y) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }

// ---------- 三角网格（邻接 + Lawson 翻转 + 插点） ----------
class TriMesh {
  constructor(pts, T) {
    this.pts = pts; this.T = T;
    for (let t = 0; t < T.length / 3; t++) if (this.orient(T[t * 3], T[t * 3 + 1], T[t * 3 + 2]) < 0) { const x = T[t * 3 + 1]; T[t * 3 + 1] = T[t * 3 + 2]; T[t * 3 + 2] = x; }
    this.buildAdj(); this.last = 0;
  }
  orient(a, b, c) { const P = this.pts; return (P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0]); }
  orientP(a, b, p) { const P = this.pts; return (P[b][0] - P[a][0]) * (p[1] - P[a][1]) - (P[b][1] - P[a][1]) * (p[0] - P[a][0]); }
  buildAdj() {
    const T = this.T, N = new Int32Array(T.length).fill(-1), map = new Map();
    for (let t = 0; t < T.length / 3; t++) for (let j = 0; j < 3; j++) {
      const a = T[t * 3 + j], b = T[t * 3 + (j + 1) % 3]; const k = b * 1e7 + a;
      if (map.has(k)) { const e = map.get(k); N[t * 3 + j] = e; const u = Math.floor(e / 3); N[e] = t * 3 + j; map.delete(k); }
      else map.set(a * 1e7 + b, t * 3 + j);
    }
    this.N = Array.from(N); // 存储的是对边的“半边索引”
  }
  incircle(a, b, c, d) {
    const P = this.pts; const ax = P[a][0] - P[d][0], ay = P[a][1] - P[d][1], bx = P[b][0] - P[d][0], by = P[b][1] - P[d][1], cx = P[c][0] - P[d][0], cy = P[c][1] - P[d][1];
    return (ax * ax + ay * ay) * (bx * cy - cx * by) - (bx * bx + by * by) * (ax * cy - cx * ay) + (cx * cx + cy * cy) * (ax * by - bx * ay);
  }
  // 半边 e = t*3+j；若非法则翻转，返回是否翻转
  legal(e) {
    const T = this.T, N = this.N; const o = N[e]; if (o < 0) return false;
    const t = Math.floor(e / 3), j = e % 3, u = Math.floor(o / 3), k = o % 3;
    const a = T[t * 3 + j], b = T[t * 3 + (j + 1) % 3], c = T[t * 3 + (j + 2) % 3], d = T[u * 3 + (k + 2) % 3];
    if (this.incircle(a, b, c, d) <= 1e-9 * 0) return false;
    // 需要四边形凸
    if (this.orient(c, a, d) <= 0 || this.orient(d, b, c) <= 0) return false;
    const nbc = N[t * 3 + (j + 1) % 3], nca = N[t * 3 + (j + 2) % 3], nad = N[u * 3 + (k + 1) % 3], ndb = N[u * 3 + (k + 2) % 3];
    T[t * 3] = c; T[t * 3 + 1] = a; T[t * 3 + 2] = d;
    T[u * 3] = d; T[u * 3 + 1] = b; T[u * 3 + 2] = c;
    const set = (h, other) => { N[h] = other; if (other >= 0) N[other] = h; };
    set(t * 3, nca); set(t * 3 + 1, nad); set(t * 3 + 2, u * 3 + 2);
    set(u * 3, ndb); set(u * 3 + 1, nbc);
    return true;
  }
  delaunay() {
    const st = []; for (let e = 0; e < this.T.length; e++) st.push(e);
    let guard = 0;
    while (st.length && guard++ < 200000) { const e = st.pop(); if (this.legal(e)) { const t = Math.floor(e / 3), u = Math.floor(this.N[t * 3 + 2] / 3); st.push(t * 3, t * 3 + 1, t * 3 + 2, u * 3, u * 3 + 1, u * 3 + 2); } }
  }
  locate(p) {
    const T = this.T; let t = this.last, guard = 0; const nt = T.length / 3;
    if (t >= nt) t = 0;
    walk: while (guard++ < nt + 10) {
      for (let j = 0; j < 3; j++) {
        if (this.orientP(T[t * 3 + j], T[t * 3 + (j + 1) % 3], p) < 0) { const o = this.N[t * 3 + j]; if (o < 0) break walk; t = Math.floor(o / 3); continue walk; }
      }
      return t;
    }
    for (let q = 0; q < nt; q++) { let ok = true; for (let j = 0; j < 3; j++) if (this.orientP(T[q * 3 + j], T[q * 3 + (j + 1) % 3], p) < 0) { ok = false; break; } if (ok) return q; }
    return -1;
  }
  insert(p) {
    const t = this.locate(p); if (t < 0) return;
    const T = this.T, N = this.N; const pi = this.pts.length; this.pts.push(p);
    const a = T[t * 3], b = T[t * 3 + 1], c = T[t * 3 + 2];
    const nab = N[t * 3], nbc = N[t * 3 + 1], nca = N[t * 3 + 2];
    const t1 = T.length / 3, t2 = t1 + 1;
    T[t * 3] = a; T[t * 3 + 1] = b; T[t * 3 + 2] = pi;
    T.push(b, c, pi, c, a, pi); N.push(-1, -1, -1, -1, -1, -1);
    const set = (h, o) => { N[h] = o; if (o >= 0) N[o] = h; };
    set(t * 3, nab); set(t1 * 3, nbc); set(t2 * 3, nca);
    set(t * 3 + 1, t1 * 3 + 2); set(t1 * 3 + 1, t2 * 3 + 2); set(t2 * 3 + 1, t * 3 + 2);
    this.last = t;
    const st = [t * 3, t1 * 3, t2 * 3]; let guard = 0;
    while (st.length && guard++ < 10000) {
      const e = st.pop(); const tt = Math.floor(e / 3);
      if (this.legal(e)) { const u = Math.floor(N[tt * 3 + 2] / 3); st.push(tt * 3 + 1, u * 3); }
    }
  }
}

// ---------- Earcut（基于耳切法的多边形三角化，自行实现） ----------
function Earcut(data, holeIndices, dim) {
  const hasHoles = holeIndices && holeIndices.length, outerLen = hasHoles ? holeIndices[0] * dim : data.length;
  let outerNode = linkedList(data, 0, outerLen, dim, true); const tris = [];
  if (!outerNode || outerNode.next === outerNode.prev) return tris;
  if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);
  earcutLinked(outerNode, tris, dim, 0);
  return tris;
  function linkedList(data, start, end, dim, clockwise) {
    let last = null;
    if (clockwise === (signedArea(data, start, end, dim) > 0)) { for (let i = start; i < end; i += dim) last = insertNode(i, data[i], data[i + 1], last); }
    else { for (let i = end - dim; i >= start; i -= dim) last = insertNode(i, data[i], data[i + 1], last); }
    if (last && equals(last, last.next)) { removeNode(last); last = last.next; }
    return last;
  }
  function filterPoints(start, end) {
    if (!start) return start; if (!end) end = start;
    let p = start, again;
    do { again = false; if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) { removeNode(p); p = end = p.prev; if (p === p.next) break; again = true; } else p = p.next; } while (again || p !== end);
    return end;
  }
  function earcutLinked(ear, tris, dim, pass) {
    if (!ear) return;
    let stop = ear, prev, next;
    while (ear.prev !== ear.next) {
      prev = ear.prev; next = ear.next;
      if (isEar(ear)) { tris.push(prev.i / dim | 0, ear.i / dim | 0, next.i / dim | 0); removeNode(ear); ear = next.next; stop = next.next; continue; }
      ear = next;
      if (ear === stop) {
        if (!pass) earcutLinked(filterPoints(ear), tris, dim, 1);
        else if (pass === 1) { ear = cureLocalIntersections(filterPoints(ear), tris, dim); earcutLinked(ear, tris, dim, 2); }
        else if (pass === 2) splitEarcut(ear, tris, dim);
        break;
      }
    }
  }
  function isEar(ear) {
    const a = ear.prev, b = ear, c = ear.next;
    if (area(a, b, c) >= 0) return false;
    let p = ear.next.next;
    while (p !== ear.prev) { if (pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false; p = p.next; }
    return true;
  }
  function cureLocalIntersections(start, tris, dim) {
    let p = start;
    do { const a = p.prev, b = p.next.next; if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) { tris.push(a.i / dim | 0, p.i / dim | 0, b.i / dim | 0); removeNode(p); removeNode(p.next); p = start = b; } p = p.next; } while (p !== start);
    return filterPoints(p);
  }
  function splitEarcut(start, tris, dim) {
    let a = start;
    do { let b = a.next.next; while (b !== a.prev) { if (a.i !== b.i && isValidDiagonal(a, b)) { let c = splitPolygon(a, b); a = filterPoints(a, a.next); c = filterPoints(c, c.next); earcutLinked(a, tris, dim, 0); earcutLinked(c, tris, dim, 0); return; } b = b.next; } a = a.next; } while (a !== start);
  }
  function eliminateHoles(data, holeIndices, outerNode, dim) {
    const queue = [];
    for (let i = 0, len = holeIndices.length; i < len; i++) { const start = holeIndices[i] * dim, end = i < len - 1 ? holeIndices[i + 1] * dim : data.length; const list = linkedList(data, start, end, dim, false); if (list === list.next) list.steiner = true; queue.push(getLeftmost(list)); }
    queue.sort((a, b) => a.x - b.x);
    for (let i = 0; i < queue.length; i++) outerNode = eliminateHole(queue[i], outerNode);
    return outerNode;
  }
  function eliminateHole(hole, outerNode) {
    const bridge = findHoleBridge(hole, outerNode); if (!bridge) return outerNode;
    const bridgeReverse = splitPolygon(bridge, hole); filterPoints(bridgeReverse, bridgeReverse.next);
    return filterPoints(bridge, bridge.next);
  }
  function findHoleBridge(hole, outerNode) {
    let p = outerNode; const hx = hole.x, hy = hole.y; let qx = -Infinity, m;
    do {
      if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) { const x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y); if (x <= hx && x > qx) { qx = x; m = p.x < p.next.x ? p : p.next; if (x === hx) return m; } }
      p = p.next;
    } while (p !== outerNode);
    if (!m) return null;
    const stop = m, mx = m.x, my = m.y; let tanMin = Infinity, tan; p = m;
    do {
      if (hx >= p.x && p.x >= mx && hx !== p.x && pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
        tan = Math.abs(hy - p.y) / (hx - p.x);
        if (locallyInside(p, hole) && (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) { m = p; tanMin = tan; }
      }
      p = p.next;
    } while (p !== stop);
    return m;
  }
  function sectorContainsSector(m, p) { return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0; }
  function getLeftmost(start) { let p = start, l = start; do { if (p.x < l.x || (p.x === l.x && p.y < l.y)) l = p; p = p.next; } while (p !== start); return l; }
  function pointInTriangle(ax, ay, bx, by, cx, cy, px, py) { return (cx - px) * (ay - py) >= (ax - px) * (cy - py) && (ax - px) * (by - py) >= (bx - px) * (ay - py) && (bx - px) * (cy - py) >= (cx - px) * (by - py); }
  function isValidDiagonal(a, b) { return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) && (locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) && (area(a.prev, a, b.prev) || area(a, b.prev, b)) || equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0); }
  function area(p, q, r) { return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y); }
  function equals(p1, p2) { return p1.x === p2.x && p1.y === p2.y; }
  function intersects(p1, q1, p2, q2) { const o1 = sign(area(p1, q1, p2)), o2 = sign(area(p1, q1, q2)), o3 = sign(area(p2, q2, p1)), o4 = sign(area(p2, q2, q1)); if (o1 !== o2 && o3 !== o4) return true; if (o1 === 0 && onSegment(p1, p2, q1)) return true; if (o2 === 0 && onSegment(p1, q2, q1)) return true; if (o3 === 0 && onSegment(p2, p1, q2)) return true; if (o4 === 0 && onSegment(p2, q1, q2)) return true; return false; }
  function onSegment(p, q, r) { return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y); }
  function sign(n) { return n > 0 ? 1 : n < 0 ? -1 : 0; }
  function intersectsPolygon(a, b) { let p = a; do { if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i && intersects(p, p.next, a, b)) return true; p = p.next; } while (p !== a); return false; }
  function locallyInside(a, b) { return area(a.prev, a, a.next) < 0 ? area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 : area(a, b, a.prev) < 0 || area(a, a.next, b) < 0; }
  function middleInside(a, b) { let p = a, inside = false; const px = (a.x + b.x) / 2, py = (a.y + b.y) / 2; do { if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y && (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x)) inside = !inside; p = p.next; } while (p !== a); return inside; }
  function splitPolygon(a, b) { const a2 = new Node(a.i, a.x, a.y), b2 = new Node(b.i, b.x, b.y), an = a.next, bp = b.prev; a.next = b; b.prev = a; a2.next = an; an.prev = a2; b2.next = a2; a2.prev = b2; bp.next = b2; b2.prev = bp; return b2; }
  function insertNode(i, x, y, last) { const p = new Node(i, x, y); if (!last) { p.prev = p; p.next = p; } else { p.next = last.next; p.prev = last; last.next.prev = p; last.next = p; } return p; }
  function removeNode(p) { p.next.prev = p.prev; p.prev.next = p.next; }
  function Node(i, x, y) { this.i = i; this.x = x; this.y = y; this.prev = null; this.next = null; this.steiner = false; }
  function signedArea(data, start, end, dim) { let sum = 0; for (let i = start, j = end - dim; i < end; i += dim) { sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]); j = i; } return sum; }
}
