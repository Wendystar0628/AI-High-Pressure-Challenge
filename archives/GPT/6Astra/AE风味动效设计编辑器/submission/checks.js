/* Load in the editor page, then await runForgeChecks(). No network required. */
window.runForgeChecks=async function(){
await ready;let saved={project:clone(project),time,selected:[...selected],view,history:[...history],future:[...future]},checks=[];
const assert=(name,ok)=>{checks.push({name,passed:!!ok});if(!ok)throw Error(name);};
const pixels=()=>{let gl=engine.renderer.getContext(),p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);let hash=0;for(let i=0;i<p.length;i+=19)hash=(hash*31+p[i])|0;return hash;};
try{
assert('WebGL 2 context',engine.renderer.getContext() instanceof WebGL2RenderingContext);
let result=await videoExport.begin('demo',{fps:3});assert('3 fps: 45 frames',result.frames===45);
await videoExport.frame(22);let h=pixels();await videoExport.frame(30);await videoExport.frame(22);assert('Random access determinism',pixels()===h);
let source=activeComp().layers[0];source.text='金';engine.invalidate();await videoExport.frame(22);assert('Source glyph propagates',pixels()!==h);source.text='永';engine.invalidate();await videoExport.frame(22);assert('Source restore is reproducible',pixels()===h);
assert('Particles collide with actual meshes',[...engine.particleCache.values()].some(s=>s.frames.some(f=>f.some(p=>p.hit))));
await videoExport.frame(42);h=pixels();await videoExport.frame(44);assert('Final frames settle',pixels()===h);videoExport.end();
result=await videoExport.begin('demo',{fps:60});assert('60 fps: 900 frames',result.frames===900);await videoExport.frame(0);videoExport.end();
project=demoProject();selected=[1];time=4.8;engine.invalidate();refresh();source=current();source.expressions.rz='time * 20';assert('Expression evaluation',value(source,'rz',2)===40);source.expressions.rz='thisComp.layer("锻字 · 永").transform.rotation';assert('Cycle falls back',value(source,'rz',2)===baseValue(source,'rz',2)&&!!evalErrors['1:rz']);delete source.expressions.rz;
let old=source.keys.depth.length;setProp(source,'depth',.7);assert('Animated edits create current key',source.keys.depth.length===old+1&&source.keys.depth.some(k=>k.t===time&&k.v===.7));
source.keys.depth=source.keys.depth.filter(k=>k.t!==time);render();h=pixels();selected=activeComp().layers.map(l=>l.id);precompose();$('#precomp-ok').click();assert('Precompose preserves image',pixels()===h);undo();selected=[1];
source=current();let links=clone(source.links);source.links=source.links.filter(e=>e[1]!=='output');engine.invalidate();render();assert('Disconnected graph stops geometry',!engine.objects.get(1)?.userData.mesh);source.links=links;engine.invalidate();render();
h=pixels();project=JSON.parse(JSON.stringify(project));engine.invalidate();refresh();assert('JSON round trip preserves pixels',pixels()===h);
activeComp().motion=true;render();assert('Shutter samples are rendered',!!engine.accum);activeComp().motion=false;
return {passed:checks.length,checks};
}finally{if(exporting)videoExport.end();project=saved.project;time=saved.time;selected=saved.selected;history=saved.history;future=saved.future;switchView(saved.view);engine.invalidate();refresh();}
};
