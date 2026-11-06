import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{Engine}from'../src/engine.mjs';import{recalc}from'../src/sheet.mjs';import{makeProcess,stepProcess,expression}from'../src/vm.mjs';
const scene=JSON.parse(fs.readFileSync('public/assets/helicopter-24.scene'));const minimal=JSON.parse(fs.readFileSync('public/assets/minimal.scene'));
function setup(){const e=new Engine(scene,minimal);clearInterval(e.interval);return e}const ticks=(e,n)=>{for(let i=0;i<n;i++)e.tick()};
test('formula dependencies, SUM and errors',()=>{let r=recalc({A1:3,A2:4,B1:'=SUM(A1:A2)*2',C1:'=B1+1',D1:'=1/0',E1:'=E2',E2:'=E1'});assert.equal(r.values.C1,15);assert.equal(r.values.D1,'#DIV/0!');assert.equal(r.values.E1,'#CYCLE!')});
test('untrusted expressions cannot access host objects',()=>{assert.throws(()=>expression('window.document'));assert.throws(()=>expression('({}).constructor'));assert.throws(()=>expression('eval("1")'))});
test('kernel schedules four layers, pause isolation and deterministic snapshots',()=>{const e=setup(),a=e.createChild('outer'),b=e.createChild(a.id),c=e.createChild(b.id);const p=e.runFile(c.id,'/Programs/compute.nx');ticks(e,60);assert.ok(p.vars.counter>0,JSON.stringify({p,c:c.kernel}));const before=p.vars.counter;e.pause(a.id);ticks(e,4);assert.equal(p.vars.counter,before);e.resume(a.id);ticks(e,4);assert.ok(p.vars.counter>before);const snap=e.capture(a.id);const count=p.vars.counter;ticks(e,4);e.restoreFile('outer',snap);assert.equal(e.system(c.id).processes.find(q=>q.id===p.id).vars.counter,count);const fork=e.restoreFile('outer',snap,true);assert.notEqual(fork.id,a.id);assert.equal(e.children(fork.id).length,1)});
test('player is scheduled; chart receives complete versions while paused',()=>{const e=setup(),a=e.createChild('outer'),p=e.open(a.id,'player'),sheet=e.open('outer','spreadsheet'),chart=e.open(a.id,'charts');e.connect(chart,{sourceId:sheet.id,range:'A1:D4'});e.dispatch(p,{type:'player',action:'play'});ticks(e,20);assert.ok(p.data.position>0,'player did not advance');assert.ok(p.data.frameTime>0);assert.equal(chart.data.table[1][3],144);e.pause(a.id);const t=p.data.frameTime;e.updateSheet(sheet,{B2:30});ticks(e,5);assert.equal(p.data.frameTime,t);assert.equal(chart.data.table[1][3],144);e.resume(a.id);ticks(e,15);assert.equal(chart.data.table[1][3],180)});
test('invalid child kernel remains isolated and can be fixed',()=>{const e=setup(),a=e.createChild('outer'),b=e.createChild('outer');e.system('outer').files[a.kernelPath].content='broken code';e.restart(a.id);assert.equal(e.system(a.id).state,'error');ticks(e,4);assert.ok(b.time>0);assert.equal(e.system('outer').state,'running')});
test('resident compiler compiles itself and arbitrary source',()=>{const e=setup();const s=e.system('outer');s.files['/System/compiler.nx'].content=s.files['/System/compiler.nx'].content.replace('20000','12000');const c=e.runFile('outer','/System/compiler.nx');ticks(e,120);assert.equal(c.state,'ended',c.error);assert.ok(s.compilerCode?.length>=60);e.writeFile('outer','/Programs/new.nx','set n 0\nloop:\nset n n+1\nif n<23 goto loop\nprint n\nhalt');const p=e.runFile('outer','/Programs/new.nx');ticks(e,30);assert.equal(p.output.at(-1),'23');assert.equal(p.state,'ended')});
test('ancestor quotas constrain descendants without stopping siblings',()=>{const e=setup(),a=e.createChild('outer'),b=e.createChild('outer');a.storageLimit=e.storageUsed(a)+10;const r=e.writeFile(a.id,'/Documents/large.txt','x'.repeat(100));assert.equal(r.ok,false);assert.equal(e.writeFile(b.id,'/Documents/ok.txt','hello').ok,true);const p=e.runFile(a.id,'/Programs/compute.nx');ticks(e,10);assert.ok(p.vars.counter>0);e.system('outer').budget=1200;a.grant=300;const sibling=e.runFile(b.id,'/Programs/compute.nx');ticks(e,20);assert.ok(a.actual<=300);assert.ok(sibling.vars.counter>0);assert.ok(e.system('outer').actual<=1200)});
test('snapshot restores partially paid instructions and queued jobs',()=>{const e=setup(),a=e.createChild('outer');e.writeFile(a.id,'/Programs/large.nx','set data "'+('a'.repeat(10000))+'"\nsys result file.write {path:"/Documents/large.txt",content:data}\nhalt');const p=e.runFile(a.id,'/Programs/large.nx');ticks(e,20);e.pause(a.id);const snap=e.capture(a.id);e.resume(a.id);ticks(e,30);const expected=cloneState(e.system(a.id));e.restoreFile('outer',snap);e.resume(a.id);ticks(e,30);assert.equal(e.system(a.id).files['/Documents/large.txt']?.content,expected.files['/Documents/large.txt']?.content);assert.equal(e.system(a.id).processes.find(q=>q.id===p.id).pc,expected.processes.find(q=>q.id===p.id).pc)});
const cloneState=s=>JSON.parse(JSON.stringify(s));

