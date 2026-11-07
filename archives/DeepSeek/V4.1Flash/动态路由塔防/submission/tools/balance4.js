const fs = require('fs');
const path = __dirname + '/../js/data.js';
let s = fs.readFileSync(path, 'utf8');
const edits = [
  // stronger towers
  ["hp: [380, 530], dmg: [10, 16], rate: [1.1, 1.25], range: [1.8, 2.0],", "hp: [420, 580], dmg: [14, 24], rate: [1.1, 1.25], range: [2.0, 2.2],"],
  ["hp: [380, 530], dmg: [14, 24], rate: [1.1, 1.25], range: [2.0, 2.2],", "hp: [420, 580], dmg: [14, 24], rate: [1.1, 1.25], range: [2.0, 2.2],"],
  ["{ label: 'Lv.1 · 包过滤墙', hp: 380, dmg: 10, rate: 1.1, range: 1.8, block: 2 }", "{ label: 'Lv.1 · 包过滤墙', hp: 420, dmg: 14, rate: 1.1, range: 2.0, block: 3 }"],
  ["{ label: 'Lv.2 · 状态检测墙', hp: 530, dmg: 16, rate: 1.25, range: 2.0, block: 3", "{ label: 'Lv.2 · 状态检测墙', hp: 580, dmg: 24, rate: 1.25, range: 2.2, block: 4"],
  ["hp: [185, 245], dmg: [26, 40], rate: [1.05, 1.15], range: [4.8, 5.1], cone: 48,", "hp: [210, 280], dmg: [34, 52], rate: [1.05, 1.15], range: [5.0, 5.3], cone: 50,"],
  ["{ label: 'Lv.1 · 单装拦截炮', hp: 185, dmg: 26, rate: 1.05, range: 4.8 }", "{ label: 'Lv.1 · 单装拦截炮', hp: 210, dmg: 34, rate: 1.05, range: 5.0 }"],
  ["{ label: 'Lv.2 · 二选一分支', hp: 245, dmg: 40, rate: 1.15, range: 5.1, branch: true }", "{ label: 'Lv.2 · 二选一分支', hp: 280, dmg: 52, rate: 1.15, range: 5.3, branch: true }"],
  ["hp: 250, dmg: 46, rate: 0.82, pierce: 3", "hp: 285, dmg: 58, rate: 0.86, pierce: 3"],
  ["hp: 260, dmg: 30, rate: 1.4, slow: 0.35, slowTime: 2.5", "hp: 300, dmg: 40, rate: 1.4, slow: 0.35, slowTime: 2.5"],
  ["hp: [230, 300], dmg: [15, 23], rate: [0.85, 0.95], range: [3.2, 3.5], aoe: [2.2, 2.5],", "hp: [250, 320], dmg: [20, 30], rate: [0.9, 1.0], range: [3.4, 3.7], aoe: [2.5, 2.8],"],
  ["{ label: 'Lv.1 · 行为沙箱', hp: 230, dmg: 15, rate: 0.85, range: 3.2, aoe: 2.2, detect: 3.8 }", "{ label: 'Lv.1 · 行为沙箱', hp: 250, dmg: 20, rate: 0.9, range: 3.4, aoe: 2.5, detect: 3.8 }"],
  ["{ label: 'Lv.2 · 深度沙箱', hp: 300, dmg: 23, rate: 0.95, range: 3.5, aoe: 2.5, detect: 4.3 }", "{ label: 'Lv.2 · 深度沙箱', hp: 320, dmg: 30, rate: 1.0, range: 3.7, aoe: 2.8, detect: 4.3 }"],
  // slightly softer enemies
  ["id: 'worm', name: '蠕虫', en: 'WORM', kind: 'ground', hp: 78,", "id: 'worm', name: '蠕虫', en: 'WORM', kind: 'ground', hp: 68,"],
  ["id: 'flood', name: '洪泛团', en: 'FLOOD', kind: 'ground', hp: 210,", "id: 'flood', name: '洪泛团', en: 'FLOOD', kind: 'ground', hp: 175,"],
  ["id: 'trojan', name: '木马', en: 'TROJAN', kind: 'ground', hp: 120,", "id: 'trojan', name: '木马', en: 'TROJAN', kind: 'ground', hp: 100,"],
  ["id: 'ransomware', name: '勒索者', en: 'RANSOMWARE', kind: 'ground', hp: 150,", "id: 'ransomware', name: '勒索者', en: 'RANSOMWARE', kind: 'ground', hp: 125,"],
  ["id: 'packer', name: '加壳器', en: 'PACKER', kind: 'ground', hp: 260,", "id: 'packer', name: '加壳器', en: 'PACKER', kind: 'ground', hp: 220,"],
  ["id: 'hotspot', name: '伪热点', en: 'HOTSPOT', kind: 'air', hp: 105,", "id: 'hotspot', name: '伪热点', en: 'HOTSPOT', kind: 'air', hp: 90,"]
];
let n = 0;
for (const [a, b] of edits) {
  if (s.includes(a)) { s = s.replace(a, b); n++; }
  else console.log('MISS', a.slice(0, 50));
}
fs.writeFileSync(path, s);
console.log('applied', n);
