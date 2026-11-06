import {THREE,PI,V,dynamics} from './core.js';
const clamp=THREE.MathUtils.clamp;
const smooth=(a,b,t)=>{const u=clamp((t-a)/(b-a),0,1);return u*u*(3-2*u);};
const pulse=(t,a,b,c,d)=>smooth(a,b,t)*(1-smooth(c,d,t));
const angleMix=(a,b,f)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*f;
const fishPoint=V(),nextFish=V();

function fishPosition(t,phase,school,index,react,out){
 const a=t*.17+school*2.1,spread=1+react*.8,slot=(Math.floor(index/3)-2)*.24;
 const behind=slot*spread,aside=Math.sin(phase*3.1)*.22*spread;
 return out.set(5.7+Math.cos(a)*2.35-Math.sin(a)*behind+Math.cos(a)*aside+Math.cos(phase*2.7)*react*.85,
  -1.35+Math.sin(t*.3+phase)*.22-react*.18,
  -.9+Math.sin(a)*2.15+Math.cos(a)*behind+Math.sin(a)*aside+Math.sin(phase*2.7)*react*.85);
}

function gullPose(t,id,react){
 const phase=t*.18+id*.85,radius=3.8+id*.2;
 const p=V(2.5+Math.cos(phase)*radius,4.3+Math.sin(phase*.8+id)*.8,Math.sin(phase)*radius-1.5);
 let rest=0,water=false;
 if(id>=5){
  rest=pulse((t+id*4)%43,15,21,31,37)*(1-smooth(0,.8,react));
  let perch;
  if(id===5){perch=V(3.7+Math.sin(t*.25)*.65,.13+Math.sin(t*1.05)*.025,-1.5+Math.cos(t*.19)*.45);water=true;}
  else if(id===7){const boat=dynamics.boats[0].g;boat.updateMatrixWorld();perch=boat.localToWorld(V(-.35,2.26,-.1));}
  else perch=id===6?V(-5.55,1.31,2.4):V(4.65,1.31,5.7);
  p.lerp(perch,rest);
 }else if(id===3||id===4){
  const skim=pulse((t+id*7)%41,7,11,16,20)*(1-react);
  p.lerp(V(3+Math.sin(phase)*1.55,.18+Math.sin(t*1.3)*.035,-2+Math.cos(phase)*2.3),skim);
 }
 p.y+=react*(.8+id*.06);
 return {p,rest,water};
}

const catPaths=[
 [[9.5,10.03],[8.6,10.7],[7.2,10.25],[6.55,9.65],[6.5,9.05],[7.2,9.15],[8.5,10.1]],
 [[9.5,10.03],[8.6,10.7],[7.3,11.1],[6.5,10.75],[6.1,10.05],[7.5,9.85],[8.5,10.1]],
 [[9.5,10.03],[8.6,10.7],[7.3,10.1],[7.0,9.3],[7.35,8.8],[8.0,9.35],[8.5,10.1]]
].map(points=>new THREE.CatmullRomCurve3(points.map(([x,z])=>V(x,0,z)),true,'centripetal'));
function catProgress(cycle){return cycle<21?.5*smooth(16.5,19.7,cycle):.5+.5*smooth(21,24.9,cycle);}

export function animateWildlife(t,react,camera,reactRate=0){
 dynamics.fish.forEach(({g,phase,school,tail},i)=>{
  fishPosition(t,phase,school,i,react,fishPoint);fishPosition(t+.025,phase,school,i,clamp(react+reactRate*.025,0,1),nextFish);
  g.position.copy(fishPoint);g.rotation.y=Math.atan2(nextFish.x-fishPoint.x,nextFish.z-fishPoint.z);
  g.rotation.z=Math.sin(t*5+phase)*.045;
  tail.rotation.y=Math.sin(t*(7+react*3)+phase)*(.24+react*.12);
 });
 dynamics.gulls.forEach(({g,wings,feet,id})=>{
  const {p,rest,water}=gullPose(t,id,react),before=gullPose(t-.03,id,clamp(react-reactRate*.03,0,1)).p,after=gullPose(t+.03,id,clamp(react+reactRate*.03,0,1)).p;
  const velocity=after.sub(before),flightYaw=Math.atan2(velocity.x,velocity.z),fold=smooth(.72,.985,rest);
  g.position.copy(p);g.rotation.set(-Math.atan2(velocity.y,Math.max(.02,Math.hypot(velocity.x,velocity.z)))*.3,
   angleMix(flightYaw,id*.7,fold),Math.sin(t*.18+id)*.12*(1-fold));
  wings.forEach((w,i)=>{const side=i?1:-1;w.rotation.y=side*1.28*fold;w.rotation.z=side*((.06+Math.sin(t*(2.3+id*.1)+id)*.2)*(1-fold)-.10*fold);});
  feet.visible=rest>.75&&!water;feet.rotation.x=(1-rest)*1.1;
  g.userData.rest=rest;
 });
 const cat=dynamics.cat,cycle=t%96,path=catPaths[((Math.floor(t/96)%catPaths.length)+catPaths.length)%catPaths.length],u=catProgress(cycle),p=path.getPoint(u%1),tangent=path.getTangent(u%1);
 const speed=Math.abs(catProgress(cycle+.025)-catProgress(cycle-.025))/.05;
 const walk=clamp(speed*9,0,1),active=pulse(cycle,16.5,17.1,24.3,24.9),step=u*PI*32;
 const standing=pulse(cycle,16.0,16.7,24.9,25.5);
 cat.g.position.set(p.x,.62+Math.abs(Math.sin(step))*.018*walk,p.z);
 cat.g.rotation.y=angleMix(0,Math.atan2(tangent.x,tangent.z),active);
 const look=Math.atan2(camera.position.x-p.x,camera.position.z-p.z)-cat.g.rotation.y;
 cat.head.rotation.y=Math.sin(t*.42)*.13+clamp(Math.atan2(Math.sin(look),Math.cos(look)),-.7,.7)*react;
 cat.head.rotation.x=-.22*react+Math.sin(t*.3)*.035;
 cat.torso.position.y=.12+.07*standing;cat.torso.scale.set(1,.65+.35*standing,1.08-.08*standing);
 cat.head.position.y=.20+.10*standing+.035*react*(1-standing);
 cat.legs.forEach((g,i)=>{const rest=g.userData.front?-PI/2:PI/2;g.position.y=THREE.MathUtils.lerp(g.userData.front?.03:.10,.165,standing);g.rotation.x=THREE.MathUtils.lerp(rest,Math.sin(step+(i===0||i===3?0:PI))*.48*walk,standing);});
 cat.tail.position.y=.08+.06*standing;
 cat.tail.rotation.y=Math.sin(t*.8)*(.08+.12*(1-walk));
 const blink=pulse(t%8.7,6.9,7.03,7.13,7.29)*(1-react*.8);
 cat.eyes.forEach(eye=>eye.scale.y=.68*(1-blink*.94));
 cat.g.userData.walk=walk;
}

