// 无界面自动对局：node tools/sim_bot.js [map] [--none] 用脚本化布防检查难度曲线
const path = require('path');
for (const f of ['data', 'maps', 'sim']) require(path.join(__dirname, '..', 'js', f + '.js'));
const TD = globalThis.TD;

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
  return best;
}

const PLANS = {
  intranet: [
    ['interceptor', 12, 8], ['firewall', 11, 8], ['sandbox', 12, 10], ['interceptor', 14, 8], ['repair', 13, 8],
    ['interceptor', 10, 12], ['honeypot', 13, 9], ['sandbox', 10, 10], ['up', 11, 8], ['interceptor', 8, 10],
    ['interceptor', 12, 12], ['firewall', 15, 7], ['up', 12, 10], ['sandbox', 14, 10], ['interceptor', 16, 8],
    ['repair', 9, 10], ['up', 13, 8], ['interceptor', 10, 13], ['sandbox', 12, 13], ['firewall', 11, 12], ['interceptor', 14, 12],
    ['br', 12, 8, 'pierce'], ['br', 14, 8, 'suppress'], ['up', 10, 10], ['interceptor', 8, 13], ['interceptor', 13, 13],
  ],
  backbone: [
    ['interceptor', 6, 6], ['firewall', 5, 4], ['interceptor', 21, 11], ['sandbox', 19, 7], ['firewall', 20, 12],
    ['interceptor', 6, 11], ['sandbox', 6, 7], ['repair', 7, 6], ['interceptor', 21, 7], ['sandbox', 21, 6], ['up', 5, 4], ['up', 20, 12],
    ['interceptor', 8, 11], ['repair', 22, 11], ['interceptor', 19, 6], ['up', 19, 7], ['up', 6, 7], ['interceptor', 23, 11], ['sandbox', 8, 13],
    ['interceptor', 22, 7], ['firewall', 23, 12], ['interceptor', 6, 13], ['sandbox', 22, 13], ['br', 6, 6, 'pierce'], ['br', 21, 11, 'suppress'], ['interceptor', 9, 13], ['interceptor', 19, 11],
  ],
  airgap: [
    ['interceptor', 7, 5], ['firewall', 8, 9], ['interceptor', 22, 5], ['sandbox', 7, 7], ['firewall', 21, 9],
    ['interceptor', 22, 10], ['sandbox', 22, 4], ['repair', 7, 6], ['repair', 22, 11], ['interceptor', 7, 11], ['up', 8, 9], ['up', 21, 9],
    ['sandbox', 13, 14], ['interceptor', 14, 14], ['interceptor', 16, 15], ['up', 7, 7], ['up', 22, 4], ['interceptor', 9, 12], ['interceptor', 20, 12],
    ['sandbox', 15, 15], ['firewall', 14, 13], ['interceptor', 23, 12], ['interceptor', 7, 13], ['br', 7, 5, 'suppress'], ['br', 22, 5, 'pierce'], ['interceptor', 17, 12], ['interceptor', 12, 12],
  ],
};

function run(id, plan, opt) {
  opt = opt || {};
  const g = new TD.Game(id, { seed: 777 });
  let i = 0, lost = 0;
  const log = [];
  const dt = 1 / 30;
  let lastWave = -1;
  while (!g.over && g.time < 3600) {
    g.update(dt);
    // 在预算内依次执行布防
    while (plan && i < plan.length) {
      const [kind, x, y, br] = plan[i];
      let done = false;
      if (kind === 'up' || kind === 'br') {
        const t = g.towerAt[g.idx(x, y)];
        if (!t) { i++; continue; }
        const c = g.upgradeCost(t, br);
        if (!c) { i++; continue; }
        if (g.compute >= c.cost && g.intel >= c.intel) { g.upgrade(t, br); done = true; }
      } else {
        const d = TD.TOWERS[kind];
        const chk = g.checkPlace(kind, x, y);
        if (!chk.ok && !chk.lack) { console.log('  布防失败', kind, x, y, chk.reason); i++; continue; }
        if (chk.ok) { g.placeTower(kind, x, y, d.arc ? bestDir(g, x, y, d.range, d.arc) : 0); done = true; }
      }
      if (!done) break;
      i++;
    }
    // 自动重建被毁的塔
    if (opt.skills) {
      for (const t of g.towers) {
        if (t.type === 'repair' && t.skillCd <= 0 && t.encT <= 0) {
          if (g.towers.some(o => o.encT > 0 && Math.hypot(o.x - t.x, o.y - t.y) <= t.s.range)) g.useSkill(t);
        }
        if (t.type === 'firewall' && t.skillCd <= 0 && t.blocked.length >= 2 && t.encT <= 0) g.useSkill(t);
      }
    }
    if (g.waveIdx !== lastWave) {
      lastWave = g.waveIdx;
      log.push(`W${g.waveIdx + 1}@${Math.round(g.time)}s int=${g.integrity} c=${Math.round(g.compute)} i=${Math.round(g.intel)} t=${g.towers.length}`);
    }
    g.events.length = 0;
  }
  return { result: g.over, integrity: g.integrity, wave: g.waveIdx + 1, time: Math.round(g.time), built: g.stats.built, lost: g.stats.lost, leaks: g.stats.leaks, kills: Object.values(g.stats.kills).reduce((a, b) => a + b, 0), plan: i, log, reroutes: g.stats.reroutes };
}

const maps = process.argv[2] && process.argv[2][0] !== '-' ? [process.argv[2]] : TD.MAP_ORDER;
for (const id of maps) {
  const none = run(id, null);
  console.log(`\n=== ${id} 不设防：${none.result} 第 ${none.wave} 波，用时 ${none.time}s`);
  const r = run(id, PLANS[id], { skills: true });
  console.log(`=== ${id} 脚本布防：${r.result} 完整度 ${r.integrity} 到达第 ${r.wave} 波，用时 ${r.time}s，部署 ${r.built} 损毁 ${r.lost} 消灭 ${r.kills} 计划 ${r.plan}/${PLANS[id].length}`);
  console.log(r.log.join('\n'));
}
