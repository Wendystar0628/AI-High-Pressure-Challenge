// Scene 1: heavy ball(s) impacting jelly platform
import * as THREE from 'three';
import { JellySim, JellyMesh } from './jellySim.js';
import { makeFloor, makePlatform } from './env.js';

export class Scene1 {
  constructor(stage) {
    this.stage = stage;
    this.scene = stage.scene;
    this.camera = stage.camera;
    this.mode = 'center';
    this.running = false;
    this.paused = false;
    this.simTime = 0;
    this.balls = [];
    this.events = []; // sound triggers

    this.params = {
      ballMass: 5,
      ballRadius: 0.55,
      ballHeight: 6,
      ballCount: 3,
      ballInterval: 0.7,
      jellyStiff: 1.0,
      jellyDamp: 0.18,
      jellyDensity: 1.0,
      jellySize: 3.0,
      jellyFix: 'corner',
      gravity: 9.8,
      friction: 0.35,
      bounce: 0.25,
    };

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.floor = makeFloor(30);
    this.root.add(this.floor);

    this.platform = makePlatform(2.55);
    this.root.add(this.platform);

    this.jelly = new JellySim({
      width: this.params.jellySize,
      height: 1.25,
      depth: this.params.jellySize,
      stiffness: this.params.jellyStiff,
      damping: this.params.jellyDamp,
      density: this.params.jellyDensity,
      fix: this.params.jellyFix,
      gravity: this.params.gravity,
    });
    this.jellyMesh = new JellyMesh(this.jelly);
    this.root.add(this.jellyMesh.mesh);

    this.ballGroup = new THREE.Group();
    this.root.add(this.ballGroup);

    // ball materials: dark metal + stone variants
    this.ballMats = [
      new THREE.MeshStandardMaterial({
        color: 0x3a4250, metalness: 0.92, roughness: 0.28, envMapIntensity: 1.2,
      }),
      new THREE.MeshStandardMaterial({
        color: 0x555f6e, metalness: 0.75, roughness: 0.42, envMapIntensity: 1.0,
      }),
      new THREE.MeshStandardMaterial({
        color: 0x2c333e, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.3,
      }),
    ];

    this.reset();
  }

  // ---------- lifecycle ----------
  reset() {
    this.simTime = 0;
    this.running = false;
    this.paused = false;
    this.events.length = 0;
    this.jelly.setParams({
      width: this.params.jellySize,
      height: 1.25,
      depth: this.params.jellySize,
      stiffness: this.params.jellyStiff,
      damping: this.params.jellyDamp,
      density: this.params.jellyDensity,
      fix: this.params.jellyFix,
      gravity: this.params.gravity,
    });
    this.jelly.reset();
    this.jellyMesh.update();
    this._spawnBalls();
  }

