/* =========================================================================
   geometry.js — vector paths, triangulation, 3D extrusion, parametric solids,
   glyph atlas, and the render batch (triangle soup).
   ========================================================================= */
(function(AE){
'use strict';
const V=AE.V, M=AE.M, lerp=AE.lerp, clamp=AE.clamp;

/* ---------------------------------------------------------------- render batch */
AE.Batch=class{
  constructor(){this.P=[];this.N=[];this.C=[];this.M=[];this.UV=[];this.DEP=[];}
  get count(){return this.P.length/3;}
  vert(v){
    this.P.push(v.p[0],v.p[1],v.p[2]||0);
    const n=v.n||[0,0,1];this.N.push(n[0],n[1],n[2]);
    const c=v.c||[1,1,1,1];this.C.push(c[0],c[1],c[2],c[3]===undefined?1:c[3]);
    const m=v.m||[0,1,0,0];this.M.push(m[0],m[1],m[2],m[3]===undefined?0:m[3]);
    const uv=v.uv||[0,0];this.UV.push(uv[0],uv[1]);
    this.DEP.push(v.dep||0);
  }
  tri(a,b,c){this.vert(a);this.vert(b);this.vert(c);}
  quad(a,b,c,d){this.tri(a,b,c);this.tri(a,c,d);}
  append(o){this.P.push(...o.P);this.N.push(...o.N);this.C.push(...o.C);this.M.push(...o.M);this.UV.push(...o.UV);this.DEP.push(...o.DEP);}
  clear(){this.P.length=0;this.N.length=0;this.C.length=0;this.M.length=0;this.UV.length=0;this.DEP.length=0;}
};
/* v = vertex helper */
AE.v=(p,n,c,m,uv,dep)=>({p,n,c,m,uv,dep});
/* mode constants */
AE.MODE={LIT:0,FLAT:1,TEX:2,SPRITE:3};

/* ---------------------------------------------------------------- path utilities */
/* contour = array of points; a point is [x,y] or {p:[x,y],i:[dx,dy],o:[dx,dy]} */
AE.flattenContour=(contour,steps)=>{
  steps=steps||8;
  const out=[];
  const n=contour.length;
  if(n<2) return contour.map(p=>Array.isArray(p)?p:p.p);
  for(let i=0;i<n;i++){
    const a=contour[i], b=contour[(i+1)%n];
    const p0=Array.isArray(a)?a:a.p;
    const p3=Array.isArray(b)?b:b.p;
    const o=a.o||null, inn=b.i||null;
    out.push([p0[0],p0[1]]);
    if(!o&&!inn) continue;
    const p1=[p0[0]+(o?o[0]:(p3[0]-p0[0])/3),p0[1]+(o?o[1]:(p3[1]-p0[1])/3)];
    const p2=[p3[0]+(inn?inn[0]:-(p3[0]-p0[0])/3),p3[1]+(inn?inn[1]:-(p3[1]-p0[1])/3)];
    for(let s=1;s<=steps;s++){
      const t=s/steps,mt=1-t;
      out.push([mt*mt*mt*p0[0]+3*mt*mt*t*p1[0]+3*mt*t*t*p2[0]+t*t*t*p3[0],
                mt*mt*mt*p0[1]+3*mt*mt*t*p1[1]+3*mt*t*t*p2[1]+t*t*t*p3[1]]);
    }
  }
  return out;
};

/* arc-length resample a closed contour to exactly n points */
AE.resample=(pts,n)=>{
  if(!pts||pts.length<2)return new Array(n).fill(0).map(()=>[0,0]);
  const closed=pts.slice();closed.push(pts[0]);
  let total=0;const seg=[];
  for(let i=0;i<closed.length-1;i++){const l=Math.hypot(closed[i+1][0]-closed[i][0],closed[i+1][1]-closed[i][1]);seg.push(l);total+=l;}
  if(total<1e-6)return new Array(n).fill(0).map(()=>pts[0].slice());
  const out=[];let idx=0,acc=0;
  for(let k=0;k<n;k++){
    const target=total*k/n;
    while(idx<seg.length-1 && acc+seg[idx]<target){acc+=seg[idx];idx++;}
    const f=(target-acc)/(seg[idx]||1);
    out.push([lerp(closed[idx][0],closed[idx+1][0],f),lerp(closed[idx][1],closed[idx+1][1],f)]);
  }
  return out;
};
/* angular resampling: point k always lies on the same ray from the centroid.
   This keeps contour correspondence during path morphs (no twisting). */
AE.polarSample=(pts,n,startAngle)=>{
  const c=AE.centroid(pts),N=n||64,st=startAngle===undefined?-Math.PI/2:startAngle,out=[];
  for(let k=0;k<N;k++){
    const a=st+k/N*AE.TAU,dx=Math.cos(a),dy=Math.sin(a);
    let best=0;
    for(let i=0;i<pts.length;i++){
      const p=pts[i],q=pts[(i+1)%pts.length];
      const ex=q[0]-p[0],ey=q[1]-p[1],D=dx*ey-dy*ex;
      if(Math.abs(D)<1e-9)continue;
      const rx=p[0]-c[0],ry=p[1]-c[1];
      const t=(rx*ey-ex*ry)/D,u=(dy*rx-dx*ry)/D;
      if(t>best&&u>=-1e-6&&u<=1+1e-6)best=t;
    }
    if(best<1e-6)best=1;
    out.push([c[0]+dx*best,c[1]+dy*best]);
  }
  return out;
};
AE.signedArea=(pts)=>{let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;};
AE.centroid=(pts)=>{let x=0,y=0;for(const p of pts){x+=p[0];y+=p[1];}return [x/pts.length,y/pts.length];};
AE.ensureCCW=(pts)=> AE.signedArea(pts)<0?pts.slice().reverse():pts;

/* ear clipping for a simple polygon (concave safe). returns flat [x,y] triangle vertices */
function cross(o,a,b){return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);}
function inTri(p,a,b,c){const d1=cross(a,b,p),d2=cross(b,c,p),d3=cross(c,a,p);const neg=(d1<0)||(d2<0)||(d3<0),pos=(d1>0)||(d2>0)||(d3>0);return !(neg&&pos);}
AE.earClip=(poly)=>{
  const pts=AE.ensureCCW(poly.map(p=>p.slice()));
  const n=pts.length;if(n<3)return [];
  const idx=[];for(let i=0;i<n;i++)idx.push(i);
  const out=[];let guard=0;
  while(idx.length>3 && guard++<n*n*3){
    let clipped=false;
    for(let i=0;i<idx.length;i++){
      const i0=idx[(i-1+idx.length)%idx.length],i1=idx[i],i2=idx[(i+1)%idx.length];
      const a=pts[i0],b=pts[i1],c=pts[i2];
      if(cross(a,b,c)<1e-9)continue;
      let ok=true;
      for(const j of idx){if(j===i0||j===i1||j===i2)continue;if(inTri(pts[j],a,b,c)){ok=false;break;}}
      if(!ok)continue;
      out.push(a,b,c);idx.splice(i,1);clipped=true;break;
    }
    if(!clipped)break;
  }
  if(idx.length===3)out.push(pts[idx[0]],pts[idx[1]],pts[idx[2]]);
  return out;
};
/* triangulate contours[0]=outer, contours[1..]=holes (matched vertex counts -> ring strips).
   Loops are assumed already resampled to a common vertex count and angularly aligned. */
AE.triangulateContours=(contours)=>{
  if(!contours||!contours.length)return {tris:[],mode:'empty',outer:[]};
  const outer=contours[0];
  const N=outer.length;
  if(contours.length===1){
    const tris=AE.earClip(outer);
    if(tris.length)return {tris,mode:'ear',outer};
    const c=AE.centroid(outer),fan=[];
    for(let i=0;i<N;i++)fan.push(c,outer[i],outer[(i+1)%N]);
    return {tris:fan,mode:'fan',outer};
  }
  // ring strips: region between the outer loop and each hole; hole interior stays empty
  const tris=[];
  for(let h=1;h<contours.length;h++){
    const H=AE.resample(contours[h],N);
    for(let i=0;i<N;i++){
      const a=outer[i],b=outer[(i+1)%N],c=H[i],d=H[(i+1)%N];
      tris.push(a,b,d, a,d,c);
    }
  }
  return {tris,mode:'strip',outer};
};

/* ---------------------------------------------------------------- shape generators */
AE.shape={
  rect:(w,h,r)=>{r=r||0;const pts=[];const hw=w/2,hh=h/2;
    if(r<=0){return [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]];}
    const seg=6;const corners=[[hw-r,hh-r,0],[-hw+r,hh-r,90],[-hw+r,-hh+r,180],[hw-r,-hh+r,270]];
    for(const [cx,cy,st] of corners){for(let i=0;i<=seg;i++){const a=AE.rad(st+i*90/seg);pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}}
    return pts;},
  ellipse:(rx,ry,n)=>{n=n||48;const p=[];for(let i=0;i<n;i++){const a=i/n*AE.TAU;p.push([Math.cos(a)*rx,Math.sin(a)*ry]);}return p;},
  poly:(n,r,rot)=>{rot=rot||-Math.PI/2;const p=[];for(let i=0;i<n;i++){const a=rot+i/n*AE.TAU;p.push([Math.cos(a)*r,Math.sin(a)*r]);}return p;},
  star:(n,r1,r2,rot)=>{rot=rot||-Math.PI/2;const p=[];for(let i=0;i<n*2;i++){const a=rot+i/(n*2)*AE.TAU;const r=i%2?r2:r1;p.push([Math.cos(a)*r,Math.sin(a)*r]);}return p;},
  gear:(n,ro,ri,rot)=>{rot=rot||0;const p=[];const N=n*4;
    for(let i=0;i<N;i++){const a=rot+i/N*AE.TAU;const k=i%4;const r=(k===0||k===3)?ro:ri;p.push([Math.cos(a)*r,Math.sin(a)*r]);}return p;},
  blob:(seed,n,r,amp)=>{n=n||60;const p=[];for(let i=0;i<n;i++){const a=i/n*AE.TAU;
    const rr=r*(1+amp*(AE.noise1(Math.cos(a)*1.5+2,seed)-0.5)*2+amp*0.5*(AE.noise1(Math.sin(a)*2+7,seed+9)-0.5)*2);
    p.push([Math.cos(a)*rr,Math.sin(a)*rr]);}return p;},
  ring:(ro,ri,n)=>{n=n||56;const o=[],h=[];for(let i=0;i<n;i++){const a=-i/n*AE.TAU;o.push([Math.cos(a)*ro,Math.sin(a)*ro]);h.push([Math.cos(a)*ri,Math.sin(a)*ri]);}return [o,h];},
};

