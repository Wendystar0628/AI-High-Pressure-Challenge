// Model rows (leaderboard.md「共用部件 / 模型行」), used by the leaderboard,
// the category boards and the task pages.
//
// Columns: tick │ rank │ vendor icon │ full name │ plot │ score (│ test cost, with cost: true).
// The name is a link to the model scores page /models/<id>/ (with 名字接力);
// a click anywhere else in the row opens the side panel (data-model-panel on
// the row; for the keyboard a visually hidden button after the name does it).
// Fixed row height, hairlines between rows, no zebra. Pointing at / focusing
// a row drops the violet bar on its left, turns the ground to paper and
// deepens the plot one step; a ticked row keeps the bar and the deeper plot.
//
//   import { createModelList, createRowHead, barPlot } from '../../ui/modelRow.js';
//   const list = createModelList(ol, { data, kind: 'design', plot: barPlot });
//   list.update(rankBy(data, 'game'));          // keyed by id; reorders with FLIP, new rows step in
//   const head = createRowHead({ rank: '名次', name: '模型', score: '分数', plot: axisNode });
//
// 每行（entry）除 rankBy 的 { id, model, value, rank, ranked } 外还可以带：
//   best   true / false：全场最佳标记（分数垫荧光绿、柱尾荧光绿四角星），不写时“名次 1 即最佳”
//   note   行内备注：画在图区里（没出分的行在斜线纹上，有分的行跟在柱尾后）；
//          没出分又没写时是「已出 8 / 12 题」，写 '' 就不显示
// 列表选项里的 best / note 可以是函数 (entry) => 值，按行算；note 写成字符串时只给没出分的行。
//
// A plot function draws into the row's plot cell: plot(cell, entry, ctx)
//   cell  <span class="mrow-plot">, entry, ctx { data, kind, best, note, first, animate, delay, pass, grid, row }
// barPlot is the default: a 0–100 bar on the fixed scale (charts/bar.js), flare star at the end when best.
//
// 名次格的定制钩子 rank(cell, entry, ctx)：替代默认的「01」/「评测中」，自己往格里写；
// 它在本行的读屏句（ctx.sr）写好之后跑，需要时可以改写那一句。
//
// 测试开销列（cost: true，排行总榜用）：分数后面多两格，同一行、竖直居中——.mrow-cost 金额 ¥23.4 后跟依据小记号
// （○ 按订阅折算、◆ API 实付，形状区分；金额为 null 写「数据暂缺」），.mrow-tok 12 题合计 Token（有拟合的题时后跟 *）；
// 记号的意思由页面写一次图例（ui/cost.js costLegend）；
// 取 scores.<id>.cost（ui/cost.js），读屏句末尾接一句开销。表头 createRowHead({ cost: '测试开销', tokens: 'Token' }) 同列。
import { h } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { modelName, vendorIcon, modelLabel } from '../core/names.js';
import { links } from '../core/route.js';
import { fmtScore, fmtRank } from '../core/format.js';
import { progress } from '../core/rank.js';
import { getCompare, toggleCompare, isCompareFull, compareIndex, onCompareChange } from './compare.js';
import { dur, flip, stagger, isInView } from '../motion.js';
import { createBar, setBar } from '../charts/bar.js';
import { GRID } from '../charts/axis.js';
import { rowsToSVG } from '../charts/export.js';
import { costOf, fillCost, fillTokens, costSr } from './cost.js';

/**
 * Default plot: a bar from 0 to the value on the fixed 0–100 scale, faint grid
 * (ctx.grid, default 20/40/80) and a dashed pass line at 60 when ctx.pass.
 * 0 points: a zero-length mark; no score: hatch and "已出 8 / 12 题" (or ctx.note).
 */
export function barPlot(cell, entry, ctx) {
  let svg = cell.querySelector(':scope > svg.bar-svg');
  if (!svg) {
    svg = createBar({ grid: ctx.grid ?? GRID, pass: !!ctx.pass, className: 'mrow-svg' });
    cell.append(svg, h('span.mrow-best', { 'aria-hidden': 'true' }), h('span.mrow-note'));
  }
  const v = entry.value;
  const w = setBar(svg, v, {
    duration: ctx.animate ? (ctx.first ? dur('power') : dur('morph')) : 0,
    delay: ctx.delay ?? 0,
    from0: ctx.first && ctx.animate,
  });
  const best = cell.querySelector(':scope > .mrow-best');
  best.hidden = !(ctx.best && v != null);
  best.style.left = `${w}%`;
  const note = cell.querySelector(':scope > .mrow-note');
  const text = ctx.note != null ? ctx.note : v == null ? t('common.score.progress', progress(ctx.data, entry.id)) : '';
  note.textContent = text;
  // a note on a scored row follows the end of its bar (past the star)
  note.classList.toggle('is-after', v != null && !!text);
  note.style.setProperty('--at', v != null && text ? `calc(${w}% + ${ctx.best ? '1.5rem' : '0.4rem'})` : '');
}

