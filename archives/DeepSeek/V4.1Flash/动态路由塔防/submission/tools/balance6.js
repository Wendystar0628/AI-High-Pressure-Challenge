const fs = require('fs');
const resolve = p => __dirname + '/../' + p;
let d = fs.readFileSync(resolve('js/data.js'), 'utf8');
const ed = [
  ["startCompute: 330, startIntel: 60,", "startCompute: 420, startIntel: 65,"],
  ["startCompute: 350, startIntel: 62,", "startCompute: 440, startIntel: 70,"],
  ["startCompute: 370, startIntel: 66,", "startCompute: 460, startIntel: 75,"],
  ["icon: 'shield', color: '#57e0ff', cost: { compute: 65, intel: 0 },", "icon: 'shield', color: '#57e0ff', cost: { compute: 55, intel: 0 },"],
  ["icon: 'honey', color: '#ff8ad8', cost: { compute: 55, intel: 0 },", "icon: 'honey', color: '#ff8ad8', cost: { compute: 45, intel: 0 },"],
  ["icon: 'gap', color: '#8df5b8', cost: { compute: 34, intel: 16 },", "icon: 'gap', color: '#8df5b8', cost: { compute: 30, intel: 14 },"],
  ["icon: 'turret', color: '#7fb4ff', cost: { compute: 92, intel: 0 },", "icon: 'turret', color: '#7fb4ff', cost: { compute: 80, intel: 0 },"],
  ["icon: 'sandbox', color: '#5ff0d2', cost: { compute: 86, intel: 0 },", "icon: 'sandbox', color: '#5ff0d2', cost: { compute: 76, intel: 0 },"],
  ["icon: 'repair', color: '#9dff9d', cost: { compute: 80, intel: 0 },", "icon: 'repair', color: '#9dff9d', cost: { compute: 70, intel: 0 },"],
  ["costLv2: { compute: 110, intel: 22 }", "costLv2: { compute: 90, intel: 18 }"],
  ["costLv2: { compute: 95, intel: 30 }", "costLv2: { compute: 80, intel: 25 }"],
  ["costLv2: { compute: 100, intel: 26 }", "costLv2: { compute: 80, intel: 20 }"],
  ["costLv2: { compute: 130, intel: 30 }", "costLv2: { compute: 110, intel: 25 }"],
  ["costLv2: { compute: 115, intel: 24 }", "costLv2: { compute: 95, intel: 20 }"],
  ["costLv2: { compute: 105, intel: 26 }", "costLv2: { compute: 90, intel: 22 }"]
];
let n = 0;
for (const [a, b] of ed) { if (d.includes(a)) { d = d.replace(a, b); n++; } else console.log('MISS data', a.slice(0, 50)); }
fs.writeFileSync(resolve('js/data.js'), d);

let g = fs.readFileSync(resolve('js/game.js'), 'utf8');
const ged = [
  ["this.prepTimer = opts.prepTime != null ? opts.prepTime : 8;", "this.prepTimer = opts.prepTime != null ? opts.prepTime : 10;"],
  ["this.beginPrep(8);", "this.beginPrep(10);"],
  ["const rate = (this.waveState === 'active' ? 3.0 : 1.5) * (this.over ? 0 : 1);", "const rate = (this.waveState === 'active' ? 4.2 : 2.2) * (this.over ? 0 : 1);"],
  ["this.beginPrep(7);", "this.beginPrep(8);"],
  ["const nerf = this.waveIndex >= 4 ? 0.82 : 1;", "const nerf = this.waveIndex >= 4 ? 0.82 : this.waveIndex <= 1 ? 0.68 : 0.85;"]
];
for (const [a, b] of ged) { if (g.includes(a)) { g = g.replace(a, b); n++; } else console.log('MISS game', a.slice(0, 50)); }
fs.writeFileSync(resolve('js/game.js'), g);
console.log('applied', n);
