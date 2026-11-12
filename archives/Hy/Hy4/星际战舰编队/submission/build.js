/* ============================================================
   build.js — procedural voxel geometry for 星际战舰编队
   Design language: 层片/空腔/分叉
     - stepped, receding "lamella" armour plates (层片)
     - dark recessed cavities between plates (空腔/深槽)
     - a forked prow with the beam cannon growing from the central cavity (分叉)
     - a single accent pair: warm amber (engines / weapon cores / seams)
       and cool cyan (shields / holograms / core energy)
   All solids share ONE voxel size (1 grid unit == 1 cube).
   Exposes window.BUILD with pure functions returning {data,count}.
   ============================================================ */
(function () {
'use strict';

/* ---------- deterministic RNG / noise ---------- */
function mulberry32(a){
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    var t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
function h3(i,j,k){
  var n=(i*374761393+j*668265263+k*1442695041)|0;
  n=(n^(n>>>13)); n=Math.imul(n,1274126177);
  return ((n^(n>>>16))>>>0)/4294967295;
}
function vnoise(x,y,z){
  var i=Math.floor(x),j=Math.floor(y),k=Math.floor(z);
  var fx=x-i,fy=y-j,fz=z-k;
  fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy); fz=fz*fz*(3-2*fz);
  function L(a,b,t){return a+(b-a)*t;}
  var c000=h3(i,j,k),c100=h3(i+1,j,k),c010=h3(i,j+1,k),c110=h3(i+1,j+1,k);
  var c001=h3(i,j,k+1),c101=h3(i+1,j,k+1),c011=h3(i,j+1,k+1),c111=h3(i+1,j+1,k+1);
  return L(L(L(c000,c100,fx),L(c010,c110,fx),fy), L(L(c001,c101,fx),L(c011,c111,fx),fy), fz);
}
function fbm3(x,y,z){
  var v=0,a=0.5;
  for(var o=0;o<4;o++){ v+=a*vnoise(x,y,z); x=x*2.03+11.1; y=y*2.03+7.7; z=z*2.03+3.3; a*=0.5; }
  return v;
}

/* ---------- palette ---------- */
var P={
  hull:[0.22,0.29,0.40],
  hullHi:[0.36,0.45,0.58],
  hullLo:[0.12,0.16,0.23],
  deep:[0.030,0.045,0.070],
  plate:[0.10,0.14,0.21],
  edge:[0.62,0.72,0.82],
  glowW:[1.00,0.58,0.18],
  glowC:[0.24,0.78,1.00],
  holo:[0.32,0.86,1.00],
  rock:[0.31,0.28,0.24],
  rockHi:[0.52,0.46,0.38],
  rockLo:[0.14,0.13,0.11],
};

/* ---------- VoxelSet ---------- */
function K(x,y,z){ return (x+8192)*268435456+(y+8192)*16384+(z+8192); }
function Vox(){ this.m=new Map(); }
Vox.prototype.set=function(x,y,z,c,emis,k){
  x=x|0;y=y|0;z=z|0;
  this.m.set(K(x,y,z),{x:x,y:y,z:z,c:c,e:emis||0,k:k||0});
};
Vox.prototype.has=function(x,y,z){ return this.m.has(K(x,y,z)); };
Vox.prototype.solid=function(x0,y0,z0,x1,y1,z1,c,emis,k,skip){
  for(var x=x0;x<=x1;x++)for(var y=y0;y<=y1;y++)for(var z=z0;z<=z1;z++){
    if(skip&&skip(x,y,z))continue;
    this.set(x,y,z,c,emis,k);
  }
};
Vox.prototype.shell=function(x0,y0,z0,x1,y1,z1,t,c,emis,k,skip){
  for(var x=x0;x<=x1;x++)for(var y=y0;y<=y1;y++)for(var z=z0;z<=z1;z++){
    if(!(x-x0<t||x1-x<t||y-y0<t||y1-y<t||z-z0<t||z1-z<t))continue;
    if(skip&&skip(x,y,z))continue;
    this.set(x,y,z,c,emis,k);
  }
};
/* rectangular ring in the Y-Z plane at a given x (funnel rims, frames) */
Vox.prototype.ringYZ=function(x,y0,y1,z0,z1,t,c,emis,k){
  this.solid(x,y0,z0, x,y0+t-1,z1, c,emis,k);
  this.solid(x,y1-t+1,z0, x,y1,z1, c,emis,k);
  this.solid(x,y0+t,z0, x,y1-t,z0+t-1, c,emis,k);
  this.solid(x,y0+t,z1-t+1, x,y1-t,z1, c,emis,k);
};
/* rectangular ring in the X-Z plane at a given y (walkway / platform ring) */
Vox.prototype.ringXZ=function(y,x0,x1,z0,z1,t,c,emis,k){
  this.solid(x0,y,z0, x1,y,z0+t-1, c,emis,k);
  this.solid(x0,y,z1-t+1, x1,y,z1, c,emis,k);
  this.solid(x0,y,z0+t, x0+t-1,y,z1-t, c,emis,k);
  this.solid(x1-t+1,y,z0+t, x1,y,z1-t, c,emis,k);
};
Vox.prototype.build=function(){
  var out=[]; var m=this.m;
  m.forEach(function(cell){
    var cnt=0,x=cell.x,y=cell.y,z=cell.z;
    if(m.has(K(x+1,y,z)))cnt++; if(m.has(K(x-1,y,z)))cnt++;
    if(m.has(K(x,y+1,z)))cnt++; if(m.has(K(x,y-1,z)))cnt++;
    if(m.has(K(x,y,z+1)))cnt++; if(m.has(K(x,y,z-1)))cnt++;
    var shade=0.50+0.52*(1-cnt/6);
    if(cell.e>0)shade=1.0;
    if(shade<0.42)shade=0.42; if(shade>1.0)shade=1.0;
    out.push(x,y,z, cell.c[0],cell.c[1],cell.c[2], cell.e, shade, cell.k, 0);
  });
  return {data:new Float32Array(out),count:m.size};
};
function fin(v){ return v.build(); }

/* small helpers */
function beamX(v,x0,x1,y,z,half,c,emis,k){
  v.solid(x0,y-half,z-half, x1,y+half,z+half, c,emis,k);
}
function beamZ(v,x,y,z0,z1,half,c,emis,k){
  v.solid(x-half,y-half,z0, x+half,y+half,z1, c,emis,k);
}
function beamY(v,x,y0,y1,z,half,c,emis,k){
  v.solid(x-half,y0,z-half, x+half,y1,z+half, c,emis,k);
}

/* ============================================================
   FLAGSHIP  (~208 grid units bow->stern, plus forward forks)
   local: bow +X, stern -X, up +Y, beam ±Z
   ============================================================ */
function turretTop(v,x,y,z){
  v.solid(x-4,y,z-4, x+4,y+2,z+4, P.plate,0,1);
  v.solid(x-2,y+2,z-2, x+2,y+8,z+2, P.hullHi,0,1);
  v.solid(x-2,y+8,z-2, x+2,y+9,z+2, P.glowW,1,0);
  v.solid(x-3,y+4,z-3, x+3,y+5,z+3, P.hullLo,0,1);
}
function turretSide(v,x,y,z,sgn){
  v.solid(x-4,y-4,z, x+4,y+4,z+sgn*2, P.plate,0,1);
  v.solid(x-2,y-2,z+sgn*2, x+2,y+2,z+sgn*9, P.hullHi,0,1);
  v.solid(x-2,y-2,z+sgn*9, x+2,y+2,z+sgn*10, P.glowW,1,0);
}
function nozzle(v,cy,cz,x0,R){
  for(var i=0;i<4;i++){
    var r=R-i*1.7; var x=x0+i*3;
    v.ringYZ(x, cy-r,cy+r, cz-r,cz+r, 1, (i%2?P.hullLo:P.plate),0,1);
  }
  v.solid(x0+12,cy-3,cz-3, x0+15,cy+3,cz+3, P.deep,0,0);
  v.solid(x0+13,cy-2,cz-2, x0+15,cy+2,cz+2, P.glowW,1,0);
  v.solid(x0+15,cy-1,cz-1, x0+16,cy+1,cz+1, [1.0,0.85,0.55],1,0);
}

var MUZZLES={
  main:[128,0,0],
  pulses:[],
  engines:[]
};

function flagship(){
  var v=new Vox();
  var segs=[
    [-104,-86,12,18],[-86,-56,15,23],[-56,-20,18,27],[-20,22,19,28],
    [22,56,17,25],[56,82,13,20],[82,100,9,14]
  ];
  // hangar mouth: a real opening on the +Z flank of the wide mid-body
  var hangarHole=function(x,y,z){ return x>-26&&x<26&&z>=24&&Math.abs(y)<9; };
  for(var s=0;s<segs.length;s++){
    var S=segs[s];
    v.shell(S[0],-S[2],-S[3], S[1],S[2],S[3], 1, P.hull,0,1,hangarHole);
    // dark recess band at the trailing edge of each step
    v.solid(S[1]-1,-S[2]+1,-S[3]+1, S[1],S[2]-1,S[3]-1, P.deep,0,0);
  }
  // stepped dorsal lamella plates along the spine
  var ridge=[14,16,18,19,19,17,13,9];
  for(var i=0;i<segs.length;i++){
    var S=segs[i], h=ridge[i];
    v.solid(S[0]+3,h-2,-9, S[1]-3,h,9, P.hullHi,0,1);          // raised plate
    v.solid(S[0]+6,h,-6, S[1]-6,h,6, P.plate,0,1);              // inset
    v.solid(S[0]+8,h+1,-4, S[0]+12,h+1,4, P.glowW,0.55,0);     // seam light
  }
  // ventral ribs / belly
  for(var x=-90;x<=80;x+=12){
    v.solid(x-1,-19,-20, x+1,-16,20, P.hullLo,0,1);
    v.solid(x,-19,-6, x,-17,6, P.deep,0,0);
  }
  // flank belts (secondary hue) with emissive seam lines between segments
  for(var i2=0;i2<segs.length-1;i2++){
    var jb=segs[i2][1];
    v.solid(jb-1,-segs[i2][2],segs[i2][3]-2, jb+1,segs[i2][2],segs[i2][3], P.plate,0,1);
    v.solid(jb,-segs[i2][2]+3,segs[i2][3]+1, jb,segs[i2][2]-3,segs[i2][3]+1, P.glowW,0.4,0);
  }
  // ---- forked prow ----
  v.solid(96,-7,-15, 118,7,-8, P.hull,0,1);
  v.solid(96,-7,8, 118,7,15, P.hull,0,1);
  v.solid(112,-8,-16, 126,8,-10, P.hullHi,0,1);
  v.solid(112,-8,10, 126,8,16, P.hullHi,0,1);
  v.solid(120,-6,-16, 128,6,-12, P.hullHi,0,1);  // fork tips
  v.solid(120,-6,12, 128,6,16, P.hullHi,0,1);
  // stepped prong faces
  for(var f=0;f<4;f++){
    var fx=100+f*6;
    v.solid(fx,-7-f,-15, fx+3,7+f,-14, P.edge,0,1);
    v.solid(fx,-7-f,14, fx+3,7+f,15, P.edge,0,1);
  }
  // inner prong glow slits
  v.solid(98,-2,-8, 124,2,-8, P.glowW,0.5,0);
  v.solid(98,-2,8, 124,2,8, P.glowW,0.5,0);

  // ---- main beam cannon (largest weapon) growing from central cavity ----
  v.shell(58,-11,-11, 84,11,11, 2, P.plate,0,1);          // wide base
  v.solid(62,-12,-12, 80,12,12, P.hullLo,0,1);            // base collar
  v.solid(84,-8,-8, 104,8,8, P.hull,0,1);                 // barrel sec 1
  v.solid(104,-6,-6, 118,6,6, P.hullHi,0,1);              // barrel sec 2
  v.solid(118,-5,-5, 126,5,5, P.plate,0,1);               // muzzle collar
  v.ringYZ(126,-6,6,-6,6,1,P.hullHi,0,1);
  v.solid(124,-3,-3, 127,3,3, P.glowC,1,0);               // bright emission mouth
  v.solid(126,-4,-4, 128,4,4, [0.7,0.9,1.0],0.9,0);
  // glowing slots running along the barrel
  for(var bx=86;bx<118;bx+=6){
    v.solid(bx,8,-2, bx+3,9,2, P.glowW,0.8,0);
    v.solid(bx,-9,-2, bx+3,-8,2, P.glowW,0.8,0);
    v.solid(bx,-2,8, bx+3,2,9, P.glowW,0.8,0);
    v.solid(bx,-2,-9, bx+3,2,-8, P.glowW,0.8,0);
  }
  // base illumination ring
  v.ringYZ(60,-12,12,-12,12,1,P.glowW,0.5,0);

  // ---- pulse turrets along upper hull & flanks ----
  MUZZLES.pulses=[];
  var tx=[-70,-46,-22,2,26,50,74];
  for(var i3=0;i3<tx.length;i3++){
    var x3=tx[i3]; var hh=ridge[Math.min(6,Math.floor((x3+104)/30))];
    turretTop(v,x3,hh+1,0);
    MUZZLES.pulses.push([x3,hh+10,0]);
  }
  var sx=[-60,-20,20,60];
  for(var i4=0;i4<sx.length;i4++){
    turretSide(v,sx[i4],4,26,1);  MUZZLES.pulses.push([sx[i4],4,36]);
    turretSide(v,sx[i4],4,-26,-1); MUZZLES.pulses.push([sx[i4],4,-36]);
  }

  // ---- engine section: nested receding nozzles ----
  MUZZLES.engines=[];
  v.ringYZ(-104,-14,14,-22,22, 3, P.hullLo,0,1);    // open stern frame
  var nz=[[0,0,9],[10,10,6],[10,-10,6],[-10,10,6],[-10,-10,6]];
  for(var n=0;n<nz.length;n++){
    nozzle(v,nz[n][0],nz[n][1],-112,nz[n][2]);
    MUZZLES.engines.push([-114,nz[n][0],nz[n][1]]);
  }
  // glowing stern seams between the nozzle cluster and the hull
  for(var e=-16;e<=16;e+=8){
    v.solid(-104,e,-22, -101,e+1,-21, P.glowW,0.45,0);
    v.solid(-104,e,21, -101,e+1,22, P.glowW,0.45,0);
  }

  // ---- hangar mouth recess + frame ----
  v.solid(-26,-9,17, 26,9,18, P.deep,0,0);            // dark back wall inside
  v.solid(-28,9,18, 28,10,28, P.hullHi,0,1);          // top lintel
  v.solid(-28,-10,18, 28,-9,28, P.hullHi,0,1);        // bottom sill
  v.solid(-28,-9,24, -26,9,28, P.edge,0,1);
  v.solid(26,-9,24, 28,9,28, P.edge,0,1);
  v.solid(-24,9,26, 24,9,26, P.glowC,0.85,0);         // guide light
  v.solid(-24,-9,26, 24,-9,26, P.glowC,0.5,0);
  // a couple of docked craft silhouettes deep inside
  v.solid(-14,-3,19, -8,2,21, P.hullHi,0,1);
  v.solid(8,-3,19, 14,2,21, P.hullHi,0,1);

  return fin(v);
}

/* ============================================================
   ESCORT — 近卫舰 (compact, thick)  /  前卫舰 (extended)
   ============================================================ */
function nearGuard(){
  var v=new Vox();
  v.shell(-24,-9,-11, 24,9,11, 1, P.hull,0,1);
  v.solid(-18,9,-7, 12,11,7, P.hullHi,0,1);
  v.solid(-18,-11,-7, 12,-9,7, P.hullLo,0,1);
  v.solid(-8,-3,11, 12,3,18, P.plate,0,1);       // +Z stub wing (fork motif)
  v.solid(-8,-3,-18, 12,3,-11, P.plate,0,1);     // -Z stub wing
  v.solid(-6,11,-4, 6,13,4, P.plate,0,1);        // dorsal lamella
  v.solid(-4,13,-2, 4,13,2, P.glowW,0.5,0);
  // forked prow
  v.solid(20,-5,-10, 30,5,-5, P.hullHi,0,1);
  v.solid(20,-5,5, 30,5,10, P.hullHi,0,1);
  v.solid(28,-3,-10, 33,3,-7, P.edge,0,1);
  v.solid(28,-3,7, 33,3,10, P.edge,0,1);
  // dense rapid-fire point-defence mounts
  var mounts=[[-14,11,0],[-2,11,0],[10,11,0],[-10,-11,0],[6,-11,0],[-6,3,18],[4,3,18],[-6,3,-18],[4,3,-18]];
  for(var i=0;i<mounts.length;i++){
    var m=mounts[i];
    v.solid(m[0]-2,m[1]-1,m[2]-2, m[0]+2,m[1]+1,m[2]+2, P.plate,0,1);
    if(Math.abs(m[1])>5){
      var s=m[1]>0?1:-1;
      v.solid(m[0]-1,m[1],m[2]-1, m[0]+1,m[1]+s*5,m[2]+1, P.hullHi,0,1);
      v.solid(m[0]-1,m[1]+s*5,m[2]-1, m[0]+1,m[1]+s*6,m[2]+1, P.glowW,1,0);
    } else {
      var sz=m[2]>0?1:-1;
      v.solid(m[0]-1,m[1]-1,m[2], m[0]+1,m[1]+1,m[2]+sz*5, P.hullHi,0,1);
      v.solid(m[0]-1,m[1]-1,m[2]+sz*5, m[0]+1,m[1]+1,m[2]+sz*6, P.glowW,1,0);
    }
  }
  // stern + twin engines
  v.solid(-24,-9,-9, -21,9,9, P.hullLo,0,1);
  for(var e=0;e<2;e++){
    var cz=e?6:-6;
    v.ringYZ(-28,-5,5,cz-5,cz+5,1,P.plate,0,1);
    v.ringYZ(-31,-4,4,cz-4,cz+4,1,P.hullLo,0,1);
    v.solid(-33,-3,cz-3, -30,3,cz+3, P.glowW,1,0);
  }
  return fin(v);
}
function vanguard(){
  var v=new Vox();
  v.shell(-30,-7,-9, 30,7,9, 1, P.hull,0,1);
  v.solid(-24,7,-6, 22,9,6, P.hullHi,0,1);
  v.solid(-24,-9,-6, 22,-7,6, P.hullLo,0,1);
  // directional missile slot rows on both flanks
  for(var i=0;i<7;i++){
    var x=-22+i*7;
    for(var sgn=-1;sgn<=1;sgn+=2){
      v.solid(x,-6,9*sgn, x+4,6,13*sgn, P.plate,0,1);
      v.solid(x+1,-3,13*sgn, x+3,3,14*sgn, P.deep,0,0);
      v.solid(x+1,-1,14*sgn, x+3,1,14*sgn, P.glowW,0.5,0);  // missile tip / slot light
    }
  }
  // stepped lamella spine
  for(var j=0;j<5;j++){
    var xx=-20+j*10;
    v.solid(xx,9,-4, xx+6,10,4, P.plate,0,1);
    v.solid(xx+1,10,-2, xx+4,10,2, P.glowW,0.45,0);
  }
  // long forked prow
  v.solid(26,-4,-8, 40,4,-4, P.hullHi,0,1);
  v.solid(26,-4,4, 40,4,8, P.hullHi,0,1);
  v.solid(38,-2,-8, 44,2,-6, P.edge,0,1);
  v.solid(38,-2,6, 44,2,8, P.edge,0,1);
  // engines (three, receding)
  v.solid(-30,-7,-8, -27,7,8, P.hullLo,0,1);
  for(var e2=-1;e2<=1;e2++){
    var cz2=e2*5;
    v.ringYZ(-34,-4,4,cz2-4,cz2+4,1,P.plate,0,1);
    v.solid(-37,-2,cz2-2, -34,2,cz2+2, P.glowW,1,0);
  }
  return fin(v);
}
/* small craft (~1/30 flagship) */
function craft(){
  var v=new Vox();
  v.solid(-4,-1,-1, 3,1,1, P.hullHi,0,1);
  v.solid(-2,1,0, 1,2,0, P.plate,0,1);
  v.solid(3,-1,-2, 6,1,-1, P.hull,0,1);      // forked nose
  v.solid(3,-1,1, 6,1,2, P.hull,0,1);
  v.solid(5,0,-2, 6,0,-1, P.glowC,0.8,0);
  v.solid(5,0,1, 6,0,2, P.glowC,0.8,0);
  v.solid(-5,-1,-2, -4,1,-1, P.plate,0,1);   // fins
  v.solid(-5,-1,1, -4,1,2, P.plate,0,1);
  v.solid(-5,-1,-1, -4,1,1, P.glowW,1,0);    // nozzle
  return fin(v);
}

/* ============================================================
   ASTEROIDS — shared voxel medium, shatterable into fragments
   ============================================================ */
function buildAsteroid(seed,R,nFrag){
  var rnd=mulberry32(seed*7919+13);
  var cells=[];
  var voids=[];
  for(var q=0;q<3;q++) voids.push([(rnd()-0.5)*R*1.2,(rnd()-0.5)*R*1.2,(rnd()-0.5)*R*1.2, R*(0.16+0.2*rnd())]);
  var bump=[(rnd()-0.5)*R*0.5,(rnd()-0.5)*R*0.5,(rnd()-0.5)*R*0.5];
  for(var x=-R;x<=R;x++)for(var y=-R;y<=R;y++)for(var z=-R;z<=R;z++){
    var d=Math.sqrt((x+bump[0])*(x+bump[0])+(y+bump[1])*(y+bump[1])+(z+bump[2])*(z+bump[2]))/R;
    var n=fbm3(x*0.16+seed*3.1,y*0.16+seed*1.7,z*0.16+seed*2.3);
    var thr=0.62+(n-0.5)*1.05;
    if(d>thr)continue;
    var hole=false;
    for(var w=0;w<voids.length;w++){
      var V=voids[w];
      var dd=(x-V[0])*(x-V[0])+(y-V[1])*(y-V[1])+(z-V[2])*(z-V[2]);
      if(dd<V[3]*V[3]){hole=true;break;}
    }
    if(hole)continue;
    var lit=fbm3(x*0.5+9,y*0.5+3,z*0.5+5);
    var col=lit>0.62?P.rockHi:(lit<0.36?P.rockLo:P.rock);
    // bright fracture veins
    var emis=(fbm3(x*0.33+21,y*0.33+7,z*0.33+13)>0.78)?0.16:0;
    cells.push({x:x,y:y,z:z,c:col,e:emis,k:0});
  }
  // partition into fragments by nearest random centre
  var centres=[];
  for(var f=0;f<nFrag;f++) centres.push([(rnd()-0.5)*R*1.1,(rnd()-0.5)*R*1.1,(rnd()-0.5)*R*1.1]);
  var groups=[];
  for(var g=0;g<nFrag;g++)groups.push([]);
  for(var ci=0;ci<cells.length;ci++){
    var c=cells[ci],best=0,bd=1e9;
    for(var f2=0;f2<nFrag;f2++){
      var C=centres[f2];
      var dd2=(c.x-C[0])*(c.x-C[0])+(c.y-C[1])*(c.y-C[1])+(c.z-C[2])*(c.z-C[2]);
      if(dd2<bd){bd=dd2;best=f2;}
    }
    groups[best].push(c);
  }
  var frags=[];
  for(var g2=0;g2<nFrag;g2++){
    var G=groups[g2]; if(!G.length)continue;
    var cx=0,cy=0,cz=0;
    for(var a=0;a<G.length;a++){cx+=G[a].x;cy+=G[a].y;cz+=G[a].z;}
    cx/=G.length;cy/=G.length;cz/=G.length;
    var vv=new Vox();
    for(var b=0;b<G.length;b++){
      var cc=G[b];
      vv.set(Math.round(cc.x-cx),Math.round(cc.y-cy),Math.round(cc.z-cz),cc.c,cc.e,cc.k);
    }
    var C2=centres[g2];
    var vel=[ (C2[0])*0.06+(rnd()-0.5)*0.8,(C2[1])*0.06+(rnd()-0.5)*0.8,(C2[2])*0.06+(rnd()-0.5)*0.8];
    var spin=[(rnd()-0.5)*1.6,(rnd()-0.5)*1.6,(rnd()-0.5)*1.6];
    frags.push({proto:fin(vv),centroid:[cx,cy,cz],vel:vel,spin:spin,phase:rnd()*6.28});
  }
  return frags;
}

/* ============================================================
   INTERIOR 1 — 舰桥 (bridge): ~130 wide/deep, ~60 high
   local: +X forward (panoramic window), +Y up, ±Z side layers
   ============================================================ */
function bridge(){
  var v=new Vox();
  // floor: longitudinal strips with dark gaps + guide lights
  for(var z=-62;z<=62;z+=8){
    v.solid(-62,0,z, 70,0,z+3, (Math.abs(z)%16===0)?P.plate:P.hullLo,0,1);
  }
  for(var gx=-60;gx<=68;gx+=10) v.solid(gx,1,-1, gx+4,1,1, P.glowC,0.55,0);
  // side walls with layered panels + emissive strips
  for(var sgn=-1;sgn<=1;sgn+=2){
    var wz=62*sgn;
    v.solid(-62,1,wz, 70,52,wz+2*sgn, P.plate,0,1);
    for(var px=-56;px<=64;px+=14){
      v.solid(px,6,wz-sgn*2, px+9,30,wz-sgn, P.hullLo,0,1);
      v.solid(px+1,10,wz-sgn*3, px+8,11,wz-sgn*2, P.glowC,0.6,0);
      v.solid(px+1,14,wz-sgn*3, px+8,15,wz-sgn*2, P.holo,0.4,0);
    }
  }
  // ceiling spanning beams + hanging light strips
  for(var bx=-60;bx<=68;bx+=16){
    v.solid(bx,54,-62, bx+2,57,62, P.hullLo,0,1);
    v.solid(bx,53,-40, bx+1,53,40, P.glowC,0.35,0);
  }
  // console rows on side platforms (receding into depth)
  for(var s2=-1;s2<=1;s2+=2)for(var row=0;row<2;row++){
    var cz=(26+row*18)*s2; var cy=6+row*9;
    v.solid(-56,cy-1,cz-6, 60,cy-1,cz+6, P.plate,0,1);   // platform
    for(var cx=-50;cx<=54;cx+=18){
      v.solid(cx,cy,cz-4, cx+8,cy+2,cz+4, P.hullLo,0,1);
      v.solid(cx+2,cy+2,cz-2, cx+6,cy+2,cz+1, P.glowC,0.4,0);   // small glowing interface
      v.solid(cx+3,cy+3,cz-1, cx+5,cy+3,cz, P.holo,0.18,0);      // small floating display
    }
  }
  // hanging display boards above
  for(var d=0;d<4;d++){
    var dx=-40+d*26;
    v.solid(dx,36,-14, dx+14,37,14, P.plate,0,1);
    for(var ly=0;ly<5;ly++) v.solid(dx+2,37, -12+ly*5, dx+12,37,-11+ly*5, P.holo,0.2,0);
  }
  // central command hub: layered ziggurat base + floating displays
  for(var L=0;L<4;L++){
    var r=18-L*3;
    v.solid(-r,L*2,-r, r,L*2+1,r, (L%2)?P.hullLo:P.plate,0,1);
    v.solid(-r+2,L*2+2,-r+2, r-2,L*2+2,r-2, P.deep,0,0);
  }
  // hub display pedestal + a low projection plinth. The simplified fleet graphic
  // above it is drawn as MOVING light points / course lines in the FX layer,
  // not as static solid cubes (which read as floating white blocks up close).
  v.solid(-3,8,-3, 3,16,3, P.hullHi,0,1);
  v.solid(-8,16,-1, 8,17,1, P.glowC,0.6,0);
  v.solid(-10,18,-8, 10,18,8, P.plate,0,1);
  v.solid(-8,19,-6, 8,19,6, P.deep,0,0);
  // panoramic window: a THIN DARK frame; the wide open middle shows space & fleet.
  // (thick bright hull blocks here read as floating white cubes from inside the hall)
  v.solid(68,0,-64, 69,60,-62, P.hullLo,0,1);
  v.solid(68,0,62, 69,60,64, P.hullLo,0,1);
  v.solid(68,57,-64, 69,60,64, P.hullLo,0,1);
  v.solid(68,0,-64, 69,3,64, P.hullLo,0,1);
  v.solid(69,3,-62, 69,57,-62, P.edge,0,1);      // thin bright inner edges
  v.solid(69,3,62, 69,57,62, P.edge,0,1);
  v.solid(69,56,-62, 69,56,62, P.edge,0,1);
  for(var wz2=-48;wz2<=48;wz2+=24) v.solid(69,3,wz2, 69,57,wz2+1, P.plate,0,1);
  v.solid(69,3,-60, 69,3,60, P.glowC,0.35,0);
  return fin(v);
}

/* ============================================================
   INTERIOR 2 — 动力核心中庭 (power core atrium): ~250 tall
   ============================================================ */
function coreAtrium(){
  var v=new Vox();
  var H=240;
  // enclosing walls (far, receding into dark)
  for(var sgn=-1;sgn<=1;sgn+=2){
    v.solid(-120,0,118*sgn, 120,H,120*sgn, P.plate,0,1);
    for(var wy=20;wy<H;wy+=40){
      v.solid(-120,wy,116*sgn, 120,wy+2,118*sgn, P.hullLo,0,1);
      v.solid(-120,wy+3,116*sgn, 120,wy+3,118*sgn, P.glowC,0.30,0);
    }
  }
  // floor & ceiling
  for(var fz=-118;fz<=118;fz+=10){
    v.solid(-120,0,fz, 120,0,fz+4, P.hullLo,0,1);
    v.solid(-120,H,fz, 120,H,fz+4, P.plate,0,1);
  }
  // multi-level ring platforms (wide gap around the core)
  for(var lv=0;lv<6;lv++){
    var y=18+lv*40;
    v.ringXZ(y, -110,110, -110,110, 3, P.hullLo,0,1);
    v.ringXZ(y+1, -70,70, -70,70, 2, P.plate,0,1);
    // glowing platform edge
    for(var q=-70;q<=70;q+=10){ v.solid(q,y+2,-70, q+4,y+2,-70, P.glowC,0.5,0); v.solid(q,y+2,70, q+4,y+2,70, P.glowC,0.5,0); }
    // radial supports from wall toward core
    for(var a=0;a<8;a++){
      var ang=a*Math.PI/4;
      var x0=Math.round(Math.cos(ang)*100), z0=Math.round(Math.sin(ang)*100);
      var x1=Math.round(Math.cos(ang)*26), z1=Math.round(Math.sin(ang)*26);
      var steps=24;
      for(var st=0;st<=steps;st++){
        var t=st/steps;
        var xx=Math.round(x0+(x1-x0)*t), zz=Math.round(z0+(z1-z0)*t);
        v.solid(xx-2,y+2,zz-2, xx+2,y+5,zz+2, P.hullLo,0,1);
      }
    }
  }
  // central core: voxel outer frame + glowing inner column
  for(var cy=0;cy<H;cy+=6){
    var rr=20+6*Math.sin(cy*0.05);
    v.ringXZ(cy, -rr,rr, -rr,rr, 2, P.plate,0,1);
  }
  // vertical core struts
  for(var sx2=-14;sx2<=14;sx2+=7)for(var sz2=-14;sz2<=14;sz2+=7){
    if(Math.abs(sx2)<8&&Math.abs(sz2)<8)continue;
    v.solid(sx2,0,sz2, sx2,H,sz2, P.hullHi,0,1);
  }
  // glowing inner core (emissive column + bands)
  for(var gy=0;gy<H;gy+=3){
    v.solid(-6,gy,-6, 6,gy+1,6, P.glowC, (gy%12<6)?0.9:0.45,0);
  }
  for(var band=0;band<8;band++){
    var by=12+band*30;
    v.ringXZ(by, -18,18, -18,18, 2, [0.5,0.9,1.0], 0.8,0);
  }
  return fin(v);
}
/* rotating rings for the core (drawn as separate prototypes with rotation) */
function coreRing(){
  var v=new Vox();
  var R=34;
  for(var a=0;a<48;a++){
    var ang=a/48*Math.PI*2;
    var x=Math.round(Math.cos(ang)*R), z=Math.round(Math.sin(ang)*R);
    v.solid(x-2,-2,z-2, x+2,2,z+2, (a%6<3)?P.hullHi:P.plate,0,1);
  }
  for(var b=0;b<8;b++){
    var an=b/8*Math.PI*2;
    var x2=Math.round(Math.cos(an)*R), z2=Math.round(Math.sin(an)*R);
    v.solid(x2-3,-3,z2-3, x2+3,3,z2+3, P.glowC,0.6,0);
  }
  return fin(v);
}

/* ============================================================
   INTERIOR 3 — 贯通式机库 (through hangar)
   ============================================================ */
function hangar(){
  var v=new Vox();
  var X0=-120,X1=120;
  // floor with converging guide lights
  for(var z=-56;z<=56;z+=8) v.solid(X0,0,z, X1,0,z+3, (Math.abs(z)%16===0)?P.plate:P.hullLo,0,1);
  for(var gx=X0;gx<=X1;gx+=10){ v.solid(gx,1,-1, gx+4,1,1, P.glowC,0.45,0); }
  // ceiling (dark, with beams +局部发亮的内壁)
  for(var cz=-56;cz<=56;cz+=10) v.solid(X0,46,cz, X1,46,cz+4, P.plate,0,1);
  // berth alcoves along BOTH sides, repeating in depth
  for(var sgn=-1;sgn<=1;sgn+=2)for(var bx=X0+12;bx<=X1-12;bx+=22){
    var zOuter=52*sgn, zInner=42*sgn;
    var zlo=Math.min(zOuter,zInner), zhi=Math.max(zOuter,zInner);
    var zFace=zInner;                 // edge toward the central aisle
    v.solid(bx-8,0,zlo, bx+8,20,zhi, P.plate,0,1);          // alcove walls
    v.solid(bx-8,0,zlo, bx+8,0,zhi, P.hullLo,0,1);          // floor pad
    v.solid(bx-7,2,zlo+1, bx+7,2,zhi-1, P.deep,0,0);        // recessed berth
    v.solid(bx-6,3,zFace, bx+6,3,zFace, P.glowC,0.45,0);    // guide light along the opening
    v.solid(bx-8,18,zlo, bx+8,20,zhi, P.hullHi,0,1);         // lintel
    v.solid(bx-8,20,zlo, bx+8,20,zhi, P.glowW,0.35,0);
    // a small docked craft resting in the bay (scale reference)
    v.solid(bx-5,4,zlo+2, bx+3,7,zhi-2, P.hullHi,0,1);
    v.solid(bx+3,5,zlo+3, bx+6,6,zhi-3, P.glowC,0.5,0);    // nose light
    v.solid(bx-6,5,zlo+3, bx-5,6,zhi-3, P.glowW,0.5,0);    // engine light
  }
  // cross-hangar bridge trusses
  for(var tx=X0+8;tx<=X1-8;tx+=30){
    v.solid(tx,34,-56, tx+3,37,56, P.hullLo,0,1);
    v.solid(tx,30,-56, tx+3,34,-52, P.plate,0,1);
    v.solid(tx,30,52, tx+3,34,56, P.plate,0,1);
    for(var hz=-40;hz<=40;hz+=10) v.solid(tx+1,33,hz, tx+2,34,hz+1, P.glowC,0.5,0);
  }
  // abstract maintenance frames (angular, not humanoid)
  for(var mx=X0+30;mx<=X1-30;mx+=44){
    v.solid(mx,0,-22, mx+2,16,-22, P.hullLo,0,1);
    v.solid(mx,16,-22, mx+2,18,-6, P.hullLo,0,1);
    v.solid(mx,0,-22, mx+10,2,-20, P.plate,0,1);
    v.solid(mx+8,2,-20, mx+10,10,-20, P.hullHi,0,1);
    v.solid(mx+8,10,-20, mx+10,11,-12, P.glowW,0.6,0);
  }
  // deep second hatch at the far end + light
  v.solid(X1-4,0,-56, X1,46,-40, P.plate,0,1);
  v.solid(X1-4,0,40, X1,46,56, P.plate,0,1);
  v.solid(X1-4,40,-40, X1,46,40, P.plate,0,1);
  v.solid(X1-4,0,-40, X1,2,40, P.plate,0,1);
  v.solid(X1-2,6,-30, X1-2,34,30, P.glowC,0.35,0);
  // near entrance frame (open mouth toward space)
  v.solid(X0,0,-56, X0+4,46,-42, P.hullHi,0,1);
  v.solid(X0,0,42, X0+4,46,56, P.hullHi,0,1);
  v.solid(X0,40,-56, X0+4,46,56, P.hullHi,0,1);
  v.solid(X0+2,2,-54, X0+2,2,54, P.glowC,0.5,0);
  return fin(v);
}

/* ============================================================
   INTERIOR 4 — 能量装填与导能长廊 (energy corridor)
   ============================================================ */
function energyCorridor(){
  var v=new Vox();
  var X0=-180,X1=180;
  // floor & ceiling with guide lines
  for(var z=-46;z<=46;z+=8){
    v.solid(X0,0,z, X1,0,z+3, P.hullLo,0,1);
    v.solid(X0,66,z, X1,66,z+3, P.plate,0,1);
  }
  for(var g=X0;g<=X1;g+=12){
    v.solid(g,1,-1, g+5,1,1, P.glowW,0.28,0);
    v.solid(g,65,-1, g+5,65,1, P.glowW,0.20,0);
  }
  // repeating tall loading devices along BOTH flanks (open frames + bright slots)
  for(var sgn=-1;sgn<=1;sgn+=2){
    var zA=Math.min(30*sgn,44*sgn), zB=Math.max(30*sgn,44*sgn);
    var zFace=30*sgn, zIn=zFace-sgn*2;
    for(var dx=X0+16;dx<=X1-16;dx+=28){
      v.solid(dx-9,0,zA, dx-6,52,zB, P.plate,0,1);          // pillar
      v.solid(dx+6,0,zA, dx+9,52,zB, P.plate,0,1);          // pillar
      v.solid(dx-9,48,zA, dx+9,52,zB, P.hullHi,0,1);        // top cap
      v.solid(dx-9,0,zA, dx+9,3,zB, P.hullHi,0,1);          // base
      for(var col=0;col<3;col++){
        var cx=dx-5+col*5;
        v.solid(cx,6,zFace, cx+2,44,zFace, P.hullLo,0,1);   // slot column
        v.solid(cx,10,zIn, cx+1,40,zIn, P.glowW,0.45,0);    // inner bright core
      }
      v.solid(dx-8,53,zFace, dx+8,53,zFace, P.glowW,0.25,0);
    }
  }
  // big cross frames receding into depth (dark, with a thin light line)
  for(var fx=X0+10;fx<=X1-10;fx+=30){
    v.ringYZ(fx,0,66,-46,46, 3, P.hullLo,0,1);
    v.solid(fx,32,-24, fx+2,33,24, P.glowW,0.20,0);
  }
  // suspended导能构件 above the central gap
  for(var sx3=X0+24;sx3<=X1-24;sx3+=44){
    v.solid(sx3,46,-8, sx3+14,49,8, P.plate,0,1);
    v.solid(sx3+2,45,-5, sx3+12,45,5, P.glowC,0.3,0);
    v.solid(sx3+5,42,-3, sx3+9,46,3, P.hullHi,0,1);
  }
  // far wide glowing chamber mouth
  v.ringYZ(X1-2,0,66,-46,46, 3, P.plate,0,1);
  v.solid(X1-2,8,-26, X1-2,50,26, P.glowW,0.32,0);
  v.solid(X1-2,26,-20, X1-2,34,20, [1.0,0.85,0.5],0.7,0);
  return fin(v);
}

/* ============================================================
   FLEET FORMATION — ~38 ships, front/mid/rear groups, staggered height
   ============================================================ */
function fleet(){
  var rnd=mulberry32(20261110);
  var ships=[];
  var idx=0;
  function add(type,x,y,z,yaw,pitch,tier,scale){
    ships.push({type:type,base:[x,y,z],yaw:yaw||0,pitch:pitch||0,scale:scale||1,tier:tier,idx:idx++});
  }
  add('flag',0,0,0,0,0,1,1);
  // near guards: two sides / behind / different heights (compact ring)
  var ng=[
    [-70,18,62],[-30,-14,72],[30,20,68],[72,-10,64],
    [-60,26,-66],[-20,-22,-70],[24,24,-68],[64,-18,-60],
    [-96,8,34],[96,14,-30],[-40,38,44],[44,-34,-44]
  ];
  for(var i=0;i<ng.length;i++){
    var N=ng[i];
    add('near',N[0],N[1],N[2],(rnd()-0.5)*0.18,(rnd()-0.5)*0.10,1,0.55);
  }
  // vanguards: ahead (+X) and outer, spread wide & staggered
  for(var row=0;row<2;row++){
    for(var k=0;k<6;k++){
      var x=100+row*70+(rnd()-0.5)*30;
      var z=(k-2.5)*46+(rnd()-0.5)*20;
      var y=(rnd()-0.5)*46;
      add('vanguard',x,y,z,(rnd()-0.5)*0.14,(rnd()-0.5)*0.08,2,0.55);
    }
  }
  // rear / outer columns continuing into the background
  for(var col=0;col<2;col++)for(var k2=0;k2<5;k2++){
    var xr=-165-col*80+(rnd()-0.5)*40;
    var zr=(k2-2)*60+(rnd()-0.5)*20;
    var yr=(rnd()-0.5)*40;
    add('vanguard',xr,yr,zr,(rnd()-0.5)*0.12,0,3,0.5);
  }
  return ships;
}

/* small craft flight paths (used by main.js for hangar / exterior) */
function craftPaths(){ return []; }

/* muzzle / emitter metadata exported for main.js */
var MUZZLE_META={
  main:[128,0,0],
  pulses:MUZZLES.pulses,
  engines:MUZZLES.engines
};

window.BUILD={
  P:P, rng:mulberry32,
  flagship:flagship, nearGuard:nearGuard, vanguard:vanguard, craft:craft,
  asteroid:buildAsteroid,
  bridge:bridge, coreAtrium:coreAtrium, coreRing:coreRing,
  hangar:hangar, energyCorridor:energyCorridor,
  fleet:fleet, muzzles:MUZZLE_META,
  fin:fin
};
})();
