const fs=require('fs');const p='js/data.js';let s=fs.readFileSync(p,'utf8');
// Locate map3 rows block and patch four void cells into equipment platforms.
const start=s.indexOf("id: 'airgap'");
const blockStart=s.indexOf('rows: [', start);
const blockEnd=s.indexOf(']', blockStart);
let block=s.slice(blockStart, blockEnd);
const lines=block.split('\n');
function setChar(line, idx, ch){ const m=line.match(/^\s*"([^"]*)"/); if(!m) return line; let a=m[1].split(''); a[idx]=ch; return line.replace('"'+m[1]+'"','"'+a.join('')+'"'); }
// row4 x5,x11 ; row5 x3,x13
let rowIndex=0;
for(let i=0;i<lines.length;i++){
  if(lines[i].includes('"')) {
    if(rowIndex===4){ lines[i]=setChar(lines[i],5,'P'); lines[i]=setChar(lines[i],11,'P'); }
    if(rowIndex===5){ lines[i]=setChar(lines[i],3,'P'); lines[i]=setChar(lines[i],13,'P'); }
    rowIndex++;
  }
}
block=lines.join('\n');
s=s.slice(0,blockStart)+block+s.slice(blockEnd);
fs.writeFileSync(p,s);
