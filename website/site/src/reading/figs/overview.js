// FIG 十类十三题 (page head), 一道题怎么测 (01), 权重条 (02 and /tasks/).
import { t, pick, links, fmtNo, fmtPct } from '../../core/index.js';
import { createFigure, W, text, line, rect, path, star, kindMark, icon, measure, wrap, lines, bracket, eyebrow, ellipsis } from './common.js';

const kindName = (k) => t(`common.kind.${k}`);
const minutes = (n) => t('common.unit.minutes', { n });

/** The readout of one task: No.01 name │ 限时 │ 权重 │ 类型 */
export function taskParts(task) {
  return [`${fmtNo(task.no)} ${pick(task, 'name')}`, t('about.fig.limit', { n: task.minutes }), t('about.fig.weight', { w: fmtPct(task.weight) }), t(`about.kind1.${task.kind}`)];
}

// ---------------------------------------------------------------------------
// 十类十三题: 10 category rows, one cell per task, cell length by minutes; the
// two task kinds in two groups split by an ink line. Cells link to task pages.
export function heroFigure({ data, c, vars }) {
  const fc = c.fig.hero;
  const fig = createFigure({ key: 'hero', title: fc.title, readout: [t('about.fig.heroDefault', vars)] });
  const g = fig.g;
  const X0 = 236;
  const GAP = 4;
  const rowH = 30;
  const step = 38;
  const maxSum = Math.max(...data.categories.map((cat) => cat.tasks.reduce((a, x) => a + x.minutes, 0)));
  const maxN = Math.max(...data.categories.map((cat) => cat.tasks.length));
  const k = (W - X0 - GAP * (maxN - 1)) / maxSum;
  let y = 0;
  let catNo = 0;
  for (const kind of ['standard', 'design']) {
    const cats = data.categories.filter((cat) => cat.kind === kind);
    if (!cats.length) continue;
    if (y > 0) {
      line(g, 0, y + 6, W, y + 6, 'l-ink');
      y += 18;
    }
    const nT = cats.reduce((a, cat) => a + cat.tasks.length, 0);
    const wsum = data.kinds[kind].weight;
    kindMark(g, kind, 0, y + 12, 11);
    text(g, 18, y + 16, kindName(kind), 'tb');
    text(g, 18 + measure(kindName(kind), 13, 700) + 12, y + 16, `${t('common.unit.tasksShort', { n: nT })} │ ${fmtPct(wsum)}`, 't2 tn');
    y += 30;
    for (const cat of cats) {
      catNo++;
      const cy = y + rowH / 2;
      text(g, 0, cy + 4.5, String(catNo).padStart(2, '0'), 't2 tn tb');
      icon(g, cat.key, 28, cy - 8, 16);
      const nm = pick(cat, 'name');
      const nmFit = measure(nm, 13, 700) <= X0 - 50 - 52 ? nm : pick(cat, 'short');
      text(g, 52, cy + 4.5, nmFit, 'tb');
      text(g, X0 - 14, cy + 4.5, t('common.unit.tasksShort', { n: cat.tasks.length }), 't2 tn', 'end');
      let x = X0;
      for (const task of cat.tasks) {
        const w = task.minutes * k;
        const a = g.append('a').attr('href', links.task(task)).attr('class', `f-cell is-${kind}`).datum(task);
        rect(a, x, y, w, rowH, kind === 'design' ? 'f-des' : 'f-std', true);
        const no = String(task.no).padStart(2, '0');
        const short = pick(task, 'short');
        const room = w - 16;
        text(a, x + 8, cy + 4.5, no, 'tn tb tof');
        const noW = measure(no, 13, 700) * 1.12 + 9;
        const nameW = measure(short, 13, 400);
        const mW = measure(String(task.minutes), 12.5, 400);
        if (noW + nameW <= room) text(a, x + 8 + noW, cy + 4.5, short, 'tof');
        else text(a, x + 8 + noW, cy + 4.5, ellipsis(short, room - noW), 'tof');
        if (noW + nameW + mW + 14 <= room) text(a, x + w - 8, cy + 4.5, String(task.minutes), 'tn tof tsoft', 'end');
        x += w + GAP;
      }
      y += step;
    }
  }
  // minute axis
  y += 4;
  line(g, X0, y, W, y, 'l-rule', false);
  for (let m = 0; m <= maxSum; m += 30) {
    const x = X0 + m * k;
    line(g, x, y, x, y + 5, 'l-ink2', false);
    text(g, x, y + 20, String(m), 't2 tn', m === 0 ? 'start' : 'middle');
  }
  text(g, X0 - 14, y + 20, t('about.fig.minutesAxis'), 't2', 'end');
  fig.size(y + 28);
  fig.mark(g.selectAll('a.f-cell'), (d) => taskParts(d), { label: (d) => taskParts(d).join('，') });
  return fig;
}

