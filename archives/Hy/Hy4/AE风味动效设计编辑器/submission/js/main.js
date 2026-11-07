/* =========================================================================
   main.js — bootstrap, render loop, application API
   ========================================================================= */
(function(AE){
'use strict';
const app=AE.app={};
let dirty=true,lastNow=0,raf=0;

app.activeComp=()=>AE.activeComp(app.project);
app.markDirty=()=>{dirty=true;};

function resize(){
  const c=app.canvas,wrap=document.getElementById('canvasWrap');
  const dpr=Math.min(window.devicePixelRatio||1,1.5);
  let w=Math.max(2,Math.round(wrap.clientWidth*dpr));
  let h=Math.max(2,Math.round(wrap.clientHeight*dpr));
  // cap total pixels (keeps post-processing responsive)
  const maxPix=2300000;
  if(w*h>maxPix){const s=Math.sqrt(maxPix/(w*h));w=Math.round(w*s);h=Math.round(h*s);}
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;dirty=true;}
}

app.render=function(opts){
  opts=opts||{};
  if(!app.renderer||!app.renderer.ready)return;
  resize();
  const comp=app.activeComp();
  const frame=AE.buildFrame(app.project,comp,AE.state.t,{quality:opts.quality});
  app.frame=frame;
  app.renderer.render(frame,{
    zoom:AE.state.zoom,panX:AE.state.panX,panY:AE.state.panY,
    flipY:opts.flipY||0
  });
  if(AE.Audio)AE.Audio.update(AE.state.t,frame);
  if(AE.UI&&AE.UI.updateFrame)AE.UI.updateFrame(frame,opts);
  dirty=false;
};

app.setTime=function(t,opts){
  opts=opts||{};
  const comp=app.activeComp();
  AE.state.t=AE.clamp(t,0,comp.duration);
  app.render(opts);
  if(AE.UI&&AE.UI.refresh&&!opts.silent)AE.UI.refresh();
  else if(AE.UI&&AE.UI.refreshTime)AE.UI.refreshTime();
};

app.commit=function(label){
  if(app.history)app.history.push(label);
  if(AE.UI&&AE.UI.refresh)AE.UI.refresh();
};
app.undo=function(){if(app.history&&app.history.undo()){app.comp=app.activeComp();app.render();if(AE.UI&&AE.UI.refresh)AE.UI.refresh();}};
app.redo=function(){if(app.history&&app.history.redo()){app.comp=app.activeComp();app.render();if(AE.UI&&AE.UI.refresh)AE.UI.refresh();}};

function tick(now){
  raf=requestAnimationFrame(tick);
  const dt=Math.min(0.08,(now-(lastNow||now))/1000);lastNow=now;
  if(AE.state.exportMode)return;           // export controls time explicitly
  if(AE.state.playing){
    const comp=app.activeComp();
    AE.state.t+=dt;
    const end=AE.state.loop?AE.state.workAreaEnd||comp.workOut:comp.duration;
    const start=AE.state.loop?AE.state.workAreaStart||comp.workIn:0;
    if(AE.state.t>=end){AE.state.t=AE.state.loop?start:end;if(!AE.state.loop)AE.state.playing=false;}
    dirty=true;
    if(AE.UI&&AE.UI.refreshTime)AE.UI.refreshTime();
  }
  if(dirty)app.render();
}

function collectGlyphs(){
  let s=(AE.demoTexts||[]).join('');
  for(const c of app.project.comps)for(const l of c.layers)if(l.type==='text')s+=l.data.str||'';
  AE.Glyphs.ensure(s);
  AE.Glyphs.ensure('0123456789.:-+/()[]%×∞ °·、，。：；（）【】PRISMA');
}

function boot(){
  app.canvas=document.getElementById('gl');
  app.renderer=new AE.Renderer(app.canvas);
  if(!app.renderer.ready){
    document.getElementById('canvasWrap').innerHTML='<div style="padding:40px;color:#ff6b6b">此浏览器不支持 WebGL 2</div>';
    return;
  }
  app.project=AE.buildDemo();
  app.comp=app.activeComp();
  AE.state.fps=app.comp.fps;
  AE.state.activeCompId=app.comp.id;
  collectGlyphs();

  app.history=new AE.History(
    ()=>AE.serialize(app.project),
    (s)=>{app.project=AE.deserialize(s);app.comp=app.activeComp();AE.state.activeCompId=app.comp.id;collectGlyphs();}
  );
  app.history.reset(AE.serialize(app.project));

  if(AE.Export)AE.Export.install(app);
  if(AE.Audio)AE.Audio.init();
  if(AE.UI)AE.UI.init(app);

  window.addEventListener('resize',()=>{resize();dirty=true;});
  resize();
  app.render();
  raf=requestAnimationFrame(tick);
  if(AE.UI&&AE.UI.refresh)AE.UI.refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

})(window.AE);
