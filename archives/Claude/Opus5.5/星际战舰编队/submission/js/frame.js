'use strict';
// ---------------------------------------------------------------------------
// Frame assembly: turns the global time t into draw lists, effect instances,
// lights and shields for the renderer.
// ---------------------------------------------------------------------------
const FR = {};
const SHIELD_COL = [0.32, 0.86, 1.45];
const BOLT_COL = [0.55, 1.5, 3.2];
const ENGINE_COL = [0.55, 1.35, 2.6];

// ---- FX & ribbon builders --------------------------------------------------
const FX = {
  n: 0,
  reset() { this.n = 0; },
  push(a, w0, b, w1, r, g, bl, al, type, seed, p1, p2) {
    if (this.n >= R.fxCap) return; const d = R.fxData, o = this.n * 16;
    d[o] = a[0]; d[o + 1] = a[1]; d[o + 2] = a[2]; d[o + 3] = w0;
    d[o + 4] = b[0]; d[o + 5] = b[1]; d[o + 6] = b[2]; d[o + 7] = w1;
    d[o + 8] = r; d[o + 9] = g; d[o + 10] = bl; d[o + 11] = al;
    d[o + 12] = type; d[o + 13] = seed || 0; d[o + 14] = p1 || 0; d[o + 15] = p2 || 0;
    this.n++;
  },
  sprite(p, size, c, a, type, seed, p1, rot) { this.push(p, size, p, size, c[0], c[1], c[2], a, type, seed, p1, rot || 0); },
  streak(a, b, w0, w1, c, al, type, seed, p1, p2) { this.push(a, w0, b, w1, c[0], c[1], c[2], al, type, seed, p1, p2); },
};
const RIB = {
  n: 0,
  reset() { this.n = 0; },
  // pts: [[x,y,z]], w: widths, col: [r,g,b], al: alphas
  strip(pts, w, col, al, camPos) {
    const N = pts.length; if (N < 2) return;
    const d = R.ribData; let along = 0;
    let prev = null;
    for (let i = 0; i < N - 1; i++) {
      if (this.n + 6 > R.ribCap) return;
      const p0 = pts[i], p1 = pts[i + 1];
      const seg = V.sub(p1, p0); const sl = V.len(seg); if (sl < 1e-4) continue;
      const dir = V.scale(seg, 1 / sl);
      const s0 = prev || V.norm(V.cross(dir, V.sub(camPos, p0)));
      const s1 = V.norm(V.cross(dir, V.sub(camPos, p1))); prev = s1;
      const a0 = V.madd(p0, s0, w[i]), b0 = V.madd(p0, s0, -w[i]), a1 = V.madd(p1, s1, w[i + 1]), b1 = V.madd(p1, s1, -w[i + 1]);
      const quad = [[a0, al[i], 1, along], [b0, al[i], -1, along], [a1, al[i + 1], 1, along + sl], [b0, al[i], -1, along], [b1, al[i + 1], -1, along + sl], [a1, al[i + 1], 1, along + sl]];
      for (const [p, a, v, u] of quad) { const o = this.n * 9; d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; d[o + 3] = col[0]; d[o + 4] = col[1]; d[o + 5] = col[2]; d[o + 6] = a; d[o + 7] = u; d[o + 8] = v; this.n++; }
      along += sl;
    }
  },
};

FR.init = function () {
  const r = U.rng(2024);
  // dust motes (wrapped box around camera); z period divides the loop distance
  const k = Math.max(1, Math.round(TL.D / 700)); FR.dustLz = TL.D / k;
  FR.dust = []; for (let i = 0; i < 2600; i++) FR.dust.push([r() * 700, r() * 500, r() * FR.dustLz, r()]);
  const kp = Math.max(1, Math.round(TL.D / 2200)); FR.pebLz = TL.D / kp;
  FR.peb = []; for (let i = 0; i < 150; i++) FR.peb.push({ p: [r() * 2400, r() * 1400, r() * FR.pebLz], axis: V.norm([r() - 0.5, r() - 0.5, r() - 0.5]), w: (r() - 0.5) * 1.2, shape: r() < 0.5 ? 2 : 1, mat: r() < 0.5 ? MAT.ROCK : MAT.ROCK_D });
  FR.instBuf = [new Float32Array(8192 * 12), new Float32Array(8192 * 12), new Float32Array(8192 * 12)];
  FR.blockBuf = new Float32Array(4096 * 12);
  FR.mote = []; for (let i = 0; i < 700; i++) FR.mote.push([r(), r(), r(), r()]);
};

// periodic ripple on a shield: direction changes every period (period divides the loop length)
FR.ripple = function (t, seed) {
  const per = TL.T / 20; const ph = (t + seed * 1.7) / per; const k = Math.floor(ph), f = ph - k;
  const h1 = U.hash(k * 7 + Math.round(seed * 100)), h2 = U.hash(k * 13 + Math.round(seed * 100) + 3);
  const a = h1 * TAU, z = h2 * 1.6 - 0.8, r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), r * Math.sin(a), z, 1 - f];
};

const defU = () => ({ thrust: 1, charge: [0, 0], flash: 0, pulse: 1, hits: null, heat: [0, 0, 0, 0], shield: [0, 0, 0, 0], sunAmt: 1, ambAmt: 1, emitMul: 1, chase: 0.641 });

FR.lightsPush = function (fr, p, col, rad, pri) { fr.L.push({ p, col, rad, pri: pri || 1 }); };

// deflect a point out of ship shield ellipsoids (debris slides around the fleet)
FR.deflect = function (p, fr, margin) {
  for (const s of fr.shipBodies) {
    const d = [(p[0] - s.c[0]) / (s.r[0] + margin), (p[1] - s.c[1]) / (s.r[1] + margin), (p[2] - s.c[2]) / (s.r[2] + margin)];
    const l = Math.hypot(d[0], d[1], d[2]);
    if (l < 1 && l > 1e-4) { const k = 1 / l; p = [s.c[0] + d[0] * k * (s.r[0] + margin), s.c[1] + d[1] * k * (s.r[1] + margin), s.c[2] + d[2] * k * (s.r[2] + margin)]; if (s.hit !== undefined && 1 - l > s.hitAmt) { s.hitAmt = 1 - l; s.hitDir = d; } }
  }
  return p;
};

// ---------------------------------------------------------------------------
FR.build = function (t) {
  const T = TL.T;
  const cam = CAM.at(t);
  const fr = { t, cam, scene: cam.scene, draws: [], inst: [], shields: [], L: [], beam: null, holo: false };
  FX.reset(); RIB.reset();
  const ext = cam.scene === 'ext' || cam.scene === 'bridge';
  fr.sky = ext;
  // camera velocity (for dust streaks)
  const c2 = CAM.at(Math.max(0, t - 0.04));
  fr.camVel = cam.shot === c2.shot ? V.scale(V.sub(cam.pos, c2.pos), 1 / 0.04) : [0, 0, 0];
  if (ext) FR.exterior(fr, t);
  else if (cam.scene === 'core') FR.core(fr, t);
  else if (cam.scene === 'corridor') FR.corridor(fr, t);
  // pick lights
  const cp = cam.pos;
  fr.L.forEach((l) => { const d2 = V.dist(l.p, cp) ** 2; l.score = l.pri * (Math.max(l.col[0], l.col[1], l.col[2]) + 0.1) / (1 + d2 / (l.rad * l.rad * 16)); });
  fr.L.sort((a, b) => b.score - a.score);
  fr.lights = fr.L.slice(0, 40);
  return fr;
};

