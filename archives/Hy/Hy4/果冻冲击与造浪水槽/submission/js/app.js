/* ============================================================
   app.js — 应用编排 / 界面 / 音效开关 / 视频导出接口
   ============================================================ */
(function (global) {
'use strict';
var JW = global.JW;
var $ = function (id) { return document.getElementById(id); };
var clamp = JW.util.clamp;

/* ---------------- 初始化 ---------------- */
var canvas = $('gl');
var stage = new JW.Stage(canvas);
var audio = new JW.AudioEngine();
var jelly = new JW.JellyScene(stage, audio);
var tank = new JW.TankScene(stage, audio);
var scenes = { jelly: jelly, tank: tank };
var sceneName = 'jelly';

JW.stage = stage; JW.audio = audio; JW.scenes = scenes;

var appState = {
  paused: false, speed: 1, soundOn: true, autoPending: false,
  sceneName: 'jelly'
};
var autoTimer = null;

function current() { return scenes[appState.sceneName]; }

function applyCamera(name, isExport) {
  var rig = stage.rig;
  if (name === 'jelly') {
    rig.setView(0.42, 1.19);
    stage.setFit(3.15, 2.95, 2.15);
  } else {
    rig.setView(0.33, 1.30);
    stage.setFit(5.75, 2.95, 1.78);
  }
  rig.enabled = !isExport;
  rig.drift = 0;
}

/* ---------------- 控制面板定义 ---------------- */
function S(key, label, min, max, step, unit, digits) {
  return { type: 'slider', key: key, label: label, min: min, max: max, step: step, unit: unit || '', digits: digits };
}
function SEG(label, key, options, get, set) {
  return { type: 'seg', label: label, key: key, options: options, get: get, set: set };
}
function CHK(label, key, get, set) {
  return { type: 'check', label: label, key: key, get: get, set: set };
}
function ACT(items) { return { type: 'actions', items: items }; }

function controlsFor(name) {
  if (name === 'jelly') return [
    { t: '演示模式', en: 'IMPACT MODE', rows: [
      SEG('', 'mode', [['center', '单球正中'], ['offset', '偏心撞击'], ['multi', '多球连续']],
        function () { return jelly.mode; },
        function (v) { jelly.setMode(v); buildPanel('jelly'); })
    ] },
    { t: '重球', en: 'RIGID BALL', rows: [
      S('ballMass', '质量', 2, 30, 0.5, ' kg', 1),
      S('ballRadius', '半径', 0.30, 0.85, 0.01, ' m', 2),
      S('dropHeight', '初始高度', 1.0, 6.0, 0.1, ' m', 1),
      S('ballCount', '球数（多球）', 2, 5, 1, '', 0),
      S('releaseGap', '释放间隔（多球）', 0.4, 2.5, 0.05, ' s', 2)
    ] },
    { t: '果冻', en: 'SOFT BODY', rows: [
      S('jellyWidth', '宽度', 2.0, 4.4, 0.05, ' m', 2),
      S('jellyHeight', '高度', 0.8, 2.0, 0.05, ' m', 2),
      S('jellyDepth', '纵深', 2.0, 4.4, 0.05, ' m', 2),
      S('stiffness', '弹性 / 软硬', 0.35, 2.2, 0.05, '', 2),
      S('damping', '阻尼', 0.30, 3.0, 0.05, '', 2),
      S('jellyMass', '质量 / 密度', 8, 60, 1, ' kg', 0),
      SEG('底部固定', 'bottomFix', [['full', '完全固定'], ['edge', '边缘固定'], ['slide', '摩擦滑动']],
        function () { return jelly.params.bottomFix; },
        function (v) { jelly.setParams({ bottomFix: v }); })
    ] },
    { t: '碰撞与环境', en: 'ENVIRONMENT', rows: [
      S('gravity', '重力', 2, 20, 0.2, ' m/s²', 1),
      S('platformFriction', '平台摩擦', 0, 1, 0.02, '', 2),
      S('platformBounce', '平台弹性', 0, 0.7, 0.02, '', 2),
      CHK('重球连续多次撞击', 'multiHit',
        function () { return jelly.params.multiHit; },
        function (v) { jelly.setParams({ multiHit: v }); })
    ] },
    { t: '快速操作', en: 'ACTIONS', rows: [
      ACT([['重新触发', function () { cancelAuto(); jelly.trigger(); }],
           ['重置初态', function () { cancelAuto(); jelly.reset(); }]])
    ] }
  ];

  var densRows = [
    S('ballRadius', '统一半径', 0.18, 0.42, 0.005, ' m', 3),
    {
      type: 'slider', label: '总数量', min: 5, max: 25, step: 5, unit: ' 颗', digits: 0,
      get: function () { return tank.params.perGroup * 5; },
      set: function (v) { tank.setParams({ perGroup: Math.round(v / 5) }); }
    },
    S('perGroup', '每组数量', 1, 5, 1, '', 0),
    S('releaseHeight', '释放高度', 0.4, 2.2, 0.05, ' m', 2)
  ];
  JW.TANK_GROUPS.forEach(function (g, gi) {
    densRows.push({
      type: 'slider', label: g.name + '密度', min: 0.2, max: 2.3, step: 0.01, unit: '', digits: 2,
      get: function () { return tank.params.densities[gi]; },
      set: function (v) { var a = tank.params.densities.slice(); a[gi] = v; tank.setParams({ densities: a }); }
    });
  });
  return [
    { t: '实验流程', en: 'EXPERIMENT', rows: [
      ACT([['释放球体', function () { cancelAuto(); tank.releaseBalls(); }],
           ['开始造浪', function () { cancelAuto(); tank.startWave(); }],
           ['停止造浪', function () { cancelAuto(); tank.stopWave(); }]]),
      { type: 'legend' }
    ] },
    { t: '球体', en: 'RIGID SPHERES', rows: densRows },
    { t: '流体', en: 'FLUID', rows: [
      S('waterLevel', '水位高度', 1.4, 3.0, 0.05, ' m', 2),
      S('gravity', '重力', 2, 20, 0.2, ' m/s²', 1),
      S('viscosity', '粘性 / 阻尼', 0.3, 3.0, 0.05, '', 2)
    ] },
    { t: '水槽', en: 'TANK', rows: [
      S('tankLength', '长度', 6, 12, 0.2, ' m', 1),
      S('tankWidth', '宽度（纵深）', 2.2, 4.4, 0.1, ' m', 1),
      S('tankHeight', '高度', 2.8, 4.6, 0.1, ' m', 1)
    ] },
    { t: '造浪装置', en: 'WAVE MAKER', rows: [
      SEG('装置类型', 'waveType', [['piston', '侧向推板'], ['flap', '往复波板'], ['dual', '双端活塞']],
        function () { return tank.params.waveType; },
        function (v) { tank.setParams({ waveType: v }); buildPanel('tank'); }),
      S('waveDelay', '入水后启动延迟', 0, 3, 0.1, ' s', 1),
      S('waveAmp', '运动幅度', 0.08, 0.45, 0.005, ' m', 3),
      S('waveFreq', '运动频率', 0.5, 2.0, 0.05, ' Hz', 2),
      S('waveDuration', '持续时长', 2, 9, 0.1, ' s', 1)
    ] },
    { t: '快速操作', en: 'ACTIONS', rows: [
      ACT([['完整实验', function () { cancelAuto(); tank.trigger(); }],
           ['重置初态', function () { cancelAuto(); tank.reset(); }]])
    ] }
  ];
}

/* ---------------- 面板构建 ---------------- */
function buildPanel(name) {
  var body = $('panel-body');
  body.innerHTML = '';
  var defs = controlsFor(name);
  var sc = scenes[name];
  defs.forEach(function (grp) {
    var g = document.createElement('div'); g.className = 'grp';
    var t = document.createElement('div'); t.className = 'grp-t';
    t.appendChild(document.createTextNode(grp.t));
    var en = document.createElement('span'); en.className = 'gt-en'; en.textContent = grp.en; t.appendChild(en);
    g.appendChild(t);
    grp.rows.forEach(function (row) { g.appendChild(buildRow(row, sc)); });
    body.appendChild(g);
  });
  $('panel-title').textContent = name === 'jelly' ? '场景一 · 果冻冲击' : '场景二 · 造浪水槽';
}

function buildRow(row, sc) {
  if (row.type === 'slider') {
    var wrap = document.createElement('div'); wrap.className = 'ctl';
    var top = document.createElement('div'); top.className = 'ctl-top';
    var lab = document.createElement('span'); lab.className = 'ctl-label'; lab.textContent = row.label;
    var val = document.createElement('span'); val.className = 'ctl-val';
    top.appendChild(lab); top.appendChild(val);
    var inp = document.createElement('input'); inp.type = 'range';
    inp.min = row.min; inp.max = row.max; inp.step = row.step;
    var getter = row.get || function () { return sc.params[row.key]; };
    var setter = row.set || function (v) { var o = {}; o[row.key] = v; sc.setParams(o); };
    inp.value = getter();
    function upd() {
      var v = parseFloat(inp.value);
      var d = row.digits === undefined ? 2 : row.digits;
      val.textContent = v.toFixed(d) + row.unit;
      inp.style.setProperty('--p', ((v - row.min) / (row.max - row.min) * 100) + '%');
    }
    inp.addEventListener('input', function () { upd(); setter(parseFloat(inp.value)); });
    upd();
    wrap.appendChild(top); wrap.appendChild(inp);
    return wrap;
  }
  if (row.type === 'seg') {
    var box = document.createElement('div');
    if (row.label) {
      var lt = document.createElement('div'); lt.className = 'ctl-top';
      var l1 = document.createElement('span'); l1.className = 'ctl-label'; l1.textContent = row.label;
      lt.appendChild(l1); box.appendChild(lt);
    }
    var seg = document.createElement('div'); seg.className = 'seg';
    row.options.forEach(function (op) {
      var b = document.createElement('button'); b.textContent = op[1];
      b.className = (row.get() === op[0]) ? 'on' : '';
      b.addEventListener('click', function () {
        row.set(op[0]);
        Array.prototype.forEach.call(seg.children, function (c, i2) { c.className = (row.options[i2][0] === op[0]) ? 'on' : ''; });
      });
      seg.appendChild(b);
    });
    box.appendChild(seg);
    return box;
  }
  if (row.type === 'check') {
    var lb = document.createElement('label'); lb.className = 'chk';
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!row.get();
    cb.addEventListener('change', function () { row.set(cb.checked); });
    lb.appendChild(cb); lb.appendChild(document.createTextNode(row.label));
    return lb;
  }
  if (row.type === 'actions') {
    var ar = document.createElement('div'); ar.className = 'act-row';
    row.items.forEach(function (it) {
      var b = document.createElement('button'); b.className = 'act'; b.textContent = it[0];
      b.addEventListener('click', it[1]); ar.appendChild(b);
    });
    return ar;
  }
  if (row.type === 'legend') {
    var lg = document.createElement('div'); lg.className = 'legend';
    JW.TANK_GROUPS.forEach(function (g) {
      var e = document.createElement('span'); e.className = 'lg';
      var dot = document.createElement('i'); dot.style.background = '#' + g.color.toString(16).padStart(6, '0');
      dot.style.color = '#' + g.color.toString(16).padStart(6, '0');
      e.appendChild(dot); e.appendChild(document.createTextNode(g.name));
      lg.appendChild(e);
    });
    return lg;
  }
  return document.createElement('div');
}

/* ---------------- 状态栏 ---------------- */
var phaseEls = [];
function buildPhases(list) {
  var box = $('st-phases'); box.innerHTML = ''; phaseEls = [];
  list.forEach(function (s) {
    var e = document.createElement('span'); e.className = 'ph'; e.textContent = s;
    box.appendChild(e); phaseEls.push(e);
  });
}
function updateStatus() {
  var st = current().getStatus();
  $('st-phase').textContent = st.phase;
  $('st-time').textContent = st.time.toFixed(2) + ' s';
  $('st-fill').style.width = clamp(st.time / st.duration * 100, 0, 100) + '%';
  for (var i = 0; i < phaseEls.length; i++) {
    phaseEls[i].className = 'ph' + (i === st.phaseIndex ? ' on' : (i < st.phaseIndex ? ' done' : ''));
  }
}

/* ---------------- 界面状态 ---------------- */
function updateUI() {
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
    b.className = 'tab' + (b.getAttribute('data-scene') === appState.sceneName ? ' active' : '');
  });
  $('trigger-label').textContent = appState.sceneName === 'jelly' ? '触发冲击' : '开始实验';
  $('btn-pause').textContent = appState.paused ? '继续' : '暂停';
  $('btn-pause').className = 'btn' + (appState.paused ? ' active' : '');
  $('sound-toggle').setAttribute('aria-pressed', appState.soundOn ? 'true' : 'false');
  $('sound-label').textContent = appState.soundOn ? '声音 开' : '声音 关';
}

