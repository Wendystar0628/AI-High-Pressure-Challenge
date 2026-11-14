// Root System Real Chromium Multi-Tab Browser (<webview partition="persist:nested-browser">)

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'https://www.bilibili.com';
  if (/^(https?|about|data):/i.test(s)) return s;
  if (s.includes('.') && !s.includes(' ')) return 'https://' + s;
  return `https://www.bing.com/search?q=${encodeURIComponent(s)}`;
}

export function mountRootBrowser({ container, win, hostKernel }) {
  const tabs = [];
  let activeTabId = null;
  let tabSeq = 1;

  container.innerHTML = `
    <div class="browser-root">
      <div class="browser-tabs-bar">
        <div class="browser-tabs-list" style="display:flex;gap:4px;"></div>
        <button class="os-btn os-btn-xs" data-testid="browser-new-tab" data-system-id="outer" data-window-id="${esc(win.id)}" title="新建标签页">+</button>
      </div>
      <div class="browser-nav-bar">
        <button class="os-btn os-btn-xs" data-testid="browser-back" data-system-id="outer" data-window-id="${esc(win.id)}" title="后退">←</button>
        <button class="os-btn os-btn-xs" data-testid="browser-forward" data-system-id="outer" data-window-id="${esc(win.id)}" title="前进">→</button>
        <button class="os-btn os-btn-xs" data-testid="browser-reload" data-system-id="outer" data-window-id="${esc(win.id)}" title="刷新">⟳</button>
        <input class="os-inp flex-1" data-testid="browser-address" data-system-id="outer" data-window-id="${esc(win.id)}" placeholder="输入网址或搜索词..." />
        <button class="os-btn os-btn-accent os-btn-xs" data-testid="browser-go" data-system-id="outer" data-window-id="${esc(win.id)}">前往</button>
      </div>
      <div class="browser-stage">
        <div class="browser-drag-shield"></div>
      </div>
    </div>
  `;

  const tabsListEl = container.querySelector('.browser-tabs-list');
  const addrInp = container.querySelector('[data-testid="browser-address"]');
  const stageEl = container.querySelector('.browser-stage');
  const dragShield = container.querySelector('.browser-drag-shield');
  const reloadBtn = container.querySelector('[data-testid="browser-reload"]');

  const syncKernelBrowsers = () => {
    hostKernel.rootBrowsers = hostKernel.rootBrowsers.filter((b) => b.windowId !== win.id);
    for (const t of tabs) {
      hostKernel.rootBrowsers.push({
        windowId: win.id,
        tabId: t.tabId,
        url: t.url,
        title: t.title,
        loadState: t.loadState
      });
    }
  };

  const renderTabsBar = () => {
    tabsListEl.innerHTML = tabs.map((t) => `
      <div class="browser-tab ${t.tabId === activeTabId ? 'active' : ''}"
           data-testid="browser-tab"
           data-system-id="outer"
           data-window-id="${esc(win.id)}"
           data-tab-id="${esc(t.tabId)}">
        <span class="browser-tab-title">${t.loadState === 'loading' ? '⏳ ' : ''}${esc(t.title || t.url)}</span>
        <button class="browser-tab-close"
                data-testid="browser-close-tab"
                data-system-id="outer"
                data-window-id="${esc(win.id)}"
                data-tab-id="${esc(t.tabId)}"
                title="关闭标签">×</button>
      </div>
    `).join('');

    const actTab = tabs.find((t) => t.tabId === activeTabId);
    if (actTab) {
      if (document.activeElement !== addrInp) addrInp.value = actTab.url;
      reloadBtn.textContent = actTab.loadState === 'loading' ? '✕' : '⟳';
    }
    for (const t of tabs) {
      t.webview.classList.toggle('inactive', t.tabId !== activeTabId);
      t.errEl.style.display = (t.tabId === activeTabId && t.loadState === 'error') ? 'flex' : 'none';
    }
    syncKernelBrowsers();
  };

  const switchTab = (tabId) => {
    if (!tabs.some((t) => t.tabId === tabId)) return;
    activeTabId = tabId;
    renderTabsBar();
  };

  const closeTab = (tabId) => {
    const idx = tabs.findIndex((t) => t.tabId === tabId);
    if (idx < 0) return;
    const [removed] = tabs.splice(idx, 1);
    removed.webview.remove();
    removed.errEl.remove();
    if (tabs.length === 0) {
      createTab('https://www.bilibili.com');
      return;
    }
    if (activeTabId === tabId) {
      activeTabId = tabs[Math.max(0, idx - 1)].tabId;
    }
    renderTabsBar();
  };

  const createTab = (initialUrl = 'https://www.bilibili.com') => {
    const tabId = `tab-${tabSeq++}`;
    const url = normalizeUrl(initialUrl);

    const wv = document.createElement('webview');
    wv.className = 'browser-webview';
    wv.setAttribute('partition', 'persist:nested-browser');
    wv.setAttribute('allowpopups', '');
    wv.src = url;

    const errEl = document.createElement('div');
    errEl.className = 'browser-err-banner';
    errEl.style.display = 'none';
    errEl.innerHTML = `
      <div style="font-size:15px;font-weight:700;">页面加载失败</div>
      <div class="err-detail" style="font-size:12px;color:#94a3b8;"></div>
      <button class="os-btn os-btn-accent retry-btn">重新加载</button>
    `;

    const tabRec = {
      tabId,
      url,
      title: '加载中...',
      loadState: 'loading',
      errorDesc: '',
      webview: wv,
      errEl
    };

    errEl.querySelector('.retry-btn').onclick = () => {
      tabRec.loadState = 'loading';
      tabRec.errorDesc = '';
      renderTabsBar();
      wv.reload();
    };

    wv.addEventListener('did-start-loading', () => {
      tabRec.loadState = 'loading';
      renderTabsBar();
    });
    wv.addEventListener('did-stop-loading', () => {
      if (tabRec.loadState !== 'error') tabRec.loadState = 'loaded';
      try {
        const curUrl = wv.getURL();
        if (curUrl) tabRec.url = curUrl;
      } catch {}
      renderTabsBar();
    });
    wv.addEventListener('did-finish-load', () => {
      tabRec.loadState = 'loaded';
      try {
        tabRec.url = wv.getURL() || tabRec.url;
        tabRec.title = wv.getTitle() || tabRec.url;
      } catch {}
      renderTabsBar();
    });
    wv.addEventListener('page-title-updated', (ev) => {
      tabRec.title = ev.title || tabRec.title;
      renderTabsBar();
    });
    wv.addEventListener('did-navigate', (ev) => {
      tabRec.url = ev.url || tabRec.url;
      renderTabsBar();
    });
    wv.addEventListener('did-navigate-in-page', (ev) => {
      if (ev.isMainFrame && ev.url) {
        tabRec.url = ev.url;
        renderTabsBar();
      }
    });
    wv.addEventListener('did-fail-load', (ev) => {
      if (!ev.isMainFrame || ev.errorCode === -3) return;
      tabRec.loadState = 'error';
      tabRec.errorDesc = `${ev.errorDescription || '网络错误'} (${ev.errorCode})`;
      errEl.querySelector('.err-detail').textContent = tabRec.errorDesc;
      renderTabsBar();
    });

    stageEl.append(wv, errEl);
    tabs.push(tabRec);
    activeTabId = tabId;
    renderTabsBar();
    return tabRec;
  };

  const navigateActive = () => {
    const act = tabs.find((t) => t.tabId === activeTabId);
    if (!act) return;
    const url = normalizeUrl(addrInp.value);
    act.url = url;
    act.loadState = 'loading';
    act.errorDesc = '';
    renderTabsBar();
    act.webview.loadURL(url);
  };

  tabsListEl.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-testid="browser-close-tab"]');
    if (closeBtn) {
      e.stopPropagation();
      closeTab(closeBtn.dataset.tabId);
      return;
    }
    const tabEl = e.target.closest('[data-testid="browser-tab"]');
    if (tabEl) switchTab(tabEl.dataset.tabId);
  });

  container.querySelector('[data-testid="browser-new-tab"]').onclick = () => createTab('https://www.bilibili.com');
  container.querySelector('[data-testid="browser-go"]').onclick = navigateActive;
  addrInp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') navigateActive();
  });

  container.querySelector('[data-testid="browser-back"]').onclick = () => {
    const act = tabs.find((t) => t.tabId === activeTabId);
    if (act && act.webview.canGoBack()) act.webview.goBack();
  };
  container.querySelector('[data-testid="browser-forward"]').onclick = () => {
    const act = tabs.find((t) => t.tabId === activeTabId);
    if (act && act.webview.canGoForward()) act.webview.goForward();
  };
  reloadBtn.onclick = () => {
    const act = tabs.find((t) => t.tabId === activeTabId);
    if (!act) return;
    if (act.loadState === 'loading') act.webview.stop();
    else act.webview.reload();
  };

  const unsubPopup = window.hostBridge?.onBrowserNewTab
    ? window.hostBridge.onBrowserNewTab((url) => {
        if (url && container.isConnected) createTab(url);
      })
    : () => {};

  const initialUrl = win.params?.url || 'https://www.bilibili.com';
  createTab(initialUrl);

  return {
    setDragShield: (active) => dragShield.classList.toggle('active', Boolean(active)),
    destroy: () => {
      unsubPopup();
      hostKernel.rootBrowsers = hostKernel.rootBrowsers.filter((b) => b.windowId !== win.id);
    }
  };
}
