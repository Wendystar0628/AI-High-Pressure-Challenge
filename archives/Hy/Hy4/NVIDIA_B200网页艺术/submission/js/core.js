/* ============================================================
   core.js — state, timeline, scroll, deterministic render loop,
             videoExport API
   ============================================================ */
(function () {
'use strict';
const A = window.APP = {};
A.THREE = window.THREE;

/* ---------------- math / utils ---------------- */
const U = A.util = {
  clamp: (v,a,b)=>v<a?a:(v>b?b:v),
  lerp: (a,b,t)=>a+(b-a)*t,
  smooth: (t)=>{t=U.clamp(t,0,1);return t*t*(3-2*t)},
  sstep: (a,b,v)=>{if(a===b)return v<a?0:1;return U.smooth((v-a)/(b-a))},
  mix3: (a,b,t)=>[U.lerp(a[0],b[0],t),U.lerp(a[1],b[1],t),U.lerp(a[2],b[2],t)],
  // catmull-rom through an array of scalars/vectors sampled by nearest anchors
  catmull: (p0,p1,p2,p3,t)=>{
    const f=(a,b,c,d)=>0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
    if(typeof p0==='number')return f(p0,p1,p2,p3);
    return p0.map((_,i)=>f(p0[i],p1[i],p2[i],p3[i]));
  },
  // deterministic hash
  hash: (n)=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s)},
  num: (n,dp=0)=>{return Number(n).toLocaleString('en-US',{minimumFractionDigits:dp,maximumFractionDigits:dp})},
  si: (n)=>{
    if(n>=1e12)return (n/1e12).toFixed(2)+' T';
    if(n>=1e9)return (n/1e9).toFixed(2)+' G';
    if(n>=1e6)return (n/1e6).toFixed(2)+' M';
    if(n>=1e3)return (n/1e3).toFixed(2)+' K';
    return String(Math.round(n));
  },
  // project a THREE.Vector3-like world point to screen px
  project: (v)=>{
    const cam=A.World.camera, p=v.clone().project(cam);
    return {x:(p.x*0.5+0.5)*A.W, y:(-p.y*0.5+0.5)*A.H, z:p.z,
            visible:p.z<1 && p.z>-1 && Math.abs(p.x)<1.6 && Math.abs(p.y)<1.6};
  }
};

/* ---------------- precision data ---------------- */
// bits: stored bits per value (FP4 = 4 + 0.5 scale overhead in practice)
// dense / sparse: per-B200-GPU peak tensor throughput (PFLOPS), sparse = 2:1
A.FORMATS = {
  FP64:{key:'FP64',bits:64,s:1,e:11,m:52,bias:1023,sub:'IEEE 754 · 双精度',
        desc:'1 符号 / 11 指数 / 52 尾数。科学计算的基线精度；B200 FP64 Tensor Core 40 TFLOPS（稠密）。',
        denseTF:40,sparseTF:40,flops:'40 TFLOPS',color:'#8a97a5'},
  TF32:{key:'TF32',bits:19,s:1,e:8,m:10,bias:127,sub:'TensorFloat-32 · 19 位有效',
        desc:'1 符号 / 8 指数 / 10 尾数，存入 32 位容器。1.1 PFLOPS 稠密 / 2.2 PFLOPS 稀疏。',
        densePF:1.1,sparsePF:2.2,flops:'1.1 / 2.2 PFLOPS',color:'#8a97a5'},
  FP16:{key:'FP16',bits:16,s:1,e:5,m:10,bias:15,sub:'IEEE 754 · 半精度',
        desc:'1 符号 / 5 指数 / 10 尾数。2.25 PFLOPS 稠密 / 4.5 PFLOPS 稀疏。',
        densePF:2.25,sparsePF:4.5,flops:'2.25 / 4.5 PFLOPS',color:'#54d3e8'},
  BF16:{key:'BF16',bits:16,s:1,e:8,m:7,bias:127,sub:'Brain Float · 指数同 FP32',
        desc:'1 符号 / 8 指数 / 7 尾数。动态范围与 FP32 相同、尾数更短。2.25 / 4.5 PFLOPS。',
        densePF:2.25,sparsePF:4.5,flops:'2.25 / 4.5 PFLOPS',color:'#54d3e8'},
  FP8:{key:'FP8',bits:8,s:1,e:4,m:3,bias:7,sub:'E4M3 · 1/4/3',
        desc:'1 符号 / 4 指数 / 3 尾数，偏置 7，最大有限值 448。4.5 PFLOPS 稠密 / 9 PFLOPS 稀疏。',
        densePF:4.5,sparsePF:9,flops:'4.5 / 9 PFLOPS',color:'#e8a83d'},
  FP4:{key:'FP4',bits:4,s:1,e:2,m:1,bias:1,sub:'E2M1 · NVFP4',
        desc:'1 符号 / 2 指数 / 1 尾数；代表值 0, ±0.5, ±1, ±1.5, ±2, ±3, ±4, ±6。16 值微块共享一个 E4M3 FP8 缩放因子。9 PFLOPS 稠密 / 18 PFLOPS 稀疏。',
        densePF:9,sparsePF:18,flops:'9 / 18 PFLOPS',color:'#8bd44e'}
};
A.FORMAT_ORDER = ['FP64','TF32','FP16','BF16','FP8','FP4'];

