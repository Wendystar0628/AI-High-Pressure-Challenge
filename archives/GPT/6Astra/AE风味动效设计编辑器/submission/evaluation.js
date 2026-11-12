/* Composition-local evaluation and serializable geometry dataflow. */
'use strict';
function ownerComp(l){return project.comps.find(c=>c.layers.some(a=>a.id===l.id))||activeComp();}
function findLayer(id){return project.comps.flatMap(c=>c.layers).find(l=>l.id===id);}
value=function(l,p,t,stack=[]){
  const key=l.id+':'+p,base=baseValue(l,p,t),expression=l.expressions?.[p];
  if(!expression){delete evalErrors[key];return base;}
  if(stack.includes(key))throw Error('循环引用：'+l.name+'.'+p);
  try{
    const deps=[...stack,key],keys=[...(l.keys[p]||[])].sort((a,b)=>a.t-b.t);
    const property=(obj,pr,at=t)=>({valueOf:()=>value(obj,pr,at,deps),toString:()=>String(value(obj,pr,at,deps)),valueAtTime:tt=>value(obj,pr,tt,deps)});
    const vector=(obj,props,at=t)=>{let a=props.map(pr=>property(obj,pr,at));a.valueAtTime=tt=>props.map(pr=>value(obj,pr,tt,deps));return a;};
    const transform=obj=>new Proxy({},{get:(_,name)=>name==='position'?vector(obj,['x','y','z']):name==='anchorPoint'?vector(obj,['ax','ay','az']):property(obj,{rotation:'rz',rotationX:'rx',rotationY:'ry',rotationZ:'rz'}[name]||name)});
    const ref=obj=>new Proxy({transform:transform(obj)},{get:(target,name)=>name in target?target[name]:property(obj,name)});
    const compRef=c=>({name:c.name,duration:c.duration,frameDuration:1/c.fps,layer:name=>{let obj=typeof name==='number'?c.layers[name-1]:c.layers.find(a=>a.name===name);if(!obj)throw Error('找不到图层：'+name);return ref(obj);}});
    const linear=(x,a,b,c,d)=>mix(c,d,clamp((x-a)/(b-a))),ease=(x,a,b,c,d)=>mix(c,d,smooth((x-a)/(b-a)));
    const loopOut=(mode='cycle')=>{if(keys.length<2||t<=keys.at(-1).t)return base;let start=keys[0].t,duration=keys.at(-1).t-start;if(duration<=0)return base;let x=(t-start)/duration,u=x%1;if(mode==='pingpong'&&Math.floor(x)%2)u=1-u;return baseValue(l,p,start+u*duration);};
    const wiggle=(f,a)=>base+a*(Math.sin(t*f*6.283+l.id*9.1)*.65+Math.sin(t*f*10.178+l.id)*.35);
    const result=Number(Function('time','value','wiggle','loopOut','linear','ease','thisComp','thisLayer','valueAtTime','comp','Math','return ('+expression.trim().replace(/;$/,'')+')')(t,base,wiggle,loopOut,linear,ease,compRef(ownerComp(l)),ref(l),tt=>baseValue(l,p,tt),name=>{let c=project.comps.find(c=>c.name===name);if(!c)throw Error('找不到合成：'+name);return compRef(c);},Math));
    if(!Number.isFinite(result))throw Error('表达式必须返回有限数值');delete evalErrors[key];return result;
  }catch(error){evalErrors[key]=error.message;if(stack.length)throw error;return base;}
};

ForgeEngine.prototype.transform=function(obj,l,t){
  obj.rotation.set(...['rx','ry','rz'].map(p=>value(l,p,t)*Math.PI/180));obj.scale.setScalar(value(l,'scale',t));
  const anchor=new THREE.Vector3(value(l,'ax',t),value(l,'ay',t),value(l,'az',t)).multiply(obj.scale).applyEuler(obj.rotation);
  obj.position.set(value(l,'x',t)-anchor.x,value(l,'y',t)-anchor.y,value(l,'z',t)-anchor.z);
};
worldMatrix=function(l,t,seen=[]){let obj=new THREE.Object3D();engine.transform(obj,l,t);obj.updateMatrix();let parent=ownerComp(l).layers.find(a=>a.id===l.parent);if(parent&&!seen.includes(l.id))obj.matrix.premultiply(worldMatrix(parent,t,[...seen,l.id]));return obj.matrix;};
function assignLocalMatrix(l,m,t){let p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();m.decompose(p,q,s);let a=new THREE.Vector3(value(l,'ax',t),value(l,'ay',t),value(l,'az',t)).multiply(s).applyQuaternion(q);p.add(a);let r=new THREE.Euler().setFromQuaternion(q);for(let axis of ['x','y','z'])setProp(l,axis,p[axis]);['rx','ry','rz'].forEach((k,i)=>setProp(l,k,[r.x,r.y,r.z][i]*180/Math.PI));setProp(l,'scale',s.x);}

