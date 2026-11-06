// 生成 helicopter-24.scene：机身、部件、地形、环境和贴图全部在这里用数学与 Canvas 自制。
const { ipcRenderer } = require('electron');

// —— 噪声 ——
function hash2(x, y) { let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2.03; } return s; }
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// —— 几何构建 ——
class Geo {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.hasCol = false; }
  v(x, y, z, nx, ny, nz, u = 0, w = 0, c = null) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, w);
    if (c) { this.col.push(c[0], c[1], c[2]); this.hasCol = true; } else this.col.push(255, 255, 255);
    return this.pos.length / 3 - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  add(o, tf) {
    const base = this.pos.length / 3;
    for (let i = 0; i < o.pos.length; i += 3) {
      let p = [o.pos[i], o.pos[i + 1], o.pos[i + 2]], n = [o.nor[i], o.nor[i + 1], o.nor[i + 2]];
      if (tf) { p = tf.p(p); n = tf.n(n); }
      this.pos.push(...p); this.nor.push(...n);
      this.uv.push(o.uv[i / 3 * 2], o.uv[i / 3 * 2 + 1]);
      this.col.push(o.col[i], o.col[i + 1], o.col[i + 2]);
    }
    if (o.hasCol) this.hasCol = true;
    for (const k of o.idx) this.idx.push(k + base);
    return this;
  }
  encode() {
    const n = this.pos.length / 3;
    const out = { n, pos: b64(new Float32Array(this.pos)), nor: b64(Int8Array.from(this.nor.map((x) => Math.round(clamp(x, -1, 1) * 127)))), idx: b64(n > 65000 ? new Uint32Array(this.idx) : new Uint16Array(this.idx)), wide: n > 65000 };
    if (this.uv.some((x) => x !== 0)) out.uv = b64(new Float32Array(this.uv));
    if (this.hasCol) out.col = b64(new Uint8Array(this.col));
    return out;
  }
}
function b64(arr) {
  const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  const t = btoa(s);
  const lines = [];
  for (let i = 0; i < t.length; i += 3000) lines.push(t.slice(i, i + 3000));
  return lines;
}
const TF = {
  move: (x, y, z) => ({ p: (p) => [p[0] + x, p[1] + y, p[2] + z], n: (n) => n }),
  scale: (sx, sy, sz) => ({ p: (p) => [p[0] * sx, p[1] * sy, p[2] * sz], n: (n) => { const m = [n[0] / sx, n[1] / sy, n[2] / sz]; const l = Math.hypot(...m) || 1; return m.map((v) => v / l); } }),
  rotX: (a) => { const c = Math.cos(a), s = Math.sin(a); return { p: (p) => [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c], n: (n) => [n[0], n[1] * c - n[2] * s, n[1] * s + n[2] * c] }; },
  rotY: (a) => { const c = Math.cos(a), s = Math.sin(a); return { p: (p) => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c], n: (n) => [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c] }; },
  rotZ: (a) => { const c = Math.cos(a), s = Math.sin(a); return { p: (p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]], n: (n) => [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]] }; },
  chain: (...l) => ({ p: (p) => l.reduce((a, t) => t.p(a), p), n: (n) => l.reduce((a, t) => t.n(a), n) }),
};
function box(sx, sy, sz, c) {
  const g = new Geo(); const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  for (const [n, u, w] of faces) {
    const P = (a, b) => [n[0] * hx + u[0] * a * hx + w[0] * b * hx * 0 + (w[0] ? w[0] * b * hx : 0), 0, 0];
    void P;
    const corner = (a, b) => [(n[0] + u[0] * a + w[0] * b) * hx, (n[1] + u[1] * a + w[1] * b) * hy, (n[2] + u[2] * a + w[2] * b) * hz];
    const idx = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b], k) => { const p = corner(a, b); return g.v(p[0], p[1], p[2], n[0], n[1], n[2], k === 1 || k === 2 ? 1 : 0, k >= 2 ? 1 : 0, c); });
    // 保证外向绕序
    const a = corner(-1, -1), b = corner(1, -1), d = corner(1, 1);
    const cross = [(b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])];
    if (cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] > 0) g.quad(idx[0], idx[1], idx[2], idx[3]); else g.quad(idx[0], idx[3], idx[2], idx[1]);
  }
  return g;
}
function cylinder(r0, r1, h, seg = 16, cap = true, c = null) {
  // 沿 Y 轴，底 y=0，顶 y=h
  const g = new Geo();
  const slope = (r0 - r1) / h;
  for (let i = 0; i <= seg; i++) {
    const a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const l = Math.hypot(1, slope);
    g.v(ca * r0, 0, sa * r0, ca / l, slope / l, sa / l, i / seg, 0, c);
    g.v(ca * r1, h, sa * r1, ca / l, slope / l, sa / l, i / seg, 1, c);
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; g.quad(a, a + 1, a + 3, a + 2); }
  if (cap) {
    const ct = g.v(0, h, 0, 0, 1, 0, 0.5, 0.5, c), cb = g.v(0, 0, 0, 0, -1, 0, 0.5, 0.5, c);
    const start = g.pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      g.v(ca * r1, h, sa * r1, 0, 1, 0, ca / 2 + 0.5, sa / 2 + 0.5, c);
      g.v(ca * r0, 0, sa * r0, 0, -1, 0, ca / 2 + 0.5, sa / 2 + 0.5, c);
    }
    for (let i = 0; i < seg; i++) {
      const a = start + i * 2;
      g.tri(ct, a + 2, a);
      g.tri(cb, a + 1, a + 3);
    }
  }
  return g;
}
function sphere(r, seg = 12, rings = 8, c = null) {
  const g = new Geo();
  for (let j = 0; j <= rings; j++) {
    const b = j / rings * Math.PI, sb = Math.sin(b), cb = Math.cos(b);
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      g.v(ca * sb * r, cb * r, sa * sb * r, ca * sb, cb, sa * sb, i / seg, j / rings, c);
    }
  }
  const w = seg + 1;
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) g.quad(j * w + i, j * w + i + 1, (j + 1) * w + i + 1, (j + 1) * w + i);
  return g;
}
// 沿路径的管子
function tube(path, r, seg = 10, c = null) {
  const g = new Geo();
  const n = path.length;
  let prevN = [0, 0, 1];
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
    let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const tl = Math.hypot(...t); t = t.map((v) => v / tl);
    let nn = [prevN[1] * t[2] - prevN[2] * t[1], prevN[2] * t[0] - prevN[0] * t[2], prevN[0] * t[1] - prevN[1] * t[0]];
    let bn = [t[1] * nn[2] - t[2] * nn[1], t[2] * nn[0] - t[0] * nn[2], t[0] * nn[1] - t[1] * nn[0]];
    const nl = Math.hypot(...nn) || 1; nn = nn.map((v) => v / nl);
    const bl = Math.hypot(...bn) || 1; bn = bn.map((v) => v / bl);
    prevN = bn;
    const rr = typeof r === 'function' ? r(i / (n - 1)) : r;
    for (let k = 0; k <= seg; k++) {
      const ang = k / seg * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      const dir = [nn[0] * ca + bn[0] * sa, nn[1] * ca + bn[1] * sa, nn[2] * ca + bn[2] * sa];
      g.v(path[i][0] + dir[0] * rr, path[i][1] + dir[1] * rr, path[i][2] + dir[2] * rr, dir[0], dir[1], dir[2], k / seg, i / (n - 1), c);
    }
  }
  const w = seg + 1;
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) g.quad(i * w + k, i * w + k + 1, (i + 1) * w + k + 1, (i + 1) * w + k);
  return g;
}
// 翼面：沿 span 方向放样，截面是对称翼型
function wing(spanDir, chordDir, upDir, stations, seg = 8, colorAt = null) {
  // stations: [{s, chord, thick, off:[x,y,z], twist}]
  const g = new Geo();
  const prof = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg; const th = 0.1 * 5 * (0.2969 * Math.sqrt(t + 1e-6) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4); prof.push([0.25 - t, th * 2]); }
  const pts = [];
  for (const p of prof) pts.push([p[0], p[1]]);
  for (let i = prof.length - 2; i >= 1; i--) pts.push([prof[i][0], -prof[i][1]]);
  const m = pts.length;
  const nrows = stations.length;
  for (let r = 0; r < nrows; r++) {
    const st = stations[r];
    const c = colorAt ? colorAt(st.s) : null;
    for (let k = 0; k <= m; k++) {
      const q = pts[k % m];
      const q0 = pts[(k - 1 + m) % m], q1 = pts[(k + 1) % m];
      const tx = q1[0] - q0[0], ty = q1[1] - q0[1];
      let nx = ty, ny = -tx;
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const tw = st.twist || 0, ct = Math.cos(tw), sw = Math.sin(tw);
      const cx = q[0] * st.chord, uy = q[1] * st.thick;
      const a = cx * ct - uy * sw, b = cx * sw + uy * ct;
      const na = nx * ct - ny * sw, nb = nx * sw + ny * ct;
      const P = [0, 1, 2].map((i) => st.off[i] + spanDir[i] * st.s + chordDir[i] * a + upDir[i] * b);
      const N = [0, 1, 2].map((i) => chordDir[i] * na + upDir[i] * nb);
      g.v(P[0], P[1], P[2], N[0], N[1], N[2], st.s, k / m, c);
    }
  }
  const w = m + 1;
  for (let r = 0; r < nrows - 1; r++) for (let k = 0; k < m; k++) g.quad(r * w + k, r * w + k + 1, (r + 1) * w + k + 1, (r + 1) * w + k);
  // 端盖
  const cap = (r, flip) => {
    const st = stations[r];
    const c0 = g.v(...[0, 1, 2].map((i) => st.off[i] + spanDir[i] * st.s), ...spanDir.map((v) => (flip ? -v : v)));
    for (let k = 0; k < m; k++) { if (flip) g.tri(c0, r * w + k, r * w + k + 1); else g.tri(c0, r * w + k + 1, r * w + k); }
  };
  cap(0, true); cap(nrows - 1, false);
  return g;
}

