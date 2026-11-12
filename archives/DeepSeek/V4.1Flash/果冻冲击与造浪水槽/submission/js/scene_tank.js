/* scene_tank.js — wave tank scene: FLIP fluid, surface nets, glass, balls, foam */
(function () {
  'use strict';

  const TANK = { x0: -1.5, x1: 1.5, y0: 0, y1: 1.3, z0: -0.55, z1: 0.55, level: 0.78 };
  const BALL_R = 0.057;

  function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

  const VS_WATER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in float aFoam;
uniform mat4 uViewProj;
out vec3 vWorld;
out vec3 vNormal;
out float vFoam;
void main(){
  vWorld = aPos;
  vNormal = aNormal;
  vFoam = aFoam;
  gl_Position = uViewProj * vec4(aPos, 1.0);
}`;

  const FS_WATER = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
const float PI = 3.14159265359;
uniform vec3 uSunDir, uSunColor, uRimDir, uRimColor, uCamPos;
uniform sampler2D uSceneTex;
uniform sampler2D uEnv;
uniform vec2 uRes;
uniform float uTime;
in vec3 vWorld; in vec3 vNormal; in float vFoam;
out vec4 oColor;

vec3 envMap(vec3 d, float lod){
  float u = atan(d.z, d.x) / (2.0 * PI) + 0.5;
  float v = acos(clamp(d.y, -1.0, 1.0)) / PI;
  return textureLod(uEnv, vec2(u, v), lod).rgb;
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 off = vec2(N.x, -N.y) * 0.035 / (1.0 + 1.4 * abs(N.z));
  vec3 bg = texture(uSceneTex, clamp(uv + off, vec2(0.003), vec2(0.997))).rgb;
  vec3 shallow = vec3(0.10, 0.52, 0.58);
  vec3 deep = vec3(0.012, 0.16, 0.24);
  float depthT = smoothstep(0.0, 0.75, 0.78 - vWorld.y);
  vec3 tint = mix(shallow, deep, depthT);
  vec3 col = mix(bg * mix(vec3(0.48,0.78,0.82), vec3(0.72,0.92,0.94), 1.0-depthT), tint, 0.38);
  col += tint * 0.22;
  // reflection
  vec3 R = reflect(-V, N);
  vec3 env = envMap(R, 1.4).rgb;
  col += env * fres * 1.1;
  // sun glints
  vec3 H = normalize(V + uSunDir);
  float spec = pow(max(dot(N, H), 0.0), 320.0);
  col += uSunColor * spec * 3.2;
  vec3 H2 = normalize(V + uRimDir);
  col += uRimColor * pow(max(dot(N,H2),0.0), 60.0) * 0.8;
  // foam
  float fn = noise(vWorld.xz * 38.0 + vec2(uTime*0.3, -uTime*0.2));
  float fn2 = noise(vWorld.xz * 13.0 - vec2(uTime*0.15, uTime*0.22));
  float foam = clamp(vFoam * (0.45 + 0.65 * fn) + smoothstep(0.35,0.75,vFoam) * fn2 * 0.5, 0.0, 1.0);
  vec3 foamCol = vec3(0.86, 0.95, 0.97);
  col = mix(col, foamCol, foam * 0.9);
  col += foam * 0.12;
  float alpha = clamp(0.48 + fres * 0.24 + foam * 0.30, 0.32, 0.94);
  oColor = vec4(col, alpha);
}`;

  const VS_GLASS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat3 uNormalMat;
out vec3 vWorld;
out vec3 vNormal;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(uNormalMat * aNormal);
  gl_Position = uViewProj * wp;
}`;

  const FS_GLASS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
const float PI = 3.14159265359;
uniform vec3 uSunDir, uSunColor, uRimDir, uRimColor, uCamPos;
uniform sampler2D uEnv;
uniform sampler2D uSceneTex;
uniform vec2 uRes;
in vec3 vWorld; in vec3 vNormal;
out vec4 oColor;
vec3 envMap(vec3 d, float lod){
  float u = atan(d.z, d.x) / (2.0 * PI) + 0.5;
  float v = acos(clamp(d.y, -1.0, 1.0)) / PI;
  return textureLod(uEnv, vec2(u, v), lod).rgb;
}
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  float f = abs(dot(N, V));
  float fres = pow(1.0 - f, 4.0);
  vec3 R = reflect(-V, N);
  vec3 env = envMap(R, 1.0).rgb;
  vec3 col = env * (0.10 + fres * 0.9);
  col += uRimColor * pow(1.0 - f, 2.0) * 0.25;
  // softbox streak reflection on the front pane
  float streak = smoothstep(0.10, 0.0, abs(vWorld.x * 0.8 + vWorld.y * 0.5 - 0.9)) * smoothstep(0.2, 0.9, vWorld.y);
  col += vec3(0.65,0.8,0.85) * streak * 0.10;
  float alpha = 0.035 + fres * 0.24 + streak * 0.035;
  oColor = vec4(col, alpha);
}`;

  const VS_BALL = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat3 uRot;
out vec3 vWorld; out vec3 vNormal; out vec3 vBody;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorld = wp.xyz; vNormal = normalize(uRot * aNormal); vBody = normalize(transpose(uRot) * aNormal);
  gl_Position = uViewProj * wp;
}`;

  const FS_BALL = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
const float PI = 3.14159265359;
uniform vec3 uSunDir, uSunColor, uRimDir, uRimColor, uCamPos;
uniform sampler2D uEnv;
uniform sampler2DShadow uShadow;
uniform mat4 uLightVP;
uniform vec3 uColor;
in vec3 vWorld; in vec3 vNormal; in vec3 vBody;
out vec4 oColor;
vec3 envMap(vec3 d, float lod){
  float u = atan(d.z, d.x) / (2.0 * PI) + 0.5;
  float v = acos(clamp(d.y, -1.0, 1.0)) / PI;
  return textureLod(uEnv, vec2(u, v), lod).rgb;
}
float shadowCalc(vec3 wp, vec3 N){
  vec4 lp = uLightVP * vec4(wp + N*0.02, 1.0);
  vec3 p = lp.xyz/lp.w * 0.5 + 0.5;
  if (p.x<0.002||p.x>0.998||p.y<0.002||p.y>0.998||p.z>1.0) return 1.0;
  vec2 tx = 1.0/vec2(textureSize(uShadow,0));
  float s=0.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) s += texture(uShadow, vec3(p.xy+vec2(x,y)*tx, p.z-0.002));
  return s/9.0;
}
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  float sh = shadowCalc(vWorld, N);
  float ndl = max(dot(N, uSunDir), 0.0);
  vec3 base = uColor;
  vec3 col = base * (0.06 + 0.08*N.y);
  vec3 H = normalize(V + uSunDir);
  col += base * uSunColor * ndl * 0.3 / PI * (0.4+0.6*sh);
  col += uSunColor * pow(max(dot(N,H),0.0), 260.0) * 1.6 * sh;
  vec3 R = reflect(-V, N);
  float fres = 0.06 + 0.94*pow(1.0-max(dot(N,V),0.0),5.0);
  col += envMap(R, 1.1).rgb * (0.35 + 0.65*fres) * 0.85;
  // engraved latitude line
  float band = smoothstep(0.012, 0.002, abs(abs(vBody.y)-0.62));
  col = mix(col, col*0.2 + base*0.1, band*0.55);
  col += uRimColor * pow(max(dot(N,normalize(uRimDir)),0.0), 8.0) * fres * 0.35;
  oColor = vec4(col, 1.0);
}`;

  const VS_SIDE = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat3 uNormalMat;
