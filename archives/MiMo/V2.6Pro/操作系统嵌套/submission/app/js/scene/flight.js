/* flight.js — helicopter flight dynamics for rehearsal.
   The airframe is unstable: without control input it diverges and crashes.
   A flight-controller process (flightctl.ks) keeps it flying via system calls. */

export class FlightModel {
  constructor(scene) {
    const p = scene.rehearsal.physics;
    this.p = p;
    this.state = {
      pos: [0, 0.4, 0],
      vel: [0, 0, 0],
      rot: [0, 0, 0],       // pitch(x), yaw(y), roll(z)
      angVel: [0, 0, 0],
      rotor: 0,
      collective: 0,
      ctrl: { collective: 0, pitch: 0, roll: 0, yaw: 0 },
      damage: {},
      grounded: true,
      crashed: false,
      crashedAt: null
    };
    this.wind = [0, 0, 0];
    this.faults = { engine: 0, rotor: 0, tail: 0 };
    this.time = 0;
    this.history = [];     // recorded samples
    this.inputLog = [];    // {t, control, wind, fault}
    this.recordEnabled = true;
  }

  setWind(w) { this.wind = [w.x || 0, w.y || 0, w.z || 0]; }
  setFault(f) {
    this.faults = { engine: f.engine || 0, rotor: f.rotor || 0, tail: f.tail || 0 };
    if (this.recordEnabled) this.inputLog.push({ t: this.time, type: 'fault', faults: { ...this.faults } });
  }

  applyControl(c) {
    this.state.ctrl = {
      collective: clamp(c.collective, 0, 1),
      pitch: clamp(c.pitch, -1, 1),
      roll: clamp(c.roll, -1, 1),
      yaw: clamp(c.yaw, -1, 1)
    };
    if (this.recordEnabled) {
      this.inputLog.push({ t: this.time, type: 'control', control: { ...this.state.ctrl } });
    }
  }

  /* step physics by dt seconds of virtual time */
  step(dt) {
    if (this.state.crashed && this.state.crashedAt !== null) {
      // ground settle
      this.state.rotor *= Math.max(0, 1 - dt * 0.6);
      this.time += dt;
      return this.state;
    }
    const s = this.state;
    const p = this.p;
    this.time += dt;

    // rotor spin-up toward commanded collective
    const targetRpm = s.ctrl.collective * 620 * (1 - this.faults.rotor * 0.55);
    s.rotor += (targetRpm - s.rotor) * Math.min(1, dt * 2.2);

    // engine power factor
    const power = 1 - this.faults.engine * 0.85;

    // thrust along body up
    const thrust = s.ctrl.collective * p.rotorThrustMax * power * (s.rotor / 620) * (1 - this.faults.rotor * 0.5);
    const up = bodyUp(s.rot);
    const fx = up[0] * thrust;
    const fy = up[1] * thrust - p.mass * p.gravity;
    const fz = up[2] * thrust;

    // aerodynamic drag
    const drag = p.dragCoef;
    const ax = fx / p.mass - s.vel[0] * drag;
    const ay = fy / p.mass - s.vel[1] * drag * 0.8;
    const az = fz / p.mass - s.vel[2] * drag;

    // wind & instability
    const inst = p.instability;
    const turb = this.time > 0 ? inst * 40 : 0;
    s.vel[0] += (ax + this.wind[0] * 0.03 + (Math.random() - 0.5) * turb * dt) * dt;
    s.vel[1] += (ay + this.wind[1] * 0.03 + (Math.random() - 0.5) * turb * dt * 0.5) * dt;
    s.vel[2] += (az + this.wind[2] * 0.03 + (Math.random() - 0.5) * turb * dt) * dt;

    s.pos[0] += s.vel[0] * dt;
    s.pos[1] += s.vel[1] * dt;
    s.pos[2] += s.vel[2] * dt;

    // torque from control
    const yawAuth = 1 - this.faults.tail * 0.92;
    const tPitch = s.ctrl.pitch * p.pitchTorque + (Math.random() - 0.5) * p.instability * 220;
    const tRoll = s.ctrl.roll * p.rollTorque + (Math.random() - 0.5) * p.instability * 200;
    const tYaw = s.ctrl.yaw * p.yawTorque * yawAuth + (Math.random() - 0.5) * p.instability * 120;

    s.angVel[0] += (tPitch / p.mass - s.angVel[0] * p.angDamp) * dt;
    s.angVel[1] += (tYaw / p.mass - s.angVel[1] * p.angDamp) * dt;
    s.angVel[2] += (tRoll / p.mass - s.angVel[2] * p.angDamp) * dt;

    // natural instability: pitch/roll drift when airborne
    if (!s.grounded) {
      s.angVel[0] += (Math.random() - 0.48) * p.instability * 55 * dt;
      s.angVel[2] += (Math.random() - 0.52) * p.instability * 55 * dt;
      if (this.faults.tail > 0.3) {
        s.angVel[1] += (this.faults.tail * 0.8 + Math.random() * 0.3) * dt * 1.4;
      }
      if (this.faults.engine > 0.4) {
        s.angVel[2] += (Math.random() - 0.3) * this.faults.engine * 0.7 * dt;
      }
    }

    s.rot[0] += s.angVel[0] * dt;
    s.rot[1] += s.angVel[1] * dt;
    s.rot[2] += s.angVel[2] * dt;

    // ground collision
    const groundY = 0.42;
    if (s.pos[1] <= groundY) {
      s.pos[1] = groundY;
      const impact = Math.abs(s.vel[1]) + Math.hypot(s.vel[0], s.vel[2]) * 0.6;
      if (impact > 2.4 && !s.crashed) {
        s.crashed = true;
        s.crashedAt = this.time;
        s.damage = { body: 1, engine: 1, rotor: 1, tail: 1 };
        if (this.recordEnabled) {
          this.inputLog.push({ t: this.time, type: 'impact', impact, pos: [...s.pos] });
        }
      } else if (s.vel[1] < 0) {
        s.vel[1] = 0;
        s.vel[0] *= 0.75;
        s.vel[2] *= 0.75;
        if (Math.hypot(s.vel[0], s.vel[2]) < 0.3 && Math.abs(s.angVel[0]) < 0.25 && Math.abs(s.angVel[2]) < 0.25) {
          s.grounded = true;
          s.angVel = [0, 0, 0];
          s.vel = [0, 0, 0];
        }
      }
    } else {
      s.grounded = false;
    }

    if (this.recordEnabled && this.history.length < 20000) {
      this.history.push({
        t: this.time,
        pos: [...s.pos], rot: [...s.rot], vel: [...s.vel],
        rotor: s.rotor, damage: { ...s.damage }, ctrl: { ...s.ctrl },
        crashed: s.crashed
      });
    }
    return s;
  }

