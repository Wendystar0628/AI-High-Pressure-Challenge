// The axis bar above the rows (sticky with the toolbar). It sits in the plot
// column of a header row, so its scale lines up with every row:
//   total / kinds / compare: 0 … 100 and the pass line label
//   pass:   −60 … +40 (0 at 60), "及格 4 │ 未及格 3" at the right end
//   total / pass sorted by test cost: ¥0 … ¥top (layout.js costTop), no pass line
//   parts:  the legend (two kind groups, 10 categories with weights), hover = focus
//   matrix: the column heads (category icon, name, weight; or task numbers)
// Groups whose content kind changes are wiped in again (stage 1 of a switch).
import { svg as svgEl, t, pick, fmtPct, links, iconURL, inlineSVG, round1 } from '../../core/index.js';
import { starPath, fill } from '../../charts/index.js';
import { attachTip, hideTip } from '../../ui/index.js';
import { dur, css, reduced } from '../../motion.js';
import { scaleX, columns, kindSpans, catSpans, fitText, costTop, AXIS_H } from './layout.js';
import { PASS, isCostSort } from './model.js';

const NS = 'http://www.w3.org/2000/svg';
const Y1 = 9; // kind bands
const Y2 = 28; // names / pass label
const Y3 = AXIS_H - 9; // weights / ticks

