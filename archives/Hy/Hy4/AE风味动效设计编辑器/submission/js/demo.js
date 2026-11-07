/* =========================================================================
   demo.js — the 15s default project, built entirely from the editor's own
   layer / keyframe / expression / node / material / simulation mechanisms.
   ========================================================================= */
(function(AE){
'use strict';
const C=(h,a)=>AE.hex(h,a===undefined?1:a);

function K(t,v,eout,ease,ho){return {t,v:eout==='hold'?(v):v,eout:eout||'bezier',ein:'bezier',
  ease:ease||'ease',ho:ho||[0.42,0],hi:[-0.42,0]};}
function keys(p,arr){p.k=arr.map(a=>K(a[0],a[1],a[2],a[3],a[4]));p.id=p.id||'k';}
function prop(L,key,def,arr,expr,em){
  const p=AE.makeProp(def);p.id=key;
  if(arr)keys(p,arr);
  if(expr){p.e=expr;p.em=em||'replace';}
  L.props[key]=p;return p;
}
function std(L,key,def,arr,expr,em){
  const p=L.props[key]||AE.makeProp(def);p.n=def;p.id=key;
  if(arr)keys(p,arr);
  if(expr){p.e=expr;p.em=em||'replace';}
  L.props[key]=p;return p;
}
function mk(type,name,data,extra){
  const L=AE.newLayer(type,name,extra||{});
  L.data=data||{};
  return L;
}

const T={
  cyan:'#4fd1c5',indigo:'#7c8cff',gold:'#f7b955',pink:'#ff6b9d',
  white:'#eef3f8',deep:'#0b0e16',violet:'#a98bff',amber:'#ffb86b',green:'#8ce99a'
};

/* ------------------------------------------------------------------ inner comps */
function coreComp(){
  const c=AE.newComp({name:'内部 · 核心',W:640,H:640,fps:30,duration:15,
    bg:[0,0,0,0],workIn:0,workOut:15});
  const shape=mk('shape','核心轮廓',{
    shape:{kind:'star',n:6,r1:150,r2:64,res:72,
      morph:[{t:0,kind:'star',n:6,r1:150,r2:64},{t:5,kind:'gear',n:9,ro:160,ri:118},{t:10,kind:'star',n:6,r1:150,r2:64}]},
    fill:C(T.cyan,0.16),stroke:C(T.cyan,0.9),strokeW:2,
    trim:{start:0,end:1},repeater:{copies:3,rotStep:20,scale:0.82}
  });
  std(shape,'rotation',0,[[0,0],[15,120,'linear']]);
  c.layers=[shape];
  return c;
}
function unitComp(){
  const c=AE.newComp({name:'内部 · 晶格单元',W:640,H:640,fps:30,duration:15,
    bg:[0,0,0,0],workIn:0,workOut:15});
  const core=mk('precomp','核心引用',{compId:'__CORE__',start:0,timeMap:{type:'freeze',freezeAt:2.5}});
  std(core,'scale',[100,100,100],[[0,[60,60,100]],[15,[60,60,100]]]);
  std(core,'position',[0,0,0]);
  const ring=mk('shape','单元环',{
    shape:{kind:'ring',ro:230,ri:205,res:64},
    fill:C(T.gold,0.55),stroke:C(T.white,0.5),strokeW:1.5,
    trim:{start:0,end:1},repeater:{copies:2,rotStep:45,scale:0.7}
  });
  std(ring,'rotation',0,[[0,0],[15,-90,'linear']]);
  c.layers=[ring,core];
  return c;
}

/* ------------------------------------------------------------------ main comp */
AE.buildDemo=()=>{
  const project=AE.newProject({name:'PRISMA · 光的塑形',seed:7});
  const N=(id,type,x,y,title)=>({id,type,x,y,title});
  const LK=(a,ap,b,bp)=>({from:{n:a,p:ap},to:{n:b,p:bp}});
  project.nodeGraph={nodes:[
    N('n1','pathInput',40,60,'路径输入'),N('n2','textInput',40,240,'文字输入'),
    N('n3','distribute',300,50,'分布 / 重复'),N('n4','resample',300,240,'重采样'),
    N('n5','noise',300,420,'噪声'),N('n6','falloff',40,430,'距离 / 衰减'),
    N('n7','mix',560,120,'混合'),N('n8','meshDeform',560,320,'网格变形'),
    N('n9','emitter',820,120,'发射器'),N('n10','collider',820,340,'碰撞体'),
    N('n11','output',1080,180,'输出'),N('n12','group',820,520,'节点组 · 晶格')
  ],links:[
    LK('n1',0,'n3',0),LK('n2',0,'n4',0),LK('n6',1,'n5',0),
    LK('n3',0,'n7',0),LK('n4',0,'n7',1),LK('n5',0,'n8',1),
    LK('n7',0,'n8',0),LK('n8',0,'n9',0),LK('n5',0,'n9',1),
    LK('n8',0,'n10',0),LK('n9',0,'n11',0),LK('n10',0,'n11',1),
    LK('n1',0,'n12',0),LK('n6',0,'n12',1)
  ]};
  const core=coreComp(),unit=unitComp();
  const comp=AE.newComp({name:'主合成 · PRISMA',W:1600,H:900,fps:30,duration:15,
    bg:[0.035,0.045,0.07,1],workIn:0,workOut:15});
  core.id='comp_core';unit.id='comp_unit';comp.id='comp_main';
  unit.layers[1].data.compId=core.id;
  project.comps=[comp,unit,core];
  project.activeCompId=comp.id;

  comp.markers=[
    {t:0,label:'序 · 起',color:T.cyan},
    {t:3.2,label:'形 · 承',color:T.indigo},
    {t:7.0,label:'光 · 转',color:T.gold},
    {t:11.2,label:'归 · 合',color:T.pink},
    {t:14.2,label:'定格',color:T.white}
  ];

  const L=[]; // build bottom->top? we push top-first, then reverse at the end
  const add=(l)=>{L.push(l);return l;};

  /* ---- controllers (bottom) ---- */
  const ctrl=mk('null','控制器 · 主控',{},{color:T.gold});
  prop(ctrl,'rotation',0,null,'time*18 + Math.sin(time*1.3)*9');
  add(ctrl);

  /* ---- background ---- */
  const bg=mk('bg','背景 · 暮光渐变',{
    kind:'gradient',c0:C('#121a2c'),c1:C('#05070d'),
    glows:[
      {x:340,y:260,w:1100,h:900,color:C('#1b6f8a',0.22)},
      {x:1280,y:680,w:1200,h:1000,color:C('#5b3aa0',0.18)},
      {x:800,y:420,w:1500,h:1100,color:C('#0d3550',0.12)}
    ]
  },{color:'#1b6f8a'});
  add(bg);

  /* ---- deep ambient shapes ---- */
  const ambient=mk('shape','环境 · 柔光碎片',{
    shape:{kind:'blob',seed:3,r:520,amp:0.35,res:72,
      morph:[{t:0,kind:'blob',seed:3,r:520,amp:0.35},{t:7,kind:'blob',seed:8,r:560,amp:0.5},{t:15,kind:'blob',seed:3,r:520,amp:0.35}]},
    fill:C(T.indigo,0.05),stroke:null,repeater:{copies:3,rotStep:120,scale:0.72,rot:0}
  },{color:T.indigo,blend:'screen'});
  std(ambient,'position',[0,0,0],null,'wiggle(0.35, 26)','add');
  std(ambient,'rotation',0,[[0,0],[15,40,'linear']]);
  add(ambient);

  /* ---- vortex + noise fields (affect grid, extrude, particles) ---- */
  const vortex=mk('field','空间场 · 旋涡',{kind:'vortex',radius:620,strength:1.15,seed:11,
    color:C(T.cyan,0.8),visible:true,mode:'swirl',nodeStrength:'n5:0'},{color:T.cyan});
  prop(vortex,'fieldRadius',620,[[0,0],[3,620],[7,900],[11,520],[15,520]]);
  prop(vortex,'fieldStrength',1.15,[[0,0.2],[6,1.3],[10,0.6],[15,0.2]]);
  std(vortex,'position',[-60,40,0],[[0,[-260,120,0]],[7,[0,-40,0]],[11,[180,60,0]],[15,[0,0,0]]]);
  add(vortex);

  const noisef=mk('field','空间场 · 湍流',{kind:'noise',radius:800,strength:0.7,seed:23,
    color:C(T.violet,0.7),visible:false},{color:T.violet});
  prop(noisef,'fieldStrength',0.7,[[0,0],[7,0.9],[12,0.2],[15,0]]);
  add(noisef);

  /* ---- deformable grid mesh with pins ---- */
  const grid=mk('grid','网格 · 可变形表面',{
    cols:26,rows:16,w:1500,h:820,color:C(T.cyan,0.0),
    fieldAmp:0.9,wireframe:true,wireColor:C(T.cyan,0.13),
    pins:[{x:-220,y:60,radius:230,rigidity:1,dx:0,dy:-90,dz:80},
          {x:280,y:-40,radius:260,rigidity:0.85,dx:60,dy:40,dz:120}]
  },{color:T.cyan,blend:'normal'});
  std(grid,'position',[0,260,0],[[0,[0,420,0]],[6,[0,260,0]],[11,[0,300,0]],[15,[0,300,0]]]);
  std(grid,'rotation',0,[[0,-8],[7,2],[15,0]]);
  std(grid,'scale',[100,100,100],[[0,[100,100,100]],[7,[115,115,100]],[15,[100,100,100]]]);
  add(grid);

  /* ---- SOURCE shape (feeds the extruded solid) ---- */
  const src=mk('shape','源路径 · 形态演化',{
    shape:{kind:'blob',seed:5,r:230,amp:0.28,res:80,
      morph:[{t:0,kind:'blob',seed:5,r:230,amp:0.28},{t:3.4,kind:'gear',n:11,ro:250,ri:196},
             {t:7,kind:'star',n:7,r1:270,r2:120},{t:11,kind:'ring',ro:250,ri:150},
             {t:15,kind:'blob',seed:5,r:230,amp:0.28}]},
    fill:C(T.cyan,0.05),stroke:C(T.cyan,0.55),strokeW:2,trim:{start:0,end:1},
    deformField:true,fieldAmp:0.35
  },{color:T.cyan});
  std(src,'position',[0,0,0],[[0,[0,0,0]],[15,[0,0,0]]]);
  std(src,'rotation',0,[[0,0],[15,40,'linear']]);
  add(src);

  /* ---- mandala: repeater + trim + boolean-like ring ---- */
  const mandala=mk('shape','程序图形 · 曼陀罗',{
    shape:{kind:'ring',ro:330,ri:318,res:64},
    fill:C(T.gold,0.0),stroke:C(T.gold,0.75),strokeW:3,
    trim:{start:0,end:1},repeater:{copies:10,rotStep:36,scale:0.9,rot:0},
    nodeRepeats:'n3:0'
  },{color:T.gold,blend:'add'});
  std(mandala,'rotation',0,null,'thisComp.layer("控制器 · 主控").transform.rotation * 0.55');
  prop(mandala,'trimStart',0,[[0,1],[2,0],[6,0],[10,0.15],[15,0.15]]);
  prop(mandala,'trimEnd',1,[[0,1],[2,1],[6,0.42],[10,0.5],[15,0.5]]);
  prop(mandala,'repeats',10,[[0,3],[4,10],[9,12],[15,10]]);
  std(mandala,'scale',[100,100,100],[[0,[40,40,100]],[3,[100,100,100]],[7,[135,135,100]],[11,[95,95,100]],[15,[90,90,100]]]);
  std(mandala,'opacity',100,[[0,32],[1.5,80],[6,70],[11,25],[15,0]]);
  add(mandala);

  /* ---- boolean path operations (union / difference / intersection, order swap) ---- */
  const boolShape=mk('shape','路径布尔 · 并 / 差 / 交',{
    shape:{res:72,boolean:{a:{kind:'star',n:7,r1:230,r2:128},b:{kind:'ellipse',rx:185,ry:185,res:48}}},
    fill:C(T.gold,0.045),stroke:C(T.gold,0.5),strokeW:2,trim:{start:0,end:1}
  },{color:T.gold,blend:'add'});
  prop(boolShape,'boolMode',0,[[0,0],[4.9,0,'hold'],[5,1,'hold'],[9.9,1,'hold'],[10,2,'hold'],[15,2,'hold']]);
  prop(boolShape,'boolReverse',0,[[0,0],[7.9,0,'hold'],[8,1,'hold'],[9.9,1,'hold'],[10,0,'hold'],[15,0,'hold']]);
  std(boolShape,'rotation',0,[[0,0],[15,80,'linear']]);
  std(boolShape,'scale',[100,100,100],[[0,[78,78,100]],[15,[78,78,100]]]);
  std(boolShape,'opacity',100,[[0,0],[3,0],[4,55],[11,50],[13,0],[15,0]]);
  add(boolShape);

  /* ---- HERO extruded solid (from source path) : chain 1 ---- */
  const hero=mk('extrude','实体 · 挤出核心',{
    sourceId:'__SRC__',depth:120,bevel:16,
    front:C('#8fb2dc'),side:C('#1b3054'),bev:C('#c6dcf6'),
    matFront:[0.55,0.38,0.0,0],matSide:[0.30,0.62,0.0,0],matBevel:[0.68,0.30,0.06,0],
    fieldAmp:0.18,bend:0,twist:0,castShadow:true,shadowSize:620,
    pins:[{x:0,y:0,radius:200,rigidity:0.4,dx:0,dy:0}]
  },{threeD:true,color:T.white});
  std(hero,'position',[0,-10,0],[[0,[0,-10,0]],[3,[0,-10,0]],[7,[0,-30,0]],[11,[0,0,0]],[13.5,[0,-120,0]],[15,[0,-125,0]]]);
  std(hero,'rotation',0,[[0,0],[15,0]]);
  std(hero,'yRot',0,[[0,-28],[3,10,'easeOut'],[7,120,'ease'],[11,300,'ease'],[14,352,'easeOut'],[15,360,'easeOut']]);
  std(hero,'xRot',0,[[0,-14],[7,8],[11,-18],[15,0]]);
  std(hero,'zRot',0,[[0,0],[7,18],[11,-6],[15,0]]);
  std(hero,'scale',[100,100,100],[[0,[45,45,100]],[2,[86,86,100]],[7,[112,112,100]],[11,[84,84,100]],[13.5,[46,46,100]],[15,[44,44,100]]]);
  std(hero,'opacity',100,[[0,55],[0.8,100],[11,100],[14,100],[15,100]]);
  prop(hero,'depth',120,[[0,40],[2,120],[7,160],[11,110],[15,110]]);
  prop(hero,'bevel',16,[[0,4],[2,16],[7,22],[15,16]]);
  prop(hero,'bend',0,[[0,0],[7,12],[11,-5],[15,0]]);
  prop(hero,'twist',0,[[0,0],[7,9],[11,-4],[15,0]]);
  add(hero);

  /* ---- parametric solids : torus + sphere ---- */
  const torus=mk('parametric','参数实体 · 圆环',{
    kind:'torus',R:300,r:34,seg:44,tseg:14,color:C('#e7b26a'),mat:[0.9,0.24,0.06,0]
  },{threeD:true,color:T.gold});
  std(torus,'position',[0,-10,0],[[0,[0,-10,0]],[15,[0,-10,0]]]);
  std(torus,'xRot',0,[[0,72],[7,26],[11,80],[15,72]]);
  std(torus,'yRot',0,[[0,0],[15,360,'linear']]);
  std(torus,'scale',[100,100,100],[[0,[40,40,100]],[4,[95,95,100]],[9,[110,110,100]],[13,[70,70,100]],[15,[70,70,100]]]);
  std(torus,'opacity',100,[[0,0],[2,0],[3.5,90],[11,80],[14,0],[15,0]]);
  add(torus);

  const orb=mk('parametric','参数实体 · 球体',{
    kind:'sphere',r:70,seg:20,color:C('#e089b4'),mat:[0.15,0.55,0.08,0]
  },{threeD:true,color:T.pink});
  std(orb,'position',[-360,-160,0],[[0,[-560,-260,0]],[7,[-360,-160,0]],[11,[-300,-120,0]],[15,[-360,-160,0]]]);
  std(orb,'scale',[100,100,100],[[0,[55,55,100]],[4,[100,100,100]],[11,[120,120,100]],[14,[0,0,100]],[15,[0,0,100]]]);
  add(orb);

  /* ---- precomp instances : flat + preserve3d, independent time ---- */
  const pcA=mk('precomp','实例 · 独立画面 A',{
    compId:unit.id,start:0,spatialMode:'flat',timeMap:{type:'normal',speed:0.65,loop:true}
  },{color:T.indigo});
  std(pcA,'position',[-430,-190,0],[[0,[-620,-190,0]],[6,[-430,-190,0]],[11,[-470,-150,0]],[15,[-470,-150,0]]]);
  std(pcA,'rotation',0,[[0,-20],[15,20,'linear']]);
  std(pcA,'scale',[100,100,100],[[0,[0,0,100]],[4,[100,100,100]],[11,[85,85,100]],[14,[0,0,100]],[15,[0,0,100]]]);
  std(pcA,'opacity',100,[[0,0],[3,90],[11,75],[14,0],[15,0]]);
  add(pcA);

  const pcB=mk('precomp','实例 · 保留三维 B',{
    compId:unit.id,start:1.5,spatialMode:'preserve3d',timeMap:{type:'reverse',speed:0.8,duration:15}
  },{color:T.violet});
  std(pcB,'position',[470,170,0],[[0,[680,240,0]],[6,[470,170,0]],[11,[420,140,0]],[15,[470,170,0]]]);
  std(pcB,'rotation',0,[[0,25],[15,-15,'linear']]);
  std(pcB,'scale',[100,100,100],[[0,[0,0,100]],[4,[90,90,100]],[11,[100,100,100]],[14,[0,0,100]],[15,[0,0,100]]]);
  std(pcB,'opacity',100,[[0,0],[3,80],[11,70],[14,0],[15,0]]);
  add(pcB);

  /* ---- particles : chain 2 ---- */
  const parts=mk('particles','粒子 · 表面发射 / 碰撞 / 拖尾',{
    sourceId:'__HERO__',sourceType:'surface',count:230,rate:70,life:2.8,start:3.0,
    speed:210,size:13,drag:0.28,gravity:150,seed:4,useFields:true,
    colorRamp:[C('#8ef0e0',0),C('#7cb6ff',1),C('#f7b955',1),C('#ff6b9d',0)],
    sizeRamp:[0.4,1.2,0.15],
    forces:[{kind:'vortex',x:0,y:-40,strength:1.1},{kind:'attract',x:0,y:260,strength:22},
            {kind:'noise',strength:55},{kind:'directional',x:14,y:0}],
    trail:{len:9,dt:0.045,width:3.4,color:C('#7fe6ff',0.55)},
    collision:{meshId:'__GRID__',restitution:0.52,friction:0.35,y:300},
    eventColor:C('#ffd27a'),
    secondary:{count:4,life:0.55,speed:150,size:7,color:C('#ffe6a8')},
    nodeRate:'n9:0'
  },{color:T.gold,blend:'add'});
  std(parts,'opacity',100,[[0,0],[3,0],[4,100],[12,100],[14,0],[15,0]]);
  add(parts);

  const dust=mk('particles','粒子 · 环境浮尘',{
    sourceType:'point',count:120,rate:40,life:5,start:0,speed:70,size:7,
    drag:0.05,gravity:-8,seed:9,
    colorRamp:[C('#4fd1c5',0),C('#7c8cff',0.7),C('#ffffff',0)],
    sizeRamp:[0.3,1,0.2],forces:[{kind:'vortex',x:0,y:0,strength:0.25}]
  },{color:T.cyan,blend:'screen'});
  std(dust,'opacity',100,[[0,28],[1,70],[13,60],[15,0]]);
  add(dust);

  /* ---- masks / mattes / effects layers ---- */
  const wipe=mk('shape','蒙版 · 光带扫掠',{
    shape:{kind:'rect',w:520,h:1600,r:60},fill:C(T.white,0.06),stroke:null
  },{color:T.white,blend:'overlay'});
  wipe.masks=[{path:null,invert:false,feather:60,opacity:90,mode:'add'}];
  std(wipe,'position',[-900,0,0],[[0,[-1000,0,0]],[7,[0,0,0]],[11,[1000,0,0]],[15,[1000,0,0]]]);
  std(wipe,'rotation',-18,[[0,-18],[15,-18]]);
  std(wipe,'opacity',100,[[0,0],[6,0],[7,60],[8,0],[15,0]]);
  add(wipe);

  /* ---- TEXT ---- */
  const title=mk('text','文字 · 主标题 棱镜',{
    str:'棱镜',size:230,align:'center',lineHeight:1.0,tracking:26,
    color:C(T.white),hud:true,
    animator:{by:'char',start:-0.5,end:1.5,offset:0,soft:0.22,t0:0.2,dur:1.5,ease:'easeOut',
      dx:0,dy:-90,rot:-24,scale:-0.5,fade:1,amp:1},
    extrude:{depth:14,dx:0.55,dy:0.6}
  },{color:T.white});
  title.effects=[{type:'glow',name:'发光',params:{radius:18,intensity:0.14,color:C(T.cyan)}}];
  std(title,'position',[0,-165,0],[[0,[0,-165,0]],[6,[0,-175,0]],[11,[0,-150,0]],[15,[0,-150,0]]]);
  std(title,'opacity',100,[[0,40],[0.3,100],[11,100],[13,0],[15,0]]);
  prop(title,'animOffset',0,[[0,0],[1.2,0],[2.4,0]]);
  add(title);

  const latin=mk('text','文字 · PRISMA',{
    str:'P R I S M A',size:74,align:'center',tracking:6,
    color:C(T.cyan),hud:true,
    animator:{by:'char',start:0,end:1,soft:0.12,t0:0.9,dur:1.6,ease:'easeOut',
      dx:0,dy:40,rot:0,scale:0,fade:1}
  },{color:T.cyan});
  std(latin,'position',[0,175,0],[[0,[0,175,0]],[15,[0,175,0]]]);
  std(latin,'opacity',100,[[0,30],[1,30],[2,100],[12,100],[13.5,0],[15,0]]);
  add(latin);

  const sub=mk('text','文字 · 副标题',{
    str:'光 的 塑 形\nMOTION · GEOMETRY · LIGHT',size:30,align:'center',lineHeight:1.7,tracking:8,
    color:C('#a9b6c8'),hud:true,
    animator:{by:'line',start:-0.5,end:1.5,soft:0.18,t0:2.6,dur:1.2,ease:'easeOut',
      dx:0,dy:24,rot:0,scale:0,fade:1}
  },{color:'#a9b6c8'});
  std(sub,'position',[0,270,0],[[0,[0,270,0]],[15,[0,270,0]]]);
  std(sub,'opacity',100,[[0,0],[2.4,0],[3.4,100],[11,100],[13,0],[15,0]]);
  add(sub);

  const pathPts=[];for(let i=0;i<=40;i++){const u=i/40;pathPts.push([-470+940*u,Math.sin(u*Math.PI*1.2)*70+185]);}
  const pathText=mk('text','文字 · 路径排布',{
    str:'FORM FOLLOWS LIGHT · 形态因光而生',size:26,align:'left',tracking:2,
    color:C(T.gold),hud:true,pathText:{points:pathPts,start:0,end:1,orient:true,perp:0}
  },{color:T.gold});
  std(pathText,'opacity',100,[[0,0],[4,0],[5,70],[9,70],[11,0],[15,0]]);
  prop(pathText,'animOffset',0,null,'time*0.04');
  add(pathText);

  const endTitle=mk('text','文字 · 收束标识',{
    str:'PRISMA',size:120,align:'center',tracking:16,
    color:C(T.white),hud:true,
    animator:{by:'char',start:-0.3,end:1.3,soft:0.2,t0:11.4,dur:1.4,ease:'easeOut',
      dx:0,dy:-40,rot:0,scale:-0.4,fade:1},
    extrude:{depth:18,dx:0.5,dy:0.55}
  },{color:T.white});
  endTitle.effects=[{type:'glow',name:'发光',params:{radius:14,intensity:0.12,color:C(T.gold)}},
                    {type:'dropShadow',name:'投影',params:{distance:26,softness:22,direction:135}}];
  std(endTitle,'position',[0,-10,0],[[11,[0,60,0]],[13,[0,-10,0]],[15,[0,-10,0]]]);
  std(endTitle,'opacity',100,[[0,0],[11,0],[11.8,100],[15,100]]);
  add(endTitle);

  const endCap=mk('text','文字 · 尾注',{
    str:'DESIGNED IN PRISMA   ·   15 SECONDS   ·   ∞',size:22,align:'center',tracking:5,
    color:C('#8a97ab'),hud:true
  },{color:'#8a97ab'});
  std(endCap,'position',[0,150,0],[[0,[0,150,0]],[15,[0,150,0]]]);
  std(endCap,'opacity',100,[[0,0],[12.6,0],[13.6,100],[15,100]]);
  add(endCap);

  /* ---- lights ---- */
  const key=mk('light','光源 · 主平行光',{type:'dir',color:C('#fff0d8'),intensity:1.35,dir:[0.35,-1,-0.55]},
    {color:T.gold});
  prop(key,'lightInt',1.35,null,'1.25 + Math.sin(time*1.8)*0.16');
  add(key);

  const point=mk('light','光源 · 移动点光 / 投影',{type:'point',color:C('#8fd8ff'),intensity:1.7},
    {color:T.cyan});
  std(point,'position',[-300,-260,0],[[0,[-420,-260,0]],[7,[240,-200,0]],[11,[-160,-300,0]],[15,[-160,-300,0]]]);
  prop(point,'lightInt',1.7,null,'1.5 + Math.sin(time*2.4)*0.5');
  add(point);

  /* ---- adjustment : grade / bloom / echo / time ---- */
  const adj=mk('adjustment','调整层 · 调色 / 发光 / 回声',{post:{
    bloom:0.62,grain:0.030,vignette:0.40,contrast:1.06,sat:1.07,echo:0,aberr:0.9,mbBoost:1.0,
    bloomThresh:0.78
  }},{color:T.pink});
  prop(adj,'echo',0,[[0,0],[7,0],[8,0.40],[10,0.12],[11,0],[15,0]]);
  prop(adj,'bloom',0.62,[[0,0.55],[7,0.82],[11,0.62],[15,0.55]]);
  prop(adj,'mbBoost',1.0,[[0,0.5],[7,1.5],[10,1.2],[13,0.3],[15,0.2]]);
  add(adj);

  /* ---- tone / sound layers ---- */
  const music=mk('tone','音色 · 配乐',{wave:'pad',gain:0.16,
    notes:[
      {t:0,f:110,dur:2.2},{t:0,f:164.8,dur:2.2},{t:0,f:220,dur:2.2},
      {t:2.4,f:130.8,dur:2.0},{t:2.4,f:196,dur:2.0},{t:2.4,f:261.6,dur:2.0},
      {t:4.8,f:146.8,dur:2.2},{t:4.8,f:220,dur:2.2},{t:4.8,f:293.7,dur:2.2},
      {t:7.0,f:98,dur:1.6},{t:7.0,f:146.8,dur:1.6},{t:7.0,f:196,dur:1.6},{t:7.0,f:293.7,dur:1.6},
      {t:8.6,f:110,dur:1.4},{t:8.6,f:164.8,dur:1.4},{t:8.6,f:261.6,dur:1.4},
      {t:10.0,f:130.8,dur:1.2},{t:10.0,f:196,dur:1.2},{t:10.0,f:329.6,dur:1.2},
      {t:11.2,f:87.3,dur:3.6},{t:11.2,f:130.8,dur:3.6},{t:11.2,f:174.6,dur:3.6},{t:11.2,f:261.6,dur:3.6}
    ]},{color:T.green});
  add(music);

  const sfx=mk('tone','音色 · 节奏 / 音效',{wave:'pluck',gain:0.10,
    seq:[0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.25,7.5,7.75,8,8.25,8.5,8.75,9,9.5,10,10.5,11,12,13,14],
    f:660},{color:T.amber});
  add(sfx);

  /* ---- camera (top) ---- */
  const cam=mk('camera','相机 · 主镜头',{},{color:T.white});
  prop(cam,'camDist',1600,[[0,1750],[3.2,1350,'easeOut'],[7,1000,'ease'],[9.5,1500,'ease'],[11,2350,'easeOut'],[13.2,1600,'ease'],[15,1600,'ease']]);
  prop(cam,'camYaw',0,[[0,0],[3,0.04],[7,0.32,'ease'],[9.5,-0.18,'ease'],[11,0.12],[14,0,'ease'],[15,0]]);
  prop(cam,'camPitch',0,[[0,0],[7,0.10],[10,0.02],[14,0],[15,0]]);
  prop(cam,'camFocus',1600,[[0,1600],[6.5,1000,'ease'],[8,1050],[9.8,2600,'ease'],[11.5,1700],[14,1600],[15,1600]]);
  prop(cam,'camAperture',0,[[0,0],[6,0.2],[7.5,1.0,'ease'],[9.6,1.25],[11,0.45],[13,0.05],[14,0],[15,0]]);
  add(cam);

  /* resolve id cross-references, parenting, layer order (index 0 = top) */
  const byName={};for(const l of L)byName[l.name]=l;
  hero.data.sourceId=byName['源路径 · 形态演化'].id;
  parts.data.sourceId=byName['实体 · 挤出核心'].id;
  parts.data.collision.meshId=byName['网格 · 可变形表面'].id;
  unit.layers[1].data.compId=core.id;
  // parent several visual layers to the controller (preserves multi-level chains)
  for(const nm of ['程序图形 · 曼陀罗','参数实体 · 圆环','源路径 · 形态演化'])
    byName[nm].parentId=ctrl.id;
  // second-level nesting: core is parented inside unit's ring via precomp chain already

  comp.layers=L.slice().reverse(); // top = last added (camera)
  AE.demoTexts=['棱镜','P R I S M A','光 的 塑 形','MOTION · GEOMETRY · LIGHT',
    'FORM FOLLOWS LIGHT  ·  形态因光而生  ·  ','PRISMA',
    'DESIGNED IN PRISMA   ·   15 SECONDS   ·   ∞','未命名工程','主合成 · PRISMA'];
  return project;
};

})(window.AE);
