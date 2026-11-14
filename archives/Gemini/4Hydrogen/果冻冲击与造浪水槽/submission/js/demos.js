// Preset demo choreography & deterministic window.videoExport API
window.AppDemos = (() => {
  'use strict';

  const M = window.AppMath;

  const DEMOS = {
    'jelly-center': {
      scene: 'jelly',
      duration: 6.5,
      setup(app) {
        const s = app.jellyScene;
        s.setParam('stiffness', 1.05);
        s.setParam('toughness', 2.10);
        s.setParam('ballMass', 1.15);
        s.setParam('dropHeight', 1.80);
        s.resetScene('jelly-center');
        // Ball already mid-fall just above hero jelly so action begins immediately!
        s.spawnBall({
          pos: [0.0, 1.06, 0.0],
          vel: [0.0, -2.2, 0.0],
          radius: 0.21,
          mass: 0.72,
          matType: 0
        });
      },
      timeScale(t) {
        if (t < 0.14) return 1.0;
        if (t < 0.30) return M.lerp(1.0, 0.32, M.smoothstep(0.14, 0.30, t));
        if (t < 1.35) return 0.32;
        if (t < 1.95) return M.lerp(0.32, 1.0, M.smoothstep(1.35, 1.95, t));
        return 1.0;
      },
      updateEvents() {},
      camera(t) {
        if (t < 2.2) {
          const k = M.smoothstep(0.1, 1.5, t);
          return {
            eye: [M.lerp(0.42, 0.22, k), M.lerp(1.32, 1.02, k), M.lerp(3.05, 2.28, k)],
            target: [0.0, M.lerp(0.38, 0.32, k), 0.0],
            fovRad: 40 * Math.PI / 180
          };
        } else {
          const k = M.smoothstep(2.2, 5.5, t);
          return {
            eye: [M.lerp(0.22, -0.35, k), M.lerp(1.02, 1.18, k), M.lerp(2.28, 2.75, k)],
            target: [0.0, 0.34, 0.0],
            fovRad: 40 * Math.PI / 180
          };
        }
      }
    },

    'jelly-multi': {
      scene: 'jelly',
      duration: 9.0,
      setup(app) {
        const s = app.jellyScene;
        s.setParam('stiffness', 0.96);
        s.setParam('toughness', 0.85);
        s.setParam('ballMass', 1.25);
        s.setParam('dropHeight', 1.90);
        s.resetScene('jelly-multi');
        this._fired = { h2: false, h3: false };
        // Hit #1: medium stone ball already dropping onto center-left
        s.spawnBall({
          pos: [-0.04, 1.02, 0.02],
          vel: [0.04, -2.0, 0.0],
          radius: 0.17,
          mass: 0.45,
          matType: 2
        });
      },
      timeScale(t) {
        if (t < 2.68) return 1.0;
        if (t < 2.86) return M.lerp(1.0, 0.28, M.smoothstep(2.68, 2.86, t));
        if (t < 5.45) return 0.28;
        if (t < 6.20) return M.lerp(0.28, 1.0, M.smoothstep(5.45, 6.20, t));
        return 1.0;
      },
      updateEvents(app, t) {
        const s = app.jellyScene;
        if (!this._fired.h2 && t >= 1.15) {
          this._fired.h2 = true;
          s.spawnBall({
            pos: [0.07, 1.48, -0.02],
            vel: [-0.08, -2.6, 0.03],
            radius: 0.20,
            mass: 0.78,
            matType: 0
          });
        }
        if (!this._fired.h3 && t >= 2.48) {
          this._fired.h3 = true;
          // Heavy cast-iron impact triggers full fracture propagation!
          s.spawnBall({
            pos: [0.0, 1.78, 0.0],
            vel: [0.0, -3.7, 0.0],
            radius: 0.25,
            mass: 1.70,
            matType: 1
          });
        }
      },
      camera(t) {
        if (t < 2.2) {
          const k = M.smoothstep(0.0, 2.2, t);
          return {
            eye: [M.lerp(0.38, 0.18, k), M.lerp(1.28, 1.12, k), M.lerp(2.75, 2.48, k)],
            target: [0.0, 0.36, 0.0],
            fovRad: 40 * Math.PI / 180
          };
        } else if (t < 3.1) {
          const k = M.smoothstep(2.2, 3.1, t);
          return {
            eye: [M.lerp(0.18, -0.05, k), M.lerp(1.12, 1.06, k), M.lerp(2.48, 2.40, k)],
            target: [0.0, 0.34, 0.0],
            fovRad: 41 * Math.PI / 180
          };
        } else {
          const k = M.smoothstep(3.1, 5.8, t);
          return {
            eye: [M.lerp(-0.05, 0.06, k), M.lerp(1.06, 1.40, k), M.lerp(2.40, 3.45, k)],
            target: [0.0, 0.28, 0.0],
            fovRad: 42 * Math.PI / 180
          };
        }
      }
    },

    'jelly-offset': {
      scene: 'jelly',
      duration: 7.0,
      setup(app) {
        const s = app.jellyScene;
        s.setParam('stiffness', 0.92);
        s.setParam('toughness', 2.40);
        s.setParam('ballMass', 1.20);
        s.setParam('dropHeight', 1.60);
        s.resetScene('jelly-offset');
        // Oblique strike aimed at upper-right shoulder of tall plum pillar at [-0.35, 0, 0] so ball rolls off into waiting steel sphere!
        s.spawnBall({
          pos: [-0.24, 1.38, -0.04],
          vel: [0.95, -2.65, 0.26],
          radius: 0.20,
          mass: 0.90,
          matType: 2
        });
      },
      timeScale(t) {
        if (t < 0.14) return 1.0;
        if (t < 0.30) return M.lerp(1.0, 0.38, M.smoothstep(0.14, 0.30, t));
        if (t < 1.65) return 0.38;
        if (t < 2.25) return M.lerp(0.38, 1.0, M.smoothstep(1.65, 2.25, t));
        return 1.0;
      },
      updateEvents() {},
      camera(t) {
        const k = M.smoothstep(0.5, 4.8, t);
        return {
          eye: [M.lerp(-0.32, 0.35, k), M.lerp(1.26, 1.18, k), M.lerp(2.75, 2.95, k)],
          target: [M.lerp(-0.22, 0.28, k), M.lerp(0.45, 0.28, k), M.lerp(0.0, 0.12, k)],
          fovRad: 41 * Math.PI / 180
        };
      }
    },

    'tank-full': {
      scene: 'tank',
      duration: 18.0,
      setup(app) {
        const s = app.tankScene;
        s.setParam('density0', 0.34);
        s.setParam('density1', 0.72);
        s.setParam('density2', 1.00);
        s.setParam('density3', 2.45);
        s.setParam('waveAmp', 0.16);
        s.setParam('waveFreq', 0.58);
        s.setParam('waveEnabled', false);
        s.resetScene('tank-full');
      },
      timeScale(t) {
        // Brief slow-mo on sphere water entry & splash crowns, and on peak breaking wave over reef!
        if (t >= 0.14 && t < 1.15) {
          const e = Math.sin(M.clamp((t - 0.14) / 1.01, 0, 1) * Math.PI);
          return M.lerp(1.0, 0.42, e);
        }
        if (t >= 7.80 && t < 10.80) {
          const e = Math.sin(M.clamp((t - 7.80) / 3.00, 0, 1) * Math.PI);
          return M.lerp(1.0, 0.42, e);
        }
        return 1.0;
      },
      updateEvents(app, t) {
        const s = app.tankScene;
        if (t < 2.90) {
          s.setParam('waveEnabled', false);
        } else if (t < 11.40) {
          s.setParam('waveEnabled', true);
          // Gradually grow waves from gentle long swells to steep plunging breaking waves!
          const ramp = M.smoothstep(2.90, 6.80, t);
          s.setParam('waveAmp', M.lerp(0.14, 0.33, ramp));
          s.setParam('waveFreq', M.lerp(0.48, 0.60, ramp));
        } else {
          // Stop wavemaker so reflected waves damp and whitewater dissipates to calm
          s.setParam('waveEnabled', false);
        }
      },
      camera(t) {
        if (t < 3.4) {
          const k = M.smoothstep(0.0, 3.0, t);
          return {
            eye: [M.lerp(2.35, 2.15, k), M.lerp(1.75, 1.85, k), M.lerp(4.15, 4.75, k)],
            target: [M.lerp(2.40, 2.45, k), 0.78, 0.70],
            fovRad: 40 * Math.PI / 180
          };
        } else if (t < 7.5) {
          const k = M.smoothstep(3.4, 7.2, t);
          return {
            eye: [M.lerp(2.15, 2.05, k), M.lerp(1.85, 1.92, k), M.lerp(4.75, 5.15, k)],
            target: [M.lerp(2.45, 2.60, k), 0.82, 0.70],
            fovRad: 41 * Math.PI / 180
          };
        } else if (t < 12.6) {
          const k = M.smoothstep(7.5, 11.2, t);
          return {
            eye: [M.lerp(2.05, 3.65, k), M.lerp(1.92, 1.70, k), M.lerp(5.15, 4.25, k)],
            target: [M.lerp(2.60, 3.85, k), 0.86, 0.70],
            fovRad: 40 * Math.PI / 180
          };
        } else {
          const k = M.smoothstep(12.6, 16.5, t);
          return {
            eye: [M.lerp(3.65, 2.80, k), M.lerp(1.70, 1.86, k), M.lerp(4.25, 5.25, k)],
            target: [M.lerp(3.85, 2.80, k), 0.80, 0.70],
            fovRad: 41 * Math.PI / 180
          };
        }
      }
    }
  };

  class DemoController {
    constructor(app) {
      this.app = app;
      this.exportActive = false;
      this.previewRunId = null;
      this.activeSpec = null;
      this.fps = 60;
      this.videoTime = 0;
      this.simAccum = 0;
      this.savedUserState = null;
    }

    get runs() {
      return ['jelly-center', 'jelly-multi', 'jelly-offset', 'tank-full'];
    }

    _saveUserState() {
      const a = this.app;
      this.savedUserState = {
        sceneName: a.activeSceneName,
        paused: a.paused,
        slowMo: a.slowMo,
        jellyParams: { ...a.jellyScene.params },
        tankParams: {
          waveAmp: a.tankScene.params.waveAmp,
          waveFreq: a.tankScene.params.waveFreq,
          waveEnabled: a.tankScene.params.waveEnabled,
          densities: [...a.tankScene.params.densities]
        }
      };
    }

    _restoreUserState() {
      if (!this.savedUserState) return;
      const a = this.app;
      const u = this.savedUserState;
      Object.assign(a.jellyScene.params, u.jellyParams);
      a.tankScene.params.waveAmp = u.tankParams.waveAmp;
      a.tankScene.params.waveFreq = u.tankParams.waveFreq;
      a.tankScene.params.waveEnabled = u.tankParams.waveEnabled;
      a.tankScene.params.densities = [...u.tankParams.densities];
      a.setScene(u.sceneName);
      a.paused = u.paused;
      a.slowMo = u.slowMo;
      a.syncUIFromParams();
      this.savedUserState = null;
    }

    async begin(runId, options = {}) {
      await this.app.readyPromise;
      const spec = DEMOS[runId];
      if (!spec) throw new Error(`Unknown demo runId: ${runId}`);

      const fps = Math.max(1, Math.floor(Number(options.fps) || 60));
      if (!this.exportActive) {
        this._saveUserState();
      }
      this.exportActive = true;
      this.previewRunId = null;
      this.activeSpec = spec;
      this.fps = fps;
      this.videoTime = 0;
      this.simAccum = 0;

      window.AppAudio.setSuppressed(true);
      document.body.classList.add('export-mode');

      this.app.activeSceneName = spec.scene;
      spec.setup(this.app);

      // Ensure swapchain matches exact window size immediately
      this.app.gpu.resize(window.innerWidth, window.innerHeight, true);

      const frames = Math.max(1, Math.round(spec.duration * fps));
      return { frames };
    }

    async frame(i) {
      if (!this.exportActive || !this.activeSpec) {
        throw new Error('videoExport.frame() called without active begin()');
      }
      // Handle window resizes between calls
      this.app.gpu.resize(window.innerWidth, window.innerHeight, true);

      const spec = this.activeSpec;
      const tTarget = i / this.fps;
      const FIXED_SIM_DT = 1 / 60;

      if (i > 0 && tTarget > this.videoTime) {
        const dtVidTotal = tTarget - this.videoTime;
        const subSlices = Math.max(1, Math.ceil(dtVidTotal * 240));
        const dv = dtVidTotal / subSlices;

        for (let k = 0; k < subSlices; k++) {
          this.videoTime += dv;
          spec.updateEvents(this.app, this.videoTime);
          const ts = spec.timeScale(this.videoTime);
          this.simAccum += dv * ts;
          while (this.simAccum >= FIXED_SIM_DT - 1e-6) {
            this.app.activeScene.step(FIXED_SIM_DT);
            this.simAccum -= FIXED_SIM_DT;
          }
        }
      } else if (i === 0) {
        spec.updateEvents(this.app, 0);
      }

      const cam = spec.camera(tTarget);
      this.app.renderOnce(cam);
      await this.app.gpu.device.queue.onSubmittedWorkDone();
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }

    end() {
      if (!this.exportActive) return;
      this.exportActive = false;
      this.activeSpec = null;
      document.body.classList.remove('export-mode');
      window.AppAudio.setSuppressed(false);
      this._restoreUserState();
    }

    // Interactive preview mode for user clicking demo buttons in the UI
    startInteractivePreview(runId) {
      const spec = DEMOS[runId];
      if (!spec) return;
      this.previewRunId = runId;
      this.activeSpec = spec;
      this.videoTime = 0;
      this.simAccum = 0;
      this.app.setScene(spec.scene);
      spec.setup(this.app);
      this.app.paused = false;
      this.app.syncUIFromParams();
    }

    stopInteractivePreview() {
      this.previewRunId = null;
      this.activeSpec = null;
    }

    tickInteractivePreview(realDt) {
      if (!this.previewRunId || !this.activeSpec) return false;
      const spec = this.activeSpec;
      const clamped = Math.min(realDt, 0.05);
      this.videoTime += clamped;
      if (this.videoTime > spec.duration) {
        this.previewRunId = null;
        return false;
      }
      spec.updateEvents(this.app, this.videoTime);
      const ts = spec.timeScale(this.videoTime) * (this.app.slowMo ? 0.45 : 1.0);
      const FIXED_SIM_DT = 1 / 60;
      this.simAccum += clamped * ts;
      let steps = 0;
      while (this.simAccum >= FIXED_SIM_DT && steps < 4) {
        this.app.activeScene.step(FIXED_SIM_DT);
        this.simAccum -= FIXED_SIM_DT;
        steps++;
      }
      const cam = spec.camera(this.videoTime);
      this.app.setCameraDirect(cam);
      return true;
    }
  }

  return { DemoController, DEMOS };
})();