/**
 * The header row with the same grid: createRowHead({ rank, name, score, plot }).
 * The whole head is hidden from screen readers by default (every row reads as
 * one sentence); with hidden: false its labels stay readable and only the
 * decorative cells (tick and icon placeholders, a plot without links) are hidden.
 */
export function createRowHead({ rank = t('common.csv.rank'), name = t('common.csv.model'), score = t('common.score.total'), plot = null, cost = null, tokens = null, checkable = true, hidden = true } = {}) {
  const deco = { 'aria-hidden': 'true' };
  const plotLive = plot instanceof Element && plot.querySelector('a, button, input, select');
  return h(
    'div.mrow.mrow-head',
    { class: [checkable ? null : 'no-check', cost != null ? 'has-cost' : null].filter(Boolean).join(' ') || null, 'aria-hidden': hidden ? 'true' : null },
    h('span.mrow-check', deco),
    h('span.mrow-rank', rank),
    h('span.mrow-icon', deco),
    h('span.mrow-name', name),
    h('span.mrow-plot', plotLive ? null : deco, plot),
    h('span.mrow-score', score),
    cost != null ? h('span.mrow-cost', cost) : null,
    cost != null ? h('span.mrow-tok', tokens ?? '') : null,
  );
}

// per-row values that may come from the entry or, as a function or a constant, from the list options
const bestOf = (entry, opts) => entry.best ?? (typeof opts.best === 'function' ? opts.best(entry) : opts.best) ?? entry.rank === 1;
function noteOf(entry, opts) {
  if (entry.note !== undefined) return entry.note;
  if (typeof opts.note === 'function') return opts.note(entry);
  return entry.value == null ? opts.note : undefined;
}

/**
 * One row element. entry: { id, model, value, rank, ranked, best?, note? } (from rankBy).
 * opts: { data, kind: 'series'|'standard'|'design', plot = barPlot, checkable = true, cost = false,
 *         best, note, grid, pass, scoreText(entry), rankText(entry), rank(cell, entry, ctx) }
 */
export function createModelRow(entry, opts) {
  const { checkable = true } = opts;
  const li = h('li.mrow', { dataset: { id: entry.id, modelPanel: entry.id }, class: [`is-${opts.kind ?? 'series'}`, checkable ? null : 'no-check', opts.cost ? 'has-cost' : null].filter(Boolean).join(' ') });
  const check = checkable
    ? h('input', {
        type: 'checkbox',
        class: 'mrow-tick',
        'aria-label': t('common.toolbar.compareAdd', { name: modelLabel(entry.model) }),
      })
    : null;
  check?.addEventListener('change', () => {
    if (!toggleCompare(entry.id, check.checked)) check.checked = false;
  });
  // 原生 append 会把 null 写成文字「null」，没有开销列的页面（题目类别榜）要先滤掉空格位
  li.append(...[
    h('label.mrow-check', check),
    h('span.mrow-rank.num', { 'aria-hidden': 'true' }),
    h('span.mrow-icon', vendorIcon(entry.model)),
    h(
      'span.mrow-name',
      h('a.mrow-open', { href: links.model(entry.id), title: t('common.row.openPage', { name: modelLabel(entry.model) }) }, nameEl(entry.model)),
      h('button.mrow-panel.sr-only', { type: 'button', 'data-model-panel': entry.id }, t('common.row.openPanel', { name: modelLabel(entry.model) })),
    ),
    h('span.mrow-plot', { 'aria-hidden': 'true' }),
    h('span.mrow-score.num', { 'aria-hidden': 'true' }),
    opts.cost ? h('span.mrow-cost', { 'aria-hidden': 'true' }) : null,
    opts.cost ? h('span.mrow-tok', { 'aria-hidden': 'true' }) : null,
    h('span.sr-only.mrow-sr'),
  ].filter(Boolean));
  fillRow(li, entry, opts, { first: true, animate: false });
  return li;
}

// the name carries 名字接力 to the model page's title
function nameEl(model) {
  const el = modelName(model);
  el.dataset.relayName = '';
  return el;
}

