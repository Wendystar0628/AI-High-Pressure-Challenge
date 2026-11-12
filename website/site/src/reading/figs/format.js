// FIG 作答时间线 / 谁能看到什么 / 测试赛程 / 各类题能用什么 (04 测试形式).
import { t, pick, links, fmtNo } from '../../core/index.js';
import { createFigure, d3, W, text, line, rect, path, star, eyebrow, wrap, lines, wrapText, measure, bracket, kindMark, icon, ebW } from './common.js';



// ---------------------------------------------------------------------------
// 作答时间线: three lanes on one minute scale. Triangle = a new round,
// diamond = overall-progress hint, solid square = submit reminder, thick ink
// line = time is up; the last minute (no immediate continuation) is a cyan band, idle time hatched.
const LAST_MINUTES = 1;
export function timelineFigure({ c }) {
  const fc = c.fig.timeline;
  const fig = createFigure({ key: 'timeline', title: fc.title, sketch: true, readout: [fc.readout] });
  const g = fig.g;
  const X0 = 176;
  const X1 = 650;
  const x = d3.scaleLinear().domain([0, 100]).range([X0, X1]);
  // axis
  line(g, X0, 30, X1, 30, 'l-ink', false);
  for (let m = 0; m <= 100; m += 5) {
    line(g, x(m), 30, x(m), m % 10 ? 26 : 23, 'l-ink2', false);
    if (m % 10 === 0) text(g, x(m), 16, String(m), 't2 tn', 'middle');
  }
  text(g, X1 + 24, 16, t('about.fig.minutesAxis'), 't2');
  const L = fc.labels;
  const marks = [];
  let y = 44;
  fc.lanes.forEach((lane, li) => {
    const top = y;
    const barY = top + 54;
    const end = lane.end;
    // label column
    if (lane.kind === 'standard') rect(g, 0, top + 24, 11, 11, 'f-std');
    else star(g, 5.5, top + 29.5, 6.5, 'f-orbit');
    text(g, 18, top + 34, lane.name, 'tx');
    lines(g, 18, top + 56, lane.sub.flatMap((s) => wrap(s, X0 - 34, 13)), 19, 't2');
    // the last minute
    rect(g, x(end - LAST_MINUTES), top + 12, x(end) - x(end - LAST_MINUTES), 74, 'f-ref-band');
    // work rounds and idle time
    for (const [a, b] of lane.bars) rect(g, x(a), barY, x(b) - x(a), 14, lane.kind === 'standard' ? 'f-std' : 'f-des', true);
    const last = lane.bars[lane.bars.length - 1][1];
    rect(g, x(last), barY, x(end) - x(last), 14, 'f-ban').attr('fill', fig.hatch);
    // "no more rounds" under the band, one line lower if a round's label is in the way
    const nmW = measure(L.noMore, 13);
    const nmX = Math.min(x(end - LAST_MINUTES / 2), x(end) - nmW / 2 + 4);
    const clash = lane.marks.some(([m, type, key]) => type === 'round' && Math.abs(x(m) - nmX) < (measure(L[key], 13) + nmW) / 2 + 8);
    text(g, nmX, barY + (clash ? 58 : 38), L.noMore, 't2', 'middle');
    const extra = clash ? 20 : 0;
    if (lane.cut != null) {
      // interruption: a double slash across the bar
      path(g, `M${x(lane.cut) - 5} ${barY + 20}L${x(lane.cut) - 1} ${barY - 6}M${x(lane.cut) + 1} ${barY + 20}L${x(lane.cut) + 5} ${barY - 6}`, 'l-ink l-thick', false);
    }
    // time is up
    line(g, x(end), top + 8, x(end), top + 88, 'l-stop', false);
    text(g, x(end) + 8, barY + 12, L.stop, 'tb');
    // markers
    for (const [m, type, key] of lane.marks) {
      const mx = x(m);
      const mg = g.append('g').attr('class', 'f-tmark');
      if (type === 'round') {
        line(mg, mx, barY + 14, mx, barY + 26, 'l-ink', false);
        mg.append('path').attr('d', `M${mx} ${barY + 14}l5.5 9h-11z`).attr('class', 'f-ink');
        text(mg, mx, barY + 40, L[key], '', 'middle');
      } else {
        line(mg, mx, top + 26, mx, barY, 'l-ink', false);
        if (type === 'progress') mg.append('path').attr('d', `M${mx} ${barY - 7}l6 6.5l-6 6.5l-6 -6.5z`).attr('class', 'f-ink');
        else rect(mg, mx - 5, barY - 5, 10, 10, 'f-ink');
        const lw = measure(L[key], 13);
        if (mx + lw / 2 > x(end) - 6) text(mg, x(end) - 8, top + 20, L[key], '', 'end');
        else text(mg, mx, top + 20, L[key], '', 'middle');
      }
      rect(mg, mx - 14, top + 6, 28, 84, 'f-hit');
      marks.push({ node: mg.node(), m, type, key, lane: lane.name });
    }
    y = top + 96 + extra;
    if (lane.spans) {
      for (const [a, b, s] of lane.spans) {
        bracket(g, x(a) + 1, x(b) - 1, y + 2, -1, 'l-ink2');
        const ls = wrap(s, x(b) - x(a) - 4, 13);
        lines(g, x(a) + 2, y + 22, ls, 19, 't2');
      }
      y += 54;
    }
    if (li < fc.lanes.length - 1) line(g, 0, y, W, y, 'l-rule', false);
    y += 8;
  });
  // legend
  y += 8;
  line(g, 0, y, W, y, 'l-ink');
  y += 26;
  for (let r = 0; r < fc.legend.length; r += 2) {
    let rowH = 0;
    fc.legend.slice(r, r + 2).forEach(([title, desc], k) => {
      const lx = k * (W / 2);
      text(g, lx, y, title, 'tb');
      rowH = Math.max(rowH, wrapText(g, lx, y + 20, desc, W / 2 - 24, { cls: 't2' }));
    });
    y += 20 + rowH * 19 + 16;
  }
  fig.size(y - 12);
  const sel = d3.selectAll(marks.map((m) => m.node)).data(marks);
  fig.mark(sel, (d) => [L[d.key], t('about.fig.minute', { n: d.m }), d.lane, fc.notes[d.type]]);
  return fig;
}

