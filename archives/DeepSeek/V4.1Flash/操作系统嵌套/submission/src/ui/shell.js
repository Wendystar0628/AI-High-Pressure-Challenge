// 桌面外壳：递归桌面、窗口、任务栏、开始菜单、通知、对话框与投送视图。
import { APPS, appDef } from '../apps/index.js';
import { rootWallpaper, innerWallpaper, accentForSystem, WALLPAPERS } from './wallpaper.js';
import { appIcon, uiIcon, fileIcon, folderIcon, APP_COLORS } from './icons.js';
import { el, $s, $all, esc, fmtBytes, fmtVirtualClock, fmtDuration, throttle, clamp, uid } from './common.js';
import * as FS from '../core/fs.js';

const TASKBAR_H = 46;
const ROOT_PINNED = ['files', 'spreadsheet', 'browser', 'widgets'];
const INNER_PINNED = ['files', 'player', 'charts', 'tasks'];
const OFFICIAL_LAUNCH = {
  root: ['files', 'spreadsheet', 'widgets', 'editor', 'browser', 'tasks', 'settings'],
  inner: ['files', 'editor', 'tasks', 'player', 'charts'],
};
const EXTRA_LAUNCH = { systems: 'launch-system-manager', help: 'launch-help' };

export class Shell {
  constructor(os) {
    this.os = os;
    this.desktops = new Map();
    this.views = new Map();
    this.rootMount = document.getElementById('root-mount');
    this.clockTimer = null;
    this.readyPromise = new Promise((res) => { this._readyResolve = res; });
    this._refreshTaskbar = throttle((sysId) => this.renderTaskbarFor(sysId), 60);
    this._refreshIcons = throttle((sysId) => this.renderIconsFor(sysId), 100);
    this._refreshStatus = throttle((sysId) => this.renderDesktopStatus(sysId), 80);
    this._geometry = [];
    this.activeDialogs = new Map();
  }

  async mount() {
    this.buildRoot();
    this.subscribeOS();
    this.bindGlobal();
    this.clockTimer = setInterval(() => this.updateClocks(), 500);
    window.addEventListener('resize', () => this.layoutRoot());
    this._readyResolve();
  }

  subscribeOS() {
    const os = this.os;
    os.on('window-created', ({ system, window }) => this.onWindowCreated(system, window));
    os.on('window-removed', ({ systemId, windowId }) => this.destroyWindowView(systemId, windowId, { silent: false, osRemoved: true }));
    os.on('window-updated', ({ window, systemId }) => {
      const view = this.views.get(window.id);
      if (view) this.applyWindowState(view);
      this._refreshTaskbar(systemId);
    });
    os.on('window-focused', ({ systemId, windowId }) => {
      const d = this.desktops.get(systemId);
      if (!d) return;
      for (const v of d.views || []) v.dom.classList.toggle('focused', v.win.id === windowId);
      const view = this.views.get(windowId);
      if (view) this.applyWindowState(view);
      this.applyWindowOrder(systemId);
      this._refreshTaskbar(systemId);
    });
    os.on('windows-order', ({ systemId }) => this.applyWindowOrder(systemId));
    os.on('window-refresh', ({ systemId }) => this._refreshTaskbar(systemId));
    os.on('system-updated', (sys) => {
      this.renderDesktopStatus(sys.id);
      this.updateSystemWindowTitles(sys.id);
      this._refreshTaskbar(sys.id);
      this.updateBadge(sys.id);
      this.updateTaskbarTray(sys.id);
    });
    os.on('system-created', ({ systemId }) => {
      const child = this.os.sysById(systemId);
      if (!child) return;
      this.openSystemWindow(systemId);
      setTimeout(() => this.maybeOpenDefaultPlayer(systemId), 30);
    });
    os.on('system-stopped', ({ systemId }) => {
      this.renderDesktopStatus(systemId);
      this.updateSystemWindowTitles(systemId);
      this._refreshTaskbar(systemId);
    });
    os.on('systems-restarted', ({ systemId, ids }) => {
      for (const id of ids) {
        this.destroyDesktopDom(id, { silent: true });
        const sw = this.os.findSystemWindow(id);
        if (sw) {
          this.destroyWindowView(sw.system.id, sw.window.id, { silent: true });
          this.createWindowView(sw.system, sw.window);
        }
      }
      this.openSystemWindow(systemId);
      setTimeout(() => this.maybeOpenDefaultPlayer(systemId), 60);
      this.renderIconsFor('outer');
    });
    os.on('before-subtree-restore', ({ ids }) => {
      for (const id of ids) this.destroyDesktopDom(id, { silent: true });
    });
    os.on('subtree-restored', ({ rootId, parentId, fork, ids }) => {
      if (fork) {
        this.openSystemWindow(rootId);
      } else {
        const sw = this.os.findSystemWindow(rootId);
        if (sw) {
          this.destroyWindowView(sw.system.id, sw.window.id, { silent: true });
          this.createWindowView(sw.system, sw.window);
        } else {
          this.openSystemWindow(rootId);
        }
      }
      // 刷新指向恢复子树的投送外框
      for (const s of this.os.systems.values()) {
        for (const w of [...s.windows]) {
          if (w.appId !== 'projection' || !ids.includes(w.sourceSystemId)) continue;
          const view = this.views.get(w.id);
          if (view) this.destroyWindowView(s.id, w.id, { silent: true });
          this.createWindowView(s, w);
        }
      }
      this._refreshTaskbar(parentId);
      this._refreshIcons('outer');
      this.toast(parentId, fork ? '分叉的子树已启动' : '子树已从快照恢复', 'success');
    });
    os.on('notification', (n) => {
      this.renderNotificationCenter(n.systemId);
      this.updateNotificationBadge(n.systemId);
    });
    os.on('notifications-updated', ({ systemId }) => {
      this.renderNotificationCenter(systemId);
      this.updateNotificationBadge(systemId);
    });
    os.on('toast', ({ systemId, text, kind }) => this.toast(systemId, text, kind));
    os.on('fs-changed', ({ systemId }) => {
      this._refreshIcons(systemId);
    });
    os.on('kernel-error', ({ systemId }) => {
      this.renderDesktopStatus(systemId);
      this.updateSystemWindowTitles(systemId);
    });
    os.on('process-updated', ({ systemId, pid }) => this.updateProcessCover(systemId, pid));
    os.on('process-ended', ({ systemId, pid }) => this.updateProcessCover(systemId, pid));
    os.on('process-error', ({ systemId, pid }) => this.updateProcessCover(systemId, pid));
    os.on('single-step', ({ systemId }) => {
      this.renderDesktopStatus(systemId);
      const d = this.desktops.get(systemId);
      if (d) this.toast(systemId, '已单步推进 0.05 秒', 'info');
    });
  }

