/* ============================================================
   nodes.js — 可视化程序节点图
   端口区分 标量 / 向量 / 颜色 / 几何 / 场 / 实体；
   节点按连线拓扑求值；一个几何输出可同时连接显示/变形/发射/碰撞。
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE,U=AE.util,G=AE.geom,GH=AE.glyphs;
  const N=AE.nodes={};

  N.PORT_COLORS={
    scalar:'#6fb7e0',vector:'#8fa8e8',color:'#e58f9a',geometry:'#67d6bd',
    field:'#bb92e0',mesh:'#e8bd6f',path:'#8ad0e0',any:'#9aa6b8'
  };
  N.PORT_LABELS={scalar:'标量',vector:'向量',color:'颜色',geometry:'几何',field:'场',mesh:'实体',path:'路径',any:'任意'};

  /* 节点定义：端口与参数（参数用于属性检查器） */
  N.DEFS={
    glyph:{title:'文字字形',cat:'输入',ins:[],outs:[{n:'轮廓',t:'geometry'}],
      params:{char:{kind:'select',label:'字符',options:()=>GH.list(),value:'中'},
        size:{kind:'slider',label:'字号',min:1,max:5,step:0.05,value:2.6}}},
    shape:{title:'路径形状',cat:'输入',ins:[],outs:[{n:'轮廓',t:'geometry'}],
      params:{kind:{kind:'select',label:'形状',options:['矩形','椭圆','星形','多边形'],value:'矩形'},
        w:{kind:'slider',label:'宽度',min:.2,max:6,step:.05,value:3.4},
        h:{kind:'slider',label:'高度',min:.2,max:6,step:.05,value:2.4},
        seed:{kind:'number',label:'随机种子',value:1}}},
    solid:{title:'实体几何',cat:'输入',ins:[],outs:[{n:'轮廓',t:'geometry'}],
      params:{w:{kind:'slider',label:'宽度',min:.2,max:6,step:.05,value:3.6},
        h:{kind:'slider',label:'高度',min:.2,max:6,step:.05,value:2.6}}},
    distribute:{title:'分布 / 重复器',cat:'几何',ins:[{n:'输入',t:'geometry'}],outs:[{n:'几何',t:'geometry'}],
      params:{count:{kind:'number',label:'数量',value:14,min:1,max:64},
        radius:{kind:'slider',label:'半径',min:0,max:4,step:.05,value:1.9},
        rot:{kind:'slider',label:'旋转',min:-180,max:180,step:1,value:0},
        scale:{kind:'slider',label:'缩放',min:.2,max:2,step:.01,value:1}}},
    transform:{title:'变换几何',cat:'几何',ins:[{n:'输入',t:'geometry'}],outs:[{n:'几何',t:'geometry'}],
      params:{tx:{kind:'slider',label:'X 位移',min:-4,max:4,step:.02,value:0},
        ty:{kind:'slider',label:'Y 位移',min:-4,max:4,step:.02,value:0},
        rot:{kind:'slider',label:'旋转',min:-180,max:180,step:1,value:0},
        scale:{kind:'slider',label:'缩放',min:.1,max:3,step:.01,value:1}}},
    trim:{title:'修剪 / 生长',cat:'几何',ins:[{n:'输入',t:'geometry'}],outs:[{n:'几何',t:'geometry'}],
      params:{amount:{kind:'slider',label:'长度',min:0,max:1,step:.01,value:1}}},
    boolean:{title:'布尔运算',cat:'几何',ins:[{n:'A',t:'geometry'},{n:'B',t:'geometry'}],outs:[{n:'几何',t:'geometry'}],
      params:{op:{kind:'select',label:'运算',options:['union 并集','difference 差集','intersect 交集','xor 异或'],value:'union 并集'}}},
    extrude:{title:'挤出实体',cat:'几何',ins:[{n:'轮廓',t:'geometry'}],outs:[{n:'实体',t:'mesh'}],
      params:{depth:{kind:'slider',label:'深度',min:.02,max:1.5,step:.01,value:.28},
        bevel:{kind:'slider',label:'倒角',min:0,max:.2,step:.005,value:.03}}},
    field:{title:'空间场',cat:'场',ins:[],outs:[{n:'场',t:'field'}],
      params:{type:{kind:'select',label:'类型',options:['noise 噪声','vortex 旋涡','attract 吸引','repel 排斥'],value:'noise 噪声'},
        strength:{kind:'slider',label:'强度',min:0,max:2,step:.01,value:.35},
        radius:{kind:'slider',label:'半径',min:.2,max:5,step:.05,value:1.6}}},
    noise:{title:'噪声标量',cat:'场',ins:[],outs:[{n:'标量',t:'scalar'}],
      params:{freq:{kind:'slider',label:'频率',min:0,max:5,step:.01,value:1},
        amp:{kind:'slider',label:'幅度',min:0,max:2,step:.01,value:.5}}},
    color:{title:'颜色',cat:'输入',ins:[],outs:[{n:'颜色',t:'color'}],
      params:{hex:{kind:'color',label:'颜色',value:'#ff8a3c'}}},
    math:{title:'标量运算',cat:'场',ins:[{n:'A',t:'scalar'},{n:'B',t:'scalar'}],outs:[{n:'标量',t:'scalar'}],
      params:{op:{kind:'select',label:'运算',options:['加','减','乘'],value:'加'}}},
    deform:{title:'场变形',cat:'几何',
      ins:[{n:'实体',t:'mesh'},{n:'场',t:'field'}],outs:[{n:'实体',t:'mesh'}],
      params:{amount:{kind:'slider',label:'强度',min:0,max:2,step:.01,value:.35}}},
    display:{title:'显示',cat:'输出',ins:[{n:'实体 / 几何',t:'any'}],outs:[],params:{}},
    emit:{title:'发射源',cat:'输出',ins:[{n:'几何',t:'any'}],outs:[],params:{}},
    collide:{title:'碰撞表面',cat:'输出',ins:[{n:'几何',t:'any'}],outs:[],params:{}},
    deformOut:{title:'变形目标',cat:'输出',ins:[{n:'实体',t:'mesh'}],outs:[],params:{}}
  };
  N.TYPES=Object.keys(N.DEFS);
  N.CATS=['输入','几何','场','输出'];

  N.createGraph=function(){return {nodes:[],edges:[],groups:[]};};
  N.addNode=function(graph,type,x,y,o){
    const def=N.DEFS[type];if(!def)return null;
    const params={};for(const k in def.params)params[k]=def.params[k].value;
    const node={id:U.uid('N'),type:type,title:def.title,x:x||80,y:y||80,params:params,collapsed:false,groupId:null};
    if(o&&o.id)node.id=o.id;
    graph.nodes.push(node);return node;
  };
  N.removeNode=function(graph,id){
    graph.nodes=graph.nodes.filter(n=>n.id!==id);
    graph.edges=graph.edges.filter(e=>e.from.node!==id&&e.to.node!==id);
  };
  N.duplicate=function(graph,id){
    const src=graph.nodes.find(n=>n.id===id);if(!src)return null;
    const n=N.addNode(graph,src.type,src.x+34,src.y+34);
    n.params=U.clone(src.params);n.title=src.title+' 副本';return n;
  };
  N.connect=function(graph,fromNode,fromPort,toNode,toPort){
    // 输入端口单连接
    graph.edges=graph.edges.filter(e=>!(e.to.node===toNode&&e.to.port===toPort));
    const id=U.uid('E');
    graph.edges.push({id:id,from:{node:fromNode,port:fromPort},to:{node:toNode,port:toPort}});
    return id;
  };
  N.disconnect=function(graph,edgeId){graph.edges=graph.edges.filter(e=>e.id!==edgeId);};
  N.group=function(graph,ids,title){
    const id=U.uid('GRP');graph.groups.push({id:id,title:title||'节点组',nodeIds:ids.slice()});
    ids.forEach(i=>{const n=graph.nodes.find(x=>x.id===i);if(n)n.groupId=id;});
    return id;
  };

  /* 输入值查找 */
  function input(graph,edgeList,node,port,t){
    const e=edgeList.find(e=>e.to.node===node.id&&e.to.port===port);
    if(!e)return null;
    return edgeList._out?edgeList._out[e.from.node+':'+e.from.port]:null;
  }

  /* ---------------- 拓扑求值 ---------------- */
  N.evaluate=function(graph,ctx){
    ctx=ctx||{};const t=ctx.t||0,char=ctx.glyphChar||'中',size=ctx.size||2.6;
    const res={meshes:[],emit:[],collide:[],deformTargets:[],values:{},errors:[],fields:[]};
    const nodes=graph.nodes,edges=graph.edges;
    // 依赖排序（Kahn，带环保护）
    const indeg={},adj={};
    nodes.forEach(n=>{indeg[n.id]=0;adj[n.id]=[];});
    edges.forEach(e=>{if(indeg[e.to.node]!=null){indeg[e.to.node]++;adj[e.from.node].push(e.to.node);}});
    const q=nodes.filter(n=>indeg[n.id]===0).map(n=>n.id),order=[];
    while(q.length){const id=q.shift();order.push(id);for(const nx of adj[id]){if(--indeg[nx]===0)q.push(nx);}}
    if(order.length<nodes.length){res.errors.push('节点图中存在循环连线，已跳过循环部分');}
    const outs={}; // key: nodeId:portName
    const cacheKey=(id,port)=>id+':'+port;
    const byId={};nodes.forEach(n=>byId[n.id]=n);
    const get=(node,port)=>{
      const e=edges.find(x=>x.to.node===node.id&&x.to.port===port);
      if(!e)return null;
      return outs[cacheKey(e.from.node,e.from.port)]||null;
    };
    const contoursOf=(v)=>{
      if(!v)return null;
      if(v.type==='contours')return v.rings;
      if(v.type==='geometry')return v.rings;
      if(v.type==='mesh')return null;
      return v.rings||null;
    };
    for(const id of order){
      const n=byId[id];if(!n)continue;
      const def=N.DEFS[n.type],P=n.params,o={};
      try{
        switch(n.type){
          case 'glyph':{
            const rings=GH.contours(P.char,size);
            o['轮廓']={type:'contours',rings:rings};
            break;
          }
          case 'shape':{
            let rings;
            const k=(P.kind||'').indexOf('椭圆')>=0?G.ellipse(0,0,P.w/2,P.h/2,40)
              :(P.kind||'').indexOf('星形')>=0?G.star(0,0,P.w/2,P.w/4,6)
              :(P.kind||'').indexOf('多边形')>=0?G.regular(0,0,P.w/2,6)
              :G.rect(-P.w/2,-P.h/2,P.w,P.h);
            rings=[k];
            o['轮廓']={type:'contours',rings:rings};
            break;
          }
          case 'solid':{
            o['轮廓']={type:'contours',rings:[G.rect(-P.w/2,-P.h/2,P.w,P.h)]};
            break;
          }
          case 'distribute':{
            const src=contoursOf(get(n,'输入'))||[G.ellipse(0,0,.12,.12,12)];
            const count=Math.max(1,Math.round(P.count)),rings=[];
            for(let i=0;i<count;i++){
              const a=i/count*U.TAU+U.rad(P.rot),rr=P.radius;
              const m=U.mat4.mulAll(U.mat4.translation(Math.cos(a)*rr,Math.sin(a)*rr,0),
                U.mat4.rotZ(a),U.mat4.scaling(P.scale,P.scale,1));
              for(const ring of src)rings.push(ring.map(p=>{const q=U.mat4.transformPoint(m,[p[0],p[1],0]);return [q[0],q[1]];}));
            }
            o['几何']={type:'contours',rings:rings};
            break;
          }
          case 'transform':{
            const src=contoursOf(get(n,'输入'));
            const m=U.mat4.mulAll(U.mat4.translation(P.tx,P.ty,0),U.mat4.rotZ(U.rad(P.rot)),U.mat4.scaling(P.scale,P.scale,1));
            const rings=src?src.map(ring=>ring.map(p=>{const q=U.mat4.transformPoint(m,[p[0],p[1],0]);return [q[0],q[1]];})):[];
            o['几何']={type:'contours',rings:rings};
            break;
          }
          case 'trim':{
            const src=contoursOf(get(n,'输入'))||[];
            const a=U.clamp(P.amount,0,1);
            const rings=src.map(ring=>{
              let cx=0,cy=0;for(const p of ring){cx+=p[0];cy+=p[1];}cx/=ring.length;cy/=ring.length;
              return ring.map(p=>[cx+(p[0]-cx)*Math.max(.001,a),cy+(p[1]-cy)*Math.max(.001,a)]);
            });
            o['几何']={type:'contours',rings:rings};
            break;
          }
          case 'boolean':{
            const A=contoursOf(get(n,'A'))||[],B=contoursOf(get(n,'B'))||[];
            const op=(P.op||'').indexOf('差集')>=0?'difference':(P.op||'').indexOf('交集')>=0?'intersect':(P.op||'').indexOf('异或')>=0?'xor':'union';
            const rings=G.boolean(A,B,op);
            o['几何']={type:'contours',rings:rings};
            break;
          }
          case 'extrude':{
            const rings=contoursOf(get(n,'轮廓'))||[];
            const mesh=G.extrude(rings,P.depth,P.bevel);
            o['实体']={type:'mesh',mesh:mesh,rings:rings};
            break;
          }
          case 'field':{
            const type=(P.type||'').indexOf('旋涡')>=0?'vortex':(P.type||'').indexOf('吸引')>=0?'attract':(P.type||'').indexOf('排斥')>=0?'repel':'noise';
            const f={type:type,strength:P.strength,radius:P.radius,position:[0,0,0]};
            res.fields.push(f);o['场']={type:'field',field:f};
            break;
          }
          case 'noise':{
            o['标量']={type:'scalar',value:U.noise(t*P.freq+1.3)*P.amp};
            break;
          }
          case 'color':{
            o['颜色']={type:'color',value:U.hex2rgb(P.hex)};
            break;
          }
          case 'math':{
            const a=get(n,'A'),b=get(n,'B');
            const av=a&&a.value!=null?a.value:0,bv=b&&b.value!=null?b.value:0;
            const v=(P.op==='减')?av-bv:(P.op==='乘')?av*bv:av+bv;
            o['标量']={type:'scalar',value:v};
            break;
          }
          case 'deform':{
            const src=get(n,'实体'),fld=get(n,'场');
            let mesh=src&&src.mesh?src.mesh.clone?src.mesh.clone():null:null;
            if(!mesh&&src&&src.mesh){
              const m=new G.Mesh();m.pos=src.mesh.pos.slice();m.nrm=src.mesh.nrm.slice();m.idx=src.mesh.idx.slice();mesh=m;
            }
            if(mesh&&fld&&fld.field){
              G.deform(mesh,{fields:[fld.field],t:t,amp:P.amount});
            }
            o['实体']={type:'mesh',mesh:mesh,rings:src?src.rings:null};
            break;
          }
          case 'display':{
            const v=get(n,'实体 / 几何');
            if(v){
              if(v.mesh)res.meshes.push({mesh:v.mesh,node:n.id});
              else if(v.rings)res.meshes.push({rings:v.rings,node:n.id});
            }
            break;
          }
          case 'emit':{
            const v=get(n,'几何');if(v)res.emit.push({rings:v.rings||(v.mesh?[]:[]),mesh:v.mesh,node:n.id});
            break;
          }
          case 'collide':{
            const v=get(n,'几何');if(v)res.collide.push({rings:v.rings,node:n.id});
            break;
          }
          case 'deformOut':{
            const v=get(n,'实体');if(v)res.deformTargets.push({mesh:v.mesh,node:n.id});
            break;
          }
        }
      }catch(e){res.errors.push(n.title+': '+e.message);}
      for(const k in o)outs[cacheKey(n.id,k)]=o[k];
      res.values[n.id]={outputs:o,title:n.title,type:n.type,params:P};
    }
    // 输出端口名可能与 def 不同，做一次别名映射
    for(const id in res.values){
      const n=byId[id];if(!n)continue;
      const d=N.DEFS[n.type];
      d.outs.forEach(oprt=>{
        const k=cacheKey(id,oprt.n);
        if(!outs[k]){
          // 有些节点用 def 端口名，尝试第一个输出
          const first=Object.keys(outs).find(x=>x.indexOf(id+':')===0);
          if(first)outs[k]=outs[first];
        }
      });
    }
    return res;
  };

  /* ---------------- 示例节点图（几何 → 显示 / 发射 / 碰撞 / 变形） ---------------- */
  N.demoGraph=function(char){
    const g=N.createGraph();
    const shape=N.addNode(g,'shape',60,90);shape.params.kind='矩形';shape.params.w=3.5;shape.params.h=2.5;
    const field=N.addNode(g,'field',60,300);field.params.type='noise 噪声';field.params.strength=.28;
    const dot=N.addNode(g,'shape',330,60);dot.params.kind='椭圆';dot.params.w=.24;dot.params.h=.24;
    const dist=N.addNode(g,'distribute',330,200);dist.params.count=18;dist.params.radius=2.05;dist.params.scale=1;
    const extr=N.addNode(g,'extrude',560,180);extr.params.depth=.22;extr.params.bevel=.03;
    const def=N.addNode(g,'deform',560,360);def.params.amount=.3;
    const disp=N.addNode(g,'display',810,120);
    const emit=N.addNode(g,'emit',810,250);
    const col=N.addNode(g,'collide',810,360);
    const dout=N.addNode(g,'deformOut',810,470);
    N.connect(g,dot.id,'轮廓',dist.id,'输入');
    N.connect(g,dist.id,'几何',extr.id,'轮廓');
    N.connect(g,extr.id,'实体',def.id,'实体');
    N.connect(g,field.id,'场',def.id,'场');
    N.connect(g,def.id,'实体',disp.id,'实体 / 几何');
    N.connect(g,def.id,'实体',dout.id,'实体');
    N.connect(g,dist.id,'几何',emit.id,'几何');
    N.connect(g,shape.id,'轮廓',col.id,'几何');
    N.group(g,[dot.id,dist.id,extr.id],'铆钉组');
    g._demo=true;g._char=char;
    return g;
  };

  console.log('[forge] nodes ready');
})();
