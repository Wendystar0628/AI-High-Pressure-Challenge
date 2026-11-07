// 通用 UI：通知、系统内对话框、菜单、右键菜单
import { rt } from '../store.js';
import { el, clamp, esc, newId } from '../util.js';
import { ui as glyph } from '../icons.js';
import { changed } from '../model.js';

export function viewOf(sys) { return rt.ui ? rt.ui.view(sys.id) : null; }

export function toast(title, msg = '', kind = 'info', sys = null) {
  const layer = document.getElementById('toast-layer');
  if (!layer) return;
  if (sys && sys.settings && sys.settings.dnd && kind !== 'err') return;
  const icons = { info: 'info', ok: 'check', warn: 'warning', err: 'warning' };
  const t = el('div', { class: 'toast' },
    el('div', { class: 't-ico', html: glyph(icons[kind] || 'info', 16) }),
    el('div', {}, el('div', { class: 't-title', text: title }), msg ? el('div', { class: 't-msg', text: msg }) : null)
  );
  layer.append(t);
  const dismiss = () => { t.classList.add('out'); setTimeout(() => t.remove(), 260); };
  t.addEventListener('click', dismiss);
  setTimeout(dismiss, kind === 'err' ? 6500 : 4200);
}

export function systemToast(sys, title, msg, kind) {
  if (sys.settings && sys.settings.dnd && kind !== 'err') { changed('dnd-notify'); return; }
  toast(title, msg, kind, sys);
}

export function dialog(sys, opts = {}) {
  const view = viewOf(sys);
  if (!view) return Promise.resolve(null);
  return new Promise((resolve) => {
    const layer = view.modalLayer;
    layer.innerHTML = '';
    layer.classList.add('open');
    const buttons = opts.buttons || [
      { label: '取消', value: null, kind: 'ghost' },
      { label: opts.okText || '确定', value: true, kind: 'primary' }
    ];
    let inputEl = null;
    const dlg = el('div', { class: 'dialog' });
    dlg.append(el('h3', { text: opts.title || '提示' }));
    if (opts.message) dlg.append(el('div', { class: 'dlg-msg', text: opts.message }));
    if (opts.html) dlg.append(el('div', { class: 'dlg-msg', html: opts.html }));
    if (opts.input) {
      inputEl = el('input', { type: opts.input.type || 'text', value: opts.input.value ?? '', placeholder: opts.input.placeholder || '' });
      if (opts.input.multiline) {
        inputEl = el('textarea', { rows: 4, placeholder: opts.input.placeholder || '' });
        inputEl.value = opts.input.value ?? '';
      }
      dlg.append(el('div', { class: 'field' }, opts.input.label ? el('label', { text: opts.input.label }) : null, inputEl));
    }
    const actions = el('div', { class: 'dlg-actions' });
    const finish = (value) => {
      layer.classList.remove('open');
      layer.innerHTML = '';
      document.removeEventListener('keydown', onKey, true);
      resolve(value);
    };
    buttons.forEach(b => {
      const btn = el('button', { class: 'btn ' + (b.kind || (b.primary ? 'primary' : '')), text: b.label });
      btn.addEventListener('click', () => finish(b.value !== undefined ? b.value : b.label));
      actions.append(btn);
    });
    dlg.append(actions);
    layer.append(dlg);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); finish(null); }
      if (e.key === 'Enter' && inputEl && inputEl.tagName === 'INPUT' && !opts.input.multiline) {
        e.preventDefault();
        const primary = buttons.find(b => b.primary || b.kind === 'primary');
        finish(primary ? primary.value : inputEl.value);
      }
    };
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => { (inputEl || dlg.querySelector('button'))?.focus?.(); }, 30);
    layer.onpointerdown = (e) => { if (e.target === layer) { /* 保持弹窗，不误关 */ } };
  });
}

// 带输入的提示
export function promptValue(sys, title, label, value = '', placeholder = '') {
  const view = viewOf(sys);
  if (!view) return Promise.resolve(null);
  return new Promise((resolve) => {
    const layer = view.modalLayer;
    layer.innerHTML = '';
    layer.classList.add('open');
    const input = el('input', { type: 'text', placeholder });
    input.value = value;
    const finish = (v) => { layer.classList.remove('open'); layer.innerHTML = ''; document.removeEventListener('keydown', onKey, true); resolve(v); };
    const dlg = el('div', { class: 'dialog' },
      el('h3', { text: title }),
      el('div', { class: 'field' }, el('label', { text: label }), input),
      el('div', { class: 'dlg-actions' },
        el('button', { class: 'btn ghost', text: '取消', onclick: () => finish(null) }),
        el('button', { class: 'btn primary', text: '确定', onclick: () => finish(input.value) })
      )
    );
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); finish(null); }
      else if (e.key === 'Enter') { e.preventDefault(); finish(input.value); }
    };
    document.addEventListener('keydown', onKey, true);
    layer.append(dlg);
    setTimeout(() => { input.focus(); input.select(); }, 30);
  });
}

