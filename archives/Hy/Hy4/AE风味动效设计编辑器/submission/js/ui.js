/* =========================================================================
   ui.js — editor shell orchestrator: menus, tools, transport, workspaces,
   shortcuts, context menus, project save / load, view controls.
   ========================================================================= */
(function(AE){
'use strict';
let app=null;
const el=(id)=>document.getElementById(id);
function h(html){const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstChild;}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function comp(){return app.activeComp();}

const MENUS=[
  {n:'文件',items:[['新建工程','Ctrl+N'],['打开工程…','Ctrl+O'],['保存工程','Ctrl+S'],['-'],['导出图像序列…',''],['导出视频…',''],['工作区导出…','']]},
  {n:'编辑',items:[['撤销','Ctrl+Z'],['重做','Ctrl+Y'],['-'],['复制','Ctrl+D'],['删除','Delete'],['全选','Ctrl+A'],['全选关键帧','Ctrl+Alt+A'],['-'],['预合成','Ctrl+Shift+C'],['复制关键帧','Ctrl+C'],['粘贴关键帧','Ctrl+V'],['-'],['缓入缓出','F9']]},
  {n:'合成',items:[['合成设置…',''],['新建合成',''],['添加标记','M'],['-'],['工作区导出','']]},
  {n:'图层',items:[['新建形状层',''],['新建文字层','T'],['新建空对象',''],['新建调整层',''],['新建摄像机',''],['新建灯光',''],['-'],['预合成','Ctrl+Shift+C'],['上移一层',''],['下移一层','']]},
  {n:'效果',items:[['高斯模糊',''],['发光',''],['投影',''],['色相 / 饱和度',''],['-'],['添加空间场','']]},
  {n:'视图',items:[['适配画布',''],['放大','+'],['缩小','-'],['-'],['前视图',''],['顶视图',''],['左视图',''],['透视 / 活动相机','']]},
  {n:'窗口',items:[['时间轴',''],['曲线编辑器',''],['节点编辑器',''],['属性',''],['效果',''],['信息','']]},
  {n:'帮助',items:[['快捷键','?'],['关于 PRISMA','']]}
];

AE.UI={
  init(a){
    app=a||AE.app;
    AE.state.kfSel=AE.state.kfSel||[];
    AE.state.nodeSel=AE.state.nodeSel||null;
    AE.state.workspace=AE.state.workspace||'standard';
    this.buildMenus();this.buildTools();this.buildTopRight();this.buildTransport();
    this.buildCompTabs();this.buildRightTabs();this.buildBottomTabs();this.buildProject();
    this.buildViewControls();this.bindGlobal();this.bindSplitters();this.autosaveLoad();
    el('fpsBadge').textContent=AE.state.fps+' fps';
    if(AE.Timeline)AE.Timeline.init(app);
    if(AE.Props)AE.Props.init(app);
    if(AE.CurveEditor)AE.CurveEditor.init(app);
    if(AE.NodeEditor)AE.NodeEditor.init(app);
    if(AE.CanvasFX)AE.CanvasFX.init(app);
    this.setBottom(AE.state.bottomWS||'timeline');
    if(AE.Props)AE.Props.mount(el('rightBody'));
  },

  /* ---------------- top bar ---------------- */
  buildMenus(){
    const mb=el('menubar');mb.innerHTML='';
    MENUS.forEach(m=>{
      const d=h('<div class="menu-item">'+m.n+'</div>');
      d.onclick=(e)=>{e.stopPropagation();this.showMenu(m,e.clientX,e.clientY+22);};
      mb.appendChild(d);
    });
  },
  showMenu(m,x,y){
    document.querySelectorAll('.menu-pop').forEach(n=>n.remove());
    const p=h('<div class="menu-pop"></div>');
    m.items.forEach(it=>{
      if(it[0]==='-'){p.appendChild(h('<div class="msep"></div>'));return;}
      const d=h('<div class="mi">'+it[0]+'<span class="kc">'+(it[1]||'')+'</span></div>');
      d.onclick=()=>{p.remove();this.command(it[0]);};
      p.appendChild(d);
    });
    p.style.left=Math.min(x,window.innerWidth-230)+'px';p.style.top=y+'px';
    document.body.appendChild(p);
    const close=()=>{p.remove();document.removeEventListener('click',close);};
    setTimeout(()=>document.addEventListener('click',close),0);
  },
  buildTools(){
    const tools=[['select','⬈','选择'],['hand','✋','抓手'],['zoom','⊕','缩放'],['shape','▭','形状'],
      ['pen','✎','钢笔'],['text','T','文字'],['anchor','⊕','锚点'],['rotate','⟳','旋转'],['camera','▣','相机']];
    const box=el('tools');box.innerHTML='';
    tools.forEach(([id,ic,title])=>{
      const b=h('<div class="tool'+(id===AE.state.tool?' on':'')+'" title="'+title+'工具">'+ic+'</div>');
      b.dataset.tool=id;
      b.onclick=()=>{box.querySelectorAll('.tool').forEach(x=>x.classList.remove('on'));b.classList.add('on');AE.state.tool=id;
        el('toolInfo').textContent=title+'工具 · 画布中拖动进行编辑';};
      box.appendChild(b);
    });
  },
  buildTopRight(){
    const ws=[['standard','标准'],['motion','动效'],['nodes','节点']];
    const box=el('wsSwitch');box.innerHTML='';
    ws.forEach(([id,n])=>{
      const b=h('<div class="ws'+(AE.state.workspace===id?' on':'')+'">'+n+'</div>');
      b.onclick=()=>{box.querySelectorAll('.ws').forEach(x=>x.classList.remove('on'));b.classList.add('on');
        AE.state.workspace=id;
        this.setBottom(id==='nodes'?'nodes':(id==='motion'?'curve':'timeline'));
        app.render();};
      box.appendChild(b);
    });
    el('helpBtn').onclick=()=>this.showShortcuts();
    el('autosaveLabel').onclick=()=>this.saveProject();
  },
  buildTransport(){
    const btns=[['|<','首帧'],['◀|','上一帧'],['◀','后退'],['▶','播放'],['■','停止'],
      ['▶|','下一帧'],['|▶','末帧'],['◉','循环']];
    const box=el('transportBtns');box.innerHTML='';
    btns.forEach(([ic,title])=>{
      const b=h('<div class="tc-btn'+(title==='播放'?' play':'')+(title==='循环'&&AE.state.loop?' on':'')+'" title="'+title+'">'+ic+'</div>');
      b.onclick=()=>this.transport(title);
      box.appendChild(b);
    });
    el('loopChk').onchange=(e)=>AE.state.loop=e.target.checked;
    el('audioChk').onchange=(e)=>AE.state.audioOn=e.target.checked;
    el('snapChk').onchange=(e)=>{AE.state.snap=e.target.checked;const q=el('tlSnap');if(q)q.classList.toggle('on',AE.state.snap);};
    el('mbChk').onchange=(e)=>{AE.state.motionBlur=e.target.checked;app.render();};
    el('guideChk').onchange=(e)=>{AE.state.grid=e.target.checked;if(AE.CanvasFX)AE.CanvasFX.updateFrame(app.frame);};
    el('snapTo').textContent='关键帧 · 播放头 · 标记 · 入出点';
  },
  transport(cmd){
    const c=comp(),fps=AE.state.fps;
    switch(cmd){
      case '播放':AE.state.playing=!AE.state.playing;if(AE.Audio)AE.Audio.ensure();break;
      case '停止':AE.state.playing=false;app.setTime(0);break;
      case '首帧':app.setTime(0);break;
      case '末帧':app.setTime(c.duration);break;
      case '上一帧':case '后退':app.setTime(AE.state.t-1/fps);break;
      case '下一帧':app.setTime(AE.state.t+1/fps);break;
      case '循环':AE.state.loop=!AE.state.loop;el('loopChk').checked=AE.state.loop;break;
    }
    this.refreshTime();
  },
  buildCompTabs(){
    const box=el('compTabs');box.innerHTML='';
    app.project.comps.forEach(c=>{
      const b=h('<div class="comp-tab'+(c.id===app.project.activeCompId?' on':'')+'" title="'+esc(c.name)+'">'+esc(c.name)+'</div>');
      b.onclick=()=>{app.project.activeCompId=c.id;app.comp=app.activeComp();AE.state.activeCompId=c.id;
        AE.state.selection=[];AE.state.t=clamp(AE.state.t,0,c.duration);
        this.refresh();app.render();};
      box.appendChild(b);
    });
  },
  buildRightTabs(){
    const tabs=[['props','属性'],['fx','效果'],['info','信息']];
    const box=el('rightTabs');box.innerHTML='';
    tabs.forEach(([id,n])=>{
      const b=h('<div class="rt-tab'+(AE.state.rightTab===id?' on':'')+'" data-t="'+id+'">'+n+'</div>');
      b.onclick=()=>this.setRightTab(id);
      box.appendChild(b);
    });
  },
  setRightTab(id){
    AE.state.rightTab=id;
    el('rightTabs').querySelectorAll('.rt-tab').forEach(b=>b.classList.toggle('on',b.dataset.t===id));
    if(AE.Props)AE.Props.setTab(id);
  },
  buildBottomTabs(){
    const tabs=[['timeline','时间轴'],['curve','曲线编辑器'],['nodes','节点编辑器']];
    const box=el('bottomTabs');box.innerHTML='';
    tabs.forEach(([id,n])=>{
      const b=h('<div class="bw-tab" data-b="'+id+'">'+n+'</div>');
      b.onclick=()=>this.setBottom(id);
      box.appendChild(b);
    });
    el('bottomBody').innerHTML='<div class="workspace" id="wsTimeline"></div><div class="workspace" id="wsCurve"></div><div class="workspace" id="wsNodes"></div>';
  },
  setBottom(id){
    AE.state.bottomWS=id;
    el('bottomTabs').querySelectorAll('.bw-tab').forEach(b=>b.classList.toggle('on',b.dataset.b===id));
    ['Timeline','Curve','Nodes'].forEach((n,i)=>el('ws'+n).classList.toggle('on',['timeline','curve','nodes'][i]===id));
    const t=el('wsTimeline'),c=el('wsCurve'),nd=el('wsNodes');
    if(id==='timeline'&&AE.Timeline&&!t.dataset.mounted){t.dataset.mounted='1';AE.Timeline.mount(t);}
    if(id==='curve'&&AE.CurveEditor&&!c.dataset.mounted){c.dataset.mounted='1';AE.CurveEditor.mount(c);}
    if(id==='nodes'&&AE.NodeEditor&&!nd.dataset.mounted){nd.dataset.mounted='1';AE.NodeEditor.mount(nd);}
    this.buildBottomActions(id);
    this.refresh();
    if(id==='curve'&&AE.CurveEditor)AE.CurveEditor.resize();
    if(id==='nodes'&&AE.NodeEditor)AE.NodeEditor.render();
  },
  buildBottomActions(id){
    const a=el('bottomActions');
    a.innerHTML='<input type="text" id="baTime" title="当前时间 (秒)" value="'+AE.state.t.toFixed(3)+'" style="background:#0c0e12;border:1px solid #2c323d;border-radius:4px;padding:3px 6px;width:78px;font-family:var(--mono);font-size:10px;color:#4fd1c5;outline:none">'+
      '<span>'+(id==='timeline'?'帧 '+Math.round(AE.state.t*comp().fps)+' / '+Math.round(comp().duration*comp().fps):(id==='curve'?'值 / 速度':'节点 '+((app.project.nodeGraph&&app.project.nodeGraph.nodes||[]).length)))+'</span>'+
      '<span class="ba" id="baSave">保存</span>';
    const ti=a.querySelector('#baTime');ti.onkeydown=e=>e.stopPropagation();
    ti.onchange=()=>{const v=parseFloat(ti.value);if(isFinite(v))app.setTime(v);else this.refreshTime();};
    a.querySelector('#baSave').onclick=()=>this.saveProject();
  },
  buildViewControls(){
    const vs=el('viewSelect');vs.value=AE.state.view||'persp';vs.onchange=()=>this.setView(vs.value);
    const zs=el('zoomSelect');zs.onchange=()=>{
      const v=zs.value;AE.state.zoom=v==='fit'?1:parseFloat(v);AE.state.panX=0;AE.state.panY=0;app.render();
      if(AE.CanvasFX)AE.CanvasFX.updateFrame(app.frame);
    };
    const tg=el('toggleGrid'),to=el('toggleOverlay'),tm=el('toggleMotion');
    tg.classList.toggle('active',AE.state.grid);to.classList.toggle('active',AE.state.overlay);tm.classList.toggle('active',AE.state.motionPath);
    tg.onclick=()=>{AE.state.grid=!AE.state.grid;tg.classList.toggle('active',AE.state.grid);el('guideChk').checked=AE.state.grid;if(AE.CanvasFX)AE.CanvasFX.updateFrame(app.frame);};
    to.onclick=()=>{AE.state.overlay=!AE.state.overlay;to.classList.toggle('active',AE.state.overlay);if(AE.CanvasFX)AE.CanvasFX.updateFrame(app.frame);};
    tm.onclick=()=>{AE.state.motionPath=!AE.state.motionPath;tm.classList.toggle('active',AE.state.motionPath);if(AE.CanvasFX)AE.CanvasFX.updateFrame(app.frame);};
  },
  setView(v){
    AE.state.view=v;
    const D=Math.max(1400,comp().H*1.75),P=(x)=>AE.makeProp(x);
    if(v==='persp')AE.state.cameraOverride=null;
    else {
      const cfg={front:[0,0],top:[0,80],left:[-80,0],custom:[26,16]}[v]||[0,0];
      AE.state.cameraOverride={props:{camDist:P(D),camYaw:P(cfg[0]),camPitch:P(cfg[1]),camFocus:P(D),camAperture:P(0),position:P([0,0,0])}};
    }
    el('viewSelect').value=v;app.render();
    if(AE.CanvasFX)AE.CanvasFX.updateFrame(app.frame);
  },

  /* ---------------- project panel ---------------- */
  buildProject(){
    const box=el('projectBody');box.innerHTML='';
    box.appendChild(h('<div class="pt-group">合成 ('+app.project.comps.length+')</div>'));
    app.project.comps.forEach(c=>{
      const r=h('<div class="pt-row comp'+(c.id===app.project.activeCompId?' on':'')+'"><span class="ic">▣</span><span style="overflow:hidden;text-overflow:ellipsis">'+esc(c.name)+'</span><span class="meta">'+c.W+'×'+c.H+'</span></div>');
      r.onclick=()=>{app.project.activeCompId=c.id;app.comp=app.activeComp();AE.state.activeCompId=c.id;AE.state.selection=[];this.refresh();app.render();};
      r.ondblclick=()=>this.compSettings(c);
      box.appendChild(r);
    });
    const acts=el('projActions');acts.innerHTML='<span class="pa" id="paNew" title="新建合成">＋</span><span class="pa" id="paSave" title="保存工程">⤓</span>';
    acts.querySelector('#paNew').onclick=()=>this.newComp();
    acts.querySelector('#paSave').onclick=()=>this.saveProject();
    const a=el('infoBody');a.innerHTML='';
    a.appendChild(h('<div class="pt-group" style="padding:4px 10px">资源</div>'));
    app.project.assets.fonts.forEach(f=>a.appendChild(h('<div class="asset-chip">▤ '+esc(f)+'</div>')));
    a.appendChild(h('<div class="info-sec">字体支持</div>'));
    a.appendChild(h('<div class="info-line"><span>中文 / 拉丁</span><b>✓</b></div>'));
    a.appendChild(h('<div class="info-line"><span>字形轮廓 → 几何</span><b>✓</b></div>'));
    a.appendChild(h('<div class="info-sec">图层图例</div>'));
    [['形状','#4fd1c5'],['文字','#7c8cff'],['三维','#f7b955'],['粒子','#ff6b9d'],['相机 / 光','#eef3f8']].forEach(([n,cc])=>{
      a.appendChild(h('<div class="legend-row"><span class="legend-dot" style="background:'+cc+'"></span>'+n+'</div>'));
    });
  },
  compSettings(c){
    const mask=h('<div class="modal-mask"><div class="modal"><div class="mh">合成设置<span class="close">×</span></div><div class="mc">'+
      '<div class="form-row"><label>名称</label><input id="csName" value="'+esc(c.name)+'"></div>'+
      '<div class="form-row"><label>宽度 / 高度</label><input id="csW" type="number" value="'+c.W+'"><input id="csH" type="number" value="'+c.H+'"></div>'+
      '<div class="form-row"><label>帧率</label><input id="csFps" type="number" value="'+c.fps+'"></div>'+
      '<div class="form-row"><label>时长 (秒)</label><input id="csDur" type="number" step="0.1" value="'+c.duration+'"></div>'+
      '<div class="form-row"><label>工作区入 / 出</label><input id="csWi" type="number" step="0.1" value="'+c.workIn+'"><input id="csWo" type="number" step="0.1" value="'+c.workOut+'"></div>'+
      '<p style="color:#646e7d">关键帧按秒保存，改变帧率后时刻不变。</p></div>'+
      '<div class="mf"><button class="btn" id="csCancel">取消</button><button class="btn primary" id="csOk">确定</button></div></div></div>');
    document.body.appendChild(mask);
    const close=()=>mask.remove();
    mask.querySelector('.close').onclick=close;mask.querySelector('#csCancel').onclick=close;
    mask.querySelector('#csOk').onclick=()=>{
      c.name=mask.querySelector('#csName').value||c.name;
      c.W=parseInt(mask.querySelector('#csW').value)||c.W;c.H=parseInt(mask.querySelector('#csH').value)||c.H;
      c.fps=clamp(parseInt(mask.querySelector('#csFps').value)||c.fps,1,120);
      c.duration=clamp(parseFloat(mask.querySelector('#csDur').value)||c.duration,1,300);
      c.workIn=clamp(parseFloat(mask.querySelector('#csWi').value)||0,0,c.duration);
      c.workOut=clamp(parseFloat(mask.querySelector('#csWo').value)||c.duration,c.workIn,c.duration);
      AE.state.fps=c.fps;el('fpsBadge').textContent=c.fps+' fps';
      app.commit('合成设置');close();this.refresh();app.render();
    };
  },
  newComp(){
    const c=AE.newComp({name:'合成 '+(app.project.comps.length+1),W:comp().W,H:comp().H,fps:comp().fps,duration:comp().duration});
    const bg=AE.newLayer('bg','背景',{},{color:'#1b6f8a'});bg.data={kind:'gradient',c0:AE.hex('#121a2c'),c1:AE.hex('#05070d'),glows:[]};
    c.layers=[bg];app.project.comps.push(c);app.project.activeCompId=c.id;app.comp=c;
    app.commit('新建合成');this.refresh();app.render();
  },

  /* ---------------- context menus ---------------- */
  context(items,x,y){
    const cm=el('contextMenu');cm.innerHTML='';
    items.forEach(it=>{
      if(it[0]==='-'){cm.appendChild(h('<div class="cm-sep"></div>'));return;}
      const d=h('<div class="cm'+(it[2]?' dim':'')+'">'+it[0]+'<span class="kc">'+(it[1]||'')+'</span></div>');
      d.onclick=()=>{cm.style.display='none';if(it[3])it[3]();};
      cm.appendChild(d);
    });
    cm.style.display='block';cm.style.left=Math.min(x,window.innerWidth-200)+'px';cm.style.top=Math.min(y,window.innerHeight-300)+'px';
    const close=()=>{cm.style.display='none';document.removeEventListener('click',close);};
    setTimeout(()=>document.addEventListener('click',close),0);
  },
  layerContextMenu(e,L){
    e.preventDefault();
    const sel=AE.state.selection;if(sel.indexOf(L.id)<0)AE.state.selection=[L.id];
    this.context([
      ['重命名','',false,()=>AE.Timeline.rename(L)],
      ['复制图层','Ctrl+D',false,()=>this.duplicateLayers()],
      ['删除图层','Delete',false,()=>this.deleteLayers()],
      ['-'],
      ['预合成','Ctrl+Shift+C',false,()=>this.precompose()],
      ['展开 / 折叠属性','',false,()=>{L._open=!L._open;AE.Timeline.build();}],
      ['选中全部关键帧','Ctrl+Alt+A',false,()=>this.selectAllKeys()],
      ['-'],
      ['显示 / 隐藏','',false,()=>{L.enabled=!L.enabled;app.commit('显示');this.refresh();app.render();}],
      ['锁定 / 解锁','',false,()=>{L.locked=!L.locked;app.commit('锁定');this.refresh();}]
    ],e.clientX,e.clientY);
  },
  keyframeContextMenu(e,keys){
    this.context([
      ['线性插值','',false,()=>AE.Timeline.setInterp('linear')],
      ['贝塞尔插值','',false,()=>AE.Timeline.setInterp('bezier')],
      ['定格插值','',false,()=>AE.Timeline.setInterp('hold')],
      ['-'],
      ['缓入缓出','F9',false,()=>AE.Timeline.setEase('ease')],
      ['缓入','',false,()=>AE.Timeline.setEase('easeIn')],
      ['缓出','',false,()=>AE.Timeline.setEase('easeOut')],
      ['线性','',false,()=>AE.Timeline.setEase('linear')],
      ['-'],
      ['复制关键帧','Ctrl+C',false,()=>AE.Timeline.copyKeys()],
      ['删除关键帧','Delete',false,()=>AE.Timeline.deleteKeys()],
      ['按比例拉伸时间','',false,()=>this.stretchKeys()],
      ['-'],
      ['选中 '+keys.length+' 个关键帧','',true,()=>{}]
    ],e.clientX,e.clientY);
  },
  nodeContextMenu(e,id){
    this.context([
      ['复制节点','',false,()=>AE.NodeEditor.duplicate()],
      ['删除节点','',false,()=>AE.NodeEditor.removeSel()],
      ['封装为节点组','',false,()=>AE.NodeEditor.groupSel()],
      ['-'],
      ['新建路径输入','',false,()=>AE.NodeEditor.addNode('pathInput')],
      ['新建噪声场','',false,()=>AE.NodeEditor.addNode('noise')],
      ['新建发射器','',false,()=>AE.NodeEditor.addNode('emitter')]
    ],e.clientX,e.clientY);
  },
  stretchKeys(){
    const s=AE.Timeline.selKeys();if(s.length<2){AE.toast('需要至少两个关键帧','warn');return;}
    const f=parseFloat(prompt('时间拉伸比例（例如 2 = 放慢一倍）','1.5'))||1;
    const t0=Math.min(...s.map(x=>x.k.t));
    for(const it of s){it.k.t=t0+(it.k.t-t0)*f;it.p.k.sort((a,b)=>a.t-b.t);}
    AE.state.kfSel=s.map(x=>({lid:x.lid,prop:x.prop,t:x.k.t}));
    app.commit('拉伸关键帧时间');this.refresh();app.render();
  },

  /* ---------------- layer commands ---------------- */
  duplicateLayers(){
    const c=comp(),sel=AE.state.selection.slice();if(!sel.length)return;
    const copies=[];
    for(const id of sel){
      const L=c.layers.find(x=>x.id===id);if(!L)continue;
      const n=AE.clone(L);n.id=AE.uid('lyr');n.name=L.name+' 副本';n._sel=false;n._open=false;
      const i=c.layers.indexOf(L);c.layers.splice(i,0,n);copies.push(n.id);
    }
    AE.state.selection=copies;app.commit('复制图层');this.refresh();app.render();
  },
  deleteLayers(){
    const c=comp(),sel=AE.state.selection.slice();if(!sel.length)return;
    c.layers=c.layers.filter(x=>sel.indexOf(x.id)<0);
    c.layers.forEach(l=>{if(sel.indexOf(l.parentId)>=0)l.parentId=null;});
    AE.state.selection=[];app.commit('删除图层');this.refresh();app.render();
  },
  precompose(){
    const c=comp(),sel=AE.state.selection.slice();if(!sel.length){AE.toast('先选择要预合成的图层','warn');return;}
    const chosen=c.layers.filter(l=>sel.indexOf(l.id)>=0);
    const nc=AE.newComp({name:'预合成 '+app.project.comps.length,W:c.W,H:c.H,fps:c.fps,duration:c.duration,
      bg:[0,0,0,0],workIn:c.workIn,workOut:c.workOut});
    nc.layers=chosen.map(l=>AE.clone(l));
    app.project.comps.push(nc);
    const firstIdx=c.layers.indexOf(chosen[0]);
    c.layers=c.layers.filter(l=>sel.indexOf(l.id)<0);
    const pc=AE.newLayer('precomp','预合成 '+nc.name,{},{color:'#7c8cff'});
    pc.data={compId:nc.id,start:0,spatialMode:'flat',timeMap:{type:'normal',speed:1}};
    pc.inPoint=0;pc.outPoint=c.duration;
    c.layers.splice(Math.min(firstIdx,c.layers.length),0,pc);
    AE.state.selection=[pc.id];app.commit('预合成');this.refresh();app.render();
  },
  newLayer(type){
    const c=comp(),L=AE.newLayer(type,({shape:'形状图层',text:'文字图层',null:'空对象',adjustment:'调整层',camera:'摄像机',light:'灯光',field:'空间场'})[type]||type);
    if(type==='text')L.data={str:'新文字',size:80,align:'center',color:AE.hex('#eef3f8'),hud:true};
    if(type==='shape')L.data={shape:{kind:'ellipse',rx:160,ry:160,res:48},fill:AE.hex('#4fd1c5',0.9),stroke:null};
    if(type==='adjustment')L.data={post:{bloom:0.5}};
    if(type==='field')L.data={kind:'vortex',radius:400,strength:1,seed:5,visible:true};
    if(type==='camera')for(const k of ['camDist','camYaw','camPitch','camFocus','camAperture'])L.props[k]=AE.makeProp(k==='camDist'?1600:(k==='camFocus'?1600:0));
    if(type==='light'){L.data={type:'point',color:AE.hex('#ffffff'),intensity:1.5};L.props.lightInt=AE.makeProp(1.5);}
    L.inPoint=0;L.outPoint=c.duration;
    c.layers.unshift(L);AE.state.selection=[L.id];AE.state.kfSel=[];
    app.commit('新建图层');this.refresh();app.render();AE.toast('已新建 '+L.name);
  },
  addEffect(type){
    const L=comp().layers.find(x=>x.id===AE.state.selection[0]);if(!L){AE.toast('先选择一个图层','warn');return;}
    L.effects=L.effects||[];L.effects.push({type,name:({glow:'发光',blur:'高斯模糊',dropShadow:'投影',hueSat:'色相 / 饱和度'})[type],params:{}});
    app.commit('添加效果');this.refresh();
  },
  selectAllLayers(){AE.state.selection=comp().layers.map(l=>l.id);this.refresh();},
  selectAllKeys(){
    AE.state.kfSel=[];
    const ids=AE.state.selection.length?AE.state.selection:comp().layers.map(l=>l.id);
    for(const L of comp().layers)if(ids.indexOf(L.id)>=0)for(const k in (L.props||{})){const p=L.props[k];if(p&&p.k)for(const key of p.k)AE.state.kfSel.push({lid:L.id,prop:k,t:key.t});}
    if(AE.Timeline)AE.Timeline.build();AE.toast('已选中 '+AE.state.kfSel.length+' 个关键帧');
  },

  /* ---------------- project IO ---------------- */
  saveProject(){
    try{
      const data=AE.serialize(app.project);
      const blob=new Blob([data],{type:'application/json'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='PRISMA_工程.json';a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),2000);
      try{localStorage.setItem('prisma_project',data);}catch(e){}
      this.flashSave();AE.toast('工程已保存');
    }catch(e){AE.toast('保存失败：'+e.message,'err');}
  },
  openProject(){el('fileInput').click();},
  loadProjectText(txt){
    try{
      const p=AE.deserialize(txt);
      if(!p||!p.comps||!p.comps.length)throw new Error('文件不是有效工程');
      app.project=p;app.comp=app.activeComp();AE.state.activeCompId=p.activeCompId||p.comps[0].id;
      AE.state.selection=[];AE.state.t=0;AE.state.fps=app.comp.fps;AE.state.kfSel=[];
      app.history.reset(AE.serialize(app.project));
      el('fpsBadge').textContent=AE.state.fps+' fps';
      ['wsTimeline','wsCurve','wsNodes'].forEach(id=>{const e=el(id);if(e)e.dataset.mounted='';});
      this.setBottom(AE.state.bottomWS||'timeline');
      this.refresh();app.render();AE.toast('工程已打开');
    }catch(e){AE.toast('打开失败：'+e.message,'err');}
  },
  autosaveLoad(){
    el('fileInput').onchange=(e)=>{
      const f=e.target.files[0];if(!f)return;const r=new FileReader();
      r.onload=()=>this.loadProjectText(r.result);r.readAsText(f);e.target.value='';
    };
  },
  flashSave(){const l=el('autosaveLabel');l.classList.add('flash');l.textContent='● 已保存';setTimeout(()=>{l.classList.remove('flash');l.textContent='● 已自动保存';},1500);},

  /* ---------------- shortcuts / help ---------------- */
  bindGlobal(){
    document.addEventListener('keydown',(e)=>{
      const tag=(e.target.tagName||'').toLowerCase();
      if(tag==='input'||tag==='textarea'||tag==='select'||e.target.isContentEditable)return;
      const k=e.key.toLowerCase(),ctrl=e.ctrlKey||e.metaKey,shift=e.shiftKey,alt=e.altKey;
      if(e.code==='Space'){e.preventDefault();this.transport('播放');return;}
      if(ctrl&&alt&&k==='a'){e.preventDefault();this.selectAllKeys();return;}
      if(ctrl&&shift&&k==='c'){e.preventDefault();this.precompose();return;}
      if(ctrl&&shift&&k==='z'){e.preventDefault();app.redo();return;}
      if(ctrl&&k==='a'){e.preventDefault();this.selectAllLayers();return;}
      if(ctrl&&k==='d'){e.preventDefault();this.duplicateLayers();return;}
      if(ctrl&&k==='c'){e.preventDefault();AE.Timeline.copyKeys();return;}
      if(ctrl&&k==='v'){e.preventDefault();AE.Timeline.pasteKeys();return;}
      if(ctrl&&k==='z'){e.preventDefault();app.undo();return;}
      if(ctrl&&k==='y'){e.preventDefault();app.redo();return;}
      if(ctrl&&k==='s'){e.preventDefault();this.saveProject();return;}
      if(ctrl&&k==='o'){e.preventDefault();this.openProject();return;}
      if(ctrl&&k==='n'){e.preventDefault();if(confirm('新建空工程？当前未保存的修改会丢失。'))this.blankProject();return;}
      if(e.key==='F9'){e.preventDefault();AE.Timeline.setEase('ease');AE.toast('缓入缓出（两侧速度为零）');return;}
      if(e.key==='?'){this.showShortcuts();return;}
      if(e.key==='ArrowLeft'){e.preventDefault();this.transport('上一帧');return;}
      if(e.key==='ArrowRight'){e.preventDefault();this.transport('下一帧');return;}
      if(e.key==='Home'){this.transport('首帧');return;}
      if(e.key==='End'){this.transport('末帧');return;}
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();if(AE.state.kfSel.length)AE.Timeline.deleteKeys();else this.deleteLayers();return;}
      if(k==='j'||k==='k'){AE.Timeline.jumpKey(k==='k'?-1:1);return;}
      if(k==='m'){comp().markers.push({t:AE.state.t,label:'标记',color:'#f7b955'});app.commit('添加标记');this.refresh();return;}
      if(k==='v'){AE.state.tool='select';document.querySelectorAll('.tool').forEach(x=>x.classList.toggle('on',x.dataset.tool==='select'));return;}
      if(k==='t'){this.newLayer('text');return;}
      if(e.key==='+'||e.key==='='){AE.state.zoom=clamp(AE.state.zoom*1.2,0.12,6);app.render();return;}
      if(e.key==='-'){AE.state.zoom=clamp(AE.state.zoom/1.2,0.12,6);app.render();return;}
    });
  },
  blankProject(){
    const c=AE.newComp({name:'合成 1',W:1600,H:900,fps:30,duration:15,bg:[0.04,0.05,0.07,1]});
    const bg=AE.newLayer('bg','背景',{},{color:'#1b6f8a'});bg.data={kind:'gradient',c0:AE.hex('#121a2c'),c1:AE.hex('#05070d'),glows:[]};
    c.layers=[bg];app.project=AE.newProject({name:'未命名工程',comps:[c],activeCompId:c.id});
    app.comp=c;AE.state.selection=[];AE.state.t=0;app.history.reset(AE.serialize(app.project));
    ['wsTimeline','wsCurve','wsNodes'].forEach(id=>{const e=el(id);if(e)e.dataset.mounted='';});
    this.setBottom('timeline');this.refresh();app.render();AE.toast('已新建空工程');
  },
  showShortcuts(){
    const mask=h('<div class="modal-mask"><div class="modal"><div class="mh">快捷键与帮助<span class="close">×</span></div><div class="mc">'+
      '<div class="kbd-grid"><div><h4>播放 / 时间</h4>'+
      [['播放 / 暂停','空格'],['逐帧前进 / 后退','← →'],['跳到上 / 下一关键帧','K / J'],['到首帧 / 末帧','Home / End'],['添加标记','M'],['输入时间','时间码 / 底部输入']].map(r=>'<div class="kbd-row"><span>'+r[0]+'</span><kbd>'+r[1]+'</kbd></div>').join('')+
      '<h4 style="margin-top:14px">画布</h4>'+
      [['选择工具','V'],['滚轮缩放','滚轮'],['平移','空格拖动 / 抓手'],['三维轴向拖动','轴向手柄'],['移动锚点','锚点手柄']].map(r=>'<div class="kbd-row"><span>'+r[0]+'</span><kbd>'+r[1]+'</kbd></div>').join('')+
      '</div><div><h4>编辑</h4>'+
      [['缓入缓出','F9'],['全选','Ctrl+A'],['全选关键帧','Ctrl+Alt+A'],['复制图层','Ctrl+D'],['预合成','Ctrl+Shift+C'],['复制 / 粘贴关键帧','Ctrl+C / V'],['撤销 / 重做','Ctrl+Z / Y'],['删除','Delete'],['文字图层','T'],['帮助','?'],['保存 / 打开','Ctrl+S / O']].map(r=>'<div class="kbd-row"><span>'+r[0]+'</span><kbd>'+r[1]+'</kbd></div>').join('')+
      '<h4 style="margin-top:14px">工作区</h4>'+
      [['时间轴 / 曲线 / 节点','底部标签'],['标准 / 动效 / 节点','右上角'],['前 / 顶 / 侧视图','视图下拉']].map(r=>'<div class="kbd-row"><span>'+r[0]+'</span><kbd>'+r[1]+'</kbd></div>').join('')+
      '</div></div><p style="color:#646e7d;margin-top:16px;line-height:1.8">文字或表达式输入时，编辑器快捷键与浏览器快捷键不会抢占输入。<br>关键帧按秒保存，改变合成帧率后时刻不变。表达式支持 time / value / wiggle / loopOut / linear / ease / 跨图层引用 / valueAtTime / toWorld / fromWorld，循环或错误会提示并退回关键帧值。</p></div>'+
      '<div class="mf"><button class="btn primary" id="shClose">知道了</button></div></div></div>');
    document.body.appendChild(mask);
    const close=()=>mask.remove();
    mask.querySelector('.close').onclick=close;mask.querySelector('#shClose').onclick=close;
    mask.onclick=(e)=>{if(e.target===mask)close();};
  },
  command(n){
    switch(n){
      case '快捷键':case '关于 PRISMA':this.showShortcuts();break;
      case '新建工程':this.blankProject();break;
      case '打开工程…':this.openProject();break;
      case '保存工程':this.saveProject();break;
      case '导出图像序列…':case '导出视频…':case '工作区导出':case '工作区导出…':this.openExport();break;
      case '撤销':app.undo();break;
      case '重做':app.redo();break;
      case '复制':this.duplicateLayers();break;
      case '删除':if(AE.state.kfSel.length)AE.Timeline.deleteKeys();else this.deleteLayers();break;
      case '全选':this.selectAllLayers();break;
      case '全选关键帧':this.selectAllKeys();break;
      case '预合成':this.precompose();break;
      case '复制关键帧':AE.Timeline.copyKeys();break;
      case '粘贴关键帧':AE.Timeline.pasteKeys();break;
      case '缓入缓出':AE.Timeline.setEase('ease');break;
      case '合成设置…':this.compSettings(comp());break;
      case '新建合成':this.newComp();break;
      case '添加标记':comp().markers.push({t:AE.state.t,label:'标记',color:'#f7b955'});app.commit('添加标记');this.refresh();break;
      case '新建形状层':this.newLayer('shape');break;
      case '新建文字层':this.newLayer('text');break;
      case '新建空对象':this.newLayer('null');break;
      case '新建调整层':this.newLayer('adjustment');break;
      case '新建摄像机':this.newLayer('camera');break;
      case '新建灯光':this.newLayer('light');break;
      case '添加空间场':this.newLayer('field');break;
      case '高斯模糊':this.addEffect('blur');break;
      case '发光':this.addEffect('glow');break;
      case '投影':this.addEffect('dropShadow');break;
      case '色相 / 饱和度':this.addEffect('hueSat');break;
      case '适配画布':AE.state.zoom=1;AE.state.panX=0;AE.state.panY=0;el('zoomSelect').value='fit';app.render();break;
      case '放大':AE.state.zoom=clamp(AE.state.zoom*1.2,0.12,6);app.render();break;
      case '缩小':AE.state.zoom=clamp(AE.state.zoom/1.2,0.12,6);app.render();break;
      case '前视图':this.setView('front');break;
      case '顶视图':this.setView('top');break;
      case '左视图':this.setView('left');break;
      case '透视 / 活动相机':this.setView('persp');break;
      case '时间轴':this.setBottom('timeline');break;
      case '曲线编辑器':this.setBottom('curve');break;
      case '节点编辑器':this.setBottom('nodes');break;
      case '属性':this.setRightTab('props');break;
      case '效果':this.setRightTab('fx');break;
      case '信息':this.setRightTab('info');break;
      case '上移一层':this.reorder(-1);break;
      case '下移一层':this.reorder(1);break;
      default:AE.toast(n+'（可用）');
    }
  },
  reorder(dir){
    const c=comp(),id=AE.state.selection[0];if(!id)return;
    const i=c.layers.findIndex(l=>l.id===id),j=i+dir;
    if(j<0||j>=c.layers.length)return;
    [c.layers[i],c.layers[j]]=[c.layers[j],c.layers[i]];
    app.commit('图层排序');this.refresh();app.render();
  },
  openExport(){
    if(AE.workspaceExport)AE.workspaceExport(app,{}).then(r=>AE.toast(r.cancelled?'导出已取消':'导出完成：'+r.frames+' 帧'));
  },
  openExportModal(appRef,opt){
    const mask=h('<div class="modal-mask"><div class="modal"><div class="mh">导出工作区<span class="close">×</span></div>'+
      '<div class="mc"><div class="form-row"><label>范围</label><span>'+opt.range[0].toFixed(2)+'s – '+opt.range[1].toFixed(2)+'s</span></div>'+
      '<div class="form-row"><label>帧率 / 帧数</label><span>'+opt.fps+' fps / '+opt.total+' 帧 · '+comp().W+'×'+comp().H+'</span></div>'+
      '<div class="progress-track"><div class="progress-fill" id="expFill"></div></div><div id="expTxt" style="font-family:var(--mono);color:#4fd1c5">准备中…</div>'+
      '<p style="color:#646e7d;margin-top:10px">按工程时间逐帧取样，与同刻预览一致；不受画布缩放、窗口大小或后台状态影响。</p></div>'+
      '<div class="mf"><button class="btn" id="expCancel">取消</button></div></div></div>');
    document.body.appendChild(mask);
    const o={onProgress:(i,t)=>{const f=mask.querySelector('#expFill');if(f)f.style.width=(i/t*100)+'%';
      const tx=mask.querySelector('#expTxt');if(tx)tx.textContent='正在取样 '+i+' / '+t;},close:()=>mask.remove()};
    mask.querySelector('#expCancel').onclick=()=>{opt.onCancel&&opt.onCancel();o.close();};
    mask.querySelector('.close').onclick=()=>{opt.onCancel&&opt.onCancel();o.close();};
    return o;
  },
  bindSplitters(){
    document.querySelectorAll('.splitter').forEach(sp=>{
      sp.addEventListener('pointerdown',(e)=>{
        const horiz=sp.classList.contains('horizontal'),side=sp.dataset.split;
        const start=horiz?e.clientY:e.clientX;
        const L=el('left'),R=el('right'),B=el('bottom');
        const lw=L.offsetWidth,rw=R.offsetWidth,bh=B.offsetHeight;
        const move=(ev)=>{
          if(horiz){const nh=clamp(bh+start-ev.clientY,120,window.innerHeight*0.7);
            document.getElementById('app').style.gridTemplateRows='38px 34px 1fr 5px '+nh+'px 22px';
            if(AE.CurveEditor)AE.CurveEditor.resize();}
          else if(side==='left')L.style.width=clamp(lw+(ev.clientX-start),160,420)+'px';
          else R.style.width=clamp(rw-(ev.clientX-start),210,480)+'px';
          app.render();
        };
        const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};
        window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
      });
    });
  },

  /* ---------------- refresh pipeline ---------------- */
  refresh(){
    if(!app||!app.project)return;
    this.buildCompTabs();this.buildProject();
    if(AE.Timeline&&el('wsTimeline')&&el('wsTimeline').dataset.mounted)AE.Timeline.refresh();
    if(AE.CurveEditor&&el('wsCurve')&&el('wsCurve').dataset.mounted)AE.CurveEditor.refresh();
    if(AE.NodeEditor&&el('wsNodes')&&el('wsNodes').dataset.mounted)AE.NodeEditor.refresh();
    if(AE.Props)AE.Props.refresh();
    this.refreshTime();
  },
  refreshTime(){
    if(!app||!app.project)return;
    const t=AE.state.t,fps=AE.state.fps,c=comp();
    const f=Math.round(t*fps),hh=String(Math.floor(t/3600)).padStart(2,'0'),
      mm=String(Math.floor(t/60)%60).padStart(2,'0'),ss=String(Math.floor(t)%60).padStart(2,'0'),
      ff=String(f%fps).padStart(2,'0');
    el('timeCode').textContent=hh+':'+mm+':'+ss+':'+ff;
    el('tcSub').textContent=t.toFixed(3)+' s · 帧 '+f;
    el('stTime').textContent='t = '+t.toFixed(3)+'s';
    el('stActive').textContent='活动合成：'+c.name;
    const sel=AE.state.selection||[];
    el('stSel').textContent=sel.length?(sel.length===1?('已选：'+((c.layers.find(l=>l.id===sel[0])||{}).name||'—')):('已选 '+sel.length+' 个图层')):'未选择';
    const camL=c.layers.find(l=>l.type==='camera'&&l.enabled);
    el('stCam').textContent='相机：'+(AE.state.view&&AE.state.view!=='persp'?({front:'前视图',top:'顶视图',left:'左视图',custom:'自定义视图'})[AE.state.view]:(camL?camL.name:'默认'));
    el('stMode').textContent=({standard:'标准工作区',motion:'动效工作区',nodes:'节点工作区'})[AE.state.workspace||'standard'];
    const ba=el('baTime');if(ba&&document.activeElement!==ba)ba.value=t.toFixed(3);
    if(AE.Timeline&&el('wsTimeline')&&el('wsTimeline').dataset.mounted)AE.Timeline.refreshTime();
    if(AE.CurveEditor&&el('wsCurve')&&el('wsCurve').dataset.mounted&&AE.state.bottomWS==='curve')AE.CurveEditor.refreshTime();
    if(AE.Props)AE.Props.refreshTime();
    if(AE.CanvasFX)AE.CanvasFX.updateFrame(app.frame);
  },
  updateFrame(frame){
    if(AE.CanvasFX&&AE.state.overlay)AE.CanvasFX.updateFrame(frame);
    if(AE.state.bottomWS==='curve'&&AE.CurveEditor&&el('wsCurve')&&el('wsCurve').dataset.mounted)AE.CurveEditor.updateFrame(frame);
    if(AE.state.bottomWS==='nodes'&&AE.NodeEditor&&el('wsNodes')&&el('wsNodes').dataset.mounted)AE.NodeEditor.updateFrame(frame);
    if(AE.Props)AE.Props.updateFrame(frame);
  }
};

AE.toast=(msg,kind)=>{
  const box=el('toastRoot');if(!box)return;
  const t=h('<div class="toast '+(kind||'')+'">'+esc(msg)+'</div>');
  box.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),320);},2200);
};
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
})(window.AE);
