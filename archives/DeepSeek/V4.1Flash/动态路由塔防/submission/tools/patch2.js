const fs=require('fs');
let d=fs.readFileSync('tools/design.js','utf8');
d=d.replace("  // C branch + cross links\n  m.line(0, 11, 3, 11);", "  // C route: straight east to the Y-side aggregation trunk\n  m.line(0, 11, 13, 11);\n  // west edge alternate\n  m.line(0, 2, 0, 11);");
d=d.replace("  m.line(0, 2, 0, 11);\n  // platforms", "  // platforms");
d=d.replace("m.path([[4, 10], [4, 11], [8, 11], [8, 10]], 'o');\n  m.path([[8, 10], [8, 11], [13, 11], [13, 10]], 'o');", "m.path([[4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10], [11, 10], [12, 10], [13, 10]], 'o');");
fs.writeFileSync('tools/design.js',d);
