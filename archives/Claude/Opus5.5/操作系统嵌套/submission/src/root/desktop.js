// 根系统桌面：窗口管理、任务栏、开始菜单、托盘、通知、对话框。题面允许根系统桌面由宿主实现。
import { iconSvg } from '../host/icons.js';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'tid') { el.dataset.testid = v; if (!el.dataset.systemId) el.dataset.systemId = 'outer'; }
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'label') { el.setAttribute('aria-label', v); el.title = v; }
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list' && !k.startsWith('data')) el[k] = v;
      else el.setAttribute(k, v);
    }
  }
  for (const c of kids.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}
export const icon = (name, cls) => h('div', { class: 'ico ' + (cls || ''), html: iconSvg(name) });
export const fmtBytes = (n) => (n < 1024 ? `${Math.floor(n)} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`);
export const fmtUnits = (n) => (n < 1000 ? String(Math.floor(n)) : n < 1e6 ? `${(n / 1e3).toFixed(1)} K` : n < 1e9 ? `${(n / 1e6).toFixed(2)} M` : `${(n / 1e9).toFixed(2)} G`);

const TASKBAR_H = 46;
const TITLE_H = 34;

export class RootDesktop {
  constructor({ el, kernel, device, gfx }) {
    this.el = el;
    this.K = kernel;
    this.D = device;
    this.gfx = gfx;
    this.windows = new Map();
    this.nextWin = 1;
    this.nextZ = 10;
    this.focused = null;
    this.apps = {};
    this.notifications = [];
    this.notifRead = 0;
    this.dnd = false;
    this.settings = { name: '根系统', wallpaper: 'root', accent: '#f5c542', scale: 1, theme: 'dark', notes: [], timer: null };
    this.startOpen = false;
    this.cascade = 0;
    this.projByKey = new Map();
    this.iconSel = null;
    el.classList.add('desktop', 'level-1');
    this.build();
    document.addEventListener('keydown', (e) => this.onKey(e), true);
    document.addEventListener('keyup', (e) => this.onKey(e), true);
    document.addEventListener('pointerdown', (e) => this.onGlobalDown(e), true);
    window.addEventListener('resize', () => this.layout());
    this.layout();
    setInterval(() => this.updateClock(), 500);
  }
  get W() { return this.el.clientWidth; }
  get H() { return this.el.clientHeight; }
  get deskH() { return this.H - TASKBAR_H; }

