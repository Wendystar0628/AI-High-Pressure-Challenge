const fs=require('fs');let p='js/demo.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("        api.tower('sandbox', 6, 7, { level: 1 });\n        api.tower('repair', 7, 11, { level: 2 });", "        api.tower('sandbox', 7, 7, { level: 1 });\n        api.tower('interceptor', 11, 4, { level: 1, facing: -1.1 });\n        api.tower('repair', 7, 11, { level: 2 });");
fs.writeFileSync(p,s);
