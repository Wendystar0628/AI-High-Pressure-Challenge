// Data loading with caching. The site only reads site/data/*.json (written by
// website/tools/export_data.py). Shapes: see website/docs/README.md「数据」 and
// site/README.md. loadData() returns one derived object shared by all modules.
import { links } from './route.js';

const cache = new Map();

/** Fetch one data file once per page: fetchJSON('models') -> Promise<any> */
export function fetchJSON(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      fetch(links.data(`${name}.json`), { cache: 'no-cache' }).then((r) => {
        if (!r.ok) throw new Error(`${name}.json: HTTP ${r.status}`);
        return r.json();
      }),
    );
  }
  return cache.get(name);
}

let dataPromise = null;

/**
 * Everything the pages need, derived once:
 * {
 *   updated: '2026-11-04',
 *   models: [model],                 // models.json order (export keeps total-rank order in scores.order)
 *   order: [id],                     // scores.order: official order (ranked by total, then testing)
 *   categories: [category],          // tasks.json: { key, name, en, short, short_en, icon, weight, kind, brief, tasks:[task] }
 *   tasks: [task],                   // flat, by no 1..13: { key, path, no, category, name, name_en, short, weight, minutes, kind, ... }
 *   scores: { id: score },           // scores.json scores
 *   vendors: [{ vendor, logo, count }],  // by model count, then name
 *   kinds: { standard: { weight, categories:[key], tasks:[key] }, design: {...} },
 *   costSource: scores.cost_source { name, url, fetched, usd_cny } or null   // 测试开销的换算依据；各模型的 cost 在 scores[id].cost
 *   notice: scores.notice { zh, en } or null   // 暂停公示（website/tools/site.json）：打开时没有任何模型，成绩页只显示这句
 *   model(id), category(key), task(key), score(id), categoryOf(taskKey)
 * }
 */
export function loadData() {
  if (!dataPromise) {
    dataPromise = Promise.all([fetchJSON('models'), fetchJSON('tasks'), fetchJSON('scores')]).then(([models, cats, sc]) => derive(models, cats, sc));
  }
  return dataPromise;
}

/** search.json items: [{ type, id, name, en, short, short_en, terms, py, pyi, category, page, parent, href }] */
export function loadSearch() {
  return fetchJSON('search').then((s) => (Array.isArray(s) ? s : s.items ?? []));
}

function derive(models, cats, sc) {
  const scores = sc?.scores ?? {};
  const categories = cats.map((c) => ({
    ...c,
    kind: c.kind ?? c.tasks?.[0]?.kind ?? 'standard',
    tasks: (c.tasks ?? []).map((t) => ({ ...t, category: t.category ?? c.key, path: t.path ?? `${c.key}/${t.key}` })),
  }));
  let n = 0;
  const tasks = categories.flatMap((c) => c.tasks).map((t) => ({ ...t, no: t.no ?? ++n }));
  tasks.sort((a, b) => a.no - b.no);
  // keep category.tasks pointing at the same objects as the flat list
  const byTask = new Map(tasks.map((t) => [t.key, t]));
  for (const c of categories) c.tasks = c.tasks.map((t) => byTask.get(t.key));

  const byModel = new Map(models.map((m) => [m.id, m]));
  const byCat = new Map(categories.map((c) => [c.key, c]));
  const order = (sc?.order ?? models.map((m) => m.id)).filter((id) => byModel.has(id));
  for (const m of models) if (!order.includes(m.id)) order.push(m.id);

  const vendorMap = new Map();
  for (const m of models) {
    const v = vendorMap.get(m.vendor) ?? { vendor: m.vendor, logo: m.logo, count: 0 };
    v.count++;
    vendorMap.set(m.vendor, v);
  }
  const vendors = [...vendorMap.values()].sort((a, b) => b.count - a.count || a.vendor.localeCompare(b.vendor));

  const kinds = {};
  for (const k of ['standard', 'design']) {
    const cs = categories.filter((c) => c.kind === k);
    kinds[k] = { weight: cs.reduce((a, c) => a + c.weight, 0), categories: cs.map((c) => c.key), tasks: cs.flatMap((c) => c.tasks.map((t) => t.key)) };
  }

  return {
    updated: sc?.updated ?? '',
    models,
    order,
    categories,
    tasks,
    scores,
    vendors,
    kinds,
    costSource: sc?.cost_source ?? null,
    notice: sc?.notice ?? null,
    model: (id) => byModel.get(id),
    category: (key) => byCat.get(key),
    task: (key) => byTask.get(key),
    score: (id) => scores[id] ?? { total: null, kinds: {}, categories: {}, tasks: {} },
    categoryOf: (taskKey) => byCat.get(byTask.get(taskKey)?.category),
  };
}

/** The three source files merged into one object (for "download JSON"). */
export async function bundle() {
  const [models, tasks, scores] = await Promise.all([fetchJSON('models'), fetchJSON('tasks'), fetchJSON('scores')]);
  const out = { updated: scores.updated, models, tasks, scores: scores.scores, order: scores.order };
  if (scores.cost_source) out.cost_source = scores.cost_source; // 测试开销的换算依据（各模型的 cost 在 scores 里）
  return out;
}