function fillRow(li, entry, opts, { first, animate, delay = 0 }) {
  const ranked = entry.rank != null && entry.value != null;
  const rankCell = li.querySelector('.mrow-rank');
  const scoreCell = li.querySelector('.mrow-score');
  const sr = li.querySelector('.mrow-sr');
  const best = !!bestOf(entry, opts) && entry.value != null;
  const note = noteOf(entry, opts);
  const txt = opts.scoreText ? opts.scoreText(entry) : fmtScore(entry.value);
  scoreCell.replaceChildren(best ? h('span.st-hi', txt) : txt);
  li.classList.toggle('is-best', best);
  li.classList.toggle('is-pending', !ranked);
  const pr = opts.data ? progress(opts.data, entry.id) : { done: 0, all: 0 };
  sr.textContent = ranked
    ? t('common.row.aria', { rank: entry.rank, name: modelLabel(entry.model), score: txt })
    : t('common.row.ariaPending', { name: modelLabel(entry.model), ...pr });
  const ctx = { data: opts.data, kind: opts.kind, best, note, first, animate, delay, pass: opts.pass, grid: opts.grid, row: li, sr };
  if (opts.rank) opts.rank(rankCell, entry, ctx);
  else if (opts.rankText) rankCell.textContent = opts.rankText(entry);
  else if (ranked) rankCell.textContent = fmtRank(entry.rank);
  else rankCell.replaceChildren(h('span.st-state.is-draft', t('common.score.pending')));
  const plot = opts.plot === undefined ? barPlot : opts.plot;
  if (plot) plot(li.querySelector('.mrow-plot'), entry, ctx);
  // test cost: the cell, and one more clause for screen readers (after the rank hook, which may rewrite the sentence)
  const costCell = li.querySelector(':scope > .mrow-cost');
  if (costCell && opts.data) {
    const cost = costOf(opts.data, entry.id);
    fillCost(costCell, cost);
    const tokCell = li.querySelector(':scope > .mrow-tok');
    if (tokCell) fillTokens(tokCell, cost);
    sr.textContent = t('common.cost.srAppend', { text: sr.textContent, cost: costSr(cost) });
  }
}

function syncTicks(rows) {
  const ids = getCompare();
  const full = isCompareFull();
  for (const [id, li] of rows) {
    const box = li.querySelector('.mrow-tick');
    const on = ids.includes(id);
    li.classList.toggle('is-checked', on);
    li.style.setProperty('--cmp', on ? compareIndex(id) : 0);
    if (!box) continue;
    box.checked = on;
    box.disabled = !on && full;
    box.title = !on && full ? t('common.toolbar.compareFull') : '';
  }
}

/**
 * A keyed list of model rows in an <ol>. update(entries) adds, removes,
 * refills and reorders rows (FLIP), only animating what is in view.
 * Options: as createModelRow, plus { empty: text shown when no entries, animateIn: true }.
 * Returns { el, rows: Map<id, li>, update(entries, { animate }), destroy() }.
 */
export function createModelList(target, opts) {
  const ol = target.tagName === 'OL' || target.tagName === 'UL' ? target : target.appendChild(h('ol'));
  ol.classList.add('mrows');
  const rows = new Map();
  const empty = h('p.mrows-empty', { hidden: true }, opts.empty ?? t('common.toolbar.noMatch'));
  ol.after(empty);
  let firstRun = true;
  const off = onCompareChange(() => syncTicks(rows));

  function update(entries, { animate = true } = {}) {
    const want = new Set(entries.map((e) => e.id));
    const leaving = [...rows].filter(([id]) => !want.has(id));
    const animateNow = animate && dur('come') > 0;
    const doUpdate = () => {
      for (const [id, li] of leaving) {
        li.remove();
        rows.delete(id);
      }
      const fresh = [];
      entries.forEach((e, i) => {
        let li = rows.get(e.id);
        const isNew = !li;
        if (isNew) {
          li = createModelRow(e, opts);
          rows.set(e.id, li);
          fresh.push(li);
        }
        ol.append(li);
        const inView = isInView(li);
        fillRow(li, e, opts, {
          first: isNew,
          animate: animateNow && inView && (!firstRun || opts.animateIn !== false),
          delay: isNew && firstRun ? i * stagger('row', entries.length, 260) : 0,
        });
        if (isNew && !firstRun && animateNow) {
          li.classList.add('st-in-come');
          li.style.setProperty('--i', fresh.length - 1);
          li.addEventListener('animationend', () => li.classList.remove('st-in-come'), { once: true });
        }
      });
      empty.hidden = entries.length > 0;
      syncTicks(rows);
    };
    const stay = [...rows.values()].filter((li) => want.has(li.dataset.id));
    if (!animateNow || firstRun) doUpdate();
    else if (leaving.length) {
      // filtered-out rows fold away first, then the rest close up
      Promise.all(leaving.map(([, li]) => li.animate([{ opacity: 1, clipPath: 'inset(0)' }, { opacity: 0, clipPath: 'inset(0 0 0 100%)' }], { duration: dur('rowOut'), easing: 'cubic-bezier(0.7,0,0.2,1)', fill: 'forwards' }).finished.catch(() => {}))).then(() =>
        flip(stay, doUpdate, { duration: 'reorder' }),
      );
    } else flip(stay, doUpdate, { duration: 'reorder', delay: (el, i) => i * stagger('row', stay.length, 120) });
    firstRun = false;
  }

  return {
    el: ol,
    rows,
    update,
    destroy() {
      off();
      empty.remove();
      ol.replaceChildren();
      rows.clear();
    },
  };
}

/**
 * "存为图片" for a list of model rows: the head and every visible row, sub rows
 * (.mrow-sub) included, as one SVG (charts/export.js rowsToSVG).
 * Returns Promise<{ svg, width, height }> for exportButton({ build }).
 */
export function listToSVG(ol, { head } = {}) {
  return rowsToSVG([head, ...ol.querySelectorAll(':scope > li.mrow')]);
}
