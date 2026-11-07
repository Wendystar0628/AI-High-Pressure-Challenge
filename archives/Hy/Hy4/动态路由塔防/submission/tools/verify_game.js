/* 游戏逻辑冒烟测试：node tools/verify_game.js */
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console, Math, Float32Array, Uint32Array, Object, Array, Set, isFinite, Infinity, Date });
ctx.window = ctx; ctx.globalThis = ctx;
for (const f of ['js/engine.js', 'js/pathfinding.js', 'js/maps.js', 'js/data.js', 'js/game.js'])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const TD = ctx.TD, G = TD.Game;

function summary(s, tag) {
  console.log(`[${tag}] t=${(s.time).toFixed(1)}s wave=${s.wave} enemies=${s.enemies.filter(e => !e.dying).length} towers=${s.towers.length} core=${s.core} cpu=${Math.floor(s.compute)} intel=${Math.floor(s.intel)} kills=${s.stats.kills} leaks=${s.stats.leaks} iso=${Object.keys(s.isolated).filter(k => s.isolated[k].active).length} phase=${s.phase}`);
}

let s = G.create('intranet', { seed: 7 });
summary(s, 'init');
// 部署一批塔（挑选实际链路/平台格）
function show(tag, r) { console.log(tag, r.ok ? 'OK' : 'FAIL: ' + r.reason); return r; }
show('build firewall@(4,2)', G.build(s, 'firewall', 4, 2));
show('build interceptor@(6,3)', G.build(s, 'interceptor', 6, 3, 0));
show('build sandbox@(10,3)', G.build(s, 'sandbox', 10, 3));
show('build repair@(3,7)', G.build(s, 'repair', 3, 7));
show('build gateway@node(4,1)', G.build(s, 'gateway', 4, 1));
summary(s, 'after-build');
console.log('routes changed entries:', s.routeChangedEntries.join(','));
// 升级/技能/道具
const it = s.towers.find(t => t.type === 'interceptor');
if (it) show('upgrade interceptor', G.upgrade(s, it.id, 'a'));
const fw = s.towers.find(t => t.type === 'firewall');
if (fw) show('skill firewall', G.skill(s, fw.id));
show('item downgrade@(5,5)', G.useItem(s, 'downgrade', 5, 5));
show('item restore@(4,2)', G.useItem(s, 'restore', 4, 2));
// 跑 60 秒
try {
  for (let i = 0; i < 3600; i++) {
    G.step(s);
    if (s.events.length) s.events.length = 0;
    if (i % 600 === 0) {
      const sb = s.towers.find(t => t.type === 'sandbox');
      const near = s.enemies.filter(e => !e.dying && (e.cell.x - 10) ** 2 + (e.cell.z - 3) ** 2 <= 2.7 ** 2).length;
      console.log(`dbg t=${s.time.toFixed(0)}s dmg=${s.stats.dmgDealt.toFixed(0)} kills=${s.stats.kills} nearSb=${near} sbCd=${sb ? sb.cd.toFixed(2) : '-'} alive=${s.enemies.filter(e => !e.dying).length}`);
      if (i === 0) {
        console.log('route A:', s.routes.A ? s.routes.A.path.map(c => c.x + ',' + c.z).join(' ') : 'none');
        console.log('route B:', s.routes.B ? s.routes.B.path.map(c => c.x + ',' + c.z).join(' ') : 'none');
      }
    }
  }
  summary(s, 'after-60s');
} catch (e) { console.error('RUNTIME ERROR at t=', s.time, e.stack); process.exit(1); }
// 检查路线一致性
let ok = true;
for (const en of s.map.entries) {
  const r = s.routes[en.id];
  if (!r) { console.log('entry', en.id, 'NO ROUTE'); ok = false; }
  else console.log('entry', en.id, 'route len', r.path.length - 1, '-> exit', r.exit.x + ',' + r.exit.z);
}
console.log('warnings:', s.warnings.length, 'blocks:', Object.keys(s.blocks).length, 'fx:', s.fx.length);
console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
