/* ============================================================
   core.js — WebGL2 rendering core for 星际战舰编队
   Classic (non-module) script. Attaches a single global GFX.
   ============================================================ */
(function () {
'use strict';

/* ---------- small vector / matrix math (column-major mat4) ---------- */
function v3(x, y, z) { return [x, y, z]; }
function vadd(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function vsub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function vscale(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; }
function vdot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function vcross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function vlen(a) { return Math.sqrt(vdot(a,a)); }
function vnorm(a) { var l=vlen(a)||1; return [a[0]/l,a[1]/l,a[2]/l]; }

function m4mul(a, b) {
  var o=new Float32Array(16);
  for (var c=0;c<4;c++) for (var r=0;r<4;r++) {
    var s=0; for (var k=0;k<4;k++) s+=a[k*4+r]*b[c*4+k];
    o[c*4+r]=s;
  }
  return o;
}
function m4perspective(fovy, aspect, near, far) {
  var f=1/Math.tan(fovy/2), nf=1/(near-far);
  return new Float32Array([
    f/aspect,0,0,0,
    0,f,0,0,
    0,0,(far+near)*nf,-1,
    0,0,2*far*near*nf,0]);
}
function m4lookAt(eye, center, up) {
  var z=vnorm(vsub(eye,center));
  var x=vnorm(vcross(up,z));
  var y=vcross(z,x);
  return new Float32Array([
    x[0],y[0],z[0],0,
    x[1],y[1],z[1],0,
    x[2],y[2],z[2],0,
    -vdot(x,eye),-vdot(y,eye),-vdot(z,eye),1]);
}
function m4identity() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
/* model = translate(p) * rotY(yaw) * rotX(pitch) * rotZ(roll) * scale(s) */
function m4compose(p, rot, s) {
  // rot = [rx,ry,rz] radians (applied Z then Y then X), s = [sx,sy,sz]
  var cx=Math.cos(rot[0]), sx=Math.sin(rot[0]);
  var cy=Math.cos(rot[1]), sy=Math.sin(rot[1]);
  var cz=Math.cos(rot[2]), sz=Math.sin(rot[2]);
  // R = Rx * Ry * Rz
  var m=new Float32Array(16);
  var r00=cy*cz,               r01=-cy*sz,              r02=sy;
  var r10=sx*sy*cz+cx*sz,      r11=-sx*sy*sz+cx*cz,     r12=-sx*cy;
  var r20=-cx*sy*cz+sx*sz,     r21=cx*sy*sz+sx*cz,      r22=cx*cy;
  m[0]=r00*s[0]; m[1]=r10*s[0]; m[2]=r20*s[0]; m[3]=0;
  m[4]=r01*s[1]; m[5]=r11*s[1]; m[6]=r21*s[1]; m[7]=0;
  m[8]=r02*s[2]; m[9]=r12*s[2]; m[10]=r22*s[2]; m[11]=0;
  m[12]=p[0]; m[13]=p[1]; m[14]=p[2]; m[15]=1;
  return m;
}
/* inverse-transpose of upper-left 3x3 of a mat4 (for normals under scale) */
function normalMat3(m) {
  var a=m[0],b=m[1],c=m[2], d=m[4],e=m[5],f=m[6], g=m[8],h=m[9],i=m[10];
  var A=e*i-f*h, B=f*g-d*i, C=d*h-e*g;
  var det=a*A+b*B+c*C; if(Math.abs(det)<1e-9) det=1e-9;
  var id=1/det;
  // inverse = adj/det ; transpose gives normal matrix
  return new Float32Array([
    A*id, B*id, C*id,
    (c*h-b*i)*id, (a*i-c*g)*id, (b*g-a*h)*id,
    (b*f-c*e)*id, (c*d-a*f)*id, (a*e-b*d)*id
  ]);
}

/* ---------- GL helpers ---------- */
function compile(gl, type, src) {
  var sh=gl.createShader(type);
  gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('shader error:\n'+gl.getShaderInfoLog(sh)+'\n---\n'+src);
    throw new Error('shader compile failed');
  }
  return sh;
}
function program(gl, vs, fs) {
  var p=gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('link error:\n'+gl.getProgramInfoLog(p));
    throw new Error('link failed');
  }
  return p;
}
function uniforms(gl, p, names) {
  var u={}; for (var i=0;i<names.length;i++) u[names[i]]=gl.getUniformLocation(p, names[i]);
  return u;
}
function U(gl,u,n,v){ if(u[n]!=null) gl.uniform3fv(u[n],v); }
function U1(gl,u,n,v){ if(u[n]!=null) gl.uniform1f(u[n],v); }

/* ---------- shared shader chunks ---------- */
var FS_VS = `#version 300 es
precision highp float;
void main(){
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

var NOISE = `
float hash13(vec3 p3){ p3=fract(p3*0.1031); p3+=dot(p3,p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
float noise3(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash13(i), b=hash13(i+vec3(1,0,0)), c=hash13(i+vec3(0,1,0)), d=hash13(i+vec3(1,1,0));
  float e=hash13(i+vec3(0,0,1)), g=hash13(i+vec3(1,0,1)), h=hash13(i+vec3(0,1,1)), k=hash13(i+vec3(1,1,1));
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y), mix(mix(e,g,f.x),mix(h,k,f.x),f.y), f.z);
}
float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise3(p); p=p*2.03+vec3(11.1,7.7,3.3); a*=0.5;} return v; }
`;

/* ---------- solid voxel shaders ---------- */
var SOLID_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
layout(location=3) in vec3 iOffset;
layout(location=4) in vec3 iColor;
layout(location=5) in vec4 iParams; // emis, shade, edge, _
uniform mat4 uVP;
uniform mat4 uModel;
out vec3 vN; out vec3 vW; out vec3 vC; out vec2 vUv; out vec4 vP;
void main(){
  vec3 local = iOffset + aPos;
  vec4 world = uModel * vec4(local,1.0);
  vW = world.xyz;
  vN = normalize(mat3(uModel) * aNormal);
  vC = iColor; vP = iParams; vUv = aUv;
  gl_Position = uVP * world;
}`;