function switchScene(name) {
  if (name === appState.sceneName && phaseEls.length) return;
  appState.sceneName = name;
  stage.setSubject(name);
  applyCamera(name, false);
  current().reset();
  buildPanel(name);
  buildPhases(current().getStatus().phases);
  updateUI();
  scheduleAuto();
  toast(name === 'jelly' ? '场景一 · 重球冲击果冻台' : '场景二 · 多密度球与造浪水槽');
}

var toastTimer = null;
function toast(msg) {
  var el = $('toast'); el.textContent = msg; el.className = 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.className = ''; }, 2200);
}

function cancelAuto() { appState.autoPending = false; if (autoTimer) clearTimeout(autoTimer); }
function scheduleAuto() {
  cancelAuto();
  appState.autoPending = true;
  autoTimer = setTimeout(function () {
    if (!appState.autoPending) return;
    appState.autoPending = false;
    var sc = current();
    sc.reset(); sc.trigger();
  }, 950);
}

/* ---------------- 事件绑定 ---------------- */
Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
  b.addEventListener('click', function () { switchScene(b.getAttribute('data-scene')); });
});
$('sound-toggle').addEventListener('click', function () {
  appState.soundOn = !appState.soundOn;
  audio.setEnabled(appState.soundOn);
  updateUI();
});
$('panel-toggle').addEventListener('click', function () { $('panel').classList.toggle('hidden'); });
$('panel-close').addEventListener('click', function () { $('panel').classList.add('hidden'); });