  bindGlobal() {
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.start-menu') && !e.target.closest('[data-testid="start-toggle"]') &&
          !e.target.closest('.notif-center') && !e.target.closest('[data-testid="notifications-toggle"]') &&
          !e.target.closest('.context-menu')) {
        for (const d of this.desktops.values()) this.closeTransient(d);
      }
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        for (const d of this.desktops.values()) {
          if (!d.start.classList.contains('hidden') || !d.notif.classList.contains('hidden') || d.contextLayer.children.length) {
            this.closeTransient(d);
            e.stopPropagation();
          }
        }
        const openDialog = document.querySelector('.dialog-backdrop:not(.closing)');
        if (openDialog) {
          const cancel = openDialog.querySelector('[data-dialog-cancel]');
          if (cancel) cancel.click();
        }
      }
    }, true);
  }

  // ---------------- 桌面 ----------------

  buildRoot() {
    const sys = this.os.root;
    this.ensureDesktop(sys.id, this.rootMount);
  }

  ensureDesktop(sysId, host) {
    if (this.desktops.has(sysId)) return this.desktops.get(sysId);
    const sys = this.os.sysById(sysId);
    if (!sys || !host) return null;
    const accent = accentForSystem(sys);
    const root = el(`<div class="desktop ${sys.isRoot ? 'root-desktop' : 'inner-desktop'} depth-${sys.depth}" data-desktop data-testid="os-desktop" data-system-id="${sys.id}" data-depth="${sys.depth}" style="--accent:${accent}">
      <div class="wallpaper-wrap"></div>
      <div class="desktop-atmos"></div>
      <div class="ui-scaler">
        <div class="icons-area"></div>
        <div class="windows-layer"></div>
        <button class="layer-badge" data-testid="layer-badge" type="button" title="打开系统管理"></button>
        <div class="toast-zone"></div>
        <div class="taskbar" role="toolbar" aria-label="任务栏"></div>
        <div class="start-menu hidden" data-testid="start-menu" role="dialog" aria-label="开始菜单"></div>
        <div class="notif-center hidden" role="dialog" aria-label="通知中心"></div>
        <div class="context-layer"></div>
        <div class="dialog-layer"></div>
        <div class="status-overlay"></div>
      </div>
    </div>`);
    host.appendChild(root);
    const d = {
      sysId, sys, root, host,
      wallpaper: $s(root, '.wallpaper-wrap'),
      ui: $s(root, '.ui-scaler'),
      icons: $s(root, '.icons-area'),
      windows: $s(root, '.windows-layer'),
      badge: $s(root, '.layer-badge'),
      toasts: $s(root, '.toast-zone'),
      taskbar: $s(root, '.taskbar'),
      start: $s(root, '.start-menu'),
      notif: $s(root, '.notif-center'),
      contextLayer: $s(root, '.context-layer'),
      dialogLayer: $s(root, '.dialog-layer'),
      status: $s(root, '.status-overlay'),
      views: [],
      selected: null,
    };
    this.desktops.set(sysId, d);
    this.renderWallpaper(d);
    this.applyUIScale(d);
    this.renderIconsFor(sysId);
    this.buildStartMenu(d);
    this.renderTaskbarFor(sysId);
    this.renderNotificationCenter(sysId);
    this.renderDesktopStatus(sysId);
    this.updateBadge(sysId);
    // 挂载该桌面已有的窗口
    for (const win of [...sys.windows]) this.createWindowView(sys, win);
    this.bindDesktopEvents(d);
    const ro = new ResizeObserver(() => {
      if (sys.isRoot) this.applyUIScale(d);
      const w = d.root.clientWidth;
      d.root.classList.toggle('compact', w < 820);
      this.reflowDesktop(sysId);
    });
    ro.observe(root);
    d.root.classList.toggle('compact', root.clientWidth < 820);
    d.resizeObserver = ro;
    return d;
  }

  destroyDesktopDom(sysId, opts = {}) {
    const d = this.desktops.get(sysId);
    if (!d) return;
    for (const view of [...(d.views || [])]) {
      this.destroyWindowView(sysId, view.win.id, { silent: true, fromDesktopDestroy: true });
    }
    try { d.resizeObserver?.disconnect(); } catch { /* ignore */ }
    d.root.remove();
    this.desktops.delete(sysId);
  }

  renderWallpaper(d) {
    if (!d) return;
    const sys = this.os.sysById(d.sysId);
    if (!sys) return;
    if (sys.isRoot) {
      d.wallpaper.innerHTML = rootWallpaper(sys.settings.wallpaper);
    } else {
      d.wallpaper.innerHTML = innerWallpaper(sys, accentForSystem(sys));
    }
  }

  refreshWallpaper(sysId) {
    const d = this.desktops.get(sysId);
    if (!d) return;
    this.renderWallpaper(d);
    const accent = accentForSystem(this.os.sysById(sysId));
    d.root.style.setProperty('--accent', accent);
    for (const v of d.views) v.dom.style.setProperty('--accent', accent);
    this.renderTaskbarFor(sysId);
    this.updateBadge(sysId);
  }

  applyUIScale(d) {
    if (!d) return;
    const sys = this.os.sysById(d.sysId);
    if (!sys) return;
    if (!sys.isRoot) {
      d.ui.style.width = '100%';
      d.ui.style.height = '100%';
      d.ui.style.transform = 'none';
      return;
    }
    const scale = Math.max(0.8, Math.min(1.5, Number(sys.settings.scale) || 1));
    d.ui.style.width = `${100 / scale}%`;
    d.ui.style.height = `${100 / scale}%`;
    d.ui.style.transform = `scale(${scale})`;
  }

  layoutRoot() {
    const d = this.desktops.get('outer');
    if (!d) return;
    this.applyUIScale(d);
    this.reflowDesktop('outer');
  }

  bindDesktopEvents(d) {
    d.root.addEventListener('pointerdown', (e) => {
      const winEl = e.target.closest('[data-window-id]');
      if (winEl) {
        const winId = winEl.dataset.windowId;
        this.os.focusWindow(d.sysId, winId);
        // 只有点击发生在当前桌面（而非更深层桌面）时才改宿主焦点
        const deepest = e.target.closest('[data-desktop]');
        if (deepest === d.root) {
          const interactive = e.target.closest('input,textarea,select,[contenteditable="true"],button,a');
          if (!interactive) {
            const v = this.views.get(winId);
            setTimeout(() => { try { v?.dom.focus({ preventScroll: true }); } catch { /* ignore */ } }, 0);
          }
        }
      }
    }, true);
    d.root.addEventListener('contextmenu', (e) => {
      if (e.target.closest('[data-window-id]')) return;
      if (e.target.closest('.taskbar') || e.target.closest('.start-menu') || e.target.closest('.notif-center')) return;
      e.preventDefault();
      this.showDesktopContext(d, e.clientX, e.clientY);
    });
    d.badge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openAppById(d.sysId, 'systems');
    });
    d.root.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types?.includes('application/x-nested-os')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
    });
    d.root.addEventListener('drop', (e) => this.handleDesktopDrop(d, e));
    $s(d.root, '.start-menu')?.addEventListener('pointerdown', (e) => e.stopPropagation());
    $s(d.root, '.notif-center')?.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  renderIconsFor(sysId) {
    const d = this.desktops.get(sysId);
    if (!d) return;
    const sys = this.os.sysById(sysId);
    if (!sys) return;
    const icons = this.desktopIconDefs(sys);
    d.icons.innerHTML = '';
    for (const def of icons) {
      const iconEl = el(`<button class="desktop-icon ${d.selected === def.key ? 'selected' : ''}" type="button"
        data-testid="desktop-icon" data-icon-key="${esc(def.key)}"
        ${def.appId ? `data-app-id="${esc(def.appId)}"` : ''}
        ${def.path ? `data-file-path="${esc(def.path)}"` : ''}
        draggable="${def.path ? 'true' : 'false'}" title="${esc(def.label)}">
        ${def.appId ? appIcon(def.appId, { size: 48, cls: 'desktop-app-icon' }) : def.dir ? folderIcon(44) : fileIcon(def.name || '', 44)}
        <span class="desktop-icon-label">${esc(def.label)}</span>
      </button>`);
      iconEl.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        d.selected = def.key;
        for (const x of d.icons.children) x.classList.toggle('selected', x.dataset.iconKey === def.key);
      });
      iconEl.addEventListener('dblclick', () => this.activateIcon(sys, def));
      iconEl.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        this.showIconContext(sys, def, e.clientX, e.clientY);
      });
      if (def.path && !def.dir) {
        iconEl.addEventListener('dragstart', (e) => {
          const payload = JSON.stringify({ systemId: sys.id, path: def.path, name: def.name, kind: 'file' });
          e.dataTransfer.setData('application/x-nested-os', payload);
          e.dataTransfer.setData('text/plain', def.path);
          e.dataTransfer.effectAllowed = 'copy';
          iconEl.classList.add('dragging');
          this._dragPayload = payload;
        });
        iconEl.addEventListener('dragend', () => { iconEl.classList.remove('dragging'); this._dragPayload = null; });
      }
      d.icons.appendChild(iconEl);
    }
    d.root.classList.toggle('few-icons', icons.length <= 4);
  }

  desktopIconDefs(sys) {
    const apps = sys.isRoot
      ? ['files', 'spreadsheet', 'browser', 'widgets', 'editor', 'tasks', 'settings', 'systems', 'help']
      : ['files', 'player', 'charts', 'editor', 'tasks', 'systems', 'help'];
    const defs = apps.map((id) => ({
      key: 'app:' + id, appId: id, label: APPS[id]?.meta?.title || id,
    }));
    const shortcuts = [
      { key: 'file:/Demo/sample.sheet', path: '/Demo/sample.sheet', name: 'sample.sheet', label: '示例工作簿' },
      { key: 'file:/Demo/helicopter-24.scene', path: '/Demo/helicopter-24.scene', name: 'helicopter-24.scene', label: '24号机场景' },
    ];
    const desktopNode = FS.resolveNode(sys.fs, '/Desktop');
    const files = desktopNode && desktopNode.type === 'dir' ? desktopNode.children : [];
    for (const f of files) {
      defs.push({
        key: 'file:/Desktop/' + f.name, path: '/Desktop/' + f.name, name: f.name,
        dir: f.type === 'dir', label: f.name,
      });
    }
    // 同名快捷方式去重（桌面目录中的文件优先）
    const seen = new Set();
    for (const s of shortcuts) {
      if (!seen.has(s.path) && !defs.some((d) => d.path === s.path)) defs.push(s);
    }
    return defs;
  }

  activateIcon(sys, def) {
    if (def.appId) this.openAppById(sys.id, def.appId);
    else if (def.path) this.openPath(sys.id, def.path);
  }

  createDesktopNodeForFile(sys, parentPath, name) {
    if (!FS.resolveNode(sys.fs, parentPath)) {
      try { this.os.mkdir(sys.id, parentPath); } catch { /* ignore */ }
    }
    return parentPath;
  }

  showDesktopContext(d, x, y) {
    const sys = this.os.sysById(d.sysId);
    const items = [
      { label: '新建文件夹', icon: 'folder', action: async () => {
        const r = await this.dialog(sys.id, { title: '新建文件夹', fields: [{ name: 'name', label: '名称', value: '新建文件夹' }], okLabel: '创建' });
        if (!r) return;
        try {
          this.ensurePath(sys, '/Desktop');
          this.os.mkdir(sys.id, '/Desktop/' + (r.values.name || '新建文件夹'));
          this.os.notify(sys.id, { title: '已新建文件夹', body: r.values.name, kind: 'success' });
          this._refreshIcons(sys.id);
        } catch (err) { this.toast(sys.id, err.message, 'error'); }
      } },
      { label: '新建文本文档', icon: 'note', action: async () => {
        const r = await this.dialog(sys.id, { title: '新建文本文档', fields: [{ name: 'name', label: '文件名', value: '新建文本文档.txt' }, { name: 'content', label: '内容', type: 'textarea', value: '' }], okLabel: '创建' });
        if (!r) return;
        try {
          this.ensurePath(sys, '/Desktop');
          const name = r.values.name || '新建文本文档.txt';
          this.os.writeFile(sys.id, '/Desktop/' + name, r.values.content || '', { kind: 'text' });
          this._refreshIcons(sys.id);
          this.os.notify(sys.id, { title: '文件已创建', body: name, kind: 'success' });
        } catch (err) { this.toast(sys.id, err.message, 'error'); }
      }, separatorBefore: true },
      { label: '打开文件管理器', icon: 'files', action: () => this.openAppById(sys.id, 'files') },
      { label: '显示设置', icon: 'settings', action: () => this.openAppById(sys.id, 'settings'), hidden: !sys.isRoot },
      { label: '操作说明', icon: 'help', action: () => this.openAppById(sys.id, 'help') },
      { label: '刷新', icon: 'reload', action: () => this._refreshIcons(sys.id) },
    ];
    if (sys.depth < 8) items.push({ label: '新建直属子系统', icon: 'plus', action: () => this.createSubsystem(sys.id), separatorBefore: true });
    this.contextMenu(sys.id, x, y, items);
  }

  async showIconContext(sys, def, x, y) {
    const items = [{ label: '打开', icon: def.appId ? def.appId : 'chevron', action: () => this.activateIcon(sys, def) }];
    if (def.path) {
      items.push({ label: '打开所在文件夹', icon: 'folder', action: () => this.openFilesAt(sys.id, FS.parentPath(def.path)) });
      items.push({ label: '复制', icon: 'copy', action: () => this.os.addClipboard(JSON.stringify({ systemId: sys.id, path: def.path, action: 'copy' }), { kind: 'file', systemId: sys.id, path: def.path }) });
      items.push({ label: '重命名', icon: 'rename', action: async () => {
        const r = await this.dialog(sys.id, { title: '重命名', fields: [{ name: 'name', label: '新名称', value: FS.baseName(def.path) }], okLabel: '重命名' });
        if (!r) return;
        try {
          const from = def.path, to = FS.joinPath(FS.parentPath(from), r.values.name);
          const node = FS.resolveNode(sys.fs, from);
          const parent = FS.resolveNode(sys.fs, FS.parentPath(to));
          if (!node || !parent) throw new Error('路径无效');
          if (node && sys.policies.fsPolicy === 'readonly') throw new Error('内核文件策略为只读');
          if (FS.resolveNode(sys.fs, to) && to !== from) throw new Error('同名文件已存在');
          parent.children.push(node);
          const fromParent = FS.resolveNode(sys.fs, FS.parentPath(from));
          fromParent.children = fromParent.children.filter((c) => c !== node);
          node.name = FS.baseName(to);
          this.os.emit('fs-changed', { systemId: sys.id });
          this._refreshIcons(sys.id);
        } catch (err) { this.toast(sys.id, err.message, 'error'); }
      } });
      items.push({ label: '删除', icon: 'trash', danger: true, action: async () => {
        const node = FS.resolveNode(sys.fs, def.path);
        if (!node) return;
        const ok = await this.dialog(sys.id, { title: '删除到回收站', message: `确定删除“${FS.baseName(def.path)}”？可以从回收站恢复。`, buttons: [{ label: '取消', value: null }, { label: '删除', value: 'yes', danger: true, primary: true }] });
        if (!ok) return;
        try { this.os.deleteToTrash(sys.id, def.path); this._refreshIcons(sys.id); }
        catch (err) { this.toast(sys.id, err.message, 'error'); }
      } });
      items.push({ separatorBefore: true, label: '属性', icon: 'info', action: () => {
        const node = FS.resolveNode(sys.fs, def.path);
        if (!node) return;
        this.dialog(sys.id, { title: '属性', message: `名称：${node.name}\n路径：${def.path}\n类型：${node.type === 'dir' ? '文件夹' : (node.name.split('.').pop() || '文件')}\n大小：${fmtBytes(FS.fileSize(node))}\n修改时间：${new Date(node.updatedAt || node.createdAt).toLocaleString('zh-CN')}`, buttons: [{ label: '关闭', value: 'ok', primary: true }] });
      } });
    }
    if (def.appId) {
      const pinned = (sys.isRoot ? ROOT_PINNED : INNER_PINNED).includes(def.appId);
      if (!pinned) items.push({ label: '固定到任务栏', icon: 'plus', action: () => this.pinApp(sys.id, def.appId), separatorBefore: true });
    }
    this.contextMenu(sys.id, x, y, items);
  }

  pinApp(sysId, appId) {
    const sys = this.os.sysById(sysId);
    if (!sys) return;
    if (!sys.pinned) sys.pinned = [...(sys.isRoot ? ROOT_PINNED : INNER_PINNED)];
    if (!sys.pinned.includes(appId)) sys.pinned.push(appId);
    this.renderTaskbarFor(sysId);
    this.os.notify(sysId, { title: '已固定到任务栏', body: APPS[appId]?.meta?.title || appId, kind: 'info' });
  }

  ensurePath(sys, path) {
    if (!FS.resolveNode(sys.fs, path)) {
      try { this.os.mkdir(sys.id, path); } catch { /* nested create */ }
    }
  }

  handleDesktopDrop(d, e) {
    e.preventDefault();
    let payload = this._dragPayload;
    try {
      const raw = e.dataTransfer.getData('application/x-nested-os');
      if (raw) payload = raw;
    } catch { /* ignore */ }
    if (!payload) return;
    try {
      const p = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (!p.systemId || !p.path) return;
      const destDir = '/Desktop';
      this.ensurePath(this.os.sysById(d.sysId), destDir);
      const res = this.os.copyFileCross(p.systemId, p.path, d.sysId, destDir, {});
      if (res.ok) this._refreshIcons(d.sysId);
      else this.toast(d.sysId, res.error || '传递失败', 'error');
    } catch (err) { this.toast(d.sysId, String(err.message || err), 'error'); }
  }

  // ---------------- 任务栏 ----------------

  pinnedFor(sys) {
    if (sys.pinned) return sys.pinned;
    return sys.isRoot ? ROOT_PINNED : INNER_PINNED;
  }

  renderTaskbarFor(sysId) {
    const d = this.desktops.get(sysId);
    const sys = this.os.sysById(sysId);
    if (!d || !sys) return;
    const running = sys.windows;
    const pins = this.pinnedFor(sys).filter((id) => APPS[id]);
    const unread = sys.notifications.filter((n) => !n.read).length;
    const stateLabel = this.stateLabel(sys);
    d.taskbar.innerHTML = `
      <button class="start-button" type="button" data-testid="start-toggle" aria-label="开始">
        <span class="nest-logo">${uiIcon('grid')}</span>
        <span class="start-button-label">开始</span>
      </button>
      <div class="taskbar-divider"></div>
      <div class="taskbar-pins">
        ${pins.map((id) => `<button type="button" class="taskbar-pin" data-pin-app="${id}" aria-label="打开${esc(APPS[id].meta.title)}" title="${esc(APPS[id].meta.title)}">${appIcon(id, { size: 27 })}<span class="pin-dot"></span></button>`).join('')}
      </div>
      <div class="taskbar-tasks">
        ${running.map((w) => this.taskbarItemHtml(sys, w)).join('')}
      </div>
      <div class="taskbar-tray">
        <button type="button" class="tray-action tray-new" data-testid="system-new" data-system-id="${sys.id}" aria-label="新建直属子系统" title="新建直属子系统">
          ${uiIcon('plus')}<span class="tray-new-label">子系统</span>
        </button>
        <button type="button" class="tray-action tray-systems" data-testid="system-tray" data-app-id="systems" data-system-id="${sys.id}" title="系统信息 · ${esc(stateLabel)}" aria-label="系统信息">
          <span class="tray-sys-dot state-${sys.state}"></span>
          <span class="tray-sys-name">${esc(sys.name)}</span>
          <span class="tray-L">L${sys.depth + 1}</span>
        </button>
        ${sys.isRoot ? `<button type="button" class="tray-action tray-widgets" data-testid="widgets-toggle" data-system-id="${sys.id}" title="小组件面板" aria-label="小组件面板">${uiIcon('widgets')}</button>` : ''}
        <button type="button" class="tray-action tray-bell" data-testid="notifications-toggle" data-system-id="${sys.id}" title="通知中心" aria-label="通知中心">
          ${uiIcon('bell')}${unread ? `<span class="tray-badge">${unread > 9 ? '9+' : unread}</span>` : ''}
        </button>
        <div class="tray-clock" title="系统虚拟时钟">
          <span class="tray-time">${fmtVirtualClock(sys.clock)}</span>
          <span class="tray-date">${new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span>
        </div>
      </div>`;
    $s(d.taskbar, '[data-testid="start-toggle"]').addEventListener('click', (e) => { e.stopPropagation(); this.toggleStart(d); });
    for (const pin of $all(d.taskbar, '.taskbar-pin')) {
      pin.addEventListener('click', (e) => { e.stopPropagation(); this.openAppById(sys.id, pin.dataset.pinApp); });
    }
    for (const item of $all(d.taskbar, '.taskbar-item')) {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const win = sys.windows.find((w) => w.id === item.dataset.windowId);
        if (!win) return;
        if (win.state === 'minimized') { this.os.focusWindow(sys.id, win.id); this.applyWindowState(this.views.get(win.id)); }
        else if (sys.focusId === win.id && !e.shiftKey) this.os.minimizeWindow(sys.id, win.id);
        else this.os.focusWindow(sys.id, win.id);
      });
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        const win = sys.windows.find((w) => w.id === item.dataset.windowId);
        if (win) this.showWindowContext(sys, win, e.clientX, e.clientY);
      });
    }
    $s(d.taskbar, '[data-testid="system-new"]').addEventListener('click', (e) => { e.stopPropagation(); this.createSubsystem(sys.id); });
    $s(d.taskbar, '[data-testid="system-tray"]').addEventListener('click', (e) => { e.stopPropagation(); this.openAppById(sys.id, 'systems'); });
    $s(d.taskbar, '[data-testid="widgets-toggle"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const existing = sys.windows.find((w) => w.appId === 'widgets');
      if (existing) {
        if (existing.state === 'minimized') { this.os.focusWindow(sys.id, existing.id); this.applyWindowState(this.views.get(existing.id)); }
        else this.os.closeWindow(sys.id, existing.id);
      } else this.openAppById(sys.id, 'widgets');
    });
    $s(d.taskbar, '[data-testid="notifications-toggle"]').addEventListener('click', (e) => { e.stopPropagation(); this.toggleNotifications(d); });
  }

  taskbarItemHtml(sys, w) {
    const active = sys.focusId === w.id && w.state !== 'minimized';
    const meta = APPS[w.appId]?.meta;
    const icon = w.appId === 'system' ? appIcon('systems', { size: 20 }) : (w.appId === 'projection' ? appIcon('projection', { size: 20 }) : appIcon(w.appId, { size: 20 }));
    const stateCls = w.state === 'minimized' ? 'minimized' : active ? 'active' : '';
    const sysChild = w.appId === 'system' ? this.os.sysById(w.props?.childId) : null;
    const status = sysChild ? `<span class="taskbar-item-state state-${sysChild.state}"></span>` : '';
    return `<button type="button" class="taskbar-item ${stateCls}" data-testid="taskbar-item" data-window-id="${w.id}" data-system-id="${sys.id}" title="${esc(w.title)}">
      ${icon}<span class="taskbar-item-title">${esc(w.title)}</span>${status}
    </button>`;
  }

  updateTaskbarTray(sysId) {
    const d = this.desktops.get(sysId);
    if (!d) return;
    const sys = this.os.sysById(sysId);
    if (!sys) return;
    const nameEl = $s(d.taskbar, '.tray-sys-name');
    if (nameEl) nameEl.textContent = sys.name;
    const dot = $s(d.taskbar, '.tray-sys-dot');
    if (dot) dot.className = `tray-sys-dot state-${sys.state}${sys.selfPaused ? ' paused' : ''}`;
    const unread = sys.notifications.filter((n) => !n.read).length;
    const bell = $s(d.taskbar, '.tray-bell');
    if (bell) {
      let badge = $s(bell, '.tray-badge');
      if (unread) {
        if (!badge) { badge = el('<span class="tray-badge"></span>'); bell.appendChild(badge); }
        badge.textContent = unread > 9 ? '9+' : String(unread);
      } else badge?.remove();
    }
  }

  updateNotificationBadge(sysId) {
    this.updateTaskbarTray(sysId);
    if (sysId === 'outer') {
      document.querySelectorAll('[data-notif-root-badge]').forEach((el) => el.remove());
    }
  }

  updateClocks() {
    for (const [sysId, d] of this.desktops) {
      const sys = this.os.sysById(sysId);
      if (!sys) continue;
      const t = $s(d.taskbar, '.tray-time');
      if (t) t.textContent = fmtVirtualClock(sys.clock);
      const date = $s(d.taskbar, '.tray-date');
      if (date) date.textContent = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
  }

  async createSubsystem(sysId) {
    const sys = this.os.sysById(sysId);
    if (!sys) return;
    if (sys.state !== 'running' || sys.selfPaused) { this.toast(sysId, '系统已暂停或未运行，无法创建子系统', 'error'); return; }
    try {
      this.os.createChildSystem(sysId);
    } catch (err) { this.toast(sysId, String(err.message || err), 'error'); }
  }

  // ---------------- 开始菜单 ----------------

  appsFor(sys) {
    return Object.entries(APPS).filter(([, app]) => {
      if (!app.meta) return false;
      if (sys.isRoot) return !app.meta.innerOnly;
      return !app.meta.rootOnly;
    }).map(([id, app]) => ({ id, ...app.meta }));
  }

  buildStartMenu(d) {
    const sys = d.sys;
    const apps = this.appsFor(sys).filter((a) => !['system', 'projection'].includes(a.id));
    const official = new Set(sys.isRoot ? OFFICIAL_LAUNCH.root : OFFICIAL_LAUNCH.inner);
    const tile = (a) => {
      let testid = official.has(a.id) ? `launch-${a.id}` : (EXTRA_LAUNCH[a.id] || `launch-${a.id}`);
      return `<button type="button" class="start-app" data-testid="${testid}" data-start-app="${a.id}" data-system-id="${sys.id}">
        ${appIcon(a.id, { size: 42 })}
        <span class="start-app-meta"><b>${esc(a.title)}</b><i>${esc(a.desc || '')}</i></span>
      </button>`;
    };
    d.start.innerHTML = `
      <div class="start-head">
        <div class="start-user">
          <span class="start-avatar">${sys.isRoot ? 'N' : 'L' + sys.depth}</span>
          <div><b>${esc(sys.isRoot ? sys.settings.name : sys.name)}</b><span>${sys.isRoot ? '根系统 · outer' : `第 ${sys.depth} 层 · ${sys.name}`}</span></div>
        </div>
        <span class="start-state state-${sys.state}">${this.stateLabel(sys)}</span>
      </div>
      <label class="start-search">
        ${uiIcon('search')}
        <input type="text" placeholder="搜索应用、文件或系统功能" aria-label="搜索" autocomplete="off">
      </label>
      <div class="start-body">
        <div class="start-main">
          <div class="start-section-title"><span>应用</span><span class="start-hint">${apps.length} 个</span></div>
          <div class="start-apps">${apps.map(tile).join('')}</div>
          <div class="start-results"></div>
        </div>
        <aside class="start-side">
          ${sys.isRoot ? `<div class="start-side-card">
            <div class="side-card-title">快速设置</div>
            <div class="quick-toggles">
              <button type="button" class="quick-toggle ${this.os.rootState.widgets.quick.wifi ? 'on' : ''}" data-quick="wifi">${uiIcon('wifi')}<span>网络</span></button>
              <button type="button" class="quick-toggle ${this.os.rootState.widgets.quick.bluetooth ? 'on' : ''}" data-quick="bluetooth">${uiIcon('bluetooth')}<span>蓝牙</span></button>
              <button type="button" class="quick-toggle ${this.os.rootState.widgets.quick.night ? 'on' : ''}" data-quick="night">${uiIcon('moon')}<span>夜间</span></button>
            </div>
          </div>` : `<div class="start-side-card">
            <div class="side-card-title">本系统</div>
            <div class="mini-kv"><span>标识</span><b>${esc(sys.id)}</b></div>
            <div class="mini-kv"><span>层级</span><b>L${sys.depth + 1}</b></div>
            <div class="mini-kv"><span>虚拟时钟</span><b class="start-clock">${fmtVirtualClock(sys.clock)}</b></div>
            <button type="button" class="mini-link" data-start-open="systems">系统管理 ${uiIcon('chevron')}</button>
          </div>`}
          <div class="start-side-card">
            <div class="side-card-title">系统</div>
            <button type="button" class="side-link" data-start-open="systems">${uiIcon('systems')} 系统管理</button>
            <button type="button" class="side-link" data-start-open="help">${uiIcon('help')} 操作说明</button>
            <button type="button" class="side-link" data-start-open="tasks">${uiIcon('tasks')} 任务与进程</button>
          </div>
        </aside>
      </div>
      <div class="start-foot">
        <button type="button" class="start-foot-user">${uiIcon('shield')} NESTED OS · ${esc(sys.isRoot ? 'root' : 'nested')}</button>
        <button type="button" class="start-foot-action" data-start-open="settings" ${sys.isRoot ? '' : 'hidden'}>${uiIcon('settings')} 设置</button>
        <button type="button" class="start-foot-action" data-start-open="help">${uiIcon('help')} 帮助</button>
        <button type="button" class="start-foot-action" data-start-open="systems">${uiIcon('power')} 系统</button>
      </div>`;
    const search = $s(d.start, 'input');
    search.addEventListener('input', () => this.renderStartSearch(d, search.value));
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.toggleStart(d, false);
      if (e.key === 'Enter') {
        const first = $s(d.start, '.start-result-row');
        if (first) first.click();
      }
    });
    for (const btn of $all(d.start, '.start-app')) {
      btn.addEventListener('click', () => { this.toggleStart(d, false); this.openAppById(sys.id, btn.dataset.startApp); });
    }
    for (const btn of $all(d.start, '[data-start-open]')) {
      btn.addEventListener('click', () => { this.toggleStart(d, false); this.openAppById(sys.id, btn.dataset.startOpen); });
    }
    for (const q of $all(d.start, '[data-quick]')) {
      q.addEventListener('click', () => {
        const key = q.dataset.quick;
        const state = this.os.rootState.widgets;
        if (key === 'night') state.quick.night = !state.quick.night;
        else state.quick[key] = !state.quick[key];
        if (key === 'night') document.documentElement.classList.toggle('night-mode', state.quick.night);
        q.classList.toggle('on');
        this.os.scheduleSave?.();
        this.os.emit('notification', { systemId: 'outer', title: '快捷设置', body: '设置已更新', kind: 'info' });
      });
    }
  }

  renderStartSearch(d, query) {
    const results = $s(d.start, '.start-results');
    const apps = $s(d.start, '.start-apps');
    const q = query.trim().toLowerCase();
    if (!q) { results.innerHTML = ''; apps.style.display = ''; return; }
    apps.style.display = 'none';
    const sys = this.os.sysById(d.sysId);
    const appHits = this.appsFor(sys).filter((a) => (a.title + ' ' + (a.desc || '')).toLowerCase().includes(q) || a.id.includes(q)).slice(0, 5);
    const fileHits = [];
    const walk = (node, base, depth) => {
      if (!node || fileHits.length > 8 || depth > 4) return;
      for (const c of node.children || []) {
        const p = FS.joinPath(base, c.name);
        if (c.name.toLowerCase().includes(q)) fileHits.push({ node: c, path: p });
        if (c.type === 'dir') walk(c, p, depth + 1);
      }
    };
    walk(sys.fs, '/', 0);
    const rows = [
      ...appHits.map((a) => ({ icon: appIcon(a.id, { size: 26 }), title: a.title, sub: '应用', action: () => this.openAppById(sys.id, a.id) })),
      ...fileHits.slice(0, 6).map((f) => ({ icon: f.node.type === 'dir' ? folderIcon(26) : fileIcon(f.node.name, 26), title: f.node.name, sub: f.path, action: () => this.openPath(sys.id, f.path) })),
    ];
    results.innerHTML = rows.length ? rows.map((r, i) => `<button type="button" class="start-result-row" data-start-result="${i}" data-testid="start-result">${r.icon}<span><b>${esc(r.title)}</b><i>${esc(r.sub)}</i></span></button>`).join('') : '<div class="start-empty">没有找到匹配项</div>';
    for (const row of $all(results, '.start-result-row')) {
      row.addEventListener('click', () => {
        const r = rows[Number(row.dataset.startResult)];
        this.toggleStart(d, false);
        r?.action();
      });
    }
  }

  toggleStart(d, force) {
    const willOpen = force === undefined ? d.start.classList.contains('hidden') : force;
    if (willOpen) {
      this.closeTransient(d);
      d.start.classList.remove('hidden');
      d.start.classList.add('opening');
      const input = $s(d.start, 'input');
      setTimeout(() => input?.focus(), 30);
    } else {
      d.start.classList.add('hidden');
    }
  }

  toggleNotifications(d) {
    const willOpen = d.notif.classList.contains('hidden');
    if (willOpen) {
      this.closeTransient(d);
      d.notif.classList.remove('hidden');
      this.renderNotificationCenter(d.sysId);
      const sys = this.os.sysById(d.sysId);
      setTimeout(() => this.os.markNotificationsRead(d.sysId), 500);
    } else d.notif.classList.add('hidden');
  }

  closeTransient(d) {
    d.start.classList.add('hidden');
    d.notif.classList.add('hidden');
    d.contextLayer.innerHTML = '';
  }

  renderNotificationCenter(sysId) {
    const d = this.desktops.get(sysId);
    const sys = this.os.sysById(sysId);
    if (!d || !sys) return;
    const notes = sys.notifications.slice().reverse();
    const dnd = sys.isRoot ? this.os.rootState.widgets.dnd : false;
    d.notif.innerHTML = `
      <div class="notif-head"><div><b>通知中心</b><span>${sys.name} · ${notes.length} 条</span></div>
        <div class="notif-actions">
          <button type="button" class="notif-dnd ${dnd ? 'on' : ''}" data-notif-dnd title="免打扰">${uiIcon('moon')}<span>${dnd ? '免打扰' : '通知'}</span></button>
          <button type="button" class="icon-button" data-notif-close aria-label="关闭">${uiIcon('close')}</button>
        </div>
      </div>
      <div class="notif-list">
        ${notes.length ? notes.map((n) => `<div class="notif-item kind-${esc(n.kind)} ${n.read ? '' : 'unread'}" data-testid="notification-item">
          <span class="notif-icon">${uiIcon(n.kind === 'error' ? 'warning' : n.kind === 'success' ? 'success' : 'bell')}</span>
          <div><b>${esc(n.title)}</b><p>${esc(n.body)}</p><span>${fmtVirtualClock(n.at)} · ${esc(n.appId || '系统')}</span></div>
        </div>`).join('') : '<div class="notif-empty">暂无通知<br><span>倒计时、文件操作与系统事件会出现在这里</span></div>'}
      </div>
      <div class="notif-foot">
        <button type="button" class="ghost-button" data-notif-clear>清空</button>
        <button type="button" class="ghost-button" data-notif-openwidgets>${uiIcon('widgets')} 小组件</button>
      </div>`;
    $s(d.notif, '[data-notif-close]')?.addEventListener('click', () => d.notif.classList.add('hidden'));
    $s(d.notif, '[data-notif-dnd]')?.addEventListener('click', () => {
      this.os.rootState.widgets.dnd = !this.os.rootState.widgets.dnd;
      this.renderNotificationCenter(sysId);
      this.os.scheduleSave?.();
    });
    $s(d.notif, '[data-notif-clear]')?.addEventListener('click', () => {
      sys.notifications = [];
      if (sys.isRoot) this.os.rootState.notifications = sys.notifications;
      this.renderNotificationCenter(sysId);
      this.os.emit('notifications-updated', { systemId: sysId });
    });
    $s(d.notif, '[data-notif-openwidgets]')?.addEventListener('click', () => {
      d.notif.classList.add('hidden');
      this.openAppById(sysId, 'widgets');
    });
  }

  // ---------------- 状态与徽标 ----------------

  stateLabel(sys) {
    if (sys.state === 'kernel-error') return '内核错误';
    if (sys.selfPaused || sys.state === 'paused') return '已暂停';
    if (sys.state === 'stopped') return '已关闭';
    if (sys.state === 'booting') return '启动中';
    if (sys.state === 'running') return '运行中';
    return sys.state;
  }

  updateBadge(sysId) {
    const d = this.desktops.get(sysId);
    const sys = this.os.sysById(sysId);
    if (!d || !sys) return;
    const paused = this.os.isEffectivelyPaused(sysId) && sys.state !== 'stopped';
    d.badge.innerHTML = `<span class="badge-dot state-${sys.state}"></span>
      <span class="badge-L">L${sys.depth + 1}</span>
      <span class="badge-name">${esc(sys.isRoot ? 'outer' : sys.name)}</span>
      <span class="badge-state">${paused ? '已暂停' : this.stateLabel(sys)}</span>
      ${sys.isRoot ? '<span class="badge-root">ROOT</span>' : ''}`;
    d.badge.classList.toggle('paused', paused);
  }

  renderDesktopStatus(sysId) {
    const d = this.desktops.get(sysId);
    const sys = this.os.sysById(sysId);
    if (!d || !sys) return;
    d.root.dataset.state = sys.state;
    d.root.classList.toggle('is-paused', sys.selfPaused || sys.state === 'paused');
    d.root.classList.toggle('is-stopped', sys.state === 'stopped');
    d.root.classList.toggle('is-error', sys.state === 'kernel-error');
    if (sys.isRoot) { d.status.innerHTML = ''; this.updateBadge(sysId); return; }
    if (sys.state === 'kernel-error') {
      d.status.innerHTML = `<div class="fatal-cover" data-testid="kernel-error">
        <div class="fatal-card">
          <div class="fatal-badge">${uiIcon('warning')} KERNEL FAULT</div>
          <h2>${esc(sys.name)} 内核错误</h2>
          <p>${esc(sys.kernelError || '内核程序异常停止')}</p>
          <div class="fatal-meta"><span>层级 L${sys.depth + 1}</span><span>虚拟时钟 ${sys.clock.toFixed(2)}s</span><span>父系统正常</span></div>
          <div class="fatal-actions">
            <button type="button" class="primary-button" data-testid="system-restart" data-target-system-id="${sys.id}">${uiIcon('restart')} 重启并重载内核</button>
            <button type="button" class="ghost-button" data-testid="kernel-open" data-target-system-id="${sys.id}">${uiIcon('program')} 打开内核源文件</button>
          </div>
          <div class="fatal-hint">修复父系统中的 <code>${esc(sys.kernelPath || '')}</code> 后重启。父系统与兄弟系统不受影响。</div>
        </div>
      </div>`;
    } else if (sys.state === 'stopped') {
      d.status.innerHTML = `<div class="fatal-cover stopped-cover">
        <div class="fatal-card">
          <div class="fatal-badge muted">${uiIcon('power')} SYSTEM STOPPED</div>
          <h2>${esc(sys.name)} 已关闭</h2>
          <p>所有进程已结束，文件与快照保留在父系统中。</p>
          <div class="fatal-actions">
            <button type="button" class="primary-button" data-testid="system-restart" data-target-system-id="${sys.id}">${uiIcon('restart')} 重新启动</button>
          </div>
        </div>
      </div>`;
    } else if (sys.selfPaused || sys.state === 'paused') {
      d.status.innerHTML = `<div class="paused-banner">
        <span class="pulse-dot"></span><b>整棵子树已暂停</b>
        <span>时钟、进程、消息与画面冻结 · 逻辑步 0.05s</span>
        <div class="paused-actions">
          <button type="button" class="small-button" data-testid="system-resume" data-target-system-id="${sys.id}">${uiIcon('resume')} 继续</button>
          <button type="button" class="small-button" data-testid="system-step" data-target-system-id="${sys.id}">${uiIcon('step')} 单步</button>
        </div>
      </div>`;
    } else {
      d.status.innerHTML = '';
    }
    if (d.status) {
      for (const btn of $all(d.status, '[data-testid="system-restart"]')) {
        btn.addEventListener('click', () => this.restartSystem(sys.id));
      }
      for (const btn of $all(d.status, '[data-testid="kernel-open"]')) {
        btn.addEventListener('click', () => this.openKernel(sys.id));
      }
      for (const btn of $all(d.status, '[data-testid="system-resume"]')) {
        btn.addEventListener('click', () => this.os.resumeSystem(sys.id));
      }
      for (const btn of $all(d.status, '[data-testid="system-step"]')) {
        btn.addEventListener('click', () => { const r = this.os.singleStep(sys.id); if (!r.ok) this.toast(sys.id, r.error, 'error'); });
      }
    }
    this.updateBadge(sysId);
  }

  async restartSystem(sysId) {
    const sys = this.os.sysById(sysId);
    if (!sys) return;
    const ok = await this.dialog(sys.parentId, {
      title: `重启 ${sys.name}？`,
      message: '将结束子树内全部进程，重新载入内核源文件与程序，并按保留的系统树结构从初始运行状态启动。已保存的文件保留。',
      buttons: [{ label: '取消', value: null }, { label: '重启', value: 'yes', primary: true }],
    });
    if (!ok) return;
    try {
      await this.os.restartSystem(sysId);
    } catch (err) { this.toast(sys.parentId, String(err.message || err), 'error'); }
  }

  openKernel(sysId) {
    const sys = this.os.sysById(sysId);
    if (!sys || sys.isRoot) return;
    const parent = this.os.sysById(sys.parentId);
    if (!parent) return;
    this.openPath(parent.id, sys.kernelPath);
  }

  updateSystemWindowTitles(sysId) {
    const sys = this.os.sysById(sysId);
    if (!sys || sys.isRoot) return;
    const sw = this.os.findSystemWindow(sysId);
    if (!sw) return;
    const { window } = sw;
    const stateText = this.stateLabel(sys);
    const newTitle = `${sys.name} · 子系统`;
    if (window.title !== newTitle) window.title = newTitle;
    const view = this.views.get(window.id);
    if (view) {
      const t = $s(view.dom, '.win-title');
      if (t) t.textContent = newTitle;
      const chip = $s(view.dom, '.win-system-chip');
      if (chip) { chip.textContent = `L${sys.depth + 1} · ${stateText}`; chip.dataset.state = sys.state; }
      view.dom.classList.toggle('sys-paused', !!sys.selfPaused);
      view.dom.classList.toggle('sys-error', sys.state === 'kernel-error');
    }
    this._refreshTaskbar(sw.system.id);
  }

  // ---------------- 窗口 ----------------

  windowSizeFor(sys, appId, opts = {}) {
    const d = this.desktops.get(sys.id);
    const dw = d?.ui.clientWidth || (sys.isRoot ? window.innerWidth : 1000);
    const dh = d?.ui.clientHeight || (sys.isRoot ? window.innerHeight : 700);
    const meta = APPS[appId]?.meta || { width: 860, height: 560 };
    const w = Math.min(opts.width || meta.width || 860, Math.max(320, dw - 24));
    const h = Math.min(opts.height || meta.height || 560, Math.max(220, dh - TASKBAR_H - 20));
    return { w, h, dw, dh };
  }

  openAppById(sysId, appId, opts = {}) {
    const sys = this.os.sysById(sysId);
    if (!sys) return null;
    const app = APPS[appId];
    if (!app) return null;
    if (sys.isRoot && app.meta?.innerOnly) { this.toast(sysId, '该应用只存在于子系统桌面', 'warn'); return null; }
    if (!sys.isRoot && app.meta?.rootOnly) { this.toast(sysId, '该应用由根系统提供', 'warn'); return null; }
    if (!this.desktops.has(sysId)) {
      if (!sys.isRoot) this.openSystemWindow(sysId);
      if (!this.desktops.has(sysId)) return null;
    }
    const { w, h, dw, dh } = this.windowSizeFor(sys, appId, opts);
    const win = this.os.openApp(sysId, appId, {
      title: opts.title || app.meta.title, width: w, height: h, desktopW: dw, desktopH: dh,
      props: opts.props || {}, data: opts.data || {}, minW: app.meta.minW, minH: app.meta.minH,
    });
    return win;
  }

  openFilesAt(sysId, path) {
    const sys = this.os.sysById(sysId);
    if (!sys) return;
    const existing = sys.windows.find((w) => w.appId === 'files');
    if (existing) {
      this.os.focusWindow(sysId, existing.id);
      this.os.emit('files-open-path', { systemId: sysId, windowId: existing.id, path });
    } else {
      this.openAppById(sysId, 'files', { props: { path } });
    }
  }

  async openPath(sysId, path, opts = {}) {
    const sys = this.os.sysById(sysId);
    if (!sys) return;
    const node = FS.resolveNode(sys.fs, path);
    if (!node) { this.toast(sysId, '文件不存在：' + path, 'error'); return; }
    if (node.type === 'dir') { this.openFilesAt(sysId, path); return; }
    const kind = FS.fileKind(node.name);
    if (kind === 'sheet') {
      const existing = sys.windows.find((w) => w.appId === 'spreadsheet' && w.props?.path === path);
      if (existing) { this.os.focusWindow(sysId, existing.id); return; }
      this.openAppById(sysId, 'spreadsheet', { props: { path } });
      return;
    }
    if (kind === 'scene' || kind === 'flight') {
      if (sys.isRoot) { this.toast(sysId, '根系统不提供三维播放器。请将此文件拖入任一子系统后打开。', 'warn'); return; }
      this.openAppById(sysId, 'player', { props: { path, openMode: kind === 'flight' ? 'record' : 'scene' } });
      return;
    }
    if (kind === 'program' || kind === 'text' || node.name.endsWith('.md') || node.name.endsWith('.json')) {
      this.openAppById(sysId, 'editor', { props: { path } });
      return;
    }
    if (kind === 'snapshot') {
      this.openAppById(sysId, 'systems', { props: { tab: 'snapshots' } });
      return;
    }
    this.openAppById(sysId, 'editor', { props: { path } });
  }

  openSystemWindow(childId) {
    const child = this.os.sysById(childId);
    if (!child || child.isRoot) return null;
    const parent = this.os.sysById(child.parentId);
    if (!parent) return null;
    const existing = this.os.findSystemWindow(childId);
    if (existing) {
      this.os.focusWindow(parent.id, existing.window.id);
      this.applyWindowState(this.views.get(existing.window.id));
      return existing.window;
    }
    if (!this.desktops.has(parent.id)) {
      if (!parent.isRoot) this.openSystemWindow(parent.id);
      if (!this.desktops.has(parent.id)) return null;
    }
    const d = this.desktops.get(parent.id);
    const dw = d.ui.clientWidth, dh = d.ui.clientHeight;
    const width = Math.max(420, Math.min(dw - 46, 1120));
    const height = Math.max(300, Math.min(dh - TASKBAR_H - 44, 760));
    const win = this.os.openApp(parent.id, 'system', {
      title: `${child.name} · 子系统`, width, height, desktopW: dw, desktopH: dh,
      props: { childId }, minW: 320, minH: 220,
    });
    if (win) {
      win.x = Math.max(14, Math.round((dw - width) / 2 + 18));
      win.y = Math.max(12, Math.round((dh - TASKBAR_H - height) / 2 + 10));
      win.w = Math.min(width, dw - 28);
      win.h = Math.min(height, dh - TASKBAR_H - 28);
      const view = this.views.get(win.id);
      if (view) this.applyWindowState(view);
      this.os.emit('window-updated', { window: win, systemId: parent.id });
    }
    return win;
  }

  maybeOpenDefaultPlayer(sysId) {
    const sys = this.os.sysById(sysId);
    if (!sys || sys.state !== 'running') return;
    if (!this.desktops.has(sysId)) return;
    if (sys.windows.some((w) => w.appId === 'player' || w.appId === 'charts')) return;
    const d = this.desktops.get(sysId);
    const dw = d.ui.clientWidth, dh = d.ui.clientHeight;
    const win = this.openAppById(sysId, 'player', {
      props: { path: sys.appConfig.player?.defaultScene || '/Demo/helicopter-24.scene' },
      width: Math.max(420, Math.round(dw * 0.72)),
      height: Math.max(280, Math.round((dh - TASKBAR_H) * 0.7)),
    });
    if (win) {
      win.x = Math.max(12, Math.round(dw * 0.2));
      win.y = Math.max(10, Math.round(dh * 0.13));
      const v = this.views.get(win.id);
      if (v) this.applyWindowState(v);
    }
  }

  onWindowCreated(sys, win) {
    if (!this.desktops.has(sys.id)) {
      if (win.appId === 'system') {
        // 父桌面尚不存在时先建立其系统窗口链
        this.openSystemWindow(sys.id);
      }
    }
    if (!this.desktops.has(sys.id)) return;
    if (this.views.has(win.id)) return;
    this.createWindowView(sys, win);
    this._refreshTaskbar(sys.id);
    this.updateSystemWindowTitles(sys.id);
    if (win.appId === 'system' && win.props?.childId) {
      const child = this.os.sysById(win.props.childId);
      if (child) this.renderDesktopStatus(child.id);
    }
  }

  createWindowView(sys, win) {
    if (this.views.has(win.id)) return this.views.get(win.id);
    const d = this.desktops.get(sys.id);
    if (!d) return null;
    const app = APPS[win.appId] || APPS.help;
    const isSystem = win.appId === 'system';
    const isProjection = win.appId === 'projection';
    const appMeta = app?.meta || { title: win.title };
    const accent = accentForSystem(sys);
    const dom = el(`<div class="app-window ${isSystem ? 'system-window' : ''} ${isProjection ? 'projection-window' : ''}"
      data-testid="app-window" data-window-id="${win.id}" data-system-id="${sys.id}" data-app-id="${win.appId}"
      tabindex="-1" style="--accent:${accent};z-index:${win.z}">
      <div class="window-frame">
        <header class="window-titlebar" data-testid="window-titlebar">
          <span class="win-appicon">${isSystem ? appIcon('systems', { size: 22 }) : appIcon(win.appId, { size: 22 })}</span>
          <div class="win-heading">
            <span class="win-title">${esc(win.title)}</span>
            <span class="win-system-chip" data-state="${sys.state}">L${sys.depth + 1} · ${esc(this.stateLabel(sys))}</span>
          </div>
          ${isProjection ? `<span class="win-source-chip" title="投送来源">${uiIcon('projection')} 来源 ${esc(this.os.sysById(win.sourceSystemId || win.props?.sourceSystemId)?.name || '')}</span>` : ''}
          <div class="win-actions">
            ${(win.appId === 'player' || win.appId === 'charts') ? `<button type="button" class="win-action win-project" data-testid="window-project" title="投送到祖先桌面" aria-label="投送到祖先桌面">${uiIcon('expand')}</button>` : ''}
            <button type="button" class="win-action" data-testid="window-minimize" title="最小化" aria-label="最小化">${uiIcon('minimize')}</button>
            <button type="button" class="win-action" data-testid="window-maximize" title="最大化" aria-label="最大化">${uiIcon(win.state === 'maximized' ? 'restore' : 'maximize')}</button>
            <button type="button" class="win-action win-close" data-testid="window-close" title="关闭" aria-label="关闭">${uiIcon('close')}</button>
          </div>
        </header>
        <div class="window-body"></div>
        <div class="window-suspend-cover" hidden></div>
        ${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((s) => `<div class="resize-handle resize-${s}" data-resize="${s}" ${s === 'se' ? 'data-testid="window-resize"' : ''}></div>`).join('')}
      </div>
    </div>`);
    if (isProjection) {
      dom.dataset.sourceSystemId = win.sourceSystemId || win.props?.sourceSystemId || '';
      dom.dataset.sourceWindowId = win.sourceWindowId || win.props?.sourceWindowId || '';
      dom.dataset.sourceAppId = win.sourceAppId || win.props?.sourceAppId || '';
    }
    d.windows.appendChild(dom);
    const view = {
      id: win.id, win, sys, sysId: sys.id, dom, d,
      body: $s(dom, '.window-body'), cleanup: null, beforeClose: null, inspect: null,
      titleEl: $s(dom, '.win-title'), app, instance: null, projectionSource: null,
    };
    this.views.set(win.id, view);
    d.views.push(view);
    this.bindWindowEvents(view);
    this.applyWindowState(view);
    this.mountWindowContent(view);
    this.updateProcessCover(sys.id, win.procId);
    return view;
  }

  mountWindowContent(view) {
    const { sys, win, body } = view;
    if (win.appId === 'system') {
      const child = this.os.sysById(win.props?.childId);
      if (!child) {
        body.innerHTML = `<div class="empty-state"><h3>子系统不存在</h3><p>该节点可能已被关闭或移除。</p></div>`;
        return;
      }
      body.classList.add('system-window-body');
      view.childDesktopId = child.id;
      this.ensureDesktop(child.id, body);
      return;
    }
    if (win.appId === 'projection') {
      this.mountProjection(view);
      return;
    }
    const app = view.app;
    if (!app || !app.mount) {
      body.innerHTML = `<div class="empty-state"><h3>无法打开应用</h3><p>${esc(win.appId)}</p></div>`;
      return;
    }
    const ctx = this.makeAppContext(view);
    try {
      view.instance = app.mount(ctx) || {};
      view.cleanup = view.instance.destroy || null;
      view.beforeClose = view.instance.beforeClose || null;
      view.inspect = view.instance.inspect || null;
    } catch (err) {
      console.error('mount app', win.appId, err);
      body.innerHTML = `<div class="app-error"><b>应用启动失败</b><p>${esc(err.message || err)}</p><button type="button" class="small-button" onclick="this.closest('.app-window').querySelector('[data-testid=window-close]').click()">关闭窗口</button></div>`;
    }
  }

  mountProjection(view) {
    const { win, body } = view;
    const sourceSys = this.os.sysById(win.sourceSystemId || win.props?.sourceSystemId);
    const sourceWinId = win.sourceWindowId || win.props?.sourceWindowId;
    const sourceWin = sourceSys?.windows.find((w) => w.id === sourceWinId);
    if (!sourceSys || !sourceWin) {
      body.innerHTML = `<div class="projection-missing">${uiIcon('warning')}<b>投送源已不存在</b><span>该窗口对应的源应用可能已关闭。</span></div>`;
      return;
    }
    const sourceView = this.views.get(sourceWin.id);
    const app = APPS[sourceWin.appId];
    body.classList.add('projection-body');
    if (!app?.mountProjection || !sourceView) {
      body.innerHTML = `<div class="projection-missing">${uiIcon('warning')}<b>投送内容暂不可用</b><span>请确保源应用窗口仍在所属桌面中打开。</span></div>`;
      return;
    }
    view.projectionSource = sourceView;
    const ctx = this.makeProjectionContext(view, sourceView);
    const sourceApi = Object.assign(Object.create(sourceView), sourceView.instance || {});
    try {
      view.instance = app.mountProjection(ctx, sourceApi) || {};
      view.cleanup = view.instance.destroy || null;
      view.inspect = view.instance.inspect || null;
    } catch (err) {
      console.error('projection mount', err);
      body.innerHTML = `<div class="app-error"><b>投送渲染失败</b><p>${esc(err.message || err)}</p></div>`;
    }
  }

  makeAppContext(view) {
    const { sys, win, body } = view;
    const shell = this;
    return {
      shell, os: this.os, sys, window: win, win, body,
      data: win.data,
      desktop: this.desktops.get(sys.id),
      setTitle: (title) => this.setWindowTitle(sys.id, win.id, title),
      setDirty: (dirty) => { win.dirty = !!dirty; $s(view.dom, '.win-title').classList.toggle('dirty', !!dirty); },
      close: () => this.requestCloseWindow(sys.id, win.id),
      toast: (text, kind) => this.toast(sys.id, text, kind),
      notify: (opt) => this.os.notify(sys.id, opt),
      dialog: (opts) => this.dialog(sys.id, opts),
      contextMenu: (e, items) => { e?.preventDefault?.(); e?.stopPropagation?.(); this.contextMenu(sys.id, e.clientX ?? 20, e.clientY ?? 60, items); },
      openFile: (path) => this.openPath(sys.id, path),
      openFiles: (path) => this.openFilesAt(sys.id, path),
      openApp: (appId, opts) => this.openAppById(sys.id, appId, opts),
      refreshTaskbar: () => this._refreshTaskbar(sys.id),
      refreshIcons: () => this._refreshIcons(sys.id),
      requestClose: () => this.requestCloseWindow(sys.id, win.id),
      project: () => this.showProjectMenu(sys, win),
      restoreIfNeeded: () => {},
    };
  }

  makeProjectionContext(view, sourceView) {
    const { sys, win, body } = view;
    return {
      shell: this, os: this.os, sys, window: win, win, body,
      sourceView, sourceSys: sourceView.sys, sourceWindow: sourceView.win,
      data: win.data,
      toast: (t, k) => this.toast(sys.id, t, k),
      dialog: (o) => this.dialog(sys.id, o),
      requestClose: () => this.requestCloseWindow(sys.id, win.id),
      closeProjection: () => this.os.closeProjection(sys.id, win.id, '用户关闭投送'),
    };
  }

  bindWindowEvents(view) {
    const { dom, win, sys } = view;
    const titlebar = $s(dom, '.window-titlebar');
    const d = this.desktops.get(sys.id);
    const actions = $s(dom, '.win-actions');
    $s(dom, '[data-testid="window-minimize"]').addEventListener('click', (e) => {
      e.stopPropagation(); this.os.minimizeWindow(sys.id, win.id); this.applyWindowState(view);
    });
    $s(dom, '[data-testid="window-maximize"]').addEventListener('click', (e) => {
      e.stopPropagation(); this.os.maximizeWindow(sys.id, win.id); this.applyWindowState(view);
    });
    $s(dom, '[data-testid="window-close"]').addEventListener('click', (e) => {
      e.stopPropagation(); this.requestCloseWindow(sys.id, win.id);
    });
    const projectBtn = $s(dom, '.win-project');
    if (projectBtn) projectBtn.addEventListener('click', (e) => { e.stopPropagation(); this.showProjectMenu(sys, win); });
    titlebar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button')) return;
      this.os.focusWindow(sys.id, win.id);
      this.startWindowDrag(view, e);
    });
    titlebar.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      this.os.maximizeWindow(sys.id, win.id);
      this.applyWindowState(view);
    });
    titlebar.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showWindowContext(sys, win, e.clientX, e.clientY);
    });
    for (const handle of $all(dom, '.resize-handle')) {
      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation(); e.preventDefault();
        this.os.focusWindow(sys.id, win.id);
        this.startWindowResize(view, handle.dataset.resize, e);
      });
    }
    dom.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this.os.focusWindow(sys.id, win.id);
    }, true);
  }

  startWindowDrag(view, e) {
    const { win, sys } = view;
    const d = this.desktops.get(sys.id);
    if (!d) return;
    const scale = d.root.getBoundingClientRect().width / Math.max(1, d.root.clientWidth);
    const bounds = this.desktopBounds(d);
    let start = { x: e.clientX, y: e.clientY };
    let orig = { x: win.x, y: win.y, w: win.w, h: win.h };
    if (win.state === 'maximized' && win.restoreRect) {
      const ratioX = (e.clientX - d.ui.getBoundingClientRect().left) / d.ui.getBoundingClientRect().width;
      orig = { ...win.restoreRect };
      orig.x = clamp(win.restoreRect.x, 0, bounds.w - orig.w);
      orig.y = clamp(win.restoreRect.y, 0, bounds.h - orig.h);
      win.state = 'normal'; win.snap = null;
      win.x = orig.x; win.y = orig.y; win.w = orig.w; win.h = orig.h;
      this.applyWindowState(view);
      start = { x: e.clientX, y: e.clientY };
      $s(view.dom, '[data-testid="window-maximize"]').innerHTML = uiIcon('maximize');
    }
    if (win.snap) { win.snap = null; this.applyWindowState(view); orig = { x: win.x, y: win.y, w: win.w, h: win.h }; }
    $s(view.dom, '.window-frame').classList.add('dragging');
    const preview = el('<div class="snap-preview"></div>');
    d.ui.appendChild(preview);
    const onMove = (ev) => {
      const dx = (ev.clientX - start.x) / scale;
      const dy = (ev.clientY - start.y) / scale;
      win.x = clamp(Math.round(orig.x + dx), -win.w + 90, bounds.w - 70);
      win.y = clamp(Math.round(orig.y + dy), 0, bounds.h - 42);
      this.applyGeometry(view);
      const uiRect = d.ui.getBoundingClientRect();
      const lx = (ev.clientX - uiRect.left) / scale;
      const ly = (ev.clientY - uiRect.top) / scale;
      let snap = null;
      if (ly < 8) snap = 'top';
      else if (lx < 10) snap = 'left';
      else if (lx > bounds.w - 10) snap = 'right';
      preview.className = 'snap-preview' + (snap ? ' visible ' + snap : '');
      if (snap === 'left') Object.assign(preview.style, { left: '6px', top: '6px', width: `${bounds.w / 2 - 9}px`, height: `${bounds.h - 6}px` });
      else if (snap === 'right') Object.assign(preview.style, { left: `${bounds.w / 2 + 3}px`, top: '6px', width: `${bounds.w / 2 - 9}px`, height: `${bounds.h - 6}px` });
      else if (snap === 'top') Object.assign(preview.style, { left: '6px', top: '6px', width: `${bounds.w - 12}px`, height: `${bounds.h - 6}px` });
      this._snapIntent = snap;
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      preview.remove();
      $s(view.dom, '.window-frame').classList.remove('dragging');
      const snap = this._snapIntent; this._snapIntent = null;
      if (snap === 'top') { this.os.maximizeWindow(sys.id, win.id); }
      else if (snap === 'left' || snap === 'right') { win.snap = snap; win.state = 'normal'; }
      else if (win.y < 0) win.y = 0;
      this.os.emit('window-updated', { window: win, systemId: sys.id });
      this.applyWindowState(view);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  startWindowResize(view, dir, e) {
    const { win, sys } = view;
    const d = this.desktops.get(sys.id);
    const scale = d.root.getBoundingClientRect().width / Math.max(1, d.root.clientWidth);
    const bounds = this.desktopBounds(d);
    const start = { x: e.clientX, y: e.clientY };
    const orig = { x: win.x, y: win.y, w: win.w, h: win.h };
    if (win.state === 'maximized' || win.snap) { this.setWindowNormal(view); }
    const minW = Math.max(280, win.minW || 320), minH = Math.max(180, win.minH || 220);
    $s(view.dom, '.window-frame').classList.add('resizing');
    const onMove = (ev) => {
      const dx = (ev.clientX - start.x) / scale;
      const dy = (ev.clientY - start.y) / scale;
      let { x, y, w, h } = orig;
      if (dir.includes('e')) w = clamp(orig.w + dx, minW, bounds.w - orig.x);
      if (dir.includes('s')) h = clamp(orig.h + dy, minH, bounds.h - orig.y);
      if (dir.includes('w')) { const nw = clamp(orig.w - dx, minW, orig.x + orig.w); x = orig.x + orig.w - nw; w = nw; }
      if (dir.includes('n')) { const nh = clamp(orig.h - dy, minH, orig.y + orig.h); y = orig.y + orig.h - nh; h = nh; }
      Object.assign(win, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
      this.applyGeometry(view);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      $s(view.dom, '.window-frame').classList.remove('resizing');
      this.os.emit('window-updated', { window: win, systemId: sys.id });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  desktopBounds(d) {
    const w = d.ui.clientWidth || d.root.clientWidth;
    const h = d.ui.clientHeight || d.root.clientHeight;
    return { w, h: Math.max(240, h - TASKBAR_H) };
  }

  applyGeometry(view) {
    const { win, d, dom } = view;
    if (win.state === 'minimized') { dom.style.visibility = 'hidden'; dom.style.pointerEvents = 'none'; return; }
    dom.style.visibility = 'visible';
    dom.style.pointerEvents = '';
    const b = this.desktopBounds(d);
    if (win.state === 'maximized') {
      dom.style.left = '0px'; dom.style.top = '0px';
      dom.style.width = `${b.w}px`; dom.style.height = `${b.h}px`;
    } else if (win.snap === 'left') {
      win.x = 0; win.y = 0; win.w = Math.floor(b.w / 2); win.h = b.h;
      dom.style.left = '0px'; dom.style.top = '0px';
      dom.style.width = `${win.w}px`; dom.style.height = `${win.h}px`;
    } else if (win.snap === 'right') {
      win.x = Math.ceil(b.w / 2); win.y = 0; win.w = Math.floor(b.w / 2); win.h = b.h;
      dom.style.left = `${win.x}px`; dom.style.top = '0px';
      dom.style.width = `${win.w}px`; dom.style.height = `${win.h}px`;
    } else {
      const maxW = Math.max(120, b.w - 8);
      const maxH = Math.max(100, b.h - 8);
      win.w = Math.min(maxW, Math.max(Math.min(win.minW || 280, maxW), win.w));
      win.h = Math.min(maxH, Math.max(Math.min(win.minH || 180, maxH), win.h));
      win.x = clamp(win.x, 0, Math.max(0, b.w - win.w));
      win.y = clamp(win.y, 0, Math.max(0, b.h - win.h));
      dom.style.left = `${win.x}px`; dom.style.top = `${win.y}px`;
      dom.style.width = `${win.w}px`; dom.style.height = `${win.h}px`;
    }
  }

  setWindowNormal(view) {
    const { win } = view;
    if (win.restoreRect) { Object.assign(win, win.restoreRect); win.restoreRect = null; }
    win.state = 'normal'; win.snap = null;
    this.applyWindowState(view);
  }

  applyWindowState(view) {
    const { win, dom, sys, d } = view;
    if (!d) return;
    win.w = Math.max(win.minW || 280, win.w);
    win.h = Math.max(win.minH || 180, win.h);
    dom.dataset.windowState = win.state;
    dom.classList.toggle('is-maximized', win.state === 'maximized');
    dom.classList.toggle('is-minimized', win.state === 'minimized');
    dom.classList.toggle('is-active', sys.focusId === win.id);
    dom.style.zIndex = String(win.z);
    const maxBtn = $s(dom, '[data-testid="window-maximize"]');
    if (maxBtn) maxBtn.innerHTML = uiIcon(win.state === 'maximized' ? 'restore' : 'maximize');
    this.applyGeometry(view);
  }

  applyWindowOrder(sysId) {
    const d = this.desktops.get(sysId);
    const sys = this.os.sysById(sysId);
    if (!d || !sys) return;
    for (const view of d.views) {
      view.dom.style.zIndex = String(view.win.z);
      view.dom.classList.toggle('is-active', sys.focusId === view.win.id);
    }
  }

  reflowDesktop(sysId) {
    const d = this.desktops.get(sysId);
    if (!d) return;
    for (const v of d.views) this.applyGeometry(v);
    if (d.sys?.isRoot) this.applyUIScale(d);
  }

  setWindowTitle(sysId, winId, title) {
    const win = this.os.getWindow(sysId, winId);
    if (!win) return;
    win.title = title;
    const view = this.views.get(win.id);
    if (view) {
      const t = $s(view.dom, '.win-title');
      if (t) t.textContent = title;
    }
    this._refreshTaskbar(sysId);
  }

  async requestCloseWindow(sysId, winId) {
    const sys = this.os.sysById(sysId);
    const win = this.os.getWindow(sysId, winId);
    if (!sys || !win) return;
    if (win.appId === 'projection') {
      this.os.closeProjection(sysId, winId, '用户关闭投送');
      return;
    }
    if (win.appId === 'system' && win.props?.childId) {
      const child = this.os.sysById(win.props.childId);
      if (!child) { this.os.closeWindow(sysId, winId); return; }
      const ok = await this.dialog(sysId, {
        title: `停止 ${child.name} 子树？`,
        message: '关闭此系统窗口将停止该子系统及其全部后代，结束其中所有程序。父系统、兄弟子树和已保存的快照不受影响。',
        buttons: [{ label: '取消', value: null }, { label: '停止并关闭', value: 'yes', danger: true, primary: true }],
      });
      if (!ok) return;
      this.os.stopSystem(child.id);
      this.os.closeWindow(sysId, winId);
      return;
    }
    const view = this.views.get(winId);
    if (view?.beforeClose) {
      try {
        const proceed = await view.beforeClose();
        if (proceed === false) return;
      } catch (err) { console.error(err); }
    }
    this.os.closeWindow(sysId, winId);
  }

  destroyWindowView(sysId, winId, opts = {}) {
    const view = this.views.get(winId);
    if (!view) return;
    const d = this.desktops.get(sysId);
    try {
      if (view.cleanup) view.cleanup({ silent: !!opts.silent });
    } catch (err) { console.warn('cleanup', err); }
    if (view.childDesktopId) {
      this.destroyDesktopDom(view.childDesktopId, { silent: true });
    }
    view.dom.remove();
    this.views.delete(winId);
    if (d) d.views = d.views.filter((v) => v.id !== winId);
    if (!opts.fromDesktopDestroy) this._refreshTaskbar(sysId);
  }

  showWindowContext(sys, win, x, y) {
    const items = [
      { label: win.state === 'minimized' ? '恢复窗口' : '最小化', icon: 'minimize', action: () => { this.os.minimizeWindow(sys.id, win.id); this.applyWindowState(this.views.get(win.id)); } },
      { label: win.state === 'maximized' ? '恢复大小' : '最大化', icon: 'maximize', action: () => { this.os.maximizeWindow(sys.id, win.id); this.applyWindowState(this.views.get(win.id)); } },
      ...(win.appId === 'player' || win.appId === 'charts' ? [{ label: '投送到祖先桌面', icon: 'projection', action: () => this.showProjectMenu(sys, win) }] : []),
      { label: '关闭窗口', icon: 'close', danger: true, separatorBefore: true, action: () => this.requestCloseWindow(sys.id, win.id) },
    ];
    this.contextMenu(sys.id, x, y, items);
  }

  showProjectMenu(sys, win) {
    const targets = this.os.listTargets(sys.id);
    const existing = this.os.existingProjection(win.id);
    const d = this.desktops.get(sys.id);
    if (!d) return;
    const menu = el(`<div class="context-menu project-menu">
      <div class="context-title">投送到祖先桌面</div>
      ${existing ? `<div class="context-note">已投送到 ${esc(existing.target.name)} · 再次投送将聚焦已有窗口</div>` : '<div class="context-note">内容计算仍属于源系统，目标桌面只承载外框与输入转发</div>'}
      ${targets.map((t) => `<button type="button" class="context-item" data-testid="project-target" data-target-system-id="${t.id}" data-target-app="${win.appId}">
        ${uiIcon('projection')}<span>${esc(t.name)} <i>L${t.depth + 1}${t.id === 'outer' ? ' · 根桌面' : ''}</i></span>
      </button>`).join('')}
      <button type="button" class="context-item subtle" data-project-cancel>取消</button>
    </div>`);
    d.contextLayer.innerHTML = '';
    d.contextLayer.appendChild(menu);
    const r = d.ui.getBoundingClientRect();
    menu.style.left = `${clamp(win.x + 40, 8, Math.max(8, d.ui.clientWidth - 330))}px`;
    menu.style.top = `${clamp(win.y + 40, 8, Math.max(8, d.ui.clientHeight - 280))}px`;
    for (const btn of $all(menu, '[data-testid="project-target"]')) {
      btn.addEventListener('click', () => {
        d.contextLayer.innerHTML = '';
        const res = this.os.createProjection(sys.id, win.id, btn.dataset.targetSystemId);
        if (!res.ok) this.toast(sys.id, res.error || '投送失败', 'error');
        else this.toast(sys.id, `已投送到 ${res.targetSystemId}`, 'success');
      });
    }
    $s(menu, '[data-project-cancel]')?.addEventListener('click', () => d.contextLayer.innerHTML = '');
  }

  updateProcessCover(sysId, pid) {
    const sys = this.os.sysById(sysId);
    if (!sys) return;
    const proc = sys.processes.find((p) => p.pid === pid);
    if (!proc) return;
    for (const view of this.views.values()) {
      if (view.sysId !== sysId) continue;
      const cover = $s(view.dom, '.window-suspend-cover');
      if (!cover) continue;
      const isMain = view.win.procId === pid;
      if (isMain && proc.state === 'suspended') {
        cover.innerHTML = `<div>${uiIcon('pauseCircle')}<b>${esc(proc.name)} 已挂起</b><span>进程状态与消息已保留。${proc.kind === 'custom' ? '继续后从原运行位置执行。' : ''}</span><button type="button" class="small-button" data-cover-resume>继续进程</button></div>`;
        cover.hidden = false;
        $s(cover, '[data-cover-resume]')?.addEventListener('click', () => this.os.resumeProcess(sysId, pid));
      } else if (isMain && proc.state === 'error') {
        cover.innerHTML = `<div>${uiIcon('warning')}<b>进程异常</b><span>${esc(proc.error || '')}</span></div>`;
        cover.hidden = false;
      } else if (view.win.appId === 'system') {
        cover.hidden = true;
      }
    }
  }

  // ---------------- 上下文菜单 / 对话框 / 通知 ----------------

  contextMenu(sysId, x, y, items) {
    const d = this.desktops.get(sysId);
    if (!d) return;
    d.contextLayer.innerHTML = '';
    const menu = el('<div class="context-menu" role="menu"></div>');
    for (const it of items) {
      if (it.hidden) continue;
      if (it.separatorBefore) menu.appendChild(el('<div class="context-separator"></div>'));
      const btn = el(`<button type="button" class="context-item ${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''}>
        ${it.icon ? uiIcon(it.icon) : '<span class="context-icon-space"></span>'}
        <span>${esc(it.label)}</span>${it.hint ? `<i>${esc(it.hint)}</i>` : ''}
      </button>`);
      btn.addEventListener('click', () => {
        menu.remove();
        try { const r = it.action?.(); if (r?.catch) r.catch((err) => this.toast(sysId, String(err.message || err), 'error')); }
        catch (err) { this.toast(sysId, String(err.message || err), 'error'); }
      });
      menu.appendChild(btn);
    }
    d.contextLayer.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    const uiRect = d.ui.getBoundingClientRect();
    const scale = uiRect.width / Math.max(1, d.ui.clientWidth);
    const px = (x - uiRect.left) / scale;
    const py = (y - uiRect.top) / scale;
    const maxX = d.ui.clientWidth - rect.width / scale - 8;
    const maxY = d.ui.clientHeight - rect.height / scale - 8;
    menu.style.left = `${clamp(px, 8, maxX)}px`;
    menu.style.top = `${clamp(py, 8, maxY)}px`;
  }

  dialog(sysId, opts = {}) {
    const d = this.desktops.get(sysId);
    if (!d) return Promise.resolve(null);
    return new Promise((resolve) => {
      const fields = (opts.fields || []).map((f) => `<label class="dialog-field">
        <span>${esc(f.label)}</span>
        ${f.type === 'textarea'
          ? `<textarea name="${esc(f.name)}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}">${esc(f.value ?? '')}</textarea>`
          : `<input type="${f.type || 'text'}" name="${esc(f.name)}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" autocomplete="off">`}
      </label>`).join('');
      const buttons = opts.buttons || [{ label: '取消', value: null }, { label: opts.okLabel || '确定', value: 'ok', primary: true }];
      const backdrop = el(`<div class="dialog-backdrop">
        <div class="dialog-card" role="dialog" aria-modal="true">
          <div class="dialog-head"><div><b>${esc(opts.title || '提示')}</b>${opts.subtitle ? `<span>${esc(opts.subtitle)}</span>` : ''}</div>
            <button type="button" class="icon-button" data-dialog-close aria-label="关闭">${uiIcon('close')}</button></div>
          ${opts.message ? `<div class="dialog-message">${esc(opts.message).replace(/\n/g, '<br>')}</div>` : ''}
          ${fields ? `<div class="dialog-fields">${fields}</div>` : ''}
          <div class="dialog-actions">
            ${buttons.map((b, i) => `<button type="button" class="${b.primary ? 'primary-button' : 'ghost-button'} ${b.danger ? 'danger' : ''}" data-dialog-btn="${i}" ${b.value === null ? 'data-dialog-cancel' : ''}>${esc(b.label)}</button>`).join('')}
          </div>
        </div>
      </div>`);
      const layer = d.dialogLayer;
      layer.appendChild(backdrop);
      const finish = (index) => {
        const btn = buttons[index];
        const values = {};
        for (const input of $all(backdrop, 'input,textarea')) values[input.name] = input.value;
        backdrop.classList.add('closing');
        setTimeout(() => backdrop.remove(), 120);
        this.activeDialogs.delete(sysId);
        resolve(btn && btn.value === null ? null : { button: btn, index, values });
      };
      for (const b of $all(backdrop, '[data-dialog-btn]')) {
        b.addEventListener('click', () => finish(Number(b.dataset.dialogBtn)));
      }
      $s(backdrop, '[data-dialog-close]')?.addEventListener('click', () => finish(buttons.findIndex((b) => b.value === null)));
      $s(backdrop, '[data-dialog-cancel]')?.addEventListener('click', () => finish(buttons.findIndex((b) => b.value === null)));
      backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) finish(buttons.findIndex((b) => b.value === null)); });
      const firstInput = $s(backdrop, 'input,textarea');
      if (firstInput) setTimeout(() => { firstInput.focus(); firstInput.select?.(); }, 40);
      backdrop.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
          const primary = buttons.findIndex((b) => b.primary);
          if (primary >= 0) finish(primary);
        }
        if (e.key === 'Escape') finish(buttons.findIndex((b) => b.value === null));
      });
      this.activeDialogs.set(sysId, backdrop);
    });
  }

  toast(sysId, text, kind = 'info') {
    let d = this.desktops.get(sysId);
    if (!d) {
      const sys = this.os.sysById(sysId);
      if (sys?.parentId) d = this.desktops.get(sys.parentId);
      if (!d) d = this.desktops.get('outer');
    }
    if (!d) return;
    const type = kind === 'error' ? 'warning' : kind === 'warn' ? 'warning' : kind;
    const icon = type === 'success' ? 'success' : type === 'error' || type === 'warning' ? 'warning' : type === 'thumb' ? 'info' : 'info';
    const t = el(`<div class="toast toast-${type}">${uiIcon(icon)}<div><b>${esc(kind === 'error' ? '操作失败' : type === 'success' ? '完成' : '提示')}</b><span>${esc(text)}</span></div></div>`);
    d.toasts.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 280);
    }, 3600);
    while (d.toasts.children.length > 4) d.toasts.firstElementChild.remove();
  }

  // ---------------- 应用窗口更新辅助 ----------------

  updateAppWindows(sysId, appId, fn) {
    const sys = this.os.sysById(sysId);
    if (!sys) return;
    for (const w of sys.windows) if (w.appId === appId) fn(w, this.views.get(w.id));
  }

  getView(windowId) { return this.views.get(windowId); }
  getDesktop(sysId) { return this.desktops.get(sysId); }

  inspect() {
    const systems = [...this.os.systems.values()].map((s) => ({
      id: s.id, parentId: s.parentId, name: s.name, state: s.state, selfPaused: !!s.selfPaused,
      clock: s.clock, depth: s.depth,
    }));
    const windows = [];
    const browsers = [];
    const players = [];
    const charts = [];
    const projections = [];
    for (const sys of this.os.systems.values()) {
      for (const w of sys.windows) {
        windows.push({ id: w.id, systemId: sys.id, appId: w.appId, title: w.title, state: w.state });
        if (w.appId === 'browser') {
          try { const info = this.views.get(w.id)?.inspect?.(); if (info?.tabs) browsers.push(...info.tabs.map((t) => ({ windowId: w.id, ...t }))); } catch { /* ignore */ }
        }
        if (w.appId === 'player') {
          try { const info = this.views.get(w.id)?.inspect?.(); if (info) players.push({ windowId: w.id, systemId: sys.id, ...info }); } catch { /* ignore */ }
        }
        if (w.appId === 'charts') {
          try { const info = this.views.get(w.id)?.inspect?.(); if (info) charts.push({ windowId: w.id, systemId: sys.id, ...info }); } catch { /* ignore */ }
        }
        if (w.appId === 'projection') {
          projections.push({
            windowId: w.id, systemId: sys.id,
            sourceSystemId: w.sourceSystemId || w.props?.sourceSystemId,
            sourceWindowId: w.sourceWindowId || w.props?.sourceWindowId,
            sourceAppId: w.sourceAppId || w.props?.sourceAppId,
            state: w.state,
          });
        }
      }
    }
    return { version: 1, systems, windows, browsers, players, charts, projections };
  }
}