// ---------------------------------------------------------------------------
// 谁能看到什么: resources × the tested session / the graders.
const SYM = {
  rw: (fig, g, x, y) => rect(g, x, y, 14, 14, 'f-ink'),
  ro: (fig, g, x, y) => {
    rect(g, x + 0.5, y + 0.5, 13, 13, 'f-zero');
    return g.append('path').attr('d', `M${x} ${y}h14l-14 14z`).attr('class', 'f-ink');
  },
  deny: (fig, g, x, y) => {
    rect(g, x + 0.5, y + 0.5, 13, 13, 'f-zero f-zero-ink');
    return line(g, x + 2, y + 12, x + 12, y + 2, 'l-ink l-thick', false);
  },
  ban: (fig, g, x, y) => rect(g, x + 0.5, y + 0.5, 13, 13, 'f-ban-box').attr('fill', fig.hatch),
  blank: (fig, g, x, y) => rect(g, x + 0.5, y + 0.5, 13, 13, 'f-blank'),
  na: (fig, g, x, y) => line(g, x + 1, y + 7, x + 13, y + 7, 'l-ink2', false),
};

export function isolationFigure({ c }) {
  const fc = c.fig.isolation;
  const fig = createFigure({ key: 'isolation', title: fc.title, readout: [fc.readout] });
  const g = fig.g;
  // legend
  let lx = 0;
  for (const k of ['rw', 'ro', 'deny', 'ban', 'blank', 'na']) {
    const s = fc.legend[k];
    const w = 22 + measure(s, 13) + 22;
    if (lx + w > W) break;
    SYM[k](fig, g, lx, 4);
    text(g, lx + 20, 16, s, 't2');
    lx += w;
  }
  const C = [250, 494];
  const CW = 214;
  let y = 54;
  fc.cols.forEach(([name, sub], i) => {
    text(g, C[i], y, name, 'tx tl');
    wrapText(g, C[i], y + 22, sub, CW + 10, { cls: 't2' });
  });
  y += 46;
  line(g, 0, y, W, y, 'l-ink');
  for (const r of fc.rows) {
    const top = y;
    const nameLines = wrap(r.name, 230, 13, 700);
    lines(g, 0, top + 26, nameLines, 19, 'tb');
    let hgt = nameLines.length * 19;
    if (r.sub) hgt += wrapText(g, 0, top + 26 + nameLines.length * 19 + 2, r.sub, 230, { cls: 't2' }) * 19 + 2;
    r.cells.forEach(([sym, s], i) => {
      const cg = g.append('g').attr('data-fx', 'cell');
      SYM[sym](fig, cg, C[i], top + 14);
      const n = wrapText(cg, C[i] + 24, top + 26, s, CW - 24, { cls: sym === 'na' ? 't2' : '' });
      hgt = Math.max(hgt, n * 19);
    });
    y = top + hgt + 22;
    line(g, 0, y, W, y, 'l-rule', false);
  }
  // the shell of each tested session
  y += 18;
  const sh = fc.shell;
  const top = y;
  const colW = W / 5;
  const items = sh.items;
  let maxH = 0;
  items.forEach(([title, desc], i) => {
    const x0 = (i + 1) * colW + 12;
    text(g, x0, top + 30, title, 'tb');
    maxH = Math.max(maxH, wrapText(g, x0, top + 52, desc, colW - 22, { cls: 't2' }));
  });
  const boxH = 52 + maxH * 19 + 8;
  g.insert('rect', ':first-child').attr('x', 0).attr('y', top).attr('width', W).attr('height', boxH).attr('class', 'f-band-paper');
  line(g, 0, top, W, top, 'l-ink');
  eyebrow(g, 12, top + 26, sh.eyebrow);
  const tl = wrap(sh.title, colW - 20, 15, 800);
  lines(g, 12, top + 50, tl, 21, 'tx tl');
  for (let i = 1; i < 5; i++) line(g, i * colW, top + 14, i * colW, top + boxH - 12, 'l-rule', false);
  fig.size(top + boxH + 2);
  return fig;
}

