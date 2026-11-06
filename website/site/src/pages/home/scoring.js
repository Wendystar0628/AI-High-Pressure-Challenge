// 总分怎么合成 (home.md 4): one row per top model; a 0–100 bar split into the
// categories by weight, each cell filled to the category score, so the filled
// length of a row is the total. Pointing at a column or a name highlights it.
import { h, svg, t, pick, fmtScore, fmtPct, fmtRank, round1, modelName, modelLabel, vendorIcon, categoryIcon, links } from '../../core/index.js';
import { fill, needsEdge, starD } from '../../charts/index.js';
import { durIn, reduced, calm, onEnterView, STAGGER, stagger } from '../../motion.js';
import { showTip, hideTip } from '../../ui/index.js';
import { sectionHead, section } from './util.js';

export function renderScoring(data, page, top) {
  const cats = data.categories;
  const cols = cats.map((c) => `minmax(0, ${c.weight}fr)`).join(' ');
  const table = h('div.cmp', { role: 'table', 'aria-labelledby': 'scoring-title', style: { '--cmp-cols': cols } });

  // ---- header: icon, name, weight; links to the category board ----
  const heads = cats.map((c) => {
    const name = h('span.cmp-head-name', h('span.is-full', pick(c, 'name')), h('span.is-short', { 'aria-hidden': 'true' }, pick(c, 'short') || pick(c, 'name')));
    const a = h(
      'a.cmp-head',
      { href: links.categories(c.key), role: 'columnheader', dataset: { cat: c.key }, title: pick(c, 'name'), 'aria-label': `${pick(c, 'name')} ${fmtPct(c.weight)}` },
      h('span.cmp-head-top', categoryIcon(c.key), h('span.cmp-head-w.num', fmtPct(c.weight))),
      name,
    );
    // no 名字接力 here: the category boards are drawn after the first frame, so the name has nowhere to land
    return a;
  });
  table.append(
    h(
      'div.cmp-row.cmp-headrow',
      { role: 'row' },
      h('div.cmp-name.st-eyebrow', { role: 'columnheader' }, t('home.scoring.model')),
      h('div.cmp-bar', { role: 'presentation' }, heads),
      h('div.cmp-total.st-eyebrow', { role: 'columnheader' }, t('home.scoring.total')),
    ),
  );

  // the best cell of each column among the rows shown gets the flare star
  const best = {};
  for (const c of cats) {
    const vals = top.map((e) => data.score(e.id).categories?.[c.key]).filter((v) => v != null);
    best[c.key] = vals.length ? Math.max(...vals.map(round1)) : null;
  }

  // ---- rows ----
  const rows = new Map();
  const rowGap = stagger('row', top.length, 4 * STAGGER.row);
  const segGap = stagger('segment', cats.length, 7 * STAGGER.segment);
  top.forEach((e, r) => {
    const m = e.model;
    const s = data.score(e.id);
    // the name cell sets the page model (a button over the whole cell); the name itself
    // is a link to the model scores page, above the button (名字接力)
    const pickBtn = h('button.cmp-pick', { type: 'button', title: t('home.scoring.pick', { name: modelLabel(m) }), 'aria-label': t('home.scoring.pick', { name: modelLabel(m) }), onclick: () => page.set(e.id) });
    const name = modelName(m);
    name.dataset.relayName = '';
    const pick_ = h(
      'div.cmp-who',
      pickBtn,
      h('span.cmp-rank.num', { 'aria-hidden': 'true' }, fmtRank(e.rank)),
      vendorIcon(m),
      h('a.cmp-link', { href: links.model(e.id), title: t('home.top.pageTitle', { name: modelLabel(m) }) }, name),
    );
    const cells = cats.map((c, i) => {
      const v = s.categories?.[c.key] ?? null;
      const part = v == null ? null : (v * c.weight) / 100;
      const isBest = v != null && best[c.key] != null && round1(v) === best[c.key];
      const cell = h(
        'a.cmp-cell',
        {
          href: links.categories(c.key),
          tabindex: '-1',
          role: 'cell',
          class: [v == null ? 'is-none' : '', isBest ? 'is-best' : '', needsEdge(c.key) ? 'is-edged' : ''].filter(Boolean).join(' ') || null,
          dataset: { cat: c.key },
          style: { '--v': v == null ? 0 : Math.max(0, Math.min(100, v)) / 100, '--fill': fill.category(c.key), '--delay': `${r * rowGap + i * segGap}ms` },
          'aria-label':
            v == null
              ? t('home.scoring.cellAriaNone', { name: modelLabel(m), category: pick(c, 'name') })
              : t('home.scoring.cellAria', { name: modelLabel(m), category: pick(c, 'name'), score: fmtScore(v), part: fmtScore(part) }),
        },
        h('i.cmp-fill'),
      );
      if (isBest) {
        const star = svg('svg', { class: 'cmp-star', viewBox: '-8 -8 16 16', width: 16, height: 16, 'aria-hidden': 'true' });
        star.append(svg('path', { class: 'best-star', d: starD(7, 0.36) }));
        cell.append(star);
      }
      cell._tip = v == null ? `${pick(c, 'name')} │ ${t('home.scoring.noScore')}` : t('home.scoring.tip', { score: fmtScore(v), part: fmtScore(part) });
      return cell;
    });
    const total = h('div.cmp-total.num', { role: 'cell' }, e.rank === 1 ? h('span.st-hi', fmtScore(e.value)) : fmtScore(e.value));
    const row = h('div.cmp-row', { role: 'row', dataset: { id: e.id } }, h('div.cmp-name', { role: 'rowheader' }, pick_), h('div.cmp-bar', { role: 'presentation' }, cells), total);
    rows.set(e.id, row);
    table.append(row);

    pick_.addEventListener('pointerenter', () => setRow(e.id));
    pick_.addEventListener('pointerleave', () => setRow(null));
    pick_.addEventListener('focusin', () => setRow(e.id));
    pick_.addEventListener('focusout', () => setRow(null));
  });

  // ---- the two kinds: brackets under the columns ----
  const groups = [];
  for (const kind of ['standard', 'design']) {
    const idx = cats.map((c, i) => (c.kind === kind ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    const k = data.kinds[kind];
    groups.push(
      h(
        'p.cmp-group.st-field',
        { class: `is-${kind}`, style: { gridColumn: `${idx[0] + 1} / ${idx[idx.length - 1] + 2}` } },
        t('home.scoring.group', {
          kind: t(`common.kind.${kind}`),
          n: k.tasks.length,
          w: fmtPct(k.weight),
          who: t(`common.kind.${kind}Scoring`),
        }),
      ),
    );
  }
  table.append(h('div.cmp-row.cmp-grouprow', { 'aria-hidden': 'true' }, h('div.cmp-name'), h('div.cmp-bar.cmp-groups-bar', groups), h('div.cmp-total')));

  // ---- linked highlight ----
  const allCells = [...table.querySelectorAll('.cmp-cell, .cmp-head')];
  function setCol(key) {
    table.classList.toggle('has-col', !!key);
    for (const el of allCells) el.classList.toggle('is-col', !!key && el.dataset.cat === key);
  }
  function setRow(id) {
    table.classList.toggle('has-row', !!id);
    rows.forEach((row, rid) => row.classList.toggle('is-row', rid === id));
  }
  for (const head of heads) {
    const on = () => setCol(head.dataset.cat);
    const off = () => setCol(null);
    head.addEventListener('pointerenter', on);
    head.addEventListener('pointerleave', off);
    head.addEventListener('focus', on);
    head.addEventListener('blur', off);
  }
  table.querySelectorAll('.cmp-cell').forEach((cell) => {
    cell.addEventListener('pointerenter', () => {
      setCol(cell.dataset.cat);
      showTip(cell._tip, cell);
    });
    cell.addEventListener('pointerleave', () => {
      setCol(null);
      hideTip();
    });
  });

  // ---- the page model's row ----
  const mark = (id) => rows.forEach((row, rid) => row.classList.toggle('is-page', rid === id));
  mark(page.id);
  page.on(mark);

  // ---- 图表绘制: each row's cells uncover from the left when scrolled to ----
  const animate = !reduced() && !calm() && durIn('stroke') > 0;
  if (animate) {
    table.classList.add('will-draw');
    onEnterView(table, () => {
      table.classList.add('is-drawing');
      table.classList.remove('will-draw');
      setTimeout(() => table.classList.remove('is-drawing'), 1200);
    });
  }

  return section(
    'scoring',
    sectionHead({ id: 'scoring-title', eyebrow: t('home.scoring.eyebrow'), title: t('home.scoring.title') }),
    h('p.home-lede', t('home.scoring.lede', { n: cats.length })),
    table,
  );
}
