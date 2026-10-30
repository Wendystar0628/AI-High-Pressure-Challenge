const fs=require('fs'),path=require('path'),os=require('os');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/Administrator/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core');
const root=__dirname;
const mediaDirectory=path.join(os.tmpdir(),'ae-sol-performance-media');fs.mkdirSync(mediaDirectory,{recursive:true});
async function main(){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ae-sol-chrome-'));
 const context=await chromium.launchPersistentContext(profile,{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,viewport:{width:1600,height:950},acceptDownloads:true,args:['--noerrdialogs','--no-first-run','--enable-precise-memory-info'],timeout:60000});
 fs.writeFileSync(path.join(root,'session.json'),JSON.stringify({profile,at:new Date().toISOString(),node:process.version},null,2));
 const page=context.pages()[0];page.setDefaultTimeout(30000);
 page.on('pageerror',e=>fs.appendFileSync(path.join(root,'errors.log'),String(e)+'\n'));
 let results=[];function save(x){results.push(x);fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(x))}
 try{
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);save({kind:'environment',value:await page.evaluate(()=>{window.b=createBench();return b.info})});
  for(let n of [16384,65536])save({kind:'edit',value:await page.evaluate(n=>editBench(n),n)});
  for(const scene of ['A','B','C'])for(const read of [false,true])save({kind:'render',value:await page.evaluate(o=>b.timing(o.scene,o),{scene,frames:120,read})});
  for(let repeat=0;repeat<2;repeat++)for(const scene of ['A','B','C','C360']){
   const value=await page.evaluate(o=>b.encode(o.scene,o),{scene:scene==='C360'?'C':scene,angle:scene==='C360'?360:180,read:false});save({kind:'export',repeat,value});
   if(value.name){let data=await page.evaluate(async()=>Array.from(new Uint8Array(await lastBlob.arrayBuffer())));fs.writeFileSync(path.join(mediaDirectory,`${repeat}-${value.name}`),Buffer.from(data))}
  }
  save({kind:'export-readback',value:await page.evaluate(()=>b.encode('C',{read:true}))});
  save({kind:'export-vp9',value:await page.evaluate(()=>b.encode('A',{codec:'vp09.00.10.08',hardware:'no-preference',bitrate:24000000,latency:'quality'}))});
  await page.screenshot({path:path.join(os.tmpdir(),'ae-sol-bench-1080.png')});
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);save({kind:'environment-4k',value:await page.evaluate(()=>{window.b=createBench(3840,2160);return b.info})});
  for(const scene of ['A','C'])save({kind:'4k',value:await page.evaluate(scene=>b.encode(scene,{frames:120,bitrate:100000000}),scene)});
 }finally{await context.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
