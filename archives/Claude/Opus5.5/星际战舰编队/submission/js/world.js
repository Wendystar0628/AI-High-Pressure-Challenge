'use strict';
// ---------------------------------------------------------------------------
// World: rock placements, fragment motion, weapon events (beam, pulse bolts,
// CIWS rounds, missiles), impact flashes, debris.  All deterministic in t.
// ---------------------------------------------------------------------------
const W = {};
const TREF = 55; // reference time for rock placement (fleet frame)

W.init = function () {
  const T = TL.T;
  W.flagMeta = A.flag.meta;
  W.flagM = M.trans(V.neg(A.flag.origin));
  // ---- ships
  W.ships = TL.ships.map((s) => Object.assign({}, s, { asset: s.type === 'G' ? A.guard : A.vanguard }));
  // ---- craft
  W.craft = TL.craftDefs(W.flagMeta.hangar);
  // ---- rocks
  W.rocks = [];
  const addRock = (id, asset, p, o) => {
    const r = U.rng(id.length * 131 + Math.round(p[0] + p[1] * 3 + p[2] * 7));
    const rock = Object.assign({ id, asset, p55: p, q0: Q.euler(r() * 6.28, r() * 3 - 1.5, r() * 6.28), axis: V.norm([r() - 0.5, r() - 0.5, r() - 0.5]), w: (0.01 + r() * 0.04) * (r() > 0.5 ? 1 : -1) }, o || {});
    if (asset.fractured) { rock.w = 0; rock.q0 = Q.ident(); }
    W.rocks.push(rock); return rock;
  };
  const RA = addRock('A', A.target.A, [0, 6, 1520]);
  const RB = addRock('B', A.target.B, [340, 172, 1400]);
  const RC1 = addRock('C1', A.target.C1, [-440, -70, 1190]);
  const RC2 = addRock('C2', A.target.C2, [470, -95, 1140]);
  const RE = addRock('E', A.target.E, [-560, 150, 1660]);
  W.target = { A: RA, B: RB, C1: RC1, C2: RC2, E: RE };
  // scenery: outside the fleet tube so the passing fleet never meets them
  const sr = U.rng(808);
  const scen = A.scenery;
  const place = [
    [0, 1450, 120, 2000], [1, -1350, -220, 2300], [2, 1150, 560, 2650], [3, -1100, 600, 2150], [4, 1700, -380, 1450], [5, -1750, 240, 1550],
    [6, 1250, -560, 2900], [7, -1500, -520, 2700], [2, -2100, 80, 3100], [1, 2200, 300, 3300], [4, 600, 900, 3000], [3, -500, -900, 2600],
  ];
  for (const [k, x, y, z] of place) addRock('s' + k, scen[k], [x, y, z]);
  for (let i = 0; i < 44; i++) {
    let x, y; do { x = (sr() * 2 - 1) * 2600; y = (sr() * 2 - 1) * 1100; } while (Math.abs(x) < 1150 && Math.abs(y) < 520);
    const z = 900 + sr() * 3200; const k = 7 + Math.floor(sr() * 6);
    addRock('p' + i, scen[k], [x, y, z]);
  }
  // pebbles close to targets for parallax (small, will be shoved aside by shields if needed)
  W.rocks.forEach((r) => { r.isTarget = !!r.asset.fractured; });
  setupTargets();
  buildEvents();
  // free target grids
  for (const k in A.target) A.target[k].grid = null;
};

// rock frame (center fleet pos, orientation) at rock-time tt
W.rockFrame = function (rk, tt) {
  const q = rk.w ? Q.mul(Q.axis(rk.axis, rk.w * (tt - TREF)), rk.q0) : rk.q0;
  return { c: [rk.p55[0], rk.p55[1], rk.p55[2] - (TL.s(tt) - TL.s(TREF))], q };
};
// local rock point (relative to center) -> fleet frame at rock-time tt, assuming unbroken
W.rockPoint = function (rk, lp, tt) { const f = W.rockFrame(rk, tt); return V.add(f.c, Q.rot(f.q, lp)); };

