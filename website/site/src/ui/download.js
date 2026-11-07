// Data download (README 数据下载): CSV of the table on screen (current sort
// and filter), UTF-8 with BOM so Excel opens it cleanly; JSON of models,
// tasks and scores together. File name ai-octathlon-scores-<updated>.<ext>.
//
//   downloadCSV({ columns, rows, preface, filename })
//   downloadJSON(obj, filename)
//   downloadBundle()                          // the merged JSON
//   scoreTable(data, entries, { weights })    // the standard table (rank, model, vendor, total, kinds, 8 categories, 12 tasks, test cost)
import { bundle } from '../core/data.js';
import { t, pick } from '../core/i18n.js';
import { modelLabel } from '../core/names.js';
import { fmtPct, round1 } from '../core/format.js';
import { customTotal, modelStatus } from '../core/rank.js';
import { h } from '../core/dom.js';
import { hasCosts, costOf, costTag } from './cost.js';

/** ai-octathlon-scores-2026-11-04.csv */
export const dataFilename = (updated, ext) => `ai-octathlon-scores-${updated || 'data'}.${ext}`;

function save(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// 数字照数据原样写：整数写整数（78 而不是 78.0），小数保留数据里的位数（74.7、12.25）；
// 只有算出来的长小数（自定义权重的总分）按分数的规则留一位。
const num = (v) => {
  const s = String(v);
  return /\.\d{3,}|e/i.test(s) ? String(round1(v)) : s;
};

const cell = (v) => {
  if (v == null) return '';
  const s = typeof v === 'number' ? num(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * columns: [{ key, label }] (rows are objects) or [label] (rows are arrays).
 * preface: an optional first line (e.g. the custom weights in use).
 */
export function toCSV({ columns, rows, preface }) {
  const keyed = columns.length && typeof columns[0] === 'object';
  const lines = [];
  if (preface) lines.push(cell(preface));
  lines.push(columns.map((c) => cell(keyed ? c.label : c)).join(','));
  for (const r of rows) lines.push((keyed ? columns.map((c) => r[c.key]) : r).map(cell).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function downloadCSV({ columns, rows, preface, filename, updated }) {
  const text = '﻿' + toCSV({ columns, rows, preface });
  save(new Blob([text], { type: 'text/csv;charset=utf-8' }), filename || dataFilename(updated, 'csv'));
}

export function downloadJSON(obj, filename) {
  save(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' }), filename || dataFilename(obj?.updated, 'json'));
}

/** models + tasks + scores in one JSON file. */
export async function downloadBundle(filename) {
  const b = await bundle();
  downloadJSON(b, filename || dataFilename(b.updated, 'json'));
}

/**
 * The standard score table for a list of entries (from rankBy, already sorted
 * and filtered the way the page shows them):
 * 名次, 模型, 厂商, 总分 (+ 自定义总分), 标准评判题, 主动设计题, 8 categories, 12 tasks,
 * and, when the data carries costs, 测试开销（元）, 开销依据, Token 合计.
 * With weights { reason: 15, … } adds the custom total column and a preface
 * line naming the weights.
 */
export function scoreTable(data, entries, { weights } = {}) {
  const withCost = hasCosts(data);
  const columns = [
    { key: 'rank', label: t('common.csv.rank') },
    { key: 'model', label: t('common.csv.model') },
    { key: 'vendor', label: t('common.csv.vendor') },
    { key: 'total', label: t('common.csv.total') },
    ...(weights ? [{ key: 'custom', label: t('common.csv.custom') }] : []),
    { key: 'standard', label: t('common.csv.standard') },
    { key: 'design', label: t('common.csv.design') },
    ...data.categories.map((c) => ({ key: `c:${c.key}`, label: pick(c, 'name') })),
    ...data.tasks.map((k) => ({ key: `t:${k.key}`, label: `${String(k.no).padStart(2, '0')} ${pick(k, 'name')}` })),
    ...(withCost
      ? [
          { key: 'cost', label: t('common.cost.csv.cny') },
          { key: 'costBasis', label: t('common.cost.csv.basis') },
          { key: 'tokens', label: t('common.cost.csv.tokens') },
        ]
      : []),
  ];
  const rows = entries.map((e) => {
    const s = data.score(e.id);
    const r = {
      rank: e.rank ?? t('common.csv.pending'),
      model: modelLabel(e.model ?? data.model(e.id)),
      vendor: (e.model ?? data.model(e.id)).vendor,
      total: modelStatus(data, e.id) === 'ranked' ? s.total : null,
      standard: s.kinds?.standard,
      design: s.kinds?.design,
    };
    if (weights) r.custom = customTotal(data, e.id, weights);
    for (const c of data.categories) r[`c:${c.key}`] = s.categories?.[c.key];
    for (const k of data.tasks) r[`t:${k.key}`] = s.tasks?.[k.key];
    if (withCost) {
      // amount as in the data (null: empty cell), its tag (按订阅折算 / API 实付 / 数据暂缺), the 12-task token total
      const cost = costOf(data, e.id);
      r.cost = cost?.cny;
      r.costBasis = costTag(cost);
      r.tokens = cost?.tokens;
    }
    return r;
  });
  const preface = weights ? `${t('common.csv.weights')}: ${data.categories.map((c) => `${pick(c, 'name')} ${fmtPct(weights[c.key] ?? c.weight)}`).join(' / ')}` : null;
  return { columns, rows, preface };
}
