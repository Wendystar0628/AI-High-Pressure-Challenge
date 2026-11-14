// Root Desktop Shell & Root Window Manager for Nested OS (outer)
// Owns:
// - Custom SVG desktop icons, start menu, context menu, taskbar, tray, notifications badge
// - Root window lifecycle: move, 8-edge resize, left/right half-screen snap, minimize, maximize, restore, close
// - Browser drag-shield isolation & minimize hiding
// - Child subsystem host windows & cross-layer projection frames
// - Pointer-based Cross-Layer File Drag & Drop across all nesting depths

import { getAppIconSvg } from '../assets/icons.js';
import { getWallpaperUrl } from '../assets/wallpaper.js';
import { mountRootFiles } from './root_files.js';
import { mountRootSpreadsheet } from './root_spreadsheet.js';
import { mountRootEditor } from './root_editor.js';
import { mountRootBrowser } from './root_browser.js';
import { mountRootTasks } from './root_tasks.js';
import { mountRootSettings } from './root_settings.js';
import { mountManualViewer } from './manual_viewer.js';
import { mountWidgetsDrawer } from './root_widgets.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

const DESKTOP_ICONS = [
  { appId: 'files', label: '文件管理器', icon: 'files' },
  { appId: 'spreadsheet', label: '电子表格', icon: 'sheet' },
  { appId: 'browser', label: '网页浏览器', icon: 'browser' },
  { appId: 'editor', label: '文本编辑器', icon: 'editor' },
  { appId: 'tasks', label: '任务管理器', icon: 'tasks' },
  { appId: 'settings', label: '系统设置', icon: 'settings' },
  { appId: 'manual', label: '用户手册', icon: 'manual' },
  { appId: 'new_system', label: '新建子系统', icon: 'subsystem' }
];

const START_APPS = [
  { appId: 'files', label: '文件管理器', testid: 'launch-files', icon: 'files' },
  { appId: 'spreadsheet', label: '电子表格', testid: 'launch-spreadsheet', icon: 'sheet' },
  { appId: 'browser', label: '网页浏览器', testid: 'launch-browser', icon: 'browser' },
  { appId: 'widgets', label: '桌面小组件', testid: 'launch-widgets', icon: 'widgets' },
  { appId: 'editor', label: '文本编辑器', testid: 'launch-editor', icon: 'editor' },
  { appId: 'tasks', label: '任务管理器', testid: 'launch-tasks', icon: 'tasks' },
  { appId: 'settings', label: '系统设置', testid: 'launch-settings', icon: 'settings' },
  { appId: 'manual', label: '中文用户手册', testid: 'launch-manual', icon: 'manual' }
];

