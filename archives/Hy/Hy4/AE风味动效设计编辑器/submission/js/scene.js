/* ============================================================
   scene.js — 把工程数据渲染为 WebGL 场景（与空工程共用机制）
   遍历合成/图层 → 求值后的属性、材质、几何、变形、节点、粒子、灯光、摄像机；
   预合成按时间重映射展开；一切均为时间 t 的纯函数。
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE,U=AE.util,MO=AE.model,G=AE.geom,GH=AE.glyphs,ND=AE.nodes,PS=AE.particles;
  const SC=AE.scene={};

  /* ---------- 派生缓存（改字 / 改参数后重新计算） ---------- */
  SC.rebuild=function(editor){
    const proj=editor.project;
    editor.simCache={};
    const char=proj.assets.glyphChar,size=2.62;
    const localPts=GH.pickImpacts(char,size,(AE.demo.impacts||[]).length);
    const glyphPoints=GH.impactPoints(char,size);
    // 场（从工程数据读取，作用于几何顶点与粒子）
    const fields=[];
    for(const comp of proj.comps)for(const L of comp.layers){
      if(L.type!=='field')continue;
      const f=L.fields&&L.fields[0];
      const p=L.params||{};
      fields.push({type:(f&&f.type)||'vortex',
        position:p['field.position']?U.ensureVec(p['field.position'].v,3):[0,0,0],
        radius:p['field.radius']?p['field.radius'].v:2.2,
        strength:p['field.strength']?p['field.strength'].v:0.5});
    }
    editor.cacheFields=fields;
    for(const comp of proj.comps)for(const L of comp.layers){
      if(L.type!=='particle')continue;
      const P=L.particle||{};
      const impacts=(P.impacts||AE.demo.impacts).map((im,i)=>{
        const q=localPts[i]||[0,0];
        // 字形直立：局部(gx,gy) → 世界(gx,gy)，火星从字块正面迸出
        return {t:im.t,strength:im.strength,x:q[0],y:q[1],z:0.34};
      });
      const seed=P.seed?P.seed.v:20240607;
      const sim=PS.create({
        duration:comp.duration,max:1100,seed:seed,
        gravity:[0,-(P.gravity?P.gravity.v:6.2),0],
        drag:P.drag?P.drag.v:0.55,
        planeY:-1.28,charFrontZ:0.30,charBox:[-1.45,1.45,-1.45,1.45],
        impacts:impacts,
        embers:{from:3.1,to:12.4,rate:(P.rate?P.rate.v:120)*0.16},
        glyphPoints:glyphPoints.map(q=>[q[0],q[1]]),
        fields:fields,
        cool:1.15
      });
      sim.build();
      editor.simCache[L.id]=sim;
    }
    // 节点图同步字符
    for(const k in proj.nodeGraphs){const g=proj.nodeGraphs[k];if(g)g._char=char;}
    // 音频配置
    let audioParams={};
    for(const comp of proj.comps)for(const L of comp.layers)if(L.type==='audio'){
      const a=L.audio||{};
      audioParams={tone:a.tone?a.tone.v:1,baseFreq:a.baseFreq?a.baseFreq.v:74,
        decay:a.decay?a.decay.v:.65,noise:a.noise?a.noise.v:.55,volume:a.volume?a.volume.v:.55};
    }
    AE.audio.configure({impacts:(AE.demo.impacts||[]).map(i=>({t:i.t,strength:i.strength})),duration:15,params:audioParams});
    AE.audio.resetFired();
    editor.cacheReady=true;
  };

  /* ---------- 形状层轮廓 ---------- */
  function shapeContours(L,v){
    const s=L.shape||{},w=v['shape.w']!=null?v['shape.w']:(s.w||2),h=v['shape.h']!=null?v['shape.h']:(s.h||2);
    let rings=[];
    const kind=s.kind||'rect';
    if(kind==='ellipse')rings=[G.ellipse(0,0,w/2,h/2,48)];
    else if(kind==='star')rings=[G.star(0,0,w/2,w/4,s.points||5)];
    else if(kind==='polygon')rings=[G.regular(0,0,w/2,s.points||6)];
    else if(kind==='path'&&s.path&&s.path.length>2)rings=[s.path.map(p=>[p[0],p[1]])];
    else rings=[G.rect(-w/2,-h/2,w,h)];
    // 孔洞
    if(s.holes)for(const ho of s.holes){
      if(ho.kind==='ellipse')rings.push(G.ellipse(ho.x||0,ho.y||0,ho.rx||.4,ho.ry||.4,36));
      else rings.push(G.rect((ho.x||0)-(ho.w||.5)/2,(ho.y||0)-(ho.h||.5)/2,ho.w||.5,ho.h||.5));
    }
    // 修剪（沿轮廓生长）
    const trim=v['shape.trim'];
    if(trim!=null&&trim<0.999){
      rings=rings.map(r=>{let cx=0,cy=0;for(const p of r){cx+=p[0];cy+=p[1];}cx/=r.length;cy/=r.length;
        return r.map(p=>[cx+(p[0]-cx)*Math.max(.001,trim),cy+(p[1]-cy)*Math.max(.001,trim)]);});
    }
    // 重复器
    const rep=v['shape.repeater'];
    if(rep&&rep>1)rings=G.repeatContours(rings,Math.round(rep),[v['shape.repOffsetX']||.5,0],v['shape.repRot']||0,[1,1]);
    // 布尔（与第二个形状）
    if(s.boolean&&s.boolean.kind){
      let B;
      if(s.boolean.kind==='ellipse')B=[G.ellipse(s.boolean.x||0,s.boolean.y||0,.7,.7,36)];
      else B=[G.rect((s.boolean.x||0)-.7,(s.boolean.y||0)-.7,1.4,1.4)];
      rings=G.boolean(rings,B,s.boolean.op||'union');
    }
    return rings;
  }

  /* ---------- 读取材质 ---------- */
  function readMaterial(L,v){
    const b=v['material.baseColor']||[.5,.5,.5];
    const metal=v['material.metalness']!=null?v['material.metalness']:0.9;
    const rough=v['material.roughness']!=null?v['material.roughness']:0.3;
    const em=v['material.emissive']||[1,.4,.1];
    const ei=v['material.emissiveInt']!=null?v['material.emissiveInt']:0;
    const mo=v['material.opacity']!=null?v['material.opacity']:100;
    const layerOp=v['transform.opacity']!=null?v['transform.opacity']:100;
    return {baseColor:U.ensureVec(b,3),metalness:metal,roughness:rough,
      emissive:U.ensureVec(em,3),emissiveInt:ei,
      opacity:U.clamp(mo/100*layerOp/100,0,1)};
  }

  /* ---------- 几何层 → mesh ---------- */
  function glyphPins(v,proj,t,size){
    const pins=[];
    for(let i=0;i<6;i++){
      const pos=v['pin'+i+'.pos'];if(!pos)break;
      pins.push({pos:U.ensureVec(pos,2),radius:v['pin'+i+'.radius']||.85,
        offset:U.ensureVec(v['pin'+i+'.offset'],3),rot:v['pin'+i+'.rot']||0,
        scale:v['pin'+i+'.scale']==null?1:v['pin'+i+'.scale']});
    }
    // 锤击造成的永久凹痕 + 瞬时震颤（换字后按新笔画位置重新生成）
    const char=proj.assets.glyphChar,pts=GH.pickImpacts(char,size,(AE.demo.impacts||[]).length);
    AE.demo.impacts.forEach((im,i)=>{
      const dt=t-im.t;
      if(dt<-0.02)return;
      const env=1;
      const flash=dt<0.7?Math.exp(-dt*9)*Math.sin(dt*44)*0.4:0;
      const off=-im.strength*0.10*(env+flash);
      const p=pts[i]||[0,0];
      pins.push({pos:[p[0],p[1]],radius:0.6,offset:[0,off*0.65,off*0.8],rot:0,scale:1-0.015*env});
    });
    return pins;
  }

  function buildGeometry(L,v,proj,t,fields,nodeRes){
    const g=L.geometry||{};
    const depthVal=v['geometry.depth']!=null?v['geometry.depth']:(g.depth||.4);
    const bevel=v['geometry.bevel']!=null?v['geometry.bevel']:(g.bevel||.04);
    let mesh=null,local=U.mat4.identity(),skip=false;
    if(g.source==='node'){skip=true;}
    else if(g.source==='glyph'){
      const char=proj.assets.glyphChar,size=v['geometry.size']!=null?v['geometry.size']:(g.size||2.6);
      const trimP=v['geometry.trim']!=null?v['geometry.trim']:1;
      const n=GH.count(char),trim=[];
      for(let i=0;i<n;i++)trim.push(U.clamp(trimP*n-i,0,1));
      mesh=GH.mesh(char,{size:size,depth:depthVal,bevel:bevel,trim:trim});
      const pins=glyphPins(v,proj,t,size);
      const heat=AE.demo.heatAt?AE.demo.heatAt(t):.5;
      const amp=(v['geometry.deform']==null?1:v['geometry.deform'])*heat*0.14;
      G.deform(mesh,{pins:pins,fields:fields,t:t,amp:amp});
      local=U.mat4.mul(U.mat4.translation(0,g.restY==null?0:g.restY,0),
        U.mat4.rotX(U.rad(g.rotateX==null?0:g.rotateX)));
    }else if(g.source==='box'){
      mesh=G.box(g.w||2,g.h||2,g.d||2);
    }else if(g.source==='hammer'){
      mesh=new G.Mesh();
      mesh.append(G.box(g.headW||1,g.headH||.5,g.headD||.9));
      const handle=G.box(g.handleW||.2,g.handleH||2.4,g.handleW||.2);
      handle.transform(U.mat4.translation(0,(g.handleH||2.4)/2+(g.headH||.5)/2,0));
      mesh.append(handle);
    }else if(g.source==='shape'){
      mesh=G.extrude(shapeContours(L,v),depthVal,bevel);
    }else if(g.source==='text'||L.type==='text'){
      const txt=(L.text&&L.text.content)||'中';
      const ch=GH.has(txt[0])?txt[0]:'中';
      mesh=GH.mesh(ch,{size:v['geometry.size']||(g.size||2),depth:depthVal,bevel:bevel,trim:1});
      local=U.mat4.mul(U.mat4.translation(0,g.restY==null?0:g.restY,0),U.mat4.rotX(U.rad(g.rotateX==null?0:g.rotateX)));
    }else{
      mesh=G.box(1,1,1);
    }
    return {mesh:mesh,local:local,skip:skip};
  }

  /* ---------- 递归收集（含预合成时间重映射） ---------- */
  function collect(editor,comp,t,base,out,depth,stOverride,fields,nodeRes){
    if(depth>4)return;
    const proj=editor.project;
    const st=stOverride||MO.frameState(proj,comp,t);
    for(const o of st.layers){
      const L=o.layer;
      if(!o.enabled)continue;
      if(L.type==='precomp'&&L.precomp){
        const ref=proj.comps.find(c=>c.id===L.precomp.compId);
        if(ref){
          const remap=o.vals['precomp.timeRemap']||0;
          collect(editor,ref,t+remap,U.mat4.mul(base,o.world),out,depth+1,null,fields,nodeRes);
        }
        continue;
      }
      if(L.type!=='geometry'&&L.type!=='shape'&&L.type!=='text')continue;
      const built=buildGeometry(L,o.vals,proj,t,fields,nodeRes);
      if(built.skip||!built.mesh)continue;
      const model=U.mat4.mul(base,U.mat4.mul(o.world,built.local));
      const mesh=built.mesh;
      mesh.transform(model);
      out.push({key:L.id,mesh:mesh,model:U.mat4.identity(),material:readMaterial(L,o.vals),
        castShadow:L.castsShadow!==false,receiveShadow:L.receivesShadow!==false,blendMode:L.blendMode||'normal'});
    }
    // 节点几何（同一输出连接显示/发射/碰撞/变形）
    if(depth===0&&nodeRes){
      const nodeLayer=st.layers.find(o=>o.layer.type==='geometry'&&o.layer.geometry&&o.layer.geometry.source==='node');
      const nl=nodeLayer?nodeLayer.layer:null,nv=nodeLayer?nodeLayer.vals:{};
      const nworld=nodeLayer?nodeLayer.world:U.mat4.identity();
      nodeRes.meshes.forEach((r,i)=>{
        if(!r.mesh)return;
        const m=r.mesh;
        const local=U.mat4.mul(U.mat4.translation(0,-1.17,0),U.mat4.rotX(U.rad(-90)));
        const model=U.mat4.mul(base,U.mat4.mul(nworld,local));
        m.transform(model);
        out.push({key:'node_'+i,mesh:m,model:U.mat4.identity(),
          material:nl?readMaterial(nl,nv):{baseColor:[.3,.25,.2],metalness:.85,roughness:.45,emissive:[1,.4,.12],emissiveInt:.1,opacity:1},
          castShadow:true,receiveShadow:true,blendMode:'normal'});
      });
    }
  }

  /* ---------- 主入口 ---------- */
  SC.build=function(editor,comp,t){
    const proj=editor.project;
    if(!editor.cacheReady)SC.rebuild(editor);
    const st=MO.frameState(proj,comp,t);
    const fields=editor.cacheFields||[];
    const char=proj.assets.glyphChar;
    const graph=proj.nodeGraphs.main||ND.createGraph();
    const nodeRes=ND.evaluate(graph,{t:t,glyphChar:char,size:2.62});
    const allFields=fields.concat(nodeRes.fields||[]);

    /* 摄像机 */
    let camera={pos:[0,3.6,6.9],target:[0,-.35,0],fov:40,focus:7.6,aperture:.1,maxCoC:5,near:.1,far:60,up:[0,1,0]};
    for(const o of st.layers){
      if(o.layer.type!=='camera'||!o.enabled)continue;
      const v=o.vals;
      const p=U.ensureVec(v['camera.pos'],3),tg=U.ensureVec(v['camera.target'],3);
      const sh=AE.demo.shake?AE.demo.shake(t):0;
      camera={pos:[p[0]+sh*.05,p[1]+sh*.035,p[2]],target:tg,
        fov:v['camera.fov']!=null?v['camera.fov']:40,
        focus:v['camera.focus']!=null?v['camera.focus']:7.6,
        aperture:v['camera.aperture']!=null?v['camera.aperture']:.1,
        maxCoC:v['camera.maxCoC']!=null?v['camera.maxCoC']:5,
        near:.1,far:60,up:[0,1,0]};
      break;
    }
    /* 灯光 */
    let dirLight={dir:[-.4,-1,-.5],color:[1,.9,.78],intensity:1.5,shadow:true};
    let pointLight={pos:[0,-.6,1.7],color:[1,.42,.13],intensity:3.4};
    for(const o of st.layers){
      if(o.layer.type!=='light'||!o.enabled)continue;
      const v=o.vals,L=o.layer,lt=(L.light&&L.light.type)||'parallel';
      const color=U.ensureVec(v['light.color'],3),I=v['light.intensity']!=null?v['light.intensity']:1;
      if(lt==='point'){
        pointLight={pos:U.ensureVec(v['light.pos'],3),color:color,intensity:I};
      }else{
        dirLight={dir:U.vec.norm(U.ensureVec(v['light.dir'],3)),color:color,intensity:I,shadow:L.light&&L.light.castShadow!==false};
      }
    }
    const lightPos=U.vec.scale(dirLight.dir,-12);
    const lview=U.mat4.lookAt(lightPos,[0,0,0],[0,1,0]);
    const lproj=U.mat4.ortho(-5.2,5.2,-5.2,5.2,.5,30);
    const shadowVP=U.mat4.mul(lproj,lview);

    /* 网格 */
    const meshes=[];
    collect(editor,comp,t,U.mat4.identity(),meshes,0,st,allFields,nodeRes);

    /* 粒子（多个发射器合并） */
    const particles={pos:[],col:[],size:[],alpha:[],trails:[],heat:[]};
    for(const o of st.layers){
      if(o.layer.type!=='particle'||!o.enabled)continue;
      const sim=editor.simCache[o.layer.id];
      if(!sim)continue;
      const trail=(o.vals['particle.trailLength']!=null)?Math.round(o.vals['particle.trailLength']):6;
      const s=sim.sample(t,trail);
      for(let i=0;i<s.pos.length;i++)particles.pos.push(s.pos[i]);
      for(let i=0;i<s.col.length;i++)particles.col.push(s.col[i]);
      for(let i=0;i<s.size.length;i++)particles.size.push(s.size[i]);
      for(let i=0;i<s.alpha.length;i++)particles.alpha.push(s.alpha[i]);
      for(let i=0;i<s.trails.length;i++)particles.trails.push(s.trails[i]);
    }

    const heat=AE.demo.heatAt?AE.demo.heatAt(t):.5;
    return {
      time:t,camera:camera,
      lights:{dir:dirLight,point:pointLight},
      shadowVP:shadowVP,meshes:meshes,particles:particles,
      sparkScale:1.5,
      bloom:{threshold:.95,strength:.9+heat*.45,exposure:1.05},
      mb:comp.motionBlur||{enabled:false,shutterAngle:180,shutterPhase:-90}
    };
  };

  console.log('[forge] scene ready');
})();
