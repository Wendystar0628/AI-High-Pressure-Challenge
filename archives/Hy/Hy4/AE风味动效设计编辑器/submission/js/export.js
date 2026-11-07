/* =========================================================================
   export.js — window.videoExport fixed frame interface + workspace export
   ========================================================================= */
(function(AE){
'use strict';

function ensureAudioSilent(){ /* audio clock is frozen in export mode; see ui.js */ }

AE.Export={
  install(app){
    const self=this;
    const api={
      runs:['demo'],
      async begin(runId,opt){
        opt=opt||{};
        const fps=opt.fps||30;
        AE.state.exportMode=true;
        AE.state.playing=false;
        AE.state.audioOn=false;               // freeze audio clock
        self._fps=fps;
        self._comp=AE.activeComp(app.project);
        // ensure a clean, complete starting state
        app.setTime(0,{silent:true});
        await new Promise(r=>setTimeout(r,40));   // let glyph atlas / FBOs settle
        app.setTime(0,{silent:true});
        return {frames:Math.round(15*fps)};
      },
      async frame(i){
        const fps=self._fps||30;
        const t=i/fps;
        app.setTime(t,{silent:true,quality:'high'});
        // guarantee the frame is fully presented before returning
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        return true;
      },
      end(){
        AE.state.exportMode=false;
        AE.state.audioOn=true;
        app.setTime(AE.state.t,{silent:true});
      }
    };
    window.videoExport=api;
    self.app=app;
  }
};

/* ---- workspace export: PNG sequence / WebM with progress + cancel ---- */
AE.workspaceExport=(app,opt)=>{
  opt=opt||{};
  return new Promise((resolve)=>{
    const fps=opt.fps||AE.state.fps;
    const range=opt.range||[AE.activeComp(app.project).workIn,AE.activeComp(app.project).workOut];
    const total=Math.max(1,Math.round((range[1]-range[0])*fps));
    let i=0,cancelled=false;
    const modal=AE.UI.openExportModal(app,{
      total,fps,range,
      onCancel:()=>{cancelled=true;}
    });
    const comp=AE.activeComp(app.project);
    const prevT=AE.state.t,prevExport=AE.state.exportMode;
    AE.state.exportMode=true;
    const step=()=>{
      if(cancelled){AE.state.exportMode=prevExport;app.setTime(prevT,{silent:true});resolve({cancelled:true});return;}
      if(i>=total){AE.state.exportMode=prevExport;app.setTime(prevT,{silent:true});resolve({cancelled:false,frames:total});return;}
      app.setTime(range[0]+i/fps,{silent:true,quality:'high'});
      if(modal.onProgress)modal.onProgress(i+1,total);
      i++;
      setTimeout(step,0);
    };
    step();
  });
};

})(window.AE);
