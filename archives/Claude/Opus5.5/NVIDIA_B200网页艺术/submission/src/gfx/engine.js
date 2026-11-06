// 渲染器与后处理链：HDR 场景 → 接触暗部 → 景深 → 运动模糊 → 只作用于亮部的辉光 → 观察窗折射 → 色调映射。
// 所有效果都由场景深度和相机真实运动算出，不用贴图代替。
import * as THREE from 'three';

const VS = /* glsl */`varying vec2 vUv; void main(){ vUv = position.xy*.5+.5; gl_Position = vec4(position.xy,0.,1.); }`;
const IGN = /* glsl */`float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715)))); }`;

const pass = (frag, uniforms) => new THREE.ShaderMaterial({
  vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
});

const FS_AO = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tDepth; uniform mat4 uInvProj; uniform float uRadius, uProjScale; ${IGN}
vec3 vp(vec2 uv){ float z=texture2D(tDepth,uv).r; vec4 c=vec4(uv*2.-1.,z*2.-1.,1.); vec4 v=uInvProj*c; return v.xyz/v.w; }
void main(){
  float d=texture2D(tDepth,vUv).r;
  if(d>=.99999){ gl_FragColor=vec4(1.); return; }
  vec3 P=vp(vUv);
  vec3 N=normalize(cross(dFdx(P),dFdy(P)));
  float ang=ign(gl_FragCoord.xy)*6.2831;
  float rad=uRadius*uProjScale/max(-P.z,1e-3);
  rad=min(rad,.14);
  float occ=0.; const int K=16;
  float R2=uRadius*uRadius;
  for(int i=0;i<K;i++){
    float t=(float(i)+.5)/float(K); float a=ang+float(i)*2.39996;
    vec2 off=vec2(cos(a),sin(a))*sqrt(t)*rad;
    vec3 S=vp(vUv+off); vec3 v=S-P; float vv=dot(v,v); float vn=dot(v,N);
    float f=max(R2-vv,0.);
    occ+=f*f*f*max((vn-.012*uRadius)/(1e-4*R2+vv),0.);
  }
  float a=max(0.,1.-6.5*occ/(R2*R2*R2*float(K)));
  gl_FragColor=vec4(a,a,a,1.);
}`;

const FS_AOBLUR = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tAO,tDepth; uniform vec2 uDir; uniform float uNear,uFar;
float lz(float d){ return (2.*uNear*uFar)/(uFar+uNear-(d*2.-1.)*(uFar-uNear)); }
void main(){
  float c=lz(texture2D(tDepth,vUv).r); float s=0.,w=0.;
  for(int i=-3;i<=3;i++){
    vec2 uv=vUv+uDir*float(i);
    float z=lz(texture2D(tDepth,uv).r);
    float k=exp(-abs(z-c)/(c*.03+1e-3))*(1.-abs(float(i))/4.5);
    s+=texture2D(tAO,uv).r*k; w+=k;
  }
  float a=s/max(w,1e-3);
  gl_FragColor=vec4(a,a,a,1.);
}`;

const FS_AOAPPLY = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor,tAO; uniform float uAmt;
void main(){ vec4 c=texture2D(tColor,vUv); float a=texture2D(tAO,vUv).r; a=mix(1.,pow(a,1.4),uAmt); gl_FragColor=vec4(c.rgb*a,c.a); }`;

const FS_DOF = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor,tDepth; uniform vec2 uPx; uniform float uFocus,uAperture,uMaxCoc,uNear,uFar; ${IGN}
float lz(float d){ return (2.*uNear*uFar)/(uFar+uNear-(d*2.-1.)*(uFar-uNear)); }
float coc(float z){ return clamp(uAperture*abs(z-uFocus)/max(z,1e-3),0.,uMaxCoc); }
void main(){
  float zc=lz(texture2D(tDepth,vUv).r); float cc=coc(zc);
  vec4 sum=texture2D(tColor,vUv); float w=1.;
  float rot=ign(gl_FragCoord.xy)*6.2831;
  const int K=44;
  for(int i=1;i<=K;i++){
    float t=float(i)/float(K); float rr=sqrt(t)*uMaxCoc; float a=rot+float(i)*2.39996;
    vec2 uv=vUv+vec2(cos(a),sin(a))*rr*uPx;
    float zs=lz(texture2D(tDepth,uv).r); float sc=coc(zs);
    float sz=zs>zc?min(sc,cc*2.):sc;
    float k=smoothstep(rr-1.,rr+1.,sz);
    sum+=texture2D(tColor,uv)*k; w+=k;
  }
  gl_FragColor=sum/w;
}`;

