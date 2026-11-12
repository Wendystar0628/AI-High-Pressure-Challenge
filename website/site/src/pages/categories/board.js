// One category board (categories.md): head with icon, paired name, fields,
// task links and a three-way view switch 按题 / 矩阵 / 按型号:
//   按题    one block per measure (category score first, then each task), all
//           models ranked inside each block (bytask.js)
//   矩阵    models × this category's tasks and the category score (ui/matrix.js)
//   按型号  model rows ranked by the category, each with its task sub rows. More
//           than ROWS models: the rows scroll inside the board, ROWS rows high,
//           under the head row that stays put; the model tested last is
//           scrolled into view at first.
// 存为图片 draws the current view, whole.
//
//   const b = createBoard(category, { data, tb, index, view, onView, focus });
//   b.el                     <section id="<key>">
//   b.refresh({ animate })   recompute the current view (filter, compare) and update
import { h, t, pick, links, rankBy, fmtPct, fmtRank, fmtScore, modelLabel, categoryIcon } from '../../core/index.js';
import { createModelList, createRowHead, barPlot, listToSVG } from '../../ui/index.js';
import { createMatrix } from '../../ui/matrix.js';
import { exportButton, createBar, setBar } from '../../charts/index.js';
import { dur, stagger, isInView } from '../../motion.js';
import { createByTask } from './bytask.js';

/** The views of a board, default first. */
export const VIEWS = ['task', 'matrix', 'model'];

/** Rows a board shows before its rows scroll inside it (categories.md 行数多时). */
const ROWS = 10;
/** Faint grid of the boards: 20/40/60/80 (no pass line here). */
const GRID = [20, 40, 60, 80];
let seq = 0;

