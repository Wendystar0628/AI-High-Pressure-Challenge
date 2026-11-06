import {THREE,PI,V,scene,root,M,mat,mesh,box,rand,dynamics} from './core.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {terrain} from './terrain.js';
import {buildings} from './buildings.js';
import {boats} from './boats.js';
import {props} from './props.js';
import {environment} from './environment.js';
import {details} from './details.js';
import {animateWildlife,animateWind,animateMoorings} from './life.js';
import {cloudCover,approachResponse} from './weather.js';
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','太阳雨中的小渔港堤岸，可用鼠标旋转、平移和缩放');
const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.08,200);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=2.2;controls.maxDistance=75;controls.maxPolarAngle=PI*.53;controls.target.set(0,.6,0);controls.zoomSpeed=.8;controls.panSpeed=.7;
const sky=new THREE.HemisphereLight('#e9f7ef','#77aaa7',1.8);scene.add(sky);
const sun=new THREE.DirectionalLight('#fff1d2',2.45);sun.position.set(-14,26,14);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:1,far:80});sun.shadow.bias=-.00025;sun.shadow.normalBias=.025;sun.shadow.radius=3;scene.add(sun);
const fill=new THREE.DirectionalLight('#bedfdf',.55);fill.position.set(16,10,-12);scene.add(fill);
const ground=box(240,.15,240,new THREE.MeshBasicMaterial({color:'#e8f1ed',toneMapped:false}),scene,0,-3.17,0,false);ground.castShadow=false;
const groundShadow=mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:'#4c8180',opacity:.16}),scene,[0,-3.085,0]);groundShadow.rotation.x=-PI/2;groundShadow.castShadow=false;
terrain();buildings();boats();props();details();environment();
let overviewPosition=V(),overviewTarget=V(0,-.35,0);
function fitOverview(){
 camera.fov=36;overviewTarget.set(0,.5,0);const dir=V(1,.74,1.15).normalize();let radius=45;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 const points=[];for(const x of [-12,12])for(const z of [-12,12])points.push(V(x,-2.95,z),V(x,.7,z));points.push(V(-9,6.4,-9),V(3.4,5.1,-9.6),V(-4.9,5.3,8.6));
 for(let i=0;i<16;i++){
  camera.position.copy(overviewTarget).addScaledVector(dir,radius);camera.lookAt(overviewTarget);camera.updateMatrixWorld();const pp=points.map(p=>p.clone().project(camera));const minX=Math.min(...pp.map(p=>p.x)),maxX=Math.max(...pp.map(p=>p.x)),minY=Math.min(...pp.map(p=>p.y)),maxY=Math.max(...pp.map(p=>p.y));
  const cy=(minY+maxY)/2,cx=(minX+maxX)/2;const halfHeight=radius*Math.tan(18*PI/180);const up=V(0,1,0).applyQuaternion(camera.quaternion),right=V(1,0,0).applyQuaternion(camera.quaternion);overviewTarget.addScaledVector(up,cy*halfHeight*.9).addScaledVector(right,cx*halfHeight*camera.aspect*.9);
  const fit=Math.max((maxX-minX)/1.86,(maxY-minY)/1.82);radius*=Math.max(.88,Math.min(1.12,fit));
 }
 camera.position.copy(overviewTarget).addScaledVector(dir,radius);camera.lookAt(overviewTarget);overviewPosition.copy(camera.position);controls.target.copy(overviewTarget);controls.update();
}
fitOverview();
const smooth=(a,b,t)=>{t=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return t*t*(3-2*t);};
const pulse=(t,a,b,c,d)=>smooth(a,b,t)*(1-smooth(c,d,t));
let exportState=null,elapsed=0,last=performance.now(),reaction=-99,reactionLevel=0,previousDistance=camera.position.distanceTo(controls.target);
// Independent shots cut at their boundaries; only camera time is choreographed.
// Wildlife, weather and the boat keep their existing absolute-time schedules.
const tourShots=[
 {start:0,end:3,name:'Harbor approach',p:[[29,23,32],[25,19,28]],q:[[0,.7,-1],[0,.7,-1]],fov:[42,42]},
 {start:3,end:5.2,name:'Bollard gull takes flight',p:[[-3.5,2.2,4.6],[-3.9,1.85,4.2]],q:[[-5.55,1.37,2.4],[-5.55,1.37,2.4]],fov:[38,38]},
 {start:5.2,end:11,name:'Berths and buoys',p:[[10,6.2,4],[4,5.3,5.5]],q:[[1,1,-1.7],[-2,1,-2.7]],fov:[48,48]},
 {start:11,end:16,name:'Cat beneath the skiff',p:[[10.45,1.2,12],[10.1,1.13,11.45]],q:[[9.5,.9,10.23],[9.5,.9,10.23]],fov:[36,34]},
 {start:16,end:22,name:'Instrument cases and umbrella',p:[[2.8,4.3,11],[1.5,3.2,10.3]],q:[[.2,.9,6.1],[.2,.9,6.1]],fov:[48,46]},
 {start:22,end:28,name:'Through the wheelhouse glass',p:[[-1.1,1.72,2.65],[-1.6,1.62,2.05]],q:[[-2.5,1.24,.42],[-2.5,1.24,.42]],fov:[44,44]},
 {start:28,end:34,name:'Warehouse shutter',p:[[-5.55,1.85,1.3],[-5.45,1.8,-.25]],q:[[-9,1.55,.6],[-9.2,1.55,.4]],fov:[50,50]},
 {start:34,end:40,name:'Waiting room windows',p:[[-5.3,1.85,-4.45],[-5.35,1.85,-5.8]],q:[[-9.45,1.65,-5.15],[-9.55,1.85,-5.55]],fov:[48,48]},
 {start:40,end:46,name:'Descending water cutaway',p:[[17,2.9,3.9],[13.4,-.7,2.3]],q:[[6,-.9,0],[6,-1.45,-.3]],fov:[44,41]},
 {start:46,end:51,name:'Lighthouse and wave breakers',p:[[10.5,5.7,-3],[8.4,4.7,-4.4]],q:[[3.7,2,-9.4],[3.7,2,-9.4]],fov:[42,42]},
 {start:51,end:60,name:'Follow the white boat and rise',p:[[4.8,6.5,8],[23,22,28]],q:[[0,.7,0],[0,.7,0]],fov:[42,42],voyage:true}
];
const tourDuration=tourShots[tourShots.length-1].end;
function tourCamera(t){
 const shot=tourShots.find(s=>t<s.end)||tourShots[tourShots.length-1],f=smooth(shot.start,shot.end,t);
 camera.position.lerpVectors(V(...shot.p[0]),V(...shot.p[1]),f);
 const q=V(...shot.q[0]).lerp(V(...shot.q[1]),f);
 if(shot.voyage){
  // Evaluate the existing route directly, so seeking never reads a stale boat pose.
  const boat=voyagePath.getPoint(THREE.MathUtils.clamp(((t%96)-30)/32,0,1));
  camera.position.add(boat);q.add(boat).lerp(V(0,.5,0),f*.7);
 }
 camera.lookAt(q);camera.fov=THREE.MathUtils.lerp(...shot.fov,f);camera.updateProjectionMatrix();controls.target.copy(q);
}
const windPoint=V(),lightPoint=V();
const localCloud=(m,t)=>{m.getWorldPosition(lightPoint);return cloudCover(lightPoint.x,lightPoint.z,t);};
const localWind=(g,t)=>{const arrival=1.5+(12-g.getWorldPosition(windPoint).x)/3.5;return pulse(t%96,arrival-.5,arrival+.25,arrival+.8,arrival+2.1);};
const voyagePath=new THREE.CatmullRomCurve3([V(7.3,0,-4.2),V(8.1,0,-6.4),V(8.3,0,-8),V(9.15,0,-9.05),V(10,0,-8.35),V(10,0,-5),V(9,0,-2.5),V(7.3,0,-4.2)]);
function update(t,react=0,reactRate=0){
 const cycle=t%96,gust=pulse(cycle,1.5,3,5,7),cloud=pulse(cycle,10,11.5,13.5,15),lull=pulse(cycle,15.5,17,23,26);
 dynamics.cloudMat.uniforms.time.value=t;
 sun.intensity=2.45*(1-.10*cloud);renderer.toneMappingExposure=1.12-.025*cloud;
 dynamics.wetMirror.material.uniforms.time.value=t;dynamics.water.material.uniforms.time.value=t;dynamics.water.material.uniforms.sun.value=1-cloud*.4;
 const flash=pulse(cycle,11.5,11.75,12.0,12.35);dynamics.beacon.intensity=flash*3.2;dynamics.beaconGlow.material.opacity=flash*.6;
 dynamics.boats.forEach(({g,x,z,ry,phase,id})=>{g.position.set(x,Math.sin(t*.8+phase)*.035,z);g.rotation.set(Math.sin(t*.63+phase)*.012,ry,Math.sin(t*.87+phase)*.018);});
 const wakeWave=(x,z)=>{const dist=Math.hypot(x-9,z+7),r=(cycle-36)*.8;return cycle>36&&cycle<60?Math.exp(-(((dist-r)/1.25)**2))*Math.sin((dist-r)*4)*.11:0;};
 dynamics.boats.forEach(({g,x,z,id})=>{if(id!==3){g.position.y+=wakeWave(x,z);g.rotation.z+=wakeWave(x,z)*.45;}});
 const voyager=dynamics.boats.find(b=>b.id===3);const sail=pulse(cycle,30,32,60,62);let boatPoint=null,voyageU=0;
 if(sail>0){const u=THREE.MathUtils.clamp((cycle-30)/32,0,1);const path=voyagePath;voyageU=u;const point=path.getPoint(u),tangent=path.getTangent(u);voyager.g.position.x=point.x;voyager.g.position.z=point.z;voyager.g.rotation.y=Math.atan2(-tangent.x,-tangent.z)*smooth(0,.055,u)*(1-smooth(.94,1,u));boatPoint=point;}
 animateMoorings(t,sail);
 dynamics.wake.visible=sail>.1;if(boatPoint){const boat=voyager.g;dynamics.wake.children.forEach((m,i)=>{const lag=.055+(i>>1)*.009,side=i%2?1:-1,u=Math.max(0,voyageU-lag),p=voyagePath.getPoint(u),tan=voyagePath.getTangent(u),spread=.27+(i>>1)*.033;m.position.set(p.x+tan.z*side*spread,.04,p.z-tan.x*side*spread);m.rotation.z=Math.atan2(-tan.x,-tan.z);});}
 const distant=dynamics.distant;distant.position.x=6.5+Math.sin(t*.055)*4.3;distant.position.z=-11.63+Math.cos(t*.055)*.02;distant.rotation.y=Math.atan2(-Math.cos(t*.055)*4.3,Math.sin(t*.055)*.02);
 dynamics.displays.forEach(m=>m.uniforms.time.value=t);dynamics.fenders.forEach(({m,phase})=>{m.rotation.z=Math.sin(t*1.25+phase)*.065;m.rotation.x=Math.sin(t*.85+phase)*.035;});
 dynamics.buoys.forEach((g,i)=>{const wake=wakeWave(g.position.x,g.position.z);g.position.y=.02+Math.sin(t*1.05-i)*.04+wake;g.rotation.z=Math.sin(t*.8-i)*.08+wake;});
 dynamics.seaweed.forEach((g,i)=>{g.rotation.z=Math.sin(t*.8+i)*.11;g.rotation.x=Math.sin(t*.55+i*.7)*.06;});
 dynamics.trees.forEach((g,i)=>{const delayed=localWind(g,t);g.rotation.z=Math.sin(t*1.3+i)*(.008+.035*delayed);});
 animateWind(t,localWind);
 dynamics.foam.forEach(({m,x,z,phase,kind})=>{m.position.x=x+Math.sin(t*.6+phase)*.035;m.position.z=z+Math.sin(t*.4+phase)*.025;m.material.opacity=(kind==='foam'?.38:.22)+Math.sin(t*1.1+phase)*.16;m.scale.x=1+Math.sin(t*.7+phase)*.22+Math.abs(wakeWave(x,z))*2;if(kind==='foam')m.material.opacity+=Math.abs(wakeWave(x,z))*2;else m.material.opacity*=1-cloudCover(x,z,t)*.75;});
 dynamics.shoreWash.forEach(({g,x,z,phase})=>{const wave=wakeWave(x,z),wash=Math.abs(wave);g.position.y=.025+Math.sin(t*1.3+phase)*.012+wave*.75;g.scale.z=.75+Math.sin(t*.8+phase)*.2+wash*10;g.children.forEach((m,i)=>m.material.opacity=(i?.07:.12)+wash*(i?2.5:3));});
 dynamics.ripples.forEach(({g,phase,speed,size})=>{const f=(t*speed+phase)%1;g.scale.setScalar(.08+f*size);g.children.forEach((m,i)=>m.material.opacity=(1-f)*(.35-lull*.12));});
 dynamics.caustics.forEach((m,i)=>{m.material.uniforms.time.value=t+i*.7;m.material.uniforms.alpha.value=(.26+Math.sin(t*.6+i)*.05)*(1-localCloud(m,t)*.70);m.rotation.z=Math.sin(t*.3+i)*.18;});
 dynamics.beams.forEach(m=>m.material.opacity=.055*(1-localCloud(m,t)*.80));
 const rain=dynamics.rain,ar=rain.m.geometry.attributes.position.array;
 rain.m.material.opacity=.36-lull*.12;
 rain.seeds.forEach(([x,y,z,len,s],i)=>{
  const yy=((y-t*4*s)%9+9)%9,arrival=1.5+(12-x)/3.5,wind=.22+pulse(cycle,arrival-.5,arrival+.25,arrival+.8,arrival+2.1)*.3;
  const xx=x-yy*wind;let floor=xx<-5||z>5?.65:0;
  if(xx>8.3&&xx<10.7&&z>4.1&&z<9.35)floor=Math.max(0,-.15+(z-4.1)/7);
  if(xx>-10.9&&xx<-6.15&&z>-2.9&&z<3.15)floor=4.55;
  if(xx>-10.9&&xx<-6.6&&z>-7.35&&z<-3.05)floor=4.05;
  const visible=xx>-11.95&&xx<11.95&&yy+len>floor&&i/rain.seeds.length<1-lull*.43;
  ar[i*6]=xx;ar[i*6+1]=visible?Math.max(floor,yy):-20;ar[i*6+2]=z;
  ar[i*6+3]=visible?xx+len*wind:xx;ar[i*6+4]=visible?yy+len:-20;ar[i*6+5]=visible?z+.025:z;
 });rain.m.geometry.attributes.position.needsUpdate=true;
 dynamics.drips.forEach(({m,x,y,z,phase})=>{const f=(t*.42+phase)%1;m.visible=f<.5;m.position.y=y-f*f*10;});
 dynamics.rainbow.children.forEach(m=>m.material.opacity=lull*.13);dynamics.mist.position.x=Math.sin(t*.08)*.4;
 animateWildlife(t,react,camera,reactRate);
}
function render(){renderer.render(scene,camera);}
// Settle the reflected view and transparent shadow receivers at the same time
// sample. No simulation time passes between these GPU passes.
function renderExportFrame(){render();render();render();renderer.getContext().finish();}
window.videoExport={
 runs:['overview','tour'],
 async begin(runId,{fps=60}={}){if(!this.runs.includes(runId))throw new Error('Unknown run: '+runId);if(!Number.isFinite(fps)||fps<=0)throw new Error('fps must be positive');exportState={run:runId,fps,time:0,frames:Math.round((runId==='overview'?5:tourDuration)*fps)};controls.enabled=false;controls.enableDamping=false;fitOverview();camera.position.copy(overviewPosition);controls.target.copy(overviewTarget);camera.lookAt(overviewTarget);if(runId==='tour')tourCamera(0);update(0,0);renderExportFrame();return {frames:exportState.frames};},
 async frame(i){if(!exportState)throw new Error('Call begin first');if(!Number.isInteger(i)||i<0||i>=exportState.frames)throw new RangeError('Frame outside run');const t=i/exportState.fps;exportState.time=t;if(exportState.run==='tour')tourCamera(t);else {camera.position.copy(overviewPosition);camera.lookAt(overviewTarget);}const react=exportState.run==='tour'?pulse(t,4,6,16,18):0,rate=exportState.run==='tour'?(pulse(t+.025,4,6,16,18)-pulse(t-.025,4,6,16,18))/.05:0;update(t,react,rate);camera.updateMatrixWorld();renderExportFrame();},
 end(){if(exportState){elapsed=exportState.time;reactionLevel=exportState.run==='tour'?pulse(elapsed,4,6,16,18):0;}exportState=null;controls.enabled=true;controls.enableDamping=true;controls.update();reaction=-99;previousDistance=camera.position.distanceTo(controls.target);last=performance.now();}
};
window.addEventListener('resize',()=>{
 const savedPosition=camera.position.clone(),savedTarget=controls.target.clone(),savedFov=camera.fov;
 const atHome=savedPosition.distanceTo(overviewPosition)<.05&&savedTarget.distanceTo(overviewTarget)<.05;
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();fitOverview();
 if(exportState){if(exportState.run==='tour')tourCamera(exportState.time);renderExportFrame();}
 else if(!atHome){camera.fov=savedFov;camera.updateProjectionMatrix();camera.position.copy(savedPosition);controls.target.copy(savedTarget);camera.lookAt(savedTarget);controls.update();}
});
renderer.domElement.addEventListener('dblclick',()=>{camera.fov=36;camera.updateProjectionMatrix();camera.position.copy(overviewPosition);controls.target.copy(overviewTarget);controls.update();});
function loop(now){requestAnimationFrame(loop);if(exportState)return;const dt=Math.max(0,Math.min((now-last)/1000,.1));last=now;elapsed+=dt;controls.update();const d=camera.position.distanceTo(controls.target);if(previousDistance-d>.02&&d<18)reaction=elapsed;previousDistance=d;const nextReaction=approachResponse(reactionLevel,elapsed-reaction,dt),rate=dt?(nextReaction-reactionLevel)/dt:0;reactionLevel=nextReaction;update(elapsed,reactionLevel,rate);render();}
update(0);render();requestAnimationFrame(loop);
window.__harbor={scene,camera,controls,renderer,dynamics,update,tourCamera,overviewPosition,overviewTarget};
