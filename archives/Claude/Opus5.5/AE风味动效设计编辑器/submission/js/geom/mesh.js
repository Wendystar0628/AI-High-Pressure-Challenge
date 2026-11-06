// 三维网格：挤出实体（前后面、侧壁、倒角、孔洞）、参数化长方体/球/圆环/平面、弯曲/扭转/场变形
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, P = AE.Path, Poly = AE.Poly;
  const Mesh = AE.Mesh = {};

  // 网格构建器
  function Builder() { this.pos = []; this.nrm = []; this.uv = []; this.idx = []; this.groups = []; this.cur = null; }
  Builder.prototype.group = function (mat) { if (this.cur && this.cur.mat === mat) return; this.cur = { mat, start: this.idx.length, count: 0 }; this.groups.push(this.cur); };
  Builder.prototype.v = function (x, y, z, nx, ny, nz, u, v) { this.pos.push(x, y, z); this.nrm.push(nx, ny, nz); this.uv.push(u, v); return this.pos.length / 3 - 1; };
  Builder.prototype.tri = function (a, b, c) { this.idx.push(a, b, c); this.cur.count += 3; };
  Builder.prototype.done = function () {
    const m = { pos: new Float32Array(this.pos), nrm: new Float32Array(this.nrm), uv: new Float32Array(this.uv), idx: new Uint32Array(this.idx), groups: this.groups.filter(g => g.count > 0), ver: 1 };
    m.rest = m.pos.slice(); m.restN = m.nrm.slice();
    Mesh.bounds(m);
    return m;
  };
  Mesh.Builder = Builder;
  Mesh.bounds = (m) => {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity; const p = m.pos;
    for (let i = 0; i < p.length; i += 3) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; if (p[i + 2] < z0) z0 = p[i + 2]; if (p[i + 2] > z1) z1 = p[i + 2]; }
    m.bb = [x0, y0, z0, x1, y1, z1];
    return m.bb;
  };

  // ---------- 挤出 ----------
  // polys：闭合折线（图层空间 XY，y 向下）；depth：沿 +Z；bevel：倒角尺寸；segs：倒角分段
  Mesh.extrude = (polys, depth, bevel, segs = 4, opts = {}) => {
    const B = new Builder();
    const groups = Poly.group(polys.map(p => ({ c: true, p: dedupe(p.p) })).filter(p => p.p.length >= 6));
    depth = Math.max(0.01, depth);
    bevel = Math.max(0, Math.min(bevel, depth / 2 - 0.01));
    segs = bevel > 0 ? Math.max(1, segs) : 0;
    const uvS = opts.uvScale || 1 / 200;
    for (const g of groups) {
      // 统一方向：外轮廓面积为正，孔洞为负
      const outer = P.area(g.outer) > 0 ? g.outer : rev(g.outer);
      const holes = g.holes.map(h => P.area(h) < 0 ? h : rev(h));
      const rings = [outer].concat(holes);
      // 每个轮廓：单位外法线偏移向量（指向材料外侧）
      const offs = rings.map(r => offsetVecs(r));
      const inset = (ri, k, d) => { const r = rings[ri], o = offs[ri]; return [r[2 * k] - o[2 * k] * d, r[2 * k + 1] - o[2 * k + 1] * d]; };
      // 盖面（倒角内缩）
      const capPts = [], holeIdx = [];
      rings.forEach((r, ri) => { if (ri > 0) holeIdx.push(capPts.length / 2); const n = r.length / 2; for (let k = 0; k < n; k++) { const q = inset(ri, k, bevel); capPts.push(q[0], q[1]); } });
      let tris = Poly.earcut(capPts, holeIdx);
      // 正面（z=0，法线朝 -Z）与背面
      const triOK = (a, b, c) => ((capPts[2 * b] - capPts[2 * a]) * (capPts[2 * c + 1] - capPts[2 * a + 1]) - (capPts[2 * b + 1] - capPts[2 * a + 1]) * (capPts[2 * c] - capPts[2 * a]));
      if (!opts.noFront) {
        B.group('front'); const base = B.pos.length / 3;
        for (let k = 0; k < capPts.length; k += 2) B.v(capPts[k], capPts[k + 1], 0, 0, 0, -1, capPts[k] * uvS, capPts[k + 1] * uvS);
        for (let k = 0; k < tris.length; k += 3) { const a = tris[k], b = tris[k + 1], c = tris[k + 2]; if (triOK(a, b, c) > 0) B.tri(base + a, base + b, base + c); else B.tri(base + a, base + c, base + b); }
      }
      if (!opts.noBack) {
        B.group('back'); const base = B.pos.length / 3;
        for (let k = 0; k < capPts.length; k += 2) B.v(capPts[k], capPts[k + 1], depth, 0, 0, 1, 1 - capPts[k] * uvS, capPts[k + 1] * uvS);
        for (let k = 0; k < tris.length; k += 3) { const a = tris[k], b = tris[k + 1], c = tris[k + 2]; if (triOK(a, b, c) > 0) B.tri(base + a, base + c, base + b); else B.tri(base + a, base + b, base + c); }
      }
      // 侧面剖面：[inset, z, nIn(径向), nZ]
      const prof = [];
      for (let s = 0; s <= segs; s++) { const th = s / segs * Math.PI / 2; prof.push({ d: bevel * (1 - Math.sin(th)), z: bevel * (1 - Math.cos(th)), nr: Math.sin(th), nz: -Math.cos(th), mat: 'bevel' }); }
      const side = [{ d: 0, z: bevel, nr: 1, nz: 0, mat: 'side' }, { d: 0, z: depth - bevel, nr: 1, nz: 0, mat: 'side' }];
      const back = [];
      for (let s = 0; s <= segs; s++) { const th = s / segs * Math.PI / 2; back.push({ d: bevel * Math.sin(th), z: depth - bevel + bevel * Math.sin(th) * 0 + bevel * (1 - Math.cos(Math.PI / 2 - th)) - 0, nr: Math.cos(th), nz: Math.sin(th), mat: 'bevel' }); }
      // 修正背面倒角 z：th 0→π/2 时 z 从 depth-bevel 到 depth
      for (let s = 0; s <= segs; s++) { const th = s / segs * Math.PI / 2; back[s].z = depth - bevel + bevel * Math.sin(th); back[s].d = bevel * (1 - Math.cos(th)); }
      const strips = [];
      if (segs > 0) strips.push(prof);
      strips.push(side);
      if (segs > 0) strips.push(back);
      rings.forEach((r, ri) => {
        const n = r.length / 2, o = offs[ri];
        // 每个顶点的列：尖角处拆分为两列（硬边）
        const cols = [];
        let arc = 0;
        for (let k = 0; k < n; k++) {
          const pk = (k - 1 + n) % n, nk = (k + 1) % n;
          const e1 = norm2(r[2 * k] - r[2 * pk], r[2 * k + 1] - r[2 * pk + 1]), e2 = norm2(r[2 * nk] - r[2 * k], r[2 * nk + 1] - r[2 * k + 1]);
          const n1 = [e1[1], -e1[0]], n2 = [e2[1], -e2[0]]; // 外法线（面积正时右手）
          const cos = n1[0] * n2[0] + n1[1] * n2[1];
          if (k > 0) arc += Math.hypot(r[2 * k] - r[2 * pk], r[2 * k + 1] - r[2 * pk + 1]);
          if (cos < 0.82) { cols.push({ k, n: n1, arc }, { k, n: n2, arc }); }
          else { const m = norm2(n1[0] + n2[0], n1[1] + n2[1]); cols.push({ k, n: m, arc }); }
        }
        const total = arc + Math.hypot(r[0] - r[2 * n - 2], r[1] - r[2 * n - 1]);
        cols.push({ k: cols[0].k, n: cols[0].n, arc: total }); // 闭合
        for (const st of strips) {
          B.group(st[0].mat);
          const base = B.pos.length / 3, rows = st.length;
          for (const c of cols) for (const pr of st) {
            const q = inset(ri, c.k, pr.d);
            const nx = c.n[0] * pr.nr, ny = c.n[1] * pr.nr, nz = pr.nz, nl = Math.hypot(nx, ny, nz) || 1;
            B.v(q[0], q[1], pr.z, nx / nl, ny / nl, nz / nl, c.arc * uvS, pr.z * uvS);
          }
          for (let ci = 0; ci < cols.length - 1; ci++) {
            if (cols[ci].k === cols[ci + 1].k && ci + 1 < cols.length - 1) continue; // 尖角拆分列之间无面
            for (let s = 0; s < rows - 1; s++) {
              const a = base + ci * rows + s, b = base + (ci + 1) * rows + s;
              B.tri(a, a + 1, b); B.tri(b, a + 1, b + 1);
            }
          }
        }
      });
    }
    const m = B.done();
    fixWinding(m);
    return m;
  };
  function dedupe(p) { const out = []; const n = p.length / 2; for (let k = 0; k < n; k++) { const j = (k + 1) % n; if (Math.abs(p[2 * k] - p[2 * j]) + Math.abs(p[2 * k + 1] - p[2 * j + 1]) > 1e-6) out.push(p[2 * k], p[2 * k + 1]); } return out; }
  function rev(p) { const q = []; for (let k = p.length - 2; k >= 0; k -= 2) q.push(p[k], p[k + 1]); return q; }
  function norm2(x, y) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
  function offsetVecs(r) { // 斜接外法线 * 1/cos
    const n = r.length / 2, o = new Array(r.length);
    for (let k = 0; k < n; k++) {
      const pk = (k - 1 + n) % n, nk = (k + 1) % n;
      const e1 = norm2(r[2 * k] - r[2 * pk], r[2 * k + 1] - r[2 * pk + 1]), e2 = norm2(r[2 * nk] - r[2 * k], r[2 * nk + 1] - r[2 * k + 1]);
      const n1 = [e1[1], -e1[0]], n2 = [e2[1], -e2[0]];
      const m = norm2(n1[0] + n2[0], n1[1] + n2[1]);
      const c = Math.max(0.35, m[0] * n1[0] + m[1] * n1[1]);
      o[2 * k] = m[0] / c; o[2 * k + 1] = m[1] / c;
    }
    return o;
  }
  // 依据法线修正三角形朝向（逆时针朝外）
  function fixWinding(m) {
    const p = m.pos, n = m.nrm, idx = m.idx;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      const d = fx * (n[a] + n[b] + n[c]) + fy * (n[a + 1] + n[b + 1] + n[c + 1]) + fz * (n[a + 2] + n[b + 2] + n[c + 2]);
      if (d < 0) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    }
  }
  Mesh.fixWinding = fixWinding;

  // ---------- 参数化实体 ----------
  Mesh.box = (w, h, d, bevel = 0) => {
    if (bevel > 0.5) {
      const r = Math.min(bevel, w / 2 - 0.1, h / 2 - 0.1);
      const sh = P.flatten(P.rect(0, 0, w, h, r), 0.8);
      const m = Mesh.extrude([sh], d, Math.min(bevel, d / 2 - 0.1), 3);
      for (let i = 2; i < m.pos.length; i += 3) m.pos[i] -= d / 2;
      m.rest = m.pos.slice(); Mesh.bounds(m); return m;
    }
    const B = new Builder();
    const faces = [[[0, 0, -1], [1, 0, 0], [0, 1, 0], 'front'], [[0, 0, 1], [-1, 0, 0], [0, 1, 0], 'back'], [[1, 0, 0], [0, 0, 1], [0, 1, 0], 'side'], [[-1, 0, 0], [0, 0, -1], [0, 1, 0], 'side'], [[0, -1, 0], [1, 0, 0], [0, 0, -1], 'side'], [[0, 1, 0], [1, 0, 0], [0, 0, 1], 'side']];
    const hs = [w / 2, h / 2, d / 2];
    for (const [nn, u, v, mat] of faces) {
      B.group(mat); const base = B.pos.length / 3;
      for (let j = 0; j < 4; j++) {
        const su = j & 1 ? 1 : -1, sv = j & 2 ? 1 : -1;
        const x = nn[0] * hs[0] + u[0] * su * hs[0] + v[0] * sv * hs[0];
        const p = [0, 1, 2].map(i => nn[i] * hs[i] + u[i] * su * hs[i] + v[i] * sv * hs[i]);
        B.v(p[0], p[1], p[2], nn[0], nn[1], nn[2], (su + 1) / 2, (sv + 1) / 2);
      }
      B.tri(base, base + 1, base + 2); B.tri(base + 2, base + 1, base + 3);
    }
    const m = B.done(); fixWinding(m); return m;
  };
  Mesh.sphere = (r, segs = 48) => {
    const B = new Builder(); B.group('front');
    const rings = Math.max(6, Math.round(segs / 2)), sl = Math.max(8, segs);
    for (let i = 0; i <= rings; i++) {
      const th = i / rings * Math.PI;
      for (let j = 0; j <= sl; j++) {
        const ph = j / sl * Math.PI * 2;
        const nx = Math.sin(th) * Math.cos(ph), ny = -Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
        B.v(nx * r, ny * r, nz * r, nx, ny, nz, j / sl, i / rings);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < sl; j++) { const a = i * (sl + 1) + j, b = a + sl + 1; B.tri(a, b, a + 1); B.tri(a + 1, b, b + 1); }
    const m = B.done(); fixWinding(m); return m;
  };
  Mesh.torus = (R, r, segs = 64) => {
    const B = new Builder(); B.group('front');
    const S = Math.max(8, segs), T = Math.max(6, Math.round(segs / 2));
    for (let i = 0; i <= S; i++) {
      const u = i / S * Math.PI * 2, cu = Math.cos(u), su = Math.sin(u);
      for (let j = 0; j <= T; j++) {
        const v = j / T * Math.PI * 2, cv = Math.cos(v), sv = Math.sin(v);
        // 圆环位于 XY 平面（正对相机），管截面绕 Z
        const x = (R + r * cv) * cu, y = (R + r * cv) * su, z = r * sv;
        B.v(x, y, z, cv * cu, cv * su, sv, i / S, j / T);
      }
    }
    for (let i = 0; i < S; i++) for (let j = 0; j < T; j++) { const a = i * (T + 1) + j, b = a + T + 1; B.tri(a, b, a + 1); B.tri(a + 1, b, b + 1); }
    const m = B.done(); fixWinding(m); return m;
  };
  // 平面（XZ 地面，法线朝 -Y 即向上）
  Mesh.plane = (w, d, segs = 20, vertical = false) => {
    const B = new Builder(); B.group('front');
    const n = Math.max(1, segs);
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const x = (j / n - 0.5) * w, z = (i / n - 0.5) * d;
      if (vertical) B.v(x, z, 0, 0, 0, -1, j / n, i / n); else B.v(x, 0, z, 0, -1, 0, j / n, i / n);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, b = a + n + 1; B.tri(a, b, a + 1); B.tri(a + 1, b, b + 1); }
    const m = B.done(); fixWinding(m); return m;
  };
  Mesh.tetra = (s = 1) => {
    const B = new Builder(); B.group('front');
    const v = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]].map(p => p.map(x => x * s));
    const f = [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]];
    for (const [a, b, c] of f) {
      const n = U.norm(U.cross(U.sub(v[b], v[a]), U.sub(v[c], v[a])));
      const i0 = B.v(...v[a], ...n, 0, 0), i1 = B.v(...v[b], ...n, 1, 0), i2 = B.v(...v[c], ...n, 0, 1); B.tri(i0, i1, i2);
    }
    const m = B.done(); fixWinding(m); return m;
  };
  Mesh.merge = (list) => { // [{mesh, m(4x4)}] → 新网格（保留材质组）
    const B = new Builder();
    for (const { mesh, m } of list) {
      const nm = m ? U.M4.normal3(m) : null;
      for (const g of mesh.groups) {
        B.group(g.mat);
        const map = new Map();
        for (let i = g.start; i < g.start + g.count; i++) {
          const vi = mesh.idx[i];
          let ni = map.get(vi);
          if (ni === undefined) {
            let p = [mesh.pos[vi * 3], mesh.pos[vi * 3 + 1], mesh.pos[vi * 3 + 2]], n = [mesh.nrm[vi * 3], mesh.nrm[vi * 3 + 1], mesh.nrm[vi * 3 + 2]];
            if (m) { p = U.M4.apply(m, p); n = U.norm([nm[0] * n[0] + nm[3] * n[1] + nm[6] * n[2], nm[1] * n[0] + nm[4] * n[1] + nm[7] * n[2], nm[2] * n[0] + nm[5] * n[1] + nm[8] * n[2]]); }
            ni = B.v(p[0], p[1], p[2], n[0], n[1], n[2], mesh.uv[vi * 2], mesh.uv[vi * 2 + 1]); map.set(vi, ni);
          }
          B.idx.push(ni); B.cur.count++;
        }
      }
    }
    return B.done();
  };
  Mesh.clone = (m) => ({ pos: m.pos.slice(), nrm: m.nrm.slice(), uv: m.uv.slice(), idx: m.idx, groups: m.groups, rest: m.rest, restN: m.restN, ver: 1, bb: m.bb && m.bb.slice() });

  // ---------- 顶点变形（法线由雅可比余子式变换） ----------
  // fn(p:[x,y,z]) → [x,y,z]；在 rest 上求值，写入 pos/nrm
  Mesh.deform = (m, fn, out) => {
    const src = out ? m.pos : m.rest, srcN = out ? m.nrm : (m.restN || m.nrm);
    const n = src.length / 3, pos = new Float32Array(src.length), nrm = new Float32Array(src.length);
    const e = Math.max(0.05, (m.bb ? Math.max(m.bb[3] - m.bb[0], m.bb[4] - m.bb[1], m.bb[5] - m.bb[2]) : 100) * 1e-4);
    for (let i = 0; i < n; i++) {
      const x = src[3 * i], y = src[3 * i + 1], z = src[3 * i + 2];
      const f = fn([x, y, z], i);
      const fx = fn([x + e, y, z], i), fy = fn([x, y + e, z], i), fz = fn([x, y, z + e], i);
      const a = [(fx[0] - f[0]) / e, (fx[1] - f[1]) / e, (fx[2] - f[2]) / e], b = [(fy[0] - f[0]) / e, (fy[1] - f[1]) / e, (fy[2] - f[2]) / e], c = [(fz[0] - f[0]) / e, (fz[1] - f[1]) / e, (fz[2] - f[2]) / e];
      const bc = U.cross(b, c), ca = U.cross(c, a), ab = U.cross(a, b);
      const n0 = srcN[3 * i], n1 = srcN[3 * i + 1], n2 = srcN[3 * i + 2];
      let nx = bc[0] * n0 + ca[0] * n1 + ab[0] * n2, ny = bc[1] * n0 + ca[1] * n1 + ab[1] * n2, nz = bc[2] * n0 + ca[2] * n1 + ab[2] * n2;
      const det = U.dot(a, bc); if (det < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1;
      pos[3 * i] = f[0]; pos[3 * i + 1] = f[1]; pos[3 * i + 2] = f[2];
      nrm[3 * i] = nx / l; nrm[3 * i + 1] = ny / l; nrm[3 * i + 2] = nz / l;
    }
    m.pos = pos; m.nrm = nrm; m.ver = (m.ver || 0) + 1;
    Mesh.bounds(m);
    return m;
  };
  // 弯曲：沿 axis 方向的长度 range 内弯曲 angle 度（绕垂直轴，在 axis-Z 平面内）
  Mesh.bendFn = (angle, axis, center, range) => {
    const th = angle * U.deg;
    if (Math.abs(th) < 1e-5) return p => p;
    const R = range / th;
    const ai = axis === 'y' ? 1 : 0;
    return p => {
      const s = p[ai] - center;
      const sc = U.clamp(s, -range / 2, range / 2), extra = s - sc;
      const phi = sc / R, z = p[2];
      const c = Math.cos(phi), sn = Math.sin(phi);
      const r = R - z;
      let a = center + r * sn, nz = R - r * c;
      // 区间外沿切线延伸
      a += extra * c; nz += extra * sn;
      const q = p.slice(); q[ai] = a; q[2] = nz; return q;
    };
  };
  // 扭转：绕 axis 旋转，角度随轴向坐标线性变化
  Mesh.twistFn = (angle, axis, range, center = 0) => {
    const k = angle * U.deg / Math.max(1, range);
    const ai = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
    const o1 = ai === 0 ? 1 : 0, o2 = ai === 2 ? 1 : 2;
    return p => {
      const s = U.clamp(p[ai] - center, -range / 2, range / 2), a = s * k, c = Math.cos(a), sn = Math.sin(a);
      const q = p.slice(); q[o1] = p[o1] * c - p[o2] * sn; q[o2] = p[o1] * sn + p[o2] * c; return q;
    };
  };
  Mesh.computeNormals = (m) => { // 平滑法线（用于无硬边网格）
    const n = new Float32Array(m.pos.length), p = m.pos, idx = m.idx;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      for (const q of [a, b, c]) { n[q] += fx; n[q + 1] += fy; n[q + 2] += fz; }
    }
    for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
    m.nrm = n; return m;
  };
  // 世界空间三角形（碰撞、发射）
  Mesh.worldTris = (m, W) => {
    const p = m.pos, n = p.length / 3, wp = new Float32Array(p.length), wn = new Float32Array(p.length), nm = U.M4.normal3(W);
    for (let i = 0; i < n; i++) {
      const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
      wp[3 * i] = W[0] * x + W[4] * y + W[8] * z + W[12]; wp[3 * i + 1] = W[1] * x + W[5] * y + W[9] * z + W[13]; wp[3 * i + 2] = W[2] * x + W[6] * y + W[10] * z + W[14];
      const a = m.nrm[3 * i], b = m.nrm[3 * i + 1], c = m.nrm[3 * i + 2];
      let nx = nm[0] * a + nm[3] * b + nm[6] * c, ny = nm[1] * a + nm[4] * b + nm[7] * c, nz = nm[2] * a + nm[5] * b + nm[8] * c; const l = Math.hypot(nx, ny, nz) || 1;
      wn[3 * i] = nx / l; wn[3 * i + 1] = ny / l; wn[3 * i + 2] = nz / l;
    }
    return { pos: wp, nrm: wn, idx: m.idx };
  };
})(typeof window !== 'undefined' ? window : globalThis);
