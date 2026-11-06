import * as THREE from 'three';
import {mix,clamp} from './engine.js';

export function contourCurve(points,closed=true){
 const path=new THREE.CurvePath();
 for(let i=1;i<points.length+(closed?1:0);i++){const a=points[i-1],b=points[i%points.length];path.add(new THREE.CubicBezierCurve(new THREE.Vector2(a.x,a.y),new THREE.Vector2(a.x+(a.out?.[0]||0),a.y+(a.out?.[1]||0)),new THREE.Vector2(b.x+(b.in?.[0]||0),b.y+(b.in?.[1]||0)),new THREE.Vector2(b.x,b.y)))}
 return path;
}
export function resampleContour(points,count,closed=true){if(points.length<2)return points;const curve=contourCurve(points,closed);return Array.from({length:count},(_,i)=>{const t=i/(closed?count:count-1),p=curve.getPointAt(t);return {x:p.x,y:p.y,in:[0,0],out:[0,0]}})}
export function morphContour(base,target,amount,options={}){
 if(!target?.length)return base;
 let a=base,b=target;
 if(a.length!==b.length||options.samples){const count=Math.round(clamp(options.samples||Math.max(a.length,b.length,32),3,256));a=resampleContour(a,count);b=resampleContour(b,count)}
 if(options.reverse)b=b.slice().reverse().map(p=>({...p,in:p.out,out:p.in}));
 const shift=((Math.round(options.start||0)%b.length)+b.length)%b.length;
 return a.map((p,i)=>{const q=b[(i+shift)%b.length];return{x:mix(p.x,q.x,amount),y:mix(p.y,q.y,amount),in:[0,1].map(j=>mix(p.in?.[j]||0,q.in?.[j]||0,amount)),out:[0,1].map(j=>mix(p.out?.[j]||0,q.out?.[j]||0,amount))}});
}
export function writeContour(path,points,closed=true){if(!points.length)return path;path.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length+(closed?1:0);i++){const a=points[i-1],b=points[i%points.length];path.bezierCurveTo(a.x+(a.out?.[0]||0),a.y+(a.out?.[1]||0),b.x+(b.in?.[0]||0),b.y+(b.in?.[1]||0),b.x,b.y)}if(closed)path.closePath();return path;}
