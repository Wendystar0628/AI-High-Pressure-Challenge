/* ============================================================================
 * 界面框架：递归桌面、窗口管理（拖动/缩放/贴靠/最小化/最大化/焦点/遮挡）、
 * 任务栏/开始菜单/托盘/通知中心、右键菜单、对话框、事件委托、系统管理应用。
 * 窗口/桌面状态是运行时纯数据；DOM 为持久结构（webview/画布不会被反复重建）。
 * ========================================================================== */
(function (OS) {
  'use strict';
  const rt = OS.rt, U = OS.util, esc = U.escapeHtml;
  const ui = {};
  ui.apps = {}; ui.actions = {};
  ui.winEls = {}; ui.desktops = {};
  ui.menuOpen = {}; ui.notifOpen = {}; ui.startSearch = {};
  ui.context = null; ui.dialog = null; ui.toastMsg = null; ui.toastT = 0;
  ui.drag = null; ui.selIcon = {}; ui.clipboard = null; ui.dragFile = null;
  ui.selFile = {}; ui.sheetSel = {};

  // ---------------------------------------------------------------- 图标（自制 SVG）
  const ICONS = {
    files: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9h18"/>',
    spreadsheet: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16M15 4v16M3 14h18"/>',
    widgets: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    editor: '<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"/><path d="M8 3v5h8M8 13l3 3-3 3M13 13h5"/>',
    tasks: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.6 3H9.4l-.3 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.6h5.2l.3-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/>',
    browser: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    player: '<path d="M8 5v14l11-7z"/>',
    charts: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    system: '<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M8 8h9v9a2 2 0 0 1-2 2H8z"/>',
    projection: '<rect x="2" y="4" width="14" height="12" rx="2"/><path d="M16 8h4l2 3v3h-6z"/><path d="M8 20h8"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4"/>',
    program: '<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"/><path d="M9 12l2 2-2 2M13 16h4"/>',
    scene: '<path d="M12 3l9 5v8l-9 5-9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    sheet: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16M7 12h2M7 16h2M13 12h4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    note: '<path d="M5 3h14v18l-4-3H5z"/><path d="M9 8h6M9 12h6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 9h6M9 13h6"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9M10 21h4"/>',
    help: '<path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M8 8h6M8 12h6"/>',
    start: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>', forward: '<path d="M9 5l7 7-7 7"/>', reload: '<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="M7 4l13 8-13 8z"/>', pause: '<path d="M7 4h4v16H7zM14 4h4v16h-4z"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    step: '<path d="M5 4l10 8-10 8zM17 4v16"/>',
    camera: '<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
    code: '<path d="M8 6l-5 6 5 6M16 6l5 6-5 6M14 4l-4 16"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    paste: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h6"/>',
    save: '<path d="M4 4h13l3 3v13H4z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    home: '<path d="M3 11l9-8 9 8M6 10v10h12V10"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    snapshot: '<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6l1-2h6l1 2"/>',
    kernel: '<path d="M12 3l8 4v6c0 5-4 7-8 8-4-1-8-3-8-8V7z"/><path d="M9 12l2 2 4-4"/>',
  };
  function icon(name, cls) {
    const p = ICONS[name] || ICONS.file;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="' + (cls || '') + '">' + p + '</svg>';
  }
  ui.icon = icon;

  // ---------------------------------------------------------------- 模板辅助
  ui.att = (sys, win, extra) => 'data-system-id="' + sys.id + '"' + (win ? ' data-window-id="' + win.id + '"' : '') + (extra ? ' ' + extra : '');
  function setHTML(host, html) {
    if (!host) return;
    if (host._last === html) return;
    const ae = document.activeElement;
    let saved = null;
    if (ae && host.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      saved = { tid: ae.getAttribute('data-testid'), val: ae.value, s: ae.selectionStart, e: ae.selectionEnd };
    }
    host.innerHTML = html; host._last = html;
    if (saved && saved.tid) {
      const n = host.querySelector('[data-testid="' + saved.tid + '"]');
      if (n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA')) {
        n.value = saved.val; try { n.focus(); n.setSelectionRange(saved.s, saved.e); } catch (e) {}
      }
    }
  }
  ui.setHTML = setHTML;
  ui.on = (name, fn) => { ui.actions[name] = fn; };
  ui.registerApp = (id, def) => { ui.apps[id] = def; };
  ui.bump = () => { /* 占位：状态变化由渲染循环自然反映 */ };
  ui.toast = (msg, err) => { ui.toastMsg = msg; ui.toastErr = !!err; ui.toastT = Date.now() + 2600; };
  ui.prompt = function (title, label, def, cb) {
    ui.dialog = {
      title, html: '<div style="margin-bottom:6px" class="small muted">' + esc(label) + '</div>' +
        '<input id="dlg-input" class="field" style="width:100%" value="' + esc(def || '') + '">',
      buttons: [
        { label: '取消', act: () => { ui.dialog = null; } },
        { label: '确定', primary: true, act: () => { const n = document.getElementById('dlg-input'); const v = n ? n.value : ''; ui.dialog = null; cb(v); } },
      ],
    };
  };

  const WALLPAPERS = { aurora: '/assets/wallpapers/aurora.svg', dawn: '/assets/wallpapers/dawn.svg', night: '/assets/wallpapers/night.svg' };
  ui.WALLPAPERS = WALLPAPERS;
  const TINTS = ['#8b5cf6', '#22b8a6', '#f0a02a', '#ec5f8a', '#4a9bf0', '#8ad24a'];

  // ---------------------------------------------------------------- 桌面骨架
  function createDesktopEl(sys) {
    const el = document.createElement('div');
    el.className = 'desktop'; el.setAttribute('data-system-id', sys.id); el.setAttribute('data-testid', 'os-desktop');
    el.innerHTML =
      '<div class="desktop-wallpaper" style="background-image:url(' + (WALLPAPERS[sys.desktop.wallpaper] || WALLPAPERS.aurora) + ')"></div>' +
      '<div class="depth-band"></div><div class="depth-tag"></div>' +
      '<div class="desktop-icons"></div>' +
      '<div class="window-layer"></div>' +
      '<div class="taskbar"></div>' +
      '<div class="start-menu-host"></div>' +
      '<div class="notif-host"></div>';
    return el;
  }
  ui.getDesktop = (sys) => { if (!ui.desktops[sys.id]) ui.desktops[sys.id] = createDesktopEl(sys); return ui.desktops[sys.id]; };

  // ---------------------------------------------------------------- 桌面图标定义
  function desktopIcons(sys) {
    const isRoot = !sys.parentId;
    const out = [];
    if (isRoot) {
      out.push({ label: '文件管理器', ico: 'files', act: 'open-files', tid: 'desktop-icon', appId: 'files' });
      out.push({ label: '示例工作簿', ico: 'sheet', act: 'open-file', tid: 'desktop-icon', filePath: '/Demo/sample.sheet' });
      out.push({ label: '场景源文件', ico: 'scene', act: 'open-file', tid: 'desktop-icon', filePath: '/Demo/helicopter-24.scene' });
      out.push({ label: '回收站', ico: 'trash', act: 'open-recycle', tid: 'desktop-icon' });
      out.push({ label: '浏览器', ico: 'browser', act: 'open-app', tid: 'desktop-icon', appId: 'browser' });
      out.push({ label: '小组件', ico: 'widgets', act: 'open-app', tid: 'desktop-icon', appId: 'widgets' });
      out.push({ label: '操作说明', ico: 'help', act: 'open-app', tid: 'desktop-icon', appId: 'help' });
      out.push({ label: '新建子系统', ico: 'system', act: 'system-new', tid: 'desktop-icon' });
      out.push({ label: '设置', ico: 'settings', act: 'open-app', tid: 'desktop-icon', appId: 'settings' });
      out.push({ label: '任务管理器', ico: 'tasks', act: 'open-app', tid: 'desktop-icon', appId: 'tasks' });
      out.push({ label: '文本编辑器', ico: 'editor', act: 'open-app', tid: 'desktop-icon', appId: 'editor' });
      out.push({ label: '电子表格', ico: 'spreadsheet', act: 'open-app', tid: 'desktop-icon', appId: 'spreadsheet' });
    } else {
      out.push({ label: '播放器', ico: 'player', act: 'open-app', tid: 'desktop-icon', appId: 'player' });
      out.push({ label: '图表工作台', ico: 'charts', act: 'open-app', tid: 'desktop-icon', appId: 'charts' });
      out.push({ label: '场景资源', ico: 'scene', act: 'open-file', tid: 'desktop-icon', filePath: '/Demo/helicopter-24.scene' });
      out.push({ label: '文件管理器', ico: 'files', act: 'open-files', tid: 'desktop-icon', appId: 'files' });
      out.push({ label: '编辑器', ico: 'editor', act: 'open-app', tid: 'desktop-icon', appId: 'editor' });
      out.push({ label: '进程管理器', ico: 'tasks', act: 'open-app', tid: 'desktop-icon', appId: 'tasks' });
      out.push({ label: '操作说明', ico: 'help', act: 'open-app', tid: 'desktop-icon', appId: 'help' });
      out.push({ label: '新建子系统', ico: 'system', act: 'system-new', tid: 'desktop-icon' });
    }
    return out;
  }
  const LAUNCH = {
    files: '文件管理器', spreadsheet: '电子表格', widgets: '小组件', editor: '文本/程序编辑器',
    browser: '浏览器', tasks: '任务/进程管理器', settings: '设置', player: '三维播放器', charts: '图表工作台',
  };
  function launchList(sys) {
    const root = ['files', 'spreadsheet', 'widgets', 'editor', 'browser', 'tasks', 'settings'];
    const inner = ['player', 'charts', 'files', 'editor', 'tasks'];
    return (!sys.parentId ? root : inner);
  }

  // ---------------------------------------------------------------- 桌面渲染
  function renderDesktop(sys) {
    const el = ui.getDesktop(sys);
    // 只取本桌面的直属部件：子系统桌面嵌套在 window-layer 里，用 querySelector 会误取到后代
    const P = (c) => el.querySelector(':scope > .' + c);
    const tint = TINTS[sys.depth % TINTS.length];
    el.style.setProperty('--accent', sys.desktop.accent);
    el.style.setProperty('--tint', tint);
    const scale = sys.desktop.scale || 1;
    // zoom 会缩放整棵子树；按 1/scale 设定布局尺寸，使视觉尺寸恰好填满承载区域，
    // 同时 getBoundingClientRect/offsetWidth 之比给出有效缩放，供拖动坐标换算。
    const par = el.parentNode;
    const pw = par ? par.clientWidth : window.innerWidth;
    const ph = par ? par.clientHeight : window.innerHeight;
    el.style.zoom = scale;
    el.style.width = Math.max(2, pw / scale) + 'px';
    el.style.height = Math.max(2, ph / scale) + 'px';
    const wp = P('desktop-wallpaper');
    wp.style.backgroundImage = 'url(' + (WALLPAPERS[sys.desktop.wallpaper] || WALLPAPERS.aurora) + ')';
    const tag = P('depth-tag');
    tag.innerHTML = '第 <b>' + (sys.depth + 1) + '</b> 层 · <b>' + esc(sys.id) + '</b> · ' + (rt.isRunning(sys) ? '运行中' : sys.state === 'error' ? '内核错误' : '已暂停/停止');
    tag.style.color = tint;

    // 图标
    const icons = desktopIcons(sys).map((d, i) => {
      const extra = d.appId ? 'data-app-id="' + d.appId + '"' : (d.filePath ? 'data-file-path="' + esc(d.filePath) + '"' : '');
      const sel = ui.selIcon[sys.id] === i ? ' selected' : '';
      const drag = d.filePath ? 'draggable="true"' : '';
      return '<div class="desktop-icon' + sel + '" data-testid="desktop-icon" data-act="' + d.act + '" ' +
        ui.att(sys, null, extra + ' data-value="' + esc(d.label) + '" ' + drag) + '>' +
        '<div class="di-glyph">' + icon(d.ico) + '</div><div class="di-label">' + esc(d.label) + '</div></div>';
    }).join('');
    setHTML(P('desktop-icons'), icons);

    // 任务栏
    const titems = sys.windows.map((w) => {
      const st = w.state === 'minimized' ? ' min' : (w.id === sys.focusWindowId ? ' active' : '');
      return '<button class="taskbar-item' + st + '" data-testid="taskbar-item" data-act="taskbar-item" ' +
        ui.att(sys, w, 'data-value="' + esc(w.id) + '"') + '>' +
        '<span class="ti-ico">' + icon(w.appId === 'system' ? 'system' : w.appId === 'projection' ? 'projection' : w.appId) + '</span>' +
        '<span class="ti-txt">' + esc(w.title) + '</span></button>';
    }).join('');
    const unread = sys.notifications.filter((n) => !n.read).length;
    const d = new Date();
    const taskbar =
      '<button class="tb-start" data-testid="start-toggle" data-act="start-toggle" ' + ui.att(sys) + '>' + icon('start') + '</button>' +
      '<div class="tb-search" ' + ui.att(sys) + '>🔎 搜索应用、文件…</div>' +
      '<div class="taskbar-items">' + titems + '</div>' +
      '<div class="tray">' +
      '<button class="tray-btn" data-testid="quick-settings-toggle" data-act="quick-toggle" ' + ui.att(sys) + '>' + icon('wifi') + '</button>' +
      '<button class="tray-btn" data-testid="notifications-toggle" data-act="notifications-toggle" ' + ui.att(sys) + '>' + icon('bell') + (unread ? '<span class="badge">' + unread + '</span>' : '') + '</button>' +
      '<div class="tray-clock" ' + ui.att(sys) + '>' + U.fmtClock(d) + '<small>' + U.fmtDate(d) + '</small></div>' +
      '</div>';
    setHTML(P('taskbar'), taskbar);

    // 开始菜单
    const host = P('start-menu-host');
    if (ui.menuOpen[sys.id]) {
      const search = (ui.startSearch[sys.id] || '').toLowerCase();
      const tiles = launchList(sys).filter((k) => !search || LAUNCH[k].toLowerCase().indexOf(search) >= 0 || k.indexOf(search) >= 0)
        .map((k) => '<button class="start-tile" data-testid="launch-' + k + '" data-act="launch" ' + ui.att(sys, null, 'data-value="' + k + '"') + '>' +
          '<span class="st-ico">' + icon(k) + '</span><span>' + esc(LAUNCH[k]) + '</span></button>').join('');
      const sm =
        '<div class="start-menu" data-testid="start-menu" ' + ui.att(sys) + '>' +
        '<div class="start-head"><h3>' + esc(sys.desktop.title || sys.id) + '</h3><div class="sh-user"><div class="sh-avatar"></div><span class="small muted">本地用户</span></div></div>' +
        '<input class="start-search" data-testid="start-search" data-act="start-search" placeholder="查找应用…" ' + ui.att(sys) + '>' +
        '<div class="start-grid">' + tiles + '</div>' +
        '<div class="start-foot"><button data-act="open-app" ' + ui.att(sys, null, 'data-value="sysmgr"') + '>系统管理</button>' +
        '<button data-act="open-app" ' + ui.att(sys, null, 'data-value="help"') + '>操作说明</button></div></div>';
      setHTML(host, sm);
    } else setHTML(host, '');

    // 通知中心
    const nh = P('notif-host');
    if (ui.notifOpen[sys.id]) {
      const quick = [
        ['dnd', '免打扰'], ['wifi', '网络'], ['bluetooth', '蓝牙'], ['night', '夜间模式'],
      ].map(([k, label]) => '<div class="quick-tile' + (sys.quick[k] ? ' on' : '') + '" data-act="quick-item" ' + ui.att(sys, null, 'data-value="' + k + '"') + '>' + icon(k === 'dnd' ? 'bell' : 'wifi') + label + '</div>').join('');
      const items = sys.notifications.length ? sys.notifications.map((n) =>
        '<div class="notif-item"><div class="ni-title">' + esc(n.title) + '</div><div class="ni-body">' + esc(n.body) + '</div>' +
        '<div class="ni-time">' + new Date(n.at).toLocaleTimeString('zh-CN') + '</div></div>').join('')
        : '<div class="muted small" style="padding:10px">暂无通知</div>';
      setHTML(nh, '<div class="notif-center" data-testid="widget-notifications" ' + ui.att(sys) + '>' +
        '<div class="notif-head"><h3>通知中心</h3><button class="btn sm" data-act="notif-clear" ' + ui.att(sys) + '>全部已读</button></div>' +
        '<div class="quick-grid">' + quick + '</div>' + items + '</div>');
    } else setHTML(nh, '');

    reconcileWindows(sys, P('window-layer'));
  }

  // ---------------------------------------------------------------- 窗口
  function createWindowEl(sys, win, layer) {
    const el = document.createElement('div');
    el.className = 'app-window';
    el.setAttribute('data-testid', 'app-window');
    el.setAttribute('data-window-id', win.id);
    el.setAttribute('data-system-id', sys.id);
    el.setAttribute('data-app-id', win.appId);
    if (win.sourceSystemId) { el.setAttribute('data-source-system-id', win.sourceSystemId); el.setAttribute('data-source-window-id', win.sourceWindowId); el.setAttribute('data-source-app-id', win.sourceAppId); }
    el.innerHTML =
      '<div class="window-titlebar" data-testid="window-titlebar" ' + ui.att(sys, win) + '>' +
      '<span class="wt-icon">' + icon(win.appId === 'system' ? 'system' : win.appId === 'projection' ? 'projection' : win.appId) + '</span>' +
      '<span class="wt-title"></span><span class="wt-tag"></span>' +
      '<div class="window-controls">' +
      '<button class="wc-btn" data-testid="window-minimize" data-act="window-minimize" ' + ui.att(sys, win) + '>—</button>' +
      '<button class="wc-btn" data-testid="window-maximize" data-act="window-maximize" ' + ui.att(sys, win) + '>□</button>' +
      '<button class="wc-btn close" data-testid="window-close" data-act="window-close" ' + ui.att(sys, win) + '>×</button>' +
      '</div></div>' +
      '<div class="window-body"></div>' +
      '<div class="window-resize" data-testid="window-resize" data-act="window-resize" ' + ui.att(sys, win) + '></div>';
    layer.appendChild(el);
    const rec = { root: el, body: el.querySelector('.window-body'), sysId: sys.id, winId: win.id, appId: win.appId, ctx: {}, mountedAppId: null };
    el.addEventListener('mousedown', () => rt.focusWindow(sys, win.id));
    return rec;
  }

  function mountWindowBody(sys, win, rec) {
    if (rec.mountedAppId === win.appId) return;
    rec.body.innerHTML = ''; rec.ctx = {};
    const def = ui.apps[win.appId];
    if (def && def.mount) def.mount(sys, win, rec.body, rec);
    else rec.body.innerHTML = '<div style="padding:20px" class="muted">未知应用 ' + esc(win.appId) + '</div>';
    rec.mountedAppId = win.appId;
  }

  function updateWindowEl(sys, win, rec, zOverride, focusId) {
    const el = rec.root;
    el.style.display = ''; el.classList.toggle('minimized', win.state === 'minimized');
    el.classList.toggle('focused', win.id === focusId);
    el.style.zIndex = (zOverride && zOverride[win.id] != null) ? zOverride[win.id] : win.z;
    const maximized = win.state === 'maximized';
    const snap = !maximized && win.extra && win.extra.snap;
    if (maximized) { el.style.left = '0'; el.style.top = '0'; el.style.width = '100%'; el.style.height = '100%'; }
    else if (snap === 'left') { el.style.left = '0'; el.style.top = '0'; el.style.width = '50%'; el.style.height = '100%'; }
    else if (snap === 'right') { el.style.left = '50%'; el.style.top = '0'; el.style.width = '50%'; el.style.height = '100%'; }
    else { el.style.left = win.x + 'px'; el.style.top = win.y + 'px'; el.style.width = win.w + 'px'; el.style.height = win.h + 'px'; }
    el.querySelector('.wt-title').textContent = win.title;
    el.querySelector('.wt-tag').textContent = win.appId === 'projection' && win.sourceSystemId ? ('← ' + win.sourceSystemId) : (win.appId === 'system' ? '子系统' : '');
    mountWindowBody(sys, win, rec);
    const def = ui.apps[win.appId];
    if (def && def.update) def.update(sys, win, rec.body, rec);
    // 三维视图可见性
    if (rec.sceneView) rec.sceneView.setVisible(win.state !== 'minimized' && rec.root.offsetWidth > 2);
    if (rec.chartView && rec.chartView.setVisible) rec.chartView.setVisible(win.state !== 'minimized');
  }

  function reconcileWindows(sys, layer) {
    // 子系统的窗口管理程序（wm.npl）若提交了层叠/焦点规则，则按其输出叠放窗口、分配焦点。
    let zOverride = null, focusId = sys.focusWindowId;
    const wm = sys.display && sys.display['__wm'] && sys.display['__wm'].wm;
    if (wm && Array.isArray(wm.order) && wm.order.length) {
      zOverride = {};
      wm.order.forEach((wid, i) => { if (rt.findWindow(sys, wid)) zOverride[wid] = 100 + i; });
      if (wm.focus && rt.findWindow(sys, wm.focus)) { focusId = wm.focus; sys.focusWindowId = wm.focus; }
    }
    const alive = {};
    for (const win of sys.windows) {
      alive[win.id] = true;
      let rec = ui.winEls[win.id];
      if (!rec) { rec = createWindowEl(sys, win, layer); ui.winEls[win.id] = rec; }
      else if (rec.root.parentNode !== layer) layer.appendChild(rec.root);
      try { updateWindowEl(sys, win, rec, zOverride, focusId); } catch (e) { console.error('窗口渲染', win.id, e); }
    }
    // 回收属于该系统但已删除的窗口
    for (const wid in ui.winEls) {
      const rec = ui.winEls[wid];
      if (!alive[wid] && rec.sysId === sys.id) { destroyWinEl(wid); }
    }
  }
  function destroyWinEl(wid) {
    const rec = ui.winEls[wid]; if (!rec) return;
    const def = ui.apps[rec.appId];
    if (def && def.destroy) { try { def.destroy(rec); } catch (e) {} }
    if (rec.root.parentNode) rec.root.parentNode.removeChild(rec.root);
    delete ui.winEls[wid];
  }
  ui.clearAll = function () {
    for (const wid in ui.winEls) {
      const rec = ui.winEls[wid]; const def = ui.apps[rec.appId];
      if (def && def.destroy) { try { def.destroy(rec); } catch (e) {} }
      if (rec.root && rec.root.parentNode) rec.root.parentNode.removeChild(rec.root);
    }
    ui.winEls = {};
    for (const sid in ui.desktops) { const d = ui.desktops[sid]; if (d.parentNode) d.parentNode.removeChild(d); }
    ui.desktops = {}; ui.menuOpen = {}; ui.notifOpen = {}; ui.context = null; ui.dialog = null; ui.toastMsg = null;
    ui.drag = null; ui.clipboard = null; ui.dragFile = null;
    const ov = document.getElementById('overlay-layer'); if (ov) { ov.innerHTML = ''; ov._last = null; }
    if (OS.SharedRenderer) OS.SharedRenderer.views = [];
  };

  // ---------------------------------------------------------------- 主渲染帧
  function frame() {
    const root = rt.root(); if (!root) return;
    const rootEl = document.getElementById('root');
    if (ui.desktops['outer'] && ui.desktops['outer'].parentNode !== rootEl) rootEl.appendChild(ui.desktops['outer']);
    // 确保子系统桌面挂在其系统窗口里
    for (const sid in rt.state.systems) {
      const sys = rt.state.systems[sid];
      if (sys.parentId && sys.systemWindowId) {
        const wr = ui.winEls[sys.systemWindowId];
        if (wr) {
          const del = ui.getDesktop(sys);
          const slot = wr.body.querySelector('.child-desktop-slot');
          if (slot && del.parentNode !== slot) slot.appendChild(del);
        }
      }
    }
    for (const sid in rt.state.systems) renderDesktop(rt.state.systems[sid]);
    // 清理孤立窗口/桌面
    const systemsAlive = rt.state.systems;
    for (const wid in ui.winEls) {
      const s = systemsAlive[ui.winEls[wid].sysId];
      if (!s || !rt.findWindow(s, wid)) destroyWinEl(wid);
    }
    for (const sid in ui.desktops) if (!systemsAlive[sid]) { const d = ui.desktops[sid]; if (d.parentNode) d.parentNode.removeChild(d); delete ui.desktops[sid]; }
    // 右键菜单 / 对话框 / toast
    renderOverlays();
    // 三维帧
    if (OS.SharedRenderer) OS.SharedRenderer.frame();
  }
  ui.frame = frame;

  function renderOverlays() {
    const ov = document.getElementById('overlay-layer');
    let h = '';
    if (ui.context) {
      const c = ui.context;
      h += '<div class="context-menu" style="left:' + c.x + 'px;top:' + c.y + 'px">' +
        (c.title ? '<div class="ctx-title">' + esc(c.title) + '</div>' : '') +
        c.items.map((it) => it.sep ? '<div class="ctx-sep"></div>' :
          '<div class="ctx-item' + (it.danger ? ' danger' : '') + '" data-act="ctx" data-value="' + esc(it.act) + '">' +
          '<span class="cx-ico">' + (it.ico ? icon(it.ico) : '') + '</span>' + esc(it.label) + '</div>').join('') + '</div>';
    }
    if (ui.dialog) {
      const d = ui.dialog;
      h += '<div class="dialog-backdrop"><div class="dialog"><h3>' + esc(d.title) + '</h3><p>' + (d.html || esc(d.body || '')) + '</p>' +
        '<div class="dialog-btns">' + d.buttons.map((b, i) =>
          '<button class="btn ' + (b.primary ? 'primary' : '') + ' ' + (b.danger ? 'danger' : '') + '" data-act="dialog" data-value="' + i + '">' + esc(b.label) + '</button>').join('') +
        '</div></div></div>';
    }
    if (ui.toastMsg && Date.now() < ui.toastT) h += '<div class="toast' + (ui.toastErr ? ' err' : '') + '">' + esc(ui.toastMsg) + '</div>';
    setHTML(ov, h);
  }

  // ---------------------------------------------------------------- 打开应用
  ui.openApp = function (sys, appId, opts) {
    opts = opts || {};
    const def = ui.apps[appId] || {};
    const w = rt.openWindow(sys, {
      appId, title: opts.title || (LAUNCH[appId] || def.title || appId),
      icon: appId, w: opts.w || def.w || 760, h: opts.h || def.h || 480,
      extra: opts.extra || {},
    });
    return w;
  };
  ui.openFile = function (sys, path) {
    const node = rt.fs.get(sys.fs, path); if (!node || node.type !== 'file') { ui.toast('文件不存在', true); return; }
    const mime = node.mime;
    if (mime === 'sheet') return ui.openApp(sys, 'spreadsheet', { extra: { path }, title: rt.fs.base(path) });
    if (mime === 'scene') return ui.openApp(sys, 'player', { extra: { path }, title: '播放器 · ' + rt.fs.base(path) });
    return ui.openApp(sys, 'editor', { extra: { path }, title: '编辑器 · ' + rt.fs.base(path) });
  };

  // ---------------------------------------------------------------- 通用动作
  ui.on('start-toggle', ({ sys }) => { ui.menuOpen[sys.id] = !ui.menuOpen[sys.id]; ui.notifOpen[sys.id] = false; });
  ui.on('start-close', ({ sys }) => { ui.menuOpen[sys.id] = false; });
  ui.on('launch', ({ sys, ds }) => { ui.menuOpen[sys.id] = false; ui.openApp(sys, ds.value); });
  ui.on('open-app', ({ sys, ds }) => { ui.openApp(sys, ds.value); });
  ui.on('open-files', ({ sys }) => ui.openApp(sys, 'files', { extra: { cwd: '/Documents' } }));
  ui.on('open-file', ({ sys, ds }) => ui.openFile(sys, ds.filePath));
  ui.on('open-recycle', ({ sys }) => ui.openApp(sys, 'files', { extra: { cwd: '/__recycle' }, title: '回收站' }));
  ui.on('taskbar-item', ({ sys, ds }) => {
    const w = rt.findWindow(sys, ds.value); if (!w) return;
    if (w.state === 'minimized') rt.setWindowState(sys, w.id, 'normal');
    else if (sys.focusWindowId === w.id) rt.setWindowState(sys, w.id, 'minimized');
    else rt.focusWindow(sys, w.id);
  });
  ['window-minimize', 'window-maximize', 'window-close'].forEach((act) => {
    ui.on(act, ({ sys, win }) => {
      if (!win) return;
      if (act === 'window-minimize') rt.setWindowState(sys, win.id, 'minimized');
      else if (act === 'window-maximize') rt.setWindowState(sys, win.id, win.state === 'maximized' ? 'normal' : 'maximized');
      else {
        const def = ui.apps[win.appId];
        if (def && def.beforeClose && def.beforeClose(sys, win) === false) return;
        if (win.appId === 'system') {
          const target = rt.getSystem(win.targetSystemId);
          ui.dialog = {
            title: '关闭系统窗口', body: '是否停止整个子系统及其子树？「取消」仅关闭窗口视图。',
            buttons: [
              { label: '取消' , act: () => { ui.dialog = null; } },
              { label: '仅关窗口', act: () => { rt.closeWindow(sys, win.id); ui.dialog = null; } },
              { label: '停止子树', primary: true, danger: true, act: () => { if (target) rt.stopSystem(target.id); rt.closeWindow(sys, win.id); ui.dialog = null; } },
            ],
          };
        } else rt.closeWindow(sys, win.id);
      }
    });
  });
  ui.on('notifications-toggle', ({ sys }) => { ui.notifOpen[sys.id] = !ui.notifOpen[sys.id]; ui.menuOpen[sys.id] = false; sys.notifications.forEach((n) => n.read = true); });
  ui.on('notif-clear', ({ sys }) => { sys.notifications.forEach((n) => n.read = true); });
  ui.on('quick-toggle', ({ sys }) => { ui.notifOpen[sys.id] = !ui.notifOpen[sys.id]; ui.menuOpen[sys.id] = false; });
  ui.on('quick-item', ({ sys, ds }) => { sys.quick[ds.value] = !sys.quick[ds.value]; ui.toast('快捷设置：' + ds.value + (sys.quick[ds.value] ? ' 开' : ' 关')); });
  ui.on('ctx', ({ ds }) => {
    const c = ui.context; ui.context = null;
    if (c) { const it = c.items.find((x) => x.act === ds.value); if (it && it.fn) it.fn(); }
  });
  ui.on('dialog', ({ ds }) => { const d = ui.dialog; if (!d) return; const b = d.buttons[+ds.value]; if (b && b.act) b.act(); });
  ui.on('start-search', () => {});

  // 系统管理 / 子系统控制
  ui.on('system-new', ({ sys }) => {
    const child = rt.createSystem(sys.id);
    if (child) ui.toast('已创建直属子系统 ' + child.id);
  });
  ui.on('system-pause', ({ ds }) => rt.setPaused(ds.targetSystemId, true));
  ui.on('system-resume', ({ ds }) => rt.setPaused(ds.targetSystemId, false));
  ui.on('system-step', ({ ds }) => rt.singleStep(ds.targetSystemId));
  ui.on('system-stop', ({ ds }) => rt.stopSystem(ds.targetSystemId));
  ui.on('system-close', ({ ds }) => rt.closeSystem(ds.targetSystemId));
  ui.on('system-restart', ({ ds }) => rt.restartSystem(ds.targetSystemId));
  ui.on('system-speed', ({ ds }) => rt.setTimeScale(ds.targetSystemId, +ds.value));
  ui.on('system-grant', ({ ds }) => { const s = rt.getSystem(ds.targetSystemId); if (s) { s.grantCap = Math.max(200, +ds.value); ui.toast('已调整 ' + s.id + ' 拨付上限为 ' + s.grantCap); } });
  ui.on('kernel-open', ({ sys, ds }) => {
    const child = rt.getSystem(ds.targetSystemId); if (!child) return;
    ui.openApp(sys, 'editor', { extra: { path: child.kernelPath, kernelFor: child.id }, title: '内核源 · ' + child.id });
  });
  ui.on('snapshot-create', ({ ds }) => { const id = rt.snapshot(ds.targetSystemId); if (id) ui.toast('快照已创建（含整棵子树运行状态）'); });
  ui.on('snapshot-save-local', ({ ds }) => { const r = rt.saveSnapshotLocal(ds.value); if (r) ui.toast('快照已保存到本机数据目录'); });
  ui.on('snapshot-import-local', () => { rt.importSnapshotLocal().then((id) => { if (id) ui.toast('快照已导入，可在系统管理中恢复'); }); });

  // ---------------------------------------------------------------- 系统管理应用
  ui.registerApp('sysmgr', {
    w: 780, h: 560, title: '系统管理',
    update(sys, win, body) {
      const kids = sys.children.map((id) => rt.getSystem(id)).filter(Boolean);
      const cards = kids.map((c) => {
        const st = c.state === 'running' ? (c.paused ? '<span class="pill warn">已暂停</span>' : '<span class="pill ok">运行中</span>')
          : c.state === 'error' ? '<span class="pill err">内核错误</span>' : '<span class="pill">已停止</span>';
        const b = (act, label, tid, extra) => '<button class="btn sm' + (act === 'system-restart' ? '' : '') + '" data-testid="' + tid + '" data-act="' + act + '" ' + ui.att(sys, win, 'data-target-system-id="' + c.id + '" ' + (extra || '')) + '>' + label + '</button>';
        return '<div class="sys-card"><div class="sc-head"><span class="sc-name">' + icon('system') + ' ' + esc(c.id) + '</span>' + st + '<span class="muted small">第 ' + (c.depth + 1) + ' 层 · 拨付上限 ' + c.grantCap + '</span></div>' +
          '<div class="sc-meta">速率 ' + c.timeScale.toFixed(1) + '× · 虚拟时间 ' + c.virtualTime.toFixed(2) + 's · 本步拨付 ' + Math.round(c.grantThisTick) + ' · 后代 ' + rt.descendants(c).length + ' 个 · 窗口 ' + c.windows.length + '</div>' +
          '<div class="sc-actions">' +
          b('system-pause', '暂停', 'system-pause') + b('system-resume', '继续', 'system-resume') + b('system-step', '单步', 'system-step') +
          '<button class="btn sm" data-act="system-speed" ' + ui.att(sys, win, 'data-target-system-id="' + c.id + '" data-value="0.5"') + '>0.5×</button>' +
          '<button class="btn sm" data-act="system-speed" ' + ui.att(sys, win, 'data-target-system-id="' + c.id + '" data-value="1"') + '>1×</button>' +
          '<button class="btn sm" data-act="system-speed" ' + ui.att(sys, win, 'data-target-system-id="' + c.id + '" data-value="3"') + '>3×</button>' +
          b('system-restart', '重启', 'system-restart') + b('kernel-open', '内核源', 'kernel-open') +
          b('snapshot-create', '快照', 'snapshot-create') + b('system-stop', '停止', 'system-stop') + b('system-close', '关闭', 'system-close') +
          '<input class="field sm" style="width:80px" data-act="system-grant" data-target-system-id="' + c.id + '" placeholder="拨付" ' + ui.att(sys, win) + '>' +
          '</div></div>';
      }).join('') || '<div class="muted" style="padding:16px">还没有直属子系统。点击「新建子系统」创建，子系统里还能继续创建系统。</div>';
      // 快照列表
      const snaps = Object.keys(rt.state.snapshots).map((sid) => {
        const s = rt.state.snapshots[sid];
        return '<div class="sys-card" style="padding:9px"><div class="sc-head"><span class="sc-name">' + icon('snapshot') + ' ' + esc(s.name) + '</span><span class="muted small">' + new Date(s.createdAt).toLocaleString('zh-CN') + '</span></div>' +
          '<div class="sc-actions">' +
          '<button class="btn sm" data-act="snapshot-restore" ' + ui.att(sys, win, 'data-value="' + sid + '"') + '>恢复到此</button>' +
          '<button class="btn sm" data-act="snapshot-fork" ' + ui.att(sys, win, 'data-value="' + sid + '"') + '>分叉新子树</button>' +
          '<button class="btn sm" data-act="snapshot-save-local" ' + ui.att(sys, win, 'data-value="' + sid + '"') + '>存到本机</button>' +
          '</div></div>';
      }).join('') || '<div class="muted small">暂无快照</div>';
      function treeStr(s, pre) {
        let out = pre + (s.parentId ? '└ ' : '') + s.id + '  [' + s.state + (s.paused ? ' 暂停' : '') + ']\n';
        for (const cid of s.children) { const c = rt.getSystem(cid); if (c) out += treeStr(c, pre + '   '); }
        return out;
      }
      const html = '<div class="sysmgr-wrap"><div class="app-toolbar">' +
        '<button class="btn primary" data-testid="system-new" data-act="system-new" ' + ui.att(sys, win) + '>+ 新建直属子系统</button>' +
        '<span class="grow"></span><button class="btn" data-act="snapshot-import-local" ' + ui.att(sys, win) + '>导入本机快照</button>' +
        '<span class="pill">本系统 id=' + esc(sys.id) + ' · 第 ' + (sys.depth + 1) + ' 层</span></div>' +
        '<div class="sysmgr-list"><h4 style="margin:4px 0 10px">直属子系统</h4>' + cards +
        '<h4 style="margin:18px 0 10px">快照（恢复/分叉/导出）</h4>' + snaps + '</div>' +
        '<div class="sys-tree">系统树：\n' + esc(treeStr(rt.root(), '')) + '</div></div>';
      setHTML(body, html);
    },
  });
  ui.on('snapshot-restore', ({ ds }) => {
    const snap = rt.state.snapshots[ds.value];
    ui.dialog = { title: '恢复快照', body: '把快照「' + (snap ? snap.name : '') + '」恢复到原实例？范围外的系统保持当前值。',
      buttons: [{ label: '取消', act: () => ui.dialog = null }, { label: '恢复', primary: true, act: () => { rt.restoreSnapshot(ds.value, snap.rootId); ui.dialog = null; ui.toast('已恢复快照'); } }] };
  });
  ui.on('snapshot-fork', ({ ds }) => { const id = rt.forkSnapshot(ds.value); if (id) ui.toast('已分叉出 ' + id); });

  // ---------------------------------------------------------------- 操作说明（help）
  ui.registerApp('help', {
    w: 860, h: 620, title: '操作说明',
    update(sys, win, body) { setHTML(body, '<div class="help-wrap">' + (OS.HELP_HTML || '<p>说明加载中…</p>') + '</div>'); },
  });

  // ---------------------------------------------------------------- 事件委托
  function ctxOf(el) {
    const sysEl = el.closest('[data-system-id]');
    const winEl = el.closest('[data-window-id]');
    const sysId = el.getAttribute('data-system-id') || (sysEl && sysEl.getAttribute('data-system-id')) || 'outer';
    const winId = el.getAttribute('data-window-id') || (winEl && winEl.getAttribute('data-window-id'));
    let sys = rt.getSystem(sysId) || rt.root();
    let win = winId ? rt.findWindow(sys, winId) : null;
    return { el, sys, win, ds: el.dataset || {}, sysId, winId };
  }
  ui.ctxOf = ctxOf;

  function effZoom(el) { const r = el.getBoundingClientRect(); return (el.offsetWidth && r.width) ? r.width / el.offsetWidth : 1; }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) { // 点击空白处关闭菜单
      if (ui.context) ui.context = null;
      for (const k in ui.menuOpen) ui.menuOpen[k] = false;
      return;
    }
    const act = el.getAttribute('data-act');
    const fn = ui.actions[act];
    if (fn) {
      if (act !== 'start-toggle' && act !== 'notifications-toggle' && act !== 'quick-toggle' && act !== 'ctx') e.stopPropagation();
      try { fn(ctxOf(el), e); } catch (err) { console.error('动作 ' + act, err); ui.toast('操作失败：' + err.message, true); }
    }
  });

  document.addEventListener('dblclick', (e) => {
    const tb = e.target.closest('.window-titlebar');
    if (tb) { const c = ctxOf(tb); if (c.win) { rt.setWindowState(c.sys, c.win.id, c.win.state === 'maximized' ? 'normal' : 'maximized'); } return; }
    const di = e.target.closest('.desktop-icon');
    if (di) { const c = ctxOf(di); const a = ui.actions[di.getAttribute('data-act')]; if (a) a(c, e); return; }
    const fi = e.target.closest('.files-item');
    if (fi) { const c = ctxOf(fi); if (ui.actions['files-dbl']) ui.actions['files-dbl'](c, e); }
  });

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const di = e.target.closest('.desktop-icon');
    const fi = e.target.closest('.files-item');
    const c = ctxOf(e.target);
    if (di) {
      ui.context = { x: e.clientX, y: e.clientY, title: di.querySelector('.di-label').textContent,
        items: [{ label: '打开', ico: 'file', act: 'open', fn: () => { const a = ui.actions[di.getAttribute('data-act')]; if (a) a(ctxOf(di)); } },
          { sep: true }, { label: '属性', ico: 'settings', act: 'prop', fn: () => ui.toast('这是 ' + (di.getAttribute('data-file-path') || '应用') ) }] };
    } else if (fi) {
      ui.context = { x: e.clientX, y: e.clientY, title: rt.fs.base(fi.getAttribute('data-file-path') || ''),
        items: [{ label: '打开', ico: 'file', act: 'o', fn: () => ui.openFile(c.sys, fi.getAttribute('data-file-path')) },
          { label: '复制', ico: 'copy', act: 'c', fn: () => { ui.clipboard = { sysId: c.sys.id, path: fi.getAttribute('data-file-path') }; ui.toast('已复制'); } },
          { sep: true }, { label: '删除', ico: 'trash', act: 'd', danger: true, fn: () => { rt.fs.delete(c.sys.fs, fi.getAttribute('data-file-path'), c.sys.fs.recycle); ui.toast('已移入回收站'); } }] };
    } else {
      // 桌面空白右键
      ui.context = { x: e.clientX, y: e.clientY, title: (c.sys.id + ' 桌面'),
        items: [
          { label: '新建子系统', ico: 'system', act: 'n', fn: () => rt.createSystem(c.sys.id) },
          { label: '打开系统管理', ico: 'tasks', act: 'm', fn: () => ui.openApp(c.sys, 'sysmgr') },
          { sep: true },
          { label: '刷新 / 查看说明', ico: 'help', act: 'h', fn: () => ui.openApp(c.sys, 'help') },
        ] };
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ui.context = null; ui.dialog = null;
      for (const k in ui.menuOpen) ui.menuOpen[k] = false;
      for (const k in ui.notifOpen) ui.notifOpen[k] = false;
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { /* 由各应用处理复制 */ }
  });

  document.addEventListener('input', (e) => {
    const el = e.target; const act = el.getAttribute && el.getAttribute('data-act');
    if (act === 'start-search') { const c = ctxOf(el); ui.startSearch[c.sysId] = el.value; return; }
    if (act && ui.actions['input:' + act]) ui.actions['input:' + act](ctxOf(el), e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target; const act = el.getAttribute && el.getAttribute('data-act');
    if (act && ui.actions['change:' + act]) ui.actions['change:' + act](ctxOf(el), e);
  });

  // 窗口拖动 / 缩放 / 贴靠
  document.addEventListener('mousedown', (e) => {
    const tb = e.target.closest('.window-titlebar');
    const rz = e.target.closest('.window-resize');
    if (!tb && !rz) return;
    if (e.target.closest('.window-controls')) return;
    const c = ctxOf(tb || rz); if (!c.win) return;
    const rec = ui.winEls[c.win.id];
    const zoom = rec ? effZoom(rec.root) : 1;
    ui.drag = { type: rz ? 'resize' : 'move', sys: c.sys, win: c.win, sx: e.clientX, sy: e.clientY,
      ox: c.win.x, oy: c.win.y, ow: c.win.w, oh: c.win.h, zoom, snap: null, maximized: c.win.state === 'maximized' };
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!ui.drag) return;
    const g = ui.drag; const dx = (e.clientX - g.sx) / g.zoom, dy = (e.clientY - g.sy) / g.zoom;
    if (g.type === 'resize') {
      rt.setWindowRect(g.sys, g.win.id, { w: Math.max(240, g.ow + dx), h: Math.max(160, g.oh + dy) });
    } else {
      if (g.maximized) { rt.setWindowState(g.sys, g.win.id, 'normal'); g.maximized = false; }
      let nx = g.ox + dx, ny = Math.max(0, g.oy + dy);
      const layer = ui.winEls[g.win.id] && ui.winEls[g.win.id].root.parentNode;
      const lw = layer ? layer.clientWidth : 1000;
      g.snap = e.clientX < 40 ? 'left' : (e.clientX > window.innerWidth - 40 ? 'right' : null);
      g.win.extra.snap = null;
      rt.setWindowRect(g.sys, g.win.id, { x: Math.max(-g.ow + 80, Math.min(lw - 80, nx)), y: ny });
    }
  });
  document.addEventListener('mouseup', () => {
    if (!ui.drag) return;
    const g = ui.drag;
    if (g.type === 'move' && g.snap) { g.win.extra.snap = g.snap; rt.setWindowRect(g.sys, g.win.id, { x: 0, y: 0 }); }
    ui.drag = null;
  });

  // 跨层文件拖放
  document.addEventListener('dragstart', (e) => {
    const fi = e.target.closest('.files-item') || e.target.closest('.desktop-icon');
    if (!fi) return;
    const c = ctxOf(fi); const path = fi.getAttribute('data-file-path');
    if (!path) return;
    ui.dragFile = { sysId: c.sysId, path };
    e.dataTransfer.setData('text/plain', JSON.stringify(ui.dragFile));
    e.dataTransfer.effectAllowed = 'copy';
  });
  document.addEventListener('dragover', (e) => {
    const fl = e.target.closest('.files-list');
    if (!fl) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
    const c = ctxOf(fl);
    fl.querySelectorAll('.files-item').forEach((x) => x.classList.remove('drop-target'));
    if (ui.dragFile) {
      const mark = document.createElement('div');
      fl.classList.add('drop-target');
    }
  });
  document.addEventListener('dragleave', (e) => {
    const fl = e.target.closest('.files-list'); if (fl) fl.classList.remove('drop-target');
  });
  document.addEventListener('drop', (e) => {
    const fl = e.target.closest('.files-list'); if (!fl) return;
    e.preventDefault(); fl.classList.remove('drop-target');
    const c = ctxOf(fl);
    let data = ui.dragFile;
    try { data = data || JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) {}
    if (!data) return;
    const src = rt.getSystem(data.sysId);
    const dstWin = c.win; const extra = dstWin ? dstWin.extra : {};
    let dir = extra.cwd || '/Documents';
    if (dir === '/__recycle') dir = '/Documents';
    const r = rt.transferFile(src, data.path, c.sys, dir);
    if (r.ok) ui.toast('已投放 → ' + c.sys.id + dir);
    else if (r.overwrite) {
      ui.dialog = { title: '目标已存在同名文件', body: '是否覆盖 ' + esc(r.name) + '？',
        buttons: [{ label: '取消', act: () => ui.dialog = null }, { label: '覆盖', primary: true, act: () => { rt.transferFileOverwrite(src, data.path, c.sys, r.dst); ui.dialog = null; ui.toast('已覆盖并投放'); } }] };
    } else ui.toast(r.error || '投放失败', true);
    ui.dragFile = null;
  });

  OS.ui = ui;
})(window.OS = window.OS || {});
