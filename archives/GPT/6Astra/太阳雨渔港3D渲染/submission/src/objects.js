import {THREE,PI,M,mat,mesh,box,roundedBox,cyl,sphere,torus,group,rod,curve,line,disk,mug,tex} from './core.js';

export function hangingBoot(parent,x,y,z){
 const g=group(parent,x,y,z);
 roundedBox(.18,.03,.34,.014,M.dark,g,0,.015,.065);
 roundedBox(.173,.135,.325,.055,M.yellow,g,0,.087,.063);
 const points=[[.074,.08],[.079,.16],[.077,.35],[.084,.49],[.073,.49],[.067,.17]].map(([a,b])=>new THREE.Vector2(a,b));
 const shaft=mesh(new THREE.LatheGeometry(points,24),M.yellow,g);shaft.scale.z=1.1;
 disk(.072,mat('#887953'),g,0,.465,0).scale.y=1.1;
 const lip=torus(.079,.009,M.yellow,g,0,.49,0);lip.rotation.x=PI/2;lip.scale.y=1.1;
 for(let i=0;i<5;i++)box(.16,.009,.013,M.edge,g,0,.025,-.065+i*.06,false);
 curve([[0,.44,-.075],[0,.55,-.1],[0,.59,-.055],[0,.55,-.03]],.012,M.iron,g);
 line([[.056,.15,.059],[.057,.32,.065],[.059,.45,.067]],'#b49f58',g,.5);
}

export function thermos(parent,x,y,z){
 const g=group(parent,x,y,z);
 cyl(.057,.062,.245,M.silver,g,0,.125,0,24);
 cyl(.059,.059,.02,M.dark,g,0,.025,0,24);
 cyl(.055,.055,.047,M.dark,g,0,.266,0,24);
 torus(.057,.005,M.ivory,g,0,.238,0).rotation.x=PI/2;
 curve([[.048,.20,0],[.09,.20,0],[.094,.08,0],[.05,.07,0]],.012,M.dark,g);
 roundedBox(.055,.04,.004,.003,M.ivory,g,0,.14,.059);
 return g;
}

export function waitingTable(parent){
 roundedBox(.78,.08,.65,.018,M.wood,parent,1.18,.78,.43);
 for(const x of [.86,1.50])for(const z of [.18,.68])rod([x,.12,z],[x,.75,z],.026,M.iron,parent);
 const radio=group(parent,1.04,.825,.30);
 roundedBox(.37,.24,.15,.021,M.wood,radio,0,.12,0);
 roundedBox(.337,.205,.014,.012,M.ivory,radio,0,.12,.079);
 const grille=tex((c,w,h)=>{c.fillStyle='#7b8272';c.fillRect(0,0,w,h);for(let i=0;i<32;i++)for(let j=0;j<24;j++){c.fillStyle=(i+j)%2?'#bac0a4':'#526e65';c.fillRect(i*8,j*8,4,4);}},256,192);
 mesh(new THREE.PlaneGeometry(.177,.14),new THREE.MeshToonMaterial({map:grille}),radio,[-.061,.105,.088]);
 const dial=tex((c,w,h)=>{c.fillStyle='#466663';c.fillRect(0,0,w,h);c.strokeStyle='#ccd5ad';for(let i=0;i<25;i++){c.beginPath();c.moveTo(i*20+12,8);c.lineTo(i*20+12,i%5?27:42);c.stroke();}c.fillStyle='#dedabb';c.font='25px monospace';c.fillText('88  94  100  108',12,70);c.fillStyle='#e9a572';c.fillRect(184,3,3,h-6);},512,96);
 mesh(new THREE.PlaneGeometry(.28,.042),new THREE.MeshBasicMaterial({map:dial}),radio,[0,.195,.089]);
 for(const y of [.063,.135]){cyl(.026,.026,.016,M.dark,radio,.111,y,.096,20).rotation.x=PI/2;line([[.111,y,.108],[.111,y+.018,.108]],'#e6e3ca',radio);}
 curve([[-.11,.25,0],[-.1,.295,0],[.1,.295,0],[.11,.25,0]],.012,M.dark,radio);
 rod([.12,.25,-.035],[.22,.58,-.035],.005,M.silver,radio);
 const kettle=group(parent,1.36,.825,.55);
 const profile=[[0,0],[.084,0],[.115,.045],[.119,.19],[.095,.255],[.065,.265]].map(([a,b])=>new THREE.Vector2(a,b));
 mesh(new THREE.LatheGeometry(profile,28),M.silver,kettle);
 cyl(.097,.10,.022,M.silver,kettle,0,.266,0);sphere(.023,M.dark,kettle,0,.293,0);
 curve([[.10,.07,0],[.18,.07,0],[.20,.21,0],[.10,.23,0]],.016,M.dark,kettle);
 curve([[-.09,.13,0],[-.15,.18,0],[-.17,.26,0],[-.21,.28,0]],.024,M.silver,kettle);
 mug(parent,.94,.825,.62);
}