// ---------------------------------------------------------------------------
FR.exterior = function (fr, t) {
  const T = TL.T, cam = fr.cam;
  const meta = W.flagMeta;
  fr.shadow = true;
  fr.shipBodies = [];
  // ---- flagship
  const fth = TL.thrust(t, 0, 0.3);
  const fsh = TL.shield(t, TL.flagShieldT);
  const fu = defU();
  fu.thrust = fth.core; fu.charge = [U.smooth(TL.charge[0], TL.charge[1] - 0.3, t) * (1 - U.smooth(TL.beam[1], TL.beamOff + 0.5, t)), fireEnv(t)];
  fu.chargeAxis = meta.chargeAxis;
  if (fsh) fu.shield = [fsh.fill * fsh.w * 0.5 + 0.3 * fsh.arcs, A.flag.origin[2] + meta.shield.c[2] + (fsh.wave > -5 ? fsh.wave : -9) * meta.shield.r[2], meta.shield.r[2] * 0.09, 0];
  const inHangar = cam.pos[0] < -60 && cam.pos[0] > -175 && cam.pos[1] < 26 && cam.pos[1] > -42 && cam.pos[2] < 140 && cam.pos[2] > -262;
  const inBridge = fr.scene === 'bridge';
  fr.draws.push({ model: A.flag.ext, M: W.flagM, u: fu, sections: true });
  fr.draws.push({ model: A.flag.hangar, M: W.flagM, u: Object.assign({}, fu, { ambAmt: 0.45 }), sections: true });
  fr.draws.push({ model: A.flag.bridge, M: W.flagM, u: Object.assign({}, fu, { ambAmt: 0.4 }), sections: true });
  fr.shipBodies.push({ c: meta.shield.c, r: meta.shield.r });
  // engine plumes + lights
  meta.nozzles.forEach((nz, i) => FR.plume(fr, nz.p, [0, 0, -1], nz.r, fth, i));
  FR.lightsPush(fr, [0, -6, -610], V.scale(ENGINE_COL, 3.5 * fth.core), 150, 2);
  FR.lightsPush(fr, [-60, -6, -590], V.scale(ENGINE_COL, 1.8 * fth.core), 100, 1.5);
  FR.lightsPush(fr, [60, -6, -590], V.scale(ENGINE_COL, 1.8 * fth.core), 100, 1.5);
  FR.lightsPush(fr, [-132, -8, -350], V.scale(ENGINE_COL, 1.2 * fth.core), 60, 1);
  FR.lightsPush(fr, [132, -8, -350], V.scale(ENGINE_COL, 1.2 * fth.core), 60, 1);
  if (fsh) {
    fr.shields.push({ M: M.trans(meta.shield.c), radii: meta.shield.r, expand: fsh.expand, state: [fsh.arcs, fsh.fill, fsh.wave, fsh.w * 0.9], seed: 0.5, ripple: FR.ripple(t, 0.5) });
    if (fsh.wave > -2) FR.lightsPush(fr, [0, 20, meta.shield.r[2] * fsh.wave], V.scale(SHIELD_COL, 25), 260, 2);
  }
  // pulse turrets
  FR.turrets(fr, t);
  // hangar & bridge lights
  if (inHangar || V.dist(cam.pos, [-160, -10, -60]) < 500) {
    FR.lightsPush(fr, [-113, -10, -240], [1.6, 1.4, 1.2], 40, 3);
    for (const z of [-186, -86, -6]) FR.lightsPush(fr, [-113, 4, z + 4], [1.4, 1.3, 1.2], 22, 2);
    FR.lightsPush(fr, [-150, -30, 80], [0.4, 1.2, 1.5], 26, 2);
    for (const z of [-200, -140, -80, -20, 40]) FR.lightsPush(fr, [-113, -34, z], [0.25, 0.7, 0.9], 20, 1.2);
  }
  if (inBridge) {
    FR.lightsPush(fr, [0, 100, 154], [0.35, 0.8, 1.0], 40, 4);
    FR.lightsPush(fr, [-48, 96, 140], [0.12, 0.3, 0.4], 26, 3); FR.lightsPush(fr, [48, 96, 140], [0.12, 0.3, 0.4], 26, 3);
    FR.lightsPush(fr, [0, 84, 210], [0.2, 0.4, 0.5], 26, 3);
    FR.lightsPush(fr, [-30, 125, 154], [0.2, 0.4, 0.5], 26, 2); FR.lightsPush(fr, [30, 125, 154], [0.2, 0.4, 0.5], 26, 2);
    FR.hologram(fr, t);
  }
  // ---- escorts
  const planes = fr.planes = FR.camPlanes(cam);
  W.ships.forEach((s, i) => {
    const st = TL.shipState(s, t); s._st = st;
    const th = TL.thrust(t, s.delay, s.ph[0]);
    const Mm = M.mul(M.trq(st.pos, st.q), M.trans(V.neg(s.asset.origin)));
    const sh = TL.shield(t, s.shieldT);
    const u = defU(); u.thrust = th.core;
    const sm = s.asset.meta.shield;
    if (sh) u.shield = [sh.fill * sh.w * 0.5 + 0.3 * sh.arcs, s.asset.origin[2] + sm.c[2] + (sh.wave > -5 ? sh.wave : -9) * sm.r[2], sm.r[2] * 0.1, 0];
    fr.draws.push({ model: s.asset, M: Mm, u });
    const wc = V.add(st.pos, Q.rot(st.q, sm.c));
    fr.shipBodies.push({ c: wc, r: sm.r });
    const vis = R.sphereVisible(planes, st.pos, s.asset.meta.length * 0.8);
    if (vis) s.asset.meta.nozzles.forEach((nz, k) => FR.plume(fr, V.add(st.pos, Q.rot(st.q, nz.p)), Q.rot(st.q, [0, 0, -1]), nz.r, th, i * 7 + k));
    FR.lightsPush(fr, V.add(st.pos, Q.rot(st.q, [0, 0, -s.asset.meta.length * 0.58])), V.scale(ENGINE_COL, 0.9 * th.core), 60, 0.6);
    if (sh) fr.shields.push({ M: M.trq(wc, st.q), radii: sm.r, expand: sh.expand, state: [sh.arcs, sh.fill, sh.wave, sh.w * 0.85], seed: i * 1.37, ripple: FR.ripple(t, i * 1.37 + 0.2) });
    if (s.type === 'G') FR.ciwsHeads(fr, s, i, st, t);
  });
  // ---- craft
  W.craft.defs.forEach((d, i) => {
    const cs = TL.craftState(d, t);
    const Mm = M.mul(M.trq(cs.pos, cs.q), M.trans(V.neg(A.craft.origin)));
    const u = defU(); u.thrust = 0.6 + Math.min(1.6, cs.speed / 60);
    fr.draws.push({ model: A.craft, M: Mm, u });
    if (cs.speed > 3) A.craft.meta.nozzles.forEach((nz, k) => {
      const p = V.add(cs.pos, Q.rot(cs.q, nz.p)); const d0 = Q.rot(cs.q, [0, 0, -1]);
      const len = 6 + Math.min(30, cs.speed * 0.22);
      FX.streak(p, V.madd(p, d0, len), 2.2, 2.2, ENGINE_COL, 1.2, 13, i * 3 + k, 2.5, 1.2);
      FX.sprite(p, 4, ENGINE_COL, 1.2, 0, 0);
    });
    if (cs.speed > 3) FR.lightsPush(fr, V.add(cs.pos, Q.rot(cs.q, [0, 0, -18])), V.scale(ENGINE_COL, 1.6), 22, 0.8);
  });
  W.craft.parked.forEach((p) => fr.draws.push({ model: A.craft, M: M.mul(M.trans(p), M.trans(V.neg(A.craft.origin))), u: Object.assign(defU(), { thrust: 0.15, ambAmt: 0.5 }) }));
  // ---- beam & charge
  FR.beam(fr, t, fu);
  // ---- rocks (previous, current and next loop's field)
  for (const cyc of [-1, 0, 1]) FR.rocks(fr, t, cyc);
  // ---- projectiles
  FR.bolts(fr, t); FR.rounds(fr, t); FR.missiles(fr, t);
  for (const cyc of [0, -1]) { FR.flashes(fr, t + (cyc ? T : 0), cyc); FR.sparks(fr, t + (cyc ? T : 0)); }
  FR.debris(fr, t);
  // ---- ambient particles
  if (!inBridge && !inHangar) FR.dustField(fr, t);
  FR.pebbles(fr, t);
  // ripples where debris was deflected by shields
  fr.shipBodies.forEach((b) => { });
};

