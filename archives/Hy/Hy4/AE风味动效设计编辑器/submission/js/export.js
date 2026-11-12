/* ============================================================
   export.js — 整个编辑器的逐帧接口 window.videoExport
   demo 展示整个编辑器界面，15 秒示例从头到尾播放一遍；
   画布、播放头、时间轴与属性同步变化。
   取样是时间 t 的纯函数：不额外推进播放/音频时钟，不重复触发模拟。
   ============================================================ */
(function(){
  "use strict";
  const AE=window.AE;
  function raf(){return new Promise(r=>requestAnimationFrame(()=>r()));}
  async function settle(){await raf();await raf();}

  const VX={
    runs:['demo'],
    async begin(runId,opts){
      const ed=window.editor;
      if(!ed)return {frames:0};
      const fps=(opts&&opts.fps)||30;
      ed._exportFps=fps;
      ed.exportMode=true;
      ed.playing=false;
      AE.audio.stopBed();
      // 回到这一段的起始状态：主合成 + 第 0 秒 + 重新计算派生缓存
      ed.project.activeCompId=ed.project.comps[0].id;
      ed.comp=AE.model.comp(ed.project);
      ed.time=0;
      AE.audio.resetFired();
      AE.scene.rebuild(ed);
      AE.ui.sizeCanvas(ed);
      AE.ui.refreshAll(ed);
      AE.ui.renderFrame(ed);
      await settle();
      return {frames:Math.round(15*fps)};
    },
    async frame(i){
      const ed=window.editor;
      if(!ed)return;
      const fps=ed._exportFps||30;
      ed.time=i/fps;
      AE.ui.renderFrame(ed);
      await settle();
    },
    end(){
      const ed=window.editor;
      if(!ed)return;
      ed.exportMode=false;
      ed.playing=false;
      ed.time=0;
      AE.audio.resetFired();
      AE.audio.stopBed();
      AE.ui.refreshAll(ed);
      AE.ui.renderFrame(ed);
    }
  };
  window.videoExport=VX;
  console.log('[forge] videoExport ready · runs=',VX.runs);
})();
