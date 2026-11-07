/* =========================================================================
   core.js — math, data model, keyframe & expression evaluation, history
   Classic script. Attaches everything to global AE.
   ========================================================================= */
window.AE = window.AE || {};
(function(AE){
'use strict';

/* ---------------------------------------------------------------- misc */
let _idc = 1000;
AE.uid = (p)=> (p||'id') + '_' + (++_idc).toString(36) + Math.floor(Math.random()*1296).toString(36);
AE.clone = (o)=> o===undefined?undefined:JSON.parse(JSON.stringify(o));
AE.clamp = (v,a,b)=> v<a?a:(v>b?b:v);
AE.lerp = (a,b,u)=> a+(b-a)*u;
AE.mix = AE.lerp;
AE.smoothstep=(e0,e1,x)=>{const t=AE.clamp((x-e0)/(e1-e0||1e-9),0,1);return t*t*(3-2*t);};
AE.TAU = Math.PI*2;
AE.rad = (d)=> d*Math.PI/180;
AE.deg = (r)=> r*180/Math.PI;
AE.num = (v,d)=> (typeof v==='number'&&isFinite(v))?v:(d||0);
AE.arr = (v)=> Array.isArray(v)?v.slice():[v];
AE.fmt=(v,n)=>{v=AE.num(v);return (v>=0?'':'−')+Math.abs(v).toFixed(n===undefined?2:n);};

/* colors: [r,g,b,a] 0..1 ; helpers */
AE.rgba=(r,g,b,a)=>[r,g,b,a===undefined?1:a];
AE.hex=(h,a)=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');
  return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255,a===undefined?1:a];};
AE.css=(c)=> 'rgba('+Math.round(AE.clamp(c[0],0,1)*255)+','+Math.round(AE.clamp(c[1],0,1)*255)+','+Math.round(AE.clamp(c[2],0,1)*255)+','+AE.clamp(c[3]===undefined?1:c[3],0,1)+')';
AE.mixC=(a,b,u)=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u,(a[3]===undefined?1:a[3])+((b[3]===undefined?1:b[3])-(a[3]===undefined?1:a[3]))*u];
AE.scaleC=(c,s)=>[c[0]*s,c[1]*s,c[2]*s,c[3]===undefined?1:c[3]];

/* ---------------------------------------------------------------- seeded random / noise */
function hash1(n){ // deterministic 0..1
  let x = Math.sin(n*127.1 + 311.7)*43758.5453123;
  return x - Math.floor(x);
}
AE.hash1 = hash1;
AE.hashStr=(s)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0)/4294967295;};
AE.noise1=(t,seed)=>{ // smooth value noise, deterministic
  const i=Math.floor(t), f=t-i;
  const a=hash1(i*57.13 + (seed||0)*13.7), b=hash1((i+1)*57.13 + (seed||0)*13.7);
  const u=f*f*(3-2*f);
  return a+(b-a)*u;
};
AE.fbm=(t,seed,oct)=>{let s=0,a=.5,f=1;for(let i=0;i<(oct||3);i++){s+=a*AE.noise1(t*f,seed+i*17);f*=2;a*=.5;}return s;};

/* ---------------------------------------------------------------- vec / mat (column-major, WebGL style) */
const V={
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+(a[2]||0)+(b[2]||0)],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]+(a[2]||0)-(b[2]||0)],
  scale:(a,s)=>[a[0]*s,a[1]*s,(a[2]||0)*s],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+(a[2]||0)*(b[2]||0),
  cross:(a,b)=>[a[1]*(b[2]||0)-(a[2]||0)*b[1],(a[2]||0)*b[0]-a[0]*(b[2]||0),a[0]*b[1]-a[1]*b[0]],
  len:(a)=>Math.hypot(a[0],a[1],a[2]||0),
  norm:(a)=>{const l=V.len(a)||1;return [a[0]/l,a[1]/l,(a[2]||0)/l];},
  lerp:(a,b,u)=>[AE.lerp(a[0],b[0],u),AE.lerp(a[1],b[1],u),AE.lerp(a[2]||0,b[2]||0,u)]
};
AE.V=V;

