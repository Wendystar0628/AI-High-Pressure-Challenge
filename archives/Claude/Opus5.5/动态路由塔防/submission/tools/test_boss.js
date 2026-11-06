// Boss 压力测试：node tools/test_boss.js
// 随机隔离节点时反复触发黑洞与锁死，检查不会封死入口和场上敌人，且封锁确实改变路线
const path = require('path');
for (const f of ['data', 'maps', 'sim']) require(path.join(__dirname, '..', 'js', f + '.js'));
const TD = globalThis.TD;
let bad = 0;
const fail = (m) => { if (bad < 25) console.log('  !!', m); bad++; };

const CASES = [['intranet', 'wankui'], ['backbone', 'shenlou'], ['airgap', 'zheying']];
for (const [id, boss] of CASES) {
  for (let seed = 1; seed <= 4; seed++) {
    let s = seed * 733;
    const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const g = new TD.Game(id, { seed: seed * 17, demo: true });
    g.compute = 2e5; g.intel = 2e4;
    const ent = TD.MAPS[id].waves[TD.MAPS[id].waves.length - 1].groups.find(q => q[0] === boss)[2];
    const b = g.spawn(boss, ent);
    b.maxHp = b.hp = 1e7;
    b.speed *= 0.3;
    const dt = 1 / 30;
    const st = { warn: 0, hole: 0, surge: 0, swarm: 0, storm: 0, route: 0, phase: 0 };
    let t = 0;
    const last = new Map();
    let phaseStep = 0;
    while (t < 240 && !b.dead) {
      t += dt;
      g.integrity = 20;
      // 按时间推进 Boss 阶段
      if (t > 40 * (phaseStep + 1) && phaseStep < b.def.phases.length - 1) {
        phaseStep++;
        b.hp = b.maxHp * b.def.phases[phaseStep].at * 0.98;
      }
      if (R() < 0.03) {
        const en = g.map.entrances[(R() * g.map.entrances.length) | 0];
        g.spawn(['worm', 'flood', 'trojan', 'ransom', 'packer'][(R() * 5) | 0], en.id);
      }
      if (R() < 0.015) {
        const nd = g.nodes[(R() * g.nodes.length) | 0];
        if (nd.tower) g.sell(nd.tower);
        else if (!nd.isolator) g.placeTower(R() < 0.5 ? 'gate' : 'firewall', nd.x, nd.y);
      }
      if (R() < 0.01) { g.itemCd.isolator = 0; const nd = g.nodes[(R() * g.nodes.length) | 0]; g.useItem('isolator', nd.x, nd.y); }
      g.update(dt);
      for (const ev of g.events) {
        if (ev.type === 'bossWarn') st.warn++;
        if (ev.type === 'holeOpen') st.hole++;
        if (ev.type === 'bossSurge') st.surge++;
        if (ev.type === 'bossSwarm') st.swarm++;
        if (ev.type === 'bossStorm') st.storm++;
        if (ev.type === 'routeChange' && /黑洞|锁死/.test(ev.reason)) st.route++;
        if (ev.type === 'bossPhase') st.phase++;
      }
      g.events.length = 0;
      for (const en of g.map.entrances) if (g.dist[en.idx] >= TD.INF) fail(`${id} 入口 ${en.id} 被封死 t=${t.toFixed(1)}`);
      for (const e of g.enemies) {
        if (e.fly) continue;
        const p = last.get(e.id);
        if (p && Math.hypot(e.x - p.x, e.y - p.y) > e.speed * dt * 1.5 + 0.02) fail(`${id} ${e.type} 瞬移`);
        last.set(e.id, { x: e.x, y: e.y });
        const fi = g.idx(e.fx, e.fy), ti = g.idx(e.tx, e.ty);
        const bk = e.def.ownBlocks ? g.blockedB : g.blocked, ds = e.def.ownBlocks ? g.distB : g.dist;
        const okF = !bk[fi] && ds[fi] < TD.INF, okT = !bk[ti] && ds[ti] < TD.INF;
        if (!okF && !okT && !e.pathOv) fail(`${id} ${e.type} 无路 @(${e.x.toFixed(1)},${e.y.toFixed(1)}) t=${t.toFixed(1)}`);
      }
      // 防止场上敌人过多拖慢测试
      if (g.enemies.length > 60) for (const e of g.enemies.slice(0, 20)) if (e !== b) { e.dead = true; }
      g.enemies = g.enemies.filter(e => !e.dead);
    }
    console.log(`${id}/${boss} seed${seed}: 预警=${st.warn} 封锁=${st.hole} 改道=${st.route} 洪峰=${st.surge} 放怪=${st.swarm} 风暴=${st.storm} 换阶段=${st.phase} 终阶段=${b.phase}`);
    if (boss === 'wankui' && !st.surge) fail('万傀没有发动洪峰');
    if (boss === 'wankui' && !st.swarm) fail('万傀没有放蠕虫');
    if (boss === 'shenlou' && !st.hole) fail('蜃楼没有制造黑洞');
    if (boss === 'shenlou' && !st.storm) fail('蜃楼没有路由风暴');
    if (boss === 'zheying' && !st.hole) fail('蛰影没有锁死运维环');
    if (boss === 'zheying' && !st.swarm) fail('蛰影没有放木马');
    if (st.phase !== b.def.phases.length - 1) fail(`${boss} 阶段切换次数不对：${st.phase}`);
  }
}
console.log(bad ? `\n失败 ${bad} 项` : '\nBoss 测试通过');
process.exit(bad ? 1 : 0);
