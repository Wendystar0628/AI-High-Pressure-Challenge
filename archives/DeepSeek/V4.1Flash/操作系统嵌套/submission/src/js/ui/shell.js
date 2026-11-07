/* 桌面外壳：多层嵌套桌面、窗口、任务栏、开始菜单、托盘、投送与对话框 */
import { rt, changed, on } from '../store.js';
import * as M from '../model.js';
import { el, clamp, deepClone, fmtNum, pathBase, pathExt, newId } from '../util.js';
import { iconSvg, appIcon, brandMark, ui as glyph, APP_META } from '../icons.js';
import { wallpaperCss, innerWallpaper, ACCENTS, WALLPAPERS } from '../wallpapers.js';
import { toast, dialog, promptValue, confirmDialog, chooseFromList, showMenu } from './common.js';
import { registry } from './apps/index.js';
import { createWidgetsPanel } from './apps/widgets.js';
import { bootSystem, restartKernel, stepSubtree, pauseSystem, resumeSystem, setSpeed } from '../scheduler.js';
import { dispatchPlayerCommand, loadFlightRecord } from '../services.js';
import { showChildDesktop } from './system-ops.js';
import { APP_SERVICES, endAppServices, reviveAppServices } from '../kernel.js';

const ROOT_ICONS = [
  { appId: 'files' }, { appId: 'spreadsheet' }, { appId: 'widgets' }, { appId: 'editor' },
  { appId: 'browser' }, { appId: 'tasks' }, { appId: 'settings' }, { appId: 'systems' },
  { appId: 'guide' }, { file: '/Demo/sample.sheet', label: '示例工作簿', icon: 'spreadsheet' },
  { file: '/Demo/helicopter-24.scene', label: '24 号场景源文件', icon: 'player' }
];
const INNER_ICONS = [
  { appId: 'player' }, { appId: 'charts' }, { appId: 'files' }, { appId: 'editor' },
  { appId: 'tasks' }, { appId: 'systems' }, { appId: 'guide' },
  { file: '/Demo/helicopter-24.scene', label: '24 号场景', icon: 'player' }
];

const APP_LABELS = {
  files: '文件管理器', spreadsheet: '电子表格', widgets: '桌面小组件', editor: '编辑器',
  browser: '浏览器', tasks: '任务管理器', settings: '设置', systems: '系统管理',
  player: '三维播放器', charts: '图表工作台', guide: '操作说明'
};

