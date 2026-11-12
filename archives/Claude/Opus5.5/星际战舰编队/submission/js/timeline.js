'use strict';
// ---------------------------------------------------------------------------
// Global timeline.  Everything is a pure function of the loop time t in [0,T).
// Rendering happens in the fleet frame (flagship at the origin, heading +z);
// the world (rocks, debris, trails) slides by -s(t) along z.
// ---------------------------------------------------------------------------
const TL = {
  T: 78,
  v0: 30, v1: 165,
  spread: [37, 45, 62, 72],
  charge: [47.6, 50.1],
  beam: [50.1, 55.3], beamOff: 55.9,
  aHeat: 50.4, aCrack: [51.2, 53.2], aBreak: 53.45,
  pulse: [52.3, 57.4], bBreak: 57.25,
  ciwsS: [56.0, 59.0], c2Break: 57.9,
  ciwsP: [57.8, 61.4], c1Break: 60.0,
  missile: [58.6, 60.0], eBreak: 62.6,
  shield0: 64.0,
  boost: 66.6, accel: [66.8, 76],
};

// ---- fleet speed / distance -------------------------------------------------
TL.vel = (t) => {
  const { v0, v1 } = TL;
  if (t < 7) return v1 + (v0 - v1) * U.smoother(0, 7, t);
  if (t < TL.accel[0]) return v0;
  return v0 + (v1 - v0) * U.smoother(TL.accel[0], TL.accel[1], t);
};
TL.sRaw = function (t) { const f = t / TL._dt; const i = Math.min(TL._s.length - 2, Math.max(0, Math.floor(f))); const a = f - i; return TL._s[i] * (1 - a) + TL._s[i + 1] * a; };
(function buildS() {
  const dt = 0.005, n = Math.ceil(TL.T / dt) + 2; const s = new Float64Array(n);
  for (let i = 1; i < n; i++) { const t = (i - 0.5) * dt; s[i] = s[i - 1] + TL.vel(Math.min(t, TL.T)) * dt; }
  TL._s = s; TL._dt = dt; TL.D = TL.sRaw(TL.T);
})();
// extended distance for any time (cycles)
TL.s = function (t) { const c = Math.floor(t / TL.T); return c * TL.D + TL.sRaw(t - c * TL.T); };
// world point (expressed at reference time tr) -> fleet frame at t
TL.toFleet = (p, t) => [p[0], p[1], p[2] - TL.s(t)];

// ---- fleet layout -------------------------------------------------------------
// type: 'G' guard (近卫), 'V' vanguard (前卫)
TL.ships = (function () {
  const L = [];
  const G = (x, y, z, sx, sy) => L.push({ type: 'G', slot: [x, y, z], sp: [sx || 0, sy || 0, 0] });
  const Vg = (x, y, z, sx, sy, sz) => L.push({ type: 'V', slot: [x, y, z], sp: [sx || 0, sy || 0, sz || 0] });
  // guards: close around the flagship, sides, heights and rear
  G(-430, 30, 170, -70, 10); G(430, 30, 170, 70, 10);
  G(-440, -110, -220, -50, -20); G(440, -110, -220, 50, -20);
  G(-270, 245, -40, -40, 30); G(270, 245, -40, 40, 30);
  G(-250, -250, 280, -40, -30); G(250, -250, 280, 40, -30);
  G(-300, 150, -630); G(210, 70, -840);
  G(0, -150, -930); G(-400, -30, -1080); G(400, -30, -1080);
  G(0, 230, -800);
  // vanguards: ahead and on the outer layer, more rows trailing far behind
  Vg(0, 70, 1060, 0, 150, 0); Vg(-230, -40, 960, -230, -20); Vg(230, -40, 960, 230, -20);
  Vg(-500, 50, 1140, -200, 40); Vg(500, 50, 1140, 200, 40);
  Vg(-330, 190, 1330, -230, 60); Vg(330, 190, 1330, 230, 60);
  Vg(0, -170, 1300, 0, -160); Vg(-720, -70, 1000, -160, -30); Vg(720, -70, 1000, 160, -30);
  Vg(-850, 130, 330, -90, 20); Vg(850, 130, 330, 90, 20);
  Vg(-900, -120, -260, -60); Vg(900, -120, -260, 60);
  Vg(-760, 260, -620, -40, 30); Vg(760, 260, -620, 40, 30);
  Vg(-520, 120, -1560); Vg(520, 120, -1560); Vg(-160, -60, -1800); Vg(160, 220, -1950);
  Vg(-820, -40, -2050); Vg(820, -40, -2050); Vg(0, 60, -2350);
  L.forEach((s, i) => {
    const r = U.rng(1000 + i * 17);
    s.ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
    s.n = [2 + Math.floor(r() * 3), 2 + Math.floor(r() * 3), 3 + Math.floor(r() * 3)];
    s.amp = [5 + r() * 8, 4 + r() * 6, 6 + r() * 10];
    const dist = Math.hypot(s.slot[0], s.slot[1] * 1.5, s.slot[2] * 0.5);
    s.delay = U.clamp(dist / 1400, 0, 1.6);                 // acceleration ripple delay
    s.shieldT = TL.shield0 + 0.7 + U.clamp(dist / 1500, 0, 2.4) + r() * 0.35;
    s.idx = i;
  });
  return L;
})();