const graphCoreGeometry=ForgeEngine.prototype.geometry;
function mergeCopies(g,count,step){
  let src=g.index?g.toNonIndexed():g,attributes={};
  for(let name of ['position','normal','uv']){let attr=src.getAttribute(name);if(!attr)continue;let array=new Float32Array(attr.array.length*count);for(let i=0;i<count;i++){array.set(attr.array,i*attr.array.length);if(name==='position')for(let j=0;j<attr.count;j++){let k=i*attr.array.length+j*3;array[k]+=step[0]*i;array[k+1]+=step[1]*i;array[k+2]+=step[2]*i;}}attributes[name]=new THREE.BufferAttribute(array,attr.itemSize);}
  let out=new THREE.BufferGeometry();for(let name in attributes)out.setAttribute(name,attributes[name]);if(src!==g)src.dispose();return out;
}
function nodeParameter(l,n,t,fallback=0){let p='node:'+n.id+':amount';return l.props[p]!=null||l.keys[p]||l.expressions[p]?value(l,p,t):n.amount??fallback;}
const nodeTypes={source:{out:'geometry',title:'几何源'},extrude:{in:'geometry',param:'scalar',out:'geometry',title:'挤出实体'},deform:{in:'geometry',param:'scalar',out:'geometry',title:'空间变形'},transform:{in:'geometry',param:'vector',out:'geometry',title:'几何变换'},repeat:{in:'geometry',param:'scalar',out:'geometry',title:'重复分布'},material:{in:'geometry',param:'color',out:'geometry',title:'表面材质'},output:{in:'geometry',title:'场景输出'},scalar:{out:'scalar',title:'标量'},vector:{out:'vector',title:'向量'},color:{out:'color',title:'颜色'},field:{out:'field',title:'空间场'},fieldDeform:{in:'geometry',param:'field',out:'geometry',title:'场变形'},group:{out:'geometry',title:'节点组'}};
function evaluateGraph(l,t,nodes=l.nodes,links=l.links){
  let cache=new Map(),visiting=new Set();
  const run=id=>{
    if(cache.has(id))return cache.get(id);if(visiting.has(id))throw Error('节点循环：'+id);visiting.add(id);
    let n=nodes.find(n=>n.id===id);if(!n)throw Error('节点不存在：'+id);let spec=nodeTypes[n.type]||nodeTypes.transform;
    const input=(port='geometry',required=true)=>{let edge=links.find(e=>e[1]===id&&(e[2]||'geometry')===port);if(!edge){if(required)throw Error('未连接 '+n.name+' 的 '+port+' 输入');return null;}let v=run(edge[0]),expected=port==='geometry'?spec.in:spec.param;if(expected&&v.type!==expected)throw Error('端口类型不匹配：'+v.type+' → '+expected);return v;};
    let result;
    if(n.type==='source'){let source=n.sourceId?findLayer(+n.sourceId):l;if(!source)throw Error('源图层不存在');result={type:'geometry',source,depth:value(source,'depth',t),ops:[],material:null};}
    else if(n.type==='scalar')result={type:'scalar',value:nodeParameter(l,n,t,1)};
    else if(n.type==='vector')result={type:'vector',value:(n.vector||[1,0,0]).map(Number)};
    else if(n.type==='color')result={type:'color',value:n.color||'#d3b58e'};
    else if(n.type==='field')result={type:'field',value:+n.sourceId||null};
    else if(n.type==='group')result=evaluateGraph(l,t,n.nodes||[],n.links||[]);
    else{
      result={...input(),ops:[...input().ops]};let parameter=input('parameter',false),amount=parameter?.value;
      if(n.type==='extrude')result.depth=Number(amount??nodeParameter(l,n,t,value(l,'depth',t)));
      if(n.type==='deform')result.ops.push({type:'deform',bend:Number(amount??nodeParameter(l,n,t,value(l,'bend',t))),twist:value(l,'twist',t)});
      if(n.type==='repeat')result.ops.push({type:'repeat',count:clamp(Math.floor(amount??nodeParameter(l,n,t,3)),1,32),step:n.vector||[2.5,0,0]});
      if(n.type==='transform')result.ops.push({type:'transform',offset:Array.isArray(amount)?amount:n.vector||[nodeParameter(l,n,t,0),0,0],scale:n.scale??1,rotation:n.rotation||0});
      if(n.type==='material')result.material=amount||n.color||result.material;
      if(n.type==='fieldDeform')result.ops.push({type:'field',id:amount});
    }
    visiting.delete(id);cache.set(id,result);return result;
  };
  let out=nodes.find(n=>n.type==='output')||nodes.find(n=>n.type==='group');if(!out)throw Error('缺少输出节点');return run(out.id);
}
ForgeEngine.prototype.nodeConfig=function(l,t){if(!l.nodes?.length)return {enabled:true,count:1,depth:value(l,'depth',t),bend:value(l,'bend',t),twist:value(l,'twist',t)};try{evaluateGraph(l,t);delete evalErrors['nodes:'+l.id];return {enabled:true,count:1};}catch(e){evalErrors['nodes:'+l.id]=e.message;return {enabled:false,count:1};}};
ForgeEngine.prototype.geometry=function(l,t){
  if(!l.nodes?.length)return graphCoreGeometry.call(this,l,t);
  let payload;try{payload=evaluateGraph(l,t);}catch(e){evalErrors['nodes:'+l.id]=e.message;return null;}
  this.graphGeometryCache??=new Map();let sig=JSON.stringify([this.revision,l.id,t,payload.source,l.nodes,l.links]);if(this.graphGeometryCache.has(sig))return this.graphGeometryCache.get(sig);
  let source=payload.source,plain={...source,nodes:[],links:[],props:{...source.props,depth:payload.depth,bend:0,twist:0},keys:{...source.keys,depth:[],bend:[],twist:[]},expressions:{...source.expressions,depth:'',bend:'',twist:''}};
  let original=graphCoreGeometry.call(this,plain,t);if(!original)return null;let g=original.clone();
  for(let op of payload.ops){
    if(op.type==='repeat'){let next=mergeCopies(g,op.count,op.step);g.dispose();g=next;}
    if(op.type==='transform'){let m=new THREE.Matrix4().compose(new THREE.Vector3(...op.offset),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),op.rotation*Math.PI/180),new THREE.Vector3().setScalar(op.scale));g.applyMatrix4(m);}
    if(op.type==='deform'){let p=g.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=op.twist*y*Math.PI/180;p.setXYZ(i,x*Math.cos(a)-z*Math.sin(a),y-op.bend*Math.exp(-x*x*1.7)*Math.max(0,y+.4),x*Math.sin(a)+z*Math.cos(a)+op.bend*.35*Math.sin(y*2));}}
    if(op.type==='field'){let f=findLayer(op.id);if(f){let p=g.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i)-value(f,'x',t),y=p.getY(i)-value(f,'y',t),a=clamp(1-Math.hypot(x,y)/value(f,'radius',t))*value(f,'strength',t);p.setZ(i,p.getZ(i)+a*.3);}}}
  }
  g.computeVertexNormals();smoothNormals(g);g.computeBoundingBox();g.userData.materialColor=payload.material;
  if(this.graphGeometryCache.size>=80){let key=this.graphGeometryCache.keys().next().value;this.graphGeometryCache.get(key).dispose();this.graphGeometryCache.delete(key);}this.graphGeometryCache.set(sig,g);return g;
};

