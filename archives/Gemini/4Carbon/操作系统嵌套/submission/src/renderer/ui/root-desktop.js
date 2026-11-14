import { iconSvg } from '../graphics/icons.js';
import { baseVfsName, normVfsPath, parentVfsDir } from '../engine/system-tree.js';
import { ProjectionClientView, localCoords } from './projection-view.js';
import { SubsystemDesktopView } from './subsystem-view.js';
import {
  WALLPAPER_OPTIONS,
  RootWidgetsRuntimeState,
  RootFilesApp,
  RootSpreadsheetApp,
  RootWidgetsApp,
  RootEditorApp,
  RootSettingsApp,
  RootTasksApp,
  RootBrowserApp
} from './root-apps.js';

// ============================================================================
// Cross-Layer Drag-and-Drop Coordinator (Pointer + HTML5 Drag Support)
// ============================================================================

export class CrossLayerDragCoordinator {
  constructor(runtime, showToast, openConflictModal) {
    this.runtime = runtime;
    this.showToast = showToast;
    this.openConflictModal = openConflictModal;
    this.dropZones = new WeakMap(); // Element -> () => { sysId, dir, label }
    this.ghostEl = document.getElementById('global-drag-ghost');
    this.indEl = document.getElementById('global-drop-indicator');
    this.currentHoverZoneEl = null;
  }

