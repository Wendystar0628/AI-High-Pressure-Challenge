'use strict';
// ---------------------------------------------------------------------------
// 果冻软体：体素四面体网格 + XPBD 新胡克本构（偏量/体积约束），
// 刚性重球两向耦合，基于面法向拉伸的断裂判据（沿四面体面开裂、节点拆分）。
// ---------------------------------------------------------------------------
const JellyShapes = {
  // 圆角块：半宽 hx,hz，高 H，圆角 r
  roundBox(o) {
    const { hx, hz, H, r } = o;
    return (x, y, z) => {
      const qx = Math.abs(x) - (hx - r), qy = Math.abs(y - H / 2) - (H / 2 - r), qz = Math.abs(z) - (hz - r);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
      const d = Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
      return Math.max(d, -y);
    };
  },
  // 布丁（截头圆锥 + 圆顶边）
  flan(o) {
    const { r0, r1, H, r } = o;
    return (x, y, z) => {
      const rr = Math.hypot(x, z);
      const t = U.clamp(y / H, 0, 1);
      const rad = r0 + (r1 - r0) * t;
      const slope = (r0 - r1) / H;
      const side = (rr - rad) / Math.sqrt(1 + slope * slope);
      const top = y - H;
      // 圆角交集
      const a = side + r, b = top + r;
      let d;
      if (a > 0 && b > 0) d = Math.hypot(a, b) - r;
      else d = Math.max(a, b) - r;
      return Math.max(d, -y);
    };
  },
  // 花瓣模具果冻：带棱的高柱，顶部收窄成圆顶
  fluted(o) {
    const { R, H, n, amp } = o;
    return (x, y, z) => {
      const rr = Math.hypot(x, z);
      const th = Math.atan2(z, x);
      const t = U.clamp(y / H, 0, 1);
      const taper = 1 - 0.22 * t;
      const rad = R * taper * (1 + amp * Math.cos(n * th));
      const side = (rr - rad) * 0.85;
      // 顶部圆顶
      const dome = Math.hypot(rr / (R * 0.95), (Math.max(y - H * 0.72, 0)) / (H * 0.28)) - 1;
      const top = Math.max(side, y - H, dome * R * 0.5);
      return Math.max(top, -y);
    };
  },
};

class JellySim {
  constructor() {
    this.g = 9.81;
    this.stageR = 3.0;
    this.stageH = 0.8;
    this.balls = [];
    this.events = [];
    this.jellies = [];
    this.time = 0;
    this.steps = 0;
    this.topoVersion = 0;
    this.ballFriction = 0.6;
    this.groundFriction = 0.45;
    this.tipWeaken = 0.5;
  }