export function mountRootDesktop({ mountEl, hostKernel, displayDevice }) {
  let winSeq = 1;
  let zSeq = 100;
  let focusedWinId = null;
  let selectedIconApp = null;
  let startOpen = false;
  let dragState = null;
  let ctxMenu = null;
  let confirmDialog = null;
  const winControllers = new Map(); // winId -> controller
  const winElements = new Map(); // winId -> { el, titleEl, clientEl }

  mountEl.innerHTML = `
    <div class="root-desktop" data-testid="os-desktop" data-system-id="outer" tabindex="-1">
      <div class="root-desktop-icons"></div>
      <div class="root-windows-layer"></div>
      <div class="root-snap-preview" style="display:none;"></div>
      <div class="widgets-panel-drawer"></div>
      <div class="root-start-menu" data-testid="start-menu" data-system-id="outer" style="display:none;"></div>
      <div class="root-ctx-menu" style="display:none;"></div>
      <div class="subsys-modal-backdrop root-modal" style="display:none;z-index:7500;"></div>
      <div class="root-taskbar">
        <button class="tb-start-btn" data-testid="start-toggle" data-system-id="outer" aria-label="开始菜单">
          ${getAppIconSvg('start', 'tb-svg')}<span>开始</span>
        </button>
        <div class="tb-win-strip"></div>
        <div class="tb-tray">
          <button class="tb-tray-btn" data-testid="widgets-toggle" data-system-id="outer" title="小组件与剪贴板">小组件</button>
          <button class="tb-tray-btn" data-testid="notifications-toggle" data-system-id="outer" title="系统通知">
            <span>通知</span>
            <span class="tb-badge notif-count-badge" style="display:none;">0</span>
          </button>
          <div class="tb-clock"></div>
        </div>
      </div>
    </div>
  `;

  const deskEl = mountEl.querySelector('.root-desktop');
  const iconsEl = mountEl.querySelector('.root-desktop-icons');
  const winsLayer = mountEl.querySelector('.root-windows-layer');
  const snapPreview = mountEl.querySelector('.root-snap-preview');
  const widgetsDrawerEl = mountEl.querySelector('.widgets-panel-drawer');
  const startBtn = mountEl.querySelector('[data-testid="start-toggle"]');
  const startMenuEl = mountEl.querySelector('.root-start-menu');
  const tbWinStrip = mountEl.querySelector('.tb-win-strip');
  const ctxEl = mountEl.querySelector('.root-ctx-menu');
  const modalEl = mountEl.querySelector('.root-modal');
  const widgetsToggleBtn = mountEl.querySelector('[data-testid="widgets-toggle"]');
  const notifToggleBtn = mountEl.querySelector('[data-testid="notifications-toggle"]');
  const notifBadgeEl = mountEl.querySelector('.notif-count-badge');
  const clockEl = mountEl.querySelector('.tb-clock');

  const applySettings = () => {
    const s = hostKernel.settings;
    document.documentElement.style.setProperty('--accent', s.accentColor || '#38bdf8');
    document.documentElement.style.setProperty('--accent-strong', s.accentColor || '#0284c7');
    const sc = Number(s.uiScale) || 1;
    document.documentElement.style.zoom = String(sc);
    deskEl.style.backgroundImage = `url("${getWallpaperUrl(s.wallpaper || 'alpine-horizon')}")`;
    if (startOpen) renderStartMenu();
  };

  const widgetsCtrl = mountWidgetsDrawer({
    drawerEl: widgetsDrawerEl,
    hostKernel,
    onSettingsChange: applySettings
  });

  const renderIcons = () => {
    iconsEl.innerHTML = DESKTOP_ICONS.map((ic) => `
      <div class="root-icon ${selectedIconApp === ic.appId ? 'selected' : ''}"
           data-testid="desktop-icon"
           data-system-id="outer"
           data-app-id="${ic.appId}">
        ${getAppIconSvg(ic.icon, 'os-svg-icon')}
        <div class="root-icon-label">${esc(ic.label)}</div>
      </div>
    `).join('');
  };

  const renderStartMenu = () => {
    startMenuEl.style.display = startOpen ? 'flex' : 'none';
    startBtn.classList.toggle('active', startOpen);
    if (!startOpen) return;
    startMenuEl.innerHTML = `
      <div class="start-header">
        <div>
          <div class="start-sys-title">${esc(hostKernel.settings.systemName || '叠境操作系统')}</div>
          <div class="start-sys-sub">根系统 outer · 多层可编程桌面环境</div>
        </div>
        <button class="os-btn os-btn-xs act-start-new-sys" data-testid="start-new-system" data-system-id="outer">新建子系统</button>
      </div>
      <div class="start-grid">
        ${START_APPS.map((a) => `
          <button class="start-app-btn" data-testid="${a.testid}" data-system-id="outer" data-app-id="${a.appId}">
            ${getAppIconSvg(a.icon, 'start-svg')}<span>${esc(a.label)}</span>
          </button>
        `).join('')}
      </div>
    `;
  };

  const renderTaskbarWindows = () => {
    const wins = Array.from(hostKernel.rootWindows.values());
    tbWinStrip.innerHTML = wins.map((w) => `
      <button class="tb-win-item ${w.id === focusedWinId && !w.minimized ? 'focused' : ''} ${w.minimized ? 'minimized' : ''}"
              data-testid="taskbar-item"
              data-system-id="outer"
              data-window-id="${esc(w.id)}">
        ${getAppIconSvg(w.appId === 'projection' ? (w.sourceAppId || 'player') : (w.appId === 'spreadsheet' ? 'sheet' : w.appId), 'win-svg')}
        <span>${esc(w.title)}</span>
      </button>
    `).join('');

    const unread = hostKernel.notifications.filter((n) => !n.read).length;
    notifBadgeEl.style.display = unread > 0 ? 'inline-block' : 'none';
    notifBadgeEl.textContent = String(unread);
  };

  const getDesktopBounds = () => {
    const sc = Number(hostKernel.settings.uiScale) || 1;
    const vw = Math.round(window.innerWidth / sc);
    const vh = Math.round((window.innerHeight - 46 * sc) / sc);
    return { w: Math.max(400, vw), h: Math.max(300, vh) };
  };

  const syncWindowElement = (win) => {
    const rec = winElements.get(win.id);
    if (!rec) return;
    const { el, titleEl } = rec;
    el.style.left = `${win.x}px`;
    el.style.top = `${win.y}px`;
    el.style.width = `${win.w}px`;
    el.style.height = `${win.h}px`;
    el.style.zIndex = String(win.zIndex);
    el.style.display = win.minimized ? 'none' : 'flex';
    el.classList.toggle('focused', win.id === focusedWinId);
    el.classList.toggle('maximized', Boolean(win.maximized));
    titleEl.textContent = win.title;
  };

  const focusWindow = (winId) => {
    const w = hostKernel.rootWindows.get(winId);
    if (!w) return;
    w.minimized = false;
    w.zIndex = ++zSeq;
    focusedWinId = winId;
    for (const rw of hostKernel.rootWindows.values()) syncWindowElement(rw);
    renderTaskbarWindows();
  };

  const toggleMinimizeWindow = (winId) => {
    const w = hostKernel.rootWindows.get(winId);
    if (!w) return;
    w.minimized = !w.minimized;
    if (w.minimized && focusedWinId === winId) {
      let top = null;
      for (const rw of hostKernel.rootWindows.values()) {
        if (!rw.minimized && (!top || rw.zIndex > top.zIndex)) top = rw;
      }
      focusedWinId = top ? top.id : null;
    } else if (!w.minimized) {
      focusWindow(winId);
      return;
    }
    for (const rw of hostKernel.rootWindows.values()) syncWindowElement(rw);
    renderTaskbarWindows();
  };

  const toggleMaximizeWindow = (winId) => {
    const w = hostKernel.rootWindows.get(winId);
    if (!w) return;
    const bounds = getDesktopBounds();
    if (w.maximized) {
      if (w.restoreRect) Object.assign(w, w.restoreRect);
      w.maximized = false;
      w.snapped = null;
    } else {
      w.restoreRect = { x: w.x, y: w.y, w: w.w, h: w.h };
      w.x = 0;
      w.y = 0;
      w.w = bounds.w;
      w.h = bounds.h;
      w.maximized = true;
      w.snapped = null;
    }
    syncWindowElement(w);
  };

  const snapWindow = (winId, side) => {
    const w = hostKernel.rootWindows.get(winId);
    if (!w) return;
    const bounds = getDesktopBounds();
    w.restoreRect = w.restoreRect || { x: w.x, y: w.y, w: w.w, h: w.h };
    w.maximized = false;
    w.snapped = side;
    w.y = 0;
    w.h = bounds.h;
    w.w = Math.floor(bounds.w / 2);
    w.x = side === 'left' ? 0 : Math.floor(bounds.w / 2);
    syncWindowElement(w);
  };

  const showConfirmModal = (message, onDiscard, onSaveAndProceed = null, discardLabel = '确定') => {
    confirmDialog = { message };
    modalEl.style.display = 'flex';
    modalEl.innerHTML = `
      <div class="subsys-modal-card">
        <div class="subsys-modal-msg">${esc(message)}</div>
        <div class="subsys-modal-actions">
          ${onSaveAndProceed ? '<button class="os-btn os-btn-accent act-modal-save">保存并关闭</button>' : ''}
          <button class="os-btn os-btn-danger act-modal-yes">${esc(discardLabel)}</button>
          <button class="os-btn act-modal-no">取消</button>
        </div>
      </div>
    `;
    const closeModal = () => {
      modalEl.style.display = 'none';
      confirmDialog = null;
    };
    const saveBtn = modalEl.querySelector('.act-modal-save');
    if (saveBtn) {
      saveBtn.onclick = () => {
        closeModal();
        onSaveAndProceed();
      };
    }
    modalEl.querySelector('.act-modal-yes').onclick = () => {
      closeModal();
      onDiscard();
    };
    modalEl.querySelector('.act-modal-no').onclick = closeModal;
  };

  const forceCloseWindow = (winId) => {
    const w = hostKernel.rootWindows.get(winId);
    if (!w) return;
    const ctrl = winControllers.get(winId);
    ctrl?.destroy?.();
    winControllers.delete(winId);

    const rec = winElements.get(winId);
    rec?.el?.remove();
    winElements.delete(winId);
    hostKernel.rootWindows.delete(winId);

    if (w.appId === 'subsystem' && w.childSystemId) {
      displayDevice.unmountSubsystem(w.childSystemId);
      hostKernel.stopSubtree(w.childSystemId, true);
    } else if (w.appId === 'projection' && w.projWinId) {
      displayDevice.unmountProjection(w.projWinId);
      hostKernel.closeProjection(w.projWinId, '投送窗口已关闭');
    }

    if (focusedWinId === winId) {
      let top = null;
      for (const rw of hostKernel.rootWindows.values()) {
        if (!rw.minimized && (!top || rw.zIndex > top.zIndex)) top = rw;
      }
      focusedWinId = top ? top.id : null;
      for (const rw of hostKernel.rootWindows.values()) syncWindowElement(rw);
    }
    renderTaskbarWindows();
  };

  const closeWindow = (winId, skipConfirm = false) => {
    const w = hostKernel.rootWindows.get(winId);
    if (!w) return;
    const ctrl = winControllers.get(winId);
    if (!skipConfirm && ctrl?.isDirty?.()) {
      const saveFn = ctrl.save ? () => { if (ctrl.save() !== false) forceCloseWindow(winId); } : null;
      showConfirmModal(
        ctrl.confirmMessage || '存在未保存修改，确定关闭？',
        () => forceCloseWindow(winId),
        saveFn,
        ctrl.save ? '放弃修改' : '确定'
      );
      return;
    }
    if (!skipConfirm && w.appId === 'subsystem' && w.childSystemId) {
      showConfirmModal(`确认停止并关闭子系统 ${w.childSystemId}（将停止其整棵子树的运行并释放相关投送）？`, () => forceCloseWindow(winId));
      return;
    }
    forceCloseWindow(winId);
  };

  const createRootWindowElement = (win) => {
    const el = document.createElement('div');
    el.className = 'root-window';
    el.setAttribute('data-testid', 'app-window');
    el.setAttribute('data-system-id', 'outer');
    el.setAttribute('data-window-id', win.id);
    el.setAttribute('data-app-id', win.appId);
    if (win.appId === 'projection') {
      el.setAttribute('data-source-system-id', win.sourceSystemId);
      el.setAttribute('data-source-window-id', win.sourceWindowId);
      el.setAttribute('data-source-app-id', win.sourceAppId);
    }

    const iconKey = win.appId === 'projection' ? (win.sourceAppId || 'player')
      : (win.appId === 'spreadsheet' ? 'sheet' : win.appId);

    el.innerHTML = `
      <div class="win-titlebar" data-testid="window-titlebar" data-system-id="outer" data-window-id="${esc(win.id)}">
        <div class="win-title-group">
          ${getAppIconSvg(iconKey, 'win-svg')}
          <span class="win-title-label">${esc(win.title)}</span>
        </div>
        <div class="win-controls">
          <button class="win-ctrl-btn" title="最小化" data-testid="window-minimize" data-system-id="outer" data-window-id="${esc(win.id)}">─</button>
          <button class="win-ctrl-btn" title="最大化" data-testid="window-maximize" data-system-id="outer" data-window-id="${esc(win.id)}">□</button>
          <button class="win-ctrl-btn close" title="关闭" data-testid="window-close" data-system-id="outer" data-window-id="${esc(win.id)}">×</button>
        </div>
      </div>
      <div class="win-client"></div>
      <div class="resize-edge n" data-edge="n"></div>
      <div class="resize-edge s" data-edge="s"></div>
      <div class="resize-edge w" data-edge="w"></div>
      <div class="resize-edge e" data-edge="e"></div>
      <div class="resize-edge nw" data-edge="nw"></div>
      <div class="resize-edge ne" data-edge="ne"></div>
      <div class="resize-edge sw" data-edge="sw"></div>
      <div class="resize-edge se" data-edge="se" data-testid="window-resize" data-system-id="outer" data-window-id="${esc(win.id)}"></div>
    `;

    const titleEl = el.querySelector('.win-title-label');
    const clientEl = el.querySelector('.win-client');
    const tbEl = el.querySelector('.win-titlebar');

    el.addEventListener('pointerdown', () => focusWindow(win.id));

    el.querySelector('[data-testid="window-minimize"]').onclick = (e) => { e.stopPropagation(); toggleMinimizeWindow(win.id); };
    el.querySelector('[data-testid="window-maximize"]').onclick = (e) => { e.stopPropagation(); toggleMaximizeWindow(win.id); };
    el.querySelector('[data-testid="window-close"]').onclick = (e) => { e.stopPropagation(); closeWindow(win.id); };

    tbEl.addEventListener('dblclick', (e) => {
      if (!e.target.closest('button')) toggleMaximizeWindow(win.id);
    });

    tbEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      focusWindow(win.id);
      const sc = Number(hostKernel.settings.uiScale) || 1;
      dragState = {
        mode: 'move',
        winId: win.id,
        startX: e.clientX / sc,
        startY: e.clientY / sc,
        origX: win.x,
        origY: win.y,
        origW: win.w,
        origH: win.h
      };
      setBrowserDragShields(true);
    });

    for (const edgeEl of el.querySelectorAll('.resize-edge')) {
      edgeEl.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || win.maximized) return;
        e.stopPropagation();
        focusWindow(win.id);
        const sc = Number(hostKernel.settings.uiScale) || 1;
        dragState = {
          mode: 'resize',
          edge: edgeEl.dataset.edge,
          winId: win.id,
          startX: e.clientX / sc,
          startY: e.clientY / sc,
          origX: win.x,
          origY: win.y,
          origW: win.w,
          origH: win.h
        };
        setBrowserDragShields(true);
      });
    }

    winsLayer.appendChild(el);
    winElements.set(win.id, { el, titleEl, clientEl });
    syncWindowElement(win);
    return clientEl;
  };

  const setBrowserDragShields = (active) => {
    for (const ctrl of winControllers.values()) {
      ctrl?.setDragShield?.(active);
    }
  };

  const launchApp = (appId, params = {}) => {
    startOpen = false;
    ctxMenu = null;
    renderStartMenu();
    renderCtxMenu();

    if (appId === 'widgets') {
      widgetsDrawerEl.classList.toggle('open');
      widgetsCtrl.refresh();
      return null;
    }

    if (appId === 'new_system') {
      const r = hostKernel.createRootChildSubsystem();
      if (r.ok) return openSubsystemWindow(r.id);
      hostKernel.pushNotification('创建子系统失败', r.error || '配额不足', 'system');
      return null;
    }

    // Reuse Editor if opening an explicit path inside existing root Editor
    if (appId === 'editor' && params?.filePath) {
      for (const rw of hostKernel.rootWindows.values()) {
        if (rw.appId === 'editor') {
          winControllers.get(rw.id)?.openPath?.(params.filePath);
          focusWindow(rw.id);
          return rw;
        }
      }
    }

    const bounds = getDesktopBounds();
    const titles = {
      files: '文件管理器',
      spreadsheet: '电子表格',
      browser: 'Chromium 网页浏览器',
      editor: '文本与程序编辑器',
      tasks: '任务与系统管理器',
      settings: '系统设置',
      manual: '叠境操作系统 · 中文使用手册'
    };

    const defs = {
      files: [760, 500],
      spreadsheet: [860, 560],
      browser: [940, 620],
      editor: [760, 540],
      tasks: [840, 560],
      settings: [660, 520],
      manual: [780, 560]
    };
    const [dw, dh] = defs[appId] || [720, 480];
    const w = Math.min(dw, bounds.w - 30);
    const h = Math.min(dh, bounds.h - 24);
    const off = ((winSeq - 1) % 6) * 28;
    const winId = `outer-win-${winSeq++}`;
    const win = {
      id: winId,
      appId,
      title: titles[appId] || appId,
      x: clamp(96 + off, 12, Math.max(12, bounds.w - w - 12)),
      y: clamp(32 + off, 8, Math.max(8, bounds.h - h - 8)),
      w,
      h,
      zIndex: ++zSeq,
      minimized: false,
      maximized: false,
      snapped: null,
      params
    };

    hostKernel.rootWindows.set(winId, win);
    focusedWinId = winId;
    const clientEl = createRootWindowElement(win);

    const actions = { launchApp, openSubsystemWindow, closeWindow };
    let ctrl = null;
    if (appId === 'files') ctrl = mountRootFiles({ container: clientEl, win, hostKernel, appActions: actions });
    else if (appId === 'spreadsheet') ctrl = mountRootSpreadsheet({ container: clientEl, win, hostKernel });
    else if (appId === 'editor') ctrl = mountRootEditor({ container: clientEl, win, hostKernel });
    else if (appId === 'browser') ctrl = mountRootBrowser({ container: clientEl, win, hostKernel });
    else if (appId === 'tasks') ctrl = mountRootTasks({ container: clientEl, win, hostKernel, appActions: actions });
    else if (appId === 'settings') ctrl = mountRootSettings({ container: clientEl, win, hostKernel, onSettingsChange: applySettings });
    else if (appId === 'manual') ctrl = mountManualViewer({ container: clientEl });

    if (ctrl) winControllers.set(winId, ctrl);
    for (const rw of hostKernel.rootWindows.values()) syncWindowElement(rw);
    renderTaskbarWindows();
    return win;
  };

  const openSubsystemWindow = (sysId) => {
    for (const rw of hostKernel.rootWindows.values()) {
      if (rw.appId === 'subsystem' && rw.childSystemId === sysId) {
        focusWindow(rw.id);
        return rw;
      }
    }
    const slot = hostKernel.subsystems.get(sysId);
    if (!slot) return null;
    const bounds = getDesktopBounds();
    const w = Math.min(1040, bounds.w - 60);
    const h = Math.min(680, bounds.h - 40);
    const winId = `outer-win-${winSeq++}`;
    const win = {
      id: winId,
      appId: 'subsystem',
      childSystemId: sysId,
      title: `${slot.name} (${sysId})`,
      x: clamp(110 + ((winSeq % 4) * 26), 16, Math.max(16, bounds.w - w - 16)),
      y: clamp(28 + ((winSeq % 4) * 20), 10, Math.max(10, bounds.h - h - 10)),
      w,
      h,
      zIndex: ++zSeq,
      minimized: false,
      maximized: false,
      snapped: null
    };
    hostKernel.rootWindows.set(winId, win);
    focusedWinId = winId;
    const clientEl = createRootWindowElement(win);
    displayDevice.mountSubsystem(sysId, clientEl);
    for (const rw of hostKernel.rootWindows.values()) syncWindowElement(rw);
    renderTaskbarWindows();
    return win;
  };

  const openProjectionWindow = (proj) => {
    for (const rw of hostKernel.rootWindows.values()) {
      if (rw.appId === 'projection' && rw.projWinId === proj.projWinId) {
        focusWindow(rw.id);
        return rw;
      }
    }
    const bounds = getDesktopBounds();
    const w = Math.min(920, bounds.w - 60);
    const h = Math.min(610, bounds.h - 40);
    const winId = proj.projWinId;
    const win = {
      id: winId,
      appId: 'projection',
      projWinId: proj.projWinId,
      sourceSystemId: proj.sourceSystemId,
      sourceWindowId: proj.sourceWindowId,
      sourceAppId: proj.sourceAppId,
      title: proj.title,
      x: clamp(140, 16, Math.max(16, bounds.w - w - 16)),
      y: clamp(46, 10, Math.max(10, bounds.h - h - 10)),
      w,
      h,
      zIndex: ++zSeq,
      minimized: false,
      maximized: false,
      snapped: null
    };
    hostKernel.rootWindows.set(winId, win);
    focusedWinId = winId;
    const clientEl = createRootWindowElement(win);
    displayDevice.mountProjection(proj.projWinId, clientEl);
    for (const rw of hostKernel.rootWindows.values()) syncWindowElement(rw);
    renderTaskbarWindows();
    return win;
  };

  const renderCtxMenu = () => {
    if (!ctxMenu) { ctxEl.style.display = 'none'; return; }
    ctxEl.style.display = 'flex';
    ctxEl.style.left = `${ctxMenu.x}px`;
    ctxEl.style.top = `${ctxMenu.y}px`;
    ctxEl.innerHTML = `
      <button class="ctx-btn" data-act="new_system">新建子系统实例</button>
      <button class="ctx-btn" data-act="files">打开文件管理器</button>
      <button class="ctx-btn" data-act="spreadsheet">打开电子表格</button>
      <button class="ctx-btn" data-act="browser">打开网页浏览器</button>
      <button class="ctx-btn" data-act="tasks">打开任务管理器</button>
      <button class="ctx-btn" data-act="settings">系统个性化设置</button>
    `;
  };

  // ==================== Root Desktop Event Wiring ====================
  startBtn.onclick = (e) => {
    e.stopPropagation();
    startOpen = !startOpen;
    ctxMenu = null;
    renderStartMenu();
    renderCtxMenu();
  };

  startMenuEl.addEventListener('click', (e) => {
    const appBtn = e.target.closest('[data-app-id]');
    if (appBtn) {
      launchApp(appBtn.dataset.appId);
      return;
    }
    if (e.target.closest('.act-start-new-sys')) {
      launchApp('new_system');
    }
  });

  iconsEl.addEventListener('click', (e) => {
    const ic = e.target.closest('[data-testid="desktop-icon"]');
    if (!ic) return;
    selectedIconApp = ic.dataset.appId;
    startOpen = false;
    ctxMenu = null;
    renderStartMenu();
    renderCtxMenu();
    renderIcons();
  });

  iconsEl.addEventListener('dblclick', (e) => {
    const ic = e.target.closest('[data-testid="desktop-icon"]');
    if (ic) launchApp(ic.dataset.appId);
  });

  deskEl.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.root-window, .root-taskbar, .root-start-menu, .widgets-panel-drawer')) return;
    e.preventDefault();
    const sc = Number(hostKernel.settings.uiScale) || 1;
    const bounds = getDesktopBounds();
    ctxMenu = {
      x: clamp(e.clientX / sc, 8, bounds.w - 196),
      y: clamp(e.clientY / sc, 8, bounds.h - 210)
    };
    startOpen = false;
    renderStartMenu();
    renderCtxMenu();
  });

  ctxEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.ctx-btn');
    if (btn) launchApp(btn.dataset.act);
  });

  deskEl.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.root-start-menu, [data-testid="start-toggle"]')) {
      if (startOpen) { startOpen = false; renderStartMenu(); }
    }
    if (!e.target.closest('.root-ctx-menu')) {
      if (ctxMenu) { ctxMenu = null; renderCtxMenu(); }
    }
    if (e.target === deskEl || e.target === iconsEl) {
      selectedIconApp = null;
      renderIcons();
    }
  });

  tbWinStrip.addEventListener('click', (e) => {
    const item = e.target.closest('[data-testid="taskbar-item"]');
    if (!item) return;
    const wid = item.dataset.windowId;
    const w = hostKernel.rootWindows.get(wid);
    if (!w) return;
    if (w.minimized) focusWindow(wid);
    else if (focusedWinId === wid) toggleMinimizeWindow(wid);
    else focusWindow(wid);
  });

  widgetsToggleBtn.onclick = () => {
    widgetsDrawerEl.classList.toggle('open');
    widgetsCtrl.refresh();
  };

  notifToggleBtn.onclick = () => {
    widgetsDrawerEl.classList.add('open');
    for (const n of hostKernel.notifications) n.read = true;
    renderTaskbarWindows();
    widgetsCtrl.refresh();
    widgetsDrawerEl.querySelector('[data-testid="widget-notifications"]')?.scrollIntoView({ block: 'nearest' });
  };

  // Drag & Resize handling
  window.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const w = hostKernel.rootWindows.get(dragState.winId);
    if (!w) { dragState = null; return; }
    const sc = Number(hostKernel.settings.uiScale) || 1;
    const bounds = getDesktopBounds();
    const cx = e.clientX / sc;
    const cy = e.clientY / sc;
    const dx = cx - dragState.startX;
    const dy = cy - dragState.startY;

    if (dragState.mode === 'move') {
      if (w.maximized || w.snapped) {
        if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
          const rr = w.restoreRect || { w: Math.round(bounds.w * 0.65), h: Math.round(bounds.h * 0.72) };
          w.maximized = false;
          w.snapped = null;
          w.w = rr.w;
          w.h = rr.h;
          dragState.origX = clamp(cx - w.w / 2, 0, bounds.w - w.w);
          dragState.origY = Math.max(0, cy - 16);
          dragState.startX = cx;
          dragState.startY = cy;
        }
      }
      w.x = clamp(dragState.origX + (cx - dragState.startX), -Math.floor(w.w * 0.5), bounds.w - 80);
      w.y = clamp(dragState.origY + (cy - dragState.startY), 0, bounds.h - 36);
      syncWindowElement(w);

      if (cx <= 14) {
        snapPreview.style.display = 'block';
        snapPreview.style.left = '6px';
        snapPreview.style.width = `${Math.floor(bounds.w / 2) - 10}px`;
      } else if (cx >= bounds.w - 14) {
        snapPreview.style.display = 'block';
        snapPreview.style.left = `${Math.floor(bounds.w / 2) + 4}px`;
        snapPreview.style.width = `${Math.floor(bounds.w / 2) - 10}px`;
      } else {
        snapPreview.style.display = 'none';
      }
    } else if (dragState.mode === 'resize') {
      const ed = dragState.edge;
      if (ed.includes('e')) w.w = clamp(dragState.origW + dx, 320, bounds.w - w.x);
      if (ed.includes('s')) w.h = clamp(dragState.origH + dy, 220, bounds.h - w.y);
      if (ed.includes('w')) {
        const nw = clamp(dragState.origW - dx, 320, dragState.origX + dragState.origW);
        w.x = dragState.origX + (dragState.origW - nw);
        w.w = nw;
      }
      if (ed.includes('n')) {
        const nh = clamp(dragState.origH - dy, 220, dragState.origY + dragState.origH);
        w.y = Math.max(0, dragState.origY + (dragState.origH - nh));
        w.h = nh;
      }
      syncWindowElement(w);
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (!dragState) return;
    const sc = Number(hostKernel.settings.uiScale) || 1;
    const bounds = getDesktopBounds();
    const cx = e.clientX / sc;
    if (dragState.mode === 'move') {
      if (cx <= 14) snapWindow(dragState.winId, 'left');
      else if (cx >= bounds.w - 14) snapWindow(dragState.winId, 'right');
    }
    snapPreview.style.display = 'none';
    dragState = null;
    setBrowserDragShields(false);
  });

  // ==================== Cross-Layer Custom File Drag & Drop ====================
  let crossDnd = null;
  let ghostEl = null;
  let highlightedDropEl = null;

  const clearDndHighlight = () => {
    if (highlightedDropEl) {
      highlightedDropEl.classList.remove('drop-hover');
      highlightedDropEl = null;
    }
    if (ghostEl) {
      ghostEl.remove();
      ghostEl = null;
    }
  };

  window.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const row = e.target.closest('[data-testid="files-item"]');
    if (!row || row.dataset.fileType !== 'file') return;
    crossDnd = {
      sourceSysId: row.dataset.systemId || 'outer',
      sourceWinId: row.dataset.windowId || '',
      sourcePath: row.dataset.filePath,
      sourceName: row.dataset.fileName || row.dataset.filePath.split('/').pop(),
      startX: e.clientX,
      startY: e.clientY,
      active: false
    };
  }, true);

  window.addEventListener('pointermove', (e) => {
    if (!crossDnd) return;
    if (!crossDnd.active) {
      if (Math.hypot(e.clientX - crossDnd.startX, e.clientY - crossDnd.startY) < 10) return;
      crossDnd.active = true;
      ghostEl = document.createElement('div');
      ghostEl.className = 'cross-dnd-ghost';
      ghostEl.innerHTML = `<span>📄 ${esc(crossDnd.sourceName)}</span><span style="color:#7dd3fc;">(${esc(crossDnd.sourceSysId)})</span>`;
      document.body.appendChild(ghostEl);
    }
    if (ghostEl) {
      ghostEl.style.left = `${e.clientX + 14}px`;
      ghostEl.style.top = `${e.clientY + 14}px`;
    }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const listEl = under?.closest('.root-files-list, .ns-files-list');
    if (highlightedDropEl && highlightedDropEl !== listEl) {
      highlightedDropEl.classList.remove('drop-hover');
    }
    highlightedDropEl = listEl || null;
    if (highlightedDropEl) highlightedDropEl.classList.add('drop-hover');
  });

  window.addEventListener('pointerup', (e) => {
    if (!crossDnd) return;
    const dnd = crossDnd;
    crossDnd = null;
    if (!dnd.active) { clearDndHighlight(); return; }

    const under = document.elementFromPoint(e.clientX, e.clientY);
    const dropRoot = under?.closest('[data-drop-sys-id]');
    clearDndHighlight();
    if (!dropRoot) return;

    const targetSysId = dropRoot.dataset.dropSysId;
    const targetWinId = dropRoot.dataset.dropWinId;
    if (targetSysId === dnd.sourceSysId && targetWinId === dnd.sourceWinId) return;

    // Read content from source system VFS
    let content = null;
    if (dnd.sourceSysId === 'outer') {
      const rd = hostKernel.rootRead(dnd.sourcePath);
      if (rd.ok) content = rd.content;
    } else {
      const slot = hostKernel.subsystems.get(dnd.sourceSysId);
      const node = slot?.kernelVm?.globals?.VFS?.[dnd.sourcePath];
      if (node && node.type === 'file') content = node.content;
    }
    if (content === null) return;

    if (targetSysId === 'outer') {
      const ctrl = winControllers.get(targetWinId);
      ctrl?.receiveDrop?.(dnd.sourceName, content);
    } else {
      hostKernel.forwardInputToSubsystem(targetSysId, {
        type: 'drop_file_to_window',
        winId: targetWinId,
        name: dnd.sourceName,
        content
      });
    }
  });

  // ==================== HostKernel Event Subscriptions ====================
  const offOpenChild = hostKernel.on('open_root_child_window', (cid) => {
    const targetId = typeof cid === 'string' ? cid : cid?.sysId;
    if (targetId) openSubsystemWindow(targetId);
  });
  const offOpenProj = hostKernel.on('open_projection', (proj) => {
    if (proj.targetSysId === 'outer') openProjectionWindow(proj);
  });
  const offFocusProj = hostKernel.on('focus_projection', (pWinId) => {
    const p = hostKernel.projections.get(pWinId);
    if (p?.targetSysId === 'outer') focusWindow(pWinId);
    else if (p) hostKernel.forwardInputToSubsystem(p.targetSysId, { type: 'focus_projection', projWinId: pWinId });
  });
  const offCloseProj = hostKernel.on('close_projection', ({ projWinId }) => forceCloseWindow(projWinId));
  const offNotifBadge = hostKernel.on('notification', renderTaskbarWindows);
  const offSysChanged = hostKernel.on('systems_changed', () => {
    for (const rw of hostKernel.rootWindows.values()) {
      if (rw.appId === 'subsystem') {
        const s = hostKernel.subsystems.get(rw.childSystemId);
        if (s) rw.title = `${s.name} (${s.id})`;
        syncWindowElement(rw);
      }
    }
    renderTaskbarWindows();
  });

  const updateClock = () => {
    const now = new Date();
    clockEl.innerHTML = `${now.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}<br/><span style="font-size:10px;color:#94a3b8;">${now.toLocaleDateString('zh-CN')}</span>`;
  };
  const clockInterval = setInterval(updateClock, 1000);
  updateClock();

  const onResize = () => {
    const bounds = getDesktopBounds();
    for (const rw of hostKernel.rootWindows.values()) {
      if (rw.maximized) {
        rw.x = 0; rw.y = 0; rw.w = bounds.w; rw.h = bounds.h;
      } else if (rw.snapped === 'left') {
        rw.x = 0; rw.y = 0; rw.w = Math.floor(bounds.w / 2); rw.h = bounds.h;
      } else if (rw.snapped === 'right') {
        rw.x = Math.floor(bounds.w / 2); rw.y = 0; rw.w = Math.floor(bounds.w / 2); rw.h = bounds.h;
      }
      syncWindowElement(rw);
    }
  };
  window.addEventListener('resize', onResize);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (ctxMenu) { ctxMenu = null; renderCtxMenu(); }
      if (startOpen) { startOpen = false; renderStartMenu(); }
      if (confirmDialog) {
        modalEl.style.display = 'none';
        confirmDialog = null;
      }
    }
  };
  window.addEventListener('keydown', onKeyDown);

  const resetUI = () => {
    for (const wid of Array.from(hostKernel.rootWindows.keys())) {
      forceCloseWindow(wid);
    }
    widgetsDrawerEl.classList.remove('open');
    startOpen = false;
    ctxMenu = null;
    modalEl.style.display = 'none';
    modalEl.innerHTML = '';
    selectedIconApp = null;
    winSeq = 1;
    zSeq = 100;
    focusedWinId = null;
    applySettings();
    renderIcons();
    renderStartMenu();
    renderCtxMenu();
    renderTaskbarWindows();
  };

  applySettings();
  renderIcons();
  renderStartMenu();
  renderTaskbarWindows();

  return {
    launchApp,
    openSubsystemWindow,
    closeWindow,
    focusWindow,
    resetUI,
    applySettings,
    destroy: () => {
      clearInterval(clockInterval);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      offOpenChild();
      offOpenProj();
      offFocusProj();
      offCloseProj();
      offNotifBadge();
      offSysChanged();
      widgetsCtrl.destroy();
    }
  };
}
