// What one score cell says beyond its number (the matrix and the per-task
// blocks): why a task has no score yet, each grader's score of a design task,
// the graders' anomaly notes, and the weight. Data: scores.<id>.task_info
// (website/tools/export_data.py task_info), absent when there is nothing to add.
//
//   cellState(data, id, col)      null (scored) | 'testing' | 'missing' | 'failed' | 'unscored'
//   cellMark(state)               the short mark written in a grey cell: 评测中 / 未交 / 失败 / —
//   cellTip(data, id, col)        the tooltip node (ui/tip.js showTip)
// col: { type: 'task' | 'category' | 'total', key }
import { h } from '../core/dom.js';
import { t, pick } from '../core/i18n.js';
import { modelLabel } from '../core/names.js';
import { fmtScore, fmtPct, fmtRank, fmtRankOf } from '../core/format.js';
import { rankBy, progress } from '../core/rank.js';

export const colValue = (data, id, col) => {
  const s = data.score(id);
  if (col.type === 'total') return s.status === 'ranked' ? s.total ?? null : null;
  if (col.type === 'category') return s.categories?.[col.key] ?? null;
  return s.tasks?.[col.key] ?? null;
};

const info = (data, id, key) => data.score(id).task_info?.[key] ?? {};

/** Why the cell has no score (null when it has one). A category or the total is 评测中 while any of its tasks is out. */
export function cellState(data, id, col) {
  if (colValue(data, id, col) != null) return null;
  if (col.type === 'task') return info(data, id, col.key).state ?? 'testing';
  return 'testing';
}

export const cellMark = (state) => t(`common.cell.mark.${state}`);

/** The measure's name: "01 形式化证明题", the category, or 总分. */
export function colName(data, col) {
  if (col.type === 'total') return t('common.score.total');
  if (col.type === 'category') return t('common.cell.categoryScore', { name: pick(data.category(col.key), 'name') });
  const k = data.task(col.key);
  return `${fmtRank(k.no)} ${pick(k, 'name')}`;
}

/** The weight of the measure in the total: a task's or a category's share; none for the total. */
function weightOf(data, col) {
  if (col.type === 'task') return data.task(col.key).weight;
  if (col.type === 'category') return data.category(col.key).weight;
  return null;
}

/** "Claude Opus 5.5 (xhigh) │ 01 形式化证明题 62.5 │ 2 / 11", weight, graders, anomaly notes; or the state. */
export function cellTip(data, id, col) {
  const m = data.model(id);
  const v = colValue(data, id, col);
  const by = col.type === 'total' ? 'total' : col.key;
  const list = rankBy(data, by);
  const of = list.filter((e) => e.ranked).length;
  const rank = list.find((e) => e.id === id)?.rank ?? null;
  const lines = [h('b', modelLabel(m))];
  const state = cellState(data, id, col);
  if (state) {
    let why = t(`common.cell.state.${state}`);
    if (col.type === 'category') {
      const done = data.category(col.key).tasks.filter((k) => data.score(id).tasks?.[k.key] != null).length;
      why = t('common.score.progress', { done, all: data.category(col.key).tasks.length });
    } else if (col.type === 'total') why = t('common.score.progress', progress(data, id));
    lines.push(h('span', `${colName(data, col)} │ ${why}`));
  } else lines.push(h('span', `${colName(data, col)} ${fmtScore(v)} │ ${fmtRankOf(rank, of)}`));
  const w = weightOf(data, col);
  if (w != null) lines.push(h('span', t('common.cell.weight', { w: fmtPct(w) })));
  if (col.type === 'task') {
    const it = info(data, id, col.key);
    if (it.graders?.length) lines.push(h('span', t('common.cell.graders', { list: it.graders.map((g) => `${g.name} ${fmtScore(g.score)}`).join(' │ ') })));
    for (const a of it.anomaly ?? []) lines.push(h('span.site-tip-note', t('common.cell.anomaly', { grader: a.grader, text: a.text })));
  }
  return h('span.site-tip-lines', lines);
}

/** Does the model have an anomaly note on this task? (a small mark in the cell) */
export const hasAnomaly = (data, id, key) => !!info(data, id, key).anomaly?.length;
