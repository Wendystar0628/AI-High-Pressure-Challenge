// 根系统桌面壳: 图标 / 任务栏 / 开始菜单 / 通知 / 时钟 / 右键菜单
import { fmtClock, fmtDate, el } from '../core/util.js';
import { showContextMenu, escapeHtml } from './window-manager.js';

export class DesktopShell {
  constructor({ wm, apps, bus, systemName = 'Nested OS' }) {
    this.wm = wm;
    this.apps = apps;           // Map<appId, appDef>
    this.bus = bus;
    this.systemName = systemName;
    this.notifications = [];
    this.dnd = false;           // 免打扰
    this.recentDocs = [];
    this._build();
  }

  _build() {
    this.root = document.getElementById('os-desktop');
    this.iconsEl = document.getElementById('desktop-icons');
    this.taskbarApps = document.getElementById('taskbar-apps');
    this.startMenu = document.getElementById('start-menu');
    this.startApps = document.getElementById('start-apps');
    this.toastLayer = document.getElementById('toast-layer');

    document.getElementById('start-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleStartMenu();
    });
    document.getElementById('start-search').addEventListener('input', (e) => {
      this._filterStart(e.target.value);
    });
    document.getElementById('notifications-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      this.bus.emit('open-notifications');
    });
    document.getElementById('widgets-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      this.bus.emit('open-widgets');
    });
    document.getElementById('tray-clock').addEventListener('click', (e) => {
      e.stopPropagation();
      this.bus.emit('open-widgets', 'clock');
    });

    // 点击空白关闭开始菜单
    this.root.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#start-menu') && !e.target.closest('#start-toggle')) {
        this.startMenu.classList.remove('open');
      }
      if (!e.target.closest('.desk-icon')) {
        this.iconsEl.querySelectorAll('.desk-icon.selected').forEach(d => d.classList.remove('selected'));
      }
    });

    // 桌面右键菜单
    this.root.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.app-window') || e.target.closest('#taskbar') ||
          e.target.closest('#start-menu') || e.target.closest('.ctx-menu')) return;
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { label: '刷新桌面', icon: '⟳', action: () => this.renderIcons(), testid: 'ctx-refresh' },
        '-',
        { label: '新建便笺', icon: '🗒', action: () => this.bus.emit('open-widgets', 'notes'), testid: 'ctx-new-note' },
        { label: '打开操作说明', icon: '📖', action: () => this.bus.emit('open-help'), testid: 'ctx-help' },
        '-',
        { label: '显示设置', icon: '⚙', action: () => this.launch('settings'), testid: 'ctx-settings' },
        { label: '新建子系统', icon: '➕', action: () => this.bus.emit('new-subsystem'), testid: 'ctx-new-system' },
      ]);
    });

    this.renderIcons();
    this.renderStartApps();
    this.startClock();
    this.wm.onChange = () => this.renderTaskbar();
    this.renderTaskbar();
  }

  startClock() {
    const t = document.getElementById('tray-clock');
    const tick = () => {
      const d = new Date();
      t.innerHTML = `<div>${fmtClock(d)}</div><div class="d">${fmtDate(d)}</div>`;
    };
    tick();
    setInterval(tick, 500);
  }

  renderIcons() {
    this.iconsEl.innerHTML = '';
    const items = [
      ...this.iconsEl.dataset.extra ? [] : [],
      { id: 'files', label: '文件管理器', icon: '📁', appId: 'files' },
      { id: 'spreadsheet', label: '电子表格', icon: '📊', appId: 'spreadsheet' },
      { id: 'browser', label: '浏览器', icon: '🌐', appId: 'browser' },
      { id: 'widgets', label: '小组件', icon: '🧩', appId: 'widgets' },
      { id: 'editor', label: '编辑器', icon: '📝', appId: 'editor' },
      { id: 'tasks', label: '任务管理器', icon: '📈', appId: 'tasks' },
      { id: 'settings', label: '设置', icon: '⚙', appId: 'settings' },
      { id: 'help', label: '操作说明', icon: '📖', appId: 'help' },
    ];
    // 文件图标由文件管理器系统提供
    const fileIcons = this.fileIcons || [];
    for (const it of items) {
      this.iconsEl.appendChild(this._iconEl(it));
    }
    for (const it of fileIcons) {
      this.iconsEl.appendChild(this._iconEl(it));
    }
  }

  setFileIcons(list) {
    this.fileIcons = list;
    this.renderIcons();
  }

  _iconEl(it) {
    const d = el('div', {
      class: 'desk-icon',
      'data-testid': 'desktop-icon',
      'data-app-id': it.appId || '',
      'data-file-path': it.filePath || '',
    }, [
      el('div', { class: 'ico', text: it.icon }),
      el('div', { class: 'lbl', text: it.label }),
    ]);
    d.addEventListener('click', (e) => {
      e.stopPropagation();
      this.iconsEl.querySelectorAll('.desk-icon.selected').forEach(x => x.classList.remove('selected'));
      d.classList.add('selected');
    });
    d.addEventListener('dblclick', () => {
      if (it.action) it.action();
      else if (it.appId) this.launch(it.appId);
    });
    return d;
  }

  renderStartApps() {
    this.startApps.innerHTML = '';
    const order = ['files', 'spreadsheet', 'browser', 'widgets', 'editor', 'tasks', 'settings', 'help'];
    for (const id of order) {
      const app = this.apps.get(id);
      if (!app) continue;
      const d = el('div', {
        class: 'start-app',
        'data-testid': 'launch-' + id,
        'data-app-id': id,
      }, [
        el('div', { class: 'ico', text: app.icon }),
        el('div', { class: 'lbl', text: app.name }),
      ]);
      d.addEventListener('click', () => {
        this.startMenu.classList.remove('open');
        this.launch(id);
      });
      this.startApps.appendChild(d);
    }
  }

  _filterStart(q) {
    q = (q || '').trim().toLowerCase();
    this.startApps.querySelectorAll('.start-app').forEach((d) => {
      const name = d.querySelector('.lbl').textContent.toLowerCase();
      d.style.display = !q || name.includes(q) ? '' : 'none';
    });
  }

  toggleStartMenu() {
    this.startMenu.classList.toggle('open');
    if (this.startMenu.classList.contains('open')) {
      const s = document.getElementById('start-search');
      s.value = '';
      this._filterStart('');
      s.focus();
    }
  }

  launch(appId, arg) {
    const app = this.apps.get(appId);
    if (!app) {
      this.notify('无法启动', '应用不存在: ' + appId, 'err');
      return;
    }
    this.startMenu.classList.remove('open');
    app.launch(arg);
  }

  renderTaskbar() {
    const wins = this.wm.list();
    this.taskbarApps.innerHTML = '';
    // 固定应用
    const pinned = ['files', 'spreadsheet', 'browser', 'editor'];
    for (const id of pinned) {
      const app = this.apps.get(id);
      if (!app) continue;
      const open = wins.filter(w => w.appId === id);
      const d = el('div', {
        class: 'task-item' + (open.some(w => w.id === this.wm.focusedId) ? ' active' : ''),
        'data-testid': 'taskbar-item',
        'data-app-id': id,
      }, [
        el('div', { class: 't-ico', text: app.icon }),
        el('div', { class: 't-title', text: app.name }),
      ]);
      d.addEventListener('click', () => {
        if (!open.length) this.launch(id);
        else {
          const w = open.find(x => x.id === this.wm.focusedId && !x.minimized) || open[0];
          if (w.minimized) this.wm.unminimize(w.id);
          else if (w.id === this.wm.focusedId) this.wm.minimize(w.id);
          else this.wm.focus(w.id);
        }
      });
      this.taskbarApps.appendChild(d);
    }
    // 其它运行中窗口
    for (const w of wins) {
      if (pinned.includes(w.appId)) continue;
      const d = el('div', {
        class: 'task-item' + (w.id === this.wm.focusedId && !w.minimized ? ' active' : ''),
        'data-testid': 'taskbar-item',
        'data-window-id': w.id,
        'data-app-id': w.appId,
      }, [
        el('div', { class: 't-ico', text: w.icon }),
        el('div', { class: 't-title', html: `${escapeHtml(w.title)}<div class="t-sys">${escapeHtml(w.systemId === 'outer' ? '根系统' : (w.systemName || w.systemId))}</div>` }),
      ]);
      d.addEventListener('click', () => {
        if (w.minimized) this.wm.unminimize(w.id);
        else if (w.id === this.wm.focusedId) this.wm.minimize(w.id);
        else this.wm.focus(w.id);
      });
      this.taskbarApps.appendChild(d);
    }
  }

  notify(title, body, kind = 'info', meta = {}) {
    const item = {
      id: Math.random().toString(36).slice(2),
      title, body, kind, meta,
      time: Date.now(),
      read: false,
    };
    this.notifications.unshift(item);
    if (this.notifications.length > 200) this.notifications.pop();
    this.bus.emit('notifications-changed');
    if (this.dnd) return item;
    const t = el('div', { class: 'toast ' + kind }, [
      el('div', { class: 't-title', text: title }),
      el('div', { class: 't-body', text: body }),
    ]);
    this.toastLayer.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 320);
    }, 4200);
    return item;
  }

  setDnd(v) {
    this.dnd = !!v;
    this.bus.emit('notifications-changed');
    this.bus.emit('settings-changed');
  }
}
