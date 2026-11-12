// quick test of KS interpreter (node)
import { parse, Interp } from '../app/js/vm/ks.js';

const src = `
let x = 0;
fn add(a, b) { return a + b; }
while (x < 5) { x = x + 1; }
let y = add(x, 3);
let arr = [1, 2, 3];
let sum = 0;
for (let i = 0; i < arr.length; i = i + 1) { sum = sum + arr[i]; }
let msg = { to: 1, text: "hi " + y };
`;
const ast = parse(src);
const i = new Interp({});
i.start(ast);
let r;
do { r = i.run(50); } while (r.status === 'budget');
console.log('result', r.status, 'x=', i.globals.x, 'y=', i.globals.y, 'sum=', i.globals.sum, 'msg=', JSON.stringify(i.globals.msg));

// test suspend builtin
const src2 = `
let a = 1;
let b = sys.double(a);
let c = b + 1;
`;
const ast2 = parse(src2);
const i2 = new Interp({
  sys: {
    double: (x) => ({ ksSuspend: true, type: 'demo', x })
  }
});
i2.start(ast2);
let r2 = i2.run(1000);
console.log('suspended:', r2.status, r2.suspend);
r2 = i2.run(1000, r2.suspend.x * 2);
console.log('resumed:', r2.status, 'c=', i2.globals.c);
