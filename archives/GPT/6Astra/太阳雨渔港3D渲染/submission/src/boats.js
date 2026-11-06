import {THREE,PI,V,root,M,mat,mesh,box,cyl,sphere,torus,group,rod,curve,line,label,disk,tire,lifeRing,crate,bucket,mug,rand,dynamics,tex} from './core.js';
import {navigationInstruments,reflectedCaustics} from './instruments.js';
import {thermos} from './objects.js';
function hullGeometry(){
 const zs=[-2.48,-2.12,-1.45,0,1.5,1.95],widths=[.02,.47,.82,.96,.87,.72];const verts=[],inds=[];
 const rings=[[-.46,.45],[-.22,.8],[.31,1],[.47,1.02]];
 for(const [y,s] of rings)for(let i=0;i<zs.length;i++){verts.push(-widths[i]*s,y+(i===0?.22:0),zs[i],widths[i]*s,y+(i===0?.22:0),zs[i]);}
 for(let r=0;r<3;r++)for(let j=0;j<5;j++)for(let s=0;s<2;s++){const a=r*12+j*2+s,b=a+2,c=a+12,d=c+2;if(s===0)inds.push(a,c,b,b,c,d);else inds.push(a,b,c,b,d,c);}
 for(let r=0;r<3;r++){const a=r*12+10;inds.push(a,a+1,a+12,a+1,a+13,a+12);}inds.push(0,10,1,1,10,11);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(inds);geo.computeVertexNormals();return geo;
}
function deckGeo(){const s=new THREE.Shape();s.moveTo(0,-2.45);s.lineTo(.47,-2.12);s.lineTo(.82,-1.45);s.lineTo(.96,0);s.lineTo(.87,1.5);s.lineTo(.72,1.95);s.lineTo(-.72,1.95);s.lineTo(-.87,1.5);s.lineTo(-.96,0);s.lineTo(-.82,-1.45);s.lineTo(-.47,-2.12);s.closePath();const geo=new THREE.ShapeGeometry(s);geo.rotateX(PI/2);return geo;}
function chartTexture(){return tex((c,w,h)=>{c.fillStyle='#eee7c8';c.fillRect(0,0,w,h);c.strokeStyle='#74aaa3';c.lineWidth=2;for(let i=0;i<14;i++){c.beginPath();for(let x=0;x<w;x+=8){let y=70+i*25+Math.sin(x*.018+i)*26;c.lineTo(x,y);}c.stroke();}c.strokeStyle='#b7926f';c.beginPath();c.moveTo(70,0);c.bezierCurveTo(30,190,250,110,210,360);c.lineTo(0,420);c.stroke();c.fillStyle='#637c73';c.font='25px serif';c.fillText('白雨港 / 1:25000',200,50);for(let i=0;i<5;i++){c.beginPath();c.arc(320,280,20+i*30,0,6.28);c.stroke();}},512,512);}
export function makeBoat(parent,x,z,scale=1,ry=0,cabin=true,accent=M.teal,name='しらさめ',id=0){
 const g=group(parent,x,0,z,ry);g.scale.setScalar(scale);const hull=mesh(hullGeometry(),new THREE.MeshToonMaterial({color:'#f2f1e4',side:THREE.DoubleSide}),g,[0,0,0],true);
 const deck=mesh(deckGeo(),M.ivory,g,[0,.43,0]);deck.material.side=THREE.DoubleSide;
 const sides=[[-.01,.58,-2.46],[-.48,.47,-2.12],[-.84,.47,-1.45],[-.98,.47,0],[-.88,.47,1.5],[-.73,.47,1.97]];
 for(const sign of [-1,1]){curve(sides.map(p=>[Math.abs(p[0])*sign,p[1],p[2]]),.045,M.white,g);curve(sides.map(p=>[Math.abs(p[0])*.92*sign,p[1]-.32,p[2]]),.065,accent,g);
  for(const zz of [-1.4,.7,1.5]){const tx=(zz<-1?.9:1.03)*sign;const t=tire(g,tx,.27,zz,.21);t.rotation.y=PI/2;dynamics.fenders.push({m:t,phase:id+zz+sign});curve([[tx,.55,zz],[tx+sign*.04,.46,zz],[tx+sign*.05,.32,zz]],.018,M.rope,g);}
  const ring=lifeRing(g,sign*.97,1.0,.48,.23);ring.rotation.y=PI/2;
  for(const zz of [-1.8,-1.2])rod([sign*(zz<-1.5?.6:.85),.48,zz],[sign*(zz<-1.5?.6:.85),.91,zz],.018,M.silver,g);
  curve([[sign*.1,1.02,-2.35],[sign*.6,.95,-1.85],[sign*.86,.91,-1.2]],.02,M.silver,g);
 }
 curve([[-.7,.5,1.96],[0,.5,2.0],[.7,.5,1.96]],.04,M.white,g);
 label(name,1.18,.22,g,0,.17,1.99,{bg:'#f0f0e2',ink:'#385d68',border:false});
 for(let i=0;i<14;i++){const z=rand(-1.6,1.7),x=rand(0,1)>.5?.92:-.92;const r=box(.009,rand(.015,.07),rand(.03,.12),M.rust,g,x,.15+rand(0,.2),z,false);}
 if(cabin){
  // Low solid sill, large transparent windows and open aft doorway.
  for(const x of [-.71,.71])box(.08,.45,1.75,M.white,g,x,.68,-.42);box(1.5,.45,.08,M.white,g,0,.68,-1.25);
  box(1.38,.07,1.66,M.wood,g,0,.475,-.42);
  // Remove the visual enclosure above the sill: only fine frames and glass.
  for(const xx of [-.74,.74]){for(const zz of [-1.26,.42])box(.055,1.03,.055,M.white,g,xx,1.42,zz);box(.045,.055,1.73,M.white,g,xx,1.95,-.42);box(.025,.87,1.59,M.glass,g,xx,1.43,-.42,false);box(.055,.95,.055,M.white,g,xx,1.43,-.4);}
  for(const xx of [-.38,.38]){box(.67,.84,.025,M.glass,g,xx,1.45,-1.28,false);box(.04,.98,.055,M.white,g,xx===-.38?0:.74,1.45,-1.28);}
  for(const xx of [-.57,.57]){box(.35,.55,.055,M.white,g,xx,.72,.47);box(.32,.82,.02,M.glass,g,xx,1.4,.47,false);box(.045,1.48,.07,M.white,g,xx<0?-.38:.38,1.2,.48);}
  box(1.72,.13,1.98,M.white,g,0,2.04,-.42);box(1.8,.045,2.05,accent,g,0,2.13,-.42);
  // Dashboard, luminous radar and sounder; each dial is geometry or a canvas mark.
  box(1.2,.3,.36,M.navy,g,0,1.03,-.97);navigationInstruments(g);
  const wh=torus(.18,.022,M.wood,g,-.37,1.18,-.64);for(let i=0;i<5;i++){const a=i*PI*2/5;rod([-.37,1.18,-.63],[-.37+Math.sin(a)*.19,1.18+Math.cos(a)*.19,-.63],.013,M.silver,g);}cyl(.03,.03,.2,M.silver,g,-.37,1.18,-.73).rotation.x=PI/2;
  const ch=mesh(new THREE.PlaneGeometry(.41,.39),new THREE.MeshBasicMaterial({map:chartTexture(),side:THREE.DoubleSide}),g,[-.35,1.191,-.96]);ch.rotation.x=-PI/2;label('潮汐\n満潮 16:42',.23,.26,g,.62,1.47,-.75,{bg:'#efe3be',border:false,bold:false}).rotation.y=-PI/2;
  // Seat and thermos in the otherwise open wheelhouse.
  cyl(.035,.045,.35,M.iron,g,-.3,.67,-.15);box(.35,.09,.34,M.navy,g,-.3,.88,-.15);box(.35,.31,.07,M.navy,g,-.3,1.02,.02);
  box(.27,.06,.65,M.wood,g,.55,.96,-.52);thermos(g,.60,.995,-.60);mug(g,.55,.995,-.33);
  // Raincoat on a hook: broad shoulders, hood and hanging sleeves.
  const coat=group(g,.6,.94,.06,-PI/2);const silhouette=new THREE.Shape();
  silhouette.moveTo(-.12,0);silhouette.lineTo(.12,0);silhouette.lineTo(.1,.32);silhouette.lineTo(.15,.12);silhouette.lineTo(.2,.14);silhouette.lineTo(.15,.43);silhouette.quadraticCurveTo(.11,.47,.065,.47);silhouette.quadraticCurveTo(0,.40,-.065,.47);silhouette.quadraticCurveTo(-.11,.47,-.15,.43);silhouette.lineTo(-.2,.14);silhouette.lineTo(-.15,.12);silhouette.lineTo(-.1,.32);silhouette.closePath();
  mesh(new THREE.ExtrudeGeometry(silhouette,{depth:.035,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.007,bevelThickness:.006}),M.yellow,coat);
  for(const sx of [-.055,.055])curve([[sx,0,.045],[sx*.85,.19,.047],[sx,.34,.045]],.003,mat('#c9ac68'),coat,12);
  for(let k=0;k<4;k++)sphere(.007,M.ivory,coat,.014,.11+k*.065,.047);const hood=mesh(new THREE.SphereGeometry(.105,14,8,0,PI*2,0,PI/2),mat('#e2b951',{side:THREE.DoubleSide}),coat,[0,.51,.01]);hood.rotation.x=-PI/2;mesh(new THREE.CircleGeometry(.083,14),mat('#b49957'),coat,[0,.51,-.025]);torus(.089,.011,M.yellow,coat,0,.51,.01);line([[0,0,.041],[0,.44,.041]],'#9a8f56',coat);torus(.035,.008,M.iron,coat,0,.63,0);
  label('大漁\n祈願',.11,.23,g,-.695,1.6,-.18,{bg:'#ead9af',ink:'#ad7657',border:false}).rotation.y=PI/2;
  const photo=tex((c,w,h)=>{c.fillStyle='#dddac7';c.fillRect(0,0,w,h);c.fillStyle='#8cb8bb';c.fillRect(12,12,w-24,h-24);c.fillStyle='#d4dfcb';c.beginPath();c.ellipse(w*.5,h*.58,w*.28,h*.13,-.2,0,6.28);c.fill();c.fillStyle='#476875';c.beginPath();c.moveTo(w*.23,h*.58);c.lineTo(w*.13,h*.36);c.lineTo(w*.12,h*.75);c.fill();},128,100);
  const ph=mesh(new THREE.PlaneGeometry(.2,.16),new THREE.MeshBasicMaterial({map:photo,side:THREE.DoubleSide}),g,[.695,1.65,-.36]);ph.rotation.y=-PI/2;
  rod([0,2.16,-.5],[0,3.05,-.5],.025,M.iron,g);rod([-.5,2.7,-.5],[.5,2.7,-.5],.018,M.iron,g);cyl(.15,.2,.13,M.white,g,.35,2.24,-.85);rod([-.6,2.12,-1],[-.63,3,-1],.008,M.dark,g);
  for(const x of [-.75,.75]){rod([x,.5,1.55],[x,1.72,1.55],.018,M.silver,g);rod([x,1.74,.5],[x,1.74,1.6],.018,M.silver,g);}
  box(1.55,.04,.8,mat('#c6dbcf'),g,0,1.76,1.15);
  reflectedCaustics(g,1.4,1.66,1.966,-.42);
  const beam=mesh(new THREE.ConeGeometry(.45,1.3,4,1,true),new THREE.MeshBasicMaterial({color:'#fff1b7',transparent:true,opacity:.04,side:THREE.DoubleSide,depthWrite:false}),g,[0,1.35,-.3]);beam.rotation.z=-.35;dynamics.beams.push(beam);
 }else{
  for(const z of [-.9,.65])box(1.6,.12,.3,M.wood,g,0,.61,z);crate(g,0,.47,-.1,M.blue,.9,.3,.56);bucket(g,-.48,.47,1.25);box(.44,.64,.24,M.navy,g,0,.62,2.02);cyl(.06,.06,.6,M.iron,g,0,.07,2.13);rod([-.4,.73,1.94],[-.4,.86,1.4],.025,M.iron,g);
 }
 crate(g,.25,.48,1.55,M.blue,.5,.26,.34);const coil=group(g,-.3,.48,1.1);for(let i=0;i<4;i++)torus(.14+i*.027,.017,M.rope,coil,0,i*.006,0).rotation.x=PI/2;
 if(parent===root)dynamics.boats.push({g,x,z,ry,phase:id*1.73,scale,cabin,id});return g;
}
export function boats(){
 makeBoat(root,-2.55,1.25,1,0,true,M.teal,'しらさめ 03',0);
 makeBoat(root,-2.65,-4.55,.76,.06,false,M.blue,'凪  12',1);
 makeBoat(root,6.2,2.35,.88,PI/2,true,M.blue,'あおば 07',2);
 makeBoat(root,7.3,-4.2,.87,0,true,M.red,'白雨丸 08',3);
 const distant=makeBoat(root,8,-11.63,.13,-PI/2,true,M.teal,'',8);dynamics.distant=distant;
}
