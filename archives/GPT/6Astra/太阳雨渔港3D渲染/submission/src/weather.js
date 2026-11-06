// One moving cloud field is shared by the ground, reflections and interior
// light. Sampling world positions keeps the dimming spatially staggered.
const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
export function cloudCover(x,z,time){
 const t=time%96,center=(t-12.5)*3;
 return Math.exp(-(((x+z*.35-center)/5)**2))*smooth(9.5,11,t)*(1-smooth(14,16,t));
}
export const cloudGLSL=`float cloudCover(vec2 p,float time){
 float t=mod(time,96.),center=(t-12.5)*3.;
 return exp(-pow((p.x+p.y*.35-center)/5.,2.))*smoothstep(9.5,11.,t)*(1.-smoothstep(14.,16.,t));
}`;

// Attack and recovery are continuous even if a wheel event abruptly changes
// camera distance. Export uses its own absolute-time reaction envelope.
export function approachResponse(level,age,dt){
 const target=1-smooth(.6,4.5,age);
 return level+(target-level)*(1-Math.exp(-dt/(target>level?1.05:.8)));
}
