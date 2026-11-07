/* PRISM WebGL2 renderer */
(function () {
  const AE = window.AE, U = AE.U, M = AE.M, G = AE.G, T = AE.Text, Mesh = AE.Mesh, E = AE.Eval, P = AE.P, B = AE.Build, Nodes = AE.Nodes, Particles = AE.Particles;
  const COMP = 'COMP';
  const MAX_TEX = 16384;

  const SH = {};
  SH.flatVS = `#version 300 es
layout(location=0) in vec2 aPos; layout(location=1) in vec4 aColor;
uniform mat3 uMat; uniform vec2 uRes; out vec4 vColor;
void main(){ vec3 p=uMat*vec3(aPos,1.0); gl_Position=vec4(p.x/uRes.x*2.0-1.0, 1.0-p.y/uRes.y*2.0, 0.0, 1.0); vColor=aColor; }`;
  SH.flatFS = `#version 300 es
precision highp float; in vec4 vColor; out vec4 fragColor;
void main(){ fragColor=vColor; }`;
  SH.texVS = `#version 300 es
layout(location=0) in vec2 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aColor;
uniform mat3 uMat; uniform vec2 uRes; out vec2 vUv; out vec4 vColor;
void main(){ vec3 p=uMat*vec3(aPos,1.0); gl_Position=vec4(p.x/uRes.x*2.0-1.0, 1.0-p.y/uRes.y*2.0, 0.0, 1.0); vUv=aUv; vColor=aColor; }`;
  SH.texFS = `#version 300 es
precision highp float; uniform sampler2D uTex; in vec2 vUv; in vec4 vColor; out vec4 fragColor;
void main(){ vec4 c=texture(uTex,vUv); fragColor=vec4(c.rgb*vColor.rgb, c.a*vColor.a); }`;
  SH.fullVS = `#version 300 es
layout(location=0) in vec2 aPos; out vec2 vUv;
void main(){ vUv=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }`;
  SH.compFS = `#version 300 es
precision highp float; uniform sampler2D uSrc,uDst,uMatte; uniform float uOpacity; uniform int uBlend,uUseMatte,uMatteMode,uPremul; uniform vec2 uSrcOffset;
in vec2 vUv; out vec4 fragColor;
vec3 blendMode(int m, vec3 d, vec3 s){
  if(m==1) return d+s;
  if(m==2) return 1.0-(1.0-d)*(1.0-s);
  if(m==3) return d*s;
  if(m==4) return mix(2.0*d*s, 1.0-2.0*(1.0-d)*(1.0-s), step(0.5,d));
  return s;
}
void main(){
  vec4 s=texture(uSrc, vUv+uSrcOffset); vec4 d=texture(uDst,vUv);
  float a=s.a;
  if(uUseMatte==1){ vec4 m=texture(uMatte,vUv); float k;
    if(uMatteMode==0) k=m.a; else if(uMatteMode==1) k=1.0-m.a;
    else if(uMatteMode==2) k=dot(m.rgb,vec3(0.2126,0.7152,0.0722))*m.a;
    else k=1.0-dot(m.rgb,vec3(0.2126,0.7152,0.0722))*m.a;
    a*=clamp(k,0.0,1.0);
  }
  a*=uOpacity;
  vec3 srcRgb=s.rgb;
  if(uPremul==1) srcRgb=s.rgb; else srcRgb=s.rgb;
  vec3 bl=blendMode(uBlend,d.rgb,srcRgb);
  float outA=a+d.a*(1.0-a);
  vec3 outRgb;
  if(uPremul==1){ outRgb=s.rgb + d.rgb*(1.0-a); }
  else { outRgb=(bl*a + d.rgb*d.a*(1.0-a))/max(outA,0.0001); }
  fragColor=vec4(outRgb,outA);
}`;
  SH.unpremulFS = `#version 300 es
precision highp float; uniform sampler2D uTex; in vec2 vUv; out vec4 fragColor;
void main(){ vec4 c=texture(uTex,vUv); float a=max(c.a,0.00001); fragColor=vec4(c.rgb/a,c.a); }`;
  SH.displayFS = `#version 300 es
precision highp float; uniform sampler2D uTex; uniform vec3 uBg; in vec2 vUv; out vec4 fragColor;
void main(){ vec4 c=texture(uTex,vUv); fragColor=vec4(mix(uBg,c.rgb,c.a),1.0); }`;
  SH.blurFS = `#version 300 es
precision highp float; uniform sampler2D uTex; uniform vec2 uTexel,uDir; uniform float uRadius; in vec2 vUv; out vec4 fragColor;
void main(){
  float w[5]; w[0]=0.227027; w[1]=0.1945946; w[2]=0.1216216; w[3]=0.054054; w[4]=0.016216;
  vec4 sum=texture(uTex,vUv)*w[0];
  for(int i=1;i<=4;i++){ vec2 off=uDir*uTexel*float(i)*uRadius*0.50; sum+=texture(uTex,vUv+off)*w[i]; sum+=texture(uTex,vUv-off)*w[i]; }
  fragColor=sum;
}`;
  SH.thresholdFS = `#version 300 es
precision highp float; uniform sampler2D uTex; uniform float uThreshold; in vec2 vUv; out vec4 fragColor;
void main(){ vec4 c=texture(uTex,vUv); float l=dot(c.rgb,vec3(0.2126,0.7152,0.0722)); fragColor=l>uThreshold?c:vec4(0.0); }`;
  SH.glowAddFS = `#version 300 es
precision highp float; uniform sampler2D uTex,uGlow; uniform vec3 uColor; uniform float uIntensity; in vec2 vUv; out vec4 fragColor;
void main(){ vec4 b=texture(uTex,vUv); vec4 g=texture(uGlow,vUv); fragColor=vec4(b.rgb+g.rgb*uColor*uIntensity, clamp(b.a+g.a*uIntensity,0.0,1.0)); }`;
  SH.shadowPrepFS = `#version 300 es
precision highp float; uniform sampler2D uTex; uniform vec2 uOffset; uniform vec3 uColor; uniform float uOpacity; in vec2 vUv; out vec4 fragColor;
void main(){ float a=texture(uTex,vUv-uOffset).a*uOpacity; fragColor=vec4(uColor,a); }`;
  SH.shadowCompFS = `#version 300 es
precision highp float; uniform sampler2D uTex,uShadow; in vec2 vUv; out vec4 fragColor;
void main(){ vec4 b=texture(uTex,vUv); vec4 s=texture(uShadow,vUv); float a=s.a+b.a*(1.0-s.a); vec3 c=a>0.0001?(s.rgb*s.a+b.rgb*b.a*(1.0-s.a))/a:vec3(0.0); fragColor=vec4(c,a); }`;
  SH.colorFS = `#version 300 es
precision highp float; uniform sampler2D uTex; uniform int uMode; uniform float uHue,uSat,uBright,uContrast,uAmount,uRadius,uSoft,uTime,uAngle; uniform vec2 uTexel; in vec2 vUv; out vec4 fragColor;
vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1e-10; return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)), d/(q.x+e), q.x); }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec4 c=texture(uTex,vUv);
  if(uMode==0){
    vec3 h=rgb2hsv(c.rgb); h.x=fract(h.x+uHue+1.0); h.y=clamp(h.y*uSat/100.0,0.0,3.0); vec3 rgb=hsv2rgb(h);
    rgb=(rgb-0.5)*(uContrast/100.0)+0.5; rgb*=(uBright/100.0);
    fragColor=vec4(rgb,c.a);
  } else if(uMode==1){
    vec2 p=vUv-0.5; float d=length(p*vec2(1.0,1.0))*1.41421;
    float v=1.0-uAmount*smoothstep(uRadius,uRadius+uSoft,d);
    fragColor=vec4(c.rgb*v,c.a);
  } else if(uMode==2){
    float n=hash(vUv*vec2(1920.0,1080.0)+uTime*61.7)-0.5;
    fragColor=vec4(c.rgb+n*uAmount,c.a);
  } else if(uMode==3){
    float a=radians(uAngle); vec2 dir=vec2(cos(a),sin(a))*uAmount*uTexel;
    vec3 rgb=vec3(texture(uTex,vUv+dir).r, c.g, texture(uTex,vUv-dir).b);
    fragColor=vec4(rgb,c.a);
  } else {
    fragColor=c;
  }
}`;
  SH.maskInvFS = `#version 300 es
precision highp float; uniform sampler2D uTex; in vec2 vUv; out vec4 fragColor;
void main(){ float a=1.0-texture(uTex,vUv).a; fragColor=vec4(a,a,a,a); }`;
  SH.maskPrepFS = `#version 300 es
precision highp float; uniform sampler2D uTex; uniform float uOpacity; in vec2 vUv; out vec4 fragColor;
void main(){ float c=texture(uTex,vUv).a*uOpacity; fragColor=vec4(c); }`;
  SH.maskApplyFS = `#version 300 es
precision highp float; uniform sampler2D uTex,uMask; in vec2 vUv; out vec4 fragColor;
void main(){ vec4 c=texture(uTex,vUv); float m=texture(uMask,vUv).a; fragColor=vec4(c.rgb,c.a*m); }`;
  SH.mixMaskFS = `#version 300 es
precision highp float; uniform sampler2D uBase,uFx,uMask; uniform float uOpacity; in vec2 vUv; out vec4 fragColor;
void main(){ vec4 b=texture(uBase,vUv); vec4 f=texture(uFx,vUv); float m=texture(uMask,vUv).a*uOpacity; fragColor=mix(b,f,clamp(m,0.0,1.0)); }`;
  SH.copyFS = `#version 300 es
precision highp float; uniform sampler2D uTex; in vec2 vUv; out vec4 fragColor; void main(){ fragColor=texture(uTex,vUv); }`;
  SH.accumFS = `#version 300 es
precision highp float; uniform sampler2D uTex; uniform float uWeight; in vec2 vUv; out vec4 fragColor;
void main(){ fragColor=texture(uTex,vUv)*uWeight; }`;
  SH.dofFS = `#version 300 es
precision highp float; uniform sampler2D uTex,uDepth; uniform vec2 uTexel; uniform float uFocus,uNear,uFar,uAperture; in vec2 vUv; out vec4 fragColor;
float linDepth(float d){ float z=d*2.0-1.0; return (2.0*uNear*uFar)/(uFar+uNear-z*(uFar-uNear)); }
void main(){
  float d=linDepth(texture(uDepth,vUv).r);
  float coc=clamp(abs(d-uFocus)/max(d,1.0)*uAperture*20.0,0.0,16.0);
  vec4 sum=texture(uTex,vUv)*2.0; float tot=2.0;
  vec2 dirs[6]; dirs[0]=vec2(1.0,0.0); dirs[1]=vec2(-.5,.866); dirs[2]=vec2(-.5,-.866); dirs[3]=vec2(.7,.7); dirs[4]=vec2(-.7,.7); dirs[5]=vec2(0.0,-1.0);
  for(int i=0;i<6;i++){
    vec4 a=texture(uTex,vUv+dirs[i]*coc*uTexel);
    vec4 b=texture(uTex,vUv+dirs[i]*coc*uTexel*0.45);
    sum+=a+b; tot+=2.0;
  }
  fragColor=sum/tot;
}`;
  SH.dofCombineFS = `#version 300 es
precision highp float; uniform sampler2D uSharp,uBlur,uDepth; uniform float uFocus,uNear,uFar,uAperture; in vec2 vUv; out vec4 fragColor;
void main(){
  vec4 s=texture(uSharp,vUv); vec4 b=texture(uBlur,vUv);
  float z=texture(uDepth,vUv).r*2.0-1.0; float d=(2.0*uNear*uFar)/(uFar+uNear-z*(uFar-uNear));
  float coc=clamp(abs(d-uFocus)/max(d,1.0)*uAperture*22.0,0.0,1.0);
  fragColor=mix(s,b,smoothstep(0.0,0.8,coc));
}`;
  SH.meshVS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUv; layout(location=3) in float aRegion;
uniform mat4 uVP,uModel; out vec3 vWorld; out vec3 vNormal; out vec2 vUv; out float vRegion;
void main(){ vec4 w=uModel*vec4(aPos,1.0); vWorld=w.xyz; vNormal=mat3(uModel)*aNrm; vUv=aUv; vRegion=aRegion; gl_Position=uVP*w; }`;
  SH.meshFS = `#version 300 es
precision highp float;
uniform vec3 uBase[3]; uniform float uMetal[3],uRough[3],uEmis[3]; uniform vec3 uEmisColor[3];
uniform vec3 uCamPos; uniform vec3 uDirL[2],uDirC[2]; uniform float uDirI[2]; uniform int uDirCount;
uniform vec3 uPointP[3],uPointC[3]; uniform float uPointI[3],uPointR[3]; uniform int uPointCount;
uniform sampler2D uEnv,uShadow,uTex; uniform mat4 uLightVP; uniform float uShadowStrength,uEnvStrength,uReflect,uOpacity,uShadowTexel;
uniform int uUseTex,uUnlit,uHasShadow;
in vec3 vWorld; in vec3 vNormal; in vec2 vUv; in float vRegion; out vec4 fragColor;
float shadowAt(vec3 wp){
  if(uHasShadow==0) return 1.0;
  vec4 lp=uLightVP*vec4(wp,1.0); vec3 pc=lp.xyz/lp.w*0.5+0.5;
  if(pc.x<0.002||pc.x>0.998||pc.y<0.002||pc.y>0.998||pc.z>1.0) return 1.0;
  float bias=0.0022,sum=0.0;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++){
    float d=texture(uShadow,pc.xy+vec2(float(x),float(y))*uShadowTexel).r;
    sum += (pc.z-bias<=d)?1.0:0.0;
  }
  return mix(1.0,sum/9.0,uShadowStrength);
}
void main(){
  int reg=int(vRegion+0.5); int slot=reg<2?0:(reg==2?1:2);
  vec3 base=uBase[slot]; float metal=uMetal[slot]; float rough=clamp(uRough[slot],0.03,1.0); float emis=uEmis[slot];
  float opacity=uOpacity;
  vec4 tex=vec4(1.0);
  if(uUseTex==1){ tex=texture(uTex,vUv); base*=tex.rgb; opacity*=tex.a; }
  if(uUnlit==1){ vec3 c=base; fragColor=vec4(c*opacity,opacity); return; }
  vec3 N=normalize(vNormal); if(!gl_FrontFacing) N=-N;
  vec3 V=normalize(uCamPos-vWorld); if(dot(N,V)<0.0) N=-N;
  vec3 col=vec3(0.0);
  // direct lights
  for(int i=0;i<2;i++){ if(i>=uDirCount) break;
    vec3 L=normalize(uDirL[i]); vec3 H=normalize(L+V); float NdotL=max(dot(N,L),0.0); float NdotV=max(dot(N,V),0.0);
    if(NdotL>0.0 && NdotV>0.0){
      float a=max(rough*rough,0.002); float a2=a*a;
      float d=(dot(N,H)*dot(N,H)-1.0)/(a2-1.0); d=d*d/3.14159;
      float k=(rough+1.0); k=k*k/8.0; float g=(NdotL/(NdotL*(1.0-k)+k))*(NdotV/(NdotV*(1.0-k)+k));
      vec3 F0=mix(vec3(0.04),base,metal); vec3 F=F0+(1.0-F0)*pow(1.0-max(dot(H,V),0.0),5.0);
      vec3 spec=d*g*F/(4.0*NdotL*NdotV+0.001);
      vec3 diffuse=(1.0-F)*(1.0-metal)*base/3.14159;
      float sh=shadowAt(vWorld);
      col+=(diffuse+spec*uReflect)*uDirC[i]*uDirI[i]*NdotL*sh;
    }
  }
  // point lights
  for(int i=0;i<3;i++){ if(i>=uPointCount) break;
    vec3 dv=uPointP[i]-vWorld; float dist=length(dv); vec3 L=dv/max(dist,0.001);
    float att=1.0/(1.0+pow(dist/max(uPointR[i],1.0),2.0));
    float NdotL=max(dot(N,L),0.0); if(NdotL<=0.0) continue;
    vec3 H=normalize(L+V); vec3 F0=mix(vec3(0.04),base,metal); vec3 F=F0+(1.0-F0)*pow(1.0-max(dot(H,V),0.0),5.0);
    float shin=pow(max(dot(N,H),0.0),max(2.0,2.0/(rough*rough)));
    col+=uPointC[i]*uPointI[i]*att*NdotL*(base*(1.0-metal)*0.7/3.14159 + F*shin*(1.0-rough)*uReflect);
  }
  // environment
  vec3 R=reflect(-V,N); vec2 euv=vec2(atan(R.z,R.x)*0.15915494+0.5, acos(clamp(R.y,-1.0,1.0))*0.31830989);
  vec3 env=textureLod(uEnv,euv,clamp(rough*6.0,0.0,7.0)).rgb;
  vec3 dif=textureLod(uEnv,vec2(euv.x,0.72),6.0).rgb;
  vec3 F0=mix(vec3(0.04),base,metal);
  vec3 F=F0+(1.0-F0)*pow(1.0-max(dot(N,V),0.0),5.0);
  vec3 envSpec=env*(F*1.6+0.12)*uReflect;
  vec3 envDiff=base*(1.0-metal)*dif*uEnvStrength*0.75;
  col+=envDiff+envSpec;
  col+=uEmisColor[slot]*emis;
  col=col/(col+vec3(1.0)); // tonemap
  col=pow(col,vec3(1.0/2.2));
  fragColor=vec4(col*opacity,opacity);
}`;
  SH.depthVS = `#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uVP; void main(){ gl_Position=uVP*vec4(aPos,1.0); }`;
  SH.depthFS = `#version 300 es
precision highp float; out vec4 fragColor; void main(){ fragColor=vec4(1.0); }`;
  SH.partVS = `#version 300 es
layout(location=0) in vec2 aCorner; layout(location=1) in vec3 aCenter; layout(location=2) in vec4 aColor; layout(location=3) in float aSize; layout(location=4) in float aRot; layout(location=5) in float aShape;
uniform mat4 uVP; uniform vec3 uRight,uUp; out vec2 vCorner; out vec4 vColor; out float vShape;
void main(){ float c=cos(aRot),s=sin(aRot); vec2 cr=vec2(aCorner.x*c-aCorner.y*s,aCorner.x*s+aCorner.y*c); vec3 wp=aCenter+uRight*cr.x*aSize+uUp*cr.y*aSize; gl_Position=uVP*vec4(wp,1.0); vCorner=aCorner; vColor=aColor; vShape=aShape; }`;
  SH.partFS = `#version 300 es
precision highp float; in vec2 vCorner; in vec4 vColor; in float vShape; out vec4 fragColor;
void main(){
  float d=length(vCorner); float a=0.0;
  if(vShape<0.5){ a=smoothstep(1.0,0.05,d); a*=a; float core=smoothstep(0.35,0.0,d); a=clamp(a+core*0.8,0.0,1.0); }
  else if(vShape<1.5){ float m=abs(vCorner.x)*1.4+abs(vCorner.y); a=smoothstep(1.0,0.55,m); }
  else { a=smoothstep(0.18,0.0,abs(d-0.66)) + smoothstep(0.5,0.0,d)*0.12; }
  a*=vColor.a;
  fragColor=vec4(vColor.rgb*a,a);
}`;
  SH.trailVS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aColor; uniform mat4 uVP; out vec4 vColor;
void main(){ gl_Position=uVP*vec4(aPos,1.0); vColor=aColor; }`;
  SH.trailFS = `#version 300 es
precision highp float; in vec4 vColor; out vec4 fragColor; void main(){ fragColor=vec4(vColor.rgb*vColor.a,vColor.a); }`;
  SH.timeDispFS = `#version 300 es
precision highp float;
uniform sampler2D uBase,uS0,uS1,uS2,uS3,uCtrl;
uniform int uHasCtrl; uniform float uAmount,uOffset,uTime; uniform vec4 uMixWeights;
in vec2 vUv; out vec4 fragColor;
vec4 slice(float i, vec2 uv){
  if(i<0.5) return texture(uS0,uv);
  if(i<1.5) return texture(uS1,uv);
  if(i<2.5) return texture(uS2,uv);
  return texture(uS3,uv);
}
float luma(vec3 c){ return dot(c,vec3(0.2126,0.7152,0.0722)); }
void main(){
  vec4 base=texture(uBase,vUv);
  float c;
  if(uHasCtrl==1){ vec4 t=texture(uCtrl,vUv); c=luma(t.rgb)*t.a; }
  else c=0.5+0.5*sin(vUv.x*9.0+uTime*3.0)*cos(vUv.y*7.0-uTime*2.0);
  float pos=clamp(c*uAmount + uOffset + 1.5, 0.0, 3.0);
  float i0=floor(pos), f=fract(pos);
  vec4 a=slice(i0,vUv), b=slice(min(i0+1.0,3.0),vUv);
  vec4 col=mix(a,b,f);
  col.a=base.a;
  fragColor=col;
}`;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = this.gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      if (!gl) throw new Error('当前浏览器不支持 WebGL 2');
      this.project = null;
      this.quality = 1;
      this.motionBlurEnabled = true;
      this.dofEnabled = true;
      this.lastCompRect = { x: 0, y: 0, w: 0, h: 0 };
      this.lastCamera = null;
      this.lastVP = null;
      this.lastTime = 0;
      this.lastComp = null;
      this.pool = new Map();
      this.msaaPool = new Map();
      this.progs = {};
      this._meshBufCache = new WeakMap();
      this._initPrograms();
      this._initBuffers();
      this._initEnv();
      this._glyphTex = this._createTexture(2048, 2048);
      this._glyphVersion = -1;
      this._atlasVersionSeen = -1;
      this.gl.disable(this.gl.DEPTH_TEST);
      this.gl.disable(this.gl.CULL_FACE);
    }

    _prog(name, vs, fs) {
      const gl = this.gl;
      const p = gl.createProgram();
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); console.error(name, log, src); throw new Error(name + ': ' + log); } return s; };
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const log = gl.getProgramInfoLog(p); throw new Error(name + ': ' + log); }
      p._u = {};
      p._name = name;
      this.progs[name] = p;
      return p;
    }
    _loc(p, n) { if (p._u[n] === undefined) p._u[n] = this.gl.getUniformLocation(p, n); return p._u[n]; }
    _use(p) { this.gl.useProgram(p); return p; }
    _u1f(p, n, v) { const l = this._loc(p, n); if (l !== null) this.gl.uniform1f(l, v); }
    _u1i(p, n, v) { const l = this._loc(p, n); if (l !== null) this.gl.uniform1i(l, v); }
    _u2f(p, n, a, b) { const l = this._loc(p, n); if (l !== null) this.gl.uniform2f(l, a, b); }
    _u3f(p, n, a, b, c) { const l = this._loc(p, n); if (l !== null) this.gl.uniform3f(l, a, b, c); }
    _u4f(p, n, a, b, c, d) { const l = this._loc(p, n); if (l !== null) this.gl.uniform4f(l, a, b, c, d); }
    _uv2(p, n, a) { const l = this._loc(p, n); if (l !== null) this.gl.uniform2fv(l, a); }
    _uv3(p, n, a) { const l = this._loc(p, n); if (l !== null) this.gl.uniform3fv(l, a); }
    _uvf(p, n, a) { const l = this._loc(p, n); if (l !== null) this.gl.uniform1fv(l, a); }
    _umat3(p, n, a) { const l = this._loc(p, n); if (l !== null) this.gl.uniformMatrix3fv(l, false, a); }
    _umat4(p, n, a) { const l = this._loc(p, n); if (l !== null) this.gl.uniformMatrix4fv(l, false, a); }

    _initPrograms() {
      this._prog('flat', SH.flatVS, SH.flatFS);
      this._prog('tex', SH.texVS, SH.texFS);
      this._prog('comp', SH.fullVS, SH.compFS);
      this._prog('unpremul', SH.fullVS, SH.unpremulFS);
      this._prog('display', SH.fullVS, SH.displayFS);
      this._prog('blur', SH.fullVS, SH.blurFS);
      this._prog('threshold', SH.fullVS, SH.thresholdFS);
      this._prog('glowAdd', SH.fullVS, SH.glowAddFS);
      this._prog('shadowPrep', SH.fullVS, SH.shadowPrepFS);
      this._prog('shadowComp', SH.fullVS, SH.shadowCompFS);
      this._prog('color', SH.fullVS, SH.colorFS);
      this._prog('maskInv', SH.fullVS, SH.maskInvFS);
      this._prog('maskPrep', SH.fullVS, SH.maskPrepFS);
      this._prog('maskApply', SH.fullVS, SH.maskApplyFS);
      this._prog('mixMask', SH.fullVS, SH.mixMaskFS);
      this._prog('copy', SH.fullVS, SH.copyFS);
      this._prog('accum', SH.fullVS, SH.accumFS);
      this._prog('dof', SH.fullVS, SH.dofFS);
      this._prog('dofCombine', SH.fullVS, SH.dofCombineFS);
      this._prog('mesh', SH.meshVS, SH.meshFS);
      this._prog('depth', SH.depthVS, SH.depthFS);
      this._prog('part', SH.partVS, SH.partFS);
      this._prog('trail', SH.trailVS, SH.trailFS);
      this._prog('timedisplace', SH.fullVS, SH.timeDispFS);
    }
    _initBuffers() {
      const gl = this.gl;
      this.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.quadVAO = gl.createVertexArray(); gl.bindVertexArray(this.quadVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      this.flatVAO = gl.createVertexArray(); this.flatVBO = gl.createBuffer();
      gl.bindVertexArray(this.flatVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.flatVBO);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
      gl.bindVertexArray(null);
      this.texVAO = gl.createVertexArray(); this.texVBO = gl.createBuffer();
      gl.bindVertexArray(this.texVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.texVBO);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 8);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
      gl.bindVertexArray(null);
      this.partVAO = gl.createVertexArray(); this.partVBO = gl.createBuffer();
      gl.bindVertexArray(this.partVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.partVBO);
      const st = 4 * 12;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, st, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 8);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 20);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, st, 36);
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, st, 40);
      gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 1, gl.FLOAT, false, st, 44);
      gl.bindVertexArray(null);
      this.trailVAO = gl.createVertexArray(); this.trailVBO = gl.createBuffer();
      gl.bindVertexArray(this.trailVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.trailVBO);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
      gl.bindVertexArray(null);
    }

    _createTexture(w, h, opts = {}) {
      const gl = this.gl, tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, opts.internal || gl.RGBA8, w, h, 0, opts.format || gl.RGBA, opts.type || gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.nearest ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts.nearest ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    }
    _makeTarget(w, h, opts = {}) {
      const gl = this.gl;
      const tex = this._createTexture(w, h, opts);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      let depthTex = null;
      if (opts.depth) {
        depthTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, depthTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0);
      }
      const t = { fbo, tex, depthTex, w, h, depth: !!opts.depth };
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return t;
    }
    acquire(w, h, opts = {}) {
      w = Math.max(1, Math.min(MAX_TEX, Math.round(w))); h = Math.max(1, Math.min(MAX_TEX, Math.round(h)));
      const key = w + 'x' + h + (opts.depth ? 'd' : '');
      let arr = this.pool.get(key);
      if (!arr) { arr = []; this.pool.set(key, arr); }
      let t = arr.pop();
      if (!t) t = this._makeTarget(w, h, opts);
      t._key = key; return t;
    }
    release(t) {
      if (!t) return;
      const arr = this.pool.get(t._key); if (!arr || arr.length > 10) return;
      if (!arr.includes(t)) arr.push(t);
    }
    acquireMSAA(w, h) {
      const gl = this.gl;
      w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
      const key = w + 'x' + h;
      let arr = this.msaaPool.get(key); if (!arr) { arr = []; this.msaaPool.set(key, arr); }
      let t = arr.pop();
      if (!t) {
        const fbo = gl.createFramebuffer(), rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, gl.RGBA8, w, h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        t = { fbo, rb, w, h, _key: key };
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, t.w, t.h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      return t;
    }
    releaseMSAA(t) {
      if (!t) return;
      const arr = this.msaaPool.get(t._key); if (!arr) return;
      if (!arr.includes(t) && arr.length < 8) arr.push(t);
    }
    resolveMSAA(msaa, target) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msaa.fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.fbo);
      gl.blitFramebuffer(0, 0, msaa.w, msaa.h, 0, 0, target.w, target.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    }
    _bindTarget(t, clear) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, t.w, t.h);
      if (clear) { gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | (t.depth ? gl.DEPTH_BUFFER_BIT : 0)); }
      return t;
    }
    _drawQuad() {
      const gl = this.gl;
      gl.bindVertexArray(this.quadVAO);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    _fullPass(progName, srcTex, target, setup) {
      const gl = this.gl;
      this._bindTarget(target, false);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      const p = this._use(this.progs[progName]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex);
      this._u1i(p, 'uTex', 0);
      if (setup) setup(p);
      this._drawQuad();
      return target;
    }

    _initEnv() {
      const gl = this.gl;
      const w = 512, h = 256, data = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++) {
        const v = y / (h - 1); // 0 bottom, 1 top
        for (let x = 0; x < w; x++) {
          const u = x / (w - 1);
          const az = u * Math.PI * 2;
          let r, g, b;
          const horizon = Math.exp(-Math.pow((v - .52) / .16, 2));
          const top = Math.exp(-Math.pow((v - .92) / .2, 2));
          const key = Math.exp(-Math.pow((u - .17) / .055, 2)) * Math.exp(-Math.pow((v - .65) / .12, 2));
          const rim = Math.exp(-Math.pow((u - .71) / .07, 2)) * Math.exp(-Math.pow((v - .62) / .1, 2));
          const fill = Math.exp(-Math.pow((u - .47) / .12, 2)) * Math.exp(-Math.pow((v - .38) / .16, 2));
          r = .018 + horizon * .11 + top * .05 + key * .9 + rim * .32 + fill * .14;
          g = .027 + horizon * .14 + top * .09 + key * .82 + rim * .52 + fill * .22;
          b = .045 + horizon * .17 + top * .16 + key * .62 + rim * .78 + fill * .3;
          // subtle vertical strips for studio reflections
          const strip = .5 + .5 * Math.sin(az * 9 + 1.3);
          r += strip * .015; g += strip * .02; b += strip * .025;
          const i = (y * w + x) * 4;
          data[i] = U.clamp(r) * 255; data[i + 1] = U.clamp(g) * 255; data[i + 2] = U.clamp(b) * 255; data[i + 3] = 255;
        }
      }
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.envTex = tex;
      this.shadowTex = null;
      this.shadowFBO = null;
    }

    resize() {
      const c = this.canvas;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(2, Math.round(c.clientWidth * dpr)), h = Math.max(2, Math.round(c.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      this.canvasW = w; this.canvasH = h; this.dpr = dpr;
    }
    clearCanvas() {
      this.resize();
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvasW, this.canvasH);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      this.lastCompRect = { x: 0, y: 0, w: 0, h: 0 };
    }

    // ------------- public render -------------
    render(comp, time, opts = {}) {
      this.resize();
      this.lastComp = comp; this.lastTime = time;
      this._matteCache = new Map();
      this._matteTargets = [];
      this._frameMeshCache = new Map();
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvasW, this.canvasH);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (!comp) return;
      const out = this.renderComp(comp, time, { scale: opts.quality || this.quality, bg: true, viewOverride: opts.viewOverride, _top: true });
      for (const t of (this._matteTargets || [])) this.release(t);
      this._matteTargets = [];
      const view = opts.view || { zoom: 1, panX: 0, panY: 0 };
      const margin = 22 * this.dpr;
      const availW = Math.max(20, this.canvasW - margin * 2), availH = Math.max(20, this.canvasH - margin * 2);
      const fit = Math.min(availW / comp.width, availH / comp.height);
      const z = fit * (view.zoom || 1);
      const w = comp.width * z, h = comp.height * z;
      const x = (this.canvasW - w) / 2 + (view.panX || 0) * this.dpr;
      const y = (this.canvasH - h) / 2 + (view.panY || 0) * this.dpr;
      this.lastCompRect = { x, y, w, h };
      const gx = Math.round(x), gy = Math.round(this.canvasH - (y + h)), gw = Math.round(w), gh = Math.round(h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(gx, gy, gw, gh);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      const p = this._use(this.progs.display);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, out.tex); this._u1i(p, 'uTex', 0);
      this._u3f(p, 'uBg', comp.bg[0], comp.bg[1], comp.bg[2]);
      this._drawQuad();
      this.release(out);
      return out;
    }

    renderComp(comp, time, opts = {}) {
      if (!comp) return null;
      const gl = this.gl;
      const scale = opts.scale || 1;
      const tw = Math.max(2, Math.min(MAX_TEX, Math.round(comp.width * scale)));
      const th = Math.max(2, Math.min(MAX_TEX, Math.round(comp.height * scale)));
      const ctx = opts.ctx || E.makeCtx(this.project, comp, time, { overrides: opts.overrides, depth: opts.depth || 0 });
      const viewCam = opts.viewOverride ? this.helperCamera(comp, opts.viewOverride) : E.activeCameraState(comp, ctx, time);
      this.lastCamera = viewCam; this.lastVP = E.cameraMatrices(viewCam, comp).vp;
      this.lastViewport = { tw, th, scale };
      // motion blur accumulation
      if (!opts._mb && !opts._topMotion && comp.motionBlur && comp.motionBlur.enabled && this.motionBlurEnabled) {
        let samples = Math.round(comp.motionBlur.samples || 1);
        if (opts.samples) samples = Math.round(opts.samples);
        if (samples > 1) return this.renderMotionBlur(comp, time, opts, samples, scale, tw, th, ctx);
      }
      let read = this.acquire(tw, th);
      this._bindTarget(read, false);
      if (opts.bg) { gl.clearColor(comp.bg[0], comp.bg[1], comp.bg[2], comp.bg[3] == null ? 1 : comp.bg[3]); }
      else gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const compState = E.compState(comp, time, ctx);
      const layerById = new Map(comp.layers.map(l => [l.id, l]));
      const matteSources = new Set();
      for (const l of comp.layers) if (l.matte && l.matte.enabled && l.matte.source) matteSources.add(l.matte.source);
      let segment = [];
      const flush3D = () => {
        if (!segment.length) return;
        const seg = this.render3D(comp, segment, time, ctx, opts, scale);
        segment = [];
        if (seg) {
          read = this.compositeTargets(comp, read, seg, 1, 'normal', null, 0, 1, 0, 0, tw, th);
          this.release(seg);
        }
      };
      for (let li = 0; li < comp.layers.length; li++) {
        const layer = comp.layers[li];
        if (!E.isActive(comp, layer, time)) continue;
        if (matteSources.has(layer.id)) continue;
        if (layer.type === 'camera' || layer.type === 'light' || layer.type === 'field' || layer.type === 'audio' || layer.type === 'tone' || layer.type === 'null') continue;
        if (layer.type === 'adjustment') {
          flush3D();
          read = this.applyAdjustment(comp, layer, time, ctx, read, opts, scale, tw, th);
          continue;
        }
        if (this.is3DLayer(layer, ctx, time)) { segment.push(layer); continue; }
        flush3D();
        if (layer.type === 'precomp' && layer.precomp.mode === 'preserve3d') continue;
        const lo = this.renderLayer2D(comp, layer, time, ctx, { scale, matteCache: this._matteCache });
        if (!lo) continue;
        const opacity = E.layerOpacity(layer, ctx, time) / 100;
        let matteTex = null, matteMode = 0;
        if (layer.matte && layer.matte.enabled && layer.matte.source) {
          matteTex = this.getMatteTexture(comp, layer.matte.source, time, ctx, scale, opts);
          matteMode = { alpha: 0, alphaInv: 1, luma: 2, lumaInv: 3 }[layer.matte.mode || 'alpha'] || 0;
        }
        read = this.compositeTargets(comp, read, lo.target, opacity, layer.blendMode || 'normal', matteTex, matteMode, 0, 0, 0, tw, th);
        this.release(lo.target);
      }
      flush3D();
      return read;
    }

    /********* motion blur *********/
    renderMotionBlur(comp, time, opts, samples, scale, tw, th, ctx) {
      const shutter = (comp.motionBlur.shutterAngle == null ? 180 : comp.motionBlur.shutterAngle) / 360 / comp.fps;
      const phase = comp.motionBlur.phase || 0;
      const acc = this.acquire(tw, th);
      const gl = this.gl;
      this._bindTarget(acc, true);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = 0; i < samples; i++) {
        const off = (samples === 1 ? 0 : (i / (samples - 1) - .5)) * shutter + phase * shutter / samples;
        const st = Math.max(0, Math.min(comp.duration, time + off));
        const sctx = E.makeCtx(this.project, comp, st, { overrides: opts.overrides });
        const sample = this.renderComp(comp, st, { ...opts, ctx: sctx, _mb: true, _top: false, bg: opts.bg, scale, particleTime: time });
        gl.bindFramebuffer(gl.FRAMEBUFFER, acc.fbo); gl.viewport(0, 0, tw, th);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        const p = this._use(this.progs.accum);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sample.tex); this._u1i(p, 'uTex', 0);
        this._u1f(p, 'uWeight', 1 / samples);
        gl.disable(gl.DEPTH_TEST);
        this._drawQuad();
        gl.disable(gl.BLEND);
        this.release(sample);
      }
      gl.disable(gl.BLEND);
      return acc;
    }

    getMatteTexture(comp, sourceId, time, ctx, scale, opts) {
      if (this._matteCache.has(sourceId)) return this._matteCache.get(sourceId);
      const src = comp.layers.find(l => l.id === sourceId);
      let tex = null;
      if (src && E.isActive(comp, src, time)) {
        const lo = this.renderLayer2D(comp, src, time, ctx, { scale, matteCache: new Map(), forMatte: true });
        if (lo) {
          tex = lo.target.tex;
          this._matteCache.set(sourceId, tex);
          this._matteTargets = this._matteTargets || [];
          this._matteTargets.push(lo.target);
        }
      }
      this._matteCache.set(sourceId, tex);
      return tex;
    }

    is3DLayer(layer, ctx, time) {
      if (layer.type === 'geo' || layer.type === 'nodes' || layer.type === 'particle') return true;
      if (layer.type === 'precomp') return layer.precomp.mode === 'preserve3d' || !!layer.precomp.as3dPlane;
      if (layer.type === 'shape') return !!layer.threeD;
      if (layer.type === 'text') {
        const ex = layer.props['text.extrude'] ? E.num(E.propValue(layer, 'text.extrude', ctx, time)) : 0;
        return !!layer.threeD || ex > 0;
      }
      return false;
    }

    /********* 2D layer *********/
    renderLayer2D(comp, layer, time, ctx, opts = {}) {
      if (!layer) return null;
      const scale = opts.scale || 1;
      const tw = Math.max(2, Math.round(comp.width * scale)), th = Math.max(2, Math.round(comp.height * scale));
      let src = this.renderLayerBase(comp, layer, time, ctx, scale, opts);
      if (!src) return null;
      const fx = E.effects(layer, ctx, time);
      let cur = src, owned = true;
      for (const f of fx) {
        if (f.type === 'echo') { cur = this.applyEcho(comp, layer, time, ctx, cur, f, scale, opts); owned = true; }
        else if (f.type === 'timeDisplace') { cur = this.applyTimeDisplace(comp, layer, time, ctx, cur, f, scale, opts); owned = true; }
        else {
          const out = this.applyFx(comp, layer, cur, f, time, ctx, tw, th);
          if (out && out !== cur) { if (owned) this.release(cur); cur = out; owned = true; }
        }
      }
      return { target: cur, fx, owned };
    }

    renderLayerBase(comp, layer, time, ctx, scale, opts = {}) {
      const tw = Math.max(2, Math.round(comp.width * scale)), th = Math.max(2, Math.round(comp.height * scale));
      const msaa = this.acquireMSAA(tw, th);
      this._drawLayerContent(comp, layer, time, ctx, tw, th, scale, opts, msaa);
      const target = this.acquire(tw, th);
      this.resolveMSAA(msaa, target);
      this.releaseMSAA(msaa);
      // unpremultiply
      let cur = this.acquire(tw, th);
      this._fullPass('unpremul', target.tex, cur);
      this.release(target);
      // masks
      const mask = this.renderLayerMask(comp, layer, time, ctx, tw, th, scale);
      if (mask) {
        const masked = this.acquire(tw, th);
        this._bindTarget(masked, false); this.gl.disable(this.gl.BLEND);
        const p = this._use(this.progs.maskApply);
        this.gl.activeTexture(this.gl.TEXTURE0); this.gl.bindTexture(this.gl.TEXTURE_2D, cur.tex); this._u1i(p, 'uTex', 0);
        this.gl.activeTexture(this.gl.TEXTURE1); this.gl.bindTexture(this.gl.TEXTURE_2D, mask.tex); this._u1i(p, 'uMask', 1);
        this._drawQuad();
        this.release(cur); this.release(mask); cur = masked;
      }
      return cur;
    }

    _drawLayerContent(comp, layer, time, ctx, tw, th, scale, opts, msaa) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, msaa ? msaa.fbo : null);
      gl.viewport(0, 0, tw, th);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const affine = E.worldAffine(comp, layer, ctx, time);
      const type = layer.type;
      if (type === 'shape') this._drawShape(comp, layer, time, ctx, affine, scale, opts);
      else if (type === 'text') this._drawText(comp, layer, time, ctx, affine, scale, opts);
      else if (type === 'solid') this._drawSolid(comp, layer, time, ctx, affine, scale, opts);
      else if (type === 'precomp') this._drawPrecomp(comp, layer, time, ctx, affine, tw, th, scale, opts, msaa);
      gl.bindFramebuffer(gl.FRAMEBUFFER, msaa ? msaa.fbo : null);
      gl.viewport(0, 0, tw, th);
    }

    _drawShape(comp, layer, time, ctx, affine, scale, opts) {
      const gl = this.gl;
      const content = E.evalContents(layer, ctx, time);
      const styles = E.shapeStyles(layer, ctx, time);
      const fillVerts = [], strokeVerts = [];
      for (const it of content.items) {
        const shape = it.shape;
        if (!shape || !shape.contours.length) continue;
        const itemOpacity = it.opacity == null ? 1 : it.opacity;
        if (styles.fillOn && styles.fillOpacity > 0) {
          const tri = G.triangulateShape(shape, 14);
          const b = G.bounds(shape);
          const ang = U.rad(styles.gradientAngle);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const colBase = styles.fillColor;
          for (let i = 0; i < tri.positions.length; i += 2) {
            const x = tri.positions[i], y = tri.positions[i + 1];
            let c = colBase;
            if (styles.gradientOn) {
              const t = U.clamp((x * ca + y * sa) / Math.max(1, Math.abs(b.w * ca) + Math.abs(b.h * sa)) + .5, 0, 1);
              c = U.lerpColor(styles.gradientStart, styles.gradientEnd, t);
            }
            const alpha = (c[3] == null ? 1 : c[3]) * styles.fillOpacity * itemOpacity;
            fillVerts.push(x, y, c[0], c[1], c[2], alpha);
          }
        }
        if (styles.strokeOn && styles.strokeWidth > 0) {
          const st = G.strokeShape(shape, styles.strokeWidth, { cap: 'round', steps: 16 });
          const c = styles.strokeColor;
          for (let i = 0; i < st.indices.length; i++) {
            const vi = st.indices[i] * 2;
            strokeVerts.push(st.positions[vi], st.positions[vi + 1], c[0], c[1], c[2], (c[3] == null ? 1 : c[3]) * styles.strokeOpacity * itemOpacity);
          }
        }
      }
      if (fillVerts.length) this._drawFlatVerts(fillVerts, affine, comp);
      if (strokeVerts.length) this._drawFlatVerts(strokeVerts, affine, comp);
    }

    _drawFlatVerts(verts, affine, comp) {
      const gl = this.gl;
      gl.useProgram(this.progs.flat);
      const p = this.progs.flat;
      this._umat3(p, 'uMat', new Float32Array([affine[0], affine[1], 0, affine[2], affine[3], 0, affine[4], affine[5], 1]));
      this._u2f(p, 'uRes', comp.width, comp.height);
      gl.bindVertexArray(this.flatVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.flatVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, verts.length / 6);
      gl.bindVertexArray(null);
    }

    _drawText(comp, layer, time, ctx, affine, scale, opts) {
      const gl = this.gl;
      const layout = E.textLayout(layer, ctx, time);
      const colorInfo = E.textColor(layer, ctx, time);
      // atlas
      const atlas = T.getAtlas();
      if (T.atlasVersion() !== this._glyphVersion) {
        gl.bindTexture(gl.TEXTURE_2D, this._glyphTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this._glyphVersion = T.atlasVersion();
      }
      const fs = layout.style.fontSize;
      const verts = [];
      for (const gl2 of layout.glyphs) {
        const g = gl2.g; if (!g) continue;
        const s = fs / (g.size || 176);
        const sc = gl2.scale || 1;
        const w = g.w * s * sc, h = g.h * s * sc;
        const cx = gl2.penX + (g.bearingX + g.w / 2) * s;
        const cy = gl2.baseline + (g.bearingY + g.h / 2) * s;
        const rot = gl2.rot || 0, co = Math.cos(rot), si = Math.sin(rot);
        const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
        const uv = [[g.u0, g.v0], [g.u1, g.v0], [g.u1, g.v1], [g.u0, g.v1]];
        const alpha = colorInfo.fillOpacity * (gl2.opacity == null ? 1 : gl2.opacity);
        const c = colorInfo.fill;
        const pts = corners.map(([x, y]) => { const rx = x * co - y * si, ry = x * si + y * co; return [cx + rx, cy + ry]; });
        const order = [0, 1, 2, 0, 2, 3];
        for (const k of order) verts.push(pts[k][0], pts[k][1], uv[k][0], uv[k][1], c[0], c[1], c[2], (c[3] == null ? 1 : c[3]) * alpha);
      }
      if (verts.length) {
        const p = this._use(this.progs.tex);
        this._umat3(p, 'uMat', new Float32Array([affine[0], affine[1], 0, affine[2], affine[3], 0, affine[4], affine[5], 1]));
        this._u2f(p, 'uRes', comp.width, comp.height);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._glyphTex); this._u1i(p, 'uTex', 0);
        gl.bindVertexArray(this.texVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.texVBO);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, verts.length / 8);
        gl.bindVertexArray(null);
      }
      if (colorInfo.strokeOn && colorInfo.strokeWidth > 0) {
        const shape = T.outlineShape(layout, {});
        const st = G.strokeShape(shape, colorInfo.strokeWidth, { cap: 'round', steps: 12 });
        const c = colorInfo.strokeColor;
        const sv = [];
        for (let i = 0; i < st.indices.length; i++) { const vi = st.indices[i] * 2; sv.push(st.positions[vi], st.positions[vi + 1], c[0], c[1], c[2], 1); }
        if (sv.length) this._drawFlatVerts(sv, affine, comp);
      }
    }

    _drawSolid(comp, layer, time, ctx, affine, scale, opts) {
      const gl = this.gl;
      const gradientOn = !!E.propValue(layer, 'solid.gradientOn', ctx, time);
      const solidColor = U.colorArr(E.propValue(layer, 'solid.color', ctx, time));
      const c1 = gradientOn ? U.colorArr(E.propValue(layer, 'solid.gradientStart', ctx, time)) : solidColor;
      const c2 = gradientOn ? U.colorArr(E.propValue(layer, 'solid.gradientEnd', ctx, time)) : solidColor;
      const angle = U.rad(E.num(E.propValue(layer, 'solid.gradientAngle', ctx, time)));
      const w = comp.width, h = comp.height;
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
      const cs = [];
      for (let i = 0; i < 4; i++) {
        const x = corners[i][0], y = corners[i][1];
        let t = U.clamp((x * ca + y * sa) / (w * Math.abs(ca) + h * Math.abs(sa)) + .5, 0, 1);
        const c = gradientOn ? U.lerpColor(c1, c2, t) : c1;
        cs.push(c);
      }
      const tri = [0, 1, 2, 0, 2, 3], verts = [];
      for (const k of tri) { const c = cs[k]; verts.push(corners[k][0], corners[k][1], c[0], c[1], c[2], c[3] == null ? 1 : c[3]); }
      this._drawFlatVerts(verts, affine, comp);
    }

    _drawPrecomp(comp, layer, time, ctx, affine, tw, th, scale, opts, msaa) {
      const gl = this.gl;
      const inner = P.findComp(this.project, layer.precomp.compId);
      if (!inner) return;
      const innerTime = E.innerTime(comp, layer, time, ctx);
      const overrides = B.buildOverrides(this.project, inner, layer);
      const innerOut = this.renderComp(inner, innerTime, { scale: opts.scale || scale, bg: false, overrides, depth: (ctx.depth || 0) + 1, _mb: true });
      if (!innerOut) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, msaa ? msaa.fbo : null);
      gl.viewport(0, 0, tw, th);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const p = this._use(this.progs.tex);
      this._umat3(p, 'uMat', new Float32Array([affine[0], affine[1], 0, affine[2], affine[3], 0, affine[4], affine[5], 1]));
      this._u2f(p, 'uRes', comp.width, comp.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, innerOut.tex); this._u1i(p, 'uTex', 0);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const hw = inner.width / 2, hh = inner.height / 2;
      const verts = [
        -hw, -hh, 0, 1, 1, 1, 1, 1,
        hw, -hh, 1, 1, 1, 1, 1, 1,
        hw, hh, 1, 0, 1, 1, 1, 1,
        -hw, -hh, 0, 1, 1, 1, 1, 1,
        hw, hh, 1, 0, 1, 1, 1, 1,
        -hw, hh, 0, 0, 1, 1, 1, 1
      ];
      gl.bindVertexArray(this.texVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.texVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
      this.release(innerOut);
    }

    /********* masks *********/
    renderLayerMask(comp, layer, time, ctx, tw, th, scale) {
      const masks = E.masks(layer, ctx, time);
      if (!masks.length) return null;
      const gl = this.gl;
      const accum = this.acquire(tw, th);
      this._bindTarget(accum, true);
      const affine = E.worldAffine(comp, layer, ctx, time);
      for (const m of masks) {
        if (!m.path || !m.path.contours || !m.path.contours.length) continue;
        const msaa = this.acquireMSAA(tw, th);
        const p0 = this._use(this.progs.flat);
        this._umat3(p0, 'uMat', new Float32Array([affine[0], affine[1], 0, affine[2], affine[3], 0, affine[4], affine[5], 1]));
        this._u2f(p0, 'uRes', comp.width, comp.height);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        const shape = m.expansion ? G.offsetShape(m.path, m.expansion) : m.path;
        const tri = G.triangulateShape(shape, 14);
        const verts = [];
        for (let i = 0; i < tri.indices.length; i++) { const vi = tri.indices[i] * 2; verts.push(tri.positions[vi], tri.positions[vi + 1], 1, 1, 1, 1); }
        gl.bindVertexArray(this.flatVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.flatVBO);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, verts.length / 6);
        gl.bindVertexArray(null);
        let maskTex = this.acquire(tw, th);
        this.resolveMSAA(msaa, maskTex); this.releaseMSAA(msaa);
        if (m.inverted) {
          const inv = this.acquire(tw, th);
          this._fullPass('maskInv', maskTex.tex, inv);
          this.release(maskTex); maskTex = inv;
        }
        if (m.feather > 0) {
          const amount = m.feather * (tw / comp.width);
          maskTex = this.blurTarget(maskTex, amount, 1);
        }
        // accumulate with MAX
        const pa = this._use(this.progs.maskPrep);
        this._bindTarget(accum, false);
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.MAX);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex.tex); this._u1i(pa, 'uTex', 0);
        this._u1f(pa, 'uOpacity', m.opacity == null ? 1 : m.opacity);
        this._drawQuad();
        gl.blendEquation(gl.FUNC_ADD);
        this.release(maskTex);
      }
      return accum;
    }

    /********* effects *********/
    blurTarget(src, amount, iterations = 1) {
      if (!src || amount <= .05) return src;
      const gl = this.gl;
      let cur = src;
      for (let it = 0; it < iterations; it++) {
        const tmp = this.acquire(cur.w, cur.h);
        this._fullPass('blur', cur.tex, tmp, (p) => {
          this._uv2(p, 'uTexel', [1 / cur.w, 1 / cur.h]);
          this._u2f(p, 'uDir', 1, 0); this._u1f(p, 'uRadius', Math.max(.5, amount));
        });
        this.release(cur);
        const out = this.acquire(tmp.w, tmp.h);
        this._fullPass('blur', tmp.tex, out, (p) => {
          this._uv2(p, 'uTexel', [1 / tmp.w, 1 / tmp.h]);
          this._u2f(p, 'uDir', 0, 1); this._u1f(p, 'uRadius', Math.max(.5, amount));
        });
        this.release(tmp);
        cur = out;
      }
      return cur;
    }

    applyFx(comp, layer, src, f, time, ctx, tw, th) {
      const gl = this.gl;
      const p = f.params;
      const scale = tw / comp.width;
      if (f.type === 'blur') {
        const amount = E.num(p.amount) * scale;
        return this.blurTarget(src, amount, Math.max(1, Math.round(p.repeat || 1)));
      }
      if (f.type === 'glow') {
        const tmp = this.acquire(tw, th);
        this._fullPass('threshold', src.tex, tmp, (pr) => this._u1f(pr, 'uThreshold', E.num(p.threshold)));
        let bright = this.blurTarget(tmp, Math.max(1, E.num(p.radius) * scale), 2);
        const out = this.acquire(tw, th);
        this._bindTarget(out, false); gl.disable(gl.BLEND);
        const pr = this._use(this.progs.glowAdd);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); this._u1i(pr, 'uTex', 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bright.tex); this._u1i(pr, 'uGlow', 1);
        const c = U.colorArr(p.color);
        this._u3f(pr, 'uColor', c[0], c[1], c[2]); this._u1f(pr, 'uIntensity', E.num(p.intensity));
        this._drawQuad();
        this.release(bright);
        return out;
      }
      if (f.type === 'shadow') {
        const ang = U.rad(E.num(p.angle)), dist = E.num(p.distance) * scale;
        const sh = this.acquire(tw, th);
        this._bindTarget(sh, false); gl.disable(gl.BLEND);
        const pr = this._use(this.progs.shadowPrep);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); this._u1i(pr, 'uTex', 0);
        this._u2f(pr, 'uOffset', -Math.cos(ang) * dist / tw, Math.sin(ang) * dist / th);
        const c = U.colorArr(p.color);
        this._u3f(pr, 'uColor', c[0], c[1], c[2]);
        this._u1f(pr, 'uOpacity', E.num(p.opacity) / 100);
        this._drawQuad();
        let bl = this.blurTarget(sh, Math.max(1, E.num(p.softness) * scale), 2);
        const out = this.acquire(tw, th);
        this._bindTarget(out, false); gl.disable(gl.BLEND);
        const pc = this._use(this.progs.shadowComp);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); this._u1i(pc, 'uTex', 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bl.tex); this._u1i(pc, 'uShadow', 1);
        this._drawQuad();
        this.release(bl);
        return out;
      }
      if (f.type === 'hueSat') {
        const out = this.acquire(tw, th);
        this._bindTarget(out, false); gl.disable(gl.BLEND);
        const pr = this._use(this.progs.color);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); this._u1i(pr, 'uTex', 0);
        this._u1i(pr, 'uMode', 0);
        this._u1f(pr, 'uHue', E.num(p.hue) / 360); this._u1f(pr, 'uSat', E.num(p.sat)); this._u1f(pr, 'uBright', E.num(p.bright)); this._u1f(pr, 'uContrast', E.num(p.contrast));
        this._drawQuad(); return out;
      }
      if (f.type === 'vignette') {
        const out = this.acquire(tw, th); this._bindTarget(out, false); gl.disable(gl.BLEND);
        const pr = this._use(this.progs.color);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); this._u1i(pr, 'uTex', 0);
        this._u1i(pr, 'uMode', 1); this._u1f(pr, 'uAmount', E.num(p.amount)); this._u1f(pr, 'uRadius', E.num(p.radius)); this._u1f(pr, 'uSoft', E.num(p.softness));
        this._drawQuad(); return out;
      }
      if (f.type === 'grain') {
        const out = this.acquire(tw, th); this._bindTarget(out, false); gl.disable(gl.BLEND);
        const pr = this._use(this.progs.color);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); this._u1i(pr, 'uTex', 0);
        this._u1i(pr, 'uMode', 2); this._u1f(pr, 'uAmount', E.num(p.amount)); this._u1f(pr, 'uTime', time);
        this._drawQuad(); return out;
      }
      if (f.type === 'chroma') {
        const out = this.acquire(tw, th); this._bindTarget(out, false); gl.disable(gl.BLEND);
        const pr = this._use(this.progs.color);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); this._u1i(pr, 'uTex', 0);
        this._u1i(pr, 'uMode', 3); this._u1f(pr, 'uAmount', E.num(p.amount)); this._u1f(pr, 'uAngle', E.num(p.angle));
        this._uv2(pr, 'uTexel', [1 / tw, 1 / th]);
        this._drawQuad(); return out;
      }
      return src;
    }

    applyEcho(comp, layer, time, ctx, src, f, scale, opts) {
      const p = f.params;
      const n = Math.max(1, Math.round(E.num(p.samples)));
      const delay = Math.max(.005, E.num(p.delay));
      const decay = U.clamp(E.num(p.decay));
      const offset = E.num(p.offset) * scale;
      const gl = this.gl;
      let cur = this.acquire(src.w, src.h);
      this._bindTarget(cur, true);
      gl.disable(gl.BLEND);
      let pr = this._use(this.progs.copy);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); this._u1i(pr, 'uTex', 0);
      this._drawQuad();
      for (let i = 1; i < n; i++) {
        const t2 = Math.max(0, time - delay * i);
        const c2 = E.makeCtx(this.project, comp, t2, { overrides: ctx.overrides });
        const past = this.renderLayerBase(comp, layer, t2, c2, scale, { ...opts, skipTemporal: true });
        if (!past) continue;
        const next = this.acquire(cur.w, cur.h);
        this._bindTarget(next, true);
        gl.disable(gl.BLEND);
        const pcomp = this._use(this.progs.comp);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, past.tex); this._u1i(pcomp, 'uSrc', 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, cur.tex); this._u1i(pcomp, 'uDst', 1);
        this._u1i(pcomp, 'uBlend', 0); this._u1f(pcomp, 'uOpacity', Math.pow(decay, i));
        this._u1i(pcomp, 'uUseMatte', 0); this._u1i(pcomp, 'uPremul', 0);
        this._u2f(pcomp, 'uSrcOffset', (i % 2 ? 1 : -1) * offset / cur.w, -offset * i / cur.h);
        this._drawQuad();
        this.release(past); this.release(cur); cur = next;
      }
      this.release(src);
      return cur;
    }

    applyTimeDisplace(comp, layer, time, ctx, src, f, scale, opts) {
      // Real temporal re-sampling with 4 slices + control layer luminance.
      const p = f.params;
      const slices = 4;
      const span = E.num(p.span);
      const amount = E.num(p.amount);
      const offset = E.num(p.offset);
      const halfScale = scale * .5;
      const stex = [];
      for (let i = 0; i < slices; i++) {
        const t2 = Math.max(0, Math.min(comp.duration, time + span * (i / (slices - 1))));
        const c2 = E.makeCtx(this.project, comp, t2, { overrides: ctx.overrides });
        const tex = this.renderLayerBase(comp, layer, t2, c2, halfScale, { ...opts, skipTemporal: true });
        stex.push(tex);
      }
      // control texture
      let ctrl = null;
      const ctrlId = f.controlLayerId;
      if (ctrlId) {
        const cl = comp.layers.find(l => l.id === ctrlId);
        if (cl) {
          const cout = this.renderLayerBase(comp, cl, time, ctx, scale * .5, { ...opts, skipTemporal: true });
          ctrl = cout;
        }
      }
      const gl = this.gl;
      const out = this.acquire(src.w, src.h);
      this._bindTarget(out, false); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      const prog = this._use(this.progs.timedisplace);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); this._u1i(prog, 'uBase', 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, stex[0] ? stex[0].tex : src.tex); this._u1i(prog, 'uS0', 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, stex[1] ? stex[1].tex : src.tex); this._u1i(prog, 'uS1', 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, stex[2] ? stex[2].tex : src.tex); this._u1i(prog, 'uS2', 3);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, stex[3] ? stex[3].tex : src.tex); this._u1i(prog, 'uS3', 4);
      if (ctrl) { gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, ctrl.tex); this._u1i(prog, 'uCtrl', 5); }
      this._u1i(prog, 'uHasCtrl', ctrl ? 1 : 0);
      this._u1f(prog, 'uAmount', amount); this._u1f(prog, 'uOffset', offset); this._u1f(prog, 'uTime', time);
      this._u4f(prog, 'uMixWeights', 1, 1, 1, 1);
      this._drawQuad();
      for (const s of stex) if (s) this.release(s);
      if (ctrl) this.release(ctrl);
      this.release(src);
      return out;
    }

    applyAdjustment(comp, layer, time, ctx, read, opts, scale, tw, th) {
      const gl = this.gl;
      const copy = this.acquire(tw, th);
      this._bindTarget(copy, false); gl.disable(gl.BLEND);
      let pr = this._use(this.progs.copy);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, read.tex); this._u1i(pr, 'uTex', 0); this._drawQuad();
      const fx = E.effects(layer, ctx, time);
      let graded = copy, owned = false;
      for (const f of fx) {
        const out = this.applyFx(comp, layer, graded, f, time, ctx, tw, th);
        if (out && out !== graded) { if (owned) this.release(graded); graded = out; owned = true; }
      }
      const opacity = E.layerOpacity(layer, ctx, time) / 100;
      const masks = E.masks(layer, ctx, time);
      const out = this.acquire(tw, th);
      if (masks.length) {
        const mask = this.renderLayerMask(comp, layer, time, ctx, tw, th, scale);
        this._bindTarget(out, false); gl.disable(gl.BLEND);
        const pm = this._use(this.progs.mixMask);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, read.tex); this._u1i(pm, 'uBase', 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, graded.tex); this._u1i(pm, 'uFx', 1);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, mask.tex); this._u1i(pm, 'uMask', 2);
        this._u1f(pm, 'uOpacity', opacity);
        this._drawQuad();
        this.release(mask);
      } else {
        this._bindTarget(out, false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        const pc = this._use(this.progs.comp);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, graded.tex); this._u1i(pc, 'uSrc', 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, read.tex); this._u1i(pc, 'uDst', 1);
        this._u1i(pc, 'uBlend', 0); this._u1f(pc, 'uOpacity', opacity); this._u1i(pc, 'uUseMatte', 0); this._u1i(pc, 'uPremul', 0); this._u2f(pc, 'uSrcOffset', 0, 0);
        this._drawQuad();
        gl.disable(gl.BLEND);
      }
      // out currently contains copy of read + graded; for masks mix is right. For no masks, composite of graded over read doubles alpha.
      if (!masks.length) {
        // simply use graded as the new read
        this.release(out);
        this.release(read);
        return graded;
      }
      this.release(graded); this.release(read);
      return out;
    }

    /********* composite *********/
    compositeTargets(comp, dst, srcTarget, opacity, blendMode, matteTex, matteMode, premul, offsetX, offsetY, tw, th) {
      const gl = this.gl;
      const out = this.acquire(tw, th);
      this._bindTarget(out, false); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      const p = this._use(this.progs.comp);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTarget.tex); this._u1i(p, 'uSrc', 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dst.tex); this._u1i(p, 'uDst', 1);
      if (matteTex) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, matteTex); this._u1i(p, 'uMatte', 2); }
      else { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this._dummyTex()); this._u1i(p, 'uMatte', 2); }
      const modes = { normal: 0, add: 1, screen: 2, multiply: 3, overlay: 4 };
      this._u1i(p, 'uBlend', modes[blendMode] == null ? 0 : modes[blendMode]);
      this._u1f(p, 'uOpacity', opacity);
      this._u1i(p, 'uUseMatte', matteTex ? 1 : 0);
      this._u1i(p, 'uMatteMode', matteMode || 0);
      this._u1i(p, 'uPremul', premul || 0);
      this._u2f(p, 'uSrcOffset', offsetX / tw, offsetY / th);
      this._drawQuad();
      this.release(dst);
      return out;
    }

    _dummyTex() {
      if (!this._dummy) { this._dummy = this._createTexture(1, 1); this.gl.bindTexture(this.gl.TEXTURE_2D, this._dummy); this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA8, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); }
      return this._dummy;
    }

    // ================= 3D =================
    helperCamera(comp, v) {
      const fov = 35;
      const dist = (comp.height / 2) / Math.tan(U.rad(fov) / 2);
      const center = [comp.width / 2, comp.height / 2, 0];
      let eye, up = [0, -1, 0];
      if (v.type === 'front') eye = [center[0], center[1], center[2] - dist];
      else if (v.type === 'top') { eye = [center[0], center[1] - dist, center[2] + .001]; up = [0, 0, -1]; }
      else if (v.type === 'side') eye = [center[0] + dist, center[1], center[2]];
      else {
        const az = v.azimuth == null ? .55 : v.azimuth, el = v.elevation == null ? .32 : v.elevation;
        const d = dist * (v.zoom || .92);
        eye = [center[0] + Math.sin(az) * Math.cos(el) * d, center[1] - Math.sin(el) * d, center[2] - Math.cos(az) * Math.cos(el) * d];
      }
      return { pos: eye, target: center, fov, focus: M.dist(eye, center), aperture: 0, near: 1, far: 40000, up, helper: true };
    }

    _getMeshBuffers(mesh) {
      if (!mesh || !mesh.pos || !mesh.idx) return null;
      let b = this._meshBufCache.get(mesh);
      if (b) return b;
      const gl = this.gl;
      const n = mesh.pos.length / 3;
      const data = new Float32Array(n * 9);
      for (let i = 0; i < n; i++) {
        data[i * 9] = mesh.pos[i * 3]; data[i * 9 + 1] = mesh.pos[i * 3 + 1]; data[i * 9 + 2] = mesh.pos[i * 3 + 2];
        data[i * 9 + 3] = mesh.nrm[i * 3]; data[i * 9 + 4] = mesh.nrm[i * 3 + 1]; data[i * 9 + 5] = mesh.nrm[i * 3 + 2];
        data[i * 9 + 6] = mesh.uv[i * 2]; data[i * 9 + 7] = mesh.uv[i * 2 + 1]; data[i * 9 + 8] = mesh.region[i] || 0;
      }
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 36, 24);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 36, 32);
      const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      b = { vao, vbo, ibo, count: mesh.idx.length };
      this._meshBufCache.set(mesh, b);
      return b;
    }

    render3D(comp, layers, time, ctx, opts, scale) {
      const gl = this.gl;
      const objects = [], particleLayers = [];
      const releaseTargets = [];
      const cache = this._frameMeshCache || new Map();
      for (const layer of layers) {
        if (!E.isActive(comp, layer, time)) continue;
        if (layer.type === 'particle') { particleLayers.push(layer); continue; }
        if (layer.type !== 'precomp') {
          const lo = E.layerOpacity(layer, ctx, time) / 100;
          const mo = layer.props['mat.opacity'] ? E.num(E.propValue(layer, 'mat.opacity', ctx, time)) / 100 : 1;
          if (lo * mo <= .001) continue;
        }
        if (layer.type === 'precomp' && layer.precomp.mode !== 'preserve3d' && layer.precomp.as3dPlane) {
          const inner = P.findComp(this.project, layer.precomp.compId);
          if (!inner) continue;
          const it = E.innerTime(comp, layer, time, ctx);
          const ov = B.buildOverrides(this.project, inner, layer);
          const innerOut = this.renderComp(inner, it, { scale: scale * .9, bg: false, overrides: ov, _mb: true, depth: (ctx.depth || 0) + 1 });
          if (!innerOut) continue;
          const plane = Mesh.plane(inner.width, inner.height, 1, 1);
          const wm = E.worldMatrix(comp, layer, ctx, time);
          const mesh = Mesh.transform(plane, wm);
          const lo = E.layerOpacity(layer, ctx, time) / 100;
          objects.push({ mesh, material: this._defaultMaterial(), layer, texture: innerOut.tex, unlit: true, castShadow: false, receiveShadow: false, alpha: lo, transparent: lo < .999 });
          releaseTargets.push(innerOut);
          continue;
        }
        const wm = E.worldMatrix(comp, layer, ctx, time);
        const res = B.layerWorldMesh(comp, layer, time, ctx, { cache });
        if (res && res.objects) {
          for (const o of res.objects) {
            if (!o.mesh || !o.mesh.pos.length) continue;
            const mat = o.material || this._defaultMaterial();
            const layerOpacity = E.layerOpacity(layer, ctx, time) / 100;
            const alpha = U.clamp((mat.opacity == null ? 1 : mat.opacity) * layerOpacity, 0, 1);
            const bbox = o.mesh.bbox || Mesh.computeBBox(o.mesh);
            const center = bbox.center;
            const depth = M.dist(center, this._camForDepth ? this._camForDepth.pos : [0, 0, 0]);
            objects.push({ mesh: o.mesh, material: mat, layer, unlit: !!o.unlit, castShadow: o.castShadow !== false, receiveShadow: o.receiveShadow !== false, alpha, transparent: alpha < .995, depth, texture: o.texture || null });
          }
        }
      }
      if (!objects.length && !particleLayers.length) {
        for (const t of releaseTargets) this.release(t);
        return null;
      }
      const cam = opts.viewOverride ? this.helperCamera(comp, opts.viewOverride) : E.activeCameraState(comp, ctx, time);
      this.lastCamera = cam;
      this._camForDepth = cam;
      for (const o of objects) o.depth = M.dist((o.mesh.bbox || Mesh.computeBBox(o.mesh)).center, cam.pos);
      const mats = E.cameraMatrices(cam, comp);
      const vp = mats.vp, view = mats.view;
      this.lastCameraVP = vp;
      const ss = 1.25;
      const tw = Math.max(2, Math.min(MAX_TEX, Math.round(comp.width * scale * ss)));
      const th = Math.max(2, Math.min(MAX_TEX, Math.round(comp.height * scale * ss)));
      const seg = this.acquire(tw, th, { depth: true });
      this._bindTarget(seg, true);
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.disable(gl.CULL_FACE);
      // lights
      const lights = [];
      for (const l of comp.layers) {
        if (l.type !== 'light' || !E.isActive(comp, l, time)) continue;
        const s = E.lightState(comp, l, ctx, time);
        if (s.enabled) lights.push(s);
      }
      const dirLights = lights.filter(l => l.type === 'directional');
      const pointLights = lights.filter(l => l.type === 'point');
      if (!dirLights.length) dirLights.push({ pos: [-comp.width * .3, -comp.height * .6, -comp.height], target: [comp.width / 2, comp.height / 2, 0], color: [1, .96, .91], intensity: 1.9, castsShadow: false });
      let keyLight = null;
      for (const l of dirLights) {
        l.dirToLight = M.norm(M.sub(l.pos, l.target));
        if (l.castsShadow && !keyLight) keyLight = l;
      }
      // shadow
      let hasShadow = 0, lightVP = M.identity();
      if (keyLight && objects.some(o => o.castShadow)) {
        let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (const o of objects) {
          if (!o.castShadow) continue;
          const bb = o.mesh.bbox || Mesh.computeBBox(o.mesh);
          for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], bb.min[k]); max[k] = Math.max(max[k], bb.max[k]); }
        }
        if (isFinite(min[0])) {
          const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
          const radius = Math.max(80, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
          const eye = M.add(center, M.mul(keyLight.dirToLight, Math.max(900, radius * 3)));
          let up = [0, 1, 0]; if (Math.abs(keyLight.dirToLight[1]) > .95) up = [1, 0, 0];
          const lv = M.lookAt(eye, center, up);
          const half = radius * 1.35 + 60;
          const near = 1, far = Math.max(6000, radius * 10);
          const lp = M.ortho(-half, half, -half, half, near, far);
          lightVP = M.mult(lp, lv);
          this._ensureShadowMap();
          gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO);
          gl.viewport(0, 0, 2048, 2048);
          gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
          gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
          gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2.0, 4.0);
          const dp = this._use(this.progs.depth);
          this._umat4(dp, 'uVP', lightVP);
          for (const o of objects) {
            if (!o.castShadow) continue;
            const b = this._getMeshBuffers(o.mesh); if (!b) continue;
            gl.bindVertexArray(b.vao); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
          }
          gl.bindVertexArray(null);
          gl.disable(gl.POLYGON_OFFSET_FILL);
          hasShadow = 1;
          gl.bindFramebuffer(gl.FRAMEBUFFER, seg.fbo);
          gl.viewport(0, 0, tw, th);
        }
      }
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.BLEND);
      const prog = this._use(this.progs.mesh);
      this._umat4(prog, 'uVP', vp);
      this._u3f(prog, 'uCamPos', cam.pos[0], cam.pos[1], cam.pos[2]);
      this._u1f(prog, 'uEnvStrength', 1);
      this._u1f(prog, 'uReflect', 1);
      // lights uniforms
      const dl = dirLights.slice(0, 2), pl = pointLights.slice(0, 3);
      const dirL = new Float32Array(6), dirC = new Float32Array(6), dirI = new Float32Array(2);
      dl.forEach((l, i) => { const d = l.dirToLight; dirL.set([d[0], d[1], d[2]], i * 3); const c = l.color; const k = l.intensity; dirC.set([c[0] * k, c[1] * k, c[2] * k], i * 3); dirI[i] = 1; });
      this._u1i(prog, 'uDirCount', dl.length);
      this._uv3(prog, 'uDirL', dirL); this._uv3(prog, 'uDirC', dirC); this._uvf(prog, 'uDirI', dirI);
      const pp = new Float32Array(9), pc = new Float32Array(9), pi = new Float32Array(3), pr = new Float32Array(3);
      pl.forEach((l, i) => { pp.set(l.pos, i * 3); pc.set([l.color[0], l.color[1], l.color[2]], i * 3); pi[i] = l.intensity; pr[i] = l.radius || 1200; });
      this._u1i(prog, 'uPointCount', pl.length);
      this._uv3(prog, 'uPointP', pp); this._uv3(prog, 'uPointC', pc); this._uvf(prog, 'uPointI', pi); this._uvf(prog, 'uPointR', pr);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.envTex); this._u1i(prog, 'uEnv', 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex || this._dummyTex()); this._u1i(prog, 'uShadow', 1);
      this._u1i(prog, 'uHasShadow', hasShadow);
      this._u1f(prog, 'uShadowStrength', hasShadow ? .85 : 0);
      this._umat4(prog, 'uLightVP', lightVP);
      this._u1f(prog, 'uShadowTexel', 1 / 2048);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this._dummyTex()); this._u1i(prog, 'uTex', 2);
      // opaque
      const opaque = objects.filter(o => !o.transparent);
      const transparent = objects.filter(o => o.transparent).sort((a, b) => b.depth - a.depth);
      for (const o of opaque) this._drawMeshObj(prog, o);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (const o of transparent) this._drawMeshObj(prog, o);
      gl.disable(gl.BLEND); gl.depthMask(true);
      // particles
      gl.bindFramebuffer(gl.FRAMEBUFFER, seg.fbo);
      gl.viewport(0, 0, tw, th);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      for (const layer of particleLayers) {
        this._segBound = seg.fbo;
        this._renderParticleLayer(comp, layer, time, ctx, cam, vp, view, tw, th, opts);
      }
      // DOF
      if (cam.aperture > 0 && this.dofEnabled && opts.dof !== false) {
        const qw = Math.max(2, Math.round(tw / 4)), qh = Math.max(2, Math.round(th / 4));
        const blur = this.acquire(qw, qh);
        this._bindTarget(blur, false);
        gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
        const p = this._use(this.progs.dof);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, seg.tex); this._u1i(p, 'uTex', 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, seg.depthTex); this._u1i(p, 'uDepth', 1);
        this._uv2(p, 'uTexel', [1 / tw, 1 / th]);
        this._u1f(p, 'uFocus', cam.focus); this._u1f(p, 'uNear', cam.near); this._u1f(p, 'uFar', cam.far);
        this._u1f(p, 'uAperture', cam.aperture);
        this._drawQuad();
        const dofTarget = this.acquire(tw, th);
        this._bindTarget(dofTarget, false);
        gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
        const pc = this._use(this.progs.dofCombine);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, seg.tex); this._u1i(pc, 'uSharp', 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, blur.tex); this._u1i(pc, 'uBlur', 1);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, seg.depthTex); this._u1i(pc, 'uDepth', 2);
        this._u1f(pc, 'uFocus', cam.focus); this._u1f(pc, 'uNear', cam.near); this._u1f(pc, 'uFar', cam.far);
        this._u1f(pc, 'uAperture', cam.aperture);
        this._drawQuad();
        this.release(seg); this.release(blur);
        for (const t of releaseTargets) this.release(t);
        gl.disable(gl.DEPTH_TEST);
        return dofTarget;
      }
      gl.disable(gl.DEPTH_TEST); gl.depthMask(true);
      for (const t of releaseTargets) this.release(t);
      return seg;
    }

    _ensureShadowMap() {
      if (this.shadowFBO) return;
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, 2048, 2048, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const color = this._createTexture(2048, 2048, { nearest: true });
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.shadowTex = tex; this.shadowFBO = fbo; this.shadowColor = color;
    }

    _defaultMaterial() {
      const slot = { baseColor: [.7, .76, .78, 1], metalness: .35, roughness: .35, emissive: 0, emissiveColor: [.2, .9, .8, 1] };
      return { slots: { front: { ...slot }, side: { ...slot, baseColor: [.32, .37, .4, 1] }, bevel: { ...slot, baseColor: [.85, .7, .44, 1], metalness: .9 } }, env: 1, reflect: 1, opacity: 1 };
    }

    _drawMeshObj(prog, obj) {
      const gl = this.gl;
      const mat = obj.material || this._defaultMaterial();
      const slots = mat.slots || this._defaultMaterial().slots;
      const base = new Float32Array(9), metal = new Float32Array(3), rough = new Float32Array(3), emis = new Float32Array(3), emisC = new Float32Array(9);
      const order = ['front', 'side', 'bevel'];
      for (let i = 0; i < 3; i++) {
        const s = slots[order[i]] || slots.front;
        base.set([s.baseColor[0], s.baseColor[1], s.baseColor[2]], i * 3);
        metal[i] = s.metalness == null ? .3 : s.metalness;
        rough[i] = s.roughness == null ? .4 : s.roughness;
        emis[i] = s.emissive || 0;
        emisC.set([s.emissiveColor[0], s.emissiveColor[1], s.emissiveColor[2]], i * 3);
      }
      this._uv3(prog, 'uBase', base); this._uvf(prog, 'uMetal', metal); this._uvf(prog, 'uRough', rough);
      this._uvf(prog, 'uEmis', emis); this._uv3(prog, 'uEmisColor', emisC);
      this._u1f(prog, 'uOpacity', obj.alpha);
      this._u1f(prog, 'uEnvStrength', mat.env == null ? 1 : mat.env);
      this._u1f(prog, 'uReflect', mat.reflect == null ? 1 : mat.reflect);
      this._umat4(prog, 'uModel', M.identity());
      if (obj.texture) {
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, obj.texture);
        this._u1i(prog, 'uUseTex', 1); this._u1i(prog, 'uUnlit', obj.unlit ? 1 : 0);
      } else { this._u1i(prog, 'uUseTex', 0); this._u1i(prog, 'uUnlit', 0); }
      const b = this._getMeshBuffers(obj.mesh); if (!b) return;
      gl.bindVertexArray(b.vao);
      gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
    }

    _renderParticleLayer(comp, layer, time, ctx, cam, vp, view, tw, th, opts) {
      const gl = this.gl;
      const simTime = opts.particleTime == null ? time : opts.particleTime;
      const sources = B.particleSources(comp, ctx);
      let sim;
      try { sim = Particles.simulate(comp, layer, simTime, ctx, sources); } catch (e) { console.warn('particle sim', e); return; }
      if (!sim.particles.length) return;
      const layerOpacity = E.layerOpacity(layer, ctx, time) / 100;
      const right = M.norm([view[0], view[4], view[8]]);
      const up = M.norm([view[1], view[5], view[9]]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._segBound || null);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
      // trails first
      const trailVerts = [];
      const trailsCfg = layer.particles.trails || {};
      const tWidth = E.num(E.propValue(layer, 'particle.trailWidth', ctx, simTime)) || 2;
      const tOpacity = E.num(E.propValue(layer, 'particle.trailOpacity', ctx, simTime)) / 100;
      if (trailsCfg.enabled !== false && tOpacity > 0) {
        for (const q of sim.particles) {
          if (!q.hist || q.hist.length < 3) continue;
          const col = Particles.particleColor(layer, q, ctx, simTime);
          for (let i = 1; i < q.hist.length; i++) {
            const p0 = q.hist[i - 1], p1 = q.hist[i];
            const dir = M.sub(p1, p0); const dl = M.len(dir); if (dl < .01) continue;
            const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2];
            const vd = M.norm(M.sub(cam.pos, mid));
            let side = M.cross(dir, vd); const sl = M.len(side); if (sl < 1e-5) continue; side = M.mul(side, 1 / sl);
            const w = Math.max(.4, q.size * tWidth * .16) * (i / q.hist.length);
            const a = Math.min(1, i / q.hist.length) * tOpacity * col[3] * layerOpacity;
            const c = [col[0], col[1], col[2], a];
            const a0 = [p0[0] + side[0] * w, p0[1] + side[1] * w, p0[2] + side[2] * w];
            const a1 = [p0[0] - side[0] * w, p0[1] - side[1] * w, p0[2] - side[2] * w];
            const b0 = [p1[0] + side[0] * w, p1[1] + side[1] * w, p1[2] + side[2] * w];
            const b1 = [p1[0] - side[0] * w, p1[1] - side[1] * w, p1[2] - side[2] * w];
            for (const v of [a0, a1, b0, a1, b1, b0]) trailVerts.push(v[0], v[1], v[2], c[0], c[1], c[2], c[3]);
          }
        }
        if (trailVerts.length) {
          gl.useProgram(this.progs.trail);
          const pt = this.progs.trail;
          this._umat4(pt, 'uVP', vp);
          gl.bindVertexArray(this.trailVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.trailVBO);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(trailVerts), gl.DYNAMIC_DRAW);
          gl.drawArrays(gl.TRIANGLES, 0, trailVerts.length / 7);
          gl.bindVertexArray(null);
        }
      }
      // billboards
      const verts = [];
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
      for (const q of sim.particles) {
        const col = Particles.particleColor(layer, q, ctx, simTime);
        const a = col[3] * layerOpacity * (E.num(E.propValue(layer, 'particle.opacity', ctx, simTime)) / 100);
        if (a <= .002) continue;
        const size = Math.max(.2, q.size * .5);
        const shape = q.type === 1 ? 1 : 0;
        for (const c of corners) verts.push(c[0], c[1], q.p[0], q.p[1], q.p[2], col[0], col[1], col[2], a, size, q.rot, shape);
      }
      if (!verts.length) return;
      const p = this._use(this.progs.part);
      this._umat4(p, 'uVP', vp);
      this._uv3(p, 'uRight', right); this._uv3(p, 'uUp', up);
      gl.bindVertexArray(this.partVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.partVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, verts.length / 12);
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      // restore segment fbo
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._segBound || null);
      gl.viewport(0, 0, tw, th);
    }

    displayTarget(target, comp, view) {
      // used for export screenshots / offscreen
    }
  }

  AE.Renderer = Renderer;
})();
