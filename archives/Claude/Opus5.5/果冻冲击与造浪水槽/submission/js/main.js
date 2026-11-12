'use strict';
// ---------------------------------------------------------------------------
// 应用主循环、界面、相机、演示播放与视频导出接口
// ---------------------------------------------------------------------------
const App = {
  paused: false, speed: 1, sceneName: 'jelly', scenes: {}, orbit: {}, demo: null,
  exporting: false, ready: false, lastT: 0, wallTime: 0, frameCount: 0,

  async init() {
    this.canvas = document.getElementById('view');
    try {
      await G.init(this.canvas);
    } catch (e) {
      document.getElementById('loadingText').textContent = '初始化失败：' + e.message;
      throw e;
    }
    this.renderer = new Renderer();
    this.resize();
    document.getElementById('loadingText').textContent = '正在构建果冻四面体网格…';
    await new Promise((r) => setTimeout(r, 0));
    this.scenes.jelly = new JellyScene(this.renderer);
    document.getElementById('loadingText').textContent = '正在初始化水体粒子（GPU）…';
    await new Promise((r) => setTimeout(r, 0));
    if (typeof TankScene !== 'undefined') this.scenes.tank = new TankScene(this.renderer);
    for (const k in this.scenes) this.orbit[k] = this.orbitFrom(this.scenes[k].camDefault());
    this.bindUI();
    this.setScene(new URLSearchParams(location.search).get('scene') === 'tank' ? 'tank' : 'jelly');
    await G.queue.onSubmittedWorkDone();
    this.ready = true;
    document.getElementById('loading').classList.add('done');
    this.lastT = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  },

  resize() {
    const dpr = window.devicePixelRatio || 1;
    let w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
    const maxS = 8192;
    if (w > maxS || h > maxS) { const k = maxS / Math.max(w, h); w = Math.floor(w * k); h = Math.floor(h * k); }
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.renderer.resize(w, h);
  },

  get scene() { return this.scenes[this.sceneName]; },

  setScene(name) {
    if (!this.scenes[name]) return;
    this.sceneName = name;
    document.querySelectorAll('#sceneTabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.scene === name));
    document.querySelectorAll('.scene-ctl').forEach((s) => { s.hidden = s.dataset.for !== name; });
    if (this.scene.onEnter) this.scene.onEnter();
    this.syncControls();
  },

  // ---------------- 相机 ----------------
  orbitFrom(c) {
    const d = U.sub(c.eye, c.target), dist = U.len(d);
    return { target: c.target.slice(), dist, yaw: Math.atan2(d[0], d[2]), pitch: Math.asin(d[1] / dist), fov: c.fov };
  },
  orbitCam(o) {
    const cp = Math.cos(o.pitch);
    const eye = [o.target[0] + Math.sin(o.yaw) * cp * o.dist, o.target[1] + Math.sin(o.pitch) * o.dist, o.target[2] + Math.cos(o.yaw) * cp * o.dist];
    return { eye, target: o.target.slice(), fov: o.fov };
  },

  // ---------------- 主循环 ----------------
  tick(now) {
    requestAnimationFrame((t) => this.tick(t));
    if (!this.ready || this.exporting) { this.lastT = now; return; }
    const dt = Math.min((now - this.lastT) / 1000, 0.05);
    this.lastT = now;
    this.resize();
    const S = this.scene;
    let cam;
    if (this.demo) {
      const D = this.demo;
      if (!this.paused) {
        const nt = Math.min(D.tau + dt * this.speed, D.def.duration);
        const target = D.map.sim(nt);
        const steps = S.advanceTo ? this.advanceLimited(S, target) : 0;
        if (steps >= 0) D.tau = nt;
      }
      cam = D.def.camera(D.tau, S);
      const pr = D.tau / D.def.duration;
      document.getElementById('demoProg').style.width = (pr * 100).toFixed(1) + '%';
      if (D.tau >= D.def.duration - 1e-6) this.endDemo(true, cam);
      this.simRate = D.map.rateAt(D.tau) * this.speed;
    } else {
      if (!this.paused) S.update(dt * this.speed);
      cam = this.orbitCam(this.orbit[this.sceneName]);
      this.simRate = this.speed;
    }
    this.wallTime += this.paused ? 0 : dt;
    this.renderFrame(cam);
    this.handleEvents();
    if ((this.frameCount++ % 10) === 0) this.updateReadout();
  },
  advanceLimited(S, target) {
    // 实时播放时限制每帧计算量
    const maxSteps = S.name === 'jelly' ? 48 : 10;
    let n = 0;
    while (n < maxSteps && S.needsStep(target)) { S.stepOnce(); n++; }
    return S.needsStep(target) ? -1 : n;
  },

  renderFrame(cam) {
    const r = this.renderer, S = this.scene;
    const light = S.light();
    const opts = S.frameOpts ? S.frameOpts() : { scene: 0 };
    opts.time = this.wallTime;
    r.setFrame(cam, light, opts);
    const enc = G.device.createCommandEncoder();
    S.render(enc, cam);
    r.tonemap(enc);
    G.queue.submit([enc.finish()]);
    this.lastCam = cam;
  },

  handleEvents() {
    const S = this.scene;
    const evs = S.drainEvents ? S.drainEvents() : [];
    if (this.exporting) return;
    for (const e of evs) Sound.play(e.type, e, this.simRate);
    if (S.updateLoops) S.updateLoops(!this.paused);
  },

  // ---------------- 演示 ----------------
  playDemo(id) {
    const def = Demos.defs[id];
    if (!def) return;
    this.setScene(def.scene);
    def.setup(this.scene);
    this.demo = { id, def, tau: 0, map: U.makeTimeMap(def.rate, def.duration) };
    this.lastAction = { demo: id };
    document.querySelectorAll('#demoBtns button').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
    document.getElementById('demoBar').classList.add('playing');
  },
  endDemo(finished, cam) {
    if (!this.demo) return;
    if (cam) this.orbit[this.sceneName] = this.orbitFrom(cam);
    this.demo = null;
    document.querySelectorAll('#demoBtns button').forEach((b) => b.classList.remove('active'));
    document.getElementById('demoBar').classList.remove('playing');
  },

  // ---------------- 操作 ----------------
  doAction(act) {
    Sound.init();
    if (this.demo) this.endDemo(false, this.lastCam);
    const S = this.scene;
    if (act === 'center' || act === 'offset' || act === 'multi') { S.trigger(act); this.lastAction = { scene: 'jelly', act }; }
    else if (act === 'release') { S.releaseBalls(); this.lastAction = { scene: 'tank', act }; }
    else if (act === 'wave') { S.toggleWave(); this.lastAction = { scene: 'tank', act: S.waveOn ? 'wave' : 'release' }; }
    this.syncControls();
  },
  reset() {
    if (this.demo) this.endDemo(false, this.lastCam);
    this.scene.reset();
    this.syncControls();
  },
  rerun() {
    const a = this.lastAction;
    if (a && a.demo) { this.playDemo(a.demo); return; }
    if (this.demo) this.endDemo(false, this.lastCam);
    this.scene.reset();
    if (a && a.scene === this.sceneName) {
      if (a.act === 'wave') { this.scene.releaseBalls(); this.scene.toggleWave(true); }
      else this.doAction(a.act);
    }
    this.syncControls();
  },
  setPaused(p) {
    this.paused = p;
    const b = document.getElementById('btnPause');
    b.innerHTML = p ? '<i class="ico-play"></i><span>继续</span>' : '<i class="ico-pause"></i><span>暂停</span>';
    b.classList.toggle('on', p);
  },

  // ---------------- 界面 ----------------
  bindUI() {
    const $ = (s) => document.querySelector(s);
    document.querySelectorAll('#sceneTabs .tab').forEach((b) => b.addEventListener('click', () => { if (this.demo) this.endDemo(false, this.lastCam); this.setScene(b.dataset.scene); }));
    $('#btnPause').addEventListener('click', () => this.setPaused(!this.paused));
    document.querySelectorAll('#speedSeg button').forEach((b) => b.addEventListener('click', () => {
      this.speed = +b.dataset.speed;
      document.querySelectorAll('#speedSeg button').forEach((x) => x.classList.toggle('active', x === b));
    }));
    $('#btnReset').addEventListener('click', () => this.reset());
    $('#btnRerun').addEventListener('click', () => this.rerun());
    $('#btnSound').addEventListener('click', () => {
      Sound.init();
      Sound.setEnabled(!Sound.enabled);
      $('#btnSound span').textContent = Sound.enabled ? '音效开' : '音效关';
      $('#btnSound').classList.toggle('off', !Sound.enabled);
    });
    document.querySelectorAll('.action').forEach((b) => b.addEventListener('click', () => this.doAction(b.dataset.act)));
    // 演示按钮
    const db = $('#demoBtns');
    for (const id of Demos.list) {
      const d = Demos.defs[id];
      const b = document.createElement('button');
      b.dataset.id = id;
      b.innerHTML = `${d.title}<small>${id}</small>`;
      b.addEventListener('click', () => { Sound.init(); this.playDemo(id); });
      db.appendChild(b);
    }
    // 果冻目标
    const ts = $('#targetSeg');
    const J = this.scenes.jelly;
    J.sim.jellies.forEach((jj, i) => {
      const b = document.createElement('button');
      const c = jj.spec.color;
      b.innerHTML = `<span class="sw" style="background:rgb(${c.map((v) => Math.round(v * 255)).join(',')})"></span>${jj.name}`;
      b.addEventListener('click', () => { J.params.target = i; this.syncControls(); });
      ts.appendChild(b);
    });
    const bm = $('#ballMatSeg');
    for (const k in BALL_MATS) {
      const b = document.createElement('button');
      b.textContent = BALL_MATS[k].name; b.dataset.k = k;
      b.addEventListener('click', () => {
        J.params.ballMat = k;
        // 按材质密度给出默认质量
        const r = J.params.radius;
        J.params.mass = Math.round(BALL_MATS[k].density * 4 / 3 * Math.PI * r ** 3);
        this.syncControls();
      });
      bm.appendChild(b);
    }
    this.sliders = {};
    document.querySelectorAll('.ctl[data-key]').forEach((el) => {
      const key = el.dataset.key, inp = el.querySelector('input');
      this.sliders[key] = el;
      inp.addEventListener('input', () => { this.onSlider(key, +inp.value); this.paintSlider(inp); });
    });
    if (this.scenes.tank && this.scenes.tank.buildDensityUI) this.scenes.tank.buildDensityUI($('#densityCtl'), () => this.syncControls());
    // 键盘
    window.addEventListener('keydown', (e) => {
      if (this.exporting) return;
      if (e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === ' ') { this.setPaused(!this.paused); e.preventDefault(); }
      else if (k === 'r') this.reset();
      else if (k === 't') this.rerun();
      else if (k === 'm') $('#btnSound').click();
      else if (this.sceneName === 'jelly' && (k === '1' || k === '2' || k === '3')) this.doAction(['center', 'offset', 'multi'][+k - 1]);
      else if (this.sceneName === 'tank' && k === 'b') this.doAction('release');
      else if (this.sceneName === 'tank' && k === 'w') this.doAction('wave');
    });
    // 鼠标相机
    let drag = null;
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerdown', (e) => {
      Sound.init();
      if (this.demo) this.endDemo(false, this.lastCam);
      drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const o = this.orbit[this.sceneName];
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.pan) {
        const cam = this.orbitCam(o);
        const f = U.norm(U.sub(cam.target, cam.eye)), rt = U.norm(U.cross(f, [0, 1, 0])), up = U.cross(rt, f);
        const k = o.dist * 0.0015;
        o.target = U.add(o.target, U.add(U.scale(rt, -dx * k), U.scale(up, dy * k)));
      } else {
        o.yaw -= dx * 0.005;
        o.pitch = U.clamp(o.pitch + dy * 0.004, -0.15, 1.45);
      }
    });
    this.canvas.addEventListener('pointerup', () => { drag = null; });
    this.canvas.addEventListener('wheel', (e) => {
      if (this.demo) this.endDemo(false, this.lastCam);
      const o = this.orbit[this.sceneName];
      o.dist = U.clamp(o.dist * Math.exp(e.deltaY * 0.001), 0.8, 18);
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('pointerdown', () => { Sound.init(); document.getElementById('hintAudio').classList.add('hide'); }, { once: false });
    window.addEventListener('resize', () => this.resize());
  },

  paintSlider(inp) {
    const p = ((+inp.value - +inp.min) / (+inp.max - +inp.min)) * 100;
    inp.style.setProperty('--p', p + '%');
  },
  // 软硬/结实度 <-> 滑条
  muToSlider: (mu) => (Math.log(mu / 2500) / Math.log(16)) * 100,
  sliderToMu: (t) => 2500 * Math.pow(16, t / 100),
  toughToSlider: (e) => (Math.log(e / 0.25) / Math.log(8)) * 100,
  sliderToTough: (t) => 0.25 * Math.pow(8, t / 100),

  onSlider(key, v) {
    const J = this.scenes.jelly;
    if (key === 'mu' || key === 'tough') {
      const t = J.params.target;
      const o = J.jellyOverrides[t] = J.jellyOverrides[t] || {};
      if (key === 'mu') { o.mu = this.sliderToMu(v); J.sim.setJellyParams(t, o.mu); }
      else { o.tough = this.sliderToTough(v); J.sim.setJellyParams(t, undefined, o.tough); }
    } else if (key === 'mass') J.params.mass = v;
    else if (key === 'radius') J.params.radius = v / 100;
    else if (key === 'height') J.params.height = v;
    else if (this.scenes.tank && this.scenes.tank.onSlider) this.scenes.tank.onSlider(key, v);
    this.syncControls(true);
  },

  syncControls(noInputs) {
    const J = this.scenes.jelly;
    if (!J || !this.sliders) return;
    const t = J.params.target;
    const jj = J.sim.jellies[t];
    document.querySelectorAll('#targetSeg button').forEach((b, i) => b.classList.toggle('active', i === t));
    document.querySelectorAll('#ballMatSeg button').forEach((b) => b.classList.toggle('active', b.dataset.k === J.params.ballMat));
    const set = (key, val, text) => {
      const el = this.sliders[key]; if (!el) return;
      const inp = el.querySelector('input');
      if (!noInputs && val !== null) inp.value = val;
      this.paintSlider(inp);
      el.querySelector('.val').textContent = text;
    };
    set('mu', this.muToSlider(jj.mu), `剪切模量 ${(jj.mu / 1000).toFixed(1)} kPa`);
    set('tough', this.toughToSlider(jj.tough), `断裂伸长 ${(jj.tough * 100).toFixed(0)}%`);
    set('mass', J.params.mass, `${J.params.mass.toFixed(0)} kg`);
    set('radius', J.params.radius * 100, `${(J.params.radius * 100).toFixed(1)} cm`);
    set('height', J.params.height, `${J.params.height.toFixed(2)} m · 撞击 ${Math.sqrt(2 * 9.81 * J.params.height).toFixed(1)} m/s`);
    if (this.scenes.tank && this.scenes.tank.syncUI) this.scenes.tank.syncUI(set, noInputs);
  },

  updateReadout() {
    const el = document.getElementById('readout');
    const S = this.scene;
    if (!S.readout) return;
    el.innerHTML = S.readout();
  },
};

