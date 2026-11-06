async () => {
 const a=studio,e=a.engine,view=a.view,saved=e.snapshot(),time=e.time,workspace=a.workspace,originalDraw=view.draw,results=[];
 const check=(name,condition)=>{results.push({name,passed:!!condition});if(!condition)throw Error(name)};
 const entry=l=>[...view.objects.values()].find(o=>o.used&&o.layer.id===l.id&&o.mesh);
 try {
  videoExport.end();a.stop();a.command('new-project');
  let l=e.add('shape');l.geometry='rect';l.pins=[{x:0,y:0,dx:0,dy:0,dz:0,radius:200,scale:1}];e.animate(l,'pin0_dz');e.set(l,'pin0_dz',100,2);e.commit();e.seek(1);
  check('图钉关键帧驱动真实网格',Math.abs(e.value(l,'pin0_dz')-50)<.01&&entry(l).mesh.geometry.boundingBox.max.z>5);
  check('平面轮廓细分为可变形网格',entry(l).mesh.geometry.attributes.position.count>20);
  l.pins=[];l.geometry='path';l.path=[{x:-150,y:0},{x:150,y:0}];l.closed=false;l.props.trim=25;e.commit();let quarter=entry(l).mesh.geometry.boundingBox.max.x-entry(l).mesh.geometry.boundingBox.min.x;l.props.trim=100;e.commit();let full=entry(l).mesh.geometry.boundingBox.max.x-entry(l).mesh.geometry.boundingBox.min.x;
  check('路径修剪按实际长度截取',Math.abs(quarter/full-.25)<.001);
  l.closed=true;l.path=[{x:-100,y:-100},{x:100,y:-100},{x:100,y:100},{x:-100,y:100}];l.morphTarget=[{x:0,y:130},{x:130,y:-90},{x:-130,y:-90}];l.morphSamples=32;l.props.morph=.5;e.commit();
  check('不同节点数轮廓匹配',Array.from(entry(l).mesh.geometry.attributes.position.array).every(Number.isFinite));
  l.masks=[{type:'path',path:[{x:-1,y:-1},{x:1,y:-1},{x:0,y:1}],size:.9,feather:3,opacity:100}];e.time=0;e.animate(l,'mask0_x');e.set(l,'mask0_x',60,2);e.commit();e.seek(1);
  check('自由路径蒙版进入实际材质',entry(l).mesh.material.userData.surface.uMaskEnabled.value===1&&entry(l).mesh.material.userData.surface.uMaskTex.value.image.width===512);
  check('蒙版参数按时间插值',Math.abs(e.value(l,'mask0_x')-30)<.01);
  a.command('new-project');let back=e.add('shape',{width:300,height:300});back.geometry='rect';back.color='#4676ab';let front=e.add('shape',{width:240,height:240,z:20,opacity:65});front.geometry='rect';front.color='#c77c60';const pixels=[];
  for(const blend of ['normal','add','screen','multiply','overlay']){front.blend=blend;e.commit();const gl=view.renderer.getContext(),data=new Uint8Array(4);gl.readPixels(Math.floor(view.canvas.width/2),Math.floor(view.canvas.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,data);pixels.push(data.join(','))}
  check('五种混合模式产生独立结果',new Set(pixels).size===5);
  front.blend='normal';front.props.glow=.8;front.props.shadow=20;front.effects=[{type:'glow',enabled:true},{type:'shadow',enabled:true}];e.commit();const first=view.canvas.toDataURL();front.effects.reverse();e.commit();check('效果顺序影响最终像素',first!==view.canvas.toDataURL());
  e.selected=[front.id,back.id];a.update();const field=document.querySelector('[data-prop="opacity"]');check('多选显示混合值',field.value===''&&field.placeholder==='混合');field.value=45;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));check('多选属性同时写入',front.props.opacity===45&&back.props.opacity===45);
  e.restore(saved);const records=[];view.draw=function(t){originalDraw.call(this,t);records.push({sample:t,title:[...this.objects.values()].find(o=>o.used&&o.layer.name.startsWith('标题 /'))?.time})};e.seek(2);view.draw=originalDraw;check('独立运动模糊开关生效',records.some(r=>r.sample!==2)&&records.every(r=>r.title===2));
  const pre=e.comp.layers.find(l=>l.name.startsWith('轨道标记 B'));e.select(pre.id);e.seek(6);a.command('enter-comp');check('进入实例遵循时间重映射',e.time===4);a.breadcrumb=[];e.restore(saved);
  const instance=e.comp.layers.find(l=>l.name.startsWith('轨道标记 A'));instance.overrides={props:{depth:70},color:'#ff0000'};e.commit();const child=[...view.objects.values()].find(o=>o.used&&o.path.includes(instance.id)&&o.layer.type==='geometry');check('实例独立数值和颜色覆盖',child.props.depth===70&&child.layer.color==='#ff0000');
  e.restore(saved);l=e.current;l.nodes.push({id:'audit-number',type:'scalar',x:100,y:300,params:{value:25}},{id:'audit-math',type:'math',x:330,y:300,params:{a:0,b:3,operation:'multiply'}});l.links.push({from:'audit-number',to:'audit-math',input:'a'},{from:'audit-math',to:'solid',input:'depth'});e.commit();check('类型化参数连接影响实际几何',e.evaluateNodes(l,2).depth===75&&entry(l).props.depth===75);
  check('新增设置可以完整序列化',JSON.stringify(JSON.parse(JSON.stringify(e.project)))===JSON.stringify(e.project));
  return {passed:true,results};
 }catch(error){return{passed:false,error:error.message,results}}
 finally{view.draw=originalDraw;a.breadcrumb=[];e.restore(saved);e.seek(time);a.setWorkspace(workspace);a.resize()}
}
