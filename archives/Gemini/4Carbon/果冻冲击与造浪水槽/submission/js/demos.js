(function () {
  const App = (window.App = window.App || {});
  const M = App.Math;

  const RUN_IDS = ['jelly-center', 'jelly-multi', 'jelly-offset', 'tank-full'];

  function evalKeyframes(keys, t) {
    if (t <= keys[0].t) return keys[0];
    if (t >= keys[keys.length - 1].t) return keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      if (t >= a.t && t <= b.t) {
        const u = M.smootherstep(a.t, b.t, t);
        return {
          eye: [M.lerp(a.eye[0], b.eye[0], u), M.lerp(a.eye[1], b.eye[1], u), M.lerp(a.eye[2], b.eye[2], u)],
          target: [M.lerp(a.target[0], b.target[0], u), M.lerp(a.target[1], b.target[1], u), M.lerp(a.target[2], b.target[2], u)],
          fov: M.lerp(a.fov || 38, b.fov || 38, u)
        };
      }
    }
    return keys[keys.length - 1];
  }

  function evalSpeedPiecewise(points, t) {
    if (t <= points[0][0]) return points[0][1];
    if (t >= points[points.length - 1][0]) return points[points.length - 1][1];
    for (let i = 0; i < points.length - 1; i++) {
      const [t0, s0] = points[i];
      const [t1, s1] = points[i + 1];
      if (t >= t0 && t <= t1) {
        return M.lerp(s0, s1, M.smoothstep(t0, t1, t));
      }
    }
    return 1.0;
  }

  function integrateSimTime(speedFn, tVideo) {
    if (tVideo <= 0) return 0.0;
    const steps = Math.max(16, Math.ceil(tVideo * 250));
    const h = tVideo / steps;
    let sum = 0.5 * (speedFn(0) + speedFn(tVideo));
    for (let i = 1; i < steps; i++) {
      sum += speedFn(i * h);
    }
    return sum * h;
  }

  const DEMO_SPECS = {
    'jelly-center': {
      scene: 'jelly',
      duration: 7.5, // <= 8s cap
      fixedDt: 1 / 120,
      speedCurve: [
        [0.00, 0.90],
        [0.08, 0.36], // Slow-mo right as heavy sphere wraps & squashes hero pudding!
        [1.55, 0.40], // Slow-mo through peak bulge & upward ball launch!
        [2.35, 1.08], // Brisk elastic multi-mode rebound waves
        [5.60, 1.28], // Smooth decay
        [7.50, 1.00]
      ],
      cameraKeys: [
        { t: 0.00, eye: [0.16, 0.66, 1.38], target: [0.00, 0.27, 0.02], fov: 36 },
        { t: 0.95, eye: [0.06, 0.46, 1.06], target: [0.00, 0.20, 0.02], fov: 35 }, // Push into contact crater & radial bulge!
        { t: 2.30, eye: [-0.18, 0.62, 1.36], target: [0.04, 0.28, 0.02], fov: 37 }, // Follow ball launch & whole-body ripple
        { t: 5.20, eye: [0.28, 0.58, 1.52], target: [0.05, 0.22, 0.02], fov: 37 },
        { t: 7.50, eye: [0.24, 0.56, 1.48], target: [0.04, 0.21, 0.02], fov: 37 }
      ],
      setup(app) {
        const jSim = app.jellySim;
        jSim.params.stiffness = 0.46;
        jSim.params.toughness = 0.92; // No fracture in jelly-center!
        jSim.params.ballMass = 4.6;
        jSim.params.dropHeight = 1.25;
        jSim.resetStage('single-hero');

        // Heavy dark-steel sphere ALREADY hurtling down right above the hero pudding crown at t = 0!
        jSim.spawnBall({
          x: 0.022,
          y: 0.57,
          z: 0.025,
          vx: 0.14,
          vy: -3.55,
          vz: 0.02,
          r: 0.114,
          mass: 4.6,
          material: 'tungsten'
        });
      },
      events: [
        {
          simTime: 4.6,
          run(app) {
            // Extra gentle tabletop settle damping in tail so ending is 100% calm
            for (const jb of app.jellySim.jellies) {
              for (let i = 0; i < jb.vel.length; i++) jb.vel[i] *= 0.85;
            }
          }
        }
      ],
      perStepHook(app, simT) {
        if (simT > 4.2) {
          const damp = Math.exp(-1.8 * (1 / 120) * M.smoothstep(4.2, 5.8, simT));
          for (const jb of app.jellySim.jellies) {
            for (let i = 0; i < jb.numVerts * 3; i++) jb.vel[i] *= damp;
          }
          for (const b of app.jellySim.balls) {
            b.vx *= damp; b.vz *= damp; b.wx *= damp; b.wy *= damp; b.wz *= damp;
          }
        }
      }
    },

    'jelly-multi': {
      scene: 'jelly',
      duration: 9.5, // <= 10s cap
      fixedDt: 1 / 120,
      speedCurve: [
        [0.00, 1.00],
        [1.10, 0.95], // Strike 1 & Strike 2 build up superposed oscillations briskly
        [2.35, 0.92],
        [2.65, 0.34], // Slow-mo climax right as heavy Strike 3 smashes & splits the heaving jelly!
        [4.55, 0.42], // Watch glistening crack tear open & elastic chunks separate!
        [5.60, 1.15], // Elastic fragments wobble, collide, and settle
        [8.20, 1.30],
        [9.50, 1.00]
      ],
      cameraKeys: [
        { t: 0.00, eye: [-0.22, 0.72, 1.44], target: [0.00, 0.25, 0.02], fov: 37 },
        { t: 2.30, eye: [0.08, 0.64, 1.24], target: [0.00, 0.24, 0.02], fov: 36 },
        { t: 3.60, eye: [0.04, 0.56, 1.02], target: [0.00, 0.19, 0.02], fov: 35 }, // Tight on fracture cleft!
        { t: 6.20, eye: [0.22, 0.74, 1.56], target: [0.00, 0.16, 0.02], fov: 38 }, // Pull out to frame all wobbling fragments
        { t: 9.50, eye: [0.26, 0.70, 1.54], target: [0.00, 0.15, 0.02], fov: 38 }
      ],
      setup(app) {
        const jSim = app.jellySim;
        jSim.params.stiffness = 0.52;
        jSim.params.toughness = 0.31; // Tuned so Strike 1 & 2 stay intact/craze, Strike 3 smashes wide open!
        jSim.params.ballMass = 3.2;
        jSim.params.dropHeight = 1.35;
        jSim.resetStage('single-hero');

        // Strike 1 (Light brushed aluminum sphere) ALREADY diving at t = 0!
        jSim.spawnBall({
          x: -0.02,
          y: 0.56,
          z: 0.02,
          vx: -0.32,
          vy: -2.45,
          vz: 0.06,
          r: 0.084,
          mass: 0.95,
          material: 'aluminum'
        });
      },
      events: [
        {
          // Strike 2: Heavier bronze ball lands right onto Strike 1's unsubsided oscillation!
          simTime: 0.66,
          run(app) {
            const hero = app.jellySim.jellies[0].computeBoundsAndCentroid();
            app.jellySim.spawnBall({
              x: hero.cx + 0.02,
              y: hero.maxY + 0.22,
              z: hero.cz,
              vx: 0.34,
              vy: -3.35,
              vz: -0.05,
              r: 0.100,
              mass: 2.25,
              material: 'bronze'
            });
          }
        },
        {
          // Strike 3: Massive heavy dark tungsten ball slams onto amplified oscillation -> smashes jelly apart!
          simTime: 1.62,
          run(app) {
            const hero = app.jellySim.jellies[0].computeBoundsAndCentroid();
            // Lower toughness slightly right before massive final blow if needed to guarantee dramatic multi-chunk split
            app.jellySim.params.toughness = 0.21;
            app.jellySim.spawnBall({
              x: hero.cx,
              y: hero.maxY + 0.24,
              z: hero.cz,
              vx: 0.02,
              vy: -5.25,
              vz: 0.03,
              r: 0.126,
              mass: 7.4,
              material: 'tungsten'
            });
          }
        }
      ],
      perStepHook(app, simT) {
        if (simT > 5.4) {
          const damp = Math.exp(-2.1 * (1 / 120) * M.smoothstep(5.4, 7.0, simT));
          for (const jb of app.jellySim.jellies) {
            for (let i = 0; i < jb.numVerts * 3; i++) jb.vel[i] *= damp;
          }
          for (const b of app.jellySim.balls) {
            b.vx *= damp; b.vz *= damp; b.wx *= damp; b.wy *= damp; b.wz *= damp;
          }
        }
      }
    },

    'jelly-offset': {
      scene: 'jelly',
      duration: 7.6, // <= 8s cap
      fixedDt: 1 / 120,
      speedCurve: [
        [0.00, 0.92],
        [0.08, 0.44], // Slow-mo on eccentric shoulder strike, jelly tilt & slide!
        [1.45, 0.52], // Ball rolls down tilted jelly flank
        [2.20, 1.06], // Ball collides with resting stone sphere & neighboring soft berry jelly!
        [5.40, 1.25],
        [7.60, 1.00]
      ],
      cameraKeys: [
        { t: 0.00, eye: [-0.08, 0.68, 1.48], target: [0.06, 0.24, 0.05], fov: 38 },
        { t: 1.20, eye: [0.05, 0.58, 1.32], target: [0.08, 0.21, 0.05], fov: 37 },
        { t: 3.10, eye: [0.34, 0.62, 1.48], target: [0.32, 0.18, 0.06], fov: 39 }, // Track rolling ball into stone ball & berry jelly!
        { t: 5.80, eye: [0.24, 0.66, 1.66], target: [0.22, 0.18, 0.05], fov: 39 },
        { t: 7.60, eye: [0.24, 0.65, 1.65], target: [0.22, 0.18, 0.05], fov: 39 }
      ],
      setup(app) {
        const jSim = app.jellySim;
        jSim.params.stiffness = 0.50;
        jSim.params.toughness = 0.92; // Intact, no fracture!
        jSim.params.ballMass = 4.0;
        jSim.params.dropHeight = 1.15;
        jSim.resetStage('standard');

        // Position resting stone sphere directly along roll-off trajectory between hero pudding and soft berry jelly!
        if (jSim.balls.length > 0) {
          jSim.balls[0].x = 0.34;
          jSim.balls[0].y = jSim.balls[0].r;
          jSim.balls[0].z = 0.07;
        }

        // Heavy polished steel ball diving obliquely onto right shoulder of hero pudding at t = 0!
        jSim.spawnBall({
          x: 0.09,
          y: 0.56,
          z: 0.05,
          vx: 1.42,
          vy: -3.35,
          vz: 0.05,
          r: 0.108,
          mass: 4.1,
          material: 'steel'
        });
      },
      events: [],
      perStepHook(app, simT) {
        if (simT > 4.4) {
          const damp = Math.exp(-1.9 * (1 / 120) * M.smoothstep(4.4, 6.0, simT));
          for (const jb of app.jellySim.jellies) {
            for (let i = 0; i < jb.numVerts * 3; i++) jb.vel[i] *= damp;
          }
          for (const b of app.jellySim.balls) {
            b.vx *= damp; b.vz *= damp; b.wx *= damp; b.wy *= damp; b.wz *= damp;
          }
        }
      }
    },

    'tank-full': {
      scene: 'tank',
      duration: 19.2, // <= 20s cap
      fixedDt: 1 / 60, // FluidTankGPU runs 4 internal substeps per fixedDt (= 1/240s substeps!)
      speedCurve: [
        [0.00, 0.92],
        [0.15, 0.55], // Crisp slow-mo on multi-density ball splash crowns, cavities & bubbles!
        [1.15, 1.05], // Water level rises & 4 density groups stratify clearly
        [3.40, 1.12], // Wavemaker starts: waves grow progressively taller
        [8.40, 1.05],
        [9.00, 0.46], // Slow-mo climax as steep wave curls over reef, breaks into whitewater & launches floaters!
        [11.30, 0.55], // Far-wall runup, slap & reflection
        [12.60, 1.28], // Wavemaker stops -> brisk decay & whitewater dissipation
        [17.50, 1.15],
        [19.20, 1.00]
      ],
      cameraKeys: [
        // Shot 1: Medium close-up on left-center basin for ball plunge, splash crowns & 4-group stratification!
        { t: 0.00, eye: [-0.36, 0.68, 1.56], target: [-0.42, 0.34, 0.00], fov: 37 },
        { t: 2.80, eye: [-0.32, 0.54, 1.52], target: [-0.38, 0.25, 0.00], fov: 37 },
        // Shot 2: Track wider showing wavemaker piston + 3 layers (surface floaters, mid green orbiters, bottom purple rollers!)
        { t: 6.20, eye: [-0.08, 0.62, 1.98], target: [-0.05, 0.30, 0.00], fov: 38 },
        // Shot 3: Push right toward shoaling reef & far glass wall as big waves steepen, break into whitewater & slam wall!
        { t: 9.60, eye: [0.36, 0.64, 1.62], target: [0.58, 0.38, -0.02], fov: 37 },
        { t: 11.80, eye: [0.52, 0.66, 1.68], target: [0.76, 0.38, 0.00], fov: 38 },
        // Shot 4: Majestic full-flume view as wavemaker halts, waves calm, whitewater clears & spheres settle!
        { t: 15.80, eye: [0.06, 0.68, 2.22], target: [0.04, 0.28, 0.00], fov: 38 },
        { t: 19.20, eye: [0.04, 0.66, 2.18], target: [0.04, 0.27, 0.00], fov: 38 }
      ],
      setup(app) {
        const fl = app.fluidSim;
        fl.params.densities = [0.34, 0.72, 1.00, 2.70];
        fl.params.waveAmp = 0.30;
        fl.params.waveFreq = 0.82;
        fl.resetTank(false, 20261113);

        // Spawn 32 multi-density balls ALREADY falling right above the calm water surface at t = 0 (vy ~ -1.8 m/s)!
        const rng = M.createRNG(8801);
        const nAdd = 32;
        const r = fl.ballRadius;
        const buf = new Float32Array(nAdd * 24);
        for (let i = 0; i < nAdd; i++) {
          const ix = i % 8;
          const iz = Math.floor(i / 8); // 4 rows in Z
          const groupIdx = (ix + iz) % 4;
          const dens = fl.params.densities[groupIdx];
          const col = fl.groupColors[groupIdx];

          const bx = -0.96 + ix * 0.155 + (iz % 2) * 0.035 + (rng() - 0.5) * 0.015;
          const bz = -0.225 + iz * 0.15 + (rng() - 0.5) * 0.015;
          const by = fl.restWaterHeight + r + 0.035 + (ix % 3) * 0.048 + iz * 0.028;
          const vy0 = -1.65 - (groupIdx === 3 ? 0.55 : 0.25) - rng() * 0.3;

          const o = i * 24;
          buf[o + 0] = bx; buf[o + 1] = by; buf[o + 2] = bz; buf[o + 3] = r;
          buf[o + 4] = (rng() - 0.5) * 0.12; buf[o + 5] = vy0; buf[o + 6] = (rng() - 0.5) * 0.10; buf[o + 7] = dens;
          buf[o + 8] = (rng() - 0.5) * 2.0; buf[o + 9] = 0.5; buf[o + 10] = (rng() - 0.5) * 2.0; buf[o + 11] = groupIdx;
          buf[o + 12] = 0; buf[o + 13] = 0; buf[o + 14] = 0; buf[o + 15] = 1;
          buf[o + 16] = col[0]; buf[o + 17] = col[1]; buf[o + 18] = col[2]; buf[o + 19] = 0.0;
          buf[o + 20] = bx; buf[o + 21] = by; buf[o + 22] = bz; buf[o + 23] = 0.0;
          fl.latestSphereReadback.set(buf.subarray(o, o + 24), i * 24);
        }
        fl.device.queue.writeBuffer(fl.tankSpheresBuf, 0, buf);
        fl.numSpheres = nAdd;

        // Bake Frame 0 render fields
        const enc = fl.device.createCommandEncoder();
        fl._writeSimUniforms(1 / 240, 0);
        fl.encodeRenderFields(enc);
        fl.device.queue.submit([enc.finish()]);
      },
      events: [
        {
          // Start wavemaker at gentle amplitude once initial stratification is clearly established!
          simTime: 2.65,
          run(app) {
            app.fluidSim.params.waveAmp = 0.34;
            app.fluidSim.params.waveFreq = 0.78;
            app.fluidSim.waveRunning = true;
          }
        },
        {
          // Ramp up to medium-steep waves
          simTime: 4.60,
          run(app) {
            app.fluidSim.params.waveAmp = 0.68;
            app.fluidSim.params.waveFreq = 0.84;
          }
        },
        {
          // Ramp up to full overturning breaking waves!
          simTime: 6.40,
          run(app) {
            app.fluidSim.params.waveAmp = 0.96;
            app.fluidSim.params.waveFreq = 0.88;
          }
        },
        {
          // Stop wavemaker so tank settles back to calm!
          simTime: 10.90,
          run(app) {
            app.fluidSim.waveRunning = false;
          }
        }
      ],
      perStepHook(app, simT) {
        if (simT > 12.8) {
          app.fluidSim.flipRatio = M.lerp(0.965, 0.84, M.smoothstep(12.8, 16.2, simT));
        }
      }
    }
  };

  class DemoAndExportController {
    constructor(app) {
      this.app = app;
      this.exportActive = false;
      this.liveDemoId = null;
      this.liveVideoTime = 0.0;

      this._activeSpec = null;
      this._exportFps = 30;
      this._totalFrames = 0;
      this._simTimeAccum = 0.0;
      this._firedEvents = new Set();
    }

    startSpec(runId) {
      const spec = DEMO_SPECS[runId];
      if (!spec) {
        throw new Error(`未知演示标识: ${runId}`);
      }
      this._activeSpec = spec;
      this._simTimeAccum = 0.0;
      this._firedEvents = new Set();

      this.app.setScene(spec.scene, true);
      spec.setup(this.app);
      if (this.app.syncUIFromParams) this.app.syncUIFromParams();

      const camPose = evalKeyframes(spec.cameraKeys, 0.0);
      this.app.camera.setDirectPose(camPose.eye, camPose.target, camPose.fov);
      return spec;
    }

    advanceToVideoTime(tVideo) {
      const spec = this._activeSpec;
      if (!spec) return 1.0;

      const speedFn = (t) => evalSpeedPiecewise(spec.speedCurve, t);
      const targetSimT = integrateSimTime(speedFn, tVideo);
      const dt = spec.fixedDt;

      while (this._simTimeAccum + dt <= targetSimT + 1e-7) {
        const nextSimT = this._simTimeAccum + dt;
        // Fire any scheduled events whose threshold is crossed
        for (let i = 0; i < spec.events.length; i++) {
          const ev = spec.events[i];
          if (!this._firedEvents.has(i) && nextSimT >= ev.simTime) {
            this._firedEvents.add(i);
            ev.run(this.app);
            if (this.app.syncUIFromParams) this.app.syncUIFromParams();
          }
        }

        if (spec.perStepHook) {
          spec.perStepHook(this.app, nextSimT);
        }

        if (spec.scene === 'jelly') {
          this.app.jellySim.step(dt);
        } else {
          this.app.fluidSim.step(dt);
        }
        this._simTimeAccum = nextSimT;
      }

      const camPose = evalKeyframes(spec.cameraKeys, tVideo);
      this.app.camera.setDirectPose(camPose.eye, camPose.target, camPose.fov);

      const rem = M.clamp((targetSimT - this._simTimeAccum) / dt, 0.0, 1.0);
      // If we haven't stepped yet (Frame 0), interpAlpha = 1.0 renders exact initial state
      return this._simTimeAccum === 0.0 ? 1.0 : rem;
    }

    // Live interactive showcase playback (triggered from bottom bar buttons)
    playInteractiveDemo(runId) {
      if (this.exportActive) return;
      this.liveDemoId = runId;
      this.liveVideoTime = 0.0;
      this.app.paused = false;
      this.startSpec(runId);
      if (this.app.updateDemoButtonsUI) this.app.updateDemoButtonsUI();
    }

    stopInteractiveDemo() {
      if (!this.liveDemoId) return;
      this.liveDemoId = null;
      this._activeSpec = null;
      this.app.camera.clearOverride();
      if (this.app.updateDemoButtonsUI) this.app.updateDemoButtonsUI();
    }

    stepInteractiveDemo(realDt) {
      if (!this.liveDemoId || !this._activeSpec) return 1.0;
      this.liveVideoTime += realDt;
      const dur = this._activeSpec.duration;
      if (this.liveVideoTime >= dur) {
        const alpha = this.advanceToVideoTime(dur);
        this.liveDemoId = null;
        this._activeSpec = null;
        this.app.camera.clearOverride();
        if (this.app.updateDemoButtonsUI) this.app.updateDemoButtonsUI();
        return alpha;
      }
      return this.advanceToVideoTime(this.liveVideoTime);
    }

    installWindowVideoExport() {
      const self = this;
      window.videoExport = {
        runs: [...RUN_IDS],

        async begin(runId, opts = {}) {
          await self.app.readyPromise;
          if (!DEMO_SPECS[runId]) {
            throw new Error(`Unsupported runId: ${runId}`);
          }
          const fps = Math.max(1, Math.round(Number(opts.fps) || 30));

          self.stopInteractiveDemo();
          self.exportActive = true;
          self._exportFps = fps;
          self.app.sound.setExportMute(true);
          document.body.classList.add('export-mode');

          // Ensure canvas matches current window resolution cleanly (supports up to 3840x2160+)
          self.app.gpu.resizeToWindow(window.innerWidth, window.innerHeight);
          self.app.jellyRenderer.rebuildBindGroups();
          self.app.tankRenderer.rebuildBindGroups();

          const spec = self.startSpec(runId);
          self._totalFrames = Math.max(1, Math.round(spec.duration * fps));
          await self.app.gpu.device.queue.onSubmittedWorkDone();
          return { frames: self._totalFrames };
        },

        async frame(i) {
          await self.app.readyPromise;
          if (!self.exportActive || !self._activeSpec) {
            throw new Error('videoExport.begin() must be called before frame(i).');
          }

          // Adapt dynamically if caller resized window between begin and frame
          if (self.app.gpu.resizeToWindow(window.innerWidth, window.innerHeight)) {
            self.app.jellyRenderer.rebuildBindGroups();
            self.app.tankRenderer.rebuildBindGroups();
          }

          const frameIdx = Math.max(0, Number(i) || 0);
          const tVideo = frameIdx / self._exportFps;

          // Note: For Frame 0, tVideo === 0 -> renders exact initial state without advancing!
          let interpAlpha = 1.0;
          if (frameIdx > 0) {
            interpAlpha = self.advanceToVideoTime(tVideo);
          } else {
            const camPose = evalKeyframes(self._activeSpec.cameraKeys, 0.0);
            self.app.camera.setDirectPose(camPose.eye, camPose.target, camPose.fov);
          }

          self.app.renderCurrentScene(interpAlpha);
          await self.app.gpu.device.queue.onSubmittedWorkDone();
        },

        end() {
          self.exportActive = false;
          self._activeSpec = null;
          self.app.camera.clearOverride();
          self.app.sound.setExportMute(false);
          document.body.classList.remove('export-mode');
          self.app.gpu.resizeToWindow();
          self.app.jellyRenderer.rebuildBindGroups();
          self.app.tankRenderer.rebuildBindGroups();
          if (self.app.syncUIFromParams) self.app.syncUIFromParams();
        }
      };
    }
  }

  App.DemoAndExportController = DemoAndExportController;
})();