  registerDropZone(el, getMetaFn) {
    this.dropZones.set(el, getMetaFn);

    // Also support synthetic HTML5 DragEvents if dispatched by external tools
    el.addEventListener('dragover', (e) => {
      if (!this.html5Payload) return;
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener('drop', (e) => {
      if (!this.html5Payload) return;
      e.preventDefault();
      e.stopPropagation();
      const target = getMetaFn();
      const src = this.html5Payload;
      this.html5Payload = null;
      this.executeDrop(src, target);
    });
  }

  resolveDropTargetAt(clientX, clientY) {
    const hit = document.elementFromPoint(clientX, clientY);
    let cur = hit;
    while (cur && cur !== document.body) {
      if (this.dropZones.has(cur)) {
        return { el: cur, meta: this.dropZones.get(cur)() };
      }
      cur = cur.parentElement;
    }
    return null;
  }

  bindDragSource(el, getSourceFn) {
    el.addEventListener('dragstart', (e) => {
      this.html5Payload = getSourceFn();
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', JSON.stringify(this.html5Payload));
        e.dataTransfer.effectAllowed = 'copy';
      }
    });

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const startX = e.clientX;
      const startY = e.clientY;
      let started = false;
      let srcPayload = null;

      const onMove = (me) => {
        const dist = Math.hypot(me.clientX - startX, me.clientY - startY);
        if (!started && dist > 7) {
          started = true;
          srcPayload = getSourceFn();
          document.body.classList.add('dragging-file');
          this.ghostEl.textContent = `📄 ${srcPayload.name} (${srcPayload.srcSysId})`;
          this.ghostEl.classList.remove('hidden');
        }
        if (!started) return;

        this.ghostEl.style.left = `${me.clientX + 14}px`;
        this.ghostEl.style.top = `${me.clientY + 14}px`;

        const resolved = this.resolveDropTargetAt(me.clientX, me.clientY);
        if (this.currentHoverZoneEl && this.currentHoverZoneEl !== resolved?.el) {
          this.currentHoverZoneEl.classList.remove('drop-hover');
        }
        if (resolved && !(resolved.meta.sysId === srcPayload.srcSysId && resolved.meta.dir === parentVfsDir(srcPayload.srcPath))) {
          this.currentHoverZoneEl = resolved.el;
          this.currentHoverZoneEl.classList.add('drop-hover');
          this.indEl.textContent = `投放到 ${resolved.meta.label}`;
          this.indEl.style.left = `${me.clientX + 14}px`;
          this.indEl.style.top = `${me.clientY - 22}px`;
          this.indEl.classList.remove('hidden');
        } else {
          this.currentHoverZoneEl = null;
          this.indEl.classList.add('hidden');
        }
      };

      const onUp = (ue) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (!started) return;

        if (this.currentHoverZoneEl) {
          this.currentHoverZoneEl.classList.remove('drop-hover');
          this.currentHoverZoneEl = null;
        }
        this.ghostEl.classList.add('hidden');
        this.indEl.classList.add('hidden');
        document.body.classList.remove('dragging-file');

        const resolved = this.resolveDropTargetAt(ue.clientX, ue.clientY);
        if (resolved && srcPayload) {
          this.executeDrop(srcPayload, resolved.meta);
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  executeDrop(src, dst) {
    if (!src || !dst) return;
    if (src.srcSysId === dst.sysId && parentVfsDir(src.srcPath) === normVfsPath(dst.dir)) {
      return; // Same folder no-op
    }
    const res = this.runtime.transferFileAcrossSystems(src.srcSysId, src.srcPath, dst.sysId, dst.dir, false);
    if (res.ok) {
      this.showToast('跨层文件传递成功', `${src.srcSysId}:${src.srcPath} -> ${dst.sysId}:${res.targetPath}`);
      return;
    }
    if (res.duplicate) {
      this.openConflictModal({
        title: '目标位置已存在同名文件',
        message: `${dst.sysId}:${res.targetPath} 已存在。请选择处理方式：`,
        onOverwrite: () => {
          const r2 = this.runtime.transferFileAcrossSystems(src.srcSysId, src.srcPath, dst.sysId, dst.dir, true);
          if (r2.ok) this.showToast('已覆盖同名文件', `${dst.sysId}:${r2.targetPath}`);
          else this.showToast('文件传递失败', r2.error || '配额不足');
        },
        onKeepBoth: () => {
          // Read source and write with unique copy prefix
          let content =
            src.srcSysId === 'outer'
              ? this.runtime.rootReadFile(src.srcPath)
              : this.runtime.savedSubsysFiles[src.srcSysId]?.[normVfsPath(src.srcPath)]?.content;
          if (content === null || content === undefined) return;
          const copyName = `copy_${Date.now() % 1000}_${baseVfsName(src.srcPath)}`;
          const altPath = normVfsPath(`${dst.dir === '/' ? '' : dst.dir}/${copyName}`);
          if (dst.sysId === 'outer') {
            const wr = this.runtime.rootWriteFile(altPath, content);
            if (wr.ok) this.showToast('已保留副本', `outer:${altPath}`);
            else this.showToast('写入失败', wr.error);
          } else {
            const m = this.runtime.systems.get(dst.sysId);
            if (m) {
              m.crossMsgQueue.push({ kind: 'file_drop', dstPath: altPath, content: String(content) });
              this.showToast('已保留副本', `${dst.sysId}:${altPath}`);
            }
          }
        }
      });
      return;
    }
    this.showToast('文件投放失败', res.error || '目标不可用');
  }
}

// ============================================================================
// Root Desktop Window Manager & Shell ('outer')
// ============================================================================

export class RootDesktopController {
  constructor({ mountEl, runtime, displayDevice }) {
    this.mountEl = mountEl;
    this.runtime = runtime;
    this.displayDevice = displayDevice;

    this.widgetsState = new RootWidgetsRuntimeState(runtime);
    this.windows = []; // Ordered bottom-to-top: { id, appId, title, state, x, y, w, h, restoreRect, el, titleEl, ctrl, projKey, childSysId }
    this.focusedWinId = null;
    this.nextWinSeq = 1;
    this.startOpen = false;
    this.notifOpen = false;
    this.selectedIconId = null;

    this.dragCoordinator = new CrossLayerDragCoordinator(
      runtime,
      (title, body) => this.showToast(title, body),
      (opts) => this.showConflictDialog(opts)
    );

    this.buildDesktop();
    this.applyRootSettings();
  }

  buildDesktop() {
    this.mountEl.innerHTML = '';

    this.el = document.createElement('div');
    this.el.className = 'os-desktop root-desktop';
    this.el.dataset.testid = 'os-desktop';
    this.el.dataset.systemId = 'outer';
    this.el.tabIndex = 0;

    // Desktop drop zone -> /Documents
    this.dragCoordinator.registerDropZone(this.el, () => ({
      sysId: 'outer',
      dir: '/Documents',
      label: 'outer:/Documents'
    }));

    // 1. Desktop Icons Layer
    this.iconsLayer = document.createElement('div');
    this.iconsLayer.className = 'desktop-icons-layer';
    this.renderDesktopIcons();
    this.el.appendChild(this.iconsLayer);

    // 2. Snap Preview Ghost
    this.snapPreview = document.createElement('div');
    this.snapPreview.className = 'snap-preview hidden';
    this.el.appendChild(this.snapPreview);

    // 3. Windows Layer
    this.windowsLayer = document.createElement('div');
    this.windowsLayer.className = 'windows-layer';
    this.el.appendChild(this.windowsLayer);

    // 4. Start Menu (ONLY Root's canonical launch-* entries!)
    this.startMenu = document.createElement('div');
    this.startMenu.className = 'start-menu hidden';
    this.startMenu.dataset.testid = 'start-menu';
    this.startMenu.dataset.systemId = 'outer';

    this.startHeader = document.createElement('div');
    this.startHeader.style.cssText = 'font-size:13px;font-weight:700;color:#fde047;';
    this.startSearch = document.createElement('input');
    this.startSearch.type = 'text';
    this.startSearch.className = 'start-search';
    this.startSearch.placeholder = '搜索根系统应用...';

    this.startGrid = document.createElement('div');
    this.startGrid.className = 'start-grid';
    this.rootAppSpecs = [
      { appId: 'files', testId: 'launch-files', label: '文件管理器' },
      { appId: 'spreadsheet', testId: 'launch-spreadsheet', label: '电子表格' },
      { appId: 'browser', testId: 'launch-browser', label: 'Chromium 浏览器' },
      { appId: 'widgets', testId: 'launch-widgets', label: '小组件面板' },
      { appId: 'tasks', testId: 'launch-tasks', label: '任务与子系统管理' },
      { appId: 'editor', testId: 'launch-editor', label: '文本与程序编辑器' },
      { appId: 'settings', testId: 'launch-settings', label: '系统设置' }
    ];
    this.renderStartGrid('');
    this.startSearch.addEventListener('input', () => {
      this.renderStartGrid(this.startSearch.value.trim().toLowerCase());
    });

    const startFooter = document.createElement('div');
    startFooter.className = 'start-footer';
    startFooter.innerHTML = `<span style="font-size:11px;color:#94a3b8;">系统标识: outer (根桌面)</span>`;
    const btnManual = document.createElement('button');
    btnManual.type = 'button';
    btnManual.className = 'btn btn-sm btn-gold';
    btnManual.textContent = '📖 操作说明文档';
    btnManual.addEventListener('click', () => {
      this.closePopups();
      this.launchRootApp('editor', '/Documents/操作说明.md');
    });
    startFooter.appendChild(btnManual);

    this.startMenu.append(this.startHeader, this.startSearch, this.startGrid, startFooter);
    this.el.appendChild(this.startMenu);

    // 5. Notification Center Drawer
    this.notifDrawer = document.createElement('div');
    this.notifDrawer.className = 'side-drawer notif-drawer hidden';
    this.notifDrawer.dataset.systemId = 'outer';
    this.el.appendChild(this.notifDrawer);

    // 6. Context Menu
    this.ctxMenu = document.createElement('div');
    this.ctxMenu.className = 'os-context-menu hidden';
    this.ctxMenu.dataset.systemId = 'outer';
    this.el.appendChild(this.ctxMenu);

    // 7. Modal Backdrop (Confirm close subsystem / Duplicate file conflict)
    this.modalBackdrop = document.createElement('div');
    this.modalBackdrop.className = 'os-modal-backdrop hidden';
    this.el.appendChild(this.modalBackdrop);

    // 8. Taskbar
    this.taskbar = document.createElement('div');
    this.taskbar.className = 'os-taskbar';

    const tbLeft = document.createElement('div');
    tbLeft.className = 'taskbar-left';

    this.btnStart = document.createElement('button');
    this.btnStart.type = 'button';
    this.btnStart.className = 'start-btn';
    this.btnStart.dataset.testid = 'start-toggle';
    this.btnStart.dataset.systemId = 'outer';
    this.btnStart.setAttribute('aria-label', '开始菜单');
    this.btnStart.innerHTML = `${iconSvg('prism')}<span>开始</span>`;
    this.btnStart.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startOpen = !this.startOpen;
      this.notifOpen = false;
      this.ctxMenu.classList.add('hidden');
      this.syncShellPopups();
    });

    this.btnWidgetsToggle = document.createElement('button');
    this.btnWidgetsToggle.type = 'button';
    this.btnWidgetsToggle.className = 'tb-quick-btn';
    this.btnWidgetsToggle.dataset.testid = 'widgets-toggle';
    this.btnWidgetsToggle.dataset.systemId = 'outer';
    this.btnWidgetsToggle.setAttribute('aria-label', '打开或收起小组件面板');
    this.btnWidgetsToggle.innerHTML = `${iconSvg('widgets')}<span>小组件</span>`;
    this.btnWidgetsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePopups();
      this.toggleWidgetsWindow();
    });

