/* 应用主控：场景接口 / 固定步长模拟 / 界面 / 演示导演 / 导出接口 */
(function () {
  'use strict';
  const M = window.M, GPU = window.GPU;
  const $ = (id) => document.getElementById(id);
  const SIM_DT = 1 / 120;

  function showFatal(msg, sub) {
    window.__fatal = { msg: String(msg), sub: String(sub || '') };
    const lt = $('loadingText'), ls = $('loadingSub');
    if (lt) lt.textContent = '启动失败：' + msg;
    if (ls) { ls.textContent = sub || ''; ls.style.color = '#ffb072'; }
    const sp = document.querySelector('.spinner');
    if (sp) sp.style.display = 'none';
    console.error('[FATAL]', msg, sub);
  }

  /* ---------------------------------------------------------------- *
   * 场景二占位（Phase C 由 water.js 的 WaterSim 取代）
   * ---------------------------------------------------------------- */
  function makeFallbackTank() {
    const rnd = M.mulberry32(9876);
    const base = [];
    const sp = 0.075;
    for (let x = -2.9; x <= 2.9; x += sp)
      for (let y = 0.06; y <= 1.34; y += sp)
        for (let z = -0.78; z <= 0.78; z += sp)
          base.push(x + (rnd() - .5) * sp * .4, y + (rnd() - .5) * sp * .4, z + (rnd() - .5) * sp * .4, y, x);
    const n = base.length / 5;
    const out = new Float32Array(n * 8);
    const cols = [[1,.42,.34],[1,.78,.34],[.46,.92,.6],[.34,.62,1],[.72,.48,1]];
    const balls = [];
    for (let g = 0; g < 5; g++) for (let k = 0; k < 3; k++)
      balls.push({ p: [-2.1 + g * 1.05 + (k - 1) * .12, 0.30 + g * 0.30 + k * .16, -.35 + k * .32],
        r: .14, col: cols[g], metal: .08, rough: .26, type: 1 });
    return {
      mode: 2, time: 0, params: {},
      reset() { this.time = 0; },
      setParams(p) { Object.assign(this.params, p); },
      trigger() {}, step(dt) { this.time += dt; },
      balls() { return balls; },
      density() {
        const amp = this.params.amp === undefined ? .5 : this.params.amp;
        for (let i = 0; i < n; i++) {
          const o = i * 8, b = i * 5;
          let y = base[b + 1];
          y += (Math.sin(base[b + 4] * 2.1 - this.time * 2.0) * .12 + Math.sin(base[b + 4] * 3.7 - this.time * 3.1) * .05)
            * (0.3 + amp) * M.smoothstep(1.0, 1.34, y);
          out[o] = base[b]; out[o + 1] = y; out[o + 2] = base[b + 2]; out[o + 3] = 1;
          out[o + 4] = 0.02; out[o + 5] = 0; out[o + 6] = 0; out[o + 7] = 0;
        }
        return { data: out, count: n };
      },
      volume() { return { min: [-3.05, -.1, -.92], max: [3.05, 3.05, .92], refCount: 0.30 }; },
      renderP() {
        return { sceneMode: 2, volumeActive: true, iso: 0.34, stepWorld: 0.075, foamStr: 1.0,
          exposure: 1.32, groundRefl: 0.85, lightDir: [0.42, 0.84, 0.52], lightCol: [1.0, 0.95, 0.86],
          waterTint: [0.52, 0.24, 0.13], tankP: [-2.55 + Math.sin(this.time * 1.2) * .18, .14, 1.55, 1] };
      },
      drainEvents() { return []; },
      status() { return '造浪水槽（占位）'; },
    };
  }

  /* ---------------------------------------------------------------- *
   * 演示导演
   * ---------------------------------------------------------------- */
  function warp(T, slow) {
    let s = T;
    for (const w of slow) {
      const ov = Math.max(0, Math.min(T, w.t1) - w.t0);
      s -= (1 - w.speed) * ov;
    }
    return s;
  }
  function sampleCam(keys, T) {
    const k0 = keys[0];
    if (T <= k0.t) return { target: k0.target.slice(), yaw: k0.yaw, pitch: k0.pitch, dist: k0.dist, fov: k0.fov };
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (T <= b.t) {
        const s = M.smoothstep(a.t, b.t, T);
        return { target: M.V.lerp(a.target, b.target, s), yaw: M.lerp(a.yaw, b.yaw, s),
          pitch: M.lerp(a.pitch, b.pitch, s), dist: M.lerp(a.dist, b.dist, s), fov: M.lerp(a.fov, b.fov, s) };
      }
    }
    const z = keys[keys.length - 1];
    return { target: z.target.slice(), yaw: z.yaw, pitch: z.pitch, dist: z.dist, fov: z.fov };
  }

  const J0 = [-1.74, 0.6, 0];
  const DIRECTORS = {
    'jelly-center': {
      scene: 1, duration: 7.2,
      params: { soft: 0.72, tough: 0.92, mass: 0.60, height: 0.62 },
      cues: [{ t: 0.05, a: 'center' }],
      slow: [{ t0: 0.45, t1: 1.85, speed: 0.30 }],
      cam: [
        { t: 0, target: [0, 0.78, 0], yaw: 0.40, pitch: 0.25, dist: 7.4, fov: 38 },
        { t: 2.2, target: [0, 0.70, 0], yaw: 0.26, pitch: 0.20, dist: 5.7, fov: 34 },
        { t: 4.6, target: [0, 0.80, 0], yaw: 0.52, pitch: 0.27, dist: 6.6, fov: 36 },
        { t: 7.2, target: [0, 0.85, 0], yaw: 0.64, pitch: 0.30, dist: 7.6, fov: 38 },
      ],
    },
    'jelly-multi': {
      scene: 1, duration: 9.6,
      params: { soft: 0.84, tough: 0.16, mass: 0.70, height: 0.66 },
      cues: [{ t: 0.05, a: 'multi' }, { t: 1.85, a: 'multi2' }, { t: 3.75, a: 'multi3' }],
      slow: [{ t0: 0.5, t1: 1.35, speed: 0.42 }, { t0: 2.2, t1: 2.9, speed: 0.42 },
             { t0: 4.1, t1: 5.6, speed: 0.28 }],
      cam: [
        { t: 0, target: [0, 0.80, 0], yaw: 0.44, pitch: 0.26, dist: 7.6, fov: 38 },
        { t: 4.3, target: [0, 0.72, 0], yaw: 0.30, pitch: 0.20, dist: 5.9, fov: 34 },
        { t: 6.4, target: [0.15, 0.70, 0], yaw: -0.16, pitch: 0.22, dist: 6.2, fov: 35 },
        { t: 9.6, target: [0.2, 0.78, 0], yaw: 0.58, pitch: 0.30, dist: 7.8, fov: 38 },
      ],
    },
    'jelly-offset': {
      scene: 1, duration: 7.4,
      params: { soft: 0.70, tough: 0.92, mass: 0.66, height: 0.60 },
      cues: [{ t: 0.05, a: 'offset' }],
      slow: [{ t0: 0.55, t1: 1.7, speed: 0.32 }],
      cam: [
        { t: 0, target: [0.25, 0.72, 0], yaw: 0.34, pitch: 0.24, dist: 7.2, fov: 38 },
        { t: 2.4, target: [0.55, 0.62, 0], yaw: -0.10, pitch: 0.18, dist: 5.8, fov: 34 },
        { t: 5.0, target: [1.2, 0.55, 0.2], yaw: 0.30, pitch: 0.24, dist: 6.8, fov: 36 },
        { t: 7.4, target: [1.0, 0.7, 0.1], yaw: 0.62, pitch: 0.30, dist: 7.8, fov: 38 },
      ],
    },
    'tank-full': {
      scene: 2, duration: 19.0,
      params: { amp: 0.12, freq: 0.42 },
      cues: [{ t: 0.12, a: 'release' }, { t: 1.0, a: 'release' }, { t: 1.9, a: 'release' },
             { t: 2.8, a: 'waveOn' }, { t: 15.0, a: 'waveOff' }],
      slow: [{ t0: 8.6, t1: 10.4, speed: 0.42 }],
      cam: [
        { t: 0, target: [0, 1.20, 0], yaw: 0.14, pitch: 0.14, dist: 9.6, fov: 36 },
        { t: 4.0, target: [-0.2, 1.25, 0], yaw: 0.28, pitch: 0.16, dist: 8.6, fov: 35 },
        { t: 9.0, target: [0.5, 1.35, 0], yaw: 0.06, pitch: 0.10, dist: 7.6, fov: 33 },
        { t: 13.5, target: [0.8, 1.30, 0], yaw: -0.20, pitch: 0.18, dist: 8.2, fov: 35 },
        { t: 19.0, target: [0, 1.20, 0], yaw: 0.18, pitch: 0.16, dist: 9.4, fov: 36 },
      ],
      tick(T, scene, App) {
        let amp;
        if (T < 2.8) amp = 0.10;
        else if (T < 9.5) amp = M.lerp(0.14, 1.0, M.smoothstep(2.8, 9.5, T));
        else if (T < 15.0) amp = 1.0;
        else amp = M.lerp(1.0, 0.0, M.smoothstep(15.0, 15.8, T));
        scene.setParams({ amp, freq: 0.42 + 0.12 * Math.sin(T * 0.3) });
        void App;
      },
    },
  };

  /* ---------------------------------------------------------------- *
   * App
   * ---------------------------------------------------------------- */
  const App = {
    renderer: null, scene1: null, scene2: null,
    sceneMode: 1, playing: true,
    speeds: [0.25, 0.5, 1, 2], speedIdx: 2,
    lastT: 0, acc: 0, simClock: 0, simSteps: 0,
    triggerQueue: [], firstFrame: false,
    params: { soft: 0.55, tough: 0.6, mass: 0.62, height: 0.6, amp: 0.55, freq: 0.45, sound: true },
    cam: { target: [0, 0.72, 0], yaw: 0.42, pitch: 0.26, dist: 7.6, fov: 38 },
    cam2: { target: [0, 1.25, 0], yaw: 0.16, pitch: 0.14, dist: 9.4, fov: 36 },
    dragging: 0, lastX: 0, lastY: 0,
    exportMode: false, exportRun: null, exportFps: 60, exportCam: null, frames: 0,

    get scene() { return this.sceneMode === 1 ? this.scene1 : this.scene2; },

    async boot() {
      try {
        const dev = await GPU.init($('gpu'));
        dev.addEventListener('uncapturederror', (e) => showFatal('WebGPU 错误', e.error && e.error.message ? e.error.message : String(e.error)));
        window.__gpuOK = true;
        this.renderer = new window.Renderer();
        this.scene1 = new window.JellySim();
        this.scene2 = window.WaterSim ? new window.WaterSim() : makeFallbackTank();
        this.setupUI();
        this.setupCameraControls();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.applyVolumeConfig();
        this.pushParams();
        // 开场即有动作
        this.queueTrigger(0.05, 'center');
        this.lastT = performance.now();
        requestAnimationFrame(() => this.loop());
        this.installExport();
      } catch (e) { showFatal(e.message || e, e.stack); }
    },

    resize() {
      const c = $('gpu');
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(2, Math.floor(window.innerWidth * dpr));
      const h = Math.max(2, Math.floor(window.innerHeight * dpr));
      if (c.width !== w || c.height !== h) {
        c.width = w; c.height = h;
        GPU.context.configure({ device: GPU.device, format: GPU.format, alphaMode: 'opaque' });
      }
    },

    applyVolumeConfig() {
      const v = this.scene.volume();
      this.renderer.configureVolume(v.min, v.max, v.refCount);
    },

    pushParams() {
      const p = this.params;
      this.scene1.setParams({ soft: p.soft, tough: p.tough, mass: p.mass, height: p.height });
      this.scene2.setParams({ amp: p.amp, freq: p.freq,
        dens: [p.dens0, p.dens1, p.dens2, p.dens3, p.dens4] });
    },

    queueTrigger(atSimTime, name) {
      this.triggerQueue.push({ at: this.simClock + atSimTime, name });
      this.triggerQueue.sort((a, b) => a.at - b.at);
    },

    stepOnce() {
      while (this.triggerQueue.length && this.triggerQueue[0].at <= this.simClock + 1e-9) {
        const q = this.triggerQueue.shift();
        this.scene.trigger(q.name);
      }
      this.scene.step(SIM_DT);
      this.simClock += SIM_DT;
      this.simSteps++;
      const evs = this.scene.drainEvents();
      if (window.AudioFX && this.params.sound) for (const e of evs) window.AudioFX.play(e);
    },

    getCameraObj() {
      if (this.exportMode && this.exportCam) {
        const c = this.exportCam;
        return M.orbitCamera(c.target, c.yaw, c.pitch, c.dist, c.fov);
      }
      const c = this.sceneMode === 1 ? this.cam : this.cam2;
      return M.orbitCamera(c.target, c.yaw, c.pitch, c.dist, c.fov);
    },

    renderParams() {
      const base = {
        time: this.simClock, sceneMode: this.sceneMode, volumeActive: true,
        iso: 0.35, stepWorld: 0.075, foamStr: 1.0, reflStr: 1.0,
        exposure: 1.32, fog: 0, groundRefl: 0.85,
        lightDir: [0.42, 0.84, 0.52], lightCol: [1.0, 0.95, 0.86],
        waterTint: [0.52, 0.24, 0.13], jellyTint: [1, 0.4, 0.5],
        tankP: [-2.55, 0.14, 1.55, 1], p4: [2.4, 1, 0, 0],
      };
      return Object.assign(base, this.scene.renderP());
    },

    renderOnce() {
      const d = this.scene.density();
      this.renderer.setDensityParticles(d.data, d.count);
      this.renderer.setBalls(this.scene.balls());
      const enc = GPU.device.createCommandEncoder();
      this.renderer.buildDensity(enc);
      this.renderer.present(enc, this.getCameraObj(), this.renderParams());
      GPU.queue.submit([enc.finish()]);
    },

    loop() {
      const now = performance.now();
      let dt = (now - this.lastT) / 1000;
      this.lastT = now;
      dt = Math.min(dt, 0.05);
      if (!this.exportMode) {
        if (this.playing) {
          this.acc += dt * this.speeds[this.speedIdx];
          let k = 0;
          while (this.acc >= SIM_DT && k < 12) { this.stepOnce(); this.acc -= SIM_DT; k++; }
        }
        this.renderOnce();
        if (!this.firstFrame) {
          this.firstFrame = true;
          const l = $('loading'); if (l) l.style.display = 'none';
        }
        this.setStatus();
      }
      requestAnimationFrame(() => this.loop());
    },

    setStatus() {
      const s = $('status');
      if (!s) return;
      s.innerHTML = '<b>' + (this.sceneMode === 1 ? '场景一 · 果冻冲击' : '场景二 · 造浪水槽') + '</b>　' +
        (this.exportMode ? '导出中' : (this.playing ? '运行中' : '已暂停')) +
        '　速度 <b>' + this.speeds[this.speedIdx] + '×</b><br>' +
        this.scene.status() + ' · ' + $('gpu').width + '×' + $('gpu').height;
    },

    resetAll() {
      this.scene.reset();
      this.simClock = 0; this.simSteps = 0; this.acc = 0;
      this.triggerQueue.length = 0;
      this.pushParams();
      this.queueTrigger(0.05, 'center');
      this.applyVolumeConfig();
    },

    /* ---------------- UI ---------------- */
    setupUI() {
      const bindSlider = (id, key, fmt) => {
        const el = $(id), out = $('v' + id.slice(1));
        const upd = () => {
          this.params[key] = parseFloat(el.value);
          if (out) out.textContent = fmt(this.params[key]);
          el.style.background = 'linear-gradient(90deg,var(--accent) 0%,var(--accent) ' +
            (this.params[key] * 100).toFixed(0) + '%,rgba(120,205,225,.16) ' + (this.params[key] * 100).toFixed(0) + '%)';
          this.pushParams();
        };
        el.addEventListener('input', upd); upd();
      };
      const pct = (v) => (v * 100).toFixed(0) + '%';
      bindSlider('sSoft', 'soft', pct); bindSlider('sTough', 'tough', pct);
      bindSlider('sMass', 'mass', pct); bindSlider('sHeight', 'height', pct);
      bindSlider('sAmp', 'amp', pct); bindSlider('sFreq', 'freq', pct);

      const cols = ['#ff7d63', '#ffd36b', '#7ee8a4', '#5aa9ff', '#c58bff'];
      const names = ['低密度', '偏低密度', '中性浮力', '偏高密度', '高密度'];
      const dens = [0.35, 0.70, 1.0, 1.35, 1.80];
      const ds = $('densSliders'), lg = $('legend');
      for (let i = 0; i < 5; i++) {
        const row = document.createElement('div'); row.className = 'row densrow';
        row.innerHTML = '<label><span class="swatch" style="background:' + cols[i] + ';color:' + cols[i] + '"></span>' + names[i] + '</label>' +
          '<input type="range" id="dens' + i + '" min="0.15" max="2.0" step="0.01" value="' + dens[i] + '">' +
          '<span class="val" id="vdens' + i + '"></span>';
        ds.appendChild(row);
        const item = document.createElement('div'); item.className = 'item';
        item.innerHTML = '<span class="dot" style="background:' + cols[i] + ';color:' + cols[i] + '"></span>' + names[i];
        lg.appendChild(item);
        const el = row.querySelector('input'), out = row.querySelector('.val');
        const upd = () => {
          const v = parseFloat(el.value);
          out.textContent = v.toFixed(2) + '×';
          el.style.background = 'linear-gradient(90deg,var(--accent) 0%,var(--accent) ' +
            (v / 2 * 100).toFixed(0) + '%,rgba(120,205,225,.16) ' + (v / 2 * 100).toFixed(0) + '%)';
          this.params['dens' + i] = v;
          this.pushParams();
        };
        el.addEventListener('input', upd); upd();
      }

      const self = this;
      $('tabJelly').addEventListener('click', () => self.switchScene(1));
      $('tabTank').addEventListener('click', () => self.switchScene(2));
      $('btnPlay').addEventListener('click', () => {
        self.playing = !self.playing;
        $('btnPlay').textContent = self.playing ? '⏸ 暂停' : '▶ 继续';
        self.setStatus();
      });
      $('btnStep').addEventListener('click', () => { self.stepOnce(); self.renderOnce(); });
      $('btnSlow').addEventListener('click', () => {
        self.speedIdx = (self.speedIdx + 1) % self.speeds.length;
        $('btnSlow').textContent = '▶ 速度 ' + self.speeds[self.speedIdx] + '×';
        self.setStatus();
      });
      $('btnReset').addEventListener('click', () => { self.resetAll(); self.renderOnce(); });
      $('btnRerun').addEventListener('click', () => {
        self.resetAll(); self.playing = true; $('btnPlay').textContent = '⏸ 暂停'; self.setStatus();
      });
      $('btnSound').addEventListener('click', () => {
        self.params.sound = !self.params.sound;
        $('btnSound').classList.toggle('off', !self.params.sound);
        $('btnSound').textContent = self.params.sound ? '🔊' : '🔇';
        if (window.AudioFX) window.AudioFX.setEnabled(self.params.sound);
      });
      $('btnHelp').addEventListener('click', () => $('helpModal').classList.add('show'));
      $('helpClose').addEventListener('click', () => $('helpModal').classList.remove('show'));
      $('btnCenter').addEventListener('click', () => { self.scene1.trigger('center'); });
      $('btnOffset').addEventListener('click', () => { self.scene1.trigger('offset'); });
      $('btnMulti').addEventListener('click', () => {
        self.scene1.trigger('multi');
        self.queueTrigger(1.55, 'multi2');
        self.queueTrigger(3.25, 'multi3');
      });
      $('btnRelease').addEventListener('click', () => { self.scene2.trigger('release'); });
      $('btnWave').addEventListener('click', (e) => {
        const on = !e.target.classList.contains('toggled');
        e.target.classList.toggle('toggled', on);
        e.target.textContent = on ? '≋ 停止造浪' : '≈ 开始造浪';
        self.scene2.trigger(on ? 'waveOn' : 'waveOff');
      });
      document.querySelectorAll('.demo-btn').forEach((b) => {
        b.addEventListener('click', () => self.playDemo(b.dataset.run));
      });
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') { e.preventDefault(); $('btnPlay').click(); }
        else if (e.key === '1') self.switchScene(1);
        else if (e.key === '2') self.switchScene(2);
        else if (e.key === 'r' || e.key === 'R') $('btnReset').click();
        else if (e.key === 's' || e.key === 'S') $('btnSound').click();
      });
    },

    switchScene(m) {
      this.sceneMode = m;
      $('tabJelly').classList.toggle('active', m === 1);
      $('tabTank').classList.toggle('active', m === 2);
      $('jellyParams').style.display = m === 1 ? '' : 'none';
      $('tankParams').style.display = m === 2 ? '' : 'none';
      $('jellyTriggers').style.display = m === 1 ? '' : 'none';
      $('tankTriggers').style.display = m === 2 ? '' : 'none';
      this.applyVolumeConfig();
      this.setStatus();
    },

    setupCameraControls() {
      const c = $('gpu'), self = this;
      c.addEventListener('mousedown', (e) => { self.dragging = e.button === 2 ? 2 : 1; self.lastX = e.clientX; self.lastY = e.clientY; });
      window.addEventListener('mouseup', () => { self.dragging = 0; });
      window.addEventListener('mousemove', (e) => {
        if (!self.dragging || self.exportMode) return;
        const dx = e.clientX - self.lastX, dy = e.clientY - self.lastY;
        self.lastX = e.clientX; self.lastY = e.clientY;
        const cc = self.sceneMode === 1 ? self.cam : self.cam2;
        if (self.dragging === 1) { cc.yaw -= dx * 0.005; cc.pitch = M.clamp(cc.pitch + dy * 0.004, -0.35, 1.15); }
        else {
          const cam = M.orbitCamera(cc.target, cc.yaw, cc.pitch, cc.dist, cc.fov);
          const s = cc.dist * 0.0013;
          cc.target = M.V.add(cc.target, M.V.scale(cam.right, -dx * s));
          cc.target = M.V.add(cc.target, M.V.scale(cam.up, dy * s));
        }
      });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (self.exportMode) return;
        const cc = self.sceneMode === 1 ? self.cam : self.cam2;
        cc.dist = M.clamp(cc.dist * (1 + Math.sign(e.deltaY) * 0.08), 3.2, 22);
      }, { passive: false });
    },

    /* ---------------- 演示 / 导出 ---------------- */
    playDemo(runId) {
      const D = DIRECTORS[runId];
      if (!D) return;
      this.switchScene(D.scene);
      this.scene.reset();
      this.simClock = 0; this.simSteps = 0; this.acc = 0;
      this.triggerQueue.length = 0;
      this.scene.setParams(D.params);
      for (const cue of D.cues) {
        this.triggerQueue.push({ at: warp(cue.t, D.slow), name: cue.a });
      }
      this.triggerQueue.sort((a, b) => a.at - b.at);
      this.playing = true; $('btnPlay').textContent = '⏸ 暂停';
      document.querySelectorAll('.demo-btn').forEach((x) => x.classList.toggle('active', x.dataset.run === runId));
      this.applyVolumeConfig();
    },

    installExport() {
      const self = this;
      window.videoExport = {
        runs: ['jelly-center', 'jelly-multi', 'jelly-offset', 'tank-full'],
        async begin(runId, opts) {
          const fps = (opts && opts.fps) || 30;
          const D = DIRECTORS[runId];
          if (!D) throw new Error('未知演示: ' + runId);
          self.exportMode = true;
          self.exportRun = D; self.exportFps = fps;
          document.body.classList.add('exporting');
          self.resize();
          self.switchScene(D.scene);
          self.scene.reset();
          self.simClock = 0; self.simSteps = 0; self.acc = 0;
          self.triggerQueue.length = 0;
          const P = Object.assign({}, self.params, D.params);
          self.scene.setParams(P);
          for (const cue of D.cues) self.triggerQueue.push({ at: warp(cue.t, D.slow), name: cue.a });
          self.triggerQueue.sort((a, b) => a.at - b.at);
          self.applyVolumeConfig();
          self.frames = Math.max(1, Math.ceil(D.duration * fps));
          self.exportCam = sampleCam(D.cam, 0);
          // 先渲染第 0 帧的静态状态（保证场景就绪）
          self.renderOnce();
          await GPU.queue.onSubmittedWorkDone();
          return { frames: self.frames };
        },
        async frame(i) {
          const D = self.exportRun;
          const T = i / self.exportFps;
          const target = warp(T, D.slow);
          const targetStep = Math.floor(target / SIM_DT + 1e-6);
          let guard = 0;
          while (self.simSteps < targetStep && guard < 4000) { self.stepOnce(); guard++; }
          if (D.tick) D.tick(T, self.scene, self);
          self.exportCam = sampleCam(D.cam, T);
          self.renderOnce();
          await GPU.queue.onSubmittedWorkDone();
          await new Promise((r) => requestAnimationFrame(() => r()));
        },
        end() {
          self.exportMode = false;
          self.exportRun = null;
          self.exportCam = null;
          document.body.classList.remove('exporting');
          self.scene.reset();
          self.simClock = 0; self.simSteps = 0; self.acc = 0;
          self.triggerQueue.length = 0;
          self.pushParams();
          self.queueTrigger(0.05, 'center');
          self.playing = true; $('btnPlay').textContent = '⏸ 暂停';
          self.applyVolumeConfig();
          self.setStatus();
        },
      };
    },
  };

  window.App = App;
  window.addEventListener('error', (e) => showFatal(e.message, e.filename + ':' + e.lineno));
  window.addEventListener('unhandledrejection', (e) => showFatal('Promise: ' + e.reason, e.reason && e.reason.stack));
  document.addEventListener('DOMContentLoaded', () => App.boot());
})();
