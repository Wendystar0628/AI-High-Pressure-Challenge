// Application controller: camera rig, WebGPU lifecycle, UI bindings, keyboard/mouse input, and real-time loop
(() => {
  'use strict';

  const M = window.AppMath;

  class OrbitCamera {
    constructor() {
      this.azimuth = 0.22;
      this.elevation = 0.36;
      this.distance = 3.1;
      this.target = [0, 0.36, 0];
      this.fovRad = 40 * Math.PI / 180;
      this.directOverride = null;
    }

    setPresetForScene(sceneName) {
      this.directOverride = null;
      if (sceneName === 'jelly') {
        this.azimuth = 0.14;
        this.elevation = 0.34;
        this.distance = 3.75;
        this.target = [0.24, 0.34, 0.0];
        this.fovRad = 40 * Math.PI / 180;
      } else {
        this.azimuth = -0.04;
        this.elevation = 0.27;
        this.distance = 6.05;
        this.target = [3.12, 0.86, 0.70];
        this.fovRad = 41 * Math.PI / 180;
      }
    }

    getView() {
      if (this.directOverride) return this.directOverride;
      const cosE = Math.cos(this.elevation);
      const ex = this.target[0] + this.distance * cosE * Math.sin(this.azimuth);
      const ey = this.target[1] + this.distance * Math.sin(this.elevation);
      const ez = this.target[2] + this.distance * cosE * Math.cos(this.azimuth);
      return { eye: [ex, ey, ez], target: [...this.target], fovRad: this.fovRad };
    }
  }

  class App {
    constructor() {
      this.canvas = document.getElementById('viewport');
      this.gpu = new window.GpuCore.SharedGPU();
      this.camera = new OrbitCamera();

      this.activeSceneName = 'jelly';
      this.jellyScene = null;
      this.tankScene = null;
      this.demos = null;

      this.paused = false;
      this.slowMo = false;
      this.hudVisible = true;
      this.lastTime = 0;
      this.simAccum = 0;
      this.fpsCounter = 60;
      this.frameTimeAccum = 0;
      this.frameCount = 0;

      this.readyPromise = this._init();
    }

    get activeScene() {
      return this.activeSceneName === 'jelly' ? this.jellyScene : this.tankScene;
    }

    async _init() {
      try {
        await this.gpu.init(this.canvas);
        this.jellyScene = new window.SceneJelly.SceneJelly(this.gpu);
        this.tankScene = new window.SceneTank.SceneTank(this.gpu);
        this.demos = new window.AppDemos.DemoController(this);

        // Expose fixed videoExport interface
        window.videoExport = {
          runs: this.demos.runs,
          begin: (runId, opts) => this.demos.begin(runId, opts),
          frame: (i) => this.demos.frame(i),
          end: () => this.demos.end()
        };

        this.setScene('jelly');
        this._bindUI();
        this._bindInput();
        this.syncUIFromParams();

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this._loop(t));
      } catch (err) {
        const banner = document.getElementById('error-banner');
        if (banner) {
          banner.classList.remove('hidden');
          banner.textContent = `初始化失败：${err.message || err}`;
        }
        console.error(err);
      }
    }

    setScene(name) {
      this.activeSceneName = name;
      this.simAccum = 0;
      this.camera.setPresetForScene(name);
      if (name === 'jelly') {
        window.AppAudio.updateSurf(0, 0);
      }

      document.getElementById('btn-scene-jelly').classList.toggle('active', name === 'jelly');
      document.getElementById('btn-scene-tank').classList.toggle('active', name === 'tank');
      document.getElementById('panel-jelly').classList.toggle('hidden', name !== 'jelly');
      document.getElementById('panel-tank').classList.toggle('hidden', name !== 'tank');
    }

    setCameraDirect(cam) {
      this.camera.directOverride = cam;
    }

    renderOnce(camOverride = null) {
      const cam = camOverride || this.camera.getView();
      const enc = this.gpu.device.createCommandEncoder();
      this.activeScene.render(enc, cam);
      this.gpu.device.queue.submit([enc.finish()]);
    }

    _loop(now) {
      const realDt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      if (!this.demos || !this.demos.exportActive) {
        // Resize cleanly to match window
        this.gpu.resize(window.innerWidth, window.innerHeight, false);

        if (!this.paused) {
          const previewRunning = this.demos && this.demos.tickInteractivePreview(realDt);
          if (!previewRunning) {
            this.camera.directOverride = null;
            const timeScale = this.slowMo ? 0.35 : 1.0;
            const FIXED_DT = 1 / 60;
            this.simAccum += realDt * timeScale;
            let steps = 0;
            while (this.simAccum >= FIXED_DT && steps < 3) {
              this.activeScene.step(FIXED_DT);
              this.simAccum -= FIXED_DT;
              steps++;
            }
          }
        }
        this.renderOnce();
        this._updateTelemetry(realDt);
      }

      requestAnimationFrame((t) => this._loop(t));
    }

    _updateTelemetry(realDt) {
      this.frameTimeAccum += realDt;
      this.frameCount++;
      if (this.frameTimeAccum >= 0.4) {
        this.fpsCounter = Math.round(this.frameCount / this.frameTimeAccum);
        this.frameTimeAccum = 0;
        this.frameCount = 0;
        const statEl = document.getElementById('status-readout');
        if (statEl) {
          if (this.activeSceneName === 'jelly') {
            const st = this.jellyScene.getStats();
            statEl.textContent = `体积保持 ${(st.avgVolumeRatio * 100).toFixed(1)}% · 裂口 ${st.crackCount} · 重球 ${st.ballCount}`;
          } else {
            statEl.textContent = `粒子 ${(this.tankScene.numParticles / 1000).toFixed(0)}k · 造浪 ${this.tankScene.params.waveEnabled ? '运行中' : '停止'}`;
          }
        }
      }
    }

    syncUIFromParams() {
      const jp = this.jellyScene.params;
      const setSlider = (id, valId, val, fmt) => {
        const el = document.getElementById(id);
        const vel = document.getElementById(valId);
        if (el) el.value = val;
        if (vel) vel.textContent = fmt(val);
      };
      setSlider('sl-stiffness', 'val-stiffness', jp.stiffness, (v) => `${Number(v).toFixed(2)}x`);
      setSlider('sl-toughness', 'val-toughness', jp.toughness, (v) => `${Number(v).toFixed(2)}x`);
      setSlider('sl-ballmass', 'val-ballmass', jp.ballMass, (v) => `${Number(v).toFixed(2)}x`);
      setSlider('sl-dropheight', 'val-dropheight', jp.dropHeight, (v) => `${Number(v).toFixed(2)} m`);

      const tp = this.tankScene.params;
      setSlider('sl-d0', 'val-d0', tp.densities[0], (v) => Number(v).toFixed(2));
      setSlider('sl-d1', 'val-d1', tp.densities[1], (v) => Number(v).toFixed(2));
      setSlider('sl-d2', 'val-d2', tp.densities[2], (v) => Number(v).toFixed(2));
      setSlider('sl-d3', 'val-d3', tp.densities[3], (v) => Number(v).toFixed(2));
      setSlider('sl-waveamp', 'val-waveamp', tp.waveAmp, (v) => `${(Number(v) * 100).toFixed(0)} cm`);
      setSlider('sl-wavefreq', 'val-wavefreq', tp.waveFreq, (v) => `${Number(v).toFixed(2)} Hz`);

      const waveBtn = document.getElementById('btn-toggle-wave');
      if (waveBtn) {
        waveBtn.textContent = tp.waveEnabled ? '停止造浪' : '开始造浪';
        waveBtn.classList.toggle('warm', tp.waveEnabled);
        waveBtn.classList.toggle('primary', !tp.waveEnabled);
      }

      const pauseBtn = document.getElementById('btn-pause');
      if (pauseBtn) {
        pauseBtn.textContent = this.paused ? '继续' : '暂停';
        pauseBtn.classList.toggle('active', this.paused);
      }

      const slowBtn = document.getElementById('btn-slow');
      if (slowBtn) {
        slowBtn.classList.toggle('active', this.slowMo);
      }
    }

    _bindUI() {
      const unlockAudio = () => window.AppAudio.unlock();
      window.addEventListener('pointerdown', unlockAudio, { once: false });
      window.addEventListener('keydown', unlockAudio, { once: false });

      // Scene Switch
      document.getElementById('btn-scene-jelly').addEventListener('click', () => {
        this.demos.stopInteractivePreview();
        this.setScene('jelly');
        this.syncUIFromParams();
      });
      document.getElementById('btn-scene-tank').addEventListener('click', () => {
        this.demos.stopInteractivePreview();
        this.setScene('tank');
        this.syncUIFromParams();
      });

      // Transport controls
      document.getElementById('btn-pause').addEventListener('click', () => {
        this.paused = !this.paused;
        this.syncUIFromParams();
      });
      document.getElementById('btn-slow').addEventListener('click', () => {
        this.slowMo = !this.slowMo;
        this.syncUIFromParams();
      });
      document.getElementById('btn-reset').addEventListener('click', () => {
        this.demos.stopInteractivePreview();
        this.camera.setPresetForScene(this.activeSceneName);
        this.activeScene.resetScene('default');
        this.paused = false;
        this.syncUIFromParams();
      });
      document.getElementById('btn-rerun').addEventListener('click', () => {
        const lastRun = this.demos.previewRunId;
        if (lastRun) {
          this.demos.startInteractivePreview(lastRun);
        } else if (this.activeSceneName === 'jelly') {
          const mode = this.jellyScene.lastBallDropMode || 'center';
          this.jellyScene.resetScene('default');
          this.jellyScene.triggerImpact(mode);
        } else {
          const wasWave = this.tankScene.params.waveEnabled;
          this.tankScene.resetScene('default');
          this.tankScene.setParam('waveEnabled', wasWave);
        }
        this.paused = false;
        this.syncUIFromParams();
      });
      document.getElementById('btn-audio').addEventListener('click', (e) => {
        const next = !window.AppAudio.enabled;
        window.AppAudio.setEnabled(next);
        e.currentTarget.textContent = next ? '音效：开' : '音效：关';
        e.currentTarget.classList.toggle('active', next);
      });

      // Scene 1 Triggers & Sliders
      document.getElementById('btn-hit-center').addEventListener('click', () => {
        this.demos.stopInteractivePreview();
        this.camera.directOverride = null;
        this.jellyScene.triggerImpact('center');
      });
      document.getElementById('btn-hit-offset').addEventListener('click', () => {
        this.demos.stopInteractivePreview();
        this.camera.directOverride = null;
        this.jellyScene.triggerImpact('offset');
      });
      document.getElementById('btn-hit-multi').addEventListener('click', () => {
        this.demos.stopInteractivePreview();
        this.camera.directOverride = null;
        this.jellyScene.triggerImpact('multi');
      });

      const bindSlider = (id, cb) => {
        document.getElementById(id).addEventListener('input', (e) => {
          cb(parseFloat(e.target.value));
          this.syncUIFromParams();
        });
      };
      bindSlider('sl-stiffness', (v) => this.jellyScene.setParam('stiffness', v));
      bindSlider('sl-toughness', (v) => this.jellyScene.setParam('toughness', v));
      bindSlider('sl-ballmass', (v) => this.jellyScene.setParam('ballMass', v));
      bindSlider('sl-dropheight', (v) => this.jellyScene.setParam('dropHeight', v));

      // Scene 2 Triggers & Sliders
      document.getElementById('btn-drop-spheres').addEventListener('click', () => {
        this.demos.stopInteractivePreview();
        this.camera.directOverride = null;
        this.tankScene.releaseSpheres('default');
      });
      document.getElementById('btn-toggle-wave').addEventListener('click', () => {
        this.demos.stopInteractivePreview();
        this.tankScene.setParam('waveEnabled', !this.tankScene.params.waveEnabled);
        this.syncUIFromParams();
      });

      bindSlider('sl-d0', (v) => this.tankScene.setParam('density0', v));
      bindSlider('sl-d1', (v) => this.tankScene.setParam('density1', v));
      bindSlider('sl-d2', (v) => this.tankScene.setParam('density2', v));
      bindSlider('sl-d3', (v) => this.tankScene.setParam('density3', v));
      bindSlider('sl-waveamp', (v) => this.tankScene.setParam('waveAmp', v));
      bindSlider('sl-wavefreq', (v) => this.tankScene.setParam('waveFreq', v));

      // Preset Demos
      document.querySelectorAll('[data-demo]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const runId = btn.getAttribute('data-demo');
          this.demos.startInteractivePreview(runId);
        });
      });
    }

    _bindInput() {
      let dragging = false;
      let dragMode = 'orbit';
      let lastX = 0, lastY = 0;

      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      this.canvas.addEventListener('pointerdown', (e) => {
        this.demos.stopInteractivePreview();
        this.camera.directOverride = null;
        dragging = true;
        dragMode = (e.button === 2 || e.button === 1 || e.shiftKey) ? 'pan' : 'orbit';
        lastX = e.clientX;
        lastY = e.clientY;
        this.canvas.setPointerCapture(e.pointerId);
      });
      this.canvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        if (dragMode === 'orbit') {
          this.camera.azimuth -= dx * 0.0065;
          this.camera.elevation = M.clamp(this.camera.elevation + dy * 0.0055, -0.15, 1.42);
        } else {
          const right = [Math.cos(this.camera.azimuth), 0, -Math.sin(this.camera.azimuth)];
          const scale = this.camera.distance * 0.0014;
          this.camera.target[0] -= right[0] * dx * scale;
          this.camera.target[2] -= right[2] * dx * scale;
          this.camera.target[1] = M.clamp(this.camera.target[1] + dy * scale, -0.2, 2.5);
        }
      });
      this.canvas.addEventListener('pointerup', (e) => {
        dragging = false;
        if (this.canvas.hasPointerCapture(e.pointerId)) {
          this.canvas.releasePointerCapture(e.pointerId);
        }
      });
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.demos.stopInteractivePreview();
        this.camera.directOverride = null;
        const factor = Math.exp(e.deltaY * 0.0011);
        this.camera.distance = M.clamp(this.camera.distance * factor, 1.3, 11.5);
      }, { passive: false });

      window.addEventListener('keydown', (e) => {
        if (this.demos && this.demos.exportActive) return;
        if (e.code === 'Space') {
          e.preventDefault();
          this.paused = !this.paused;
          this.syncUIFromParams();
        } else if (e.key === 'r' || e.key === 'R') {
          this.demos.stopInteractivePreview();
          this.camera.setPresetForScene(this.activeSceneName);
          this.activeScene.resetScene('default');
          this.paused = false;
          this.syncUIFromParams();
        } else if (e.key === '1') {
          this.demos.stopInteractivePreview();
          this.setScene('jelly');
          this.syncUIFromParams();
        } else if (e.key === '2') {
          this.demos.stopInteractivePreview();
          this.setScene('tank');
          this.syncUIFromParams();
        } else if (e.key === 'h' || e.key === 'H') {
          this.hudVisible = !this.hudVisible;
          document.querySelector('.ui-layer').classList.toggle('hidden', !this.hudVisible);
        }
      });
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
  });
})();