function fireEnv(t) { return U.smooth(TL.beam[0], TL.beam[0] + 0.15, t) * (1 - U.smooth(TL.beam[1], TL.beamOff, t)); }

FR.camPlanes = function (cam) {
  const vp = FR.viewProj(cam, R.W / R.H || 16 / 9, 1, 60000); return R.frustumPlanes(vp);
};
FR.viewProj = function (cam, aspect, near, far) {
  const up = Q.rot(Q.axis(V.norm(V.sub(cam.target, cam.pos)), cam.roll || 0), [0, 1, 0]);
  const v = M.lookAt(cam.pos, cam.target, up); const p = M.persp(cam.fov * Math.PI / 180, aspect, near, far);
  return M.mul(p, v);
};

// engine plume
FR.plume = function (fr, p, dir, r, th, seed) {
  const len = r * 5.5 * th.len;
  const pa = V.madd(p, dir, -r * 0.3);
  FX.streak(pa, V.madd(p, dir, len), r * 1.0, r * 1.0, V.scale(ENGINE_COL, 0.3 + 0.16 * th.core), 1, 13, seed, 3.2 / Math.max(0.6, th.inner * 1.4 + 0.5), 1.4 / th.len);
  FX.sprite(V.madd(p, dir, r * 0.2), r * 2.2, V.scale(ENGINE_COL, 0.22 * th.core), 1, 0, seed);
  // sparks shed from the plume edge (only when close)
  const dc = V.dist(p, fr.cam.pos);
  if (dc < r * 60) {
    const N = 14; const rate = 1.5;
    const side = V.norm(V.cross(dir, [0, 1, 0.01]));
    const up = V.cross(side, dir);
    for (let i = 0; i < N; i++) {
      const age = U.fract(fr.t * rate + i / N + seed * 0.13);
      const ang = U.hash(i * 31 + seed * 7) * 6.283;
      const rad = r * (0.7 + age * 1.2);
      const q = V.add(V.madd(p, dir, age * len * 1.1), V.add(V.scale(side, Math.cos(ang) * rad), V.scale(up, Math.sin(ang) * rad)));
      FX.streak(q, V.madd(q, dir, 3 + age * 6), 0.5, 0.5, V.scale(ENGINE_COL, 1.2 * (1 - age)), 1, 11, 0);
    }
  }
};

// pulse turrets on the flagship
FR.turrets = function (fr, t) {
  const meta = W.flagMeta; const T = TL.T;
  const B = W.target.B, E = W.target.E;
  meta.turretMounts.forEach((m, i) => {
    let yaw = (m.side > 0 ? 0.25 : -0.25) + 0.35 * Math.sin(TAU * 2 * t / T + i * 1.1);
    let pitch = 0.06 + 0.05 * Math.sin(TAU * 3 * t / T + i);
    let aimAmt = 0, tgt = null;
    if (m.side > 0) { aimAmt = U.bump(t, TL.pulse[0] - 1.6, TL.pulse[0] - 0.4, TL.pulse[1] + 0.4, TL.pulse[1] + 2); tgt = W.rockFrame(B, t + 1).c; }
    else { aimAmt = U.bump(t, TL.missile[0] - 1, TL.missile[0], TL.eBreak, TL.eBreak + 2); tgt = W.rockFrame(E, t).c; }
    if (aimAmt > 0) {
      const d = V.sub(tgt, m.p); const ay = Math.atan2(d[0], d[2]), ap = Math.atan2(d[1], Math.hypot(d[0], d[2]));
      yaw = U.lerp(yaw, ay, aimAmt); pitch = U.lerp(pitch, ap, aimAmt);
    }
    const q = Q.euler(yaw, pitch, 0);
    m._q = q;
    // flash from recent shots
    let fl = 0; const fires = W.turretFire[i];
    for (let k = fires.length - 1; k >= 0; k--) { const dt = t - fires[k]; if (dt < 0) continue; if (dt > 0.6) break; fl = Math.max(fl, Math.exp(-dt * 9)); }
    const u = defU(); u.flash = 0.06 + fl * 1.6;
    fr.draws.push({ model: A.turret, M: M.mul(M.trq(m.p, q), M.trans(V.neg(A.turret.origin))), u });
  });
};

