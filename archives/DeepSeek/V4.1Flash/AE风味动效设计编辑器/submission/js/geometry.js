/* PRISM geometry: bezier paths, shape operators, boolean, triangulation, stroking, morph */
(function () {
  const AE = window.AE, U = AE.U, M = AE.M;
  const G = (AE.G = {});
  const EPS = 1e-7;

  // ---------- path construction ----------
  function vert(p, i, o) {
    return { p: [p[0], p[1]], in: i ? [i[0], i[1]] : [p[0], p[1]], out: o ? [o[0], o[1]] : [p[0], p[1]] };
  }
  G.vert = vert;
  function pathFromPoints(pts, closed = true, auto = true) {
    const verts = pts.map(p => vert(p));
    if (auto && pts.length > 2) {
      const n = verts.length;
      for (let i = 0; i < n; i++) {
        const p = verts[i].p, a = verts[(i - 1 + n) % n].p, b = verts[(i + 1) % n].p;
        const tx = (b[0] - a[0]) / 6, ty = (b[1] - a[1]) / 6;
        verts[i].in = [p[0] - tx, p[1] - ty];
        verts[i].out = [p[0] + tx, p[1] + ty];
      }
      if (!closed) { verts[0].in = verts[0].p.slice(); verts[n - 1].out = verts[n - 1].p.slice(); }
    }
    return { closed, verts };
  }
  G.pathFromPoints = pathFromPoints;
  G.shape = (...contours) => ({ contours: contours.filter(Boolean) });
  G.cloneShape = s => U.deepClone(s);
  G.transformShape = (shape, m) => ({
    contours: shape.contours.map(c => ({
      closed: c.closed, verts: c.verts.map(v => {
        const ap = U.affine.apply(m, v.p[0], v.p[1]), ai = U.affine.apply(m, v.in[0], v.in[1]), ao = U.affine.apply(m, v.out[0], v.out[1]);
        return { p: ap, in: ai, out: ao };
      })
    }))
  });
  G.translateShape = (s, x, y) => G.transformShape(s, [1, 0, 0, 1, x, y]);
  G.scaleShape = (s, sx, sy, ax = 0, ay = 0) => G.transformShape(s, [sx, 0, 0, sy, ax - sx * ax, ay - sy * ay]);
  G.rotateShape = (s, a, cx = 0, cy = 0) => {
    const c = Math.cos(a), sn = Math.sin(a);
    return G.transformShape(s, [c, sn, -sn, c, cx - (c * cx - sn * cy), cy - (sn * cx + c * cy)]);
  };

  G.rect = (w, h, x = 0, y = 0, r = 0) => {
    const verts = [];
    const hw = w / 2, hh = h / 2;
    r = Math.min(r, Math.abs(hw), Math.abs(hh));
    if (r <= .001) {
      [x - hw, y - hh], [x + hw, y - hh], [x + hw, y + hh], [x - hw, y + hh];
      return { contours: [pathFromPoints([[x - hw, y - hh], [x + hw, y - hh], [x + hw, y + hh], [x - hw, y + hh]], true, false)] };
    }
    const c = r * .5522847498;
    const pts = [
      [x - hw + r, y - hh], [x + hw - r, y - hh], [x + hw, y - hh + r], [x + hw, y + hh - r],
      [x + hw - r, y + hh], [x - hw + r, y + hh], [x - hw, y + hh - r], [x - hw, y - hh + r]
    ];
    const cs = [[x + hw - r + c, y - hh], [x + hw, y - hh + r - c], [x + hw, y + hh - r + c], [x + hw - r + c, y + hh], [x - hw + r - c, y + hh], [x - hw, y + hh - r + c], [x - hw, y - hh + r - c], [x - hw + r - c, y - hh]];
    const v = pts.map((p, i) => vert(p));
    v[1].out = cs[0]; v[2].in = cs[0]; // top-right
    v[3].out = cs[1]; v[4].in = cs[1]; // bottom-right
    v[5].out = cs[2]; v[6].in = cs[2]; // bottom-left
    v[7].out = cs[3]; v[0].in = cs[3]; // top-left
    return { contours: [{ closed: true, verts: v }] };
  };

  G.ellipse = (rx, ry, x = 0, y = 0) => {
    const k = .5522847498307936;
    const verts = [
      { p: [x + rx, y], in: [x + rx, y - ry * k], out: [x + rx, y + ry * k] },
      { p: [x, y + ry], in: [x + rx * k, y + ry], out: [x - rx * k, y + ry] },
      { p: [x - rx, y], in: [x - rx, y + ry * k], out: [x - rx, y - ry * k] },
      { p: [x, y - ry], in: [x - rx * k, y - ry], out: [x + rx * k, y - ry] }
    ];
    return { contours: [{ closed: true, verts }] };
  };
  G.circle = (r, x = 0, y = 0) => G.ellipse(r, r, x, y);
  G.star = (r1, r2, points = 6, x = 0, y = 0, inset = 0) => {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / points, r = i % 2 ? r2 : r1;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    return { contours: [pathFromPoints(pts, true, false)] };
  };
  G.polygon = (r, n = 6, x = 0, y = 0, rot = 0) => {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = rot - Math.PI / 2 + i * Math.PI * 2 / n; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    return { contours: [pathFromPoints(pts, true, false)] };
  };

  // ---------- sampling ----------
  G.sampleContour = (c, stepsPerSeg = 16) => {
    const pts = [], n = c.verts.length;
    if (!n) return pts;
    for (let i = 0; i < n; i++) {
      const a = c.verts[i], b = c.verts[(i + 1) % n];
      if (!c.closed && i === n - 1) break;
      for (let s = 0; s < stepsPerSeg; s++) {
        const t = s / stepsPerSeg, mt = 1 - t;
        pts.push([
          mt * mt * mt * a.p[0] + 3 * mt * mt * t * a.out[0] + 3 * mt * t * t * b.in[0] + t * t * t * b.p[0],
          mt * mt * mt * a.p[1] + 3 * mt * mt * t * a.out[1] + 3 * mt * t * t * b.in[1] + t * t * t * b.p[1]
        ]);
      }
    }
    if (!c.closed) {
      const l = c.verts[n - 1]; pts.push(l.p.slice());
    }
    return pts;
  };
  G.flattenShape = (shape, steps = 14) => shape.contours.map(c => G.sampleContour(c, steps));

  G.contourBounds = (c) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const v of c.verts) for (const p of [v.p, v.in, v.out]) {
      x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };
  G.bounds = (shape) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of shape.contours) { const b = G.contourBounds(c); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
    if (!isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };

  // signed area of polygon (positive = counterclockwise in y-down? just consistent)
  G.polyArea = (pts) => { let a = 0; for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  G.polyLength = (pts, closed = true) => { let d = 0; for (let i = 1; i < pts.length; i++) d += U.lerp(0, 1, 0) + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (closed && pts.length) d += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); return d; };
  G.pointInPoly = (pt, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  };
  G.pointInShape = (pt, polys) => { let inside = false; for (const p of polys) if (G.pointInPoly(pt, p)) inside = !inside; return inside; };
  G.distToPolyline = (p, pts, closed) => {
    let best = Infinity;
    for (let i = 1; i < pts.length; i++) best = Math.min(best, segDist(p, pts[i - 1], pts[i]));
    if (closed && pts.length > 2) best = Math.min(best, segDist(p, pts[pts.length - 1], pts[0]));
    return best;
  };
  function segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0; t = U.clamp(t);
    return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
  }
  G.segDist = segDist;

  // ---------- resample ----------
  G.resampleContour = (c, count, opts = {}) => {
    const flat = G.sampleContour(c, 20);
    if (flat.length < 2) return [pathFromPoints(flat, c.closed, false)];
    const closed = c.closed;
    const pts = closed ? flat : flat.slice();
    if (closed) pts.push(pts[0].slice());
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = lens[lens.length - 1] || 1;
    const out = [];
    let start = (opts.start || 0) % 1;
    if (start < 0) start += 1;
    const dir = opts.reverse ? -1 : 1;
    for (let i = 0; i < count; i++) {
      let t = (start + dir * i / count) % 1; if (t < 0) t += 1;
      const target = t * total;
      let k = 1; while (k < lens.length - 1 && lens[k] < target) k++;
      const t0 = lens[k - 1], t1 = lens[k] || lens[k - 1];
      const f = t1 > t0 ? (target - t0) / (t1 - t0) : 0;
      out.push([U.lerp(pts[k - 1][0], pts[k][0], f), U.lerp(pts[k - 1][1], pts[k][1], f)]);
    }
    return out;
  };
  G.resampleShape = (shape, count, opts) => ({ contours: shape.contours.map(c => pathFromPoints(G.resampleContour(c, count, opts), c.closed, true)) });
  G.morphShapes = (a, b, t, opts = {}) => {
    if (!a || !b) return t < .5 ? a : b;
    const ac = a.contours, bc = b.contours;
    const n = Math.max(ac.length, bc.length);
    const count = opts.resample || 96;
    const contours = [];
    for (let i = 0; i < n; i++) {
      const ca = ac[Math.min(i, ac.length - 1)], cb = bc[Math.min(i, bc.length - 1)];
      const pa = G.resampleContour(ca, count, { start: opts.startA || 0, reverse: opts.reverseA });
      const pb = G.resampleContour(cb, count, { start: opts.startB || 0, reverse: opts.reverseB });
      let pts = pa.map((p, k) => [U.lerp(p[0], pb[k][0], t), U.lerp(p[1], pb[k][1], t)]);
      contours.push(pathFromPoints(pts, ca.closed && cb.closed, true));
    }
    return { contours };
  };

  // ---------- trimming ----------
  G.trimShape = (shape, start, end, offset = 0) => {
    let s = U.clamp(Math.min(start, end), 0, 1), e = U.clamp(Math.max(start, end), 0, 1);
    if (e - s < 1e-5) return { contours: [] };
    const flipped = end < start;
    const out = [];
    for (const c of shape.contours) {
      const pts = G.sampleContour(c, 24);
      const closed = c.closed;
      if (pts.length < 2) { out.push(c); continue; }
      const wp = closed ? pts.concat([pts[0]]) : pts;
      const lens = [0];
      for (let i = 1; i < wp.length; i++) lens.push(lens[i - 1] + Math.hypot(wp[i][0] - wp[i - 1][0], wp[i][1] - wp[i - 1][1]));
      const total = lens[lens.length - 1] || 1;
      const get = (u) => {
        u = U.mod(u, 1); if (!closed) u = U.clamp(u, 0, 1);
        const target = u * total;
        let k = 1; while (k < lens.length - 1 && lens[k] < target) k++;
        const f = (target - lens[k - 1]) / ((lens[k] - lens[k - 1]) || 1);
        return [U.lerp(wp[k - 1][0], wp[k][0], f), U.lerp(wp[k - 1][1], wp[k][1], f)];
      };
      const range = e - s;
      const startU = s + offset * (closed ? 1 : 0);
      const pieces = [];
      let nSeg = closed ? 1 : 1;
      const steps = Math.max(2, Math.ceil(72 * range));
      const arr = [];
      for (let i = 0; i <= steps; i++) {
        let u = startU + (end - s) * (i / steps) * (flipped ? -1 : 1);
        if (!closed && !flipped) u = s + range * (i / steps);
        else if (!closed && flipped) u = e - range * (i / steps);
        arr.push(get(u));
      }
      if (closed && range >= .9999 && Math.abs(offset % 1) < 1e-6) { out.push(c); continue; }
      out.push(pathFromPoints(arr, false, false));
    }
    return { contours: out };
  };

  // ---------- stroking ----------
  G.strokeShape = (shape, width, opts = {}) => {
    const cap = opts.cap || 'butt', join = opts.join || 'miter', miterLimit = opts.miterLimit || 4;
    const hw = Math.max(.05, width / 2);
    const positions = [], indices = [], uvs = [], srcPos = [];
    let vi = 0;
    for (const c of shape.contours) {
      let pts = G.sampleContour(c, opts.steps || 18);
      const closed = c.closed;
      if (pts.length < 2) continue;
      if (closed) pts.push(pts[0].slice());
      // remove near duplicates
      const pp = [];
      for (const p of pts) if (!pp.length || Math.hypot(p[0] - pp[pp.length - 1][0], p[1] - pp[pp.length - 1][1]) > .01) pp.push(p);
      pts = pp;
      if (pts.length < 2) continue;
      const normals = [];
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(n - 1, i + 1)];
        let dx = next[0] - prev[0], dy = next[1] - prev[1]; const l = Math.hypot(dx, dy) || 1;
        normals.push([-dy / l, dx / l]);
      }
      if (closed) normals[n - 1] = normals[0];
      for (let i = 0; i < n; i++) {
        const p = pts[i], nm = normals[i];
        positions.push(p[0] + nm[0] * hw, p[1] + nm[1] * hw, p[0] - nm[0] * hw, p[1] - nm[1] * hw);
        uvs.push(0, 1, 0, -1);
      }
      for (let i = 1; i < n; i++) {
        const a = (i - 1) * 2, b = i * 2;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
      const isClosed = c.closed;
      if (isClosed && n > 2) {
        // join last->first (duplicate point) already creates seam; add bevel-ish fill at seam via round cap
        const a = (n - 1) * 2, b = 0;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      } else if (cap === 'round') {
        for (const end of [0, n - 1]) {
          const p = pts[end], base = end * 2;
          const dir = end === 0 ? [pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]] : [pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]];
          const l = Math.hypot(dir[0], dir[1]) || 1;
          const a = [dir[0] / l, dir[1] / l], bnm = [-a[1], a[0]];
          const centerI = positions.length / 2;
          positions.push(p[0], p[1]); uvs.push(.5, 0);
          const segs = 8;
          for (let k = 0; k <= segs; k++) {
            const ang = -Math.PI / 2 + Math.PI * k / segs;
            positions.push(p[0] + (-a[0] * Math.cos(ang) + bnm[0] * Math.sin(ang)) * hw, p[1] + (-a[1] * Math.cos(ang) + bnm[1] * Math.sin(ang)) * hw);
            uvs.push(.5, 0);
          }
          for (let k = 0; k < segs; k++) indices.push(centerI, centerI + 1 + k, centerI + 2 + k);
        }
      } else if (cap === 'square') {
        for (const end of [0, n - 1]) {
          const p = pts[end], base = end * 2;
          const dir = end === 0 ? [p[0] - pts[1][0], p[1] - pts[1][1]] : [p[0] - pts[n - 2][0], p[1] - pts[n - 2][1]];
          const l = Math.hypot(dir[0], dir[1]) || 1;
          const ex = dir[0] / l * hw, ey = dir[1] / l * hw;
          const vi2 = positions.length / 2;
          positions.push(p[0] + normals[end][0] * hw + ex, p[1] + normals[end][1] * hw + ey, p[0] - normals[end][0] * hw + ex, p[1] - normals[end][1] * hw + ey);
          uvs.push(0, 0, 0, 0);
          indices.push(base, vi2, base + 1, base + 1, vi2, vi2 + 1);
        }
      }
    }
    return { positions: new Float32Array(positions), indices: new Uint32Array(indices), uvs: new Float32Array(uvs) };
  };

  // ---------- ear clipping with holes ----------
  function signedArea(ring) { let a = 0; for (let i = 0, n = ring.length; i < n; i++) { const p = ring[i], q = ring[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function pairHoles(contours) {
    const rings = contours.map(c => {
      let r = c;
      return r;
    }).filter(r => r.length >= 3);
    const infos = rings.map((r, i) => ({ i, r, area: Math.abs(signedArea(r)), inside: [] }));
    for (let i = 0; i < infos.length; i++) for (let j = 0; j < infos.length; j++) {
      if (i === j) continue;
      if (infos[j].area > infos[i].area && G.pointInPoly(infos[i].r[0], infos[j].r)) infos[i].inside.push(j);
    }
    const outers = [], holes = [];
    for (const inf of infos) (inf.inside.length % 2 === 0 ? outers : holes).push(inf);
    for (const h of holes) {
      let best = null;
      for (const o of outers) if (G.pointInPoly(h.r[0], o.r)) { if (!best || o.area < best.area) best = o; }
      if (best) { best.holes = best.holes || []; best.holes.push(h); }
      else h.orphan = true;
    }
    return { outers, holes };
  }
  function bridgeHole(outer, hole) {
    // ensure outer CCW and hole CW
    if (signedArea(outer) < 0) outer = outer.slice().reverse();
    if (signedArea(hole) > 0) hole = hole.slice().reverse();
    // rightmost hole vertex
    let hi = 0; for (let i = 1; i < hole.length; i++) if (hole[i][0] > hole[hi][0]) hi = i;
    const H = hole[hi];
    // Find visible outer vertex: try nearest candidates with segment intersection test
    const cands = outer.map((p, i) => ({ p, i, d: (p[0] - H[0]) ** 2 + (p[1] - H[1]) ** 2 })).sort((a, b) => a.d - b.d);
    const allRings = [outer, hole];
    const intersects = (a, b) => {
      for (const ring of allRings) for (let i = 0; i < ring.length; i++) {
        const c = ring[i], d = ring[(i + 1) % ring.length];
        if (c === a || d === a || c === b || d === b) continue;
        if (segIntersect(a, b, c, d)) return true;
      }
      return false;
    };
    let oi = cands[0].i;
    for (const c of cands) { if (!intersects(H, c.p)) { oi = c.i; break; } }
    const rot = (arr, k) => arr.slice(k).concat(arr.slice(0, k));
    const o2 = rot(outer, oi);
    const h2 = rot(hole, hi).concat([hole[hi]]);
    return o2.concat(h2, [o2[0]]);
  }
  function segIntersect(a, b, c, d) {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
    return o1 !== o2 && o3 !== o4;
  }
  function earClip(poly) {
    const n = poly.length;
    if (n < 3) return [];
    let pts = poly.map(p => [p[0], p[1]]);
    if (signedArea(pts) < 0) pts = pts.reverse();
    const prev = new Int32Array(n), next = new Int32Array(n);
    const alive = new Uint8Array(n).fill(1);
    for (let i = 0; i < n; i++) { prev[i] = (i - 1 + n) % n; next[i] = (i + 1) % n; }
    const out = [];
    let cur = 0, remaining = n, guard = 0;
    const cross = (A, B, C) => (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    const pointInTri = (p, A, B, C) => {
      const d1 = cross(A, B, p), d2 = cross(B, C, p), d3 = cross(C, A, p);
      return !((d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9) && (d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9));
    };
    while (remaining > 3 && guard++ < n * n + 200) {
      let p = prev[cur], nx = next[cur];
      if (cross(pts[p], pts[cur], pts[nx]) <= 1e-10) { cur = nx; continue; }
      let ok = true;
      let v = next[nx];
      while (v !== p) {
        if (alive[v] && pointInTri(pts[v], pts[p], pts[cur], pts[nx])) { ok = false; break; }
        v = next[v];
      }
      if (!ok) { cur = nx; continue; }
      out.push(p, cur, nx);
      alive[cur] = 0; next[p] = nx; prev[nx] = p; remaining--;
      cur = p;
      guard = 0;
    }
    if (remaining >= 3) {
      const left = [];
      let s = -1;
      for (let i = 0; i < n; i++) if (alive[i]) { s = i; break; }
      if (s >= 0) { let v = s; do { left.push(v); v = next[v]; } while (v !== s && left.length <= n); }
      for (let i = 1; i + 1 < left.length; i++) out.push(left[0], left[i], left[i + 1]);
    }
    return out;
  }
  G.triangulate2D = (contours) => {
    return G.scanlineTriangulate(contours);
  };

  // ---------- earcut ----------
  function ENode(i, x, y) { return { i, x, y, prev: null, next: null, steiner: false }; }
  function insertNode(i, x, y, last) {
    const p = ENode(i, x, y);
    if (!last) { p.prev = p; p.next = p; }
    else { p.next = last.next; p.prev = last; last.next.prev = p; last.next = p; }
    return p;
  }
  function removeNode(p) { p.next.prev = p.prev; p.prev.next = p.next; }
  function eArea(p, q, r) { return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y); }
  function eEquals(p1, p2) { return p1.x === p2.x && p1.y === p2.y; }
  function eSignedArea(data, start, end, dim) {
    let sum = 0;
    for (let i = start, j = end - dim; i < end; i += dim) {
      const x0 = data[i], y0 = data[i + 1], x1 = data[j], y1 = data[j + 1];
      sum += (x0 - x1) * (y0 + y1); j = i;
    }
    return sum;
  }
  function linkedList(data, start, end, dim, clockwise) {
    let last = null;
    if (clockwise === (eSignedArea(data, start, end, dim) > 0)) {
      for (let i = start; i < end; i += dim) last = insertNode(i, data[i], data[i + 1], last);
    } else {
      for (let i = end - dim; i >= start; i -= dim) last = insertNode(i, data[i], data[i + 1], last);
    }
    if (last && eEquals(last, last.next)) { removeNode(last); last = last.next; }
    return last;
  }
  function filterPoints(start, end) {
    if (!start) return start;
    if (!end) end = start;
    let p = start, again;
    do {
      again = false;
      if (!p.steiner && (eEquals(p, p.next) || eArea(p.prev, p, p.next) === 0)) {
        removeNode(p); p = end = p.prev;
        if (p === p.next) break;
        again = true;
      } else p = p.next;
    } while (again || p !== end);
    return end;
  }
  function pointInTri(ax, ay, bx, by, cx, cy, px, py) {
    return (cx - px) * (ay - py) - (ax - px) * (cy - py) >= 0 &&
      (ax - px) * (by - py) - (bx - px) * (ay - py) >= 0 &&
      (bx - px) * (cy - py) - (cx - px) * (by - py) >= 0;
  }
  function locallyInside(a, b) {
    return eArea(a.prev, a, a.next) < 0
      ? eArea(a, b, a.next) >= 0 && eArea(a, a.prev, b) >= 0
      : eArea(a, b, a.prev) < 0 || eArea(a, a.next, b) < 0;
  }
  function isEar(ear) {
    const a = ear.prev, b = ear, c = ear.next;
    if (eArea(a, b, c) >= 0) return false;
    let p = ear.next.next;
    while (p !== ear.prev) {
      if (p !== a && p !== c && pointInTri(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) && eArea(p.prev, p, p.next) >= 0) return false;
      p = p.next;
    }
    return true;
  }
  function getLeftmost(start) {
    let p = start, left = start;
    do { if (p.x < left.x || (p.x === left.x && p.y < left.y)) left = p; p = p.next; } while (p !== start);
    return left;
  }
  function findHoleBridge(hole, outerNode) {
    let p = outerNode, hx = hole.x, hy = hole.y, qx = -Infinity, m = null;
    do {
      if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
        const x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
        if (x <= hx && x > qx) {
          qx = x;
          m = p.x < p.next.x ? p : p.next;
          if (x === hx) return m;
        }
      }
      p = p.next;
    } while (p !== outerNode);
    if (!m) return null;
    const stop = m, mx = m.x, my = m.y;
    let tanMin = Infinity;
    p = m;
    do {
      if (hx >= p.x && p.x >= mx && hx !== p.x &&
        pointInTri(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
        const tan = Math.abs(hy - p.y) / (hx - p.x);
        if (locallyInside(p, hole) && tan < tanMin) { m = p; tanMin = tan; }
      }
      p = p.next;
    } while (p !== stop);
    return m;
  }
  function splitPolygon(a, b) {
    const a2 = ENode(a.i, a.x, a.y), b2 = ENode(b.i, b.x, b.y);
    const an = a.next, bp = b.prev;
    a.next = b; b.prev = a;
    a2.next = an; an.prev = a2;
    b2.next = a2; a2.prev = b2;
    bp.next = b2; b2.prev = bp;
    return b2;
  }
  function eliminateHoles(data, holeIndices, outerNode, dim) {
    const queue = [];
    for (let i = 0; i < holeIndices.length; i++) {
      const start = holeIndices[i] * dim;
      const end = i < holeIndices.length - 1 ? holeIndices[i + 1] * dim : data.length;
      const list = linkedList(data, start, end, dim, false);
      if (list === list.next) list.steiner = true;
      queue.push(getLeftmost(list));
    }
    queue.sort((a, b) => a.x - b.x);
    for (const q of queue) {
      if (q === q.next) continue;
      const bridge = findHoleBridge(q, outerNode);
      if (!bridge) continue;
      const bridgeReverse = splitPolygon(bridge, q);
      filterPoints(bridgeReverse, bridgeReverse.next);
      outerNode = filterPoints(bridge, bridge.next);
    }
    return outerNode;
  }
  function intersects(p1, q1, p2, q2) {
    const o1 = Math.sign(eArea(p1, q1, p2)), o2 = Math.sign(eArea(p1, q1, q2));
    const o3 = Math.sign(eArea(p2, q2, p1)), o4 = Math.sign(eArea(p2, q2, q1));
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && p2.x >= Math.min(p1.x, q1.x) && p2.x <= Math.max(p1.x, q1.x) && p2.y >= Math.min(p1.y, q1.y) && p2.y <= Math.max(p1.y, q1.y)) return true;
    if (o2 === 0 && q2.x >= Math.min(p1.x, q1.x) && q2.x <= Math.max(p1.x, q1.x) && q2.y >= Math.min(p1.y, q1.y) && q2.y <= Math.max(p1.y, q1.y)) return true;
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
  function middleInside(a, b) {
    let p = a, inside = false;
    const px = (a.x + b.x) / 2, py = (a.y + b.y) / 2;
    do {
      if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y && (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x)) inside = !inside;
      p = p.next;
    } while (p !== a);
    return inside;
  }
  function isValidDiagonal(a, b) {
    return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) &&
      (locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) &&
        (eArea(a.prev, a, b.prev) !== 0 || eArea(a, b.prev, b) !== 0)) ||
      (eEquals(a, b) && eArea(a.prev, a, a.next) > 0 && eArea(b.prev, b, b.next) > 0);
  }
  function cureLocalIntersections(start, triangles, dim) {
    let p = start;
    do {
      const a = p.prev, b = p.next.next;
      if (!eEquals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {
        triangles.push(a.i / dim, p.i / dim, b.i / dim);
        removeNode(p); removeNode(p.next);
        p = start = b;
      }
      p = p.next;
    } while (p !== start);
    return filterPoints(p);
  }
  function splitEarcut(start, triangles, dim, minX, minY, invSize) {
    let a = start;
    do {
      let b = a.next.next;
      while (b !== a.prev) {
        if (a.i !== b.i && isValidDiagonal(a, b)) {
          let c = splitPolygon(a, b);
          a = filterPoints(a, a.next);
          c = filterPoints(c, c.next);
          earcutLinked(a, triangles, dim, minX, minY, invSize, 0);
          earcutLinked(c, triangles, dim, minX, minY, invSize, 0);
          return;
        }
        b = b.next;
      }
      a = a.next;
    } while (a !== start);
  }
  function earcutLinked(ear, triangles, dim, minX, minY, invSize, pass) {
    if (!ear) return;
    let stop = ear;
    while (ear.prev !== ear.next) {
      const prev = ear.prev, next = ear.next;
      if (isEar(ear)) {
        triangles.push(prev.i / dim, ear.i / dim, next.i / dim);
        removeNode(ear);
        ear = next.next; stop = next.next;
        continue;
      }
      ear = next;
      if (ear === stop) {
        if (!pass) earcutLinked(filterPoints(ear), triangles, dim, minX, minY, invSize, 1);
        else if (pass === 1) {
          ear = cureLocalIntersections(filterPoints(ear), triangles, dim);
          earcutLinked(ear, triangles, dim, minX, minY, invSize, 2);
        } else if (pass === 2) splitEarcut(ear, triangles, dim, minX, minY, invSize);
        break;
      }
    }
  }
  function earcutData(data, holeIndices, dim) {
    const triangles = [];
    const outerLen = holeIndices.length ? holeIndices[0] * dim : data.length;
    let outer = linkedList(data, 0, outerLen, dim, true);
    if (!outer || outer.next === outer.prev) return triangles;
    if (holeIndices.length) outer = eliminateHoles(data, holeIndices, outer, dim);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let p = outer;
    do { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); p = p.next; } while (p !== outer);
    const invSize = Math.max(maxX - minX, maxY - minY) ? 32767 / Math.max(maxX - minX, maxY - minY) : 0;
    earcutLinked(outer, triangles, dim, minX, minY, invSize, 0);
    return triangles;
  }
  function ringContainsPoint(ring, pt) { return G.pointInPoly(pt, ring); }
  function earcutShape(rings) {
    // classify by containment depth
    const info = rings.map((r, idx) => ({ r, area: Math.abs(G.polyArea(r)), pt: r[0], depth: 0 }));
    for (let i = 0; i < info.length; i++) {
      for (let j = 0; j < info.length; j++) {
        if (i === j) continue;
        if (info[j].area > info[i].area && ringContainsPoint(info[j].r, info[i].pt)) info[i].depth++;
      }
    }
    const outers = info.filter(x => x.depth % 2 === 0);
    const holes = info.filter(x => x.depth % 2 === 1);
    const positions = [], indices = [];
    for (const outer of outers) {
      const groupHoles = holes.filter(h => ringContainsPoint(outer.r, h.pt) && !outers.some(o => o !== outer && o.area < outer.area && ringContainsPoint(o.r, h.pt)));
      const data = [];
      for (const p of outer.r) data.push(p[0], p[1]);
      const holeIndices = [];
      for (const h of groupHoles) { holeIndices.push(data.length / 2); for (const p of h.r) data.push(p[0], p[1]); }
      const tris = earcutData(data, holeIndices, 2);
      for (let i = 0; i < tris.length; i += 3) {
        const ia = tris[i] * 2, ib = tris[i + 1] * 2, ic = tris[i + 2] * 2;
        const base = positions.length / 2;
        positions.push(data[ia], data[ia + 1], data[ib], data[ib + 1], data[ic], data[ic + 1]);
        indices.push(base, base + 1, base + 2);
      }
    }
    return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
  }

  // robust even-odd scanline triangulation: works with concave glyph contours and holes
  G.scanlineTriangulate = (contours) => {
    const rings = [];
    for (let c of contours) {
      const clean = [];
      for (const p of c) {
        if (!isFinite(p[0]) || !isFinite(p[1])) continue;
        if (!clean.length || Math.hypot(p[0] - clean[clean.length - 1][0], p[1] - clean[clean.length - 1][1]) > 1e-5) clean.push([p[0], p[1]]);
      }
      if (clean.length > 1 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) < 1e-5) clean.pop();
      if (clean.length >= 3) rings.push(clean);
    }
    if (!rings.length) return { positions: new Float32Array(0), indices: new Uint32Array(0) };
    const ys = [];
    for (const r of rings) for (const p of r) ys.push(p[1]);
    ys.sort((a, b) => a - b);
    const uniq = [];
    for (const y of ys) if (!uniq.length || Math.abs(y - uniq[uniq.length - 1]) > 1e-4) uniq.push(y);
    const ov = Math.max(.04, Math.min(.85, ((uniq[uniq.length - 1] - uniq[0]) || 1) * .0015));
    const pos = [], idx = [];
    for (let yi = 0; yi < uniq.length - 1; yi++) {
      const y0 = uniq[yi], y1 = uniq[yi + 1];
      if (y1 - y0 < 1e-5) continue;
      const mid = (y0 + y1) / 2;
      const cuts = [];
      for (const r of rings) {
        for (let i = 0; i < r.length; i++) {
          const a = r[i], b = r[(i + 1) % r.length];
          if (Math.abs(a[1] - b[1]) < 1e-8) continue;
          const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
          if (mid <= lo || mid >= hi) continue;
          const t0 = U.clamp((y0 - a[1]) / (b[1] - a[1]), 0, 1);
          const t1 = U.clamp((y1 - a[1]) / (b[1] - a[1]), 0, 1);
          const x0 = a[0] + (b[0] - a[0]) * t0;
          const x1 = a[0] + (b[0] - a[0]) * t1;
          const xm = a[0] + (b[0] - a[0]) * ((mid - a[1]) / (b[1] - a[1]));
          cuts.push({ x0, x1, xm });
        }
      }
      cuts.sort((a, b) => a.xm - b.xm);
      for (let i = 0; i + 1 < cuts.length; i += 2) {
        const L = cuts[i], R = cuts[i + 1];
        if (Math.abs(R.xm - L.xm) < 1e-5) continue;
        const base = pos.length / 2;
        pos.push(L.x0, y0 - ov, R.x0, y0 - ov, R.x1, y1 + ov, L.x1, y1 + ov);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
  };
  G.triangulateShape = (shape, steps = 10) => {
    const contours = shape.contours.map(c => G.sampleContour(c, steps));
    return G.triangulate2D(contours);
  };

  // ---------- polygon boolean ----------
  function splitEdges(polys) {
    // returns list of {a,b,src} split at all intersections
    const segs = [];
    for (let si = 0; si < polys.length; si++) {
      const poly = polys[si];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        segs.push({ a: a.slice(), b: b.slice(), src: si === 0 ? 0 : 1, hits: [] });
      }
    }
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      if (segs[i].src === segs[j].src) continue;
      const hit = lineHit(segs[i].a, segs[i].b, segs[j].a, segs[j].b);
      if (hit) { segs[i].hits.push(hit.t); segs[j].hits.push(hit.u); }
    }
    const out = [];
    for (const s of segs) {
      const ts = [0, 1].concat(s.hits).sort((x, y) => x - y);
      for (let k = 1; k < ts.length; k++) {
        if (ts[k] - ts[k - 1] < 1e-6) continue;
        const p0 = [U.lerp(s.a[0], s.b[0], ts[k - 1]), U.lerp(s.a[1], s.b[1], ts[k - 1])];
        const p1 = [U.lerp(s.a[0], s.b[0], ts[k]), U.lerp(s.a[1], s.b[1], ts[k])];
        out.push({ a: p0, b: p1, src: s.src });
      }
    }
    return out;
  }
  function lineHit(a, b, c, d) {
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
    const den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null;
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
    const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    if (t <= 1e-5 || t >= 1 - 1e-5 || u <= 1e-5 || u >= 1 - 1e-5) return null;
    return { t, u };
  }
  G.boolean = (A, B, op) => {
    const pa = G.flattenShape(A, 18), pb = G.flattenShape(B, 18);
    if (!pa.length) return op === 'union' ? G.cloneShape(B) : { contours: [] };
    if (!pb.length) return op === 'intersect' ? { contours: [] } : G.cloneShape(A);
    // quick non-intersecting/containment handling
    let anyHit = false;
    for (const a of pa) for (let i = 0; i < a.length && !anyHit; i++) for (const b of pb) for (let j = 0; j < b.length; j++) {
      if (lineHit(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) { anyHit = true; break; }
    }
    if (!anyHit) {
      const aInB = G.pointInShape(pa[0][0], pb), bInA = G.pointInShape(pb[0][0], pa);
      if (op === 'union') return aInB ? G.cloneShape(B) : (bInA ? G.cloneShape(A) : ({ contours: A.contours.concat(B.contours) }));
      if (op === 'intersect') return aInB ? G.cloneShape(A) : (bInA ? G.cloneShape(B) : { contours: [] });
      if (op === 'difference') return aInB ? { contours: [] } : G.cloneShape(A);
      return G.cloneShape(A);
    }
    const segs = [];
    const segA = [], segB = [];
    for (const poly of pa) for (let i = 0; i < poly.length; i++) segA.push([poly[i], poly[(i + 1) % poly.length]]);
    for (const poly of pb) for (let i = 0; i < poly.length; i++) segB.push([poly[i], poly[(i + 1) % poly.length]]);
    const split = splitEdges([pa, pb].map(p => p[0]));
    const edges = [];
    for (const s of split) {
      const mid = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
      const inA = G.pointInShape(mid, pa), inB = G.pointInShape(mid, pb);
      let keep = false, reverse = false;
      if (op === 'union') keep = !inA ? !inB : false, keep = !(inA && inB) && !(inA && !inB && false); // recompute below
      if (op === 'union') keep = !(inA && inB) && (s.src === 0 ? !inB : !inA);
      else if (op === 'intersect') keep = (s.src === 0 ? inB : inA);
      else if (op === 'difference') { keep = s.src === 0 ? !inB : inA; reverse = s.src === 1; }
      if (keep) edges.push({ a: reverse ? s.b : s.a, b: reverse ? s.a : s.b });
    }
    // chain
    const q = (p) => Math.round(p[0] * 100) / 100 + ',' + Math.round(p[1] * 100) / 100;
    const starts = new Map();
    for (let i = 0; i < edges.length; i++) {
      const k = q(edges[i].a);
      if (!starts.has(k)) starts.set(k, []);
      starts.get(k).push(i);
    }
    const used = new Array(edges.length).fill(false);
    const loops = [];
    for (let i = 0; i < edges.length; i++) {
      if (used[i]) continue;
      let loop = [], cur = i, guard = 0;
      while (cur != null && !used[cur] && guard++ < edges.length + 5) {
        used[cur] = true; loop.push(edges[cur].a);
        const k = q(edges[cur].b);
        const cands = (starts.get(k) || []).filter(j => !used[j]);
        cur = cands.length ? cands[0] : null;
      }
      if (loop.length > 2) loops.push(loop);
    }
    if (!loops.length) return { contours: [] };
    return { contours: loops.map(l => pathFromPoints(l, true, false)) };
  };

  // ---------- repeater / operators ----------
  G.repeater = (shape, opts = {}) => {
    const copies = Math.max(1, Math.floor(opts.copies || 1));
    const items = [];
    let ox = 0, oy = 0, rot = 0, sx = 1, sy = 1, op = 1;
    const stepX = opts.position ? opts.position[0] : 0, stepY = opts.position ? opts.position[1] : 0;
    const stepRot = U.rad(opts.rotation || 0), stepScale = (opts.scale || 0) / 100;
    const order = opts.reverse ? -1 : 1;
    for (let i = 0; i < copies; i++) {
      const k = opts.startIndex == null ? i : i;
      if (opts.startOpacity != null) op = U.lerp(opts.startOpacity, opts.endOpacity == null ? 1 : opts.endOpacity, copies === 1 ? 0 : i / (copies - 1));
      if (opts.invert) op *= 0;
      const local = G.transformShape(shape, [Math.cos(rot) * sx, Math.sin(rot) * sx, -Math.sin(rot) * sy, Math.cos(rot) * sy, ox, oy]);
      items.push({ shape: local, opacity: U.clamp(op), index: i });
      ox += stepX; oy += stepY; rot += stepRot; sx *= (1 + stepScale); sy *= (1 + stepScale);
      if (opts.endOpacity == null) op = 1;
    }
    return items;
  };
  G.offsetShape = (shape, amount) => {
    // approximate polygon offset along vertex normals
    return {
      contours: shape.contours.map(c => {
        const pts = G.sampleContour(c, 16);
        const area = Math.sign(G.polyArea(pts)) || 1;
        const out = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c2 = pts[(i + 1) % pts.length];
          const d1 = [b[0] - a[0], b[1] - a[1]], d2 = [c2[0] - b[0], c2[1] - b[1]];
          const l1 = Math.hypot(d1[0], d1[1]) || 1, l2 = Math.hypot(d2[0], d2[1]) || 1;
          let n1 = [-d1[1] / l1, d1[0] / l1], n2 = [-d2[1] / l2, d2[0] / l2];
          if (area < 0) { n1 = [-n1[0], -n1[1]]; n2 = [-n2[0], -n2[1]]; }
          const n = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2];
          const l = Math.hypot(n[0], n[1]) || 1;
          out.push([b[0] + n[0] / l * amount, b[1] + n[1] / l * amount]);
        }
        return pathFromPoints(out, c.closed, true);
      })
    };
  };

  // path hit test
  G.hitShape = (shape, pt, tol = 4, filled = true) => {
    const polys = G.flattenShape(shape, 14);
    if (filled && G.pointInShape(pt, polys)) return true;
    for (const p of polys) if (G.distToPolyline(pt, p, true) <= tol) return true;
    return false;
  };

  // frame-dot path
  G.polylineShape = (pts, closed = false) => ({ contours: [pathFromPoints(pts, closed, false)] });

  // Catmull-rom smooth through points
  G.smoothPath = (pts, closed = false) => {
    if (pts.length < 2) return G.polylineShape(pts, closed);
    const verts = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
      const inP = closed || i > 0 ? [(p[0] * 2 + prev[0]) / 3, (p[1] * 2 + prev[1]) / 3] : p.slice();
      const outP = closed || i < n - 1 ? [(p[0] * 2 + next[0]) / 3, (p[1] * 2 + next[1]) / 3] : p.slice();
      verts.push({ p, in: inP, out: outP });
    }
    return { contours: [{ closed, verts }] };
  };

  AE.Geometry = G;
})();
