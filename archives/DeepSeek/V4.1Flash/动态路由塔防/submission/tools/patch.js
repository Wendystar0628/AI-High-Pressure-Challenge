const fs=require('fs');
let d=fs.readFileSync('tools/design.js','utf8');
d=d.replace("const out = { m1: map1(), m2: map2(), m3: map3() };", `let out = { m1: map1(), m2: map2(), m3: map3() };
out.m1[3]='A'+out.m1[3].slice(1); out.m1[0]='#########B#########';
out.m2[2]='A'+out.m2[2].slice(1,17)+'B'; out.m2[11]='C'+out.m2[11].slice(1);
out.m3[0]='########B########'; out.m3[2]='A'+out.m3[2].slice(1); out.m3[5]=out.m3[5].slice(0,16)+'C';`);
fs.writeFileSync('tools/design.js',d);