FR.ciwsHeads = function (fr, s, i, st, t) {
  const mounts = s.asset.meta.mounts; const T = TL.T;
  const fires = W.ciwsFire[i];
  let fl = 0;
  for (let k = fires.length - 1; k >= 0; k--) { const dt = t - fires[k]; if (dt < 0) continue; if (dt > 2.5) break; fl = Math.max(fl, Math.exp(-dt * 1.6) * 0.6 + (dt < 0.06 ? 1 : 0)); }
  // aim
  let tgt = null, aim = 0;
  if (s.slot[0] > 0) { aim = U.bump(t, TL.ciwsS[0] - 1, TL.ciwsS[0] - 0.2, TL.ciwsS[1], TL.ciwsS[1] + 1.5); tgt = W.rockFrame(W.target.C2, t).c; }
  else { aim = U.bump(t, TL.ciwsP[0] - 1, TL.ciwsP[0] - 0.2, TL.ciwsP[1], TL.ciwsP[1] + 1.5); tgt = W.rockFrame(W.target.C1, t).c; }
  mounts.forEach((mp, k) => {
    const wp = V.add(st.pos, Q.rot(st.q, mp));
    let yaw = 0.6 * Math.sin(TAU * 3 * t / T + i + k), pitch = 0.1 + 0.15 * Math.sin(TAU * 4 * t / T + k);
    if (aim > 0) { const d = V.sub(tgt, wp); yaw = U.lerp(yaw, Math.atan2(d[0], d[2]), aim); pitch = U.lerp(pitch, Math.atan2(d[1], Math.hypot(d[0], d[2])), aim); }
    const flip = mp[1] < -10; // ventral mount hangs upside down
    let q = Q.euler(yaw, pitch, flip ? Math.PI : 0);
    if (flip) q = Q.mul(Q.euler(yaw, pitch, 0), Q.axis([0, 0, 1], Math.PI));
    const u = defU(); u.flash = 0.05 + fl;
    fr.draws.push({ model: A.ciws, M: M.mul(M.trq(wp, q), M.trans(V.neg(A.ciws.origin))), u });
  });
};

// beam main gun
FR.beam = function (fr, t, fu) {
  const meta = W.flagMeta; const mz = meta.muzzle; const T = TL.T;
  const ch = U.smooth(TL.charge[0], TL.charge[1], t) * (t < TL.beam[0] + 0.3 ? 1 : 0);
  const fire = fireEnv(t);
  const muz = V.add(mz, [0, 0, 6]);
  if (ch > 0 && t < TL.beam[0] + 0.3) {
    const g = ch * ch;
    FX.sprite(muz, 10 + 46 * g, [1.2 * g + 0.2, 3 * g + 0.4, 4.5 * g + 0.6], 1, 0, 1);
    FX.sprite(muz, 30 + 120 * g, [0.3, 0.9, 1.4], 0.4 * g, 0, 2);
    FX.sprite(muz, 60 * g, [2, 3, 4], 0.5 * g, 2, 3, 0, t * 0.6);
    // converging motes
    for (let i = 0; i < 48; i++) {
      const ph = U.fract(t * 1.5 + i / 48);
      const ang = i * 2.39996 + ph * 2.0; const rr = (1 - ph) * (40 + 60 * U.hash(i));
      const p = V.add(muz, [Math.cos(ang) * rr, Math.sin(ang) * rr, -(1 - ph) * 50 * U.hash(i + 9)]);
      const q = V.lerp(p, muz, 0.12);
      FX.streak(p, q, 0.8, 0.5, [1.5, 3.5, 5], ch * ph, 11, 0);
    }
    FR.lightsPush(fr, muz, [1 * g, 2.4 * g, 3.4 * g], 80, 4);
  }
  if (fire > 0 || (t > TL.beam[1] && t < TL.beamOff + 1.2)) {
    const RA = W.target.A;
    const hit = W.rockPoint(RA, RA.hitL, Math.min(t, TL.aBreak));
    const front = U.sat((t - TL.beam[0]) / 0.22);
    let a = muz, b = V.lerp(muz, hit, front);
    if (t > TL.aBreak) b = V.add(hit, [0, 0, 1400 * U.smooth(TL.aBreak, TL.aBreak + 0.8, t)]);
    // detach: tail leaves the muzzle after cease-fire
    if (t > TL.beam[1]) { const k = (t - TL.beam[1]); a = V.add(muz, [0, 0, k * k * 2600 + k * 600]); b = V.add(b, [0, 0, k * 1600]); }
    const w = (13 + 2.5 * Math.sin(t * 37) + 1.5 * Math.sin(t * 61)) * (0.25 + 0.75 * fire) * (t > TL.beam[1] ? Math.max(0, 1 - (t - TL.beam[1]) / 0.65) : 1);
    if (w > 0.05 && b[2] > a[2]) {
      FX.streak(a, b, w, w, [2.2, 4.2, 6.0], 1, 12, 1);
      FX.streak(a, b, w * 3.2, w * 3.2, [0.25, 0.7, 1.2], 0.6, 14, 2);
      fr.beam = { a, b, c: [1.4, 2.8, 4.2], r: 70 * Math.min(1, w / 10) };
    }
    if (fire > 0) {
      // start rings + muzzle bloom
      const k0 = t - TL.beam[0];
      FX.sprite(muz, 40 + 20 * Math.sin(t * 23), [2.5, 5, 7], fire, 0, 4);
      if (k0 < 0.7) FX.sprite(muz, 24 + k0 * 150, [2, 4, 6], (1 - k0 / 0.7) * 1.1, 1, 0.035, 0.85);
      for (let j = 0; j < 4; j++) { const ph = U.fract(t * 1.5 + j / 4); const p = V.lerp(a, b, ph * 0.5); FX.sprite(p, w * 2.0, [1.2, 2.6, 4], (1 - ph) * fire * 0.7, 1, 0.05, 0.8); }
      if (t < TL.aBreak + 0.4) {
        FX.sprite(hit, 34 + 8 * Math.sin(t * 29), [4, 3.2, 2.4], fire, 2, 5, 0, t);
        FX.sprite(hit, 70, [1.4, 0.8, 0.35], fire * 0.6, 0, 6);
        FR.lightsPush(fr, V.add(hit, [0, 0, -30]), [6, 4, 2.4], 130, 5);
      }
      FR.lightsPush(fr, V.add(muz, [0, 0, 30]), [2, 4, 6], 100, 5);
    } else if (t > TL.beam[1]) {
      // afterglow motes drifting forward
      const k = t - TL.beam[1];
      for (let i = 0; i < 40; i++) { const u = U.hash(i * 3 + 1); const p = V.add(V.lerp(muz, hit, u), [(U.hash(i) - 0.5) * 30 * (1 + k), (U.hash(i + 5) - 0.5) * 30 * (1 + k), k * (200 + 300 * U.hash(i + 2))]); FX.sprite(p, 3 + 4 * U.hash(i + 7), [2, 4, 6], Math.max(0, 1 - k / 1.6), 0, 0); }
    }
  }
};