const FS_DOFMIX = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor,tDof,tDepth; uniform float uFocus,uAperture,uMaxCoc,uNear,uFar;
float lz(float d){ return (2.*uNear*uFar)/(uFar+uNear-(d*2.-1.)*(uFar-uNear)); }
void main(){
  float z=lz(texture2D(tDepth,vUv).r);
  float c=clamp(uAperture*abs(z-uFocus)/max(z,1e-3),0.,uMaxCoc);
  gl_FragColor=mix(texture2D(tColor,vUv),texture2D(tDof,vUv),smoothstep(.6,2.2,c));
}`;

// 相机运动模糊：由深度重建世界位置，再投到上一帧相机，方向和长度都来自真实运动
const FS_MB = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor,tDepth; uniform mat4 uInvVP,uPrevVP; uniform float uAmt,uMax; ${IGN}
void main(){
  float d=texture2D(tDepth,vUv).r;
  vec4 w=uInvVP*vec4(vUv*2.-1.,d*2.-1.,1.); w/=w.w;
  vec4 q=uPrevVP*w; q/=q.w;
  vec2 vel=(vUv-(q.xy*.5+.5))*uAmt;
  float l=length(vel);
  if(l>uMax) vel*=uMax/l;
  vec4 s=vec4(0.); float jit=ign(gl_FragCoord.xy);
  const int K=14;
  for(int i=0;i<K;i++){ float t=(float(i)+jit)/float(K)-.5; s+=texture2D(tColor,vUv+vel*t); }
  gl_FragColor=s/float(K);
}`;

const FS_BLOOM_T = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform float uTh;
void main(){ vec3 c=texture2D(tColor,vUv).rgb; c=min(c,vec3(3.2)); float l=max(c.r,max(c.g,c.b));
  float k=smoothstep(uTh,uTh*1.6,l); gl_FragColor=vec4(c*k,1.); }`;
const FS_DOWN = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uPx;
void main(){ vec3 s=texture2D(tColor,vUv).rgb*4.;
 s+=texture2D(tColor,vUv-uPx).rgb; s+=texture2D(tColor,vUv+uPx).rgb;
 s+=texture2D(tColor,vUv+vec2(uPx.x,-uPx.y)).rgb; s+=texture2D(tColor,vUv-vec2(uPx.x,-uPx.y)).rgb;
 gl_FragColor=vec4(s/8.,1.); }`;