const M={
  ident:()=>[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
  mul:(a,b)=>{const o=new Array(16);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++){
      o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
    }return o;},
  translate:(x,y,z)=>{const m=M.ident();m[12]=x;m[13]=y;m[14]=z||0;return m;},
  scale:(x,y,z)=>{const m=M.ident();m[0]=x;m[5]=y;m[10]=z===undefined?1:z;return m;},
  rotX:(a)=>{const m=M.ident(),c=Math.cos(a),s=Math.sin(a);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;},
  rotY:(a)=>{const m=M.ident(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;},
  rotZ:(a)=>{const m=M.ident(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m;},
  xform:(m,p)=>{const x=p[0],y=p[1],z=p[2]||0,w=p[3]===undefined?1:p[3];
    return [m[0]*x+m[4]*y+m[8]*z+m[12]*w, m[1]*x+m[5]*y+m[9]*z+m[13]*w, m[2]*x+m[6]*y+m[10]*z+m[14]*w];},
  perspective:(fovy,aspect,near,far)=>{const f=1/Math.tan(fovy/2),nf=1/(near-far);
    return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];},
  lookAt:(eye,center,up)=>{
    const z=V.norm(V.sub(eye,center));           // camera looks down -z
    let x=V.cross(up,z); const xl=V.len(x); x= xl<1e-6?[1,0,0]:[x[0]/xl,x[1]/xl,x[2]/xl];
    const y=V.cross(z,x);
    return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1];
  },
  inv:(m)=>{ // general 4x4 inverse (for fromWorld)
    const inv=new Array(16), a=m;
    inv[0]=a[5]*a[10]*a[15]-a[5]*a[11]*a[14]-a[9]*a[6]*a[15]+a[9]*a[7]*a[14]+a[13]*a[6]*a[11]-a[13]*a[7]*a[10];
    inv[4]=-a[4]*a[10]*a[15]+a[4]*a[11]*a[14]+a[8]*a[6]*a[15]-a[8]*a[7]*a[14]-a[12]*a[6]*a[11]+a[12]*a[7]*a[10];
    inv[8]=a[4]*a[9]*a[15]-a[4]*a[11]*a[13]-a[8]*a[5]*a[15]+a[8]*a[7]*a[13]+a[12]*a[5]*a[11]-a[12]*a[7]*a[9];
    inv[12]=-a[4]*a[9]*a[14]+a[4]*a[10]*a[13]+a[8]*a[5]*a[14]-a[8]*a[6]*a[13]-a[12]*a[5]*a[10]+a[12]*a[6]*a[9];
    inv[1]=-a[1]*a[10]*a[15]+a[1]*a[11]*a[14]+a[9]*a[2]*a[15]-a[9]*a[3]*a[14]-a[13]*a[2]*a[11]+a[13]*a[3]*a[10];
    inv[5]=a[0]*a[10]*a[15]-a[0]*a[11]*a[14]-a[8]*a[2]*a[15]+a[8]*a[3]*a[14]+a[12]*a[2]*a[11]-a[12]*a[3]*a[10];
    inv[9]=-a[0]*a[9]*a[15]+a[0]*a[11]*a[13]+a[8]*a[1]*a[15]-a[8]*a[3]*a[13]-a[12]*a[1]*a[11]+a[12]*a[3]*a[9];
    inv[13]=a[0]*a[9]*a[14]-a[0]*a[10]*a[13]-a[8]*a[1]*a[14]+a[8]*a[2]*a[13]+a[12]*a[1]*a[10]-a[12]*a[2]*a[9];
    inv[2]=a[1]*a[6]*a[15]-a[1]*a[7]*a[14]-a[5]*a[2]*a[15]+a[5]*a[3]*a[14]+a[9]*a[2]*a[7]-a[9]*a[3]*a[6];
    inv[6]=-a[0]*a[6]*a[15]+a[0]*a[7]*a[14]+a[4]*a[2]*a[15]-a[4]*a[3]*a[14]-a[8]*a[2]*a[7]+a[8]*a[3]*a[6];
    inv[10]=a[0]*a[5]*a[15]-a[0]*a[7]*a[13]-a[4]*a[1]*a[15]+a[4]*a[3]*a[13]+a[8]*a[1]*a[7]-a[8]*a[3]*a[5];
    inv[14]=-a[0]*a[5]*a[14]+a[0]*a[6]*a[13]+a[4]*a[1]*a[14]-a[4]*a[2]*a[13]-a[8]*a[1]*a[6]+a[8]*a[2]*a[5];
    inv[3]=-a[1]*a[6]*a[11]+a[1]*a[7]*a[10]+a[5]*a[2]*a[11]-a[5]*a[3]*a[10]-a[9]*a[2]*a[7]+a[9]*a[3]*a[6];
    inv[7]=a[0]*a[6]*a[11]-a[0]*a[7]*a[10]-a[4]*a[2]*a[11]+a[4]*a[3]*a[10]+a[8]*a[2]*a[7]-a[8]*a[3]*a[6];
    inv[11]=-a[0]*a[5]*a[11]+a[0]*a[7]*a[9]+a[4]*a[1]*a[11]-a[4]*a[3]*a[9]-a[8]*a[1]*a[7]+a[8]*a[3]*a[5];
    inv[15]=a[0]*a[5]*a[10]-a[0]*a[6]*a[9]-a[4]*a[1]*a[10]+a[4]*a[2]*a[9]+a[8]*a[1]*a[6]-a[8]*a[2]*a[5];
    let det=a[0]*inv[0]+a[1]*inv[4]+a[2]*inv[8]+a[3]*inv[12];
    if(Math.abs(det)<1e-12) return M.ident();
    det=1/det; for(let i=0;i<16;i++)inv[i]*=det; return inv;
  }
};
AE.M=M;

