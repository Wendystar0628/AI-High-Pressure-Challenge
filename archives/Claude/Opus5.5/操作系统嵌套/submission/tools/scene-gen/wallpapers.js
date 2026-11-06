// 生成壁纸：用光线步进渲染高山湖泊风景（地形、雪线、森林、水面倒影、云和大气透视），全部自制。
const { ipcRenderer } = require('electron');

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec3 uSun; uniform vec3 uSkyTop, uSkyHor, uSunCol, uRock, uGrass, uForest, uWaterTint, uHaze; uniform float uSnowLine, uWater, uSeed, uCloud, uCamY, uTreeK, uScale; uniform vec2 uCamXZ, uLook;
out vec4 fragColor;
const mat2 m2 = mat2(0.8,-0.6,0.6,0.8);
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
vec3 noised(vec2 x){ vec2 p=floor(x), f=fract(x); vec2 u=f*f*f*(f*(f*6.-15.)+10.); vec2 du=30.*f*f*(f*(f-2.)+1.);
  float a=hash(p), b=hash(p+vec2(1,0)), c=hash(p+vec2(0,1)), d=hash(p+vec2(1,1));
  return vec3(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y, du*(vec2(b-a,c-a)+(a-b-c+d)*u.yx)); }
float fbm(vec2 p){ float s=0.,a=.5; for(int i=0;i<6;i++){ s+=a*noised(p).x; p=m2*p*2.02+vec2(3.1,1.7); a*=.5; } return s; }
float terr(vec2 q,int oct){ vec2 p=q*0.00062*uScale+uSeed; float a=0.,b=1.; vec2 d=vec2(0.);
  for(int i=0;i<oct;i++){ vec3 n=noised(p); d+=n.yz; a+=b*n.x/(1.+dot(d,d)); b*=.5; p=m2*p*2.03; }
  // 中间是湖盆，远处升起成群山
  float r=length((q-vec2(0.,1600.))*vec2(1.0,0.62))/3000.;
  float basin=smoothstep(0.40,1.08,r);
  return (a-0.2)*1500.*basin*basin + basin*basin*220. + (1.-basin)*(a-0.5)*34. - 26.*(1.-basin); }
vec3 terrN(vec3 p,float t){ float e=max(0.8,t*0.0016); return normalize(vec3(terr(p.xz-vec2(e,0),14)-terr(p.xz+vec2(e,0),14),2.*e,terr(p.xz-vec2(0,e),14)-terr(p.xz+vec2(0,e),14))); }
float castRay(vec3 ro,vec3 rd,float tmax){ float t=2.; for(int i=0;i<520;i++){ vec3 p=ro+rd*t; float h=p.y-terr(p.xz,8); if(h<0.0012*t||t>tmax) break; t+=h*0.3; } return t; }
float softShadow(vec3 ro,vec3 rd){ float res=1.,t=4.; for(int i=0;i<64;i++){ vec3 p=ro+rd*t; float h=p.y-terr(p.xz,6); res=min(res,10.*h/t); t+=clamp(h*0.6,3.,180.); if(res<0.003||t>6000.) break; } return clamp(res,0.,1.); }
vec3 skyColor(vec3 rd,vec3 ro){ float y=max(rd.y,0.); vec3 c=mix(uSkyHor,uSkyTop,pow(y,0.5)); float sd=max(dot(rd,uSun),0.);
  c+=uSunCol*pow(sd,5.)*0.28; c+=uSunCol*pow(sd,48.)*0.6; c+=vec3(1.,.96,.86)*pow(sd,1200.)*8.;
  if(rd.y>0.001){ // 两层云
    vec2 uv=rd.xz/(rd.y+0.06); float f=fbm(uv*0.72+vec2(1.3,5.2)); float cov=smoothstep(1.0-uCloud*0.82,1.0-uCloud*0.2,f+0.02);
    float l=fbm((uv+uSun.xz*0.28)*0.72+vec2(1.3,5.2)); float lit=clamp((f-l)*3.2+0.55,0.,1.);
    vec3 cc=mix(uSkyHor*0.72+vec3(.05,.05,.1),uSunCol*1.15+vec3(.18),lit);
    c=mix(c,cc,cov*smoothstep(0.0,0.11,rd.y)*0.92);
    float f2=fbm(uv*2.6+vec2(9.1,2.2)); c=mix(c,uSunCol*.9+vec3(.2),smoothstep(0.62,0.92,f2)*0.2*smoothstep(0.02,0.22,rd.y));
  }
  return c; }
