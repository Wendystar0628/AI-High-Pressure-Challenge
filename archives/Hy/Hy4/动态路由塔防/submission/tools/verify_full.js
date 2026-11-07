/* 三张地图完整对局验证：node tools/verify_full.js
 * 自动布防 → 跑完所有波次 → 检查胜负 / Boss / 各系统事件 / 运行时错误 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console, Math, Float32Array, Uint32Array, Object, Array, Set, isFinite, Infinity, Date });
ctx.window = ctx; ctx.globalThis = ctx;
for (const f of ['js/engine.js', 'js/pathfinding.js', 'js/maps.js', 'js/data.js', 'js/game.js'])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const TD = ctx.TD, G = TD.Game;

function autoDeploy(s) {
  s.compute = 9000; s.intel = 900;
  const map = s.map;
  let counts = { P: 0, L: 0 };
  const kindsP = ['interceptor', 'sandbox', 'repair'];
  for (let z = 0; z < map.H; z++) for (let x = 0; x < map.W; x++) {
    const t = map.grid[z][x].t;
    if (t === 'P') {
      const type = kindsP[counts.P % kindsP.length];
      const ex = map.exits[0], dx = TD.Maps.wx(map, ex.x) - TD.Maps.wx(map, x), dz = TD.Maps.wz(map, ex.z) - TD.Maps.wz(map, z);
      const r = G.build(s, type, x, z, Math.atan2(dx, dz));
      if (r.ok) counts.P++;
    } else if (t === '=' && counts.L < 14 && (x + z) % 3 === 0) {
      const type = counts.L % 2 === 0 ? 'firewall' : 'honeypot';
      const r = G.build(s, type, x, z, 0);
      if (r.ok) counts.L++;
    }
  }
  return counts;
}

for (const mapId of ['intranet', 'backbone', 'airgap']) {
  const s = G.create(mapId, { seed: 20261106 });
  const dep = autoDeploy(s);
  const evCount = {};
  let err = null, bossSeen = false, phases = new Set(), maxEnemies = 0, routeChanges = 0;
  const maxSteps = s.endTick + 2400;
  try {
    for (let i = 0; i < maxSteps; i++) {
      G.step(s);
      for (const e of s.events) {
        evCount[e.type] = (evCount[e.type] || 0) + 1;
        if (e.type === 'spawn' && e.boss) bossSeen = true;
        if (e.type === 'bossphase') phases.add(e.name);
        if (e.type === 'routeChange') routeChanges++;
      }
      s.events.length = 0;
      maxEnemies = Math.max(maxEnemies, s.enemies.filter(e => !e.dying).length);
      if (s.phase !== 'battle') break;
    }
  } catch (e) { err = e.stack; }
  console.log('\n===== ' + s.map.name + ' (' + mapId + ') =====');
  console.log('部署:', JSON.stringify(dep), 'endTick:', s.endTick, '跑到 tick:', s.tick, '(' + s.time.toFixed(0) + 's)');
  console.log('结果: phase=' + s.phase + ' wave=' + s.wave + '/' + s.totalWaves + ' core=' + Math.round(s.core));
  console.log('kills=' + s.stats.kills + ' leaks=' + s.stats.leaks + ' 峰值敌人=' + maxEnemies + ' Boss出现=' + bossSeen + ' 阶段=' + [...phases].join('/'));
  console.log('事件:', JSON.stringify(evCount), '改道次数=' + routeChanges);
  console.log('运行时错误:', err || '无');
  if (err) process.exitCode = 1;
}
console.log('\nDONE');