/* ---------------------------------------------------------------- easing / bezier */
AE.EASE={
  none:   null,
  linear: null,
  hold:   'hold',
  ease:   [0.42,0,0.58,1],       // zero velocity both ends (F9)
  easeIn: [0.55,0.055,0.675,0.19],
  easeOut:[0.215,0.61,0.355,1],
  bezier: 'custom'
};
function cubicSolve(x1,y1,x2,y2,x){ // solve bezier param for given x, return y
  const A=(a,b)=>1-3*b+3*a, B=(a,b)=>3*b-6*a, C=(a)=>3*a;
  const calc=(t,a,b)=>((A(a,b)*t+B(a,b))*t+C(a))*t;
  const slope=(t,a,b)=>3*A(a,b)*t*t+2*B(a,b)*t+C(a);
  let t=x;
  for(let i=0;i<8;i++){const s=slope(t,x1,x2);if(Math.abs(s)<1e-6)break;const e=calc(t,x1,x2)-x;t-=e/s;}
  t=AE.clamp(t,0,1);
  return calc(t,y1,y2);
}
AE.cubicSolve=cubicSolve;
AE.easeValue=(u,preset,custom)=>{
  if(preset==='hold') return 0;
  if(!preset||preset==='linear'||preset==='none') return u;
  let c = preset==='custom' ? custom : AE.EASE[preset];
  if(!c||c==='custom'||c==='hold') return u;
  return cubicSolve(c[0],c[1],c[2],c[3],u);
};

/* ---------------------------------------------------------------- property model
   Prop = { n: default value, k: [Key]|null, e: exprString|null, em:'replace'|'add',
            spatial:bool, id }
   Key  = { t, v, eout:'linear'|'bezier'|'hold'|'ease'.., ein, ease, ho:[x,y], hi:[x,y] (normalized),
            sh:{in:[..],out:[..]} spatial handles }
*/
AE.makeProp=(v,opts)=>Object.assign({n:v,k:null,e:null,em:'replace',spatial:false},opts||{});
AE.propKeys=(p)=> p&&p.k?p.k:[];
AE.isAnimated=(p)=> !!(p && p.k && p.k.length);
AE.hasExpr=(p)=> !!(p && p.e);

