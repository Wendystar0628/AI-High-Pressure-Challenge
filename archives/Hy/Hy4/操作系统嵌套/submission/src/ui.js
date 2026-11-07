'use strict';
// 桌面、窗口系统与应用界面。每个系统的桌面是独立 DOM 树，递归嵌套在父系统的系统窗口内。
const U = require('./util');
const { VFS } = require('./vfs');
const R = require('./runtime');

function h(html) { const t = document.createElement('template'); t.innerHTML = String(html).trim(); return t.content.firstElementChild; }
function q(sel, root) { return (root || document).querySelector(sel); }
function qa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function tid(name, root) { return q('[data-testid="' + name + '"]', root); }
function tids(name, root) { return qa('[data-testid="' + name + '"]', root); }
function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); }
function svgIcon(name) {
  const I = {
    files: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#ffc964" stroke="#c98b20" stroke-width="1"/>',
    spreadsheet: '<rect x="3" y="3" width="18" height="18" rx="2" fill="#37b26b"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="#eafff0" stroke-width="1.2"/>',
    widgets: '<rect x="3" y="3" width="8" height="8" rx="2" fill="#7c5cff"/><rect x="13" y="3" width="8" height="8" rx="2" fill="#ffb020"/><rect x="3" y="13" width="8" height="8" rx="2" fill="#28c2a0"/><rect x="13" y="13" width="8" height="8" rx="2" fill="#ff6b8b"/>',
    editor: '<rect x="4" y="2" width="16" height="20" rx="2" fill="#f3f6ff" stroke="#8896b8"/><path d="M7 7h10M7 11h10M7 15h7" stroke="#5a6a90" stroke-width="1.4"/>',
    tasks: '<rect x="3" y="4" width="18" height="16" rx="2" fill="#2f3b57"/><path d="M7 14l3 3 6-8" stroke="#7ee0b0" stroke-width="2" fill="none"/>',
    settings: '<circle cx="12" cy="12" r="4" fill="none" stroke="#cfd8ea" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="#cfd8ea" stroke-width="2"/>',
    browser: '<circle cx="12" cy="12" r="9" fill="#4a9be8"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="#eaf6ff" stroke-width="1.2"/>',
    player: '<rect x="2" y="5" width="20" height="14" rx="2" fill="#2a2140"/><path d="M10 9l6 3-6 3z" fill="#ffc21e"/>',
    charts: '<rect x="3" y="3" width="18" height="18" rx="2" fill="#f2f5ff"/><path d="M6 17v-5M11 17V8M16 17v-8" stroke="#7c5cff" stroke-width="2.4"/>',
    projection: '<rect x="2" y="4" width="20" height="14" rx="2" fill="none" stroke="#7c5cff" stroke-width="2"/><path d="M9 20h6M12 18v2" stroke="#7c5cff" stroke-width="2"/>',
    system: '<rect x="2" y="3" width="20" height="7" rx="1.5" fill="#7c5cff"/><rect x="2" y="14" width="20" height="7" rx="1.5" fill="#28c2a0"/><circle cx="6" cy="6.5" r="1" fill="#fff"/><circle cx="6" cy="17.5" r="1" fill="#fff"/>',
    help: '<circle cx="12" cy="12" r="9" fill="#4a9be8"/><text x="12" y="16" text-anchor="middle" font-size="11" fill="#fff" font-family="Arial">?</text>',
    trash: '<path d="M5 7h14M9 7V4h6v3M6 7l1 14h10l1-14" fill="none" stroke="#cfd8ea" stroke-width="1.8"/>',
    folder: '<path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="#ffc964" stroke="#c98b20"/>',
    scene: '<path d="M3 17l6-9 5 6 3-4 4 7z" fill="#7c5cff"/><circle cx="17" cy="6" r="2.5" fill="#ffc21e"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2" fill="#37b26b"/><path d="M3 9h18M9 3v18" stroke="#eafff0" stroke-width="1.2"/>',
    note: '<rect x="4" y="3" width="16" height="18" rx="2" fill="#ffe082"/><path d="M7 9h10M7 13h10M7 17h7" stroke="#a07b10" stroke-width="1.2"/>',
    generic: '<rect x="4" y="2" width="16" height="20" rx="2" fill="#e6ecf8" stroke="#8fa0c0"/><path d="M7 8h10M7 12h10M7 16h7" stroke="#7a8bae" stroke-width="1.2"/>'
  };
  return '<svg viewBox="0 0 24 24" width="100%" height="100%">' + (I[name] || I.generic) + '</svg>';
}
function fileIcon(node) {
  if (!node) return 'generic';
  if (node.type === 'dir') return node.path && node.path.indexOf('Recycle') >= 0 ? 'trash' : 'folder';
  const f = node.format || '';
  if (f === 'sheet') return 'sheet';
  if (f === 'scene' || f === 'record') return 'scene';
  if (f === 'prog' || f === 'md' || f === 'txt' || f === 'snap') return 'generic';
  return 'generic';
}

class UI {
  constructor(engine, runtime, gfx) {
    this.engine = engine; this.runtime = runtime; this.gfx = gfx;
    this.root = document.getElementById('os-root');
    this.desktops = {}; this.windowEls = {}; this.webviews = {}; this.webviewMirrors = {}; this.dragging = null;
    this.contextMenu = null; this.snapPreview = null;
    this.appRenderers = require('./apps-ui')(this);
    this.bindGlobal();
    this.bindEngine();
    this.buildAll();
    // 网页视图是独立 WebContents；把它周期性地镜像到自制 2D 画布，
    // 这样主桌面截图、窗口裁剪与遮挡都包含网页内容，且不影响 webview 接收输入。
    clearInterval(this._mirrorTimer); clearInterval(this._captureTimer);
    this._captureTimer = setInterval(() => this.captureWebviews(), 170);
    this._mirrorTimer = setInterval(() => this.drawMirrors(), 60);
    engine.markReady();
  }

