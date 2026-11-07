const fs = require('fs');
const L = require(__dirname + '/layouts.json');
let d = fs.readFileSync(__dirname + '/../js/data.js', 'utf8');
const gens = [L.m1, L.m2, L.m3];
let i = 0;
d = d.replace(/rows: \[[\s\S]*?\n      \]/g, () => {
  const rows = gens[i++];
  return 'rows: [\n' + rows.map(r => '        ' + JSON.stringify(r)).join(',\n') + '\n      ]';
});
fs.writeFileSync(__dirname + '/../js/data.js', d);
console.log('patched', i);