/* spatial bezier between two position keyframes, constant-speed along arc length */
function spatialPoint(ka,kb,u){
  const p0=ka.v, p3=kb.v;
  const o=ka.sh&&ka.sh.out, i=kb.sh&&kb.sh.in;
  if(!o&&!i) return [AE.lerp(p0[0],p3[0],u),AE.lerp(p0[1],p3[1],u)];
  // control points in absolute space (handles are offsets from the key point)
  const p1=[p0[0]+(o?o[0]:(p3[0]-p0[0])/3), p0[1]+(o?o[1]:(p3[1]-p0[1])/3)];
  const p2=[p3[0]+(i?i[0]:-(p3[0]-p0[0])/3), p3[1]+(i?i[1]:-(p3[1]-p0[1])/3)];
  const bez=(t)=>{const mt=1-t;return [mt*mt*mt*p0[0]+3*mt*mt*t*p1[0]+3*mt*t*t*p2[0]+t*t*t*p3[0],
                                        mt*mt*mt*p0[1]+3*mt*mt*t*p1[1]+3*mt*t*t*p2[1]+t*t*t*p3[1]];};
  // arc length LUT
  const N=24; let lens=[0],prev=bez(0),total=0;
  for(let s=1;s<=N;s++){const q=bez(s/N);total+=Math.hypot(q[0]-prev[0],q[1]-prev[1]);lens.push(total);prev=q;}
  if(total<1e-6) return bez(u);
  const target=u*total; let seg=1;
  while(seg<N && lens[seg]<target) seg++;
  const l0=lens[seg-1],l1=lens[seg];const f=(target-l0)/((l1-l0)||1);
  return bez((seg-1+f)/N);
}
AE.spatialPoint=spatialPoint;

function lerpVal(a,b,u){
  if(typeof a==='number') return AE.lerp(a,b,u);
  if(Array.isArray(a)){const o=[];for(let i=0;i<a.length;i++)o.push(AE.lerp(a[i],b&&b[i]!==undefined?b[i]:a[i],u));return o;}
  return u<0.5?a:b;
}
AE.lerpVal=lerpVal;

/* evaluate keyframes only (no expression) */
AE.evalKeys=(p,t)=>{
  if(!p) return 0;
  const ks=p.k;
  if(!ks||!ks.length) return p.n;
  if(t<=ks[0].t) return ks[0].v;
  if(t>=ks[ks.length-1].t) return ks[ks.length-1].v;
  let i=0;while(i<ks.length-1 && ks[i+1].t<t) i++;
  const a=ks[i],b=ks[i+1];
  const span=(b.t-a.t)||1e-9;
  const raw=(t-a.t)/span;
  const eo=a.eout||'linear';
  if(eo==='hold') return a.v;
  let uu=raw;
  if(eo==='bezier'){
    if(a.ho){
      const x1=AE.clamp(a.ho[0],0,1), y1=a.ho[1];
      const x2=AE.clamp(1+(b.hi?b.hi[0]:-0.42),0,1), y2=1+(b.hi?b.hi[1]:0);
      uu=cubicSolve(x1,y1,x2,y2,raw);
    } else uu=AE.easeValue(raw,a.ease||'ease');
  } else if(eo!=='linear'&&eo!=='none'){
    uu=AE.easeValue(raw,eo);
  }
  if(p.spatial && Array.isArray(a.v)) return spatialPoint(a,b,uu); // arc-length parameter follows eased time
  return lerpVal(a.v,b.v,uu);
};

/* speed (derivative) — used by the speed curve */
AE.evalSpeed=(p,t)=>{
  const h=1/(AE.state?AE.state.fps:30);
  const a=AE.evalKeys(p,t-h), b=AE.evalKeys(p,t+h);
  if(typeof a==='number') return (b-a)/(2*h);
  if(Array.isArray(a)){let s=0;for(let i=0;i<a.length;i++)s+=(b[i]-a[i])*(b[i]-a[i]);return Math.sqrt(s)/(2*h);}
  return 0;
};

