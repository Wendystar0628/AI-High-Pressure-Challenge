/* Complete campaigns using only ordinary starting resources and earned income.
   A fixed build order and periodic skill use approximate a player using pause.
   No free placements, altered damage, injected income or skipped waves. */
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
vm.runInNewContext(
  fs.readFileSync("data.js", "utf8") +
    "\n" +
    fs.readFileSync("engine.js", "utf8") +
    `
const plans = [
 [['gate','3,6'],['sandbox','6,6'],['interceptor','8,7',-90],['firewall','7,9'],['repair','6,9'],['interceptor','6,11',45],['sandbox','4,5'],['interceptor','10,5',-90],['repair','4,3'],['interceptor','8,11',-45],['sandbox','10,8'],['interceptor','4,11',0]],
 [['sandbox','3,9'],['interceptor','1,11',160],['sandbox','11,7'],['interceptor','13,11',-160],['repair','1,8'],['repair','11,10'],['interceptor','9,9',90],['firewall','2,10'],['firewall','12,10'],['interceptor','5,10',-90],['sandbox','9,6'],['interceptor','13,5',150],['interceptor','3,6',-90]],
 [['sandbox','4,8'],['interceptor','7,11',-90],['sandbox','12,9'],['interceptor','10,11',90],['repair','6,9'],['firewall','3,9'],['honey','13,10'],['interceptor','14,7',180],['repair','12,6'],['interceptor','4,11',-160],['interceptor','12,11',155],['sandbox','14,5'],['interceptor','2,7',90]]
];
for (let index=0;index<3;index++) {
 const g=new Game(index);let next=0,win=false,minCompute=g.compute,minIntel=g.intel;
 g.onEvent=(type,d)=>{if(type==='finish')win=d.win;};
 const manage=()=>{
  const plan=plans[index];
  while(next<plan.length) {
   const [kind,cell,degrees=0]=plan[next];
   if(g.canPlace(kind,cell))break;
   g.place(kind,cell,degrees*Math.PI/180);next++;
  }
  if(next===plan.length) {
   for(const t of g.towers)if(t.level===1&&g.compute>=TOWERS[t.type].cost*.8+60&&g.intel>=8)g.upgrade(t,t.type==='interceptor'?1:0);
   for(const [kind,cell,degrees=0] of plan)if(!g.towerAt(cell)&&!g.canPlace(kind,cell))g.place(kind,cell,degrees*Math.PI/180);
  }
  for(const t of g.towers) {
   const nearby=g.enemies.some(e=>!e.dead&&Math.hypot(e.x-t.x,e.y-t.y)<5);
   if(nearby)g.skill(t);
   if(t.hp<t.maxHp*.35&&!g.canPlace('restore',t.cell))g.place('restore',t.cell);
  }
  minCompute=Math.min(minCompute,g.compute);minIntel=Math.min(minIntel,g.intel);
 };
 manage();g.startWave();
 for(let i=0;i<54000&&!g.over;i++) {
  if(i%60===0)manage();
  g.step(1/30);
 }
 console.log(JSON.stringify({map:g.map.name,win,wave:g.wave,integrity:g.integrity,seconds:Math.round(g.time),built:g.stats.built,kills:g.stats.kills,lost:g.stats.lost,destroyed:g.stats.destroyed,healed:Math.round(g.stats.healed),minimumResources:[Math.floor(minCompute),Math.floor(minIntel)]}));
 assert.ok(g.over&&win,'Normal-resource campaign must be winnable: '+g.map.name);
 assert.equal(g.wave,g.map.waves);assert.ok(minCompute>=0&&minIntel>=0);
}
`,
  { console, assert },
  { timeout: 60000 },
);