export class UI {
  constructor(rootEl) {
    this.rootEl = rootEl;
    this.model = null;
    this.views = new Map();
    this.activeSystemId = 'outer';
    this.toast = toast;
    this._lastTick = 0;
    this.globalBound = false;
    this.dialogs = dialog;
    this.bindGlobal();
  }
  bindGlobal() {
    if (this.globalBound) return;
    this.globalBound = true;
    document.addEventListener('pointerdown', (e) => {
      const osEl = e.target.closest && e.target.closest('.os-desktop');
      if (osEl) {
        const sid = osEl.dataset.systemId;
        this.activeSystemId = sid;
        // 键盘焦点只停留在当前点击的桌面内
        const active = document.activeElement;
        if (active && active !== document.body && !osEl.contains(active)) {
          try { active.blur(); } catch (e) {}
        }
        const view = this.views.get(sid);
        if (view && view.drawer) {
          // 点击任务栏/开始菜单/小组件以外区域时关闭抽屉
          if (!e.target.closest('.start-menu') && !e.target.closest('.widgets-panel') && !e.target.closest('.start-btn') && !e.target.closest('.widgets-toggle') && !e.target.closest('.tray-btn')) {
            view.closeDrawers();
          }
        }
      }
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const view = this.views.get(this.activeSystemId);
        if (view) {
          if (view.modalLayer.classList.contains('open')) return; // 对话框自行处理
          view.closeDrawers();
        }
      }
    });
  }
  mount(model) {
    this.model = model;
    this.rebuild();
  }
  view(id) { return this.views.get(id); }
  rebuild() {
    for (const v of [...this.views.values()]) v.destroy();
    this.views.clear();
    this.rootEl.innerHTML = '';
    const root = this.model.systems[this.model.rootId];
    if (!root) return;
    const view = new SystemView(this, root, this.rootEl, true);
    this.views.set(root.id, view);
    view.mount();
  }
  refresh(reason = '') {
    if (!this.model) return;
    // 清理已被删除的系统视图
    for (const [id, view] of [...this.views.entries()]) {
      if (!this.model.systems[id]) { view.destroy(); this.views.delete(id); }
    }
    for (const view of [...this.views.values()]) {
      if (!this.model.systems[view.sys.id]) continue;
      view.sync(reason);
    }
  }
  ensureChildView(child, host) {
    let view = this.views.get(child.id);
    if (view && view.rootEl.parentElement === host) return view;
    if (view) { view.destroy(); this.views.delete(child.id); }
    if (!host) return null;
    view = new SystemView(this, child, host, false);
    view.mount();
    this.views.set(child.id, view);
    return view;
  }
  destroyChildView(sysId) {
    const v = this.views.get(sysId);
    if (v) { v.destroy(); this.views.delete(sysId); }
  }
  onTick(dt) {
    this._annotAcc = (this._annotAcc || 0) + dt;
    if (this._annotAcc > 1) {
      this._annotAcc = 0;
      for (const v of this.views.values()) v.annotateControls();
    }
    for (const v of this.views.values()) v.onTick(dt);
  }
  openApp(sys, appId, opts = {}) {
    if (!sys) return null;
    if (APP_SERVICES[appId]) reviveAppServices(sys, appId);
    if (appId === 'widgets') {
      const view = this.views.get(sys.id);
      if (view && view.widgetsPanel) view.widgetsPanel.toggle();
      return null;
    }
    if (appId === 'player' && !sys.isRoot) return this.openPlayer(sys, opts.path, opts);
    // 子系统的播放器/图表在对应层提供
    const win = M.openWindow(this.model, sys, appId, opts);
    if (!win) return null;
    this.refresh('open-app');
    return win;
  }
  openFile(sys, path) {
    const ext = pathExt(path);
    if (ext === 'sheet') {
      if (!sys.isRoot) { toast('无法打开', '电子表格是根系统的应用，请到根桌面打开。', 'warn', sys); return; }
      return this.openSpreadsheet(sys, path);
    }
    if (ext === 'scene') {
      if (sys.isRoot) {
        toast('请拖入子系统', '根系统不提供三维播放器。把场景文件拖入任一子系统的播放器或文件管理器，或在新子系统中打开。', 'warn', sys);
        return;
      }
      return this.openPlayer(sys, path);
    }
    if (ext === 'flight') {
      if (sys.isRoot) { toast('请使用子系统', '飞行记录需要由子系统的三维播放器打开。', 'warn', sys); return; }
      return this.openPlayer(sys, null, { recordPath: path });
    }
    if (ext === 'nest' || ext === 'txt' || ext === 'md' || ext === 'json' || ext === '' || ext === 'log') {
      return this.openEditor(sys, path);
    }
    toast('无法打开', `没有与 .${ext} 关联的应用`, 'warn', sys);
  }
  openEditor(sys, path, opts = {}) {
    const win = M.openWindow(this.model, sys, 'editor', { payload: { path }, title: path ? pathBase(path) : '未命名.nest' });
    this.refresh('open-editor');
    return win;
  }
  openPlayer(sys, path, opts = {}) {
    reviveAppServices(sys, 'player');
    const scenePath = opts.recordPath ? null : (path || '/Demo/helicopter-24.scene');
    // 同一系统复用已打开的播放器窗口，避免双击文件后堆积多个播放器
    const existing = sys.windows.find(w => w.appId === 'player');
    if (existing && !opts.forceNew) {
      let p = sys.apps.players[existing.id];
      if (!p) {
        p = M.makePlayerState(sys, existing.id, scenePath || '/Demo/helicopter-24.scene');
        sys.apps.players[existing.id] = p;
      }
      existing.payload = existing.payload || {};
      existing.minimized = false;
      existing.maximized = false;
      existing.snap = null;
      if (opts.recordPath) {
        existing.payload.recordPath = opts.recordPath;
        existing.payload.scenePath = null;
        const r = loadFlightRecord(sys, opts.recordPath, existing.id);
        if (!r.ok) toast('记录打开失败', r.error, 'err', sys);
      } else {
        existing.payload.recordPath = null;
        existing.payload.scenePath = scenePath;
        if (p) {
          p.record = null; p.mode = 'show'; p.playing = false; p.position = 0; p.duration = 15;
          dispatchPlayerCommand(sys, existing.id, { type: 'open', path: scenePath });
        }
      }
      M.focusWindow(sys, existing.id);
      this.refresh('open-player');
      return existing;
    }
    const win = M.openWindow(this.model, sys, 'player', { payload: { scenePath, recordPath: opts.recordPath || null }, geometry: M.defaultPlayerGeometry(sys) });
    if (win && !sys.apps.players[win.id]) {
      sys.apps.players[win.id] = M.makePlayerState(sys, win.id, scenePath || '/Demo/helicopter-24.scene');
      if (opts.recordPath) win.payload.recordPath = opts.recordPath;
    }
    this.refresh('open-player');
    return win;
  }
  openSpreadsheet(sys, path, opts = {}) {
    if (!sys.isRoot) { toast('仅根系统', '电子表格由根系统提供。', 'warn', sys); return null; }
    let doc = Object.values(sys.apps.spreadsheets).find(d => d.path === path);
    if (!doc) {
      if (!path) doc = null;
      else {
        const r = M.fsRead(sys, path);
        // 延迟到 sup 模块加载，避免循环
        const loader = rt.openWorkbookDoc;
        if (loader) doc = loader(sys, path);
      }
    }
    if (path && !doc) { toast('打开失败', '工作簿文件不存在或无法解析。', 'err', sys); return null; }
    if (doc) doc.open = true;
    const win = M.openWindow(this.model, sys, 'spreadsheet', { payload: { path, docId: doc ? doc.id : null }, title: doc ? doc.name : '电子表格' });
    if (!doc && !path) win.payload.newDoc = true;
    this.refresh('open-sheet');
    return win;
  }
  async closeWindow(sys, win, opts = {}) {
    if (win.appId === 'system') return this.closeSystemWindow(sys, win);
    const view = this.views.get(sys.id);
    const ctrl = view ? view.windowControllers.get(win.id) : null;
    if (ctrl && typeof ctrl.requestClose === 'function') {
      const ok = await ctrl.requestClose();
      if (ok === false) return false;
    }
    const projectionTargets = [];
    for (const s of Object.values(this.model.systems)) {
      for (const w of s.windows) {
        if (w.appId === 'projection' && w.payload.sourceSystemId === sys.id && w.payload.sourceWindowId === win.id) projectionTargets.push(s);
      }
    }
    M.closeWindow(this.model, sys, win.id);
    if (APP_SERVICES[win.appId] && !sys.windows.some(w => w.appId === win.appId)) {
      endAppServices(sys, win.appId);
    }
    this.refresh('close-window');
    for (const s of projectionTargets) toast('投送已结束', `源窗口「${win.title}」已关闭，对应投送视图已移除。`, 'info', s);
    return true;
  }
  async closeSystemWindow(sys, win) {
    const child = this.model.systems[win.payload.childId];
    if (!child) { M.closeWindow(this.model, sys, win.id); this.refresh('close-window'); return; }
    const choice = await dialog(sys, {
      title: `关闭「${child.name}」的系统窗口`,
      message: '关闭窗口只会隐藏这个桌面，子系统继续在后台运行。若停止整个子树，其中全部程序、播放器和图表都会结束，但已保存的快照仍保留。',
      buttons: [
        { label: '取消', value: null, kind: 'ghost' },
        { label: '仅关闭窗口', value: 'window' },
        { label: '停止整个子树', value: 'stop', kind: 'danger' }
      ]
    });
    if (!choice) return false;
    if (choice === 'window') {
      M.closeWindow(this.model, sys, win.id);
      this.destroyChildView(child.id);
      this.refresh('close-system-window');
      toast('子系统继续运行', `${child.name} 仍在后台；可从系统管理重新打开桌面。`, 'info', sys);
      return true;
    }
    stopChildSystem(this, sys, child);
    return true;
  }
  openProjectPicker(sys, win) {
    const ancestors = M.ancestorsOf(this.model, sys);
    if (!ancestors.length) { toast('没有可用目标', '当前系统是根系统，无法向更外层投送。', 'warn', sys); return; }
    const view = this.views.get(sys.id);
    const rect = view?.windowEls.get(win.id)?.el.querySelector('[data-testid="window-project"]')?.getBoundingClientRect();
    const x = rect ? rect.left : sys.viewport.w / 2;
    const y = rect ? rect.bottom : 200;
    showMenu(sys, x - 160, y + 4, ancestors.map(a => ({
      label: `${a.name} · 第 ${a.depth + 1} 层${a.isRoot ? '（根桌面）' : ''}`,
      icon: 'project',
      testid: 'project-target', targetSystemId: a.id,
      action: () => {
        const r = M.openProjection(this.model, a, sys, win, win.appId);
        this.refresh('projection');
        toast(r.existing ? '已定位投送窗口' : '已投送',
          `${win.title} → ${a.name}；投送外框归目标桌面，内容与输入仍属于 ${sys.name}。`, 'ok', a);
      }
    })), { title: '选择投送目标桌面' });
  }
  setAppTitle(sys, winId, title, subtitle) {
    const win = sys.windows.find(w => w.id === winId);
    if (!win) return;
    win.title = title || win.title;
    if (subtitle !== undefined) win.subtitle = subtitle;
    const view = this.views.get(sys.id);
    if (view) view.updateWindowChrome(win);
  }
}

