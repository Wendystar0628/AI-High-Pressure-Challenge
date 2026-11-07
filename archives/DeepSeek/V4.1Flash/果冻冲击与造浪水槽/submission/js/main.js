/* ============================================================
   应用外壳：双场景、参数、控制、音效、逐帧导出
   ============================================================ */
(function () {
  'use strict';

  const SIM_DT = 1 / 120;
  const RUNS = ['jelly-center', 'jelly-multi', 'jelly-offset', 'tank-full'];
  const SCENE_META = {
    jelly: {
      eyebrow: 'SCENE 01 / SOFT BODY',
      title: '重球冲击果冻台',
      sub: '一颗重球落下，局部的凹陷如何扩散成整个果冻的呼吸。'
    },
    tank: {
      eyebrow: 'SCENE 02 / FLUID & DENSITY',
      title: '多密度球造浪水槽',
      sub: '同尺寸、不同密度的球，在持续造浪中分层、漂移与碰撞。'
    }
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const state = {
    active: 'jelly',
    paused: false,
    speed: 1,
    exporting: false,
    soundOn: false,
    tankVisited: false,
    started: false
  };

  const els = {};
  let renderer;
  let envTex;
  let jelly;
  let tank;
  let audio;
  let accumulator = 0;
  let lastFrame = performance.now();
  let lastHud = 0;
  let jellyRerunTimer = null;
  let paramApplyTimer = null;
  let exportState = null;
  let exportSaved = null;

  const jellyParams = {};
  const tankParams = {};

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    cacheEls();

    renderer = new THREE.WebGLRenderer({
      canvas: els.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // 环境反射贴图
    const envSrc = U.makeEnvTexture();
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    envTex = pmrem.fromEquirectangular(envSrc).texture;
    envSrc.dispose();
    pmrem.dispose();

    audio = new SoundEngine();

    const jellyEvents = {
      onImpact: (s) => {
        if (!state.exporting) {
          audio.impact(s);
          if (s > 0.7) audio.jelly(s * 0.8);
        }
      },
      onJelly: (s) => { if (!state.exporting) audio.jelly(s); },
      onBall: (s) => { if (!state.exporting) audio.ball(s); },
      onRelease: () => { if (!state.exporting) audio.ui(); }
    };
    const tankEvents = {
      onEntry: (s) => { if (!state.exporting) audio.entry(s); },
      onSplash: (s) => { if (!state.exporting) audio.splash(s); },
      onWave: (on) => { if (!state.exporting) audio.wave(on); },
      onBall: (s) => { if (!state.exporting) audio.ball(s); },
      onPaddle: () => { if (!state.exporting) audio.paddleTick(); }
    };

    jelly = new JellyScene(renderer, envTex, jellyEvents);
    tank = new TankScene(renderer, envTex, tankEvents);
    window.__lab = { jelly, tank, state, renderer, audio };

    Object.assign(jellyParams, clone(JellyScene.DEFAULTS));
    Object.assign(tankParams, clone(TankScene.DEFAULTS || {}));

    buildParams();
    buildDensityLegend();
    bindUI();
    document.body.dataset.scene = 'jelly';
    jelly.setActive(true);
    tank.setActive(false);
    updateChrome();
    resize();

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);

    // 首次交互初始化音频上下文，并默认开启声音（声卡按钮首击时由按钮自行切换）
    const unlock = (e) => {
      audio.init();
      const onSoundBtn = e && e.target && e.target.closest && e.target.closest('#soundBtn');
      if (!onSoundBtn && !state.soundOn) {
        state.soundOn = true;
        audio.setEnabled(true);
        els.soundBtn.classList.remove('off');
        els.soundState.textContent = '开';
        audio.ui();
      }
      if (els.audioHint) els.audioHint.classList.add('gone');
    };
    document.addEventListener('pointerdown', unlock, { once: true });

    setTimeout(() => {
      if (els.loading) els.loading.classList.add('done');
    }, 550);

    requestAnimationFrame(loop);

    // 自动展示一段冲击过程
    setTimeout(() => {
      if (!state.exporting && state.active === 'jelly' && !jelly.started) {
        jelly.trigger(0.45);
        state.paused = false;
        setStarted(true);
        updatePauseUI();
      }
    }, 1600);
  }

  function cacheEls() {
    const ids = ['stage', 'soundBtn', 'soundState', 'panelBtn', 'panel', 'panelClose', 'hud',
      'sceneEyebrow', 'sceneTitle', 'sceneSub', 'phaseText', 'timeText', 'modeText',
      'timelineFill', 'primaryBtn', 'pauseBtn', 'resetBtn', 'speedSwitch', 'jellyModes',
      'waveDial', 'waveCount', 'waveStatus', 'waveSmall', 'densityLegend',
      'waveStartBtn', 'waveStopBtn', 'releaseBtn', 'jellyParams', 'tankParams',
      'loading', 'audioHint', 'panelFoot'];
    for (const id of ids) els[id] = document.getElementById(id);
    els.canvas = els.stage;
    els.tabs = $$('.scene-tab');
    els.primaryLabel = els.primaryBtn.querySelector('b');
  }

  function resize() {
    if (!renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(state.exporting ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    if (jelly) {
      jelly.camera.aspect = w / h;
      jelly.camera.updateProjectionMatrix();
    }
    if (tank && tank.camera) {
      tank.camera.aspect = w / h;
      tank.camera.updateProjectionMatrix();
      if (tank.resize) tank.resize(w, h);
    }
  }

  /* ============================================================
     主循环
     ============================================================ */
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.06, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (state.exporting) return;

    const sc = activeScene();
    if (!state.paused && sc) {
      accumulator += dt * state.speed;
      let guard = 0;
      while (accumulator >= SIM_DT && guard < 8) {
        sc.step(SIM_DT);
        accumulator -= SIM_DT;
        guard++;
      }
      if (guard >= 8) accumulator = 0;
    }
    if (sc) sc.render(dt);
    if (now - lastHud > 70) {
      lastHud = now;
      updateHud();
    }
  }

  function activeScene() {
    return state.active === 'tank' ? tank : jelly;
  }

  /* ============================================================
     场景切换与 HUD
     ============================================================ */
  function setScene(name, opts) {
    opts = opts || {};
    if (!opts.force && state.active === name) return;
    if (state.exporting && !opts.allowExport) return;
    const prev = state.active;
    if (prev === 'jelly' && jelly) jelly.setActive(false);
    if (prev === 'tank' && tank) tank.setActive(false);
    state.active = name;
    document.body.dataset.scene = name;
    if (jelly) jelly.setActive(name === 'jelly');
    if (tank) tank.setActive(name === 'tank');
    els.tabs.forEach((t) => t.classList.toggle('active', t.dataset.scene === name));
    els.jellyParams.classList.toggle('hidden', name !== 'jelly');
    els.tankParams.classList.toggle('hidden', name !== 'tank');
    updateChrome();
    accumulator = 0;
    if (name === 'tank' && !state.tankVisited && !opts.silent) {
      state.tankVisited = true;
      setTimeout(() => {
        if (!state.exporting && state.active === 'tank' && !tank.started) {
          tank.startFull();
          state.paused = false;
          setStarted(true);
          updatePauseUI();
        }
      }, 1100);
    }
  }

  function updateChrome() {
    const meta = SCENE_META[state.active];
    els.sceneEyebrow.textContent = meta.eyebrow;
    els.sceneTitle.textContent = meta.title;
    els.sceneSub.textContent = meta.sub;
    els.tankOnly = document.getElementById('tankOnly');
    updateModeUI();
    updateHud();
  }

  function updateModeUI() {
    $$('#jellyModes button').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === (jellyParams.mode || 'center'));
    });
    if (state.active === 'jelly') {
      const labels = { center: '单球 · 正中', offset: '单球 · 偏心', multi: '多球 · 连续' };
      els.modeText.textContent = labels[jellyParams.mode || 'center'];
    } else {
      const total = tank ? tank.getBallCount && tank.getBallCount() :
        (tankParams.groups.length * tankParams.ball.perGroup);
      els.modeText.textContent = `${tankParams.groups.length} 组 · ${total || 8} 球`;
    }
  }

  function updateHud() {
    const sc = activeScene();
    if (!sc) return;
    const phase = sc.getPhase ? sc.getPhase() : { label: '准备' };
    els.phaseText.textContent = phase.label;
    const t = sc.time || 0;
    els.timeText.innerHTML = `${t.toFixed(2)}<small>s</small>`;
    els.timelineFill.style.width = `${((sc.getProgress ? sc.getProgress() : 0) * 100).toFixed(1)}%`;

    if (state.active === 'jelly') {
      updatePrimaryLabel();
    } else {
      updatePrimaryLabel();
      updateWaveUI();
      updateModeUI();
    }
    updatePauseUI();
  }

  function updatePrimaryLabel() {
    const label = els.primaryLabel;
    if (state.active === 'jelly') {
      if (!jelly.started) label.textContent = '释放重球';
      else if (jelly.ended) label.textContent = '再次冲击';
      else label.textContent = '重新释放';
    } else {
      if (!tank.started) label.textContent = '开始完整实验';
      else if (tank.ended) label.textContent = '再次实验';
      else label.textContent = '重新开始实验';
    }
  }

  function updatePauseUI() {
    els.pauseBtn.classList.toggle('on', state.paused);
    els.pauseBtn.textContent = state.paused ? '继续' : '暂停';
  }

  function buildDensityLegend() {
    if (!els.densityLegend) return;
    const groups = (tank && tank.getDensityGroups) ? tank.getDensityGroups() : tankParams.groups;
    const html = groups.map((g) => {
      const stateText = g.density < 0.9 ? '漂浮' : (g.density < 1.06 ? '悬浮' : '下沉');
      return `<div class="legend-row"><i style="color:${g.color};background:${g.color}"></i>
        <span>${g.name}</span><b>ρ ${Number(g.density).toFixed(2)}</b><em>${stateText}</em></div>`;
    }).join('');
    els.densityLegend.innerHTML = html;
  }

  function updateWaveUI() {
    if (!tank.getWaveInfo) return;
    const info = tank.getWaveInfo();
    els.waveStatus.textContent = info.status || '';
    els.waveSmall.textContent = info.small || '';
    els.waveCount.textContent = info.count || '--';
    const circ = 2 * Math.PI * 18;
    els.waveDial.style.strokeDashoffset = String(circ * (1 - U.clamp(info.progress || 0, 0, 1)));
    if (info.state === 'active') els.waveDial.style.stroke = 'var(--amber)';
    else els.waveDial.style.stroke = 'var(--mint)';
    els.waveStartBtn.disabled = info.state === 'active';
    els.waveStopBtn.disabled = info.state !== 'active';
  }

  function setStarted(v) {
    state.started = v;
    updatePauseUI();
  }

  /* ============================================================
     参数面板
     ============================================================ */
  const JELLY_SCHEMA = [
    {
      title: '果冻体', items: [
        { path: 'jelly.scale', label: '整体尺寸', min: 0.72, max: 1.26, step: 0.01, fmt: (v) => v.toFixed(2) + '×' },
        { path: 'jelly.softness', label: '柔软程度', min: 0, max: 1, step: 0.01, fmt: (v) => (v < 0.34 ? '柔软' : v < 0.67 ? '适中' : '紧实') + ' ' + Math.round(v * 100) },
        { path: 'jelly.damping', label: '内部阻尼', min: 0.04, max: 0.8, step: 0.01, fmt: (v) => v.toFixed(2) },
        { path: 'jelly.density', label: '果冻密度', min: 0.6, max: 1.6, step: 0.02, fmt: (v) => v.toFixed(2) + ' ρw' }
      ]
    },
    {
      title: '重球', items: [
        { path: 'ball.mass', label: '质量', min: 8, max: 70, step: 1, fmt: (v) => v.toFixed(0) + ' kg' },
        { path: 'ball.radius', label: '半径', min: 0.28, max: 0.55, step: 0.01, fmt: (v) => v.toFixed(2) + ' m' },
        { path: 'ball.height', label: '初始高度', min: 0.7, max: 2.6, step: 0.05, fmt: (v) => v.toFixed(2) + ' m' },
        { path: 'ball.interval', label: '释放间隔 · 多球', min: 0.4, max: 2.0, step: 0.05, fmt: (v) => v.toFixed(2) + ' s' }
      ]
    },
    {
      title: '碰撞与环境', items: [
        { path: 'env.gravity', label: '重力', min: 3, max: 16, step: 0.1, fmt: (v) => v.toFixed(1) + ' m/s²' },
        { path: 'env.friction', label: '平台摩擦', min: 0, max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
        { path: 'env.restitution', label: '平台弹性', min: 0, max: 0.7, step: 0.01, fmt: (v) => v.toFixed(2) },
        {
          type: 'select', path: 'jelly.fixed', label: '底部固定方式',
          options: [{ value: true, label: '胶粘固定' }, { value: false, label: '自由放置' }]
        },
        { type: 'toggle', path: 'env.repeat', label: '重球连续多次撞击' }
      ]
    },
    {
      title: '色彩主题', items: [
        {
          type: 'color', path: 'jelly.color', label: '果冻色', options: [
            { value: 'mint', name: '薄荷', css: 'linear-gradient(135deg,#7effe4,#16a596)' },
            { value: 'berry', name: '莓果', css: 'linear-gradient(135deg,#ff9cc7,#b21e5b)' },
            { value: 'amber', name: '蜜桃', css: 'linear-gradient(135deg,#ffd98f,#d57118)' }
          ]
        }
      ]
    }
  ];

  function tankSchema() {
    const g = tankParams.groups || [];
    const groupItems = g.map((grp, i) => ({
      label: grp.name,
      dot: grp.color,
      min: i === 0 ? 0.15 : i === 1 ? 0.52 : i === 2 ? 0.9 : 1.15,
      max: i === 0 ? 0.5 : i === 1 ? 0.9 : i === 2 ? 1.1 : 2.6,
      step: 0.01,
      get: (p) => p.groups[i].density,
      set: (p, v) => { p.groups[i].density = v; },
      fmt: (v) => Number(v).toFixed(2)
    }));
    return [
      {
        title: '流体', items: [
          { get: (p) => p.fluid.level, set: (p, v) => { p.fluid.level = v; }, label: '水位高度', min: 1.15, max: 2.45, step: 0.01, fmt: (v) => v.toFixed(2) + ' m' },
          { get: (p) => p.fluid.gravity, set: (p, v) => { p.fluid.gravity = v; }, label: '重力', min: 3, max: 16, step: 0.1, fmt: (v) => v.toFixed(1) + ' m/s²' },
          { get: (p) => p.fluid.viscosity, set: (p, v) => { p.fluid.viscosity = v; }, label: '粘性 / 阻尼', min: 0.05, max: 1.4, step: 0.01, fmt: (v) => v.toFixed(2) }
        ]
      },
      {
        title: '造浪装置', items: [
          {
            type: 'select', get: (p) => p.wave.type, set: (p, v) => { p.wave.type = v; }, label: '装置类型',
            options: [
              { value: 'piston', label: '推板活塞' },
              { value: 'flap', label: '摆式波板' },
              { value: 'plunger', label: '垂直活塞' }
            ]
          },
          { get: (p) => p.wave.delay, set: (p, v) => { p.wave.delay = v; }, label: '入水后启动延迟', min: 0.2, max: 3, step: 0.1, fmt: (v) => v.toFixed(1) + ' s' },
          { get: (p) => p.wave.amplitude, set: (p, v) => { p.wave.amplitude = v; }, label: '运动幅度', min: 0.04, max: 0.36, step: 0.01, fmt: (v) => v.toFixed(2) + ' m' },
          { get: (p) => p.wave.frequency, set: (p, v) => { p.wave.frequency = v; }, label: '运动频率', min: 0.2, max: 1.5, step: 0.01, fmt: (v) => v.toFixed(2) + ' Hz' },
          { get: (p) => p.wave.duration, set: (p, v) => { p.wave.duration = v; }, label: '持续时长', min: 1, max: 10, step: 0.1, fmt: (v) => v.toFixed(1) + ' s' }
        ]
      },
      {
        title: '小球', items: [
          { get: (p) => p.ball.radius, set: (p, v) => { p.ball.radius = v; }, label: '统一半径', min: 0.17, max: 0.3, step: 0.005, fmt: (v) => v.toFixed(3) + ' m' },
          { get: (p) => p.ball.perGroup, set: (p, v) => { p.ball.perGroup = Math.round(v); }, label: '每组数量', min: 2, max: 5, step: 1, fmt: (v) => v.toFixed(0) + ' 颗' },
          { get: (p) => p.ball.releaseHeight, set: (p, v) => { p.ball.releaseHeight = v; }, label: '释放高度', min: 0.35, max: 2.0, step: 0.05, fmt: (v) => v.toFixed(2) + ' m' }
        ]
      },
      { title: '密度分组 · g/cm³', items: groupItems },
      {
        title: '水槽', items: [
          { get: (p) => p.tank.length, set: (p, v) => { p.tank.length = v; }, label: '长度', min: 6.2, max: 10, step: 0.1, fmt: (v) => v.toFixed(1) + ' m' },
          { get: (p) => p.tank.width, set: (p, v) => { p.tank.width = v; }, label: '纵深宽度', min: 2.2, max: 4.2, step: 0.1, fmt: (v) => v.toFixed(1) + ' m' },
          { get: (p) => p.tank.height, set: (p, v) => { p.tank.height = v; }, label: '高度', min: 2.4, max: 3.6, step: 0.1, fmt: (v) => v.toFixed(1) + ' m' }
        ]
      }
    ];
  }

  function resolveGet(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }
  function resolveSet(obj, path, value) {
    const parts = path.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  }

  const controlRegistry = { jelly: [], tank: [] };

  function buildParams() {
    buildPanel('jelly', JELLY_SCHEMA, jellyParams, els.jellyParams);
    buildPanel('tank', tankSchema(), tankParams, els.tankParams);
  }

  function buildPanel(sceneKey, schema, params, container) {
    container.innerHTML = '';
    for (const group of schema) {
      const gdiv = document.createElement('div');
      gdiv.className = 'param-group';
      const title = document.createElement('div');
      title.className = 'group-title';
      title.textContent = group.title;
      gdiv.appendChild(title);

      for (const item of group.items) {
        const row = document.createElement('div');
        row.className = 'param';
        const head = document.createElement('div');
        head.className = 'param-head';
        const label = document.createElement('label');
        if (item.dot) {
          label.innerHTML = `<i class="param-dot" style="background:${item.dot}"></i>${item.label}`;
        } else {
          label.textContent = item.label;
        }
        const output = document.createElement('output');
        head.appendChild(label);
        head.appendChild(output);
        row.appendChild(head);

        const get = item.get ? () => item.get(params) : () => resolveGet(params, item.path);
        const set = item.set ? (v) => item.set(params, v) : (v) => resolveSet(params, item.path, v);
        const fmt = item.fmt || ((v) => v);

        if (item.type === 'select') {
          const sel = document.createElement('select');
          item.options.forEach((opt, i) => {
            const o = document.createElement('option');
            o.value = String(i);
            o.textContent = opt.label;
            sel.appendChild(o);
          });
          const idx = item.options.findIndex((o) => o.value === get());
          sel.selectedIndex = Math.max(0, idx);
          output.textContent = item.options[sel.selectedIndex].label;
          sel.addEventListener('change', () => {
            const val = item.options[sel.selectedIndex].value;
            set(val);
            output.textContent = item.options[sel.selectedIndex].label;
            paramsChanged(sceneKey, item);
          });
          row.appendChild(sel);
          controlRegistry[sceneKey].push({ item, get, set, output, sel, fmt });
        } else if (item.type === 'toggle') {
          const t = document.createElement('div');
          t.className = 'toggle' + (get() ? ' on' : '');
          head.appendChild(t);
          output.style.display = 'none';
          t.addEventListener('click', () => {
            const v = !get();
            set(v);
            t.classList.toggle('on', v);
            updateModeUI();
            paramsChanged(sceneKey, item);
          });
          row.appendChild(t);
          controlRegistry[sceneKey].push({ item, get, set, output, toggle: t, fmt });
        } else if (item.type === 'color') {
          const wrap = document.createElement('div');
          wrap.className = 'color-row';
          item.options.forEach((opt) => {
            const sw = document.createElement('button');
            sw.className = 'swatch' + (get() === opt.value ? ' active' : '');
            sw.style.background = opt.css;
            sw.title = opt.name;
            sw.addEventListener('click', () => {
              set(opt.value);
              wrap.querySelectorAll('.swatch').forEach((x) => x.classList.remove('active'));
              sw.classList.add('active');
              output.textContent = opt.name;
              paramsChanged(sceneKey, item);
            });
            wrap.appendChild(sw);
          });
          output.textContent = (item.options.find((o) => o.value === get()) || {}).name || '';
          row.appendChild(wrap);
          controlRegistry[sceneKey].push({ item, get, set, output, fmt, swatches: Array.from(wrap.querySelectorAll('.swatch')) });
        } else {
          const input = document.createElement('input');
          input.type = 'range';
          input.min = item.min;
          input.max = item.max;
          input.step = item.step;
          input.value = get();
          output.textContent = fmt(Number(get()));
          input.addEventListener('input', () => {
            let v = Number(input.value);
            if (item.step >= 1) v = Math.round(v);
            set(v);
            output.textContent = fmt(v);
          });
          input.addEventListener('change', () => {
            paramsChanged(sceneKey, item);
          });
          row.appendChild(input);
          controlRegistry[sceneKey].push({ item, input, get, set, output, fmt });
        }
        gdiv.appendChild(row);
      }
      container.appendChild(gdiv);
    }
  }

  function syncControls(sceneKey) {
    const params = sceneKey === 'jelly' ? jellyParams : tankParams;
    for (const c of controlRegistry[sceneKey]) {
      const v = c.get();
      if (c.input) c.input.value = v;
      if (c.sel) {
        const idx = c.item.options.findIndex((o) => o.value === v);
        c.sel.selectedIndex = idx >= 0 ? idx : 0;
        if (c.output) c.output.textContent = c.item.options[c.sel.selectedIndex].label;
      } else if (c.item.type === 'color') {
        if (c.output) {
          const opt = c.item.options.find((o) => o.value === v);
          c.output.textContent = opt ? opt.name : '';
        }
        if (c.swatches) {
          c.swatches.forEach((sw, idx) => sw.classList.toggle('active', c.item.options[idx].value === v));
        }
      } else if (c.toggle) {
        c.toggle.classList.toggle('on', !!v);
      } else if (c.output && c.fmt) {
        c.output.textContent = c.fmt(Number(v));
      }
    }
  }

  function paramsChanged(sceneKey, item) {
    if (sceneKey === 'jelly') {
      clearTimeout(paramApplyTimer);
      paramApplyTimer = setTimeout(() => {
        if (state.exporting) return;
        jelly.configure(clone(jellyParams));
        syncModeFromParams();
        buildDensityLegend();
        updateModeUI();
        scheduleJellyRerun();
      }, 140);
    } else {
      clearTimeout(paramApplyTimer);
      paramApplyTimer = setTimeout(() => {
        if (state.exporting) return;
        tank.configure(clone(tankParams));
        buildDensityLegend();
        updateModeUI();
        updateWaveUI();
        updatePrimaryLabel();
      }, 160);
    }
  }

  function syncModeFromParams() {
    $$('#jellyModes button').forEach((b) => b.classList.toggle('active', b.dataset.mode === jellyParams.mode));
  }

  function scheduleJellyRerun() {
    clearTimeout(jellyRerunTimer);
    jellyRerunTimer = setTimeout(() => {
      if (state.exporting || state.active !== 'jelly') return;
      jelly.trigger(0.45);
      state.paused = false;
      updatePauseUI();
    }, 520);
  }

  /* ============================================================
     交互绑定
     ============================================================ */
  function bindUI() {
    els.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        audio.ui();
        setScene(tab.dataset.scene);
      });
    });

    $$('#jellyModes button').forEach((b) => {
      b.addEventListener('click', () => {
        if (state.exporting) return;
        const mode = b.dataset.mode;
        if (jellyParams.mode === mode) return;
        jellyParams.mode = mode;
        syncModeFromParams();
        clearTimeout(jellyRerunTimer);
        jelly.setMode(mode);
        audio.ui();
        setTimeout(() => {
          if (!state.exporting && state.active === 'jelly') {
            jelly.trigger(0.5);
            state.paused = false;
            updatePauseUI();
          }
        }, 500);
      });
    });

    els.primaryBtn.addEventListener('click', () => {
      if (state.exporting) return;
      audio.ui();
      state.paused = false;
      updatePauseUI();
      if (state.active === 'jelly') {
        jelly.trigger(jelly.started ? 0.35 : 0.25);
      } else {
        if (tank.started && !tank.ended) {
          tank.reset();
        }
        tank.startFull();
        state.tankVisited = true;
      }
    });

    els.pauseBtn.addEventListener('click', () => {
      if (state.exporting) return;
      state.paused = !state.paused;
      audio.ui();
      updatePauseUI();
    });

    els.resetBtn.addEventListener('click', () => {
      if (state.exporting) return;
      audio.ui();
      clearTimeout(jellyRerunTimer);
      if (state.active === 'jelly') jelly.reset();
      else tank.reset();
      state.paused = false;
      accumulator = 0;
      updatePauseUI();
      updateHud();
    });

    els.speedSwitch.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        state.speed = Number(b.dataset.speed);
        els.speedSwitch.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
        audio.ui();
      });
    });

    els.soundBtn.addEventListener('click', () => {
      ensureAudio();
      state.soundOn = !state.soundOn;
      audio.setEnabled(state.soundOn);
      els.soundBtn.classList.toggle('off', !state.soundOn);
      els.soundState.textContent = state.soundOn ? '开' : '关';
      els.audioHint.classList.add('gone');
      if (state.soundOn) audio.ui();
    });

    els.audioHint.addEventListener('click', () => {
      ensureAudio();
      state.soundOn = true;
      audio.setEnabled(true);
      els.soundBtn.classList.remove('off');
      els.soundState.textContent = '开';
      els.audioHint.classList.add('gone');
    });

    els.panelBtn.addEventListener('click', () => els.panel.classList.toggle('hidden'));
    els.panelClose.addEventListener('click', () => els.panel.classList.add('hidden'));

    els.waveStartBtn.addEventListener('click', () => {
      if (state.exporting) return;
      ensureAudio();
      tank.startWave();
      audio.ui();
      state.paused = false;
      updatePauseUI();
      updateWaveUI();
    });
    els.waveStopBtn.addEventListener('click', () => {
      if (state.exporting) return;
      tank.stopWave();
      audio.ui();
      updateWaveUI();
    });
    els.releaseBtn.addEventListener('click', () => {
      if (state.exporting) return;
      ensureAudio();
      tank.releaseBalls();
      state.paused = false;
      updatePauseUI();
    });

    // 拖动滑块后自动隐藏声音提示（交互已发生）
    document.addEventListener('pointerdown', () => {
      if (els.audioHint) els.audioHint.classList.add('gone');
    }, { once: true });
  }

  function ensureAudio() {
    if (!audio.ctx) audio.init();
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
  }

  function onKeyDown(e) {
    if (state.exporting) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      state.paused = !state.paused;
      updatePauseUI();
    } else if (e.key === 'r' || e.key === 'R') {
      if (state.active === 'jelly') jelly.reset();
      else tank.reset();
      state.paused = false;
      updatePauseUI();
    } else if (e.key === '1') {
      setScene('jelly');
    } else if (e.key === '2') {
      setScene('tank');
    }
  }

  /* ============================================================
     视频导出
     ============================================================ */
  const JELLY_EXPORT = {
    'jelly-center': {
      duration: 7.6,
      preset: {
        mode: 'center',
        jelly: { scale: 1, softness: 0.55, damping: 0.22, density: 1, fixed: true, color: 'mint' },
        ball: { mass: 24, radius: 0.42, height: 1.8, count: 3, interval: 0.9 },
        env: { gravity: 9.8, friction: 0.55, restitution: 0.22, repeat: false }
      }
    },
    'jelly-multi': {
      duration: 11.0,
      preset: {
        mode: 'multi',
        jelly: { scale: 1, softness: 0.56, damping: 0.2, density: 1, fixed: true, color: 'mint' },
        ball: { mass: 18, radius: 0.38, height: 2.0, count: 3, interval: 0.95 },
        env: { gravity: 9.8, friction: 0.55, restitution: 0.22, repeat: false }
      }
    },
    'jelly-offset': {
      duration: 8.6,
      preset: {
        mode: 'offset',
        jelly: { scale: 1, softness: 0.62, damping: 0.18, density: 1, fixed: true, color: 'mint' },
        ball: { mass: 24, radius: 0.42, height: 1.8, count: 1, interval: 0.9 },
        env: { gravity: 9.8, friction: 0.55, restitution: 0.22, repeat: false }
      }
    }
  };

  function installExport() {
    window.videoExport = {
      runs: RUNS.slice(),
      begin: async function (runId, opts) {
        if (RUNS.indexOf(runId) < 0) throw new Error('unknown run: ' + runId);
        const fps = opts && Number.isFinite(opts.fps) && opts.fps > 0 ? Math.round(opts.fps) : 60;
        if (state.exporting) endExport();

        exportSaved = {
          active: state.active,
          jelly: clone(jellyParams),
          tank: clone(tankParams),
          soundOn: state.soundOn
        };
        state.exporting = true;
        state.paused = true;
        els.loading.classList.add('done');
        document.body.classList.add('exporting');
        audio.setEnabled(false);
        els.panel.classList.add('hidden'); // 防止过渡瞬间露边
        window.scrollTo(0, 0);

        resize();

        if (runId.indexOf('jelly') === 0) {
          const conf = JELLY_EXPORT[runId];
          setScene('jelly', { force: true, silent: true, allowExport: true });
          jelly.applyPreset(clone(conf.preset));
          jelly.exportReset();
          jelly.trigger(0.9);
          exportState = {
            kind: 'jelly',
            scene: jelly,
            fps,
            frames: Math.ceil(conf.duration * fps),
            duration: conf.duration,
            steps: 0
          };
          await settleLayout();
          jelly.render(1 / 60);
          finishFrame();
          return { frames: exportState.frames };
        }

        // tank-full
        setScene('tank', { force: true, silent: true, allowExport: true });
        tank.applyPreset(clone(TankScene.DEFAULTS));
        const info = tank.exportReset();
        const tLast = Math.max(0.2, info.tLast || 1.6);
        const duration = tLast + 1.0 + 5.0 + 6.0;
        exportState = {
          kind: 'tank',
          scene: tank,
          fps,
          frames: Math.ceil(duration * fps),
          duration,
          steps: 0,
          tLast
        };
        await settleLayout();
        tank.render(1 / 60);
        finishFrame();
        return { frames: exportState.frames };
      },

      frame: async function (i) {
        if (!state.exporting || !exportState) return;
        const targetSteps = Math.round((i / exportState.fps) / SIM_DT);
        const sc = exportState.scene;
        let guard = 0;
        while (exportState.steps < targetSteps && guard < 4000) {
          sc.step(SIM_DT);
          exportState.steps++;
          guard++;
        }
        sc.render(1 / 60);
        finishFrame();
      },

      end: function () {
        endExport();
      }
    };
  }

  function finishFrame() {
    const gl = renderer.getContext();
    if (gl && gl.finish) gl.finish();
  }

  function settleLayout() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  function endExport() {
    if (!state.exporting) return;
    state.exporting = false;
    exportState = null;
    document.body.classList.remove('exporting');
    els.panel.classList.remove('hidden');

    if (exportSaved) {
      // 恢复用户离开时的参数与场景
      jelly.exportMode = false;
      tank.exportMode = false;
      jelly.applyPreset(clone(exportSaved.jelly));
      tank.applyPreset(clone(exportSaved.tank));
      Object.keys(jellyParams).forEach((k) => delete jellyParams[k]);
      Object.assign(jellyParams, clone(exportSaved.jelly));
      Object.keys(tankParams).forEach((k) => delete tankParams[k]);
      Object.assign(tankParams, clone(exportSaved.tank));
      buildDensityLegend();
      syncControls('jelly');
      syncControls('tank');
      setScene(exportSaved.active, { force: true, silent: true });
      state.paused = false;
      state.soundOn = exportSaved.soundOn;
      audio.setEnabled(state.soundOn);
    }
    resize();
    syncModeFromParams();
    updateChrome();
    updatePauseUI();
    lastFrame = performance.now();
    accumulator = 0;
    exportSaved = null;
  }

  /* ============================================================
     启动
     ============================================================ */
  let booted = false;

  document.addEventListener('DOMContentLoaded', () => {
    boot();
  });

  if (document.readyState !== 'loading') {
    boot();
  }

  function boot() {
    if (booted) return;
    booted = true;
    try {
      init();
      installExport();
      window.__labReady = true;
    } catch (err) {
      console.error(err);
      const loadingSub = document.querySelector('.loading-sub');
      if (loadingSub) loadingSub.textContent = '初始化失败：' + err.message;
      const ls = document.querySelector('.loading');
      if (ls) ls.classList.add('done');
    }
  }
})();
