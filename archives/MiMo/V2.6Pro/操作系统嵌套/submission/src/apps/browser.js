// 根系统 Chromium 浏览器: 标签栏/地址栏/导航/加载状态(webview 承载真实网页)
import { el, escapeHtml, uid } from '../core/util.js';

export function launchBrowser(ctx, arg = {}) {
  const { wm, shell } = ctx;
  const exist = wm.list().find(w => w.appId === 'browser');
  if (exist) {
    if (arg && arg.url && exist.openUrl) exist.openUrl(arg.url);
    wm.focus(exist.id);
    return exist;
  }

  const win = wm.create({
    appId: 'browser',
    title: '浏览器',
    icon: '🌐',
    x: 110, y: 60, w: 960, h: 620,
    minWidth: 520, minHeight: 360,
    meta: { tabs: [] },
    bodyBuilder(body) {
      body.innerHTML = `
        <div class="browser-app">
          <div class="browser-tabs" data-testid="browser-tabs">
            <button class="icon-btn" data-testid="browser-new-tab" title="新建标签">＋</button>
          </div>
          <div class="browser-toolbar">
            <button class="icon-btn" data-testid="browser-back" title="后退">←</button>
            <button class="icon-btn" data-testid="browser-forward" title="前进">→</button>
            <button class="icon-btn" data-testid="browser-reload" title="刷新">⟳</button>
            <input class="browser-address" data-testid="browser-address"
                   placeholder="输入网址,例如 https://www.bilibili.com" />
            <button data-testid="browser-go" class="primary">前往</button>
          </div>
          <div class="browser-view" data-testid="browser-view">
            <div class="browser-empty">
              <div style="font-size:52px;">🌐</div>
              <div style="font-size:16px;font-weight:600;">Nested OS 浏览器</div>
              <div style="font-size:12.5px;">输入网址或点击下方快捷入口开始浏览真实网页</div>
              <div class="row" style="margin-top:6px;">
                <button data-quick="https://www.bilibili.com">bilibili</button>
                <button data-quick="https://www.bing.com">Bing</button>
                <button data-quick="https://en.wikipedia.org">Wikipedia</button>
              </div>
            </div>
          </div>
        </div>`;

      const tabsEl = body.querySelector('.browser-tabs');
      const viewEl = body.querySelector('.browser-view');
      const addrEl = body.querySelector('[data-testid="browser-address"]');
      const tabs = [];
      win.tabs = tabs;
      let activeTab = null;

      function renderTabs() {
        tabsEl.querySelectorAll('.browser-tab').forEach((n) => n.remove());
        for (const t of tabs) {
          const d = el('div', {
            class: 'browser-tab' + (t === activeTab ? ' active' : ''),
            'data-testid': 'browser-tab',
            'data-tab-id': t.id,
          }, [
            el('span', { text: t.loading ? '⏳' : '🌐' }),
            el('span', { class: 'bt-title', text: t.title || '新标签页' }),
            el('span', {
              class: 'bt-close', 'data-testid': 'browser-close-tab', title: '关闭',
              text: '✕',
              onclick: (e) => {
                e.stopPropagation();
                closeTab(t);
              },
            }),
          ]);
          d.addEventListener('click', () => activate(t));
          tabsEl.insertBefore(d, tabsEl.querySelector('[data-testid="browser-new-tab"]'));
        }
      }

      function createTab(url) {
        const t = {
          id: uid('tab'),
          url: url || '',
          title: url ? url.replace(/^https?:\/\//, '').slice(0, 24) : '新标签页',
          loading: false,
          loadState: 'idle',
          webview: null,
          canBack: false,
          canForward: false,
        };
        tabs.push(t);
        activate(t);
        if (url) navigate(t, url);
        return t;
      }

      function activate(t) {
        if (activeTab && activeTab.webview) {
          activeTab.webview.style.display = 'none';
        }
        activeTab = t;
        renderTabs();
        if (!t.webview) {
          // 空标签页
          viewEl.querySelectorAll('.browser-error,.browser-loading').forEach((n) => n.remove());
          let empty = viewEl.querySelector('.browser-empty');
          if (!empty) {
            viewEl.innerHTML = '';
            empty = el('div', { class: 'browser-empty' }, [
              el('div', { style: 'font-size:52px;', text: '🌐' }),
              el('div', { style: 'font-size:16px;font-weight:600;', text: 'Nested OS 浏览器' }),
              el('div', { style: 'font-size:12.5px;', text: '输入网址或点击下方快捷入口开始浏览真实网页' }),
            ]);
            const row = el('div', { class: 'row', style: 'margin-top:6px;' });
            for (const q of ['https://www.bilibili.com', 'https://www.bing.com', 'https://en.wikipedia.org']) {
              row.appendChild(el('button', {
                text: q.replace(/^https?:\/\//, '').split('.')[1] || q,
                onclick: () => navigate(t, q),
              }));
            }
            empty.appendChild(row);
            viewEl.appendChild(empty);
          }
          empty.style.display = 'flex';
          addrEl.value = t.url || '';
        } else {
          const empty = viewEl.querySelector('.browser-empty');
          if (empty) empty.style.display = 'none';
          t.webview.style.display = 'flex';
          addrEl.value = t.url || '';
        }
      }

      function closeTab(t) {
        const i = tabs.indexOf(t);
        if (i < 0) return;
        tabs.splice(i, 1);
        if (t.webview) {
          try { t.webview.remove(); } catch (e) { /* ignore */ }
          t.webview = null;
        }
        if (tabs.length === 0) {
          createTab();
        } else if (activeTab === t) {
          activate(tabs[Math.max(0, i - 1)]);
        } else {
          renderTabs();
        }
      }

      function navigate(t, url) {
        url = String(url || '').trim();
        if (!url) return;
        if (!/^https?:\/\//i.test(url)) {
          if (/^[\w-]+(\.[\w-]+)+/.test(url)) url = 'https://' + url;
          else url = 'https://www.bing.com/search?q=' + encodeURIComponent(url);
        }
        t.url = url;
        t.loading = true;
        t.loadState = 'loading';
        addrEl.value = url;
        renderTabs();
        if (!t.webview) {
          const empty = viewEl.querySelector('.browser-empty');
          if (empty) empty.style.display = 'none';
          viewEl.querySelectorAll('.browser-error').forEach((n) => n.remove());
          const wv = document.createElement('webview');
          wv.setAttribute('src', url);
          wv.setAttribute('allowpopups', 'false');
          wv.style.cssText = 'position:absolute;inset:0;display:flex;width:100%;height:100%;';
          wv.dataset.testid = 'browser-webview';
          wv.addEventListener('did-start-loading', () => {
            t.loading = true;
            t.loadState = 'loading';
            showLoading(t, 0.3);
            renderTabs();
          });
          wv.addEventListener('did-stop-loading', () => {
            t.loading = false;
            t.loadState = 'complete';
            hideLoading();
            renderTabs();
          });
          wv.addEventListener('page-title-updated', (e) => {
            t.title = e.title || t.title;
            renderTabs();
          });
          wv.addEventListener('did-navigate', (e) => {
            t.url = e.url;
            if (activeTab === t) addrEl.value = e.url;
          });
          wv.addEventListener('did-navigate-in-page', (e) => {
            t.url = e.url;
            if (activeTab === t) addrEl.value = e.url;
          });
          wv.addEventListener('did-fail-load', (e) => {
            if (e.errorCode === -3) return; // aborted
            t.loading = false;
            t.loadState = 'error';
            showError(t, e.errorDescription || '页面加载失败');
            renderTabs();
          });
          wv.addEventListener('new-window', (e) => {
            // 站内打开新页面 → 新标签
            e.preventDefault && e.preventDefault();
            if (e.url) createTab(e.url);
          });
          t.webview = wv;
          viewEl.appendChild(wv);
        } else {
          try { t.webview.src = url; } catch (e) { t.webview.loadURL(url); }
        }
      }

      function showLoading(t, p) {
        hideLoading();
        const d = el('div', { class: 'browser-loading' });
        d.style.width = Math.round(p * 100) + '%';
        viewEl.appendChild(d);
      }
      function hideLoading() {
        viewEl.querySelectorAll('.browser-loading').forEach((n) => n.remove());
      }
      function showError(t, msg) {
        viewEl.querySelectorAll('.browser-error').forEach((n) => n.remove());
        const d = el('div', { class: 'browser-error', 'data-testid': 'browser-error' }, [
          el('div', { style: 'font-size:40px;', text: '⚠️' }),
          el('div', { style: 'font-size:15px;font-weight:600;', text: '页面加载失败' }),
          el('div', { class: 'muted', style: 'font-size:12.5px;', text: msg }),
          el('div', { class: 'row', style: 'margin-top:8px;' }, [
            el('button', { class: 'primary', text: '重试', 'data-testid': 'browser-retry', onclick: () => navigate(t, t.url) }),
          ]),
        ]);
        viewEl.appendChild(d);
      }

      body.querySelector('[data-testid="browser-new-tab"]').addEventListener('click', () => createTab());
      body.querySelector('[data-testid="browser-go"]').addEventListener('click', () => {
        if (activeTab) navigate(activeTab, addrEl.value);
      });
      addrEl.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && activeTab) navigate(activeTab, addrEl.value);
      });
      body.querySelector('[data-testid="browser-back"]').addEventListener('click', () => {
        if (activeTab && activeTab.webview) {
          try { if (activeTab.webview.canGoBack()) activeTab.webview.goBack(); } catch (e) { /* ignore */ }
        }
      });
      body.querySelector('[data-testid="browser-forward"]').addEventListener('click', () => {
        if (activeTab && activeTab.webview) {
          try { if (activeTab.webview.canGoForward()) activeTab.webview.goForward(); } catch (e) { /* ignore */ }
        }
      });
      body.querySelector('[data-testid="browser-reload"]').addEventListener('click', () => {
        if (activeTab && activeTab.webview) {
          try { activeTab.webview.reload(); } catch (e) { /* ignore */ }
        }
      });

      win.openUrl = (url) => {
        if (activeTab && !activeTab.url) navigate(activeTab, url);
        else createTab(url);
      };

      createTab();
    },
    onClose: () => {
      // 释放 webview
      const w = ctx.wm.get(win.id);
      if (w) {
        for (const t of (win.tabs || [])) {
          if (t.webview) {
            try { t.webview.remove(); } catch (e) { /* ignore */ }
          }
        }
      }
      return true;
    },
  });
  return win;
}
