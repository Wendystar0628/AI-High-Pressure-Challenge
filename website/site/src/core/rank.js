// Rankings, computed the same way as the export: values rounded to one
// decimal, equal values share a rank and the next rank skips (1, 1, 3),
// ties are listed by full name. A model takes part in a ranking only when
// that measure is complete for it (a whole category, all 13 tasks for the
// total). The others are listed after the ranked ones, rank null.
//
// `by` is one of: 'total' | 'standard' | 'design' | a category key | a task key.
import { round1 } from './format.js';

export function measureKind(data, by) {
  if (by === 'total' || by === 'standard' || by === 'design') return by;
  if (data.category(by)) return 'category';
  if (data.task(by)) return 'task';
  throw new Error(`unknown ranking measure: ${by}`);
}

/** Tasks scored / all tasks. */
export function progress(data, id) {
  const s = data.score(id);
  const all = data.tasks.length;
  const done = s.done ?? data.tasks.filter((t) => s.tasks?.[t.key] != null).length;
  return { done, all };
}

/** 'ranked' (all tasks scored) or 'testing' (评测中). */
export function modelStatus(data, id) {
  const s = data.score(id);
  if (s.status) return s.status === 'ranked' ? 'ranked' : 'testing';
  const p = progress(data, id);
  return p.done === p.all ? 'ranked' : 'testing';
}

/**
 * Total with custom category weights { reason: 15, ... } (any scale; they are
 * normalised). null unless every category has a score.
 */
export function customTotal(data, id, weights) {
  const s = data.score(id);
  let sum = 0;
  let wsum = 0;
  for (const c of data.categories) {
    const w = +(weights?.[c.key] ?? c.weight);
    if (!w) continue;
    const v = s.categories?.[c.key];
    if (v == null) return null;
    sum += v * w;
    wsum += w;
  }
  return wsum ? sum / wsum : null;
}

/** The value of a measure for a model, or null. */
export function valueOf(data, id, by, { weights } = {}) {
  const s = data.score(id);
  switch (measureKind(data, by)) {
    case 'total':
      if (weights) return modelStatus(data, id) === 'ranked' ? customTotal(data, id, weights) : null;
      return modelStatus(data, id) === 'ranked' ? s.total : null;
    case 'standard':
    case 'design':
      return s.kinds?.[by] ?? null;
    case 'category':
      return s.categories?.[by] ?? null;
    default:
      return s.tasks?.[by] ?? null;
  }
}

/**
 * All models (or just `ids`) ranked by a measure:
 * [{ id, model, value, rank, ranked }] — ranked ones first (best first), then
 * the unranked ones (rank null) in official order.
 * Options: { ids, weights } (weights: custom category weights for 'total').
 * Ranks are always among ALL ranked models, even when `ids` is a subset.
 */
export function rankBy(data, by, { ids, weights } = {}) {
  const all = data.order.map((id) => {
    const value = valueOf(data, id, by, { weights });
    return { id, model: data.model(id), value, rank: null, ranked: value != null };
  });
  const ranked = all.filter((e) => e.ranked).sort((a, b) => round1(b.value) - round1(a.value) || a.model.name.localeCompare(b.model.name));
  let prev = null;
  ranked.forEach((e, i) => {
    const v = round1(e.value);
    e.rank = prev && round1(prev.value) === v ? prev.rank : i + 1;
    prev = e;
  });
  const rest = all.filter((e) => !e.ranked);
  const out = [...ranked, ...rest];
  if (!ids) return out;
  const want = new Set(ids);
  return out.filter((e) => want.has(e.id));
}

/** { rank, of } for one model on one measure; rank null when it is not ranked. */
export function rankOf(data, id, by, opts) {
  const list = rankBy(data, by, opts);
  const of = list.filter((e) => e.ranked).length;
  return { rank: list.find((e) => e.id === id)?.rank ?? null, of };
}

/** The best (highest) value of a measure among ranked models, or null. */
export function bestValue(data, by, opts) {
  const top = rankBy(data, by, opts)[0];
  return top?.ranked ? top.value : null;
}

/** Is this model first (ties included) on this measure? */
export function isBest(data, id, by, opts) {
  return rankOf(data, id, by, opts).rank === 1;
}

/** Mean of a measure over the ranked models (reference lines). */
export function meanValue(data, by, opts) {
  const v = rankBy(data, by, opts).filter((e) => e.ranked).map((e) => e.value);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
