// The plot cell of every model row. One SVG per row keeps the same elements
// in every view, so a model is the same object before and after a switch:
//   8 segment rects  total: one contiguous bar │ pass: a bar from 60 │
//                    parts: the 8 contributions with seams │ kinds: the thin
//                    link between the two markers │ matrix: faded out
//   kinds markers, the pass difference label, matrix cells, hatch, best star.
// Geometry is tweened by D3 (named transition "lb", interruptible); colours
// come from CSS keyed on data-look / data-grid, switched at stage times.
import * as d3 from '../../charts/d3.js';
import { svg as svgEl, t, pick, fmtScore, fmtDiff, fmtPct, fmtRankOf, round1, modelLabel, rankOf, progress } from '../../core/index.js';
import { fill, needsEdge, starPath, CATEGORY_VAR, resolve, stepFill, stepInk } from '../../charts/index.js';
import { dur, durIn, ease, stagger, isInView, reduced } from '../../motion.js';
import { scramble } from '../../vendor/stellar/fx.js';
import { scaleX, columns, BAR_H } from './layout.js';
import { PASS, isTop } from './model.js';

const ROW_VIEWS = new Set(['total', 'pass', 'parts', 'kinds', 'matrix']);
const TICKS_OF = { total: 'pct', kinds: 'pct', compare: 'pct', pass: 'pass', parts: 'legend', matrix: 'matrix' };

/** Does a switch between these two views change the axis bar? */
export const axisChanges = (a, b) => TICKS_OF[a] !== TICKS_OF[b] || a === 'pass' || b === 'pass' || a === 'kinds' || b === 'kinds';

// --- colour helpers: text on a category colour must stay readable --------
const lum = (str) => {
  const s = String(str).trim();
  let r;
  let g;
  let b;
  const hex = /^#([0-9a-f]{6})$/i.exec(s);
  if (hex) [r, g, b] = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  else {
    const m = /rgba?\(([^)]+)\)/.exec(s);
    if (!m) return 1;
    [r, g, b] = m[1].split(/[ ,/]+/).map(Number);
  }
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const onColour = (key) => (lum(resolve(CATEGORY_VAR[key] ?? '--series')) > 0.3 ? 'var(--st-on-flare)' : '#ffffff');

