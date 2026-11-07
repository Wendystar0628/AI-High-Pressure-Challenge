/* ============================================================
   director.js — camera path, chapter animation, transitions,
                 and the derived state shared by SVG / UI
   ============================================================ */
(function () {
'use strict';
const A=window.APP, T=window.THREE, U=A.util;
const D=A.Director={};
const V=(x,y,z)=>new T.Vector3(x,y,z);

/* continuous camera keyframes — all systems share the origin,
   so chapter 06 reads as one uninterrupted dolly-back */
const CAM=[
  {p:0.000,pos:[0,10.5,23],   look:[0,.6,0],    fov:34},
  {p:0.050,pos:[0,7.6,17.5],  look:[0,.7,0],    fov:33},
  {p:0.112,pos:[8.5,9.5,17],  look:[0,1.5,0],   fov:39},
  {p:0.185,pos:[9.5,8.5,14],  look:[0,1.9,0],   fov:37},
  {p:0.256,pos:[2.6,11,16.5], look:[0,1.1,0],   fov:34},
  {p:0.320,pos:[.2,10.5,14.5],look:[0,1.1,0],   fov:33},
  {p:0.366,pos:[-9,6.5,13.5], look:[-4.6,1.3,0],fov:41},
  {p:0.446,pos:[0,6.2,12.5],  look:[0,1.35,0],  fov:41},
  {p:0.526,pos:[9,6.5,13.5],  look:[4.6,1.3,0], fov:41},
  {p:0.558,pos:[-1.7,4.6,8.5],look:[-1.7,1.1,0],fov:26},
  {p:0.630,pos:[0,8,18],      look:[0,.8,0],    fov:34},
  {p:0.666,pos:[0,10,22],     look:[0,.6,0],    fov:36},
  {p:0.710,pos:[0,15,34],     look:[0,0,0],     fov:38},
  {p:0.756,pos:[0,21,50],     look:[0,0,0],     fov:38},
  {p:0.808,pos:[0,32,86],     look:[0,0,0],     fov:38},
  {p:0.852,pos:[0,26,70],     look:[0,0,0],     fov:36},
  {p:0.898,pos:[0,9.5,21],    look:[0,.7,0],    fov:34},
  {p:1.000,pos:[0,8.6,19.5],  look:[0,.7,0],    fov:33}
];
D.camAt=(p)=>{
  p=U.clamp(p,0,1);
  let i=0;while(i<CAM.length-2&&p>CAM[i+1].p)i++;
  const k0=CAM[Math.max(0,i-1)],k1=CAM[i],k2=CAM[i+1],k3=CAM[Math.min(CAM.length-1,i+2)];
  const t=U.clamp((p-k1.p)/((k2.p-k1.p)||1),0,1);
  return {pos:U.catmull(k0.pos,k1.pos,k2.pos,k3.pos,t),
          look:U.catmull(k0.look,k1.look,k2.look,k3.look,t),
          fov:U.catmull(k0.fov,k1.fov,k2.fov,k3.fov,t)};
};

D.products=[
  {key:'B200',name:'B200',sub:'单颗 GPU · 2 dies'},
  {key:'HGX',name:'HGX B200',sub:'8 × B200 平台'},
  {key:'DGX',name:'DGX B200',sub:'8 GPU 完整系统'},
  {key:'GB200',name:'GB200',sub:'1 Grace + 2 GPU'},
  {key:'NVL72',name:'GB200 NVL72',sub:'36 CPU + 72 GPU'}
];
D.regions=[
  {name:'计算阵列 SM / Tensor Core',color:'#8bd44e'},
  {name:'L2 缓存 CACHE',color:'#e8a83d'},
  {name:'HBM 显存接口 PHY',color:'#54d3e8'},
  {name:'NVLink 端口',color:'#a98bff'}
];
D.partsMeta=[
  {name:'solder',label:'焊球阵列',id:'P01'},
  {name:'substrate',label:'基板 / 铜走线',id:'P02'},
  {name:'interposer',label:'硅中介层',id:'P03'},
  {name:'bumps',label:'微凸点',id:'P04'},
  {name:'hbm',label:'8 × HBM3e',id:'P05'},
  {name:'dies',label:'两颗计算晶粒',id:'P06'},
  {name:'bridge',label:'片间互连',id:'P07'},
  {name:'lid',label:'加固盖框',id:'P08'}
];

D.init=()=>{
  A.World.cameraSample=D.camAt;
  D.derived={
    w:[0,0,0,0,0,0,0,0], locals:[0,0,0,0,0,0,0,0], ci:0,
    explode:0,seam:0,section:.5,cutX:0,sectionOn:0,
    product:0,fmtWalk:'FP64',walkIdx:0,detail:0,
    hbmSpread:0,flatten:0,hProgress:0,
    dopW:0,uvWeight:0
  };
};

/* ---------- main per-frame update ---------- */
D.update=(p,t,st)=>{
  const W=A.World,G=W.G,dd=D.derived;
  for(let i=0;i<8;i++){dd.w[i]=A.chapterWeight(i,p);dd.locals[i]=A.localProgress(i,p);}
  dd.ci=A.chapterIndex(p);
  const w=dd.w,L=dd.locals;

  /* --- global precision derived numbers --- */
  const fmt=A.FORMATS[st.precision];
  dd.bits=fmt.bits;
  dd.fmtWalk=A.FORMAT_ORDER[U.clamp(Math.floor(L[4]*6),0,5)];
  dd.walkIdx=U.clamp(Math.floor(L[4]*6),0,5);

  /* --- explode / seam / section (scroll baseline + user override) ---
     Gated to chapter 02/03 so leaving the disassembly smoothly returns the
     package to its assembled state instead of leaking into later chapters. */
  const exBase=U.sstep(.04,.78,L[1])*w[1];
  const ex=st.explodeUser?st.explode*w[1]:exBase;
  dd.explode=ex;
  const autoSeam=U.sstep(.28,.86,L[1])*.58*w[1];
  const seam=st.seamUser?st.seam*Math.max(w[1],w[2]):autoSeam;
  dd.seam=seam;
  dd.section=st.section;
  dd.cutX=U.lerp(-5.2,5.2,st.section);
  dd.sectionOn=U.sstep(.12,.72,w[1]);

  /* --- package self rotation (continuous, no scroll jumps) --- */
  const intro=.34*(1-U.sstep(0,.42,L[0]));
  G.pkg.rotation.y=intro+t*.075;
  G.pkg.rotation.x=0;

  /* --- explode parts --- */
  W.PARTS.forEach(pt=>{
    const target=pt.obj.userData.base.clone().addScaledVector(pt.dir,pt.dist*ex);
    pt.obj.position.copy(target);
  });
  /* HBM internal layer spread + TSV reveal (also opens in chapter 04) */
  dd.hbmSpread=Math.max(ex,U.sstep(.10,.85,L[3])*w[3]*.78);
  const hs=dd.hbmSpread;
  G.hbmStacks.forEach(stack=>{
    stack.layers.forEach(l=>{l.mesh.position.y=l.base+(l.i-3.5)*.115*hs;});
    stack.bumps.forEach(b=>{b.mesh.position.y=b.base+(b.i-3.5)*.115*hs;});
    stack.tsvs.forEach((rod,k)=>{
      rod.scale.y=1+hs*.85;
      rod.material.emissiveIntensity=.35+hs*.5;
    });
  });

  /* --- die seam: stretch bridge, stop pulses at break --- */
  const gap=seam*2.2;
  G.dieA.g.position.x=-1.72-gap*.5;
  G.dieB.g.position.x= 1.72+gap*.5;
  G.bridgeLines.forEach(l=>{l.scale.x=1+gap*1.5;});
  const glowOn=U.clamp(1-seam*1.8,0,1);
  G.bridgeGlow.forEach(l=>{l.material.opacity=glowOn*.75;l.visible=glowOn>.02;});
  dd.bridgeStretch=1+gap*1.5;

  /* --- 3D -> 2D die flatten inside chapter 03 --- */
  dd.flatten=U.sstep(.18,.82,L[2])*w[2];
  const flat=dd.flatten;
  [G.dieA,G.dieB].forEach(d=>{
    d.g.scale.y=1-flat*.93;
    d.g.position.y=flat*.12;
  });

  /* --- detail focus: zoom package toward the selected part --- */
  const detailTarget=st.selectedPart?W.PARTS.find(q=>q.name===st.selectedPart):null;
  const dSince=st.detailSince||0;
  dd.detail=st.selectedPart?U.sstep(0,.42,t-dSince)*(st.partDetail===2?1.25:.85):0;
  const dz=dd.detail;
  if(detailTarget&&dz>0){
    const c=detailTarget.center;
    G.pkg.scale.setScalar(1+dz*.85);
    G.pkg.position.set(-c.x*dz*.85,-c.y*dz*.85+.15*dz,0);
  }else{
    G.pkg.scale.setScalar(1);G.pkg.position.set(0,0,0);
  }

  /* --- clipping / solid cross-section --- */
  W.clipPlane.constant=dd.cutX+(1-dd.sectionOn)*15;
  W.sectionSlab.visible=dd.sectionOn>.05;
  W.sectionSlab.position.x=dd.cutX-.07;
  W.sectionSlab.material.opacity=dd.sectionOn;
  W.sectionSlab.material.transparent=true;

  /* --- compute-unit activation: selected functional region stays lit
         across chapters 03 → 04 → 08, plus the chapter 05 MAC wave --- */
  const act=w[4],regW=Math.max(w[2],w[7]*.55);
  const REG=[[.55,.83,.31],[.91,.66,.24],[.33,.83,.91],[.66,.55,1.0]];
  [G.dieA,G.dieB].forEach(d=>{
    const col=new T.Color();
    for(let i=0;i<d.n;i++){
      const c=i%d.cols,r=(i/d.cols)|0;
      const region=(c<6&&r<9)?0:(r>=9?1:(c>=9?2:3));
      const sel=region===st.region,hc=REG[region];
      const phase=Math.sin(t*2.2+i*.37)*.5+.5;
      const amp=act*(.25+.75*phase)*(.4+.6*U.hash(i+Math.floor(t*3)));
      const k=sel?regW*.62:0;
      col.setRGB(.12+amp*.5+hc[0]*k,.22+amp*.72+hc[1]*k,.30+amp*.36+hc[2]*k);
      d.cores.setColorAt(i,col);
    }
    d.cores.instanceColor.needsUpdate=true;
  });

  /* --- systems: product selection + continuous scale morph --- */
  // product 0 = single B200 (package itself); 1..4 = HGX / DGX / GB200 / NVL72
  const autoProd=U.clamp(Math.floor(L[5]*5),0,4);
  const prod=st.productUser?st.product:autoProd;
  dd.product=prod;
  const si=prod-1;                       // system-group index, -1 = none
  const zoomOut=U.sstep(0,.95,L[5]);
  const sysOn=Math.max(w[5],w[6]);
  const pkgFull=(si<0)?sysOn:0;         // keep the package prominent for single-GPU view
  const pkgVis=U.clamp(1-sysOn*.94+pkgFull*.92,.06,1);
  G.pkg.visible=true;
  G.pkg.scale.multiplyScalar(U.lerp(.32,1,pkgVis));
  const sysGroups=[G.hgx,G.srv,G.gb200,G.racks];
  const sysScale=[U.lerp(.42,1,zoomOut),U.lerp(.36,1,zoomOut),
                  U.lerp(.50,1,zoomOut),U.lerp(.13,1,zoomOut)];
  sysGroups.forEach((g,i)=>{
    const on=(i===si)?sysOn:0;
    g.visible=on>.02;
    g.scale.setScalar(sysScale[i]);
    g.rotation.y=t*.02*(i===3?1:0);
  });

  /* --- light animation (shadows follow) --- */
  W.keyLight.position.set(-12+3.2*Math.sin(t*.24),20,14+2.4*Math.cos(t*.19));
  W.accent.intensity=3.2+1.2*Math.sin(t*1.1);
  // time-varying thin-film interference
  const ir=W.M.silicon.iridescenceThicknessRange;
  ir[0]=120+45*Math.sin(t*.5);ir[1]=420+45*Math.sin(t*.5);
  const ir2=W.M.dieTop.iridescenceThicknessRange;
  ir2[0]=160+40*Math.sin(t*.5+1);ir2[1]=520+40*Math.sin(t*.5+1);

  /* --- data flows --- */
  const F=W.flows;
  const seamW=U.sstep(.18,.55,seam);
  const flow=(f,speed,weight,tt)=>{
    const vis=weight>.012;f.pts.visible=vis;
    if(vis)f.update(tt===undefined?t:tt,speed,weight);
  };
  // chapter 04 replay resets the whole batch to the start of its path
  const t4=Math.max(0,t-st.replay4);
  const ch3w=Math.max(w[2],w[1]*.55);
  flow(F.seam,.48,(1-seamW)*ch3w,Math.max(0,t-st.replay3));
  flow(F.seamBroken,.42,seamW*ch3w);
  flow(F.hbm,.30,w[3],t4);
  flow(F.result,.34,w[3]*.9,t4);
  const nvOn=sysOn*((si===0||si===1)?1:.35);
  flow(F.nvlink,.34,nvOn);
  flow(F.rack,.26,sysOn*(si===3?1:.18));
  flow(F.work,.22,w[7]);

  /* --- post effect parameters --- */
  let bp=0;
  for(let i=1;i<8;i++)bp=Math.max(bp,1-Math.abs(p-A.chapters[i].start)/(A.TW*1.6));
  bp=U.clamp(bp,0,1);
  const u=W.mComposite.uniforms;
  u.uMotion.value=.22+1.35*bp+w[3]*.55;
  const dofTargets=[30,13,12,20,17,55,42,26];
  let dof=0,ws=0;
  for(let i=0;i<8;i++){dof+=dofTargets[i]*w[i];ws+=w[i];}
  u.uDof.value=ws>0?dof/ws:30;
  u.uBloom.value=.34+.10*w[0]+.12*w[7];
  u.uGrain.value=.014;
  u.uVig.value=.78;
  u.uExp.value=.82;

  /* --- horizontal segment derived progress --- */
  dd.hProgress=L[3];
  dd.uvWeight=w[3];
};

})();