var SOLID_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vW; in vec3 vC; in vec2 vUv; in vec4 vP;
uniform vec3 uCamPos;
uniform vec3 uLightDir;
uniform vec3 uLightCol;
uniform vec3 uAmbCol;
uniform vec3 uFogCol;
uniform float uFog;
uniform float uEmisBoost;
uniform float uEmisGain;
out vec4 outColor;
void main(){
  float emis=vP.x, shade=vP.y, edgeKind=vP.z;
  vec3 N=normalize(vN); vec3 V=normalize(uCamPos-vW); vec3 L=normalize(uLightDir);
  float diff=max(dot(N,L),0.0);
  float sky=0.5+0.5*N.y;
  vec3 col=vC*(uAmbCol*(0.18+0.26*sky)+uLightCol*diff*0.90);
  float fres=pow(1.0-max(dot(N,V),0.0),3.0);
  col+=uLightCol*fres*0.14;
  vec2 e=min(vUv,1.0-vUv);
  float ed=1.0-smoothstep(0.0,0.045,min(e.x,e.y));
  col+=vec3(0.85,0.92,1.0)*ed*(0.020+0.055*edgeKind);
  col*=shade;
  col=mix(col, vC*uEmisBoost + vC*0.22, clamp(emis*uEmisGain,0.0,1.0));
  float d=length(uCamPos-vW);
  float f=clamp(exp(-d*uFog),0.0,1.0);
  col=mix(uFogCol, col, f);
  outColor=vec4(col,1.0);
}`;

/* ---------- background (stars / nebula / star glow / planet arc) ---------- */
var BG_FS = `#version 300 es
precision highp float;
` + NOISE + `
uniform vec2 uRes;
uniform vec3 uFwd, uRight, uUp;
uniform float uTan, uAspect, uTime;
uniform vec3 uLightDir;
uniform vec3 uPlanetDir;
uniform float uBgScale;
out vec4 outColor;
float starLayer(vec3 d, float scale, float thr){
  vec3 p=d*scale; vec3 id=floor(p), f=fract(p);
  float h=hash13(id);
  vec3 c=vec3(hash13(id+1.7),hash13(id+4.3),hash13(id+9.1));
  float dd=length(f-c);
  float b=step(thr,h);
  return b*exp(-dd*dd*90.0)*(0.4+0.9*hash13(id+13.7));
}
void main(){
  vec2 ndc=gl_FragCoord.xy/uRes*2.0-1.0;
  vec3 dir=normalize(uFwd + uRight*(ndc.x*uAspect*uTan) + uUp*(ndc.y*uTan));
  // base cosmic gradient
  float grad=0.5+0.5*dir.y;
  vec3 col=mix(vec3(0.006,0.010,0.024), vec3(0.020,0.030,0.058), grad);
  // nebula patches
  float n=fbm(dir*2.6 + vec3(3.1,1.7,uTime*0.0009));
  float mask=smoothstep(0.42,0.78, fbm(dir*1.4+vec3(8.0,2.0,0.0)));
  vec3 nebA=vec3(0.07,0.10,0.22), nebB=vec3(0.16,0.07,0.20), nebC=vec3(0.03,0.13,0.17);
  vec3 neb=mix(nebA,nebB, smoothstep(0.35,0.7,n));
  neb=mix(neb,nebC, smoothstep(0.5,0.85,fbm(dir*3.7+vec3(1.0,9.0,2.0))));
  col+=neb*mask*(0.35+0.65*n)*0.9;
  // dark voids
  col*= 0.65+0.5*smoothstep(0.2,0.6,fbm(dir*0.9+vec3(30.0)));
  // stars, three depth layers
  float s=starLayer(dir,140.0,0.955)*1.0 + starLayer(dir,80.0,0.978)*0.7 + starLayer(dir,320.0,0.93)*0.5;
  vec3 scol=mix(vec3(0.7,0.82,1.0), vec3(1.0,0.86,0.65), hash13(floor(dir*140.0)+2.3));
  col+=scol*s;
  // bright main star (warm) toward light direction
  float ld=max(dot(dir,normalize(uLightDir)),0.0);
  col+=vec3(1.0,0.72,0.42)*pow(ld,16.0)*0.20;
  col+=vec3(1.0,0.92,0.78)*pow(ld,2200.0)*4.0;
  // large dark planet arc with bright rim on the lit side
  vec3 pd=normalize(uPlanetDir);
  float ang=acos(clamp(dot(dir,pd),-1.0,1.0));
  float rad=0.62;
  if(ang<rad){
    float limb=exp(-pow((ang-(rad-0.03))*38.0,2.0));
    float facing=clamp(dot(normalize(dir-pd*dot(dir,pd)+vec3(0.0001)),normalize(uLightDir)),0.0,1.0);
    vec3 surf=vec3(0.026,0.038,0.068)*(0.5+0.5*fbm(dir*6.0+vec3(2.0)));
    vec3 rim=vec3(0.45,0.68,1.0)*limb*(0.15+0.85*facing)*1.1;
    col=mix(col, surf+rim, 1.0-smoothstep(rad-0.004,rad,ang));
  } else {
    col+=vec3(0.25,0.45,0.8)*exp(-(ang-rad)*(ang-rad)*500.0)*0.25;
  }
  outColor=vec4(col*uBgScale,1.0);
}`;

/* ---------- additive point sprites (glows / plumes / flashes) ---------- */
var SPRITE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQuad;
layout(location=1) in vec3 iPos;
layout(location=2) in float iSize;
layout(location=3) in vec4 iColor;
layout(location=4) in float iRot;
uniform mat4 uVP; uniform vec3 uCamRight, uCamUp;
out vec2 vQ; out vec4 vC;
void main(){
  float c=cos(iRot), s=sin(iRot);
  vec2 q=vec2(aQuad.x*c-aQuad.y*s, aQuad.x*s+aQuad.y*c);
  vec3 world=iPos + uCamRight*(q.x*iSize) + uCamUp*(q.y*iSize);
  vQ=aQuad; vC=iColor;
  gl_Position=uVP*vec4(world,1.0);
}`;
var SPRITE_FS = `#version 300 es
precision highp float;
in vec2 vQ; in vec4 vC;
out vec4 outColor;
void main(){
  float r=dot(vQ,vQ);
  if(r>1.0) discard;
  float a=exp(-r*3.2)*vC.a;
  float core=exp(-r*14.0)*vC.a*0.9;
  outColor=vec4(vC.rgb*(a+core) , 1.0);
}`;

