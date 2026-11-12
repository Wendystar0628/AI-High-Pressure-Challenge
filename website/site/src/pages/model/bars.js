// The two bar charts of the model page (models.md 10 类与 13 题): one row per
// category (or per task, grouped by category), all on one fixed 0–100 scale.
// Row: [no] name │ weight │ bar of this model │ cyan tick at the field best │
// score │ rank "1 / 7". When this model is the best, a flare star ends the bar
// and the tick is not drawn. Pointing at a row shows "本模型 │ 全场最高 │ 平均".
//
//   const c = createBarChart(box, { data, model, grouped: true, fill: false, label });
//   c.setModel(id)   bars morph, readouts settle
//   c.enter()        the first draw (bars grow from 0)
//   c.svg            for exportChart
import * as d3 from '../../charts/d3.js';
import { t, pick, links, rankBy, rankOf, valueOf, meanValue, fmtScore, fmtPct, fmtRank, fmtRankOf, modelLabel } from '../../core/index.js';
import { scale100, starD, hatchPattern } from '../../charts/index.js';
import { attachTip, showTip, hideTip } from '../../ui/index.js';
import { dur, durIn, ease, stagger } from '../../motion.js';
import { scramble } from '../../vendor/stellar/fx.js';

let seq = 0;
const AXIS_H = 28;
const GROUP_H = 32;