  bindGlobal() {
    on(document, 'keydown', e => {
      if (e.key === 'Escape') { this.closeContextMenu(); const s = this.engine.root; s.desktop.startOpen = false; s.desktop.notificationsOpen = false; this.updateChrome(); }
      if (e.key === 'F1') { e.preventDefault(); const s = this.engine.root; this.launch(s, 'help'); }
    });
    on(document, 'pointerdown', () => this.closeContextMenu());
    on(window, 'resize', () => { this.updateAllWindowSizes(); });
    const ipc = (() => { try { return require('electron').ipcRenderer; } catch (e) { return null; } })();
    if (ipc) ipc.on('webview-new-window', (ev, d) => this.handleNewWindow(d.url));
    window.__onWebviewNewWindow = url => this.handleNewWindow(url);
  }
  bindEngine() {
    const E = this.engine;
    E.on('window', d => { this.syncStructure(); });
    E.on('windowclose', d => { this.removeWindow(d.winId); this.updateChrome(); });
    E.on('structure', () => this.syncStructure());
    E.on('focus', () => this.updateFocus());
    E.on('step', () => this.updateDynamic());
    E.on('reset', () => this.buildAll());
    E.on('notification', () => this.updateChrome());
  }
  handleNewWindow(url) {
    for (const sys of Object.values(this.engine.systems)) {
      for (const w of sys.windows) {
        const st = sys.appState[w.id];
        if (w.appType === 'browser' && st && st.activeTab) {
          this.engine.appAction(sys, w.id, 'open-in-tab', { url });
          this.updateWindowDynamic(sys, w, this.windowEls[w.id] && this.windowEls[w.id].el);
          return;
        }
      }
    }
  }

