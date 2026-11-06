const {spawnSync,spawn}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const build=spawnSync(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build'],{cwd:root,stdio:'inherit'});
if(build.status)process.exit(build.status);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(require('electron'),[root,...process.argv.slice(2)],{cwd:root,stdio:'inherit',env});
child.on('exit',code=>process.exit(code||0));
