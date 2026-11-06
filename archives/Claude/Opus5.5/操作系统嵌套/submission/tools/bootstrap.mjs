// 引导工具：compiler.nest 同时是合法的 JS 子集，开发阶段可直接用 Node 跑一次得到第一版字节码，
// 再让字节码版编译器在 VM 里编译自己，校验不动点。运行期完全不用这个文件。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ctx, loadImage, vmRun, vmResume, ST_EXIT, ST_TRAP, ST_FAULT, hashText } from '../src/host/vm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

// 让 Nest 内建函数在 JS 中可用（只需要编译器和飞行模拟库用到的那些）
export const prelude = {
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, atan: Math.atan, asin: Math.asin, acos: Math.acos,
  abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, exp: Math.exp, log: Math.log, sign: Math.sign,
  atan2: Math.atan2, pow: Math.pow,
  min: (a, b) => (a < b ? a : b), max: (a, b) => (a > b ? a : b),
  len: (x) => (x == null ? 0 : typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).length : x.length),
  substr: (s, i, n) => (n == null ? s.slice(i) : s.substr(i, n)),
  char_code: (s, i) => { const c = s.charCodeAt(i); return c !== c ? -1 : c; },
  char_from: (c) => String.fromCharCode(c),
  index_of: (s, t, f) => s.indexOf(t, f || 0),
  split: (s, t) => s.split(t), join: (a, t) => a.join(t),
  str: (v) => (typeof v === 'string' ? v : v == null ? 'null' : typeof v === 'object' ? JSON.stringify(v) : String(v)),
  num: (s) => { const v = parseFloat(s); return v !== v ? null : v; },
  push: (a, v) => a.push(v), pop: (a) => a.pop(),
  type: (v) => (v == null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'map' : typeof v === 'boolean' ? 'bool' : typeof v),
  json_str: (v) => JSON.stringify(v), json_parse: (s) => JSON.parse(s),
  hash: (s) => hashText(s), keys: (m) => Object.keys(m), has: (m, k) => m[k] !== undefined,
  new_array: (n, v) => new Array(n).fill(v === undefined ? null : v), slice: (a, i, j) => a.slice(i, j),
};

export function loadNestAsJs(file, exportsList) {
  const src = fs.readFileSync(file, 'utf8');
  const names = Object.keys(prelude);
  const fn = new Function(...names, 'sys', `${src}\n;return {${exportsList.join(',')}};`);
  return fn(...names.map((n) => prelude[n]), () => { throw new Error('sys 不可用'); });
}

export const COMPILER_SRC = path.join(ROOT, 'programs/system/compiler.nest');
export const COMPILER_VPATH = '/System/compiler.nest';

// 在 VM 中运行编译器（真实计费），reader 负责提供 include 的内容
export function vmCompile(compilerText, vpath, compilerId, readFile) {
  const ctx = new Ctx(loadImage(compilerText), { path: vpath, compiler_id: compilerId }, { memLimit: 1 << 30 });
  let units = 0;
  for (;;) {
    const st = vmRun(ctx, 5000000);
    units += ctx.lastPaid;
    if (st === ST_TRAP) {
      if (ctx.trapName === 'fs_read') {
        const t = readFile(ctx.trapArgs[0]);
        vmResume(ctx, t == null ? { error: 'not found' } : t);
      } else throw new Error('未预期的系统调用 ' + ctx.trapName);
    } else if (st === ST_EXIT) {
      const r = ctx.exitValue;
      if (!r.ok) throw new Error(r.error);
      return { text: r.text, units };
    } else if (st === ST_FAULT) throw new Error('编译器异常：' + ctx.error);
  }
}

export function bootstrapCompiler() {
  const src = fs.readFileSync(COMPILER_SRC, 'utf8');
  const { compile_source } = loadNestAsJs(COMPILER_SRC, ['compile_source']);
  const stage0 = compile_source(COMPILER_VPATH, src, () => null, '');
  // 第一版字节码编译自身 → 第二版；第二版再编译自身应得到完全相同的结果
  const read = (p) => (p === COMPILER_VPATH ? src : null);
  const stage1 = vmCompile(stage0, COMPILER_VPATH, '', read);
  const stage2 = vmCompile(stage1.text, COMPILER_VPATH, '', read);
  if (stage1.text !== stage2.text) throw new Error('编译器自举没有达到不动点');
  return { text: stage2.text, units: stage2.units, sameAsJs: stage0 === stage1.text };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t0 = Date.now();
  const r = bootstrapCompiler();
  console.log('compiler.nbc', r.text.length, 'bytes; self-compile', r.units, 'units;', Date.now() - t0, 'ms; JS 阶段与 VM 阶段一致:', r.sameAsJs);
}
