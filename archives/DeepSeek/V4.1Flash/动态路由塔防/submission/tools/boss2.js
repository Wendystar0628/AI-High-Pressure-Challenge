const fs=require('fs');let d=fs.readFileSync('js/data.js','utf8');
d=d.replace("id: 'boss_zheying', name: '蛰影', en: 'ZHEYING', kind: 'ground', boss: true, hp: 4200, speed: 0.55,", "id: 'boss_zheying', name: '蛰影', en: 'ZHEYING', kind: 'ground', boss: true, hp: 2800, speed: 0.5,");
fs.writeFileSync('js/data.js',d);
let p='js/demo.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("        const boss = api.boss('boss_zheying', 4, 4, { hpRatio: 0.72, revealed: false, speed: 0.5, phaseCount: 0 });", "        const boss = api.boss('boss_zheying', 4, 4, { hpRatio: 0.72, revealed: false, speed: 0.5, phaseCount: 0 });\n        if (boss) { boss.maxHp = 5200; boss.hp = boss.maxHp * 0.72; }");
fs.writeFileSync(p,s);
