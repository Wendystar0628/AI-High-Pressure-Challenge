// 浏览器应用：界面自制，网页由 Chromium（<webview>）执行。外部网页不计入逻辑预算，
// 不向网页开放宿主文件系统、Node.js 或系统内部对象（见 main.cjs 的 will-attach-webview）。
import { h } from './desktop.js';
import { iconSvg } from '../host/icons.js';

let nextTab = 1;
const HOME_LINKS = [['bilibili', 'https://www.bilibili.com/'], ['必应', 'https://www.bing.com/'], ['维基百科', 'https://zh.wikipedia.org/'], ['知乎', 'https://www.zhihu.com/']];

function normalizeUrl(s) {
  s = s.trim();
  if (!s) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || s.startsWith('about:') || s.startsWith('data:')) return s;
  if (/^[^\s]+\.[^\s]+$/.test(s) || s.startsWith('localhost')) return 'https://' + s;
  return 'https://www.bing.com/search?q=' + encodeURIComponent(s);
}

export function browserApp(desk, args) {
  const tabs = [];
  let active = null;
  const K = desk.K;
  const svc = K.newService('浏览器界面', 'browser');
  const tabBar = h('div', { class: 'br-tabs' });
  const views = h('div', { class: 'br-views' });
  const progress = h('div', { class: 'br-progress' });
  const addr = h('input', { class: 'br-addr', tid: 'browser-address', 'data-system-id': 'outer', placeholder: '输入网址或搜索', label: '地址栏', onkeydown: (e) => { if (e.key === 'Enter') { go(addr.value); e.preventDefault(); } }, onfocus: () => addr.select() });
  const nb = (tid, name, label, fn) => h('div', { class: 'br-b', tid, 'data-system-id': 'outer', role: 'button', label, html: iconSvg(name), onclick: fn });
  const backBtn = nb('browser-back', 'back', '后退', () => { if (active && active.view && active.ready && active.view.canGoBack()) active.view.goBack(); });
  const fwdBtn = nb('browser-forward', 'forward', '前进', () => { if (active && active.view && active.ready && active.view.canGoForward()) active.view.goForward(); });
  const reloadBtn = nb('browser-reload', 'reload', '刷新', () => { if (!active || !active.view || !active.ready) return; if (active.loadState === 'loading') active.view.stop(); else { clearError(active); active.view.reload(); } });
  const goBtn = h('button', { class: 'rbtn', tid: 'browser-go', 'data-system-id': 'outer', text: '前往', onclick: () => go(addr.value) });
  const nav = h('div', { class: 'br-nav' }, backBtn, fwdBtn, reloadBtn, addr, goBtn);
  const pane = h('div', { class: 'pane' }, tabBar, nav, progress, views);

  function startPage(tab) {
    const box = h('div', { class: 'br-start', tid: 'browser-start' }, h('h2', { text: 'Nest 浏览器' }), h('div', { class: 'rlabel', text: '基于 Chromium，网页按真实时间和网络运行' }),
      h('div', { class: 'br-links' }, HOME_LINKS.map(([n, u]) => h('button', { class: 'rbtn', text: n, onclick: () => navigate(tab, u) }))));
    return box;
  }
  function newTab(url) {
    const tab = { id: nextTab++, url: url || '', title: '新标签页', loadState: url ? 'loading' : 'idle', view: null, ready: false, error: null };
    tab.start = startPage(tab);
    tab.errEl = h('div', { class: 'br-error hidden', tid: 'browser-error' });
    views.append(tab.start, tab.errEl);
    tabs.push(tab);
    select(tab);
    if (url) navigate(tab, url);
    else setTimeout(() => { if (active === tab) addr.focus(); }, 0);
    return tab;
  }
  function ensureView(tab, firstUrl) {
    if (tab.view) return false;
    const v = document.createElement('webview');
    v.setAttribute('partition', 'persist:nestbrowser');
    v.setAttribute('allowpopups', 'true');
    v.setAttribute('webpreferences', 'backgroundThrottling=false,contextIsolation=true,nodeIntegration=false,sandbox=true');
    v.setAttribute('src', firstUrl);
    v.dataset.tabId = tab.id;
    tab.view = v;
    bindView(tab, v);
    views.insertBefore(v, views.firstChild);
    return true;
  }
  function bindView(tab, v) {
    v.addEventListener('dom-ready', () => { tab.ready = true; tab.wcId = v.getWebContentsId(); syncNav(); });
    v.addEventListener('did-start-loading', () => { tab.loadState = 'loading'; clearError(tab); syncNav(); });
    v.addEventListener('did-stop-loading', () => { if (tab.loadState === 'loading') tab.loadState = tab.error ? 'failed' : 'loaded'; syncNav(); });
    v.addEventListener('did-navigate', (e) => { tab.url = e.url; syncNav(); });
    v.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) { tab.url = e.url; syncNav(); } });
    v.addEventListener('page-title-updated', (e) => { tab.title = e.title; renderTabs(); if (active === tab) syncTitle(); });
    v.addEventListener('did-fail-load', (e) => {
      if (!e.isMainFrame || e.errorCode === -3) return; // -3 是用户中止
      tab.error = { code: e.errorCode, desc: e.errorDescription, url: e.validatedURL };
      tab.loadState = 'failed';
      showError(tab);
      syncNav();
    });
    v.addEventListener('focus', () => { desk.activate(win); });
  }
  function showError(tab) {
    tab.errEl.textContent = '';
    tab.errEl.append(h('h3', { text: '网页加载失败' }), h('div', { class: 'rlabel', text: `${tab.error.url || tab.url}` }), h('div', { class: 'rlabel', text: `${tab.error.desc || '网络错误'}（${tab.error.code}）` }),
      h('button', { class: 'rbtn primary', tid: 'browser-retry', text: '重试', onclick: () => { clearError(tab); navigate(tab, tab.error ? tab.error.url : tab.url); } }));
    tab.errEl.classList.toggle('hidden', tab !== active);
  }
  function clearError(tab) { tab.error = null; tab.errEl.classList.add('hidden'); }
  function navigate(tab, url) {
    tab.url = url; tab.loadState = 'loading';
    tab.title = url;
    tab.start.classList.add('hidden');
    if (!ensureView(tab, url)) {
      if (tab.ready) tab.view.loadURL(url).catch(() => {});
      else tab.view.setAttribute('src', url);
    }
    select(tab);
  }
  function go(text) {
    const u = normalizeUrl(text);
    if (!u) return;
    if (!active) newTab(u); else navigate(active, u);
    addr.blur();
  }
  function select(tab) {
    active = tab;
    for (const t of tabs) {
      if (t.view) t.view.classList.toggle('hidden', t !== tab);
      t.start.classList.toggle('hidden', t !== tab || !!t.view);
      t.errEl.classList.toggle('hidden', t !== tab || !t.error);
    }
    renderTabs();
    syncNav();
  }
  function closeTab(tab) {
    const i = tabs.indexOf(tab);
    if (i < 0) return;
    tabs.splice(i, 1);
    if (tab.view) tab.view.remove();
    tab.start.remove(); tab.errEl.remove();
    if (active === tab) {
      if (tabs.length) select(tabs[Math.min(i, tabs.length - 1)]);
      else { active = null; desk.destroyWindow(win); return; }
    }
    renderTabs();
  }
  function renderTabs() {
    tabBar.textContent = '';
    for (const t of tabs) {
      tabBar.appendChild(h('div', {
        class: 'br-tab' + (t === active ? ' on' : ''), tid: 'browser-tab', 'data-system-id': 'outer', 'data-window-id': win.id, 'data-tab-id': t.id, role: 'tab', label: t.title,
        onpointerdown: (e) => { if (!e.target.closest('.br-x')) select(t); },
        onauxclick: (e) => { if (e.button === 1) closeTab(t); },
      }, h('span', { class: 'tt', text: t.loadState === 'loading' ? `⋯ ${t.title}` : t.title }),
      h('div', { class: 'br-x', tid: 'browser-close-tab', 'data-system-id': 'outer', 'data-window-id': win.id, 'data-tab-id': t.id, role: 'button', label: '关闭标签', html: iconSvg('close'), onclick: (e) => { e.stopPropagation(); closeTab(t); } })));
    }
    tabBar.appendChild(h('div', { class: 'br-new', tid: 'browser-new-tab', 'data-system-id': 'outer', 'data-window-id': win.id, role: 'button', label: '新建标签', html: iconSvg('plus'), onclick: () => newTab() }));
  }
  function syncTitle() { desk.setTitle(win, active && active.title ? `${active.title} — 浏览器` : '浏览器'); }
  function syncNav() {
    const t = active;
    if (!t) return;
    if (document.activeElement !== addr) addr.value = t.url;
    progress.classList.toggle('on', t.loadState === 'loading');
    reloadBtn.innerHTML = iconSvg(t.loadState === 'loading' ? 'stop' : 'reload');
    reloadBtn.setAttribute('aria-label', t.loadState === 'loading' ? '停止' : '刷新');
    const can = t.view && t.ready;
    backBtn.classList.toggle('off', !(can && t.view.canGoBack()));
    fwdBtn.classList.toggle('off', !(can && t.view.canGoForward()));
    renderTabs();
    syncTitle();
  }
  const win = desk.createWindow({
    app: 'browser', title: '浏览器', icon: 'browser', w: 1100, h: 700, svc,
    onClose: () => { for (const t of tabs) if (t.view) t.view.remove(); tabs.length = 0; desk.browsers.delete(win); return true; },
    onKey: (e) => { if (e.type === 'keydown' && e.ctrlKey) { const k = e.key.toLowerCase(); if (k === 't') { newTab(); e.preventDefault(); } else if (k === 'w') { if (active) closeTab(active); e.preventDefault(); } else if (k === 'l') { addr.focus(); e.preventDefault(); } } },
  });
  win.body.appendChild(pane);
  win.tabs = tabs;
  win.newTab = newTab;
  win.ownsWebContents = (id) => tabs.some((t) => t.wcId === id);
  win.killViews = () => { for (const t of [...tabs]) closeTab(t); };
  for (const el of [addr, backBtn, fwdBtn, reloadBtn, goBtn]) el.dataset.windowId = win.id;
  desk.browsers.add(win);
  newTab(args.url);
  return win;
}

export function installBrowser(desk) {
  desk.browsers = new Set();
  // 网页打开新页面时在浏览器内部处理，不弹到作品外
  window.hostApi.onBrowserNewTab(({ url, fromId }) => {
    let target = null;
    for (const w of desk.browsers) if (w.ownsWebContents(fromId)) target = w;
    if (!target) target = [...desk.browsers][0];
    if (target) { desk.restore(target); target.newTab(url); }
    else desk.launch('browser', { url });
  });
  desk.browserViews = () => {
    const out = [];
    for (const w of desk.browsers) for (const t of w.tabs) if (t.view) out.push({ key: `${w.id}|${t.id}`, windowId: w.id, tabId: t.id, title: t.title, loadState: t.loadState, url: t.url });
    return out;
  };
  desk.killBrowserView = (key) => {
    const [wid] = key.split('|');
    for (const w of desk.browsers) if (w.id === wid) { const list = [...w.tabs]; desk.destroyWindowWithViews(w, list); }
  };
  desk.destroyWindowWithViews = (w) => { w.killViews(); if (desk.windows.has(w.id)) desk.destroyWindow(w); };
}