out vec3 vWorld;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorld = wp.xyz;
  gl_Position = uViewProj * wp;
}`;

  const FS_SIDE = `#version 300 es
precision highp float;
uniform vec3 uCamPos;
uniform float uTime;
in vec3 vWorld;
out vec4 oColor;
void main(){
  float d = clamp(vWorld.y / 0.8, 0.0, 1.0);
  vec3 col = mix(vec3(0.012,0.22,0.27), vec3(0.16,0.52,0.56), d);
  float edge = smoothstep(0.76, 0.80, vWorld.y);
  col = mix(col, vec3(0.55,0.75,0.78), edge * 0.5);
  float a = 0.16 + 0.08 * d + edge * 0.12;
  oColor = vec4(col, a);
}`;

  const VS_FOAM = `#version 300 es
precision highp float;
layout(location=0) in vec3 aCenter;
layout(location=1) in float aSize;
layout(location=2) in float aAlpha;
layout(location=3) in float aType;
uniform mat4 uViewProj;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
out vec2 vUV; out float vAlpha; out float vType;
void main(){
  float id = float(gl_VertexID & 3);
  vec2 c = vec2((id==1.0||id==3.0)?1.0:-1.0, (id>=2.0)?1.0:-1.0);
  vUV = c; vAlpha = aAlpha; vType = aType;
  vec3 p = aCenter + (uCamRight * c.x + uCamUp * c.y) * aSize;
  gl_Position = uViewProj * vec4(p, 1.0);
}`;

  const FS_FOAM = `#version 300 es