// ---------------------------------------------------------------------------
// 视频导出接口
// ---------------------------------------------------------------------------
window.videoExport = {
  runs: ['jelly-center', 'jelly-multi', 'jelly-offset', 'tank-full'],
  _st: null,
  async begin(runId, opts) {
    while (!App.ready) await new Promise((r) => setTimeout(r, 50));
    const def = Demos.defs[runId];
    if (!def) throw new Error('未知演示: ' + runId);
    const fps = Math.max(1, Math.round((opts && opts.fps) || 30));
    App.exporting = true;
    document.body.classList.add('exporting');
    if (App.demo) App.endDemo(false);
    App.setScene(def.scene);
    def.setup(App.scene);
    if (App.scene.flush) await App.scene.flush();
    this._st = { id: runId, def, fps, map: U.makeTimeMap(def.rate, def.duration), frames: Math.max(1, Math.round(def.duration * fps)) };
    App.resize();
    await G.queue.onSubmittedWorkDone();
    return { frames: this._st.frames };
  },
  async frame(i) {
    const st = this._st;
    if (!st) throw new Error('请先调用 begin');
    const tau = i / st.fps;
    const S = App.scene;
    const target = st.map.sim(tau);
    S.advanceTo(target);
    if (S.sync) await S.sync();
    App.simRate = st.map.rateAt(tau);
    App.resize();
    const cam = st.def.camera(tau, S);
    App.wallTime = tau;
    await new Promise((res) => {
      let done = false;
      const go = () => { if (done) return; done = true; App.renderFrame(cam); res(); };
      requestAnimationFrame(go);
      setTimeout(go, 200);
    });
    if (S.drainEvents) S.drainEvents();
    await G.queue.onSubmittedWorkDone();
    await new Promise((res) => { let d = false; const f = () => { if (!d) { d = true; res(); } }; requestAnimationFrame(f); setTimeout(f, 100); });
    return true;
  },
  end() {
    App.exporting = false;
    document.body.classList.remove('exporting');
    this._st = null;
    App.lastT = performance.now();
    if (App.lastCam) App.orbit[App.sceneName] = App.orbitFrom(App.lastCam);
    return true;
  },
};

window.addEventListener('load', () => { App.init().catch((e) => console.error(e)); });
