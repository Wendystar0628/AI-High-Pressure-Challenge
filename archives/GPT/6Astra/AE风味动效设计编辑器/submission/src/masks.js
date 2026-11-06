import * as THREE from 'three';
import {morphContour} from './paths.js';

const states=new WeakMap();
export function maskTexture(layer,engine,t,comp){
 let state=states.get(layer);if(!state){const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const scratch=document.createElement('canvas');scratch.width=scratch.height=512;state={canvas,scratch,texture:new THREE.CanvasTexture(canvas)};states.set(layer,state)}
 const params=(layer.masks||[]).map((m,i)=>({...m,...Object.fromEntries(['x','y','sx','sy','rotation','size','feather','opacity','morph'].map(k=>[k,engine.value(layer,`mask${i}_${k}`,t,comp)]))})),sig=JSON.stringify(params);if(state.sig===sig)return state.texture;state.sig=sig;
 const ctx=state.canvas.getContext('2d'),scratch=state.scratch.getContext('2d'),N=512;ctx.clearRect(0,0,N,N);ctx.fillStyle='#fff';ctx.fillRect(0,0,N,N);
 for(const mask of params){scratch.resetTransform();scratch.clearRect(0,0,N,N);scratch.filter=`blur(${Math.max(0,mask.feather)*N/400}px)`;scratch.fillStyle='#fff';scratch.save();scratch.translate(N/2+mask.x*N/200,N/2-mask.y*N/200);scratch.rotate(-mask.rotation*Math.PI/180);scratch.scale(mask.sx/100,mask.sy/100);scratch.beginPath();const r=mask.size*N/2;
  if(mask.type==='path'){const path=morphContour(mask.path||[{x:-.8,y:-.7},{x:.8,y:-.7},{x:.6,y:.7},{x:-.6,y:.7}],mask.target,mask.morph);for(let i=0;i<=path.length;i++){const p=path[i%path.length];if(!i)scratch.moveTo(p.x*r,-p.y*r);else{const a=path[i-1];scratch.bezierCurveTo((a.x+(a.out?.[0]||0))*r,-(a.y+(a.out?.[1]||0))*r,(p.x+(p.in?.[0]||0))*r,-(p.y+(p.in?.[1]||0))*r,p.x*r,-p.y*r)}}scratch.closePath()}
  else if(mask.type==='rect')scratch.rect(-r,-r,2*r,2*r);else scratch.ellipse(0,0,Math.abs(r),Math.abs(r),0,0,Math.PI*2);
  scratch.fill();scratch.restore();scratch.filter='none';
  const pixels=scratch.getImageData(0,0,N,N),opacity=Math.min(1,Math.max(0,mask.opacity/100));for(let i=3;i<pixels.data.length;i+=4){const value=pixels.data[i]/255;pixels.data[i]=255*((mask.invert?1-value:value)*opacity)}scratch.putImageData(pixels,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(state.scratch,0,0);ctx.globalCompositeOperation='source-over';
 }
 state.texture.needsUpdate=true;return state.texture;
}
