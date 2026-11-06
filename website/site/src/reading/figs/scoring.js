// FIG 分数进入总分 / 六种题型怎样计分 / 分项打分示意 (05 打分机制).
import { t, pick, fmtPct } from '../../core/index.js';
import { createFigure, d3, W, text, line, rect, path, star, eyebrow, wrap, lines, wrapText, measure, bracket, kindMark, icon, ebW } from './common.js';
import { perfChart, logLerp } from './standard.js';



/** A flowing row of category icons + names. */
function catRow(g, data, keys, x, y, maxW) {
  let cx = x;
  for (const key of keys) {
    const cat = data.category(key);
    const nm = pick(cat, 'short');
    const w = 20 + measure(nm, 13) + 16;
    if (cx + w > x + maxW) break;
    icon(g, key, cx, y - 12, 15);
    text(g, cx + 20, y, nm, 't2');
    cx += w;
  }
}

/** An arrow: a line ending in a small four-point star. */
function arrow(g, x1, y, x2) {
  line(g, x1, y, x2 - 6, y, 'l-ink');
  star(g, x2 - 4, y, 4.5, 'f-ink');
}

// ---------------------------------------------------------------------------
export function pipelineFigure({ data, c }) {
  const fc = c.fig.pipeline;
  const fig = createFigure({ key: 'pipeline', title: fc.title, sketch: true, readout: [fc.readout] });
  const g = fig.g;
  const SX = 566;
  const SW = W - SX;
  // standard lane
  const s0 = 0;
  rect(g, 0, s0, SX - 18, 150, 'f-std-band');
  line(g, 0, s0, SX - 18, s0, 'l-ink');
  eyebrow(g, 12, s0 + 28, fc.std.eyebrow);
  const sx = 12 + ebW(fc.std.eyebrow) + 10;
  kindMark(g, 'standard', sx, s0 + 23, 11);
  text(g, sx + 18, s0 + 28, `${t('common.kind.standard')}`, 'tx');
  text(g, sx + 18 + measure(t('common.kind.standard'), 15, 800) + 8, s0 + 28, t('common.unit.tasksShort', { n: data.kinds.standard.tasks.length }), 't2 tn');
  catRow(g, data, data.kinds.standard.categories, 12, s0 + 54, SX - 40);
  const by = s0 + 82;
  const boxW = Math.max(128, ...[fc.std.box, ...fc.des.graders.map((x) => x[0])].map((s) => measure(s, 13, 700) + 24));
  const c1 = 12 + boxW + 16;
  const w1 = Math.max(...[...fc.std.gen, ...fc.des.graders.flatMap((x) => [x[1], x[2]])].map((s) => measure(s, 13)));
  const ax = c1 + w1 + 14;
  const c2 = ax + 34;
  rect(g, 12, by, boxW, 40, 'f-panel-box');
  rect(g, 12, by, 44, 4, 'f-std');
  text(g, 12 + boxW / 2, by + 26, fc.std.box, 'tb', 'middle');
  text(g, c1, by + 16, fc.std.gen[0], '');
  text(g, c1, by + 36, fc.std.gen[1], 't2 tn');
  arrow(g, ax, by + 20, c2 - 8);
  text(g, c2, by + 4, fc.std.conv[0], 'tb');
  text(g, c2, by + 24, fc.std.conv[1], 'tn');
  text(g, c2, by + 44, fc.std.conv[2], 't2 tn');
  const e1 = c2 + Math.max(...fc.std.conv.map((s) => measure(s, 13, 600))) + 12;
  arrow(g, Math.min(e1, SX - 40), by + 20, SX + 2);
  // design lane
  const d0 = 170;
  line(g, 0, d0, SX - 18, d0, 'l-ink');
  eyebrow(g, 12, d0 + 28, fc.des.eyebrow);
  const dx = 12 + ebW(fc.des.eyebrow) + 10;
  kindMark(g, 'design', dx, d0 + 23, 11);
  text(g, dx + 18, d0 + 28, t('common.kind.design'), 'tx');
  text(g, dx + 18 + measure(t('common.kind.design'), 15, 800) + 8, d0 + 28, t('common.unit.tasksShort', { n: data.kinds.design.tasks.length }), 't2 tn');
  catRow(g, data, data.kinds.design.categories, 12, d0 + 54, SX - 40);
  const gy = [d0 + 76, d0 + 128];
  fc.des.graders.forEach(([name, what, v], i) => {
    rect(g, 12, gy[i], boxW, 40, 'f-panel-box');
    rect(g, 12, gy[i], 44, 4, 'f-des-mid');
    text(g, 12 + boxW / 2, gy[i] + 26, name, 'tb', 'middle');
    text(g, c1, gy[i] + 16, what, '');
    text(g, c1, gy[i] + 36, v, 't2 tn');
  });
  const my = (gy[0] + gy[1]) / 2 + 20;
  path(g, `M${ax - 20} ${gy[0] + 20}H${ax}V${gy[1] + 20}H${ax - 20}M${ax} ${my}H${ax + 6}`, 'l-ink');
  arrow(g, ax + 6, my, c2 - 8);
  const avgL = wrap(fc.des.avg[0], SX - 60 - c2, 13, 700);
  lines(g, c2, my - 2 - (avgL.length - 1) * 19, avgL, 19, 'tb');
  text(g, c2, my + 20, fc.des.avg[1], 't2 tn');
  const e2 = c2 + Math.max(...avgL.map((s) => measure(s, 13, 700)), measure(fc.des.avg[1], 13)) + 12;
  arrow(g, Math.min(e2, SX - 40), my, SX + 2);
  // S_t panel
  rect(g, SX, 0, SW, d0 + 182, 'f-panel-box');
  rect(g, SX, 0, 48, 5, 'f-orbit');
  text(g, SX + SW / 2, by + 26, fc.st.ex1, 'tmid tn t2', 'middle');
  text(g, SX + SW / 2, d0 - 4, fc.st.title, 'tx', 'middle');
  const sym = g.append('text').attr('x', SX + SW / 2).attr('y', d0 + 36).attr('text-anchor', 'middle').attr('class', 'tsym');
  sym.append('tspan').text('S');
  sym.append('tspan').attr('class', 'tsub').attr('dy', 8).text('t');
  text(g, SX + SW / 2, d0 + 60, '0–100', 't2 tn', 'middle');
  text(g, SX + SW / 2, my + 6, fc.st.ex2, 'tmid tn t2', 'middle');
  // weights row
  let y = d0 + 210;
  line(g, 0, y, W, y, 'l-ink');
  const wy = y + 30;
  const wl = g.append('text').attr('x', 0).attr('y', wy).attr('class', 'tx');
  wl.append('tspan').text(`${fc.weights.title} w`);
  wl.append('tspan').attr('class', 'tsub').attr('dy', 5).text('t');
  text(g, measure(fc.weights.title, 15, 800) + 40, wy, fc.weights.note, 't2');
  const bx1 = SX - 18;
  const px = bx1 / 100;
  let x = 0;
  const bY = wy + 18;
  for (const cat of data.categories) {
    const w = cat.weight * px;
    rect(g, x + 1, bY, w - 3, 18, cat.kind === 'design' ? 'f-des' : 'f-std', true);
    text(g, x + 1, bY + 38, fmtPct(cat.weight), 'tb tn');
    const nm = pick(cat, 'short');
    if (measure(nm, 13) <= w - 4) text(g, x + 1, bY + 58, nm, 't2');
    x += w;
  }
  // total
  const ty = y + 16;
  rect(g, SX, ty, SW, 92, 'f-ink');
  text(g, SX + 16, ty + 30, fc.total, 'tx ton');
  const tot = g.append('text').attr('x', SX + 16).attr('y', ty + 72).attr('class', 'tbig ton');
  tot.append('tspan').text('Σ w');
  tot.append('tspan').attr('class', 'tsub').attr('dy', 6).text('t');
  tot.append('tspan').attr('dy', -6).text(' S');
  tot.append('tspan').attr('class', 'tsub').attr('dy', 6).text('t');
  line(g, SX + SW / 2, d0 + 182, SX + SW / 2, ty, 'l-ink');
  arrow(g, bx1 + 2, bY + 9, SX + 2);
  // special cases
  y = bY + 82;
  line(g, 0, y, W, y, 'l-rule', false);
  y += 30;
  const tw = measure(fc.special.tag, 13, 700) + 16;
  rect(g, 0, y - 16, tw, 24, 'f-flare');
  text(g, 8, y + 1, fc.special.tag, 'tb tof', '');
  const colon = t('about.fig.colon');
  const widths = fc.special.cases.map(([a, b]) => measure(`${a}${colon}`, 13, 700) + measure(b, 13));
  const oneLine = tw + 18 + widths.reduce((s, w) => s + w + 28, 0) <= W;
  let sx2 = tw + 18;
  fc.special.cases.forEach(([a, b], i) => {
    const s = text(g, sx2, y, '', '');
    s.append('tspan').attr('class', 'tb').text(`${a}${colon}`);
    s.append('tspan').attr('class', 't2').text(b);
    if (oneLine) sx2 += widths[i] + 28;
    else if (i < fc.special.cases.length - 1) y += 24;
  });
  fig.size(y + 10);
  return fig;
}

