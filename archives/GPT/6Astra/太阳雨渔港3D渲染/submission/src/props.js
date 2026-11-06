import {THREE,PI,V,root,M,mat,mesh,box,roundedBox,cyl,sphere,torus,group,rod,curve,line,label,disk,tire,lifeRing,crate,bucket,mug,rand,dynamics,wetConcrete,tex} from './core.js';
import {fishModel,harborCat} from './objects.js';
function bollard(x,z){const g=group(root,x,.64,z);box(.47,.07,.4,M.iron,g,0,.035,0);cyl(.13,.17,.42,M.iron,g,0,.24,0);const cap=cyl(.12,.12,.48,M.iron,g,0,.44,0);cap.rotation.z=PI/2;for(let i=0;i<3;i++)torus(.165,.028,M.rope,g,0,.16+i*.06,0).rotation.x=PI/2;return g;}
function lamp(x,z){const g=group(root,x,.62,z);cyl(.2,.28,.18,M.concrete,g,0,.09,0);cyl(.055,.095,4.0,M.iron,g,0,2,0);cyl(.4,.57,.13,M.teal,g,0,4,0);torus(.49,.025,M.iron,g,0,4.02,0).rotation.x=PI/2;cyl(.2,.26,.13,new THREE.MeshBasicMaterial({color:'#fff2bd'}),g,0,3.91,0);for(let i=0;i<3;i++){let a=i*PI*2/3;rod([0,4.25,0],[Math.cos(a)*.5,4.05,Math.sin(a)*.5],.015,M.iron,g);}cyl(.06,.06,.25,M.iron,g,0,4.17,0);return g;}
function instrument(parent,x,y,z,scale,rotation){const g=group(parent,x,y,z,rotation);g.scale.setScalar(scale);roundedBox(.5,.2,1.32,.045,M.silver,g,0,.1,0);roundedBox(.52,.035,1.34,.012,M.edge,g,0,.12,0);roundedBox(.49,.09,1.31,.035,M.silver,g,0,.2,0);for(const zz of [-.5,.5]){box(.025,.2,.12,M.iron,g,.258,.12,zz);box(.025,.2,.12,M.iron,g,-.258,.12,zz);}curve([[.26,.12,-.12],[.35,.12,-.12],[.35,.12,.12],[.26,.12,.12]],.025,M.iron,g);for(const zz of [-.63,.63])for(const xx of [-.22,.22])sphere(.045,M.dark,g,xx,.21,zz);label('SCHOOL BAND',.29,.13,g,0,.253,.1,{bg:'#9eaaa9',ink:'#e9e9d6',border:false}).rotation.x=-PI/2;return g;}
export function props(){
 for(const z of [-7,-2.7,2.4])bollard(-5.55,z);for(const x of [-2.5,4.65,8,11.35])bollard(x,5.7);
 const ropeSpecs=[{a:[-5.55,.85,2.4],b:[-3.25,.48,2.5],id:0},{a:[-5.55,.85,-2.7],b:[-3.25,.48,-3.1],id:1},{a:[4.65,.85,5.7],b:[4.5,.5,3],id:2},{a:[11.35,.85,5.7],b:[7.7,.45,-2.7],id:3}];
 for(const {a,b,id} of ropeSpecs){
  const boat=dynamics.boats.find(b=>b.id===id).g;boat.updateMatrixWorld();
  const attachment=id===2?V(-.62,.52,-1.8):boat.worldToLocal(V(...b));
  rod([attachment.x-.10,attachment.y,attachment.z],[attachment.x+.10,attachment.y,attachment.z],.023,M.silver,boat);
  for(const s of [-1,1])rod([attachment.x+s*.06,attachment.y-.07,attachment.z],[attachment.x+s*.06,attachment.y+.02,attachment.z],.018,M.silver,boat);
  const mid=a.map((v,i)=>(v+b[i])/2);mid[1]-=.26;const material=M.rope.clone();material.transparent=true;
  const m=curve([a,mid,b],.023,material);dynamics.ropes.push({m,id,a,attachment,boat});
 }
 curve([[-5.53,.84,2.4],[-5.35,.5,2.7],[-4.9,.05,2.65],[-4.85,-.5,2.62]],.026,mat('#886e50'));
 const poles=[[-4.9,8.6],[-6.0,-2.4],[-6.0,-7.4],[11.25,7.0]];poles.forEach(p=>lamp(...p));
 curve([[-4.9,4.86,8.6],[-5.3,4.35,3],[-6,4.87,-2.4],[-6,4.5,-4.8],[-6,4.87,-7.4]],.012,M.iron);
 curve([[-4.9,4.86,8.6],[3,4.1,8],[11.25,4.86,7]],.012,M.iron);
 for(const p of [[-6.15,3.6],[-7.1,4.5],[-10,5.9],[-6.4,-3]]){for(let i=0;i<3;i++)crate(root,p[0],.62+i*.37,p[1],i===1?M.blue:M.white);}
 for(let i=0;i<3;i++)crate(root,-8.6+i*.8,.62,4.9,i===2?M.blue:M.white);
 // Some silver catch remains in the top fish tray.
 for(let i=0;i<5;i++){const {g}=fishModel(root);g.position.set(-8.8+i*.11,.925,4.9);g.scale.setScalar(.55);g.rotation.set(0,(i%2)*PI,PI/2);}
 // Rusted capstan and hand-operated davit.
 const crane=group(root,-5.9,.64,-8.15);box(.6,.13,.65,M.edge,crane,0,.065,0);cyl(.13,.18,1.2,M.rust,crane,0,.66,0);rod([0,1.22,0],[1.5,2.5,0],.08,M.iron,crane);rod([0,.9,0],[1.4,2.4,0],.028,M.rust,crane);curve([[0,1.05,.04],[.1,2.25,.04],[1.5,2.5,.04],[1.5,1.25,.04]],.018,M.rope,crane);const hook=torus(.1,.025,M.iron,crane,1.5,1.18,.04);cyl(.2,.2,.37,M.rust,crane,.22,.7,.15).rotation.x=PI/2;rod([.22,.7,.37],[.44,.7,.37],.03,M.iron,crane);rod([.44,.7,.37],[.44,.9,.37],.025,M.wood,crane);
 // Drying net is real mesh with a hanging, scalloped lower edge.
 const net=group(root,-9.5,.66,7.0,-.17);for(const x of [-1.1,1.1])rod([x,0,0],[x,2.15,0],.035,M.rust,net);rod([-1.1,2.15,0],[1.1,2.15,0],.03,M.iron,net);
 const cloth=group(net,0,2.05,0);for(let i=0;i<19;i++){const x=-1.05+i*.117;const pts=[];for(let j=0;j<16;j++)pts.push([x+Math.sin(j*.3)*.015,-j*.10,Math.sin(i*.23)*.14+Math.sin(j*.17)*.08]);line(pts,'#567b74',cloth,.65);}for(let j=0;j<16;j++){const pts=[];for(let i=0;i<19;i++)pts.push([-1.05+i*.117,-j*.1+Math.sin(i*.18)*.08,Math.sin(i*.23)*.14+Math.sin(j*.17)*.08]);line(pts,'#567b74',cloth,.65);}cloth.children.forEach(m=>m.userData.base=m.geometry.attributes.position.array.slice());dynamics.nets.push(cloth);
 for(let i=0;i<12;i++)sphere(.075,i%3?M.ivory:M.orange,net,-1.05+i*.19,2.02,0);
 curve([[-1.05,2.02,0],[-.4,1.95,.1],[.4,1.99,.1],[1.05,2.02,0]],.015,M.rope,net);
 const scoop=group(root,-6.2,.65,3.25);scoop.rotation.z=.18;rod([0,0,0],[0,1.7,0],.022,M.wood,scoop);torus(.27,.018,M.silver,scoop,0,1.9,0);for(let i=-3;i<=3;i++){line([[-.2,1.9+i*.05,0],[.2,1.9+i*.05,0]],'#738e87',scoop,.5);line([[i*.05,1.7,0],[i*.05,2.1,0]],'#738e87',scoop,.5);}bucket(root,-6,.63,3.9);bucket(root,-7.6,.63,-3.3,.23);
 // A sun-faded vending machine and its worn little rain hood.
 const vending=group(root,-7.4,.64,5.85,.05);box(.95,1.8,.65,M.white,vending,0,.9,0);box(.76,1.23,.045,M.teal,vending,-.03,1.08,.35);box(.67,.9,.02,new THREE.MeshBasicMaterial({color:'#beddd3'}),vending,-.06,1.17,.38);
 for(let row=0;row<3;row++)for(let col=0;col<4;col++){const x=-.29+col*.16,y=.91+row*.27;cyl(.045,.045,.15,[M.orange,M.white,M.blue,M.yellow][(row+col)%4],vending,x,y,.42);box(.07,.028,.02,M.ivory,vending,x,y-.12,.43,false);}
 label('つめたい',.7,.18,vending,0,1.68,.39,{bg:'#78b5ad',ink:'#f4f0d8',border:false});box(.42,.13,.04,M.dark,vending,-.05,.32,.37);box(.09,.25,.03,M.silver,vending,.38,.88,.37);sphere(.025,M.red,vending,.38,.94,.4);box(1.18,.09,.91,M.rust,vending,0,1.98,.08).rotation.x=.09;
 // Port notice board, lettering exists only on in-world objects.
 const sign=group(root,4.7,.64,9.2,-.1);for(const x of [-1.04,1.04])box(.09,1.75,.09,M.wood,sign,x,.87,0);box(2.45,.95,.08,M.wood,sign,0,1.45,0);label('白 雨 港\n足もとにご注意 · 注意落水',2.3,.82,sign,0,1.45,.052,{bg:'#dce1cc',ink:'#56807d'});
 // Instruments and the translucent umbrella left by the steps.
 instrument(root,-.95,.66,6.28,1,.17);instrument(root,-1.75,.66,6.35,.85,.17);
 const umbrella=group(root,2.65,.72,5.9);umbrella.rotation.set(.22,0,-.72);rod([0,0,0],[0,1.18,0],.014,M.silver,umbrella);curve([[0,.02,0],[0,-.13,0],[.12,-.18,0],[.17,-.05,0]],.022,M.dark,umbrella);
 const ug=new THREE.SphereGeometry(.88,32,10,0,PI*2,0,PI*.40);const um=mesh(ug,new THREE.MeshPhysicalMaterial({color:'#e1f4e8',transparent:true,opacity:.23,roughness:.08,side:THREE.DoubleSide,depthWrite:false}),umbrella,[0,.65,0]);um.scale.y=.6;
 for(let i=0;i<8;i++){const a=i*PI/4,pts=[];for(let j=0;j<=8;j++){const t=j/8*PI*.4;pts.push([Math.sin(t)*.88*Math.cos(a),.65+Math.cos(t)*.528,Math.sin(t)*.88*Math.sin(a)]);}curve(pts,.009,M.silver,umbrella);sphere(.025,M.ivory,umbrella,pts[8][0],pts[8][1],pts[8][2]);}
 for(let i=0;i<26;i++){const a=rand(0,6.28),t=rand(.1,1.2);const drop=sphere(.012,new THREE.MeshBasicMaterial({color:'#fff1ba'}),umbrella,Math.sin(t)*.885*Math.cos(a),.65+Math.cos(t)*.532,Math.sin(t)*.885*Math.sin(a));}
 // Inverted wooden dinghy has transverse ribs and stands above the hiding cat.
 const skiff=group(root,9.5,.807,8.7);skiff.rotation.x=-Math.atan(1/7);const stations=[[-1.9,.02,.24],[-1.45,.4,.53],[-.7,.7,.67],[.2,.78,.67],[.95,.73,.55],[1.6,.6,.42]];const vv=[],ii=[];
 for(const [z,w,h] of stations)for(let j=0;j<9;j++){const a=-PI/2+j*PI/8;vv.push(Math.sin(a)*w,Math.cos(a)*h,z);}
 for(let i=0;i<5;i++)for(let j=0;j<8;j++){let a=i*9+j;ii.push(a,a+1,a+9,a+1,a+10,a+9);}const hullGeo=new THREE.BufferGeometry();hullGeo.setAttribute('position',new THREE.Float32BufferAttribute(vv,3));hullGeo.setIndex(ii);hullGeo.computeVertexNormals();mesh(hullGeo,mat('#bba37a',{side:THREE.DoubleSide}),skiff);
 for(let j=0;j<9;j++){const a=-PI/2+j*PI/8;curve(stations.map(([z,w,h])=>[Math.sin(a)*w,Math.cos(a)*h+.006,z]),j===0||j===8?.034:.012,j===4?M.wood:M.edge,skiff,24);}
 for(const z of [-1,.9])box(1.38,z<0?.28:.37,.15,M.wood,skiff,0,-.15,z);for(const [z,w,h] of [stations[1],stations[4]]){const pp=[];for(let j=0;j<9;j++){const a=-PI/2+j*PI/8;pp.push([Math.sin(a)*w*.99,Math.cos(a)*h-.035,z]);}curve(pp,.04,M.wood,skiff);}

 dynamics.cat=harborCat(root);
 // Windsock and small flags.
 const wp=group(root,-5.6,.64,-10.8);rod([0,0,0],[0,4.2,0],.035,M.iron,wp);rod([0,4.2,0],[.5,4.2,0],.018,M.iron,wp);
 const sock=group(wp,.55,4.2,0),sockGeo=new THREE.CylinderGeometry(.07,.20,1.15,12,24,true);sockGeo.rotateZ(-PI/2);sockGeo.translate(.575,0,0);
 const colors=[],sockPos=sockGeo.attributes.position;for(let i=0;i<sockPos.count;i++){const c=new THREE.Color(Math.floor(sockPos.getX(i)/.192)%2?'#f8f4e4':'#e6a16c');colors.push(c.r,c.g,c.b);}sockGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const fabric=mesh(sockGeo,mat('#ffffff',{vertexColors:true,side:THREE.DoubleSide}),sock);fabric.userData.base=sockPos.array.slice();sock.userData={fabric,sock:true};torus(.2,.013,M.silver,sock).rotation.y=PI/2;dynamics.flags.push(sock);
 for(const [x,z] of [[-5.6,-4],[3.1,-9.6]]){const g=group(root,x,.68,z);rod([0,0,0],[0,2.1,0],.022,M.iron,g);const flag=group(g,0,2,0);const geo=new THREE.PlaneGeometry(.7,.36,16,5);const m=mesh(geo,mat('#ed9760',{side:THREE.DoubleSide}),flag,[.35,-.18,0]);m.userData.base=geo.attributes.position.array.slice();flag.userData.fabric=m;dynamics.flags.push(flag);}
 for(let i=0;i<4;i++){const b=group(root,3.7+i*1.75,0,-6.3+i*.4);sphere(.19,i%2?M.orange:M.ivory,b,0,.08,0);cyl(.05,.06,.31,M.rust,b,0,.18,0);torus(.06,.012,M.dark,b,0,.38,0);label(String(12+i),.18,.14,b,0,.09,.187,{bg:i%2?'#d68e55':'#e1debc',ink:'#647b73',border:false});dynamics.buoys.push(b);}
 // Broad, irregular pools catch lamps, boats and passing gulls in a shared
 // planar reflection. The thin pale rim follows the wet concrete edge.
 for(const [x,z,sx,sz] of [[-3.5,7.15,1.35,.68],[.2,8.7,1.2,.46],[6.6,6.7,1.4,.47],[-6.25,1.1,.52,1.15],[-10,3.8,.65,.48],[11.35,9.7,.43,.38]]){
  dynamics.puddles.push({x,z,sx,sz});
  const rim=[];for(let i=0;i<22;i++){const a=i/35*PI*2,k=1+Math.sin(a*5+z)*.075+Math.cos(a*9+x)*.035;rim.push([x+Math.cos(a)*sx*k,.634,z+Math.sin(a)*sz*k]);}line(rim,'#d4e3c9',root,.38);
 }
}