/* Evaluate a "shape" (with optional morph between key shapes) -> contours (resampled) */
AE.evalShape=(shape,t)=>{
  const N=shape.res||64;
  const gen=(s)=>{
    let pts;
    switch(s.kind){
      case 'rect':pts=AE.shape.rect(s.w,s.h,s.r);break;
      case 'ellipse':pts=AE.shape.ellipse(s.rx,s.ry,Math.max(24,s.res||48));break;
      case 'poly':pts=AE.shape.poly(s.n||5,s.r||100,s.rot||0);break;
      case 'star':pts=AE.shape.star(s.n||5,s.r1||140,s.r2||60,s.rot||0);break;
      case 'gear':pts=AE.shape.gear(s.n||10,s.ro||150,s.ri||110,s.rot||0);break;
      case 'blob':pts=AE.shape.blob(s.seed||3,N,s.r||140,s.amp||0.3);break;
      case 'ring':return AE.shape.ring(s.ro||150,s.ri||90,N);
      case 'path':pts=AE.flattenContour(s.points||[],6);break;
      default:pts=AE.shape.ellipse(100,100,48);
    }
    return pts;
  };
  const isRing=shape.kind==='ring';
  let base=gen(shape);
  let rawOuter = isRing?base[0]:base;
  const rawHoles = isRing?[base[1]]:(shape.holes||[]).map(h=>Array.isArray(h[0])?h:gen(h));
  // morph between key shapes
  let outer;
  const flat=(s)=>{const g=gen(s);return (Array.isArray(g[0])&&Array.isArray(g[0][0]))?g[0]:g;};
  if(shape.morph&&shape.morph.length){
    const ks=shape.morph;
    let i=0;while(i<ks.length-1&&ks[i+1].t<t)i++;
    const a=ks[i],b=ks[Math.min(i+1,ks.length-1)];
    const u=clamp((t-a.t)/((b.t-a.t)||1),0,1);
    const eu=AE.easeValue(u,a.ease||'ease');
    const A=AE.polarSample(flat(a),N), B=AE.polarSample(flat(b),N);
    outer=A.map((p,j)=>[lerp(p[0],B[j][0],eu),lerp(p[1],B[j][1],eu)]);
  } else outer=AE.resample(rawOuter,N);
  const H=rawHoles.map(h=>AE.resample(h,N));
  return {outer,holes:H,N};
};

