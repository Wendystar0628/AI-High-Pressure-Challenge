import{chromium}from'playwright-core';import os from'node:os';import path from'node:path';
const browser=await chromium.connectOverCDP('http://127.0.0.1:19156');const pages=browser.contexts().flatMap(c=>c.pages());const page=pages.find(p=>p.url().includes('index.html'))||pages[0];
await page.waitForFunction(()=>window.bench?.version===1);console.log(await page.evaluate(()=>window.bench.inspect()));
const filename=process.argv[2]||'nest-desktop';await page.screenshot({path:path.join(os.tmpdir(),filename+'.png')});console.log(path.join(os.tmpdir(),filename+'.png'));await browser.close();
