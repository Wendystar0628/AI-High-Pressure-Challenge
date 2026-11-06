// The compare selection: up to 4 model ids, in the order they were ticked.
// Shared by every page through sessionStorage ("octa.compare"), so a
// selection made on one leaderboard carries to the other (README 多模型扩展).
// Changes are announced with a window event "octa:compare" { detail: { ids } }.
//
//   import { getCompare, toggleCompare, onCompareChange } from '../../ui/compare.js';
import { session, getListParam } from '../core/state.js';

export const MAX_COMPARE = 4;
const KEY = 'compare';

let ids = null;

function load() {
  if (ids) return ids;
  const fromURL = getListParam('cmp');
  ids = (fromURL.length ? fromURL : session.get(KEY, [])).filter((x) => typeof x === 'string').slice(0, MAX_COMPARE);
  if (fromURL.length) session.set(KEY, ids);
  return ids;
}

/** The ticked ids, in ticking order. */
export function getCompare() {
  return [...load()];
}

/** Replace the selection (extra ids beyond 4 are dropped). */
export function setCompare(next) {
  const clean = [...new Set(next)].slice(0, MAX_COMPARE);
  const before = load().join(',');
  ids = clean;
  session.set(KEY, ids);
  if (before !== ids.join(',')) dispatchEvent(new CustomEvent('octa:compare', { detail: { ids: [...ids] } }));
}

export function isCompared(id) {
  return load().includes(id);
}

/** 1-based order of a ticked id, or 0. */
export function compareIndex(id) {
  return load().indexOf(id) + 1;
}

export function isCompareFull() {
  return load().length >= MAX_COMPARE;
}

/** Tick or untick; returns false (and changes nothing) when ticking a 5th. */
export function toggleCompare(id, on = !isCompared(id)) {
  const cur = load();
  if (on) {
    if (cur.includes(id)) return true;
    if (cur.length >= MAX_COMPARE) return false;
    setCompare([...cur, id]);
  } else setCompare(cur.filter((x) => x !== id));
  return true;
}

/** fn(ids) on every change (this page or another tab). Returns an unsubscribe function. */
export function onCompareChange(fn) {
  const local = (e) => fn(e.detail.ids);
  const other = (e) => {
    if (e.key !== `octa.${KEY}`) return;
    ids = null;
    fn(getCompare());
  };
  addEventListener('octa:compare', local);
  addEventListener('storage', other);
  return () => {
    removeEventListener('octa:compare', local);
    removeEventListener('storage', other);
  };
}