// ray cast into a target grid: from outside along dir (local) toward center offset; returns local hit point
function rayHit(asset, from, dir) {
  const g = asset.grid, C = asset.origin[0];
  let p = from.slice(); const d = V.norm(dir);
  for (let i = 0; i < 4000; i++) {
    const x = Math.floor(p[0] + C), y = Math.floor(p[1] + C), z = Math.floor(p[2] + C);
    if (g.get(x, y, z)) return p;
    p = V.madd(p, d, 0.5);
  }
  return V.scale(V.norm(dir), -asset.R * 0.5);
}

// per-target fragment dynamics
function setupTargets() {
  const T = W.target;
  const rnd = U.rng(9090);
  const prep = (rk, breakT, opt) => {
    rk.breakT = breakT;
    rk.frags = rk.asset.frags.map((f, k) => {
      let dir = V.norm(V.add(f.c, [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5].map((x) => x * rk.asset.R * 0.3)));
      if (opt.bias) dir = V.norm([dir[0] * opt.bias[0], dir[1] * opt.bias[1], dir[2] * opt.bias[2]]);
      const small = f.n < 2500;
      const sp = (small ? opt.vSmall : opt.vBig) * (0.7 + rnd() * 0.6);
      const vel = V.add(V.scale(dir, sp), opt.push || [0, 0, 0]);
      return { dir: V.norm(f.c), vel, axis: V.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), w: (small ? 0.9 : 0.25) * (0.5 + rnd()) * (rnd() > 0.5 ? 1 : -1), brk: breakT, open: opt.open || 1.6 };
    });
  };
  prep(T.A, TL.aBreak, { vBig: 42, vSmall: 60, push: [0, 0, 12], bias: [0.8, 1.5, 0.6] });
  prep(T.B, TL.bBreak, { vBig: 40, vSmall: 62, push: [6, 4, 8], bias: [1.3, 1.2, 0.7] });
  prep(T.C1, TL.c1Break, { vBig: 45, vSmall: 70, push: [-10, 0, 0] });
  prep(T.C2, TL.c2Break, { vBig: 45, vSmall: 70, push: [10, 0, 0] });
  prep(T.E, TL.eBreak, { vBig: 40, vSmall: 60, push: [-10, 6, 10], bias: [1.4, 1.3, 0.6] });
  // beam impact point on A (facing the fleet)
  T.A.hitL = rayHit(T.A.asset, [0, -6, -T.A.asset.R * 1.8], [0, 0, 1]);
}

// fragment model state (center, rotation) at rock-time tt
W.fragState = function (rk, k, tt) {
  const f = rk.frags[k], af = rk.asset.frags[k];
  const brk = f.brk;
  const open = W.crackOpen(rk, Math.min(tt, brk)) * f.open;
  const lp = V.madd(af.c, f.dir, open);
  if (tt < brk) { const fr = W.rockFrame(rk, tt); return { c: V.add(fr.c, Q.rot(fr.q, lp)), q: fr.q, live: true }; }
  const fb = W.rockFrame(rk, brk);
  const tau = tt - brk; const s = 0.6 * tau + 1.5 * (1 - Math.exp(-tau / 1.5));
  const fr = W.rockFrame(rk, tt);
  const c = V.add(V.add(V.add(fb.c, Q.rot(fb.q, lp)), [0, 0, fr.c[2] - fb.c[2]]), V.scale(f.vel, s));
  const ang = f.w * (0.7 * tau + 1.2 * (1 - Math.exp(-tau / 1.2)));
  return { c, q: Q.mul(Q.axis(f.axis, ang), fb.q), live: true, tau };
};
// crack opening amount 0..1 before the break
W.crackOpen = function (rk, tt) {
  switch (rk.id) {
    case 'A': return U.smooth(TL.aCrack[0] + 0.8, TL.aBreak, tt);
    case 'E': return U.smooth(TL.eBreak - 1.0, TL.eBreak, tt);
    case 'B': return U.smooth(TL.bBreak - 1.2, TL.bBreak, tt);
    default: return U.smooth(-0.5, 0, tt - (rk.id === 'C1' ? TL.c1Break : TL.c2Break));
  }
};

