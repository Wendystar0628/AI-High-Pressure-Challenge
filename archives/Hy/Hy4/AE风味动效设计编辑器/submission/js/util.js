/* ============================================================
   util.js — 数学、向量、矩阵、噪声、颜色、时间码等基础工具
   全局命名空间 window.AE
   ============================================================ */
(function(){
  "use strict";
  const AE = window.AE = window.AE || {};

  const U = AE.util = {};
  U.PI = Math.PI;
  U.TAU = Math.PI * 2;
  U.clamp = (v,a,b)=> v<a?a:(v>b?b:v);
  U.lerp = (a,b,t)=> a+(b-a)*t;
  U.mix = U.lerp;
  U.smoothstep = (e0,e1,x)=>{ const t=U.clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); };
  U.gauss = (x,s)=> Math.exp(-(x*x)/(2*s*s));
  U.sign = Math.sign;
  U.round = (v,n=2)=>{ const p=Math.pow(10,n); return Math.round(v*p)/p; };
  U.deg = r=> r*180/Math.PI;
  U.rad = d=> d*Math.PI/180;

  /* ---------- 可复现随机 ---------- */
  U.mulberry32 = function(seed){
    let a = seed>>>0;
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a>>>15, 1 | a);
      t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t;
      return ((t ^ t>>>14) >>> 0) / 4294967296;
    };
  };
  U.hashStr = function(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; };
  U.hash1 = function(n){ let x=Math.sin(n*127.1+311.7)*43758.5453123; return x-Math.floor(x); };
  U.hash2 = function(x,y){ let a=Math.sin(x*127.1+y*311.7)*43758.5453123; return a-Math.floor(a); };
  U.hash3 = function(x,y,z){ let a=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453123; return a-Math.floor(a); };

  /* 平滑值噪声（可复现、无随机状态） */
  function vn(x,y,z){
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
    const fx=x-ix,fy=y-iy,fz=z-iz;
    const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),uz=fz*fz*(3-2*fz);
    const c=(i,j,k)=>U.hash3(ix+i,iy+j,iz+k);
    const x00=U.lerp(c(0,0,0),c(1,0,0),ux), x10=U.lerp(c(0,1,0),c(1,1,0),ux);
    const x01=U.lerp(c(0,0,1),c(1,0,1),ux), x11=U.lerp(c(0,1,1),c(1,1,1),ux);
    return U.lerp(U.lerp(x00,x10,uy),U.lerp(x01,x11,uy),uz);
  }
  U.noise = function(x,y=0,z=0){ return vn(x,y,z)*2-1; };
  U.fbm = function(x,y=0,z=0,oct=4){ let s=0,a=.5,f=1; for(let i=0;i<oct;i++){ s+=a*U.noise(x*f,y*f,z*f); f*=2;a*=.5;} return s; };
  /* 用于 wiggle 的、按频率确定的平滑伪随机 */
  U.wig = function(t,freq,seed){
    // 分段平滑插值，保证同一 t 恒定
    const x = t*freq;
    const i = Math.floor(x), f = x-i;
    const a = U.hash1(i*1.7 + seed)*2-1;
    const b = U.hash1((i+1)*1.7 + seed)*2-1;
    const u = f*f*(3-2*f);
    return U.lerp(a,b,u);
  };

  /* ---------- 向量（普通数组） ---------- */
  const V = U.vec = {};
  V.add=(a,b)=>a.map((v,i)=>v+(Array.isArray(b)?b[i]:b));
  V.sub=(a,b)=>a.map((v,i)=>v-(Array.isArray(b)?b[i]:b));
  V.mul=(a,b)=>a.map((v,i)=>v*(Array.isArray(b)?b[i]:b));
  V.div=(a,b)=>a.map((v,i)=>v/(Array.isArray(b)?b[i]:b));
  V.scale=(a,s)=>a.map(v=>v*s);
  V.dot=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;};
  V.len=a=>Math.sqrt(V.dot(a,a));
  V.norm=a=>{const l=V.len(a)||1;return V.scale(a,1/l);};
  V.cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  V.dist=(a,b)=>V.len(V.sub(a,b));
  V.lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  V.clone=a=>a.slice();
  V.isVec=a=>Array.isArray(a);

  /* ---------- mat4（列主序，与 WebGL 一致） ---------- */
  const M = U.mat4 = {};
  M.identity=()=>M.create();
  M.create=()=>new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  M.clone=m=>new Float32Array(m);
  M.mul=(a,b)=>{
    const o=new Float32Array(16);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++){
      o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    }
    return o;
  };
  M.mulAll=(...ms)=>ms.reduce((a,b)=>M.mul(a,b));
  M.translation=(x,y,z)=>{const m=M.create();m[12]=x;m[13]=y;m[14]=z;return m;};
  M.scaling=(x,y,z)=>{const m=M.create();m[0]=x;m[5]=y;m[10]=z;return m;};
  M.rotX=a=>{const m=M.create(),c=Math.cos(a),s=Math.sin(a);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;};
  M.rotY=a=>{const m=M.create(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;};
  M.rotZ=a=>{const m=M.create(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m;};
  M.perspective=(fovy,aspect,near,far)=>{
    const f=1/Math.tan(fovy/2),nf=1/(near-far),o=new Float32Array(16);
    o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o;
  };
  M.ortho=(l,r,b,t,n,f)=>{
    const o=M.create();o[0]=2/(r-l);o[5]=2/(t-b);o[10]=-2/(f-n);
    o[12]=-(r+l)/(r-l);o[13]=-(t+b)/(t-b);o[14]=-(f+n)/(f-n);return o;
  };
  M.lookAt=(eye,target,up)=>{
    const z=V.norm(V.sub(eye,target));
    let x=V.cross(up,z); x=V.norm(x.length?x:[1,0,0]);
    const y=V.cross(z,x);
    const m=M.create();
    m[0]=x[0];m[1]=y[0];m[2]=z[0];
    m[4]=x[1];m[5]=y[1];m[6]=z[1];
    m[8]=x[2];m[9]=y[2];m[10]=z[2];
    m[12]=-V.dot(x,eye);m[13]=-V.dot(y,eye);m[14]=-V.dot(z,eye);
    return m;
  };
  M.invert=(m)=>{
    const o=new Float32Array(16);
    const a00=m[0],a01=m[1],a02=m[2],a03=m[3],a10=m[4],a11=m[5],a12=m[6],a13=m[7],
      a20=m[8],a21=m[9],a22=m[10],a23=m[11],a30=m[12],a31=m[13],a32=m[14],a33=m[15];
    const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,
      b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,
      b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,
      b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
    let det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
    if(!det)return M.create(); det=1/det;
    o[0]=(a11*b11-a12*b10+a13*b09)*det;o[1]=(a02*b10-a01*b11-a03*b09)*det;
    o[2]=(a31*b05-a32*b04+a33*b03)*det;o[3]=(a22*b04-a21*b05-a23*b03)*det;
    o[4]=(a12*b08-a10*b11-a13*b07)*det;o[5]=(a00*b11-a02*b08+a03*b07)*det;
    o[6]=(a32*b02-a30*b05-a33*b01)*det;o[7]=(a20*b05-a22*b02+a23*b01)*det;
    o[8]=(a10*b10-a11*b08+a13*b06)*det;o[9]=(a01*b08-a00*b10-a03*b06)*det;
    o[10]=(a30*b04-a31*b02+a33*b00)*det;o[11]=(a21*b02-a20*b04-a23*b00)*det;
    o[12]=(a11*b07-a10*b09-a12*b06)*det;o[13]=(a00*b09-a01*b07+a02*b06)*det;
    o[14]=(a31*b01-a30*b03-a32*b00)*det;o[15]=(a20*b03-a21*b01+a22*b00)*det;
    return o;
  };
  M.transpose=(m)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=m[r*4+c];return o;};
  M.transformPoint=(m,p,w=1)=>{
    const x=p[0],y=p[1],z=p[2]||0;
    return [m[0]*x+m[4]*y+m[8]*z+m[12]*w, m[1]*x+m[5]*y+m[9]*z+m[13]*w,
      m[2]*x+m[6]*y+m[10]*z+m[14]*w, m[3]*x+m[7]*y+m[11]*z+m[15]*w];
  };
  M.transformDir=(m,p)=>{
    const x=p[0],y=p[1],z=p[2]||0;
    return [m[0]*x+m[4]*y+m[8]*z, m[1]*x+m[5]*y+m[9]*z, m[2]*x+m[6]*y+m[10]*z];
  };

  /* ---------- 颜色 ---------- */
  U.hex2rgb=(h)=>{
    h=h.replace('#',''); if(h.length===3)h=h.split('').map(c=>c+c).join('');
    const n=parseInt(h,16); return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
  };
  U.rgb2hex=(r,g,b)=>'#'+[r,g,b].map(v=>('0'+Math.round(U.clamp(v,0,1)*255).toString(16)).slice(-2)).join('');
  U.hsv2rgb=(h,s,v)=>{
    const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);
    const r=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return r;
  };
  U.mixColor=(a,b,t)=>[U.lerp(a[0],b[0],t),U.lerp(a[1],b[1],t),U.lerp(a[2],b[2],t)];

  /* ---------- 时间码 / 时间 ---------- */
  U.timecode=(frames,fps)=>{
    const f=Math.max(0,Math.round(frames));
    const ff=f%fps, s=Math.floor(f/fps)%60, m=Math.floor(f/(fps*60))%60, h=Math.floor(f/(fps*3600));
    const p2=n=>('0'+n).slice(-2);
    return p2(h)+':'+p2(m)+':'+p2(s)+':'+p2(ff);
  };
  U.timeStr=(t)=>{const m=Math.floor(t/60),s=t-m*60;return m+':'+('0'+s.toFixed(2)).slice(-5);};

  /* ---------- 缓动（三次贝塞尔，含缓入缓出） ---------- */
  U.bezierEase=(p1x,p1y,p2x,p2y)=>{
    // 给定 x 求 t，再求 y
    const cx=3*p1x,bx=3*(p2x-p1x)-cx,ax=1-cx-bx;
    const cy=3*p1y,by=3*(p2y-p1y)-cy,ay=1-cy-by;
    const sx=t=>((ax*t+bx)*t+cx)*t, sy=t=>((ay*t+by)*t+cy)*t;
    const dx=t=>(3*ax*t+2*bx)*t+cx;
    return (x)=>{
      x=U.clamp(x,0,1);let t=x;
      for(let i=0;i<6;i++){const e=sx(t)-x,d=dx(t);if(Math.abs(d)<1e-6)break;t-=e/d;}
      t=U.clamp(t,0,1);return sy(t);
    };
  };
  U.easeIn=U.bezierEase(.42,0,1,1);
  U.easeOut=U.bezierEase(0,0,.58,1);
  U.easeInOut=U.bezierEase(.42,0,.58,1);
  U.EASINGS={linear:x=>x, easeIn:U.easeIn, easeOut:U.easeOut, easeInOut:U.easeInOut};

  /* ---------- 其它 ---------- */
  let _id=0;
  U.uid=(p='id')=>p+'_'+(++_id).toString(36)+'_'+Math.floor(Math.random()*1e5).toString(36);
  U.clone=(o)=> o===undefined?undefined:JSON.parse(JSON.stringify(o));
  U.debounce=(fn,ms)=>{let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
  U.fmt=(v,n=2)=> (typeof v==='number'? v.toFixed(n): String(v));
  U.arr=(v,n)=>{ if(Array.isArray(v))return v.slice(); if(typeof v==='number')return new Array(n).fill(v); return new Array(n).fill(0); };

  /* 值类型判定 */
  U.isNum=v=>typeof v==='number'&&isFinite(v);
  U.dim=v=>Array.isArray(v)?v.length:1;
  U.ensureVec=(v,n)=>{ if(Array.isArray(v))return v.slice(); if(typeof v==='number')return new Array(n).fill(v); return new Array(n).fill(0); };

  console.log('[forge] util ready');
})();
