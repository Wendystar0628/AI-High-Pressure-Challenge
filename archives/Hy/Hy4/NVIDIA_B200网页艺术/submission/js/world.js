/* ============================================================
   world.js — Three.js scene: models, materials, lighting,
              data flows, and deterministic post-processing
   ============================================================ */
(function () {
'use strict';
const A=window.APP, T=window.THREE, U=A.util;
const W=A.World={};
W.G={}; W.M={}; W.PARTS=[]; W.flows={};

const V=(x,y,z)=>new T.Vector3(x,y,z);

/* ---------------- helpers ---------------- */
function box(w,h,d,mat,parent,x,y,z,shadow){
  const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);
  m.position.set(x||0,y||0,z||0);
  if(shadow!==false){m.castShadow=true;m.receiveShadow=true;}
  (parent||W.scene).add(m);return m;
}
function grp(parent,x,y,z){const g=new T.Group();g.position.set(x||0,y||0,z||0);(parent||W.scene).add(g);return g;}
function canvasTex(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const x=c.getContext('2d');draw(x,w,h);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
W.box=box;W.grp=grp;

/* ---------------- environment ---------------- */
function makeEnv(){
  const c=document.createElement('canvas');c.width=512;c.height=256;
  const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#0a1420');g.addColorStop(.38,'#16283a');g.addColorStop(.5,'#20364a');
  g.addColorStop(.56,'#0b1119');g.addColorStop(1,'#04070b');
  x.fillStyle=g;x.fillRect(0,0,512,256);
  const strip=(cx,cy,w,h,col,blur)=>{
    x.save();x.filter='blur('+blur+'px)';x.fillStyle=col;x.globalAlpha=.42;
    x.fillRect(cx-w/2,cy-h/2,w,h);x.restore();
  };
  strip(70,72,60,150,'#7ca8cc',26);
  strip(196,58,26,120,'#4e7a34',22);
  strip(330,80,90,90,'#2f7b8c',34);
  strip(452,66,40,140,'#a8814a',26);
  // horizon glow
  const hg=x.createLinearGradient(0,110,0,150);
  hg.addColorStop(0,'rgba(120,180,220,0)');hg.addColorStop(.5,'rgba(120,180,220,.22)');hg.addColorStop(1,'rgba(120,180,220,0)');
  x.fillStyle=hg;x.fillRect(0,110,512,40);
  // faint stars / specks
  for(let i=0;i<90;i++){
    const px=U.hash(i)*512,py=U.hash(i+99)*120;
    x.fillStyle='rgba(200,225,255,'+(0.05+U.hash(i+7)*0.12)+')';
    x.fillRect(px,py,1,1);
  }
  const tex=new T.CanvasTexture(c);tex.mapping=T.EquirectangularReflectionMapping;tex.colorSpace=T.SRGBColorSpace;
  const pm=new T.PMREMGenerator(W.renderer);pm.compileEquirectangularShader();
  const env=pm.fromEquirectangular(tex).texture;pm.dispose();tex.dispose();
  return env;
}

/* ---------------- materials ---------------- */
function materials(){
  const M=W.M;
  const std=(o)=>new T.MeshStandardMaterial(o);
  M.substrate=std({color:0x123527,roughness:.62,metalness:.28,envMapIntensity:.7});
  M.pcbEdge=std({color:0x0b1c12,roughness:.5,metalness:.4});
  M.copper=std({color:0xc98a42,metalness:.96,roughness:.26,envMapIntensity:1.6});
  M.gold=std({color:0xe9bc66,metalness:1,roughness:.19,envMapIntensity:1.9});
  M.solder=std({color:0xbfc9d4,metalness:1,roughness:.32,envMapIntensity:1.5});
  M.interposer=std({color:0x0b131b,metalness:.22,roughness:.62,envMapIntensity:.4});
  M.silicon=new T.MeshPhysicalMaterial({color:0x121b25,metalness:.42,roughness:.3,
      clearcoat:.28,clearcoatRoughness:.2,iridescence:.72,iridescenceIOR:1.38,
      iridescenceThicknessRange:[120,420],envMapIntensity:1.15});
  M.dieTop=new T.MeshPhysicalMaterial({color:0x16222c,metalness:.4,roughness:.34,
      clearcoat:.22,iridescence:.6,iridescenceIOR:1.32,iridescenceThicknessRange:[160,520],
      envMapIntensity:1.1});
  M.hbmBase=std({color:0x101a24,metalness:.42,roughness:.4,envMapIntensity:.8});
  M.hbmLayer=[std({color:0x142231,metalness:.35,roughness:.42,envMapIntensity:.85,
                    emissive:0x071722,emissiveIntensity:.22}),
              std({color:0x182b3c,metalness:.36,roughness:.4,envMapIntensity:.9,
                    emissive:0x0a1e2b,emissiveIntensity:.26})];
  M.tsv=std({color:0xe0ae5c,metalness:.95,roughness:.25,emissive:0x3a2205,emissiveIntensity:.6});
  M.ubump=std({color:0xd9ab5e,metalness:.98,roughness:.3});
  M.metal=std({color:0x2b333c,metalness:.9,roughness:.42,envMapIntensity:.95});
  M.metalDark=std({color:0x141b23,metalness:.85,roughness:.48,envMapIntensity:.8});
  M.frame=std({color:0x2c353f,metalness:.9,roughness:.38,envMapIntensity:1.05});
  M.cap=std({color:0x0e151c,metalness:.35,roughness:.55});
  M.core=std({color:0x2a3a48,metalness:.5,roughness:.35,emissive:0x0a2a18,emissiveIntensity:.15});
  M.board=std({color:0x0d2a1c,metalness:.3,roughness:.6});
  M.rack=std({color:0x2b3742,metalness:.78,roughness:.42,envMapIntensity:1.2});
  M.rackFace=std({color:0x18232d,metalness:.55,roughness:.52,emissive:0x081018,emissiveIntensity:.4});
  M.glass=new T.MeshPhysicalMaterial({color:0x0a1a22,metalness:.1,roughness:.08,
      transmission:.55,thickness:.5,transparent:true,opacity:.55,envMapIntensity:1.4});
  M.traceGlow=new T.MeshBasicMaterial({color:0x8bd44e,transparent:true,opacity:.7});
  M.cyanGlow=new T.MeshBasicMaterial({color:0x54d3e8,transparent:true,opacity:.75});
  M.violetGlow=new T.MeshBasicMaterial({color:0xa98bff,transparent:true,opacity:.8});
  M.amberGlow=new T.MeshBasicMaterial({color:0xe8a83d,transparent:true,opacity:.8});
  W.allMats=Object.keys(M).map(k=>M[k]).filter(m=>m&&m.isMaterial);
}

/* ---------------- package ---------------- */
function buildPackage(){
  const P=grp(W.G.root,0,0,0);W.G.pkg=P;
  const parts=W.G.parts={};
  const reg=(name,obj,dir,dist,label,desc,detail)=>{
    obj.userData.base=obj.position.clone();
    W.PARTS.push({name,obj,dir:dir.clone(),dist,label,desc,detail,
                  center:V(0,0,0)});
    return obj;
  };

  /* --- solder balls (BGA underside) --- */
  const solder=grp(P,0,-0.42,0);parts.solder=solder;
  const ballGeo=new T.SphereGeometry(.072,8,6);
  const cols=22,rows=17,nb=cols*rows;
  const balls=new T.InstancedMesh(ballGeo,M().solder,nb);
  let bi=0;const mtx=new T.Matrix4();
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
    const x=-5.05+i*(10.1/(cols-1)),z=-3.85+j*(7.7/(rows-1));
    // leave a central void for power module look
    mtx.makeTranslation(x,0,z);balls.setMatrixAt(bi++,mtx);
  }
  balls.castShadow=true;solder.add(balls);
  reg('solder',solder,V(0,-1,0),1.5,'焊球阵列 BGA',
      '底面 22×17 焊球阵列，承担供电与信号引出；旋转到底面可见完整球面。',null);

  /* --- substrate + traces + caps + stiffener --- */
  const sub=grp(P,0,0,0);parts.substrate=sub;
  box(11,.42,8.5,M().substrate,sub,0,0,0);
  // edge laminations
  for(let i=0;i<4;i++)box(11,.035,8.5,M().pcbEdge,sub,0,-.16+i*.105,0,false);
  // copper traces on top surface (fan-out)
  const traceMat=M().copper;
  for(let i=0;i<26;i++){
    const z=-3.9+i*(7.8/25);
    const t=box(9.6,.012,.018,traceMat,sub,0,.225,z,false);
    t.material=traceMat;
  }
  for(let i=0;i<10;i++){
    const x=-4.6+i*1.02;
    box(.016,.012,7.6,traceMat,sub,x,.228,0,false);
  }
  // gold contact pads around periphery
  const padMat=M().gold;
  for(let i=0;i<20;i++){
    const x=-5.0+i*(10/19);
    box(.16,.02,.16,padMat,sub,x,.235,4.05,false);
    box(.16,.02,.16,padMat,sub,x,.235,-4.05,false);
  }
  // decoupling capacitors
  const capGeo=new T.BoxGeometry(.16,.1,.26);
  for(let i=0;i<30;i++){
    const side=i%2?1:-1;
    const x=side*(3.9+U.hash(i)*.9);
    const z=-3.7+U.hash(i+40)*7.4;
    const c=new T.Mesh(capGeo,M().cap);c.position.set(x,.29,z);c.castShadow=true;sub.add(c);
  }
  // stiffener frame (metal ring)
  const fw=.34,fh=.3;
  box(11,fh,.34,M().frame,sub,0,.34,4.08);
  box(11,fh,.34,M().frame,sub,0,.34,-4.08);
  box(.34,fh,8.5,M().frame,sub,5.33,.34,0);
  box(.34,fh,8.5,M().frame,sub,-5.33,.34,0);
  reg('substrate',sub,V(0,-1,0),.75,'基板与铜走线',
      '分层基板、表面铜走线、金焊盘、外围去耦电容与金属加固框。内部连接可在细看中放大。',
      {target:V(0,.25,0),zoom:.62});

  /* --- interposer with surface traces --- */
  const inter=grp(P,0,.62,0);parts.interposer=inter;
  box(9.7,.2,7.3,M().interposer,inter,0,0,0);
  for(let i=0;i<18;i++){
    const z=-3.3+i*(6.6/17);
    box(9.3,.008,.012,M().copper,inter,0,.108,z,false);
  }
  // inter-die bridge traces on interposer surface
  for(let i=0;i<22;i++){
    const z=-2.7+i*(5.4/21);
    box(1.0,.01,.016,M().gold,inter,0,.112,z,false);
  }
  reg('interposer',inter,V(0,1,0),.45,'中介层与表面走线',
      '硅中介层表面走线连接晶粒与显存；中央金色桥接走线对应两晶粒互连。',
      {target:V(0,.62,0),zoom:.55});

  /* --- micro bumps under dies & HBM --- */
  const bumps=grp(P,0,.78,0);parts.bumps=bumps;
  const ubGeo=new T.SphereGeometry(.028,6,4);
  const ub=new T.InstancedMesh(ubGeo,M().ubump,900);let ui=0;
  for(let a=0;a<30;a++)for(let b=0;b<30;b++){
    const x=-4.25+a*(8.5/29),z=-3.3+b*(6.6/29);
    if(Math.abs(x)<4.6){mtx.makeTranslation(x,0,z);ub.setMatrixAt(ui++,mtx);}
  }
  ub.count=ui;bumps.add(ub);
  reg('bumps',bumps,V(0,1,0),.25,'微凸点 μBump',
      '晶粒与中介层、HBM 与中介层之间的微凸点阵列，是短距高密度互连的接触点。',null);

  /* --- 8 HBM3e stacks --- */
  const hbm=grp(P,0,.9,0);parts.hbm=hbm;
  W.G.hbmStacks=[];
  const stackPos=[];
  for(let s=0;s<4;s++){
    stackPos.push([-3.95,-2.7+s*1.8],[3.95,-2.7+s*1.8]);
  }
  stackPos.forEach((pos,k)=>{
    const st=buildHBM(hbm,pos[0],pos[1],k);
    W.G.hbmStacks.push(st);
  });
  reg('hbm',hbm,V(0,1,0),1.05,'8 × HBM3e 堆栈',
      '每堆栈含基底逻辑晶粒、8 层 DRAM、层间微凸点与贯穿层硅通孔（TSV）。细看可逐层展开。',
      {target:V(-3.95,1.3,0),zoom:.42});

  /* --- two compute dies --- */
  const dies=grp(P,0,.95,0);parts.dies=dies;
  W.G.dieA=buildDie(dies,-1.72,'A');
  W.G.dieB=buildDie(dies,1.72,'B');
  reg('dies',dies,V(0,1,0),1.9,'两颗计算晶粒',
      '两颗 reticle-limit 晶粒组成一颗统一 GPU。顶面为计算单元、缓存与接口区，底面为微凸点。',
      {target:V(0,1.1,0),zoom:.5});

  /* --- D2D bridge / seam interconnect --- */
  const bridge=grp(P,0,1.16,0);parts.bridge=bridge;
  W.G.bridgeLines=[];
  for(let i=0;i<30;i++){
    const z=-2.55+i*(5.1/29);
    const l=box(.62,.022,.014,M().gold,bridge,0,0,z,false);
    W.G.bridgeLines.push(l);
  }
  // glowing overlay lines
  W.G.bridgeGlow=[];
  for(let i=0;i<10;i++){
    const z=-2.3+i*(4.6/9);
    const l=box(.62,.006,.02,M().traceGlow,bridge,0,.02,z,false);
    W.G.bridgeGlow.push(l);
  }
  reg('bridge',bridge,V(0,1,0),2.7,'片间互连 NV-HBI',
      '跨缝的密集桥接走线，提供 10 TB/s 片间互连，让两颗晶粒作为一颗 GPU 协作。',null);

  /* --- lid / heat-spreader frame --- */
  const lid=grp(P,0,1.28,0);parts.lid=lid;
  const lw=.42;
  box(10.6,.16,lw,M().frame,lid,0,0,3.55);
  box(10.6,.16,lw,M().frame,lid,0,0,-3.55);
  box(lw,.16,7.1,M().frame,lid,5.1,0,0);
  box(lw,.16,7.1,M().frame,lid,-5.1,0,0);
  reg('lid',lid,V(0,1,0),3.4,'加固盖框',
      '金属加固框与散热界面；开场与收束时构成封装外轮廓。',null);

  // part centers in local (pre-explode) coords
  W.PARTS.forEach(p=>{
    p.center=new T.Vector3();
    p.obj.updateMatrixWorld(true);
    p.obj.getWorldPosition(p.center);
  });

  /* --- section slab (solid cut face) --- */
  W.sectionSlab=box(.10,1.75,8.5,
    new T.MeshStandardMaterial({map:sectionTexture(),metalness:.25,roughness:.6,
      emissive:0x0a141c,emissiveIntensity:.5,side:T.DoubleSide}),
    P,0,0.5,0,false);
  W.sectionSlab.visible=false;

  function M(){return W.M;}
}

function buildHBM(parent,x,z,idx){
  const g=grp(parent,x,0,z);
  const SW=1.5,SD=2.0;
  box(SW,.14,SD,W.M.hbmBase,g,0,.07,0);
  const layers=[],bumps=[];
  for(let i=0;i<8;i++){
    const ly=.16+i*.108;
    const m=box(SW,.085,SD,W.M.hbmLayer[i%2],g,0,ly,0);
    layers.push({mesh:m,base:ly,i});
    // micro bumps between layers
    for(let b=0;b<6;b++){
      const mb=box(.12,.018,.12,W.M.ubump,g,-.55+b*.22,ly+.052,0,false);
      bumps.push({mesh:mb,base:mb.position.y,i});
    }
  }
  // TSVs: vertical rods through layers
  const tsvs=[];
  for(let a=0;a<4;a++)for(let b=0;b<3;b++){
    const rod=new T.Mesh(new T.CylinderGeometry(.014,.014,.95,6),W.M.tsv);
    rod.position.set(-.5+a*.33,.55,-.6+b*.6);
    g.add(rod);tsvs.push(rod);
    // bright cap
    const cap=new T.Mesh(new T.SphereGeometry(.022,6,4),W.M.amberGlow);
    cap.position.set(rod.position.x,1.04,rod.position.z);g.add(cap);
  }
  return {g,layers,bumps,tsvs,x,z,idx,top:1.12};
}

function buildDie(parent,x,tag){
  const g=grp(parent,x,0,0);
  const DW=3.25,DD=5.3;
  box(DW,.17,DD,W.M.silicon,g,0,0,0);
  // top functional regions (schematic, labelled)
  const top=.1;
  // compute-unit array (instanced, coloured in chapter 05)
  const cols=12,rows=18,n=cols*rows;
  const cu=new T.InstancedMesh(new T.BoxGeometry(.19,.03,.24),W.M.core,n);
  let ci=0;const mtx=new T.Matrix4();const cc=new T.Color();
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
    const px=-1.32+i*(2.64/(cols-1)),pz=-2.25+j*(4.5/(rows-1));
    mtx.makeTranslation(px,top,pz);cu.setMatrixAt(ci,mtx);
    cu.setColorAt(ci,cc.setRGB(.12,.22,.3));ci++;
  }
  cu.castShadow=false;g.add(cu);
  // cache strips (amber)
  for(let i=0;i<4;i++)box(.1,.035,4.7,W.M.copper,g,-1.5+i*.02,top+.01,0,false);
  box(2.7,.03,.5,W.M.hbmBase,g,0,top+.01,2.32,false); // cache block
  box(2.7,.03,.5,W.M.hbmBase,g,0,top+.01,-2.32,false);
  // HBM PHY interface strips (outer edge)
  const side=tag==='A'?-1:1;
  for(let i=0;i<12;i++)box(.16,.05,.28,W.M.cyanGlow,g,side*1.5,top+.02,-2.1+i*.38,false);
  // NVLink ports (top & bottom edges)
  for(let i=0;i<8;i++){
    box(.24,.05,.12,W.M.violetGlow,g,-1.1+i*.31,top+.02,2.55,false);
    box(.24,.05,.12,W.M.violetGlow,g,-1.1+i*.31,top+.02,-2.55,false);
  }
  // micro bumps on die underside
  const ub=new T.InstancedMesh(new T.SphereGeometry(.022,6,4),W.M.ubump,240);
  let ui=0;
  for(let i=0;i<20;i++)for(let j=0;j<12;j++){
    mtx.makeTranslation(-1.45+i*(2.9/19),-.1,-2.3+j*(4.6/11));
    ub.setMatrixAt(ui++,mtx);
  }
  ub.count=ui;g.add(ub);
  return {g,cores:cu,cols,rows,n,x,tag};
}

