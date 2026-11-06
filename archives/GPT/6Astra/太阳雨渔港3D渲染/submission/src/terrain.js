import {THREE,PI,V,root,M,mat,mesh,box,cyl,sphere,torus,group,rod,curve,line,label,disk,tire,rand,dynamics,wetConcrete,tex} from './core.js';
import {fishModel} from './objects.js';
export function terrain(){
 const base=box(24,.34,24,M.ivory,root,0,-2.91,0);box(23.9,.12,23.9,M.dark,root,0,-2.69,0);
 box(7,3.3,24,wetConcrete,root,-8.5,-1.05,0);
 // The slipway is a real recess, with a continuous solid foundation beneath.
 box(13.3,3.3,7,wetConcrete,root,1.65,-1.05,8.5);
 box(1.3,3.3,7,wetConcrete,root,11.35,-1.05,8.5);
 box(2.4,3.3,2.65,wetConcrete,root,9.5,-1.05,10.675);
 box(2.4,2.45,4.35,wetConcrete,root,9.5,-1.475,7.175);
 // Individual masonry courses remain visible above and below the tide.
 for(let row=0;row<5;row++)for(let i=0;i<12;i++){const z=-11+2*i;const x=-4.98;box(.045,.53,1.95,row<3?mat(['#698e85','#78998d','#87a699'][row]):M.concrete,root,x,-2.35+row*.59,z);}
 for(let row=0;row<5;row++)for(let i=0;i<9;i++){
  const x=-4+1.88*i,material=row<3?mat(['#698e85','#78998d','#87a699'][row]):M.concrete;
  const ranges=row===4?[[x-.925,Math.min(x+.925,8.3)],[Math.max(x-.925,10.7),x+.925]]:[[x-.925,x+.925]];
  for(const [a,b] of ranges)if(b>a)box(b-a,.53,.05,material,root,(a+b)/2,-2.35+row*.59,4.98);
 }
 for(let i=0;i<130;i++){const z=rand(-11.5,4.8),y=rand(-2.3,.1);const b=sphere(rand(.025,.075),i%3?M.ivory:M.edge,root,-4.925,y,z);b.scale.x=.5;}
 for(let i=0;i<60;i++)sphere(rand(.03,.08),M.ivory,root,rand(-4.8,11.5),rand(-2.3,-.1),4.93);
 // Joint lines, worn drainage grilles, and small repaired patches.
 for(let z=-11;z<12;z+=2.5)line([[-11.9,.608,z],[-5.05,.608,z]],'#9caaa4',root,.38);
 for(let x=-4;x<12;x+=3)line([[x,.608,x>8.3&&x<10.7?9.38:5.08],[x,.608,11.9]],'#9caaa4',root,.38);
 line([[-9,.608,-11.9],[-9,.608,11.9]],'#9caaa4',root,.3);line([[-4.9,.608,9],[8.28,.608,9]],'#9caaa4',root,.3);line([[10.72,.608,9],[11.9,.608,9]],'#9caaa4',root,.3);
 for(let z of [-5,2,9]){box(.38,.025,.8,M.iron,root,-5.7,.618,z);for(let k=0;k<7;k++)box(.32,.027,.025,M.edge,root,-5.7,.637,z-.3+k*.1,false);}
 box(13.25,.22,.23,M.ivory,root,1.625,.71,5.08);box(1.25,.22,.23,M.ivory,root,11.375,.71,5.08);box(.23,.22,16.3,M.ivory,root,-5.12,.71,-3.1);
 const hazard=tex((c,w,h)=>{c.fillStyle='#e6bd58';c.fillRect(0,0,w,h);c.fillStyle='#33464a';for(let i=-1;i<9;i++){c.beginPath();c.moveTo(i*80,0);c.lineTo(i*80+38,0);c.lineTo(i*80-20,h);c.lineTo(i*80-58,h);c.fill();}for(let i=0;i<650;i++){c.fillStyle='rgba(217,218,188,.35)';c.fillRect(rand(0,w),rand(0,h),rand(1,8),rand(1,3));}},512,64);
 const hz=new THREE.MeshToonMaterial({map:hazard});
 for(const [x,w] of [[-2.9,3.2],[6.5,3],[11.35,1.05]])box(w,.23,.025,hz,root,x,.72,4.94);
 for(let z of [-7,-.5,3]){let b=box(2.2,.22,.025,hz,root,-4.97,.72,z);b.rotation.y=PI/2;}
 // Broad steps and a lower landing.
 for(let i=0;i<5;i++)box(2.1,.21,1.0,wetConcrete,root,1.0,.5-i*.10,4.8-i*.33);
 box(2.3,.26,1.5,wetConcrete,root,3.1,0,4.1);
 // The graded surface rises from below the tide to the upper apron.
 const profile=new THREE.Shape();profile.moveTo(4.1,-.28);profile.lineTo(9.35,-.28);profile.lineTo(9.35,.60);profile.lineTo(4.1,-.15);profile.closePath();
 const rampGeo=new THREE.ExtrudeGeometry(profile,{depth:2.4,bevelEnabled:false,steps:1});rampGeo.rotateY(-PI/2);rampGeo.translate(10.7,0,0);mesh(rampGeo,wetConcrete,root);
 const rampY=z=>-.15+(z-4.1)/7;
 for(let i=0;i<26;i++){const z=4.2+i*.195;const rib=box(2.22,.008,.018,M.edge,root,9.5,rampY(z)+.006,z,false);rib.rotation.x=-Math.atan(1/7);}
 for(const x of [8.46,10.54]){
  rod([x,rampY(4.2)+.055,4.2],[x,rampY(9.27)+.055,9.27],.027,M.rust);
  for(let i=0;i<8;i++){const z=4.4+i*.65;box(.14,.024,.11,M.iron,root,x,rampY(z)+.016,z);for(const s of [-1,1])cyl(.018,.018,.018,M.silver,root,x+s*.052,rampY(z)+.037,z,6);}
 }
 // Seabed, clearly viewed through the cut faces.
 box(16.95,.17,16.95,M.sand,root,3.5,-2.52,-3.5);
 for(let i=0;i<125;i++){const r=rand(.07,.37);const s=sphere(r,mat(['#7eafa5','#b5ccbb','#83a49e','#d1d4bc'][i%4]),root,rand(-4.7,11.8),-2.38,rand(-11.8,4.75));s.scale.set(1,.35,rand(.65,1.4));}
 const old=tire(root,7,-2.28,3,.63);old.rotation.x=-PI/2;old.rotation.y=.22;
 for(let i=0;i<26;i++){const t=torus(.075,.019,M.rust,root,5.7+i*.08,-2.28+Math.sin(i*.2)*.04,2.2+Math.sin(i*.23)*.4);t.rotation.x=i%2?PI/2:0;}
 for(let i=0;i<36;i++){const g=group(root,rand(-4.6,11.6),-2.41,rand(-11.5,4.6));if(i<8)g.position.set(-4.63,-2.41,-9.8+i*1.8);else if(i<13)g.position.set(-2.7+(i-8)*3.1,-2.41,4.60);for(let k=0;k<4;k++){const pts=[];for(let j=0;j<6;j++)pts.push([Math.sin(j*.65+k)*.12,j*.13+k*.025,Math.cos(j*.6+k)*.09]);const v=[],ind=[];pts.forEach((p,j)=>{const w=.008+Math.sin(j/5*PI)*.065;v.push(p[0]-w,p[1],p[2],p[0]+w,p[1],p[2]);if(j<5){const a=j*2;ind.push(a,a+1,a+2,a+1,a+3,a+2);}});const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex(ind);geo.computeVertexNormals();const leaf=mesh(geo,mat(k%2?'#5e9f88':'#82b39b',{side:THREE.DoubleSide}),g);leaf.rotation.y=k*PI*.7;}dynamics.seaweed.push(g);}
 for(let i=0;i<17;i++){const {g,tail}=fishModel(root);g.scale.setScalar(.88+(i%4)*.065);dynamics.fish.push({g,tail,phase:i*.79,school:i%3});}

 // Tide stains and encrusted mooring rings.
 for(let z of [-9,-3,2]){torus(.16,.035,M.rust,root,-4.9,-.2,z).rotation.y=PI/2;}
 for(const z of [1,-6.8]){for(let k=0;k<2;k++)rod([-4.7,.9,z+k*.43],[-4.7,-1.85,z+k*.43],.04,M.rust);for(let k=0;k<10;k++)rod([-4.68,.8-k*.27,z],[-4.68,.8-k*.27,z+.43],.035,M.rust);}
 // Breakwaters and the red and white harbour light.
 box(9.5,.85,1.65,wetConcrete,root,-.3,-.02,-9.6);box(9.7,.16,1.85,M.ivory,root,-.3,.46,-9.6);
 for(let x=-4.7;x<4.3;x+=1.2)box(1.13,.52,.12,M.edge,root,x,.75,-10.36);
 const lighthouse=group(root,3.4,.54,-9.6);cyl(.72,.85,.26,M.concrete,lighthouse,0,.13,0,16);for(let i=0;i<5;i++)cyl(.4-i*.026,.426-i*.026,.56,i%2?M.red:M.white,lighthouse,0,.5+i*.56,0,16);
 cyl(.64,.64,.13,M.white,lighthouse,0,3.03,0);cyl(.39,.4,.56,M.glass,lighthouse,0,3.37,0,12);for(let i=0;i<6;i++){let a=i*PI/3;rod([Math.cos(a)*.36,3.1,Math.sin(a)*.36],[Math.cos(a)*.36,3.66,Math.sin(a)*.36],.035,M.red,lighthouse);}
 cyl(0,.62,.4,M.red,lighthouse,0,3.85,0);rod([0,4,0],[0,4.48,0],.025,M.iron,lighthouse);sphere(.09,M.yellow,lighthouse,0,3.4,0);const beacon=new THREE.PointLight('#ffdd9c',0,9);beacon.position.set(0,3.4,0);lighthouse.add(beacon);dynamics.beacon=beacon;
 const glowMap=tex((c,w,h)=>{const glow=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);glow.addColorStop(0,'rgba(255,245,190,.85)');glow.addColorStop(.15,'rgba(255,232,159,.35)');glow.addColorStop(.5,'rgba(255,222,140,.07)');glow.addColorStop(1,'rgba(255,222,140,0)');c.fillStyle=glow;c.fillRect(0,0,w,h);},128,128);
 const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,transparent:true,opacity:0,depthWrite:false}));glow.position.set(0,3.4,0);glow.scale.set(1.8,1.8,1);lighthouse.add(glow);dynamics.beaconGlow=glow;
 torus(.59,.025,M.white,lighthouse,0,3.32,0).rotation.x=PI/2;for(let i=0;i<12;i++){let a=i*PI/6;rod([Math.cos(a)*.59,3.02,Math.sin(a)*.59],[Math.cos(a)*.59,3.32,Math.sin(a)*.59],.014,M.white,lighthouse);}
 box(.25,.5,.025,M.teal,lighthouse,0,.68,.4);label('白 雨',.36,.18,lighthouse,0,1.24,.405,{bg:'#f0e9d7',border:false});
 box(13,.43,.45,mat('#a3bcb2'),root,5.3,-.08,-11.0);for(let i=0;i<22;i++)box(.56,.18,.55,M.concrete,root,-1+i*.6,.22,-11.0);
 for(let i=0;i<15;i++){const g=group(root,rand(4.1,6.4),-.01,rand(-10.8,-8.4));g.rotation.set(rand(-1,1),rand(0,6),rand(-1,1));for(const p of [[0,.65,0],[-.57,-.3,.33],[.57,-.3,.33],[0,-.3,-.65]])rod([0,0,0],p,.2,M.concrete,g,5);}
 // Hillside stays inside the square, with staggered crowns and tiled cottages.
 const hill=sphere(3.2,mat('#8db49a'),root,-9.25,.9,-10);hill.scale.set(.85,.8,.63);
 for(let i=0;i<12;i++){const z=-11.6+i*.28;const rock=sphere(.55,mat(i%2?'#91aaa0':'#adc0ad'),root,-6.7,1.2+Math.sin(i*.22)*.4,z);rock.scale.set(.7,1.4,1);}
 for(let i=0;i<40;i++){const x=rand(-11.35,-7),z=rand(-11.4,-8.6);if((Math.abs(x+10.3)<.9&&Math.abs(z+9.8)<.75)||(Math.abs(x+7.8)<.8&&Math.abs(z+10.1)<.65))continue;const y=.9+Math.sqrt(Math.max(.1,1-((x+9.25)/2.75)**2-((z+10)/2.05)**2))*2.56;const g=group(root,x,y,z);cyl(.065,.095,.85,M.wood,g,0,.4,0);for(let k=0;k<4;k++){const crown=sphere(rand(.45,.8),[M.leaf,M.leafLight,M.leafDark][(i+k)%3],g,rand(-.3,.3),.8+k*.22,rand(-.2,.2));crown.scale.y=.85;}dynamics.trees.push(g);}
}
