/* 折光 / REFRACTION — all geometry and shaders are procedural originals. */
'use strict';
(() => {
const T=THREE, TAU=Math.PI*2, DURATION=80;
const IMPACT=[59,59.3,61.4,64.1];
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,t)=>{let p=clamp((t-a)/(b-a));return p*p*(3-2*p)};
const mix=(a,b,p)=>a+(b-a)*p;
let seed=941;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setClearColor(0x030814);renderer.outputColorSpace=T.LinearSRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const camera=new T.PerspectiveCamera(48,1,1,40000);
const materials=[
 new T.MeshStandardMaterial({color:0xb4c3c6,roughness:.48,metalness:.64,vertexColors:true}),
 new T.MeshStandardMaterial({color:0x192e3d,roughness:.64,metalness:.66,vertexColors:true}),
 new T.MeshStandardMaterial({color:0x51717f,roughness:.38,metalness:.75,vertexColors:true}),
 new T.MeshStandardMaterial({color:0xae7940,roughness:.43,metalness:.65,vertexColors:true}),
 new T.MeshStandardMaterial({color:0x52e5ef,emissive:0x21c6e3,emissiveIntensity:1.6,roughness:.3,vertexColors:true}),
 new T.MeshStandardMaterial({color:0xffc269,emissive:0xff901c,emissiveIntensity:2.2,vertexColors:true}),
 new T.MeshStandardMaterial({color:0x817768,roughness:.94,metalness:.08,vertexColors:true}),
 new T.MeshStandardMaterial({color:0xe0eff0,roughness:.32,metalness:.55,vertexColors:true})
,new T.MeshStandardMaterial({color:0x06303c,emissive:0x0b6583,emissiveIntensity:.35,roughness:.3,metalness:.4,vertexColors:true})
,new T.MeshStandardMaterial({color:0x2b9cae,emissive:0x167b99,emissiveIntensity:.35,transparent:true,opacity:.22,depthWrite:false,roughness:.25,metalness:.2,vertexColors:true})
];
materials.forEach((m,i)=>{m.polygonOffset=true;m.polygonOffsetFactor=0;m.polygonOffsetUnits=-i*2;});
// Integer lattice solids are greedily joined into cuboids. No smaller local grid.
const boxTemplate=new T.BoxGeometry(1,1,1).toNonIndexed();
const bp=boxTemplate.attributes.position.array,bn=boxTemplate.attributes.normal.array;
class Blocks{
 constructor(){this.data=Array.from({length:materials.length},()=>({p:[],n:[],c:[]}));}
 box(x,y,z,w,h,d,m=0,shade=1){x=Math.round(x);y=Math.round(y);z=Math.round(z);w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));d=Math.max(1,Math.round(d));x=Math.round(x-w/2)+w/2;y=Math.round(y-h/2)+h/2;z=Math.round(z-d/2)+d/2;let a=this.data[m];rand();let s=shade;for(let i=0;i<bp.length;i+=3){a.p.push(bp[i]*w+x,bp[i+1]*h+y,bp[i+2]*d+z);a.n.push(bn[i],bn[i+1],bn[i+2]);a.c.push(s,s,s);}return this;}
 frame(x,y,z,w,h,d,th=3,m=0){this.box(x-w/2,y,z,th,h,d,m);this.box(x+w/2,y,z,th,h,d,m);this.box(x,y-h/2,z,w,th,d,m);this.box(x,y+h/2,z,w,th,d,m);return this;}
 plate(x,y,z,w,h,d,m=0){x=Math.round(x);w=Math.max(4,Math.floor(w/2)*2);d=Math.max(4,Math.floor(d/2)*2);let c=Math.min(5,Math.floor(Math.min(w,d)/5));this.box(x,y,z,w-2*c,h,d,m);for(let i=0;i<c;i++){this.box(x+w/2-c+i,y,z,1,h,d-2*(i+1),m);this.box(x-w/2+c-i-1,y,z,1,h,d-2*(i+1),m);}return this;}
 finish(){const group=new T.Group();this.data.forEach((a,i)=>{if(!a.p.length)return;let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(a.n,3));g.setAttribute('color',new T.Float32BufferAttribute(a.c,3));g.computeBoundingSphere();let mesh=new T.Mesh(g,materials[i]);mesh.castShadow=i!==4&&i!==5&&i!==9;mesh.receiveShadow=true;group.add(mesh);});return group;}
}
const glowMat=(color,opacity=1)=>new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending});
function glowBall(r,color){return new T.Mesh(new T.SphereGeometry(r,16,12),glowMat(color));}
function line(points,color,opacity=1){return new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending}));}
function light(scene,color,intensity,pos,dist=0){let l=new T.PointLight(color,intensity,dist,1.4);l.position.copy(pos);scene.add(l);return l;}
function baseScene(interior=false){let s=new T.Scene();s.background=new T.Color(interior?0x030810:0x02060f);s.add(new T.HemisphereLight(0x9bc5e6,0x111321,interior?.55:.95));let key=new T.DirectionalLight(0xffe5bc,interior?1.6:2.8);key.position.set(-600,900,-400);s.add(key);let fill=new T.DirectionalLight(0x479bc7,interior?.65:.9);fill.position.set(600,0,500);s.add(fill);return s;}
const space=baseScene();
const sun=space.children.find(o=>o.isDirectionalLight);sun.position.set(-1100,1650,-900);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-1450,right:1450,top:1450,bottom:-1450,near:100,far:4500});sun.shadow.bias=-.00008;sun.shadow.normalBias=1.3;
const reflectionScene=new T.Scene();reflectionScene.background=new T.Color(0x34495a);
for(let i=0;i<2;i++){let panel=new T.Mesh(new T.PlaneGeometry(300,180),new T.MeshBasicMaterial({color:i?0x6b9cac:0xd4c8af,side:T.DoubleSide}));panel.position.set(i?200:-200,150,-150);panel.lookAt(0,0,0);reflectionScene.add(panel);}
const pmrem=new T.PMREMGenerator(renderer),reflection=pmrem.fromScene(reflectionScene,.12);space.environment=reflection.texture;materials.forEach(m=>m.envMapIntensity=.28);pmrem.dispose();
const shieldReflection={value:0};
for(let i of [0,1,2])materials[i].onBeforeCompile=shader=>{shader.uniforms.shieldReflection=shieldReflection;shader.fragmentShader='uniform float shieldReflection;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.008,.045,.065)*shieldReflection;');};
// A sky sphere with fBm nebulae. No downloaded images or textures.
const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:`varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`precision highp float;varying vec3 v;float h(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}float fb(vec3 p){float a=.5,r=0.;for(int i=0;i<5;i++){r+=a*n(p);p=p*2.04+3.7;a*=.5;}return r;}void main(){vec3 d=normalize(v);float f=fb(d*4.),g=fb(d*12.+8.);float band=exp(-pow((d.y+.22+d.x*.28)*3.3,2.));vec3 c=vec3(.002,.005,.014);c+=vec3(.018,.053,.073)*pow(f,2.)*band*1.3;c+=vec3(.037,.017,.039)*pow(g,3.)*.8;c+=vec3(.025,.048,.065)*pow(max(0.,dot(d,normalize(vec3(-1.,.5,-1.)))),12.);gl_FragColor=vec4(c,1.);}`});
space.add(new T.Mesh(new T.SphereGeometry(18000,40,24),skyMaterial));
const starP=[],starC=[];for(let i=0;i<6500;i++){let a=rand()*TAU,u=rand()*2-1,r=15500+rand()*1000,q=Math.sqrt(1-u*u);starP.push(Math.cos(a)*q*r,u*r,Math.sin(a)*q*r);let b=.18+Math.pow(rand(),5)*1.4;starC.push(b*.8,b*.94,b);}
const starsG=new T.BufferGeometry();starsG.setAttribute('position',new T.Float32BufferAttribute(starP,3));starsG.setAttribute('color',new T.Float32BufferAttribute(starC,3));space.add(new T.Points(starsG,new T.PointsMaterial({size:10,vertexColors:true,transparent:true,opacity:.85,sizeAttenuation:true,depthWrite:false})));
const planet=new T.Mesh(new T.SphereGeometry(2700,96,64),new T.ShaderMaterial({uniforms:{},vertexShader:`varying vec3 n;varying vec3 p;void main(){n=normal;p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 n;varying vec3 p;
float hash3(vec3 q){return fract(sin(dot(q,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise3(vec3 q){vec3 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float clouds(vec3 q){float r=0.,a=.5;for(int i=0;i<5;i++){r+=a*noise3(q);q=q*2.07+3.1;a*=.5;}return r;}
void main(){vec3 q=normalize(p);float l=max(0.,dot(normalize(n),normalize(vec3(-.7,.6,.3))));float turbulence=clouds(q*7.);float latitude=q.y*55.+turbulence*9.+sin(q.x*9.)*.8;float bands=.5+.5*sin(latitude);float fine=clouds(q*38.+vec3(0.,latitude*.16,0.));vec3 c=mix(vec3(.025,.052,.068),vec3(.14,.19,.20),bands*.7+fine*.3);c=mix(c,vec3(.18,.135,.09),smoothstep(.72,.9,turbulence)*.35);c*=.045+pow(l,1.3)*1.2;gl_FragColor=vec4(c,1.);}` }));planet.position.set(-7800,-400,-10000);space.add(planet);
const atmos=new T.Mesh(new T.SphereGeometry(2760,96,64),new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{},vertexShader:`varying vec3 n;varying vec3 e;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);e=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec3 n;varying vec3 e;void main(){float f=pow(max(0.,1.-abs(dot(normalize(n),normalize(e)))),12.);gl_FragColor=vec4(.12,.38,.52,f*.28);}`}));atmos.position.copy(planet.position);space.add(atmos);

const engines=[];const turretSources=[],mainGuns=[],guardGuns=[],chargeRails=[];
function engine(parent,x,y,z,w,h,depth=22){let b=new Blocks();b.frame(x,y,z,w,h,depth,Math.max(2,w*.12),1);b.frame(x,y,z+depth*.38,w+4,h+4,4,3,0);b.frame(x,y,z+depth*.55,w-7,h-7,2,2,3);b.box(x,y,z-8,w-10,h-10,2,4);for(let k=-1;k<=1;k++)b.box(x+k*w*.21,y,z-5,2,h-10,2,7);parent.add(b.finish());let m=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{time:{value:0},power:{value:1}},vertexShader:`varying vec2 uvv;void main(){uvv=uv;vec3 p=position;p.x*=1.-uv.y*.78;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec2 uvv;uniform float time;uniform float power;void main(){float r=abs(uvv.x-.5)*2.;float f=pow(max(0.,1.-uvv.y),2.0)*pow(max(0.,1.-r),1.3);float stream=.8+.2*sin(uvv.y*45.-time*11.+uvv.x*30.);vec3 c=mix(vec3(.03,.4,.8),vec3(.5,1.,1.),pow(max(0.,1.-uvv.y),4.));gl_FragColor=vec4(c*(1.6+power*.5),f*stream*.42);}`});let flame=new T.Group();flame.name='engine-plume';for(let a=0;a<3;a++){let p=new T.Mesh(new T.PlaneGeometry(w*.95,w*4.5),m);p.quaternion.setFromAxisAngle(V(0,0,1),a*Math.PI/3);p.quaternion.multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI/2));p.position.z=w*2.25;flame.add(p);}flame.position.set(x,y,z+4);parent.add(flame);engines.push({flame,m,w});}
function turret(b,x,y,z,size=1){let s=size;b.box(x,y,z,22*s,7*s,30*s,1).box(x,y+5*s,z,18*s,5*s,22*s,0).box(x,y+9*s,z-4*s,12*s,6*s,20*s,2);for(let a of [-1,1]){b.box(x+a*5*s,y+10*s,z-20*s,4*s,4*s,24*s,1);b.box(x+a*5*s,y+10*s,z-33*s,3*s,3*s,2*s,4);}}
function flagship(){let g=new T.Group(),b=new Blocks();
 // Dense, load-bearing spine; two separated stair-stepped prow blades.
 b.box(0,-20,80,100,80,760,1);
 for(let z=-260;z<470;z+=32){let t=(z+260)/730,w=108+68*Math.sin(t*Math.PI),h=38+26*Math.sin(t*Math.PI);b.box(0,-19,z,w,h*2,30,1);b.box(0,h-10,z,w-14,12,30,0);b.box(0,-h-16,z,w-20,8,30,2);for(let s of [-1,1]){b.box(s*(w/2+3),-12,z,7,34,19,2);b.box(s*(w/2+7),0,z,3,3,17,4);}}
 for(let s of [-1,1]){
  for(let i=0;i<24;i++){let z=-580+i*34;let broad=26+Math.min(i,10)*5;let x=s*(35+broad/2+Math.max(0,i-12)*3);let top=6+Math.min(i,12)*3;for(let k=0;k<4;k++)b.plate(x+s*k*3,top-k*11,z,broad-k*6,11,32,k===3?2:0);if(i!==10)b.box(x,-24,z,broad-8,14,30,1);if(i%3===0){b.plate(x,top+6,z,Math.max(6,broad-20),3,16,2);b.box(x+s*(broad/2-6),top+2,z,4,3,25,3);}if(i<13)b.box(s*32,1,z,3,5,20,4);}
  // Outboard layered arms with deep, open separation from the keel.
  for(let i=0;i<14;i++){let z=-100+i*40,x=s*(140+Math.min(i,5)*7),w=35+Math.sin(i/14*Math.PI)*40;for(let j=0;j<3;j++)b.plate(x+s*j*5,2-j*15,z,w-j*8,14,38,j===2?2:0);b.box(x,-39,z,w-5,12,35,1);if(i%2===0)b.box(x+s*w*.35,10,z,5,3,25,3);}
  for(let z=-60;z<430;z+=85){b.box(s*117,-28,z,90,14,19,1);b.box(s*117,-19,z,90,4,8,2);}
  // Belly ribs and recessed side machinery.
  for(let z=-180;z<430;z+=24){b.box(s*69,-60,z,12,18,7,0);b.box(s*57,-72,z,16,6,7,2);b.box(s*88,-17,z,4,7,9,z%48===0?5:2);}
  // A long, visibly recessed hangar opening in the flank.
  b.box(s*119,-25,-292,4,37,68,1).box(s*119,-25,-182,4,37,96,1);b.box(s*111,-46,-244,114,5,26,1);b.box(s*146,-46,-230,54,5,208,0);b.box(s*146,0,-230,54,7,208,0);
  for(let z=-324;z<-130;z+=32){b.box(s*166,-22,z,5,42,6,2);b.box(s*160,-41,z,4,2,18,4);b.box(s*124,-19,z,2,2,12,5);}
  // Receding entrance ribs and floor guides reveal depth before the interior cut.
  for(let x of [65,80,95,110,128,140,152]){b.box(s*x,-8,-244,3,3,27,2).box(s*x,-41,-244,3,3,27,2);for(let z of [-257,-231])b.box(s*x,-25,z,3,31,2,1);}
  for(let z of [-250,-238])b.box(s*112,-42,z,107,1,2,4);
 }
 // Terraced dorsal citadel; narrow illuminated joints.
 for(let j=0;j<6;j++){b.box(0,48+j*10,210+j*18,118-j*13,10,310-j*38,j%3===2?2:0);b.box(0,54+j*10,95+j*38,110-j*13,2,3,1);}
 b.box(0,114,289,65,18,83,1).box(0,126,295,76,8,75,0).box(0,116,245,58,5,3,4);
 for(let s of [-1,1]){b.box(s*28,143,316,6,38,6,2);b.box(s*28,163,316,4,2,4,5);}
 // The spinal accelerator has a heavy base, nested rails and sunken muzzle.
 b.box(0,12,-214,62,35,210,1).box(0,28,-260,49,10,185,2);
 for(let z=-400;z<-180;z+=20){for(let s of [-1,1]){b.box(s*23,21,z,12,20,17,0);b.box(s*17,34,z,5,3,12,3);}b.box(0,31,z,13,3,9,4);}
 b.frame(0,17,-412,43,30,14,6,0).frame(0,17,-422,31,20,5,3,3).box(0,17,-416,23,12,3,4);
 for(let s of [-1,1])for(let j=0;j<5;j++){let z=-180+j*113,x=s*(85+(j>1?16:0)),y=j>2?67:49;let gunBlocks=new Blocks();turret(gunBlocks,0,0,0,1.3);let gun=gunBlocks.finish();gun.position.set(x,y,z);gun.rotation.order='YXZ';g.add(gun);mainGuns.push(gun);turretSources.push(V(x,y+13,z-43));b.box(x,y-5,z,33,8,42,1);}
 // Sparse panel seams, heat sinks and shallow inset plates.
 for(let i=0;i<280;i++){let z=-170+rand()*600,x=(rand()-.5)*100,y=45+Math.round(17*Math.sin((z+260)/730*Math.PI));if(z>60&&Math.abs(x)<58)continue;b.box(x,y,z,3+rand()*10,2,8+rand()*20,rand()>.8?3:2);}
 for(let s of [-1,1])for(let z=345;z<440;z+=8)b.box(s*68,50,z,20,5,3,1);
 // Recessed one-unit fasteners, vent combs, doubled seams and stepped edge caps.
 for(let side of [-1,1]){
  for(let i=0;i<21;i++){let z=-560+i*34,broad=26+Math.min(i,10)*5,x=side*(35+broad/2+Math.max(0,i-12)*3),y=7+Math.min(i,12)*3;
   b.box(x,y,z,Math.max(9,broad-14),1,2,1);b.box(x,y,z+12,Math.max(7,broad-18),1,1,2);
   for(let k of [-1,1]){b.box(x+k*(broad/2-7),y+1,z+8,2,1,2,3);b.box(x+k*(broad/2-7),y+1,z-8,2,1,2,2);}
   if(i%3===1)for(let k=0;k<6;k++)b.box(x,y+2,z-7+k*2,Math.max(8,broad-25),1,1,1);
  }
  for(let z=-165;z<440;z+=18){b.box(side*79,-30,z,7,5,8,2);b.box(side*81,-37,z,4,7,3,3);}
  for(let j=0;j<6;j++){let z=10+j*68;for(let k=0;k<8;k++)b.box(side*(137+k*3),-45,z,2,4,24,2);}
  for(let z=-315;z<-135;z+=16){b.box(side*165,-1,z,6,2,6,3);b.box(side*166,-35,z,1,2,3,5);}
 }
 for(let j=0;j<6;j++){let y=54+j*10,z=210+j*18;for(let side of [-1,1]){b.box(side*(57-j*6),y,z,2,1,280-j*36,2);for(let k=0;k<6-j;k++)b.box(side*(54-j*6),y+1,z-80+k*28,1,1,6,5);}}
 // Broad rear shoulder plates break the long hull into distinct structural masses.
 for(let s of [-1,1]){
  for(let j=0;j<9;j++){let z=110+j*35,x=s*(170-Math.abs(j-4)*4);for(let k=0;k<4;k++)b.box(x+s*k*3,12+k*5,z,62-k*12,5,31,k===1?2:0);b.box(x,-52,z,47,8,22,2);}
  for(let j=0;j<6;j++){b.box(s*(70+j*5),-47-j*5,-430+j*39,25,8,31,j%2?0:2);}
  for(let z of [165,285,405]){b.box(s*140,-62,z,45,16,28,1);b.box(s*142,-72,z,35,5,24,0);b.box(s*142,-76,z,21,2,14,4);}
  // Tall but open buttresses and slit windows on the citadel.
  for(let z=170;z<=300;z+=26){b.box(s*59,67,z,5,32,6,2);b.box(s*62,61,z,1,2,9,5);}
 }
 for(let z=-390;z<=-190;z+=20){let rail=new Blocks();rail.box(0,0,0,9,2,11,4);let node=rail.finish();node.position.set(0,34,z);let mat=materials[4].clone();node.children[0].material=mat;g.add(node);chargeRails.push({node,mat,z});}
 // Swept vertical shoulders, a ventral keel and small, recessed service assemblies.
 for(let s of [-1,1]){
  for(let j=0;j<7;j++){b.plate(s*(175-j*3),24+j*6,330-j*3,14,6,112-j*12,j%3===1?2:0);b.box(s*(175-j*3),28+j*6,292,2,1,7,3);}
  for(let j=0;j<8;j++){let z=-110+j*60;b.plate(s*36,-77,z,36,8,43,2);b.plate(s*36,-83,z,28,4,35,0);for(let k=0;k<5;k++)b.box(s*36,-87,z-12+k*6,19,2,2,1);b.box(s*49,-85,z,2,2,20,4);}
  for(let z=-310;z<-145;z+=32){b.box(s*141,-9,z,20,5,9,1);b.box(s*145,-15,z,9,8,3,2);b.box(s*145,-21,z,5,2,5,3);}
 }
 g.add(b.finish());for(let x of [-148,-74,0,74,148])engine(g,x,-13,473,51,x===0?62:44,30);
 return g;
}
const fleet=new T.Group();space.add(fleet);const flag=flagship();fleet.add(flag);
const engineLight=light(space,0x45cde7,900,V(0,-10,520),370),shieldLight=light(space,0x40bde1,0,V(0,135,-70),650);
light(space,0x4cbaca,180,V(147,-19,-244),95);light(space,0xffbc70,75,V(82,-22,-244),80);
function escort(type){let g=new T.Group(),b=new Blocks();let L=type?196:168;
 for(let i=0;i<12;i++){let z=-L/2+i*L/12;let w=type?14+22*Math.sin(i/12*Math.PI):20+40*Math.sin(i/12*Math.PI);let y=type?3:9;for(let j=0;j<3;j++)b.box(0,y-j*6,z,w-j*4,6,L/12-1,j===2?1:0);b.box(0,-12,z,w-7,7,L/12-2,2);for(let s of [-1,1]){if(i>3&&i<10){let x=s*(type?40:32);b.box(x,-2,z,type?17:20,12,L/12-1,0);b.box(x,5,z,12,3,8,1);if(type){b.box(x,7,z,4,3,9,3);b.box(x,8,z-3,3,3,3,5);}}if(i<5)b.box(s*9,5,z,3,2,8,4);}}
 b.box(0,17,30,23,12,43,1).box(0,24,34,27,5,28,0).box(0,19,8,18,3,2,4);
 if(!type)for(let s of [-1,1])for(let z of [-30,35]){let gb=new Blocks();turret(gb,0,0,0,.6);let gun=gb.finish();gun.name='guard-turret';gun.position.set(s*24,13,z);gun.rotation.order='YXZ';g.add(gun);b.box(s*24,10,z,20,7,22,1);}
 if(type){
  // Twin long outriggers, open cross-braces and individual armored missile cells.
  for(let s of [-1,1]){for(let j=0;j<10;j++){let z=-70+j*15,x=s*(42+Math.min(j,4)*3);b.box(x,-5,z,17,14,14,2);b.plate(x,4,z,18,4,12,0);b.box(x,7,z,13,2,9,1);for(let a of [-1,1]){b.box(x+a*5,9,z,2,3,11,3);b.box(x,9,z+a*5,8,3,1,2);}if(j!==2&&j!==6)b.box(x,12,z,3,8,3,0).box(x,17,z,2,2,2,3);b.box(x+s*8,1,z,2,3,9,0);}for(let z of [-40,8,54])b.box(s*30,-7,z,42,4,6,1);for(let j=0;j<4;j++)b.box(s*(9+j*2),-1,-102+j*9,5+j*2,8,8,0);}
 }else{
  for(let s of [-1,1])for(let j=0;j<7;j++){let z=-32+j*14,x=s*(37+Math.sin(j/7*Math.PI)*8);b.box(x,-8,z,21,17,13,0);b.box(x+s*3,-19,z,15,5,11,2);b.box(x,3,z,18,4,11,2);if(j%2===0)b.box(x+s*9,-4,z,1,3,6,4);}
 }
 // Broad folded cheeks on the guards; narrow forked fins on the vanguard.
 const detailSeed=seed;
 for(let s of [-1,1]){
  if(type){for(let j=0;j<6;j++){b.plate(s*(10+j),7+j,-91+j*12,10,3,16,0);b.box(s*(11+j),9+j,-91+j*12,2,1,10,j%2?2:3);}for(let j=0;j<5;j++)b.plate(s*(19+j*2),9+j*4,64-j*3,7,4,34-j*4,j%2?2:0);}
  else{for(let j=0;j<5;j++){b.plate(s*(13+j*3),14+j*2,-61+j*13,18,4,19,0);b.box(s*(13+j*3),17+j*2,-61+j*13,11,1,7,1);}for(let j=0;j<5;j++){b.plate(s*15,21+j*3,47+j*5,18-j*2,3,25-j*3,j%2?2:0);b.box(s*39,-9,8+j*10,2,6,3,1);}}
 }
 seed=detailSeed;
 for(let s of [-1,1])b.box(s*14,8,47,4,2,34,3);
 g.add(b.finish());engine(g,-12,-4,L/2,18,16,7);engine(g,12,-4,L/2,18,16,7);return g;
}
const escortTemplates=[escort(0),escort(1)],escorts=[];
for(let i=0;i<32;i++){let type=i>=16?1:0,g=escortTemplates[type].clone(true);let side=i%2?1:-1,j=Math.floor(i/2);let x=side*(285+(j%4)*170),y=((j%3)-1)*140+(i%2)*45,z=type?-630-(j-8)*155:130+(j%5)*240-180;g.position.set(x,y,z);g.userData={x,y,z,type,index:i};fleet.add(g);escorts.push(g);}
escorts.slice(0,16).forEach((ship,index)=>{let guns=[];ship.traverse(o=>{if(o.name==='guard-turret')guns.push(o);});guardGuns.push({ship,guns,index});});
// Cloned engine materials are shared, while each plume is stretched deterministically.
function shuttle(){let b=new Blocks();b.box(0,0,0,8,5,22,0).box(0,3,-5,5,3,6,1).box(0,4,-5,4,1,5,4);for(let s of [-1,1])b.box(s*6,-1,4,5,3,12,2).box(s*6,0,11,3,2,2,4).box(s*4,0,-10,3,3,9,0);b.box(0,0,13,5,3,2,4);return b.finish();}
const smallTemplate=shuttle(),shuttles=[];
for(let i=0;i<10;i++){let g=smallTemplate.clone();fleet.add(g);shuttles.push(g);}

// Transparent shield skin: grazing edges, scrolling lattice and an expanding wave.
const shields=[];
function shield(ship,scale,index){let m=new T.ShaderMaterial({transparent:true,side:T.FrontSide,depthWrite:false,blending:T.AdditiveBlending,uniforms:{time:{value:0},alpha:{value:0},wave:{value:0}},vertexShader:`varying vec3 n;varying vec3 e;varying vec3 p;void main(){p=position;vec4 v=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);e=normalize(-v.xyz);gl_Position=projectionMatrix*v;}`,fragmentShader:`varying vec3 n;varying vec3 e;varying vec3 p;uniform float time,alpha,wave;void main(){float rim=pow(max(0.,1.-abs(dot(normalize(n),normalize(e)))),3.);float lat=abs(sin(p.y*47.+time));float lon=abs(sin(atan(p.x,p.z)*28.+p.y*11.));float grid=pow(lat,50.)*.12+pow(lon,70.)*.08;float w=exp(-pow((p.z-(wave*2.-1.))*18.,2.));float a=(rim*.23+grid*.7+w*.12)*alpha;gl_FragColor=vec4(.13,.64,.8,a);}`});let mesh=new T.Mesh(new T.SphereGeometry(1,64,40),m);mesh.scale.copy(scale);ship.add(mesh);shields.push({mesh,m,index,base:scale.clone()});}
shield(flag,V(285,215,675),0);escorts.forEach((g,i)=>shield(g,V(g.userData.type?84:70,46,132),i+1));

// Fracturable rocks: clustered lattice fragments remain physical after the light fades.
const rocks=[];
function rock(x,y,z,r,index){
 const group=new T.Group(),pieces=[],centers=[],builders=[],cuts=[];
 const step=4,extent=Math.ceil(r/step)*step;
 for(let j=0;j<9;j++){let a=j*2.399;centers.push(V(Math.round(Math.cos(a)*r*.43),Math.round(Math.sin(a)*r*.36),Math.round((j%3-1)*r*.42)));builders.push(new Blocks());cuts.push(new Blocks());}
 function cell(px,py,pz){
  let nx=px/r,ny=py/(r*.83),nz=pz/(r*.9);
  let shape=nx*nx+ny*ny+nz*nz;
  let relief=.13*Math.sin(nx*11+index)*Math.sin(ny*8+2)+.11*Math.cos(nz*9+nx*5)+.055*Math.sin(ny*21+nz*13);
  if(shape> .91+relief)return -1;
  if(index%3===0&&Math.hypot(nx-.22,ny+.12)<.15+.025*Math.sin(nz*11))return -1;
  let best=1e12,id=0;
  for(let j=0;j<9;j++){let c=centers[j],d=(px-c.x)**2+(py-c.y)**2+(pz-c.z)**2;if(d<best){best=d;id=j;}}
  return id;
 }
 // Greedy rows of occupied common-grid voxels; Voronoi regions form real fracture faces.
 for(let pz=-extent;pz<extent;pz+=step)for(let py=-extent;py<extent;py+=step){
  let last=-1,start=-extent;
  for(let px=-extent;px<=extent;px+=step){let id=px===extent?-1:cell(px+2,py+2,pz+2);
   if(id!==last){if(last>=0){let c=centers[last];builders[last].box((start+px)/2-c.x,py+2-c.y,pz+2-c.z,px-start,step,step,6,.86+.10*Math.sin(py*.13+pz*.09));}if(index<4&&last>=0&&id>=0){for(let j of [last,id]){let c=centers[j];cuts[j].box(px-c.x,py+2-c.y,pz+2-c.z,1,4,4,5);}}start=px;last=id;}
  }
 }
 for(let j=0;j<9;j++){let obj=builders[j].finish(),home=centers[j],vel=home.clone().normalize().multiplyScalar(14+j%3*5);obj.position.copy(home);let surface=V(),best=-Infinity;obj.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position.array;for(let n=0;n<p.length;n+=108){let lo=V(Infinity,Infinity,Infinity),hi=V(-Infinity,-Infinity,-Infinity);for(let k=n;k<n+108;k+=3){let v=V(p[k],p[k+1],p[k+2]);lo.min(v);hi.max(v);}let x=(lo.x+hi.x)/2,y=(lo.y+hi.y)/2,score=hi.z-(x*x+y*y)/r*.13;if(score>best){best=score;surface.set(x,y,hi.z+.2);}}});let cut=cuts[j].finish();obj.add(cut);group.add(obj);pieces.push({obj,cut,home,vel,surface,spin:V((rand()-.5)*.15,(rand()-.5)*.19,(rand()-.5)*.13)});}
 group.position.set(x,y,z);space.add(group);rocks.push({group,pieces,base:V(x,y,z),r,index});
}
rock(0,17,-1480,124,0);rock(335,110,-1370,92,1);rock(-350,-70,-1320,72,2);rock(560,-135,-1740,108,3);
for(let i=0;i<24;i++)rock((rand()-.5)*2200,(rand()-.5)*800,-1550-rand()*1600,14+rand()*43,i+4);
const fissures=[],impactLights=[];
rocks.slice(0,4).forEach((r,i)=>{
 const hit=i===0?V(0,0,r.r*.83):r.pieces[2].surface.clone().add(r.pieces[2].home);
 r.pieces.forEach((p,j)=>{
  let g=p.cut,heat={value:-10},mat=new T.MeshStandardMaterial({color:0x493d32,emissive:0xff6c12,emissiveIntensity:1,roughness:.92});
  // Heat crosses the original welded rock before the individually delayed fragments part.
  mat.onBeforeCompile=shader=>{
   shader.uniforms.fractureHeat=heat;shader.uniforms.fractureHome={value:p.home};shader.uniforms.fractureHit={value:hit};shader.uniforms.fractureRadius={value:r.r};
   shader.vertexShader='varying vec3 vFracture;uniform vec3 fractureHome;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFracture=position+fractureHome;');
   shader.fragmentShader='varying vec3 vFracture;uniform float fractureHeat,fractureRadius;uniform vec3 fractureHit;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    float arrival=length((vFracture-fractureHit)*vec3(1.,1.,1.2))/fractureRadius*.43;
    float age=fractureHeat-arrival;
    float vein=.5+.5*sin(vFracture.y*.16+sin(vFracture.z*.11)*2.)*sin(vFracture.z*.23+vFracture.x*.07);
    float heat=smoothstep(0.,.24,age)*exp(-max(0.,age-.42)*.74);
    float pattern=.13+.87*smoothstep(.36,.77,vein);
    totalEmissiveRadiance=mix(vec3(1.,.075,.008),vec3(1.,.51,.085),heat*.8)*heat*pattern*5.;`);
  };
  g.children.forEach(m=>m.material=mat);fissures.push({g,heat,index:i});
 });
 impactLights.push(light(space,0xff8e39,0,r.base.clone().add(V(50,25,50)),430));
});
// Individual fracture delays distinguish a sustained cut, a burst and successive missile hits.
function fractureAge(index,piece,t){let delay=index===0?(piece%3)*.16+Math.floor(piece/3)*.045:index===1?(piece%3===2?Math.floor(piece/3)*.07:.16+(piece%3)*.13):index===2?(piece%3===2?0:.10+(piece%3)*.08):(piece%3===2?Math.floor(piece/3)*.23:.35+(piece%3)*.18);let dt=Math.max(0,t-IMPACT[index]-delay);return dt*smooth(0,.38,dt);}
// Analytic surface positions stay valid for arbitrary export seeks and future intercepts.
function rockSurface(index,pieceIndex,t){let r=rocks[index],p=r.pieces[pieceIndex%9],dt=fractureAge(index,pieceIndex%9,t);let v=p.surface.clone().applyEuler(new T.Euler(p.spin.x*dt,p.spin.y*dt,p.spin.z*dt)).add(p.home).addScaledVector(p.vel,dt*.7);v.applyAxisAngle(V(0,1,0),Math.sin(t*.02+index)*.06).add(r.base);if(t>73)v.z+=(t-73)*(t-73)*120;return v;}
const dustP=[];for(let i=0;i<700;i++)dustP.push((rand()-.5)*4500,(rand()-.5)*2400,(rand()-.5)*5000);
let dg=new T.BufferGeometry();dg.setAttribute('position',new T.Float32BufferAttribute(dustP,3));const dust=new T.Points(dg,new T.PointsMaterial({color:0x9dc8de,size:1.5,transparent:true,opacity:.4}));space.add(dust);
const speedGeometry=new T.BufferGeometry();speedGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(180*6),3));const speedLines=new T.LineSegments(speedGeometry,new T.LineBasicMaterial({color:0x89bcca,transparent:true,opacity:.2,depthWrite:false}));speedLines.frustumCulled=false;space.add(speedLines);

