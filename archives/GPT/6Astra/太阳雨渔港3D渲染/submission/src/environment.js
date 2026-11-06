import {Reflector} from 'three/addons/objects/Reflector.js';
import {wetSurfaces} from './wet-surfaces.js';
import {cloudGLSL} from './weather.js';
import {THREE,PI,V,root,scene,M,mat,mesh,box,cyl,sphere,torus,group,rod,curve,line,label,disk,rand,dynamics} from './core.js';
export function environment(){
 // A restrained sky is visible when the camera comes down to the water line.
 // Clouds belong to the distant sky dome and never follow the mouse cursor.
 const sky=mesh(new THREE.SphereGeometry(110,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
  vertexShader:'varying vec3 dir;void main(){dir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec3 dir;void main(){float h=smoothstep(-.05,.7,dir.y);vec3 col=mix(vec3(.9098,.9451,.9294),vec3(.825,.912,.917),h);float a=atan(dir.z,dir.x);float ribbons=exp(-pow((dir.y-.12-sin(a*3.)*.012)/.009,2.))+exp(-pow((dir.y-.23-sin(a*2.+1.)*.018)/.014,2.))*.6;float broken=.3+.7*pow(.5+.5*sin(a*7.+dir.y*9.),2.);col=mix(col,vec3(.968,.977,.955),clamp(ribbons*broken*.33,0.,.4));gl_FragColor=vec4(col,1.);}`}),scene);
 sky.castShadow=false;sky.receiveShadow=false;sky.frustumCulled=false;sky.renderOrder=-20;
 const waterShader={uniforms:{color:{value:new THREE.Color('#7dbcb1')},tDiffuse:{value:null},textureMatrix:{value:null},time:{value:0},sun:{value:1}},vertexShader:`uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vWorld;void main(){vUv=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D tDiffuse;uniform vec3 color;uniform float time;uniform float sun;varying vec4 vUv;varying vec3 vWorld;
 ${cloudGLSL}
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
 void main(){vec2 p=vWorld.xz;float c=mod(time,96.);float front=12.-(c-1.5)*3.5;float gw=exp(-pow((p.x-front)/1.3,2.))*smoothstep(1.,1.8,c)*(1.-smoothstep(7.5,9.,c));float n=noise(p*vec2(2.1,4.1)+vec2(time*.08,time*.025));float n2=noise(p*.58+time*.025);vec4 uv=vUv;uv.x+=(n-.5)*.016*vUv.w;uv.y+=sin(p.y*9.+p.x*2.+time*1.3)*.0025*vUv.w+sin(p.x*17.-time*10.)*.003*gw*vUv.w;vec3 ref=texture2DProj(tDiffuse,uv).rgb;ref=floor(ref*7.+.5)/7.;float shade=floor(n2*4.)/4.;vec3 sea=mix(vec3(.035,.31,.28),vec3(.17,.56,.45),shade);float brightness=dot(ref,vec3(.333));float objectMask=(1.-smoothstep(.26,.48,brightness));float whiteMask=smoothstep(.78,.95,brightness)*step(.53,n);vec3 col=mix(sea,ref,objectMask*.62+whiteMask*.24);float shimmer=step(.78,n)*step(.57,noise(p*vec2(.8,17.)+vec2(time*.05,0.)));shimmer=max(shimmer,step(.75,sin(p.x*24.+p.y*7.-time*8.))*gw*.7);float sunlight=1.-cloudCover(p,time)*.8;col+=vec3(.15,.18,.12)*shimmer*sunlight;col*=.96+.04*sunlight;gl_FragColor=vec4(col,.74);#include <tonemapping_fragment>
 #include <colorspace_fragment>}`.replace(';#include',';\n#include')};
 const water=new Reflector(new THREE.PlaneGeometry(17,17),{clipBias:.006,textureWidth:1536,textureHeight:1536,color:'#83bdb0',shader:waterShader});water.rotation.x=-PI/2;water.position.set(3.5,.005,-3.5);water.material.transparent=true;water.material.depthWrite=false;water.renderOrder=4;root.add(water);dynamics.water=water;
 wetSurfaces(water);
 const under=mesh(new THREE.PlaneGeometry(17,17),new THREE.MeshBasicMaterial({color:'#86c8b9',transparent:true,opacity:.25,side:THREE.BackSide,depthWrite:false}),root,[3.5,-.01,-3.5]);under.rotation.x=-PI/2;under.renderOrder=4;
 // The cut edge is a lightly tinted sheet, with subtle horizontal depth bands.
 const sideMat=new THREE.MeshBasicMaterial({color:'#54ab9c',transparent:true,opacity:.24,side:THREE.DoubleSide,depthWrite:false});
 const side=mesh(new THREE.PlaneGeometry(17,2.5),sideMat,root,[12.006,-1.25,-3.5]);side.rotation.y=PI/2;side.renderOrder=5;
 const back=mesh(new THREE.PlaneGeometry(17,2.5),sideMat,root,[3.5,-1.25,-12.006]);back.renderOrder=5;
 line([[12.015,0,5],[12.015,0,-12],[-5,0,-12]],'#b7e6d2',root,.85);
 for(let i=0;i<5;i++){line([[12.015,-.5*i,4.98],[12.015,-.5*i,-11.98]],'#7dc7b7',root,.15);}
 // Short flat brush strokes, with crisp edges rather than a noisy realistic ocean.
 for(let i=0;i<190;i++){const x=rand(-4.8,11.8),z=rand(-11.8,4.7);const m=mesh(new THREE.PlaneGeometry(rand(.08,.48),rand(.012,.04)),new THREE.MeshBasicMaterial({color:i%4?'#c9e8cf':'#f9f1c9',transparent:true,opacity:rand(.1,.4),depthWrite:false}),root,[x,.027,z]);m.rotation.x=-PI/2;m.rotation.z=rand(-.18,.18);m.renderOrder=6;dynamics.foam.push({m,x,z,phase:rand(0,6.28),kind:'glint'});}
 // Ripples: independent phases, including the puddles on concrete.
 for(let i=0;i<50;i++){const pond=i>=38;const exposed=dynamics.puddles.filter(p=>!p.inside);const p=pond?exposed[(i-38)%exposed.length]:null;const x=p?p.x+rand(-p.sx*.4,p.sx*.4):rand(-4.6,11.6),z=p?p.z+rand(-p.sz*.4,p.sz*.4):rand(-11.6,4.6);const g=group(root,x,pond?.635:.04,z);for(let j=0;j<2;j++){const m=mesh(new THREE.RingGeometry(.94,1,40),new THREE.MeshBasicMaterial({color:'#ecedcc',transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}),g,[0,j*.001,0]);m.rotation.x=-PI/2;m.renderOrder=7;g.children[j].scale.setScalar(1-j*.3);}dynamics.ripples.push({g,phase:rand(0,1),speed:rand(.23,.49),size:pond?.18:.34});}
 for(let i=0;i<30;i++){const x=rand(4.3,6.5),z=rand(-10.6,-8.5);const m=disk(rand(.04,.13),new THREE.MeshBasicMaterial({color:'#e9f0dc',transparent:true,opacity:.5,depthWrite:false}),root,x,.04,z);m.renderOrder=7;dynamics.foam.push({m,x,z,phase:rand(0,6.28),kind:'foam'});}
 // Narrow scalloped wash marks meet the wall at the actual water level. The
 // same propagating boat wave raises them and briefly spreads the foam.
 for(let side=0;side<2;side++)for(let i=0;i<22;i++){
  const along=(side?-11.6:-4.6)+i*.75,x=side?-4.90:along,z=side?along:4.90;
  if(!side&&x>8.3&&x<10.7)continue;
  const g=group(root,x,.025,z,side?-PI/2:0),phase=i*.73+side*2;
  const shape=new THREE.Shape();shape.moveTo(-.26,0);shape.lineTo(.26,0);
  shape.quadraticCurveTo(.28,.07,.18,.055);shape.quadraticCurveTo(.02,.13,-.08,.065);shape.quadraticCurveTo(-.25,.09,-.26,0);
  const foam=mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:'#d9ebcf',transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}),g);
  foam.rotation.x=-PI/2;foam.renderOrder=7;foam.castShadow=false;foam.receiveShadow=false;
  const sheen=mesh(new THREE.PlaneGeometry(.5,.11),new THREE.MeshBasicMaterial({color:'#b8dac7',transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide}),g,[0,-.035,.012]);
  sheen.renderOrder=7;sheen.castShadow=false;sheen.receiveShadow=false;
  dynamics.shoreWash.push({g,x,z,phase});
 }
 // Rain is anchored to the diorama, never to a screen overlay.
 const count=1050, rainGeo=new THREE.BufferGeometry(),arr=new Float32Array(count*6);rainGeo.setAttribute('position',new THREE.BufferAttribute(arr,3));const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#ffedbd',transparent:true,opacity:.36,depthWrite:false}));root.add(rain);rain.frustumCulled=false;rain.renderOrder=8;dynamics.rain={m:rain,seeds:Array.from({length:count},()=>[rand(-11.8,11.8),rand(0,10),rand(-11.8,11.8),rand(.13,.31),rand(.7,1.2)])};
 // Occasional glistening drops below umbrellas, lamps and cabin eaves.
 for(const [x,y,z] of [[2.95,1.3,5.8],[-4.5,4.5,8.6],[-5.6,4.5,-2.4],[-2,1.9,2.1],[6.7,1.8,2.9]]){const d=sphere(.018,new THREE.MeshBasicMaterial({color:'#fff4cd'}),root,x,y,z);d.scale.y=1.7;dynamics.drips.push({m:d,x,y,z,phase:rand(0,1)});}
 // Hand-drawn-looking thin mist ribbons behind the lighthouse.
 const mist=group(root);for(let i=0;i<6;i++){const m=mesh(new THREE.PlaneGeometry(6+i*.5,.25),new THREE.MeshBasicMaterial({color:'#dbeee3',transparent:true,opacity:.06,depthWrite:false,side:THREE.DoubleSide}),mist,[6,.35+i*.11,-10.5-i*.14]);m.rotation.x=-PI/2;}dynamics.mist=mist;
 // Seven barely visible, flat rainbow ribbons. They appear only during a lull.
 const rainbow=group(root,5,1.4,-9.6);for(let i=0;i<7;i++){const m=mesh(new THREE.RingGeometry(4.15-i*.055,4.2-i*.055,64,1,0,PI),new THREE.MeshBasicMaterial({color:['#dfaaa0','#e1bd99','#dfd5a8','#b7d6b2','#a4cdca','#abbdd4','#c9b9cf'][i],transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}),rainbow);m.renderOrder=8;}dynamics.rainbow=rainbow;
 // One flock, some in the air and some pausing on harbour furniture.
 for(let i=0;i<9;i++){const g=group(root);const body=sphere(.11,M.white,g);body.scale.set(.72,.8,1.65);sphere(.075,M.white,g,0,.055,.14);const beak=mesh(new THREE.ConeGeometry(.025,.1,4),M.yellow,g,[0,.03,.23]);beak.rotation.x=PI/2;
 for(const s of [-1,1])sphere(.012,M.dark,g,s*.056,.075,.174);
 const tail=mesh(new THREE.ConeGeometry(.074,.16,3),M.white,g,[0,0,-.20]);tail.rotation.x=-PI/2;tail.scale.y=.7;
 const feet=group(g,0,-.09,.035);for(const s of [-1,1]){rod([s*.035,0,0],[s*.035,-.035,.014],.007,M.orange,feet);const foot=mesh(new THREE.CircleGeometry(.031,3),M.orange,feet,[s*.035,-.035,.026]);foot.rotation.x=-PI/2;}feet.visible=false;
 const wings=[];for(const sign of [-1,1]){const wg=group(g,sign*.04,.035,0);const shape=new THREE.Shape();shape.moveTo(0,.1);shape.quadraticCurveTo(sign*.23,.04,sign*.45,-.1);shape.lineTo(sign*.65,-.2);shape.lineTo(sign*.32,-.25);shape.lineTo(0,-.1);const geo=new THREE.ShapeGeometry(shape);geo.rotateX(-PI/2);mesh(geo,mat('#f2f3e6',{side:THREE.DoubleSide}),wg);const tip=box(.12,.012,.09,M.navy,wg,sign*.51,0,.16,false);tip.rotation.y=sign*.4;wings.push(wg);}dynamics.gulls.push({g,wings,feet,id:i});}
 // Boat wake, kept hidden while tied up. Twin tapering white ribbons.
 const wake=group(root);for(let i=0;i<24;i++){const m=mesh(new THREE.PlaneGeometry(.05+i*.012,.4),new THREE.MeshBasicMaterial({color:'#eff3db',transparent:true,opacity:.4*(1-i/27),depthWrite:false}),wake,[0,.045,0]);m.rotation.x=-PI/2;m.renderOrder=7;}dynamics.wake=wake;
}