function sectionTexture(){
  return canvasTex(64,512,(x,w,h)=>{
    const bands=[
      [0,.10,'#0c1a10'],[.10,.16,'#17402a'],[.16,.24,'#17402a'],
      [.24,.30,'#c98a42'],[.30,.48,'#14202c'],[.48,.54,'#20364a'],
      [.54,.60,'#1d2c3a'],[.60,.94,'#22323f'],[.94,1,'#59646f']
    ];
    bands.forEach(b=>{x.fillStyle=b[2];x.fillRect(0,b[1]*h,w,(b[2]&&1)*(b[1]-b[0])*h+2);});
    // copper trace lines
    x.strokeStyle='rgba(220,170,90,.85)';x.lineWidth=1;
    for(let i=0;i<9;i++){x.beginPath();x.moveTo(0,(.17+i*.014)*h);x.lineTo(w,(.17+i*.014)*h);x.stroke();}
    // DRAM layer stripes
    for(let i=0;i<8;i++){
      x.fillStyle=i%2?'rgba(84,211,232,.28)':'rgba(84,211,232,.14)';
      x.fillRect(0,(.32+i*.072)*h,w,3);
    }
    x.fillStyle='rgba(139,212,78,.5)';x.fillRect(0,.60*h,w,2);
  });
}

