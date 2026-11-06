// 三角化（耳切法，支持孔洞）、布尔运算、轮廓分组
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, P = AE.Path;
  const Poly = AE.Poly = {};

  // ---------- 耳切三角化 ----------
  function earcut(data, holeIndices) {
    const dim = 2, hasHoles = holeIndices && holeIndices.length;
    const outerLen = hasHoles ? holeIndices[0] * dim : data.length;
    let outerNode = linkedList(data, 0, outerLen, dim, true);
    const triangles = [];
    if (!outerNode || outerNode.next === outerNode.prev) return triangles;
    if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);
    earcutLinked(outerNode, triangles, dim, 0);
    return triangles;
  }
  function linkedList(data, start, end, dim, clockwise) {
    let last;
    if (clockwise === (signedArea(data, start, end, dim) > 0)) {
      for (let i = start; i < end; i += dim) last = insertNode(i, data[i], data[i + 1], last);
    } else {
      for (let i = end - dim; i >= start; i -= dim) last = insertNode(i, data[i], data[i + 1], last);
    }
    if (last && equals(last, last.next)) { removeNode(last); last = last.next; }
    return last;
  }
  function filterPoints(start, end) {
    if (!start) return start;
    if (!end) end = start;
    let p = start, again;
    do {
      again = false;
      if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
        removeNode(p); p = end = p.prev;
        if (p === p.next) break;
        again = true;
      } else p = p.next;
    } while (again || p !== end);
    return end;
  }
  function earcutLinked(ear, triangles, dim, pass) {
    if (!ear) return;
    let stop = ear, prev, next, guard = 0;
    while (ear.prev !== ear.next) {
      if (++guard > 1e6) break;
      prev = ear.prev; next = ear.next;
      if (isEar(ear)) {
        triangles.push(prev.i / dim | 0, ear.i / dim | 0, next.i / dim | 0);
        removeNode(ear);
        ear = next.next; stop = next.next;
        continue;
      }
      ear = next;
      if (ear === stop) {
        if (!pass) earcutLinked(filterPoints(ear), triangles, dim, 1);
        else if (pass === 1) { ear = cureLocalIntersections(filterPoints(ear), triangles, dim); earcutLinked(ear, triangles, dim, 2); }
        else if (pass === 2) splitEarcut(ear, triangles, dim);
        break;
      }
    }
  }
  function isEar(ear) {
    const a = ear.prev, b = ear, c = ear.next;
    if (area(a, b, c) >= 0) return false;
    const ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;
    const x0 = Math.min(ax, bx, cx), y0 = Math.min(ay, by, cy), x1 = Math.max(ax, bx, cx), y1 = Math.max(ay, by, cy);
    let p = c.next;
    while (p !== a) {
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && pointInTriangle(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
      p = p.next;
    }
    return true;
  }
  function cureLocalIntersections(start, triangles, dim) {
    let p = start;
    do {
      const a = p.prev, b = p.next.next;
      if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {
        triangles.push(a.i / dim | 0, p.i / dim | 0, b.i / dim | 0);
        removeNode(p); removeNode(p.next);
        p = start = b;
      }
      p = p.next;
    } while (p !== start);
    return filterPoints(p);
  }
  function splitEarcut(start, triangles, dim) {
    let a = start;
    do {
      let b = a.next.next;
      while (b !== a.prev) {
        if (a.i !== b.i && isValidDiagonal(a, b)) {
          let c = splitPolygon(a, b);
          a = filterPoints(a, a.next); c = filterPoints(c, c.next);
          earcutLinked(a, triangles, dim, 0); earcutLinked(c, triangles, dim, 0);
          return;
        }
        b = b.next;
      }
      a = a.next;
    } while (a !== start);
  }
  function eliminateHoles(data, holeIndices, outerNode, dim) {
    const queue = [];
    for (let i = 0, len = holeIndices.length; i < len; i++) {
      const start = holeIndices[i] * dim, end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
      const list = linkedList(data, start, end, dim, false);
      if (!list) continue;
      if (list === list.next) list.steiner = true;
      queue.push(getLeftmost(list));
    }
    queue.sort((a, b) => a.x - b.x);
    for (let i = 0; i < queue.length; i++) outerNode = eliminateHole(queue[i], outerNode);
    return outerNode;
  }
  function eliminateHole(hole, outerNode) {
    const bridge = findHoleBridge(hole, outerNode);
    if (!bridge) return outerNode;
    const bridgeReverse = splitPolygon(bridge, hole);
    filterPoints(bridgeReverse, bridgeReverse.next);
    return filterPoints(bridge, bridge.next);
  }
  function findHoleBridge(hole, outerNode) {
    let p = outerNode;
    const hx = hole.x, hy = hole.y;
    let qx = -Infinity, m;
    do {
      if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
        const x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
        if (x <= hx && x > qx) { qx = x; m = p.x < p.next.x ? p : p.next; if (x === hx) return m; }
      }
      p = p.next;
    } while (p !== outerNode);
    if (!m) return null;
    const stop = m, mx = m.x, my = m.y;
    let tanMin = Infinity;
    p = m;
    do {
      if (hx >= p.x && p.x >= mx && hx !== p.x && pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
        const tan = Math.abs(hy - p.y) / (hx - p.x);
        if (locallyInside(p, hole) && (tan < tanMin || (tan === tanMin && (p.x > m.x || (p.x === m.x && sectorContainsSector(m, p)))))) { m = p; tanMin = tan; }
      }
      p = p.next;
    } while (p !== stop);
    return m;
  }
  const sectorContainsSector = (m, p) => area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0;
  function getLeftmost(start) {
    let p = start, l = start;
    do { if (p.x < l.x || (p.x === l.x && p.y < l.y)) l = p; p = p.next; } while (p !== start);
    return l;
  }
  const pointInTriangle = (ax, ay, bx, by, cx, cy, px, py) =>
    (cx - px) * (ay - py) >= (ax - px) * (cy - py) && (ax - px) * (by - py) >= (bx - px) * (ay - py) && (bx - px) * (cy - py) >= (cx - px) * (by - py);
  const isValidDiagonal = (a, b) => a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) &&
    ((locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) && (area(a.prev, a, b.prev) || area(a, b.prev, b))) ||
      (equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0));
  const area = (p, q, r) => (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  const equals = (a, b) => a.x === b.x && a.y === b.y;
  const sign = n => n > 0 ? 1 : n < 0 ? -1 : 0;
  const onSegment = (p, q, r) => q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  function intersects(p1, q1, p2, q2) {
    const o1 = sign(area(p1, q1, p2)), o2 = sign(area(p1, q1, q2)), o3 = sign(area(p2, q2, p1)), o4 = sign(area(p2, q2, q1));
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    return false;
  }
  function intersectsPolygon(a, b) {
    let p = a;
    do {
      if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i && intersects(p, p.next, a, b)) return true;
      p = p.next;
    } while (p !== a);
    return false;
  }
  const locallyInside = (a, b) => area(a.prev, a, a.next) < 0 ? area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 : area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
  function middleInside(a, b) {
    let p = a, inside = false;
    const px = (a.x + b.x) / 2, py = (a.y + b.y) / 2;
    do {
      if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y && (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x)) inside = !inside;
      p = p.next;
    } while (p !== a);
    return inside;
  }
  function splitPolygon(a, b) {
    const a2 = createNode(a.i, a.x, a.y), b2 = createNode(b.i, b.x, b.y), an = a.next, bp = b.prev;
    a.next = b; b.prev = a; a2.next = an; an.prev = a2; b2.next = a2; a2.prev = b2; bp.next = b2; b2.prev = bp;
    return b2;
  }
  function insertNode(i, x, y, last) {
    const p = createNode(i, x, y);
    if (!last) { p.prev = p; p.next = p; } else { p.next = last.next; p.prev = last; last.next.prev = p; last.next = p; }
    return p;
  }
  function removeNode(p) { p.next.prev = p.prev; p.prev.next = p.next; }
  const createNode = (i, x, y) => ({ i, x, y, prev: null, next: null, steiner: false });
  function signedArea(data, start, end, dim) {
    let sum = 0;
    for (let i = start, j = end - dim; i < end; i += dim) { sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]); j = i; }
    return sum;
  }
  Poly.earcut = earcut;

  // 按嵌套深度把闭合折线分为“外轮廓 + 孔洞”（偶奇规则）
  Poly.group = (polys) => {
    const cl = polys.filter(p => p.c !== false && p.p.length >= 6);
    const info = cl.map(p => ({ p: p.p, a: Math.abs(P.area(p.p)), depth: 0, parent: -1 }));
    for (let i = 0; i < info.length; i++) {
      const pi = info[i].p; let best = -1, bestA = Infinity;
      // 用轮廓上一点（略偏移的中点）测试
      const tx = (pi[0] + pi[2]) / 2, ty = (pi[1] + pi[3]) / 2;
      for (let j = 0; j < info.length; j++) {
        if (i === j || info[j].a <= info[i].a) continue;
        if (P.inside([{ c: true, p: info[j].p }], tx, ty, 'evenodd')) { info[i].depth++; if (info[j].a < bestA) { bestA = info[j].a; best = j; } }
      }
      info[i].parent = best;
    }
    const groups = [], map = new Map();
    info.forEach((f, i) => { if (f.depth % 2 === 0) { const g = { outer: f.p, holes: [] }; map.set(i, g); groups.push(g); } });
    info.forEach((f, i) => { if (f.depth % 2 === 1 && map.has(f.parent)) map.get(f.parent).holes.push(f.p); });
    return groups;
  };
  // 三角化一组（外轮廓+孔洞）→ {pts:[x,y...], idx}
  Poly.triangulate = (g) => {
    const pts = g.outer.slice(), holes = [];
    for (const h of g.holes) { holes.push(pts.length / 2); for (const v of h) pts.push(v); }
    const idx = earcut(pts, holes);
    return { pts, idx };
  };
  Poly.triangulateAll = (polys) => {
    const groups = Poly.group(polys), pts = [], idx = [];
    for (const g of groups) { const t = Poly.triangulate(g), base = pts.length / 2; for (const v of t.pts) pts.push(v); for (const i of t.idx) idx.push(i + base); }
    return { pts, idx, groups };
  };

  // 去除闭合环上的共线点
  Poly.dropCollinear = (p, eps = 1e-9) => {
    let q = p.slice(), changed = true;
    while (changed && q.length >= 8) {
      changed = false; const n = q.length / 2, out = [];
      for (let k = 0; k < n; k++) {
        const a = (k - 1 + n) % n, b = (k + 1) % n;
        const cr = (q[2 * k] - q[2 * a]) * (q[2 * b + 1] - q[2 * a + 1]) - (q[2 * k + 1] - q[2 * a + 1]) * (q[2 * b] - q[2 * a]);
        const L = Math.hypot(q[2 * b] - q[2 * a], q[2 * b + 1] - q[2 * a + 1]) + 1e-12;
        if (Math.abs(cr) / L < eps * 10 + 1e-7 && out.length + (n - k) * 2 > 6) { changed = true; continue; }
        out.push(q[2 * k], q[2 * k + 1]);
      }
      q = out;
    }
    return q;
  };
  // ---------- 布尔运算（分割边 + 两侧绕数判定） ----------
  // A、B: 闭合折线数组（非零规则）；op: union | subtract | intersect | xor
  Poly.boolean = (A, B, op) => {
    const edges = [];
    const pushEdges = (polys, owner) => {
      for (const pl of polys) {
        const p = pl.p, n = p.length / 2; if (n < 3) continue;
        for (let k = 0; k < n; k++) { const j = (k + 1) % n; if (p[2 * k] === p[2 * j] && p[2 * k + 1] === p[2 * j + 1]) continue; edges.push({ x1: p[2 * k], y1: p[2 * k + 1], x2: p[2 * j], y2: p[2 * j + 1], owner, ts: [0, 1] }); }
      }
    };
    const Ac = A.filter(p => p.p.length >= 6).map(p => ({ c: true, p: p.p })), Bc = B.filter(p => p.p.length >= 6).map(p => ({ c: true, p: p.p }));
    pushEdges(Ac, 0); pushEdges(Bc, 1);
    const n = edges.length;
    for (let i = 0; i < n; i++) {
      const e = edges[i];
      const ex0 = Math.min(e.x1, e.x2), ex1 = Math.max(e.x1, e.x2), ey0 = Math.min(e.y1, e.y2), ey1 = Math.max(e.y1, e.y2);
      for (let j = i + 1; j < n; j++) {
        const f = edges[j];
        if (Math.max(f.x1, f.x2) < ex0 || Math.min(f.x1, f.x2) > ex1 || Math.max(f.y1, f.y2) < ey0 || Math.min(f.y1, f.y2) > ey1) continue;
        const dx1 = e.x2 - e.x1, dy1 = e.y2 - e.y1, dx2 = f.x2 - f.x1, dy2 = f.y2 - f.y1;
        const den = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((f.x1 - e.x1) * dy2 - (f.y1 - e.y1) * dx2) / den, u = ((f.x1 - e.x1) * dy1 - (f.y1 - e.y1) * dx1) / den;
        if (t > 1e-9 && t < 1 - 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) e.ts.push(t);
        if (u > 1e-9 && u < 1 - 1e-9 && t >= -1e-9 && t <= 1 + 1e-9) f.ts.push(u);
      }
    }
    const bb = P.bounds(Ac.concat(Bc)); if (!bb) return [];
    const eps = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * 1e-5 + 1e-7;
    const test = (a, b) => op === 'union' ? (a || b) : op === 'intersect' ? (a && b) : op === 'subtract' ? (a && !b) : (a !== b);
    const inA = (x, y) => P.winding(Ac, x, y) !== 0, inB = (x, y) => P.winding(Bc, x, y) !== 0;
    const out = [], seen = new Set();
    const key = (x, y) => Math.round(x * 1e4) + ',' + Math.round(y * 1e4);
    for (const e of edges) {
      e.ts.sort((a, b) => a - b);
      for (let k = 0; k < e.ts.length - 1; k++) {
        const t0 = e.ts[k], t1 = e.ts[k + 1]; if (t1 - t0 < 1e-9) continue;
        const x0 = e.x1 + (e.x2 - e.x1) * t0, y0 = e.y1 + (e.y2 - e.y1) * t0, x1 = e.x1 + (e.x2 - e.x1) * t1, y1 = e.y1 + (e.y2 - e.y1) * t1;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, L = Math.hypot(x1 - x0, y1 - y0) || 1;
        const nx = -(y1 - y0) / L * eps, ny = (x1 - x0) / L * eps;
        const left = test(inA(mx + nx, my + ny), inB(mx + nx, my + ny)), right = test(inA(mx - nx, my - ny), inB(mx - nx, my - ny));
        if (left === right) continue;
        let s = [x0, y0, x1, y1]; if (!left) s = [x1, y1, x0, y0]; // 内部在左侧
        const kk = key(s[0], s[1]) + '>' + key(s[2], s[3]);
        if (seen.has(kk)) continue; seen.add(kk);
        out.push(s);
      }
    }
    // 连接成环
    const byStart = new Map();
    out.forEach((s, i) => { const k = key(s[0], s[1]); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(i); });
    const used = new Uint8Array(out.length), loops = [];
    for (let i = 0; i < out.length; i++) {
      if (used[i]) continue;
      const loop = []; let cur = i, guard = 0;
      const startKey = key(out[i][0], out[i][1]);
      while (cur >= 0 && !used[cur] && guard++ < 100000) {
        used[cur] = 1; const s = out[cur]; loop.push(s[0], s[1]);
        const ek = key(s[2], s[3]); if (ek === startKey) break;
        const cand = byStart.get(ek) || []; cur = -1;
        for (const c of cand) if (!used[c]) { cur = c; break; }
      }
      if (loop.length >= 6) loops.push({ c: true, p: Poly.dropCollinear(loop) });
    }
    return loops.filter(l => l.p.length >= 6);
  };
})(typeof window !== 'undefined' ? window : globalThis);