// ---------------------------------------------------------------------------
// 六种题型怎样计分: 2 × 3 small blocks, each with a closing line for the
// cases that need a word of their own.
export function typesFigure({ c }) {
  const fc = c.fig.types;
  const fig = createFigure({ key: 'types', title: fc.title, sketch: true, readout: [fc.readout] });
  const g = fig.g;
  const BW = 340;
  const GX = W - BW;
  const order = ['formal', 'olympiad', 'extremal', 'perf', 'luban', 'design'];
  let rowTop = 0;
  fig._anchors = c.fig.algo.anchors;
  fig._luban = { w: c.fig.spatial.w, groups: c.fig.spatial.tiers.groups };
  for (let r = 0; r < 3; r++) {
    let rowH = 0;
    const heads = [];
    for (let k = 0; k < 2; k++) {
      const key = order[r * 2 + k];
      const b = fc.blocks[key];
      const x0 = k * GX;
      const bg = g.append('g');
      eyebrow(bg, x0, rowTop + 18, b.eyebrow);
      kindMark(bg, key === 'design' ? 'design' : 'standard', x0, rowTop + 40, 11);
      text(bg, x0 + 18, rowTop + 45, b.name, 'tx tl');
      const n = wrapText(bg, x0, rowTop + 70, b.note, BW, { cls: 't2' });
      heads.push({ key, b, x0, bg, top: rowTop + 70 + n * 19 + 4 });
    }
    const top = Math.max(...heads.map((hd) => hd.top));
    for (const hd of heads) rowH = Math.max(rowH, DRAW[hd.key](fig, hd.bg, hd.x0, top, BW, hd.b) - rowTop);
    // closing lines
    const fy = rowTop + rowH + 8;
    let fh = 0;
    for (const hd of heads) {
      line(g, hd.x0, fy, hd.x0 + BW, fy, 'l-rule', false);
      const s = text(g, hd.x0, fy + 24, '', '');
      const [lead, rest] = hd.b.foot;
      s.append('tspan').attr('class', 'tb').text(rest ? `${lead}${t('about.fig.colon')}` : lead);
      if (rest) {
        const avail = BW - measure(`${lead}${t('about.fig.colon')}`, 13, 700);
        const ls = wrap(rest, avail, 13);
        s.append('tspan').attr('class', 't2').text(ls[0]);
        ls.slice(1).forEach((l) => s.append('tspan').attr('class', 't2').attr('x', hd.x0).attr('dy', 19).text(l));
        fh = Math.max(fh, ls.length * 19);
      } else fh = Math.max(fh, 19);
    }
    rowTop = fy + fh + 14;
    if (r < 2) line(g, 0, rowTop, W, rowTop, 'l-ink');
    rowTop += 20;
  }
  fig.size(rowTop - 14);
  return fig;
}

