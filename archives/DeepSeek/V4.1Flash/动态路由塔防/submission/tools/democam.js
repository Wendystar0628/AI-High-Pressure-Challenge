const fs=require('fs');let p='js/demo.js';let s=fs.readFileSync(p,'utf8');
const old=`      if (!keys || !keys.length) return { cell: { x: 8, y: 7 }, yaw: -0.5, pitch: 1.0, dist: 110 };
      if (t <= keys[0].t) return keys[0];
      if (t >= keys[keys.length - 1].t) return keys[keys.length - 1];`;
const neu=`      if (!keys || !keys.length) return { cell: { x: 8, y: 7 }, yaw: -0.5, pitch: 1.0, dist: 110 };
      const normalize = k => ({
        cell: { x: Array.isArray(k.cell) ? k.cell[0] : k.cell.x, y: Array.isArray(k.cell) ? k.cell[1] : k.cell.y },
        yaw: k.yaw, pitch: k.pitch, dist: k.dist
      });
      if (t <= keys[0].t) return normalize(keys[0]);
      if (t >= keys[keys.length - 1].t) return normalize(keys[keys.length - 1]);`;
if(!s.includes(old)) console.log('camera block not found'); else s=s.replace(old,neu);
fs.writeFileSync(p,s);