  _spawnBalls() {
    // clear
    while (this.ballGroup.children.length) {
      const c = this.ballGroup.children.pop();
      c.geometry?.dispose?.();
    }
    this.balls.length = 0;

    const P = this.params;
    const r = P.ballRadius;
    const defs = [];
    if (this.mode === 'center') {
      defs.push({ x: 0, z: 0, delay: 0 });
    } else if (this.mode === 'offset') {
      defs.push({ x: P.jellySize * 0.30, z: 0, delay: 0 });
    } else {
      const n = P.ballCount;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + 0.35;
        const rad = 0.25 + 0.35 * ((i % 2) ? 1 : 0.3);
        defs.push({
          x: Math.cos(ang) * rad * P.jellySize * 0.35,
          z: Math.sin(ang) * rad * P.jellySize * 0.35,
          delay: i * P.ballInterval,
        });
      }
    }

    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const geo = new THREE.SphereGeometry(r, 48, 32);
      const mesh = new THREE.Mesh(geo, this.ballMats[i % this.ballMats.length]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.ballGroup.add(mesh);
      const y = 0.285 + this.jelly.params.height + P.ballHeight + d.delay * 0.35;
      const ball = {
        mesh,
        radius: r,
        mass: P.ballMass,
        invMass: 1 / P.ballMass,
        pos: new THREE.Vector3(d.x, y, d.z),
        vel: new THREE.Vector3(0, 0, 0),
        delay: d.delay,
        released: false,
        contact: false,
        contactCount: 0,
        pushX: 0, pushY: 0, pushZ: 0,
        alive: true,
      };
      mesh.position.copy(ball.pos);
      this.balls.push(ball);
    }
  }

  trigger() {
    if (this.paused) {
      this.paused = false;
      this.running = true;
      return;
    }
    this.reset();
    this.running = true;
    this.paused = false;
    this.events.push({ t: 0, type: 'trigger' });
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; this.running = true; }

  setMode(mode) {
    this.mode = mode;
    this.reset();
  }

  setParams(p) {
    Object.assign(this.params, p);
    const needRebuild = ['jellySize', 'jellyFix'].some(k => p[k] !== undefined);
    const needRebuildAll = ['jellySize'].some(k => p[k] !== undefined);
    if (needRebuildAll) {
      this.jelly.setParams({ width: this.params.jellySize, height: 1.25, depth: this.params.jellySize });
      this.jelly.reset();
      this._spawnBalls();
      this.jellyMesh.update();
    } else if (p.jellyFix !== undefined) {
      this.jelly.setParams({ fix: p.jellyFix });
    }
    if (p.jellyStiff !== undefined) this.jelly.setParams({ stiffness: p.jellyStiff });
    if (p.jellyDamp !== undefined) this.jelly.setParams({ damping: p.jellyDamp });
    if (p.jellyDensity !== undefined) this.jelly.setParams({ density: p.jellyDensity });
    if (p.gravity !== undefined) this.jelly.setParams({ gravity: p.gravity });
    if (p.ballRadius !== undefined || p.ballMass !== undefined || p.ballHeight !== undefined
      || p.ballCount !== undefined || p.ballInterval !== undefined) {
      this._spawnBalls();
    }
  }

  // ---------- simulation ----------
  step(dt, opts = {}) {
    const exportMode = !!opts.export;
    if (!this.running || this.paused) {
      // still render idle state
      return;
    }
    this.simTime += dt;

    const P = this.params;
    const sub = 4;
    const h = dt / sub;
    const gravity = P.gravity;

    for (let s = 0; s < sub; s++) {
      const t = this.simTime - dt + h * (s + 1);
      // release balls by delay
      for (const ball of this.balls) {
        if (!ball.released && t >= ball.delay) {
          ball.released = true;
          if (ball.delay > 0.01) this.events.push({ t, type: 'release' });
        }
        ball.contact = false;
        ball.contactCount = 0;
        ball.pushX = ball.pushY = ball.pushZ = 0;
      }
      const active = this.balls.filter(b => b.released);

      // jelly step (applies reactions into ball.push*)
      this.jelly.step(h, active);

      // ball integration
      for (const ball of active) {
        if (!ball.alive) continue;
        const g = -gravity;
        // gravity
        ball.vel.y += g * h;

        // jelly reaction: convert push displacement into velocity change
        if (ball.contact) {
          const k = 900; // stiffness-like gain (tuned for PBD push)
          const dampB = 0.32;
          ball.vel.x += ball.pushX * k * h;
          ball.vel.y += ball.pushY * k * h;
          ball.vel.z += ball.pushZ * k * h;
          // contact friction against jelly surface (approx: damp horizontal)
          const fr = P.friction * 1.1;
          ball.vel.x *= (1 - fr * h * 18);
          ball.vel.z *= (1 - fr * h * 18);
          // energy loss while embedded
          ball.vel.multiplyScalar(1 - dampB * h * 7);
          // record impact sound at first touch
          if (ball._wasContact === false) {
            const speed = ball.vel.length();
            this.events.push({ t, type: 'jellyImpact', speed });
          }
          ball._wasContact = true;
        } else {
          if (ball._wasContact) {
            this.events.push({ t, type: 'jellyRelease' });
          }
          ball._wasContact = false;
        }

        // integrate
        ball.pos.addScaledVector(ball.vel, h);

        // platform collision (cylinder radius 2.55, top y = 0.285)
        const platY = 0.285;
        const pr = 2.55;
        const horiz = Math.hypot(ball.pos.x, ball.pos.z);
        if (ball.pos.y - ball.radius < platY && horiz < pr + ball.radius * 0.5) {
          if (ball.pos.y < platY + ball.radius * 0.2) {
            // resting on platform
            const vy = ball.vel.y;
            if (vy < 0) {
              ball.vel.y = -vy * P.bounce;
              if (Math.abs(ball.vel.y) > 0.35) this.events.push({ t, type: 'platformHit' });
            }
            ball.pos.y = platY + ball.radius;
            // friction
            ball.vel.x *= (1 - P.friction * h * 18);
            ball.vel.z *= (1 - P.friction * h * 18);
            // rolling: convert some horizontal to spin (visual only, no rotation needed)
          }
        } else if (ball.pos.y - ball.radius < 0) {
          // floor
          const vy = ball.vel.y;
          if (vy < 0) ball.vel.y = -vy * P.bounce * 0.8;
          ball.pos.y = ball.radius;
          ball.vel.x *= (1 - P.friction * h * 16);
          ball.vel.z *= (1 - P.friction * h * 16);
          if (Math.abs(vy) > 0.6) this.events.push({ t, type: 'platformHit' });
        }

        // gentle air drag
        ball.vel.multiplyScalar(1 - 0.04 * h);
      }

      // ball-ball collisions
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          const a = active[i], b = active[j];
          const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, dz = b.pos.z - a.pos.z;
          const rr = a.radius + b.radius;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < rr * rr && d2 > 1e-9) {
            const d = Math.sqrt(d2);
            const nX = dx / d, nY = dy / d, nZ = dz / d;
            const pen = rr - d;
            a.pos.x -= nX * pen * 0.5; a.pos.y -= nY * pen * 0.5; a.pos.z -= nZ * pen * 0.5;
            b.pos.x += nX * pen * 0.5; b.pos.y += nY * pen * 0.5; b.pos.z += nZ * pen * 0.5;
            const rvx = b.vel.x - a.vel.x, rvy = b.vel.y - a.vel.y, rvz = b.vel.z - a.vel.z;
            const vn = rvx * nX + rvy * nY + rvz * nZ;
            if (vn < 0) {
              const e = 0.45;
              const jimp = -(1 + e) * vn / (a.invMass + b.invMass);
              a.vel.x -= jimp * nX * a.invMass; a.vel.y -= jimp * nY * a.invMass; a.vel.z -= jimp * nZ * a.invMass;
              b.vel.x += jimp * nX * b.invMass; b.vel.y += jimp * nY * b.invMass; b.vel.z += jimp * nZ * b.invMass;
              this.events.push({ t, type: 'ballClack', speed: Math.abs(vn) });
            }
          }
        }
      }
    }

    // sync meshes
    for (const ball of this.balls) {
      ball.mesh.position.copy(ball.pos);
      const w = Math.min(1, ball.vel.length() * 0.02);
      ball.mesh.rotation.x += ball.vel.z * dt * 0.5;
      ball.mesh.rotation.z -= ball.vel.x * dt * 0.5;
    }
    this.jellyMesh.update();

    // auto-finish when everything stays quiet for a sustained period
    if (this.running && !this.paused && this.simTime > 1.5) {
      let maxV = 0;
      for (const b of this.balls) maxV = Math.max(maxV, b.vel.length());
      const jp = this.jelly.pos, jpr = this.jelly.prev;
      let jv = 0;
      for (let i = 0; i < 24; i++) {
        const id = ((i * 37) % this.jelly.count) * 3;
        jv += Math.abs(jp[id] - jpr[id]) + Math.abs(jp[id + 1] - jpr[id + 1]);
      }
      if (maxV < 0.12 && jv < 0.008 && this.allReleased()) {
        this._quietTime = (this._quietTime || 0) + dt;
        if (this._quietTime > 1.8) this.running = false;
      } else {
        this._quietTime = 0;
      }
    }
  }

  allReleased() {
    return this.balls.every(b => b.released);
  }

  // camera for this scene
  setCamera(t = 0) {
    const ang = 0.58 + t * 0.010;
    const rad = 11.6 - Math.min(1.8, t * 0.05);
    const h = 5.8 + Math.sin(t * 0.10) * 0.18;
    this.camera.position.set(Math.cos(ang) * rad, h, Math.sin(ang) * rad);
    this.camera.lookAt(0, 3.1, 0);
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
  }

  // demo presets for video export
  applyDemoPreset(runId) {
    if (runId === 'jelly-center') {
      this.setMode('center');
    } else if (runId === 'jelly-multi') {
      this.setMode('multi');
    } else if (runId === 'jelly-offset') {
      this.setMode('offset');
    }
    this.reset();
  }

  demoDuration() {
    if (this.mode === 'multi') {
      return 4 + this.params.ballCount * this.params.ballInterval + 6.5;
    }
    return 11.5;
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  dispose() {
    this.scene.remove(this.root);
    this.jellyMesh.mesh.geometry.dispose();
  }
}