// rocks: plain & fractured
FR.rocks = function (fr, t, cyc) {
  const tt = t - cyc * TL.T;
  const cp = fr.cam.pos;
  for (const rk of W.rocks) {
    const f0 = W.rockFrame(rk, tt);
    if (f0.c[2] < -9000 || f0.c[2] > 14000) continue;
    const R0 = rk.asset.R;
    if (!rk.isTarget) {
      if (!R.sphereVisible(fr.planes, f0.c, R0 * 1.5)) continue;
      const Mm = M.mul(M.trq(f0.c, f0.q), M.trans(V.neg(rk.asset.origin)));
      fr.draws.push({ model: rk.asset.model, M: Mm, u: defU(), cast: V.dist(f0.c, cp) < 2500 });
      continue;
    }
    const heat = FR.rockHeat(rk, tt);
    const og = rk.asset.origin;
    rk.frags.forEach((f, k) => {
      const af = rk.asset.frags[k]; if (!af.model.opaque.length) return;
      const st = W.fragState(rk, k, tt);
      let c = st.c;
      if (st.tau > 0) c = FR.deflect(c, fr, af.r * 0.8);
      if (!R.sphereVisible(fr.planes, c, af.r * 2 + 20)) return;
      const Mm = M.mul(M.trq(c, st.q), M.trans(V.neg(V.add(af.c, og))));
      fr.draws.push({ model: af.model, M: Mm, u: Object.assign(defU(), heat) });
    });
  }
};
// heat uniforms per target rock (rock-time tt)
FR.rockHeat = function (rk, tt) {
  const og = rk.asset.origin; const hits = new Float32Array(16);
  const toG = (lp) => [lp[0] + og[0], lp[1] + og[1], lp[2] + og[2]];
  let heat = [0, 0, 14, 0];
  if (rk.id === 'A') {
    const h = toG(rk.hitL); const w = U.smooth(TL.aHeat, TL.aHeat + 2.2, tt) * 1.8 * (1 - U.smooth(TL.beam[1], TL.beam[1] + 5, tt));
    hits.set([h[0], h[1], h[2], w], 0);
    heat = [U.smooth(TL.aCrack[0], TL.aCrack[0] + 1, tt) * (1 - 0.7 * U.smooth(TL.aBreak + 0.2, TL.aBreak + 2.5, tt) - 0.3 * U.smooth(TL.aBreak + 2, TL.aBreak + 8, tt)), rk.asset.R * 1.6 * U.smooth(TL.aCrack[0], TL.aCrack[1], tt) + 0.01, 18, 0];
  } else if (rk.id === 'B') {
    let n = 0;
    for (let i = W.bolts.length - 1; i >= 0 && n < 4; i--) { const b = W.bolts[i]; const dt = tt - b.tHit; if (dt < 0) continue; if (dt > 3) break; const h = toG(b.hitL); hits.set([h[0], h[1], h[2], 1.4 * Math.exp(-dt * 1.3)], n * 4); n++; }
    heat = [U.smooth(TL.bBreak - 1.4, TL.bBreak - 0.3, tt) * (1 - 0.7 * U.smooth(TL.bBreak + 0.2, TL.bBreak + 2.5, tt) - 0.3 * U.smooth(TL.bBreak + 2, TL.bBreak + 8, tt)), rk.asset.R * 1.8 * U.smooth(TL.bBreak - 1.4, TL.bBreak, tt) + 0.01, 7, 0];
    if (n === 0) hits.set([0, 0, 0, 0], 0);
    hits.copyWithin(0, 0, 4); // keep layout
    if (n > 0) { /* crack centre = latest hit */ }
  } else if (rk.id === 'E') {
    let n = 0;
    const ms = W.missiles;
    for (let i = ms.length - 1; i >= 0; i--) { const m = ms[i]; const dt = tt - m.tHit; if (dt < 0 || dt > 8 || n >= 4) continue; const fr0 = W.rockFrame(rk, m.tHit); const lp = Q.rot([-fr0.q[0], -fr0.q[1], -fr0.q[2], fr0.q[3]], V.sub(m.p3, fr0.c)); const h = toG(lp); hits.set([h[0], h[1], h[2], 1.6 * Math.exp(-dt * 0.45)], n * 4); n++; }
    heat = [U.smooth(TL.eBreak - 1.3, TL.eBreak - 0.2, tt) * (1 - 0.7 * U.smooth(TL.eBreak + 0.2, TL.eBreak + 2.5, tt) - 0.3 * U.smooth(TL.eBreak + 2, TL.eBreak + 8, tt)), rk.asset.R * 1.8 * U.smooth(TL.eBreak - 1.5, TL.eBreak, tt) + 0.01, 13, 0];
  } else {
    const bt = rk.id === 'C1' ? TL.c1Break : TL.c2Break;
    heat = [U.smooth(bt - 0.6, bt, tt) * (1 - U.smooth(bt + 0.2, bt + 5, tt)), 40 * U.smooth(bt - 0.6, bt, tt) + 0.01, 5, 0];
    hits.set([og[0], og[1], og[2] - rk.asset.R * 0.6, 1.2 * U.bump(tt, bt - 1.6, bt - 0.4, bt, bt + 2)], 0);
  }
  // crack front measured from first hit slot; ensure slot 0 has a point
  if (hits[3] === 0 && rk.id !== 'A') { const h = toG(rk.id === 'E' ? [0, 0, -rk.asset.R] : [0, 0, -rk.asset.R * 0.6]); hits.set([h[0], h[1], h[2], 0.0001], 0); }
  return { hits, heat };
};

FR.bolts = function (fr, t) {
  const meta = W.flagMeta, B = W.target.B;
  for (const b of W.bolts) {
    if (t < b.t0 - 0.01 || t > b.tHit + 0.05) continue;
    const m = meta.turretMounts[b.tu]; const q = m._q || Q.ident();
    const mz = A.turret.meta.muzzles[b.barrel];
    const mp = V.add(m.p, Q.rot(q, [mz[0], mz[1] - A.turret.origin[1] + 1, mz[2] + 8]));
    const hp = W.rockPoint(B, b.hitL, b.tHit);
    const k = U.sat((t - b.t0) / (b.tHit - b.t0));
    const p = V.lerp(mp, hp, k); const dir = V.norm(V.sub(hp, mp));
    const tail = V.madd(p, dir, -Math.min(34, V.dist(p, mp)));
    if (k < 1) { FX.streak(tail, p, 3.2, 3.2, BOLT_COL, 1.2, 10, 0); FX.sprite(p, 11, BOLT_COL, 0.35, 0, 0); }
    const dt = t - b.t0;
    if (dt < 0.14) { FX.sprite(mp, 10 + dt * 50, [2, 4, 6], (1 - dt / 0.14) * 1.3, 2, 0, 0, b.t0 * 7); FR.lightsPush(fr, mp, V.scale([0.8, 1.8, 2.8], 1 - dt / 0.14), 26, 3); }
    if (k < 1 && V.dist(p, fr.cam.pos) < 600) FR.lightsPush(fr, p, [0.2, 0.5, 1.0], 22, 1);
  }
};