$('btn-trigger').addEventListener('click', function () {
  cancelAuto();
  var sc = current();
  sc.reset(); sc.trigger();
  if (appState.paused) { appState.paused = false; updateUI(); }
});
$('btn-pause').addEventListener('click', function () {
  appState.paused = !appState.paused; updateUI();
});
$('btn-reset').addEventListener('click', function () {
  cancelAuto(); current().reset();
  if (appState.paused) { appState.paused = false; updateUI(); }
});
$('speed').addEventListener('change', function () { appState.speed = parseFloat(this.value); });

global.addEventListener('keydown', function (e) {
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); appState.paused = !appState.paused; updateUI(); }
  else if (e.key === 'r' || e.key === 'R') { cancelAuto(); current().reset(); }
  else if (e.key === '1') switchScene('jelly');
  else if (e.key === '2') switchScene('tank');
});
// 首次用户操作解锁音频
['pointerdown', 'keydown'].forEach(function (ev) {
  global.addEventListener(ev, function once() {
    if (appState.soundOn) audio.ensure();
    global.removeEventListener(ev, once);
  }, { once: true });
});
global.addEventListener('resize', function () { stage.resize(); });

/* ---------------- 实时循环 ---------------- */
var lastTime = performance.now();
function loop(now) {
  global.requestAnimationFrame(loop);
  var dtReal = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (exportState.active) return;
  if (!appState.paused) current().step(dtReal * appState.speed);
  current().sync();
  stage.render(current().t);
  updateStatus();
}

