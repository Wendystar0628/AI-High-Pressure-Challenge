// Scene 2: transparent wave tank with multi-density balls
import * as THREE from 'three';
import { WaterSim, WaterMesh } from './waterSim.js';
import { makeFloor } from './env.js';

const GROUPS = [
  { name: '低密度', density: 0.45, color: 0xff6b6b },
  { name: '中低密度', density: 0.82, color: 0xffb347 },
  { name: '中性浮力', density: 1.02, color: 0x3dd6c5 },
  { name: '中高密度', density: 1.55, color: 0x5b8cff },
  { name: '高密度', density: 3.20, color: 0xa56bff },
];

export class Scene2 {
  constructor(stage) {
    this.stage = stage;
    this.scene = stage.scene;
    this.camera = stage.camera;

    this.params = {
      waterLevel: 2.1,
      gravity: 9.8,
      viscosity: 0.35,
      ballR: 0.34,
      perGroup: 2,
      dropH: 3.2,
      tankL: 9,
      tankW: 3.6,
      tankH: 3.4,
      waveType: 'paddle',
      waveDelay: 1.0,
      waveAmp: 0.45,
      waveFreq: 1.1,
      waveDur: 5.0,
    };

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.floor = makeFloor(32);
    this.root.add(this.floor);

    this.buildTank();
    this.water = new WaterSim({
      lx: this.params.tankL,
      lz: this.params.tankW,
      level: this.params.waterLevel,
      gravity: this.params.gravity,
      viscosity: this.params.viscosity,
    });
    this.waterMesh = new WaterMesh(this.water, this.params.tankH);
    this.root.add(this.waterMesh.group);

    this.ballGroup = new THREE.Group();
    this.root.add(this.ballGroup);
    this.balls = [];

    this.waveMaker = this.buildWaveMaker();
    this.root.add(this.waveMaker.group);

    this.simTime = 0;
    this.running = false;
    this.paused = false;
    this.released = false;
    this.waveOn = false;
    this.tLast = null;
    this.autoWaveStarted = false;
    this.autoWaveStopped = false;
    this.events = [];

    this.reset();
  }

