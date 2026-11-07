const fs=require('fs');let p='js/demo.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("        api.tower('firewall', 5, 11, { level: 2, hpRatio: 0.6 });", "        api.tower('firewall', 6, 11, { level: 2, hpRatio: 0.6 });");
fs.writeFileSync(p,s);
