/* Volumetric XPBD: tetrahedral volume + edge strain constraints.
   Fracture duplicates shared nodes across a stress-selected plane, exposing new tetra faces. */
const V3=THREE.Vector3;
class Jelly {
 constructor(scene,x,z,size,color,hardness=1,shape='box'){
  this.scene=scene;this.origin=new V3(x,0,z);this.hardness=hardness;this.color=color;this.nodes=[];this.tets=[];this.broken=false;this.damage=0;this.peak=0;
  let nx=8,ny=6,nz=8, idx=(i,j,k)=>i+(nx+1)*(j+(ny+1)*k);
  for(let k=0;k<=nz;k++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
   let u=i/nx*2-1,v=j/ny*2-1,w=k/nz*2-1;let p=new V3(u,v,w);
   if(shape==='dome'){p.x=u*Math.sqrt(1-w*w*.5)*(1-.15*(v+1)/2);p.z=w*Math.sqrt(1-u*u*.5)*(1-.15*(v+1)/2);p.y=v+.18*(1-Math.min(1,Math.hypot(u,w)))*(v+1)/2;}
   // Rounded corners, with continuous volumetric interior.
   let q=new V3(Math.max(-.72,Math.min(.72,p.x)),Math.max(-.72,Math.min(.72,p.y)),Math.max(-.72,Math.min(.72,p.z)));let d=p.clone().sub(q);if(d.length()>.28)d.setLength(.28);p.copy(q.add(d));
   p.set(p.x*size[0]/2+x,(p.y+1)*size[1]/2+.07,p.z*size[2]/2+z);this.nodes.push({p,old:p.clone(),v:new V3(),rest:p.clone(),w:0});
  }
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   let c=[idx(i,j,k),idx(i+1,j,k),idx(i,j+1,k),idx(i+1,j+1,k),idx(i,j,k+1),idx(i+1,j,k+1),idx(i,j+1,k+1),idx(i+1,j+1,k+1)];
   for(let t of [[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]])this.tets.push(t.map(a=>c[a]));
  }
  this.build();this.mat=new THREE.MeshPhysicalMaterial({color,roughness:.14,metalness:.0,transparent:true,opacity:.84,transmission:.25,thickness:.7,ior:1.38,attenuationColor:new THREE.Color(color),attenuationDistance:2.5,envMapIntensity:.65,clearcoat:.85,clearcoatRoughness:.12,side:THREE.FrontSide,depthWrite:false});this.mesh=new THREE.Mesh(new THREE.BufferGeometry(),this.mat);this.mesh.castShadow=false;this.mesh.receiveShadow=false;scene.add(this.mesh);this.surface();this.makeShadows();this.updateMesh();
 }
 build(){let em=new Map();this.vols=[];let masses=new Float64Array(this.nodes.length);for(let t of this.tets){let a=this.nodes[t[0]].rest,b=this.nodes[t[1]].rest,c=this.nodes[t[2]].rest,d=this.nodes[t[3]].rest;let vol=b.clone().sub(a).cross(c.clone().sub(a)).dot(d.clone().sub(a))/6;this.vols.push(vol);for(let n of t)masses[n]+=Math.abs(vol)*.6/4;for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){let m=t[i],n=t[j],key=Math.min(m,n)+','+Math.max(m,n);if(!em.has(key))em.set(key,[m,n,this.nodes[m].rest.distanceTo(this.nodes[n].rest)]);}}
  this.edges=[...em.values()];this.nodes.forEach((n,i)=>n.w=1/Math.max(.005,masses[i]));
 }
 surface(){let fm=new Map();for(let t of this.tets)for(let f of [[t[0],t[2],t[1]],[t[0],t[1],t[3]],[t[0],t[3],t[2]],[t[1],t[2],t[3]]]){let key=[...f].sort((a,b)=>a-b).join(',');if(fm.has(key))fm.delete(key);else fm.set(key,f);}this.faces=[...fm.values()].flat();let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.nodes.length*3),3));g.setIndex(this.faces);if(this.mesh){this.mesh.geometry.dispose();this.mesh.geometry=g;}this.updateMesh();}
 fracture(hit,energy,overload=2){
  if(this.separated)return;
  // The tensile edge direction selects the crack normal at the actual contact.
  let normal=this.crackNormal?.clone()||new V3(.8,.06,.6).normalize(),best=0;
  if(!this.crackNormal)for(let [ia,ib,rest] of this.edges){let a=this.nodes[ia].p,b=this.nodes[ib].p,d=b.clone().sub(a),center=a.clone().add(b).multiplyScalar(.5),strain=d.length()/rest-1,score=strain*Math.exp(-center.distanceToSquared(hit)/3);if(score>best&&Math.hypot(d.x,d.z)>.15){best=score;normal.set(d.x,.04,d.z).normalize();}}
  this.crackNormal=normal.clone();this.crackPoint=this.crackPoint||hit.clone();
  let box=new THREE.Box3();for(let n of this.nodes)box.expandByPoint(n.p);
  this.separated=overload>1.45;this.broken=true;
  let tip=this.separated?-Infinity:box.min.y+(box.max.y-box.min.y)*.3;
  this.clipFracture(normal,this.crackPoint,tip);
  // A second branch only appears when the energy exceeds the material threshold substantially.
  if(overload>1.9)this.clipFracture(new V3(-normal.z,.025,normal.x).normalize(),this.crackPoint.clone().addScaledVector(normal,.25),-Infinity,1,2);
  this.build();this.surface();if(window.sfx)sfx('crack',Math.min(1,overload*.45));
 }
 clipFracture(normal,point,tip,onlyGroup=null,newGroup=1){
  let oldNodes=this.nodes,oldTets=this.tets,newNodes=[],newTets=[],cache=new Map();
  let cloneNode=(n,fragment)=>({p:n.p.clone(),old:n.old.clone(),rest:n.rest.clone(),v:n.v.clone(),w:n.w,fragment});
  let add=(key,n,fragment)=>{if(cache.has(key))return cache.get(key);let id=newNodes.length;newNodes.push(cloneNode(n,fragment));cache.set(key,id);return id;};
  let lerp=(a,b,t)=>({p:a.p.clone().lerp(b.p,t),old:a.old.clone().lerp(b.old,t),rest:a.rest.clone().lerp(b.rest,t),v:a.v.clone().lerp(b.v,t),w:1});
  let addTet=(ids,group)=>{let p=ids.map(id=>newNodes[id].rest),vol=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).dot(p[3].clone().sub(p[0]));if(Math.abs(vol)<1e-10)return;if(vol<0)[ids[2],ids[3]]=[ids[3],ids[2]];ids.fragment=group;newTets.push(ids);};
  for(let ti=0;ti<oldTets.length;ti++){
   let tet=oldTets[ti],previous=tet.fragment||0;
   if(onlyGroup!==null&&previous!==onlyGroup){let ids=tet.map(id=>add('keep:'+id,oldNodes[id],previous));addTet(ids,previous);continue;}
   let signed=tet.map(id=>oldNodes[id].p.clone().sub(point).dot(normal));
   for(let side=0;side<2;side++){
    let group=onlyGroup===null?side:(side===0?previous:newGroup),inside=signed.map(d=>side?d>=-1e-8:d<=1e-8);
    if(!inside.some(Boolean))continue;
    let vertex=(local)=>{let id=tet[local],n=oldNodes[id],weld=n.p.y<tip;return add('v:'+id+':'+(weld?'w':group),n,weld?-1:group);};
    let crossing=(a,b)=>{let ia=tet[a],ib=tet[b],t=signed[a]/(signed[a]-signed[b]);if(t<1e-7)return vertex(a);if(t>1-1e-7)return vertex(b);let n=lerp(oldNodes[ia],oldNodes[ib],t),weld=n.p.y<tip;return add('e:'+Math.min(ia,ib)+','+Math.max(ia,ib)+':'+(weld?'w':group),n,weld?-1:group);};
    if(inside.every(Boolean)){addTet([0,1,2,3].map(vertex),group);continue;}
    let faces=[],cut=new Set();
    for(let f of [[0,2,1],[0,1,3],[0,3,2],[1,2,3]]){let polygon=[];for(let k=0;k<3;k++){let a=f[k],b=f[(k+1)%3];if(inside[a])polygon.push(vertex(a));if(inside[a]!==inside[b]){let id=crossing(a,b);polygon.push(id);cut.add(id);}}polygon=[...new Set(polygon)];if(polygon.length>=3)faces.push(polygon);}
    if(cut.size>=3){let ids=[...cut],center=new V3();for(let id of ids)center.add(newNodes[id].p);center.multiplyScalar(1/ids.length);let u=new V3(0,1,0).cross(normal).normalize(),v=normal.clone().cross(u);ids.sort((a,b)=>{let pa=newNodes[a].p.clone().sub(center),pb=newNodes[b].p.clone().sub(center);return Math.atan2(pa.dot(v),pa.dot(u))-Math.atan2(pb.dot(v),pb.dot(u));});faces.push(ids);}
    let ids=[...new Set(faces.flat())],c={p:new V3(),old:new V3(),rest:new V3(),v:new V3(),w:1};for(let id of ids)for(let key of ['p','old','rest','v'])c[key].add(newNodes[id][key]);for(let key of ['p','old','rest','v'])c[key].multiplyScalar(1/ids.length);let center=add('c:'+ti+':'+group,c,group);
    for(let f of faces){let min=f.indexOf(Math.min(...f));f=f.slice(min).concat(f.slice(0,min));for(let k=1;k<f.length-1;k++)addTet([center,f[0],f[k],f[k+1]],group);}
   }
  }
  // Release a small portion of stored strain energy across the newly separated faces.
  for(let n of newNodes)if(n.fragment>=0)n.v.addScaledVector(normal,n.fragment===0?-.18:.18);
  this.nodes=newNodes;this.tets=newTets;
 }
 step(dt,balls,params){let nodes=this.nodes,stiff=params.stiffness*this.hardness,alpha=.014/(stiff*stiff*dt*dt);this.peak=0;let impact=0,hit=null;
  for(let n of nodes){n.old.copy(n.p);n.v.y-=9.8*dt;n.v.multiplyScalar(Math.exp(-.6*dt));n.p.addScaledVector(n.v,dt);}
  for(let iter=0;iter<6;iter++){
   for(let e of this.edges){let a=nodes[e[0]],b=nodes[e[1]],dx=b.p.x-a.p.x,dy=b.p.y-a.p.y,dz=b.p.z-a.p.z,l=Math.hypot(dx,dy,dz)||1e-8,c=l-e[2],s=c/(l*(a.w+b.w+alpha));this.peak=Math.max(this.peak,Math.abs(c)/e[2]);a.p.x+=dx*s*a.w;a.p.y+=dy*s*a.w;a.p.z+=dz*s*a.w;b.p.x-=dx*s*b.w;b.p.y-=dy*s*b.w;b.p.z-=dz*s*b.w;}
   // XPBD signed volume constraints; gradients are the opposite face area vectors.
   for(let ti=0;ti<this.tets.length;ti++){let ids=this.tets[ti],a=nodes[ids[0]],b=nodes[ids[1]],c=nodes[ids[2]],d=nodes[ids[3]],ab=b.p.clone().sub(a.p),ac=c.p.clone().sub(a.p),ad=d.p.clone().sub(a.p),gb=ac.clone().cross(ad).multiplyScalar(1/6),gc=ad.clone().cross(ab).multiplyScalar(1/6),gd=ab.clone().cross(ac).multiplyScalar(1/6),ga=gb.clone().add(gc).add(gd).negate();let vol=ab.dot(gb),den=a.w*ga.lengthSq()+b.w*gb.lengthSq()+c.w*gc.lengthSq()+d.w*gd.lengthSq()+.00000002/(dt*dt),s=(vol-this.vols[ti])/den;a.p.addScaledVector(ga,-s*a.w);b.p.addScaledVector(gb,-s*b.w);c.p.addScaledVector(gc,-s*c.w);d.p.addScaledVector(gd,-s*d.w);}
   for(let n of nodes){for(let ball of balls){let delta=n.p.clone().sub(ball.p),dist=delta.length(),rad=ball.r+.025;if(dist<rad){delta.multiplyScalar(1/(dist||1));let c=rad-dist,wb=1/ball.mass,s=c/(n.w+wb);n.p.addScaledVector(delta,s*n.w);ball.p.addScaledVector(delta,-s*wb);if(ball.v.y<-.8){impact=Math.max(impact,.5*ball.mass*ball.v.lengthSq());hit=ball.p.clone();}}}if(n.p.y<.035){n.p.y=.035;n.p.x=n.old.x+(n.p.x-n.old.x)*.85;n.p.z=n.old.z+(n.p.z-n.old.z)*.85;}n.p.x=Math.max(-7.5,Math.min(7.5,n.p.x));n.p.z=Math.max(-4.2,Math.min(4.2,n.p.z));}
  }
  for(let n of nodes)n.v.copy(n.p).sub(n.old).multiplyScalar(1/dt);
  if(impact>8){this.damage+=impact*dt*.5;if(window.sfx)sfx('impact',Math.min(1,impact/60));}
  let threshold=params.strength*85*Math.sqrt(stiff);if(!this.separated&&hit&&impact>threshold*(this.broken?1.5:1)&&this.peak>.13)this.fracture(hit,impact,impact/threshold);
 }
 makeShadows(){let c=document.createElement('canvas');c.width=c.height=128;let ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,16,64,64,64);g.addColorStop(0,'rgba(35,65,45,.3)');g.addColorStop(.55,'rgba(35,65,45,.18)');g.addColorStop(1,'rgba(35,65,45,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);this.shadowTexture=new THREE.CanvasTexture(c);this.shadows=[];for(let i=0;i<4;i++){let m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.shadowTexture,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.015;m.renderOrder=-2;this.scene.add(m);this.shadows.push(m);}}
 updateMesh(){if(!this.mesh)return;let p=this.mesh.geometry.attributes.position;if(!p)return;this.nodes.forEach((n,i)=>p.setXYZ(i,n.p.x,n.p.y,n.p.z));p.needsUpdate=true;this.mesh.geometry.computeVertexNormals();this.mesh.geometry.computeBoundingSphere();if(this.shadows){let groups=new Map();for(let n of this.nodes){let id=n.fragment||0;if(!groups.has(id))groups.set(id,new THREE.Box3());groups.get(id).expandByPoint(n.p);}this.shadows.forEach(m=>m.visible=false);for(let [id,b] of groups){let m=this.shadows[id];if(!m)continue;let size=b.getSize(new V3()),c=b.getCenter(new V3());m.visible=true;m.position.set(c.x,.015,c.z);m.scale.set(size.x*1.3,size.z*1.3,1);}}}
 dispose(){this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mat.dispose();for(let m of this.shadows||[]){this.scene.remove(m);m.geometry.dispose();m.material.dispose();}this.shadowTexture?.dispose();}
}
class RigidBall{
 constructor(scene,p,r,mass,color=0x53666b){this.p=p.clone();this.old=p.clone();this.v=new V3();this.r=r;this.mass=mass;this.group=-1;this.entered=false;this.rotation=new THREE.Quaternion();this.mesh=new THREE.Mesh(new THREE.SphereGeometry(r,32,24),new THREE.MeshStandardMaterial({color,metalness:.83,roughness:.2,envMapIntensity:1.3}));this.mesh.castShadow=true;this.mesh.receiveShadow=true;scene.add(this.mesh);this.scene=scene;this.sync();}
 predict(dt){let axis=new V3(this.v.z,0,-this.v.x),angle=axis.length()*dt/this.r;if(angle>1e-7)this.rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(axis.normalize(),angle));this.old.copy(this.p);this.v.y-=9.8*dt;this.p.addScaledVector(this.v,dt);}
 finish(dt,floor=0,bounds=[7.6,4.3]){if(this.p.y<this.r+floor){this.p.y=this.r+floor;this.old.y=this.p.y+this.v.y*dt*.42;this.p.x=this.old.x+(this.p.x-this.old.x)*.975;this.p.z=this.old.z+(this.p.z-this.old.z)*.975;if(Math.abs(this.v.y)>.8&&window.sfx)sfx('ball',.4);}for(let [axis,b] of [['x',bounds[0]],['z',bounds[1]]])if(Math.abs(this.p[axis])>b-this.r){this.p[axis]=Math.sign(this.p[axis])*(b-this.r);this.old[axis]=this.p[axis]+this.v[axis]*dt*.6;}this.v.copy(this.p).sub(this.old).multiplyScalar(1/dt);if(this.v.length()>35)this.v.setLength(35);}
 sync(){this.mesh.position.copy(this.p);this.mesh.quaternion.copy(this.rotation);}
 dispose(){this.scene.remove(this.mesh);this.mesh.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});}
}
function collideBalls(balls){for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){let a=balls[i],b=balls[j],d=b.p.clone().sub(a.p),len=d.length(),r=a.r+b.r;if(len<r){if(len<.0001){let angle=(i*127+j*97)*2.399;d.set(Math.cos(angle),.15,Math.sin(angle)).normalize();len=0;}else d.multiplyScalar(1/len);let c=(r-len)/(1/a.mass+1/b.mass);a.p.addScaledVector(d,-c/a.mass);b.p.addScaledVector(d,c/b.mass);let closing=a.v.clone().sub(b.v).dot(d);if(closing>.5&&window.sfx)sfx('ball',Math.min(1,closing*.15));}}}

// Contact between distinct soft bodies and newly disconnected fragments.
function softContacts(jellies,dt){let hash=new Map(),h=.34;for(let bi=0;bi<jellies.length;bi++){let j=jellies[bi];for(let id of new Set(j.faces)){let n=j.nodes[id],x=Math.floor(n.p.x/h),y=Math.floor(n.p.y/h),z=Math.floor(n.p.z/h);for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let bucket=hash.get((x+dx)+','+(y+dy)+','+(z+dz));if(!bucket)continue;for(let o of bucket){if(o.bi===bi&&(o.n.fragment===n.fragment||o.n.fragment===-1||n.fragment===-1))continue;let d=n.p.clone().sub(o.n.p),len=d.length();if(len>.00001&&len<.24){let shift=(.24-len)*.3;d.multiplyScalar(shift/len);n.p.add(d);o.n.p.sub(d);n.v.addScaledVector(d,.3/dt);o.n.v.addScaledVector(d,-.3/dt);}}}let k=x+','+y+','+z;if(!hash.has(k))hash.set(k,[]);hash.get(k).push({bi,n});}}}
