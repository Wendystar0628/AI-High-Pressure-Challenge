// Numbers behind the leaderboard: custom weights, the entries for the model
// rows (sorted and filtered), and the best values each view highlights.
// Everything is computed from the data; nothing about the models is fixed.
import { rankBy, modelStatus, round1 } from '../../core/index.js';
import { hasCosts } from '../../ui/cost.js';

/** Sorting by test cost: cheapest first, or (cost-desc) dearest first. */
export const COST_SORTS = ['cost', 'cost-desc'];
export const isCostSort = (k) => COST_SORTS.includes(k);
/** Sorting by one part of the total (a kind of tasks or a category): the bar and the big number show that part. */
export const isPartSort = (k) => k !== 'total' && !isCostSort(k);

export const VIEWS = ['total', 'pass', 'parts', 'kinds', 'matrix', 'compare'];
export const PASS = 60;
export const SLIDER = { min: 0, max: 30, step: 0.5 };

/** { reason: 15, … } — the official category weights (percent). */
export function officialWeights(data) {
  return Object.fromEntries(data.categories.map((c) => [c.key, c.weight]));
}

const near = (a, b) => Math.abs(a - b) < 1e-9;

/** Do these slider values give the official weights (after normalising)? */
export function isOfficial(data, sliders) {
  const sum = data.categories.reduce((a, c) => a + (+sliders[c.key] || 0), 0);
  const off = data.categories.reduce((a, c) => a + c.weight, 0);
  if (!sum) return true;
  return data.categories.every((c) => near((+sliders[c.key] || 0) / sum, c.weight / off));
}

/** Slider values -> effective weights in percent, summing to 100. */
export function normWeights(data, sliders) {
  const sum = data.categories.reduce((a, c) => a + (+sliders[c.key] || 0), 0);
  return Object.fromEntries(data.categories.map((c) => [c.key, sum ? ((+sliders[c.key] || 0) / sum) * 100 : 0]));
}

export const sliderSum = (data, sliders) => data.categories.reduce((a, c) => a + (+sliders[c.key] || 0), 0);

const clampSlider = (v) => Math.min(SLIDER.max, Math.max(SLIDER.min, Math.round(v / SLIDER.step) * SLIDER.step));

/** ?w=15,15,10,… -> slider values, or null when absent or unusable. */
export function parseWeights(data, raw) {
  if (!raw) return null;
  const parts = String(raw).split(',').map((s) => parseFloat(s));
  if (parts.length !== data.categories.length || parts.some((v) => !Number.isFinite(v))) return null;
  const out = Object.fromEntries(data.categories.map((c, i) => [c.key, clampSlider(parts[i])]));
  return sliderSum(data, out) > 0 ? out : null;
}

/** Slider values -> "15,15,10,…" for the address. */
export const formatWeights = (data, sliders) => data.categories.map((c) => String(+(+sliders[c.key]).toFixed(1))).join(',');

/** The presets of the sandbox, as slider values. "All equal" is left out while the official weights are already equal. */
export function presets(data) {
  const off = officialWeights(data);
  const eq = Math.min(SLIDER.max, 100 / data.categories.length);
  const equal = Object.fromEntries(data.categories.map((c) => [c.key, clampSlider(eq)]));
  const only = (kind) => Object.fromEntries(data.categories.map((c) => [c.key, c.kind === kind ? off[c.key] : 0]));
  return [
    { key: 'official', sliders: { ...off } },
    ...(isOfficial(data, equal) ? [] : [{ key: 'equal', sliders: equal }]),
    { key: 'standard', sliders: only('standard') },
    { key: 'design', sliders: only('design') },
  ];
}

/** Sort options: total, the two kinds, each category (data order), then the test cost when the data has it. */
export function sortKeys(data) {
  return ['total', 'standard', 'design', ...data.categories.map((c) => c.key), ...(hasCosts(data) ? COST_SORTS : [])];
}

/**
 * The order by test cost (leaderboard.md 排序): models with an amount by cny (ascending, or descending for
 * cost-desc), equal amounts share a rank (1, 1, 3) and go by total score; then the ranked models without an
 * amount (数据暂缺, no rank), then the models still being tested (no rank), both by total score.
 * totalOf(id) is the total in use (custom weights included). Returns [{ id, value, rank }].
 */
function costOrder(data, desc, totalOf) {
  const cny = (id) => data.score(id)?.cost?.cny ?? null;
  const ranked = (id) => modelStatus(data, id) === 'ranked';
  const byTotal = (a, b) => (totalOf(b) ?? -1) - (totalOf(a) ?? -1);
  const priced = data.order.filter((id) => ranked(id) && cny(id) != null).sort((a, b) => (desc ? cny(b) - cny(a) : cny(a) - cny(b)) || byTotal(a, b));
  let rank = 0;
  let prev = null;
  const out = priced.map((id, i) => {
    if (cny(id) !== prev) {
      rank = i + 1;
      prev = cny(id);
    }
    return { id, value: cny(id), rank };
  });
  const rest = data.order.filter((id) => !priced.includes(id)).sort((a, b) => (ranked(a) ? 0 : 1) - (ranked(b) ? 0 : 1) || byTotal(a, b));
  return out.concat(rest.map((id) => ({ id, value: null, rank: null })));
}

