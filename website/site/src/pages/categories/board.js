// One category board (categories.md): head with icon, paired name, fields,
// task links, "各题得分" switch and per-task sort; a bar chart of model rows
// ranked inside the category; per-task sub rows. More than ROWS models: the
// rows scroll inside the board, ROWS rows high, under the head row that stays
// put; the model tested last is scrolled into view at first; 存为图片 draws
// the whole list.
//
//   const b = createBoard(category, { data, tb, index, open, onToggle, below, focus });
//   b.el                     <section id="<key>">
//   b.refresh({ animate })   recompute rows (filter, compare, sort) and update
//   b.setOpen(on)            open / close the task sub rows (animated)
import { h, t, pick, links, rankBy, fmtPct, fmtRank, fmtScore, modelLabel, categoryIcon } from '../../core/index.js';
import { createModelList, createRowHead, barPlot, listToSVG, attachTip } from '../../ui/index.js';
import { exportButton, createBar, setBar } from '../../charts/index.js';
import { dur, durOut, flip, stagger, isInView, play } from '../../motion.js';

/** Rows a board shows before its rows scroll inside it (categories.md 行数多时). */
const ROWS = 10;
/** Faint grid of the boards: 20/40/60/80 (no pass line here). */
const GRID = [20, 40, 60, 80];
let seq = 0;

