// The compare view: the only view not drawn one model per row. Rows are the
// measures (total, the two kinds, 10 categories, and the 13 tasks when the
// "题目" grain is on); each row has 2–4 thin bars in ticking order on the
// same fixed 0–100 scale as the model rows, the highest number highlighted
// and "差 x" (highest minus lowest) at the right end. A real <table> for
// screen readers (the bars are aria-hidden; each value has its own cell).
import * as d3 from '../../charts/d3.js';
import { h, svg as svgEl, t, pick, links, fmtScore, fmtPct, modelLabel, round1, valueOf } from '../../core/index.js';
import { getCompare } from '../../ui/index.js';
import { stagger, reduced, dur, ease } from '../../motion.js';
import { scaleX } from './layout.js';

const BAR = 7;
const STEP = 12;

export function createCompare({ data, state, width, onBack }) {
  const el = h('div.lb-cmp', { hidden: true });
  let seq = 0;

  function items() {
    const s = (id) => data.score(id);
    const out = [
      { key: 'total', label: t('common.score.total'), get: (id) => valueOf(data, id, 'total'), group: 'top' },
      { key: 'standard', label: t('common.kind.standard'), weight: data.kinds.standard.weight, get: (id) => s(id).kinds?.standard ?? null, group: 'top' },
      { key: 'design', label: t('common.kind.design'), weight: data.kinds.design.weight, get: (id) => s(id).kinds?.design ?? null, group: 'top' },
    ];
    for (const c of data.categories) {
      out.push({ key: c.key, label: pick(c, 'name'), weight: c.weight, href: links.categories(c.key), get: (id) => s(id).categories?.[c.key] ?? null, group: 'cat', kind: c.kind });
      if (state.cols === 'task')
        for (const tk of c.tasks)
          out.push({ key: tk.key, no: tk.no, label: pick(tk, 'name'), weight: tk.weight, href: links.task(tk), get: (id) => s(id).tasks?.[tk.key] ?? null, group: 'task', kind: c.kind });
    }
    return out;
  }

  function bars(ids, values, best) {
    const W = width();
    const x = scaleX(W);
    const n = ids.length;
    const H = Math.max(44, 18 + n * STEP);
    const id = `lbc${++seq}`;
    const s = svgEl('svg', { class: 'lb-cmp-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' });
    s.innerHTML = `<defs><pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.3" height="5" class="lb-hatch-line"/></pattern></defs>`;
    for (const v of [20, 40, 80]) s.append(svgEl('line', { class: 'lb-gl', x1: x(v), x2: x(v), y1: 0, y2: H }));
    s.append(svgEl('line', { class: 'lb-pass', x1: x(60), x2: x(60), y1: 0, y2: H }));
    const top = H / 2 - ((n - 1) * STEP) / 2;
    ids.forEach((mid, i) => {
      const v = values[i];
      const cy = top + i * STEP;
      if (v == null) {
        s.append(svgEl('rect', { class: 'lb-cmp-none', x: 0, y: cy - BAR / 2, width: x(24), height: BAR, fill: `url(#${id})` }));
        const tx = svgEl('text', { class: 'lb-cmp-v is-none', x: x(24) + 5, y: cy, 'dominant-baseline': 'central' });
        tx.textContent = t('common.score.none');
        s.append(tx);
        return;
      }
      const bar = svgEl('rect', { class: `lb-cmp-bar is-c${i + 1}`, x: 0, y: cy - BAR / 2, width: Math.max(1, x(v)), height: BAR });
      bar.dataset.w = Math.max(1, x(v));
      s.append(bar);
      const g = svgEl('g', { class: `lb-lab lb-cmp-lab${best != null && round1(v) === best ? ' is-best' : ''}` });
      const tx = svgEl('text', { class: 'lb-lab-t', x: x(v) + 6, y: cy, 'dominant-baseline': 'central' });
      tx.textContent = fmtScore(v);
      g.append(svgEl('rect', { class: 'lb-lab-bg' }), tx);
      s.append(g);
    });
    return { svg: s, H };
  }

  // after the svg is in the page: size the highlight boxes behind the numbers
  function sizeLabels(root) {
    for (const g of root.querySelectorAll('.lb-cmp-lab')) {
      const tx = g.querySelector('text');
      const w = tx.getComputedTextLength();
      const r = g.querySelector('rect');
      r.setAttribute('x', +tx.getAttribute('x') - 3);
      r.setAttribute('y', +tx.getAttribute('y') - 7.5);
      r.setAttribute('width', w + 6);
      r.setAttribute('height', 15);
    }
  }

  function render({ animate = false } = {}) {
    const ids = getCompare().filter((id) => data.model(id));
    el.replaceChildren();
    if (ids.length < 2) {
      el.append(
        h(
          'div.site-empty.lb-cmp-empty',
          h('p', t('leaderboard.compare.empty')),
          h('p.lb-cmp-back', h('button.st-btn.small', { type: 'button', onclick: () => onBack?.() }, t('leaderboard.compare.back'))),
        ),
      );
      return;
    }
    const models = ids.map((id) => data.model(id));
    // 每行的「01 6.1Sol」小标签：名字是到模型得分页的链接（读屏读表头的全名，这里不进 Tab 顺序）
    const tag = (m, i) =>
      h(
        'span.lb-cmp-tag',
        { style: { '--c': `var(--compare-${i + 1})` } },
        h('b.num', String(i + 1).padStart(2, '0')),
        ' ',
        h('a.lb-cmp-tag-link', { href: links.model(m.id), tabindex: '-1', title: t('common.row.openPage', { name: modelLabel(m) }) }, m.short || m.name),
      );
    const head = h(
      'thead.sr-only',
      h('tr', { role: 'row' }, h('th', { role: 'columnheader', scope: 'col' }, t('leaderboard.head.item')), models.map((m, i) => h('th', { role: 'columnheader', scope: 'col' }, `${String(i + 1).padStart(2, '0')} ${modelLabel(m)}`)), h('th', { role: 'columnheader', scope: 'col' }, t('leaderboard.compare.diffHead'))),
    );
    const body = h('tbody', { role: 'rowgroup' });
    const list = items();
    list.forEach((it, r) => {
      const values = ids.map((id) => it.get(id));
      const present = values.filter((v) => v != null).map(round1);
      const best = present.length ? Math.max(...present) : null;
      const diff = present.length >= 2 ? Math.max(...present) - Math.min(...present) : null;
      const { svg, H } = bars(ids, values, present.length >= 2 ? best : null);
      const name = it.href ? h('a.lb-cmp-link', { href: it.href, title: it.label }, it.no ? h('span.num.lb-cmp-no', String(it.no).padStart(2, '0')) : null, it.label) : h('span', it.label);
      const tr = h(
        'tr.lb-cmp-row',
        { role: 'row', class: `is-${it.group}${it.kind ? ` is-${it.kind}` : ''}`, dataset: { key: it.key }, style: { '--h': `${H}px`, '--n': ids.length } },
        h(
          'th.lb-cmp-name',
          { role: 'rowheader', scope: 'row' },
          h('span.lb-cmp-item', name, it.weight != null ? h('small.num', fmtPct(it.weight)) : null),
          h('span.lb-cmp-tags', { 'aria-hidden': 'true' }, models.map(tag)),
        ),
        h('td.lb-cmp-plot', { 'aria-hidden': 'true' }, svg),
        values.map((v) => h('td.sr-only', { role: 'cell' }, v == null ? t('common.score.none') : fmtScore(v))),
        h('td.lb-cmp-diff.num', { role: 'cell' }, diff == null ? '—' : t('leaderboard.compare.diff', { v: fmtScore(diff) })),
      );
      if (animate && !reduced()) {
        tr.classList.add('st-in-come');
        tr.style.setProperty('--i', r);
        tr.style.animationDelay = `${r * stagger('row', list.length, 300)}ms`;
        tr.addEventListener('animationend', () => tr.classList.remove('st-in-come'), { once: true });
      }
      body.append(tr);
    });
    el.append(
      h(
        'table.lb-cmp-table',
        { role: 'table', 'aria-label': t('leaderboard.compare.caption', { names: models.map(modelLabel).join(' / ') }) },
        h('caption.sr-only', t('leaderboard.compare.caption', { names: models.map(modelLabel).join(' / ') })),
        head,
        body,
      ),
    );
    sizeLabels(el);
    if (animate && !reduced()) {
      // bars grow from 0 with the rows
      d3.select(el)
        .selectAll('rect.lb-cmp-bar')
        .attr('width', 0)
        .transition()
        .delay((d, i, nodes) => 120 + (nodes[i].closest('tr')?.rowIndex ?? 0) * stagger('row', list.length, 300))
        .duration(dur('morph'))
        .ease(ease.mech)
        .attr('width', (d, i, nodes) => nodes[i].dataset.w);
    }
  }

  return { el, render };
}