    this.btnNewSubsys = document.createElement('button');
    this.btnNewSubsys.type = 'button';
    this.btnNewSubsys.className = 'tb-quick-btn';
    this.btnNewSubsys.dataset.testid = 'system-new';
    this.btnNewSubsys.dataset.systemId = 'outer';
    this.btnNewSubsys.setAttribute('aria-label', '新建直属子系统');
    this.btnNewSubsys.innerHTML = `${iconSvg('subsystem')}<span>新建子系统</span>`;
    this.btnNewSubsys.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePopups();
      this.createAndOpenRootSubsystem();
    });

    tbLeft.append(this.btnStart, this.btnWidgetsToggle, this.btnNewSubsys);

    this.tbCenter = document.createElement('div');
    this.tbCenter.className = 'taskbar-center';

    const tbRight = document.createElement('div');
    tbRight.className = 'taskbar-right';

    this.clockEl = document.createElement('div');
    this.clockEl.className = 'tray-clock';

    this.btnNotif = document.createElement('button');
    this.btnNotif.type = 'button';
    this.btnNotif.className = 'tb-quick-btn';
    this.btnNotif.dataset.testid = 'notifications-toggle';
    this.btnNotif.dataset.systemId = 'outer';
    this.btnNotif.setAttribute('aria-label', '通知中心');
    this.btnNotif.addEventListener('click', (e) => {
      e.stopPropagation();
      this.notifOpen = !this.notifOpen;
      this.startOpen = false;
      this.ctxMenu.classList.add('hidden');
      if (this.notifOpen) {
        for (const n of this.runtime.root.notifications) n.unread = false;
      }
      this.syncShellPopups();
    });

    tbRight.append(this.clockEl, this.btnNotif);
    this.taskbar.append(tbLeft, this.tbCenter, tbRight);
    this.el.appendChild(this.taskbar);

    this.mountEl.appendChild(this.el);
    this.bindRootDesktopEvents();
    this.updateClockAndTray();
  }

  renderStartGrid(query) {
    this.startGrid.innerHTML = '';
    for (const sp of this.rootAppSpecs) {
      if (query && !sp.label.toLowerCase().includes(query) && !sp.appId.includes(query)) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'start-launch-btn';
      b.dataset.testid = sp.testId;
      b.dataset.systemId = 'outer';
      b.setAttribute('aria-label', sp.label);
      b.innerHTML = `<span class="sl-icon">${iconSvg(sp.appId)}</span><span>${sp.label}</span>`;
      b.addEventListener('click', () => {
        this.closePopups();
        this.launchRootApp(sp.appId);
      });
      this.startGrid.appendChild(b);
    }
  }

  renderDesktopIcons() {
    this.iconsLayer.innerHTML = '';
    const icons = [
      { id: 'd_files', label: '文件管理器', icon: 'files', appId: 'files' },
      { id: 'd_sheet', label: '电子表格', icon: 'spreadsheet', appId: 'spreadsheet' },
      { id: 'd_browser', label: '浏览器', icon: 'browser', appId: 'browser' },
      { id: 'd_widgets', label: '小组件', icon: 'widgets', appId: 'widgets' },
      { id: 'd_tasks', label: '任务管理器', icon: 'tasks', appId: 'tasks' },
      { id: 'd_editor', label: '程序编辑器', icon: 'editor', appId: 'editor' },
      { id: 'd_settings', label: '系统设置', icon: 'settings', appId: 'settings' },
      { id: 'd_heli', label: '24号直升机', icon: 'scene', filePath: '/Demo/helicopter-24.scene' },
      { id: 'd_sample', label: '示例工作簿', icon: 'spreadsheet', filePath: '/Demo/sample.sheet' },
      { id: 'd_manual', label: '操作说明', icon: 'doc', filePath: '/Documents/操作说明.md' }
    ];

    icons.forEach((ic, idx) => {
      const col = Math.floor(idx / 6);
      const row = idx % 6;
      const el = document.createElement('div');
      el.className = 'desktop-icon' + (this.selectedIconId === ic.id ? ' selected' : '');
      el.style.left = `${16 + col * 92}px`;
      el.style.top = `${16 + row * 88}px`;
      el.dataset.testid = 'desktop-icon';
      el.dataset.systemId = 'outer';
      if (ic.appId) el.dataset.appId = ic.appId;
      if (ic.filePath) el.dataset.filePath = ic.filePath;
      el.setAttribute('aria-label', ic.label);
      el.innerHTML = `<div class="icon-glyph">${iconSvg(ic.icon)}</div><div class="icon-label">${ic.label}</div>`;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedIconId = ic.id;
        this.closePopups();
        this.renderDesktopIcons();
      });

      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.closePopups();
        if (ic.appId) this.launchRootApp(ic.appId);
        else if (ic.filePath) this.openRootFileByAssociation(ic.filePath);
      });

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectedIconId = ic.id;
        this.renderDesktopIcons();
        this.openContextMenu(e.clientX, e.clientY, [
          {
            label: `打开 ${ic.label}`,
            run: () => (ic.appId ? this.launchRootApp(ic.appId) : this.openRootFileByAssociation(ic.filePath))
          }
        ]);
      });

      if (ic.filePath) {
        this.dragCoordinator.bindDragSource(el, () => ({
          srcSysId: 'outer',
          srcPath: ic.filePath,
          name: baseVfsName(ic.filePath)
        }));
      }

      this.iconsLayer.appendChild(el);
    });
  }

  bindRootDesktopEvents() {
    this.el.addEventListener('pointerdown', (e) => {
      if (e.target === this.el || e.target === this.iconsLayer) {
        this.selectedIconId = null;
        this.focusedWinId = null;
        this.closePopups();
        this.renderDesktopIcons();
        this.syncWindowLayers();
        this.el.focus({ preventScroll: true });
      }
    });

    this.el.addEventListener('contextmenu', (e) => {
      if (e.target === this.el || e.target === this.iconsLayer) {
        e.preventDefault();
        this.openContextMenu(e.clientX, e.clientY, [
          { label: '➕ 新建直属子系统', run: () => this.createAndOpenRootSubsystem() },
          { label: '📁 打开文件管理器', run: () => this.launchRootApp('files') },
          { label: '📊 打开电子表格 (sample.sheet)', run: () => this.launchRootApp('spreadsheet', '/Demo/sample.sheet') },
          { label: '🌐 打开 Chromium 浏览器', run: () => this.launchRootApp('browser') },
          { label: '⚙ 系统设置', run: () => this.launchRootApp('settings') },
          { label: '📖 查看操作说明', run: () => this.launchRootApp('editor', '/Documents/操作说明.md') }
        ]);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.startOpen || this.notifOpen || !this.ctxMenu.classList.contains('hidden')) {
          this.closePopups();
        }
      }
    });
  }

  openContextMenu(clientX, clientY, items) {
    this.startOpen = false;
    this.notifOpen = false;
    this.syncShellPopups();

    const pt = localCoords(this.el, clientX, clientY);
    const maxW = this.el.clientWidth || 1280;
    const maxH = (this.el.clientHeight || 800) - 48;
    this.ctxMenu.style.left = `${Math.max(6, Math.min(pt.x, maxW - 196))}px`;
    this.ctxMenu.style.top = `${Math.max(6, Math.min(pt.y, maxH - items.length * 32 - 12))}px`;
    this.ctxMenu.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ctx-item';
      b.textContent = it.label;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ctxMenu.classList.add('hidden');
        it.run();
      });
      this.ctxMenu.appendChild(b);
    }
    this.ctxMenu.classList.remove('hidden');
  }

  closePopups() {
    this.startOpen = false;
    this.notifOpen = false;
    this.ctxMenu.classList.add('hidden');
    this.syncShellPopups();
  }

  syncShellPopups() {
    this.btnStart.classList.toggle('active', this.startOpen);
    this.startMenu.classList.toggle('hidden', !this.startOpen);
    if (this.startOpen) {
      this.startHeader.textContent = `${this.runtime.root.settings.systemName} · 开始菜单`;
    }

    this.btnNotif.classList.toggle('active', this.notifOpen);
    this.notifDrawer.classList.toggle('hidden', !this.notifOpen);
    if (this.notifOpen) {
      this.renderNotificationCenter();
    }
    this.updateClockAndTray();
  }

  renderNotificationCenter() {
    const notifs = this.runtime.root.notifications;
    const dnd = Boolean(this.runtime.root.settings.dnd);
    this.notifDrawer.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-weight:700;color:#fde047;font-size:13px;">🔔 通知中心 (${notifs.length})</span>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-sm ${dnd ? 'btn-gold' : ''}" data-act="dnd">${dnd ? '🌙 免打扰开' : '免打扰关'}</button>
          <button type="button" class="btn btn-sm" data-act="clear">清空</button>
        </div>
      </div>
    `;
    this.notifDrawer.querySelector('[data-act="dnd"]').addEventListener('click', () => {
      this.runtime.root.settings.dnd = !this.runtime.root.settings.dnd;
      this.runtime.schedulePersist();
      this.renderNotificationCenter();
    });
    this.notifDrawer.querySelector('[data-act="clear"]').addEventListener('click', () => {
      this.runtime.root.notifications = [];
      this.renderNotificationCenter();
      this.updateClockAndTray();
    });

    if (notifs.length === 0) {
      const emp = document.createElement('div');
      emp.style.cssText = 'padding:24px 8px;color:#64748b;text-align:center;';
      emp.textContent = '暂无通知（倒计时到时、文件回收与投送事件将汇总在此）';
      this.notifDrawer.appendChild(emp);
    } else {
      for (const n of notifs) {
        const card = document.createElement('div');
        card.className = 'widget-card';
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;font-weight:700;color:#f8fafc;">
            <span>${n.title}</span>
            <span style="font-size:10.5px;color:#94a3b8;font-weight:400;">${n.time}</span>
          </div>
          <div style="font-size:11.5px;color:#cbd5e1;">${n.body}</div>
        `;
        this.notifDrawer.appendChild(card);
      }
    }
  }

  applyRootSettings() {
    const s = this.runtime.root.settings;
    document.documentElement.style.setProperty('--accent', s.accent || '#8b5cf6');
    document.documentElement.style.setProperty('--accent-strong', s.accent || '#a78bfa');
    document.documentElement.style.setProperty('--accent-soft', `${s.accent || '#8b5cf6'}38`);
    document.documentElement.style.setProperty('--ui-scale', String(s.scale || 1));

    const wp = WALLPAPER_OPTIONS.find((w) => w.value === s.wallpaper) || WALLPAPER_OPTIONS[0];
    this.el.style.backgroundImage = `url('${wp.url}')`;
  }

  showToast(title, body) {
    if (this.runtime.root.settings.dnd) return;
    const stack = document.getElementById('global-toast-stack');
    if (!stack) return;
    const card = document.createElement('div');
    card.className = 'toast-card';
    card.innerHTML = `<div class="toast-title"></div><div class="toast-body"></div>`;
    card.querySelector('.toast-title').textContent = title;
    card.querySelector('.toast-body').textContent = body || '';
    stack.appendChild(card);
    setTimeout(() => {
      card.remove();
    }, 3600);
  }

  showConflictDialog({ title, message, onOverwrite, onKeepBoth }) {
    this.modalBackdrop.classList.remove('hidden');
    this.modalBackdrop.innerHTML = `
      <div class="os-modal-card">
        <div class="os-modal-title"></div>
        <div class="os-modal-msg"></div>
        <div class="os-modal-actions">
          <button type="button" class="btn" data-act="cancel">取消</button>
          <button type="button" class="btn btn-gold" data-act="keep">保留副本</button>
          <button type="button" class="btn btn-primary" data-act="overwrite">覆盖同名文件</button>
        </div>
      </div>
    `;
    this.modalBackdrop.querySelector('.os-modal-title').textContent = title;
    this.modalBackdrop.querySelector('.os-modal-msg').textContent = message;
    this.modalBackdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => {
      this.modalBackdrop.classList.add('hidden');
    });
    this.modalBackdrop.querySelector('[data-act="keep"]').addEventListener('click', () => {
      this.modalBackdrop.classList.add('hidden');
      onKeepBoth();
    });
    this.modalBackdrop.querySelector('[data-act="overwrite"]').addEventListener('click', () => {
      this.modalBackdrop.classList.add('hidden');
      onOverwrite();
    });
  }

  // ==========================================================================
  // Window Lifecycle, Launching & Snapping
  // ==========================================================================

  getDesktopApi() {
    return {
      showToast: (t, b) => this.showToast(t, b),
      openContextMenu: (x, y, items) => this.openContextMenu(x, y, items),
      openRootFileByAssociation: (p) => this.openRootFileByAssociation(p),
      applyRootSettings: () => this.applyRootSettings(),
      launchRootApp: (appId, arg) => this.launchRootApp(appId, arg),
      createAndOpenRootSubsystem: () => this.createAndOpenRootSubsystem(),
      ensureRootSubsystemWindow: (sysId) => this.ensureRootSubsystemWindow(sysId),
      requestCloseRootSubsystem: (sysId) => this.requestCloseRootSubsystem(sysId),
      inspectBrowsers: () => this.inspectBrowsers(),
      closeBrowserTabById: (winId, tabId) => this.closeBrowserTabById(winId, tabId)
    };
  }

  openRootFileByAssociation(filePath) {
    const np = normVfsPath(filePath);
    if (np.endsWith('.sheet')) {
      this.launchRootApp('spreadsheet', np);
    } else if (np.endsWith('.snap')) {
      const r = this.runtime.forkSnapshotFromParent('outer', np);
      if (r.ok) {
        this.ensureRootSubsystemWindow(r.sysId);
        this.showToast('已从快照分叉启动实例', r.message);
      } else {
        this.showToast('打开快照失败', r.message);
      }
    } else {
      this.launchRootApp('editor', np);
    }
  }

  toggleWidgetsWindow() {
    const existing = this.windows.find((w) => w.appId === 'widgets');
    if (existing) {
      if (existing.state === 'minimized') {
        existing.state = 'normal';
        this.focusWindow(existing.id);
      } else if (this.focusedWinId === existing.id) {
        this.minimizeWindow(existing.id);
      } else {
        this.focusWindow(existing.id);
      }
      return existing.id;
    }
    return this.launchRootApp('widgets');
  }

  launchRootApp(appId, initArg = null) {
    // Singleton behavior for widgets & settings so testids remain strictly 1-instance clean
    if (appId === 'widgets' || appId === 'settings') {
      const ex = this.windows.find((w) => w.appId === appId);
      if (ex) {
        if (ex.state === 'minimized') ex.state = 'normal';
        this.focusWindow(ex.id);
        return ex.id;
      }
    }

    const dw = this.el.clientWidth || 1440;
    const dh = (this.el.clientHeight || 900) - 44;
    const offset = ((this.nextWinSeq - 1) % 6) * 26;

    const defaults = {
      files: { title: '文件管理器', w: 720, h: 480, x: 210 + offset, y: 48 + offset },
      spreadsheet: { title: '电子表格', w: 760, h: 500, x: 220 + offset, y: 52 + offset },
      widgets: { title: '小组件中心', w: 400, h: Math.min(680, dh - 24), x: Math.max(20, dw - 424), y: 12 },
      editor: { title: '文本与程序编辑器', w: 720, h: 500, x: 230 + offset, y: 50 + offset },
      tasks: { title: '任务与子系统管理器', w: 800, h: 540, x: 200 + offset, y: 42 + offset },
      settings: { title: '系统设置', w: 580, h: 510, x: 250 + offset, y: 56 + offset },
      browser: { title: 'Chromium 浏览器', w: Math.min(980, dw - 220), h: Math.min(640, dh - 36), x: 196 + offset, y: 20 + offset }
    };

    const spec = defaults[appId] || { title: appId, w: 640, h: 440, x: 210, y: 50 };
    const winId = `outer-win-${this.nextWinSeq++}`;
    const wObj = {
      id: winId,
      appId,
      title: spec.title,
      state: 'normal',
      x: Math.max(12, Math.min(spec.x, dw - Math.min(spec.w, dw - 24))),
      y: Math.max(8, Math.min(spec.y, dh - Math.min(spec.h, dh - 16))),
      w: Math.min(spec.w, dw - 24),
      h: Math.min(spec.h, dh - 16),
      restoreRect: null,
      ctrl: null,
      el: null,
      titleEl: null
    };

    const api = this.getDesktopApi();
    const onTitleChange = (newTitle) => {
      wObj.title = newTitle;
      if (wObj.titleEl) wObj.titleEl.textContent = newTitle;
      this.renderTaskbar();
    };

    if (appId === 'files') {
      wObj.ctrl = new RootFilesApp({ winId, initPath: initArg, runtime: this.runtime, desktopApi: api, dragCoordinator: this.dragCoordinator });
    } else if (appId === 'spreadsheet') {
      wObj.ctrl = new RootSpreadsheetApp({ winId, initPath: initArg, runtime: this.runtime, desktopApi: api, onTitleChange });
    } else if (appId === 'widgets') {
      wObj.ctrl = new RootWidgetsApp({ winId, runtime: this.runtime, widgetsState: this.widgetsState, desktopApi: api });
    } else if (appId === 'editor') {
      wObj.ctrl = new RootEditorApp({ winId, initPath: initArg, runtime: this.runtime, desktopApi: api, onTitleChange });
    } else if (appId === 'settings') {
      wObj.ctrl = new RootSettingsApp({ winId, runtime: this.runtime, desktopApi: api });
    } else if (appId === 'tasks') {
      wObj.ctrl = new RootTasksApp({ winId, runtime: this.runtime, desktopApi: api });
    } else if (appId === 'browser') {
      wObj.ctrl = new RootBrowserApp({ winId, initUrl: initArg, onTitleChange });
    }

    this.mountWindowObject(wObj);
    return winId;
  }

  createAndOpenRootSubsystem() {
    const childId = this.runtime.createRootChildSubsystem();
    this.ensureRootSubsystemWindow(childId);
    return childId;
  }

  ensureRootSubsystemWindow(childSysId) {
    const existing = this.windows.find((w) => w.appId === 'subsystem' && w.childSysId === childSysId);
    if (existing) {
      if (existing.state === 'minimized') existing.state = 'normal';
      this.focusWindow(existing.id);
      return existing.id;
    }

    const dw = this.el.clientWidth || 1440;
    const dh = (this.el.clientHeight || 900) - 44;
    const ww = Math.min(1040, Math.max(680, Math.round(dw * 0.72)));
    const wh = Math.min(700, Math.max(460, Math.round(dh * 0.82)));
    const winId = `outer-subwin-${childSysId}`;

    const wObj = {
      id: winId,
      appId: 'subsystem',
      childSysId,
      title: `子系统桌面 · ${childSysId}`,
      state: 'normal',
      x: Math.max(196, dw - ww - 24),
      y: Math.max(14, Math.round((dh - wh) * 0.35)),
      w: ww,
      h: wh,
      restoreRect: null,
      ctrl: new SubsystemDesktopView({
        sysId: childSysId,
        runtime: this.runtime,
        displayDevice: this.displayDevice,
        dragCoordinator: this.dragCoordinator,
        showToast: (t, b) => this.showToast(t, b),
        onOpenParentKernel: (_parentId, targetChildId) => {
          this.launchRootApp('editor', `/Subsystems/${targetChildId}/kernel.nos`);
        }
      }),
      el: null,
      titleEl: null
    };

    this.mountWindowObject(wObj);
    return winId;
  }

  reconcileRootProjections() {
    const rootProjs = [];
    for (const p of this.runtime.projections.values()) {
      if (p.targetSysId === 'outer') rootProjs.push(p);
    }

    const activeKeys = new Set(rootProjs.map((p) => p.projKey));
    for (const w of [...this.windows]) {
      if (w.appId === 'projection' && !activeKeys.has(w.projKey)) {
        this.forceCloseWindow(w.id);
      }
    }

    for (const proj of rootProjs) {
      let existing = this.windows.find((w) => w.appId === 'projection' && w.projKey === proj.projKey);
      if (!existing) {
        const dw = this.el.clientWidth || 1440;
        const dh = (this.el.clientHeight || 900) - 44;
        const wObj = {
          id: proj.projWinId,
          appId: 'projection',
          projKey: proj.projKey,
          sourceSystemId: proj.sourceSystemId,
          sourceWindowId: proj.sourceWindowId,
          sourceAppId: proj.sourceAppId,
          title: proj.title,
          state: 'normal',
          x: Math.min(proj.x, Math.max(20, dw - proj.w - 20)),
          y: Math.min(proj.y, Math.max(16, dh - proj.h - 20)),
          w: proj.w,
          h: proj.h,
          restoreRect: null,
          ctrl: new ProjectionClientView({
            projection: proj,
            targetSysId: 'outer',
            runtime: this.runtime,
            displayDevice: this.displayDevice
          }),
          el: null,
          titleEl: null
        };
        this.mountWindowObject(wObj);
        existing = wObj;
      } else {
        existing.ctrl.update(proj);
      }
    }
  }

  mountWindowObject(wObj) {
    const winEl = document.createElement('div');
    winEl.className = 'app-window';
    winEl.dataset.testid = 'app-window';
    winEl.dataset.systemId = 'outer';
    winEl.dataset.windowId = wObj.id;
    winEl.dataset.appId = wObj.appId;

    if (wObj.appId === 'projection') {
      winEl.dataset.sourceSystemId = wObj.sourceSystemId;
      winEl.dataset.sourceWindowId = wObj.sourceWindowId;
      winEl.dataset.sourceAppId = wObj.sourceAppId;
    }

    winEl.addEventListener('pointerdown', () => {
      this.closePopups();
      this.focusWindow(wObj.id);
    });

    const titlebar = document.createElement('div');
    titlebar.className = 'window-titlebar';
    titlebar.dataset.testid = 'window-titlebar';
    titlebar.dataset.systemId = 'outer';
    titlebar.dataset.windowId = wObj.id;

    const left = document.createElement('div');
    left.className = 'window-title-left';
    const ic = document.createElement('span');
    ic.className = 'win-icon';
    ic.innerHTML = iconSvg(wObj.appId);
    const titleEl = document.createElement('span');
    titleEl.className = 'window-title-text';
    titleEl.textContent = wObj.title;
    const badge = document.createElement('span');
    badge.className = 'win-sys-badge';
    badge.textContent = wObj.appId === 'projection' ? `来源 ${wObj.sourceSystemId}` : 'outer';
    left.append(ic, titleEl, badge);

    const ctrls = document.createElement('div');
    ctrls.className = 'window-controls';

    // Quick child subsystem controls on Root child subsystem window header
    if (wObj.appId === 'subsystem' && wObj.childSysId) {
      const mkSubHdrBtn = (txt, tid, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'win-ctrl-btn';
        b.style.width = 'auto';
        b.style.padding = '0 6px';
        b.textContent = txt;
        b.dataset.testid = tid;
        b.dataset.systemId = 'outer';
        b.dataset.windowId = wObj.id;
        b.dataset.targetSystemId = wObj.childSysId;
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          fn();
        });
        return b;
      };
      ctrls.append(
        mkSubHdrBtn('⏸ 暂停', 'system-pause', () => this.runtime.pauseSubsystem(wObj.childSysId)),
        mkSubHdrBtn('▶ 继续', 'system-resume', () => this.runtime.resumeSubsystem(wObj.childSysId)),
        mkSubHdrBtn('↻ 重启', 'system-restart', () => this.runtime.restartSubsystem(wObj.childSysId)),
        mkSubHdrBtn('内核源码', 'kernel-open', () => this.launchRootApp('editor', `/Subsystems/${wObj.childSysId}/kernel.nos`))
      );
    }

    const mkBtn = (sym, tid, aria, cls, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'win-ctrl-btn' + (cls ? ` ${cls}` : '');
      b.textContent = sym;
      b.dataset.testid = tid;
      b.dataset.systemId = 'outer';
      b.dataset.windowId = wObj.id;
      b.setAttribute('aria-label', aria);
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        fn();
      });
      return b;
    };

    ctrls.append(
      mkBtn('—', 'window-minimize', '最小化窗口', '', () => this.minimizeWindow(wObj.id)),
      mkBtn('▢', 'window-maximize', '最大化或还原窗口', '', () => this.toggleMaximizeWindow(wObj.id)),
      mkBtn('✕', 'window-close', '关闭窗口', 'close-btn', () => this.requestCloseWindow(wObj.id))
    );

    titlebar.append(left, ctrls);

    // Titlebar drag move & half-screen snap
    titlebar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      this.closePopups();
      this.focusWindow(wObj.id);

      const pt0 = localCoords(this.el, e.clientX, e.clientY);
      const dw = this.el.clientWidth || 1440;
      const dh = (this.el.clientHeight || 900) - 44;

      if (wObj.state === 'maximized') {
        wObj.state = 'normal';
        wObj.w = wObj.restoreRect ? wObj.restoreRect.w : 740;
        wObj.h = wObj.restoreRect ? wObj.restoreRect.h : 490;
        wObj.x = Math.max(0, Math.min(pt0.x - wObj.w / 2, dw - wObj.w));
        wObj.y = Math.max(0, pt0.y - 16);
      }

      const origX = wObj.x;
      const origY = wObj.y;
      let pendingSnap = null;
      this.setBrowserPointerPassthrough(true);

      const onMove = (me) => {
        const mpt = localCoords(this.el, me.clientX, me.clientY);
        const curDw = this.el.clientWidth || 1440;
        const curDh = (this.el.clientHeight || 900) - 44;
        wObj.x = Math.max(-Math.floor(wObj.w * 0.4), Math.min(origX + (mpt.x - pt0.x), curDw - 80));
        wObj.y = Math.max(0, Math.min(origY + (mpt.y - pt0.y), curDh - 34));

        // Left / Right Half-Screen Snap Detection (generous 40px edge margin)
        if (mpt.x <= 40) {
          pendingSnap = 'left';
          this.snapPreview.style.left = '6px';
          this.snapPreview.style.width = `${Math.floor(curDw / 2) - 9}px`;
          this.snapPreview.classList.remove('hidden');
        } else if (mpt.x >= curDw - 40) {
          pendingSnap = 'right';
          this.snapPreview.style.left = `${Math.floor(curDw / 2) + 3}px`;
          this.snapPreview.style.width = `${Math.floor(curDw / 2) - 9}px`;
          this.snapPreview.classList.remove('hidden');
        } else {
          pendingSnap = null;
          this.snapPreview.classList.add('hidden');
        }

        this.applyWindowGeometry(wObj);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        this.setBrowserPointerPassthrough(false);
        this.snapPreview.classList.add('hidden');
        if (pendingSnap) {
          this.snapWindowHalf(wObj.id, pendingSnap);
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    titlebar.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.toggleMaximizeWindow(wObj.id);
    });

    titlebar.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openContextMenu(e.clientX, e.clientY, [
        { label: '◧ 贴靠左半屏', run: () => this.snapWindowHalf(wObj.id, 'left') },
        { label: '◨ 贴靠右半屏', run: () => this.snapWindowHalf(wObj.id, 'right') },
        { label: wObj.state === 'maximized' ? '还原窗口' : '最大化窗口', run: () => this.toggleMaximizeWindow(wObj.id) },
        { label: '最小化', run: () => this.minimizeWindow(wObj.id) },
        { label: '关闭', run: () => this.requestCloseWindow(wObj.id) }
      ]);
    });

    const body = document.createElement('div');
    body.className = 'window-body';
    if (wObj.ctrl && wObj.ctrl.el) {
      body.appendChild(wObj.ctrl.el);
    }

    // Resize Handles
    for (const [dir, cls, tid] of [
      ['se', 'rh-se', 'window-resize'],
      ['e', 'rh-e', null],
      ['s', 'rh-s', null],
      ['w', 'rh-w', null]
    ]) {
      const rh = document.createElement('div');
      rh.className = `resize-handle ${cls}`;
      if (tid) {
        rh.dataset.testid = tid;
        rh.dataset.systemId = 'outer';
        rh.dataset.windowId = wObj.id;
        rh.setAttribute('aria-label', '缩放窗口');
      }
      rh.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        this.focusWindow(wObj.id);
        wObj.state = 'normal';
        const pt0 = localCoords(this.el, e.clientX, e.clientY);
        const ox = wObj.x;
        const oy = wObj.y;
        const ow = wObj.w;
        const oh = wObj.h;
        this.setBrowserPointerPassthrough(true);

        const onMove = (me) => {
          const mpt = localCoords(this.el, me.clientX, me.clientY);
          const dx = mpt.x - pt0.x;
          const dy = mpt.y - pt0.y;
          if (dir.includes('e')) wObj.w = Math.max(320, ow + dx);
          if (dir.includes('s')) wObj.h = Math.max(220, oh + dy);
          if (dir.includes('w')) {
            const nw = Math.max(320, ow - dx);
            wObj.x = ox + (ow - nw);
            wObj.w = nw;
          }
          this.applyWindowGeometry(wObj);
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          this.setBrowserPointerPassthrough(false);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
      winEl.appendChild(rh);
    }

    winEl.append(titlebar, body);
    wObj.el = winEl;
    wObj.titleEl = titleEl;

    this.windows.push(wObj);
    this.windowsLayer.appendChild(winEl);
    this.focusWindow(wObj.id);
    this.applyWindowGeometry(wObj);
  }

  setBrowserPointerPassthrough(active) {
    for (const s of document.querySelectorAll('.browser-stage')) {
      s.style.pointerEvents = active ? 'none' : '';
    }
  }

  applyWindowGeometry(wObj) {
    if (!wObj.el) return;
    const dw = this.el.clientWidth || 1440;
    const dh = (this.el.clientHeight || 900) - 44;
    if (wObj.state === 'maximized') {
      wObj.x = 0;
      wObj.y = 0;
      wObj.w = dw;
      wObj.h = dh;
    }
    wObj.el.style.left = `${Math.round(wObj.x)}px`;
    wObj.el.style.top = `${Math.round(wObj.y)}px`;
    wObj.el.style.width = `${Math.round(wObj.w)}px`;
    wObj.el.style.height = `${Math.round(wObj.h)}px`;
  }

  snapWindowHalf(winId, side) {
    const wObj = this.windows.find((w) => w.id === winId);
    if (!wObj) return;
    const dw = this.el.clientWidth || 1440;
    const dh = (this.el.clientHeight || 900) - 44;
    if (!wObj.restoreRect) {
      wObj.restoreRect = { x: wObj.x, y: wObj.y, w: wObj.w, h: wObj.h };
    }
    wObj.state = 'normal';
    wObj.y = 0;
    wObj.h = dh;
    wObj.w = Math.floor(dw / 2);
    wObj.x = side === 'left' ? 0 : dw - wObj.w;
    this.applyWindowGeometry(wObj);
    this.syncWindowLayers();
  }

  focusWindow(winId) {
    const idx = this.windows.findIndex((w) => w.id === winId);
    if (idx < 0) return;
    const wObj = this.windows[idx];
    if (wObj.state === 'minimized') return;
    this.windows.splice(idx, 1);
    this.windows.push(wObj);
    this.focusedWinId = winId;
    this.syncWindowLayers();
  }

  minimizeWindow(winId) {
    const wObj = this.windows.find((w) => w.id === winId);
    if (!wObj) return;
    wObj.state = 'minimized';
    if (this.focusedWinId === winId) {
      this.pickTopVisibleFocus();
    }
    this.syncWindowLayers();
  }

  toggleMaximizeWindow(winId) {
    const wObj = this.windows.find((w) => w.id === winId);
    if (!wObj) return;
    if (wObj.state === 'maximized') {
      wObj.state = 'normal';
      if (wObj.restoreRect) {
        wObj.x = wObj.restoreRect.x;
        wObj.y = wObj.restoreRect.y;
        wObj.w = wObj.restoreRect.w;
        wObj.h = wObj.restoreRect.h;
      }
    } else {
      wObj.restoreRect = { x: wObj.x, y: wObj.y, w: wObj.w, h: wObj.h };
      wObj.state = 'maximized';
    }
    this.focusWindow(winId);
    this.applyWindowGeometry(wObj);
  }

  pickTopVisibleFocus() {
    for (let i = this.windows.length - 1; i >= 0; i--) {
      if (this.windows[i].state !== 'minimized') {
        this.focusedWinId = this.windows[i].id;
        return;
      }
    }
    this.focusedWinId = null;
  }

  requestCloseRootSubsystem(childSysId) {
    const wObj = this.windows.find((w) => w.appId === 'subsystem' && w.childSysId === childSysId);
    if (wObj) {
      this.requestCloseWindow(wObj.id);
    } else {
      this.runtime.closeSubsystem(childSysId);
    }
  }

  requestCloseWindow(winId) {
    const wObj = this.windows.find((w) => w.id === winId);
    if (!wObj) return;

    if (wObj.appId === 'subsystem' && wObj.childSysId) {
      const m = this.runtime.systems.get(wObj.childSysId);
      if (m && m.state !== 'stopped') {
        this.modalBackdrop.classList.remove('hidden');
        this.modalBackdrop.innerHTML = `
          <div class="os-modal-card">
            <div class="os-modal-title">确认关闭子系统窗口</div>
            <div class="os-modal-msg">关闭此窗口将停止直属子系统 ${wObj.childSysId} 及其整棵后代子树内的全部程序（已保存文件与快照保留）。是否继续？</div>
            <div class="os-modal-actions">
              <button type="button" class="btn" data-act="cancel">取消</button>
              <button type="button" class="btn btn-danger" data-act="ok">停止子树并关闭</button>
            </div>
          </div>
        `;
        this.modalBackdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => {
          this.modalBackdrop.classList.add('hidden');
        });
        this.modalBackdrop.querySelector('[data-act="ok"]').addEventListener('click', () => {
          this.modalBackdrop.classList.add('hidden');
          this.runtime.closeSubsystem(wObj.childSysId);
          this.forceCloseWindow(winId);
        });
        return;
      }
    }

    if (wObj.appId === 'spreadsheet' && wObj.ctrl && wObj.ctrl.requestClose) {
      wObj.ctrl.requestClose(() => this.forceCloseWindow(winId));
      return;
    }

    if (wObj.appId === 'projection' && wObj.projKey) {
      this.runtime.closeProjectionWindowOnly(wObj.projKey);
      this.forceCloseWindow(winId);
      return;
    }

    this.forceCloseWindow(winId);
  }

  forceCloseWindow(winId) {
    const idx = this.windows.findIndex((w) => w.id === winId);
    if (idx < 0) return;
    const [wObj] = this.windows.splice(idx, 1);
    if (wObj.ctrl && wObj.ctrl.destroy) wObj.ctrl.destroy();
    if (wObj.el) wObj.el.remove();
    if (this.focusedWinId === winId) {
      this.pickTopVisibleFocus();
    }
    this.syncWindowLayers();
  }

  closeAllWindowsForReset() {
    for (const w of [...this.windows]) {
      if (w.ctrl && w.ctrl.destroy) w.ctrl.destroy();
      if (w.el) w.el.remove();
    }
    this.windows = [];
    this.focusedWinId = null;
    this.nextWinSeq = 1;
    this.widgetsState = new RootWidgetsRuntimeState(this.runtime);
    this.closePopups();
    this.applyRootSettings();
    this.renderTaskbar();
  }

  syncWindowLayers() {
    this.windows.forEach((w, zIdx) => {
      const isFocused = this.focusedWinId === w.id && w.state !== 'minimized';
      w.el.className =
        'app-window' +
        (isFocused ? ' is-focused' : '') +
        (w.state === 'maximized' ? ' maximized' : '') +
        (w.state === 'minimized' ? ' minimized-preserve' : '');
      w.el.style.zIndex = String(20 + zIdx);
    });
    this.renderTaskbar();
  }

  renderTaskbar() {
    const sig = JSON.stringify(
      this.windows.map((w) => ({ id: w.id, t: w.title, s: w.state, f: this.focusedWinId === w.id, a: w.appId }))
    );
    if (this.lastTbSig === sig) return;
    this.lastTbSig = sig;

    this.tbCenter.innerHTML = '';
    for (const w of this.windows) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className =
        'taskbar-item' +
        (this.focusedWinId === w.id && w.state !== 'minimized' ? ' active' : '') +
        (w.state === 'minimized' ? ' minimized' : '');
      b.dataset.testid = 'taskbar-item';
      b.dataset.systemId = 'outer';
      b.dataset.windowId = w.id;
      b.setAttribute('aria-label', w.title);
      b.innerHTML = `<span class="tb-icon">${iconSvg(w.appId)}</span><span class="tb-title">${w.title}</span>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closePopups();
        if (w.state === 'minimized') {
          w.state = 'normal';
          this.focusWindow(w.id);
        } else if (this.focusedWinId === w.id) {
          this.minimizeWindow(w.id);
        } else {
          this.focusWindow(w.id);
        }
      });
      this.tbCenter.appendChild(b);
    }
  }

  updateClockAndTray() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;
    const clockHtml = `<div>${timeStr}</div><div style="font-size:10px;color:#94a3b8;">${dateStr}</div>`;
    if (this.lastClockHtml !== clockHtml) {
      this.lastClockHtml = clockHtml;
      this.clockEl.innerHTML = clockHtml;
    }

    const unread = this.runtime.root.notifications.filter((n) => n.unread).length;
    const notifHtml = `${iconSvg('bell')}${unread > 0 ? `<span class="notif-badge">${unread}</span>` : ''}`;
    if (this.lastNotifHtml !== notifHtml) {
      this.lastNotifHtml = notifHtml;
      this.btnNotif.innerHTML = notifHtml;
    }
  }

  // ==========================================================================
  // Per-Frame Update & Inspection Helpers
  // ==========================================================================

  tickFrame(realDtSec) {
    this.widgetsState.tick(realDtSec);
    this.reconcileRootProjections();

    for (const w of this.windows) {
      if (w.appId === 'subsystem' && w.childSysId) {
        const m = this.runtime.systems.get(w.childSysId);
        if (!m || m.state === 'stopped') {
          this.forceCloseWindow(w.id);
          continue;
        }
      }
      if (w.ctrl && w.ctrl.update) {
        w.ctrl.update();
      }
      if (w.state === 'maximized') {
        this.applyWindowGeometry(w);
      }
    }

    this.updateClockAndTray();
  }

  inspectBrowsers() {
    const out = [];
    for (const w of this.windows) {
      if (w.appId === 'browser' && w.ctrl && w.ctrl.getInspectRecords) {
        out.push(...w.ctrl.getInspectRecords());
      }
    }
    return out;
  }

  closeBrowserTabById(winId, tabId) {
    const w = this.windows.find((x) => x.id === winId && x.appId === 'browser');
    if (w && w.ctrl) w.ctrl.closeTab(tabId);
  }

  buildBenchInspection() {
    const systems = [];
    for (const s of this.runtime.systems.values()) {
      if (s.id !== 'outer' && s.state === 'stopped') continue;
      systems.push({
        id: s.id,
        parentId: s.parentId,
        name: s.name,
        state: s.state
      });
    }

    const windows = [];
    // Root windows
    for (const w of this.windows) {
      windows.push({
        id: w.id,
        systemId: 'outer',
        appId: w.appId,
        title: w.title,
        state: w.state
      });
    }
    // Subsystem windows + players + charts
    const players = [];
    const charts = [];
    for (const s of this.runtime.systems.values()) {
      if (s.id === 'outer' || s.state === 'stopped') continue;
      const pkt = s.lastPresent;
      if (!pkt || !pkt.desktop) continue;
      const surfaces = pkt.surfaces || {};
      for (const sw of pkt.desktop.windows || []) {
        windows.push({
          id: sw.id,
          systemId: s.id,
          appId: sw.appId,
          title: sw.title,
          state: sw.state
        });
        const surf = surfaces[sw.id];
        if (sw.appId === 'player' && surf) {
          players.push({
            windowId: sw.id,
            systemId: s.id,
            state: surf.state,
            position: Number(surf.position || 0),
            duration: Number(surf.duration || 15),
            rate: Number(surf.rate || 1),
            scene: surf.scenePath || '',
            frameTime: Number(surf.frameTime || 0)
          });
        } else if (sw.appId === 'charts' && surf) {
          charts.push({
            windowId: sw.id,
            systemId: s.id,
            sourceTitle: surf.sourceTitle || '',
            range: surf.range || '',
            chartType: surf.chartType || 'bar',
            connectionState: surf.connectionState || 'disconnected'
          });
        }
      }
      // Also include projections targeted at intermediate subsystems
      for (const p of this.runtime.projections.values()) {
        if (p.targetSysId === s.id) {
          windows.push({
            id: p.projWinId,
            systemId: s.id,
            appId: 'projection',
            title: p.title,
            state: p.state
          });
        }
      }
    }

    const projections = [];
    for (const p of this.runtime.projections.values()) {
      const rootW = p.targetSysId === 'outer' ? this.windows.find((w) => w.id === p.projWinId) : null;
      projections.push({
        windowId: p.projWinId,
        systemId: p.targetSysId,
        sourceSystemId: p.sourceSystemId,
        sourceWindowId: p.sourceWindowId,
        sourceAppId: p.sourceAppId,
        state: rootW ? rootW.state : p.state
      });
    }

    return {
      systems,
      windows,
      browsers: this.inspectBrowsers(),
      players,
      charts,
      projections
    };
  }
}
