const fs=require('fs');let p='js/demo.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("        api.tower('interceptor', 8, 10, { level: 2, branch: 'suppress', facing: 0.9, hpRatio: 0.9 });", "        api.tower('interceptor', 8, 4, { level: 2, branch: 'suppress', facing: 0.9, hpRatio: 0.9 });");
s=s.replace("        api.tower('repair', 8, 4, { level: 2, hpRatio: 1 });", "        api.tower('repair', 8, 10, { level: 2, hpRatio: 1 });");
s=s.replace("        { t: 13.2, cell: [8, 4], yaw: -0.35, pitch: 0.9, dist: 48 },", "        { t: 13.2, cell: [8, 10], yaw: -0.35, pitch: 0.9, dist: 48 },");
fs.writeFileSync(p,s);
