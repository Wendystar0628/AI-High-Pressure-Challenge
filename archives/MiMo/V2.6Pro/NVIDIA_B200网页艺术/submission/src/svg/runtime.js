// ============================================================
// SVG 运行时：元素构造 / 路径脉冲 / 引线 / 数字滚动 / 形变
// ============================================================

export const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, parent = null) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) {
    if (k === 'text') n.textContent = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  if (parent) parent.appendChild(n);
  return n;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function group(parent, id, attrs = {}) {
  return el('g', { id, ...attrs }, parent);
}

// ---------- 数值格式化 ----------
export function fmtNum(x, digits = 1) {
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) >= 1e12) return (x / 1e12).toFixed(digits) + ' T';
  if (Math.abs(x) >= 1e9) return (x / 1e9).toFixed(digits) + ' G';
  if (Math.abs(x) >= 1e6) return (x / 1e6).toFixed(digits) + ' M';
  if (Math.abs(x) >= 1e3) return (x / 1e3).toFixed(digits) + ' K';
  if (Math.abs(x) >= 100) return x.toFixed(0);
  if (Math.abs(x) >= 10) return x.toFixed(1);
  return x.toFixed(2);
}

export function fmtBytes(b) {
  if (b >= 1e12) return (b / 1e12).toFixed(2) + ' TB';
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  return fmtNum(b) + ' B';
}

// ---------- 沿路径运动的脉冲点 ----------
export class PathPulses {
  constructor(parent, pathAttrs, count = 6, opts = {}) {
    this.path = el('path', { ...pathAttrs, fill: 'none', class: 'flow' }, parent);
    this.dots = [];
    this.count = count;
    this.color = opts.color || '#46d8ff';
    this.size = opts.size || 3.2;
    this.speed = opts.speed || 0.12;
    for (let i = 0; i < count; i++) {
      const d = el('circle', { r: this.size, fill: this.color, opacity: 0.95 }, parent);
      this.dots.push(d);
    }
    this.len = 0;
  }
  update(time, visibility = 1) {
    try {
      this.len = this.path.getTotalLength();
    } catch (e) { return; }
    for (let i = 0; i < this.dots.length; i++) {
      const t = ((i / this.dots.length) + time * this.speed) % 1;
      const pt = this.path.getPointAtLength(t * this.len);
      this.dots[i].setAttribute('cx', pt.x);
      this.dots[i].setAttribute('cy', pt.y);
      const edge = Math.sin(t * Math.PI);
      this.dots[i].setAttribute('opacity', (0.25 + 0.75 * edge) * visibility);
    }
    this.path.setAttribute('opacity', visibility * 0.55);
  }
  setVisible(v) {
    const o = v ? 1 : 0;
    this.path.setAttribute('opacity', o * 0.55);
    for (const d of this.dots) d.setAttribute('opacity', o);
  }
}

