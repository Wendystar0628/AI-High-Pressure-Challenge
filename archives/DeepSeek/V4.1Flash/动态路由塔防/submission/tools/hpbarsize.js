const fs=require('fs');let p='js/engine.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("      bg.scale.set(2.35, 0.14, 1); fill.scale.set(2.35, 0.1, 1);", "      bg.scale.set(2.7, 0.22, 1); fill.scale.set(2.7, 0.15, 1);");
s=s.replace("              hb.fill.scale.set(2.35 * ratio, 0.1, 1);\n              hb.fill.center.set(0, 0.5); hb.fill.position.x = -1.175;", "              hb.fill.scale.set(2.7 * ratio, 0.15, 1);\n              hb.fill.center.set(0, 0.5); hb.fill.position.x = -1.35;");
s=s.replace("              hb.wrap.position.y = tw.cell.platform ? 3.8 : 3.35;", "              hb.wrap.position.y = tw.cell.platform ? 4.0 : 3.5;");
fs.writeFileSync(p,s);
