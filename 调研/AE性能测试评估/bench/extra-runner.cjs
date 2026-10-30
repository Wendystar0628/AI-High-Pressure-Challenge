const fs=require('fs'),path=require('path'),os=require('os'),{pathToFileURL}=require('url');
const{chromium}=require('C:/Users/Administrator/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core');
(async()=>{const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'ae-sol-extra-')),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--noerrdialogs','--enable-precise-memory-info']});let page=context.pages()[0],r=[];const save=x=>{r.push(x);fs.writeFileSync(path.join(__dirname,'extra-results.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(x))};try{
 await page.goto(pathToFileURL(path.join(__dirname,'practical.html')).href);await page.evaluate(()=>{window.p=createPractical()});
 // 编码器差异：保持同一普通对象场景。
 save({kind:'vp9-software-A',value:await page.evaluate(async()=>{const gpu=createBench(); // 这里只比较编码链路与算式内核，非六任务主结果。
 return gpu.encode('A',{codec:'vp09.00.10.08',hardware:'prefer-software',bitrate:24000000})})});
 await page.goto(pathToFileURL(path.join(__dirname,'practical.html')).href);await page.evaluate(()=>{window.p=createPractical()});
 // 冷启动的首个完整导出与正常热测的差别（仍使用已建立的数据与 GL 对象）。
 save({kind:'readback-C',value:await page.evaluate(()=>p.exportTask('C',180,false))});
 await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);save({kind:'4k-environment',value:await page.evaluate(()=>{window.b=createBench(3840,2160);return b.info})});
 for(let scene of ['A','C'])for(let read of [false,true])save({kind:'4k',read,value:await page.evaluate(o=>b.encode(o.scene,{frames:120,codec:'avc1.420034',bitrate:100000000,read:o.read}),{scene,read})});
}finally{await context.close()}})().catch(e=>{console.error(e);process.exitCode=1});