/* ---------------------------------------------------------------- boolean path ops
   Radial CSG for star-shaped contours: union / intersection / difference.
   `reverse` swaps the operands, so A−B and B−A give different results. */
AE.booleanContours=(bool,t,N)=>{
  N=N||64;
  let A=bool.a||{kind:'ellipse',rx:150,ry:150}, B=bool.b||{kind:'ellipse',rx:90,ry:120};
  if(bool.reverse){const x=A;A=B;B=x;}
  const ga=AE.evalShape(A,t),gb=AE.evalShape(B,t);
  const pa=AE.polarSample(ga.outer,N),pb=AE.polarSample(gb.outer,N);
  const rA=pa.map(p=>Math.hypot(p[0],p[1])),rB=pb.map(p=>Math.hypot(p[0],p[1]));
  const ang=(k)=>-Math.PI/2+k/N*AE.TAU;
  const pts=(R)=>R.map((r,k)=>[Math.cos(ang(k))*r,Math.sin(ang(k))*r]);
  const op=bool.op||(bool.mode===1?'difference':(bool.mode===2?'intersection':'union'));
  if(op==='union')return [pts(rA.map((r,i)=>Math.max(r,rB[i])))];
  if(op==='intersection')return [pts(rA.map((r,i)=>Math.min(r,rB[i])))];
  // difference: A minus B -> outer A with an inner hole following B (clamped inside A)
  return [pts(rA),pts(rA.map((r,i)=>Math.max(6,Math.min(rB[i],r*0.82))))];
};