// ---------------------------------------------------------------------------
// 测试赛程: a Gantt of the two batches on one minute scale, then grading.
export function scheduleFigure({ data, c }) {
  const fc = c.fig.schedule;
  const fig = createFigure({ key: 'schedule', title: fc.title, readout: [fc.readout] });
  const g = fig.g;
  const serial = new Set(fc.serial);
  const b1 = data.tasks.filter((x) => !serial.has(x.key)).sort((a, b) => (a.kind === b.kind ? a.no - b.no : a.kind === 'standard' ? -1 : 1));
  const b2 = fc.serial.map((k) => data.task(k)).filter(Boolean);
  const end1 = Math.max(...b1.map((x) => x.minutes));
  // batch 2: fc.together — the tasks run at the same time (one model's performance tasks, each on its own
  // processors); otherwise one after another
  let tEnd = end1;
  const starts = new Map();
  for (const task of b2) {
    starts.set(task.key, fc.together ? end1 : tEnd);
    tEnd = fc.together ? Math.max(tEnd, end1 + task.minutes) : tEnd + task.minutes;
  }
  const X0 = 300;
  const X1 = W - 10;
  const x = d3.scaleLinear().domain([0, tEnd]).range([X0, X1]);
  // head + axis
  text(g, 18, 16, fc.head.task, 't2');
  text(g, X0 - 22, 16, fc.head.limit, 't2', 'end');
  // every 30 minutes, plus the two batch ends; a 30-minute label too close to a batch end gives way to it
  const refs = [end1, tEnd];
  const ticks = [...new Set([0, 30, 60, 90, 120, 150, 180, ...refs])]
    .filter((m) => m <= tEnd && (refs.includes(m) || refs.every((r) => Math.abs(r - m) > 12)))
    .sort((a, b) => a - b);
  line(g, X0, 28, X1, 28, 'l-ink', false);
  for (const m of ticks) {
    const ref = m === end1 || m === tEnd;
    line(g, x(m), 28, x(m), 22, 'l-ink2', false);
    text(g, x(m), 16, String(m), ref ? 'tcy tb tn' : 't2 tn', m === tEnd ? 'end' : 'middle');
  }
  let y = 36;
  const bars = [];
  const batch = (spec, tasks, start) => {
    line(g, 0, y, W, y, 'l-ink');
    y += 24;
    eyebrow(g, 0, y, spec.eyebrow);
    const tx = ebW(spec.eyebrow) + 12;
    text(g, tx, y, spec.title, 'tx');
    text(g, tx + measure(spec.title, 15, 800) + 12, y, spec.note.replace('{n}', tasks.length), 't2');
    y += 12;
    for (const task of tasks) {
      const s = start(task);
      const cy = y + 13;
      kindMark(g, task.kind, 0, cy, 10);
      const a = g.append('a').attr('href', links.task(task)).attr('class', 'f-tname');
      text(a, 18, cy + 4.5, pick(task, 'short'), '');
      text(g, X0 - 22, cy + 4.5, String(task.minutes), 'tb tn', 'end');
      const bg = g.append('g').attr('class', 'f-gbar').datum({ task, s, spec });
      rect(bg, x(s), cy - 7, x(s + task.minutes) - x(s), 14, task.kind === 'design' ? 'f-des' : 'f-std', true);
      line(bg, x(s + task.minutes), cy - 9, x(s + task.minutes), cy + 9, 'l-ink', false);
      if (start === firstStart && task.minutes < end1) rect(bg, x(task.minutes) + 2, cy - 7, x(end1) - x(task.minutes) - 2, 14, 'f-ban').attr('fill', fig.hatch);
      rect(bg, 0, cy - 11, W, 22, 'f-hit');
      bars.push(bg.node());
      y += 26;
    }
    y += 6;
  };
  const firstStart = () => 0;
  batch(fc.batch1, b1, firstStart);
  const mid = y;
  batch(fc.batch2, b2, (task) => starts.get(task.key));
  // reference lines: end of each batch
  for (const m of [end1, tEnd]) line(g, x(m), 28, x(m), y, 'l-ref', false);
  // cleanup tags
  const tag = (m, yy, s, side) => {
    const w = measure(fc.clean, 13, 700) + 16;
    rect(g, x(m) - w / 2, yy - 15, w, 22, 'f-ink');
    text(g, x(m), yy, fc.clean, 'tb ton', 'middle');
    if (side === 'right') text(g, x(m) + w / 2 + 8, yy - 10, s, 't2');
    else text(g, x(m) - w / 2 - 8, yy, s, 't2', 'end');
  };
  tag(end1, mid + 4, fc.done1.replace('{n}', b1.length), 'right');
  y += 6;
  line(g, 0, y, W, y, 'l-ink');
  y += 26;
  tag(tEnd, y, fc.done2.replace('{n}', data.tasks.length));
  // grading
  eyebrow(g, 0, y, fc.grading.eyebrow);
  const gx = ebW(fc.grading.eyebrow) + 12;
  text(g, gx, y, fc.grading.title, 'tx');
  y += 22;
  const gn = wrapText(g, 0, y, fc.grading.note, W - 220, { cls: 't2' });
  y += (gn - 1) * 19 + 22;
  const boxes = fc.grading.parts;
  for (const p of boxes) {
    const top = y;
    rect(g, 0, top, W, 4, 'f-ink');
    text(g, 12, top + 28, p.title, 'tx');
    text(g, 12 + measure(p.title, 15, 800) + 10, top + 28, p.note, 't2');
    let ry = top + 40;
    for (const [who, by, how] of p.rows) {
      line(g, 12, ry, W - 12, ry, 'l-rule', false);
      const n = wrapText(g, 12, ry + 22, who, 300, { cls: '' });
      let bx = 330;
      for (const name of by) {
        const bw = measure(name, 13, 700) + 18;
        rect(g, bx, ry + 7, bw, 22, 'f-chip');
        text(g, bx + 9, ry + 22, name, 'tb');
        bx += bw + 6;
      }
      if (how) text(g, bx + 4, ry + 22, how, 't2');
      ry += Math.max(n * 19, 19) + 16;
    }
    rect(g, 0, top, W, ry - top, 'f-frame');
    y = ry + 14;
  }
  wrapText(g, 0, y + 8, fc.grading.sum, W, { cls: 'tb' });
  // legend
  y += 40;
  let lx = 0;
  for (const [draw, label] of [
    [(xx) => kindMark(g, 'standard', xx, y - 4, 10), t('common.kind.standard')],
    [(xx) => kindMark(g, 'design', xx, y - 4, 10), t('common.kind.design')],
    [(xx) => rect(g, xx, y - 11, 22, 12, 'f-ban').attr('fill', fig.hatch), fc.wait],
  ]) {
    draw(lx);
    text(g, lx + 30, y, label, 't2');
    lx += 30 + measure(label, 13) + 28;
  }
  fig.size(y + 8);
  fig.mark(d3.selectAll(bars), (d) => [`${fmtNo(d.task.no)} ${pick(d.task, 'name')}`, t('about.fig.limit', { n: d.task.minutes }), d.spec.title, t('about.fig.span', { a: d.s, b: d.s + d.task.minutes })]);
  return fig;
}

