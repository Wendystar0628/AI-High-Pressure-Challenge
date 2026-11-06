// Route info from <body data-page data-lang data-id>, and links inside the site.
// Every link the site writes goes through href()/links so the base path
// (GitHub Pages) and the /en/ prefix are always right.

export const BASE = import.meta.env.BASE_URL || '/';

export function getRoute(body = document.body) {
  const d = body?.dataset ?? {};
  const page = d.page || 'home';
  const lang = d.lang === 'en' ? 'en' : 'zh';
  const id = d.id || '';
  const [category, task] = page === 'task' ? id.split('/') : [];
  return {
    page, // home | leaderboard | categories | about | tasks | task | model
    lang, // zh | en
    id, // model id on a model page, "<category>/<task>" on a task page, '' elsewhere
    category: category || null,
    task: task || null,
    model: page === 'model' ? id : null,
    base: BASE,
  };
}

/** Read once when the module loads (module scripts run after <body> is parsed). */
export const route = getRoute();

const qs = (query) => {
  if (!query) return '';
  const p = query instanceof URLSearchParams ? query : new URLSearchParams();
  if (!(query instanceof URLSearchParams)) {
    for (const [k, v] of Object.entries(query)) {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      p.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
  }
  const s = p.toString().replace(/%2C/gi, ',');
  return s ? `?${s}` : '';
};

/**
 * A path inside the site, in the page's language unless { lang } says otherwise.
 *   href('leaderboard/', { query: { view: 'compare', cmp: ['a', 'b'] }, hash: 'x' })
 */
export function href(path = '', { lang = route.lang, query, hash } = {}) {
  const p = String(path).replace(/^\//, '');
  return BASE + (lang === 'en' ? 'en/' : '') + p + qs(query) + (hash ? `#${String(hash).replace(/^#/, '')}` : '');
}

const taskPath = (t) => (typeof t === 'string' ? t : t?.path || `${t?.category}/${t?.key}`);

/** Named links. Each takes an optional last argument { lang }. */
export const links = {
  home: (o) => href('', o),
  leaderboard: (query, o) => href('leaderboard/', { ...o, query }),
  categories: (category, o) => href('categories/', { ...o, hash: category || '' }),
  about: (anchor, o) => href('about/', { ...o, hash: anchor || '' }),
  tasks: (category, o) => href('tasks/', { ...o, hash: category || '' }),
  /** links.task(taskObject) or links.task('reason/formal-proof') */
  task: (task, o) => href(`tasks/${taskPath(task)}/`, o),
  model: (id, o) => href(`models/${id}/`, o),
  compare: (ids, o) => href('leaderboard/', { ...o, query: { view: 'compare', cmp: ids } }),
  data: (file) => `${BASE}data/${file}`,
  asset: (path) => BASE + String(path).replace(/^\//, ''),
};

/** The current page in the other language, keeping the query and the hash. */
export function altHref(lang = route.lang === 'en' ? 'zh' : 'en') {
  let p = location.pathname;
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p.startsWith('en/') || p === 'en') p = p.slice(3);
  return BASE + (lang === 'en' ? 'en/' : '') + p + location.search + location.hash;
}