// —— 机身放样：连续曲面。截面是上下不同高度的超椭圆 ——
const FUSE = [
  [3.02, -0.16, 0.015, 0.015, 0.015], [2.92, -0.14, 0.22, 0.20, 0.22], [2.62, -0.09, 0.50, 0.50, 0.46], [2.15, -0.03, 0.74, 0.78, 0.64], [1.55, 0.03, 0.89, 0.95, 0.76],
  [0.8, 0.07, 0.97, 1.03, 0.80], [-0.2, 0.09, 0.99, 1.02, 0.80], [-1.1, 0.12, 0.93, 0.93, 0.72], [-1.9, 0.22, 0.72, 0.70, 0.54], [-2.6, 0.38, 0.42, 0.40, 0.32], [-3.15, 0.50, 0.25, 0.25, 0.23],
];
function catmull(p0, p1, p2, p3, t) { return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t); }
function fuseSection(x) {
  const T = FUSE;
  let i = 0;
  while (i < T.length - 2 && x < T[i + 1][0]) i++;
  const t = clamp((T[i][0] - x) / (T[i][0] - T[i + 1][0]), 0, 1);
  const g = (k) => catmull(T[Math.max(0, i - 1)][k], T[i][k], T[i + 1][k], T[Math.min(T.length - 1, i + 2)][k], t);
  return { yc: g(1), hw: Math.max(0.005, g(2)), ht: Math.max(0.005, g(3)), hb: Math.max(0.005, g(4)) };
}
const SUPER = 2.5;
// theta: 0=顶部，π/2=右侧（+z），π=底部，3π/2=左侧
function fusePoint(x, theta, off = 0) {
  const s = fuseSection(x);
  const c = Math.cos(theta), n = Math.sin(theta);
  const e = 2 / SUPER;
  const py = Math.sign(c) * Math.pow(Math.abs(c), e);
  const pz = Math.sign(n) * Math.pow(Math.abs(n), e);
  const h = c >= 0 ? s.ht : s.hb;
  return [x, s.yc + py * (h + off), pz * (s.hw + off)];
}
function fuseNormal(x, theta) {
  const d = 0.01;
  const a = fusePoint(x + d, theta), b = fusePoint(x - d, theta), c = fusePoint(x, theta + d), f = fusePoint(x, theta - d);
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], v = [c[0] - f[0], c[1] - f[1], c[2] - f[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) || 1; n = n.map((k) => k / l);
  const p = fusePoint(x, theta), s = fuseSection(x);
  const out = [0, p[1] - s.yc, p[2]];
  if (n[1] * out[1] + n[2] * out[2] < 0) n = n.map((k) => -k);
  return n;
}
// 贴图坐标：右侧在贴图上半，机头朝右；左侧在下半，机头朝左
const X0 = 3.05, X1 = -3.2;
function fuseUV(x, theta) {
  const s = (x - X0) / (X1 - X0);
  let th = theta % (Math.PI * 2);
  if (th < 0) th += Math.PI * 2;
  if (th <= Math.PI) return [1 - s, 1 - th / Math.PI * 0.5];
  return [s, 0.5 - (th - Math.PI) / Math.PI * 0.5];
}
function fusePatch(xs, ths, off = 0, invert = false) {
  const g = new Geo();
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < ths.length; j++) {
      const p = fusePoint(xs[i], ths[j], off), n = fuseNormal(xs[i], ths[j]), uv = fuseUV(xs[i], ths[j] === Math.PI * 2 ? Math.PI * 2 - 1e-5 : ths[j]);
      if (invert) g.v(p[0], p[1], p[2], -n[0], -n[1], -n[2], uv[0], uv[1]);
      else g.v(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1]);
    }
  }
  const w = ths.length;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < w - 1; j++) {
      const a = i * w + j, b = i * w + j + 1, c = (i + 1) * w + j + 1, d = (i + 1) * w + j;
      // x 递减、theta 递增：外向绕序
      if (invert) g.quad(a, b, c, d); else g.quad(a, d, c, b);
    }
  }
  return g;
}
const linspace = (a, b, n) => { const o = []; for (let i = 0; i <= n; i++) o.push(a + (b - a) * i / n); return o; };
const D = Math.PI / 180;