// ---------------------------------------------------------------------------
// weapon events
function buildEvents() {
  const T = W.target; const meta = W.flagMeta;
  const rnd = U.rng(31337);
  W.bolts = []; W.rounds = []; W.missiles = []; W.flashes = []; W.debris = []; W.sparks = [];
  const flash = (t0, p, size, col, kind, dur) => W.flashes.push({ t0, pw: [p[0], p[1], p[2] + TL.s(t0)], size, col, kind, dur });
  const debris = (t0, p, n, spd, heat, spread) => {
    for (let i = 0; i < n; i++) {
      const d = V.norm([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
      const v = V.add(V.scale(d, spd * (0.3 + rnd() * 0.9)), spread || [0, 0, 0]);
      W.debris.push({ t0, pw: [p[0] + d[0] * 2, p[1] + d[1] * 2, p[2] + d[2] * 2 + TL.s(t0)], v, axis: V.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), w: (rnd() - 0.5) * 8, heat: heat * (0.5 + rnd() * 0.5), shape: rnd() < 0.55 ? 0 : rnd() < 0.7 ? 1 : 2, mat: rnd() < 0.5 ? MAT.ROCK : rnd() < 0.5 ? MAT.ROCK_D : MAT.ROCK_L, seed: rnd() * 100 });
    }
  };
  const sparks = (t0, p, n, spd, col, dirBias) => {
    for (let i = 0; i < n; i++) {
      let d = V.norm([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
      if (dirBias) d = V.norm(V.add(d, dirBias));
      W.sparks.push({ t0, pw: [p[0], p[1], p[2] + TL.s(t0)], v: V.scale(d, spd * (0.4 + rnd() * 0.8)), life: 0.5 + rnd() * 0.9, col });
    }
  };
  W._flash = flash; W._debris = debris; W._sparks = sparks;

  // ---- BEAM on A
  const hitA = (t) => W.rockPoint(T.A, T.A.hitL, t);
  for (let t = TL.aHeat; t < TL.aBreak; t += 0.12) { sparks(t, hitA(t), 6, 140, [3, 1.6, 0.6], [0, 0, -1.2]); if (Math.round(t / 0.12) % 3 === 0) debris(t, hitA(t), 4, 50, 1, [0, 0, -15]); }
  flash(TL.aHeat, hitA(TL.aHeat), 90, [6, 5, 4], 'flare', 1.2);
  // break of A
  const aC = W.rockFrame(T.A, TL.aBreak).c;
  flash(TL.aBreak, aC, 170, [3.2, 1.6, 0.6], 'boom', 2.6);
  flash(TL.aBreak, aC, 240, [1.8, 1.3, 0.85], 'ring', 2.2);
  flash(TL.aBreak + 0.1, aC, 190, [1, 1, 1], 'smoke', 9);
  for (let i = 0; i < 6; i++) { const o = V.scale(V.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), 70); flash(TL.aBreak + 0.15 + i * 0.14, V.add(aC, o), 60, [3, 1.5, 0.6], 'boom', 1.6); }
  debris(TL.aBreak, aC, 420, 75, 1, [0, 0, 10]);
  sparks(TL.aBreak, aC, 90, 260, [4, 2.2, 0.9]);

  // ---- PULSE turrets on B
  const turrets = meta.turretMounts.map((m, i) => ({ i, p: m.p, side: m.side })).filter((m) => m.side > 0);
  W.turretFire = meta.turretMounts.map(() => []);
  const chips = T.B.asset.frags.map((f, k) => ({ f, k })).filter((o) => o.f.chip);
  chips.sort((a, b) => a.f.c[0] - b.f.c[0]);
  const tlist = [];
  turrets.forEach((tu, j) => {
    for (let gI = 0; gI < 6; gI++) {
      const tg = TL.pulse[0] + gI * 0.82 + (j % 2) * 0.41 + (j * 0.053) % 0.12;
      for (let b = 0; b < 3; b++) tlist.push({ t: tg + b * 0.1, tu, barrel: b % 2 });
    }
  });
  tlist.sort((a, b) => a.t - b.t);
  const nChip = chips.length; const perChip = Math.ceil(tlist.length / (nChip + 2));
  const chipBreak = new Array(T.B.frags.length).fill(TL.bBreak);
  tlist.forEach((ev, n) => {
    const ci = Math.min(nChip - 1, Math.floor(n / perChip));
    const chip = chips[ci];
    const aimL = V.add(chip.f.c, [(rnd() - 0.5) * 6, (rnd() - 0.5) * 6, (rnd() - 0.5) * 6]);
    const mount = W.turretMountFleet(ev.tu.i);
    // impact point = surface along line from mount to aim
    let tHit = ev.t + 1.1;
    for (let it = 0; it < 2; it++) { const tp = W.rockPoint(T.B, aimL, tHit); tHit = ev.t + V.dist(tp, mount) / 1150; }
    const fr = W.rockFrame(T.B, tHit);
    const dirL = Q.rot([-fr.q[0], -fr.q[1], -fr.q[2], fr.q[3]], V.norm(V.sub(mount, fr.c)));
    const hitL = rayHit(T.B.asset, V.add(aimL, V.scale(dirL, T.B.asset.R * 1.5)), V.neg(dirL));
    const ev2 = { t0: ev.t, tHit, tu: ev.tu.i, barrel: ev.barrel, hitL, chip: chip.k };
    W.bolts.push(ev2); W.turretFire[ev.tu.i].push(ev.t);
    if (n % perChip === perChip - 1 || n === tlist.length - 1) chipBreak[chip.k] = Math.min(chipBreak[chip.k], tHit + 0.05);
  });
  chips.forEach((c) => { T.B.frags[c.k].brk = Math.min(chipBreak[c.k], TL.bBreak); T.B.frags[c.k].vel = V.add(T.B.frags[c.k].vel, V.scale(V.norm(T.B.asset.frags[c.k].c), 30)); });
  W.bolts.forEach((b) => {
    const p = W.rockPoint(T.B, b.hitL, b.tHit);
    flash(b.tHit, p, 22, [2.6, 2, 1.4], 'flare', 0.35);
    flash(b.tHit, p, 16, [3, 1.5, 0.6], 'boom', 0.8);
    sparks(b.tHit, p, 7, 120, [3, 1.8, 0.8]);
    debris(b.tHit, p, 6, 45, 1, [0, 0, -6]);
  });
  chips.forEach((c) => { const p = W.rockPoint(T.B, T.B.asset.frags[c.k].c, T.B.frags[c.k].brk); flash(T.B.frags[c.k].brk, p, 34, [1, 1, 1], 'smoke', 5); debris(T.B.frags[c.k].brk, p, 25, 50, 0.8); });
  const bC = W.rockFrame(T.B, TL.bBreak).c;
  flash(TL.bBreak, bC, 110, [3, 1.5, 0.6], 'boom', 2.2); flash(TL.bBreak, bC, 170, [2.4, 1.8, 1.1], 'ring', 1.8);
  flash(TL.bBreak + 0.1, bC, 120, [1, 1, 1], 'smoke', 8);
  debris(TL.bBreak, bC, 260, 70, 1);

  // ---- CIWS from guards
  W.ciwsFire = W.ships.map(() => []);
  const ciwsVolley = (shipIdx, mounts, t0, t1, target, breakT, spread) => {
    const sh = W.ships[shipIdx];
    mounts.forEach((mi, mj) => {
      let t = t0 + mj * 0.13 + rnd() * 0.1; let burst = 0;
      while (t < t1) {
        const bEnd = t + 0.8 + rnd() * 0.4;
        for (; t < bEnd && t < t1; t += 0.042) {
          const st = TL.shipState(sh, t);
          const mp = V.add(st.pos, Q.rot(st.q, sh.asset.meta.mounts[mi]));
          // aim: target rock (center or later fragments)
          let aim;
          const rk = target;
          const useFrag = t > breakT - 0.3;
          if (!useFrag) aim = V.add(W.rockFrame(rk, t + 0.6).c, [(rnd() - 0.5) * rk.asset.R * 1.2, (rnd() - 0.5) * rk.asset.R * 1.2, -rk.asset.R * 0.5]);
          else { const fk = Math.floor(rnd() * rk.frags.length); aim = W.fragState(rk, fk, t + 0.6).c; aim = V.add(aim, [(rnd() - 0.5) * spread, (rnd() - 0.5) * spread, (rnd() - 0.5) * spread]); }
          const dist = V.dist(aim, mp); const tHit = t + dist / 1700;
          W.rounds.push({ t0: t, tHit, p0: mp, p1: aim, ship: shipIdx, mount: mi, hit: !useFrag || rnd() < 0.35 });
          W.ciwsFire[shipIdx].push(t);
        }
        t = bEnd + 0.28 + rnd() * 0.2; burst++;
      }
    });
  };
  const sIdx = (x, y, z) => W.ships.findIndex((s) => s.slot[0] === x && s.slot[1] === y && s.slot[2] === z);
  ciwsVolley(sIdx(430, 30, 170), [0, 2, 4], TL.ciwsS[0], TL.ciwsS[1], T.C2, TL.c2Break, 30);
  ciwsVolley(sIdx(270, 245, -40), [0, 2, 4], TL.ciwsS[0] + 0.3, TL.ciwsS[1], T.C2, TL.c2Break, 30);
  ciwsVolley(sIdx(250, -250, 280), [0, 2, 5], TL.ciwsS[0] + 0.6, TL.ciwsS[1] - 0.4, T.C2, TL.c2Break, 30);
  ciwsVolley(sIdx(-430, 30, 170), [1, 3, 4], TL.ciwsP[0], TL.ciwsP[1], T.C1, TL.c1Break, 30);
  ciwsVolley(sIdx(-270, 245, -40), [1, 3, 4], TL.ciwsP[0] + 0.25, TL.ciwsP[1], T.C1, TL.c1Break, 30);
  ciwsVolley(sIdx(-250, -250, 280), [1, 3, 5], TL.ciwsP[0] + 0.5, TL.ciwsP[1] - 0.3, T.C1, TL.c1Break, 30);
  W.rounds.forEach((r, i) => {
    if (!r.hit) return;
    if (i % 2 === 0) flash(r.tHit, r.p1, 12, [5, 3, 1.2], 'flare', 0.25);
    if (i % 3 === 0) sparks(r.tHit, r.p1, 3, 90, [3, 1.8, 0.7]);
    if (i % 5 === 0) debris(r.tHit, r.p1, 1, 40, 0.8);
  });
  for (const [rk, bt] of [[T.C1, TL.c1Break], [T.C2, TL.c2Break]]) {
    const c = W.rockFrame(rk, bt).c;
    flash(bt, c, 50, [3.5, 1.8, 0.7], 'boom', 1.4); flash(bt, c, 60, [2, 1.6, 1.1], 'ring', 1.2); flash(bt + 0.05, c, 50, [1, 1, 1], 'smoke', 6);
    debris(bt, c, 110, 60, 1); sparks(bt, c, 40, 180, [4, 2.2, 0.9]);
  }

  // ---- MISSILES from port vanguards on E
  const shooters = [sIdx(-500, 50, 1140), sIdx(-330, 190, 1330), sIdx(-230, -40, 960), sIdx(-720, -70, 1000)];
  const eHits = [];
  for (let i = 0; i < 20; i++) eHits.push([(i % 5 - 2) * 0.22, (Math.floor(i / 5) - 1.5) * 0.24]);
  let mi = 0;
  shooters.forEach((si, j) => {
    const sh = W.ships[si]; const slots = sh.asset.meta.slots.filter((p) => p[0] < 0);
    for (let m = 0; m < 5; m++) {
      const tl = TL.missile[0] + j * 0.25 + m * 0.17 + rnd() * 0.04;
      const st = TL.shipState(sh, tl);
      const slot = slots[(m * 3 + j) % slots.length];
      const p0 = V.add(st.pos, Q.rot(st.q, slot));
      const flight = 1.6 + rnd() * 0.35 + (3 - j) * 0.05;
      const tHit = tl + 0.35 + flight;
      // impact point on E's face toward the shooters
      const fr = W.rockFrame(T.E, tHit);
      const toShip = V.norm(V.sub(p0, fr.c));
      const qi = [-fr.q[0], -fr.q[1], -fr.q[2], fr.q[3]];
      const dL = Q.rot(qi, toShip);
      const tg = V.norm(V.cross(dL, [0, 1, 0])), bt = V.cross(tg, dL);
      const off = eHits[mi % 20];
      const from = V.add(V.scale(dL, T.E.asset.R * 1.8), V.add(V.scale(tg, off[0] * T.E.asset.R), V.scale(bt, off[1] * T.E.asset.R)));
      const hitL = rayHit(T.E.asset, from, V.neg(dL));
      const p3 = W.rockPoint(T.E, hitL, tHit);
      const up = Q.rot(st.q, [0, 1, 0]);
      const pe = V.add(p0, V.scale(up, 12));
      const side = V.norm([p3[0] - p0[0], 0, p3[2] - p0[2]]);
      const p1 = V.add(pe, V.add(V.scale(up, 110 + rnd() * 90), V.add(V.scale(side, 90 + rnd() * 90), [(rnd() - 0.5) * 120, 0, 0])));
      const p2 = V.add(p3, V.add(V.scale(V.norm(V.sub(pe, p3)), 260), [(rnd() - 0.5) * 220, 90 + rnd() * 140, (rnd() - 0.5) * 120]));
      W.missiles.push({ tl, tIgn: tl + 0.35, tHit, p0, pe, p1, p2, p3, ship: si, seed: rnd() * 100 });
      mi++;
    }
  });
  W.missiles.forEach((m) => {
    flash(m.tHit, m.p3, 46, [2.6, 1.3, 0.5], 'boom', 1.4); flash(m.tHit, m.p3, 30, [3.2, 2.7, 2.2], 'flare', 0.4);
    flash(m.tHit, m.p3, 60, [1.0, 0.75, 0.5], 'ring', 0.9); flash(m.tHit + 0.1, m.p3, 40, [1, 1, 1], 'smoke', 6);
    sparks(m.tHit, m.p3, 16, 160, [4, 2.2, 0.9]); debris(m.tHit, m.p3, 22, 55, 1);
  });
  const lastHit = Math.max(...W.missiles.map((m) => m.tHit));
  TL.eBreak = Math.max(TL.eBreak, lastHit + 0.6);
  T.E.frags.forEach((f) => { f.brk = TL.eBreak; });
  T.E.breakT = TL.eBreak;
  const eC = W.rockFrame(T.E, TL.eBreak).c;
  flash(TL.eBreak, eC, 150, [3.2, 1.6, 0.6], 'boom', 2.6); flash(TL.eBreak, eC, 220, [1.6, 1.2, 0.8], 'ring', 2.0);
  flash(TL.eBreak + 0.1, eC, 170, [1, 1, 1], 'smoke', 9);
  for (let i = 0; i < 5; i++) flash(TL.eBreak + 0.1 + i * 0.15, V.add(eC, V.scale(V.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), 60)), 55, [3, 1.5, 0.6], 'boom', 1.5);
  debris(TL.eBreak, eC, 380, 70, 1, [-6, 4, 8]);
  sparks(TL.eBreak, eC, 80, 240, [4, 2.2, 0.9]);
  // sort for quick range queries
  W.flashes.sort((a, b) => a.t0 - b.t0); W.sparks.sort((a, b) => a.t0 - b.t0);
}

// pulse turret mount -> fleet frame (flagship fixed at origin)
W.turretMountFleet = function (i) { return W.flagMeta.turretMounts[i].p; };

// missile position at time t (fleet frame) and velocity dir
W.missilePos = function (m, t) {
  if (t < m.tIgn) { const k = (t - m.tl) / (m.tIgn - m.tl); return { p: V.lerp(m.p0, m.pe, U.smooth(0, 1, k)), d: V.norm(V.sub(m.pe, m.p0)), ign: false }; }
  const u0 = U.clamp((t - m.tIgn) / (m.tHit - m.tIgn), 0, 1);
  const u = Math.pow(u0, 1.5);
  const b = (u) => { const a = 1 - u; return [0, 1, 2].map((j) => a * a * a * m.pe[j] + 3 * a * a * u * m.p1[j] + 3 * a * u * u * m.p2[j] + u * u * u * m.p3[j]); };
  const p = b(u), p2 = b(Math.min(1, u + 0.01));
  return { p, d: V.norm(V.sub(p2, p)), ign: true, u: u0 };
};
