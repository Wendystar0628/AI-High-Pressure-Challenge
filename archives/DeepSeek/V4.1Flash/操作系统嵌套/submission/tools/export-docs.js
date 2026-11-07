// 从 seed.js 导出操作说明到 docs（构建辅助脚本）
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'seed.js'), 'utf8');
const startMark = 'export const GUIDE_MD = `';
const i = src.indexOf(startMark) + startMark.length;
const j = src.indexOf('`;\n\nexport const PROGRAMS');
let g = src.slice(i, j).split('\\`').join('`');
fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'docs', '操作说明.md'), g, 'utf8');
console.log('wrote docs/操作说明.md', g.length, 'chars');
