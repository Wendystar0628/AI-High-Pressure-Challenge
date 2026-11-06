import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE };
export const PI = Math.PI;
export const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
export const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8f1ed');
scene.fog = new THREE.Fog('#e8f1ed', 65, 140);
export const root = new THREE.Group(); scene.add(root);
let seed=13278;
export function rand(a=0,b=1){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return a+(seed/4294967296)*(b-a);}
export function tex(draw,w=512,h=512){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');draw(ctx,w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
const gradient=new THREE.DataTexture(new Uint8Array([150,192,225,255]),4,1,THREE.RedFormat);gradient.needsUpdate=true;gradient.minFilter=gradient.magFilter=THREE.NearestFilter;
const cache=new Map();
export function mat(color,opts={}) {const key=color+JSON.stringify(opts);if(!cache.has(key))cache.set(key,new THREE.MeshToonMaterial({color,gradientMap:gradient,...opts}));return cache.get(key);}
export const M={
 white:mat('#f8f8ea'), ivory:mat('#ede8d4'), concrete:mat('#c7d1c7'), edge:mat('#9aada8'), dark:mat('#304f54'), iron:mat('#30474c'), navy:mat('#315769'), blue:mat('#438caa'), teal:mat('#5eaca3'), red:mat('#d46751'), orange:mat('#ed9760'), yellow:mat('#edc368'), rope:mat('#b08561'), rust:mat('#af7558'), wood:mat('#b9a27b'), leaf:mat('#78a995'), leafLight:mat('#a4c4a0'), leafDark:mat('#4e8b7f'), sand:mat('#a3c2b6'), silver:new THREE.MeshStandardMaterial({color:'#bbc8c8',metalness:.48,roughness:.36}), glass:new THREE.MeshPhysicalMaterial({color:'#bce5dc',transparent:true,opacity:.17,roughness:.12,metalness:.1,side:THREE.DoubleSide,depthWrite:false}), waterline:mat('#568e84')
};
export const edgeMaterial=new THREE.LineBasicMaterial({color:'#284b51',transparent:true,opacity:.28});
export function mesh(geo,material,parent=root,pos=[0,0,0],outline=false){let m=new THREE.Mesh(geo,typeof material==='string'?mat(material):material);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(outline){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo,30),edgeMaterial);m.add(e);}return m;}
export function box(w,h,d,material,parent=root,x=0,y=0,z=0,outline=true){return mesh(new THREE.BoxGeometry(w,h,d),material,parent,[x,y,z],outline);}
export function roundedBox(w,h,d,r,material,parent=root,x=0,y=0,z=0){return mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,Math.min(w,h,d)*.45)),material,parent,[x,y,z]);}
export function cyl(rt,rb,h,material,parent=root,x=0,y=0,z=0,n=16){return mesh(new THREE.CylinderGeometry(rt,rb,h,n),material,parent,[x,y,z]);}
export function sphere(r,material,parent=root,x=0,y=0,z=0,detail=1){return mesh(new THREE.IcosahedronGeometry(r,detail),material,parent,[x,y,z]);}
export function torus(r,t,material,parent=root,x=0,y=0,z=0){return mesh(new THREE.TorusGeometry(r,t,6,28),material,parent,[x,y,z]);}
export function group(parent=root,x=0,y=0,z=0,ry=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;parent.add(g);return g;}
export function rod(a,b,r,material,parent=root,n=8){const p=V(...a),q=V(...b);const m=cyl(r,r,p.distanceTo(q),material,parent,0,0,0,n);m.position.copy(p.add(q).multiplyScalar(.5));m.quaternion.setFromUnitVectors(V(0,1,0),q.sub(V(...a)).normalize());return m;}
export function curve(points,r,material,parent=root,segments=32){const c=new THREE.CatmullRomCurve3(points.map(p=>V(...p)));return mesh(new THREE.TubeGeometry(c,segments,r,6,false),material,parent);}
export function line(points,color='#486970',parent=root,opacity=1){const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>V(...p))),new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));parent.add(m);return m;}
export function label(text,w,h,parent=root,x=0,y=0,z=0,options={}) {const t=tex((c,cw,ch)=>{c.fillStyle=options.bg||'#e3e5ce';c.fillRect(0,0,cw,ch);if(options.border!==false){c.strokeStyle=options.ink||'#3a646b';c.lineWidth=8;c.strokeRect(12,12,cw-24,ch-24);}c.fillStyle=options.ink||'#3a646b';c.textAlign='center';c.textBaseline='middle';const rows=text.split('\n');let fs=Math.min(ch/(rows.length+1),cw/(Math.max(...rows.map(s=>s.length))*.7));const setFont=()=>{c.font=`${options.bold===false?'':'bold '}${fs}px "Yu Gothic","Microsoft YaHei",sans-serif`;};setFont();const measured=Math.max(...rows.map(s=>c.measureText(s).width));if(measured>cw*.88){fs*=cw*.88/measured;setFont();}rows.forEach((s,i)=>c.fillText(s,cw/2,ch*(i+1)/(rows.length+1)));},512,Math.round(512*h/w));const m=mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}),parent,[x,y,z]);return m;}
export function disk(r,material,parent,x,y,z){const m=mesh(new THREE.CircleGeometry(r,40),material,parent,[x,y,z]);m.rotation.x=-PI/2;return m;}
export function plank(w,h,d,parent,x,y,z){return box(w,h,d,M.wood,parent,x,y,z);}
export function lifeRing(parent,x,y,z,r=.25){
 const g=group(parent,x,y,z),geo=new THREE.TorusGeometry(r,r*.235,10,64),white=[],orange=[];
 // One continuous skin with material bands: no overlapping toruses or flicker.
 for(let j=0;j<10;j++)for(let i=0;i<64;i++){const dest=(i+2)%16<4?white:orange;for(let k=0;k<6;k++)dest.push(geo.index.array[(j*64+i)*6+k]);}
 geo.setIndex([...white,...orange]);geo.clearGroups();geo.addGroup(0,white.length,0);geo.addGroup(white.length,orange.length,1);mesh(geo,[M.white,M.orange],g);
 torus(r*1.34,r*.038,M.rope,g,0,0,-r*.035);
 for(let i=0;i<4;i++){const a=i*PI/2+PI/4;rod([Math.cos(a)*r*1.2,Math.sin(a)*r*1.2,0],[Math.cos(a)*r*1.34,Math.sin(a)*r*1.34,-r*.035],r*.035,M.rope,g);}
 return g;
}
export function tire(parent,x,y,z,r=.27){const t=torus(r,r*.3,M.iron,parent,x,y,z);for(let i=0;i<16;i++){const a=i*PI/8;const tread=box(.05,.08,.13,M.dark,t,r*Math.cos(a),r*Math.sin(a),0,false);tread.rotation.z=a;}return t;}
export function crate(parent,x,y,z,color=M.white,w=.7,h=.38,d=.48){
 const g=group(parent,x,y,z);roundedBox(w,.045,d,.012,color,g,0,.027,0);
 for(const s of [-1,1]){
  box(w,h*.19,.03,color,g,0,h*.14,s*d/2,false);
  for(let i=0;i<8;i++)box(w*.045,h*.53,.027,color,g,(i/7-.5)*w*.93,h*.48,s*d/2,false);
  for(const side of [-1,1])roundedBox(w*.31,h*.20,.035,.008,color,g,side*w*.34,h*.83,s*d/2);
  roundedBox(w+.04,.045,.055,.01,color,g,0,h,s*d/2);
  box(.03,h*.65,d,color,g,s*w/2,h*.36,0,false);
  for(const side of [-1,1])box(.03,h*.25,d*.27,color,g,s*w/2,h*.84,side*d*.36,false);
  roundedBox(.055,.045,d+.04,.01,color,g,s*w/2,h,0);
  for(const zz of [-d/2,d/2])box(.045,h,.045,color,g,s*w/2,h*.5,zz,false);
 }
 return g;
}
export function bucket(parent,x,y,z,r=.18){
 const g=group(parent,x,y,z),metal=M.silver.clone();metal.side=THREE.DoubleSide;
 mesh(new THREE.CylinderGeometry(r,r*.8,r*1.5,24,1,true),metal,g,[0,r*.75,0]);
 disk(r*.78,M.edge,g,0,.025,0);torus(r,.012,M.silver,g,0,r*1.5,0).rotation.x=PI/2;
 mesh(new THREE.TorusGeometry(r*.9,.011,8,28,PI),M.iron,g,[0,r*1.48,0]);return g;
}
export function mug(parent,x,y,z){
 const g=group(parent,x,y,z),profile=[[0,0],[.059,0],[.069,.018],[.075,.125],[.073,.136],[.064,.136],[.062,.03],[0,.03]].map(([a,b])=>new THREE.Vector2(a,b));
 mesh(new THREE.LatheGeometry(profile,28),M.white,g);disk(.061,mat('#567b76'),g,0,.118,0);
 torus(.069,.006,M.navy,g,0,.132,0).rotation.x=PI/2;torus(.047,.012,M.white,g,.084,.073,0);return g;
}
export const dynamics={boats:[],trees:[],flags:[],nets:[],seaweed:[],fish:[],gulls:[],buoys:[],puddles:[],ripples:[],foam:[],shoreWash:[],caustics:[],beams:[],ropes:[],drips:[],displays:[],fenders:[]};
export const concreteTexture=tex((c,w,h)=>{c.fillStyle='#cad2c9';c.fillRect(0,0,w,h);for(let i=0;i<12000;i++){let v=rand(95,240)|0;c.fillStyle=`rgba(${v},${v+3},${v},${rand(.02,.14)})`;c.fillRect(rand(0,w),rand(0,h),rand(.3,1.9),rand(.3,1.9));}for(let i=0;i<28;i++){c.fillStyle='rgba(74,112,109,.035)';c.beginPath();c.ellipse(rand(0,w),rand(0,h),rand(10,80),rand(4,15),rand(0,PI),0,PI*2);c.fill();}});
concreteTexture.wrapS=concreteTexture.wrapT=THREE.RepeatWrapping;concreteTexture.repeat.set(3,3);
export const wetConcrete=new THREE.MeshStandardMaterial({color:'#d2d7ca',map:concreteTexture,roughness:.42,metalness:.05});
const ropeFiber=tex((c,w,h)=>{c.fillStyle='#fff8ed';c.fillRect(0,0,w,h);c.strokeStyle='rgba(88,64,43,.23)';c.lineWidth=2;for(let i=-4;i<9;i++){c.beginPath();c.moveTo(i*16,0);c.lineTo(i*16+35,h);c.stroke();}c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=1;for(let i=-4;i<9;i++){c.beginPath();c.moveTo(i*16+3,0);c.lineTo(i*16+38,h);c.stroke();}},64,64);
ropeFiber.wrapS=ropeFiber.wrapT=THREE.RepeatWrapping;ropeFiber.repeat.set(18,1);M.rope.map=ropeFiber;
M.wood.map=tex((c,w,h)=>{c.fillStyle='#faf8f0';c.fillRect(0,0,w,h);for(let i=0;i<27;i++){c.strokeStyle=`rgba(105,83,54,${.04+(i%4)*.013})`;c.lineWidth=i%3?1:2;c.beginPath();for(let x=0;x<w;x+=12)c.lineTo(x,i*h/27+Math.sin(x*.017+i)*2.4);c.stroke();}},512,128);