export function animateWind(t,localWind){
 dynamics.flags.forEach((g,i)=>{
  const gust=localWind(g,t),cloth=g.userData.fabric;
  g.rotation.y=Math.sin(t*.8+i)*(.03+gust*.12);
  if(!cloth)return;
  const attr=cloth.geometry.attributes.position,base=cloth.userData.base;
  for(let j=0;j<attr.count;j++){
   const k=j*3,x=base[k],y=base[k+1],z=base[k+2],u=g.userData.sock?x/1.15:(x+.35)/.7;
   const amplitude=(.026+gust*.13)*u;
   attr.setXYZ(j,x,y+Math.sin(t*3.1-u*5+i)*amplitude*.38+(g.userData.sock?(-.13+.1*gust)*u:0),z+Math.sin(t*4.2-u*7+i)*amplitude);
  }
  attr.needsUpdate=true;cloth.geometry.computeVertexNormals();
 });
 dynamics.nets.forEach((g,i)=>{
  const gust=localWind(g,t);
  g.children.forEach(m=>{
   const attr=m.geometry.attributes.position,base=m.userData.base;
   for(let j=0;j<attr.count;j++){
    const k=j*3,x=base[k],y=base[k+1],z=base[k+2],u=clamp(-y/1.5,0,1);
    attr.setXYZ(j,x+Math.sin(t*1.2-y*2)*u*.012,y,z+Math.sin(t*2.2+x*2.6-y*2)*(.025+gust*.12)*u);
   }
   attr.needsUpdate=true;
  });
 });
}

const ropeA=V(),ropeB=V(),center=V(),tangent=V(),side=V(),up=V(),axis=V(0,1,0);
export function animateMoorings(t,sail){
 for(const rope of dynamics.ropes){
  const {m,id,a,attachment,boat}=rope;
  const release=id===3?1-pulse(t%96,30,30.8,61.3,62):1;
  m.visible=release>.001;m.material.opacity=release;if(!m.visible)continue;
  boat.updateMatrixWorld();ropeA.fromArray(a);ropeB.copy(attachment).applyMatrix4(boat.matrixWorld);
  const distance=ropeA.distanceTo(ropeB),sag=.20+Math.sin(t*.8+id)*.025+(1-release)*.5;
  const attr=m.geometry.attributes.position,normals=m.geometry.attributes.normal;
  for(let i=0;i<=32;i++){
   const u=i/32;center.lerpVectors(ropeA,ropeB,u);center.y-=Math.sin(u*PI)*sag;
   tangent.subVectors(ropeB,ropeA);tangent.y-=PI*Math.cos(u*PI)*sag;tangent.normalize();
   side.crossVectors(tangent,axis).normalize();up.crossVectors(side,tangent).normalize();
   for(let j=0;j<=6;j++){
    const a=j/6*PI*2,cs=Math.cos(a),sn=Math.sin(a),index=i*7+j;
    const nx=side.x*cs+up.x*sn,ny=side.y*cs+up.y*sn,nz=side.z*cs+up.z*sn;
    attr.setXYZ(index,center.x+nx*.023,center.y+ny*.023,center.z+nz*.023);normals.setXYZ(index,nx,ny,nz);
   }
  }
  attr.needsUpdate=true;normals.needsUpdate=true;m.geometry.computeBoundingSphere();
 }
}
