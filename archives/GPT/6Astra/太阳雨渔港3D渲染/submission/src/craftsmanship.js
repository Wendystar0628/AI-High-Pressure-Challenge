import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {THREE,PI,root,M,mat,mesh,box,cyl,torus,group,line,rand,tex} from './core.js';

export function tiledRoof(parent,w,d,y){
 const g=group(parent,0,y,0),tiles=[];
 const colors=['#617f88','#718f95','#54757f','#79969a'].map(c=>new THREE.Color(c));
 for(const side of [-1,1]){
  const slope=group(g,0,.30,side*d*.25);slope.rotation.x=side*.36;
  box(w+.35,.065,d*.57,M.navy,slope,0,0,0);
  const cols=Math.ceil((w+.35)/.145),rows=5;
  for(let col=0;col<cols;col++)for(let row=0;row<rows;row++){
   const vv=[],ii=[],cc=[],color=colors[(col+row*3)%4];
   for(let j=0;j<=8;j++)for(const zz of [-.135,.135]){
    const a=j/8*PI;vv.push(Math.cos(a)*.075,.038+Math.sin(a)*.038,zz);cc.push(color.r,color.g,color.b);
   }
   for(let j=0;j<8;j++){const k=j*2;ii.push(k,k+2,k+1,k+1,k+2,k+3);}
   const tile=new THREE.BufferGeometry();tile.setAttribute('position',new THREE.Float32BufferAttribute(vv,3));tile.setAttribute('color',new THREE.Float32BufferAttribute(cc,3));tile.setIndex(ii);tile.computeVertexNormals();
   tile.translate(-w/2-.1+col*.145,.014*row,-d*.25+row*d*.125);
   slope.updateMatrix();tile.applyMatrix4(slope.matrix);tiles.push(tile);
  }
  for(const x of [-w/2-.15,w/2+.15])box(.055,.1,d*.61,M.navy,slope,x,.01,0);
  // Round decorated ends of the traditional eave tiles.
  for(let x=-w/2-.1;x<w/2+.16;x+=.145){const end=cyl(.056,.056,.035,M.navy,slope,x,.035,side*d*.285,10);end.rotation.x=PI/2;const ring=torus(.033,.006,mat('#9aafab'),slope,x,.035,side*(d*.285+.02));}
 }
 mesh(mergeGeometries(tiles),mat('#ffffff',{vertexColors:true,side:THREE.DoubleSide}),g);
 for(let x=-w/2-.2;x<w/2+.18;x+=.18){const cap=cyl(.095,.095,.2,M.navy,g,x,.53,0,12);cap.rotation.z=PI/2;}
 for(const x of [-w/2-.28,w/2+.28]){const cap=cyl(.115,.115,.06,M.navy,g,x,.54,0,12);cap.rotation.z=PI/2;const ring=torus(.07,.012,M.edge,g,x+Math.sign(x)*.04,.54,0);ring.rotation.y=PI/2;}
}

function oysterGeometry(){
 const vv=[0,0,.018],cc=[],ii=[],color=new THREE.Color('#d6d3b7');cc.push(color.r,color.g,color.b);
 const rings=7,sectors=28;
 for(let r=1;r<=rings;r++)for(let j=0;j<sectors;j++){
  const u=r/rings,a=j/sectors*PI*2,rough=1+Math.sin(a*7)*.08+Math.cos(a*11)*.04;
  vv.push(Math.cos(a)*.075*u*rough,Math.sin(a)*.13*u*rough,.02+Math.sin(u*PI)*.035+Math.cos(a*14)*.004*u);
  color.set(r%2?'#d5d4ba':'#94a899');cc.push(color.r,color.g,color.b);
  const k=1+(r-1)*sectors+j,next=1+(r-1)*sectors+(j+1)%sectors;
  if(r===1)ii.push(0,k,next);else{const prev=k-sectors,np=next-sectors;ii.push(prev,k,next,prev,next,np);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vv,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(cc,3));geo.setIndex(ii);geo.computeVertexNormals();return geo;
}

export function encrustedSeawall(){
 const oyster=oysterGeometry(),shellMaterial=mat('#ffffff',{vertexColors:true,side:THREE.DoubleSide});
 // Small overlapping shell colonies grow around the old high-water mark.
 for(let i=0;i<46;i++){
  const front=i%2===0,g=group(root,front?rand(-4.6,11.6):-4.92,rand(-1.65,-.12),front?4.915:rand(-10.8,4.5),front?PI:PI/2);
  g.rotation.z=rand(-.8,.8);
  for(let j=0;j<3;j++){const shell=mesh(oyster,shellMaterial,g,[rand(-.11,.11),rand(-.08,.08),j*.013]);shell.rotation.z=rand(-1.3,1.3);shell.scale.setScalar(rand(.65,1.25));}
  for(let j=0;j<3;j++){
   const x=rand(-.15,.15),y=rand(-.15,.15),r=rand(.025,.043);
   const cone=cyl(r*.62,r,r*.75,M.ivory,g,x,y,.025,7);cone.rotation.x=PI/2;
   const mouth=mesh(new THREE.CircleGeometry(r*.45,7),M.dark,g,[x,y,.026+r*.4]);
  }
 }
 const tide=tex((c,w,h)=>{
  c.clearRect(0,0,w,h);
  for(let i=0;i<950;i++){const x=rand(0,w),y=rand(0,h);c.fillStyle=`rgba(66,112,91,${rand(.025,.14)})`;c.fillRect(x,y,rand(1,7),rand(2,18));}
  for(let i=0;i<70;i++){c.fillStyle='rgba(61,105,90,.11)';c.fillRect(rand(0,w),h*.24,rand(2,8),rand(8,h*.52));}
 },1024,256);
 const material=new THREE.MeshBasicMaterial({map:tide,transparent:true,depthWrite:false,side:THREE.DoubleSide});
 mesh(new THREE.PlaneGeometry(16.7,1.15),material,root,[3.5,-.40,4.943]).rotation.y=PI;
 mesh(new THREE.PlaneGeometry(16.5,1.15),material,root,[-4.943,-.40,-3.5]).rotation.y=PI/2;
}
