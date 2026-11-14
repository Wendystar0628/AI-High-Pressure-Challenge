import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const wawoff2 = require('wawoff2');
const opentype = require('opentype.js');

const FONTS = [
  {
    id: 'noto-serif-sc',
    displayName: '思源宋体 Bold (Noto Serif SC)',
    pkg: '@fontsource/noto-serif-sc',
    filter: (f) => f.includes('-700-') && f.endsWith('.woff2'),
    outFile: 'assets/fonts/noto-serif-sc-bold.js',
    globalVar: '__FONT_PACK_SERIF__',
  },
  {
    id: 'noto-sans-sc',
    displayName: '思源黑体 Bold (Noto Sans SC)',
    pkg: '@fontsource/noto-sans-sc',
    filter: (f) => f.includes('-700-') && f.endsWith('.woff2'),
    outFile: 'assets/fonts/noto-sans-sc-bold.js',
    globalVar: '__FONT_PACK_SANS__',
  },
];

async function buildFontPack(cfg) {
  const dir = path.join('node_modules', cfg.pkg, 'files');
  const files = fs.readdirSync(dir).filter(cfg.filter).sort();
  const slices = [];
  const charMap = {};
  let totalGlyphs = 0;
  let cjkCount = 0;

  for (let sIdx = 0; sIdx < files.length; sIdx++) {
    const buf = fs.readFileSync(path.join(dir, files[sIdx]));
    const ttf = await wawoff2.decompress(buf);
    const ab = ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength);
    const font = opentype.parse(ab);
    const sliceIndex = slices.length;
    slices.push(Buffer.from(ttf).toString('base64'));

    for (let i = 0; i < font.glyphs.length; i++) {
      const g = font.glyphs.get(i);
      const unicodes = g.unicodes && g.unicodes.length ? g.unicodes : (g.unicode ? [g.unicode] : []);
      for (const u of unicodes) {
        if (u && charMap[u] === undefined) {
          charMap[u] = sliceIndex;
          totalGlyphs++;
          if (u >= 0x4e00 && u <= 0x9fff) cjkCount++;
        }
      }
    }
  }

  const payload = {
    id: cfg.id,
    displayName: cfg.displayName,
    totalGlyphs,
    cjkCount,
    rangeDescription: `ASCII(0x20-0x7E)、常用标点符号与 ${cjkCount} 个常用汉字 (覆盖 GB2312 及扩展简繁汉字，共 ${totalGlyphs} 字形)`,
    charMap,
    slices,
  };

  fs.mkdirSync(path.dirname(cfg.outFile), { recursive: true });
  fs.writeFileSync(
    cfg.outFile,
    `window.${cfg.globalVar} = ${JSON.stringify(payload)};\n`,
    'utf8'
  );
  const sizeMB = (fs.statSync(cfg.outFile).size / 1024 / 1024).toFixed(2);
  console.log(`Built ${cfg.outFile}: ${slices.length} slices, ${totalGlyphs} glyphs (${cjkCount} CJK), ${sizeMB} MB`);
}

for (const cfg of FONTS) {
  await buildFontPack(cfg);
}