// Four interior sets, on the same one-unit construction lattice.
function floorTiles(b,w,l,y=0){for(let x=-w/2+10;x<w/2;x+=20)for(let z=-l/2+10;z<l/2;z+=20)b.box(x,y-2,z,19,4,19,1,.8+rand()*.3);}
function screen(b,x,y,z,w,h){b.box(x,y,z,w+2,h+2,2,1).box(x,y,z+2,w,h,1,8);for(let j=0;j<4;j++){b.box(x-w*.35+j*w*.21,y-h*.1,z+3,Math.max(1,w*.06),Math.max(1,h*(.2+rand()*.5)),1,j===3?5:4,.7);}b.box(x,y+h*.36,z+3,w*.8,1,1,4);}
const hangar=baseScene(true);hangar.fog=new T.FogExp2(0x07141d,.0017);const hb=new Blocks();floorTiles(hb,132,390);
for(let side of [-1,1]){hb.box(side*70,33,0,8,70,400,1);hb.box(side*56,2,0,18,6,400,0);for(let z=-180;z<200;z+=40){hb.box(side*58,12,z,21,16,32,2);hb.box(side*56,22,z,25,4,35,0);hb.box(side*60,44,z,14,5,5,0);hb.box(side*49,36,z+18,5,20,4,3);hb.box(side*43,47,z+18,15,4,4,2);hb.box(side*38,42,z+18,3,7,4,3);hb.box(side*33,1,z,3,1,26,5);hb.box(side*67,40,z,1,2,24,4);let ship=smallTemplate.clone();ship.position.set(side*53,26,z);if(!((side===1&&(z===100||z===-60))||(side===-1&&z===140)))hangar.add(ship);}hb.box(side*21,1,0,2,1,380,4);}
for(let z=-190;z<=190;z+=48){hb.frame(0,34,z,134,68,8,5,0);hb.frame(0,34,z-5,124,60,2,1,3);hb.box(0,66,z,125,3,18,1);for(let side of [-1,1])hb.box(side*40,62,z,22,2,3,4);}
hb.box(0,72,0,148,6,400,1);hb.frame(0,32,-201,130,64,12,8,2);hangar.add(hb.finish());
const hangarSky=new T.Mesh(new T.PlaneGeometry(125,61),new T.MeshBasicMaterial({color:0x0c354a}));hangarSky.position.set(0,32,-210);hangarSky.visible=false;hangar.add(hangarSky);
const hangarOutside=new T.Group();hangarOutside.add(new T.Mesh(new T.SphereGeometry(3000,24,16),skyMaterial));hangarOutside.add(new T.Points(starsG,new T.PointsMaterial({size:10,vertexColors:true,depthWrite:false,fog:false})));
const interiorEscorts=[];
for(let i=0;i<3;i++){let g=escortTemplates[i%2].clone();g.position.set((i-1)*170,15+i*30,-600-i*170);interiorEscorts.push({g,base:g.position.clone()});hangarOutside.add(g);}hangar.add(hangarOutside);
const hangarMoving=[];for(let i=0;i<3;i++){let g=smallTemplate.clone();hangar.add(g);hangarMoving.push(g);}
for(let z=-150;z<200;z+=100)light(hangar,0x45bdd9,130,V(0,38,z),150);
const hd=new Blocks();
for(let z=-180;z<195;z+=40)for(let s of [-1,1]){
 hd.box(s*68,27,z,2,39,31,2);hd.box(s*66,30,z,2,28,24,1);
 for(let k=0;k<6;k++){hd.box(s*64,23+k*3,z+9,2,1,7,2);hd.box(s*58,19,z-11+k*4,13,1,1,1);}
 hd.box(s*63,49,z,3,8,13,2);hd.box(s*62,50,z,2,2,8,5);
 hd.box(s*43,3,z,24,2,30,2);hd.box(s*43,5,z,20,2,26,1);
 for(let x=0;x<8;x++)hd.box(s*(30+x*2),5,z-15,1,1,3,x%2?3:1);
 hd.box(s*45,58,z,5,5,30,1);hd.box(s*43,55,z,3,1,26,3);
}
for(let z=-185;z<195;z+=12){hd.box(0,1,z,1,1,5,3);for(let s of [-1,1]){hd.box(s*23,1,z,1,1,2,2);hd.box(s*69,13,z,1,5,3,0);}}
hangar.add(hd.finish());
// Bay identification is part of the architecture, built from the same unit voxels.
const glyphs=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
const signs=new Blocks();
for(let s of [-1,1])for(let i=0;i<10;i++){let z=-180+i*40;signs.box(s*64,53,z,2,9,15,1);let digits=String(i+1).padStart(2,'0');for(let n=0;n<2;n++)for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(glyphs[Number(digits[n])][row*3+col]==='1')signs.box(s*62,55-row,z-5+n*5+col,1,1,1,3);}
hangar.add(signs.finish());
const gantries=[];
for(let z of [42,-102]){let rails=new Blocks();rails.box(0,63,z-9,127,3,3,2).box(0,63,z+9,127,3,3,2);hangar.add(rails.finish());let b=new Blocks();b.plate(0,0,0,24,5,23,2).box(0,-4,0,12,4,12,1);for(let s of [-1,1])b.box(s*9,-11,0,3,18,5,3).box(s*6,-19,0,9,3,7,0);b.box(0,-6,0,6,1,6,4);let node=b.finish();hangar.add(node);gantries.push({node,z});}