TL.spreadAmt = (t) => U.bump(t, TL.spread[0], TL.spread[1], TL.spread[2], TL.spread[3]);
const TAU = Math.PI * 2;
// returns {pos, q, thrust:{core, len}, shield state}
TL.shipState = function (s, t) {
  const T = TL.T, sp = TL.spreadAmt(t);
  const p = [
    s.slot[0] + s.amp[0] * Math.sin(TAU * s.n[0] * t / T + s.ph[0]) + s.sp[0] * sp,
    s.slot[1] + s.amp[1] * Math.sin(TAU * s.n[1] * t / T + s.ph[1]) + s.sp[1] * sp,
    s.slot[2] + s.amp[2] * Math.sin(TAU * s.n[2] * t / T + s.ph[2]) + s.sp[2] * sp,
  ];
  // ripple of the acceleration through the ranks: ships further out answer later, then close up
  const lag = 30 + 70 * s.delay;
  p[2] -= lag * U.bump(t, TL.accel[0] + 0.3, TL.accel[0] + 3 + s.delay * 2, TL.accel[0] + 4 + s.delay * 2, TL.T - 0.6);
  // heading changes: lean into the spread, gentle oscillation
  const dsp = (TL.spreadAmt(t + 0.2) - TL.spreadAmt(t - 0.2)) / 0.4;
  const yaw = 0.012 * Math.sin(TAU * 2 * t / T + s.ph[3]) - dsp * s.sp[0] * 0.0011;
  const pitch = 0.008 * Math.sin(TAU * 3 * t / T + s.ph[1]) + dsp * s.sp[1] * 0.0011;
  const roll = 0.03 * Math.sin(TAU * 2 * t / T + s.ph[2]) + dsp * s.sp[0] * 0.0018;
  return { pos: p, q: Q.euler(yaw, pitch, roll) };
};

// thrust: inner core then outer plume grow on the boost; settle at loop start
TL.thrust = function (t, delay, ph) {
  const d = delay || 0;
  const startDecay = 1 - U.smooth(0, 8, t);
  const inner = Math.max(startDecay, U.smooth(TL.boost + d * 0.6, TL.boost + 2.2 + d * 0.6, t));
  const outer = Math.max(startDecay, U.smooth(TL.boost + 1.0 + d * 0.6, TL.boost + 4.5 + d * 0.6, t));
  const breathe = 0.07 * Math.sin(TAU * 4 * t / TL.T + (ph || 0));
  return { core: 1 + breathe + 1.5 * inner, len: 1 + breathe * 1.5 + 1.9 * outer, inner, outer };
};

// shield state for activation time ts: {arcs, fill, wave, expand, w}
TL.shield = function (t, ts) {
  const fadeStart = 1 - U.smooth(0, 10, t);
  if (t < ts) {
    if (fadeStart <= 0.001) return null;
    return { arcs: 0.3 * fadeStart, fill: 1, wave: -9, expand: 1, w: fadeStart * fadeStart * 0.45 };
  }
  const tau = t - ts;
  return {
    arcs: U.smooth(0, 0.45, tau) * (1 - 0.7 * U.smooth(1.2, 2.6, tau)),
    fill: U.smooth(0.45, 1.3, tau),
    wave: tau < 2.4 ? 1.15 - (tau - 0.5) * 1.25 : -9,
    expand: 0.78 + 0.22 * U.smoother(0.25, 1.25, tau),
    w: 0.45 + 0.8 * U.bump(tau, 0.3, 0.8, 1.2, 2.8),
  };
};
TL.flagShieldT = TL.shield0;

