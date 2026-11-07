const fs=require('fs');let p='js/demo.js';let s=fs.readFileSync(p,'utf8');
// demo 2 valid placements
s=s.replace("        api.tower('repair', 11, 12, { level: 2 });\n        api.tower('firewall', 13, 9, { level: 1, hpRatio: 0.55 });\n        api.tower('honeypot', 4, 11, { level: 1, hpRatio: 0.5 });", "        api.tower('repair', 11, 13, { level: 2 });\n        api.tower('firewall', 12, 9, { level: 1, hpRatio: 0.55 });\n        api.tower('honeypot', 5, 11, { level: 1, hpRatio: 0.5 });");
// demo 3 valid platforms
s=s.replace("        api.tower('interceptor', 10, 12, { level: 2, branch: 'suppress', facing: 0.9, hpRatio: 0.9 });\n        api.tower('firewall', 10, 11, { level: 2, hpRatio: 0.7 });\n        api.tower('firewall', 5, 11, { level: 2, hpRatio: 0.6 });\n        api.tower('repair', 6, 12, { level: 2, hpRatio: 1 });", "        api.tower('interceptor', 8, 10, { level: 2, branch: 'suppress', facing: 0.9, hpRatio: 0.9 });\n        api.tower('firewall', 10, 11, { level: 2, hpRatio: 0.7 });\n        api.tower('firewall', 5, 11, { level: 2, hpRatio: 0.6 });\n        api.tower('repair', 8, 4, { level: 2, hpRatio: 1 });");
s=s.replace("        { t: 13.2, cell: [6, 12], yaw: -0.35, pitch: 0.9, dist: 44 },", "        { t: 13.2, cell: [8, 10], yaw: -0.35, pitch: 0.9, dist: 48 },");
fs.writeFileSync(p,s);