/* ---------------- systems (ch06 / ch07) ---------------- */
function miniPackage(parent,x,y,z,s){
  const g=grp(parent,x,y,z);g.scale.setScalar(s);
  box(2.6,.12,2.1,W.M.board,g,0,0,0,false);
  box(1.15,.1,.9,W.M.silicon,g,-.6,.11,0,false);
  box(1.15,.1,.9,W.M.silicon,g,.6,.11,0,false);
  for(let k=-1;k<=1;k+=2)box(.5,.18,.9,W.M.hbmBase,g,k*1.9,.14,0,false);
  // heatsink fins
  for(let i=0;i<6;i++)box(2.4,.02,.12,W.M.metal,g,0,.24,-.8+i*.32,false);
  box(2.7,.05,2.2,W.M.metalDark,g,0,.28,0,false);
  box(2.72,.012,2.22,W.M.traceGlow,g,0,.312,0,false); // glowing module outline
  return g;
}
function buildSystems(){
  const root=W.G.root;

  /* HGX B200 — 8 GPU board */
  const hgx=grp(root,0,0,0);W.G.hgx=hgx;W.G.hgxSlots=[];
  box(15,.4,10.5,W.M.board,hgx,0,0,0);
  const slotXY=[[-4.9,-3.2],[-1.6,-3.2],[1.6,-3.2],[4.9,-3.2],
                [-4.9,3.2],[-1.6,3.2],[1.6,3.2],[4.9,3.2]];
  slotXY.forEach((p,i)=>W.G.hgxSlots.push(miniPackage(hgx,p[0],.4,p[1],.82)));
  // NVSwitch chips center
  for(let i=0;i<4;i++)box(.55,.14,.55,W.M.violetGlow,hgx,-1.5+i*1,.35,0,false);
  // NVLink traces
  for(let i=0;i<8;i++){
    const z=-3.6+i*(7.2/7);
    box(13,.012,.02,W.M.copper,hgx,0,.215,z,false);
  }
  // edge connectors
  for(let i=0;i<10;i++)box(.3,.1,.2,W.M.gold,hgx,-6.5+i*1.44,.25,5.1,false);

  /* GB200 superchip — 1 Grace + 2 Blackwell */
  const gb=grp(root,0,0,0);W.G.gb200=gb;
  box(9,.3,6,W.M.board,gb,0,0,0);
  miniPackage(gb,-2.0,.3,0,.78);
  miniPackage(gb,2.0,.3,0,.78);
  box(2.2,.26,3.4,W.M.metal,gb,0,.28,0); // Grace CPU
  for(let i=0;i<7;i++)box(1.9,.02,.16,W.M.frame,gb,0,.43,-1.4+i*.47,false);
  // NVLink-C2C
  for(let i=0;i<8;i++)box(2.2,.012,.03,W.M.greenGlow||W.M.traceGlow,gb,-1.0+i*.28,.17,0,false);

  /* DGX B200 server chassis */
  const srv=grp(root,0,0,0);W.G.srv=srv;
  box(17,7.5,11,W.M.rackFace,srv,0,0,0);
  // front bezel
  box(17.2,7.7,.35,W.M.rack,srv,0,0,5.5);
  // fan grills
  for(let i=0;i<3;i++){
    for(let j=0;j<6;j++){
      box(1.5,.08,.06,W.M.metal,srv,-6+i*6,-2.6+j*.9,5.72,false);
    }
    const ring=new T.Mesh(new T.TorusGeometry(2.1,.05,6,24),W.M.frame);
    ring.position.set(-6+i*6,0,5.72);srv.add(ring);
  }
  // HGX board inside (visible through open top)
  const inner=grp(srv,0,-1.1,0);inner.scale.setScalar(.62);
  const ib=grp(inner,0,0,0);W.G.hgxSlots.forEach((_,i)=>{
    const c=i%4,r=(i/4)|0;miniPackage(ib,-4.9+c*3.27,0,-3.2+r*6.4,.82);
  });
  // PSU bays
  for(let i=0;i<4;i++)box(1.4,1.1,2.2,W.M.metalDark,srv,-6+i*3.4,-2.8,-3.9,false);
  // top vents
  for(let i=0;i<20;i++)box(.12,.03,10,W.M.rack,srv,-8+i*.84,3.78,0,false);
  // luminous front accents
  box(14,.05,.02,W.M.cyanGlow,srv,0,2.9,5.74,false);
  box(14,.05,.02,W.M.traceGlow,srv,0,-2.9,5.74,false);
  for(let i=0;i<12;i++)box(.16,.16,.02,W.M.amberGlow,srv,-6.2+i*1.1,3.25,5.74,false);

  /* GB200 NVL72 rack + neighbours */
  const racks=grp(root,0,0,0);W.G.racks=racks;W.G.rackUnits=[];
  const rackAt=(x,z,s)=>{
    const g=grp(racks,x,0,z);g.scale.setScalar(s);
    // frame
    box(7,18,7,W.M.rack,g,0,0,0);
    // open front
    box(6.4,17.4,.2,W.M.rackFace,g,0,0,3.45);
    // compute trays (18) + switch trays (9)
    for(let i=0;i<18;i++){
      const y=-8.2+i*.96;
      const tray=box(6.1,.78,.3,W.M.metalDark,g,0,y,3.5,false);
      W.G.rackUnits.push(tray);
      for(let k=0;k<6;k++)box(.5,.5,.05,W.M.silicon,g,-2.2+k*.9,y,3.68,false);
      box(5.8,.03,.05,W.M.traceGlow,g,0,y-.3,3.7,false);
    }
    for(let i=0;i<9;i++){
      const y=-7.7+i*1.92;
      box(6.1,.5,.3,W.M.violetGlow,g,0,y,3.5,false);
    }
    // copper spine
    for(let i=0;i<3;i++)box(.1,16,.1,W.M.copper,g,-2+i*2,0,-3.3,false);
    return g;
  };
  rackAt(0,0,1);rackAt(-9.2,-3,.86);rackAt(9.2,-3,.86);rackAt(-18,-7,.72);rackAt(18,-7,.72);

  // all systems hidden by default
  [hgx,gb,srv,racks].forEach(g=>g.visible=false);
}

