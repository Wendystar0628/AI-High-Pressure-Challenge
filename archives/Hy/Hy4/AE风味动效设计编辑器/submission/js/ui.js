/* ============================================================
   ui.js — 编辑器界面（简体中文）
   菜单 / 工具栏 / 项目 / 字形库 / 声音 / 属性 / 对齐 /
   时间轴 / 播放控制 / 画布叠加 / 快捷键 / 模态框 / 撤销状态
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE,U=AE.util,MO=AE.model,GH=AE.glyphs,D=AE.demo;
  const UI=AE.ui={};
  const $=id=>document.getElementById(id);
  function h(tag,attrs){
    const e=document.createElement(tag);
    attrs=attrs||{};
    for(const k in attrs){
      if(k==='class')e.className=attrs[k];
      else if(k==='html')e.innerHTML=attrs[k];
      else if(k==='text')e.textContent=attrs[k];
      else if(k.indexOf('on')===0&&typeof attrs[k]==='function')e.addEventListener(k.slice(2),attrs[k]);
      else if(k==='style')e.setAttribute('style',attrs[k]);
      else if(attrs[k]!==null&&attrs[k]!==undefined)e.setAttribute(k,attrs[k]);
    }
    return e;
  }
  function num(v,n){return (typeof v==='number'&&isFinite(v))?v.toFixed(n==null?2:n):String(v);}

  /* ---------------- toast / modal / context ---------------- */
  UI.toast=function(msg){
    const t=h('div',{class:'toast',text:msg});
    $('toastRoot').appendChild(t);
    setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),320);},2200);
  };
  UI.modal=function(title,html,actions){
    const root=$('modalRoot');root.innerHTML='';
    const mask=h('div',{class:'modal-mask'});
    const m=h('div',{class:'modal'});
    m.appendChild(h('h3',{text:title}));
    const body=h('div',{class:'m-body',html:html});m.appendChild(body);
    const foot=h('div',{class:'m-foot'});
    (actions||[{label:'关闭'}]).forEach(a=>{
      foot.appendChild(h('button',{class:'tbtn '+(a.cls||''),text:a.label,onclick:()=>{if(a.fn)a.fn(m);if(a.close!==false)root.innerHTML='';}}));
    });
    m.appendChild(foot);mask.appendChild(m);root.appendChild(mask);
    mask.addEventListener('mousedown',e=>{if(e.target===mask)root.innerHTML='';});
    return {body:body,root:root,close:()=>root.innerHTML=''};
  };
  let ctxEl=null;
  UI.ctxmenu=function(x,y,items){
    if(ctxEl)ctxEl.remove();
    const m=h('div',{class:'ctxmenu'});
    items.forEach(it=>{
      if(it.sep){m.appendChild(h('hr'));return;}
      m.appendChild(h('button',{html:'<span>'+it.label+'</span><span class="kc">'+(it.key||'')+'</span>',
        onclick:()=>{m.remove();ctxEl=null;if(it.fn)it.fn();}}));
    });
    m.style.left=Math.min(x,innerWidth-200)+'px';m.style.top=Math.min(y,innerHeight-320)+'px';
    document.body.appendChild(m);ctxEl=m;
    const kill=e=>{if(!m.contains(e.target)){m.remove();ctxEl=null;document.removeEventListener('mousedown',kill);}};
    setTimeout(()=>document.addEventListener('mousedown',kill),0);
  };

  /* ---------------- 画布尺寸 ---------------- */
  UI.sizeCanvas=function(ed){
    const wrap=$('viewComp');
    const cw=Math.max(200,wrap.clientWidth-46),chh=Math.max(120,wrap.clientHeight-46);
    const comp=ed.comp,ar=comp.width/comp.height;
    let w=cw,hh=cw/ar;if(hh>chh){hh=chh;w=chh*ar;}
    let z=ed.zoom;if(z==='fit')z=1;
    w=Math.round(w*z);hh=Math.round(hh*z);
    const gl=$('glCanvas'),ov=$('overlayCanvas'),st=$('canvasStage');
    st.style.width=w+'px';st.style.height=hh+'px';
    [gl,ov].forEach(c=>{c.width=w;c.height=hh;c.style.width=w+'px';c.style.height=hh+'px';});
    ed.canvasW=w;ed.canvasH=hh;
  };

  /* ---------------- 摄像机投影（叠加层） ---------------- */
  function cameraOf(ed){
    const st=ed._fs||MO.frameState(ed.project,ed.comp,ed.time);
    let cam={pos:[0,3.6,6.9],target:[0,-.35,0],fov:40,focus:7.6,aperture:.1,maxCoC:5,near:.1,far:60};
    for(const o of st.layers){
      if(o.layer.type!=='camera'||!o.enabled)continue;
      const v=o.vals;
      cam={pos:U.ensureVec(v['camera.pos'],3),target:U.ensureVec(v['camera.target'],3),
        fov:v['camera.fov']||40,focus:v['camera.focus']||7.6,aperture:v['camera.aperture']==null?.1:v['camera.aperture'],
        maxCoC:v['camera.maxCoC']||5,near:.1,far:60};break;
    }
    return cam;
  }
  function project(ed,p,W,H){
    const cam=cameraOf(ed);
    const P=U.mat4.perspective(U.rad(cam.fov),W/H,cam.near,cam.far);
    const V=U.mat4.lookAt(cam.pos,cam.target,[0,1,0]);
    const VP=U.mat4.mul(P,V);
    const c=U.mat4.transformPoint(VP,p);
    if(c[3]<=0)return null;
    return [(c[0]/c[3]*.5+.5)*W,(1-(c[1]/c[3]*.5+.5))*H,c[2]/c[3]];
  }

  /* ---------------- 画布叠加层 ---------------- */
  UI.drawOverlay=function(ed){
    const c=$('overlayCanvas'),ctx=c.getContext('2d'),W=c.width,H=c.height;
    ctx.clearRect(0,0,W,H);
    const show=ed.showOverlay;
    // 网格
    if(ed.showGrid){
      ctx.strokeStyle='rgba(120,150,180,.10)';ctx.lineWidth=1;
      for(let i=1;i<10;i++){const x=W*i/10,y=H*i/10;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      ctx.strokeStyle='rgba(255,150,70,.16)';
      ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();
    }
    // 安全框
    ctx.strokeStyle='rgba(255,255,255,.10)';ctx.setLineDash([5,5]);
    ctx.strokeRect(W*.05,H*.05,W*.9,H*.9);ctx.setLineDash([]);
    if(!show)return;
    // 场范围 / 灯光 / 摄像机 辅助
    const fs=ed._fs;
    if(fs){
      for(const o of fs.layers){
        const L=o.layer;
        if(L.type==='field'&&o.enabled){
          const p=project(ed,[0,0,0],W,H);
          const r=project(ed,[1.6,0,0],W,H);
          if(p&&r){const rad=Math.abs(r[0]-p[0]);ctx.strokeStyle='rgba(180,140,230,.45)';ctx.setLineDash([4,4]);
            ctx.beginPath();ctx.arc(p[0],p[1],rad,0,U.TAU);ctx.stroke();ctx.setLineDash([]);
            ctx.fillStyle='#c9a0e8';ctx.font='10px monospace';ctx.fillText('空间场 · 旋涡',p[0]+rad+4,p[1]);}
        }
      }
    }
    // 选择框 / 手柄 / 锚点 / 运动路径
    const sels=ed.selectedLayers||[];
    for(const id of sels){
      const L=ed.comp.layers.find(l=>l.id===id);if(!L)continue;
      const col=L.color||'#ff9d4d';
      // 以投影的中心与尺寸绘制选择框
      const center=project(ed,[0,-0.4,0],W,H);
      if(!center)continue;
      const e1=project(ed,[1.5,-0.4,0],W,H),e2=project(ed,[0,1.1,0],W,H);
      let bw=Math.abs(e1?e1[0]-center[0]:W*.2),bh=Math.abs(e2?e2[1]-center[1]:H*.3);
      bw=Math.max(40,bw*1.1);bh=Math.max(40,bh*1.1);
      const x=center[0]-bw/2,y=center[1]-bh/2;
      ctx.strokeStyle=col;ctx.lineWidth=1.2;
      ctx.strokeRect(x,y,bw,bh);
      // 8 手柄
      const hp=[[x,y],[x+bw/2,y],[x+bw,y],[x,y+bh/2],[x+bw,y+bh/2],[x,y+bh],[x+bw/2,y+bh],[x+bw,y+bh]];
      ctx.fillStyle=col;
      hp.forEach(p=>{ctx.fillRect(p[0]-3,p[1]-3,6,6);ctx.strokeStyle='#0b0d11';ctx.lineWidth=1;ctx.strokeRect(p[0]-3,p[1]-3,6,6);});
      // 旋转手柄
      ctx.beginPath();ctx.moveTo(x+bw/2,y);ctx.lineTo(x+bw/2,y-22);ctx.strokeStyle=col;ctx.stroke();
      ctx.beginPath();ctx.arc(x+bw/2,y-24,4,0,U.TAU);ctx.fill();
      // 锚点
      ctx.strokeStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.arc(center[0],center[1],4,0,U.TAU);ctx.stroke();
      ctx.beginPath();ctx.moveTo(center[0]-7,center[1]);ctx.lineTo(center[0]+7,center[1]);ctx.moveTo(center[0],center[1]-7);ctx.lineTo(center[0],center[1]+7);ctx.stroke();
      // 运动路径（位置关键帧的空间贝塞尔）
      const posProp=L.transform.position;
      if(posProp&&posProp.kf.length>1){
        ctx.strokeStyle='rgba(120,220,180,.75)';ctx.lineWidth=1.5;ctx.beginPath();
        posProp.kf.forEach((k,i)=>{
          const p=project(ed,[k.v[0]||0,k.v[1]||0,0],W,H);
          if(!p)return;
          if(i===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);
        });
        ctx.stroke();
        posProp.kf.forEach(k=>{
          const p=project(ed,[k.v[0]||0,k.v[1]||0,0],W,H);if(!p)return;
          ctx.fillStyle='#7fe0b4';ctx.fillRect(p[0]-3,p[1]-3,6,6);
        });
      }
      ctx.fillStyle=col;ctx.font='11px "Microsoft YaHei",sans-serif';
      ctx.fillText('▣ '+L.name,x,y-6);
    }
    // 阶段标签
    const ph=D.phaseAt?D.phaseAt(ed.time):null;
    if(ph){
      ctx.fillStyle='rgba(10,12,16,.72)';ctx.fillRect(W-158,10,148,24);
      ctx.fillStyle=ph.color;ctx.font='12px "Microsoft YaHei",sans-serif';
      ctx.fillText('阶段 · '+ph.name,W-148,27);
    }
  };

  /* ---------------- 渲染一帧（WebGL + 叠加 + 界面同步） ---------------- */
  UI.renderFrame=function(ed){
    if(!ed.comp||!ed.renderer)return;
    ed._fs=MO.frameState(ed.project,ed.comp,ed.time);
    const sceneAt=tt=>AE.scene.build(ed,ed.comp,tt);
    const mb=ed.comp.motionBlur||{enabled:false,shutterAngle:180};
    const N=(ed.mbEnabled&&mb.enabled)?3:1;
    const shutter=(mb.shutterAngle/360)*(1/ed.comp.fps);
    try{ed.renderer.render(sceneAt,{time:ed.time,mbSamples:N,shutter:shutter});}
    catch(e){console.error('render',e);}
    UI.drawOverlay(ed);
    UI.syncTime(ed);
    if(AE.views&&AE.views.onFrame)AE.views.onFrame(ed);
  };

  /* ---------------- 时间同步 ---------------- */
  UI.syncTime=function(ed){
    const fps=ed.comp.fps,t=ed.time;
    $('timeCode').textContent=U.timecode(t*fps,fps);
    $('fpsLbl').textContent=fps+' fps';
    $('compLabel').textContent=ed.comp.name+'  ·  '+ed.comp.width+'×'+ed.comp.height+'  ·  '+num(t,2)+'s';
    $('tlPlayhead').style.display='none';
    // 属性当前值
    if(ed._propInputs){
      for(const it of ed._propInputs){
        const v=MO.valueAtTime(ed.project,ed.comp,it.layer,it.path,t);
        const arr=U.ensureVec(v,it.dim);
        if(it.el&&document.contains(it.el)&&document.activeElement!==it.el)it.el.value=num(arr[it.idx],it.kind==='angle'?1:(it.kind==='color'?2:2));
      }
    }
    // 声音电平
    const lv=AE.audio.level(t);
    const m=ed._meter;if(m)m.style.width=(lv*100).toFixed(0)+'%';
    if(ed._wave)UI.drawWave(ed,t);
    // 表达式错误提示
    const errs=MO.lastErrors||{},keys=Object.keys(errs);
    $('statusExpr').textContent=keys.length?('表达式：'+errs[keys[0]]):'';
    // 曲线 / 节点视图播放头
    if(AE.views&&AE.views.syncTime)AE.views.syncTime(ed);
    // 时间轴重绘
    UI.drawTimeline(ed);
  };

  UI.drawWave=function(ed,t){
    const c=ed._wave,ctx=c.getContext('2d'),W=c.width,H=c.height;
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,.06)';ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();
    ctx.strokeStyle='#ff9d4d';ctx.lineWidth=1.3;ctx.beginPath();
    for(let x=0;x<W;x++){
      const tt=t-2+(x/W)*4;
      const v=AE.audio.waveSample(tt,x,W);
      const y=H/2-v*H*.42;
      if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.fillStyle='rgba(255,157,77,.10)';ctx.lineTo(W,H/2);ctx.lineTo(0,H/2);ctx.fill();
  };

  /* ---------------- 菜单 ---------------- */
  const MENUS={
    '文件':[['新建工程','Ctrl+N',()=>UI.newProject],['打开工程…','Ctrl+O',()=>UI.openProject],['保存工程','Ctrl+S',()=>UI.saveProject],
      ['导出工程 JSON','',()=>UI.saveProject],['sep'],['关于本编辑器','',()=>UI.help]],
    '编辑':[['撤销','Ctrl+Z',()=>UI.undo],['重做','Ctrl+Y / Ctrl+Shift+Z',()=>UI.redo],['sep'],
      ['复制图层','Ctrl+D',()=>UI.duplicateLayer],['删除图层','Delete',()=>UI.deleteLayer],['sep'],
      ['框选关键帧','',()=>()=>UI.toast('在时间轴轨道上拖拽可框选关键帧')],['缓入缓出','F9',()=>UI.easeKeys],
      ['复制关键帧','Ctrl+C',()=>UI.copyKeys],['粘贴关键帧','Ctrl+V',()=>UI.pasteKeys],['拉伸关键帧','',()=>UI.stretchKeys]],
    '合成':[['新建合成…','',()=>UI.newComp],['合成设置…','',()=>UI.compSettings],['sep'],
      ['原位预合成','Ctrl+Shift+C',()=>UI.precompose],['启用运动模糊','',()=>UI.toggleMB]],
    '图层':[['新建形状图层','',()=>()=>UI.addLayer('shape')],['新建文字图层','',()=>()=>UI.addLayer('text')],
      ['新建空对象','',()=>()=>UI.addLayer('null')],['新建调整层','',()=>()=>UI.addLayer('adjustment')],
      ['新建三维几何','',()=>()=>UI.addLayer('geometry')],['新建摄像机','',()=>()=>UI.addLayer('camera')],
      ['新建灯光','',()=>()=>UI.addLayer('light')],['sep'],
      ['添加矩形蒙版','',()=>UI.addMask],['添加发光效果','',()=>UI.addEffect]],
    '效果':[['高斯模糊','',()=>()=>UI.addEffectOf('高斯模糊')],['发光','',()=>()=>UI.addEffectOf('发光')],
      ['投影','',()=>()=>UI.addEffectOf('投影')],['色相/饱和度/亮度','',()=>()=>UI.addEffectOf('色相饱和度')]],
    '视图':[['合成视图','',()=>()=>UI.setView('comp')],['曲线编辑器','',()=>()=>UI.setView('graph')],
      ['节点编辑器','',()=>()=>UI.setView('nodes')],['渲染设置','',()=>()=>UI.setView('render')],['sep'],
      ['显示网格','',()=>UI.toggleGrid],['显示叠加辅助','',()=>UI.toggleOverlay]],
    '窗口':[['项目','',()=>()=>UI.toast('项目面板已固定布局')],['属性','',()=>()=>UI.toast('属性面板已固定布局')],
      ['时间轴','',()=>()=>UI.toast('时间轴已固定布局')]],
    '帮助':[['使用说明 / 表达式参考','F1',()=>UI.help],['快捷键一览','',()=>UI.help],
      ['字体与字符范围','',()=>UI.fontInfo],['关于','',()=>UI.help]]
  };
  function buildMenus(ed){
    const n=$('mainmenu');n.innerHTML='';
    Object.keys(MENUS).forEach(name=>{
      const b=h('button',{text:name});
      b.addEventListener('click',e=>{
        e.stopPropagation();
        document.querySelectorAll('.menupopup').forEach(x=>x.remove());
        const pop=h('div',{class:'menupopup'});
        const r=b.getBoundingClientRect();pop.style.left=r.left+'px';pop.style.top=r.bottom+'px';
        MENUS[name].forEach(it=>{
          if(it[0]==='sep'){pop.appendChild(h('hr'));return;}
          pop.appendChild(h('button',{html:'<span>'+it[0]+'</span><span class="kc">'+it[1]+'</span>',
            onclick:()=>{pop.remove();const fn=it[2]();if(typeof fn==='function')fn(ed);}}));
        });
        document.body.appendChild(pop);
        const kill=ev=>{if(!pop.contains(ev.target)){pop.remove();document.removeEventListener('mousedown',kill);}};
        setTimeout(()=>document.addEventListener('mousedown',kill),0);
      });
      n.appendChild(b);
    });
  }

  /* ---------------- 工具栏 ---------------- */
  const TOOLS=[['select','➤','选择工具 V','V'],['hand','✋','抓手 H','H'],['pen','✒','钢笔/路径 G','G'],
    ['text','T','文字工具 T','T'],['shape','▭','形状工具 Q','Q'],['rotate','⟳','旋转 W','W'],
    ['anchor','✛','锚点 Y','Y'],['camera','⌖','摄像机 C','C']];
  function buildToolbar(ed){
    const tb=$('toolButtons');tb.innerHTML='';
    TOOLS.forEach(t=>{
      tb.appendChild(h('button',{class:'tool-btn'+(ed.tool===t[0]?' on':''),text:t[1],title:t[2],
        onclick:()=>{ed.tool=t[0];buildToolbar(ed);UI.status(t[2]);}}));
    });
    const tabs=$('viewerTabs');tabs.innerHTML='';
    [['comp','合成'],['graph','曲线'],['nodes','节点'],['render','渲染']].forEach(v=>{
      tabs.appendChild(h('div',{class:'viewtab'+(ed.view===v[0]?' on':''),text:v[1],
        onclick:()=>UI.setView(v[0])}));
    });
  }
  UI.setView=function(v){
    const ed=window.editor;ed.view=v;
    ['Comp','Graph','Nodes','Render'].forEach((n,i)=>{
      const id=['comp','graph','nodes','render'][i];
      $('view'+n).hidden=(id!==v);
    });
    buildToolbar(ed);
    UI.sizeCanvas(ed);
    if(AE.views&&AE.views.onView)AE.views.onView(ed,v);
    UI.renderFrame(ed);
  };

  /* ---------------- 项目 / 素材 / 声音面板 ---------------- */
  UI.buildProject=function(ed){
    const t=$('projectTree');t.innerHTML='';
    t.appendChild(h('div',{class:'tree-caption',text:'合成'}));
    ed.project.comps.forEach(c=>{
      const r=h('div',{class:'tree-row'+(c.id===ed.comp.id?' sel':''),
        html:'<span class="ico">▣</span><span class="nm">'+c.name+'</span><span class="meta">'+c.width+'×'+c.height+'</span>',
        onclick:()=>{ed.project.activeCompId=c.id;ed.comp=c;ed.time=0;UI.refreshAll(ed);UI.renderFrame(ed);}});
      t.appendChild(r);
    });
    t.appendChild(h('div',{class:'tree-sep'}));
    t.appendChild(h('div',{class:'tree-caption',text:'图层（'+ed.comp.layers.length+'）'}));
    ed.comp.layers.forEach((L,i)=>{
      const meta=MO.TYPE_META[L.type]||{icon:'·'};
      const r=h('div',{class:'tree-row'+(ed.selectedLayers.indexOf(L.id)>=0?' sel':''),
        html:'<span class="ico" style="color:'+L.color+'">'+meta.icon+'</span><span class="nm">'+L.name+'</span><span class="meta">'+i+'</span>',
        onclick:()=>{ed.selectedLayers=[L.id];UI.refreshAll(ed);UI.renderFrame(ed);}});
      t.appendChild(r);
    });
    // 素材
    const a=$('assetList');a.innerHTML='';
    a.appendChild(h('div',{class:'asset-note',html:'<b>内置笔画字形</b>：轮廓可转为几何参与形变、变形与三维挤出。<br>下列字符可用，点击更换示例中的字（字形 / 字块 / 变形 / 火星全部重新生成）。'}));
    const grid=h('div',{class:'glyph-grid'});
    GH.list().forEach(ch=>{
      grid.appendChild(h('div',{class:'glyph-cell'+(ed.project.assets.glyphChar===ch?' on':''),text:ch,title:GH.info(ch).name,
        onclick:()=>{
          ed.commit('换字 · '+ch,()=>{D.setChar(ed,ch);});
          UI.refreshAll(ed);UI.renderFrame(ed);UI.toast('已换字：'+ch+' · 字形/字块/火星重新生成');
        }}));
    });
    a.appendChild(grid);
    a.appendChild(h('div',{class:'tree-sep'}));
    a.appendChild(h('div',{class:'kv',html:'<span>字体</span><b>'+ed.project.assets.fontName+'</b>'}));
    a.appendChild(h('div',{class:'kv',html:'<span>可用字符数</span><b>'+GH.list().length+'</b>'}));
    a.appendChild(h('div',{class:'asset-note',html:'<b>范围</b>：'+GH.list().join(' ')+'<br>界面文本使用系统简体中文字体，3D 挤出字形使用上列内置笔画轮廓。'}));
    // 声音
    const ap=$('audioPanel');ap.innerHTML='';
    ap.appendChild(h('div',{class:'kv',html:'<span>音色图层</span><b>锻打 · 合成</b>'}));
    const meter=h('div',{class:'meter'},h('i'));
    ap.appendChild(meter);ed._meter=meter.firstChild;
    const wave=h('canvas',{class:'wave',width:220,height:56});
    ap.appendChild(wave);ed._wave=wave;
    ap.appendChild(h('div',{class:'asset-note',html:'重音落在 4 次锤击（7.45 / 8.70 / 9.90 / 10.95 s）。首次点击或按键后建立音频；导出模式下音频时钟不推进。'}));
  };

  /* ---------------- 属性面板 ---------------- */
  function sec(title,tag,open,body){
    const b=h('div',{class:'prop-sec-body'+(open?'':' collapsed')});
    if(body)body(b);
    const head=h('div',{class:'prop-sec-head',
      html:'<span class="chev">'+(open?'▾':'▸')+'</span><span>'+title+'</span><span class="tag">'+tag+'</span>'});
    head.addEventListener('click',()=>{
      const c=!b.classList.contains('collapsed');
      b.classList.toggle('collapsed',c);
      head.querySelector('.chev').textContent=c?'▸':'▾';
    });
    return h('div',{class:'prop-section'},head,b);
  }
  function propRow(ed,L,path,prop,label,opts){
    opts=opts||{};
    const row=h('div',{class:'prop-row'});
    row.appendChild(h('span',{class:'pl',text:label||prop.label||path.split('.').pop()}));
    const v=MO.valueAtTime(ed.project,ed.comp,L,path,ed.time);
    const arr=U.ensureVec(v,prop.dim);
    const pf=h('div',{class:'pf'});
    const kind=prop.kind||'scalar';
    if(kind==='select'&&prop.options){
      const opts2=typeof prop.options==='function'?prop.options():prop.options;
      const s=h('select',{class:'sel-input'});
      opts2.forEach(o=>{const op=h('option',{text:String(o),value:String(o)});if(String(o)===String(prop.v))op.selected=true;s.appendChild(op);});
      s.addEventListener('change',()=>ed.commit('修改 '+label,()=>{prop.v=s.value;}));
      pf.appendChild(s);
    }else if(kind==='text'){
      const inp=h('input',{class:'txt-input',value:String(prop.v==null?'':prop.v)});
      inp.addEventListener('change',()=>ed.commit('修改 '+label,()=>{prop.v=inp.value;}));
      pf.appendChild(inp);
    }else{
      for(let i=0;i<prop.dim;i++){
        const wrap=h('div',{class:'num drag'});
        const inp=h('input',{type:'text',value:num(arr[i],kind==='angle'?1:(kind==='color'?2:2))});
        const unit=h('span',{class:'u',text:prop.unit||''});
        wrap.appendChild(inp);wrap.appendChild(unit);pf.appendChild(wrap);
        ed._propInputs.push({el:inp,layer:L,path:path,dim:prop.dim,idx:i,kind:kind});
        const apply=(val)=>{
          const cur=U.ensureVec(MO.valueAtTime(ed.project,ed.comp,L,path,ed.time),prop.dim);
          cur[i]=val;
          const nv=prop.dim===1?cur[0]:cur;
          ed.commit('修改 '+label,()=>MO.setPropValue(prop,ed.time,nv));
        };
        inp.addEventListener('change',()=>{const f=parseFloat(inp.value);if(isFinite(f))apply(f);});
        inp.addEventListener('keydown',e=>{if(e.key==='Enter')inp.blur();e.stopPropagation();});
        // 拖动擦洗
        let drag=null;
        wrap.addEventListener('mousedown',e=>{
          if(e.target===inp)return;
          drag={x:e.clientX,v:parseFloat(inp.value)||0};e.preventDefault();
        });
        window.addEventListener('mousemove',mm);
        function mm(e){if(!drag)return;const dv=(e.clientX-drag.x)*(prop.step||.1)*.5;inp.value=num(drag.v+dv,2);}
        window.addEventListener('mouseup',()=>{
          if(drag){const f=parseFloat(inp.value);if(isFinite(f))apply(f);drag=null;}
        });
      }
    }
    row.appendChild(pf);
    if(!opts.noAnim){
      const clock=h('span',{class:'clock'+(MO.animated(prop)?' on':''),text:'◷',title:'开启动画 / 关闭动画'});
      clock.addEventListener('click',()=>ed.commit('切换动画秒表',()=>{
        if(MO.animated(prop)){prop.kf=[];}
        else{MO.addKeyframe(prop,ed.time,MO.keyframeValue(prop,ed.time));}
      }));
      row.appendChild(clock);
      const dia=h('span',{class:'kf-diamond'+(prop.kf.some(k=>Math.abs(k.t-ed.time)<1/(ed.comp.fps*2))?' on':''),text:'◆',title:'添加/删除当前时刻关键帧'});
      dia.addEventListener('click',()=>ed.commit('编辑关键帧',()=>{
        const k=prop.kf.find(x=>Math.abs(x.t-ed.time)<1/(ed.comp.fps*2));
        if(k)prop.kf=prop.kf.filter(x=>x!==k);else MO.addKeyframe(prop,ed.time,MO.valueAtTime(ed.project,ed.comp,L,path,ed.time));
      }));
      row.appendChild(dia);
      const ex=h('span',{class:'expr-btn'+(prop.expr?' on':''),text:'ƒx',title:'表达式'});
      ex.addEventListener('click',()=>{
        ed._exprTarget={layer:L,path:path};
        UI.refreshProps(ed);
      });
      row.appendChild(ex);
    }
    return row;
  }
  function exprBox(ed,L,path,prop){
    const box=h('div');
    const ta=h('textarea',{class:'prop-expr',rows:2,placeholder:'例如：wiggle(2, 10)  /  loopOut("cycle")  /  thisComp.layer("控制器").transform.rotation'});
    ta.value=prop.expr||'';
    ta.addEventListener('change',()=>ed.commit('修改表达式',()=>{prop.expr=ta.value.trim()||null;}));
    ta.addEventListener('keydown',e=>e.stopPropagation());
    box.appendChild(ta);
    const r=h('div',{class:'prop-row'});
    r.appendChild(h('span',{class:'pl',text:'模式'}));
    const seg=h('div',{class:'segsmall'});
    [['replace','替代'],['add','叠加']].forEach(m=>seg.appendChild(h('button',{class:(prop.exprMode||'replace')===m[0]?'on':'',text:m[1],
      onclick:()=>{prop.exprMode=m[0];[...seg.children].forEach(c=>c.classList.remove('on'));event.target.classList.add('on');}})));
    r.appendChild(seg);box.appendChild(r);
    const key=ed.comp.id+'|'+L.id+'|'+path;
    const err=(MO.lastErrors||{})[key];
    if(err)box.appendChild(h('div',{class:'expr-err',text:'⚠ '+err}));
    return box;
  }
  UI.refreshProps=function(ed){
    const body=$('propBody');body.innerHTML='';
    ed._propInputs=[];
    const ids=ed.selectedLayers||[];
    if(!ids.length){
      $('propTitle').textContent='合成属性';
      const c=ed.comp;
      body.appendChild(sec('合成','COMP',true,b=>{
        b.appendChild(h('div',{class:'kv',html:'<span>名称</span><b>'+c.name+'</b>'}));
        b.appendChild(h('div',{class:'kv',html:'<span>尺寸</span><b>'+c.width+' × '+c.height+'</b>'}));
        b.appendChild(h('div',{class:'kv',html:'<span>帧率</span><b>'+c.fps+' fps</b>'}));
        b.appendChild(h('div',{class:'kv',html:'<span>时长</span><b>'+c.duration+' s</b>'}));
        b.appendChild(h('div',{class:'kv',html:'<span>工作区</span><b>'+c.workAreaStart+'–'+c.workAreaEnd+' s</b>'}));
        b.appendChild(h('div',{class:'kv',html:'<span>运动模糊</span><b>'+(c.motionBlur.enabled?'开':'关')+' · '+c.motionBlur.shutterAngle+'°</b>'}));
      }));
      body.appendChild(sec('提示','',true,b=>{
        b.appendChild(h('div',{class:'empty-hint',html:'未选择图层。<br>在时间轴或项目面板中选择图层以编辑其属性。<br>当前显示整个合成的信息。'}));
      }));
      return;
    }
    if(ids.length>1){
      $('propTitle').textContent='多选 · '+ids.length+' 个图层';
      body.appendChild(sec('多选图层','',true,b=>{
        b.appendChild(h('div',{class:'empty-hint',html:'已选择 <b>'+ids.length+'</b> 个图层。<br>可统一设置混合模式、显示、锁定与父级。'}));
        const seg=h('div',{class:'segsmall'});
        ['normal','add','screen','multiply','overlay'].forEach(m=>seg.appendChild(h('button',{text:UI.blendName(m),
          onclick:()=>ed.commit('设置混合模式',()=>ids.forEach(id=>{const L=ed.comp.layers.find(l=>l.id===id);if(L)L.blendMode=m;}))})));
        b.appendChild(h('div',{class:'prop-row'},h('span',{class:'pl',text:'混合模式'}),seg));
      }));
      return;
    }
    const L=ed.comp.layers.find(l=>l.id===ids[0]);if(!L)return;
    const meta=MO.TYPE_META[L.type]||{};
    $('propTitle').textContent=L.name+'  ·  '+(meta.cn||L.type);
    // 基本信息
    body.appendChild(sec('图层','LAYER',true,b=>{
      const r=h('div',{class:'prop-row'});
      r.appendChild(h('span',{class:'pl',text:'名称'}));
      const inp=h('input',{class:'txt-input',value:L.name});
      inp.addEventListener('change',()=>ed.commit('重命名',()=>L.name=inp.value));
      inp.addEventListener('keydown',e=>e.stopPropagation());
      r.appendChild(inp);b.appendChild(r);
      const r2=h('div',{class:'prop-row'});
      r2.appendChild(h('span',{class:'pl',text:'混合模式'}));
      const s=h('select',{class:'sel-input'});
      ['normal','add','screen','multiply','overlay'].forEach(m=>{const o=h('option',{value:m,text:UI.blendName(m)});if(L.blendMode===m)o.selected=true;s.appendChild(o);});
      s.addEventListener('change',()=>ed.commit('混合模式',()=>L.blendMode=s.value));
      r2.appendChild(s);b.appendChild(r2);
      const r3=h('div',{class:'prop-row'});
      r3.appendChild(h('span',{class:'pl',text:'父级'}));
      const ps=h('select',{class:'sel-input'});
      ps.appendChild(h('option',{value:'',text:'无'}));
      ed.comp.layers.filter(x=>x!==L).forEach(x=>{const o=h('option',{value:x.id,text:x.name});if(L.parentId===x.id)o.selected=true;ps.appendChild(o);});
      ps.addEventListener('change',()=>ed.commit('设置父级',()=>MO.reparent(ed.project,ed.comp,L,ps.value||null,ed.time)));
      r3.appendChild(ps);b.appendChild(r3);
      const r4=h('div',{class:'prop-row'});
      [['显示','enabled'],['锁定','locked'],['独奏','solo'],['运动模糊','motionBlur'],['投射阴影','castsShadow']].forEach((p,i)=>{
        const lb=h('label',{class:'chk'});
        const cb=h('input',{type:'checkbox'});cb.checked=!!L[p[1]];
        cb.addEventListener('change',()=>ed.commit('切换 '+p[0],()=>L[p[1]]=cb.checked));
        lb.appendChild(cb);lb.appendChild(h('span',{text:p[0]}));r4.appendChild(lb);
      });
      b.appendChild(r4);
      const r5=h('div',{class:'prop-row'});
      r5.appendChild(h('span',{class:'pl',text:'入点 / 出点'}));
      const i5=h('input',{class:'txt-input',value:L.inPoint+' / '+L.outPoint});
      i5.addEventListener('change',()=>{const a=i5.value.split('/').map(x=>parseFloat(x));if(a.length===2&&isFinite(a[0])&&isFinite(a[1]))ed.commit('裁剪入出点',()=>{L.inPoint=a[0];L.outPoint=a[1];});});
      i5.addEventListener('keydown',e=>e.stopPropagation());
      r5.appendChild(i5);b.appendChild(r5);
    }));
    // 变换
    body.appendChild(sec('变换','TRANSFORM',true,b=>{
      const keys=['anchor','position','scale','rotation','opacity'];
      if(L.threeD)keys.push('positionZ','rotationX','rotationY','rotationZ');
      keys.forEach(k=>{
        const p=L.transform[k];if(!p||p.hidden)return;
        b.appendChild(propRow(ed,L,'transform.'+k,p,p.label));
      });
      if(L.threeD)b.appendChild(h('label',{class:'chk'},h('input',{type:'checkbox',checked:true,disabled:true}),h('span',{text:'三维图层'})));
    }));
    // 材质
    if(L.material)body.appendChild(sec('材质','MATERIAL',true,b=>{
      const keys=['baseColor','metalness','roughness','emissive','emissiveInt','opacity'];
      keys.forEach(k=>{const p=L.material[k];if(p)b.appendChild(propRow(ed,L,'material.'+k,p,p.label));});
      b.appendChild(h('div',{class:'mini-note',text:'金属度 / 粗糙度 / 发光均可用关键帧或表达式驱动；粗糙与光滑、金属与非金属在反射上区别明显。'}));
    }));
    // 几何参数
    const geo=Object.keys(L.params||{}).filter(k=>k.indexOf('geometry.')===0);
    if(geo.length)body.appendChild(sec('几何','GEOMETRY',true,b=>{
      geo.forEach(k=>b.appendChild(propRow(ed,L,k,L.params[k],L.params[k].label||k)));
    }));
    // 摄像机 / 灯光 / 粒子 / 音频
    ['camera','light','particle','audio'].forEach(secName=>{
      const src=L[secName];if(!src)return;
      const ps=Object.keys(src).filter(k=>src[k]&&typeof src[k]==='object'&&'kf' in src[k]);
      body.appendChild(sec(({camera:'摄像机',light:'灯光',particle:'粒子',audio:'音色'})[secName],secName.toUpperCase(),false,b=>{
        ps.forEach(k=>b.appendChild(propRow(ed,L,secName+'.'+k,src[k],src[k].label||k)));
      }));
    });
    // 形状 / 文字
    if(L.shape)body.appendChild(sec('形状','SHAPE',false,b=>{
      const ps=Object.keys(L.shape).filter(k=>L.shape[k]&&typeof L.shape[k]==='object'&&'kf' in L.shape[k]);
      ps.forEach(k=>b.appendChild(propRow(ed,L,'shape.'+k,L.shape[k],L.shape[k].label||k)));
    }));
    if(L.text)body.appendChild(sec('文字','TEXT',true,b=>{
      const r=h('div',{class:'prop-row'});r.appendChild(h('span',{class:'pl',text:'内容'}));
      const i=h('input',{class:'txt-input',value:L.text.content||''});
      i.addEventListener('change',()=>ed.commit('修改文字',()=>{L.text.content=i.value;AE.scene.rebuild(ed);}));
      i.addEventListener('keydown',e=>e.stopPropagation());r.appendChild(i);b.appendChild(r);
      const ps=Object.keys(L.text).filter(k=>L.text[k]&&typeof L.text[k]==='object'&&'kf' in L.text[k]);
      ps.forEach(k=>b.appendChild(propRow(ed,L,'text.'+k,L.text[k],L.text[k].label||k)));
      b.appendChild(h('div',{class:'mini-note',text:'文字动画器按字/词/行选择范围；字形轮廓可转为几何参与形变与挤出。'}));
    }));
    // 预合成
    const pre=Object.keys(L.params||{}).filter(k=>k.indexOf('precomp.')===0);
    if(pre.length)body.appendChild(sec('预合成','PRECOMP',true,b=>{
      pre.forEach(k=>b.appendChild(propRow(ed,L,k,L.params[k],L.params[k].label||k)));
      const ref=ed.project.comps.find(c=>c.id===(L.precomp&&L.precomp.compId));
      b.appendChild(h('div',{class:'mini-note',text:'引用合成：'+(ref?ref.name:'—')+' · 各引用有独立起始时间、变换与时间重映射。'}));
    }));
    // 图钉
    const pins=Object.keys(L.params||{}).filter(k=>/^pin\d+\./.test(k));
    if(pins.length)body.appendChild(sec('图钉','PINS',false,b=>{
      const done={};
      pins.forEach(k=>{
        const m=k.match(/^(pin\d+)\.(.+)$/);if(!m)return;
        done[m[1]]=done[m[1]]||[];
        b.appendChild(propRow(ed,L,k,L.params[k],L.params[k].label||k));
      });
      b.appendChild(h('div',{class:'mini-note',text:'位置 / 旋转 / 缩放图钉可动画，多个图钉以 IDW 平滑混合共同变形，形体不撕裂。'}));
    }));
    // 场
    const fld=Object.keys(L.params||{}).filter(k=>k.indexOf('field.')===0);
    if(fld.length)body.appendChild(sec('空间场','FIELD',false,b=>{
      fld.forEach(k=>b.appendChild(propRow(ed,L,k,L.params[k],L.params[k].label||k)));
    }));
    // 效果
    if(L.effects&&L.effects.length)body.appendChild(sec('效果','FX',true,b=>{
      L.effects.forEach((ef,ei)=>{
        b.appendChild(h('div',{class:'mini-note',text:'▲ '+ef.name+(ei>0?'  · 可上移/下移排序':'')}));
        Object.keys(ef.params).forEach(k=>b.appendChild(propRow(ed,L,'effect.'+ef.name+'.'+k,ef.params[k],ef.params[k].label||k)));
        const ops=h('div',{class:'prop-row'});
        ops.appendChild(h('button',{class:'tbtn',text:'↑',title:'上移',onclick:()=>ed.commit('效果排序',()=>{if(ei>0){const t=L.effects[ei-1];L.effects[ei-1]=ef;L.effects[ei]=t;}})}));
        ops.appendChild(h('button',{class:'tbtn',text:'↓',title:'下移',onclick:()=>ed.commit('效果排序',()=>{if(ei<L.effects.length-1){const t=L.effects[ei+1];L.effects[ei+1]=ef;L.effects[ei]=t;}})}));
        ops.appendChild(h('button',{class:'tbtn',text:'删除',onclick:()=>ed.commit('删除效果',()=>L.effects.splice(ei,1))}));
        b.appendChild(ops);
      });
    }));
    // 蒙版
    if(L.masks&&L.masks.length)body.appendChild(sec('蒙版','MASKS',true,b=>{
      L.masks.forEach((mk,i)=>{
        const r=h('div',{class:'prop-row'});
        r.appendChild(h('span',{class:'pl',text:mk.name||('蒙版 '+(i+1))}));
        r.appendChild(h('span',{class:'mini-note',text:mk.type+' · '+(mk.inverted?'反转':'正常')}));
        const del=h('button',{class:'tbtn',text:'删除',onclick:()=>ed.commit('删除蒙版',()=>L.masks.splice(i,1))});
        r.appendChild(del);b.appendChild(r);
      });
    }));
    // 表达式
    const exprPaths=MO.collectPaths(L).filter(p=>{const pr=MO.resolveProp(L,p);return pr&&pr.expr;});
    body.appendChild(sec('表达式','EXPRESSION',exprPaths.length>0,b=>{
      if(!exprPaths.length)b.appendChild(h('div',{class:'mini-note',text:'点击属性行的 ƒx 为可动画属性添加表达式。支持 time / value / wiggle / loopOut / linear / ease / 跨图层引用 / valueAtTime。'}));
      exprPaths.forEach(p=>{
        const pr=MO.resolveProp(L,p);
        b.appendChild(h('div',{class:'mini-note',text:p}));
        b.appendChild(exprBox(ed,L,p,pr));
      });
      if(ed._exprTarget&&ed._exprTarget.layer===L){
        const p=ed._exprTarget.path,pr=MO.resolveProp(L,p);
        b.appendChild(h('div',{class:'mini-note',text:'编辑：'+p}));
        b.appendChild(exprBox(ed,L,p,pr));
        ed._exprTarget=null;
      }
    }));
  };
  UI.blendName=m=>({normal:'正常',add:'相加',screen:'滤色',multiply:'正片叠底',overlay:'叠加'})[m]||m;

  /* ---------------- 对齐面板 ---------------- */
  UI.buildAlign=function(ed){
    const b=$('alignBody');b.innerHTML='';
    const grid=h('div',{class:'align-grid'});
    ['⇤','⇥','↔','↕','⊣','⊢','⊤','⊥','▦','▤','◇','⌖'].forEach(s=>grid.appendChild(h('button',{text:s,title:'对齐/分布',onclick:()=>UI.toast('对齐：'+s)})));
    b.appendChild(grid);
    b.appendChild(h('div',{class:'mini-note',text:'画布中可直接平移、旋转、缩放；单独移动锚点时画面位置不变。带动画的父级下拖动仍跟手。'}));
    b.appendChild(h('div',{class:'prop-row'},h('span',{class:'pl',text:'总运动模糊'}),
      h('button',{class:'tbtn '+(ed.mbEnabled?'on':''),text:ed.mbEnabled?'开':'关',onclick:()=>UI.toggleMB(ed)})));
    const r=h('div',{class:'prop-row'});
    r.appendChild(h('span',{class:'pl',text:'快门角度'}));
    const s=h('input',{type:'range',min:0,max:360,value:ed.comp.motionBlur.shutterAngle,class:'slider'});
    s.addEventListener('input',()=>{ed.comp.motionBlur.shutterAngle=+s.value;UI.renderFrame(ed);});
    r.appendChild(s);b.appendChild(r);
  };

  /* ---------------- 时间轴 ---------------- */
  const ROWH=19;
  function tlTime(ed,x){return ed.tlScroll+(x)/ed.tlZoom;}
  function tlX(ed,t){return (t-ed.tlScroll)*ed.tlZoom;}
  UI.buildTimeline=function(ed){
    // 列头控件
    const c=$('tlControls');c.innerHTML='';
    const mk=(txt,title,fn,cls)=>c.appendChild(h('button',{class:'tp '+(cls||''),text:txt,title:title,onclick:fn}));
    mk('⏮','跳到开头',()=>{ed.setTime(ed.comp.workAreaStart);},'');
    mk('◀|','上一关键帧',()=>UI.jumpKey(ed,-1));
    mk('◀','后退一帧 ←',()=>{ed.setTime(Math.max(0,ed.time-1/ed.comp.fps));});
    mk(ed.playing?'❚❚':'▶','播放/暂停 空格',()=>UI.togglePlay(ed),'play');
    mk('▶','前进一帧 →',()=>{ed.setTime(ed.time+1/ed.comp.fps);});
    mk('|▶','下一关键帧',()=>UI.jumpKey(ed,1));
    mk('⏭','跳到结尾',()=>ed.setTime(ed.comp.workAreaEnd));
    mk('↻','循环工作区',()=>{ed.loop=!ed.loop;UI.buildTimeline(ed);},ed.loop?'on':'');
    mk('◉','吸附',()=>{ed.snap=!ed.snap;UI.buildTimeline(ed);},ed.snap?'on':'');
    const lg=$('tlLegend');lg.innerHTML='';
    lg.appendChild(h('span',{html:'<span class="sw" style="background:#ff9d4d"></span>关键帧'}));
    lg.appendChild(h('span',{html:'<span class="sw" style="background:#7fe0b4"></span>空间/路径'}));
    lg.appendChild(h('span',{html:'<span class="sw" style="background:#5bc8d8"></span>表达式'}));
    lg.appendChild(h('span',{html:'<span class="sw" style="background:#79c46b"></span>工作区'}));
    $('tlCompName').textContent=' · '+ed.comp.name;
    // 图层行
    const ll=$('tlLayerList');ll.innerHTML='';
    ed.comp.layers.forEach((L,i)=>{
      const meta=MO.TYPE_META[L.type]||{icon:'·'};
      const row=h('div',{class:'layer-row'+(ed.selectedLayers.indexOf(L.id)>=0?' sel':'')+(L.locked?' locked':'')});
      row.style.position='relative';
      row.appendChild(h('span',{class:'lr-color',style:'background:'+L.color}));
      const arrow=h('span',{class:'lr-arrow',text:'▸',title:'展开属性'});
      arrow.addEventListener('click',e=>{e.stopPropagation();UI.toast('属性关键帧显示于右侧轨道');});
      row.appendChild(arrow);
      const eye=h('span',{class:'lr-eye'+(L.enabled?'':' off'),text:L.enabled?'◉':'○',title:'显示/隐藏'});
      eye.addEventListener('click',e=>{e.stopPropagation();ed.commit('切换显示',()=>L.enabled=!L.enabled);});
      row.appendChild(eye);
      row.appendChild(h('span',{class:'lr-ico',text:meta.icon,style:'color:'+L.color}));
      row.appendChild(h('span',{class:'lr-name',text:L.name,title:L.name}));
      row.appendChild(h('span',{class:'lr-inout',text:num(L.inPoint,1)+'–'+num(L.outPoint,1)}));
      row.appendChild(h('span',{class:'lr-blend',text:UI.blendName(L.blendMode)}));
      row.addEventListener('mousedown',e=>{
        if(e.ctrlKey||e.metaKey){const k=ed.selectedLayers.indexOf(L.id);if(k>=0)ed.selectedLayers.splice(k,1);else ed.selectedLayers.push(L.id);}
        else ed.selectedLayers=[L.id];
        UI.refreshAll(ed);UI.renderFrame(ed);
      });
      row.addEventListener('contextmenu',e=>{e.preventDefault();UI.layerMenu(ed,L,e.clientX,e.clientY);});
      ll.appendChild(row);
    });
    UI.drawTimeline(ed);
  };
  UI.drawTimeline=function(ed){
    const wrap=$('tlTracksWrap');
    const rc=$('tlRuler'),tc=$('tlTracks');
    if(!wrap||!rc||!tc)return;
    const W=wrap.clientWidth||800;
    const rows=ed.comp.layers.length,H=Math.max(wrap.clientHeight||180,rows*ROWH);
    rc.width=W;rc.height=20;rc.style.width=W+'px';rc.style.height='20px';
    tc.width=W;tc.height=H;tc.style.width=W+'px';tc.style.height=H+'px';
    // 刻度
    const r=rc.getContext('2d');r.clearRect(0,0,W,20);
    r.fillStyle='#181b21';r.fillRect(0,0,W,20);
    const fps=ed.comp.fps;
    // 选一个合适的主刻度间隔（秒）
    const cand=[.2,.5,1,2,5,10];let step=1;
    for(const s of cand){if(s*ed.tlZoom>70){step=s;break;}step=s;}
    r.font='9px monospace';r.textBaseline='middle';
    const t0=ed.tlScroll,t1=ed.tlScroll+W/ed.tlZoom;
    for(let t=Math.floor(t0/step)*step;t<=t1;t+=step){
      const x=tlX(ed,t);
      r.strokeStyle='rgba(255,255,255,.16)';r.beginPath();r.moveTo(x+.5,12);r.lineTo(x+.5,20);r.stroke();
      r.fillStyle='#8b9099';r.fillText(U.timeStr(Math.max(0,t)),x+3,7);
      // 次刻度
      for(let k=1;k<5;k++){const xx=x+step*ed.tlZoom*k/5;r.strokeStyle='rgba(255,255,255,.05)';r.beginPath();r.moveTo(xx+.5,16);r.lineTo(xx+.5,20);r.stroke();}
    }
    // 轨道
    const g=tc.getContext('2d');g.clearRect(0,0,W,H);
    g.fillStyle='#101319';g.fillRect(0,0,W,H);
    // 阶段色带
    if(D.phases)D.phases.forEach(p=>{
      const x0=tlX(ed,p.t0),x1=tlX(ed,p.t1);
      g.fillStyle=p.color+'18';g.fillRect(x0,0,x1-x0,H);
      g.fillStyle=p.color;g.fillRect(x0,0,x1-x0,2);
      g.font='9px "Microsoft YaHei",sans-serif';g.fillStyle=p.color+'cc';g.fillText(p.name,x0+4,11);
    });
    // 工作区
    const wa0=tlX(ed,ed.comp.workAreaStart),wa1=tlX(ed,ed.comp.workAreaEnd);
    g.fillStyle='rgba(121,196,107,.05)';g.fillRect(wa0,0,wa1-wa0,H);
    g.strokeStyle='rgba(121,196,107,.5)';g.setLineDash([3,3]);
    g.beginPath();g.moveTo(wa0+.5,0);g.lineTo(wa0+.5,H);g.moveTo(wa1+.5,0);g.lineTo(wa1+.5,H);g.stroke();g.setLineDash([]);
    // 时间网格
    for(let t=Math.floor(t0/step)*step;t<=t1;t+=step){const x=tlX(ed,t);g.strokeStyle='rgba(255,255,255,.045)';g.beginPath();g.moveTo(x+.5,0);g.lineTo(x+.5,H);g.stroke();}
    // 每行
    ed.comp.layers.forEach((L,i)=>{
      const y=i*ROWH;
      if(i%2===0){g.fillStyle='rgba(255,255,255,.012)';g.fillRect(0,y,W,ROWH);}
      g.strokeStyle='rgba(255,255,255,.035)';g.beginPath();g.moveTo(0,y+ROWH-.5);g.lineTo(W,y+ROWH-.5);g.stroke();
      // 入出点条
      const bx0=tlX(ed,L.inPoint),bx1=tlX(ed,L.outPoint);
      g.fillStyle=L.color+'2e';g.fillRect(bx0,y+4,Math.max(0,bx1-bx0),ROWH-8);
      g.strokeStyle=L.color+'88';g.strokeRect(bx0+.5,y+4.5,Math.max(0,bx1-bx0),ROWH-9);
      // 关键帧
      const paths=MO.collectPaths(L);
      paths.forEach(p=>{
        const pr=MO.resolveProp(L,p);if(!pr)return;
        const expr=!!pr.expr;
        pr.kf.forEach(k=>{
          const x=tlX(ed,k.t),cy=y+ROWH/2;
          if(x<-6||x>W+6)return;
          const sel=ed.selectedKeys&&ed.selectedKeys.has(L.id+'|'+p+'|'+k.t);
          g.save();g.translate(x,cy);g.rotate(Math.PI/4);
          g.fillStyle=sel?'#ffe0a8':(expr?'#5bc8d8':(k.eo==='hold'?'#e88f8f':'#ff9d4d'));
          const s=sel?4.2:3.2;g.fillRect(-s,-s,s*2,s*2);
          g.strokeStyle='#15181e';g.lineWidth=1;g.strokeRect(-s,-s,s*2,s*2);
          g.restore();
        });
      });
    });
    // 播放头
    const px=tlX(ed,ed.time);
    g.strokeStyle='#ff9d4d';g.lineWidth=1.4;g.beginPath();g.moveTo(px+.5,0);g.lineTo(px+.5,H);g.stroke();
    g.fillStyle='#ff9d4d';g.beginPath();g.moveTo(px-5,0);g.lineTo(px+5,0);g.lineTo(px,9);g.closePath();g.fill();
    // 框选
    if(ed._marquee){
      const m=ed._marquee;g.strokeStyle='#ff9d4d';g.fillStyle='rgba(255,157,77,.14)';
      g.fillRect(m.x0,m.y0,m.x1-m.x0,m.y1-m.y0);g.strokeRect(m.x0+.5,m.y0+.5,m.x1-m.x0,m.y1-m.y0);
    }
  };

  /* ---------------- 时间轴交互 ---------------- */
  function bindTimeline(ed){
    const rw=$('tlRulerWrap'),tw=$('tlTracksWrap');
    let mode=null,start=null;
    rw.addEventListener('mousedown',e=>{
      const x=e.clientX-rw.getBoundingClientRect().left+rw.scrollLeft;
      ed.setTime(U.clamp(tlTime(ed,x),0,ed.comp.duration));
      mode='scrub';
    });
    tw.addEventListener('mousedown',e=>{
      const r=tw.getBoundingClientRect();
      const x=e.clientX-r.left+tw.scrollLeft,y=e.clientY-r.top+tw.scrollTop;
      // 命中关键帧？
      let hit=null;
      ed.comp.layers.forEach((L,i)=>{
        const cy=i*ROWH+ROWH/2;
        if(Math.abs(y-cy)>8)return;
        MO.collectPaths(L).forEach(p=>{
          const pr=MO.resolveProp(L,p);if(!pr)return;
          pr.kf.forEach(k=>{if(Math.abs(tlX(ed,k.t)-x)<5)hit={L:L,p:p,k:k};});
        });
      });
      if(hit){
        ed.selectedKeys=new Set([hit.L.id+'|'+hit.p+'|'+hit.k.t]);
        mode='key';start={x:x,t0:hit.k.t,hit:hit};
        UI.refreshProps(ed);
      }else if(y<14){
        ed.setTime(U.clamp(tlTime(ed,x),0,ed.comp.duration));mode='scrub';
      }else{
        mode='marquee';start={x:x,y:y};ed._marquee={x0:x,y0:y,x1:x,y1:y};
      }
      UI.drawTimeline(ed);
    });
    window.addEventListener('mousemove',e=>{
      if(!mode)return;
      const r=tw.getBoundingClientRect(),x=e.clientX-r.left+tw.scrollLeft,y=e.clientY-r.top+tw.scrollTop;
      if(mode==='scrub'){ed.setTime(U.clamp(tlTime(ed,x),0,ed.comp.duration));}
      else if(mode==='key'&&start){
        const dt=(x-start.x)/ed.tlZoom;
        const k=start.hit.k;k.t=Math.max(0,start.t0+dt);
        if(ed.snap)k.t=Math.round(k.t*ed.comp.fps)/ed.comp.fps;
        start.hit.k.__moved=true;
        UI.renderFrame(ed);
      }else if(mode==='marquee'&&start){ed._marquee.x1=x;ed._marquee.y1=y;UI.drawTimeline(ed);}
    });
    window.addEventListener('mouseup',e=>{
      if(mode==='key'&&start&&start.hit&&start.hit.k.__moved){
        const k=start.hit.k,pr=MO.resolveProp(start.hit.L,start.hit.p);
        pr.kf.sort((a,b)=>a.t-b.t);delete k.__moved;
        MO.history.push('移动关键帧');
      }
      if(mode==='marquee'&&ed._marquee){
        const m=ed._marquee;
        const x0=Math.min(m.x0,m.x1),x1=Math.max(m.x0,m.x1),y0=Math.min(m.y0,m.y1),y1=Math.max(m.y0,m.y1);
        if(x1-x0>4&&y1-y0>4){
          ed.selectedKeys=new Set();
          ed.comp.layers.forEach((L,i)=>{
            const cy=i*ROWH+ROWH/2;if(cy<y0||cy>y1)return;
            MO.collectPaths(L).forEach(p=>{const pr=MO.resolveProp(L,p);if(!pr)return;
              pr.kf.forEach(k=>{const x=tlX(ed,k.t);if(x>=x0&&x<=x1)ed.selectedKeys.add(L.id+'|'+p+'|'+k.t);});});
          });
          UI.toast('框选 '+ed.selectedKeys.size+' 个关键帧');
        }
        ed._marquee=null;
      }
      mode=null;start=null;UI.drawTimeline(ed);
    });
    tw.addEventListener('wheel',e=>{
      e.preventDefault();
      if(e.shiftKey){ed.tlScroll=Math.max(0,ed.tlScroll+e.deltaY/ed.tlZoom);}
      else{
        const r=tw.getBoundingClientRect(),x=e.clientX-r.left,tAt=tlTime(ed,x);
        ed.tlZoom=U.clamp(ed.tlZoom*(e.deltaY<0?1.15:1/1.15),20,900);
        ed.tlScroll=Math.max(0,tAt-x/ed.tlZoom);
      }
      UI.drawTimeline(ed);
    },{passive:false});
    tw.addEventListener('contextmenu',e=>{e.preventDefault();UI.keyMenu(ed,e.clientX,e.clientY);});
    // 垂直滚动同步
    const ll=$('tlLayerList');
    ll.addEventListener('scroll',()=>{tw.scrollTop=ll.scrollTop;UI.drawTimeline(ed);});
    tw.addEventListener('scroll',()=>{ll.scrollTop=tw.scrollTop;});
  }
  UI.jumpKey=function(ed,dir){
    const all=[];
    ed.comp.layers.forEach(L=>MO.collectPaths(L).forEach(p=>{const pr=MO.resolveProp(L,p);if(pr)pr.kf.forEach(k=>all.push(k.t));}));
    all.sort((a,b)=>a-b);
    if(!all.length)return;
    if(dir>0){const t=all.find(x=>x>ed.time+.001);ed.setTime(t==null?all[all.length-1]:t);}
    else{const t=all.filter(x=>x<ed.time-.001).pop();ed.setTime(t==null?all[0]:t);}
  };
  UI.keyMenu=function(ed,x,y){
    UI.ctxmenu(x,y,[
      {label:'删除所选关键帧',key:'Delete',fn:()=>UI.deleteKeys(ed)},
      {label:'缓入缓出',key:'F9',fn:()=>UI.easeKeys(ed)},
      {label:'线性插值',fn:()=>UI.setInterp(ed,'linear')},
      {label:'定格插值',fn:()=>UI.setInterp(ed,'hold')},
      {label:'贝塞尔插值',fn:()=>UI.setInterp(ed,'bezier')},
      {sep:true},
      {label:'复制关键帧',key:'Ctrl+C',fn:()=>UI.copyKeys(ed)},
      {label:'粘贴关键帧',key:'Ctrl+V',fn:()=>UI.pasteKeys(ed)},
      {label:'按比例拉伸时间…',fn:()=>UI.stretchKeys(ed)}
    ]);
  };
  UI.layerMenu=function(ed,L,x,y){
    UI.ctxmenu(x,y,[
      {label:'复制图层',key:'Ctrl+D',fn:()=>{ed.selectedLayers=[L.id];UI.duplicateLayer(ed);}},
      {label:'删除图层',key:'Delete',fn:()=>{ed.selectedLayers=[L.id];UI.deleteLayer(ed);}},
      {label:'原位预合成',key:'Ctrl+Shift+C',fn:()=>{ed.selectedLayers=[L.id];UI.precompose(ed);}},
      {sep:true},
      {label:'添加矩形蒙版',fn:()=>UI.addMask(ed)},
      {label:'添加发光效果',fn:()=>UI.addEffect(ed)},
      {label:'设为父级…',fn:()=>UI.toast('在属性面板的父级下拉中设置')}
    ]);
  };

  /* ---------------- 关键帧操作 ---------------- */
  function eachKey(ed,fn){
    if(!ed.selectedKeys)return;
    ed.comp.layers.forEach(L=>MO.collectPaths(L).forEach(p=>{
      const pr=MO.resolveProp(L,p);if(!pr)return;
      pr.kf.forEach(k=>{if(ed.selectedKeys.has(L.id+'|'+p+'|'+k.t))fn(pr,k,p,L);});
    }));
  }
  UI.deleteKeys=function(ed){ed.commit('删除关键帧',()=>{
    ed.comp.layers.forEach(L=>MO.collectPaths(L).forEach(p=>{
      const pr=MO.resolveProp(L,p);if(!pr)return;
      pr.kf=pr.kf.filter(k=>!ed.selectedKeys.has(L.id+'|'+p+'|'+k.t));
    }));ed.selectedKeys=new Set();
  });};
  UI.easeKeys=function(ed){ed.commit('缓入缓出 F9',()=>{eachKey(ed,(pr,k)=>{k.eo='easeInOut';k.ei='easeInOut';});});};
  UI.setInterp=function(ed,v){ed.commit('设置插值 '+v,()=>{eachKey(ed,(pr,k)=>{k.eo=v;k.ei=v;k.hold=(v==='hold');});});};
  UI.copyKeys=function(ed){
    ed._clip=[];eachKey(ed,(pr,k,p,L)=>ed._clip.push({layerName:L.name,path:p,v:U.clone(k.v),eo:k.eo,ei:k.ei,t:k.t}));
    if(!ed._clip.length){ // 复制当前时刻所有层关键帧
      ed.comp.layers.forEach(L=>MO.collectPaths(L).forEach(p=>{const pr=MO.resolveProp(L,p);if(!pr)return;
        pr.kf.forEach(k=>{if(Math.abs(k.t-ed.time)<1/(ed.comp.fps*2))ed._clip.push({layerName:L.name,path:p,v:U.clone(k.v),eo:k.eo,ei:k.ei,t:k.t});});}));
    }
    UI.toast('复制 '+ed._clip.length+' 个关键帧');
  };
  UI.pasteKeys=function(ed){
    if(!ed._clip||!ed._clip.length)return;
    ed.commit('粘贴关键帧',()=>{
      const t0=Math.min.apply(null,ed._clip.map(k=>k.t));
      ed._clip.forEach(c=>{
        const L=ed.comp.layers.find(l=>l.name===c.layerName)||ed.comp.layers.find(l=>ed.selectedLayers.indexOf(l.id)>=0);
        if(!L)return;const pr=MO.resolveProp(L,c.path);if(!pr)return;
        MO.addKeyframe(pr,ed.time+(c.t-t0),c.v,{eo:c.eo,ei:c.ei});
      });
    });
  };
  UI.stretchKeys=function(ed){
    UI.modal('按比例拉伸关键帧时间','<p>对当前框选的关键帧按系数缩放时间（以选择集起点为原点）。</p><p><input id="stretchF" class="txt-input" value="1.5" style="width:120px"> 倍</p>',
      [{label:'取消'},{label:'应用',cls:'accent',fn:(m)=>{
        const f=parseFloat($('stretchF').value)||1;
        let t0=Infinity;eachKey(ed,(pr,k)=>t0=Math.min(t0,k.t));
        ed.commit('拉伸关键帧',()=>{eachKey(ed,(pr,k)=>k.t=t0+(k.t-t0)*f);});
      }}]);
  };

  /* ---------------- 编辑操作 ---------------- */
  UI.togglePlay=function(ed){
    ed.playing=!ed.playing;ed.lastNow=performance.now();
    if(ed.playing){AE.audio.ensure();AE.audio.startBed(D.heatAt(ed.time));AE.audio.resetFired();}
    else AE.audio.stopBed();
    $('btnPlayTop').innerHTML=ed.playing?'❚❚ 暂停':'▶ 播放';
    UI.buildTimeline(ed);
  };
  UI.status=function(s){$('statusText').textContent=s;};
  UI.undo=function(ed){if(MO.history.undoDo()){UI.toast('撤销');UI.status('撤销：'+MO.history.undo.length+' 步可撤');}};
  UI.redo=function(ed){if(MO.history.redoDo()){UI.toast('重做');UI.status('重做');}};
  UI.onHistory=function(ed){UI.status('历史：'+MO.history.undo.length+' 步可撤销');};
  UI.addLayer=function(ed,type){
    const L=MO.createLayer(type,({shape:'形状',text:'文字',null:'空对象',adjustment:'调整层',geometry:'三维几何',camera:'摄像机',light:'灯光'})[type]||'图层');
    if(type==='shape'){
      L.shape={kind:'rect',w:MO.P(2,{kind:'slider',label:'宽度'}),h:MO.P(2,{kind:'slider',label:'高度'}),
        trim:MO.P(1,{kind:'slider',label:'修剪'}),repeater:MO.P(1,{kind:'slider',label:'重复器'}),
        repOffsetX:MO.P(.5,{kind:'slider',label:'重复偏移'}),repRot:MO.P(0,{kind:'slider',label:'重复旋转'})};
      L.geometry={source:'shape'};L.material=matDefault();
    }else if(type==='text'){
      L.text={content:'中',size:MO.P(2,{kind:'slider',label:'字号'}),leading:MO.P(1.2,{kind:'slider',label:'行距'}),
        tracking:MO.P(0,{kind:'slider',label:'字距'}),align:MO.P(0,{kind:'slider',label:'对齐'})};
      L.geometry={source:'text',size:2,restY:-1.28};L.material=matDefault();
    }else if(type==='geometry'){
      L.geometry={source:'box',w:1.5,h:1.5,d:.4};L.material=matDefault();
    }else if(type==='camera'){
      L.camera={pos:MO.P([0,3,6],{kind:'vec3',label:'位置'}),target:MO.P([0,0,0],{kind:'vec3',label:'目标'}),
        fov:MO.P(40,{kind:'slider',label:'视角'}),focus:MO.P(7,{kind:'slider',label:'对焦'}),
        aperture:MO.P(.1,{kind:'slider',label:'光圈'}),maxCoC:MO.P(5,{kind:'slider',label:'弥散'})};
    }else if(type==='light'){
      L.light={type:'point',pos:MO.P([0,2,2],{kind:'vec3',label:'位置'}),color:MO.P([1,.8,.6],{kind:'color',label:'颜色'}),
        intensity:MO.P(3,{kind:'slider',label:'强度'})};
    }
    ed.commit('新建图层',()=>ed.comp.layers.unshift(L));
    ed.selectedLayers=[L.id];UI.refreshAll(ed);UI.renderFrame(ed);UI.toast('已新建 '+L.name);
  };
  function matDefault(){
    return {baseColor:MO.P([.5,.55,.6],{kind:'color',label:'基础色'}),metalness:MO.P(.85,{kind:'slider',label:'金属度'}),
      roughness:MO.P(.3,{kind:'slider',label:'粗糙度'}),emissive:MO.P([1,.4,.1],{kind:'color',label:'发光色'}),
      emissiveInt:MO.P(.1,{kind:'slider',label:'发光强度'}),opacity:MO.P(100,{kind:'slider',label:'不透明度'})};
  }
  UI.duplicateLayer=function(ed){
    const ids=ed.selectedLayers.slice();if(!ids.length)return;
    const news=[];
    ed.commit('复制图层',()=>{
      ids.forEach(id=>{const L=ed.comp.layers.find(l=>l.id===id);if(!L)return;
        const c=U.clone(L);c.id=U.uid('L');c.name=L.name+' 副本';c.selected=false;news.push(c.id);
        ed.comp.layers.splice(ed.comp.layers.indexOf(L),0,c);});
    });
    ed.selectedLayers=news;UI.refreshAll(ed);UI.renderFrame(ed);
  };
  UI.deleteLayer=function(ed){
    const ids=ed.selectedLayers.slice();if(!ids.length)return;
    ed.commit('删除图层',()=>{
      ed.comp.layers=ed.comp.layers.filter(l=>ids.indexOf(l.id)<0);
      ed.comp.layers.forEach(l=>{if(ids.indexOf(l.parentId)>=0)l.parentId=null;});
    });
    ed.selectedLayers=[];UI.refreshAll(ed);UI.renderFrame(ed);
  };
  UI.precompose=function(ed){
    const ids=ed.selectedLayers.slice();if(!ids.length){UI.toast('请先选择至少一个图层');return;}
    const comp=ed.comp;
    ed.commit('原位预合成',()=>{
      const newComp=MO.createComp({name:'预合成 '+(comp.comps?(comp.comps.length+1):'')+ ' · '+(ed.project.comps.length),
        width:comp.width,height:comp.height,fps:comp.fps,duration:comp.duration});
      const picked=comp.layers.filter(l=>ids.indexOf(l.id)>=0);
      newComp.layers=picked.map(l=>U.clone(l));
      ed.project.comps.push(newComp);
      const pc=MO.createLayer('precomp','预合成 · '+newComp.name,{threeD:true});
      pc.precomp={compId:newComp.id};
      pc.params['precomp.timeRemap']=MO.P(0,{kind:'slider',label:'时间重映射'});
      const idx=Math.min.apply(null,picked.map(l=>comp.layers.indexOf(l)));
      comp.layers=comp.layers.filter(l=>ids.indexOf(l.id)<0);
      comp.layers.splice(Math.min(idx,comp.layers.length),0,pc);
      ed.selectedLayers=[pc.id];
    });
    AE.scene.rebuild(ed);UI.refreshAll(ed);UI.renderFrame(ed);UI.toast('已原位预合成（前后画面一致）');
  };
  UI.addMask=function(ed){
    const L=ed.comp.layers.find(l=>l.id===ed.selectedLayers[0]);if(!L)return;
    ed.commit('添加蒙版',()=>{L.masks=L.masks||[];L.masks.push({name:'蒙版 '+(L.masks.length+1),type:'矩形',inverted:false,feather:0,expand:0});});
    UI.refreshProps(ed);UI.toast('已添加矩形蒙版');
  };
  UI.addEffect=function(ed){UI.addEffectOf('发光',ed);};
  UI.addEffectOf=function(name,ed){
    ed=ed||window.editor;const L=ed.comp.layers.find(l=>l.id===ed.selectedLayers[0]);if(!L){UI.toast('请先选择图层');return;}
    ed.commit('添加效果 '+name,()=>{
      L.effects=L.effects||[];
      const pr={'高斯模糊':{'半径':MO.P(8,{kind:'slider',label:'半径'})},
        '发光':{'强度':MO.P(.4,{kind:'slider',label:'强度'}),'半径':MO.P(20,{kind:'slider',label:'半径'})},
        '投影':{'距离':MO.P(12,{kind:'slider',label:'距离'}),'柔和':MO.P(20,{kind:'slider',label:'柔和'})},
        '色相饱和度':{'色相':MO.P(0,{kind:'slider',label:'色相'}),'饱和度':MO.P(0,{kind:'slider',label:'饱和度'}),'亮度':MO.P(0,{kind:'slider',label:'亮度'})}}[name]||{'量':MO.P(.5,{kind:'slider',label:'量'})};
      L.effects.push({name:name,type:name,enabled:true,params:pr});
    });
    UI.refreshProps(ed);UI.renderFrame(ed);UI.toast('已添加效果：'+name);
  };
  UI.toggleMB=function(ed){ed=ed||window.editor;ed.mbEnabled=!ed.mbEnabled;UI.buildAlign(ed);UI.renderFrame(ed);UI.toast('总运动模糊：'+(ed.mbEnabled?'开':'关'));};
  UI.toggleGrid=function(ed){ed=ed||window.editor;ed.showGrid=!ed.showGrid;UI.renderFrame(ed);};
  UI.toggleOverlay=function(ed){ed=ed||window.editor;ed.showOverlay=!ed.showOverlay;UI.renderFrame(ed);};

  /* ---------------- 工程文件 ---------------- */
  UI.saveProject=function(ed){
    ed=ed||window.editor;
    try{
      localStorage.setItem('forge_project',MO.serialize(ed.project));
      UI.toast('工程已保存到浏览器本地存储');
    }catch(e){UI.toast('保存失败：'+e.message);}
    const blob=new Blob([MO.serialize(ed.project)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='锻字工程.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
  UI.openProject=function(ed){
    ed=ed||window.editor;
    $('fileInput').onchange=()=>{
      const f=$('fileInput').files[0];if(!f)return;
      const r=new FileReader();
      r.onload=()=>{try{
        const p=MO.deserialize(r.result);
        MO.history.push('打开工程');ed.project=p;ed.time=0;ed.selectedLayers=[];
        ed.rebind();UI.refreshAll(ed);UI.renderFrame(ed);UI.toast('工程已打开');
      }catch(e){UI.toast('打开失败：'+e.message);}};
      r.readAsText(f);
    };
    $('fileInput').click();
  };
  UI.newProject=function(ed){
    ed=ed||window.editor;
    UI.modal('新建工程','<p>将创建一个空工程（含一个空白合成）。当前示例工程会被替换，可用撤销恢复。</p>',
      [{label:'取消'},{label:'创建空工程',cls:'accent',fn:()=>{
        ed.commit('新建空工程',()=>{
          const p=MO.createProject();p.name='未命名工程';
          const c=MO.createComp({name:'合成 1',duration:10});p.comps.push(c);p.activeCompId=c.id;p.nodeGraphs.main=AE.nodes.createGraph();
          ed.project=p;ed.time=0;ed.selectedLayers=[];
        });
        ed.rebind();UI.refreshAll(ed);UI.renderFrame(ed);UI.toast('已创建空工程');
      }}]);
  };
  UI.newComp=function(ed){
    ed=ed||window.editor;
    UI.modal('新建合成','<p>名称 <input id="ncName" class="txt-input" value="合成 2" style="width:180px"></p>'+
      '<p>宽 <input id="ncW" class="txt-input" value="1920" style="width:90px"> 高 <input id="ncH" class="txt-input" value="1080" style="width:90px"> 帧率 <input id="ncF" class="txt-input" value="30" style="width:60px"> 时长 <input id="ncD" class="txt-input" value="10" style="width:60px"> s</p>',
      [{label:'取消'},{label:'创建',cls:'accent',fn:()=>{
        const c=MO.createComp({name:$('ncName').value,width:+$('ncW').value,height:+$('ncH').value,fps:+$('ncF').value,duration:+$('ncD').value});
        ed.commit('新建合成',()=>ed.project.comps.push(c));
        ed.project.activeCompId=c.id;ed.comp=c;UI.refreshAll(ed);UI.renderFrame(ed);
      }}]);
  };
  UI.compSettings=function(ed){
    ed=ed||window.editor;const c=ed.comp;
    UI.modal('合成设置 · '+c.name,
      '<p>名称 <input id="csName" class="txt-input" value="'+c.name+'" style="width:220px"></p>'+
      '<p>尺寸 <input id="csW" class="txt-input" value="'+c.width+'" style="width:90px"> × <input id="csH" class="txt-input" value="'+c.height+'" style="width:90px"> · 帧率 <input id="csF" class="txt-input" value="'+c.fps+'" style="width:60px"></p>'+
      '<p>时长 <input id="csD" class="txt-input" value="'+c.duration+'" style="width:80px"> s · 工作区 <input id="csWS" class="txt-input" value="'+c.workAreaStart+'" style="width:60px"> – <input id="csWE" class="txt-input" value="'+c.workAreaEnd+'" style="width:60px"> s</p>'+
      '<p><label class="chk"><input type="checkbox" id="csMB" '+(c.motionBlur.enabled?'checked':'')+'> 合成运动模糊</label> 快门角度 <input id="csSA" class="txt-input" value="'+c.motionBlur.shutterAngle+'" style="width:70px">° 相位 <input id="csSP" class="txt-input" value="'+c.motionBlur.shutterPhase+'" style="width:70px">°</p>',
      [{label:'取消'},{label:'应用',cls:'accent',fn:()=>{
        ed.commit('合成设置',()=>{
          c.name=$('csName').value;c.width=+$('csW').value;c.height=+$('csH').value;c.fps=+$('csF').value;
          c.duration=+$('csD').value;c.workAreaStart=+$('csWS').value;c.workAreaEnd=+$('csWE').value;
          c.motionBlur.enabled=$('csMB').checked;c.motionBlur.shutterAngle=+$('csSA').value;c.motionBlur.shutterPhase=+$('csSP').value;
        });
        UI.sizeCanvas(ed);UI.refreshAll(ed);UI.renderFrame(ed);
      }}]);
  };
  UI.fontInfo=function(){
    UI.modal('字体与字符范围',
      '<h4>界面字体</h4><p>界面文本使用系统简体中文字体（Microsoft YaHei / 微软雅黑 / PingFang SC / Noto Sans CJK SC 回退），无需外部资源。</p>'+
      '<h4>3D 挤出字形</h4><p>使用随项目提供的<b>「锻造黑体」内置笔画字形库</b>，字形以矢量笔画折线定义，轮廓可转为三角网格，参与形变、路径形变、变形与真正的三维挤出（正反面 / 侧壁 / 倒角 / 法线 / 孔洞）。</p>'+
      '<h4>可用字符（'+GH.list().length+' 个）</h4><p style="font-size:22px;letter-spacing:8px;color:#ffb877">'+GH.list().join('')+'</p>'+
      '<p>点击左侧「字形库」中的字符即可把示例中的字替换为任意一个可用字，字形、字块、锤击变形与火星发射位置都会按新字重新生成。</p>',
      [{label:'知道了',cls:'accent'}]);
  };
  UI.help=function(){
    UI.modal('使用说明 · 表达式参考',
      '<div class="help-grid">'+
      '<div class="card"><b>播放与时间</b><br>空格 播放/暂停 · ← → 逐帧 · 单击时间标尺擦洗 · 滚轮缩放时间轴 · Shift+滚轮平移 · 循环工作区按钮 ↻</div>'+
      '<div class="card"><b>关键帧与曲线</b><br>属性行 ◷ 开启动画；◆ 添加/删除当前时刻关键帧。时间轴中拖拽移动关键帧、框选、右键菜单设置插值、F9 缓入缓出、Ctrl+C/V 复制粘贴、按比例拉伸。</div>'+
      '<div class="card"><b>表达式（点 ƒx 编辑）</b><br><code>time</code> 当前秒 · <code>value</code> 关键帧值 · <code>wiggle(f,a)</code> 可复现抖动 · <code>loopOut("cycle")</code> / <code>loopOut("pingpong")</code> · <code>linear(t,a,b,c,d)</code> / <code>ease(t,a,b,c,d)</code> · <code>thisComp.layer("控制器").transform.rotation</code> 跨图层引用 · <code>.valueAtTime(t)</code> 读取所属合成第 t 秒最终值 · 向量分量 <code>.x/.y/.z/[0]</code> · <code>add/sub/mul/div</code> 向量运算。</div>'+
      '<div class="card"><b>几何 / 节点 / 场 / 粒子</b><br>节点视图中拖动画布、点端口连线、按钮新建节点、Ctrl+D 复制、可封装节点组。一个几何输出可同时连到显示/变形/发射/碰撞。空间场同时作用于顶点与粒子。粒子以固定步长预模拟，任意时刻取样确定。</div>'+
      '<div class="card"><b>合成 / 预合成 / 模糊</b><br>Ctrl+Shift+C 原位预合成；预合成图层有独立起始时间、变换与时间重映射。图层运动模糊开关 + 合成总开关 / 快门角度 / 相位，按快门区间内实际运动多次取样。</div>'+
      '<div class="card"><b>三维 / 材质 / 灯光 / 声音</b><br>WebGL2 渲染挤出实体，环境反射随法线/视角/粗糙度变化；平行光产生真实几何投影（含孔洞与侧壁）；摄像机景深由实际深度决定。音色图层合成配乐与锤击音效，首次交互后出声。</div>'+
      '</div>'+
      '<h4>快捷键</h4><table><tr><th>键</th><th>功能</th><th>键</th><th>功能</th></tr>'+
      '<tr><td>空格</td><td>播放/暂停</td><td>F9</td><td>缓入缓出</td></tr>'+
      '<tr><td>Ctrl+Z</td><td>撤销</td><td>Ctrl+Y / Ctrl+Shift+Z</td><td>重做</td></tr>'+
      '<tr><td>Ctrl+Shift+C</td><td>原位预合成</td><td>Ctrl+S / Ctrl+O</td><td>保存 / 打开工程</td></tr>'+
      '<tr><td>Ctrl+D</td><td>复制图层</td><td>Delete</td><td>删除</td></tr>'+
      '<tr><td>V/H/G/T/Q/W/Y/C</td><td>工具切换</td><td>F1</td><td>本帮助</td></tr></table>'+
      '<p class="mini-note">输入文字或表达式时，编辑器快捷键不会抢占输入。</p>',
      [{label:'关闭',cls:'accent'}]);
  };

  /* ---------------- 渲染设置面板 ---------------- */
  UI.buildRender=function(ed){
    const r=$('renderSettings');r.innerHTML='';
    r.appendChild(h('div',{class:'graph-head',html:'<span class="ph-title">渲染与导出设置</span><span class="hint">WebGL 2 · 与整个编辑器同步取样</span>'}));
    const cards=h('div',{class:'render-cards'});
    cards.appendChild(h('div',{class:'card',html:'<b>渲染器</b><br>原生 WebGL 2 · 阴影贴图 '+(ed.renderer.shadow?ed.renderer.shadow.size:1024)+'² · HDR '+(ed.renderer.HDR?'半浮点':'8位')+'<br>PBR 金属 / 程序环境反射 / Bloom / 景深 / 运动模糊 / 粒子拖尾。'}));
    cards.appendChild(h('div',{class:'card',html:'<b>逐帧接口 window.videoExport</b><br><code>runs = ["demo"]</code><br><code>begin("demo",{fps})</code> → <code>{frames:15*fps}</code><br><code>frame(i)</code> 落在第 i/fps 秒<br><code>end()</code> 恢复交互<br>支持 3 fps 预览与 60 fps 正式导出。'}));
    cards.appendChild(h('div',{class:'card',html:'<b>确定性</b><br>粒子以 60 Hz 固定步长预模拟整段并保存快照；跳到后段、倒放、重开文件读取同一时刻结果相同。运动模糊的多次取样不会重复推进模拟或触发事件。'}));
    cards.appendChild(h('div',{class:'card',html:'<b>当前取样</b><br>t = <span class="big-num" id="rsT">0.00</span> s<br>帧 <span class="big-num" id="rsF">0</span> / '+Math.round(ed.comp.duration*ed.comp.fps)+'<br>阶段 <span id="rsP">写成</span>'}));
    r.appendChild(cards);
  };

  /* ---------------- 快捷键 ---------------- */
  function bindKeys(ed){
    window.addEventListener('keydown',e=>{
      const tag=(e.target.tagName||'').toLowerCase();
      if(tag==='input'||tag==='textarea'||tag==='select'||e.target.isContentEditable){
        if(e.key==='Escape')e.target.blur();
        return; // 输入中不抢占
      }
      const ctrl=e.ctrlKey||e.metaKey,k=e.key.toLowerCase(),shift=e.shiftKey;
      if(ctrl&&k==='z'){e.preventDefault();shift?UI.redo(ed):UI.undo(ed);return;}
      if(ctrl&&k==='y'){e.preventDefault();UI.redo(ed);return;}
      if(ctrl&&shift&&k==='c'){e.preventDefault();UI.precompose(ed);return;}
      if(ctrl&&k==='s'){e.preventDefault();UI.saveProject(ed);return;}
      if(ctrl&&k==='o'){e.preventDefault();UI.openProject(ed);return;}
      if(ctrl&&k==='d'){e.preventDefault();UI.duplicateLayer(ed);return;}
      if(ctrl&&k==='c'){e.preventDefault();UI.copyKeys(ed);return;}
      if(ctrl&&k==='v'){e.preventDefault();UI.pasteKeys(ed);return;}
      if(ctrl&&k==='n'){e.preventDefault();UI.newProject(ed);return;}
      if(e.key===' '){e.preventDefault();UI.togglePlay(ed);return;}
      if(e.key==='F9'){e.preventDefault();UI.easeKeys(ed);return;}
      if(e.key==='F1'){e.preventDefault();UI.help();return;}
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();UI.deleteKeys(ed);UI.deleteLayer(ed);return;}
      if(e.key==='ArrowLeft'){e.preventDefault();ed.setTime(Math.max(0,ed.time-(shift?1:1/ed.comp.fps)));return;}
      if(e.key==='ArrowRight'){e.preventDefault();ed.setTime(ed.time+(shift?1:1/ed.comp.fps));return;}
      const tool={v:'select',h:'hand',g:'pen',t:'text',q:'shape',w:'rotate',y:'anchor',c:'camera'}[k];
      if(tool&&!ctrl){ed.tool=tool;buildToolbar(ed);return;}
    });
  }

  /* ---------------- 初始化 ---------------- */
  UI.refreshAll=function(ed){
    buildMenus(ed);buildToolbar(ed);
    UI.buildProject(ed);UI.refreshProps(ed);UI.buildAlign(ed);UI.buildTimeline(ed);
    UI.buildRender(ed);
    $('projectName').textContent=ed.project.name;
    $('compName').textContent=ed.comp.name;
    $('rendererBadge').textContent='WebGL 2'+(ed.renderer.HDR?' · HDR':'');
    $('btnPlayTop').innerHTML=ed.playing?'❚❚ 暂停':'▶ 播放';
    $('zoomSelect').value=String(ed.zoom);
    $('safeGuides').classList.toggle('on',ed.showGrid);
    if(AE.views&&AE.views.refresh)AE.views.refresh(ed);
  };
  UI.init=function(ed){
    UI.sizeCanvas(ed);
    bindTimeline(ed);bindKeys(ed);
    $('btnPlayTop').addEventListener('click',()=>UI.togglePlay(ed));
    $('btnSave').addEventListener('click',()=>UI.saveProject(ed));
    $('btnOpen').addEventListener('click',()=>UI.openProject(ed));
    $('zoomSelect').addEventListener('change',e=>{ed.zoom=e.target.value;UI.sizeCanvas(ed);UI.renderFrame(ed);});
    $('btnGrid').addEventListener('click',()=>UI.toggleGrid(ed));
    $('btnOverlay').addEventListener('click',()=>UI.toggleOverlay(ed));
    document.querySelectorAll('#panelProject .ph-actions button').forEach(b=>{
      b.addEventListener('click',()=>{if(b.dataset.act==='newComp')UI.newComp(ed);else UI.toast('文件夹已固定分组');});
    });
    document.querySelectorAll('#panelProps .ph-actions button').forEach(b=>{
      b.addEventListener('click',()=>{document.querySelectorAll('.prop-sec-body').forEach(x=>x.classList.add('collapsed'));});
    });
    window.addEventListener('resize',U.debounce(()=>{UI.sizeCanvas(ed);UI.drawTimeline(ed);if(AE.views&&AE.views.resize)AE.views.resize(ed);UI.renderFrame(ed);},120));
    // 首次交互建立音频
    const once=()=>{AE.audio.ensure();window.removeEventListener('pointerdown',once);window.removeEventListener('keydown',once);};
    window.addEventListener('pointerdown',once);window.addEventListener('keydown',once);
    UI.refreshAll(ed);
  };

  console.log('[forge] ui ready');
})();