function buildFuselage() {
  // 窗口和门都对齐网格线，边缘干净：xs、ths 由分段拼出
  const xBreaks = [3.02, 2.70, 2.0, 0.72, 0.60, -0.95, -1.1, -3.15];
  const xCounts = [8, 10, 18, 2, 12, 2, 24];
  const xs = [];
  xBreaks.slice(0, -1).forEach((x, i) => { const seg = linspace(x, xBreaks[i + 1], xCounts[i]); xs.push(...(i === 0 ? seg : seg.slice(1))); });
  const thBreaks = [0, 5, 48, 54, 92, 96, 140, 180];
  const thCounts = [2, 12, 2, 12, 2, 12, 12];
  const half = [];
  thBreaks.slice(0, -1).forEach((t, i) => { const seg = linspace(t * D, thBreaks[i + 1] * D, thCounts[i]); half.push(...(i === 0 ? seg : seg.slice(1))); });
  const ths = [...half];
  for (let i = half.length - 2; i >= 0; i--) ths.push(Math.PI * 2 - half[i]);
  const xi = (x) => xs.findIndex((v) => Math.abs(v - x) < 1e-6);
  const ti = (deg) => half.findIndex((v) => Math.abs(v - deg * D) < 1e-6);
  const w = ths.length;
  const body = new Geo(), glass = new Geo();
  // 共享顶点数据
  const verts = [];
  for (let i = 0; i < xs.length; i++) for (let j = 0; j < w; j++) verts.push({ p: fusePoint(xs[i], ths[j]), n: fuseNormal(xs[i], ths[j]), uv: fuseUV(xs[i], j === w - 1 ? Math.PI * 2 - 1e-5 : ths[j]) });
  verts.forEach((v) => body.v(v.p[0], v.p[1], v.p[2], v.n[0], v.n[1], v.n[2], v.uv[0], v.uv[1]));
  const inGlass = (i, j) => {
    const x = xs[i], x2 = xs[i + 1];
    const tA = Math.min(ths[j], Math.PI * 2 - ths[j + 1]) / D, tB = Math.max(ths[j + 1], 0);
    void tB;
    const t = ths[j] <= Math.PI ? ths[j] / D : (Math.PI * 2 - ths[j + 1]) / D;
    void tA;
    // 前风挡：x 2.70..0.72，θ 5..92°
    if (x <= 2.7 + 1e-6 && x2 >= 0.72 - 1e-6 && t >= 5 - 1e-6 && t < 92 - 1e-6) {
      return !(x <= 2.0 + 1e-6 && x >= 2.0 - 1e-6) || true;
    }
    // 舱门窗：x 0.60..-0.95，θ 54..92°
    if (x <= 0.6 + 1e-6 && x2 >= -0.95 - 1e-6 && t >= 54 - 1e-6 && t < 92 - 1e-6) return true;
    return false;
  };
  const inDoor = (i, j) => {
    const x = xs[i], x2 = xs[i + 1];
    const t = ths[j] <= Math.PI ? ths[j] / D : (Math.PI * 2 - ths[j + 1]) / D;
    return x <= 0.6 + 1e-6 && x2 >= -0.95 - 1e-6 && t >= 96 - 1e-6 && t < 140 - 1e-6;
  };
  const glassMap = new Map();
  const gv = (k) => { if (!glassMap.has(k)) { const v = verts[k]; glassMap.set(k, glass.v(v.p[0], v.p[1], v.p[2], v.n[0], v.n[1], v.n[2], 0, 0)); } return glassMap.get(k); };
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < w - 1; j++) {
      const a = i * w + j, b = i * w + j + 1, c = (i + 1) * w + j + 1, d = (i + 1) * w + j;
      if (inGlass(i, j)) { glass.quad(gv(a), gv(d), gv(c), gv(b)); continue; }
      if (inDoor(i, j)) continue;
      body.quad(a, d, c, b);
    }
  }
  void xi; void ti;
  // 门：同一曲面的补片，略微外凸并在四周留缝
  const doorX = linspace(0.585, -0.935, 12);
  const doorR = linspace(97 * D, 139 * D, 10);
  const doorL = linspace(Math.PI * 2 - 139 * D, Math.PI * 2 - 97 * D, 10);
  const doorRight = fusePatch(doorX, doorR, 0.012), doorLeft = fusePatch(doorX, doorL, 0.012);
  // 门洞里的暗色内壁
  const doorBack = new Geo();
  doorBack.add(fusePatch(linspace(0.6, -0.95, 12), linspace(96 * D, 140 * D, 10), -0.025));
  doorBack.add(fusePatch(linspace(0.6, -0.95, 12), linspace(Math.PI * 2 - 140 * D, Math.PI * 2 - 96 * D, 10), -0.025));
  // 内壁：透过玻璃能看到的舱内
  const shell = fusePatch(linspace(2.7, -1.2, 22), linspace(0, Math.PI * 2, 40), -0.045, true);
  return { body, glass, doorRight, doorLeft, doorBack, shell };
}
function buildInterior() {
  const g = new Geo();
  const seat = (x, z, c) => {
    g.add(box(0.5, 0.1, 0.5, c), TF.move(x, -0.28, z));          // 坐垫
    g.add(box(0.1, 0.72, 0.5, c), TF.move(x - 0.26, 0.05, z));   // 靠背
    g.add(box(0.1, 0.18, 0.28, c), TF.move(x - 0.26, 0.5, z));   // 头枕
    g.add(box(0.36, 0.26, 0.36, [40, 40, 48]), TF.move(x, -0.46, z));
  };
  const cf = [62, 58, 92], cr = [120, 96, 40];
  seat(0.95, 0.42, cf); seat(0.95, -0.42, cf);
  seat(-0.35, 0.42, cr); seat(-0.35, -0.42, cr);
  // 地板
  g.add(box(3.4, 0.05, 1.5, [38, 38, 46]), TF.move(0.6, -0.56, 0));
  // 中央立柱
  g.add(box(0.5, 0.3, 0.26, [46, 46, 56]), TF.move(1.55, -0.38, 0));
  // 后舱隔板
  g.add(box(0.05, 1.5, 1.6, [52, 50, 66]), TF.move(-0.95, 0.1, 0));
  return g;
}
function buildPanel() {
  const g = new Geo();
  g.add(box(0.28, 0.42, 1.28, [28, 30, 36]), TF.chain(TF.rotZ(0.32), TF.move(1.92, -0.14, 0)));
  // 遮光罩
  g.add(box(0.34, 0.05, 1.28, [18, 18, 22]), TF.move(1.82, 0.1, 0));
  // 面板显示屏（发光）
  for (const z of [-0.42, -0.14, 0.14, 0.42]) g.add(box(0.02, 0.2, 0.22, [90, 220, 170]), TF.chain(TF.rotZ(0.32), TF.move(1.776, -0.1, z)));
  return g;
}
function buildCowl() {
  const g = new Geo();
  const xs = linspace(0.5, -1.75, 26), ths = linspace(-100 * D, 100 * D, 18);
  const cs = (x) => {
    const t = clamp((0.5 - x) / 2.25, 0, 1);
    const hw = 0.5 * Math.sin(Math.PI * Math.pow(t, 0.62)) ** 0.5 + 0.015;
    const ht = 0.46 * Math.sin(Math.PI * Math.pow(t, 0.62)) ** 0.5 + 0.015;
    const s = fuseSection(x);
    return { hw, ht, y: s.yc + s.ht - 0.06 };
  };
  for (let i = 0; i < xs.length; i++) {
    const s = cs(xs[i]);
    for (let j = 0; j < ths.length; j++) {
      const a = ths[j];
      const y = s.y + Math.cos(a) * s.ht, z = Math.sin(a) * s.hw;
      const nl = Math.hypot(Math.cos(a) / s.ht, Math.sin(a) / s.hw) || 1;
      const uu = 0.5 + j / ths.length * 0.0;
      g.v(xs[i], y, z, 0.0, Math.cos(a) / s.ht / nl, Math.sin(a) / s.hw / nl, uu, i / xs.length);
    }
  }
  const w = ths.length;
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < w - 1; j++) g.quad(i * w + j, (i + 1) * w + j, (i + 1) * w + j + 1, i * w + j + 1);
  return g;
}
function buildExhaust() {
  const g = new Geo();
  for (const z of [0.3, -0.3]) {
    const p = [[-1.25, 1.25, z], [-1.5, 1.27, z * 1.15], [-1.75, 1.2, z * 1.3], [-1.95, 1.12, z * 1.4]];
    g.add(tube(p, 0.085, 12));
  }
  return g;
}
function buildGrille() {
  const g = new Geo();
  for (const z of [0.42, -0.42]) for (let i = 0; i < 6; i++) g.add(box(0.06, 0.2, 0.012, [24, 24, 30]), TF.move(-0.55 + i * 0.1, 1.26, z));
  return g;
}
function buildMast() {
  const g = new Geo();
  g.add(cylinder(0.12, 0.08, 0.4, 16), TF.move(0, 1.12, 0));
  g.add(cylinder(0.085, 0.07, 0.42, 16), TF.move(0, 1.3, 0));
  g.add(cylinder(0.2, 0.17, 0.05, 20), TF.move(0, 1.36, 0)); // 倾斜盘
  return g;
}
function buildHub() {
  const g = new Geo();
  g.add(cylinder(0.17, 0.14, 0.11, 20), TF.move(0, -0.05, 0));
  g.add(cylinder(0.09, 0.03, 0.15, 14), TF.move(0, 0.06, 0));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    g.add(box(0.42, 0.045, 0.1), TF.chain(TF.move(0.33, 0, 0), TF.rotY(a)));
    g.add(box(0.05, 0.13, 0.05), TF.chain(TF.move(0.5, 0.035, 0.06), TF.rotY(a)));
  }
  return g;
}
const YEL = [245, 197, 66], DARK = [52, 54, 64], WHITE = [230, 230, 235];
const bladeColor = (s) => (s > 4.75 ? YEL : s > 4.55 ? WHITE : DARK);
function bladePart(r0, r1, n) {
  const st = [];
  for (let i = 0; i <= n; i++) {
    const s = r0 + (r1 - r0) * i / n;
    st.push({ s, chord: 0.3 * (s > 4.9 ? lerp(1, 0.7, (s - 4.9) / 0.3) : 1), thick: 0.3, off: [0, 0, 0], twist: 0.14 * (1 - s / 5.2) });
  }
  return wing([1, 0, 0], [0, 0, 1], [0, 1, 0], st, 7, bladeColor);
}
function buildBoom() {
  const g = new Geo();
  const n = 20;
  const y = (x) => 0.5 + (x + 3.0) / (-6.9 + 3.0) * 0.5;
  const path = [];
  for (let i = 0; i <= n; i++) { const x = -2.95 + (-6.95 + 2.95) * i / n; path.push([x, y(x), 0]); }
  const r = (t) => lerp(0.235, 0.095, Math.pow(t, 0.8));
  const t = tube(path, r, 18);
  // 贴图：尾梁带黄色条纹
  for (let i = 0; i < t.uv.length; i += 2) { const u = t.uv[i + 1]; t.uv[i] = 0.012 + u * 0.32; t.uv[i + 1] = 0.022 + t.uv[i] * 0.0; }
  g.add(t);
  // 末端整流
  g.add(sphere(0.1, 12, 8), TF.move(-6.95, y(-6.95), 0));
  return g;
}
function buildFin() {
  const st = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; st.push({ s: t * 1.25, chord: lerp(0.86, 0.42, t), thick: 0.18, off: [-6.45 - t * 0.5, 0.92, 0], twist: 0 }); }
  const g = wing([0, 1, 0], [-1, 0, 0], [0, 0, 1], st, 7, (s) => (s > 0.95 ? YEL : [84, 40, 190]));
  // 下垂尾
  const st2 = [];
  for (let i = 0; i <= 4; i++) { const t = i / 4; st2.push({ s: -t * 0.5, chord: lerp(0.5, 0.3, t), thick: 0.18, off: [-6.5, 0.9, 0], twist: 0 }); }
  g.add(wing([0, 1, 0], [-1, 0, 0], [0, 0, 1], st2, 6, () => [84, 40, 190]));
  return g;
}
function buildStab() {
  const st = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8 * 2 - 1; st.push({ s: t * 0.95, chord: lerp(0.5, 0.3, Math.abs(t)), thick: 0.14, off: [-5.45, 0.82, 0], twist: 0 }); }
  return wing([0, 0, 1], [-1, 0, 0], [0, 1, 0], st, 7, (s) => (Math.abs(s) > 0.72 ? YEL : [84, 40, 190]));
}
function buildTailHub() {
  const g = new Geo();
  g.add(cylinder(0.06, 0.05, 0.1, 12), TF.rotX(Math.PI / 2));
  for (const sgn of [1, -1]) {
    const st = [];
    for (let i = 0; i <= 5; i++) { const s = 0.05 + 0.82 * i / 5; st.push({ s: sgn * s, chord: 0.13, thick: 0.25, off: [0, 0, 0.03], twist: 0 }); }
    g.add(wing([1, 0, 0], [0, 1, 0], [0, 0, 1], st, 5, (s) => (Math.abs(s) > 0.68 ? YEL : DARK)));
  }
  return g;
}
function buildTailMount() {
  const g = new Geo();
  g.add(cylinder(0.07, 0.05, 0.28, 12), TF.chain(TF.rotX(Math.PI / 2), TF.move(-6.75, 0.98, 0.02)));
  return g;
}
function buildBlur(r0, r1, flipAxis) {
  const g = new Geo();
  const seg = 64;
  for (let i = 0; i <= seg; i++) {
    const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    if (flipAxis) { g.v(c * r0, s * r0, 0, 0, 0, 1, 0, i / seg * 8); g.v(c * r1, s * r1, 0, 0, 0, 1, 1, i / seg * 8); }
    else { g.v(c * r0, 0, s * r0, 0, 1, 0, 0, i / seg * 8); g.v(c * r1, 0, s * r1, 0, 1, 0, 1, i / seg * 8); }
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; g.quad(a, a + 1, a + 3, a + 2); }
  return g;
}
function buildSkid(z) {
  const g = new Geo();
  const main = [];
  for (let i = 0; i <= 16; i++) { const x = -1.85 + 3.9 * i / 16; const up = x > 1.35 ? Math.pow((x - 1.35) / 0.7, 2) * 0.32 : 0; main.push([x, -1.2 + up, z]); }
  g.add(tube(main, 0.042, 10));
  for (const x of [0.92, -0.85]) {
    const p = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; p.push([x, -1.2 + Math.sin(t * Math.PI / 2) * 0.62, z * (1 - t * 0.72)]); }
    g.add(tube(p, 0.04, 10));
  }
  return g;
}
function buildSkidPads(z) {
  const g = new Geo();
  for (const x of [-1.3, -0.3, 0.6]) g.add(box(0.42, 0.04, 0.1), TF.move(x, -1.245, z));
  // 地勤轮
  g.add(cylinder(0.11, 0.11, 0.07, 16), TF.chain(TF.rotX(Math.PI / 2), TF.move(-0.2, -1.13, z + (z > 0 ? 0.08 : -0.08))));
  return g;
}
function buildCross() {
  const g = new Geo();
  for (const x of [0.92, -0.85]) g.add(tube([[x, -0.58, 0.32], [x, -0.54, 0], [x, -0.58, -0.32]], 0.05, 10));
  return g;
}
function buildAntenna() {
  const g = new Geo();
  g.add(cylinder(0.02, 0.006, 0.42), TF.chain(TF.rotZ(0.5), TF.move(-1.75, 0.88, 0)));
  g.add(sphere(0.07, 10, 6), TF.move(2.85, -0.16, 0.0));
  g.add(cylinder(0.05, 0.05, 0.2), TF.chain(TF.rotZ(Math.PI / 2), TF.move(2.6, -0.5, 0.32)));
  return g;
}
function shard(seed, size, thick) {
  const R = rng(seed);
  const n = 5 + Math.floor(R() * 4);
  const g = new Geo();
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const r = size * (0.55 + R() * 0.6); pts.push([Math.cos(a) * r, Math.sin(a) * r * (0.6 + R() * 0.5)]); }
  const bend = (R() - 0.5) * 0.4;
  const yAt = (p) => bend * (p[0] * p[0]) / size;
  const top = pts.map((p) => g.v(p[0], thick / 2 + yAt(p), p[1], 0, 1, 0, (p[0] / size + 1) * 0.2 + 0.3, (p[1] / size + 1) * 0.2 + 0.55));
  const bot = pts.map((p) => g.v(p[0], -thick / 2 + yAt(p), p[1], 0, -1, 0, 0.1, 0.1));
  for (let i = 1; i < n - 1; i++) { g.tri(top[0], top[i + 1], top[i]); g.tri(bot[0], bot[i], bot[i + 1]); }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p = pts[i], q = pts[j];
    let nx = q[1] - p[1], nz = -(q[0] - p[0]);
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    const a = g.v(p[0], thick / 2 + yAt(p), p[1], nx, 0, nz, 0.02, 0.02), b = g.v(q[0], thick / 2 + yAt(q), q[1], nx, 0, nz, 0.02, 0.02), c = g.v(q[0], -thick / 2 + yAt(q), q[1], nx, 0, nz, 0.02, 0.02), d = g.v(p[0], -thick / 2 + yAt(p), p[1], nx, 0, nz, 0.02, 0.02);
    g.quad(a, d, c, b);
  }
  return g;
}
// 断口：锯齿环和内部肋条
function buildBreak(x, y, r, seed) {
  const g = new Geo();
  const R = rng(seed);
  const n = 16;
  const orange = [214, 150, 80], dark = [40, 40, 44], metal = [170, 170, 176];
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const jag = (i % n === 0 ? 0 : (R() - 0.5) * 0.22);
    g.v(x, y + c * r * 1.02, s * r * 1.02, 0, c, s, 0, 0, metal);
    g.v(x - 0.14 + jag, y + c * r * 1.02, s * r * 1.02, 0, c, s, 0, 0, orange);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; g.quad(a, a + 1, a + 3, a + 2); }
  g.add(cylinder(r * 0.95, r * 0.95, 0.03, n, true, dark), TF.chain(TF.rotZ(Math.PI / 2), TF.move(x + 0.02, y, 0)));
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI;
    g.add(box(0.28, r * 1.9, 0.025, metal), TF.chain(TF.rotX(a), TF.move(x - 0.1, y, 0)));
  }
  return g;
}
function pineCrown() {
  const g = new Geo();
  const R = rng(11);
  const green = (k) => [Math.round(30 + k * 26), Math.round(68 + k * 52), Math.round(40 + k * 24)];
  for (let l = 0; l < 5; l++) {
    const y0 = 2.0 + l * 1.75, r = 2.7 - l * 0.46, h = 3.1 - l * 0.24;
    const seg = 14;
    const base = g.pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const j = i % seg === 0 ? 0.9 : 0.78 + R() * 0.3;
      g.v(ca * r * j, y0 - (i % 2) * 0.28, sa * r * j, ca * 0.8, 0.45, sa * 0.8, 0, 0, green(0.1 + R() * 0.25));
      g.v(0, y0 + h, 0, ca * 0.3, 0.95, sa * 0.3, 0, 0, green(0.75 + R() * 0.25));
    }
    for (let i = 0; i < seg; i++) { const a = base + i * 2; g.tri(a, a + 1, a + 2); }
    const c = g.v(0, y0 - 0.1, 0, 0, -1, 0, 0, 0, green(0));
    for (let i = 0; i < seg; i++) { const a = base + i * 2; g.tri(c, a, a + 2); }
  }
  return g;
}
function trunk(r, h) {
  return cylinder(r, r * 0.55, h, 10, true, [86, 66, 50]);
}
function broadCrown() {
  const g = new Geo();
  const R = rng(23);
  for (let k = 0; k < 7; k++) {
    const r = 1.5 + R() * 1.1;
    const cx = (R() - 0.5) * 3.0, cy = 4.4 + R() * 2.4, cz = (R() - 0.5) * 3.0;
    const s = sphere(r, 12, 8);
    // 起伏
    for (let i = 0; i < s.pos.length; i += 3) {
      const k2 = 1 + (fbm(s.pos[i] * 1.2 + k * 7, s.pos[i + 2] * 1.2 + s.pos[i + 1], 3) - 0.5) * 0.55;
      s.pos[i] *= k2; s.pos[i + 1] *= k2; s.pos[i + 2] *= k2;
      const shade = clamp(0.35 + s.nor[i + 1] * 0.45 + (fbm(s.pos[i] * 2, s.pos[i + 2] * 2, 2) - 0.5), 0, 1);
      s.col[i] = 44 + shade * 56; s.col[i + 1] = 92 + shade * 64; s.col[i + 2] = 38 + shade * 26;
    }
    s.hasCol = true;
    g.add(s, TF.move(cx, cy, cz));
  }
  return g;
}

