// 贪心机器人：持续把算力花在路线覆盖最好的平台上，近似一个认真玩的玩家。node tools/sim_greedy.js
const path = require('path');
for (const f of ['data', 'maps', 'sim']) require(path.join(__dirname, '..', 'js', f + '.js'));
const TD = globalThis.TD;
const TT = TD.TT;

function bestDir(g, x, y, range, arc) {
  const half = arc * Math.PI / 360, pts = [];
  for (const k in g.routes) for (const i of g.routes[k].path) {
    const dx = i % g.map.w - x, dy = ((i / g.map.w) | 0) - y, d = Math.hypot(dx, dy);
    if (d <= range && d > 0.5) pts.push(Math.atan2(dy, dx));
  }
  let best = 0, bn = -1;
  for (let a = 0; a < 16; a++) {
    const ang = a * Math.PI / 8;
    let n = 0;
    for (const p of pts) if (Math.abs(TD.angleDiff(p, ang)) <= half) n++;
    if (n > bn) { bn = n; best = ang; }
  }
  return { dir: best, n: bn };
}

function coverage(g, x, y, r) {
  const seen = new Set();
  for (const k in g.routes) for (const i of g.routes[k].path) {
    const dx = i % g.map.w - x, dy = ((i / g.map.w) | 0) - y;
    if (Math.hypot(dx, dy) <= r) seen.add(i);
  }
  return seen.size;
}

// 线路感知：找到当前火力覆盖最弱的线路，在能覆盖它最多格子的平台上补防
function routeCover(g, path) {
  let n = 0;
  for (const i of path) {
    const x = i % g.map.w, y = (i / g.map.w) | 0;
    for (const t of g.towers) {
      if (t.type !== 'interceptor' && t.type !== 'sandbox') continue;
      const dx = x - t.x, dy = y - t.y, d = Math.hypot(dx, dy);
      if (d > t.s.range) continue;
      if (t.type === 'interceptor' && d > 0.01 && Math.abs(TD.angleDiff(Math.atan2(dy, dx), t.dir)) > t.s.arc * Math.PI / 360) continue;
      n++;
    }
  }
  return n / Math.max(1, path.length);
}

function bestPlatform(g, r) {
  let weak = null, wv = 1e9;
  for (const k in g.routes) { const v = routeCover(g, g.routes[k].path); if (v < wv) { wv = v; weak = g.routes[k].path; } }
  const inPath = new Set(weak);
  let best = null, bs = -1;
  for (let y = 0; y < g.map.h; y++) for (let x = 0; x < g.map.w; x++) {
    const i = g.idx(x, y);
    if (g.map.tiles[i] !== TT.PLATFORM || g.towerAt[i]) continue;
    let c = 0;
    for (const j of inPath) { if (Math.hypot(j % g.map.w - x, ((j / g.map.w) | 0) - y) <= r) c++; }
    if (c > bs) { bs = c; best = { x, y }; }
  }
  return best;
}

function bestLink(g) {
  // 选一个多路线共用、尚未有塔的链路格
  const count = {};
  for (const k in g.routes) for (const i of g.routes[k].path) count[i] = (count[i] || 0) + 1;
  let best = null, bs = -1;
  for (const k in g.routes) {
    const p = g.routes[k].path;
    for (let n = Math.floor(p.length * 0.45); n < p.length - 2; n++) {
      const i = p[n];
      if (g.towerAt[i] || g.map.tiles[i] === TT.NODE) continue;
      let near = 0;
      for (const t of g.towers) if (t.cat === 'link' && Math.hypot(t.x - i % g.map.w, t.y - ((i / g.map.w) | 0)) < 3) near++;
      const s = count[i] * 3 + n * 0.1 - near * 5;
      if (s > bs) { bs = s; best = i; }
    }
  }
  return best == null ? null : { x: best % g.map.w, y: (best / g.map.w) | 0 };
}

function run(id, spend) {
  const g = new TD.Game(id, { seed: 2024 });
  const dt = 1 / 30;
  let step = 0, thinkT = 0;
  const order = ['interceptor', 'interceptor', 'firewall', 'sandbox', 'interceptor', 'repair', 'interceptor', 'firewall', 'sandbox', 'interceptor', 'repair'];
  let log = [], lastW = -1;
  while (!g.over && g.time < 3600) {
    g.update(dt);
    thinkT -= dt;
    if (thinkT <= 0) {
      thinkT = 1 / spend;
      // 优先升级
      const upg = g.towers.find(t => t.level === 1 && !t.ghostT && (t.def.lv2 ? g.compute >= t.def.lv2.cost + 120 : g.compute >= 190 && g.intel >= 16));
      const kind = order[step % order.length];
      const def = TD.TOWERS[kind];
      if (g.compute >= def.cost + 20) {
        if (kind === 'firewall') {
          const p = bestLink(g);
          if (p) { const r = g.placeTower(kind, p.x, p.y, 0); if (r.ok) step++; else step++; }
        } else {
          const p = bestPlatform(g, def.range);
          if (p) {
            const d = def.arc ? bestDir(g, p.x, p.y, def.range, def.arc).dir : 0;
            const r = g.placeTower(kind, p.x, p.y, d);
            if (r.ok) step++;
          }
        }
      } else if (upg && g.towers.length > 14) {
        const br = upg.def.branches ? Object.keys(upg.def.branches)[upg.id % 2] : undefined;
        g.upgrade(upg, br);
      }
      // 技能
      for (const t of g.towers) {
        if (t.skillCd > 0 || t.encT > 0 || t.ghostT > 0) continue;
        if (t.type === 'repair' && g.towers.some(o => o.encT > 0 && Math.hypot(o.x - t.x, o.y - t.y) <= t.s.range)) g.useSkill(t);
        if (t.type === 'firewall' && t.blocked.length >= 2) g.useSkill(t);
        if (t.type === 'interceptor' && t.attackTarget) g.useSkill(t);
        if (t.type === 'sandbox' && t.attackTarget && g.waveIdx > 3) g.useSkill(t);
      }
    }
    if (g.waveIdx !== lastW) { lastW = g.waveIdx; log.push(`W${g.waveIdx + 1}:${g.integrity}/${g.towers.length}`); }
    g.events.length = 0;
  }
  return { over: g.over, int: g.integrity, wave: g.waveIdx + 1, time: Math.round(g.time), built: g.stats.built, lost: g.stats.lost, kills: Object.values(g.stats.kills).reduce((a, b) => a + b, 0), log: log.join(' ') };
}

for (const id of TD.MAP_ORDER) {
  for (const spend of [0.35, 1, 3]) {
    const r = run(id, spend);
    console.log(`${id} 决策频率 ${spend}/秒：${r.over} 完整度 ${r.int} 第 ${r.wave} 波 用时 ${r.time}s 部署 ${r.built} 损毁 ${r.lost} 消灭 ${r.kills}`);
    if (spend === 1) console.log('   ' + r.log);
  }
}