const bridge=baseScene(true);bridge.fog=new T.FogExp2(0x081321,.002);const bb=new Blocks();floorTiles(bb,134,134);bb.box(0,-7,0,140,10,140,2);
for(let s of [-1,1]){bb.box(s*53,6,8,26,12,117,0);bb.box(s*65,27,5,7,52,135,1);for(let z=-50;z<62;z+=24){bb.box(s*48,15,z,20,7,15,1);bb.box(s*48,20,z,19,3,13,2);screen(bb,s*48,26,z-5,16,8);bb.box(s*64,35,z,5,52,6,0);bb.box(s*58,45,z,17,4,7,3);screen(bb,s*49,43,z,19,10);}bb.box(s*39,13,8,2,2,116,4);}
for(let z of [-64,-22,23,65]){bb.box(0,60,z,134,7,7,0);bb.box(0,56,z,112,2,3,4);}
bb.box(0,64,14,136,5,105,1);bb.frame(0,31,-66,126,62,5,5,0);bb.box(0,4,-65,126,8,8,1);
for(let j=0;j<4;j++)bb.box(0,j*3,0,44-j*5,3,44-j*5,j%2===0?2:0);
bb.box(0,14,0,24,7,24,1).box(0,18,0,28,2,28,8);bb.frame(0,42,-9,34,15,2,1,2).box(0,42,-9,32,13,1,9).box(0,54,-9,2,8,2,1);
bb.box(0,39,-7,3,5,1,4).box(-3,44,-7,2,6,1,4).box(3,44,-7,2,6,1,4).box(0,39,-7,9,1,1,4);
for(let s of [-1,1]){for(let y of [38,46])bb.box(s*10,y,-7,3,1,1,4).box(s*10,y+1,-7,1,2,1,4);for(let x of [5,8,11])bb.box(s*x,42,-7,1,1,1,2);}
for(let x=-13;x<14;x+=3)bb.box(x,36,-7,1,1,1,x<0?4:5);bb.box(-15,48,-7,3,1,1,5);bridge.add(bb.finish());
const holo=new T.Group();bridge.add(holo);
const holoMaterial=new T.MeshBasicMaterial({color:0x65e2ed,transparent:true,opacity:.58,depthWrite:false,blending:T.AdditiveBlending});
for(let i=0;i<13;i++){let b=new Blocks(),x=0,y=27,z=0;
 if(i===0){b.box(0,0,2,3,2,13,4).box(0,2,4,3,2,5,4);for(let s of [-1,1])b.box(s*3,0,-5,2,2,11,4).box(s*5,0,5,3,1,7,4);}
 else{let side=i%2?1:-1,row=Math.floor((i-1)/2);x=side*(11+(row%2)*7);z=-19+row*7;y=26+(row%3-1)*3;b.box(0,0,0,1,1,5,4).box(0,0,1,row<3?5:3,1,1,4);}
 let g=b.finish();g.traverse(m=>{if(m.isMesh){m.material=holoMaterial;m.castShadow=false;}});g.position.set(x,y,z);g.userData.home=[x,y,z];g.add(line([V(0,-1,4),V(0,-1,i?10:16)],0x48c4dc,.35));holo.add(g);
}
for(let r of [12,20,27]){let p=[];for(let i=0;i<=64;i++)p.push(V(Math.cos(i/64*TAU)*r,21,Math.sin(i/64*TAU)*r));holo.add(line(p,0x37bfd5,.35));}
const holoSweep=line([V(0,21,0),V(27,21,0)],0x5ceeff,.5);holo.add(holoSweep);
const holoShips=holo.children.filter(o=>o.isGroup);
const bridgeSpace=new T.Group();bridge.add(bridgeSpace);let bg=new T.Mesh(new T.SphereGeometry(2000,24,16),skyMaterial);bridgeSpace.add(bg);
bridgeSpace.add(new T.Points(starsG,new T.PointsMaterial({size:13,vertexColors:true,transparent:true,opacity:.75,depthWrite:false,fog:false})));
for(let i=0;i<8;i++){let g=escortTemplates[i%2].clone();g.position.set((i%4-1.5)*190,-45+(i%2)*90,-450-Math.floor(i/4)*400);interiorEscorts.push({g,base:g.position.clone()});bridgeSpace.add(g);}
const holoLight=light(bridge,0x52e4ff,180,V(0,28,0),150);light(bridge,0xffba6a,75,V(-50,36,-40),150);
const bd=new Blocks();
for(let s of [-1,1])for(let z=-50;z<62;z+=24){
 for(let k=0;k<6;k++){bd.box(s*48-7+k*3,22,z+2,1,1,3,k%3?2:5);bd.box(s*48-7+k*3,23,z+5,1,1,1,4);}
 bd.box(s*35,7,z,2,2,17,3);bd.box(s*61,31,z+8,3,26,4,2);bd.box(s*60,33,z+8,1,16,1,4);
}
for(let s of [-1,1]){bd.box(s*12,20,0,1,1,23,4);bd.box(0,20,s*12,23,1,1,4);for(let z=-57;z<60;z+=7)bd.box(s*33,1,z,2,1,3,2);}
for(let z of [-61,-20,23,62])for(let x=-48;x<=48;x+=12){bd.box(x,54,z,7,3,6,2);bd.box(x,52,z,2,1,3,3);}
bridge.add(bd.finish());
const mezzanine=new Blocks();
for(let s of [-1,1]){
 mezzanine.box(s*55,31,-2,20,4,105,2).box(s*46,34,-2,2,2,103,3);
 for(let z=-45;z<50;z+=25){mezzanine.box(s*57,22,z,5,17,6,1);mezzanine.box(s*46,37,z,2,7,2,2);}
 for(let j=0;j<8;j++)mezzanine.box(s*40,7+j*3,51-j*4,9,3,4,0);
}
bridge.add(mezzanine.finish());
const glassDisplays=[];
for(let s of [-1,1]){let b=new Blocks();b.box(0,0,0,20,13,1,9);for(let x of [-10,10])b.box(x,0,0,1,15,2,2);b.box(0,7,0,21,1,2,3);for(let i=0;i<5;i++){b.box(-7+i*3,-3+i%3,1,2,1,1,4);b.box(-7+i*3,4,1,1,1,1,i%2?5:4);}let node=b.finish();node.position.set(s*26,35,-26);node.rotation.y=-s*.2;bridge.add(node);glassDisplays.push(node);}

