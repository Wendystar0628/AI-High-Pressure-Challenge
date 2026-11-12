/* ============================================================
   geom.js — 几何引擎
   路径/轮廓、粗笔画勾边、修剪路径、重复器、扫描线三角化（含孔洞）、
   挤出实体（正反面/侧壁/倒角/法线）、布尔运算、图钉/场变形、弯曲扭转、
   路径形变。所有结果都是真实几何，可被继续挤出/发射/碰撞。
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE,U=AE.util;
  const G=AE.geom={};

  /* ---------------- Mesh ---------------- */
  class Mesh{
    constructor(){this.pos=[];this.nrm=[];this.idx=[];}
    get triCount(){return this.idx.length/3;}
    addTri(a,b,c,exp){
      let n=U.vec.norm(U.vec.cross(U.vec.sub(b,a),U.vec.sub(c,a)));
      if(exp&&U.vec.dot(n,exp)<0){const t=b;b=c;c=t;n=U.vec.scale(n,-1);}
      const base=this.pos.length/3;
      for(const p of [a,b,c]){this.pos.push(p[0],p[1],p[2]||0);this.nrm.push(n[0],n[1],n[2]);}
      this.idx.push(base,base+1,base+2);
    }
    addQuad(a,b,c,d,exp){this.addTri(a,b,c,exp);this.addTri(a,c,d,exp);}
    append(o){
      const base=this.pos.length/3;
      for(let i=0;i<o.pos.length;i++)this.pos.push(o.pos[i]);
      for(let i=0;i<o.nrm.length;i++)this.nrm.push(o.nrm[i]);
      for(let i=0;i<o.idx.length;i++)this.idx.push(o.idx[i]+base);
      return this;
    }
    transform(m){
      const nm=U.mat4.transpose(U.mat4.invert(m));
      for(let i=0;i<this.pos.length;i+=3){
        const p=U.mat4.transformPoint(m,[this.pos[i],this.pos[i+1],this.pos[i+2]]);
        this.pos[i]=p[0];this.pos[i+1]=p[1];this.pos[i+2]=p[2];
        const n0=U.mat4.transformDir(nm,[this.nrm[i],this.nrm[i+1],this.nrm[i+2]]);
        const n=U.vec.norm(n0);this.nrm[i]=n[0];this.nrm[i+1]=n[1];this.nrm[i+2]=n[2];
      }
      return this;
    }
    bounds(){
      let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
      for(let i=0;i<this.pos.length;i+=3)for(let k=0;k<3;k++){const v=this.pos[i+k];if(v<mn[k])mn[k]=v;if(v>mx[k])mx[k]=v;}
      return {min:mn,max:mx};
    }
  }
  G.Mesh=Mesh;

  /* ---------------- 基础轮廓 ---------------- */
  G.rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  G.ellipse=(cx,cy,rx,ry,n=48)=>{
    const o=[];for(let i=0;i<n;i++){const a=i/n*U.TAU;o.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry]);}return o;
  };
  G.star=(cx,cy,r1,r2,points=5,rot=0)=>{
    const o=[];for(let i=0;i<points*2;i++){const a=rot+i/(points*2)*U.TAU,r=i%2?r2:r1;o.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}return o;
  };
  G.regular=(cx,cy,r,n=6,rot=0)=>{
    const o=[];for(let i=0;i<n;i++){const a=rot+i/n*U.TAU;o.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}return o;
  };
  G.signedArea=(ring)=>{
    let s=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];s+=a[0]*b[1]-b[0]*a[1];}return s/2;
  };

  /* ---------------- 粗笔画勾边（带圆角端帽、斜接拐角） ---------------- */
  G.polylineLength=(pts)=>{let L=0;for(let i=0;i<pts.length-1;i++)L+=U.vec.dist(pts[i],pts[i+1]);return L;};
  /* 沿真实弧长修剪：返回 [0,amount] 段的部分折线 */
  G.trimPolyline=function(pts,amount,fromEnd){
    amount=U.clamp(amount,0,1);
    if(amount<=0)return [pts[0].slice(),pts[0].slice()];
    if(amount>=1)return pts.map(p=>p.slice());
    const total=G.polylineLength(pts)||1;
    let target=total*amount;
    const out=[];
    if(fromEnd){
      const rev=pts.slice().reverse();const sub=G.trimPolyline(rev,amount,false);return sub.reverse();
    }
    out.push(pts[0].slice());
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1],seg=U.vec.dist(a,b);
      if(target<=seg){const f=target/seg;out.push([U.lerp(a[0],b[0],f),U.lerp(a[1],b[1],f)]);return out;}
      target-=seg;out.push(b.slice());
    }
    return out;
  };
  /* 生成笔画外轮廓（单个闭合环） */
  G.strokeOutline=function(pts,width,capSeg=6){
    // 去重
    const P=[];for(const p of pts)if(!P.length||U.vec.dist(P[P.length-1],p)>1e-6)P.push(p.slice());
    if(P.length<2)return G.ellipse(P[0][0],P[0][1],width/2,width/2,12);
    const w=width/2,n=P.length;
    const dirs=[],norms=[],left=[],right=[];
    for(let i=0;i<n-1;i++){
      const d=U.vec.norm(U.vec.sub(P[i+1],P[i]));dirs.push(d);norms.push([-d[1],d[0]]);
    }
    // 顶点法线（斜接，限制长度）
    const vnorm=[];
    for(let i=0;i<n;i++){
      const a=norms[Math.max(0,i-1)],b=norms[Math.min(norms.length-1,i)];
      let m=U.vec.norm(U.vec.add(a,b));
      if(U.vec.len(m)<.5)m=b.slice();
      const denom=U.vec.dot(m,b)||1;
      const L=U.clamp(1/denom,1,1.6);
      vnorm.push(U.vec.scale(m,L));
    }
    for(let i=0;i<n;i++){
      left.push(U.vec.add(P[i],U.vec.scale(vnorm[i],w)));
      right.push(U.vec.add(P[i],U.vec.scale(vnorm[i],-w)));
    }
    const ring=[];
    // 起点圆帽：从 left[0] 绕到 right[0]（经过 -dir 半侧）
    const d0=dirs[0],n0=norms[0];
    for(let s=0;s<=capSeg;s++){
      const a=Math.PI/2 - s/capSeg*Math.PI;
      ring.push([P[0][0]+(Math.cos(a)*n0[0]-Math.sin(a)*d0[0])*w,
                 P[0][1]+(Math.cos(a)*n0[1]-Math.sin(a)*d0[1])*w]);
    }
    for(let i=1;i<n-1;i++)ring.push(left[i]);
    // 终点圆帽
    const dl=dirs[dirs.length-1],nl=norms[norms.length-1],Pe=P[n-1];
    ring.push(left[n-1]);
    for(let s=1;s<=capSeg;s++){
      const a=-Math.PI/2 + s/capSeg*Math.PI;
      ring.push([Pe[0]+(Math.cos(a)*nl[0]+Math.sin(a)*dl[0])*w,
                 Pe[1]+(Math.cos(a)*nl[1]+Math.sin(a)*dl[1])*w]);
    }
    for(let i=n-2;i>=1;i--)ring.push(right[i]);
    return ring;
  };

  /* ---------------- 重复器 ---------------- */
  G.repeatContours=function(contours,count,offset,rotation,scale){
    const out=[];const c=Math.max(1,Math.round(count));
    for(let i=0;i<c;i++){
      const m=U.mat4.mulAll(
        U.mat4.translation(offset[0]*i,offset[1]*i,0),
        U.mat4.rotZ(U.rad(rotation*i)),
        U.mat4.scaling(Math.pow(scale[0],i),Math.pow(scale[1],i),1));
      for(const ring of contours){
        out.push(ring.map(p=>{const q=U.mat4.transformPoint(m,[p[0],p[1],0]);return [q[0],q[1]];}));
      }
    }
    return out;
  };

  /* ---------------- 扫描线三角化（even-odd，天然支持孔洞与凹部） ----------------
     在每个“板条”内没有顶点，因此穿过板条的交点边集合恒定，可 1:1 配对生成梯形。
  --------------------------------------------------------------------------- */
  G.triangulateRegion=function(contours,opts){
    opts=opts||{};
    const tris=[];
    if(!contours||!contours.length)return tris;
    // 收集所有 y
    const ys=[];let minY=1e9,maxY=-1e9,minX=1e9,maxX=-1e9;
    for(const ring of contours)for(const p of ring){
      ys.push(p[1]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);
      minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);
    }
    if(maxY-minY<1e-9)return tris;
    ys.sort((a,b)=>a-b);
    const uniq=[];for(const y of ys)if(!uniq.length||Math.abs(y-uniq[uniq.length-1])>1e-6)uniq.push(y);
    const scan=[minY-1e-4];
    for(let i=0;i<uniq.length;i++){scan.push(uniq[i]);if(i<uniq.length-1)scan.push((uniq[i]+uniq[i+1])/2);}
    scan.push(maxY+1e-4);
    // 边表
    const edges=[];
    for(const ring of contours)for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      if(Math.abs(a[1]-b[1])<1e-9)continue;
      edges.push([a[0],a[1],b[0],b[1]]);
    }
    const xAt=(e,y)=>{const t=(y-e[1])/(e[3]-e[1]);return e[0]+(e[2]-e[0])*t;};
    for(let s=0;s<scan.length-1;s++){
      const yb=scan[s],yt=scan[s+1],mid=(yb+yt)/2;
      if(yt-yb<1e-9)continue;
      const cross=[];
      for(const e of edges){
        if((e[1]<=mid&&e[3]>mid)||(e[3]<=mid&&e[1]>mid))cross.push(e);
      }
      if(cross.length<2)continue;
      const bot=cross.map(e=>[xAt(e,yb),e]).sort((a,b)=>a[0]-b[0]);
      const top=cross.map(e=>[xAt(e,yt),e]).sort((a,b)=>a[0]-b[0]);
      // 板条内无顶点，顺序一致，偶数配对
      for(let k=0;k+1<bot.length;k+=2){
        const b0=bot[k][0],b1=bot[k+1][0],t0=top[k][0],t1=top[k+1][0];
        if(Math.abs(b1-b0)<1e-7&&Math.abs(t1-t0)<1e-7)continue;
        const A=[b0,yb,0],B=[b1,yb,0],C=[t1,yt,0],D=[t0,yt,0];
        tris.push([A,B,C],[A,C,D]);
      }
    }
    return tris;
  };

  /* ---------------- 轮廓内缩（用于倒角） ---------------- */
  G.insetRings=function(contours,b){
    const out=[];
    for(const ring of contours){
      const area=G.signedArea(ring),sgn=area>=0?1:-1,n=ring.length,q=[];
      for(let i=0;i<n;i++){
        const p=ring[i],pv=ring[(i-1+n)%n],nx=ring[(i+1)%n];
        const e0=U.vec.norm(U.vec.sub(p,pv)),e1=U.vec.norm(U.vec.sub(nx,p));
        // CCW 内向 = (-ey,ex)；CW 内向 = (ey,-ex)
        const in0=[-e0[1]*sgn,e0[0]*sgn],in1=[-e1[1]*sgn,e1[0]*sgn];
        let m=U.vec.norm(U.vec.add(in0,in1));
        if(U.vec.len(m)<.4)m=in1.slice();
        const denom=Math.max(.35,U.vec.dot(m,in1));
        const L=U.clamp(b/denom,b,b*2.2);
        q.push([p[0]+m[0]*L,p[1]+m[1]*L]);
      }
      out.push(q);
    }
    return out;
  };

  /* ---------------- 挤出实体 ---------------- */
  /* contours: 环数组（第一个外轮廓，其余为孔洞；even-odd 决定填充） */
  G.extrude=function(contours,depth,bevel){
    depth=depth==null?0.5:depth;bevel=bevel==null?Math.min(depth*.18,.06):bevel;
    const m=new Mesh(),h=depth/2,bz=Math.min(bevel,depth*.45);
    const outer=contours,inset=bz>1e-5?G.insetRings(contours,bz):contours;
    // 正面（内缩区域）
    for(const tri of G.triangulateRegion(inset))m.addTri(
      [tri[0][0],tri[0][1],h],[tri[1][0],tri[1][1],h],[tri[2][0],tri[2][1],h],[0,0,1]);
    // 背面
    for(const tri of G.triangulateRegion(inset))m.addTri(
      [tri[0][0],tri[0][1],-h],[tri[1][0],tri[1][1],-h],[tri[2][0],tri[2][1],-h],[0,0,-1]);
    // 侧壁 / 倒角 / 每个环的每条边
    for(let ri=0;ri<outer.length;ri++){
      const O=outer[ri],I=inset[ri],n=O.length;
      const area=G.signedArea(O),sgn=area>=0?1:-1;
      for(let i=0;i<n;i++){
        const j=(i+1)%n,a=O[i],b=O[j],ia=I[i],ib=I[j];
        const d=U.vec.norm(U.vec.sub(b,a));
        const outN=[d[1]*sgn,-d[0]*sgn,0]; // 外法线（CCW 在右侧，CW 在左侧）
        // 侧壁
        m.addQuad([a[0],a[1],-h+bz],[b[0],b[1],-h+bz],[b[0],b[1],h-bz],[a[0],a[1],h-bz],outN);
        // 前倒角
        if(bz>1e-5){
          const expN=U.vec.norm(U.vec.add(outN,[0,0,1.1]));
          m.addQuad([a[0],a[1],h-bz],[b[0],b[1],h-bz],[ib[0],ib[1],h],[ia[0],ia[1],h],expN);
          const expN2=U.vec.norm(U.vec.add(outN,[0,0,-1.1]));
          m.addQuad([b[0],b[1],-h+bz],[a[0],a[1],-h+bz],[ia[0],ia[1],-h],[ib[0],ib[1],-h],expN2);
        }
      }
    }
    return m;
  };

  /* 正六面体（真实 3D 盒，六个面 + 外向法线） */
  G.box=function(w,h,d){
    const m=new Mesh(),x=w/2,y=h/2,z=d/2;
    // 前 z+ / 后 z-
    m.addQuad([-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z],[0,0,1]);
    m.addQuad([x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z],[0,0,-1]);
    // 右 x+ / 左 x-
    m.addQuad([x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z],[1,0,0]);
    m.addQuad([-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z],[-1,0,0]);
    // 上 y+ / 下 y-
    m.addQuad([-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z],[0,1,0]);
    m.addQuad([-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z],[0,-1,0]);
    return m;
  };

  /* 由多条笔画生成完整挤出实体（字形、块体） */
  G.extrudeStrokes=function(strokes,depth,bevel,trim){
    const m=new Mesh();
    for(let i=0;i<strokes.length;i++){
      const s=strokes[i];
      let pts=s.pts;
      const amt=Array.isArray(trim)?(trim[i]!=null?trim[i]:trim[trim.length-1]):(trim==null?1:trim);
      if(amt<=0.001)continue; // 尚未写到的笔画不产生任何几何（避免出现起点圆点）
      if(amt<1)pts=G.trimPolyline(pts,amt,s.fromEnd);
      const ring=G.strokeOutline(pts,s.width!=null?s.width:.14,s.capSeg);
      const part=G.extrude([ring],depth,bevel);
      if(s.z)m.append(part.transform(U.mat4.translation(0,0,s.z)));
      else m.append(part);
    }
    return m;
  };

  /* ---------------- 平面网格 / 三角网格（轮廓几何） ---------------- */
  G.contourMesh=function(contours,z){
    const m=new Mesh();z=z||0;
    for(const tri of G.triangulateRegion(contours))m.addTri(
      [tri[0][0],tri[0][1],z],[tri[1][0],tri[1][1],z],[tri[2][0],tri[2][1],z],[0,0,1]);
    return m;
  };

  /* ---------------- 形变 ---------------- */
  /* 图钉（位置/旋转/缩放，IDW 平滑混合，多钉不撕裂） */
  G.pinDisplacement=function(p,pins){
    let acc=[0,0,0],wsum=0;
    for(const pin of pins){
      const c=pin.pos||[0,0],r=pin.radius||1;
      const d=Math.hypot(p[0]-c[0],p[1]-c[1]);
      const w=Math.exp(-(d*d)/(2*r*r));
      if(w<1e-5)continue;
      const off=pin.offset||[0,0,0],sc=pin.scale==null?1:pin.scale,rot=U.rad(pin.rot||0);
      let q=[p[0]-c[0],p[1]-c[1],p[2]||0];
      // 缩放
      q=[q[0]*sc,q[1]*sc,q[2]*sc];
      // 绕 z 旋转
      q=[q[0]*Math.cos(rot)-q[1]*Math.sin(rot),q[0]*Math.sin(rot)+q[1]*Math.cos(rot),q[2]];
      q=[q[0]+c[0]+off[0],q[1]+c[1]+off[1],q[2]+off[2]];
      acc[0]+=w*(q[0]-p[0]);acc[1]+=w*(q[1]-p[1]);acc[2]+=w*(q[2]-(p[2]||0));
      wsum+=w;
    }
    if(wsum<1e-6)return null;
    return U.vec.scale(acc,1/wsum);
  };
  G.fieldForce=function(p,fields,t){
    let f=[0,0,0];
    for(const F of fields){
      const c=F.position||[0,0,0],r=F.radius||2,str=F.strength==null?1:F.strength;
      const dx=p[0]-c[0],dy=p[1]-c[1],dz=(p[2]||0)-(c[2]||0);
      const d2=dx*dx+dy*dy+dz*dz;
      const fall=Math.exp(-d2/(2*r*r));
      if(fall<1e-4)continue;
      if(F.type==='vortex'){
        f[0]+=-dy*str*fall;f[1]+=dx*str*fall;f[2]+=U.noise(p[0]*.5,t)*str*fall*.2;
      }else if(F.type==='attract'||F.type==='repel'){
        const s=(F.type==='repel'?1:-1)*str*fall/(Math.sqrt(d2)+.2);
        f[0]+=dx*s;f[1]+=dy*s;f[2]+=dz*s;
      }else if(F.type==='noise'){
        f[0]+=U.noise(p[0]*1.3+t,p[1]*1.3)*str*fall;
        f[1]+=U.noise(p[1]*1.3-t,p[0]*1.3)*str*fall;
        f[2]+=U.noise(p[0]*.7,p[1]*.7+t)*str*fall*.5;
      }else{ // distance / radial
        const s=str*fall/(Math.sqrt(d2)+.3);
        f[0]+=dx*s;f[1]+=dy*s;f[2]+=dz*s;
      }
    }
    return f;
  };
  G.recomputeNormals=function(mesh){
    const N=new Float32Array(mesh.pos.length);
    for(let i=0;i<mesh.idx.length;i+=3){
      const a=mesh.idx[i]*3,b=mesh.idx[i+1]*3,c=mesh.idx[i+2]*3;
      const p=[mesh.pos[a],mesh.pos[a+1],mesh.pos[a+2]];
      const q=[mesh.pos[b],mesh.pos[b+1],mesh.pos[b+2]];
      const r=[mesh.pos[c],mesh.pos[c+1],mesh.pos[c+2]];
      const n=U.vec.cross(U.vec.sub(q,p),U.vec.sub(r,p));
      for(const k of [a,b,c]){N[k]+=n[0];N[k+1]+=n[1];N[k+2]+=n[2];}
    }
    for(let i=0;i<N.length;i+=3){
      const n=U.vec.norm([N[i],N[i+1],N[i+2]]);
      mesh.nrm[i]=n[0];mesh.nrm[i+1]=n[1];mesh.nrm[i+2]=n[2];
    }
    return mesh;
  };
  /* 应用变形器到真实顶点，并重算法线 */
  G.deform=function(mesh,opts){
    opts=opts||{};
    const pins=opts.pins||[],fields=opts.fields||[],t=opts.t||0,amp=opts.amp==null?1:opts.amp;
    if(!pins.length&&!fields.length&&!opts.fn)return mesh;
    for(let i=0;i<mesh.pos.length;i+=3){
      const p=[mesh.pos[i],mesh.pos[i+1],mesh.pos[i+2]];
      let d=[0,0,0];
      if(pins.length){const pd=G.pinDisplacement(p,pins);if(pd)d=U.vec.add(d,pd);}
      if(fields.length)d=U.vec.add(d,U.vec.scale(G.fieldForce(p,fields,t),amp));
      if(opts.fn){const fd=opts.fn(p);if(fd)d=U.vec.add(d,fd);}
      mesh.pos[i]=p[0]+d[0];mesh.pos[i+1]=p[1]+d[1];mesh.pos[i+2]=p[2]+d[2];
    }
    return G.recomputeNormals(mesh);
  };
  /* 弯曲 / 扭转（三维实体） */
  G.bend=function(mesh,angle,axis){
    axis=axis||'x';const k=angle===0?1e-6:angle;
    for(let i=0;i<mesh.pos.length;i+=3){
      const x=mesh.pos[i],y=mesh.pos[i+1],z=mesh.pos[i+2];
      if(axis==='x'){
        const r=1/k,a=x*k;
        mesh.pos[i]=(r+y)*Math.sin(a);
        mesh.pos[i+1]=(r+y)*Math.cos(a)-r;
      }else{
        const r=1/k,a=y*k;
        mesh.pos[i+1]=(r+z)*Math.sin(a);
        mesh.pos[i+2]=(r+z)*Math.cos(a)-r;
      }
    }
    return G.recomputeNormals(mesh);
  };
  G.twist=function(mesh,angle){
    const k=angle;
    for(let i=0;i<mesh.pos.length;i+=3){
      const z=mesh.pos[i+2],a=z*k,c=Math.cos(a),s=Math.sin(a);
      const x=mesh.pos[i],y=mesh.pos[i+1];
      mesh.pos[i]=x*c-y*s;mesh.pos[i+1]=x*s+y*c;
    }
    return G.recomputeNormals(mesh);
  };

  /* ---------------- 布尔运算（栅格 + 边界追踪，对任意形状有效） ---------------- */
  function pointInRings(x,y,contours){
    let inside=false;
    for(const ring of contours){
      const n=ring.length;
      for(let i=0,j=n-1;i<n;j=i++){
        const a=ring[i],b=ring[j];
        if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      }
    }
    return inside;
  }
  G.boolean=function(A,B,op,bounds){
    // A,B: 环数组
    let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
    for(const rings of [A,B])for(const ring of rings)for(const p of ring){
      minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);
    }
    if(bounds){minX=bounds.minX;minY=bounds.minY;maxX=bounds.maxX;maxY=bounds.maxY;}
    const pad=Math.max((maxX-minX),(maxY-minY))*.08+.01;
    minX-=pad;minY-=pad;maxX+=pad;maxY+=pad;
    const R=200,W=R,H=Math.max(8,Math.round(R*(maxY-minY)/(maxX-minX)));
    const sx=(maxX-minX)/W,sy=(maxY-minY)/H;
    const maskA=new Uint8Array(W*H),maskB=new Uint8Array(W*H);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const wx=minX+(x+.5)*sx,wy=minY+(y+.5)*sy;
      maskA[y*W+x]=pointInRings(wx,wy,A)?1:0;
      maskB[y*W+x]=pointInRings(wx,wy,B)?1:0;
    }
    const M=new Uint8Array(W*H);
    for(let i=0;i<M.length;i++){
      const a=maskA[i],b=maskB[i];
      M[i]=op==='union'?(a|b):op==='intersect'?(a&b):op==='difference'?(a&~b):(a^b);
    }
    const filled=(x,y)=>(x>=0&&y>=0&&x<W&&y<H&&M[y*W+x])?1:0;
    // 有向边界边（网格坐标）
    const edges=[];
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(filled(x,y)){
      if(!filled(x,y-1))edges.push([[x,y],[x+1,y]]);
      if(!filled(x+1,y))edges.push([[x+1,y],[x+1,y+1]]);
      if(!filled(x,y+1))edges.push([[x+1,y+1],[x,y+1]]);
      if(!filled(x-1,y))edges.push([[x,y+1],[x,y]]);
    }
    // 链接成环
    const map=new Map();
    const key=p=>p[0]+','+p[1];
    for(const e of edges){const k=key(e[0]);if(!map.has(k))map.set(k,[]);map.get(k).push(e);}
    const used=new Set(),loops=[];
    for(let i=0;i<edges.length;i++){
      if(used.has(i))continue;
      const loop=[edges[i][0].slice()];const start=key(edges[i][0]);let cur=edges[i][1],idx=i;
      used.add(i);let guard=0;
      while(guard++<edges.length+4){
        loop.push(cur.slice());
        if(key(cur)===start)break;
        const cand=map.get(key(cur));if(!cand)break;
        let pick=-1;
        for(let c=0;c<cand.length;c++){const gi=edges.indexOf(cand[c]);if(!used.has(gi)){pick=gi;break;}}
        if(pick<0)break;
        used.add(pick);cur=edges[pick][1];
      }
      if(loop.length>3)loops.push(loop);
    }
    // 简化 + 映射回世界坐标
    const out=[];
    for(const loop of loops){
      const simp=[];
      for(const p of loop){
        const w=[minX+p[0]*sx,minY+p[1]*sy];
        if(simp.length&&U.vec.dist(simp[simp.length-1],w)<1e-6)continue;
        simp.push(w);
      }
      // 去共线
      const s2=[];
      for(let i=0;i<simp.length;i++){
        const a=simp[(i-1+simp.length)%simp.length],b=simp[i],c=simp[(i+1)%simp.length];
        const cr=Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]));
        if(cr>1e-7)s2.push(b);
      }
      if(s2.length>2)out.push(s2);
    }
    return out;
  };

  /* ---------------- 路径形变（含孔洞轮廓保持对应） ---------------- */
  G.resample=(ring,n)=>{
    const L=[];let total=0;
    for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];const l=U.vec.dist(a,b);L.push(l);total+=l;}
    const out=[];let seg=0,acc=0;
    for(let i=0;i<n;i++){
      const target=total*i/n;
      while(seg<ring.length-1&&acc+L[seg]<target){acc+=L[seg];seg++;}
      const f=L[seg]>0?(target-acc)/L[seg]:0;
      const a=ring[seg],b=ring[(seg+1)%ring.length];
      out.push([U.lerp(a[0],b[0],f),U.lerp(a[1],b[1],f)]);
    }
    return out;
  };
  G.lerpContours=function(A,B,t){
    const n=Math.max(A.length,B.length),out=[];
    for(let i=0;i<n;i++){
      const ra=A[Math.min(i,A.length-1)]||[[0,0]],rb=B[Math.min(i,B.length-1)]||[[0,0]];
      const N=Math.max(ra.length,rb.length,16);
      const a=G.resample(ra,N),b=G.resample(rb,N);
      out.push(a.map((p,k)=>[U.lerp(p[0],b[k][0],t),U.lerp(p[1],b[k][1],t)]));
    }
    return out;
  };

  console.log('[forge] geom ready');
})();
