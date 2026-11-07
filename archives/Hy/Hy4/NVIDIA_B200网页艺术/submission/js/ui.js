/* ============================================================
   ui.js — DOM panels, controls, real numeric formats, matrix
           lab, multi-GPU task, spec table, keyboard/focus
   ============================================================ */
(function () {
'use strict';
const A=window.APP,U=A.util;
const I=A.UI={};
const $=id=>document.getElementById(id);
const F=A.FORMATS;

/* ================================================================
   numeric formats — real bit layouts, value sets, rounding
   ================================================================ */
function rne(q){ // round half to even on an integer ratio
  const fl=Math.floor(q),fr=q-fl;
  if(fr<.5-1e-12)return fl;
  if(fr>.5+1e-12)return fl+1;
  return (fl%2===0)?fl:fl+1;
}
function quantGeneric(x,e,m,bias,maxVal){
  if(!isFinite(x))return x;
  if(x===0)return 0;
  const s=x<0?-1:1,a=Math.abs(x);
  const minNormalExp=1-bias;
  let ex=Math.floor(Math.log2(a));
  let step;
  if(ex<minNormalExp)step=Math.pow(2,minNormalExp-m); // subnormal
  else step=Math.pow(2,ex-m);
  let q=rne(a/step)*step;
  const cap=maxVal||Math.pow(2,(1<<e)-2-bias)*(2-Math.pow(2,-m));
  if(q>cap)q=cap;
  return s*q;
}
const FP4V=[0,0.5,1,1.5,2,3,4,6];
function fp4Nearest(y){
  const a=Math.abs(y),sg=Math.sign(y);
  let best=0,bd=1e18;
  for(const c of FP4V){
    const d=Math.abs(c-a);
    if(d<bd-1e-9){bd=d;best=c;}
    else if(Math.abs(d-bd)<1e-9&&(c*2)%2===0)best=c;
  }
  return sg*best;
}
// E4M3 FP8 block scale from a 16-value micro-block
function blockScale(vals){
  let amax=0;vals.forEach(v=>amax=Math.max(amax,Math.abs(v)));
  if(amax===0)return 1;
  let s=quantGeneric(amax/6,4,3,7,448);   // E4M3 FP8 scale
  return s>0?s:amax/6;
}
function fp4Block(vals){
  const s=blockScale(vals);
  return {q:vals.map(v=>fp4Nearest(v/s)*s),s};
}
function quantOne(v,key){
  switch(key){
    case 'FP64':return v;
    case 'TF32':return quantGeneric(v,8,10,127);
    case 'FP16':return quantGeneric(v,5,10,15);
    case 'BF16':return quantGeneric(v,8,7,127);
    case 'FP8': return quantGeneric(v,4,3,7,448);
    case 'FP4': return fp4Nearest(v/fp4Scale())*fp4Scale();
    default:return v;
  }
}
function fp4Scale(){
  const st=A.state;const vals=[].concat(...st.matA,...st.matB);
  return blockScale(vals);
}
I.quantize=quantOne;
I.fp4Scale=fp4Scale;

/* structured 2:4 sparsity on a 4x4 matrix */
function sparseMask(m){
  return m.map(row=>{
    const pairs=[[0,1,2,3]];
    const out=row.slice();
    const idx=[0,1,2,3].sort((a,b)=>Math.abs(row[b])-Math.abs(row[a]));
    out[idx[2]]=0;out[idx[3]]=0;
    return out;
  });
}

/* ================================================================
   matrix lab computation
   ================================================================ */
I.computeLab=(st)=>{
  const n=4;
  const A0=st.sparse?sparseMask(st.matA):st.matA.map(r=>r.slice());
  const B0=st.matB.map(r=>r.slice());
  let Aq,Bq,scaleA=null,scaleB=null;
  const key=st.precision;
  if(key==='FP4'){
    const fa=fp4Block([].concat(...A0)),fb=fp4Block([].concat(...B0));
    scaleA=fa.s;scaleB=fb.s;
    Aq=[];Bq=[];
    for(let i=0;i<n;i++){
      Aq.push(fa.q.slice(i*n,i*n+n));Bq.push(fb.q.slice(i*n,i*n+n));
    }
  }else{
    Aq=A0.map(r=>r.map(v=>quantOne(v,key)));
    Bq=B0.map(r=>r.map(v=>quantOne(v,key)));
  }
  // real multiply-accumulate on quantized values
  const C=[],C0=[];let macs=0,totalMacs=0,maxErr=0;
  for(let i=0;i<n;i++){
    C.push([]);C0.push([]);
    for(let j=0;j<n;j++){
      let acc=0,acc0=0;
      for(let k=0;k<n;k++){
        acc+=Aq[i][k]*Bq[k][j];
        acc0+=A0[i][k]*B0[k][j];
        totalMacs++;
        if(A0[i][k]!==0&&B0[k][j]!==0)macs++;
      }
      C[i].push(acc);C0[i].push(acc0);
      maxErr=Math.max(maxErr,Math.abs(acc-acc0));
    }
  }
  const errA=[];for(let i=0;i<n;i++){errA.push([]);for(let j=0;j<n;j++)
    errA[i].push(Math.abs(Aq[i][j]-A0[i][j]));}
  return {A0,B0,Aq,Bq,C,C0,errA,macs,totalMacs,maxErr,scaleA,scaleB,key};
};

/* ================================================================
   multi-GPU sharding / all-reduce task
   ================================================================ */
I.shardTask=(st)=>{
  const lab=I.computeLab(st);
  const flat=[].concat(...lab.A0),flatB=[].concat(...lab.B0);
  const partials=[];let total=0;
  for(let g=0;g<8;g++){
    // each GPU owns two (a,b) pairs derived from the shared lab input
    let s=0;
    for(let k=0;k<2;k++){
      const idx=(g*2+k)%16;
      s+=flat[idx]*flatB[(idx+5)%16];
    }
    partials.push(s);total+=s;
  }
  const phase=((A.T-st.replay6)%6+6)%6;
  const active=phase<4;
  const done=phase>=4;
  const grow=U.sstep(0,2.0,phase);
  const red=U.sstep(2.0,4.0,phase);
  const shown=partials.map(v=>U.lerp(v*grow,total,red));
  return {partials:shown,rawPartials:partials,total,done,active,phase};
};

/* logical capacity model (same lab input, same precision) */
I.capacity=(st)=>{
  const elements=(180+st.workload*1200)*1e9; // logical elements in the workload
  const bits=F[st.precision].bits;
  const bytes=elements*bits/8;
  const perGPU=192e9*0.85;                  // 192 GB HBM3e, ~85% usable (logical estimate)
  const gpus=Math.max(1,Math.ceil(bytes/perGPU));
  const platforms=Math.ceil(gpus/8);
  return {elements,bytes,perGPU,gpus,platforms,bits,shards:8};
};

I.metricName=(m)=>({compose:'组成',mem:'显存容量',bw:'显存带宽',nvlink:'互连',
  fp4:'FP4 算力',fp8:'FP8 算力',fp16:'FP16 算力',tf32:'TF32 算力',
  fp64:'FP64 算力',power:'功耗',compute:'算力',interconnect:'互连'}[m]||m);

/* ================================================================
   product specification data (one consistent configuration)
   ================================================================ */
I.PRODUCTS=[
  {name:'B200',sub:'单颗 GPU · 2 dies',
   compose:'2 × reticle die = 1 GPU',mem:'192 GB HBM3e',bw:'8 TB/s',
   nvlink:'NVLink 5 · 1.8 TB/s 双向',fp4:'9 / 18 PFLOPS',fp8:'4.5 / 9 PFLOPS',
   fp16:'2.25 / 4.5 PFLOPS',tf32:'1.1 / 2.2 PFLOPS',fp64:'40 TFLOPS',power:'1000 W (SXM)'},
  {name:'HGX B200',sub:'8 GPU 平台',
   compose:'8 × B200 · NVSwitch',mem:'1.5 TB (8×192 GB)',bw:'64 TB/s 合计',
   nvlink:'NVLink 5 八卡全互联',fp4:'72 / 144 PFLOPS',fp8:'36 / 72 PFLOPS',
   fp16:'18 / 36 PFLOPS',tf32:'8.8 / 17.6 PFLOPS',fp64:'320 TFLOPS',power:'≈ 8 kW (板级)'},
  {name:'DGX B200',sub:'8 GPU 完整系统',
   compose:'8 × B200 + 2 × Xeon',mem:'1.5 TB · 文档记 1.4 TB',bw:'64 TB/s 合计',
   nvlink:'NVLink 5 + NVSwitch + CX-7 / BF-3',fp4:'72 / 144 PFLOPS',fp8:'36 / 72 PFLOPS',
   fp16:'18 / 36 PFLOPS',tf32:'8.8 / 17.6 PFLOPS',fp64:'320 TFLOPS',power:'峰值 14.3 kW'},
  {name:'GB200',sub:'1 Grace + 2 GPU',
   compose:'1 Grace CPU + 2 × B200',mem:'384 GB HBM + LPDDR5X',bw:'16 TB/s 合计',
   nvlink:'NVLink-C2C 900 GB/s + NVLink 5',fp4:'20 / 40 PFLOPS',fp8:'10 / 20 PFLOPS',
   fp16:'5 / 10 PFLOPS',tf32:'2.4 / 4.8 PFLOPS',fp64:'80 TFLOPS',power:'≈ 2.7 kW (超芯片)'},
  {name:'GB200 NVL72',sub:'36 CPU + 72 GPU',
   compose:'36 Grace + 72 B200',mem:'13.8 TB HBM · 30 TB 快速内存',bw:'576 TB/s 合计',
   nvlink:'NVLink 5 机柜域 ≈130 TB/s',fp4:'≈ 1.4 EFLOPS',fp8:'≈ 720 PFLOPS',
   fp16:'≈ 360 PFLOPS',tf32:'≈ 158 PFLOPS',fp64:'≈ 2.9 PFLOPS',power:'液冷机柜 ≈ 120 kW'}
];
I.METRICS=[
  {k:'compose',n:'组成 COMPOSITION'},
  {k:'mem',n:'显存容量 HBM'},
  {k:'bw',n:'显存带宽 BANDWIDTH'},
  {k:'nvlink',n:'互连 INTERCONNECT'},
  {k:'fp4',n:'FP4 算力 (稠密/稀疏)'},
  {k:'fp8',n:'FP8 算力 (稠密/稀疏)'},
  {k:'fp16',n:'FP16 算力 (稠密/稀疏)'},
  {k:'tf32',n:'TF32 算力 (稠密/稀疏)'},
  {k:'fp64',n:'FP64 Tensor 算力'},
  {k:'power',n:'功耗 POWER'}
];

/* ================================================================
   init: build all DOM controls
   ============================================================ */
I.init=()=>{
  I.lastRev=-1;I.panels=[...document.querySelectorAll('.panel')];
  document.querySelectorAll('input[type=range]').forEach(el=>{
    const lab=el.closest('label');
    el.setAttribute('aria-label',lab?lab.textContent.replace(/\s+/g,' ').trim():'参数调节');
  });
  /* rail */
  const rl=$('railList');
  A.chapters.forEach((c,i)=>{
    const li=document.createElement('li');li.tabIndex=0;li.dataset.i=i;
    li.innerHTML=`<span class="rl-num">${c.id}</span><span class="rl-name">${c.label}</span>`;
    li.addEventListener('click',()=>A.scrollToChapter(i));
    li.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){A.scrollToChapter(i);e.preventDefault();}});
    rl.appendChild(li);I['rail'+i]=li;
  });
  /* progress segments */
  const segs=$('ptSegs');
  A.chapters.forEach(c=>{
    const d=document.createElement('div');d.className='pt-seg';
    d.style.width=((c.end-c.start)*100)+'%';segs.appendChild(d);
  });
  I.segEls=[...segs.children];
  const track=$('progressTrack');
  const jump=e=>{
    const r=track.getBoundingClientRect();
    A.scrollToProgress(U.clamp((e.clientX-r.left)/r.width,0,1),.5);
  };
  track.addEventListener('pointerdown',e=>{jump(e);track.setPointerCapture(e.pointerId);track._drag=true;});
  track.addEventListener('pointermove',e=>{if(track._drag)jump(e);});
  track.addEventListener('pointerup',()=>{track._drag=false;});
  /* precision chip */
  $('precisionChip').addEventListener('click',()=>{
    const i=A.FORMAT_ORDER.indexOf(A.state.precision);I.cyclePrecision((i+1)%6);
  });
  /* parts */
  const pl=$('partsList');
  A.Director.partsMeta.forEach(p=>{
    const b=document.createElement('button');b.type='button';b.className='part-btn';
    b.innerHTML=`<span>${p.label}</span><span class="pb-id">${p.id}</span>`;
    b.addEventListener('click',()=>{
      const st=A.state,same=st.selectedPart===p.name;
      A.set({selectedPart:p.name,partDetail:same?Math.min(2,st.partDetail+1):1,
             detailSince:A.T});
    });
    pl.appendChild(b);I['part_'+p.name]=b;
  });
  $('dcBack').addEventListener('click',()=>A.set({selectedPart:null,partDetail:0}));
  /* sliders */
  const bind=(id,key,userKey,fmtFn)=>{
    const el=$(id);el.addEventListener('input',()=>{
      A.set({[key]:+el.value/100,[userKey]:true});
    });return el;
  };
  I.sExplode=bind('sExplode','explode','explodeUser');
  I.sSeam=bind('sSeam','seam','seamUser');
  I.sSection=bind('sSection','section','sectionUser');
  I.sWorkload=$('sWorkload');
  I.sWorkload.addEventListener('input',()=>A.set({workload:+I.sWorkload.value/100}));
  /* regions */
  const regL=$('regionList');
  A.Director.regions.forEach((r,i)=>{
    const b=document.createElement('button');b.type='button';b.className='region-btn';
    b.textContent=(i+1).toString().padStart(2,'0')+' '+r.name;
    b.addEventListener('click',()=>A.set({region:i}));regL.appendChild(b);I['reg'+i]=b;
  });
  $('btnReplay3').addEventListener('click',()=>A.set({replay3:A.T}));
  $('btnReplay4').addEventListener('click',()=>A.set({replay4:A.T}));
  $('btnReplay6').addEventListener('click',()=>A.set({replay6:A.T,shardSel:-1}));
  /* format row */
  const fr=$('fmtRow');
  A.FORMAT_ORDER.forEach((k,i)=>{
    const b=document.createElement('button');b.type='button';b.className='fmt-btn';b.tabIndex=0;
    b.innerHTML=`<div class="fb-n">${k}</div><div class="fb-b">${F[k].bits}b · ${F[k].s}/${F[k].e}/${F[k].m}</div>`;
    b.addEventListener('click',()=>I.cyclePrecision(i));
    fr.appendChild(b);I['fmt'+k]=b;
  });
  /* lab matrices */
  const mk=(id,cap,editable)=>{
    const wrap=document.createElement('div');wrap.className='mtx';wrap.id=id;
    const c=document.createElement('div');c.className='mtx-cap';c.innerHTML=cap;wrap.appendChild(c);
    const grid=document.createElement('div');grid.className='mtx-cells';
    grid.style.gridTemplateColumns='repeat(4,1fr)';wrap.appendChild(grid);
    const cells=[];
    for(let r=0;r<4;r++){cells.push([]);for(let cc=0;cc<4;cc++){
      const d=document.createElement('div');d.className='mtx-cell';d.dataset.r=r;d.dataset.c=cc;
      if(editable){
        const inp=document.createElement('input');inp.type='number';inp.step='0.25';
        inp.value=A.state[editable][r][cc];
        inp.id=`cell_${editable}_${r}_${cc}`;
        inp.setAttribute('aria-label',`矩阵 ${editable==='matA'?'A':'B'} 元素 ${r+1},${cc+1}`);
        d.appendChild(inp);
        inp.addEventListener('input',()=>{
          const v=parseFloat(inp.value);if(!isNaN(v)){
            A.state[editable][r][cc]=v;A.state.rev++;
          }
        });
        inp.addEventListener('focus',()=>A.set({selectedCell:{m:editable==='matA'?'A':'B',r,c:cc}}));
      }
      d.addEventListener('click',()=>A.set({selectedCell:{m:id==='mxA'||id==='mxAq'?'A':'B',r,c:cc}}));
      grid.appendChild(d);cells[r].push(d);
    }}
    return {wrap,cells};
  };
  const lg=$('labGrid');
  I.mxA=mk('mxA','<b>A</b> 原值 · 可编辑','matA');
  const op1=document.createElement('div');op1.className='mtx-op';op1.textContent='×';
  I.mxB=mk('mxB','<b>B</b> 原值 · 可编辑','matB');
  const op2=document.createElement('div');op2.className='mtx-op';op2.textContent='=';
  I.mxC=mk('mxC','<b>C</b> = Aq × Bq',null);
  lg.append(I.mxA.wrap,op1,I.mxB.wrap,op2,I.mxC.wrap);
  const lg2=document.createElement('div');lg2.className='lab-grid';lg2.style.marginTop='10px';
  I.mxAq=mk('mxAq','Aq 量化',null);
  I.mxBq=mk('mxBq','Bq 量化',null);
  I.mxErr=mk('mxErr','Δ 误差',null);
  lg2.append(I.mxAq.wrap,I.mxBq.wrap,I.mxErr.wrap);
  $('labBlock').insertBefore(lg2,$('labBlock').querySelector('.lab-ctl'));
  $('btnSparse').addEventListener('click',()=>A.set({sparse:!A.state.sparse}));
  $('btnRandom').addEventListener('click',()=>{
    const rnd=()=>Math.round((Math.random()*6-3)*4)/4;
    A.set({matA:Array.from({length:4},()=>Array.from({length:4},rnd)),
           matB:Array.from({length:4},()=>Array.from({length:4},rnd))});
    // refresh inputs
    I.refreshInputs();
  });
  $('btnRun').addEventListener('click',()=>A.set({running:!A.state.running,runStart:A.T}));
  /* products */
  const pr=$('prodRow');
  A.Director.products.forEach((p,i)=>{
    const b=document.createElement('button');b.type='button';b.className='prod-btn';
    b.textContent=p.name;b.title=p.sub;
    b.addEventListener('click',()=>A.set({product:i,productUser:true}));
    pr.appendChild(b);I['prod'+i]=b;
  });
  /* shard grid */
  const sg=$('shardGrid');
  for(let i=0;i<8;i++){
    const d=document.createElement('div');d.className='shard';d.tabIndex=0;
    d.innerHTML=`<div class="sh-id">GPU ${i}</div><div class="sh-v">—</div>`;
    d.addEventListener('click',()=>A.set({shardSel:i,replay6:A.T}));
    sg.appendChild(d);I['shard'+i]=d;
  }
  /* work row */
  const wr=$('workRow');
  [['训练 TRAINING','梯度 / 激活'],['推理 INFERENCE','逐 token 流水'],['科学计算 HPC','FP64 迭代']]
  .forEach((w,i)=>{
    const b=document.createElement('button');b.type='button';b.className='work-btn';
    b.innerHTML=`<div class="wb-n">${w[0]}</div><div class="wb-s">${w[1]}</div>`;
    b.addEventListener('click',()=>A.set({workloadType:i}));
    wr.appendChild(b);I['work'+i]=b;
  });
  /* spec table */
  buildSpec();
};

