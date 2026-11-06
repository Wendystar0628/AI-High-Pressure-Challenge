// FIG 数学推理：两种判法 / 算法竞赛：计分曲线 / 空间推理：先拆开再比步数.
// Standard tasks are lime with an ink edge; "passed / scored" is solid ink,
// "0" an empty box, "forbidden" hatch; references (baseline, B, reference
// value) are cyan.
import { t } from '../../core/index.js';
import { createFigure, d3, W, text, line, rect, path, star, eyebrow, wrap, lines, wrapText, measure, bracket, ebW } from './common.js';

/** A small tag: solid ink square = may, hatch = may not. */
function toolTag(fig, g, x, y, yes, label) {
  if (yes) rect(g, x, y - 10, 22, 11, 'f-ink');
  else rect(g, x, y - 10, 22, 11, 'f-ban').attr('fill', fig.hatch);
  text(g, x + 30, y, label, 't2');
}

/** Tools block: [{ yes: [...], no: [...] }, …] in columns. Returns the height used. */
function toolsBlock(fig, g, y, tc, cols) {
  line(g, 0, y, W, y, 'l-ink');
  y += 30;
  eyebrow(g, 0, y, tc.eyebrow);
  text(g, ebW(tc.eyebrow) + 12, y, tc.title, 'tx tl');
  y += 16;
  let maxY = y;
  cols.forEach(({ x, w, spec }) => {
    let yy = y;
    for (const [yes, list] of [
      [true, spec.yes],
      [false, spec.no],
    ]) {
      if (!list?.length) continue;
      line(g, x, yy, x + w, yy, 'l-rule', false);
      yy += 24;
      toolTag(fig, g, x, yy, yes, yes ? tc.yes : tc.no);
      let ly = yy;
      for (const s of list) {
        const ls = wrap(s, w - 110, 13);
        lines(g, x + 104, ly, ls, 19, '');
        ly += ls.length * 19 + 4;
      }
      yy = ly + 6;
    }
    maxY = Math.max(maxY, yy);
  });
  return maxY;
}

/** Numbered conditions with a pass box and a zero box (formal proof, Luban lock). */
function stepsBlock(fig, g, x, y, w, spec) {
  for (const [i, [title, desc]] of spec.steps.entries()) {
    line(g, x, y, x + w, y, 'l-rule', false);
    text(g, x, y + 26, String(i + 1).padStart(2, '0'), 't2 tn');
    text(g, x + 34, y + 26, title, 'tb');
    const n = wrapText(g, x + 34, y + 47, desc, w - 34, { cls: 't2' });
    y += 36 + n * 19 + 6;
  }
  line(g, x, y, x + w, y, 'l-rule', false);
  y += 34;
  // pass -> solid ink box; fail -> empty box
  const boxW = spec.passBoxW ?? 76;
  const rows = [
    [spec.pass, spec.passBox, true],
    [spec.fail, '0', false],
  ];
  for (const [label, val, ok] of rows) {
    const lw = Math.min(w - boxW - 52, measure(label, 13) + 8);
    text(g, x, y + 5, label, 't2');
    line(g, x + lw + 6, y, x + w - boxW - 14, y, 'l-ink');
    star(g, x + w - boxW - 12, y, 4.5, 'f-ink');
    rect(g, x + w - boxW, y - 17, boxW, 34, ok ? 'f-ink' : 'f-zero', true);
    text(g, x + w - boxW / 2, y + 6, val, ok ? 'tmid ton' : 'tmid t2', 'middle');
    y += 48;
  }
  return y;
}

/** Column head: eyebrow, name, big figure on the right, a note. */
function colHead(g, x, y, w, spec) {
  eyebrow(g, x, y, spec.eyebrow);
  text(g, x, y + 30, spec.name, 'tx tl');
  if (spec.big) {
    const bw = measure(spec.unit ?? '', 13) + 6;
    text(g, x + w, y + 30, spec.unit ?? '', 't2', 'end');
    text(g, x + w - bw, y + 32, spec.big, 'tbig tn', 'end');
  }
  const n = wrapText(g, x, y + 58, spec.note, w, { cls: 't2' });
  return y + 58 + n * 19;
}

