const fs = require("node:fs");
const vm = require("node:vm");
vm.runInNewContext(
  fs.readFileSync("data.js", "utf8") +
    "\n" +
    fs.readFileSync("engine.js", "utf8") +
    `
for (let index=0;index<3;index++) {
 const g=new Game(index);g.compute=100000;g.intel=10000;
 const roads=Object.values(g.routes).flatMap(p=>p.cells).map(id=>g.cell(id));
 g.map.platforms.forEach((c,i)=>{
  const near=roads.slice().sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0];
  const type=i%6===0?'repair':i%6===1?'sandbox':'interceptor';
  const t=g.place(type,c.id,Math.atan2(near.x-c.x,near.y-c.y));
  if(t)g.upgrade(t,i%2);
 });
 for(const p of Object.values(g.routes)) {
   const id=p.cells.at(-3);if(g.cell(id).type==='road'&&!g.towerAt(id))g.place('firewall',id);
 }
 g.startWave();
 for(let i=0;i<36000&&!g.over;i++) {
  if(i%180===0)g.towers.forEach(t=>g.skill(t));
  g.step(1/30);
 }
 console.log(JSON.stringify({map:g.map.name,finished:g.over,wave:g.wave,integrity:g.integrity,time:Math.round(g.time),kills:g.stats.kills,losses:g.stats.destroyed,remaining:g.enemies.map(e=>({type:e.type,cell:e.cell}))}));
 if(!g.over)throw new Error('Campaign did not terminate');
}
`,
  { console },
  { timeout: 60000 },
);
