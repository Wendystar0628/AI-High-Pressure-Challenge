/* Local physics invariants; no browser, network, or dependencies required. */
'use strict';
const assert=require('node:assert/strict');
global.window=global;
require('./physics.js');
const {JellySim,TankSim,defaults,DT}=Physics;
function advance(sim,seconds,visit){sim.started=true;for(let i=0;i<Math.round(seconds/DT);i++){sim.step(DT);if(visit)visit(sim);}}
function finite(sim){for(const b of sim.balls)for(const k of ['x','y','z','vx','vy','vz'])assert.ok(Number.isFinite(b[k]),`${k} must stay finite`);}
const report=[];
for(const mode of ['center','multi','offset']){
  const s=new JellySim(defaults.jelly,mode);let peak=0,nonuniform=0;
  advance(s,28,()=>{peak=Math.max(peak,s.maxDef);nonuniform=Math.max(nonuniform,Math.abs(s.sample(s.u,0,0)-s.sample(s.u,1.4,0)));});finite(s);
  assert.ok(s.contacts>0);assert.ok(peak>.35);assert.ok(nonuniform>.12);assert.ok(s.energy<.06);
  if(mode==='multi')assert.equal(s.balls.length,3);
  if(mode==='offset')assert.ok(Math.hypot(s.balls[0].x,s.balls[0].z)>s.R);
  report.push({mode,contacts:s.contacts,peak:+peak.toFixed(3),finalEnergy:+s.energy.toFixed(5)});
}
let startObserved=null,stopObserved=null;
const tank=new TankSim(defaults.tank,(event)=>{if(event==='wave-start')startObserved=tank.t;if(event==='wave-stop')stopObserved=tank.t;});tank.armRelease();
let wavePeak=0,heavyStart=null,heavyEnd=null;
advance(tank,34,()=>{wavePeak=Math.max(wavePeak,tank.waveHeight);if(tank.waveActive&&!heavyStart)heavyStart=tank.balls.filter(b=>b.group===3).map(b=>b.x);if(!tank.waveActive&&tank.waveStop&&tank.t>tank.waveStop&&!heavyEnd)heavyEnd=tank.balls.filter(b=>b.group===3).map(b=>b.x);});finite(tank);
assert.ok(tank.balls.every(b=>b.entered&&b.r===defaults.tank.radius));
assert.equal(tank.lastEntry,Math.max(...tank.balls.map(b=>b.entryTime)));
assert.ok(Math.abs(startObserved-tank.lastEntry-1)<DT*1.01);
assert.ok(Math.abs(stopObserved-startObserved-5)<DT*1.01);
assert.ok(wavePeak>.3);assert.ok(tank.waveEnergy<.02);assert.ok(tank.ballCollisions>0);
assert.ok(tank.balls.filter(b=>b.group===0).every(b=>b.y>tank.H-.05));
assert.ok(tank.balls.filter(b=>b.group===2).every(b=>b.y>.55&&b.y<tank.H-.3));
assert.ok(tank.balls.filter(b=>b.group===3).every(b=>b.y<.4));
assert.ok(heavyEnd.some((x,i)=>Math.abs(x-heavyStart[i])>.08));
report.push({mode:'tank',lastEntry:tank.lastEntry,start:startObserved,stop:stopObserved,peak:+wavePeak.toFixed(3),ballCollisions:tank.ballCollisions,heavyMovement:heavyEnd.map((x,i)=>+(x-heavyStart[i]).toFixed(3))});
// Manual wave control must not silently release the waiting balls.
const manual=new TankSim(defaults.tank);manual.setWave(true);advance(manual,3);assert.ok(manual.waveActive);assert.ok(manual.balls.every(b=>!b.released));manual.setWave(false);advance(manual,.1);assert.equal(manual.waveActive,false);manual.armRelease();advance(manual,3);assert.ok(manual.balls.every(b=>b.entered));
// Entry-based timing follows a changed release height.
const high=new TankSim({...defaults.tank,drop:2});high.armRelease();advance(high,5);assert.ok(high.lastEntry>tank.lastEntry+.08);assert.equal(high.waveStart-high.lastEntry,1);
// Parameters have a measurable effect on deformation.
let peaks=[];for(const stiffness of [.55,1.8]){const s=new JellySim({...defaults.jelly,stiffness});let peak=0;advance(s,5,()=>peak=Math.max(peak,s.maxDef));peaks.push(peak);}assert.ok(peaks[0]>peaks[1]*1.15);
// Disabling repeated rebounds must suppress the second hop without losing impact deformation.
const rebound=[];for(const repeat of [true,false]){const s=new JellySim({...defaults.jelly,repeat});let up=0,peak=0,sideMotion=0;advance(s,18,()=>{up=Math.max(up,s.balls[0].vy);peak=Math.max(peak,s.maxDef);sideMotion=Math.max(sideMotion,s.sideEnergy);});rebound.push({repeat,contacts:s.contacts,up,peak});assert.ok(sideMotion>.1);assert.ok(s.sideEnergy<.01);}
assert.ok(rebound[1].up<rebound[0].up*.4);assert.ok(rebound[1].contacts<rebound[0].contacts);assert.ok(rebound[1].peak>.5);
// Spray survives above the local water surface and produces return ripples.
const splash=new TankSim(defaults.tank);splash.armRelease();let peakDrops=0,returnRipples=false;
advance(splash,3,()=>{peakDrops=Math.max(peakDrops,splash.drops.length);returnRipples||=splash.rings.some(r=>!r.crown);});
assert.ok(peakDrops>60);assert.ok(returnRipples);advance(splash,3);assert.equal(splash.drops.length,0);
// Stopping and restarting a paddle retains its phase and has a soft velocity ramp.
const restart=new TankSim(defaults.tank);restart.setWave(true);advance(restart,.73);restart.setWave(false);advance(restart,.4);const stoppedPosition=restart.paddle;
advance(restart,.4);assert.equal(restart.paddle,stoppedPosition);restart.setWave(true);restart.step(DT);assert.ok(Math.abs(restart.paddle-stoppedPosition)<.001);assert.ok(Math.abs(restart.paddleVel)<.02);
// Dense batches stay inside the physical glass and above the floor after pair contacts.
const crowded=new TankSim({...defaults.tank,radius:.33,width:2.5,n0:5,n1:5,n2:5,n3:5});crowded.armRelease();
for(const initial of [crowded,new JellySim({...defaults.jelly,radius:.62,count:6},'multi')])for(let i=0;i<initial.balls.length;i++)for(let j=i+1;j<initial.balls.length;j++){const a=initial.balls[i],b=initial.balls[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>=a.r+b.r);}
advance(crowded,12,()=>{for(const b of crowded.balls)if(b.released){assert.ok(b.y>=b.r+.034);assert.ok(Math.abs(b.z)+b.r<=crowded.W/2);assert.ok(b.x+b.r<=crowded.L/2);assert.ok(b.x-b.r>=crowded.paddleFace(b.y)-.001);}});finite(crowded);
console.log(JSON.stringify({passed:true,report,softAndFirmPeaks:peaks,rebound,peakDrops,returnRipples},null,2));