/* ---------------------------------------------------------------- 2D -> 3D extrusion
   Returns meshes: {front:[verts], back, side, bevel} as triangle soups of
   {p:[x,y,z], n:[..], c:[..], m:[..], uv:[..]}. Coordinates in shape local space
   (y-down shape space), z = extrusion depth. Caller applies the layer matrix.
*/
AE.buildExtrusion=(contours,opt)=>{
  opt=opt||{};
  const depth=opt.depth||80, bevel=opt.bevel||0;
  const colFront=opt.front||[0.9,0.92,1,1], colSide=opt.side||[0.5,0.55,0.65,1], colBevel=opt.bevelColor||colFront;
  const matFront=opt.matFront||[0.6,0.35,0.1,0], matSide=opt.matSide||[0.3,0.6,0.0,0], matBevel=opt.matBevel||[0.8,0.25,0.15,0];
  const T=AE.triangulateContours(contours);
  const tris=[];
  const tri=(a,b,c,n,col,mat,uv)=>tris.push([a,b,c,n,col,mat,uv||[0,0]]);
  // front cap (z = +depth/2), normal +z (toward viewer)
  const zF=depth/2, zB=-depth/2;
  for(let i=0;i<T.tris.length;i+=3){
    const a=T.tris[i],b=T.tris[i+1],c=T.tris[i+2];
    tri([a[0],a[1],zF],[b[0],b[1],zF],[c[0],c[1],zF],[0,0,1],colFront,matFront);
    tri([c[0],c[1],zB],[b[0],b[1],zB],[a[0],a[1],zB],[0,0,-1],colFront,matFront);
  }
  // sidewalls for each contour
  const loops=[contours[0],...(contours.slice(1))];
  for(const loop of loops){
    const n=loop.length;
    const isHole=loop!==contours[0];
    for(let i=0;i<n;i++){
      const a=loop[i],b=loop[(i+1)%n];
      const e=[b[0]-a[0],b[1]-a[1]],el=Math.hypot(e[0],e[1])||1;
      const nx=isHole? e[1]/el : -e[1]/el, ny=isHole? -e[0]/el : e[0]/el;
      const N=[nx,ny,0];
      const A=[a[0],a[1]],B=[b[0],b[1]];
      tri([A[0],A[1],zB],[B[0],B[1],zB],[B[0],B[1],zF],N,colSide,matSide);
      tri([A[0],A[1],zB],[B[0],B[1],zF],[A[0],A[1],zF],N,colSide,matSide);
    }
  }
  // bevel: offset loops toward centroid by `bevel`, connect front rim
  if(bevel>0.5){
    const c=AE.centroid(contours[0]);
    for(const loop of loops){
      const n=loop.length;
      for(let i=0;i<n;i++){
        const a=loop[i],b=loop[(i+1)%n];
        const ia=[a[0]+(c[0]-a[0])*0.0, a[1]+(c[1]-a[1])*0.0];
        const shrink=(p)=>[p[0]+(c[0]-p[0])*(bevel/120),p[1]+(c[1]-p[1])*(bevel/120)];
        const ai=shrink(a),bi=shrink(b);
        const e=[b[0]-a[0],b[1]-a[1]],el=Math.hypot(e[0],e[1])||1;
        const N=[ -e[1]/el*0.4, e[0]/el*0.4, 0.92];
        tri([a[0],a[1],zF],[b[0],b[1],zF],[bi[0],bi[1],zF+bevel],N,colBevel,matBevel);
        tri([a[0],a[1],zF],[bi[0],bi[1],zF+bevel],[ai[0],ai[1],zF+bevel],N,colBevel,matBevel);
      }
    }
  }
  return {tris, contours, frontZ:zF, backZ:zB};
};

