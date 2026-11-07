const fs=require('fs');let p='js/demo.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("{ t: 5.1, text: '沙箱捕捉到异常行为，蛰影显形。' },", "{ t: 4.3, text: '沙箱捕捉到异常行为，蛰影显形。' },");
fs.writeFileSync(p,s);
