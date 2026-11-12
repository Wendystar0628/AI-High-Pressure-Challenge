import { appIcon, uiIcon } from '../ui/icons.js';
import { el, $s, $all, esc } from '../ui/common.js';

export const meta = {
  title: '浏览器', desc: 'Chromium 真实网页 · 多标签',
  width: 1180, height: 740, minW: 680, minH: 420, rootOnly: true,
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const QUICK_LINKS = [
  { label: '哔哩哔哩', url: 'https://www.bilibili.com', cls: 'bili', glyph: 'B' },
  { label: '百度', url: 'https://www.baidu.com', cls: 'baidu', glyph: '百' },
  { label: '必应', url: 'https://www.bing.com', cls: 'bing', glyph: 'b' },
  { label: '知乎', url: 'https://www.zhihu.com', cls: 'zhihu', glyph: '知' },
];

export function mount(ctx) {
  const { sys, os, shell, body, data, window: win } = ctx;
  if (!data.browser) data.browser = { tabs: [], activeId: null, nextId: 1 };
  const st = data.browser;
  if (!Array.isArray(st.tabs)) st.tabs = [];
  if (!st.tabs.length) addTab(null, null, false);
  let webviews = new Map(); // tabId -> {wv, view, pid, wcId}
  let unmounted = false;
  let newTabUnsub = null;
  let destroyedUnsub = null;

  body.innerHTML = `<div class="browser-app">
    <div class="browser-tabstrip">
      <div class="browser-tabs" data-browser-tabs></div>
      <button type="button" class="browser-newtab" data-testid="browser-new-tab" title="新建标签页" aria-label="新建标签页">${uiIcon('plus')}</button>
      <div class="browser-win-drag"></div>
      <span class="browser-cengine">Chromium · 真实网络</span>
    </div>
    <div class="browser-navbar">
      <div class="browser-navbtns">
        <button type="button" class="icon-button" data-testid="browser-back" data-browser-back title="后退" aria-label="后退">${uiIcon('arrowLeft')}</button>
        <button type="button" class="icon-button" data-testid="browser-forward" data-browser-forward title="前进" aria-label="前进">${uiIcon('arrowRight')}</button>
        <button type="button" class="icon-button" data-testid="browser-reload" data-browser-reload title="刷新 / 停止" aria-label="刷新或停止加载">${uiIcon('reload')}</button>
      </div>
      <div class="browser-address-wrap">
        <span class="browser-secure" data-browser-secure>${uiIcon('shield')}</span>
        <input type="text" class="browser-address" data-testid="browser-address" spellcheck="false" placeholder="输入网址或搜索关键词" aria-label="地址栏">
        <span class="browser-loading" data-browser-loading hidden></span>
      </div>
      <button type="button" class="browser-go" data-testid="browser-go" title="前往" aria-label="前往">${uiIcon('chevron')}</button>
      <div class="browser-actions">
        <button type="button" class="icon-button" data-browser-home title="主页" aria-label="主页">${uiIcon('grid')}</button>
        <button type="button" class="icon-button" data-browser-external title="在宿主外打开" aria-label="在宿主外打开">${uiIcon('projection')}</button>
      </div>
    </div>
    <div class="browser-progress"><i data-browser-progress></i></div>
    <div class="browser-content" data-browser-content></div>
    <div class="browser-statusbar">
      <span data-browser-status>就绪</span>
      <span class="spacer"></span>
      <span data-browser-tabcount></span>
      <span class="browser-sep"></span>
      <span>网页由 Chromium 执行 · 不计入逻辑预算与快照</span>
    </div>
  </div>`;

  const tabsEl = $s(body, '[data-browser-tabs]');
  const contentEl = $s(body, '[data-browser-content]');
  const addressEl = $s(body, '[data-testid="browser-address"]');
  const progressEl = $s(body, '[data-browser-progress]');
  const loadingEl = $s(body, '[data-browser-loading]');
  const statusEl = $s(body, '[data-browser-status]');

  function activeTab() { return st.tabs.find((t) => t.id === st.activeId) || st.tabs[0]; }

  function addTab(url, title, activate = true) {
    const id = `tab-${st.nextId++}`;
    const tab = {
      id, url: url || 'nested://start',
      title: title || (url ? '加载中…' : '新标签页'),
      loadState: url ? 'loading' : 'idle', error: null,
    };
    st.tabs.push(tab);
    if (activate) st.activeId = id;
    return tab;
  }

  function closeTab(id) {
    const idx = st.tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    destroyWebview(id);
    st.tabs.splice(idx, 1);
    if (!st.tabs.length) addTab(null, null, true);
    if (st.activeId === id) st.activeId = st.tabs[Math.max(0, idx - 1)].id;
    renderAll();
    activateTab(st.activeId);
  }

  function destroyWebview(tabId) {
    const rec = webviews.get(tabId);
    if (!rec) return;
    try { rec.wv.remove(); } catch { /* ignore */ }
    if (rec.pid) os.removeProcess(sys.id, rec.pid);
    webviews.delete(tabId);
  }

  function navigateTab(tab, raw) {
    let url = String(raw || '').trim();
    if (!url) return;
    if (url === 'nested://start') { tab.url = 'nested://start'; tab.title = '新标签页'; tab.loadState = 'idle'; renderAll(); activateTab(tab.id); return; }
    if (!/^[a-zA-Z][\w+.-]*:/.test(url)) {
      if (/^[\w-]+(\.[\w-]+)+([/:?#].*)?$/.test(url)) url = 'https://' + url;
      else url = 'https://www.baidu.com/s?wd=' + encodeURIComponent(url);
    }
    tab.url = url; tab.title = '加载中…'; tab.loadState = 'loading'; tab.error = null;
    renderAll(); activateTab(tab.id);
    ensureWebview(tab);
    const rec = webviews.get(tab.id);
    if (rec) {
      try { rec.wv.loadURL(url); } catch (err) { tab.loadState = 'failed'; tab.error = String(err.message || err); renderAll(); }
    }
  }

  function ensureWebview(tab) {
    if (tab.url === 'nested://start') return null;
    let rec = webviews.get(tab.id);
    if (rec) return rec;
    const view = el(`<div class="browser-view" data-tab-view="${tab.id}"></div>`);
    const wv = document.createElement('webview');
    wv.className = 'browser-webview';
    wv.setAttribute('partition', 'persist:nested-web');
    wv.setAttribute('allowpopups', '');
    wv.setAttribute('useragent', UA);
    wv.setAttribute('webpreferences', 'contextIsolation=yes,nodeIntegration=no,backgroundThrottling=no,javascript=yes');
    wv.setAttribute('src', tab.url);
    view.appendChild(wv);
    contentEl.appendChild(view);
    rec = { wv, view, pid: 0, wcId: 0 };
    webviews.set(tab.id, rec);
    view.classList.toggle('active', st.activeId === tab.id);
    const tabId = tab.id;
    const updateTab = (patch) => {
      const t = st.tabs.find((x) => x.id === tabId);
      if (!t) return;
      Object.assign(t, patch);
      if (st.activeId === tabId) {
        addressEl.value = t.url === 'nested://start' ? '' : t.url;
        syncAddress(t);
      }
      renderTabs(); renderStatus(); syncTabTitle(); syncWebProcess(t);
      updateErrorOverlay(t);
    };
    wv.addEventListener('did-start-loading', () => {
      updateTab({ loadState: 'loading', error: null });
      progressEl.classList.add('loading');
    });
    wv.addEventListener('did-stop-loading', () => {
      let url = tab.url;
      let title = tab.title;
      try { url = wv.getURL() || url; } catch { /* ignore */ }
      try { title = wv.getTitle() || title; } catch { /* ignore */ }
      updateTab({ loadState: 'loaded', url, title, error: null });
      progressEl.classList.remove('loading');
    });
    wv.addEventListener('did-navigate', (e) => updateTab({ url: e.url, loadState: 'loaded' }));
    wv.addEventListener('did-navigate-in-page', (e) => updateTab({ url: e.url }));
    wv.addEventListener('page-title-updated', (e) => updateTab({ title: e.title }));
    wv.addEventListener('page-favicon-updated', () => {});
    wv.addEventListener('did-fail-load', (e) => {
      if (e.errorCode === -3 || !e.isMainFrame) return;
      updateTab({ loadState: 'failed', error: `${e.errorDescription || '加载失败'}（${e.errorCode}）` });
      progressEl.classList.remove('loading');
    });
    wv.addEventListener('dom-ready', () => {
      try {
        rec.wcId = wv.getWebContentsId();
        if (!rec.pid) {
          const proc = os.addWebProcess(sys.id, tab.id, tab.title);
          if (proc) { rec.pid = proc.pid; syncWebProcess(tab); }
        }
      } catch { /* ignore */ }
      progressEl.classList.remove('loading');
    });
    wv.addEventListener('crashed', () => {
      updateTab({ loadState: 'failed', error: '网页渲染进程已崩溃，请刷新重试' });
    });
    return rec;
  }

  function syncWebProcess(tab) {
    const rec = webviews.get(tab.id);
    if (!rec?.pid) return;
    const proc = sys.processes.find((p) => p.pid === rec.pid);
    if (proc) proc.name = `网页 · ${tab.title || '标签页'}`;
  }

  function updateErrorOverlay(tab) {
    const rec = webviews.get(tab.id);
    if (!rec) return;
    const view = rec.view;
    let overlay = view.querySelector('.browser-error-overlay');
    if (tab.loadState === 'failed') {
      if (!overlay) {
        overlay = el(`<div class="browser-error-overlay">${uiIcon('warning')}<b>网页加载失败</b><span></span><button type="button" class="small-button" data-retry>重新加载</button></div>`);
        view.appendChild(overlay);
        overlay.querySelector('[data-retry]').addEventListener('click', () => { overlay.remove(); navigateTab(tab, tab.url); });
      }
      overlay.querySelector('span').textContent = tab.error || '网络或站点拒绝连接。';
    } else if (overlay) overlay.remove();
  }

  function activateTab(id) {
    const tab = st.tabs.find((t) => t.id === id);
    if (!tab) return;
    st.activeId = id;
    if (tab.url !== 'nested://start') ensureWebview(tab);
    for (const t of st.tabs) {
      const view = $s(contentEl, `[data-tab-view="${t.id}"]`);
      if (view) view.classList.toggle('active', t.id === id);
    }
    // 起始页
    let startView = $s(contentEl, '.browser-start');
    if (tab.url === 'nested://start') {
      if (!startView) startView = buildStartPage();
      startView.__tabId = id;
      startView.classList.add('active');
      for (const v of $all(contentEl, '.browser-view')) v.classList.remove('active');
    } else if (startView) startView.classList.remove('active');
    addressEl.value = tab.url === 'nested://start' ? '' : (tab.url || '');
    syncAddress(tab);
    renderTabs(); renderStatus(); syncTabTitle();
  }

  function syncAddress(tab) {
    const secure = $s(body, '[data-browser-secure]');
    if (secure) {
      const isHttps = /^https:/i.test(tab.url || '');
      secure.classList.toggle('secure', isHttps);
      secure.innerHTML = isHttps ? uiIcon('shield') : (tab.url === 'nested://start' ? uiIcon('grid') : uiIcon('info'));
    }
    const load = $s(body, '[data-browser-loading]');
    if (load) load.hidden = tab.loadState !== 'loading';
  }

  function renderTabs() {
    tabsEl.innerHTML = st.tabs.map((t) => `<div class="browser-tab ${t.id === st.activeId ? 'active' : ''}" data-testid="browser-tab" data-tab-id="${t.id}" data-tab-url="${esc(t.url || '')}" title="${esc(t.title || '')}">
      <span class="browser-tab-favicon">${t.loadState === 'loading' ? '<i class="spinner"></i>' : (t.url?.includes('bilibili') ? '<b class="fav-bili">b</b>' : uiIcon('browser'))}</span>
      <span class="browser-tab-title">${esc(t.title || '新标签页')}</span>
      ${t.loadState === 'failed' ? `<span class="browser-tab-error" title="${esc(t.error || '')}">!</span>` : ''}
      <button type="button" class="browser-tab-close" data-testid="browser-close-tab" data-tab-id="${t.id}" aria-label="关闭标签页" title="关闭标签">${uiIcon('close')}</button>
    </div>`).join('');
    for (const tab of $all(tabsEl, '.browser-tab')) {
      tab.addEventListener('click', (e) => {
        if (e.target.closest('.browser-tab-close')) return;
        activateTab(tab.dataset.tabId);
      });
      tab.addEventListener('auxclick', (e) => { if (e.button === 1) closeTab(tab.dataset.tabId); });
      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        shell.contextMenu(sys.id, e.clientX, e.clientY, [
          { label: '关闭标签页', icon: 'close', danger: true, action: () => closeTab(tab.dataset.tabId) },
          { label: '复制网址', icon: 'copy', action: () => { const t = st.tabs.find((x) => x.id === tab.dataset.tabId); if (t?.url) { navigator.clipboard?.writeText(t.url); os.addClipboard(t.url, { kind: 'text' }); } } },
          { label: '刷新', icon: 'reload', action: () => { const rec = webviews.get(tab.dataset.tabId); if (rec) rec.wv.reload(); } },
        ]);
      });
    }
    for (const btn of $all(tabsEl, '[data-testid="browser-close-tab"]')) {
      btn.addEventListener('click', (e) => { e.stopPropagation(); closeTab(btn.dataset.tabId); });
    }
    const count = $s(body, '[data-browser-tabcount]');
    if (count) count.textContent = `${st.tabs.length} 个标签`;
  }

  function renderStatus() {
    const tab = activeTab();
    if (!tab) return;
    const txt = tab.loadState === 'loading' ? '正在加载…' : tab.loadState === 'failed' ? '加载失败，可点击刷新重试' : tab.loadState === 'loaded' ? '已完成' : '就绪';
    statusEl.textContent = txt;
    statusEl.dataset.state = tab.loadState;
    $s(body, '[data-browser-loading]').hidden = tab.loadState !== 'loading';
  }

  function syncTabTitle() {
    const tab = activeTab();
    if (!tab) return;
    ctx.setTitle(`${tab.title || '新标签页'} — 浏览器`);
  }

  function renderAll() {
    renderTabs(); renderStatus();
    const tab = activeTab();
    if (tab) { addressEl.value = tab.url === 'nested://start' ? '' : tab.url; syncAddress(tab); syncTabTitle(); }
    // 确保起始页与标签绑定
    if (tab && tab.url === 'nested://start') activateTab(tab.id);
  }

  function buildStartPage() {
    const page = el(`<div class="browser-start">
      <div class="browser-start-bg"></div>
      <div class="browser-start-inner">
        <div class="browser-start-brand"><span class="browser-nest-mark">${uiIcon('grid')}</span><div><b>NESTED BROWSER</b><span>Chromium 驱动的真实网页视图</span></div></div>
        <div class="browser-start-title">从这里，通向真实互联网。</div>
        <form class="browser-start-search"><span>${uiIcon('search')}</span><input type="text" placeholder="搜索或输入网址" aria-label="搜索"><button type="submit">${uiIcon('chevron')}</button></form>
        <div class="browser-quicklinks">${QUICK_LINKS.map((q) => `<button type="button" class="browser-quicklink ${q.cls}" data-quick-url="${q.url}"><span>${q.glyph}</span>${q.label}</button>`).join('')}</div>
        <div class="browser-start-notes">
          <div>${uiIcon('shield')}<b>隔离</b><span>网页不开放宿主文件系统与 Node.js</span></div>
          <div>${uiIcon('projection')}<b>窗口内</b><span>网页随窗口移动、缩放与遮挡</span></div>
          <div>${uiIcon('link')}<b>真实网络</b><span>加载失败会明确提示并可重试</span></div>
        </div>
      </div>
      <div class="browser-start-foot">网页由 Chromium 实际执行。宿主绘制与网页执行不计入逻辑执行预算。</div>
    </div>`);
    contentEl.appendChild(page);
    const input = $s(page, '.browser-start-search input');
    $s(page, '.browser-start-search').addEventListener('submit', (e) => {
      e.preventDefault();
      const tab = activeTab();
      if (tab) navigateTab(tab, input.value);
    });
    for (const q of $all(page, '[data-quick-url]')) q.addEventListener('click', () => { const tab = activeTab(); if (tab) navigateTab(tab, q.dataset.quickUrl); });
    page.__tabId = activeTab()?.id;
    return page;
  }

  // ---------------- 事件 ----------------
  function go(delta) {
    const tab = activeTab();
    const rec = tab && webviews.get(tab.id);
    if (!rec) return;
    try {
      if (delta < 0 && rec.wv.canGoBack()) rec.wv.goBack();
      else if (delta > 0 && rec.wv.canGoForward()) rec.wv.goForward();
    } catch { /* ignore */ }
  }
  $s(body, '[data-browser-back]').addEventListener('click', () => go(-1));
  $s(body, '[data-browser-forward]').addEventListener('click', () => go(1));
  $s(body, '[data-browser-reload]').addEventListener('click', () => {
    const tab = activeTab(); if (!tab) return;
    if (tab.url === 'nested://start') return;
    const rec = webviews.get(tab.id);
    if (!rec) { ensureWebview(tab); return; }
    try { if (tab.loadState === 'loading') rec.wv.stop(); else rec.wv.reload(); } catch { /* ignore */ }
  });
  $s(body, '[data-testid="browser-go"]').addEventListener('click', () => { const t = activeTab(); if (t) navigateTab(t, addressEl.value); });
  addressEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); const t = activeTab(); if (t) navigateTab(t, addressEl.value); }
    if (e.key === 'Escape') { const t = activeTab(); if (t) addressEl.value = t.url === 'nested://start' ? '' : t.url; addressEl.blur(); }
  });
  addressEl.addEventListener('focus', () => addressEl.select());
  $s(body, '[data-testid="browser-new-tab"]').addEventListener('click', () => {
    const t = addTab(null, null, true);
    activateTab(t.id);
  });
  $s(body, '[data-browser-home]').addEventListener('click', () => {
    const t = activeTab(); if (!t) return;
    navigateTab(t, 'nested://start');
  });
  $s(body, '[data-browser-external]').addEventListener('click', () => {
    const t = activeTab();
    if (t && /^https?:/.test(t.url)) window.nestHost.openExternal(t.url); else ctx.toast('当前没有可打开的外部网址', 'info');
  });
  tabsEl.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) < 10) return;
    tabsEl.scrollLeft += e.deltaY;
  }, { passive: true });

  newTabUnsub = window.nestHost.onBrowserNewTab(async ({ webContentsId, url }) => {
    if (unmounted) return;
    const owner = [...webviews.values()].find((r) => r.wcId === webContentsId);
    if (!owner) return;
    const tab = addTab(url, '新标签页', true);
    renderAll(); activateTab(tab.id);
    if (url) navigateTab(tab, url);
  });
  destroyedUnsub = window.nestHost.onWebviewDestroyed(({ webContentsId }) => {
    if (unmounted) return;
    for (const [tabId, rec] of webviews) {
      if (rec.wcId === webContentsId) {
        const tab = st.tabs.find((t) => t.id === tabId);
        if (tab) { tab.loadState = 'failed'; tab.error = '网页进程已结束'; renderAll(); }
      }
    }
  });

  // 恢复已有标签页
  for (const tab of st.tabs) {
    if (tab.url && tab.url !== 'nested://start') {
      tab.loadState = 'loading';
      ensureWebview(tab);
    }
  }
  if (!st.activeId) st.activeId = st.tabs[0].id;
  activateTab(st.activeId);

  return {
    destroy() {
      unmounted = true;
      try { newTabUnsub?.(); } catch { /* ignore */ }
      try { destroyedUnsub?.(); } catch { /* ignore */ }
      for (const tabId of [...webviews.keys()]) destroyWebview(tabId);
    },
    inspect() {
      return {
        tabs: st.tabs.map((t) => ({ tabId: t.id, url: t.url, title: t.title, loadState: t.loadState })),
      };
    },
  };
}
