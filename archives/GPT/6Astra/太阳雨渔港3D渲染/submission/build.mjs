import {build} from 'esbuild';
await build({entryPoints:['src/main.js'],bundle:true,format:'iife',target:['chrome110'],outfile:'harbor.js',minify:true,legalComments:'eof'});