export class SystemView {
  constructor(ui, sys, container, isRoot) {
    this.ui = ui;
    this.sys = sys;
    this.container = container;
    this.isRoot = isRoot;
    this.windowEls = new Map();
    this.windowControllers = new Map();
    this.rootEl = null;
    this.activeMenu = null;
    this.drawer = null; // 'start' | 'widgets'
    this.widgetsPanel = null;
    this._tickAcc = 0;
    this._destroyed = false;
    this._startOpen = false;
  }
  mount() {
    const sys = this.sys;
    const root = el('div', {
      class: 'os-desktop depth-' + sys.depth,
      dataset: { systemId: sys.id, depth: String(sys.depth), testid: 'os-desktop' }
    });
    root.style.setProperty('--accent', sys.settings.accent);
    root.style.setProperty('--ui-scale', String(sys.settings.scale || 1));
    root.setAttribute('aria-label', `${sys.name} 桌面`);
    this.rootEl = root;
    root.innerHTML = '';
    // 壁纸与氛围
    const wallpaper = el('div', { class: 'wallpaper' });
    this.wallpaperEl = wallpaper;
    root.append(wallpaper, el('div', { class: 'desktop-glow' }));
    // 桌面区域
    const area = el('div', { class: 'desktop-area' });
    this.areaEl = area;
    this.iconsEl = el('div', { class: 'desktop-icons', role: 'list' });
    this.windowLayer = el('div', { class: 'window-layer' });
    this.snapPreview = el('div', { class: 'snap-preview' });
    area.append(this.iconsEl, this.windowLayer, this.snapPreview);
    area.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.app-window') || e.target.closest('.desk-icon')) return;
      e.preventDefault();
      this.desktopContextMenu(e);
    });
    // 冻结覆盖
    this.frozenEl = el('div', { class: 'system-frozen' },
      el('div', { class: 'frozen-box' }, el('span', { class: 'dot pause' }), el('span', { class: 'frozen-text', text: '系统已暂停' }))
    );
    // 内核错误覆盖
    this.errorEl = el('div', { class: 'kernel-error-box hidden', dataset: { testid: 'kernel-error' } },
      el('h3', { text: '内核错误' }),
      el('pre', { class: 'kernel-error-text', text: '' }),
      el('div', { class: 'row' },
        el('button', {
          class: 'btn danger', dataset: { testid: 'kernel-restart' }, text: '重新加载内核',
          onclick: () => this.restartKernel()
        }),
        el('button', { class: 'btn', text: '打开内核源文件', onclick: () => this.openKernel() })
      )
    );
    root.append(area);
    // 冻结/错误覆盖整个桌面（包括任务栏），管理入口在父系统的系统窗口标题栏
    root.append(this.frozenEl, this.errorEl);
    // 任务栏
    this.buildTaskbar(root);
    // 开始菜单
    this.buildStartMenu(root);
    // 小组件面板（仅根系统）
    if (sys.isRoot) {
      this.widgetsPanel = createWidgetsPanel(this);
      root.append(this.widgetsPanel.el);
    }
    // 模态层
    this.modalLayer = el('div', { class: 'sys-modal-layer' });
    root.append(this.modalLayer);
    // 系统归属水印（嵌套时可辨认）
    const watermark = el('div', {
      class: 'sys-watermark',
      text: sys.isRoot ? 'NESTED OS · OUTER' : `${sys.id.toUpperCase()} · 第 ${sys.depth + 1} 层`
    });
    root.append(watermark);
    this.container.append(root);
    // 尺寸观察
    this.resizeObserver = new ResizeObserver(() => {
      const r = root.getBoundingClientRect();
      const prev = sys.viewport;
      sys.viewport = { w: Math.round(r.width), h: Math.round(r.height) };
      if (prev && (Math.abs(prev.w - r.width) > 2 || Math.abs(prev.h - r.height) > 2)) {
        this.syncWindowsGeometry();
      }
    });
    this.resizeObserver.observe(root);
    const r0 = root.getBoundingClientRect();
    sys.viewport = { w: Math.round(r0.width) || sys.viewport.w, h: Math.round(r0.height) || sys.viewport.h };
    this.sync('mount');
    this.annotateControls();
  }
  buildTaskbar(root) {
    const sys = this.sys;
    const startBtn = el('button', {
      class: 'tb-btn start-btn', title: '开始', 'aria-label': '开始',
      dataset: { testid: 'start-toggle' }, html: brandMark(27)
    });
    startBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleStart(); });
    const pinned = el('div', { class: 'tb-pinned' });
    const apps = sys.isRoot ? ['files', 'spreadsheet', 'editor', 'browser'] : ['files', 'player', 'charts', 'editor'];
    for (const id of apps) {
      if (id === 'browser' && !sys.isRoot) continue;
      const b = el('button', { class: 'tb-btn', title: APP_LABELS[id] || id, 'aria-label': APP_LABELS[id] || id, html: appIcon(id, 22) });
      b.addEventListener('click', () => this.launchApp(id));
      pinned.append(b);
    }
    this.windowsBar = el('div', { class: 'tb-windows' });
    const tray = el('div', { class: 'tray' });
    // 小组件
    if (sys.isRoot) {
      const wg = el('button', { class: 'tb-btn tray-btn widgets-toggle', title: '桌面小组件', 'aria-label': '桌面小组件', dataset: { testid: 'widgets-toggle' }, html: glyph('grid', 18) });
      wg.addEventListener('click', (e) => { e.stopPropagation(); this.toggleWidgets(); });
      tray.append(wg);
    }
    const dnd = el('button', { class: 'tb-btn tray-btn', title: '免打扰', 'aria-label': '免打扰', html: glyph('moon', 18) });
    dnd.addEventListener('click', () => { sys.settings.dnd = !sys.settings.dnd; sys.widgets.dnd = sys.settings.dnd; this.syncTray(); changed('dnd'); toast(sys.settings.dnd ? '已开启免打扰' : '已关闭免打扰', sys.settings.dnd ? '通知仍会记录，但不弹窗。' : '', 'info', sys); });
    this.dndBtn = dnd;
    const notif = el('button', { class: 'tb-btn tray-btn notifications-btn', title: '通知中心', 'aria-label': '通知中心', dataset: { testid: 'notifications-toggle' }, html: glyph('bell', 18) });
    this.notifBadge = el('span', { class: 'notif-count hidden' });
    notif.append(this.notifBadge);
    notif.addEventListener('click', (e) => { e.stopPropagation(); this.openNotifications(); });
    this.notifBtn = notif;
    this.clockEl = el('div', { class: 'tray-clock', role: 'button', tabindex: '0' },
      el('span', { class: 't1', text: '00:00' }), el('span', { class: 't2', text: '1月1日' }));
    this.clockEl.addEventListener('click', () => { if (sys.isRoot) this.toggleWidgets('clock'); });
    const budget = el('div', { class: 'tray-budget', title: '本逻辑步执行预算' },
      el('div', { class: 'meter' }, this.budgetBar = el('i')),
      this.budgetText = el('span', { class: 'bt', text: '0/0 u' })
    );
    budget.addEventListener('click', () => this.launchApp('tasks'));
    tray.append(dnd, notif, this.clockEl, budget);
    const bar = el('div', { class: 'taskbar' }, startBtn, pinned, el('div', { class: 'tb-divider' }), this.windowsBar, tray);
    this.taskbarEl = bar;
    root.append(bar);
  }
  buildStartMenu(root) {
    const sys = this.sys;
    const menu = el('div', { class: 'start-menu', dataset: { testid: 'start-menu' } });
    const searchWrap = el('div', { class: 'sm-search' }, el('span', { html: glyph('search', 16) }),
      this.searchInput = el('input', { type: 'text', placeholder: '搜索应用、文件与设置', 'aria-label': '搜索' }));
    this.searchInput.addEventListener('input', () => this.filterStartMenu());
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = this.appGrid.querySelector('.sm-app');
        if (first) first.click();
      }
      e.stopPropagation();
    });
    const scroll = el('div', { class: 'sm-scroll' });
    scroll.append(el('div', { class: 'sm-section-label', text: '应用' }));
    this.appGrid = el('div', { class: 'sm-grid' });
    for (const entry of this.appList()) {
      const b = el('button', {
        class: 'sm-app', dataset: { testid: 'launch-' + entry.appId, label: entry.label },
        onclick: () => { this.closeStart(); this.launchApp(entry.appId); }
      }, el('span', { class: 'icon-tile', html: appIcon(entry.icon || entry.appId, 34) }), el('span', { class: 'lbl', text: entry.label }));
      this.appGrid.append(b);
    }
    scroll.append(this.appGrid);
    scroll.append(el('div', { class: 'sm-section-label', text: '直属子系统' }));
    this.sysListEl = el('div', {});
    scroll.append(this.sysListEl);
    // 最近文件
    scroll.append(el('div', { class: 'sm-section-label', text: '示例素材' }));
    const demoRow = el('div', { class: 'sm-grid', style: { gridTemplateColumns: 'repeat(2,1fr)' } });
    const demos = [{ file: '/Demo/sample.sheet', label: '示例工作簿', icon: 'spreadsheet' }, { file: '/Demo/helicopter-24.scene', label: '24 号场景', icon: 'player' }];
    for (const d of demos) {
      const b = el('button', { class: 'sm-app', onclick: () => { this.closeStart(); this.ui.openFile(sys, d.file); } },
        el('span', { class: 'icon-tile', html: appIcon(d.icon, 30) }), el('span', { class: 'lbl', text: d.label }));
      demoRow.append(b);
    }
    scroll.append(demoRow);
    const foot = el('div', { class: 'sm-foot' },
      el('div', { class: 'who' }, el('div', { class: 'avatar', text: sys.isRoot ? 'O' : String(sys.depth) }),
        el('span', { text: `${sys.settings.name} · ${sys.isRoot ? '根系统' : '第 ' + (sys.depth + 1) + ' 层'}` })),
      el('button', { class: 'btn sm', text: '系统管理', onclick: () => { this.closeStart(); this.launchApp('systems'); } }),
      el('button', { class: 'btn sm ghost', text: '说明', onclick: () => { this.closeStart(); this.launchApp('guide'); } })
    );
    menu.append(searchWrap, scroll, foot);
    this.startMenuEl = menu;
    root.append(menu);
    this.refreshSystemList();
  }
  appList() {
    const sys = this.sys;
    const ids = sys.isRoot
      ? ['files', 'spreadsheet', 'widgets', 'editor', 'browser', 'tasks', 'settings', 'systems', 'guide']
      : ['files', 'editor', 'tasks', 'player', 'charts', 'systems', 'guide'];
    return ids.map(appId => ({ appId, label: APP_LABELS[appId] || appId, icon: appId }));
  }
  refreshSystemList() {
    if (!this.sysListEl) return;
    this.sysListEl.innerHTML = '';
    const children = M.childrenOf(this.ui.model, this.sys);
    if (!children.length) {
      this.sysListEl.append(el('div', { class: 'sm-sysrow', style: { color: 'var(--dim)', fontSize: '11px' }, text: '暂无子系统。打开系统管理或双击「系统管理」。' }));
      return;
    }
    for (const c of children) {
      const st = M.runtimeState(this.ui.model, c);
      const row = el('div', { class: 'sm-sysrow' },
        el('span', { class: 'dot ' + (st === 'running' ? 'ok' : st === 'error' ? 'err' : 'pause') }),
        el('span', { class: 'grow', text: `${c.name} · 第 ${c.depth + 1} 层` }),
        el('button', { class: 'btn sm ghost', text: '桌面', onclick: (e) => { e.stopPropagation(); this.closeStart(); showChildDesktop(this.ui, this.sys, c); } }),
        el('button', { class: 'btn sm', dataset: { testid: 'system-pause', 'target-system-id': c.id }, text: '暂停', onclick: (e) => { e.stopPropagation(); pauseSystem(c); this.sync(); } }),
        el('button', { class: 'btn sm', dataset: { testid: 'system-resume', 'target-system-id': c.id }, text: '继续', onclick: (e) => { e.stopPropagation(); resumeSystem(c); this.sync(); } })
      );
      this.sysListEl.append(row);
    }
  }
  toggleStart() {
    if (this._startOpen) return this.closeStart();
    this.closeWidgets();
    this._startOpen = true;
    this.startMenuEl.classList.add('open');
    this.refreshSystemList();
    this.drawer = 'start';
    setTimeout(() => this.searchInput?.focus(), 60);
  }
  closeStart() { this._startOpen = false; this.startMenuEl?.classList.remove('open'); if (this.drawer === 'start') this.drawer = null; this.searchInput.value = ''; this.filterStartMenu(); }
  toggleWidgets(section) {
    if (!this.widgetsPanel) return;
    this.closeStart();
    this.widgetsPanel.toggle(section);
    this.drawer = this.widgetsPanel.isOpen() ? 'widgets' : null;
  }
  closeWidgets() { if (this.widgetsPanel && this.widgetsPanel.isOpen()) this.widgetsPanel.close(); if (this.drawer === 'widgets') this.drawer = null; }
  closeDrawers() { this.closeStart(); this.closeWidgets(); this.closeMenu(); }
  closeMenu() {
    if (this.activeMenu) {
      this.activeMenu.remove(); this.activeMenu = null;
      if (this._menuCleanup) { this._menuCleanup(); this._menuCleanup = null; }
    }
  }
  filterStartMenu() {
    const q = (this.searchInput.value || '').trim().toLowerCase();
    let first = null;
    for (const b of this.appGrid.querySelectorAll('.sm-app')) {
      const label = (b.dataset.label || '').toLowerCase();
      const show = !q || label.includes(q);
      b.style.display = show ? '' : 'none';
      if (show && !first) first = b;
    }
    this.sysListEl.querySelectorAll('.sm-sysrow').forEach(r => {
      r.style.display = !q || (r.textContent || '').toLowerCase().includes(q) ? '' : 'none';
    });
  }
  launchApp(appId, opts = {}) {
    if (appId === 'widgets') return this.toggleWidgets();
    this.ui.openApp(this.sys, appId, opts);
  }
  sync(reason = '') {
    if (this._destroyed) return;
    this.syncSettings();
    this.syncIcons();
    this.syncWindows();
    this.syncTaskbar();
    this.syncTray();
    this.syncStateOverlay();
    if (this.widgetsPanel) this.widgetsPanel.refresh();
    this.annotateControls();
  }
  syncSettings() {
    const s = this.sys.settings;
    this.rootEl.style.setProperty('--accent', s.accent);
    this.rootEl.style.setProperty('--ui-scale', String(s.scale || 1));
    if (this.sys.isRoot) {
      this.wallpaperEl.style.backgroundImage = wallpaperCss(s.wallpaper);
      this.rootEl.dataset.wallpaper = s.wallpaper;
    } else {
      if (this._wallKey !== this.sys.depth + s.accent) {
        this._wallKey = this.sys.depth + s.accent;
        this.wallpaperEl.style.backgroundImage = innerWallpaper(this.sys.depth, s.accent);
      }
    }
  }
  iconList() {
    const base = this.sys.isRoot ? ROOT_ICONS : INNER_ICONS;
    return base.map(x => ({ ...x, label: x.label || APP_LABELS[x.appId] || x.appId }));
  }
  syncIcons() {
    if (!this.iconsEl) return;
    const items = this.iconList();
    const key = items.map(i => i.appId || i.file).join('|');
    if (this._iconKey !== key) {
      this._iconKey = key;
      this.iconsEl.innerHTML = '';
      for (const item of items) {
        const icon = appIcon(item.icon || item.appId, Math.round(46 * (this.sys.settings.scale || 1)));
        const node = el('div', {
          class: 'desk-icon', role: 'button', tabindex: '0',
          dataset: { testid: 'desktop-icon', ...(item.appId ? { 'app-id': item.appId } : { 'file-path': item.file }) },
          title: item.label
        }, el('span', { class: 'icon-tile', html: icon }), el('span', { class: 'lbl', text: item.label }));
        node.addEventListener('click', (e) => {
          this.iconsEl.querySelectorAll('.desk-icon.selected').forEach(n => n.classList.remove('selected'));
          node.classList.add('selected');
          e.stopPropagation();
        });
        node.addEventListener('dblclick', () => {
          if (item.appId) this.launchApp(item.appId);
          else this.ui.openFile(this.sys, item.file);
        });
        node.addEventListener('contextmenu', (e) => {
          e.preventDefault(); e.stopPropagation();
          const items = item.appId
            ? [{ label: '打开', icon: 'open', action: () => this.launchApp(item.appId) }]
            : [{ label: '打开', icon: 'open', action: () => this.ui.openFile(this.sys, item.file) },
               { label: '在文件管理器中显示', icon: 'folder', action: () => this.launchApp('files', { payload: { path: this.sys.isRoot && !item.file.startsWith('/System') ? '/Demo' : '/System' } }) }];
          showMenu(this.sys, e.clientX, e.clientY, items);
        });
        this.iconsEl.append(node);
      }
    }
  }
  desktopContextMenu(e) {
    const sys = this.sys;
    const items = [
      { label: '刷新', icon: 'refresh', action: () => this.sync() },
      { sep: true },
      { label: '新建文本文件', icon: 'file', action: () => this.newFile('/', '新建文本.txt', '') },
      { label: '新建文件夹', icon: 'folder', action: () => this.newFolder('/') },
      { sep: true },
      { label: sys.isRoot ? '桌面小组件' : '进程管理器', icon: sys.isRoot ? 'grid' : 'tasks', action: () => this.launchApp(sys.isRoot ? 'widgets' : 'tasks') },
      { label: '系统管理', icon: 'systems', action: () => this.launchApp('systems') },
      { label: '操作说明', icon: 'guide', action: () => this.launchApp('guide') }
    ];
    showMenu(sys, e.clientX, e.clientY, items);
  }
  async newFile(dir, name, content = '') {
    const res = await promptValue(this.sys, '新建文件', '文件名称', name || '新建文件.txt');
    if (!res) return;
    const path = (dir === '/' ? '' : dir) + '/' + res.replace(/^\/+/, '');
    if (this.sys.files[path]) { toast('新建失败', '同名文件已存在', 'err', this.sys); return; }
    const r = M.fsWrite(this.sys, path, content);
    if (!r.ok) toast('新建失败', r.error, 'err', this.sys);
    else { this.sync(); toast('已创建文件', path, 'ok', this.sys); }
  }
  async newFolder(dir) {
    const res = await promptValue(this.sys, '新建文件夹', '文件夹名称', '新建文件夹');
    if (!res) return;
    const path = (dir === '/' ? '' : dir) + '/' + res.replace(/^\/+/, '');
    const r = M.fsMkdir(this.sys, path);
    if (!r.ok) toast('新建失败', r.error, 'err', this.sys);
    else { this.sync(); }
  }
  syncTaskbar() {
    const sys = this.sys;
    this.windowsBar.innerHTML = '';
    const wins = [...sys.windows].sort((a, b) => a.z - b.z);
    for (const w of wins) {
      const focused = sys.focusId === w.id && !w.minimized;
      const item = el('button', {
        class: 'taskbar-item' + (focused ? ' focused' : '') + (w.minimized ? ' minimized' : ''),
        title: w.title, dataset: { testid: 'taskbar-item', 'window-id': w.id }
      }, el('span', { class: 'ti-icon', html: appIcon(w.appId === 'projection' ? (w.payload.sourceAppId || 'player') : w.appId, 18) }),
        el('span', { class: 'ti-label', text: w.title }),
        w.appId === 'system' ? el('span', { class: 'ti-dot' }) : null);
      item.addEventListener('click', () => {
        if (w.minimized) { w.minimized = false; M.focusWindow(sys, w.id); }
        else if (sys.focusId === w.id) { w.minimized = true; if (sys.focusId === w.id) { const top = sys.windows.filter(x => !x.minimized).sort((a, b) => b.z - a.z)[0]; sys.focusId = top ? top.id : null; } }
        else { w.minimized = false; M.focusWindow(sys, w.id); }
        this.syncWindows(); this.syncTaskbar(); changed('taskbar');
      });
      this.windowsBar.append(item);
    }
  }
  syncTray() {
    const sys = this.sys;
    const unread = sys.notifications.filter(n => !n.read).length;
    if (this.notifBadge) { this.notifBadge.textContent = unread > 99 ? '99+' : String(unread); this.notifBadge.classList.toggle('hidden', unread === 0); }
    if (this.dndBtn) this.dndBtn.style.color = sys.settings.dnd ? 'var(--yellow)' : '';
    const t = new Date((this.ui.model.bootEpoch || Date.now()) + sys.clock * 1000);
    if (this.clockEl) {
      this.clockEl.querySelector('.t1').textContent = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      this.clockEl.querySelector('.t2').textContent = `${t.getMonth() + 1}月${t.getDate()}日 周${'日一二三四五六'[t.getDay()]}`;
    }
    if (this.budgetBar) {
      const used = sys.budget.used || 0, total = sys.budget.total || 1;
      this.budgetBar.style.width = clamp(used / total * 100, 0, 100) + '%';
      this.budgetText.textContent = `${fmtNum(used)}/${fmtNum(total)} u`;
    }
  }
  annotateControls() {
    if (!this.rootEl) return;
    const set = (node) => {
      const ownerDesk = node.closest('.os-desktop');
      if (ownerDesk && ownerDesk !== this.rootEl) return;
      if (!node.dataset.systemId) node.setAttribute('data-system-id', this.sys.id);
      const winEl = node.closest('.app-window');
      // 只对属于本条桌的应用窗口标注 window id；父系统的系统窗口外壳仍归父系统
      if (winEl && winEl.dataset.systemId === this.sys.id && winEl.dataset.windowId && !node.dataset.windowId) {
        node.setAttribute('data-window-id', winEl.dataset.windowId);
      }
    };
    const nodes = this.rootEl.querySelectorAll('[data-testid]');
    for (const n of nodes) set(n);
    const start = this.startMenuEl;
    if (start) { start.setAttribute('data-system-id', this.sys.id); for (const n of start.querySelectorAll('[data-testid]')) set(n); }
    const panel = this.widgetsPanel && this.widgetsPanel.el;
    if (panel) { panel.setAttribute('data-system-id', this.sys.id); for (const n of panel.querySelectorAll('[data-testid]')) set(n); }
  }
  syncStateOverlay() {
    const sys = this.sys;
    const state = M.runtimeState(this.ui.model, sys);
    const frozen = state === 'paused' || state === 'ancestor-paused';
    this.rootEl.classList.toggle('frozen', frozen && sys.state !== 'error');
    this.rootEl.classList.toggle('system-error', sys.state === 'error');
    if (this.frozenEl) {
      const text = state === 'ancestor-paused' ? '祖先系统已暂停，整棵子树冻结' : '系统已暂停 · 时钟与全部程序停止';
      this.frozenEl.querySelector('.frozen-text').textContent = text;
    }
    if (this.errorEl) {
      const isError = sys.state === 'error' || (sys.kernel && sys.kernel.error);
      this.errorEl.classList.toggle('hidden', !isError);
      if (isError) this.errorEl.querySelector('.kernel-error-text').textContent = sys.stateNote || (sys.kernel && sys.kernel.error) || '内核运行失败';
    }
  }
  restartKernel() {
    const child = this.sys;
    const parent = this.ui.model.systems[child.parentId];
    if (!parent) return;
    restartKernel(this.ui.model, child);
    this.ui.refresh('restart-kernel');
    toast('内核已重新载入', child.state === 'error' ? (child.stateNote || '仍有错误') : '子系统已重新启动。', child.state === 'error' ? 'err' : 'ok', parent);
  }
  openKernel() {
    if (!this.sys.parentId) return;
    openKernelFor(this.ui, this.ui.model.systems[this.sys.parentId], this.sys);
  }
  onTick(dt) {
    if (this._destroyed) return;
    this._tickAcc += dt;
    if (this._tickAcc < 0.1) return;
    this._tickAcc = 0;
    this.syncTray();
    if (this.startMenuEl && this._startOpen) this.refreshSystemList();
    if (this.sys.state === 'error' && this.errorEl) {
      this.errorEl.classList.remove('hidden');
      const txt = this.sys.stateNote || (this.sys.kernel && this.sys.kernel.error) || '内核运行失败';
      const pre = this.errorEl.querySelector('.kernel-error-text');
      if (pre && pre.textContent !== txt) pre.textContent = txt;
    }
    for (const ctrl of this.windowControllers.values()) if (ctrl && ctrl.onTick) { try { ctrl.onTick(dt); } catch (e) { } }
    if (this.widgetsPanel) this.widgetsPanel.onTick();
  }
  syncWindows() {
    const sys = this.sys;
    const present = new Set(sys.windows.map(w => w.id));
    for (const [id, rec] of [...this.windowEls.entries()]) {
      if (!present.has(id)) {
        this.destroyWindowDom(id);
      }
    }
    for (const win of sys.windows) {
      let rec = this.windowEls.get(win.id);
      if (!rec) rec = this.createWindowDom(win);
      this.updateWindow(rec, win);
    }
    this.windowLayer.classList.toggle('empty', sys.windows.length === 0);
  }
  createWindowDom(win) {
    const sys = this.sys;
    const appId = win.appId;
    const isProjection = appId === 'projection';
    const attrs = {
      class: 'app-window' + (appId === 'system' ? ' system-window' : '') + (isProjection ? ' projection-window' : ''),
      dataset: {
        testid: 'app-window', 'window-id': win.id, 'app-id': appId, 'system-id': sys.id
      }
    };
    if (isProjection) {
      attrs.dataset['source-system-id'] = win.payload.sourceSystemId;
      attrs.dataset['source-window-id'] = win.payload.sourceWindowId;
      attrs.dataset['source-app-id'] = win.payload.sourceAppId;
    }
    const node = el('div', attrs);
    const titlebar = el('div', { class: 'win-titlebar', dataset: { testid: 'window-titlebar' } });
    const icon = el('span', { class: 'win-appicon', html: appIcon(isProjection ? (win.payload.sourceAppId || 'player') : appId, 17) });
    const title = el('span', { class: 'win-title', text: win.title });
    const subtitle = el('span', { class: 'win-subtitle', text: win.subtitle || '' });
    const spacer = el('span', { class: 'spacer' });
    const badge = el('span', { class: 'win-badge hidden' });
    titlebar.append(icon, title, subtitle, spacer, badge);
    if (appId === 'player' || appId === 'charts') {
      const pb = el('button', { class: 'win-btn', title: '投送到祖先桌面', 'aria-label': '投送到祖先桌面', dataset: { testid: 'window-project' }, html: glyph('project', 13) });
      pb.addEventListener('click', (e) => { e.stopPropagation(); this.ui.openProjectPicker(sys, win); });
      titlebar.append(pb);
    }
    if (isProjection) {
      titlebar.append(el('span', { class: 'projection-badge', text: '投送' }));
    }
    const btnMin = el('button', { class: 'win-btn', title: '最小化', 'aria-label': '最小化', dataset: { testid: 'window-minimize' }, html: glyph('min', 12) });
    const btnMax = el('button', { class: 'win-btn', title: '最大化', 'aria-label': '最大化', dataset: { testid: 'window-maximize' }, html: glyph('max', 12) });
    const btnClose = el('button', { class: 'win-btn close', title: '关闭', 'aria-label': '关闭', dataset: { testid: 'window-close' }, html: glyph('close', 11) });
    btnMin.addEventListener('click', (e) => {
      e.stopPropagation();
      win.minimized = true;
      const top = sys.windows.filter(x => !x.minimized).sort((a, b) => b.z - a.z)[0];
      sys.focusId = top ? top.id : null;
      this.syncWindows(); this.syncTaskbar(); changed('minimize');
    });
    btnMax.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMax(win); });
    btnClose.addEventListener('click', (e) => { e.stopPropagation(); this.ui.closeWindow(sys, win); });
    titlebar.append(btnMin, btnMax, btnClose);
    node.append(titlebar);
    const body = el('div', { class: 'win-body' });
    node.append(body);
    // 缩放手柄
    const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    for (const h of handles) {
      const rz = el('div', { class: 'rz rz-' + h, dataset: { testid: 'window-resize' } });
      rz.addEventListener('pointerdown', (e) => this.startResize(e, win, h));
      node.append(rz);
    }
    // 焦点与拖动
    node.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('button,input,textarea,select,webview')) {
        M.focusWindow(sys, win.id);
        this.applyFocusAndZ();
        // 若窗口最大/贴靠状态被拖动，则在标题栏拖动里处理
      }
    }, true);
    titlebar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      if (WinDragIgnore(e)) return;
      M.focusWindow(sys, win.id);
      this.applyFocusAndZ();
      this.startDrag(e, win);
    });
    titlebar.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      this.toggleMax(win);
    });
    this.windowLayer.append(node);
    const rec = { el: node, body, controller: null, win, titleEl: title, subtitleEl: subtitle, badgeEl: badge, systemView: null };
    this.windowEls.set(win.id, rec);
    // 内容挂载
    if (appId === 'system') {
      const child = rt.model.systems[win.payload.childId];
      if (child) {
        node.classList.add('system-window', 'depth-' + child.depth);
        rec.controller = null;
        const childView = this.ui.ensureChildView(child, body);
        rec.childView = childView;
      } else {
        body.append(el('div', { class: 'empty-state', text: '子系统已关闭' }));
      }
    } else {
      const app = registry[appId];
      if (app) {
        try {
          const ctx = this.makeAppContext(win, body);
          rec.controller = app.mount(ctx) || {};
          this.windowControllers.set(win.id, rec.controller);
        } catch (e) {
          console.error('应用挂载失败', appId, e);
          body.append(el('div', { class: 'empty-state' }, el('div', { class: 'big', text: '⚠' }), el('div', { text: '应用加载失败：' + e.message })));
        }
      } else {
        body.append(el('div', { class: 'empty-state', text: '未知应用 ' + appId }));
      }
    }
    return rec;
  }
  makeAppContext(win, body) {
    const view = this;
    const sys = this.sys;
    return {
      ui: this.ui, model: this.ui.model, sys, win, view, body,
      close: () => this.ui.closeWindow(sys, win),
      refresh: (reason) => { this.syncWindows(); this.syncTaskbar(); },
      setTitle: (t, sub) => this.ui.setAppTitle(sys, win.id, t, sub),
      toast: (t, m, k) => toast(t, m, k, sys),
      dialog: (o) => dialog(sys, o),
      openApp: (id, opts) => this.launchApp(id, opts),
      openFile: (p) => this.ui.openFile(sys, p),
      changed: (r) => changed(r || 'app'),
      projected: win.appId === 'projection',
      sourceSys: win.appId === 'projection' ? rt.model.systems[win.payload.sourceSystemId] : sys,
      sourceWin: win.appId === 'projection' ? (rt.model.systems[win.payload.sourceSystemId]?.windows.find(w => w.id === win.payload.sourceWindowId)) : win
    };
  }
  destroyWindowDom(id) {
    const rec = this.windowEls.get(id);
    if (!rec) return;
    const ctrl = this.windowControllers.get(id);
    if (ctrl && ctrl.destroy) { try { ctrl.destroy(); } catch (e) { console.warn(e); } }
    if (rec.childView) { rec.childView.destroy(); this.ui.views.delete(rec.childView.sys.id); }
    rec.el.remove();
    this.windowEls.delete(id);
    this.windowControllers.delete(id);
  }
  updateWindow(rec, win) {
    const sys = this.sys;
    const eln = rec.el;
    eln.dataset['windowId'] = win.id;
    if (win.appId === 'projection') {
      eln.dataset['sourceSystemId'] = win.payload.sourceSystemId;
      eln.dataset['sourceWindowId'] = win.payload.sourceWindowId;
      eln.dataset['sourceAppId'] = win.payload.sourceAppId;
    }
    if (win.appId === 'system') {
      const child = this.ui.model.systems[win.payload.childId];
      if (child) {
        eln.dataset['childSystemId'] = child.id;
        eln.classList.toggle('child-error', child.state === 'error');
        if (rec.badgeEl) {
          const st = M.runtimeState(this.ui.model, child);
          rec.badgeEl.classList.remove('hidden');
          rec.badgeEl.textContent = `${M.stateLabel(st)} · 第 ${child.depth + 1} 层`;
          rec.badgeEl.className = 'win-badge' + (st === 'error' ? ' err' : '');
        }
      }
    }
    if (!win.minimized) eln.style.display = '';
    eln.style.display = win.minimized ? 'none' : '';
    eln.classList.toggle('focused', sys.focusId === win.id);
    eln.classList.toggle('minimized', !!win.minimized);
    eln.classList.toggle('maximized', !!win.maximized);
    eln.classList.toggle('snapped-left', win.snap === 'left' && !win.maximized);
    eln.classList.toggle('snapped-right', win.snap === 'right' && !win.maximized);
    rec.titleEl.textContent = win.title;
    if (rec.subtitleEl) rec.subtitleEl.textContent = win.subtitle || '';
    rec.titleEl.title = win.title;
    eln.style.zIndex = String(10 + (win.z || 0));
    if (win.maximized || win.snap) {
      eln.style.left = ''; eln.style.top = ''; eln.style.width = ''; eln.style.height = '';
    } else {
      eln.style.left = win.x + 'px'; eln.style.top = win.y + 'px';
      eln.style.width = win.w + 'px'; eln.style.height = win.h + 'px';
    }
    // 标题栏按钮：最大化图标
    const maxBtn = rec.el.querySelector('[data-testid="window-maximize"]');
    if (maxBtn) maxBtn.innerHTML = glyph(win.maximized ? 'restore' : 'max', 12);
    if (win.appId === 'projection' && rec.controller && rec.controller.syncFromModel) {
      // 内容自行更新
    }
  }
  updateWindowChrome(win) {
    const rec = this.windowEls.get(win.id);
    if (!rec) return;
    rec.titleEl.textContent = win.title;
    if (rec.subtitleEl) rec.subtitleEl.textContent = win.subtitle || '';
    this.syncTaskbar();
  }
  syncWindowsGeometry() {
    for (const [id, rec] of this.windowEls) {
      const win = this.sys.windows.find(w => w.id === id);
      if (!win) continue;
      if (win.maximized || win.snap) continue;
      // 改变祖先窗口后保持窗口可见；不压缩用户设定的尺寸
      win.x = clamp(win.x, 0, Math.max(0, this.sys.viewport.w - 120));
      win.y = clamp(win.y, 0, Math.max(0, this.sys.viewport.h - 40));
      rec.el.style.left = win.x + 'px'; rec.el.style.top = win.y + 'px';
      rec.el.style.width = win.w + 'px'; rec.el.style.height = win.h + 'px';
    }
  }
  applyFocusAndZ() {
    for (const win of this.sys.windows) {
      const rec = this.windowEls.get(win.id);
      if (!rec) continue;
      rec.el.classList.toggle('focused', this.sys.focusId === win.id);
      rec.el.style.zIndex = String(10 + (win.z || 0));
    }
    this.syncTaskbar();
    changed('focus');
  }
  toggleMax(win) {
    if (win.maximized) {
      win.maximized = false;
      if (win.prev) { win.x = win.prev.x; win.y = win.prev.y; win.w = win.prev.w; win.h = win.prev.h; win.prev = null; }
    } else {
      win.prev = { x: win.x, y: win.y, w: win.w, h: win.h };
      win.maximized = true; win.snap = null;
    }
    M.focusWindow(this.sys, win.id);
    this.syncWindows();
    this.syncTaskbar();
    changed('maximize');
  }
  startDrag(e, win) {
    if (e.button !== 0) return;
    const sys = this.sys;
    let startX = e.clientX, startY = e.clientY;
    let sx = win.x, sy = win.y;
    if (win.maximized) {
      // 从最大化拖出：恢复大小并置于指针下方
      const px = (e.clientX - this.rootEl.getBoundingClientRect().left) / sys.viewport.w;
      win.maximized = false;
      if (win.prev) { win.w = win.prev.w; win.h = win.prev.h; } else { win.w = Math.min(900, sys.viewport.w * 0.7); win.h = Math.min(600, sys.viewport.h * 0.7); }
      win.x = clamp(e.clientX - this.rootEl.getBoundingClientRect().left - win.w * px, 0, sys.viewport.w - win.w);
      win.y = Math.max(0, e.clientY - this.rootEl.getBoundingClientRect().top - 18);
      sx = win.x; sy = win.y;
      startX = e.clientX; startY = e.clientY;
      this.syncWindows();
    }
    if (win.snap) {
      const px = (e.clientX - this.rootEl.getBoundingClientRect().left) / sys.viewport.w;
      win.snap = null;
      win.w = Math.min(900, sys.viewport.w * 0.7); win.h = Math.min(600, sys.viewport.h * 0.7);
      win.x = clamp(e.clientX - this.rootEl.getBoundingClientRect().left - win.w * px, 0, sys.viewport.w - win.w);
      win.y = Math.max(0, e.clientY - this.rootEl.getBoundingClientRect().top - 18);
      sx = win.x; sy = win.y; startX = e.clientX; startY = e.clientY;
      this.syncWindows();
    }
    const rootRect = this.rootEl.getBoundingClientRect();
    let moved = false;
    const onMove = (ev) => {
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 3) moved = true;
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      // 窗口拖动范围限于所属桌面
      win.x = clamp(sx + dx, 0, Math.max(0, sys.viewport.w - 100));
      win.y = clamp(sy + dy, 0, Math.max(0, sys.viewport.h - 44));
      const rec = this.windowEls.get(win.id);
      if (rec) { rec.el.style.left = win.x + 'px'; rec.el.style.top = win.y + 'px'; }
      const localX = ev.clientX - rootRect.left;
      if (localX < 18) this.showSnapPreview('left');
      else if (localX > sys.viewport.w - 18) this.showSnapPreview('right');
      else this.hideSnapPreview();
      ev.preventDefault();
    };
    const onUp = (ev) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      const localX = ev.clientX - rootRect.left;
      this.hideSnapPreview();
      if (localX < 18) { win.snap = 'left'; win.maximized = false; }
      else if (localX > sys.viewport.w - 18) { win.snap = 'right'; win.maximized = false; }
      else { win.snap = null; }
      if (!win.snap) { win.x = clamp(win.x, 0, sys.viewport.w - 120); win.y = clamp(win.y, 0, sys.viewport.h - 30); }
      this.syncWindows(); this.syncTaskbar();
      changed('drag-window');
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    e.preventDefault();
  }
  showSnapPreview(side) {
    const w = this.sys.viewport.w, h = this.sys.viewport.h;
    this.snapPreview.style.display = 'block';
    this.snapPreview.style.top = '4px';
    this.snapPreview.style.height = (h - 8) + 'px';
    this.snapPreview.style.width = (w / 2 - 6) + 'px';
    this.snapPreview.style.left = side === 'left' ? '4px' : (w / 2 + 2) + 'px';
  }
  hideSnapPreview() { if (this.snapPreview) this.snapPreview.style.display = 'none'; }
  startResize(e, win, dir) {
    if (win.maximized) return;
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, w: win.w, h: win.h, l: win.x, t: win.y };
    const onMove = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      let { x, y, w, h } = { x: start.l, y: start.t, w: start.w, h: start.h };
      if (dir.includes('e')) w = start.w + dx;
      if (dir.includes('s')) h = start.h + dy;
      if (dir.includes('w')) { w = start.w - dx; x = start.l + dx; }
      if (dir.includes('n')) { h = start.h - dy; y = start.t + dy; }
      w = Math.max(320, w); h = Math.max(200, h);
      win.x = clamp(x, 0, this.sys.viewport.w - 120);
      win.y = clamp(y, 0, this.sys.viewport.h - 40);
      win.w = Math.min(w, this.sys.viewport.w - win.x);
      win.h = Math.min(h, this.sys.viewport.h - win.y);
      const rec = this.windowEls.get(win.id);
      if (rec) { rec.el.style.left = win.x + 'px'; rec.el.style.top = win.y + 'px'; rec.el.style.width = win.w + 'px'; rec.el.style.height = win.h + 'px'; }
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp);
      changed('resize-window');
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }
  async openNotifications() {
    const sys = this.sys;
    if (sys.isRoot && this.widgetsPanel) {
      this.closeStart();
      this.widgetsPanel.open('notifications');
      this.drawer = 'widgets';
      return;
    }
    const items = sys.notifications.slice(0, 10);
    const menu = items.length ? items.map(n => ({ label: `${n.title} · ${n.body}`, action: () => { n.read = true; this.syncTray(); } })) : [{ label: '暂无通知', disabled: true }];
    const view = this;
    showMenu(sys, sys.viewport.w - 320, sys.viewport.h - 140, [
      { header: '通知中心' }, ...menu, { sep: true },
      { label: '全部标为已读', icon: 'check', action: () => { sys.notifications.forEach(n => n.read = true); view.syncTray(); changed('notif'); } },
      { label: '清除全部', icon: 'trash', action: () => { sys.notifications = []; view.syncTray(); changed('notif'); } }
    ]);
  }
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this.resizeObserver) this.resizeObserver.disconnect();
    for (const id of [...this.windowEls.keys()]) this.destroyWindowDom(id);
    if (this.widgetsPanel) this.widgetsPanel.destroy();
    this.closeMenu();
    if (this.rootEl) this.rootEl.remove();
  }
}

function WinDragIgnore(e) {
  return false;
}

export function systemThumb(sys) { return appIcon(sys.isRoot ? 'systems' : 'player', 20); }
