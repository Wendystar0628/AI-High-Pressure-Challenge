const fs=require('fs');let p='js/ui.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("      const overCard = this.placementEl && this.placementEl.contains(e.target);", "      const overCard = this.placementEl && e.target instanceof Node && this.placementEl.contains(e.target);");
fs.writeFileSync(p,s);