const reactor=baseScene(true);reactor.fog=new T.FogExp2(0x061824,.0022);const rb=new Blocks();
for(let s of [-1,1]){rb.box(s*127,0,0,8,260,260,1);rb.box(0,0,s*127,250,260,8,1);}
for(let y=-115;y<=115;y+=46){for(let s of [-1,1]){rb.box(s*105,y,0,20,6,246,0);rb.box(0,y,s*105,190,6,20,0);rb.box(s*94,y+5,0,2,2,220,4);rb.box(0,y+5,s*94,170,2,2,4);for(let z=-100;z<=100;z+=40){rb.box(s*121,y+17,z,6,35,10,2);rb.box(s*117,y+24,z,2,3,15,5);}}}
for(let x of [-115,115])for(let z of [-115,115])rb.box(x,0,z,15,250,15,2);
for(let y of [-90,90])for(let s of [-1,1]){rb.box(s*66,y,0,110,9,16,2);rb.box(0,y,s*66,16,9,110,2);rb.box(s*66,y+6,0,105,2,4,4);rb.box(0,y+6,s*66,4,2,105,4);}
reactor.add(rb.finish());let core=new T.Group();reactor.add(core);let cb=new Blocks();
for(let y=-80;y<=80;y+=4){let width=16+10*Math.pow(Math.cos(y/85*Math.PI/2),2);cb.box(0,y,0,width,3,width,4,.7);for(let s of [-1,1]){cb.box(s*(width/2+8),y,0,4,3,8,2);cb.box(0,y,s*(width/2+8),8,3,4,0);}}
core.add(cb.finish());const coreRings=[];
const cage=new Blocks();
for(let x of [-21,21])for(let z of [-21,21]){cage.box(x,0,z,4,166,4,1);for(let y=-80;y<=80;y+=16)cage.box(x,y,z,7,3,7,2);}
for(let y of [-87,87]){cage.plate(0,y,0,52,6,52,2).plate(0,y+(y>0?4:-4),0,42,3,42,0);for(let s of [-1,1])cage.box(s*15,y+(y>0?6:-6),0,3,2,29,3);}
core.add(cage.finish());
const coreUniform={value:0};core.children[0].children.forEach(m=>{if(m.material===materials[4]){m.material=m.material.clone();m.material.onBeforeCompile=shader=>{shader.uniforms.flowTime=coreUniform;shader.vertexShader='varying vec3 localVoxel;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlocalVoxel=position;');shader.fragmentShader='uniform float flowTime;varying vec3 localVoxel;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=.3+1.6*pow(.5+.5*sin(localVoxel.y*.13-flowTime*2.3),4.);');};}});
for(let j=0;j<5;j++){let b=new Blocks(),r=40+((j+1)%2)*10;for(let a=0;a<32;a++){let theta=a/32*TAU,x=Math.round(Math.cos(theta)*r),z=Math.round(Math.sin(theta)*r);b.box(x,0,z,7,8,7,a%8<2?3:0);if(a%4===0)b.box(x,5,z,3,2,3,4);}let g=b.finish();g.position.y=(j-2)*34;reactor.add(g);coreRings.push(g);}
const coreLight=light(reactor,0x26d5ed,1000,V(0,0,0),330);light(reactor,0x478fff,400,V(0,85,0),240);light(reactor,0x40edff,400,V(0,-90,0),240);
coreLight.castShadow=true;coreLight.shadow.mapSize.set(1024,1024);coreLight.shadow.bias=-.0002;coreLight.shadow.normalBias=.2;coreLight.shadow.camera.near=1;coreLight.shadow.camera.far=340;
const rd=new Blocks();
for(let y=-110;y<116;y+=46)for(let s of [-1,1])for(let j=-90;j<=90;j+=30){
 rd.box(s*119,y+16,j,5,27,22,2);rd.box(s*115,y+17,j,2,19,15,1);rd.box(s*113,y+17,j,1,12,1,4);
 rd.box(j,y+16,s*119,22,27,5,2);rd.box(j,y+17,s*115,15,19,2,1);rd.box(j,y+17,s*113,1,12,1,4);
 rd.box(s*94,y+8,j,2,6,2,3);rd.box(j,y+8,s*94,2,6,2,3);
}
for(let y=-120;y<125;y+=8)for(let s of [-1,1]){rd.box(s*122,y,-73,2,3,9,3);rd.box(-73,y,s*122,9,3,2,3);}
reactor.add(rd.finish());
const interiorPulses=[];
for(let i=0;i<28;i++){let b=new Blocks();b.box(0,0,0,i<20?2:5,2,i<20?2:4,4);let node=b.finish();reactor.add(node);interiorPulses.push({node,phase:i/28,kind:i<20?0:1});}

