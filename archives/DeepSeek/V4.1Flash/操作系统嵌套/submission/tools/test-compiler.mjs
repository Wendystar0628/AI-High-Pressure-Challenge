import { compileProgram, createVM, runVM } from '../src/lang/vm.js';
import { COMPILER_SOURCE } from '../src/core/programs.js';
const prog = compileProgram(COMPILER_SOURCE, 'compiler.prog');
console.log('entry', prog.entry, 'fns', Object.keys(prog.functions));
const vm = createVM(prog);
const ctx = {
  hasNative: id => id === 'compiler.configure',
  nativeCall: (id,args) => { console.log('CONFIG', args); return true; },
  hasGlobal: name => name === 'compiler',
  getGlobal: () => ({ configure: {__native:'compiler.configure'} }),
};
for (let i=0;i<10;i++) {
  const r = runVM(vm, 100, ctx);
  console.log(i, r.status, 'frames', vm.frames.map(f=>f.fn), 'globals', Object.keys(vm.globals), 'locals', vm.frames.map(f=>Object.keys(f.locals)));
  if (r.status==='done'||r.status==='error'||r.status==='blocked') break;
}