vec3 shade(vec3 p,vec3 n,vec3 rd,float t){ float slope=n.y; float h=p.y;
  float n1=fbm(p.xz*0.012+uSeed), n2=fbm(p.xz*0.09);
  vec3 alb=mix(uRock*0.75,uRock*1.25,n2);
  // 草地与森林
  float grassK=smoothstep(0.72,0.9,slope)*(1.-smoothstep(uSnowLine*0.42,uSnowLine*0.7,h+n1*160.-40.));
  vec3 gr=mix(uGrass,uGrass*0.7+vec3(.05,.03,0.),n2);
  alb=mix(alb,gr,grassK);
  float forest=smoothstep(0.76,0.92,slope+n1*0.08)*(1.-smoothstep(uSnowLine*0.32,uSnowLine*0.56,h+n1*260.-90.))*smoothstep(uWater+5.,uWater+24.,h)*uTreeK;
  float tree=noised(p.xz*0.42).x*0.55+noised(p.xz*1.3).x*0.45;
  float fm=smoothstep(0.3,0.5,forest*(0.55+n1*0.9));
  alb=mix(alb,uForest*(0.55+tree*0.95),fm);
  // 雪
  float sn=smoothstep(uSnowLine-140.,uSnowLine+120.,h+n1*260.+(slope-0.7)*340.)*smoothstep(0.42,0.68,slope+n2*0.1);
  alb=mix(alb,vec3(0.86,0.89,0.96),sn);
  // 岸线的沙石
  alb=mix(vec3(0.33,0.30,0.25),alb,smoothstep(uWater+0.3,uWater+7.,h+n2*4.));
  float sh=softShadow(p+n*2.,uSun);
  float dif=max(dot(n,uSun),0.);
  vec3 lin=uSunCol*2.5*dif*sh;
  lin+=uSkyTop*0.95*(0.5+0.5*n.y);
  lin+=uSkyHor*0.3*max(dot(n,normalize(vec3(-uSun.x,0.2,-uSun.z))),0.);
  vec3 col=alb*lin;
  // 大气透视
  float fog=1.-exp(-pow(t*0.000052,1.35));
  vec3 fc=mix(uHaze,uSunCol*1.1+uHaze*.3,pow(max(dot(rd,uSun),0.),6.));
  col=mix(col,fc,fog);
  return col; }
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  vec3 ro=vec3(uCamXZ.x,0.,uCamXZ.y); ro.y=max(uCamY,terr(ro.xz,6)+22.);
  vec3 ta=vec3(uLook.x,ro.y+420.,uLook.y);
  vec3 ww=normalize(ta-ro), uu=normalize(cross(ww,vec3(0,1,0))), vv=cross(uu,ww);
  vec3 rd=normalize(uv.x*uu+uv.y*vv+1.55*ww);
  vec3 col;
  float tmax=26000.;
  float t=castRay(ro,rd,tmax);
  float tw=rd.y<0.?(uWater-ro.y)/rd.y:1e9;
  if(tw<t&&tw>0.){
    // 水面：倒影加细碎波纹
    vec3 p=ro+rd*tw;
    vec2 w=p.xz; float e=0.6;
    float nA=fbm(w*0.045+uSeed)+fbm(w*0.21)*0.4, nB=fbm((w+vec2(e,0))*0.045+uSeed)+fbm((w+vec2(e,0))*0.21)*0.4, nC=fbm((w+vec2(0,e))*0.045+uSeed)+fbm((w+vec2(0,e))*0.21)*0.4;
    vec3 n=normalize(vec3((nA-nB)*0.20,1.,(nA-nC)*0.20));
    vec3 rf=reflect(rd,n); rf.y=abs(rf.y);
    float tr=castRay(p+vec3(0,0.6,0),rf,14000.);
    vec3 rc;
    if(tr<14000.){ vec3 q=p+rf*tr; rc=shade(q,terrN(q,tr+tw),rf,tr+tw*0.3); } else rc=skyColor(rf,p);
    float fres=0.06+0.94*pow(1.-max(dot(-rd,n),0.),4.2);
    float dep=clamp((uWater-terr(p.xz,5))*0.03,0.,1.);
    vec3 deep=mix(uWaterTint*1.5+vec3(.06,.05,.03),uWaterTint*0.45,dep);
    col=mix(deep,rc,clamp(fres*1.25+0.36,0.,1.));
    float sg=pow(max(dot(rf,uSun),0.),620.); col+=uSunCol*sg*5.;
    float fog=1.-exp(-pow(tw*0.000052,1.35)); col=mix(col,uHaze,fog);
  } else if(t<tmax){
    vec3 p=ro+rd*t;
    col=shade(p,terrN(p,t),rd,t);
  } else col=skyColor(rd,ro);
  // 贴水的薄雾
  float mistK=exp(-max(ro.y+rd.y*min(t,tw)-uWater,0.)*0.012)*(1.-exp(-min(t,tw)*0.00035));
  col=mix(col,uSkyHor*0.9+uSunCol*.05,clamp(mistK*0.28,0.,1.));
  // 胶片式映射
  col=col*0.74; col=(col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14); col=pow(clamp(col,0.,1.),vec3(0.4545));
  vec2 q=gl_FragCoord.xy/uRes; col*=0.62+0.38*pow(16.*q.x*q.y*(1.-q.x)*(1.-q.y),0.22);
  col=mix(col,col*col*(3.-2.*col),0.34); { float L=dot(col,vec3(0.3,0.59,0.11)); col=mix(vec3(L),col,1.22); }
  col+=(hash(gl_FragCoord.xy*0.73+uSeed)-0.5)*0.012;
  fragColor=vec4(col,1.);
}`;

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`;