// ---------------------------------------------------------------------------
// 一道题怎么测: four steps on a violet line with star nodes; then the two
// kinds side by side; the last row is the weight total, big figure + cells.
export function howtoFigure({ data, c, vars }) {
  const fc = c.fig.howto;
  const fig = createFigure({ key: 'howto', title: fc.title, readout: [t('about.fig.howtoDefault', vars)] });
  const g = fig.g;
  // steps
  const colW = W / 4;
  line(g, 6, 44, W - 6, 44, 'l-orbit');
  let maxL = 0;
  fc.steps.forEach((s, i) => {
    const x = i * colW;
    text(g, x, 26, String(i + 1).padStart(2, '0'), 'tmid tn');
    star(g, x + 6, 44, 6.5, 'f-ink f-node');
    text(g, x, 76, s.title, 'tb tl');
    const ls = s.lines.flatMap((l) => wrap(l, colW - 16, 13));
    lines(g, x, 100, ls, 19, 't2');
    maxL = Math.max(maxL, ls.length);
  });
  let y = 100 + maxL * 19 + 14;
  line(g, 0, y, W, y, 'l-ink');
  // two columns
  const L = 0;
  const C1 = 112;
  const C2 = 424;
  const CW = 288;
  y += 30;
  for (const [x, kind] of [
    [C1, 'standard'],
    [C2, 'design'],
  ]) {
    kindMark(g, kind, x, y - 4, 11);
    text(g, x + 18, y, kindName(kind), 'tx tl');
    text(g, x + 18 + measure(kindName(kind), 15, 800) + 10, y, t('common.unit.tasksShort', { n: data.kinds[kind].tasks.length }), 't2 tn');
  }
  y += 14;
  const row = (label, draw) => {
    line(g, 0, y, W, y, 'l-rule', false);
    text(g, L, y + 22, label, 't2');
    const h1 = draw(C1, 'standard', y + 22);
    const h2 = draw(C2, 'design', y + 22);
    y += Math.max(h1, h2, 22) + 18;
  };
  // categories: icon + name, linked to the category board, flowing in the column
  row(fc.rows.cats, (x0, kind, yy) => {
    let x = x0;
    let ly = yy;
    for (const key of data.kinds[kind].categories) {
      const cat = data.category(key);
      const nm = pick(cat, 'name');
      const w = 20 + measure(nm, 13, 700) + 18;
      if (x > x0 && x + w > x0 + CW) {
        x = x0;
        ly += 24;
      }
      const a = g.append('a').attr('href', links.categories(key)).attr('class', 'f-catlink');
      icon(a, key, x, ly - 12, 15);
      text(a, x + 20, ly, nm, 'tb');
      x += w;
    }
    return ly - yy + 6;
  });
  const textRow = (label, key) =>
    row(label, (x0, kind, yy) => {
      const v = fc[kind === 'standard' ? 'std' : 'des'][key];
      const arr = Array.isArray(v) ? v : [v];
      let ly = yy;
      arr.forEach((s, i) => {
        const ls = wrap(s, CW, 13, i ? 400 : 600);
        lines(g, x0, ly, ls, 19, i ? 't2' : 'tm');
        ly += ls.length * 19;
      });
      return ly - yy - 13;
    });
  textRow(fc.rows.deliver, 'deliver');
  textRow(fc.rows.time, 'time');
  textRow(fc.rows.grader, 'grader');
  textRow(fc.rows.scoring, 'scoring');
  // weight total: big figure + 20 cells of 5%
  line(g, 0, y, W, y, 'l-rule', false);
  const yy = y + 34;
  text(g, L, yy - 6, fc.rows.weight, 't2');
  for (const [x0, kind] of [
    [C1, 'standard'],
    [C2, 'design'],
  ]) {
    const wsum = data.kinds[kind].weight;
    text(g, x0, yy, fmtPct(wsum), 'tbig tn');
    const cx = x0 + 92;
    const n = 20;
    const cw = (CW - 92) / n;
    for (let i = 0; i < n; i++) {
      const on = i < Math.round(wsum / 5);
      rect(g, cx + i * cw, yy - 18, cw - 3, 16, on ? (kind === 'design' ? 'f-des-mid' : 'f-std') : 'f-chip', on);
    }
  }
  fig.size(yy + 14);
  return fig;
}