export async function confirmSave(sys, title, message) {
  const r = await dialog(sys, {
    title, message,
    buttons: [
      { label: '取消', value: 'cancel', kind: 'ghost' },
      { label: '不保存', value: 'discard' },
      { label: '保存', value: 'save', kind: 'primary' }
    ]
  });
  return r || 'cancel';
}

export function confirmDialog(sys, title, message, okText = '确定', danger = false) {
  return dialog(sys, {
    title, message,
    buttons: [
      { label: '取消', value: false, kind: 'ghost' },
      { label: okText, value: true, kind: danger ? 'danger' : 'primary' }
    ]
  }).then(v => v === true);
}

export function chooseFromList(sys, { title, items, emptyText = '没有可选项' }) {
  const view = viewOf(sys);
  if (!view) return Promise.resolve(null);
  return new Promise((resolve) => {
    const layer = view.modalLayer;
    layer.innerHTML = ''; layer.classList.add('open');
    const list = el('div', { style: { maxHeight: '320px', overflow: 'auto', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px' } });
    const finish = (v) => { layer.classList.remove('open'); layer.innerHTML = ''; document.removeEventListener('keydown', onKey, true); resolve(v); };
    if (!items.length) list.append(el('div', { class: 'empty-state', text: emptyText }));
    for (const it of items) {
      const row = el('button', {
        class: 'menu-item', style: { width: '100%', textAlign: 'left', height: '36px' },
        onclick: () => finish(it)
      }, it.icon ? el('span', { class: 'mi-icon', html: it.icon }) : null, el('span', { text: it.label }), it.hint ? el('span', { class: 'mi-key', text: it.hint }) : null);
      list.append(row);
    }
    const dlg = el('div', { class: 'dialog' },
      el('h3', { text: title }), list,
      el('div', { class: 'dlg-actions' }, el('button', { class: 'btn ghost', text: '取消', onclick: () => finish(null) }))
    );
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(null); } };
    document.addEventListener('keydown', onKey, true);
    layer.append(dlg);
  });
}

export function showMenu(sys, x, y, items, opts = {}) {
  const view = viewOf(sys);
  if (!view) return;
  view.closeMenu();
  const menu = el('div', { class: 'menu', role: 'menu' });
  if (opts.title) menu.append(el('div', { class: 'menu-label', text: opts.title }));
  for (const item of items) {
    if (!item) continue;
    if (item.sep) { menu.append(el('div', { class: 'menu-sep' })); continue; }
    if (item.header) { menu.append(el('div', { class: 'menu-label', text: item.header })); continue; }
    const row = el('div', { class: 'menu-item' + (item.disabled ? ' disabled' : '') },
      item.icon ? el('span', { class: 'mi-icon', html: glyph(item.icon, 15) }) : null,
      el('span', { text: item.label }),
      item.shortcut ? el('span', { class: 'mi-key', text: item.shortcut }) : null
    );
    if (item.testid) row.dataset.testid = item.testid;
    if (item.targetSystemId) row.setAttribute('data-target-system-id', item.targetSystemId);
    row.addEventListener('click', () => { view.closeMenu(); if (!item.disabled && item.action) item.action(); });
    menu.append(row);
  }
  menu.style.left = '0px'; menu.style.top = '0px';
  view.rootEl.append(menu);
  const vw = view.sys.viewport.w, vh = view.sys.viewport.h;
  const r = menu.getBoundingClientRect();
  const pr = view.rootEl.getBoundingClientRect();
  menu.style.left = clamp(x - pr.left, 6, Math.max(6, vw - r.width - 6)) + 'px';
  menu.style.top = clamp(y - pr.top, 6, Math.max(6, vh - r.height - 6)) + 'px';
  view.activeMenu = menu;
  const close = (e) => {
    if (!menu.contains(e.target)) { view.closeMenu(); }
  };
  setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
  view._menuCleanup = () => document.removeEventListener('pointerdown', close, true);
}

export function closeMenu(sys) {
  const view = viewOf(sys);
  if (view) view.closeMenu();
}

export function statusPill(text, kind = '') { return el('span', { class: 'pill ' + kind, text }); }

export function sectionTitle(text, extra) { return el('div', { class: 'sys-section-title' }, el('span', { text }), el('span', { class: 'spacer' }), extra || null); }