const PRESETS = {
  root: { w: 3840, h: 2160, sun: [-0.72, 0.2, -0.42], skyTop: [0.13, 0.30, 0.68], skyHor: [0.95, 0.72, 0.62], sunCol: [1.5, 0.95, 0.58], rock: [0.34, 0.30, 0.27], grass: [0.30, 0.34, 0.12], forest: [0.045, 0.085, 0.055], water: [0.05, 0.14, 0.2], haze: [0.86, 0.68, 0.58], snow: 720, level: 0, seed: 3.7, cloud: 0.5, camY: 34, tree: 1.0, scale: 1.0, cam: [0, -500], look: [260, 3400] },
  l2: { w: 1920, h: 1080, sun: [0.7, 0.07, 0.7], skyTop: [0.16, 0.12, 0.42], skyHor: [0.92, 0.42, 0.56], sunCol: [1.2, 0.5, 0.48], rock: [0.32, 0.22, 0.34], grass: [0.26, 0.17, 0.3], forest: [0.08, 0.05, 0.14], water: [0.1, 0.06, 0.2], haze: [0.72, 0.42, 0.62], snow: 900, level: 0, seed: 11.3, cloud: 0.5, camY: 60, tree: 0.7, scale: 1.1, cam: [-200, -500], look: [0, 3400] },
  l3: { w: 1920, h: 1080, sun: [-0.5, 0.26, 0.82], skyTop: [0.10, 0.34, 0.46], skyHor: [0.66, 0.86, 0.80], sunCol: [1.05, 0.95, 0.78], rock: [0.24, 0.30, 0.30], grass: [0.13, 0.30, 0.22], forest: [0.03, 0.10, 0.09], water: [0.03, 0.2, 0.22], haze: [0.62, 0.82, 0.80], snow: 620, level: 0, seed: 21.9, cloud: 0.45, camY: 40, tree: 1.0, scale: 1.25, cam: [120, -500], look: [-100, 3400] },
  l4: { w: 1920, h: 1080, sun: [0.62, 0.1, 0.78], skyTop: [0.26, 0.20, 0.36], skyHor: [1.0, 0.56, 0.36], sunCol: [1.3, 0.6, 0.34], rock: [0.40, 0.22, 0.17], grass: [0.34, 0.20, 0.10], forest: [0.10, 0.06, 0.05], water: [0.14, 0.07, 0.08], haze: [0.9, 0.5, 0.38], snow: 1050, level: 0, seed: 31.5, cloud: 0.55, camY: 70, tree: 0.5, scale: 0.9, cam: [0, -500], look: [220, 3400] },
  l5: { w: 1920, h: 1080, sun: [-0.3, 0.24, 0.9], skyTop: [0.05, 0.10, 0.28], skyHor: [0.42, 0.56, 0.80], sunCol: [0.85, 0.9, 1.1], rock: [0.20, 0.24, 0.34], grass: [0.16, 0.22, 0.30], forest: [0.03, 0.06, 0.12], water: [0.03, 0.08, 0.2], haze: [0.42, 0.54, 0.76], snow: 360, level: 0, seed: 43.1, cloud: 0.5, camY: 50, tree: 0.8, scale: 1.1, cam: [-100, -500], look: [120, 3400] },
};