  buildTank() {
    if (this.tankGroup) this.root.remove(this.tankGroup);
    const { tankL: L, tankW: W, tankH: H } = this.params;
    const g = new THREE.Group();
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xcfeaff,
      metalness: 0,
      roughness: 0.06,
      transmission: 0.92,
      thickness: 0.35,
      ior: 1.5,
      transparent: true,
      opacity: 0.22,
      envMapIntensity: 1.3,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const t = 0.07;
    const mk = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat);
      m.position.set(x, y, z);
      m.castShadow = false;
      m.receiveShadow = true;
      m.renderOrder = 5;
      g.add(m);
      return m;
    };
    // 4 walls + bottom
    mk(t, H, W + t * 2, -L / 2 - t / 2, H / 2, 0);
    mk(t, H, W + t * 2, L / 2 + t / 2, H / 2, 0);
    mk(L, H, t, 0, H / 2, -W / 2 - t / 2);
    mk(L, H, t, 0, H / 2, W / 2 + t / 2);
    mk(L + t * 2, t, W + t * 2, 0, -t / 2, 0);

    // edge highlights
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.85 });
    const box = new THREE.BoxGeometry(L + t * 2, H + t, W + t * 2);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeMat);
    edges.position.y = (H + t) / 2 - t / 2;
    g.add(edges);

    this.tankGroup = g;
    this.root.add(g);
  }

  buildWaveMaker() {
    const group = new THREE.Group();
    const { tankW: W, tankH: H, tankL: L } = this.params;
    const paddleMat = new THREE.MeshStandardMaterial({
      color: 0xd8dde6, metalness: 0.7, roughness: 0.32, envMapIntensity: 1.1,
    });
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0x6b7382, metalness: 0.85, roughness: 0.3,
    });

    let paddle;
    const pW = 0.14, pH = H * 0.82, pD = W * 0.92;
    if (this.params.waveType === 'plunger') {
      paddle = new THREE.Mesh(new THREE.BoxGeometry(pD, pH, pW), paddleMat);
      // plunger spans across, moves in z? keep simple: same as paddle but taller
      paddle.position.set(-L / 2 + 0.35, pH / 2 + 0.15, 0);
    } else {
      paddle = new THREE.Mesh(new THREE.BoxGeometry(pW, pH, pD), paddleMat);
      paddle.position.set(-L / 2 + 0.35, pH / 2 + 0.15, 0);
    }
    paddle.castShadow = true;
    group.add(paddle);

    // back plate / frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, H * 1.02, W * 1.02), rodMat);
    frame.position.set(-L / 2 - 0.05, H * 0.51, 0);
    frame.castShadow = true;
    group.add(frame);

    // crank arm visible on top
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.12), rodMat);
    arm.position.set(-L / 2 + 0.9, H * 0.95, W * 0.52);
    arm.castShadow = true;
    group.add(arm);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16), rodMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(-L / 2 + 1.45, H * 0.95, W * 0.52);
    group.add(hub);

    return { group, paddle, arm, baseX: -L / 2 + 0.35, amp: this.params.waveAmp, phase: 0 };
  }

  // ---------- lifecycle ----------
  reset() {
    this.simTime = 0;
    this.running = false;
    this.paused = false;
    this.released = false;
    this.waveOn = false;
    this.tLast = null;
    this.autoWaveStarted = false;
    this.autoWaveStopped = false;
    this.events.length = 0;

    // rebuild tank/water for current params
    this.buildTank();
    this.water.lx = this.params.tankL;
    this.water.lz = this.params.tankW;
    this.water.gravity = this.params.gravity;
    this.water.viscosity = this.params.viscosity;
    this.water.setLevel(this.params.waterLevel);
    if (this.waterMesh) {
      this.root.remove(this.waterMesh.group);
    }
    this.waterMesh = new WaterMesh(this.water, this.params.tankH);
    this.root.add(this.waterMesh.group);

    // rebuild wave maker
    this.root.remove(this.waveMaker.group);
    this.waveMaker = this.buildWaveMaker();
    this.root.add(this.waveMaker.group);

    this._spawnBalls();
    this.waterMesh.update();
    this._syncWaveMaker(0);
  }

  _spawnBalls() {
    while (this.ballGroup.children.length) {
      const c = this.ballGroup.children.pop();
      c.geometry?.dispose?.();
    }
    this.balls.length = 0;
    const P = this.params;
    const r = P.ballR;
    const geo = new THREE.SphereGeometry(r, 40, 28);
    let idx = 0;
    const L = P.tankL, W = P.tankW;
    for (let gi = 0; gi < GROUPS.length; gi++) {
      const grp = GROUPS[gi];
      const mat = new THREE.MeshStandardMaterial({
        color: grp.color,
        metalness: 0.25,
        roughness: 0.32,
        envMapIntensity: 1.0,
      });
      for (let k = 0; k < P.perGroup; k++) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.ballGroup.add(mesh);
        // spread along tank length, slight z offsets
        const x = -L * 0.34 + (idx % 6) * (L * 0.13) + (gi - 2) * 0.22;
        const z = (k - (P.perGroup - 1) / 2) * (W * 0.16) + (gi % 2 ? 0.18 : -0.18);
        const y = P.waterLevel + P.dropH + gi * 0.18 + k * 0.12;
        const ball = {
          mesh,
          radius: r,
          density: grp.density,
          group: gi,
          groupName: grp.name,
          pos: new THREE.Vector3(
            THREE.MathUtils.clamp(x, -L / 2 + r * 1.4, L / 2 - r * 1.4),
            y,
            THREE.MathUtils.clamp(z, -W / 2 + r * 1.4, W / 2 - r * 1.4)
          ),
          vel: new THREE.Vector3(0, 0, 0),
          touchedWater: false,
          submerged: 0,
        };
        mesh.position.copy(ball.pos);
        this.balls.push(ball);
        idx++;
      }
    }
    // assign release order: stagger slightly, last group last
    for (const b of this.balls) {
      b.releaseDelay = b.group * 0.12;
    }
  }

  trigger() {
    this.reset();
    this.released = true;
    this.running = true;
    this.paused = false;
    this.events.push({ t: 0, type: 'release' });
  }

  release() { this.trigger(); }

  startWave() {
    if (this.waveOn) return;
    this.waveOn = true;
    this.water.waveActive = true;
    this.water.waveAmp = this.params.waveAmp;
    this.water.waveFreq = this.params.waveFreq;
    this.waveStopAt = this.simTime + this.params.waveDur;
    this.events.push({ t: this.simTime, type: 'waveStart' });
  }

  stopWave() {
    if (!this.waveOn) return;
    this.waveOn = false;
    this.water.waveActive = false;
    this.events.push({ t: this.simTime, type: 'waveStop' });
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; this.running = true; }

  setParams(p) {
    Object.assign(this.params, p);
    const structural = ['tankL', 'tankW', 'tankH', 'waterLevel', 'ballR', 'perGroup'].some(k => p[k] !== undefined);
    if (structural) {
      this.reset();
      return;
    }
    if (p.gravity !== undefined) this.water.gravity = p.gravity;
    if (p.viscosity !== undefined) this.water.viscosity = p.viscosity;
    if (p.waveAmp !== undefined) this.water.waveAmp = p.waveAmp;
    if (p.waveFreq !== undefined) this.water.waveFreq = p.waveFreq;
  }

  // ---------- simulation ----------
  step(dt, opts = {}) {
    if (!this.running || this.paused) return;
    this.simTime += dt;
    const P = this.params;
    const t = this.simTime;

    // release balls
    if (this.released) {
      for (const b of this.balls) {
        if (!b.touchedWater) {
          const surf = this.water.heightAt(b.pos.x, b.pos.z);
          if (b.pos.y - b.radius <= surf + 0.02) {
            b.touchedWater = true;
            // splash
            const impactV = Math.max(0, -b.vel.y);
            this.water.splash(b.pos.x, b.pos.z, b.radius * 3.2, 0.045 + impactV * 0.022);
            this.events.push({ t, type: 'splash', speed: impactV });
            // t_last: last group's last ball first touch
            const maxGroup = Math.max(...this.balls.map(x => x.group));
            const lastGroupBalls = this.balls.filter(x => x.group === maxGroup);
            if (lastGroupBalls.every(x => x.touchedWater) && this.tLast === null) {
              this.tLast = t;
              this.events.push({ t, type: 'tLast' });
            }
          }
        }
      }
    }

    // auto wave scheduling: t_last + delay → start, + waveDur → stop
    if (this.tLast !== null && !this.autoWaveStarted && t >= this.tLast + P.waveDelay) {
      this.startWave();
      this.autoWaveStarted = true;
    }
    if (this.waveOn && this.autoWaveStarted && !this.autoWaveStopped && t >= this.tLast + P.waveDelay + P.waveDur) {
      this.stopWave();
      this.autoWaveStopped = true;
    }

    // water
    const sub = 2;
    for (let s = 0; s < sub; s++) this.water.step(dt / sub);

    // wave maker visual
    this._syncWaveMaker(t);

    // balls
    const g = P.gravity;
    const rw = 1.0; // water density
    const floorY = 0.02 + this.params.ballR;
    const inX = P.tankL / 2 - this.params.ballR * 0.92;
    const inZ = P.tankW / 2 - this.params.ballR * 0.92;

    for (const b of this.balls) {
      if (!this.released) continue;
      if (t < b.releaseDelay) continue;

      const surf = this.water.heightAt(b.pos.x, b.pos.z);
      const r = b.radius;
      // submerged depth
      let subDepth = 0;
      if (b.pos.y < surf) {
        subDepth = Math.min(2 * r, surf - (b.pos.y - r));
      }
      b.submerged = subDepth / (2 * r);

      const vol = (4 / 3) * Math.PI * r * r * r;
      const subVol = subDepth <= 0 ? 0 :
        subDepth >= 2 * r ? vol :
          Math.PI * subDepth * subDepth * (r - subDepth / 3);
      const mass = vol * b.density;

      // gravity
      b.vel.y -= g * dt;

      // buoyancy
      if (subVol > 0) {
        const Fb = rw * subVol * g;
        b.vel.y += (Fb / mass) * dt;
        // drag vs fluid velocity
        const fv = new THREE.Vector3();
        this.water.velAt(b.pos.x, b.pos.y, b.pos.z, fv);
        const rel = fv.clone().sub(b.vel);
        const relSpeed = rel.length();
        const Cd = 0.9 * P.viscosity + 0.35;
        const area = Math.PI * r * r * (subVol / vol);
        const drag = rel.multiplyScalar(Cd * relSpeed * area / mass * dt);
        b.vel.add(drag);
        // added mass (virtual)
        const am = 0.5 * (subVol / vol);
        b.vel.multiplyScalar(1 / (1 + am * dt * 8));
        // wave orbital push (extra visual drive near surface)
        if (subDepth < r * 2.2) {
          const waveGrad = new THREE.Vector3();
          const e = 0.18;
          const hx = this.water.heightAt(b.pos.x + e, b.pos.z) - this.water.heightAt(b.pos.x - e, b.pos.z);
          const hz = this.water.heightAt(b.pos.x, b.pos.z + e) - this.water.heightAt(b.pos.x, b.pos.z - e);
          waveGrad.set(hx, 0, hz).multiplyScalar(g * 0.85);
          b.vel.addScaledVector(waveGrad, dt * (1 - b.submerged * 0.35));
        }
      }

      // integrate
      b.pos.addScaledVector(b.vel, dt);

      // walls
      if (b.pos.x < -inX) { b.pos.x = -inX; b.vel.x = Math.abs(b.vel.x) * 0.35; }
      if (b.pos.x > inX) { b.pos.x = inX; b.vel.x = -Math.abs(b.vel.x) * 0.35; }
      if (b.pos.z < -inZ) { b.pos.z = -inZ; b.vel.z = Math.abs(b.vel.z) * 0.35; }
      if (b.pos.z > inZ) { b.pos.z = inZ; b.vel.z = -Math.abs(b.vel.z) * 0.35; }

      // floor
      if (b.pos.y < floorY) {
        b.pos.y = floorY;
        if (b.vel.y < 0) b.vel.y = -b.vel.y * 0.22;
        b.vel.x *= (1 - 1.8 * dt);
        b.vel.z *= (1 - 1.8 * dt);
        if (Math.abs(b.vel.y) > 0.3) this.events.push({ t, type: 'bottomHit' });
      }

      // ceiling safety
      if (b.pos.y > P.tankH + 2) { b.pos.y = P.tankH + 2; b.vel.y = Math.min(0, b.vel.y); }

      b.mesh.position.copy(b.pos);
      b.mesh.rotation.x += b.vel.z * dt * 1.2;
      b.mesh.rotation.z -= b.vel.x * dt * 1.2;
    }

    // ball-ball
    const list = this.balls;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, dz = b.pos.z - a.pos.z;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < rr * rr && d2 > 1e-9) {
          const d = Math.sqrt(d2);
          const nX = dx / d, nY = dy / d, nZ = dz / d;
          const pen = rr - d;
          a.pos.x -= nX * pen * 0.5; a.pos.y -= nY * pen * 0.5; a.pos.z -= nZ * pen * 0.5;
          b.pos.x += nX * pen * 0.5; b.pos.y += nY * pen * 0.5; b.pos.z += nZ * pen * 0.5;
          const volA = (4 / 3) * Math.PI * a.radius ** 3;
          const volB = (4 / 3) * Math.PI * b.radius ** 3;
          const mA = volA * a.density, mB = volB * b.density;
          const rvx = b.vel.x - a.vel.x, rvy = b.vel.y - a.vel.y, rvz = b.vel.z - a.vel.z;
          const vn = rvx * nX + rvy * nY + rvz * nZ;
          if (vn < 0) {
            const e = 0.32;
            const jimp = -(1 + e) * vn / (1 / mA + 1 / mB);
            a.vel.x -= jimp * nX / mA; a.vel.y -= jimp * nY / mA; a.vel.z -= jimp * nZ / mA;
            b.vel.x += jimp * nX / mB; b.vel.y += jimp * nY / mB; b.vel.z += jimp * nZ / mB;
            if (Math.abs(vn) > 0.25) this.events.push({ t, type: 'ballClack', speed: Math.abs(vn) });
          }
        }
      }
    }

    this.waterMesh.update();
  }

  _syncWaveMaker(t) {
    const wm = this.waveMaker;
    const P = this.params;
    let phase;
    if (this.waveOn) {
      phase = this.water.wavePhase;
    } else {
      phase = 0;
    }
    const amp = this.waveOn ? P.waveAmp : 0;
    const dx = Math.sin(phase) * amp;
    if (P.waveType === 'plunger') {
      wm.paddle.position.z = dx * 1.2;
    } else {
      wm.paddle.position.x = wm.baseX + dx;
    }
    wm.arm.position.x = -P.tankL / 2 + 0.9 + dx * 0.85;
  }

  allInWater() {
    return this.balls.length > 0 && this.balls.every(b => b.touchedWater);
  }

  setCamera(t = 0) {
    const P = this.params;
    const ang = 0.72 + Math.sin(t * 0.05) * 0.04;
    const rad = 13.5;
    const h = 6.2;
    this.camera.position.set(Math.cos(ang) * rad * 0.55, h, Math.sin(ang) * rad);
    this.camera.lookAt(0, P.waterLevel * 0.8 + 0.5, 0);
    this.camera.fov = 48;
    this.camera.updateProjectionMatrix();
  }

  applyDemoPreset(runId) {
    this.reset();
    this.trigger();
  }

  // deterministic duration estimate for export
  demoDuration() {
    // release + fall + t_last + delay + waveDur + settle
    const P = this.params;
    const fallT = Math.sqrt(2 * P.dropH / P.gravity) + 0.6;
    const tLast = fallT + P.perGroup * 0.12 * 4;
    return tLast + P.waveDelay + P.waveDur + 6.5;
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  dispose() {
    this.scene.remove(this.root);
  }
}

export { GROUPS };
