// Command bar behaviour: theme toggle (skill's reveal), language switch that
// keeps the page and the reading position, search and shortcut buttons.
import { wireTheme } from '../vendor/stellar/fx.js';
import { route, altHref, BASE } from '../core/route.js';
import { session } from '../core/state.js';
import { t } from '../core/i18n.js';
import { topHTML, bottomHTML } from './markup.js';

/** Make sure the bar and footer exist (the route plugin prerenders them; this is a fallback). */
export function ensureShellMarkup() {
  const ctx = { page: route.page, lang: route.lang, base: BASE, t, path: location.pathname.slice(BASE.length), altHref: altHref(), updated: '', modelCount: '', taskCount: '' };
  if (!document.querySelector('[data-shell="bar"]')) document.body.insertAdjacentHTML('afterbegin', topHTML(ctx));
  if (!document.querySelector('[data-shell="foot"]')) document.body.insertAdjacentHTML('beforeend', bottomHTML(ctx));
}

export function wireBar({ openSearch, openKeys }) {
  const bar = document.querySelector('[data-shell="bar"]');
  if (!bar) return;
  wireTheme(bar);
  bar.querySelector('[data-shell="search"]')?.addEventListener('click', () => openSearch());
  bar.querySelector('[data-shell="keys"]')?.addEventListener('click', () => openKeys());
  bar.querySelectorAll('[data-lang-switch]').forEach((a) =>
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      switchLang(a.dataset.langSwitch);
    }),
  );
}

/** Flip light / dark with the reveal from the toggle button (T). */
export function toggleTheme() {
  document.querySelector('[data-theme-toggle]')?.click();
}

const barHeight = () => document.querySelector('[data-shell="bar"]')?.getBoundingClientRect().height ?? 54;

/** The block of the page at the top of the viewport, to come back to it in the other language. */
function anchorAtTop() {
  const top = barHeight() + 8;
  // headings and blocks with ids (not SVG internals, not hidden things)
  const ids = [...document.querySelectorAll('main [id]')].filter((el) => !(el instanceof SVGElement) && el.offsetParent !== null);
  let best = null;
  for (const el of ids) {
    const r = el.getBoundingClientRect();
    if (r.height === 0) continue;
    if (r.top <= top + 4 && (!best || r.top > best.top)) best = { id: el.id, top: r.top };
  }
  return best ? { id: best.id, offset: Math.round(top - best.top) } : null;
}

/** Go to the same page in the other language (L), keeping query, hash and position. */
export function switchLang(lang = route.lang === 'en' ? 'zh' : 'en') {
  if (lang === route.lang) return;
  try {
    localStorage.setItem('octa.lang', lang);
  } catch {}
  const target = altHref(lang);
  const path = new URL(target, location.href).pathname;
  session.set(`scroll:${path}`, { y: scrollY, ratio: scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight), anchor: anchorAtTop() });
  location.href = target;
}

/** After the page has rendered: come back to where the reader was before switching language. */
export function restoreScroll() {
  const key = `scroll:${location.pathname}`;
  const saved = session.get(key);
  if (!saved) return;
  session.remove(key);
  const el = saved.anchor && document.getElementById(saved.anchor.id);
  const top = barHeight() + 8;
  let y = saved.y;
  if (el) y = el.getBoundingClientRect().top + scrollY - top + saved.anchor.offset;
  else if (saved.ratio != null) y = saved.ratio * (document.documentElement.scrollHeight - innerHeight);
  scrollTo({ top: Math.max(0, y), behavior: 'instant' });
}