// ---------- 引线（三维锚点 → 标注框）----------
// anchor: {x,y} 屏幕坐标；label 侧文字
export class Leader {
  constructor(parent, opts = {}) {
    this.g = group(parent, null);
    this.line = el('polyline', { class: 'leader', points: '' }, this.g);
    this.dot = el('circle', { r: 3, fill: opts.color || '#46d8ff' }, this.g);
    this.text = el('text', { class: 't-label', x: 0, y: 0 }, this.g);
    this.text.textContent = opts.label || '';
    this.sub = el('text', { class: 't-dim', x: 0, y: 0 }, this.g);
    this.sub.textContent = opts.sub || '';
    this.side = opts.side || 1; // 1 右 -1 左
    this.g.setAttribute('opacity', 0);
    this._op = 0;
  }
  update(ax, ay, bx, by, targetOpacity = 1) {
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(targetOpacity)) {
      if (!window.__nanLogged) {
        window.__nanLogged = true;
        const bad = [!Number.isFinite(ax) && 'ax', !Number.isFinite(ay) && 'ay', !Number.isFinite(bx) && 'bx', !Number.isFinite(by) && 'by', !Number.isFinite(targetOpacity) && 'op'].filter(Boolean).join('+');
        console.error('[B200 NaN leader]', bad, String(targetOpacity));
      }
      ax = Number.isFinite(ax) ? ax : 0;
      ay = Number.isFinite(ay) ? ay : 0;
      bx = Number.isFinite(bx) ? bx : ax + 100;
      by = Number.isFinite(by) ? by : ay;
      targetOpacity = 0;
    }
    // 生长完全由 targetOpacity（progress 函数）决定 —— 保证导出逐帧确定
    this._op = targetOpacity;
    const t = this._op;
    const mx = ax + (bx - ax) * Math.min(1, t * 1.4);
    const my = ay + (by - ay) * Math.min(1, t * 1.4);
    this.line.setAttribute('points', `${ax},${ay} ${mx},${my} ${bx},${my}`);
    this.dot.setAttribute('cx', ax);
    this.dot.setAttribute('cy', ay);
    // 文字放在折线终点外侧：引线自左来 → 文字在右；自右来 → 文字在左
    const right = bx >= ax;
    const tx = right ? bx + 9 : bx - 9;
    this.text.setAttribute('text-anchor', right ? 'start' : 'end');
    this.sub.setAttribute('text-anchor', right ? 'start' : 'end');
    this.text.setAttribute('x', tx);
    this.text.setAttribute('y', my - 4);
    this.sub.setAttribute('x', tx);
    this.sub.setAttribute('y', my + 11);
    this.g.setAttribute('opacity', Math.min(1, t * 1.25));
  }
  setLabel(label, sub) {
    this.text.textContent = label;
    if (sub != null) this.sub.textContent = sub;
  }
}

// ---------- 数字滚动（导出确定性：直接给 time 即可）----------
export function rollNumber(node, from, to, t, fmt = (v) => v.toFixed(0)) {
  const v = from + (to - from) * t;
  node.textContent = fmt(v);
}

// ---------- 位格（bit cell）----------
export function bitCells(parent, x, y, bits, opts = {}) {
  const w = opts.w || 13, h = opts.h || 20, gap = opts.gap || 2;
  const cells = [];
  for (let i = 0; i < bits.length; i++) {
    const bx = x + i * (w + gap);
    const rect = el('rect', {
      x: bx, y, width: w, height: h, rx: 2.5,
      fill: bits[i] === '1' ? (opts.onColor || '#46d8ff') : 'rgba(120,160,210,0.14)',
      stroke: 'rgba(130,175,230,0.35)', 'stroke-width': 1,
    }, parent);
    const tx = el('text', {
      x: bx + w / 2, y: y + h * 0.68,
      'text-anchor': 'middle', 'font-size': 11,
      fill: bits[i] === '1' ? '#06121c' : '#8aa0bd',
    }, parent);
    tx.textContent = bits[i];
    cells.push({ rect, tx, x: bx });
  }
  return cells;
}

// ---------- 简单 path 生成 ----------
export function linePath(x1, y1, x2, y2, curve = 0) {
  if (!curve) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - curve;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

export function rectPath(x, y, w, h, r = 0) {
  if (!r) return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
  return `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(w - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r} v ${-(h - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} Z`;
}

// ---------- 装饰：刻度尺 ----------
export function tickScale(parent, x1, x2, y, count = 11, labelFn = null) {
  el('line', { x1, y1: y, x2, y2: y, stroke: 'rgba(130,175,230,0.4)', 'stroke-width': 1 }, parent);
  for (let i = 0; i < count; i++) {
    const x = x1 + (x2 - x1) * (i / (count - 1));
    const h = i % 5 === 0 ? 9 : 5;
    el('line', { x1: x, y1: y, x2: x, y2: y - h, stroke: 'rgba(130,175,230,0.45)', 'stroke-width': 1 }, parent);
    if (labelFn && i % 5 === 0) {
      const t = el('text', { x, y: y + 16, 'text-anchor': 'middle', class: 't-dim' }, parent);
      t.textContent = labelFn(i / (count - 1));
    }
  }
}

// ---------- 平滑折线（样条近似）----------
export function smoothPath(pts, close = false) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` Q ${x0} ${y0} ${cx} ${(y0 + y1) / 2} Q ${x1} ${y1} ${x1} ${y1}`;
  }
  if (close) d += ' Z';
  return d;
}
