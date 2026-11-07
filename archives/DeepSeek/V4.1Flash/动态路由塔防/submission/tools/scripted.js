const fs=require('fs');let p='js/game.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("    updateWave(dt) {\n      if (this.waveState === 'prep') {", "    updateWave(dt) {\n      if (this.scripted) return;\n      if (this.waveState === 'prep') {");
fs.writeFileSync(p,s);