export function createBoard(cat, { data, tb, index, view = 'task', onView, focus }) {
  const multi = cat.tasks.length > 1;
  const state = { view: VIEWS.includes(view) ? view : 'task' };
  const uid = `cb${++seq}`;
  // the sub rows are part of 按型号 (a category with one task has none)
  const subsOn = () => multi && state.view === 'model';

  const catDone = (id) => cat.tasks.filter((k) => data.score(id).tasks?.[k.key] != null).length;
  const noScores = data.models.every((m) => catDone(m.id) === 0);

  // ---------- head ----------
  const titleId = `${uid}-title`;
  const seg = buildSeg();
  const ol = h('ol');
  const head = createRowHead({ rank: t('categories.board.rank'), name: t('categories.board.model'), score: t('categories.board.score'), plot: axisNode() });
  // the image is the current view, whole: a scroll box opens up while it is measured (no paint in between)
  const exportBtn = exportButton({
    build: () => {
      if (state.view === 'task') return byTask.build();
      if (state.view === 'matrix') return matrix.build();
      const top = scroll.scrollTop;
      scroll.classList.add('is-full');
      try {
        return listToSVG(ol, { head });
      } finally {
        scroll.classList.remove('is-full');
        scroll.scrollTop = top;
      }
    },
    title: () => t('categories.board.exportTitle', { name: pick(cat, 'name'), view: t(`categories.view.${state.view}`) }),
    filename: () => `ai-decathlon-category-${cat.key}-${state.view}`,
  });

  const taskLinks = multi
    ? h(
        'ul.cat-board-tasks',
        { 'aria-label': t('categories.board.taskList') },
        cat.tasks.map((k) => h('li', h('a', { href: links.task(k) }, h('span.num', fmtRank(k.no)), ' ', h('span', { 'data-relay-name': '' }, pick(k, 'name'))))),
      )
    : h('p.cat-board-tasks', t('categories.board.single'), h('a', { href: links.task(cat.tasks[0]), 'data-relay': '' }, pick(cat.tasks[0], 'name')));

  const eyebrow = t('categories.board.eyebrow', { en: cat.en, no: fmtRank(index + 1) });
  const el = h(
    'section.st-panel.cat-board',
    { id: cat.key, class: `is-${cat.kind}`, 'aria-labelledby': titleId, tabindex: '-1', dataset: { flip: '', view: state.view } },
    h(
      'header.cat-board-head',
      h(
        'div.cat-board-title',
        categoryIcon(cat.icon ?? cat.key),
        h('h2.st-pair#' + titleId, h('span.st-eyebrow', eyebrow), h('span', pick(cat, 'name'))),
      ),
      h('div.cat-board-tools', seg.el, exportBtn),
      h(
        'div.cat-board-meta',
        h(
          'ul.st-facts.st-field',
          h('li', t('categories.board.weight', { w: fmtPct(cat.weight) })),
          h('li', t('categories.board.tasks', { n: cat.tasks.length })),
          h('li', t(`common.kind.${cat.kind}`)),
        ),
        taskLinks,
        h('a.cat-board-sort', { href: links.leaderboard({ sort: cat.key }) }, t('categories.board.sortLink')),
      ),
    ),
  );
  const scroll = h('div.cat-board-scroll', head, ol);
  const byTask = noScores ? null : createByTask(cat, { data, tb });
  const matrix = noScores ? null : createMatrix({ data, tb, cats: [cat], last: 'category', label: t('categories.view.matrixLabel', { name: pick(cat, 'name') }) });
  const panes = {
    task: h('div.cat-pane.cat-pane-task', byTask?.el),
    matrix: h('div.cat-pane.cat-pane-matrix', matrix?.el),
    model: h('div.cat-pane.cat-pane-model', scroll),
  };
  const body = h('div.cat-board-body', Object.values(panes));
  const foot = h('p.cat-board-foot.st-field');
  if (noScores) {
    el.append(h('div.site-empty.cat-empty', h('p', t('categories.board.empty'))));
    seg.el.querySelectorAll('input').forEach((i) => (i.disabled = true));
    exportBtn.disabled = true;
  } else el.append(body, foot);

  const opts = {
    data,
    kind: cat.kind === 'design' ? 'design' : 'standard',
    checkable: true,
    grid: GRID,
    empty: t('categories.board.noMatch'),
    // rows without a category score: how many of its tasks are in
    note: (e) => (e.value == null ? t('categories.board.progress', { done: catDone(e.id), all: cat.tasks.length }) : undefined),
    rank: rankCell,
    plot: (cell, entry, ctx) => {
      barPlot(cell, entry, ctx);
      renderSubs(ctx.row, entry, ctx);
    },
  };
  const list = noScores ? null : createModelList(ol, opts);

  // ---------- the view switch ----------
  function buildSeg() {
    const name = `${uid}-view`;
    const wrap = h('div.st-seg.cat-views', { role: 'radiogroup', 'aria-label': t('categories.view.label') });
    const inputs = VIEWS.map((value) => {
      const input = h('input', { type: 'radio', name, value, checked: value === state.view });
      const lab = h('label', { dataset: { value }, title: t(`categories.view.${value}Title`) }, input, h('span', t(`categories.view.${value}`)));
      input.addEventListener('change', () => input.checked && setView(value));
      wrap.append(lab);
      return input;
    });
    return {
      el: wrap,
      sync() {
        for (const i of inputs) i.checked = i.value === state.view;
      },
    };
  }

  function setView(value, { silent = false } = {}) {
    if (state.view === value || !VIEWS.includes(value)) return;
    state.view = value;
    el.dataset.view = value;
    seg.sync();
    refresh({ animate: true });
    if (!silent) onView?.(cat.key, value);
  }

  // ---------- 按型号 rows ----------
  function axisNode() {
    return h(
      'span.cat-axis',
      [0, 20, 40, 60, 80, 100].map((v) => h('span.cat-tick', { class: v === 0 ? 'is-first' : v === 100 ? 'is-last' : null, style: { left: `${v}%` } }, String(v))),
    );
  }

  // the rank cell (shared hook): the category rank, or 评测中 with how many of its tasks are in
  function rankCell(cell, entry, ctx) {
    const m = entry.model;
    if (entry.value == null) ctx.sr.textContent = t('categories.board.ariaPending', { name: modelLabel(m), done: catDone(entry.id), all: cat.tasks.length });
    const rank = entry.rank != null && entry.value != null ? entry.rank : null;
    if (rank != null) cell.textContent = fmtRank(rank);
    else cell.replaceChildren(h('span.st-state.is-draft', t('common.score.pending')));
  }

  // ---------- sub rows: one per task ----------
  function renderSubs(li, entry, ctx) {
    let box = li.querySelector(':scope > .cat-subs');
    if (!subsOn()) {
      box?.remove();
      return;
    }
    const fresh = !box;
    if (fresh) {
      box = h('div.cat-subs', { role: 'list', 'aria-label': t('categories.board.subsLabel', { name: modelLabel(entry.model) }) });
      for (const k of cat.tasks) box.append(subRow(k));
      li.append(box);
    }
    const s = data.score(entry.id);
    const animate = (fresh || ctx.first) && ctx.animate && isInView(li);
    [...box.children].forEach((row, i) => {
      const k = data.task(row.dataset.task);
      const v = s.tasks?.[k.key] ?? null;
      const rank = v == null ? null : rankBy(data, k.key, { ids: [entry.id] })[0]?.rank;
      fillSub(row, k, v, rank === 1, { animate, delay: animate ? i * stagger('row', cat.tasks.length, 120) : 0 });
    });
  }

  function subRow(k) {
    const svg = createBar({ grid: GRID, thick: 40, className: 'cat-sub-svg' });
    const name = pick(k, 'name');
    return h(
      'div.cat-sub.mrow-sub',
      { role: 'listitem', dataset: { task: k.key } },
      h('span.cat-sub-no.num', { 'aria-hidden': 'true' }, fmtRank(k.no)),
      h('a.cat-sub-name', { href: links.task(k), title: name, 'data-relay': '' }, name),
      h('span.cat-sub-plot', { 'aria-hidden': 'true' }, svg, h('span.mrow-best', { hidden: true }), h('span.cat-sub-note', { 'data-ground': '' })),
      h('span.cat-sub-score.num', { 'aria-hidden': 'true' }),
      h('span.sr-only.cat-sub-sr'),
    );
  }

  function fillSub(row, k, v, best, { animate, delay }) {
    row.classList.toggle('is-none', v == null);
    const w = setBar(row.querySelector('svg.bar-svg'), v, { duration: animate ? dur('power') : 0, delay: animate ? delay : 0, from0: animate });
    const star = row.querySelector('.mrow-best');
    star.hidden = !(best && v != null);
    star.style.left = `${w}%`;
    row.querySelector('.cat-sub-note').textContent = v == null ? t('categories.board.noScore') : '';
    row.querySelector('.cat-sub-score').textContent = fmtScore(v);
    row.querySelector('.cat-sub-sr').textContent = t('categories.board.subAria', { no: fmtRank(k.no), task: pick(k, 'name'), score: v == null ? t('categories.board.noScore') : fmtScore(v) });
  }

  // ---------- update ----------
  const countEl = h('span');
  function paintFoot(n) {
    countEl.textContent = t('categories.board.count', { n });
    if (foot.firstChild !== countEl) foot.replaceChildren(countEl);
  }

  // more than ROWS rows: the box is as tall as the head and the first ROWS rows (sub rows included) and scrolls
  function fitScroll() {
    const rows = ol.children;
    const on = rows.length > ROWS && state.view === 'model';
    scroll.classList.toggle('is-scroll', on);
    scroll.style.maxHeight = on ? `${rows[ROWS - 1].offsetTop + rows[ROWS - 1].offsetHeight}px` : '';
  }
  if (!noScores) new ResizeObserver(fitScroll).observe(ol);

  // the model tested last starts in view: scrolled to the middle of the box when it is below the first rows
  let focused = false;
  function showFocus() {
    focused = true;
    const li = focus && ol.querySelector(`:scope > li[data-id="${CSS.escape(focus)}"]`);
    if (!li || !scroll.classList.contains('is-scroll')) return;
    const view = scroll.clientHeight - head.offsetHeight;
    const y = li.offsetTop - head.offsetHeight;
    if (y + li.offsetHeight > scroll.scrollTop + view) scroll.scrollTop = Math.max(0, y - (view - li.offsetHeight) / 2);
  }

  // only the view on show is drawn; the others catch up when switched to
  function refresh({ animate = true } = {}) {
    if (noScores) return;
    for (const [k, pane] of Object.entries(panes)) pane.hidden = k !== state.view;
    if (state.view === 'task') {
      byTask.refresh({ animate });
      paintFoot(byTask.count);
    } else if (state.view === 'matrix') {
      matrix.refresh();
      paintFoot(matrix.count);
    } else {
      const shown = rankBy(data, cat.key).filter((e) => tb.matches(e.model));
      list.update(shown, { animate });
      paintFoot(shown.length);
      fitScroll();
      if (!focused) showFocus();
    }
  }

  return {
    el,
    key: cat.key,
    get view() {
      return state.view;
    },
    refresh,
    setView,
  };
}