/* ---------------- ground grid ---------------- */
function buildGround(){
  const mat=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{uColor:{value:new T.Color(0x2a4a5e)},uFade:{value:.045}},
    vertexShader:`varying vec3 vW; void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`varying vec3 vW;uniform vec3 uColor;uniform float uFade;
      float grid(vec2 p){vec2 g=abs(fract(p)-.5);float l=smoothstep(.455,.5,max(g.x,g.y));return l;}
      void main(){vec2 p=vW.xz*.5;float g=grid(p);float g2=grid(p*.2)*.55;
        float d=length(vW.xz)*uFade;float a=(max(g,g2))*(1.-clamp(d,0.,1.))*.20;
        gl_FragColor=vec4(uColor,a);}`
  });
  const m=new T.Mesh(new T.PlaneGeometry(600,600),mat);
  m.rotation.x=-Math.PI/2;m.position.y=-4.6;W.scene.add(m);W.G.ground=m;
}

/* ---------------- flows (data particles) ---------------- */
function makeFlow(curves,count,color,size,opts){
  opts=opts||{};
  const geo=new T.BufferGeometry();
  const pos=new Float32Array(count*3),col=new Float32Array(count*3),
        siz=new Float32Array(count),alp=new Float32Array(count),off=new Float32Array(count),
        cid=new Float32Array(count);
  const c0=new T.Color(color);
  for(let i=0;i<count;i++){
    col[i*3]=c0.r;col[i*3+1]=c0.g;col[i*3+2]=c0.b;
    siz[i]=size*(.6+U.hash(i*1.7)*.9);
    off[i]=U.hash(i*2.3);cid[i]=i%curves.length;
    alp[i]=1;
  }
  geo.setAttribute('position',new T.BufferAttribute(pos,3));
  geo.setAttribute('color',new T.BufferAttribute(col,3));
  geo.setAttribute('aSize',new T.BufferAttribute(siz,1));
  geo.setAttribute('aAlpha',new T.BufferAttribute(alp,1));
  const mat=new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexColors:true,
    uniforms:{uWeight:{value:1},uPix:{value:Math.min(window.devicePixelRatio||1,1.5)}},
    vertexShader:`attribute float aSize;attribute float aAlpha;
      varying vec3 vC;varying float vA;uniform float uWeight;uniform float uPix;
      void main(){vC=color;vA=aAlpha*uWeight;
        vec4 mv=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(aSize*uPix*(90./-mv.z),1.,16.);}`,
    fragmentShader:`varying vec3 vC;varying float vA;
      void main(){vec2 q=gl_PointCoord-.5;float d=1.-smoothstep(.12,.5,length(q));
        gl_FragColor=vec4(vC*(.5+d*.55),d*vA*.62);}`
  });
  const pts=new T.Points(geo,mat);pts.frustumCulled=false;
  W.scene.add(pts);
  const tmp=new T.Vector3();
  return {pts,mat,curves,count,off,cid,
    update(t,speed,weight){
      mat.uniforms.uWeight.value=weight;
      for(let i=0;i<count;i++){
        let u=(off[i]+t*speed)%1;if(u<0)u+=1;
        const cv=curves[cid[i]|0];
        cv.getPoint(u,tmp);
        pos[i*3]=tmp.x;pos[i*3+1]=tmp.y;pos[i*3+2]=tmp.z;
        // fade at ends
        const f=Math.min(1,u*8,(1-u)*8);
        alp[i]=f*(opts.staticAlpha?1:(.55+.45*Math.sin(u*Math.PI)));
      }
      geo.attributes.position.needsUpdate=true;
      geo.attributes.aAlpha.needsUpdate=true;
    }};
}
function curve(pts){return new T.CatmullRomCurve3(pts.map(p=>V(p[0],p[1],p[2])),false,'catmullrom',.4);}

function buildFlows(){
  const F=W.flows;
  /* ch03: cross-seam pulses between the two dies */
  const seam=[];
  for(let i=0;i<14;i++){
    const z=-2.3+i*(4.6/13);
    seam.push(curve([[0,1.2,z],[0,1.36,z],[0,1.2,z]])); // placeholder, replaced by dynamic
  }
  // real seam paths: left die core -> across seam -> right die core
  const seamC=[];
  for(let i=0;i<16;i++){
    const z=-2.2+i*(4.4/15);
    seamC.push(curve([[-1.5,1.12,z],[-.35,1.24,z],[0,1.3,z],[.35,1.24,z],[1.5,1.12,z]]));
  }
  F.seam=makeFlow(seamC,96,0x8bd44e,1.9,{staticAlpha:false});
  // pulses that STOP at the opened seam (each side terminates at the break)
  const brokenC=[];
  for(let i=0;i<16;i++){
    const z=-2.2+i*(4.4/15);
    brokenC.push(curve([[-1.5,1.12,z],[-.8,1.2,z],[-.22,1.28,z],[-.18,1.28,z]]));
    brokenC.push(curve([[1.5,1.12,z],[.8,1.2,z],[.22,1.28,z],[.18,1.28,z]]));
  }
  F.seamBroken=makeFlow(brokenC,96,0xff9a5a,1.8,{staticAlpha:false});

  /* ch04: 8 HBM streams into the dies */
  const hb=W.G.hbmStacks;const hstreams=[];
  hb.forEach((st,k)=>{
    const dir=k%2===0?1:-1; // left stacks -> +x, right -> -x
    const sx=st.x,sz=st.z;
    hstreams.push(curve([
      [sx,1.6,sz],[sx+dir*.45,1.75,sz],[sx+dir*1.5,1.9,sz*.8],
      [dir*1.4,1.7,sz*.4],[dir*.2,1.45,0],[dir*.05,1.4,0]
    ]));
  });
  F.hbm=makeFlow(hstreams,168,0x54d3e8,1.9,{});
  // results leaving the dies
  const outs=[];
  for(let i=0;i<8;i++){
    const z=-2.4+i*.68;
    outs.push(curve([[0,1.4,0],[0,1.9,z],[0,2.6,z*1.3],[0,3.4,z*1.5]]));
  }
  F.result=makeFlow(outs,96,0xe8a83d,2.0,{});

  /* ch06: NVLink between 8 GPUs (board space) */
  const nvc=[];
  for(let i=0;i<8;i++){
    const a=[-4.9+(i%4)*3.3,.9,(i<4?-3.2:3.2)];
    const b=[a[0],1.3,0];
    nvc.push(curve([a,[a[0]*.5,1.5,0],b]));
  }
  F.nvlink=makeFlow(nvc,128,0xa98bff,2.2,{});
  // rack-scale links
  const rc=[];
  for(let i=0;i<12;i++){
    const y=-8+i*1.5;
    rc.push(curve([[-28,1.1+y*.2,0],[-9,1.4+y*.15,0],[0,1.5+y*.1,0],[9,1.4+y*.15,0],[28,1.1+y*.2,0]]));
  }
  F.rack=makeFlow(rc,160,0xa98bff,2.0,{});

  /* ch08 workloads */
  const wl=[];
  for(let i=0;i<18;i++){
    const a=U.hash(i*3)*Math.PI*2,r=2.6+U.hash(i*5)*2;
    wl.push(curve([[Math.cos(a)*r,.4+i*.06,Math.sin(a)*r],
                   [Math.cos(a)*r*.4,1.6+i*.05,Math.sin(a)*r*.4],
                   [0,2.2,0]]));
  }
  F.work=makeFlow(wl,120,0x8bd44e,1.8,{});

  Object.values(F).forEach(f=>f.pts.visible=false);
}

/* ---------------- post-processing ---------------- */
function makeRT(w,h,depth){
  const rt=new T.WebGLRenderTarget(Math.max(2,w),Math.max(2,h),{
    minFilter:T.LinearFilter,magFilter:T.LinearFilter,
    type:T.HalfFloatType,depthBuffer:true,stencilBuffer:false,format:T.RGBAFormat
  });
  if(depth){rt.depthTexture=new T.DepthTexture(Math.max(2,w),Math.max(2,h));
    rt.depthTexture.type=T.UnsignedIntType;rt.depthTexture.format=T.DepthFormat;}
  rt.texture.generateMipmaps=false;
  return rt;
}
function fsMat(frag,uniforms){
  return new T.ShaderMaterial({uniforms,vertexShader:
    `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:frag,depthTest:false,depthWrite:false});
}
function buildPost(){
  const w=W.W,h=W.H;
  W.rtScene=makeRT(w,h,true);
  W.rtBright=makeRT(w/2,h/2,false);
  W.rtBlurA=makeRT(w/4,h/4,false);
  W.rtBlurB=makeRT(w/4,h/4,false);
  W.quadGeo=new T.PlaneGeometry(2,2);
  W.quadScene=new T.Scene();W.quadCam=new T.OrthographicCamera(-1,1,1,-1,0,1);
  W.quad=new T.Mesh(W.quadGeo,new T.MeshBasicMaterial());W.quadScene.add(W.quad);

  W.mBright=fsMat(
    `uniform sampler2D tD;uniform float uTh;varying vec2 vUv;
     void main(){vec3 c=texture2D(tD,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));
       float k=smoothstep(uTh,uTh+.42,l);gl_FragColor=vec4(c*k,1.);}`,
    {tD:{value:W.rtScene.texture},uTh:{value:1.45}});
  const blurFrag=
    `uniform sampler2D tD;uniform vec2 uDir;varying vec2 vUv;
     void main(){vec3 s=vec3(0.);
       s+=texture2D(tD,vUv).rgb*.227027;
       s+=texture2D(tD,vUv+uDir*1.).rgb*.1945946;
       s+=texture2D(tD,vUv-uDir*1.).rgb*.1945946;
       s+=texture2D(tD,vUv+uDir*2.).rgb*.1216216;
       s+=texture2D(tD,vUv-uDir*2.).rgb*.1216216;
       s+=texture2D(tD,vUv+uDir*3.).rgb*.054054;
       s+=texture2D(tD,vUv-uDir*3.).rgb*.054054;
       s+=texture2D(tD,vUv+uDir*4.).rgb*.016216;
       s+=texture2D(tD,vUv-uDir*4.).rgb*.016216;
       gl_FragColor=vec4(s,1.);}`;
  W.mBlur=fsMat(blurFrag,{tD:{value:null},uDir:{value:new T.Vector2()}});
  W.mComposite=fsMat(
    `uniform sampler2D tD,tDepth,tBloom;
     uniform vec2 uRes,uVel;
     uniform float uNear,uFar,uFocus,uDof,uMotion,uBloom,uTime,uGrain,uVig,uExp;
     varying vec2 vUv;
     float lind(float d){float z=d*2.-1.;return (2.*uNear*uFar)/(uFar+uNear-z*(uFar-uNear));}
     vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
     void main(){
       float dep=texture2D(tDepth,vUv).r;
       float lin=lind(dep);
       float coc=clamp(abs(lin-uFocus)/max(uDof,.001),0.,1.);coc=coc*coc;
       vec2 px=1./uRes;
       vec3 acc=texture2D(tD,vUv).rgb;float wsum=1.;
       for(int i=1;i<=12;i++){
         float f=float(i)/12.;
         vec2 mo=uVel*f*uMotion;
         float ang=float(i)*2.39996;
         vec2 disk=vec2(cos(ang),sin(ang))*coc*9.0*px*float(i)*.16;
         vec3 s=texture2D(tD,clamp(vUv+mo+disk,0.,1.)).rgb;
         acc+=s;wsum+=1.;
       }
       vec3 base=acc/wsum;
       vec3 c=base+texture2D(tBloom,vUv).rgb*uBloom;
       c*=uExp;
       c=aces(c);
       vec2 q=vUv-.5;c*=clamp(1.-dot(q,q)*uVig,0.,1.);
       float g=fract(sin(dot(vUv*uRes+vec2(uTime*37.),vec2(12.9898,78.233)))*43758.5453);
       c+=(g-.5)*uGrain;
       c=pow(max(c,0.),vec3(1./2.2));
       gl_FragColor=vec4(c,1.);
     }`,
    {tD:{value:W.rtScene.texture},tDepth:{value:W.rtScene.depthTexture},
     tBloom:{value:W.rtBlurB.texture},uRes:{value:new T.Vector2(w,h)},
     uVel:{value:new T.Vector2()},uNear:{value:.1},uFar:{value:600},
     uFocus:{value:16},uDof:{value:26},uMotion:{value:0},uBloom:{value:.75},
     uTime:{value:0},uGrain:{value:.018},uVig:{value:.85},uExp:{value:1.15}});
}
W.blit=(mat,target)=>{
  W.quad.material=mat;W.renderer.setRenderTarget(target||null);
  W.renderer.render(W.quadScene,W.quadCam);
};

