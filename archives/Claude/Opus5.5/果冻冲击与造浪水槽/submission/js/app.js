// 应用主控：场景切换、主循环、相机交互与固定的视频导出接口
'use strict';

const EXPORT_RUNS = ['jelly-center', 'jelly-multi', 'jelly-offset', 'tank-full'];

// 视频导出预设：每段使用作品预设参数，从重置后的初始状态运行到趋于稳定
const EXPORT_PRESETS = {
  'jelly-center': { scene: 'jelly', trigger: 1.2, duration: 12.5, params: { mode: 'center' } },
  'jelly-multi': { scene: 'jelly', trigger: 1.2, duration: 16.5, params: { mode: 'multi', ballCount: 4, interval: 0.62 } },
  'jelly-offset': { scene: 'jelly', trigger: 1.2, duration: 13.5, params: { mode: 'offset', offset: 0.62 } },
  'tank-full': { scene: 'tank', trigger: 1.6, duration: 34, params: { quality: 1 } },
};

const App = {
  scene: 'jelly',
  paused: false,
  speed: 1,
  exporting: false,
  ready: null,
  gpuBusy: false,
  resetTimer: 0,
  frameN: 0,

  async init() {
    const canvas = document.getElementById('view');
    this.canvas = canvas;
    AudioFX.init();
    const msg = document.getElementById('loadingMsg');
    await GX.init(canvas);
    msg.textContent = '正在编译着色器…';
    await new Promise((r) => setTimeout(r, 30));
    this.post = new PostFX();
    this.jelly = new JellySim();
    this.jelly.onSound = (kind, B, v, other) => AudioFX.jellyEvent(kind, B, v, other);
    this.jellyView = new JellyView(this.jelly);
    this.tank = new TankSim();
    this.tankView = new TankView(this.tank);
    this.camJ = new OrbitCamera();
    this.camT = new OrbitCamera();
    this.setDefaultCameras();
    msg.textContent = '正在生成果冻网格并静置…';
    await new Promise((r) => setTimeout(r, 30));
    this.jelly.build();
    this.jelly.resetState();
    msg.textContent = '正在播种水体粒子…';
    await new Promise((r) => setTimeout(r, 30));
    this.tank.reset();
    UI.init(this);
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    document.getElementById('loading').classList.add('done');
    this.last = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  },

  setDefaultCameras() {
    this.camJ.setDefault({ yaw: 0.42, pitch: 0.17, dist: 5.9, target: [0, 0.98, 0], fov: 30 * Math.PI / 180 });
    this.camT.setDefault({ yaw: 0.24, pitch: 0.17, dist: 4.6, target: [-0.13, 0.53, 0], fov: 30 * Math.PI / 180 });
  },

  activeCam() { return this.scene === 'jelly' ? this.camJ : this.camT; },

  renderScale(cw, ch) {
    const px = cw * ch;
    if (this.exporting) return px <= 2100000 ? 2 : (px <= 3800000 ? 1.5 : 1);
    if (this.scene === 'tank') return 1;
    return px <= 1400000 ? 1.5 : 1.25;
  },

  resize() {
    const el = document.getElementById('stage');
    const r = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(16, Math.round((this.exporting ? window.innerWidth : r.width) * dpr));
    const ch = Math.max(16, Math.round((this.exporting ? window.innerHeight : r.height) * dpr));
    const canvas = this.canvas;
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    this.cw = cw; this.ch = ch;
    const s = this.renderScale(cw, ch);
    this.ssaa = s;
    this.rw = Math.round(cw * s); this.rh = Math.round(ch * s);
    this.post.resize(this.rw, this.rh);
    this.jellyView.resize(this.rw, this.rh);
    this.tankView.resize(this.rw, this.rh);
    this.post.boundHdr = null;
  },

  setScene(sc) {
    if (this.scene === sc) return;
    this.scene = sc;
    this.post.boundHdr = null;
    this.resize();
    UI.rebuild();
  },

  togglePause() { this.paused = !this.paused; UI.syncTransport(); },
  setSpeed(v) { this.speed = v; UI.syncTransport(); },

  triggerOrRun() {
    if (this.scene === 'jelly') {
      if (this.jelly.triggerT >= 0) { this.resetScene(); }
      this.jelly.trigger();
    } else {
      if (this.tank.triggerT >= 0) { this.resetScene(); }
      this.tank.trigger();
    }
    this.paused = false;
    UI.syncTransport();
  },

  resetScene() {
    if (this.scene === 'jelly') this.jelly.resetState();
    else this.tank.reset();
    UI.curPhase = null;
  },

  scheduleReset() {
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.resetScene(), 160);
  },

  toggleWave() {
    const s = this.tank;
    if (s.isWaving()) s.stopWave(); else s.startWave();
    if (s.triggerT < 0) { s.triggerT = s.t; }
    UI.syncTransport();
  },

  bindInput() {
    const c = this.canvas;
    let drag = null;
    c.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey }; c.setPointerCapture(e.pointerId); c.focus?.(); });
    c.addEventListener('pointerup', () => { drag = null; });
    c.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      const cam = this.activeCam();
      if (drag.pan) {
        const k = cam.dist * 0.0012;
        const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
        cam.target[0] -= cy * dx * k; cam.target[2] += sy * dx * k;
        cam.target[1] += dy * k;
      } else {
        cam.yaw -= dx * 0.005;
        cam.pitch = clamp(cam.pitch + dy * 0.004, 0.015, 1.35);
      }
    });
    c.addEventListener('wheel', (e) => { e.preventDefault(); const cam = this.activeCam(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.001), 1.6, 14); }, { passive: false });
    c.addEventListener('dblclick', () => this.activeCam().restore());
    // 点击后释放按钮焦点，避免空格同时触发按钮与快捷键
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) e.target.closest('button').blur(); });
    window.addEventListener('keydown', (e) => {
      if (this.exporting) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
      const k = e.key.toLowerCase();
      if (k === ' ') {
        e.preventDefault();
        const started = this.scene === 'jelly' ? this.jelly.triggerT >= 0 : this.tank.triggerT >= 0;
        if (!started) this.triggerOrRun(); else this.togglePause();
      } else if (k === 'r') this.resetScene();
      else if (k === 's') {
        const list = [1, 0.5, 0.25, 0.1];
        this.setSpeed(list[(list.indexOf(this.speed) + 1) % list.length]);
      } else if (k === '1') this.setScene('jelly');
      else if (k === '2') this.setScene('tank');
      else if (k === 'b' && this.scene === 'tank') this.tank.rerelease();
      else if (k === 'w' && this.scene === 'tank') this.toggleWave();
      else if (k === 'm') AudioFX.toggle();
    });
  },

  // 推进交互模式下的仿真
  updateSim(dt) {
    if (this.scene === 'jelly') {
      if (dt > 0) this.jelly.advance(Math.min(dt, 1 / 24));
    } else if (dt > 0) {
      this.tank.advance(dt, 5);
    }
  },

  draw(time) {
    const enc = GX.device.createCommandEncoder();
    const aspect = this.rw / this.rh;
    let hdr;
    if (this.scene === 'jelly') {
      const m = this.camJ.matrices(aspect);
      hdr = this.jellyView.render(enc, m, time);
    } else {
      this.tank.updateVolume();
      const m = this.camT.matrices(aspect);
      hdr = this.tankView.render(enc, m, time);
    }
    this.post.run(enc, hdr, this.cw, this.ch, this.ssaa);
    GX.queue.submit([enc.finish()]);
  },

  tick(now) {
    requestAnimationFrame((t) => this.tick(t));
    if (this.exporting) { this.last = now; AudioFX.silence(); return; }
    if (this.gpuBusy) return;
    const dt = Math.min((now - this.last) / 1000, 0.06);
    this.last = now;
    this.updateSim(this.paused ? 0 : dt * this.speed);
    AudioFX.update(this.paused, dt);
    this.resize();
    this.draw(this.scene === 'jelly' ? this.jelly.t : this.tank.t);
    this.gpuBusy = true;
    GX.queue.onSubmittedWorkDone().then(() => { this.gpuBusy = false; });
    this.frameN++;
    if (this.frameN % 6 === 0) {
      UI.update();
      if (this.scene === 'tank') this.tank.requestReadback();
    }
  },

  // —— 演示镜头（导出时）：节奏由仿真时刻决定，与实际运行速度无关 ——
  demoCamera(run, t) {
    const preset = EXPORT_PRESETS[run];
    const aspect = this.cw / this.ch;
    const fit = Math.max(1, (16 / 9) / aspect);
    if (preset.scene === 'jelly') {
      const cam = this.camJ;
      const tc = t - preset.trigger;     // 相对触发时刻
      const fall = Math.sqrt(2 * this.jelly.p.dropHeight / this.jelly.p.gravity);
      // 接触前后推近；多球模式等最后一个球开始下落后才推近，保证每个球的下落都在画面内
      const lastRel = run === 'jelly-multi' ? (this.jelly.p.ballCount - 1) * this.jelly.p.interval : 0;
      const k = run === 'jelly-multi' ? sstep(lastRel + fall * 0.8, lastRel + fall + 1.4, tc) : sstep(fall - 0.55, fall + 0.5, tc);
      const back = sstep(preset.duration - preset.trigger - 4.5, preset.duration - preset.trigger - 0.8, tc);
      const near = run === 'jelly-multi' ? 0.45 : 1.0;
      const zoom = k * (1 - 0.45 * back) * near;
      cam.yaw = (run === 'jelly-offset' ? 0.58 : 0.46) + 0.05 * sstep(0, preset.duration, t);
      cam.pitch = lerp(0.17, 0.235, zoom);
      cam.dist = lerp(6.0, 4.45, zoom) * fit;
      cam.target = [run === 'jelly-offset' ? 0.1 * zoom : 0, lerp(1.0, 0.56, zoom), 0];
      cam.fov = 30 * Math.PI / 180;
    } else {
      const cam = this.camT;
      const T = preset.duration;
      const drift = sstep(0, T, t);
      cam.yaw = lerp(0.2, 0.3, drift);
      cam.pitch = 0.155 + 0.03 * Math.sin(drift * Math.PI);
      cam.dist = 4.05 * fit * (this.tank.lx / 2.6);
      cam.target = [-0.13, 0.53, 0];
      cam.fov = 30 * Math.PI / 180;
    }
  },
};