// ---------------------------------------------------------------------------
// 权重条: 0–100% split into the 10 categories, thin seams to the tasks;
// category name + weight above, task number inside, task weight below,
// brackets for the two kinds, a tick scale at the bottom.
// opts: { href(category) -> link of a segment, onHot(task|null) }
export function weightsFigure({ data, c, vars }, { href = (key) => `#${key}`, onHot } = {}) {
  const fc = c.fig.weights;
  const fig = createFigure({ key: 'weights', title: fc.title, readout: [t('about.fig.weightsDefault', vars)] });
  const g = fig.g;
  const px = W / 100;
  const Y = 56;
  const H = 30;
  let x = 0;
  const cells = new Map();
  for (const cat of data.categories) {
    const cw = cat.weight * px;
    // label: icon + short name if it fits, else the name alone
    const nm = pick(cat, 'short');
    const withIcon = measure(nm, 13, 700) + 22 <= cw - 4;
    if (withIcon) icon(g, cat.key, x + 2, 2, 15);
    const nmFit = measure(nm, 13, 700) <= cw - 6 ? nm : '';
    if (nmFit) text(g, x + (withIcon ? 22 : 2), 14, nmFit, 'tb');
    else icon(g, cat.key, x + 2, 2, 15);
    text(g, x + 2, 44, fmtPct(cat.weight), 'tw tn');
    // category boundary tick
    line(g, x, Y - 8, x, Y + H + 8, 'l-ink', false);
    let tx = x;
    for (const task of cat.tasks) {
      const tw = task.weight * px;
      const a = g.append('a').attr('href', href(cat.key)).attr('class', `f-cell is-${task.kind}`).datum(task);
      const r = rect(a, tx + 0.5, Y, tw - 1, H, task.kind === 'design' ? 'f-des' : 'f-std', true);
      cells.set(task.key, r.node());
      text(a, tx + tw / 2, Y + H / 2 + 4.5, String(task.no).padStart(2, '0'), 'tn tb tof', 'middle');
      text(g, tx + tw / 2, Y + H + 20, fmtPct(task.weight), 't2 tn', 'middle');
      tx += tw;
    }
    x += cw;
  }
  line(g, W, Y - 8, W, Y + H + 8, 'l-ink', false);
  // brackets for the two kinds
  let bx = 0;
  const by = Y + H + 34;
  for (const kind of ['standard', 'design']) {
    const ks = data.kinds[kind];
    if (!ks.categories.length) continue;
    const bw = ks.weight * px;
    bracket(g, bx + 2, bx + bw - 2, by, -1, 'l-ink');
    text(g, bx + bw / 2, by + 20, `${kindName(kind)} ${fmtPct(ks.weight)}`, 'tb', 'middle');
    bx += bw;
  }
  // tick scale
  const ty = by + 36;
  line(g, 0, ty, W, ty, 'l-rule', false);
  for (let p = 0; p <= 100; p += 10) {
    line(g, p * px, ty, p * px, ty + 5, 'l-ink2', false);
    text(g, p * px, ty + 20, p === 100 ? '100%' : String(p), 't2 tn', p === 0 ? 'start' : p === 100 ? 'end' : 'middle');
  }
  fig.size(ty + 26);
  const parts = (task) => [`${fmtNo(task.no)} ${pick(task, 'name')}`, pick(data.category(task.category), 'name'), t('about.fig.weight', { w: fmtPct(task.weight) }), t('about.fig.limit', { n: task.minutes })];
  fig.mark(g.selectAll('a.f-cell'), parts, { onHot: (task, on) => onHot?.(on ? task : null) });
  /** From outside (the overview table): the task's cell turns solid violet. */
  fig.highlight = (key) => {
    for (const [k, node] of cells) node.classList.toggle('is-linked', k === key);
  };
  return fig;
}

export { kindName, minutes };