const evaluationBuild=ForgeEngine.prototype.build;
ForgeEngine.prototype.build=function(l,t,parent,comp,depth=0){let sampled=this.exposureCenter!=null&&l.motion===false?this.exposureCenter:t;let obj=evaluationBuild.call(this,l,sampled,parent,comp,depth);if(obj){obj.userData.definition=l;obj.userData.sampleTime=sampled;obj.userData.comp=comp;let mesh=obj.userData.mesh;if(mesh){let color=mesh.geometry.userData.materialColor;if(color)mesh.material.color.set(color);mesh.castShadow=l.castShadow!==false;mesh.receiveShadow=l.receiveShadow!==false;mesh.material.depthWrite=mesh.material.opacity>=.999;}}return obj;};

const evaluationInspector=drawInspector;
drawInspector=function(){evaluationInspector();let l=current();if(!l)return;
  for(let p of ['ax','ay']){let input=$('[data-prop="'+p+'"]');if(input)input.onchange=()=>{snapshot();let delta=new THREE.Vector3(p==='ax'?+input.value-value(l,p,time):0,p==='ay'?+input.value-value(l,p,time):0,0),r=new THREE.Euler(...['rx','ry','rz'].map(k=>value(l,k,time)*Math.PI/180));delta.multiplyScalar(value(l,'scale',time)).applyEuler(r);for(let axis of ['x','y','z'])setProp(l,axis,value(l,axis,time)+delta[axis]);setProp(l,p,+input.value);changed();};}
  let parent=$('#parent');if(parent)parent.onchange=()=>{let id=+parent.value||null,p=findLayer(id);while(p){if(p.id===l.id){toast('父级关系不能形成循环');parent.value=l.parent||'';return;}p=findLayer(p.parent);}snapshot();let m=worldMatrix(l,time);if(id)m.premultiply(worldMatrix(findLayer(id),time).invert());l.parent=id;assignLocalMatrix(l,m,time);changed();};
};

