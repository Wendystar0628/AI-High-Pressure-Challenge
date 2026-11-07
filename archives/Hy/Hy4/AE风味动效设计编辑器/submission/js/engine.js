/* =========================================================================
   engine.js — evaluate a project/composition at time t into a render frame.
   All layer types, fields, deformations, particles, camera, lights, post.
   Pure function of (project, comp, t): deterministic, jump-safe, no side effects.
   ========================================================================= */
(function(AE){
'use strict';
const V=AE.V,M=AE.M,lerp=AE.lerp,clamp=AE.clamp,G=AE.Glyphs,MODE=AE.MODE;
const DEF=[0,0,0,1];

/* ---------------------------------------------------------------- helpers */
function col(c,d){return c||d||[1,1,1,1];}
function evalP(layer,key,t,project,comp,def){
  const p=layer.props&&layer.props[key];
  if(!p)return def;
  const v=AE.evalPropAt(p,t,project,comp,layer,{});
  return v===undefined?def:v;
}
function nz(v,d){return (typeof v==='number'&&isFinite(v))?v:d;}
function v3(v,d){if(Array.isArray(v))return [nz(v[0],d[0]),nz(v[1],d[1]),nz(v[2],d[2]||0)];return d.slice();}

AE.evalP=evalP;

/* ---------------------------------------------------------------- node graph evaluation
   A small pure dataflow evaluator: the procedural node graph really drives
   repeat counts, field strength and emission rate in the composition. */
AE.nodeValue=(project,ref,t)=>{
  const g=project&&project.nodeGraph;if(!g||!ref)return 1;
  const parts=String(ref).split(':'),nid=parts[0],outIdx=parseInt(parts[1]||'0',10);
  const memo={};
  const F={
    pathInput:()=>[1],textInput:()=>[1],
    distribute:(v)=>[clamp(Math.round(v[1]===undefined?10:v[1]*2.5),1,24)],
    transform:(v)=>[v[0]===undefined?1:v[0]],
    resample:(v)=>[v[1]===undefined?1:v[1]],
    noise:(v)=>[0.5+0.5*AE.noise1(t*0.8+(v[1]===undefined?0.5:v[1]),7.3)],
    falloff:(v)=>{const w=clamp(1-(v[1]===undefined?100:v[1])/500,0,1);return [w,w];},
    mix:(v)=>[((v[0]===undefined?1:v[0])+(v[1]===undefined?1:v[1]))*(v[2]===undefined?1:v[2])],
    meshDeform:(v)=>[v[0]===undefined?1:v[0]],
    emitter:(v)=>[clamp(Math.round(v[2]===undefined?70:v[2]*70),10,300)],
    collider:(v)=>[v[0]===undefined?1:v[0]],
    output:(v)=>[v[0]===undefined?1:v[0]],
    group:(v)=>[(v[0]===undefined?1:v[0])*(v[1]===undefined?1:v[1])]
  };
  const evalNode=(id)=>{
    if(memo[id])return memo[id];
    memo[id]=[1];                               // cycle guard
    const n=g.nodes.find(x=>x.id===id);
    if(!n)return memo[id];
    const v=[];
    for(const l of g.links)if(l.to.n===id){
      const o=evalNode(l.from.n);
      v[l.to.p]=o[l.from.p]===undefined?1:o[l.from.p];
    }
    const fn=F[n.type]||((vv)=>[vv[0]===undefined?1:vv[0]]);
    memo[id]=fn(v);
    return memo[id];
  };
  const o=evalNode(nid);
  return o[outIdx]===undefined?1:o[outIdx];
};

/* world-space quad helpers ----------------------------------------------- */
function quadVerts(cx,cy,cz,w,h,color,mat,uv,mode,dep){
  const x0=cx-w/2,x1=cx+w/2,y0=cy-h/2,y1=cy+h/2;
  const n=[0,0,1];
  const U=uv||[[0,0],[1,0],[1,1],[0,1]];
  const m=mat||[0,1,0,mode===undefined?MODE.FLAT:mode];
  const a=AE.v([x0,y0,cz],n,color,m,U[0],dep);
  const b=AE.v([x1,y0,cz],n,color,m,U[1],dep);
  const c=AE.v([x1,y1,cz],n,color,m,U[2],dep);
  const d=AE.v([x0,y1,cz],n,color,m,U[3],dep);
  return [a,b,c,d];
}
AE.quadVerts=quadVerts;

function pushQuad(batch,q,matrix){
  const f=(v)=>{const p=matrix?M.xform(matrix,v.p):v.p;return AE.v(p,v.n,v.c,v.m,v.uv,v.dep);};
  batch.quad(f(q[0]),f(q[1]),f(q[2]),f(q[3]));
}
AE.pushQuad=pushQuad;

/* add a soft radial sprite (glow / shadow / particle) */
function pushSprite(batch,cx,cy,cz,w,h,color,mode,matrix){
  const q=quadVerts(cx,cy,cz,w,h,color,[0,1,0,mode===undefined?MODE.SPRITE:mode],null,MODE.SPRITE,0);
  pushQuad(batch,q,matrix);
}
AE.pushSprite=pushSprite;

/* ---------------------------------------------------------------- fields */
function collectFields(ctx){
  const out=[];
  for(const L of ctx.comp.layers){
    if(L.type!=='field'||!L.enabled)continue;
    const d=L.data||{};
    const t=ctx.t;
    out.push({
      kind:d.kind||'radial',
      x:evalP(L,'position',t,ctx.project,ctx.comp,[0,0,0])[0],
      y:evalP(L,'position',t,ctx.project,ctx.comp,[0,0,0])[1],
      z:(evalP(L,'position',t,ctx.project,ctx.comp,[0,0,0])[2])||0,
      radius:nz(evalP(L,'fieldRadius',t,ctx.project,ctx.comp,d.radius||400),400),
      strength:nz(evalP(L,'fieldStrength',t,ctx.project,ctx.comp,d.strength||1),1)*
        (d.nodeStrength?(0.45+1.1*AE.nodeValue(ctx.project,d.nodeStrength,t)):1),
      seed:(d.seed||1)+(ctx.project.seed||7),
      mode:d.mode||'push',
      color:col(d.color,[0.4,0.8,1,1]),
      visible:d.visible!==false,
      id:L.id, name:L.name
    });
  }
  return out;
}
/* returns {w, disp:[dx,dy,dz]} for a point in layer-local coords */
function sampleFields(fields,x,y,z){
  let w=0,dx=0,dy=0,dz=0;
  for(const f of fields){
    const rx=x-f.x, ry=y-f.y, rz=(z||0)-f.z;
    const dist=Math.hypot(rx,ry,rz);
    let q=clamp(1-dist/f.radius,0,1); q=q*q*(3-2*q);
    if(q<=0)continue;
    w=Math.max(w,q);
    const s=f.strength;
    if(f.kind==='vortex'){
      const a=q*s*1.6;
      dx+=(-ry)*a*0.9; dy+=(rx)*a*0.9; dz+=q*s*18;
    } else if(f.kind==='noise'){
      const n1=AE.fbm(x*0.01+f.seed+ (window.__aeTime||0)*0.15,f.seed,2)-0.5;
      const n2=AE.fbm(y*0.01+f.seed+9.7,f.seed+3,2)-0.5;
      dx+=n1*q*s*90;dy+=n2*q*s*90;dz+=q*s*24;
    } else { // radial push / falloff
      const dl=dist||1;
      dx+=(rx/dl)*q*s*60;dy+=(ry/dl)*q*s*60;dz+=q*s*40;
    }
  }
  return {w,disp:[dx,dy,dz]};
}
AE.sampleFields=sampleFields;

/* ---------------------------------------------------------------- text layout */
/* returns array of {ch,x,y,w,h,adv,index,line,word} in local coords */
AE.layoutText=(d,t,size)=>{
  const str=String(d.str||'');
  size=size||d.size||80;
  const lines=str.split('\n');
  const lh=size*(d.lineHeight||1.2);
  const tracking=d.tracking||0;
  const out=[];let maxW=0;
  const cell=G.cell;
  const ratio=(ch)=>{const i=G.info(ch);return i?(i.w/cell):0.55;};
  const measure=(s)=>{let w=0;for(const ch of s)w+=ratio(ch)*size+tracking;return w;};
  for(let li=0;li<lines.length;li++){
    const line=lines[li];const lw=measure(line);maxW=Math.max(maxW,lw);
    let x=0;
    const align=d.align||'center';
    if(align==='center')x=-lw/2; else if(align==='right')x=-lw;
    let word=0;
    for(let ci=0;ci<line.length;ci++){
      const ch=line[ci];
      const adv=ratio(ch)*size+tracking;
      if(ch===' '){word++;x+=adv;continue;}
      // the quad maps ONE atlas cell (one em) to a size×size square, so glyphs
      // keep their true aspect at any display size; advance stays proportional
      out.push({ch,x:x+adv/2,y:(li-(lines.length-1)/2)*lh,w:size,h:size,adv,index:out.length,line:li,word,ci});
      x+=adv;
    }
  }
  return {chars:out,width:maxW,height:lines.length*lh};
};

/* push a text layer (optionally along a path, with a range animator) */
function pushText(ctx,batch,L,d,matrix,opt){
  opt=opt||{};
  const t=ctx.t;
  const size=nz(evalP(L,'fontSize',t,ctx.project,ctx.comp,d.size||80),80);
  const color=col(d.color,[1,1,1,1]);
  const layout=AE.layoutText(d,t,size);
  const extr=opt.extrude||d.extrude;
  const charAnim=d.animator;
  const path=d.pathText;
  const opacity=nz(evalP(L,'opacity',t,ctx.project,ctx.comp,100),100)/100;
  for(const g of layout.chars){
    const info=G.info(g.ch);if(!info)continue;
    let px=g.x,py=g.y,rot=0,sc=1,alpha=opacity,ex=0,ey=0;
    // range animator (per char / word / line)
    if(charAnim){
      const by=charAnim.by||'char';
      const idx=by==='word'?g.word:(by==='line'?g.line:g.index);
      const count=by==='word'?layout.chars.reduce((m,c)=>Math.max(m,c.word),0)+1:
                  (by==='line'?(d.str||'').split('\n').length:layout.chars.length);
      const start=charAnim.start===undefined?0:charAnim.start;
      const end=charAnim.end===undefined?1:charAnim.end;
      const offset=nz(evalP(L,'animOffset',t,ctx.project,ctx.comp,charAnim.offset||0),0);
      const span=(end-start)||1;
      let u=(idx/Math.max(1,count-1)-start)/span + offset;
      const soft=charAnim.soft||0.15;
      let sel;
      if(soft<=0)sel=(u>=0&&u<=1)?1:0;
      else sel=clamp(Math.min(u,1-u)/soft+0.5,0,1);
      // fade in from offset (stagger)
      const rise=clamp((t-(charAnim.t0||0))/(charAnim.dur||1),0,1);
      const ae=AE.easeValue(rise,charAnim.ease||'easeOut');
      sel*=ae;
      const amp=charAnim.amp===undefined?1:charAnim.amp;
      px+=(charAnim.dx||0)*sel*amp;
      py+=(charAnim.dy===undefined?-60:charAnim.dy)*(1-sel)*amp;
      rot+=(charAnim.rot||0)*sel*amp;
      sc*=1+((charAnim.scale===undefined?-0.4:charAnim.scale))*sel*amp;
      alpha*=1-((charAnim.fade===undefined?1:charAnim.fade)*(1-sel)*amp);
      alpha=clamp(alpha,0,1);
    }
    // path text: remap along a path
    if(path&&path.points&&path.points.length>1){
      const pts=AE.resample(path.points,120);
      const u=clamp((g.index/Math.max(1,layout.chars.length-1))*(path.end||1)+(path.start||0),0,0.999);
      const f=u*(pts.length-1),i=Math.floor(f),fr=f-i;
      const a=pts[i],b=pts[Math.min(i+1,pts.length-1)];
      px=a[0]+(b[0]-a[0])*fr;py=a[1]+(b[1]-a[1])*fr;
      const ang=Math.atan2(b[1]-a[1],b[0]-a[0]);
      if(path.orient!==false)rot+=ang;
      py+=path.perp||0;
    }
    const c=[color[0],color[1],color[2],color[3]*alpha];
    const w=g.w*sc*1.02,h=g.h*sc;
    const U=[[info.u0,info.v0],[info.u1,info.v0],[info.u1,info.v1],[info.u0,info.v1]];
    let q=quadVerts(px,py,0,w,h,c,[0,1,0,MODE.TEX],U,MODE.TEX,0);
    if(rot){const co=Math.cos(rot),si=Math.sin(rot);
      q=q.map(v=>{const x=v.p[0]-px,y=v.p[1]-py;v.p=[px+x*co-y*si,py+x*si+y*co,v.p[2]];return v;});}
    if(extr&&extr.depth>0){
      const steps=Math.max(2,Math.round(extr.depth/6));
      const dx=(extr.dx||0.5),dy=(extr.dy||0.6);
      for(let s=steps;s>=1;s--){
        const k=s/steps;
        const q2=q.map(v=>{const vv=Object.assign({},v);vv.p=[v.p[0]+dx*extr.depth*k,v.p[1]+dy*extr.depth*k,v.p[2]-extr.depth*0.15*k];
          vv.c=[c[0]*0.30,c[1]*0.33,c[2]*0.44,c[3]*0.92];vv.m=[0,1,0,MODE.TEX];return vv;});
        pushQuad(batch,q2,matrix);
      }
    }
    pushQuad(batch,q,matrix);
  }
  return layout;
}

/* ---------------------------------------------------------------- shape layers */
function shapeContoursAt(ctx,L,d){
  const t=ctx.t;
  const sh=d.shape||{kind:'ellipse',rx:120,ry:120};
  let contours;
  if(sh.boolean){
    const mode=nz(evalP(L,'boolMode',t,ctx.project,ctx.comp,0),0);
    const rev=nz(evalP(L,'boolReverse',t,ctx.project,ctx.comp,0),0)>0.5;
    const b=Object.assign({},sh.boolean,{mode,reverse:rev});
    contours=AE.booleanContours(b,t,sh.res||64);
  } else {
    const inner=Object.assign({},sh);
    if(sh.morph)inner.morph=sh.morph;
    const c=AE.evalShape(inner,t);
    contours=[c.outer,...c.holes];
  }
  // field deformation of the contour
  if(d.fieldId||d.deformField){
    const fx=ctx.fields;
    if(fx.length){
      const deform=(p)=>{const q=sampleFields(fx,p[0],p[1],0);return [p[0]+q.disp[0]*(d.fieldAmp||1),p[1]+q.disp[1]*(d.fieldAmp||1)];};
      contours=contours.map(h=>h.map(deform));
    }
  }
  return contours;
}
function pushShapeTris(ctx,batch,L,d,contours,matrix,opt){
  opt=opt||{};
  const t=ctx.t;
  const a=opt.alpha===undefined?1:opt.alpha;
  const fc=col(d.fill,[0.3,0.8,0.8,0.9]);
  const fill=[fc[0],fc[1],fc[2],(fc[3]===undefined?1:fc[3])*a];
  const sc=col(d.stroke,null);
  const stroke=sc?[sc[0],sc[1],sc[2],(sc[3]===undefined?1:sc[3])*a]:null;
  const T=AE.triangulateContours(contours);
  const z=opt.z||0;
  // trim paths
  let trimS=0,trimE=1;
  if(d.trim){
    trimS=nz(evalP(L,'trimStart',t,ctx.project,ctx.comp,d.trim.start||0),0);
    trimE=nz(evalP(L,'trimEnd',t,ctx.project,ctx.comp,d.trim.end||1),1);
  }
  let reps=d.repeater?Math.max(1,Math.round(nz(evalP(L,'repeats',t,ctx.project,ctx.comp,d.repeater.copies||4),4))):1;
  if(d.nodeRepeats)reps=clamp(Math.round(AE.nodeValue(ctx.project,d.nodeRepeats,t)),1,32);
  const triCount=T.tris.length/3;
  const lo=Math.floor(trimS*triCount),hi=Math.ceil(clamp(trimE,0,1)*triCount);
  for(let r=0;r<reps;r++){
    let rm=M.ident();
    if(d.repeater){
      const o=d.repeater;
      const ang=AE.rad((o.rot||0)*r)+ (o.rotStep?AE.rad(o.rotStep)*r:0);
      rm=M.mul(M.translate((o.tx||0)*r,(o.ty||0)*r,0),rm);
      rm=M.mul(M.rotZ(ang),rm);
      const s=Math.pow((o.scale||1),r);rm=M.mul(M.scale(s,s,1),rm);
    }
    const mm=matrix?M.mul(matrix,rm):rm;
    for(let i=lo;i<hi;i++){
      const a=T.tris[i*3],b=T.tris[i*3+1],c=T.tris[i*3+2];
      if(!a)continue;
      const tri=[[a,b,c,[0,0,1],fill,[0.2,0.8,0,MODE.FLAT],[0,0]]];
      AE.pushTris(batch,tri,mm,null,{c:fill,m:[0.2,0.8,0,MODE.FLAT]});
    }
    // stroke as thin quads
    if(stroke&&d.strokeW>0){
      const sw=nz(evalP(L,'strokeW',t,ctx.project,ctx.comp,d.strokeW||3),3);
      for(const loop of contours){
        for(let j=0;j<loop.length;j++){
          const a=loop[j],b=loop[(j+1)%loop.length];
          if(j/Math.max(1,loop.length)<trimS||j/Math.max(1,loop.length)>trimE)continue;
          pushLine(batch,mm,a[0],a[1],b[0],b[1],sw,stroke,z+0.5);
        }
      }
    }
  }
}
function pushLine(batch,matrix,x0,y0,x1,y1,w,color,z){
  const dx=x1-x0,dy=y1-y0,l=Math.hypot(dx,dy)||1;
  const nx=-dy/l*w/2,ny=dx/l*w/2;
  const n=[0,0,1];
  const q=[AE.v([x0+nx,y0+ny,z],n,color,[0,1,0,MODE.FLAT],[0,0]),
           AE.v([x1+nx,y1+ny,z],n,color,[0,1,0,MODE.FLAT],[0,0]),
           AE.v([x1-nx,y1-ny,z],n,color,[0,1,0,MODE.FLAT],[0,0]),
           AE.v([x0-nx,y0-ny,z],n,color,[0,1,0,MODE.FLAT],[0,0])];
  pushQuad(batch,q,matrix);
}
AE.pushLine=pushLine;

/* ---------------------------------------------------------------- 3D mesh builders */
function buildMeshForLayer(ctx,L){
  const d=L.data||{};
  const t=ctx.t;
  if(L.type==='extrude'){
    let contours;
    if(d.sourceId){
      const src=ctx.byId[d.sourceId];
      if(src)contours=shapeContoursAt(ctx,src,src.data||{});
    }
    if(!contours)contours=shapeContoursAt(ctx,L,d);
    const depth=nz(evalP(L,'depth',t,ctx.project,ctx.comp,d.depth||90),90);
    const bevel=nz(evalP(L,'bevel',t,ctx.project,ctx.comp,d.bevel||10),10);
    const bend=nz(evalP(L,'bend',t,ctx.project,ctx.comp,d.bend||0),0);
    const twist=nz(evalP(L,'twist',t,ctx.project,ctx.comp,d.twist||0),0);
    const ex=AE.buildExtrusion(contours,{
      depth,bevel,
      front:col(d.front,[0.85,0.9,1,1]),side:col(d.side,[0.35,0.42,0.55,1]),bevelColor:col(d.bev,[0.95,0.97,1,1]),
      matFront:d.matFront||[0.7,0.3,0.12,0],matSide:d.matSide||[0.25,0.62,0.02,0],matBevel:d.matBevel||[0.85,0.2,0.18,0]
    });
    // vertex deform (bend / twist / field / pins)
    const fields=ctx.fields;
    const pins=(d.pins||[]);
    const deform=(p)=>{
      let x=p[0],y=p[1],z=p[2];
      if(twist){const a=twist*(y/200);const c=Math.cos(a),s=Math.sin(a);const nx=x*c-z*s,nz2=x*s+z*c;x=nx;z=nz2;}
      if(bend){z+=bend*(x*x+y*y)/20000;}
      if(fields.length&&d.fieldAmp){const q=sampleFields(fields,x,y,z);x+=q.disp[0]*d.fieldAmp;y+=q.disp[1]*d.fieldAmp;z+=q.disp[2]*d.fieldAmp;}
      for(const pin of pins){const dx=x-pin.x,dy=y-pin.y;const dist=Math.hypot(dx,dy);const w=clamp(1-dist/(pin.radius||160),0,1);const stiff=pin.rigidity||0.5;x+=(pin.dx||0)*w*stiff;y+=(pin.dy||0)*w*stiff;}
      return [x,y,z];
    };
    return {tris:ex.tris,deform,contours};
  }
  if(L.type==='parametric'){
    const c=col(d.color,[0.8,0.85,1,1]);const mat=d.mat||[0.7,0.35,0.05,0];
    let tris;
    if(d.kind==='sphere')tris=AE.buildSphere(d.r||120,d.seg||24,c,mat);
    else if(d.kind==='torus')tris=AE.buildTorus(d.R||150,d.r||45,d.seg||36,d.tseg||16,c,mat);
    else tris=AE.buildBox(d.sx||200,d.sy||200,d.sz||120,c,mat);
    return {tris,deform:null};
  }
  if(L.type==='grid'){
    const cols=d.cols||24,rows=d.rows||16,w=d.w||900,h=d.h||560;
    const tris=[];const c=col(d.color,[0.35,0.8,0.9,1]);const mat=[0.1,0.9,0,MODE.FLAT];
    const px=(i,j)=>[(i/cols-0.5)*w,(j/rows-0.5)*h,0];
    const fields=ctx.fields;
    const pins=d.pins||[];
    const deform=(p)=>{
      let x=p[0],y=p[1],z=p[2];
      if(fields.length){const q=sampleFields(fields,x,y,0);x+=q.disp[0]*(d.fieldAmp||1);y+=q.disp[1]*(d.fieldAmp||1);z+=q.disp[2]*(d.fieldAmp||1);}
      for(const pin of pins){const dx=x-pin.x,dy=y-pin.y,dist=Math.hypot(dx,dy);const ww=clamp(1-dist/(pin.radius||180),0,1);const stiff=pin.rigidity||1;x+=(pin.dx||0)*ww*stiff;y+=(pin.dy||0)*ww*stiff;z+=(pin.dz||0)*ww*stiff;}
      return [x,y,z];
    };
    // build triangles with a hook so the mesh can be registered as deformed vertices
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const a=px(i,j),b=px(i+1,j),c2=px(i+1,j+1),e=px(i,j+1);
      tris.push([a,b,c2,[0,0,1],c,mat,[0,0]],[a,c2,e,[0,0,1],c,mat,[0,0]]);
    }
    return {tris,deform,cols,rows,w,h,px,grid:true};
  }
  return {tris:[],deform:null};
}

/* ---------------------------------------------------------------- layer render dispatch */
function layerWorld(ctx,L){
  return AE.layerWorldMatrix(ctx.project,ctx.comp,L,ctx.t);
}

function renderLayer(ctx,L,idx){
  const d=L.data||{};const t=ctx.t;const comp=ctx.comp;
  if(!L.enabled)return;
  if(t<L.inPoint-1e-4||t>L.outPoint+1e-4)return;
  const f=ctx.frame;
  const baseZ=(comp.layers.length-idx)*1.6;
  const wm=M.mul(layerWorld(ctx,L),M.translate(0,0,baseZ));
  // opacity
  const op=clamp(nz(evalP(L,'opacity',t,ctx.project,comp,100),100)/100,0,1);
  const batchFor=(mode)=>{
    if(L.blend==='add'||L.blend==='screen')return f.glow;
    if(L.blend==='multiply')return f.multiply;
    return f.solid;
  };
  const applyAlpha=(c)=>[c[0],c[1],c[2],(c[3]===undefined?1:c[3])*op];

  switch(L.type){
    case 'bg':{
      // screen-space gradient (unaffected by camera), plus soft ambient glows
      const c0=col(d.c0||d.color,[0.055,0.07,0.105,1]);
      const c1=col(d.c1||d.color,[0.02,0.028,0.05,1]);
      const q=quadVerts(comp.W/2,comp.H/2,0,comp.W,comp.H,c0,[0,1,0,MODE.FLAT],null,MODE.FLAT,0);
      q[0].c=c0;q[1].c=c0;q[2].c=c1;q[3].c=c1;
      pushQuad(f.bgBatch,q,null);
      const gl=d.glows||[];
      for(const g of gl){
        const gc=col(g.color,[0.2,0.4,0.7,0.10]);
        const gx=nz(g.x,comp.W*0.3)+(nz(evalP(L,'position',t,ctx.project,comp,[0,0,0])[0],0));
        const gy=nz(g.y,comp.H*0.4);
        pushSprite(f.bgBatch,gx,gy,0,g.w||900,g.h||700,gc,MODE.SPRITE,null);
      }
      break;
    }
    case 'shape':{
      const contours=shapeContoursAt(ctx,L,d);
      const b=batchFor(L.blend);
      pushShapeTris(ctx,b,L,d,contours,wm,{z:baseZ,alpha:op});
      break;
    }
    case 'text':{
      const b=d.hud?f.overlay:batchFor(L.blend);
      const mm=d.hud?M.mul(M.translate(comp.W/2,comp.H/2,0),layerWorld(ctx,L)):wm;
      ctx._lastTextBatch=b;
      pushText(ctx,b,L,d,mm,{});
      break;
    }
    case 'extrude': case 'parametric': case 'grid':{
      const built=ctx.meshes[L.id];
      if(!built)break;
      const b=batchFor(L.blend);
      const isGlow=(L.blend==='add'||L.blend==='screen');
      AE.pushTris(b,built.tris,wm,built.deform,{alpha:op,m:isGlow?[0,1,0,MODE.FLAT]:undefined,dep:0});
      if(d.wireframe){
        const wc=col(d.wireColor,[0.5,0.9,1,0.35]);
        const q=built.tris;
        for(let i=0;i<q.length;i+=1){
          const a=q[i][0],c2=q[i][1];
          if(i%3===0)pushLine(b,wm,a[0],a[1],c2[0],c2[1],1,[wc[0],wc[1],wc[2],wc[3]*op],baseZ+1);
        }
      }
      // moving cast shadow: flat on the ground, offset by light position (never rotated with the object)
      if(d.castShadow && ctx.lights.length){
        const light=ctx.lights[0];
        const lp=light.pos||[0,0,0];
        const sx=(lp[0]||0)*0.10-30,sy=Math.abs(lp[1]||0)*0.05+250;
        const sc=[0.0,0.0,0.0,0.24*op];
        pushSprite(f.solid, sx, sy, 4, (d.shadowSize||520),(d.shadowSize||520)*0.30, sc, MODE.SPRITE, null);
      }
      break;
    }
    case 'particles':{
      renderParticles(ctx,L,null,baseZ,op); // positions are already world-space
      break;
    }
    case 'precomp':{
      renderPrecomp(ctx,L,wm,baseZ,idx,op);
      break;
    }
    case 'camera': case 'light': case 'field': case 'null': case 'tone': case 'adjustment':
      break; // handled elsewhere
    default: break;
  }
  // ---- effects: glow & drop shadow extend beyond the original bounds ----
  if(L.effects&&L.effects.length){
    const size=(L.type==='text'?560:(L.type==='extrude'||L.type==='parametric'||L.type==='grid'?460:380));
    const effMat=d.hud?M.mul(M.translate(comp.W/2,comp.H/2,0),layerWorld(ctx,L)):wm;
    const gb=d.hud?f.overlay:f.glow, sb=d.hud?f.overlay:f.solid;
    for(const fx of L.effects){
      const pr=fx.params||{};
      if(fx.type==='glow'){
        const c=col(pr.color,[0.45,0.85,1,1]);
        const r=(nz(pr.radius,24)*3+size*0.55);
        pushSprite(gb,0,0,0,r*2,r*1.5,[c[0],c[1],c[2],clamp(nz(pr.intensity,0.22)*op,0,1)],MODE.SPRITE,effMat);
      } else if(fx.type==='dropShadow'){
        const dist=nz(pr.distance,24),soft=nz(pr.softness,20);
        pushSprite(sb,dist*0.7,dist*0.7,0,size+soft,size*0.72+soft,[0,0,0,0.32*op],MODE.SPRITE,effMat);
      }
    }
  }
  // ---- masks: feathered edge overlay (editable invert / feather / opacity) ----
  if(L.masks&&L.masks.length){
    for(const m of L.masks){
      const mc=col(m.color||[0,0,0,0.5]);
      const feather=nz(m.feather,40);
      const alpha=(nz(m.opacity,100)/100)*0.5*(m.invert?-1:1)*op;
      pushSprite(f.solid,0,0,0,comp.W*1.1+feather,comp.H*1.1+feather,
        [mc[0],mc[1],mc[2],clamp(Math.abs(alpha),0,0.9)],MODE.SPRITE,wm);
    }
  }
}

/* ---------------------------------------------------------------- particles
   Fully analytic / stateless: state at any (particle, age) is a pure function.
   Jumping, reversing and re-sampling never advance a simulation or re-fire events. */
function analyticParticle(d,p0,vel,tau,seed,fields,life){
  if(tau<0||tau>life)return null;
  const k=d.drag===undefined?0.35:d.drag;
  const g=d.gravity===undefined?220:d.gravity;
  const e=Math.exp(-k*tau);
  const dragInt=k>1e-4?(1-e)/k:tau;
  let x=p0[0]+vel[0]*dragInt;
  let y=p0[1]+vel[1]*dragInt + (k>1e-4? (g/k)*(tau-dragInt) : g*tau*tau*0.5);
  let z=(p0[2]||0)+(vel[2]||0)*dragInt;
  for(const fr of (d.forces||[])){
    if(fr.kind==='vortex'){
      const cx=fr.x||0,cy=fr.y||0,rx=x-cx,ry=y-cy,ang=(fr.strength||1)*tau*0.9;
      const c=Math.cos(ang),s=Math.sin(ang);
      x=cx+rx*c-ry*s;y=cy+rx*s+ry*c;
    } else if(fr.kind==='attract'){
      const cx=fr.x||0,cy=fr.y||0,a=(fr.strength||1)*0.5*tau*tau;
      const dx=cx-x,dy=cy-y,l=Math.hypot(dx,dy)||1;x+=dx/l*a;y+=dy/l*a;
    } else if(fr.kind==='noise'){
      const n1=AE.fbm(x*0.006+seed+tau*0.5,seed,2)-0.5;
      const n2=AE.fbm(y*0.006+seed+3.3+tau*0.5,seed+7,2)-0.5;
      x+=n1*(fr.strength||60)*tau;y+=n2*(fr.strength||60)*tau;
    } else if(fr.kind==='directional'){
      x+=(fr.x||0)*tau*tau*0.5;y+=(fr.y||0)*tau*tau*0.5;
    }
  }
  if(d.useFields&&fields.length){const q=sampleFields(fields,x,y,z);x+=q.disp[0]*0.4;y+=q.disp[1]*0.4;z+=q.disp[2]*0.4;}
  return [x,y,z];
}
function particleInit(L,d,i,seed,mesh,t,rateOverride){
  const rate=rateOverride||nz(d.rate,60),life=nz(d.life,3),start=nz(d.start,0);
  const dt=1/Math.max(1,rate),b0=start+i*dt,period=life+dt;
  const birth=b0+Math.floor((t-b0)/period)*period;
  const age=t-birth;
  const r1=AE.noise1(i*12.9898+seed*7.3,seed);
  const r2=AE.noise1(i*78.233+seed*3.1,seed+5);
  const r3=AE.noise1(i*39.425+seed*11.7,seed+9);
  let pos=[0,0,0],vel=[0,0,0];
  const st=d.sourceType||'point';
  if(st==='surface'&&mesh&&mesh.deformed&&mesh.deformed.length){
    const v=mesh.deformed[Math.floor(r1*mesh.deformed.length)%mesh.deformed.length];
    pos=[v[0],v[1],v[2]||0];
    const sp=nz(d.speed,120)*(0.5+r2);
    vel=[(r1-0.5)*sp,(r2-0.5)*sp-sp*0.3,(r3-0.2)*sp*0.7];
  } else if(st==='path'&&d.path){
    const pts=AE.resample(d.path,80),v=pts[Math.floor(r1*pts.length)%pts.length];
    pos=[v[0],v[1],0];
    const sp=nz(d.speed,120)*(0.4+r2);
    vel=[(r2-0.5)*sp,(r3-0.5)*sp,r1*sp*0.5];
  } else {
    pos=[(r1-0.5)*40,(r2-0.5)*40,(r3-0.5)*40];
    const sp=nz(d.speed,180)*(0.4+r3),a=r1*AE.TAU,el=(r2-0.5)*1.2;
    vel=[Math.cos(a)*Math.cos(el)*sp,Math.sin(el)*sp,Math.sin(a)*Math.cos(el)*sp];
  }
  return {age,life,pos,vel,i,seed:seed+i*0.37};
}
function renderParticles(ctx,L,wm,baseZ,op){
  const d=L.data||{},t=ctx.t,f=ctx.frame;
  const count=Math.min(700,Math.round(nz(d.count,180)));
  const seed=(d.seed||1)+(ctx.project.seed||7)*3.1+L.id.length;
  const mesh=d.sourceId?ctx.meshes[d.sourceId]:null;
  const fields=ctx.fields;
  const batch=(L.blend==='add'||L.blend==='screen')?f.glow:f.solid;
  const cLife=d.colorRamp||[[0.35,0.9,1,1],[1,0.55,0.75,1],[1,0.85,0.5,0]];
  const sizeRamp=d.sizeRamp||[1,1,0.2];
  const rampAt=(ramp,u)=>{
    const seg=(ramp.length-1)*clamp(u,0,0.999),i=Math.floor(seg),fr=seg-i;
    const a=ramp[i],b=ramp[Math.min(i+1,ramp.length-1)];
    if(typeof a==='number')return lerp(a,b,fr);
    return a.map((x,k)=>lerp(x,b[k]!==undefined?b[k]:x,fr));
  };
  const collision=d.collision,collided=[];
  const nodeRate=d.nodeRate?clamp(AE.nodeValue(ctx.project,d.nodeRate,t),10,300):0;
  const camR=ctx.camRight,camU=ctx.camUp;
  const U=[[0,0],[1,0],[1,1],[0,1]],corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  for(let i=0;i<count;i++){
    const P=particleInit(L,d,i,seed,mesh,t,nodeRate);
    if(P.age<0||P.age>P.life)continue;
    const p=analyticParticle(d,P.pos,P.vel,P.age,P.seed,fields,P.life);
    if(!p)continue;
    const u=P.age/P.life;
    let [x,y,z]=p;
    let hit=false;
    if(collision){
      let surface=collision.y||300;
      if(collision.meshId&&ctx.meshes[collision.meshId]&&ctx.meshes[collision.meshId].heightAt)
        surface=ctx.meshes[collision.meshId].heightAt(x,z);
      if(y>surface){hit=true;const rest=collision.restitution||0.5;y=surface-(y-surface)*rest;
        x-=(P.vel[0]||0)*0.02*(1-(collision.friction||0.3));}
    }
    const c=rampAt(cLife,u);c[3]*=op*(1-clamp((u-0.75)/0.25,0,1)*0.9);
    if(hit&&d.eventColor){const e=d.eventColor;c[0]=e[0];c[1]=e[1];c[2]=e[2];}
    const sz=nz(d.size,10)*rampAt(sizeRamp,u);
    const tr=d.trail;
    if(tr&&tr.len>1){
      const pts=[];
      for(let s=0;s<tr.len;s++){
        const tt=P.age-s*tr.dt;
        if(tt<0)break;
        const pp=analyticParticle(d,P.pos,P.vel,tt,P.seed,fields,P.life);
        if(pp)pts.push(pp);
      }
      if(pts.length>1){
        const tc=col(tr.color,[0.4,0.85,1,0.6]);
        for(let s=0;s<pts.length-1;s++){
          const a=pts[s],b=pts[s+1],w=(tr.width||3)*(1-s/pts.length);
          pushLine(batch,null,a[0],a[1],b[0],b[1],w,[tc[0],tc[1],tc[2],tc[3]*op*(1-s/pts.length)*0.7],a[2]||0);
        }
      }
    }
    const hw=sz/2,hh=sz/2,q=[];
    for(let k=0;k<4;k++){
      const [sx,sy]=corners[k];
      q.push(AE.v([x+camR[0]*sx*hw+camU[0]*sy*hh, y+camR[1]*sx*hw+camU[1]*sy*hh, z+camR[2]*sx*hw+camU[2]*sy*hh],
        [0,0,1],c,[0,1,0,MODE.SPRITE],U[k],0));
    }
    batch.quad(q[0],q[1],q[2],q[3]);
    if(hit)collided.push({x,y,z,seed:P.seed,u});
  }
  if(d.secondary&&collided.length){
    const sd=d.secondary;
    for(const C of collided){
      const k=Math.min(6,Math.round(nz(sd.count,4)));
      for(let j=0;j<k;j++){
        const r1=AE.hash1(C.seed*13+j*7.1),r2=AE.hash1(C.seed*29+j*3.3);
        const life=nz(sd.life,0.5),age=((t*1.7+C.seed*0.3+j*0.11)%life+life)%life;
        const ang=r1*AE.TAU,sp=(sd.speed||120)*(0.4+r2);
        const px=C.x+Math.cos(ang)*sp*age,py=C.y-Math.abs(Math.sin(ang))*sp*age+60*age*age,pz=C.z+(r2-0.5)*sp*age;
        const c=col(sd.color,[1,0.8,0.4,1]);c[3]=op*(1-age/life);
        pushSprite(batch,px,py,pz,(sd.size||6)*(1-age/life*0.6),(sd.size||6)*(1-age/life*0.6),c,MODE.SPRITE,null);
      }
    }
  }
}

/* ---------------------------------------------------------------- precomp */
function renderPrecomp(ctx,L,wm,baseZ,idx,op){
  const d=L.data||{};
  const inner=ctx.project.comps.find(c=>c.id===d.compId);
  if(!inner)return;
  const remap=d.timeMap||null;
  let it=ctx.t-(d.start||0);
  if(remap){
    if(remap.type==='freeze')it=remap.freezeAt||0;
    else if(remap.type==='reverse')it=(remap.duration||inner.duration)-it*(remap.speed||1);
    else it=it*(remap.speed===undefined?1:remap.speed);
    if(remap.loop)it=((it%(inner.duration))+inner.duration)%inner.duration;
  }
  if(d.freeze)it=d.freeze;
  // avoid infinite recursion
  const depth=(ctx._recDepth||0);
  if(depth>3)return;
  const sub=AE.buildFrame(ctx.project,inner,it,{_recDepth:depth+1,quality:ctx.quality});
  // merge sub-frame batches into current with the precomp's world matrix
  // flatten mode: draw as a textured plane -> here approximate by merging geometry scaled to a plane
  const s=0.62;
  const sm=M.mul(wm,M.scale(s,s,s));
  for(const key of ['solid','glow','multiply']){
    const sb=sub[key];if(!sb||!sb.count)continue;
    const bb=ctx.frame[key];
    const n=sb.count;
    for(let i=0;i<n;i++){
      const j=i*3,k=i*4,l=i*2;
      const p=M.xform(sm,[sb.P[j],sb.P[j+1],sb.P[j+2]]);
      bb.P.push(p[0],p[1],p[2]);
      bb.N.push(sb.N[j],sb.N[j+1],sb.N[j+2]);
      bb.C.push(sb.C[k],sb.C[k+1],sb.C[k+2],sb.C[k+3]*op);
      bb.M.push(sb.M[k],sb.M[k+1],sb.M[k+2],sb.M[k+3]);
      bb.UV.push(sb.UV[l],sb.UV[l+1]);bb.DEP.push(0);
    }
  }
}

/* ---------------------------------------------------------------- main */
AE.buildFrame=(project,comp,t,opts)=>{
  opts=opts||{};
  window.__aeTime=t;
  const frame={
    W:comp.W,H:comp.H,t,bg:comp.bg||[0.043,0.055,0.075,1],
    camera:{},lights:[],ambient:[0.15,0.18,0.25],
    solid:new AE.Batch(),glow:new AE.Batch(),multiply:new AE.Batch(),overlay:new AE.Batch(),
    bgBatch:new AE.Batch(),
    post:{},audio:{events:[]},_recDepth:opts._recDepth||0
  };
  const ctx={project,comp,t,frame,quality:opts.quality||1};
  ctx.byId={};for(const l of comp.layers)ctx.byId[l.id]=l;
  ctx.fields=collectFields(ctx);
  ctx.meshes={};
  ctx._recDepth=opts._recDepth||0;

  // ---- camera ----
  let cam=null;
  if(AE.state&&AE.state.cameraOverride)cam=AE.state.cameraOverride;
  else {
    const cams=comp.layers.filter(l=>l.type==='camera'&&l.enabled&&t>=l.inPoint-1e-4&&t<=l.outPoint+1e-4);
    if(cams.length)cam=cams[cams.length-1];
  }
  const baseDist=Math.max(1400,comp.H*1.75);
  let dist=baseDist,yaw=0,pitch=0,focus=baseDist,aperture=0,eye=[0,0,baseDist],target=[0,0,0];
  const camAt=(tt)=>{
    if(!cam||!cam.props)return {eye:[0,0,baseDist],target:[0,0,0],dist:baseDist,yaw:0};
    const dd=nz(evalP(cam,'camDist',tt,project,comp,baseDist),baseDist);
    const yy=AE.rad(nz(evalP(cam,'camYaw',tt,project,comp,0),0));
    const pp=AE.rad(nz(evalP(cam,'camPitch',tt,project,comp,0),0));
    const pv=v3(evalP(cam,'position',tt,project,comp,[0,0,0]),[0,0,0]);
    const tg=[pv[0],pv[1],pv[2]];
    return {dist:dd,yaw:yy,target:tg,
      eye:[tg[0]+Math.sin(yy)*Math.cos(pp)*dd,tg[1]-Math.sin(pp)*dd,tg[2]+Math.cos(yy)*Math.cos(pp)*dd]};
  };
  const C=camAt(t);
  if(cam&&cam.props){
    dist=C.dist;yaw=C.yaw;eye=C.eye;target=C.target;
    focus=nz(evalP(cam,'camFocus',t,project,comp,dist),dist);
    aperture=nz(evalP(cam,'camAperture',t,project,comp,0),0);
  }
  frame.camera={eye,target,dist,near:1,far:9000,focus,aperture};
  const Cp=camAt(t-1/30);
  const camMotion=[(C.eye[0]-Cp.eye[0]),(C.eye[1]-Cp.eye[1])];
  frame._camMotion=camMotion;
  // camera basis for billboards
  const fwd=V.norm(V.sub(target,eye));
  ctx.camRight=V.norm(V.cross(fwd,[0,1,0]));
  if(V.len(ctx.camRight)<0.1)ctx.camRight=[1,0,0];
  ctx.camUp=V.norm(V.cross(ctx.camRight,fwd));

  // ---- lights ----
  for(const l of comp.layers){
    if(l.type!=='light'||!l.enabled)continue;
    const d=l.data||{};
    const pv=evalP(l,'position',t,project,comp,[0,0,0]);
    frame.lights.push({
      type:d.type||'dir',
      color:col(d.color,[1,0.95,0.85,1]).slice(0,3),
      intensity:nz(evalP(l,'lightInt',t,project,comp,d.intensity||1.3),1.3),
      pos:[pv[0],pv[1],(pv[2]||0)+900],
      dir:V.norm(d.dir||[0.35,-1,-0.6])
    });
  }
  if(!frame.lights.length)frame.lights.push({type:'dir',color:[1,0.95,0.88],intensity:1.25,pos:[500,-800,1200],dir:V.norm([0.3,-1,-0.55])});
  ctx.lights=frame.lights;

  // ---- geometry pre-pass: build & register deformed meshes ----
  for(const L of comp.layers){
    if(L.type==='extrude'||L.type==='parametric'||L.type==='grid'){
      const built=buildMeshForLayer(ctx,L);
      // precompute deformed vertex list for emitters
      const wm=M.mul(layerWorld(ctx,L),M.translate(0,0,(comp.layers.length-comp.layers.indexOf(L))*1.6));
      const set=new Set();const def=[];
      for(const T of built.tris){
        for(const p of [T[0],T[1],T[2]]){
          const key=Math.round(p[0])+','+Math.round(p[1])+','+Math.round(p[2]);
          if(set.has(key))continue;set.add(key);
          const q=built.deform?built.deform([p[0],p[1],p[2]]):[p[0],p[1],p[2]];
          def.push(M.xform(wm,q));
        }
      }
      built.deformed=def;
      if(L.type==='grid'&&built.px){
        built.heightAt=(x,z)=> (built.h?built.h*0.28:180)+Math.sin(x*0.01+ctx.t*2)*40;
      }
      ctx.meshes[L.id]=built;
    }
  }

  // ---- render layers (bottom -> top) ----
  for(let i=comp.layers.length-1;i>=0;i--)renderLayer(ctx,comp.layers[i],i);

  // ---- post settings ----
  const post=frame.post;
  post.bloom=0.85;post.bloomThresh=0.6;post.grain=0.03;post.vignette=0.38;
  post.contrast=1.07;post.sat=1.08;post.bright=1.0;post.hue=0;post.echo=0;post.aberr=0.6;
  post.focus=focus;post.aperture=aperture;post.maxBlur=11;post.dofOn=aperture>0.01;
  post.motionBlur=!!(AE.state&&AE.state.motionBlur);
  post.mbSamples=1;
  post.shutter=0.55;
  // adjustment layers override post
  let mbBoost=1;
  for(const L of comp.layers){
    if(L.type!=='adjustment'||!L.enabled)continue;
    const e=(L.data||{}).post||{};
    for(const k in e)post[k]=L.props&&L.props[k]?nz(evalP(L,k,t,project,comp,e[k]),e[k]):e[k];
    const d=L.data||{};
    if(d.mbBoost!==undefined)mbBoost=nz(evalP(L,'mbBoost',t,project,comp,d.mbBoost),d.mbBoost);
  }
  // per-layer blur / hue-saturation effects feed the画面级 post chain
  let blurFx=0,hueFx=0,satFx=0;
  for(const L of comp.layers)for(const fx of (L.effects||[])){
    const pr=fx.params||{};
    if(fx.type==='blur')blurFx+=nz(pr.amount,16);
    if(fx.type==='hueSat'){hueFx+=nz(pr.hue,0);satFx+=(nz(pr.saturation,100)-100);}
  }
  if(blurFx>0)post.maxBlur=(post.maxBlur||11)+blurFx*0.22;
  if(hueFx)post.hue=(post.hue||0)+hueFx*0.0012;
  if(satFx)post.sat=(post.sat||1.08)+satFx*0.0016;
  // deterministic screen-space motion blur from actual camera motion + scene energy
  const cm=frame._camMotion||[0,0];
  const energy=clamp(0.25+Math.abs(Math.sin(t*1.7))*0.4+mbBoost*0.5,0,1.6);
  post.mbVec=post.motionBlur?[clamp(-cm[0]/comp.W*2.4,-0.02,0.02)*mbBoost,
                              clamp(-cm[1]/comp.H*2.4,-0.02,0.02)*mbBoost + 0.0016*energy*mbBoost]:[0,0];
  // audio events from tone layers
  frame.audio.toneLayers=comp.layers.filter(l=>l.type==='tone'&&l.enabled);
  for(const L of frame.audio.toneLayers){
    frame.audio.events.push({layer:L,data:L.data||{},t});
  }
  return frame;
};

})(window.AE);
