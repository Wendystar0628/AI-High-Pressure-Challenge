/* ============================================================
   glyphs.js — 内置「锻造黑体」笔画字形库
   字形以笔画折线（归一化 0..1，y 向下）定义，轮廓可转为几何参与
   形变、变形与三维挤出。可用字符范围明确列出，可随时换字重新生成。
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE,U=AE.util,G=AE.geom;
  const GH=AE.glyphs={};

  const W=0.15;
  /* 每笔画: { p:[[x,y]...], w:宽度, rev:是否从末端书写 } */
  const CH={
    '中':{name:'zhōng · 中心／命中',strokes:[
      {p:[[0.28,0.30],[0.72,0.30]],w:W},
      {p:[[0.28,0.30],[0.28,0.70]],w:W},
      {p:[[0.72,0.30],[0.72,0.70]],w:W},
      {p:[[0.28,0.70],[0.72,0.70]],w:W},
      {p:[[0.50,0.10],[0.50,0.90]],w:W+0.01}
    ]},
    '山':{name:'shān · 山岳',strokes:[
      {p:[[0.50,0.15],[0.50,0.80]],w:W},
      {p:[[0.24,0.34],[0.24,0.80]],w:W},
      {p:[[0.76,0.34],[0.76,0.80]],w:W},
      {p:[[0.16,0.80],[0.84,0.80]],w:W+0.01}
    ]},
    '王':{name:'wáng · 王',strokes:[
      {p:[[0.22,0.24],[0.78,0.24]],w:W},
      {p:[[0.30,0.50],[0.70,0.50]],w:W},
      {p:[[0.16,0.78],[0.84,0.78]],w:W+0.01},
      {p:[[0.50,0.24],[0.50,0.78]],w:W}
    ]},
    '田':{name:'tián · 田',strokes:[
      {p:[[0.22,0.20],[0.78,0.20]],w:W},
      {p:[[0.22,0.20],[0.22,0.80]],w:W},
      {p:[[0.78,0.20],[0.78,0.80]],w:W},
      {p:[[0.22,0.80],[0.78,0.80]],w:W+0.01},
      {p:[[0.22,0.50],[0.78,0.50]],w:W},
      {p:[[0.50,0.20],[0.50,0.80]],w:W}
    ]},
    '火':{name:'huǒ · 火',strokes:[
      {p:[[0.30,0.22],[0.24,0.40]],w:W-0.01,rev:true},
      {p:[[0.70,0.22],[0.76,0.40]],w:W-0.01},
      {p:[[0.50,0.20],[0.26,0.82]],w:W},
      {p:[[0.44,0.42],[0.78,0.82]],w:W}
    ]},
    '永':{name:'yǒng · 永字八法',strokes:[
      {p:[[0.50,0.08],[0.53,0.18]],w:W-0.02},
      {p:[[0.30,0.28],[0.62,0.28]],w:W-0.02},
      {p:[[0.50,0.20],[0.50,0.72],[0.43,0.82]],w:W},
      {p:[[0.28,0.56],[0.46,0.44]],w:W-0.02},
      {p:[[0.42,0.42],[0.22,0.80]],w:W-0.01},
      {p:[[0.48,0.46],[0.40,0.68]],w:W-0.02},
      {p:[[0.54,0.48],[0.80,0.82]],w:W}
    ]},
    '大':{name:'dà · 大',strokes:[
      {p:[[0.22,0.36],[0.78,0.36]],w:W},
      {p:[[0.50,0.18],[0.28,0.82]],w:W},
      {p:[[0.48,0.44],[0.78,0.82]],w:W}
    ]},
    '十':{name:'shí · 十',strokes:[
      {p:[[0.18,0.50],[0.82,0.50]],w:W+0.01},
      {p:[[0.50,0.16],[0.50,0.84]],w:W+0.01}
    ]},
    '工':{name:'gōng · 工',strokes:[
      {p:[[0.20,0.26],[0.80,0.26]],w:W},
      {p:[[0.50,0.26],[0.50,0.74]],w:W},
      {p:[[0.16,0.76],[0.84,0.76]],w:W+0.01}
    ]},
    '力':{name:'lì · 力',strokes:[
      {p:[[0.30,0.24],[0.68,0.24],[0.61,0.56],[0.34,0.82]],w:W},
      {p:[[0.50,0.28],[0.26,0.80]],w:W-0.01}
    ]},
    '口':{name:'kǒu · 口',strokes:[
      {p:[[0.28,0.28],[0.72,0.28]],w:W},
      {p:[[0.28,0.28],[0.28,0.72]],w:W},
      {p:[[0.72,0.28],[0.72,0.72]],w:W},
      {p:[[0.28,0.72],[0.72,0.72]],w:W}
    ]},
    '日':{name:'rì · 日',strokes:[
      {p:[[0.30,0.16],[0.70,0.16]],w:W},
      {p:[[0.30,0.16],[0.30,0.84]],w:W},
      {p:[[0.70,0.16],[0.70,0.84]],w:W},
      {p:[[0.30,0.84],[0.70,0.84]],w:W},
      {p:[[0.30,0.50],[0.70,0.50]],w:W}
    ]},
    '刃':{name:'rèn · 刃',strokes:[
      {p:[[0.32,0.20],[0.64,0.20],[0.57,0.58],[0.30,0.82]],w:W},
      {p:[[0.62,0.38],[0.72,0.50]],w:W-0.03}
    ]}
  };
  GH.chars=CH;
  GH.list=()=>Object.keys(CH);
  GH.has=c=>!!CH[c];
  GH.info=c=>CH[c]||CH['中'];
  GH.defaultChar='中';

  /* 归一化坐标 → 世界（y 向上） */
  GH.toWorld=(p,size)=>[(p[0]-0.5)*size,(0.5-p[1])*size];

  GH.strokes=function(char,size){
    size=size||2.6;
    const g=GH.info(char);
    return g.strokes.map(s=>({
      pts:s.p.map(p=>GH.toWorld(p,size)),
      width:(s.w||W)*size,
      fromEnd:!!s.rev
    }));
  };
  GH.count=function(char){return GH.info(char).strokes.length;};

  /* 2D 轮廓（用于形状、布尔、路径形变、矢量描边预览） */
  GH.contours=function(char,size){
    size=size||2.6;
    return GH.strokes(char,size).map(s=>G.strokeOutline(s.pts,s.width,6));
  };

  /* 挤出实体；trim 可为标量或每笔画数组（0..1，沿实际弧长推进） */
  GH.mesh=function(char,o){
    o=o||{};
    const size=o.size||2.6,depth=o.depth==null?0.5:o.depth,bevel=o.bevel==null?0.05:o.bevel;
    const strokes=GH.strokes(char,size);
    return G.extrudeStrokes(strokes,depth,bevel,o.trim);
  };

  /* 锤击 / 火星发射的候选点：取笔画中点与端点（换字后自动改变） */
  GH.impactPoints=function(char,size){
    size=size||2.6;
    const s=GH.strokes(char,size),pts=[];
    for(const st of s){
      const P=st.pts;
      for(let i=0;i<P.length-1;i++){
        const a=P[i],b=P[i+1];
        pts.push([(a[0]+b[0])/2,(a[1]+b[1])/2]);
      }
      if(P.length===2)pts.push([(P[0][0]+P[1][0])/2,(P[0][1]+P[1][1])/2]);
    }
    return pts;
  };
  /* 命中点：选出画面里靠上、分布开的若干点 */
  GH.pickImpacts=function(char,size,n){
    const all=GH.impactPoints(char,size);
    // 优先 y 较大（世界坐标上方）且 x 分散
    const sorted=all.slice().sort((a,b)=>b[1]-a[1]);
    const out=[];
    for(const p of sorted){
      if(out.length>=n)break;
      if(out.every(q=>Math.hypot(q[0]-p[0],q[1]-p[1])>size*0.28))out.push(p);
    }
    for(const p of all){if(out.length>=n)break;out.push(p);}
    return out.slice(0,n);
  };

  console.log('[forge] glyphs ready · 可用字符:',GH.list().join(''));
})();
