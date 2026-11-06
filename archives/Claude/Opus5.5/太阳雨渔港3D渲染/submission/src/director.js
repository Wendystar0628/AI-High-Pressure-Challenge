import { U, smooth } from './core/G.js';

const WDIR = [-0.72, 0.69];

/**
 * Orchestrates the slow, layered dynamics: at most one noticeable event at a time.
 */
export class Director {
  constructor({ harbor, gulls, cat, distant }) {
    this.h = harbor; this.gulls = gulls; this.cat = cat; this.distant = distant;
    this.cur = null;
    this.nextAt = 4;
    this.last = '';
    this.lastTime = { boat: -60, lull: -40, dark: -120, gust: -99, cloud: -99 };
    this.rain = 0.6;
    this.rainOverride = null;
    this.nextGull = 8;
    this.nextSkim = 20;
    this.nextDistant = 30;
    this.queue = ['gust', 'boat', 'lull', 'cloud', 'dark', 'gust', 'cloud', 'boat', 'lull'];
  }
  pick(now) {
    if (this.queue.length) return this.queue.shift();
    const opts = [];
    const since = (k) => now - (this.lastTime[k] ?? -999);
    if (this.last !== 'gust') opts.push(['gust', 3]);
    if (this.last !== 'cloud') opts.push(['cloud', 3]);
    if (since('boat') > 110) opts.push(['boat', 4]);
    if (since('lull') > 120) opts.push(['lull', 4]);
    if (since('dark') > 260) opts.push(['dark', 2]);
    let tot = opts.reduce((a, o) => a + o[1], 0), r = Math.random() * tot;
    for (const o of opts) { if ((r -= o[1]) <= 0) return o[0]; }
    return 'gust';
  }
  start(kind, now) {
    this.cur = { kind, t0: now, stage: 0 };
    this.last = kind;
    this.lastTime[kind] = now;
    if (kind === 'boat') {
      if (!this.h.startDeparture(now)) this.cur = null;
    }
    if (kind === 'cloud') {
      const side = Math.random() > 0.5 ? 1 : -1;
      const perp = [WDIR[1] * side, -WDIR[0] * side];
      const off = (Math.random() - 0.5) * 16;
      this.cur.from = [-WDIR[0] * 48 + perp[0] * off, -WDIR[1] * 48 + perp[1] * off];
      this.cur.dir = [WDIR[0], WDIR[1]];
      this.cur.speed = 3.2;
      this.cur.radius = 12 + Math.random() * 5;
    }
  }
  update(now, dt) {
    // baseline rain undulation
    let rainBase = 0.6 + 0.16 * Math.sin(now * 0.045) + 0.07 * Math.sin(now * 0.11 + 1.3);
    let rainTarget = rainBase;
    let rainbow = 0;
    let gustFront = -200, gustStr = 0;
    let cloud = [999, 999, 10, 0];
    let sunVis = 1, lighthouse = 0;

    if (!this.cur && now > this.nextAt) this.start(this.pick(now), now);
    const c = this.cur;
    if (c) {
      const el = now - c.t0;
      let done = false;
      switch (c.kind) {
        case 'gust': {
          gustFront = -40 + el * 7.5;
          gustStr = smooth(0, 1.5, el) * (1 - smooth(13, 17, el)) * 1.05;
          rainTarget = rainBase + 0.08;
          if (el > 18) done = true;
          break;
        }
        case 'cloud': {
          const d = el * c.speed;
          cloud = [c.from[0] + c.dir[0] * d, c.from[1] + c.dir[1] * d, c.radius, 0.88];
          if (d > 96) done = true;
          break;
        }
        case 'boat': {
          if (!this.h.busy()) done = true;
          break;
        }
        case 'dark': {
          const k = smooth(0, 4, el) * (1 - smooth(13, 18, el));
          sunVis = 1 - 0.42 * k;
          cloud = [0, 0, 70, 0.45 * k];
          lighthouse = smooth(3.5, 5.5, el) * (1 - smooth(12, 14.5, el));
          rainTarget = rainBase + 0.12 * k;
          if (el > 19) done = true;
          break;
        }
        case 'lull': {
          // rain eases -> faint rainbow -> the cat strolls -> cat hurries home -> rain thickens
          if (c.stage === 0) {
            rainTarget = 0.14;
            rainbow = smooth(6, 12, el) * (1 - smooth(20, 27, el));
            if (el > 22) { this.cat.goOut(now); c.stage = 1; c.tCat = now; }
          } else if (c.stage === 1) {
            rainTarget = 0.16;
            rainbow = 1 - smooth(20, 27, el);
            const walkT = now - c.tCat;
            if (walkT > 30 || (this.cat.state !== 'walk' && walkT > 3)) { this.cat.goHome(); c.stage = 2; c.tHome = now; }
          } else if (c.stage === 2) {
            rainTarget = 0.2;
            if (this.cat.state === 'hide' || now - c.tHome > 20) { c.stage = 3; c.tRain = now; }
          } else if (c.stage === 3) {
            const k = now - c.tRain;
            rainTarget = 0.98;
            if (k > 14) done = true;
          }
          break;
        }
      }
      if (done) { this.cur = null; this.nextAt = now + 3 + Math.random() * 4; }
    }
    // smooth rain
    const rate = rainTarget < this.rain ? 0.35 : 0.22;
    this.rain += (rainTarget - this.rain) * Math.min(1, dt * rate);
    U.uRain.value = this.rain;
    U.uRainbow.value += (rainbow - U.uRainbow.value) * Math.min(1, dt * 0.8);
    U.uGust.value.set(WDIR[0], WDIR[1], gustFront, gustStr);
    U.uCloudA.value.set(cloud[0], cloud[1], cloud[2], cloud[3]);
    U.uSunVis.value += (sunVis - U.uSunVis.value) * Math.min(1, dt * 2);
    U.uLighthouse.value += (lighthouse - U.uLighthouse.value) * Math.min(1, dt * 2.5);
    U.uWindBase.value = 0.22 + 0.06 * Math.sin(now * 0.13);

    // the cat never stays out when the rain thickens (outside of a lull)
    if (this.cat.state === 'walk' && this.rain > 0.42 && !(c && c.kind === 'lull')) this.cat.goHome();
    // minor, overlapping-safe background life
    if (now > this.nextGull) { this.gulls.requestLanding(now, this.h.boats); this.nextGull = now + 9 + Math.random() * 14; }
    if (now > this.nextSkim) { this.gulls.requestSkim(now); this.nextSkim = now + 25 + Math.random() * 25; }
    if (now > this.nextDistant && !this.distant.active && !(c && c.kind === 'boat')) { this.distant.start(now); this.nextDistant = now + 90 + Math.random() * 60; }
  }
  // debug helpers
  force(kind, now) { this.cur = null; this.start(kind, now); }
}
