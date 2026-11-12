// 按题 view of a category board: one block per measure, the category score
// first, then each task; every block ranks all models by its own measure, on
// the same fixed 0–100 scale. A model looks the same in every block (rank,
// vendor icon, full name with effort, bar, score); pointing at it in one
// block lights it up in all of them. The name link and the side panel work as
// in any model row; ticked models stay marked (ticking itself is in 矩阵 and
// 按型号, the blocks are too narrow for a tick column). A single-task category has one block (the task
// is the category score).
//
//   const v = createByTask(cat, { data, tb });
//   v.el; v.refresh({ animate }); v.build()   // build(): 存为图片
import { h, t, pick, links, rankBy, fmtPct, fmtRank, modelLabel } from '../../core/index.js';
import { createModelList, createRowHead, barPlot, showTip, hideTip } from '../../ui/index.js';
import { cellState, cellMark, cellTip } from '../../ui/cells.js';
import { rowsToSVG } from '../../charts/index.js';

const GRID = [20, 40, 60, 80];

export function createByTask(cat, { data, tb }) {
  const multi = cat.tasks.length > 1;
  const blocks = [
    { col: { type: 'category', key: cat.key }, title: t('categories.byTask.category'), sub: t('categories.board.weight', { w: fmtPct(cat.weight) }) },
    ...(multi ? cat.tasks : []).map((k) => ({ col: { type: 'task', key: k.key }, task: k, sub: t('categories.board.weight', { w: fmtPct(k.weight) }) })),
  ];
  if (!multi) {
    const k = cat.tasks[0];
    blocks[0].task = k;
    blocks[0].title = t('categories.byTask.single');
  }

  const el = h('div.cbt', { class: `n-${blocks.length}` });
  for (const b of blocks) {
    const k = b.task;
    const title = k
      ? h('a.cbt-name', { href: links.task(k) }, h('span.num.cbt-no', fmtRank(k.no)), ' ', h('span', pick(k, 'name')))
      : h('span.cbt-name', b.title);
    const head = h(
      'header.cbt-head',
      h('h3.cbt-title', !multi ? h('span.cbt-kicker', b.title) : null, title),
      h('span.cbt-sub.st-field', b.sub),
    );
    const rowHead = createRowHead({ rank: t('categories.board.rank'), name: t('categories.board.model'), score: t('categories.byTask.score'), plot: axisNode(), checkable: false });
    const ol = h('ol');
    b.head = head;
    b.rowHead = rowHead;
    b.list = createModelList(ol, {
      data,
      kind: cat.kind === 'design' ? 'design' : 'standard',
      checkable: false,
      grid: GRID,
      empty: t('categories.board.noMatch'),
      note: (e) => (e.value == null ? stateNote(e.id, b.col) : undefined),
      rank: (cell, e, ctx) => {
        if (e.value != null) {
          cell.textContent = fmtRank(e.rank);
          return;
        }
        const st = cellState(data, e.id, b.col);
        cell.replaceChildren(h('span.st-state.is-draft', cellMark(st)));
        ctx.sr.textContent = `${modelLabel(e.model)}，${stateNote(e.id, b.col)}`;
      },
      plot: barPlot,
    });
    b.el = h('section.cbt-block', { dataset: { col: b.col.key } }, head, rowHead, ol);
    el.append(b.el);
  }

  function stateNote(id, col) {
    if (col.type === 'category') {
      const done = cat.tasks.filter((k) => data.score(id).tasks?.[k.key] != null).length;
      return t('categories.board.progress', { done, all: cat.tasks.length });
    }
    return t(`common.cell.state.${cellState(data, id, col)}`);
  }

  // ---------- one model lit up in every block ----------
  let lit = null;
  function light(id) {
    if (id === lit) return;
    lit = id;
    for (const li of el.querySelectorAll('li.mrow')) li.classList.toggle('is-linked', li.dataset.id === id);
    el.classList.toggle('has-linked', id != null);
  }
  el.addEventListener('pointerover', (e) => light(e.target.closest('li.mrow')?.dataset.id ?? null));
  el.addEventListener('pointerleave', () => light(null));
  el.addEventListener('focusin', (e) => light(e.target.closest('li.mrow')?.dataset.id ?? null));
  el.addEventListener('focusout', () => light(null));

  // pointing at a bar: the same details as a matrix cell (graders, anomaly, weight)
  el.addEventListener('pointermove', (e) => {
    const plot = e.target.closest('.mrow-plot, .mrow-score');
    const li = plot?.closest('li.mrow');
    if (!li) return hideTip();
    const b = blocks.find((x) => x.el.contains(li));
    showTip(cellTip(data, li.dataset.id, b.col), { x: e.clientX, y: e.clientY - 6 });
  });
  el.addEventListener('pointerleave', hideTip);

  function refresh({ animate = true } = {}) {
    for (const b of blocks) b.list.update(rankBy(data, b.col.key).filter((e) => tb.matches(e.model)), { animate });
  }

  /** 存为图片: every block's title, head row and rows where they are on the page. */
  function build() {
    return rowsToSVG(
      blocks.flatMap((b) => [b.head, b.rowHead, ...b.el.querySelectorAll(':scope > ol > li.mrow')]),
      { span: false },
    );
  }

  return {
    el,
    refresh,
    build,
    get count() {
      return blocks[0].list.rows.size;
    },
  };
}

function axisNode() {
  return h(
    'span.cat-axis',
    [0, 20, 40, 60, 80, 100].map((v) => h('span.cat-tick', { class: v === 0 ? 'is-first' : v === 100 ? 'is-last' : null, style: { left: `${v}%` } }, String(v))),
  );
}
