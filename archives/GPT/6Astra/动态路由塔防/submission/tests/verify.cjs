/* Run with node tests/verify.cjs. Engine-level acceptance checks. */
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source =
  fs.readFileSync("data.js", "utf8") +
  "\n" +
  fs.readFileSync("engine.js", "utf8");
const context = { console, assert };
vm.createContext(context);
vm.runInContext(
  source +
    `
const tick = (g, seconds) => { for(let t=0;t<seconds;t+=1/60) g.step(1/60); };
const result = [];
for(let i=0;i<3;i++) {
  const g = new Game(i);
  assert.ok(Object.values(g.routes).every(Boolean));
  let shared = false;
  for(const [x,y,name] of g.map.nodes) {
    const p = g.preview(x+','+y, 'gate');
    assert.ok(p.valid, name+' must remain connected');
    assert.ok(p.changed.length>0, name+' must change a baseline route');
    shared ||= p.changed.length>1;
    for(const r of Object.values(p.routes)) {
      assert.ok(!r.cells.includes(x+','+y));
      for(let k=1;k<r.cells.length;k++) {
        const a=g.cell(r.cells[k-1]),b=g.cell(r.cells[k]);
        assert.equal(Math.abs(a.x-b.x)+Math.abs(a.y-b.y),1);
      }
    }
  }
  assert.ok(shared, 'Each map needs a shared routing decision');
  result.push(g.map.name+': all node alternatives verified');
}
{
 const g=new Game(1);assert.equal(g.routes.B.exit,'Y');assert.equal(g.routes.C.exit,'Y');
 const gate=g.place('gate','12,9');assert.equal(g.routes.B.exit,'X');assert.equal(g.routes.C.exit,'X');
 g.damageTower(gate,1000,{x:12,y:8});assert.equal(g.routes.B.exit,'Y');assert.equal(g.routes.C.exit,'Y');
 assert.ok(g.canPlace('gate','12,9').includes('旁路保护'));tick(g,8.1);assert.equal(g.canPlace('gate','12,9'),null);
 result.push('Backbone: B/C switch center together; bypass cooldown enforced');
}
{
 const g=new Game(0);g.hazards=[{active:true,cells:['6,12','8,12'],start:0,end:100}];
 const before=[g.compute,g.intel];assert.equal(g.place('gate','7,11'),false);assert.deepEqual([g.compute,g.intel],before);
 result.push('Illegal sealing rejected without resource loss');
}
{
 const g=new Game(0),e=g.spawn('worm','A','3,5',true);tick(g,.25);const y=e.y;
 assert.ok(y>5&&y<6);g.place('gate','3,6');g.step(.1);assert.ok(Math.abs(e.y-y)<=.126);assert.ok(e.y<y);
 tick(g,3);assert.ok(e.cell!=='3,6');assert.ok(e.x>3||e.y<5);
 result.push('In-flight enemy returns continuously and follows the preview');
}
{
 const g=new Game(0);g.spawn('worm','A','3,5');tick(g,2);assert.equal(g.enemies.length,2);tick(g,2);assert.equal(g.enemies.length,2);
 const h=new Game(0),gate=h.place('gate','3,6');h.spawn('flood','A','3,5');tick(h,13);assert.ok(gate.dead);assert.ok(h.stats.destroyed>0);
 result.push('Worm replication and flood node destruction are real combat');
}
{
 const g=new Game(0),t=g.place('sandbox','4,5',0,true);assert.ok(t);g.spawn('ransom','A','3,5');tick(g,1.1);
 assert.ok(t.hp<t.maxHp);assert.ok(t.encrypted>0);
 const r=g.place('repair','6,6',0,true);r.x=5;r.y=5;r.encrypted=0;g.skill(r);assert.equal(t.encrypted,0);assert.equal(t.shield,100);
 const hp=t.hp;g.enemies=[];tick(g,1);assert.ok(t.hp>hp);
 const save=[g.time,t.hp,g.compute,r.skillCd];g.paused=true;tick(g,3);assert.deepEqual([g.time,t.hp,g.compute,r.skillCd],save);
 result.push('Ransom encryption, repair shields, healing and global pause verified');
}
{
 const g=new Game(0);const t=g.place('honey','3,5');g.spawn('ransom','A','3,4');tick(g,1.1);assert.equal(t.encrypted,0);
 const e=g.spawn('trojan','A','3,7');g.skill(t);assert.ok(e.root>0);
 const cp=g.compute,ip=g.intel;assert.ok(g.upgrade(t,1));assert.equal(t.level,2);assert.equal(t.branch,1);assert.ok(g.compute<cp&&g.intel<ip);
 result.push('Honeypot immunity, active trap and exclusive branch verified');
}
{
 const g=new Game(0),t=g.place('sandbox','4,5');
 const far=g.spawn('worm','A','3,4',true),near=g.spawn('worm','B','7,4',true);
 far.route=[];near.route=['7,5','7,6','7,7','7,8','7,9','7,10','7,11','7,12'];
 let target;g.onEvent=(type,d)=>{if(type==='attack'&&d.from===t)target=d.to;};tick(g,.12);
 assert.equal(target,near,'Core proximity must not use length of a lure/siege route');
 assert.equal(g.path('0,0'),null,'Obstacles cannot be path starts');
 result.push('Weighted distance to the core drives targeting, including units with empty routes');
}
{
 const g=new Game(0),h=g.place('honey','7,5');
 const first=g.spawn('worm','A','7,5',true),second=g.spawn('worm','A','7,5',true),overflow=g.spawn('worm','A','7,5',true);
 tick(g,.5);assert.equal(h.blocked,2);assert.ok(first.block===h.id&&second.block===h.id);assert.equal(overflow.block,null);assert.ok(overflow.y>5.3);
 const f=new Game(0),gate=f.place('gate','3,6'),e=f.spawn('flood','B','13,2');
 let acquired=false;for(let i=0;i<1400;i++){f.step(1/60);if(e.siege===gate){acquired=true;break;}}
 assert.ok(acquired,'Flood must acquire a node reached midway through its route');
 const p=new Game(0),worm=p.spawn('worm','A','3,2',true);tick(p,.2);const honey=p.place('honey','5,4');
 let lured=false;for(let i=0;i<600;i++){p.step(1/60);if(worm.siege===honey){lured=true;break;}}
 assert.ok(lured,'Moving enemy must notice a honeypot when entering its lure radius');
 result.push('Honeypot capacity permits overflow; mobile attackers reconsider nearby targets');
}
{
 const g=new Game(0);assert.ok(g.setHazard(['3,5'],8,.2));
 g.place('firewall','3,5');tick(g,.25);
 const h=g.hazards[0];assert.ok(!h.active);assert.ok(!h.cells.includes('3,5'));assert.ok(h.start>g.time);
 tick(g,2.1);assert.ok(h.active);assert.ok(Object.values(g.routes).every(Boolean));
 result.push('Boss relocates an invalid warning and warns again before safely blocking');
}
{
 const g=new Game(0),t=g.place('interceptor','4,5',-Math.PI/2),e=g.spawn('trojan','A','3,5',true);
 e.root=10;tick(g,1);assert.equal(e.hp,e.maxHp,'Undetected Trojan cannot be selected');
 g.place('sandbox','2,4');tick(g,1);assert.ok(e.hp<e.maxHp,'Sandbox reveals for the interceptor');
 const p=new Game(0),wall=p.place('firewall','3,5'),hidden=p.spawn('trojan','A','3,4',true),hp=wall.hp;
 p.damageEnemy(hidden,1000,wall);assert.equal(wall.hp,hp-38,'Hidden Trojan payload damages nearby devices');
 result.push('Stealth detection, targeting restriction and hidden payload damage verified');
}
{
 const g=new Game(0),s=g.place('sandbox','4,5'),e=g.spawn('flyer','A','3,5',true);
 e.target={x:3,y:12};tick(g,.5);assert.equal(e.hp,e.maxHp);assert.equal(e.x,3);assert.ok(e.y>5);
 g.place('interceptor','2,7',Math.PI/2);tick(g,1);assert.ok(e.hp<e.maxHp);
 const p=new Game(0),support=p.spawn('shell','A','3,4'),friend=p.spawn('worm','A','3,4',true);
 support.root=10;friend.root=10;support.ability=0;tick(p,.02);assert.equal(friend.shield,32);
 const hp=friend.hp;p.damageEnemy(friend,20);assert.equal(friend.hp,hp);assert.equal(friend.shield,12);
 result.push('Air units bypass ground weapons; support shields absorb damage first');
}
{
 const g=new Game(0),wall=g.place('firewall','3,5'),e=g.spawn('worm','A','3,5',true);
 wall.encrypted=4;const hp=e.hp;tick(g,1);assert.equal(e.hp,hp);assert.equal(e.block,wall.id);assert.ok(wall.hp<wall.maxHp);assert.equal(g.skill(wall),false);
 const p=new Game(0);p.place('isolate','3,6');p.running=true;p.queue=[{time:100,type:'worm',entry:'A'}];const intel=p.intel;
 tick(p,1);assert.equal(p.intel,intel);tick(p,17.1);assert.equal(p.towerAt('3,6'),undefined);assert.ok(p.nodeCooldown['3,6']>0);assert.ok(p.routes.A.cells.includes('3,6'));
 const q=new Game(0),gate=q.place('gate','3,6');q.running=true;q.queue=[{time:100,type:'worm',entry:'A'}];const before=q.intel;tick(q,1);assert.ok(q.intel>before);
 q.upgrade(gate);gate.hp-=100;tick(q,1);assert.ok(gate.hp>gate.maxHp-100);
 result.push('Encryption preserves blocking; temporary isolation expires without intelligence income; upgraded gates self-repair');
}
{
 const g=new Game(0),t=g.place('honey','3,5');g.upgrade(t,0);const e=g.spawn('flood','A','7,4');g.skill(t);assert.equal(e.root,7);
 const p=new Game(0),fast=p.spawn('trojan','A','3,4',true);p.place('downgrade','3,5');const cost=p.travelCost(p.cell('3,5'));tick(p,.5);
 assert.ok(cost>1.8);assert.ok(fast.reveal>0);assert.ok(fast.y<4.5);assert.ok(p.canPlace('downgrade','3,5'));tick(p,14);assert.equal(p.downgrades.length,0);assert.equal(p.travelCost(p.cell('3,5')),1);
 result.push('Deep lure radius matches its skill; protocol downgrade slows, reveals, expires and enforces cooldown');
}
console.log(result.join('\\n'));
`,
  context,
  { timeout: 30000 },
);