const conduit=baseScene(true);conduit.fog=new T.FogExp2(0x06131c,.002);const eb=new Blocks();floorTiles(eb,104,380);const machinery=[];const packets=[];
for(let z=-170;z<=170;z+=34){eb.frame(0,34,z,104,68,7,5,0);eb.frame(0,34,z-4,94,58,2,2,3);for(let s of [-1,1]){eb.box(s*39,27,z,20,45,23,1);eb.box(s*44,29,z,9,50,27,0);eb.box(s*29,28,z,3,28,12,4,.65);eb.box(s*32,8,z,15,4,27,2);eb.box(s*32,52,z,15,5,27,2);let mb=new Blocks();mb.box(0,0,0,14,5,14,2).box(-s*5,0,0,3,9,16,3);let m=mb.finish();m.position.set(s*29,44,z);conduit.add(m);machinery.push({m,s,z});}eb.box(0,59,z,34,8,13,1);eb.box(0,54,z,20,2,9,4);}
for(let s of [-1,1]){eb.box(s*14,2,0,4,2,380,2);eb.box(s*14,4,0,2,2,378,4);eb.box(s*51,34,0,4,68,380,1);}
eb.box(0,69,0,104,5,380,1);for(let j=0;j<5;j++)eb.frame(0,34,-193-j*4,80-j*10,58-j*6,3,3,j%2?4:0);eb.box(0,34,-215,32,28,3,4);conduit.add(eb.finish());
for(let i=0;i<16;i++){let b=new Blocks();b.box(0,0,0,6,6,10,5).box(0,0,0,10,2,14,3);let g=b.finish();conduit.add(g);packets.push(g);}
const packetLights=Array.from({length:4},()=>light(conduit,0xffb653,100,V(),85));
for(let z=-150;z<=150;z+=75)light(conduit,0x27cadd,180,V(0,35,z),110);
const ed=new Blocks();
for(let z=-170;z<=170;z+=34)for(let s of [-1,1]){
 for(let y=17;y<=41;y+=6){ed.box(s*27,y,z,3,2,15,1);ed.box(s*25,y,z,2,1,17,2);}
 ed.box(s*27,28,z-8,4,31,3,3);ed.box(s*27,28,z+8,4,31,3,2);
 for(let y of [13,44]){ed.box(s*24,y,z,8,3,19,0);ed.box(s*21,y,z,2,2,11,1);}
 for(let j=-2;j<=2;j++)ed.box(s*35,5,z+j*4,12,2,2,2);
 ed.box(s*19,57,z,3,6,5,3);ed.box(s*19,61,z,3,2,19,2);
}
for(let y=-1;y<60;y+=5)ed.box(0,y,-212,30,2,2,1);
conduit.add(ed.finish());
const capacitors=[];
for(let z=-140;z<=166;z+=102){let b=new Blocks();b.frame(0,0,0,22,18,8,3,2).frame(0,0,-5,18,14,2,2,3);b.box(0,0,0,8,8,9,5).box(0,0,0,12,3,12,1);let node=b.finish();node.position.set(0,50,z);conduit.add(node);capacitors.push(node);}

// Interior haze does not tint the ships beyond the open observation portals.
for(let scene of [hangar,bridge,reactor,conduit])scene.environment=reflection.texture;
const exteriorMaterials=new Map();for(let group of [bridgeSpace,hangarOutside])group.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial){let m=o.material;if(!exteriorMaterials.has(m)){let copy=m.clone();copy.fog=false;exteriorMaterials.set(m,copy);}o.material=exteriorMaterials.get(m);}});

