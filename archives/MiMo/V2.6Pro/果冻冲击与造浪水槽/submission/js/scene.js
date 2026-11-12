// scene.js — 两个场景的构建、更新与绘制
(function (global) {
  'use strict';

  const IDENT = M3.mat4();

  function composeModel(out, x, y, z, sx, sy, sz, ry = 0) {
    const c = Math.cos(ry), s = Math.sin(ry);
    out[0] = c * sx; out[1] = 0; out[2] = -s * sx; out[3] = 0;
    out[4] = 0; out[5] = sy; out[6] = 0; out[7] = 0;
    out[8] = s * sz; out[9] = 0; out[10] = c * sz; out[11] = 0;
    out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
    return out;
  }

  function composeModelR(out, x, y, z, r, ry = 0) {
    return composeModel(out, x, y, z, r, r, r, ry);
  }

  class SceneApp {
    constructor(renderer) {
      this.r = renderer;
      this.mode = 'jelly'; // 'jelly' | 'tank'
      this.camera = new M3.OrbitCamera();
      this.time = 0;
      this.paused = false;
      this.slowmo = false;
      this.audio = null;

      this._model = M3.mat4();
      this._lightViewProj = M3.mat4();
      this._lightView = M3.mat4();
      this._lightProj = M3.mat4();
      this._tmpA = M3.mat4();
      this._tmpB = M3.mat4();

      // 参数
      this.params = {
        jellyStiff: 0.55,
        jellyTough: 0.55,
        ballMass: 24,
        dropHeight: 3.2,
        densities: [0.35, 0.75, 1.0, 2.2],
        waveAmp: 0.35,
        waveFreq: 0.55,
      };

      this._buildJellyScene();
      this._buildTankScene();
      this._blobScratch = null;
      this._foamScratch = null;

      this.eventFlags = { crack: 0, impact: 0, splash: 0 };
    }

    // ==================== 果冻场景 ====================
    _buildJellyScene() {
      this.rigid = new RigidWorld();
      this.jellies = [];
      this._createJellies();
      this._createRestBalls();
      this._jellyBlobBuffer = null;
    }

    _createJellies() {
      const mk = (opts) => new JellyBody(opts);
      this.jellies = [
        mk({
          name: 'soft',
          origin: { x: -3.1, y: 0.02, z: -0.2 },
          size: { x: 1.75, y: 1.55, z: 1.75 },
          res: [9, 8, 9],
          stiffness: 0.22,
          toughness: 0.42,
          color: { x: 0.95, y: 0.28, z: 0.16 },
          mass: 11,
          particleRadius: 0.20,
        }),
        mk({
          name: 'normal',
          origin: { x: -0.75, y: 0.02, z: -0.55 },
          size: { x: 2.05, y: 1.85, z: 2.0 },
          res: [10, 9, 10],
          stiffness: 0.55,
          toughness: 0.58,
          color: { x: 0.96, y: 0.52, z: 0.12 },
          mass: 16,
          particleRadius: 0.21,
        }),
        mk({
          name: 'brittle',
          origin: { x: 2.05, y: 0.02, z: 0.35 },
          size: { x: 1.7, y: 1.65, z: 1.7 },
          res: [9, 8, 9],
          stiffness: 0.78,
          toughness: 0.18,
          color: { x: 0.55, y: 0.85, z: 0.32 },
          mass: 13,
          particleRadius: 0.20,
        }),
      ];
    }

    _createRestBalls() {
      this.rigid.clear();
      const balls = [
        { x: -5.2, y: 0.34, z: 2.1, radius: 0.34, mass: 16, color: { x: 0.82, y: 0.83, z: 0.86 }, metallic: 1, roughness: 0.22 },
        { x: 4.9, y: 0.3, z: -1.6, radius: 0.3, mass: 11, color: { x: 0.55, y: 0.53, z: 0.5 }, metallic: 0.15, roughness: 0.72, kind: 1 },
        { x: 5.6, y: 0.25, z: 1.4, radius: 0.25, mass: 8, color: { x: 0.9, y: 0.88, z: 0.84 }, metallic: 0.9, roughness: 0.28 },
      ];
      for (const b of balls) {
        const ball = new RigidBall({
          ...b,
          onImpact: (bb, imp, kind) => {
            if (this.audio && imp > 0.4) {
              if (kind === 'ball') this.audio.ballHit(bb.kind);
              else this.audio.impact(imp * 0.7);
            }
          },
        });
        this.rigid.add(ball);
      }
    }

    spawnImpactBall(kind) {
      const p = this.params;
      const target = this.jellies[1]; // 正中/连续落在中间果冻
      const cx = (target.origin.x + target.size.x * 0.5);
      const cz = (target.origin.z + target.size.z * 0.5);
      const height = p.dropHeight;
      const mass = p.ballMass;
      const radius = 0.22 + mass * 0.006;

      const spawn = (x, z, m, vx = 0, vz = 0, h = height) => {
        const ball = new RigidBall({
          x, y: h, z,
          vx, vz,
          radius: 0.22 + m * 0.006,
          mass: m,
          color: { x: 0.84, y: 0.85, z: 0.88 },
          metallic: 1,
          roughness: 0.24,
          onImpact: (bb, imp, k) => {
            if (this.audio && imp > 0.5) {
              if (k === 'ball') this.audio.ballHit(bb.kind);
              else this.audio.impact(Math.min(2, imp * 0.55));
            }
          },
        });
        this.rigid.add(ball);
        return ball;
      };

      if (kind === 'center') {
        spawn(cx, cz, mass, 0, 0);
        if (this.audio) this.audio.impact(0.6);
      } else if (kind === 'offset') {
        // 偏心：落在边缘 + 横向速度
        spawn(cx - target.size.x * 0.32, cz + target.size.z * 0.28, mass * 0.92, 1.4, -0.9, height * 1.05);
      } else if (kind === 'multi') {
        // 连续三球：一记比一记重
        spawn(cx - 0.25, cz - 0.15, mass * 0.62, 0, 0, height * 0.72);
        setTimeout(() => {
          if (this.mode === 'jelly') spawn(cx + 0.28, cz + 0.2, mass * 0.95, 0, 0, height * 0.9);
        }, 380);
        setTimeout(() => {
          if (this.mode === 'jelly') spawn(cx, cz, mass * 1.55, 0, 0, height * 1.12);
        }, 820);
      }
    }

    resetJellyScene() {
      this._createJellies();
      this._createRestBalls();
      this.time = 0;
    }

    _updateJelly(dt) {
      const world = {
        gravity: -9.81,
        tableY: 0,
        balls: this.rigid.balls,
        jellies: this.jellies,
        onCrack: (jelly, x, y, z) => {
          this.eventFlags.crack = this.time;
          if (this.audio) this.audio.crack();
        },
        onBallContact: (ball, imp) => {
          if (this.audio && imp > 1.5) this.audio.jellyWobble(Math.min(1.5, imp * 0.12));
        },
      };

      for (const j of this.jellies) {
        j.savePrev();
      }
      // 同步球参数
      for (const j of this.jellies) {
        if (j.name === 'soft') j.setMaterial(0.12 + this.params.jellyStiff * 0.35, this.params.jellyTough * 0.55 + 0.12);
        else if (j.name === 'normal') j.setMaterial(0.3 + this.params.jellyStiff * 0.55, this.params.jellyTough * 0.8 + 0.15);
        else j.setMaterial(0.6 + this.params.jellyStiff * 0.38, this.params.jellyTough * 0.35 + 0.05);
      }

      const sub = 2;
      for (let s = 0; s < sub; s++) {
        this.rigid.step(dt / sub);
        for (const j of this.jellies) {
          j.solve(dt / sub, world);
        }
      }
      for (const j of this.jellies) {
        j.updateVelocities(dt);
      }
    }

    _drawJellyScene() {
      const r = this.r;
      // 台面
      composeModel(this._model, 0, -0.32, 0, 15, 0.62, 9);
      r.drawMesh('box111', this._model, { r: 0.32, g: 0.34, b: 0.38 }, [0.62, 0.05, 0, 4]);
      // 台沿
      composeModel(this._model, 0, -0.9, 0, 15.6, 0.55, 9.6);
      r.drawMesh('box111', this._model, { r: 0.16, g: 0.18, b: 0.22 }, [0.75, 0.1, 0, 2]);

      // 果冻元球
      const merged = JellyBody.mergeBlobs(this.jellies, this._blobScratch);
      this._blobScratch = merged.data;
      if (!this._jellyBlobBuffer || this._jellyBlobByte < merged.data.byteLength) {
        this._jellyBlobBuffer = r.makeStorageBuffer(merged.data);
        this._jellyBlobByte = merged.data.byteLength;
      } else {
        r.writeBuffer(this._jellyBlobBuffer, merged.data);
      }
      r.drawBlobs(this._jellyBlobBuffer, merged.count, { shadow: true });

      // 刚球
      for (const b of this.rigid.balls) {
        if (!b.alive) continue;
        composeModelR(this._model, b.x, b.y, b.z, b.radius);
        r.drawMesh('sphere', this._model, { r: b.color.x, g: b.color.y, b: b.color.z, a: 1 },
          [b.roughness, b.metallic, 0, 0]);
      }
    }

    // ==================== 水槽场景 ====================
    _buildTankScene() {
      try {
        this.water = new WaterSim(this.r);
        this.water.reset();
      } catch (e) {
        if (window.__showErr) window.__showErr('水槽初始化失败: ' + (e && e.message ? e.message : e));
        this.water = null;
      }
      this._ballRender = [];
    }

    resetTankScene() {
      if (!this.water) return;
      this.water.reset();
      this.water.setWave(false, this.params.waveAmp, this.params.waveFreq);
    }

    releaseBalls() {
      if (!this.water) return;
      this.water.releaseBalls();
    }

    setWaveEnabled(on) {
      if (!this.water) return;
      this.water.setWave(on, this.params.waveAmp, this.params.waveFreq);
      if (this.audio) {
        if (on) this.audio.startWaveLoop(this.params.waveAmp * 2.2);
        else this.audio.stopWaveLoop();
      }
    }

    _updateTank(dt) {
      if (!this.water) return;
      this.water.setWave(this.water.waveEnabled, this.params.waveAmp, this.params.waveFreq);
      this.water.densities = this.params.densities.slice();
      this.water.step(dt, 2);
    }

    _drawTankScene() {
      const r = this.r;
      const w = this.water;
      if (!w) return;
      const O = w.origin, S = w.size;
      const cx = O.x + S.x * 0.5, cy = O.y + S.y * 0.5, cz = O.z + S.z * 0.5;

      // 地面
      composeModel(this._model, cx, -0.28, cz, S.x + 4.5, 0.55, S.z + 3.5);
      r.drawMesh('box111', this._model, { r: 0.30, g: 0.32, b: 0.36 }, [0.66, 0.04, 0, 4]);

      // 槽底（略带地形起伏用多块近似 + 主底板）
      composeModel(this._model, cx, O.y - 0.12, cz, S.x, 0.24, S.z);
      r.drawMesh('box111', this._model, { r: 0.22, g: 0.25, b: 0.3 }, [0.7, 0.05, 0, 3]);

      // 地形隆起
      const t = w.terrain;
      composeModel(this._model, t.x, O.y + t.h * 0.42, t.z, t.r * 2.1, t.h * 0.95, t.r * 2.1);
      r.drawMesh('sphere', this._model, { r: 0.26, g: 0.28, b: 0.3 }, [0.8, 0.02, 0, 0]);

      // 造浪板
      const pp = w.getPaddleTransform();
      composeModel(this._model, pp.x, pp.y, pp.z, 0.16, S.y * 0.86, S.z * 0.92);
      r.drawMesh('box111', this._model, { r: 0.55, g: 0.6, b: 0.68 }, [0.35, 0.85, 0, 0]);
      // 造浪板支架
      composeModel(this._model, pp.x - 0.22, O.y + 0.35, cz, 0.35, 0.7, 0.35);
      r.drawMesh('box111', this._model, { r: 0.25, g: 0.28, b: 0.33 }, [0.55, 0.6, 0, 0]);

      // 水体元球
      r.drawBlobs(w.blobBuffer, w.particleCount, { shadow: true });

      // 白水
      r.drawFoam(w.foamBuffer, w.maxFoam);

      // 小球（CPU 读回数据）
      const balls = w.getBallCPU();
      for (const b of balls) {
        composeModelR(this._model, b.x, b.y, b.z, b.radius);
        r.drawMesh('sphere', this._model, { r: b.color.x, g: b.color.y, b: b.color.z },
          [0.38, 0.12, 0, 0]);
      }

      // 玻璃槽壁（画在水后）
      const gt = 0.055;
      const glassColor = { r: 0.85, g: 0.92, b: 1.0, a: 1 };
      const panel = (x, y, z, sx, sy, sz) => {
        composeModel(this._model, x, y, z, sx, sy, sz);
        r.drawGlass('box111', this._model, glassColor, [0.05, 0, 0, 0]);
      };
      // 前后左右 + 底
      panel(cx, cy, O.z - gt * 0.5, S.x + gt * 2, S.y + gt, gt);
      panel(cx, cy, O.z + S.z + gt * 0.5, S.x + gt * 2, S.y + gt, gt);
      panel(O.x - gt * 0.5, cy, cz, gt, S.y + gt, S.z + gt * 2);
      panel(O.x + S.x + gt * 0.5, cy, cz, gt, S.y + gt, S.z + gt * 2);

      // 玻璃边缘高光条
      const edge = { r: 0.75, g: 0.85, b: 0.98, a: 1 };
      const ey = O.y + S.y * 0.5;
      const edgeBar = (x, y, z, sx, sy, sz) => {
        composeModel(this._model, x, y, z, sx, sy, sz);
        r.drawGlass('box111', this._model, edge, [0.08, 0, 0, 0]);
      };
      edgeBar(cx, O.y + S.y + 0.02, O.z, S.x + 0.12, 0.07, 0.09);
      edgeBar(cx, O.y + S.y + 0.02, O.z + S.z, S.x + 0.12, 0.07, 0.09);
      edgeBar(O.x, O.y + S.y + 0.02, cz, 0.09, 0.07, S.z + 0.12);
      edgeBar(O.x + S.x, O.y + S.y + 0.02, cz, 0.09, 0.07, S.z + 0.12);
      edgeBar(O.x, ey, O.z, 0.08, S.y + 0.1, 0.08);
      edgeBar(O.x + S.x, ey, O.z, 0.08, S.y + 0.1, 0.08);
      edgeBar(O.x, ey, O.z + S.z, 0.08, S.y + 0.1, 0.08);
      edgeBar(O.x + S.x, ey, O.z + S.z, 0.08, S.y + 0.1, 0.08);
    }

    // ==================== 公共 ====================
    setMode(mode) {
      this.mode = mode;
      if (mode === 'jelly') {
        this.camera.setPose({ x: -0.2, y: 1.15, z: 0 }, 12.5, 0.62, 0.36, 42);
      } else {
        this.camera.setPose({ x: 0.2, y: 1.3, z: 0 }, 13.5, 0.55, 0.30, 44);
      }
    }

    reset() {
      if (this.mode === 'jelly') this.resetJellyScene();
      else this.resetTankScene();
    }

    update(dt) {
      if (this.paused) return;
      const scale = this.slowmo ? 0.28 : 1;
      const sdt = dt * scale;
      this.time += sdt;
      if (this.mode === 'jelly') {
        this._updateJelly(sdt);
      } else {
        this._updateTank(sdt);
      }
    }

    /** 固定步长推进（演示/导出用，不受暂停与慢放影响） */
    updateFixed(dt) {
      this.time += dt;
      if (this.mode === 'jelly') {
        this._updateJelly(dt);
      } else {
        this._updateTank(dt);
      }
    }

    _computeLight() {
      // 光源：左上前方，正交覆盖当前场景
      const isJelly = this.mode === 'jelly';
      const target = isJelly ? { x: -0.2, y: 0.8, z: 0 } : { x: 0.2, y: 1.0, z: 0 };
      const ext = isJelly ? 13 : 12;
      const lightDir = { x: -0.45, y: -0.82, z: -0.36 };
      const ll = Math.sqrt(lightDir.x ** 2 + lightDir.y ** 2 + lightDir.z ** 2);
      const dir = { x: lightDir.x / ll, y: lightDir.y / ll, z: lightDir.z / ll };
      const eye = { x: target.x - dir.x * 26, y: target.y - dir.y * 26, z: target.z - dir.z * 26 };
      M3.mat4LookAt(this._tmpA, eye, target, { x: 0, y: 1, z: 0 });
      M3.mat4Ortho(this._tmpB, -ext, ext, -ext * 0.72, ext * 0.72, 1, 60);
      M3.mat4Mul(this._lightViewProj, this._tmpB, this._tmpA);
      M3.mat4Copy(this._lightView, this._tmpA);
      M3.mat4Copy(this._lightProj, this._tmpB);
      return { dir, ext };
    }

    render() {
      const r = this.r;
      const { dir, ext } = this._computeLight();
      const isJelly = this.mode === 'jelly';

      r.beginFrame(this.camera, {
        lightViewProj: this._lightViewProj,
        lightView: this._lightView,
        lightProj: this._lightProj,
        lightDir: dir,
        lightIntensity: 1.35,
        envIntensity: 1.05,
        fogDensity: isJelly ? 0.012 : 0.010,
        fog: isJelly ? { x: 0.14, y: 0.17, z: 0.23 } : { x: 0.12, y: 0.17, z: 0.24 },
        blobMode: isJelly ? 0 : 1,
        blobColor: isJelly ? { x: 0.93, y: 0.42, z: 0.16 } : { x: 0.1, y: 0.36, z: 0.52 },
        time: this.time,
        shadowParams: { x: ext, y: ext * 0.72, z: 1, w: 60 },
      });

      if (isJelly) this._drawJellyScene();
      else this._drawTankScene();

      r.render();
    }
  }

  global.SceneApp = SceneApp;
  global.composeModel = composeModel;
})(window);
