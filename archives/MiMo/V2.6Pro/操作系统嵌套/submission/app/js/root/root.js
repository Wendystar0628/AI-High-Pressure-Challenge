/* root.js — Root OS instance (host-implemented desktop). */
import { el, uid, clamp, fmtBytes, nowStamp } from '../utils.js';
import { VFS } from '../vfs.js';
import { makeWallpaper, getIcon, iconKindForFile } from '../host/wallpaper.js';
import { RootWindow } from './window.js';
import { Scheduler } from '../host/scheduler.js';
import { Interp, parse } from '../vm/ks.js';
import { ProjectionManager } from './projection.js';
import { buildHelicopterScene } from '../scene/heli-scene.js';
import { DEFAULT_KERNEL_SRC, DEFAULT_PROGRAMS } from '../sub/kernel-src.js';

const WALLPAPERS = [
  { id: 'valley', name: '山谷晨光' },
  { id: 'aurora', name: '极光夜空' },
  { id: 'dusk', name: '暮色群山' },
  { id: 'peaks', name: '雪峰远望' },
  { id: 'minimal', name: '极简光晕' }
];
const ACCENTS = ['#4f7cff', '#7c6df2', '#3ecf8e', '#f5b83d', '#ff6b9d', '#39b8e8', '#ff7a59', '#b266ff'];

export class RootSystem {
  constructor(hostEl, dataDir) {
    this.id = 'outer';
    this.name = '根系统';
    this.hostEl = hostEl;
    this.dataDir = dataDir;
    this.level = 0;
    this.state = 'running';
    this.vfs = new VFS('outer');
    this.vfs.seed();
    this.scheduler = new Scheduler(this);
    this.scheduler.totalBudget = 8000;
    this.windows = new Map();
    this.apps = {};
    this.notifications = [];
    this.clipboardHistory = [];
    this.subsystems = new Map(); // id -> SubInstance
    this.nextInnerId = 1;
    this.virtualTime = 0;
    this.rate = 1;
    this.settings = {
      wallpaper: 'valley',
      accent: '#4f7cff',
      scale: 1,
      name: '根系统',
      dnd: false
    };
    this.openWorkbooks = new Map(); // docId -> { name, cells, dirty }
    this.tickTimer = null;
    this.appFactories = {};
    this.subFactory = null; // set by boot
    this.projected = new Map(); // sourceWindowId -> projection window
    this.projections = new ProjectionManager(this);
    this._sheetSubscribers = [];
    this.storageQuota = 20 * 1024 * 1024;
    this.lastTickReal = performance.now();
  }

  now() { return this.virtualTime; }

  /* ---------- boot & fixtures ---------- */
  boot() {
    this._seedFixtures();
    this._buildDesktop();
    this._startClock();
    this._loadSettings();
    this.applySettings();
  }

