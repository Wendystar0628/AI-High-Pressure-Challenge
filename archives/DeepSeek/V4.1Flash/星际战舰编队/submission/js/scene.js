// Exterior scene: the battle line, engine light, shuttles, asteroids and weapon fire.
const SCENE = (() => {
  const state = {
    ready: false,
    ships: [],
    flagship: null,
    shuttles: [],
    asteroids: [],
    time: 0,
  };

  const ESCORT_POS = [
    [-560, 380, -400], [590, 350, -300], [-800, 60, 190], [820, -30, 260],
    [-360, 500, 680], [430, -470, 730], [-720, 160, 1080], [760, 280, 1140],
    [-1240, 280, -350], [1280, 180, -250], [-540, 660, -880], [560, 610, -980],
    [-950, -450, -620], [980, -410, -720], [-1640, 380, 520], [1680, 330, 640],
    [-1400, -290, 1400], [1450, -330, 1520],
  ];
  const VANGUARD_POS = [
    [-680, 160, -1360], [740, 260, -1470], [70, 500, -1620], [-1300, -210, -1920],
    [1310, 60, -2020], [0, -360, -2120], [-1900, 320, -2500], [1910, 420, -2600],
    [-720, 640, -2800], [830, -470, -2920], [-1550, -460, -3300], [1450, 620, -3420],
    [40, 200, -3620], [-2480, 120, -2240], [2450, -160, -2320], [320, 820, -2660],
  ];

  const SHUTTLE_PATH = [
    [-438, 2, 214], [-560, 40, 170], [-620, 70, -120], [-520, 66, -470],
    [-330, 84, -680], [-160, 100, -560], [-220, 72, -240], [-350, 24, 20],
  ];

  function init() {
    if (state.ready) return;
    buildModels();
    MODELS.shuttle.shield = { c: [0, 1, 0], r: [22, 14, 26] };

    const f = {
      type: 'flagship', model: MODELS.flagship, pos: [0, 0, 0], yaw: 0,
      pitch: 0, roll: 0, phase: 0.4, index: 0, isFlagship: true,
    };
    state.flagship = f;
    state.ships.push(f);

    ESCORT_POS.forEach((p, i) => {
      state.ships.push({
        type: 'escort', model: MODELS.escort, pos: p.slice(),
        base: p.slice(), yaw0: (i % 2 ? 1 : -1) * 0.05 + 0.02 * Math.sin(i * 2.1),
        pitch: 0.01 * Math.sin(i * 1.7), roll: 0.025 * Math.sin(i * 0.9),
        phase: i * 1.37, index: i + 1, isFlagship: false,
      });
    });
    VANGUARD_POS.forEach((p, i) => {
      state.ships.push({
        type: 'vanguard', model: MODELS.vanguard, pos: p.slice(),
        base: p.slice(), yaw0: (i % 2 ? -1 : 1) * 0.04 + 0.02 * Math.sin(i * 1.3),
        pitch: 0.012 * Math.sin(i * 2.3), roll: 0.03 * Math.sin(i * 1.1),
        phase: i * 2.11, index: 19 + i, isFlagship: false,
      });
    });

    for (let i = 0; i < 7; i++) {
      state.shuttles.push({
        offset: i / 7 + (i % 2) * 0.045,
        speed: 1 / 78,
        lift: (i % 3 - 1) * 26,
        side: ((i * 37) % 70) - 35,
        scale: 1,
      });
    }
    state.ready = true;
    update(0);
  }

  function update(t) {
    state.time = t;
    const deploy = M.smoothstep(43.5, 50.5, t) * (1 - M.smoothstep(59.5, 66, t));
    for (const s of state.ships) {
      if (!s.base) continue;
      const side = s.type === 'vanguard' ? 1.32 : 1.16;
      const spread = 1 + (side - 1) * deploy;
      s.pos[0] = s.base[0] * spread;
      s.pos[1] = s.base[1] * (1 + 0.10 * deploy);
      s.pos[2] = s.base[2];
      // gentle formation keeping
      s.pos[1] += Math.sin(t * 0.31 + s.phase) * 3.0;
      s.pos[0] += Math.sin(t * 0.23 + s.phase * 1.7) * 2.4;
      s.yaw = (s.yaw0 !== undefined ? s.yaw0 : s.yaw) + Math.sin(t * 0.17 + s.phase) * 0.012;
      s.pitch = 0.008 * Math.sin(t * 0.4 + s.phase);
      s.roll = 0.02 * Math.sin(t * 0.29 + s.phase * 0.7);
    }
  }

  function shipMatrix(s) {
    return M.mat4Compose(s.pos, s.yaw, s.pitch, s.roll, 1);
  }

  function drawShips(r, cam, t) {
    const throttle = 1 + M.smoothstep(68, 76, t) * 1.3;
    const sprite = r.sprites;
    const flameCalls = [];
    for (const s of state.ships) {
      const m = shipMatrix(s);
      r.drawMesh(s.model.mesh, m);
      const d = M.dist(cam.pos, s.pos);
      const mdl = s.model;
      // engines
      for (let ei = 0; ei < mdl.engines.length; ei++) {
        const e = mdl.engines[ei];
        const wp = M.transformPoint(m, e.pos);
        const wd = M.transformDir(m, e.dir);
        const flick = 0.86 + 0.14 * Math.sin(t * 11 + ei * 2.3 + s.phase);
        const toCam = M.norm(M.sub(cam.pos, wp));
        const rear = M.dot(toCam, wd);
        const rsize = Math.max(e.r * 0.30, 1.8) * (d > 8000 ? 0.7 : 1);
        sprite.add(wp, rsize, [0.20 * flick, 0.58 * flick, 0.85 * flick], 0);
        sprite.add(wp, Math.max(e.r * 0.12, 1.2), [0.78, 0.95, 1.0], 1);
        if (rear > 0.10) {
          sprite.add(wp, rsize * 2.0, [0.07 * flick, 0.22 * flick, 0.40 * flick], 0);
          sprite.add(M.add(wp, M.mul(wd, e.r * 2.2 + 8)), rsize * 1.5, [0.05, 0.16, 0.30], 0);
          sprite.add(M.add(wp, M.mul(wd, e.r * 4.6 + 12)), rsize * 1.0, [0.03, 0.10, 0.20], 0);
        }
        if (d < 2600 && rear > 0.05) {
          const len = (e.r * 2.5 + 18) * throttle * (0.9 + 0.1 * Math.sin(t * 7 + ei)) * (d < 250 ? 0.6 : 1);
          const end = M.add(wp, M.mul(wd, len));
          flameCalls.push([wp, end, {
            width0: e.r * 0.20, width1: e.r * 0.52,
            color: [0.16, 0.50, 0.85], alpha: 0.13, mode: 1, time: t + s.phase,
          }]);
          flameCalls.push([wp, M.add(wp, M.mul(wd, len * 0.55)), {
            width0: e.r * 0.08, width1: e.r * 0.16,
            color: [0.62, 0.92, 1.0], alpha: 0.18, mode: 1, time: t + s.phase,
          }]);
        }
      }
      // running lights
      for (const l of mdl.lights || []) {
        const wp = M.transformPoint(m, l);
        const blink = 0.65 + 0.35 * Math.sin(t * 2.2 + s.phase + l[0] * 0.01);
        sprite.add(wp, 5.5, [1.0 * blink, 0.52 * blink, 0.18 * blink], 0);
      }
      // turret sensor glow
      if (d < 2600) {
        for (let ti = 0; ti < mdl.turrets.length; ti += 2) {
          const tt = mdl.turrets[ti];
          const wp = M.transformPoint(m, tt.pos);
          sprite.add(wp, 3.4, [1.0, 0.55, 0.18], 0);
        }
      }
    }
    // shuttles
    for (const sh of state.shuttles) {
      const u = M.fract(t * sh.speed + sh.offset);
      const p = sampleClosed(SHUTTLE_PATH, u);
      const p2 = sampleClosed(SHUTTLE_PATH, M.fract(u + 0.004));
      const dir = M.norm(M.sub(p2, p));
      const yaw = Math.atan2(-dir[0], -dir[2]);
      const pos = [p[0], p[1] + sh.lift, p[2] + sh.side];
      const roll = 0.35 * Math.sin(t * 0.7 + sh.offset * 20);
      const m = M.mat4Compose(pos, yaw, -0.2, roll, 1);
      r.drawMesh(MODELS.shuttle.mesh, m);
      for (const e of MODELS.shuttle.engines) {
        const wp = M.transformPoint(m, e.pos);
        const wd = M.transformDir(m, e.dir);
        sprite.add(wp, 2.2, [0.35, 0.85, 1.0], 0);
        sprite.add(wp, 1.1, [0.85, 0.98, 1.0], 1);
        const end = M.add(wp, M.mul(wd, 14 + 4 * Math.sin(t * 9 + sh.offset * 10)));
        flameCalls.push([wp, end, { width0: 0.9, width1: 1.8, color: [0.3, 0.75, 1.0], alpha: 0.25, mode: 1, time: t }]);
      }
    }
    return flameCalls;
  }

  function sampleClosed(keys, u) {
    const n = keys.length;
    const f = M.fract(u) * n;
    const i = Math.floor(f);
    const t = f - i;
    const p0 = keys[(i - 1 + n) % n], p1 = keys[i % n], p2 = keys[(i + 1) % n], p3 = keys[(i + 2) % n];
    return M.catmull(p0, p1, p2, p3, t);
  }

  function draw(r, cam, t) {
    update(t);
    const flames = drawShips(r, cam, t);
    ASTEROIDS.draw(r, cam, t);
    r.debris.begin();
    ASTEROIDS.drawDebris(r, cam, t);
    r.debris.draw(cam, r.env);
    for (const fc of flames) r.beams.draw(cam, fc[0], fc[1], fc[2]);
  }

  return { state, init, update, draw, sampleClosed, shipMatrix };
})();