// —— 贴图 ——
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function toJpeg(c, q = 0.86) { return c.toDataURL('image/jpeg', q); }
function liveryTexture() {
  const W = 2048, H = 1024;
  const [c, g] = canvasOf(W, H);
  const side = (flip, y0) => {
    // 一侧：贴图 x 对应机身 s（右侧 1-s，左侧 s），y 对应 θ（上=机顶，下=机腹）
    g.save();
    g.translate(0, y0);
    const hh = H / 2;
    const grad = g.createLinearGradient(0, 0, 0, hh);
    grad.addColorStop(0, '#3f18a8'); grad.addColorStop(0.3, '#5a24d4'); grad.addColorStop(0.62, '#4a1cb6'); grad.addColorStop(0.82, '#2f1288'); grad.addColorStop(1, '#231064');
    g.fillStyle = grad; g.fillRect(0, 0, W, hh);
    const X = (s) => (flip ? (1 - s) * W : s * W);     // s: 0 机头 → 1 尾部
    const Xw = (s0, s1) => { const a = X(s0), b = X(s1); return [Math.min(a, b), Math.abs(a - b)]; };
    // 黄色识别条：从机头贯穿到尾部，带一条细线
    g.fillStyle = '#f5c542';
    const stripeY = hh * 0.66;
    g.fillRect(0, stripeY, W, hh * 0.085);
    g.fillStyle = '#fff1b8';
    g.fillRect(0, stripeY + hh * 0.095, W, hh * 0.012);
    // 机头黄色色块
    const [nx, nw] = Xw(0, 0.1);
    g.fillStyle = '#f5c542'; g.fillRect(nx, 0, nw, hh);
    g.fillStyle = 'rgba(0,0,0,.12)'; const [nx2, nw2] = Xw(0.095, 0.104); g.fillRect(nx2, 0, nw2, hh);
    // 尾部黄色斜纹
    for (let i = 0; i < 4; i++) {
      const s = 0.8 + i * 0.05;
      const a = X(s), b = X(s + 0.024);
      g.fillStyle = '#f5c542';
      g.beginPath(); g.moveTo(a, hh * 0.15); g.lineTo(b, hh * 0.15); g.lineTo(b + (flip ? -30 : 30), hh * 0.85); g.lineTo(a + (flip ? -30 : 30), hh * 0.85); g.closePath(); g.fill();
    }
    // 舱门接缝线（贴图上的细暗线，几何上另有门缝）
    g.strokeStyle = 'rgba(10,6,30,.55)'; g.lineWidth = 2.5;
    const sOf = (x) => (x - X0) / (X1 - X0);
    const line = (x0, t0, x1, t1) => { g.beginPath(); g.moveTo(X(sOf(x0)), t0 / 180 * hh); g.lineTo(X(sOf(x1)), t1 / 180 * hh); g.stroke(); };
    line(0.66, 50, 0.66, 140); line(-1.02, 50, -1.02, 140); line(0.66, 50, -1.02, 50);
    line(-1.25, 20, -1.25, 150); line(-1.25, 35, 0.5, 35);
    // 铆钉
    g.fillStyle = 'rgba(255,255,255,.14)';
    for (let x = -3.0; x < 2.5; x += 0.14) { g.beginPath(); g.arc(X(sOf(x)), hh * 0.3, 1.4, 0, 7); g.fill(); g.beginPath(); g.arc(X(sOf(x)), hh * 0.92, 1.4, 0, 7); g.fill(); }
    // 数字 24：贴在舱门后方到发动机舱下方
    const cxS = sOf(-1.72);
    const cx = X(cxS);
    g.save();
    g.translate(cx, hh * 0.47);
    g.font = '900 248px "Arial Black", "Segoe UI Black", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 16; g.strokeStyle = '#1a0a4a'; g.strokeText('24', 0, 0);
    g.fillStyle = '#ffd24a'; g.fillText('24', 0, 0);
    g.restore();
    // 舱门上的小标
    g.save();
    g.translate(X(sOf(-0.15)), hh * 0.58);
    g.font = '700 30px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.75)';
    g.fillText('NEST AIR', 0, 0);
    g.restore();
    g.restore();
  };
  side(true, 0);   // 右侧：机头朝贴图右
  side(false, H / 2);
  // 噪声磨损
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (hash2(i % 977, i % 613) - 0.5) * 6; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  return toJpeg(c, 0.9);
}
function detailTexture() {
  const S = 512;
  const [c, g] = canvasOf(S, S);
  const img = g.createImageData(S, S);
  const period = 8;
  const pnoise = (x, y) => {
    // 周期噪声（可平铺）
    const fx = x * period, fy = y * period;
    const ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
    const P = (a, b) => hash2(((a % period) + period) % period, ((b % period) + period) % period);
    const u = ax * ax * (3 - 2 * ax), v = ay * ay * (3 - 2 * ay);
    return lerp(lerp(P(ix, iy), P(ix + 1, iy), u), lerp(P(ix, iy + 1), P(ix + 1, iy + 1), u), v);
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    let n = 0, a = 0.5, f = 1;
    for (let o = 0; o < 4; o++) { n += a * pnoise((u * f) % 1, (v * f) % 1); a *= 0.5; f *= 2; }
    const speck = hash2(x, y);
    const k = 0.78 + n * 0.34 + (speck - 0.5) * 0.3;
    const i = (y * S + x) * 4;
    const b = clamp(k * 255, 0, 255);
    img.data[i] = b; img.data[i + 1] = b; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return toJpeg(c, 0.8);
}
function padTexture(num, accent) {
  const S = 1024;
  const [c, g] = canvasOf(S, S);
  g.fillStyle = '#6f7075'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 22000; i++) { const v = 90 + Math.random() * 60; g.fillStyle = `rgba(${v},${v},${v + 3},.12)`; g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 4, 1 + Math.random() * 3); }
  // 接缝
  g.strokeStyle = 'rgba(30,30,34,.6)'; g.lineWidth = 3;
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * S / 6, 0); g.lineTo(i * S / 6, S); g.moveTo(0, i * S / 6); g.lineTo(S, i * S / 6); g.stroke(); }
  // 油污
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(20,20,22,${0.04 + Math.random() * 0.08})`; g.beginPath(); g.ellipse(S / 2 + (Math.random() - 0.5) * 420, S / 2 + (Math.random() - 0.5) * 420, 30 + Math.random() * 90, 20 + Math.random() * 60, Math.random() * 3, 0, 7); g.fill(); }
  g.strokeStyle = '#f5f5f0'; g.lineWidth = 26; g.beginPath(); g.arc(S / 2, S / 2, 380, 0, 7); g.stroke();
  g.strokeStyle = accent; g.lineWidth = 14; g.beginPath(); g.arc(S / 2, S / 2, 348, 0, 7); g.stroke();
  g.fillStyle = '#f5f5f0'; g.font = '900 500px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', S / 2, S / 2 + 20);
  g.fillStyle = accent; g.font = '900 96px "Arial Black", Impact, sans-serif'; g.fillText(num, S - 110, S - 90);
  g.strokeStyle = '#f5c542'; g.lineWidth = 20; g.strokeRect(14, 14, S - 28, S - 28);
  return toJpeg(c, 0.82);
}
function blurTexture() {
  const W = 256, H = 64;
  const [c, g] = canvasOf(W, H);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = x / W;
    const edge = smooth(0, 0.05, t) * (1 - smooth(0.93, 1, t));
    const band = 0.55 + 0.45 * Math.sin(y / H * Math.PI * 2);
    const tip = t > 0.9 ? 0.9 : 0.42;
    const i = (y * W + x) * 4;
    const yel = t > 0.9;
    img.data[i] = yel ? 245 : 200; img.data[i + 1] = yel ? 197 : 205; img.data[i + 2] = yel ? 66 : 215;
    img.data[i + 3] = 255 * edge * tip * (0.65 + band * 0.35);
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}
function facadeTexture(cols, rows, base, win) {
  const S = 512;
  const [c, g] = canvasOf(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 10, 1 + Math.random() * 3); }
  const cw = S / cols, rh = S / rows;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    g.fillStyle = win;
    g.fillRect(k * cw + cw * 0.18, r * rh + rh * 0.22, cw * 0.64, rh * 0.52);
    g.fillStyle = 'rgba(255,255,255,.14)';
    g.fillRect(k * cw + cw * 0.18, r * rh + rh * 0.22, cw * 0.64, rh * 0.1);
  }
  return toJpeg(c, 0.78);
}
function corrugatedTexture() {
  const S = 512;
  const [c, g] = canvasOf(S, S);
  for (let x = 0; x < S; x++) { const v = 130 + Math.sin(x / 4) * 26 + Math.random() * 6; g.fillStyle = `rgb(${v * 0.9},${v * 0.95},${v})`; g.fillRect(x, 0, 1, S); }
  for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(90,50,20,${Math.random() * 0.1})`; g.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 6, 20 + Math.random() * 90); }
  return toJpeg(c, 0.78);
}