/* ---------------- chapters ---------------- */
A.chapters = [
  {id:'01',start:0.000,end:0.112,label:'完整封装',en:'THE PACKAGE',short:'封装'},
  {id:'02',start:0.112,end:0.256,label:'封装拆解',en:'EXPLODED VIEW',short:'拆解'},
  {id:'03',start:0.256,end:0.366,label:'双晶粒通信',en:'TWO DIES · ONE GPU',short:'双晶粒'},
  {id:'04',start:0.366,end:0.526,label:'HBM3e 与带宽',en:'MEMORY / BANDWIDTH',short:'显存',horizontal:true},
  {id:'05',start:0.526,end:0.666,label:'数值精度实验',en:'PRECISION LAB',short:'精度'},
  {id:'06',start:0.666,end:0.808,label:'NVLink 与多卡',en:'SCALE OUT',short:'多卡'},
  {id:'07',start:0.808,end:0.898,label:'规格对照',en:'SPECIFICATIONS',short:'规格'},
  {id:'08',start:0.898,end:1.000,label:'回到整颗 GPU',en:'ONE GPU, AGAIN',short:'收束'}
];
A.TW = 0.020; // transition half-width in global progress

A.chapterIndex = (p)=>{
  for(let i=0;i<A.chapters.length;i++)if(p<A.chapters[i].end)return i;
  return A.chapters.length-1;
};
// smooth cross-fade weight of a chapter at progress p
A.chapterWeight = (i,p)=>{
  const c=A.chapters[i], tw=A.TW;
  let fi = i===0 ? 1 : U.sstep(c.start-tw,c.start+tw,p);
  let fo = i===A.chapters.length-1 ? 1 : 1-U.sstep(c.end-tw,c.end+tw,p);
  return fi*fo;
};
A.localProgress = (i,p)=>{
  const c=A.chapters[i];return U.clamp((p-c.start)/(c.end-c.start),0,1);
};

/* ---------------- persistent state ---------------- */
const defMat = ()=>({
  A:[[ 2.0,-1.5, 0.75, 3.0],
     [-0.5, 1.25,-2.0, 0.5],
     [ 1.75, 0.0, 2.5,-1.0],
     [-1.25, 3.0, 0.5, 1.5]],
  B:[[ 1.5, 0.5,-1.0, 2.0],
     [-2.0, 1.0, 0.25, 0.5],
     [ 0.75,-1.5, 2.0,-0.5],
     [ 1.0, 2.5,-0.75, 1.25]]
});
A.defaultState = ()=>({
  precision:'FP4',
  rev:0,
  matA:defMat().A, matB:defMat().B,
  sparse:false,
  selectedCell:null,           // {m:'A'|'B',r,c}
  running:false, runStart:0,
  region:2,                    // ch3 selected functional region
  product:0,                   // ch6 product index
  specMetric:'fp4',            // ch7 selected metric column/row
  workload:0.22,               // ch6 workload scale
  workloadType:0,              // ch8: 0 train,1 infer,2 hpc
  explode:0.0, seam:0.0, section:0.5,
  explodeUser:false, seamUser:false,
  selectedPart:null, partDetail:0, detailSince:0,
  productUser:false,
  lens:{x:0.5,y:0.5}, lensUser:false,
  userYaw:0, userPitch:0, userZoom:1,
  shardSel:-1,
  replay3:0, replay4:0, replay6:0,
  replayFrom:0
});
A.state = A.defaultState();

