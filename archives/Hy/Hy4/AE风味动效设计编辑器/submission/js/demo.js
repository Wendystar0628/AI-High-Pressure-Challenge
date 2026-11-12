/* ============================================================
   demo.js — 15 秒示例《锻字》
   全部内容由可定位/可修改的图层、关键帧、表达式、材质、节点、
   粒子与音频设置构成，与空工程使用同一套编辑与渲染机制。
   四阶段：写成 → 成块 → 锻打 → 冷却。默认字「中」可换。
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE,U=AE.util,MO=AE.model,GH=AE.glyphs,ND=AE.nodes;
  const D=AE.demo={};

  /* 锤击事件（重音与火星、形变、镜头震动共用） */
  D.impacts=[
    {t:7.45,strength:0.78,label:'第一锤'},
    {t:8.70,strength:1.02,label:'第二锤'},
    {t:9.90,strength:1.24,label:'第三锤'},
    {t:10.95,strength:1.42,label:'重锤'}
  ];
  D.phases=[
    {t0:0,t1:4.0,name:'写成',color:'#6fb7e0'},
    {t0:4.0,t1:7.0,name:'成块',color:'#e8bd6f'},
    {t0:7.0,t1:11.6,name:'锻打',color:'#ff6a2a'},
    {t0:11.6,t1:15.0,name:'冷却',color:'#7fc8b0'}
  ];
  D.heatAt=function(t){
    if(t<4)return U.lerp(0.12,0.34,U.smoothstep(0,4,t));
    if(t<7)return U.lerp(0.34,1.0,U.smoothstep(4,7,t));
    if(t<11.6){
      let h=1.0;
      for(const im of D.impacts){const d=t-im.t;if(d>=0&&d<0.55)h+=im.strength*0.35*Math.exp(-d*7);}
      return Math.min(1.5,h);
    }
    return U.lerp(1.0,0.05,U.smoothstep(11.6,14.6,t));
  };
  D.shake=function(t){
    let s=0;
    for(const im of D.impacts){const d=t-im.t;if(d>=0&&d<0.7)s+=im.strength*Math.exp(-d*9)*Math.sin(d*62);}
    return s;
  };
  D.phaseAt=function(t){for(const p of D.phases)if(t>=p.t0&&t<p.t1)return p;return D.phases[3];};

  /* 关键帧工具 */
  function kf(prop,pairs){
    prop.kf=pairs.map(a=>MO.K(a[0],a[1],{eo:a[2]||'easeInOut',ei:a[2]||'easeInOut'}));
    prop.v=Array.isArray(pairs[0][1])?pairs[0][1].slice():pairs[0][1];
    return prop;
  }
  function mat(o){
    return {
      baseColor:MO.P(o.color||[.45,.47,.52],{kind:'color',label:'基础色'}),
      metalness:MO.P(o.metal==null?.9:o.metal,{kind:'slider',label:'金属度',min:0,max:1,step:.01}),
      roughness:MO.P(o.rough==null?.35:o.rough,{kind:'slider',label:'粗糙度',min:.02,max:1,step:.01}),
      emissive:MO.P(o.emissive||[1,.36,.09],{kind:'color',label:'发光色'}),
      emissiveInt:MO.P(o.emi==null?0:o.emi,{kind:'slider',label:'发光强度',min:0,max:4,step:.01}),
      opacity:MO.P(o.opacity==null?100:o.opacity,{kind:'slider',label:'不透明度',min:0,max:100,step:1})
    };
  }

  D.createProject=function(){
    const proj=MO.createProject();
    proj.name='锻字 · 示例工程';
    proj.assets.glyphChar='中';
    proj.assets.fontName='锻造黑体 · 内置笔画字形';
    proj.assets.glyphRange=GH.list().join(' ');

    const main=MO.createComp({name:'主合成 · 锻字',width:1920,height:1080,fps:30,duration:15,
      motionBlur:{enabled:true,shutterAngle:180,shutterPhase:-90}});
    main.workAreaStart=0;main.workAreaEnd=15;
    proj.comps.push(main);proj.activeCompId=main.id;

    /* 节点图（几何流） */
    proj.nodeGraphs.main=ND.demoGraph('中');

    /* ---------- 被多次引用的预合成：金属锭 ---------- */
    const ing=MO.createComp({name:'预合成 · 金属锭',width:800,height:800,fps:30,duration:15});
    const ingot=MO.createLayer('geometry','金属锭',{threeD:true});
    ingot.geometry={source:'box',w:1.15,h:0.42,d:0.8,bevel:0};
    ingot.material=mat({color:[.16,.14,.13],metal:.82,rough:.55,emi:0.06,emissive:[1,.4,.12]});
    ingot.transform.rotation.v=-14;
    kf(ingot.material.emissiveInt,[[0,0.16],[7,0.5],[11.6,0.18],[15,0.03]]);
    ing.layers.push(ingot);
    proj.comps.push(ing);

    /* ---------- 控制器（表达式） ---------- */
    const ctrl=MO.createLayer('null','控制器');
    ctrl.transform.rotation.expr='time * 24';
    ctrl.params['note']=MO.P(1,{label:'控制器：驱动材质与灯光',kind:'scalar'});
    main.layers.push(ctrl);

    /* ---------- 音色 ---------- */
    const audio=MO.createLayer('audio','音色 · 锻打');
    audio.audio={tone:MO.P(1,{label:'音色',kind:'slider',min:.2,max:3,step:.01}),
      baseFreq:MO.P(74,{label:'基频',kind:'slider',min:30,max:220,step:1,unit:'Hz'}),
      decay:MO.P(.65,{label:'衰减',kind:'slider',min:.1,max:2,step:.01}),
      noise:MO.P(.55,{label:'噪声量',kind:'slider',min:0,max:1,step:.01}),
      volume:MO.P(.55,{label:'音量',kind:'slider',min:0,max:1,step:.01})};
    main.layers.push(audio);

    /* ---------- 摄像机 ---------- */
    const cam=MO.createLayer('camera','摄像机 · 镜头',{threeD:true});
    cam.camera={
      pos:MO.P([0,3.6,6.9],{kind:'vec3',label:'位置'}),
      target:MO.P([0,-0.35,0],{kind:'vec3',label:'目标点'}),
      fov:MO.P(40,{kind:'slider',label:'视角',min:15,max:80,step:.5,unit:'°'}),
      focus:MO.P(7.6,{kind:'slider',label:'对焦距离',min:.5,max:30,step:.1}),
      aperture:MO.P(.10,{kind:'slider',label:'光圈',min:0,max:1,step:.005}),
      maxCoC:MO.P(5,{kind:'slider',label:'最大弥散',min:0,max:20,step:.1})
    };
    kf(cam.camera.pos,[[0,[0.55,0.95,6.6]],[4,[1.5,0.85,6.1]],[7,[2.25,1.25,5.8]],
      [9.5,[-1.35,2.45,5.55]],[11.6,[1.85,1.35,6.25]],[15,[1.3,0.9,7.05]]]);
    kf(cam.camera.target,[[0,[0,0,0]],[7,[0,0.05,0]],[9.5,[0,0.1,0]],[15,[0,0,0]]]);
    kf(cam.camera.fov,[[0,38],[4,37],[7,35],[9.5,34],[11.6,36],[15,38]]);
    kf(cam.camera.focus,[[0,6.8],[7,6.1],[9.5,5.9],[15,7.2]]);
    kf(cam.camera.aperture,[[0,.10],[7,.16],[9.5,.20],[11.6,.12],[15,.055]]);
    cam.camera.maxCoC.expr='linear(time, 7, 12, 4, 9)';
    main.layers.push(cam);

    /* ---------- 主光（平行，产生真实投影） ---------- */
    const key=MO.createLayer('light','主光 · 平行',{threeD:true});
    key.light={type:'parallel',
      dir:MO.P([-0.5,-0.9,-0.45],{kind:'vec3',label:'方向'}),
      color:MO.P([1.0,0.93,0.84],{kind:'color',label:'颜色'}),
      intensity:MO.P(1.9,{kind:'slider',label:'强度',min:0,max:4,step:.01}),
      castShadow:true};
    main.layers.push(key);

    /* ---------- 点光（炉火，表达式 wiggle 闪烁） ---------- */
    const pt=MO.createLayer('light','点光 · 炉火',{threeD:true});
    pt.light={type:'point',
      pos:MO.P([-2.6,0.7,2.2],{kind:'vec3',label:'位置'}),
      color:MO.P([1.0,0.44,0.16],{kind:'color',label:'颜色'}),
      intensity:MO.P(1.35,{kind:'slider',label:'强度',min:0,max:8,step:.01}),castShadow:false};
    pt.light.intensity.expr='wiggle(6, 0.18)';
    main.layers.push(pt);

    /* ---------- 空间场（同时作用于顶点与粒子） ---------- */
    const field=MO.createLayer('field','空间场 · 旋涡');
    field.fields=[{type:'vortex'}];
    field.params['field.position']=MO.P([0,0,0],{kind:'vec3',label:'场位置'});
    field.params['field.radius']=MO.P(2.2,{kind:'slider',label:'半径',min:.2,max:6,step:.05});
    field.params['field.strength']=MO.P(.55,{kind:'slider',label:'强度',min:0,max:3,step:.01});
    field.params['field.strength'].expr='0.35 + thisComp.layer("控制器").transform.rotation * 0.0012';
    main.layers.push(field);

    /* ---------- 砧 ---------- */
    const anvil=MO.createLayer('geometry','砧 · 锻台',{threeD:true});
    anvil.geometry={source:'box',w:5.6,h:0.5,d:2.3};
    anvil.transform.position=MO.P([0,-1.53],{label:'位置',spatial:true,kind:'vec2',unit:'px'});
    anvil.material=mat({color:[.085,.095,.11],metal:.78,rough:.72,emi:0.02,emissive:[1,.3,.08]});
    kf(anvil.material.emissiveInt,[[0,.01],[7,.06],[11.6,.03],[15,.005]]);
    anvil.receivesShadow=true;anvil.castsShadow=true;
    main.layers.push(anvil);

    /* ---------- 节点几何：铆钉（显示 / 发射 / 碰撞 / 变形） ---------- */
    const rivets=MO.createLayer('geometry','铆钉 · 节点几何',{threeD:true});
    rivets.geometry={source:'node',graphId:'main'};
    rivets.material=mat({color:[.26,.22,.18],metal:.85,rough:.42,emi:0.08,emissive:[1,.4,.12]});
    kf(rivets.material.emissiveInt,[[0,.05],[7,.35],[11.6,.12],[15,.02]]);
    rivets.castsShadow=true;
    main.layers.push(rivets);

    /* ---------- 主体：字块 ---------- */
    const glyph=MO.createLayer('geometry','字块 · 中',{threeD:true});
    glyph.geometry={source:'glyph',charSource:'asset',size:2.62,restY:0,rotateX:0};
    glyph.material=mat({color:[.20,.13,.09],metal:.75,rough:.55,emi:.28,emissive:[1,.38,.10]});
    glyph.params['geometry.depth']=MO.P(.11,{kind:'slider',label:'挤出深度',min:.02,max:1.2,step:.01});
    glyph.params['geometry.bevel']=MO.P(.045,{kind:'slider',label:'倒角',min:0,max:.2,step:.005});
    glyph.params['geometry.trim']=MO.P(.08,{kind:'slider',label:'书写进度',min:0,max:1,step:.01});
    glyph.params['geometry.size']=MO.P(2.62,{kind:'slider',label:'字号',min:1,max:5,step:.01});
    glyph.params['geometry.deform']=MO.P(1,{kind:'slider',label:'变形量',min:0,max:2,step:.01});
    kf(glyph.params['geometry.depth'],[[0,.11],[3.9,.13],[5.2,.34],[7,.56],[15,.56]]);
    kf(glyph.params['geometry.trim'],[[0,.2],[0.6,.32],[1.5,.56],[2.4,.8],[3.5,1],[15,1]]);
    kf(glyph.material.baseColor,[[0,[.20,.13,.09]],[4,[.30,.16,.08]],[7,[.62,.20,.06]],
      [11.6,[.52,.17,.05]],[14.6,[.44,.49,.56]],[15,[.46,.51,.58]]]);
    kf(glyph.material.emissiveInt,[[0,.9],[4,1.15],[7,2.15],[7.45,2.7],[8.3,2.15],
      [8.7,2.9],[9.4,2.2],[9.9,3.1],[10.5,2.3],[10.95,3.3],[11.6,1.9],
      [13,.6],[14.6,.06],[15,.04]]);
    kf(glyph.material.metalness,[[0,.42],[7,.72],[15,1.0]]);
    glyph.material.roughness.expr='ease(time, 11.5, 15, value, 0.24)';
    glyph.material.metalness.expr='clamp(0.55 + thisComp.layer("控制器").transform.rotation.valueAtTime(time-0.2).x * 0.0008, 0, 1)';
    // 三维微旋：跨图层引用 + 分量
    glyph.transform.rotationZ.expr='thisComp.layer("控制器").transform.rotation * 0.02';
    glyph.castsShadow=true;glyph.receivesShadow=true;
    // 可动画图钉（位置 / 旋转 / 缩放），锤击处共同变形而不撕裂
    const pinDefs=[{x:-0.72,y:0.62},{x:0.70,y:0.60},{x:0.02,y:-0.55}];
    pinDefs.forEach((p,i)=>{
      glyph.params['pin'+i+'.pos']=MO.P([p.x,p.y],{kind:'vec2',label:'图钉'+i+' 位置'});
      glyph.params['pin'+i+'.radius']=MO.P(0.85,{kind:'slider',label:'图钉'+i+' 半径',min:.2,max:3,step:.01});
      glyph.params['pin'+i+'.offset']=MO.P([0,0,0],{kind:'vec3',label:'图钉'+i+' 位移'});
      glyph.params['pin'+i+'.rot']=MO.P(0,{kind:'angle',label:'图钉'+i+' 旋转',step:1,unit:'°'});
      glyph.params['pin'+i+'.scale']=MO.P(1,{kind:'slider',label:'图钉'+i+' 缩放',min:.5,max:1.5,step:.01});
      const off=glyph.params['pin'+i+'.offset'],pairs=[[0,[0,0,0]]];
      D.impacts.forEach((im,j)=>{
        const s=im.strength*(0.05+0.02*(j%2));
        pairs.push([im.t-0.08,[0,0,0]]);
        pairs.push([im.t,[0,-s*0.85,-s*0.6]]);
        pairs.push([im.t+0.5,[0,-s*0.62,-s*0.45]]);
      });
      pairs.push([15,[0,-0.075,-0.05]]);
      kf(off,pairs);
      kf(glyph.params['pin'+i+'.rot'],D.impacts.reduce((a,im,j)=>a.concat([[im.t,0],[im.t+0.35,(j%2?1:-1)*3]]),[[0,0]]));
    });
    main.layers.push(glyph);

    /* ---------- 锤（预备 → 加速 → 收势） ---------- */
    const hammer=MO.createLayer('geometry','锤 · 锻打',{threeD:true});
    hammer.inPoint=6.85;hammer.outPoint=11.75;
    hammer.geometry={source:'hammer',headW:1.05,headH:0.5,headD:0.95,handleW:0.2,handleH:2.5};
    hammer.material=mat({color:[.22,.23,.26],metal:.9,rough:.34,emi:.06,emissive:[1,.35,.1]});
    kf(hammer.material.emissiveInt,[[6.85,.05],[7.45,.5],[9.9,.9],[11.7,.05]]);
    const hp=hammer.transform.position,hr=hammer.transform.rotation;
    const pp=[[6.85,[0,4.25]]],rr=[[6.85,-12]];
    D.impacts.forEach((im,j)=>{
      const T=im.t,hx=(j%2?0.42:-0.42)*im.strength;
      pp.push([T-0.62,[hx,4.25]]);
      pp.push([T-0.46,[hx,4.5]]);           // 预备（抬起）
      pp.push([T-0.14,[hx,3.3],'easeIn']); // 加速
      pp.push([T,[hx,1.62],'easeIn']);      // 命中（字块顶端）
      pp.push([T+0.12,[hx,2.45],'easeOut']);// 反弹
      pp.push([T+0.48,[hx,4.15],'easeInOut']);// 收势
      rr.push([T-0.62,-12]);rr.push([T-0.46,-16]);rr.push([T,7,'easeIn']);
      rr.push([T+0.15,-2]);rr.push([T+0.5,-12]);
    });
    pp.push([11.75,[0,4.25]]);rr.push([11.75,-12]);
    kf(hp,pp);kf(hr,rr);
    hammer.castsShadow=true;
    main.layers.push(hammer);

    /* ---------- 粒子：火星 / 余烬 / 拖尾 ---------- */
    const part=MO.createLayer('particle','粒子 · 火星',{threeD:true});
    part.particle={
      emitters:[{type:'surface',source:'glyph',count:70},{type:'curve',source:'rivets',count:20}],
      rate:MO.P(120,{kind:'slider',label:'发射率',min:0,max:400,step:1}),
      speed:MO.P(4.4,{kind:'slider',label:'初速度',min:0,max:12,step:.1}),
      life:MO.P(1.1,{kind:'slider',label:'寿命',min:.2,max:4,step:.05}),
      drag:MO.P(.55,{kind:'slider',label:'阻力',min:0,max:3,step:.01}),
      seed:MO.P(20240607,{kind:'number',label:'随机种子'}),
      gravity:MO.P(6.2,{kind:'slider',label:'重力',min:0,max:20,step:.1}),
      trailLength:MO.P(6,{kind:'slider',label:'拖尾长度',min:0,max:14,step:1}),
      impacts:D.impacts.map(i=>({t:i.t,strength:i.strength}))
    };
    main.layers.push(part);

    /* ---------- 预合成引用 ×2（同一合成、各自变换与时间重映射） ---------- */
    [0,1].forEach(i=>{
      const pc=MO.createLayer('precomp','金属锭 · '+(i?'右':'左'),{threeD:true});
      pc.precomp={compId:ing.id};
      pc.params['precomp.timeRemap']=MO.P(i?0.35:0,{kind:'slider',label:'时间重映射',min:-2,max:4,step:.01});
      pc.transform.position=MO.P([i?2.55:-2.55,-1.02],{label:'位置',spatial:true,kind:'vec2',unit:'px'});
      pc.transform.scale=MO.P([i?92:108,i?92:108,100],{label:'缩放',kind:'vec3',unit:'%'});
      pc.transform.rotation=MO.P(i?18:-18,{label:'旋转',kind:'angle',unit:'°'});
      if(i===0){pc.transform.rotation.kf=[MO.K(0,0),MO.K(3,12)];pc.transform.rotation.expr='loopOut("cycle")';}
      pc.params['precomp.note']=MO.P(1,{label:'引用同一预合成',kind:'scalar'});
      main.layers.push(pc);
    });

    /* ---------- 调整层（效果 + loopOut pingpong） ---------- */
    const adj=MO.createLayer('adjustment','调整 · 色调');
    adj.effects.push({name:'发光',type:'glow',enabled:true,params:{
      '强度':MO.P(.35,{kind:'slider',label:'强度',min:0,max:2,step:.01}),
      '半径':MO.P(22,{kind:'slider',label:'半径',min:0,max:80,step:1})}});
    adj.effects.push({name:'色相饱和度',type:'hsl',enabled:true,params:{
      '色相':MO.P(0,{kind:'slider',label:'色相',min:-180,max:180,step:1}),
      '饱和度':MO.P(0,{kind:'slider',label:'饱和度',min:-100,max:100,step:1}),
      '亮度':MO.P(0,{kind:'slider',label:'亮度',min:-100,max:100,step:1})}});
    const glow=adj.effects[0].params['强度'];
    glow.kf=[MO.K(0,.15,{eo:'easeInOut'}),MO.K(2.2,.55,{eo:'easeInOut'})];
    glow.expr='loopOut("pingpong")';
    adj.effects[1].params['色相'].expr='ease(time, 0, 15, 0, 14)';
    adj.blendMode='normal';adj.inPoint=0;adj.outPoint=15;
    main.layers.push(adj);

    return proj;
  };

  /* 换字：字形、字块、变形与火星全部按新字重新生成 */
  D.setChar=function(editor,ch){
    if(!GH.has(ch))return false;
    editor.project.assets.glyphChar=ch;
    const g=editor.project.nodeGraphs.main;
    if(g)g._char=ch;
    if(AE.scene)AE.scene.rebuild(editor);
    return true;
  };

  console.log('[forge] demo ready');
})();
