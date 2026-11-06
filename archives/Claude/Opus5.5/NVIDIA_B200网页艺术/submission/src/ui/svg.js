// SVG 小工具与“走线字形”：把数字和字母画成 45° 倒角的走线，字形本身是可变形的路径。
export const NS = 'http://www.w3.org/2000/svg';
export function S(tag, attrs = {}, parent = null, text = null) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
  if (text !== null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
export function A(e, attrs) {
  for (const k in attrs) {
    const v = attrs[k];
    e.setAttribute(k, typeof v === 'number' ? (Math.round(v * 100) / 100) : v);
  }
  return e;
}
export function H(tag, cls = '', parent = null, html = null, attrs = null) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== null) e.innerHTML = html;
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
export const setText = (e, t) => { if (e.textContent !== t) e.textContent = t; };
export const setHTML = (e, t) => { if (e._html !== t) { e.innerHTML = t; e._html = t; } };
export const vis = (e, on) => { const d = on ? '' : 'none'; if (e.style.display !== d) e.style.display = d; };

// ---------- 走线字形 ----------
const G = {
  '0': [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  '1': [[[.8, 1.4], [2.2, 0], [2.2, 6]], [[.8, 6], [3.6, 6]]],
  '2': [[[0, 1.2], [1.2, 0], [2.8, 0], [4, 1.2], [4, 2.2], [0, 6], [4, 6]]],
  '3': [[[0, .8], [.8, 0], [3.2, 0], [4, .8], [4, 2.2], [3.2, 3], [1.6, 3]], [[3.2, 3], [4, 3.8], [4, 5.2], [3.2, 6], [.8, 6], [0, 5.2]]],
  '4': [[[3, 6], [3, 0], [0, 3.8], [0, 4.4], [4, 4.4]]],
  '5': [[[3.8, 0], [.4, 0], [.2, 2.6], [3, 2.6], [4, 3.6], [4, 5], [3, 6], [1, 6], [0, 5.2]]],
  '6': [[[3.4, 0], [1.6, 0], [0, 1.6], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.6], [3, 2.6], [1, 2.6], [0, 3.6]]],
  '7': [[[0, 0], [4, 0], [4, 1], [1.4, 6]]],
  '8': [[[1, 3], [0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3]]],
  '9': [[[.6, 6], [2.4, 6], [4, 4.4], [4, 1], [3, 0], [1, 0], [0, 1], [0, 2.4], [1, 3.4], [3, 3.4], [4, 2.4]]],
  A: [[[0, 6], [0, 1.5], [1.5, 0], [2.5, 0], [4, 1.5], [4, 6]], [[0, 3.8], [4, 3.8]]],
  B: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]], [[0, 0], [3, 0], [4, 1], [4, 2], [3, 3]]],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]],
  D: [[[0, 0], [0, 6], [2.6, 6], [4, 4.6], [4, 1.4], [2.6, 0], [0, 0]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.2], [2.4, 3.2]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[1, 0], [3, 0]], [[2, 0], [2, 6]], [[1, 6], [3, 6]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [1.4, 3], [0, 3]], [[1.4, 3], [4, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 2.6], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  P: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2.4], [3, 3.4], [0, 3.4]]],
  R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2.4], [3, 3.4], [0, 3.4]], [[2, 3.4], [4, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [0, 2.6], [2, 6], [4, 2.6], [4, 0]]],
  W: [[[0, 0], [0, 6], [2, 3.4], [4, 6], [4, 0]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 2.8], [4, 0]], [[2, 2.8], [2, 6]]],
  Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  '/': [[[3.4, 0], [.6, 6]]],
  '.': [[[1.6, 5.8], [1.7, 5.8]]],
  ',': [[[1.7, 5.4], [1.1, 6.8]]],
  '×': [[[.8, 1.6], [3.2, 4.6]], [[3.2, 1.6], [.8, 4.6]]],
  '+': [[[2, 1.4], [2, 4.6]], [[.6, 3], [3.4, 3]]],
  '-': [[[.8, 3], [3.2, 3]]],
  '−': [[[.8, 3], [3.2, 3]]],
  '=': [[[.6, 2.2], [3.4, 2.2]], [[.6, 3.8], [3.4, 3.8]]],
  ':': [[[2, 1.6], [2.05, 1.6]], [[2, 4.6], [2.05, 4.6]]],
  ' ': [],
};
const ADV = { '.': 3.2, ',': 3.2, ':': 3.4, ' ': 3, '1': 5.1, 'I': 5.1 };
const K = 22; // 每笔重采样点数
const STROKES = 3;

function resample(poly, n) {
  const L = [0];
  for (let i = 1; i < poly.length; i++) L[i] = L[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
  const T = L[L.length - 1] || 1e-6;
  const out = [];
  let j = 1;
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1) * T;
    while (j < poly.length - 1 && L[j] < s) j++;
    const a = poly[j - 1], b = poly[j];
    const t = (s - L[j - 1]) / ((L[j] - L[j - 1]) || 1e-6);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}
