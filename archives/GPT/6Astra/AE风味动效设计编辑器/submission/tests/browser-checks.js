async () => {
 const a=window.studio,e=a.engine,saved=e.snapshot(),time=e.time,workspace=a.workspace;
 const results=[];
 const check=(name,condition,detail='')=>{results.push({name,passed:!!condition,detail});if(!condition)throw new Error(name+': '+detail)};
 try{
 a.stop();window.videoExport.end();
 check('WebGL 2 渲染上下文',a.view.canvas.getContext('webgl2') instanceof WebGL2RenderingContext);
 let l=e.current;e.time=4;const previous=l.tracks.twist.map(k=>({...k}));e.set(l,'twist',31,4);
 check('动画属性只写入当前时刻',l.tracks.twist.some(k=>k.t===4&&k.v===31)&&previous.every(k=>l.tracks.twist.find(n=>n.id===k.id)?.v===k.v));
 e.restore(saved);l=e.current;e.time=4;const before=e.world(l).elements.slice();e.set(l,'ax',35);const after=e.world(l).elements;
 check('移动锚点保持画面位置',before.every((v,i)=>Math.abs(v-after[i])<.0001));
 e.restore(saved);l=e.current;e.time=4;e.set(l,'ax',35);e.set(l,'ay',-20);const anchored=e.world(l).elements.slice();e.reparent(l,null);check('非零锚点解除父级保留画面',anchored.every((v,i)=>Math.abs(v-e.world(l).elements[i])<.0001));
 e.restore(saved);const original=e.current,parent=e.comp.layers.find(q=>q.id===original.parent);e.selected=[original.id,parent.id];e.duplicate();const copied=e.comp.layers.find(q=>q.id===e.selected[0]),copiedParent=e.comp.layers.find(q=>q.id===e.selected[1]);check('成组复制保留内部父级',copied.parent===copiedParent.id);
 e.restore(saved);const synth=e.comp.layers.find(q=>q.type==='synth'),wave=a.sound.generate(8000);synth.notes[0].note+=12;e.revision++;const changed=a.sound.generate(8000);check('编辑音符改变实际音频',wave.channels[0].some((v,i)=>Math.abs(v-changed.channels[0][i])>.001));for(const q of e.comp.layers.filter(q=>q.type==='synth')){q.props.volume=0;delete q.tracks.volume}e.revision++;check('音量影响生成音轨',a.sound.generate(8000).channels[0].every(v=>v===0));
 e.restore(saved);l=e.current;const matrix=e.world(l,4).elements.slice();const id=l.id;e.precompose();const sub=e.project.comps.find(c=>c.id===e.current.compId),child=sub.layers.find(q=>q.id===id),afterPre=e.world(child,4,sub).elements;
 check('预合成保留外部父级动画',matrix.every((v,i)=>Math.abs(v-afterPre[i])<.0001));
 e.restore(saved);l=e.comp.layers.find(l=>l.name.startsWith('卫星'));e.time=4;const v=e.value(l,'x');e.set(l,'x',v+30);
 check('表达式属性可直接编辑',Math.abs(e.value(l,'x')-v-30)<.0001);
 e.restore(saved);l=e.current;l.expressions.rz='thisComp.layer("'+l.name+'").transform.rotation';e.errors={};const fallback=e.value(l,'rz',2);
 check('循环表达式回退并报告',Number.isFinite(fallback)&&!!e.errors[l.id]);
 e.restore(saved);l=e.current;const source=e.comp.layers.find(l=>l.name==='形态控制器');l.expressions.x='thisComp.layer("形态控制器").transform.rotation.valueAtTime(2)';
 check('跨时刻引用',Math.abs(e.value(l,'x',6)-e.value(source,'rz',2))<.00001);
 e.restore(saved);const beforeJSON=JSON.stringify(e.project);e.project=JSON.parse(beforeJSON);check('工程完整序列化',JSON.stringify(e.project)===beforeJSON);
 const frameInfo=await videoExport.begin('demo',{fps:60});check('正式导出 900 帧',frameInfo.frames===900);
 await videoExport.frame(480);const sim=()=>JSON.stringify([...a.view.sims.values()].map(s=>s.particles.map(p=>[p.id,...p.pos.toArray().map(n=>+n.toFixed(5)),p.hit])));const hash=sim();
 await videoExport.frame(120);await videoExport.frame(480);check('任意跳转模拟结果一致',hash===sim());
 check('实际发生网格碰撞',[...a.view.sims.values()].some(s=>s.particles.some(p=>p.hit)));
 await videoExport.frame(899);check('结尾粒子收束',a.view.particleCount===0);
 videoExport.end();a.command('new-project');check('空工程',e.comp.layers.length===0);const shape=e.add('shape');shape.geometry='rect';e.commit();check('从空工程创建形状',[...a.view.objects.values()].some(o=>o.used&&o.layer.id===shape.id&&o.mesh.geometry.attributes.position.count>0));
 e.selected=[shape.id];a.command('node-setup');const beforeGeom=[...a.view.objects.values()].find(o=>o.used&&o.layer.id===shape.id).mesh.geometry.attributes.position.array.slice();shape.nodes.find(n=>n.type==='twist').params.amount=90;e.commit();const afterGeom=[...a.view.objects.values()].find(o=>o.used&&o.layer.id===shape.id).mesh.geometry.attributes.position.array;
 check('节点修改影响实际顶点',beforeGeom.some((v,i)=>Math.abs(v-afterGeom[i])>.01));
 e.restore(saved);a.setWorkspace('graph');check('曲线工作区不覆盖时间轴',Math.abs(document.querySelector('.composition').getBoundingClientRect().bottom-document.querySelector('.timeline').getBoundingClientRect().top)<1);
 return {passed:results.every(r=>r.passed),results};
 }catch(error){return {passed:false,error:error.message,results}}finally{videoExport.end();e.restore(saved);e.seek(time);a.setWorkspace(workspace);a.resize()}
}
