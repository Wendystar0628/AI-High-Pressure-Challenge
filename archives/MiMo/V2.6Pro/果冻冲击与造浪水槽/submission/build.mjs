import { build } from 'esbuild';
import { mkdirSync } from 'fs';

mkdirSync('js', { recursive: true });

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  outfile: 'js/bundle.js',
  format: 'iife',
  target: ['chrome110'],
  minify: false,
  sourcemap: false,
  logLevel: 'info',
});
