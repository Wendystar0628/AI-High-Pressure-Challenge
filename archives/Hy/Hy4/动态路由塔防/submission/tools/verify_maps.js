/* 地图拓扑验证：node tools/verify_maps.js
 * 检查入口连通、隔离每个节点是否改道、是否封死、改道幅度 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console: console, Math: Math, Float32Array: Float32Array, Object: Object, Array: Array, isFinite: isFinite, Infinity: Infinity });
ctx.window = ctx; ctx.globalThis = ctx;
for (const f of ['js/engine.js', 'js/pathfinding.js', 'js/maps.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const TD = ctx.TD;
const P = TD.Path;

function diffPath(a, b) {
  if (!a || !b) return 999;
  const sa = new Set(a.path.map(c => c.x + ',' + c.z));
  const sb = new Set(b.path.map(c => c.x + ',' + c.z));
  let d = 0; sa.forEach(k => { if (!sb.has(k)) d++; }); sb.forEach(k => { if (!sa.has(k)) d++; });
  return d;
}

for (const map of TD.Maps.list) {
  console.log('\n===== ' + map.name + ' (' + map.id + ') ' + map.W + 'x' + map.H + ' =====');
  // 行长一致性
  let widths = new Set(map.grid.map(r => r.length));
  console.log('行宽集合:', [...widths].join(','), '节点数:', map.nodes.length, '入口:', map.entries.map(e => e.id).join(','), '出口:', map.exits.map(e => e.id).join(','));

  const baseState = { tick: 0, isolated: {}, blocks: {}, downgraded: {}, enemies: [] };
  const acc = P.makeAccess(map, baseState);
  const field = P.rebuild(map, acc);
  const baseRoutes = P.routes(map, field, acc);
  for (const e of map.entries) {
    const r = baseRoutes[e.id];
    console.log('  入口 ' + e.id + ' 基础路线: ' + (r ? '长度 ' + (r.path.length - 1) + ' → 出口(' + r.exit.x + ',' + r.exit.z + ')' : '无路!!'));
  }
  let bad = [], multi = [];
  for (const n of map.nodes) {
    const st = { tick: 0, isolated: {}, blocks: {}, downgraded: {}, enemies: [] };
    st.isolated[n.id] = { active: true };
    const a2 = P.makeAccess(map, st);
    const f2 = P.rebuild(map, a2);
    const conn = P.connectivity(map, f2, a2, null);
    const r2 = P.routes(map, f2, a2);
    const changed = [];
    for (const e of map.entries) if (diffPath(baseRoutes[e.id], r2[e.id]) >= 2) changed.push(e.id);
    const blocked = conn.length > 0;
    const tag = blocked ? '封死!!' : (changed.length === 0 ? '无改道!!' : '改道[' + changed.join(',') + ']');
    console.log('  节点 ' + n.id.padEnd(14) + ' (' + n.x + ',' + n.z + ') ' + n.name.padEnd(12) + ' ' + tag);
    if (blocked || changed.length === 0) bad.push(n.id + '(' + n.x + ',' + n.z + ')');
    if (changed.length >= 2) multi.push(n.id);
  }
  console.log('  >>> 不合格节点:', bad.length ? bad.join(' ') : '无');
  console.log('  >>> 多入口改道节点:', multi.length ? multi.join(' ') : '无');
}
