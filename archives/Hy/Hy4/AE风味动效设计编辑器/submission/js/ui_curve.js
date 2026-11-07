/* =========================================================================
   ui_curve.js — value / speed curve editor with expression curves, spatial
   path inset, keyframe & handle dragging, numeric input and easing presets.
   ========================================================================= */
(function(AE){
'use strict';
const clamp=AE.clamp,lerp=AE.lerp;
let app=null,root=null,canvas=null,ctx=null,side=null,drag=null;
const PAL=['#4fd1c5','#7c8cff','#f7b955','#ff6b9d','#8ce99a','#ffb86b','#a98bff','#5aa9ff'];
const st={tMin:0,tMax:15,vMin:-10,vMax:110,mode:'value',showPath:false,hidden:new Set(),sel:null,linked:true};

function comp(){return app.activeComp();}
function curves(){
  const out=[],c=comp();
  const sel=AE.state.selection||[];
  const layers=sel.length?c.layers.filter(l=>sel.indexOf(l.id)>=0):c.layers.filter(l=>Object.keys(l.props||{}).some(k=>AE.isAnimated(l.props[k]))).slice(0,6);
  let ci=0;
  for(const L of layers){
    for(const k in (L.props||{})){
      const p=L.props[k];if(!p||(!AE.isAnimated(p)&&!p.e))continue;
      out.push({L,k,p,color:PAL[ci++%PAL.length],id:L.id+'|'+k});
    }
  }
  return out;
}
function xOf(t){return (t-st.tMin)/(st.tMax-st.tMin)*canvas.clientWidth;}
function tOf(x){return st.tMin+x/canvas.clientWidth*(st.tMax-st.tMin);}
function yOf(v){return canvas.clientHeight-(v-st.vMin)/(st.vMax-st.vMin)*canvas.clientHeight;}
function vOf(y){return st.vMin+(canvas.clientHeight-y)/canvas.clientHeight*(st.vMax-st.vMin);}
function scalar(v){return typeof v==='number'?v:(Array.isArray(v)?v[0]:0);}

AE.CurveEditor={
  init(a){app=a;},
  mount(container){
    root=container;
    root.innerHTML=
      '<div class="cv-toolbar">'+
        '<div class="cb'+(st.mode==='value'?' on':'')+'" id="cvVal">值曲线</div>'+
        '<div class="cb'+(st.mode==='speed'?' on':'')+'" id="cvSpeed">速度曲线</div>'+
        '<div class="cb'+(st.showPath?' on':'')+'" id="cvPath">位置路径</div>'+
        '<div class="cb" id="cvFit">适配</div>'+
        '<div class="cb" id="cvLink" title="联动 / 断开手柄">手柄：联动</div>'+
        '<span style="flex:1"></span>'+
        '<span style="font-family:var(--mono);color:#646e7d" id="cvReadout">t 0.000 · v 0.00</span>'+
      '</div>'+
      '<div class="cv-body"><div class="cv-canvas-wrap"><canvas id="curveCanvas"></canvas></div>'+
      '<div class="cv-side" id="cvSide"></div></div>';
    canvas=root.querySelector('#curveCanvas');ctx=canvas.getContext('2d');
    side=root.querySelector('#cvSide');
    root.querySelector('#cvVal').onclick=()=>{st.mode='value';this.mountToolbarState();this.draw();};
    root.querySelector('#cvSpeed').onclick=()=>{st.mode='speed';this.mountToolbarState();this.draw();};
    root.querySelector('#cvPath').onclick=()=>{st.showPath=!st.showPath;this.mountToolbarState();this.draw();};
    root.querySelector('#cvFit').onclick=()=>{this.fit();this.draw();};
    root.querySelector('#cvLink').onclick=(e)=>{st.linked=!st.linked;e.target.textContent='手柄：'+(st.linked?'联动':'断开');};
    this.bind();
    this.fit();
    this.buildSide();
    this.resize();
  },
  mountToolbarState(){
    const q=(id,on)=>root.querySelector('#'+id).classList.toggle('on',on);
    q('cvVal',st.mode==='value');q('cvSpeed',st.mode==='speed');q('cvPath',st.showPath);
  },
  resize(){if(!canvas)return;const w=canvas.parentElement.clientWidth,h=canvas.parentElement.clientHeight,dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.max(2,w*dpr);canvas.height=Math.max(2,h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);this.draw();},
  fit(){
    const cs=curves(),c=comp();
    st.tMin=0;st.tMax=Math.max(1,c.duration);
    let lo=1e9,hi=-1e9;
    for(const cu of cs){
      const p=cu.p,ks=p.k||[];
      if(ks.length){for(const k of ks){const v=scalar(k.v);lo=Math.min(lo,v);hi=Math.max(hi,v);} }
      else {for(let t=0;t<=c.duration;t+=0.25){const v=scalar(AE.evalPropAt(p,t,app.project,c,cu.L,{}));lo=Math.min(lo,v);hi=Math.max(hi,v);} }
    }
    if(st.mode==='speed'){lo=0;hi=1;}
    if(!isFinite(lo)){lo=-10;hi=110;}
    const pad=(hi-lo)*0.18+2;st.vMin=lo-pad;st.vMax=hi+pad;
    if(st.vMax-st.vMin<1){st.vMin-=1;st.vMax+=1;}
  },
  buildSide(){
    const cs=curves();
    let h='<div class="cv-sec">曲线 ('+cs.length+')</div>';
    cs.forEach(cu=>{
      h+='<div class="cv-legend" data-cu="'+cu.id+'"><span class="sw" style="background:'+cu.color+'"></span>'+
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(cu.L.name)+' · '+pl(cu.k)+'</span>'+
        '<span style="color:#646e7d;font-size:9px">'+(st.hidden.has(cu.id)?'○':'●')+'</span></div>';
    });
    h+='<div class="cv-sec">缓动预设</div><div class="cv-ease">'+
      [['linear','线性'],['ease','缓入缓出'],['easeIn','缓入'],['easeOut','缓出'],['hold','定格']].map(e=>'<div class="ce" data-ease="'+e[0]+'">'+e[1]+'</div>').join('')+'</div>';
    h+='<div class="cv-sec">选中关键帧</div><div class="cv-readout" id="cvSel">未选择<br><span style="color:#646e7d">点击曲线上的菱形</span></div>';
    h+='<div class="form-row" style="margin:4px 0"><label style="width:34px;font-size:9px">时间</label><input id="cvT" class="pg-num" type="text" value="0.000" style="background:#0c0e12;border:1px solid #2c323d;border-radius:4px;padding:3px;width:100%;color:#4fd1c5;font-family:var(--mono)"></div>';
    h+='<div class="form-row" style="margin:4px 0"><label style="width:34px;font-size:9px">数值</label><input id="cvV" class="pg-num" type="text" value="0" style="background:#0c0e12;border:1px solid #2c323d;border-radius:4px;padding:3px;width:100%;color:#e8c15a;font-family:var(--mono)"></div>';
    h+='<div class="cv-sec">图例</div><div class="port-legend"><span class="pd" style="background:#e8c15a"></span>关键帧 / 手柄</div>'+
       '<div class="port-legend"><span class="pd" style="background:#7c8cff"></span>表达式最终求值曲线</div>'+
       '<div class="port-legend"><span class="pd" style="background:#8ce99a"></span>逐帧取样点</div>';
    side.innerHTML=h;
    side.querySelectorAll('[data-cu]').forEach(el=>el.onclick=()=>{const id=el.dataset.cu;if(st.hidden.has(id))st.hidden.delete(id);else st.hidden.add(id);this.buildSide();this.draw();});
    side.querySelectorAll('[data-ease]').forEach(el=>el.onclick=()=>{if(AE.Timeline)AE.Timeline.setEase(el.dataset.ease);this.fit();this.draw();});
    const ti=side.querySelector('#cvT'),vi=side.querySelector('#cvV');
    [ti,vi].forEach(i=>{i.onkeydown=e=>e.stopPropagation();i.onchange=()=>{if(!st.sel)return;const s=st.sel;if(ti===i)s.k.t=clamp(parseFloat(ti.value)||0,0,comp().duration);else{const nv=parseFloat(vi.value)||0;s.k.v=Array.isArray(s.k.v)?s.k.v.map(()=>nv):nv;}s.p.k.sort((a,b)=>a.t-b.t);app.commit('曲线编辑');app.render();this.fit();this.draw();};});
  },
  bind(){
    canvas.addEventListener('pointerdown',(e)=>{
      const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
      const hit=this.hitTest(x,y);
      if(hit){st.sel=hit;drag={kind:hit.part,x0:x,y0:y,ot:hit.k.t,ov:scalar(hit.k.v),hit};this.buildSideSel();this.draw();canvas.setPointerCapture(e.pointerId);return;}
      if(e.altKey||e.button===1)drag={kind:'pan',x0:x,y0:y,tMin:st.tMin,tMax:st.tMax,vMin:st.vMin,vMax:st.vMax};
      else drag={kind:'box',x0:x,y0:y,x1:x,y1:y};
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove',(e)=>{
      const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
      const ro=root.querySelector('#cvReadout');if(ro)ro.textContent='t '+tOf(x).toFixed(3)+' · v '+vOf(y).toFixed(2);
      if(!drag)return;
      if(drag.kind==='pan'){
        const w=canvas.clientWidth,h=canvas.clientHeight,dt=(x-drag.x0)/w*(drag.tMax-drag.tMin),dv=(y-drag.y0)/h*(drag.vMax-drag.vMin);
        st.tMin=drag.tMin-dt;st.tMax=drag.tMax-dt;st.vMin=drag.vMin+dv;st.vMax=drag.vMax+dv;this.draw();return;
      }
      if(drag.kind==='key'){
        const h=drag.hit;
        h.k.t=clamp(tOf(x),0,comp().duration);
        const nv=vOf(y);
        h.k.v=Array.isArray(h.k.v)?h.k.v.map(()=>nv):nv;
        h.p.k.sort((a,b)=>a.t-b.t);app.render();this.draw();return;
      }
      if(drag.kind==='handle'){
        const h=drag.hit,ks=h.p.k,idx=ks.indexOf(h.k);
        const seg=(idx<ks.length-1)?(ks[idx+1].t-h.k.t):1;
        const nx=tOf(x)-h.k.t,ny=vOf(y)-scalar(h.k.v);
        if(h.part==='ho'){h.k.ho=[clamp(nx/(seg||1),0,1),ny/Math.max(1,(st.vMax-st.vMin))*0.9];if(st.linked&&ks[idx+1]){}}
        else {const prev=idx>0?ks[idx-1]:null;const pseg=prev?(h.k.t-prev.t):1;
          h.k.hi=[clamp(-nx/(pseg||1),0,1),ny/Math.max(1,(st.vMax-st.vMin))*0.9];}
        app.render();this.draw();return;
      }
      if(drag.kind==='box'){drag.x1=x;drag.y1=y;this.draw();}
    });
    canvas.addEventListener('pointerup',()=>{
      if(drag&&(drag.kind==='key'||drag.kind==='handle'))app.commit('曲线编辑');
      drag=null;
    });
    canvas.addEventListener('wheel',(e)=>{
      e.preventDefault();
      const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
      const tc=tOf(x),vc=vOf(y),f=e.deltaY<0?0.88:1.14;
      st.tMin=tc-(tc-st.tMin)*f;st.tMax=tc+(st.tMax-tc)*f;
      st.vMin=vc-(vc-st.vMin)*f;st.vMax=vc+(st.vMax-vc)*f;
      this.draw();
    },{passive:false});
  },
  hitTest(x,y){
    let best=null,bd=13;
    for(const cu of curves()){
      if(st.hidden.has(cu.id))continue;
      const p=cu.p;if(!p.k)continue;
      p.k.forEach((k,i)=>{
        const px=xOf(k.t),py=yOf(scalar(k.v));
        let d=Math.hypot(px-x,py-y);
        if(d<bd){bd=d;best={cu,p,k,part:'key'};}
        if(k.ho){
          const seg=(i<p.k.length-1)?(p.k[i+1].t-k.t):1;
          const hx=xOf(k.t+k.ho[0]*seg),hy=yOf(scalar(k.v)+k.ho[1]*(st.vMax-st.vMin));
          d=Math.hypot(hx-x,hy-y);if(d<bd){bd=d;best={cu,p,k,part:'ho'};}
        }
        if(k.hi){
          const prev=i>0?p.k[i-1]:null,pseg=prev?(k.t-prev.t):1;
          const hx=xOf(k.t-k.hi[0]*pseg),hy=yOf(scalar(k.v)+k.hi[1]*(st.vMax-st.vMin));
          d=Math.hypot(hx-x,hy-y);if(d<bd){bd=d;best={cu,p,k,part:'hi'};}
        }
      });
    }
    return best;
  },
  buildSideSel(){
    const el=side.querySelector('#cvSel');
    if(!st.sel){if(el)el.innerHTML='未选择<br><span style="color:#646e7d">点击曲线上的菱形</span>';return;}
    const s=st.sel;
    if(el)el.innerHTML=esc(s.cu.L.name)+' · '+pl(s.cu.k)+'<br>t '+s.k.t.toFixed(3)+' · v '+fmt(scalar(s.k.v))+'<br><span style="color:#646e7d">'+(s.k.eout||'bezier')+' / '+(s.k.ease||'ease')+'</span>';
    const ti=side.querySelector('#cvT'),vi=side.querySelector('#cvV');
    if(ti)ti.value=s.k.t.toFixed(3);if(vi)vi.value=fmt(scalar(s.k.v));
  },
  draw(){
    if(!ctx)return;
    const W=canvas.clientWidth,H=canvas.clientHeight;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#0c0e12';ctx.fillRect(0,0,W,H);
    // grid
    ctx.font='9px var(--mono)';ctx.textBaseline='top';
    const tStep=niceStep((st.tMax-st.tMin)/8);
    for(let t=Math.ceil(st.tMin/tStep)*tStep;t<=st.tMax;t+=tStep){
      const x=xOf(t);ctx.strokeStyle='rgba(255,255,255,.055)';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
      ctx.fillStyle='#5a6270';ctx.fillText(t.toFixed(2)+'s',x+3,2);
    }
    const vStep=niceStep((st.vMax-st.vMin)/6);
    for(let v=Math.ceil(st.vMin/vStep)*vStep;v<=st.vMax;v+=vStep){
      const y=yOf(v);ctx.strokeStyle=Math.abs(v)<1e-6?'rgba(255,255,255,.18)':'rgba(255,255,255,.045)';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
      ctx.fillStyle='#5a6270';ctx.fillText(fmt(v),3,y+2);
    }
    const cs=curves(),c=comp(),N=Math.max(60,Math.floor(W/2));
    for(const cu of cs){
      if(st.hidden.has(cu.id))continue;
      // keyframe value curve
      ctx.strokeStyle=cu.color;ctx.lineWidth=1.8;ctx.beginPath();
      for(let i=0;i<=N;i++){
        const t=st.tMin+(st.tMax-st.tMin)*i/N;
        const v=st.mode==='speed'?AE.evalSpeed(cu.p,t):scalar(AE.evalKeys(cu.p,t));
        const x=xOf(t),y=yOf(v);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.stroke();
      // expression final curve
      if(cu.p.e&&st.mode==='value'){
        ctx.strokeStyle='rgba(124,140,255,.9)';ctx.lineWidth=1.3;ctx.setLineDash([5,4]);ctx.beginPath();
        for(let i=0;i<=N;i++){
          const t=st.tMin+(st.tMax-st.tMin)*i/N;
          const v=scalar(AE.evalPropAt(cu.p,t,app.project,c,cu.L,{}));
          const x=xOf(t),y=yOf(v);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.stroke();ctx.setLineDash([]);
      }
      // keyframes + handles
      if(cu.p.k)for(let i=0;i<cu.p.k.length;i++){
        const k=cu.p.k[i],px=xOf(k.t),py=yOf(scalar(k.v));
        if(px<-10||px>W+10)continue;
        if(st.sel&&st.sel.k===k){ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(px-6,py-6,12,12);}
        ctx.fillStyle=k.eout==='hold'?'#ff9f6b':(k.eout==='linear'?'#4fd1c5':'#e8c15a');
        if(k.eout==='linear'){ctx.beginPath();ctx.arc(px,py,4,0,7);ctx.fill();}
        else if(k.eout==='hold')ctx.fillRect(px-4,py-6,8,12);
        else{ctx.beginPath();ctx.moveTo(px,py-5);ctx.lineTo(px+5,py);ctx.lineTo(px,py+5);ctx.lineTo(px-5,py);ctx.closePath();ctx.fill();}
        // handles
        const seg=(i<cu.p.k.length-1)?(cu.p.k[i+1].t-k.t):1;
        if(k.ho){const hx=xOf(k.t+k.ho[0]*seg),hy=yOf(scalar(k.v)+k.ho[1]*(st.vMax-st.vMin));
          ctx.strokeStyle='rgba(232,193,90,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(hx,hy);ctx.stroke();
          ctx.fillStyle='#e8c15a';ctx.beginPath();ctx.arc(hx,hy,3,0,7);ctx.fill();}
        if(k.hi){const prev=i>0?cu.p.k[i-1]:null,pseg=prev?(k.t-prev.t):1;
          const hx=xOf(k.t-k.hi[0]*pseg),hy=yOf(scalar(k.v)+k.hi[1]*(st.vMax-st.vMin));
          ctx.strokeStyle='rgba(232,193,90,.4)';ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(hx,hy);ctx.stroke();
          ctx.fillStyle='#c9a94a';ctx.beginPath();ctx.arc(hx,hy,3,0,7);ctx.fill();}
      }
    }
    // playhead
    const px=xOf(AE.state.t);ctx.strokeStyle='#ff5a5a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,H);ctx.stroke();
    // per-frame dots for the first animated position (sampled motion)
    if(st.mode==='value')for(const cu of cs){
      if(st.hidden.has(cu.id)||cu.k!=='position'||!cu.p.k)continue;
      const fps=c.fps;
      for(let t=st.tMin;t<=st.tMax;t+=1/fps){
        const v=AE.evalKeys(cu.p,t),x=xOf(t),y=yOf(scalar(v));
        ctx.fillStyle='rgba(140,233,154,.5)';ctx.fillRect(x-1,y-1,2,2);
      }
      break;
    }
    // spatial path inset
    if(st.showPath){
      const pos=cs.find(cu=>cu.k==='position'&&cu.p.k);
      if(pos){
        const iw=Math.min(230,W*0.32),ih=Math.min(160,H*0.42),ox=W-iw-12,oy=12;
        ctx.fillStyle='rgba(10,13,18,.9)';ctx.fillRect(ox,oy,iw,ih);ctx.strokeStyle='#2c323d';ctx.strokeRect(ox,oy,iw,ih);
        ctx.fillStyle='#9aa4b2';ctx.fillText('位置路径 · 逐帧点',ox+8,oy+6);
        const ks=pos.p.k,bb={minx:1e9,maxx:-1e9,miny:1e9,maxy:-1e9};
        const pts=[];
        for(let t=ks[0].t;t<=ks[ks.length-1].t;t+=1/c.fps){const v=AE.evalKeys(pos.p,t);pts.push([v[0],v[1]]);bb.minx=Math.min(bb.minx,v[0]);bb.maxx=Math.max(bb.maxx,v[0]);bb.miny=Math.min(bb.miny,v[1]);bb.maxy=Math.max(bb.maxy,v[1]);}
        const sx=iw/Math.max(1,bb.maxx-bb.minx+1),sy=ih/Math.max(1,bb.maxy-bb.miny+1),s=Math.min(sx,sy)*0.78;
        ctx.strokeStyle=pos.color;ctx.lineWidth=1.4;ctx.beginPath();
        pts.forEach((p,i)=>{const X=ox+iw/2+(p[0]-(bb.minx+bb.maxx)/2)*s,Y=oy+ih/2+(p[1]-(bb.miny+bb.maxy)/2)*s;if(i===0)ctx.moveTo(X,Y);else ctx.lineTo(X,Y);});ctx.stroke();
        ctx.fillStyle='#8ce99a';for(const p of pts){const X=ox+iw/2+(p[0]-(bb.minx+bb.maxx)/2)*s,Y=oy+ih/2+(p[1]-(bb.miny+bb.maxy)/2)*s;ctx.fillRect(X-1,Y-1,2,2);}
        for(const k of ks){const X=ox+iw/2+(k.v[0]-(bb.minx+bb.maxx)/2)*s,Y=oy+ih/2+(k.v[1]-(bb.miny+bb.maxy)/2)*s;ctx.fillStyle='#e8c15a';ctx.fillRect(X-3,Y-3,6,6);}
      }
    }
    if(drag&&drag.kind==='box'){
      ctx.strokeStyle='#4fd1c5';ctx.setLineDash([4,3]);ctx.strokeRect(drag.x0,drag.y0,drag.x1-drag.x0,drag.y1-drag.y0);ctx.setLineDash([]);
    }
  },
  refresh(){this.buildSide();this.draw();},
  refreshTime(){this.draw();},
  updateFrame(){this.draw();}
};
function niceStep(x){const p=Math.pow(10,Math.floor(Math.log10(Math.max(1e-6,x))));const n=x/p;return (n<1.5?1:n<3.5?2:n<7.5?5:10)*p;}
function pl(k){return k.replace(/([A-Z])/g,' $1');}
function fmt(v){return (Math.round(v*100)/100).toString();}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
})(window.AE);
