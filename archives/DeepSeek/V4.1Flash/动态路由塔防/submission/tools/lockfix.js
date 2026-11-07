const fs=require('fs');let p='js/game.js';let s=fs.readFileSync(p,'utf8');
const old=`        if (v.sealed.length || v.stuck.length) {
          // fallback to a safe single cell
          cells = [];
          for (const c of this.map.cells) {
            if (!c.walk || c.type === 'entrance' || c.type === 'exit' || c.isolation) continue;
            const bs = new Set([KEY(c.x, c.y)]);
            const vv = this.map.wouldSeal(bs, this.enemies);
            if (!vv.sealed.length && !vv.stuck.length) { cells = [c]; break; }
          }
        }`;
const neu=`        if (v.sealed.length || v.stuck.length) {
          const prefer = cells[0] || e.cell;
          const alt = this.findSafeLockCell(prefer);
          cells = alt ? [alt] : [];
        }`;
if(!s.includes(old)) console.log('fallback block not found'); else s=s.replace(old,neu);
fs.writeFileSync(p,s);
