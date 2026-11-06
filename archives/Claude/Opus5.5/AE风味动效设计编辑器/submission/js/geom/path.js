// 贝塞尔路径、折线、修剪、重采样、形变
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U;
  const P = AE.Path = {};
  const K = 0.5522847498;

  // 轮廓：{c:闭合, v:[[x,y]], i:[[dx,dy]] 入切线(相对), o:[[dx,dy]] 出切线(相对)}
  P.contour = (v, i, o, c = true) => ({ c, v, i: i || v.map(() => [0, 0]), o: o || v.map(() => [0, 0]) });
  P.rect = (cx, cy, w, h, r = 0) => {
    const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
    r = Math.min(r, w / 2, h / 2);
    if (r <= 0.01) return P.contour([[x1, y0], [x1, y1], [x0, y1], [x0, y0]]);
    const k = r * K, v = [], I = [], O = [];
    const add = (p, i, o) => { v.push(p); I.push(i); O.push(o); };
    add([x1 - r, y0], [0, 0], [k, 0]); add([x1, y0 + r], [0, -k], [0, 0]);
    add([x1, y1 - r], [0, 0], [0, k]); add([x1 - r, y1], [k, 0], [0, 0]);
    add([x0 + r, y1], [0, 0], [-k, 0]); add([x0, y1 - r], [0, k], [0, 0]);
    add([x0, y0 + r], [0, 0], [0, -k]); add([x0 + r, y0], [-k, 0], [0, 0]);
    return P.contour(v, I, O);
  };
  P.ellipse = (cx, cy, w, h) => {
    const rx = w / 2, ry = h / 2, kx = rx * K, ky = ry * K;
    return P.contour([[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]],
      [[-kx, 0], [0, -ky], [kx, 0], [0, ky]], [[kx, 0], [0, ky], [-kx, 0], [0, -ky]]);
  };
  P.star = (cx, cy, n, r1, r2, roundness = 0, rot = 0, polygon = false) => {
    const v = [], I = [], O = [], cnt = polygon ? n : n * 2;
    for (let k = 0; k < cnt; k++) {
      const a = rot * U.deg - Math.PI / 2 + k * Math.PI * 2 / cnt, r = polygon || k % 2 === 0 ? r1 : r2;
      const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      const tl = roundness / 100 * r * Math.PI * 2 / cnt / 4;
      const tx = -Math.sin(a) * tl, ty = Math.cos(a) * tl;
      v.push(p); I.push([-tx, -ty]); O.push([tx, ty]);
    }
    return P.contour(v, I, O);
  };
  P.cloneShape = s => s.map(c => ({ c: c.c, v: c.v.map(p => p.slice()), i: c.i.map(p => p.slice()), o: c.o.map(p => p.slice()) }));

  const cubic = (p0, p1, p2, p3, t) => {
    const mt = 1 - t, a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  };
  P.cubic = cubic;
  // 折线：{c, p:[x0,y0,x1,y1,...]}
  P.flatten = (ct, tol = 0.5) => {
    const n = ct.v.length, out = [];
    if (!n) return { c: ct.c, p: out };
    const segs = ct.c ? n : n - 1;
    out.push(ct.v[0][0], ct.v[0][1]);
    for (let k = 0; k < segs; k++) {
      const a = ct.v[k], b = ct.v[(k + 1) % n];
      const o = ct.o[k] || [0, 0], i = ct.i[(k + 1) % n] || [0, 0];
      const p1 = [a[0] + o[0], a[1] + o[1]], p2 = [b[0] + i[0], b[1] + i[1]];
      const straight = Math.abs(o[0]) + Math.abs(o[1]) + Math.abs(i[0]) + Math.abs(i[1]) < 1e-6;
      if (straight) { out.push(b[0], b[1]); continue; }
      const L = Math.hypot(p1[0] - a[0], p1[1] - a[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(b[0] - p2[0], b[1] - p2[1]);
      const steps = U.clamp(Math.ceil(Math.sqrt(L / Math.max(tol, 0.01)) * 1.6), 2, 256);
      for (let s = 1; s <= steps; s++) { const q = cubic(a, p1, p2, b, s / steps); out.push(q[0], q[1]); }
    }
    if (ct.c && out.length >= 4) { // 去掉与起点重合的终点
      const L = out.length; if (Math.abs(out[L - 2] - out[0]) < 1e-9 && Math.abs(out[L - 1] - out[1]) < 1e-9) out.length = L - 2;
    }
    return { c: ct.c, p: out };
  };
  P.flattenShape = (shape, tol) => shape.map(c => P.flatten(c, tol));
  P.polyLength = pl => {
    const p = pl.p, n = p.length / 2; let L = 0;
    for (let k = 1; k < n; k++) L += Math.hypot(p[2 * k] - p[2 * k - 2], p[2 * k + 1] - p[2 * k - 1]);
    if (pl.c && n > 1) L += Math.hypot(p[0] - p[2 * n - 2], p[1] - p[2 * n - 1]);
    return L;
  };
  // 累计长度表（闭合时附加回到起点的段）
  P.cumLen = pl => {
    const p = pl.p, n = p.length / 2, cnt = pl.c ? n + 1 : n, cum = new Float64Array(cnt);
    for (let k = 1; k < cnt; k++) { const a = (k - 1) % n, b = k % n; cum[k] = cum[k - 1] + Math.hypot(p[2 * b] - p[2 * a], p[2 * b + 1] - p[2 * a + 1]); }
    return cum;
  };
  // 在长度 s 处取点与切向
  P.pointAt = (pl, cum, s) => {
    const p = pl.p, n = p.length / 2, cnt = cum.length, L = cum[cnt - 1];
    if (n === 0) return { x: 0, y: 0, tx: 1, ty: 0 };
    if (n === 1) return { x: p[0], y: p[1], tx: 1, ty: 0 };
    if (pl.c) s = ((s % L) + L) % L; else s = U.clamp(s, 0, L);
    let lo = 0, hi = cnt - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const a = lo % n, b = hi % n, segL = cum[hi] - cum[lo] || 1e-9, t = (s - cum[lo]) / segL;
    const ax = p[2 * a], ay = p[2 * a + 1], bx = p[2 * b], by = p[2 * b + 1];
    const dx = bx - ax, dy = by - ay, dl = Math.hypot(dx, dy) || 1;
    return { x: ax + dx * t, y: ay + dy * t, tx: dx / dl, ty: dy / dl, seg: lo };
  };
  // 取 [s0, s1] 一段（s 为长度，闭合路径可跨越起点）
  P.subPoly = (pl, cum, s0, s1) => {
    const L = cum[cum.length - 1], out = [];
    if (s1 - s0 < 1e-6) return null;
    const p = pl.p, n = p.length / 2;
    const a = P.pointAt(pl, cum, s0); out.push(a.x, a.y);
    // 沿顶点前进
    if (pl.c) {
      let base = Math.floor(s0 / L) * L;
      let k = 0;
      const total = cum.length - 1;
      // 找到 s0 之后的第一个顶点
      let idx = 0; const ls0 = s0 - base;
      while (idx < cum.length && cum[idx] <= ls0 + 1e-9) idx++;
      let guard = 0;
      while (guard++ < total * 3) {
        if (idx >= cum.length) { idx = 1; base += L; }
        const sv = base + cum[idx];
        if (sv >= s1 - 1e-9) break;
        const vi = idx % n; out.push(p[2 * vi], p[2 * vi + 1]); idx++; k++;
      }
    } else {
      for (let idx = 0; idx < n; idx++) { if (cum[idx] > s0 + 1e-9 && cum[idx] < s1 - 1e-9) out.push(p[2 * idx], p[2 * idx + 1]); }
    }
    const b = P.pointAt(pl, cum, Math.min(s1, pl.c ? s1 : L)); out.push(b.x, b.y);
    return { c: false, p: out };
  };
  // 修剪路径：start/end/offset 为百分比/角度
  P.trim = (polys, start, end, offset, mode = 'simul') => {
    let s = start / 100, e = end / 100;
    if (s > e) [s, e] = [e, s];
    const off = (offset / 360);
    if (e - s >= 0.99999 && Math.abs(off) < 1e-9) return polys;
    if (e - s <= 1e-6) return [];
    const res = [];
    const cut = (pl, cum, a, b) => { // a,b 为 0..1 可越界（闭合）
      const L = cum[cum.length - 1]; if (L < 1e-9) return;
      if (pl.c) { const r = P.subPoly(pl, cum, a * L, b * L); if (r) res.push(r); }
      else {
        // 开放路径：把 [a,b] 平移后折回 [0,1]
        let a2 = a - Math.floor(a), b2 = a2 + (b - a);
        if (b2 <= 1 + 1e-9) { const r = P.subPoly(pl, cum, a2 * L, Math.min(b2, 1) * L); if (r) res.push(r); }
        else { const r1 = P.subPoly(pl, cum, a2 * L, L); if (r1) res.push(r1); const r2 = P.subPoly(pl, cum, 0, (b2 - 1) * L); if (r2) res.push(r2); }
      }
    };
    if (mode === 'individual') {
      // 所有路径串成一条整体长度
      const cums = polys.map(P.cumLen), lens = cums.map(c => c[c.length - 1]), tot = lens.reduce((a, b) => a + b, 0);
      if (tot < 1e-9) return [];
      let a = (s + off), b = (e + off);
      a = a - Math.floor(a); b = a + (e - s);
      const segs = b > 1 ? [[a, 1], [0, b - 1]] : [[a, b]];
      let acc = 0;
      polys.forEach((pl, k) => {
        const l0 = acc / tot, l1 = (acc + lens[k]) / tot; acc += lens[k];
        for (const [x, y] of segs) {
          const lo = Math.max(x, l0), hi = Math.min(y, l1);
          if (hi - lo > 1e-7) { const r = P.subPoly({ c: false, p: pl.c ? pl.p.concat(pl.p.slice(0, 2)) : pl.p }, P.cumLen({ c: false, p: pl.c ? pl.p.concat(pl.p.slice(0, 2)) : pl.p }), (lo - l0) * tot, (hi - l0) * tot); if (r) res.push(r); }
        }
      });
      return res;
    }
    for (const pl of polys) cut(pl, P.cumLen(pl), s + off, e + off);
    return res;
  };
  // 按弧长重采样为 n 点（可指定起点偏移比例与反向）
  P.resample = (pl, n, startFrac = 0, reverse = false) => {
    const cum = P.cumLen(pl), L = cum[cum.length - 1], out = new Array(n * 2);
    let src = pl;
    if (reverse) {
      const p = pl.p, m = p.length / 2, q = [];
      for (let k = m - 1; k >= 0; k--) q.push(p[2 * k], p[2 * k + 1]);
      src = { c: pl.c, p: q };
    }
    const c2 = reverse ? P.cumLen(src) : cum;
    const div = pl.c ? n : Math.max(1, n - 1);
    for (let k = 0; k < n; k++) {
      const s = (startFrac + k / div) * L;
      const pt = P.pointAt(src, c2, pl.c ? s : Math.min(s, L));
      out[2 * k] = pt.x; out[2 * k + 1] = pt.y;
    }
    return { c: pl.c, p: out };
  };
  P.area = p => { let a = 0; const n = p.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) a += (p[2 * j] - p[2 * i]) * (p[2 * j + 1] + p[2 * i + 1]); return a / 2; };
  P.centroid = p => { let x = 0, y = 0; const n = p.length / 2; for (let k = 0; k < n; k++) { x += p[2 * k]; y += p[2 * k + 1]; } return [x / (n || 1), y / (n || 1)]; };
  // 绕数（非零规则）
  P.winding = (polys, x, y) => {
    let w = 0;
    for (const pl of polys) {
      if (!pl.c && polys.length && pl.p.length < 6) continue;
      const p = pl.p, n = p.length / 2;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = p[2 * i], yi = p[2 * i + 1], xj = p[2 * j], yj = p[2 * j + 1];
        if (yj <= y) { if (yi > y && (xi - xj) * (y - yj) - (x - xj) * (yi - yj) > 0) w++; }
        else if (yi <= y && (xi - xj) * (y - yj) - (x - xj) * (yi - yj) < 0) w--;
      }
    }
    return w;
  };
  P.inside = (polys, x, y, rule = 'nonzero') => { const w = P.winding(polys, x, y); return rule === 'evenodd' ? (w & 1) !== 0 : w !== 0; };
  P.bounds = (polys) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const pl of polys) { const p = pl.p; for (let k = 0; k < p.length; k += 2) { if (p[k] < x0) x0 = p[k]; if (p[k] > x1) x1 = p[k]; if (p[k + 1] < y0) y0 = p[k + 1]; if (p[k + 1] > y1) y1 = p[k + 1]; } }
    return x0 === Infinity ? null : [x0, y0, x1, y1];
  };
  // 2D 仿射 [a,b,c,d,e,f]: x' = a x + c y + e, y' = b x + d y + f
  P.aff = {
    ident: () => [1, 0, 0, 1, 0, 0],
    mul: (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]],
    trs: (pos, anchor, scale, rotDeg, skew = 0, skewAxis = 0) => {
      const r = rotDeg * U.deg, c = Math.cos(r), s = Math.sin(r), sx = scale[0] / 100, sy = scale[1] / 100;
      let m = [c * sx, s * sx, -s * sy, c * sy, 0, 0];
      if (skew) { const k = Math.tan(-skew * U.deg); m = P.aff.mul(m, [1, 0, k, 1, 0, 0]); }
      m[4] = pos[0] - (m[0] * anchor[0] + m[2] * anchor[1]); m[5] = pos[1] - (m[1] * anchor[0] + m[3] * anchor[1]);
      return m;
    },
    inv: m => { const d = m[0] * m[3] - m[1] * m[2] || 1e-12; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; },
    pt: (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]],
    fromM4: m => [m[0], m[1], m[4], m[5], m[12], m[13]],
    scaleOf: m => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])),
  };
  P.xformPoly = (pl, m) => {
    const p = pl.p, q = new Array(p.length);
    for (let k = 0; k < p.length; k += 2) { const x = p[k], y = p[k + 1]; q[k] = m[0] * x + m[2] * y + m[4]; q[k + 1] = m[1] * x + m[3] * y + m[5]; }
    return { c: pl.c, p: q, hole: pl.hole };
  };
  P.xformShape = (shape, m) => shape.map(c => ({
    c: c.c, v: c.v.map(p => P.aff.pt(m, p[0], p[1])),
    i: c.i.map(p => [m[0] * p[0] + m[2] * p[1], m[1] * p[0] + m[3] * p[1]]),
    o: c.o.map(p => [m[0] * p[0] + m[2] * p[1], m[1] * p[0] + m[3] * p[1]]),
  }));
  // 路径关键帧插值：结构相同逐点插值，否则重采样
  P.lerpShape = (a, b, t) => {
    if (!a || !b) return a || b;
    const n = Math.max(a.length, b.length), out = [];
    for (let k = 0; k < n; k++) {
      const ca = a[Math.min(k, a.length - 1)], cb = b[Math.min(k, b.length - 1)];
      if (ca.v.length === cb.v.length) {
        out.push({ c: ca.c, v: ca.v.map((p, j) => U.lerpV(p, cb.v[j], t)), i: ca.i.map((p, j) => U.lerpV(p, cb.i[j], t)), o: ca.o.map((p, j) => U.lerpV(p, cb.o[j], t)) });
      } else {
        const N = Math.max(ca.v.length, cb.v.length) * 8;
        const ra = P.resample(P.flatten(ca, 0.5), N), rb = P.resample(P.flatten(cb, 0.5), N);
        const v = []; for (let j = 0; j < N; j++) v.push([U.lerp(ra.p[2 * j], rb.p[2 * j], t), U.lerp(ra.p[2 * j + 1], rb.p[2 * j + 1], t)]);
        out.push(P.contour(v, null, null, ca.c));
      }
    }
    return out;
  };
  // 路径形变：映射表 [{a, b, offset(0..1), reverse}]，按对应关系重采样后插值；保持轮廓与孔洞对应
  P.morph = (polysA, polysB, t, mapping, samples = 96) => {
    const out = [];
    const maps = mapping && mapping.length ? mapping : polysA.map((_, k) => ({ a: k, b: Math.min(k, polysB.length - 1), offset: 0, reverse: false }));
    for (const m of maps) {
      const A = polysA[m.a], B = polysB[m.b];
      if (!A || !B) continue;
      const ra = P.resample(A, samples, 0, false);
      const rb = P.resample(B, samples, m.offset || 0, !!m.reverse);
      const p = new Array(samples * 2);
      const e = t;
      for (let j = 0; j < samples * 2; j++) p[j] = ra.p[j] + (rb.p[j] - ra.p[j]) * e;
      out.push({ c: A.c && B.c, p, hole: A.hole });
    }
    return out;
  };
  // 自动匹配起点：选择使平方距离最小的偏移
  P.bestOffset = (A, B, samples = 64, reverse = false) => {
    const ra = P.resample(A, samples); let best = 0, bd = Infinity;
    for (let k = 0; k < samples; k++) {
      const rb = P.resample(B, samples, k / samples, reverse); let d = 0;
      for (let j = 0; j < samples * 2; j++) { const q = ra.p[j] - rb.p[j]; d += q * q; }
      if (d < bd) { bd = d; best = k / samples; }
    }
    return best;
  };
  // 多边形偏移（斜接，带限制）；d>0 向外（对逆时针/面积正）
  P.offsetPoly = (p, d, closed = true, miterLimit = 3) => {
    const n = p.length / 2, out = new Array(p.length);
    const sgn = P.area(p) > 0 ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const pk = closed ? (k - 1 + n) % n : Math.max(0, k - 1), nk = closed ? (k + 1) % n : Math.min(n - 1, k + 1);
      let ax = p[2 * k] - p[2 * pk], ay = p[2 * k + 1] - p[2 * pk + 1], bx = p[2 * nk] - p[2 * k], by = p[2 * nk + 1] - p[2 * k + 1];
      let la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < 1e-9) { ax = bx; ay = by; la = lb; } if (lb < 1e-9) { bx = ax; by = ay; lb = la; }
      ax /= la || 1; ay /= la || 1; bx /= lb || 1; by /= lb || 1;
      // 法线（面积正方向时外法线为 (dy,-dx)）
      const n1x = ay * sgn, n1y = -ax * sgn, n2x = by * sgn, n2y = -bx * sgn;
      let mx = n1x + n2x, my = n1y + n2y; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
      const cos = mx * n1x + my * n1y; let s = d / Math.max(cos, 1 / miterLimit);
      out[2 * k] = p[2 * k] + mx * s; out[2 * k + 1] = p[2 * k + 1] + my * s;
    }
    return out;
  };
  // Douglas-Peucker 简化
  P.simplify = (p, tol, closed) => {
    const n = p.length / 2; if (n < 4) return p.slice();
    const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
    const st = [[0, n - 1]];
    while (st.length) {
      const [a, b] = st.pop(); let md = 0, mi = -1;
      const ax = p[2 * a], ay = p[2 * a + 1], bx = p[2 * b], by = p[2 * b + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
      for (let k = a + 1; k < b; k++) { const d = Math.abs((p[2 * k] - ax) * dy - (p[2 * k + 1] - ay) * dx) / L; if (d > md) { md = d; mi = k; } }
      if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    const out = []; for (let k = 0; k < n; k++) if (keep[k]) out.push(p[2 * k], p[2 * k + 1]);
    return out;
  };
  // 闭合环简化：以离起点最远的点切成两段分别简化
  P.simplifyClosed = (p, tol) => {
    const n = p.length / 2; if (n < 5) return p.slice();
    let far = 0, fd = -1; for (let k = 1; k < n; k++) { const d = (p[2 * k] - p[0]) ** 2 + (p[2 * k + 1] - p[1]) ** 2; if (d > fd) { fd = d; far = k; } }
    const a = P.simplify(p.slice(0, far * 2 + 2), tol), b = P.simplify(p.slice(far * 2).concat(p.slice(0, 2)), tol);
    return a.slice(0, -2).concat(b.slice(0, -2));
  };
  // 把折线转成贝塞尔轮廓（直线段）
  P.polyToContour = pl => { const v = []; for (let k = 0; k < pl.p.length; k += 2) v.push([pl.p[k], pl.p[k + 1]]); return P.contour(v, null, null, pl.c); };
  // 平滑折线成贝塞尔（Catmull-Rom）
  P.smoothContour = (pts, closed = true, tension = 1) => {
    const n = pts.length, I = [], O = [];
    for (let k = 0; k < n; k++) {
      const a = pts[closed ? (k - 1 + n) % n : Math.max(0, k - 1)], b = pts[closed ? (k + 1) % n : Math.min(n - 1, k + 1)];
      const tx = (b[0] - a[0]) / 6 * tension, ty = (b[1] - a[1]) / 6 * tension;
      I.push([-tx, -ty]); O.push([tx, ty]);
    }
    if (!closed && n) { I[0] = [0, 0]; O[n - 1] = [0, 0]; }
    return P.contour(pts.map(p => p.slice()), I, O, closed);
  };
})(typeof window !== 'undefined' ? window : globalThis);