  // ---------------- 结构构建 ----------------
  buildAll() {
    this.detachWebviews();
    this.root.innerHTML = '';
    this.desktops = {}; this.windowEls = {};
    this.ensureDesktop(this.engine.root, this.root);
    this.syncStructure();
    this.updateChrome();
  }
  detachWebviews() {
    for (const wid in this.webviews) for (const tid2 in this.webviews[wid]) {
      const el = this.webviews[wid][tid2];
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    for (const wid in this.webviewMirrors) {
      const c = this.webviewMirrors[wid].canvas;
      if (c && c.parentNode) c.parentNode.removeChild(c);
    }
    this.webviewMirrors = {};
  }
  syncStructure() {
    if (this.engine._fullRebuild) {
      this.engine._fullRebuild = false;
      this.buildAll();
      return;
    }
    // 清除已不存在系统/窗口的陈旧 DOM（快照恢复、分叉、停止实例后）
    for (const sid in this.desktops) {
      if (!this.engine.systems[sid]) {
        const el = this.desktops[sid].el; if (el.parentNode) el.parentNode.removeChild(el);
        delete this.desktops[sid];
      }
    }
    for (const wid in this.windowEls) {
      const o = this.windowEls[wid];
      const sys = this.engine.systems[o.sys.id];
      if (!sys || !sys.windows.find(x => x.id === wid)) this.removeWindow(wid);
    }
    const systems = Object.values(this.engine.systems).sort((a, b) => a.depth - b.depth);
    for (const sys of systems) {
      if (!this.desktops[sys.id]) {
        if (sys.id === 'outer') this.ensureDesktop(sys, this.root);
        else {
          const parent = this.engine.systems[sys.parentId];
          const sw = parent && parent.windows.find(w => w.data && w.data.childId === sys.id);
          if (sw) {
            const wel = this.ensureWindow(parent, sw);
            if (wel) this.ensureDesktop(sys, q('.system-desktop-host', wel.content) || wel.content);
          }
        }
      }
    }
    for (const sys of systems) {
      for (const w of sys.windows) this.ensureWindow(sys, w);
      this.renderTaskbar(sys);
      this.renderIcons(sys);
      this.renderStartMenu(sys);
    }
    this.updateFocus();
    this.updateChrome();
    this.updateDynamic();
  }
  ensureDesktop(sys, container) {
    if (this.desktops[sys.id] || !container) return this.desktops[sys.id];
    const d = h('<div class="desktop" data-testid="os-desktop"></div>');
    d.dataset.systemId = sys.id;
    d.style.setProperty('--accent', sys.desktop.accent);
    d.style.setProperty('--depth', sys.depth);
    d.innerHTML = `
      <div class="wallpaper" data-wallpaper="${U.esc(sys.desktop.wallpaper)}"></div>
      <div class="wallpaper-tint"></div>
      <div class="desktop-icons"></div>
      <div class="win-layer"></div>
      <div class="snap-preview"></div>
      <div class="start-menu" data-testid="start-menu"></div>
      <div class="notification-panel"></div>
      <div class="context-menu"></div>
      <div class="taskbar">
        <button class="start-toggle" data-testid="start-toggle" data-system-id="${sys.id}" title="开始"><span class="start-logo">◈</span><span>开始</span></button>
        <div class="taskbar-pinned"></div>
        <div class="taskbar-items"></div>
        <div class="taskbar-tray">
          <button class="tray-btn widgets-toggle" data-testid="widgets-toggle" data-system-id="${sys.id}" title="小组件面板">▦</button>
          <button class="tray-btn" data-testid="quick-settings-toggle" data-system-id="${sys.id}" title="快捷设置">⚙</button>
          <button class="tray-btn" data-testid="notifications-toggle" data-system-id="${sys.id}" title="通知中心">🔔<span class="ntf-badge"></span></button>
          <span class="tray-clock" data-testid="tray-clock"></span>
        </div>
      </div>`;
    container.appendChild(d);
    const rec = { el: d, sys, winLayer: q('.win-layer', d), icons: q('.desktop-icons', d),
      taskbar: q('.taskbar', d), pinned: q('.taskbar-pinned', d), items: q('.taskbar-items', d),
      startMenu: q('.start-menu', d), ntfPanel: q('.notification-panel', d), ctx: q('.context-menu', d),
      snap: q('.snap-preview', d) };
    this.desktops[sys.id] = rec;
    this.applyDesktopScale(sys);
    this.markControls(d, sys, null);
    on(q('.start-toggle', d), 'click', e => { e.stopPropagation(); sys.desktop.startOpen = !sys.desktop.startOpen; this.updateChrome(); });
    on(q('[data-testid="widgets-toggle"]', d), 'click', e => { e.stopPropagation(); this.launch(sys, 'widgets'); });
    on(q('[data-testid="quick-settings-toggle"]', d), 'click', e => { e.stopPropagation(); this.openQuickSettings(sys); });
    on(q('[data-testid="notifications-toggle"]', d), 'click', e => { e.stopPropagation(); sys.desktop.notificationsOpen = !sys.desktop.notificationsOpen; this.updateChrome(); });
    on(d, 'contextmenu', e => {
      if (e.target.closest('.app-window') || e.target.closest('.taskbar') || e.target.closest('.desktop-icon')) return;
      e.preventDefault(); e.stopPropagation(); this.showDesktopContext(sys, e.clientX, e.clientY);
    });
    on(d, 'pointerdown', e => {
      if (e.target === d || e.target.classList.contains('wallpaper') || e.target.classList.contains('wallpaper-tint') || e.target.classList.contains('desktop-icons')) {
        qa('.desktop-icon', d).forEach(x => x.classList.remove('selected'));
      }
    });
    return rec;
  }
  applyDesktopScale(sys) {
    const d = this.desktops[sys.id]; if (!d) return;
    const k = sys.desktop.scale;
    d.el.style.transform = 'scale(' + k + ')';
    d.el.style.width = (100 / k) + '%'; d.el.style.height = (100 / k) + '%';
  }

  // ---------------- 窗口 ----------------
  ensureWindow(sys, w) {
    if (this.windowEls[w.id]) return this.windowEls[w.id];
    const rec = this.desktops[sys.id]; if (!rec) return null;
    const el = h('<div class="app-window" data-testid="app-window"></div>');
    el.dataset.windowId = w.id; el.dataset.appId = w.appType; el.dataset.systemId = sys.id;
    if (w.data && w.data.sourceSystemId) {
      el.dataset.sourceSystemId = w.data.sourceSystemId;
      el.dataset.sourceWindowId = w.data.sourceWindowId;
      el.dataset.sourceAppId = w.data.sourceAppId;
    }
    el.innerHTML = `
      <div class="titlebar" data-testid="window-titlebar" data-system-id="${sys.id}" data-window-id="${w.id}">
        <span class="win-icon">${svgIcon(w.appType === 'system-window' ? 'system' : w.appType === 'projection' ? 'projection' : w.appType)}</span>
        <span class="win-title"></span>
        <span class="win-source"></span>
        <div class="win-controls">
          <button data-testid="window-minimize" data-system-id="${sys.id}" data-window-id="${w.id}" title="最小化">─</button>
          <button data-testid="window-maximize" data-system-id="${sys.id}" data-window-id="${w.id}" title="最大化">□</button>
          <button data-testid="window-close" data-system-id="${sys.id}" data-window-id="${w.id}" title="关闭">✕</button>
        </div>
      </div>
      <div class="win-content"></div>
      <div class="resize-handle" data-testid="window-resize" data-system-id="${sys.id}" data-window-id="${w.id}"></div>`;
    rec.winLayer.appendChild(el);
    const content = q('.win-content', el);
    const obj = { el, content, sys, w, renderedVersion: -1, uiPath: null };
    this.windowEls[w.id] = obj;
    this.markControls(el, sys, w.id);
    q('.win-title', el).textContent = w.title;
    if (w.appType === 'projection') {
      q('.win-source', el).textContent = '来自 ' + w.data.sourceSystemId + ' · ' + w.data.sourceAppId;
    }
    this.bindWindow(sys, w, el, obj);
    this.renderAppContent(sys, w, obj);
    this.applyWindowGeom(sys, w, el);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.updateOneWindowSize(w));
      ro.observe(content);
      obj.resizeObserver = ro;
    }
    return obj;
  }
  removeWindow(winId) {
    const o = this.windowEls[winId]; if (!o) return;
    if (o.resizeObserver) { try { o.resizeObserver.disconnect(); } catch (e) {} }
    if (this.webviews[winId]) {
      for (const t in this.webviews[winId]) { const e = this.webviews[winId][t]; if (e.parentNode) e.parentNode.removeChild(e); }
      delete this.webviews[winId];
    }
    if (this.webviewMirrors[winId]) {
      const c = this.webviewMirrors[winId].canvas; if (c.parentNode) c.parentNode.removeChild(c);
      delete this.webviewMirrors[winId];
    }
    const key = o.sys.id + ':' + winId;
    this.gfx.unregister(key);
    // 投送视图使用源 key，无需注销
    if (o.el.parentNode) o.el.parentNode.removeChild(o.el);
    delete this.windowEls[winId];
  }
  applyWindowGeom(sys, w, el) {
    if (!el) return;
    el.classList.toggle('maximized', w.state === 'maximized');
    el.classList.toggle('snap-left', w.state === 'snap-left');
    el.classList.toggle('snap-right', w.state === 'snap-right');
    el.classList.toggle('minimized', w.state === 'minimized');
    if (w.state === 'normal') { el.style.left = w.x + 'px'; el.style.top = w.y + 'px'; el.style.width = w.w + 'px'; el.style.height = w.h + 'px'; }
    el.style.zIndex = w.z;
  }
  bindWindow(sys, w, el, obj) {
    const tb = q('.titlebar', el);
    on(el, 'pointerdown', () => this.engine.focusWindow(sys, w.id), true);
    on(tb, 'pointerdown', e => {
      if (e.target.closest('.win-controls')) return;
      e.preventDefault(); this.engine.focusWindow(sys, w.id);
      this.startDrag(sys, w, el, e);
    });
    on(tb, 'dblclick', e => { if (e.target.closest('.win-controls')) return; this.toggleMax(sys, w); });
    const rh = q('.resize-handle', el);
    on(rh, 'pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.startResize(sys, w, el, e); });
    on(q('[data-testid="window-minimize"]', el), 'click', e => { e.stopPropagation(); w.state = w.state === 'minimized' ? 'normal' : 'minimized'; this.applyWindowGeom(sys, w, el); this.renderTaskbar(sys); this.updateWebviewVisibility(); });
    on(q('[data-testid="window-maximize"]', el), 'click', e => { e.stopPropagation(); this.toggleMax(sys, w); });
    on(q('[data-testid="window-close"]', el), 'click', e => { e.stopPropagation(); this.closeWindow(sys, w); });
  }
  closeWindow(sys, w) {
    if (w.appType === 'system-window') {
      const child = w.data && w.data.childId;
      this.showConfirm(sys, '关闭系统窗口', '是否停止整个子树 ' + child + '？',
        () => { this.engine.stopSubtree(child); this.engine.closeWindow(sys, w.id); },
        () => this.engine.closeWindow(sys, w.id));
      return;
    }
    if (w.appType === 'projection') {
      const p = this.engine.projectionFor(sys.id, w.id);
      if (p) { this.engine.unproject(p.id); return; }
    }
    this.engine.closeWindow(sys, w.id);
  }
  toggleMax(sys, w) {
    const el = this.windowEls[w.id] && this.windowEls[w.id].el;
    if (w.state === 'maximized' || w.state === 'snap-left' || w.state === 'snap-right') {
      if (w.restore) { w.x = w.restore.x; w.y = w.restore.y; w.w = w.restore.w; w.h = w.restore.h; }
      w.state = 'normal'; w.restore = null;
    } else {
      w.restore = { x: w.x, y: w.y, w: w.w, h: w.h }; w.state = 'maximized';
    }
    this.applyWindowGeom(sys, w, el); this.renderTaskbar(sys);
    this.updateAllWindowSizes();
  }
  startDrag(sys, w, el, e) {
    if (w.state === 'maximized') return;
    const rec = this.desktops[sys.id]; if (!rec) return;
    const k = sys.desktop.scale;
    const rect = rec.el.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, ox = w.x, oy = w.y;
    this.dragging = { kind: 'drag', sys, w, el };
    const move = ev => {
      const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
      const maxX = rect.width / k - 80, maxY = rect.height / k - 40;
      w.x = U.clamp(ox + dx, -w.w + 100, maxX); w.y = U.clamp(oy + dy, 0, maxY);
      el.style.left = w.x + 'px'; el.style.top = w.y + 'px';
      const edge = 26;
      const nearLeft = ev.clientX <= rect.left + edge, nearRight = ev.clientX >= rect.right - edge;
      rec.snap.className = 'snap-preview' + (nearLeft ? ' show-left' : nearRight ? ' show-right' : '');
      this.dragging.snap = nearLeft ? 'snap-left' : nearRight ? 'snap-right' : null;
    };
    const up = () => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
      rec.snap.className = 'snap-preview';
      if (this.dragging && this.dragging.snap) {
        w.restore = { x: ox, y: oy, w: w.w, h: w.h };
        w.state = this.dragging.snap;
        this.applyWindowGeom(sys, w, el);
        this.renderTaskbar(sys); this.updateAllWindowSizes();
      }
      this.dragging = null;
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  }
  startResize(sys, w, el, e) {
    const k = sys.desktop.scale;
    const sx = e.clientX, sy = e.clientY, ow = w.w, oh = w.h;
    const move = ev => {
      w.w = Math.max(320, ow + (ev.clientX - sx) / k); w.h = Math.max(220, oh + (ev.clientY - sy) / k);
      el.style.width = w.w + 'px'; el.style.height = w.h + 'px';
      this.updateOneWindowSize(w);
    };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  }
  updateFocus() {
    for (const sys of Object.values(this.engine.systems)) {
      for (const w of sys.windows) { const o = this.windowEls[w.id]; if (o) o.el.classList.toggle('focused', sys.focusWinId === w.id); }
      const rec = this.desktops[sys.id]; if (rec) qa('.taskbar-item', rec.items).forEach(x => x.classList.toggle('active', x.dataset.windowId === sys.focusWinId));
    }
  }
  updateAllWindowSizes() {
    for (const wid in this.windowEls) { const o = this.windowEls[wid]; this.updateOneWindowSize(o.w); }
  }
  updateOneWindowSize(w) {
    const o = this.windowEls[w.id]; if (!o) return;
    const content = o.content;
    const cw = Math.max(20, content.clientWidth), ch = Math.max(20, content.clientHeight);
    // 三维/图表画布统一适配内容区
    const canvas = q('canvas.view-canvas', content);
    if (canvas) {
      const wrapper = canvas.parentElement;
      const ww = Math.max(20, wrapper.clientWidth), hh = Math.max(20, wrapper.clientHeight);
      canvas.style.width = ww + 'px'; canvas.style.height = hh + 'px';
      const key = o.sys.id + ':' + w.id;
      this.gfx.resizeView(key, ww, hh);
    }
    const mc = q('canvas.webview-mirror', content);
    if (mc) {
      const holder = mc.parentElement;
      const mw = Math.max(2, holder.clientWidth), mh = Math.max(2, holder.clientHeight);
      if (mc.width !== mw || mc.height !== mh) { mc.width = mw; mc.height = mh; }
    }
    this.updateWebviewVisibility();
  }

  // ---------------- 桌面图标 / 任务栏 / 开始菜单 / 通知 ----------------
  iconSet(sys) {
    if (sys.id === 'outer') return [
      { label: '文件管理器', app: 'files' },
      { label: '示例工作簿', file: '/Demo/sample.sheet' },
      { label: '直升机场景源文件', file: '/Demo/helicopter-24.scene' },
      { label: '回收站', app: 'files', cwd: '/Recycle Bin', icon: 'trash' },
      { label: '子系统管理', app: 'system', icon: 'system' },
      { label: '浏览器', app: 'browser' },
      { label: '操作说明', app: 'help', icon: 'help' }
    ];
    return [
      { label: '文件管理器', app: 'files' },
      { label: '三维播放器', app: 'player' },
      { label: '图表工作台', app: 'charts' },
      { label: '直升机场景', file: '/Demo/helicopter-24.scene' },
      { label: '编辑器', app: 'editor' },
      { label: '进程管理器', app: 'tasks' },
      { label: '子系统管理', app: 'system', icon: 'system' },
      { label: '操作说明', app: 'help', icon: 'help' }
    ];
  }
  renderIcons(sys) {
    const rec = this.desktops[sys.id]; if (!rec) return;
    const layer = rec.icons; layer.innerHTML = '';
    this.iconSet(sys).forEach((it, i) => {
      const el = h('<div class="desktop-icon" data-testid="desktop-icon" tabindex="0"></div>');
      el.dataset.systemId = sys.id;
      if (it.app) el.dataset.appId = it.app; else el.dataset.filePath = it.file;
      if (it.cwd) el.dataset.cwd = it.cwd;
      el.innerHTML = '<div class="icon-art">' + svgIcon(it.icon || (it.app || (it.file && it.file.endsWith('.sheet') ? 'sheet' : 'scene'))) + '</div><div class="icon-label"></div>';
      q('.icon-label', el).textContent = it.label;
      layer.appendChild(el);
      on(el, 'click', e => { e.stopPropagation(); qa('.desktop-icon', layer).forEach(x => x.classList.remove('selected')); el.classList.add('selected'); });
      on(el, 'dblclick', e => { e.stopPropagation(); this.openIcon(sys, it); });
      on(el, 'contextmenu', e => { e.preventDefault(); e.stopPropagation(); this.showIconContext(sys, it, e.clientX, e.clientY); });
    });
  }
  openIcon(sys, it) {
    if (it.app) this.launch(sys, it.app, it.cwd ? { data: { cwd: it.cwd } } : {});
    else this.runtime.openFile(sys, it.file);
  }
  launch(sys, appType, opts) {
    opts = opts || {};
    const existing = sys.windows.find(w => w.appType === appType && appType === 'widgets');
    if (existing) { this.engine.focusWindow(sys, existing.id); return; }
    this.engine.openWindow(sys, appType, opts);
  }
  renderTaskbar(sys) {
    const rec = this.desktops[sys.id]; if (!rec) return;
    const pinnedApps = sys.id === 'outer'
      ? ['files', 'spreadsheet', 'widgets', 'browser', 'editor']
      : ['files', 'player', 'charts', 'editor', 'tasks'];
    rec.pinned.innerHTML = '';
    pinnedApps.forEach(a => {
      const b = h('<button class="taskbar-pin" data-system-id="' + sys.id + '" title="' + this.engine.defaultTitle(a) + '">' + svgIcon(a) + '</button>');
      on(b, 'click', () => this.launch(sys, a)); rec.pinned.appendChild(b);
    });
    rec.items.innerHTML = '';
    for (const w of sys.windows) {
      const b = h('<button class="taskbar-item" data-testid="taskbar-item" data-window-id="' + w.id + '" data-system-id="' + sys.id + '"><span class="tb-ico">' + svgIcon(w.appType === 'system-window' ? 'system' : w.appType) + '</span><span class="tb-title"></span></button>');
      q('.tb-title', b).textContent = w.title;
      if (w.state === 'minimized') b.classList.add('minimized');
      on(b, 'click', e => {
        e.stopPropagation();
        if (w.state === 'minimized') { w.state = 'normal'; this.applyWindowGeom(sys, w, this.windowEls[w.id] && this.windowEls[w.id].el); }
        else if (sys.focusWinId === w.id) { w.state = 'minimized'; this.applyWindowGeom(sys, w, this.windowEls[w.id] && this.windowEls[w.id].el); }
        this.engine.focusWindow(sys, w.id); this.renderTaskbar(sys); this.updateWebviewVisibility();
      });
      rec.items.appendChild(b);
    }
  }
  renderStartMenu(sys) {
    const rec = this.desktops[sys.id]; if (!rec) return;
    const root = sys.id === 'outer';
    const entries = root
      ? [['files', '文件管理器'], ['spreadsheet', '电子表格'], ['widgets', '桌面小组件'], ['editor', '文本与程序编辑器'],
         ['browser', '浏览器'], ['tasks', '任务管理器'], ['settings', '设置']]
      : [['files', '文件管理器'], ['player', '三维场景播放器'], ['charts', '图表工作台'], ['editor', '文本与程序编辑器'], ['tasks', '进程管理器'], ['settings', '设置']];
    let html = '<div class="start-head"><b>' + U.esc(sys.name) + '</b><span>第 ' + (sys.depth + 1) + ' 层 · ' + sys.id + '</span></div>';
    html += '<div class="start-search"><input placeholder="查找应用…" data-testid="start-search" data-system-id="' + sys.id + '"/></div>';
    html += '<div class="start-apps">';
    for (const [a, label] of entries) html += '<button class="start-app" data-testid="launch-' + a + '" data-system-id="' + sys.id + '"><span class="sa-ico">' + svgIcon(a) + '</span><span>' + label + '</span></button>';
    html += '</div><div class="start-sep"></div><div class="start-apps">';
    html += '<button class="start-app" data-testid="launch-system" data-system-id="' + sys.id + '"><span class="sa-ico">' + svgIcon('system') + '</span><span>子系统管理</span></button>';
    html += '<button class="start-app" data-testid="launch-help" data-system-id="' + sys.id + '"><span class="sa-ico">' + svgIcon('help') + '</span><span>操作说明</span></button>';
    html += '</div><div class="start-foot"><span>状态：' + sys.state + ' · 速率 ' + sys.rate + 'x</span></div>';
    rec.startMenu.innerHTML = html;
    qa('.start-app', rec.startMenu).forEach(b => {
      on(b, 'click', e => {
        e.stopPropagation();
        const t = b.dataset.testid;
        if (t === 'launch-system') this.launch(sys, 'system');
        else if (t === 'launch-help') this.launch(sys, 'help');
        else this.launch(sys, t.replace('launch-', ''));
        sys.desktop.startOpen = false; this.updateChrome();
      });
    });
    on(q('[data-testid="start-search"]', rec.startMenu), 'input', e => {
      const v = e.target.value.toLowerCase();
      qa('.start-app', rec.startMenu).forEach(b => b.style.display = b.textContent.toLowerCase().includes(v) ? '' : 'none');
    });
  }
  updateChrome() {
    for (const sys of Object.values(this.engine.systems)) {
      const rec = this.desktops[sys.id]; if (!rec) continue;
      rec.startMenu.classList.toggle('open', !!sys.desktop.startOpen);
      rec.ntfPanel.classList.toggle('open', !!sys.desktop.notificationsOpen);
      const badge = q('.ntf-badge', rec.taskbar);
      if (badge) { badge.textContent = sys.desktop.unread > 0 ? String(sys.desktop.unread) : ''; badge.style.display = sys.desktop.unread > 0 ? '' : 'none'; }
      q('.tray-clock', rec.taskbar).textContent = U.fmtClock(new Date());
      this.renderNotifications(sys);
      this.renderStartMenu(sys);
      this.applyDesktopScale(sys);
      q('.wallpaper', rec.el).dataset.wallpaper = sys.desktop.wallpaper;
      rec.el.style.setProperty('--accent', sys.desktop.accent);
    }
    this.updateWebviewVisibility();
  }
  renderNotifications(sys) {
    const rec = this.desktops[sys.id]; if (!rec || !rec.ntfPanel.classList.contains('open')) return;
    // 根系统是通知中心的归宿；任一层的托盘也显示根通知，避免深层桌面打开时看不到倒计时等事件。
    const items = sys.id === 'outer' ? sys.desktop.notifications
      : this.engine.root.desktop.notifications.concat(sys.desktop.notifications).sort((a, b) => b.time - a.time);
    rec.ntfPanel.innerHTML = '<div class="panel-head"><b>通知中心</b><div><button data-testid="ntf-read">全部已读</button><button data-testid="ntf-clear">清除</button><button data-testid="ntf-dnd">' + (sys.desktop.dnd ? '免打扰：开' : '免打扰：关') + '</button></div></div><div class="ntf-list" data-testid="tray-notification-list"></div>';
    this.markControls(rec.ntfPanel, sys, null);
    const list = q('.ntf-list', rec.ntfPanel);
    if (!list) return;
    const shown = items.length ? items : [];
    if (!shown.length) list.innerHTML = '<div class="empty">暂无通知</div>';
    for (const n of shown) {
      const e = h('<div class="ntf-item' + (n.read ? '' : ' unread') + '"><span class="ntf-kind"></span><span class="ntf-text"></span><span class="ntf-time"></span></div>');
      q('.ntf-kind', e).textContent = n.kind; q('.ntf-text', e).textContent = n.text;
      q('.ntf-time', e).textContent = new Date(n.time).toLocaleTimeString('zh-CN', { hour12: false });
      list.appendChild(e);
    }
    const st = this.engine.runtime;
    on(q('[data-testid="ntf-read"]', rec.ntfPanel), 'click', () => st.widgetAction(sys, null, {}, 'ntf-read', {}));
    on(q('[data-testid="ntf-clear"]', rec.ntfPanel), 'click', () => st.widgetAction(sys, null, {}, 'ntf-clear', {}));
    on(q('[data-testid="ntf-dnd"]', rec.ntfPanel), 'click', () => st.widgetAction(sys, null, {}, 'dnd', { value: !sys.desktop.dnd }));
  }
  openQuickSettings(sys) {
    this.launch(sys, 'widgets');
    const w = sys.windows.find(x => x.appType === 'widgets');
    if (w) this.engine.appAction(sys, w.id, 'tab', { value: 'quick' });
  }

  // ---------------- 右键菜单与对话框 ----------------
  closeContextMenu() { qa('.context-menu.open').forEach(x => x.classList.remove('open')); qa('.modal-layer').forEach(x => x.remove()); this.contextMenu = null; }
  showMenu(sys, x, y, items) {
    const rec = this.desktops[sys.id]; if (!rec) return;
    const m = rec.ctx; m.innerHTML = ''; m.classList.add('open');
    const rect = rec.el.getBoundingClientRect();
    const k = sys.desktop.scale || 1;
    m.style.left = ((x - rect.left) / k) + 'px';
    m.style.top = ((y - rect.top) / k) + 'px';
    for (const it of items) {
      const b = h('<button class="ctx-item">' + U.esc(it.label) + '</button>');
      if (it.disabled) b.disabled = true;
      on(b, 'click', e => { e.stopPropagation(); this.closeContextMenu(); if (it.fn) it.fn(); });
      m.appendChild(b);
    }
    this.contextMenu = m;
  }
  showDesktopContext(sys, x, y) {
    this.showMenu(sys, x, y, [
      { label: '新建文本文档', fn: () => { sys.fs.write(VFS.join('/Documents', '新建文档.txt'), '', 'txt'); this.engine.markDirty(); this.syncStructure(); } },
      { label: '新建子系统', fn: () => this.engine.createSystem(sys.id) },
      { label: '打开子系统管理', fn: () => this.launch(sys, 'system') },
      { label: '打开任务管理器', fn: () => this.launch(sys, sys.id === 'outer' ? 'tasks' : 'tasks') },
      { label: '刷新桌面', fn: () => this.syncStructure() }
    ]);
  }
  showIconContext(sys, it, x, y) {
    this.showMenu(sys, x, y, [
      { label: '打开', fn: () => this.openIcon(sys, it) },
      { label: '属性', fn: () => this.engine.notify('属性', it.label, sys.id) }
    ]);
  }
  showConfirm(sys, title, message, yes, no) {
    const layer = h('<div class="modal-layer"><div class="modal"><h3></h3><p></p><div class="modal-btns"><button class="btn-no">取消</button><button class="btn-no2">仅关闭窗口</button><button class="btn-yes primary">确定</button></div></div></div>');
    q('h3', layer).textContent = title; q('p', layer).textContent = message;
    document.body.appendChild(layer);
    on(q('.btn-yes', layer), 'click', () => { layer.remove(); if (yes) yes(); });
    on(q('.btn-no2', layer), 'click', () => { layer.remove(); if (no) no(); });
    on(q('.btn-no', layer), 'click', () => layer.remove());
  }

  // ---------------- 应用内容渲染与动态更新 ----------------
  markControls(root, sys, winId) {
    qa('[data-testid]', root).forEach(el => {
      if (!el.dataset.systemId) el.dataset.systemId = sys.id;
      if (winId && !el.dataset.windowId) el.dataset.windowId = winId;
    });
  }
  renderAppContent(sys, w, obj) {
    obj.content.innerHTML = '';
    const r = this.appRenderers[w.appType] || this.appRenderers.generic;
    obj.renderer = r;
    r.render(this, sys, w, obj);
    this.markControls(obj.content, sys, w.id);
    this.updateOneWindowSize(w);
  }
  updateDynamic() {
    for (const sys of Object.values(this.engine.systems)) {
      const rec = this.desktops[sys.id]; if (rec) {
        const c = q('.tray-clock', rec.taskbar); if (c) c.textContent = U.fmtClock(new Date());
      }
      for (const w of sys.windows) {
        const o = this.windowEls[w.id]; if (o) this.updateWindowDynamic(sys, w, o);
      }
    }
  }
  updateWindowDynamic(sys, w, obj) {
    if (!obj) return;
    const el = obj.el;
    q('.win-title', el).textContent = w.title;
    const r = obj.renderer;
    if (r && r.update) { try { r.update(this, sys, w, obj); } catch (e) { /* 单窗口更新失败不影响全局 */ } }
    // 焦点与按钮状态
    this.applyWindowGeom(sys, w, el);
  }

  // ---------------- 浏览器 webview ----------------
  ensureWebview(sys, w, content) {
    const st = sys.appState[w.id]; if (!st) return;
    if (!this.webviews[w.id]) this.webviews[w.id] = {};
    const map = this.webviews[w.id];
    // 移除多余标签对应的 webview
    for (const tid2 in map) if (!st.tabs.find(t => t.id === tid2)) { const e = map[tid2]; if (e.parentNode) e.parentNode.removeChild(e); delete map[tid2]; }
    let holder = q('.browser-view-holder', content);
    if (!holder) return;
    let mirror = this.webviewMirrors[w.id];
    if (!mirror) {
      const canvas = h('<canvas class="webview-mirror"></canvas>');
      mirror = { canvas, ctx: canvas.getContext('2d'), url: null, image: null, winId: w.id };
      this.webviewMirrors[w.id] = mirror;
    }
    for (const t of st.tabs) {
      let wv = map[t.id];
      if (!wv) {
        wv = document.createElement('webview');
        wv.setAttribute('nodeintegration', 'false');
        wv.setAttribute('webpreferences', 'contextIsolation=yes, sandbox=yes');
        wv.setAttribute('allowpopups', 'true');
        wv.setAttribute('partition', 'persist:nestedos');
        wv.className = 'browser-webview';
        wv.dataset.tabId = t.id;
        map[t.id] = wv;
        on(wv, 'did-start-loading', () => { t.loadState = 'loading'; });
        on(wv, 'did-stop-loading', () => { if (t.loadState === 'loading') { t.loadState = 'loaded'; if (!wv.src || wv.src === 'about:blank') t.title = '新标签页'; } });
        on(wv, 'did-finish-load', () => { t.loadState = 'loaded'; });
        on(wv, 'did-fail-load', ev => { t.loadState = 'failed'; t.title = '页面加载失败'; });
        on(wv, 'page-title-updated', ev => { t.title = ev.title || t.title; });
        on(wv, 'did-navigate', ev => { t.url = ev.url; });
        on(wv, 'new-window', ev => { this.handleNewWindow(ev.url); });
        holder.appendChild(wv);
      }
      if (wv.parentNode !== holder) holder.appendChild(wv);
      const desired = t.url === 'about:blank' ? '' : t.url;
      if (desired && wv.getAttribute('src') !== desired) wv.setAttribute('src', desired);
      if (!desired && wv.getAttribute('src')) wv.removeAttribute('src');
      const active = t.id === st.activeTab && w.state !== 'minimized';
      wv.style.display = active ? 'block' : 'none';
      wv.dataset.windowId = w.id;
      if (active) mirror.wv = wv;
    }
    // 镜像画布位于自制 DOM 表面，始终在网页视图之上（DOM 层），随窗口裁剪/遮挡。
    if (mirror.canvas.parentNode !== holder) holder.appendChild(mirror.canvas);
    this.updateWebviewVisibility();
  }
  captureWebviews() {
    for (const wid in this.webviewMirrors) {
      const m = this.webviewMirrors[wid];
      const o = this.windowEls[wid]; if (!o || o.w.state === 'minimized') continue;
      const wv = m.wv;
      if (!wv || wv.style.display === 'none' || wv.style.visibility === 'hidden') continue;
      if (!wv.capturePage) continue;
      wv.capturePage().then(img => {
        try {
          const url = img.toDataURL();
          if (url === m.url) return;
          m.url = url;
          const im = new Image();
          im.onload = () => { m.image = im; };
          im.src = url;
        } catch (e) { /* 单帧镜像失败不影响网页运行 */ }
      }).catch(() => {});
    }
  }
  drawMirrors() {
    for (const wid in this.webviewMirrors) {
      const m = this.webviewMirrors[wid];
      if (!m.image || !m.canvas.isConnected) continue;
      const c = m.canvas;
      try { m.ctx.drawImage(m.image, 0, 0, c.width, c.height); } catch (e) {}
    }
  }
  updateWebviewVisibility() {
    for (const wid in this.webviews) {
      const o = this.windowEls[wid]; if (!o) continue;
      const { sys, w } = o;
      const top = q('.win-title', o.el) ? o.el.getBoundingClientRect() : null;
      let occluded = w.state === 'minimized';
      if (!occluded && top) {
        const rec = this.desktops[sys.id];
        if (rec) {
          for (const other of sys.windows) {
            if (other.id === wid || other.z <= w.z || other.state === 'minimized') continue;
            const oe = this.windowEls[other.id];
            if (!oe) continue;
            const r2 = oe.el.getBoundingClientRect();
            if (r2.left < top.right && r2.right > top.left && r2.top < top.bottom && r2.bottom > top.top) { occluded = true; break; }
          }
          if (rec.startMenu.classList.contains('open') || rec.ntfPanel.classList.contains('open')) occluded = true;
        }
      }
      for (const tid2 in this.webviews[wid]) {
        const wv = this.webviews[wid][tid2];
        if (occluded || wv.style.display === 'none') wv.style.visibility = 'hidden';
        else wv.style.visibility = 'visible';
      }
    }
  }

  // ---------------- 投送辅助 ----------------
  ancestorChoices(sys) {
    const out = []; let cur = sys.parentId ? this.engine.systems[sys.parentId] : null;
    while (cur) { out.push({ id: cur.id, name: cur.name, depth: cur.depth }); cur = cur.parentId ? this.engine.systems[cur.parentId] : null; }
    return out;
  }
  sourceOfProjection(sys, w) {
    const p = this.engine.projectionFor(sys.id, w.id);
    if (!p) return null;
    return { sys: this.engine.systems[p.sourceSystemId], winId: p.sourceWindowId, appType: p.sourceAppId };
  }
}

module.exports = UI;