test('closed-loop flight lands on the second pad, faults fall, and edited controllers take over',()=>{
 const e=setup(),s=e.createChild('outer'),w=s.windows.find(w=>w.appId==='player');
 e.dispatch(w,{type:'player',action:'rehearsal'});ticks(e,160);
 assert.ok(Math.abs(w.data.physics.y-3)<.1);assert.equal(w.data.physics.crashed,false);
 const snap=e.capture(s.id);
 e.dispatch(w,{type:'player',action:'target',value:{x:14,z:-9,land:true}});ticks(e,540);
 assert.equal(w.data.physics.crashed,false);assert.ok(w.data.physics.y<.1);assert.ok(Math.hypot(w.data.physics.x-14,w.data.physics.z+9)<.3);
 e.restoreFile('outer',snap);const restored=e.getWindow(w.id);const old=restored.controllerId;
 const replacement=e.runFile(s.id,'/Programs/flight-control.nx',{windowId:w.id});ticks(e,25);assert.equal(restored.controllerId,replacement.id);assert.equal(e.system(s.id).processes.find(p=>p.id===old).state,'ended');
 e.dispatch(restored,{type:'player',action:'fault'});ticks(e,70);assert.equal(restored.data.physics.crashed,true);
 e.reduce(restored,{type:'player',action:'save-record'});const record=Object.keys(e.system(s.id).files).find(p=>p.endsWith('.flight'));assert.ok(record);
 const replay=e.openFile(s.id,record);assert.equal(replay.data.crashTime,restored.data.crashTime);assert.equal(replay.data.record.length,restored.data.history.length);
});

test('file application and window manager schedule writes; suspension retains queued work',()=>{
 const e=setup(),s=e.createChild('outer'),w=e.open(s.id,'files');const p=s.processes.find(p=>p.id===w.processId);p.state='suspended';
 e.dispatch(w,{type:'files',action:'transfer',entries:[{path:'/Documents/copied.txt',content:'independent copy',type:'file'}],notice:'done'});ticks(e,10);assert.equal(s.files['/Documents/copied.txt'],undefined);assert.ok(p.queue.length>0);
 p.state='ready';ticks(e,15);assert.equal(s.files['/Documents/copied.txt'].content,'independent copy');
 const wm=s.processes.find(p=>p.role==='desktop');wm.state='suspended';e.dispatch(w,{type:'files',action:'create',path:'/Documents/queued.txt',kind:'file'});ticks(e,5);assert.equal(s.files['/Documents/queued.txt'],undefined);wm.state='ready';ticks(e,10);assert.ok(s.files['/Documents/queued.txt']);
});

test('forked descendants use their own kernel paths; collision follows visible obstacle geometry',()=>{
 const e=setup(),a=e.createChild('outer'),b=e.createChild(a.id);const snap=e.capture(a.id),fork=e.restoreFile('outer',snap,true),child=e.children(fork.id)[0];assert.equal(child.kernelPath,'/System/'+child.id+'.kernel.nx');assert.ok(fork.files[child.kernelPath]);assert.ok(e.system(a.id).files[b.kernelPath]);
 const w=a.windows.find(w=>w.appId==='player');w.data.position=2;w.data.physics={x:-10,y:3,z:-9,vx:0,vy:0,vz:0,roll:0,rollRate:0,pitch:0,pitchRate:0,yaw:0,stamp:0,crashed:false};e.physics(a,w,.05);assert.equal(w.data.physics.crashed,true);
 w.data.physics.crashed=false;w.data.physics.y=3;w.data.physics.roll=0;w.data.resource.nodes.find(n=>n.id==='机库').position[0]=40;e.physics(a,w,.05);assert.equal(w.data.physics.crashed,false);
});

