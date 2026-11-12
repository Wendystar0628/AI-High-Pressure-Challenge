'use strict';
// ---------------------------------------------------------------------------
// Camera program.  Shots return {pos, target, fov, roll, scene, near}.
// Fleet frame for exterior shots; interior pockets use their own frames.
// The end of the film (acceleration) and the opening (approach) form one
// continuous "chase" move whose z follows a camera world speed u(τ) against
// the fleet speed, so the loop seam is invisible.
// ---------------------------------------------------------------------------
const CAM = {};
const K = (t, p, tg, fov, o) => Object.assign({ t, v: [p[0], p[1], p[2], tg[0], tg[1], tg[2], fov || 50] }, o || {});

CAM.init = function () {
  const T = TL.T;
  // ---- chase segment τ in [CH0, CH1] (τ > T means next loop)
  CAM.CH0 = 68.5; CAM.CH1 = T + 8.5;
  const u = (tau) => {
    // camera world speed: holds while the fleet surges, then speeds up to close in again
    return 55 + 72 * U.smooth(T + 4.8, T + 8.5, tau);
  };
  const vf = (tau) => (tau < T ? TL.vel(tau) : TL.vel(tau - T));
  const dt = 0.01; const n = Math.ceil((CAM.CH1 - CAM.CH0) / dt) + 2; const zr = new Float64Array(n);
  for (let i = 1; i < n; i++) { const tau = CAM.CH0 + (i - 0.5) * dt; zr[i] = zr[i - 1] + (u(tau) - vf(tau)) * dt; }
  CAM._zr = zr; CAM._u = u; CAM._vf = vf;
  CAM.chaseZ0 = 200;
  // [x, y, target x, target y, target z offset]
  CAM.chaseXY = new U.Track([
    { t: 68.5, v: [-470, 175, 0, 20, -100] },
    { t: 71.5, v: [-430, 150, 0, 20, 100] },
    { t: 74.5, v: [-520, 300, 0, 0, 500] },
    { t: 78.0, v: [-640, 470, -60, -40, 700] },
    { t: 81.5, v: [-560, 330, -60, -30, 500] },
    { t: 84.5, v: [-380, 120, -80, -10, 200] },
    { t: 86.5, v: [-280, 10, -120, -20, 230] },
  ]);
  // ---- shots (exterior shots in fleet frame)
  CAM.shots = [];
  const add = (t0, t1, f, o) => CAM.shots.push(Object.assign({ t0, t1, f }, o));
  // S2 flank skim stern -> bow (continuous from chase)
  CAM.flank = new U.Track([
    K(8.5, [0, 0, 0], [0, 0, 0], 50), // replaced at init with chase end state
    K(11.5, [-250, -40, -330], [-120, -15, -150], 48),
    K(14.5, [-232, -18, -40], [-130, 10, 150], 46),
    K(17.5, [-232, 12, 200], [-110, 30, 420], 46),
    K(19.8, [-160, 165, 330], [0, 10, 560], 50),
    K(21.0, [-222, 84, 520], [-200, 30, 760], 52),
    K(22.0, [-252, 46, 618], [-214, 16, 520], 52),
    K(24.2, [-252, 26, 420], [-210, 6, 260], 50),
    K(26.0, [-240, 10, 190], [-180, -8, 60], 50),
    K(27.3, [-236, 4, 134], [-150, -12, 50], 52),
    K(28.6, [-176, 0, 92], [-112, -14, -40], 56),
    K(29.4, [-127, -9, 34], [-112, -16, -150], 58),
    K(30.2, [-104, -9, -40], [-112, -18, -250], 60),
  ]);
  // patch first key to chase end
  const ce = CAM.chase(CAM.CH1); const ce2 = CAM.chase(CAM.CH1 - 0.05);
  CAM.flank.keys[0].v = [...ce.pos, ...ce.target, ce.fov];
  CAM.flank.m[0] = CAM.flank.keys[0].v.map((x, j) => (x - [...ce2.pos, ...ce2.target, ce2.fov][j]) / 0.05);
  add(8.5, 30.2, (t) => CAM.fromTrack(CAM.flank, t), { scene: 'ext', near: 0.6 });
  // S4 power core atrium (own frame): rise along the core between platforms
  // polar track: [radius, height, angle deg, look height offset, tangential look offset, fov]
  CAM.coreTr = new U.Track([
    { t: 30.2, v: [114, 96, 41, 22, 10, 62] },
    { t: 32.6, v: [84, 104, 37, 26, 24, 60] },
    { t: 34.8, v: [79, 140, 41, 30, 36, 58] },
    { t: 36.6, v: [77, 178, 46, 18, 44, 56] },
  ]);
  add(30.2, 36.6, (t) => {
    const [r, y, ad, ly, lo, fov] = CAM.coreTr.at(t); const ang = ad * Math.PI / 180;
    const pos = [Math.cos(ang) * r, y, Math.sin(ang) * r];
    const tg = [-Math.sin(ang), 0, Math.cos(ang)];
    return { pos, target: [tg[0] * lo, y + ly, tg[2] * lo], fov, roll: 0.02 * Math.sin(t * TAU / 13) };
  }, { scene: 'core', near: 0.3 });
  // S5 bridge (fleet frame, inside the crown)
  CAM.bridge = new U.Track([
    K(36.6, [-34, 108, 102], [12, 96, 186], 58),
    K(39.5, [-31, 105, 138], [14, 98, 225], 56),
    K(42.4, [-37, 103, 186], [0, 100, 360], 52),
  ]);
  add(36.6, 42.4, (t) => CAM.fromTrack(CAM.bridge, t), { scene: 'bridge', near: 0.3 });
  // S6 energy gallery (own frame)
  CAM.gal = new U.Track([
    K(42.4, [-12, 26, 16], [4, 34, 140], 60),
    K(44.2, [10, 34, 110], [-4, 40, 260], 58),
    K(46.0, [-6, 44, 215], [2, 42, 372], 54),
    K(47.6, [0, 42, 312], [0, 42, 380], 46),
  ]);
  add(42.4, 47.6, (t) => CAM.fromTrack(CAM.gal, t), { scene: 'corridor', near: 0.3 });
  // S7a charge & beam start at the bow, S7b follow the beam
  CAM.beamTrack = new U.Track([
    K(47.6, [-36, 82, 250], [0, 2, 760], 48),
    K(50.2, [-30, 70, 360], [0, 4, 1300], 50),
    K(52.0, [-70, 62, 600], [0, 6, 1450], 50),
    K(53.6, [-110, 82, 960], [20, 20, 1420], 52),
    K(54.6, [-130, 92, 1060], [60, 40, 1400], 56),
  ]);
  add(47.6, 54.6, (t) => CAM.fromTrack(CAM.beamTrack, t), { scene: 'ext', near: 1 });
  // S7c pulse turret row on the starboard wing (beam ceasing on the left)
  CAM.turr = new U.Track([
    K(54.6, [154, 66, -350], [185, 105, 600], 50),
    K(56.6, [160, 70, -250], [200, 115, 800], 46),
  ]);
  add(54.6, 56.6, (t) => CAM.fromTrack(CAM.turr, t), { scene: 'ext', near: 1 });
  // S7d CIWS from a starboard guard on the small rock, B breaking behind
  CAM.ciws = new U.Track([
    K(56.6, [620, 125, -40], [470, -50, 1100], 46),
    K(58.8, [604, 114, 30], [430, -50, 1060], 44),
  ]);
  add(56.6, 58.8, (t) => CAM.fromTrack(CAM.ciws, t), { scene: 'ext', near: 1 });
  // S7d missiles from the port vanguards onto the large rock, port CIWS on C1
  CAM.miss = new U.Track([
    K(58.8, [-790, 150, 990], [-640, 140, 1400], 52),
    K(60.2, [-760, 170, 1080], [-600, 140, 1460], 48),
    K(62.0, [-780, 200, 1090], [-570, 140, 1450], 46),
    K(63.8, [-800, 220, 1100], [-560, 130, 1410], 48),
  ]);
  add(58.8, 63.8, (t) => CAM.fromTrack(CAM.miss, t), { scene: 'ext', near: 1 });
  // S8 shields: wide three-quarter on the flagship, slow drift, then into the chase
  CAM.shield = new U.Track([
    K(63.8, [-780, 330, 110], [-40, 0, 60], 46),
    K(66.0, [-680, 270, 150], [-20, 0, 20], 46),
    K(68.5, [-470, 175, 200], [0, 20, 500], 48),
  ]);
  const cs = CAM.chase(CAM.CH0), cs2 = CAM.chase(CAM.CH0 + 0.05);
  CAM.shield.keys[2].v = [...cs.pos, ...cs.target, cs.fov];
  CAM.shield.m[2] = CAM.shield.keys[2].v.map((x, j) => ([...cs2.pos, ...cs2.target, cs2.fov][j] - x) / 0.05);
  add(63.8, 68.5, (t) => CAM.fromTrack(CAM.shield, t), { scene: 'ext', near: 1 });
  add(68.5, T, (t) => CAM.chase(t), { scene: 'ext', near: 1 });
  add(0, 8.5, (t) => CAM.chase(t + T), { scene: 'ext', near: 1 });
};

CAM.chase = function (tau) {
  const i = (tau - CAM.CH0) / 0.01; const i0 = U.clamp(Math.floor(i), 0, CAM._zr.length - 2); const a = U.clamp(i - i0, 0, 1);
  const z = CAM.chaseZ0 + CAM._zr[i0] * (1 - a) + CAM._zr[i0 + 1] * a;
  const xy = CAM.chaseXY.at(tau);
  return { pos: [xy[0], xy[1], z], target: [xy[2], xy[3], z + 400 + xy[4]], fov: 50 + 6 * U.bump(tau, 70, 74, 79, 83), roll: 0.03 * Math.sin(tau * TAU / 39) };
};

CAM.fromTrack = function (tr, t) { const v = tr.at(t); return { pos: [v[0], v[1], v[2]], target: [v[3], v[4], v[5]], fov: v[6], roll: 0 }; };

CAM.at = function (t) {
  for (const s of CAM.shots) if (t >= s.t0 && t < s.t1) { const c = s.f(t); c.scene = s.scene; c.near = s.near; c.shot = s; return c; }
  const s = CAM.shots[CAM.shots.length - 1]; const c = s.f(t); c.scene = s.scene; c.near = s.near; return c;
};
