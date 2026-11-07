/* =========================================================================
   ui_canvas.js — canvas overlay: selection box, handles, motion path, pins,
   field ranges, and direct manipulation (move / rotate / scale / anchor).
   ========================================================================= */
(function(AE){
'use strict';
const M=AE.M,V=AE.V,clamp=AE.clamp;
const SVGNS='http://www.w3.org/2000/svg';
let app=null,svg=null,wrap=null,frameCache=null,drag=null;

function S(tag,attrs){
  const e=document.createElementNS(SVGNS,tag);
  for(const k in (attrs||{}))e.setAttribute(k,attrs[k]);
  return e;
}
function clear(){while(svg&&svg.firstChild)svg.removeChild(svg.firstChild);}

function camMatrices(frame){
  const cam=frame.camera||{},W=frame.W,H=frame.H;
  const D=cam.dist||Math.max(1400,H*1.75);
  const proj=M.perspective(2*Math.atan(H/(2*D)),W/H,cam.near||1,cam.far||9000);proj[5]*=-1;
  const view=M.lookAt(cam.eye||[0,0,D],cam.target||[0,0,0],[0,1,0]);
  return {vp:M.mul(proj,view),W,H};
}
function fit(frame){
  const c=app.canvas,wrapEl=wrap;
  const cw=c.width,ch=c.height;
  const s=Math.min(cw/frame.W,ch/frame.H)*(AE.state.zoom||1);
  const dispW=frame.W*s,dispH=frame.H*s;
  const offX=(cw-dispW)/2+(AE.state.panX||0),offY=(ch-dispH)/2+(AE.state.panY||0);
  const dpr=c.width/Math.max(1,wrapEl.clientWidth);
  return {s,dispW,dispH,offX,offY,dpr};
}
function worldToComp(p,frame){
  const {vp,W,H}=camMatrices(frame);
  const m=vp,x=p[0],y=p[1],z=p[2]||0;
  const cx=m[0]*x+m[4]*y+m[8]*z+m[12];
  const cy=m[1]*x+m[5]*y+m[9]*z+m[13];
  const cz=m[2]*x+m[6]*y+m[10]*z+m[14];
  const cw=m[3]*x+m[7]*y+m[11]*z+m[15];
  if(Math.abs(cw)<1e-6)return null;
  const nx=cx/cw,ny=cy/cw;
  return [(nx*0.5+0.5)*W,(0.5-ny*0.5)*H,cz/cw];
}
function worldToCanvas(p,frame){
  const q=worldToComp(p,frame);if(!q)return null;
  const f=fit(frame);
  return [(f.offX+q[0]*f.dispW/frame.W)/f.dpr,(f.offY+q[1]*f.dispH/frame.H)/f.dpr];
}
function compToWorldDelta(dx,dy,frame){
  const f=fit(frame);
  const cpx=dx*f.dpr*frame.W/f.dispW, cpy=dy*f.dpr*frame.H/f.dispH;
  // approximate inverse at z=0 plane
  const D=(frame.camera&&frame.camera.dist)||1600;
  return [cpx,cpy,0];
}
AE.CanvasFX={
  init(a){app=a;svg=document.getElementById('overlay');wrap=document.getElementById('canvasWrap');this.bind();},
  bind(){
    wrap.addEventListener('wheel',(e)=>{
      e.preventDefault();
      AE.state.zoom=clamp(AE.state.zoom*(e.deltaY<0?1.12:1/1.12),0.12,6);
      const zs=document.getElementById('zoomSelect');if(zs)zs.value='fit';
      app.render();this.updateFrame(frameCache);
    },{passive:false});
    wrap.addEventListener('pointerdown',(e)=>{
      if(e.button===1||AE.state.tool==='hand'||(AE.state.tool==='select'&&e.altKey)){
        drag={kind:'pan',x:e.clientX,y:e.clientY,px:AE.state.panX,py:AE.state.panY};
        wrap.setPointerCapture(e.pointerId);return;
      }
      const h=e.target.closest&&e.target.closest('[data-handle]');
      if(h){this.startHandle(h.dataset.handle,h.dataset.layer,e);return;}
      const kp=e.target.closest&&e.target.closest('[data-kf]');
      if(kp){this.startKeyDrag(kp,e);return;}
      // click on empty canvas: select topmost layer under cursor (approx) or clear
      if(e.target===app.canvas||e.target===svg){
        if(!e.shiftKey){AE.state.selection=[];if(AE.UI)AE.UI.refresh();}
      }
    });
    wrap.addEventListener('pointermove',(e)=>{
      if(!drag)return;
      if(drag.kind==='pan'){
        AE.state.panX=drag.px+(e.clientX-drag.x)*(app.canvas.width/wrap.clientWidth);
        AE.state.panY=drag.py+(e.clientY-drag.y)*(app.canvas.width/wrap.clientWidth);
        app.render();this.updateFrame(frameCache);return;
      }
      this.moveHandle(e);
    });
    wrap.addEventListener('pointerup',(e)=>{
      if(drag&&drag.kind!=='pan'&&drag.changed){app.commit(drag.label||'画布编辑');if(AE.UI)AE.UI.refresh();}
      drag=null;
    });
  },
  layerById(id){return app.activeComp().layers.find(l=>l.id===id);},
  startHandle(kind,layerId,e){
    const L=this.layerById(layerId);if(!L||L.locked)return;
    const p=AE.evalProp(L,'position',AE.state.t,app.project,app.activeComp());
    const pos=Array.isArray(p)?p:[0,0,0];
    drag={kind,layerId,start:[e.clientX,e.clientY],origPos:pos.slice(),
      orig:AE.clone(L.props.position),origAnchor:AE.clone(L.props.anchor),
      origScale:AE.clone(L.props.scale),origRot:AE.clone(L.props.rotation),changed:false,
      label:kind==='anchor'?'移动锚点':'画布变换'};
    wrap.setPointerCapture(e.pointerId);
  },
  moveHandle(e){
    const L=this.layerById(drag.layerId);if(!L)return;
    const comp=app.activeComp(),t=AE.state.t;
    const dx=e.clientX-drag.start[0],dy=e.clientY-drag.start[1];
    const d=compToWorldDelta(dx,dy,frameCache||app.frame);
    drag.changed=true;
    const setP=(key,val)=>{
      const p=L.props[key];
      if(AE.isAnimated(p)||p.e){AE.setKey(p,t,val);}
      else p.n=val;
    };
    if(drag.kind==='move'){
      setP('position',[drag.origPos[0]+d[0],drag.origPos[1]+d[1],drag.origPos[2]||0]);
    } else if(drag.kind==='anchor'){
      // move anchor but keep the picture still: compensate position by the same world delta
      const a=AE.evalProp(L,'anchor',t,app.project,comp),av=Array.isArray(a)?a:[0,0,0];
      setP('anchor',[av[0]+d[0],av[1]+d[1],av[2]||0]);
      setP('position',[drag.origPos[0]+d[0],drag.origPos[1]+d[1],drag.origPos[2]||0]);
    } else if(drag.kind==='scale'){
      const s=AE.evalProp(L,'scale',t,app.project,comp),sv=Array.isArray(s)?s:[100,100,100];
      const k=1-dy/220;
      setP('scale',[clamp(sv[0]*k,1,2000),clamp(sv[1]*k,1,2000),sv[2]||100]);
    } else if(drag.kind==='rotate'){
      const c=worldToCanvas([0,0,0],frameCache||app.frame)||[0,0];
      const rect=wrap.getBoundingClientRect();
      const a0=Math.atan2(drag.start[1]-rect.top-c[1],drag.start[0]-rect.left-c[0]);
      const a1=Math.atan2(e.clientY-rect.top-c[1],e.clientX-rect.left-c[0]);
      const r=AE.evalProp(L,'rotation',t,app.project,comp);
      setP('rotation',(typeof r==='number'?r:0)+AE.deg(a1-a0));
    } else if(drag.kind==='axisX'){
      setP('position',[drag.origPos[0]+d[0],drag.origPos[1],drag.origPos[2]||0]);
    } else if(drag.kind==='axisY'){
      setP('position',[drag.origPos[0],drag.origPos[1]+d[1],drag.origPos[2]||0]);
    }
    app.render();this.updateFrame(app.frame);
    if(AE.UI&&AE.UI.refreshTime)AE.UI.refreshTime();
  },
  startKeyDrag(el,e){
    const [lid,key,idx]=[el.dataset.layer,el.dataset.prop,parseInt(el.dataset.idx,10)];
    const L=this.layerById(lid);if(!L||L.locked)return;
    const p=L.props[key];if(!p||!p.k||!p.k[idx])return;
    drag={kind:'key',lid,key,idx,start:[e.clientX,e.clientY],orig:p.k[idx].t,changed:false,label:'移动关键帧'};
    wrap.setPointerCapture(e.pointerId);
  },
  updateFrame(frame){
    frameCache=frame;clear();if(!svg)return;
    if(!frame)return;
    const comp=app.activeComp(),t=AE.state.t;
    const sel=AE.state.selection||[];
    // field ranges
    if(AE.state.grid){
      for(const L of comp.layers){
        if(L.type!=='field'||!L.enabled)continue;
        const d=L.data||{};
        const pos=AE.evalProp(L,'position',t,app.project,comp),pv=Array.isArray(pos)?pos:[0,0,0];
        const r=nz(AE.evalProp(L,'fieldRadius',t,app.project,comp,d.radius||400));
        const c=worldToCanvas([pv[0],pv[1],pv[2]||0],frame);if(!c)continue;
        const c2=worldToCanvas([pv[0]+r,pv[1],pv[2]||0],frame)||[c[0]+r,c[1]];
        const rad=Math.abs(c2[0]-c[0]);
        svg.appendChild(S('circle',{cx:c[0],cy:c[1],r:rad,fill:'none',stroke:d.kind==='vortex'?'rgba(79,209,197,.35)':'rgba(169,139,255,.3)','stroke-width':1,'stroke-dasharray':'5 6'}));
        svg.appendChild(S('circle',{cx:c[0],cy:c[1],r:4,fill:'none',stroke:'#4fd1c5','stroke-width':1.5}));
      }
    }
    for(const id of sel){
      const L=this.layerById(id);if(!L||!L.enabled)continue;
      const wm=AE.layerWorldMatrix(app.project,comp,L,t);
      const center=M.xform(wm,[0,0,0]);
      const cc=worldToCanvas(center,frame);if(!cc)continue;
      const sc=AE.evalProp(L,'scale',t,app.project,comp),sv=Array.isArray(sc)?sc:[100,100,100];
      const w=clamp(210*sv[0]/100*AE.state.zoom,26,900),h=clamp(150*sv[1]/100*AE.state.zoom,20,700);
      const col=L.color||'#4fd1c5';
      const g=S('g',{});
      g.appendChild(S('rect',{x:cc[0]-w/2,y:cc[1]-h/2,width:w,height:h,fill:'none',stroke:col,'stroke-width':1.2,'stroke-dasharray':'4 3','pointer-events':'none'}));
      // handles
      const hs=[[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]];
      for(const [hx,hy] of hs){
        const x=cc[0]+hx*w/2,y=cc[1]+hy*h/2;
        g.appendChild(S('rect',{x:x-4,y:y-4,width:8,height:8,fill:'#0c0e12',stroke:col,'stroke-width':1.4,
          'data-handle':'scale','data-layer':id,class:'hit',style:'cursor:nwse-resize'}));
      }
      // rotation handle
      g.appendChild(S('line',{x1:cc[0],y1:cc[1]-h/2,x2:cc[0],y2:cc[1]-h/2-26,stroke:col,'stroke-width':1,'pointer-events':'none'}));
      g.appendChild(S('circle',{cx:cc[0],cy:cc[1]-h/2-26,r:5,fill:'#0c0e12',stroke:col,'stroke-width':1.5,
        'data-handle':'rotate','data-layer':id,class:'hit',style:'cursor:grab'}));
      // anchor
      const av=AE.evalProp(L,'anchor',t,app.project,comp),a=Array.isArray(av)?av:[0,0,0];
      const ac=worldToCanvas(M.xform(wm,[a[0],a[1],a[2]||0]),frame);
      if(ac){
        g.appendChild(S('circle',{cx:ac[0],cy:ac[1],r:5,fill:'none',stroke:'#f7b955','stroke-width':1.4,
          'data-handle':'anchor','data-layer':id,class:'hit',style:'cursor:move'}));
        g.appendChild(S('line',{x1:ac[0]-7,y1:ac[1],x2:ac[0]+7,y2:ac[1],stroke:'#f7b955','stroke-width':1,'pointer-events':'none'}));
        g.appendChild(S('line',{x1:ac[0],y1:ac[1]-7,x2:ac[0],y2:ac[1]+7,stroke:'#f7b955','stroke-width':1,'pointer-events':'none'}));
      }
      // 3D axes
      if(L.threeD){
        const ax=worldToCanvas(M.xform(wm,[110,0,0]),frame),ay=worldToCanvas(M.xform(wm,[0,110,0]),frame),az=worldToCanvas(M.xform(wm,[0,0,110]),frame);
        if(ax){g.appendChild(S('line',{x1:cc[0],y1:cc[1],x2:ax[0],y2:ax[1],stroke:'#ff6b6b','stroke-width':2,'pointer-events':'none'}));
          g.appendChild(S('circle',{cx:ax[0],cy:ax[1],r:4,fill:'#ff6b6b','data-handle':'axisX','data-layer':id,class:'hit',style:'cursor:ew-resize'}));}
        if(ay){g.appendChild(S('line',{x1:cc[0],y1:cc[1],x2:ay[0],y2:ay[1],stroke:'#8ce99a','stroke-width':2,'pointer-events':'none'}));
          g.appendChild(S('circle',{cx:ay[0],cy:ay[1],r:4,fill:'#8ce99a','data-handle':'axisY','data-layer':id,class:'hit',style:'cursor:ns-resize'}));}
        if(az){g.appendChild(S('line',{x1:cc[0],y1:cc[1],x2:az[0],y2:az[1],stroke:'#7c8cff','stroke-width':2,'pointer-events':'none'}));}
      }
      // center move handle
      g.appendChild(S('rect',{x:cc[0]-6,y:cc[1]-6,width:12,height:12,fill:'rgba(79,209,197,.15)',stroke:col,
        'data-handle':'move','data-layer':id,class:'hit',style:'cursor:move'}));
      svg.appendChild(g);
      // motion path for animated position
      if(AE.state.motionPath&&AE.isAnimated(L.props.position))this.drawMotionPath(L,frame,col);
      // pins
      const d=L.data||{};
      for(const pin of (d.pins||[])){
        const pc=worldToCanvas(M.xform(wm,[pin.x,pin.y,0]),frame);if(!pc)continue;
        svg.appendChild(S('circle',{cx:pc[0],cy:pc[1],r:pin.radius?clamp(pin.radius*AE.state.zoom*0.2,8,120):9,fill:'none',stroke:'rgba(247,185,85,.45)','stroke-width':1,'stroke-dasharray':'3 4','pointer-events':'none'}));
        svg.appendChild(S('path',{d:'M'+(pc[0]-5)+' '+pc[1]+'L'+(pc[0]+5)+' '+pc[1]+'M'+pc[0]+' '+(pc[1]-5)+'L'+pc[0]+' '+(pc[1]+5),stroke:'#f7b955','stroke-width':1.5,'pointer-events':'none'}));
      }
    }
    // safe area
    const tl=worldToCanvas([-frame.W/2+80,-frame.H/2+50,0],frame),br=worldToCanvas([frame.W/2-80,frame.H/2-50,0],frame);
    if(tl&&br)svg.appendChild(S('rect',{x:tl[0],y:tl[1],width:br[0]-tl[0],height:br[1]-tl[1],fill:'none',stroke:'rgba(255,255,255,.10)','stroke-width':1,'pointer-events':'none'}));
  },
  drawMotionPath(L,frame,col){
    const comp=app.activeComp(),ks=L.props.position.k||[];
    if(ks.length<2)return;
    const pts=[];
    const t0=ks[0].t,t1=ks[ks.length-1].t;
    for(let i=0;i<=80;i++){
      const tt=t0+(t1-t0)*i/80;
      const v=AE.evalKeys(L.props.position,tt);
      const pv=Array.isArray(v)?v:[0,0,0];
      const w=AE.layerWorldMatrix(app.project,comp,L,tt);
      const c=worldToCanvas(M.xform(w,[pv[0],pv[1],pv[2]||0]),frame);
      if(c)pts.push(c);
    }
    if(pts.length>1){
      const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
      svg.appendChild(S('path',{d,fill:'none',stroke:'rgba(79,209,197,.5)','stroke-width':1.4,'pointer-events':'none'}));
    }
    // per-frame dots in the visible time window
    for(let tt=t0;tt<=t1;tt+=1/comp.fps){
      const v=AE.evalKeys(L.props.position,tt),pv=Array.isArray(v)?v:[0,0,0];
      const w=AE.layerWorldMatrix(app.project,comp,L,tt);
      const c=worldToCanvas(M.xform(w,[pv[0],pv[1],pv[2]||0]),frame);
      if(c)svg.appendChild(S('circle',{cx:c[0],cy:c[1],r:1.3,fill:'rgba(126,230,255,.55)','pointer-events':'none'}));
    }
    // keyframe points + spatial handles
    ks.forEach((k,i)=>{
      const v=Array.isArray(k.v)?k.v:[0,0,0];
      const w=AE.layerWorldMatrix(app.project,comp,L,k.t);
      const c=worldToCanvas(M.xform(w,[v[0],v[1],v[2]||0]),frame);if(!c)return;
      svg.appendChild(S('rect',{x:c[0]-4,y:c[1]-4,width:8,height:8,fill:'#e8c15a',transform:'rotate(45 '+c[0]+' '+c[1]+')',
        'data-kf':'1','data-layer':L.id,'data-prop':'position','data-idx':i,class:'hit',style:'cursor:pointer'}));
      if(k.sh&&k.sh.out){
        const o=k.sh.out,h=worldToCanvas(M.xform(w,[v[0]+o[0],v[1]+o[1],v[2]||0]),frame);
        if(h){svg.appendChild(S('line',{x1:c[0],y1:c[1],x2:h[0],y2:h[1],stroke:'rgba(232,193,90,.7)','stroke-width':1,'pointer-events':'none'}));
          svg.appendChild(S('circle',{cx:h[0],cy:h[1],r:3,fill:'#e8c15a','pointer-events':'none'}));}
      }
    });
  },
  refresh(){this.updateFrame(frameCache);}
};
function nz(v,d){return (typeof v==='number'&&isFinite(v))?v:d;}
})(window.AE);
