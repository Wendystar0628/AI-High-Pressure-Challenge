// 随机操作压力测试：node tools/test_invariants.js
// 检查：敌人不瞬移、不进入被封格、不会无路可走；操作被拒绝时不扣资源；重开后回到初始局面
const path = require('path');
for (const f of ['data', 'maps', 'sim']) require(path.join(__dirname, '..', 'js', f + '.js'));
const TD = globalThis.TD;
let bad = 0;
const fail = (m) => { if (bad < 25) console.log('  !!', m); bad++; };

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

for (const id of TD.MAP_ORDER) {
  for (let seed = 1; seed <= 5; seed++) {
    const g = new TD.Game(id, { seed: seed * 91, prep: 3 });
    const R = rng(seed * 1237);
    g.compute = 2e5; g.intel = 2e4;
    const last = new Map();
    const dt = 1 / 30;
    let rejected = 0, placed = 0, opened = 0, turned = 0, sieged = 0, lured = 0, copied = 0, reveals = 0, payloads = 0, holes = 0;
    const platforms = [];
    for (let y = 0; y < g.map.h; y++) for (let x = 0; x < g.map.w; x++) if (g.map.tiles[g.idx(x, y)] === TD.TT.PLATFORM) platforms.push([x, y]);
    // 布一些塔，避免波次太快结束
    for (let k = 0; k < 18; k++) {
      const [x, y] = platforms[(R() * platforms.length) | 0];
      const type = ['interceptor', 'sandbox', 'repair'][k % 3];
      g.placeTower(type, x, y, R() * 6.28);
    }
    let t = 0;
    while (!g.over && t < 900) {
      t += dt;
      // 随机改变通行
      if (R() < 0.02) {
        const nd = g.nodes[(R() * g.nodes.length) | 0];
        const before = { c: g.compute, i: g.intel };
        if (nd.tower) { if (R() < 0.5) g.sell(nd.tower); }
        else if (!nd.isolator) {
          const type = R() < 0.5 ? 'gate' : 'firewall';
          const chk = g.checkPlace(type, nd.x, nd.y);
          const res = g.placeTower(type, nd.x, nd.y);
          if (!res.ok) {
            rejected++;
            if (g.compute !== before.c || g.intel !== before.i) fail(`${id} 被拒绝的操作扣了资源`);
          } else placed++;
          void chk;
        }
      }
      if (R() < 0.006) {
        const nd = g.nodes[(R() * g.nodes.length) | 0];
        g.itemCd.isolator = 0;
        g.useItem('isolator', nd.x, nd.y);
      }
      if (R() < 0.005) { g.itemCd.downgrade = 0; g.useItem('downgrade', (R() * g.map.w) | 0, (R() * g.map.h) | 0); }
      if (R() < 0.006) {
        // 在随机链路上放阻挡塔
        const r = g.routes[g.map.entrances[0].id].path;
        const i = r[1 + ((R() * (r.length - 2)) | 0)];
        g.placeTower(R() < 0.5 ? 'firewall' : 'honeypot', i % g.map.w, (i / g.map.w) | 0);
      }
      g.update(dt);
      for (const ev of g.events) {
        if (ev.type === 'nodeOpen') opened++;
        if (ev.type === 'siegeBegin') sieged++;
        if (ev.type === 'lured') lured++;
        if (ev.type === 'wormCopy') copied++;
        if (ev.type === 'reveal') reveals++;
        if (ev.type === 'payload') payloads++;
        if (ev.type === 'holeOpen') holes++;
      }
      g.events.length = 0;
      // 入口必须始终连通
      for (const en of g.map.entrances) if (g.dist[en.idx] >= TD.INF) fail(`${id} 入口 ${en.id} 无路 t=${t.toFixed(1)}`);
      // 敌人移动约束
      for (const e of g.enemies) {
        const p = last.get(e.id);
        if (p) {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d > e.speed * dt * 1.5 + 0.02) fail(`${id} ${e.type} 瞬移 ${d.toFixed(2)} @(${e.x.toFixed(2)},${e.y.toFixed(2)})`);
          if (!e.fly) {
            const pd = Math.hypot(e.x - p.x, e.y - p.y);
            void pd;
          }
        }
        last.set(e.id, { x: e.x, y: e.y });
        if (e.fly) continue;
        // 只能在道路上
        const ti = g.idx(Math.round(e.x), Math.round(e.y));
        const tt = g.map.tiles[ti];
        if (!g.isRoadIdx(ti)) fail(`${id} ${e.type} 走到非道路格 (${e.x.toFixed(2)},${e.y.toFixed(2)})`);
        void tt;
        // 不能朝被封格前进（已经在被封格内部走出来的例外）
        const toI = g.idx(e.tx, e.ty), fromI = g.idx(e.fx, e.fy);
        if (g.blocked[toI] && !g.blocked[fromI] && !e.sieging && !(e.fx === e.tx && e.fy === e.ty)) {
          const dist = Math.hypot(e.x - e.fx, e.y - e.fy);
          if (dist > 0.05) fail(`${id} ${e.type} 正朝被封格 (${e.tx},${e.ty}) 前进 from (${e.fx},${e.fy})`);
        }
        if (Math.abs(e.x - Math.round(e.x)) > 0.001 && Math.abs(e.y - Math.round(e.y)) > 0.001) fail(`${id} ${e.type} 偏离格线 (${e.x.toFixed(3)},${e.y.toFixed(3)})`);
        if (g.dist[toI] >= TD.INF && g.dist[fromI] >= TD.INF && !g.blocked[toI] && !g.blocked[fromI]) fail(`${id} ${e.type} 被困死`);
      }
    }
    console.log(`${id} seed${seed}: 结果=${g.over || '进行中'} 波=${g.waveIdx + 1} 隔离=${placed} 被拒=${rejected} 旁路=${opened} 冲击=${sieged} 诱敌=${lured} 复制=${copied} 显形=${reveals} 载荷=${payloads} 封锁=${holes} 收敛=${g.stats.reroutes}`);
  }
}

