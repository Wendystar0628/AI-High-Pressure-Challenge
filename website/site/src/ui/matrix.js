// 成绩矩阵: one row per model, one column per task (grouped under its
// category when there are several categories), the total or the category
// score last. A cell writes its score on a ground that deepens with it
// (charts/colors.js stepFill, the category's kind); the best of each column
// carries a small flare star (ties all marked). Clicking a task's column head
// ranks the rows by that task, clicking it again restores the default order
// (the last column). Pointing at a cell shows the graders' scores of a design
// task, anomaly notes and the weight (ui/cells.js). Cells without a score are
// grey with a hatch and a short mark (评测中 / 未交 / 失败). Rows carry the
// compare tick, the full name links to the model page, the rest of a row
// opens the side panel. At phone width the table scrolls sideways under a
// model column that stays at the left.
//
//   const mx = createMatrix({ data, tb, cats: data.categories, last: 'total', label: '成绩矩阵' });
//   panel.append(mx.el); mx.refresh();      // after filter changes too
//   exportButton({ build: () => mx.build() })
import { h } from '../core/dom.js';
import { t, pick } from '../core/i18n.js';
import { modelName, vendorIcon, modelLabel, categoryIcon } from '../core/names.js';
import { links } from '../core/route.js';
import { fmtScore, fmtRank, fmtPct } from '../core/format.js';
import { rankBy } from '../core/rank.js';
import { stepFill, stepInk } from '../charts/colors.js';
import { rowsToSVG } from '../charts/export.js';
import { getCompare, toggleCompare, isCompareFull, compareIndex, onCompareChange } from './compare.js';
import { showTip, hideTip } from './tip.js';
import { colValue, cellState, cellMark, cellTip, colName, hasAnomaly } from './cells.js';

let seq = 0;