  /* snapshot state for display */
  displayState() {
    const s = this.state;
    return {
      t: this.time * 1000,
      pos: [...s.pos],
      rot: [...s.rot],
      rotor: s.rotor,
      damage: { ...s.damage },
      vibrate: s.crashed ? 0 : (Math.abs(s.angVel[0]) + Math.abs(s.angVel[2])) * 0.25 + (this.faults.engine > 0.4 ? 0.4 : 0),
      camera: 'chase'
    };
  }

  /* export recording */
  exportRecording(sceneRef) {
    return {
      format: 'nested-os-rehearsal',
      version: 1,
      sceneRef: sceneRef || 'helicopter-24',
      createdAt: Date.now(),
      duration: this.time * 1000,
      initialState: {
        pos: [0, 0.4, 0], rot: [0, 0, 0], vel: [0, 0, 0]
      },
      wind: [...this.wind],
      faults: { ...this.faults },
      inputLog: this.inputLog.map(x => ({ ...x })),
      samples: this.history.filter((_, i) => i % 3 === 0).map(h => ({
        t: h.t * 1000,
        pos: h.pos.map(v => +v.toFixed(3)),
        rot: h.rot.map(v => +v.toFixed(3)),
        rotor: Math.round(h.rotor),
        damage: h.damage,
        crashed: h.crashed
      }))
    };
  }

  /* replay a recording: returns state at time t (ms) */
  static sampleRecording(rec, tMs) {
    const samples = rec.samples || [];
    if (!samples.length) return null;
    if (tMs <= samples[0].t) return { ...samples[0], camera: 'chase' };
    if (tMs >= samples[samples.length - 1].t) return { ...samples[samples.length - 1], camera: 'aftermath' };
    let i = 0;
    while (i < samples.length - 1 && samples[i + 1].t < tMs) i++;
    const a = samples[i], b = samples[i + 1];
    const u = (tMs - a.t) / (b.t - a.t);
    return {
      t: tMs,
      pos: [
        a.pos[0] + (b.pos[0] - a.pos[0]) * u,
        a.pos[1] + (b.pos[1] - a.pos[1]) * u,
        a.pos[2] + (b.pos[2] - a.pos[2]) * u
      ],
      rot: [
        a.rot[0] + (b.rot[0] - a.rot[0]) * u,
        a.rot[1] + (b.rot[1] - a.rot[1]) * u,
        a.rot[2] + (b.rot[2] - a.rot[2]) * u
      ],
      rotor: a.rotor + (b.rotor - a.rotor) * u,
      damage: b.damage || a.damage,
      crashed: b.crashed || a.crashed,
      camera: b.crashed ? 'aftermath' : 'chase'
    };
  }
}

function bodyUp(rot) {
  // rotate (0,1,0) by Euler XYZ
  const [rx, ry, rz] = rot;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  // Ry * Rx * Rz applied to up
  const y = cx * cz;
  const x = sx * sz * cy - cz * sy * 0 - sy * sx * 0; // simplified
  // full rotation matrix column for Y
  const m01 = cy * sx * sz - cz * sy;
  const m11 = cx * cz;
  const m21 = cy * cz * sx + sx * 0;
  // simpler approach: up = R * (0,1,0)
  const ux = Math.sin(rz) * Math.sin(rx) * Math.cos(ry) + Math.sin(ry) * Math.cos(rx) * 0 - Math.cos(rz) * Math.sin(ry) * 0;
  // Let me just do it cleanly:
  const u = [
    Math.sin(rx) * Math.sin(ry) * Math.cos(rz) + Math.cos(ry) * Math.sin(rz),
    Math.cos(rx) * Math.cos(rz),
    Math.sin(rx) * Math.cos(ry) * Math.cos(rz) - Math.sin(ry) * Math.sin(rz)
  ];
  // normalize
  const len = Math.hypot(u[0], u[1], u[2]) || 1;
  return [u[0] / len, u[1] / len, u[2] / len];
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
