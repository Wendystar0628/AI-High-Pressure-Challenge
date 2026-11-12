/* browser.js — Chromium-based browser with tabs (uses <webview>) */
import { el, uid } from '../../utils.js';

export class BrowserApp {
  constructor(root) {
    this.root = root;
    this.win = null;
    this.tabs = [];
    this.activeTab = null;
  }

  open() {
    if (this.win && !this.win.dead) {
      this.win.restore();
      this.win.focus();
      return this.win;
    }
    this.win = this.root.createWindow({
      appId: 'browser', title: '浏览器', icon: 'browser',
      w: 1080, h: 720,
      onClose: () => {
        for (const t of this.tabs) this._destroyTab(t);
        this.tabs = [];
        this.win = null;
        return true;
      }
    });
    this._render(this.win.body, this.win);
    this._newTab('https://www.bilibili.com');
    return this.win;
  }

  _render(body, win) {
    body.innerHTML = '';
    const app = el('div', {
      class: 'app-root browser-wrap',
      'data-app-id': 'browser', 'data-system-id': this.root.id, 'data-window-id': win.id
    });

    this.tabBar = el('div', { class: 'browser-tabs' });
    this.newTabBtn = el('div', {
      class: 'browser-new-tab-btn', 'data-testid': 'browser-new-tab', title: '新建标签', text: '+'
    });
    this.newTabBtn.addEventListener('click', () => this._newTab('https://www.bilibili.com'));

    this.navbar = el('div', { class: 'browser-navbar' });
    this.backBtn = el('div', { class: 'browser-nav-btn', 'data-testid': 'browser-back', title: '后退', text: '←' });
    this.fwdBtn = el('div', { class: 'browser-nav-btn', 'data-testid': 'browser-forward', title: '前进', text: '→' });
    this.reloadBtn = el('div', { class: 'browser-nav-btn', 'data-testid': 'browser-reload', title: '刷新', text: '⟳' });
    this.stopBtn = el('div', { class: 'browser-nav-btn', title: '停止', text: '✕' });
    this.addressInput = el('input', {
      class: 'browser-address', 'data-testid': 'browser-address', type: 'text',
      placeholder: '输入网址或关键词，例如 https://www.bilibili.com'
    });
    this.goBtn = el('div', { class: 'browser-nav-btn', 'data-testid': 'browser-go', title: '转到', text: '→' });

    this.navbar.appendChild(this.backBtn);
    this.navbar.appendChild(this.fwdBtn);
    this.navbar.appendChild(this.reloadBtn);
    this.navbar.appendChild(this.stopBtn);
    this.navbar.appendChild(this.addressInput);
    this.navbar.appendChild(this.goBtn);

    this.viewport = el('div', { class: 'browser-viewport' });
    this.loadingBar = el('div', { class: 'browser-loading', style: 'transform:scaleX(0)' });

    app.appendChild(this.tabBar);
    app.appendChild(this.navbar);
    app.appendChild(this.viewport);
    body.appendChild(app);
    this.tabBar.appendChild(this.newTabBtn);

    this.backBtn.addEventListener('click', () => {
      const t = this.activeTab;
      if (t && t.webview) { try { t.webview.goBack(); } catch (e) { } }
    });
    this.fwdBtn.addEventListener('click', () => {
      const t = this.activeTab;
      if (t && t.webview) { try { t.webview.goForward(); } catch (e) { } }
    });
    this.reloadBtn.addEventListener('click', () => {
      const t = this.activeTab;
      if (t && t.webview) { try { t.webview.reload(); } catch (e) { } }
    });
    this.stopBtn.addEventListener('click', () => {
      const t = this.activeTab;
      if (t && t.webview) { try { t.webview.stop(); } catch (e) { } }
    });
    const go = () => this._navigate(this.addressInput.value);
    this.goBtn.addEventListener('click', go);
    this.addressInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') go();
    });

    this.appEl = app;
  }

  _newTab(url) {
    const tab = {
      id: uid('tab'),
      url: url || 'about:blank',
      title: '新标签页',
      loadState: 'loading',
      webview: null
    };
    this.tabs.push(tab);

    const wv = document.createElement('webview');
    wv.setAttribute('allowpopups', 'true');
    wv.style.width = '100%';
    wv.style.height = '100%';
    wv.style.background = '#fff';
    tab.webview = wv;

    wv.addEventListener('did-start-loading', () => {
      tab.loadState = 'loading';
      this.loadingBar.style.transform = 'scaleX(0.4)';
      this._renderTabs();
    });
    wv.addEventListener('did-stop-loading', () => {
      tab.loadState = 'done';
      this.loadingBar.style.transform = 'scaleX(1)';
      setTimeout(() => { this.loadingBar.style.transform = 'scaleX(0)'; }, 300);
      this._renderTabs();
    });
    wv.addEventListener('page-title-updated', (e) => {
      tab.title = e.title || '网页';
      this._renderTabs();
    });
    wv.addEventListener('did-navigate', (e) => {
      tab.url = e.url;
      if (this.activeTab === tab) this.addressInput.value = e.url;
      this._renderTabs();
    });
    wv.addEventListener('did-navigate-in-page', (e) => {
      if (e.isMainFrame) {
        tab.url = e.url;
        if (this.activeTab === tab) this.addressInput.value = e.url;
      }
    });
    wv.addEventListener('did-fail-load', (e) => {
      if (e.isMainFrame && e.errorCode !== -3) {
        tab.loadState = 'error';
        this._renderTabs();
        if (this.activeTab === tab) this._showError(e.errorDescription || '页面加载失败');
      }
    });

    this._renderTabs();
    this._activateTab(tab);
    setTimeout(() => {
      try { wv.src = tab.url; } catch (e) { }
    }, 10);
    return tab;
  }

  _destroyTab(tab) {
    if (tab.webview && tab.webview.parentElement) tab.webview.parentElement.removeChild(tab.webview);
    tab.webview = null;
    this.tabs = this.tabs.filter(t => t !== tab);
  }

  _closeTab(tab) {
    const idx = this.tabs.indexOf(tab);
    this._destroyTab(tab);
    if (this.activeTab === tab) {
      const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
      if (next) this._activateTab(next);
      else this._newTab('https://www.bilibili.com');
    }
    this._renderTabs();
  }

  _activateTab(tab) {
    this.activeTab = tab;
    for (const t of this.tabs) {
      if (t.webview) {
        t.webview.style.display = t === tab ? 'flex' : 'none';
      }
    }
    if (tab.webview && !tab.webview.parentElement) this.viewport.appendChild(tab.webview);
    if (tab.url && tab.url !== 'about:blank') this.addressInput.value = tab.url;
    this._renderTabs();
  }

  _renderTabs() {
    if (!this.tabBar) return;
    // remove old tab elements except newTabBtn
    [...this.tabBar.children].forEach(c => {
      if (c !== this.newTabBtn) this.tabBar.removeChild(c);
    });
    for (const t of this.tabs) {
      const tabEl = el('div', {
        class: 'browser-tab' + (t === this.activeTab ? ' active' : ''),
        'data-testid': 'browser-tab',
        'data-tab-id': t.id
      }, [
        el('span', { class: 'tab-title', text: t.title || '新标签页' }),
        el('div', {
          class: 'tab-close', 'data-testid': 'browser-close-tab', text: '✕',
          onclick: (e) => { e.stopPropagation(); this._closeTab(t); }
        })
      ]);
      tabEl.addEventListener('click', () => this._activateTab(t));
      this.tabBar.insertBefore(tabEl, this.newTabBtn);
    }
  }

  _navigate(input) {
    if (!input) return;
    let url = input.trim();
    if (!/^https?:\/\//i.test(url) && !/^about:/i.test(url)) {
      if (/^[\w-]+(\.[\w-]+)+/.test(url) || url.includes('/')) url = 'https://' + url;
      else url = 'https://www.bing.com/search?q=' + encodeURIComponent(url);
    }
    const t = this.activeTab;
    if (!t) return;
    t.url = url;
    t.loadState = 'loading';
    this.loadingBar.style.transform = 'scaleX(0.3)';
    try {
      t.webview.src = url;
    } catch (e) {
      this._showError('无法打开: ' + url);
    }
    this._renderTabs();
  }

  _showError(msg) {
    // show error overlay but keep webview for retry
    const existing = this.viewport.querySelector('.browser-error-page');
    if (existing) existing.remove();
    const page = el('div', { class: 'browser-error-page' }, [
      el('h2', { text: '页面加载失败' }),
      el('p', { text: msg }),
      el('button', {
        class: 'btn primary', text: '重试',
        onclick: () => {
          page.remove();
          if (this.activeTab) {
            try { this.activeTab.webview.src = this.activeTab.url; } catch (e) { }
          }
        }
      })
    ]);
    this.viewport.appendChild(page);
    setTimeout(() => { if (page.parentElement) page.remove(); }, 8000);
  }

  /* expose tab info for bench.inspect */
  getTabInfo() {
    return this.tabs.map(t => ({
      windowId: this.win ? this.win.id : null,
      tabId: t.id,
      url: t.url,
      loadState: t.loadState
    }));
  }
}
