import {THREE,PI,V,root,M,mat,mesh,box,cyl,sphere,torus,group,rod,curve,line,label,disk,crate,bucket,rand,dynamics,tex,wetConcrete} from './core.js';
import {encrustedSeawall} from './craftsmanship.js';
import {cloudGLSL} from './weather.js';
export function details(){
 encrustedSeawall();
 // Low floating boarding walks bring the hanging fenders alongside the berth.
 for(const [x,z,w,d] of [[-4.325,.95,1.35,4.4],[-4.55,-4.5,.9,3.7],[6.15,4.15,4.25,1.3]]){
  const dock=group(root,x,.22,z);box(w,.19,d,M.dark,dock,0,-.1,0);const count=Math.round(d/.19);for(let i=0;i<count;i++)box(w,.065,d/count-.018,mat(i%3?'#a8b3a0':'#b7bdab'),dock,0,.03,-d/2+(i+.5)*d/count);
  for(const sign of [-1,1]){box(.065,.1,d,M.edge,dock,sign*(w/2-.02),.07,0);for(const zz of [-d/2+.2,d/2-.2]){cyl(.047,.055,.64,M.iron,dock,sign*(w/2-.1),.2,zz);cyl(.08,.08,.055,M.ivory,dock,sign*(w/2-.1),.53,zz);}}
 }
 // Different courses and narrow vertical tide streaks on the exposed solid cut.
 const wallMap=tex((c,w,h)=>{c.fillStyle='#b9c7ba';c.fillRect(0,0,w,h);for(let row=0;row<5;row++){for(let col=0;col<9;col++){const x=col*64-(row%2)*32,y=row*100;c.fillStyle=`rgba(72,107,101,${rand(.015,.055)})`;c.fillRect(x+2,y+2,60,95);c.strokeStyle='rgba(69,100,96,.23)';c.lineWidth=1.2;c.strokeRect(x,y,64,100);}}for(let i=0;i<1500;i++){c.fillStyle='rgba(73,109,101,.06)';c.fillRect(rand(0,w),rand(0,h),rand(1,5),rand(1,6));}for(let i=0;i<32;i++){const x=rand(0,w);c.fillStyle='rgba(83,111,97,.035)';c.fillRect(x,0,rand(2,9),rand(60,h));}},512,512);
 const wallMat=new THREE.MeshToonMaterial({map:wallMap,color:'#e1e5d5'});const front=mesh(new THREE.PlaneGeometry(24,3.25),wallMat,root,[0,-1.05,12.006]);const left=mesh(new THREE.PlaneGeometry(24,3.25),wallMat,root,[-12.006,-1.05,0]);left.rotation.y=-PI/2;const right=mesh(new THREE.PlaneGeometry(7,3.25),wallMat,root,[12.006,-1.05,8.5]);right.rotation.y=PI/2;
 // Cracks have a few branching strokes; worn paint is a canvas stencil.
 for(const [x,z] of [[-10,10],[-3,9.3],[6.5,11],[10.8,6.2],[-7.8,4.8]]){line([[x,.62,z],[x+.16,.621,z+.23],[x+.08,.622,z+.4],[x+.32,.622,z+.58],[x+.4,.622,z+.9]],'#78908b',root,.27);line([[x+.08,.622,z+.4],[x-.22,.622,z+.47],[x-.32,.622,z+.63]],'#78908b',root,.2);}
 const stencil=tex((c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='rgba(242,238,201,.52)';c.font='bold 120px "Yu Gothic","Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('白 雨 港',w/2,h/2);c.globalCompositeOperation='destination-out';for(let i=0;i<1400;i++)c.fillRect(rand(0,w),rand(0,h),rand(1,7),rand(1,5));},1024,256);
 const st=mesh(new THREE.PlaneGeometry(4.8,1.2),new THREE.MeshBasicMaterial({map:stencil,transparent:true,depthWrite:false,opacity:.75}),root,[-6.4,.627,9.3]);st.rotation.x=-PI/2;
 for(let i=0;i<8;i++)box(.55,.004,.055,mat('#d4cfab'),root,-10.8+i*.7,.628,10.7,false);
 for(let i=0;i<3;i++)box(.055,.004,.45,mat('#d4cfab'),root,-10.8,.628,8.5+i*.7,false);
 // Rough wooden pallets, a hand truck and the work that paused when rain began.
 const pallet=group(root,-9.9,.65,7.8,.13);for(const x of [-.55,0,.55])box(.12,.18,1.25,M.wood,pallet,x,.09,0);for(let i=0;i<7;i++)box(1.4,.06,.14,M.wood,pallet,0,.22,-.54+i*.18);crate(pallet,-.33,.26,-.2,M.blue,.6,.4,.55);crate(pallet,.36,.26,.1,M.white,.55,.35,.5);
 const tarp=mesh(new THREE.SphereGeometry(.65,12,6,0,PI*2,0,PI/2),mat('#6c9d94'),pallet,[0,.26,-.1]);tarp.scale.set(1,.37,.7);tarp.rotation.z=-.12;for(let i=0;i<5;i++)curve([[-.55+i*.24,.28,.4],[-.55+i*.24,.5,0],[-.55+i*.24,.31,-.5]],.008,M.leafDark,pallet);
 const cart=group(root,-8,.64,7.15,.3);for(const x of [-.28,.28]){rod([x,.16,.2],[x,1.3,-.23],.024,M.teal,cart);const wheel=torus(.15,.045,M.iron,cart,x,.17,.18);wheel.rotation.y=PI/2;}rod([-.28,1.3,-.23],[.28,1.3,-.23],.035,M.dark,cart);box(.65,.055,.4,M.silver,cart,0,.16,.25);crate(cart,0,.22,.14,M.white,.6,.4,.4);
 const hose=group(root,-10.75,.65,5.65);for(let i=0;i<7;i++)torus(.35+i*.017,.024,mat('#628f87'),hose,0,.025+i*.03,0).rotation.x=PI/2;curve([[.43,.1,0],[.7,.03,.2],[1,.03,.5],[.9,.03,.85]],.023,mat('#628f87'),hose);rod([-.45,0,0],[-.45,.6,0],.04,M.silver,hose);rod([-.45,.55,0],[-.21,.55,0],.03,M.silver,hose);box(.18,.025,.04,M.red,hose,-.45,.64,0);
 // A low bench on the open apron keeps the foreground lived-in and quiet.
 const bench=group(root,.2,.64,10.6);for(const x of [-1,1])for(const z of [-.22,.22])rod([x,0,z],[x,.5,z],.04,M.iron,bench);for(let i=0;i<4;i++)box(2.6,.075,.12,M.wood,bench,0,.52,-.21+i*.14);for(const x of [-1,1])rod([x,.5,.29],[x,1.06,.29],.035,M.iron,bench);for(let i=0;i<3;i++)box(2.6,.12,.055,M.wood,bench,0,.75+i*.16,.28);
 const tin=bucket(bench,.72,.56,-.05,.08);const notebook=box(.22,.025,.3,mat('#719c99'),bench,-.4,.58,0);notebook.rotation.y=.2;
 for(const [x,z] of [[-4.3,6.1],[11.35,8.6]]){for(let j=0;j<6;j++)torus(.25+j*.025,.019,M.rope,root,x,.66+j*.014,z).rotation.x=PI/2;curve([[x+.38,.65,z],[x+.6,.64,z+.2],[x+.45,.64,z+.6]],.019,M.rope);}
 // Anchors and a small line basket.
 const anchor=group(root,6.9,.67,8.1,.5);rod([0,0,0],[0,.03,1],.04,M.iron,anchor);torus(.1,.025,M.iron,anchor,0,.03,1.08).rotation.x=PI/2;rod([-.3,0,.8],[.3,0,.8],.035,M.iron,anchor);curve([[-.38,.03,.35],[-.28,.03,.05],[0,.03,0],[.28,.03,.05],[.38,.03,.35]],.045,M.iron,anchor);
 const tub=group(root,7.4,.65,7);cyl(.35,.27,.35,M.blue,tub,0,.18,0);disk(.32,M.dark,tub,0,.36,0);for(let i=0;i<4;i++)torus(.19+i*.02,.025,M.rope,tub,0,.35+i*.025,0).rotation.x=PI/2;torus(.35,.025,M.ivory,tub,0,.36,0).rotation.x=PI/2;
 // Wet sheen and irregular edge chips near bollards.
 for(let i=0;i<64;i++){const x=rand(-4.7,11.7),z=rand(5.01,5.28);const m=box(rand(.02,.1),.006,rand(.015,.05),M.concrete,root,x,.832,z,false);m.rotation.y=rand(0,3);}
 // Additional ledges and algae along the active water line.
 for(let i=0;i<45;i++){const x=rand(-4.8,11.6);const m=box(rand(.07,.3),rand(.08,.29),.014,mat(i%2?'#6e9d85':'#8aaf91'),root,x,-.14,4.94,false);}
 for(let i=0;i<36;i++){const z=rand(-11.4,4.7);box(.014,rand(.08,.25),rand(.08,.3),mat(i%2?'#6e9d85':'#8aaf91'),root,-4.94,-.16,z,false);}
 // Light is locally interrupted by a cloud moving across the apron.
 const cloudMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0}},vertexShader:'varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float time;varying vec3 p;${cloudGLSL}void main(){gl_FragColor=vec4(.22,.39,.39,.095*cloudCover(p.xz,time));}`});
 for(const [w,d,x,z] of [[7,24,-8.5,0],[17,7,3.5,8.5]]){const m=mesh(new THREE.PlaneGeometry(w,d),cloudMat,root,[x,.637,z]);m.rotation.x=-PI/2;m.renderOrder=9;}dynamics.cloudMat=cloudMat;
}
