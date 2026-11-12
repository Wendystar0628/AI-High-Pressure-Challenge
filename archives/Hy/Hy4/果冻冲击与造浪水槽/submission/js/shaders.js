/* 所有 WGSL 着色器字符串（经典脚本，window.SH） */
(function () {
  'use strict';
  const SH = {};

  /* ------------------------------------------------------------------ *
   * 全屏三角形顶点着色器
   * ------------------------------------------------------------------ */
  SH.VS = /* wgsl */`
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{
  var p=array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));
  return vec4<f32>(p[i],0.0,1.0);
}`;

  /* ------------------------------------------------------------------ *
   * 主渲染：解析几何(光栅无关的光线求交) + 粒子密度场等值面光线步进
   * ------------------------------------------------------------------ */
  SH.FS = /* wgsl */`
struct U {
  camPos : vec4<f32>, camRight: vec4<f32>, camUp: vec4<f32>, camFwd: vec4<f32>,
  p0 : vec4<f32>, p1 : vec4<f32>, p2 : vec4<f32>, p3 : vec4<f32>,
  lightDir: vec4<f32>, lightCol: vec4<f32>,
  volMin: vec4<f32>, volMax: vec4<f32>,
  jellyTint: vec4<f32>, waterTint: vec4<f32>, tankP: vec4<f32>, p4: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: U;
struct Ball { a: vec4<f32>, b: vec4<f32>, c: vec4<f32> };
@group(0) @binding(1) var<storage, read> balls: array<Ball>;
@group(0) @binding(2) var volTex: texture_3d<f32>;
@group(0) @binding(3) var samp: sampler;

struct Hit { t:f32, n:vec3<f32>, col:vec3<f32>, metal:f32, rough:f32, kind:f32 };
fn mkHit(t:f32,n:vec3<f32>,col:vec3<f32>,metal:f32,rough:f32,kind:f32)->Hit{
  var h:Hit; h.t=t;h.n=n;h.col=col;h.metal=metal;h.rough=rough;h.kind=kind;return h;
}
fn miss()->Hit{ return mkHit(-1.0,vec3<f32>(0.0,1.0,0.0),vec3<f32>(0.0),0.0,0.0,6.0); }
fn nearer(a:Hit,b:Hit)->Hit{ if(b.t>0.0005 && b.t<a.t){return b;} return a; }
struct BH { t:f32, n:vec3<f32> };
fn boxHit(ro:vec3<f32>,rd:vec3<f32>,bmin:vec3<f32>,bmax:vec3<f32>)->BH{
  var r:BH; r.t=-1.0; r.n=vec3<f32>(0.0,1.0,0.0);
  let inv=1.0/(rd+vec3<f32>(1e-7));
  let t0=(bmin-ro)*inv; let t1=(bmax-ro)*inv;
  let tmn=min(t0,t1); let tmx=max(t0,t1);
  let tn=max(max(tmn.x,tmn.y),tmn.z);
  let tf=min(min(tmx.x,tmx.y),tmx.z);
  if(tf<max(tn,0.0) || tn<0.0){return r;}
  r.t=tn;
  if(tmn.x>tmn.y && tmn.x>tmn.z){r.n=vec3<f32>(-sign(rd.x),0.0,0.0);}
  else if(tmn.y>tmn.z){r.n=vec3<f32>(0.0,-sign(rd.y),0.0);}
  else{r.n=vec3<f32>(0.0,0.0,-sign(rd.z));}
  return r;
}
fn sphHit(ro:vec3<f32>,rd:vec3<f32>,c:vec3<f32>,r:f32)->f32{
  let oc=ro-c; let b=dot(oc,rd); let cc=dot(oc,oc)-r*r; let h=b*b-cc;
  if(h<0.0){return -1.0;} let s=sqrt(h); var t=-b-s; if(t<0.0){t=-b+s;} return t;
}
fn ellipsoidHit(ro:vec3<f32>,rd:vec3<f32>,c:vec3<f32>,rad:vec3<f32>)->BH{
  var r:BH; r.t=-1.0; r.n=vec3<f32>(0.0,1.0,0.0);
  let inv=1.0/rad; let ro2=(ro-c)*inv; let rd2=rd*inv;
  let t=sphHit(ro2,rd2,vec3<f32>(0.0),1.0);
  if(t>0.0){ let p=ro2+rd2*t; r.t=t; r.n=normalize(p*inv); }
  return r;
}
fn boxCand(ro:vec3<f32>,rd:vec3<f32>,bmin:vec3<f32>,bmax:vec3<f32>,col:vec3<f32>,metal:f32,rough:f32,kind:f32)->Hit{
  let b=boxHit(ro,rd,bmin,bmax);
  if(b.t<0.0){return miss();}
  return mkHit(b.t,b.n,col,metal,rough,kind);
}
fn hash21(p0:vec2<f32>)->f32{
  var p3=fract(vec3<f32>(p0.x,p0.y,p0.x)*0.1031);
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
fn envColor(d:vec3<f32>)->vec3<f32>{
  let t=clamp(d.y*0.5+0.5,0.0,1.0);
  var c=mix(vec3<f32>(0.05,0.075,0.10),vec3<f32>(0.22,0.31,0.40),t);
  let L=normalize(u.lightDir.xyz);
  c+=u.lightCol.rgb*pow(max(dot(d,L),0.0),16.0)*2.4;
  let L2=normalize(vec3<f32>(-0.7,0.28,-0.62));
  c+=vec3<f32>(0.16,0.30,0.38)*pow(max(dot(d,L2),0.0),8.0)*0.8;
  let L3=normalize(vec3<f32>(0.1,0.9,0.35));
  c+=vec3<f32>(0.9,0.95,1.0)*pow(max(dot(d,L3),0.0),60.0)*1.2;
  return c;
}
fn background(rd:vec3<f32>,uv:vec2<f32>)->vec3<f32>{
  let t=clamp(rd.y*0.5+0.5,0.0,1.0);
  var c=mix(vec3<f32>(0.014,0.024,0.036),vec3<f32>(0.055,0.092,0.12),t);
  c+=vec3<f32>(0.035,0.065,0.082)*exp(-dot(uv,uv)*1.4);
  return c;
}
fn shadowOcc(p:vec3<f32>,L:vec3<f32>,N:vec3<f32>)->f32{
  let o=p+N*0.02+L*0.01;
  var s=1.0; let n=u32(u.p0.w);
  for(var i:u32=0u;i<n;i++){
    let b=balls[i]; let t=sphHit(o,L,b.a.xyz,b.a.w);
    if(t>0.0 && t<30.0){ s=min(s,0.30); }
  }
  return s;
}
fn traceOpaque(ro:vec3<f32>,rd:vec3<f32>)->Hit{
  var h=miss(); h.t=1e9;
  if(rd.y<-1e-5){
    let t=(-0.62-ro.y)/rd.y;
    if(t>0.0){
      h=nearer(h,mkHit(t,vec3<f32>(0.0,1.0,0.0),vec3<f32>(0.030,0.044,0.056),0.18,0.55,0.0));
    }
  }
  h=nearer(h,boxCand(ro,rd,vec3<f32>(-4.2,-0.62,-2.4),vec3<f32>(4.2,0.0,2.4),vec3<f32>(0.055,0.075,0.092),0.35,0.5,1.0));
  if(u.p1.z>1.5){
    let L=3.02; let H=3.0; let D=0.86; let e=0.045;
    let gcol=vec3<f32>(0.72,0.86,0.94);
    for(var i:i32=0;i<2;i++){for(var j:i32=0;j<2;j++){
      let x=select(-L,L,i==1); let z=select(-D,D,j==1);
      h=nearer(h,boxCand(ro,rd,vec3<f32>(x-e,-0.02,z-e),vec3<f32>(x+e,H,z+e),gcol,0.75,0.12,2.0));
    }}
    for(var k:i32=0;k<2;k++){
      let y=select(0.02,H,k==1);
      for(var j:i32=0;j<2;j++){
        let z=select(-D,D,j==1);
        h=nearer(h,boxCand(ro,rd,vec3<f32>(-L,y-e,z-e),vec3<f32>(L,y+e,z+e),gcol,0.75,0.12,2.0));
      }
      for(var i2:i32=0;i2<2;i2++){
        let x=select(-L,L,i2==1);
        h=nearer(h,boxCand(ro,rd,vec3<f32>(x-e,y-e,-D),vec3<f32>(x+e,y+e,D),gcol,0.75,0.12,2.0));
      }
    }
    let px=u.tankP.x; let ph=u.tankP.y; let pt=u.tankP.z;
    h=nearer(h,boxCand(ro,rd,vec3<f32>(px-ph,0.02,-D+0.02),vec3<f32>(px+ph,pt,D-0.02),vec3<f32>(0.28,0.34,0.40),0.72,0.28,4.0));
    let eh=ellipsoidHit(ro,rd,vec3<f32>(1.25,-0.55,0.0),vec3<f32>(1.7,0.95,1.05));
    if(eh.t>0.0){ h=nearer(h,mkHit(eh.t,eh.n,vec3<f32>(0.19,0.185,0.155),0.05,0.85,5.0)); }
  }
  let n=u32(u.p0.w);
  for(var i3:u32=0u;i3<n;i3++){
    let b=balls[i3]; let t=sphHit(ro,rd,b.a.xyz,b.a.w);
    if(t>0.0){ let p=ro+rd*t; let nn=normalize(p-b.a.xyz);
      h=nearer(h,mkHit(t,nn,b.b.rgb,b.c.x,b.c.y,3.0)); }
  }
  return h;
}
fn shadeHit(ro:vec3<f32>,rd:vec3<f32>,h:Hit,doShadow:bool)->vec3<f32>{
  let p=ro+rd*h.t; var N=normalize(h.n); let V=-rd;
  if(dot(N,V)<0.0){N=-N;}
  let L=normalize(u.lightDir.xyz); let Hh=normalize(L+V);
  let ndl=max(dot(N,L),0.0);
  let sp=pow(max(dot(N,Hh),0.0),mix(20.0,160.0,1.0-h.rough));
  let fres=pow(1.0-max(dot(N,V),0.0),5.0);
  var sh=1.0;
  if(doShadow){ sh=shadowOcc(p,L,N); }
  if(h.kind<0.5){
    let n=u32(u.p0.w);
    for(var i:u32=0u;i<n;i++){
      let b=balls[i]; let dxz=vec2<f32>(p.x-b.a.x,p.z-b.a.z); let d=length(dxz);
      let shc=1.0-0.82*exp(-d*d/(b.a.w*b.a.w*1.7))*clamp((b.a.y+0.62)/1.4,0.0,1.0);
      sh*=shc;
    }
    let gx=abs(fract(p.x*0.5)-0.5); let gz=abs(fract(p.z*0.5)-0.5);
    sh*=1.0-0.30*smoothstep(0.46,0.5,max(gx,gz));
  }
  var col=h.col*(0.18+0.82*ndl*sh)*(1.0-h.metal*0.78);
  col+=u.lightCol.rgb*sp*(0.35+0.65*h.metal)*sh*mix(0.4,1.0,1.0-h.rough);
  col+=envColor(reflect(rd,N))*(0.06+1.25*h.metal)*(0.45+0.55*fres);
  col+=h.col*fres*0.16;
  return col;
}
fn volSample(p:vec3<f32>)->vec4<f32>{
  let uvw=(p-u.volMin.xyz)/(u.volMax.xyz-u.volMin.xyz);
  return textureSampleLevel(volTex,samp,clamp(uvw,vec3<f32>(0.002),vec3<f32>(0.998)),0.0);
}
fn volDens(p:vec3<f32>)->f32{ return volSample(p).x; }
fn volNormal(p:vec3<f32>)->vec3<f32>{
  let e=0.02;
  let dx=volDens(p+vec3<f32>(e,0.0,0.0))-volDens(p-vec3<f32>(e,0.0,0.0));
  let dy=volDens(p+vec3<f32>(0.0,e,0.0))-volDens(p-vec3<f32>(0.0,e,0.0));
  let dz=volDens(p+vec3<f32>(0.0,0.0,e))-volDens(p-vec3<f32>(0.0,0.0,e));
  return -normalize(vec3<f32>(dx,dy,dz)+vec3<f32>(0.0,1e-6,0.0));
}
fn shadeLayer(p:vec3<f32>,rd:vec3<f32>,jelly:bool,s:vec4<f32>)->vec4<f32>{
  var N=volNormal(p); let V=-rd;
  if(dot(N,V)<0.0){N=-N;}
  let L=normalize(u.lightDir.xyz); let Hh=normalize(L+V);
  let fres=pow(1.0-max(dot(N,V),0.0),5.0);
  let spec=pow(max(dot(N,Hh),0.0),110.0);
  let refr=refract(rd,N,1.0/1.34);
  let rdir=select(refr,rd,length(refr)<0.001);
  var thick=0.0;
  for(var k:i32=0;k<10;k++){ thick+=volDens(p+rdir*(0.05+f32(k)*0.055)); }
  thick*=0.055;
  let bgp=p+rdir*0.03; let h2=traceOpaque(bgp,rdir);
  var bg2:vec3<f32>;
  if(h2.t>1e8){bg2=background(rdir,vec2<f32>(0.0));}
  else{bg2=shadeHit(bgp,rdir,h2,false);}
  let refl=envColor(reflect(rd,N));
  let F=clamp(mix(0.04,1.0,fres),0.0,1.0);
  let dj=max(s.x,0.001);
  let jc=clamp(s.yzw/dj,vec3<f32>(0.06),vec3<f32>(1.0));
  let foam=clamp(s.y/dj,0.0,1.0)*u.p2.z;
  var base:vec3<f32>; var alpha:f32;
  if(jelly){
    let absorb=exp(-thick*(vec3<f32>(1.0)-jc)*1.5);
    base=jc*0.95+bg2*absorb*0.55;
    base+=jc*pow(1.0-max(dot(N,V),0.0),2.2)*0.55;
    alpha=0.80;
  }else{
    let absorb=exp(-thick*u.waterTint.rgb);
    base=bg2*absorb*0.85+vec3<f32>(0.05,0.14,0.19)*(0.5+thick*0.35);
    base=mix(base,vec3<f32>(0.90,0.96,1.0),clamp(foam,0.0,1.0));
    alpha=mix(0.84,1.0,clamp(foam,0.0,1.0));
  }
  var c=mix(base,refl,clamp(F*select(0.86,0.62,jelly),0.0,0.94));
  c+=u.lightCol.rgb*spec*select(1.7,1.4,jelly);
  if(jelly){
    c+=jc*fres*0.55;
  }else{
    if(foam>0.05){ c+=vec3<f32>(0.12)*hash21(p.xy*41.0+p.z*7.0)*foam; }
  }
  return vec4<f32>(c,alpha);
}
fn renderVolume(ro:vec3<f32>,rd:vec3<f32>,tOpaque:f32,bg:vec3<f32>)->vec3<f32>{
  let inv=1.0/(rd+vec3<f32>(1e-7));
  let ta=(u.volMin.xyz-ro)*inv; let tb=(u.volMax.xyz-ro)*inv;
  let t0=max(max(min(ta.x,tb.x),min(ta.y,tb.y)),min(ta.z,tb.z));
  let t1=min(min(max(ta.x,tb.x),max(ta.y,tb.y)),max(ta.z,tb.z));
  if(t1<max(t0,0.0)){return bg;}
  var t=max(t0,0.0); let tEnd=min(t1,tOpaque+0.05);
  let iso=u.p2.x; let step=max(u.p2.y,0.005); let jelly=u.p1.z<1.5;
  var C=vec3<f32>(0.0); var trans=1.0; var prev=volDens(ro+rd*t); var count=0;
  for(var s:i32=0;s<420;s++){
    if(t>=tEnd){break;}
    var stepCur=step;
    let probe=volDens(ro+rd*(t+step*0.6));
    if(probe<iso*0.35 && prev<iso*0.35){ stepCur=step*2.6; }
    let tn=min(t+stepCur,tEnd); let p=ro+rd*tn; let d=volDens(p);
    if(d>iso && prev<=iso && count<10){
      var lo=t; var hi=tn;
      for(var k:i32=0;k<4;k++){
        let mid=(lo+hi)*0.5;
        if(volDens(ro+rd*mid)>iso){hi=mid;}else{lo=mid;}
      }
      let ts=(lo+hi)*0.5; let hp=ro+rd*ts;
      let lay=shadeLayer(hp,rd,jelly,volSample(hp));
      C+=trans*lay.a*lay.rgb; trans*=(1.0-lay.a); count+=1;
      if(trans<0.02){break;}
    }
    prev=d; t=tn;
  }
  C+=trans*bg;
  return C;
}
@fragment fn fs(@builtin(position) frag:vec4<f32>)->@location(0) vec4<f32>{
  let res=u.p1.xy; let uv=(frag.xy/res)*2.0-vec2<f32>(1.0);
  let px=uv.x*u.p0.x*u.p0.y; let py=-uv.y*u.p0.x;
  let rd=normalize(u.camFwd.xyz+u.camRight.xyz*px+u.camUp.xyz*py);
  let ro=u.camPos.xyz; let bg=background(rd,uv);
  let h=traceOpaque(ro,rd);
  var opaqueCol:vec3<f32>;
  if(h.t>1e8){opaqueCol=bg;}else{opaqueCol=shadeHit(ro,rd,h,true);}
  if(h.kind<0.5 && h.t<1e8 && u.p3.z>0.01){
    let p=ro+rd*h.t; let rdr=reflect(rd,h.n);
    let h2=traceOpaque(p+rdr*0.02,rdr);
    if(h2.t<1e8){
      let rc=shadeHit(p+rdr*0.02,rdr,h2,false);
      let fr=pow(1.0-max(dot(h.n,-rd),0.0),4.0);
      opaqueCol=mix(opaqueCol,rc,clamp(0.55*fr*u.p3.z,0.0,0.55));
    }
  }
  var col=opaqueCol;
  if(u.p1.w>0.5){ col=renderVolume(ro,rd,h.t,opaqueCol); }
  col=vec3<f32>(1.0)-exp(-col*u.p3.x);
  col=pow(clamp(col,vec3<f32>(0.0),vec3<f32>(1.0)),vec3<f32>(0.90));
  let vig=1.0-0.18*dot(uv,uv);
  col*=vig;
  return vec4<f32>(col,1.0);
}`;

  /* ------------------------------------------------------------------ *
   * 密度场：clear / scatter(P2G) / convert / blur
   * 粒子格式：每个粒子 2 个 vec4： (pos.xyz, mass) 与 (aux.xyz, size)
   * acc 为 4 通道定点累加： ch0=质量, ch1..3 = 质量*aux
   * ------------------------------------------------------------------ */
  const DU = /* wgsl */`
struct DU { gmin:vec4<f32>, gmax:vec4<f32>, gdim:vec4<f32>, par:vec4<f32> };
`;
  SH.DENS_CLEAR = /* wgsl */`
@group(0) @binding(0) var<storage, read_write> acc: array<atomic<u32>>;
@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let i=gid.x; if(i>=arrayLength(&acc)){return;}
  atomicStore(&acc[i],0u);
}`;
  SH.DENS_SCATTER = DU + /* wgsl */`
@group(0) @binding(0) var<uniform> du: DU;
@group(0) @binding(1) var<storage, read_write> acc: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read> parts: array<vec4<f32>>;
const SCALE:f32=256.0;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let idx=gid.x; let count=u32(du.gmax.w);
  if(idx>=count){return;}
  let P=parts[idx*2u]; let A=parts[idx*2u+1u];
  let g=(P.xyz-du.gmin.xyz)/(du.gmax.xyz-du.gmin.xyz)*du.gdim.xyz-vec3<f32>(0.5);
  let base=floor(g); let f=g-base;
  let N=vec3<i32>(i32(du.gdim.x),i32(du.gdim.y),i32(du.gdim.z));
  let ncells=N.x*N.y*N.z;
  for(var dz:i32=0;dz<2;dz++){for(var dy:i32=0;dy<2;dy++){for(var dx:i32=0;dx<2;dx++){
    let c=vec3<i32>(base)+vec3<i32>(dx,dy,dz);
    if(c.x<0||c.y<0||c.z<0||c.x>=N.x||c.y>=N.y||c.z>=N.z){continue;}
    let w=select(1.0-f.x,f.x,dx==1)*select(1.0-f.y,f.y,dy==1)*select(1.0-f.z,f.z,dz==1);
    let wm=w*P.w;
    if(wm<=0.0){continue;}
    let cell=c.z*N.y*N.x+c.y*N.x+c.x;
    atomicAdd(&acc[0*ncells+cell],u32(wm*SCALE+0.5));
    atomicAdd(&acc[1*ncells+cell],u32(wm*SCALE*A.x+0.5));
    atomicAdd(&acc[2*ncells+cell],u32(wm*SCALE*A.y+0.5));
    atomicAdd(&acc[3*ncells+cell],u32(wm*SCALE*A.z+0.5));
  }}}
}`;
  SH.DENS_CONVERT = DU + /* wgsl */`
@group(0) @binding(0) var<uniform> du: DU;
@group(0) @binding(1) var<storage, read_write> acc: array<atomic<u32>>;
@group(0) @binding(2) var dst: texture_storage_3d<rgba16float, write>;
const SCALE:f32=256.0;
@compute @workgroup_size(4,4,4)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let N=vec3<u32>(u32(du.gdim.x),u32(du.gdim.y),u32(du.gdim.z));
  if(any(gid>=N)){return;}
  let cell=i32(gid.z*N.y*N.x+gid.y*N.x+gid.x);
  let ncells=i32(N.x*N.y*N.z);
  let m=f32(atomicLoad(&acc[0*ncells+cell]))/SCALE;
  let d=m/du.par.x;
  var r:f32=0.0;var g:f32=0.0;var b:f32=0.0;
  if(m>0.001){
    r=f32(atomicLoad(&acc[1*ncells+cell]))/(m*SCALE);
    g=f32(atomicLoad(&acc[2*ncells+cell]))/(m*SCALE);
    b=f32(atomicLoad(&acc[3*ncells+cell]))/(m*SCALE);
  }
  textureStore(dst,vec3<i32>(gid),vec4<f32>(d,d*r,d*g,d*b));
}`;
  SH.DENS_BLUR = DU + /* wgsl */`
@group(0) @binding(0) var src: texture_3d<f32>;
@group(0) @binding(1) var dst: texture_storage_3d<rgba16float, write>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var<uniform> du: DU;
@compute @workgroup_size(4,4,4)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let N=vec3<u32>(u32(du.gdim.x),u32(du.gdim.y),u32(du.gdim.z));
  if(any(gid>=N)){return;}
  let d=du.gdim.xyz; let uvw=(vec3<f32>(gid)+0.5)/d; let e=1.0/d;
  var c=textureSampleLevel(src,samp,uvw,0.0)*0.40;
  c+=textureSampleLevel(src,samp,uvw+vec3<f32>(e.x,0.0,0.0),0.0)*0.10;
  c+=textureSampleLevel(src,samp,uvw-vec3<f32>(e.x,0.0,0.0),0.0)*0.10;
  c+=textureSampleLevel(src,samp,uvw+vec3<f32>(0.0,e.y,0.0),0.0)*0.10;
  c+=textureSampleLevel(src,samp,uvw-vec3<f32>(0.0,e.y,0.0),0.0)*0.10;
  c+=textureSampleLevel(src,samp,uvw+vec3<f32>(0.0,0.0,e.z),0.0)*0.10;
  c+=textureSampleLevel(src,samp,uvw-vec3<f32>(0.0,0.0,e.z),0.0)*0.10;
  textureStore(dst,vec3<i32>(gid),c);
}`;

  window.SH = SH;
})();