FR.rounds = function (fr, t) {
  const tc = [3.4, 1.7, 0.55];
  let n = 0;
  for (const r of W.rounds) {
    if (t < r.t0 || t > r.tHit) continue;
    const k = (t - r.t0) / (r.tHit - r.t0);
    const dir = V.norm(V.sub(r.p1, r.p0));
    const p = V.lerp(r.p0, r.p1, k);
    const tracer = (n++ % 3) === 0;
    FX.streak(V.madd(p, dir, -(tracer ? 26 : 12)), p, tracer ? 1.5 : 0.9, tracer ? 1.5 : 0.9, tc, tracer ? 1.3 : 0.5, 11, 0);
    const dt = t - r.t0;
    if (dt < 0.05) { FX.sprite(r.p0, 6, [5, 3, 1.2], 1 - dt / 0.05, 2, 0, 0, r.t0 * 13); FR.lightsPush(fr, r.p0, [5, 2.8, 1.0], 22, 1.5); }
  }
};

FR.missiles = function (fr, t) {
  const cp = fr.cam.pos;
  for (const m of W.missiles) {
    if (t < m.tl || t > m.tHit + 4.5) continue;
    if (t < m.tHit) {
      const mp = W.missilePos(m, t);
      const q = Q.look(mp.d, [0, 1, 0]);
      fr.draws.push({ model: A.missile, M: M.mul(M.trq(mp.p, q), M.trans(V.neg(A.missile.origin))), u: Object.assign(defU(), { thrust: mp.ign ? 2 : 0 }) });
      if (mp.ign) {
        const ig = U.sat((t - m.tIgn) / 0.25);
        FX.streak(V.madd(mp.p, mp.d, -6), V.madd(mp.p, mp.d, -6 - 22 * ig), 2.8, 2.8, [3.5, 2.2, 1.2], 1.3, 13, m.seed, 3, 1.4);
        FX.sprite(V.madd(mp.p, mp.d, -6), 9 * ig, [5, 3.2, 1.6], 1.2, 0, 0);
        FR.lightsPush(fr, mp.p, [4, 2.4, 1.0], 40, 1.5);
      }
    }
    // trail ribbon (world-anchored samples drift with the world)
    const t1 = Math.min(t, m.tHit); if (t1 <= m.tIgn + 0.02) continue;
    const pts = [], w = [], al = [];
    const N = 46; const tStart = Math.max(m.tIgn, t1 - 3.2);
    const sNow = TL.s(t);
    for (let i = 0; i <= N; i++) {
      const te = tStart + (t1 - tStart) * (i / N);
      const p = W.missilePos(m, te).p; const age = t - te;
      const wob = 1.5 * age;
      p[0] += Math.sin(te * 13 + m.seed) * wob; p[1] += Math.cos(te * 11 + m.seed) * wob;
      p[2] -= sNow - TL.s(te);
      pts.push(p); w.push(1.2 + age * 5.5);
      const fadeIn = U.sat((te - m.tIgn) / 0.3);
      al.push(fadeIn * Math.exp(-age / 1.25) * (i === N ? 0.3 : 1));
    }
    RIB.strip(pts, w, [0.55, 0.5, 0.46], al, cp);
  }
};

const FLASH_KIND = { flare: 2, boom: 0, ring: 1, smoke: 3 };
FR.flashes = function (fr, tt, cyc) {
  const sNow = TL.s(tt);
  for (const f of W.flashes) {
    if (f.t0 > tt) break;
    const age = tt - f.t0; if (age > f.dur) continue;
    const k = age / f.dur; const p = [f.pw[0], f.pw[1], f.pw[2] - sNow];
    if (f.kind === 'flare') { FX.sprite(p, f.size * (0.6 + 0.6 * k), f.col, Math.pow(1 - k, 2), 2, 0, 0, f.t0 * 3.1); if (cyc === 0) FR.lightsPush(fr, p, V.scale(f.col, 0.7 * (1 - k) * (1 - k)), f.size * 1.4, 2); }
    else if (f.kind === 'boom') {
      const c = [f.col[0], f.col[1] * (1 - 0.4 * k), f.col[2] * (1 - 0.8 * k)];
      FX.sprite(p, f.size * (0.3 + 0.7 * Math.sqrt(k)), c, Math.pow(1 - k, 2.2) * 0.75, 0, f.t0);
      if (k < 0.12) FX.sprite(p, f.size * 0.22, [5, 4.4, 3.8], (1 - k / 0.12), 0, 0);
      if (cyc === 0) FR.lightsPush(fr, p, V.scale(f.col, 1.1 * Math.pow(1 - k, 2)), f.size * 1.5, 3);
    } else if (f.kind === 'ring') FX.sprite(p, f.size * (0.25 + 1.4 * Math.sqrt(k)), f.col, Math.pow(1 - k, 1.5), 1, 0.06, 0.8);
    else if (f.kind === 'smoke') {
      const glow = Math.exp(-age * 1.5);
      const c = [0.05 + 1.6 * glow * f.col[0], 0.045 + 0.7 * glow * f.col[1], 0.04 + 0.25 * glow * f.col[2]];
      for (let j = 0; j < 3; j++) { const o = [(U.hash(j + f.t0 * 10) - 0.5) * f.size * 0.6 * (0.3 + k), (U.hash(j + 3 + f.t0 * 10) - 0.5) * f.size * 0.6 * (0.3 + k), (U.hash(j + 7 + f.t0 * 10) - 0.5) * f.size * 0.6]; FX.sprite(V.add(p, o), f.size * (0.35 + 0.7 * Math.sqrt(k)) * (0.7 + 0.3 * j), c, 0.5 * (1 - k) * U.sat(age * 3), 3, f.t0 + j, 0, j * 2.1); }
    }
  }
};

FR.sparks = function (fr, tt) {
  const sNow = TL.s(tt);
  for (const s of W.sparks) {
    if (s.t0 > tt) break;
    const age = tt - s.t0; if (age > s.life) continue;
    const k = age / s.life; const dr = 1 - Math.exp(-age * 2.5);
    const p = [s.pw[0] + s.v[0] * dr / 2.5, s.pw[1] + s.v[1] * dr / 2.5, s.pw[2] + s.v[2] * dr / 2.5 - sNow];
    const vel = V.scale(s.v, Math.exp(-age * 2.5));
    FX.streak(V.madd(p, vel, -0.05), p, 0.9, 0.9, s.col, (1 - k) * (1 - k), 11, 0);
  }
};

FR.debris = function (fr, t) {
  const bufs = FR.instBuf; const cnt = [0, 0, 0];
  for (const cyc of [0, -1]) {
    const tt = t - cyc * TL.T; const sNow = TL.s(tt);
    for (const d of W.debris) {
      const age = tt - d.t0; if (age < 0 || age > 75) continue;
      const s = 0.55 * age + 1.6 * (1 - Math.exp(-age / 1.6));
      let p = [d.pw[0] + d.v[0] * s, d.pw[1] + d.v[1] * s, d.pw[2] + d.v[2] * s - sNow];
      if (!R.sphereVisible(fr.planes, p, 3)) continue;
      p = FR.deflect(p, fr, 2);
      const qq = Q.axis(d.axis, d.w * s + d.seed);
      const o = cnt[d.shape]; if (o >= 8192) continue;
      const b = bufs[d.shape]; const i = o * 12;
      b[i] = p[0]; b[i + 1] = p[1]; b[i + 2] = p[2]; b[i + 3] = 1;
      b[i + 4] = qq[0]; b[i + 5] = qq[1]; b[i + 6] = qq[2]; b[i + 7] = qq[3];
      b[i + 8] = d.heat * Math.exp(-age / 1.4); b[i + 9] = d.mat; b[i + 10] = d.seed; b[i + 11] = 0;
      cnt[d.shape]++;
    }
  }
  for (let k = 0; k < 3; k++) if (cnt[k]) fr.inst.push({ mesh: A.chunks[k], data: bufs[k], count: cnt[k] });
};

