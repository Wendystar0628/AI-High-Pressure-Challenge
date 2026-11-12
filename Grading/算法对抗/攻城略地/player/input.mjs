// 把一局日志包成播放页的输入脚本（window.SIEGE_INPUT），供 player.html?input=<脚本地址> 读取；导出工具也可以直接在页面脚本前注入同样一句。
// node input.mjs <日志.jsonl> [--names 甲方名,乙方名] [--title 页眉说明] --out <输出.js>
import fs from 'node:fs';

const argv = process.argv.slice(2), opt = {};
const files = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
  else files.push(argv[i]);
}
if (files.length !== 1 || !opt.out) {
  console.error('用法：node input.mjs <日志.jsonl> [--names 甲方名,乙方名] [--title 页眉说明] --out <输出.js>');
  process.exit(2);
}
const input = { log: fs.readFileSync(files[0], 'utf8'), names: opt.names ? opt.names.split(',') : null, title: opt.title || '' };
fs.writeFileSync(opt.out, `window.SIEGE_INPUT = ${JSON.stringify(input)};\n`);
console.log(opt.out);