/* ---------------- camera ---------------- */
W.cameraSample=null; // provided by director
W.updateCamera=(p,t,st)=>{
  const s=W.cameraSample?W.cameraSample(p,st):{pos:[0,7,20],look:[0,0,0],fov:38};
  const cam=W.camera;
  const look=V(s.look[0],s.look[1],s.look[2]);
  // user orbit around look target
  const base=V(s.pos[0],s.pos[1],s.pos[2]);
  const dir=base.clone().sub(look);
  const radius=dir.length()*st.userZoom;
  let theta=Math.atan2(dir.x,dir.z)+st.userYaw;
  let phi=Math.acos(U.clamp(dir.y/(dir.length()||1),-1,1))-st.userPitch;
  phi=U.clamp(phi,.12,Math.PI-.12);
  cam.position.set(look.x+radius*Math.sin(phi)*Math.sin(theta),
                   look.y+radius*Math.cos(phi),
                   look.z+radius*Math.sin(phi)*Math.cos(theta));
  cam.lookAt(look);
  if(cam.fov!==s.fov){cam.fov=s.fov;cam.updateProjectionMatrix();}
  cam.updateMatrixWorld();
  W._look=look;
};

/* ---------------- render ---------------- */
W.render=()=>{
  const r=W.renderer,u=W.mComposite.uniforms;
  // 1) scene -> rtScene
  r.setRenderTarget(W.rtScene);r.clear();r.render(W.scene,W.camera);
  // 2) bright pass
  W.mBright.uniforms.tD.value=W.rtScene.texture;
  W.blit(W.mBright,W.rtBright);
  // 3) blur ping-pong
  const px=1/W.rtBlurA.width,py=1/W.rtBlurA.height;
  W.mBlur.uniforms.tD.value=W.rtBright.texture;
  W.mBlur.uniforms.uDir.value.set(px*1.6,0);W.blit(W.mBlur,W.rtBlurA);
  W.mBlur.uniforms.tD.value=W.rtBlurA.texture;
  W.mBlur.uniforms.uDir.value.set(0,py*1.6);W.blit(W.mBlur,W.rtBlurB);
  W.mBlur.uniforms.tD.value=W.rtBlurB.texture;
  W.mBlur.uniforms.uDir.value.set(px*3.2,0);W.blit(W.mBlur,W.rtBlurA);
  W.mBlur.uniforms.tD.value=W.rtBlurA.texture;
  W.mBlur.uniforms.uDir.value.set(0,py*3.2);W.blit(W.mBlur,W.rtBlurB);
  // 4) composite -> screen
  u.tD.value=W.rtScene.texture;u.tDepth.value=W.rtScene.depthTexture;
  u.tBloom.value=W.rtBlurB.texture;
  u.uNear.value=W.camera.near;u.uFar.value=W.camera.far;
  u.uFocus.value=W.camera.position.distanceTo(W._look||V(0,0,0));
  u.uTime.value=A.T;
  // analytic motion vector from camera path derivative (deterministic)
  if(W.cameraSample){
    const p=A.P,eps=.004;
    const a=W.cameraSample(p,{}),b=W.cameraSample(Math.min(1,p+eps),{});
    const la=V(a.look[0],a.look[1],a.look[2]),lb=V(b.look[0],b.look[1],b.look[2]);
    const pa=V(a.pos[0],a.pos[1],a.pos[2]),pb=V(b.pos[0],b.pos[1],b.pos[2]);
    const dv=pa.clone().sub(la),wv=pb.clone().sub(lb);
    const dd=wv.sub(dv).multiplyScalar(1/eps);
    u.uVel.value.set(U.clamp(-dd.x*.00035,-.02,.02),U.clamp(dd.y*.00035,-.02,.02));
  }
  W.blit(W.mComposite,null);
};

