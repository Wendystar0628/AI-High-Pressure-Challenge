import { fileURLToPath } from 'node:url';
// 构建系统映像：收集 system/ 下的预置文件，并用系统内的编译器程序（compiler.nest）
// 预先编译所有程序，生成 build/image-root.json 与 build/image-inner.json。
// 运行时系统按源文件与编译器的哈希检查这些编译结果，源文件或编译器改变后会重新编译。
import fs from 'node:fs';
import path from 'node:path';
import { hashStr } from '../src/vm/vm.js';
import { bootstrapCompiler, runCompilerExe } from './nestc.mjs';

function walk(dir, base = dir, out = {}) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    const rel = '/' + path.relative(base, p).split(path.sep).join('/');
    if (st.isDirectory()) { out[rel + '/'] = ''; walk(p, base, out); }
    else out[rel] = fs.readFileSync(p, 'utf8');
  }
  return out;
}

function newestMtime(dirs) {
  let m = 0;
  const visit = (p) => {
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.isDirectory()) for (const n of fs.readdirSync(p)) visit(path.join(p, n));
    else m = Math.max(m, st.mtimeMs);
  };
  dirs.forEach(visit);
  return m;
}

function compileAll(files, compilerExe, compilerText, log) {
  const index = {};
  const chash = hashStr(compilerText);
  const read = (p) => (files[p] !== undefined ? files[p] : null);
  for (const p of Object.keys(files).sort()) {
    if (!p.endsWith('.nest') || p.startsWith('/System/lib/')) continue;
    if (p === '/System/compiler.nest') continue;
    const src = files[p];
    const r = runCompilerExe(compilerExe, src, path.posix.basename(p, '.nest'), read);
    if (r.exe.error) throw new Error(`${p}: ${r.exe.error} (第 ${r.exe.line} 行)`);
    const text = JSON.stringify(r.exe);
    const out = '/System/bin/' + p.slice(1).split('/').join('_') + '.nx';
    files[out] = text;
    index[p] = { src: hashStr(src), compiler: chash, deps: r.exe.deps, exe: out };
    if (log) log(`  编译 ${p} (${r.units} 单位)`);
  }
  // 编译器自身：记录其源文件哈希，便于显示
  index['/System/compiler.nest'] = { src: hashStr(files['/System/compiler.nest']), compiler: chash, deps: [], exe: '/System/bin/compiler.nx' };
  files['/System/bin/index.json'] = JSON.stringify(index);
}

export function buildImages(root, log = console.log) {
  const sys = path.join(root, 'system');
  const common = walk(path.join(sys, 'common'));
  const compilerSrc = common['/System/compiler.nest'];
  const boot = bootstrapCompiler(compilerSrc);
  if (!boot.same) log('警告：编译器自举未达到不动点');
  const compilerText = JSON.stringify(boot.exe);
  const images = {};
  for (const kind of ['root', 'inner']) {
    const files = { ...common, ...walk(path.join(sys, kind)) };
    files['/System/bin/'] = '';
    files['/System/bin/compiler.nx'] = compilerText;
    compileAll(files, boot.exe, compilerText, null);
    images[kind] = files;
  }
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  for (const kind of Object.keys(images)) {
    fs.writeFileSync(path.join(root, 'build', `image-${kind}.json`), JSON.stringify({ format: 'nest-image', kind, built: Date.now(), files: images[kind] }));
  }
  log(`系统映像已构建：root ${Object.keys(images.root).length} 项，inner ${Object.keys(images.inner).length} 项`);
  return images;
}

export async function ensureImage(root) {
  const out = path.join(root, 'build', 'image-inner.json');
  const src = newestMtime([path.join(root, 'system'), path.join(root, 'src', 'vm'), path.join(root, 'tools', 'build-image.mjs'), path.join(root, 'tools', 'nestc.mjs')]);
  const built = fs.existsSync(out) ? fs.statSync(out).mtimeMs : 0;
  if (built < src || !fs.existsSync(path.join(root, 'build', 'image-root.json'))) buildImages(root);
}

if (process.argv[1] && process.argv[1].endsWith('build-image.mjs')) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  buildImages(root);
}