// ---------------------------------------------------------------------------
export function reasonFigure({ c }) {
  const fc = c.fig.reason;
  const fig = createFigure({ key: 'reason', title: fc.title, readout: [fc.readout] });
  const g = fig.g;
  const LW = 330;
  const RX = 380;
  const RW = W - RX;
  // left: formal proof
  let ly = colHead(g, 0, 14, LW, fc.formal);
  ly = stepsBlock(fig, g, 0, ly + 4, LW, { ...fc.formal, passBox: '12.5' });
  // right: olympiad, the 0–7 ladder
  let ry = colHead(g, RX, 14, RW, fc.olympiad);
  ry += 8;
  const cw = 40;
  const ch = 24;
  const top = ry;
  for (let v = 7; v >= 0; v--) {
    const yy = top + (7 - v) * (ch + 5);
    rect(g, RX, yy, cw, ch, v === 7 ? 'f-ink' : v === 0 ? 'f-zero' : 'f-std-soft', true);
    text(g, RX + cw / 2, yy + 16.5, String(v), v === 7 ? 'tb tn ton' : v === 0 ? 'tb tn' : 'tb tn tof', 'middle');
  }
  const bx = RX + cw + 16;
  // [ 7: full marks
  path(g, `M${bx + 6} ${top}H${bx}V${top + ch}H${bx + 6}`, 'l-ink');
  const nFull = wrapText(g, bx + 16, top + 16, fc.olympiad.full, RW - cw - 36, { cls: 'tb' });
  // [ 1–6: partial
  const p0 = top + (ch + 5);
  const p1 = top + 6 * (ch + 5) + ch;
  path(g, `M${bx + 6} ${p0}H${bx}V${p1}H${bx + 6}`, 'l-ink');
  let py = Math.max(p0 + 16, top + 16 + nFull * 19 + 6);
  const n1 = wrapText(g, bx + 16, py, fc.olympiad.part, RW - cw - 36, { cls: 'tb' });
  py += n1 * 19 + 2;
  const n2 = wrapText(g, bx + 16, py, fc.olympiad.partSub, RW - cw - 36, { cls: 't2' });
  py += n2 * 19 + 14;
  wrapText(g, bx + 16, py, fc.olympiad.deduct, RW - cw - 36, { cls: '' });
  ry = top + 8 * (ch + 5) + 10;
  // tools
  const y = Math.max(ly, ry) + 10;
  const end = toolsBlock(fig, g, y, fc.tools, [
    { x: 0, w: LW, spec: fc.tools.formal },
    { x: RX, w: RW, spec: fc.tools.olympiad },
  ]);
  fig.size(end + 4);
  return fig;
}

// ---------------------------------------------------------------------------
// anchor curves
const lerp = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * (x - pts[i - 1][0])) / (pts[i][0] - pts[i - 1][0]);
  return pts[pts.length - 1][1];
};
export const logLerp = (pts, s) => {
  if (s <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++)
    if (s <= pts[i][0]) return pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * Math.log(s / pts[i - 1][0])) / Math.log(pts[i][0] / pts[i - 1][0]);
  return pts[pts.length - 1][1];
};
const fmtS = (s) => `${+s.toFixed(2)}×`;

/** Score axis on the left and a frame. */
function scoreAxis(g, x0, x1, y, label) {
  for (const v of [0, 50, 100]) {
    line(g, x0, y(v), x1, y(v), v ? 'l-rule' : 'l-ink', false);
    text(g, x0 - 8, y(v) + 4.5, String(v), 't2 tn', 'end');
  }
  if (label) text(g, x0 - 8, y(100) - 14, label, 't2', 'end');
  line(g, x0, y(0), x0, y(100) - 4, 'l-ink', false);
}

