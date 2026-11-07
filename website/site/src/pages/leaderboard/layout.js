// Shared geometry: the fixed 0–100 scale of the plot column and the equal
// columns of the matrix (and of the breakdown legend, which uses the same
// columns so the two views line up).
import * as d3 from '../../charts/d3.js';

/** Room kept right of 100 for end labels and the best star (px). */
export const PAD_R = 40;
/** Bar thickness in a model row (px). */
export const BAR_H = 20;
/** Height of the axis bar (px), the same in every view so nothing jumps. */
export const AXIS_H = 54;

/** Room right of 100 for a plot W px wide: PAD_R, less in a narrow (phone width) plot. */
export const padR = (W) => (W < 240 ? Math.max(14, Math.round(W * 0.14)) : PAD_R);

/** The fixed scale: 0–100 onto the plot cell (never rescaled to the data). */
export const scaleX = (W) =>
  d3
    .scaleLinear()
    .domain([0, 100])
    .range([0, Math.max(10, W - padR(W))])
    .clamp(true);

/**
 * Equal columns across the whole plot width.
 *   mode 'category': one per category, 2px apart.
 *   mode 'task': one per task, 2px apart inside a category, 6px between categories.
 * Returns [{ key, x, w, cat, kind, task?, first, last }]
 */
export function columns(data, mode, W) {
  if (mode === 'task') {
    const gapIn = 2;
    const gapCat = 6;
    const n = data.tasks.length;
    const cats = data.categories.filter((c) => c.tasks.length);
    const gaps = (n - cats.length) * gapIn + (cats.length - 1) * gapCat;
    const w = Math.max(4, (W - gaps) / n);
    const out = [];
    let x = 0;
    cats.forEach((c, ci) => {
      if (ci) x += gapCat - gapIn;
      c.tasks.forEach((t, ti) => {
        out.push({ key: t.key, x, w, cat: c.key, kind: c.kind, task: t, first: ti === 0, last: ti === c.tasks.length - 1 });
        x += w + gapIn;
      });
    });
    return out;
  }
  const gap = 2;
  const n = data.categories.length;
  const w = Math.max(4, (W - gap * (n - 1)) / n);
  return data.categories.map((c, i) => ({ key: c.key, x: i * (w + gap), w, cat: c.key, kind: c.kind, first: true, last: true }));
}

/** Spans of consecutive columns of the same kind: [{ kind, x0, x1, keys }] */
export function kindSpans(data, cols) {
  const out = [];
  for (const col of cols) {
    const last = out[out.length - 1];
    if (last && last.kind === col.kind) {
      last.x1 = col.x + col.w;
      last.cats.add(col.cat);
    } else out.push({ kind: col.kind, x0: col.x, x1: col.x + col.w, cats: new Set([col.cat]) });
  }
  return out;
}

/** Spans of the columns of each category (task mode): [{ cat, x0, x1 }] */
export function catSpans(cols) {
  const out = [];
  for (const col of cols) {
    const last = out[out.length - 1];
    if (last && last.cat === col.cat) last.x1 = col.x + col.w;
    else out.push({ cat: col.cat, x0: col.x, x1: col.x + col.w });
  }
  return out;
}

/** Shorten an SVG <text> with an ellipsis until it fits maxW px. */
export function fitText(textEl, full, maxW) {
  textEl.textContent = full;
  if (maxW <= 0) {
    textEl.textContent = '';
    return false;
  }
  if (textEl.getComputedTextLength() <= maxW) return true;
  let s = full;
  while (s.length > 1) {
    s = s.slice(0, -1);
    textEl.textContent = `${s.trimEnd()}…`;
    if (textEl.getComputedTextLength() <= maxW) return false;
  }
  textEl.textContent = '';
  return false;
}