export function createRows({ data, state, computed, list }) {
  let W = 0; // plot cell width (px)
  let H = 44; // plot cell height (px)
  let x = scaleX(0);
  let seq = 0;
  let entered = false;
  let focusCat = null;
  const timers = new WeakMap();
  const cats = data.categories;

  const C = () => computed();
  const rowsEls = () => [...list.rows.values()];

  // ---- per-row scheduling (stage 3 changes); cleared by the next draw ----
  function later(li, ms, fn) {
    if (!timers.has(li)) timers.set(li, new Set());
    if (ms <= 0) return fn();
    const id = setTimeout(() => {
      timers.get(li)?.delete(id);
      fn();
    }, ms);
    timers.get(li).add(id);
  }
  function clearLater(li) {
    const set = timers.get(li);
    if (set) for (const id of set) clearTimeout(id);
    set?.clear();
  }

  // ---- building ----
  const g = (parent, cls) => parent.appendChild(svgEl('g', { class: cls }));
  const label = (parent, cls) => {
    const gg = g(parent, `lb-lab ${cls}`);
    gg.append(svgEl('rect', { class: 'lb-lab-bg', rx: 0 }), svgEl('text', { class: 'lb-lab-t', 'dominant-baseline': 'central' }));
    gg.setAttribute('opacity', 0);
    return gg;
  };

  function build(cell) {
    const id = `lbh${++seq}`;
    const s = svgEl('svg', { class: 'lb-svg', 'aria-hidden': 'true', focusable: 'false' });
    s.innerHTML = `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.5" height="6" class="lb-hatch-line"/></pattern></defs>`;
    s.dataset.hatch = id;
    const grid = g(s, 'lb-grid');
    grid.append(svgEl('rect', { class: 'lb-band' }));
    for (const v of [20, 40, 80]) grid.append(svgEl('line', { class: 'lb-gl', 'data-v': v }));
    grid.append(svgEl('line', { class: 'lb-pass' }));
    // everything that is data sits in one group, so a row can step back as a whole
    const layer = g(s, 'lb-data');
    const pend = g(layer, 'lb-pend');
    pend.append(svgEl('rect', { class: 'lb-hatch', fill: `url(#${id})` }));
    label(pend, 'lb-note');
    const bars = g(layer, 'lb-bars');
    cats.forEach((c, i) => {
      const r = svgEl('rect', { class: 'lb-seg', 'data-cat': c.key, 'data-tip': `seg:${c.key}`, x: 0, y: 0, width: 0, height: 0 });
      r.style.setProperty('--i', i);
      r.style.setProperty('--seg-c', fill.category(c.key));
      r.style.setProperty('--seg-edge', needsEdge(c.key) ? 'var(--lime-edge)' : 'none');
      bars.append(r);
    });
    layer.append(svgEl('line', { class: 'lb-gedge', opacity: 0 }));
    // 0 points: the shared zero-length mark (charts.css .bar-zero)
    layer.append(svgEl('line', { class: 'bar-zero', display: 'none' }));
    const kinds = g(layer, 'lb-kinds');
    kinds.append(svgEl('rect', { class: 'lb-sq', width: 10, height: 10, opacity: 0 }), svgEl('path', { class: 'lb-ds', d: starPath(0, 0, 7.5, 0.36), opacity: 0 }));
    label(kinds, 'lb-ks');
    label(kinds, 'lb-kd');
    g(layer, 'lb-cells');
    layer.append(svgEl('path', { class: 'lb-best best-star', d: starPath(0, 0, 7.5, 0.36), opacity: 0 }));
    label(layer, 'lb-dl');
    label(layer, 'lb-sv');
    layer.append(svgEl('path', { class: 'lb-cstar best-star', d: starPath(0, 0, 5.5, 0.36), opacity: 0 }));
    cell.replaceChildren(s);
    return s;
  }

  // ---- geometry targets for one row in one view ----
  function target(info, view, li) {
    const v = info.total;
    const mid = H / 2;
    const by = mid - BAR_H / 2;
    const cs = cats.map((c) => info.contrib[c.key] ?? 0);
    const csum = cs.reduce((a, b) => a + b, 0);
    const k = v != null && csum > 0 ? v / csum : 0;
    let cum = 0;
    const base = cs.map((c) => {
      const a = cum;
      cum += c * k;
      return [a, cum];
    });
    // contiguous same-colour segments overlap a little so no hairline seam shows between them
    const lastOn = base.reduce((acc, [a, b], i) => (b - a > 0 ? i : acc), -1);
    const joined = (i, w) => (i < lastOn && w > 0 ? w + 0.75 : w);
    const T = { segs: [], best: null, pend: false, kinds: null, dl: null, gedge: null };
    const zero = (at, h = BAR_H, y = by) => cats.map(() => ({ x: at, w: 0, y, h, o: 0 }));
    switch (view) {
      case 'pass': {
        if (v == null) {
          T.segs = zero(x(PASS));
          T.pend = true;
          break;
        }
        let x0 = x(Math.min(PASS, v));
        let x1 = x(Math.max(PASS, v));
        if (x1 - x0 < 2) {
          if (v >= PASS) x1 = x0 + 2;
          else x0 = x1 - 2;
        }
        T.segs = cats.map((c, i) => (i === 0 ? { x: x0, w: x1 - x0, y: by, h: BAR_H, o: 1 } : { x: v >= PASS ? x1 : x0, w: 0, y: by, h: BAR_H, o: 1 }));
        const top = isTop(v, C().best.total) && info.status === 'ranked';
        const up = v >= PASS;
        const end = up ? x1 : x0;
        if (top) T.best = { x: end + (up ? 9 : -9), y: mid };
        T.dl = { x: end + (up ? 1 : -1) * (top ? 19 : 5), anchor: up ? 'start' : 'end', text: fmtDiff(round1(v) - PASS) };
        break;
      }
      case 'kinds': {
        const { std, des } = info;
        const ch = li?.classList.contains('is-checked') ? 2.5 : 1;
        if (std == null && des == null) {
          T.segs = zero(0);
          T.pend = true;
          break;
        }
        const lo = Math.min(std ?? des, des ?? std);
        const hi = Math.max(std ?? des, des ?? std);
        T.segs = cats.map((c, i) => (i === 0 ? { x: x(lo), w: x(hi) - x(lo), y: mid - ch / 2, h: ch, o: std != null && des != null ? 1 : 0 } : { x: x(hi), w: 0, y: mid - ch / 2, h: ch, o: 1 }));
        const best = C().best;
        const ranked = info.status === 'ranked';
        const sLeft = std != null && des != null ? std <= des : false;
        T.kinds = {
          sq: std == null ? null : { x: x(std), y: mid },
          ds: des == null ? null : { x: x(des), y: mid },
          ls: std == null ? null : { x: x(std) + (sLeft ? -10 : 10), anchor: sLeft ? 'end' : 'start', text: fmtScore(std), best: ranked && isTop(std, best.std) },
          ld: des == null ? null : { x: x(des) + (sLeft || std == null ? 12 : -12), anchor: sLeft || std == null ? 'start' : 'end', text: fmtScore(des), best: ranked && isTop(des, best.des) },
        };
        break;
      }
      case 'parts':
        if (v == null) {
          T.segs = zero(0);
          T.pend = true;
          break;
        }
        T.segs = base.map(([a, b], i) => {
          const w = x(b) - x(a);
          return { x: x(a), w: Math.max(0, w > 2 ? w - 1 : w), y: by, h: BAR_H, o: info.contrib[cats[i].key] == null || w <= 0.2 ? 0 : 1 };
        });
        {
          // the ink line between the two kinds of tasks
          const iLast = cats.reduce((acc, c, i) => (c.kind === cats[0].kind ? i : acc), 0);
          const edgeAt = iLast < cats.length - 1 ? x(base[iLast][1]) - 0.5 : null;
          if (edgeAt != null) T.gedge = { x: edgeAt, y1: by - 3, y2: by + BAR_H + 3 };
        }
        if (isTop(v, C().best.total) && info.status === 'ranked') T.best = { x: x(v) + 9, y: mid };
        break;
      case 'matrix':
        T.segs = base.map(([a, b], i) => ({ x: x(a), w: joined(i, x(b) - x(a)), y: by, h: BAR_H, o: 0 }));
        break;
      default:
        // total
        if (v == null) {
          T.segs = zero(0);
          T.pend = true;
          break;
        }
        T.segs = base.map(([a, b], i) => ({ x: x(a), w: joined(i, x(b) - x(a)), y: by, h: BAR_H, o: 1 }));
        if (isTop(v, C().best.total) && info.status === 'ranked') T.best = { x: x(v) + 9, y: mid };
    }
    return T;
  }

  // ---- small helpers ----
  const run = (sel, delay, duration, e = ease.mech) => {
    sel.interrupt('lb');
    return duration > 0 || delay > 0 ? sel.transition('lb').delay(delay).duration(duration).ease(e) : sel;
  };

  function setLabel(gg, { x: lx, y, text, anchor = 'start', best = false }) {
    const tx = gg.querySelector('text');
    const changed = tx.textContent !== text;
    tx.textContent = text;
    tx.setAttribute('x', lx);
    tx.setAttribute('y', y);
    tx.setAttribute('text-anchor', anchor);
    const w = text ? tx.getComputedTextLength() : 0;
    const left = anchor === 'end' ? lx - w : anchor === 'middle' ? lx - w / 2 : lx;
    const bg = gg.querySelector('rect');
    bg.setAttribute('x', left - 3);
    bg.setAttribute('y', y - 8);
    bg.setAttribute('width', w ? w + 6 : 0);
    bg.setAttribute('height', 16);
    gg.classList.toggle('is-best', !!best);
    return changed;
  }

  const show = (el, on, delay, duration) => run(d3.select(el), delay, duration, on ? ease.snap : ease.mech).attr('opacity', on ? 1 : 0);

  // ---- matrix cells ----
  function cellValue(info, col) {
    return col.task ? info.tasks[col.key] : info.cats[col.key];
  }

  function syncCells(svg, info) {
    const gCells = svg.querySelector('.lb-cells');
    const cols = columns(data, state.cols, W);
    const best = C().best;
    const key = `${state.cols}:${Math.round(W)}`;
    const rebuilt = gCells.dataset.key !== key;
    if (rebuilt) {
      gCells.replaceChildren();
      gCells.dataset.key = key;
    }
    cols.forEach((col, i) => {
      let cg = gCells.children[i];
      if (!cg) {
        cg = gCells.appendChild(svgEl('g', { class: 'lb-cell', 'data-tip': `cell:${col.key}` }));
        cg.append(svgEl('rect', { class: 'lb-cell-base' }), svgEl('rect', { class: 'lb-cell-bg', width: 0 }), svgEl('text', { class: 'lb-cell-t', 'dominant-baseline': 'central', 'text-anchor': 'middle', opacity: 0 }), svgEl('path', { class: 'lb-cell-star best-star', opacity: 0 }));
      }
      const v = cellValue(info, col);
      const top = info.status === 'ranked' && isTop(v, col.task ? best.task[col.key] : best.cat[col.key]);
      cg.dataset.key = col.key;
      cg.classList.toggle('is-best', top);
      cg.classList.toggle('is-none', v == null);
      const y = 3;
      const hh = H - 6;
      const [base, bg, tx, star] = cg.children;
      for (const r of [base, bg]) {
        r.setAttribute('x', col.x);
        r.setAttribute('y', y);
        r.setAttribute('height', hh);
      }
      base.setAttribute('width', col.w);
      // five sequential steps (charts/colors.js stepFill; both themes from tokens.css)
      bg.style.fill = v == null ? `url(#${svg.dataset.hatch})` : stepFill(col.kind, v);
      tx.style.fill = stepInk(v);
      cg.dataset.kind = col.kind;
      tx.setAttribute('x', col.x + col.w / 2);
      tx.setAttribute('y', y + hh / 2);
      tx.textContent = v == null ? '' : fmtScore(v);
      star.setAttribute('d', top ? starPath(col.x + col.w - 7, y + 7, 5.5, 0.36) : '');
    });
    return { cols, rebuilt };
  }

  // ---- drawing one row ----
  /**
   * mode: 'static' (jump), 'drag' (follow the slider), 'update' (morph to new values),
   *       'enter' (first draw: bars grow from 0), 'switch' (view change, three stages)
   */
  function draw(li, { mode = 'static', from = null, delay = 0 } = {}) {
    const svg = li.querySelector('svg.lb-svg');
    const info = C().info.get(li.dataset.id);
    if (!svg || !info || !W) return;
    let view = state.view;
    if (!ROW_VIEWS.has(view)) view = ROW_VIEWS.has(from) ? from : svg.dataset.view || 'total';
    clearLater(li);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.dataset.view = view;
    const anim = (mode === 'enter' || mode === 'switch' || mode === 'update') && !reduced() && isInView(li);
    const D = anim ? dur('morph') : 0;
    const half = D / 2;
    const out = anim ? Math.round(D * 0.66) : 0;
    let s2 = 0;
    let s3 = 0;
    let dShape = D;
    if (anim && mode === 'switch') {
      s2 = axisChanges(from, view) ? half : 0;
      s3 = s2 + half;
    } else if (anim && mode === 'enter') {
      dShape = durIn('power');
      s2 = delay;
      s3 = delay + dShape * 0.75;
    } else if (anim) s3 = half;

    const T = target(info, view, li);
    const v = info.total;
    svg.classList.toggle('is-below', v != null && round1(v) < PASS);
    svg.classList.toggle('is-checked', li.classList.contains('is-checked'));

    // grid: 60 becomes the solid cyan base line in the pass view (stage 1)
    const passX = x(PASS);
    for (const ln of svg.querySelectorAll('.lb-gl')) {
      const gx = x(+ln.dataset.v);
      ln.setAttribute('x1', gx);
      ln.setAttribute('x2', gx);
      ln.setAttribute('y1', 0);
      ln.setAttribute('y2', H);
    }
    const pl = svg.querySelector('.lb-pass');
    pl.setAttribute('x1', passX);
    pl.setAttribute('x2', passX);
    pl.setAttribute('y1', 0);
    pl.setAttribute('y2', H);
    const band = svg.querySelector('.lb-band');
    band.setAttribute('x', passX - 6);
    band.setAttribute('width', 12);
    band.setAttribute('y', 0);
    band.setAttribute('height', H);
    svg.dataset.grid = view === 'pass' ? 'pass' : view === 'matrix' ? 'none' : 'base';

    // colours: back to the plain bar first, the new look in stage 3
    if (mode === 'switch' && from !== view) {
      svg.dataset.look = 'base';
      later(li, s3, () => (svg.dataset.look = view));
    } else if (mode === 'enter') svg.dataset.look = view;
    else svg.dataset.look = view;

    // segments
    const segs = d3.select(svg).selectAll('rect.lb-seg').data(T.segs);
    if (mode === 'enter' && anim) {
      const start = view === 'pass' ? x(PASS) : view === 'kinds' ? T.segs[0].x : 0;
      segs.interrupt('lb').attr('x', start).attr('width', 0).attr('y', (d) => d.y).attr('height', (d) => d.h).attr('opacity', (d) => d.o);
    }
    run(segs, s2, view === 'matrix' && mode === 'switch' ? out : dShape)
      .attr('x', (d) => d.x)
      .attr('width', (d) => Math.max(0, d.w))
      .attr('y', (d) => d.y)
      .attr('height', (d) => d.h)
      .attr('opacity', (d) => d.o);

    // a total of 0 still shows: a short ink stroke on the 0 line (total and breakdown views)
    const zero = svg.querySelector('.bar-zero');
    const isZero = v != null && v <= 0 && (view === 'total' || view === 'parts');
    zero.setAttribute('display', isZero ? 'inline' : 'none');
    if (isZero) {
      zero.setAttribute('x1', x(0) + 1);
      zero.setAttribute('x2', x(0) + 1);
      zero.setAttribute('y1', H / 2 - BAR_H / 2 - 4);
      zero.setAttribute('y2', H / 2 + BAR_H / 2 + 4);
    }

    // hatch for models still being tested
    const pend = svg.querySelector('.lb-pend');
    const hatch = pend.querySelector('.lb-hatch');
    hatch.setAttribute('x', 0);
    hatch.setAttribute('y', H / 2 - BAR_H / 2);
    hatch.setAttribute('width', x(100));
    hatch.setAttribute('height', BAR_H);
    const note = pend.querySelector('.lb-note');
    setLabel(note, { x: 10, y: H / 2, text: T.pend ? t('common.score.progress', progress(data, info.id)) : '' });
    note.setAttribute('opacity', T.pend ? 1 : 0);
    show(pend, T.pend, T.pend ? s2 : 0, T.pend ? dShape : out);

    // group edge (parts)
    const ge = svg.querySelector('.lb-gedge');
    if (T.gedge) {
      ge.setAttribute('x1', T.gedge.x);
      ge.setAttribute('x2', T.gedge.x);
      ge.setAttribute('y1', T.gedge.y1);
      ge.setAttribute('y2', T.gedge.y2);
    }
    show(ge, !!T.gedge, T.gedge ? s3 : 0, T.gedge ? half || 0 : out);

    // best star
    const best = svg.querySelector('.lb-best');
    if (T.best) {
      const was = +best.getAttribute('opacity') > 0.5;
      const sameView = mode !== 'switch' || from === view;
      if (!was || !sameView) best.setAttribute('transform', `translate(${T.best.x},${T.best.y})`);
      run(d3.select(best), was && sameView ? 0 : s3, was && sameView ? D : half || 0)
        .attr('transform', `translate(${T.best.x},${T.best.y})`)
        .attr('opacity', 1);
    } else show(best, false, 0, out);

    // pass difference label
    const dl = svg.querySelector('.lb-dl');
    if (T.dl) {
      const shown = +dl.getAttribute('opacity') > 0.5 && mode !== 'switch';
      const apply = () => {
        const changed = setLabel(dl, { ...T.dl, y: H / 2 });
        dl.setAttribute('opacity', 1);
        if (anim && (changed || mode !== 'update')) scramble(dl.querySelector('text'), dur(mode === 'enter' ? 'scrambleLoad' : 'scramble'));
      };
      if (shown) {
        run(d3.select(dl), 0, D).attr('opacity', 1);
        const changed = setLabel(dl, { ...T.dl, y: H / 2 });
        if (changed && anim) scramble(dl.querySelector('text'), dur('scramble'));
      } else {
        dl.setAttribute('opacity', 0);
        later(li, s3, apply);
      }
    } else show(dl, false, 0, out);

    // kinds markers and their two numbers
    const kg = svg.querySelector('.lb-kinds');
    const sq = kg.querySelector('.lb-sq');
    const ds = kg.querySelector('.lb-ds');
    const ls = kg.querySelector('.lb-ks');
    const ld = kg.querySelector('.lb-kd');
    if (T.kinds) {
      const k = T.kinds;
      const markerAt = (mode === 'switch' && from !== view) || mode === 'enter' ? s2 + dShape * 0.6 : s2;
      for (const [el, p] of [
        [sq, k.sq],
        [ds, k.ds],
      ]) {
        if (!p) {
          el.setAttribute('opacity', 0);
          continue;
        }
        const tr = el === sq ? `translate(${p.x - 5},${p.y - 5})` : `translate(${p.x},${p.y})`;
        const visible = +el.getAttribute('opacity') > 0.5 && !(mode === 'switch' && from !== view);
        if (!visible) el.setAttribute('transform', tr);
        run(d3.select(el), visible ? 0 : markerAt, visible ? D : half || 0, visible ? ease.mech : ease.snap)
          .attr('transform', tr)
          .attr('opacity', 1);
      }
      for (const [el, p] of [
        [ls, k.ls],
        [ld, k.ld],
      ]) {
        if (!p) {
          el.setAttribute('opacity', 0);
          continue;
        }
        const visible = +el.getAttribute('opacity') > 0.5 && !(mode === 'switch' && from !== view) && mode !== 'enter';
        if (visible) {
          const changed = setLabel(el, { ...p, y: H / 2 });
          if (changed && anim) scramble(el.querySelector('text'), dur('scramble'));
        } else {
          el.setAttribute('opacity', 0);
          later(li, s3, () => {
            setLabel(el, { ...p, y: H / 2 });
            el.setAttribute('opacity', 1);
            if (anim) scramble(el.querySelector('text'), dur(mode === 'enter' ? 'scrambleLoad' : 'scramble'));
          });
        }
      }
    } else {
      for (const el of [sq, ds, ls, ld]) show(el, false, 0, out);
    }

    // matrix cells
    const gCells = svg.querySelector('.lb-cells');
    if (view === 'matrix') {
      const { cols, rebuilt } = syncCells(svg, info);
      const fresh = rebuilt || mode === 'enter' || (mode === 'switch' && from !== 'matrix');
      const step = stagger('segment', cols.length, 240);
      d3.select(gCells).interrupt('lb').attr('opacity', 1);
      gCells.querySelectorAll('.lb-cell').forEach((cg, i) => {
        const col = cols[i];
        const rects = d3.select(cg).selectAll('.lb-cell-base, .lb-cell-bg');
        const tx = cg.querySelector('.lb-cell-t');
        const star = cg.querySelector('.lb-cell-star');
        if (fresh && anim) {
          rects.interrupt('lb').attr('width', 0);
          tx.setAttribute('opacity', 0);
          star.setAttribute('opacity', 0);
          run(rects, (mode === 'enter' ? s2 : s2) + i * step, D).attr('width', col.w);
          later(li, s3 + i * step, () => {
            tx.setAttribute('opacity', 1);
            star.setAttribute('opacity', 1);
            if (tx.textContent) scramble(tx, dur(mode === 'enter' ? 'scrambleLoad' : 'scramble'));
          });
        } else {
          rects.interrupt('lb').attr('width', col.w);
          tx.setAttribute('opacity', 1);
          star.setAttribute('opacity', 1);
        }
      });
    } else if (gCells.childElementCount) {
      const cells = [...gCells.querySelectorAll('.lb-cell')];
      const step = anim ? stagger('segment', cells.length, 120) : 0;
      cells.forEach((cg, i) => {
        cg.querySelector('.lb-cell-t').setAttribute('opacity', 0);
        cg.querySelector('.lb-cell-star').setAttribute('opacity', 0);
        run(d3.select(cg).selectAll('.lb-cell-base, .lb-cell-bg'), (cells.length - 1 - i) * step, out).attr('width', 0);
      });
      run(d3.select(gCells), anim ? out + (cells.length - 1) * step : 0, 0).attr('opacity', 0);
    }

    // the focused category of the breakdown (legend or segment pointed at)
    paintFocus(svg, info, view);
    svg.__drawn = true;
  }

  // ---- breakdown focus: one category stays, its contribution is written in ----
  const labelColour = new Map();
  function paintFocus(svg, info, view) {
    const k = view === 'parts' ? focusCat : null;
    svg.classList.toggle('is-focus', !!k);
    for (const r of svg.querySelectorAll('.lb-seg')) r.classList.toggle('is-dim', !!k && r.dataset.cat !== k);
    const sv = svg.querySelector('.lb-sv');
    const cstar = svg.querySelector('.lb-cstar');
    const c = k ? info.contrib[k] : null;
    if (!k || c == null || info.total == null) {
      sv.setAttribute('opacity', 0);
      cstar.setAttribute('opacity', 0);
      return;
    }
    const i = cats.findIndex((cc) => cc.key === k);
    const r = svg.querySelectorAll('.lb-seg')[i];
    const T = target(info, 'parts', null).segs[i];
    const text = fmtScore(c);
    const tx = sv.querySelector('text');
    tx.textContent = text;
    const w = tx.getComputedTextLength();
    const inside = T.w >= w + 6;
    if (!labelColour.has(k)) labelColour.set(k, onColour(k));
    sv.classList.toggle('is-inside', inside);
    sv.style.setProperty('--sv-c', inside ? labelColour.get(k) : 'var(--st-ink)');
    setLabel(sv, { x: inside ? T.x + T.w / 2 : T.x + T.w + 4, y: H / 2, text, anchor: inside ? 'middle' : 'start' });
    sv.setAttribute('opacity', 1);
    const top = info.status === 'ranked' && isTop(c, C().best.contrib[k]);
    cstar.setAttribute('transform', `translate(${T.x + T.w - 1},${H / 2 - BAR_H / 2 - 1})`);
    cstar.setAttribute('opacity', top ? 1 : 0);
    void r;
  }

  function setFocus(k) {
    if (k === focusCat) return;
    focusCat = k;
    for (const li of rowsEls()) {
      const svg = li.querySelector('svg.lb-svg');
      const info = C().info.get(li.dataset.id);
      if (svg && info) paintFocus(svg, info, state.view);
    }
  }

  // ---- the plot hook for createModelList ----
  function plot(cell, entry, ctx) {
    let svg = cell.querySelector('svg.lb-svg');
    if (!svg) svg = build(cell);
    if (!W) return;
    if (!ctx.row.isConnected) return;
    if (!entered && ctx.first && ctx.animate) draw(ctx.row, { mode: 'enter', delay: 220 + (ctx.delay ?? 0) * 0.7 });
    else if (state.dragging) draw(ctx.row, { mode: 'drag' });
    else if (ctx.animate && svg.__drawn && !ctx.first) draw(ctx.row, { mode: 'update' });
    else draw(ctx.row, { mode: 'static' });
  }

  return {
    plot,
    draw,
    setFocus,
    get focus() {
      return focusCat;
    },
    /** The rows' plot width changed: measure and redraw everything at once. */
    measure(cell, rowPlotH) {
      const w = cell.clientWidth;
      const hh = rowPlotH || list.el.querySelector('li.mrow .mrow-plot')?.clientHeight || H;
      if (!w) return false;
      const changed = Math.abs(w - W) > 0.5 || hh !== H;
      W = w;
      H = hh || 44;
      x = scaleX(W);
      return changed;
    },
    get width() {
      return W;
    },
    get x() {
      return x;
    },
    redrawAll(mode = 'static', opts = {}) {
      for (const li of rowsEls()) draw(li, { mode, ...opts });
    },
    markEntered() {
      entered = true;
    },
    // tooltip text for the thing under the pointer (or the row, on focus)
    tip(li, target) {
      const info = C().info.get(li.dataset.id);
      if (!info) return '';
      const name = modelLabel(info.model);
      const view = state.view;
      const kind = target?.closest?.('[data-tip]')?.dataset.tip ?? '';
      if (info.total == null && (view === 'total' || view === 'pass' || view === 'parts')) return `${name} │ ${t('leaderboard.tip.pending', progress(data, info.id))}`;
      const totalLabel = state.custom ? t('common.score.custom') : t('common.score.total');
      if (view === 'parts' && kind.startsWith('seg:')) {
        const key = kind.slice(4);
        const c = data.category(key);
        return t('leaderboard.tip.part', { cat: pick(c, 'name'), v: fmtScore(info.cats[key]), w: fmtPct(C().weights[key]), c: fmtScore(info.contrib[key]) });
      }
      if (view === 'matrix' && kind.startsWith('cell:')) {
        const key = kind.slice(5);
        const task = data.task(key);
        const what = task && state.cols === 'task' ? `${String(task.no).padStart(2, '0')} ${pick(task, 'name')}` : pick(data.category(key), 'name');
        const val = task && state.cols === 'task' ? info.tasks[key] : info.cats[key];
        if (val == null) return `${name} │ ${what} │ ${t('common.score.none')}`;
        const r = rankOf(data, info.id, key);
        return `${name} │ ${what} ${fmtScore(val)} │ ${fmtRankOf(r.rank, r.of)}`;
      }
      if (view === 'kinds') return `${name} │ ${t('common.kind.standard')} ${fmtScore(info.std)} │ ${t('common.kind.design')} ${fmtScore(info.des)}`;
      if (view === 'pass') return `${name} │ ${fmtScore(info.total)} − ${PASS} = ${fmtDiff(round1(info.total) - PASS)}`;
      if (view === 'matrix') return `${name} │ ${totalLabel} ${fmtScore(info.total)}`;
      return `${name} │ ${totalLabel} ${fmtScore(info.total)}${info.totalRank != null ? ` │ ${fmtRankOf(info.totalRank, C().order.filter((id) => C().info.get(id)?.totalRank != null).length)}` : ''}`;
    },
  };
}