const maxOf = (vals) => {
  const v = vals.filter((x) => x != null);
  return v.length ? Math.max(...v.map(round1)) : null;
};

/**
 * Everything one render needs.
 *   S: { sort, sliders, custom }
 * Returns {
 *   info: Map<id, { id, model, status, total, totalRank, officialRank, delta, sortRank, sortValue,
 *                   std, des, cats:{k}, tasks:{k}, contrib:{k} }>,
 *   order: [id]   (sorted by S.sort; ranked first, then the rest),
 *   best: { total, std, des, cat:{k}, task:{k}, contrib:{k}, sort },   (sort: the best value of a score sort)
 *   weights: effective weights {k: pct} (official when not custom),
 *   pass: { yes, no }   (by the sorted score: the total, or the part sorted by),
 *   costMax: the largest test cost (¥) of a ranked model, or null
 * }
 */
export function compute(data, S) {
  const weights = S.custom ? normWeights(data, S.sliders) : officialWeights(data);
  const wsum = data.categories.reduce((a, c) => a + weights[c.key], 0) || 1;
  const opts = S.custom ? { weights } : {};
  const totals = rankBy(data, 'total', opts);
  const official = S.custom ? rankBy(data, 'total') : totals;
  const offRank = new Map(official.map((e) => [e.id, e.rank]));
  const totRank = new Map(totals.map((e) => [e.id, e]));
  const sorted = S.sort === 'total' ? totals : isCostSort(S.sort) ? costOrder(data, S.sort === 'cost-desc', (id) => totRank.get(id)?.value ?? null) : rankBy(data, S.sort);

  const info = new Map();
  for (const id of data.order) {
    const s = data.score(id);
    const status = modelStatus(data, id);
    const te = totRank.get(id);
    const cats = {};
    const contrib = {};
    for (const c of data.categories) {
      const v = s.categories?.[c.key] ?? null;
      cats[c.key] = v;
      contrib[c.key] = v == null ? null : (v * weights[c.key]) / wsum;
    }
    const tasks = {};
    for (const k of data.tasks) tasks[k.key] = s.tasks?.[k.key] ?? null;
    const total = te?.value ?? null;
    const totalRank = te?.rank ?? null;
    const officialRank = offRank.get(id) ?? null;
    info.set(id, {
      id,
      model: data.model(id),
      status,
      total,
      totalRank,
      officialRank,
      delta: S.custom && totalRank != null && officialRank != null ? officialRank - totalRank : 0,
      sortRank: null,
      sortValue: null,
      std: s.kinds?.standard ?? null,
      des: s.kinds?.design ?? null,
      cats,
      tasks,
      contrib,
    });
  }
  for (const e of sorted) {
    const it = info.get(e.id);
    if (!it) continue;
    it.sortRank = e.rank;
    it.sortValue = e.value;
  }

  // Bests: only fully scored (ranked) models take part (leaderboard.md 评测中).
  const ranked = [...info.values()].filter((x) => x.status === 'ranked');
  const best = {
    total: maxOf(ranked.map((x) => x.total)),
    std: maxOf(ranked.map((x) => x.std)),
    des: maxOf(ranked.map((x) => x.des)),
    cat: Object.fromEntries(data.categories.map((c) => [c.key, maxOf(ranked.map((x) => x.cats[c.key]))])),
    task: Object.fromEntries(data.tasks.map((k) => [k.key, maxOf(ranked.map((x) => x.tasks[k.key]))])),
    contrib: Object.fromEntries(data.categories.map((c) => [c.key, maxOf(ranked.map((x) => x.contrib[c.key]))])),
  };
  const part = isPartSort(S.sort);
  best.sort = part ? maxOf(ranked.map((x) => x.sortValue)) : best.total;
  const passOf = (x) => (part ? x.sortValue : x.total);
  const passYes = ranked.filter((x) => passOf(x) != null && round1(passOf(x)) >= PASS).length;
  const costs = ranked.map((x) => data.score(x.id)?.cost?.cny).filter((v) => v != null && Number.isFinite(+v));
  return {
    info,
    order: sorted.map((e) => e.id),
    best,
    weights,
    pass: { yes: passYes, no: ranked.filter((x) => passOf(x) != null).length - passYes },
    costMax: costs.length ? Math.max(...costs.map(Number)) : null,
  };
}

export const isTop = (v, best) => v != null && best != null && round1(v) === best;

/** The three figures of the page head (official results only). */
export function headFigures(data) {
  const ranked = rankBy(data, 'total').filter((e) => e.ranked);
  const testing = data.order.length - ranked.length;
  const pass = ranked.filter((e) => round1(e.value) >= PASS).length;
  const n = Math.min(3, ranked.length);
  const gap = n >= 2 ? round1(ranked[0].value) - round1(ranked[n - 1].value) : null;
  return { models: ranked.length, testing, pass, gap, n };
}
