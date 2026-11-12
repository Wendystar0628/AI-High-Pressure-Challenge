// FIG 数学推理：两种判法 / 性能优化：计分曲线 / 算法对抗：480 局与实力值换算 / 空间推理：步数计分 / 识图建模：吻合度计分.
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
    if (spec.head) {
      text(g, x, yy + 22, spec.head, 'tb');
      yy += 30;
    }
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
  // pass -> solid ink box; optional partial -> soft box; fail -> empty box
  const boxW = spec.passBoxW ?? 76;
  const rows = [
    [spec.pass, spec.passBox, 'f-ink', 'tmid ton'],
    ...(spec.partial ? [[spec.partial, spec.partialBox, 'f-std-soft', 'tmid tof']] : []),
    [spec.fail, '0', 'f-zero', 'tmid t2'],
  ];
  for (const [label, val, fill, cls] of rows) {
    const lw = Math.min(w - boxW - 52, measure(label, 13) + 8);
    text(g, x, y + 5, label, 't2');
    line(g, x + lw + 6, y, x + w - boxW - 14, y, 'l-ink');
    star(g, x + w - boxW - 12, y, 4.5, 'f-ink');
    rect(g, x + w - boxW, y - 17, boxW, 34, fill, true);
    text(g, x + w - boxW / 2, y + 6, val, cls, 'middle');
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
export function perfChart(fig, g, { x0, x1, y0, y1, anchors, labels, dashed = false, dashArray, ticks = [0.1, 0.2, 0.5, 1, 2, 4, 8, 16], axisLabel, showBase = true, showAxes = true, scoreLabel }) {
  const x = d3.scaleLog().domain([0.1, 20]).range([x0, x1]);
  const y = d3.scaleLinear().domain([0, 100]).range([y1, y0]);
  if (showAxes) {
    scoreAxis(g, x0, x1, y, scoreLabel);
    for (const s of ticks) {
      line(g, x(s), y1, x(s), y1 + 5, 'l-ink2', false);
      text(g, x(s), y1 + 19, `${s}×`, 't2 tn', 'middle');
    }
  }
  if (axisLabel) text(g, x1, y1 + 38, axisLabel, 't2', 'end');
  const full = anchors[anchors.length - 1][0];
  const pts = [[0.1, 0], ...anchors.filter((p) => p[0] > 0.1), [20, 100]];
  const area = `M${x(0.1)} ${y(0)}` + pts.map((p) => `L${x(p[0])} ${y(p[1])}`).join('') + `L${x(20)} ${y(0)}Z`;
  if (!dashed) g.append('path').attr('d', area).attr('class', 'f-std-band');
  const curve = path(g, pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0])} ${y(p[1])}`).join(''), dashed ? 'l-ink l-dash' : 'l-ink l-thick', !dashed);
  if (dashArray) curve.attr('stroke-dasharray', dashArray);
  // baseline: s = 1
  if (showBase) {
    const b = logLerp(anchors, 1);
    line(g, x0, y(b), x(1), y(b), 'l-ref', false);
    line(g, x(1), y(b), x(1), y1, 'l-ref', false);
    rect(g, x(1) - 5, y(b) - 5, 10, 10, 'f-ref');
    if (labels?.flat) text(g, x(1) - 8, y(b) - 12, labels.flat.replace('{v}', +b.toFixed(1)), 'tcy tb', 'end');
  }
  if (labels?.full) text(g, x(full) - 10, y(100) - 9 + (labels.fullDy || 0), labels.full, 'tb', 'end');
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
  // performance engineering: two log charts
  let yy = 14;
  eyebrow(g, 0, yy, fc.perf.eyebrow);
  yy += 24;
  const n = wrapText(g, 0, yy, fc.perf.sub, W, { cls: 't2' });
  yy += n * 19 + 14;
  const half = (W - 40) / 2;
  const charts = [
    [0, fc.rt, fc.anchors.rt, [0.1, 0.5, 1, 2, 4, 10], fc.score],
    [half + 40, fc.ci, fc.anchors.ci, [0.1, 0.2, 0.5, 1, 2, 4, 8, 12], null],
  ];
  let bottom = yy;
  // both charts start below the taller of the two heads
  const m = Math.max(...charts.map(([cx, spec]) => {
    text(g, cx, yy, spec.name, 'tx');
    return wrapText(g, cx, yy + 22, spec.sub, half, { cls: 't2' });
  }));
  const top = yy + 22 + m * 19 + 22;
  for (const [cx, spec, anchors, ticks, scoreLabel] of charts) {
    const circuit = spec === fc.ci;
    const { marks } = perfChart(fig, g, { x0: cx + 34, x1: cx + half, y0: top, y1: top + 150, anchors, labels: circuit ? { ...spec, fullDy: -20 } : spec, ticks, axisLabel: spec.axis, scoreLabel });
    fig.mark(marks, (d) => [spec.name, `${spec.var} = ${fmtS(d[0])}`, t('about.fig.points', { v: d[1] })]);
    if (circuit) {
      const regfile = perfChart(fig, g, { x0: cx + 34, x1: cx + half, y0: top, y1: top + 150, anchors: fc.anchors.ciRegfile,
        labels: { full: spec.regfileFull }, dashed: true, ticks: [], showBase: false, showAxes: false });
      fig.mark(regfile.marks, (d) => [spec.regfileLabel, `s = ${fmtS(d[0])}`, t('about.fig.points', { v: d[1] })]);
    }
    bottom = Math.max(bottom, top + 150 + 44);
  }
  // ray tracing score: q × 5 run verdicts × 12 hidden verdicts = this task's score
  yy = scoreRow(g, bottom + 16, fc.rtScore, [
    { cells: ['f-std'], cw: 72, step: 72, label: fc.rtScore.speed },
    { cells: ['f-ink', 'f-ink', 'f-ink', 'f-ink', 'f-std-soft'], cw: 24, step: 30, label: fc.rtScore.runs },
    { cells: [...Array(11).fill('f-ink'), 'f-zero'], cw: 10, step: 13, label: fc.rtScore.hidden },
  ]);
  // circuit score: 9 cells × 7 cells = this task's score
  yy = scoreRow(g, yy + 6, fc.circuit, [
    { cells: Array(9).fill('f-std'), cw: 276 / 9 - 3, step: 276 / 9, label: fc.circuit.inputs },
    { cells: [...Array(6).fill('f-ink'), 'f-zero'], cw: 15, step: 19, label: fc.circuit.checks },
  ]);
  fig.size(yy + 4);
  return fig;
}

/** A task-score row under a rule: groups of cells joined by ×, then = and an ink result box; a label under each
 * group and the fail note under the box. Returns the y below the labels. */
function scoreRow(g, y, spec, groups) {
  line(g, 0, y, W, y, 'l-ink');
  y += 30;
  eyebrow(g, 0, y, spec.eyebrow);
  text(g, ebW(spec.eyebrow) + 12, y, spec.title, 'tx tl');
  y += 22;
  const xs = [];
  let x = 0;
  groups.forEach((gr, i) => {
    if (i) {
      text(g, x + 16, y + 19, '×', 'tmid t2', 'middle');
      x += 34;
    }
    xs.push(x);
    gr.cells.forEach((cls, k) => rect(g, x + k * gr.step, y, gr.cw, 26, cls, true));
    x += (gr.cells.length - 1) * gr.step + gr.cw;
  });
  text(g, x + 18, y + 19, '=', 'tmid t2', 'middle');
  const rx = x + 34;
  const bw = W - rx;
  rect(g, rx, y, bw, 26, 'f-ink', true);
  text(g, rx + bw / 2, y + 18, spec.result, 'tb ton', 'middle');
  const ly = y + 50;
  let n = 0;
  groups.forEach((gr, i) => {
    const room = (i + 1 < groups.length ? xs[i + 1] : rx) - xs[i] - 10;
    const ls = wrap(gr.label, Math.max(room, 90), 13);
    lines(g, xs[i], ly, ls, 19, 't2');
    n = Math.max(n, ls.length);
  });
  const fl = wrap(spec.fail, bw, 13);
  lines(g, rx, ly, fl, 19, 't2');
  return ly + Math.max(n, fl.length) * 19;
}

// ---------------------------------------------------------------------------
// Algorithm battle: 5 tiers × 96 maps = 480 games (one row per tier, one cell per game; seats alternate by map order,
// so each column holds two neighbouring maps: the odd map on top, the bot as player A, solid lime; the even map below,
// player B, pale lime), each game 1 / 0.5 / 0; the
// games give the bot an Elo-scale rating r, and R1 − 200 scores 0, the frozen tier ratings R1–R5 map to
// 10 / 20 / 40 / 60 / 80 and R5 + 200 to 100, linear in between (drawn evenly spaced: only the order of the anchors
// is fixed here). A tools block closes the figure.
const BATTLE_MAPS = 96;
/** The rating anchors: the zero-score rating R1 − 200 (fc.low), the five tiers, then the full-marks rating R5 + 200 (fc.full). */
export const battleAnchors = (fc) => [...(fc.low ? [fc.low] : []), ...fc.tiers, ...(fc.full ? [fc.full] : [])];
export function battleFigure({ c }) {
  const fc = c.fig.battle;
  const fig = createFigure({ key: 'battle', title: fc.title, readout: [fc.readout] });
  const g = fig.g;
  let y = 14;
  eyebrow(g, 0, y, fc.games.eyebrow);
  text(g, ebW(fc.games.eyebrow) + 12, y, fc.games.title, 'tx tl');
  y += 24;
  y += wrapText(g, 0, y, fc.games.sub, W, { cls: 't2' }) * 19 + 14;
  const LW = Math.max(...fc.tiers.map((t) => measure(t.name, 13, 700))) + 14;
  const RW = measure(fc.games.count, 13) + 14;
  const span = W - LW - RW;
  const pw = span / (BATTLE_MAPS / 2); // one column: an odd map above an even map
  const cw = pw - 1.6;
  const RH = 20;
  fc.tiers.forEach((tier) => {
    const tg = g.append('g');
    rect(tg, -4, y - 4, W + 8, RH + 8, 'f-hit');
    text(tg, 0, y + 13, tier.name, 'tb');
    for (let m = 0; m < BATTLE_MAPS / 2; m++) {
      rect(tg, LW + m * pw, y, cw, RH / 2 - 1, 'f-std', true);
      rect(tg, LW + m * pw, y + RH / 2 + 1, cw, RH / 2 - 1, 'f-std-soft', true);
    }
    text(tg, W, y + 13, fc.games.count, 't2 tn', 'end');
    fig.mark(tg, [tier.name, fc.games.count, tier.read]);
    y += RH + 8;
  });
  y += 10;
  // legend: the two sides, then a game's points
  rect(g, 0, y - 10, 10, 12, 'f-std');
  text(g, 16, y, fc.legend.a, 't2');
  const lx = 16 + measure(fc.legend.a, 13) + 18;
  rect(g, lx, y - 10, 10, 12, 'f-std-soft');
  text(g, lx + 16, y, fc.legend.b, 't2');
  let ox = lx + 16 + measure(fc.legend.b, 13) + 34;
  text(g, ox, y, fc.legend.game, 't2');
  ox += measure(fc.legend.game, 13) + 12;
  for (const [label, cls, tcls] of [[fc.legend.win, 'f-ink', 'tb ton'], [fc.legend.draw, 'f-std-soft', 'tb'], [fc.legend.loss, 'f-zero', 'tb t2']]) {
    const w = measure(label, 13, 700) + 16;
    rect(g, ox, y - 14, w, 20, cls);
    text(g, ox + w / 2, y + 1, label, tcls, 'middle');
    ox += w + 8;
  }
  y += 30;
  // the task score: the rating axis from R1 − 200 at 0, anchors R1–R5 at 10 / 20 / 40 / 60 / 80 and R5 + 200 at 100
  line(g, 0, y, W, y, 'l-ink');
  y += 30;
  eyebrow(g, 0, y, fc.score.eyebrow);
  text(g, ebW(fc.score.eyebrow) + 12, y, fc.score.title, 'tx tl');
  y += 26;
  text(g, 0, y, fc.score.axis, 't2');
  y += 30;
  const anchors = battleAnchors(fc);
  const ax0 = 44;
  const step = (W - 2 * ax0) / (anchors.length - 1);
  anchors.forEach((tier, i) => {
    const x = ax0 + i * step;
    if (i < anchors.length - 1) rect(g, x + 1.5, y + 8, step - 3, 20, i % 2 ? 'f-std-soft' : 'f-std', true);
  });
  anchors.forEach((tier, i) => {
    const x = ax0 + i * step;
    const sg = g.append('g');
    rect(sg, x - 40, y - 16, 80, 92, 'f-hit');
    text(sg, x, y, tier.r, 'tb', 'middle');
    line(sg, x, y + 4, x, y + 32, 'l-ink');
    text(sg, x, y + 52, `${tier.pts} ${fc.score.unit}`, 'tb tn', 'middle');
    fig.mark(sg, [tier.name, tier.read]);
  });
  y += 72;
  y += wrapText(g, 0, y + 12, fc.score.note, W, { cls: 't2' }) * 19 + 8;
  const end = toolsBlock(fig, g, y, fc.tools, [{ x: 0, w: W, spec: fc.tools.conquest }]);
  fig.size(end + 4);
  return fig;
}

// ---------------------------------------------------------------------------
// The two puzzle tasks (spatial: Luban lock; drawing: drawings to 3D): conditions on the left, the score curve on the right, then the weight cells.
// Luban lock: w × max(0.6, min(1, B/N)) over N in units of B; drawing to model: w × min(1, F/0.99) over the
// surface match F. ref is the cyan full-marks line. A tools block closes the figure.
const CURVES = {
  luban: {
    f: (n) => Math.max(0.6, Math.min(1, 1 / n)), domain: [0.5, 4.3], keys: [1, 1.25, 5 / 3], ticks: [1, 2, 3, 4], ref: 1,
    tick: (n) => (n === 1 ? 'B' : `${n}B`), at: (n) => `N = ${+n.toFixed(2)} B`, snap: 20, fullEnd: false,
  },
  drawing: {
    f: (v) => Math.min(1, v / 0.99), domain: [0, 1], keys: [0.99, 0.49], ticks: [0, 0.25, 0.5, 0.75], ref: 0.99,
    tick: (v) => (v === 0.99 ? '0.99' : String(v)), at: (v) => `F = ${v.toFixed(2)}`, snap: 100, fullEnd: true,
  },
};

function puzzleSection(fig, g, spec, kind) {
  const LW = 330;
  const RX = 380;
  const RW = W - RX;
  const curve = CURVES[kind];
  eyebrow(g, 0, 14, spec.head.eyebrow);
  text(g, ebW(spec.head.eyebrow) + 12, 14, spec.head.name, 'tx tl');
  text(g, ebW(spec.head.eyebrow) + 12 + measure(spec.head.name, 15, 800) + 12, 14, spec.head.note, 't2');
  const sg = g.append('g').attr('transform', 'translate(0,34)');
  let ly = colHead(sg, 0, 14, LW, spec.left);
  const boxText = [spec.left.passBox, spec.left.partialBox].filter(Boolean);
  ly = stepsBlock(fig, sg, 0, ly + 4, LW, { ...spec.left, passBoxW: Math.max(96, ...boxText.map((s) => measure(s, 16, 800) + 24)) });
  // right: the step curve
  eyebrow(sg, RX, 14, spec.right.eyebrow);
  text(sg, RX, 44, spec.right.name, 'tx tl');
  const nNote = wrapText(sg, RX, 72, spec.right.note, RW, { cls: 't2' });
  const fy = 72 + nNote * 19 + 8;
  text(sg, W, fy, spec.right.formula, 'tmid tn', 'end');
  const cx0 = RX + 40;
  const cx1 = W - 6;
  const cy0 = fy + 34;
  const cy1 = cy0 + 170;
  const [n0, n1] = curve.domain;
  const x = d3.scaleLinear().domain(curve.domain).range([cx0, cx1]);
  const y = d3.scaleLinear().domain([0, 1]).range([cy1, cy0]);
  for (const v of [0, 0.5, 1]) {
    line(sg, cx0, y(v), cx1, y(v), v ? 'l-rule' : 'l-ink', false);
    text(sg, cx0 - 8, y(v) + 4.5, `${v * 100}%`, 't2 tn', 'end');
  }
  line(sg, cx0, y(0), cx0, y(1) - 4, 'l-ink', false);
  const f = curve.f;
  const pts = [...new Set([...d3.range(n0, n1 + 0.001, (n1 - n0) / 76), curve.ref])].sort((a, b) => a - b).map((n) => [n, f(n)]);
  sg.append('path')
    .attr('d', `M${x(n0)} ${y(0)}` + pts.map((p) => `L${x(p[0])} ${y(p[1])}`).join('') + `L${x(n1)} ${y(0)}Z`)
    .attr('class', 'f-std-band');
  path(sg, pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0])} ${y(p[1])}`).join(''), 'l-ink l-thick');
  line(sg, x(curve.ref), cy0 - 10, x(curve.ref), cy1, 'l-ref', false);
  for (const v of new Set([...curve.ticks, curve.ref])) {
    line(sg, x(v), cy1, x(v), cy1 + 5, 'l-ink2', false);
    text(sg, x(v), cy1 + 19, curve.tick(v), v === curve.ref ? 'tcy tb tn' : 't2 tn', 'middle');
  }
  text(sg, x(curve.ref) + (curve.fullEnd ? -8 : 8), cy0 - 12, spec.right.full, 'tb', curve.fullEnd ? 'end' : 'start');
  const keyPts = curve.keys.map((n) => [n, f(n)]);
  for (const p of keyPts.slice(1)) text(sg, x(p[0]) + 8, y(p[1]) - 8, `${Math.round(p[1] * 100)}%`, 't2 tn');
  const parts = (n) => [curve.at(n), t('about.fig.share', { v: +(f(n) * 100).toFixed(1) })];
  // continuous reading under the pointer
  const over = rect(sg, cx0, cy0, cx1 - cx0, cy1 - cy0, 'f-hit');
  over.on('pointermove', (e) => {
    const [mx] = d3.pointer(e, sg.node());
    const n = Math.max(n0, Math.min(n1, x.invert(mx)));
    fig.read(parts(Math.round(n * curve.snap) / curve.snap));
  });
  over.on('pointerleave', () => fig.read(null));
  const km = sg
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
  let yy = Math.max(ly, cy1 + 40 + 40) + 10;
  const nAxis = wrapText(sg, RX, cy1 + 40, spec.right.axisB, RW, { cls: 't2' });
  yy = Math.max(yy, cy1 + 40 + nAxis * 19 + 10);
  // weights: one cell per puzzle, width by points, grouped by tier or kind
  line(sg, 0, yy, W, yy, 'l-ink');
  yy += 30;
  eyebrow(sg, 0, yy, spec.tiers.eyebrow);
  const hx = ebW(spec.tiers.eyebrow) + 12;
  text(sg, hx, yy, spec.tiers.title, 'tx tl');
  text(sg, hx + measure(spec.tiers.title, 15, 800) + 12, yy, spec.tiers.note, 't2');
  yy += 34;
  const wts = spec.w;
  const px = W / wts.reduce((a, b) => a + b, 0);
  let tx = 0;
  const xs = [];
  for (const w of wts) {
    xs.push(tx);
    tx += w * px;
  }
  for (const [name, from, to] of spec.tiers.groups) {
    const x0 = xs[from];
    const x1 = xs[to] + wts[to] * px;
    const sum = wts.slice(from, to + 1).reduce((a, b) => a + b, 0);
    text(sg, x0 + 2, yy, `${name} ${+sum.toFixed(2)}`, 'tb tn');
    bracket(sg, x0 + 2, x1 - 3, yy + 14, 1, 'l-ink');
  }
  yy += 22;
  const cells = sg
    .append('g')
    .selectAll('g')
    .data(wts.map((w, i) => ({ i, w, tag: spec.B ? `B ${spec.B[i]}` : spec.tiers.tags[i] })))
    .join('g');
  cells.each(function (d) {
    const cg = d3.select(this);
    rect(cg, xs[d.i] + 1, yy, d.w * px - 3, 30, 'f-std', true);
    text(cg, xs[d.i] + (d.w * px) / 2, yy + 20, String(d.i + 1).padStart(2, '0'), 'tb tn tof', 'middle').style('font-size', wts.length > 20 ? '12px' : d.w < 5 ? '8px' : null);
    text(cg, xs[d.i] + (d.w * px) / 2, yy + 50, String(d.w), 'tn', 'middle').style('font-size', wts.length > 20 ? '11px' : null);
    text(cg, xs[d.i] + (d.w * px) / 2, yy + 70, d.tag, spec.B ? 'tcy tn' : 't2', 'middle').style('font-size', wts.length > 20 ? '9px' : null);
  });
  fig.mark(cells, (d) => [t('about.fig.puzzle', { n: String(d.i + 1).padStart(2, '0') }), t('about.fig.points', { v: d.w }), d.tag]);
  yy += 96;
  const n2 = wrapText(sg, 0, yy + 4, spec.tiers.json, W, { cls: 't2' });
  return 34 + yy + n2 * 19 + 10;
}

function puzzleFigure({ c }, key, puzzle) {
  const fc = c.fig[key];
  const fig = createFigure({ key, title: fc.title, readout: [fc.readout] });
  const top = puzzleSection(fig, fig.g.append('g'), fc[puzzle], puzzle) + 14;
  const end = toolsBlock(fig, fig.g, top, fc.tools, [
    { x: 0, w: W, spec: { ...fc.tools[puzzle], head: fc[puzzle].head.name } },
  ]);
  fig.size(end + 4);
  return fig;
}

export const spatialFigure = (ctx) => puzzleFigure(ctx, 'spatial', 'luban');
export const drawingFigure = (ctx) => puzzleFigure(ctx, 'drawing', 'drawing');