function remapTime(l,t){return l.keys.timeRemap?.length||l.expressions.timeRemap?value(l,'timeRemap',t):(t-l.in)*value(l,'timeScale',t)+value(l,'timeOffset',t);}
function sceneInstances(comp,t,base=new THREE.Matrix4(),path='',seen=[]){
  if(seen.includes(comp.id))return [];let result=[];
  for(let l of comp.layers){if(!l.visible||t<l.in||t>l.out)continue;let matrix=base.clone().multiply(worldMatrix(l,t)),parent=l.parent?comp.layers.find(a=>a.id===l.parent):null,parentMatrix=base.clone();if(parent)parentMatrix.multiply(worldMatrix(parent,t));let record={layer:l,time:t,matrix,parentMatrix,path:path+'/'+l.id,comp};
    if(l.type==='precomp'){let child=project.comps.find(c=>c.id===l.compId);if(child)result.push(...sceneInstances(child,remapTime(l,t),matrix,record.path,[...seen,comp.id]));}
    else result.push(record);
  }return result;
}
const finalSceneRender=ForgeEngine.prototype.finishRender;
ForgeEngine.prototype.finishRender=function(comp,t,opts){
  this.instances=sceneInstances(comp,t);let camera=this.instances.find(i=>i.layer.type==='camera');if(camera){let at=this.exposureCenter!=null&&camera.layer.motion===false?this.exposureCenter:camera.time;if(at!==camera.time)camera=sceneInstances(comp,at).find(i=>i.path===camera.path)||camera;this.camera.position.setFromMatrixPosition(camera.matrix);let target=new THREE.Vector3(...['targetX','targetY','targetZ'].map(p=>value(camera.layer,p,camera.time))).applyMatrix4(camera.parentMatrix);this.camera.lookAt(target);this.camera.fov=value(camera.layer,'fov',camera.time);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);}
  if(this.exposureCenter!=null){let centered=sceneInstances(comp,this.exposureCenter);for(let i of centered){if(i.layer.motion!==false)continue;let obj=this.objects.get(i.layer.id);if(!obj?.parent)continue;obj.matrixAutoUpdate=false;obj.matrix.copy(obj.parent.matrixWorld.clone().invert().multiply(i.matrix));obj.updateMatrixWorld(true);}}
  if(this.placeScreenLayers)this.placeScreenLayers();return finalSceneRender.call(this,comp,t,opts);
};
const exposureRender=ForgeEngine.prototype.renderExposure;
ForgeEngine.prototype.renderExposure=function(comp,t,opts={}){if(!comp.motion)return this.render(comp,t,opts);this.exposureCenter=t;
  // Bootstrap the reusable accumulation targets without adding another temporal step.
  if(!this.accum){let restore=comp.motion;comp.motion=false;exposureRender.call(this,comp,t,opts);comp.motion=restore;this.accum=[0,1].map(()=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType}));this.mixScene=new THREE.Scene();this.mixMaterial=new THREE.ShaderMaterial({uniforms:{a:{value:null},b:{value:null},weight:{value:0}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 v;uniform sampler2D a,b;uniform float weight;void main(){gl_FragColor=mix(texture2D(a,v),texture2D(b,v),weight);}'});this.mixScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.mixMaterial));}
  let shutter=(comp.shutter??180)/360/comp.fps,start=t+(comp.phase??-90)/360/comp.fps;
  try{for(let i=0;i<5;i++){this.render(comp,clamp(start+shutter*i/4,0,comp.duration),{...opts,capture:true});for(let target of this.accum)if(target.width!==this.target.width||target.height!==this.target.height)target.setSize(this.target.width,this.target.height);this.mixMaterial.uniforms.a.value=i?this.accum[1-i%2].texture:this.target.texture;this.mixMaterial.uniforms.b.value=this.target.texture;this.mixMaterial.uniforms.weight.value=1/(i+1);this.renderer.setRenderTarget(this.accum[i%2]);this.renderer.render(this.mixScene,this.postCamera);}
  }finally{this.exposureCenter=null;}
  // Restore central-time object matrices for accurate selection, without altering the accumulation.
  this.render(comp,t,{...opts,capture:true});this.postMaterial.uniforms.map.value=this.accum[0].texture;this.renderer.setRenderTarget(null);this.renderer.render(this.postScene,this.postCamera);this.postMaterial.uniforms.map.value=this.target.texture;
};
