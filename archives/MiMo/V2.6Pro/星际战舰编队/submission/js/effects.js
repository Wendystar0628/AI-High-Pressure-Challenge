// Effects: beams, pulses, tracers, missiles, flames, shields, sparks (all f(t))
(function (global) {
  'use strict';
  const { V3, U, M4, PAL } = global;
  const { lerp, clamp, smoothstep, smootherstep, wrapDelta, mulberry32 } = U;
  const DUR = global.WORLD.DUR;

  // ---------- dynamic geometry builder ----------
  function Builder(maxVerts) {
    this.max = maxVerts;
    this.data = new Float32Array(maxVerts * 11);
    this.count = 0; // verts
  }
  Builder.prototype.reset = function () { this.count = 0; };
  Builder.prototype.vert = function (p, n, c, e, kind) {
    if (this.count >= this.max) return;
    const o = this.count * 11;
    const d = this.data;
    d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2];
    d[o + 3] = n[0]; d[o + 4] = n[1]; d[o + 5] = n[2];
    d[o + 6] = c[0]; d[o + 7] = c[1]; d[o + 8] = c[2];
    d[o + 9] = e; d[o + 10] = kind || 0;
    this.count++;
  };
  Builder.prototype.tri = function (a, b, c, n, col, e, kind) {
    this.vert(a, n, col, e, kind);
    this.vert(b, n, col, e, kind);
    this.vert(c, n, col, e, kind);
  };
  Builder.prototype.quad = function (a, b, c, d, n, col, e, kind) {
    this.tri(a, b, c, n, col, e, kind);
    this.tri(a, c, d, n, col, e, kind);
  };
  // camera-facing billboard
  Builder.prototype.billboard = function (center, right, up, w, h, col, e, kind) {
    const n = V3.norm(V3.cross(right, up));
    const a = [center[0] - right[0] * w - up[0] * h, center[1] - right[1] * w - up[1] * h, center[2] - right[2] * w - up[2] * h];
    const b = [center[0] + right[0] * w - up[0] * h, center[1] + right[1] * w - up[1] * h, center[2] + right[2] * w - up[2] * h];
    const c = [center[0] + right[0] * w + up[0] * h, center[1] + right[1] * w + up[1] * h, center[2] + right[2] * w + up[2] * h];
    const d = [center[0] - right[0] * w + up[0] * h, center[1] - right[1] * w + up[1] * h, center[2] - right[2] * w + up[2] * h];
    this.quad(a, b, c, d, n, col, e, kind);
  };
  // glow prism (n-gon) from a to b
  Builder.prototype.prism = function (a, b, radius, sides, col, e, kind) {
    const dir = V3.norm(V3.sub(b, a));
    let up = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const r = V3.norm(V3.cross(up, dir));
    const u = V3.cross(dir, r);
    const pts0 = [], pts1 = [];
    for (let i = 0; i < sides; i++) {
      const th = i / sides * Math.PI * 2;
      const off = V3.add(V3.scale(r, Math.cos(th) * radius), V3.scale(u, Math.sin(th) * radius));
      pts0.push(V3.add(a, off));
      pts1.push(V3.add(b, off));
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const n = V3.norm(V3.cross(
        V3.sub(pts0[j], pts0[i]),
        V3.sub(pts1[i], pts0[i])
      ));
      this.quad(pts0[i], pts0[j], pts1[j], pts1[i], n, col, e, kind);
    }
  };

  // ---------- engine flames ----------
  function engineFlames(B, ship, t) {
    const thrust = global.WORLD.thrustAt(t);
    const nozzles = ship.nozzles || [];
    const flick = 0.92 + 0.08 * Math.sin(t * 21.3 + ship.seed * 3.1);
    for (let i = 0; i < nozzles.length; i++) {
      const n = nozzles[i];
      const len = n.len * (0.55 + 0.85 * thrust) * flick;
      const dir = n.dir;
      const end = V3.add(n.pos, V3.scale(dir, len));
      const end2 = V3.add(n.pos, V3.scale(dir, len * 1.6));
      // bright thin core
      B.prism(n.pos, end, n.r * 0.32, 6, [1.25, 0.72, 0.38], 0.85 * thrust, 2);
      // mid flame — narrower
      B.prism(V3.add(n.pos, V3.scale(dir, len * 0.08)), end2, n.r * 0.58, 6, [0.95, 0.40, 0.15], 0.32 * thrust, 2);
      // outer soft haze — thin
      const end3 = V3.add(n.pos, V3.scale(dir, len * 1.9));
      B.prism(V3.add(n.pos, V3.scale(dir, len * 0.15)), end3, n.r * 0.9, 6, [0.45, 0.18, 0.09], 0.12 * thrust, 2);
      // tip wisp
      const wob = Math.sin(t * 9.1 + i * 2.2) * n.r * 0.4;
      const tip = V3.add(end2, V3.scale(V3.norm([0.2, wob, 0.3]), n.r * 0.6));
      B.prism(end, tip, n.r * 0.28, 5, [0.95, 0.48, 0.22], 0.22 * thrust, 2);
    }
  }

  // ---------- flagship main beam ----------
  function mainBeam(B, t, muzzle, targetPos, out) {
    // schedule: charge 56.0-56.6, fire 56.6-62.4, release 62.4-63.2
    let power = 0;
    if (t >= 55.8 && t < 56.6) power = smootherstep(55.8, 56.6, t) * 0.45;
    else if (t >= 56.6 && t < 62.4) {
      power = 0.85 + 0.15 * Math.sin(t * 14.2);
      if (t > 61.8) power *= 1 - smoothstep(61.8, 62.4, t) * 0.25;
    } else if (t >= 62.4 && t < 63.4) {
      power = (1 - smootherstep(62.4, 63.4, t)) * 0.7;
    }
    if (power <= 0.01) return 0;

    const dir = V3.norm(V3.sub(targetPos, muzzle));
    const dist = V3.dist(muzzle, targetPos);

    // pre-charge: glow at muzzle
    if (t >= 55.8 && t < 56.8) {
      const c = (t < 56.6 ? (t - 55.8) / 0.8 : 1 - (t - 56.6) / 0.2);
      const r = 26 + 40 * c;
      B.prism(muzzle, V3.add(muzzle, V3.scale(dir, 30)), r, 8, [1.6, 1.1, 0.7], 1.6 * clamp(c, 0, 1), 0);
    }

    // beam body: core + glow + outer haze
    const end = V3.add(muzzle, V3.scale(dir, dist * 1.02));
    const pulse = 1 + 0.1 * Math.sin(t * 18.0);
    const w0 = 16 * pulse * power;
    B.prism(muzzle, end, w0 * 0.32, 8, [2.2, 2.0, 1.7], 2.4 * power, 0);
    B.prism(muzzle, end, w0 * 0.85, 8, [1.5, 1.15, 0.85], 1.15 * power, 0);
    B.prism(muzzle, end, w0 * 1.7, 8, [1.15, 0.65, 0.38], 0.42 * power, 0);
    B.prism(muzzle, end, w0 * 2.6, 6, [0.7, 0.35, 0.22], 0.16 * power, 0);

    // flowing striations (thin offset rails)
    for (let i = 0; i < 4; i++) {
      const ph = t * 3.2 + i * 1.7;
      const off = V3.norm([Math.cos(ph), Math.sin(ph * 0.8), Math.sin(ph)]);
      const a = V3.add(muzzle, V3.scale(off, w0 * 1.1));
      const b = V3.add(end, V3.scale(off, w0 * 0.7));
      B.prism(a, b, w0 * 0.18, 4, [1.9, 1.5, 1.1], 0.9 * power, 0);
    }

    // launch rings at muzzle
    if (t < 57.4) {
      const rr = 30 + (t - 56.6) * 220;
      const ra = clamp(1 - (t - 56.6) / 0.8, 0, 1);
      ringAt(B, muzzle, dir, rr, 4, [1.5, 1.0, 0.6], 0.9 * ra);
    }

    // impact
    const imp = V3.add(targetPos, V3.scale(dir, -6));
    B.prism(imp, end, 30 * power, 8, [2.0, 1.5, 1.1], 1.8 * power, 0);
    B.prism(V3.add(imp, V3.scale(dir, -20)), end, 55 * power, 6, [1.5, 0.85, 0.5], 0.5 * power, 0);
    // impact flash billboard handled via billboards list
    out.flash = { pos: end, power };
    return power;
  }

  function ringAt(B, center, axis, radius, sides, col, e) {
    let up = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const r = V3.norm(V3.cross(up, axis));
    const u = V3.cross(axis, r);
    for (let i = 0; i < sides * 2; i++) {
      const a0 = i / (sides * 2) * Math.PI * 2;
      const a1 = (i + 1) / (sides * 2) * Math.PI * 2;
      const p0 = V3.add(center, V3.add(V3.scale(r, Math.cos(a0) * radius), V3.scale(u, Math.sin(a0) * radius)));
      const p1 = V3.add(center, V3.add(V3.scale(r, Math.cos(a1) * radius), V3.scale(u, Math.sin(a1) * radius)));
      const q0 = V3.add(center, V3.add(V3.scale(r, Math.cos(a0) * radius * 0.92), V3.scale(u, Math.sin(a0) * radius * 0.92)));
      const q1 = V3.add(center, V3.add(V3.scale(r, Math.cos(a1) * radius * 0.92), V3.scale(u, Math.sin(a1) * radius * 0.92)));
      B.quad(q0, q1, p1, p0, axis, col, e, 0);
    }
  }

  // ---------- pulse turret volleys ----------
  // Each pulse: spawn time, from, to
  const PULSES = [];
  (function initPulses() {
    // 6 turrets × 5 shots, staggered half-beat (world coords, flagship at origin)
    const turrets = [
      { t0: 61.6, from: [230, 145, -48], to: [2080, 130, -480] },
      { t0: 61.9, from: [230, 145, 48], to: [2120, 110, -460] },
      { t0: 62.2, from: [90, 156, -62], to: [2060, 140, -520] },
      { t0: 62.5, from: [90, 156, 62], to: [2140, 100, -500] },
      { t0: 62.8, from: [-70, 152, -80], to: [2320, -60, 240] },
      { t0: 63.1, from: [-70, 152, 80], to: [2360, -90, 220] }
    ];
    for (let i = 0; i < turrets.length; i++) {
      const tr = turrets[i];
      for (let s = 0; s < 5; s++) {
        PULSES.push({
          t0: tr.t0 + s * 0.32,
          from: tr.from.slice(),
          to: tr.to.slice(),
          speed: 1400 + (i % 3) * 120
        });
      }
    }
  })();

  function pulseShots(B, t, flashOut) {
    for (let i = 0; i < PULSES.length; i++) {
      const p = PULSES[i];
      const dist = V3.dist(p.from, p.to);
      const flight = dist / p.speed;
      const dt = t - p.t0;
      if (dt < 0 || dt > flight + 0.5) continue;
      const u = clamp(dt / flight, 0, 1);
      const pos = V3.lerp(p.from, p.to, u);
      const dir = V3.norm(V3.sub(p.to, p.from));
      // head
      const tail = V3.sub(pos, V3.scale(dir, 42 + 22 * (1 - u)));
      B.prism(tail, pos, 6.5, 6, [1.7, 1.15, 0.75], 1.15, 2);
      B.prism(V3.sub(pos, V3.scale(dir, 22)), pos, 3.2, 5, [2.0, 1.7, 1.25], 1.6, 2);
      // arrival flash
      if (dt >= flight && dt < flight + 0.45) {
        const a = 1 - (dt - flight) / 0.45;
        const r = 18 + (dt - flight) * 90;
        B.prism(V3.sub(pos, V3.scale(dir, 8)), V3.add(pos, V3.scale(dir, 8)), r, 6, [1.9, 1.3, 0.85], 1.5 * a, 2);
        flashOut.push({ pos: pos.slice(), power: a, size: r });
      }
    }
  }

  // ---------- CIWS streams ----------
  function ciwsStreams(B, t, shipPos, shipRotY) {
    // tight short tracer bursts from escort mounts
    const active = t >= 63.2 && t <= 68.6;
    if (!active) return;
    const burst = (Math.sin(t * 42) > -0.2) ? 1 : 0.25;
    const fade = smoothstep(63.2, 63.7, t) * (1 - smoothstep(67.8, 68.6, t));
    // streams from several escorts toward nearby fragments
    const mounts = [
      { from: [195, 48, -305], to: [2260, 60, -560] },
      { from: [120, -2, -345], to: [2300, -120, 180] },
      { from: [195, 48, 335], to: [2200, 160, -300] },
      { from: [120, -2, 375], to: [2380, -40, 300] },
      { from: [-95, 78, -315], to: [2120, 200, -620] },
      { from: [-95, 78, 345], to: [2420, 100, 420] }
    ];
    for (let i = 0; i < mounts.length; i++) {
      const m = mounts[i];
      const dir = V3.norm(V3.sub(m.to, m.from));
      // 7 tracer segments with gaps moving along path
      for (let k = 0; k < 7; k++) {
        const ph = (t * 2.6 + k * 0.14 + i * 0.07) % 1;
        const d0 = 80 + ph * (V3.dist(m.from, m.to) - 160);
        const a = V3.add(m.from, V3.scale(dir, d0));
        const b = V3.add(a, V3.scale(dir, 34));
        B.prism(a, b, 2.6, 4, [2.0, 1.7, 1.2], 1.6 * burst * fade, 0);
      }
      // muzzle flash
      const flashA = burst * fade;
      if (flashA > 0.05) {
        B.prism(m.from, V3.add(m.from, V3.scale(dir, 22)), 9, 5, [2.2, 1.8, 1.1], 2.0 * flashA, 0);
        B.prism(m.from, V3.add(m.from, V3.scale(dir, 40)), 16, 5, [1.5, 1.0, 0.6], 0.6 * flashA, 0);
      }
    }
  }

  // ---------- missiles ----------
  const MISSILES = [];
  (function initMissiles() {
    const racks = [
      { pos: [820, -20, -420], dir: -1 },
      { pos: [860, 20, 460], dir: 1 },
      { pos: [1150, -30, -300], dir: -1 },
      { pos: [1200, -60, 320], dir: 1 }
    ];
    const targets = [
      [2350, -80, 260],
      [2550, 180, -180],
      [2100, 120, -520]
    ];
    for (let r = 0; r < racks.length; r++) {
      for (let k = 0; k < 4; k++) {
        const tgt = targets[(r + k) % 3];
        const off = [(k - 1.5) * 28, (k % 2) * 18 - 9, racks[r].dir * (30 + k * 16)];
        const from = V3.add(racks[r].pos, off);
        MISSILES.push({
          t0: 65.2 + r * 0.28 + k * 0.34,
          from,
          ctrl: V3.add(V3.lerp(from, tgt, 0.45), [0, 120 + k * 30, racks[r].dir * (160 + k * 40)]),
          to: V3.add(tgt, [(k - 1.5) * 20, (k % 2) * 24 - 12, (k % 3 - 1) * 22]),
          flight: 3.2 + (k % 2) * 0.5
        });
      }
    }
  })();

  function bezier2(a, b, c, u) {
    const iu = 1 - u;
    return [
      iu * iu * a[0] + 2 * iu * u * b[0] + u * u * c[0],
      iu * iu * a[1] + 2 * iu * u * b[1] + u * u * c[1],
      iu * iu * a[2] + 2 * iu * u * b[2] + u * u * c[2]
    ];
  }

  function missiles(B, t, flashOut) {
    for (let i = 0; i < MISSILES.length; i++) {
      const m = MISSILES[i];
      const dt = t - m.t0;
      if (dt < -0.2 || dt > m.flight + 1.2) continue;
      const u = clamp(dt / m.flight, 0, 1);
      const accel = u * u * (3 - 2 * u); // accelerate
      const pos = bezier2(m.from, m.ctrl, m.to, accel);
      const pos2 = bezier2(m.from, m.ctrl, m.to, clamp(accel - 0.02, 0, 1));
      const dir = V3.norm(V3.sub(pos, pos2));
      if (dt < 0) continue;
      // missile body (voxel-ish box)
      const r = V3.norm(V3.cross([0, 1, 0], dir));
      const up = V3.cross(dir, r);
      const L = 16, W = 4;
      const a = V3.add(pos, V3.scale(dir, -L / 2));
      const b = V3.add(pos, V3.scale(dir, L / 2));
      B.prism(a, b, W, 4, [1.5, 1.5, 1.6], 0.2, 2);
      // engine glow + trail
      const tail = V3.add(pos, V3.scale(dir, -L / 2));
      const tl = 50 + 110 * accel;
      B.prism(tail, V3.sub(tail, V3.scale(dir, tl)), 4.5, 5, [1.4, 0.7, 0.32], 0.75, 2);
      B.prism(tail, V3.sub(tail, V3.scale(dir, tl * 1.7)), 8, 5, [0.85, 0.4, 0.2], 0.22, 2);
      // faint persistent trail
      for (let k = 1; k <= 5; k++) {
        const u2 = clamp(accel - k * 0.05, 0, 1);
        const p2 = bezier2(m.from, m.ctrl, m.to, u2);
        B.prism(p2, pos, 1.8 + k * 0.9, 4, [1.0, 0.55, 0.32], 0.16 * (1 - k / 6), 2);
      }
      // arrival explosion
      if (dt >= m.flight && dt < m.flight + 1.1) {
        const a2 = 1 - (dt - m.flight) / 1.1;
        const r2 = 18 + (dt - m.flight) * 130;
        B.prism(V3.sub(m.to, [8, 8, 8]), V3.add(m.to, [8, 8, 8]), r2, 6, [1.9, 1.1, 0.6], 1.6 * a2 * a2, 2);
        flashOut.push({ pos: m.to.slice(), power: a2, size: r2 * 1.2 });
      }
    }
  }

  // ---------- asteroid hit glows / cracks ----------
  function hitGlows(B, t) {
    // beam target (id 0) heated from 56.8 to 64
    if (t > 56.7 && t < 66) {
      const heat = smoothstep(56.7, 57.6, t) * (1 - smoothstep(61, 66, t));
      const crack = smoothstep(58.0, 60.5, t);
      const pos = [2100, 120, -520];
      // glowing crack lines on the rock
      const rng = mulberry32(1234);
      for (let i = 0; i < 10; i++) {
        const th = rng() * Math.PI * 2, ph = Math.acos(rng() * 2 - 1);
        const d0 = 90 + rng() * 40;
        const p0 = [
          pos[0] + Math.sin(ph) * Math.cos(th) * d0,
          pos[1] + Math.cos(ph) * d0 * 0.8,
          pos[2] + Math.sin(ph) * Math.sin(th) * d0
        ];
        const p1 = V3.add(p0, V3.scale(V3.norm([rng() - 0.5, rng() - 0.5, rng() - 0.5]), 40 + rng() * 50));
        B.prism(p0, p1, 3.2 + crack * 4, 4, [2.0, 1.1, 0.55], (0.7 + crack * 1.6) * heat, 0);
      }
    }
    // residual ember glows on all broken targets
    for (let id = 0; id < 3; id++) {
      const sched = global.WORLD.HIT_SCHEDULE[id];
      if (!sched) continue;
      const dt = t - sched.tBreak;
      if (dt < 0 || dt > 12) continue;
      const heat = Math.exp(-dt * 0.35);
      const pos = [[2100, 120, -520], [2350, -80, 260], [2550, 180, -180]][id];
      const r = 60 + dt * 18;
      B.prism(V3.sub(pos, [20, 20, 20]), V3.add(pos, [20, 20, 20]), r, 6, [1.6, 0.75, 0.4], 0.8 * heat, 0);
    }
  }

  // ---------- shield shell ----------
  // Built as a dedicated translucent ellipsoid per ship using Builder quads
  function shieldShell(B, center, radius, alpha, expand, tint, t, seed, camPos) {
    if (alpha <= 0.01) return;
    const R = radius * (0.72 + 0.28 * expand);
    const lat = 18, lon = 28;
    const view = V3.norm(V3.sub(camPos || [0, 0, 1], center));
    for (let i = 0; i < lat; i++) {
      const th0 = i / lat * Math.PI, th1 = (i + 1) / lat * Math.PI;
      for (let j = 0; j < lon; j++) {
        const ph0 = j / lon * Math.PI * 2, ph1 = (j + 1) / lon * Math.PI * 2;
        const p = (th, ph) => [
          center[0] + R * Math.sin(th) * Math.cos(ph) * 1.35,
          center[1] + R * Math.cos(th) * 0.85,
          center[2] + R * Math.sin(th) * Math.sin(ph) * 1.15
        ];
        const a = p(th0, ph0), b = p(th0, ph1), c = p(th1, ph1), d = p(th1, ph0);
        const mid = V3.lerp(V3.lerp(a, c, 0.5), center, 0.0);
        const n = V3.norm(V3.sub(mid, center));
        // fresnel: bright at silhouette, nearly invisible face-on
        const fres = 1 - Math.abs(V3.dot(n, view));
        const fresTerm = Math.pow(fres, 5.0);
        const wave = 0.5 + 0.5 * Math.sin(th0 * 6.5 + ph0 * 5.5 + t * 1.5 + seed);
        const band = Math.pow(wave, 14.0);
        const e = alpha * (0.0015 + 0.30 * fresTerm + 0.06 * band * fres);
        if (e < 0.003) continue;
        B.quad(a, b, c, d, n, tint, e, 0);
      }
    }
  }

  // ---------- sparks / dust points ----------
  function fillPoints(P, t, camPos) {
    P.count = 0;
    const d = P.data;
    function pt(x, y, z, r, g, b, size, kind) {
      if (P.count >= P.maxPts) return;
      const o = P.count * 8;
      d[o] = x; d[o + 1] = y; d[o + 2] = z;
      d[o + 3] = r; d[o + 4] = g; d[o + 5] = b;
      d[o + 6] = size; d[o + 7] = kind;
      P.count++;
    }
    // ambient drifting motes near fleet (parallax)
    const rng = mulberry32(4242);
    for (let i = 0; i < 180; i++) {
      const x = camPos[0] + (rng() - 0.5) * 2600;
      const y = camPos[1] + (rng() - 0.5) * 1400;
      const z = camPos[2] + (rng() - 0.5) * 2600;
      const br = 0.12 + rng() * 0.28;
      pt(x, y, z, 0.55 * br, 0.68 * br, 0.9 * br, 1.2 + rng() * 1.8, 1);
    }
    // hit sparks
    const flashes = global.__flashes || [];
    for (let i = 0; i < flashes.length; i++) {
      const f = flashes[i];
      const n = 10;
      for (let k = 0; k < n; k++) {
        const th = (k / n) * Math.PI * 2 + i;
        const sp = f.size * (0.6 + 0.4 * f.power);
        pt(
          f.pos[0] + Math.cos(th) * sp * 0.4,
          f.pos[1] + Math.sin(th * 1.3) * sp * 0.4,
          f.pos[2] + Math.sin(th) * sp * 0.4,
          1.4, 0.9, 0.5, 4 + f.power * 6, 2
        );
      }
    }
    // engine trail glints
    const thrust = global.WORLD.thrustAt(t);
    for (let i = 0; i < 60; i++) {
      const s = (i * 0.17 + t * 0.35) % 1;
      const x = -560 - s * 420 * thrust;
      const y = Math.sin(i * 2.1 + t) * 40;
      const z = Math.cos(i * 1.7 + t * 0.8) * 70;
      pt(x, y, z, 1.1, 0.55, 0.25, 2.5 + s * 2, 2);
    }
  }

  // ---------- interior dynamic glows (bridge projection, corridor blocks, reactor rings) ----------
  function interiorMotion(B, t) {
    // bridge fleet projection (t 35-42.5): moving light streaks above the hub
    if (t >= 34.5 && t <= 43) {
      const cx = 437, cy = 100, cz = 0;
      for (let i = 0; i < 8; i++) {
        const ph = (t * 0.12 + i * 0.125) % 1;
        const px = cx - 22 + ph * 44;
        const pz = Math.sin(ph * Math.PI * 2 + i * 1.3) * 16;
        const py = cy + Math.sin(ph * Math.PI * 4 + i) * 3;
        B.prism([px - 5, py, pz], [px, py, pz], 1.1, 4, [0.5, 1.15, 1.45], 0.85, 2);
      }
    }
    // corridor energy blocks (t 50-56): blocks sliding along the slot rows
    if (t >= 49.5 && t <= 56.5) {
      for (let row = 0; row < 2; row++) {
        for (let k = 0; k < 4; k++) {
          const speed = 46;
          const x0 = -430 + ((t * speed + k * 88 + row * 44) % 330);
          const z = row === 0 ? -34 : 34;
          const y = -62 + (k % 2) * 14;
          B.prism([x0, y, z - 4], [x0 + 18, y, z + 4], 4, 4, [0.55, 1.2, 1.5], 1.0, 2);
        }
      }
    }
    // reactor ring glow orbit (t 42.5-50)
    if (t >= 42 && t <= 50.5) {
      const cx = 70, cz = 0;
      const bands = [{ y: -62, R: 46 }, { y: -12, R: 50 }, { y: 40, R: 44 }, { y: 86, R: 38 }];
      for (let bi = 0; bi < bands.length; bi++) {
        const b = bands[bi];
        for (let s = 0; s < 3; s++) {
          const th = t * (0.25 + bi * 0.06) + s * 2.1 + bi * 1.7;
          const px = cx + Math.cos(th) * b.R;
          const pz = cz + Math.sin(th) * b.R;
          const th2 = th + 0.22;
          const px2 = cx + Math.cos(th2) * b.R;
          const pz2 = cz + Math.sin(th2) * b.R;
          B.prism([px, b.y + 1, pz], [px2, b.y + 1, pz2], 2.5, 4, [0.5, 1.15, 1.4], 1.3, 2);
        }
      }
    }
    // hangar guide pulse (t 26-35): moving light on the floor guide strip
    if (t >= 25.5 && t <= 35.5) {
      const px = -400 + ((t * 60) % 340);
      B.prism([px, -51, 80], [px + 26, -51, 120], 5, 4, [0.4, 1.0, 1.3], 0.9, 2);
    }
  }

  global.FX = {
    Builder,
    engineFlames, mainBeam, pulseShots, ciwsStreams, missiles, hitGlows,
    shieldShell, fillPoints, ringAt, interiorMotion
  };
})(window);