const cache = {};
function glyph(ch) {
  if (cache[ch]) return cache[ch];
  const src = G[ch] || G[ch.toUpperCase()] || [];
  const strokes = [];
  for (let i = 0; i < STROKES; i++) {
    const s = src[i];
    if (s) strokes.push(resample(s, K));
    else {
      const last = src.length ? src[src.length - 1][src[src.length - 1].length - 1] : [2, 3];
      strokes.push(new Array(K).fill(last));
    }
  }
  cache[ch] = { strokes, src, adv: ADV[ch] ?? 5.4 };
  return cache[ch];
}

// 单字的路径。a → b 变形，deform(x, y) 可做数据驱动的局部变形；draw 控制生长比例
export function glyphD(a, b, t, ox, oy, sc, deform, draw = 1) {
  const A = glyph(a), B = glyph(b);
  let d = '';
  const n = Math.max(2, Math.ceil(K * Math.min(1, Math.max(0, draw))));
  for (let s = 0; s < STROKES; s++) {
    if (t <= 0 && !A.src[s]) continue;
    if (t >= 1 && !B.src[s]) continue;
    if (!A.src[s] && !B.src[s]) continue;
    const pa = A.strokes[s], pb = B.strokes[s];
    for (let i = 0; i < n; i++) {
      let x = pa[i][0] + (pb[i][0] - pa[i][0]) * t, y = pa[i][1] + (pb[i][1] - pa[i][1]) * t;
      if (deform) { const q = deform(x, y); x = q[0]; y = q[1]; }
      const X = ox + x * sc, Y = oy + y * sc;
      d += (i === 0 ? 'M' : 'L') + X.toFixed(1) + ' ' + Y.toFixed(1);
    }
  }
  return d;
}

export function textWidth(str, size) {
  const sc = size / 6;
  let w = 0;
  for (let i = 0; i < str.length; i++) w += glyph(str[i]).adv;
  return (w - 1.4) * sc;
}

// 一行走线字：可变形数字
export class Trace {
  constructor(parent, opts = {}) {
    this.size = opts.size || 60;
    this.g = S('g', { class: 'trace ' + (opts.cls || '') }, parent);
    this.under = opts.under ? S('path', { class: 'trace-u', fill: 'none' }, this.g) : null;
    this.p = S('path', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.g);
    this.color = opts.color;
    if (opts.color) this.p.setAttribute('stroke', opts.color);
    this.weight = opts.weight || (this.size / 8.6);
    this.p.setAttribute('stroke-width', this.weight);
    if (this.under) { this.under.setAttribute('stroke-linecap', 'round'); this.under.setAttribute('stroke-linejoin', 'round'); this.under.setAttribute('stroke-width', this.weight * 2.2); }
  }
  // str：目标字串；from：变形来源（同长度）；t：变形比例；draw：生长比例；stagger：逐字生长
  draw(x, y, str, { from = null, t = 1, draw = 1, stagger = 0, deform = null, anchor = 'start', size = this.size, weight = null } = {}) {
    const sc = size / 6;
    let cx = x;
    const W = textWidth(str, size);
    if (anchor === 'middle') cx -= W / 2; else if (anchor === 'end') cx -= W;
    let d = '';
    for (let i = 0; i < str.length; i++) {
      const b = str[i], a = from ? (from[i] ?? ' ') : b;
      const gb = glyph(b);
      const di = stagger ? Math.max(0, Math.min(1, draw * (1 + stagger * str.length) - i * stagger)) : draw;
      if (di > 0) d += glyphD(a, b, t, cx, y, sc, deform ? (u, v) => deform(u, v, i, cx) : null, di);
      cx += gb.adv * sc;
    }
    this.p.setAttribute('d', d);
    if (this.under) this.under.setAttribute('d', d);
    if (weight !== null) this.p.setAttribute('stroke-width', weight);
    return W;
  }
  stroke(c) { if (c !== this._c) { this._c = c; this.p.setAttribute('stroke', c); } }
  opacity(o) { this.g.setAttribute('opacity', o.toFixed(3)); }
}

// 让路径按比例生长
export function growPath(el, t) {
  if (!el._len) { el._len = el.getTotalLength() || 1; el.setAttribute('stroke-dasharray', el._len); }
  el.setAttribute('stroke-dashoffset', el._len * (1 - t));
}

// 把文本块沿滚动方向移动：进入、停留、离开。axis='y' 纵向，'x' 横向（第四章）
export function beat(el, t, a, b, c, d, opts = {}) {
  const dist = opts.dist ?? 5.5;
  const axis = opts.axis || 'y';
  let off = 0, op = 1;
  if (t < a || t > d) { vis(el, false); el._on = false; return false; }
  if (t < b) { const k = (t - a) / (b - a); const e = 1 - (1 - k) * (1 - k); off = (1 - e) * dist; op = k * k * (3 - 2 * k); }
  else if (t > c) { const k = (t - c) / (d - c); const e = k * k; off = -e * dist; op = 1 - k * k * (3 - 2 * k); }
  vis(el, true);
  el._on = true;
  el.style.transform = axis === 'y' ? `translate3d(0,${off.toFixed(3)}rem,0)` : `translate3d(${off.toFixed(3)}rem,0,0)`;
  el.style.opacity = op.toFixed(3);
  el.style.pointerEvents = op > .6 ? '' : 'none';
  return true;
}