  // —— 结构 ——
  build() {
    this.el.dataset.testid = 'os-desktop';
    this.el.dataset.systemId = 'outer';
    this.el.dataset.dropDir = '/Desktop';
    this.wall = h('div', { class: 'wallpaper' });
    this.iconsEl = h('div', { style: 'position:absolute;inset:0 0 46px 0' });
    this.winLayer = h('div', { style: 'position:absolute;inset:0;pointer-events:none' });
    this.taskbar = h('div', { class: 'taskbar', style: `left:0;right:0;bottom:0;height:${TASKBAR_H}px;z-index:50000` });
    this.popLayer = h('div', { style: 'position:absolute;inset:0;pointer-events:none;z-index:60000' });
    this.el.append(this.wall, this.iconsEl, this.winLayer, this.taskbar, this.popLayer);
    this.iconsEl.addEventListener('pointerdown', (e) => {
      if (e.target === this.iconsEl) { this.selectIcon(null); this.setFocus(null); }
    });
    this.el.addEventListener('contextmenu', (e) => {
      if (e.target.closest('[data-nest-top]') || e.target.closest('webview') || e.target.closest('input,textarea')) return;
      e.preventDefault();
      if (e.target === this.iconsEl || e.target === this.winLayer || e.target === this.wall || e.target === this.el) this.desktopMenu(e);
    });
    this.buildTaskbar();
  }
  buildTaskbar() {
    const T = this.taskbar;
    T.textContent = '';
    this.startBtn = h('div', { class: 'tb-start', tid: 'start-toggle', label: '开始', role: 'button', style: 'left:6px;top:5px;width:40px;height:36px;', html: iconSvg('start'), onclick: () => this.toggleStart() });
    T.appendChild(this.startBtn);
    let x = 50;
    for (const [id, name] of [['files', '文件管理器'], ['spreadsheet', '电子表格'], ['browser', '浏览器'], ['tasks', '任务管理器']]) {
      T.appendChild(h('div', { class: 'tb-pin', tid: 'pinned-' + id, role: 'button', label: name, style: `left:${x}px;top:5px;width:38px;height:36px`, html: iconSvg(id), onclick: () => this.launch(id) }));
      x += 40;
    }
    T.appendChild(h('div', { class: 'tb-sysnew', tid: 'system-new', role: 'button', label: '新建子系统', text: '＋ 子系统', 'data-system-id': 'outer', style: `left:${x}px;top:8px;width:92px;height:30px`, onclick: () => this.newSystem() }));
    x += 98;
    this.itemsEl = h('div', { style: `position:absolute;left:${x}px;right:230px;top:0;bottom:0;overflow:hidden` });
    T.appendChild(this.itemsEl);
    this.pathEl = h('div', { class: 'tray-path', style: 'right:186px;top:8px;width:40px;height:30px', text: 'L1', label: '根系统 outer · 第 1 层' });
    this.widgetsBtn = h('div', { class: 'tray-btn', tid: 'widgets-toggle', role: 'button', label: '小组件', style: 'right:150px;top:8px;width:32px;height:30px', html: iconSvg('widgets'), onclick: () => this.launch('widgets') });
    this.notifBtn = h('div', { class: 'tray-btn', tid: 'notifications-toggle', role: 'button', label: '通知中心', style: 'right:116px;top:8px;width:32px;height:30px', html: iconSvg('bell'), onclick: () => this.toggleNotifPanel() });
    this.clockEl = h('div', { class: 'tray-clock two', style: 'right:6px;top:4px;width:106px;height:38px', tid: 'tray-clock' });
    T.append(this.pathEl, this.widgetsBtn, this.notifBtn, this.clockEl);
    this.updateClock();
  }
  updateClock() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    this.clockEl.innerHTML = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}<br>${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  layout() {
    const s = this.settings.scale || 1;
    const hostW = window.innerWidth, hostH = window.innerHeight;
    this.el.style.width = hostW / s + 'px';
    this.el.style.height = hostH / s + 'px';
    this.el.style.zoom = s;
    this.D.uiScale = s;
    for (const w of this.windows.values()) { this.clampWindow(w); this.applyGeom(w); }
    this.renderIcons();
    if (this.gfx) this.gfx.markAllDirty();
  }

  // —— 外观 ——
  applySettings() {
    const S = this.settings;
    document.documentElement.classList.toggle('theme-light', S.theme === 'light');
    document.documentElement.style.setProperty('--accent', S.accent);
    const lum = parseInt(S.accent.slice(1, 3), 16) * 0.3 + parseInt(S.accent.slice(3, 5), 16) * 0.59 + parseInt(S.accent.slice(5, 7), 16) * 0.11;
    document.documentElement.style.setProperty('--on-accent', lum > 140 ? '#231a05' : '#ffffff');
    this.wall.style.backgroundImage = `url(../assets/wallpapers/${S.wallpaper}.jpg)`;
    this.layout();
    for (const f of this.settingsListeners || []) f();
  }
  onSettings(f) { (this.settingsListeners = this.settingsListeners || []).push(f); }
  async saveSettings() { await window.hostApi.settingsSave(this.settings); }
  setSetting(k, v) {
    this.settings[k] = v;
    this.applySettings();
    this.saveSettings();
  }

  // —— 图标 ——
  setIcons(list) { this.iconList = list; this.renderIcons(); }
  selectIcon(i) {
    this.iconSel = i;
    [...this.iconsEl.children].forEach((c, n) => c.classList.toggle('selected', n === i));
  }
  renderIcons() {
    const list = this.iconList || [];
    const box = this.iconsEl;
    box.textContent = '';
    const dh = this.deskH;
    const rows = Math.max(1, Math.floor((dh - 12) / 92));
    list.forEach((it, i) => {
      const col = Math.floor(i / rows), row = i % rows;
      const a = {};
      if (it.app) a['data-app-id'] = it.app;
      if (it.path) { a['data-file-path'] = it.path; a['data-drag-paths'] = JSON.stringify([it.path]); }
      const n = h('div', {
        class: 'desk-icon', tid: 'desktop-icon', 'data-system-id': 'outer', label: it.name, role: 'button', ...a, style: `left:${10 + col * 92}px;top:${10 + row * 92}px;width:86px;height:86px`,
        onpointerdown: (e) => { e.stopPropagation(); this.selectIcon(i); this.setFocus(null); },
        ondblclick: () => this.openIcon(it),
        oncontextmenu: (e) => { e.preventDefault(); e.stopPropagation(); this.selectIcon(i); this.menu(e.clientX, e.clientY, [['打开', () => this.openIcon(it)]]); },
      },
      h('div', { class: 'ico', style: 'position:absolute;left:21px;top:6px;width:44px;height:44px', html: iconSvg(it.icon) }),
      h('div', { class: 'desk-icon-name', style: 'left:2px;top:52px;width:82px;height:32px', text: it.name }));
      box.appendChild(n);
    });
  }
  openIcon(it) {
    if (it.app) this.launch(it.app);
    else if (it.path) this.openFile(it.path);
    else if (it.action) it.action();
  }
  openFile(path) {
    const ext = (path.split('.').pop() || '').toLowerCase();
    if (ext === 'sheet') this.launch('spreadsheet', { file: path });
    else if (ext === 'md') this.launch('help', { file: path });
    else if (ext === 'scene' || ext === 'flight') {
      this.notify('info', '三维场景在子系统的播放器中运行。把文件拖到子系统的文件管理器，或先新建一个子系统。');
      if (!this.K.children.size) this.newSystem();
    } else this.launch('editor', { file: path });
  }
  registerApp(id, fn) { this.apps[id] = fn; }
  launch(id, args) {
    const f = this.apps[id];
    if (!f) { this.notify('error', '没有这个应用：' + id); return null; }
    this.closeStart();
    return f(this, args || {});
  }

  // —— 窗口 ——
  createWindow(o) {
    const id = 'outer:w' + this.nextWin++;
    const size = this.fitSize(o.w || 720, o.h || 480);
    let x = o.x, y = o.y;
    if (x === undefined) {
      const n = this.cascade++ % 7;
      x = 96 + n * 34; y = 22 + n * 30;
      if (x + size[0] > this.W) x = Math.max(0, this.W - size[0]);
      if (y + size[1] > this.deskH) y = Math.max(0, this.deskH - size[1]);
    }
    const win = { id, app: o.app, title: o.title, icon: o.icon || o.app, x, y, w: size[0], h: size[1], state: 'normal', prev: null, kind: o.kind || 'app', onClose: o.onClose, onKey: o.onKey, onResize: o.onResize, onFocus: o.onFocus, svc: o.svc };
    const titleText = h('div', { class: 'win-title-text', text: o.title, style: `left:33px;right:130px;top:0;height:${TITLE_H}px` });
    const mk = (cls, tid, label, name, x2, fn) => h('div', { class: 'win-btn ' + cls, tid, 'data-system-id': 'outer', 'data-window-id': id, label, role: 'button', html: iconSvg(name), style: `right:${x2}px;top:0;width:42px;height:${TITLE_H}px`, onpointerdown: (e) => e.stopPropagation(), onclick: fn });
    win.maxBtn = mk('', 'window-maximize', '最大化', 'max', 42, () => this.toggleMax(win));
    const titlebar = h('div', {
      class: 'win-title', tid: 'window-titlebar', 'data-system-id': 'outer', 'data-window-id': id, style: `left:0;right:0;top:0;height:${TITLE_H}px`,
      onpointerdown: (e) => this.beginDrag(win, e), ondblclick: (e) => { if (!e.target.closest('.win-btn')) this.toggleMax(win); },
    },
    h('div', { class: 'ico', style: 'position:absolute;left:9px;top:8px;width:18px;height:18px', html: iconSvg(win.icon) }),
    titleText,
    mk('', 'window-minimize', '最小化', 'min', 84, () => this.minimize(win)), win.maxBtn,
    mk('close', 'window-close', '关闭', 'close', 0, () => this.requestClose(win)));
    win.titleText = titleText;
    win.titlebar = titlebar;
    const top = TITLE_H + (o.barH || 0);
    const body = h('div', { class: 'win-body', style: `left:0;right:0;top:${top}px;bottom:0` });
    win.body = body; win.top = top;
    const el = h('div', { class: 'app-window', tid: 'app-window', 'data-system-id': 'outer', 'data-window-id': id, 'data-app-id': o.app }, titlebar, body);
    if (o.attrs) for (const k in o.attrs) el.setAttribute(k, o.attrs[k]);
    for (const e of ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']) {
      const edge = h('div', { class: `win-edge edge-${e}`, onpointerdown: (ev) => this.beginResize(win, e, ev) });
      if (e === 'se') { edge.dataset.testid = 'window-resize'; edge.dataset.systemId = 'outer'; edge.dataset.windowId = id; edge.classList.add('win-resize'); edge.setAttribute('aria-label', '调整窗口大小'); edge.style.position = 'absolute'; }
      el.appendChild(edge);
    }
    win.el = el;
    // 根应用窗口里的控件自动标注所属窗口；子系统内容由显示设备标注
    const stamp = (n) => {
      if (n.nodeType !== 1 || n.classList.contains('nest-instance') || n.dataset.surface) return;
      if (n.dataset.testid || n.dataset.dropDir) { n.dataset.systemId = 'outer'; n.dataset.windowId = id; }
      for (const c of n.children) stamp(c);
    };
    win.stamp = stamp;
    if (win.kind === 'app') new MutationObserver((list) => { for (const m of list) for (const n of m.addedNodes) stamp(n); }).observe(body, { childList: true, subtree: true });
    el.addEventListener('pointerdown', () => this.activate(win), true);
    this.winLayer.appendChild(el);
    this.windows.set(id, win);
    win.taskItem = h('div', {
      class: 'tb-item', tid: 'taskbar-item', 'data-system-id': 'outer', 'data-window-id': id, role: 'button', label: o.title, onclick: () => this.taskClick(win),
    }, h('div', { class: 'ico', style: 'position:absolute;left:8px;top:9px;width:18px;height:18px', html: iconSvg(win.icon) }), h('div', { class: 'tb-item-text', style: 'left:31px;right:4px;top:0;height:34px', text: o.title }));
    this.itemsEl.appendChild(win.taskItem);
    this.layoutTaskItems();
    this.applyGeom(win);
    this.activate(win);
    return win;
  }
  fitSize(w, h2) { return [Math.min(w, this.W - 16), Math.min(h2, this.deskH - 12)]; }
  setTitle(win, t) {
    win.title = t;
    win.titleText.textContent = t;
    win.taskItem.querySelector('.tb-item-text').textContent = t;
    win.taskItem.setAttribute('aria-label', t);
  }
  rect(win) { return win.state === 'max' ? [0, 0, this.W, this.deskH] : [win.x, win.y, win.w, win.h]; }
  applyGeom(win) {
    const [x, y, w, h2] = this.rect(win);
    const s = win.el.style;
    s.left = x + 'px'; s.top = y + 'px'; s.width = w + 'px'; s.height = h2 + 'px';
    s.display = win.state === 'min' ? 'none' : '';
    win.el.classList.toggle('maximized', win.state === 'max');
    win.maxBtn.innerHTML = iconSvg(win.state === 'max' ? 'restore' : 'max');
    win.maxBtn.setAttribute('aria-label', win.state === 'max' ? '还原' : '最大化');
    if (win.onResize && win.state !== 'min') {
      const cw = w, ch = h2 - win.top;
      if (cw !== win.cw || ch !== win.ch) { win.cw = cw; win.ch = ch; win.onResize(cw, ch); }
    }
  }
  clampWindow(win) {
    if (win.w > this.W) win.w = this.W;
    if (win.h > this.deskH) win.h = this.deskH;
    if (win.x + 60 > this.W) win.x = Math.max(0, this.W - win.w);
    if (win.y + TITLE_H > this.deskH) win.y = Math.max(0, this.deskH - win.h);
  }
  activate(win) {
    if (win.state === 'min') return;
    win.el.style.zIndex = ++this.nextZ;
    this.setFocus(win);
  }
  setFocus(win) {
    if (this.focused === win) return;
    const old = this.focused;
    if (old) { old.el.classList.remove('focused'); old.taskItem.classList.remove('active'); if (old.onFocus) old.onFocus(false); }
    this.focused = win;
    if (win) { win.el.classList.add('focused'); win.taskItem.classList.add('active'); if (win.onFocus) win.onFocus(true); }
    if (!win || (document.activeElement && !win.el.contains(document.activeElement))) {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      if (win && win.onFocus) win.onFocus(true);
    }
  }
  focusTop() {
    let best = null;
    for (const w of this.windows.values()) if (w.state !== 'min' && (!best || +w.el.style.zIndex > +best.el.style.zIndex)) best = w;
    this.setFocus(best);
  }
  minimize(win) {
    if (win.state === 'min') return;
    win.prev = win.state;
    win.state = 'min';
    this.applyGeom(win);
    win.taskItem.classList.add('minimized');
    if (this.focused === win) { this.setFocus(null); this.focusTop(); }
    if (this.gfx) this.gfx.markAllDirty();
  }
  restore(win) {
    if (win.state === 'min') {
      win.state = win.prev || 'normal';
      win.taskItem.classList.remove('minimized');
      this.applyGeom(win);
      if (this.gfx) this.gfx.markAllDirty();
    }
    this.activate(win);
  }
  toggleMax(win) {
    win.state = win.state === 'max' ? 'normal' : 'max';
    this.applyGeom(win);
    if (this.gfx) this.gfx.markAllDirty();
  }
  taskClick(win) {
    if (win.state === 'min') this.restore(win);
    else if (this.focused === win) this.minimize(win);
    else this.activate(win);
  }
  layoutTaskItems() {
    const list = [...this.windows.values()];
    const room = this.itemsEl.clientWidth || 600;
    const w = Math.max(44, Math.min(172, Math.floor(room / Math.max(1, list.length))));
    list.forEach((win, i) => {
      const s = win.taskItem.style;
      s.left = i * w + 'px'; s.top = '5px'; s.width = w - 3 + 'px'; s.height = '36px';
    });
  }
  async requestClose(win) {
    if (win.onClose) {
      const r = await win.onClose();
      if (r === false) return;
    }
    this.destroyWindow(win);
  }
  destroyWindow(win) {
    if (!this.windows.has(win.id)) return;
    this.windows.delete(win.id);
    win.el.remove();
    win.taskItem.remove();
    this.layoutTaskItems();
    if (this.focused === win) { this.focused = null; this.focusTop(); }
    if (win.svc) this.K.endService(win.svc);
    if (win.onDestroyed) win.onDestroyed();
  }
  beginDrag(win, e) {
    if (e.button !== 0 || e.target.closest('.win-btn')) return;
    const r = this.rect(win);
    const k = this.scaleK();
    const st = { dx: e.clientX / k - r[0], dy: e.clientY / k - r[1], moved: false };
    document.body.classList.add('dragging-window');
    const move = (ev) => {
      const px2 = ev.clientX / k, py = ev.clientY / k;
      if (!st.moved && Math.hypot(px2 - r[0] - st.dx, py - r[1] - st.dy) < 3) return;
      st.moved = true;
      if (win.state === 'max') { win.state = 'normal'; st.dx = win.w * (st.dx / this.W); }
      win.x = Math.round(Math.min(this.W - 60, Math.max(60 - win.w, px2 - st.dx)));
      win.y = Math.round(Math.max(0, Math.min(this.deskH - TITLE_H, py - st.dy)));
      this.applyGeom(win);
      this.showSnapPreview(px2, py);
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      document.body.classList.remove('dragging-window');
      this.hideSnapPreview();
      if (st.moved) {
        const px2 = ev.clientX / k, py = ev.clientY / k;
        if (px2 <= 3) this.snap(win, 'left');
        else if (px2 >= this.W - 4) this.snap(win, 'right');
        else if (py <= 1) { win.state = 'max'; this.applyGeom(win); }
      }
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }
  showSnapPreview(x, y) {
    let r = null;
    if (x <= 3) r = [0, 0, this.W / 2, this.deskH];
    else if (x >= this.W - 4) r = [this.W / 2, 0, this.W / 2, this.deskH];
    else if (y <= 1) r = [0, 0, this.W, this.deskH];
    if (!r) { this.hideSnapPreview(); return; }
    if (!this.snapEl) { this.snapEl = h('div', { class: 'snap-preview' }); this.popLayer.appendChild(this.snapEl); }
    Object.assign(this.snapEl.style, { left: r[0] + 'px', top: r[1] + 'px', width: r[2] + 'px', height: r[3] + 'px' });
  }
  hideSnapPreview() { if (this.snapEl) { this.snapEl.remove(); this.snapEl = null; } }
  snap(win, side) {
    win.state = 'normal';
    win.w = Math.floor(this.W / 2); win.h = this.deskH; win.y = 0;
    win.x = side === 'left' ? 0 : this.W - win.w;
    this.applyGeom(win);
  }
  scaleK() { return this.settings.scale || 1; }
  beginResize(win, edge, e) {
    if (e.button !== 0 || win.state === 'max') return;
    e.stopPropagation();
    const k = this.scaleK();
    const s = { x: e.clientX / k, y: e.clientY / k, ox: win.x, oy: win.y, ow: win.w, oh: win.h };
    document.body.classList.add('dragging-window');
    const move = (ev) => {
      const dx = ev.clientX / k - s.x, dy = ev.clientY / k - s.y;
      let { ox: nx, oy: ny, ow: nw, oh: nh } = s;
      if (edge.includes('e')) nw = s.ow + dx;
      if (edge.includes('s')) nh = s.oh + dy;
      if (edge.includes('w')) { nw = s.ow - dx; nx = s.ox + dx; }
      if (edge.includes('n')) { nh = s.oh - dy; ny = s.oy + dy; }
      if (nw < 280) { if (edge.includes('w')) nx = s.ox + s.ow - 280; nw = 280; }
      if (nh < 160) { if (edge.includes('n')) ny = s.oy + s.oh - 160; nh = 160; }
      if (ny < 0) { nh += ny; ny = 0; }
      win.x = Math.round(nx); win.y = Math.round(ny); win.w = Math.round(nw); win.h = Math.round(nh);
      this.applyGeom(win);
    };
    const up = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      document.body.classList.remove('dragging-window');
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }

  // —— 键盘：只有焦点应用处理按键 ——
  onKey(e) {
    if (e.key === 'Escape' && e.type === 'keydown' && (this.startOpen || this.menuEl || this.panelEl)) { this.closePopups(); e.preventDefault(); return; }
    const win = this.focused;
    const t = e.target;
    if (this.dialogEl) {
      if (e.type === 'keydown' && e.key === 'Escape' && this.dialogCancel) { this.dialogCancel(); e.preventDefault(); e.stopPropagation(); }
      return;
    }
    if (t && t.closest && t.closest('.start-menu')) return;
    if (!win) return;
    if (win.top_) {
      this.D.sendKey(win.top_, e);
      const native = t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
      if (!native || (e.ctrlKey && ['s', 'S'].includes(e.key))) { e.preventDefault(); }
      return;
    }
    if (win.onKey) win.onKey(e);
  }
  onGlobalDown(e) {
    const inPopup = e.target.closest && (e.target.closest('.start-menu,.panel-pop,.ctx-menu') || e.target.closest('[data-testid="start-toggle"],[data-testid="notifications-toggle"]'));
    if (!inPopup) this.closePopups();
  }
  closePopups() { this.closeStart(); this.closeMenu(); this.closePanel(); }

  // —— 开始菜单 ——
  toggleStart() { if (this.startOpen) this.closeStart(); else this.openStart(); }
  openStart() {
    this.closeMenu(); this.closePanel();
    this.startOpen = true;
    this.startBtn.classList.add('on');
    const apps = [
      ['launch-files', 'files', '文件管理器', () => this.launch('files')], ['launch-spreadsheet', 'spreadsheet', '电子表格', () => this.launch('spreadsheet')],
      ['launch-browser', 'browser', '浏览器', () => this.launch('browser')], ['launch-widgets', 'widgets', '桌面小组件', () => this.launch('widgets')],
      ['launch-editor', 'editor', '程序编辑器', () => this.launch('editor')], ['launch-tasks', 'tasks', '任务管理器', () => this.launch('tasks')],
      ['launch-settings', 'settings', '设置', () => this.launch('settings')], ['launch-systems', 'systems', '子系统管理', () => this.launch('systems')],
      ['launch-help', 'help', '操作说明', () => this.launch('help')],
    ];
    const list = h('div', { style: 'position:absolute;left:10px;right:10px;top:104px;bottom:10px;overflow:auto;' });
    const render = (q) => {
      list.textContent = '';
      let y = 0;
      for (const [tid, ic, name, fn] of apps) {
        if (q && !name.includes(q) && !tid.includes(q.toLowerCase())) continue;
        list.appendChild(h('div', { class: 'start-item', tid, 'data-system-id': 'outer', role: 'button', label: name, style: `left:0;right:0;top:${y}px;height:40px`, onclick: () => { this.closeStart(); fn(); } },
          h('div', { class: 'ico', style: 'position:absolute;left:10px;top:8px;width:24px;height:24px', html: iconSvg(ic) }), h('div', { class: 'start-item-text', style: 'left:44px;right:6px;top:0', text: name })));
        y += 42;
      }
      if (y === 0) list.appendChild(h('div', { class: 'panel-empty', style: 'left:10px;top:6px', text: '没有找到应用' }));
    };
    const search = h('input', { class: 'rfield', tid: 'start-search', placeholder: '查找应用', style: 'position:absolute;left:14px;right:14px;top:60px;width:calc(100% - 28px)', oninput: (e) => render(e.target.value.trim()), onkeydown: (e) => { if (e.key === 'Enter') { const first = list.querySelector('.start-item'); if (first) first.click(); } } });
    render('');
    this.startEl = h('div', { class: 'start-menu', tid: 'start-menu', 'data-system-id': 'outer', style: `left:6px;bottom:50px;width:340px;height:${Math.min(this.deskH - 10, 104 + apps.length * 42 + 12)}px;pointer-events:auto` },
      h('div', { class: 'start-head', style: 'left:16px;top:12px', text: this.settings.name + ' · 第 1 层' }), h('div', { class: 'start-sub', style: 'left:16px;top:36px;right:16px', text: 'outer · 根系统桌面' }), search, list);
    this.popLayer.appendChild(this.startEl);
    search.focus();
  }
  closeStart() {
    if (!this.startOpen) return;
    this.startOpen = false;
    this.startBtn.classList.remove('on');
    if (this.startEl) { this.startEl.remove(); this.startEl = null; }
  }

  // —— 右键菜单 ——
  menu(cx, cy, items) {
    this.closeMenu();
    const k = this.scaleK();
    let x = cx / k, y = cy / k;
    const mh = items.length * 34 + 8;
    if (x + 190 > this.W) x = this.W - 190;
    if (y + mh > this.H) y = this.H - mh;
    this.menuEl = h('div', { class: 'ctx-menu', tid: 'context-menu', style: `left:${x}px;top:${y}px;width:190px;height:${mh}px;pointer-events:auto` });
    items.forEach(([label, fn], i) => {
      this.menuEl.appendChild(h('div', { class: 'menu-item', role: 'menuitem', label, text: label, style: `left:4px;right:4px;top:${4 + i * 34}px;height:32px`, onclick: () => { this.closeMenu(); fn(); } }));
    });
    this.popLayer.appendChild(this.menuEl);
  }
  closeMenu() { if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; } }
  desktopMenu(e) {
    this.menu(e.clientX, e.clientY, [
      ['新建子系统', () => this.newSystem()], ['文件管理器', () => this.launch('files')], ['电子表格', () => this.launch('spreadsheet')], ['浏览器', () => this.launch('browser')],
      ['设置', () => this.launch('settings')], ['操作说明', () => this.launch('help')],
    ]);
  }

  // —— 通知 ——
  notify(level, text, source) {
    const n = { level, text, source: source || '系统', time: Date.now(), read: false };
    this.notifications.push(n);
    if (this.notifications.length > 200) this.notifications.shift();
    this.updateNotifBadge();
    for (const f of this.notifListeners || []) f();
    if (this.panelEl) this.renderNotifPanel();
    if (this.dnd) return;
    this.toast(level, text);
  }
  onNotify(f) { (this.notifListeners = this.notifListeners || []).push(f); }
  updateNotifBadge() { this.notifBtn.classList.toggle('unread', this.notifications.some((n) => !n.read)); }
  toast(level, text) {
    if (!this.toastBox) { this.toastBox = h('div', { style: 'position:absolute;right:10px;bottom:54px;width:330px;pointer-events:none;display:flex;flex-direction:column;gap:6px;align-items:stretch' }); this.popLayer.appendChild(this.toastBox); }
    const t = h('div', { class: 'toast lv-' + level, tid: 'toast', style: 'position:relative;min-height:40px;pointer-events:auto', text });
    this.toastBox.appendChild(t);
    while (this.toastBox.children.length > 4) this.toastBox.firstChild.remove();
    setTimeout(() => t.remove(), 5200);
  }
  toggleNotifPanel() {
    if (this.panelEl) { this.closePanel(); return; }
    this.closeMenu(); this.closeStart();
    this.panelEl = h('div', { class: 'panel-pop', tid: 'notifications-panel', 'data-system-id': 'outer', style: `right:6px;bottom:50px;width:360px;height:${Math.min(this.deskH - 10, 460)}px;pointer-events:auto` });
    this.popLayer.appendChild(this.panelEl);
    this.renderNotifPanel();
  }
  closePanel() { if (this.panelEl) { this.panelEl.remove(); this.panelEl = null; } }
  renderNotifPanel() {
    const P = this.panelEl;
    P.textContent = '';
    P.append(
      h('div', { class: 'panel-title', style: 'left:14px;top:10px', text: '通知中心' }),
      h('div', { class: 'flow', style: 'position:absolute;right:10px;top:9px' },
        h('button', { class: 'rbtn', text: '全部已读', onclick: () => { this.notifications.forEach((n) => { n.read = true; }); this.updateNotifBadge(); this.renderNotifPanel(); for (const f of this.notifListeners || []) f(); } }),
        h('button', { class: 'rbtn', text: '清除', onclick: () => { this.notifications = []; this.updateNotifBadge(); this.renderNotifPanel(); for (const f of this.notifListeners || []) f(); } }),
        h('button', { class: 'rbtn' + (this.dnd ? ' on' : ''), text: '免打扰', onclick: () => { this.setDnd(!this.dnd); this.renderNotifPanel(); } })),
    );
    const list = h('div', { style: 'position:absolute;left:8px;right:8px;top:46px;bottom:8px;overflow:auto' });
    if (!this.notifications.length) list.appendChild(h('div', { style: 'color:var(--text-3);padding:12px', text: '没有通知' }));
    for (const n of [...this.notifications].reverse()) {
      const d = new Date(n.time);
      list.appendChild(h('div', { class: 'notif-item' + (n.read ? '' : ' unread'), onclick: () => { n.read = true; this.updateNotifBadge(); this.renderNotifPanel(); }, text: `${d.toLocaleTimeString()}  ${n.text}` }));
    }
    P.appendChild(list);
  }
  setDnd(v) { this.dnd = v; for (const f of this.settingsListeners || []) f(); }

  // —— 对话框 ——
  dialog(title, text, buttons, extra) {
    return new Promise((resolve) => {
      const close = (v) => { if (this.dialogEl) { this.dialogEl.remove(); this.dialogEl = null; this.dialogCancel = null; } resolve(v); };
      const box = h('div', { class: 'dialog', tid: 'dialog', style: 'left:50%;top:50%;width:440px;min-height:170px;transform:translate(-50%,-50%);padding:0 0 56px' },
        h('div', { style: 'padding:14px 20px 6px;font-size:15px;font-weight:700', text: title }),
        h('div', { style: 'padding:0 20px 8px;color:var(--text-2);line-height:20px;word-break:break-word', text }), extra || null);
      const row = h('div', { class: 'flow', style: 'position:absolute;right:14px;bottom:12px' });
      for (const b of buttons) row.appendChild(h('button', { class: 'rbtn' + (b.primary ? ' primary' : ''), tid: b.tid || 'dialog-' + b.value, text: b.label, onclick: () => close(b.value) }));
      box.appendChild(row);
      this.dialogEl = h('div', { class: 'dialog-shade', style: 'inset:0;z-index:70000;pointer-events:auto' }, box);
      this.dialogCancel = () => close(buttons.find((b) => b.cancel) ? buttons.find((b) => b.cancel).value : null);
      this.popLayer.appendChild(this.dialogEl);
      const f = box.querySelector('input'); if (f) { f.focus(); f.select(); }
    });
  }
  confirm3(title, text) {
    return this.dialog(title, text, [{ label: '保存', value: 'save', primary: true, tid: 'dialog-save' }, { label: '放弃', value: 'discard', tid: 'dialog-discard' }, { label: '取消', value: 'cancel', cancel: true, tid: 'dialog-cancel' }]);
  }
  async prompt(title, text, value) {
    const input = h('input', { class: 'rfield', tid: 'dialog-input', value: value || '', style: 'margin:0 20px;width:calc(100% - 40px)', onkeydown: (e) => { if (e.key === 'Enter') this.dialogEl.querySelector('[data-testid="dialog-ok"]').click(); } });
    const r = await this.dialog(title, text, [{ label: '确定', value: 'ok', primary: true, tid: 'dialog-ok' }, { label: '取消', value: 'cancel', cancel: true, tid: 'dialog-cancel' }], input);
    return r === 'ok' ? input.value : null;
  }

  // —— 子系统窗口 ——
  newSystem() {
    const r = this.K.sysctl('new', { w: 980, h: 620 });
    if (r && r.error) this.notify('error', r.error);
    return r;
  }
  childWindow(info) {
    const n = this.K.children.size - 1;
    const W = Math.max(520, Math.floor(this.W * 0.76)), H = Math.max(360, Math.floor(this.deskH * 0.94));
    const x = Math.min(Math.max(0, this.W - W), 90 + n * 34), y = Math.min(Math.max(0, this.deskH - H), 6 + n * 26);
    const win = this.createWindow({ app: 'system', title: `${info.name} · 第 2 层`, icon: 'system', kind: 'system', w: W, h: H, x, y, barH: 36, onClose: () => this.closeSystemWindow(win), onResize: (w, h2) => { this.K.sysctl('resize', info.id, w, h2); } });
    win.child = info.id;
    win.el.setAttribute('data-child-system-id', info.id);
    win.el.classList.add('level-2');
    win.bar = h('div', { class: 'sysbar', style: `left:0;right:0;top:${TITLE_H}px;height:36px` });
    win.el.appendChild(win.bar);
    win.body.classList.add('sys-viewport');
    win.top_ = { kind: 'system', sys: info.id };
    this.D.attachTop(win.body, win.top_);
    this.D.tops.get(win.body.dataset.nestTop);
    win.top_ = this.D.tops.get(win.body.dataset.nestTop);
    this.D.mountChild(info.id, win.body);
    this.renderSysBar(win);
    this.K.sysctl('resize', info.id, win.cw, win.ch);
    return win;
  }
  systemWindow(id) { for (const w of this.windows.values()) if (w.child === id) return w; return null; }
  renderSysBar(win) {
    const K = this.K;
    const c = K.children.get(win.child);
    if (!c || !win.bar) return;
    const B = win.bar;
    B.textContent = '';
    const cn = { running: '运行中', paused: '已暂停', booting: '启动中', stopped: '已停止', error: '内核错误' };
    const row = h('div', { class: 'flow', style: 'position:absolute;left:8px;top:4px;right:8px;height:28px;overflow:hidden' });
    row.appendChild(h('div', { class: 'state-chip s-' + c.state, tid: 'system-state', 'data-target-system-id': c.id, style: 'position:static;width:76px;height:24px;flex:none', text: cn[c.state] || c.state }));
    const btn = (label, tid, fn) => h('button', { class: 'rbtn', tid, 'data-system-id': 'outer', 'data-window-id': win.id, 'data-target-system-id': c.id, label: `${label} ${c.id}`, text: label, style: 'height:26px;line-height:24px', onclick: fn });
    const act = (op, a) => { const r = K.sysctl(op, c.id, a); if (r && r.error) this.notify('error', r.error); this.renderSysBar(win); };
    if (c.state === 'running') row.appendChild(btn('暂停', 'system-pause', () => act('pause')));
    if (c.state === 'paused') { row.appendChild(btn('继续', 'system-resume', () => act('resume'))); row.appendChild(btn('单步', 'system-step', () => act('step'))); }
    if (c.state === 'stopped') row.appendChild(btn('启动', 'system-start', () => act('start')));
    row.appendChild(btn(`${c.rate}×`, 'system-rate', () => act('rate', c.rate >= 8 ? 0.25 : c.rate * 2)));
    row.appendChild(btn('快照', 'system-snapshot', () => act('snapshot')));
    row.appendChild(btn('重启', 'system-restart', () => act('restart')));
    row.appendChild(btn('内核', 'kernel-open', () => this.launch('editor', { file: K.sysctl('kernel_path', c.id) })));
    row.appendChild(btn('管理', 'system-manage', () => this.launch('systems', { target: c.id })));
    row.appendChild(h('div', { class: 'rlabel', style: 'margin-left:auto;flex:none', text: `${c.id} · 第 2 层` }));
    B.appendChild(row);
    let panel = win.errEl;
    if (c.state === 'error') {
      if (panel) panel.remove();
      panel = h('div', { class: 'kernel-error-panel', style: `position:absolute;left:0;right:0;top:${win.top}px;bottom:0` },
        h('div', { class: 'err-title', style: 'left:24px;top:22px', text: `内核错误 · ${c.id}` }),
        h('div', { class: 'err-text', tid: 'kernel-error', 'data-target-system-id': c.id, style: 'left:24px;right:24px;top:62px;bottom:70px', text: c.err || '内核错误' }),
        h('div', { class: 'err-hint', style: 'left:24px;right:24px;bottom:22px', text: '点“内核”打开源文件，修改保存后点“重启”。父系统和兄弟系统不受影响。' }));
      win.el.appendChild(panel);
      win.errEl = panel;
    } else if (panel) { panel.remove(); win.errEl = null; }
    let stop = win.stopEl;
    if (c.state === 'stopped') {
      if (!stop) { stop = h('div', { class: 'stopped-panel', style: `position:absolute;left:0;right:0;top:${win.top}px;bottom:0`, text: '实例已停止。点“启动”或“重启”重新运行。' }); win.el.appendChild(stop); win.stopEl = stop; }
    } else if (stop) { stop.remove(); win.stopEl = null; }
  }
  async closeSystemWindow(win) {
    const r = await this.dialog('关闭系统窗口', `关闭 ${win.child} 会停止它和全部后代系统中的程序。已保存的快照仍可重新打开。确定吗？`, [{ label: '取消', value: 'cancel', cancel: true, tid: 'dialog-cancel' }, { label: '停止并关闭', value: 'yes', primary: true, tid: 'dialog-confirm' }]);
    if (r !== 'yes') return false;
    this.K.sysctl('close', win.child);
    return false; // childClosed 钩子负责销毁窗口
  }

  // —— 投送窗口 ——
  projectionOpen(p) {
    const exist = this.projByKey.get(p.id);
    if (exist) { this.restore(exist); return; }
    const win = this.createWindow({
      app: 'projection', title: p.title, icon: p.src_app, kind: 'proj', w: Math.min(p.w ? p.w + 40 : 760, this.W - 40), h: Math.min((p.h ? p.h + 40 : 520) + TITLE_H, this.deskH - 20),
      attrs: { 'data-source-system-id': p.src_sys, 'data-source-window-id': p.src_win, 'data-source-app-id': p.src_app },
      onClose: () => { this.K.sendDown(p.src_path, { op: 'proj_closed', sid: p.sid, id: p.id }); this.projByKey.delete(p.id); return true; },
      onResize: (w, h2) => { this.K.sendDown(p.src_path, { op: 'proj_resize', sid: p.sid, w, h: h2 }); },
    });
    win.proj = p;
    win.body.classList.add('proj-body');
    win.titlebar.appendChild(h('div', { class: 'proj-source', tid: 'projection-source', text: `来自 ${p.src_sys} · 第 ${p.depth} 层`, style: 'right:134px;top:7px;width:154px;height:20px' }));
    win.titleText.style.right = '296px';
    this.projByKey.set(p.id, win);
    const src = this.D.inst(p.src_sys);
    win.body.dataset.projSrc = p.src_sys;
    this.D.attachTop(win.body, { kind: 'proj', path: p.src_path, src: p.src_sys, sid: p.sid });
    win.top_ = this.D.tops.get(win.body.dataset.nestTop);
    this.D.mountSurfaceInto(src, p.sid, win.body, { sys: 'outer', win: win.id, owner: p.src_sys });
    this.D.updateProjOverlay(win.body);
    this.K.sendDown(p.src_path, { op: 'proj_resize', sid: p.sid, w: win.cw, h: win.ch });
    this.notify('info', `收到投送：${p.src_sys} · ${p.title}`);
  }
  projectionClose(id, reason) {
    const win = this.projByKey.get(id);
    if (!win) return;
    this.projByKey.delete(id);
    this.destroyWindow(win);
    this.notify('info', `投送已结束：${reason || ''}`);
  }
  projectionFocus(id) { const w = this.projByKey.get(id); if (w) this.restore(w); }
}
