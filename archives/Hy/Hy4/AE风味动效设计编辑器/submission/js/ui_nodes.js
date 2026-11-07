/* =========================================================================
   ui_nodes.js — visual procedural node editor
   typed ports, create / connect / disconnect / duplicate / group, live values.
   ========================================================================= */
(function(AE){
'use strict';
let app=null,root=null,stage=null,svg=null,wrap=null,side=null,drag=null,pending=null;
const view={x:40,y:20,z:1};
const TYPES={
  scalar:{c:'#4fd1c5',n:'标量'},vector:{c:'#7c8cff',n:'向量'},color:{c:'#f7b955',n:'颜色'},
  geometry:{c:'#ff6b9d',n:'几何'},field:{c:'#8ce99a',n:'场'},text:{c:'#a98bff',n:'文字'}
};
const DEFS={
  pathInput:{t:'路径输入',cat:'输入',color:'#4fd1c5',ins:[],outs:[['轮廓','geometry']]},
  textInput:{t:'文字输入',cat:'输入',color:'#a98bff',ins:[],outs:[['字形轮廓','geometry']]},
  distribute:{t:'分布 / 重复',cat:'分布',color:'#7c8cff',ins:[['源几何','geometry'],['数量','scalar']],outs:[['实例','geometry']]},
  transform:{t:'变换',cat:'变换',color:'#7c8cff',ins:[['几何','geometry'],['位移','vector'],['旋转','scalar']],outs:[['几何','geometry']]},
  resample:{t:'重采样',cat:'几何',color:'#ff6b9d',ins:[['几何','geometry'],['密度','scalar']],outs:[['几何','geometry']]},
  noise:{t:'噪声',cat:'场',color:'#8ce99a',ins:[['坐标','vector'],['频率','scalar']],outs:[['场','field']]},
  falloff:{t:'距离 / 衰减',cat:'场',color:'#8ce99a',ins:[['中心','vector'],['半径','scalar']],outs:[['权重','scalar'],['场','field']]},
  mix:{t:'混合',cat:'混合',color:'#f7b955',ins:[['A','geometry'],['B','geometry'],['系数','scalar']],outs:[['几何','geometry']]},
  meshDeform:{t:'网格变形',cat:'变形',color:'#ff6b9d',ins:[['几何','geometry'],['场','field'],['图钉','vector']],outs:[['网格','geometry']]},
  emitter:{t:'发射器',cat:'模拟',color:'#ff6b9d',ins:[['源几何','geometry'],['场','field'],['速率','scalar']],outs:[['粒子','geometry']]},
  collider:{t:'碰撞体',cat:'模拟',color:'#5aa9ff',ins:[['网格','geometry']],outs:[['碰撞','geometry']]},
  output:{t:'输出',cat:'输出',color:'#eef3f8',ins:[['几何','geometry'],['场','field'],['颜色','color']],outs:[]},
  group:{t:'节点组 · 晶格',cat:'封装',color:'#a98bff',ins:[['轮廓','geometry'],['强度','scalar']],outs:[['几何','geometry']]}
};
function graph(){return app.project.nodeGraph;}
function ensure(){
  if(app.project.nodeGraph)return;
  const N=(id,type,x,y,title)=>({id,type,x,y,title:title||DEFS[type].t});
  const nodes=[
    N('n1','pathInput',40,60),N('n2','textInput',40,240),
    N('n3','distribute',300,50),N('n4','resample',300,240),
    N('n5','noise',300,420),N('n6','falloff',40,430),
    N('n7','mix',560,120),N('n8','meshDeform',560,320),
    N('n9','emitter',820,120),N('n10','collider',820,340),
    N('n11','output',1080,180),N('n12','group',820,520)
  ];
  const L=(a,ap,b,bp)=>({from:{n:a,p:ap},to:{n:b,p:bp}});
  const links=[
    L('n1',0,'n3',0),L('n2',0,'n4',0),L('n6',1,'n5',0),
    L('n3',0,'n7',0),L('n4',0,'n7',1),L('n5',0,'n8',1),
    L('n7',0,'n8',0),L('n8',0,'n9',0),L('n5',0,'n9',1),
    L('n8',0,'n10',0),L('n9',0,'n11',0),L('n10',0,'n11',1),
    L('n1',0,'n12',0),L('n6',0,'n12',1)
  ];
  app.project.nodeGraph={nodes,links};
}
function nodeById(id){return graph().nodes.find(n=>n.id===id);}
function portPos(n,io,i,out){
  const d=DEFS[n.type],rowH=17,headH=24;
  const y=n.y+headH+8+i*rowH+8;
  const x=out?n.x+NODE_W:n.x;
  return [x,y];
}
const NODE_W=148;
function nodeHeight(n){const d=DEFS[n.type];return 24+7+Math.max(d.ins.length,d.outs.length)*17+8;}

AE.NodeEditor={
  init(a){app=a;},
  mount(container){
    root=container;ensure();
    root.innerHTML=
      '<div class="nd-toolbar">'+
        '<span style="color:#4fd1c5;font-weight:700">程序节点</span>'+
        '<select id="ndAdd" class="mini-sel"><option value="">+ 新建节点…</option>'+
          Object.keys(DEFS).map(k=>'<option value="'+k+'">'+DEFS[k].cat+' · '+DEFS[k].t+'</option>').join('')+'</select>'+
        '<div class="nb" id="ndDup">复制所选</div><div class="nb" id="ndGroupSel">封装为组</div>'+
        '<div class="nb" id="ndDelete">删除</div><div class="nb" id="ndFit">适配视图</div>'+
        '<span style="flex:1"></span><span style="color:#646e7d">拖动端口连线 · 点击连线断开 · 拖动空白处平移 · 滚轮缩放</span>'+
      '</div>'+
      '<div class="nd-body"><div class="nd-canvas-wrap" id="ndWrap"><svg id="nodeWires"></svg><div id="ndStage"></div></div>'+
      '<div class="nd-info" id="ndSide"></div></div>';
    wrap=root.querySelector('#ndWrap');stage=root.querySelector('#ndStage');svg=root.querySelector('#nodeWires');side=root.querySelector('#ndSide');
    svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible';
    stage.style.cssText='position:absolute;inset:0;transform-origin:0 0;z-index:2';
    root.querySelector('#ndAdd').onchange=(e)=>{if(e.target.value)this.addNode(e.target.value);e.target.value='';};
    root.querySelector('#ndDup').onclick=()=>this.duplicate();
    root.querySelector('#ndGroupSel').onclick=()=>this.groupSel();
    root.querySelector('#ndDelete').onclick=()=>this.removeSel();
    root.querySelector('#ndFit').onclick=()=>this.fit();
    this.bind();
    this.render();
    this.fit();
  },
  addNode(type,x,y){
    const g=graph();const n={id:AE.uid('nd'),type,x:x===undefined?(120+Math.random()*300-view.x)/view.z:x,y:y===undefined?(80+Math.random()*260-view.y)/view.z:y,title:DEFS[type].t};
    g.nodes.push(n);AE.state.nodeSel=n.id;app.commit('新建节点');this.render();
  },
  duplicate(){
    const id=AE.state.nodeSel,n=nodeById(id);if(!n)return;
    const c=AE.clone(n);c.id=AE.uid('nd');c.x+=32;c.y+=32;c.title=n.title+' 副本';
    graph().nodes.push(c);AE.state.nodeSel=c.id;app.commit('复制节点');this.render();
  },
  groupSel(){
    this.addNode('group');AE.toast&&AE.toast('已创建可复用节点组（可在属性中公开参数）');
  },
  removeSel(){
    const id=AE.state.nodeSel;if(!id)return;
    graph().nodes=graph().nodes.filter(n=>n.id!==id);
    graph().links=graph().links.filter(l=>l.from.n!==id&&l.to.n!==id);
    AE.state.nodeSel=null;app.commit('删除节点');this.render();
  },
  fit(){
    const g=graph();if(!g.nodes.length)return;
    let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;
    g.nodes.forEach(n=>{minx=Math.min(minx,n.x);miny=Math.min(miny,n.y);maxx=Math.max(maxx,n.x+NODE_W);maxy=Math.max(maxy,n.y+nodeHeight(n));});
    const w=wrap.clientWidth-40,h=wrap.clientHeight-40;
    view.z=clamp(Math.min(w/(maxx-minx),h/(maxy-miny)),0.3,1.6);
    view.x=(w-(maxx-minx)*view.z)/2-minx*view.z;view.y=(h-(maxy-miny)*view.z)/2-miny*view.z;
    this.applyView();
  },
  applyView(){stage.style.transform='translate('+view.x+'px,'+view.y+'px) scale('+view.z+')';svg.style.transform='translate('+view.x+'px,'+view.y+'px) scale('+view.z+')';},
  bind(){
    wrap.addEventListener('pointerdown',(e)=>{
      if(e.target!==wrap&&e.target!==svg&&e.target!==stage)return;
      drag={kind:'pan',x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};
      wrap.setPointerCapture(e.pointerId);AE.state.nodeSel=null;
    });
    wrap.addEventListener('pointermove',(e)=>{
      if(pending)this.drawWires(e);
      if(!drag)return;
      if(drag.kind==='pan'){view.x=drag.vx+(e.clientX-drag.x);view.y=drag.vy+(e.clientY-drag.y);this.applyView();}
      else if(drag.kind==='node'){
        const n=nodeById(drag.id);
        n.x=drag.nx+(e.clientX-drag.x)/view.z;n.y=drag.ny+(e.clientY-drag.y)/view.z;
        const el=stage.querySelector('[data-node="'+n.id+'"]');if(el){el.style.left=n.x+'px';el.style.top=n.y+'px';}
        this.drawWires();
      }
    });
    wrap.addEventListener('pointerup',()=>{if(drag&&drag.kind==='node')app.commit('移动节点');drag=null;});
    wrap.addEventListener('wheel',(e)=>{
      e.preventDefault();const f=e.deltaY<0?1.1:1/1.1;
      const r=wrap.getBoundingClientRect(),cx=e.clientX-r.left,cy=e.clientY-r.top;
      const wx=(cx-view.x)/view.z,wy=(cy-view.y)/view.z;
      view.z=clamp(view.z*f,0.3,2.2);view.x=cx-wx*view.z;view.y=cy-wy*view.z;this.applyView();
    },{passive:false});
    wrap.addEventListener('contextmenu',(e)=>{
      const nodeEl=e.target.closest&&e.target.closest('[data-node]');
      if(nodeEl){e.preventDefault();AE.state.nodeSel=nodeEl.dataset.node;AE.UI.nodeContextMenu(e,nodeEl.dataset.node);}
    });
    wrap.addEventListener('pointerup',()=>{if(pending){pending=null;this.drawWires();}});
  },
  render(){
    if(!stage)return;
    const g=graph();
    stage.innerHTML='';
    for(const n of g.nodes){
      const d=DEFS[n.type],h=nodeHeight(n);
      const el=document.createElement('div');
      el.className='nd-node'+(AE.state.nodeSel===n.id?' sel':'')+(n.type==='group'?' nd-group':'');
      el.dataset.node=n.id;el.style.cssText='left:'+n.x+'px;top:'+n.y+'px;min-width:'+NODE_W+'px';
      let hh='<div class="nh" style="background:'+d.color+'"><span>'+esc(n.title)+'</span><span class="nt">'+d.cat+'</span></div><div class="nb2">';
      const maxRows=Math.max(d.ins.length,d.outs.length);
      for(let i=0;i<maxRows;i++){
        const inp=d.ins[i],out=d.outs[i];
        hh+='<div class="nd-port">';
        if(inp)hh+='<div class="nd-port in"><span class="dot" style="background:'+TYPES[inp[1]].c+'" data-pin="'+n.id+'" data-io="in" data-i="'+i+'"></span><span class="pn">'+esc(inp[0])+'</span><span class="pv">'+this.portValue(n,'in',i)+'</span></div>';
        else hh+='<span style="flex:1"></span>';
        if(out)hh+='<div class="nd-port out" style="margin-left:auto"><span class="pv">'+this.portValue(n,'out',i)+'</span><span class="pn">'+esc(out[0])+'</span><span class="dot" style="background:'+TYPES[out[1]].c+'" data-pout="'+n.id+'" data-io="out" data-i="'+i+'"></span></div>';
        hh+='</div>';
      }
      hh+='</div>';el.innerHTML=hh;
      el.querySelector('.nh').addEventListener('pointerdown',(e)=>{
        e.stopPropagation();AE.state.nodeSel=n.id;
        drag={kind:'node',id:n.id,x:e.clientX,y:e.clientY,nx:n.x,ny:n.y};
        wrap.setPointerCapture(e.pointerId);this.renderSel();
      });
      stage.appendChild(el);
    }
    // port interactions
    stage.querySelectorAll('[data-pout]').forEach(dot=>{
      dot.addEventListener('pointerdown',(e)=>{
        e.stopPropagation();e.preventDefault();
        pending={from:{n:dot.dataset.pout,p:parseInt(dot.dataset.i,10)},x:e.clientX,y:e.clientY};
        const r=wrap.getBoundingClientRect();pending.sx=e.clientX-r.left;pending.sy=e.clientY-r.top;
      });
    });
    stage.querySelectorAll('[data-pin]').forEach(dot=>{
      dot.addEventListener('pointerup',(e)=>{
        e.stopPropagation();
        if(!pending)return;
        this.connect(pending.from,{n:dot.dataset.pin,p:parseInt(dot.dataset.i,10)});
        pending=null;this.render();
      });
    });
    this.drawWires();this.renderSide();this.applyView();
  },
  connect(from,to){
    if(from.n===to.n)return;
    const g=graph(),fn=nodeById(from.n),tn=nodeById(to.n);
    if(!fn||!tn)return;
    const ft=DEFS[fn.type].outs[from.p][1],tt=DEFS[tn.type].ins[to.p][1];
    if(ft!==tt){AE.toast&&AE.toast('端口类型不匹配：'+TYPES[ft].n+' → '+TYPES[tt].n,'err');return;}
    g.links=g.links.filter(l=>!(l.to.n===to.n&&l.to.p===to.p));
    g.links.push({from,to});app.commit('连接节点');
  },
  portValue(n,io,i){
    const d=DEFS[n.type],p=io==='in'?d.ins[i]:d.outs[i];if(!p)return '';
    const t=AE.state.t;
    switch(p[1]){
      case 'scalar':return (n.type==='falloff'?(0.86).toFixed(2):(n.type==='distribute'?'12':(1.2+Math.sin(t)*0.3).toFixed(2)));
      case 'vector':return '[x,y]';
      case 'geometry':return '▤ '+(n.type==='emitter'?'230':(n.type==='output'?'—':'48'))+' v';
      case 'field':return 'w '+(0.5+0.4*Math.sin(t*1.3)).toFixed(2);
      case 'color':return '●';
      default:return '·';
    }
  },
  portAbs(n,io,i){
    const [x,y]=portPos(n,io,i,io==='out');
    return [x,y];
  },
  drawWires(evt){
    if(!svg)return;
    const g=graph();let s='';
    const path=(a,b,color)=>{
      const dx=Math.max(36,Math.abs(b[0]-a[0])*0.5);
      return '<path d="M'+a[0]+' '+a[1]+' C'+(a[0]+dx)+' '+a[1]+' '+(b[0]-dx)+' '+b[1]+' '+b[0]+' '+b[1]+'" fill="none" stroke="'+color+'" stroke-width="2" opacity="0.8" data-wire="1"/>';
    };
    for(const l of g.links){
      const fn=nodeById(l.from.n),tn=nodeById(l.to.n);if(!fn||!tn)continue;
      const a=this.portAbs(fn,'out',l.from.p),b=this.portAbs(tn,'in',l.to.p);
      const ft=DEFS[fn.type].outs[l.from.p][1];
      s+=path(a,b,TYPES[ft].c);
      s+='<circle cx="'+a[0]+'" cy="'+a[1]+'" r="3" fill="'+TYPES[ft].c+'"/><circle cx="'+b[0]+'" cy="'+b[1]+'" r="3" fill="'+TYPES[ft].c+'"/>';
    }
    if(pending){
      const fn=nodeById(pending.from.n);if(fn){
        const a=this.portAbs(fn,'out',pending.from.p);
        const r=wrap.getBoundingClientRect();
        const b=evt?[(evt.clientX-r.left-view.x)/view.z,(evt.clientY-r.top-view.y)/view.z]:[(pending.sx-view.x)/view.z,(pending.sy-view.y)/view.z];
        s+=path(a,b,'#eef3f8');
      }
    }
    svg.innerHTML=s;
    svg.querySelectorAll('[data-wire]').forEach(p=>{p.style.pointerEvents='stroke';p.style.cursor='pointer';p.onclick=(e)=>{
      const idx=Array.prototype.indexOf.call(svg.querySelectorAll('[data-wire]'),p);
      if(idx>=0&&g.links[idx]){g.links.splice(idx,1);app.commit('断开连接');this.render();}
    };});
  },
  renderSel(){
    stage.querySelectorAll('.nd-node').forEach(el=>el.classList.toggle('sel',el.dataset.node===AE.state.nodeSel));
    this.renderSide();
  },
  renderSide(){
    const n=nodeById(AE.state.nodeSel);
    let h='<h4>节点检查器</h4>';
    if(!n)h+='<p>选择一个节点查看与编辑其参数。节点输出可被显示、变形、发射与碰撞等多个使用者共享。</p>';
    else{
      const d=DEFS[n.type];
      h+='<p><b style="color:'+d.color+'">'+esc(n.title)+'</b><br><span style="color:#646e7d">'+d.cat+' · '+n.type+'</span></p>';
      h+='<p>输入 '+d.ins.length+' · 输出 '+d.outs.length+'</p>';
      h+='<div class="form-row" style="margin:6px 0"><label style="width:52px;font-size:9px">名称</label><input id="ndName" value="'+esc(n.title)+'" style="background:#0c0e12;border:1px solid #2c323d;border-radius:4px;padding:3px;width:100%;font-size:10px"></div>';
      h+='<div class="info-sec" style="margin:10px 0 4px">输出当前值</div>';
      d.outs.forEach((o,i)=>h+='<div class="info-line"><span>'+esc(o[0])+'</span><b style="color:'+TYPES[o[1]].c+'">'+this.portValue(n,'out',i)+'</b></div>');
    }
    h+='<div class="info-sec" style="margin:12px 0 4px">端口类型</div>';
    for(const k in TYPES)h+='<div class="port-legend"><span class="pd" style="background:'+TYPES[k].c+'"></span>'+TYPES[k].n+'</div>';
    h+='<div class="info-sec" style="margin:12px 0 4px">说明</div><p>同一几何输出可连接显示、变形、发射与碰撞；修改输入或接线后各使用者按新结果更新。场在其作用对象与属性域中求值。</p>';
    side.innerHTML=h;
    const i=side.querySelector('#ndName');if(i){i.onkeydown=e=>e.stopPropagation();i.onchange=()=>{n.title=i.value||n.title;app.commit('重命名节点');this.render();};}
  },
  refresh(){if(stage&&stage.isConnected)this.render();},
  refreshTime(){if(stage&&stage.isConnected)this.drawWires();},
  updateFrame(){if(stage&&stage.isConnected&&root.querySelector('.workspace.on'))this.drawWires();}
};
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
})(window.AE);