const FS_UP = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D tColor,tPrev; uniform vec2 uPx; uniform float uMix;
void main(){ vec3 s=vec3(0.);
 s+=texture2D(tColor,vUv+vec2(-uPx.x*2.,0.)).rgb; s+=texture2D(tColor,vUv+vec2(uPx.x*2.,0.)).rgb;
 s+=texture2D(tColor,vUv+vec2(0.,-uPx.y*2.)).rgb; s+=texture2D(tColor,vUv+vec2(0.,uPx.y*2.)).rgb;
 s+=texture2D(tColor,vUv+uPx).rgb*2.; s+=texture2D(tColor,vUv-uPx).rgb*2.;
 s+=texture2D(tColor,vUv+vec2(uPx.x,-uPx.y)).rgb*2.; s+=texture2D(tColor,vUv-vec2(uPx.x,-uPx.y)).rgb*2.;
 gl_FragColor=vec4(texture2D(tPrev,vUv).rgb+s/12.*uMix,1.); }`;

const FS_FINAL = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tColor,tBloom,tLens;
uniform vec2 uRes; uniform float uBloom,uExposure,uVig,uGrid,uFloodR,uLensOn,uAspect,uSat;
uniform vec3 uBgA,uBgB,uBgC,uFloodC; uniform vec2 uFlood; uniform vec3 uLens;
uniform float uTime; ${IGN}
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
vec3 srgb(vec3 c){ return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(.0031308,c)); }
vec3 tm(vec3 c){ c=aces(c*uExposure); float l=dot(c,vec3(.2126,.7152,.0722)); c=mix(vec3(l),c,uSat); return srgb(c); }
void main(){
  vec2 uv=vUv;
  vec4 c=texture2D(tColor,uv);
  vec3 bl=texture2D(tBloom,uv).rgb;
  float lensMask=0.; vec3 lensRgb=vec3(0.); float rimLight=0.;
  if(uLensOn>.5){
    vec2 p=(uv-uLens.xy)*vec2(uAspect,1.); float r=length(p)/uLens.z;
    if(r<1.){
      vec2 q=p/uLens.z;
      float rr=r*r; float z=sqrt(max(1.-rr,0.));
      // 球面透镜：中心放大，边缘按折射压缩，并带色散
      float k=1.-.34*rr;
      vec2 lc=.5+q*.5*k;
      float disp=.012+.03*rr*rr;
      vec3 l=vec3(texture2D(tLens,.5+q*.5*(k-disp)).r,texture2D(tLens,lc).g,texture2D(tLens,.5+q*.5*(k+disp)).b);
      float rim=smoothstep(.86,.985,r);
      // 外圈折射主画面（真正把后面的结构弯进来）
      vec2 ruv=uLens.xy+(p/vec2(uAspect,1.))*(1.-.72*(1.-z));
      vec3 m=texture2D(tColor,ruv).rgb;
      lensRgb=mix(l*.72,m*.9+vec3(.012,.018,.022),rim);
      lensMask=smoothstep(1.,.992,r);
      rimLight=pow(1.-z,3.)*1.1+pow(max(0.,dot(normalize(q+1e-4),vec2(-.6,.8))),10.)*pow(r,10.)*2.2;
    }
  }
  vec3 hdr=c.rgb+bl*uBloom;
  vec3 ldr=tm(hdr);
  float a=c.a;
  if(lensMask>0.){ vec3 lt=tm(lensRgb+vec3(.8,.95,1.)*rimLight*.34); ldr=mix(ldr,lt,lensMask); a=mix(a,1.,lensMask); }
  // 背景放在色调映射之后，章节配色不被改变
  vec2 pc=(uv-vec2(.5,.56))*vec2(uAspect,1.);
  float d=length(pc);
  vec3 bg=mix(uBgA,uBgB,smoothstep(.05,1.05,d));
  bg=mix(bg,uBgC,smoothstep(-.5,.9,-pc.y)*.0+smoothstep(.2,1.,pc.x+.5)*.28);
  // 淡网格：与图谱的坐标纸呼应
  if(uGrid>0.){
    vec2 g=abs(fract(gl_FragCoord.xy/(uRes.y/27.))-.5);
    float dots=smoothstep(.47,.5,max(g.x,g.y));
    float lum=dot(bg,vec3(.3,.6,.1));
    bg+=(lum>.5?-.024:.024)*dots*uGrid;
  }
  if(uFloodR>0.){
    vec2 fp=(uv-uFlood)*vec2(uAspect,1.);
    bg=mix(bg,uFloodC,smoothstep(uFloodR,uFloodR-.02,length(fp)));
  }
  vec3 col=bg*(1.-clamp(a,0.,1.))+ldr;
  float vg=smoothstep(.45,1.15,length((uv-.5)*vec2(uAspect*.9,1.2)));
  col*=1.-vg*uVig;
  float n=ign(gl_FragCoord.xy)+ign(gl_FragCoord.xy+17.3)-1.;
  col+=n/255.*1.15;
  gl_FragColor=vec4(col,1.);
}`;

