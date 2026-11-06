// 通用数学与缓动工具：全部是纯函数，保证同一进度、同一时刻得到同一画面。
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const iv = (a, b, x) => clamp((x - a) / (b - a));
export const sstep = (a, b, x) => { const t = iv(a, b, x); return t * t * (3 - 2 * t); };
export const smoother = (a, b, x) => { const t = iv(a, b, x); return t * t * t * (t * (6 * t - 15) + 10); };
export const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = t => Math.pow(clamp(t), 3);
export const easeIO = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const pulse = (a, b, c, d, x) => sstep(a, b, x) * (1 - sstep(c, d, x));
export const fract = x => x - Math.floor(x);
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 确定性噪声：相同输入永远返回相同值
export const hash1 = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// 临界阻尼弹簧：新目标可随时打断，并从当前值与速度继续
export class Spring {
  constructor(v = 0, omega = 9) { this.v = v; this.t = v; this.vel = 0; this.w = omega; }
  to(t) { this.t = t; return this; }
  snap(v = this.t) { this.v = v; this.t = v; this.vel = 0; return this; }
  step(dt) {
    const w = this.w, x = this.v - this.t;
    const e = Math.exp(-w * dt);
    const c = this.vel + w * x;
    this.v = this.t + (x + c * dt) * e;
    this.vel = (c - w * (x + c * dt)) * e;
    if (Math.abs(this.v - this.t) < 1e-5 && Math.abs(this.vel) < 1e-5) { this.v = this.t; this.vel = 0; }
    return this.v;
  }
  get moving() { return this.v !== this.t || this.vel !== 0; }
}

// 单调三次插值的 Catmull-Rom（非均匀关键帧）
export function hermite(keys, x, ch) {
  const n = keys.length;
  if (x <= keys[0].p) return keys[0][ch];
  if (x >= keys[n - 1].p) return keys[n - 1][ch];
  let i = 0;
  // 二分查找
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (keys[m].p <= x) lo = m; else hi = m; }
  i = lo;
  const k0 = keys[Math.max(i - 1, 0)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(i + 2, n - 1)];
  const dx = k2.p - k1.p;
  const t = (x - k1.p) / dx;
  const d1 = (k2[ch] - k1[ch]) / dx;
  const m0 = k1 === k0 ? d1 : mono(d1, (k1[ch] - k0[ch]) / (k1.p - k0.p));
  const m1 = k3 === k2 ? d1 : mono(d1, (k3[ch] - k2[ch]) / (k3.p - k2.p));
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * k1[ch] + (t3 - 2 * t2 + t) * dx * m0 + (-2 * t3 + 3 * t2) * k2[ch] + (t3 - t2) * dx * m1;
}
function mono(a, b) { if (a * b <= 0) return 0; return 2 * a * b / (a + b); }

// 颜色工具
export function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mixHex(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  const c = i => Math.round(lerp(A[i], B[i], t));
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}
export const fmtInt = n => Math.round(n).toLocaleString('en-US');
export function fmtNum(x, d = 3) {
  if (!isFinite(x)) return x > 0 ? '+∞' : x < 0 ? '−∞' : 'NaN';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e5 || a < 1e-3) return x.toExponential(2).replace('-', '−');
  return x.toFixed(d).replace(/\.?0+$/, '').replace('-', '−');
}
export function fmtBytes(gb) {
  if (gb >= 1000) return (gb / 1000).toFixed(gb >= 10000 ? 1 : 2) + ' TB';
  return (gb >= 100 ? gb.toFixed(0) : gb.toFixed(1)) + ' GB';
}
