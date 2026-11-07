const fs=require('fs');
let d=fs.readFileSync('tools/design.js','utf8');
d=d.replace("  m.line(4, 13, 4, 14); m.line(13, 13, 13, 14);\n", "");
d=d.replace("  m.set(4, 14, 'X'); m.set(13, 14, 'Y');", "  m.set(4, 13, 'X'); m.set(13, 13, 'Y');");
d=d.replace("  m.line(5, 13, 5, 14); m.line(11, 13, 11, 14);\n", "");
d=d.replace("  m.set(5, 14, 'X'); m.set(11, 14, 'Y');", "  m.set(5, 13, 'X'); m.set(11, 13, 'Y');");
fs.writeFileSync('tools/design.js',d);
