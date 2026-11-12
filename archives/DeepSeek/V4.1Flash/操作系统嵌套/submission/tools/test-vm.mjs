import { compileProgram, createVM, runVM } from '../src/lang/vm.js';

const src = `
var n = 0;
function add(a, b) { return a + b; }
function main() {
  var list = [];
  var i = 0;
  while (i < 5) {
    if (i % 2 == 0) { list = list + [i * 10]; } else { print("odd " + i); }
    i = i + 1;
  }
  print("list=" + list);
  print("sum=" + add(list[0], list[2]));
  for (var j = 0; j < 3; j = j + 1) {
    print("j" + j);
  }
}
`;
try {
  const prog = compileProgram(src, 'test.prog');
  const vm = createVM(prog);
  let logs = [];
  const ctx = {
    hasNative: (id) => id === 'fn:print',
    nativeCall: (id, args) => { logs.push(args.join(' ')); return null; },
  };
  let steps = 0;
  while (!vm.done && steps < 1000) {
    const r = runVM(vm, 100, ctx);
    steps += r.steps;
    if (r.status === 'error') throw new Error(r.error);
    if (r.status === 'blocked') break;
  }
  console.log(logs.join('\n'));
  console.log('steps', steps, 'done', vm.done);
} catch (e) { console.error('FAIL', e); process.exit(1); }