const fishBodyGeometry=(()=>{
 const profile=[[.007,-.24],[.028,-.17],[.063,-.08],[.075,.025],[.063,.135],[.03,.225],[0,.262]].map(([a,b])=>new THREE.Vector2(a,b));
 const geometry=new THREE.LatheGeometry(profile,18);geometry.rotateX(PI/2);geometry.scale(.79,1,1);
 const color=[],pos=geometry.attributes.position;
 for(let i=0;i<pos.count;i++){const y=pos.getY(i),c=new THREE.Color(y>.025?'#689388':y<-.02?'#d6dfcc':'#aec6b7');color.push(c.r,c.g,c.b);}
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(color,3));return geometry;
})();
function fin(parent,points,material=M.teal){const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));geometry.setIndex([0,1,2]);geometry.computeVertexNormals();return mesh(geometry,material,parent);}
export function fishModel(parent){
 const g=group(parent),body=mesh(fishBodyGeometry,mat('#ffffff',{vertexColors:true}),g);
 const finMat=mat('#77a799',{side:THREE.DoubleSide});
 const tail=group(g,0,0,-.22);
 fin(tail,[[0,0,.02],[0,.115,-.15],[0,.02,-.095]],finMat);
 fin(tail,[[0,0,.02],[0,-.02,-.095],[0,-.115,-.15]],finMat);
 fin(g,[[0,.065,.08],[0,.145,-.055],[0,.055,-.14]],finMat);
 for(const s of [-1,1]){
  sphere(.014,M.dark,g,s*.047,.015,.168,2);sphere(.004,M.white,g,s*.055,.02,.173);
  fin(g,[[s*.05,-.01,.055],[s*.14,-.05,-.055],[s*.047,-.025,-.035]],finMat);
  line([[s*.039,.041,.12],[s*.053,.015,.105],[s*.044,-.027,.12]],'#6e968c',g,.65);
  line([[s*.035,.008,-.17],[s*.057,.008,-.04],[s*.053,.008,.09]],'#d7e6cf',g,.6);
 }
 return {g,tail};
}

export function harborCat(parent){
 const g=group(parent,9.5,.62,10.03),fur=mat('#e8a36f'),pink=mat('#d8a49a');
 const torso=group(g,0,.19,0),body=mesh(new THREE.SphereGeometry(.23,32,20),M.ivory,torso);body.scale.set(.7,.72,1.5);
 // Fur markings follow the ellipsoid instead of hovering above its back.
 for(let band=0;band<3;band++){
  const vertices=[],indices=[],center=-.17+band*.13;
  for(let i=0;i<=24;i++)for(let side=0;side<2;side++){
   const a=-1.18+i/24*2.36,z=center+(side-.5)*(.032+.012*Math.cos(a*3+band));
   const section=Math.sqrt(1-(z/.345)**2)*1.009;
   vertices.push(Math.sin(a)*.161*section,Math.cos(a)*.1656*section,z);
   if(i<24&&side===0){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(geo,mat('#d99966',{side:THREE.DoubleSide}),torso);
 }
 const head=group(g,0,.30,.27);sphere(.17,M.ivory,head);
 const eyes=[];
 for(const s of [-1,1]){
  const ear=group(head,s*.105,.105,-.01);ear.rotation.z=-s*.20;
  const outline=new THREE.Shape();outline.moveTo(-.062,0);outline.lineTo(.062,0);outline.lineTo(0,.16);outline.closePath();
  mesh(new THREE.ExtrudeGeometry(outline,{depth:.04,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:1,steps:1}),fur,ear,[0,0,-.02]);
  fin(ear,[[-.039,.018,.025],[.039,.018,.025],[0,.12,.025]],pink);
  const cheek=sphere(.052,M.white,head,s*.043,-.045,.139);cheek.scale.y=.7;
  const eye=sphere(.019,M.dark,head,s*.069,.025,.145);eye.scale.set(.8,.68,.45);eyes.push(eye);
  sphere(.004,M.ivory,head,s*.066,.03,.154);
  for(let j=0;j<2;j++)line([[s*.075,-.026-j*.019,.15],[s*.205,-.012-j*.038,.17]],'#7f8975',head,.72);
 }
 sphere(.018,pink,head,0,-.026,.173).scale.set(1,.7,.6);
 line([[0,-.038,.171],[0,-.06,.171],[-.018,-.068,.162]],'#af9578',head,.6);
 line([[0,-.06,.171],[.018,-.068,.162]],'#af9578',head,.6);
 const tail=group(g,0,.14,-.27);
 curve([[0,0,0],[.17,-.025,-.18],[.29,.06,-.12],[.30,.14,-.02]],.036,fur,tail);
 sphere(.037,M.ivory,tail,.30,.14,-.02);
 const legs=[];
 for(const x of [-.105,.105])for(const z of [-.19,.19]){
  const leg=group(g,x,.165,z);leg.userData.front=z>0;rod([0,0,0],[0,-.125,.012],.032,M.ivory,leg);
  const paw=sphere(.049,M.ivory,leg,0,-.137,.035);paw.scale.set(.9,.55,1.3);
  for(const offset of [-.012,.012])line([[offset,-.136,.087],[offset,-.145,.080]],'#b8b9a1',leg,.65);
  legs.push(leg);
 }
 return {g,head,legs,tail,eyes,torso};
}