// ---------------------------------------------------------------------------
// 各类题能用什么: 6 task types × 7 rules. Solid ink = allowed, hatch =
// forbidden, dash = the statement says nothing. Pointing at a column tints it.
export function rulesFigure({ c }) {
  const fc = c.fig.rules;
  const fig = createFigure({ key: 'rules', title: fc.title, readout: [fc.readout] });
  const g = fig.g;
  const X0 = 180;
  const n = fc.cols.length;
  const cw = (W - X0) / n;
  const cx = (i) => X0 + i * cw + cw / 2;
  const colBg = g.append('g');
  // group brackets
  for (const [kind, from, to] of fc.groups) {
    const x0 = X0 + from * cw + 4;
    const x1 = X0 + (to + 1) * cw - 4;
    bracket(g, x0, x1, 22, -1, 'l-ink');
    const label = t(`common.kind.${kind}`);
    const lw = measure(label, 13, 700) + 18;
    kindMark(g, kind, (x0 + x1) / 2 - lw / 2, 12, 10);
    text(g, (x0 + x1) / 2 - lw / 2 + 16, 16, label, 'tb');
  }
  // column heads
  let headH = 0;
  fc.cols.forEach((col, i) => {
    const icons = col.icons;
    const iw = icons.length * 17;
    icons.forEach((k, j) => icon(g, k, cx(i) - iw / 2 + j * 17, 34, 15));
    const nl = wrap(col.name, cw - 4, 12.5, 700);
    lines(g, cx(i), 68, nl, 18, 'tb tsm', 'middle');
    const sl = wrap(col.sub, cw - 4, 12.5);
    lines(g, cx(i), 68 + nl.length * 18 + 2, sl, 18, 't2', 'middle');
    headH = Math.max(headH, 68 + (nl.length + sl.length) * 18);
  });
  let y = headH + 8;
  line(g, 0, y, W, y, 'l-ink');
  const section = (spec) => {
    y += 30;
    eyebrow(g, 0, y, spec.eyebrow);
    text(g, ebW(spec.eyebrow) + 12, y, spec.title, 'tx');
    y += 8;
  };
  section(fc.all);
  for (const [name, sub] of fc.all.rows) {
    const top = y;
    const nl = wrap(name, X0 - 14, 13, 700);
    lines(g, 0, top + 24, nl, 19, 'tb');
    const k = sub ? wrapText(g, 0, top + 24 + nl.length * 19, sub, X0 - 14, { cls: 't2' }) : 0;
    rect(g, X0 + 4, top + 13, W - X0 - 8, 14, 'f-ban-box', true).attr('fill', fig.hatch);
    y = top + 30 + (nl.length - 1 + k) * 19 + 14;
    line(g, 0, y, W, y, 'l-rule', false);
  }
  y += 4;
  line(g, 0, y, W, y, 'l-ink');
  section(fc.by);
  for (const r of fc.by.rows) {
    const top = y;
    const nl = wrap(r.name, X0 - 14, 13, 700);
    lines(g, 0, top + 24, nl, 19, 'tb');
    let hgt = nl.length * 19 + (r.sub ? wrapText(g, 0, top + 24 + nl.length * 19, r.sub, X0 - 14, { cls: 't2' }) * 19 : 0);
    r.cells.forEach(([sym, note], i) => {
      const cg = g.append('g').attr('data-fx', 'cell');
      let ny = top + 24;
      if (sym === 'yes') rect(cg, cx(i) - 7, top + 12, 14, 14, 'f-ink');
      else if (sym === 'ban') rect(cg, cx(i) - 11, top + 12, 22, 14, 'f-ban-box').attr('fill', fig.hatch);
      else if (sym === 'na') line(cg, cx(i) - 7, top + 19, cx(i) + 7, top + 19, 'l-ink2', false);
      if (sym) ny += 22;
      if (note) {
        const nls = wrap(note, cw - 4, 12.5);
        lines(cg, cx(i), ny, nls, 18, sym ? 't2 tsm' : 'tsm', 'middle');
        hgt = Math.max(hgt, ny - top - 12 + nls.length * 18);
      }
    });
    y = top + Math.max(hgt, 24) + 18;
    line(g, 0, y, W, y, 'l-rule', false);
  }
  y += 4;
  line(g, 0, y, W, y, 'l-ink');
  // column hit areas + tint
  const cols = fc.cols.map((col, i) => ({ col, i }));
  const tints = colBg
    .selectAll('rect')
    .data(cols)
    .join('rect')
    .attr('x', (d) => X0 + d.i * cw)
    .attr('y', 28)
    .attr('width', cw)
    .attr('height', y - 28)
    .attr('class', 'f-coltint');
  const hits = g
    .append('g')
    .selectAll('rect')
    .data(cols)
    .join('rect')
    .attr('x', (d) => X0 + d.i * cw)
    .attr('y', 28)
    .attr('width', cw)
    .attr('height', y - 28)
    .attr('class', 'f-hit');
  const sym = (s) => fc.legend[s] ?? '';
  fig.mark(
    hits,
    (d) => [`${d.col.name.split('\n').join('')} ${d.col.sub}`, ...fc.by.rows.map((r) => `${r.short ?? r.name}${t('about.fig.colon')}${[sym(r.cells[d.i][0]), r.cells[d.i][1]].filter(Boolean).join(t('about.task.sep'))}`)],
    {
      onHot: (d, on) => tints.classed('is-on', (e) => on && e.i === d.i),
    },
  );
  // legend
  y += 28;
  let lx = 0;
  for (const [k, draw] of [
    ['yes', (xx) => rect(g, xx, y - 11, 14, 14, 'f-ink')],
    ['ban', (xx) => rect(g, xx, y - 11, 22, 14, 'f-ban-box').attr('fill', fig.hatch)],
    ['na', (xx) => line(g, xx, y - 4, xx + 14, y - 4, 'l-ink2', false)],
  ]) {
    draw(lx);
    const off = k === 'ban' ? 30 : 22;
    text(g, lx + off, y, fc.legend[k], 't2');
    lx += off + measure(fc.legend[k], 13) + 28;
  }
  const fl = wrapText(g, 0, y + 28, fc.foot, W, { cls: 't2' });
  fig.size(y + 28 + (fl - 1) * 19 + 8);
  return fig;
}
