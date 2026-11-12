// demo.js — 四段预置演示 + window.videoExport 逐帧导出接口
(function (global) {
  'use strict';

  // 相机关键帧插值
  function sampleCamera(keys, t) {
    if (keys.length === 0) return null;
    if (t <= keys[0].t) return keys[0];
    if (t >= keys[keys.length - 1].t) return keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t >= a.t && t <= b.t) {
        const u = M3.smootherstep((t - a.t) / Math.max(1e-5, b.t - a.t));
        return {
          target: {
            x: M3.lerp(a.target.x, b.target.x, u),
            y: M3.lerp(a.target.y, b.target.y, u),
            z: M3.lerp(a.target.z, b.target.z, u),
          },
          dist: M3.lerp(a.dist, b.dist, u),
          yaw: M3.lerp(a.yaw, b.yaw, u),
          pitch: M3.lerp(a.pitch, b.pitch, u),
          fov: M3.lerp(a.fov || 42, b.fov || 42, u),
        };
      }
    }
    return keys[keys.length - 1];
  }

  function speedAt(segments, t) {
    for (const s of segments) {
      if (t >= s.t0 && t < s.t1) return s.speed;
    }
    return 1;
  }

  // ==================== 演示定义 ====================
  const DEMOS = {
    'jelly-center': {
      name: '正中单击',
      duration: 8.0,
      scene: 'jelly',
      // 慢放：冲击瞬间
      segments: [
        { t0: 0, t1: 1.02, speed: 1 },
        { t0: 1.02, t1: 1.72, speed: 0.34 },
        { t0: 1.72, t1: 2.6, speed: 0.7 },
        { t0: 2.6, t1: 8.0, speed: 1 },
      ],
      camera: [
        { t: 0, target: { x: -0.3, y: 1.5, z: 0 }, dist: 13.5, yaw: 0.72, pitch: 0.42, fov: 44 },
        { t: 1.0, target: { x: -0.55, y: 1.15, z: 0 }, dist: 9.2, yaw: 0.62, pitch: 0.30, fov: 40 },
        { t: 2.0, target: { x: -0.6, y: 0.95, z: 0 }, dist: 6.8, yaw: 0.52, pitch: 0.22, fov: 38 },
        { t: 3.4, target: { x: -0.55, y: 1.05, z: 0 }, dist: 8.0, yaw: 0.40, pitch: 0.26, fov: 40 },
        { t: 5.4, target: { x: -0.45, y: 1.2, z: 0.1 }, dist: 10.5, yaw: 0.28, pitch: 0.34, fov: 42 },
        { t: 8.0, target: { x: -0.3, y: 1.35, z: 0 }, dist: 12.2, yaw: 0.20, pitch: 0.40, fov: 43 },
      ],
      setup(scene) {
        scene.resetJellyScene();
        // 只保留一块主果冻的冲击；加重球正中落下
        scene.params.ballMass = 34;
        scene.params.dropHeight = 3.6;
        scene.params.jellyStiff = 0.5;
        scene.params.jellyTough = 0.72; // 不裂
        scene._createJellies();
        scene._createRestBalls();
        this._spawned = false;
      },
      events: [
        {
          t: 0.02,
          run(scene) {
            const jelly = scene.jellies[1];
            const cx = jelly.origin.x + jelly.size.x * 0.5;
            const cz = jelly.origin.z + jelly.size.z * 0.5;
            const ball = new RigidBall({
              x: cx, y: 3.9, z: cz,
              radius: 0.36, mass: 38,
              color: { x: 0.86, y: 0.87, z: 0.9 },
              metallic: 1, roughness: 0.22,
              onImpact: (bb, imp, k) => {
                if (scene.audio && imp > 0.5) {
                  if (k === 'ball') scene.audio.ballHit(bb.kind);
                  else scene.audio.impact(Math.min(2, imp * 0.6));
                }
              },
            });
            scene.rigid.add(ball);
          },
        },
      ],
    },

    'jelly-multi': {
      name: '连击开裂',
      duration: 10.0,
      scene: 'jelly',
      segments: [
        { t0: 0, t1: 0.92, speed: 1 },
        { t0: 0.92, t1: 1.45, speed: 0.42 },
        { t0: 1.45, t1: 2.2, speed: 1 },
        { t0: 2.2, t1: 2.72, speed: 0.55 },
        { t0: 2.72, t1: 3.9, speed: 1 },
        { t0: 3.9, t1: 4.75, speed: 0.30 },
        { t0: 4.75, t1: 6.2, speed: 0.72 },
        { t0: 6.2, t1: 10.0, speed: 1 },
      ],
      camera: [
        { t: 0, target: { x: -0.4, y: 1.6, z: 0 }, dist: 13.0, yaw: 0.68, pitch: 0.40, fov: 44 },
        { t: 1.1, target: { x: -0.5, y: 1.1, z: 0 }, dist: 8.6, yaw: 0.56, pitch: 0.28, fov: 40 },
        { t: 2.4, target: { x: -0.35, y: 1.0, z: 0 }, dist: 7.6, yaw: 0.42, pitch: 0.24, fov: 39 },
        { t: 4.2, target: { x: -0.2, y: 0.95, z: 0.1 }, dist: 6.4, yaw: 0.30, pitch: 0.20, fov: 37 },
        { t: 5.6, target: { x: -0.15, y: 0.85, z: 0.15 }, dist: 7.2, yaw: 0.16, pitch: 0.22, fov: 38 },
        { t: 7.6, target: { x: -0.1, y: 1.0, z: 0.1 }, dist: 9.6, yaw: 0.02, pitch: 0.30, fov: 41 },
        { t: 10.0, target: { x: 0, y: 1.15, z: 0 }, dist: 11.8, yaw: -0.10, pitch: 0.36, fov: 43 },
      ],
      setup(scene) {
        scene.resetJellyScene();
        scene.params.jellyStiff = 0.48;
        scene.params.jellyTough = 0.30; // 较易裂
        scene._createJellies();
        scene._createRestBalls();
        this._fired = {};
      },
      events: [
        {
          t: 0.02, run(scene) {
            const j = scene.jellies[1];
            scene.rigid.add(new RigidBall({
              x: j.origin.x + j.size.x * 0.5 - 0.15, y: 3.2, z: j.origin.z + j.size.z * 0.5 + 0.1,
              radius: 0.30, mass: 18,
              color: { x: 0.86, y: 0.87, z: 0.9 }, metallic: 1, roughness: 0.24,
              onImpact: (bb, imp, k) => {
                if (scene.audio && imp > 0.5) scene.audio.impact(Math.min(1.6, imp * 0.5));
              },
            }));
          },
        },
        {
          t: 2.05, run(scene) {
            const j = scene.jellies[1];
            scene.rigid.add(new RigidBall({
              x: j.origin.x + j.size.x * 0.52, y: 3.5, z: j.origin.z + j.size.z * 0.48,
              radius: 0.34, mass: 28,
              color: { x: 0.84, y: 0.85, z: 0.88 }, metallic: 1, roughness: 0.22,
              onImpact: (bb, imp, k) => {
                if (scene.audio && imp > 0.5) scene.audio.impact(Math.min(1.8, imp * 0.55));
              },
            }));
          },
        },
        {
          t: 3.85, run(scene) {
            const j = scene.jellies[1];
            scene.rigid.add(new RigidBall({
              x: j.origin.x + j.size.x * 0.48, y: 3.9, z: j.origin.z + j.size.z * 0.52,
              radius: 0.40, mass: 46,
              color: { x: 0.82, y: 0.83, z: 0.87 }, metallic: 1, roughness: 0.2,
              onImpact: (bb, imp, k) => {
                if (scene.audio && imp > 0.5) scene.audio.impact(Math.min(2.2, imp * 0.62));
              },
            }));
          },
        },
      ],
    },

    'jelly-offset': {
      name: '偏击滑移',
      duration: 8.0,
      scene: 'jelly',
      segments: [
        { t0: 0, t1: 1.15, speed: 1 },
        { t0: 1.15, t1: 1.85, speed: 0.38 },
        { t0: 1.85, t1: 2.7, speed: 0.75 },
        { t0: 2.7, t1: 8.0, speed: 1 },
      ],
      camera: [
        { t: 0, target: { x: -0.3, y: 1.5, z: 0 }, dist: 13.2, yaw: 0.70, pitch: 0.42, fov: 44 },
        { t: 1.2, target: { x: -0.9, y: 1.15, z: 0.2 }, dist: 8.8, yaw: 0.60, pitch: 0.28, fov: 40 },
        { t: 2.4, target: { x: -1.0, y: 0.95, z: 0.3 }, dist: 7.2, yaw: 0.48, pitch: 0.22, fov: 38 },
        { t: 4.2, target: { x: -0.6, y: 0.9, z: 0.4 }, dist: 8.6, yaw: 0.34, pitch: 0.26, fov: 40 },
        { t: 6.2, target: { x: -0.3, y: 1.1, z: 0.3 }, dist: 10.8, yaw: 0.22, pitch: 0.34, fov: 42 },
        { t: 8.0, target: { x: -0.2, y: 1.3, z: 0.1 }, dist: 12.5, yaw: 0.12, pitch: 0.40, fov: 43 },
      ],
      setup(scene) {
        scene.resetJellyScene();
        scene.params.jellyStiff = 0.42;
        scene.params.jellyTough = 0.85; // 不裂
        scene._createJellies();
        scene._createRestBalls();
      },
      events: [
        {
          t: 0.02, run(scene) {
            const j = scene.jellies[1];
            scene.rigid.add(new RigidBall({
              x: j.origin.x + j.size.x * 0.22,
              y: 3.4,
              z: j.origin.z + j.size.z * 0.30,
              vx: 1.75, vz: -1.05,
              radius: 0.32, mass: 26,
              color: { x: 0.85, y: 0.86, z: 0.9 }, metallic: 1, roughness: 0.22,
              onImpact: (bb, imp, k) => {
                if (scene.audio && imp > 0.5) scene.audio.impact(Math.min(1.8, imp * 0.55));
              },
            }));
          },
        },
      ],
    },

    'tank-full': {
      name: '风浪全程',
      duration: 20.0,
      scene: 'tank',
      segments: [
        { t0: 0, t1: 1.1, speed: 1 },
        { t0: 1.1, t1: 1.9, speed: 0.42 },
        { t0: 1.9, t1: 3.2, speed: 0.8 },
        { t0: 3.2, t1: 5.0, speed: 1 },
        { t0: 9.6, t1: 11.0, speed: 0.55 },
        { t0: 13.6, t1: 14.6, speed: 0.6 },
        { t0: 14.6, t1: 20.0, speed: 1 },
      ],
      camera: [
        { t: 0, target: { x: 0.2, y: 1.5, z: 0 }, dist: 14.5, yaw: 0.62, pitch: 0.36, fov: 45 },
        { t: 1.4, target: { x: -0.4, y: 1.1, z: 0 }, dist: 10.5, yaw: 0.52, pitch: 0.24, fov: 42 },
        { t: 3.4, target: { x: 0.4, y: 1.15, z: 0 }, dist: 12.5, yaw: 0.38, pitch: 0.28, fov: 43 },
        { t: 6.5, target: { x: 0.6, y: 1.1, z: 0 }, dist: 11.5, yaw: 0.22, pitch: 0.24, fov: 42 },
        { t: 10.0, target: { x: 1.2, y: 1.25, z: 0 }, dist: 10.2, yaw: 0.05, pitch: 0.22, fov: 41 },
        { t: 13.8, target: { x: 0.8, y: 1.2, z: 0 }, dist: 10.8, yaw: -0.12, pitch: 0.26, fov: 42 },
        { t: 17.0, target: { x: 0.3, y: 1.35, z: 0 }, dist: 12.8, yaw: -0.28, pitch: 0.32, fov: 43 },
        { t: 20.0, target: { x: 0.2, y: 1.5, z: 0 }, dist: 14.2, yaw: -0.42, pitch: 0.38, fov: 44 },
      ],
      setup(scene) {
        scene.resetTankScene();
        scene.params.waveAmp = 0.22;
        scene.params.waveFreq = 0.48;
        scene.water.setWave(false, 0.22, 0.48);
        this._fired = {};
      },
      events: [
        {
          t: 0.02, run(scene) {
            scene.water.releaseBalls();
            if (scene.audio) scene.audio.splash(1.2);
          },
        },
        {
          t: 4.6, run(scene) {
            scene.params.waveAmp = 0.16;
            scene.params.waveFreq = 0.42;
            scene.water.setWave(true, 0.16, 0.42);
            if (scene.audio) scene.audio.startWaveLoop(0.5);
          },
        },
        {
          t: 7.2, run(scene) {
            scene.params.waveAmp = 0.38;
            scene.params.waveFreq = 0.52;
            scene.water.setWave(true, 0.38, 0.52);
            if (scene.audio) scene.audio.setWaveLevel(0.8);
          },
        },
        {
          t: 10.4, run(scene) {
            scene.params.waveAmp = 0.62;
            scene.params.waveFreq = 0.62;
            scene.water.setWave(true, 0.62, 0.62);
            if (scene.audio) scene.audio.setWaveLevel(1.15);
          },
        },
        {
          t: 13.9, run(scene) {
            scene.params.waveAmp = 0.88;
            scene.params.waveFreq = 0.72;
            scene.water.setWave(true, 0.88, 0.72);
            if (scene.audio) scene.audio.setWaveLevel(1.4);
          },
        },
        {
          t: 15.4, run(scene) {
            scene.water.setWave(false, 0, scene.params.waveFreq);
            scene.params.waveAmp = 0;
            if (scene.audio) {
              audioStop(scene);
            }
          },
        },
      ],
    },
  };

  function audioStop(scene) {
    if (scene.audio) scene.audio.stopWaveLoop();
  }

  // ==================== 播放 / 导出 ====================
  class DemoPlayer {
    constructor(scene) {
      this.scene = scene;
      this.playing = false;
      this.runId = null;
      this.demoTime = 0;
      this.exporting = false;
      this.exportFps = 60;
      this.exportFrames = 0;
      this._firedEvents = new Set();
      this.onStateChange = null;
      this.onProgress = null;
    }

    start(runId) {
      const d = DEMOS[runId];
      if (!d) return false;
      this.runId = runId;
      this.demo = d;
      this.playing = true;
      this.demoTime = 0;
      this._firedEvents.clear();
      this.scene.paused = false;
      this.scene.slowmo = false;
      this.scene.setMode(d.scene);
      d.setup(this.scene);
      if (this.onStateChange) this.onStateChange(true, d.name);
      return true;
    }

    stop() {
      this.playing = false;
      this.runId = null;
      if (this.onStateChange) this.onStateChange(false, '');
    }

    /** 交互播放：每帧调用 */
    tick(dt) {
      if (!this.playing || this.exporting) return;
      this._advance(dt);
      if (this.demoTime >= this.demo.duration) {
        this.stop();
      }
    }

    _advance(dtDemo) {
      const d = this.demo;
      // 事件
      for (let i = 0; i < d.events.length; i++) {
        if (!this._firedEvents.has(i) && this.demoTime >= d.events[i].t) {
          this._firedEvents.add(i);
          d.events[i].run(this.scene);
        }
      }
      // 时间扭曲积分
      const maxStep = 1 / 120;
      let remain = dtDemo;
      while (remain > 1e-6) {
        const step = Math.min(maxStep, remain);
        const sp = speedAt(d.segments, this.demoTime);
        const simDt = step * sp;
        this.scene.updateFixed(simDt);
        this.demoTime += step;
        remain -= step;
      }
      // 相机
      const cam = sampleCamera(d.camera, this.demoTime);
      if (cam) {
        this.scene.camera.setPose(cam.target, cam.dist, cam.yaw, cam.pitch, cam.fov);
      }
      if (this.onProgress) this.onProgress(this.demoTime / d.duration);
    }

    // ---------- 导出接口 ----------
    async exportBegin(runId, opts) {
      const d = DEMOS[runId];
      if (!d) throw new Error('未知演示: ' + runId);
      const fps = Math.max(1, Math.floor((opts && opts.fps) || 60));
      this.exporting = true;
      this.exportFps = fps;
      this.runId = runId;
      this.demo = d;
      this.demoTime = 0;
      this._firedEvents.clear();
      this.playing = true;
      document.body.classList.add('exporting');
      this.scene.setMode(d.scene);
      d.setup(this.scene);
      // 让初始状态稳定一步
      this.scene.updateFixed(1 / 240);
      this.exportFrames = Math.max(1, Math.round(d.duration * fps));
      await this.scene.r.finishFrame();
      return { frames: this.exportFrames };
    }

    async exportFrame(i) {
      if (!this.exporting) throw new Error('未在导出状态');
      const fps = this.exportFps;
      const target = i / fps;
      // 事件与时间推进到 target
      if (i === 0) {
        // 第 0 帧为初始时刻：触发 t=0 事件但不推进
        for (let e = 0; e < this.demo.events.length; e++) {
          if (!this._firedEvents.has(e) && this.demo.events[e].t <= 0) {
            this._firedEvents.add(e);
            this.demo.events[e].run(this.scene);
          }
        }
      } else {
        const dtDemo = target - this.demoTime;
        if (dtDemo > 0) this._advance(dtDemo);
        else {
          const cam = sampleCamera(this.demo.camera, target);
          if (cam) this.scene.camera.setPose(cam.target, cam.dist, cam.yaw, cam.pitch, cam.fov);
        }
      }
      this.demoTime = target;
      const cam = sampleCamera(this.demo.camera, this.demoTime);
      if (cam) this.scene.camera.setPose(cam.target, cam.dist, cam.yaw, cam.pitch, cam.fov);
      this.scene.render();
      await this.scene.r.finishFrame();
    }

    exportEnd() {
      this.exporting = false;
      this.playing = false;
      this.runId = null;
      document.body.classList.remove('exporting');
      this.scene.setMode(this.scene.mode);
    }
  }

  // ==================== window.videoExport ====================
  function installVideoExport(scene) {
    const player = new DemoPlayer(scene);
    scene.demoPlayer = player;

    const api = {
      runs: ['jelly-center', 'jelly-multi', 'jelly-offset', 'tank-full'],
      async begin(runId, opts) {
        return player.exportBegin(runId, opts);
      },
      async frame(i) {
        return player.exportFrame(i);
      },
      end() {
        player.exportEnd();
      },
    };
    global.videoExport = api;
    return player;
  }

  global.DemoPlayer = DemoPlayer;
  global.installVideoExport = installVideoExport;
  global.DEMOS = DEMOS;
})(window);