I.refreshInputs=()=>{
  ['mxA','mxB'].forEach((k,r)=>{
    const m=(k==='mxA')?'matA':'matB';
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){
      const inp=I[k].cells[r][c].querySelector('input');
      if(inp)inp.value=A.state[m][r][c];
    }
  });
};

I.cyclePrecision=(idx)=>{
  const k=A.FORMAT_ORDER[U.clamp(idx,0,5)];
  A.set({precision:k});
};

function buildSpec(){
  const w=$('specWrap');
  let h='<table class="spec"><thead><tr><th style="width:132px">指标 METRIC<span class="th-sub">点击列 / 行高亮</span></th>';
  I.PRODUCTS.forEach((p,i)=>{
    h+=`<th data-prod="${i}">${p.name}<span class="th-sub">${p.sub}</span></th>`;
  });
  h+='</tr></thead><tbody>';
  I.METRICS.forEach(m=>{
    h+=`<tr data-metric="${m.k}"><th data-metric="${m.k}">${m.n}</th>`;
    I.PRODUCTS.forEach(p=>{
      const v=p[m.k]||'—';
      h+=`<td data-metric="${m.k}"><span class="big">${v}</span></td>`;
    });
    h+='</tr>';
  });
  h+='</tbody></table>';
  w.innerHTML=h;
  w.querySelectorAll('[data-metric]').forEach(el=>el.addEventListener('click',()=>{
    A.set({specMetric:el.getAttribute('data-metric')});
  }));
  w.querySelectorAll('[data-prod]').forEach(el=>el.addEventListener('click',()=>{
    A.set({product:+el.getAttribute('data-prod'),productUser:true});
  }));
}

