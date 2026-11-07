const fs = require('fs');
const p = require('path').join(__dirname, 'src', 'app.js');
let s = fs.readFileSync(p, 'utf8');
s = s.split("from '../").join("from './");
fs.writeFileSync(p, s);
console.log('fixed app.js imports');