/* ---------------------------------------------------------------- expression engine */
/* Build a rich evaluation context. `ref` gives live access to other layers/props. */
AE.buildExprContext=(project,comp,layer,t,base,prop)=>{
  const fps=comp.fps||30;
  const seedBase=(project.seed||7)*1.37 + AE.hashStr(layer?layer.id:'g')*97 + AE.hashStr((prop&&prop.id)||'p')*53;

  const propVal=(C,L,name,tt)=>{
    const map={position:'position',pos:'position',rotation:'rotation',rot:'rotation',scale:'scale',
      opacity:'opacity',anchorPoint:'anchor',anchor:'anchor',xRotation:'xRot',yRotation:'yRot',zRotation:'zRot',
      zPosition:'zPos'};
    const key=map[name]||name;
    const p=L.props&&L.props[key];
    if(!p) return 0;
    return AE.evalPropAt(p,tt===undefined?t:tt,project,C,L,{});
  };
  const makeVec=(a,getter)=>{
    const v=a.slice();
    Object.defineProperty(v,'valueAtTime',{enumerable:false,value:(tt)=>getter(tt)});
    Object.defineProperty(v,'speed',{enumerable:false,get:()=>0});
    return v;
  };
  const makeLayerRef=(C,nm,tt)=>{
    let L=null;
    if(typeof nm==='number') L=C.layers[nm-1];
    else L=C.layers.find(x=>x.name===nm)||C.layers.find(x=>x.id===nm);
    if(!L) return {transform:new Proxy({},{get:()=>0}),index:0,name:nm+' (未找到)',toWorld:p=>p,fromWorld:p=>p};
    const transform=new Proxy({},{
      get:(_,name)=>{
        if(name==='valueAtTime') return (t2)=>transform;
        if(name==='then'||name==='toJSON'||typeof name==='symbol') return undefined;
        const val=propVal(C,L,name,tt);
        if(Array.isArray(val)) return makeVec(val,(t2)=>propVal(C,L,name,t2));
        const box=new Number(val);
        Object.defineProperty(box,'valueAtTime',{enumerable:false,value:(t2)=>propVal(C,L,name,t2)});
        return box;
      }
    });
    return {
      transform,
      effect:(en)=>({param:(pn)=>{const fx=(L.effects||[]).find(e=>e.name===en||e.type===en);return fx&&fx.params?fx.params[pn]:0;}}),
      index:C.layers.indexOf(L)+1, name:L.name,
      toWorld:(pt)=>exprWorld(project,C,L,pt,tt,false),
      fromWorld:(pt)=>exprWorld(project,C,L,pt,tt,true),
      _layer:L
    };
  };
  const layerRef=(nm)=>makeLayerRef(comp,nm,t);
  const compRef=(nm)=>{
    const C=project.comps.find(c=>c.name===nm)||comp;
    return {layer:(n)=>makeLayerRef(C,n,t),name:C.name,width:C.W,height:C.H,
            duration:C.duration,fps:C.fps,numLayers:C.layers.length};
  };
  const thisComp=compRef(comp.name);

  const ctx={
    time:t, value:base, thisComp, thisLayer:layerRef(layer?layer.name:''),
    comp:compRef, layer:(n)=>layerRef(n),
    wiggle:(f,a,oct)=>{
      f=f||1;a=a===undefined?10:a;
      const ph=seedBase;
      const x=(AE.fbm(t*f, ph, (oct||3))*2-1)*a;
      const y=(AE.fbm(t*f, ph+41.3, (oct||3))*2-1)*a;
      return [x,y];
    },
    noise:(tt)=>AE.noise1((tt===undefined?t:tt)*2+seedBase,seedBase),
    random:(s)=>hash1(seedBase+(s||0)+Math.floor(t*1000)*0.0001),
    seedRandom:(s,on)=>hash1((s||1)*91.7+seedBase),
    loopOut:(type)=>{
      const ks=prop&&prop.k;if(!ks||ks.length<2)return base;
      const dur=ks[ks.length-1].t-ks[0].t, n=Math.max(0,Math.floor((t-ks[ks.length-1].t)/dur));
      let lt=t-(n+1)*dur;
      if(type==='pingpong' && (n+1)%2===1) lt=ks[0].t+(dur-(lt-ks[0].t));
      return AE.evalKeys(prop,AE.clamp(lt,ks[0].t,ks[ks.length-1].t));
    },
    loopIn:(type)=>{const ks=prop&&prop.k;if(!ks||ks.length<2)return base;
      const dur=ks[ks.length-1].t-ks[0].t,n=Math.max(0,Math.floor((ks[0].t-t)/dur));return AE.evalKeys(prop,t+(n+1)*dur);},
    linear:(tt,a,b,c,d)=>{if(tt<=a)return c;if(tt>=b)return d;return AE.lerp(c,d,(tt-a)/(b-a));},
    ease:(tt,a,b,c,d)=>{const u=AE.clamp((tt-a)/(b-a),0,1);return AE.lerp(c,d,AE.easeValue(u,'ease'));},
    easeIn:(tt,a,b,c,d)=>{const u=AE.clamp((tt-a)/(b-a),0,1);return AE.lerp(c,d,AE.easeValue(u,'easeIn'));},
    easeOut:(tt,a,b,c,d)=>{const u=AE.clamp((tt-a)/(b-a),0,1);return AE.lerp(c,d,AE.easeValue(u,'easeOut'));},
    valueAtTime:(tt)=>{return AE.evalKeys(prop,tt);},
    toWorld:(pt)=>exprWorld(project,comp,layer,pt,t,false),
    fromWorld:(pt)=>exprWorld(project,comp,layer,pt,t,true),
    clamp:(v,a,b)=>AE.clamp(v,a,b), lerp:(a,b,u)=>AE.lerp(a,b,u),
    radians:(d)=>AE.rad(d), degrees:(r)=>AE.deg(r),
    add:(a,b)=>Array.isArray(a)?a.map((x,i)=>x+(Array.isArray(b)?b[i]:b)):a+b,
    sub:(a,b)=>Array.isArray(a)?a.map((x,i)=>x-(Array.isArray(b)?b[i]:b)):a-b,
    mul:(a,b)=>Array.isArray(a)?a.map(x=>x*b):a*b,
    div:(a,b)=>Array.isArray(a)?a.map(x=>x/b):a/b,
    length:(a)=>Array.isArray(a)?V.len(a):Math.abs(a),
    normalize:(a)=>Array.isArray(a)?V.norm(a):(a>=0?1:-1),
    vec:(x,y,z)=>[x,y,z===undefined?0:z],
    posterizeTime:(n)=>0,
    framesToTime:(f)=>f/fps, timeToFrames:(tt)=>tt*fps,
    index:layer?comp.layers.indexOf(layer)+1:1,
    width:comp.W,height:comp.H,duration:comp.duration,fps:fps,
    PI:Math.PI, TAU:AE.TAU, Math:Math,
    sin:Math.sin,cos:Math.cos,tan:Math.tan,abs:Math.abs,floor:Math.floor,ceil:Math.ceil,
    pow:Math.pow,sqrt:Math.sqrt,min:Math.min,max:Math.max,exp:Math.exp,log:Math.log
  };
  ctx.thisProperty={value:base,valueAtTime:(tt)=>AE.evalKeys(prop,tt),speed:AE.evalSpeed(prop,t),velocity:0,name:''};
  return ctx;
};

