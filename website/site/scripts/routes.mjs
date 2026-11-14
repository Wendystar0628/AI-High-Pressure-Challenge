// Route plugin: turns pages/<type>.html + data/*.json into every page of the
// site, for `vite build` (virtual HTML inputs) and the dev server (middleware).
//
//   zh at the root, en under /en/:
//     /                      home          /en/
//     /leaderboard/          leaderboard   /en/leaderboard/
//     /categories/           categories    /en/categories/
//     /about/                about         /en/about/
//     /faq/                  faq           /en/faq/      猜你想问（内容 content/<lang>/faq.json）
//     /tasks/                tasks         /en/tasks/
//     /tasks/<cat>/<task>/   task          (one per task in data/tasks.json)
//     /models/               model         入口页：总分第 1 名（scores.json 的 order 第一个）的模型得分页
//     /models/<id>/          model         (one per model in data/models.json)
//
// A template may use these tokens (replaced before Vite sees the HTML):
//   {{lang}} zh|en   {{htmlLang}} zh-CN|en   {{page}}   {{id}}   {{base}}
//   {{title}}  the page title (from i18n common pages.<type>.title + data)
//   {{name}}   task page: the task's name; model page: "Claude Opus 5.5 (xhigh)" (escaped text)
//   {{nameHTML}} model page: vendor mark + name with effort, the same markup as core/names.js
//              (so the title is right in the first frame: 名字接力 lands on it, motion.js RELAY)
//   {{t:ns.key}}  an i18n string from src/i18n/<lang>/<ns>.json (falls back to zh)
//   {{href:path}} a link inside the site in the page's language, e.g. {{href:leaderboard/}}
//   <!--@head-->  theme / language pre-script, theme-color, icon, site stylesheet
//   <!--@top-->   spectrum strip + command bar
//   <!--@bottom--> footer
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PAGE_TYPES = ['home', 'leaderboard', 'categories', 'about', 'faq', 'tasks', 'task', 'model'];
const LANGS = ['zh', 'en'];

const readJSON = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

/**
 * 有彩色版的厂商标识名（public/logos/mark/<名>-color.svg，由 npm run sync 从 website/logos 拷入）。
 * 全站厂商图标的规则：有彩色版用彩色版，没有的用单色版；页面脚本经 define 拿到这份名单（core/names.js）。
 */