/* ---------------------------------------------------------------- parametric solids */
AE.buildBox=(sx,sy,sz,color,mat)=>{
  const hx=sx/2,hy=sy/2,hz=sz/2;
  const f=[
    {n:[0,0,1], v:[[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]]},
    {n:[0,0,-1],v:[[hx,-hy,-hz],[-hx,-hy,-hz],[-hx,hy,-hz],[hx,hy,-hz]]},
    {n:[0,-1,0],v:[[-hx,-hy,-hz],[hx,-hy,-hz],[hx,-hy,hz],[-hx,-hy,hz]]},
    {n:[1,0,0], v:[[hx,-hy,-hz],[hx,hy,-hz],[hx,hy,hz],[hx,-hy,hz]]},
    {n:[0,1,0], v:[[hx,hy,-hz],[-hx,hy,-hz],[-hx,hy,hz],[hx,hy,hz]]},
    {n:[-1,0,0],v:[[-hx,hy,-hz],[-hx,-hy,-hz],[-hx,-hy,hz],[-hx,hy,hz]]},
  ];
  const tris=[];
  for(const face of f){
    const q=face.v;
    tris.push([q[0],q[1],q[2],face.n,color,mat,[0,0]]);
    tris.push([q[0],q[2],q[3],face.n,color,mat,[0,0]]);
  }
  return tris;
};
AE.buildSphere=(r,seg,color,mat)=>{
  seg=seg||24;const rings=seg/2|0;const tris=[];
  const P=(i,j)=>{const th=j/rings*Math.PI,ph=i/seg*AE.TAU;
    const x=Math.sin(th)*Math.cos(ph),y=Math.cos(th),z=Math.sin(th)*Math.sin(ph);
    return {p:[r*x,r*y,r*z],n:[x,y,z]};};
  for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){
    const a=P(i,j),b=P(i+1,j),c=P(i+1,j+1),d=P(i,j+1);
    const uv0=[i/seg,j/rings],uv1=[(i+1)/seg,j/rings],uv2=[(i+1)/seg,(j+1)/rings],uv3=[i/seg,(j+1)/rings];
    tris.push([a.p,b.p,c.p,c.n,color,mat,uv0],[a.p,c.p,d.p,d.n,color,mat,uv1]);
  }
  return tris;
};
AE.buildTorus=(R,r,seg,tseg,color,mat)=>{
  seg=seg||36;tseg=tseg||16;const tris=[];
  const P=(i,j)=>{const u=i/seg*AE.TAU,v=j/tseg*AE.TAU;
    const cx=Math.cos(u)*R,cz=Math.sin(u)*R;
    const nx=Math.cos(u)*Math.cos(v),ny=Math.sin(v),nz=Math.sin(u)*Math.cos(v);
    return {p:[cx+r*nx,r*ny,cz+r*nz],n:[nx,ny,nz]};};
  for(let i=0;i<seg;i++)for(let j=0;j<tseg;j++){
    const a=P(i,j),b=P(i+1,j),c=P(i+1,j+1),d=P(i,j+1);
    tris.push([a.p,b.p,c.p,c.n,color,mat,[0,0]],[a.p,c.p,d.p,d.n,color,mat,[0,0]]);
  }
  return tris;
};
/* triangle soup -> batch, applying a 4x4 matrix + optional per-vertex deform fn */
AE.pushTris=(batch,tris,matrix,deform,override)=>{
  const uv=[0,0];
  for(const T of tris){
    const p0=T[0],p1=T[1],p2=T[2],n0=T[3],col=T[4],mat=T[5],uvt=T[6]||uv;
    let a=p0,b=p1,c=p2;
    if(deform){a=deform(a.slice());b=deform(b.slice());c=deform(c.slice());}
    let A=matrix?M.xform(matrix,[a[0],a[1],a[2]]):a;
    let B=matrix?M.xform(matrix,[b[0],b[1],b[2]]):b;
    let C=matrix?M.xform(matrix,[c[0],c[1],c[2]]):c;
    let nn=n0;
    if(matrix){
      const e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],e2=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];
      let g=V.norm(V.cross(e1,e2));
      if(V.dot(g,n0)<0)g=V.scale(g,-1);
      // blend with the source normal: keeps real deformation shading without
      // the checkerboard caused by near-degenerate facets flipping sign
      nn=V.norm(V.add(V.scale(n0,0.45),V.scale(g,0.55)));
    }
    const o=override||{};
    const cc=(o.alpha!==undefined)?[col[0],col[1],col[2],(col[3]===undefined?1:col[3])*o.alpha]:(o.c||col);
    batch.tri(
      AE.v(A,nn,cc,o.m||mat,uvt,o.dep||0),
      AE.v(B,nn,cc,o.m||mat,uvt,o.dep||0),
      AE.v(C,nn,cc,o.m||mat,uvt,o.dep||0));
  }
};

