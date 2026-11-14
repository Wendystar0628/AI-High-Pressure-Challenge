(function () {
  const App = (window.App = window.App || {});
  const M = App.Math;

  class MainApplication {
    constructor() {
      this.canvas = document.getElementById('canvas');
      this.sound = new App.SoundEngine();
      this.camera = new M.OrbitCamera();

      this.activeScene = 'jelly'; // 'jelly' | 'tank'
      this.paused = false;
      this.slowMo = false;
      this.lastAction = 'jelly-center-trigger'; // remembers last user trigger for "重新运行"
      this._camPresetIdx = 0;

      this.gpu = null;
      this.jellySim = null;
      this.jellyRenderer = null;
      this.fluidSim = null;
      this.tankRenderer = null;

      this.demos = new App.DemoAndExportController(this);
      // Install window.videoExport immediately before async GPU init so it's available at page load!
      this.demos.installWindowVideoExport();

      this.readyPromise = this._initAsync();
    }

    async _initAsync() {
      try {
        this.gpu = new App.GPUCore(this.canvas);
        await this.gpu.init();

        this.jellySim = new App.JellySceneSim(this.sound);
        this.jellyRenderer = new App.JellyRenderer(this.gpu);

        this.fluidSim = new App.FluidTankGPU(this.gpu, this.sound);
        this.tankRenderer = new App.TankRenderer(this.gpu, this.fluidSim);

        this._setupCameraForScene('jelly');
        this._bindUI();
        this.syncUIFromParams();

        // Trigger a gentle welcome drop on Scene 1 right away so opening the page has immediate lively motion!
        this.jellySim.spawnBall({
          x: -0.04,
          y: 0.78,
          z: 0.04,
          vx: 0.02,
          vy: -1.2,
          vz: 0.0,
          mass: this.jellySim.params.ballMass
        });

        this._lastRAF = performance.now();
        requestAnimationFrame((ts) => this._tick(ts));
      } catch (err) {
        console.error(err);
        const banner = document.getElementById('error-banner');
        if (banner) {
          banner.textContent = '初始化失败：' + (err && err.message ? err.message : String(err));
          banner.style.display = 'block';
        }
        throw err;
      }
    }

    _setupCameraForScene(scene) {
      if (scene === 'jelly') {
        this.camera.setOrbit(0.16, 0.34, 1.82, [0.02, 0.22, 0.02], 38);
      } else {
        this.camera.setOrbit(0.06, 0.23, 3.04, [-0.05, 0.34, 0.0], 38);
      }
    }

    setScene(scene, fromDemo = false) {
      if (scene !== 'jelly' && scene !== 'tank') return;
      if (!fromDemo) {
        this.demos.stopInteractiveDemo();
      }
      const changed = this.activeScene !== scene;
      this.activeScene = scene;
      if (changed && !fromDemo) {
        this._setupCameraForScene(scene);
        this.lastAction = scene === 'jelly' ? 'jelly-center-trigger' : 'tank-release-and-wave';
      }
      this._updateSceneTabsUI();
    }

    _updateSceneTabsUI() {
      const tabJelly = document.getElementById('tab-jelly');
      const tabTank = document.getElementById('tab-tank');
      const panelJelly = document.getElementById('panel-jelly');
      const panelTank = document.getElementById('panel-tank');

      if (tabJelly && tabTank && panelJelly && panelTank) {
        const isJ = this.activeScene === 'jelly';
        tabJelly.classList.toggle('active', isJ);
        tabTank.classList.toggle('active', !isJ);
        panelJelly.classList.toggle('hidden', !isJ);
        panelTank.classList.toggle('hidden', isJ);
      }
      this._updateWaveBtnUI();
    }

    _updateWaveBtnUI() {
      const btn = document.getElementById('btn-toggle-wave');
      if (!btn || !this.fluidSim) return;
      if (this.fluidSim.waveRunning) {
        btn.textContent = '停止造浪';
        btn.classList.add('wave-running');
      } else {
        btn.textContent = '开始造浪';
        btn.classList.remove('wave-running');
      }
    }

    updateDemoButtonsUI() {
      const btns = document.querySelectorAll('[data-demo-run]');
      btns.forEach((b) => {
        const id = b.getAttribute('data-demo-run');
        b.classList.toggle('playing', this.demos.liveDemoId === id);
      });
    }

    syncUIFromParams() {
      if (!this.jellySim || !this.fluidSim) return;
      const setSlider = (id, valId, val, fmt) => {
        const el = document.getElementById(id);
        const vel = document.getElementById(valId);
        if (el) el.value = String(val);
        if (vel) vel.textContent = fmt(val);
      };

      const jp = this.jellySim.params;
      setSlider('sl-stiff', 'val-stiff', jp.stiffness, (v) => `${Math.round(v * 100)}%`);
      setSlider('sl-tough', 'val-tough', jp.toughness, (v) => `${Math.round(v * 100)}%`);
      setSlider('sl-mass', 'val-mass', jp.ballMass, (v) => `${Number(v).toFixed(1)} kg`);
      setSlider('sl-height', 'val-height', jp.dropHeight, (v) => `${Number(v).toFixed(2)} m`);

      const fp = this.fluidSim.params;
      setSlider('sl-wave-amp', 'val-wave-amp', fp.waveAmp, (v) => `${Math.round(v * 100)}%`);
      setSlider('sl-wave-freq', 'val-wave-freq', fp.waveFreq, (v) => `${Number(v).toFixed(2)} Hz`);
      for (let g = 0; g < 4; g++) {
        setSlider(`sl-dens-${g}`, `val-dens-${g}`, fp.densities[g], (v) => `${Number(v).toFixed(2)}`);
      }
      this._updateWaveBtnUI();
    }

    _bindUI() {
      const unlockSound = () => this.sound.initFromGesture();
      window.addEventListener('pointerdown', unlockSound, { passive: true });
      window.addEventListener('keydown', unlockSound, { passive: true });

      this.camera.attachInput(this.canvas, () => {
        unlockSound();
        if (this.demos.liveDemoId) {
          this.demos.stopInteractiveDemo();
        }
      });

      window.addEventListener('resize', () => {
        if (!this.gpu || this.demos.exportActive) return;
        if (this.gpu.resizeToWindow()) {
          this.jellyRenderer.rebuildBindGroups();
          this.tankRenderer.rebuildBindGroups();
        }
      });

      const onClick = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', (e) => { unlockSound(); fn(e); });
      };

      // Scene Switcher
      onClick('tab-jelly', () => this.setScene('jelly'));
      onClick('tab-tank', () => this.setScene('tank'));

      // Top-right Tools
      onClick('btn-cam-preset', () => {
        this.demos.stopInteractiveDemo();
        this._camPresetIdx = (this._camPresetIdx + 1) % 3;
        if (this.activeScene === 'jelly') {
          const views = [
            [0.16, 0.34, 1.82, [0.02, 0.22, 0.02]],
            [-0.48, 0.24, 1.48, [0.00, 0.20, 0.02]],
            [0.05, 0.72, 2.05, [0.02, 0.16, 0.02]]
          ];
          const v = views[this._camPresetIdx];
          this.camera.setOrbit(v[0], v[1], v[2], v[3], 38);
        } else {
          const views = [
            [0.06, 0.23, 3.04, [-0.05, 0.34, 0.0]],
            [-0.34, 0.26, 2.65, [-0.12, 0.32, 0.0]],
            [0.36, 0.25, 2.45, [0.32, 0.32, 0.0]]
          ];
          const v = views[this._camPresetIdx];
          this.camera.setOrbit(v[0], v[1], v[2], v[3], 38);
        }
      });

      onClick('btn-sound', () => {
        this.sound.setEnabled(!this.sound.enabled);
        const btn = document.getElementById('btn-sound');
        if (btn) {
          btn.textContent = this.sound.enabled ? '音效：开启' : '音效：静音';
          btn.classList.toggle('active', this.sound.enabled);
        }
      });

      onClick('btn-drawer-toggle', () => {
        const drawer = document.getElementById('control-drawer');
        const btn = document.getElementById('btn-drawer-toggle');
        if (drawer && btn) {
          const collapsed = drawer.classList.toggle('collapsed');
          btn.textContent = collapsed ? '展开参数' : '收起参数';
        }
      });

      // Scene 1 Impact Triggers
      onClick('btn-hit-center', () => {
        this.demos.stopInteractiveDemo();
        this.paused = false;
        this._syncPauseBtn();
        this.lastAction = 'jelly-center-trigger';
        this.jellySim.triggerCenterImpact();
      });

      onClick('btn-hit-offset', () => {
        this.demos.stopInteractiveDemo();
        this.paused = false;
        this._syncPauseBtn();
        this.lastAction = 'jelly-offset-trigger';
        this.jellySim.triggerOffsetImpact();
      });

      onClick('btn-hit-multi', () => {
        this.demos.stopInteractiveDemo();
        this.paused = false;
        this._syncPauseBtn();
        this.lastAction = 'jelly-multi-trigger';
        this.jellySim.triggerMultiImpact();
      });

      onClick('btn-hit-compare', () => {
        this.demos.stopInteractiveDemo();
        this.paused = false;
        this._syncPauseBtn();
        this.lastAction = 'jelly-compare-trigger';
        this.jellySim.triggerCompareAllThree();
      });

      // Scene 2 Tank Triggers
      onClick('btn-release-balls', () => {
        this.demos.stopInteractiveDemo();
        this.paused = false;
        this._syncPauseBtn();
        this.lastAction = 'tank-release-balls';
        this.fluidSim.releaseBallBatch(20, 0.20);
      });

      onClick('btn-toggle-wave', () => {
        this.demos.stopInteractiveDemo();
        this.paused = false;
        this._syncPauseBtn();
        this.fluidSim.waveRunning = !this.fluidSim.waveRunning;
        if (this.fluidSim.waveRunning) this.lastAction = 'tank-release-and-wave';
        this._updateWaveBtnUI();
      });

      // Sliders Binding
      const bindSlider = (id, valId, onVal, fmt) => {
        const el = document.getElementById(id);
        const vel = document.getElementById(valId);
        if (!el) return;
        el.addEventListener('input', () => {
          const v = parseFloat(el.value);
          onVal(v);
          if (vel) vel.textContent = fmt(v);
        });
      };

      bindSlider('sl-stiff', 'val-stiff', (v) => { this.jellySim.params.stiffness = v; }, (v) => `${Math.round(v * 100)}%`);
      bindSlider('sl-tough', 'val-tough', (v) => { this.jellySim.params.toughness = v; }, (v) => `${Math.round(v * 100)}%`);
      bindSlider('sl-mass', 'val-mass', (v) => { this.jellySim.params.ballMass = v; }, (v) => `${v.toFixed(1)} kg`);
      bindSlider('sl-height', 'val-height', (v) => { this.jellySim.params.dropHeight = v; }, (v) => `${v.toFixed(2)} m`);

      bindSlider('sl-wave-amp', 'val-wave-amp', (v) => { this.fluidSim.params.waveAmp = v; }, (v) => `${Math.round(v * 100)}%`);
      bindSlider('sl-wave-freq', 'val-wave-freq', (v) => { this.fluidSim.params.waveFreq = v; }, (v) => `${v.toFixed(2)} Hz`);

      for (let g = 0; g < 4; g++) {
        bindSlider(
          `sl-dens-${g}`,
          `val-dens-${g}`,
          (v) => { this.fluidSim.params.densities[g] = v; },
          (v) => `${v.toFixed(2)}`
        );
      }

      // Global Transport Controls: Trigger, Pause/Resume, Slow-Mo, Reset, Re-run
      onClick('btn-trigger-main', () => {
        this.demos.stopInteractiveDemo();
        this.paused = false;
        this._syncPauseBtn();
        if (this.activeScene === 'jelly') {
          this.lastAction = 'jelly-center-trigger';
          this.jellySim.triggerCenterImpact();
        } else {
          this.lastAction = 'tank-release-and-wave';
          if (this.fluidSim.numSpheres < 8) {
            this.fluidSim.releaseBallBatch(24, 0.18);
          }
          this.fluidSim.waveRunning = true;
          this._updateWaveBtnUI();
        }
      });

      onClick('btn-pause', () => {
        this.paused = !this.paused;
        this._syncPauseBtn();
      });

      onClick('btn-slowmo', () => {
        this.slowMo = !this.slowMo;
        const btn = document.getElementById('btn-slowmo');
        if (btn) {
          btn.textContent = this.slowMo ? '慢放：0.28x' : '慢放';
          btn.classList.toggle('active', this.slowMo);
        }
      });

      onClick('btn-reset', () => {
        this.demos.stopInteractiveDemo();
        this.paused = false;
        this._syncPauseBtn();
        if (this.activeScene === 'jelly') {
          this.jellySim.resetStage('standard');
        } else {
          this.fluidSim.resetTank(true);
          this._updateWaveBtnUI();
        }
      });

      onClick('btn-rerun', () => {
        this.paused = false;
        this._syncPauseBtn();
        if (this.demos.liveDemoId) {
          this.demos.playInteractiveDemo(this.demos.liveDemoId);
          return;
        }
        if (this.activeScene === 'jelly') {
          this.jellySim.resetStage('standard');
          if (this.lastAction === 'jelly-offset-trigger') this.jellySim.triggerOffsetImpact();
          else if (this.lastAction === 'jelly-multi-trigger') this.jellySim.triggerMultiImpact();
          else if (this.lastAction === 'jelly-compare-trigger') this.jellySim.triggerCompareAllThree();
          else this.jellySim.triggerCenterImpact();
        } else {
          this.fluidSim.resetTank(true);
          if (this.lastAction === 'tank-release-and-wave') {
            this.fluidSim.waveRunning = true;
          }
          this._updateWaveBtnUI();
        }
      });

      // 4 Built-in Choreographed Showcases
      document.querySelectorAll('[data-demo-run]').forEach((btn) => {
        btn.addEventListener('click', () => {
          unlockSound();
          const runId = btn.getAttribute('data-demo-run');
          if (this.demos.liveDemoId === runId) {
            this.demos.stopInteractiveDemo();
          } else {
            this.demos.playInteractiveDemo(runId);
            this._syncPauseBtn();
          }
        });
      });

      // Keyboard shortcuts (Space: pause, R: reset, S: slowmo)
      window.addEventListener('keydown', (e) => {
        if (this.demos.exportActive) return;
        if (e.code === 'Space') {
          e.preventDefault();
          this.paused = !this.paused;
          this._syncPauseBtn();
        } else if (e.code === 'KeyS') {
          document.getElementById('btn-slowmo')?.click();
        } else if (e.code === 'KeyR') {
          document.getElementById('btn-reset')?.click();
        }
      });
    }

    _syncPauseBtn() {
      const btn = document.getElementById('btn-pause');
      if (btn) {
        btn.textContent = this.paused ? '继续' : '暂停';
        btn.classList.toggle('active', this.paused);
      }
    }

    renderCurrentScene(interpAlpha = 1.0) {
      const encoder = this.gpu.device.createCommandEncoder();
      if (this.activeScene === 'jelly') {
        this.jellyRenderer.render(encoder, this.camera, this.jellySim, interpAlpha);
      } else {
        this.tankRenderer.render(encoder, this.camera);
      }
      this.gpu.device.queue.submit([encoder.finish()]);
    }

    _updateStatusHUD() {
      const el = document.getElementById('status-readout');
      if (!el) return;
      if (this.activeScene === 'jelly') {
        let totalFrags = 0;
        let totalCleaves = 0;
        for (const jb of this.jellySim.jellies) {
          totalFrags += jb.numFragments;
          totalCleaves += jb.cleavedTotal;
        }
        const crackState = totalCleaves === 0 ? '完好' : totalFrags > 3 ? `已砸裂 (${totalFrags} 块弹性体)` : `已开裂 (${totalCleaves} 裂面)`;
        el.textContent = `果冻体: ${totalFrags} 块 · 重球: ${this.jellySim.balls.length} 颗 · 状态: ${crackState}`;
      } else {
        const wState = this.fluidSim.waveRunning ? '造浪运行中' : '造浪已停';
        el.textContent = `流体粒子: ${(this.fluidSim.numParticles / 1000).toFixed(0)}k · 小球: ${this.fluidSim.numSpheres} 颗 (4 密度组) · ${wState}`;
      }
    }

    _tick(now) {
      const rawDt = Math.min(0.033, Math.max(0.001, (now - this._lastRAF) * 0.001));
      this._lastRAF = now;

      // During window.videoExport, normal real-time loop MUST NOT advance the simulation or overwrite canvas!
      if (!this.demos.exportActive) {
        let interpAlpha = 1.0;
        const speedMul = this.slowMo ? 0.28 : 1.0;

        if (!this.paused) {
          if (this.demos.liveDemoId) {
            interpAlpha = this.demos.stepInteractiveDemo(rawDt * speedMul);
          } else {
            const simDt = (1 / 60) * speedMul;
            if (this.activeScene === 'jelly') {
              this.jellySim.step(simDt);
            } else {
              this.fluidSim.step(simDt);
            }
          }
        }

        // Update continuous wave audio bed
        const isTank = this.activeScene === 'tank' && !this.paused;
        this.sound.updateWaveAudio(
          isTank,
          isTank ? Math.abs(this.fluidSim.paddleVel) : 0,
          isTank ? this.fluidSim.foamAudioLevel : 0,
          isTank ? this.fluidSim.wallSlamAudioImpulse : 0
        );
        if (this.fluidSim) this.fluidSim.wallSlamAudioImpulse = 0;

        this.renderCurrentScene(interpAlpha);
        this._updateStatusHUD();
      }

      requestAnimationFrame((ts) => this._tick(ts));
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.app = new MainApplication();
  });
})();
