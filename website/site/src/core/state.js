// URL parameters and browser storage. Storage keys are prefixed "octa.";
// every access is wrapped so a blocked storage never breaks a page.

export function getParams() {
  return new URLSearchParams(location.search);
}

export function getParam(name, fallback = null) {
  const v = getParams().get(name);
  return v == null || v === '' ? fallback : v;
}

/** "a,b,c" -> ['a','b','c'] */
export function getListParam(name) {
  const v = getParam(name);
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

/**
 * Write parameters into the address without reloading. null / '' / [] removes a key.
 * Arrays are joined with commas. { push: true } adds a history entry.
 */
export function setParams(values, { push = false } = {}) {
  const url = new URL(location.href);
  for (const [k, v] of Object.entries(values)) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) url.searchParams.delete(k);
    else url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const next = url.pathname + url.search.replace(/%2C/gi, ',') + url.hash;
  if (next === location.pathname + location.search + location.hash) return;
  history[push ? 'pushState' : 'replaceState'](history.state, '', next);
}

function makeStore(getArea, prefix = 'octa.') {
  const area = () => {
    try {
      return getArea();
    } catch {
      return null;
    }
  };
  return {
    get(key, fallback = null) {
      try {
        const raw = area()?.getItem(prefix + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        area()?.setItem(prefix + key, JSON.stringify(value));
      } catch {}
    },
    remove(key) {
      try {
        area()?.removeItem(prefix + key);
      } catch {}
    },
  };
}

/** localStorage, JSON values, key prefix "octa." */
export const local = makeStore(() => localStorage);
/** sessionStorage, JSON values, key prefix "octa." */
export const session = makeStore(() => sessionStorage);

/** Is focus in a text field? (shortcuts stay quiet then) */
export function isTyping(target = document.activeElement) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(target.type);
  return false;
}
