/* ============================================================
   main.js — global timeline, camera program, FX, export, autoplay
   Everything in renderAt(t) is a PURE function of global time t,
   so begin/frame/end export is fully deterministic.
   ============================================================ */
(function () {
'use strict';

var DURATION=78;
var SHOTS=[
  {id:'approach',t0:0,  t1:16},
  {id:'bridge',  t0:16, t1:25},
  {id:'core',    t0:25, t1:34},
  {id:'hangar',  t0:34, t1:42},
  {id:'corridor',t0:42, t1:49},
  {id:'battle',  t0:49, t1:65},
  {id:'finale',  t0:65, t1:78}
];
var EXTERIOR={approach:1,battle:1,finale:1};

/* ---------- scalar helpers ---------- */
function clamp(x,a,b){return x<a?a:(x>b?b:x);}
function smoothstep(a,b,x){var t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
function lerp(a,b,f){return a+(b-a)*f;}
function lerp3(a,b,f){return [lerp(a[0],b[0],f),lerp(a[1],b[1],f),lerp(a[2],b[2],f)];}
function wave(t,k,ph){return Math.sin(2*Math.PI*k*t/DURATION+ph);}
function bump(t,a,b){ if(t<=a||t>=b)return 0; var u=(t-a)/(b-a); return 0.5-0.5*Math.cos(2*Math.PI*u); }
function bumpInt(t,a,b){
  if(t<=a)return 0;
  if(t>=b)return (b-a)*0.5;
  var u=(t-a)/(b-a);
  return (b-a)*(0.5*u-Math.sin(2*Math.PI*u)/(4*Math.PI));
}
function wrap(x,P){return ((x+P/2)%P+P)%P-P/2;}
function applyM4(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}

/* ---------- forward motion (periodic, seamless loop) ---------- */
var V0=12,K=3.5,TA=54;
var PERIOD=V0*(DURATION+K*(DURATION-TA)*0.5);
function drift(t){return V0*t+V0*K*bumpInt(t,TA,DURATION);}
function thrust(t){return 0.55+0.85*bump(t,54,78)+0.30*bump(t,64,78);}

/* ---------- boot ---------- */
var canvas=document.getElementById('c');
var errBox=document.getElementById('err');
try{
  if(!GFX.init(canvas)) throw new Error('WebGL2 不可用');
}catch(e){ errBox.textContent='初始化失败: '+e.message+'\n'+e.stack; return; }

function mk(fn){var b=fn();return GFX.makeVoxProto(b.data,b.count);}
var PROTO={
  flag:mk(BUILD.flagship),
  near:mk(BUILD.nearGuard),
  vanguard:mk(BUILD.vanguard),
  craft:mk(BUILD.craft),
  bridge:mk(BUILD.bridge),
  core:mk(BUILD.coreAtrium),
  ring:mk(BUILD.coreRing),
  hangar:mk(BUILD.hangar),
  corridor:mk(BUILD.energyCorridor)
};
var MZ=BUILD.muzzles;           // populated by BUILD.flagship()
var SHIPS=BUILD.fleet();

/* ---------- asteroids ---------- */
var HERO_DEFS=[
  {pos:[300,10,120],R:20,seed:11},
  {pos:[365,-22,185],R:17,seed:22},
  {pos:[268,28,214],R:19,seed:33},
  {pos:[412,14,86], R:15,seed:44},
  {pos:[330,-12,262],R:23,seed:55},
  {pos:[238,32,158],R:13,seed:66},
  {pos:[470,20,150],R:18,seed:77},
  {pos:[210,-30,240],R:14,seed:88}
];
var ASTEROIDS=[];
for(var h=0;h<HERO_DEFS.length;h++){
  var D=HERO_DEFS[h];
  var frags=BUILD.asteroid(D.seed,D.R,9);
  var out=[];
  for(var f=0;f<frags.length;f++){
    var F=frags[f];
    out.push({proto:GFX.makeVoxProto(F.proto.data,F.proto.count),centroid:F.centroid,vel:F.vel,spin:F.spin,phase:F.phase});
  }
  ASTEROIDS.push({pos:D.pos,frags:out});
}
/* small background rocks (single intact voxel rock) */
var rnd=BUILD.rng(99173);
var SMALL=[];
for(var s=0;s<22;s++){
  var R=5+Math.floor(rnd()*5);
  var fr=BUILD.asteroid(900+s,R,1);
  if(!fr.length)continue;
  SMALL.push({pos:[(rnd()-0.5)*900, (rnd()-0.5)*220, (rnd()-0.5)*700],proto:GFX.makeVoxProto(fr[0].proto.data,fr[0].proto.count)});
}
/* shatter rises during the attack and settles back to zero at the loop
   boundary, so the whole timeline (and especially the loop join) is
   perfectly continuous in global time. */
function shatter(t){return smoothstep(53.4,58.5,t)*(1-smoothstep(73.0,78.0,t));}

/* ---------- near floating particles ---------- */
var PR=BUILD.rng(4242);
var PARTICLES=[];
for(var p=0;p<720;p++){
  PARTICLES.push({x:(PR()-0.5)*PERIOD,y:(PR()-0.5)*560,z:(PR()-0.5)*1000,
    s:0.35+PR()*1.35,ph:PR()*6.28,warm:PR()<0.16});
}

/* ---------- camera ---------- */
var CAM={
  approach:[
    {u:0,    eye:[-110,125,345], tgt:[20,0,0],  fov:54},
    {u:0.22, eye:[196,34,150],  tgt:[110,2,0],  fov:50},
    {u:0.46, eye:[44,22,132],   tgt:[0,0,0],    fov:52},
    {u:0.68, eye:[-64,-42,126], tgt:[-50,-4,0], fov:52},
    {u:0.86, eye:[-172,26,152], tgt:[-110,0,0], fov:50},
    {u:1.0,  eye:[-205,60,255], tgt:[0,0,0],    fov:54}
  ],
  bridge:[
    {u:0,   eye:[-56,15,34], tgt:[30,14,0], fov:58},
    {u:0.4, eye:[-18,22,16], tgt:[32,16,0], fov:56},
    {u:0.7, eye:[14,30,-10], tgt:[60,20,0], fov:54},
    {u:1,   eye:[42,34,4],   tgt:[72,22,0], fov:52}
  ],
  core:[
    {u:0,   eye:[78,28,78],  tgt:[0,70,0],  fov:62},
    {u:0.5, eye:[42,112,52], tgt:[0,132,0], fov:62},
    {u:1,   eye:[-32,192,44],tgt:[0,150,0], fov:60}
  ],
  hangar:[
    {u:0,   eye:[-116,12,22],tgt:[50,10,0], fov:58},
    {u:0.5, eye:[-20,10,6],  tgt:[104,8,0], fov:56},
    {u:1,   eye:[74,14,-8],  tgt:[124,10,0],fov:54}
  ],
  corridor:[
    {u:0,   eye:[-170,30,0], tgt:[100,28,0], fov:60},
    {u:0.5, eye:[-40,28,0],  tgt:[160,26,0],fov:58},
    {u:1,   eye:[110,30,0],  tgt:[182,28,0],fov:56}
  ],
  battle:[
    {u:0,    eye:[-70,90,340],  tgt:[150,0,60], fov:54},
    {u:0.28, eye:[-120,72,250], tgt:[220,0,60], fov:54},
    {u:0.62, eye:[-40,60,230],  tgt:[320,0,100],fov:50},
    {u:0.85, eye:[80,66,270],   tgt:[300,0,100],fov:54},
    {u:1.0,  eye:[60,70,280],   tgt:[220,0,80], fov:55}
  ],
  finale:[
    {u:0,    eye:[60,70,280],   tgt:[220,0,80], fov:55},
    {u:0.30, eye:[152,56,186],  tgt:[350,0,70], fov:52},  // follow the ranks forward
    {u:0.62, eye:[-40,96,320],  tgt:[60,0,20],  fov:54},  // pull back / look back over the array
    {u:1,    eye:[-110,125,345],tgt:[20,0,0],   fov:54}   // seamless join into the opening
  ]
};
function kf(keys,u){
  var i=0; while(i<keys.length-2&&u>keys[i+1].u)i++;
  var a=keys[i],b=keys[i+1];
  var f=clamp((u-a.u)/Math.max(1e-6,b.u-a.u),0,1);
  return {eye:lerp3(a.eye,b.eye,f),tgt:lerp3(a.tgt,b.tgt,f),fov:lerp(a.fov,b.fov,f)};
}
function camFor(id,u,t){
  var c=kf(CAM[id],u);
  var sw=[1.5*wave(t,3,0.4),1.0*wave(t,2,1.7),1.2*wave(t,4,2.9)];
  return {eye:[c.eye[0]+sw[0],c.eye[1]+sw[1],c.eye[2]+sw[2]],
          tgt:[c.tgt[0]+sw[0]*0.3,c.tgt[1]+sw[1]*0.3,c.tgt[2]+sw[2]*0.3],
          fov:c.fov};
}

/* ---------- environment / lighting per shot ---------- */
function applyEnv(id){
  var e=GFX.env;
  if(id==='bridge'){
    e.lightDir=[0.65,0.5,0.30]; e.lightCol=[0.80,0.88,1.0]; e.ambCol=[0.09,0.13,0.22];
    e.fogCol=[0.008,0.014,0.030]; e.fog=0.0042; e.emisBoost=1.05; e.emisGain=0.26; e.bloom=0.32; e.bgScale=0.14;
  } else if(id==='core'){
    e.lightDir=[0.35,0.75,0.45]; e.lightCol=[0.70,0.84,1.0]; e.ambCol=[0.08,0.12,0.22];
    e.fogCol=[0.007,0.013,0.030]; e.fog=0.0034; e.emisBoost=1.15; e.emisGain=0.40; e.bloom=0.42; e.bgScale=0.14;
  } else if(id==='hangar'){
    e.lightDir=[0.5,0.6,0.35]; e.lightCol=[0.84,0.90,1.0]; e.ambCol=[0.08,0.11,0.19];
    e.fogCol=[0.008,0.014,0.028]; e.fog=0.0042; e.emisBoost=1.05; e.emisGain=0.28; e.bloom=0.32; e.bgScale=0.12;
  } else if(id==='corridor'){
    e.lightDir=[0.55,0.6,0.35]; e.lightCol=[1.0,0.84,0.62]; e.ambCol=[0.10,0.11,0.17];
    e.fogCol=[0.012,0.010,0.018]; e.fog=0.0044; e.emisBoost=1.1; e.emisGain=0.30; e.bloom=0.36; e.bgScale=0.11;
  } else {
    e.lightDir=[0.42,0.55,0.72]; e.lightCol=[1.0,0.93,0.80]; e.ambCol=[0.20,0.28,0.44];
    e.fogCol=[0.010,0.016,0.034]; e.fog=0.00011; e.emisBoost=1.6; e.emisGain=1.0; e.bloom=0.78; e.bgScale=1.0;
  }
}

/* ---------- ship transforms ---------- */
function sway(ship,t){var ph=ship.idx*1.7;return [1.6*wave(t,3,ph),1.2*wave(t,2,ph+1),1.6*wave(t,4,ph+2)];}
function formationSpread(t,ship){
  var open=smoothstep(44,52,t)-smoothstep(60,68,t);
  return 40*open*Math.sign(ship.base[2]||1)*(ship.tier>=2?1:0.55);
}
function shipModel(ship,t){
  if(ship.type==='flag')return GFX.m4.identity();
  var sw=sway(ship,t),sp=formationSpread(t,ship);
  var p=[ship.base[0]+sw[0],ship.base[1]+sw[1],ship.base[2]+sw[2]+sp];
  var rot=[ship.pitch+0.02*wave(t,2,ship.idx),ship.yaw+0.03*wave(t,3,ship.idx+1),0];
  return GFX.m4.compose(p,rot,[ship.scale,ship.scale,ship.scale]);
}
var PROTO_OF={flag:PROTO.flag,near:PROTO.near,vanguard:PROTO.vanguard};
var ENGINE_LOCAL={flag:[-114,0,0],near:[-32,0,0],vanguard:[-36,0,0]};

function mix3(a,b,f){return [lerp(a[0],b[0],f),lerp(a[1],b[1],f),lerp(a[2],b[2],f)];}
/* event lighting: muzzle flashes / impacts / shield bloom briefly lift nearby dust */
function eventGlow(t){
  if(t<49||t>72)return 0;
  var beam=smoothstep(53.0,53.6,t)*(1-smoothstep(57.6,59.0,t));
  var pulse=smoothstep(54.0,54.8,t)*(1-smoothstep(60.0,61.0,t));
  var miss=smoothstep(58.4,59.4,t)*(1-smoothstep(62.6,63.8,t));
  var shield=smoothstep(64.0,66.5,t)*(1-smoothstep(70.5,72.0,t));
  return clamp(0.55*beam+0.30*pulse+0.75*miss+0.35*shield,0,1);
}

/* small craft: a full 26 s (78/3, seamless) cycle of
   docked -> launch -> escort along the hull past cannon/shell/nozzles -> return. */
function craftModel(i,t){
  var CP=26;
  var ph=((t/CP + i*0.137)%1+1)%1;
  var side=(i%2)?1:-1;
  var berth=[-14, 6, side*30];
  var exitP=[-46, 10, side*40];
  var bow  =[122, 15, side*42];
  var stern=[-124, 14, side*44];
  var p,yaw;
  if(ph<0.16){                                   // docked at the hangar mouth
    p=[berth[0]+Math.sin(t*1.1+i)*0.7, berth[1]+0.6*Math.sin(t*0.8+i), berth[2]]; yaw=0;
  } else if(ph<0.30){                            // launching
    p=mix3(berth,exitP,smoothstep(0.16,0.30,ph)); yaw=0;
  } else if(ph<0.58){                            // escorting toward the bow (past cannon & forks)
    p=mix3(exitP,bow,smoothstep(0.30,0.58,ph)); yaw=0;
  } else if(ph<0.80){                            // sweeping back past shell layers & nozzles
    p=mix3(bow,stern,smoothstep(0.58,0.80,ph)); yaw=Math.PI;
  } else {                                       // returning to the bay
    p=mix3(stern,berth,smoothstep(0.80,1.0,ph)); yaw=0;
  }
  var rot=[0.04*Math.sin(t*0.7+i),yaw,0.06*Math.sin(t+i)];
  return GFX.m4.compose(p,rot,[1,1,1]);
}

/* hangar craft: berth -> bridge trusses -> wide mouth -> outside -> back in. */
function hangarCraft(i,t){
  var CP=26;
  var ph=((t/CP + i*0.161)%1+1)%1;
  var berthX=104, mouthX=-124;
  var z=((i%2)?1:-1)*(16+(i%3)*5);
  var y=9+2.2*Math.sin(t*0.5+i);
  var x;
  if(ph<0.14) x=berthX;
  else if(ph<0.50) x=lerp(berthX,mouthX,smoothstep(0.14,0.50,ph));
  else if(ph<0.60) x=mouthX-7*(ph-0.50)/0.10;
  else x=lerp(mouthX,berthX,smoothstep(0.60,1.0,ph));
  // heading follows travel direction, turning back to "outbound" at the loop seam
  var yaw=Math.PI*(1-smoothstep(0.62,0.70,ph))+Math.PI*smoothstep(0.94,1.0,ph);
  return GFX.m4.compose([x,y,z],[0,yaw,0],[1,1,1]);
}

/* ---------- scene solids ---------- */
var ID=composeIdentity();
function composeIdentity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}

var SLOW_P=900;   // mid-distance rock parallax period -> one lap per loop (seamless)
function drawExterior(t){
  // mid-distance rocks: slower parallax than the near dust, faster than the fixed stars
  var slowDrift=SLOW_P*(t/DURATION);
  for(var s=0;s<SMALL.length;s++){
    var R=SMALL[s];
    var x=wrap(R.pos[0]-slowDrift,SLOW_P);
    GFX.solid(R.proto,GFX.m4.compose([x,R.pos[1],R.pos[2]],[0,t*0.02+s,0],[1,1,1]));
  }
  // asteroids (fragments tile the whole rock at sep=0)
  var sep=shatter(t);
  var dispel=bump(t,52,78);   // periodic: 0 at both loop boundaries
  var back=-72*bump(t,62,78); // debris falls behind during the acceleration (seamless)
  for(var a=0;a<ASTEROIDS.length;a++){
    var A=ASTEROIDS[a];
    for(var f=0;f<A.frags.length;f++){
      var F=A.frags[f];
      var k=sep*16+dispel*22;
      var disp=[F.vel[0]*k,F.vel[1]*k,F.vel[2]*k];
      var pos=[A.pos[0]+F.centroid[0]+disp[0]+back,A.pos[1]+F.centroid[1]+disp[1],A.pos[2]+F.centroid[2]+disp[2]];
      var kr=sep*0.9+dispel*0.6;
      var rot=[F.spin[0]*kr,F.spin[1]*kr,F.spin[2]*kr];
      GFX.solid(F.proto,GFX.m4.compose(pos,rot,[1,1,1]));
    }
  }
  // fleet
  for(var i=0;i<SHIPS.length;i++) GFX.solid(PROTO_OF[SHIPS[i].type],shipModel(SHIPS[i],t));
  // small craft
  for(var c=0;c<8;c++) GFX.solid(PROTO.craft,craftModel(c,t));
}
function drawBridgeScene(t){
  GFX.solid(PROTO.bridge,ID);
  // fleet visible beyond the panoramic window (distant, staggered ranks)
  for(var i=0;i<9;i++){
    var x=430+((i*83)%380);
    var z=(i-4)*26;
    var y=(i%3)*12-12;
    GFX.solid(i%2?PROTO.vanguard:PROTO.near,GFX.m4.compose([x,y,z],[0,0,0],[0.40,0.40,0.40]));
  }
  for(var c=0;c<3;c++) GFX.solid(PROTO.craft,GFX.m4.compose([300+c*70,12+c*8,12],[0,0,0],[0.5,0.5,0.5]));
}
function drawCoreScene(t){
  GFX.solid(PROTO.core,ID);
  for(var i=0;i<6;i++){
    var y=28+i*36;
    var sc=1.55-i*0.10;
    var ang=t*0.22*(i%2?1:-1)+i*0.7;
    GFX.solid(PROTO.ring,GFX.m4.compose([0,y,0],[0,ang,0],[sc,1,sc]));
  }
}
function drawHangarScene(t){
  GFX.solid(PROTO.hangar,ID);
  for(var i=0;i<6;i++) GFX.solid(PROTO.craft,hangarCraft(i,t));
}
function drawCorridorScene(t){
  GFX.solid(PROTO.corridor,ID);
  // small abstract machine jaws slowly opening / closing in the central gap
  for(var i=0;i<3;i++){
    var x=-110+i*100;
    var open=0.5+0.5*Math.sin(t*0.6+i*1.3);
    var dz=4+open*7;
    var s=0.20;
    var m1=GFX.m4.compose([x,14,-dz],[0,0,0],[s,s,s]);
    var m2=GFX.m4.compose([x,14, dz],[0,0,0],[s,s,s]);
    GFX.solid(PROTO.ring,m1); GFX.solid(PROTO.ring,m2);
  }
}

function drawScene(id,t){
  if(id==='bridge')drawBridgeScene(t);
  else if(id==='core')drawCoreScene(t);
  else if(id==='hangar')drawHangarScene(t);
  else if(id==='corridor')drawCorridorScene(t);
  else drawExterior(t);
}

/* ---------- shields ---------- */
function shieldStrength(t){
  // faint receding afterglow at the loop head, full bloom mid-finale,
  // thinning back to the same faint value at the loop tail (seamless join)
  if(t<8)return 0.10*(1-smoothstep(0,6,t));
  if(t<64)return 0;
  var rise=smoothstep(64,67.5,t);
  var fall=smoothstep(72,78,t);
  return 0.10+0.80*rise*(1-fall);
}
function shieldModel(ship,t){
  var sw=ship.type==='flag'?[0,0,0]:sway(ship,t);
  var sp=ship.type==='flag'?0:formationSpread(t,ship);
  var p=[ship.base[0]+sw[0],ship.base[1]+sw[1],ship.base[2]+sw[2]+sp];
  var L=(ship.type==='flag'?152:(ship.type==='vanguard'?44:38))*ship.scale;
  var H=(ship.type==='flag'?52:16)*ship.scale;
  var W=(ship.type==='flag'?80:22)*ship.scale;
  return GFX.m4.compose(p,[0,0,0],[L,H,W]);
}
function drawShields(t){
  var st=shieldStrength(t);
  if(st<0.01)return;
  for(var i=0;i<SHIPS.length;i++){
    var sh=SHIPS[i];
    var open=64+sh.idx*0.10-(t<8?DURATION:0);
    GFX.shield(shieldModel(sh,t),open,st*0.6);
  }
}

/* ---------- FX ---------- */
function collectFX(id,t,u,cam){
  var sprites=[],segs=[];
  function S(p,size,c,a,rot){sprites.push({p:p,size:size,c:c,a:a==null?1:a,rot:rot||0});}
  function G(a,b,w,c,a0,flow){segs.push({a:a,b:b,w:w,c:c,a0:a0==null?1:a0,flow:flow||0});}
  var ext=!!EXTERIOR[id];

  /* ---- near floating particles / speed cue ---- */
  var pc=ext?720:150;
  var dim=ext?1:0.28;
  var dr=drift(t);
  var ev=eventGlow(t);      // gunfire / impacts / shield bloom briefly reveal nearby dust
  for(var p=0;p<pc;p++){
    var P=PARTICLES[p];
    var x=wrap(P.x-dr,PERIOD);
    var pos=[x,P.y+Math.sin(t*0.2+P.ph)*2,P.z];
    var loc=0.55+0.45*Math.exp(-Math.pow((pos[0]-180)/300,2));
    var a=(0.055+0.075*Math.abs(Math.sin(t*0.5+P.ph)))*dim*(1+2.0*ev*loc);
    var col=P.warm?[1.0,0.72,0.42]:[0.55,0.70,0.98];
    if(ev>0.01)col=[lerp(col[0],1.0,0.35*ev),lerp(col[1],0.90,0.35*ev),lerp(col[2],0.78,0.35*ev)];
    S(pos,P.s,col,a,0);
  }

  if(ext){
    /* ---- engine plumes for flagship nozzles + escort subset ---- */
    var thr=thrust(t);
    function plume(ep,scale,seed){
      var n=16;
      for(var i=0;i<n;i++){
        var f=i/n;
        var x=ep[0]-i*(2.0+0.7*thr);
        var sp=0.6+i*0.22;
        var pp=[x,ep[1]+Math.sin(seed*3+i*0.9+t*4)*sp*0.3,ep[2]+Math.cos(seed*2+i*0.7+t*3)*sp*0.3];
        var sz=(2.0+i*0.55)*scale*(0.65+0.65*thr);
        var aa=(1-f)*(0.15+0.24*thr);
        var c=i<4?[1.0,0.82,0.48]:(i<10?[1.0,0.5,0.2]:[0.42,0.62,1.0]);
        S(pp,sz,c,aa,0);
      }
      S([ep[0]-2,ep[1],ep[2]],3.4*scale,[1.0,0.9,0.65],0.25+0.5*thr,0);
      // a few light flecks peeling off
      if(seed%3===0)for(var q=0;q<3;q++){
        S([ep[0]-10-q*4,ep[1]+(q-1)*3,ep[2]+Math.sin(t*3+q)*3],1.0,[1.0,0.7,0.35],0.2*thr,0);
      }
    }
    for(var e=0;e<MZ.engines.length;e++)plume(MZ.engines[e],1.0,e);
    for(var si=0;si<SHIPS.length;si++){
      var sh=SHIPS[si]; if(sh.type==='flag'||(sh.idx%2))continue;
      var sw=sway(sh,t);
      var ep=[sh.base[0]+sw[0]+ENGINE_LOCAL[sh.type][0]*sh.scale,sh.base[1]+sw[1],sh.base[2]+sw[2]+formationSpread(t,sh)];
      plume(ep,0.55*sh.scale,si);
    }
    /* faint glow at pulse turret muzzles */
    for(var pi=0;pi<MZ.pulses.length;pi++){
      var mp=MZ.pulses[pi];
      S(mp,2.0,[1.0,0.62,0.25],0.18,0);
    }
  }

  /* ================= BATTLE ================= */
  if(id==='battle'){
    var warm=[1.0,0.62,0.22],hot=[1.0,0.88,0.55],cool=[0.45,0.82,1.0];
    var T0=ASTEROIDS[0].pos,T1=ASTEROIDS[1].pos,T2=ASTEROIDS[4].pos,T3=ASTEROIDS[3].pos;
    var muzzle=MZ.main;

    /* ---- main beam cannon ---- */
    var charge=smoothstep(51.6,53.2,t);
    if(charge>0){
      // charge-up glow at the muzzle + expanding launch rings
      S(muzzle,10*charge,hot,0.5*charge,0);
      S(muzzle,4*charge,[0.7,0.9,1.0],0.7*charge,0);
      for(var r=0;r<3;r++)S([muzzle[0]+r*2,0,0],(4+r*2)*charge,cool,0.25*charge,0);
    }
    var beam=smoothstep(53.0,53.6,t)*(1-smoothstep(56.6,57.6,t));
    // expanding launch ring at the muzzle at the instant of firing
    var ring=smoothstep(52.95,53.25,t)*(1-smoothstep(53.25,54.1,t));
    if(ring>0){
      for(var rk=0;rk<12;rk++){
        var ra=rk/12*6.283, rr=6+17*ring;
        S([muzzle[0]+2,Math.cos(ra)*rr,Math.sin(ra)*rr],2.5*ring,cool,0.55*ring,0);
      }
    }
    if(beam>0.001){
      var puls=0.86+0.14*Math.sin(t*19.0);   // coarse/fine pulsing of the shaft
      // outer glow / mid / core, from muzzle to target
      G(muzzle,T0,16*beam*puls,[0.30,0.60,1.0],0.35*beam,0);
      G(muzzle,T0,9*beam*puls, hot,0.55*beam,1.7);
      G(muzzle,T0,3.2*beam*puls,[1.0,1.0,0.95],0.95*beam,3.1);
      // impact bloom on the target, growing
      var ig=smoothstep(53.4,54.4,t)*(1-smoothstep(56.6,57.6,t));
      S(T0,16*ig,hot,0.45*ig,0);
      S(T0,6*ig,[1.0,1.0,0.9],0.7*ig,0);
      for(var d=0;d<7;d++){
        var aa=d/7*6.28+t*2;
        S([T0[0]+Math.cos(aa)*14*ig,T0[1]+Math.sin(aa)*14*ig,T0[2]+Math.sin(aa*1.3)*14*ig],3*ig,warm,0.5*ig,aa);
      }
    }
    // after firing: the shaft detaches and residual light flakes keep travelling forward
    var after=smoothstep(57.3,57.9,t)*(1-smoothstep(59.2,60.4,t));
    if(after>0){
      for(var ak=0;ak<12;ak++){
        var ff=(((t-57.3)*0.34+ak*0.083)%1+1)%1;
        var ap2=[lerp(muzzle[0],T0[0],ff),lerp(muzzle[1],T0[1],ff),lerp(muzzle[2],T0[2],ff)];
        S(ap2,2.6*(1-ff)+0.8,hot,0.42*after*(1-ff),0);
      }
    }

    /* ---- pulse turret bolts (grouped, half-beat offset) ---- */
    var pw=smoothstep(54.0,54.6,t)*(1-smoothstep(59.0,60.0,t));
    if(pw>0){
      var targets=[T1,T3,T2];
      for(var g=0;g<MZ.pulses.length;g++){
        var src=MZ.pulses[g];
        var tg=targets[g%3];
        var off=(g%3)*0.16;                   // adjacent turrets offset half a beat
        for(var b=0;b<4;b++){
          var frac=(((t-54.0-off)*0.9 - b*0.22)%1+1)%1;
          var pos=[lerp(src[0],tg[0],frac),lerp(src[1],tg[1],frac)+Math.sin(frac*8+g)*4,lerp(src[2],tg[2],frac)];
          S(pos,2.6,[0.6,0.9,1.0],0.85*pw,0);
          S(pos,1.2,[1.0,1.0,1.0],0.9*pw,0);
          // short tail
          G([pos[0]-6,pos[1],pos[2]],pos,1.4,[0.4,0.75,1.0],0.5*pw,g);
        }
        S(src,2.4,hot,0.5*pw,0);
      }
      // grouped impact flashes jumping along a notch
      var ig2=smoothstep(55.2,56.0,t)*(1-smoothstep(59.2,60.2,t));
      for(var q=0;q<4;q++){
        var tp=[lerp(T1[0],T3[0],q/3),lerp(T1[1],T3[1],q/3),lerp(T1[2],T3[2],q/3)];
        S(tp,7*ig2,hot,0.35*ig2,0);
      }
    }

    /* ---- near-guard rapid-fire point-defence streams ---- */
    var nw=smoothstep(55.0,55.6,t)*(1-smoothstep(60.2,61.0,t));
    if(nw>0){
      var near=SHIPS.filter(function(s){return s.type==='near';}).slice(0,8);
      for(var ni=0;ni<near.length;ni++){
        var sh2=near[ni];
        var base=[sh2.base[0]+18*sh2.scale,sh2.base[1]+10*sh2.scale,sh2.base[2]];
        var aim=[T2[0]-40+ni*8,T2[1]+10,T2[2]-20];
        for(var k=0;k<9;k++){
          var f2=(k/9+((t*1.6+ni*0.2)%1)*0.25)%1;
          var pa=[lerp(base[0],aim[0],f2),lerp(base[1],aim[1],f2),lerp(base[2],aim[2],f2)];
          var pb=[pa[0]+4,pa[1],pa[2]];
          if(k%2===0)G(pa,pb,0.9,[1.0,0.85,0.45],0.75*nw,ni+k);
          S(pa,1.3,[1.0,0.9,0.6],0.5*nw,0);
        }
        S(base,2.0,hot,0.4*nw,0);
      }
      // small debris sparks at the target
      var sg=smoothstep(55.6,56.4,t)*(1-smoothstep(60.4,61.2,t));
      for(var s2=0;s2<12;s2++){
        var an=s2*2.4+t*3;
        S([T2[0]+Math.cos(an)*10*sg,T2[1]+Math.sin(an)*10*sg,T2[2]+Math.cos(an*0.7)*10*sg],1.6,warm,0.45*sg,an);
      }
    }

    /* ---- vanguard missiles (sequential launch, arcing trails, delayed bursts) ---- */
    var vg=SHIPS.filter(function(s){return s.type==='vanguard';}).slice(0,7);
    for(var mi=0;mi<vg.length;mi++){
      var v=vg[mi];
      var launch=55.2+mi*0.42;
      var age=t-launch;
      if(age<0||age>5.2)continue;
      var f3=clamp(age/3.6,0,1);
      var start=[v.base[0]+22*v.scale,v.base[1]+6*v.scale,v.base[2]];
      var end=[T3[0],T3[1],T3[2]];
      var mp=[lerp(start[0],end[0],f3),lerp(start[1],end[1],f3)+Math.sin(f3*Math.PI)*26*(0.4+mi*0.1),lerp(start[2],end[2],f3)];
      // long trail behind
      for(var tl=0;tl<7;tl++){
        var f4=clamp(f3-tl*0.03,0,1);
        var a=[lerp(start[0],end[0],f4),lerp(start[1],end[1],f4)+Math.sin(f4*Math.PI)*26*(0.4+mi*0.1),lerp(start[2],end[2],f4)];
        var f5=clamp(f4+0.02,0,1);
        var b=[lerp(start[0],end[0],f5),lerp(start[1],end[1],f5)+Math.sin(f5*Math.PI)*26*(0.4+mi*0.1),lerp(start[2],end[2],f5)];
        G(a,b,2.6*(1-tl/8),[1.0,0.55,0.22],(1-tl/7)*0.55,mi);
      }
      S(mp,3.0,[1.0,0.9,0.6],0.85,0);
      S(mp,6.0,warm,0.35,0);
      // delayed large burst on arrival
      if(f3>=0.995){
        var bt=age-3.6;
        var burst=smoothstep(0,0.35,bt)*(1-smoothstep(1.4,2.4,bt));
        S(end,20*burst,hot,0.45*burst,0);
        S(end,10*burst,[1.0,0.9,0.6],0.65*burst,0);
        for(var bl=0;bl<8;bl++){
          var ba=bl/8*6.28+mi;
          S([end[0]+Math.cos(ba)*20*burst,end[1]+Math.sin(ba)*20*burst,end[2]+Math.sin(ba*1.4)*20*burst],4*burst,warm,0.4*burst,ba);
        }
        // trail lingers in space after the burst, then loosens and fades away
        var linger=smoothstep(0.3,0.6,bt)*(1-smoothstep(1.7,2.7,bt));
        if(linger>0){
          for(var li=0;li<7;li++){
            var f7=0.70+li*0.042;
            var a7=[lerp(start[0],end[0],f7),lerp(start[1],end[1],f7)+Math.sin(f7*Math.PI)*26*(0.4+mi*0.1),lerp(start[2],end[2],f7)];
            var f8=clamp(f7+0.025,0,1);
            var b8=[lerp(start[0],end[0],f8),lerp(start[1],end[1],f8)+Math.sin(f8*Math.PI)*26*(0.4+mi*0.1),lerp(start[2],end[2],f8)];
            G(a7,b8,2.0*(1-li/8),[1.0,0.5,0.2],0.30*linger*(1-li/8),mi+li);
          }
        }
      }
    }
    /* residual drifting light at the shattered rocks */
    var af=shatter(t)*(1-smoothstep(62,65,t));
    for(var a2=0;a2<ASTEROIDS.length;a2++){
      var ap=ASTEROIDS[a2].pos;
      S(ap,10*af,[1.0,0.6,0.25],0.18*af,0);
    }
  }

  /* ---- finale: extra shield glints ---- */
  if(id==='finale'){
    var st2=shieldStrength(t);
    for(var q2=0;q2<SHIPS.length;q2+=3){
      var sh3=SHIPS[q2];
      var ang2=t*0.8+q2;
      var rr=sh3.type==='flag'?130:34;
      var gp=[sh3.base[0]+Math.cos(ang2)*rr*0.6,sh3.base[1]+Math.sin(ang2)*18,sh3.base[2]+Math.sin(ang2)*rr*0.4];
      S(gp,2.2,[0.5,0.9,1.0],0.5*st2,ang2);
    }
  }

  /* ---- interior ambience ---- */
  if(id==='bridge'){
    // simplified 3D fleet hologram above the command hub:
    // moving ship light-points, course lines and bands (period = full loop)
    for(var hf=0;hf<12;hf++){
      var lane=(hf%3)-1;
      var fx=34+12*Math.sin(2*Math.PI*t/DURATION+hf*0.53)+(hf-5)*1.0;
      var hy=21+2.0*Math.sin(t*0.6+hf*0.8);
      var hz=lane*6+2.4*Math.sin(t*0.4+hf*1.7);
      S([fx,hy,hz],0.55,[0.35,0.9,1.0],0.55,0);
      G([fx-4,hy,hz],[fx-1.2,hy,hz],0.22,[0.25,0.72,1.0],0.40,hf);
    }
    for(var h2=0;h2<10;h2++){
      var hx=(14+h2*4),hy2=18+3*Math.sin(t*0.8+h2),hz=Math.sin(t*0.5+h2)*12;
      S([hx,hy2,hz],0.6,[0.4,0.9,1.0],0.26,0);
    }
    S([26,21,0],2.5,[0.3,0.85,1.0],0.16,0);   // soft projection glow
  } else if(id==='core'){
    var breath=0.6+0.4*Math.sin(t*0.9);
    for(var cy=20;cy<240;cy+=26) S([0,cy,0],10,[0.3,0.85,1.0],0.13*breath,0);
    S([0,120,0],30,[0.4,0.9,1.0],0.22*breath,0);
    // energy flowing along connections
    for(var e2=0;e2<8;e2++){
      var an2=e2*Math.PI/4;
      var a3=[Math.cos(an2)*30,90,Math.sin(an2)*30];
      var b3=[Math.cos(an2)*100,90,Math.sin(an2)*100];
      G(a3,b3,1.4,[0.35,0.85,1.0],0.35*breath,e2);
    }
  } else if(id==='hangar'){
    for(var g2=0;g2<10;g2++){
      var gx=-110+g2*24;
      S([gx,2,0],2.4,[0.4,0.9,1.0],0.22,0);
    }
  } else if(id==='corridor'){
    // energy light blocks advancing in batches along slot rows
    for(var row=0;row<6;row++){
      var z=(row<3?-1:1)*40;
      for(var b4=0;b4<5;b4++){
        var f6=((t*0.09+b4*0.2+row*0.07)%1+1)%1;
        var x=-170+f6*350;
        var yy=16+(row%3)*12;
        S([x,yy,z],2.6,[1.0,0.7,0.3],0.55,0);
        S([x,yy,z],1.2,[1.0,0.95,0.7],0.7,0);
      }
    }
    // flow along upper/lower conduits
    for(var fl=0;fl<6;fl++){
      var fx=-160+fl*60;
      var f7=((t*0.15+fl*0.15)%1+1)%1;
      G([fx,4,-46],[fx+f7*60,4,-46],1.2,[1.0,0.6,0.2],0.4,fl);
      G([fx,62,46],[fx+f7*60,62,46],1.2,[1.0,0.6,0.2],0.4,fl+3);
    }
  }

  return {sprites:sprites,segs:segs};
}

/* ---------- the deterministic render function ---------- */
function renderAt(t){
  t=((t%DURATION)+DURATION)%DURATION;
  var shot=SHOTS[SHOTS.length-1];
  for(var i=0;i<SHOTS.length;i++)if(t>=SHOTS[i].t0&&t<SHOTS[i].t1){shot=SHOTS[i];break;}
  var id=shot.id;
  var u=clamp((t-shot.t0)/(shot.t1-shot.t0),0,0.999999);

  applyEnv(id);
  var cam=camFor(id,u,t);
  GFX.setCamera(cam.eye,cam.tgt,[0,1,0],cam.fov,t);
  GFX.beginFrame();
  drawScene(id,t);
  drawShields(t);
  var fx=collectFX(id,t,u,cam);
  GFX.sprites(fx.sprites);
  GFX.segments(fx.segs);
  GFX.endFrame();
}

/* ---------- resolution ---------- */
function fitResolution(){
  var w=window.innerWidth||1280,h=window.innerHeight||720;
  var s=Math.min(1,3840/w,2160/h);
  GFX.resize(Math.max(2,Math.floor(w*s)),Math.max(2,Math.floor(h*s)));
}
window.addEventListener('resize',fitResolution);
fitResolution();

/* ---------- export interface ---------- */
var RUNS=[
  {id:'exterior',t0:0, t1:16},
  {id:'interior',t0:16,t1:49},
  {id:'battle',  t0:49,t1:78}
];
var exportState=null;
window.videoExport={
  runs:RUNS.map(function(r){return r.id;}),
  begin:async function(runId,opts){
    var fps=(opts&&opts.fps)||60;
    var run=null;for(var i=0;i<RUNS.length;i++)if(RUNS[i].id===runId)run=RUNS[i];
    if(!run)run=RUNS[0];
    exportState={start:run.t0,fps:fps,frames:Math.round((run.t1-run.t0)*fps)};
    fitResolution();
    renderAt(exportState.start);          // rebuild this block's global start state
    return {frames:exportState.frames};
  },
  frame:async function(i){
    if(!exportState)return;
    fitResolution();
    renderAt(exportState.start+i/exportState.fps);
    GFX.gl.finish();
  },
  end:function(){exportState=null;}
};

/* ---------- autoplay ---------- */
var startTime=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  if(exportState)return;          // export mode drives frames itself
  var t=((now-startTime)/1000)%DURATION;
  fitResolution();
  renderAt(t);
}
requestAnimationFrame(loop);

window.__renderAt=renderAt;   // handy for debugging
window.__ready=true;
})();