function exprWorld(project,comp,layer,pt,t,inv){
  if(!layer) return pt;
  let m=AE.layerWorldMatrix(project,comp,layer,t);
  if(inv) m=M.inv(m);
  return M.xform(m,[pt[0]||0,pt[1]||0,pt[2]||0]);
}

/* cycle / error guard for expression dependency chains */
const _exprStack=[];
function addVal(base,val){
  if(typeof base==='number'&&typeof val==='number') return base+val;
  if(Array.isArray(base)) return base.map((x,i)=>x+(Array.isArray(val)?(val[i]||0):(typeof val==='number'?val:0)));
  return val;
}
AE.evalPropAt=(p,t,project,comp,layer,opt)=>{
  opt=opt||{};
  let base=AE.evalKeys(p,t);
  if(!p.e || opt.noExpr) return base;
  const tag=(layer?layer.id:'?')+'|'+(p.id||Object.keys(layer&&layer.props||{}).find(k=>layer.props[k]===p)||'');
  if(_exprStack.indexOf(tag)>=0){
    if(AE.state&&AE.state.exprErrors)AE.state.exprErrors.set((layer?layer.name:'?'),'表达式循环引用：'+tag.split('|')[1]);
    return base; // fall back to keyframe value with clear message
  }
  _exprStack.push(tag);
  try{
    const ctx=AE.buildExprContext(project,comp,layer,t,base,p);
    let body=String(p.e).trim();
    if(!/\breturn\b/.test(body) && !/[;\n]/.test(body)) body='return ('+body+');';
    const names=Object.keys(ctx);
    const fn=new Function(...names,'"use strict";\n'+body);
    const r=fn(...names.map(n=>ctx[n]));
    if(r===undefined) return base;
    const val=(r&&typeof r==='object'&&r.valueOf)?r.valueOf():r;
    if(AE.state&&AE.state.exprErrors)AE.state.exprErrors.delete((layer?layer.name:'?'));
    return p.em==='add' ? addVal(base,val) : val;
  }catch(err){
    if(AE.state&&AE.state.exprErrors)AE.state.exprErrors.set((layer?layer.name:'?')+'.expr',String(err&&err.message||err));
    return base;
  }finally{_exprStack.pop();}
};