test('default fourth-layer player presents frames without starving behind kernel overhead',()=>{
 const e=setup(),a=e.createChild('outer'),b=e.createChild(a.id),c=e.createChild(b.id),w=c.windows.find(w=>w.appId==='player');e.dispatch(w,{type:'player',action:'play'});ticks(e,60);assert.ok(w.data.frameTime>2);assert.ok(w.data.position-w.data.frameTime<.3);assert.ok(e.system('outer').actual<=e.system('outer').budget);
});


test('disconnect and reconnect reject older queued workbook versions',()=>{
 const e=setup(),s=e.createChild('outer'),book=e.open('outer','spreadsheet'),chart=e.open(s.id,'charts');
 e.connect(chart,{sourceId:book.id,range:'A1:D4'});ticks(e,20);assert.equal(chart.data.table[1][3],144);
 const drawing=s.processes.find(p=>p.id===chart.chartId);drawing.state='suspended';
 for(let i=0;i<8;i++)e.updateSheet(book,{B2:50+i});ticks(e,10);
 e.dispatch(chart,{type:'disconnect'});ticks(e,5);drawing.state='ready';ticks(e,25);
 assert.equal(chart.data.connectionState,'disconnected');assert.equal(chart.data.table[1][3],144);
 drawing.state='suspended';e.connect(chart,{sourceId:book.id});ticks(e,10);
 const fresh=e.open('outer','spreadsheet');fresh.data.title='New workbook';e.updateSheet(fresh,{B2:7});
 e.connect(chart,{sourceId:fresh.id});drawing.state='ready';ticks(e,30);
 assert.equal(chart.data.table[1][3],42);assert.equal(chart.data.version,2);assert.equal(chart.data.sourceTitle,'New workbook');
 e.close(fresh);e.updateSheet(book,{B2:90});ticks(e,10);assert.equal(chart.data.connectionState,'source-closed');assert.equal(chart.data.table[1][3],42);
});

test('same-path scene reload and snapshot restore refresh the projected resource',()=>{
 const e=setup(),s=e.createChild('outer'),w=s.windows.find(w=>w.appId==='player'),view=e.project(w,'outer');
 const snap=e.capture(s.id),path=w.data.scene,original=JSON.stringify(view.data.view.resource);
 const changed=cloneState(w.data.resource);changed.title='Revised scene';changed.background='#112233';
 e.writeFile(s.id,path,JSON.stringify(changed));e.dispatch(w,{type:'player',action:'load',value:path});for(let i=0;i<240&&w.data.resource.title!=='Revised scene';i++)e.tick();
 assert.equal(view.data.view.resource.title,'Revised scene');assert.notEqual(JSON.stringify(view.data.view.resource),original);
 e.restoreFile('outer',snap);assert.equal(JSON.stringify(view.data.view.resource),original);
});

test('seeking discards in-flight samples and stale syscall replies',()=>{
 const e=setup(),s=e.createChild('outer'),w=s.windows.find(w=>w.appId==='player');
 const sceneProcess=s.processes.find(p=>p.id===w.sceneId);sceneProcess.cap=20;
 e.reduce(w,{type:'player',action:'seek',value:11});ticks(e,3);
 assert.ok(sceneProcess.pending||sceneProcess.micro,'sample should still be in progress');
 const oldRequest=cloneState(sceneProcess.pending);e.reduce(w,{type:'player',action:'seek',value:2});ticks(e,3);
 if(oldRequest&&sceneProcess.pending){const current=sceneProcess.pending.requestId;e.kernelCall(s,s.kernel,'request.complete',{id:sceneProcess.id,requestId:oldRequest.requestId,value:'obsolete'},'test',100,0);assert.equal(sceneProcess.pending.requestId,current)}
 sceneProcess.cap=2400;ticks(e,25);assert.equal(w.data.frameTime,2);assert.equal(w.data.effectTime,2);
});

test('suspension during a pending service keeps the process suspended',()=>{
 const e=setup(),s=e.createChild('outer'),w=e.open(s.id,'editor'),p=s.processes.find(p=>p.id===w.processId);
 p.pending={requestId:9,dest:'reply',service:'notification',args:'queued notice',cost:0,progress:0};p.state='suspended';
 const before=s.notifications.length;const result=e.kernelCall(s,s.kernel,'service.dispatch',{processId:p.id,requestId:9},'result',100,0);
 assert.equal(result.value.deferred,true);assert.equal(s.notifications.length,before);
 e.kernelCall(s,s.kernel,'request.complete',{id:p.id,requestId:9,value:{ok:true}},'completed',100,0);
 assert.equal(p.state,'suspended');assert.deepEqual(p.vars.reply,{ok:true});
});
