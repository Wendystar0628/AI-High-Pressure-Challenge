// boot(): the one call every page entry makes.
//
//   import { boot } from '../../shell/index.js';
//   boot(async ({ data, route, t }) => { …render the page… }, { ns: ['extra-namespace'] });
//
// Order: load i18n (common + the page's namespace + ns) → wire the shell
// (bar, search, shortcuts, side panel) → load data → render(ctx) → restore
// the reading position after a language switch → open ?model= panel →
// <html class="is-ready"> and document event 'octa:ready' { detail: ctx }.
import { route } from '../core/route.js';
import { loadNamespaces, t, lang, applyI18n } from '../core/i18n.js';
import { loadData } from '../core/data.js';
import { h } from '../core/dom.js';
import { ensureShellMarkup, wireBar, restoreScroll, switchLang, toggleTheme } from './bar.js';
import { wireShortcuts, registerShortcut, openKeys } from './shortcuts.js';
import { openSearch } from './search.js';
import { wirePanel, openPanelFromURL } from './panel.js';

export { openSearch, closeSearch } from './search.js';
export { registerShortcut, openKeys } from './shortcuts.js';
export { openModelPanel, closeModelPanel, setPanelOrder, getPanelModel } from './panel.js';
export { switchLang, toggleTheme } from './bar.js';

let wired = false;

function wireShell() {
  if (wired) return;
  wired = true;
  ensureShellMarkup();
  wireBar({ openSearch: () => openSearch(), openKeys });
  wireShortcuts();
  registerShortcut({ key: '/', group: 'global', handler: () => openSearch() });
  registerShortcut({ key: 'k', ctrl: true, group: 'global', handler: () => openSearch() });
  registerShortcut({ key: 't', group: 'global', handler: () => toggleTheme() });
  registerShortcut({ key: 'l', group: 'global', handler: () => switchLang() });
  registerShortcut({ key: '?', group: 'global', handler: () => openKeys() });
  wirePanel();
}

function showLoadError() {
  const main = document.querySelector('main') ?? document.body;
  if (main.querySelector('.site-load-error')) return;
  main.prepend(h('p.st-notice.st-in-wipe.site-load-error', { 'data-flag': t('common.shell.errorFlag'), role: 'alert' }, t('common.shell.loadError')));
}

/**
 * Start a page. render(ctx) gets { route, data, t, lang }; data is null when
 * the data files could not be read (the shell shows the error notice then and
 * render is still called, so static parts can show).
 * Options: { ns: [...] } extra i18n namespaces; { data: false } skips loading data.
 */
export async function boot(render, { ns = [], data: wantData = true } = {}) {
  await loadNamespaces('common', route.page, ...ns);
  wireShell();
  applyI18n(document.querySelector('main') ?? document);
  let data = null;
  if (wantData) {
    try {
      data = await loadData();
    } catch (e) {
      console.error(e);
      showLoadError();
    }
  }
  const ctx = { route, data, t, lang };
  try {
    if (render) await render(ctx);
  } catch (e) {
    console.error(e);
  }
  restoreScroll();
  if (data) openPanelFromURL();
  document.documentElement.classList.add('is-ready');
  document.dispatchEvent(new CustomEvent('octa:ready', { detail: ctx }));
  return ctx;
}