/* ---------------- 视频导出接口 ---------------- */
var RUNS = {
  'jelly-center': 'jelly',
  'jelly-multi': 'jelly',
  'jelly-offset': 'jelly',
  'tank-full': 'tank'
};
var exportState = {
  active: false, runId: null, fps: 30, frames: 0, T: 0,
  curFrame: 0, scene: null, prevPaused: false, prevSound: true
};

var videoExport = global.videoExport = {
  runs: ['jelly-center', 'jelly-multi', 'jelly-offset', 'tank-full'],

  begin: function (runId, opt) {
    var fps = Math.max(1, Math.round((opt && opt.fps) || 30));
    var name = RUNS[runId] || 'jelly';
    cancelAuto();
    exportState.active = true;
    exportState.prevPaused = appState.paused;
    exportState.prevSound = appState.soundOn;
    appState.paused = true;
    audio.enabled = false;
    audio.stopWave();

    document.body.classList.add('export-mode');
    appState.sceneName = name;
    stage.setSubject(name);
    var sc = scenes[name];
    exportState.scene = sc;
    exportState.runId = runId;
    exportState.fps = fps;
    var T = sc.prepareExport(runId);
    exportState.T = T;
    exportState.frames = Math.ceil(T * fps);
    exportState.curFrame = 0;

    applyCamera(name, true);
    stage.resize();
    sc.sync();
    stage.render(0);

    return new Promise(function (resolve) {
      global.requestAnimationFrame(function () {
        global.requestAnimationFrame(function () { resolve({ frames: exportState.frames }); });
      });
    });
  },

  frame: function (i) {
    if (!exportState.active) return Promise.resolve();
    var st = exportState, sc = st.scene;
    if (i < st.curFrame) {
      sc.prepareExport(st.runId);
      st.curFrame = 0;
      applyCamera(appState.sceneName, true);
      stage.resize();
    }
    var steps = i - st.curFrame;
    var dt = 1 / st.fps;
    for (var s = 0; s < steps; s++) sc.step(dt);
    st.curFrame = i;
    var t = i / st.fps;
    stage.rig.drift = 0.030 * Math.sin(t * 0.42);
    sc.sync();
    stage.render(t);
    return new Promise(function (resolve) { global.requestAnimationFrame(function () { resolve(); }); });
  },

  end: function () {
    if (!exportState.active) return;
    exportState.active = false;
    document.body.classList.remove('export-mode');
    stage.rig.drift = 0;
    stage.rig.enabled = true;
    appState.paused = exportState.prevPaused;
    appState.soundOn = exportState.prevSound;
    audio.setEnabled(appState.soundOn);
    var sc = current();
    sc.reset();
    applyCamera(appState.sceneName, false);
    stage.resize();
    buildPanel(appState.sceneName);
    buildPhases(sc.getStatus().phases);
    updateUI();
    lastTime = performance.now();
    scheduleAuto();
  }
};

/* ---------------- 启动 ---------------- */
stage.setSubject('jelly');
applyCamera('jelly', false);
buildPanel('jelly');
buildPhases(jelly.getStatus().phases);
updateUI();
stage.resize();
scheduleAuto();
global.requestAnimationFrame(loop);

})(window);
