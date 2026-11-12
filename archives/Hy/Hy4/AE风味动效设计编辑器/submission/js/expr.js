/* ============================================================
   expr.js — 表达式求值引擎
   支持: time / value / wiggle / loopOut / loopIn / linear / ease /
        图层与跨合成属性引用 / 向量分量 / valueAtTime 等
   依赖求值 + 循环检测在 model.js 中完成；本文件负责编译和运行上下文
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE, U=AE.util;
  const E=AE.expr={};

  /* 带分量访问的向量（本质是数组，可直接用 [0] / .x 等） */
  class Vec extends Array{
    get x(){return this[0]||0;} set x(v){this[0]=v;}
    get y(){return this[1]||0;} set y(v){this[1]=v;}
    get z(){return this[2]||0;} set z(v){this[2]=v;}
    get w(){return this[3]||0;} set w(v){this[3]=v;}
    get r(){return this[0]||0;} get g(){return this[1]||0;} get b(){return this[2]||0;}
  }
  E.Vec=Vec;
  E.vec=(v)=>{
    if(v instanceof Vec)return v;
    const o=new Vec();
    if(Array.isArray(v))for(let i=0;i<v.length;i++)o.push(v[i]);
    else if(typeof v==='number')o.push(v);
    return o;
  };
  E.isVec=v=>v instanceof Vec || Array.isArray(v);

  /* 属性引用：惰性求值，暴露分量 / valueAtTime / velocityAtTime / speed */
  class PropertyRef{
    constructor(getter,dim,t){
      this._getter=getter;this.dim=dim;this._time=t;
      const v=E.vec(getter(t));this._cur=v;
      for(let i=0;i<v.length;i++)this[i]=v[i];
      this.length=dim;
    }
    get value(){return this.dim===1?this._cur[0]:this._cur;}
    get x(){return this._cur[0]||0;} get y(){return this._cur[1]||0;}
    get z(){return this._cur[2]||0;} get w(){return this._cur[3]||0;}
    valueAtTime(t){return E.vec(this._getter(t));}
    velocityAtTime(t){
      const h=1/240,a=E.vec(this._getter(t-h)),b=E.vec(this._getter(t+h));
      const o=new Vec();for(let i=0;i<a.length;i++)o.push((b[i]-a[i])/(2*h));return o;
    }
    get speed(){const v=this.velocityAtTime(this._time);return Math.hypot.apply(null,v);}
    valueOf(){return this.dim===1?this._cur[0]:this._cur;}
    toString(){return String(this.value);}
  }
  E.PropertyRef=PropertyRef;

  /* ---------- 函数库 ---------- */
  function arr(v){return E.vec(v);}
  function dimOf(v){return Array.isArray(v)?v.length:1;}
  function componentwise(a,b,fn){
    if(Array.isArray(a)||Array.isArray(b)){
      const A=E.vec(a),B=E.vec(b),n=Math.max(A.length,B.length),o=new Vec();
      for(let i=0;i<n;i++)o.push(fn(A[i]||0,B[i]||0));return o;
    }
    return fn(+a,+b);
  }
  E.add=(a,b)=>componentwise(a,b,(x,y)=>x+y);
  E.sub=(a,b)=>componentwise(a,b,(x,y)=>x-y);
  E.mul=(a,b)=>componentwise(a,b,(x,y)=>x*y);
  E.div=(a,b)=>componentwise(a,b,(x,y)=>x/(y||1e-9));
  E.mod=(a,b)=>componentwise(a,b,(x,y)=>x%y);
  E.clamp=(v,a,b)=>componentwise(v,0,(x)=>U.clamp(x,a,b));
  E.length=(v)=>{const A=E.vec(v);return Math.hypot.apply(null,A);};
  E.normalize=(v)=>{const A=E.vec(v),l=Math.hypot.apply(null,A)||1;return E.vec(A.map(x=>x/l));};
  E.dot=(a,b)=>{const A=E.vec(a),B=E.vec(b);let s=0;for(let i=0;i<Math.min(A.length,B.length);i++)s+=A[i]*B[i];return s;};
  E.cross=(a,b)=>{const A=E.vec(a),B=E.vec(b);return E.vec(U.vec.cross([A[0],A[1],A[2]||0],[B[0],B[1],B[2]||0]));};
  E.vecFn=(x,y,z)=>{if(Array.isArray(x))return E.vec(x);const o=new Vec();o.push(x);if(y!==undefined)o.push(y);if(z!==undefined)o.push(z);return o;};
  E.rgb=(r,g,b,a)=>{const o=new Vec();o.push(r,g,b);if(a!==undefined)o.push(a);return o;};
  E.linear=(t,tMin,tMax,v1,v2)=>{
    if(tMin===tMax)return v1;
    let u=U.clamp((t-tMin)/(tMax-tMin),0,1);
    if(Array.isArray(v1)||Array.isArray(v2)){
      const A=E.vec(v1),B=E.vec(v2),n=Math.max(A.length,B.length),o=new Vec();
      for(let i=0;i<n;i++)o.push(A[i]+(B[i]-A[i])*u);return o;
    }
    return v1+(v2-v1)*u;
  };
  E.ease=(t,tMin,tMax,v1,v2)=>{
    if(tMin===tMax)return v1;const u=U.smoothstep(0,1,U.clamp((t-tMin)/(tMax-tMin),0,1));
    if(Array.isArray(v1)||Array.isArray(v2)){const A=E.vec(v1),B=E.vec(v2),n=Math.max(A.length,B.length),o=new Vec();for(let i=0;i<n;i++)o.push(A[i]+(B[i]-A[i])*u);return o;}
    return v1+(v2-v1)*u;
  };
  E.easeIn=(t,tMin,tMax,v1,v2)=>E.easeFn(t,tMin,tMax,v1,v2,U.easeIn);
  E.easeOut=(t,tMin,tMax,v1,v2)=>E.easeFn(t,tMin,tMax,v1,v2,U.easeOut);
  E.easeFn=(t,tMin,tMax,v1,v2,fn)=>{
    if(tMin===tMax)return v1;const u=fn(U.clamp((t-tMin)/(tMax-tMin),0,1));
    if(Array.isArray(v1)||Array.isArray(v2)){const A=E.vec(v1),B=E.vec(v2),n=Math.max(A.length,B.length),o=new Vec();for(let i=0;i<n;i++)o.push(A[i]+(B[i]-A[i])*u);return o;}
    return v1+(v2-v1)*u;
  };

  /* ---------- 编译缓存 ---------- */
  const _cache=new Map();
  E.compile=(src,names)=>{
    names=names||[];
    const key=src+'||'+names.join(',');
    if(_cache.has(key))return _cache.get(key);
    let fn;
    const body=/\breturn\b|;\s*\n|^\s*(var|let|const)\b/m.test(src)? src : 'return ('+src+');';
    try{ fn=new Function(...names,'"use strict";\n'+body); }
    catch(e){ fn=()=>{throw new Error('表达式语法错误: '+e.message);}; }
    _cache.set(key,fn);return fn;
  };

  /* 把函数结果归一化为 number / Vec，并解开 PropertyRef */
  E.unwrap=(v)=>{
    if(v instanceof PropertyRef)v=v.value;
    if(typeof v==='number')return v;
    if(v instanceof Vec)return v;
    if(Array.isArray(v))return E.vec(v);
    if(typeof v==='boolean')return v?1:0;
    if(typeof v==='string'){const n=parseFloat(v);return isNaN(n)?0:n;}
    return 0;
  };

  /* 生成一次求值的上下文（globals） */
  E.makeContext=function(c){
    // c: { time, fps, duration, value, keyframeValueAt, keyframes, seed,
    //      layerRef(name), compRef(name), selfProp(path), propRef(comp,layer,path,t) }
    const t=c.time, fps=c.fps, seed=c.seed||1;
    const v=E.vec(c.value);
    const G={
      time:t, value:v, thisComp:c.compRef(), thisLayer:c.layerRef(),
      fps:fps, duration:c.duration, PI:Math.PI, E:Math.E,
      Math:Math,
      vec:E.vecFn, rgb:E.rgb,
      add:E.add,sub:E.sub,mul:E.mul,div:E.div,mod:E.mod,
      clamp:(x,a,b)=>U.clamp(x,a,b),
      length:E.length,normalize:E.normalize,dot:E.dot,cross:E.cross,
      linear:E.linear,ease:E.ease,easeIn:E.easeIn,easeOut:E.easeOut,
      degreesToRadians:d=>U.rad(d), radiansToDegrees:r=>U.deg(r),
      framesToTime:(f,ff=fps)=>f/ff, timeToFrames:(tt,ff=fps)=>tt*ff,
      noise:(x)=>U.noise(x*1.3+seed*0.01),
      random:()=>U.hash1(seed*7.13+Math.floor(t*fps)*1.7),
      gaussRandom:()=>{const a=U.hash1(seed*3.1+Math.floor(t*fps)*1.7+.1),b=U.hash1(seed*5.7+Math.floor(t*fps)*1.7+.2);return Math.sqrt(-2*Math.log(a+1e-9))*Math.cos(U.TAU*b)*0.3;},
      seedRandom:(s)=>{ /* 影响后续 random，确定性 */ G.random=()=>U.hash1((s>>>0)*1.7+Math.floor(t*fps)*1.7); return 0; },
      posterizeTime:(n)=>n, timeToTimecode:()=>U.timecode(Math.round(t*fps),fps),
      loopOut:(type='cycle',n=0)=>c.loop('out',type,n),
      loopIn:(type='cycle',n=0)=>c.loop('in',type,n),
      loopOutDuration:(type='cycle',d=1)=>c.loop('out',type,0,d),
      wiggle:(freq=1,amp=10,oct=1,ampSpeed=1,tt=t)=>c.wiggle(freq,amp,oct,ampSpeed,tt),
      temporalWiggle:(freq=1,amp=10,oct=1,ampSpeed=1,tt=t)=>c.wiggle(freq,amp,oct,ampSpeed,tt),
      comp:(name)=>c.compRef(name),
      layer:(name)=>c.layerRef(name),
      valueAtTime:(tt)=>E.vec(c.selfPropAt(tt)),
    };
    // 补充：thisComp.layer(...) 等对象在 model.js 中以带方法的对象注入
    return G;
  };

  /* 运行表达式 */
  E.run=function(src,ctx){
    try{
      const names=Object.keys(ctx),args=names.map(n=>ctx[n]);
      const fn=E.compile(src,names);
      const out=fn.apply(null,args);
      return {ok:true,value:E.unwrap(out)};
    }catch(e){
      return {ok:false,error:(e&&e.message)||String(e)};
    }
  };

  console.log('[forge] expr ready');
})();