async function renderPreset(name, P) {
  const SS = name === 'root' ? 1.5 : 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(P.w * SS); canvas.height = Math.round(P.h * SS);
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.bindAttribLocation(prog, 0, 'p');
  gl.vertexAttribPointer(gl.getAttribLocation(prog, 'p'), 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  gl.uniform2f(U('uRes'), canvas.width, canvas.height);
  const sl = Math.hypot(...P.sun);
  gl.uniform3f(U('uSun'), P.sun[0] / sl, P.sun[1] / sl, P.sun[2] / sl);
  for (const [u, k] of [['uSkyTop', 'skyTop'], ['uSkyHor', 'skyHor'], ['uSunCol', 'sunCol'], ['uRock', 'rock'], ['uGrass', 'grass'], ['uForest', 'forest'], ['uWaterTint', 'water'], ['uHaze', 'haze']]) gl.uniform3f(U(u), ...P[k]);
  gl.uniform1f(U('uSnowLine'), P.snow); gl.uniform1f(U('uWater'), P.level); gl.uniform1f(U('uSeed'), P.seed); gl.uniform1f(U('uCloud'), P.cloud); gl.uniform1f(U('uCamY'), P.camY); gl.uniform1f(U('uTreeK'), P.tree); gl.uniform1f(U('uScale'), P.scale);
  gl.uniform2f(U('uCamXZ'), P.cam[0], P.cam[1]); gl.uniform2f(U('uLook'), P.look[0], P.look[1]);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.SCISSOR_TEST);
  // 分块绘制，避免单次绘制时间过长
  const strips = 48, tiles = 16;
  for (let j = 0; j < strips; j++) {
    for (let i = 0; i < tiles; i++) {
      gl.scissor(Math.floor(i * canvas.width / tiles), Math.floor(j * canvas.height / strips), Math.ceil(canvas.width / tiles), Math.ceil(canvas.height / strips));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.flush();
    }
    gl.finish();
    await new Promise((r) => setTimeout(r, 4));
  }
  const out = document.createElement('canvas');
  out.width = P.w; out.height = P.h;
  const g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(canvas, 0, 0, P.w, P.h);
  await ipcRenderer.invoke('write', `assets/wallpapers/${name}.jpg`, out.toDataURL('image/jpeg', name === 'root' ? 0.9 : 0.84), 'dataurl');
  gl.getExtension('WEBGL_lose_context').loseContext();
}

async function main() {
  const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
  for (const [name, P] of Object.entries(PRESETS)) {
    if (only && only !== name) continue;
    await ipcRenderer.invoke('log', '渲染 ' + name);
    await renderPreset(name, P);
  }
  await ipcRenderer.invoke('done');
}
main().catch((e) => { ipcRenderer.invoke('log', 'ERR ' + e.message); ipcRenderer.invoke('done'); });
