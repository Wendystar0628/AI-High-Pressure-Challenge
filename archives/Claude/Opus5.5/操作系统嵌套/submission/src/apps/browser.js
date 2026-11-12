// 根系统浏览器：自制标签栏、地址栏与导航；网页由 Chromium（<webview>）执行。
// 网页视图与桌面窗口一起移动、缩放、裁剪与遮挡；新窗口在本浏览器里以新标签打开。
// 网页视图不加载预加载脚本，不开放宿主文件系统、Node.js 或系统内部对象。
import { h, clear, icon } from '../ui/dom.js';

const INSTANCES = new Set();
let hooked = false;
let tabSeq = 1;
const HOME = 'https://www.bilibili.com/';

function normalize(input) {
  const s = input.trim();
  if (!s) return HOME;
  if (/^(https?|about):/i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(s) || s.startsWith('localhost')) return 'https://' + s;
  return 'https://cn.bing.com/search?q=' + encodeURIComponent(s);
}

export default {
  id: 'browser', name: '浏览器', icon: 'browser', w: 1100, h: 700, keywords: 'browser web 浏览器 bilibili',
  create(ctx) {
    const { desktop, win, bridge } = ctx;
    if (!hooked) {
      hooked = true;
      bridge.onOpenTab(({ url, from }) => {
        let target = null;
        for (const inst of INSTANCES) if (inst.ownsContents(from)) target = inst;
        if (!target) target = [...INSTANCES].pop();
        if (target) target.newTab(url, true);
        else { const w = desktop.openApp('browser', { url }); void w; }
      });
    }
    const ds = { 'data-system-id': 'outer', 'data-window-id': win.id };
    const tabs = []; let active = null;
    const tabBar = h('div', { class: 'br-tabs' });
    const newTabBtn = h('button', { class: 'br-newtab', html: icon('plus'), tid: 'browser-new-tab', ...ds, 'aria-label': '新建标签' });
    newTabBtn.onclick = () => newTab(HOME, true);
    const addr = h('input', { class: 'inp br-addr', tid: 'browser-address', ...ds, 'aria-label': '地址栏', spellcheck: 'false', placeholder: '输入网址或搜索内容' });
    const nb = (tid, ic, label, fn) => { const b = h('button', { class: 'btn icon', tid, ...ds, 'aria-label': label, title: label, html: icon(ic) }); b.onclick = fn; return b; };
    const back = nb('browser-back', 'back', '后退', () => active && active.wv.canGoBack() && active.wv.goBack());
    const fwd = nb('browser-forward', 'forward', '前进', () => active && active.wv.canGoForward() && active.wv.goForward());
    const reload = nb('browser-reload', 'reload', '刷新', () => { if (!active) return; if (active.loading) active.wv.stop(); else { active.error = null; active.wv.reload(); } });
    const stop = nb('browser-stop', 'stop', '停止加载', () => active && active.wv.stop());
    const go = nb('browser-go', 'forward', '转到', () => navigate(addr.value));
    addr.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') navigate(addr.value); });
    addr.addEventListener('focus', () => addr.select());
    const progress = h('div', { class: 'br-progress' });
    const lock = h('span', { class: 'br-lock', html: icon('lock') });
    const toolbar = h('div', { class: 'toolbar br-bar' }, back, fwd, reload, stop, h('div', { class: 'br-addr-wrap' }, lock, addr), go);
    const views = h('div', { class: 'br-views' });
    const el = h('div', { class: 'browser' }, h('div', { class: 'br-tabrow' }, tabBar, newTabBtn), toolbar, progress, views);

    function reg(t) { desktop.browserTabs.set(t.id, { windowId: win.id, tabId: t.id, url: t.url, title: t.title, loadState: t.error ? 'failed' : t.loading ? 'loading' : 'complete' }); }
    function newTab(url, activate) {
      const t = { id: `tab-${tabSeq++}`, url, title: '新标签页', loading: true, error: null };
      const wv = document.createElement('webview');
      wv.setAttribute('partition', 'persist:nested-browser');
      wv.setAttribute('webpreferences', 'backgroundThrottling=no, contextIsolation=yes, sandbox=yes');
      wv.setAttribute('allowpopups', '');
      wv.className = 'br-wv';
      wv.setAttribute('src', url);
      t.wv = wv;
      const errBox = h('div', { class: 'br-error hidden', tid: 'browser-error', ...ds });
      const holder = h('div', { class: 'br-view hidden' }, wv, errBox);
      t.holder = holder; t.errBox = errBox;
      views.append(holder);
      wv.addEventListener('did-start-loading', () => { t.loading = true; t.error = null; update(t); });
      wv.addEventListener('did-stop-loading', () => { t.loading = false; update(t); });
      wv.addEventListener('did-navigate', (e) => { t.url = e.url; update(t); });
      wv.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) { t.url = e.url; update(t); } });
      wv.addEventListener('page-title-updated', (e) => { t.title = e.title; update(t); });
      wv.addEventListener('did-fail-load', (e) => {
        if (!e.isMainFrame || e.errorCode === -3) return; // -3：被中止（例如停止或重定向）
        t.error = { code: e.errorCode, desc: e.errorDescription, url: e.validatedURL }; t.loading = false; update(t);
      });
      wv.addEventListener('dom-ready', () => { try { t.contentsId = wv.getWebContentsId(); } catch {} });
      wv.addEventListener('render-process-gone', () => { t.error = { code: 'crash', desc: '网页进程已退出', url: t.url }; update(t); });
      tabs.push(t);
      if (activate || !active) select(t);
      renderTabs(); reg(t);
      return t;
    }
    function closeTab(t) {
      const i = tabs.indexOf(t);
      if (i < 0) return;
      tabs.splice(i, 1);
      try { t.wv.stop(); } catch {}
      t.holder.remove();
      desktop.browserTabs.delete(t.id);
      if (active === t) { active = null; if (tabs.length) select(tabs[Math.max(0, i - 1)]); }
      if (!tabs.length) { desktop.destroyWin(win); return; }
      renderTabs();
    }
    function select(t) {
      active = t;
      for (const x of tabs) x.holder.classList.toggle('hidden', x !== t);
      update(t); renderTabs();
    }
    function navigate(input) {
      const url = normalize(input);
      if (!active) newTab(url, true);
      else { active.error = null; active.url = url; active.wv.loadURL(url).catch(() => {}); update(active); }
      active.wv.focus();
    }
    function update(t) {
      reg(t);
      if (t.errBox) {
        if (t.error) {
          clear(t.errBox);
          const retry = h('button', { class: 'btn primary', html: icon('reload'), tid: 'browser-retry', ...ds }, '重试');
          retry.onclick = () => { t.error = null; update(t); t.wv.loadURL(t.error ? t.error.url : t.url).catch(() => {}); };
          t.errBox.append(h('div', { class: 'br-err-ic', html: icon('warning') }), h('b', { text: '无法加载此页面' }), h('p', { text: `${t.error.url || t.url}` }), h('code', { text: `${t.error.desc || ''}（${t.error.code}）` }), h('p', { class: 'muted', text: '请检查网络连接或网址后重试。' }), retry);
          t.errBox.classList.remove('hidden');
        } else t.errBox.classList.add('hidden');
      }
      if (t !== active) { renderTabs(); return; }
      if (document.activeElement !== addr) addr.value = t.url;
      lock.style.opacity = t.url.startsWith('https:') ? '1' : '.3';
      progress.classList.toggle('on', t.loading);
      reload.innerHTML = icon(t.loading ? 'close' : 'reload');
      reload.setAttribute('aria-label', t.loading ? '停止' : '刷新');
      try { back.disabled = !t.wv.canGoBack(); fwd.disabled = !t.wv.canGoForward(); } catch { back.disabled = fwd.disabled = true; }
      desktop.setTitle(win, `${t.title || t.url} — 浏览器`);
      renderTabs();
    }
    function renderTabs() {
      clear(tabBar);
      for (const t of tabs) {
        const close = h('button', { class: 'br-tab-x', html: icon('close'), tid: 'browser-close-tab', ...ds, 'data-tab-id': t.id, 'aria-label': '关闭标签' });
        close.onclick = (e) => { e.stopPropagation(); closeTab(t); };
        const tab = h('div', { class: 'br-tab' + (t === active ? ' on' : ''), tid: 'browser-tab', ...ds, 'data-tab-id': t.id, 'aria-label': t.title, title: t.title + '\n' + t.url, role: 'tab' },
          h('span', { class: 'br-tab-ic' + (t.loading ? ' spin' : ''), html: icon(t.error ? 'warning' : 'browser') }), h('span', { class: 'br-tab-t', text: t.title || t.url }), close);
        tab.onclick = () => select(t);
        tab.addEventListener('auxclick', (e) => { if (e.button === 1) closeTab(t); });
        tabBar.append(tab);
      }
    }
    const inst = {
      ownsContents: (id) => tabs.some((t) => { try { return t.wv.getWebContentsId() === id; } catch { return false; } }),
      newTab,
    };
    INSTANCES.add(inst);
    newTab(ctx.args.url || HOME, true);
    return {
      el,
      tabs, get active() { return active; },
      onArgs(a) { if (a && a.url) newTab(a.url, true); },
      onFocus() {},
      dispose() { INSTANCES.delete(inst); for (const t of [...tabs]) { try { t.wv.stop(); } catch {} t.holder.remove(); desktop.browserTabs.delete(t.id); } },
    };
  },
};
