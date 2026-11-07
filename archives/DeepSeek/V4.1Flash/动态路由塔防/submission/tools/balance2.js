const fs = require('fs');
const p = '../js/data.js';
let s = fs.readFileSync(__dirname + '/' + p, 'utf8');
const edits = [
  // enemy pressure to towers / core
  ["id: 'worm', name: '蠕虫', en: 'WORM', kind: 'ground', hp: 78, speed: 1.45, dmg: 11,", "id: 'worm', name: '蠕虫', en: 'WORM', kind: 'ground', hp: 78, speed: 1.45, dmg: 8,"],
  ["reward: 7, integrity: 12,", "reward: 7, integrity: 8,"],
  ["id: 'flood', name: '洪泛团', en: 'FLOOD', kind: 'ground', hp: 210, speed: 1.0, dmg: 30,", "id: 'flood', name: '洪泛团', en: 'FLOOD', kind: 'ground', hp: 210, speed: 1.0, dmg: 22,"],
  ["attackInterval: 1.5, reach: 1.15, block: 2, reward: 12, integrity: 18,", "attackInterval: 1.5, reach: 1.15, block: 2, reward: 12, integrity: 11,"],
  ["id: 'trojan', name: '木马', en: 'TROJAN', kind: 'ground', hp: 120, speed: 1.35, dmg: 16,", "id: 'trojan', name: '木马', en: 'TROJAN', kind: 'ground', hp: 120, speed: 1.35, dmg: 12,"],
  ["attackInterval: 0.9, reach: 1.0, block: 1, reward: 10, integrity: 15,", "attackInterval: 0.9, reach: 1.0, block: 1, reward: 10, integrity: 9,"],
  ["id: 'ransomware', name: '勒索者', en: 'RANSOMWARE', kind: 'ground', hp: 150, speed: 1.1, dmg: 13,", "id: 'ransomware', name: '勒索者', en: 'RANSOMWARE', kind: 'ground', hp: 150, speed: 1.1, dmg: 9,"],
  ["attackInterval: 1.2, reach: 3.3, block: 1, reward: 12, integrity: 16,", "attackInterval: 1.2, reach: 3.3, block: 1, reward: 12, integrity: 9,"],
  ["id: 'hotspot', name: '伪热点', en: 'HOTSPOT', kind: 'air', hp: 105, speed: 2.3, dmg: 0,", "id: 'hotspot', name: '伪热点', en: 'HOTSPOT', kind: 'air', hp: 105, speed: 1.65, dmg: 0,"],
  ["reward: 9, integrity: 11, flying: true,", "reward: 9, integrity: 6, flying: true,"],
  ["id: 'packer', name: '加壳器', en: 'PACKER', kind: 'ground', hp: 260, speed: 0.95, dmg: 18,", "id: 'packer', name: '加壳器', en: 'PACKER', kind: 'ground', hp: 260, speed: 0.95, dmg: 12,"],
  ["attackInterval: 1.2, reach: 1.1, block: 1, reward: 15, integrity: 20,", "attackInterval: 1.2, reach: 1.1, block: 1, reward: 15, integrity: 12,"],
  ["dmg: 65, attackInterval: 1.6, reach: 1.6, block: 2, reward: 90, integrity: 34,", "dmg: 48, attackInterval: 1.6, reach: 1.6, block: 2, reward: 90, integrity: 25,"],
  ["dmg: 40, attackInterval: 1.3, reach: 1.6, block: 2, reward: 95, integrity: 34,", "dmg: 32, attackInterval: 1.3, reach: 1.6, block: 2, reward: 95, integrity: 25,"],
  ["dmg: 55, attackInterval: 1.4, reach: 1.7, block: 2, reward: 120, integrity: 40,", "dmg: 42, attackInterval: 1.4, reach: 1.7, block: 2, reward: 120, integrity: 28,"],
  // interceptor reach / cone
  ["hp: [185, 245], dmg: [26, 40], rate: [1.05, 1.15], range: [4.3, 4.6], cone: 42,", "hp: [185, 245], dmg: [26, 40], rate: [1.05, 1.15], range: [4.8, 5.1], cone: 48,"],
  ["{ label: 'Lv.1 · 单装拦截炮', hp: 185, dmg: 26, rate: 1.05, range: 4.3 }", "{ label: 'Lv.1 · 单装拦截炮', hp: 185, dmg: 26, rate: 1.05, range: 4.8 }"],
  ["{ label: 'Lv.2 · 二选一分支', hp: 245, dmg: 40, rate: 1.15, range: 4.6, branch: true }", "{ label: 'Lv.2 · 二选一分支', hp: 245, dmg: 40, rate: 1.15, range: 5.1, branch: true }"],
  // sturdier towers
  ["hp: [330, 470], dmg: [10, 16]", "hp: [380, 530], dmg: [10, 16]"],
  ["{ label: 'Lv.1 · 包过滤墙', hp: 330, dmg: 10, rate: 1.1, range: 1.8, block: 2 }", "{ label: 'Lv.1 · 包过滤墙', hp: 380, dmg: 10, rate: 1.1, range: 1.8, block: 2 }"],
  ["{ label: 'Lv.2 · 状态检测墙', hp: 470, dmg: 16, rate: 1.25, range: 2.0, block: 3", "{ label: 'Lv.2 · 状态检测墙', hp: 530, dmg: 16, rate: 1.25, range: 2.0, block: 3"],
  ["hp: [165, 240], lureRadius: [3.2, 4.2], lureCap: [3, 5]", "hp: [210, 300], lureRadius: [3.2, 4.2], lureCap: [3, 5]"],
  ["{ label: 'Lv.1 · 伪装应答器', hp: 165, lureRadius: 3.2, lureCap: 3 }", "{ label: 'Lv.1 · 伪装应答器', hp: 210, lureRadius: 3.2, lureCap: 3 }"],
  ["{ label: 'Lv.2 · 二选一分支', hp: 240, lureRadius: 4.0, lureCap: 4, branch: true }", "{ label: 'Lv.2 · 二选一分支', hp: 300, lureRadius: 4.0, lureCap: 4, branch: true }"],
  ["hp: 250, lureRadius: 4.4, lureCap: 6, markBonus: 0.12", "hp: 310, lureRadius: 4.4, lureCap: 6, markBonus: 0.12"],
  ["hp: 300, lureRadius: 3.6, lureCap: 2, dot: 14", "hp: 360, lureRadius: 3.6, lureCap: 2, dot: 14"],
  ["hp: [195, 255], heal: [19, 29], healRange: [3.8, 4.2]", "hp: [215, 280], heal: [23, 34], healRange: [3.8, 4.2]"],
  ["{ label: 'Lv.1 · 热备修复线程', hp: 195, heal: 19, healRange: 3.8 }", "{ label: 'Lv.1 · 热备修复线程', hp: 215, heal: 23, healRange: 3.8 }"],
  ["{ label: 'Lv.2 · 冗余修复线程', hp: 255, heal: 29, healRange: 4.2", "{ label: 'Lv.2 · 冗余修复线程', hp: 280, heal: 34, healRange: 4.2"],
  ["hp: [205, 270], dmg: [15, 23]", "hp: [230, 300], dmg: [15, 23]"],
  ["{ label: 'Lv.1 · 行为沙箱', hp: 205, dmg: 15, rate: 0.85, range: 3.2, aoe: 2.2, detect: 3.6 }", "{ label: 'Lv.1 · 行为沙箱', hp: 230, dmg: 15, rate: 0.85, range: 3.2, aoe: 2.2, detect: 3.8 }"],
  ["{ label: 'Lv.2 · 深度沙箱', hp: 270, dmg: 23, rate: 0.95, range: 3.5, aoe: 2.5, detect: 4.1 }", "{ label: 'Lv.2 · 深度沙箱', hp: 300, dmg: 23, rate: 0.95, range: 3.5, aoe: 2.5, detect: 4.3 }"]
];
let count = 0;
for (const [a, b] of edits) {
  if (s.includes(a)) { s = s.replace(a, b); count++; }
  else console.log('MISS:', a.slice(0, 60));
}
fs.writeFileSync(__dirname + '/' + p, s);
console.log('applied', count, '/', edits.length);
