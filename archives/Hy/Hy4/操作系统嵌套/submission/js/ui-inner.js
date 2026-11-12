/* ============================================================================
 * 子系统应用：系统窗口（递归桌面）、三维播放器、飞行排演、图表工作台、跨层投送窗口。
 * 播放器/图表/排演的画面由子系统里的 NPL 进程经显示接口提交；投送只转发输入、复用源状态。
 * ========================================================================== */
(function (OS) {
  'use strict';
  const rt = OS.rt, ui = OS.ui, U = OS.util, esc = U.escapeHtml, icon = ui.icon, att = ui.att, setHTML = ui.setHTML;
  const clone = U.deepClone;

  function srcOf(sys, win) {
    if (win.appId === 'projection') {
      const s = rt.getSystem(win.sourceSystemId), w = s && rt.findWindow(s, win.sourceWindowId);
      if (s && w) return { sys: s, win: w, app: win.sourceAppId };
    }
    return { sys, win, app: win.appId };
  }
  function displayOf(s) { return (s.sys.display && s.sys.display[s.win.id]) || {}; }
  function ancestors(sys) { const out = rt.ancestors(sys).slice().reverse(); if (out.indexOf(rt.root()) < 0) out.unshift(rt.root()); return out.filter((x) => x && x.id !== sys.id); }
  function targetOptions(sys, win) {
    const list = ancestors(sys); const cur = win.extra.projTarget || (list[0] && list[0].id) || 'outer';
    return '<select class="field sm" data-testid="project-target" data-act="project-target" ' + att(sys, win) + '>' +
      list.map((a) => '<option value="' + a.id + '" data-target-system-id="' + a.id + '"' + (a.id === cur ? ' selected' : '') + '>第' + (a.depth + 1) + '层 ' + esc(a.id) + '</option>').join('') + '</select>';
  }

  // ================================================================ 系统窗口（递归桌面）
  ui.registerApp('system', {
    w: 980, h: 620, title: '子系统',
    mount(sys, win, body, rec) {
      body.innerHTML = '<div style="position:absolute;inset:0;display:flex;flex-direction:column">' +
        '<div class="sysbar"></div><div class="sys-body" style="flex:1;position:relative;overflow:hidden">' +
        '<div class="child-desktop-slot" style="position:absolute;inset:0"></div>' +
        '<div class="ke-overlay"></div></div></div>';
      rec.sysbar = body.querySelector('.sysbar');
      rec.slot = body.querySelector('.child-desktop-slot');
      rec.ke = body.querySelector('.ke-overlay');
      rec.bodyEl = body.querySelector('.sys-body');
    },
    update(sys, win, body, rec) {
      const child = rt.getSystem(win.targetSystemId);
      if (!child) return;
      const st = child.state === 'running' ? (child.paused ? '<span class="pill warn">已暂停</span>' : '<span class="pill ok">运行中</span>')
        : child.state === 'error' ? '<span class="pill err">内核错误</span>' : '<span class="pill">已停止</span>';
      const b = (act, label, tid, extra) => '<button class="btn sm" data-testid="' + tid + '" data-act="' + act + '" ' + att(sys, win, 'data-target-system-id="' + child.id + '" ' + (extra || '')) + '>' + label + '</button>';
      const bar = '<span class="sb-name">◱ ' + esc(child.id) + '</span>' + st +
        '<span class="sb-crumb">第 ' + (child.depth + 1) + ' 层 · 归属 ' + esc(sys.id) + ' · 速率 ' + child.timeScale.toFixed(1) + '× · t=' + child.virtualTime.toFixed(1) + 's</span>' +
        '<span class="grow"></span>' +
        b('system-pause', '暂停', 'system-pause') + b('system-resume', '继续', 'system-resume') + b('system-step', '单步', 'system-step') +
        b('snapshot-create', '快照', 'snapshot-create') + b('kernel-open', '内核源', 'kernel-open') + b('system-restart', '重启', 'system-restart') +
        '<button class="btn sm" data-act="sysbar-minimize" ' + att(sys, win) + '>↑ 返回父桌面</button>';
      setHTML(rec.sysbar, bar);
      // 内核错误覆盖层
      if (child.state === 'error') {
        setHTML(rec.ke, '<div class="kernel-error" data-testid="kernel-error"><div class="ke-ico">⚠</div>' +
          '<h3>内核错误 · ' + esc(child.id) + ' 已停止</h3><div class="muted small">本子系统及其子树停止推进；父系统与兄弟系统照常运行。改回内核源后「重启」即可恢复。</div>' +
          '<code>' + esc(child.kernelError || '') + '</code><div>' + b('kernel-open', '打开内核源', 'kernel-open') + ' ' + b('system-restart', '重启子系统', 'system-restart') + '</div></div>');
        rec.ke.style.display = 'block';
      } else { setHTML(rec.ke, ''); rec.ke.style.display = 'none'; }
    },
  });
  ui.on('sysbar-minimize', ({ sys, win }) => { rt.setWindowState(sys, win.id, 'minimized'); ui.toast('已最小化系统窗口，返回父桌面'); });

  // ================================================================ 三维播放器
  function defaultScenePath(sys) { return sys.fs.nodes['/Demo/helicopter-24.scene'] ? '/Demo/helicopter-24.scene' : '/Demo/minimal.scene'; }
  function readScene(sys, path) { const c = rt.fs.read(sys.fs, path); return (c && c.format === 'npl-scene-1') ? c : clone(OS.data.scene); }

  function spawnPlayerProcs(sys, win) {
    const scene = win.extra.sceneRes;
    const eff = rt.spawn(sys, '/Programs/effects.npl', 'effects', { winId: win.id }, { winId: win.id });
    const flt = rt.spawn(sys, '/Programs/flight.npl', 'flight', { record: win.extra.path, winId: win.id }, { winId: win.id });
    const tl = rt.spawn(sys, '/Programs/timeline.npl', 'timeline', {
      flightPid: flt.pid, effectsPid: eff.pid, position: 0, playing: 0, rate: 1,
      loop: scene.loops ? 1 : 0, duration: scene.duration, frameTime: scene.frameTime, winId: win.id,
    }, { winId: win.id });
    const procs = { timeline: tl.pid, flight: flt.pid, effects: eff.pid };
    win.extra.procs = procs; sys.appStates[win.id] = { procs, scene: scene.name };
    return procs;
  }
  function playerCmd(sys, win, kind, extra) {
    const s = srcOf(sys, win); const p = s.win.extra.procs;
    if (p && p.timeline) rt.injectMessage(s.sys, p.timeline, Object.assign({ kind }, extra || {}));
  }
  function playerControls(sys, win, rec, isProj) {
    const s = srcOf(sys, win); const w = s.win; const d = displayOf(s).clock || {};
    const dis = (!rt.isRunning(s.sys) || w.state === 'error') ? 'disabled' : '';
    const btn = (act, tid, label, extra) => '<button class="btn sm" data-testid="' + tid + '" data-act="' + act + '" ' + att(sys, win, (extra || '') + ' ' + dis) + '>' + label + '</button>';
    const reason = !rt.isRunning(s.sys) ? '<span class="pill err">源子树已暂停 · 内容冻结</span>' : '';
    return '<div class="player-controls">' +
      btn('player-play', 'player-play', '▶ 播放') + btn('player-pause', 'player-pause', '⏸ 暂停') +
      btn('player-stop', 'player-stop', '⏹ 停止') + btn('player-step', 'player-step', '⏭ 逐帧') +
      btn('player-loop', 'player-loop', '循环 ' + (d.loop ? '开' : '关')) +
      '<div class="player-seek"><span class="small muted">进度</span><input type="range" data-testid="player-seek" data-act="player-seek" min="0" max="' + (d.duration || 15) + '" step="0.01" value="' + (d.pos || 0) + '" ' + att(sys, win, dis) + '></div>' +
      '<span class="player-time" data-testid="player-time">' + U.fmtSec(d.pos || 0) + ' / ' + U.fmtSec(d.duration || 15) + '</span>' +
      '<select class="field sm" data-testid="player-rate" data-act="player-rate" ' + att(sys, win, dis) + '>' +
      [0.5, 1, 1.5, 2].map((r) => '<option value="' + r + '"' + (r === (d.rate || 1) ? ' selected' : '') + '>' + r + '×</option>').join('') + '</select>' +
      '<select class="field sm" data-testid="player-camera" data-act="player-camera" ' + att(sys, win) + '>' +
      [['show', '演出镜头'], ['follow', '跟随镜头'], ['orbit', '自由环绕']].map(([k, l]) => '<option value="' + k + '"' + ((rec.cameraState && rec.cameraState.mode) === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
      '<span class="pill">' + esc((displayOf(s).scene || {}).phase || '待机') + '</span>' + reason +
      btn('player-open', 'player-open', '打开场景') +
      (isProj ? '' : '<span class="sep-v"></span>' + targetOptions(s.sys, w) + btn('window-project', 'window-project', '投送')) +
      '</div>';
  }
  function playerHUD(s, rec) {
    const d = displayOf(s), sc = d.scene || {}, eff = d.effects || {};
    return '<div class="player-hud"><div class="ph-phase">' + esc(sc.phase || '待机') + ' · ' + esc((s.win.extra.sceneRes && s.win.extra.sceneRes.name) || '场景') + '</div>' +
      '<div class="ph-line">t = ' + (sc.t || 0).toFixed(2) + 's · 帧率 30fps</div>' +
      '<div class="ph-line">高度 ' + (sc.y || 0).toFixed(1) + ' · 损坏 ' + Math.round((sc.damage || 0) * 100) + '% · 下洗 ' + (eff.downwash || 0).toFixed(2) + '</div>' +
      (d.lagged ? '<div class="ph-line pill warn">物理落后于虚拟时间</div>' : '') + '</div>';
  }

  ui.registerApp('player', {
    w: 900, h: 620, title: '三维场景播放器',
    mount(sys, win, body, rec) {
      if (!win.extra.path) win.extra.path = defaultScenePath(sys);
      if (!win.extra.sceneRes) win.extra.sceneRes = readScene(sys, win.extra.path);
      if (!win.extra.camera) win.extra.camera = { mode: 'show', theta: 0.9, phi: 1.05, radius: 14 };
      if (!win.extra.procs) spawnPlayerProcs(sys, win);
      body.innerHTML = '<div class="player-wrap"><div class="player-view" data-testid="player-view"><div class="player-hud-host"></div>' +
        '<div class="player-sel" data-testid="player-selection">点击部件查看名称与损坏</div>' +
        '<div class="paused-overlay" style="display:none">所属子树已暂停，画面冻结</div></div>' +
        '<div class="player-controls-host"></div>' +
        '<div class="app-toolbar" style="border-top:1px solid var(--line)"><span class="small muted">飞行排演</span>' +
        '<button class="btn sm" data-testid="rehearsal-start" data-act="rehearsal-start" ' + att(sys, win) + '>开始排演</button>' +
        '<label class="small muted">风</label><input class="field sm" style="width:60px" data-testid="rehearsal-wind" data-act="rehearsal-wind" value="0" ' + att(sys, win) + '>' +
        '<label class="small muted">航向</label><input class="field sm" style="width:60px" data-testid="rehearsal-heading" data-act="rehearsal-heading" value="0" ' + att(sys, win) + '>' +
        '<label class="small muted">故障</label><input class="field sm" style="width:60px" data-testid="rehearsal-fault" data-act="rehearsal-fault" value="0" ' + att(sys, win) + '>' +
        '<select class="field sm" data-testid="rehearsal-controller" data-act="rehearsal-controller" ' + att(sys, win) + '></select>' +
        '<button class="btn sm" data-act="rehearsal-save" ' + att(sys, win) + '>保存记录</button>' +
        '<button class="btn sm" data-act="rehearsal-open" ' + att(sys, win) + '>打开记录</button>' +
        '<button class="btn sm" data-act="player-edit-scene" ' + att(sys, win) + '>编辑场景资源</button></div></div>';
      rec.view = body.querySelector('.player-view');
      rec.hudHost = body.querySelector('.player-hud-host');
      rec.sel = body.querySelector('.player-sel');
      rec.controlsHost = body.querySelector('.player-controls-host');
      rec.paused = body.querySelector('.paused-overlay');
      rec.ctrlSel = body.querySelector('[data-testid="rehearsal-controller"]');
      rec.cameraState = win.extra.camera;
      rec.sceneView = new OS.SceneView(rec.view, win.extra.sceneRes, { camera: rec.cameraState });
      // 三维交互：点选 / 环绕 / 缩放
      rec.view.addEventListener('click', (e) => { if (rec._dragging) return; const r = rec.sceneView.canvas.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1;
        const hit = rec.sceneView.pick(nx, ny);
        rec.sel.innerHTML = hit ? ('部件：<b>' + esc(hit.name) + '</b><br>状态：' + esc(hit.damage)) : '点击部件查看名称与损坏';
        if (!hit && win.extra.rehearsal) { const s = srcOf(sys, win); const inp = s.sys.flightBus.input['main'] || (s.sys.flightBus.input['main'] = {}); inp.heading = (nx + 1) * Math.PI; ui.toast('已设置目标航向（点击地面）'); } });
      rec.view.addEventListener('mousedown', (e) => { rec._odown = { x: e.clientX, y: e.clientY, moved: false }; });
      rec.view.addEventListener('mousemove', (e) => { if (!rec._odown) return; const dx = e.clientX - rec._odown.x, dy = e.clientY - rec._odown.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) rec._odown.moved = true;
        if (rec.cameraState.mode === 'orbit') rec.sceneView.orbit(dx, dy);
        rec._odown.x = e.clientX; rec._odown.y = e.clientY; });
      rec.view.addEventListener('mouseup', () => { rec._dragging = rec._odown && rec._odown.moved; rec._odown = null; setTimeout(() => rec._dragging = false, 60); });
      rec.view.addEventListener('wheel', (e) => { if (rec.cameraState.mode === 'orbit') { rec.sceneView.zoom(e.deltaY); e.preventDefault(); } }, { passive: false });
    },
    update(sys, win, body, rec) {
      const s = srcOf(sys, win), d = displayOf(s);
      rec.sceneView.setState(Object.assign({}, d.scene || {}, d.effects || {}));
      setHTML(rec.hudHost, playerHUD(s, rec));
      setHTML(rec.controlsHost, playerControls(sys, win, rec, false));
      rec.paused.style.display = (!rt.isRunning(s.sys) ? 'flex' : 'none');
      const ctlFiles = []; for (const p in sys.fs.nodes) if (sys.fs.nodes[p].type === 'file' && /controller|飞控/.test(p)) ctlFiles.push(p);
      if (!ctlFiles.length) ctlFiles.push('/Programs/controller.npl');
      const opts = ctlFiles.map((p) => '<option value="' + esc(p) + '">' + esc(p) + '</option>').join('');
      if (rec.ctrlSel._c !== opts) { rec.ctrlSel.innerHTML = opts; rec.ctrlSel._c = opts; }
    },
    destroy(rec) { if (rec.sceneView) rec.sceneView.dispose(); },
  });
  ui.on('player-play', ({ sys, win }) => { const s = srcOf(sys, win), d = displayOf(s).clock; if (d && d.pos >= d.duration - 0.01) playerCmd(sys, win, 'seek', { t: 0 }); playerCmd(sys, win, 'play'); });
  ui.on('player-pause', ({ sys, win }) => playerCmd(sys, win, 'pause'));
  ui.on('player-stop', ({ sys, win }) => playerCmd(sys, win, 'stop'));
  ui.on('player-step', ({ sys, win }) => playerCmd(sys, win, 'stepf'));
  ui.on('player-loop', ({ sys, win }) => { const s = srcOf(sys, win); playerCmd(sys, win, 'loop', { v: displayOf(s).clock && displayOf(s).clock.loop ? 0 : 1 }); });
  ui.on('change:player-seek', ({ sys, win, el }) => playerCmd(sys, win, 'seek', { t: parseFloat(el.value) || 0 }));
  ui.on('change:player-rate', ({ sys, win, el }) => playerCmd(sys, win, 'rate', { v: parseFloat(el.value) || 1 }));
  ui.on('change:player-camera', ({ sys, win, el }) => { const rec = ui.winEls[win.id]; if (rec && rec.cameraState) rec.cameraState.mode = el.value; });
  ui.on('player-open', ({ sys, win }) => {
    const files = []; for (const p in sys.fs.nodes) if (sys.fs.nodes[p].type === 'file' && sys.fs.nodes[p].mime === 'scene') files.push(p);
    ui.dialog = { title: '打开场景资源', html: '<div class="small muted" style="margin-bottom:8px">场景是独立数据文件；更改资源并重新打开后画面按文件内容变化。</div>' +
      files.map((p) => '<div class="files-nav" data-act="player-open-pick" ' + att(sys, win, 'data-file-path="' + esc(p) + '"') + '>' + icon('scene') + ' ' + esc(p) + '</div>').join(''),
      buttons: [{ label: '取消', act: () => ui.dialog = null }] };
  });
  ui.on('player-open-pick', ({ sys, win, ds }) => {
    ui.dialog = null; win.extra.path = ds.filePath; win.extra.sceneRes = readScene(sys, ds.filePath);
    const rec = ui.winEls[win.id]; if (rec && rec.sceneView) { rec.sceneView.dispose(); rec.sceneView = new OS.SceneView(rec.view, win.extra.sceneRes, { camera: rec.cameraState }); }
    // 重新拉起进程（新资源/新时长）
    for (const k in (win.extra.procs || {})) { const p = sys.procs[win.extra.procs[k]]; if (p) p.status = 'done'; }
    spawnPlayerProcs(sys, win); ui.toast('已打开场景 ' + rt.fs.base(ds.filePath));
  });
  ui.on('player-edit-scene', ({ sys, win }) => ui.openApp(sys, 'editor', { extra: { path: win.extra.path }, title: '场景资源 · ' + rt.fs.base(win.extra.path) }));
  ui.on('change:project-target', ({ win, el }) => { win.extra.projTarget = el.value; });
  ui.on('window-project', ({ sys, win }) => {
    const tid = win.extra.projTarget || (ancestors(sys)[0] && ancestors(sys)[0].id) || 'outer';
    const p = rt.projectWindow(sys, win.id, tid);
    if (p) ui.toast('已投送到 ' + tid + ' 桌面');
  });

  // ---- 飞行排演 ----
  ui.on('rehearsal-start', ({ sys, win }) => {
    const rec = ui.winEls[win.id];
    const ctlPath = (rec && rec.ctrlSel && rec.ctrlSel.value) || '/Programs/controller.npl';
    // 结束演出三进程
    for (const k in (win.extra.procs || {})) { const p = sys.procs[win.extra.procs[k]]; if (p) p.status = 'done'; }
    const ctrl = rt.spawn(sys, ctlPath, 'controller', { channel: 'main', targetY: 3, period: 0.05, winId: win.id }, { winId: win.id });
    const phy = rt.spawn(sys, '/Programs/physics.npl', 'physics', { winId: win.id }, { winId: win.id });
    win.extra.procs = { timeline: null, flight: phy.pid, effects: null, controller: ctrl.pid, physics: phy.pid };
    win.extra.rehearsal = true;
    sys.flightBus.input['main'] = { wind: 0, heading: 0, fault: 0, targetY: 3 };
    sys.flightBus.control['main'] = { collective: 0.5, cyclic: 0, pedal: 0, t: 0 };
    rt.notify(sys, '飞行排演', '已开始：物理随虚拟时间连续演化，飞控进程保持飞行');
    ui.toast('排演已开始，可降低祖先拨付/运行持续计算观察失稳');
  });
  function setFlightInput(sys, key, v) { const m = sys.flightBus.input['main'] || (sys.flightBus.input['main'] = {}); m[key] = v; }
  ui.on('change:rehearsal-wind', ({ sys, el }) => setFlightInput(sys, 'wind', parseFloat(el.value) || 0));
  ui.on('change:rehearsal-heading', ({ sys, el }) => setFlightInput(sys, 'heading', parseFloat(el.value) || 0));
  ui.on('change:rehearsal-fault', ({ sys, el }) => setFlightInput(sys, 'fault', parseFloat(el.value) || 0));
  ui.on('input:rehearsal-wind', ({ sys, el }) => setFlightInput(sys, 'wind', parseFloat(el.value) || 0));
  ui.on('input:rehearsal-heading', ({ sys, el }) => setFlightInput(sys, 'heading', parseFloat(el.value) || 0));
  ui.on('input:rehearsal-fault', ({ sys, el }) => setFlightInput(sys, 'fault', parseFloat(el.value) || 0));
  ui.on('rehearsal-save', ({ sys, win }) => {
    const d = sys.display[win.id] || {};
    const rec = { format: 'npl-rehearsal-1', scene: win.extra.path, at: Date.now(), input: clone(sys.flightBus.input['main'] || {}),
      control: clone(sys.flightBus.control['main'] || {}), state: clone(d.scene || {}), controller: (win.extra.procs || {}).controller };
    rt.fs.write(sys.fs, '/Flight/排演记录.json', rec, 'json');
    rt.notify(sys, '排演记录', '已保存 /Flight/排演记录.json'); ui.toast('排演记录已保存为本系统文件');
  });
  ui.on('rehearsal-open', ({ sys, win }) => {
    const c = rt.fs.read(sys.fs, '/Flight/排演记录.json');
    if (!c) return ui.toast('没有可打开的排演记录', true);
    sys.flightBus.input['main'] = clone(c.input || {}); sys.flightBus.control['main'] = clone(c.control || {});
    if (c.state) sys.display[win.id] = Object.assign(sys.display[win.id] || {}, { scene: c.state });
    ui.dialog = { title: '排演记录已打开', body: '记录保留场景资源、初态、实际输入与控制时序。可使用播放器进度跳转/回放；从同一位置可给出不同输入继续排演，分别保存。',
      buttons: [{ label: '知道了', primary: true, act: () => ui.dialog = null }] };
  });

  // ================================================================ 图表工作台
  function spawnChartProcs(sys, win) {
    const comp = rt.spawn(sys, '/Programs/chartCompute.npl', 'chartCompute', { winId: win.id }, { winId: win.id });
    const recv = rt.spawn(sys, '/Programs/chartReceiver.npl', 'chartReceiver', { chartPid: comp.pid, winId: win.id }, { winId: win.id });
    win.extra.chartPid = comp.pid; win.extra.receiverPid = recv.pid;
    sys.appStates[win.id] = { chartPid: comp.pid, receiverPid: recv.pid };
    return recv.pid;
  }
  function chartSVG(ch, type) {
    if (!ch || !ch.values) return '<div class="charts-empty">建立实时数据连接后显示图表</div>';
    const W = 820, H = 430, pad = { l: 60, r: 24, t: 54, b: 46 };
    const labels = ch.labels || [], vals = (ch.values || []).map((v) => +v || 0);
    const max = Math.max(1, ...vals) * 1.15;
    const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
    const n = vals.length || 1;
    const bw = plotW / n;
    let g = '';
    for (let i = 0; i <= 4; i++) { const y = pad.t + plotH * (i / 4); const v = max * (1 - i / 4);
      g += '<line x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '" stroke="rgba(255,255,255,.12)" stroke-dasharray="4 4"/>';
      g += '<text x="' + (pad.l - 8) + '" y="' + (y + 4) + '" fill="#9aa" font-size="11" text-anchor="end">' + v.toFixed(0) + '</text>'; }
    g += '<line x1="' + pad.l + '" y1="' + pad.t + '" x2="' + pad.l + '" y2="' + (pad.t + plotH) + '" stroke="rgba(255,255,255,.35)"/>';
    g += '<line x1="' + pad.l + '" y1="' + (pad.t + plotH) + '" x2="' + (W - pad.r) + '" y2="' + (pad.t + plotH) + '" stroke="rgba(255,255,255,.35)"/>';
    const colors = ['#8b5cf6', '#22b8a6', '#f0a02a', '#ec5f8a', '#4a9bf0'];
    if (type === 'line') {
      let pts = vals.map((v, i) => (pad.l + bw * (i + 0.5)) + ',' + (pad.t + plotH * (1 - v / max))).join(' ');
      g += '<polyline points="' + pts + '" fill="none" stroke="#8b5cf6" stroke-width="3"/>';
      vals.forEach((v, i) => { const x = pad.l + bw * (i + 0.5), y = pad.t + plotH * (1 - v / max);
        g += '<circle cx="' + x + '" cy="' + y + '" r="6" fill="#fbbf24" stroke="#fff" stroke-width="2"><title>' + esc(labels[i] || '') + '：' + v + '</title></circle>';
        g += '<text x="' + x + '" y="' + (y - 12) + '" fill="#fff" font-size="12" text-anchor="middle">' + v + '</text>'; });
    } else {
      vals.forEach((v, i) => { const h = plotH * (v / max), x = pad.l + bw * i + bw * 0.18, y = pad.t + plotH - h, w = bw * 0.64;
        g += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" fill="' + colors[i % colors.length] + '"><title>' + esc(labels[i] || '') + '：' + v + '</title></rect>';
        g += '<text x="' + (x + w / 2) + '" y="' + (y - 6) + '" fill="#fff" font-size="12" text-anchor="middle">' + v + '</text>'; });
    }
    labels.forEach((l, i) => { g += '<text x="' + (pad.l + bw * (i + 0.5)) + '" y="' + (H - pad.b + 20) + '" fill="#c9cde8" font-size="11" text-anchor="middle">' + esc(String(l).slice(0, 8)) + '</text>'; });
    g += '<text x="' + (W / 2) + '" y="26" fill="#eef0fb" font-size="15" text-anchor="middle" font-weight="600">' + esc(ch.title || '实时图表') + '</text>';
    g += '<rect x="' + (W - pad.r - 120) + '" y="' + (pad.t - 30) + '" width="12" height="12" rx="2" fill="#8b5cf6"/><text x="' + (W - pad.r - 102) + '" y="' + (pad.t - 20) + '" fill="#a9b0cc" font-size="11">' + (type === 'line' ? '折线图' : '分组柱状图') + ' · 版本 ' + (ch.version || 0) + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' + g + '</svg>';
  }
  function rootSheets() { const out = []; const root = rt.root(); for (const p in root.fs.nodes) if (root.fs.nodes[p].type === 'file' && root.fs.nodes[p].mime === 'sheet') out.push(p); return out; }
  function colToIndex(s) { s = (s || 'A').toUpperCase().trim(); let c = 0; for (const ch of s) c = c * 26 + (ch.charCodeAt(0) - 64); return c - 1; }
  function chartCfg(sys, win, isProj) {
    const s = srcOf(sys, win), w = s.win, e = w.extra;
    const dis = (!rt.isRunning(s.sys)) ? 'disabled' : '';
    const sheets = rootSheets();
    const sel = '<select class="field sm" data-testid="chart-source" data-act="chart-source" ' + att(sys, win, dis) + '>' +
      sheets.map((p) => '<option value="' + esc(p) + '"' + (p === e.source ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select>';
    const f = (tid, val, extra) => '<input class="field sm" style="width:96px" data-testid="' + tid + '" data-act="' + tid + '" value="' + esc(val) + '" ' + att(sys, win, (extra || '') + ' ' + dis) + '>';
    const typ = '<select class="field sm" data-testid="chart-type" data-act="chart-type" ' + att(sys, win, dis) + '>' +
      [['bar', '分组柱状图'], ['line', '折线图']].map(([k, l]) => '<option value="' + k + '"' + (e.chartType === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>';
    const c = e.connId ? rt.getConnections()[e.connId] : null;
    const state = c ? c.state : (e.connId ? 'disconnected' : '未连接');
    return '<div class="charts-cfg">' +
      '<div><label>工作簿</label>' + sel + '</div>' +
      '<div><label>区域</label>' + f('chart-range', e.range || 'A1:D4') + '</div>' +
      '<div><label>标签列</label>' + f('chart-label-column', e.labelCol || 'A') + '</div>' +
      '<div><label>数值列(逗号分隔)</label>' + f('chart-series', e.series || 'D') + '</div>' +
      '<div><label>类型</label>' + typ + '</div>' +
      '<button class="btn sm primary" data-testid="chart-connect" data-act="chart-connect" ' + att(sys, win, dis) + '>连接</button>' +
      '<button class="btn sm" data-testid="chart-disconnect" data-act="chart-disconnect" ' + att(sys, win) + '>断开</button>' +
      '<span class="pill ' + (state === 'connected' ? 'ok' : state === 'restored' ? 'warn' : '') + '">' + esc(state) + '</span>' +
      (isProj ? '' : '<span class="sep-v"></span>' + targetOptions(s.sys, w) + '<button class="btn sm" data-testid="window-project" data-act="window-project" ' + att(sys, win) + '>投送到祖先桌面</button>') +
      '</div>';
  }
  ui.registerApp('charts', {
    w: 860, h: 560, title: '图表工作台',
    mount(sys, win, body, rec) {
      if (!win.extra.source) win.extra.source = '/Demo/sample.sheet';
      if (!win.extra.range) win.extra.range = 'A1:D4';
      if (!win.extra.labelCol) win.extra.labelCol = 'A';
      if (!win.extra.series) win.extra.series = 'D';
      if (!win.extra.chartType) win.extra.chartType = 'bar';
      if (!win.extra.receiverPid) spawnChartProcs(sys, win);
      body.innerHTML = '<div class="charts-wrap"><div class="charts-cfg-host"></div><div class="charts-view" data-testid="charts-view"></div>' +
        '<div class="status-line" data-testid="chart-status"></div></div>';
      rec.cfgHost = body.querySelector('.charts-cfg-host');
      rec.view = body.querySelector('.charts-view');
      rec.status = body.querySelector('[data-testid="chart-status"]');
    },
    update(sys, win, body, rec) {
      const s = srcOf(sys, win), d = displayOf(s), ch = d.chart;
      setHTML(rec.cfgHost, chartCfg(sys, win, false));
      setHTML(rec.view, chartSVG(ch, (s.win.extra.chartType || 'bar')));
      const c = s.win.extra.connId ? rt.getConnections()[s.win.extra.connId] : null;
      rec.status.textContent = '连接：' + (c ? c.state : '未连接') + ' · ' + (ch ? ('版本 ' + ch.version + ' · 处理工作量 ' + ch.work + ' · 数据点 ' + (ch.values || []).length) : '等待数据版本');
    },
    destroy(rec) {},
  });
  function cfgVal(sys, win, tid) { const el = document.querySelector('[data-window-id="' + win.id + '"] [data-testid="' + tid + '"]'); return el ? el.value : null; }
  ui.on('change:chart-source', ({ sys, win, el }) => { const s = srcOf(sys, win); s.win.extra.source = el.value; });
  ['chart-range', 'chart-label-column', 'chart-series'].forEach((tid) => {
    const key = tid === 'chart-range' ? 'range' : tid === 'chart-label-column' ? 'labelCol' : 'series';
    const fn = ({ sys, win, el }) => { const s = srcOf(sys, win); s.win.extra[key] = el.value; };
    ui.on('change:' + tid, fn); ui.on('input:' + tid, fn);
  });
  ui.on('change:chart-type', ({ sys, win, el }) => {
    const s = srcOf(sys, win); s.win.extra.chartType = el.value;
    const c = s.win.extra.connId ? rt.getConnections()[s.win.extra.connId] : null;
    if (c) { c.chartType = el.value; const root = rt.root(), wb = rt.getWorkbook(root, s.win.extra.source); if (wb) rt.publishWorkbook(root, s.win.extra.source, wb); }
    else if (s.sys.display[s.win.id] && s.sys.display[s.win.id].chart) s.sys.display[s.win.id].chart.type = el.value;
  });
  ui.on('chart-connect', ({ sys, win }) => {
    const s = srcOf(sys, win), e = s.win.extra;
    const rc = U.rangeCells(e.range);
    if (!rc) return ui.toast('区域格式无效（如 A1:D4）', true);
    const seriesCols = String(e.series).split(',').map((x) => colToIndex(x)).filter((x) => x >= rc.c1 && x <= rc.c2);
    if (!seriesCols.length) return ui.toast('数值列需在选区内', true);
    if (e.connId) rt.disconnectChart(e.connId);
    const cid = rt.connectChart({
      systemId: s.sys.id, winId: s.win.id, workbook: e.source, sourceSystem: 'outer',
      sourceTitle: rt.fs.base(e.source), range: e.range, labelCol: colToIndex(e.labelCol) - rc.c1,
      seriesCols: seriesCols.map((x) => x - rc.c1), chartType: e.chartType, headerRow: 0,
      receiverPid: e.receiverPid, title: e.source + ' ' + e.range, version: 0, state: 'connected',
    });
    e.connId = cid;
    const root = rt.root(), wb = rt.getWorkbook(root, e.source);
    if (wb) rt.publishWorkbook(root, e.source, wb);
    ui.toast('已建立实时连接 · 取得选区当前完整值');
  });
  ui.on('chart-disconnect', ({ sys, win }) => { const s = srcOf(sys, win); if (s.win.extra.connId) { rt.disconnectChart(s.win.extra.connId); s.win.extra.connId = null; ui.toast('已断开连接，保留最后图表'); } });

  // ================================================================ 跨层投送窗口
  ui.registerApp('projection', {
    w: 760, h: 540, title: '投送窗口',
    mount(sys, win, body, rec) {
      const s = srcOf(sys, win);
      if (s.app === 'player') {
        const sceneRes = (s.win.extra && s.win.extra.sceneRes) || clone(OS.data.scene);
        rec.cameraState = (s.win.extra && s.win.extra.camera) || { mode: 'show', theta: 0.9, phi: 1.05, radius: 14 };
        body.innerHTML = '<div class="player-wrap"><div class="player-view" data-testid="player-view"><div class="player-hud-host"></div>' +
          '<div class="player-sel" data-testid="player-selection">点击部件查看</div><div class="paused-overlay" style="display:none">源子树已暂停 · 内容冻结</div></div>' +
          '<div class="player-controls-host"></div></div>';
        rec.view = body.querySelector('.player-view'); rec.hudHost = body.querySelector('.player-hud-host');
        rec.sel = body.querySelector('.player-sel'); rec.controlsHost = body.querySelector('.player-controls-host'); rec.paused = body.querySelector('.paused-overlay');
        rec.sceneView = new OS.SceneView(rec.view, sceneRes, { camera: rec.cameraState });
        rec.view.addEventListener('click', (e) => { const r = rec.sceneView.canvas.getBoundingClientRect(); const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1;
          const hit = rec.sceneView.pick(nx, ny); rec.sel.innerHTML = hit ? ('部件：<b>' + esc(hit.name) + '</b> · ' + esc(hit.damage)) : '点击部件查看'; });
        rec.view.addEventListener('wheel', (e) => { if (rec.cameraState.mode === 'orbit') { rec.sceneView.zoom(e.deltaY); e.preventDefault(); } }, { passive: false });
      } else {
        body.innerHTML = '<div class="charts-wrap"><div class="charts-cfg-host"></div><div class="charts-view" data-testid="charts-view"></div><div class="status-line" data-testid="chart-status"></div></div>';
        rec.cfgHost = body.querySelector('.charts-cfg-host'); rec.view = body.querySelector('.charts-view'); rec.status = body.querySelector('[data-testid="chart-status"]');
      }
    },
    update(sys, win, body, rec) {
      const s = srcOf(sys, win), d = displayOf(s);
      if (!s.win || s.win.appId === 'system') return;
      if (s.app === 'player') {
        rec.sceneView.setState(Object.assign({}, d.scene || {}, d.effects || {}));
        setHTML(rec.hudHost, playerHUD(s, rec));
        setHTML(rec.controlsHost, playerControls(sys, win, rec, true));
        rec.paused.style.display = (!rt.isRunning(s.sys) ? 'flex' : 'none');
      } else {
        setHTML(rec.cfgHost, chartCfg(sys, win, true));
        setHTML(rec.view, chartSVG(d.chart, s.win.extra.chartType || 'bar'));
        rec.status.textContent = '投送视图 · 来源 ' + esc(s.sys.id) + ' · ' + (d.chart ? '版本 ' + d.chart.version : '等待数据');
      }
      // 来源标识
      const tag = rec.root.querySelector('.wt-tag'); if (tag) tag.textContent = '← ' + s.sys.id + '/' + s.win.title;
    },
    destroy(rec) { if (rec.sceneView) rec.sceneView.dispose(); },
  });

  // 关闭投送窗口只取消视图（closeWindow 已按此处理）；这里给出取消入口
  ui.on('project-close', ({ sys, win }) => rt.closeWindow(sys, win.id));

  // ================================================================ 重启后重新拉起应用进程
  OS.rt._respawnHook = function (sys, w) {
    if (w.appId === 'player') { w.extra.procs = null; spawnPlayerProcs(sys, w); }
    else if (w.appId === 'charts') { w.extra.receiverPid = null; w.extra.chartPid = null; spawnChartProcs(sys, w);
      if (w.extra.connId) { const c = rt.getConnections()[w.extra.connId]; if (c) { c.receiverPid = w.extra.receiverPid; c.state = 'restored'; } } }
    else if (w.appId === 'browser') { /* webview 由 DOM 持久持有，无需重建 */ }
  };
})(window.OS = window.OS || {});
