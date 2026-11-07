const fs=require('fs');
let d=fs.readFileSync('js/data.js','utf8');
const ed=[
 ["id: 'boss_wankui', name: '万傀', en: 'MYRIAD', kind: 'ground', boss: true, hp: 4200, speed: 0.62,","id: 'boss_wankui', name: '万傀', en: 'MYRIAD', kind: 'ground', boss: true, hp: 3600, speed: 0.55,"],
 ["id: 'boss_mirage', name: '蜃楼', en: 'MIRAGE', kind: 'ground', boss: true, hp: 4400, speed: 0.7,","id: 'boss_mirage', name: '蜃楼', en: 'MIRAGE', kind: 'ground', boss: true, hp: 3800, speed: 0.6,"],
 ["id: 'boss_zheying', name: '蛰影', en: 'ZHEYING', kind: 'ground', boss: true, hp: 5200, speed: 0.68,","id: 'boss_zheying', name: '蛰影', en: 'ZHEYING', kind: 'ground', boss: true, hp: 4200, speed: 0.55,"],
 ["dmg: 48, attackInterval: 1.6, reach: 1.6, block: 2, reward: 90, integrity: 18,","dmg: 48, attackInterval: 1.6, reach: 1.6, block: 2, reward: 90, integrity: 30,"],
 ["dmg: 32, attackInterval: 1.3, reach: 1.6, block: 2, reward: 95, integrity: 18,","dmg: 32, attackInterval: 1.3, reach: 1.6, block: 2, reward: 95, integrity: 30,"],
 ["dmg: 42, attackInterval: 1.4, reach: 1.7, block: 2, reward: 120, integrity: 22,","dmg: 42, attackInterval: 1.4, reach: 1.7, block: 2, reward: 120, integrity: 38,"]
];
let n=0;for(const [a,b] of ed){if(d.includes(a)){d=d.replace(a,b);n++;}else console.log('MISS',a.slice(0,40));}
fs.writeFileSync('js/data.js',d);
let g=fs.readFileSync('js/game.js','utf8');
g=g.replace("const score = -remaining * 10 + (e.def.boss ? 3 : 0) + (e.shield > 0 ? -0.2 : 0);", "const score = -remaining * 10 + (e.def.boss ? 500 : 0) + (e.shield > 0 ? -0.2 : 0);");
fs.writeFileSync('js/game.js',g);
console.log('applied',n);
