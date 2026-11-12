'use strict';
// ============ 三维几何：图元、挤出倒角、变形器、表面采样、碰撞网格 ============
let GEO_UID = 1;
const Geo3D = {
  mesh(pos, nrm, idx, extra) { return Object.assign({ pos: pos instanceof Float32Array ? pos : new Float32Array(pos), nrm: nrm instanceof Float32Array ? nrm : new Float32Array(nrm), idx: idx instanceof Uint32Array ? idx : new Uint32Array(idx), uid: GEO_UID++ }, extra || {}); },
  count(m) { return m ? m.pos.length / 3 : 0; },
  // ---------- 图元 ----------
  box(w, h, d, seg = 8) {
    const P = [], N = [], I = [];
    const face = (o, u, v, n, su, sv) => {
      const base = P.length / 3;
      for (let j = 0; j <= sv; j++) for (let i = 0; i <= su; i++) { const a = i / su - 0.5, b = j / sv - 0.5; P.push(o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b); N.push(...n); }
      for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) { const k = base + j * (su + 1) + i; I.push(k, k + 1, k + su + 2, k, k + su + 2, k + su + 1); }
    };
    const sx = Math.max(1, Math.round(seg * w / Math.max(w, h, d))), sy = Math.max(1, Math.round(seg * h / Math.max(w, h, d))), sz = Math.max(1, Math.round(seg * d / Math.max(w, h, d)));
    face([0, 0, -d / 2], [w, 0, 0], [0, h, 0], [0, 0, -1], sx, sy); face([0, 0, d / 2], [-w, 0, 0], [0, h, 0], [0, 0, 1], sx, sy);
    face([w / 2, 0, 0], [0, 0, d], [0, h, 0], [1, 0, 0], sz, sy); face([-w / 2, 0, 0], [0, 0, -d], [0, h, 0], [-1, 0, 0], sz, sy);
    face([0, -h / 2, 0], [w, 0, 0], [0, 0, -d], [0, -1, 0], sx, sz); face([0, h / 2, 0], [w, 0, 0], [0, 0, d], [0, 1, 0], sx, sz);
    return this.mesh(P, N, I);
  },
  sphere(r, seg = 32) {
    const P = [], N = [], I = []; const rs = seg, cs = seg * 2;
    for (let j = 0; j <= rs; j++) { const v = j / rs * Math.PI; for (let i = 0; i <= cs; i++) { const u = i / cs * Math.PI * 2; const n = [Math.sin(v) * Math.cos(u), -Math.cos(v), Math.sin(v) * Math.sin(u)]; P.push(n[0] * r, n[1] * r, n[2] * r); N.push(...n); } }
    for (let j = 0; j < rs; j++) for (let i = 0; i < cs; i++) { const a = j * (cs + 1) + i, b = a + cs + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
    return this.mesh(P, N, I);
  },
  plane(w, h, seg = 16) { // XY 平面，法线 -Z（朝向摄像机）
    const P = [], N = [], I = [];
    for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) { P.push((i / seg - 0.5) * w, (j / seg - 0.5) * h, 0); N.push(0, 0, -1); }
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) { const k = j * (seg + 1) + i; I.push(k, k + 1, k + seg + 2, k, k + seg + 2, k + seg + 1); }
    return this.mesh(P, N, I);
  },
  ground(w, d, seg = 24) { // XZ 平面（地面），法线 -Y（朝上，y 向下坐标）
    const P = [], N = [], I = [];
    for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) { P.push((i / seg - 0.5) * w, 0, (j / seg - 0.5) * d); N.push(0, -1, 0); }
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) { const k = j * (seg + 1) + i; I.push(k, k + seg + 1, k + seg + 2, k, k + seg + 2, k + 1); }
    return this.mesh(P, N, I);
  },
  cylinder(r, h, seg = 32) { // 沿 Y 轴
    const P = [], N = [], I = [];
    for (let j = 0; j <= 4; j++) for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; P.push(Math.cos(a) * r, (j / 4 - 0.5) * h, Math.sin(a) * r); N.push(Math.cos(a), 0, Math.sin(a)); }
    for (let j = 0; j < 4; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; I.push(a, a + 1, b + 1, a, b + 1, b); }
    for (const s of [-1, 1]) { const c = P.length / 3; P.push(0, s * h / 2, 0); N.push(0, s, 0); for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; P.push(Math.cos(a) * r, s * h / 2, Math.sin(a) * r); N.push(0, s, 0); } for (let i = 0; i < seg; i++) I.push(c, c + 1 + i, c + 2 + i); }
    return this.mesh(P, N, I);
  },
  torus(R, r, seg = 48) {
    const P = [], N = [], I = []; const s2 = Math.max(8, seg / 2 | 0);
    for (let j = 0; j <= seg; j++) { const u = j / seg * Math.PI * 2; for (let i = 0; i <= s2; i++) { const v = i / s2 * Math.PI * 2; const n = [Math.cos(u) * Math.cos(v), Math.sin(v), Math.sin(u) * Math.cos(v)]; P.push(Math.cos(u) * R + n[0] * r, n[1] * r, Math.sin(u) * R + n[2] * r); N.push(...n); } }
    for (let j = 0; j < seg; j++) for (let i = 0; i < s2; i++) { const a = j * (s2 + 1) + i, b = a + s2 + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
    return this.mesh(P, N, I);
  },
  merge(ms) {
    ms = ms.filter(Boolean); if (!ms.length) return null; if (ms.length === 1) return ms[0];
    let nv = 0, ni = 0; for (const m of ms) { nv += m.pos.length; ni += m.idx.length; }
    const pos = new Float32Array(nv), nrm = new Float32Array(nv), idx = new Uint32Array(ni); const hasCol = ms.some(m => m.col); const col = hasCol ? new Float32Array(nv / 3 * 4).fill(1) : null;
    let ov = 0, oi = 0;
    for (const m of ms) { pos.set(m.pos, ov); nrm.set(m.nrm, ov); if (col && m.col) col.set(m.col, ov / 3 * 4); for (let i = 0; i < m.idx.length; i++) idx[oi + i] = m.idx[i] + ov / 3; ov += m.pos.length; oi += m.idx.length; }
    return this.mesh(pos, nrm, idx, col ? { col } : null);
  },
  transform(m, M) {
    const pos = new Float32Array(m.pos.length), nrm = new Float32Array(m.nrm.length); const NM = M4.invert(M);
    for (let i = 0; i < m.pos.length; i += 3) {
      const x = m.pos[i], y = m.pos[i + 1], z = m.pos[i + 2];
      pos[i] = M[0] * x + M[4] * y + M[8] * z + M[12]; pos[i + 1] = M[1] * x + M[5] * y + M[9] * z + M[13]; pos[i + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
      const a = m.nrm[i], b = m.nrm[i + 1], c = m.nrm[i + 2];
      let nx = NM[0] * a + NM[1] * b + NM[2] * c, ny = NM[4] * a + NM[5] * b + NM[6] * c, nz = NM[8] * a + NM[9] * b + NM[10] * c; const l = Math.hypot(nx, ny, nz) || 1;
      nrm[i] = nx / l; nrm[i + 1] = ny / l; nrm[i + 2] = nz / l;
    }
    return this.mesh(pos, nrm, m.idx, m.col ? { col: m.col } : null);
  },
  bounds(m) { const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], m.pos[i + k]); b[k + 3] = Math.max(b[k + 3], m.pos[i + k]); } return b; },

  // ---------- 挤出（含倒角、孔洞、带内部顶点的前后面） ----------
  // regions: [{outer, holes}] 二维（y 向下）；返回网格，前面 z=-D/2（朝向摄像机）
  extrude(regions, opt) {
    const D = Math.max(0.01, opt.depth), bev = U.clamp(opt.bevel || 0, 0, D / 2 * 0.98), bs = Math.max(1, opt.bevelSegs || 3);
    const h = opt.spacing || 10;
    const parts = [];
    for (const R of regions) {
      if (!R.outer || R.outer.length < 3) continue;
      // 1) 轮廓重采样
      let loops = [R.outer, ...R.holes].map(l => Geo2D.resampleSpacing(Geo2D.simplify(l, h * 0.08, true), true, h * 0.9)).filter(l => l.length >= 3);
      if (!loops.length) continue;
      // 2) 每个轮廓顶点：向内法线（左法线）与是否尖角
      const info = loops.map(L => L.map((p, i) => {
        const a = L[(i - 1 + L.length) % L.length], b = L[(i + 1) % L.length];
        const e1 = V2n(p[0] - a[0], p[1] - a[1]), e2 = V2n(b[0] - p[0], b[1] - p[1]);
        const n1 = [-e1[1], e1[0]], n2 = [-e2[1], e2[0]];
        const m = V2n(n1[0] + n2[0], n1[1] + n2[1]); const cs = m[0] * n1[0] + m[1] * n1[1];
        const ml = 1 / Math.max(cs, 0.35);
        const sharp = (e1[0] * e2[0] + e1[1] * e2[1]) < Math.cos(U.rad(38));
        return { m, ml, n1, n2, sharp };
      }));
      // 内缩轮廓（倒角量 d）
      const inset = (li, d) => loops[li].map((p, i) => { const f = info[li][i]; return [p[0] + f.m[0] * f.ml * d, p[1] + f.m[1] * f.ml * d]; });
      // 3) 剖面：[{d(内缩), z, nz(法线 z 分量), nr(径向分量)}]
      const prof = [];
      const z0 = -D / 2, z1 = D / 2;
      if (bev > 0) for (let k = 0; k <= bs; k++) { const th = k / bs * Math.PI / 2; prof.push({ d: bev * (1 - Math.sin(th)), z: z0 + bev * (1 - Math.cos(th)), nz: -Math.cos(th), nr: Math.sin(th) }); }
      else prof.push({ d: 0, z: z0, nz: 0, nr: 1 });
      const sideN = Math.max(1, Math.ceil((D - 2 * bev) / (h * 1.5)));
      const zs0 = z0 + bev, zs1 = z1 - bev;
      for (let k = 1; k <= sideN; k++) prof.push({ d: 0, z: zs0 + (zs1 - zs0) * k / sideN, nz: 0, nr: 1 });
      if (bev > 0) for (let k = 1; k <= bs; k++) { const th = (1 - k / bs) * Math.PI / 2; prof.push({ d: bev * (1 - Math.sin(th)), z: z1 - bev * (1 - Math.cos(th)), nz: Math.cos(th), nr: Math.sin(th) }); }
      // 4) 侧壁：每条边独立一列（尖角处硬边，平滑处共享法线）
      const P = [], N = [], I = [];
      for (let li = 0; li < loops.length; li++) {
        const L = loops[li], F = info[li]; const n = L.length;
        const rings = prof.map(pr => pr.d > 0 ? inset(li, pr.d) : L);
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const eN = [-F[j].n1[0], -F[j].n1[1]]; // 本边外法线
          const nA = F[i].sharp ? eN : [-F[i].m[0], -F[i].m[1]], nB = F[j].sharp ? eN : [-F[j].m[0], -F[j].m[1]];
          const base = P.length / 3;
          for (let k = 0; k < prof.length; k++) {
            const pr = prof[k]; const a = rings[k][i], b = rings[k][j];
            P.push(a[0], a[1], pr.z, b[0], b[1], pr.z);
            N.push(nA[0] * pr.nr, nA[1] * pr.nr, pr.nz, nB[0] * pr.nr, nB[1] * pr.nr, pr.nz);
          }
          for (let k = 0; k < prof.length - 1; k++) { const a = base + k * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        }
      }
      // 5) 前后面：带内部点的约束三角网格（使用最内一圈）
      const capLoops = loops.map((_, li) => bev > 0 ? inset(li, bev) : loops[li]);
      const cm = Geo2D.mesh(capLoops[0], capLoops.slice(1), h * 1.4, true);
      for (const [zc, nz, flip] of [[z0, -1, false], [z1, 1, true]]) {
        const base = P.length / 3;
        for (const p of cm.pts) { P.push(p[0], p[1], zc); N.push(0, 0, nz); }
        for (let t = 0; t < cm.tris.length; t += 3) { const a = cm.tris[t], b = cm.tris[t + 1], c = cm.tris[t + 2]; if (flip) I.push(base + a, base + c, base + b); else I.push(base + a, base + b, base + c); }
      }
      parts.push(this.mesh(P, N, I));
    }
    const m = this.merge(parts) || this.mesh([], [], []);
    return m;
  },
  // ---------- 变形：位置函数 f(p)，法线用数值雅可比 ----------
  deform(m, f, h = 0.5) {
    const n = m.pos.length / 3; const pos = new Float32Array(m.pos.length), nrm = new Float32Array(m.nrm.length);
    for (let i = 0; i < n; i++) {
      const p = [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]];
      const q = f(p);
      pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = q[2];
      // 雅可比
      const qx = f([p[0] + h, p[1], p[2]]), qy = f([p[0], p[1] + h, p[2]]), qz = f([p[0], p[1], p[2] + h]);
      const J = [(qx[0] - q[0]) / h, (qx[1] - q[1]) / h, (qx[2] - q[2]) / h, (qy[0] - q[0]) / h, (qy[1] - q[1]) / h, (qy[2] - q[2]) / h, (qz[0] - q[0]) / h, (qz[1] - q[1]) / h, (qz[2] - q[2]) / h];
      // 列向量 c0=∂f/∂x ...；法线 = cof(J) n
      const c0 = [J[0], J[1], J[2]], c1 = [J[3], J[4], J[5]], c2 = [J[6], J[7], J[8]];
      const a = V3.cross(c1, c2), b = V3.cross(c2, c0), c = V3.cross(c0, c1);
      const nx = m.nrm[i * 3], ny = m.nrm[i * 3 + 1], nz = m.nrm[i * 3 + 2];
      let r = [a[0] * nx + b[0] * ny + c[0] * nz, a[1] * nx + b[1] * ny + c[1] * nz, a[2] * nx + b[2] * ny + c[2] * nz];
      const det = V3.dot(c0, a); if (det < 0) r = V3.mul(r, -1);
      r = V3.norm(r); nrm[i * 3] = r[0]; nrm[i * 3 + 1] = r[1]; nrm[i * 3 + 2] = r[2];
    }
    return this.mesh(pos, nrm, m.idx, m.col ? { col: m.col } : null);
  },
  bendFn(angleDeg, length, dirDeg = 0, center = [0, 0, 0]) {
    const A = U.rad(angleDeg); if (Math.abs(A) < 1e-5) return p => p;
    const R = length / A; const cd = Math.cos(U.rad(dirDeg)), sd = Math.sin(U.rad(dirDeg));
    return p => {
      let x = p[0] - center[0], y = p[1] - center[1], z = p[2] - center[2];
      const u = cd * x + sd * y, v = -sd * x + cd * y; // 旋转到弯曲方向
      const phi = u / R; const rr = R - z; const nu = rr * Math.sin(phi), nz = R - rr * Math.cos(phi);
      return [cd * nu - sd * v + center[0], sd * nu + cd * v + center[1], nz + center[2]];
    };
  },
  twistFn(angleDeg, length, axis = 'y', center = [0, 0, 0]) {
    const A = U.rad(angleDeg); if (Math.abs(A) < 1e-6) return p => p;
    return p => {
      const x = p[0] - center[0], y = p[1] - center[1], z = p[2] - center[2];
      if (axis === 'y') { const th = A * y / length, c = Math.cos(th), s = Math.sin(th); return [c * x - s * z + center[0], p[1], s * x + c * z + center[2]]; }
      if (axis === 'x') { const th = A * x / length, c = Math.cos(th), s = Math.sin(th); return [p[0], c * y - s * z + center[1], s * y + c * z + center[2]]; }
      const th = A * z / length, c = Math.cos(th), s = Math.sin(th); return [c * x - s * y + center[0], s * x + c * y + center[1], p[2]];
    };
  },
  // ---------- 表面采样（面积 × 权重） ----------
  cdf(m, weightFn) {
    const key = weightFn ? null : '_cdf';
    if (key && m[key]) return m[key];
    const nt = m.idx.length / 3; const cdf = new Float64Array(nt); let acc = 0;
    for (let t = 0; t < nt; t++) {
      const a = m.idx[t * 3] * 3, b = m.idx[t * 3 + 1] * 3, c = m.idx[t * 3 + 2] * 3; const P = m.pos;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let ar = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      if (weightFn) ar *= Math.max(0, weightFn([(P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3], t));
      acc += ar; cdf[t] = acc;
    }
    const r = { cdf, total: acc }; if (key) m[key] = r; return r;
  },
  sample(m, C, r1, r2, r3) {
    if (!C.total) return null;
    const x = r1 * C.total; let lo = 0, hi = C.cdf.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (C.cdf[mid] < x) lo = mid + 1; else hi = mid; }
    const t = lo; let u = r2, v = r3; if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const ia = m.idx[t * 3], ib = m.idx[t * 3 + 1], ic = m.idx[t * 3 + 2]; const P = m.pos, Nn = m.nrm;
    const w = 1 - u - v; const g = (A, i) => A[ia * 3 + i] * w + A[ib * 3 + i] * u + A[ic * 3 + i] * v;
    return { p: [g(P, 0), g(P, 1), g(P, 2)], n: V3.norm([g(Nn, 0), g(Nn, 1), g(Nn, 2)]), tri: t, bary: [w, u, v] };
  },
  // ---------- 碰撞网格（均匀格） ----------
  grid(m, prev) {
    const nt = m.idx.length / 3; if (!nt) return null;
    const b = this.bounds(m); const ext = Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2], 1);
    const cs = Math.max(ext / 48, 4); const cells = new Map();
    const key = (x, y, z) => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
    const P = m.pos;
    for (let t = 0; t < nt; t++) {
      const a = m.idx[t * 3] * 3, bb = m.idx[t * 3 + 1] * 3, c = m.idx[t * 3 + 2] * 3;
      const x0 = Math.floor(Math.min(P[a], P[bb], P[c]) / cs), x1 = Math.floor(Math.max(P[a], P[bb], P[c]) / cs);
      const y0 = Math.floor(Math.min(P[a + 1], P[bb + 1], P[c + 1]) / cs), y1 = Math.floor(Math.max(P[a + 1], P[bb + 1], P[c + 1]) / cs);
      const z0 = Math.floor(Math.min(P[a + 2], P[bb + 2], P[c + 2]) / cs), z1 = Math.floor(Math.max(P[a + 2], P[bb + 2], P[c + 2]) / cs);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const k = key(x, y, z); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(t); }
    }
    return { m, cs, cells, key, prev };
  },
  // 线段 p0→p1 与网格最近交点
  raycast(G, p0, p1) {
    const m = G.m, P = m.pos, cs = G.cs;
    const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const x0 = Math.floor(Math.min(p0[0], p1[0]) / cs), x1 = Math.floor(Math.max(p0[0], p1[0]) / cs), y0 = Math.floor(Math.min(p0[1], p1[1]) / cs), y1 = Math.floor(Math.max(p0[1], p1[1]) / cs), z0 = Math.floor(Math.min(p0[2], p1[2]) / cs), z1 = Math.floor(Math.max(p0[2], p1[2]) / cs);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 4000) return null;
    let best = null, bt = 1.0001; const seen = new Set();
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const l = G.cells.get(G.key(x, y, z)); if (!l) continue;
      for (const t of l) {
        if (seen.has(t)) continue; seen.add(t);
        const a = m.idx[t * 3] * 3, b = m.idx[t * 3 + 1] * 3, c = m.idx[t * 3 + 2] * 3;
        const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
        const pv = V3.cross(d, e2); const det = V3.dot(e1, pv); if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det; const tv = [p0[0] - P[a], p0[1] - P[a + 1], p0[2] - P[a + 2]];
        const u = V3.dot(tv, pv) * inv; if (u < 0 || u > 1) continue;
        const qv = V3.cross(tv, e1); const v = V3.dot(d, qv) * inv; if (v < 0 || u + v > 1) continue;
        const tt = V3.dot(e2, qv) * inv; if (tt < 0 || tt > bt) continue;
        bt = tt; best = { t: tt, tri: t, u, v, n: V3.norm(V3.cross(e1, e2)) };
      }
    }
    if (best) {
      best.p = [p0[0] + d[0] * best.t, p0[1] + d[1] * best.t, p0[2] + d[2] * best.t];
      // 表面速度（同拓扑的上一步网格）
      if (G.prev && G.prev.pos.length === m.pos.length) {
        const ia = m.idx[best.tri * 3] * 3, ib = m.idx[best.tri * 3 + 1] * 3, ic = m.idx[best.tri * 3 + 2] * 3; const w = 1 - best.u - best.v; const Q = G.prev.pos;
        best.disp = [0, 1, 2].map(k => (P[ia + k] - Q[ia + k]) * w + (P[ib + k] - Q[ib + k]) * best.u + (P[ic + k] - Q[ic + k]) * best.v);
      }
    }
    return best;
  },
};
