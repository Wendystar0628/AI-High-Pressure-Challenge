// 生成随项目交付的根系统初始文件 fixtures/rootfs：程序源文件、预编译产物、示例工作簿等。
// 预编译产物由系统内的编译器（compiler.nest 的字节码版）在 VM 中实际编译得到；
// 运行期内核按“源文件哈希 + 编译器哈希”校验，修改任一方都会重新编译。
import fs from 'node:fs';
import path from 'node:path';
import { bootstrapCompiler, vmCompile, ROOT } from './bootstrap.mjs';
import { hashText } from '../src/host/vm.js';

const P = (...a) => path.join(ROOT, ...a);
const OUT = P('fixtures/rootfs');

// 虚拟路径 -> 源文件
const sources = new Map();
function addDir(srcDir, vdir) {
  const d = P(srcDir);
  if (!fs.existsSync(d)) return;
  for (const name of fs.readdirSync(d)) {
    const full = path.join(d, name);
    if (fs.statSync(full).isDirectory()) addDir(path.join(srcDir, name), vdir + '/' + name);
    else sources.set(vdir + '/' + name, fs.readFileSync(full, 'utf8'));
  }
}
addDir('programs/system', '/System');
addDir('programs/lib', '/System/lib');
addDir('programs/apps', '/System/apps');
addDir('programs/user', '/Programs');
addDir('programs/flight', '/Flight');

const compiler = bootstrapCompiler();
const cid = hashText(compiler.text);
console.log('编译器', compiler.text.length, '字节，自编译', compiler.units, '单位');

const read = (p) => (sources.has(p) ? sources.get(p) : null);
const bins = new Map();
bins.set('/System/bin/compiler.nbc', compiler.text);

// 需要预编译的程序：所有不是纯库的 .nest（编译器本身已处理）
for (const [vpath, src] of sources) {
  if (!vpath.endsWith('.nest')) continue;
  if (vpath.startsWith('/System/lib/') || vpath === '/System/compiler.nest') continue;
  const t0 = Date.now();
  try {
    const r = vmCompile(compiler.text, vpath, cid, read);
    bins.set(`/System/bin/${hashText(src)}.nbc`, r.text);
    console.log('  ', vpath.padEnd(40), String(r.text.length).padStart(8), '字节', String(r.units).padStart(10), '单位', Date.now() - t0, 'ms');
  } catch (e) {
    console.error('编译失败', vpath, e.message);
    process.exitCode = 1;
  }
}
if (process.exitCode) process.exit(process.exitCode);

// 清空旧的系统文件（保留 Demo 下由其他工具生成的场景）
for (const d of ['System', 'Programs', 'Flight', 'Docs']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });

function writeV(vpath, text) {
  const full = path.join(OUT, vpath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}
for (const [v, s] of sources) writeV(v, s);
for (const [v, s] of bins) writeV(v, s);

writeV('/System/desktop.json', JSON.stringify({ wallpaper: 'wall-inner', startup: [{ path: '/System/apps/player.nest', args: { file: '/Demo/helicopter-24.scene' } }] }, null, 2));

// 示例工作簿
const sample = {
  format: 'nest-sheet', version: 1, title: 'sample',
  cells: {
    A1: { v: '项目', b: 1 }, B1: { v: '数量', b: 1 }, C1: { v: '单价', b: 1 }, D1: { v: '小计', b: 1 },
    A2: { v: '项目 A' }, B2: { v: '24' }, C2: { v: '6' }, D2: { v: '=B2*C2' },
    A3: { v: '项目 B' }, B3: { v: '12' }, C3: { v: '8' }, D3: { v: '=B3*C3' },
    A4: { v: '项目 C' }, B4: { v: '18' }, C4: { v: '4' }, D4: { v: '=B4*C4' },
  },
};
writeV('/Demo/sample.sheet', JSON.stringify(sample, null, 2));
writeV('/Documents/欢迎.txt', '欢迎使用 Nest OS。\n从开始菜单打开“操作说明”了解程序格式、系统接口、内核修改和飞行排演。\n');
for (const d of ['Documents', 'Downloads', 'Recycle', 'Desktop', 'Snapshots', 'Systems']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
for (const d of ['Downloads', 'Recycle', 'Desktop', 'Snapshots', 'Systems']) fs.writeFileSync(path.join(OUT, d, '.keep'), '');
// 操作说明进入文件系统
const doc = P('docs/操作说明.md');
if (fs.existsSync(doc)) writeV('/Docs/操作说明.md', fs.readFileSync(doc, 'utf8'));
else writeV('/Docs/操作说明.md', '# 操作说明\n');
const docScene = P('docs/最小场景.scene');
if (fs.existsSync(docScene)) writeV('/Demo/minimal.scene', fs.readFileSync(docScene, 'utf8'));
console.log('fixtures 已生成：', OUT);