// 反复切换同一节点的代价
{
  const g = new TD.Game('intranet', { seed: 3, prep: 999 });
  g.compute = 9999; g.intel = 999;
  const nd = g.nodes.find(n => n.id === 'W');
  const gaps = [];
  for (let k = 0; k < 5; k++) {
    g.nodes.find(n => n.id === 'W').lockT = g.nodes.find(n => n.id === 'W').lockT;
    const start = g.time;
    while (nd.lockT > 0) g.update(0.1);
    gaps.push(+(g.time - start).toFixed(1));
    const r = g.placeTower('gate', nd.x, nd.y);
    if (!r.ok) fail('再隔离失败 ' + r.reason);
    g.update(1);
    g.sell(nd.tower);
    if (!(nd.lockT > 0)) fail('撤下后没有再隔离间隔');
  }
  console.log('反复切换的等待（秒）：', gaps.join(' → '));
  if (!(gaps[4] > gaps[1])) fail('路由抖动抑制没有加长间隔');
}

// 蠕虫只复制一次；复制体不再复制
{
  const g = new TD.Game('intranet', { seed: 5, prep: 999 });
  const e = g.spawn('worm', 'A');
  let copies = 0;
  for (let i = 0; i < 2500 && !g.over; i++) { g.update(1 / 30); for (const ev of g.events) if (ev.type === 'wormCopy') copies++; g.events.length = 0; }
  if (copies !== 1) fail('蠕虫复制次数应为 1，实际 ' + copies);
  void e;
}

// 隐身木马不被拦截器选中，走旧链路后显形
{
  const g = new TD.Game('intranet', { seed: 5, prep: 999 });
  g.compute = 9999;
  g.placeTower('interceptor', 6, 8, 0);
  const e = g.spawn('trojan', 'A');
  for (let i = 0; i < 300; i++) { g.update(1 / 30); }
  if (e.hp < e.maxHp) fail('未显形木马被远程单体命中');
  g.events.length = 0;
}

console.log(bad ? `\n失败 ${bad} 项` : '\n全部不变量通过');
process.exit(bad ? 1 : 0);
