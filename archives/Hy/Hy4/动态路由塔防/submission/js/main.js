/* 动态路由塔防 · 主控制器
 * 主循环 / 交互 / 演示编排 / window.videoExport 确定性逐帧接口 */
(function () {
  'use strict';
  var TD = window.TD;
  var Data = TD.Data, Maps = TD.Maps, Game = TD.Game, UI = TD.UI, Audio = TD.Audio;
  var DT = Data.DT;
  var canvas = document.getElementById('gl');
  var renderer, scene, orbit;
  var state = null, menuState = null, mode = 'menu', exportMode = false, exportFps = 30;
  var view = { selected: null, hover: null, deploy: null, itemMode: null, range: null, previewRoutes: null, rejectCells: null, showRoutes: true, demoCard: null };
  var acc = 0, lastNow = 0, dragging = false, dragButton = -1, lastX = 0, lastY = 0;
  var demo = null, menuTime = 0;
  var camLerp = { active: false, yaw: 0, pitch: 0, dist: 0, target: [0, 0, 0] };
  var cursorPos = { x: 0, y: 0 }, cursorTarget = null, cursorPress = false, cursorVisible = false;

  // ---------------- 初始化 ----------------
  function init() {
    renderer = new TD.Renderer(canvas);
    scene = new TD.Scene(renderer);
    orbit = new TD.Orbit();
    menuState = Game.create('intranet', { seed: 1 });
    scene.buildStatic(menuState.map);
    UI.init();
    resize();
    bindInput();
    lastNow = performance.now();
    requestAnimationFrame(loop);
  }

  function resize() {
    var w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    // 导出模式严格按调用方设置的窗口像素，不额外乘设备像素比（适配最高 3840×2160）
    var dpr = exportMode ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.resize(w, h, dpr);
  }
  function resetView() {
    view.selected = null; view.hover = null; view.deploy = null; view.itemMode = null;
    view.range = null; view.previewRoutes = null; view.rejectCells = null; view.demoCard = null;
    cursorVisible = false;
  }
  function defaultOrbit() {
    orbit.yaw = 0.62; orbit.pitch = 0.80; orbit.dist = 42;
    orbit.target = [0, 0, 0];
  }

  // ---------------- 场景 / 模式切换 ----------------
  function startMap(mapId) {
    exitExportIfAny();
    state = Game.create(mapId, { seed: 20261106 });
    mode = 'battle'; exportMode = false; demo = null;
    scene.buildStatic(state.map);
    defaultOrbit(); resetView(); acc = 0;
    UI.setScreen('battle');
    Audio.unlock(); Audio.startAmbience(state.map.env.ambience);
    UI.toast('战区已接入：' + state.map.name + ' · 拖动卡片部署设备', 'good');
  }
  function backToMenu() {
    exitExportIfAny();
    mode = 'menu'; state = null; demo = null; exportMode = false;
    scene.buildStatic(menuState.map);
    defaultOrbit(); resetView();
    UI.setScreen('menu');
    Audio.stopAmbience();
  }
  function restart() { if (state) startMap(state.mapId); else startMap('intranet'); }

  // ---------------- 主循环 ----------------
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
    resize();
    if (mode === 'menu') {
      menuTime += dt; orbit.yaw += dt * 0.06;
    } else if (!exportMode && (mode === 'battle' || mode === 'demo')) {
      var s = state;
      if (!s.paused && s.phase === 'battle') {
        acc += dt * s.speed;
        var steps = 0;
        while (acc >= DT && steps < 24) { advanceOneStep(false); acc -= DT; steps++; }
      } else acc = 0;
    }
    render();
  }

  function advanceOneStep(isExport) {
    Game.step(state);
    if (mode === 'demo') processDemoStep(state);
    consumeEvents(state, isExport);
    checkPhase(isExport);
  }

  function consumeEvents(s, isExport) {
    for (var i = 0; i < s.events.length; i++) {
      var ev = s.events[i];
      if (!isExport) {
        var sound = ({ build: 'build', upgrade: 'upgrade', skill: 'skill', item: 'item', kill: 'kill',
          leak: 'leak', isolate: 'isolate', bypass: 'bypass', routeChange: 'routeChange',
          warning: 'warning', bossphase: 'bossphase', spawn: 'spawn', waveStart: 'waveStart',
          waveEnd: 'waveEnd', win: 'win', lose: 'lose', rejected: 'rejected' })[ev.type];
        if (sound) Audio.play(sound, ev);
      }
      if (ev.type === 'rejected' && mode === 'battle') { view.rejectCells = ev.bad; UI.toast('操作被拒：该变化会封死通路', 'bad'); setTimeout(function () { view.rejectCells = null; }, 1800); }
      else if (ev.type === 'bossphase' && mode === 'battle') UI.toast('核心威胁换阶段：' + ev.name, 'bad');
      else if (ev.type === 'waveStart' && mode === 'battle') UI.toast('第 ' + ev.wave + ' 波来袭');
    }
    s.events.length = 0;
  }
  function checkPhase(isExport) {
    if (mode === 'battle' && (state.phase === 'win' || state.phase === 'lose')) {
      if (!isExport) UI.showReport(state);
      mode = 'report';
    }
    if (mode === 'demo' && demo && state.time >= demo.duration) finishDemo(isExport);
  }

  function render() {
    var s = state || menuState;
    var w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (mode === 'demo' || exportMode) {
      // 相机 / 虚拟鼠标平滑（固定步长，保证导出确定性）
      var k = Math.min(1, DT * 2.6);
      if (camLerp.active) {
        orbit.yaw += (camLerp.yaw - orbit.yaw) * k;
        orbit.pitch += (camLerp.pitch - orbit.pitch) * k;
        orbit.dist += (camLerp.dist - orbit.dist) * k;
        for (var c = 0; c < 3; c++) orbit.target[c] += (camLerp.target[c] - orbit.target[c]) * k;
      }
      if (cursorTarget) {
        var dx = cursorTarget.x - cursorPos.x, dy = cursorTarget.y - cursorPos.y, dd = Math.hypot(dx, dy), sp = 1500 * DT;
        if (dd > sp) { cursorPos.x += dx / dd * sp; cursorPos.y += dy / dd * sp; }
        else { cursorPos.x = cursorTarget.x; cursorPos.y = cursorTarget.y; }
      }
      UI.demoCursor(cursorPos.x, cursorPos.y, cursorPress, cursorVisible);
      if (demo) UI.demoHud(demo.name, Math.min(state.time, demo.duration), demo.duration);
    }
    updateView();
    scene.frame(s, orbit, view);
    UI.render(s, scene, view, w, h);
  }

  // ---------------- 视图状态 ----------------
  function updateView() {
    var s = state; if (!s) { view.range = null; view.previewRoutes = null; return; }
    view.range = null; view.previewRoutes = null;
    var hv = view.hover;
    if (view.deploy && hv) {
      var def = Data.TOWERS[view.deploy.type];
      var c = hx(def.color);
      if (def.range && def.range[0] > 0) view.range = { x: hv.wx, z: hv.wz, r: def.range[0] * s.map.CELL, color: c };
      if (tileIsNode(s, hv.x, hv.z) && (view.deploy.type === 'gateway' || view.deploy.type === 'firewall')) {
        var pv = Game.isolatePreview(s, s.map.nodeAt[Game.cellKey({ x: hv.x, z: hv.z })]);
        if (pv.ok && pv.routes) view.previewRoutes = pv.routes;
        else if (!pv.ok && pv.bad) view.rejectCells = pv.bad;
      }
      if (view.deploy.type === 'interceptor') view.range = { x: hv.wx, z: hv.wz, r: 3.6 * s.map.CELL, color: c };
    } else if (view.itemMode && hv) {
      var it = Data.ITEMS[view.itemMode];
      if (it.radius) view.range = { x: hv.wx, z: hv.wz, r: it.radius * s.map.CELL, color: hx(it.color) };
      if (view.itemMode === 'isolator' && tileIsNode(s, hv.x, hv.z)) {
        var pv2 = Game.isolatePreview(s, s.map.nodeAt[Game.cellKey({ x: hv.x, z: hv.z })]);
        if (pv2.ok && pv2.routes) view.previewRoutes = pv2.routes;
        else if (!pv2.ok && pv2.bad) view.rejectCells = pv2.bad;
      }
    } else if (view.selected && view.selected.kind === 'tower') {
      var t = Game.findTower(s, view.selected.id);
      if (t && t.def.range && t.def.range[t.lvl - 1] > 0) view.range = { x: Maps.wx(s.map, t.x), z: Maps.wz(s.map, t.z), r: t.rangeNow * s.map.CELL, color: hx(t.def.color) };
    }
  }
  function hx(h) { return TD.col.hex(h); }
  function tileIsNode(s, x, z) { var t = Game.tileAt(s, x, z); return t && t.t === 'N'; }

  // ---------------- 拾取 ----------------
  function pickCell(sx, sy) {
    var s = state || menuState, map = s.map, w = canvas.clientWidth, h = canvas.clientHeight;
    var best = null, bd = 1e9;
    for (var z = 0; z < map.H; z++) for (var x = 0; x < map.W; x++) {
      var t = map.grid[z][x].t;
      if (t === '.') continue;
      var yy = t === 'P' ? 0.5 : 0.14;
      var p = scene.project(Maps.wx(map, x), yy, Maps.wz(map, z), w, h);
      if (!p) continue;
      var d = Math.hypot(p.x - sx, p.y - sy);
      if (d < bd) { bd = d; best = { x: x, z: z, wx: Maps.wx(map, x), wz: Maps.wz(map, z) }; }
    }
    var p0 = scene.project(Maps.wx(map, 0), 0, Maps.wz(map, 0), w, h);
    var p1 = scene.project(Maps.wx(map, 1), 0, Maps.wz(map, 0), w, h);
    var cellPx = (p0 && p1) ? Math.max(8, Math.hypot(p1.x - p0.x, p1.y - p0.y)) : 24;
    if (bd > cellPx * 1.05) return null;
    return best;
  }
  function pickEnemy(sx, sy) {
    var s = state; if (!s) return null;
    var w = canvas.clientWidth, h = canvas.clientHeight, best = null, bd = 26;
    for (var i = 0; i < s.enemies.length; i++) {
      var e = s.enemies[i]; if (e.dying) continue;
      var p = Game.enemyPos(s, e), sp = scene.project(p.x, p.y + 0.5, p.z, w, h);
      if (!sp) continue;
      var d = Math.hypot(sp.x - sx, sp.y - sy);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------------- 输入 ----------------
  function bindInput() {
    window.addEventListener('resize', resize);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); cancelAction(); });
    window.addEventListener('pointerdown', function (e) {
      Audio.unlock();
      if (e.button === 1 || (e.button === 0 && e.shiftKey && (mode === 'menu' || !view.deploy))) {
        dragButton = e.shiftKey ? 2 : 1; lastX = e.clientX; lastY = e.clientY; e.preventDefault(); return;
      }
      if (e.target === canvas && e.button === 0) onCanvasDown(e.clientX, e.clientY);
    });
    window.addEventListener('pointermove', function (e) {
      if (dragButton > 0) {
        var dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
        if (dragButton === 2) orbit.pan(dx, dy); else orbit.rotate(dx, dy);
        return;
      }
      if (mode !== 'battle' && mode !== 'demo') return;
      var c = pickCell(e.clientX, e.clientY);
      view.hover = c;
      if (c) view.hoverValid = !!(view.deploy || view.itemMode);
      // 拦截器朝向跟随鼠标
      if (view.deploy && view.deploy.phase === 'facing' && c) {
        view.deploy.facing = Math.atan2(e.clientX - (canvas.clientWidth / 2), e.clientY - (canvas.clientHeight / 2)) + Math.PI;
      }
      updateView();
    });
    window.addEventListener('pointerup', function (e) {
      if (dragButton > 0) { dragButton = 0; return; }
      if (dragging && (view.deploy || view.itemMode) && e.target === canvas) {
        dragging = false;
        onCanvasDown(e.clientX, e.clientY);
      }
    });
    canvas.addEventListener('wheel', function (e) { orbit.zoom(e.deltaY); e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', function (e) {
      Audio.unlock();
      if (e.code === 'Space') { e.preventDefault(); togglePause(); }
      else if (e.key === '1' || e.key === '2' || e.key === '3') { if (state) { state.speed = +e.key; UI.toast('速度 ' + e.key + '×'); } }
      else if (e.key === 'f' || e.key === 'F') defaultOrbit();
      else if (e.key === 'Escape') cancelAction();
      else if (e.key === 'r' || e.key === 'R') { if (mode === 'battle' || mode === 'demo') restart(); }
    });
  }

  function onCanvasDown(sx, sy) {
    if (mode === 'menu') return;
    if (exportMode) return;
    var s = state; if (!s) return;
    var c = pickCell(sx, sy);
    if (view.deploy) {
      if (!c) { UI.toast('请投放到有效地块', 'bad'); return; }
      if (view.deploy.type === 'interceptor' && view.deploy.phase !== 'facing') {
        view.deploy.phase = 'facing'; view.deploy.fx = c.wx; view.deploy.fz = c.wz;
        UI.toast('移动鼠标设定朝向，左键确认 / Esc 取消'); return;
      }
      var r = Game.build(s, view.deploy.type, c.x, c.z, view.deploy.facing || 0);
      if (r.ok) { Audio.play('build'); UI.toast(Data.TOWERS[view.deploy.type].name + ' 已部署' + (c.t === 'N' ? ' · 节点隔离，路线已收敛' : ''), 'good'); cancelDeploy(); }
      else { UI.toast(r.reason, 'bad'); Audio.play('rejected'); }
      return;
    }
    if (view.itemMode) {
      if (!c) { UI.toast('请选择投放位置', 'bad'); return; }
      var ri = Game.useItem(s, view.itemMode, c.x, c.z);
      if (ri.ok) { UI.toast(Data.ITEMS[view.itemMode].name + ' 已生效', 'good'); cancelDeploy(); }
      else { UI.toast(ri.reason, 'bad'); Audio.play('rejected'); }
      return;
    }
    // 选中
    var en = pickEnemy(sx, sy);
    if (en) { view.selected = { kind: 'enemy', id: en.id }; Audio.play('click'); return; }
    if (c) {
      var t = Game.towerAt(s, c.x, c.z);
      if (t) { view.selected = { kind: 'tower', id: t.id }; Audio.play('click'); }
      else { view.selected = { kind: 'cell', x: c.x, z: c.z }; Audio.play('click'); }
    } else view.selected = null;
  }
  function cancelDeploy() { view.deploy = null; view.itemMode = null; view.range = null; view.previewRoutes = null; view.rejectCells = null; view.demoCard = null; dragging = false; }
  function cancelAction() { cancelDeploy(); view.selected = null; }

  // ---------------- App 接口（供 UI 调用）----------------
  var App = {
    getState: function () { return state; },
    start: startMap, startDemo: startDemo, restart: restart, backToMenu: backToMenu,
    togglePause: function () { if (state && (mode === 'battle' || mode === 'demo')) { state.paused = !state.paused; UI.showPause(state.paused); } },
    cycleSpeed: function () { if (state) { state.speed = state.speed >= 3 ? 1 : state.speed + 1; UI.toast('速度 ' + state.speed + '×'); } },
    toggleMute: function () { Audio.setMute(!Audio.isMuted()); },
    setVolume: function (v) { Audio.setVolume(v); },
    demoExit: function () { if (exportMode) return; backToMenu(); },
    beginDeploy: function (type) {
      if (mode !== 'battle' || exportMode) return;
      cancelDeploy(); view.deploy = { type: type, facing: 0, phase: null }; dragging = true;
      view.demoCard = 'tower:' + type; Audio.play('click');
    },
    beginItem: function (id) {
      if (mode !== 'battle' || exportMode) return;
      cancelDeploy(); view.itemMode = id; dragging = true;
      view.demoCard = 'item:' + id; Audio.play('click');
    },
    upgradeTower: function (id, branch) {
      var r = Game.upgrade(state, id, branch);
      UI.toast(r.ok ? '设备已升级' : r.reason, r.ok ? 'good' : 'bad');
      if (r.ok) Audio.play('upgrade'); else Audio.play('rejected');
    },
    sellTower: function (id) { var r = Game.sell(state, id); if (r.ok) { UI.toast('设备已撤下 · 返还 ◱' + r.refund, 'good'); view.selected = null; } },
    towerSkill: function (id) { var r = Game.skill(state, id); UI.toast(r.ok ? '技能已释放' : r.reason, r.ok ? 'good' : 'bad'); if (r.ok) Audio.play('skill'); }
  };
  TD.App = App;

  // ---------------- 演示 ----------------
  function demoPlan(entries) {
    var plan = [], t = 0.5;
    for (var i = 0; i < entries.length; i++) {
      var g = entries[i];
      for (var c = 0; c < g.count; c++) { plan.push({ tick: Math.round(t / DT), type: g.type, entry: g.entry, wave: g.wave || 1 }); t += g.gap; }
    }
    return plan;
  }
  function setCamera(yaw, pitch, dist, tx, tz) {
    camLerp = { active: true, yaw: yaw, pitch: pitch, dist: dist, target: [tx || 0, 0, tz || 0] };
  }
  function focusCell(s, x, z, dist) {
    camLerp = { active: true, yaw: 0.7, pitch: 0.62, dist: dist || 20, target: [Maps.wx(s.map, x), 0, Maps.wz(s.map, z)] };
  }
  function cursorTo(target) { cursorTarget = resolveCursor(target); cursorVisible = true; }
  function resolveCursor(t) {
    var w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (t.cell && state) { var p = scene.project(Maps.wx(state.map, t.cell[0]), 0.4, Maps.wz(state.map, t.cell[1]), w, h); return p ? { x: p.x, y: p.y } : { x: w / 2, y: h / 2 }; }
    if (t.card) { var d = document.querySelector(t.card); if (d) { var r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } }
    if (t.screen) return { x: t.screen[0] * w, y: t.screen[1] * h };
    return { x: w / 2, y: h / 2 };
  }

  // 编排局面：把敌人预置在各入口路线的中段，使演示开局即进入交战
  function stage(s, type, entryId, seg, wave) {
    TD.Game.spawn(s, { type: type, entry: entryId, wave: wave || 1, tick: 0 });
    var e = s.enemies[s.enemies.length - 1];
    if (!e || e.flying || !e.path) return;
    var en = null;
    for (var i = 0; i < s.map.entries.length; i++) if (s.map.entries[i].id === entryId) en = s.map.entries[i];
    if (!en) return;
    var r = TD.Path.trace(s.map, s.field, s.access, en.x, en.z);
    if (!r || r.path.length < 2) return;
    var idx = Math.min(seg, r.path.length - 2);
    e.cell = { x: r.path[idx].x, z: r.path[idx].z };
    var rr = TD.Path.trace(s.map, s.field, s.access, e.cell.x, e.cell.z);
    e.path = rr ? rr.path.slice() : [e.cell];
    e.next = e.path[1] || e.path[0];
    e.f = 0; e.rv = s.routeVersion;
  }

  var DEMOS = {
    'demo-1': {
      name: '实战演示 01 · 分段取舍', mapId: 'intranet', duration: 18, seed: 41, wave: 6,
      compute: 620, intel: 90,
      setup: function (s, G) {
        G.build(s, 'firewall', 4, 2); G.build(s, 'interceptor', 6, 3, 0.3);
        G.build(s, 'sandbox', 10, 3); G.build(s, 'repair', 3, 7);
        G.build(s, 'honeypot', 12, 4); G.build(s, 'interceptor', 10, 7, 0.2);
        G.build(s, 'interceptor', 13, 3, 0.2); G.build(s, 'sandbox', 13, 7);
        s.core = s.coreMax;
        stage(s, 'worm', 'A', 7, 6); stage(s, 'worm', 'A', 9, 6);
        stage(s, 'trojan', 'A', 6, 6); stage(s, 'flood', 'A', 8, 6);
        stage(s, 'worm', 'B', 7, 6); stage(s, 'ransomware', 'B', 8, 6);
      },
      plan: demoPlan([
        { type: 'worm', entry: 'A', count: 9, gap: 1.5, wave: 6 },
        { type: 'trojan', entry: 'A', count: 4, gap: 2.6, wave: 6 },
        { type: 'flood', entry: 'A', count: 2, gap: 4.5, wave: 6 },
        { type: 'worm', entry: 'B', count: 6, gap: 1.9, wave: 6 },
        { type: 'ransomware', entry: 'B', count: 2, gap: 3.5, wave: 6 }
      ]),
      script: [
        { t: 0.0, a: 'cam', v: [0.62, 0.82, 48, 0, 0] },
        { t: 0.0, a: 'sub', v: ['DEMO 01 / 分段取舍', '守护进程日志：西边界节点承压，办公网段流量持续涌入。'] },
        { t: 0.1, a: 'cursor', v: { card: '[data-type="gateway"]' } },
        { t: 1.4, a: 'sub', v: ['STEP 1 / 拖放部署', '选取「网闸」：低成本隔离节点，用来主动改变入侵路线。'] },
        { t: 1.5, a: 'highlight', v: 'tower:gateway' },
        { t: 2.6, a: 'cursor', v: { cell: [4, 1] } },
        { t: 3.2, a: 'preview', v: [4, 1] },
        { t: 3.4, a: 'sub', v: ['STEP 2 / 改道预览', '预览中：隔离西边界节点后，A 折向 DMZ 互联，与 B 汇流。白色虚线为新路线。'] },
        { t: 5.4, a: 'press', v: true },
        { t: 5.8, a: 'build', v: ['gateway', 4, 1] },
        { t: 5.8, a: 'press', v: false },
        { t: 6.0, a: 'sub', v: ['STEP 3 / 确认改道', '确认：办公网段的敌人掉头，沿新收敛的路线转向。'] },
        { t: 6.2, a: 'cam', v: [0.35, 0.6, 22, -8, -4] },
        { t: 9.0, a: 'sub', v: ['战况', '改道后西侧压力缓解，拦截火力在汇流段集中拦截。'] },
        { t: 9.2, a: 'cam', v: [0.8, 0.55, 19, 2, 2] },
        { t: 13.0, a: 'sub', v: ['战况', '洪泛团冲击隔离点，节点上的网闸承受重击；东侧仍需维持防线。'] },
        { t: 13.4, a: 'cam', v: [1.05, 0.6, 20, 6, 0] },
        { t: 16.6, a: 'sub', v: ['收尾', '一次改道改变了局部战况，但代价是节点持续承压与情报消耗。'] },
        { t: 17.4, a: 'cam', v: [0.62, 0.82, 46, 0, 0] }
      ]
    },
    'demo-2': {
      name: '实战演示 02 · 旁路直通', mapId: 'backbone', duration: 20, seed: 77, wave: 9,
      compute: 680, intel: 100,
      setup: function (s, G) {
        // 骨干流域的设备平台位于 (5/11, 2/4/8/10)，链路位于 (4/8/12) 三条纵线
        G.build(s, 'gateway', 12, 6);
        G.build(s, 'firewall', 12, 3); G.build(s, 'interceptor', 11, 4, 0.2);
        G.build(s, 'sandbox', 5, 4); G.build(s, 'sandbox', 5, 8);
        G.build(s, 'interceptor', 11, 8, 0.2); G.build(s, 'honeypot', 4, 4);
        G.build(s, 'repair', 5, 10);
        s.core = s.coreMax;
        stage(s, 'flood', 'C', 8, 9); stage(s, 'worm', 'C', 7, 9);
        stage(s, 'worm', 'B', 8, 9); stage(s, 'trojan', 'B', 7, 9);
        stage(s, 'worm', 'A', 7, 9); stage(s, 'ransomware', 'A', 8, 9);
      },
      plan: demoPlan([
        { type: 'flood', entry: 'C', count: 2, gap: 1.5, wave: 9 },
        { type: 'worm', entry: 'C', count: 5, gap: 0.45, wave: 9 },
        { type: 'worm', entry: 'B', count: 5, gap: 0.45, wave: 9 },
        { type: 'trojan', entry: 'B', count: 2, gap: 0.8, wave: 9 },
        { type: 'worm', entry: 'A', count: 5, gap: 0.45, wave: 9 },
        { type: 'ransomware', entry: 'A', count: 2, gap: 0.8, wave: 9 },
        { type: 'hotspot', entry: 'B', count: 2, gap: 1.2, wave: 9 }
      ]),
      script: [
        { t: 0.0, a: 'cam', v: [0.62, 0.82, 48, 0, 0] },
        { t: 0.0, a: 'sub', v: ['DEMO 02 / 旁路直通', '骨干流域洪峰：三入口同时大量出兵，云端隧道节点的网闸正承受冲击。'] },
        { t: 1.6, a: 'cam', v: [0.9, 0.58, 21, 6, -1] },
        { t: 2.0, a: 'sub', v: ['STEP 1 / 节点攻防', '洪泛团离开路线冲向被隔离节点，重击节点上的网闸。'] },
        { t: 5.2, a: 'bypass', v: 'backbone-n3' },
        { t: 5.2, a: 'sub', v: ['关键事件 / 网闸被冲垮', '设备旁路直通：C、B 的路线改回原来的数据中心，流量重新收敛。'] },
        { t: 5.4, a: 'cursor', v: { cell: [12, 6] } },
        { t: 6.6, a: 'cursor', v: { card: '[data-item="downgrade"]' } },
        { t: 7.2, a: 'sub', v: ['STEP 2 / 道具投放', '在 A 的路线上投下「协议降级」，改变局部通行速度、迫使敌人重新选路。'] },
        { t: 7.2, a: 'highlight', v: 'item:downgrade' },
        { t: 8.6, a: 'cursor', v: { cell: [4, 3] } },
        { t: 9.2, a: 'itemrange', v: [4, 3, 1.6] },
        { t: 10.2, a: 'press', v: true },
        { t: 10.5, a: 'item', v: ['downgrade', 4, 3] },
        { t: 10.5, a: 'press', v: false },
        { t: 10.6, a: 'sub', v: ['STEP 3 / 战况', '协议降级生效：旧协议减速并让木马显形，A 侧压力得到缓解。'] },
        { t: 11.0, a: 'cam', v: [0.4, 0.6, 20, -7, -1] },
        { t: 15.0, a: 'sub', v: ['战况', '两侧数据中心同时承压，拦截火力与修复进程维持防线。'] },
        { t: 15.2, a: 'cam', v: [1.1, 0.6, 22, 6, 3] },
        { t: 18.6, a: 'sub', v: ['收尾', '冲垮网闸与协议降级共同改变了交战分布，双方互有战果。'] },
        { t: 19.3, a: 'cam', v: [0.62, 0.82, 46, 0, 0] }
      ]
    },
    'demo-3': {
      name: '实战演示 03 · 蛰影现身', mapId: 'airgap', duration: 22, seed: 99, wave: 16,
      compute: 780, intel: 120,
      setup: function (s, G) {
        G.build(s, 'firewall', 4, 5); G.build(s, 'firewall', 12, 5);
        G.build(s, 'interceptor', 5, 5, 0.1); G.build(s, 'sandbox', 11, 5);
        G.build(s, 'repair', 5, 7); G.build(s, 'interceptor', 11, 7, 3.0);
        G.build(s, 'gateway', 4, 9); G.build(s, 'honeypot', 12, 7);
        s.core = s.coreMax;
        stage(s, 'worm', 'A', 7, 16); stage(s, 'flood', 'C', 8, 16);
        stage(s, 'trojan', 'B', 7, 16); stage(s, 'ransomware', 'C', 7, 16);
        stage(s, 'worm', 'B', 8, 16); stage(s, 'packer', 'A', 8, 16);
        G.spawn(s, { type: 'zheying', entry: 'B', boss: true, wave: 16, tick: 0 });
      },
      plan: demoPlan([
        { type: 'worm', entry: 'A', count: 9, gap: 1.6, wave: 16 },
        { type: 'trojan', entry: 'B', count: 5, gap: 2.4, wave: 16 },
        { type: 'flood', entry: 'C', count: 3, gap: 3.4, wave: 16 },
        { type: 'ransomware', entry: 'C', count: 3, gap: 2.8, wave: 16 },
        { type: 'worm', entry: 'C', count: 6, gap: 1.8, wave: 16 },
        { type: 'packer', entry: 'A', count: 2, gap: 4, wave: 16 }
      ]),
      script: [
        { t: 0.0, a: 'cam', v: [0.62, 0.82, 48, 0, 0] },
        { t: 0.0, a: 'sub', v: ['DEMO 03 / 蛰影现身', '气隙深层第 16 波：核心威胁「蛰影」登场，按潜伏—提权—破坏改变阶段。'] },
        { t: 1.8, a: 'cam', v: [0.7, 0.58, 22, 0, 0] },
        { t: 2.4, a: 'sub', v: ['STEP 1 / 潜伏', '潜伏阶段需经沙箱检测显形，才能被远程单体攻击选中。'] },
        { t: 5.0, a: 'lock', v: [[8, 5], [8, 6], [8, 7]] },
        { t: 5.0, a: 'warn', v: [[8, 5], [8, 6], [8, 7]] },
        { t: 5.2, a: 'sub', v: ['关键事件 / 锁死运维环', '蛰影「破坏」阶段锁死前方一段运维环，各入口路线重新收敛。'] },
        { t: 6.4, a: 'cam', v: [0.35, 0.6, 20, -6, 1] },
        { t: 8.0, a: 'sub', v: ['STEP 2 / 维持防线', '选中「修复进程」，释放「冗余切换」为附近友塔提供护盾并解除加密。'] },
        { t: 8.2, a: 'cursor', v: { cell: [5, 7] } },
        { t: 9.4, a: 'select', v: 'repair' },
        { t: 10.6, a: 'press', v: true },
        { t: 10.9, a: 'skill', v: 'repair' },
        { t: 10.9, a: 'press', v: false },
        { t: 11.0, a: 'sub', v: ['STEP 3 / 战况', '护盾与解加密让关键节点顶住压力；两侧狭窄通道的防守相互牵制。'] },
        { t: 11.4, a: 'cam', v: [1.0, 0.6, 21, 6, 1] },
        { t: 16.0, a: 'sub', v: ['战况', '入侵流量在两侧通道间转移，拦截火力与沙箱检测交替奏效。'] },
        { t: 16.4, a: 'cam', v: [0.5, 0.62, 20, -5, -2] },
        { t: 20.4, a: 'sub', v: ['收尾', '改道、检测与维持手段共同牵制了核心威胁，防线仍有局部压力。'] },
        { t: 21.3, a: 'cam', v: [0.62, 0.82, 46, 0, 0] }
      ]
    }
  };

  function startDemo(runId, opts) {
    opts = opts || {};
    var cfg = DEMOS[runId]; if (!cfg) return;
    exitExportIfAny();
    state = Game.create(cfg.mapId, {
      seed: cfg.seed, compute: cfg.compute, intel: cfg.intel,
      wavePlan: cfg.plan, endTick: 1e9,
      setup: function (s, G) { cfg.setup(s, G); }
    });
    state.speed = 1; state.paused = false; state.wave = cfg.wave || 1;
    mode = 'demo'; exportMode = !!opts.export; demo = { id: runId, name: cfg.name, duration: cfg.duration, script: cfg.script, idx: 0 };
    scene.buildStatic(state.map);
    defaultOrbit(); resetView(); acc = 0; camLerp.active = false;
    cursorPos = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }; cursorTarget = null; cursorVisible = false; cursorPress = false;
    if (!opts.export) { UI.setScreen('battle'); Audio.unlock(); Audio.startAmbience(state.map.env.ambience); }
    else UI.setScreen('battle');
  }
  function finishDemo(isExport) {
    if (isExport) return; // 导出模式下由 end() 收尾
    UI.subtitle('演示结束', cfgName(demo.id) + ' · 演示完成，可退出或返回关卡选择');
    UI.toast('演示结束', 'good');
    mode = 'report';
  }
  function cfgName(id) { return DEMOS[id] ? DEMOS[id].name : ''; }

  function processDemoStep(s) {
    var d = demo; if (!d) return;
    while (d.idx < d.script.length && s.time >= d.script[d.idx].t - 1e-9) {
      runAction(d.script[d.idx], s); d.idx++;
    }
  }
  function runAction(act, s) {
    var v = act.v;
    switch (act.a) {
      case 'sub': UI.subtitle(v[0], v[1]); break;
      case 'cam': setCamera(v[0], v[1], v[2], v[3], v[4]); break;
      case 'cursor': cursorTo(v); break;
      case 'press': cursorPress = !!v; break;
      case 'highlight': view.demoCard = v; break;
      case 'preview': {
        var pv = Game.isolatePreview(s, s.map.nodeAt[Game.cellKey({ x: v[0], z: v[1] })]);
        if (pv.ok && pv.routes) { view.previewRoutes = pv.routes; view.hover = { x: v[0], z: v[1], wx: Maps.wx(s.map, v[0]), wz: Maps.wz(s.map, v[1]) }; }
        break;
      }
      case 'build': {
        var r = Game.build(s, v[0], v[1], v[2], 0);
        view.previewRoutes = null; view.hover = null; view.demoCard = null;
        if (r.ok) UI.toast('网闸部署 · 节点隔离生效，A 改走 DMZ 互联', 'good');
        break;
      }
      case 'itemrange': view.range = { x: Maps.wx(s.map, v[0]), z: Maps.wz(s.map, v[1]), r: v[2] * s.map.CELL, color: hx('#ffd27f') }; view.hover = { x: v[0], z: v[1], wx: Maps.wx(s.map, v[0]), wz: Maps.wz(s.map, v[1]) }; break;
      case 'item': { var ri = Game.useItem(s, v[0], v[1], v[2]); view.range = null; if (ri.ok) UI.toast('协议降级已生效', 'good'); break; }
      case 'bypass': Game.bypassNode(s, v, '（洪泛团冲垮网闸）'); break;
      case 'lock': {
        for (var i = 0; i < v.length; i++) s.blocks[Game.cellKey({ x: v[i][0], z: v[i][1] })] = { expireTick: s.tick + Math.round(30 / DT), type: 'blackhole' };
        // 蛰影进入「破坏」阶段（血量/时间双触发），锁死运维环
        for (var bi = 0; bi < s.enemies.length; bi++) {
          var be = s.enemies[bi];
          if (be.boss) { be.hp = Math.min(be.hp, be.maxHp * 0.3); be.latent = false; be.revealed = true; }
        }
        Game.recompute(s, 'demo-lock');
        break;
      }
      case 'warn': {
        for (var j = 0; j < v.length; j++) {
          var w = { x: v[j][0], z: v[j][1], wx: Maps.wx(s.map, v[j][0]), wz: Maps.wz(s.map, v[j][1]), trigger: s.tick + Math.round(1.2 / DT), text: '锁死预警', color: hx('#ff3b6b') };
          s.warnings.push(w);
        }
        break;
      }
      case 'select': {
        var t = null;
        for (var k = 0; k < s.towers.length; k++) if (s.towers[k].type === v && !s.towers[k].dying) { t = s.towers[k]; break; }
        if (t) { view.selected = { kind: 'tower', id: t.id }; }
        break;
      }
      case 'skill': {
        var tt = null;
        for (var m = 0; m < s.towers.length; m++) if (s.towers[m].type === v && !s.towers[m].dying) { tt = s.towers[m]; break; }
        if (tt) { Game.skill(s, tt.id); UI.toast('修复进程释放「冗余切换」', 'good'); }
        break;
      }
    }
  }

  // ---------------- 视频导出接口 ----------------
  function exitExportIfAny() { exportMode = false; }
  window.videoExport = {
    runs: ['demo-1', 'demo-2', 'demo-3'],
    begin: async function (runId, opts) {
      opts = opts || {};
      exportFps = opts.fps || 30;
      var cfg = DEMOS[runId] || DEMOS['demo-1'];
      startDemo(runId, { export: true });
      exportMode = true;
      state.paused = false;
      var frames = Math.ceil(cfg.duration * exportFps);
      // 第 0 帧即演示起始时刻：触发开场字幕/镜头/光标，并呈现
      processDemoStep(state);
      render();
      return { frames: frames };
    },
    frame: async function (i) {
      var targetTick = Math.round((i / exportFps) / DT);
      var guard = 0;
      while (state.tick < targetTick && guard++ < 20000 && state.phase === 'battle') advanceOneStep(true);
      render();
      return true;
    },
    end: function () {
      exportMode = false; demo = null;
      UI.subtitle(null, null);
      cursorVisible = false;
      UI.demoCursor(0, 0, false, false);
      mode = 'battle';
      if (state) { state.paused = false; state.speed = 1; }
      UI.setScreen('battle');
    }
  };

  // 启动
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
