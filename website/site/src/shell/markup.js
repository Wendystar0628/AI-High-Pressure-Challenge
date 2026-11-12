// Shell markup as plain strings. Pure functions with no DOM access, so the
// route plugin (Node, at build time) and the browser (fallback) render the
// same command bar and footer.
//
// ctx = { page, lang, base, t(key, vars), path, altHref, updated, modelCount, taskCount }

export const NAV = [
  { key: 'home', path: '' },
  { key: 'leaderboard', path: 'leaderboard/' },
  { key: 'categories', path: 'categories/' },
  { key: 'models', path: 'models/' },
  { key: 'tasks', path: 'tasks/' },
  { key: 'about', path: 'about/' },
  { key: 'faq', path: 'faq/' },
];

// which nav entry a page belongs to（模型得分：入口页 /models/ 和每个 /models/<id>/）
const SECTION = { home: 'home', leaderboard: 'leaderboard', categories: 'categories', tasks: 'tasks', task: 'tasks', about: 'about', faq: 'faq', model: 'models' };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Chinese 「·」 (间隔号) in the Chinese font (Saira draws it as a short bar, base.css .cjk)
const escDots = (s, lang) => (lang === 'zh' ? esc(s).replace(/·/g, '<span class="cjk">·</span>') : esc(s));