// —— 地形 ——
const TSIZE = 1100, TN = 161;
const PAD_A = { x: -120, z: 40 }, PAD_B = { x: 150, z: -95 };
const PAD_H = 62;
function terrainRaw(x, z) {
  // 场地四周升起成丘陵
  const d = Math.hypot(x, z) / (TSIZE / 2);
  const rim = smooth(0.42, 1.0, d);
  let h = (fbm(x * 0.0035 + 3, z * 0.0035 + 8, 5) - 0.5) * 34;
  h += rim * rim * 90 * (0.55 + fbm(x * 0.004 + 40, z * 0.004 + 9, 5));
  h += (fbm(x * 0.02, z * 0.02, 3) - 0.5) * 2.2;
  return h + PAD_H;
}
function padFlat(h0, x, z, pad, r0, r1) {
  const d = Math.hypot(x - pad.x, z - pad.z);
  const k = smooth(r0, r1, d);
  return lerp(pad.y, h0, k);
}
PAD_A.y = terrainRaw(PAD_A.x, PAD_A.z);
PAD_B.y = terrainRaw(PAD_B.x, PAD_B.z) + 2;
function terrainH(x, z) {
  let h = terrainRaw(x, z);
  h = padFlat(h, x, z, PAD_A, 34, 70);
  h = padFlat(h, x, z, PAD_B, 26, 60);
  return h;
}
function roadDist(x, z) {
  // 两坪之间的土路：一段折线
  const pts = [[PAD_A.x, PAD_A.z], [-30, 62], [60, -10], [PAD_B.x, PAD_B.z]];
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const vx = bx - ax, vz = bz - az;
    const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return best;
}
function terrainTexture(hs) {
  const S = 1536;
  const [c, g] = canvasOf(S, S);
  const img = g.createImageData(S, S);
  const n = TN;
  const H = (x, z) => {
    const fx = clamp((x / TSIZE + 0.5) * (n - 1), 0, n - 1.001), fz = clamp((z / TSIZE + 0.5) * (n - 1), 0, n - 1.001);
    const ix = Math.floor(fx), iz = Math.floor(fz), ax = fx - ix, az = fz - iz;
    return lerp(lerp(hs[iz * n + ix], hs[iz * n + ix + 1], ax), lerp(hs[(iz + 1) * n + ix], hs[(iz + 1) * n + ix + 1], ax), az);
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const wx = (x / S - 0.5) * TSIZE, wz = (y / S - 0.5) * TSIZE;
      const e = 6;
      const slope = Math.hypot(H(wx + e, wz) - H(wx - e, wz), H(wx, wz + e) - H(wx, wz - e)) / (2 * e);
      const n1 = fbm(wx * 0.012 + 5, wz * 0.012 + 2, 5), n2 = fbm(wx * 0.06, wz * 0.06, 4), n3 = fbm(wx * 0.25, wz * 0.25, 3);
      // 草地：黄绿到深绿
      let r = lerp(84, 132, n1), gg = lerp(112, 148, n1), b = lerp(48, 66, n1);
      const dry = smooth(0.45, 0.68, n2);
      r = lerp(r, 148, dry * 0.5); gg = lerp(gg, 136, dry * 0.5); b = lerp(b, 72, dry * 0.5);
      r *= 0.86 + n3 * 0.28; gg *= 0.86 + n3 * 0.28; b *= 0.86 + n3 * 0.28;
      // 坡上露岩
      const rock = smooth(0.34, 0.62, slope + (n2 - 0.5) * 0.3);
      r = lerp(r, 104 + n3 * 36, rock); gg = lerp(gg, 104 + n3 * 36, rock); b = lerp(b, 90 + n3 * 34, rock);
      // 土路
      const rd = roadDist(wx, wz);
      const road = 1 - smooth(2.4, 5.0, rd + (n3 - 0.5) * 2.5);
      r = lerp(r, 150 + n3 * 30, road); gg = lerp(gg, 122 + n3 * 26, road); b = lerp(b, 86 + n3 * 20, road);
      // 停机坪四周的裸土
      for (const pad of [PAD_A, PAD_B]) {
        const dp = Math.hypot(wx - pad.x, wz - pad.z);
        const k = (1 - smooth(13, 30, dp + (n2 - 0.5) * 12)) * 0.7;
        r = lerp(r, 134 + n3 * 26, k); gg = lerp(gg, 118 + n3 * 24, k); b = lerp(b, 88 + n3 * 20, k);
      }
      const i = (y * S + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toJpeg(c, 0.8);
}
function buildMountains() {
  const g = new Geo();
  const R0 = 1500, R1 = 5200;
  const seg = 360, rings = 16;
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    const r = lerp(R0, R1, t);
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const wrapA = i === seg ? 0 : a;
      const ridge = 1 - Math.abs(fbm(Math.cos(wrapA) * 6 + 7, Math.sin(wrapA) * 6 + t * 3.2, 6) * 2 - 1);
      const env = Math.sin(t * Math.PI) ** 0.8;
      const h = env * (260 + ridge * ridge * 1050) * (0.72 + 0.28 * Math.sin(a * 2 + 1.2)) + 40;
      const snow = smooth(760, 1050, h);
      const shade = lerp(0.72, 1.0, ridge);
      const col = [lerp(70 * shade, 226, snow), lerp(82 * shade, 230, snow), lerp(98 * shade, 240, snow)].map(Math.round);
      g.v(x, h, z, 0, 1, 0, 0, 0, col);
    }
  }
  // 法线
  const w = seg + 1;
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) g.quad(j * w + i, (j + 1) * w + i, (j + 1) * w + i + 1, j * w + i + 1);
  computeNormals(g);
  return g;
}
function computeNormals(g) {
  const n = new Float32Array(g.pos.length);
  for (let k = 0; k < g.idx.length; k += 3) {
    const a = g.idx[k] * 3, b = g.idx[k + 1] * 3, c = g.idx[k + 2] * 3;
    const ux = g.pos[b] - g.pos[a], uy = g.pos[b + 1] - g.pos[a + 1], uz = g.pos[b + 2] - g.pos[a + 2];
    const vx = g.pos[c] - g.pos[a], vy = g.pos[c + 1] - g.pos[a + 1], vz = g.pos[c + 2] - g.pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { n[i] += nx; n[i + 1] += ny; n[i + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; g.nor[i] = n[i] / l; g.nor[i + 1] = n[i + 1] / l; g.nor[i + 2] = n[i + 2] / l; }
}
function hangarGeo() {
  // 拱顶机库：沿 x 方向 30 长，宽 22，高 11
  const g = new Geo();
  const L = 30, W = 22, H = 11, seg = 16;
  for (let i = 0; i <= seg; i++) {
    const a = i / seg * Math.PI;
    const y = Math.sin(a) * H * 0.55 + H * 0.45, z = Math.cos(a) * W / 2;
    const ny = Math.sin(a), nz = Math.cos(a);
    g.v(-L / 2, y, z, 0, ny, nz, 0, i / seg * 4); g.v(L / 2, y, z, 0, ny, nz, 6, i / seg * 4);
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; g.quad(a, a + 2, a + 3, a + 1); }
  // 侧墙
  for (const s of [1, -1]) { const b = box(L, H * 0.45, 0.25); g.add(b, TF.move(0, H * 0.225, s * W / 2)); }
  // 两端墙
  for (const s of [1, -1]) {
    const start = g.pos.length / 3;
    const c0 = g.v(s * L / 2, 0, 0, s, 0, 0, 0.1, 0.1);
    const list = [];
    list.push(g.v(s * L / 2, 0, W / 2, s, 0, 0, 0.1, 0.1));
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI; list.push(g.v(s * L / 2, Math.sin(a) * H * 0.55 + H * 0.45, Math.cos(a) * W / 2, s, 0, 0, 0.1, 0.1)); }
    list.push(g.v(s * L / 2, 0, -W / 2, s, 0, 0, 0.1, 0.1));
    for (let i = 0; i < list.length - 1; i++) { if (s > 0) g.tri(c0, list[i + 1], list[i]); else g.tri(c0, list[i], list[i + 1]); }
    void start;
  }
  return g;
}
function towerGeo() {
  const g = new Geo();
  const c = cylinder(3.0, 2.6, 18, 24, true);
  for (let i = 0; i < c.uv.length; i += 2) { c.uv[i] *= 2; c.uv[i + 1] *= 2.4; }
  g.add(c);
  return g;
}
function towerCab() {
  const g = new Geo();
  g.add(cylinder(4.1, 4.8, 3.2, 18, true), TF.move(0, 18, 0));
  return g;
}
function towerRoof() {
  const g = new Geo();
  g.add(cylinder(5.2, 5.2, 0.35, 18, true), TF.move(0, 21.2, 0));
  g.add(cylinder(0.08, 0.04, 4.5, 8, true), TF.move(0, 21.5, 0));
  return g;
}
function tankGeo() {
  const g = new Geo();
  g.add(cylinder(4, 4, 7, 24, true));
  g.add(sphere(4, 24, 8), TF.chain(TF.scale(1, 0.28, 1), TF.move(0, 7, 0)));
  return g;
}
function fenceGeo() {
  const g = new Geo();
  for (let i = 0; i < 5; i++) { g.add(box(0.08, 1.4, 0.08), TF.move(i * 3 - 6, 0.7, 0)); }
  g.add(box(12.2, 0.05, 0.05), TF.move(0, 1.2, 0));
  g.add(box(12.2, 0.05, 0.05), TF.move(0, 0.7, 0));
  return g;
}
function lampGeo(color) {
  const g = new Geo();
  g.add(cylinder(0.08, 0.06, 0.3, 8, true, [60, 60, 66]));
  g.add(sphere(0.12, 8, 6, color), TF.move(0, 0.34, 0));
  return g;
}

// —— 组装 ——
async function main() {
  ipcRenderer.invoke('log', '开始生成几何');
  const F = buildFuselage();
  const geos = {
    fuselage: F.body, glass: F.glass, door_r: F.doorRight, door_l: F.doorLeft, door_back: F.doorBack, shell: F.shell,
    interior: buildInterior(), panel: buildPanel(), cowl: buildCowl(), exhaust: buildExhaust(), grille: buildGrille(), mast: buildMast(), hub: buildHub(),
    blade_in: bladePart(0.42, 2.7, 10), blade_out: bladePart(2.7, 5.2, 12), boom: buildBoom(), fin: buildFin(), stab: buildStab(), tail_mount: buildTailMount(), tail_hub: buildTailHub(),
    blur: buildBlur(0.2, 5.25), tail_blur: buildBlur(0.05, 0.88, true), skid_r: buildSkid(1.08), skid_l: buildSkid(-1.08), pads_r: buildSkidPads(1.08), pads_l: buildSkidPads(-1.08), cross: buildCross(), antenna: buildAntenna(),
    stub: buildBreak(-2.92, 0.5, 0.25, 5), boom_end: buildBreak(-2.92, 0.5, 0.23, 9),
    mountains: buildMountains(), hangar: hangarGeo(), tower: towerGeo(), tower_cab: towerCab(), tower_roof: towerRoof(), tank: tankGeo(), fence: fenceGeo(), lamp_a: lampGeo([255, 190, 70]), lamp_b: lampGeo([90, 220, 255]),
    pine_trunk: trunk(0.42, 3.4), pine_crown: pineCrown(), broad_trunk: trunk(0.5, 5.0), broad_crown: broadCrown(), rock: (() => { const s = sphere(1, 10, 7); for (let i = 0; i < s.pos.length; i += 3) { const k = 0.75 + fbm(s.pos[i] * 2 + 3, s.pos[i + 2] * 2 + s.pos[i + 1], 3) * 0.6; s.pos[i] *= k; s.pos[i + 1] *= k * 0.7; s.pos[i + 2] *= k; } computeNormals(s); return s; })(),
  };
  const chunks = [];
  for (let i = 0; i < 18; i++) {
    const key = 'chunk' + i;
    geos[key] = shard(100 + i * 7, 0.16 + (i % 5) * 0.09, 0.03 + (i % 3) * 0.018);
    chunks.push(key);
  }
  // 部件表：顺序保证父在子前
  const parts = [];
  const P = (name, o) => { parts.push({ name, ...o }); return parts.length - 1; };
  const root = P('直升机', { pos: [0, 0, 0], group: true });
  const m = (name, geometry, material, extra = {}) => P(name, { geometry, material, parent: '直升机', pos: [0, 0, 0], ...extra });
  m('机身', 'fuselage', 'paint');
  m('驾驶舱内壁', 'shell', 'cabin', { pick: false });
  m('门洞内壁', 'door_back', 'cabin', { pick: false });
  m('座舱玻璃', 'glass', 'glass', { castShadow: false });
  m('驾驶舱座椅', 'interior', 'interior');
  m('仪表板', 'panel', 'panel');
  m('右舱门', 'door_r', 'paint');
  m('左舱门', 'door_l', 'paint');
  m('发动机舱', 'cowl', 'cowl');
  m('排气口', 'exhaust', 'exhaust');
  m('进气格栅', 'grille', 'rubber');
  m('天线与传感器', 'antenna', 'metal_dark');
  m('主轴', 'mast', 'metal');
  m('右起落架', 'skid_r', 'metal_dark');
  P('右滑橇胶垫', { geometry: 'pads_r', material: 'rubber', parent: '右起落架', pos: [0, 0, 0] });
  m('左起落架', 'skid_l', 'metal_dark');
  P('左滑橇胶垫', { geometry: 'pads_l', material: 'rubber', parent: '左起落架', pos: [0, 0, 0] });
  m('起落架横梁', 'cross', 'metal_dark');
  const stubI = P('尾梁断口', { geometry: 'stub', material: 'broken', parent: '直升机', pos: [0, 0, 0], visible: false });
  const hubI = P('桨毂', { geometry: 'hub', material: 'metal', parent: '直升机', pos: [0, 1.72, 0] });
  const bladeNames = [], bladeOuter = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const q = [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
    P(`主旋翼桨叶 ${i + 1} 内段`, { geometry: 'blade_in', material: 'blade', parent: '桨毂', pos: [0, 0.02, 0], rot: q });
    const nm = `主旋翼桨叶 ${i + 1} 外段`;
    bladeNames.push(nm);
    bladeOuter.push(P(nm, { geometry: 'blade_out', material: 'blade', parent: '桨毂', pos: [0, 0.02, 0], rot: q }));
  }
  const blurI = P('主旋翼虚影', { geometry: 'blur', material: 'blur', parent: '直升机', pos: [0, 1.72, 0], castShadow: false, opacity: 0, pick: false });
  const boomI = P('尾梁', { geometry: 'boom', material: 'tailpaint', parent: '直升机', pos: [0, 0, 0] });
  P('尾梁断面', { geometry: 'boom_end', material: 'broken', parent: '尾梁', pos: [0, 0, 0] });
  P('垂尾', { geometry: 'fin', material: 'fin', parent: '尾梁', pos: [0, 0, 0] });
  P('水平安定面', { geometry: 'stab', material: 'fin', parent: '尾梁', pos: [0, 0, 0] });
  P('尾桨支座', { geometry: 'tail_mount', material: 'metal_dark', parent: '尾梁', pos: [0, 0, 0] });
  const tailHub = P('尾旋翼', { geometry: 'tail_hub', material: 'blade', parent: '尾梁', pos: [-6.75, 0.98, 0.24] });
  const tailBlur = P('尾旋翼虚影', { geometry: 'tail_blur', material: 'blur', parent: '尾梁', pos: [-6.75, 0.98, 0.26], castShadow: false, opacity: 0, pick: false });
  const chunkIdx = [];
  chunks.forEach((c, i) => { chunkIdx.push(P('碎片 ' + (i + 1), { geometry: c, material: i % 6 === 2 ? 'chunk_yellow' : i % 6 === 5 ? 'metal_dark' : 'chunk', visible: false })); });
  P('远山', { geometry: 'mountains', material: 'mountain', pos: [0, 0, 0], castShadow: false, receiveShadow: false, pick: false, static: true });

  // 物体：场景对象同时用于绘制和飞行接触
  const R = rng(77);
  const objects = [];
  const groundY = (x, z) => terrainH(x, z);
  const padObj = (name, pad, tex) => objects.push({ name, model: tex, x: pad.x, y: pad.y - 0.15, z: pad.z, ry: 0, s: 1, collide: { type: 'box', sx: 20, sy: 0.55, sz: 20, surface: 'concrete' } });
  padObj('1 号停机坪', PAD_A, 'pad_a');
  padObj('2 号停机坪', PAD_B, 'pad_b');
  const addB = (name, model, x, z, ry, sx, sy, sz, s = 1) => objects.push({ name, model, x, y: groundY(x, z), z, ry, s, collide: { type: 'box', sx, sy, sz } });
  addB('机库', 'hangar', PAD_A.x - 42, PAD_A.z + 34, 0.25, 30, 11, 22);
  objects.push({ name: '塔台', model: 'tower', x: PAD_A.x + 34, y: groundY(PAD_A.x + 34, PAD_A.z - 42), z: PAD_A.z - 42, ry: 0, s: 1, collide: { type: 'cyl', r: 5, h: 22 } });
  for (const [dx, dz] of [[-26, -26], [-37, -22]]) objects.push({ name: '油罐', model: 'tank', x: PAD_A.x + dx, y: groundY(PAD_A.x + dx, PAD_A.z + dz), z: PAD_A.z + dz, ry: 0, s: 1, collide: { type: 'cyl', r: 4, h: 8 } });
  addB('二号坪值班楼', 'office', PAD_B.x + 26, PAD_B.z + 22, -0.5, 14, 9, 10);
  for (let i = 0; i < 6; i++) {
    const x = PAD_A.x - 34 + i * 12.4, z = PAD_A.z + 14 + 8;
    void x; void z;
  }
  for (const pad of [PAD_A, PAD_B]) {
    for (const [dx, dz] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) objects.push({ name: '坪灯', model: pad === PAD_A ? 'lamp_a' : 'lamp_b', x: pad.x + dx, y: pad.y + 0.35, z: pad.z + dz, ry: 0, s: 1 });
  }
  const treeSpots = [];
  let tries = 0;
  while (treeSpots.length < 210 && tries < 8000) {
    tries++;
    const x = (R() - 0.5) * 900, z = (R() - 0.5) * 900;
    if (Math.hypot(x - PAD_A.x, z - PAD_A.z) < 62 || Math.hypot(x - PAD_B.x, z - PAD_B.z) < 50) continue;
    if (roadDist(x, z) < 9) continue;
    if (fbm(x * 0.008 + 11, z * 0.008 + 4, 3) < 0.46) continue;
    if (Math.hypot(x, z) > 500) continue;
    treeSpots.push([x, z]);
  }
  treeSpots.forEach(([x, z], i) => {
    const pine = R() < 0.55;
    const s = 0.8 + R() * 0.75;
    objects.push({ name: pine ? '松树' : '阔叶树', model: pine ? 'pine' : 'broad', x, y: groundY(x, z) - 0.1, z, ry: R() * 6.28, s, collide: { type: 'cyl', r: pine ? 1.9 : 2.4, h: pine ? 12 : 8.5 } });
    void i;
  });
  for (let i = 0; i < 46; i++) {
    const x = (R() - 0.5) * 760, z = (R() - 0.5) * 760;
    if (Math.hypot(x - PAD_A.x, z - PAD_A.z) < 40 || Math.hypot(x - PAD_B.x, z - PAD_B.z) < 34 || roadDist(x, z) < 5) continue;
    const s = 0.5 + R() * 1.4;
    objects.push({ name: '岩石', model: 'rock', x, y: groundY(x, z), z, ry: R() * 6.28, s, collide: { type: 'cyl', r: 0.95, h: 1.3 } });
  }
  const heights = [];
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) heights.push(+terrainH((i / (TN - 1) - 0.5) * TSIZE, (j / (TN - 1) - 0.5) * TSIZE).toFixed(2));
  ipcRenderer.invoke('log', '生成贴图');
  const textures = {
    livery: { data: liveryTexture(), srgb: true, aniso: 8 },
    terrain_color: { data: terrainTexture(heights), srgb: true, aniso: 8 },
    detail: { data: detailTexture(), srgb: false, wrap: 'repeat', aniso: 8 },
    pad_a: { data: padTexture('1', '#8f6bff'), srgb: true, aniso: 8 },
    pad_b: { data: padTexture('2', '#4fe3c9'), srgb: true, aniso: 8 },
    blur: { data: blurTexture(), srgb: true, wrap: 'repeat' },
    office: { data: facadeTexture(6, 3, '#c9c4b8', '#27354d'), srgb: true, wrap: 'repeat' },
    tower: { data: facadeTexture(8, 8, '#d7d3c8', '#2a3546'), srgb: true, wrap: 'repeat' },
    steel: { data: corrugatedTexture(), srgb: true, wrap: 'repeat' },
  };
  const materials = {
    paint: { color: '#ffffff', map: 'livery', roughness: 0.3, metalness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 1.1 },
    tailpaint: { color: '#ffffff', map: 'livery', roughness: 0.32, metalness: 0.12, clearcoat: 0.6, clearcoatRoughness: 0.2 },
    fin: { vertexColors: true, roughness: 0.34, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.2 },
    cowl: { color: '#4a1cb8', roughness: 0.34, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.25 },
    glass: { glass: true, color: '#9fc4d8', opacity: 0.16, roughness: 0.04, metalness: 0, envMapIntensity: 2.0 },
    cabin: { color: '#25252f', roughness: 0.85 },
    interior: { vertexColors: true, roughness: 0.82 },
    panel: { vertexColors: true, roughness: 0.5, emissiveVertex: 0.5 },
    metal: { color: '#b4b8c0', roughness: 0.34, metalness: 0.95 },
    metal_dark: { color: '#3c3f47', roughness: 0.45, metalness: 0.8 },
    exhaust: { color: '#5a5048', roughness: 0.6, metalness: 0.75 },
    rubber: { color: '#17171a', roughness: 0.95, metalness: 0 },
    blade: { vertexColors: true, roughness: 0.42, metalness: 0.35 },
    blur: { color: '#ffffff', map: 'blur', transparent: true, depthWrite: false, unlit: true, side: 'double' },
    broken: { vertexColors: true, roughness: 0.55, metalness: 0.7 },
    chunk: { color: '#4b1fbc', roughness: 0.45, metalness: 0.3 },
    chunk_yellow: { color: '#e9b93a', roughness: 0.42, metalness: 0.25 },
    mountain: { vertexColors: true, roughness: 1, fogged: true },
    concrete: { color: '#ffffff', map: 'pad_a', roughness: 0.92 },
    concrete_b: { color: '#ffffff', map: 'pad_b', roughness: 0.92 },
    pad_side: { color: '#6a6a70', roughness: 0.95 },
    steel: { color: '#ffffff', map: 'steel', roughness: 0.5, metalness: 0.65, repeat: [1, 1] },
    tank: { color: '#d7d9dc', roughness: 0.34, metalness: 0.75 },
    facade: { color: '#ffffff', map: 'tower', roughness: 0.75 },
    facade2: { color: '#ffffff', map: 'office', roughness: 0.78 },
    cab_glass: { color: '#1d2e42', roughness: 0.08, metalness: 0.75 },
    white: { color: '#dddddd', roughness: 0.6 },
    wood: { vertexColors: true, roughness: 0.95 },
    leaf: { vertexColors: true, roughness: 0.85, leaf: true },
    rock: { color: '#878278', roughness: 0.96 },
    lamp: { vertexColors: true, roughness: 0.4, emissiveVertex: 1.4 },
    fence: { color: '#7d8087', roughness: 0.5, metalness: 0.7 },
    terrain: { color: '#ffffff', map: 'terrain_color', roughness: 0.96, detail: 'detail', detailRepeat: 150 },
  };
  geos.pad_top = (() => { const g = box(20, 0.55, 20); return g; })();
  const models = {
    pad_a: [['pad_top', 'concrete']], pad_b: [['pad_top', 'concrete_b']],
    hangar: [['hangar', 'steel']], tower: [['tower', 'facade'], ['tower_cab', 'cab_glass'], ['tower_roof', 'white']],
    tank: [['tank', 'tank']], office: [['office_box', 'facade2']], lamp_a: [['lamp_a', 'lamp']], lamp_b: [['lamp_b', 'lamp']],
    pine: [['pine_trunk', 'wood'], ['pine_crown', 'leaf']], broad: [['broad_trunk', 'wood'], ['broad_crown', 'leaf']], rock: [['rock', 'rock']],
  };
  geos.office_box = (() => { const g = box(14, 9, 10); for (let i = 0; i < g.uv.length; i++) g.uv[i] *= 2; return TF2(g, 0, 4.5, 0); })();
  function TF2(g, x, y, z) { const o = new Geo(); o.add(g, TF.move(x, y, z)); return o; }
  geos.pad_top = TF2(geos.pad_top, 0, 0.275, 0);
  // 只有顶面用整张贴图，四周取贴图边缘的灰色
  for (let i = 0; i < geos.pad_top.nor.length; i += 3) { if (geos.pad_top.nor[i + 1] < 0.5) { const k = i / 3 * 2; geos.pad_top.uv[k] = 0.1; geos.pad_top.uv[k + 1] = 0.07; } }
  // 飞行参数
  const bl = (n) => parts.findIndex((p) => p.name === n);
  const flight = {
    hover_collective: 0.5, spool_up: 1.15, spool_down: 1.7, ground_effect: 0.12, rotor_radius: 5.2, skid_height: 1.262,
    drag: 0.0032, cyclic_gain: 13, tip_gain: 11, speed_pitch: 0.09, speed_roll: 0.09, gust: 0.5, torque: 5.2, fin_damp: 1.5, damp: 0.9,
    ground_k: 150, ground_c: 22, skid_friction: 0.75, body_friction: 0.62, contact_share: 3.2, contact_torque: 0.14, safe_speed: 3.6, crash_speed: 6.2, tail_break_speed: 3.5, skid_break_speed: 7.5, fire_speed: 7.0,
    rotor_rate: 42, tail_rate: 180, vibration: 0.008, blades: 4, rotor_pos: [0, 1.72, 0], tail_pos: [-6.75, 0.98, 0.24], tail_radius: 0.88, tail_hub_local: [-6.75, 0.98, 0.24], tail_pivot: [0, 0, 0],
    contacts: [[1.7, -1.31, 1.08, 'skid_r'], [-1.7, -1.31, 1.08, 'skid_r'], [1.7, -1.31, -1.08, 'skid_l'], [-1.7, -1.31, -1.08, 'skid_l'], [2.95, -0.2, 0, 'nose'], [0.2, -0.86, 0, 'body'], [-1.2, -0.7, 0, 'body'], [0.2, 0.1, 0.98, 'body'], [0.2, 0.1, -0.98, 'body'], [0.2, 1.05, 0, 'body'], [-6.9, 0.9, 0, 'tail'], [-5.4, 0.82, 0.95, 'tail'], [-5.4, 0.82, -0.95, 'tail'], [-6.6, 2.1, 0, 'tail']],
    part_index: { root, hub: hubI, blur: blurI, tail_hub: tailHub, tail_blur: tailBlur, stub: stubI },
    blade_outer: bladeOuter, blade_names: bladeNames, tail_part: boomI, tail_group: ['尾梁', '垂尾', '水平安定面', '尾旋翼', '尾桨支座'],
    skid_l_part: bl('左起落架'), skid_r_part: bl('右起落架'), skid_l_name: '左起落架', skid_r_name: '右起落架', chunks: chunkIdx,
    init: { x: PAD_A.x, y: PAD_A.y + 0.4 + 1.258, z: PAD_A.z, yaw: 0.35 },
    pads: [{ name: '1 号停机坪', x: PAD_A.x, y: PAD_A.y + 0.4, z: PAD_A.z }, { name: '2 号停机坪', x: PAD_B.x, y: PAD_B.y + 0.4, z: PAD_B.z }],
    record: null,
  };
  const scene = {
    format: 'nest-scene', version: 1, name: '24 号直升机', duration: 15, fps: 60,
    note: '场景资源是纯数据：几何、材质、贴图、灯光、镜头和飞行记录。材质、部件变换、镜头与时序都可以直接在编辑器里修改，重新打开即按文件内容绘制。',
    environment: {
      time: '傍晚 18:20，薄云', sun: { dir: [0.62, 0.46, 0.34], color: '#ffd9a8', intensity: 3.4 }, hemi: { sky: '#a9c3e6', ground: '#6a6248', intensity: 0.85 },
      sky: { zenith: '#2f62ad', horizon: '#f6d3a8', sunGlow: '#ffc27a', cloud: 0.5 }, fog: { color: '#e3cfb4', density: 0.00021 }, far: 12000,
    },
    cameras: { default: { pos: [PAD_A.x + 16, PAD_A.y + 5, PAD_A.z + 22], target: [PAD_A.x, PAD_A.y + 2, PAD_A.z], fov: 42 }, show: [] },
    flight,
    terrain: { size: TSIZE, n: TN, material: 'terrain', heights },
    grass: [
      { x: PAD_A.x, z: PAD_A.z, r: 62, inner: 12, count: 26000, height: 0.62, seed: 3 },
      { x: PAD_B.x, z: PAD_B.z, r: 48, inner: 12, count: 12000, height: 0.6, seed: 5 },
      { x: -72, z: 100, r: 46, inner: 0, count: 16000, height: 0.66, seed: 7 },
    ],
    materials, models, objects, parts,
    textures, geometries: {},
  };
  ipcRenderer.invoke('log', '编码');
  for (const k of Object.keys(geos)) scene.geometries[k] = geos[k].encode();
  // 写文件：可编辑内容在前，贴图和几何数据在后，每行不太长，编辑器能打开
  const { textures: T, geometries: GG, ...head } = scene;
  const headText = JSON.stringify(head, (k, v) => (k === 'heights' ? `@@H@@` : v), 1).replace('"@@H@@"', JSON.stringify(heights));
  const texLines = Object.entries(T).map(([k, t]) => {
    const parts2 = []; for (let i = 0; i < t.data.length; i += 3000) parts2.push(t.data.slice(i, i + 3000));
    const { data, ...rest } = t;
    void data;
    return ` ${JSON.stringify(k)}: ${JSON.stringify({ ...rest }).slice(0, -1)},"chunks":[\n${parts2.map((p) => JSON.stringify(p)).join(',\n')}\n]}`;
  });
  const geoLines = Object.entries(GG).map(([k, g]) => {
    const fields = Object.entries(g).map(([f, v]) => (Array.isArray(v) ? `${JSON.stringify(f)}:[\n${v.map((p) => JSON.stringify(p)).join(',\n')}\n]` : `${JSON.stringify(f)}:${JSON.stringify(v)}`));
    return ` ${JSON.stringify(k)}: {${fields.join(',')}}`;
  });
  const text = headText.replace(/\}\s*$/, '') + `,\n"textures": {\n${texLines.join(',\n')}\n},\n"geometries": {\n${geoLines.join(',\n')}\n}\n}\n`;
  JSON.parse(text);
  await ipcRenderer.invoke('write', 'fixtures/base-scene.json', text);
  await ipcRenderer.invoke('done');
}
main().catch((e) => { console.error(e.stack || e); ipcRenderer.invoke('log', 'ERR ' + (e.stack || e)); ipcRenderer.invoke('done'); });