export function colorLogos(root) {
  const dir = join(root, 'public', 'logos', 'mark');
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('-color.svg'))
      .map((f) => f.slice(0, -'-color.svg'.length))
      .sort();
  } catch {
    return [];
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** All routes from the data files: [{ path: 'en/tasks/reason/formal-proof/', page, lang, id }] */
export function listRoutes(dataDir) {
  const models = readJSON(join(dataDir, 'models.json'), []);
  const cats = readJSON(join(dataDir, 'tasks.json'), []);
  const order = readJSON(join(dataDir, 'scores.json'), {}).order ?? [];
  // 「模型得分」入口页 /models/ 静态生成为总分第 1 名的模型得分页（不跳转）
  const top = order.find((id) => models.some((m) => m.id === id)) ?? models[0]?.id;
  const out = [];
  for (const lang of LANGS) {
    const pre = lang === 'en' ? 'en/' : '';
    out.push({ path: pre, page: 'home', lang, id: '' });
    for (const p of ['leaderboard', 'categories', 'about', 'faq', 'tasks']) out.push({ path: `${pre}${p}/`, page: p, lang, id: '' });
    for (const c of cats) for (const t of c.tasks ?? []) out.push({ path: `${pre}tasks/${c.key}/${t.key}/`, page: 'task', lang, id: `${c.key}/${t.key}` });
    out.push({ path: `${pre}models/`, page: 'model', lang, id: top ?? '' });   // 没有模型时（暂停公示）入口页照样生成，显示提示
    for (const m of models) out.push({ path: `${pre}models/${m.id}/`, page: 'model', lang, id: m.id });
  }
  return out;
}

function makeT(i18nDir, lang) {
  const cache = new Map();
  const ns = (l, n) => {
    const k = `${l}/${n}`;
    if (!cache.has(k)) cache.set(k, readJSON(join(i18nDir, l, `${n}.json`), {}));
    return cache.get(k);
  };
  const get = (obj, path) => path.split('.').reduce((o, p) => (o == null ? undefined : o[p]), obj);
  // 单复数对象 { one, other }：按 vars.count / vars.n 取一种（同 src/core/i18n.js）
  const rules = new Intl.PluralRules(lang === 'en' ? 'en' : 'zh-CN');
  const form = (v, c) => (v && typeof v === 'object' && !Array.isArray(v) && typeof v.other === 'string' ? (Number.isFinite(+c) ? v[rules.select(+c)] ?? v.other : v.other) : v);
  return (key, vars = {}) => {
    const [n, ...rest] = key.split('.');
    const path = rest.join('.');
    const c = vars.count ?? vars.n;
    let v = form(get(ns(lang, n), path), c);
    if (typeof v !== 'string' && lang !== 'zh') v = form(get(ns('zh', n), path), c);
    if (typeof v !== 'string') return key;
    return v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  };
}

export function routePlugin({ root, dataDir: customDataDir }) {
  const dataDir = customDataDir || process.env.ONESHOT_SITE_DATA_DIR?.trim() || join(root, 'data');
  const pagesDir = join(root, 'pages');
  const i18nDir = join(root, 'src', 'i18n');
  let base = '/';
  let routes = new Map(); // normalised absolute id -> route
  let markup = null;
  let colorSet = new Set(colorLogos(root));

  const idOf = (path) => posix.join(root.replace(/\\/g, '/'), path, 'index.html');

  const refresh = () => {
    routes = new Map(listRoutes(dataDir).map((r) => [idOf(r.path), r]));
  };

  const loadMarkup = async () => {
    // fresh import each time so edits show up in dev
    const url = pathToFileURL(join(root, 'src', 'shell', 'markup.js')).href + `?t=${Date.now()}`;
    markup = await import(url);
  };

  async function render(route) {
    if (!markup) await loadMarkup();
    const file = join(pagesDir, `${route.page}.html`);
    // the template's leading note comment is for page owners, not for the output
    let html = readFileSync(file, 'utf8').replace(/^(<!doctype html>\s*)<!--[\s\S]*?-->\s*/i, '$1');
    const t = makeT(i18nDir, route.lang);
    const models = readJSON(join(dataDir, 'models.json'), []);
    const cats = readJSON(join(dataDir, 'tasks.json'), []);
    const scores = readJSON(join(dataDir, 'scores.json'), {});
    const taskCount = cats.reduce((n, c) => n + (c.tasks?.length ?? 0), 0);

    // the same route in the other language
    const altLang = route.lang === 'en' ? 'zh' : 'en';
    const bare = route.lang === 'en' ? route.path.slice(3) : route.path;
    const altPath = altLang === 'en' ? `en/${bare}` : bare;

    // title
    const site = t('common.site.name');
    const pageTitle = t(`common.pages.${route.page}.title`);
    let title = route.page === 'home' ? site : `${pageTitle} │ ${site}`;
    let name = '';
    let nameHTML = '';
    if (route.page === 'task') {
      const [ck, tk] = route.id.split('/');
      const task = cats.find((c) => c.key === ck)?.tasks?.find((x) => x.key === tk);
      name = (route.lang === 'en' ? task?.name_en || task?.name : task?.name) ?? '';
      nameHTML = esc(name);
      if (name) title = `${name} │ ${pageTitle} │ ${site}`;
    } else if (route.page === 'model') {
      const m = models.find((x) => x.id === route.id);
      if (m) {
        name = `${m.name}${m.effort ? ` (${m.effort})` : ''}`;
        title = `${name} │ ${pageTitle} │ ${site}`;
        const color = colorSet.has(m.logo);
        const icon = `<span class="icon icon-vendor${color ? ' is-color' : ''}" style="--icon:url(&quot;${base}logos/mark/${esc(m.logo)}${color ? '-color' : ''}.svg&quot;)" aria-hidden="true"></span>`;
        const effort = m.effort ? `<span class="mname-effort">(${esc(m.effort)})</span>` : '';
        nameHTML = `${icon}<span class="mname md-mname" title="${esc(name)}"><span class="mname-text">${esc(m.name)}</span>${effort}</span>`;
      }
    }

    const ctx = {
      page: route.page,
      lang: route.lang,
      base,
      t,
      path: route.path,
      altHref: base + altPath,
      updated: scores.updated ?? '',
      modelCount: models.length,
      taskCount,
    };
    const tokens = {
      lang: route.lang,
      htmlLang: route.lang === 'en' ? 'en' : 'zh-CN',
      page: route.page,
      id: route.id,
      base,
      title: esc(title),
      name: esc(name),
      nameHTML,
    };
    html = html
      .replace('<!--@head-->', markup.headHTML(ctx))
      .replace('<!--@top-->', markup.topHTML(ctx))
      .replace('<!--@bottom-->', markup.bottomHTML(ctx))
      .replace(/\{\{t:([\w.-]+)\}\}/g, (m, k) => esc(t(k)))
      .replace(/\{\{href:([^}]*)\}\}/g, (m, p) => base + (route.lang === 'en' ? 'en/' : '') + p.replace(/^\//, ''))
      .replace(/\{\{(\w+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));
    return html;
  }

  return {
    name: 'octathlon-routes',
    enforce: 'pre',
    config() {
      refresh();
      const input = {};
      for (const [id, r] of routes) input[r.path ? r.path.replace(/\/$/, '').replace(/\//g, '__') : 'index'] = id;
      colorSet = new Set(colorLogos(root));
      return { build: { rolldownOptions: { input } }, define: { __OCTA_COLOR_LOGOS__: JSON.stringify([...colorSet]) } };
    },
    configResolved(c) {
      base = c.base;
    },
    resolveId(id) {
      const n = id.replace(/\\/g, '/');
      if (routes.has(n)) return n;
      return null;
    },
    load(id) {
      const r = routes.get(id.replace(/\\/g, '/'));
      if (r) return render(r);
      return null;
    },
    // the data files travel with the build at <base>data/*.json, subfolders too (data/stems/<category>/<task>.json)
    generateBundle() {
      if (!existsSync(dataDir)) return;
      for (const f of readdirSync(dataDir, { recursive: true })) {
        const rel = String(f).replace(/\\/g, '/');
        if (!rel.endsWith('.json')) continue;
        this.emitFile({ type: 'asset', fileName: `data/${rel}`, source: readFileSync(join(dataDir, rel)) });
      }
    },
    configureServer(server) {
      const watched = [dataDir, pagesDir, join(i18nDir), join(root, 'src', 'shell', 'markup.js')];
      server.watcher.add(watched);
      const onChange = async (file) => {
        const f = file.replace(/\\/g, '/');
        if (f.includes('/data/') && f.endsWith('.json')) refresh();
        if (f.endsWith('/src/shell/markup.js')) await loadMarkup();
        if (f.includes('/pages/') || f.includes('/data/') || f.includes('/src/i18n/') || f.endsWith('/src/shell/markup.js')) {
          server.ws.send({ type: 'full-reload' });
        }
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);

      server.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url, 'http://x');
          let p = decodeURIComponent(url.pathname);
          if (!p.startsWith(base)) return next();
          p = p.slice(base.length);
          if (p.endsWith('index.html')) p = p.slice(0, -'index.html'.length);
          if (p && !p.endsWith('/')) {
            // /leaderboard -> /leaderboard/
            if (routes.has(idOf(p + '/'))) {
              res.statusCode = 301;
              res.setHeader('Location', base + p + '/' + url.search);
              return res.end();
            }
            return next();
          }
          const route = routes.get(idOf(p));
          if (!route) return next();
          let html = await render(route);
          html = await server.transformIndexHtml(req.url, html, req.originalUrl);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(html);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

