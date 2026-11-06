import {THREE,PI,root,M,mat,mesh,box,roundedBox,cyl,sphere,torus,group,rod,curve,line,label,disk,crate,bucket,mug,rand,dynamics,wetConcrete,tex} from './core.js';
import {tiledRoof} from './craftsmanship.js';
import {reflectedCaustics} from './instruments.js';
import {hangingBoot,waitingTable} from './objects.js';
function roof(parent,w,d,y,color=M.teal){
 const g=group(parent,0,y,0);const slope=.29;
 for(const side of [-1,1]){const panel=box(w+.45,.10,d*.55,color,g,0,.28,side*d*.25);panel.rotation.x=side*slope;for(let i=0;i<Math.round(w/.16);i++){const rib=box(.045,.045,d*.55,M.edge,g,-w/2+i*.16,.35,side*d*.25,false);rib.rotation.x=side*slope;}}
 rod([-w/2-.25,.65,0],[w/2+.25,.65,0],.07,color,g);
 return g;
}
function bench(parent,x,y,z,w=2){for(let i=0;i<4;i++)box(w,.08,.1,M.wood,parent,x,y,z-.18+i*.12);for(let i=0;i<3;i++)box(w,.1,.06,M.wood,parent,x,y+.25+i*.13,z-.27);for(const s of [-1,1]){rod([x+s*w*.38,y-.45,z-.2],[x+s*w*.38,y+.52,z-.23],.04,M.iron,parent);rod([x+s*w*.38,y-.45,z+.2],[x+s*w*.38,y,z+.2],.04,M.iron,parent);}}
function beam(parent,x,y,z){const geo=new THREE.ConeGeometry(.65,3.5,4,1,true);const m=mesh(geo,new THREE.MeshBasicMaterial({color:'#fff1b7',transparent:true,opacity:.065,side:THREE.DoubleSide,depthWrite:false}),parent,[x,y,z]);m.rotation.z=-.38;dynamics.beams.push(m);}

