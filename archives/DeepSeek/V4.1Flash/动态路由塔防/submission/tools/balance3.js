const fs=require('fs');let p='js/game.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("return Math.round(def.hp * this.difficulty * (1 + Math.max(0, this.waveIndex) * 0.055));", "return Math.round(def.hp * this.difficulty * (1 + Math.max(0, this.waveIndex) * 0.045));");
fs.writeFileSync(p,s);
