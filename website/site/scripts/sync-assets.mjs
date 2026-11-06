// Copies the shared design assets into the site. Idempotent: a file is copied
// only when it is missing or differs; stale copies inside the managed folders
// are removed. Never touches anything outside the folders listed here.
//
//   website/stellar-ui-skill/assets/fonts      -> site/public/fonts
//   website/decor/<type>/*.svg                 -> site/public/decor/<type>/
//   website/logos/mark/*.svg                   -> site/public/logos/mark/
//   website/icons/categories/*.svg             -> site/public/icons/categories/
//   website/stellar-ui-skill/assets/{stellar.css,fx.js,tokens.json,stars/*.svg}
//                                              -> site/src/vendor/stellar/  (code: bundled by Vite)
//
// Nothing from assets/readme is used.
import { readdirSync, statSync, mkdirSync, copyFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = resolve(site, '..');
const skill = join(web, 'stellar-ui-skill', 'assets');

// [source dir, target dir, filter(name, isDir) ]
const svgOnly = (name, dir) => dir || name.endsWith('.svg');
const jobs = [
  [join(skill, 'fonts'), join(site, 'public', 'fonts'), (n, d) => d || /\.(ttf|txt|woff2?)$/.test(n)],
  [join(web, 'decor'), join(site, 'public', 'decor'), (n, d) => (d ? n !== 'tools' : n.endsWith('.svg'))],
  [join(web, 'logos', 'mark'), join(site, 'public', 'logos', 'mark'), svgOnly],
  [join(web, 'icons', 'categories'), join(site, 'public', 'icons', 'categories'), svgOnly],
  [skill, join(site, 'src', 'vendor', 'stellar'), (n, d) => (d ? n === 'stars' : ['stellar.css', 'fx.js', 'tokens.json'].includes(n) || n.endsWith('.svg'))],
];

let copied = 0;
let kept = 0;
let removed = 0;

function same(a, b) {
  if (!existsSync(b)) return false;
  const sa = statSync(a);
  const sb = statSync(b);
  if (sa.size !== sb.size) return false;
  return readFileSync(a).equals(readFileSync(b));
}

function sync(src, dst, filter, top = true) {
  mkdirSync(dst, { recursive: true });
  const wanted = new Set();
  for (const name of readdirSync(src)) {
    const from = join(src, name);
    const isDir = statSync(from).isDirectory();
    if (!filter(name, isDir, top)) continue;
    wanted.add(name);
    const to = join(dst, name);
    if (isDir) sync(from, to, filter, false);
    else if (same(from, to)) kept++;
    else {
      copyFileSync(from, to);
      copied++;
    }
  }
  for (const name of readdirSync(dst)) {
    if (wanted.has(name)) continue;
    rmSync(join(dst, name), { recursive: true, force: true });
    removed++;
  }
}

for (const [src, dst, filter] of jobs) {
  if (!existsSync(src)) {
    console.warn(`[sync] missing source ${relative(web, src)}`);
    continue;
  }
  sync(src, dst, filter);
}
console.log(`[sync] assets: ${copied} copied, ${kept} unchanged, ${removed} removed`);