// Weapons live in the exterior coordinate space; every effect is a function of global time.
const combat=new T.Group();space.add(combat);
function beamMesh(color,r){return new T.Mesh(new T.CylinderGeometry(r,r,1,12,1,true),glowMat(color,.8));}
function connect(mesh,a,b,r=1){let dir=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(V(0,1,0),dir.clone().normalize());mesh.scale.set(r,dir.length(),r);}
const beamOuter=beamMesh(0x19bddb,11),beamInner=beamMesh(0xa4ffff,3.2);beamInner.material.color.multiplyScalar(3);combat.add(beamOuter,beamInner);
const beamContact=glowBall(8,0xffb75a),beamContactLight=light(space,0xffa459,0,V(),150),beamRay=new T.Raycaster();combat.add(beamContact);
const beamRockMeshes=rocks[0].pieces.flatMap(p=>p.obj.children.filter(o=>o.isMesh&&o.material===materials[6]));
const beamAfterglow=beamMesh(0x66d9ee,3);combat.add(beamAfterglow);
const charge=glowBall(10,0x71edff);charge.position.set(0,17,-429);combat.add(charge);
const muzzleLight=light(space,0x50e6ff,0,V(0,28,-430),500);
const beamRings=[];for(let i=0;i<7;i++){let m=new T.Mesh(new T.TorusGeometry(22,1,8,64),glowMat(0x78f8ff,.7));combat.add(m);beamRings.push(m);}
const pulse=[];for(let i=0;i<70;i++){let m=beamMesh(0x40eaff,2.8);combat.add(m);pulse.push(m);}
const pulseHeads=pulse.map(()=>{let m=glowBall(3.5,0x9affff);m.material.color.multiplyScalar(2);combat.add(m);return m;});
const tracers=[];for(let i=0;i<140;i++){let m=beamMesh(0xffca70,.6);combat.add(m);tracers.push(m);}
const flashes=[];
for(let i=0;i<14;i++){let m=glowBall(i<10?4:2, i<10?0x90ffff:0xffd494);m.material.color.multiplyScalar(2);combat.add(m);flashes.push(m);}
const batteryLight=light(space,0x4bdfff,0,V(88,75,-90),250);
const weaponLights=[];
for(let i=0;i<8;i++)weaponLights.push(light(space,i<4?0x5fe5ff:0xffb85b,0,V(),i<4?170:110));
const missiles=[];
for(let i=0;i<14;i++){let b=new Blocks();b.box(0,0,0,3,3,10,0).box(0,0,-6,2,2,3,3).box(0,0,5,3,3,1,1).box(0,0,3,7,1,3,2);let m=b.finish();m.name='missile-'+i;combat.add(m);let flare=glowBall(3,0xffc471);flare.position.z=7;flare.material.color.multiplyScalar(2);m.add(flare);let trail=new T.Mesh(new T.BufferGeometry(),new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{fade:{value:1}},vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 v;uniform float fade;void main(){gl_FragColor=vec4(mix(vec3(1.,.32,.05),vec3(2.,1.5,.65),pow(max(0.,1.-v.x),5.)),pow(max(0.,1.-v.x),1.4)*fade*.7);}`}));trail.frustumCulled=false;combat.add(trail);missiles.push({m,trail,flare});}
const blasts=[];for(let i=0;i<4;i++){let ball=glowBall(1,0xffb968),ring=new T.Mesh(new T.TorusGeometry(1,.025,8,64),glowMat(0x63e8ff,.7));combat.add(ball,ring);blasts.push({ball,ring});}
const debris=[];for(let i=0;i<180;i++){let b=new Blocks(),s=1+Math.floor(rand()*5);b.box(0,0,0,s,s,s,i%5===0?3:6);let m=b.finish();combat.add(m);debris.push({m,dir:V(rand()-.5,rand()-.5,rand()-.5).normalize().multiplyScalar(22+rand()*90)});}
const impactClouds=[];
for(let i=0;i<48;i++){
 let seedValue=rand()*50,dir=V(rand()-.5,rand()-.5,rand()-.5).normalize();
 let material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{age:{value:0},seedValue:{value:seedValue}},vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 v;uniform float age,seedValue;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}void main(){vec2 q=v*2.-1.;float noise=n(q*3.+seedValue)+.5*n(q*7.+seedValue-age*.1);float shape=(1.-smoothstep(.35,1.,length(q)))*(.2+noise*.7);float a=shape*.16*smoothstep(0.,.25,age)*(1.-smoothstep(2.,6.,age));vec3 c=mix(vec3(.32,.16,.065),vec3(.025,.043,.055),smoothstep(0.,2.5,age));gl_FragColor=vec4(c,a);}`});
 let mesh=new T.Mesh(new T.PlaneGeometry(1,1),material);mesh.frustumCulled=false;combat.add(mesh);impactClouds.push({mesh,dir,index:i%4,delay:Math.floor(i/4)*.065,size:25+rand()*35});
}
const sprayDirections=[],sprayColors=[],sprayGeometry=new T.BufferGeometry();
for(let i=0;i<480;i++){sprayDirections.push(V(rand()-.5,rand()-.5,rand()-.5).normalize().multiplyScalar(45+rand()*130));let c=new T.Color(i%4===1?0x79ddea:0xffc278);sprayColors.push(c.r,c.g,c.b,c.r*.3,c.g*.3,c.b*.3);}
sprayGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(480*6),3));sprayGeometry.setAttribute('color',new T.Float32BufferAttribute(sprayColors,3));
const spray=new T.LineSegments(sprayGeometry,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.7,blending:T.AdditiveBlending,depthWrite:false}));spray.frustumCulled=false;combat.add(spray);
const hitSparks=[];
for(let i=0;i<224;i++){
 let m=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{fade:{value:0},tint:{value:new T.Color(i<70?0x63dfff:0xffb875)}},vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 v;uniform float fade;uniform vec3 tint;void main(){vec2 q=v*2.-1.;float d=length(q);float a=exp(-d*d*5.)*(1.-smoothstep(.7,1.,d));float ray=pow(max(0.,1.-abs(q.x*q.y)*30.),4.)*exp(-d*4.);gl_FragColor=vec4(tint*2.5,(a+ray*.4)*fade);}`}));combat.add(m);hitSparks.push(m);
}
function spark(i,pos,age,duration,size){let m=hitSparks[i];m.visible=age>=0&&age<duration;if(m.visible){m.position.copy(pos);m.quaternion.copy(camera.quaternion);m.scale.setScalar(size*(.6+age/duration));m.material.uniforms.fade.value=Math.pow(1-age/duration,2);}}
function escortBoost(index,t){let delay=clamp((escorts[index].userData.z+1500)/2500)*.85;return smooth(72+delay,78+delay,t)+(1-smooth(0,7,t));}
function escortPosition(index,t){let b=escorts[index].userData,phase=t/DURATION*TAU+index*.71,spread=smooth(51,56,t)*(1-smooth(68,74,t));return V(b.x*(1+spread*.22)+Math.sin(phase)*9,b.y+Math.sin(phase*2)*6,b.z+Math.cos(phase)*12-80*escortBoost(index,t));}
function escortQuaternion(index,t){let phase=t/DURATION*TAU+index*.71;return new T.Quaternion().setFromEuler(new T.Euler(0,Math.sin(phase)*.012,Math.sin(phase)*.008));}
function aimGun(gun,target,amount){let world=gun.parent.localToWorld(gun.position.clone()),d=target.clone().sub(world).applyQuaternion(gun.parent.getWorldQuaternion(new T.Quaternion()).invert());gun.rotation.y=Math.atan2(-d.x,-d.z)*amount;gun.rotation.x=Math.atan2(d.y,Math.hypot(d.x,d.z))*amount;gun.updateMatrixWorld(true);}
function guardSource(index,alternate=0){let gun=guardGuns[index].guns[0];return gun.localToWorld(V(alternate%2?3:-3,6,-20));}
function weaponMuzzleAt(shipIndex,gun,target,t,local){let q=shipIndex<0?new T.Quaternion():escortQuaternion(shipIndex,t),origin=gun.position.clone().applyQuaternion(q);if(shipIndex>=0)origin.add(escortPosition(shipIndex,t));let d=target.clone().sub(origin).applyQuaternion(q.clone().invert()),rotation=new T.Euler(Math.atan2(d.y,Math.hypot(d.x,d.z)),Math.atan2(-d.x,-d.z),0,'YXZ');return local.clone().applyEuler(rotation).applyQuaternion(q).add(origin);}
const pulseEvents=pulse.map((m,i)=>{let k=i%10,start=57.7+Math.floor(i/10)*.55+k*.07,piece=2+(k%3)*3,hit=start+1.6,b=rockSurface(1,piece,hit),a=weaponMuzzleAt(-1,mainGuns[k],b,start,V(k%2?7:-6,13,-44));return{start,hit,piece,a,b};});
const tracerEvents=tracers.map((m,i)=>{let k=i%4,start=60.5+Math.floor(i/4)*.09,piece=2+(i%3)*3,hit=start+.9,b=rockSurface(2,piece,hit),a=weaponMuzzleAt(k,guardGuns[k].guns[0],b,start,V(Math.floor(i/4)%2?3:-3,6,-20));return{start,hit,piece,a,b};});
function missileCell(i,t){let ship=16+i%8,slot=i<8?2:6;return V((i%2?1:-1)*(42+Math.min(slot,4)*3),10,-70+slot*15).applyQuaternion(escortQuaternion(ship,t)).add(escortPosition(ship,t));}
const missileEvents=missiles.map((m,i)=>{let start=60.8+i*.23,hit=start+3.3,piece=2+(i%3)*3;return{start,hit,piece,a:missileCell(i,start),b:rockSurface(3,piece,hit)};});
function missilePoint(i,p){let e=missileEvents[i],q=e.a.clone().lerp(e.b,p*p),arc=Math.sin(p*Math.PI);q.y+=arc*(100+i*7);q.x+=arc*arc*(i%2?100:-100);return q;}
// Every follow-up impact sheds physical unit-grid chips from the struck moving face.
const impactEvents=[...pulseEvents.map(e=>({e,rock:1,kind:0})),...tracerEvents.map(e=>({e,rock:2,kind:1})),...missileEvents.map(e=>({e,rock:3,kind:2}))];
const chipRecords=[],chipCounts=[0,0,0],chipBatches=[];
function impactNormal(rock,piece,t){let p=rocks[rock].pieces[piece],dt=fractureAge(rock,piece,t);return V(0,0,1).applyEuler(new T.Euler(p.spin.x*dt,p.spin.y*dt,p.spin.z*dt)).applyAxisAngle(V(0,1,0),Math.sin(t*.02+rock)*.06);}
impactEvents.forEach(({e,rock,kind},i)=>{
 for(let k=0;k<[4,2,7][kind];k++){
  let start=e.hit+k*.018,n=impactNormal(rock,e.piece,start),j=chipRecords.length%3;
  let scatter=V(rand()-.5,rand()-.5,rand()-.5).normalize(),dir=n.clone().multiplyScalar(22+rand()*28).addScaledVector(scatter,14+rand()*28).multiplyScalar(kind===2?1.55:kind===1?.75:1);
  dir.addScaledVector(rocks[rock].pieces[e.piece].vel,.7);
  chipRecords.push({batch:j,slot:chipCounts[j]++,start,origin:rockSurface(rock,e.piece,start),dir,axis:V(rand()-.5,rand()-.5,rand()-.5).normalize(),spin:.7+rand()*1.8,rock,piece:e.piece});
 }
});
for(let i=0;i<3;i++){let b=new Blocks();b.box(0,0,0,i===0?1:2,i===2?3:2,i===1?3:2,6);if(i===2)b.box(1,0,1,2,1,2,6);let g=b.finish(),m=new T.InstancedMesh(g.children[0].geometry,materials[6],chipCounts[i]);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;m.receiveShadow=true;m.name='impact-chips-'+i;combat.add(m);chipBatches.push(m);}
const impactFollowLights=[];for(let i=0;i<6;i++)impactFollowLights.push(light(space,0xffbb79,0,V(),160));
const chipMatrix=new T.Matrix4(),chipQuaternion=new T.Quaternion(),chipPosition=V(),chipScale=V(1,1,1);

// Compact HDR bloom chain, rendered at the caller's actual viewport resolution.
const rt=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true,samples:4});
rt.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
const bloomA=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
const bloomB=bloomA.clone();
const postScene=new T.Scene(),postCam=new T.OrthographicCamera(-1,1,1,-1,0,1);
const pv=`varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const blur=new T.ShaderMaterial({uniforms:{source:{value:rt.texture},stepv:{value:new T.Vector2()},threshold:{value:1}},vertexShader:pv,fragmentShader:`varying vec2 v;uniform sampler2D source;uniform vec2 stepv;uniform float threshold;vec3 sampleAt(vec2 p){vec3 c=texture2D(source,p).rgb;return c*max(0.,1.-threshold/max(.0001,max(c.r,max(c.g,c.b))));}void main(){vec3 c=sampleAt(v)*.227027;c+=(sampleAt(v+stepv*1.384615)+sampleAt(v-stepv*1.384615))*.316216;c+=(sampleAt(v+stepv*3.230769)+sampleAt(v-stepv*3.230769))*.070270;gl_FragColor=vec4(c,1.);}`});
const grade=new T.ShaderMaterial({uniforms:{source:{value:rt.texture},bloom:{value:bloomA.texture},depthMap:{value:rt.depthTexture},inverseProjection:{value:camera.projectionMatrixInverse},resolution:{value:new T.Vector2()},time:{value:0},aspect:{value:1}},vertexShader:pv,fragmentShader:`varying vec2 v;uniform sampler2D source,bloom,depthMap;uniform mat4 inverseProjection;uniform vec2 resolution;uniform float time,aspect;
vec3 viewPos(vec2 uv){float d=texture2D(depthMap,uv).x;vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
float ao(){vec3 p=viewPos(v);if(-p.z>7000.)return 1.;vec3 n=normalize(cross(dFdx(p),dFdy(p)));float rad=clamp(-p.z*.045,3.,44.),occ=0.;for(int i=0;i<12;i++){float a=float(i)*2.39996;float r=3.+float(i)*2.1;vec3 q=viewPos(v+vec2(cos(a),sin(a))*r/resolution)-p;float d=length(q);occ+=max(0.,dot(n,q/max(d,.001))-.08)*(1.-smoothstep(rad*.2,rad,d));}return clamp(1.-occ*.14,.5,1.);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}void main(){vec3 c=texture2D(source,v).rgb*ao()+texture2D(bloom,v).rgb*.34;c=aces(c*.88);float vin=1.-.25*pow(length((v-.5)*vec2(1.1,1.)),1.5);c=pow(c*vin,vec3(1./2.2));float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;c+=grain*.005;float edge=min(v.y,1.-v.y);float bar=aspect<2.15?(1.-aspect/2.15)*.5:0.;c*=smoothstep(bar,bar+.001,edge);gl_FragColor=vec4(c,1.);}`});
const quad=new T.Mesh(new T.PlaneGeometry(2,2),grade);postScene.add(quad);
let width=0,height=0;
function resize(){let w=innerWidth,h=innerHeight;if(w===width&&h===height)return;width=w;height=h;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();rt.setSize(w,h);bloomA.setSize(Math.ceil(w/2),Math.ceil(h/2));bloomB.setSize(Math.ceil(w/2),Math.ceil(h/2));grade.uniforms.aspect.value=w/h;grade.uniforms.resolution.value.set(w,h);}
function draw(scene){resize();renderer.setRenderTarget(rt);renderer.render(scene,camera);quad.material=blur;blur.uniforms.source.value=rt.texture;blur.uniforms.threshold.value=1.1;blur.uniforms.stepv.value.set(2/width,0);renderer.setRenderTarget(bloomA);renderer.render(postScene,postCam);blur.uniforms.threshold.value=0;blur.uniforms.source.value=bloomA.texture;blur.uniforms.stepv.value.set(0,3/height);renderer.setRenderTarget(bloomB);renderer.render(postScene,postCam);blur.uniforms.source.value=bloomB.texture;blur.uniforms.stepv.value.set(4/width,0);renderer.setRenderTarget(bloomA);renderer.render(postScene,postCam);quad.material=grade;renderer.setRenderTarget(null);renderer.render(postScene,postCam);}

function pose(pos,target,fov=48,roll=0){camera.position.set(...pos);camera.up.set(Math.sin(roll),Math.cos(roll),0);camera.lookAt(...target);if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}}
function curve(keys,t){let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;let a=keys[i],b=keys[i+1],p=clamp((t-a[0])/(b[0]-a[0]));let p0=keys[Math.max(0,i-1)],p3=keys[Math.min(keys.length-1,i+2)];const out=[];for(let j=1;j<a.length;j++){let v0=(b[j]-p0[j])/(b[0]-p0[0])*(b[0]-a[0]),v1=(p3[j]-a[j])/(p3[0]-a[0])*(b[0]-a[0]);out.push((2*p*p*p-3*p*p+1)*a[j]+(p*p*p-2*p*p+p)*v0+(-2*p*p*p+3*p*p)*b[j]+(p*p*p-p*p)*v1);}return out;}
const exteriorKeys=[
 [0,1150,620,1370,0,0,-120,48],
 [5,1000,470,760,0,0,-120,48],
 [9,580,140,-100,0,-10,-170,51],
 [12,380,-115,-440,30,-48,-200,55],
 [15,285,-95,-430,100,-30,-250,56],
 [17,260,-48,-285,140,-25,-244,54],
 [19,161,-25,-244,100,-24,-244,54]
];
const endingKeys=[
 [69,1600,770,-1200,150,0,-850,54],
 [73,1650,790,10,0,0,-100,50],
 [77,1240,710,1736,0,0,-120,48],
 [80,1150,620,1370,0,0,-120,48]
];
let lastTime=0;
function update(t){t=((t%DURATION)+DURATION)%DURATION;lastTime=t;let scene=space;
 // Shared deterministic periodic movement; no incremental integration.
 let spread=smooth(51,56,t)*(1-smooth(68,74,t));
 escorts.forEach((g,i)=>{let b=g.userData,phase=t/DURATION*TAU+i*.71;g.position.copy(escortPosition(i,t));g.rotation.y=Math.sin(phase)*.012;g.rotation.z=Math.sin(phase)*.008;});
 shuttles.forEach((g,i)=>{let a=t/80*TAU*(i<6?2:4)+i*.73;if(i<6){g.position.set(260+Math.sin(a)*20,52+i*7, -50+490*Math.cos(a));g.rotation.y=Math.atan2(-20*Math.cos(a),490*Math.sin(a));}else{g.position.set(242+38*Math.cos(a),-25,-230+95*Math.sin(a));g.rotation.y=Math.atan2(38*Math.sin(a),-95*Math.cos(a));}});
 let boost=smooth(72,79,t)+(1-smooth(0,6,t));
 engines.forEach(e=>{e.m.uniforms.time.value=t/80*TAU;e.m.uniforms.power.value=1+boost;e.flame.scale.z=(1+boost*2)*(.96+.04*Math.sin(t/80*TAU*38));});
 // Plume clones have own transforms but shared shader uniforms.
 escorts.forEach((g,i)=>g.traverse(o=>{if(o.name==='engine-plume')o.scale.z=1+escortBoost(i,t)*2;}));
 shieldReflection.value=t<7?1-smooth(0,6,t):smooth(70,73,t);engineLight.intensity=900+boost*1700;shieldLight.intensity=(t<7?1-smooth(0,6,t):smooth(70,73,t))*800;
 shields.forEach(s=>{let on=70+s.index*.085,alpha=smooth(on,on+1.2,t);if(t<7)alpha=1-smooth(0,6,t);s.m.uniforms.time.value=t/80*TAU*6;s.m.uniforms.alpha.value=alpha;s.m.uniforms.wave.value=(((t-on)*.6)%1+1)%1;s.mesh.visible=alpha>.001;s.mesh.scale.copy(s.base).multiplyScalar(.68+.32*smooth(on,on+1.5,t));if(t<7)s.mesh.scale.copy(s.base);});
 rocks.forEach((r,i)=>{r.group.position.copy(r.base);if(t<14)r.group.position.z-=6000*(1-smooth(0,14,t));if(t>73)r.group.position.z+=(t-73)*(t-73)*120;r.group.rotation.y=Math.sin(t*.02+i)*.06;r.pieces.forEach((p,j)=>{let dt=i<4?fractureAge(i,j,t):0;p.obj.position.copy(p.home).addScaledVector(p.vel,dt*.7);p.obj.rotation.set(p.spin.x*dt,p.spin.y*dt,p.spin.z*dt);});});
 let travel=5000*(t/80+.1*Math.sin(TAU*t/80));let dp=dg.attributes.position.array,sp=speedGeometry.attributes.position.array;for(let i=0;i<700;i++){let z=((dustP[i*3+2]+2500+travel)%5000)-2500;dp[i*3+2]=z;if(i<180){sp[i*6]=sp[i*6+3]=dustP[i*3];sp[i*6+1]=sp[i*6+4]=dustP[i*3+1];sp[i*6+2]=z;sp[i*6+5]=z+2+boost*28;}}dg.attributes.position.needsUpdate=true;speedGeometry.attributes.position.needsUpdate=true;speedLines.material.opacity=.08+boost*.18;
 hangarMoving.forEach((g,i)=>{
  let p=clamp((t-(i===0?19:i===1?17:16))/(i===1?11:12));
  if(i===1){g.position.set(-15-38*smooth(.72,.95,p),17+19*smooth(.62,.75,p)-10*smooth(.91,.99,p),-240+380*clamp(p/.75));g.rotation.y=Math.PI-.35*Math.sin(Math.PI*smooth(.72,.95,p));}
  else{let y=26+10*smooth(0,.08,p)-7*smooth(.18,.3,p);g.position.set(mix(53,-8,smooth(.07,.24,p)),y,(100-i*80)-Math.max(0,(p-.24)/.76)*450);g.rotation.y=.35*Math.sin(Math.PI*smooth(.07,.24,p));}
 });
 gantries.forEach(({node,z},i)=>{node.position.set(Math.sin(t*.27+i*2)*27,57+Math.sin(t*.6+i)*2,z);});
 interiorEscorts.forEach(({g,base},i)=>{let p=t/80*TAU+i;g.position.copy(base).add(V(Math.sin(p)*9,Math.sin(p*2)*5,Math.cos(p)*24));g.rotation.y=Math.sin(p)*.012;});
 glassDisplays.forEach((node,i)=>{node.position.y=35+Math.sin(t*.5+i)*.5;});capacitors.forEach((node,i)=>{node.rotation.z=Math.sin(t*.7+i)*.09;node.position.y=50+Math.sin(t*1.2+i)*1.5;});
 coreUniform.value=t;holoShips.forEach((g,i)=>{let b=g.userData.home;g.position.set(b[0],b[1]+Math.sin(t*.8+i)*.6,b[2]+Math.sin(t*.22+i));});
 interiorPulses.forEach(({node,phase,kind},i)=>{if(kind===0){let p=(t*.18+phase)%1;node.position.set(33*Math.cos(phase*TAU),-90+p*180,33*Math.sin(phase*TAU));}else{let p=(t*.35+phase)%1;node.position.set((i%2?1:-1)*(32+p*75),i%2?96:-84,0);}});
 holo.rotation.y=t*.06;holo.position.y=Math.sin(t)*.4;holoSweep.rotation.y=-t*.5;holoLight.intensity=170+25*Math.sin(t*.8);
 core.rotation.y=t*.1;coreRings.forEach((g,i)=>{g.rotation.y=t*(i%2?-.16:.12)+i*.3;g.rotation.z=Math.sin(t*.4+i)*.11;});coreLight.intensity=1000+200*Math.sin(t*1.7);
 packets.forEach((g,i)=>{g.position.set(i%2?14:-14,8+(i%3===0?42:0),190-((t*33+i*27)%380));});packetLights.forEach((l,i)=>{l.position.copy(packets[i*5].position);l.position.y+=i%3===0?-4:4;l.intensity=(95+20*Math.sin(t*2+i))*(1-smooth(160,190,Math.abs(l.position.z)));});machinery.forEach(({m,s,z},i)=>{m.position.x=s*(29+Math.sin(t*1.4+i*.7)*6);});
 if(t<19){let p=curve(exteriorKeys,t);pose(p.slice(0,3),p.slice(3,6),p[6],-.025*Math.sin(t*.12));}
 else if(t<28){scene=hangar;let u=(t-19)/9;pose([mix(24,5,u),mix(24,31,u),mix(170,-50,u)],[mix(-5,0,u),25,mix(-180,-230,u)],58);}
 else if(t<36){scene=bridge;let u=(t-28)/8;pose([mix(32,-30,u),mix(38,39,u),mix(65,58,u)],[0,24,-18],76);}
 else if(t<45){scene=reactor;let u=(t-36)/9,a=mix(.72,.85,u);pose([Math.sin(a)*124,mix(-55,74,u),Math.cos(a)*124],[0,mix(-12,22,u),0],90,-.025);}
 else if(t<53){scene=conduit;let u=(t-45)/8;pose([mix(9,-9,u),mix(24,32,u),mix(170,-57,u)],[0,32,-210],61);}
 else if(t<69){let p=curve([[53,640,230,-330,0,17,-360,52],[55,720,270,-380,0,17,-640,55],[57,1000,400,-160,0,10,-720,54],[61,1180,470,-630,0,5,-730,57],[65,1430,620,-1060,240,-50,-1200,58],[67,1510,700,-1180,220,-20,-1130,57],[69,1600,770,-1200,150,0,-850,54]],t);pose(p.slice(0,3),p.slice(3,6),p[6]);}
 else{let p=curve(endingKeys,t);pose(p.slice(0,3),p.slice(3,6),p[6]);}
 updateCombat(t);grade.uniforms.time.value=t;draw(scene);
}
function updateCombat(t){
 chipRecords.forEach(c=>{let dt=t-c.start;if(dt<0||dt>12){chipPosition.set(1e6,1e6,1e6);chipQuaternion.identity();}else{chipPosition.copy(c.origin).addScaledVector(c.dir,dt);if(t>73)chipPosition.z+=(t-73)*(t-73)*120;chipQuaternion.setFromAxisAngle(c.axis,dt*c.spin);}chipMatrix.compose(chipPosition,chipQuaternion,chipScale);chipBatches[c.batch].setMatrixAt(c.slot,chipMatrix);});chipBatches.forEach(m=>m.instanceMatrix.needsUpdate=true);
 let litHits=impactEvents.map(hit=>{let age=t-hit.e.hit;return{...hit,power:age>=0&&age<1.8?[1900,480,6700][hit.kind]*Math.exp(-age*[7,15,4][hit.kind]):0};}).filter(hit=>hit.power>1).sort((a,b)=>b.power-a.power);
 impactFollowLights.forEach((l,i)=>{let hit=litHits[i];l.intensity=hit?hit.power:0;if(hit){l.position.copy(rockSurface(hit.rock,hit.e.piece,t)).addScaledVector(impactNormal(hit.rock,hit.e.piece,t),8);l.color.setHex(hit.kind===0?0x68e5ef:hit.kind===1?0xffca83:0xffa44f);l.distance=[140,65,240][hit.kind];}});
 impactClouds.forEach(({mesh,dir,index,delay,size})=>{let age=t-IMPACT[index]-delay;mesh.visible=age>0&&age<6;if(mesh.visible){mesh.position.copy(rocks[index].base).addScaledVector(dir,20+age*22);mesh.quaternion.copy(camera.quaternion);mesh.rotateZ(age*.08+delay);mesh.scale.setScalar(size+age*17);mesh.material.uniforms.age.value=age;}});
 let sv=sprayGeometry.attributes.position.array;for(let i=0;i<480;i++){let k=i%4,age=t-IMPACT[k]-(i%11)*.018,visible=age>=0&&age<2.7,base=rocks[k].base,dir=sprayDirections[i];for(let j=0;j<2;j++){let dt=visible?Math.max(0,age-j*.045):0,index=i*6+j*3;sv[index]=visible?base.x+dir.x*dt:1e6;sv[index+1]=visible?base.y+dir.y*dt:1e6;sv[index+2]=visible?base.z+dir.z*dt:1e6;}}sprayGeometry.attributes.position.needsUpdate=true;
 fleet.updateMatrixWorld(true);
 const aim=smooth(53,56,t)*(1-smooth(67,71,t));
 mainGuns.forEach((gun,i)=>{let cycle=clamp(Math.floor((t-57.7-i*.07)/.55+1e-8),0,6),target=pulseEvents[cycle*10+i].b;aimGun(gun,target,aim);turretSources[i].copy(gun.localToWorld(V(i%2?7:-6,13,-44)));});
 guardGuns.forEach(({guns},i)=>{let cycle=clamp(Math.floor((t-60.5)/.09+1e-8),0,34),target=i<4?tracerEvents[cycle*4+i].b:rockSurface(2,2,Math.max(t,61.4));guns.forEach(gun=>aimGun(gun,target,aim));});
 flashes.forEach((m,i)=>{let start=i<10?57.7+i*.07:60.5,finish=i<10?62:63.65,dt=t-start,period=i<10?.55:.09,p=dt>=0?dt%period:1;m.visible=dt>=0&&t<finish&&p<(i<10?.12:.045);m.position.copy(i<10?turretSources[i]:guardSource(i-10,Math.floor((t-60.5)/.09+1e-8)));m.scale.setScalar(1+Math.max(0,1-p*12)*1.5);m.material.opacity=Math.max(0,1-p*8);});
 weaponLights.forEach((l,i)=>{let gun=i<4?i:i-4,start=i<4?57.7+gun*.07:60.5,period=i<4?.55:.09,dt=t-start,last=i<4?6:34,cycle=clamp(Math.floor(dt/period),0,last),age=dt-cycle*period;l.position.copy(i<4?turretSources[gun]:guardSource(gun,cycle));l.position.y+=3;l.intensity=dt>=0?Math.exp(-Math.max(0,age)*(i<4?20:42))*(i<4?350:150):0;});
 batteryLight.intensity=t>57.7&&t<62?350*(.4+.6*Math.pow(Math.sin(t*11.4),8)):0;
 chargeRails.forEach(({mat,z})=>{let p=smooth(54.2+(-190-z)/200,54.7+(-190-z)/200,t)*(1-smooth(62.5,64,t));mat.emissiveIntensity=.3+p*5;});
 fissures.forEach(({g,heat,index})=>{let dt=t-(IMPACT[index]-(index===0?1.65:.12));g.visible=dt>0&&dt<15;heat.value=dt;});
 impactLights.forEach((l,i)=>{let dt=t-IMPACT[i];l.intensity=dt>0?7000*Math.exp(-dt*.9)*(1+.15*Math.sin(dt*40)):0;});
 let beam=smooth(56.3,57,t)*(1-smooth(61.8,62.7,t)),chargeP=smooth(54.5,56.5,t)*(1-smooth(62,63,t));charge.visible=chargeP>0;charge.scale.setScalar(.3+chargeP*(1+Math.sin(t*13)*.07));charge.material.opacity=chargeP*.8;muzzleLight.intensity=chargeP*1100;
 let a=V(0,17,-429),b=V(0,17,-1740),contact=null;if(beam>0){rocks[0].group.updateMatrixWorld(true);beamRay.set(a,V(0,0,-1));beamRay.near=0;beamRay.far=1600;contact=beamRay.intersectObjects(beamRockMeshes,false)[0];if(contact)b.copy(contact.point);}
 beamContact.visible=!!contact;beamContactLight.intensity=0;if(contact){beamContact.position.copy(b);beamContact.scale.setScalar((1+.12*Math.sin(t*37))*beam);beamContact.material.opacity=beam*.75;beamContactLight.position.copy(b).add(V(0,0,15));beamContactLight.intensity=1500*beam;}
 for(let m of [beamOuter,beamInner]){m.visible=beam>0;connect(m,a,b,beam*(1+.07*Math.sin(t*31)));}beamOuter.material.opacity=.28*beam;beamInner.material.opacity=.95*beam;
 let after=smooth(62.4,64.1,t);beamAfterglow.visible=t>62.4&&t<64.1;connect(beamAfterglow,a.clone().lerp(b,after),b,1-after*.8);beamAfterglow.material.opacity=(1-after)*.5;
 beamRings.forEach((m,i)=>{m.visible=beam>0;let p=((t-56.3)*1.3+i/7)%1;m.position.copy(a).lerp(b,p);m.scale.setScalar(.45+p*.8);m.material.opacity=(1-p)*beam*.5;});
 pulse.forEach((m,i)=>{let e=pulseEvents[i],dt=t-e.start; m.visible=dt>=0&&dt<1.6;pulseHeads[i].visible=m.visible;if(m.visible){let p=dt/1.6,c=e.a.clone().lerp(e.b,p),tail=c.clone().lerp(e.a,.035);connect(m,tail,c);pulseHeads[i].position.copy(c);}spark(i,rockSurface(1,e.piece,Math.max(t,e.hit)),dt-1.6,.55,38);});
 tracers.forEach((m,i)=>{let e=tracerEvents[i],dt=t-e.start;m.visible=dt>=0&&dt<.9;if(m.visible){let p=dt/.9,c=e.a.clone().lerp(e.b,p),tail=c.clone().lerp(e.a,.025);connect(m,tail,c);}spark(70+i,rockSurface(2,e.piece,Math.max(t,e.hit)),dt-.9,.19,18);});
 missiles.forEach(({m,trail,flare},i)=>{let e=missileEvents[i],dt=t-e.start,p=dt/3.3;m.visible=p<1||t>76;trail.visible=p>.045&&p<1.45;flare.visible=p>.045&&p<1;
  if(p<0||t>76){let q=escortQuaternion(16+i%8,t);m.position.copy(missileCell(i,t));if(t>76)m.position.add(V(0,-18*(1-smooth(76,79,t)),0).applyQuaternion(q));m.quaternion.copy(q).multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI/2));}
  else if(m.visible){let q=missilePoint(i,p),next=missilePoint(i,p+.002);m.position.copy(q);m.lookAt(q.clone().sub(next.clone().sub(q)));flare.scale.setScalar(.6+smooth(.045,.16,p));}
  if(trail.visible){let points=[];for(let k=0;k<36;k++)points.push(missilePoint(i,clamp(Math.min(p,1)-k*.013,.045,1)));let curve=new T.CatmullRomCurve3(points);trail.geometry.dispose();trail.geometry=new T.TubeGeometry(curve,35,1.4,5,false);trail.material.uniforms.fade.value=smooth(.045,.07,p)*(1-smooth(1,1.45,p));}
  spark(210+i,rockSurface(3,e.piece,Math.max(t,e.hit)),dt-3.3,.9,105);
 });
 blasts.forEach(({ball,ring},i)=>{let dt=t-IMPACT[i],v=dt>0&&dt<4;ball.visible=ring.visible=v;if(!v)return;let pos=rocks[i].base;ball.position.copy(pos);ring.position.copy(pos);let f=(1-Math.exp(-dt*8))*Math.exp(-dt*2);ball.scale.setScalar(3+f*65);ball.material.opacity=f*.8;ring.scale.setScalar(20+dt*105);ring.material.opacity=Math.exp(-dt*1.5)*.7;ring.lookAt(camera.position);});
 debris.forEach(({m,dir},i)=>{let k=i%4,dt=t-IMPACT[k];m.visible=dt>0&&dt<18;if(!m.visible)return;m.position.copy(rocks[k].base).addScaledVector(dir,dt);if(t>73)m.position.z+=(t-73)*(t-73)*120;m.rotation.set(dt*(i%3+.2),dt*.4,dt*.7);});
}
let exporting=false,exportFps=60,origin=performance.now(),offset=0;
window.videoExport={runs:['tour'],async begin(runId,{fps=60}={}){if(runId!=='tour')throw new Error('Unknown run: '+runId);if(!Number.isFinite(fps)||fps<=0)throw new Error('fps must be positive');exporting=true;exportFps=fps;update(0);renderer.getContext().finish();return{frames:Math.round(DURATION*fps)};},async frame(i){if(!exporting)throw new Error('Call begin first');update(i/exportFps);renderer.getContext().finish();},end(){exporting=false;offset=lastTime;origin=performance.now();}};
window.__fleetDebug={seek:update,renderer,scenes:{space,hangar,bridge,reactor,conduit},camera,duration:DURATION,combat:{pulseEvents,tracerEvents,missileEvents,missiles,rocks,mainGuns,guardGuns,escorts,rockSurface,missileCell,chipRecords,chipBatches,fissures,beamContact,beamRockMeshes,impactFollowLights}};
function animate(now){requestAnimationFrame(animate);if(!exporting)update(offset+(now-origin)/1000);}
resize();update(0);requestAnimationFrame(animate);
})();
