/* =========================================================================
   ui_timeline.js — full timeline workspace
   layer list / property rows / ruler / playhead / keyframes / work area /
   markers / scrubbing / zoom & pan / snap / keyframe editing.
   ========================================================================= */
(function(AE){
'use strict';
const clamp=AE.clamp;
let app=null,root=null,tlScroll=null,tlList=null,tracks=null,playhead=null,rulerCanvas=null;
let drag=null,contentW=1000,rowsHeight=0;
const LBL=300, ROW_H=26, PROP_H=20, RULER_H=24;

const PROP_LABEL={
  anchor:'锚点',position:'位置',scale:'缩放',rotation:'旋转',opacity:'不透明度',
  xRot:'X 旋转',yRot:'Y 旋转',zRot:'Z 旋转',zPos:'Z 位置',
  camDist:'镜头距离',camYaw:'水平环绕',camPitch:'垂直俯仰',camFocus:'对焦距离',camAperture:'光圈',
  camX:'相机 X',camY:'相机 Y',camZ:'相机 Z',
  trimStart:'修剪起点',trimEnd:'修剪终点',repeats:'重复数量',strokeW:'描边宽度',
  fontSize:'字号',animOffset:'范围偏移',depth:'挤出深度',bevel:'倒角',bend:'弯曲',twist:'扭转',
  fieldRadius:'场半径',fieldStrength:'场强度',lightInt:'灯光强度',
  echo:'回声',bloom:'发光',mbBoost:'运动模糊',inPoint:'入点',outPoint:'出点'
};
function plabel(k){return PROP_LABEL[k]||k.replace(/([A-Z])/g,' $1');}
function pval(v){
  if(typeof v==='number')return (Math.round(v*100)/100).toString();
  if(Array.isArray(v))return v.map(x=>typeof x==='number'?(Math.round(x*10)/10):x).join(', ');
  return String(v);
}
function comp(){return app.activeComp();}
function zoom(){return AE.state.tlZoom||70;}
function xOf(t){return t*zoom();}
function timeOf(x){return clamp((x)/zoom(),0,comp().duration);}
function isSel(lid,prop,k){
  return (AE.state.kfSel||[]).some(s=>s.lid===lid&&s.prop===prop&&Math.abs(s.t-k.t)<0.0006);
}
function selKeys(){
  const out=[];
  for(const s of (AE.state.kfSel||[])){
    const L=comp().layers.find(l=>l.id===s.lid);if(!L)continue;
    const p=L.props[s.prop];if(!p||!p.k)continue;
    const idx=AE.keyAt(p,s.t);if(idx<0)continue;
    out.push({L,p,idx,k:p.k[idx],lid:s.lid,prop:s.prop});
  }
  return out;
}

function animatedProps(L){
  const out=[];
  for(const k in (L.props||{})){
    const p=L.props[k];
    if(p&&((p.k&&p.k.length)||p.e))out.push(k);
  }
  return out;
}
function buildRows(){
  const c=comp(),rows=[],onlyAnim=AE.state.showAnimatedOnly;
  // layers are stored top-first; show in that order
  c.layers.forEach((L,i)=>{
    const anim=animatedProps(L);
    if(onlyAnim&&!anim.length&&L.type!=='camera')return;
    rows.push({type:'layer',L,i,h:ROW_H});
    if(L._open){
      for(const k of anim)rows.push({type:'prop',L,i,key:k,h:PROP_H});
    }
  });
  return rows;
}

AE.Timeline={
  init(a){app=a;},
  mount(container){
    root=container;
    root.innerHTML=
      '<div class="tl-toolbar" id="tlToolbar"></div>'+
      '<div class="tl-main">'+
        '<div class="tl-layers" style="width:'+LBL+'px;flex:0 0 '+LBL+'px">'+
          '<div class="tl-colhead">'+
            '<span class="ch" style="width:56px;padding-left:6px">#</span>'+
            '<span class="ch" style="flex:1">图层名称</span>'+
            '<span class="ch" style="width:44px">模式</span>'+
            '<span class="ch" style="width:58px">入 / 出</span>'+
          '</div>'+
          '<div class="tl-list" id="tlList"></div>'+
        '</div>'+
        '<div class="tl-graph-wrap" id="tlGraphWrap">'+
          '<div id="tlScroll">'+
            '<div id="tlInner">'+
              '<canvas id="rulerCanvas"></canvas>'+
              '<div id="tlTracks"></div>'+
              '<div id="playhead"><div id="phLabel"></div></div>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div class="tl-sel-box" id="tlSelBox" style="display:none"></div>';
    tlScroll=root.querySelector('#tlScroll');tlList=root.querySelector('#tlList');
    tracks=root.querySelector('#tlTracks');playhead=root.querySelector('#playhead');
    rulerCanvas=root.querySelector('#rulerCanvas');
    this.buildToolbar();
    this.bind();
    this.build();
  },
  buildToolbar(){
    const tb=root.querySelector('#tlToolbar');
    tb.innerHTML=
      '<span class="tl-title">时间轴</span>'+
      '<span style="color:#4fd1c5;font-family:var(--mono)" id="tlCompName"></span>'+
      '<input type="text" id="tlTimeInput" title="输入时间 (秒)" value="0.000" style="width:78px;background:#0c0e12;border:1px solid #2c323d;border-radius:4px;padding:2px 6px;font-family:var(--mono);font-size:10px;color:#4fd1c5;outline:none">'+
      '<div class="tt" id="tlPrev" title="上一关键帧 (K)">◀|</div>'+
      '<div class="tt" id="tlNext" title="下一关键帧 (J)">|▶</div>'+
      '<div class="tt" id="tlAddMarker" title="添加标记 (M)">◆ 标记</div>'+
      '<div class="tt'+(AE.state.showAnimatedOnly?' on':'')+'" id="tlAnimOnly" title="只显示动画属性">仅动画属性</div>'+
      '<div class="tt'+(AE.state.snap?' on':'')+'" id="tlSnap" title="吸附关键帧 / 播放头 / 标记 / 入出点">吸附</div>'+
      '<div class="tt" id="tlFit" title="缩放到全段">适配</div>'+
      '<span style="flex:1"></span>'+
      '<span style="color:#646e7d">缩放</span>'+
      '<input type="range" id="tlZoomRange" min="16" max="260" step="1" value="'+zoom()+'" style="width:110px;accent-color:#4fd1c5">'+
      '<span id="tlZoomLabel" style="font-family:var(--mono);color:#9aa4b2;width:52px">'+zoom()+' px/s</span>';
    const ti=tb.querySelector('#tlTimeInput');
    ti.onchange=()=>{const v=parseFloat(ti.value);if(isFinite(v))app.setTime(v);else this.refreshTime();};
    ti.onkeydown=(e)=>e.stopPropagation();
    tb.querySelector('#tlPrev').onclick=()=>this.jumpKey(-1);
    tb.querySelector('#tlNext').onclick=()=>this.jumpKey(1);
    tb.querySelector('#tlAddMarker').onclick=()=>{comp().markers.push({t:AE.state.t,label:'标记 '+(comp().markers.length+1),color:'#f7b955'});app.commit('添加标记');this.build();};
    tb.querySelector('#tlAnimOnly').onclick=(e)=>{AE.state.showAnimatedOnly=!AE.state.showAnimatedOnly;e.target.classList.toggle('on',AE.state.showAnimatedOnly);this.build();};
    tb.querySelector('#tlSnap').onclick=(e)=>{AE.state.snap=!AE.state.snap;e.target.classList.toggle('on',AE.state.snap);const sc=document.getElementById('snapChk');if(sc)sc.checked=AE.state.snap;};
    tb.querySelector('#tlFit').onclick=()=>this.fitZoom();
    const zr=tb.querySelector('#tlZoomRange');
    zr.oninput=()=>{this.setZoom(parseInt(zr.value,10),null);};
    root.querySelector('#tlCompName').textContent=comp().name;
    root.querySelector('#tlZoomLabel').textContent=zoom()+' px/s';
  },
  fitZoom(){
    const w=root.querySelector('#tlGraphWrap').clientWidth-20;
    this.setZoom(Math.max(16,Math.floor(w/Math.max(1,comp().duration))),null);
  },
  setZoom(z,cursorClientX){
    const old=zoom(),nw=clamp(z,16,260);
    let tAnchor=null;
    if(cursorClientX!==null&&cursorClientX!==undefined){
      const rect=root.querySelector('#tlGraphWrap').getBoundingClientRect();
      const contentX=(cursorClientX-rect.left)+tlScroll.scrollLeft;
      tAnchor=contentX/old;
    }
    AE.state.tlZoom=nw;
    const zr=root.querySelector('#tlZoomRange');if(zr)zr.value=nw;
    const zl=root.querySelector('#tlZoomLabel');if(zl)zl.textContent=nw+' px/s';
    this.build();
    if(tAnchor!==null){
      const rect=root.querySelector('#tlGraphWrap').getBoundingClientRect();
      tlScroll.scrollLeft=tAnchor*nw-(cursorClientX-rect.left);
    }
    this.refreshTime();
  },
  build(){
    if(!root||!root.isConnected)return;
    const c=comp(),rows=buildRows();
    contentW=Math.max(600,c.duration*zoom()+220);
    rowsHeight=rows.reduce((s,r)=>s+r.h,0)+40;
    const inner=root.querySelector('#tlInner');
    inner.style.width=contentW+'px';inner.style.position='relative';inner.style.minHeight=(rowsHeight+RULER_H)+'px';
    rulerCanvas.width=contentW;rulerCanvas.height=RULER_H;
    rulerCanvas.style.cssText='position:sticky;top:0;z-index:6;display:block;background:#1b1f27;border-bottom:1px solid #2c323d;cursor:pointer';
    this.drawRuler();
    // ---- left column rows ----
    tlList.innerHTML='';
    // ---- right tracks ----
    tracks.innerHTML='';tracks.style.width=contentW+'px';tracks.style.position='relative';tracks.style.minHeight=rowsHeight+'px';
    let y=0;
    const gridLines=[];
    rows.forEach((r,ri)=>{
      const L=r.L;
      const lrow=document.createElement('div');
      lrow.className='layer-row'+(r.type==='prop'?' prop':'')+(AE.state.selection.indexOf(L.id)>=0?' sel':'')+(L.locked?' locked':'');
      lrow.style.height=r.h+'px';
      if(r.type==='layer'){
        lrow.innerHTML=
          '<div class="cell" style="width:16px"><span class="c-eye'+(L.enabled?'':' off')+'" data-act="eye" title="显示">'+(L.enabled?'◉':'○')+'</span></div>'+
          '<div class="cell" style="width:16px"><span class="c-lock'+(L.locked?' on':'')+'" data-act="lock" title="锁定">'+(L.locked?'▣':'▢')+'</span></div>'+
          '<div class="cell" style="width:16px"><span class="c-solo'+(L.solo?' on':'')+'" data-act="solo" title="独奏">S</span></div>'+
          '<div class="cell" style="width:12px"><span class="c-collapse" data-act="open">'+(L._open?'▾':'▸')+'</span></div>'+
          '<div class="lr-name"><span class="lr-color" style="background:'+(L.color||'#4fd1c5')+'"></span>'+
            '<span class="num">'+(ri+1)+'</span><span class="ltype" style="background:'+(L.color||'#4fd1c5')+'">'+typeIcon(L.type)+'</span>'+
            '<span style="overflow:hidden;text-overflow:ellipsis">'+esc(L.name)+'</span></div>'+
          '<div class="lr-blend" title="混合模式">'+blendShort(L.blend)+'</div>'+
          '<div class="c-inout">'+L.inPoint.toFixed(1)+' / '+L.outPoint.toFixed(1)+'</div>';
        lrow.querySelectorAll('[data-act]').forEach(el=>{
          el.onclick=(e)=>{e.stopPropagation();this.action(el.dataset.act,L);};
        });
        lrow.onclick=(e)=>this.selectLayer(L,e);
        lrow.ondblclick=()=>this.rename(L);
        lrow.oncontextmenu=(e)=>{e.preventDefault();AE.UI.layerContextMenu(e,L);};
      } else {
        lrow.className='prop-row';lrow.style.height=r.h+'px';
        lrow.innerHTML='<span class="plabel" style="width:'+(LBL-40)+'px">↳ '+plabel(r.key)+'</span>';
        lrow.onclick=(e)=>{e.stopPropagation();if(AE.state.selection.indexOf(L.id)<0)AE.state.selection=[L.id];if(AE.UI&&AE.UI.refresh)AE.UI.refresh();};
      }
      tlList.appendChild(lrow);
      // graph track
      const tr=document.createElement('div');
      tr.className=r.type==='layer'?'trk-row'+(ri%2?' alt':''):'trk-prop';
      tr.style.height=r.h+'px';tr.style.position='relative';
      tr.dataset.y=y;tr.dataset.h=r.h;
      if(r.type==='layer'){
        const bar=document.createElement('div');bar.className='trk-bar';
        bar.style.left=xOf(L.inPoint)+'px';
        bar.style.width=Math.max(2,xOf(L.outPoint)-xOf(L.inPoint))+'px';
        const opacityBar=document.createElement('div');
        opacityBar.style.cssText='position:absolute;left:'+xOf(L.inPoint)+'px;top:12px;height:2px;width:'+Math.max(2,xOf(L.outPoint)-xOf(L.inPoint))+'px;background:rgba(154,164,178,.25)';
        tr.appendChild(bar);tr.appendChild(opacityBar);
        // layer-level keyframes: show keyframes of the first animated prop (usually position/rotation)
        const ap=animatedProps(L);
        if(ap.length){
          const key=ap[0],p=L.props[key];
          if(p.k)for(let ki=0;ki<p.k.length;ki++)tr.appendChild(this.keyEl(L,key,p.k[ki],ki,8));
        }
      } else {
        const p=L.props[r.key];
        if(p&&p.k)for(let ki=0;ki<p.k.length;ki++)tr.appendChild(this.keyEl(L,r.key,p.k[ki],ki,6));
        if(p&&p.e){const ex=document.createElement('div');ex.textContent='fx';ex.style.cssText='position:absolute;left:2px;top:2px;font:9px var(--mono);color:#7c8cff';tr.appendChild(ex);}
      }
      tracks.appendChild(tr);
      y+=r.h;
    });
    // work area + markers + playhead into inner (above tracks visually)
    let wa=inner.querySelector('.work-area');
    if(!wa){wa=document.createElement('div');wa.className='work-area';inner.appendChild(wa);}
    wa.style.left=xOf(c.workIn)+'px';wa.style.width=Math.max(2,xOf(c.workOut)-xOf(c.workIn))+'px';
    wa.style.top=RULER_H+'px';wa.style.height=rowsHeight+'px';
    // markers
    inner.querySelectorAll('.marker').forEach(m=>m.remove());
    (c.markers||[]).forEach((mk,i)=>{
      const m=document.createElement('div');m.className='marker';m.style.left=xOf(mk.t)+'px';m.style.top='0px';
      m.innerHTML='<div class="flag" style="border-top-color:'+(mk.color||'#f7b955')+'"></div><div class="mlabel">'+esc(mk.label||('标记 '+(i+1)))+'</div>';
      m.onclick=()=>app.setTime(mk.t);
      m.oncontextmenu=(e)=>{e.preventDefault();c.markers.splice(i,1);app.commit('删除标记');this.build();};
      inner.appendChild(m);
    });
    // playhead
    playhead.style.height=(rowsHeight+RULER_H)+'px';
    // vertical grid
    let grid=inner.querySelector('#tlGrid');
    if(!grid){grid=document.createElement('div');grid.id='tlGrid';inner.appendChild(grid);}
    grid.innerHTML='';
    grid.style.cssText='position:absolute;left:0;top:'+RULER_H+'px;width:'+contentW+'px;height:'+rowsHeight+'px;pointer-events:none;z-index:1';
    const step=zoom()>=110?0.5:(zoom()>=55?1:2);
    for(let t=0;t<=c.duration+step;t+=step){
      const ln=document.createElement('div');ln.style.cssText='position:absolute;left:'+xOf(t)+'px;top:0;bottom:0;width:1px;background:'+(Math.abs(t-Math.round(t))<0.001?'rgba(255,255,255,.055)':'rgba(255,255,255,.022)');
      grid.appendChild(ln);
    }
    // sync vertical scroll
    if(!tlList._syncBound){
      tlList._syncBound=true;
      tlScroll.addEventListener('scroll',()=>{tlList.scrollTop=tlScroll.scrollTop;});
      tlList.addEventListener('scroll',()=>{tlScroll.scrollTop=tlList.scrollTop;});
    }
    this.refreshTime();
  },
  keyEl(L,prop,k,idx,top){
    const d=document.createElement('div');
    const interp=k.eout==='hold'?'hold':(k.eout==='linear'?'linear':'bezier');
    d.className='keyf '+interp+(isSel(L.id,prop,k)?' sel':'');
    d.style.left=xOf(k.t)+'px';d.style.top=top+'px';
    d.dataset.kf='1';d.dataset.layer=L.id;d.dataset.prop=prop;d.dataset.idx=idx;
    d.title=plabel(prop)+' @ '+k.t.toFixed(3)+'s = '+pval(k.v)+'\n'+interp+' / '+(k.ease||'ease');
    d.onpointerdown=(e)=>this.keyDown(e,L,prop,k,idx);
    d.oncontextmenu=(e)=>{e.preventDefault();if(!isSel(L.id,prop,k))AE.state.kfSel=[{lid:L.id,prop,t:k.t}];AE.UI.keyframeContextMenu(e,selKeys());};
    return d;
  },
  drawRuler(){
    const c=rulerCanvas,ctx=c.getContext('2d'),W=contentW,cmp=comp();
    ctx.clearRect(0,0,W,RULER_H);
    ctx.fillStyle='#1b1f27';ctx.fillRect(0,0,W,RULER_H);
    const step=zoom()>=110?0.5:(zoom()>=55?1:2);
    ctx.font='9px var(--mono)';ctx.textBaseline='middle';
    for(let t=0;t<=cmp.duration+step;t+=step){
      const x=xOf(t),major=Math.abs(t-Math.round(t))<0.001;
      ctx.strokeStyle=major?'rgba(255,255,255,.28)':'rgba(255,255,255,.10)';
      ctx.beginPath();ctx.moveTo(x+0.5,major?8:15);ctx.lineTo(x+0.5,RULER_H);ctx.stroke();
      if(major){ctx.fillStyle='#9aa4b2';ctx.fillText(fmtTC(t,cmp.fps),x+3,7);}
    }
    ctx.strokeStyle='#2c323d';ctx.beginPath();ctx.moveTo(0,RULER_H-0.5);ctx.lineTo(W,RULER_H-0.5);ctx.stroke();
  },
  fmt(){return fmtTC(0,30);},
  bind(){
    if(!tlScroll)return;
    rulerCanvas.addEventListener('pointerdown',(e)=>{
      const rect=rulerCanvas.getBoundingClientRect();
      const x=e.clientX-rect.left;
      drag={kind:'scrub'};
      rulerCanvas.setPointerCapture(e.pointerId);
      app.setTime(this.snapTime(timeOf(x)));
    });
    rulerCanvas.addEventListener('pointermove',(e)=>{
      if(!drag||drag.kind!=='scrub')return;
      const rect=rulerCanvas.getBoundingClientRect();
      app.setTime(this.snapTime(timeOf(e.clientX-rect.left)));
    });
    rulerCanvas.addEventListener('pointerup',()=>{drag=null;});
    // zoom with ctrl+wheel, horizontal pan with wheel
    root.querySelector('#tlGraphWrap').addEventListener('wheel',(e)=>{
      if(e.ctrlKey||e.metaKey){
        e.preventDefault();
        this.setZoom(zoom()*(e.deltaY<0?1.15:1/1.15),e.clientX);
      } else if(e.shiftKey){
        e.preventDefault();tlScroll.scrollLeft+=e.deltaY;
      }
    },{passive:false});
    // box select on empty track area
    tracks.addEventListener('pointerdown',(e)=>{
      if(e.target!==tracks&&!e.target.classList.contains('trk-row')&&!e.target.classList.contains('trk-prop')&&!e.target.classList.contains('trk-bar'))return;
      if(e.target.closest('[data-kf]'))return;
      const rect=tracks.getBoundingClientRect();
      drag={kind:'box',x0:e.clientX-rect.left,y0:e.clientY-rect.top,x1:e.clientX-rect.left,y1:e.clientY-rect.top};
      const box=root.querySelector('#tlSelBox');box.style.display='block';
      box.style.left=(e.clientX-rect.left)+'px';box.style.top=(e.clientY-rect.top)+'px';box.style.width='0px';box.style.height='0px';
      if(!e.shiftKey)AE.state.kfSel=[];
      tracks.setPointerCapture(e.pointerId);
    });
    tracks.addEventListener('pointermove',(e)=>{
      if(!drag||drag.kind!=='box')return;
      const rect=tracks.getBoundingClientRect();
      drag.x1=e.clientX-rect.left;drag.y1=e.clientY-rect.top;
      const box=root.querySelector('#tlSelBox');
      box.style.left=Math.min(drag.x0,drag.x1)+'px';box.style.top=Math.min(drag.y0,drag.y1)+'px';
      box.style.width=Math.abs(drag.x1-drag.x0)+'px';box.style.height=Math.abs(drag.y1-drag.y0)+'px';
    });
    tracks.addEventListener('pointerup',(e)=>{
      if(!drag||drag.kind!=='box')return;
      const box=root.querySelector('#tlSelBox');box.style.display='none';
      const xa=Math.min(drag.x0,drag.x1),xb=Math.max(drag.x0,drag.x1);
      const ya=Math.min(drag.y0,drag.y1),yb=Math.max(drag.y0,drag.y1);
      if(xb-xa>3){
        const rows=buildRows();let yy=0;
        for(const r of rows){
          if(yy+r.h>=ya&&yy<=yb){
            const keys=(r.type==='layer')?animatedProps(r.L).slice(0,1):[r.key];
            for(const key of keys){
              const p=r.L.props[key];if(!p||!p.k)continue;
              for(const k of p.k)if(xOf(k.t)>=xa&&xOf(k.t)<=xb&&!isSel(r.L.id,key,k))AE.state.kfSel.push({lid:r.L.id,prop:key,t:k.t});
            }
          }
          yy+=r.h;
        }
      }
      drag=null;this.build();
    });
  },
  keyDown(e,L,prop,k,idx){
    e.stopPropagation();e.preventDefault();
    if(e.shiftKey){
      const i=(AE.state.kfSel||[]).findIndex(s=>s.lid===L.id&&s.prop===prop&&Math.abs(s.t-k.t)<0.0006);
      if(i>=0)AE.state.kfSel.splice(i,1);else AE.state.kfSel.push({lid:L.id,prop,t:k.t});
      this.build();return;
    }
    if(!isSel(L.id,prop,k))AE.state.kfSel=[{lid:L.id,prop,t:k.t}];
    const startX=e.clientX,orig=k.t;
    const multi=selKeys();
    for(const s of multi)s._o=s.k.t;
    drag={kind:'keymove',startX,orig,multi,changed:false};
    const move=(ev)=>{
      const dt=(ev.clientX-startX)/zoom();
      const nt=this.snapTime(clamp(orig+dt,0,comp().duration),k);
      const delta=nt-orig;
      for(const s of multi)s.k.t=clamp(s._o+delta,0,comp().duration);
      drag.changed=true;
      AE.state.kfSel=multi.map(s=>({lid:s.lid,prop:s.prop,t:s.k.t}));
      app.render();this.build();
    };
    const up=()=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);
      if(drag&&drag.changed){for(const s of multi)delete s._o;s.p&&s.p.k&&s.p.k.sort((a,b)=>a.t-b.t);app.commit('移动关键帧');}
      drag=null;
    };
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
  },
  snapTime(t,exclude){
    if(!AE.state.snap)return Math.round(t*comp().fps)/comp().fps;
    const c=comp(),fps=c.fps,frameT=Math.round(t*fps)/fps;
    const cands=[{t:frameT,d:0.045,label:'帧'},{t:AE.state.t,d:0.05,label:'播放头'},
      {t:c.workIn,d:0.05,label:'工作区入点'},{t:c.workOut,d:0.05,label:'工作区出点'}];
    for(const L of c.layers){
      for(const key in (L.props||{})){
        const p=L.props[key];if(!p||!p.k)continue;
        for(const k of p.k)if(k!==exclude)cands.push({t:k.t,d:0.035/zoom()*70,label:'关键帧'});
      }
    }
    for(const m of (c.markers||[]))cands.push({t:m.t,d:0.04,label:'标记'});
    let best=null,bd=1e9;
    for(const c2 of cands){const d=Math.abs(c2.t-t);if(d<c2.d&&d<bd){bd=d;best=c2;}}
    if(best){const st=document.getElementById('snapTo');if(st)st.textContent='吸附 → '+best.label+' '+best.t.toFixed(3)+'s';return best.t;}
    return frameT;
  },
  jumpKey(dir){
    const c=comp(),t=AE.state.t,times=[];
    for(const L of c.layers)for(const key in (L.props||{})){const p=L.props[key];if(p&&p.k)for(const k of p.k)if(Math.abs(k.t-t)>1e-4)times.push(k.t);}
    if(!times.length)return;
    times.sort((a,b)=>a-b);
    let target=null;
    if(dir>0)target=times.find(x=>x>t);else{for(let i=times.length-1;i>=0;i--)if(times[i]<t){target=times[i];break;}}
    if(target!==null)app.setTime(target);
  },
  selectLayer(L,e){
    const s=AE.state.selection;
    if(e.shiftKey&&s.length){
      const last=cLayers().findIndex(x=>x.id===s[s.length-1]);
      const cur=cLayers().findIndex(x=>x.id===L.id);
      const [a,b]=[Math.min(last,cur),Math.max(last,cur)];
      AE.state.selection=cLayers().slice(a,b+1).map(x=>x.id);
    } else if(e.ctrlKey||e.metaKey){
      const i=s.indexOf(L.id);if(i>=0)s.splice(i,1);else s.push(L.id);
    } else AE.state.selection=[L.id];
    AE.state.kfSel=[];
    if(AE.UI)AE.UI.refresh();
  },
  action(act,L){
    if(act==='eye')L.enabled=!L.enabled;
    else if(act==='lock')L.locked=!L.locked;
    else if(act==='solo'){L.solo=!L.solo;comp().layers.forEach(x=>{if(x.id!==L.id&&x.solo)x.solo=false;});}
    else if(act==='open'){L._open=!L._open;app.render();this.build();return;}
    app.commit('图层属性');
    if(AE.UI)AE.UI.refresh();app.render();
  },
  rename(L){
    const inp=prompt('重命名图层',L.name);
    if(inp&&inp.trim()){L.name=inp.trim();app.commit('重命名图层');if(AE.UI)AE.UI.refresh();}
  },
  deleteKeys(){
    const s=selKeys();if(!s.length)return;
    for(const it of s){const idx=it.p.k.indexOf(it.k);if(idx>=0)it.p.k.splice(idx,1);if(!it.p.k.length)it.p.k=null;}
    AE.state.kfSel=[];app.commit('删除关键帧');if(AE.UI)AE.UI.refresh();app.render();
  },
  copyKeys(){
    AE.state.kfClipboard=selKeys().map(it=>({prop:it.prop,k:AE.clone(it.k)}));
    AE.toast&&AE.toast('已复制 '+AE.state.kfClipboard.length+' 个关键帧');
  },
  pasteKeys(){
    const cb=AE.state.kfClipboard;if(!cb||!cb.length){AE.toast&&AE.toast('剪贴板为空','warn');return;}
    const L=comp().layers.find(x=>x.id===AE.state.selection[0]);
    if(!L){AE.toast&&AE.toast('先选择一个目标图层','warn');return;}
    const base=AE.state.t,t0=cb[0].k.t;
    for(const it of cb){
      const p=L.props[it.prop];if(!p)continue;
      if(!p.k)p.k=[];
      AE.setKey(p,base+(it.k.t-t0),AE.clone(it.k.v),{eout:it.k.eout,ease:it.k.ease});
    }
    app.commit('粘贴关键帧');if(AE.UI)AE.UI.refresh();app.render();
  },
  setEase(preset){
    const s=selKeys();if(!s.length)return;
    for(const it of s){it.k.ease=preset;it.k.eout=preset==='linear'?'linear':'bezier';}
    app.commit('设置缓动');if(AE.UI)AE.UI.refresh();app.render();
  },
  setInterp(type){
    const s=selKeys();if(!s.length)return;
    for(const it of s)it.k.eout=type;
    app.commit('设置插值');if(AE.UI)AE.UI.refresh();app.render();
  },
  selectAllKeys(){
    AE.state.kfSel=[];
    for(const L of comp().layers)for(const key in (L.props||{})){const p=L.props[key];if(p&&p.k)for(const k of p.k)AE.state.kfSel.push({lid:L.id,prop:key,t:k.t});}
    this.build();
  },
  refresh(){this.build();},
  refreshTime(){
    if(!root||!root.isConnected||!playhead)return;
    const t=AE.state.t;
    playhead.style.left=xOf(t)+'px';
    const lab=root.querySelector('#phLabel');if(lab)lab.textContent=fmtTC(t,comp().fps);
    const ti=root.querySelector('#tlTimeInput');if(ti&&document.activeElement!==ti)ti.value=t.toFixed(3);
    const cn=root.querySelector('#tlCompName');if(cn)cn.textContent=comp().name;
  },
  updateFrame(){/* playhead handled by refreshTime */}
};
function cLayers(){return comp().layers;}
function typeIcon(t){return ({shape:'▭',text:'T',extrude:'◈',parametric:'◉',grid:'▦',field:'◎',particles:'✳',camera:'▣',light:'☀',precomp:'▤',null:'⊘',bg:'▧',tone:'♪',adjustment:'◐'})[t]||'·';}
function blendShort(b){return ({normal:'正常',add:'相加',screen:'滤色',multiply:'正片叠底',overlay:'叠加'})[b]||b;}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function fmtTC(t,fps){const f=Math.round(t*fps),hh=String(Math.floor(t/3600)).padStart(2,'0'),mm=String(Math.floor(t/60)%60).padStart(2,'0'),ss=String(Math.floor(t)%60).padStart(2,'0'),ff=String(f%fps).padStart(2,'0');return hh+':'+mm+':'+ss+':'+ff;}
})(window.AE);