export function createBarChart(box, { data, model, grouped = false, fill = false, label = '' }) {
  const uid = `mdc${++seq}`;
  let current = model;
  let entered = false;

  // ---------- the rows (field figures do not depend on the model) ----------
  const field = (measure) => {
    const list = rankBy(data, measure);
    const top = list.filter((e) => e.rank === 1);
    return { best: top.length ? top[0].value : null, who: top.map((e) => modelLabel(e.model)), mean: meanValue(data, measure) };
  };
  const rowOf = (obj, cat, task) => ({
    type: 'row',
    key: task ? task.key : cat.key,
    measure: task ? task.key : cat.key,
    kind: cat.kind,
    no: task ? fmtRank(task.no) : null,
    name: pick(task ?? cat, 'name'),
    short: pick(task ?? cat, 'short'),
    href: task ? links.task(task) : links.categories(cat.key),
    weight: (task ?? cat).weight,
    ...field(task ? task.key : cat.key),
  });
  const items = grouped
    ? data.categories.flatMap((c) => [
        { type: 'group', key: `g-${c.key}`, name: pick(c, 'name'), short: pick(c, 'short'), href: links.categories(c.key), weight: c.weight, kind: c.kind },
        ...c.tasks.map((k) => rowOf(null, c, k)),
      ])
    : data.categories.map((c) => rowOf(null, c, null));
  const rows = items.filter((d) => d.type === 'row');

  // ---------- static structure ----------
  const svg = d3
    .select(box)
    .append('svg')
    .attr('class', `md-chart${fill ? ' is-fill' : ''}`)
    .attr('role', 'group')
    .attr('aria-label', label);
  const hatch = hatchPattern(svg.append('defs').node(), `${uid}-hatch`);
  const gGrid = svg.append('g').attr('class', 'md-grid').attr('aria-hidden', 'true');
  const gAxis = svg.append('g').attr('class', 'md-axis').attr('aria-hidden', 'true');
  const gItems = svg.append('g').attr('class', 'md-items');

  const sel = gItems
    .selectAll('g.md-item')
    .data(items, (d) => d.key)
    .join('g')
    .attr('class', (d) => `md-item md-${d.type} is-${d.kind}`);

  const groups = sel.filter((d) => d.type === 'group');
  groups.append('line').attr('class', 'md-group-rule');
  const ga = groups.append('a').attr('class', 'md-group-link').attr('href', (d) => d.href);
  ga.append('text').attr('class', 'md-group-name').attr('dominant-baseline', 'central');
  groups.append('text').attr('class', 'md-group-weight').attr('dominant-baseline', 'central').text((d) => fmtPct(d.weight));

  const rowSel = sel.filter((d) => d.type === 'row');
  rowSel.append('rect').attr('class', 'md-row-bg');
  rowSel.append('rect').attr('class', 'md-row-mark').attr('width', 3);
  rowSel.append('line').attr('class', 'md-row-rule');
  rowSel.filter((d) => d.no).append('text').attr('class', 'md-no').attr('dominant-baseline', 'central').text((d) => d.no);
  const la = rowSel.append('a').attr('class', 'md-label-link').attr('href', (d) => d.href).attr('aria-label', (d) => d.name);
  la.append('text').attr('class', 'md-label').attr('dominant-baseline', 'central');
  rowSel.append('text').attr('class', 'md-weight').attr('dominant-baseline', 'central').attr('text-anchor', 'end').text((d) => fmtPct(d.weight));
  rowSel.append('rect').attr('class', 'md-pending').attr('fill', hatch);
  rowSel.append('rect').attr('class', 'md-bar');
  rowSel.append('line').attr('class', 'bar-zero').attr('display', 'none');
  rowSel.append('line').attr('class', 'md-ref');
  rowSel.append('path').attr('class', 'best-star md-star').attr('d', starD(6.5, 0.36));
  rowSel.append('text').attr('class', 'md-none').attr('dominant-baseline', 'central').text(t('model.chart.noScore'));
  rowSel.append('rect').attr('class', 'md-hi');
  rowSel.append('text').attr('class', 'md-score').attr('dominant-baseline', 'central').attr('text-anchor', 'end');
  rowSel.append('text').attr('class', 'md-rank').attr('dominant-baseline', 'central').attr('text-anchor', 'end');

  // pointing at a row: the shared ink tooltip; focusing the name shows it too
  const tipText = (d) =>
    t('model.chart.tip', { v: fmtScore(d.v), best: fmtScore(d.best), who: d.who.length ? d.who.join(t('model.chart.whoSep')) : '—', mean: fmtScore(d.mean) });
  rowSel.each(function (d) {
    attachTip(this, () => tipText(d));
    this.removeAttribute('aria-describedby');
  });
  la.on('focus', function (e, d) {
    showTip(tipText(d), this);
  }).on('blur', hideTip);

  // ---------- layout ----------
  let L = null;
  function layout() {
    const W = Math.max(260, Math.round(box.clientWidth));
    const narrow = W < 600;
    // phone width: no weight column, tighter columns, so the bars keep some length
    const tiny = W < 420;
    const noW = grouped ? (tiny ? 24 : 30) : 0;
    const labelW = tiny ? Math.round(Math.max(72, W * 0.27)) : Math.round(Math.min(230, Math.max(narrow ? 100 : 112, W * 0.21)));
    const weightW = tiny ? 0 : narrow ? 40 : 46;
    const scoreW = tiny ? 38 : narrow ? 44 : 50;
    const rankW = tiny ? 36 : narrow ? 48 : 54;
    const x0 = noW + labelW + weightW + (tiny ? 8 : narrow ? 12 : 16);
    const x1 = W - scoreW - rankW - (tiny ? 10 : narrow ? 18 : 22);
    let rowH = grouped ? 32 : 36;
    if (fill) {
      const avail = box.clientHeight - AXIS_H - 6;
      if (avail > rows.length * rowH) rowH = Math.min(64, avail / rows.length);
    }
    let y = AXIS_H;
    for (const d of items) {
      d.y = y;
      d.h = d.type === 'group' ? GROUP_H : rowH;
      y += d.h;
    }
    const H = Math.ceil(y + 2);
    L = { W, H, noW, labelW, x0, x1, x: scale100(x0, x1), rowH, tiny, scoreX: W - rankW - (tiny ? 8 : 12), rankX: W - 2 };
    return L;
  }

  function draw() {
    const { W, H, x, x0, x1, noW, labelW } = layout();
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
    // a filling chart takes the height its panel row gives it, never less than its natural height
    if (fill) box.style.minHeight = `${AXIS_H + rows.length * 36 + 8}px`;
    else box.style.height = `${H}px`;
    // grid and ticks
    gGrid
      .selectAll('line')
      .data([20, 40, 60, 80])
      .join('line')
      .attr('class', 'grid-line')
      .attr('x1', (v) => x(v))
      .attr('x2', (v) => x(v))
      .attr('y1', AXIS_H)
      .attr('y2', H - 2);
    gAxis
      .selectAll('text')
      .data(L.tiny ? [0, 50, 100] : [0, 20, 40, 60, 80, 100])
      .join('text')
      .attr('class', 'tick-label')
      .attr('x', (v) => x(v))
      .attr('y', AXIS_H / 2)
      .attr('dominant-baseline', 'central')
      .attr('text-anchor', (v) => (v === 0 ? 'start' : v === 100 ? 'end' : 'middle'))
      .text((v) => v);
    gAxis
      .selectAll('line')
      .data([0])
      .join('line')
      .attr('class', 'md-axis-rule')
      .attr('x1', 0)
      .attr('x2', W)
      .attr('y1', AXIS_H - 0.5)
      .attr('y2', AXIS_H - 0.5);

    groups.attr('transform', (d) => `translate(0,${d.y})`);
    groups.select('.md-group-rule').attr('x1', 0).attr('x2', W).attr('y1', 0.5).attr('y2', 0.5).attr('display', (d, i) => (i === 0 ? 'none' : null));
    groups.select('.md-group-name').attr('x', 0).attr('y', GROUP_H / 2 + 2);
    groups.select('.md-group-weight').attr('x', x0 - 12).attr('y', GROUP_H / 2 + 2).attr('text-anchor', 'end').attr('display', L.tiny ? 'none' : null);

    rowSel.attr('transform', (d) => `translate(0,${d.y})`);
    rowSel.select('.md-row-bg').attr('x', 0).attr('y', 0).attr('width', W).attr('height', (d) => d.h);
    rowSel.select('.md-row-mark').attr('x', 0).attr('y', 0).attr('height', (d) => d.h);
    rowSel.select('.md-row-rule').attr('x1', 0).attr('x2', W).attr('y1', (d) => d.h - 0.5).attr('y2', (d) => d.h - 0.5);
    rowSel.select('.md-no').attr('x', 8).attr('y', (d) => d.h / 2);
    rowSel.select('.md-label').attr('x', noW + (grouped ? 4 : 10)).attr('y', (d) => d.h / 2);
    rowSel.select('.md-weight').attr('x', x0 - 12).attr('y', (d) => d.h / 2).attr('display', L.tiny ? 'none' : null);
    const barH = Math.min(16, L.rowH * 0.42);
    rowSel.select('.md-bar').attr('x', x0).attr('y', (d) => d.h / 2 - barH / 2).attr('height', barH);
    rowSel.select('.md-pending').attr('x', x0).attr('y', (d) => d.h / 2 - barH / 2).attr('height', barH).attr('width', x1 - x0);
    rowSel.select('.bar-zero').attr('x1', x0 + 1).attr('x2', x0 + 1).attr('y1', (d) => d.h / 2 - barH / 2 - 4).attr('y2', (d) => d.h / 2 + barH / 2 + 4);
    rowSel.select('.md-none').attr('x', x0 + 10).attr('y', (d) => d.h / 2);
    rowSel.select('.md-ref').attr('y1', (d) => d.h / 2 - barH / 2 - 5).attr('y2', (d) => d.h / 2 + barH / 2 + 5);
    rowSel.select('.md-score').attr('x', L.scoreX).attr('y', (d) => d.h / 2);
    rowSel.select('.md-rank').attr('x', L.rankX).attr('y', (d) => d.h / 2);
    fitLabels(rowSel.select('.md-label'), labelW - (grouped ? 8 : 14));
    fitLabels(groups.select('.md-group-name'), noW + labelW - 8);
  }

  // full name; the short name when it does not fit; then cut with …
  function fitLabels(texts, maxW) {
    texts.each(function (d) {
      const el = this;
      el.textContent = d.name;
      if (el.getComputedTextLength() <= maxW) return;
      if (d.short) el.textContent = d.short;
      let s = el.textContent;
      while (s.length > 2 && el.getComputedTextLength() > maxW) {
        s = s.slice(0, -1);
        el.textContent = `${s}…`;
      }
    });
  }

  // ---------- values of the current model ----------
  function paint({ mode = 'set' } = {}) {
    const { x, x0 } = L;
    for (const d of rows) {
      d.v = valueOf(data, current, d.measure);
      const r = rankOf(data, current, d.measure);
      d.rank = r.rank;
      d.of = r.of;
      d.isBest = d.v != null && r.rank === 1;
    }
    const D = mode === 'enter' ? durIn('power') : mode === 'morph' ? dur('morph') : 0;
    const gap = mode === 'enter' ? stagger('row', rows.length, 260) : 0;
    // 0 points: no bar, the zero-length mark instead (charts/bar.js); tiny scores keep a visible length
    const wOf = (d) => (d.v == null || d.v <= 0 ? 0 : Math.max(1.5, x(d.v) - x0));
    rowSel.select('.bar-zero').attr('display', (d) => (d.v != null && d.v <= 0 ? 'inline' : 'none'));
    const bars = rowSel.select('.md-bar');
    if (mode === 'enter') bars.attr('width', 0);
    bars
      .transition('w')
      .delay((d, i) => (mode === 'enter' ? 140 + i * gap : 0))
      .duration(D)
      .ease(ease.mech)
      .attr('width', wOf);
    rowSel.classed('is-none', (d) => d.v == null).classed('is-best', (d) => d.isBest);
    // the star rides on the end of the bar; the cyan tick marks the field best
    const stars = rowSel.select('.md-star');
    const starT = (d) => `translate(${x0 + wOf(d) + 10},${d.h / 2})`;
    if (mode === 'enter') stars.attr('transform', (d) => `translate(${x0 + 10},${d.h / 2})`).style('opacity', 0);
    stars
      .transition('s')
      .delay((d, i) => (mode === 'enter' ? 140 + i * gap : 0))
      .duration(D)
      .ease(ease.mech)
      .attr('transform', starT)
      .style('opacity', (d) => (d.isBest ? 1 : 0));
    rowSel
      .select('.md-ref')
      .attr('x1', (d) => (d.best == null ? -10 : x(d.best)))
      .attr('x2', (d) => (d.best == null ? -10 : x(d.best)))
      .style('opacity', (d) => (d.isBest || d.best == null ? 0 : 1));
    // readouts
    const scores = rowSel.select('.md-score');
    scores.text((d) => fmtScore(d.v));
    rowSel.select('.md-rank').text((d) => (d.rank == null ? '—' : fmtRankOf(d.rank, d.of)));
    rowSel.select('.md-hi').each(function (d) {
      const text = this.parentNode.querySelector('.md-score');
      const w = text.getComputedTextLength();
      d3.select(this)
        .attr('x', L.scoreX - w - 5)
        .attr('y', d.h / 2 - 10)
        .attr('width', w + 10)
        .attr('height', 20)
        .style('opacity', d.isBest ? 1 : 0);
    });
    rowSel.attr('aria-label', (d) =>
      t('model.chart.rowAria', { name: `${d.no ? `${d.no} ` : ''}${d.name}`, weight: fmtPct(d.weight), score: d.v == null ? t('model.chart.noScore') : fmtScore(d.v), rank: d.rank == null ? '—' : t('model.chart.rankAria', { rank: d.rank, of: d.of }) }),
    );
    if (mode !== 'set' && dur('scramble')) {
      const ms = mode === 'enter' ? dur('scrambleLoad') : dur('scramble');
      scores.each(function (d, i) {
        if (d.v != null) setTimeout(() => scramble(this, ms), mode === 'enter' ? 140 + i * gap : 0);
      });
    }
  }

  // ---------- life ----------
  // until the first draw the bars sit at 0, so the entrance has somewhere to grow from
  function redraw() {
    draw();
    paint({ mode: 'set' });
    if (!entered && durIn('power')) {
      rowSel.select('.md-bar').interrupt('w').attr('width', 0);
      rowSel.select('.md-star').interrupt('s').style('opacity', 0);
    }
  }
  redraw();

  let lastW = box.clientWidth;
  let lastH = box.clientHeight;
  const ro = new ResizeObserver(() => {
    const w = box.clientWidth;
    const hh = box.clientHeight;
    if (w === lastW && (!fill || Math.abs(hh - lastH) < 2)) return;
    lastW = w;
    lastH = hh;
    redraw();
  });
  ro.observe(box);
  document.fonts?.ready.then(redraw);

  return {
    svg: svg.node(),
    /** The first draw: bars grow from 0, readouts settle. */
    enter() {
      if (entered) return;
      entered = true;
      paint({ mode: 'enter' });
    },
    /** Switch to another model: bars morph, readouts settle. */
    setModel(id) {
      current = id;
      const was = entered;
      entered = true;
      paint({ mode: was ? 'morph' : 'enter' });
    },
    destroy() {
      ro.disconnect();
      svg.remove();
    },
  };
}
