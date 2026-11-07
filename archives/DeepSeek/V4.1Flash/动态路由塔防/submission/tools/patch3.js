const fs=require('fs');
let d=fs.readFileSync('tools/design.js','utf8');
d=d.replace("  // east branch line (C enters at south-east)\n  m.line(17, 11, 17, 2);\n  m.line(0, 2, 0, 11);", "  // edge old dedicated lines (slower alternatives)\n  m.path([[0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11]], 'o');\n  m.path([[17, 2], [17, 3], [17, 4], [17, 5], [17, 6], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11]], 'o');");
fs.writeFileSync('tools/design.js',d);