precision highp float;
in vec2 vUV; in float vAlpha; in float vType;
out vec4 oColor;
void main(){
  float r = length(vUV);
  float a = 0.0;
  if (vType < 0.5) {
    a = smoothstep(1.0, 0.15, r) * 0.5;
    a *= 0.55 + 0.45 * smoothstep(0.25, 0.8, fract(sin(dot(vUV, vec2(12.9898,78.233)))*43758.5));
  } else {
    a = smoothstep(1.0, 0.0, r);
    a = pow(a, 1.8);
  }
  vec3 col = mix(vec3(0.62,0.80,0.84), vec3(0.95,0.99,1.0), vType);
  oColor = vec4(col, a * vAlpha);
}`;

  function makeTerrainMesh(gl) {
    const nx = 90, nz = 34;
    const pos = [], nor = [], uv = [], idx = [];
    const H = (x, z) => {
      const t = clamp((x - 0.10) / 1.05, 0, 1);
      const shelf = 0.30 * (t*t*(3-2*t));
      const dx = (x - 0.52) / 0.34, dz = (z + 0.06) / 0.40;
      return shelf + 0.13 * Math.exp(-(dx*dx + dz*dz));
    };
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = TANK.x0 + (i/nx) * (TANK.x1-TANK.x0);
      const z = TANK.z0 + (j/nz) * (TANK.z1-TANK.z0);
      const h = H(x, z);
      const eps = 0.01;
      const hx = (H(x+eps,z)-H(x-eps,z))/(2*eps), hz = (H(x,z+eps)-H(x,z-eps))/(2*eps);
      const l = Math.hypot(hx, 1, hz);
      pos.push(x, h, z); nor.push(-hx/l, 1/l, -hz/l);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j*(nx+1)+i;
      idx.push(a, a+1, a+nx+1, a+1, a+nx+2, a+nx+1);
    }
    return GLU.createMesh(gl, { pos: new Float32Array(pos), normal: new Float32Array(nor), indices: new Uint32Array(idx) });
  }

  function makeTorus(gl, R, r, seg, tube) {
    const pos = [], nor = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const u = i/seg*Math.PI*2;
      for (let j = 0; j <= tube; j++) {
        const v = j/tube*Math.PI*2;
        const cx = Math.cos(u)*R, cz = Math.sin(u)*R;
        const nx = Math.cos(v)*Math.cos(u), nz = Math.cos(v)*Math.sin(u), ny = Math.sin(v);
        pos.push(cx+nx*r, ny*r, cz+nz*r); nor.push(nx,ny,nz);
      }
    }
    for (let i=0;i<seg;i++) for (let j=0;j<tube;j++) {
      const a=i*(tube+1)+j, b=a+tube+1;
      idx.push(a,b,a+1,a+1,b,b+1);
    }
    return GLU.createMesh(gl, { pos: new Float32Array(pos), normal: new Float32Array(nor), indices: new Uint32Array(idx) });
  }

  const qMul = (a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  const qNorm = (q)=>{const l=Math.hypot(q[0],q[1],q[2],q[3])||1;return [q[0]/l,q[1]/l,q[2]/l,q[3]/l];};
  const qMat = (q)=>{const [x,y,z,w]=q;return new Float32Array([1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y)]);};

  class SceneTank {
    constructor(renderer) {
      this.renderer = renderer;
      this.gl = renderer.gl;
      this.ready = false;
      this.error = null;
      this.demoTime = 0;
      this.densities = [0.32, 0.86, 1.0, 2.3];
      this.params = { amplitude: 0.55, frequency: 0.9 };
      this.waveOn = false;
      this.phase = 0;
      this.ampTarget = 0.0;
      this.ampCur = 0.0;
      this.paddleFace = -1.43;
      this.paddleVel = 0;
      this.balls = [];
      this.ballMeshes = null;
      this.foam = [];
      this.sprays = [];
      this.fluid = null;
      this._acc = 0;
      this._busy = false;
      this._latest = null;
      this.surface = null;
      this.waterMesh = null;
      this.readyPromise = null;
      this.released = false;
      this.time = 0;
      this.audio = null;
      this.waveGuide = false;
      this.foamSpawnAcc = 0;
      this.randSeed = 987654321;
      this.initGeometry();
      this.initShaders();
      this.initBalls();
      this.reset();
    }

    rand() {
      this.randSeed = (this.randSeed * 1664525 + 1013904223) >>> 0;
      return this.randSeed / 4294967296;
    }

    terrainH(x, z) {
      const t = clamp((x - 0.10) / 1.05, 0, 1);
      const shelf = 0.30 * (t*t*(3-2*t));
      const dx = (x - 0.52) / 0.34, dz = (z + 0.06) / 0.40;
      return shelf + 0.13 * Math.exp(-(dx*dx + dz*dz));
    }

    async warmup() {
      if (!this.ready || !this.fluid) return;
      for (let i = 0; i < 3; i++) await this.fluidStep(1/60);
      this._acc = 0;
    }

    initShaders() {
      const gl = this.gl;
      this.progWater = new GLU.Program(gl, VS_WATER, FS_WATER, 'water');
      this.progGlass = new GLU.Program(gl, VS_GLASS, FS_GLASS, 'glass');
      this.progBall = new GLU.Program(gl, VS_BALL, FS_BALL, 'tankball');
      this.progFoam = new GLU.Program(gl, VS_FOAM, FS_FOAM, 'foam');
      this.progSide = new GLU.Program(gl, VS_SIDE, FS_SIDE, 'waterside');
    }

    initGeometry() {
      const gl = this.gl;
      this.floorMesh = GLU.makePlane(gl, 40, 40, 1);
      this.paneMesh = GLU.makePlane(gl, 1, 1, 1);
      this.sphere = GLU.makeSphere(gl, 32, 20);
      this.boxMesh = GLU.makeSilkBox(gl, 1, 1, 1);
      this.terrainMesh = makeTerrainMesh(gl);
      this.wheel = makeTorus(gl, 0.18, 0.012, 48, 8);
      this.wheelSpoke = GLU.makeSilkBox(gl, 1, 1, 1);
      this.foamQuad = gl.createVertexArray();
      this.foamBuf = gl.createBuffer();
      gl.bindVertexArray(this.foamQuad);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.foamBuf);
      gl.bufferData(gl.ARRAY_BUFFER, 1400 * 24, gl.DYNAMIC_DRAW);
      for (let i = 0; i < 4; i++) {
        const loc = i;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, i === 0 ? 3 : 1, gl.FLOAT, false, 24, i === 0 ? 0 : 12 + (i-1)*4);
      }
      gl.bindVertexArray(null);
      this.paneModels = [
        M4.mul(M4.translation(0, 0.65, 0.556), M4.scaling(3.0, 1.3, 0.014)),
        M4.mul(M4.translation(0, 0.65, -0.556), M4.scaling(3.0, 1.3, 0.014)),
        M4.mul(M4.translation(-1.506, 0.65, 0), M4.scaling(0.014, 1.3, 1.1)),
        M4.mul(M4.translation(1.506, 0.65, 0), M4.scaling(0.014, 1.3, 1.1))
      ];
    }

    async init() {
      this.readyPromise = (async () => {
        try {
          this.fluid = new FluidGPU();
          await this.fluid.init();
          this.fluid.gravity = 9.81;
          this.fluid.iterations = 30;
          this.fluid.flip = 0.7;
          this.ready = true;
          this.buildWaterMesh();
          console.log('Tank ready');
        } catch (e) {
          this.error = e.message;
          console.error('Tank init failed', e);
        }
      })();
      return this.readyPromise;
    }

    async waitReady() { if (this.readyPromise) await this.readyPromise; }

    initBalls() {
      const tint = [[1.0,0.72,0.28],[0.32,0.85,0.58],[0.30,0.70,0.95],[0.95,0.30,0.36]];
      this.balls = [];
      const xs = [-0.95, -0.32, 0.32, 0.95];
      const zs = [-0.28, 0.0, 0.28];
      let idx = 0;
      for (let zi = 0; zi < 3; zi++) for (let xi = 0; xi < 4; xi++) {
        const g = (xi + zi) % 4;
        this.balls.push({
          home: [xs[xi], 1.44, zs[zi]], pos: [xs[xi], 1.44, zs[zi]], vel: [0,0,0],
          r: BALL_R, rho: this.densities[g], group: g, color: tint[g],
          quat: [0,0,0,1], spin: [0,0,0], inWater: false, prevVy: 0, released: false, splashDone: false
        });
        idx++;
      }
    }

    reset() {
      this.released = false;
      this.waveOn = false;
      this.ampTarget = 0; this.ampCur = 0;
      this.paddleFace = -1.43; this.paddleVel = 0;
      this.phase = 0;
      this.time = 0;
      this._acc = 0; this._busy = false; this._latest = null;
      this.foam.length = 0; this.sprays.length = 0;
      this.randSeed = 987654321;
      this.foamSpawnAcc = 0;
      this.initBalls();
      if (this.fluid && this.fluid.ready) {
        this.fluid.reset();
        this.fluid.iterations = 30;
        this.fluid.flip = 0.7;
      }
      this.buildWaterMesh();
    }

    setAudio(a) { this.audio = a; }
    setParams(p) {
      if (p.amplitude !== undefined) { this.params.amplitude = p.amplitude; if (this.waveOn) this.ampTarget = 0.22 + p.amplitude * 0.82; }
      if (p.frequency !== undefined) this.params.frequency = p.frequency;
      if (p.densities) {
        this.densities = p.densities.slice();
        for (const b of this.balls) b.rho = this.densities[b.group];
      }
    }
    releaseBalls() {
      this.released = true;
      for (const b of this.balls) {
        if (b.released) continue;
        b.released = true;
        b.vel = [(this.rand()-0.5)*0.12, -0.05, (this.rand()-0.5)*0.12];
      }
      if (this.audio) this.audio.play('whoosh', 0.4);
    }
    startWave() {
      this.waveOn = true;
      this.ampTarget = 0.22 + this.params.amplitude * 0.82;
      this.ampCur = Math.max(this.ampCur, 0.06);
      if (this.audio) this.audio.setWave(true, 0.4);
    }
    stopWave() { this.waveOn = false; this.ampTarget = 0; if (this.audio) this.audio.setWave(false, 0); }
    setAmpTarget(v) { this.ampTarget = v; }
    setWaveGuide(v) { this.waveGuide = v; }

    ballWorld(b, dt) {
      if (!b.released) { b.pos = b.home.slice(); return; }
      b.vel[1] -= 9.81 * dt;
      const wl = this.waterHeightAt(b.pos[0], b.pos[2]);
      const depth = clamp(wl - (b.pos[1] - b.r), 0, 2*b.r);
      const sub = (3*b.r*depth*depth - depth*depth*depth) / (4*b.r*b.r*b.r);
      const rhoW = 1.0;
      const buoy = rhoW / b.rho;
      let dragK = 0;
      if (sub > 0) {
        b.vel[1] += 9.81 * (buoy * sub - sub * 0.0) * dt * 0.92;
        // buoyancy relative to displaced water minus own weight is handled by subtracting gravity once; add lift
        b.vel[1] -= 9.81 * (1 - buoy * sub) * 0.0 * dt;
        dragK = 2.2 + 6.0 * sub;
        const vf = this.fluidVelAt(b.pos);
        b.vel[0] += (vf[0] - b.vel[0]) * dragK * dt;
        b.vel[1] += (vf[1] - b.vel[1]) * dragK * 0.55 * dt;
        b.vel[2] += (vf[2] - b.vel[2]) * dragK * dt;
      }
      b.pos[0] += b.vel[0]*dt; b.pos[1] += b.vel[1]*dt; b.pos[2] += b.vel[2]*dt;
      // tank walls
      if (b.pos[0] < -1.47 + b.r) { b.pos[0] = -1.47 + b.r; b.vel[0] = Math.abs(b.vel[0]) * 0.4; }
      if (b.pos[0] > 1.47 - b.r) { b.pos[0] = 1.47 - b.r; b.vel[0] = -Math.abs(b.vel[0]) * 0.4; }
      if (b.pos[2] < -0.52 + b.r) { b.pos[2] = -0.52 + b.r; b.vel[2] = Math.abs(b.vel[2]) * 0.4; }
      if (b.pos[2] > 0.52 - b.r) { b.pos[2] = 0.52 - b.r; b.vel[2] = -Math.abs(b.vel[2]) * 0.4; }
      const gy = Math.max(0, this.terrainH(b.pos[0], b.pos[2]));
      if (b.pos[1] < gy + b.r) {
        b.pos[1] = gy + b.r;
        if (b.vel[1] < 0) b.vel[1] = -b.vel[1] * 0.28;
        b.vel[0] *= 0.96; b.vel[2] *= 0.96;
        b.spin[0] *= 0.9; b.spin[1] *= 0.9; b.spin[2] *= 0.9;
      }
      if (b.pos[1] > 1.55) { b.pos[1] = 1.55; if (b.vel[1] > 0) b.vel[1] = 0; }
      // paddle plate
      if (b.pos[1] < 0.72 && b.pos[0] - b.r < this.paddleFace && b.vel[0] < this.paddleVel) {
        b.pos[0] = this.paddleFace + b.r;
        b.vel[0] = this.paddleVel + 0.2;
      }
      // spin
      const sp = b.spin;
      if (Math.abs(sp[0])+Math.abs(sp[1])+Math.abs(sp[2]) > 1e-5) {
        const ang = Math.hypot(sp[0],sp[1],sp[2]) * dt;
        const ax = sp[0]/(Math.hypot(sp[0],sp[1],sp[2])||1), ay = sp[1]/(Math.hypot(sp[0],sp[1],sp[2])||1), az = sp[2]/(Math.hypot(sp[0],sp[1],sp[2])||1);
        const s = Math.sin(ang/2), c = Math.cos(ang/2);
        b.quat = qNorm(qMul([ax*s,ay*s,az*s,c], b.quat));
      }
      // splash
      if (!b.inWater && wl > b.pos[1] - b.r * 1.1 && b.vel[1] < -0.5) {
        b.inWater = true;
        this.spawnSplash(b.pos, Math.min(1.4, -b.vel[1] * 0.3));
        if (this.audio) this.audio.play('splash', Math.min(1, 0.4 + (-b.vel[1])/5), clamp(b.pos[0]/1.6, -1, 1) * 0.7);
      }
      if (b.inWater && wl < b.pos[1] - b.r * 2.2) b.inWater = false;
    }

    ballBall() {
      const n = this.balls.length;
      for (let i=0;i<n;i++) for (let j=i+1;j<n;j++) {
        const a=this.balls[i], b=this.balls[j];
        if (!a.released || !b.released) continue;
        const dx=b.pos[0]-a.pos[0], dy=b.pos[1]-a.pos[1], dz=b.pos[2]-a.pos[2];
        const d=Math.hypot(dx,dy,dz), rr=a.r+b.r;
        if (d<rr && d>1e-6) {
          const nx=dx/d, ny=dy/d, nz=dz/d, pen=rr-d;
          a.pos[0]-=nx*pen*0.5; a.pos[1]-=ny*pen*0.5; a.pos[2]-=nz*pen*0.5;
          b.pos[0]+=nx*pen*0.5; b.pos[1]+=ny*pen*0.5; b.pos[2]+=nz*pen*0.5;
          const rvn=(b.vel[0]-a.vel[0])*nx+(b.vel[1]-a.vel[1])*ny+(b.vel[2]-a.vel[2])*nz;
          if (rvn<0) {
            const jj=-(1.4)*rvn/2;
            a.vel[0]-=nx*jj; a.vel[1]-=ny*jj; a.vel[2]-=nz*jj;
            b.vel[0]+=nx*jj; b.vel[1]+=ny*jj; b.vel[2]+=nz*jj;
          }
        }
      }
    }

    waterHeightAt(x, z) {
      if (!this.heightMap) return TANK.level;
      const hm = this.heightMap;
      const nx = hm.nx, nz = hm.nz;
      const fx = (x - TANK.x0) / (TANK.x1-TANK.x0) * (nx-1);
      const fz = (z - TANK.z0) / (TANK.z1-TANK.z0) * (nz-1);
      const i = clamp(Math.floor(fx), 0, nx-2), j = clamp(Math.floor(fz), 0, nz-2);
      const tx = fx-i, tz = fz-j;
      const v00=hm.data[j*nx+i], v10=hm.data[j*nx+i+1], v01=hm.data[(j+1)*nx+i], v11=hm.data[(j+1)*nx+i+1];
      return (v00*(1-tx)+v10*tx)*(1-tz) + (v01*(1-tx)+v11*tx)*tz;
    }

    fluidVelAt(p) {
      if (!this.velMap) return [0,0,0];
      const vm = this.velMap;
      const nx=vm.nx, ny=vm.ny, nz=vm.nz;
      const gx=(p[0]-TANK.x0)/(TANK.x1-TANK.x0)*(nx-1);
      const gy=clamp(p[1]/1.3,0,0.999)*(ny-1);
      const gz=(p[2]-TANK.z0)/(TANK.z1-TANK.z0)*(nz-1);
      const ix=clamp(Math.floor(gx),0,nx-2), iy=clamp(Math.floor(gy),0,ny-2), iz=clamp(Math.floor(gz),0,nz-2);
      const tx=gx-ix, ty=gy-iy, tz=gz-iz;
      let out=[0,0,0], wsum=0;
      for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++){
        const id=(ix+a)+nx*((iy+b)+ny*(iz+c));
        const cnt=vm.count[id]||0;
        if(cnt<1) continue;
        const w=(a?tx:1-tx)*(b?ty:1-ty)*(c?tz:1-tz);
        out[0]+=vm.vx[id]/cnt*w; out[1]+=vm.vy[id]/cnt*w; out[2]+=vm.vz[id]/cnt*w; wsum+=w;
      }
      if (wsum>1e-5) { out[0]/=wsum; out[1]/=wsum; out[2]/=wsum; }
      return out;
    }

    spawnSplash(p, strength) {
      const count = 14 + Math.floor(strength * 22);
      for (let i=0;i<count;i++) {
        this.foam.push({
          pos: [p[0]+(this.rand()-0.5)*0.12, Math.max(0.1, p[1]-0.03), p[2]+(this.rand()-0.5)*0.12],
          vel: [(this.rand()-0.5)*0.9, 0.8+this.rand()*1.8*strength, (this.rand()-0.5)*0.9],
          age: 0, life: 1.2 + this.rand()*2.2, size: 0.022 + this.rand()*0.03, type: 1, alpha: 0.9
        });
      }
      for (let i=0;i<10;i++) {
        this.foam.push({
          pos: [p[0]+(this.rand()-0.5)*0.2, this.waterHeightAt(p[0],p[2])+0.005, p[2]+(this.rand()-0.5)*0.2],
          vel: [(this.rand()-0.5)*0.3, 0.05, (this.rand()-0.5)*0.3],
          age: 0, life: 2.5 + this.rand()*2.5, size: 0.04 + this.rand()*0.05, type: 0, alpha: 0.55
        });
      }
    }

    buildWaterMesh() {
      const data = this._latest;
      if (!data || !this.fluid) { this.waterCount = 0; return; }
      const f = this.fluid;
      const count = f.initialCount;
      const h = 0.04, ox = TANK.x0, oy = 0, oz = TANK.z0;
      const nx = Math.round((TANK.x1-TANK.x0)/h)+1; // 76
      const ny = Math.round(1.32/h)+1; // 34
      const nz = Math.round((TANK.z1-TANK.z0)/h)+1; // 29
      if (!this.density) {
        this.density = new Float32Array(nx*ny*nz);
        this.speedField = new Float32Array(nx*ny*nz);
        this._tmp = new Float32Array(nx*ny*nz);
        this._tmp2 = new Float32Array(nx*ny*nz);
        this.cellVert = new Int32Array((nx-1)*(ny-1)*(nz-1));
        this.heightMap = { nx: 40, nz: 16, data: new Float32Array(40*16).fill(TANK.level) };
        this.velMap = { nx: 16, ny: 9, nz: 10, count: new Float32Array(16*9*10), vx: new Float32Array(16*9*10), vy: new Float32Array(16*9*10), vz: new Float32Array(16*9*10) };
      }
      const d = this.density, sp = this.speedField;
      d.fill(0); sp.fill(0);
      const hm = this.heightMap; hm.data.fill(0);
      const vm = this.velMap; vm.count.fill(0); vm.vx.fill(0); vm.vy.fill(0); vm.vz.fill(0);
      for (let i=0;i<count;i++) {
        const x=data[i*8], y=data[i*8+1], z=data[i*8+2];
        const vx=data[i*8+4], vy=data[i*8+5], vz=data[i*8+6];
        if (!isFinite(x+y+z)) continue;
        const speed=Math.hypot(vx,vy,vz);
        const gx=(x-ox)/h, gy=(y-oy)/h, gz=(z-oz)/h;
        const i0=Math.floor(gx), j0=Math.floor(gy), k0=Math.floor(gz);
        const fx=gx-i0, fy=gy-j0, fz=gz-k0;
        for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++){
          const ii=i0+a, jj=j0+b, kk=k0+c;
          if(ii<0||jj<0||kk<0||ii>=nx||jj>=ny||kk>=nz) continue;
          const w=(a?fx:1-fx)*(b?fy:1-fy)*(c?fz:1-fz);
          const id=ii+nx*(jj+ny*kk);
          d[id]+=w; sp[id]+=w*speed;
        }
        // heightmap
        const hx=Math.floor((x-TANK.x0)/(TANK.x1-TANK.x0)*(hm.nx-1));
        const hz=Math.floor((z-TANK.z0)/(TANK.z1-TANK.z0)*(hm.nz-1));
        if(hx>=0&&hz>=0&&hx<hm.nx&&hz<hm.nz) {
          const hi=hz*hm.nx+hx;
          if (y>hm.data[hi]) hm.data[hi]=y;
        }
        // coarse velocity field
        const cx=Math.floor((x-TANK.x0)/(TANK.x1-TANK.x0)*vm.nx), cy=Math.floor(y/1.3*vm.ny), cz=Math.floor((z-TANK.z0)/(TANK.z1-TANK.z0)*vm.nz);
        if(cx>=0&&cy>=0&&cz>=0&&cx<vm.nx&&cy<vm.ny&&cz<vm.nz) {
          const ci=cx+vm.nx*(cy+vm.ny*cz);
          vm.count[ci]++; vm.vx[ci]+=vx; vm.vy[ci]+=vy; vm.vz[ci]+=vz;
        }
      }
      // smooth heightmap
      const hd=hm.data, htmp=new Float32Array(hd.length);
      for(let pass=0;pass<2;pass++){
        for(let j=0;j<hm.nz;j++)for(let i=0;i<hm.nx;i++){
          let s=0,c=0;
          for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){
            const ii=i+a,jj=j+b; if(ii<0||jj<0||ii>=hm.nx||jj>=hm.nz)continue;
            s+=hd[jj*hm.nx+ii];c++;
          }
          htmp[j*hm.nx+i]=s/c;
        }
        hd.set(htmp);
      }
      // blur density and speed
      const tmp=this._tmp, tmp2=this._tmp2;
      const box=1;
      for(let j=0;j<ny;j++)for(let k=0;k<nz;k++)for(let i=0;i<nx;i++){
        let s=0,c=0;
        for(let a=-box;a<=box;a++){const ii=i+a;if(ii<0||ii>=nx)continue;s+=d[ii+nx*(j+ny*k)];c++;}
        tmp[i+nx*(j+ny*k)]=s/c;
      }
      for(let i=0;i<nx;i++)for(let k=0;k<nz;k++)for(let j=0;j<ny;j++){
        let s=0,c=0;
        for(let b=-box;b<=box;b++){const jj=j+b;if(jj<0||jj>=ny)continue;s+=tmp[i+nx*(jj+ny*k)];c++;}
        tmp2[i+nx*(j+ny*k)]=s/c;
      }
      for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)for(let k=0;k<nz;k++){
        let s=0,c=0;
        for(let b=-box;b<=box;b++){const kk=k+b;if(kk<0||kk>=nz)continue;s+=tmp2[i+nx*(j+ny*kk)];c++;}
        d[i+nx*(j+ny*k)]=s/c;
      }
      const iso = 1.25;
      const cv = this.cellVert;
      cv.fill(-1);
      const posArr=[], norArr=[], foamArr=[];
      const nvcx=nx-1, nvcy=ny-1, nvcz=nz-1;
      const cellDensity=(i,j,k)=>d[i+nx*(j+ny*k)];
      for(let k=0;k<nvcz;k++)for(let j=0;j<nvcy;j++)for(let i=0;i<nvcx;i++){
        const d000=cellDensity(i,j,k), d100=cellDensity(i+1,j,k), d010=cellDensity(i,j+1,k), d110=cellDensity(i+1,j+1,k);
        const d001=cellDensity(i,j,k+1), d101=cellDensity(i+1,j,k+1), d011=cellDensity(i,j+1,k+1), d111=cellDensity(i+1,j+1,k+1);
        let mn=Math.min(d000,d100,d010,d110,d001,d101,d011,d111), mx=Math.max(d000,d100,d010,d110,d001,d101,d011,d111);
        if (mn>=iso || mx<iso) continue;
        let px=0,py=0,pz=0,pn=0;
        const corners=[[0,0,0,d000],[1,0,0,d100],[0,1,0,d010],[1,1,0,d110],[0,0,1,d001],[1,0,1,d101],[0,1,1,d011],[1,1,1,d111]];
        const edges=[[0,1],[0,2],[1,3],[2,3],[4,5],[4,6],[5,7],[6,7],[0,4],[1,5],[2,6],[3,7]];
        for(const e of edges){
          const A=corners[e[0]], B=corners[e[1]];
          if((A[3]-iso)*(B[3]-iso)>=0) continue;
          const t=(iso-A[3])/(B[3]-A[3]);
          px += i + A[0] + (B[0]-A[0])*t;
          py += j + A[1] + (B[1]-A[1])*t;
          pz += k + A[2] + (B[2]-A[2])*t;
          pn++;
        }
        if(!pn) continue;
        const vx=(ox + px/pn*h), vy=(oy + py/pn*h), vz=(oz + pz/pn*h);
        const gradX=cellDensity(Math.min(nx-1,i+1),j,k)-cellDensity(Math.max(0,i-1),j,k);
        const gradY=cellDensity(i,Math.min(ny-1,j+1),k)-cellDensity(i,Math.max(0,j-1),k);
        const gradZ=cellDensity(i,j,Math.min(nz-1,k+1))-cellDensity(i,j,Math.max(0,k-1));
        let gl2=Math.hypot(gradX,gradY,gradZ)||1;
        const nxv=-gradX/gl2, nyv=-gradY/gl2, nzv=-gradZ/gl2;
        const ci=i+nx*(j+ny*k);
        const speed=sp[ci]/Math.max(0.4,d[ci]);
        const crestFoam = Math.max(0, 1 - Math.abs(nyv));
        const fv = smoothstep(1.15, 2.65, speed) * (0.45 + 0.55*crestFoam);
        const idx = posArr.length/3;
        posArr.push(vx,vy,vz); norArr.push(nxv,nyv,nzv); foamArr.push(fv);
        cv[i+nvcx*(j+nvcy*k)] = idx;
      }
      // quads
      const idxArr=[];
      const emit = (a,b,c,dd) => { idxArr.push(a,b,c, a,c,dd); };
      for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
        const base=i+nx*(j+ny*k);
        // x edge
        if(i<nx-1 && j>0 && j<ny-1 && k>0 && k<nz-1 && ((d[base]-iso)*(d[base+1]-iso)<0)) {
          const v0=cv[i+nvcx*((j-1)+nvcy*(k-1))], v1=cv[i+nvcx*(j+nvcy*(k-1))], v2=cv[i+nvcx*(j+nvcy*k)], v3=cv[i+nvcx*((j-1)+nvcy*k)];
          if(v0>=0&&v1>=0&&v2>=0&&v3>=0) emit(v0,v1,v2,v3);
        }
        // y edge
        if(j<ny-1 && i>0 && i<nx-1 && k>0 && k<nz-1 && ((d[base]-iso)*(d[base+nx]-iso)<0)) {
          const v0=cv[(i-1)+nvcx*((j)+nvcy*(k-1))], v1=cv[i+nvcx*(j+nvcy*(k-1))], v2=cv[i+nvcx*(j+nvcy*k)], v3=cv[(i-1)+nvcx*(j+nvcy*k)];
          if(v0>=0&&v1>=0&&v2>=0&&v3>=0) emit(v0,v1,v2,v3);
        }
        // z edge
        if(k<nz-1 && i>0 && i<nx-1 && j>0 && j<ny-1 && ((d[base]-iso)*(d[base+nx*ny]-iso)<0)) {
          const v0=cv[(i-1)+nvcx*((j-1)+nvcy*k)], v1=cv[i+nvcx*((j-1)+nvcy*k)], v2=cv[i+nvcx*(j+nvcy*k)], v3=cv[(i-1)+nvcx*(j+nvcy*k)];
          if(v0>=0&&v1>=0&&v2>=0&&v3>=0) emit(v0,v1,v2,v3);
        }
      }
      const nvert = idxArr.length;
      if(!this.waterMesh) this.waterMesh = new GLU.DynMesh(this.gl, 300000, [{name:'aFoam',size:1}]);
      const mesh=this.waterMesh;
      if(nvert>mesh.maxVerts) { this.waterCount=0; return; }
      for(let t=0;t<nvert;t++){
        const vi=idxArr[t];
        mesh.pos[t*3]=posArr[vi*3]; mesh.pos[t*3+1]=posArr[vi*3+1]; mesh.pos[t*3+2]=posArr[vi*3+2];
        mesh.normal[t*3]=norArr[vi*3]; mesh.normal[t*3+1]=norArr[vi*3+1]; mesh.normal[t*3+2]=norArr[vi*3+2];
        mesh.extraArrays.aFoam[t]=foamArr[vi];
      }
      mesh.uploadAll(nvert);
      this.waterCount = nvert;
      this.waterFoam = foamArr;
      this.waterPos = posArr;
      this.updateFoamSpray(data, count);
    }

    updateFoamSpray(data, count) {
      // spray from fast particles just above the surface
      this.sprays.length = 0;
      const step = Math.max(1, Math.floor(count / 900));
      for (let i=0;i<count;i+=step) {
        const x=data[i*8],y=data[i*8+1],z=data[i*8+2],vx=data[i*8+4],vy=data[i*8+5],vz=data[i*8+6];
        const sp=Math.hypot(vx,vy,vz);
        if (sp > 2.1 && y > 0.62 && this.sprays.length < 1100) {
          this.sprays.push({x,y,z,size:0.012+Math.min(0.025,sp*0.004),alpha:Math.min(0.9,sp*0.16)});
        }
      }
      // foam generation
      if (this.waterPos) {
        for (let i=0;i<this.waterPos.length/3;i+=17) {
          const fv=this.waterFoam ? this.waterFoam[i] : 0;
          if (fv > 0.55 && this.foam.length < 1100 && this.rand() < 0.10) {
            const x=this.waterPos[i*3],y=this.waterPos[i*3+1],z=this.waterPos[i*3+2];
            this.foam.push({pos:[x, y+0.01, z], vel:[(this.rand()-0.5)*0.25, 0.02, (this.rand()-0.5)*0.25], age:0, life:1.6+this.rand()*2.6, size:0.035+this.rand()*0.06, type:0, alpha:0.5});
          }
        }
      }
      // update
      for (let i=this.foam.length-1;i>=0;i--) {
        const p=this.foam[i];
        p.age+=1/60;
        p.pos[0]+=p.vel[0]/60; p.pos[1]+=p.vel[1]/60; p.pos[2]+=p.vel[2]/60;
        p.vel[1]*=0.985; p.vel[0]*=0.995; p.vel[2]*=0.995;
        p.alpha = Math.max(0, Math.min(0.75, p.alpha * (1 - p.age/p.life)));
        if(p.age>p.life) this.foam.splice(i,1);
      }
      if (this.foam.length > 1300) this.foam.splice(0, this.foam.length-1300);
    }

    updatePaddle(dt) {
      if (this.waveOn) {
        const stroke = 0.02 + this.ampCur * 0.30;
        const omega = Math.PI * 2 * this.params.frequency;
        this.phase += omega * dt;
        this.paddleFace = -1.44 + stroke * 0.5 * (1 - Math.cos(this.phase));
        this.paddleVel = stroke * 0.5 * omega * Math.sin(this.phase);
        this.ampCur += (this.ampTarget - this.ampCur) * Math.min(1, dt*1.2);
      } else {
        this.ampCur += (0 - this.ampCur) * Math.min(1, dt*2.0);
        this.paddleFace += (-1.44 - this.paddleFace) * Math.min(1, dt*3.0);
        this.paddleVel = 0;
      }
    }

    async fluidStep(dt) {
      if (!this.ready || !this.fluid) return;
      this.updatePaddle(dt);
      const balls = this.balls.map(b=>({pos:b.pos, vel:b.vel, r:b.r, rho:b.rho}));
      const data = await this.fluid.step(dt, this.paddleFace, this.paddleVel, balls);
      if (!data) return;
      this._latest = data;
      this.buildWaterMesh();
      // balls simulation
      const sub = 2;
      for (let s=0;s<sub;s++) {
        for (const b of this.balls) this.ballWorld(b, dt/sub);
        this.ballBall();
      }
      // audio wave bed
      if (this.audio && this.waveOn) this.audio.setSurge(0.3 + this.ampCur * 0.6);
    }

    async asyncStep(dt) {
      this._acc += dt;
      if (this._acc >= 1/60 - 1e-9) {
        this._acc -= 1/60;
        await this.fluidStep(1/60);
      }
      this.time += dt;
    }

    update(dt) {
      this.time += dt;
      if (!this.ready || !this.fluid) return;
      this._acc += dt;
      if (this._acc >= 1/60 && !this._busy) {
        this._acc -= 1/60;
        this._busy = true;
        this.fluidStep(1/60).finally(()=>{ this._busy = false; });
      }
      // advance non-fluid visuals
      for (const b of this.balls) if (!b.released) { b.pos = b.home.slice(); }
      for (let i=this.foam.length-1;i>=0;i--) {
        const p=this.foam[i];
        p.age+=dt;
        if(p.age>p.life) this.foam.splice(i,1);
      }
    }

    prepare(r) {
      r.shadowTargetPos = [0, 0.6, 0];
      r.shadowRadius = 3.3;
    }

    drawShadow(r, prog) {
      const gl=this.gl;
      prog.use();
      const plinth = M4.mul(M4.translation(0,-0.35,0), M4.scaling(3.5,0.7,1.35));
      r.drawShadowMesh(prog, this.boxMesh, plinth);
      r.drawShadowMesh(prog, this.terrainMesh, M4.identity());
      for (const b of this.balls) {
        if (!b.released) continue;
        const m=M4.mul(M4.translation(b.pos[0],b.pos[1],b.pos[2]), M4.scaling(b.r,b.r,b.r));
        r.drawShadowMesh(prog, this.sphere, m);
      }
    }

    drawTankStructure(r) {
      // base plinth
      r.drawSurface(this.boxMesh, M4.mul(M4.translation(0,-0.36,0), M4.scaling(3.46,0.7,1.36)), [0.045,0.05,0.055], {metal:0.25, rough:0.42, noise:0.55});
      // brass base trim
      r.drawSurface(this.boxMesh, M4.mul(M4.translation(0,-0.02,0), M4.scaling(3.52,0.03,1.42)), [0.62,0.46,0.21], {metal:0.95, rough:0.28});
      // floor + terrain
      r.drawSurface(this.floorMesh, M4.mul(M4.translation(0,0.004,0), M4.scaling(1,1,1)), [0.36,0.32,0.24], {rough:0.8, noise:0.5});
      r.drawSurface(this.terrainMesh, M4.identity(), [0.46,0.40,0.29], {rough:0.78, noise:0.7, accent:[0.2,0.18,0.12]});
      // frame posts and rails
      const brass=[0.58,0.44,0.23];
      const posts=[[-1.53,0.62,0.57],[1.53,0.62,0.57],[-1.53,0.62,-0.57],[1.53,0.62,-0.57]];
      for(const p of posts) r.drawSurface(this.boxMesh, M4.mul(M4.translation(p[0],p[1],p[2]), M4.scaling(0.055,1.3,0.055)), brass, {metal:0.9,rough:0.3});
      r.drawSurface(this.boxMesh, M4.mul(M4.translation(0,1.30,0.57), M4.scaling(3.12,0.045,0.05)), brass, {metal:0.9,rough:0.28});
      r.drawSurface(this.boxMesh, M4.mul(M4.translation(0,1.30,-0.57), M4.scaling(3.12,0.045,0.05)), brass, {metal:0.9,rough:0.28});
      r.drawSurface(this.boxMesh, M4.mul(M4.translation(-1.53,1.30,0), M4.scaling(0.05,0.045,1.18)), brass, {metal:0.9,rough:0.28});
      r.drawSurface(this.boxMesh, M4.mul(M4.translation(1.53,1.30,0), M4.scaling(0.05,0.045,1.18)), brass, {metal:0.9,rough:0.28});
      // lower rim
      r.drawSurface(this.boxMesh, M4.mul(M4.translation(0,0.02,0.57), M4.scaling(3.12,0.04,0.05)), [0.25,0.26,0.25], {metal:0.8,rough:0.35});
      r.drawSurface(this.boxMesh, M4.mul(M4.translation(0,0.02,-0.57), M4.scaling(3.12,0.04,0.05)), [0.25,0.26,0.25], {metal:0.8,rough:0.35});
      // paddle
      const pw = 1.08, ph = 0.64;
      const px = this.paddleFace;
      r.drawSurface(this.boxMesh, M4.mul(M4.translation(px, 0.34, 0), M4.scaling(0.045, ph, pw)), [0.42,0.46,0.48], {metal:0.85, rough:0.26});
      r.drawSurface(this.boxMesh, M4.mul(M4.translation(px+0.026, 0.34, 0), M4.scaling(0.012, ph*0.94, pw*0.98)), [0.06,0.07,0.075], {metal:0.1, rough:0.65});
      // guide rods
      r.drawSurface(this.boxMesh, M4.mul(M4.translation(-1.64,0.75,0.40), M4.scaling(0.028,0.9,0.028)), brass, {metal:0.9,rough:0.22});
      r.drawSurface(this.boxMesh, M4.mul(M4.translation(-1.64,0.75,-0.40), M4.scaling(0.028,0.9,0.028)), brass, {metal:0.9,rough:0.22});
      // flywheel mechanism (visual)
      const wheelX=-1.70, wheelY=1.02, wheelZ=0.56;
      const wm=M4.mul(M4.translation(wheelX,wheelY,wheelZ), M4.rotationZ(this.phase));
      r.drawSurface(this.wheel, wm, brass, {metal:0.95,rough:0.24});
      for(let i=0;i<4;i++){
        r.drawSurface(this.wheelSpoke, M4.mul(M4.mul(M4.translation(wheelX,wheelY,wheelZ), M4.rotationZ(this.phase + i*Math.PI/2)), M4.scaling(0.24,0.012,0.012)), [0.5,0.4,0.2], {metal:0.9,rough:0.25});
      }
      // ball rack
      if (!this.released) {
        r.drawSurface(this.boxMesh, M4.mul(M4.translation(0,1.40,0), M4.scaling(2.5,0.018,0.9)), [0.35,0.36,0.35], {metal:0.8,rough:0.32});
        for(let z=-1;z<=1;z++){
          r.drawSurface(this.boxMesh, M4.mul(M4.translation(0,1.405,z*0.28), M4.scaling(2.4,0.012,0.012)), [0.6,0.46,0.23], {metal:0.9,rough:0.25});
        }
      }
    }

    renderOpaque(r) {
      r.drawFloor(-0.95, {color:[0.030,0.036,0.041]});
      this.drawTankStructure(r);
      // opaque balls (above and below water)
      const p=this.progBall.use();
      r.setCommon(p);
      for (const b of this.balls) {
        const model=M4.mul(M4.translation(b.pos[0],b.pos[1],b.pos[2]), M4.scaling(b.r,b.r,b.r));
        p.use(); p.m4('uModel',model); p.m4('uViewProj',r.camera.vp); p.m3('uRot',qMat(b.quat));
        p.v3('uColor',b.color);
        this.sphere.draw();
      }
    }

    renderTransparent(r) {
      const gl=this.gl;
      // water volume sides (hides the open boundary of the reconstructed surface)
      const sp = this.progSide.use();
      sp.m4('uViewProj', r.camera.vp);
      sp.v3('uCamPos', r.camera.eye);
      sp.f('uTime', r.time);
      const sideDepth = Math.max(0.05, this.waterLevelNow || 0.8);
      const sideH = Math.min(1.0, sideDepth);
      const walls = [
        [M4.mul(M4.translation(0, sideH*0.5, 0.545), M4.scaling(2.98, sideH, 0.002)), 0],
        [M4.mul(M4.translation(0, sideH*0.5, -0.545), M4.scaling(2.98, sideH, 0.002)), 0],
        [M4.mul(M4.translation(-1.49, sideH*0.5, 0), M4.scaling(0.002, sideH, 1.09)), 0],
        [M4.mul(M4.translation(1.49, sideH*0.5, 0), M4.scaling(0.002, sideH, 1.09)), 0]
      ];
      gl.disable(gl.CULL_FACE);
      for (const [m] of walls) {
        sp.use(); sp.m4('uViewProj', r.camera.vp); sp.v3('uCamPos', r.camera.eye); sp.f('uTime', r.time); sp.m4('uModel', m);
        sp.m3('uNormalMat', M3.transpose(M3.invert(M4.mat3(m)) || M3.identity()));
        this.boxMesh.draw();
      }
      gl.enable(gl.CULL_FACE);
      // water
      if (this.waterCount>0) {
        const p=this.progWater.use();
        r.setCommon(p);
        p.m4('uViewProj',r.camera.vp);
        p.v2('uRes',r.w,r.h);
        p.f('uTime',r.time);
        p.i('uSceneTex',2);
        GLU.bindTexture(gl,r.refractTarget.color,2);
        gl.disable(gl.CULL_FACE);
        this.waterMesh.draw(this.waterCount);
        gl.enable(gl.CULL_FACE);
      }
      // glass panes
      const gp=this.progGlass.use();
      r.setCommon(gp);
      gp.m4('uViewProj',r.camera.vp);
      gp.v2('uRes',r.w,r.h);
      gp.i('uSceneTex',2);
      GLU.bindTexture(gl,r.refractTarget.color,2);
      gl.disable(gl.CULL_FACE);
      gl.depthMask(false);
      for (let i=0;i<4;i++) {
        gp.use();
        gp.m4('uModel', this.paneModels[i]);
        const nm=M3.transpose(M3.invert(M4.mat3(this.paneModels[i]))||M3.identity());
        gp.m3('uNormalMat', nm);
        gp.m4('uViewProj',r.camera.vp);
        this.boxMesh.draw();
      }
      gl.enable(gl.CULL_FACE);
    }

    renderAdditive(r) {
      const gl=this.gl;
      const spray=this.sprays;
      const foam=this.foam;
      if (spray.length + foam.length > 0) {
        const p=this.progFoam.use();
        p.m4('uViewProj',r.camera.vp);
        const cam=r.camera;
        const right=V3.norm(V3.cross([0,1,0], V3.norm(V3.sub(cam.eye,cam.target))));
        const up=V3.norm(V3.cross(V3.norm(V3.sub(cam.eye,cam.target)), right));
        p.v3('uCamRight',right); p.v3('uCamUp',up);
        const drawSet=(list,type)=>{
          if(!list.length) return;
          const data=new Float32Array(list.length*6);
          for(let i=0;i<list.length;i++){
            const s=list[i], cc=s.pos||s;
            data[i*6]=cc[0]!==undefined?cc[0]:s.x;
            data[i*6+1]=cc[1]!==undefined?cc[1]:s.y;
            data[i*6+2]=cc[2]!==undefined?cc[2]:s.z;
            data[i*6+3]=s.size; data[i*6+4]=s.alpha; data[i*6+5]=type;
          }
          gl.bindBuffer(gl.ARRAY_BUFFER,this.foamBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER,0,data);
          gl.bindVertexArray(this.foamQuad);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,list.length);
          gl.bindVertexArray(null);
        };
        drawSet(foam,0);
        drawSet(spray,1);
      }
    }

    updateCaption() {}
  }

  window.SceneTank = SceneTank;
})();
