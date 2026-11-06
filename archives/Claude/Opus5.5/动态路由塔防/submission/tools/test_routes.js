// 校验三张地图的路由规则：node tools/test_routes.js
const path = require('path');
for (const f of ['data', 'maps', 'sim']) require(path.join(__dirname, '..', 'js', f + '.js'));
const TD = globalThis.TD;
let fail = 0;

for (const id of TD.MAP_ORDER) {
  const g = new TD.Game(id);
  console.log(`\n=== ${g.def.name} ===`);
  console.log(TD.ascii(g.map));
  const fmt = (r) => `${r.ent}->${r.exit} len=${r.len} cost=${r.cost.toFixed(1)}`;
  console.log('默认：', Object.values(g.routes).map(fmt).join(' | '));
  for (const en of g.map.entrances) if (!g.routes[en.id].exit) { console.log('  !! 入口不通', en.id); fail++; }
  let multi = 0;
  for (const nd of g.nodes) {
    const pv = g.preview({ block: [nd.idx] });
    const desc = pv.changes.map(c => {
      const oldSet = new Set(c.oldPath);
      const fresh = c.newPath.filter(i => !oldSet.has(i)).length;
      return `${c.ent}→${c.newExit} 跳数${c.oldLen}->${c.newLen} 新路段${fresh}`;
    }).join('；');
    console.log(`  隔离 ${nd.id}(${nd.name}) ok=${pv.ok}: ${desc || '【无变化】'}`);
    if (!pv.ok) { console.log('   !! 会封死', pv.sealed); fail++; }
    if (!pv.changes.length) { console.log('   !! 没有改变任何路线'); fail++; }
    for (const c of pv.changes) {
      const oldSet = new Set(c.oldPath);
      const fresh = c.newPath.filter(i => !oldSet.has(i)).length;
      if (fresh < 4) { console.log('   !! 改道太短，只是绕开一格'); fail++; }
    }
    if (pv.changes.length >= 2) multi++;
  }
  if (!multi) { console.log('  !! 没有同时改变多入口的节点'); fail++; }
  console.log(`  同时改变多入口的节点数：${multi}`);
  // 连通性：所有节点全隔离必须被拒绝
  const pv = g.preview({ block: g.nodes.map(n => n.idx) });
  console.log(`  全部隔离时被封死：${pv.sealed.map(s => s.label).join('，') || '（未封死）'}`);
  // 孤立路面检查
  const reach = g.dist;
  for (let i = 0; i < g.n; i++) if (g.isRoadIdx(i) && reach[i] >= TD.INF) { console.log('  !! 孤立道路', i % g.map.w, (i / g.map.w) | 0); fail++; }
  console.log(`  波次数：${g.def.waves.length}`);
}
console.log(fail ? `\n失败项：${fail}` : '\n全部通过');
process.exit(fail ? 1 : 0);
