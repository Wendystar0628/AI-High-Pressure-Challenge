import * as THREE from 'three';
import {clamp,smooth} from './engine.js';

// One world-space field definition is shared by mesh vertices and simulation.
export function fieldEvaluator(engine,field,t,comp,visited=new Set()){
 if(!field||!field.visible||t<field.in||t>field.out||visited.has(field.id))return()=>({vector:new THREE.Vector3(),weight:0});
 visited.add(field.id);
 const world=engine.world(field,t,comp),inverse=world.clone().invert(),radius=Math.max(1,engine.value(field,'fieldRadius',t,comp)),strength=engine.value(field,'strength',t,comp),frequency=engine.value(field,'frequency',t,comp),phase=(field.seed||0)*.137;
 const next=comp.layers.find(l=>l.id===field.mixField),other=next?fieldEvaluator(engine,next,t,comp,visited):null,blend=clamp(engine.value(field,'fieldMix',t,comp));
 return point=>{const local=point.clone().applyMatrix4(inverse),weight=smooth(1-local.length()/radius),v=new THREE.Vector3();
  if(field.fieldType==='vortex')v.set(-local.y,local.x,0).normalize();
  else if(field.fieldType==='distance')v.copy(local).normalize();
  else if(field.fieldType==='direction')v.set(0,1,0);
  else v.set(Math.sin(local.y*.017+t*frequency+phase)*.5,Math.cos(local.z*.019-t*frequency*.7+phase)*.35,Math.sin(local.x*.018+t*frequency)*Math.cos(local.y*.014-t*.6));
  const magnitude=v.length();if(magnitude)v.transformDirection(world).multiplyScalar(magnitude*strength*weight);
  if(other){const result=other(point);v.lerp(result.vector,blend);return {vector:v,weight:weight*(1-blend)+result.weight*blend}}
  return {vector:v,weight};
 };
}

export function pinValues(engine,layer,t,comp){return (layer.pins||[]).map((pin,i)=>({...pin,...Object.fromEntries(['dx','dy','dz','rotation','scale','radius'].map(k=>[k,engine.value(layer,`pin${i}_${k}`,t,comp)]))}));}

export function applyPins(point,pins){
 if(!pins?.length)return point;
 const source=point.clone(),delta=new THREE.Vector3();let total=0,coverage=0;
 for(const pin of pins){const distance=Math.hypot(source.x-pin.x,source.y-pin.y,source.z-(pin.z||0)),r=Math.max(1,pin.radius),falloff=pin.rigidity?smooth((1-distance/r)/.65):smooth(1-distance/r);if(!falloff)continue;
  const weight=falloff/Math.max(.000001,distance*distance),angle=pin.rotation*Math.PI/180,scale=pin.scale||1,x=source.x-pin.x,y=source.y-pin.y;
  delta.addScaledVector(new THREE.Vector3(pin.x+(x*Math.cos(angle)-y*Math.sin(angle))*scale+pin.dx-source.x,pin.y+(x*Math.sin(angle)+y*Math.cos(angle))*scale+pin.dy-source.y,pin.dz),weight);
  total+=weight;coverage=Math.max(coverage,falloff);
 }
 if(total)point.addScaledVector(delta,coverage/total);
 return point;
}
