// 根系统桌面（宿主实现）：窗口管理、任务栏、开始菜单、桌面图标、通知、
// 直属子系统的系统窗口、投送窗口与跨层拖放。
import { h, clear, icon, iconEl, setIcons, levelColor, fileIcon, extOf } from './dom.js';
import { sysOfSid } from '../device/display.js';
import { APPS } from '../apps/index.js';

const STATE_TEXT = { running: '运行中', paused: '已暂停', held: '随祖先暂停', booting: '启动中', 'kernel-error': '内核错误', stopped: '已停止' };
const STATE_COLOR = { running: '#4ade80', paused: '#fbbf24', held: '#fbbf24', booting: '#93c5fd', 'kernel-error': '#f87171', stopped: '#66728a' };
export const WALLPAPERS = [
  { id: 'lakeside', name: '湖畔暮色', file: 'assets/wallpapers/lakeside.svg' },
  { id: 'ridge', name: '山脊晨雾', file: 'assets/wallpapers/ridge.svg' },
  { id: 'aurora', name: '极光雪原', file: 'assets/wallpapers/aurora.svg' },
];
export const ACCENTS = [
  { id: 'teal', name: '极光青', c: '#5eead4', ink: '#062a26' },
  { id: 'blue', name: '晴空蓝', c: '#60a5fa', ink: '#06213f' },
  { id: 'violet', name: '暮紫', c: '#a78bfa', ink: '#1e1240' },
  { id: 'amber', name: '琥珀', c: '#f5b942', ink: '#2e1d00' },
  { id: 'rose', name: '玫瑰', c: '#f472b6', ink: '#3a0a22' },
  { id: 'lime', name: '青柠', c: '#a3e635', ink: '#1a2a00' },
];
export const SCALES = [100, 110, 125, 150, 175];
export const DEFAULT_SETTINGS = { name: '根系统', wallpaper: 'lakeside', accent: 'teal', scale: 100, dnd: false, clock24: true };

export class Desktop {
  constructor({ root, fs, device, bridge, rootImage }) {
    this.root = root; this.fs = fs; this.device = device; this.bridge = bridge; this.rootImage = rootImage;
    this.wins = new Map(); this.order = []; this.focused = null; this.z = 10; this.winSeq = 1;
    this.notifications = []; this.clipboard = []; this.listeners = {};
    this.settings = { ...DEFAULT_SETTINGS };
    this.selIcon = null; this.drag = null; this.cascade = 0;
    this.browserTabs = new Map();
  }
  on(ev, cb) { (this.listeners[ev] ||= new Set()).add(cb); return () => this.listeners[ev].delete(cb); }
  emit(ev, d) { for (const cb of this.listeners[ev] || []) { try { cb(d); } catch (e) { console.error(e); } } }

  // ---------- 挂载 ----------
  async mount(container) {
    const icons = JSON.parse(this.fs.read('/System/icons.json') || '{}');
    setIcons(icons);
    this.device.resource('outer', 'icons', icons);
    this.loadSettings();
    this.container = container;
    this.scaler = h('div', { id: 'scaler' });
    this.desk = h('div', { class: 'desk', tid: 'os-desktop', 'data-system-id': 'outer', 'aria-label': '根系统桌面' });
    this.iconsEl = h('div', { class: 'desk-icons' });
    this.winLayer = h('div', { class: 'win-layer' });
    this.taskbar = this.buildTaskbar();
    this.toastsEl = h('div', { class: 'toasts' });
    this.desk.append(this.iconsEl, this.winLayer, this.taskbar, this.toastsEl);
    this.scaler.append(this.desk);
    container.append(this.scaler);
    this.applySettings();
    this.renderIcons();
    this.bindDesk();
    window.addEventListener('resize', () => this.layout());
    this.layout();
    this.fs.onChange((p) => { if (p.startsWith('/Desktop')) this.renderIconsSoon(); });
    this.root.on('notify', (n) => this.notify(n));
    this.root.on('tree', () => { this.refreshSystemWindows(); this.device.refreshOverlays(); this.renderTaskbarSoon(); });
    this.root.on('child-state', (c) => this.refreshSystemWindow(c.id));
    this.device.projPause = (sid) => {
      const src = sysOfSid(sid);
      const p = this.root.chainPaused(src);
      return p ? `源系统 ${p.id} ${STATE_TEXT[p.state] || p.state}，内容已冻结` : null;
    };
    this.device.onInput = (sid, ev) => this.routeDeviceInput(sid, ev);
    this.device.onSynthetic = (cx, cy, el, isFocus) => this.syntheticPointer(cx, cy, el, isFocus);
    this.device.onMeta = () => {};
    setInterval(() => this.tickClock(), 1000);
    this.tickClock();
  }
  layout() {
    const s = this.settings.scale / 100;
    this.zoom = s;
    this.scaler.style.zoom = String(s);
    this.scaler.style.width = (window.innerWidth / s) + 'px';
    this.scaler.style.height = (window.innerHeight / s) + 'px';
    this.W = window.innerWidth / s; this.H = window.innerHeight / s;
    for (const w of this.wins.values()) { this.clampWin(w); this.applyGeom(w); }
    this.renderIcons();
  }
  get deskH() { return this.H - 48; }

