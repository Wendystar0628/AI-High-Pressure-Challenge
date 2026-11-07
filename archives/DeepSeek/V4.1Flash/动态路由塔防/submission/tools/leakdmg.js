const fs=require('fs');const p='js/data.js';let s=fs.readFileSync(p,'utf8');
const ed=[
 ["reward: 7, integrity: 8,","reward: 7, integrity: 5,"],
 ["attackInterval: 1.5, reach: 1.15, block: 2, reward: 12, integrity: 11,","attackInterval: 1.5, reach: 1.15, block: 2, reward: 12, integrity: 7,"],
 ["attackInterval: 0.9, reach: 1.0, block: 1, reward: 10, integrity: 9,","attackInterval: 0.9, reach: 1.0, block: 1, reward: 10, integrity: 6,"],
 ["attackInterval: 1.2, reach: 3.3, block: 1, reward: 12, integrity: 9,","attackInterval: 1.2, reach: 3.3, block: 1, reward: 12, integrity: 6,"],
 ["reward: 9, integrity: 6, flying: true,","reward: 9, integrity: 4, flying: true,"],
 ["attackInterval: 1.2, reach: 1.1, block: 1, reward: 15, integrity: 12,","attackInterval: 1.2, reach: 1.1, block: 1, reward: 15, integrity: 8,"],
 ["dmg: 48, attackInterval: 1.6, reach: 1.6, block: 2, reward: 90, integrity: 25,","dmg: 48, attackInterval: 1.6, reach: 1.6, block: 2, reward: 90, integrity: 18,"],
 ["dmg: 32, attackInterval: 1.3, reach: 1.6, block: 2, reward: 95, integrity: 25,","dmg: 32, attackInterval: 1.3, reach: 1.6, block: 2, reward: 95, integrity: 18,"],
 ["dmg: 42, attackInterval: 1.4, reach: 1.7, block: 2, reward: 120, integrity: 28,","dmg: 42, attackInterval: 1.4, reach: 1.7, block: 2, reward: 120, integrity: 22,"]
];
let n=0;for(const [a,b] of ed){if(s.includes(a)){s=s.replace(a,b);n++;}else console.log('MISS',a.slice(0,40));}
fs.writeFileSync(p,s);console.log('applied',n);