export function createAxis({ data, state, computed, onFocus }) {
  const svg = svgEl('svg', { class: 'lb-axis', height: AXIS_H, role: 'presentation' });
  const groups = {};
  for (const k of ['ticks', 'passlabel', 'right', 'cols']) groups[k] = svg.appendChild(svgEl('g', { class: `ax-${k}` }));
  groups.ticks.setAttribute('aria-hidden', 'true');
  groups.passlabel.setAttribute('aria-hidden', 'true');
  groups.right.setAttribute('aria-hidden', 'true');
  const sig = {};
  let W = 0;
  let token = 0;

  const text = (parent, attrs, str) => {
    const el = svgEl('text', { 'dominant-baseline': 'central', ...attrs });
    el.textContent = str;
    parent.append(el);
    return el;
  };

  function signature(view) {
    const cost = (view === 'total' || view === 'pass') && isCostSort(state.sort);
    return {
      ticks: cost ? 'cost' : view === 'pass' ? 'pass' : view === 'total' || view === 'kinds' || view === 'compare' ? 'pct' : '',
      passlabel: !cost && (view === 'total' || view === 'pass' || view === 'kinds' || view === 'compare') ? 'on' : '',
      right: view === 'pass' && !cost ? 'pass' : view === 'kinds' ? 'kinds' : '',
      cols: view === 'parts' ? 'legend' : view === 'matrix' ? `matrix-${state.cols}` : '',
    };
  }

  function drawTicks(g, kind, x) {
    g.replaceChildren();
    if (!kind) return;
    // a narrow plot (phone width) keeps 0, the pass line and 100
    const narrow = x(100) - x(0) < 170;
    // by test cost the same six positions carry round amounts (the ¥ scale ends at costTop)
    const top = kind === 'cost' ? costTop(computed().costMax) : 0;
    const yuan = (v) => `¥${+((top * v) / 100).toFixed(2)}`;
    for (const v of narrow ? [0, 60, 100] : [0, 20, 40, 60, 80, 100]) {
      const label = kind === 'cost' ? yuan(v) : kind === 'pass' ? (v === PASS ? '0' : v > PASS ? `+${v - PASS}` : `−${PASS - v}`) : String(v);
      text(g, { class: `tick-label${v === PASS && kind !== 'cost' ? ' is-pass' : ''}`, x: x(v), y: Y3, 'text-anchor': v === 0 ? 'start' : 'middle' }, label);
    }
  }

  function drawPassLabel(g, on, x) {
    g.replaceChildren();
    if (!on) return;
  }

  function drawRight(g, kind) {
    g.replaceChildren();
    if (!kind) return;
    if (kind === 'pass') {
      const { yes, no } = computed().pass;
      text(g, { class: 'ax-right-t', x: W, y: Y1 + 1, 'text-anchor': 'end' }, t('leaderboard.axis.passCount', { a: yes, b: no }));
      return;
    }
    // kinds legend, laid out from the right edge
    let at = W;
    const item = (label, mark) => {
      const tx = text(g, { class: 'ax-right-t', x: at, y: Y1 + 1, 'text-anchor': 'end' }, label);
      at -= tx.getComputedTextLength() + 6;
      if (mark === 'sq') g.append(svgEl('rect', { class: 'ax-sq', x: at - 9, y: Y1 + 1 - 4.5, width: 9, height: 9 }));
      else g.append(svgEl('path', { class: 'ax-ds', d: starPath(at - 5, Y1 + 1, 6.5, 0.36) }));
      at -= 9 + 16;
    };
    item(t('common.kind.design'), 'star');
    item(t('common.kind.standard'), 'sq');
  }

  function drawCols(g, kind, my) {
    g.replaceChildren();
    if (!kind) return;
    const legend = kind === 'legend';
    const mode = legend ? 'category' : state.cols;
    const cols = columns(data, mode, W);
    const weights = legend ? computed().weights : Object.fromEntries(data.categories.map((c) => [c.key, c.weight]));
    // kind bands with their total weight
    for (const sp of kindSpans(data, cols)) {
      const w = [...sp.cats].reduce((a, k) => a + weights[k], 0);
      g.append(svgEl('rect', { class: `ax-band is-${sp.kind}`, x: sp.x0, y: Y1 - 8, width: sp.x1 - sp.x0, height: 16 }));
      const lab = text(g, { class: 'ax-band-t', x: sp.x0 + 6, y: Y1 }, '');
      fitText(lab, `${t(`common.kind.${sp.kind}`)} ${+round1(w).toFixed(1)}`, sp.x1 - sp.x0 - 10);
    }
    const linkTo = (href, label) => {
      const a = document.createElementNS(NS, 'a');
      a.setAttribute('href', href);
      a.setAttribute('class', 'ax-link');
      if (label) a.setAttribute('aria-label', label);
      g.append(a);
      return a;
    };
    if (mode === 'category') {
      for (const col of cols) {
        const c = data.category(col.key);
        const name = pick(c, 'short') || pick(c, 'name');
        const a = linkTo(links.categories(c.key), `${pick(c, 'name')} ${fmtPct(weights[c.key])}`);
        a.dataset.cat = c.key;
        a.append(svgEl('rect', { class: 'ax-hit', x: col.x, y: Y2 - 9, width: col.w, height: AXIS_H - Y2 + 9 }));
        // swatch (legend) or icon (matrix) before the name; narrow columns first
        // set the name a little smaller, then drop the icon, and only then cut the name
        let lead = legend ? 12 : 14;
        const tx = text(a, { class: 'ax-name', x: 0, y: Y2 }, '');
        let fits = fitText(tx, name, col.w - lead - 2);
        if (!fits) {
          tx.classList.add('is-tight');
          fits = fitText(tx, name, col.w - lead - 2);
        }
        let icon = true;
        if (!fits && !legend) {
          icon = false;
          lead = 0;
          fitText(tx, name, col.w - 2);
        }
        const tw = tx.getComputedTextLength();
        const x0 = col.x + Math.max(1, (col.w - (tw + lead)) / 2);
        tx.setAttribute('x', x0 + lead);
        if (!icon) {
          // the name alone
        } else if (legend) {
          const sw = svgEl('rect', { class: 'ax-swatch', x: x0, y: Y2 - 4.5, width: 9, height: 9 });
          sw.style.setProperty('--sw', fill.category(c.key));
          if (c.kind === 'standard') sw.classList.add('has-edge');
          a.prepend(sw);
        } else {
          const at = { x: x0 - 1, y: Y2 - 6, size: 11, className: 'ax-icon' };
          inlineSVG(a, iconURL.category(c.key), at).then((el) => {
            if (my !== token) el.remove();
          });
        }
        const wt = text(a, { class: 'ax-weight', x: col.x + col.w / 2, y: Y3, 'text-anchor': 'middle' }, fmtPct(weights[c.key]));
        // a column narrower than its weight (phone width) leaves it to the tooltip
        if (wt.getComputedTextLength() > col.w - 2) wt.textContent = '';
        attachTip(a, () => `${pick(c, 'name')} ${fmtPct(weights[c.key])}`);
        if (legend) {
          a.addEventListener('pointerenter', () => onFocus?.(c.key));
          a.addEventListener('pointerleave', () => onFocus?.(null));
          a.addEventListener('focus', () => onFocus?.(c.key));
          a.addEventListener('blur', () => onFocus?.(null));
        }
      }
      return;
    }
    // task columns: category over its tasks, the task numbers below
    for (const sp of catSpans(cols)) {
      const c = data.category(sp.cat);
      const a = linkTo(links.categories(c.key), pick(c, 'name'));
      const w = sp.x1 - sp.x0;
      a.append(svgEl('rect', { class: 'ax-hit', x: sp.x0, y: Y2 - 9, width: w, height: 18 }));
      const tx = text(a, { class: 'ax-name', x: 0, y: Y2 }, '');
      const fits = fitText(tx, pick(c, 'short') || pick(c, 'name'), w - 17) && w - 17 > 18;
      if (!fits) tx.textContent = '';
      const tw = fits ? tx.getComputedTextLength() : 0;
      const x0 = sp.x0 + (w - (tw + (fits ? 14 : 11))) / 2;
      tx.setAttribute('x', x0 + 14);
      inlineSVG(a, iconURL.category(c.key), { x: x0, y: Y2 - 6, size: 11, className: 'ax-icon' }).then((el) => {
        if (my !== token) el.remove();
      });
      attachTip(a, () => pick(c, 'name'));
    }
    for (const col of cols) {
      const task = col.task;
      const a = linkTo(links.task(task), `${String(task.no).padStart(2, '0')} ${pick(task, 'name')}`);
      a.append(svgEl('rect', { class: 'ax-hit', x: col.x, y: Y3 - 9, width: col.w, height: 18 }));
      const no = text(a, { class: 'ax-no', x: col.x + col.w / 2, y: Y3, 'text-anchor': 'middle' }, String(task.no).padStart(2, '0'));
      if (no.getComputedTextLength() > col.w) no.textContent = '';
      attachTip(a, () => `${String(task.no).padStart(2, '0')} ${pick(task, 'name')}`);
    }
  }

  function wipe(g, delay = 0) {
    if (reduced() || !g.animate) return;
    g.animate([{ clipPath: 'inset(-20px 100% -20px -20px)' }, { clipPath: 'inset(-20px -40px -20px -20px)' }], { duration: dur('wipe'), delay, easing: css.mech, fill: 'backwards' });
  }

  /** Draw the bar for a view; animate wipes the groups that change kind. */
  function render(view, { animate = false } = {}) {
    if (!W) return;
    const my = ++token;
    hideTip();
    const x = scaleX(W);
    svg.setAttribute('width', W);
    svg.setAttribute('viewBox', `0 0 ${W} ${AXIS_H}`);
    svg.dataset.view = view;
    const next = signature(view);
    const changed = Object.keys(next).filter((k) => next[k] !== sig[k]);
    drawTicks(groups.ticks, next.ticks, x);
    drawPassLabel(groups.passlabel, next.passlabel, x);
    drawRight(groups.right, next.right);
    drawCols(groups.cols, next.cols, my);
    if (animate) changed.forEach((k, i) => next[k] && wipe(groups[k], i * 40));
    Object.assign(sig, next);
    return changed.length > 0;
  }

  return {
    svg,
    render,
    setWidth(w) {
      W = w;
    },
  };
}