export function createMatrix({ data, tb, cats, last = 'total', label = '' }) {
  const uid = `mx${++seq}`;
  const grouped = cats.length > 1;
  const cols = cats.flatMap((c) => c.tasks.map((k, i) => ({ type: 'task', key: k.key, kind: c.kind, cat: c.key, task: k, gstart: grouped && i === 0 })));
  const lastCol = last === 'category' ? { type: 'category', key: cats[0].key, kind: cats[0].kind, cat: cats[0].key } : { type: 'total', key: 'total', kind: 'design' };
  const all = [...cols, lastCol];
  const by = (col) => (col.type === 'total' ? 'total' : col.key);
  const state = { sort: null };

  // the best of each column (ties all marked), among the scored cells
  const best = new Map(all.map((c) => [c, Math.max(...rankBy(data, by(c)).filter((e) => e.ranked).map((e) => e.value))]));

  // ---------- head ----------
  const heads = new Map();
  const headBtn = (col) => {
    const k = col.task;
    const btn = h(
      'button.mx-sort',
      { type: 'button', title: t('common.matrix.sortTitle', { name: `${fmtRank(k.no)} ${pick(k, 'name')}` }) },
      h('span.mx-no.num', fmtRank(k.no)),
      h('span.mx-short', pick(k, 'short') || pick(k, 'name')),
      h('span.mx-arrow', { 'aria-hidden': 'true' }),
    );
    btn.addEventListener('click', () => setSort(state.sort === col.key ? null : col.key));
    const th = h('th.mx-head', { scope: 'col', class: [`is-${col.kind}`, col.gstart ? 'is-gstart' : null].filter(Boolean).join(' '), dataset: { col: col.key } }, btn);
    heads.set(col.key, th);
    return th;
  };
  const modelHead = h('th.mx-model.mx-corner', { scope: 'col', rowspan: grouped ? 2 : null }, h('div.mx-m', h('span.mx-rank'), h('span', t('common.matrix.model'))));
  const lastHead = h(
    'th.mx-head.mx-last',
    { scope: 'col', rowspan: grouped ? 2 : null, class: `is-${lastCol.kind}` },
    h('span.mx-lastname', lastCol.type === 'total' ? t('common.score.total') : t('common.matrix.categoryScore')),
  );
  const thead = h('thead');
  if (grouped) {
    thead.append(
      h(
        'tr.mx-groups',
        modelHead,
        cats.map((c) =>
          h(
            'th.mx-group',
            { scope: 'colgroup', colspan: c.tasks.length, class: `is-${c.kind} is-gstart` },
            h(
              'a.mx-gname',
              { href: links.categories(c.key), title: `${pick(c, 'name')} ${fmtPct(c.weight)}` },
              categoryIcon(c.icon ?? c.key),
              h('span.mx-gtext', pick(c, 'short') || pick(c, 'name')),
              h('span.mx-gw.num', fmtPct(c.weight)),
            ),
          ),
        ),
        lastHead,
      ),
      h('tr.mx-heads', cols.map(headBtn)),
    );
  } else thead.append(h('tr.mx-heads', modelHead, cols.map(headBtn), lastHead));

  const tbody = h('tbody');
  const table = h('table.mx', { id: uid, class: grouped ? 'is-grouped' : 'is-single', style: { '--mx-cols': all.length } }, h('caption.sr-only', label), thead, tbody);
  const empty = h('p.mx-empty', { hidden: true }, t('common.toolbar.noMatch'));
  const scroll = h('div.mx-scroll', table);
  const el = h('div.mx-wrap', scroll, empty);

  // ---------- rows ----------
  const rows = new Map();
  function rowOf(m) {
    const tick = h('input.mrow-tick', { type: 'checkbox', 'aria-label': t('common.toolbar.compareAdd', { name: modelLabel(m) }) });
    tick.addEventListener('change', () => {
      if (!toggleCompare(m.id, tick.checked)) tick.checked = false;
    });
    const name = modelName(m);
    name.dataset.relayName = '';
    const tr = h(
      'tr.mx-row',
      { dataset: { id: m.id, modelPanel: m.id } },
      h(
        'th.mx-model',
        { scope: 'row' },
        h(
          'div.mx-m',
          h('span.mx-rank.num'),
          h('label.mx-check', tick),
          vendorIcon(m),
          h('a.mx-name', { href: links.model(m.id), title: t('common.row.openPage', { name: modelLabel(m) }) }, name),
        ),
      ),
      all.map((col) => cell(m.id, col)),
    );
    return tr;
  }

  function cell(id, col) {
    const v = colValue(data, id, col);
    const st = cellState(data, id, col);
    const top = v != null && Math.round(v * 10) === Math.round(best.get(col) * 10);
    const td = h(
      'td.mx-cell',
      {
        class: [`is-${col.kind}`, col === lastCol ? 'mx-last' : null, col.gstart ? 'is-gstart' : null, st ? `is-none is-${st}` : null, top ? 'is-best' : null].filter(Boolean).join(' '),
        dataset: { col: col.key, ground: '' },
        style: st ? null : { background: stepFill(col.kind, v), color: stepInk(v) },
      },
      h('span.mx-v.num', st ? cellMark(st) : fmtScore(v)),
      top ? h('span.mrow-best.mx-best', { 'aria-hidden': 'true' }) : null,
      col.type === 'task' && hasAnomaly(data, id, col.key) ? h('span.mx-flag', { 'aria-hidden': 'true' }) : null,
    );
    // what a screen reader hears besides the number
    if (st) td.setAttribute('aria-label', `${colName(data, col)}：${t(`common.cell.state.${st}`)}`);
    return td;
  }

  // ---------- order, filter ----------
  function refresh() {
    const list = rankBy(data, state.sort ?? by(lastCol));
    const shown = list.filter((e) => !tb || tb.matches(e.model));
    for (const e of shown) {
      let tr = rows.get(e.id);
      if (!tr) rows.set(e.id, (tr = rowOf(e.model)));
      tr.querySelector('.mx-rank').textContent = e.rank != null ? fmtRank(e.rank) : '—';
      tbody.append(tr);
    }
    const want = new Set(shown.map((e) => e.id));
    for (const [id, tr] of rows) if (!want.has(id)) tr.remove();
    empty.hidden = shown.length > 0;
    for (const [key, th] of heads) {
      const on = state.sort === key;
      th.classList.toggle('is-sort', on);
      th.setAttribute('aria-sort', on ? 'descending' : 'none');
      th.querySelector('.mx-sort').setAttribute('aria-pressed', String(on));
      table.querySelectorAll(`td[data-col="${CSS.escape(key)}"]`).forEach((td) => td.classList.toggle('is-sort', on));
    }
    lastHead.classList.toggle('is-sort', state.sort == null);
    syncTicks();
  }

  function setSort(key) {
    state.sort = key;
    refresh();
  }

  function syncTicks() {
    const ids = getCompare();
    const full = isCompareFull();
    for (const [id, tr] of rows) {
      const on = ids.includes(id);
      tr.classList.toggle('is-checked', on);
      tr.style.setProperty('--cmp', on ? compareIndex(id) : 0);
      const box = tr.querySelector('.mrow-tick');
      box.checked = on;
      box.disabled = !on && full;
      box.title = !on && full ? t('common.toolbar.compareFull') : '';
    }
  }
  onCompareChange(syncTicks);

  // ---------- pointing at a cell ----------
  table.addEventListener('pointermove', (e) => {
    const td = e.target.closest('td.mx-cell');
    if (!td) return hideTip();
    const col = all.find((c) => c.key === td.dataset.col);
    showTip(cellTip(data, td.parentElement.dataset.id, col), { x: e.clientX, y: e.clientY - 6 });
  });
  table.addEventListener('pointerleave', hideTip);
  scroll.addEventListener('scroll', hideTip, { passive: true });

  // ---------- 存为图片: the whole table, unscrolled ----------
  function build() {
    const left = scroll.scrollLeft;
    scroll.classList.add('is-full');
    try {
      return rowsToSVG([...table.rows].filter((r) => r.isConnected), { sub: 'th, td', span: false });
    } finally {
      scroll.classList.remove('is-full');
      scroll.scrollLeft = left;
    }
  }

  return {
    el,
    table,
    refresh,
    build,
    get sort() {
      return state.sort;
    },
    get count() {
      return tbody.rows.length;
    },
  };
}