/* ---------- additive segments (beams / trails / bullet streams) ---------- */
var SEG_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQuad;
layout(location=1) in vec3 iA;
layout(location=2) in vec3 iB;
layout(location=3) in float iWidth;
layout(location=4) in vec4 iColor;
layout(location=5) in float iFlow;
uniform mat4 uVP; uniform vec3 uCamPos;
out vec2 vQ; out vec4 vC; out float vFlow;
void main(){
  vec3 d=iB-iA; float L=length(d); vec3 dir=d/max(L,1e-5);
  vec3 mid=(iA+iB)*0.5; vec3 view=normalize(uCamPos-mid);
  vec3 side=normalize(cross(dir,view)+vec3(1e-5));
  float along=aQuad.y*0.5+0.5;
  vec3 p=iA + d*along + side*(aQuad.x*iWidth*0.5);
  vQ=aQuad; vC=iColor; vFlow=iFlow;
  gl_Position=uVP*vec4(p,1.0);
}`;
var SEG_FS = `#version 300 es
precision highp float;
in vec2 vQ; in vec4 vC; in float vFlow;
uniform float uTime; out vec4 outColor;
void main(){
  float x=vQ.x; float along=vQ.y*0.5+0.5;
  float core=exp(-x*x*7.0);
  float glow=exp(-x*x*1.4);
  float ends=smoothstep(0.0,0.04,along)*smoothstep(1.0,0.94,along);
  float flow=0.75+0.25*sin(along*46.0 - uTime*11.0 + vFlow);
  float a=(core*1.15+glow*0.42)*vC.a*ends*flow;
  outColor=vec4(vC.rgb*a,1.0);
}`;

/* ---------- shield ellipsoid ---------- */
var SHIELD_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
uniform mat4 uVP; uniform mat4 uModel; uniform vec3 uInvScale2;
out vec3 vN; out vec3 vW; out vec2 vUv; out vec3 vLocal;
void main(){
  vec4 w=uModel*vec4(aPos,1.0);
  vW=w.xyz; vN=normalize(mat3(uModel)*(aNormal*uInvScale2)); vUv=aUv; vLocal=aPos;
  gl_Position=uVP*w;
}`;
var SHIELD_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vW; in vec2 vUv; in vec3 vLocal;
uniform vec3 uCamPos; uniform float uTime; uniform float uOpen; uniform float uOpacity;
out vec4 outColor;
void main(){
  float age=uTime-uOpen;
  if(age<0.0){ discard; }
  float open=smoothstep(0.0,1.1,age);
  vec3 N=normalize(vN), V=normalize(uCamPos-vW);
  float fres=pow(1.0-abs(dot(N,V)),2.6);
  float wave=exp(-pow((vLocal.x-(age*2.6-1.4))*1.7,2.0));
  float rip=0.5+0.5*sin(vUv.y*34.0 - uTime*2.2 + vUv.x*9.0);
  float lines=pow(0.5+0.5*sin(vUv.x*70.0+vUv.y*24.0-uTime*1.6),10.0);
  float a=open*(fres*0.55 + lines*0.30 + rip*0.05) + wave*0.55*open;
  a*=uOpacity;
  vec3 col=mix(vec3(0.10,0.45,0.95), vec3(0.55,0.92,1.0), fres);
  col+=vec3(0.25,0.6,1.0)*wave;
  outColor=vec4(col*a*1.25,1.0);
}`;

/* ---------- bloom bright-pass / blur / composite ---------- */
var BRIGHT_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; out vec4 outColor;
void main(){
  vec3 c=texture(uTex, gl_FragCoord.xy/uRes).rgb;
  float l=max(max(c.r,c.g),c.b);
  float k=smoothstep(0.55,1.25,l);
  outColor=vec4(c*k,1.0);
}`;
var BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform vec2 uDir; out vec4 outColor;
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 t=uDir/uRes;
  vec3 c=texture(uTex,uv).rgb*0.227;
  c+=texture(uTex,uv+t*1.3846).rgb*0.316;
  c+=texture(uTex,uv-t*1.3846).rgb*0.316;
  c+=texture(uTex,uv+t*3.2308).rgb*0.070;
  c+=texture(uTex,uv-t*3.2308).rgb*0.070;
  outColor=vec4(c,1.0);
}`;
var COMP_FS = `#version 300 es
precision highp float;
` + NOISE + `
uniform sampler2D uScene; uniform sampler2D uBloom; uniform vec2 uRes;
uniform float uBloomStrength; out vec4 outColor;
const vec3 LUMA=vec3(0.299,0.587,0.114);
vec3 sc(vec2 uv){ return texture(uScene,uv).rgb; }
/* conservative edge-only FXAA on the HDR scene: softens hard voxel silhouettes
   without blurring flat surfaces or the glow fields */