const DRAW = {
  formal(fig, g, x0, y, w, b) {
    const n = b.cells.length;
    const cw = (w - (n - 1) * 6) / n;
    b.cells.forEach((v, i) => {
      const cx = x0 + i * (cw + 6);
      rect(g, cx, y, cw, 30, v ? 'f-ink' : 'f-zero', true);
      text(g, cx + cw / 2, y + 20, String(v), v ? 'tb tn ton' : 'tn t2', 'middle');
      text(g, cx + cw / 2, y + 50, b.tags[i], 't2', 'middle');
    });
    wrapText(g, x0, y + 82, b.ex, w, { cls: '' });
    return y + 92;
  },
  olympiad(fig, g, x0, y, w, b) {
    const n = b.scores.length;
    const cw = (w - 64) / n;
    const ch = 10;
    for (let i = 0; i < n; i++) {
      const v = b.scores[i];
      for (let k = 0; k < 7; k++) {
        const cy = y + (6 - k) * (ch + 2);
        rect(g, x0 + i * cw, cy, cw - 3, ch, k < v ? 'f-std-soft' : 'f-chip', k < v);
      }
      text(g, x0 + i * cw + (cw - 3) / 2, y + 7 * (ch + 2) + 15, String(v), 't2 tn', 'middle');
    }
    const sum = b.scores.reduce((a, v) => a + v, 0);
    text(g, x0 + w, y + 14, b.ex, 't2', 'end');
    text(g, x0 + w, y + 46, String(sum), 'tbig tn', 'end');
    // raw -> converted
    const ly = y + 7 * (ch + 2) + 38;
    const bw = w - 70;
    rect(g, x0, ly, bw, 8, 'f-chip');
    rect(g, x0, ly, (bw * sum) / 126, 8, 'f-std', true);
    text(g, x0 + bw + 8, ly + 8, `${sum} / 126`, 't2 tn');
    text(g, x0 + (bw * sum) / 126, ly + 28, (Math.round((sum / 126) * 1000) / 10).toFixed(1), 'tb tn', 'middle');
    text(g, x0 + bw + 8, ly + 28, b.conv, 't2');
    return ly + 34;
  },
  extremal(fig, g, x0, y, w, b) {
    const A = fig._anchors.ext;
    const x = d3.scaleLinear().domain([0, 1]).range([x0 + 30, x0 + w - 6]);
    const yy = d3.scaleLinear().domain([0, 100]).range([y + 110, y + 8]);
    for (const v of [0, 50, 100]) {
      line(g, x0 + 30, yy(v), x0 + w - 6, yy(v), v ? 'l-rule' : 'l-ink', false);
      text(g, x0 + 22, yy(v) + 4.5, String(v), 't2 tn', 'end');
    }
    const pts = [[0, 0], ...A];
    g.append('path')
      .attr('d', `M${x(0)} ${yy(0)}` + pts.map((p) => `L${x(p[0])} ${yy(p[1])}`).join('') + `L${x(1)} ${yy(0)}Z`)
      .attr('class', 'f-std-band');
    path(g, pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0])} ${yy(p[1])}`).join(''), 'l-ink');
    for (const r of [0, 0.5, 1]) text(g, x(r), y + 128, String(r), 't2 tn', 'middle');
    text(g, x0 + w - 6, y + 148, b.axis, 't2', 'end');
    const m = g
      .append('g')
      .selectAll('rect')
      .data(A)
      .join('rect')
      .attr('x', (d) => x(d[0]) - 3.5)
      .attr('y', (d) => yy(d[1]) - 3.5)
      .attr('width', 7)
      .attr('height', 7)
      .attr('class', (d) => (d[0] === 1 ? 'f-ref f-pt' : 'f-std f-pt'))
      .attr('data-fx', 'cell');
    fig.mark(m, (d) => [b.name, `r = ${d[0].toFixed(2)}`, t('about.fig.points', { v: d[1] })]);
    return y + 152;
  },
  perf(fig, g, x0, y, w, b) {
    const a = fig._anchors;
    const top = y + 8;
    const r1 = perfChart(fig, g, { x0: x0 + 30, x1: x0 + w - 6, y0: top, y1: top + 102, anchors: a.tr, ticks: [0.1, 1, 16], showBase: true });
    const r2 = perfChart(fig, g, { x0: x0 + 30, x1: x0 + w - 6, y0: top, y1: top + 102, anchors: a.ci, ticks: [], dashed: true, showBase: false });
    text(g, r1.x(1) + 6, top + 14, b.base, 'tcy tb');
    fig.mark(r1.marks, (d) => [b.legend[0], `s = ${+d[0].toFixed(2)}×`, t('about.fig.points', { v: d[1] })]);
    fig.mark(r2.marks, (d) => [b.legend[1], `s = ${+d[0].toFixed(2)}×`, t('about.fig.points', { v: d[1] })]);
    // legend
    const ly = top + 146;
    line(g, x0, ly - 4, x0 + 20, ly - 4, 'l-ink l-thick', false);
    text(g, x0 + 26, ly, b.legend[0], 't2');
    const lx = x0 + 26 + measure(b.legend[0], 13) + 20;
    line(g, lx, ly - 4, lx + 20, ly - 4, 'l-ink l-dash', false);
    text(g, lx + 26, ly, b.legend[1], 't2');
    return ly + 6;
  },
  luban(fig, g, x0, y, w, b) {
    const wts = fig._luban.w;
    const px = w / 100;
    let x = x0;
    const xs = wts.map((v) => {
      const r = x;
      x += v * px;
      return r;
    });
    for (const [name, from, to] of fig._luban.groups) {
      const sum = wts.slice(from, to + 1).reduce((a, v) => a + v, 0);
      text(g, xs[from] + 1, y + 12, name, 't2');
      text(g, xs[from] + 1, y + 30, String(sum), 'tb tn');
      bracket(g, xs[from] + 1, xs[to] + wts[to] * px - 3, y + 42, 1, 'l-ink');
    }
    const cy = y + 50;
    b.ex.forEach((v, i) => {
      const cw = wts[i] * px - 3;
      rect(g, xs[i], cy, cw, 30, 'f-zero', true);
      if (v) rect(g, xs[i], cy, (cw * v) / wts[i], 30, 'f-std', true);
      text(g, xs[i] + cw / 2, cy + 50, String(v), v ? 'tb tn' : 't2 tn', 'middle');
    });
    const n = wrapText(g, x0, cy + 80, b.exText, w, { cls: '' });
    return cy + 80 + (n - 1) * 19 + 8;
  },
  design(fig, g, x0, y, w, b) {
    let yy = y + 6;
    for (const [v, max, label] of b.rows) {
      text(g, x0 + 30, yy + 12, v.toFixed(1), 'tn', 'end');
      for (let k = 0; k < max; k++) {
        const cx = x0 + 42 + k * 26;
        rect(g, cx, yy, 22, 14, 'f-chip');
        const f = Math.max(0, Math.min(1, v - k));
        if (f > 0) rect(g, cx, yy, 22 * f, 14, 'f-des', true);
      }
      text(g, x0 + 42 + 5 * 26 + 14, yy + 12, label, 't2');
      yy += 26;
    }
    line(g, x0, yy + 2, x0 + 42 + 5 * 26, yy + 2, 'l-ink');
    const sum = b.rows.reduce((a, r) => a + r[0], 0);
    text(g, x0 + 30, yy + 26, sum.toFixed(1), 'tb tn', 'end');
    text(g, x0 + 42, yy + 26, b.sum, 't2');
    text(g, x0 + 42 + 5 * 26 + 14, yy + 26, b.sumLabel, 't2');
    return yy + 34;
  },
};

// ---------------------------------------------------------------------------
// 分项打分示意: the physics task's 作用关系 direction; each grader's score
// per sub-item as cells (one cell per point), the per-item mean, then the
// four directions adding up to the task score.
export function designscoreFigure({ c }) {
  const fc = c.fig.designscore;
  const fig = createFigure({ key: 'designscore', title: fc.title, sketch: true, readout: [fc.readout] });
  const g = fig.g;
  const A = 300;
  const B = 482;
  text(g, 0, 18, fc.guide, 't2');
  text(g, A, 18, fc.graders[0], 'tb');
  text(g, B, 18, fc.graders[1], 'tb');
  text(g, W, 18, fc.avg, 't2', 'end');
  line(g, 0, 32, W, 32, 'l-ink');
  const d = fc.dir;
  text(g, 0, 62, d.name, 'tx tl');
  text(g, measure(d.name, 15, 800) + 10, 62, d.total, 't2');
  text(g, A, 62, fc.cellNote, 't2');
  let y = 78;
  const rows = [];
  for (const [name, pts, a, b, avg] of d.items) {
    const rg = g.append('g').attr('class', 'f-drow');
    rect(rg, -8, y + 1, W + 16, 33, 'f-hit');
    text(rg, 0, y + 22, name, 'tb');
    text(rg, measure(name, 13, 700) + 8, y + 22, t('about.fig.points', { v: pts }), 't2 tn');
    for (const [x0, v] of [
      [A, a],
      [B, b],
    ]) {
      text(rg, x0, y + 22, v.toFixed(1), 'tn');
      for (let k = 0; k < pts; k++) {
        const cx = x0 + 34 + k * 22;
        rect(rg, cx, y + 10, 18, 14, 'f-chip');
        const f = Math.max(0, Math.min(1, v - k));
        if (f > 0) rect(rg, cx, y + 10, 18 * f, 14, 'f-des', true);
      }
    }
    text(rg, W, y + 22, avg.toFixed(1), 'tmid tn', 'end');
    rows.push({ node: rg.node(), name, pts, a, b, avg });
    y += 36;
  }
  line(g, A - 10, y + 4, W, y + 4, 'l-ink');
  text(g, A - 22, y + 28, fc.sum, 't2', 'end');
  fc.sums.forEach((s, i) => {
    const sx = [A, B, W][i];
    if (i < 2) {
      text(g, sx, y + 28, s, 'tmid tn');
      text(g, sx + measure(s, 16, 800) + 6, y + 28, `/ ${d.pts}`, 't2 tn');
    } else text(g, W, y + 28, s, 'tmid tn', 'end');
  });
  fig.mark(d3.selectAll(rows.map((r) => r.node)).data(rows), (r) => [`${r.name} ${t('about.fig.points', { v: r.pts })}`, `${fc.graders[0]} ${r.a.toFixed(1)}`, `${fc.graders[1]} ${r.b.toFixed(1)}`, `${fc.avg} ${r.avg.toFixed(1)}`]);
  // four directions add up to the task score
  y += 52;
  line(g, 0, y, W, y, 'l-ink');
  y += 32;
  text(g, 0, y, fc.bottom.title, 'tx tl');
  y += 40;
  const bw = 560;
  const tot = fc.bottom.dirs.reduce((a, x) => a + x[2], 0);
  const px = bw / tot;
  let x = 0;
  fc.bottom.dirs.forEach(([name, got, pts], i) => {
    const w = pts * px;
    const cur = i === fc.bottom.current;
    text(g, x + w / 2, y - 8, name, cur ? 'tb' : 't2', 'middle');
    rect(g, x + 1, y, w - 4, 26, 'f-chip');
    rect(g, x + 1, y, ((w - 4) * got) / pts, 26, cur ? 'f-des-mid' : 'f-des', true);
    const s = text(g, x + w / 2, y + 48, '', '', 'middle');
    s.append('tspan').attr('class', 'tb tn').text(got.toFixed(1));
    s.append('tspan').attr('class', 't2 tn').text(` / ${pts}`);
    x += w;
  });
  const sumV = fc.bottom.dirs.reduce((a, r) => a + r[1], 0);
  text(g, W - 48, y + 26, sumV.toFixed(1), 'thuge tn', 'end');
  text(g, W, y + 26, '/ 100', 't2 tn', 'end');
  y += 76;
  line(g, 0, y, W, y, 'l-rule', false);
  const f = text(g, 0, y + 26, '', '');
  f.append('tspan').attr('class', 'tb').text(`${fc.foot[0]}${t('about.fig.colon')}`);
  f.append('tspan').attr('class', 't2').text(fc.foot[1]);
  fig.size(y + 34);
  return fig;
}
