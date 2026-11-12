import { compileProgram } from '../src/lang/vm.js';
import { COMPILER_SOURCE } from '../src/core/programs.js';
const prog = compileProgram(COMPILER_SOURCE, 'c');
console.log(prog.functions.__top.code);
console.log(prog.constants);