A.set = (patch)=>{Object.assign(A.state,patch);A.state.rev++;return A.state;};

/* ---------------- runtime ---------------- */
A.W=window.innerWidth; A.H=window.innerHeight;
A.P=0; A.T=0; A.exportMode=false; A.ready=false;
A._t0=performance.now(); A._tween=null; A._lastScrollY=0;

let _resolveReady;
A.readyPromise = new Promise(r=>_resolveReady=r);

A.scrollMax = ()=>Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
A.progressFromScroll = ()=>U.clamp(window.scrollY/A.scrollMax(),0,1);

/* ---- scroll tween for navigation ---- */
A.scrollToProgress = (p,dur)=>{
  dur=dur||0.85;
  const from=window.scrollY, to=U.clamp(p,0,1)*A.scrollMax(), t0=performance.now();
  A._tween={from,to,t0,dur};
};
A.scrollToChapter = (i)=>{
  const c=A.chapters[i];
  A.scrollToProgress(c.start+(c.end-c.start)*0.42,0.95);
};
A.stepScroll = (deltaP)=>{
  const p=A.exportMode?A.P:A.progressFromScroll();
  A.scrollToProgress(p+deltaP,0.45);
};

/* ---- main render ---- */
A.renderNow = ()=>{
  if(!A.ready)return;
  const p=A.P,t=A.T,st=A.state;
  A.World.updateCamera(p,t,st);
  A.Director.update(p,t,st);
  A.SVG.update(p,t,st);
  A.UI.update(p,t,st);
  A.World.render();
};

function loop(){
  requestAnimationFrame(loop);
  if(!A.ready)return;
  // tween
  if(A._tween){
    const tw=A._tween, k=U.clamp((performance.now()-tw.t0)/(tw.dur*1000),0,1);
    window.scrollTo(0,U.lerp(tw.from,tw.to,U.smooth(k)));
    if(k>=1)A._tween=null;
  }
  if(!A.exportMode){
    A.P=A.progressFromScroll();
    A.T=(performance.now()-A._t0)/1000;
    A._lastScrollY=window.scrollY;
  }
  A.renderNow();
}

/* ---- resize ---- */
A.resize = ()=>{
  A.W=window.innerWidth;A.H=window.innerHeight;
  if(A.World.resize)A.World.resize();
  if(A.SVG.resize)A.SVG.resize();
  if(A.UI.resize)A.UI.resize();
  if(A.ready)A.renderNow();
};

