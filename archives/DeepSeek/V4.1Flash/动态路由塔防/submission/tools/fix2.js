const fs=require('fs');let p='js/engine.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("      this.selRing = null; this.selBrackets = null;\n      this.labelGroup = null;", "      this.selRing = null; this.selBrackets = null;\n      this.labelGroup = null; this.citySpires = null; this.floatCubes = null; this.scanRing = null;");
fs.writeFileSync(p,s);