export function buildings(){
 const w=group(root,-8.55,.62,.15,PI/2);
 box(5.4,.13,4.2,wetConcrete,w,0,.05,0);box(5.4,3.3,.13,M.ivory,w,0,1.7,-2);
 for(const s of [-1,1]){box(.13,2.6,4.1,M.ivory,w,s*2.64,1.3,0);box(.13,.35,4.1,M.white,w,s*2.64,3.15,0);box(.06,.45,3.7,M.glass,w,s*2.65,2.85,0);for(let z=-1.8;z<2;z+=.75)box(.13,.5,.06,M.teal,w,s*2.65,2.85,z);}
 for(const x of [-2.12,2.12])box(1.02,3.3,.15,M.ivory,w,x,1.67,2);
 box(5.5,.34,.22,M.white,w,0,3.23,2.02);box(3.3,.11,.19,M.iron,w,0,3.03,2.04);
 // Half-raised roller shutter; the lower 1.9 metres are physically open.
 for(let i=0;i<12;i++)box(3.24,.09,.10,M.silver,w,0,2.02+i*.085,2.04);
 for(const x of [-1.67,1.67])box(.08,3,.1,M.edge,w,x,1.5,2.07);
 label('白雨漁業協同組合',4.5,.54,w,0,3.47,2.12,{bg:'#e3e9d9',ink:'#397876'});
 roof(w,5.5,4.2,3.6,M.teal);
 box(5.25,.08,3.98,M.ivory,w,0,3.27,0);for(const x of [-1.85,0,1.85])box(.07,.11,3.98,M.wood,w,x,3.16,0);
 // Exterior siding, gutter and downpipe.
 for(let i=0;i<23;i++)box(.035,2.9,.03,M.edge,w,-2.6+i*.23,1.6,-2.08,false);
 rod([-2.9,3.63,2.2],[2.9,3.63,2.2],.065,M.edge,w);curve([[2.8,3.6,2.2],[2.8,3.35,2.25],[2.8,.2,2.25]],.05,M.rust,w);
 // Warm but open workroom with individually modelled equipment.
 for(let j=0;j<3;j++)for(let i=0;i<3;i++)crate(w,-1.8+j*.62,.13+i*.36,-1.15,j===2?M.blue:M.white,.58,.32,.5);
 roundedBox(1.5,.9,.7,.035,M.white,w,1.6,.58,-1.32);roundedBox(1.54,.09,.74,.025,M.silver,w,1.6,1.08,-1.32);roundedBox(.34,.06,.06,.018,M.dark,w,1.6,.99,-.93);
 label('氷',.28,.3,w,1.6,.66,-.954,{bg:'#f0f3e7',ink:'#4b9199',border:false});
 box(.7,.12,.58,M.silver,w,.7,.32,.55);cyl(.07,.08,.7,M.iron,w,.7,.72,.4);const scale=cyl(.26,.26,.1,M.ivory,w,.7,1.2,.39,32);scale.rotation.x=PI/2;
 const scaleMap=tex((c,s,h)=>{c.fillStyle='#ebe4c9';c.fillRect(0,0,s,h);c.strokeStyle='#486c67';c.lineWidth=3;c.fillStyle='#486c67';c.textAlign='center';c.textBaseline='middle';c.font='35px serif';for(let i=0;i<=30;i++){const a=(-.75+i/30*1.5)*PI;const r=i%5?.40:.35;c.beginPath();c.moveTo(s/2+Math.sin(a)*s*.44,h/2-Math.cos(a)*h*.44);c.lineTo(s/2+Math.sin(a)*s*r,h/2-Math.cos(a)*h*r);c.stroke();if(i%5===0)c.fillText(String(i/2),s/2+Math.sin(a)*s*.27,h/2-Math.cos(a)*h*.27);}c.font='32px serif';c.fillText('kg',s/2,h*.68);},256,256);
 mesh(new THREE.CircleGeometry(.235,48),new THREE.MeshBasicMaterial({map:scaleMap}),w,[.7,1.2,.452]);rod([.7,1.2,.46],[.55,1.34,.46],.009,M.red,w);sphere(.024,M.iron,w,.7,1.2,.463);
 label('本日の水揚げ\nあじ　 480\nさば　 620\nいか　 850',1.36,1.25,w,.15,2.1,-1.91,{bg:'#335658',ink:'#ece8cb',bold:false});
 for(const x of [-2.1,-1.82])hangingBoot(w,x,1.57,-1.78);
 const iceMaterial=new THREE.MeshPhysicalMaterial({color:'#daf6e7',transparent:true,opacity:.68,roughness:.16,metalness:.08,flatShading:true});
 for(let i=0;i<19;i++){const ice=mesh(new THREE.IcosahedronGeometry(rand(.045,.09),0),iceMaterial,w,[rand(-1.4,1.6),.16,rand(.3,1.7)]);ice.scale.set(1.4,.55,1);ice.rotation.y=rand(0,6);}
 for(const [x,z,sx,sz] of [[-.5,.9,.9,.44],[1.35,-.35,.4,.5],[-1.7,.15,.38,.62]])dynamics.puddles.push({x:-8.55+z,z:.15-x,sx:sz,sz:sx,y:.751,inside:true});
 beam(w,-.8,1.8,-.5);beam(w,1.4,1.8,.2);reflectedCaustics(w,4.9,3.8,3.21);
 const lamp=new THREE.PointLight('#fff2c4',1.7,5,2);lamp.position.set(0,2.6,.8);w.add(lamp);rod([0,3.4,.3],[0,2.9,.3],.015,M.iron,w);cyl(.2,.32,.16,M.ivory,w,0,2.85,.3);disk(.24,new THREE.MeshBasicMaterial({color:'#fff4cb'}),w,0,2.76,.3);
 // Waiting room, continuous windows and an open glazed door.
 const r=group(root,-8.75,.62,-5.2,PI/2);
 box(3.65,.16,3.6,M.concrete,r,0,.04,0);box(3.6,2.7,.13,M.ivory,r,0,1.43,-1.72);box(.13,2.7,3.55,M.ivory,r,-1.73,1.43,0);box(.13,2.7,3.55,M.ivory,r,1.73,1.43,0);
 for(const x of [-1.73,-.57,.57,1.73])box(.065,2.7,.08,M.teal,r,x,1.4,1.76);
 for(const y of [.19,2.68])box(3.55,.09,.09,M.teal,r,0,y,1.76);
 for(const x of [-1.14,1.14])box(1.07,2.36,.025,M.glass,r,x,1.42,1.76,false);
 const door=group(r,-.54,.2,1.8,-1.35);box(1.05,2.35,.035,M.glass,door,.5,1.17,0);for(const x of [0,1.02])box(.045,2.4,.07,M.teal,door,x,1.18,0);for(const y of [0,2.36])box(1.05,.05,.07,M.teal,door,.5,y,0);rod([.9,.95,.06],[.9,1.25,.06],.022,M.silver,door);
 roof(r,3.8,3.8,2.9,mat('#8caca7'));label('白雨港 待合所',3.2,.38,r,0,2.86,1.9,{bg:'#ebe7d2',ink:'#507974'});
 box(3.48,.07,3.43,M.ivory,r,0,2.75,0);reflectedCaustics(r,3.4,3.35,2.707);
 bench(r,0,.64,-1.0,2.8);label('船の時刻表\n白雨 → 青島\n08:15　10:30\n13:40　16:05',1.1,1.15,r,-.7,1.9,-1.64,{bg:'#e7dfc2',ink:'#6c8580',bold:false});
 const clock=group(r,.86,2.26,-1.62);clock.rotation.z=.07;const cl=cyl(.27,.27,.06,M.teal,clock,0,0,0,32);cl.rotation.x=PI/2;
 const clockTex=tex((c,w,h)=>{c.fillStyle='#eee9d5';c.fillRect(0,0,w,h);c.strokeStyle='#456666';c.lineWidth=4;for(let i=0;i<60;i++){let a=i*PI/30;c.beginPath();c.moveTo(w/2+Math.sin(a)*w*.43,h/2-Math.cos(a)*h*.43);c.lineTo(w/2+Math.sin(a)*w*(i%5?.40:.36),h/2-Math.cos(a)*h*(i%5?.40:.36));c.stroke();}c.fillStyle='#456666';c.font='60px serif';c.textAlign='center';c.textBaseline='middle';[['12',256,112],['3',405,256],['6',256,400],['9',108,256]].forEach(p=>c.fillText(...p));});mesh(new THREE.CircleGeometry(.235,48),new THREE.MeshBasicMaterial({map:clockTex}),clock,[0,0,.04]);rod([0,0,.05],[0,.16,.05],.009,M.dark,clock);rod([0,0,.05],[.12,-.045,.05],.009,M.dark,clock);
 waitingTable(r);
 const pot=cyl(.18,.13,.27,M.rust,r,-1.3,.27,.8);
 const heart=new THREE.Shape();heart.moveTo(0,-.18);heart.bezierCurveTo(-.08,-.1,-.2,.03,-.17,.11);heart.bezierCurveTo(-.14,.19,-.04,.17,0,.08);heart.bezierCurveTo(.04,.17,.14,.19,.17,.11);heart.bezierCurveTo(.2,.03,.08,-.1,0,-.18);
 const leafGeo=new THREE.ShapeGeometry(heart,12);
 for(let i=0;i<8;i++){const a=i*.8;curve([[-1.3,.4,.8],[-1.3+Math.cos(a)*.12,.7,.8+Math.sin(a)*.12],[-1.3+Math.cos(a)*.28,.51,.8+Math.sin(a)*.23]],.009,M.leafDark,r);const leaf=group(r,-1.3+Math.cos(a)*.24,.57,.8+Math.sin(a)*.2,a);leaf.rotation.x=-.5;mesh(leafGeo,mat(i%2?'#6ca088':'#8fb497',{side:THREE.DoubleSide}),leaf);line([[0,-.14,.003],[0,.08,.003]],'#a8c7a2',leaf,.6);}

 // A small wall-mounted outside unit and conduits.
 box(.72,.55,.22,M.white,w,-2.15,1.5,2.22);const fan=torus(.19,.015,M.edge,w,-2.15,1.5,2.34);for(let i=0;i<5;i++){const b=box(.03,.34,.02,M.edge,w,-2.15,1.5,2.35,false);b.rotation.z=i*PI/5;}
 curve([[-2.48,1.5,2.22],[-2.65,1.5,2.23],[-2.65,.3,2.2]],.025,M.ivory,w);
 // Two little tiled houses peeking through the trees.
 for(const [x,z,y,sz] of [[-10.3,-9.8,3.5,.82],[-7.8,-10.1,3.45,.72]]){const h=group(root,x,y,z);h.scale.setScalar(sz);box(2,1.7,1.7,M.ivory,h,0,.85,0);tiledRoof(h,2.2,1.9,1.72);for(const xx of [-.55,.55]){box(.52,.66,.04,M.dark,h,xx,.9,.87);box(.44,.57,.045,M.glass,h,xx,.9,.9);box(.035,.63,.06,M.wood,h,xx,.9,.94);for(const s of [-1,1]){box(.12,.69,.065,M.wood,h,xx+s*.35,.9,.91);for(let k=0;k<7;k++)box(.13,.025,.075,M.edge,h,xx+s*.35,.64+k*.085,.92,false);}}box(.48,.9,.04,M.wood,h,0,.48,-.87);for(let i=0;i<7;i++)box(2.02,.025,.02,M.wood,h,0,.22+i*.18,.87,false);}
}
