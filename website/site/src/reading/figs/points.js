// FIG 分值条 (03, each design category; reused on design task pages):
// one 100-point bar per task, split by scoring direction (violet, deep to
// light), point value above each segment, one small cell per sub-item below.
import { t, pick } from '../../core/index.js';
import { createFigure, d3, W, text, line, rect, measure, violetShade } from './common.js';

/** Totals of a directions list: { dirs, items, points } */
export function dirStats(dirs = []) {
  return { dirs: dirs.length, items: dirs.reduce((a, d) => a + d[2].length, 0), points: dirs.reduce((a, d) => a + d[1], 0) };
}

/**
 * pointsFigure(ctx, category, { tasks: [task keys], onHot(taskKey, dirIndex|null) })
 * Directions come from content tasks.items[taskKey].directions: [[name, points, [[item, points], …]], …]
 */
export function pointsFigure({ data, c }, category, { tasks, onHot } = {}) {
  const cat = data.category(category);
  const list = (tasks ?? cat.tasks.map((x) => x.key)).map((k) => data.task(k)).filter(Boolean);
  const title = t('about.fig.pointsTitle', { name: pick(cat, 'name') });
  const fig = createFigure({ key: category, title, readout: [t('about.fig.pointsDefault')] });
  const g = fig.g;
  const px = W / 100;
  let y = 0;
  for (const task of list) {
    const dirs = c.tasks?.items?.[task.key]?.directions ?? [];
    const st = dirStats(dirs);
    const tg = g.append('g').attr('class', 'f-ptask');
    text(tg, 0, y + 16, pick(task, 'name'), 'tx tl');
    text(tg, W, y + 16, t('about.fig.pointsFacts', st), 't2 tn', 'end');
    const by = y + 58;
    let x = 0;
    const segs = tg
      .append('g')
      .selectAll('g')
      .data(dirs.map((d, i) => ({ d, i, x0: 0 })))
      .join('g')
      .attr('class', 'f-seg');
    segs.each(function (s) {
      const sg = d3.select(this);
      const [name, pts, items] = s.d;
      const w = pts * px;
      s.x0 = x;
      const fillC = violetShade(s.i, dirs.length);
      const big = String(pts);
      const size = measure(big, 22, 800) + 4 <= w ? 'tw' : 'tm tb';
      text(sg, x + 2, by - 10, big, `${size} tn`);
      rect(sg, x, by, w - 1.5, 28, 'f-seg-bar', true).style('fill', fillC);
      // one cell per sub-item, width by its points
      let ix = x;
      for (const [, ip] of items) {
        const iw = ip * px;
        rect(sg, ix, by + 32, iw - 1.5, 9, 'f-seg-item').style('fill', fillC);
        ix += iw;
      }
      if (measure(name, 13) <= w - 6) text(sg, x + 2, by + 60, name, 't2');
      rect(sg, x, by - 30, w - 1.5, 96, 'f-hit');
      x += w;
    });
    const parts = (s) => [`${s.d[0]} ${t('about.fig.points', { v: s.d[1] })}`, ...s.d[2].map(([n, p]) => `${n} ${p}`)];
    fig.mark(segs, parts, { onHot: (s, on) => onHot?.(task.key, on ? s.i : null) });
    y = by + 78;
  }
  fig.size(y - 6);
  return fig;
}