  // ---------------- 构建 ----------------
  build(specs, seed = 1234) {
    const rnd = U.rng(seed);
    this.rnd = rnd;
    const nodes = []; // 全部原始节点 rest 位置
    const nodeJelly = [];
    const tets = []; // [a,b,c,d] 原始节点
    const tetJ = [];
    const tetVox = []; const voxels = []; // [jelly, i, j, k]
    this.jellies = [];
    for (let j = 0; j < specs.length; j++) {
      const s = specs[j];
      const sdf = JellyShapes[s.shape](s);
      const h = s.h;
      const ext = s.extent; // [ex, H, ez] 半宽/高
      const nx = Math.ceil((2 * ext[0]) / h), ny = Math.ceil(ext[1] / h), nz = Math.ceil((2 * ext[2]) / h);
      const ox = -nx * h / 2, oz = -nz * h / 2, oy = 0;
      const inside = new Uint8Array(nx * ny * nz);
      for (let k = 0; k < nz; k++) for (let jj = 0; jj < ny; jj++) for (let i = 0; i < nx; i++) {
        const cx = ox + (i + 0.5) * h, cy = oy + (jj + 0.5) * h, cz = oz + (k + 0.5) * h;
        if (sdf(cx, cy, cz) < -0.05 * h) inside[i + nx * (jj + ny * k)] = 1;
      }
      const nodeMap = new Map();
      const base = nodes.length;
      const local = [];
      const nid = (i, jj, k) => {
        const key = i + (nx + 1) * (jj + (ny + 1) * k);
        let id = nodeMap.get(key);
        if (id === undefined) {
          id = nodes.length; nodeMap.set(key, id);
          const p = [ox + i * h, oy + jj * h, oz + k * h];
          nodes.push(p); nodeJelly.push(j); local.push(id);
        }
        return id;
      };
      const tetStart = tets.length;
      for (let k = 0; k < nz; k++) for (let jj = 0; jj < ny; jj++) for (let i = 0; i < nx; i++) {
        if (!inside[i + nx * (jj + ny * k)]) continue;
        const c = [];
        for (let q = 0; q < 8; q++) c.push(nid(i + (q & 1), jj + ((q >> 1) & 1), k + ((q >> 2) & 1)));
        // c 下标 = dx + 2dy + 4dz
        const A = [[1, 2, 4, 7], [0, 1, 2, 4], [3, 1, 2, 7], [5, 1, 4, 7], [6, 2, 4, 7]];
        const B = [[0, 3, 5, 6], [1, 0, 3, 5], [2, 0, 3, 6], [4, 0, 5, 6], [7, 3, 5, 6]];
        const T = ((i + jj + k) & 1) ? B : A;
        const vid = voxels.length; voxels.push([j, i, jj, k]);
        for (const t of T) { tets.push([c[t[0]], c[t[1]], c[t[2]], c[t[3]]]); tetJ.push(j); tetVox.push(vid); }
      }
      // 表面节点贴合到 SDF 表面
      const isBoundary = new Uint8Array(nodes.length - base);
      const faceCount = new Map();
      for (let t = tetStart; t < tets.length; t++) {
        const tt = tets[t];
        for (let f = 0; f < 4; f++) {
          const tri = tt.filter((_, q) => q !== f).slice().sort((a, b) => a - b);
          const key = tri.join(',');
          faceCount.set(key, (faceCount.get(key) || 0) + 1);
        }
      }
      for (const [key, cnt] of faceCount) if (cnt === 1) for (const id of key.split(',')) isBoundary[+id - base] = 1;
      const orig = local.map((id) => nodes[id].slice());
      for (let pass = 0; pass < 3; pass++) {
        for (const id of local) {
          if (!isBoundary[id - base]) continue;
          const p = nodes[id];
          if (p[1] < 1e-6) { // 底面节点仅水平贴合
            const e = 1e-4;
            const d = sdf(p[0], 0.02, p[2]);
            const gx = (sdf(p[0] + e, 0.02, p[2]) - sdf(p[0] - e, 0.02, p[2])) / (2 * e);
            const gz = (sdf(p[0], 0.02, p[2] + e) - sdf(p[0], 0.02, p[2] - e)) / (2 * e);
            const gl = Math.hypot(gx, gz) || 1;
            const m = U.clamp(d, -0.45 * h, 0.45 * h);
            p[0] -= (gx / gl) * m; p[2] -= (gz / gl) * m;
            continue;
          }
          const e = 1e-4, d = sdf(p[0], p[1], p[2]);
          const gx = (sdf(p[0] + e, p[1], p[2]) - sdf(p[0] - e, p[1], p[2])) / (2 * e);
          const gy = (sdf(p[0], p[1] + e, p[2]) - sdf(p[0], p[1] - e, p[2])) / (2 * e);
          const gz = (sdf(p[0], p[1], p[2] + e) - sdf(p[0], p[1], p[2] - e)) / (2 * e);
          const gl = Math.hypot(gx, gy, gz) || 1;
          const m = U.clamp(d, -0.45 * h, 0.45 * h);
          p[0] -= (gx / gl) * m; p[1] -= (gy / gl) * m; p[2] -= (gz / gl) * m;
          if (p[1] < 0) p[1] = 0;
        }
      }
      // 检查四面体体积，过扁则回退
      for (let it = 0; it < 4; it++) {
        let bad = 0;
        for (let t = tetStart; t < tets.length; t++) {
          const v = this._vol6(nodes, tets[t]);
          if (Math.abs(v) < 0.12 * h * h * h) {
            bad++;
            for (const id of tets[t]) { const o = orig[local.indexOf(id)]; const p = nodes[id]; for (let q = 0; q < 3; q++) p[q] = p[q] * 0.5 + o[q] * 0.5; }
          }
        }
        if (!bad) break;
      }
      // 变换到世界：旋转 + 平移
      const cr = Math.cos(s.rotY || 0), sr = Math.sin(s.rotY || 0);
      for (const id of local) {
        const p = nodes[id];
        const x = p[0] * cr - p[2] * sr, z = p[0] * sr + p[2] * cr;
        p[0] = x + s.pos[0]; p[1] = p[1] + s.pos[1]; p[2] = z + s.pos[2];
      }
      this.jellies.push({
        spec: s, name: s.name, h, tetStart, tetEnd: tets.length, nodeStart: base, nodeEnd: nodes.length,
        mu: s.mu, lam: s.mu * (s.lamRatio || 40), tough: s.tough, damp: s.damp || 0.004, density: s.density || 1050,
        friction: s.friction !== undefined ? s.friction : this.groundFriction,
        color: s.color, pieces: 1, broken: 0, minY: 0, maxY: 0, aabb: [0, 0, 0, 0, 0, 0], center: [0, 0, 0],
      });
    }
    // ---- 汇总数组 ----
    const NN = nodes.length, NT = tets.length;
    this.nn = NN; this.nt = NT;
    this.nodeRest = new Float64Array(NN * 3);
    for (let i = 0; i < NN; i++) { this.nodeRest[i * 3] = nodes[i][0]; this.nodeRest[i * 3 + 1] = nodes[i][1]; this.nodeRest[i * 3 + 2] = nodes[i][2]; }
    this.nodeJ = Int32Array.from(nodeJelly);
    this.cap = Math.max(NN * 3, 4096);
    this.np = NN;
    this.x = new Float64Array(this.cap * 3); this.px = new Float64Array(this.cap * 3); this.v = new Float64Array(this.cap * 3);
    this.w = new Float64Array(this.cap); this.m = new Float64Array(this.cap);
    this.orig = new Int32Array(this.cap); this.pj = new Int32Array(this.cap); this.piece = new Int32Array(this.cap);
    this.bnd = new Uint8Array(this.cap);
    this.x.set(this.nodeRest); this.px.set(this.nodeRest);
    for (let i = 0; i < NN; i++) { this.orig[i] = i; this.pj[i] = nodeJelly[i]; }
    this.tv = new Int32Array(NT * 4); this.to = new Int32Array(NT * 4);
    this.tj = Int32Array.from(tetJ);
    this.tetVox = Int32Array.from(tetVox);
    this.nvox = voxels.length;
    this.voxels = voxels;
    this.dinv = new Float64Array(NT * 9); this.vol = new Float64Array(NT); this.tmass = new Float64Array(NT);
    this.tF = new Float64Array(NT * 9); this.tJ = new Float64Array(NT);
    for (let t = 0; t < NT; t++) {
      let tt = tets[t];
      if (this._vol6(nodes, tt) < 0) tt = [tt[0], tt[2], tt[1], tt[3]];
      for (let q = 0; q < 4; q++) { this.tv[t * 4 + q] = tt[q]; this.to[t * 4 + q] = tt[q]; }
      const p0 = nodes[tt[0]], p1 = nodes[tt[1]], p2 = nodes[tt[2]], p3 = nodes[tt[3]];
      const Dm = [p1[0] - p0[0], p2[0] - p0[0], p3[0] - p0[0], p1[1] - p0[1], p2[1] - p0[1], p3[1] - p0[1], p1[2] - p0[2], p2[2] - p0[2], p3[2] - p0[2]];
      // Dm 行主序 (行=坐标, 列=边)；求逆
      const inv = this._inv3(Dm);
      // dinv 存储: D[k][c] = inv 的 (k 行 c 列)，F = Ds * inv
      for (let q = 0; q < 9; q++) this.dinv[t * 9 + q] = inv[q];
      const V = this._vol6(nodes, tt) / 6;
      this.vol[t] = V;
      this.tmass[t] = V * this.jellies[tetJ[t]].density;
      for (let q = 0; q < 4; q++) this.m[tt[q]] += this.tmass[t] / 4;
    }
    for (let i = 0; i < NN; i++) this.w[i] = this.m[i] > 0 ? 1 / this.m[i] : 0;
    // 节点 -> 四面体
    const cnt = new Int32Array(NN + 1);
    for (let t = 0; t < NT; t++) for (let q = 0; q < 4; q++) cnt[this.to[t * 4 + q] + 1]++;
    for (let i = 0; i < NN; i++) cnt[i + 1] += cnt[i];
    this.ntStart = cnt.slice();
    this.ntList = new Int32Array(cnt[NN]);
    const fill = cnt.slice();
    for (let t = 0; t < NT; t++) for (let q = 0; q < 4; q++) this.ntList[fill[this.to[t * 4 + q]]++] = t;
    // 内部面
    const FACE = [[1, 2, 3], [0, 3, 2], [0, 1, 3], [0, 2, 1]];
    this.FACE = FACE;
    const fmap = new Map();
    this.tnf = new Int32Array(NT * 4).fill(-1); // 每个四面体每个面对应内部面 id
    const fA = [], fB = [], fLA = [], fLB = [], fN = [], fS = [];
    for (let t = 0; t < NT; t++) {
      for (let f = 0; f < 4; f++) {
        const a = this.to[t * 4 + FACE[f][0]], b = this.to[t * 4 + FACE[f][1]], c = this.to[t * 4 + FACE[f][2]];
        const key = [a, b, c].sort((p, q) => p - q).join(',');
        const prev = fmap.get(key);
        if (prev === undefined) fmap.set(key, [t, f]);
        else {
          const id = fA.length;
          fA.push(prev[0]); fLA.push(prev[1]); fB.push(t); fLB.push(f);
          this.tnf[prev[0] * 4 + prev[1]] = id; this.tnf[t * 4 + f] = id;
          // 静止法向
          const pa = nodes[a], pb = nodes[b], pc = nodes[c];
          const n = U.norm(U.cross(U.sub(pb, pa), U.sub(pc, pa)));
          fN.push(n[0], n[1], n[2]);
          fS.push(0.82 + 0.36 * rnd());
          fmap.delete(key);
        }
      }
    }
    this.nf = fA.length;
    // 面-面邻接（共享一条边），用于裂尖弱化
    {
      const edgeMap = new Map();
      const fnodes = [];
      for (let f = 0; f < fA.length; f++) {
        const t = fA[f], lf = fLA[f];
        const nn = FACE[lf].map((q) => this.to[t * 4 + q]).sort((p, q) => p - q);
        fnodes.push(nn);
        for (const [a, b] of [[nn[0], nn[1]], [nn[1], nn[2]], [nn[0], nn[2]]]) {
          const key = a * 1000003 + b;
          let l = edgeMap.get(key); if (!l) { l = []; edgeMap.set(key, l); } l.push(f);
        }
      }
      const adj = [];
      for (let f = 0; f < fA.length; f++) {
        const nn = fnodes[f], set = new Set();
        for (const [a, b] of [[nn[0], nn[1]], [nn[1], nn[2]], [nn[0], nn[2]]]) for (const g of edgeMap.get(a * 1000003 + b)) if (g !== f) set.add(g);
        adj.push([...set]);
      }
      this.fAdj = adj;
    }
    // 体素面：相邻体素之间的两块四面体面，断裂以体素面为单位
    {
      const map = new Map();
      const vfA = [], vfB = [], vfF = [], vfN = [], vfAx = [];
      for (let f = 0; f < fA.length; f++) {
        const va = this.tetVox[fA[f]], vb = this.tetVox[fB[f]];
        if (va === vb) continue;
        const lo = Math.min(va, vb), hi = Math.max(va, vb);
        const key = lo * 4194304 + hi;
        let id = map.get(key);
        if (id === undefined) {
          id = vfA.length; map.set(key, id);
          vfA.push(lo); vfB.push(hi); vfF.push([]);
          const A = voxels[lo], B = voxels[hi];
          const ax = A[1] !== B[1] ? 0 : A[2] !== B[2] ? 1 : 2;
          vfAx.push(ax);
          vfN.push(fN[f * 3], fN[f * 3 + 1], fN[f * 3 + 2]);
        }
        vfF[id].push(f);
      }
      this.nvf = vfA.length;
      this.vfA = Int32Array.from(vfA); this.vfB = Int32Array.from(vfB); this.vfF = vfF; this.vfN = Float64Array.from(vfN);
      this.vfAx = Int8Array.from(vfAx);
      this.vfS = new Float64Array(this.nvf);
      for (let i = 0; i < this.nvf; i++) this.vfS[i] = 0.85 + 0.3 * rnd();
      this.vfBroken = new Uint8Array(this.nvf);
      // 共面相邻体素面（裂纹沿平面延伸）与其它相邻体素面
      const vkey = (j, i, jj, k) => ((j * 512 + i + 64) * 512 + jj + 64) * 512 + k + 64;
      const vmap = new Map();
      voxels.forEach((v, id) => vmap.set(vkey(v[0], v[1], v[2], v[3]), id));
      const fkey = new Map();
      for (let i = 0; i < this.nvf; i++) fkey.set(this.vfA[i] * 4194304 + this.vfB[i], i);
      const findVF = (a, b) => { if (a === undefined || b === undefined) return -1; const lo = Math.min(a, b), hi = Math.max(a, b); const r = fkey.get(lo * 4194304 + hi); return r === undefined ? -1 : r; };
      this.vfCop = []; this.vfOth = [];
      for (let i = 0; i < this.nvf; i++) {
        const A = voxels[this.vfA[i]], B = voxels[this.vfB[i]], ax = this.vfAx[i];
        const cop = [], oth = [];
        for (let d = 0; d < 3; d++) {
          if (d === ax) continue;
          for (const sgn of [-1, 1]) {
            const oa = A.slice(), ob = B.slice(); oa[1 + d] += sgn; ob[1 + d] += sgn;
            const r = findVF(vmap.get(vkey(...oa)), vmap.get(vkey(...ob)));
            if (r >= 0) cop.push(r);
            // 垂直方向：A 与其在 d 方向的邻居
            const r2 = findVF(this.vfA[i], vmap.get(vkey(...oa)));
            if (r2 >= 0) oth.push(r2);
            const r3 = findVF(this.vfB[i], vmap.get(vkey(...ob)));
            if (r3 >= 0) oth.push(r3);
          }
        }
        this.vfCop.push(cop); this.vfOth.push(oth);
      }
      this.voxF = new Float64Array(this.nvox * 9);
      this.voxBrokenCnt = new Uint8Array(this.nvox);
    }
    this.fA = Int32Array.from(fA); this.fB = Int32Array.from(fB);
    this.fLA = Int32Array.from(fLA); this.fLB = Int32Array.from(fLB);
    this.fN = Float64Array.from(fN); this.fS = Float64Array.from(fS);
    this.fBroken = new Uint8Array(this.nf);
    this.fDamage = new Float64Array(this.nf);
    this.tBrokenCnt = new Uint8Array(NT);
    this.v.fill(0);
    this.balls = [];
    this.events = [];
    this.time = 0; this.steps = 0;
    this.pairs = new Int32Array(0); this.npairs = 0;
    this.nodeE = null;
    this.crackFaces = 0;
    this.rebuildSurface();
    this.computePieces();
    this.buildEmbeds(rnd);
    this.topoVersion++;
  }