/* convenience for evaluation within a project */
AE.evalProp=(layer,key,t,project,comp)=>{
  const p=layer.props&&layer.props[key];
  if(!p) return 0;
  return AE.evalPropAt(p,t,project,comp,layer,{});
};

/* world matrix for a layer (parent chain), used by toWorld/fromWorld + canvas manip */
AE.layerLocalMatrix=(layer,t,project,comp)=>{
  const g=(k,d)=>AE.evalProp(layer,k,t,project,comp);
  const a=g('anchor',[0,0,0]), p=g('position',[0,0,0]), s=g('scale',[100,100,100]),
        r=g('rotation',0), xr=g('xRot',0),yr=g('yRot',0),zr=g('zRot',0);
  const av=Array.isArray(a)?a:[0,0], pv=Array.isArray(p)?p:[0,0], sv=Array.isArray(s)?s:[100,100,100];
  const zpos=pv[2]||0, az=av[2]||0;
  let m=M.translate(pv[0],pv[1],zpos);
  m=M.mul(m,M.rotZ(AE.rad(r)));
  if(layer.threeD){m=M.mul(m,M.rotY(AE.rad(yr)));m=M.mul(m,M.rotX(AE.rad(xr)));m=M.mul(m,M.rotZ(AE.rad(zr)));}
  m=M.mul(m,M.scale(sv[0]/100,sv[1]/100,(sv[2]||100)/100));
  m=M.mul(m,M.translate(-av[0],-av[1],-az));
  return m;
};
AE.layerWorldMatrix=(project,comp,layer,t,depth)=>{
  depth=depth||0; if(depth>8||!layer) return M.ident();
  const local=AE.layerLocalMatrix(layer,t,project,comp);
  const parent=comp.layers.find(l=>l.id===layer.parentId);
  let pm = parent ? AE.layerWorldMatrix(project,comp,parent,AE.parentTime(project,comp,parent,layer,t),depth+1) : M.ident();
  // 2D child of 3D parent: strip depth (project to plane) — approximate by zeroing z row/col
  if(!layer.threeD && parent && parent.threeD){
    pm=pm.slice();
    pm[2]=0;pm[6]=0;pm[8]=0;pm[9]=0;pm[10]=1;pm[14]=0; // flatten parent depth for a 2D child
  }
  return M.mul(pm,local);
};
AE.parentTime=(project,comp,parent,layer,t)=> t; // precomp time remap handled in engine

/* ---------------------------------------------------------------- keyframe helpers */
AE.keyAt=(p,t,eps)=>{eps=eps||0.0005;if(!p||!p.k)return -1;for(let i=0;i<p.k.length;i++)if(Math.abs(p.k[i].t-t)<eps)return i;return -1;};
AE.setKey=(p,t,v,opt)=>{
  opt=opt||{};
  if(!p.k)p.k=[];
  const i=AE.keyAt(p,t);
  const key={t:t,v:AE.clone(v),eout:opt.eout||'bezier',ein:opt.ein||'bezier',ease:opt.ease||'ease',
             ho:opt.ho||[0.42,0],hi:opt.hi||[-0.42,0]};
  if(i>=0)p.k[i]=Object.assign(p.k[i],key); else {p.k.push(key);p.k.sort((a,b)=>a.t-b.t);}
  return p;
};
AE.newPropKey=(v)=>({t:0,v:v,eout:'bezier',ein:'bezier',ease:'ease',ho:[0.42,0],hi:[-0.42,0]});

