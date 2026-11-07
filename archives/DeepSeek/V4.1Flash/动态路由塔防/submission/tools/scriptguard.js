const fs=require('fs');let p='js/game.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("    finishVictory() {\n      if (this.over) return;", "    finishVictory() {\n      if (this.over || this.scripted) return;");
fs.writeFileSync(p,s);