  _vol6(nodes, t) {
    const a = nodes[t[0]], b = nodes[t[1]], c = nodes[t[2]], d = nodes[t[3]];
    return U.dot(U.sub(b, a), U.cross(U.sub(c, a), U.sub(d, a)));
  }
  _inv3(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    const id = 1 / det;
    return [A * id, -(b * i - c * h) * id, (b * f - c * e) * id, B * id, (a * i - c * g) * id, -(a * f - c * d) * id, C * id, -(a * h - b * g) * id, (a * e - b * d) * id];
  }

  setJellyParams(j, mu, tough) {
    const J = this.jellies[j];
    if (!J) return;
    if (mu !== undefined) { J.mu = mu; J.lam = mu * (J.spec.lamRatio || 40); }
    if (tough !== undefined) J.tough = tough;
  }

  // ---------------- 球 ----------------
  addBall(o) {
    const r = o.r, m = o.m;
    const b = {
      id: this.balls.length, x: o.pos.slice(), px: o.pos.slice(), v: (o.vel || [0, 0, 0]).slice(), r, m, invM: 1 / m,
      I: 0.4 * m * r * r, q: o.q ? o.q.slice() : [0, 0, 0, 1], w: (o.ang || [0, 0, 0]).slice(), mat: o.mat || 0,
      e: o.e !== undefined ? o.e : 0.45, active: true, jc: 0, jcPrev: 0, gc: false, born: this.time, hitJelly: -1,
      contactN: [0, 0, 0], contactV: [0, 0, 0], contactCount: 0, maxPen: 0,
    };
    this.balls.push(b);
    return b;
  }

  // ---------------- 表面 / 碎块 ----------------
  rebuildSurface() {
    const tris = [];
    const FACE = this.FACE;
    this.bnd.fill(0);
    for (let t = 0; t < this.nt; t++) {
      for (let f = 0; f < 4; f++) {
        const fid = this.tnf[t * 4 + f];
        if (fid >= 0 && !this.fBroken[fid]) continue;
        const a = this.tv[t * 4 + FACE[f][0]], b = this.tv[t * 4 + FACE[f][1]], c = this.tv[t * 4 + FACE[f][2]];
        const crack = fid >= 0 ? 1 : 0;
        tris.push(this.tj[t], a, b, c, crack);
        this.bnd[a] = 1; this.bnd[b] = 1; this.bnd[c] = 1;
      }
    }
    // 按果冻排序
    const nTri = tris.length / 5;
    const order = [];
    for (let i = 0; i < nTri; i++) order.push(i);
    order.sort((p, q) => tris[p * 5] - tris[q * 5]);
    this.triData = new Uint32Array(nTri * 4);
    this.triRange = this.jellies.map(() => [0, 0]);
    for (let k = 0; k < nTri; k++) {
      const i = order[k];
      const j = tris[i * 5];
      this.triData[k * 4] = tris[i * 5 + 1]; this.triData[k * 4 + 1] = tris[i * 5 + 2]; this.triData[k * 4 + 2] = tris[i * 5 + 3];
      this.triData[k * 4 + 3] = j | (tris[i * 5 + 4] << 8);
    }
    for (let j = 0; j < this.jellies.length; j++) {
      let s = -1, e = -1;
      for (let k = 0; k < nTri; k++) if ((this.triData[k * 4 + 3] & 255) === j) { if (s < 0) s = k; e = k + 1; }
      this.triRange[j] = [Math.max(s, 0), Math.max(e, 0)];
    }
    this.nTri = nTri;
    // 表面顶点邻接（渲染平滑用）
    const nb = new Map();
    const T = this.triData;
    const addE = (a, b) => { let s = nb.get(a); if (!s) { s = new Set(); nb.set(a, s); } s.add(b); };
    for (let k = 0; k < nTri; k++) {
      const a = T[k * 4], b = T[k * 4 + 1], c = T[k * 4 + 2];
      addE(a, b); addE(b, a); addE(b, c); addE(c, b); addE(c, a); addE(a, c);
    }
    const verts = [...nb.keys()];
    this.smV = Int32Array.from(verts);
    this.smStart = new Int32Array(verts.length + 1);
    const lst = [];
    verts.forEach((v, i) => { this.smStart[i] = lst.length; for (const u of nb.get(v)) lst.push(u); });
    this.smStart[verts.length] = lst.length;
    this.smNbr = Int32Array.from(lst);
    this.bndList = [];
    for (let i = 0; i < this.np; i++) if (this.bnd[i]) this.bndList.push(i);
    this.topoVersion++;
  }

  computePieces() {
    const parent = new Int32Array(this.np);
    for (let i = 0; i < this.np; i++) parent[i] = i;
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    for (let t = 0; t < this.nt; t++) {
      const r0 = find(this.tv[t * 4]);
      for (let q = 1; q < 4; q++) { const r = find(this.tv[t * 4 + q]); if (r !== r0) parent[r] = r0; }
    }
    const roots = new Map();
    for (let i = 0; i < this.np; i++) {
      const r = find(i);
      if (!roots.has(r)) roots.set(r, roots.size);
      this.piece[i] = roots.get(r);
    }
    for (const J of this.jellies) {
      const s = new Set();
      for (let t = J.tetStart; t < J.tetEnd; t++) s.add(this.piece[this.tv[t * 4]]);
      J.pieces = s.size;
    }
  }

