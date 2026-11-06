import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
await mkdir('assets/fonts',{recursive:true});
let fontCSS='';
for(const family of ['dm-sans','noto-sans-sc']){
 const root=`node_modules/@fontsource-variable/${family}`;
 let css=await readFile(root+'/index.css','utf8');
 for(const match of css.matchAll(/url\(\.\/files\/([^)]*)\)/g))await copyFile(root+'/files/'+match[1],'assets/fonts/'+match[1]);
 fontCSS+=css.replaceAll('./files/','./');
 await copyFile(root+'/LICENSE','assets/fonts/'+family+'-LICENSE.txt');
}
await writeFile('assets/fonts/fonts.css',fontCSS);
await build({entryPoints:['src/app.js'],bundle:true,outfile:'app.js',format:'iife',minify:true,legalComments:'eof',target:'chrome110'});