  _seedFixtures() {
    const v = this.vfs;
    v.mkdir('/System');
    v.mkdir('/System/Programs');
    v.mkdir('/Demo');
    v.write('/Documents/欢迎.txt',
      '欢迎使用 Nested OS 嵌套图形操作系统。\n\n' +
      '这是一个递归系统树桌面环境：每个子系统都由父系统文件中的内核程序运行。\n' +
      '你可以从开始菜单打开应用，从系统管理创建子系统。\n\n' +
      '常用入口：\n' +
      '- 文件管理器：浏览、新建、复制、移动文件\n' +
      '- 电子表格：公式计算，数据可被子系统图表订阅\n' +
      '- 文本与程序编辑器：编辑 KernelScript 程序并运行\n' +
      '- 任务管理器：进程、预算与配额\n' +
      '- 浏览器：真实联网浏览\n' +
      '- 三维播放器：24 号直升机演出与飞行排演\n' +
      '- 图表工作台：实时数据可视化\n' +
      '- 系统管理：创建与管理子系统\n\n' +
      '点击桌面"操作说明"图标查看完整操作说明。');
    v.write('/Documents/操作说明.md', '# Nested OS 操作说明\n\n请从桌面"操作说明"应用查看完整内容。');
    v.write('/Demo/sample.sheet', {
      name: '示例工作簿.sheet',
      cells: {
        A1: '项目', B1: '数量', C1: '单价', D1: '小计',
        A2: '项目 A', B2: 24, C2: 6, D2: '=B2*C2',
        A3: '项目 B', B3: 12, C3: 8, D3: '=B3*C3',
        A4: '项目 C', B4: 18, C4: 4, D4: '=B4*C4'
      },
      colCount: 8, rowCount: 30
    });
    // real helicopter scene resource (editable data)
    v.write('/Demo/helicopter-24.scene', buildHelicopterScene());
    v.write('/Demo/场景说明.txt',
      'helicopter-24.scene 是 24 号直升机三维场景资源（JSON 格式）。\n' +
      '包含几何、材质、灯光、镜头与关键帧时序。\n' +
      '修改资源后重新打开播放器，画面按实际文件内容变化。\n');
    // kernel source & programs (real content)
    v.write('/System/Programs/kernel.ks', DEFAULT_KERNEL_SRC);
    for (const [name, content] of Object.entries(DEFAULT_PROGRAMS)) {
      v.write('/System/Programs/' + name, content);
    }
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem('nos-settings-' + this.dataDir);
      if (raw) Object.assign(this.settings, JSON.parse(raw));
    } catch (e) { }
  }
  saveSettings() {
    try { localStorage.setItem('nos-settings-' + this.dataDir, JSON.stringify(this.settings)); } catch (e) { }
  }

  /* ---------- desktop DOM ---------- */
  _buildDesktop() {
    this.hostEl.innerHTML = '';
    this.desktop = el('div', {
      class: 'system-desktop',
      'data-testid': 'os-desktop',
      'data-system-id': this.id
    });
    this.hostEl.appendChild(this.desktop);

    this.iconsLayer = el('div', { class: 'desktop-icons' });
    this.desktop.appendChild(this.iconsLayer);

    this.windowsLayer = el('div', { class: 'windows-layer' });
    this.desktop.appendChild(this.windowsLayer);

    this._buildTaskbar();
    this._buildStartMenu();
    this._buildNotifPanel();
    this._buildWidgetsPanel();
    this._buildSubsysPanel();

    this.toastStack = el('div', { class: 'toast-stack' });
    this.desktop.appendChild(this.toastStack);

    // desktop context menu + deselect
    this.desktop.addEventListener('mousedown', (e) => {
      if (e.target === this.desktop || e.target === this.iconsLayer) {
        this._clearIconSelection();
        this._closeMenus();
      }
    });
    this.desktop.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.app-window') || e.target.closest('.taskbar')) return;
      e.preventDefault();
      this._showDesktopMenu(e.clientX, e.clientY);
    });

    this._refreshIcons();
    this._updateTaskbarClock();
  }

  _buildTaskbar() {
    this.taskbar = el('div', { class: 'taskbar' });
    const left = el('div', { class: 'taskbar-left' });
    this.startToggle = el('div', {
      class: 'start-toggle', 'data-testid': 'start-toggle', title: '开始'
    }, [el('span', { text: '⊞' })]);
    left.appendChild(this.startToggle);

    const center = el('div', { class: 'taskbar-center' });
    this.taskbarCenter = center;

    const right = el('div', { class: 'taskbar-right' });
    this.trayNotif = el('div', {
      class: 'tray-btn', 'data-testid': 'notifications-toggle', title: '通知'
    }, [el('span', { text: '🔔' })]);
    this.trayWidgets = el('div', {
      class: 'tray-btn', 'data-testid': 'widgets-toggle', title: '小组件'
    }, [el('span', { text: '◫' })]);
    this.trayClock = el('div', { class: 'tray-clock' }, [
      el('div', { class: 't1', text: '--:--' }),
      el('div', { class: 't2', text: '----/--/--' })
    ]);
    right.appendChild(this.trayNotif);
    right.appendChild(this.trayWidgets);
    right.appendChild(this.trayClock);

    this.taskbar.appendChild(left);
    this.taskbar.appendChild(center);
    this.taskbar.appendChild(right);
    this.desktop.appendChild(this.taskbar);

    this.startToggle.addEventListener('click', () => this.toggleStartMenu());
    this.trayNotif.addEventListener('click', () => this.toggleNotifPanel());
    this.trayWidgets.addEventListener('click', () => this.toggleWidgetsPanel());
    this.trayClock.addEventListener('click', () => this.toggleWidgetsPanel());
  }

  _buildStartMenu() {
    this.startMenu = el('div', { class: 'start-menu', 'data-testid': 'start-menu' });
    const searchWrap = el('div', { class: 'start-search' });
    this.startSearchInput = el('input', { type: 'text', placeholder: '搜索应用…' });
    searchWrap.appendChild(this.startSearchInput);
    this.startApps = el('div', { class: 'start-apps' });
    const footer = el('div', { class: 'start-footer' }, [
      el('span', { text: this.settings.name }),
      el('span', { text: 'Nested OS' })
    ]);
    this.startMenu.appendChild(searchWrap);
    this.startMenu.appendChild(this.startApps);
    this.startMenu.appendChild(footer);
    this.desktop.appendChild(this.startMenu);

    this.startSearchInput.addEventListener('input', () => this._renderStartApps(this.startSearchInput.value));
    this.startSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = this.startApps.querySelector('.start-app');
        if (first) first.click();
      }
      e.stopPropagation();
    });
    this._renderStartApps('');
  }

  _renderStartApps(filter) {
    const apps = this._appList().filter(a => !filter || a.name.includes(filter) || a.appId.includes(filter));
    this.startApps.innerHTML = '';
    for (const a of apps) {
      const item = el('div', {
        class: 'start-app',
        'data-testid': 'launch-' + a.appId,
        'data-app-id': a.appId
      }, [
        el('div', { class: 'icon-img' }, []),
        el('div', { class: 'app-name', text: a.name })
      ]);
      const iconEl = item.querySelector('.icon-img');
      iconEl.style.backgroundImage = `url(${getIcon(a.icon, 30)})`;
      iconEl.style.backgroundSize = 'cover';
      item.addEventListener('click', () => {
        this.launchApp(a.appId);
        this.closeStartMenu();
      });
      this.startApps.appendChild(item);
    }
  }

  _appList() {
    return [
      { appId: 'files', name: '文件管理器', icon: 'files' },
      { appId: 'spreadsheet', name: '电子表格', icon: 'spreadsheet' },
      { appId: 'widgets', name: '小组件', icon: 'widgets' },
      { appId: 'editor', name: '文本与程序编辑器', icon: 'editor' },
      { appId: 'player', name: '三维播放器', icon: 'player' },
      { appId: 'charts', name: '图表工作台', icon: 'charts' },
      { appId: 'browser', name: '浏览器', icon: 'browser' },
      { appId: 'tasks', name: '任务管理器', icon: 'tasks' },
      { appId: 'settings', name: '设置', icon: 'settings' },
      { appId: 'systems', name: '系统管理', icon: 'system' },
      { appId: 'help', name: '操作说明', icon: 'text' }
    ];
  }

  _buildNotifPanel() {
    this.notifPanel = el('div', { class: 'notif-panel', 'data-testid': 'notif-panel' });
    const header = el('div', { class: 'notif-header' }, [
      el('h3', { text: '通知中心' }),
      el('div', {}, [
        el('button', { class: 'btn', text: '免打扰', onclick: () => this._toggleDnd() }),
        el('button', { class: 'btn', text: '清空', onclick: () => { this.notifications = []; this._renderNotifs(); } })
      ])
    ]);
    this.notifList = el('div', { class: 'notif-list', 'data-testid': 'widget-notifications' });
    this.notifPanel.appendChild(header);
    this.notifPanel.appendChild(this.notifList);
    this.desktop.appendChild(this.notifPanel);
    this._renderNotifs();
  }

  _toggleDnd() {
    this.settings.dnd = !this.settings.dnd;
    this.saveSettings();
    this.toast(this.settings.dnd ? '已开启免打扰' : '已关闭免打扰', '', 'good');
  }

  _renderNotifs() {
    this.notifList.innerHTML = '';
    if (!this.notifications.length) {
      this.notifList.appendChild(el('div', { class: 'notif-empty', text: '暂无通知' }));
      return;
    }
    for (const n of this.notifications.slice().reverse()) {
      this.notifList.appendChild(el('div', { class: 'notif-item' }, [
        el('div', { class: 'n-title', text: n.title }),
        el('div', { class: 'n-body', text: n.body }),
        el('div', { class: 'n-time', text: n.time })
      ]));
    }
  }

  notify(title, body) {
    const n = { title, body, time: nowStamp() };
    this.notifications.push(n);
    this._renderNotifs();
    if (!this.settings.dnd) this.toast(title, body);
  }

  _buildWidgetsPanel() {
    this.widgetsPanel = el('div', { class: 'widgets-panel', 'data-testid': 'widgets-panel' });
    const header = el('div', { class: 'notif-header' }, [
      el('h3', { text: '小组件' }),
      el('button', { class: 'btn', text: '关闭', onclick: () => this.widgetsPanel.classList.remove('open') })
    ]);
    const body = el('div', { class: 'widgets-body' });
    this.widgetsPanel.appendChild(header);
    this.widgetsPanel.appendChild(body);
    this.desktop.appendChild(this.widgetsPanel);
    this._buildWidgets(body);
  }

  _buildWidgets(body) {
    // clock & calendar
    const cal = el('div', { class: 'widget-card' }, [el('h4', { text: '时钟与日历' })]);
    this.wgClock = el('div', { class: 'wg-timer-display', text: '--:--:--' });
    cal.appendChild(this.wgClock);
    this.calMonthOffset = 0;
    const calHeader = el('div', { class: 'wg-cal-header' });
    const prevBtn = el('button', { class: 'btn', text: '‹' });
    const nextBtn = el('button', { class: 'btn', text: '›' });
    this.calLabel = el('span', { text: '' });
    calHeader.appendChild(prevBtn);
    calHeader.appendChild(this.calLabel);
    calHeader.appendChild(nextBtn);
    cal.appendChild(calHeader);
    this.calGrid = el('div', { class: 'wg-cal-grid' });
    cal.appendChild(this.calGrid);
    prevBtn.addEventListener('click', () => { this.calMonthOffset--; this._renderCalendar(); });
    nextBtn.addEventListener('click', () => { this.calMonthOffset++; this._renderCalendar(); });
    body.appendChild(cal);
    this._renderCalendar();

    // countdown & stopwatch
    const timer = el('div', { class: 'widget-card' }, [el('h4', { text: '倒计时与秒表' })]);
    this.wgTimerDisplay = el('div', { class: 'wg-timer-display', text: '00:00' });
    const timerInput = el('input', {
      type: 'number', value: 5, min: 1, 'data-testid': 'widget-timer-input',
      style: 'width:80px'
    });
    const timerRow = el('div', { class: 'wg-row' }, [
      timerInput, el('span', { text: '秒' }),
      el('button', { class: 'btn primary', 'data-testid': 'widget-timer-start', text: '开始', onclick: () => this._startTimer(parseInt(timerInput.value) || 5) }),
      el('button', { class: 'btn', 'data-testid': 'widget-timer-pause', text: '暂停', onclick: () => this._pauseTimer() }),
      el('button', { class: 'btn', 'data-testid': 'widget-timer-reset', text: '重置', onclick: () => this._resetTimer() })
    ]);
    timer.appendChild(this.wgTimerDisplay);
    timer.appendChild(timerRow);
    this.wgTimerState = { remain: 0, running: false, total: 0 };
    body.appendChild(timer);

    // stopwatch
    const sw = el('div', { class: 'widget-card' }, [el('h4', { text: '秒表' })]);
    this.wgSwDisplay = el('div', { class: 'wg-timer-display', text: '00:00.0' });
    const swRow = el('div', { class: 'wg-row' }, [
      el('button', { class: 'btn primary', text: '开始', onclick: () => this._swStart() }),
      el('button', { class: 'btn', text: '停止', onclick: () => this._swStop() }),
      el('button', { class: 'btn', text: '清零', onclick: () => { this.wgSwState.elapsed = 0; this.wgSwDisplay.textContent = '00:00.0'; } })
    ]);
    sw.appendChild(this.wgSwDisplay);
    sw.appendChild(swRow);
    this.wgSwState = { elapsed: 0, running: false };
    body.appendChild(sw);

    // notes
    const note = el('div', { class: 'widget-card' }, [el('h4', { text: '便笺' })]);
    const noteArea = el('textarea', {
      class: 'wg-note-area', 'data-testid': 'widget-note-text',
      placeholder: '记点什么…'
    });
    noteArea.value = localStorage.getItem('nos-note') || '';
    const noteSave = el('button', {
      class: 'btn primary', 'data-testid': 'widget-note-save', text: '保存',
      onclick: () => {
        localStorage.setItem('nos-note', noteArea.value);
        this.vfs.write('/Documents/便笺.txt', noteArea.value);
        this.toast('便笺已保存', '已写入 文档/便笺.txt', 'good');
      }
    });
    note.appendChild(noteArea);
    note.appendChild(el('div', { class: 'wg-row', style: 'margin-top:8px' }, [noteSave]));
    body.appendChild(note);

    // clipboard history
    const clip = el('div', { class: 'widget-card' }, [el('h4', { text: '剪贴板历史' })]);
    this.wgClipList = el('div', {
      style: 'display:flex;flex-direction:column;gap:6px;max-height:140px;overflow-y:auto',
      'data-testid': 'widget-clipboard-list'
    });
    clip.appendChild(this.wgClipList);
    body.appendChild(clip);
    this._renderClipboard();

    // quick settings
    const quick = el('div', { class: 'widget-card' }, [el('h4', { text: '快捷设置' })]);
    const qg = el('div', { class: 'wg-quick-grid' });
    this.qsDnd = el('div', {
      class: 'wg-quick-tile' + (this.settings.dnd ? ' on' : ''), text: '免打扰',
      onclick: () => { this._toggleDnd(); this.qsDnd.classList.toggle('on', this.settings.dnd); }
    });
    this.qsDark = el('div', { class: 'wg-quick-tile on', text: '深色模式' });
    const qsSettings = el('div', {
      class: 'wg-quick-tile', text: '全部设置',
      onclick: () => { this.launchApp('settings'); this.widgetsPanel.classList.remove('open'); }
    });
    qg.appendChild(this.qsDnd);
    qg.appendChild(this.qsDark);
    qg.appendChild(qsSettings);
    quick.appendChild(qg);
    body.appendChild(quick);
  }

  pushClipboard(text) {
    if (!text) return;
    this.clipboardHistory = this.clipboardHistory.filter(x => x !== text);
    this.clipboardHistory.unshift(text);
    if (this.clipboardHistory.length > 30) this.clipboardHistory.length = 30;
    this._renderClipboard();
  }
  _renderClipboard() {
    if (!this.wgClipList) return;
    this.wgClipList.innerHTML = '';
    if (!this.clipboardHistory.length) {
      this.wgClipList.appendChild(el('div', { class: 'wg-clip-item', text: '暂无记录' }));
      return;
    }
    for (const t of this.clipboardHistory) {
      const item = el('div', { class: 'wg-clip-item', text: t.slice(0, 120) });
      item.addEventListener('click', () => {
        try { navigator.clipboard.writeText(t); } catch (e) { }
        this.toast('已复制到剪贴板', t.slice(0, 40));
      });
      this.wgClipList.appendChild(item);
    }
  }

  _startTimer(seconds) {
    this.wgTimerState = { remain: seconds * 1000, total: seconds * 1000, running: true };
  }
  _pauseTimer() { this.wgTimerState.running = false; }
  _resetTimer() { this.wgTimerState = { remain: 0, total: 0, running: false }; this.wgTimerDisplay.textContent = '00:00'; }
  _swStart() { this.wgSwState.running = true; }
  _swStop() { this.wgSwState.running = false; }

  _renderCalendar() {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth() + this.calMonthOffset;
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    this.calLabel.textContent = `${first.getFullYear()} 年 ${first.getMonth() + 1} 月`;
    this.calGrid.innerHTML = '';
    for (const dow of ['日', '一', '二', '三', '四', '五', '六']) {
      this.calGrid.appendChild(el('div', { class: 'dow', text: dow }));
    }
    const startDow = first.getDay();
    const prevDays = new Date(y, m, 0).getDate();
    for (let i = 0; i < startDow; i++) {
      this.calGrid.appendChild(el('div', { class: 'day other', text: String(prevDays - startDow + i + 1) }));
    }
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = day === today.getDate() && m === today.getMonth() && y === today.getFullYear();
      this.calGrid.appendChild(el('div', { class: 'day' + (isToday ? ' today' : ''), text: String(day) }));
    }
    const rest = (7 - ((startDow + daysInMonth) % 7)) % 7;
    for (let i = 1; i <= rest; i++) this.calGrid.appendChild(el('div', { class: 'day other', text: String(i) }));
  }

  _buildSubsysPanel() {
    this.subsysPanel = el('div', { class: 'subsys-panel', id: 'subsys-panel' });
    const header = el('div', { class: 'notif-header' }, [
      el('h3', { text: '直属子系统' }),
      el('button', {
        class: 'btn primary', 'data-testid': 'system-new', text: '新建子系统',
        onclick: () => this.createSubsystem()
      })
    ]);
    this.subsysList = el('div', { class: 'subsys-list' });
    this.subsysPanel.appendChild(header);
    this.subsysPanel.appendChild(this.subsysList);
    this.desktop.appendChild(this.subsysPanel);
    this._renderSubsysList();
  }

  toggleSubsysPanel() {
    this.subsysPanel.classList.toggle('open');
    if (this.subsysPanel.classList.contains('open')) this._renderSubsysList();
  }

  _renderSubsysList() {
    this.subsysList.innerHTML = '';
    if (!this.subsystems.size) {
      this.subsysList.appendChild(el('div', { class: 'notif-empty', text: '暂无子系统，点击上方按钮创建' }));
      return;
    }
    for (const [id, sub] of this.subsystems) {
      const card = el('div', { class: 'subsys-card', 'data-target-system-id': id });
      const stateCls = sub.state === 'running' ? 'running' : sub.state === 'paused' ? 'paused' : 'error';
      const head = el('div', { class: 'sc-head' }, [
        el('div', { class: 'sc-name', text: `${sub.name} (${id})` }),
        el('div', { class: 'sc-state ' + stateCls, text: sub.state === 'running' ? '运行中' : sub.state === 'paused' ? '已暂停' : '内核错误' })
      ]);
      const meta = el('div', {
        class: 'sc-meta',
        text: `层级 ${sub.level} · 进程 ${sub.procCount()} · 虚拟时间 ${Math.floor(sub.now() / 1000)}s · 预算拨付 ${sub.budgetGrant}`
      });
      const actions = el('div', { class: 'sc-actions' }, [
        el('button', {
          class: 'btn', 'data-testid': 'system-pause', 'data-target-system-id': id, text: '暂停',
          onclick: () => this.pauseSubsystem(id)
        }),
        el('button', {
          class: 'btn', 'data-testid': 'system-resume', 'data-target-system-id': id, text: '继续',
          onclick: () => this.resumeSubsystem(id)
        }),
        el('button', {
          class: 'btn', 'data-testid': 'system-restart', 'data-target-system-id': id, text: '重启',
          onclick: () => this.restartSubsystem(id)
        }),
        el('button', {
          class: 'btn', text: '单步',
          onclick: () => this.stepSubsystem(id)
        }),
        el('button', {
          class: 'btn', text: '快照',
          onclick: () => this.snapshotSubsystem(id)
        }),
        el('button', {
          class: 'btn', text: '打开桌面',
          onclick: () => { if (sub.openWindow) sub.openWindow(); }
        }),
        el('button', {
          class: 'btn', text: '改内核',
          onclick: () => this.openKernelSource(id)
        }),
        el('button', {
          class: 'btn danger', text: '关闭',
          onclick: () => this.closeSubsystem(id)
        })
      ]);
      card.appendChild(head);
      card.appendChild(meta);
      card.appendChild(actions);
      this.subsysList.appendChild(card);
    }
  }

  /* ---------- clock & tick ---------- */
  _startClock() {
    const tick = () => {
      const nowReal = performance.now();
      const dtReal = Math.min(100, nowReal - this.lastTickReal);
      this.lastTickReal = nowReal;
      if (this.state === 'running') {
        this.virtualTime += dtReal * this.rate;
      }
      this._updateClockWidgets(dtReal);
      this._tickSubsystems(dtReal);
      this._updateTaskbarClock();
    };
    this.tickTimer = setInterval(tick, 100);
  }

  _updateClockWidgets(dt) {
    if (this.wgClock) {
      const d = new Date();
      const p = x => String(x).padStart(2, '0');
      this.wgClock.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
    if (this.wgTimerState && this.wgTimerState.running) {
      this.wgTimerState.remain -= dt;
      if (this.wgTimerState.remain <= 0) {
        this.wgTimerState.running = false;
        this.wgTimerState.remain = 0;
        this.notify('倒计时结束', `设定的倒计时已完成（${Math.round(this.wgTimerState.total / 1000)} 秒）`);
      }
      const s = Math.ceil(this.wgTimerState.remain / 1000);
      this.wgTimerDisplay.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }
    if (this.wgSwState && this.wgSwState.running) {
      this.wgSwState.elapsed += dt;
      const t = this.wgSwState.elapsed / 1000;
      this.wgSwDisplay.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t * 10) % 10)}`;
    }
  }

  _updateTaskbarClock() {
    if (!this.trayClock) return;
    const d = new Date();
    const p = x => String(x).padStart(2, '0');
    this.trayClock.querySelector('.t1').textContent = `${p(d.getHours())}:${p(d.getMinutes())}`;
    this.trayClock.querySelector('.t2').textContent = `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
  }

  _tickSubsystems(dtReal) {
    for (const [id, sub] of this.subsystems) {
      try {
        sub.hostTick(dtReal * this.rate);
      } catch (e) {
        console.error('subsystem tick error', id, e);
        sub.state = 'error';
        sub.kernelError = e.message || String(e);
      }
    }
  }

  /* ---------- desktop icons ---------- */
  _refreshIcons() {
    this.iconsLayer.innerHTML = '';
    const icons = [
      { id: 'this-pc', label: '此电脑', appId: 'files', icon: 'files', path: '/' },
      { id: 'documents', label: '文档', appId: 'files', icon: 'folder', path: '/Documents' },
      { id: 'demo', label: '示例素材', appId: 'files', icon: 'folder', path: '/Demo' },
      { id: 'spreadsheet', label: '电子表格', appId: 'spreadsheet', icon: 'spreadsheet' },
      { id: 'browser', label: '浏览器', appId: 'browser', icon: 'browser' },
      { id: 'editor', label: '编辑器', appId: 'editor', icon: 'editor' },
      { id: 'systems', label: '系统管理', appId: 'systems', icon: 'system' },
      { id: 'help', label: '操作说明', appId: 'help', icon: 'text' }
    ];
    for (const it of icons) {
      const node = el('div', {
        class: 'desktop-icon',
        'data-testid': 'desktop-icon',
        'data-app-id': it.appId,
        'data-file-path': it.path || ''
      }, [
        el('div', { class: 'icon-img' }),
        el('div', { class: 'icon-label', text: it.label })
      ]);
      node.querySelector('.icon-img').style.backgroundImage = `url(${getIcon(it.icon, 44)})`;
      node.querySelector('.icon-img').style.backgroundSize = 'cover';
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        this._clearIconSelection();
        node.classList.add('selected');
        this._selectedIcon = node;
      });
      node.addEventListener('dblclick', () => {
        if (it.appId === 'files' && it.path) this.launchApp('files', { path: it.path });
        else this.launchApp(it.appId);
      });
      this.iconsLayer.appendChild(node);
    }
    // file icons from /Documents and /Demo
    for (const dir of ['/Demo', '/Documents']) {
      let items = [];
      try { items = this.vfs.list(dir); } catch (e) { }
      for (const f of items.slice(0, 6)) {
        if (f.type === 'dir' && f.name === 'RecycleBin') continue;
        const node = el('div', {
          class: 'desktop-icon',
          'data-testid': 'desktop-icon',
          'data-file-path': dir + '/' + f.name
        }, [
          el('div', { class: 'icon-img' }),
          el('div', { class: 'icon-label', text: f.name })
        ]);
        node.querySelector('.icon-img').style.backgroundImage = `url(${getIcon(iconKindForFile(f.name, f.type), 44)})`;
        node.querySelector('.icon-img').style.backgroundSize = 'cover';
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          this._clearIconSelection();
          node.classList.add('selected');
        });
        node.addEventListener('dblclick', () => this.openFile(dir + '/' + f.name));
        this.iconsLayer.appendChild(node);
      }
    }
  }

  _clearIconSelection() {
    this.iconsLayer.querySelectorAll('.desktop-icon.selected').forEach(n => n.classList.remove('selected'));
    this._selectedIcon = null;
  }

  /* ---------- window management ---------- */
  createWindow(opts) {
    const win = new RootWindow({
      ...opts,
      systemId: this.id,
      onClose: () => {
        if (opts.onClose) {
          const r = opts.onClose(win);
          if (r === false) return false;
        }
        this.windows.delete(win.id);
        this._refreshTaskbar();
        return true;
      },
      onFocus: () => {
        this.windows.forEach(w => { if (w !== win) w.blur(); });
        this._refreshTaskbar();
      },
      onMinimize: () => {
        // focus next window
        const rest = [...this.windows.values()].filter(w => w !== win && w.state !== 'minimized');
        if (rest.length) rest.sort((a, b) => b.z - a.z)[0].focus();
        this._refreshTaskbar();
      },
      onResize: (w, h) => {
        if (opts.onResize) opts.onResize(w, h);
      }
    });
    this.windows.set(win.id, win);
    this.windowsLayer.appendChild(win.el);
    win.focus();
    this._refreshTaskbar();
    return win;
  }

  _refreshTaskbar() {
    if (!this.taskbarCenter) return;
    this.taskbarCenter.innerHTML = '';
    for (const w of this.windows.values()) {
      const item = el('div', {
        class: 'taskbar-item' + (w.state !== 'minimized' ? ' running' : '') + (w.el.classList.contains('focused') ? ' active' : ''),
        'data-testid': 'taskbar-item',
        'data-window-id': w.id
      }, [
        el('div', { class: 'tb-icon' }),
        el('span', { text: w.title })
      ]);
      item.querySelector('.tb-icon').style.backgroundImage = `url(${getIcon(w.icon, 18)})`;
      item.querySelector('.tb-icon').style.backgroundSize = 'cover';
      item.addEventListener('click', () => {
        if (w.state === 'minimized') w.restore();
        else if (w.el.classList.contains('focused')) w.minimize();
        else w.focus();
      });
      this.taskbarCenter.appendChild(item);
    }
  }

  /* ---------- menus & dialogs ---------- */
  _closeMenus() {
    if (this._menuEl && this._menuEl.parentElement) this._menuEl.parentElement.removeChild(this._menuEl);
    this._menuEl = null;
    this.closeStartMenu();
    this.notifPanel.classList.remove('open');
    this.subsysPanel.classList.remove('open');
    // keep widgets panel unless clicking outside
  }
  closeStartMenu() {
    this.startMenu.classList.remove('open');
    this.startToggle.classList.remove('active');
  }
  toggleStartMenu() {
    const open = !this.startMenu.classList.contains('open');
    this.startMenu.classList.toggle('open', open);
    this.startToggle.classList.toggle('active', open);
    if (open) {
      this.startSearchInput.value = '';
      this._renderStartApps('');
      this.startSearchInput.focus();
    }
  }
  toggleNotifPanel() {
    this._closeMenus();
    this.notifPanel.classList.add('open');
    this._renderNotifs();
  }
  toggleWidgetsPanel() {
    const open = !this.widgetsPanel.classList.contains('open');
    this._closeMenus();
    this.widgetsPanel.classList.toggle('open', open);
  }

  _showDesktopMenu(x, y) {
    this._closeMenus();
    const menu = el('div', { class: 'menu desktop-context' });
    const items = [
      { label: '刷新桌面', fn: () => this._refreshIcons() },
      { label: '新建文件夹', fn: () => this._newFolderOnDesktop() },
      { label: '打开终端（编辑器）', fn: () => this.launchApp('editor') },
      { sep: true },
      { label: '显示设置', fn: () => this.launchApp('settings') },
      { label: '新建子系统', fn: () => this.createSubsystem() },
      { sep: true },
      { label: '操作说明', fn: () => this.launchApp('help') }
    ];
    for (const it of items) {
      if (it.sep) { menu.appendChild(el('div', { class: 'menu-sep' })); continue; }
      const mi = el('div', { class: 'menu-item', text: it.label });
      mi.addEventListener('click', () => { this._closeMenus(); it.fn(); });
      menu.appendChild(mi);
    }
    menu.style.left = Math.min(x, window.innerWidth - 220) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 320) + 'px';
    this.desktop.appendChild(menu);
    this._menuEl = menu;
  }

  _newFolderOnDesktop() {
    const name = '新建文件夹';
    let i = 0, p = '/Documents/' + name;
    while (this.vfs.exists(p)) p = '/Documents/' + name + ' ' + (++i);
    this.vfs.mkdir(p);
    this._refreshIcons();
    this.notify('已新建文件夹', p);
  }

  dialog(opts) {
    return new Promise((resolve) => {
      const backdrop = el('div', { class: 'dialog-backdrop' });
      const actions = el('div', { class: 'dialog-actions' });
      for (const b of (opts.buttons || [{ label: '确定', value: true }])) {
        const btn = el('button', {
          class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''),
          text: b.label
        });
        btn.addEventListener('click', () => {
          document.body.removeChild(backdrop);
          resolve(b.value);
        });
        actions.appendChild(btn);
      }
      const dlg = el('div', { class: 'dialog' }, [
        el('h3', { text: opts.title || '提示' }),
        el('p', { text: opts.message || '' }),
        actions
      ]);
      backdrop.appendChild(dlg);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          document.body.removeChild(backdrop);
          resolve(null);
        }
      });
      document.body.appendChild(backdrop);
    });
  }

  toast(title, body, kind) {
    if (!this.toastStack) return;
    const t = el('div', { class: 'toast' + (kind ? ' ' + kind : '') }, [
      el('div', { class: 'toast-title', text: title }),
      body ? el('div', { class: 'toast-body', text: body }) : null
    ]);
    this.toastStack.appendChild(t);
    setTimeout(() => { if (t.parentElement) t.parentElement.removeChild(t); }, 4200);
  }

  /* ---------- settings ---------- */
  applySettings() {
    const wp = makeWallpaper(this.settings.wallpaper, this.settings.accent);
    this.desktop.style.backgroundImage = `url(${wp})`;
    this.desktop.style.backgroundSize = 'cover';
    document.documentElement.style.setProperty('--accent', this.settings.accent);
    document.documentElement.style.fontSize = (13 * this.settings.scale) + 'px';
    this.hostEl.style.zoom = this.settings.scale;
  }

  /* ---------- app launching ---------- */
  launchApp(appId, params) {
    switch (appId) {
      case 'files': return this.apps.files ? this.apps.files.open(params) : this._stubApp('文件管理器', 'files');
      case 'spreadsheet': return this.apps.spreadsheet ? this.apps.spreadsheet.open(params) : this._stubApp('电子表格', 'spreadsheet');
      case 'widgets': this.toggleWidgetsPanel(); return null;
      case 'editor': return this.apps.editor ? this.apps.editor.open(params) : this._stubApp('编辑器', 'editor');
      case 'browser': return this.apps.browser ? this.apps.browser.open(params) : this._stubApp('浏览器', 'browser');
      case 'player': return this.apps.player ? this.apps.player.open(params) : this._stubApp('播放器', 'player');
      case 'charts': return this.apps.charts ? this.apps.charts.open(params) : this._stubApp('图表工作台', 'charts');
      case 'tasks': return this.apps.tasks ? this.apps.tasks.open(params) : this._stubApp('任务管理器', 'tasks');
      case 'settings': return this.apps.settings ? this.apps.settings.open(params) : this._stubApp('设置', 'settings');
      case 'systems': this.toggleSubsysPanel(); return null;
      case 'help': return this.apps.help ? this.apps.help.open(params) : this._stubApp('操作说明', 'text');
      default: return this._stubApp(appId, 'unknown');
    }
  }

  _stubApp(name, icon) {
    return this.createWindow({
      appId: 'stub', title: name, icon, w: 560, h: 400,
      onResize: null
    });
  }

  openFile(path) {
    const st = this.vfs.stat(path);
    if (!st) return;
    if (st.type === 'dir') return this.launchApp('files', { path });
    const name = st.name.toLowerCase();
    if (name.endsWith('.sheet')) return this.launchApp('spreadsheet', { path });
    if (name.endsWith('.ks') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.js')) {
      return this.launchApp('editor', { path });
    }
    if (name.endsWith('.scene')) {
      return this.launchApp('player', { path });
    }
    if (name.endsWith('.rec')) {
      return this.launchApp('player', { path, mode: 'replay' });
    }
    if (name.endsWith('.snap')) {
      this._openSnapshot(path);
      return null;
    }
    return this.launchApp('editor', { path });
  }

  _openSnapshot(path) {
    try {
      const snap = this.vfs.read(path);
      this.dialog({
        title: '快照文件',
        message: `快照 ${snap.id || snap.name || '未知'}（层级 ${snap.level || '?'}）。可以恢复到原实例或从中分叉。`,
        buttons: [
          { label: '取消', value: null },
          { label: '分叉为新子系统', value: 'fork', primary: true }
        ]
      }).then(r => {
        if (r !== 'fork') return;
        const id = 'inner-' + (this.nextInnerId++);
        const sub = this.subFactory({
          id, parentId: this.id, parent: this,
          level: (snap.level || 1),
          name: (snap.name || 'snapshot') + '-分叉',
          budgetGrant: snap.budgetGrant || 1500
        });
        this.subsystems.set(id, sub);
        sub.restoreSnapshot(snap);
        sub.id = id;
        sub.parentId = this.id;
        this._renderSubsysList();
        sub.openWindow();
        this.notify('已从快照分叉', id);
      });
    } catch (e) {
      this.toast('快照打开失败', e.message, 'bad');
    }
  }

  /* ---------- subsystem management ---------- */
  createSubsystem(opts = {}) {
    const id = 'inner-' + (this.nextInnerId++);
    const sub = this.subFactory({
      id, parentId: this.id, parent: this,
      level: this.level + 1,
      name: opts.name || id,
      budgetGrant: opts.budgetGrant || 1500
    });
    this.subsystems.set(id, sub);
    sub.boot();
    this._renderSubsysList();
    this.notify('已创建子系统', `${id} 已启动`);
    if (opts.open !== false) sub.openWindow();
    return sub;
  }

  pauseSubsystem(id) {
    const s = this.subsystems.get(id);
    if (s) { s.pause(); this._renderSubsysList(); this.notify('子树已暂停', id + ' 及其后代已停止推进'); }
  }
  resumeSubsystem(id) {
    const s = this.subsystems.get(id);
    if (s) { s.resume(); this._renderSubsysList(); }
  }
  stepSubsystem(id) {
    const s = this.subsystems.get(id);
    if (s) { s.stepOnce(); this._renderSubsysList(); this.toast('单步执行', `${id} 推进一个逻辑步`); }
  }
  restartSubsystem(id) {
    const s = this.subsystems.get(id);
    if (s) {
      s.restart();
      this._renderSubsysList();
      this.notify('子系统已重启', id + ' 已重新载入内核');
    }
  }
  async closeSubsystem(id) {
    const s = this.subsystems.get(id);
    if (!s) return;
    const ok = await this.dialog({
      title: '关闭子系统',
      message: `确认停止 ${id} 的整棵子树？已保存的快照仍可重新打开。`,
      buttons: [{ label: '取消', value: false }, { label: '关闭', value: true, danger: true }]
    });
    if (!ok) return;
    s.shutdown();
    this.subsystems.delete(id);
    this._renderSubsysList();
    this.notify('子系统已关闭', id);
  }
  snapshotSubsystem(id) {
    const s = this.subsystems.get(id);
    if (!s) return;
    const name = `${id}-快照-${Date.now().toString(36)}`;
    const snap = s.createSnapshot();
    this.vfs.write('/Documents/' + name + '.snap', snap);
    this.notify('快照已保存', '/Documents/' + name + '.snap');
    return name;
  }

  openKernelSource(id) {
    const s = this.subsystems.get(id);
    if (!s) return;
    const path = '/System/Programs/kernel.ks';
    this.launchApp('editor', { path });
    this.toast('内核源文件', `${id} 的内核程序在编辑器中打开，保存后重启该子系统生效`);
  }
}