// 固定接口：页面脚本一加载就存在；内部等待初始化完成
window.videoExport = {
  runs: EXPORT_RUNS.slice(),
  _st: null,
  async begin(runId, opts = {}) {
    await App.ready;
    const preset = EXPORT_PRESETS[runId];
    if (!preset) throw new Error('未知的片段：' + runId);
    const fps = opts.fps > 0 ? opts.fps : 30;
    if (!App.exporting) {
      // 保存交互状态，导出结束后恢复
      this._saved = {
        scene: App.scene, paused: App.paused, speed: App.speed,
        jp: Object.assign({}, App.jelly.p), tp: JSON.parse(JSON.stringify(App.tank.p)),
        heat: App.jellyView.showHeat,
      };
    }
    // 进入导出后实时循环不再推进仿真；待执行的参数重置也要取消，片段只由 frame(i) 推进
    App.exporting = true;
    clearTimeout(App.resetTimer);
    document.body.classList.add('exporting');
    App.scene = preset.scene;
    App.post.boundHdr = null;
    App.jellyView.showHeat = false;
    this._st = { runId, preset, fps, frames: Math.ceil(preset.duration * fps), cursor: 0 };
    this._prepare();
    App.resize();
    App.demoCamera(runId, 0);
    await GX.queue.onSubmittedWorkDone();
    return { frames: this._st.frames };
  },
  _prepare() {
    const { preset } = this._st;
    if (preset.scene === 'jelly') {
      Object.assign(App.jelly.p, JSON.parse(JSON.stringify(JELLY_DEFAULTS)), preset.params);
      App.jelly.resetState();
    } else {
      Object.assign(App.tank.p, JSON.parse(JSON.stringify(TANK_DEFAULTS)), preset.params);
      App.tank.acc = 0;
      App.tank.reset();
    }
    this._st.cursor = 0;
  },
  async frame(i) {
    const st = this._st;
    if (!st) throw new Error('请先调用 begin()');
    if (i < st.cursor) this._prepare();   // 倒退时重新模拟，保证结果一致
    const t = i / st.fps;
    const { preset, runId } = st;
    App.resize();
    if (preset.scene === 'jelly') {
      const s = App.jelly;
      if (t >= preset.trigger && s.triggerT < 0) {
        if (s.t < preset.trigger) s.advance(preset.trigger - s.t);
        s.trigger();
      }
      if (t > s.t) s.advance(t - s.t);
    } else {
      const s = App.tank;
      // 分段提交，避免一次性堆积 GPU 工作
      if (t >= preset.trigger && s.triggerT < 0) {
        await s.advanceTo(preset.trigger);
        s.trigger();
      }
      await s.advanceTo(t);
      await GX.queue.onSubmittedWorkDone();
    }
    st.cursor = i;
    App.demoCamera(runId, t);
    App.draw(t);
    await GX.queue.onSubmittedWorkDone();
    // 等到合成器至少呈现一帧
    await new Promise((res) => {
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      requestAnimationFrame(() => requestAnimationFrame(fin));
      setTimeout(fin, 250);
    });
  },
  end() {
    App.exporting = false;
    document.body.classList.remove('exporting');
    const sv = this._saved;
    if (sv) {
      Object.assign(App.jelly.p, sv.jp);
      Object.assign(App.tank.p, sv.tp);
      App.scene = sv.scene; App.paused = sv.paused; App.speed = sv.speed;
      App.jellyView.showHeat = sv.heat;
    }
    App.setDefaultCameras();
    App.post.boundHdr = null;
    App.jelly.resetState();
    App.tank.acc = 0;
    App.tank.reset();
    UI.curPhase = null;
    UI.rebuild();
    App.resize();
    this._st = null;
  },
};

App.ready = App.init().catch((err) => {
  console.error(err);
  const el = document.getElementById('fatal');
  if (el) { el.textContent = '启动失败：' + err.message; el.style.display = 'block'; }
  const ld = document.getElementById('loading');
  if (ld) ld.classList.add('done');
  throw err;
});
window.App = App;