/* ================================================================
   per-frame update
   ================================================================ */
I.lensTag=(x,y,w)=>{
  const el=$('lensTag');
  el.style.left=(x)+'px';el.style.top=(y-118)+'px';
  el.style.opacity=(w>.4?.85:0);
};

I.update=(p,t,st)=>{
  const dd=A.Director.derived,W=A.W,H=A.H;
  /* panels opacity / focus */
  I.panels.forEach((el,i)=>{
    const w=dd.w[i];
    el.style.opacity=w.toFixed(3);
    el.style.pointerEvents=w>.55?'auto':'none';
    el.style.translate='0 '+((1-w)*34).toFixed(1)+'px';
    el.setAttribute('aria-hidden',w>.5?'false':'true');
  });
  /* rail + progress */
  const active=dd.ci;
  for(let i=0;i<8;i++){
    I['rail'+i].classList.toggle('on',i===active);
    I.segEls[i].classList.toggle('cur',i===active);
  }
  $('ptFill').style.width=(p*100).toFixed(2)+'%';
  $('ptHead').style.left=(p*100).toFixed(2)+'%';
  $('footCh').textContent=A.chapters[active].id;
  $('footName').textContent=A.chapters[active].label;
  $('footProg').textContent=(p*100).toFixed(1)+'%';
  $('footHint').textContent=A.chapters[active].horizontal?'← HORIZONTAL →':'SCROLL / 滚动浏览';
  /* precision chip */
  const f=F[st.precision];
  $('pcValue').textContent=st.precision;
  $('pcSub').textContent=f.sub;
  $('pcValue').style.color=f.color;

  /* ---------------------------------------------------------- */
  if(st.rev!==I.lastRev){I.updateStatic(st);I.lastRev=st.rev;}

  /* ---- time/progress driven readouts ---- */
  // ch1 transistor counter
  const L=dd.locals;
  // the full scale is always legible; a subtle digit flicker echoes the cell regrouping
  const flick=U.sstep(0,.35,L[0]);
  const n=208000000000;
  $('c1Num').textContent=U.num(n);
  $('c1Num').style.opacity=(.82+.18*flick).toFixed(2);
  // ch2 sliders reflect scroll baseline when untouched
  if(!st.explodeUser)I.sExplode.value=Math.round(dd.explode*100);
  if(!st.seamUser)I.sSeam.value=Math.round(dd.seam*100);
  I.sSection.value=Math.round(st.section*100);
  $('oExplode').textContent=Math.round(dd.explode*100)+'%';
  $('oSeam').textContent=Math.round(dd.seam*100)+'%';
  $('oSection').textContent=Math.round(st.section*100)+'%';
  I.sWorkload.value=Math.round(st.workload*100);
  const cap=I.capacity(st);
  $('oWorkload').textContent=U.si(cap.elements)+' 元素';

  // ch2 detail card
  const pm=A.Director.partsMeta.find(x=>x.name===st.selectedPart);
  $('dcName').textContent=pm?pm.label+'  ·  '+(st.partDetail===2?'二级细看':'一级细看'):'整体 ASSEMBLY';
  $('dcBody').textContent=pm?A.World.PARTS.find(q=>q.name===pm.name).desc:'拖动旋转 · 滚轮推近拉远 · 点击部件深入一级';
  $('dcMeta').textContent=pm?('当前精度 '+st.precision+' · 16 值逻辑分区 '+U.num(16*f.bits/8,1)+' B · 展开 '+Math.round(dd.explode*100)+'%'):'';
  $('c2Hint').textContent='展开 '+Math.round(dd.explode*100)+'% · 剖切 x='+dd.cutX.toFixed(2)+' · 接缝 '+gapText(dd.seam);

  // ch4 readout (precision linked)
  const lab=I.computeLab(st);
  const bytesBlock=16*f.bits/8;
  $('c4Prec').textContent=st.precision+' · '+f.bits+' bit';
  $('c4Readout').innerHTML=
    `数据块位宽 <b class="cy">${f.bits} bit</b> · 分组 <b>16 值 / 微块</b><br>`+
    `同一批数据 16 值占用 <b class="cy">${bytesBlock} B</b>（FP4 含共享缩放约 4.5 bit/值）<br>`+
    `传输批次 <b>${Math.max(1,Math.round(16/f.bits))}</b> · 八路并行 · 结果 ${lab.C[0][0].toFixed(2)} …<br>`+
    `<span class="hot">容量 ${$('c4Cap').textContent} ≠ 带宽 ${$('c4Bw').textContent}：前者是「放多少」，后者是「每秒搬多少」</span>`;

  // ch5 lab readout
  const demoRate=st.running?2.4e12:0;
  const ops=st.running?Math.floor((t-st.runStart)*demoRate):0;
  const sparseInfo=st.sparse?`稀疏 2:4 · 实际参与 <b>${lab.macs}</b> / ${lab.totalMacs} MAC`:`稠密 · <b>${lab.totalMacs}</b> MAC`;
  $('labReadout').innerHTML=
    `格式 <b class="am">${st.precision}</b> · ${f.bits} bit · ${f.sub}<br>`+
    (lab.scaleA?`NVFP4 共享缩放 s<sub>A</sub>=<b>${lab.scaleA.toFixed(3)}</b> · s<sub>B</sub>=<b>${lab.scaleB.toFixed(3)}</b>（E4M3 FP8 / 16 值微块）<br>`:'')+
    `量化最大误差 Δ=<b>${lab.maxErr.toFixed(3)}</b> · 选中元素追踪其乘加与输出<br>`+
    `${sparseInfo} · 示意工作量 <b>${U.si(ops)}</b> 次乘加<br>`+
    `演示速率 <b>${(demoRate/1e12).toFixed(1)} T</b> MAC/s（示意） · 官方峰值 <b>${f.flops}</b>（稠密/稀疏口径，见第 07 章）`;
  $('runState').textContent=st.running?'ON':'OFF';
  $('btnRun').style.borderColor=st.running?'#8bd44e':'';

  // ch6 task
  const task=I.shardTask(st);
  $('c6Status').textContent=task.done?'归约完成 · 各卡一致':(task.active?'计算 / 归约中…':'等待重放');
  for(let i=0;i<8;i++){
    const d=I['shard'+i];
    d.querySelector('.sh-v').textContent=task.partials[i].toFixed(1);
    d.classList.toggle('on',i===st.shardSel);
    d.classList.toggle('done',task.done);
  }
  $('c6Readout').innerHTML=
    `同一份输入（矩阵实验）× 负载规模 → <b>${U.si(cap.elements)}</b> 元素<br>`+
    `逻辑显存占用 <b class="vi">${(cap.bytes/1e9).toFixed(0)} GB</b>（按 ${f.bits} bit 估算，不含 ECC / 系统开销）<br>`+
    `单卡可用 ≈ ${(cap.perGPU/1e9).toFixed(0)} GB / 192 GB → <b class="am">${cap.gpus>1?'单卡装不下':'可容纳'}</b><br>`+
    `所需 GPU <b>${cap.gpus}</b> 颗 → HGX / DGX 平台 <b>${cap.platforms}</b> 套 · 八卡任务分 <b>${cap.shards}</b> 片<br>`+
    `归约结果 <b class="hot">∑ = ${task.total.toFixed(1)}</b> → 每颗 GPU 得到一致汇总<br>`+
    `<span style="color:#46525e">链路口径：NVLink 5 每 GPU 1.8 TB/s 双向；容量为逻辑估算，不在浏览器中分配整卡显存</span>`;

  // ch7 spec note
  $('specNote').innerHTML=
    `<b>口径：</b>算力均为 Tensor Core「稠密 / 稀疏(2:1)」两份读数，稀疏值为稠密的 2 倍；FP4 采用 NVFP4 (E2M1 + E4M3 共享缩放)。`+
    `单颗 GPU 指标与整机总量分开列出。<b>显存容量：</b>此处按 B200 SXM 8×24 GB = 192 GB / 8 TB/s 口径；`+
    `NVIDIA DGX BasePOD 文档把 DGX B200 记为 1.4 TB（对应 8×180 GB 配置），属不同公开配置，已分别标注。`+
    `<b>来源：</b>NVIDIA Blackwell 平台发布说明（2080 亿晶体管 / 双晶粒 / 10 TB/s 片间互连 / 第五代 NVLink 1.8 TB/s / GB200 NVL72：36 Grace + 72 GPU、1.4 EFLOPS、30 TB 快速内存）；`+
    `NVIDIA DGX BasePOD 参考架构（DGX B200：8×B200、1.4 TB、双 Xeon、CX-7 / BlueField-3）；`+
    `NVIDIA GB200 / NVL72 技术说明；NVIDIA NVFP4 技术博客（E2M1、16 值微块、E4M3 缩放）。`+
    `功耗为公开典型/峰值口径，不同散热与配置有差异。本页为概念设计作品，非 NVIDIA 官方页面。`;

  // ch8 readout
  const f8=F[st.precision];
  const wlName=['训练','推理','科学计算'][st.workloadType];
  $('c8Readout').innerHTML=
    `<div><span class="k">当前格式</span><span class="v">${st.precision}</span> <span style="color:#8a97a5">${f8.sub}</span></div>`+
    `<div><span class="k">峰值读数</span><span class="v">${f8.flops}</span> <span style="color:#8a97a5">稠密 / 稀疏</span></div>`+
    `<div><span class="k">负载类型</span><span class="v">${wlName}</span> <span style="color:#8a97a5">${st.workloadType===2?'采用 FP64（单独标明）':'沿用当前 '+st.precision}</span></div>`+
    `<div><span class="k">负载规模</span><span class="v">${U.si(cap.elements)}</span> <span style="color:#8a97a5">元素 · ${(cap.bytes/1e9).toFixed(0)} GB</span></div>`+
    `<div><span class="k">所需 GPU</span><span class="v">${cap.gpus}</span> <span style="color:#8a97a5">颗</span></div>`;
  // selected element tracing note
  $('c5Hint').textContent=st.selectedCell
    ? `已选 ${st.selectedCell.m}[${st.selectedCell.r},${st.selectedCell.c}] → 行/列与参与的乘加、输出 C 同步高亮`
    : '滚动中的格式讲解不会覆盖你选定的全页精度';
};
function gapText(s){return s<.02?'闭合':(s>.4?'断开':'拉开了 '+Math.round(s*100)+'%');}

