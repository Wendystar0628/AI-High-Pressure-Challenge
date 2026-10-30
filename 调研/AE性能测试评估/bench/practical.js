'use strict';
// 常规实现：普通 JS 对象、线性/贝塞尔求值、仿射父子矩阵、差量撤销。
let uid=1;
function prop(values){return{keys:values.map((value,i)=>({id:uid++,t:i*4,value,ii:'linear',oi:'linear',ih:null,oh:null}))}}
function cloneLayer(l){return{...l,id:uid++,position:l.position.slice(),props:l.props.map(p=>({keys:p.keys.map(k=>({...k,id:uid++,value:Array.isArray(k.value)?k.value.slice():k.value,ih:k.ih?.slice()||null,oh:k.oh?.slice()||null}))}))}}
function buildScene(rounds,mask=false){
 let layers=[{id:uid++,name:'矩形',parent:0,position:[160,160],start:0,inPoint:0,outPoint:10,mask,props:[prop([0,180,360]),prop([[100,100],[60,60],[100,100]]),prop([100,50,100])]}];
 for(let j=1;j<=rounds;j++){let copies=layers.map(cloneLayer);for(let l of copies){l.position[j<=6?0:1]+=(j<=6?24*2**(j-1):13*2**(j-7));l.start+=j/60;l.inPoint+=j/60;l.outPoint+=j/60}layers=layers.concat(copies)}return layers;
}
function value(p,t){let k=p.keys;if(t<=k[0].t)return k[0].value;if(t>=k[k.length-1].t)return k[k.length-1].value;let i=0;while(k[i+1].t<t)i++;let a=k[i],b=k[i+1],u=(t-a.t)/(b.t-a.t);if(a.oi==='hold')u=0;else if(a.oi==='bezier'){// Easy Ease 的控制点：(1/3,0), (2/3,1)。x(u)=u。
 u=u*u*(3-2*u)}return Array.isArray(a.value)?a.value.map((v,j)=>v+(b.value[j]-v)*u):a.value+(b.value-a.value)*u;
}
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function world(l,t,index,cache,guard=new Set()){
 if(cache.has(l.id))return cache.get(l.id);if(guard.has(l.id))throw Error('循环父级');guard.add(l.id);
 let local=t-l.start,r=value(l.props[0],local)*Math.PI/180,s=value(l.props[1],local),c=Math.cos(r),sn=Math.sin(r);let m=[c*s[0]/100,sn*s[0]/100,-sn*s[1]/100,c*s[1]/100,...l.position];
 if(l.parent){let parent=index.get(l.parent);if(!parent)throw Error('父级不存在');m=mul(world(parent,t,index,cache,guard),m)}cache.set(l.id,m);guard.delete(l.id);return m;
}
window.createPractical=function(){
 const gpu=createBench(),scenes={A:buildScene(12),B:buildScene(10),C:buildScene(10,true)};
 const groups=Array.from({length:8},(_,i)=>({start:i,rotation:11*i,scale:100-2.5*i,remap:i<4?{keys:[{t:0,value:0,oi:'linear'},{t:5,value:5,oi:'linear'},{t:10,value:0,oi:'linear'}]}:null}));
 let editing=null;
 function source(scene,frame,data){let layers=editing||scenes[scene],t=frame/60,index=new Map(layers.map(l=>[l.id,l])),cache=new Map(),count=0;for(let l of layers){if(t+1e-9<l.inPoint||t>=l.outPoint)continue;let m=world(l,t,index,cache),p=count++*8;data[p]=m[4];data[p+1]=m[5];data[p+2]=m[0];data[p+3]=m[2];data[p+4]=m[1];data[p+5]=m[3];data[p+6]=value(l.props[2],t-l.start)/100}return count}
 gpu.setSource(source,(i,localFrame)=>({time:(groups[i].remap?value(groups[i].remap,localFrame/60):localFrame/60)*60,rotation:groups[i].rotation*Math.PI/180,scale:groups[i].scale/100}));
 async function exportTask(scene,angle=180,optimized=false,frames=600){editing=null;return gpu.encode(scene,{angle,frames,read:!optimized})}
 const heap=()=>performance.memory.usedJSHeapSize;
 async function editTasks(N=65536){
  let layers=scenes.A.map(cloneLayer);while(layers.length<N)layers=layers.concat(layers.map(cloneLayer));let initial=JSON.stringify(layers[17]),baseHeap=heap(),peakHeap=baseHeap;
  editing=layers;gpu.render('A',150);gpu.sync();let steps=[];
  for(let j=0;j<5;j++){let before,after;for(let op of ['F9','undo','redo','undo']){let t=performance.now();if(op==='F9'){before=layers.map(l=>l.props);after=layers.map(l=>l.props.map(p=>({keys:p.keys.map(k=>({...k,ii:'bezier',oi:'bezier',ih:[1/3,0],oh:[1/3,0]}))})));layers.forEach((l,i)=>l.props=after[i])}else layers.forEach((l,i)=>l.props=op==='redo'?after[i]:before[i]);let dataMs=performance.now()-t;editing=layers;gpu.render('A',150);gpu.sync();steps.push({op,dataMs,totalMs:performance.now()-t});peakHeap=Math.max(peakHeap,heap());await tick()}}
  const validEase=JSON.stringify(layers[17])===initial;let copies=[];
  for(let j=0;j<8;j++){let original=layers;let t=performance.now();layers=layers.concat(layers.map(cloneLayer));let dataMs=performance.now()-t;editing=layers;gpu.render('A',150);gpu.sync();let copyMs=performance.now()-t;peakHeap=Math.max(peakHeap,heap());let valid=layers.length===N*2&&layers[N+17].id!==layers[17].id&&layers[N+17].props[0].keys[0]!==layers[17].props[0].keys[0];t=performance.now();layers=original;editing=layers;gpu.render('A',150);gpu.sync();copies.push({dataMs,copyMs,undoMs:performance.now()-t,valid});await tick()}
  editing=null;return{N,keys:N*9,steps,copies,task4Ms:steps.reduce((s,x)=>s+x.totalMs,0),task5Ms:copies.reduce((s,x)=>s+x.copyMs+x.undoMs,0),baseHeap,peakHeap,validEase,validFinal:JSON.stringify(layers[17])===initial};
 }
 function checks(){let a=scenes.A,b=scenes.B,c=scenes.C;let pa=cloneLayer(a[0]),ch=cloneLayer(a[0]);pa.position=[10,20];pa.props[0]=prop([90,90,90]);ch.position=[30,0];ch.parent=pa.id;let m=world(ch,0,new Map([[pa.id,pa],[ch.id,ch]]),new Map());let parentOK=Math.abs(m[4]-10)<1e-5&&Math.abs(m[5]-50)<1e-5;gpu.render('C',150,180);let p=gpu.pixels();gpu.render('C',150,360);let q=gpu.pixels(),diff=0;for(let i=0;i<p.length;i++)diff+=Math.abs(p[i]-q[i]);return{layers:[a.length,b.length,c.length],keys:[a.length*9,b.length*9+12,c.length*9],maxStartFrames:[...new Set(a.map(l=>Math.round(l.start*60)))].sort((a,b)=>a-b).at(-1),parentOK,remap75:value(groups[0].remap,7.5),shutterChangeAbsDiff:diff,uniqueIds:new Set(a.map(l=>l.id)).size===a.length}}
 return{info:gpu.info,exportTask,editTasks,checks,render:gpu.render,timing:gpu.timing};
};