/* ---------------------------------------------------------------- project / layer factory */
AE.newComp=(o)=>Object.assign({
  id:AE.uid('comp'),name:'合成 1',W:1600,H:900,fps:30,duration:15,
  bg:[0.043,0.055,0.075,1],workIn:0,workOut:15,
  markers:[],layers:[],_open:true
},o||{});
AE.newLayer=(type,name,o)=>{
  const L=Object.assign({
    id:AE.uid('lyr'),name:name||('图层 '+(type||'')),type:type||'shape',
    enabled:true,locked:false,solo:false,blend:'normal',parentId:null,
    inPoint:0,outPoint:15,threeD:false,motionBlur:false,
    matte:{mode:'none',sourceId:null},
    masks:[],effects:[],_open:false,_sel:false,
    props:{},
    color:'#4fd1c5'
  },o||{});
  const P=L.props;
  P.anchor=AE.makeProp([0,0,0]);
  P.position=AE.makeProp([0,0,0],{spatial:true});
  P.scale=AE.makeProp([100,100,100]);
  P.rotation=AE.makeProp(0);
  P.xRot=AE.makeProp(0);P.yRot=AE.makeProp(0);P.zRot=AE.makeProp(0);
  P.opacity=AE.makeProp(100);
  P.zPos=AE.makeProp(0);
  return L;
};
AE.newProject=(o)=>Object.assign({
  id:AE.uid('proj'),name:'未命名工程',seed:7,
  comps:[],activeCompId:null,
  assets:{fonts:['思源黑体 / Noto Sans CJK SC','等线 / DengXian','Arial'],audio:[]},
},o||{});

AE.findLayer=(comp,id)=>comp.layers.find(l=>l.id===id);
AE.activeComp=(project)=>project.comps.find(c=>c.id===project.activeCompId)||project.comps[0];

/* ---------------------------------------------------------------- history (undo/redo) */
AE.History=class{
  constructor(getState,applyState){this.get=getState;this.apply=applyState;this.stack=[];this.pos=-1;this.locked=false;this.onChange=null;}
  push(label){if(this.locked)return;const s=this.get();this.stack=this.stack.slice(0,this.pos+1);this.stack.push(s);if(this.stack.length>120)this.stack.shift();this.pos=this.stack.length-1;if(this.onChange)this.onChange();}
  undo(){if(this.pos<=0)return false;this.pos--;this.apply(this.stack[this.pos]);if(this.onChange)this.onChange();return true;}
  redo(){if(this.pos>=this.stack.length-1)return false;this.pos++;this.apply(this.stack[this.pos]);if(this.onChange)this.onChange();return true;}
  reset(s){this.stack=[s];this.pos=0;if(this.onChange)this.onChange();}
  get canUndo(){return this.pos>0;} get canRedo(){return this.pos<this.stack.length-1;}
};

/* global runtime state (not part of project / not serialized into history) */
AE.state={
  t:0, fps:30, playing:false, loop:true, audioOn:true, motionBlur:true, snap:true,
  selection:[], activeCompId:null, zoom:1, panX:0, panY:0,
  tool:'select', bottomWS:'timeline', rightTab:'props',
  tlZoom:60, tlScroll:0, showAnimatedOnly:false,
  view:'persp', grid:true, overlay:true, motionPath:true,
  exprErrors:new Map(), exportMode:false,
  curveSel:new Set(), nodeSel:null, kfClipboard:null,
  cameraOverride:null, audioCtx:null, masterGain:null
};

/* ---------------------------------------------------------------- serialization */
AE.serialize=(project)=>JSON.stringify(project);
AE.deserialize=(s)=>{const p=JSON.parse(s);
  // restore transient refs
  (p.comps||[]).forEach(c=>(c.layers||[]).forEach(l=>{l._sel=false;}));
  return p;};

})(window.AE);