/* -------------------------------------------------------------- */
I.updateStatic=(st)=>{
  const f=F[st.precision];
  /* format buttons */
  A.FORMAT_ORDER.forEach(k=>I['fmt'+k].classList.toggle('on',k===st.precision));
  $('fmtNote').innerHTML=f.desc;
  $('labFmt').textContent=st.precision+(st.precision==='FP4'?' / NVFP4':'');
  /* parts / regions / products / work */
  A.Director.partsMeta.forEach(p=>I['part_'+p.name].classList.toggle('on',st.selectedPart===p.name));
  A.Director.regions.forEach((r,i)=>I['reg'+i].classList.toggle('on',st.region===i));
  const prod=st.productUser?st.product:A.Director.derived.product;
  A.Director.products.forEach((_,i)=>I['prod'+i].classList.toggle('on',i===prod));
  [0,1,2].forEach(i=>I['work'+i].classList.toggle('on',st.workloadType===i));
  $('btnSparse').textContent=st.sparse?'稀疏 SPARSE 2:4':'稠密 DENSE';
  $('btnSparse').classList.toggle('alt',st.sparse);
  /* lab matrices */
  const lab=I.computeLab(st);
  const setM=(M,data,fmt,cls)=>{
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){
      const el=M.cells[r][c];
      const inp=el.querySelector('input');
      if(inp)continue;
      el.textContent=fmt(data[r][c],r,c);
      el.className='mtx-cell'+(cls?cls(data[r][c],r,c):'');
    }
  };
  const num=(v)=>Math.abs(v)>=100?v.toFixed(0):v.toFixed(2);
  setM(I.mxC,lab.C,num,(v,r,c)=>cellCls(st,'C',r,c));
  setM(I.mxAq,lab.Aq,num,(v,r,c)=>cellCls(st,'A',r,c));
  setM(I.mxBq,lab.Bq,num,(v,r,c)=>cellCls(st,'B',r,c));
  setM(I.mxErr,lab.errA,(v)=>v.toFixed(2),(v)=>v>0.001?' err':'');
  // original matrices highlight
  ['mxA','mxB'].forEach((k,m)=>{
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){
      const el=I[k].cells[r][c];
      el.classList.toggle('zero',Math.abs(A.state[m==='mxA'?'matA':'matB'][r][c])<1e-9);
      el.classList.toggle('hi',isTrace(st,m==='mxA'?'A':'B',r,c));
      el.classList.toggle('hi2',isTrace(st,m==='mxA'?'B':'A',r,c));
    }
  });
  /* spec highlight */
  const metric=st.specMetric;
  document.querySelectorAll('table.spec [data-metric]').forEach(el=>{
    el.classList.toggle('on',el.getAttribute('data-metric')===metric&&el.tagName==='TH');
    el.classList.toggle('hl',el.getAttribute('data-metric')===metric&&el.tagName==='TD');
  });
  document.querySelectorAll('table.spec thead th[data-prod]').forEach(el=>{
    el.classList.toggle('on',+el.getAttribute('data-prod')===prod);
  });
};
function isTrace(st,m,r,c){
  const s=st.selectedCell;if(!s)return false;
  return (s.m===m&&s.r===r)||(s.m==='A'&&m==='B'&&s.c===c);
}
function cellCls(st,m,r,c){
  const s=st.selectedCell;if(!s)return '';
  if(s.m===m&&s.r===r&&s.c===c)return ' hi';
  if((m==='A'&&s.m==='A'&&s.r===r)||(m==='C'&&s.m==='A'&&s.r===r))return ' out';
  if((m==='B'&&s.m==='B'&&s.c===c)||(m==='C'&&s.m==='B'&&s.c===c))return ' hi2';
  return '';
}

I.resize=()=>{};

})();
