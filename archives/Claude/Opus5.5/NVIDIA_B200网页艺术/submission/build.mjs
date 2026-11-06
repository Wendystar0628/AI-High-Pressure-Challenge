// 打包脚本：把 src 打成适合 file:// 的单文件 IIFE。
import { build } from 'esbuild';
await build({ entryPoints: ['src/main.js'], bundle: true, minify: process.argv.includes('--min'), format: 'iife', target: 'chrome110', outfile: 'dist/app.js', loader: { '.css': 'css' }, logLevel: 'info', sourcemap: false, legalComments: 'none' });