FR.dustField = function (fr, t) {
  const cp = fr.cam.pos; const Lx = 700, Ly = 500, Lz = FR.dustLz;
  const sNow = TL.sRaw(t);
  const vrel = V.sub([0, 0, -TL.vel(t)], fr.camVel);
  const L = fr.L.slice(0, 60);
  for (const d of FR.dust) {
    const x = ((d[0] - cp[0]) % Lx + Lx * 1.5) % Lx - Lx / 2 + cp[0];
    const y = ((d[1] - cp[1]) % Ly + Ly * 1.5) % Ly - Ly / 2 + cp[1];
    const z = ((d[2] - sNow - cp[2]) % Lz + Lz * 1.5) % Lz - Lz / 2 + cp[2];
    const p = [x, y, z]; const dc = V.dist(p, cp);
    if (dc > 340 || dc < 2) continue;
    let br = 0.02 + 0.03 * d[3];
    for (const l of L) { const d2 = (l.p[0] - x) ** 2 + (l.p[1] - y) ** 2 + (l.p[2] - z) ** 2; const ll = Math.max(l.col[0], l.col[1], l.col[2]); br += ll * 0.04 / (1 + d2 / (l.rad * l.rad * 2)); }
    br = Math.min(br, 2.5) * (1 - dc / 340);
    const w = 0.18 + dc * 0.0016;
    const tail = V.madd(p, vrel, -0.035);
    FX.streak(tail, p, w, w, [1, 0.95, 0.9], br, 11, 0);
  }
};

FR.pebbles = function (fr, t) {
  const cp = fr.cam.pos; const Lx = 2400, Ly = 1400, Lz = FR.pebLz; const sNow = TL.sRaw(t);
  const buf = FR.instBuf[2]; let o = 0;
  const buf1 = FR.instBuf[1];
  // append to existing instance lists (shape 1 & 2) by building separate arrays
  const arr = { 1: [], 2: [] };
  for (const pb of FR.peb) {
    const x = ((pb.p[0] - cp[0]) % Lx + Lx * 1.5) % Lx - Lx / 2 + cp[0];
    const y = ((pb.p[1] - cp[1]) % Ly + Ly * 1.5) % Ly - Ly / 2 + cp[1];
    const z = ((pb.p[2] - sNow - cp[2]) % Lz + Lz * 1.5) % Lz - Lz / 2 + cp[2];
    let p = [x, y, z];
    if (V.dist(p, cp) > 1100) continue;
    if (fr.planes && !R.sphereVisible(fr.planes, p, 4)) continue;
    p = FR.deflect(p, fr, 3);
    const q = Q.axis(pb.axis, pb.w * t + pb.p[0]);
    arr[pb.shape].push(p[0], p[1], p[2], 1, q[0], q[1], q[2], q[3], 0, pb.mat, pb.p[1], 0);
  }
  for (const k of [1, 2]) if (arr[k].length) fr.inst.push({ mesh: A.chunks[k], data: new Float32Array(arr[k]), count: arr[k].length / 12 });
};

// bridge hologram: live miniature of the formation
FR.hologram = function (fr, t) {
  const c = [0, 102, 154]; const sc = 1 / 44;
  const col = [0.35, 1.2, 1.8], col2 = [1.4, 0.9, 0.4];
  // horizontal projector rings (polylines)
  const ring = (y, r, n, a, rot) => { for (let i = 0; i < n; i++) { const a0 = rot + i / n * TAU, a1 = rot + (i + 0.6) / n * TAU; FX.streak(V.add(c, [Math.sin(a0) * r, y, Math.cos(a0) * r]), V.add(c, [Math.sin(a1) * r, y, Math.cos(a1) * r]), 0.12, 0.12, col, a, 15, 0); } };
  ring(-12, 28, 44, 0.7, t * 0.2); ring(-11.5, 21, 32, 0.5, -t * 0.3); ring(16, 26, 40, 0.3, t * 0.15);
  // flagship as a bright bar
  FX.streak(V.add(c, [0, 0, -560 * sc]), V.add(c, [0, 0, 560 * sc]), 0.7, 0.7, [1.2, 2.6, 3.4], 0.8, 14, 0);
  FX.streak(V.add(c, [-3.8, 0, -300 * sc]), V.add(c, [-3.8, 0, 200 * sc]), 0.4, 0.4, [1.0, 2.2, 3.0], 1.2, 14, 0);
  FX.streak(V.add(c, [3.8, 0, -300 * sc]), V.add(c, [3.8, 0, 200 * sc]), 0.4, 0.4, [1.0, 2.2, 3.0], 1.2, 14, 0);
  FR.lightsPush(fr, c, [0.3, 0.7, 0.9], 30, 3);
  for (const s of W.ships) {
    const st = s._st || TL.shipState(s, t);
    const p = V.add(c, V.scale(st.pos, sc));
    FX.sprite(p, s.type === 'G' ? 0.8 : 0.65, s.type === 'G' ? [1.0, 2.4, 3.2] : [1.6, 2.4, 2.8], 0.55, 0, 0);
    FX.streak(V.add(p, [0, 0, -1.6]), V.add(p, [0, 0, 1.6]), 0.18, 0.18, [1.2, 2.6, 3.2], 0.7, 15, 0);
    const pb = V.add(c, V.scale(TL.shipState(s, t - 2.5).pos, sc));
    FX.streak(V.add(pb, [0, 0, -1.2]), p, 0.12, 0.12, col, 0.8, 15, 0);
  }
  // asteroid targets ahead
  for (const id of ['A', 'B', 'C1', 'C2', 'E']) {
    const rk = W.target[id]; const fc = W.rockFrame(rk, t).c; const p = V.add(c, V.scale(fc, sc));
    if (Math.abs(p[2] - c[2]) > 48) continue;
    FX.sprite(p, 0.5 + rk.asset.R * sc * 0.8, col2, 0.5, 0, 0);
  }
  // scanning sweep line
  const a = (t * 0.9) % TAU;
  FX.streak(c, V.add(c, [Math.sin(a) * 24, 0, Math.cos(a) * 24]), 0.15, 0.15, col, 0.8, 15, 0);
  for (let i = 0; i < 24; i++) { const an = i / 24 * TAU; FX.sprite(V.add(c, [Math.sin(an) * 22, -11, Math.cos(an) * 22]), 0.35, col, 0.8, 0, 0); }
};

