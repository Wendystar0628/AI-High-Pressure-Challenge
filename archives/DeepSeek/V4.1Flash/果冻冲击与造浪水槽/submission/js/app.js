/* app.js — UI, scene switching, demo reels, deterministic video export */
(function () {
  'use strict';

  const DEFAULT_CAMS = {
    jelly: { target: [0.0, 0.33, -0.02], yaw: 0.34, pitch: 0.28, dist: 3.45 },
    tank: { target: [0.0, 0.58, 0], yaw: 0.32, pitch: 0.21, dist: 4.05 }
  };

  function camSample(keys, t) {
    if (!keys || !keys.length) return null;
    if (t <= keys[0].t) return { eye: keys[0].eye, target: keys[0].target };
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t >= a.t && t <= b.t) {
        let u = (t - a.t) / Math.max(1e-6, b.t - a.t);
        u = u * u * (3 - 2 * u);
        return { eye: V3.lerp(a.eye, b.eye, u), target: V3.lerp(a.target, b.target, u) };
      }
    }
    const l = keys[keys.length - 1];
    return { eye: l.eye, target: l.target };
  }

  const RUNS = {
    'jelly-center': {
      scene: 'jelly', duration: 7.6, title: '正中单击', sub: '包覆 · 压扁 · 回弹',
      captionSub: 'HEAVY BALL · CENTER IMPACT',
      init(app) {
        const j = app.jelly;
        j.sim && (j.sim.balls.length = 0);
        j.setParams({ selected: 0, softness: 0.70, toughness: 0.64, mass: 25, height: 1.15 });
        j.reset();
        app.syncJellyUI();
        j.sim.ballJellyRestitution = 0.34;
      },
      events: [{ t: 0.0, fn: (app) => app.jelly.trigger('center') }],
      speed: (t) => (t < 0.36 ? 1.0 : (t < 2.35 ? 0.28 : 1.0)),
      camera: [
        { t: 0, eye: [0.62, 1.72, 3.55], target: [-0.20, 0.82, 0.0] },
        { t: 0.36, eye: [0.42, 1.16, 2.72], target: [-0.30, 0.50, 0.0] },
        { t: 0.62, eye: [0.10, 0.72, 1.82], target: [-0.38, 0.38, 0.02] },
        { t: 2.4, eye: [0.24, 0.88, 2.10], target: [-0.34, 0.42, 0.02] },
        { t: 7.6, eye: [0.62, 1.05, 2.55], target: [-0.18, 0.34, 0.0] }
      ]
    },
    'jelly-multi': {
      scene: 'jelly', duration: 9.8, title: '连击', sub: '叠加振荡 · 直至开裂',
      captionSub: 'TRIPLE IMPACT · FRACTURE',
      init(app) {
        const j = app.jelly;
        j.setParams({ selected: 0, softness: 0.80, toughness: 0.27, mass: 28, height: 1.05 });
        j.reset();
        app.syncJellyUI();
        j.sim.ballJellyRestitution = 0.30;
      },
      events: [{ t: 0.0, fn: (app) => app.jelly.trigger('multi') }],
      speed: (t) => (t < 4.2 ? 0.55 : 1.0),
      camera: [
        { t: 0, eye: [1.05, 2.05, 3.95], target: [-0.12, 0.85, 0.0] },
        { t: 1.2, eye: [0.65, 1.42, 3.05], target: [-0.25, 0.60, 0.0] },
        { t: 3.0, eye: [0.25, 0.92, 2.35], target: [-0.36, 0.42, 0.02] },
        { t: 6.2, eye: [0.48, 1.02, 2.60], target: [-0.30, 0.35, 0.0] },
        { t: 9.8, eye: [0.82, 1.12, 2.95], target: [-0.15, 0.32, 0.0] }
      ]
    },
    'jelly-offset': {
      scene: 'jelly', duration: 7.8, title: '偏心一击', sub: '倾斜 · 滑移 · 连锁碰撞',
      captionSub: 'OFF-CENTER IMPACT · SLIDE',
      init(app) {
        const j = app.jelly;
        j.setParams({ selected: 1, softness: 0.46, toughness: 0.82, mass: 20, height: 1.30 });
        j.reset();
        app.syncJellyUI();
        j.sim.ballJellyRestitution = 0.36;
      },
      events: [{ t: 0.0, fn: (app) => app.jelly.trigger('offset') }],
      speed: (t) => (t < 0.48 ? 1.0 : (t < 2.55 ? 0.34 : 1.0)),
      camera: [
        { t: 0, eye: [1.65, 1.66, 3.45], target: [0.58, 0.62, 0.02] },
        { t: 0.5, eye: [1.50, 1.26, 2.95], target: [0.62, 0.44, 0.02] },
        { t: 1.6, eye: [1.55, 1.02, 2.95], target: [0.70, 0.34, 0.04] },
        { t: 4.4, eye: [1.42, 0.96, 2.78], target: [0.82, 0.28, 0.02] },
        { t: 7.8, eye: [1.55, 1.02, 3.05], target: [0.62, 0.30, 0.0] }
      ]
    },
    'tank-full': {
      scene: 'tank', duration: 19.5, title: '风浪', sub: '入水 · 密度分化 · 破碎拍壁',
      captionSub: 'MULTI-DENSITY TANK · STORM',
      init(app) {
        app.tank.reset();
        app.tank.setParams({ amplitude: 0.55, frequency: 0.9, densities: app.tank.densities ? app.tank.densities.slice() : [0.32, 0.86, 1.0, 2.3] });
        app.tank.setWaveGuide(true);
      },
      events: [
        { t: 0.0, fn: (app) => app.tank.releaseBalls() },
        { t: 0.9, fn: (app) => app.tank.startWave() },
        { t: 2.5, fn: (app) => app.tank.setAmpTarget(0.28) },
        { t: 5.0, fn: (app) => app.tank.setAmpTarget(0.50) },
        { t: 8.2, fn: (app) => app.tank.setAmpTarget(0.80) },
        { t: 11.4, fn: (app) => app.tank.setAmpTarget(1.0) },
        { t: 15.4, fn: (app) => app.tank.stopWave() }
      ],
      speed: (t) => (t > 8.0 && t < 14.0 ? 0.72 : 1.0),
      camera: [
        { t: 0, eye: [2.7, 2.1, 4.9], target: [0.0, 0.78, 0.0] },
        { t: 2.2, eye: [2.45, 1.70, 4.45], target: [0.0, 0.66, 0.0] },
        { t: 6.5, eye: [2.1, 1.38, 3.95], target: [0.02, 0.60, 0.0] },
        { t: 10.5, eye: [1.65, 1.10, 3.45], target: [0.05, 0.58, 0.0] },
        { t: 14.5, eye: [1.80, 1.22, 3.70], target: [0.02, 0.60, 0.0] },
        { t: 19.5, eye: [2.45, 1.65, 4.55], target: [0.0, 0.66, 0.0] }
      ]
    }
  };

  class App {
    constructor() {
      this.active = 'jelly';
      this.paused = false;
      this.slow = 1;
      this.demo = null;
      this.demoBusy = false;
      this.exporting = false;
      this.time = 0;
      this.simAcc = 0;
      this.lastTime = 0;
      this.demoTarget = 0;
      this.cameraDragging = false;
      this.dragMoved = 0;
      this._last = { x: 0, y: 0 };
      this._demoEndTimer = 0;
    }

    async init() {
      this.setLoader(8, '初始化 WebGL2 渲染器');
      this.canvas = document.getElementById('view');
      try {
        this.renderer = new Renderer(this.canvas);
      } catch (e) {
        console.error(e);
        this.setLoader(100, '初始化失败：' + e.message);
        return;
      }
      this.renderer.exportMode = false;
      this.audio = new AudioLab();
      this.setLoader(28, '构建四面体软体与舞台');
      this.jelly = new SceneJelly(this.renderer);
      this.jelly.setAudio(this.audio);
      this.setLoader(44, '连接 WebGPU 流体求解器');
      this.tank = new SceneTank(this.renderer);
      this.tank.setAudio(this.audio);
      if (this.tank.init) {
        try { await this.tank.init(); } catch (e) { console.error('tank init', e); this.tank.error = e.message; }
      }
      this.setLoader(78, '预计算光照与材质');
      this.tank.reset();
      this.tank.warmup().catch(e => console.error(e));
      this.jelly._framed = true;
      this.tank._framed = true;
      this.renderer.camera.setOrbit(DEFAULT_CAMS.jelly.target, DEFAULT_CAMS.jelly.yaw, DEFAULT_CAMS.jelly.pitch, DEFAULT_CAMS.jelly.dist);
      this.bindUI();
      this.bindPointer();
      this.bindKeys();
      this.setLoader(100, '准备就绪');
      const self = this;
      window.videoExport = {
        runs: ['jelly-center', 'jelly-multi', 'jelly-offset', 'tank-full'],
        begin: (runId, opts) => self.beginExport(runId, opts),
        frame: (i) => self.exportFrame(i),
        end: () => self.endExport()
      };
      this.lastTime = performance.now();
      this.renderer.resize();
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
      setTimeout(() => {
        document.getElementById('loader').classList.add('done');
      }, 260);
      setTimeout(() => this.toast('拖拽旋转视角 · 滚轮缩放 · 试试预置演示'), 2200);
    }

    setLoader(pct, text) {
      const bar = document.getElementById('loaderBar');
      const st = document.getElementById('loaderStatus');
      if (bar) bar.style.width = pct + '%';
      if (st && text) st.textContent = text;
    }

    toast(msg) {
      const el = document.getElementById('toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => el.classList.remove('show'), 2600);
    }

    sceneObj() { return this.active === 'jelly' ? this.jelly : this.tank; }

    applyDefaultCamera(which = this.active) {
      const c = DEFAULT_CAMS[which] || DEFAULT_CAMS.jelly;
      this.renderer.camera.setOrbit(c.target, c.yaw, c.pitch, c.dist);
    }

    /* ---------------- UI ---------------- */
    bindUI() {
      const $ = (id) => document.getElementById(id);
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => this.switchScene(tab.dataset.scene));
      });
      const bindRange = (id, fn) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener('input', () => fn(parseFloat(el.value)));
      };
      bindRange('softness', v => {
        this.jelly.params.softness = v / 100;
        $('#softnessVal').textContent = Math.round(v);
        this.jelly.setParams({ softness: v / 100 });
      });
      bindRange('toughness', v => {
        this.jelly.params.toughness = v / 100;
        $('#toughnessVal').textContent = Math.round(v);
        this.jelly.setParams({ toughness: v / 100 });
      });
      bindRange('ballMass', v => {
        this.jelly.params.mass = v;
        $('#ballMassVal').innerHTML = v + ' <small>kg</small>';
      });
      bindRange('dropHeight', v => {
        this.jelly.params.height = v;
        $('#dropHeightVal').innerHTML = v.toFixed(2) + ' <small>m</small>';
      });
      document.querySelectorAll('#jellyPick .seg-btn').forEach(btn => {
        btn.addEventListener('click', () => this.selectJelly(parseInt(btn.dataset.jelly, 10)));
      });
      document.querySelectorAll('.impact-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.demo) this.stopDemo();
          this.jelly.trigger(btn.dataset.mode);
          btn.classList.add('fire');
          setTimeout(() => btn.classList.remove('fire'), 260);
          this.audio.ensure();
        });
      });
      bindRange('amplitude', v => {
        $('#amplitudeVal').textContent = Math.round(v);
        this.tank.setParams({ amplitude: v / 100 });
      });
      bindRange('frequency', v => {
        $('#frequencyVal').innerHTML = v.toFixed(2) + ' <small>Hz</small>';
        this.tank.setParams({ frequency: v });
      });
      document.querySelectorAll('.density').forEach(inp => {
        inp.addEventListener('input', () => {
          const g = parseInt(inp.dataset.group, 10);
          const v = parseFloat(inp.value);
          const el = document.getElementById('rho' + g);
          if (el) el.textContent = v.toFixed(2);
          const arr = this.tank.densities ? this.tank.densities.slice() : [0.32, 0.86, 1.0, 2.3];
          arr[g] = v;
          this.tank.setParams({ densities: arr });
        });
      });
      $('waveBtn').addEventListener('click', () => {
        if (this.tank.waveOn) this.tank.stopWave(); else this.tank.startWave();
        this.audio.ensure();
      });
      $('releaseBtn').addEventListener('click', () => { this.tank.releaseBalls(); this.audio.ensure(); });
      $('playBtn').addEventListener('click', () => this.togglePause());
      $('slowBtn').addEventListener('click', () => this.toggleSlow());
      $('resetBtn').addEventListener('click', () => this.resetAll());
      $('soundBtn').addEventListener('click', () => {
        const on = this.audio.setEnabled(!this.audio.enabled);
        $('soundBtn').classList.toggle('muted', !on);
        this.toast(on ? '声音已开启' : '声音已静音');
      });
      $('helpBtn').addEventListener('click', () => $('helpModal').classList.remove('hidden'));
      $('helpClose').addEventListener('click', () => $('helpModal').classList.add('hidden'));
      $('helpModal').addEventListener('click', (e) => { if (e.target.id === 'helpModal') $('helpModal').classList.add('hidden'); });
      $('copyApi').addEventListener('click', () => {
        const txt = "window.videoExport.runs\nawait window.videoExport.begin('jelly-center', { fps: 60 })\nfor (let i = 0; i < frames; i++) await window.videoExport.frame(i)\nwindow.videoExport.end()";
        try {
          navigator.clipboard.writeText(txt).then(() => this.toast('导出接口代码已复制'), () => this.toast('导出接口：window.videoExport'));
        } catch (e) { this.toast('导出接口：window.videoExport'); }
      });
      document.querySelectorAll('.demo-item').forEach(item => {
        item.addEventListener('click', () => this.playDemo(item.dataset.run));
      });
      $('demoStop').addEventListener('click', () => this.stopDemo());
      $('demoExit').addEventListener('click', () => this.stopDemo());
      document.addEventListener('pointerdown', () => this.audio.ensure(), { once: false });
      document.addEventListener('keydown', () => this.audio.ensure());
      window.addEventListener('resize', () => this.renderer.resize());

      // initial UI sync
      this.syncJellyUI();
      this.updateStatus();
    }

    syncJellyUI() {
      const p = this.jelly.params;
      const $ = (id) => document.getElementById(id);
      const so = $('softness'), to = $('toughness'), ma = $('ballMass'), he = $('dropHeight');
      if (so) so.value = Math.round(p.softness * 100);
      if (to) to.value = Math.round(p.toughness * 100);
      if (ma) ma.value = p.mass;
      if (he) he.value = p.height;
      if ($('softnessVal')) $('softnessVal').textContent = Math.round(p.softness * 100);
      if ($('toughnessVal')) $('toughnessVal').textContent = Math.round(p.toughness * 100);
      if ($('ballMassVal')) $('ballMassVal').innerHTML = Math.round(p.mass) + ' <small>kg</small>';
      if ($('dropHeightVal')) $('dropHeightVal').innerHTML = p.height.toFixed(2) + ' <small>m</small>';
      document.querySelectorAll('#jellyPick .seg-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.jelly, 10) === p.selected));
      const meta = this.jelly.targets[p.selected];
      if ($('jellySpec')) $('jellySpec').textContent = meta.spec;
    }

    selectJelly(i) {
      this.jelly.params.selected = i;
      this.jelly.setParams({ selected: i });
      this.syncJellyUI();
    }

    switchScene(name) {
      if (this.exporting) return;
      if (this.demo) this.stopDemo();
      if (name === this.active) return;
      this.active = name;
      this.simAcc = 0;
      this.paused = false;
      if (name === 'tank' && this.tank.warmup) this.tank.warmup().catch(e => console.error(e));
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.scene === name));
      document.getElementById('panelJelly').classList.toggle('hidden', name !== 'jelly');
      document.getElementById('panelTank').classList.toggle('hidden', name !== 'tank');
      this.applyDefaultCamera(name);
      this.updateStatus();
      this.renderer.resize();
    }

    updateTabs() {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.scene === this.active));
      document.getElementById('panelJelly').classList.toggle('hidden', this.active !== 'jelly');
      document.getElementById('panelTank').classList.toggle('hidden', this.active !== 'tank');
    }

    togglePause() {
      this.paused = !this.paused;
      this.updateStatus();
      this.updateTransport();
    }
    toggleSlow() {
      this.slow = this.slow === 1 ? 0.25 : 1;
      document.getElementById('slowBtn').classList.toggle('active', this.slow !== 1);
      document.getElementById('slowBtn').textContent = this.slow === 1 ? '0.25×' : '1×';
      this.updateStatus();
    }
    updateTransport() {
      document.querySelector('#playBtn .pause').classList.toggle('hidden', this.paused);
      document.querySelector('#playBtn .play').classList.toggle('hidden', !this.paused);
    }
    updateStatus() {
      const led = document.getElementById('statusLed');
      const txt = document.getElementById('statusText');
      if (!led) return;
      let s = '实时模拟';
      let color = '#5ee6c8';
      if (this.exporting) { s = '逐帧导出'; color = '#ff7e70'; }
      else if (this.demo) { s = this.paused ? '演示暂停' : '演示播放'; color = '#f4b860'; }
      else if (this.paused) { s = '已暂停'; color = '#8ba1a4'; }
      else if (this.slow !== 1) { s = '慢放 0.25×'; color = '#f4b860'; }
      txt.textContent = s;
      led.style.background = color;
      led.style.boxShadow = '0 0 8px ' + color;
      if (document.getElementById('waveBtn')) {
        const on = this.tank && this.tank.waveOn;
        const btn = document.getElementById('waveBtn');
        btn.classList.toggle('on', !!on);
        btn.innerHTML = '<span class="led"></span>' + (on ? '停止造浪' : '开始造浪');
        const ws = document.getElementById('waveState');
        if (ws) ws.textContent = on ? '运行' : '停';
      }
    }

    resetAll() {
      if (this.exporting) return;
      if (this.demo) this.stopDemo();
      this.paused = false;
      this.slow = 1;
      document.getElementById('slowBtn').classList.remove('active');
      document.getElementById('slowBtn').textContent = '0.25×';
      if (this.active === 'jelly') { this.jelly.reset(); this.jelly.setParams(this.jelly.params); }
      else this.tank.reset();
      this.applyDefaultCamera();
      this.simAcc = 0;
      this.updateTransport();
      this.updateStatus();
      this.toast('场景已重置');
    }

    /* ---------------- pointer / camera ---------------- */
    bindPointer() {
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => {
        if (this.exporting) return;
        if (e.button !== 0) return;
        this.audio.ensure();
        this.cameraDragging = true;
        this.dragMoved = 0;
        this._last = { x: e.clientX, y: e.clientY };
        c.setPointerCapture(e.pointerId);
      });
      c.addEventListener('pointermove', (e) => {
        if (!this.cameraDragging || this.demo) return;
        const dx = e.clientX - this._last.x, dy = e.clientY - this._last.y;
        this._last = { x: e.clientX, y: e.clientY };
        this.dragMoved += Math.abs(dx) + Math.abs(dy);
        this.renderer.camera.orbit(dx, dy);
      });
      const up = (e) => {
        if (!this.cameraDragging) return;
        this.cameraDragging = false;
        if (this.exporting) return;
        if (this.demo) return;
        if (this.dragMoved < 5 && this.active === 'jelly') {
          const ray = this.screenRay(e.clientX, e.clientY);
          if (ray) {
            const hit = this.jelly.pick(ray.o, ray.d);
            if (hit >= 0) { this.selectJelly(hit); this.toast('冲击目标：' + this.jelly.targets[hit].name); }
          }
        }
      };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', () => { this.cameraDragging = false; });
      c.addEventListener('wheel', (e) => {
        if (this.exporting) return;
        e.preventDefault();
        if (this.demo) return;
        this.renderer.camera.zoom(e.deltaY);
      }, { passive: false });
      c.addEventListener('dblclick', () => {
        if (this.exporting) return;
        if (this.demo) this.stopDemo();
        this.applyDefaultCamera();
      });
      c.addEventListener('click', () => {
        if (this.demo && !this.exporting) this.stopDemo();
      });
    }

    screenRay(x, y) {
      const cam = this.renderer.camera;
      const nx = (x / window.innerWidth) * 2 - 1;
      const ny = 1 - (y / window.innerHeight) * 2;
      const inv = cam.invVP;
      if (!inv) return null;
      const unproject = (z) => {
        const v = [nx, ny, z, 1];
        const w = inv[3]*v[0] + inv[7]*v[1] + inv[11]*v[2] + inv[15];
        return [
          (inv[0]*v[0] + inv[4]*v[1] + inv[8]*v[2] + inv[12]) / w,
          (inv[1]*v[0] + inv[5]*v[1] + inv[9]*v[2] + inv[13]) / w,
          (inv[2]*v[0] + inv[6]*v[1] + inv[10]*v[2] + inv[14]) / w
        ];
      };
      const a = unproject(-1), b = unproject(1);
      return { o: a, d: V3.norm(V3.sub(b, a)) };
    }

    bindKeys() {
      window.addEventListener('keydown', (e) => {
        if (this.exporting) return;
        if (e.key === 'Escape') {
          this.stopDemo();
          document.getElementById('helpModal').classList.add('hidden');
          return;
        }
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.code === 'Space') { e.preventDefault(); this.togglePause(); }
        else if (e.key === 'r' || e.key === 'R') this.resetAll();
        else if (e.key === '1') this.triggerMode('center');
        else if (e.key === '2') this.triggerMode('offset');
        else if (e.key === '3') this.triggerMode('multi');
      });
    }

    triggerMode(mode) {
      if (this.exporting) return;
      if (this.demo) this.stopDemo();
      if (this.active !== 'jelly') this.switchScene('jelly');
      this.jelly.trigger(mode);
      this.audio.ensure();
    }

    /* ---------------- demo playback ---------------- */
    playDemo(runId) {
      if (this.exporting) return;
      this.startDemo(runId, false);
    }

    startDemo(runId, forExport) {
      const run = RUNS[runId];
      if (!run) return;
      this.stopDemo();
      this.demoRunId = runId;
      this.active = run.scene;
      this.updateTabs();
      this.paused = false;
      this.updateTransport();
      this.demo = { runId, run, clock: 0, fired: new Set() };
      this.demoTarget = 0;
      this._demoEndTimer = 0;
      this.exporting = !!forExport;
      try { run.init(this); } catch (e) { console.error('demo init', e); }
      this.fireDemoEvents(-0.001, 0.0001);
      this.setDemoCamera(0);
      if (!forExport) {
        document.body.classList.add('cinema');
        this.updateDemoCaption();
        document.getElementById('sceneCaption').classList.add('show');
        document.querySelectorAll('.demo-item').forEach(i => i.classList.toggle('playing', i.dataset.run === runId));
        document.getElementById('demoStop').classList.remove('hidden');
        this.updateStatus();
      }
      this.demoBusy = false;
    }

    fireDemoEvents(a, b) {
      if (!this.demo) return;
      const evs = this.demo.run.events || [];
      for (let i = 0; i < evs.length; i++) {
        const ev = evs[i];
        if (this.demo.fired.has(i)) continue;
        if (ev.t > a - 1e-6 && ev.t <= b + 1e-6) {
          this.demo.fired.add(i);
          try { ev.fn(this); } catch (e) { console.error('demo event', e); }
        }
      }
    }

    setDemoCamera(t) {
      if (!this.demo) return;
      const cam = camSample(this.demo.run.camera, t);
      if (cam) this.renderer.camera.setPose(cam.eye, cam.target);
    }

    async advanceDemoToAsync(target) {
      const d = this.demo;
      if (!d) return;
      let guard = 0;
      while (d.clock < target - 1e-9 && guard++ < 900) {
        const speed = Math.max(0.06, d.run.speed ? d.run.speed(d.clock) : 1);
        const stepT = (1 / 120) / speed;
        if (d.clock + stepT > target + 1e-9) break;
        this.fireDemoEvents(d.clock, d.clock + stepT);
        if (d.run.scene === 'tank' && this.tank.asyncStep) {
          await this.tank.asyncStep(1 / 120);
        } else {
          this.sceneObj().update(1 / 120);
        }
        d.clock += stepT;
      }
      this.fireDemoEvents(d.clock, Math.max(d.clock, target));
      this.setDemoCamera(target);
    }

    updateDemoCaption() {
      if (!this.demo) return;
      const run = this.demo.run;
      document.getElementById('capRun').textContent = (this.demo.runId || '').toUpperCase();
      document.getElementById('capTitle').textContent = run.title;
      document.getElementById('capSub').textContent = run.sub;
      const prog = Math.min(1, this.demoTarget / run.duration);
      document.getElementById('capProgress').style.width = (prog * 100).toFixed(2) + '%';
      document.getElementById('capTime').textContent =
        String(Math.floor(this.demoTarget)).padStart(2, '0') + ':' +
        String(Math.floor((this.demoTarget % 1) * 100)).padStart(2, '0') + ' / ' +
        String(Math.floor(run.duration)).padStart(2, '0') + ':' + String(Math.round((run.duration % 1) * 100)).padStart(2, '0');
    }

    stopDemo(silent) {
      if (this.exporting && !silent) return;
      this.demo = null;
      this.demoBusy = false;
      document.body.classList.remove('cinema');
      document.getElementById('sceneCaption').classList.remove('show');
      document.querySelectorAll('.demo-item').forEach(i => i.classList.remove('playing'));
      document.getElementById('demoStop').classList.add('hidden');
      this.updateStatus();
    }

    /* ---------------- video export ---------------- */
    async beginExport(runId, opts) {
      const run = RUNS[runId];
      if (!run) throw new Error('unknown run: ' + runId);
      const fps = Math.max(1, Math.floor((opts && opts.fps) || 60));
      // ensure clean state
      this.demo = null;
      document.body.classList.remove('cinema');
      document.getElementById('sceneCaption').classList.remove('show');
      this.exporting = true;
      this.exportFps = fps;
      this.exportRunId = runId;
      document.body.classList.add('exporting');
      this.renderer.exportMode = true;
      this.renderer.dpr = 1;
      this.renderer.w = -1; this.renderer.h = -1;
      this.paused = false;
      this.active = run.scene;
      this.updateTabs();
      this.demo = { runId, run, clock: 0, fired: new Set() };
      this.demoTarget = 0;
      try { run.init(this); } catch (e) { console.error('export init', e); }
      if (this.tank && this.tank.waitReady) {
        try { await this.tank.waitReady(); } catch (e) { console.error(e); }
      }
      if (run.scene === 'tank' && this.tank.warmup) {
        try { await this.tank.warmup(); } catch (e) { console.error(e); }
      }
      this.fireDemoEvents(-0.001, 0.0001);
      this.setDemoCamera(0);
      this.renderer.resize();
      this.renderer.camera.aspect = this.renderer.w / this.renderer.h;
      this.renderer.camera.update(this.renderer.w / this.renderer.h);
      this.renderActive();
      this.renderer.gl.finish();
      const frames = Math.max(1, Math.ceil(run.duration * fps));
      this.exportFrames = frames;
      return { frames };
    }

    async exportFrame(i) {
      if (!this.exporting || !this.demo) throw new Error('videoExport.begin() must be called first');
      const t = i / this.exportFps;
      await this.advanceDemoToAsync(t);
      this.setDemoCamera(t);
      this.renderer.resize();
      const aspect = this.renderer.w / this.renderer.h;
      this.renderer.camera.aspect = aspect;
      this.renderer.camera.update(aspect);
      this.renderActive();
      this.renderer.gl.finish();
      await new Promise(resolve => requestAnimationFrame(() => resolve()));
      return true;
    }

    endExport() {
      if (!this.exporting) return;
      this.exporting = false;
      this.demo = null;
      document.body.classList.remove('exporting');
      this.renderer.exportMode = false;
      this.renderer.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.renderer.w = -1; this.renderer.h = -1;
      this.renderer.resize();
      this.paused = false;
      this.applyDefaultCamera();
      this.updateStatus();
      this.updateTransport();
    }

    /* ---------------- loop ---------------- */
    loop(now) {
      requestAnimationFrame(this.loop);
      const dtRaw = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(0.05, Math.max(0.0001, isFinite(dtRaw) ? dtRaw : 0.016));
      this.time += dt;
      if (this.exporting) return;
      this.renderer.resize();
      this.renderer.time = this.time;

      if (this.demo) {
        if (!this.paused) {
          this.demoTarget = Math.min(this.demo.run.duration, this.demoTarget + dt);
          if (!this.demoBusy && this.demo.clock < this.demoTarget - 1e-6) {
            this.demoBusy = true;
            const target = this.demoTarget;
            this.advanceDemoToAsync(target).then(() => {
              this.demoBusy = false;
              if (this.demo) this.updateDemoCaption();
            }).catch(err => { this.demoBusy = false; console.error(err); });
          }
          if (this.demoTarget >= this.demo.run.duration - 1e-6) {
            this._demoEndTimer += dt;
            if (this._demoEndTimer > 1.0) {
              this.stopDemo();
              this.toast('演示结束 · 可继续自由操作');
            }
          }
        }
        this.renderActive();
        return;
      }

      if (!this.paused) {
        if (this.active === 'jelly') {
          const sdt = dt * this.slow;
          this.simAcc = Math.min(this.simAcc + sdt, 0.12);
          let n = 0;
          while (this.simAcc >= 1 / 120 && n < 8) {
            this.jelly.update(1 / 120);
            this.simAcc -= 1 / 120;
            n++;
          }
        } else {
          this.tank.update(dt * this.slow);
        }
      }
      this.renderActive();
    }

    renderActive() {
      const r = this.renderer;
      r.time = this.time;
      const scene = this.sceneObj();
      scene.demoTime = this.demo ? this.demoTarget : this.time;
      r.render(scene);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    window.__app = app;
    app.init();
  });
  window.App = App;
})();
