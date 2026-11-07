const fs=require('fs');let d=fs.readFileSync('js/data.js','utf8');
d=d.replace("id: 'boss_zheying', name: '蛰影', en: 'ZHEYING', kind: 'ground', boss: true, hp: 2800, speed: 0.3,", "id: 'boss_zheying', name: '蛰影', en: 'ZHEYING', kind: 'ground', boss: true, hp: 2200, speed: 0.3,");
fs.writeFileSync('js/data.js',d);
