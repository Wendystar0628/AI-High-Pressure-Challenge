/* ============================================================
   model.js — 工程数据模型
   合成 / 图层 / 属性 / 关键帧 / 空间插值 / 表达式依赖求值 /
   父子变换 / 撤销重做 / 工程序列化 / 每帧确定性状态
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE,U=AE.util,E=AE.expr;
  const MO=AE.model={};

  /* ---------------- 属性与关键帧 ---------------- */
  MO.P=function(v,meta){
    meta=meta||{};
    const dim=Array.isArray(v)?v.length:1;
    return Object.assign({
      v:v, kf:[], expr:null, exprMode:'replace', dim:dim,
      kind:meta.kind||(dim===1?'scalar':'vec'+dim),
      label:meta.label||'', min:meta.min, max:meta.max, step:meta.step||0.1,
      unit:meta.unit||'', options:meta.options, hidden:!!meta.hidden,
      spatial:!!meta.spatial
    },meta);
  };
  MO.K=function(t,v,o){
    o=o||{};
    return Object.assign({t:t,v:(Array.isArray(v)?v.slice():v),eo:o.eo||'linear',ei:o.ei||'linear',
      hold:!!o.hold, sp:!!o.sp, tanOut:o.tanOut||null, tanIn:o.tanIn||null,
      eh:o.eh||null, selected:false},o);
  };
  MO.animated=p=>p.kf&&p.kf.length>0;
  MO.isExprOn=p=>!!p.expr;

  /* 三次贝塞尔求值（点） */
  function bez(p0,p1,p2,p3,t){
    const u=1-t,a=u*u*u,b=3*u*u*t,c=3*u*t*t,d=t*t*t;
    const o=[];for(let i=0;i<p0.length;i++)o.push(a*p0[i]+b*p1[i]+c*p2[i]+d*p3[i]);return o;
  }
  function spatialLUT(k0,k1){
    if(k0._lut&&k0._lutKey===k1.t)return k0._lut;
    const p0=U.ensureVec(k0.v,2),p1=U.ensureVec(k1.v,2);
    const c1=p0.slice(),c2=p1.slice();
    if(k0.tanOut){c1[0]+=k0.tanOut[0];c1[1]+=k0.tanOut[1];}
    if(k1.tanIn){c2[0]+=k1.tanIn[0];c2[1]+=k1.tanIn[1];}
    const N=24,lut=[0];let prev=bez(p0,c1,c2,p1,0),acc=0;
    for(let i=1;i<=N;i++){const p=bez(p0,c1,c2,p1,i/N);acc+=U.vec.dist(p,prev);lut.push(acc);prev=p;}
    const res={c1,c2,total:acc||1,N};k0._lut=res;k0._lutKey=k1.t;return res;
  }
  function spatialPos(k0,k1,u){
    const p0=U.ensureVec(k0.v,2),p1=U.ensureVec(k1.v,2);
    const lut=spatialLUT(k0,k1);
    // 匀速：按弧长反查参数 s
    const target=U.clamp(u,0,1)*lut.total;
    let s=u;
    const L=lut.L||null;
    // 重建 L 数组
    if(!lut.L){
      lut.L=[0];let prev=bez(p0,lut.c1,lut.c2,p1,0),acc=0;
      for(let i=1;i<=lut.N;i++){const p=bez(p0,lut.c1,lut.c2,p1,i/lut.N);acc+=U.vec.dist(p,prev);lut.L.push(acc);prev=p;}
    }
    for(let i=1;i<lut.L.length;i++){
      if(lut.L[i]>=target){const a=lut.L[i-1],b=lut.L[i];const f=(target-a)/((b-a)||1);s=(i-1+f)/lut.N;break;}
    }
    return bez(p0,lut.c1,lut.c2,p1,U.clamp(s,0,1));
  }
  function temporalU(k0,k1,raw){
    const eo=k0.eo||'linear';
    if(eo==='hold')return 0;
    if(eo==='easeIn')return U.easeIn(raw);
    if(eo==='easeOut')return U.easeOut(raw);
    if(eo==='easeInOut')return U.easeInOut(raw);
    if(eo==='bezier'){
      const eh=k0.eh||[.33,0,.66,1];
      try{return U.bezierEase(eh[0],eh[1],eh[2],eh[3])(raw);}catch(e){return raw;}
    }
    return raw;
  }
  function lerpVal(a,b,u){
    if(Array.isArray(a)||Array.isArray(b)){
      const A=U.ensureVec(a,Math.max(U.dim(a),U.dim(b))),B=U.ensureVec(b,A.length),o=[];
      for(let i=0;i<A.length;i++)o.push(A[i]+(B[i]-A[i])*u);return o;
    }
    return a+(b-a)*u;
  }
  /* 关键帧求值（不含表达式） */
  MO.keyframeValue=function(prop,t){
    const kf=prop.kf;
    if(!kf||!kf.length)return U.clone(prop.v);
    if(t<=kf[0].t)return U.clone(kf[0].v);
    const last=kf[kf.length-1];
    if(t>=last.t)return U.clone(last.v);
    let i=0;while(i<kf.length-2&&kf[i+1].t<=t)i++;
    const k0=kf[i],k1=kf[i+1];
    if(k0.hold||k0.eo==='hold')return U.clone(k0.v);
    const dur=(k1.t-k0.t)||1e-6,raw=U.clamp((t-k0.t)/dur,0,1);
    const u=temporalU(k0,k1,raw);
    if(prop.spatial&&(k0.sp||k1.sp||k0.tanOut||k1.tanIn)){
      return spatialPos(k0,k1,u);
    }
    return lerpVal(k0.v,k1.v,u);
  };

  /* ---------------- 图层 / 合成工厂 ---------------- */
  const TYPE_META={
    shape:{icon:'▭',cn:'形状',color:'#7fc4e8'},text:{icon:'T',cn:'文字',color:'#e8c47f'},
    null:{icon:'✧',cn:'空对象',color:'#9aa6b8'},adjustment:{icon:'◐',cn:'调整',color:'#b48be0'},
    precomp:{icon:'▣',cn:'预合成',color:'#8fb87f'},camera:{icon:'⌖',cn:'摄像机',color:'#e88f8f'},
    light:{icon:'☀',cn:'灯光',color:'#e8d67f'},geometry:{icon:'⬡',cn:'三维几何',color:'#7fe0c4'},
    particle:{icon:'✦',cn:'粒子',color:'#ff9d5c'},audio:{icon:'♪',cn:'音色',color:'#8fb0e8'},
    field:{icon:'◉',cn:'空间场',color:'#a0d8e8'}
  };
  MO.TYPE_META=TYPE_META;

  function makeTransform(threeD){
    return {
      anchor:MO.P([0,0],{label:'锚点',spatial:false,kind:'vec2',unit:'px'}),
      position:MO.P([0,0],{label:'位置',spatial:true,kind:'vec2',unit:'px'}),
      positionZ:MO.P(0,{label:'Z 位置',kind:'scalar',unit:'px',hidden:!threeD}),
      scale:MO.P([100,100,100],{label:'缩放',kind:'vec3',unit:'%'}),
      rotation:MO.P(0,{label:'旋转',kind:'angle',unit:'°',step:1}),
      rotationX:MO.P(0,{label:'X 旋转',kind:'angle',unit:'°',step:1,hidden:!threeD}),
      rotationY:MO.P(0,{label:'Y 旋转',kind:'angle',unit:'°',step:1,hidden:!threeD}),
      rotationZ:MO.P(0,{label:'Z 旋转',kind:'angle',unit:'°',step:1,hidden:!threeD}),
      opacity:MO.P(100,{label:'不透明度',kind:'scalar',unit:'%',min:0,max:100})
    };
  }
  MO.createLayer=function(type,name,o){
    o=o||{};
    const L={
      id:U.uid('L'),name:name||(TYPE_META[type]?TYPE_META[type].cn:'图层'),type:type,
      enabled:true,locked:false,solo:false,shy:false,selected:false,
      color:(TYPE_META[type]||{}).color||'#8a92a0',
      inPoint:o.inPoint||0,outPoint:o.outPoint==null?15:o.outPoint,start:o.start||0,
      parentId:null,blendMode:'normal',motionBlur:false,threeD:!!o.threeD,
      castsShadow:true,receivesShadow:true,
      transform:makeTransform(o.threeD),
      params:{},masks:[],effects:[],
      fields:[],pins:[],
      shape:null,text:null,material:null,camera:null,light:null,particle:null,
      precomp:null,audio:null,geometry:null,nodeGraph:null
    };
    return L;
  };
  MO.createComp=function(o){
    o=o||{};
    return {id:U.uid('C'),name:o.name||'合成',width:o.width||1920,height:o.height||1080,
      fps:o.fps||30,duration:o.duration||15,workAreaStart:0,workAreaEnd:o.duration||15,
      bg:o.bg||'#0a0c10',layers:o.layers||[],
      motionBlur:o.motionBlur||{enabled:true,shutterAngle:180,shutterPhase:-90},
      cameraId:null,parentCompId:null};
  };
  MO.createProject=function(){
    return {name:'未命名工程',version:2,comps:[],activeCompId:null,
      assets:{glyphChar:'中',fontName:'锻造黑体 · 内置笔画字形'},
      nodeGraphs:{}};
  };
  MO.comp=function(proj,id){return proj.comps.find(c=>c.id===(id||proj.activeCompId))||proj.comps[0];};
  MO.findLayer=function(comp,ref){
    if(typeof ref==='number')return comp.layers[ref-1]||null;
    return comp.layers.find(l=>l.name===ref)||comp.layers.find(l=>l.id===ref)||null;
  };

  /* ---------------- 属性路径解析 ---------------- */
  MO.resolveProp=function(layer,path){
    if(!layer||!path)return null;
    if(path.indexOf('transform.')===0)return layer.transform[path.slice(10)]||null;
    if(path.indexOf('effect.')===0){
      // effect.<名称>.<参数>
      const rest=path.slice(7),di=rest.indexOf('.');
      if(di<0)return null;
      const ef=layer.effects.find(e=>e.name===rest.slice(0,di));
      return ef?ef.params[rest.slice(di+1)]||null:null;
    }
    if(path.indexOf('material.')===0)return layer.material?layer.material[path.slice(9)]||null:null;
    if(path.indexOf('shape.')===0)return layer.shape?layer.shape[path.slice(6)]||null:null;
    if(path.indexOf('text.')===0)return layer.text?layer.text[path.slice(5)]||null:null;
    if(path.indexOf('camera.')===0)return layer.camera?layer.camera[path.slice(7)]||null:null;
    if(path.indexOf('light.')===0)return layer.light?layer.light[path.slice(6)]||null:null;
    if(path.indexOf('particle.')===0)return layer.particle?layer.particle[path.slice(9)]||null:null;
    if(path.indexOf('audio.')===0)return layer.audio?layer.audio[path.slice(6)]||null:null;
    if(path.indexOf('field.')===0){
      const rest=path.slice(6),f=layer.fields&&layer.fields[0];
      if(f&&f[rest]&&typeof f[rest]==='object'&&'kf' in f[rest])return f[rest];
      return layer.params[path]||null;
    }
    return layer.params[path]||null;
  };
  MO.propPaths=function(layer){
    const out=[];
    const scan=(obj,prefix)=>{
      for(const k in obj){
        const v=obj[k];
        if(v&&typeof v==='object'&&!Array.isArray(v)&&'v' in v&&'kf' in v){out.push(prefix+k);}
        else if(v&&typeof v==='object'&&!Array.isArray(v)&&(v.v===undefined)){
          // 嵌套组（effects 的 params 已单独处理）
        }
      }
    };
    scan(layer.transform,'transform.');
    for(const k in layer.params)if(layer.params[k]&&'v' in layer.params[k])out.push('params.'+k);
    if(layer.material)scan(layer.material,'material.');
    if(layer.shape)scan(layer.shape,'shape.');
    if(layer.text)scan(layer.text,'text.');
    if(layer.camera)scan(layer.camera,'camera.');
    if(layer.light)scan(layer.light,'light.');
    if(layer.particle)scan(layer.particle,'particle.');
    if(layer.audio)scan(layer.audio,'audio.');
    layer.effects.forEach(ef=>{for(const k in ef.params)if(ef.params[k]&&'v' in ef.params[k])out.push('effect.'+ef.name+'.'+k);});
    // 把 params. 前缀去掉以匹配 params 直查
    return out.map(p=>p.indexOf('params.')===0?p.slice(7):p);
  };

  /* ---------------- 依赖求值 ---------------- */
  MO.lastErrors={};
  class CircularError extends Error{}

  function propKey(comp,layer,path){return comp.id+'|'+layer.id+'|'+path;}

  MO.valueAtTime=function(proj,comp,layer,path,t,seen,depth){
    const prop=MO.resolveProp(layer,path);
    if(!prop)return 0;
    const kv=MO.keyframeValue(prop,t);
    if(!prop.expr)return kv;
    const key=propKey(comp,layer,path);
    const s=seen||new Set(),d=depth||0;
    if(s.has(key)||d>20){
      MO.lastErrors[key]='表达式循环引用或求值过深 → 已退回关键帧值';
      return kv;
    }
    const s2=new Set(s);s2.add(key);
    const seed=(U.hashStr(key)*0.0001)%1000;
    const compRef=(name)=>makeCompObj(proj,name?proj.comps.find(c=>c.name===name)||comp:comp,t,s2,d+1);
    const layerRef=(name,cObj)=>makeLayerObj(proj,(cObj&&cObj._comp)||comp,name,t,s2,d+1);
    const ctx=E.makeContext({
      time:t,fps:comp.fps,duration:comp.duration,value:kv,seed:seed,
      compRef:compRef,layerRef:layerRef,
      selfPropAt:(tt)=>MO.valueAtTime(proj,comp,layer,path,tt,s2,d+1),
      wiggle:(f,a,oct,asp,tt)=>doWiggle(prop,seed,f,a,oct,asp,tt),
      loop:(kind,type,n,dur)=>doLoop(prop,t,kind,type,n,dur)
    });
    ctx.thisComp=compRef();
    ctx.thisLayer=layerRef(layer.name);
    const r=E.run(prop.expr,ctx);
    if(!r.ok){MO.lastErrors[key]=r.error+' → 已退回关键帧值';return kv;}
    delete MO.lastErrors[key];
    let val=r.value;
    if(val instanceof E.Vec)val=Array.from(val);
    if(prop.exprMode==='add'){
      const A=U.ensureVec(kv,prop.dim),B=U.ensureVec(val,prop.dim),o=[];
      for(let i=0;i<prop.dim;i++)o.push(A[i]+(B[i]||0));
      return prop.dim===1?o[0]:o;
    }
    // 归一化维度
    if(prop.dim===1)return Array.isArray(val)?(val[0]||0):(typeof val==='number'?val:kv);
    const V=U.ensureVec(val,prop.dim);
    return V.slice(0,prop.dim);
  };

  function doWiggle(prop,seed,freq,amp,oct,ampSpeed,tt){
    oct=Math.max(1,oct||1);ampSpeed=ampSpeed||1;
    const base=U.ensureVec(prop.v,prop.dim);
    const out=[];
    for(let i=0;i<prop.dim;i++){
      let s=0,a=1,sum=0;
      for(let o=0;o<oct;o++){
        s+=a*U.wig(tt*ampSpeed+o*11.3,freq*(o+1),seed+i*7.7+o*3.1);
        sum+=a;a*=.5;
      }
      out.push((base[i]||0)+(s/(sum||1))*amp);
    }
    return prop.dim===1?out[0]:out;
  }
  function doLoop(prop,t,kind,type,n,dur){
    const kf=prop.kf;if(!kf||kf.length<2)return MO.keyframeValue(prop,t);
    let t0=kf[0].t,t1=kf[kf.length-1].t;
    if(n>0){const idx=Math.max(0,kf.length-1-n);t0=kf[idx].t;}
    const len=(dur!=null?dur:(t1-t0))||1;
    let x;
    if(kind==='in')x=(t0-t)/len;
    else x=(t-t0)/len;
    let u;
    if(type==='pingpong'){
      const p=U.clamp(x,0,1e6),m=p%2;u=m<=1?m:2-m;
    }else if(type==='offset'||type==='continue'){
      const c=Math.floor(x),f=x-c;u=f;
      // offset/continue 在末尾叠加偏移，这里用线性近似
      return MO.keyframeValue(prop,t0+u*len);
    }else{ // cycle
      u=x-Math.floor(x);
    }
    return MO.keyframeValue(prop,t0+u*len);
  }

  function makeCompObj(proj,comp,t,seen,depth){
    const o={
      _comp:comp,name:comp.name,width:comp.width,height:comp.height,fps:comp.fps,
      duration:comp.duration,numLayers:comp.layers.length,
      layer:(ref)=>makeLayerObj(proj,comp,ref,t,seen,depth),
      layerByIndex:(i)=>makeLayerObj(proj,comp,i,t,seen,depth)
    };
    return o;
  }
  function makeLayerObj(proj,comp,ref,t,seen,depth){
    const L=MO.findLayer(comp,ref);
    if(!L)return null;
    const get=(path,tt)=>MO.valueAtTime(proj,comp,L,path,tt===undefined?t:tt,seen,depth);
    const group=(prefix)=>new Proxy({},{
      get(_,k){
        if(k==='then'||k==='toJSON'||k==='valueOf')return undefined;
        const p=MO.resolveProp(L,prefix+k);
        if(!p)return undefined;
        return new E.PropertyRef((tt)=>get(prefix+k,tt),p.dim,t);
      }
    });
    const o={
      _layer:L,name:L.name,index:comp.layers.indexOf(L)+1,
      transform:group('transform.'),
      material:group('material.'),
      camera:group('camera.'),
      light:group('light.'),
      particle:group('particle.'),
      param:(path)=>{const p=MO.resolveProp(L,path);return p?new E.PropertyRef(tt=>get(path,tt),p.dim,t):undefined;},
      effect:(name)=>new Proxy({},{
        get(_,k){
          const p=MO.resolveProp(L,'effect.'+name+'.'+k);
          return p?new E.PropertyRef(tt=>get('effect.'+name+'.'+k,tt),p.dim,t):undefined;
        }
      }),
      content:(name)=>o,
      sourceRectAtTime:()=>({width:comp.width,height:comp.height,left:0,top:0}),
      valueAtTime:(tt)=>E.vec(get('transform.position',tt)),
      toWorld:(p)=>p
    };
    return o;
  }

  /* ---------------- 变换 / 父级 ---------------- */
  MO.layerValues=function(proj,comp,layer,t){
    const T=layer.transform;
    const g=p=>MO.valueAtTime(proj,comp,layer,'transform.'+p,t);
    return {
      anchor:g('anchor'),position:g('position'),positionZ:g('positionZ'),
      scale:g('scale'),rotation:g('rotation'),rotationX:g('rotationX'),
      rotationY:g('rotationY'),rotationZ:g('rotationZ'),opacity:g('opacity')
    };
  };
  MO.localMatrix=function(layer,t,proj,comp){
    const v=MO.layerValues(proj,comp,layer,t);
    const a=U.ensureVec(v.anchor,2),s=U.ensureVec(v.scale,3),p=U.ensureVec(v.position,2);
    const rz=U.rad(v.rotation+(layer.threeD?v.rotationZ:0));
    let m=U.mat4.translation(p[0],p[1],v.positionZ||0);
    m=U.mat4.mul(m,U.mat4.rotZ(rz));
    if(layer.threeD){m=U.mat4.mul(m,U.mat4.rotX(U.rad(v.rotationX)));m=U.mat4.mul(m,U.mat4.rotY(U.rad(v.rotationY)));}
    m=U.mat4.mul(m,U.mat4.scaling(s[0]/100,s[1]/100,(s[2]||100)/100));
    m=U.mat4.mul(m,U.mat4.translation(-a[0],-a[1],0));
    return m;
  };
  MO.worldMatrix=function(proj,comp,layer,t,cache){
    cache=cache||{};
    if(cache[layer.id])return cache[layer.id];
    let m=MO.localMatrix(layer,t,proj,comp);
    if(layer.parentId){
      const P=comp.layers.find(l=>l.id===layer.parentId);
      if(P)m=U.mat4.mul(MO.worldMatrix(proj,comp,P,t,cache),m);
    }
    cache[layer.id]=m;return m;
  };
  /* 设定/更换/解除父级时保留当前画面 */
  MO.reparent=function(proj,comp,layer,newParentId,t){
    const oldWorld=MO.worldMatrix(proj,comp,layer,t);
    layer.parentId=newParentId;
    let pw=U.mat4.identity();
    if(newParentId){const P=comp.layers.find(l=>l.id===newParentId);if(P)pw=U.mat4.invert(MO.worldMatrix(proj,comp,P,t));}
    const local=U.mat4.mul(pw,oldWorld);
    // 从仿射矩阵分解出 position / rotationZ / scale
    const px=local[12],py=local[13];
    const sx=Math.hypot(local[0],local[1]),sy=Math.hypot(local[4],local[5]);
    const rot=Math.atan2(local[1],local[0]);
    const A=layer.transform.anchor,P=layer.transform.position,S=layer.transform.scale,R=layer.transform.rotation;
    const setK=(p,val)=>{ /* 在当前时刻写入关键帧或静态值 */ };
    // 以锚点为参考修正位置：world = T(pos) R S T(-anchor)，故 pos = 平移 + R S anchor
    const av=U.ensureVec(MO.valueAtTime(proj,comp,layer,'transform.anchor',t),2);
    const sc=[sx,sy];
    const ex=px+(Math.cos(rot)*sc[0]*av[0]-Math.sin(rot)*sc[1]*av[1]);
    const ey=py+(Math.sin(rot)*sc[0]*av[0]+Math.cos(rot)*sc[1]*av[1]);
    setValueAt(proj,comp,layer,'transform.position',t,[ex,ey]);
    setValueAt(proj,comp,layer,'transform.rotation',t,U.deg(rot));
    setValueAt(proj,comp,layer,'transform.scale',t,[sc[0]*100,sc[1]*100,100]);
  };

  /* 写入属性：动画开启则在当前时刻 upsert 关键帧 */
  function setValueAt(proj,comp,layer,path,t,val){
    const p=MO.resolveProp(layer,path);if(!p)return;
    MO.setPropValue(p,t,val);
  }
  MO.setPropValue=function(prop,t,val){
    if(MO.animated(prop)){
      const eps=1/(60);let found=null;
      for(const k of prop.kf)if(Math.abs(k.t-t)<eps)found=k;
      if(found){found.v=Array.isArray(val)?val.slice():val;}
      else{
        const k=MO.K(t,val,{eo:'easeInOut',ei:'easeInOut'});
        prop.kf.push(k);prop.kf.sort((a,b)=>a.t-b.t);
      }
      // 更新静态基值便于显示
      prop.v=Array.isArray(val)?val.slice():val;
    }else{
      prop.v=Array.isArray(val)?val.slice():val;
    }
  };
  MO.addKeyframe=function(prop,t,val,o){
    const k=MO.K(t,val===undefined?MO.keyframeValue(prop,t):val,o||{eo:'easeInOut',ei:'easeInOut'});
    prop.kf.push(k);prop.kf.sort((a,b)=>a.t-b.t);return k;
  };
  MO.deleteKeyframes=function(prop,pred){prop.kf=prop.kf.filter(k=>!pred(k));};
  MO.moveKeyframes=function(prop,pred,dt){prop.kf.forEach(k=>{if(pred(k))k.t+=dt;});prop.kf.sort((a,b)=>a.t-b.t);};
  MO.scaleKeyframes=function(prop,pred,origin,factor){prop.kf.forEach(k=>{if(pred(k))k.t=origin+(k.t-origin)*factor;});prop.kf.sort((a,b)=>a.t-b.t);};

  /* ---------------- 每帧确定性状态 ---------------- */
  MO.collectPaths=function(layer){
    const set=new Set();
    const scan=(obj,prefix)=>{if(!obj)return;for(const k in obj){const v=obj[k];if(v&&typeof v==='object'&&!Array.isArray(v)&&'kf' in v&&'v' in v)set.add(prefix+k);}};
    scan(layer.transform,'transform.');
    for(const k in layer.params)if(layer.params[k]&&'kf' in layer.params[k])set.add(k);
    scan(layer.material,'material.');scan(layer.shape,'shape.');scan(layer.text,'text.');
    scan(layer.camera,'camera.');scan(layer.light,'light.');scan(layer.particle,'particle.');
    scan(layer.audio,'audio.');scan(layer.geometry,'geometry.');
    layer.effects.forEach(ef=>{for(const k in ef.params)if(ef.params[k]&&'kf' in ef.params[k])set.add('effect.'+ef.name+'.'+k);});
    layer.fields.forEach((f,i)=>scan(f,'field'+i+'.'));
    return [...set];
  };
  MO.frameState=function(proj,comp,t){
    MO.lastErrors={};
    const cache={};
    const st={t:t,comp:comp,layers:[],byId:{},byName:{},camera:null,lights:[],fields:[],errors:MO.lastErrors};
    for(const L of comp.layers){
      const vals={};
      const paths=MO.collectPaths(L);
      for(const p of paths)vals[p]=MO.valueAtTime(proj,comp,L,p,t);
      const world=MO.worldMatrix(proj,comp,L,t,cache);
      const enabled=L.enabled&&t>=L.inPoint&&t<=L.outPoint&&(!comp.layers.some(x=>x.solo)||L.solo);
      const o={layer:L,vals:vals,world:world,enabled:enabled,visible:enabled};
      st.layers.push(o);st.byId[L.id]=o;st.byName[L.name]=o;
      if(L.type==='camera'&&enabled&&!st.camera)st.camera=o;
      if(L.type==='light'&&enabled)st.lights.push(o);
      if(L.type==='field'&&enabled)st.fields.push(o);
    }
    return st;
  };

  /* ---------------- 撤销 / 重做 ----------------
     undo 栈保存“修改前”的快照；调用 commit() 时先 push 再执行修改。
  ------------------------------------------------ */
  const H=MO.history={undo:[],redo:[],limit:80,grouping:false,groupBase:null};
  H.snapshot=function(){return JSON.stringify(AE.editor?AE.editor.project:null);};
  H.push=function(label){
    if(H.grouping)return; // 分组期间由 end() 统一入栈
    const s=H.snapshot();
    const last=H.undo[H.undo.length-1];
    if(last&&last.s===s)return;
    H.undo.push({s:s,label:label||'编辑'});
    if(H.undo.length>H.limit)H.undo.shift();
    H.redo.length=0;
    AE.editor&&AE.editor.onHistory&&AE.editor.onHistory();
  };
  H.begin=function(){if(H.grouping)return;H.grouping=true;H.groupBase=H.snapshot();};
  H.end=function(label){
    if(!H.grouping)return;H.grouping=false;
    const base=H.groupBase;H.groupBase=null;
    if(base!==null&&base!==H.snapshot()){
      H.undo.push({s:base,label:label||'编辑'});
      H.redo.length=0;
      AE.editor&&AE.editor.onHistory&&AE.editor.onHistory();
    }
  };
  H.apply=function(s){
    if(!s)return;
    try{
      const proj=JSON.parse(s);
      AE.editor.project=proj;
      AE.editor.project.comps.forEach(c=>c.layers.forEach(L=>{
        // 清理缓存字段
      }));
      AE.editor.rebind&&AE.editor.rebind();
      AE.editor.refreshAll&&AE.editor.refreshAll();
    }catch(e){console.warn(e);}
  };
  H.undoDo=function(){
    if(!H.undo.length)return false;
    const cur=H.snapshot();
    const item=H.undo.pop();
    H.redo.push({s:cur,label:item.label});
    H.apply(item.s);return true;
  };
  H.redoDo=function(){
    if(!H.redo.length)return false;
    const cur=H.snapshot();
    const item=H.redo.pop();
    H.undo.push({s:cur,label:item.label});
    H.apply(item.s);return true;
  };

  /* ---------------- 序列化 ---------------- */
  MO.serialize=function(proj){return JSON.stringify(proj,null,1);};
  MO.deserialize=function(str){
    const p=JSON.parse(str);
    if(!p.comps||!Array.isArray(p.comps))throw new Error('工程文件格式不正确');
    return p;
  };

  console.log('[forge] model ready');
})();