/* ---------------------------------------------------------------- glyph atlas (Canvas2D -> texture) */
AE.Glyphs={
  canvas:null,ctx:null,map:{},dirty:true,tex:null,cell:128,cols:16,size:104,
  font:'700 104px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC","Segoe UI",sans-serif',
  init(){
    if(this.canvas)return;
    this.canvas=document.createElement('canvas');this.canvas.width=this.cell*this.cols;this.canvas.height=this.cell*this.cols;
    this.ctx=this.canvas.getContext('2d');this.ctx.textBaseline='middle';this.ctx.textAlign='center';
  },
  ensure(str){
    this.init();let added=false;
    for(const ch of String(str)){
      if(ch===' '||ch==='\n'||this.map[ch])continue;
      const k=Object.keys(this.map).length;
      const cx=(k%this.cols)*this.cell, cy=Math.floor(k/this.cols)*this.cell;
      const c=this.ctx;c.font=this.font;c.fillStyle='#fff';
      c.clearRect(cx,cy,this.cell,this.cell);
      const w=c.measureText(ch).width;
      c.save();c.translate(cx+this.cell/2,cy+this.cell/2);
      c.fillText(ch,0,2);c.restore();
      this.map[ch]={u0:cx/this.canvas.width,v0:cy/this.canvas.height,
        u1:(cx+this.cell)/this.canvas.width,v1:(cy+this.cell)/this.canvas.height,
        w:Math.min(w,this.cell),cell:this.cell};
      added=true;
    }
    if(added)this.dirty=true;
  },
  info(ch){this.ensure(ch);return this.map[ch];},
  getTexture(gl){
    this.init();
    if(!this.tex){this.tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.tex);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
    if(this.dirty){gl.bindTexture(gl.TEXTURE_2D,this.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false); // texture row 0 = atlas top
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.canvas);
      this.dirty=false;
    }
    return this.tex;
  }
};

})(window.AE);