/** A log-scale speedup chart: anchors, baseline, full mark. */
export function perfChart(fig, g, { x0, x1, y0, y1, anchors, labels, dashed = false, ticks = [0.1, 0.2, 0.5, 1, 2, 4, 8, 16], axisLabel, showBase = true, scoreLabel }) {
  const x = d3.scaleLog().domain([0.1, 20]).range([x0, x1]);
  const y = d3.scaleLinear().domain([0, 100]).range([y1, y0]);
  scoreAxis(g, x0, x1, y, scoreLabel);
  for (const s of ticks) {
    line(g, x(s), y1, x(s), y1 + 5, 'l-ink2', false);
    text(g, x(s), y1 + 19, `${s}×`, 't2 tn', 'middle');
  }
  if (axisLabel) text(g, x1, y1 + 38, axisLabel, 't2', 'end');
  const full = anchors[anchors.length - 1][0];
  const pts = [[0.1, 0], ...anchors.filter((p) => p[0] > 0.1), [20, 100]];
  const area = `M${x(0.1)} ${y(0)}` + pts.map((p) => `L${x(p[0])} ${y(p[1])}`).join('') + `L${x(20)} ${y(0)}Z`;
  if (!dashed) g.append('path').attr('d', area).attr('class', 'f-std-band');
  path(g, pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0])} ${y(p[1])}`).join(''), dashed ? 'l-ink l-dash' : 'l-ink l-thick', !dashed);
  // baseline: s = 1
  if (showBase) {
    const b = logLerp(anchors, 1);
    line(g, x0, y(b), x(1), y(b), 'l-ref', false);
    line(g, x(1), y(b), x(1), y1, 'l-ref', false);
    rect(g, x(1) - 5, y(b) - 5, 10, 10, 'f-ref');
    if (labels?.flat) text(g, x(1) - 8, y(b) - 12, labels.flat.replace('{v}', +b.toFixed(1)), 'tcy tb', 'end');
  }
  if (labels?.full) text(g, x(full) - 10, y(100) - 9, labels.full, 'tb', 'end');
  const pg = g.append('g');
  const marks = pg
    .selectAll('rect')
    .data(anchors)
    .join('rect')
    .attr('x', (d) => x(d[0]) - 4.5)
    .attr('y', (d) => y(d[1]) - 4.5)
    .attr('width', 9)
    .attr('height', 9)
    .attr('class', dashed ? 'f-zero f-pt' : 'f-std f-pt')
    .attr('data-fx', 'cell');
  return { x, y, marks };
}

export function algoFigure({ c }) {
  const fc = c.fig.algo;
  const fig = createFigure({ key: 'algo', title: fc.title, readout: [fc.readout] });
  const g = fig.g;
  // extremal construction
  eyebrow(g, 0, 14, fc.ext.eyebrow);
  text(g, 0, 42, fc.ext.name, 'tx tl');
  wrapText(g, 0, 64, fc.ext.sub, W, { cls: 't2' });
  const ex0 = 40;
  const ex1 = W - 14;
  const ey0 = 110;
  const ey1 = 250;
  const x = d3.scaleLinear().domain([0, 1]).range([ex0, ex1]);
  const y = d3.scaleLinear().domain([0, 100]).range([ey1, ey0]);
  scoreAxis(g, ex0, ex1, y, fc.score);
  const A = fc.anchors.ext;
  const pts = [[0, 0], ...A];
  g.append('path')
    .attr('d', `M${x(0)} ${y(0)}` + pts.map((p) => `L${x(p[0])} ${y(p[1])}`).join('') + `L${x(1)} ${y(0)}Z`)
    .attr('class', 'f-std-band');
  // steepest stretch 0.8–0.9
  g.append('path')
    .attr('d', `M${x(0.8)} ${y(0)}L${x(0.8)} ${y(lerp(A, 0.8))}L${x(0.9)} ${y(lerp(A, 0.9))}L${x(0.9)} ${y(0)}Z`)
    .attr('class', 'f-std-soft2');
  text(g, x(0.85), y(0) - 10, fc.ext.steep, 'tb', 'middle');
  path(g, pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0])} ${y(p[1])}`).join(''), 'l-ink');
  path(g, `M${x(0.8)} ${y(lerp(A, 0.8))}L${x(0.9)} ${y(lerp(A, 0.9))}`, 'l-ink l-thick3');
  for (let r = 0; r <= 1.001; r += 0.2) {
    line(g, x(r), ey1, x(r), ey1 + 5, 'l-ink2', false);
    text(g, x(r), ey1 + 19, String(+r.toFixed(1)), 't2 tn', 'middle');
  }
  text(g, ex1, ey1 + 38, fc.ext.axis, 't2', 'end');
  // reference value
  line(g, x(1), ey0 - 18, x(1), ey1, 'l-ref', false);
  text(g, x(1) - 6, ey0 - 22, fc.ext.ref, 'tcy tb', 'end');
  for (const p of A) if ([20, 36, 60, 81].includes(p[1])) text(g, x(p[0]) - 6, y(p[1]) - 9, String(p[1]), 't2 tn', 'end');
  const em = g
    .append('g')
    .selectAll('rect')
    .data(A)
    .join('rect')
    .attr('x', (d) => x(d[0]) - 4.5)
    .attr('y', (d) => y(d[1]) - 4.5)
    .attr('width', 9)
    .attr('height', 9)
    .attr('class', (d) => (d[0] === 1 ? 'f-ref f-pt' : 'f-std f-pt'))
    .attr('data-fx', 'cell');
  fig.mark(em, (d) => [fc.ext.name, `r = ${d[0].toFixed(2)}`, t('about.fig.points', { v: d[1] })]);

  // performance engineering: two log charts
  let yy = ey1 + 62;
  line(g, 0, yy, W, yy, 'l-ink');
  yy += 30;
  eyebrow(g, 0, yy, fc.perf.eyebrow);
  yy += 24;
  const n = wrapText(g, 0, yy, fc.perf.sub, W, { cls: 't2' });
  yy += n * 19 + 14;
  const half = (W - 40) / 2;
  const charts = [
    [0, fc.tr, fc.anchors.tr, [0.1, 0.2, 0.5, 1, 2, 4, 8, 16]],
    [half + 40, fc.ci, fc.anchors.ci, [0.1, 0.2, 0.5, 1, 2, 4, 8, 16]],
  ];
  let bottom = yy;
  for (const [cx, spec, anchors, ticks] of charts) {
    text(g, cx, yy, spec.name, 'tx');
    const m = wrapText(g, cx, yy + 22, spec.sub, half, { cls: 't2' });
    const top = yy + 22 + m * 19 + 22;
    const { marks } = perfChart(fig, g, { x0: cx + 34, x1: cx + half, y0: top, y1: top + 150, anchors, labels: spec, ticks, axisLabel: fc.axisS });
    fig.mark(marks, (d) => [spec.name, `s = ${fmtS(d[0])}`, t('about.fig.points', { v: d[1] })]);
    bottom = Math.max(bottom, top + 150 + 44);
  }
  // circuit score: 24 cells × 7 cells = this task's score
  yy = bottom + 16;
  line(g, 0, yy, W, yy, 'l-ink');
  yy += 30;
  eyebrow(g, 0, yy, fc.circuit.eyebrow);
  text(g, ebW(fc.circuit.eyebrow) + 12, yy, fc.circuit.title, 'tx tl');
  yy += 22;
  const cy = yy;
  for (let i = 0; i < 24; i++) rect(g, i * 11.5, cy, 8.5, 26, 'f-std', true);
  text(g, 24 * 11.5 + 16, cy + 19, '×', 'tmid t2', 'middle');
  const kx = 24 * 11.5 + 34;
  for (let i = 0; i < 7; i++) {
    if (i < 6) rect(g, kx + i * 19, cy, 15, 26, 'f-ink', true);
    else rect(g, kx + i * 19, cy, 15, 26, 'f-zero', true);
  }
  const ex = kx + 7 * 19 + 10;
  text(g, ex + 8, cy + 19, '=', 'tmid t2', 'middle');
  const bw = W - ex - 24;
  rect(g, ex + 24, cy, bw, 26, 'f-ink', true);
  text(g, ex + 24 + bw / 2, cy + 18, fc.circuit.result, 'tb ton', 'middle');
  const ly = cy + 50;
  const a = wrap(fc.circuit.inputs, 24 * 11.5, 13);
  lines(g, 0, ly, a, 19, 't2');
  const b = wrap(fc.circuit.checks, 7 * 19 + 30, 13);
  lines(g, kx, ly, b, 19, 't2');
  const cc = wrap(fc.circuit.fail, bw, 13);
  lines(g, ex + 24, ly, cc, 19, 't2');
  fig.size(ly + Math.max(a.length, b.length, cc.length) * 19 + 4);
  return fig;
}