/* ---- keyboard ---- */
A.onKey = (e)=>{
  const tag=(e.target&&e.target.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  const k=e.key;
  if(k>='1'&&k<='8'){A.scrollToChapter(parseInt(k,10)-1);e.preventDefault();return;}
  if(k==='p'||k==='P'){
    const i=A.FORMAT_ORDER.indexOf(A.state.precision);
    A.UI.cyclePrecision((i+1)%A.FORMAT_ORDER.length);e.preventDefault();return;
  }
  if(k==='ArrowDown'||k==='PageDown'){A.stepScroll(0.035);e.preventDefault();return;}
  if(k==='ArrowUp'||k==='PageUp'){A.stepScroll(-0.035);e.preventDefault();return;}
  if(k==='ArrowRight'){A.stepScroll(0.016);e.preventDefault();return;}
  if(k==='ArrowLeft'){A.stepScroll(-0.016);e.preventDefault();return;}
  if(k==='Home'){A.scrollToProgress(0,0.6);e.preventDefault();return;}
  if(k==='End'){A.scrollToProgress(1,0.6);e.preventDefault();return;}
};

/* ---- drag on canvas (camera orbit / zoom) ---- */
A.bindCanvasDrag = ()=>{
  const c=document.getElementById('gl');let dragging=false,lx=0,ly=0,moved=0;
  c.addEventListener('pointerdown',(e)=>{
    dragging=true;moved=0;lx=e.clientX;ly=e.clientY;c.classList.add('dragging');
    c.setPointerCapture&&c.setPointerCapture(e.pointerId);
  });
  window.addEventListener('pointermove',(e)=>{
    if(!dragging)return;
    const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);
    const st=A.state;
    st.userYaw=U.clamp(st.userYaw-dx*0.005,-1.25,1.25);
    st.userPitch=U.clamp(st.userPitch+dy*0.004,-0.75,0.85);
    st.rev++;
    // horizontal drag inside chapter 04 moves the observation window
    if(A.chapterIndex(A.P)===3 && Math.abs(dx)>0){
      st.lens.x=U.clamp(st.lens.x+dx/A.W,0.06,0.94);
      st.lens.y=U.clamp(st.lens.y+dy/A.H,0.06,0.94);
      st.lensUser=true;
    }
  });
  const up=()=>{dragging=false;c.classList.remove('dragging');};
  window.addEventListener('pointerup',up);
  c.addEventListener('wheel',(e)=>{
    const st=A.state;st.userZoom=U.clamp(st.userZoom*(e.deltaY>0?1.08:0.925),0.45,2.6);st.rev++;
  },{passive:true});
};

/* ---- boot ---- */
A.boot = ()=>{
  A.W=window.innerWidth;A.H=window.innerHeight;
  A.World.init();
  A.SVG.init();
  A.UI.init();
  A.Director.init();
  A.bindCanvasDrag();
  window.addEventListener('resize',A.resize);
  window.addEventListener('keydown',A.onKey);
  A.ready=true;_resolveReady();
  A.P=A.progressFromScroll();A.T=0;
  A.renderNow();
  requestAnimationFrame(loop);
};

/* ---------------- videoExport API ---------------- */
let _snapshot=null;
A.videoExport={
  runs:['page'],
  begin:async function(run,opts){
    await A.readyPromise;
    // snapshot user state, restore on end()
    _snapshot=JSON.parse(JSON.stringify(A.state));
    A.set(A.defaultState());
    A.exportMode=true;A._tween=null;
    window.scrollTo(0,0);
    A.P=0;A.T=0;
    A.renderNow();
    if(A.World.gl)A.World.gl.finish();
    const chapters=A.chapters.map(c=>({id:c.id,start:c.start,end:c.end}));
    // finer zones for pacing (optional, consumed by caller if desired)
    return {fps:(opts&&opts.fps)||60, chapters:chapters,
            zones:A.chapters.map(c=>({id:c.id,start:c.start,end:c.end,
                                     weight:c.horizontal?1.35:1.0}))};
  },
  frame:async function(progress,time){
    await A.readyPromise;
    A.exportMode=true;
    A.P=U.clamp(progress,0,1);
    A.T=(typeof time==='number')?time:0;
    A.renderNow();
    if(A.World.gl){A.World.gl.flush();A.World.gl.finish();}
    // yield one paint so the composited frame is on screen
    await Promise.race([
      new Promise(r=>requestAnimationFrame(()=>r())),
      new Promise(r=>setTimeout(r,45))
    ]);
  },
  end:function(){
    A.exportMode=false;
    if(_snapshot){A.state=_snapshot;_snapshot=null;A.state.rev++;}
    window.scrollTo(0,A.progressFromScroll()*A.scrollMax());
    A.P=A.progressFromScroll();
    A.renderNow();
  }
};
window.videoExport=A.videoExport;

})();