export class Engine {
  constructor(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, stencil: false });
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(0x000000, 0);
    r.info.autoReset = false;
    this.r = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 5000);
    this.lensCam = new THREE.PerspectiveCamera(30, 1, 1, 5000);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.tri = new THREE.Mesh(g);
    this.tri.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.tri);

    this._buildLights();
    this._buildEnv();
    this._buildPasses();
    this.prevVP = new THREE.Matrix4();
    this.curVP = new THREE.Matrix4();
    this.invVP = new THREE.Matrix4();
    this.params = {
      exposure: 1, bloom: .55, bloomTh: 1.1, ao: 1, aoRadius: 1.6, dof: 0, focus: 100, maxCoc: 14, mb: 1,
      vig: .35, grid: .5, sat: 1.05, flood: null,
      bgA: new THREE.Color(0x10141a), bgB: new THREE.Color(0x05070a), bgC: new THREE.Color(0x05070a), lens: null,
    };
    this.W = 0; this.H = 0;
  }

  _buildLights() {
    const s = this.scene;
    const key = new THREE.DirectionalLight(0xfff1dc, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    key.shadow.bias = -0.00012;
    key.shadow.radius = 2.4;
    s.add(key, key.target);
    this.key = key;
    const rim = new THREE.DirectionalLight(0x8fc6ff, 1.5);
    s.add(rim, rim.target);
    this.rim = rim;
    const fill = new THREE.HemisphereLight(0x8aa0b8, 0x0a0806, .18);
    s.add(fill);
    this.fill = fill;
    this.lightDir = new THREE.Vector3(-.45, 1, .5).normalize();
  }

  // 自行生成环境：暗室里的几块柔光板与冷暖色条，金属和硅片反射的就是它
  _buildEnv() {
    const env = new THREE.Scene();
    const add = (w, h, x, y, z, col, I) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(I), side: THREE.DoubleSide, toneMapped: false }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); return m;
    };
    const room = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, toneMapped: false,
      vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec3 vP; void main(){ float y=vP.y; vec3 c=mix(vec3(.012,.013,.016),vec3(.075,.085,.105),smoothstep(-.2,1.,y)); c+=vec3(.14,.10,.07)*pow(max(0.,1.-abs(y+.05)),14.)*.5; gl_FragColor=vec4(c,1.); }`,
    }));
    env.add(room);
    add(22, 7, 9, 19, 15, 0xfff4e6, 3.2);
    add(34, 13, 15, 22, -27, 0xcfd9e8, .62);
    add(10, 3, 26, 14, -18, 0xffe2c4, 3.2);
    add(5, 24, -24, 7, 8, 0xdbe9ff, 2.6);
    add(5, 24, 25, 5, -6, 0xffd9b8, 2.0);
    add(16, 1.4, 5, 8, -24, 0xffffff, 7);
    add(16, 1.2, -6, 3, 25, 0x9fe0ff, 3.5);
    add(3, 14, 18, 4, 20, 0xb6f23a, .45);
    add(3, 14, -18, 3, -20, 0xff9a2e, .9);
    const pm = new THREE.PMREMGenerator(this.r);
    this.envDark = pm.fromScene(env, 0.012, .5, 90).texture;
    // 明亮版本：05 章纸面下用
    const envL = new THREE.Scene();
    const roomL = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, toneMapped: false,
      vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec3 vP; void main(){ vec3 c=mix(vec3(.55,.52,.46),vec3(1.3,1.25,1.15),smoothstep(-.6,1.,vP.y)); gl_FragColor=vec4(c,1.); }`,
    }));
    envL.add(roomL);
    const addL = (w, h, x, y, z, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, toneMapped: false })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envL.add(m); };
    addL(14, 30, -24, 6, 2, 0x14161a);
    addL(10, 28, 25, 4, 6, 0x24262c);
    addL(20, 4, 0, 26, 8, 0xffffff);
    this.envLight = pm.fromScene(envL, 0.02, .5, 90).texture;
    pm.dispose();
    this.scene.environment = this.envDark;
    this.scene.environmentIntensity = 1;
  }

  _buildPasses() {
    const u = o => { const r = {}; for (const k in o) r[k] = { value: o[k] }; return r; };
    this.mAO = pass(FS_AO, u({ tDepth: null, uInvProj: new THREE.Matrix4(), uRadius: 1, uProjScale: 1 }));
    this.mAOBlur = pass(FS_AOBLUR, u({ tAO: null, tDepth: null, uDir: new THREE.Vector2(), uNear: 1, uFar: 100 }));
    this.mAOApply = pass(FS_AOAPPLY, u({ tColor: null, tAO: null, uAmt: 1 }));
    this.mDof = pass(FS_DOF, u({ tColor: null, tDepth: null, uPx: new THREE.Vector2(), uFocus: 100, uAperture: 0, uMaxCoc: 12, uNear: 1, uFar: 100 }));
    this.mDofMix = pass(FS_DOFMIX, u({ tColor: null, tDof: null, tDepth: null, uFocus: 100, uAperture: 0, uMaxCoc: 12, uNear: 1, uFar: 100 }));
    this.mMB = pass(FS_MB, u({ tColor: null, tDepth: null, uInvVP: new THREE.Matrix4(), uPrevVP: new THREE.Matrix4(), uAmt: 1, uMax: .05 }));
    this.mBT = pass(FS_BLOOM_T, u({ tColor: null, uTh: 1 }));
    this.mDown = pass(FS_DOWN, u({ tColor: null, uPx: new THREE.Vector2() }));
    this.mUp = pass(FS_UP, u({ tColor: null, tPrev: null, uPx: new THREE.Vector2(), uMix: 1 }));
    this.mFinal = pass(FS_FINAL, u({
      tColor: null, tBloom: null, tLens: null, uRes: new THREE.Vector2(), uBloom: 1, uExposure: 1, uVig: 0, uGrid: 0, uSat: 1, uTime: 0,
      uBgA: new THREE.Color(), uBgB: new THREE.Color(), uBgC: new THREE.Color(), uFloodR: 0, uFloodC: new THREE.Color(), uFlood: new THREE.Vector2(),
      uLensOn: 0, uLens: new THREE.Vector3(), uAspect: 1,
    }));
  }

  resize(w, h, dpr = 1) {
    const W = Math.max(2, Math.round(w * dpr)), H = Math.max(2, Math.round(h * dpr));
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    this.r.setPixelRatio(1);
    this.r.setSize(W, H, false);
    this._disposeRTs();
    const color = (w2, h2, extra = {}) => new THREE.WebGLRenderTarget(w2, h2, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...extra });
    const dt = new THREE.DepthTexture(W, H, THREE.FloatType);
    dt.minFilter = dt.magFilter = THREE.NearestFilter;
    this.rtScene = color(W, H, { depthBuffer: true, samples: 4, depthTexture: dt });
    this.rtA = color(W, H); this.rtB = color(W, H);
    const hw = W >> 1, hh = H >> 1;
    this.rtAO = new THREE.WebGLRenderTarget(hw, hh, { type: THREE.UnsignedByteType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.rtAOb = this.rtAO.clone();
    this.rtDof = color(hw, hh);
    this.down = []; this.up = [];
    let cw = hw, ch = hh;
    for (let i = 0; i < 6; i++) {
      this.down.push(color(Math.max(cw, 2), Math.max(ch, 2)));
      this.up.push(color(Math.max(cw, 2), Math.max(ch, 2)));
      cw >>= 1; ch >>= 1;
    }
    const L = Math.min(1536, Math.max(512, Math.round(H * .72)));
    this.rtLens = color(L, L, { depthBuffer: true, samples: 4 });
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.mFinal.uniforms.uRes.value.set(W, H);
    this.mFinal.uniforms.uAspect.value = W / H;
  }

  _disposeRTs() {
    const all = [this.rtScene, this.rtA, this.rtB, this.rtAO, this.rtAOb, this.rtDof, this.rtLens, ...(this.down || []), ...(this.up || [])];
    for (const t of all) if (t) t.dispose();
  }

  _blit(mat, target) {
    this.tri.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.quadScene, this.quadCam);
  }

  setKeyLight(center, scale, dir) {
    const k = this.key;
    k.target.position.copy(center);
    const d = dir || this.lightDir;
    k.position.copy(center).addScaledVector(d, scale * 4);
    k.target.updateMatrixWorld();
    k.updateMatrixWorld();
    const c = k.shadow.camera;
    c.left = -scale; c.right = scale; c.top = scale; c.bottom = -scale;
    c.near = scale * .1; c.far = scale * 8;
    c.updateProjectionMatrix();
    k.shadow.normalBias = scale * .0009;
    this.rim.position.copy(center).add(new THREE.Vector3(.8, .35, -.7).multiplyScalar(scale * 3));
    this.rim.target.position.copy(center);
    this.rim.target.updateMatrixWorld();
    this.rim.updateMatrixWorld();
  }

  // prevVP 由调用方给定：导出时由纯函数求出，保证同帧同像
  render(prevVP) {
    const P = this.params, r = this.r, cam = this.camera;
    cam.updateMatrixWorld();
    this.curVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.invVP.copy(this.curVP).invert();

    r.info.reset();
    // 观察窗：同一场景的第二台相机
    if (P.lens && P.lens.render) {
      P.lens.render(this.rtLens);
    }
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(this.scene, cam);
    let col = this.rtScene.texture;
    const dep = this.rtScene.depthTexture;
    const swap = () => { const t = this.rtA; this.rtA = this.rtB; this.rtB = t; };

    if (P.ao > .001) {
      const ao = this.mAO.uniforms;
      ao.tDepth.value = dep;
      ao.uInvProj.value.copy(cam.projectionMatrixInverse);
      ao.uRadius.value = P.aoRadius;
      ao.uProjScale.value = .5 * cam.projectionMatrix.elements[5];
      this._blit(this.mAO, this.rtAO);
      const b = this.mAOBlur.uniforms;
      b.tDepth.value = dep; b.uNear.value = cam.near; b.uFar.value = cam.far;
      b.tAO.value = this.rtAO.texture; b.uDir.value.set(2 / this.W, 0);
      this._blit(this.mAOBlur, this.rtAOb);
      b.tAO.value = this.rtAOb.texture; b.uDir.value.set(0, 2 / this.H);
      this._blit(this.mAOBlur, this.rtAO);
      const a = this.mAOApply.uniforms;
      a.tColor.value = col; a.tAO.value = this.rtAO.texture; a.uAmt.value = P.ao;
      this._blit(this.mAOApply, this.rtA);
      col = this.rtA.texture; swap();
    }

    if (P.dof > .001) {
      const scaleC = this.H / 1080;
      const mc = P.maxCoc * scaleC;
      const d = this.mDof.uniforms;
      d.tColor.value = col; d.tDepth.value = dep; d.uPx.value.set(1 / this.W, 1 / this.H);
      d.uFocus.value = P.focus; d.uAperture.value = P.dof * scaleC * 40; d.uMaxCoc.value = mc; d.uNear.value = cam.near; d.uFar.value = cam.far;
      this._blit(this.mDof, this.rtDof);
      const m = this.mDofMix.uniforms;
      m.tColor.value = col; m.tDof.value = this.rtDof.texture; m.tDepth.value = dep;
      m.uFocus.value = P.focus; m.uAperture.value = d.uAperture.value; m.uMaxCoc.value = mc; m.uNear.value = cam.near; m.uFar.value = cam.far;
      this._blit(this.mDofMix, this.rtA);
      col = this.rtA.texture; swap();
    }

    if (P.mb > .001 && prevVP) {
      // 相机几乎静止时跳过，防止静止主体被无意义地软化
      let delta = 0;
      const a = prevVP.elements, b = this.curVP.elements;
      for (let i = 0; i < 16; i++) delta += Math.abs(a[i] - b[i]);
      if (delta > 1e-5) {
        const m = this.mMB.uniforms;
        m.tColor.value = col; m.tDepth.value = dep; m.uInvVP.value.copy(this.invVP); m.uPrevVP.value.copy(prevVP);
        m.uAmt.value = P.mb * .65; m.uMax.value = .04;
        this._blit(this.mMB, this.rtA);
        col = this.rtA.texture; swap();
      }
    }

    // 辉光：只提取亮部
    let bloomTex = null;
    if (P.bloom > .001) {
      const t = this.mBT.uniforms;
      t.tColor.value = col; t.uTh.value = P.bloomTh;
      this._blit(this.mBT, this.down[0]);
      for (let i = 1; i < this.down.length; i++) {
        const m = this.mDown.uniforms;
        m.tColor.value = this.down[i - 1].texture;
        m.uPx.value.set(1 / this.down[i - 1].width, 1 / this.down[i - 1].height);
        this._blit(this.mDown, this.down[i]);
      }
      let prevT = this.down[this.down.length - 1].texture;
      for (let i = this.down.length - 2; i >= 0; i--) {
        const m = this.mUp.uniforms;
        m.tColor.value = prevT; m.tPrev.value = this.down[i].texture;
        m.uPx.value.set(.5 / this.up[i].width, .5 / this.up[i].height);
        m.uMix.value = .9;
        this._blit(this.mUp, this.up[i]);
        prevT = this.up[i].texture;
      }
      bloomTex = prevT;
    }

    const f = this.mFinal.uniforms;
    f.tColor.value = col;
    f.tBloom.value = bloomTex || this.down[this.down.length - 1].texture;
    f.uBloom.value = bloomTex ? P.bloom : 0;
    f.uExposure.value = P.exposure; f.uVig.value = P.vig; f.uGrid.value = P.grid; f.uSat.value = P.sat;
    f.uBgA.value.copy(P.bgA); f.uBgB.value.copy(P.bgB); f.uBgC.value.copy(P.bgC);
    if (P.flood) {
      f.uFloodR.value = P.flood.r; f.uFlood.value.set(P.flood.x, P.flood.y); f.uFloodC.value.copy(P.flood.c);
    } else f.uFloodR.value = 0;
    if (P.lens && P.lens.on) {
      f.uLensOn.value = 1; f.uLens.value.set(P.lens.x, P.lens.y, P.lens.r); f.tLens.value = this.rtLens.texture;
    } else f.uLensOn.value = 0;
    this._blit(this.mFinal, null);
    this.prevVP.copy(this.curVP);
  }
}