export function createBoard(cat, { data, tb, index, open = false, onToggle, below, focus }) {
  const multi = cat.tasks.length > 1;
  const state = { sort: 'cat', open: multi && open };
  const uid = `cb${++seq}`;
  let current = { shown: [] };
  let growSubs = false; // sub bars grow from 0 during the open motion

  const catDone = (id) => cat.tasks.filter((k) => data.score(id).tasks?.[k.key] != null).length;
  const noScores = data.models.every((m) => catDone(m.id) === 0);

  // ---------- head ----------
  const titleId = `${uid}-title`;
  const listId = `${uid}-list`;
  const toggle = multi
    ? h(
        'button.st-btn.small.cat-toggle',
        { type: 'button', 'aria-expanded': String(state.open), 'aria-controls': listId, title: t('categories.board.toggleTitle') },
        h('span.cat-chev', { 'aria-hidden': 'true' }),
        t('categories.board.toggle'),
      )
    : null;
  const seg = multi ? buildSeg() : null;
  const ol = h('ol', { id: listId });
  const head = createRowHead({ rank: t('categories.board.rank'), name: t('categories.board.model'), score: t('categories.board.score'), plot: axisNode() });
  // the image always has every row: the scroll box opens up while the rows are measured (no paint in between)
  const exportBtn = exportButton({
    build: () => {
      const top = scroll.scrollTop;
      scroll.classList.add('is-full');
      try {
        return listToSVG(ol, { head });
      } finally {
        scroll.classList.remove('is-full');
        scroll.scrollTop = top;
      }
    },
    title: () => t('categories.board.exportTitle', { name: pick(cat, 'name') }),
    filename: `ai-octathlon-category-${cat.key}`,
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
    { id: cat.key, class: `is-${cat.kind}`, 'aria-labelledby': titleId, tabindex: '-1', dataset: { flip: '' } },
    h(
      'header.cat-board-head',
      h(
        'div.cat-board-title',
        categoryIcon(cat.icon ?? cat.key),
        h('h2.st-pair#' + titleId, h('span.st-eyebrow', eyebrow), h('span', pick(cat, 'name'))),
      ),
      h('div.cat-board-tools', toggle, seg?.el, exportBtn),
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
  const body = h('div.cat-board-body', scroll);
  const foot = h('p.cat-board-foot.st-field');
  if (noScores) {
    el.append(h('div.site-empty.cat-empty', h('p', t('categories.board.empty'))));
    toggle?.setAttribute('disabled', '');
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
      decorate(ctx.row, entry);
    },
  };
  const list = noScores ? null : createModelList(ol, opts);

  // ---------- per-task sort (segmented, only while the sub rows are open) ----------
  function buildSeg() {
    const name = `${uid}-sort`;
    const wrap = h('div.st-seg.cat-sort', { role: 'radiogroup', 'aria-label': t('categories.board.sortLabel') });
    const opt = (value, label, title) => {
      const input = h('input', { type: 'radio', name, value });
      const lab = h('label', { dataset: { value } }, input, h('span', label));
      if (title) {
        input.setAttribute('aria-label', title);
        attachTip(lab, () => title);
      }
      input.addEventListener('change', () => input.checked && setSort(value));
      wrap.append(lab);
      return input;
    };
    const inputs = [opt('cat', t('categories.board.sortCategory')), ...cat.tasks.map((k) => opt(k.key, fmtRank(k.no), t('categories.board.sortTask', { no: fmtRank(k.no), name: pick(k, 'name') })))];
    return {
      el: wrap,
      sync() {
        wrap.hidden = !state.open;
        for (const i of inputs) i.checked = i.value === state.sort;
      },
    };
  }

  function setSort(value) {
    if (state.sort === value) return;
    state.sort = value;
    refresh({ animate: true });
  }

  // ---------- rows ----------
  const vendorOk = (m) => !tb.state.vendors.size || tb.state.vendors.has(m.vendor);

  function compute() {
    const catList = rankBy(data, cat.key);
    const catMap = new Map(catList.map((e) => [e.id, e]));
    const sortList = state.sort === 'cat' ? catList : rankBy(data, state.sort);
    const ordered = sortList.map((e) => ({ ...catMap.get(e.id), sortRank: e.rank, sortValue: e.value }));
    return { shown: ordered.filter((e) => vendorOk(e.model) && tb.matches(e.model)) };
  }

  function axisNode() {
    return h(
      'span.cat-axis',
      [0, 20, 40, 60, 80, 100].map((v) => h('span.cat-tick', { class: v === 0 ? 'is-first' : v === 100 ? 'is-last' : null, style: { left: `${v}%` } }, String(v))),
    );
  }

  // the rank cell (shared hook): the category rank, or the rank by the task the board is sorted by
  function rankCell(cell, entry, ctx) {
    const m = entry.model;
    if (entry.value == null) ctx.sr.textContent = t('categories.board.ariaPending', { name: modelLabel(m), done: catDone(entry.id), all: cat.tasks.length });
    const byTask = state.sort !== 'cat';
    const rank = byTask ? entry.sortRank : entry.rank != null && entry.value != null ? entry.rank : null;
    if (rank != null) cell.textContent = fmtRank(rank);
    else cell.replaceChildren(h('span.st-state.is-draft', t('common.score.pending')));
    if (!byTask) return;
    const task = data.task(state.sort);
    ctx.sr.textContent =
      rank != null
        ? t('categories.board.ariaTask', { task: pick(task, 'name'), rank, name: modelLabel(m), score: fmtScore(entry.value) })
        : t('categories.board.ariaTaskPending', { task: pick(task, 'name'), name: modelLabel(m) });
  }

  // what this board adds to a row: the per-task sub rows
  function decorate(li, entry) {
    renderSubs(li, entry);
  }

  // ---------- sub rows: one per task ----------
  function renderSubs(li, entry) {
    let box = li.querySelector(':scope > .cat-subs');
    if (!state.open) {
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
    const animate = growSubs && isInView(li);
    [...box.children].forEach((row, i) => {
      const k = data.task(row.dataset.task);
      const v = s.tasks?.[k.key] ?? null;
      const rank = v == null ? null : rankBy(data, k.key, { ids: [entry.id] })[0]?.rank;
      fillSub(row, k, v, rank === 1, { animate, delay: animate ? dur('expand') * 0.5 + i * stagger('row', cat.tasks.length, 120) : 0 });
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
    row.classList.toggle('is-sort', state.sort === k.key);
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
  function paintFoot() {
    countEl.textContent = t('categories.board.count', { n: current.shown.length });
    if (foot.firstChild !== countEl) foot.replaceChildren(countEl);
  }

  // more than ROWS rows: the box is as tall as the head and the first ROWS rows (sub rows included) and scrolls
  function fitScroll() {
    const rows = ol.children;
    const on = rows.length > ROWS;
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

  function refresh({ animate = true } = {}) {
    seg?.sync();
    if (!list) return;
    current = compute();
    list.update(current.shown, { animate });
    paintFoot();
    fitScroll();
    if (!focused) showFocus();
  }

  /** Open or close the task sub rows: rows reveal top-down, what is below moves with them. */
  let busy = false;
  async function setOpen(on, { animate = true } = {}) {
    if (!multi || on === state.open || !list || busy) return;
    const go = animate && dur('expand') > 0;
    busy = true;
    toggle.setAttribute('aria-expanded', String(on));
    if (!on && go) {
      const boxes = [...ol.querySelectorAll('.cat-subs')].filter(isInView);
      await Promise.all(boxes.map((b) => play(b, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], { duration: durOut('expand'), easing: 'mech', fill: 'forwards' })));
    }
    busy = false;
    state.open = on;
    if (!on) state.sort = 'cat';
    const moving = go ? below(el) : [];
    growSubs = on && go;
    flip(moving, () => refresh({ animate: go }), { duration: on ? 'expand' : durOut('expand') });
    growSubs = false;
    if (on && go) {
      for (const b of ol.querySelectorAll('.cat-subs')) if (isInView(b)) play(b, [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 'expand', easing: 'mech', fill: 'none' });
      seg.el.classList.remove('st-in-wipe');
      void seg.el.offsetWidth;
      seg.el.classList.add('st-in-wipe');
    }
    onToggle?.(cat.key, on);
  }

  toggle?.addEventListener('click', () => setOpen(!state.open));

  return {
    el,
    key: cat.key,
    get open() {
      return state.open;
    },
    refresh,
    setOpen,
  };
}