W.resize=()=>{
  const w=A.W,h=A.H;W.W=w;W.H=h;
  W.renderer.setSize(w,h,false);
  W.camera.aspect=w/h;W.camera.updateProjectionMatrix();
  [W.rtScene,W.rtBright,W.rtBlurA,W.rtBlurB].forEach(rt=>{if(rt)rt.dispose();});
  buildPost();
  W.mComposite.uniforms.uRes.value.set(w,h);
};

/* ---------------- init ---------------- */
W.init=()=>{
  W.W=A.W;W.H=A.H;
  const canvas=document.getElementById('gl');
  const r=W.renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,
    preserveDrawingBuffer:true,powerPreference:'high-performance'});
  r.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  r.setSize(W.W,W.H,false);
  r.setClearColor(0x05070a,1);
  r.outputColorSpace=T.LinearSRGBColorSpace;
  r.toneMapping=T.NoToneMapping;
  r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;
  r.localClippingEnabled=true;
  W.gl=r.getContext();

  W.scene=new T.Scene();
  W.scene.background=new T.Color(0x05070a);
  W.camera=new T.PerspectiveCamera(38,W.W/W.H,.1,900);
  W.camera.position.set(0,7,20);
  W.G.root=new T.Group();W.scene.add(W.G.root);

  materials();
  W.scene.environment=makeEnv();

  // lighting
  const hemi=new T.HemisphereLight(0x9fc6e8,0x0a1016,.32);W.scene.add(hemi);
  const key=new T.DirectionalLight(0xffffff,1.0);
  key.position.set(-12,20,14);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  key.shadow.camera.left=-22;key.shadow.camera.right=22;
  key.shadow.camera.top=22;key.shadow.camera.bottom=-22;
  key.shadow.camera.near=1;key.shadow.camera.far=90;
  key.shadow.bias=-.0007;W.scene.add(key);W.keyLight=key;
  const fill=new T.DirectionalLight(0x54d3e8,.48);fill.position.set(16,7,-8);W.scene.add(fill);
  const rim=new T.DirectionalLight(0x8bd44e,.34);rim.position.set(0,-6,-16);W.scene.add(rim);
  const pt=new T.PointLight(0xe8a83d,8,40);pt.position.set(0,6,4);W.scene.add(pt);W.accent=pt;
  const front=new T.DirectionalLight(0xa9c8e8,.55);front.position.set(0,4,34);W.scene.add(front);

  // clipping plane shared by all materials
  W.clipPlane=new T.Plane(V(-1,0,0),200);
  W.allMats.forEach(m=>{m.clippingPlanes=[W.clipPlane];m.clipShadows=true;});

  buildGround();
  buildPackage();
  buildSystems();
  buildFlows();
  buildPost();
};

})();
