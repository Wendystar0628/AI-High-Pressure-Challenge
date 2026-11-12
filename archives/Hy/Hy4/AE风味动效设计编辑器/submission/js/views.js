/* ============================================================
   views.js — 曲线编辑器（值/速度曲线，含表达式最终曲线、可拖拽手柄）
              节点编辑器（端口连线、拖动、复制、封装、参数检查器）
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE,U=AE.util,MO=AE.model,ND=AE.nodes;
  const V=AE.views={};
  const $=id=>document.getElementById(id);
  function h(tag,attrs){const e=document.createElement(tag);attrs=attrs||{};for(const k in attrs){if(k==='class')e.className=attrs[k];else if(k==='html')e.innerHTML=attrs[k];else if(k==='text')e.textContent=attrs[k];else if(k.indexOf('on')===0&&typeof attrs[k]==='function')e.addEventListener(k.slice(2),attrs[k]);else e.setAttribute(k,attrs[k]);}return e;}

  /* ---------------- 画布尺寸 ---------------- */
  function sizeCanvas(c,wrap,headH){
    const w=Math.max(300,wrap.clientWidth),hh=Math.max(180,wrap.clientHeight-(headH||34));
    c.width=w;c.height=hh;c.style.width=w+'px';c.style.height=hh+'px';
    return {w:w,h:hh};
  }

  /* ============================================================
     曲线编辑器
     ============================================================ */
  V.graph={range:[0,15],mode:'value'};
  function graphProp(ed){
    if(ed.graphProp){
      const L=ed.comp.layers.find(l=>l.id===ed.graphProp.layerId);
      if(L&&MO.resolveProp(L,ed.graphProp.path))return ed.graphProp;
    }
    // 默认：选中图层的第一个可动画属性
    const L=ed.comp.layers.find(l=>ed.selectedLayers.indexOf(l.id)>=0)||ed.comp.layers[0];
    if(!L)return null;
    const paths=MO.collectPaths(L);
    let p=paths.find(x=>{const pr=MO.resolveProp(L,x);return pr&&(pr.kf.length||pr.expr);})||paths[0];
    return {layerId:L.id,path:p};
  }
  function propInfo(ed,gp){
    const L=ed.comp.layers.find(l=>l.id===gp.layerId);if(!L)return null;
    const prop=MO.resolveProp(L,gp.path);if(!prop)return null;
    return {L:L,prop:prop,name:L.name+' · '+(prop.label||gp.path)};
  }
  function sampleProp(ed,gp,t){
    const L=ed.comp.layers.find(l=>l.id===gp.layerId);if(!L)return 0;
    const v=MO.valueAtTime(ed.project,ed.comp,L,gp.path,t);
    if(Array.isArray(v))return Math.hypot.apply(null,U.ensureVec(v,3)); // 向量取模用于作图
    return v;
  }
  V.drawGraph=function(ed){
    const wrap=$('viewGraph');if(wrap.hidden)return;
    const c=$('graphCanvas'),{w:W,h:H}=sizeCanvas(c,wrap,34);
    const ctx=c.getContext('2d');ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#0b0d11';ctx.fillRect(0,0,W,H);
    const gp=graphProp(ed);
    const [t0,t1]=V.graph.range,padL=46,padR=14,padT=16,padB=24;
    const X=t=>padL+(t-t0)/(t1-t0)*(W-padL-padR);
    // 取样
    const N=Math.max(120,Math.floor(W)),vals=[],tt=[];
    for(let i=0;i<=N;i++){const t=t0+(t1-t0)*i/N;tt.push(t);vals.push(sampleProp(ed,gp,t));}
    let mn=Infinity,mx=-Infinity;
    vals.forEach(v=>{if(isFinite(v)){mn=Math.min(mn,v);mx=Math.max(mx,v);}});
    if(!isFinite(mn)){mn=0;mx=1;}if(mx-mn<1e-6){mx=mn+1;}
    const mrg=(mx-mn)*.15;mn-=mrg;mx+=mrg;
    const Y=v=>padT+(1-(v-mn)/(mx-mn))*(H-padT-padB);
    // 网格
    ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;ctx.font='9px monospace';ctx.fillStyle='#6a7180';
    for(let i=0;i<=5;i++){const y=padT+(H-padT-padB)*i/5;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke();
      ctx.fillText(num((mx-(mx-mn)*i/5)),4,y+3);}
    const step=t1-t0>8?1:(t1-t0>4?.5:.2);
    for(let t=Math.ceil(t0/step)*step;t<=t1;t+=step){const x=X(t);ctx.strokeStyle='rgba(255,255,255,.05)';ctx.beginPath();ctx.moveTo(x,padT);ctx.lineTo(x,H-padB);ctx.stroke();
      ctx.fillStyle='#6a7180';ctx.fillText(U.timeStr(t),x+2,H-8);}
    // 零轴
    if(mn<0&&mx>0){const y=Y(0);ctx.strokeStyle='rgba(120,200,160,.3)';ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke();}
    // 曲线（值 或 速度）
    const info=propInfo(ed,gp);
    ctx.lineWidth=1.8;
    const isExpr=info&&info.prop.expr;
    ctx.strokeStyle=isExpr?'#5bc8d8':'#ff9d4d';
    ctx.shadowColor=isExpr?'rgba(91,200,216,.5)':'rgba(255,157,77,.4)';ctx.shadowBlur=6;
    ctx.beginPath();
    if(V.graph.mode==='value'){
      vals.forEach((v,i)=>{const x=X(tt[i]),y=Y(v);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
    }else{
      // 速度曲线：位置沿运动路径的实际速度（弧长/时间）
      let prev=null;
      for(let i=0;i<=N;i++){
        const t=tt[i],dt=(t1-t0)/N;
        const L=ed.comp.layers.find(l=>l.id===gp.layerId);
        const a=MO.valueAtTime(ed.project,ed.comp,L,gp.path,Math.max(0,t-dt));
        const b=MO.valueAtTime(ed.project,ed.comp,L,gp.path,Math.min(ed.comp.duration,t+dt));
        let sp;
        if(Array.isArray(a)&&Array.isArray(b)){sp=U.vec.dist(U.ensureVec(a,3),U.ensureVec(b,3))/(2*dt);}
        else sp=Math.abs((b-a)/(2*dt));
        const x=X(t),y=Y(sp);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
    }
    ctx.stroke();ctx.shadowBlur=0;
    // 关键帧 + 手柄
    if(info){
      const pr=info.prop;
      pr.kf.forEach(k=>{
        const x=X(k.t),v=Array.isArray(k.v)?Math.hypot.apply(null,U.ensureVec(k.v,3)):k.v,y=Y(v);
        const sel=ed.selectedKeys&&ed.selectedKeys.has(info.L.id+'|'+gp.path+'|'+k.t);
        ctx.fillStyle=sel?'#ffe0a8':(pr.expr?'#5bc8d8':'#ff9d4d');
        ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();ctx.fill();
        ctx.strokeStyle='#111';ctx.stroke();
        // 贝塞尔手柄
        if(k.eo==='bezier'&&k.eh){
          const hx1=X(k.t+(k.eh[0]||.33)*(pr.kf.length>1?1:1)),hy1=Y(v+(k.eh[1]||0)*(mx-mn)*.25);
          ctx.strokeStyle='rgba(255,157,77,.5)';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(hx1,hy1);ctx.stroke();
          ctx.fillStyle='#ffb877';ctx.fillRect(hx1-2,hy1-2,4,4);
        }
      });
    }
    // 播放头
    const px=X(ed.time);
    ctx.strokeStyle='rgba(255,157,77,.85)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,padT);ctx.lineTo(px,H-padB);ctx.stroke();
    ctx.fillStyle='#ff9d4d';ctx.beginPath();ctx.moveTo(px-4,padT);ctx.lineTo(px+4,padT);ctx.lineTo(px,padT+7);ctx.closePath();ctx.fill();
    // 标题
    ctx.fillStyle='#9aa1ad';ctx.font='10px "Microsoft YaHei",sans-serif';
    ctx.fillText((V.graph.mode==='value'?'值曲线':'速度曲线')+' · '+(info?info.name:'—')+(isExpr?' · 表达式最终求值':''),padL+6,padT+12);
  };
  function num(v){return (typeof v==='number'&&isFinite(v))?v.toFixed(2):'0';}
  function buildGraphProps(ed){
    const box=$('graphProps');box.innerHTML='';
    const L=ed.comp.layers.find(l=>ed.selectedLayers.indexOf(l.id)>=0)||ed.comp.layers[0];
    if(!L)return;
    const paths=MO.collectPaths(L).filter(p=>{const pr=MO.resolveProp(L,p);return pr&&(pr.kf.length||pr.expr);});
    const show=paths.slice(0,7);
    show.forEach(p=>{
      const pr=MO.resolveProp(L,p);
      box.appendChild(h('button',{class:(ed.graphProp&&ed.graphProp.path===p&&ed.graphProp.layerId===L.id)?'on':'',
        text:pr.label||p.split('.').pop(),title:L.name+' · '+p,
        onclick:()=>{ed.graphProp={layerId:L.id,path:p};buildGraphProps(ed);V.drawGraph(ed);}}));
    });
  }
  function bindGraph(ed){
    const c=$('graphCanvas');
    document.querySelectorAll('#graphMode button').forEach(b=>b.addEventListener('click',()=>{
      V.graph.mode=b.dataset.m;document.querySelectorAll('#graphMode button').forEach(x=>x.classList.toggle('on',x===b));V.drawGraph(ed);
    }));
    c.addEventListener('wheel',e=>{e.preventDefault();
      const [t0,t1]=V.graph.range,mid=(t0+t1)/2,len=t1-t0;
      const nl=U.clamp(len*(e.deltaY<0?.85:1.18),.4,60);
      V.graph.range=[Math.max(0,mid-nl/2),mid+nl/2];V.drawGraph(ed);},{passive:false});
    let drag=null;
    c.addEventListener('mousedown',e=>{
      const gp=graphProp(ed),info=propInfo(ed,gp);if(!info)return;
      const r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
      const [t0,t1]=V.graph.range,padL=46,padR=14,padT=16,padB=24;
      const X=t=>padL+(t-t0)/(t1-t0)*(c.width-padL-padR);
      // 命中关键帧
      let hit=null;
      info.prop.kf.forEach(k=>{const kx=X(k.t),v=Array.isArray(k.v)?Math.hypot.apply(null,U.ensureVec(k.v,3)):k.v;
        const mn=0,mx=1; // 近似；用屏幕距离判定
        if(Math.abs(kx-x)<7)hit=k;});
      if(hit){drag={k:hit,x0:x,t0:hit.t};}
    });
    window.addEventListener('mousemove',e=>{
      if(!drag||$('viewGraph').hidden)return;
      const [t0,t1]=V.graph.range,c2=$('graphCanvas'),padL=46,padR=14;
      const scale=(t1-t0)/(c2.width-padL-padR);
      drag.k.t=Math.max(0,drag.t0+(e.movementX)*scale);
      drag.k.t=Math.round(drag.k.t*ed.comp.fps)/ed.comp.fps;
      drag.k.__g=true;V.drawGraph(ed);
    });
    window.addEventListener('mouseup',()=>{
      if(drag&&drag.k.__g){const pr=drag.k;delete pr.__g;pr.kf&&pr.kf.sort;MO.history.push('曲线拖动关键帧');}
      drag=null;
    });
  }

  /* ============================================================
     节点编辑器
     ============================================================ */
  V.node={panX:0,panY:0,zoom:1,drag:null,linkFrom:null,sel:null,hoverPort:null};
  function nodeGraph(ed){return ed.project.nodeGraphs.main||(ed.project.nodeGraphs.main=ND.createGraph());}
  function portPos(n,side,i,total,def){
    const w=148,hh=26+Math.max(def.ins.length,def.outs.length)*17+10;
    const x=side==='in'?0:w;
    const y=26+17*(i+.5);
    return {x:n.x+x,y:n.y+y,w:w,h:hh};
  }
  function nodeRect(n){
    const def=ND.DEFS[n.type];const w=148,hh=26+Math.max(def.ins.length,def.outs.length)*17+10;
    return {x:n.x,y:n.y,w:w,h:hh};
  }
  function portAt(nv,g,x,y){
    for(const n of g.nodes){
      const r=nodeRect(n),def=ND.DEFS[n.type];
      // 输入端口
      def.ins.forEach((p,i)=>{const px=n.x,py=n.y+26+17*(i+.5);if(Math.hypot(x-px,y-py)<8)return {node:n,port:p.n,side:'in',i:i};});
      def.outs.forEach((p,i)=>{const px=n.x+r.w,py=n.y+26+17*(i+.5);if(Math.hypot(x-px,y-py)<8)return {node:n,port:p.n,side:'out',i:i};});
    }
    return null;
  }
  function findPort(g,x,y){
    for(const n of g.nodes){
      const r=nodeRect(n),def=ND.DEFS[n.type];
      for(let i=0;i<def.ins.length;i++){const px=n.x,py=n.y+26+17*(i+.5);if(Math.hypot(x-px,y-py)<9)return {node:n,port:def.ins[i],side:'in',i:i};}
      for(let i=0;i<def.outs.length;i++){const px=n.x+r.w,py=n.y+26+17*(i+.5);if(Math.hypot(x-px,y-py)<9)return {node:n,port:def.outs[i],side:'out',i:i};}
    }
    return null;
  }
  V.drawNodes=function(ed){
    const wrap=$('viewNodes');if(wrap.hidden)return;
    const c=$('nodeCanvas'),{w:W,h:H}=sizeCanvas(c,wrap,34);
    const ctx=c.getContext('2d');ctx.clearRect(0,0,W,H);
    const nv=V.node,g=nodeGraph(ed);
    // 网格背景
    ctx.fillStyle='#0b0d11';ctx.fillRect(0,0,W,H);
    const gs=24*nv.zoom;
    ctx.strokeStyle='rgba(255,255,255,.035)';ctx.lineWidth=1;
    for(let x=(nv.panX%gs);x<W;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=(nv.panY%gs);y<H;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.save();ctx.translate(nv.panX,nv.panY);ctx.scale(nv.zoom,nv.zoom);
    // 分组框
    g.groups.forEach(gr=>{
      const ns=g.nodes.filter(n=>n.groupId===gr.id);if(!ns.length)return;
      let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
      ns.forEach(n=>{const r=nodeRect(n);x0=Math.min(x0,r.x);y0=Math.min(y0,r.y);x1=Math.max(x1,r.x+r.w);y1=Math.max(y1,r.y+r.h);});
      ctx.fillStyle='rgba(91,200,216,.05)';ctx.fillRect(x0-14,y0-24,x1-x0+28,y1-y0+38);
      ctx.strokeStyle='rgba(91,200,216,.35)';ctx.setLineDash([5,4]);ctx.strokeRect(x0-14,y0-24,x1-x0+28,y1-y0+38);ctx.setLineDash([]);
      ctx.fillStyle='#5bc8d8';ctx.font='11px "Microsoft YaHei",sans-serif';ctx.fillText('▣ '+gr.title,x0-10,y0-8);
    });
    // 连线
    const res=AE.nodes.evaluate(g,{t:ed.time,glyphChar:ed.project.assets.glyphChar,size:2.62});
    g.edges.forEach(e=>{
      const a=g.nodes.find(n=>n.id===e.from.node),b=g.nodes.find(n=>n.id===e.to.node);if(!a||!b)return;
      const da=ND.DEFS[a.type],db=ND.DEFS[b.type];
      const ai=Math.max(0,da.outs.findIndex(o=>o.n===e.from.port)),bi=Math.max(0,db.ins.findIndex(o=>o.n===e.to.port));
      const ar=nodeRect(a),br=nodeRect(b);
      const x0=a.x+ar.w,y0=a.y+26+17*(ai+.5),x1=b.x,y1=b.y+26+17*(bi+.5);
      const col=ND.PORT_COLORS[da.outs[ai]?da.outs[ai].t:'any']||'#9aa6b8';
      ctx.strokeStyle=col;ctx.lineWidth=2;ctx.globalAlpha=.85;
      ctx.beginPath();ctx.moveTo(x0,y0);const dx=Math.max(40,(x1-x0)*.5);ctx.bezierCurveTo(x0+dx,y0,x1-dx,y1,x1,y1);ctx.stroke();
      ctx.globalAlpha=1;
      // 数据流光点
      const f=(ed.time*.6+U.hashStr(e.id)*.001)%1;
      const bx=(1-f)*(1-f)*(1-f)*x0+3*(1-f)*(1-f)*f*(x0+dx)+3*(1-f)*f*f*(x1-dx)+f*f*f*x1;
      const by=(1-f)*(1-f)*(1-f)*y0+3*(1-f)*(1-f)*f*y0+3*(1-f)*f*f*y1+f*f*f*y1;
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bx,by,2.4,0,U.TAU);ctx.fill();
    });
    // 节点
    g.nodes.forEach(n=>{
      const def=ND.DEFS[n.type],r=nodeRect(n);
      const sel=nv.sel===n.id;
      ctx.fillStyle=sel?'#2a2318':'#1b1f27';
      ctx.strokeStyle=sel?'#ff9d4d':'#3a424e';ctx.lineWidth=sel?2:1;
      roundRect(ctx,r.x,r.y,r.w,r.h,7);ctx.fill();ctx.stroke();
      // 标题栏
      ctx.fillStyle=({输入:'#2b3a44',几何:'#22342f',场:'#2e273c',输出:'#3a2f22'})[def.cat]||'#242a33';
      roundRect(ctx,r.x,r.y,r.w,22,7);ctx.fill();
      ctx.fillStyle=sel?'#ffb877':'#d7dae1';ctx.font='11px "Microsoft YaHei",sans-serif';
      ctx.fillText(def.title,r.x+9,r.y+15);
      ctx.fillStyle='#6a7180';ctx.font='9px monospace';ctx.fillText(def.cat,r.x+r.w-24,r.y+15);
      // 端口
      def.ins.forEach((p,i)=>{
        const px=r.x,py=r.y+26+17*(i+.5);
        ctx.fillStyle=ND.PORT_COLORS[p.t]||'#9aa6b8';ctx.beginPath();ctx.arc(px,py,4.5,0,U.TAU);ctx.fill();
        ctx.fillStyle='#9aa6b8';ctx.font='10px "Microsoft YaHei",sans-serif';ctx.fillText(p.n,px+9,py+3);
      });
      def.outs.forEach((p,i)=>{
        const px=r.x+r.w,py=r.y+26+17*(i+.5);
        ctx.fillStyle=ND.PORT_COLORS[p.t]||'#9aa6b8';ctx.beginPath();ctx.arc(px,py,4.5,0,U.TAU);ctx.fill();
        ctx.fillStyle='#9aa6b8';ctx.font='10px "Microsoft YaHei",sans-serif';ctx.textAlign='right';ctx.fillText(p.n,px-9,py+3);ctx.textAlign='left';
      });
      // 当前结果标记
      const rv=res.values[n.id];
      if(rv){const o=rv.outputs,keys=Object.keys(o);if(keys.length){const v=o[keys[0]];
        let s='';if(v&&v.type==='contours')s=(v.rings?v.rings.length:0)+' 轮廓';
        else if(v&&v.type==='mesh')s=(v.mesh?v.mesh.triCount:0)+' 三角面';
        else if(v&&v.type==='scalar')s=(+v.value).toFixed(2);
        else if(v&&v.type==='field')s='场';
        ctx.fillStyle='#6f7785';ctx.font='9px monospace';ctx.fillText(s,r.x+9,r.y+r.h-6);}}
    });
    // 正在拉的连线
    if(nv.linkFrom&&nv.linkPos){
      const p=nv.linkFrom,def=ND.DEFS[p.node.type],r=nodeRect(p.node);
      const oi=Math.max(0,def.outs.findIndex(o=>o.n===p.port.n));
      const x0=r.x+r.w,y0=r.y+26+17*(oi+.5);
      ctx.strokeStyle=ND.PORT_COLORS[p.port.t]||'#fff';ctx.lineWidth=2;ctx.setLineDash([5,4]);
      ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(nv.linkPos.x,nv.linkPos.y);ctx.stroke();ctx.setLineDash([]);
    }
    ctx.restore();
    // 图例
    ctx.fillStyle='#6a7180';ctx.font='10px "Microsoft YaHei",sans-serif';
    let lx=10;
    Object.keys(ND.PORT_COLORS).forEach(k=>{if(k==='any')return;ctx.fillStyle=ND.PORT_COLORS[k];ctx.fillRect(lx,H-16,8,8);
      ctx.fillStyle='#8b9099';ctx.fillText(ND.PORT_LABELS[k],lx+11,H-8);lx+=52;});
    // 错误提示
    if(res.errors.length){ctx.fillStyle='#e35d5d';ctx.fillText('⚠ '+res.errors[0],10,18);}
  };
  function roundRect(ctx,x,y,w,hh,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+hh,r);ctx.arcTo(x+w,y+hh,x,y+hh,r);ctx.arcTo(x,y+hh,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function screenToGraph(ed,x,y){return {x:(x-V.node.panX)/V.node.zoom,y:(y-V.node.panY)/V.node.zoom};}
  function bindNodes(ed){
    const c=$('nodeCanvas');
    c.addEventListener('mousedown',e=>{
      const r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,g=nodeGraph(ed);
      const gp=screenToGraph(ed,x,y);
      const port=findPort(g,gp.x,gp.y);
      if(port){
        if(port.side==='out'){V.node.linkFrom={node:port.node,port:port.port};V.node.linkPos=gp;}
        else if(V.node.linkFrom){
          ND.connect(g,V.node.linkFrom.node.id,V.node.linkFrom.port.n,port.node.id,port.port.n);
          V.node.linkFrom=null;MO.history.push('连接节点');AE.scene.rebuild(ed);UI.renderFrame&&window.editor&&AE.ui.renderFrame(window.editor);
        }
        V.drawNodes(ed);return;
      }
      // 命中节点
      let hit=null;
      for(let i=g.nodes.length-1;i>=0;i--){const n=g.nodes[i],rr=nodeRect(n);
        if(gp.x>=rr.x&&gp.x<=rr.x+rr.w&&gp.y>=rr.y&&gp.y<=rr.y+rr.h){hit=n;break;}}
      if(hit){V.node.sel=hit.id;V.node.drag={node:hit,dx:gp.x-hit.x,dy:gp.y-hit.y};showInspector(ed,hit);}
      else{V.node.sel=null;V.node.drag={pan:true,x:x,y:y,px:V.node.panX,py:V.node.panY};V.node.linkFrom=null;showInspector(ed,null);}
      V.drawNodes(ed);
    });
    window.addEventListener('mousemove',e=>{
      const nv=V.node;if(!nv.drag&&!nv.linkFrom)return;
      const c2=$('nodeCanvas'),r=c2.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,gp=screenToGraph(ed,x,y);
      if(nv.linkFrom){nv.linkPos=gp;V.drawNodes(ed);return;}
      if(nv.drag&&nv.drag.pan){nv.panX=nv.drag.px+(x-nv.drag.x);nv.panY=nv.drag.py+(y-nv.drag.y);V.drawNodes(ed);}
      else if(nv.drag&&nv.drag.node){nv.drag.node.x=gp.x-nv.drag.dx;nv.drag.node.y=gp.y-nv.drag.dy;V.drawNodes(ed);}
    });
    window.addEventListener('mouseup',()=>{
      if(V.node.drag&&V.node.drag.node)MO.history.push('移动节点');
      V.node.drag=null;
    });
    c.addEventListener('wheel',e=>{e.preventDefault();V.node.zoom=U.clamp(V.node.zoom*(e.deltaY<0?1.1:1/1.1),.4,2.4);V.drawNodes(ed);},{passive:false});
    c.addEventListener('dblclick',e=>{
      const r=c.getBoundingClientRect(),gp=screenToGraph(ed,e.clientX-r.left,e.clientY-r.top);
      addNodeMenu(ed,gp,e.clientX,e.clientY);
    });
    c.addEventListener('contextmenu',e=>{
      e.preventDefault();const r=c.getBoundingClientRect(),gp=screenToGraph(ed,e.clientX-r.left,e.clientY-r.top),g=nodeGraph(ed);
      let hit=null;for(const n of g.nodes){const rr=nodeRect(n);if(gp.x>=rr.x&&gp.x<=rr.x+rr.w&&gp.y>=rr.y&&gp.y<=rr.y+rr.h)hit=n;}
      if(hit){V.node.sel=hit.id;showInspector(ed,hit);
        AE.ui.ctxmenu(e.clientX,e.clientY,[
          {label:'复制节点',key:'Ctrl+D',fn:()=>{ND.duplicate(g,hit.id);MO.history.push('复制节点');V.drawNodes(ed);}},
          {label:'封装为节点组',fn:()=>{ND.group(g,[hit.id],hit.title+' 组');MO.history.push('封装节点组');V.drawNodes(ed);}},
          {label:'断开相关连线',fn:()=>{g.edges=g.edges.filter(x=>x.from.node!==hit.id&&x.to.node!==hit.id);MO.history.push('断开连线');V.drawNodes(ed);}},
          {sep:true},{label:'删除节点',key:'Delete',fn:()=>{ND.removeNode(g,hit.id);MO.history.push('删除节点');V.drawNodes(ed);}}
        ]);}
      else addNodeMenu(ed,gp,e.clientX,e.clientY);
    });
    $('nodeAdd').addEventListener('click',()=>addNodeMenu(ed,{x:120,y:120},innerWidth/2,120));
    $('nodeEval').addEventListener('click',()=>{AE.scene.rebuild(ed);V.drawNodes(ed);AE.ui.renderFrame(ed);AE.ui.toast('节点重新计算完成');});
  }
  function addNodeMenu(ed,gp,x,y){
    const items=[];
    ND.CATS.forEach(cat=>{
      ND.TYPES.filter(t=>ND.DEFS[t].cat===cat).forEach(t=>{
        items.push({label:ND.DEFS[t].title+'  ·  '+t,fn:()=>{
          const g=nodeGraph(ed),n=ND.addNode(g,t,gp.x,gp.y);
          V.node.sel=n.id;showInspector(ed,n);MO.history.push('新建节点');V.drawNodes(ed);
        }});
      });
      items.push({sep:true});
    });
    AE.ui.ctxmenu(x,y,items);
  }
  function showInspector(ed,n){
    const box=$('nodeInspector');
    if(!n){box.innerHTML='<h4>节点检查器</h4><div class="mini-note">选择一个节点查看端口含义、当前结果与参数。</div>';return;}
    const def=ND.DEFS[n.type],g=nodeGraph(ed);
    const res=AE.nodes.evaluate(g,{t:ed.time,glyphChar:ed.project.assets.glyphChar,size:2.62});
    const rv=res.values[n.id];
    box.innerHTML='';
    box.appendChild(h('h4',{text:def.title}));
    box.appendChild(h('div',{class:'kv',html:'<span>类型</span><b>'+n.type+'</b>'}));
    box.appendChild(h('div',{class:'kv',html:'<span>分类</span><b>'+def.cat+'</b>'}));
    if(def.ins.length)box.appendChild(h('div',{class:'mini-note',text:'输入：'+def.ins.map(p=>p.n+'('+ND.PORT_LABELS[p.t]+')').join('、')}));
    if(def.outs.length)box.appendChild(h('div',{class:'mini-note',text:'输出：'+def.outs.map(p=>p.n+'('+ND.PORT_LABELS[p.t]+')').join('、')}));
    if(rv){const o=rv.outputs,keys=Object.keys(o);if(keys.length){const v=o[keys[0]];
      let s='';if(v&&v.type==='contours')s=(v.rings?v.rings.length:0)+' 个轮廓环';
      else if(v&&v.type==='mesh')s=(v.mesh?v.mesh.triCount:0)+' 个三角面';
      else if(v&&v.type==='scalar')s=(+v.value).toFixed(3);
      else if(v&&v.type==='field')s=v.field.type+' 场';
      box.appendChild(h('div',{class:'kv',html:'<span>当前结果</span><b>'+s+'</b>'}));}}
    // 参数
    for(const k in n.params){
      const spec=def.params[k],val=n.params[k];
      const row=h('div',{class:'prop-row'});
      row.appendChild(h('span',{class:'pl',text:spec.label||k}));
      if(spec.kind==='select'){
        const opts=typeof spec.options==='function'?spec.options():spec.options;
        const s=h('select',{class:'sel-input'});
        opts.forEach(o=>{const op=h('option',{text:String(o),value:String(o)});if(String(o)===String(val))op.selected=true;s.appendChild(op);});
        s.addEventListener('change',()=>{n.params[k]=s.value;MO.history.push('修改节点参数');AE.scene.rebuild(ed);V.drawNodes(ed);AE.ui.renderFrame(ed);});
        row.appendChild(s);
      }else if(spec.kind==='color'){
        const i=h('input',{type:'color',value:val});
        i.addEventListener('input',()=>{n.params[k]=i.value;V.drawNodes(ed);AE.ui.renderFrame(ed);});
        row.appendChild(i);
      }else if(spec.kind==='number'){
        const i=h('input',{class:'txt-input',value:String(val)});
        i.addEventListener('change',()=>{n.params[k]=parseFloat(i.value)||0;MO.history.push('修改节点参数');AE.scene.rebuild(ed);V.drawNodes(ed);AE.ui.renderFrame(ed);});
        i.addEventListener('keydown',e=>e.stopPropagation());row.appendChild(i);
      }else{
        const i=h('input',{type:'range',min:spec.min,max:spec.max,step:spec.step,value:val,class:'slider'});
        const sv=h('span',{class:'sv',text:(+val).toFixed(2)});
        i.addEventListener('input',()=>{n.params[k]=parseFloat(i.value);sv.textContent=(+i.value).toFixed(2);V.drawNodes(ed);AE.ui.renderFrame(ed);});
        const wrap=h('div',{class:'slider'});wrap.appendChild(i);wrap.appendChild(sv);row.appendChild(wrap);
      }
      box.appendChild(row);
    }
    // 连线信息
    const conn=g.edges.filter(e=>e.from.node===n.id||e.to.node===n.id).length;
    box.appendChild(h('div',{class:'mini-note',text:'连线数：'+conn+' · 一个几何输出可同时连接显示/变形/发射/碰撞。'}));
  }

  /* ---------------- 生命周期 ---------------- */
  V.refresh=function(ed){buildGraphProps(ed);};
  V.onView=function(ed,v){
    if(v==='graph'){V.drawGraph(ed);}
    else if(v==='nodes'){V.drawNodes(ed);}
    else if(v==='render'){AE.ui.buildRender(ed);}
  };
  V.onFrame=function(ed){
    if(ed.view==='graph')V.drawGraph(ed);
    else if(ed.view==='nodes')V.drawNodes(ed);
    else if(ed.view==='render'){
      const t=$('rsT'),f=$('rsF'),p=$('rsP');
      if(t)t.textContent=ed.time.toFixed(2);
      if(f)f.textContent=Math.round(ed.time*ed.comp.fps);
      if(p&&AE.demo.phaseAt)p.textContent=AE.demo.phaseAt(ed.time).name;
    }
  };
  V.syncTime=function(ed){}; // onFrame 已处理
  V.resize=function(ed){if(ed.view==='graph')V.drawGraph(ed);else if(ed.view==='nodes')V.drawNodes(ed);};
  V.init=function(ed){bindGraph(ed);bindNodes(ed);};
  V.bind=V.init;

  console.log('[forge] views ready');
})();
