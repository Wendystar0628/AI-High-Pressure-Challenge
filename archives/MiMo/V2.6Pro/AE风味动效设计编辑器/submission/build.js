// esbuild 打包：生成 dist/bundle.js + dist/bundle.css（file:// 可直接运行）
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function main() {
  const outdir = path.join(__dirname, 'dist');
  if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'src', 'main.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome100'],
    outfile: path.join(outdir, 'bundle.js'),
    minify: false,
    sourcemap: false,
    logLevel: 'info',
    loader: {
      '.css': 'css',
      '.png': 'dataurl',
      '.svg': 'dataurl',
      '.json': 'json',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });
  console.log('构建完成');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
