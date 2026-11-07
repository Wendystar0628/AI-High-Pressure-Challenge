const fs=require('fs');
let p='js/demo.js';let s=fs.readFileSync(p,'utf8');
// demo1 invalid platform spawn
s=s.replace("api.action(4.6, () => api.enemy('worm', 4, 4, { speed: 0.5 }));", "api.action(4.6, () => api.enemy('worm', 5, 4, { speed: 0.5 }));");
// demo2 valid cells
s=s.replace("        api.enemy('flood', 12, 11, { rushNode: api.cell(13, 11), hpRatio: 0.9 });\n        api.enemy('flood', 13, 10, { rushNode: api.cell(13, 11), hpRatio: 0.8 });", "        api.enemy('flood', 14, 11, { rushNode: api.cell(13, 11), hpRatio: 0.9 });\n        api.enemy('flood', 13, 12, { rushNode: api.cell(13, 11), hpRatio: 0.8 });");
s=s.replace("        api.enemy('ransomware', 13, 4, { hpRatio: 0.9 });", "        api.enemy('ransomware', 14, 4, { hpRatio: 0.9 });\n        api.enemy('ransomware', 10, 4, { hpRatio: 0.8 });");
s=s.replace("        api.action(7.8, () => api.enemy('worm', 9, 1, {}));", "        api.action(7.8, () => api.enemy('worm', 9, 2, {}));");
s=s.replace("        api.action(9.4, () => api.enemy('flood', 13, 9, { rushNode: api.cell(13, 11), hpRatio: 0.7 }));", "        api.action(9.4, () => api.enemy('flood', 14, 11, { rushNode: api.cell(13, 11), hpRatio: 0.7 }));");
s=s.replace("        api.action(10.6, () => api.enemy('trojan', 3, 3, { revealed: false }));", "        api.action(10.6, () => api.enemy('trojan', 3, 2, { revealed: false }));");
s=s.replace("        api.action(13.0, () => api.enemy('ransomware', 13, 3, {}));", "        api.action(13.0, () => api.enemy('ransomware', 14, 4, {}));");
s=s.replace("        api.action(14.2, () => api.enemy('flood', 12, 11, { rushNode: api.cell(13, 11) }));", "        api.action(14.2, () => api.enemy('flood', 13, 12, { rushNode: api.cell(13, 11) }));");
s=s.replace("        { t: 9.2, cell: [3.5, 3], yaw: -0.3, pitch: 0.95, dist: 52 },\n        { t: 11.8, cell: [3.5, 3], yaw: -0.3, pitch: 0.9, dist: 46 },", "        { t: 9.2, cell: [3, 2], yaw: -0.3, pitch: 0.95, dist: 52 },\n        { t: 11.8, cell: [3, 2], yaw: -0.3, pitch: 0.9, dist: 46 },");
s=s.replace("          const a = api.card('downgrade'), b = api.pos(api.cell(3, 3), 0.8);", "          const a = api.card('downgrade'), b = api.pos(api.cell(3, 2), 0.8);");
s=s.replace("            global.UI.placement.cell = api.cell(3, 3);\n            global.UI.attemptPlacement(api.cell(3, 3));", "            global.UI.placement.cell = api.cell(3, 2);\n            global.UI.attemptPlacement(api.cell(3, 2));");
s=s.replace("          demo.cursor = t < 13.5 ? api.pos(api.cell(3, 3), 0.8) : { x: innerWidth * 0.55, y: innerHeight * 0.54 };", "          demo.cursor = t < 13.5 ? api.pos(api.cell(3, 2), 0.8) : { x: innerWidth * 0.55, y: innerHeight * 0.54 };");
// demo3 invalid platform enemy spawns
s=s.replace("        api.enemy('trojan', 13, 6, { revealed: false });", "        api.enemy('trojan', 14, 6, { revealed: false });");
s=s.replace("        api.action(8.4, () => api.enemy('trojan', 13, 5, { revealed: false }));", "        api.action(8.4, () => api.enemy('trojan', 14, 6, { revealed: false }));");
s=s.replace("        api.action(10.8, () => api.enemy('trojan', 13, 5, { revealed: false }));", "        api.action(10.8, () => api.enemy('trojan', 14, 8, { revealed: false }));");
s=s.replace("        { t: 13.2, cell: [8, 10], yaw: -0.35, pitch: 0.9, dist: 48 },", "        { t: 13.2, cell: [8, 4], yaw: -0.35, pitch: 0.9, dist: 48 },");
fs.writeFileSync(p,s);
// Guard demo spawns on non-walkable cells
let q='js/game.js';let g=fs.readFileSync(q,'utf8');
g=g.replace("    spawnAdd(type, cell, opts) {\n      opts = opts || {};", "    spawnAdd(type, cell, opts) {\n      opts = opts || {};\n      if (!cell || !cell.walk) return null;");
fs.writeFileSync(q,g);
