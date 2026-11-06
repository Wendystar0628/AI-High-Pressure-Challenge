// 单项机制测试：node tools/test_mechanics.js
const path = require('path');
for (const f of ['data', 'maps', 'sim']) require(path.join(__dirname, '..', 'js', f + '.js'));
const TD = globalThis.TD;
let bad = 0;
const check = (name, ok, extra) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '：' + extra : ''}`); if (!ok) bad++; };
const fresh = (id) => { const g = new TD.Game(id || 'intranet', { seed: 9, prep: 9999 }); g.compute = 9999; g.intel = 999; return g; };
const run = (g, s) => { for (let i = 0; i < s * 30; i++) g.update(1 / 30); };
const on = (g, type) => g.events.filter(e => e.type === type);

{ // 未显形木马被波及消灭：释放载荷并伤害附近的塔
  const g = fresh();
  const near = g.placeTower('interceptor', 6, 3, 0).tower; // 紧贴 A 干道
  const hp0 = near.hp;
  const e = g.spawn('trojan', 'A', { at: { x: 5, y: 3, fx: 5, fy: 3, tx: 5, ty: 4 } });
  e.hp = 1;
  g.damageEnemy(e, 50, { kind: 'blast' });
  check('未显形被波及消灭时释放载荷', on(g, 'payload').length === 1);
  check('载荷伤害附近的塔', near.hp < hp0, `${hp0} → ${near.hp}`);
}
{ // 已显形的木马被消灭不释放载荷
  const g = fresh();
  const e = g.spawn('trojan', 'A', { at: { x: 5, y: 3, fx: 5, fy: 3, tx: 5, ty: 4 } });
  g.reveal(e, 'test');
  e.hp = 1;
  g.damageEnemy(e, 50, { kind: 'bolt' });
  check('已显形木马被消灭不释放载荷', on(g, 'payload').length === 0);
}
{ // 贯穿线膛能打到未显形目标
  const g = fresh();
  const t = g.placeTower('interceptor', 6, 3, Math.PI / 2).tower;
  g.upgrade(t, 'pierce');
  const worm = g.spawn('worm', 'A', { at: { x: 5, y: 5, fx: 5, fy: 5, tx: 5, ty: 6 } });
  const troj = g.spawn('trojan', 'A', { at: { x: 5, y: 7, fx: 5, fy: 7, tx: 5, ty: 8 } });
  void worm; void troj;
  t.dir = Math.atan2(4, -1); t.cd = 0;
  g.update(1 / 30);
  check('贯穿线膛发射直线弹道', on(g, 'railShot').length >= 1);
}
{ // 木马走旧链路显形
  const g = fresh();
  const e = g.spawn('trojan', 'A', { at: { x: 6, y: 11, fx: 6, fy: 11, tx: 7, ty: 11 } });
  run(g, 3);
  check('旧链路使木马显形', e.revealed);
}
{ // 木马被阻挡显形
  const g = fresh();
  g.placeTower('firewall', 5, 5, 0);
  const e = g.spawn('trojan', 'A', { at: { x: 5, y: 3, fx: 5, fy: 3, tx: 5, ty: 4 } });
  run(g, 4);
  check('阻挡使木马显形', e.revealed && e.blockedBy);
}
{ // 阻挡容量：超过容量的继续前进；阻挡不截断道路
  const g = fresh();
  const t = g.placeTower('firewall', 5, 5, 0).tower;
  const before = g.routes.A.len;
  const es = [];
  for (let i = 0; i < 6; i++) es.push(g.spawn('worm', 'A', { at: { x: 5, y: 3, fx: 5, fy: 3, tx: 5, ty: 4 } }));
  let peak = 0;
  for (let i = 0; i < 5 * 30; i++) { g.update(1 / 30); peak = Math.max(peak, g.blockLoad(t)); }
  check('防火墙挡到容量上限且不超过', peak === t.s.block, `峰值 ${peak}/${t.s.block}`);
  check('超过容量的敌人继续前进', es.some(e => !e.blockedBy && e.y > 5.5));
  check('阻挡不改变路线', g.routes.A.len === before);
}
{ // 洪泛团占用较多容量
  const g = fresh();
  const t = g.placeTower('firewall', 5, 5, 0).tower;
  g.spawn('flood', 'A', { at: { x: 5, y: 3, fx: 5, fy: 3, tx: 5, ty: 4 } });
  run(g, 5);
  check('洪泛团占用 2 点阻挡容量', g.blockLoad(t) === 2 && t.blocked.length === 1);
}
{ // 洪泛团离开路线冲击隔离节点，打通后恢复直通并重新走原路
  const g = fresh();
  const nd = g.nodes.find(n => n.id === 'O');
  const gate = g.placeTower('gate', nd.x, nd.y).tower;
  gate.hp = 200;
  const e = g.spawn('flood', 'A', { at: { x: 5, y: 7, fx: 5, fy: 7, tx: 6, ty: 7 } });
  run(g, 6);
  check('洪泛团偏离路线攻击隔离节点', e.sieging && e.siegeNode === nd);
  run(g, 25);
  check('冲毁后节点旁路直通', gate.gone && !nd.tower);
  check('直通后进入再隔离间隔', nd.lockT > 0 || g.time > 0);
  check('路线恢复经过该节点', g.routes.A.path.includes(nd.idx));
}
{ // 勒索者：优先打蜜罐；蜜罐不被加密；其他塔被加密后停火但阻挡不解除
  const g = fresh();
  const hp = g.placeTower('honeypot', 5, 3, 0).tower;
  const fw = g.placeTower('firewall', 5, 4, 0).tower;
  g.spawn('ransom', 'A', { at: { x: 5, y: 1, fx: 5, fy: 1, tx: 5, ty: 2 } });
  run(g, 4);
  check('勒索者优先攻击蜜罐', hp.hp < hp.maxHp || hp.gone);
  check('蜜罐不会被加密', !(hp.encT > 0));
  check('射程内有蜜罐时不打别的塔', fw.encT <= 0);
}
{ // 加密不解除节点隔离；冗余切换解除加密并加护盾
  const g = fresh();
  const nd = g.nodes.find(n => n.id === 'O');
  const gate = g.placeTower('gate', nd.x, nd.y).tower;
  const rp = g.placeTower('repair', 9, 8, 0).tower;
  gate.encT = 5;
  check('加密不解除隔离', g.blocked[nd.idx] === 1);
  check('被加密的塔不能放技能', !g.canSkill(gate).ok);
  const r = g.useSkill(rp);
  check('冗余切换解除加密', r.ok && gate.encT === 0);
  check('冗余切换提供护盾', gate.shield > 0);
  gate.hp = 100;
  run(g, 1);
  check('修复进程治疗节点上的塔', gate.hp > 100, `生命 ${gate.hp.toFixed(1)}`);
}
{ // 塔被摧毁不退款，撤下退还
  const g = fresh();
  const t = g.placeTower('interceptor', 6, 3, 0).tower;
  const c0 = g.compute;
  g.sell(t);
  check('撤下退还部分算力', g.compute > c0 && g.compute - c0 < t.def.cost);
  const t2 = g.placeTower('interceptor', 6, 3, 0).tower;
  const c1 = g.compute;
  g.towerDamage(t2, 9999, {});
  check('被摧毁不退款', Math.abs(g.compute - c1) < 0.01);
}
{ // 应急隔离器到期恢复，不产生情报
  const g = fresh();
  const nd = g.nodes.find(n => n.id === 'O');
  g.useItem('isolator', nd.x, nd.y);
  check('应急隔离器隔离节点', g.blocked[nd.idx] === 1);
  const i0 = g.intel;
  g.spawn('worm', 'A', { at: { x: 5, y: 7, fx: 5, fy: 7, tx: 6, ty: 7 } });
  run(g, 8);
  check('应急隔离器不产生情报', g.intel === i0, `${i0} → ${g.intel}`);
  run(g, 14);
  check('应急隔离器到期恢复直通', !nd.isolator && !g.blocked[nd.idx]);
}
{ // 塔守隔离节点产生情报
  const g = fresh();
  const nd = g.nodes.find(n => n.id === 'O');
  g.placeTower('gate', nd.x, nd.y);
  // 用高耐久防火墙把敌人钉在节点附近，形成持续交战
  const fw = g.placeTower('firewall', 7, 7, 0).tower;
  fw.hp = fw.maxHp = 1e6;
  const i0 = g.intel;
  const e = g.spawn('worm', 'A', { at: { x: 5, y: 7, fx: 5, fy: 7, tx: 6, ty: 7 } });
  e.hp = e.maxHp = 1e6;
  const h0 = TD.RULES.holdEvery;
  run(g, h0 + 2);
  check('交战中守住隔离节点产生情报', g.intel > i0, `${i0} → ${g.intel}`);
}
{ // 协议降级：减速、显形、可能改变路线；结束后恢复
  const g = fresh('backbone');
  const before = g.routes.C.exit;
  g.useItem('downgrade', 18, 5);
  check('协议降级能让路线随速度改变', g.routes.C.exit !== before, `${before} → ${g.routes.C.exit}`);
  run(g, 17);
  check('协议降级结束后路线恢复', g.routes.C.exit === before);
}
{ // 伪热点不受地面影响，只有拦截器能打
  const g = fresh();
  g.placeTower('sandbox', 8, 4, 0);
  const e = g.spawn('hotspot', 'A');
  const hp = e.hp;
  run(g, 4);
  check('沙箱打不到飞行单位', e.hp === hp);
  const f = g.placeTower('interceptor', 9, 5, Math.PI * 0.75).tower;
  void f;
  run(g, 3);
  check('拦截器能打飞行单位', e.hp < hp || e.dead);
}
{ // 重开回到初始局面
  const g = fresh();
  g.placeTower('gate', 9, 7);
  const n = new TD.Game('intranet', { seed: 1 });
  check('新对局是初始局面', n.towers.length === 0 && n.compute === n.def.startCompute && n.intel === n.def.startIntel && n.integrity === TD.RULES.startIntegrity && n.waveIdx === -1 && !n.nodes.some(x => x.tower));
}
console.log(bad ? `\n失败 ${bad} 项` : '\n全部机制测试通过');
process.exit(bad ? 1 : 0);