  // 果粒：嵌入四面体，随形变移动与拉伸
  buildEmbeds(rnd) {
    this.embeds = [];
    for (let j = 0; j < this.jellies.length; j++) {
      const J = this.jellies[j];
      const n = J.spec.bits || 0;
      let tries = 0;
      while (this.embeds.filter((e) => e.j === j).length < n && tries < n * 20) {
        tries++;
        const t = J.tetStart + Math.floor(rnd() * (J.tetEnd - J.tetStart));
        // 只放在内部（离表面有一定距离）
        let interior = true;
        for (let q = 0; q < 4; q++) if (this.bnd[this.to[t * 4 + q]]) interior = false;
        if (!interior && rnd() < 0.85) continue;
        let b0 = rnd(), b1 = rnd(), b2 = rnd();
        if (b0 + b1 + b2 > 1) { b0 = 1 - b0; b1 = 1 - b1; if (b0 + b1 + b2 > 1) { b2 = 1 - b2; } }
        let s = b0 + b1 + b2; if (s > 1) { b0 /= s; b1 /= s; b2 /= s; s = 1; }
        const bw = [1 - b0 - b1 - b2, b0, b1, b2];
        // 随机旋转矩阵
        const ax = U.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), ang = rnd() * Math.PI * 2;
        const c = Math.cos(ang), sn = Math.sin(ang), C = 1 - c;
        const R = [
          c + ax[0] * ax[0] * C, ax[1] * ax[0] * C + ax[2] * sn, ax[2] * ax[0] * C - ax[1] * sn,
          ax[0] * ax[1] * C - ax[2] * sn, c + ax[1] * ax[1] * C, ax[2] * ax[1] * C + ax[0] * sn,
          ax[0] * ax[2] * C + ax[1] * sn, ax[1] * ax[2] * C - ax[0] * sn, c + ax[2] * ax[2] * C,
        ];
        const size = (J.spec.bitSize || 0.035) * (0.7 + 0.6 * rnd());
        const pal = J.spec.bitColors || [[1, 0.8, 0.2]];
        this.embeds.push({ j, t, bw, R, size, color: pal[Math.floor(rnd() * pal.length)], shape: rnd() < 0.5 ? 0 : 1 });
      }
    }
  }

  // ---------------- 断裂 ----------------
  computeF() {
    const x = this.x, tv = this.tv, D = this.dinv, Fo = this.tF, Jo = this.tJ;
    for (let t = 0; t < this.nt; t++) {
      const a = tv[t * 4] * 3, b = tv[t * 4 + 1] * 3, c = tv[t * 4 + 2] * 3, d = tv[t * 4 + 3] * 3;
      const e1x = x[b] - x[a], e1y = x[b + 1] - x[a + 1], e1z = x[b + 2] - x[a + 2];
      const e2x = x[c] - x[a], e2y = x[c + 1] - x[a + 1], e2z = x[c + 2] - x[a + 2];
      const e3x = x[d] - x[a], e3y = x[d + 1] - x[a + 1], e3z = x[d + 2] - x[a + 2];
      const o = t * 9;
      const D00 = D[o], D01 = D[o + 1], D02 = D[o + 2], D10 = D[o + 3], D11 = D[o + 4], D12 = D[o + 5], D20 = D[o + 6], D21 = D[o + 7], D22 = D[o + 8];
      // F 行主序
      const F00 = e1x * D00 + e2x * D10 + e3x * D20, F01 = e1x * D01 + e2x * D11 + e3x * D21, F02 = e1x * D02 + e2x * D12 + e3x * D22;
      const F10 = e1y * D00 + e2y * D10 + e3y * D20, F11 = e1y * D01 + e2y * D11 + e3y * D21, F12 = e1y * D02 + e2y * D12 + e3y * D22;
      const F20 = e1z * D00 + e2z * D10 + e3z * D20, F21 = e1z * D01 + e2z * D11 + e3z * D21, F22 = e1z * D02 + e2z * D12 + e3z * D22;
      Fo[o] = F00; Fo[o + 1] = F01; Fo[o + 2] = F02; Fo[o + 3] = F10; Fo[o + 4] = F11; Fo[o + 5] = F12; Fo[o + 6] = F20; Fo[o + 7] = F21; Fo[o + 8] = F22;
      Jo[t] = F00 * (F11 * F22 - F12 * F21) - F01 * (F10 * F22 - F12 * F20) + F02 * (F10 * F21 - F11 * F20);
    }
  }

  // 断裂判据：相邻两体素在交界面法向上的拉伸应变 |F·n|-1 超过断裂伸长（结实程度）即沿该体素面断开；
  // 断面周围共面的体素面强度下降（裂尖应力集中），裂纹沿平面扩展。
  checkFracture() {
    this.computeF();
    const Fm = this.tF, VF = this.voxF;
    VF.fill(0);
    for (let t = 0; t < this.nt; t++) {
      const v = this.tetVox[t] * 9, o = t * 9;
      for (let q = 0; q < 9; q++) VF[v + q] += Fm[o + q] * 0.2;
    }
    const cand = [];
    let maxR = 0;
    for (let i = 0; i < this.nvf; i++) {
      if (this.vfBroken[i]) continue;
      const a = this.vfA[i] * 9, b = this.vfB[i] * 9;
      const nx = this.vfN[i * 3], ny = this.vfN[i * 3 + 1], nz = this.vfN[i * 3 + 2];
      const sx = (VF[a] + VF[b]) * nx + (VF[a + 1] + VF[b + 1]) * ny + (VF[a + 2] + VF[b + 2]) * nz;
      const sy = (VF[a + 3] + VF[b + 3]) * nx + (VF[a + 4] + VF[b + 4]) * ny + (VF[a + 5] + VF[b + 5]) * nz;
      const sz = (VF[a + 6] + VF[b + 6]) * nx + (VF[a + 7] + VF[b + 7]) * ny + (VF[a + 8] + VF[b + 8]) * nz;
      const strain = Math.sqrt(sx * sx + sy * sy + sz * sz) * 0.5 - 1;
      const J = this.jellies[this.voxels[this.vfA[i]][0]];
      const r = strain / (J.tough * this.vfS[i]);
      if (r > maxR) maxR = r;
      if (r > 1) cand.push(i, r);
    }
    this.maxStrain = maxR;
    if (!cand.length) return 0;
    const idx = [];
    for (let k = 0; k < cand.length; k += 2) idx.push(k);
    idx.sort((p, q) => cand[q + 1] - cand[p + 1]);
    const faces = [], done = [];
    const vb = this.voxBrokenCnt;
    for (const k of idx) {
      if (done.length >= 24) break;
      const i = cand[k];
      const A = this.vfA[i], B = this.vfB[i];
      if (vb[A] >= 4 || vb[B] >= 4) continue;
      vb[A]++; vb[B]++;
      this.vfBroken[i] = 1;
      done.push(i);
      for (const f of this.vfF[i]) if (!this.fBroken[f]) { this.fBroken[f] = 1; faces.push(f); }
    }
    for (const i of done) {
      for (const g of this.vfCop[i]) if (!this.vfBroken[g]) this.vfS[g] = Math.max(this.vfS[g] * this.tipWeaken, 0.25);
      for (const g of this.vfOth[i]) if (!this.vfBroken[g]) this.vfS[g] = Math.max(this.vfS[g] * 0.97, 0.25);
    }
    if (!faces.length) return 0;
    this.applyBreaks(faces);
    return faces.length;
  }

  applyBreaks(faces) {
    const FACE = this.FACE;
    const nodes = new Set();
    let cx = 0, cy = 0, cz = 0;
    for (const f of faces) {
      const t = this.fA[f], lf = this.fLA[f];
      for (const q of FACE[lf]) {
        const o = this.to[t * 4 + q]; nodes.add(o);
        cx += this.nodeRest[o * 3]; cy += this.nodeRest[o * 3 + 1]; cz += this.nodeRest[o * 3 + 2];
      }
    }
    const j = this.tj[this.fA[faces[0]]];
    let split = 0;
    for (const o of nodes) {
      const s = this.ntStart[o], e = this.ntStart[o + 1];
      const list = this.ntList.subarray(s, e);
      const n = list.length;
      const par = new Int32Array(n);
      for (let i = 0; i < n; i++) par[i] = i;
      const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
      const idx = new Map();
      for (let i = 0; i < n; i++) idx.set(list[i], i);
      for (let i = 0; i < n; i++) {
        const t = list[i];
        for (let f = 0; f < 4; f++) {
          if (this.to[t * 4 + f] === o) continue; // 面 f 不含 o
          const fid = this.tnf[t * 4 + f];
          if (fid < 0 || this.fBroken[fid]) continue;
          const u = this.fA[fid] === t ? this.fB[fid] : this.fA[fid];
          const k = idx.get(u);
          if (k === undefined) continue;
          const ra = find(i), rb = find(k);
          if (ra !== rb) par[ra] = rb;
        }
      }
      // 分组：按根
      const groups = new Map();
      for (let i = 0; i < n; i++) {
        const r = find(i);
        if (!groups.has(r)) groups.set(r, []);
        groups.get(r).push(list[i]);
      }
      if (groups.size < 2) continue;
      // 当前粒子 -> 组
      const byParticle = new Map();
      for (const g of groups.values()) {
        const t = g[0];
        let p = -1;
        for (let q = 0; q < 4; q++) if (this.to[t * 4 + q] === o) p = this.tv[t * 4 + q];
        if (!byParticle.has(p)) byParticle.set(p, []);
        byParticle.get(p).push(g);
      }
      for (const [p, gs] of byParticle) {
        if (gs.length < 2) continue;
        // 体积最大的组保留原粒子
        gs.sort((A, B) => B.length - A.length);
        for (let gi = 1; gi < gs.length; gi++) {
          const np = this.newParticle(p);
          for (const t of gs[gi]) for (let q = 0; q < 4; q++) if (this.to[t * 4 + q] === o) this.tv[t * 4 + q] = np;
          split++;
        }
        // 重算质量
        const touched = new Set([p]);
        for (let gi = 0; gi < gs.length; gi++) for (const t of gs[gi]) for (let q = 0; q < 4; q++) if (this.to[t * 4 + q] === o) touched.add(this.tv[t * 4 + q]);
        for (const pp of touched) this.m[pp] = 0;
        for (let i = 0; i < n; i++) { const t = list[i]; for (let q = 0; q < 4; q++) if (this.to[t * 4 + q] === o) this.m[this.tv[t * 4 + q]] += this.tmass[t] / 4; }
        for (const pp of touched) this.w[pp] = this.m[pp] > 0 ? 1 / this.m[pp] : 0;
      }
    }
    const k = faces.length * 3;
    this.crackFaces += faces.length;
    this.jellies[j].broken += faces.length;
    this.rebuildSurface();
    const oldPieces = this.jellies[j].pieces;
    this.computePieces();
    this.events.push({ type: 'crack', n: faces.length, split, pos: [cx / k, cy / k, cz / k], jelly: j, pieces: this.jellies[j].pieces, newPiece: this.jellies[j].pieces > oldPieces });
    this.pairsDirty = true;
  }

  newParticle(p) {
    if (this.np >= this.cap) this.grow();
    const n = this.np++;
    for (let q = 0; q < 3; q++) { this.x[n * 3 + q] = this.x[p * 3 + q]; this.px[n * 3 + q] = this.px[p * 3 + q]; this.v[n * 3 + q] = this.v[p * 3 + q]; }
    this.orig[n] = this.orig[p]; this.pj[n] = this.pj[p];
    return n;
  }
  grow() {
    const cap = this.cap * 2;
    const g = (A, T, k) => { const B = new T(cap * k); B.set(A); return B; };
    this.x = g(this.x, Float64Array, 3); this.px = g(this.px, Float64Array, 3); this.v = g(this.v, Float64Array, 3);
    this.w = g(this.w, Float64Array, 1); this.m = g(this.m, Float64Array, 1);
    this.orig = g(this.orig, Int32Array, 1); this.pj = g(this.pj, Int32Array, 1); this.piece = g(this.piece, Int32Array, 1);
    this.bnd = g(this.bnd, Uint8Array, 1);
    this.cap = cap;
  }

  // 粒子间（不同果冻/碎块之间）碰撞候选
  buildPairs() {
    const list = this.bndList;
    const cell = 0.12;
    const hash = new Map();
    const x = this.x;
    for (const i of list) {
      const kx = Math.floor(x[i * 3] / cell), ky = Math.floor(x[i * 3 + 1] / cell), kz = Math.floor(x[i * 3 + 2] / cell);
      const key = (kx * 73856093) ^ (ky * 19349663) ^ (kz * 83492791);
      let a = hash.get(key); if (!a) { a = []; hash.set(key, a); } a.push(i);
    }
    const pairs = [];
    const nr = this.nodeRest;
    for (const i of list) {
      const kx = Math.floor(x[i * 3] / cell), ky = Math.floor(x[i * 3 + 1] / cell), kz = Math.floor(x[i * 3 + 2] / cell);
      const ji = this.pj[i], oi = this.orig[i], hi = this.jellies[ji].h;
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const key = ((kx + dx) * 73856093) ^ ((ky + dy) * 19349663) ^ ((kz + dz) * 83492791);
        const a = hash.get(key); if (!a) continue;
        for (const jj of a) {
          if (jj <= i) continue;
          const oj = this.orig[jj];
          if (oj === oi) continue;
          const ddx = x[i * 3] - x[jj * 3], ddy = x[i * 3 + 1] - x[jj * 3 + 1], ddz = x[i * 3 + 2] - x[jj * 3 + 2];
          const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
          const hj = this.jellies[this.pj[jj]].h;
          const dmin = 0.36 * (hi + hj);
          if (d2 > (dmin * 2.2) ** 2) continue;
          if (this.pj[jj] === ji && this.piece[jj] === this.piece[i]) {
            const rx = nr[oi * 3] - nr[oj * 3], ry = nr[oi * 3 + 1] - nr[oj * 3 + 1], rz = nr[oi * 3 + 2] - nr[oj * 3 + 2];
            if (rx * rx + ry * ry + rz * rz < (1.8 * hi) ** 2) continue;
          }
          pairs.push(i, jj);
        }
      }
    }
    this.pairs = Int32Array.from(pairs);
    this.npairs = pairs.length / 2;
    this.pairsDirty = false;
  }

  updateBounds() {
    const x = this.x;
    for (const J of this.jellies) { J.aabb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; J._c = [0, 0, 0, 0]; }
    for (let i = 0; i < this.np; i++) {
      const J = this.jellies[this.pj[i]], a = J.aabb;
      const px = x[i * 3], py = x[i * 3 + 1], pz = x[i * 3 + 2];
      if (px < a[0]) a[0] = px; if (py < a[1]) a[1] = py; if (pz < a[2]) a[2] = pz;
      if (px > a[3]) a[3] = px; if (py > a[4]) a[4] = py; if (pz > a[5]) a[5] = pz;
      J._c[0] += px * this.m[i]; J._c[1] += py * this.m[i]; J._c[2] += pz * this.m[i]; J._c[3] += this.m[i];
    }
    for (const J of this.jellies) J.center = [J._c[0] / J._c[3], J._c[1] / J._c[3], J._c[2] / J._c[3]];
  }

  // ---------------- 时间推进（一个子步） ----------------
  substep(dt) {
    const np = this.np, x = this.x, px = this.px, v = this.v, w = this.w;
    const gdt = this.g * dt;
    for (let i = 0; i < np; i++) {
      const i3 = i * 3;
      px[i3] = x[i3]; px[i3 + 1] = x[i3 + 1]; px[i3 + 2] = x[i3 + 2];
      if (w[i] === 0) continue;
      v[i3 + 1] -= gdt;
      x[i3] += v[i3] * dt; x[i3 + 1] += v[i3 + 1] * dt; x[i3 + 2] += v[i3 + 2] * dt;
    }
    for (const b of this.balls) {
      if (!b.active) continue;
      b.px[0] = b.x[0]; b.px[1] = b.x[1]; b.px[2] = b.x[2];
      b.vPrev = b.v.slice();
      b.v[1] -= gdt;
      b.x[0] += b.v[0] * dt; b.x[1] += b.v[1] * dt; b.x[2] += b.v[2] * dt;
    }
    this.solveTets(dt);
    this.solveContacts(dt);
    const inv = 1 / dt;
    for (let i = 0; i < np; i++) {
      const i3 = i * 3;
      let vx = (x[i3] - px[i3]) * inv, vy = (x[i3 + 1] - px[i3 + 1]) * inv, vz = (x[i3 + 2] - px[i3 + 2]) * inv;
      const s2 = vx * vx + vy * vy + vz * vz;
      if (s2 > 196) { const k = 14 / Math.sqrt(s2); vx *= k; vy *= k; vz *= k; }
      v[i3] = vx; v[i3 + 1] = vy; v[i3 + 2] = vz;
    }
    for (const b of this.balls) {
      if (!b.active) continue;
      b.v[0] = (b.x[0] - b.px[0]) * inv; b.v[1] = (b.x[1] - b.px[1]) * inv; b.v[2] = (b.x[2] - b.px[2]) * inv;
    }
    this.ballImpulses(dt);
    for (const b of this.balls) {
      if (!b.active) continue;
      b.q = U.qintegrate(b.q, b.w, dt);
      if (b.x[1] < -5) b.active = false;
    }
    this.time += dt;
    this.steps++;
  }

  solveTets(dt) {
    const x = this.x, px = this.px, w = this.w, tv = this.tv, D = this.dinv, vol = this.vol, tj = this.tj;
    const dt2 = dt * dt;
    const jellies = this.jellies;
    const nt = this.nt;
    let jcur = -1, mu = 0, lam = 0, gam = 0, gamma = 1;
    for (let t = 0; t < nt; t++) {
      const jj = tj[t];
      if (jj !== jcur) { jcur = jj; const J = jellies[jj]; mu = J.mu; lam = J.lam; gam = J.damp / dt; gamma = 1 + mu / lam; }
      const ia = tv[t * 4], ib = tv[t * 4 + 1], ic = tv[t * 4 + 2], id = tv[t * 4 + 3];
      const a = ia * 3, b = ib * 3, c = ic * 3, d = id * 3;
      const w0 = w[ia], w1 = w[ib], w2 = w[ic], w3 = w[id];
      const o = t * 9;
      const D00 = D[o], D01 = D[o + 1], D02 = D[o + 2], D10 = D[o + 3], D11 = D[o + 4], D12 = D[o + 5], D20 = D[o + 6], D21 = D[o + 7], D22 = D[o + 8];
      const V = vol[t];
      for (let pass = 0; pass < 2; pass++) {
        const x0 = x[a], y0 = x[a + 1], z0 = x[a + 2];
        const e1x = x[b] - x0, e1y = x[b + 1] - y0, e1z = x[b + 2] - z0;
        const e2x = x[c] - x0, e2y = x[c + 1] - y0, e2z = x[c + 2] - z0;
        const e3x = x[d] - x0, e3y = x[d + 1] - y0, e3z = x[d + 2] - z0;
        const F00 = e1x * D00 + e2x * D10 + e3x * D20, F01 = e1x * D01 + e2x * D11 + e3x * D21, F02 = e1x * D02 + e2x * D12 + e3x * D22;
        const F10 = e1y * D00 + e2y * D10 + e3y * D20, F11 = e1y * D01 + e2y * D11 + e3y * D21, F12 = e1y * D02 + e2y * D12 + e3y * D22;
        const F20 = e1z * D00 + e2z * D10 + e3z * D20, F21 = e1z * D01 + e2z * D11 + e3z * D21, F22 = e1z * D02 + e2z * D12 + e3z * D22;
        let P00, P01, P02, P10, P11, P12, P20, P21, P22, C, alpha, damp;
        if (pass === 0) {
          const Ic = F00 * F00 + F01 * F01 + F02 * F02 + F10 * F10 + F11 * F11 + F12 * F12 + F20 * F20 + F21 * F21 + F22 * F22;
          C = Math.sqrt(Ic);
          if (C < 1e-8) continue;
          const ic = 1 / C;
          P00 = F00 * ic; P01 = F01 * ic; P02 = F02 * ic; P10 = F10 * ic; P11 = F11 * ic; P12 = F12 * ic; P20 = F20 * ic; P21 = F21 * ic; P22 = F22 * ic;
          alpha = 1 / (mu * V * dt2);
          damp = gam;
        } else {
          // 余子式：列 c0 = f1×f2, c1 = f2×f0, c2 = f0×f1（f 为 F 的列）
          P00 = F11 * F22 - F21 * F12; P10 = F21 * F02 - F01 * F22; P20 = F01 * F12 - F11 * F02;
          P01 = F12 * F20 - F22 * F10; P11 = F22 * F00 - F02 * F20; P21 = F02 * F10 - F12 * F00;
          P02 = F10 * F21 - F20 * F11; P12 = F20 * F01 - F00 * F21; P22 = F00 * F11 - F10 * F01;
          const J = F00 * P00 + F10 * P10 + F20 * P20;
          C = J - gamma;
          alpha = 1 / (lam * V * dt2);
          damp = 0;
        }
        // 梯度 g_k = Σ_c P[:,c] * D[k][c]
        const g1x = P00 * D00 + P01 * D01 + P02 * D02, g1y = P10 * D00 + P11 * D01 + P12 * D02, g1z = P20 * D00 + P21 * D01 + P22 * D02;
        const g2x = P00 * D10 + P01 * D11 + P02 * D12, g2y = P10 * D10 + P11 * D11 + P12 * D12, g2z = P20 * D10 + P21 * D11 + P22 * D12;
        const g3x = P00 * D20 + P01 * D21 + P02 * D22, g3y = P10 * D20 + P11 * D21 + P12 * D22, g3z = P20 * D20 + P21 * D21 + P22 * D22;
        const g0x = -g1x - g2x - g3x, g0y = -g1y - g2y - g3y, g0z = -g1z - g2z - g3z;
        const wsum = w0 * (g0x * g0x + g0y * g0y + g0z * g0z) + w1 * (g1x * g1x + g1y * g1y + g1z * g1z) + w2 * (g2x * g2x + g2y * g2y + g2z * g2z) + w3 * (g3x * g3x + g3y * g3y + g3z * g3z);
        let num = C;
        if (damp > 0) {
          const rate = g0x * (x[a] - px[a]) + g0y * (x[a + 1] - px[a + 1]) + g0z * (x[a + 2] - px[a + 2])
            + g1x * (x[b] - px[b]) + g1y * (x[b + 1] - px[b + 1]) + g1z * (x[b + 2] - px[b + 2])
            + g2x * (x[c] - px[c]) + g2y * (x[c + 1] - px[c + 1]) + g2z * (x[c + 2] - px[c + 2])
            + g3x * (x[d] - px[d]) + g3y * (x[d + 1] - px[d + 1]) + g3z * (x[d + 2] - px[d + 2]);
          num += damp * rate;
        }
        const den = (1 + damp) * wsum + alpha;
        if (den < 1e-12) continue;
        const dl = -num / den;
        let s = dl * w0; x[a] += g0x * s; x[a + 1] += g0y * s; x[a + 2] += g0z * s;
        s = dl * w1; x[b] += g1x * s; x[b + 1] += g1y * s; x[b + 2] += g1z * s;
        s = dl * w2; x[c] += g2x * s; x[c + 1] += g2y * s; x[c + 2] += g2z * s;
        s = dl * w3; x[d] += g3x * s; x[d + 1] += g3y * s; x[d + 2] += g3z * s;
      }
    }
  }

  // 台座（圆柱）+ 地面
  stageSdf(px, py, pz) {
    const R = this.stageR, H = this.stageH;
    const rr = Math.hypot(px, pz);
    const dx = rr - R, dy = Math.abs(py + H / 2) - H / 2;
    let d, nx, ny, nz;
    const ox = Math.max(dx, 0), oy = Math.max(dy, 0);
    d = Math.min(Math.max(dx, dy), 0) + Math.hypot(ox, oy);
    // 法向
    if (dx > 0 && dy > 0) { const l = Math.hypot(ox, oy) || 1; const s = ox / l; nx = (px / (rr || 1)) * s; nz = (pz / (rr || 1)) * s; ny = (py > -H / 2 ? 1 : -1) * oy / l; }
    else if (dx > dy) { nx = px / (rr || 1); nz = pz / (rr || 1); ny = 0; }
    else { nx = 0; nz = 0; ny = py > -H / 2 ? 1 : -1; }
    // 地面
    const df = py + H;
    if (df < d) { d = df; nx = 0; ny = 1; nz = 0; }
    return [d, nx, ny, nz];
  }

  solveContacts(dt) {
    const x = this.x, px = this.px, w = this.w, np = this.np;
    const R = this.stageR, H = this.stageH;
    // 粒子-台面
    for (let i = 0; i < np; i++) {
      if (!this.bnd[i]) continue;
      const i3 = i * 3;
      const y = x[i3 + 1];
      if (y >= 0) continue;
      const rr = Math.hypot(x[i3], x[i3 + 2]);
      let pen = 0;
      if (rr < R && y > -H) {
        const dTop = -y, dSide = R - rr;
        if (dTop <= dSide) { pen = dTop; x[i3 + 1] = 0; }
        else { const k = R / rr; x[i3] *= k; x[i3 + 2] *= k; continue; }
      } else if (y < -H) { pen = -H - y; x[i3 + 1] = -H; }
      else continue;
      const mu = this.jellies[this.pj[i]].friction;
      const ddx = x[i3] - px[i3], ddz = x[i3 + 2] - px[i3 + 2];
      const dl = Math.hypot(ddx, ddz);
      if (dl > 0) {
        if (dl < mu * 1.2 * pen) { x[i3] = px[i3]; x[i3 + 2] = px[i3 + 2]; }
        else { const k = Math.min(mu * pen / dl, 1); x[i3] -= ddx * k; x[i3 + 2] -= ddz * k; }
      }
    }
    // 粒子-球
    const rp = 0.018;
    for (const ball of this.balls) {
      if (!ball.active) continue;
      ball.contactCount = 0; ball.contactN = [0, 0, 0]; ball.contactV = [0, 0, 0]; ball.maxPen = 0;
      let cx = ball.x[0], cy = ball.x[1], cz = ball.x[2];
      const pcx = ball.px[0], pcy = ball.px[1], pcz = ball.px[2];
      const rad = ball.r + rp, rad2 = rad * rad, wb = ball.invM;
      const muB = this.ballFriction;
      let hitJ = -1;
      for (let j = 0; j < this.jellies.length; j++) {
        const a = this.jellies[j].aabb;
        if (cx < a[0] - rad - 0.3 || cx > a[3] + rad + 0.3 || cy < a[1] - rad - 0.3 || cy > a[4] + rad + 0.3 || cz < a[2] - rad - 0.3 || cz > a[5] + rad + 0.3) continue;
        const J = this.jellies[j];
        for (let i = 0; i < np; i++) {
          if (this.pj[i] !== j) continue;
          const i3 = i * 3;
          const dx = x[i3] - cx, dy = x[i3 + 1] - cy, dz = x[i3 + 2] - cz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= rad2 || d2 < 1e-12) continue;
          const dd = Math.sqrt(d2), nx = dx / dd, ny = dy / dd, nz = dz / dd;
          const pen = rad - dd;
          const wi = w[i], ws = wi + wb;
          const s = pen / ws;
          x[i3] += nx * s * wi; x[i3 + 1] += ny * s * wi; x[i3 + 2] += nz * s * wi;
          cx -= nx * s * wb; cy -= ny * s * wb; cz -= nz * s * wb;
          // 摩擦（相对切向位移）
          let rx = (x[i3] - px[i3]) - (cx - pcx), ry = (x[i3 + 1] - px[i3 + 1]) - (cy - pcy), rz = (x[i3 + 2] - px[i3 + 2]) - (cz - pcz);
          const rn = rx * nx + ry * ny + rz * nz;
          rx -= rn * nx; ry -= rn * ny; rz -= rn * nz;
          const rl = Math.sqrt(rx * rx + ry * ry + rz * rz);
          if (rl > 1e-12) {
            const k = Math.min(muB * pen / rl, 1);
            const fi = k * wi / ws, fb = k * wb / ws;
            x[i3] -= rx * fi; x[i3 + 1] -= ry * fi; x[i3 + 2] -= rz * fi;
            cx += rx * fb; cy += ry * fb; cz += rz * fb;
          }
          ball.contactCount++;
          ball.contactN[0] -= nx; ball.contactN[1] -= ny; ball.contactN[2] -= nz;
          ball.contactV[0] += x[i3] - px[i3]; ball.contactV[1] += x[i3 + 1] - px[i3 + 1]; ball.contactV[2] += x[i3 + 2] - px[i3 + 2];
          if (pen > ball.maxPen) ball.maxPen = pen;
          hitJ = j;
        }
      }
      ball.x[0] = cx; ball.x[1] = cy; ball.x[2] = cz;
      ball.jc = ball.contactCount;
      if (hitJ >= 0) ball.lastJelly = hitJ;
    }
    // 粒子-粒子（果冻之间 / 碎块之间）
    const P = this.pairs;
    for (let k = 0; k < this.npairs; k++) {
      const i = P[k * 2], j = P[k * 2 + 1];
      const i3 = i * 3, j3 = j * 3;
      const dx = x[i3] - x[j3], dy = x[i3 + 1] - x[j3 + 1], dz = x[i3 + 2] - x[j3 + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      const dmin = 0.36 * (this.jellies[this.pj[i]].h + this.jellies[this.pj[j]].h);
      if (d2 >= dmin * dmin || d2 < 1e-14) continue;
      const dd = Math.sqrt(d2), pen = dmin - dd;
      const wi = w[i], wj = w[j], ws = wi + wj;
      if (ws <= 0) continue;
      const s = pen / ws / dd;
      x[i3] += dx * s * wi; x[i3 + 1] += dy * s * wi; x[i3 + 2] += dz * s * wi;
      x[j3] -= dx * s * wj; x[j3 + 1] -= dy * s * wj; x[j3 + 2] -= dz * s * wj;
      // 轻微摩擦
      const nx = dx / dd, ny = dy / dd, nz = dz / dd;
      let rx = (x[i3] - px[i3]) - (x[j3] - px[j3]), ry = (x[i3 + 1] - px[i3 + 1]) - (x[j3 + 1] - px[j3 + 1]), rz = (x[i3 + 2] - px[i3 + 2]) - (x[j3 + 2] - px[j3 + 2]);
      const rn = rx * nx + ry * ny + rz * nz;
      rx -= rn * nx; ry -= rn * ny; rz -= rn * nz;
      const f = 0.25;
      x[i3] -= rx * f * wi / ws; x[i3 + 1] -= ry * f * wi / ws; x[i3 + 2] -= rz * f * wi / ws;
      x[j3] += rx * f * wj / ws; x[j3 + 1] += ry * f * wj / ws; x[j3 + 2] += rz * f * wj / ws;
    }
  }

  ballImpulses(dt) {
    const balls = this.balls.filter((b) => b.active);
    for (const b of balls) {
      // 果冻接触：滚动趋势
      if (b.jc > 0) {
        const n = U.norm(b.contactN);
        const sv = U.scale(b.contactV, 1 / (b.jc * dt));
        const rel = U.sub(b.v, sv);
        const target = U.scale(U.cross(n, rel), 1 / b.r);
        const k = Math.min(1, 12 * dt);
        for (let q = 0; q < 3; q++) b.w[q] += (target[q] - b.w[q]) * k;
        if (b.jcPrev === 0) {
          const vn = -U.dot(rel, n);
          if (vn > 0.4) this.events.push({ type: 'impact', speed: vn, mass: b.m, pos: b.x.slice(), ball: b.id, jelly: b.lastJelly });
        }
      }
      b.jcPrev = b.jc;
      // 台面/地面
      const [d, nx, ny, nz] = this.stageSdf(b.x[0], b.x[1], b.x[2]);
      if (d < b.r) {
        const n = [nx, ny, nz];
        const pen = b.r - d;
        b.x[0] += nx * pen; b.x[1] += ny * pen; b.x[2] += nz * pen;
        this._contactImpulse(b, n, null, b.e, 0.35, dt);
      } else b.gc = false;
    }
    // 球-球
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], c = balls[j];
      const dx = c.x[0] - a.x[0], dy = c.x[1] - a.x[1], dz = c.x[2] - a.x[2];
      const d = Math.hypot(dx, dy, dz), rs = a.r + c.r;
      if (d >= rs || d < 1e-9) continue;
      const n = [dx / d, dy / d, dz / d];
      const pen = rs - d, wa = a.invM, wc = c.invM, ws = wa + wc;
      for (let q = 0; q < 3; q++) { a.x[q] -= n[q] * pen * wa / ws; c.x[q] += n[q] * pen * wc / ws; }
      const vn = (c.v[0] - a.v[0]) * n[0] + (c.v[1] - a.v[1]) * n[1] + (c.v[2] - a.v[2]) * n[2];
      if (vn < 0) {
        const e = Math.abs(vn) > 0.3 ? Math.min(a.e, c.e) + 0.25 : 0;
        const jn = -(1 + e) * vn / ws;
        for (let q = 0; q < 3; q++) { a.v[q] -= n[q] * jn * wa; c.v[q] += n[q] * jn * wc; }
        if (-vn > 0.5) this.events.push({ type: 'clack', speed: -vn, mass: Math.min(a.m, c.m), pos: [(a.x[0] + c.x[0]) / 2, (a.x[1] + c.x[1]) / 2, (a.x[2] + c.x[2]) / 2], mat: a.mat });
        // 切向：让两球互相带动旋转
        const ra = U.scale(n, a.r), rc = U.scale(n, -c.r);
        const va = U.add(a.v, U.cross(a.w, ra)), vc = U.add(c.v, U.cross(c.w, rc));
        const rel = U.sub(vc, va);
        const rt = U.sub(rel, U.scale(n, U.dot(rel, n)));
        const tl = U.len(rt);
        if (tl > 1e-6) {
          const jt = Math.min(tl / (ws * 3.5), 0.2 * jn);
          const t = U.scale(rt, 1 / tl);
          for (let q = 0; q < 3; q++) { a.v[q] += t[q] * jt * wa; c.v[q] -= t[q] * jt * wc; }
          const ta = U.cross(ra, U.scale(t, jt)), tc = U.cross(rc, U.scale(t, -jt));
          for (let q = 0; q < 3; q++) { a.w[q] += ta[q] / a.I; c.w[q] += tc[q] / c.I; }
        }
      }
    }
  }

  // 刚性球与静止表面的冲量接触（含摩擦与滚动）
  _contactImpulse(b, n, surfV, e, mu, dt) {
    const r = U.scale(n, -b.r);
    const vc = U.add(b.v, U.cross(b.w, r));
    const vn = U.dot(vc, n);
    if (vn < 0) {
      const ee = -vn > 0.35 ? e : 0;
      const jn = -(1 + ee) * vn * b.m;
      for (let q = 0; q < 3; q++) b.v[q] += n[q] * jn / b.m;
      if (-vn > 0.6) this.events.push({ type: 'thud', speed: -vn, mass: b.m, pos: b.x.slice(), mat: b.mat });
      // 摩擦
      const vt = U.sub(vc, U.scale(n, vn));
      const tl = U.len(vt);
      if (tl > 1e-6) {
        const t = U.scale(vt, 1 / tl);
        // 单位冲量引起接触点速度变化：1/m + r²/I
        const k = 1 / b.m + (b.r * b.r) / b.I;
        const jt = Math.min(tl / k, mu * Math.max(jn, b.m * 9.81 * dt));
        for (let q = 0; q < 3; q++) b.v[q] -= t[q] * jt / b.m;
        const tq = U.cross(r, U.scale(t, -jt));
        for (let q = 0; q < 3; q++) b.w[q] += tq[q] / b.I;
      }
      // 滚动阻力
      for (let q = 0; q < 3; q++) b.w[q] *= 1 - 0.6 * dt;
      b.gc = true;
    }
  }

  // ---------------- 渲染数据 ----------------
  fillRender(pos, nrm) {
    const np = this.np, x = this.x;
    for (let i = 0; i < np; i++) { pos[i * 4] = x[i * 3]; pos[i * 4 + 1] = x[i * 3 + 1]; pos[i * 4 + 2] = x[i * 3 + 2]; pos[i * 4 + 3] = 0; }
    // Taubin 平滑：去掉体素网格带来的细碎起伏，仅用于显示
    const nv = this.smV.length;
    if (!this._sm || this._sm.length < nv * 3) this._sm = new Float32Array(nv * 3 + 3000);
    const tmp = this._sm, V = this.smV, S = this.smStart, NB = this.smNbr;
    for (const lam of [0.5, -0.53, 0.5, -0.53]) {
      for (let k = 0; k < nv; k++) {
        const v = V[k];
        let sx = 0, sy = 0, sz = 0; const s0 = S[k], s1 = S[k + 1];
        for (let q = s0; q < s1; q++) { const u = NB[q] * 4; sx += pos[u]; sy += pos[u + 1]; sz += pos[u + 2]; }
        const inv = 1 / (s1 - s0), p = v * 4;
        let f = lam;
        if (pos[p + 1] < 0.004) f = 0; // 贴地顶点不动
        tmp[k * 3] = pos[p] + f * (sx * inv - pos[p]);
        tmp[k * 3 + 1] = pos[p + 1] + f * (sy * inv - pos[p + 1]);
        tmp[k * 3 + 2] = pos[p + 2] + f * (sz * inv - pos[p + 2]);
      }
      for (let k = 0; k < nv; k++) { const p = V[k] * 4; pos[p] = tmp[k * 3]; pos[p + 1] = tmp[k * 3 + 1]; pos[p + 2] = tmp[k * 3 + 2]; }
    }
    nrm.fill(0, 0, np * 4);
    const T = this.triData;
    for (let k = 0; k < this.nTri; k++) {
      const a = T[k * 4], b = T[k * 4 + 1], c = T[k * 4 + 2];
      const ax = pos[a * 4], ay = pos[a * 4 + 1], az = pos[a * 4 + 2];
      const ux = pos[b * 4] - ax, uy = pos[b * 4 + 1] - ay, uz = pos[b * 4 + 2] - az;
      const vx = pos[c * 4] - ax, vy = pos[c * 4 + 1] - ay, vz = pos[c * 4 + 2] - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      nrm[a * 4] += nx; nrm[a * 4 + 1] += ny; nrm[a * 4 + 2] += nz;
      nrm[b * 4] += nx; nrm[b * 4 + 1] += ny; nrm[b * 4 + 2] += nz;
      nrm[c * 4] += nx; nrm[c * 4 + 1] += ny; nrm[c * 4 + 2] += nz;
    }
    for (let i = 0; i < np; i++) {
      const l = Math.hypot(nrm[i * 4], nrm[i * 4 + 1], nrm[i * 4 + 2]);
      if (l > 0) { nrm[i * 4] /= l; nrm[i * 4 + 1] /= l; nrm[i * 4 + 2] /= l; }
    }
  }

  // 嵌入果粒的实例矩阵
  embedTransform(e) {
    const t = e.t, tv = this.tv, x = this.x;
    let p = [0, 0, 0];
    for (let q = 0; q < 4; q++) { const i = tv[t * 4 + q] * 3; p[0] += x[i] * e.bw[q]; p[1] += x[i + 1] * e.bw[q]; p[2] += x[i + 2] * e.bw[q]; }
    const F = this.tF.subarray(t * 9, t * 9 + 9); // 行主序
    const R = e.R, s = e.size;
    // M = F * R * s （列主序输出）
    const m = new Float32Array(16);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) {
      let v = 0; for (let k = 0; k < 3; k++) v += F[r * 3 + k] * R[c * 3 + k];
      m[c * 4 + r] = v * s;
    }
    m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; m[15] = 1;
    return m;
  }

  kineticEnergy(j) {
    let e = 0;
    for (let i = 0; i < this.np; i++) if (this.pj[i] === j) { const i3 = i * 3; e += 0.5 * this.m[i] * (this.v[i3] ** 2 + this.v[i3 + 1] ** 2 + this.v[i3 + 2] ** 2); }
    return e;
  }
  jellyVolume(j) {
    let v = 0; const J = this.jellies[j];
    for (let t = J.tetStart; t < J.tetEnd; t++) v += this.vol[t] * this.tJ[t];
    return v;
  }
}
