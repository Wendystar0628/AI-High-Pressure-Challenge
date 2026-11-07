// 根系统浏览器：自制界面 + Electron Chromium webview，真实联网浏览
import * as M from '../../model.js';
import { el } from '../../util.js';
import { ui as glyph } from '../../icons.js';
import { toast } from '../common.js';
import { changed } from '../../store.js';

const HOME_LINKS = [
  { label: '哔哩哔哩', url: 'https://www.bilibili.com/' },
  { label: 'Bing 搜索', url: 'https://www.bing.com/' },
  { label: 'MDN Web Docs', url: 'https://developer.mozilla.org/zh-CN/' }
];

export function mount(ctx) {
  const { sys, win, body, ui } = ctx;
  if (!sys.isRoot) {
    body.append(el('div', { class: 'empty-state', text: '浏览器只在根系统提供。' }));
    return { destroy() { } };
  }
  const state = sys.apps.browser = sys.apps.browser || { tabs: [], activeTabId: null, nextTab: 1 };
  state.tabs = state.tabs || [];
  if (!state.tabs.length) {
    const t = { id: 't' + (state.nextTab++), url: '', title: '新标签页', loading: false, error: null };
    state.tabs.push(t); state.activeTabId = t.id;
  }
  if (!state.tabs.some(t => t.id === state.activeTabId)) state.activeTabId = state.tabs[0].id;
  let webviews = new Map(); // tabId -> element
  let tabHistory = new Map(); // tabId -> {stack, index}
  let addressFocused = false;

  const root = el('div', { class: 'app browser' });
  const top = el('div', { class: 'browser-top' });
  const tabsBar = el('div', { class: 'browser-tabs' });
  const addBtn = el('button', { class: 'browser-newtab', title: '新建标签页', 'aria-label': '新建标签页', dataset: { testid: 'browser-new-tab' }, html: glyph('plus', 14) });
  tabsBar.append(addBtn);
  const nav = el('div', { class: 'browser-nav' });
  const back = el('button', { class: 'navbtn', title: '后退', 'aria-label': '后退', dataset: { testid: 'browser-back' }, html: glyph('chevronL', 15) });
  const fwd = el('button', { class: 'navbtn', title: '前进', 'aria-label': '前进', dataset: { testid: 'browser-forward' }, html: glyph('chevronR', 15) });
  const reload = el('button', { class: 'navbtn', title: '刷新', 'aria-label': '刷新', dataset: { testid: 'browser-reload' }, html: glyph('refresh', 15) });
  const stop = el('button', { class: 'navbtn', title: '停止加载', 'aria-label': '停止加载', html: glyph('close', 13) });
  const address = el('input', { class: 'browser-address', type: 'text', spellcheck: 'false', dataset: { testid: 'browser-address' }, 'aria-label': '地址栏', placeholder: '输入网址或搜索关键词' });
  const go = el('button', { class: 'navbtn', title: '转到', 'aria-label': '转到', dataset: { testid: 'browser-go' }, html: glyph('chevronR', 15) });
  const status = el('span', { class: 'browser-status', text: '就绪' });
  nav.append(back, fwd, reload, stop, address, go, status);
  top.append(tabsBar, nav);
  const view = el('div', { class: 'browser-view' });
  const loadbar = el('div', { class: 'browser-loadbar' });
  const placeholder = el('div', { class: 'browser-placeholder' });
  placeholder.append(el('div', { class: 'logo', text: 'Nested Browser' }), el('div', { class: 'hint', text: '由 Electron Chromium 内核加载真实网页 · 支持多标签' }));
  const homeSearch = el('input', { placeholder: '搜索或输入网址', 'aria-label': '主页搜索' });
  placeholder.append(homeSearch);
  const links = el('div', { style: { display: 'flex', gap: '8px', marginTop: '4px' } });
  for (const l of HOME_LINKS) {
    links.append(el('button', { class: 'btn sm', text: l.label, onclick: () => navigateTab(l.url) }));
  }
  placeholder.append(links);
  const errorEl = el('div', { class: 'browser-error hidden' },
    el('div', { class: 'big', text: '⚠' }),
    el('h3', { text: '网页加载失败' }),
    el('div', { class: 'msg' }),
    el('button', { class: 'btn primary', text: '重试', onclick: () => reloadActive() })
  );
  view.append(loadbar, placeholder, errorEl);
  root.append(top, view);
  body.append(root);

  // 清理 Chromium 进程记录
  const chromium = sys.processes.find(p => p.service === 'chromium');
  if (chromium) chromium.note = 'Chromium 网页执行不计入逻辑预算';

  function activeTab() { return state.tabs.find(t => t.id === state.activeTabId) || null; }
  function currentEl() { return webviews.get(state.activeTabId) || null; }
  function isElectron() { return !!(window.nestedHost && window.nestedHost.isElectron); }

  function ensureTabElement(tab) {
    if (webviews.has(tab.id)) return webviews.get(tab.id);
    let ew;
    if (isElectron()) {
      ew = document.createElement('webview');
      ew.setAttribute('allowpopups', '');
      ew.setAttribute('partition', 'persist:nested-browser');
      ew.setAttribute('webpreferences', 'backgroundThrottling=no');
      ew.className = 'webview';
      if (tab.url) ew.setAttribute('src', tab.url);
      ew.addEventListener('did-start-loading', () => { tab.loading = true; tab.error = null; updateChrome(); renderTabs(); });
      ew.addEventListener('did-stop-loading', () => {
        tab.loading = false;
        try { const u = ew.getURL(); if (u) tab.url = u; } catch (e) { /* 尚未 attach 时忽略 */ }
        try { const t = ew.getTitle(); if (t) tab.title = t; } catch (e) {}
        updateChrome(); renderTabs(); updateAddress();
      });
      ew.addEventListener('did-navigate', (e) => { tab.url = e.url; updateAddress(); renderTabs(); pushHistory(tab.id, e.url); });
      ew.addEventListener('did-navigate-in-page', (e) => { tab.url = e.url; updateAddress(); });
      ew.addEventListener('page-title-updated', (e) => { tab.title = e.title || tab.title; renderTabs(); ctx.setTitle(tab.title || '浏览器', tab.url); });
      ew.addEventListener('did-fail-load', (e) => {
        if (e.errorCode === -3) return;
        tab.loading = false;
        tab.error = `${e.errorDescription || '加载失败'}（${e.errorCode}）`;
        updateChrome(); renderTabs();
      });
      ew.addEventListener('dom-ready', () => { try { ew.setAudioMuted(false); } catch (e) {} });
      ew.addEventListener('focus', () => {});
    } else {
      ew = document.createElement('iframe');
      ew.className = 'iframe-preview';
      ew.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
      if (tab.url) ew.setAttribute('src', tab.url);
      ew.addEventListener('load', () => { tab.loading = false; updateChrome(); renderTabs(); });
      ew.addEventListener('error', () => { tab.error = '网页无法在预览 iframe 中加载'; updateChrome(); });
    }
    ew.style.display = 'none';
    view.append(ew);
    webviews.set(tab.id, ew);
    return ew;
  }

  function pushHistory(id, url) {
    if (!url) return;
    const h = tabHistory.get(id) || { stack: [], index: -1 };
    if (h.stack[h.index] === url) return;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(url); h.index = h.stack.length - 1;
    tabHistory.set(id, h);
  }

  function navigateTab(input, { tab = activeTab(), newTab = false } = {}) {
    if (!input) return;
    let u = input.trim();
    if (/^(file|javascript|data):/i.test(u)) {
      toast('不支持的本机地址', '浏览器设备不向网页开放宿主文件系统，请访问 http(s) 地址。', 'warn', sys);
      return;
    }
    if (!/^https?:\/\//i.test(u) && !/^about:/i.test(u)) {
      if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(u)) u = 'https://' + u;
      else if (u.includes(' ')) u = 'https://www.bing.com/search?q=' + encodeURIComponent(u);
      else u = 'https://' + u;
    }
    if (newTab) {
      const t = { id: 't' + (state.nextTab++), url: u, title: u, loading: true, error: null };
      state.tabs.push(t); state.activeTabId = t.id;
      ensureTabElement(t);
      renderTabs(); showActive();
      loadUrlIn(t, u);
      return;
    }
    if (!tab) return;
    tab.url = u; tab.title = u; tab.loading = true; tab.error = null;
    const ew = ensureTabElement(tab);
    loadUrlIn(tab, u, ew);
    updateChrome(); renderTabs();
  }
  function loadUrlIn(tab, url, ew) {
    ew = ew || ensureTabElement(tab);
    try {
      if (isElectron()) {
        // 通过属性导航：webview attach 之前也可靠
        ew.setAttribute('src', url);
        try { if (ew.getURL && ew.getURL() !== url) ew.loadURL(url); } catch (e) { /* 尚未 ready，src 会生效 */ }
      } else { ew.src = url; }
      if (!isElectron()) setTimeout(() => { tab.loading = false; updateChrome(); renderTabs(); }, 1500);
    } catch (e) {
      tab.error = String(e.message || e);
      tab.loading = false; updateChrome();
    }
    pushHistory(tab.id, url);
  }
  function reloadActive() {
    const tab = activeTab(); if (!tab) return;
    tab.error = null; tab.loading = true;
    const ew = ensureTabElement(tab);
    if (isElectron()) { try { ew.reload(); } catch (e) { loadUrlIn(tab, tab.url, ew); } }
    else if (tab.url) { ew.src = tab.url; }
    updateChrome();
  }
  function updateAddress() {
    if (addressFocused) return;
    const t = activeTab();
    address.value = t ? (t.url || '') : '';
  }
  function updateChrome() {
    const t = activeTab();
    if (t) {
      status.textContent = t.error ? '加载失败' : t.loading ? '正在加载…' : '就绪';
      loadbar.classList.toggle('loading', !!t.loading);
      errorEl.classList.toggle('hidden', !t.error);
      if (t.error) errorEl.querySelector('.msg').textContent = t.error;
      placeholder.style.display = (!t.url) ? 'flex' : 'none';
      ctx.setTitle(t.loading ? '加载中… · ' + (t.title || '浏览器') : (t.title || '浏览器'), t.url || '新标签页');
      let canBack = false, canFwd = false;
      if (isElectron()) {
        try { canBack = !!currentEl()?.canGoBack?.(); } catch (e) {}
        try { canFwd = !!currentEl()?.canGoForward?.(); } catch (e) {}
      } else {
        canBack = ((tabHistory.get(t.id)?.index || 0) > 0);
        canFwd = ((tabHistory.get(t.id)?.index ?? 0) < (tabHistory.get(t.id)?.stack?.length ?? 1) - 1);
      }
      back.disabled = !canBack; fwd.disabled = !canFwd;
    }
    if (chromium) { chromium.state = state.tabs.length ? 'ready' : 'waiting'; chromium.memory = 120 + state.tabs.length * 20; }
  }
  function showActive() {
    const activeId = state.activeTabId;
    for (const [id, ew] of webviews) ew.style.display = id === activeId ? '' : 'none';
    updateAddress(); updateChrome(); renderTabs(); markActiveTab();
  }
  function renderTabs() {
    tabsBar.querySelectorAll('.browser-tab').forEach(n => n.remove());
    for (const t of state.tabs) {
      const tab = el('div', { class: 'browser-tab' + (t.id === state.activeTabId ? ' active' : ''), dataset: { testid: 'browser-tab', 'tab-id': t.id }, title: t.title || t.url },
        el('span', { class: 'fav' }),
        el('span', { class: 'bt-title', text: t.loading ? '加载中…' : (t.title || '新标签页') }),
        el('button', { class: 'bt-close', title: '关闭标签页', 'aria-label': '关闭标签页', dataset: { testid: 'browser-close-tab', 'tab-id': t.id }, html: glyph('close', 10), onclick: (e) => { e.stopPropagation(); closeTab(t.id); } })
      );
      tab.addEventListener('click', (e) => { if (e.target.closest('.bt-close')) return; activateTab(t.id); });
      tabsBar.insertBefore(tab, addBtn);
    }
  }
  function markActiveTab() {
    for (const t of state.tabs) {
      const ew = webviews.get(t.id);
      if (ew) ew.style.display = t.id === state.activeTabId ? '' : 'none';
    }
  }
  function activateTab(id) {
    if (state.activeTabId === id) return;
    state.activeTabId = id;
    ensureTabElement(activeTab());
    showActive();
    changed('browser-tab');
  }
  function closeTab(id) {
    const idx = state.tabs.findIndex(t => t.id === id);
    if (idx < 0) return;
    const ew = webviews.get(id);
    if (ew) { try { ew.remove(); } catch (e) {} webviews.delete(id); }
    tabHistory.delete(id);
    state.tabs.splice(idx, 1);
    if (!state.tabs.length) {
      const t = { id: 't' + (state.nextTab++), url: '', title: '新标签页', loading: false, error: null };
      state.tabs.push(t);
      state.activeTabId = t.id;
    } else if (state.activeTabId === id) {
      state.activeTabId = state.tabs[Math.min(idx, state.tabs.length - 1)].id;
    }
    showActive();
    changed('browser-close');
  }
  function createNewTab(url = '') {
    const t = { id: 't' + (state.nextTab++), url: '', title: '新标签页', loading: false, error: null };
    state.tabs.push(t); state.activeTabId = t.id;
    ensureTabElement(t);
    renderTabs(); showActive();
    if (url) navigateTab(url, { tab: t });
    else { address.value = ''; address.focus(); }
  }

  addBtn.addEventListener('click', () => createNewTab());
  go.addEventListener('click', () => { navigateTab(address.value); address.blur(); });
  address.addEventListener('focus', () => { addressFocused = true; address.select(); });
  address.addEventListener('blur', () => { addressFocused = false; updateAddress(); });
  address.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); navigateTab(address.value); address.blur(); }
    else if (e.key === 'Escape') { updateAddress(); address.blur(); }
  });
  back.addEventListener('click', () => {
    const ew = currentEl();
    if (isElectron() && ew) { try { ew.goBack(); } catch (e) {} }
    else {
      const h = tabHistory.get(state.activeTabId); if (h && h.index > 0) { h.index--; loadUrlIn(activeTab(), h.stack[h.index]); }
    }
  });
  fwd.addEventListener('click', () => {
    const ew = currentEl();
    if (isElectron() && ew) { try { ew.goForward(); } catch (e) {} }
    else {
      const h = tabHistory.get(state.activeTabId); if (h && h.index < h.stack.length - 1) { h.index++; loadUrlIn(activeTab(), h.stack[h.index]); }
    }
  });
  reload.addEventListener('click', reloadActive);
  stop.addEventListener('click', () => {
    const ew = currentEl();
    if (isElectron() && ew) { try { ew.stop(); } catch (e) {} }
    const t = activeTab(); if (t) t.loading = false;
    updateChrome();
  });
  homeSearch.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') navigateTab(homeSearch.value);
  });

  // 外部页面请求新窗口：在浏览器内开新标签
  if (window.nestedHost && window.nestedHost.onBrowserPopup) {
    window.nestedHost.onBrowserPopup((url) => { createNewTab(url); changed('browser-popup'); });
  }

  // 初始化所有标签元素（非活动标签保留页面）
  for (const t of state.tabs) ensureTabElement(t);
  if (!activeTab().url) {
    // 不自动联网，保持新标签页
    placeholder.style.display = 'flex';
  }
  showActive();
  if (activeTab().url) navigateTab(activeTab().url);
  updateChrome();
  return {
    destroy() {
      for (const ew of webviews.values()) { try { ew.remove(); } catch (e) {} }
      webviews.clear();
    },
    requestClose() { return true; }
  };
}