// ---------------------------------------------------------------------------
export function spatialFigure({ c }) {
  const fc = c.fig.spatial;
  const fig = createFigure({ key: 'spatial', title: fc.title, readout: [fc.readout] });
  const g = fig.g;
  const LW = 330;
  const RX = 380;
  const RW = W - RX;
  let ly = colHead(g, 0, 14, LW, fc.left);
  ly = stepsBlock(fig, g, 0, ly + 4, LW, { ...fc.left, passBoxW: Math.max(96, measure(fc.left.passBox, 16, 800) + 24) });
  // right: w × min(1, B / N)
  eyebrow(g, RX, 14, fc.right.eyebrow);
  text(g, RX, 44, fc.right.name, 'tx tl');
  const nNote = wrapText(g, RX, 72, fc.right.note, RW, { cls: 't2' });
  const fy = 72 + nNote * 19 + 8;
  text(g, W, fy, fc.right.formula, 'tmid tn', 'end');
  const cx0 = RX + 40;
  const cx1 = W - 6;
  const cy0 = fy + 34;
  const cy1 = cy0 + 170;
  const x = d3.scaleLinear().domain([0.5, 4.3]).range([cx0, cx1]);
  const y = d3.scaleLinear().domain([0, 1]).range([cy1, cy0]);
  for (const v of [0, 0.5, 1]) {
    line(g, cx0, y(v), cx1, y(v), v ? 'l-rule' : 'l-ink', false);
    text(g, cx0 - 8, y(v) + 4.5, `${v * 100}%`, 't2 tn', 'end');
  }
  line(g, cx0, y(0), cx0, y(1) - 4, 'l-ink', false);
  const f = (n) => Math.min(1, 1 / n);
  const pts = d3.range(0.5, 4.301, 0.05).map((n) => [n, f(n)]);
  g.append('path')
    .attr('d', `M${x(0.5)} ${y(0)}` + pts.map((p) => `L${x(p[0])} ${y(p[1])}`).join('') + `L${x(4.3)} ${y(0)}Z`)
    .attr('class', 'f-std-band');
  path(g, pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0])} ${y(p[1])}`).join(''), 'l-ink l-thick');
  line(g, x(1), cy0 - 10, x(1), cy1, 'l-ref', false);
  for (const nB of [1, 2, 3, 4]) {
    line(g, x(nB), cy1, x(nB), cy1 + 5, 'l-ink2', false);
    text(g, x(nB), cy1 + 19, nB === 1 ? 'B' : `${nB}B`, nB === 1 ? 'tcy tb tn' : 't2 tn', 'middle');
  }
  text(g, x(1) + 8, cy0 - 12, fc.right.full, 'tb');
  const keyPts = [1, 1.25, 2, 4].map((n) => [n, f(n)]);
  for (const p of keyPts.slice(1)) text(g, x(p[0]) + 8, y(p[1]) - 8, `${Math.round(p[1] * 100)}%`, 't2 tn');
  const parts = (n) => [`N = ${+n.toFixed(2)} B`, t('about.fig.share', { v: +(f(n) * 100).toFixed(1) })];
  // continuous reading under the pointer
  const over = rect(g, cx0, cy0, cx1 - cx0, cy1 - cy0, 'f-hit');
  over.on('pointermove', (e) => {
    const [mx] = d3.pointer(e, g.node());
    const n = Math.max(0.5, Math.min(4.3, x.invert(mx)));
    fig.read(parts(Math.round(n * 20) / 20));
  });
  over.on('pointerleave', () => fig.read(null));
  const km = g
    .append('g')
    .selectAll('rect')
    .data(keyPts)
    .join('rect')
    .attr('x', (d) => x(d[0]) - 5)
    .attr('y', (d) => y(d[1]) - 5)
    .attr('width', 10)
    .attr('height', 10)
    .attr('class', 'f-std f-pt')
    .attr('data-fx', 'cell');
  fig.mark(km, (d) => parts(d[0]));
  let ry = cy1 + 40;
  wrapText(g, RX, ry, fc.right.axisB, RW, { cls: 't2' });
  ry += 40;
  // tiers: 8 cells, width by points, three tiers
  let yy = Math.max(ly, ry) + 10;
  line(g, 0, yy, W, yy, 'l-ink');
  yy += 30;
  eyebrow(g, 0, yy, fc.tiers.eyebrow);
  const hx = ebW(fc.tiers.eyebrow) + 12;
  text(g, hx, yy, fc.tiers.title, 'tx tl');
  text(g, hx + measure(fc.tiers.title, 15, 800) + 12, yy, fc.tiers.note, 't2');
  yy += 34;
  const wts = fc.w;
  const px = W / wts.reduce((a, b) => a + b, 0);
  const tiers = fc.tiers.groups; // [[name, from, to]]
  let tx = 0;
  const xs = [];
  for (const w of wts) {
    xs.push(tx);
    tx += w * px;
  }
  for (const [name, from, to] of tiers) {
    const x0 = xs[from];
    const x1 = xs[to] + wts[to] * px;
    const sum = wts.slice(from, to + 1).reduce((a, b) => a + b, 0);
    text(g, x0 + 2, yy, `${name} ${sum}`, 'tb tn');
    bracket(g, x0 + 2, x1 - 3, yy + 14, 1, 'l-ink');
  }
  yy += 22;
  const cells = g
    .append('g')
    .selectAll('g')
    .data(wts.map((w, i) => ({ i, w, B: fc.B[i] })))
    .join('g');
  cells.each(function (d) {
    const cg = d3.select(this);
    rect(cg, xs[d.i] + 1, yy, d.w * px - 3, 30, 'f-std', true);
    text(cg, xs[d.i] + (d.w * px) / 2, yy + 20, String(d.i + 1).padStart(2, '0'), 'tb tn tof', 'middle');
    text(cg, xs[d.i] + (d.w * px) / 2, yy + 50, String(d.w), 'tn', 'middle');
    text(cg, xs[d.i] + (d.w * px) / 2, yy + 70, `B ${d.B}`, 'tcy tn', 'middle');
  });
  fig.mark(cells, (d) => [t('about.fig.puzzle', { n: String(d.i + 1).padStart(2, '0') }), t('about.fig.points', { v: d.w }), `B = ${d.B}`]);
  yy += 96;
  const n2 = wrapText(g, 0, yy + 4, fc.tiers.json, W, { cls: 't2' });
  yy += n2 * 19 + 10;
  const end = toolsBlock(fig, g, yy, fc.tools, [{ x: 0, w: W, spec: fc.tools.luban }]);
  fig.size(end + 4);
  return fig;
}
