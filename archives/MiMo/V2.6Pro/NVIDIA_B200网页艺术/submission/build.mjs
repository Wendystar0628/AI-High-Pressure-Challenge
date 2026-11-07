import { build, context } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));

const options = {
  entryPoints: [path.join(root, 'src', 'main.js')],
  bundle: true,
  outfile: path.join(root, 'app', 'bundle.js'),
  format: 'iife',
  target: ['chrome110'],
  minify: !process.argv.includes('--watch'),
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('watching...');
} else {
  await build(options);
}