// ---------------------------------------------------------------------------
FR.core = function (fr, t) {
  const T = TL.T; const a = A.core;
  fr.shadow = false;
  const pulse = 0.78 + 0.32 * Math.sin(TAU * 25 * t / T) + 0.08 * Math.sin(TAU * 61 * t / T);
  const u = Object.assign(defU(), { sunAmt: 0, ambAmt: 0.35, pulse, chase: 0.641 });
  fr.draws.push({ model: a, M: M.trans([-a.origin[0], 0, -a.origin[2]]), u, sections: true });
  // rotating / precessing rings
  const rings = [[60, 1, 0.0, 0.0], [145, -1, 0.12, 0.7], [205, 1, 0.05, 1.9], [236, -1, 0.18, 2.6]];
  rings.forEach(([y, dir, tilt, ph], i) => {
    const ang = dir * TAU * (3 + i) * t / T + ph;
    const prec = Q.axis([Math.cos(TAU * 2 * t / T + ph), 0, Math.sin(TAU * 2 * t / T + ph)], tilt);
    const q = Q.mul(prec, Q.axis([0, 1, 0], ang));
    const ro = A.rings[i].origin;
    fr.draws.push({ model: A.rings[i], M: M.mul(M.trq([0, y, 0], q), M.trans(V.neg(ro))), u: Object.assign({}, u) });
  });
  // light from the core: several levels, plus wall conduits
  for (let y = 30; y <= 240; y += 42) FR.lightsPush(fr, [0, y, 0], [0.9 * pulse, 2.1 * pulse, 2.6 * pulse], 70, 5);
  for (let k = 0; k < 8; k++) { const an = (k / 8) * TAU + 0.2; FR.lightsPush(fr, [Math.cos(an) * 118, 120, Math.sin(an) * 118], [0.12, 0.4, 0.5], 40, 1); }
  // warm work lamps along the platform walls (contrast with the cyan core)
  for (const ly of A.core.levels) for (let k = 0; k < 6; k++) { const an = (k / 6) * TAU + ly * 0.01; FR.lightsPush(fr, [Math.cos(an) * 116, ly + 10, Math.sin(an) * 116], [0.55, 0.36, 0.18], 34, 1.2); }
  for (const yy of [100, 188]) for (let k = 0; k < 4; k++) { const an = (yy === 188 ? Math.PI / 4 : 0) + k * Math.PI / 2; FR.lightsPush(fr, [Math.cos(an) * 70, yy + 18, Math.sin(an) * 70], [0.2, 0.55, 0.7], 30, 1); }
  // volumetric glow along the core + motes
  for (let y = 40; y < 230; y += 14) FX.sprite([0, y, 0], 56 + 10 * Math.sin(y + t), [0.06 * pulse, 0.16 * pulse, 0.22 * pulse], 0.5, 0, y);
  for (const m of FR.mote) {
    const ang = m[0] * TAU + t * 0.05 * (m[3] - 0.5); const r = 30 + m[1] * 90; const y = (m[2] * 250 + t * 4 * (0.5 + m[3])) % 250;
    const p = [Math.cos(ang) * r, y, Math.sin(ang) * r];
    const br = 0.4 * Math.exp(-r / 60) * pulse + 0.05;
    FX.sprite(p, 0.35 + m[3] * 0.4, [0.8, 1.6, 2.0], br, 0, 0);
  }
  fr.motes = true;
};

FR.corridor = function (fr, t) {
  const T = TL.T; const c = A.corridor;
  fr.shadow = false;
  const u = Object.assign(defU(), { sunAmt: 0, ambAmt: 0.22, pulse: 1, chase: 1.282 });
  fr.draws.push({ model: c, M: M.trans(V.neg(c.origin)), u, sections: true });
  // clamp mechanisms closing / opening on the central gap
  const zs = [56, 118, 180, 242, 304];
  zs.forEach((z, i) => {
    const open = 0.5 + 0.5 * Math.sin(TAU * 26 * t / T + i * 1.3);
    const off = 6 + open * 12;
    for (const s of [-1, 1]) {
      const q = s < 0 ? Q.ident() : Q.axis([0, 1, 0], Math.PI);
      const p = [s * (off + 0), 20, z];
      fr.draws.push({ model: A.clamp, M: M.mul(M.trq([s < 0 ? -off - 14 : off + 14, 22, z], q), M.trans([0, 0, -A.clamp.origin[2]])), u: Object.assign({}, u) });
    }
  });
  // energy blocks advancing in batches along floor and ceiling grooves
  const buf = FR.blockBuf; let n = 0;
  const tracks = [[c.tracks[0] - c.origin[0], c.F - 2], [c.tracks[1] - c.origin[0], c.F - 2], [-3, c.CEIL + 1], [2, c.CEIL + 1]];
  tracks.forEach(([x, y], ti) => {
    const per = 1.2; const ph = ti * 0.3;
    const tq = t + ph; const cyc = Math.floor(tq / per); const fr0 = U.fract(tq / per);
    const adv = cyc * 26 + 26 * U.smoother(0, 0.65, fr0);
    for (let b = 0; b < 30; b++) {
      const batch = Math.floor(b / 5);
      const z = ((b * 9 + batch * 30 + adv * (ti < 2 ? 1 : 0.8)) % 340 + 340) % 340 + 4;
      const o = n * 12; buf[o] = x; buf[o + 1] = y + 1.5; buf[o + 2] = z; buf[o + 3] = 1;
      buf[o + 4] = 0; buf[o + 5] = 0; buf[o + 6] = 0; buf[o + 7] = 1; buf[o + 8] = 0; buf[o + 9] = 0; buf[o + 10] = 0; buf[o + 11] = 0; n++;
      if (b % 6 === 0) FR.lightsPush(fr, [x, y + 4, z], [0.25, 0.55, 0.65], 12, 0.6);
    }
  });
  fr.inst.push({ mesh: A.energyBlock, data: buf, count: n });
  // lights: units, aperture, girders
  for (const un of c.units) FR.lightsPush(fr, [un.s * 30, 36, un.z], [0.25, 0.55, 0.65], 26, 1.5);
  FR.lightsPush(fr, [0, 42, c.endZ - 10], [4, 7, 8], 90, 6);
  FR.lightsPush(fr, [0, 42, c.endZ - 70], [0.8, 1.4, 1.6], 60, 3);
  FX.sprite([0, 42, c.endZ - 6], 110, [0.4, 0.9, 1.1], 0.9, 0, 3);
  FX.sprite([0, 42, c.endZ - 6], 46, [1.2, 2, 2.4], 1, 0, 4);
  // slow motes in the gallery
  for (const m of FR.mote) {
    const p = [(m[0] - 0.5) * 100, 6 + m[1] * 70, (m[2] * 360 + t * 6 * (0.3 + m[3])) % 360];
    FX.sprite(p, 0.3 + m[3] * 0.3, [0.8, 1.6, 2.0], 0.12, 0, 0);
  }
};
