// 构建工具：用 VM 运行系统内的编译器程序（compiler.nest 的可执行形式）编译源文件
import { Prog, Ctx, run, hashStr, PRIMS } from '../src/vm/vm.js';
import { compile as bootCompile } from '../src/vm/bootstrap.js';
import fs from 'node:fs';
import path from 'node:path';

export function runCompilerExe(compilerExe, src, name, readFile) {
  const ctx = new Ctx(new Prog(compilerExe), { args: { src, name, path: name } });
  let units = 0;
  for (let guard = 0; guard < 1e7; guard++) {
    units += run(ctx, 1e9);
    if (ctx.state === 'trap') {
      const [call, arg] = ctx.trap;
      let v = null;
      if (call === 'read') v = readFile(arg);
      ctx.stack.push(v); ctx.state = 'ready'; ctx.trap = null;
      continue;
    }
    break;
  }
  if (ctx.state !== 'done') throw new Error('compiler crashed: ' + ctx.error);
  return { exe: ctx.result, units };
}

export function bootstrapCompiler(compilerSrc) {
  const exe0 = bootCompile(compilerSrc, { name: 'compiler' });
  const r1 = runCompilerExe(exe0, compilerSrc, 'compiler', () => null);
  if (r1.exe.error) throw new Error('stage1: ' + JSON.stringify(r1.exe));
  const r2 = runCompilerExe(r1.exe, compilerSrc, 'compiler', () => null);
  if (r2.exe.error) throw new Error('stage2: ' + JSON.stringify(r2.exe));
  const same = JSON.stringify(r1.exe) === JSON.stringify(r2.exe);
  return { exe: r2.exe, same, units: r2.units };
}
