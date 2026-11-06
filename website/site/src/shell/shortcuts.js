// Keyboard shortcuts and the shortcut sheet (?).
// Global: / and Ctrl K search, T theme, L language, ? this sheet, Esc closes
// dialogs and the side panel (native <dialog> handles Esc). Pages add theirs
// with registerShortcut(); they show up under "本页" in the sheet.
// Nothing fires while the focus is in a text field.
import { isTyping } from '../core/state.js';
import { t } from '../core/i18n.js';
import { h } from '../core/dom.js';
import { closeDialog } from '../vendor/stellar/fx.js';

const list = []; // { key, label, handler, group, ctrl, display }

/**
 * registerShortcut({ key: 'w', label: '打开权重沙盘', handler: (e) => …, display: 'W' })
 *   key: KeyboardEvent.key, case-insensitive for letters ('1', 'w', 'c', '?', '/')
 *   ctrl: true for Ctrl/⌘ + key
 *   group: 'page' (default) or 'global'
 *   display: what the sheet shows (default: key upper-cased)
 * Returns an unregister function.
 */
export function registerShortcut({ key, label, handler, group = 'page', ctrl = false, display }) {
  const item = { key: String(key), label, handler, group, ctrl, display: display ?? (ctrl ? `Ctrl ${String(key).toUpperCase()}` : String(key).toUpperCase()) };
  list.push(item);
  return () => {
    const i = list.indexOf(item);
    if (i >= 0) list.splice(i, 1);
  };
}

export function wireShortcuts() {
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.isComposing || e.altKey) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl && isTyping(e.target)) return;
    if (ctrl && isTyping(e.target) && e.key.toLowerCase() !== 'k') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // the most recently registered wins (pages can override)
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.ctrl !== ctrl) continue;
      if ((s.key.length === 1 ? s.key.toLowerCase() : s.key) !== k) continue;
      // while a dialog or the side panel is open, page shortcuts wait
      const modal = document.querySelector('dialog[open]');
      if (modal && !ctrl && s.group === 'page') continue;
      e.preventDefault();
      s.handler(e);
      return;
    }
  });
}

let sheet = null;

function row(label, keys) {
  return h('li', h('span', label), h('span', keys.map((k) => h('kbd', k))));
}

/** Open the shortcut sheet. */
export function openKeys() {
  sheet?.remove();
  const page = list.filter((s) => s.group === 'page' && s.label);
  sheet = h(
    'dialog.st-dialog.site-dialog.site-keys-dialog',
    { 'aria-labelledby': 'site-keys-title' },
    h(
      'div.st-panel.cut-br',
      h(
        'div.site-dialog-head',
        h('div', h('p.st-eyebrow.slash', t('common.keys.eyebrow')), h('h2#site-keys-title', t('common.keys.heading'))),
        h('button.st-btn.small', { type: 'button', 'data-close': '' }, t('common.shell.close')),
      ),
      h(
        'section.site-keys-group',
        h('p.st-eyebrow', t('common.keys.global')),
        h(
          'ul.site-keys-list',
          row(t('common.keys.search'), ['/', 'Ctrl K']),
          row(t('common.keys.theme'), ['T']),
          row(t('common.keys.lang'), ['L']),
          row(t('common.keys.help'), ['?']),
          row(t('common.keys.close'), ['Esc']),
        ),
      ),
      page.length
        ? h('section.site-keys-group', h('p.st-eyebrow', t('common.keys.page')), h('ul.site-keys-list', page.map((s) => row(s.label, [s.display]))))
        : null,
      h('p.site-keys-note', t('common.keys.note')),
    ),
  );
  sheet.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeDialog(sheet).then(() => sheet?.remove());
  });
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet || e.target.closest('[data-close]')) closeDialog(sheet).then(() => sheet?.remove());
  });
  document.body.append(sheet);
  sheet.showModal();
}
