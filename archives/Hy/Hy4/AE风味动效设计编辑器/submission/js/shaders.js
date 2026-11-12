/* ============================================================
   shaders.js — WebGL2 GLSL 源
   背景 / PBR 金属（环境反射·阴影·发光） / 阴影深度 / 粒子与拖尾 /
   亮部提取 / 高斯模糊 / 合成（Bloom + 景深 + ACES + 暗角 + 颗粒）
   ============================================================ */
(function(){
  "use strict";
  const S=window.AE.shaders={};

  S.quadVS=`#version 300 es
  out vec2 vUV;
  void main(){
    vec2 p=vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2));
    vUV=p*0.5;
    gl_Position=vec4(p*2.0-1.0,0.0,1.0);
  }`;

  /* ---------------- 背景 ---------------- */
  S.bgFS=`#version 300 es
  precision highp float;
  in vec2 vUV; out vec4 o;
  uniform float uTime; uniform float uWeight; uniform vec2 uRes;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){
    vec2 uv=vUV;
    // 深色工坊渐变（近黑，让炽热金属成为唯一亮点）
    vec3 top=vec3(0.005,0.008,0.014);
    vec3 bot=vec3(0.018,0.010,0.007);
    vec3 col=mix(bot,top,smoothstep(0.0,0.9,uv.y));
    // 炉火低位辉光（收敛、局部）
    vec2 g=vec2(0.5,0.06);
    float d=length((uv-g)*vec2(1.0,1.85));
    col+=vec3(0.85,0.26,0.06)*exp(-d*d*17.0)*0.17;
    col+=vec3(1.0,0.50,0.16)*exp(-d*d*75.0)*0.16;
    // 竖直光柱
    float shaft=exp(-pow((uv.x-0.5)*4.5,2.0))*smoothstep(0.0,0.7,uv.y)*0.008;
    col+=vec3(0.7,0.55,0.4)*shaft;
    // 漂浮余烬（程序化，随时间缓慢上升）
    vec2 cell=floor(uv*vec2(60.0,34.0));
    float h=hash(cell);
    if(h>0.972){
      vec2 f=fract(uv*vec2(60.0,34.0));
      float rise=fract(uTime*0.06+h*7.0);
      vec2 cp=vec2(0.5,1.0-rise);
      float dd=length((f-cp)*vec2(1.0,1.0));
      float a=exp(-dd*dd*160.0)*0.22*(0.4+0.6*hash(cell+3.1));
      col+=vec3(1.0,0.45,0.12)*a;
    }
    // 细微噪点
    col+=(hash(uv*uRes+uTime)-0.5)*0.006;
    o=vec4(col*uWeight,uWeight);
  }`;

  /* ---------------- 阴影深度 ---------------- */
  S.depthVS=`#version 300 es
  layout(location=0) in vec3 aPos; uniform mat4 uLightVP; uniform mat4 uModel;
  void main(){ gl_Position=uLightVP*uModel*vec4(aPos,1.0); }`;
  S.depthFS=`#version 300 es
  precision highp float;
  out vec4 oColor;
  void main(){ oColor=vec4(gl_FragCoord.z,0.0,0.0,1.0); }`;

  /* ---------------- 主几何（金属 PBR） ---------------- */
  S.meshVS=`#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm;
  uniform mat4 uVP; uniform mat4 uModel; uniform mat3 uNormalMat; uniform mat4 uLightVP;
  out vec3 vWorld; out vec3 vNormal; out vec4 vLightPos; out vec3 vLocal;
  void main(){
    vec4 w=uModel*vec4(aPos,1.0);
    vWorld=w.xyz; vNormal=normalize(uNormalMat*aNrm); vLocal=aPos;
    vLightPos=uLightVP*w;
    gl_Position=uVP*w;
  }`;
  S.meshFS=`#version 300 es
  precision highp float;
  in vec3 vWorld; in vec3 vNormal; in vec4 vLightPos; in vec3 vLocal;
  out vec4 o;
  uniform vec3 uCamPos;
  uniform sampler2D uShadow; uniform float uHasShadow;
  uniform vec3 uLightDir, uLightColor, uPointPos, uPointColor;
  uniform float uLightInt, uPointInt;
  uniform vec3 uBaseColor, uEmissive;
  uniform float uMetalness, uRoughness, uOpacity, uEmissiveInt, uWeight, uTime;
  const float SH=1024.0;

  vec3 envColor(vec3 d,float rough){
    float up=clamp(d.y*0.5+0.5,0.0,1.0);
    vec3 sky=mix(vec3(0.02,0.028,0.05),vec3(0.11,0.14,0.20),up);
    vec3 ground=vec3(0.17,0.075,0.032);
    vec3 col=mix(ground,sky,smoothstep(0.0,0.58,up));
    vec3 w=normalize(vec3(-0.45,0.78,0.42));
    float hi=pow(max(dot(d,w),0.0),mix(220.0,5.0,rough))*(1.25-rough);
    col+=vec3(1.0,0.86,0.64)*hi*2.6;
    vec3 w2=normalize(vec3(0.7,0.4,-0.5));
    col+=vec3(0.45,0.65,0.9)*pow(max(dot(d,w2),0.0),mix(90.0,8.0,rough))*0.5;
    col+=vec3(0.95,0.34,0.09)*pow(max(dot(d,normalize(vec3(0.15,-0.85,0.45))),0.0),3.0)*0.55;
    return col;
  }
  float shadowFactor(vec4 lp,vec3 N,vec3 L){
    if(uHasShadow<0.5)return 1.0;
    vec3 pr=lp.xyz/lp.w; pr=pr*0.5+0.5;
    if(pr.x<0.0||pr.x>1.0||pr.y<0.0||pr.y>1.0||pr.z>1.0)return 1.0;
    float bias=max(0.0018*(1.0-max(dot(N,L),0.0)),0.0006);
    float s=0.0; vec2 tx=vec2(1.0/SH);
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
      float dd=texture(uShadow,pr.xy+vec2(float(x),float(y))*tx).r;
      s+=(pr.z-bias>dd)?0.0:1.0;
    }
    return s/9.0;
  }
  void main(){
    vec3 N=normalize(vNormal);
    vec3 V=normalize(uCamPos-vWorld);
    if(dot(N,V)<0.0)N=-N;
    vec3 L=normalize(-uLightDir);
    float ndl=max(dot(N,L),0.0);
    vec3 H=normalize(L+V);
    float ndh=max(dot(N,H),0.0);
    float shine=mix(160.0,5.0,uRoughness);
    float spec=pow(ndh,shine)*(1.0-uRoughness*0.55);
    float fres=pow(1.0-max(dot(N,V),0.0),5.0);
    vec3 F0=mix(vec3(0.05),uBaseColor,uMetalness);
    vec3 F=F0+(1.0-F0)*fres;
    vec3 R=reflect(-V,N);
    vec3 env=envColor(R,uRoughness);
    float sh=shadowFactor(vLightPos,N,L);
    vec3 ambient=env*0.34+vec3(0.028,0.030,0.038);
    vec3 diffuse=uLightColor*uLightInt*ndl*sh*uBaseColor*(1.0-uMetalness*0.85);
    vec3 specC=uLightColor*uLightInt*spec*sh*F*2.4;
    // 点光
    vec3 pd=uPointPos-vWorld; float dist=length(pd)+0.001; vec3 PL=pd/dist;
    float pndl=max(dot(N,PL),0.0);
    float atten=uPointInt/(1.0+0.10*dist*dist);
    vec3 pdiff=uPointColor*pndl*atten*uBaseColor*1.1;
    vec3 pH=normalize(PL+V);
    float pspec=pow(max(dot(N,pH),0.0),shine)*atten;
    vec3 pspecC=uPointColor*pspec*F;
    vec3 refl=env*F*(0.35+0.65*uMetalness)*(1.0-uRoughness*0.65);
    vec3 col=ambient*uBaseColor+diffuse+specC+pdiff+pspecC+refl;
    col+=uEmissive*uEmissiveInt;
    float rim=pow(1.0-max(dot(N,V),0.0),2.2);
    col+=uEmissive*rim*uEmissiveInt*0.5;
    o=vec4(col*uWeight,uOpacity*uWeight);
  }`;

  /* ---------------- 粒子（点精灵） ---------------- */
  S.pointVS=`#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec3 aColor;
  layout(location=2) in float aSize; layout(location=3) in float aAlpha;
  uniform mat4 uVP; uniform float uPointScale;
  out vec3 vColor; out float vAlpha;
  void main(){
    vec4 c=uVP*vec4(aPos,1.0);
    gl_Position=c;
    gl_PointSize=clamp(aSize*uPointScale/max(c.w,0.15),1.0,72.0);
    vColor=aColor; vAlpha=aAlpha;
  }`;
  S.pointFS=`#version 300 es
  precision highp float;
  in vec3 vColor; in float vAlpha; out vec4 o;
  uniform float uWeight;
  void main(){
    vec2 d=gl_PointCoord*2.0-1.0;
    float r=dot(d,d);
    if(r>1.0)discard;
    float a=exp(-r*3.2)*vAlpha;
    float core=exp(-r*12.0);
    vec3 c=vColor*(a+core*1.3);
    o=vec4(c*uWeight,a*uWeight);
  }`;

  /* ---------------- 拖尾（线段） ---------------- */
  S.lineVS=`#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec3 aColor;
  layout(location=2) in float aAlpha;
  uniform mat4 uVP; out vec3 vColor; out float vAlpha;
  void main(){ gl_Position=uVP*vec4(aPos,1.0); vColor=aColor; vAlpha=aAlpha; }`;
  S.lineFS=`#version 300 es
  precision highp float;
  in vec3 vColor; in float vAlpha; out vec4 o; uniform float uWeight;
  void main(){ o=vec4(vColor*vAlpha*uWeight,vAlpha*uWeight); }`;

  /* ---------------- 后处理 ---------------- */
  S.brightFS=`#version 300 es
  precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform float uThreshold;
  void main(){
    vec3 c=texture(uTex,vUV).rgb;
    float l=dot(c,vec3(0.2126,0.7152,0.0722));
    o=vec4(c*smoothstep(uThreshold,uThreshold+0.55,l),1.0);
  }`;
  S.blurFS=`#version 300 es
  precision highp float; in vec2 vUV; out vec4 o;
  uniform sampler2D uTex; uniform vec2 uDir;
  void main(){
    vec3 s=vec3(0.0);
    float w[5]; w[0]=0.227027;w[1]=0.194594;w[2]=0.121621;w[3]=0.054054;w[4]=0.016216;
    s+=texture(uTex,vUV).rgb*w[0];
    for(int i=1;i<5;i++){
      s+=texture(uTex,vUV+uDir*float(i)).rgb*w[i];
      s+=texture(uTex,vUV-uDir*float(i)).rgb*w[i];
    }
    o=vec4(s,1.0);
  }`;
  S.compositeFS=`#version 300 es
  precision highp float; in vec2 vUV; out vec4 o;
  uniform sampler2D uScene, uBloom, uDepth;
  uniform vec2 uTexel;
  uniform float uNear,uFar,uFocus,uAperture,uMaxCoC,uBloomStrength,uExposure,uTime;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  vec3 aces(vec3 x){
    const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
  }
  void main(){
    float dep=texture(uDepth,vUV).r;
    float lin=(2.0*uNear*uFar)/(uFar+uNear-(dep*2.0-1.0)*(uFar-uNear));
    float coc=clamp(abs(lin-uFocus)*uAperture,0.0,uMaxCoC);
    vec3 dof=vec3(0.0);float ws=0.0;
    // 8 抽样景深模糊（由可见表面实际深度决定）
    const int N=8;
    for(int i=0;i<N;i++){
      float a=float(i)/float(N)*6.2831853;
      vec2 off=vec2(cos(a),sin(a))*coc*uTexel;
      float w=1.0; dof+=texture(uScene,vUV+off).rgb*w; ws+=w;
    }
    dof/=ws;
    dof=mix(texture(uScene,vUV).rgb,dof,clamp(coc*1.6,0.0,1.0));
    vec3 bloom=texture(uBloom,vUV).rgb*uBloomStrength;
    vec3 col=dof+bloom;
    col=aces(col*uExposure);
    col=pow(col,vec3(1.0/2.2));
    float v=smoothstep(1.12,0.32,length(vUV-0.5));
    col*=mix(0.60,1.0,v);
    col+=(hash(vUV*vec2(1920.0,1080.0)+uTime)-0.5)*0.016;
    o=vec4(col,1.0);
  }`;

  console.log('[forge] shaders ready');
})();