export const pageHref = (base, lang, path = '') => base + (lang === 'en' ? 'en/' : '') + String(path).replace(/^\//, '');

const dateDots = (d) => (d ? String(d).slice(0, 10).replace(/-/g, '.') : '');

export function headHTML(ctx) {
  const { lang, base, altHref } = ctx;
  const here = lang === 'en' ? 'en' : 'zh';
  // Runs before the first paint: theme, first page of the visit, language choice,
  // and the receiving end of 名字接力 (motion.js RELAY): when the last page relayed a
  // name to this page, the title marked data-relay-target takes the shared name
  // for the page transition (pagereveal fires before the first frame).
  const pre = `(function(){var d=document.documentElement,here=${JSON.stringify(here)},alt=${JSON.stringify(altHref)},q;
try{q=new URLSearchParams(location.search)}catch(e){q={get:function(){return null},has:function(){return false}}}
try{var a=q.get('theme'),t=localStorage.getItem('theme');if(a==='light'||a==='dark')d.setAttribute('data-theme',a);else if(t==='light'||t==='dark')d.setAttribute('data-theme',t)}catch(e){}
try{if(!sessionStorage.getItem('octa.visited')){d.classList.add('is-first-page');sessionStorage.setItem('octa.visited','1')}}catch(e){}
try{var p=localStorage.getItem('octa.lang'),inside=false;try{inside=!!document.referrer&&new URL(document.referrer).origin===location.origin}catch(e){}
if(p!=='zh'&&p!=='en'){p=/^zh/i.test(navigator.language||'')?'zh':'en';localStorage.setItem('octa.lang',p)}
if(p!==here&&!inside&&!q.has('stay'))location.replace(alt+location.search+location.hash)}catch(e){}
try{addEventListener('pagereveal',function(e){var w=null;try{w=sessionStorage.getItem('octa.relay');sessionStorage.removeItem('octa.relay')}catch(x){}
var el=e.viewTransition&&w===location.pathname&&document.querySelector('[data-relay-target]');if(!el)return;
el.style.viewTransitionName='name-relay';e.viewTransition.finished.finally(function(){el.style.viewTransitionName=''})})}catch(e){}
})();`;
  return [
    '<meta name="color-scheme" content="light dark" />',
    '<meta name="theme-color" content="#F2F1F6" media="(prefers-color-scheme: light)" />',
    '<meta name="theme-color" content="#121019" media="(prefers-color-scheme: dark)" />',
    `<link rel="icon" type="image/svg+xml" href="${base}favicon.svg" />`,
    `<script>${pre}</script>`,
    '<link rel="stylesheet" href="/src/styles/site.css" />',
  ].join('\n    ');
}

const themeIcon =
  '<svg class="site-theme-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/></svg>';

export function topHTML(ctx) {
  const { page, lang, base, t, altHref } = ctx;
  const cur = SECTION[page] ?? '';
  const zhHref = lang === 'zh' ? pageHref(base, 'zh', ctx.path) : altHref;
  const enHref = lang === 'en' ? pageHref(base, 'zh', '') + ctx.path : altHref;
  // 本页就是栏目入口（如 /models/）时 aria-current="page"，栏目下的子页（/models/<id>/、题目页）是 "true"
  const bare = lang === 'en' ? String(ctx.path ?? '').replace(/^en\//, '') : String(ctx.path ?? '');
  const nav = NAV.map((n) => {
    const href = pageHref(base, lang, n.path);
    const isCur = n.key === cur;
    const aria = isCur ? (page === n.key || bare === n.path ? ' aria-current="page"' : ' aria-current="true"') : '';
    const small = lang === 'zh' ? `<small>${esc(t(`common.nav.${n.key}En`))}</small>` : '';
    return `<a href="${href}" data-nav="${n.key}"${aria}>${esc(t(`common.nav.${n.key}`))}${small}</a>`;
  }).join('');
  const name =
    lang === 'zh'
      ? `<span class="brand-name"><b>${esc(t('common.site.short'))}</b><small>${esc(t('common.site.wordmark'))}</small></span>`
      : `<span class="brand-name"><b>${esc(t('common.site.wordmark'))}</b><small>${esc(t('common.site.sub'))}</small></span>`;
  return `<div class="st-tri site-tri" aria-hidden="true"><i></i><i></i><i></i></div>
  <a class="site-skip" href="#main">${esc(t('common.shell.skip'))}</a>
  <header class="st-cmdbar site-bar" data-shell="bar">
    <a class="brand" href="${pageHref(base, lang, '')}" title="${esc(t('common.shell.homeTitle'))}"><span class="seal" aria-hidden="true">${esc(t('common.site.seal'))}</span>${name}</a>
    <nav aria-label="${esc(t('common.nav.label'))}">${nav}</nav>
    <div class="util">
      <button type="button" class="site-search" data-shell="search" aria-haspopup="dialog" aria-keyshortcuts="/ Control+K" title="${esc(t('common.search.title'))}"><span class="site-search-ph">${esc(t('common.search.placeholder'))}</span><span class="site-search-short">${esc(t('common.search.short'))}</span><kbd>/</kbd></button>
      <button type="button" class="site-tool site-theme" data-theme-toggle aria-pressed="false" aria-keyshortcuts="T" title="${esc(t('common.theme.title'))}">${themeIcon}<span class="sr-only">${esc(t('common.theme.label'))}</span></button>
      <div class="site-lang" role="group" aria-label="${esc(t('common.lang.label'))}" title="${esc(t('common.lang.title'))}">
        <a href="${esc(zhHref)}" hreflang="zh-CN" lang="zh-CN" data-lang-switch="zh"${lang === 'zh' ? ' aria-current="true"' : ''}>中</a><span aria-hidden="true">│</span><a href="${esc(enHref)}" hreflang="en" lang="en" data-lang-switch="en"${lang === 'en' ? ' aria-current="true"' : ''}>EN</a>
      </div>
      <button type="button" class="site-tool site-keys" data-shell="keys" aria-haspopup="dialog" aria-keyshortcuts="?" title="${esc(t('common.keys.title'))}"><span aria-hidden="true">?</span><span class="sr-only">${esc(t('common.keys.title'))}</span></button>
    </div>
  </header>`;
}

export function bottomHTML(ctx) {
  const { t, lang, updated, modelCount, taskCount } = ctx;
  const facts = [
    updated ? `<li>${esc(t('common.footer.updated', { date: dateDots(updated) }))}</li>` : '',
    modelCount ? `<li>${esc(t('common.footer.models', { n: modelCount }))}</li>` : '',   // 暂停公示时没有模型，不写「0 个模型」
    `<li>${esc(t('common.footer.tasks', { n: taskCount }))}</li>`,
  ].join('');
  return `<footer class="site-foot" data-shell="foot">
    <div class="site-foot-in">
      <p class="site-foot-name">${escDots(t('common.site.name'), lang)}</p>
      <ul class="st-facts st-field">${facts}</ul>
      <p class="site-foot-note">${esc(t('common.footer.logos'))}</p>
      <p class="site-foot-note site-foot-icp"><a href="${esc(t('common.footer.icpUrl'))}" target="_blank" rel="noopener">${esc(t('common.footer.icp'))}</a></p>
    </div>
  </footer>`;
}