vec3 fxaa(vec2 uv, vec2 rcp){
  vec3 c=sc(uv);
  vec3 n=sc(uv+vec2(0.0,rcp.y)), s=sc(uv+vec2(0.0,-rcp.y));
  vec3 e=sc(uv+vec2(rcp.x,0.0)), w=sc(uv+vec2(-rcp.x,0.0));
  vec3 nw=sc(uv+vec2(-rcp.x,rcp.y)), ne=sc(uv+vec2(rcp.x,rcp.y));
  vec3 sw=sc(uv+vec2(-rcp.x,-rcp.y)), se=sc(uv+vec2(rcp.x,-rcp.y));
  float lC=dot(c,LUMA),lN=dot(n,LUMA),lS=dot(s,LUMA),lE=dot(e,LUMA),lW=dot(w,LUMA);
  float lNW=dot(nw,LUMA),lNE=dot(ne,LUMA),lSW=dot(sw,LUMA),lSE=dot(se,LUMA);
  float lMin=min(lC,min(min(lN,lS),min(lE,lW)));
  float lMax=max(lC,max(max(lN,lS),max(lE,lW)));
  if(lMax-lMin < max(0.02,lMax*0.10)) return c;
  float h=abs(lNW+lNE-2.0*lN)+2.0*abs(lN+lS-2.0*lC)+abs(lSW+lSE-2.0*lS);
  float vt=abs(lNW+lSW-2.0*lW)+2.0*abs(lW+lE-2.0*lC)+abs(lNE+lSE-2.0*lE);
  vec2 dir=(h>vt)?vec2(0.0,rcp.y):vec2(rcp.x,0.0);
  vec3 blend=(sc(uv+dir)+sc(uv-dir)+c*2.0)*0.25;
  return mix(c,blend,0.5);
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec3 c=fxaa(uv,1.0/uRes);
  vec3 b=texture(uBloom,uv).rgb;
  c+=b*uBloomStrength;
  // filmic tonemap (ACES-ish)
  c=(c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14);
  // subtle vignette
  float v=smoothstep(1.25,0.35,length(uv-0.5)*1.55);
  c*=mix(0.72,1.0,v);
  // gentle cool lift in shadows
  c+=vec3(0.004,0.008,0.016)*(1.0-v);
  c=pow(max(c,0.0),vec3(1.0/2.2));
  float g=hash13(vec3(gl_FragCoord.xy,7.0))-0.5;
  c+=g*0.012;
  outColor=vec4(c,1.0);
}`;

/* ============================================================
   GFX object
   ============================================================ */
var GFX = {
  gl:null, canvas:null, W:0, H:0,
  hdr:false,
  env: {
    lightDir:[0.42,0.55,0.72], lightCol:[1.0,0.93,0.80], ambCol:[0.32,0.42,0.62],
    fogCol:[0.010,0.016,0.034], fog:0.00011, emisBoost:1.6, emisGain:1.0, bloom:0.78, bgScale:1.0
  },
  cam:{eye:[0,0,0],fwd:[0,0,-1],right:[1,0,0],up:[0,1,0],VP:m4identity(),t:0},
};

GFX.init = function(canvas){
  var gl=canvas.getContext('webgl2',{antialias:false,alpha:false,depth:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  if(!gl){ return false; }
  GFX.gl=gl; GFX.canvas=canvas;
  gl.getExtension('EXT_color_buffer_float');
  GFX.hdr = !!gl.getExtension('EXT_color_buffer_float');
  GFX._buildCube();
  GFX._buildQuad();
  GFX._buildSphere();
  GFX._buildPrograms();
  GFX._buildFullscreenVAO();
  GFX._allocFX();
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  return true;
};

/* cube mesh: 36 verts (pos3, normal3, uv2) */
GFX._cubeVBO=null;
GFX._buildCube=function(){
  var gl=GFX.gl;
  var faces=[
    {n:[1,0,0],  v:[[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]},
    {n:[-1,0,0], v:[[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]]},
    {n:[0,1,0],  v:[[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]]},
    {n:[0,-1,0], v:[[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]]},
    {n:[0,0,1],  v:[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]},
    {n:[0,0,-1], v:[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]}
  ];
  var uv=[[0,0],[1,0],[1,1],[0,1]];
  var data=[];
  for(var f=0;f<6;f++){
    var F=faces[f], idx=[0,1,2,0,2,3];
    for(var k=0;k<6;k++){
      var j=idx[k]; var vv=F.v[j];
      data.push(vv[0],vv[1],vv[2], F.n[0],F.n[1],F.n[2], uv[j][0],uv[j][1]);
    }
  }
  GFX._cubeVBO=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,GFX._cubeVBO);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
};

/* unit quad 6 verts vec2 */
GFX._quadVBO=null;
GFX._buildQuad=function(){
  var gl=GFX.gl;
  var q=[-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1];
  GFX._quadVBO=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,GFX._quadVBO);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(q),gl.STATIC_DRAW);
};

/* UV sphere for shields: pos3, normal3, uv2 + indices */
GFX._sphereVBO=null; GFX._sphereIBO=null; GFX._sphereCount=0;
GFX._buildSphere=function(){
  var gl=GFX.gl;
  var NU=28, NV=18, data=[], idx=[];
  for(var y=0;y<=NV;y++){
    var v=y/NV, phi=v*Math.PI;
    for(var x=0;x<=NU;x++){
      var u=x/NU, th=u*Math.PI*2;
      var px=Math.sin(phi)*Math.cos(th), py=Math.cos(phi), pz=Math.sin(phi)*Math.sin(th);
      data.push(px,py,pz, px,py,pz, u,v);
    }
  }
  for(var y=0;y<NV;y++) for(var x=0;x<NU;x++){
    var a=y*(NU+1)+x, b=a+NU+1;
    idx.push(a,b,a+1, b,b+1,a+1);
  }
  GFX._sphereVBO=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,GFX._sphereVBO);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
  GFX._sphereIBO=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,GFX._sphereIBO);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);
  GFX._sphereCount=idx.length;
};

GFX._buildPrograms=function(){
  var gl=GFX.gl;
  GFX.pSolid={p:program(gl,SOLID_VS,SOLID_FS)};
  GFX.pSolid.u=uniforms(gl,GFX.pSolid.p,['uVP','uModel','uCamPos','uLightDir','uLightCol','uAmbCol','uFogCol','uFog','uEmisBoost','uEmisGain']);
  GFX.pBg={p:program(gl,FS_VS,BG_FS)};
  GFX.pBg.u=uniforms(gl,GFX.pBg.p,['uRes','uFwd','uRight','uUp','uTan','uAspect','uTime','uLightDir','uPlanetDir','uBgScale']);
  GFX.pSprite={p:program(gl,SPRITE_VS,SPRITE_FS)};
  GFX.pSprite.u=uniforms(gl,GFX.pSprite.p,['uVP','uCamRight','uCamUp']);
  GFX.pSeg={p:program(gl,SEG_VS,SEG_FS)};
  GFX.pSeg.u=uniforms(gl,GFX.pSeg.p,['uVP','uCamPos','uTime']);
  GFX.pShield={p:program(gl,SHIELD_VS,SHIELD_FS)};
  GFX.pShield.u=uniforms(gl,GFX.pShield.p,['uVP','uModel','uInvScale2','uCamPos','uTime','uOpen','uOpacity']);
  GFX.pBright={p:program(gl,FS_VS,BRIGHT_FS)};
  GFX.pBright.u=uniforms(gl,GFX.pBright.p,['uTex','uRes']);
  GFX.pBlur={p:program(gl,FS_VS,BLUR_FS)};
  GFX.pBlur.u=uniforms(gl,GFX.pBlur.p,['uTex','uRes','uDir']);
  GFX.pComp={p:program(gl,FS_VS,COMP_FS)};
  GFX.pComp.u=uniforms(gl,GFX.pComp.p,['uScene','uBloom','uRes','uBloomStrength']);
};

GFX._fsVAO=null;
GFX._buildFullscreenVAO=function(){ GFX._fsVAO=GFX.gl.createVertexArray(); };

/* dynamic FX buffers */
GFX._allocFX=function(){
  var gl=GFX.gl;
  GFX.MAXSPR=9000; GFX.MAXSEG=6000;
  GFX.sprData=new Float32Array(GFX.MAXSPR*9);
  GFX.segData=new Float32Array(GFX.MAXSEG*12);
  // sprite VAO
  GFX.sprVAO=gl.createVertexArray(); gl.bindVertexArray(GFX.sprVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER,GFX._quadVBO);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
  GFX.sprIB=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,GFX.sprIB);
  gl.bufferData(gl.ARRAY_BUFFER,GFX.sprData.byteLength,gl.DYNAMIC_DRAW);
  var st=9*4;
  [[1,3,0],[2,1,12],[3,4,16],[4,1,32]].forEach(function(a){
    gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0],a[1],gl.FLOAT,false,st,a[2]); gl.vertexAttribDivisor(a[0],1);
  });
  // segment VAO
  GFX.segVAO=gl.createVertexArray(); gl.bindVertexArray(GFX.segVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER,GFX._quadVBO);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
  GFX.segIB=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,GFX.segIB);
  gl.bufferData(gl.ARRAY_BUFFER,GFX.segData.byteLength,gl.DYNAMIC_DRAW);
  var st2=12*4;
  [[1,3,0],[2,3,12],[3,1,24],[4,4,28],[5,1,44]].forEach(function(a){
    gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0],a[1],gl.FLOAT,false,st2,a[2]); gl.vertexAttribDivisor(a[0],1);
  });
  gl.bindVertexArray(null);
};

/* voxel prototype from a Float32Array (10 floats/cube) */
GFX.makeVoxProto=function(data,count){
  var gl=GFX.gl;
  var vao=gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER,GFX._cubeVBO);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,32,0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,32,12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,2,gl.FLOAT,false,32,24);
  var ib=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,ib);
  gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,3,gl.FLOAT,false,40,0); gl.vertexAttribDivisor(3,1);
  gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4,3,gl.FLOAT,false,40,12); gl.vertexAttribDivisor(4,1);
  gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5,4,gl.FLOAT,false,40,24); gl.vertexAttribDivisor(5,1);
  gl.bindVertexArray(null);
  return {vao:vao,count:count};
};

/* framebuffer targets */
function makeTarget(w,h,hdr){
  var gl=GFX.gl;
  var fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
  var tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0, hdr?gl.RGBA16F:gl.RGBA8, w,h,0, gl.RGBA, hdr?gl.HALF_FLOAT:gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  var depth=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,depth);
  gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
  var ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(!ok){ gl.deleteFramebuffer(fb); gl.deleteTexture(tex); gl.deleteRenderbuffer(depth); return null; }
  return {fb:fb,tex:tex,depth:depth,w:w,h:h};
}
function delTarget(t){ if(!t)return; var gl=GFX.gl; gl.deleteFramebuffer(t.fb); gl.deleteTexture(t.tex); gl.deleteRenderbuffer(t.depth); }

GFX.resize=function(W,H){
  var gl=GFX.gl;
  W=Math.max(2,W|0); H=Math.max(2,H|0);
  if(W===GFX.W && H===GFX.H) return;
  GFX.W=W; GFX.H=H;
  GFX.canvas.width=W; GFX.canvas.height=H;
  [GFX.tScene,GFX.tBrightA,GFX.tBlurB].forEach(delTarget);
  GFX.tScene=makeTarget(W,H,GFX.hdr);
  if(!GFX.tScene && GFX.hdr){ GFX.hdr=false; GFX.tScene=makeTarget(W,H,false); }
  var qw=Math.max(2,Math.floor(W/4)), qh=Math.max(2,Math.floor(H/4));
  GFX.tBrightA=makeTarget(qw,qh,GFX.hdr);
  GFX.tBlurB=makeTarget(qw,qh,GFX.hdr);
};

GFX.setCamera=function(eye,tgt,up,fovDeg,t){
  var gl=GFX.gl;
  var fwd=vnorm(vsub(tgt,eye));
  var right=vnorm(vcross(fwd,up));
  var nup=vcross(right,fwd);
  var asp=GFX.W/GFX.H;
  var proj=m4perspective(fovDeg*Math.PI/180,asp,0.35,7000);
  var view=m4lookAt(eye,tgt,up);
  GFX.cam.eye=eye; GFX.cam.fwd=fwd; GFX.cam.right=right; GFX.cam.up=nup;
  GFX.cam.VP=m4mul(proj,view); GFX.cam.t=t;
  GFX.cam.tan=Math.tan(fovDeg*Math.PI/360);
  GFX.cam.asp=asp;
};

GFX.beginFrame=function(){
  var gl=GFX.gl, c=GFX.cam, e=GFX.env;
  gl.bindFramebuffer(gl.FRAMEBUFFER,GFX.tScene.fb);
  gl.viewport(0,0,GFX.W,GFX.H);
  gl.clearColor(e.fogCol[0],e.fogCol[1],e.fogCol[2],1);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  // background
  gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND);
  var p=GFX.pBg; gl.useProgram(p.p);
  gl.uniform2f(p.u.uRes,GFX.W,GFX.H);
  U(gl,p.u,'uFwd',c.fwd); U(gl,p.u,'uRight',c.right); U(gl,p.u,'uUp',c.up);
  U1(gl,p.u,'uTan',c.tan); U1(gl,p.u,'uAspect',c.asp); U1(gl,p.u,'uTime',c.t);
  U(gl,p.u,'uLightDir',vnorm(e.lightDir));
  U(gl,p.u,'uPlanetDir',vnorm([-0.55,0.15,-0.75]));
  U1(gl,p.u,'uBgScale',e.bgScale);
  gl.bindVertexArray(GFX._fsVAO);
  gl.drawArrays(gl.TRIANGLES,0,3);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
};

GFX.solid=function(proto,model){
  if(!proto||!proto.count) return;
  var gl=GFX.gl, c=GFX.cam, e=GFX.env, p=GFX.pSolid;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.u.uVP,false,c.VP);
  gl.uniformMatrix4fv(p.u.uModel,false,model||m4identity());
  U(gl,p.u,'uCamPos',c.eye);
  U(gl,p.u,'uLightDir',vnorm(e.lightDir));
  U(gl,p.u,'uLightCol',e.lightCol);
  U(gl,p.u,'uAmbCol',e.ambCol);
  U(gl,p.u,'uFogCol',e.fogCol);
  U1(gl,p.u,'uFog',e.fog);
  U1(gl,p.u,'uEmisBoost',e.emisBoost);
  U1(gl,p.u,'uEmisGain',e.emisGain==null?1.0:e.emisGain);
  gl.bindVertexArray(proto.vao);
  gl.drawArraysInstanced(gl.TRIANGLES,0,36,proto.count);
};

GFX.shield=function(model,openTime,opacity){
  GFX._ensureSphereVAO();
  var gl=GFX.gl, c=GFX.cam, p=GFX.pShield;
  var s0=Math.hypot(model[0],model[1],model[2])||1;
  var s1=Math.hypot(model[4],model[5],model[6])||1;
  var s2=Math.hypot(model[8],model[9],model[10])||1;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.u.uVP,false,c.VP);
  gl.uniformMatrix4fv(p.u.uModel,false,model);
  gl.uniform3f(p.u.uInvScale2,1/(s0*s0),1/(s1*s1),1/(s2*s2));
  U(gl,p.u,'uCamPos',c.eye);
  U1(gl,p.u,'uTime',c.t);
  U1(gl,p.u,'uOpen',openTime);
  U1(gl,p.u,'uOpacity',opacity);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE); gl.depthMask(false);
  gl.bindVertexArray(GFX._sphereVAO);
  gl.drawElements(gl.TRIANGLES,GFX._sphereCount,gl.UNSIGNED_SHORT,0);
  gl.depthMask(true); gl.disable(gl.BLEND);
};

GFX._sphereVAO=null;
(function(){ /* built lazily */ })();
GFX._ensureSphereVAO=function(){
  if(GFX._sphereVAO) return;
  var gl=GFX.gl; GFX._sphereVAO=gl.createVertexArray(); gl.bindVertexArray(GFX._sphereVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER,GFX._sphereVBO);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,32,0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,32,12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,2,gl.FLOAT,false,32,24);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,GFX._sphereIBO);
  gl.bindVertexArray(null);
};

/* FX: pass arrays of plain objects; we pack into GPU buffers. */
GFX.sprites=function(list){
  var n=Math.min(list.length,GFX.MAXSPR); if(!n)return;
  var d=GFX.sprData;
  for(var i=0;i<n;i++){
    var s=list[i], o=i*9;
    d[o]=s.p[0]; d[o+1]=s.p[1]; d[o+2]=s.p[2];
    d[o+3]=s.size;
    d[o+4]=s.c[0]; d[o+5]=s.c[1]; d[o+6]=s.c[2]; d[o+7]=s.a==null?1:s.a;
    d[o+8]=s.rot||0;
  }
  var gl=GFX.gl, c=GFX.cam, p=GFX.pSprite;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.u.uVP,false,c.VP);
  U(gl,p.u,'uCamRight',c.right); U(gl,p.u,'uCamUp',c.up);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE); gl.depthMask(false);
  gl.bindVertexArray(GFX.sprVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER,GFX.sprIB);
  gl.bufferSubData(gl.ARRAY_BUFFER,0,d.subarray(0,n*9));
  gl.drawArraysInstanced(gl.TRIANGLES,0,6,n);
  gl.depthMask(true); gl.disable(gl.BLEND);
};

GFX.segments=function(list){
  var n=Math.min(list.length,GFX.MAXSEG); if(!n)return;
  var d=GFX.segData;
  for(var i=0;i<n;i++){
    var s=list[i], o=i*12;
    d[o]=s.a[0]; d[o+1]=s.a[1]; d[o+2]=s.a[2];
    d[o+3]=s.b[0]; d[o+4]=s.b[1]; d[o+5]=s.b[2];
    d[o+6]=s.w;
    d[o+7]=s.c[0]; d[o+8]=s.c[1]; d[o+9]=s.c[2]; d[o+10]=s.a0==null?1:s.a0;
    d[o+11]=s.flow||0;
  }
  var gl=GFX.gl, c=GFX.cam, p=GFX.pSeg;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.u.uVP,false,c.VP);
  U(gl,p.u,'uCamPos',c.eye); U1(gl,p.u,'uTime',c.t);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE); gl.depthMask(false);
  gl.bindVertexArray(GFX.segVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER,GFX.segIB);
  gl.bufferSubData(gl.ARRAY_BUFFER,0,d.subarray(0,n*12));
  gl.drawArraysInstanced(gl.TRIANGLES,0,6,n);
  gl.depthMask(true); gl.disable(gl.BLEND);
};

function drawFS(p,setup){
  var gl=GFX.gl; gl.useProgram(p.p); setup(p); gl.bindVertexArray(GFX._fsVAO); gl.drawArrays(gl.TRIANGLES,0,3);
}

GFX.endFrame=function(){
  var gl=GFX.gl, e=GFX.env;
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
  // bright pass: scene -> tBrightA (quarter)
  if(GFX.tBrightA && GFX.tBlurB){
    gl.bindFramebuffer(gl.FRAMEBUFFER,GFX.tBrightA.fb); gl.viewport(0,0,GFX.tBrightA.w,GFX.tBrightA.h);
    var p=GFX.pBright;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,GFX.tScene.tex);
    drawFS(p,function(pp){ gl.uniform1i(pp.u.uTex,0); gl.uniform2f(pp.u.uRes,GFX.tBrightA.w,GFX.tBrightA.h); });
    // blur H: brightA -> blurB
    var pb=GFX.pBlur;
    gl.bindFramebuffer(gl.FRAMEBUFFER,GFX.tBlurB.fb); gl.viewport(0,0,GFX.tBlurB.w,GFX.tBlurB.h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,GFX.tBrightA.tex);
    drawFS(pb,function(pp){ gl.uniform1i(pp.u.uTex,0); gl.uniform2f(pp.u.uRes,GFX.tBrightA.w,GFX.tBrightA.h); gl.uniform2f(pp.u.uDir,1,0); });
    // blur V: blurB -> brightA
    gl.bindFramebuffer(gl.FRAMEBUFFER,GFX.tBrightA.fb); gl.viewport(0,0,GFX.tBrightA.w,GFX.tBrightA.h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,GFX.tBlurB.tex);
    drawFS(pb,function(pp){ gl.uniform1i(pp.u.uTex,0); gl.uniform2f(pp.u.uRes,GFX.tBrightA.w,GFX.tBrightA.h); gl.uniform2f(pp.u.uDir,0,1); });
  }
  // composite -> screen
  gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,GFX.W,GFX.H);
  var pc=GFX.pComp;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,GFX.tScene.tex);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,GFX.tBrightA?GFX.tBrightA.tex:GFX.tScene.tex);
  drawFS(pc,function(pp){
    gl.uniform1i(pp.u.uScene,0); gl.uniform1i(pp.u.uBloom,1);
    gl.uniform2f(pp.u.uRes,GFX.W,GFX.H);
    gl.uniform1f(pp.u.uBloomStrength,e.bloom);
  });
  gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
};

/* expose math helpers for other files */
GFX.v={v3:v3,vadd:vadd,vsub:vsub,vscale:vscale,vdot:vdot,vcross:vcross,vlen:vlen,vnorm:vnorm};
GFX.m4={compose:m4compose,identity:m4identity,mul:m4mul,normalMat3:normalMat3};

window.GFX=GFX;
})();
