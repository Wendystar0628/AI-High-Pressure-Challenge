// Long-form text of the reading pages (about, tasks, task) lives in
// website/site/content/<zh|en>/ as JSON:
//
//   content/<lang>/about.json                 the about page (the README, section by section)
//   content/<lang>/faq.json                   猜你想问: sections of questions (format and the en-by-id merge: src/pages/faq/model.js)
//   content/<lang>/tasks/<category>/<task>.json   the hand-filled blocks of one task page:
//     {
//       "brief":  [block, …],   题面要点：paragraphs and lists (block format below); empty = empty state
//       "points": ["**引词**：一两句", …],   考点：numbered 01, 02 … in order of importance
//       "scoring": ["**引词**：一句", …]     评分要点：the list under the figure
//     }
//
// Blocks (rich.js): a string is a paragraph; { "ul": [...] } / { "ol": [...], "start": n } lists, an item
// is a string or { "text", "blocks" }; { "table": { head, rows, num, bold0 } }; { "quote": "..." };
// { "details": { title, blocks } }; { "math": "TeX" } (tex.js); { "code": "...", "lang": "lean" };
// { "defs": [[label, text], ...] }; { "fig": "<figure key>" }. The task pages' 题干 (data/stems/) uses the same
// blocks, written by website/tools/export_data.py from the statements.
// Inline: **bold**, `code`, [text](href), $TeX$; href may be "#anchor", "about:#anchor",
// "task:<category>/<task>", "cat:<category>", "tasks:", "lb:", "gh:<path in the repo>" or a URL.
// {name} placeholders are filled from contentVars(data).
//
// English is merged over Chinese key by key (objects merge; strings and arrays replace;
// empty strings and empty arrays do not), so an untranslated paragraph shows the Chinese text.
import { lang } from '../core/index.js';

const files = import.meta.glob('../../content/*/**/*.json', { import: 'default' });

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/** Deep merge: `over` wins where it has a non-empty value. */
export function merge(base, over) {
  if (isEmpty(over)) return base;
  if (!isObj(base) || !isObj(over)) return over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in base ? merge(base[k], v) : v;
  return out;
}

async function read(path) {
  const f = files[`../../content/${path}.json`];
  try {
    return f ? await f() : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

/** loadContent('about') or loadContent('tasks/reason/formal-proof'): zh with en merged over it. */
export async function loadContent(name) {
  const zh = (await read(`zh/${name}`)) ?? {};
  if (lang !== 'en') return zh;
  const en = (await read(`en/${name}`)) ?? {};
  return merge(zh, en);
}

/** Numbers the long text may quote, computed from the data so they never go stale. */
export function contentVars(data) {
  if (!data) return {};
  const m = data.tasks.map((x) => x.minutes).filter(Number.isFinite);
  const std = data.kinds.standard;
  const des = data.kinds.design;
  const pct = (v) => `${+(+v).toFixed(1)}%`;
  return {
    nTasks: data.tasks.length,
    nCats: data.categories.length,
    nStd: std.tasks.length,
    nDes: des.tasks.length,
    nStdCats: std.categories.length,
    nDesCats: des.categories.length,
    wStd: pct(std.weight),
    wDes: pct(des.weight),
    minMin: Math.min(...m),
    maxMin: Math.max(...m),
  };
}
