// Battle effects: main beam, pulse batteries, CIWS, missiles, impacts, shields and speed dust.
const BATTLE = (() => {
  const BEAM = { charge0: 46.6, fire0: 48.0, fire1: 50.8 };
  const PULSE0 = 49.2;
  const CIWS0 = 52.6;
  const MISSILE0 = 55.2;
  const shieldsOn = 63.0;
  let missileMesh = null;
  let pulseShots = [];
  let pulseImpacts = [];
  let ciwsShots = [];
  let missileShots = [];
  const dust = [];
  let state = { ready: false };

  function shipOf(i) { return SCENE.state.ships[i]; }
  function shipMat(s) { return SCENE.shipMatrix(s); }
  function anchor(s, p) { return M.transformPoint(shipMat(s), p); }
  function hitPoint(a, from) {
    const d = M.norm(M.sub(from, a.pos));
    return M.add(a.pos, M.mul(d, a.radius * 0.99));
  }
  function astById(id) { return ASTEROIDS.state.byId[id]; }

  function bezier(p0, p1, p2, p3, u) {
    const v = 1 - u;
    const a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    return [
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
      a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2],
    ];
  }
  function bezierTangent(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return M.norm([
      3 * v * v * (p1[0] - p0[0]) + 6 * v * u * (p2[0] - p1[0]) + 3 * u * u * (p3[0] - p2[0]),
      3 * v * v * (p1[1] - p0[1]) + 6 * v * u * (p2[1] - p1[1]) + 3 * u * u * (p3[1] - p2[1]),
      3 * v * v * (p1[2] - p0[2]) + 6 * v * u * (p2[2] - p1[2]) + 3 * u * u * (p3[2] - p2[2]),
    ]);
  }

  function buildMissileMesh() {
    const mb = new GFX.MeshBuilder(0x3311);
    mb.box(-3, -3, -14, 3, 3, 10, PAL.hullPale);
    mb.box(-2, -2, -20, 2, 2, -14, PAL.hullLight);
    mb.box(-1, -1, -24, 1, 1, -20, PAL.copperLight);
    for (let s = -1; s <= 1; s += 2) {
      mb.box(s > 0 ? 3 : -7, -1.5, -4, s > 0 ? 7 : -3, 1.5, 8, PAL.hullCool);
      mb.box(s > 0 ? 4 : -6, -1, 4, s > 0 ? 6 : -4, 1, 10, PAL.copper);
    }
    mb.glowBox(-2.4, -2.4, 10, 2.4, 2.4, 12, PAL.glowCyan, 2.4);
    mb.glowBox(-1, 1.2, -23, 1, 2.0, -15, PAL.glowIce, 1.4);
    missileMesh = mb.finish();
  }

  function init() {
    if (state.ready) return;
    buildMissileMesh();
    const flagship = shipOf(0);
    // pulse volleys from the dorsal batteries
    let seed = 5;
    for (let v = 0; v < 10; v++) {
      const base = PULSE0 + v * 0.46;
      for (let k = 0; k < 3; k++) {
        const ti = (v * 3 + k * 5 + 1) % flagship.model.turrets.length;
        const tt = flagship.model.turrets[ti];
        const start = anchor(flagship, tt.pos);
        const a = astById('B');
        const target = hitPoint(a, start);
        const jitter = [Math.sin(seed) * 26, Math.cos(seed * 1.3) * 18, Math.sin(seed * 0.7) * 26];
        seed += 2.37;
        pulseShots.push({
          launch: base + k * 0.055, dur: 0.82 + (v % 3) * 0.05,
          start, target: M.add(target, jitter), ti,
        });
      }
    }
    for (const s of pulseShots) pulseImpacts.push(s.launch + s.dur);
    // CIWS bursts from the close escorts
    const escortIdx = [12, 11, 14, 10];
    for (let b = 0; b < 22; b++) {
      const t0 = CIWS0 + b * 0.17;
      for (let k = 0; k < 3; k++) {
        const si = escortIdx[(b + k) % escortIdx.length];
        const sh = shipOf(si);
        const ci = sh.model.ciws[(b + k) % sh.model.ciws.length];
        const start = anchor(sh, ci.pos);
        const c = astById('C');
        const target = hitPoint(c, start);
        const jitter = [Math.sin(b * 3.1 + k) * 18, Math.cos(b * 2.3 + k) * 12, Math.sin(b * 1.7) * 18];
        ciwsShots.push({
          launch: t0 + k * 0.035, dur: 0.10,
          start, target: M.add(target, jitter),
        });
      }
    }
    // missiles from the vanguard racks
    const vanguards = [20, 23, 22, 24];
    for (let i = 0; i < 8; i++) {
      const sh = shipOf(vanguards[i % vanguards.length]);
      const md = sh.model;
      const ma = md.missiles[(i * 2 + 1) % md.missiles.length];
      const start = anchor(sh, ma.pos);
      const targetAst = astById(i === 3 || i === 6 ? 'E' : 'D');
      const target = M.add(hitPoint(targetAst, start), [Math.sin(i * 2.1) * 30, 20 + Math.cos(i) * 20, Math.cos(i * 1.4) * 30]);
      const mid = M.mix(start, target, 0.5);
      const c1 = M.add(start, M.add([0, 260 + i * 40, 0], [Math.sin(i) * 260, 0, 0]));
      const c2 = M.add(mid, [Math.cos(i) * 380, 320 + i * 20, -200]);
      const launch = MISSILE0 + i * 0.42;
      missileShots.push({
        launch, dur: 2.5 + (i % 3) * 0.2, start, target, c1, c2, ast: targetAst,
        path: [start, c1, c2, target],
      });
    }
    // ambient dust
    const rng = M.mulberry32(0xD057);
    for (let i = 0; i < 320; i++) {
      dust.push({
        x: (rng() * 2 - 1) * 4200, y: (rng() * 2 - 1) * 1600, z: (rng() * 2 - 1) * 5000,
        s: 0.5 + rng() * 2.0, ph: rng() * 10,
      });
    }
    state.ready = true;
  }

  function drawBeam(r, cam, t, sprite) {
    const flagship = shipOf(0);
    const muzzle = anchor(flagship, flagship.model.mainCannon.pos);
    const a = astById('A');
    const impact = hitPoint(a, muzzle);
    const charging = t > BEAM.charge0 && t < BEAM.fire1;
    const c = M.smoothstep(BEAM.charge0, BEAM.fire0, t) * (1 - M.smoothstep(BEAM.fire0, BEAM.fire0 + 0.25, t));
    if (charging) {
      const pre = M.smoothstep(BEAM.charge0, BEAM.fire0 - 0.1, t);
      const flick = 0.9 + 0.1 * Math.sin(t * 42);
      sprite.add(muzzle, 26 + 54 * pre, [0.25 * flick, 0.72 * flick, 1.0 * flick], 0);
      sprite.add(muzzle, 10 + 26 * pre, [0.75, 0.96, 1.0], 1);
      for (let i = 0; i < 6; i++) {
        const u = i / 6;
        const p = M.mix(muzzle, M.add(muzzle, [0, 0, 120]), u);
        sprite.add(p, 14 * (1 - u) * pre, [0.2, 0.6, 1.0], 0);
      }
      // rings pulled toward the muzzle
      for (let k = 0; k < 3; k++) {
        const rr = 30 + k * 20 + Math.sin(t * 10 - k * 2) * 6;
        sprite.add(M.add(muzzle, [0, 0, 12 + k * 8]), rr * pre, [0.2, 0.6, 1.0], 2);
      }
      // barrel slots light up in sequence from the cradle to the muzzle
      const charge = M.smoothstep(46.9, 47.95, t);
      const p0 = anchor(flagship, [0, 0, -300]);
      const p1 = anchor(flagship, [0, 0, -650]);
      for (let i = 0; i < 12; i++) {
        const u = i / 11;
        if (u > charge) break;
        const p = M.mix(p0, p1, u);
        const edge = u > charge - 0.12 ? 1.6 : 1.0;
        sprite.add(p, (7 + 5 * edge) * (0.6 + 0.4 * pre), [0.25, 0.66, 1.0], 0);
        if (u > charge - 0.12) sprite.add(p, 17, [0.7, 0.94, 1.0], 1);
      }
    }
    const fire = t >= BEAM.fire0 && t <= BEAM.fire1;
    if (fire) {
      let a0 = M.smoothstep(BEAM.fire0, BEAM.fire0 + 0.12, t);
      const tail = 1 - M.smoothstep(BEAM.fire1 - 0.35, BEAM.fire1, t);
      a0 *= tail;
      const pulse = 0.82 + 0.18 * Math.sin(t * 24);
      const width = 1.0 + 0.10 * Math.sin(t * 13);
      const start = M.add(muzzle, [0, 0, -6]);
      r.beams.draw(cam, start, impact, {
        width0: 150 * width * pulse, width1: 220 * width,
        color: [0.08, 0.24, 0.62], alpha: 0.20 * a0, mode: 0, time: t,
      });
      r.beams.draw(cam, start, impact, {
        width0: 58 * width, width1: 96 * width,
        color: [0.22, 0.62, 1.0], alpha: 0.38 * a0, mode: 0, time: t,
      });
      r.beams.draw(cam, start, impact, {
        width0: 24 * width, width1: 38 * width,
        color: [0.80, 0.96, 1.0], alpha: 0.85 * a0, mode: 0, time: t,
      });
      // soft haze along the length
      for (let i = 0; i < 20; i++) {
        const u = (i + 0.5) / 20;
        const p = M.mix(start, impact, u);
        sprite.add(p, 34 + 16 * Math.sin(i * 1.7 + t * 4), [0.10, 0.30, 0.62], 0);
      }
      // stream details racing down the beam
      for (let i = 0; i < 16; i++) {
        const u = M.fract(i / 16 + t * 1.9);
        const p = M.mix(start, impact, u);
        sprite.add(p, 10 + 6 * Math.sin(i * 2.1), [0.4, 0.85, 1.0], 0);
      }
      sprite.add(muzzle, 100, [0.25, 0.7, 1.0], 0);
      sprite.add(muzzle, 42, [0.85, 0.98, 1.0], 1);
      // impact
      const age = Math.max(0, t - (BEAM.fire0 + 0.08));
      const radius = a.radius;
      const pulseHit = 0.85 + 0.15 * Math.sin(t * 18);
      sprite.add(impact, 160 * pulseHit * a0, [0.4, 0.85, 1.0], 0);
      sprite.add(impact, 74 * pulseHit * a0, [0.95, 0.99, 1.0], 1);
      sprite.add(impact, (210 + age * 34) * a0, [0.25, 0.6, 1.0], 2);
      // glowing cracks around the hit
      const n = [0.7, 0.35, -0.6];
      const basis1 = M.norm(M.cross(n, [0, 1, 0]));
      const basis2 = M.norm(M.cross(n, basis1));
      for (let i = 0; i < 22; i++) {
        const ang = i * 2.399;
        const rr = 20 + (i % 5) * 22 + age * 12;
        const p = M.add(impact, M.add(M.mul(basis1, Math.cos(ang) * rr), M.mul(basis2, Math.sin(ang) * rr)));
        const fl = 0.6 + 0.4 * Math.sin(t * 13 + i * 2.7);
        sprite.add(p, 6 + (i % 3) * 5, [i % 4 === 0 ? 1.0 : 0.45, i % 4 === 0 ? 0.72 : 0.85, i % 4 === 0 ? 0.35 : 1.0], 0);
      }
      // sparks flung out
      for (let i = 0; i < 34; i++) {
        const ang = i * 1.71;
        const sp = 30 + (i % 7) * 10;
        const p = M.add(impact, [
          Math.cos(ang) * age * sp,
          Math.sin(ang * 1.4) * age * sp * 0.7 + 8 * age,
          Math.sin(ang) * age * sp,
        ]);
        sprite.add(p, Math.max(1, 8 - age * 3), [1.0, 0.65, 0.28], 0);
      }
    }
  }

  function drawPulse(r, cam, t, sprite) {
    for (const s of pulseShots) {
      const age = t - s.launch;
      if (age < 0 || age > s.dur + 0.5) continue;
      const u = M.clamp(age / s.dur, 0, 1);
      const x = s.start[0] + (s.target[0] - s.start[0]) * u;
      const y = s.start[1] + (s.target[1] - s.start[1]) * u + Math.sin(u * Math.PI) * 24;
      const z = s.start[2] + (s.target[2] - s.start[2]) * u;
      const head = [x, y, z];
      if (u < 1) {
        for (let k = 0; k < 6; k++) {
          const uu = Math.max(0, u - k * 0.018);
          const px = s.start[0] + (s.target[0] - s.start[0]) * uu;
          const py = s.start[1] + (s.target[1] - s.start[1]) * uu + Math.sin(uu * Math.PI) * 24;
          const pz = s.start[2] + (s.target[2] - s.start[2]) * uu;
          sprite.add([px, py, pz], Math.max(3, 24 - k * 3.2), k === 0 ? [1.0, 0.95, 0.8] : [1.0, 0.62, 0.22], 0);
        }
        // short tail ribbon
        const back = Math.max(0, u - 0.06);
        const bx = s.start[0] + (s.target[0] - s.start[0]) * back;
        const by = s.start[1] + (s.target[1] - s.start[1]) * back + Math.sin(back * Math.PI) * 24;
        const bz = s.start[2] + (s.target[2] - s.start[2]) * back;
        r.beams.draw(cam, [bx, by, bz], head, {
          width0: 12, width1: 30, color: [1.0, 0.65, 0.28], alpha: 0.62, mode: 0, time: t,
        });
      }
      // muzzle flash
      if (age < 0.14) {
        sprite.add(s.start, 55, [1.0, 0.75, 0.35], 0);
        sprite.add(s.start, 90, [0.5, 0.8, 1.0], 2);
      }
      // impact
      if (u >= 1) {
        const ia = age - s.dur;
        const fade = Math.max(0, 1 - ia / 0.45);
        sprite.add(s.target, 64 * fade, [1.0, 0.75, 0.4], 0);
        sprite.add(s.target, 34 * fade, [1.0, 0.95, 0.8], 1);
        for (let k = 0; k < 7; k++) {
          const ang = k * 0.9 + s.ti;
          sprite.add([s.target[0] + Math.cos(ang) * ia * 90, s.target[1] + Math.sin(ang * 1.3) * ia * 60,
            s.target[2] + Math.sin(ang) * ia * 90], 3 * fade, [1.0, 0.6, 0.25], 0);
        }
      }
    }
  }

  function drawCIWS(r, cam, t, sprite) {
    for (const s of ciwsShots) {
      const age = t - s.launch;
      if (age < 0 || age > s.dur + 0.25) continue;
      const alive = age <= s.dur ? 1 : Math.max(0, 1 - (age - s.dur) / 0.25);
      for (let j = -1; j <= 1; j++) {
        const off = [j * 3.5, j * 2.2, j * 1.4];
        r.beams.draw(cam, M.add(s.start, off), M.add(s.target, off), {
          width0: 2.2, width1: 8.0, color: [1.0, 0.88, 0.55], alpha: 0.72 * alive, mode: 0, time: t,
        });
      }
      // tracer beads racing down the burst
      for (let k = 0; k < 4; k++) {
        const u = M.fract(age * 18 + k * 0.25);
        const p = M.mix(s.start, s.target, u);
        sprite.add(p, 3.2, [1.0, 0.85, 0.45], 0);
      }
      if (age < 0.06) {
        sprite.add(s.start, 28, [1.0, 0.8, 0.4], 0);
        sprite.add(s.start, 40, [1.0, 0.55, 0.2], 2);
      }
      if (age >= s.dur) {
        sprite.add(s.target, 22 * alive, [1.0, 0.8, 0.45], 0);
        for (let k = 0; k < 6; k++) {
          const ang = k * 1.7 + s.launch;
          const p = [s.target[0] + Math.cos(ang) * (age - s.dur) * 110,
            s.target[1] + Math.sin(ang * 1.3) * (age - s.dur) * 80,
            s.target[2] + Math.sin(ang) * (age - s.dur) * 110];
          sprite.add(p, 3.0 * alive, [1.0, 0.7, 0.35], 0);
        }
      }
    }
  }

  function drawMissiles(r, cam, t, sprite) {
    for (const m of missileShots) {
      const age = t - m.launch;
      if (age < 0 || age > m.dur + 1.4) continue;
      const u = M.clamp(age / m.dur, 0, 1);
      if (u < 1) {
        const p = bezier(m.path[0], m.path[1], m.path[2], m.path[3], u);
        const d = bezierTangent(m.path[0], m.path[1], m.path[2], m.path[3], u);
        const yaw = Math.atan2(-d[0], -d[2]);
        const pitch = Math.asin(M.clamp(d[1], -1, 1));
        const mat = M.mat4Compose(p, yaw, pitch, 0, 2.2);
        r.drawMesh(missileMesh, mat);
        sprite.add(p, 12, [0.5, 0.85, 1.0], 0);
        sprite.add(p, 5, [0.95, 1.0, 1.0], 1);
        // long trail
        for (let k = 1; k <= 18; k++) {
          const uu = Math.max(0, u - k * 0.013);
          const pp = bezier(m.path[0], m.path[1], m.path[2], m.path[3], uu);
          const fade = 1 - k / 20;
          sprite.add(pp, 5 + (1 - k / 18) * 11, [1.0 * fade, 0.58 * fade, 0.22 * fade], 0);
          if (k % 4 === 0) sprite.add(pp, 17 * fade, [0.8 * fade, 0.30 * fade, 0.08 * fade], 0);
        }
        // launch flash at the rack, then the tail ignites
        if (age < 0.20) {
          const lf = 1 - age / 0.20;
          sprite.add(m.start, 42 * lf, [1.0, 0.72, 0.32], 0);
          sprite.add(m.start, 22 * lf, [1.0, 0.95, 0.8], 1);
          sprite.add(m.start, 26 * lf, [1.0, 0.5, 0.2], 2);
        }
        // engine glow
        const tail = bezier(m.path[0], m.path[1], m.path[2], m.path[3], Math.max(0, u - 0.02));
        sprite.add(tail, 16, [1.0, 0.75, 0.35], 0);
        sprite.add(tail, 7, [1.0, 0.98, 0.85], 1);
        const tail2 = bezier(m.path[0], m.path[1], m.path[2], m.path[3], Math.max(0, u - 0.09));
        r.beams.draw(cam, tail2, p, { width0: 3, width1: 10, color: [1.0, 0.55, 0.2], alpha: 0.30, mode: 1, time: t });
      } else {
        const ia = age - m.dur;
        if (ia < 1.4) {
          const pos = m.path[3];
          const fade = Math.max(0, 1 - ia / 1.4);
          sprite.add(pos, 70 * (0.5 + ia * 0.6) * fade, [1.0, 0.75, 0.4], 0);
          sprite.add(pos, 34 * (0.6 + ia * 0.9) * fade, [1.0, 0.55, 0.2], 0);
          sprite.add(pos, 30 * (0.5 + ia * 1.7) * fade, [0.9, 0.35, 0.12], 2);
          for (let k = 0; k < 16; k++) {
            const ang = k * 2.399 + m.launch;
            const sp = 60 + (k % 5) * 30;
            const p = [pos[0] + Math.cos(ang) * ia * sp, pos[1] + Math.sin(ang * 1.7) * ia * sp * 0.6,
              pos[2] + Math.sin(ang) * ia * sp];
            sprite.add(p, Math.max(1, 7 - ia * 3), [1.0, 0.6, 0.25], 0);
          }
        }
      }
    }
  }

  function drawAsteroidBursts(sprite, t, cam) {
    const bursts = [
      { id: 'A', t: 50.8, size: 260, color: 0 },
      { id: 'B', t: 53.85, size: 130, color: 1 },
      { id: 'C', t: 56.25, size: 60, color: 1 },
      { id: 'E', t: 58.65, size: 150, color: 0 },
      { id: 'D', t: 60.65, size: 220, color: 0 },
    ];
    for (const b of bursts) {
      const ast = astById(b.id);
      const age = t - b.t;
      if (age < -0.15 || age > 2.2) continue;
      const aa = Math.max(0, age);
      const toCam = M.norm(M.sub(cam.pos, ast.pos));
      const pos = M.add(ast.pos, M.mul(toCam, ast.radius * 1.02));
      const fade = Math.max(0, 1 - aa / 2.2);
      sprite.add(pos, b.size * (0.5 + aa * 1.4) * fade, b.color ? [1.0, 0.75, 0.38] : [0.5, 0.9, 1.0], 0);
      sprite.add(pos, b.size * 0.45 * (0.7 + aa * 0.8) * fade, [1.0, 0.97, 0.9], 1);
      sprite.add(pos, b.size * (0.35 + aa * 0.75) * Math.max(0, 1 - aa / 1.35), b.color ? [0.55, 0.28, 0.12] : [0.16, 0.42, 0.7], 2);
      for (let i = 0; i < 28; i++) {
        const ang = i * 2.399 + b.size;
        const sp = 80 + (i % 6) * 40;
        const p = [pos[0] + Math.cos(ang) * aa * sp, pos[1] + Math.sin(ang * 1.3) * aa * sp * 0.7,
          pos[2] + Math.sin(ang) * aa * sp];
        sprite.add(p, Math.max(1.5, 9 - aa * 3.6), [1.0, 0.68, 0.3], 0);
      }
    }
  }

  function shieldPhase(t) { return t < shieldsOn ? t + 80 : t; }
  function shieldAlpha(t, i) {
    const phase = shieldPhase(t);
    const act = shieldsOn + (i % 8) * 0.32;
    if (phase < act) return { alpha: 0, deploy: 0, age: 0 };
    const age = phase - act;
    let a = M.smoothstep(0, 0.75, age);
    a *= 1 - M.smoothstep(78, 82, phase);
    return { alpha: a, deploy: M.clamp(age / 1.1, 0, 1), age };
  }

  function shieldModel(s, alpha) {
    const r = s.model.shield;
    const base = shipMat(s);
    const c = M.transformPoint(base, r.c);
    const deploy = 0.72 + 0.28 * alpha;
    const radii = [r.r[0] * 1.02 * deploy, r.r[1] * 1.02 * deploy, r.r[2] * 1.02 * deploy];
    const m = M.mat4Identity();
    m[0] = radii[0]; m[5] = radii[1]; m[10] = radii[2];
    m[12] = c[0]; m[13] = c[1]; m[14] = c[2];
    return { m, center: c, radii };
  }

  function drawShields(r, cam, t, sprite) {
    if (t < 62.3 && t > 7.5) return;
    for (let i = 0; i < SCENE.state.ships.length; i++) {
      const s = SCENE.state.ships[i];
      const { alpha, deploy, age } = shieldAlpha(t, i);
      if (alpha <= 0.005) continue;
      const { center } = shieldModel(s, alpha);
      const sz = Math.min((s.model.shield.r[0] + s.model.shield.r[2]) * 0.52, 520);
      const flick = 0.92 + 0.08 * Math.sin(t * 2.2 + i * 1.3);
      const dsc = 0.78 + 0.22 * deploy;
      // camera-facing energy dome with a thin rim and faint flowing glass
      sprite.add(center, sz * dsc * flick, [0.10 * alpha, 0.30 * alpha, 0.55 * alpha], 5,
        t * 0.12 + i * 0.6, sz * 0.78 * dsc * flick);
      sprite.add(center, sz * dsc * 1.04, [0.05 * alpha, 0.16 * alpha, 0.30 * alpha], 2);
      sprite.add(center, sz * 0.80, [0.008 * alpha, 0.024 * alpha, 0.045 * alpha], 0);
      if (age < 1.1) {
        sprite.add(center, sz * (0.88 + age * 0.45), [0.06 * alpha, 0.18 * alpha, 0.32 * alpha], 2);
      }
    }
  }

  function drawDust(r, cam, t, sprite) {
    const accel = M.smoothstep(68, 76, t);
    const speed = 40 + accel * 900;
    for (const d of dust) {
      let z = ((d.z + t * speed) % 6000 + 6000) % 6000 - 3000;
      const p = [d.x, d.y, z];
      const near = Math.max(0, 1 - Math.abs(z - cam.pos[2]) / 2200);
      if (near <= 0) continue;
      const s = d.s * (0.6 + near * 1.5);
      sprite.add(p, s, [0.32, 0.45, 0.55], 0);
      if (accel > 0.1) {
        sprite.add([p[0], p[1], p[2] + 8 + accel * 30], s * (0.7 + accel), [0.5, 0.75, 0.9], 0);
      }
    }
  }

  function draw(r, cam, t) {
    if (!state.ready) return;
    const sprite = r.sprites;
    drawMissiles(r, cam, t, sprite);
    drawDust(r, cam, t, sprite);
    drawPulse(r, cam, t, sprite);
    drawCIWS(r, cam, t, sprite);
    drawBeam(r, cam, t, sprite);
    drawAsteroidBursts(sprite, t, cam);
    drawShields(r, cam, t, sprite);
  }

  function lights(t) {
    const out = [];
    // flagship engine wash keeps the fleet's propulsion light in the scene
    out.push({ pos: [0, 30, 660], color: [0.10, 0.24, 0.38], radius: 900 });
    const flagship = shipOf(0);
    const muzzle = anchor(flagship, flagship.model.mainCannon.pos);
    const a = astById('A');
    const impact = hitPoint(a, muzzle);
    if (t > BEAM.charge0 + 0.2 && t < BEAM.fire1 + 0.3) {
      const f = (t > BEAM.fire0 && t < BEAM.fire1) ? 1 : 0.35;
      out.push({ pos: muzzle, color: [0.35 * f, 0.8 * f, 1.0 * f], radius: 500 });
      if (t > BEAM.fire0 - 0.1) out.push({ pos: impact, color: [0.30, 0.75, 1.0], radius: 900 });
    }
    if (t > PULSE0 && t < 54.5) {
      const b = hitPoint(astById('B'), [0, 0, 0]);
      out.push({ pos: b, color: [1.0, 0.55, 0.22], radius: 500 });
    }
    for (const m of missileShots) {
      const age = t - m.launch;
      if (age > m.dur && age < m.dur + 1.0) {
        const f = Math.max(0, 1 - (age - m.dur));
        out.push({ pos: m.path[3], color: [1.0 * f, 0.55 * f, 0.22 * f], radius: 650 });
      }
    }
    if (t > 50.3 && t < 51.2) {
      // the broken main target continues to glow
      out.push({ pos: M.add(astById('A').pos, [0, 0, 100]), color: [0.25, 0.65, 1.0], radius: 800 });
    }
    const shPhase = shieldPhase(t);
    if (shPhase >= shieldsOn && shPhase < 86) {
      const f = 1 - M.smoothstep(80, 84, shPhase);
      out.push({ pos: [0, 150, 0], color: [0.2 * f, 0.5 * f, 0.8 * f], radius: 1200 });
      out.push({ pos: [1100, 300, -900], color: [0.18 * f, 0.42 * f, 0.7 * f], radius: 800 });
    }
    return out.slice(0, 8);
  }

  return { init, draw, lights, shieldAlpha, BEAM, state };
})();
