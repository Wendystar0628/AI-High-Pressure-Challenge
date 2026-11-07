/* =========================================================================
   renderer.js — WebGL 2 rendering pipeline
   scene (lit / flat / textured / sprite) -> bloom -> DOF -> grade -> canvas
   ========================================================================= */
(function(AE){
'use strict';
const M=AE.M, clamp=AE.clamp;

const SCENE_VS=`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aColor;
layout(location=3) in vec4 aParams;
layout(location=4) in vec2 aUV;
uniform mat4 uViewProj;
out vec3 vWorld; out vec3 vNormal; out vec4 vColor; out vec4 vParams; out vec2 vUV;
void main(){
  gl_Position = uViewProj * vec4(aPos,1.0);
  vWorld=aPos; vNormal=aNormal; vColor=aColor; vParams=aParams; vUV=aUV;
}`;

const SCENE_FS=`#version 300 es
precision highp float;
in vec3 vWorld; in vec3 vNormal; in vec4 vColor; in vec4 vParams; in vec2 vUV;
uniform vec3 uCamPos, uAmbient;
uniform vec3 uLightPos[4]; uniform vec3 uLightDir[4]; uniform vec3 uLightColor[4];
uniform float uLightInt[4]; uniform int uLightType[4]; uniform int uNumLights;
uniform sampler2D uTex; uniform float uAccum;
out vec4 outColor;
void main(){
  int mode = int(vParams.w + 0.5);
  vec4 col = vColor;
  if(mode==2){
    col = vec4(vColor.rgb,1.0) * texture(uTex, vUV); col.a *= vColor.a;
  } else if(mode==3){
    float d = length(vUV - vec2(0.5));
    float a = smoothstep(0.5, 0.03, d);
    col = vec4(vColor.rgb, vColor.a * a);
  }
  float alpha = col.a;
  if(alpha < 0.004) discard;
  if(mode==0){
    vec3 N = normalize(vNormal);
    vec3 Vv = normalize(uCamPos - vWorld);
    float metallic = clamp(vParams.x,0.0,1.0);
    float rough = clamp(vParams.y,0.04,1.0);
    float emis = vParams.z;
    vec3 base = col.rgb;
    vec3 lit = base * uAmbient * mix(0.85, 0.32, metallic);
    for(int i=0;i<4;i++){
      if(i>=uNumLights) break;
      vec3 L = (uLightType[i]==0) ? normalize(-uLightDir[i]) : normalize(uLightPos[i]-vWorld);
      float ndl = max(dot(N,L),0.0);
      float dist = length(uLightPos[i]-vWorld);
      float atten = (uLightType[i]==0) ? 1.0 : clamp(1.0/(1.0+0.0000012*dist*dist),0.0,1.0);
      vec3 H = normalize(L+Vv);
      float shin = mix(7.0, 170.0, 1.0-rough);
      float spec = pow(max(dot(N,H),0.0), shin) * mix(0.06,1.0,metallic) * (1.0-rough*0.55);
      lit += uLightColor[i]*uLightInt[i]*atten*(base*ndl*(1.0-metallic*0.7) + vec3(spec));
    }
    vec3 R = reflect(-Vv,N);
    float fres = pow(1.0-max(dot(N,Vv),0.0),5.0);
    vec3 sky = mix(uAmbient*0.65, vec3(0.50,0.66,0.92), clamp(R.y*0.5+0.5,0.0,1.0));
    sky += vec3(1.0,0.72,0.34)*pow(max(R.y,0.0),3.0)*0.60;
    sky += vec3(0.20,0.44,0.85)*pow(max(-R.y,0.0),2.0)*0.28;
    lit += sky*(0.09 + fres*0.5*metallic + (1.0-rough)*0.16);
    lit += base*emis;
    col = vec4(lit, alpha);
  }
  // premultiplied output
  outColor = vec4(col.rgb*col.a, col.a) * uAccum;
}`;

const QUAD_VS=`#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main(){ vUV=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }`;

const BRIGHT_FS=`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform float uThresh;
out vec4 o;
void main(){ vec3 c=texture(uTex,vUV).rgb; float l=dot(c,vec3(0.299,0.587,0.114));
  o=vec4(c*smoothstep(uThresh,uThresh+0.35,l),1.0); }`;

const BLUR_FS=`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; uniform vec2 uDir;
out vec4 o;
void main(){
  vec3 s = texture(uTex,vUV).rgb*0.227027;
  s += texture(uTex,vUV+uDir*1.3846*uTexel).rgb*0.316216;
  s += texture(uTex,vUV-uDir*1.3846*uTexel).rgb*0.316216;
  s += texture(uTex,vUV+uDir*3.2308*uTexel).rgb*0.070270;
  s += texture(uTex,vUV-uDir*3.2308*uTexel).rgb*0.070270;
  o=vec4(s,1.0);
}`;

const DOF_FS=`#version 300 es
precision highp float; in vec2 vUV;
uniform sampler2D uTex, uDepth; uniform vec2 uTexel;
uniform float uNear,uFar,uFocus,uAperture,uMaxBlur,uDofOn;
out vec4 o;
float lin(vec2 uv){ float z=texture(uDepth,uv).r*2.0-1.0; return (2.0*uNear*uFar)/(uFar+uNear-z*(uFar-uNear)); }
void main(){
  vec3 c0=texture(uTex,vUV).rgb;
  if(uDofOn<0.5){ o=vec4(c0,1.0); return; }
  float d=lin(vUV);
  float coc=clamp(abs(d-uFocus)/max(uFocus*0.85,1.0)*uAperture,0.0,1.0);
  float r=coc*uMaxBlur;
  vec3 sum=c0; float w=1.0;
  for(int i=0;i<12;i++){
    float a=float(i)*2.39996323;
    float rr=sqrt((float(i)+0.5)/12.0)*r;
    vec2 off=vec2(cos(a),sin(a))*rr*uTexel;
    sum+=texture(uTex,vUV+off).rgb; w+=1.0;
  }
  o=vec4(sum/w,1.0);
}`;

const FINAL_FS=`#version 300 es
precision highp float; in vec2 vUV;
uniform sampler2D uScene, uBloom;
uniform vec2 uCanvas;
uniform vec4 uFit;              // scaleX,scaleY,offX,offY (canvas uv fractions)
uniform float uTime,uBloomInt,uGrain,uVig,uContrast,uSat,uBright,uHue,uEcho,uAberr,uFlipY;
uniform vec2 uMB;
out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
vec3 hueRot(vec3 c,float a){ const vec3 k=vec3(0.57735); float ca=cos(a);
  return c*ca + cross(k,c)*sin(a) + k*dot(k,c)*(1.0-ca); }
void main(){
  vec2 cuv=(vUV-uFit.zw)/uFit.xy;
  if(uFlipY>0.5) cuv.y=1.0-cuv.y;
  if(cuv.x<0.0||cuv.x>1.0||cuv.y<0.0||cuv.y>1.0){
    float ck=mod(floor(gl_FragCoord.x/12.0)+floor(gl_FragCoord.y/12.0),2.0);
    o=vec4(vec3(ck>0.5?0.055:0.043),1.0); return;
  }
  vec2 ab=vec2(uAberr,0.0)/uCanvas;
  vec3 c;
  if(dot(uMB,uMB)>0.0000004){
    vec3 acc=vec3(0.0);
    for(int i=0;i<7;i++){ float k=float(i)/6.0-0.5; acc+=texture(uScene,cuv+uMB*k).rgb; }
    c=acc/7.0;
  } else {
    c.r=texture(uScene,cuv+ab).r;
    c.g=texture(uScene,cuv).g;
    c.b=texture(uScene,cuv-ab).b;
  }
  // echo: deterministic radial ghosts read from the same frame
  if(uEcho>0.001){
    vec2 d=(cuv-0.5);
    c += texture(uScene,0.5+d*0.985).rgb*uEcho*0.5;
    c += texture(uScene,0.5+d*0.97).rgb*uEcho*0.3;
    c = c/(1.0+uEcho*0.8);
  }
  c += texture(uBloom,cuv).rgb*uBloomInt;
  // grade
  c = (c-0.5)*uContrast+0.5;
  float l=dot(c,vec3(0.299,0.587,0.114));
  c = mix(vec3(l),c,uSat);
  c = hueRot(c,uHue)*uBright;
  // vignette
  vec2 q=cuv-0.5; float v=1.0-uVig*dot(q,q)*2.1; c*=clamp(v,0.0,1.0);
  // grain (deterministic in t)
  float g=(hash(gl_FragCoord.xy+vec2(uTime*53.1,uTime*97.7))-0.5)*uGrain;
  c+=g;
  o=vec4(clamp(c,0.0,1.0),1.0);
}`;

AE.Renderer=class{
  constructor(canvas){
    this.canvas=canvas;
    const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,premultipliedAlpha:false,preserveDrawingBuffer:true});
    if(!gl){this.gl=null;return;}
    this.gl=gl;
    gl.disable(gl.CULL_FACE);
    this.scene=this._prog(SCENE_VS,SCENE_FS);
    this.bright=this._prog(QUAD_VS,BRIGHT_FS);
    this.blur=this._prog(QUAD_VS,BLUR_FS);
    this.dof=this._prog(QUAD_VS,DOF_FS);
    this.final=this._prog(QUAD_VS,FINAL_FS);
    // fullscreen quad
    this.quadVAO=gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);
    const qb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qb);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    // scene dynamic VAO / VBO (interleaved 16 floats)
    this.sceneVAO=gl.createVertexArray();
    this.sceneVBO=gl.createBuffer();
    gl.bindVertexArray(this.sceneVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.sceneVBO);
    const S=16*4;
    [[0,3,0],[1,3,12],[2,4,24],[3,4,40],[4,2,56]].forEach(([loc,size,off])=>{
      gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,S,off);
    });
    gl.bindVertexArray(null);
    this.targets={};this.W=0;this.H=0;
    this.glyphTex=null;
    this.ready=true;
  }
  _prog(vs,fs){
    const gl=this.gl;
    const c=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.error('shader:',gl.getShaderInfoLog(s),src);return s;};
    const p=gl.createProgram();gl.attachShader(p,c(gl.VERTEX_SHADER,vs));gl.attachShader(p,c(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))console.error('link:',gl.getProgramInfoLog(p));
    p._u={};return p;
  }
  _u(p,n){if(!(n in p._u))p._u[n]=this.gl.getUniformLocation(p,n);return p._u[n];}
  _target(w,h,depthTex){
    const gl=this.gl;
    const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
    const color=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,color);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,color,0);
    let depth=null;
    if(depthTex){
      depth=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,depth);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,w,h,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depth,0);
    } else {
      depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depth);
      gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    return {fbo,color,depth,w,h};
  }
  ensureSize(W,H){
    if(this.W===W&&this.H===H)return;
    const gl=this.gl;
    for(const k in this.targets){const t=this.targets[k];gl.deleteFramebuffer(t.fbo);gl.deleteTexture(t.color);if(t.depth){try{gl.deleteTexture(t.depth);}catch(e){gl.deleteRenderbuffer(t.depth);}}}
    this.W=W;this.H=H;
    this.targets.scene=this._target(W,H,true);
    this.targets.dof=this._target(W,H,false);
    const bw=Math.max(2,W>>1),bh=Math.max(2,H>>1);
    this.targets.bloomA=this._target(bw,bh,false);
    this.targets.bloomB=this._target(bw,bh,false);
  }
  _upload(batch){
    const n=batch.count, data=new Float32Array(n*16);
    const P=batch.P,N=batch.N,C=batch.C,MM=batch.M,UV=batch.UV;
    for(let i=0;i<n;i++){
      const o=i*16,j=i*3,k=i*4,l=i*2;
      data[o]=P[j];data[o+1]=P[j+1];data[o+2]=P[j+2];
      data[o+3]=N[j];data[o+4]=N[j+1];data[o+5]=N[j+2];
      data[o+6]=C[k];data[o+7]=C[k+1];data[o+8]=C[k+2];data[o+9]=C[k+3];
      data[o+10]=MM[k];data[o+11]=MM[k+1];data[o+12]=MM[k+2];data[o+13]=MM[k+3];
      data[o+14]=UV[l];data[o+15]=UV[l+1];
    }
    const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.sceneVBO);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
    return n;
  }
  _setLights(prog,lights,ambient){
    const gl=this.gl;
    const LP=[],LD=[],LC=[],LI=[],LT=[];
    for(let i=0;i<4;i++){
      const L=lights[i];
      LP.push(...(L&&L.pos?L.pos:[0,0,0]));
      LD.push(...(L&&L.dir?L.dir:[0.3,-1,-0.5]));
      LC.push(...(L&&L.color?L.color:[1,1,1]));
      LI.push(L?clamp(L.intensity,0,4):0);
      LT.push(L?(L.type==='point'?1:0):0);
    }
    gl.uniform3fv(this._u(prog,'uLightPos[0]'),new Float32Array(LP));
    gl.uniform3fv(this._u(prog,'uLightDir[0]'),new Float32Array(LD));
    gl.uniform3fv(this._u(prog,'uLightColor[0]'),new Float32Array(LC));
    gl.uniform1fv(this._u(prog,'uLightInt[0]'),new Float32Array(LI));
    gl.uniform1iv(this._u(prog,'uLightType[0]'),new Int32Array(LT));
    gl.uniform1i(this._u(prog,'uNumLights'),Math.min(4,lights.length));
    gl.uniform3fv(this._u(prog,'uAmbient'),new Float32Array(ambient||[0.22,0.25,0.32]));
  }
  _drawBatches(frame,vpScene,vpOverlay,camPos,accum,accumMode){
    const gl=this.gl,p=this.scene;
    gl.useProgram(p);
    gl.uniformMatrix4fv(this._u(p,'uViewProj'),false,new Float32Array(vpScene));
    gl.uniform3fv(this._u(p,'uCamPos'),new Float32Array(camPos));
    gl.uniform1f(this._u(p,'uAccum'),accum);
    this._setLights(p,frame.lights||[],frame.ambient);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,AE.Glyphs.getTexture(gl));
    gl.uniform1i(this._u(p,'uTex'),0);
    gl.bindVertexArray(this.sceneVAO);

    const drawPass=(b,vp,depthTest,depthWrite,blendFunc)=>{
      if(!b||!b.count)return;
      gl.uniformMatrix4fv(this._u(p,'uViewProj'),false,new Float32Array(vp));
      if(depthTest){gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);}else gl.disable(gl.DEPTH_TEST);
      gl.depthMask(depthWrite);
      gl.enable(gl.BLEND);gl.blendFunc(blendFunc[0],blendFunc[1]);
      const n=this._upload(b);
      gl.drawArrays(gl.TRIANGLES,0,n);
    };
    const sBlend=accumMode?[gl.ONE,gl.ONE]:[gl.ONE,gl.ONE_MINUS_SRC_ALPHA];
    drawPass(frame.solid,vpScene,true,true,sBlend);
    drawPass(frame.glow,vpScene,true,false,[gl.ONE,gl.ONE]);
    if(frame.multiply&&frame.multiply.count)
      drawPass(frame.multiply,vpScene,true,false,accumMode?[gl.ONE,gl.ONE]:[gl.DST_COLOR,gl.ZERO]);
    gl.bindVertexArray(null);
    gl.depthMask(true);
  }
  _full(target,prog,setup){
    const gl=this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER,target?target.fbo:null);
    gl.viewport(0,0,target?target.w:this.canvas.width,target?target.h:this.canvas.height);
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
    gl.useProgram(prog);
    gl.bindVertexArray(this.quadVAO);
    if(setup)setup(prog);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }
  _bindTex(prog,name,tex,unit){
    const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.uniform1i(this._u(prog,name),unit);
  }

  /* main entry ---------------------------------------------------------- */
  render(frame,opts){
    const gl=this.gl;if(!gl||!this.ready)return;
    opts=opts||{};
    const W=frame.W||1600,H=frame.H||900;
    this.ensureSize(W,H);
    const cw=this.canvas.width,ch=this.canvas.height;

    // camera matrices
    const cam=frame.camera||{};
    const D=cam.dist||Math.max(1400,H*1.7);
    const fovy=2*Math.atan(H/(2*D));
    const proj=M.perspective(fovy,W/H,cam.near||1,cam.far||9000);proj[5]*=-1; // y-down
    const eye=cam.eye||[0,0,D],target=cam.target||[0,0,0];
    const view=M.lookAt(eye,target,[0,1,0]);
    const vpScene=M.mul(proj,view);
    const vpOverlay=[2/W,0,0,0, 0,-2/H,0,0, 0,0,1,0, -1,1,0,1];

    const post=frame.post||{};

    // ---- scene pass into scene target ----
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.targets.scene.fbo);
    gl.viewport(0,0,W,H);
    const bg=frame.bg||[0.043,0.055,0.075,1];
    gl.clearColor(bg[0],bg[1],bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    // screen-space background gradient (drawn behind everything, depth off)
    if(frame.bgBatch&&frame.bgBatch.count){
      const p=this.scene;gl.useProgram(p);
      gl.uniform3fv(this._u(p,'uCamPos'),new Float32Array(eye));
      gl.uniform1f(this._u(p,'uAccum'),1);
      this._setLights(p,frame.lights||[],frame.ambient);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,AE.Glyphs.getTexture(gl));gl.uniform1i(this._u(p,'uTex'),0);
      gl.uniformMatrix4fv(this._u(p,'uViewProj'),false,new Float32Array(vpOverlay));
      gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(this.sceneVAO);
      const nb=this._upload(frame.bgBatch);gl.drawArrays(gl.TRIANGLES,0,nb);
      gl.bindVertexArray(null);gl.depthMask(true);gl.disable(gl.BLEND);
    }
    this._drawBatches(frame,vpScene,vpOverlay,eye,1,false);
    gl.depthMask(true);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);

    // ---- bloom ----
    const A=this.targets.bloomA,B=this.targets.bloomB;
    this._full(A,this.bright,(p)=>{this._bindTex(p,'uTex',this.targets.scene.color,0);
      gl.uniform1f(this._u(p,'uThresh'),post.bloomThresh===undefined?0.62:post.bloomThresh);});
    for(let k=0;k<2;k++){
      this._full(B,this.blur,(p)=>{this._bindTex(p,'uTex',A.color,0);
        gl.uniform2f(this._u(p,'uTexel'),1/A.w,1/A.h);gl.uniform2f(this._u(p,'uDir'),1,0);});
      this._full(A,this.blur,(p)=>{this._bindTex(p,'uTex',B.color,0);
        gl.uniform2f(this._u(p,'uTexel'),1/B.w,1/B.h);gl.uniform2f(this._u(p,'uDir'),0,1);});
    }
    // ---- DOF ----
    this._full(this.targets.dof,this.dof,(p)=>{
      this._bindTex(p,'uTex',this.targets.scene.color,0);
      this._bindTex(p,'uDepth',this.targets.scene.depth,1);
      gl.uniform2f(this._u(p,'uTexel'),1/W,1/H);
      gl.uniform1f(this._u(p,'uNear'),cam.near||1);gl.uniform1f(this._u(p,'uFar'),cam.far||9000);
      gl.uniform1f(this._u(p,'uFocus'),post.focus||D);
      gl.uniform1f(this._u(p,'uAperture'),post.aperture===undefined?0:post.aperture);
      gl.uniform1f(this._u(p,'uMaxBlur'),post.maxBlur||10);
      gl.uniform1f(this._u(p,'uDofOn'),post.dofOn?1:0);
    });
    // ---- overlay drawn sharp on top of DOF result ----
    if(frame.overlay&&frame.overlay.count){
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.targets.dof.fbo);
      gl.viewport(0,0,W,H);
      const p=this.scene;gl.useProgram(p);
      gl.uniform3fv(this._u(p,'uCamPos'),new Float32Array(eye));
      gl.uniform1f(this._u(p,'uAccum'),1);
      this._setLights(p,frame.lights||[],frame.ambient);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,AE.Glyphs.getTexture(gl));gl.uniform1i(this._u(p,'uTex'),0);
      gl.uniformMatrix4fv(this._u(p,'uViewProj'),false,new Float32Array(vpOverlay));
      gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(this.sceneVAO);
      const n=this._upload(frame.overlay);gl.drawArrays(gl.TRIANGLES,0,n);
      gl.bindVertexArray(null);gl.depthMask(true);gl.disable(gl.BLEND);
    }
    // ---- final grade + letterbox to canvas ----
    let scale=opts.zoom||1;
    const fits=Math.min(cw/W,ch/H)*scale;
    const dispW=W*fits,dispH=H*fits;
    const offX=(cw-dispW)/2+(opts.panX||0),offY=(ch-dispH)/2+(opts.panY||0);
    this._full(null,this.final,(p)=>{
      this._bindTex(p,'uScene',this.targets.dof.color,0);
      this._bindTex(p,'uBloom',A.color,1);
      gl.uniform2f(this._u(p,'uCanvas'),cw,ch);
      gl.uniform4f(this._u(p,'uFit'),dispW/cw,dispH/ch,offX/cw,offY/ch);
      gl.uniform1f(this._u(p,'uTime'),frame.t||0);
      gl.uniform1f(this._u(p,'uBloomInt'),post.bloom===undefined?0.9:post.bloom);
      gl.uniform1f(this._u(p,'uGrain'),post.grain===undefined?0.028:post.grain);
      gl.uniform1f(this._u(p,'uVig'),post.vignette===undefined?0.35:post.vignette);
      gl.uniform1f(this._u(p,'uContrast'),post.contrast===undefined?1.06:post.contrast);
      gl.uniform1f(this._u(p,'uSat'),post.sat===undefined?1.06:post.sat);
      gl.uniform1f(this._u(p,'uBright'),post.bright===undefined?1.0:post.bright);
      gl.uniform1f(this._u(p,'uHue'),post.hue||0);
      gl.uniform1f(this._u(p,'uEcho'),post.echo||0);
      gl.uniform1f(this._u(p,'uAberr'),post.aberr||0);
      gl.uniform2f(this._u(p,'uMB'),(post.mbVec&&post.mbVec[0])||0,(post.mbVec&&post.mbVec[1])||0);
      gl.uniform1f(this._u(p,'uFlipY'),opts.flipY||0);
    });
    gl.bindVertexArray(null);
  }
};

})(window.AE);