// ---- small craft paths (fleet frame, flagship local == fleet frame) ----------
// hangar used on camera = port side (x < 0)
TL.craftDefs = function (hangar) {
  const T = TL.T;
  const berth = (i) => { const b = hangar.berths[i]; return [-b[0], b[1] + 4, b[2]]; };
  const mouth = [-150, -12, 80], out = [-205, -6, 80];
  const defs = [];
  // hover above a berth, then slide sideways to the centre lane (alcoves are framed)
  const up = (b) => [b[0], -24, b[2]], lane = (b, y) => [-113, y === undefined ? -22 : y, b[2]];
  // K1: departs from a berth early, patrols ahead, returns along the flank into the hangar (camera follows)
  const b1 = berth(6);
  defs.push({ keys: [
    { t: 0, v: b1, ease: 1 }, { t: 1.4, v: up(b1), ease: 1 }, { t: 2.8, v: lane(b1), ease: 1 }, { t: 4.6, v: [-113, -14, 10] }, { t: 6.0, v: mouth }, { t: 7.0, v: out },
    { t: 10, v: [-260, 20, 420] }, { t: 13.5, v: [-330, 60, 900] }, { t: 17.5, v: [-230, 50, 1000] },
    { t: 20.4, v: [-226, 36, 760] }, { t: 21.7, v: [-224, 26, 600] }, { t: 23.5, v: [-208, 2, 330] }, { t: 25.6, v: [-200, -6, 110] }, { t: 26.6, v: out },
    { t: 27.8, v: mouth }, { t: 29.6, v: [-113, -16, -20] }, { t: 31.4, v: lane(b1), ease: 1 }, { t: 32.8, v: up(b1), ease: 1 }, { t: 34.2, v: b1, ease: 1 }, { t: T, v: b1, ease: 1 },
  ] });
  // K2: parked deep, departs during the hangar shot, flies escort, comes home before the loop ends
  const b2 = berth(1);
  defs.push({ keys: [
    { t: 0, v: b2, ease: 1 }, { t: 25.9, v: b2, ease: 1 }, { t: 26.6, v: up(b2), ease: 1 }, { t: 27.5, v: lane(b2), ease: 1 }, { t: 28.7, v: [-110, -10, -150] }, { t: 30.15, v: [-104, -6, -56] }, { t: 31.0, v: [-112, -10, 10] },
    { t: 31.8, v: mouth }, { t: 33.0, v: out }, { t: 36, v: [-300, -60, 300] }, { t: 42, v: [-320, -120, -300] }, { t: 50, v: [-380, 40, -50] },
    { t: 58, v: [-330, 120, 450] }, { t: 64, v: [-260, 40, 200] }, { t: 69, v: [-220, 0, 120] }, { t: 71, v: out }, { t: 72.2, v: mouth },
    { t: 74.2, v: [-113, -14, -100] }, { t: 75.6, v: lane(b2), ease: 1 }, { t: 76.6, v: up(b2), ease: 1 }, { t: 77.6, v: b2, ease: 1 }, { t: T, v: b2, ease: 1 },
  ] });
  // K3: launches during the flank skim and pulls ahead with the camera
  const b3 = berth(8);
  defs.push({ keys: [
    { t: 0, v: b3, ease: 1 }, { t: 9.0, v: b3, ease: 1 }, { t: 9.7, v: up(b3), ease: 1 }, { t: 10.6, v: lane(b3), ease: 1 }, { t: 11.7, v: [-113, -12, 50] }, { t: 12.6, v: mouth }, { t: 13.6, v: [-215, 0, 150] },
    { t: 16.5, v: [-230, 40, 480] }, { t: 20, v: [-200, 80, 900] }, { t: 26, v: [-60, 160, 1100] }, { t: 34, v: [250, 120, 700] }, { t: 44, v: [320, -60, -200] },
    { t: 54, v: [-150, -170, -500] }, { t: 62, v: [-300, -40, -300] }, { t: 66, v: [-240, -10, 0] }, { t: 68.4, v: out }, { t: 69.4, v: mouth }, { t: 71.2, v: [-113, -14, -10] },
    { t: 72.6, v: lane(b3), ease: 1 }, { t: 73.6, v: up(b3), ease: 1 }, { t: 74.8, v: b3, ease: 1 }, { t: T, v: b3, ease: 1 },
  ] });
  // K4/K5: periodic escort circuits around the flagship
  for (let k = 0; k < 2; k++) {
    const keys = []; const n = 8;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU * (k ? -1 : 1) + k * 1.3;
      keys.push({ t: (i / n) * T, v: [Math.cos(a) * (300 + k * 60), 40 + Math.sin(a * 2) * 90 + k * 60, Math.sin(a) * 650] });
    }
    // periodic tangents
    const tr = new U.Track(keys); const m0 = keys[1].v.map((x, j) => (x - keys[n - 1].v[j]) / (2 * T / n));
    tr.m[0] = m0; tr.m[n] = m0;
    defs.push({ track: tr });
  }
  defs.forEach((d) => { if (!d.track) d.track = new U.Track(d.keys); });
  // parked craft (static) in other berths
  const parked = [];
  for (let i = 0; i < hangar.berths.length; i++) if (![1, 6, 8].includes(i)) parked.push(berth(i));
  return { defs, parked };
};

TL.craftState = function (def, t) {
  const p = def.track.at(t);
  const a = def.track.at(t - 0.08), b = def.track.at(t + 0.08);
  const v = V.scale(V.sub(b, a), 1 / 0.16); const sp = V.len(v);
  const a2 = def.track.at(t - 0.3), b2 = def.track.at(t + 0.3);
  const acc = V.sub(V.sub(b2, p), V.sub(p, a2));
  // heading follows velocity only when moving fast; hovering / strafing keeps the nose forward
  const k = sp < 1e-3 ? 0 : U.smooth(18, 50, sp);
  const vn = sp < 1e-3 ? [0, 0, 1] : V.scale(v, 1 / sp);
  const fl = V.lerp([0, 0, 1], vn, k);
  let f = V.len(fl) < 0.35 ? vn : V.norm(fl);
  f = V.norm([f[0], U.clamp(f[1], -0.45, 0.45), f[2]]);
  const side = V.dot(acc, V.norm(V.cross([0, 1, 0], f)));
  const roll = U.clamp(side * 0.12 * k, -0.9, 0.9);
  const q = Q.mul(Q.look(f), Q.axis([0, 0, 1], roll));
  return { pos: p, q, speed: sp };
};