  // ---------- 设置 ----------
  loadSettings() {
    try { const s = this.fs.read('/System/settings.json'); if (s) this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(s) }; } catch {}
  }
  saveSettings() { this.fs.write('/System/settings.json', JSON.stringify(this.settings, null, 2)); }
  setSetting(k, v) {
    this.settings[k] = v;
    this.saveSettings();
    this.applySettings();
    this.emit('settings', this.settings);
  }
  applySettings() {
    const st = this.settings;
    const acc = ACCENTS.find((a) => a.id === st.accent) || ACCENTS[0];
    document.documentElement.style.setProperty('--accent', acc.c);
    document.documentElement.style.setProperty('--accent-ink', acc.ink);
    const wp = WALLPAPERS.find((w) => w.id === st.wallpaper) || WALLPAPERS[0];
    this.desk.style.backgroundImage = `url("app://local/${wp.file}")`;
    this.root.name = st.name || '根系统';
    this.root.rebuildTree();
    if (this.zoom !== st.scale / 100) this.layout();
    if (this.taskbar) this.renderTaskbar();
  }

  // ---------- 桌面图标 ----------
  iconList() {
    const apps = ['files', 'spreadsheet', 'browser', 'editor', 'tasks', 'widgets', 'settings', 'help'].map((id) => ({ key: 'app:' + id, app: id, label: APPS[id].name, icon: APPS[id].icon }));
    let files = [];
    try { files = this.fs.list('/Desktop').map((e) => ({ key: 'file:' + e.path, path: e.path, label: e.name, icon: fileIcon(e), entry: e })); } catch {}
    return apps.concat(files);
  }
  renderIconsSoon() { clearTimeout(this._riT); this._riT = setTimeout(() => this.renderIcons(), 60); }
  renderIcons() {
    clear(this.iconsEl);
    const rows = Math.max(1, Math.floor((this.deskH - 10) / 94));
    this.iconList().forEach((it, i) => {
      const col = Math.floor(i / rows), row = i % rows;
      const el = h('div', { class: 'desk-icon' + (this.selIcon === it.key ? ' sel' : ''), tid: 'desktop-icon', 'data-system-id': 'outer', 'aria-label': it.label, title: it.label,
        style: { left: (10 + col * 92) + 'px', top: (10 + row * 94) + 'px' } },
      h('div', { class: 'ic', html: icon(it.icon) }), h('div', { class: 'lb', text: it.label }));
      if (it.app) el.dataset.appId = it.app; else el.dataset.filePath = it.path;
      el.addEventListener('mousedown', (e) => { e.stopPropagation(); this.closeFlyouts(); this.selIcon = it.key; this.iconsEl.querySelectorAll('.desk-icon').forEach((x) => x.classList.remove('sel')); el.classList.add('sel'); if (it.path && e.button === 0) this.maybeFileDrag(e, { src: ['outer'], path: it.path, name: it.label, srcSys: 'outer' }); });
      el.addEventListener('dblclick', (e) => { e.stopPropagation(); this.openIcon(it); });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        this.contextMenu(e.clientX, e.clientY, [
          { label: '打开', icon: 'open', action: () => this.openIcon(it) },
          it.path ? { label: '删除到回收站', icon: 'trash', action: () => { this.fs.recycle(it.path); this.notify({ title: '已移到回收站', body: it.path, level: 'ok', source: 'files' }); } } : null,
          it.path ? { label: '重命名', icon: 'rename', action: async () => { const n = await this.prompt('重命名', it.label); if (n && n !== it.label) { try { this.fs.rename(it.path, '/Desktop/' + n); } catch (er) { this.notify({ title: '重命名失败', body: er.message, level: 'error' }); } } } } : null,
        ]);
      });
      this.iconsEl.append(el);
    });
  }
  openIcon(it) { if (it.app) this.openApp(it.app); else this.openFile(it.path); }
  openFile(path, opts = {}) {
    const e = this.fs.get(path);
    if (!e) return;
    if (e.type === 'dir') return this.openApp('files', { path });
    const ext = extOf(path);
    if (ext === 'sheet') return this.openApp('spreadsheet', { path });
    if (ext === 'snap') return this.openApp('tasks', { tab: 'systems', snapshot: path });
    if (['md'].includes(ext) && path.includes('操作说明')) return this.openApp('help', {});
    return this.openApp('editor', { path, ...opts });
  }
  bindDesk() {
    this.desk.addEventListener('mousedown', (e) => {
      if (e.target === this.desk || e.target === this.iconsEl || e.target === this.winLayer) {
        this.selIcon = null; this.iconsEl.querySelectorAll('.desk-icon.sel').forEach((x) => x.classList.remove('sel'));
        this.closeFlyouts();
        if (this.focused) this.setFocus(null);
      }
    });
    this.desk.addEventListener('contextmenu', (e) => {
      if (e.target !== this.desk && e.target !== this.iconsEl && e.target !== this.winLayer) return;
      e.preventDefault();
      this.contextMenu(e.clientX, e.clientY, [
        { label: '新建子系统', icon: 'system', action: () => this.newSystem(), tid: 'desktop-menu-system-new' },
        { label: '新建文件夹', icon: 'newfolder', action: () => { const n = this.fs.uniqueName('/Desktop', '新建文件夹'); this.fs.mkdir('/Desktop/' + n); } },
        { label: '新建文本文件', icon: 'newfile', action: () => { const n = this.fs.uniqueName('/Desktop', '新建文本.txt'); this.fs.write('/Desktop/' + n, ''); } },
        { sep: true },
        { label: '刷新', icon: 'reload', action: () => this.renderIcons() },
        { label: '个性化（壁纸与颜色）', icon: 'settings', action: () => this.openApp('settings') },
        { label: '任务管理器', icon: 'tasks', action: () => this.openApp('tasks') },
        { sep: true },
        { label: '操作说明', icon: 'help', action: () => this.openApp('help') },
      ]);
    });
    document.addEventListener('keydown', (e) => this.onKey(e), true);
    document.addEventListener('copy', () => {
      const t = String(window.getSelection() || '');
      if (t) this.recordClipboard({ type: 'text', text: t, source: '选中文本' });
    });
  }
  onKey(e) {
    if (e.key === 'Escape' && (this.menuEl || this.flyout)) { this.closeFlyouts(); e.preventDefault(); e.stopPropagation(); return; }
    const w = this.focused ? this.wins.get(this.focused) : null;
    if (w && (w.kind === 'system' || w.kind === 'proj' || w.kind === 'program')) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && !t.classList.contains('n-input')) return;
      if (t && t.classList && t.classList.contains('n-input')) return; // 设备输入框自行处理
      e.preventDefault(); e.stopPropagation();
      const ev = { type: 'key', key: e.key, code: e.code, mods: { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey } };
      this.forwardTo(w, ev);
    }
  }

  // ---------- 窗口 ----------
  openApp(appId, args = {}) {
    const def = APPS[appId];
    if (!def) return null;
    if (def.single) {
      const ex = [...this.wins.values()].find((w) => w.appId === appId);
      if (ex) { this.restoreWin(ex); this.focusWindow(ex.id); if (ex.app && ex.app.onArgs) ex.app.onArgs(args); return ex; }
    }
    const w = this.createWindow({ appId, title: def.name, icon: def.icon, w: def.w || 760, h: def.h || 520, kind: 'app', max: args.max });
    const ctx = { desktop: this, root: this.root, fs: this.fs, win: w, args, bridge: this.bridge, device: this.device };
    try { w.app = def.create(ctx); } catch (e) { console.error(e); this.notify({ title: '应用启动失败', body: String(e.message || e), level: 'error' }); this.destroyWin(w); return null; }
    w.content.append(w.app.el);
    w.proc = this.root.registerApp(def.name, appId, { kill: () => this.destroyWin(w, true) });
    w.proc.winId = w.id;
    if (w.app.onShown) w.app.onShown();
    this.emit('windows');
    return w;
  }
  createWindow({ appId, title, icon: ic, w = 720, h: hh = 480, x, y, kind = 'app', max, color, extraClass = '' }) {
    const id = `outer:w${this.winSeq++}`;
    const ww = Math.min(w, this.W - 20), hh2 = Math.min(hh, this.deskH - 20);
    this.cascade = (this.cascade + 1) % 8;
    const win = { id, appId, kind, title, icon: ic, x: x != null ? x : Math.max(0, Math.min(this.W - ww, 120 + this.cascade * 30)), y: y != null ? y : Math.max(0, Math.min(this.deskH - hh2, 40 + this.cascade * 26)), w: ww, h: hh2, state: 'normal', snap: null };
    const el = h('div', { class: `win anim-in ${extraClass}`, tid: 'app-window', 'data-window-id': id, 'data-app-id': appId, 'data-system-id': 'outer', role: 'dialog', 'aria-label': title });
    if (color) el.style.setProperty('--wc', color);
    const tIcon = h('span', { class: 'ticon', html: icon(ic) });
    const tText = h('span', { class: 'ttext', text: title });
    const tExtra = h('span', { class: 'textra', style: { display: 'flex', gap: '6px', alignItems: 'center' } });
    const btnMin = h('button', { class: 'tbtn', tid: 'window-minimize', 'data-window-id': id, 'data-system-id': 'outer', 'aria-label': '最小化', html: icon('min') });
    const btnMax = h('button', { class: 'tbtn', tid: 'window-maximize', 'data-window-id': id, 'data-system-id': 'outer', 'aria-label': '最大化', html: icon('max') });
    const btnClose = h('button', { class: 'tbtn close', tid: 'window-close', 'data-window-id': id, 'data-system-id': 'outer', 'aria-label': '关闭', html: icon('close') });
    const sysBtns = h('div', { class: 'tbtns sysbtns' });
    const bar = h('div', { class: 'titlebar', tid: 'window-titlebar', 'data-window-id': id, 'data-system-id': 'outer' }, tIcon, tExtra, tText, sysBtns, h('div', { class: 'tbtns' }, btnMin, btnMax, btnClose));
    const content = h('div', { class: 'wcontent' });
    el.append(bar, content);
    for (const dir of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      const r = h('div', { class: 'resize ' + dir, 'data-window-id': id, 'data-system-id': 'outer' });
      if (dir === 'se') r.setAttribute('data-testid', 'window-resize');
      r.addEventListener('mousedown', (e) => this.startResize(e, win, dir));
      el.append(r);
    }
    Object.assign(win, { el, bar, content, tText, tIcon, tExtra, sysBtns, btnMax });
    btnMin.addEventListener('click', (e) => { e.stopPropagation(); this.minimizeWin(win); });
    btnMax.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMax(win); });
    btnClose.addEventListener('click', (e) => { e.stopPropagation(); this.closeWin(win); });
    bar.addEventListener('mousedown', (e) => { if (e.target.closest('button,select,input')) return; this.startMove(e, win); });
    bar.addEventListener('dblclick', (e) => { if (e.target.closest('button,select,input')) return; this.toggleMax(win); });
    el.addEventListener('mousedown', () => { this.closeFlyouts(); this.focusWindow(id); }, true);
    this.wins.set(id, win); this.order.push(id);
    this.winLayer.append(el);
    this.applyGeom(win);
    if (max) this.toggleMax(win);
    this.focusWindow(id);
    this.renderTaskbar();
    return win;
  }
  applyGeom(w) {
    const el = w.el;
    el.classList.toggle('max', w.state === 'max');
    el.classList.toggle('min', w.state === 'min');
    el.classList.toggle('snapped', !!w.snap);
    let r;
    if (w.state === 'max') r = [0, 0, this.W, this.deskH];
    else if (w.snap === 'left') r = [0, 0, Math.floor(this.W / 2), this.deskH];
    else if (w.snap === 'right') r = [Math.floor(this.W / 2), 0, this.W - Math.floor(this.W / 2), this.deskH];
    else r = [w.x, w.y, w.w, w.h];
    Object.assign(el.style, { left: r[0] + 'px', top: r[1] + 'px', width: r[2] + 'px', height: r[3] + 'px' });
    w.btnMax.innerHTML = icon(w.state === 'max' ? 'restore' : 'max');
    w.btnMax.setAttribute('aria-label', w.state === 'max' ? '还原' : '最大化');
    if (w.app && w.app.onResize) requestAnimationFrame(() => w.app.onResize());
    if (w.onGeom) w.onGeom();
  }
  clampWin(w) {
    w.w = Math.min(w.w, this.W); w.h = Math.min(w.h, this.deskH);
    w.x = Math.max(-w.w + 120, Math.min(this.W - 120, w.x));
    w.y = Math.max(0, Math.min(this.deskH - 36, w.y));
  }
  focusWindow(id) {
    const w = this.wins.get(id);
    if (!w) return;
    if (w.state === 'min') { w.state = w.wasMax ? 'max' : 'normal'; this.applyGeom(w); }
    w.el.style.zIndex = String(++this.z);
    this.order = this.order.filter((x) => x !== id); this.order.push(id);
    this.setFocus(id);
  }
  setFocus(id) {
    if (this.focused === id) return;
    const old = this.focused ? this.wins.get(this.focused) : null;
    if (old) { old.el.classList.remove('focused'); if (old.kind === 'system') this.root.childInput(old.child, { type: 'focus', on: false }); if (old.app && old.app.onBlur) old.app.onBlur(); }
    this.focused = id;
    const w = id ? this.wins.get(id) : null;
    if (w) {
      w.el.classList.add('focused');
      if (w.kind === 'system') this.root.childInput(w.child, { type: 'focus', on: true });
      if (w.host && !w.el.contains(document.activeElement)) w.host.focus({ preventScroll: true });
      if (w.app && w.app.onFocus) w.app.onFocus();
    } else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    this.renderTaskbar();
  }
  topVisible() { for (let i = this.order.length - 1; i >= 0; i--) { const w = this.wins.get(this.order[i]); if (w && w.state !== 'min') return w; } return null; }
  minimizeWin(w) {
    if (w.state !== 'min') w.wasMax = w.state === 'max';
    w.state = 'min'; this.applyGeom(w);
    if (this.focused === w.id) { const t = this.topVisible(); this.setFocus(t ? t.id : null); }
    this.renderTaskbar();
    if (w.app && w.app.onMinimize) w.app.onMinimize(true);
  }
  restoreWin(w) {
    if (w.state === 'min') { w.state = w.wasMax ? 'max' : 'normal'; this.applyGeom(w); if (w.app && w.app.onMinimize) w.app.onMinimize(false); }
  }
  toggleMax(w) {
    if (w.state === 'max') { w.state = 'normal'; w.wasMax = false; } else { w.state = 'max'; w.snap = null; w.wasMax = true; }
    this.applyGeom(w); this.focusWindow(w.id);
  }
  async closeWin(w) {
    if (w.kind === 'system') {
      const n = this.root.subtreeIds(w.child).length - 1;
      const r = await this.confirm({ title: `关闭系统窗口 ${w.child}？`, body: `关闭将停止整个子树（${w.child}${n > 0 ? ` 及其 ${n} 个后代系统` : ''}），其中的全部程序都会结束。已保存的文件和快照会保留，可以从快照重新打开。`, ok: '停止并关闭', danger: true, icon: 'warning' });
      if (r !== 'ok') return;
      try { this.root.childControl('close', w.child); } catch (e) { this.notify({ title: '关闭失败', body: e.message, level: 'error' }); }
      return;
    }
    if (w.kind === 'proj') {
      this.root.send(w.srcPath, 'proj-closed', { 'src-win': w.srcWin, proj: w.id });
      this.destroyWin(w);
      return;
    }
    if (w.kind === 'program') { const p = this.root.procs.get(w.pid); if (p) this.root.deliver(0, p.pid, { k: 'close', wid: w.id }); setTimeout(() => { if (this.wins.has(w.id) && p) this.root.killProc(p, 'killed'); }, 1500); return; }
    if (w.app && w.app.onClose) { const ok = await w.app.onClose(); if (ok === false) return; }
    this.destroyWin(w);
  }
  destroyWin(w, fromKill) {
    if (!this.wins.has(w.id)) return;
    if (w.app && w.app.dispose) { try { w.app.dispose(); } catch (e) { console.error(e); } }
    w.el.remove();
    this.wins.delete(w.id); this.order = this.order.filter((x) => x !== w.id);
    if (w.proc && !fromKill) this.root.killProc(w.proc, 'app-closed');
    if (w.ro) w.ro.disconnect();
    if (this.focused === w.id) { this.focused = null; const t = this.topVisible(); if (t) this.focusWindow(t.id); }
    this.renderTaskbar();
    this.emit('windows');
  }
  startMove(e, w) {
    if (e.button !== 0) return;
    this.focusWindow(w.id);
    const z = this.zoom; const sx = e.clientX, sy = e.clientY;
    const startRect = w.state === 'max' || w.snap ? null : { x: w.x, y: w.y };
    let moved = false; let preview = null; let previewKind = null;
    const mm = (ev) => {
      const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!moved) {
        moved = true;
        if (!startRect) {
          // 从最大化/贴靠状态拖出时恢复原尺寸
          const px = ev.clientX / z;
          w.state = 'normal'; w.snap = null; w.wasMax = false;
          w.x = px - w.w / 2; w.y = 0;
          this.applyGeom(w);
        }
      }
      const base = startRect || { x: (sx / z) - w.w / 2, y: 0 };
      w.x = base.x + dx; w.y = base.y + dy;
      this.clampWin(w); this.applyGeom(w);
      const px = ev.clientX / z, py = ev.clientY / z;
      const k = px <= 3 ? 'left' : px >= this.W - 4 ? 'right' : py <= 2 ? 'max' : null;
      if (k !== previewKind) {
        previewKind = k;
        if (preview) { preview.remove(); preview = null; }
        if (k) {
          const r = k === 'left' ? [0, 0, this.W / 2, this.deskH] : k === 'right' ? [this.W / 2, 0, this.W / 2, this.deskH] : [0, 0, this.W, this.deskH];
          preview = h('div', { class: 'snap-preview', style: { left: r[0] + 6 + 'px', top: r[1] + 6 + 'px', width: r[2] - 12 + 'px', height: r[3] - 12 + 'px' } });
          this.desk.append(preview);
        }
      }
    };
    const mu = () => {
      window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true);
      if (preview) preview.remove();
      if (previewKind === 'max') { w.state = 'max'; w.wasMax = true; }
      else if (previewKind) w.snap = previewKind;
      this.applyGeom(w);
    };
    window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true);
  }
  startResize(e, w, dir) {
    if (e.button !== 0 || w.state === 'max' || w.snap) return;
    e.stopPropagation(); e.preventDefault();
    this.focusWindow(w.id);
    const z = this.zoom; const sx = e.clientX, sy = e.clientY; const o = { x: w.x, y: w.y, w: w.w, h: w.h };
    const mm = (ev) => {
      const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
      if (dir.includes('e')) w.w = Math.max(260, o.w + dx);
      if (dir.includes('s')) w.h = Math.max(160, o.h + dy);
      if (dir.includes('w')) { w.w = Math.max(260, o.w - dx); w.x = o.x + o.w - w.w; }
      if (dir.includes('n')) { w.h = Math.max(160, o.h - dy); w.y = Math.max(0, o.y + o.h - w.h); }
      this.applyGeom(w);
    };
    const mu = () => { window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); this.applyGeom(w); };
    window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true);
  }
  setTitle(w, t) { w.title = t; w.tText.textContent = t; w.el.setAttribute('aria-label', t); this.renderTaskbarSoon(); }

  // ---------- 任务栏 ----------
  buildTaskbar() {
    const tb = h('div', { class: 'taskbar', role: 'toolbar', 'aria-label': '任务栏' });
    this.startBtn = h('button', { class: 'tb-btn', tid: 'start-toggle', 'data-system-id': 'outer', 'aria-label': '开始', html: icon('start') });
    this.startBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleStart(); });
    this.pinsEl = h('div', { style: { display: 'flex', gap: '2px' } });
    this.runEl = h('div', { class: 'tb-running' });
    this.widgetsBtn = h('button', { class: 'tb-btn', tid: 'widgets-toggle', 'data-system-id': 'outer', 'aria-label': '小组件', html: icon('widgets') });
    this.widgetsBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleWidgets(); });
    this.dndEl = h('span', { class: 'tb-btn', title: '免打扰', html: icon('dnd'), style: { display: 'none', color: '#fbbf24' } });
    this.levelChip = h('span', { class: 'chip', text: 'L1 outer', style: { marginRight: '4px' } });
    this.notifBtn = h('button', { class: 'tb-btn', tid: 'notifications-toggle', 'data-system-id': 'outer', 'aria-label': '通知中心', html: icon('bell') });
    this.notifBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleNotifications(); });
    this.clockEl = h('div', { class: 'clock', title: '日期与时间' });
    this.clockEl.addEventListener('click', (e) => { e.stopPropagation(); this.openApp('widgets', { focus: 'calendar' }); });
    const tray = h('div', { class: 'tray' }, this.levelChip, this.dndEl, this.notifBtn, this.clockEl);
    tb.append(this.startBtn, this.pinsEl, h('div', { class: 'tb-sep' }), this.runEl, this.widgetsBtn, h('div', { class: 'tb-sep' }), tray);
    tb.addEventListener('mousedown', (e) => e.stopPropagation());
    return tb;
  }
  renderTaskbarSoon() { if (this._rtb) return; this._rtb = requestAnimationFrame(() => { this._rtb = null; this.renderTaskbar(); }); }
  renderTaskbar() {
    if (!this.pinsEl) return;
    clear(this.pinsEl);
    for (const id of ['files', 'spreadsheet', 'browser', 'editor', 'tasks']) {
      const running = [...this.wins.values()].some((w) => w.appId === id);
      const b = h('button', { class: 'tb-btn', tid: 'pin-' + id, 'data-system-id': 'outer', 'aria-label': APPS[id].name, title: APPS[id].name, html: icon(APPS[id].icon) });
      if (running) b.append(h('span', { class: 'dot' }));
      b.addEventListener('click', () => {
        const ws = [...this.wins.values()].filter((w) => w.appId === id);
        if (ws.length) this.taskClick(ws[ws.length - 1]); else this.openApp(id);
      });
      this.pinsEl.append(b);
    }
    clear(this.runEl);
    for (const id of this.order.slice().sort((a, b) => this.wins.get(a).seqNo - this.wins.get(b).seqNo || 0)) {
      const w = this.wins.get(id);
      const item = h('button', { class: 'tb-item' + (this.focused === id && w.state !== 'min' ? ' active' : '') + (w.state === 'min' ? ' min' : ''), tid: 'taskbar-item', 'data-window-id': id, 'data-system-id': 'outer', 'aria-label': w.title, title: w.title, html: icon(w.icon) });
      if (w.kind === 'system' || w.kind === 'proj') item.style.boxShadow = `inset 0 0 0 1px ${w.color}55`;
      item.append(h('span', { text: w.title }));
      item.addEventListener('click', () => this.taskClick(w));
      this.runEl.append(item);
    }
    this.notifBtn.querySelector('.badge')?.remove();
    const unread = this.notifications.filter((n) => !n.read).length;
    if (unread) this.notifBtn.append(h('span', { class: 'badge', text: String(Math.min(99, unread)) }));
    this.dndEl.style.display = this.settings.dnd ? '' : 'none';
    this.levelChip.textContent = `L1 outer · ${this.settings.name}`;
  }
  taskClick(w) {
    if (w.state === 'min') { this.restoreWin(w); this.focusWindow(w.id); }
    else if (this.focused === w.id) this.minimizeWin(w);
    else this.focusWindow(w.id);
    this.renderTaskbar();
  }
  tickClock() {
    const d = new Date();
    const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const ds = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    if (this.clockEl) { this.clockEl.innerHTML = ''; this.clockEl.append(h('span', { text: t }), h('small', { text: ds })); }
    this.emit('clock', d);
  }

  // ---------- 开始菜单 / 弹出面板 ----------
  closeFlyouts() {
    if (this.flyout) { this.flyout.remove(); this.flyout = null; this.flyoutKind = null; }
    if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; }
  }
  showFlyout(kind, el) { this.closeFlyouts(); this.flyout = el; this.flyoutKind = kind; el.addEventListener('mousedown', (e) => e.stopPropagation()); this.desk.append(el); }
  toggleStart() {
    if (this.flyoutKind === 'start') return this.closeFlyouts();
    const grid = h('div', { class: 'start-grid' });
    const search = h('input', { class: 'start-search', placeholder: '搜索应用、文件…', 'aria-label': '搜索', tid: 'start-search', 'data-system-id': 'outer' });
    const results = h('div', { class: 'start-results' });
    const order = ['files', 'spreadsheet', 'browser', 'editor', 'tasks', 'widgets', 'settings', 'help'];
    const fill = () => {
      clear(grid); clear(results);
      const q = search.value.trim().toLowerCase();
      for (const id of order) {
        const a = APPS[id];
        if (q && !a.name.toLowerCase().includes(q) && !id.includes(q) && !(a.keywords || '').includes(q)) continue;
        const b = h('button', { class: 'start-app', tid: 'launch-' + id, 'data-system-id': 'outer', 'aria-label': a.name, html: icon(a.icon) }, h('span', { text: a.name }));
        b.addEventListener('click', () => { this.closeFlyouts(); this.openApp(id); });
        grid.append(b);
      }
      if (q) {
        let n = 0;
        for (const [p, e] of this.fs.files) {
          if (n >= 6 || e.type !== 'file' || p.startsWith('/System/') || !p.split('/').pop().toLowerCase().includes(q)) continue;
          n++;
          const r = h('div', { class: 'mi', style: { display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 8px', borderRadius: '8px', cursor: 'default' }, html: icon(fileIcon({ path: p, type: 'file' })) }, h('span', { text: p }));
          r.querySelector('svg').style.width = '18px';
          r.addEventListener('click', () => { this.closeFlyouts(); this.openFile(p); });
          r.addEventListener('mouseenter', () => { r.style.background = 'rgba(255,255,255,.08)'; });
          r.addEventListener('mouseleave', () => { r.style.background = ''; });
          results.append(r);
        }
      }
    };
    search.addEventListener('input', fill);
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = grid.querySelector('button'); if (b) b.click(); } });
    fill();
    const sysNew = h('button', { class: 'btn primary', tid: 'start-system-new', 'data-system-id': 'outer', html: icon('system') }, '新建子系统');
    sysNew.addEventListener('click', () => { this.closeFlyouts(); this.newSystem(); });
    const helpBtn = h('button', { class: 'btn', html: icon('help') }, '操作说明');
    helpBtn.addEventListener('click', () => { this.closeFlyouts(); this.openApp('help'); });
    const menu = h('div', { class: 'flyout start-menu', tid: 'start-menu', 'data-system-id': 'outer', role: 'menu', 'aria-label': '开始菜单' },
      search, h('div', { class: 'start-section' }, h('span', { text: '应用' }), h('span', { text: `${this.settings.name} · 第 1 层桌面` })), grid, results,
      h('div', { class: 'start-section' }, h('span', { text: '嵌套系统' })),
      h('div', { class: 'start-actions' }, sysNew, helpBtn));
    this.showFlyout('start', menu);
    setTimeout(() => search.focus(), 30);
  }
  toggleWidgets() {
    const ex = [...this.wins.values()].find((w) => w.appId === 'widgets');
    if (ex && this.focused === ex.id && ex.state !== 'min') { this.minimizeWin(ex); return; }
    this.openApp('widgets');
  }
  toggleNotifications() {
    if (this.flyoutKind === 'notif') return this.closeFlyouts();
    const list = h('div', { class: 'notif-list' });
    const fill = () => {
      clear(list);
      if (!this.notifications.length) list.append(h('div', { class: 'muted', style: { padding: '20px', textAlign: 'center' }, text: '暂无通知' }));
      for (const n of this.notifications) {
        list.append(h('div', { class: 'notif-item', tid: 'notification-item', html: icon(n.level === 'error' ? 'error' : n.level === 'ok' ? 'ok' : n.source === 'timer' ? 'timer' : 'info') },
          h('div', { style: { flex: '1', minWidth: 0 } }, h('b', { text: n.title }), h('p', { text: n.body || '' }), h('time', { text: new Date(n.time).toLocaleTimeString() }))));
        n.read = true;
      }
    };
    fill();
    const dnd = h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' } }, h('input', { type: 'checkbox', checked: this.settings.dnd, tid: 'notifications-dnd', onchange: (e) => this.setSetting('dnd', e.target.checked) }), '免打扰');
    const clr = h('button', { class: 'btn', text: '全部清除', tid: 'notifications-clear' });
    clr.addEventListener('click', () => { this.notifications = []; fill(); this.renderTaskbar(); this.emit('notifications'); });
    const panel = h('div', { class: 'flyout notif-panel', tid: 'notification-center', 'data-system-id': 'outer', 'aria-label': '通知中心' },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, h('b', { text: '通知中心', style: { fontSize: '14px', flex: '1' } }), dnd, clr), list);
    this.showFlyout('notif', panel);
    this.renderTaskbar();
    this.emit('notifications');
  }
  contextMenu(x, y, items) {
    this.closeFlyouts();
    const z = this.zoom;
    const m = h('div', { class: 'menu', role: 'menu', tid: 'context-menu', 'data-system-id': 'outer' });
    for (const it of items) {
      if (!it) continue;
      if (it.sep) { m.append(h('div', { class: 'sep' })); continue; }
      const row = h('div', { class: 'mi' + (it.disabled ? ' disabled' : ''), role: 'menuitem', tid: it.tid || null, 'aria-label': it.label, html: it.icon ? icon(it.icon) : '' }, h('span', { text: it.label }), it.kbd ? h('span', { class: 'kbd', text: it.kbd }) : null);
      row.addEventListener('click', (e) => { e.stopPropagation(); this.closeFlyouts(); it.action && it.action(); });
      m.append(row);
    }
    m.addEventListener('mousedown', (e) => e.stopPropagation());
    this.desk.append(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x / z, this.W - r.width / z - 4) + 'px';
    m.style.top = Math.min(y / z, this.H - r.height / z - 4) + 'px';
    this.menuEl = m;
  }
  confirm({ title, body, ok = '确定', cancel = '取消', extra, danger, icon: ic = 'info' }) {
    return new Promise((resolve) => {
      const done = (v) => { mask.remove(); resolve(v); };
      const row = h('div', { class: 'row' });
      if (extra) { const b = h('button', { class: 'btn', text: extra, tid: 'dialog-extra' }); b.onclick = () => done('extra'); row.append(b); }
      const okb = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), text: ok, tid: 'dialog-confirm' }); okb.onclick = () => done('ok');
      const cb = h('button', { class: 'btn', text: cancel, tid: 'dialog-cancel' }); cb.onclick = () => done('cancel');
      row.append(okb, cb);
      const mask = h('div', { class: 'dialog-mask', tid: 'dialog', 'data-system-id': 'outer' }, h('div', { class: 'dialog', role: 'alertdialog', 'aria-label': title }, h('h3', { html: icon(ic) }, title), h('p', { text: body }), row));
      mask.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') done('cancel'); if (e.key === 'Enter') done('ok'); });
      this.desk.append(mask);
      setTimeout(() => okb.focus(), 20);
    });
  }
  prompt(title, value = '') {
    return new Promise((resolve) => {
      const inp = h('input', { class: 'inp', value, tid: 'dialog-input' });
      const done = (v) => { mask.remove(); resolve(v); };
      const okb = h('button', { class: 'btn primary', text: '确定', tid: 'dialog-confirm' }); okb.onclick = () => done(inp.value.trim());
      const cb = h('button', { class: 'btn', text: '取消', tid: 'dialog-cancel' }); cb.onclick = () => done(null);
      const mask = h('div', { class: 'dialog-mask', tid: 'dialog' }, h('div', { class: 'dialog' }, h('h3', { text: title }), inp, h('div', { class: 'row' }, okb, cb)));
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(inp.value.trim()); if (e.key === 'Escape') done(null); });
      this.desk.append(mask);
      setTimeout(() => { inp.focus(); inp.select(); }, 20);
    });
  }

  // ---------- 通知与剪贴板 ----------
  notify(n) {
    const item = { title: n.title, body: n.body || '', level: n.level || 'info', source: n.source || 'system', time: Date.now(), read: false };
    this.notifications.unshift(item);
    if (this.notifications.length > 100) this.notifications.pop();
    this.renderTaskbar();
    this.emit('notifications');
    if (this.settings.dnd && item.level !== 'error') return;
    const t = h('div', { class: 'toast ' + item.level, tid: 'toast', html: icon(item.level === 'error' ? 'error' : item.level === 'ok' ? 'ok' : item.source === 'timer' ? 'timer' : 'info') }, h('div', { style: { minWidth: 0 } }, h('b', { text: item.title }), h('p', { text: item.body })));
    this.toastsEl.append(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 4200);
    while (this.toastsEl.children.length > 4) this.toastsEl.firstChild.remove();
  }
  recordClipboard(entry) {
    const last = this.clipboard[0];
    if (last && last.text === entry.text) return;
    this.clipboard.unshift({ ...entry, time: Date.now() });
    if (this.clipboard.length > 30) this.clipboard.pop();
    this.emit('clipboard');
  }
  async writeClipboard(text, entry) {
    try { await navigator.clipboard.writeText(text); } catch {}
    this.recordClipboard({ type: 'text', text, ...(entry || {}) });
  }

  // ---------- 子系统 ----------
  newSystem() {
    try {
      const id = this.root.createChild(null, null);
      this.notify({ title: '已创建子系统', body: `${id}（第 2 层桌面）正在启动`, level: 'ok' });
      return id;
    } catch (e) { this.notify({ title: '创建子系统失败', body: e.message, level: 'error' }); return null; }
  }
  sysWin(id) { return [...this.wins.values()].find((w) => w.kind === 'system' && w.child === id); }
  openSystemWindow(id) {
    let w = this.sysWin(id);
    if (w) { this.restoreWin(w); this.focusWindow(w.id); return w; }
    const c = this.root.children.get(id);
    const ww = Math.floor(this.W * 0.76), hh = Math.floor(this.deskH * 0.92);
    w = this.createWindow({ appId: 'system', title: `${id} · ${c ? c.name : ''}`, icon: 'system', w: ww, h: hh, x: this.W - ww - 12, y: 8, kind: 'system', color: levelColor(2), extraClass: 'syswin' });
    w.child = id; w.color = levelColor(2);
    w.el.dataset.systemTarget = id;
    w.el.setAttribute('data-target-system-id', id);
    const host = h('div', { class: 'sys-host', tabindex: '-1', 'aria-label': `${id} 桌面` });
    const boot = h('div', { class: 'sys-boot', text: `${id} 正在启动内核…` });
    host.append(boot);
    const surf = this.device.surfaceEl(`${id}:desktop`);
    host.append(surf);
    w.host = host; w.bootEl = boot;
    w.content.append(host);
    this.bindForward(w, host);
    w.ro = new ResizeObserver(() => { this.root.childResize(id, Math.floor(host.clientWidth), Math.floor(host.clientHeight)); });
    w.ro.observe(host);
    w.proc = null;
    this.refreshSystemWindow(id);
    this.root.childResize(id, Math.floor(host.clientWidth), Math.floor(host.clientHeight));
    this.emit('windows');
    return w;
  }
  closeSystemWindow(id) { const w = this.sysWin(id); if (w) this.destroyWin(w); }
  refreshSystemWindows() { for (const w of this.wins.values()) if (w.kind === 'system') this.refreshSystemWindow(w.child); }
  refreshSystemWindow(id) {
    const w = this.sysWin(id);
    const c = this.root.children.get(id);
    if (!w || !c) return;
    const st = c.state;
    clear(w.tExtra);
    w.tExtra.append(h('span', { class: 'chip', style: { '--c': levelColor(2) }, text: 'L2' }), h('span', { class: 'chip', style: { '--c': STATE_COLOR[st] || '#9aa6bd' }, text: STATE_TEXT[st] || st, tid: 'system-state', 'data-target-system-id': id }));
    this.setTitle(w, `${id} · ${c.name}`);
    clear(w.sysBtns);
    const mk = (tid, ic, label, fn, dis) => {
      const b = h('button', { class: 'tbtn sys', tid, 'data-system-id': 'outer', 'data-window-id': w.id, 'data-target-system-id': id, 'aria-label': label, title: label, html: icon(ic) });
      if (dis) b.disabled = true;
      b.addEventListener('click', (e) => { e.stopPropagation(); try { fn(); } catch (er) { this.notify({ title: label + '失败', body: er.message, level: 'error' }); } });
      w.sysBtns.append(b);
    };
    const alive = st === 'running' || st === 'paused' || st === 'booting';
    if (st === 'paused') mk('system-resume', 'play', '继续', () => this.root.childControl('resume', id));
    else mk('system-pause', 'pause', '暂停', () => this.root.childControl('pause', id), !alive);
    mk('system-step', 'step', '单步（1/60 秒）', () => this.root.childControl('step', id), st !== 'paused');
    const rate = h('select', { class: 'inp', tid: 'system-rate', 'data-target-system-id': id, 'data-window-id': w.id, 'aria-label': '时间速率', style: { height: '24px', width: '64px', margin: '5px 2px', fontSize: '11px' } },
      [0.25, 0.5, 1, 2, 4].map((r) => h('option', { value: String(r), text: r + '×' })));
    rate.value = String(c.rate);
    rate.addEventListener('change', () => this.root.childControl('rate', id, Number(rate.value)));
    rate.addEventListener('mousedown', (e) => e.stopPropagation());
    w.sysBtns.append(rate);
    mk('system-snapshot', 'camera', '快照', () => this.root.childControl('snapshot', id), !alive);
    mk('kernel-open', 'kernel', '在编辑器中打开内核源文件', () => this.openApp('editor', { path: c.kernel }));
    mk('system-restart', 'restart', '重启（重新载入内核源文件）', () => this.root.childControl('restart', id));
    // 状态覆盖层
    w.host.querySelector('.sys-error')?.remove();
    w.host.querySelector('.sys-overlay')?.remove();
    if (w.bootEl) w.bootEl.style.display = st === 'booting' ? '' : 'none';
    if (st === 'kernel-error' || st === 'stopped') {
      const btn = h('button', { class: 'btn primary', html: icon('restart'), tid: 'kernel-error-restart', 'data-target-system-id': id }, '重新启动');
      btn.addEventListener('click', () => this.root.childControl('restart', id));
      const ob = h('button', { class: 'btn', html: icon('kernel') }, '打开内核源文件');
      ob.addEventListener('click', () => this.openApp('editor', { path: c.kernel }));
      w.host.append(h('div', { class: 'sys-error', tid: st === 'kernel-error' ? 'kernel-error' : 'system-stopped', 'data-target-system-id': id, 'data-system-id': 'outer' },
        h('div', { html: icon(st === 'kernel-error' ? 'error' : 'stop'), style: { width: '44px', height: '44px' } }),
        h('b', { text: st === 'kernel-error' ? `${id} 内核错误，子系统已停止` : `${id} 已停止`, style: { fontSize: '16px' } }),
        h('pre', { text: c.error || '' }),
        h('div', { class: 'muted', text: st === 'kernel-error' ? `内核源文件：${c.kernel}。父系统与兄弟系统照常运行；改回内核后可以重新启动。` : '承载进程已结束，整棵子树已停止。' }),
        h('div', { style: { display: 'flex', gap: '8px' } }, btn, ob)));
    } else if (st === 'paused') {
      w.host.append(h('div', { class: 'sys-overlay' }, h('span', { class: 'chip', style: { '--c': '#fbbf24', background: 'rgba(0,0,0,.7)' }, text: '⏸ 子树已暂停 · 可单步' })));
    }
    w.el.classList.toggle('sys-paused', st === 'paused');
  }

  // 输入转发（系统窗口 / 投送窗口 / 程序窗口）
  localXY(w, e) { const r = w.host.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / this.zoom), Math.round((e.clientY - r.top) / this.zoom)]; }
  mods(e) { return { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey }; }
  forwardTo(w, ev) {
    if (w.kind === 'system') this.root.childInput(w.child, ev);
    else if (w.kind === 'proj') {
      if (this.root.chainPaused(w.srcSys)) return;
      this.root.send(w.srcPath, 'proj-input', { 'src-win': w.srcWin, proj: w.id, ev });
    } else if (w.kind === 'program') this.root.deliver(0, w.pid, { k: ev.type === 'key' ? 'key' : 'input', wid: w.id, ev });
  }
  bindForward(w, host) {
    let lastMove = 0;
    host.addEventListener('mousedown', (e) => {
      if (e.target.closest('.sys-error')) return;
      this.closeFlyouts();
      this.focusWindow(w.id);
      if (!(e.target.classList && e.target.classList.contains('n-input'))) { e.preventDefault(); host.focus({ preventScroll: true }); }
      this.device.pointerFocus = true; setTimeout(() => { this.device.pointerFocus = false; }, 0);
      const [x, y] = this.localXY(w, e);
      this.forwardTo(w, { type: 'down', x, y, button: e.button, detail: e.detail, mods: this.mods(e) });
      const mm = (ev) => {
        const now = performance.now();
        if (now - lastMove < 12) return;
        lastMove = now;
        const [mx, my] = this.localXY(w, ev);
        this.forwardTo(w, { type: 'move', x: mx, y: my, buttons: ev.buttons });
      };
      const mu = (ev) => {
        window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true);
        const [ux, uy] = this.localXY(w, ev);
        this.forwardTo(w, { type: 'up', x: ux, y: uy, button: ev.button });
      };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true);
    });
    host.addEventListener('mousemove', (e) => {
      if (e.buttons) return;
      const now = performance.now();
      if (now - lastMove < 30) return;
      lastMove = now;
      const [x, y] = this.localXY(w, e);
      this.forwardTo(w, { type: 'move', x, y, buttons: 0 });
    });
    host.addEventListener('mouseleave', () => this.forwardTo(w, { type: 'leave' }));
    host.addEventListener('wheel', (e) => {
      if (e.target.closest && e.target.closest('textarea.n-input')) return;
      e.preventDefault();
      const [x, y] = this.localXY(w, e);
      this.forwardTo(w, { type: 'wheel', x, y, dx: e.deltaX, dy: e.deltaY });
    }, { passive: false });
    host.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // 自动化工具的合成点击：按坐标转成指针事件
  syntheticPointer(cx, cy, el, isFocus) {
    for (let i = this.order.length - 1; i >= 0; i--) {
      const w = this.wins.get(this.order[i]);
      if (!w || !w.host || w.state === 'min') continue;
      const r = w.host.getBoundingClientRect();
      if (cx >= r.left && cx < r.right && cy >= r.top && cy < r.bottom) {
        this.focusWindow(w.id);
        const x = Math.round((cx - r.left) / this.zoom), y = Math.round((cy - r.top) / this.zoom);
        this.forwardTo(w, { type: 'down', x, y, button: 0, detail: 1, mods: {} });
        this.forwardTo(w, { type: 'up', x, y, button: 0 });
        return;
      }
    }
  }
  routeDeviceInput(sid, ev) {
    const sys = sysOfSid(sid);
    if (sid.includes('@proj')) {
      const s = this.device.surfaces.get(sid);
      const ctx = s && s.ctx;
      if (ctx && ctx.systemId === 'outer') { const w = this.wins.get(ctx.windowId); if (w) this.forwardTo(w, { ...ev, sid }); }
      else if (ctx) { const path = this.root.pathOf(ctx.systemId); if (path.length > 1) this.root.childInput(path[1], { ...ev, sid, route: path.slice(2) }); }
      return;
    }
    if (sys === 'outer') { const w = this.wins.get(sid); if (w && w.kind === 'program') this.root.deliver(0, w.pid, { k: ev.type === 'key' ? 'key' : 'text', wid: sid, ev: { ...ev, sid } }); return; }
    const path = this.root.pathOf(sys);
    if (path.length > 1) this.root.childInput(path[1], { ...ev, sid, route: path.slice(2) });
  }

  // ---------- 程序窗口（根系统自定义程序） ----------
  openProgramWindow({ wid, pid, title, w, h: hh }) {
    const win = this.createWindow({ appId: 'program', title, icon: 'program', w: w + 2, h: hh + 37, kind: 'program' });
    this.wins.delete(win.id); this.order = this.order.filter((x) => x !== win.id);
    win.id = wid; win.el.dataset.windowId = wid;
    win.el.querySelectorAll('[data-window-id]').forEach((x) => { x.dataset.windowId = wid; });
    this.wins.set(wid, win); this.order.push(wid);
    win.pid = pid;
    const host = h('div', { class: 'sys-host', tabindex: '-1' });
    host.append(this.device.surfaceEl(wid));
    win.host = host; win.content.append(host);
    this.bindForward(win, host);
    win.ro = new ResizeObserver(() => this.root.deliver(0, pid, { k: 'resize', wid, w: Math.floor(host.clientWidth), h: Math.floor(host.clientHeight) }));
    win.ro.observe(host);
    this.focusWindow(wid);
    return win;
  }
  closeProgramWindow(wid) { const w = this.wins.get(wid); if (w) this.destroyWin(w); }
  setProgramTitle(wid, t) { const w = this.wins.get(wid); if (w) this.setTitle(w, t); }

  // ---------- 投送窗口（本桌面作为目标） ----------
  openProjection({ srcPath, srcSys, srcWin, srcApp, title, w, h: hh }) {
    const ex = [...this.wins.values()].find((x) => x.kind === 'proj' && x.srcWin === srcWin);
    if (ex) { this.focusWindow(ex.id); return { wid: ex.id, w: ex.host.clientWidth, h: ex.host.clientHeight }; }
    const depth = srcPath.length;
    const win = this.createWindow({ appId: 'projection', title: `投送 · ${title}`, icon: 'projection', w: (w || 640) + 2, h: (hh || 420) + 37, kind: 'proj', color: levelColor(depth), extraClass: 'projwin' });
    Object.assign(win, { srcPath, srcSys, srcWin, srcApp, color: levelColor(depth) });
    win.el.setAttribute('data-source-system-id', srcSys);
    win.el.setAttribute('data-source-window-id', srcWin);
    win.el.setAttribute('data-source-app-id', srcApp);
    win.tExtra.append(h('span', { class: 'chip', style: { '--c': levelColor(depth) }, text: `来自 L${depth} ${srcSys}` }));
    const host = h('div', { class: 'sys-host', tabindex: '-1' });
    const sid = `${srcWin}@proj`;
    host.append(this.device.surfaceEl(sid));
    this.device.setContext(sid, { systemId: 'outer', windowId: win.id, source: { 'source-system-id': srcSys, 'source-window-id': srcWin, 'source-app-id': srcApp } });
    win.host = host; win.content.append(host);
    this.bindForward(win, host);
    let lastSize = '';
    win.ro = new ResizeObserver(() => {
      const s = `${Math.floor(host.clientWidth)}x${Math.floor(host.clientHeight)}`;
      if (s === lastSize) return; lastSize = s;
      this.root.send(win.srcPath, 'proj-resize', { 'src-win': srcWin, proj: win.id, w: Math.floor(host.clientWidth), h: Math.floor(host.clientHeight) });
    });
    win.ro.observe(host);
    this.device.refreshOverlays();
    this.emit('windows');
    return { wid: win.id, w: Math.floor(host.clientWidth) || w, h: Math.floor(host.clientHeight) || hh };
  }
  endProjection(wid, reason) {
    const w = this.wins.get(wid);
    if (!w || w.kind !== 'proj') return;
    this.destroyWin(w);
    this.device.drop(`${w.srcWin}@proj`);
    this.notify({ title: '投送已结束', body: `${w.srcSys} 的${w.srcApp === 'player' ? '播放器' : w.srcApp === 'charts' ? '图表' : '窗口'}：${reason}`, level: 'info' });
  }
  setProjectionTitle(wid, t) { const w = this.wins.get(wid); if (w) this.setTitle(w, '投送 · ' + t); }
  projectionsFrom(ids) { return [...this.wins.values()].filter((w) => w.kind === 'proj' && ids.has(w.srcSys)).map((w) => ({ wid: w.id, srcPath: w.srcPath, srcWin: w.srcWin, w: Math.floor(w.host.clientWidth), h: Math.floor(w.host.clientHeight) })); }
  sourcesGone(ids, reason) {
    for (const w of [...this.wins.values()]) if (w.kind === 'proj' && ids.has(w.srcSys)) this.endProjection(w.id, reason);
  }

  // ---------- 跨层文件拖放 ----------
  maybeFileDrag(e, payload) {
    const sx = e.clientX, sy = e.clientY;
    const mm = (ev) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 6) return;
      cleanup();
      this.beginDrag(payload, ev);
    };
    const cleanup = () => { window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', cleanup, true); };
    window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', cleanup, true);
  }
  beginDrag(payload, ev) {
    if (this.drag) this.endDrag();
    const ghost = h('div', { class: 'drag-ghost', html: icon(fileIcon({ path: payload.path, type: payload.type || 'file' })) }, h('span', { text: payload.name }), h('span', { class: 'tgt', text: '' }));
    this.desk.append(ghost);
    this.drag = { payload, ghost, tgtEl: ghost.querySelector('.tgt'), lastSent: 0, target: null };
    const mm = (e) => this.dragMove(e);
    const mu = (e) => { window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); this.dragDrop(e); };
    window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true);
    this.drag.cleanup = () => { window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); };
    if (ev) this.dragMove(ev);
  }
  dragTargetAt(cx, cy) {
    const el = document.elementFromPoint(cx, cy);
    if (!el) return null;
    const winEl = el.closest('.win');
    if (!winEl) return { kind: 'desktop' };
    const w = this.wins.get(winEl.dataset.windowId);
    if (!w) return null;
    if (w.kind === 'system' && w.host && w.host.contains(el)) return { kind: 'system', w };
    if (w.appId === 'files' && w.app && w.app.dropTarget) return { kind: 'files', w, info: w.app.dropTarget(el) };
    return { kind: 'none', w };
  }
  dragMove(e) {
    const d = this.drag;
    if (!d) return;
    d.ghost.style.left = (e.clientX / this.zoom + 14) + 'px';
    d.ghost.style.top = (e.clientY / this.zoom + 12) + 'px';
    const t = this.dragTargetAt(e.clientX, e.clientY);
    d.target = t;
    let label = '', ok = true;
    if (!t || t.kind === 'none') { label = '此处不能投放'; ok = false; }
    else if (t.kind === 'desktop') label = '→ 根系统 · /Desktop';
    else if (t.kind === 'files') label = '→ 根系统 · ' + (t.info ? t.info.dir : '');
    else if (t.kind === 'system') {
      const now = performance.now();
      if (now - d.lastSent > 120) {
        d.lastSent = now;
        const [x, y] = this.localXY(t.w, e);
        this.root.childInput(t.w.child, { type: 'dragover', x, y, payload: this.dragPayload() });
      }
      label = d.remote && d.remoteAt > performance.now() - 600 ? '→ ' + d.remote.label : `→ ${t.w.child} …`;
      ok = d.remote ? d.remote.ok !== false : true;
    }
    d.tgtEl.textContent = label;
    d.tgtEl.classList.toggle('bad', !ok);
  }
  dragPayload() { const p = this.drag.payload; return { src: p.src, path: p.path, name: p.name, srcSys: p.srcSys || p.src[p.src.length - 1], size: p.size || 0 }; }
  dropTargetInfo(from, d) { if (this.drag) { this.drag.remote = d; this.drag.remoteAt = performance.now(); this.dragMove({ clientX: this._lastX || 0, clientY: this._lastY || 0 }); } }
  async dragDrop(e) {
    const d = this.drag;
    if (!d) return;
    const t = this.dragTargetAt(e.clientX, e.clientY);
    this.endDrag();
    if (!t || t.kind === 'none') return;
    const p = d.payload;
    if (t.kind === 'system') {
      const [x, y] = this.localXY(t.w, e);
      this.root.childInput(t.w.child, { type: 'drop', x, y, payload: { src: p.src, path: p.path, name: p.name, srcSys: p.srcSys } });
      return;
    }
    const dir = t.kind === 'desktop' ? '/Desktop' : t.info && t.info.dir;
    if (!dir) return;
    if (p.src.length === 1 && p.src[0] === 'outer') {
      if (this.fs.norm(this.fs.dirname(p.path)) === this.fs.norm(dir)) return;
      if (t.kind === 'files' && t.w.app.moveInto) return t.w.app.moveInto([p.path], dir);
      try { this.fs.rename(p.path, this.fs.join(dir, this.fs.uniqueName(dir, p.name))); } catch (er) { this.notify({ title: '移动失败', body: er.message, level: 'error' }); }
      return;
    }
    // 从子系统取回文件：经各层系统接口传递，得到独立副本
    this.root.pullFile(p.src, p.path, (r) => this.receiveFile(dir, r, p));
  }
  async receiveFile(dir, r, p) {
    if (r.error || r.content == null) { this.notify({ title: '文件传递失败', body: r.error || '源文件不可读', level: 'error' }); return; }
    let name = r.name || p.name;
    let target = this.fs.join(dir, name);
    if (this.fs.exists(target)) {
      const a = await this.confirm({ title: '目标已有同名文件', body: `${target} 已存在。覆盖它，还是保留两者？`, ok: '覆盖', extra: '保留两者', cancel: '取消', icon: 'warning' });
      if (a === 'cancel') return;
      if (a === 'extra') { name = this.fs.uniqueName(dir, name); target = this.fs.join(dir, name); }
      else { try { this.fs.delete(target); } catch {} }
    }
    try {
      this.fs.write(target, r.content);
      this.notify({ title: '已接收文件', body: `${p.srcSys}:${p.path} → 根系统 ${target}`, level: 'ok', source: 'files' });
    } catch (er) { this.notify({ title: '文件传递失败', body: er.message, level: 'error' }); }
  }
  endDrag() { if (!this.drag) return; this.drag.ghost.remove(); if (this.drag.cleanup) this.drag.cleanup(); this.drag = null; }
  foreignDragBegin(from, d) {
    // 子系统文件管理器开始拖动：由根桌面显示拖动目标并在松开时投放
    this.beginDrag({ src: from, path: d.path, name: d.name, srcSys: from[from.length - 1], type: d.type, size: d.size }, null);
    const track = (e) => { this._lastX = e.clientX; this._lastY = e.clientY; };
    window.addEventListener('mousemove', track, true);
    const prev = this.drag.cleanup;
    this.drag.cleanup = () => { prev(); window.removeEventListener('mousemove', track, true); };
  }
}
