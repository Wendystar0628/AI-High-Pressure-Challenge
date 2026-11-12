/* ============================================================
   main.js — 引导：创建渲染器 / 载入示例工程 / 建立编辑器状态 /
   播放循环 / 撤销重做 / 保存打开 / 首帧渲染
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE,U=AE.util,MO=AE.model,UI=AE.ui;

  function boot(){
    const canvas=document.getElementById('glCanvas');
    const renderer=AE.renderer.create(canvas);
    if(!renderer){
      document.getElementById('statusText').textContent='无法创建 WebGL2 上下文，请使用支持 WebGL2 的 Chrome。';
      return;
    }
    const project=AE.demo.createProject();
    const ed={
      project:project,
      comp:AE.model.comp(project),
      renderer:renderer,
      time:0,playing:false,loop:true,rate:1,exportMode:false,
      lastNow:performance.now(),
      selectedLayers:[],selectedKeys:new Set(),_clip:[],
      view:'comp',tool:'select',zoom:'fit',showGrid:true,showOverlay:true,
      tlZoom:74,tlScroll:0,snap:true,mbEnabled:true,
      graphProp:null,
      demo:AE.demo,
      simCache:{},cacheFields:[],cacheReady:false,
      _propInputs:[],_fs:null,
      nodeView:null,
      _marquee:null
    };
    window.editor=ed;

    ed.setTime=function(t){
      ed.time=U.clamp(t,0,ed.comp.duration);
      UI.renderFrame(ed);
    };
    ed.commit=function(label,fn){
      MO.history.push(label);
      try{fn();}catch(e){console.error(e);}
      UI.refreshProps(ed);
      UI.buildTimeline(ed);
      UI.renderFrame(ed);
    };
    ed.rebind=function(){
      ed.comp=AE.model.comp(ed.project);
      ed._fs=null;
      AE.scene.rebuild(ed);
    };
    ed.refreshAll=function(){UI.refreshAll(ed);};
    ed.onHistory=function(){UI.status('历史：'+MO.history.undo.length+' 步可撤销');};
    ed.save=function(){UI.saveProject(ed);};
    ed.load=function(){UI.openProject(ed);};

    // 派生缓存
    AE.scene.rebuild(ed);
    // 界面
    UI.init(ed);
    AE.views.init(ed);
    // 顶层按钮
    document.getElementById('btnPlayTop').addEventListener('click',()=>UI.togglePlay(ed));
    // 首帧
    UI.sizeCanvas(ed);
    UI.renderFrame(ed);
    UI.status('就绪 · 已自动载入 15 秒示例《锻字》 · 按空格播放');

    // 播放循环（导出模式下不推进时间）
    function loop(now){
      const dt=Math.min(.05,(now-ed.lastNow)/1000);
      if(ed.playing&&!ed.exportMode){
        ed.time+=dt*(ed.rate||1);
        const c=ed.comp,wa0=c.workAreaStart,wa1=c.workAreaEnd;
        if(ed.loop&&ed.time>wa1){const span=Math.max(.001,wa1-wa0);ed.time=wa0+(ed.time-wa1)%span;}
        else ed.time=Math.min(ed.time,c.duration);
        AE.audio.tick(ed.time,ed);
        UI.renderFrame(ed);
      }
      ed.lastNow=now;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // 自测：把引擎状态挂到 window 便于评测检查
    window.__forge={project:project,renderer:renderer,editor:ed};
    console.log('[forge] boot ok · comps=',project.comps.length,'layers=',ed.comp.layers.length,
      'glyphs=',AE.glyphs.list().length,'HDR=',renderer.HDR);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
