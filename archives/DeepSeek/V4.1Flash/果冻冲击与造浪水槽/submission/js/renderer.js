/* renderer.js — WebGL2 scene renderer, studio lighting, shadow map, bloom (global Renderer, Camera) */
(function () {
  'use strict';

  const GLSL_COMMON = `
precision highp sampler2DShadow;
const float PI = 3.14159265359;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uCamPos;
uniform mat4 uLightVP;
uniform sampler2DShadow uShadow;
uniform sampler2D uEnv;
uniform vec3 uRimDir;
uniform vec3 uRimColor;

vec3 envMap(vec3 d, float lod){
  float u = atan(d.z, d.x) / (2.0 * PI) + 0.5;
  float v = acos(clamp(d.y, -1.0, 1.0)) / PI;
  return textureLod(uEnv, vec2(u, v), lod).rgb;
}
float shadowFactor(vec3 wp, vec3 N){
  vec4 lp = uLightVP * vec4(wp + N * 0.018, 1.0);
  vec3 p = lp.xyz / lp.w;
  p = p * 0.5 + 0.5;
  if (p.x < 0.002 || p.x > 0.998 || p.y < 0.002 || p.y > 0.998 || p.z > 1.0) return 1.0;
  float bias = 0.0012 + 0.0035 * (1.0 - max(dot(N, uSunDir), 0.0));
  vec2 texel = 1.0 / vec2(textureSize(uShadow, 0));
  float s = 0.0;
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      s += texture(uShadow, vec3(p.xy + vec2(float(x), float(y)) * texel * 1.1, p.z - bias));
    }
  }
  return s / 9.0;
}
vec3 aces(vec3 x){
  x *= 0.92;
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float noise3(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n000=hash13(i), n100=hash13(i+vec3(1,0,0)), n010=hash13(i+vec3(0,1,0)), n110=hash13(i+vec3(1,1,0));
  float n001=hash13(i+vec3(0,0,1)), n101=hash13(i+vec3(1,0,1)), n011=hash13(i+vec3(0,1,1)), n111=hash13(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y), mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * noise3(p); p = p * 2.03 + vec3(11.3, 7.1, 3.7); a *= 0.5; } return s; }
vec3 shadePBR(vec3 N, vec3 V, vec3 L, vec3 base, vec3 lightCol, float rough, float metal, float ndl){
  vec3 H = normalize(V + L);
  float nh = max(dot(N, H), 0.0);
  float a = max(0.035, rough * rough);
  float d = a * a / (PI * pow(nh * nh * (a * a - 1.0) + 1.0, 2.0));
  vec3 F0 = mix(vec3(0.03), base, metal);
  float fres = pow(1.0 - max(dot(H, V), 0.0), 5.0);
  vec3 F = F0 + (1.0 - F0) * fres;
  float k = (rough + 1.0); k = k * k / 8.0;
  float g = ndl / (ndl * (1.0 - k) + k);
  vec3 spec = F * d * g * 0.25 / max(0.001, nh) * lightCol;
  vec3 diff = base * (1.0 - metal) * lightCol * ndl / PI;
  return diff + spec * ndl;
}
`;

  class OrbitCamera {
    constructor() {
      this.target = [0, 0.4, 0];
      this.yaw = 0.42; this.pitch = 0.30; this.dist = 3.4;
      this.fov = 38 * Math.PI / 180; this.near = 0.03; this.far = 60;
      this.eye = [0, 1, 3]; this.up = [0, 1, 0];
      this.view = M4.identity(); this.proj = M4.identity(); this.vp = M4.identity(); this.invVP = M4.identity();
      this.aspect = 1.7;
      this.roll = 0;
    }
    setPose(eye, target) {
      this.eye = V3.copy(eye); this.target = V3.copy(target);
      const d = V3.sub(eye, target);
      this.dist = Math.max(0.2, V3.len(d));
      this.yaw = Math.atan2(d[0], d[2]);
      this.pitch = Math.asin(Math.max(-1, Math.min(1, d[1] / this.dist)));
    }
    setOrbit(target, yaw, pitch, dist) {
      this.target = V3.copy(target); this.yaw = yaw; this.pitch = pitch; this.dist = dist;
    }
    orbit(dx, dy) {
      this.yaw -= dx * 0.0052;
      this.pitch = Math.max(-0.10, Math.min(1.35, this.pitch + dy * 0.004));
    }
    zoom(delta) {
      this.dist *= Math.exp(delta * 0.0011);
      this.dist = Math.max(0.7, Math.min(18, this.dist));
    }
    update(aspect) {
      this.aspect = aspect;
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      this.eye = [
        this.target[0] + this.dist * cp * Math.sin(this.yaw),
        this.target[1] + this.dist * sp,
        this.target[2] + this.dist * cp * Math.cos(this.yaw)
      ];
      this.view = M4.lookAt(this.eye, this.target, [0, 1, 0]);
      this.proj = M4.perspective(this.fov, aspect, this.near, this.far);
      this.vp = M4.mul(this.proj, this.view);
      this.invVP = M4.invert(this.vp);
    }
  }

  const VS_FULL = `#version 300 es
precision highp float;
out vec2 vUV;
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUV = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

  const FS_SKY = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 oColor;
uniform mat4 uInvVP;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform float uTime;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec4 w = uInvVP * vec4(vUV * 2.0 - 1.0, 1.0, 1.0);
  vec3 ray = normalize(w.xyz / w.w - uCamPos);
  float y = ray.y;
  float horizon = exp(-abs(y) * 7.0);
  vec3 sky = mix(vec3(0.020, 0.030, 0.040), vec3(0.055, 0.075, 0.085), smoothstep(-0.1, 0.7, y));
  sky += uSkyColor * pow(max(0.0, 1.0 - abs(y) * 1.6), 3.0) * 0.16;
  // soft studio glow around key direction
  float sunA = max(0.0, dot(ray, uSunDir));
  sky += vec3(0.30, 0.22, 0.13) * pow(sunA, 22.0) * 0.55;
  sky += vec3(0.10, 0.16, 0.19) * pow(sunA, 5.0) * 0.18;
  // rim-side cool gradient
  float back = max(0.0, dot(ray, normalize(vec3(0.4, 0.2, -0.9))));
  sky += vec3(0.02, 0.05, 0.07) * pow(back, 4.0);
  sky = mix(sky, uGroundColor * 0.6, smoothstep(0.02, -0.28, y));
  float vig = smoothstep(1.25, 0.15, length(vUV - 0.5));
  sky *= 0.55 + 0.45 * vig;
  sky += (hash(vUV * 1200.0 + uTime) - 0.5) * 0.0035;
  oColor = vec4(max(sky, 0.0), 1.0);
}`;

  const VS_DEPTH = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uModel;
uniform mat4 uLightVP;
void main(){ gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }`;
  const FS_DEPTH = `#version 300 es
precision highp float;
out vec4 o; void main(){ o = vec4(1.0); }`;

  const VS_SURFACE = `#version 300 es
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

  const FS_SURFACE = `#version 300 es
precision highp float;
${GLSL_COMMON}
in vec3 vWorld;
in vec3 vNormal;
out vec4 oColor;
uniform vec3 uBaseColor;
uniform float uMetal;
uniform float uRough;
uniform float uNoise;
uniform float uEmissive;
uniform float uSpot;
uniform vec3 uFogColor;
uniform vec3 uAccentColor;

void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  float ndl = max(dot(N, uSunDir), 0.0);
  float sh = shadowFactor(vWorld, N);
  vec3 base = uBaseColor;
  float n = fbm(vWorld * 4.0);
  float n2 = fbm(vWorld * 21.0 + 3.0);
  if (uNoise > 0.001){
    base *= mix(1.0, 0.72 + n * 0.55, uNoise);
    base *= mix(1.0, 0.9 + n2 * 0.2, uNoise * 0.6);
    // subtle mineral streaks
    base += uAccentColor * pow(max(0.0, n2 - 0.55), 2.0) * 0.9 * uNoise;
  }
  float spot = 1.0;
  if (uSpot > 0.0) spot = mix(0.35, 1.0, smoothstep(5.0, 0.7, length(vWorld.xz - vec2(0.0, 0.0))));
  vec3 col = vec3(0.0);
  col += base * (uSkyColor * (0.55 + 0.45 * N.y) + uGroundColor * (0.5 - 0.5 * N.y)) * 0.55;
  col += shadePBR(N, V, uSunDir, base, uSunColor * spot, uRough, uMetal, ndl) * (0.20 + 0.80 * sh);
  // rim light
  vec3 rimL = normalize(uRimDir);
  float rndl = max(dot(N, rimL), 0.0);
  col += base * uRimColor * pow(1.0 - max(dot(N, V), 0.0), 2.0) * rndl * 0.55;
  vec3 R = reflect(-V, N);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 env = envMap(R, uRough * 5.6 + 0.35);
  col += env * mix(vec3(0.10), base, uMetal) * mix(0.16, 1.0, uMetal) * mix(0.55, 1.4, fres);
  col += base * uEmissive;
  // distance fog to studio darkness
  float d = length(uCamPos - vWorld);
  float fog = smoothstep(4.5, 17.0, d);
  col = mix(col, uFogColor, fog * 0.85);
  oColor = vec4(col, 1.0);
}`;

  const FS_BRIGHT = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
uniform sampler2D uTex;
uniform float uThreshold;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  float l = max(max(c.r, c.g), c.b);
  float k = max(0.0, l - uThreshold) / max(l, 0.0001);
  o = vec4(c * k * 0.85, 1.0);
}`;

  const FS_BLUR = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
uniform sampler2D uTex;
uniform vec2 uDir;
void main(){
  vec3 s = texture(uTex, vUV).rgb * 0.227027;
  s += (texture(uTex, vUV + uDir * 1.3846).rgb + texture(uTex, vUV - uDir * 1.3846).rgb) * 0.316216;
  s += (texture(uTex, vUV + uDir * 3.2308).rgb + texture(uTex, vUV - uDir * 3.2308).rgb) * 0.070270;
  o = vec4(s, 1.0);
}`;

  const FS_COMPOSITE = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uTime;
uniform float uExposure;
uniform float uBloomAmt;
uniform float uGrain;
uniform vec2 uRes;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUV;
  vec2 d = uv - 0.5;
  float r2 = dot(d, d);
  // tiny chromatic aberration toward edges
  float ca = 0.0016 * r2;
  vec3 col;
  col.r = texture(uScene, uv - d * ca).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv + d * ca).b;
  vec3 bloom = texture(uBloom, uv).rgb;
  col = col * uExposure + bloom * uBloomAmt;
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.16);
  col *= 1.0 - r2 * 0.55;
  col += vec3(0.012, 0.018, 0.020) * (1.0 - r2);
  float g = hash(uv * uRes + fract(uTime) * 97.0) - 0.5;
  col += g * uGrain;
  o = vec4(col, 1.0);
}`;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
      if (!gl) throw new Error('无法创建 WebGL2 上下文');
      this.gl = gl;
      this.floatOK = !!gl.getExtension('EXT_color_buffer_float');
      gl.getExtension('OES_texture_float_linear');
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.lightDir = V3.norm([-0.48, 0.92, 0.58]);
      this.rimDir = V3.norm([0.55, 0.30, -0.78]);
      this.sunColor = [1.55, 1.34, 1.08];
      this.rimColor = [0.22, 0.52, 0.62];
      this.skyColor = [0.16, 0.25, 0.29];
      this.groundColor = [0.035, 0.042, 0.048];
      this.fogColor = [0.022, 0.032, 0.038];
      this.camera = new OrbitCamera();
      this.shadowTargetPos = [0, 0.2, 0];
      this.shadowRadius = 3.2;
      this.time = 0;
      this.sceneTarget = null;
      this.refractTarget = null;
      this.bloomA = null; this.bloomB = null;
      this.w = 1; this.h = 1;
      this.initPrograms();
      this.initShadow();
      this.envTex = GLU.createEnvTexture(gl);
      this.quad = gl.createVertexArray();
      this.resize();
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.clearColor(0, 0, 0, 1);
    }

    initPrograms() {
      const gl = this.gl;
      this.progSky = new GLU.Program(gl, VS_FULL, FS_SKY, 'sky');
      this.progDepth = new GLU.Program(gl, VS_DEPTH, FS_DEPTH, 'depth');
      this.progSurface = new GLU.Program(gl, VS_SURFACE, FS_SURFACE, 'surface');
      this.progBright = new GLU.Program(gl, VS_FULL, FS_BRIGHT, 'bright');
      this.progBlur = new GLU.Program(gl, VS_FULL, FS_BLUR, 'blur');
      this.progComposite = new GLU.Program(gl, VS_FULL, FS_COMPOSITE, 'composite');
    }

    initShadow() {
      const gl = this.gl;
      this.shadowSize = 2048;
      this.shadowTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.shadowSize, this.shadowSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      this.shadowFBO = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.updateLightMatrix();
    }

    updateLightMatrix() {
      const eye = V3.add(this.shadowTargetPos, V3.mul(this.lightDir, 9));
      const view = M4.lookAt(eye, this.shadowTargetPos, [0, 1, 0]);
      const r = this.shadowRadius;
      const proj = M4.ortho(-r, r, -r, r, 0.5, 22);
      this.lightVP = M4.mul(proj, view);
    }

    resize() {
      const gl = this.gl;
      const w = Math.max(2, Math.floor(window.innerWidth * this.dpr));
      const h = Math.max(2, Math.floor(window.innerHeight * this.dpr));
      if (w === this.w && h === this.h) return false;
      this.w = w; this.h = h;
      this.canvas.width = w; this.canvas.height = h;
      if (this.sceneTarget) this.sceneTarget.dispose();
      if (this.refractTarget) this.refractTarget.dispose();
      if (this.bloomA) { this.bloomA.dispose(); this.bloomB.dispose(); }
      this.sceneTarget = new GLU.RenderTarget(gl, w, h, { float: this.floatOK, depth: true });
      this.refractTarget = new GLU.RenderTarget(gl, w, h, { float: this.floatOK });
      this.bloomA = new GLU.RenderTarget(gl, Math.ceil(w / 4), Math.ceil(h / 4), { float: this.floatOK, nearest: false });
      this.bloomB = new GLU.RenderTarget(gl, Math.ceil(w / 4), Math.ceil(h / 4), { float: this.floatOK, nearest: false });
      return true;
    }

    copyToRefraction() {
      const gl = this.gl;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.sceneTarget.fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.refractTarget.fbo);
      gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      this.sceneTarget.bind();
    }

    setCommon(prog) {
      prog.m4('uViewProj', this.camera.vp);
      prog.v3('uCamPos', this.camera.eye);
      prog.v3('uSunDir', this.lightDir);
      prog.v3('uSunColor', this.sunColor);
      prog.v3('uSkyColor', this.skyColor);
      prog.v3('uGroundColor', this.groundColor);
      prog.v3('uRimDir', this.rimDir);
      prog.v3('uRimColor', this.rimColor);
      prog.m4('uLightVP', this.lightVP);
      prog.v3('uFogColor', this.fogColor);
      prog.i('uShadow', 0);
      prog.i('uEnv', 1);
      GLU.bindTexture(this.gl, this.shadowTex, 0);
      GLU.bindTexture(this.gl, this.envTex, 1);
    }

    beginShadow() {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO);
      gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.55, 3.0);
      gl.colorMask(false, false, false, false);
    }
    endShadow() {
      const gl = this.gl;
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.colorMask(true, true, true, true);
      gl.enable(gl.CULL_FACE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    drawShadowMesh(prog, mesh, model, count) {
      prog.use();
      prog.m4('uModel', model);
      prog.m4('uLightVP', this.lightVP);
      mesh.draw(count);
    }

    beginScene() {
      const gl = this.gl;
      const t = this.sceneTarget;
      t.bind();
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.disable(gl.BLEND);
      const sky = this.progSky.use();
      sky.m4('uInvVP', this.camera.invVP);
      sky.v3('uCamPos', this.camera.eye);
      sky.v3('uSunDir', this.lightDir);
      sky.v3('uSkyColor', this.skyColor);
      sky.v3('uGroundColor', this.groundColor);
      sky.f('uTime', this.time);
      gl.bindVertexArray(this.quad);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
    }

    beginOpaque() {
      const gl = this.gl;
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
    }

    beginTransparent() {
      const gl = this.gl;
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);
    }

    beginAdditive() {
      const gl = this.gl;
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.disable(gl.CULL_FACE);
    }

    endScene() {
      const gl = this.gl;
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    post(sceneTime) {
      const gl = this.gl;
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      // bright
      this.bloomA.bind();
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      let p = this.progBright.use();
      GLU.bindTexture(gl, this.sceneTarget.color, 0);
      p.i('uTex', 0); p.f('uThreshold', 0.85);
      gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLES, 0, 3);
      // blur h
      this.bloomB.bind();
      gl.clear(gl.COLOR_BUFFER_BIT);
      p = this.progBlur.use();
      GLU.bindTexture(gl, this.bloomA.color, 0);
      p.i('uTex', 0); p.v2('uDir', 1.4 / this.bloomA.w, 0);
      gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLES, 0, 3);
      // blur v
      this.bloomA.bind();
      gl.clear(gl.COLOR_BUFFER_BIT);
      p = this.progBlur.use();
      GLU.bindTexture(gl, this.bloomB.color, 0);
      p.i('uTex', 0); p.v2('uDir', 0, 1.4 / this.bloomA.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // composite
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.w, this.h);
      p = this.progComposite.use();
      GLU.bindTexture(gl, this.sceneTarget.color, 0);
      GLU.bindTexture(gl, this.bloomA.color, 1);
      p.i('uScene', 0); p.i('uBloom', 1);
      p.f('uTime', sceneTime || 0);
      p.f('uExposure', 1.06);
      p.f('uBloomAmt', 0.55);
      p.f('uGrain', 0.020);
      p.v2('uRes', this.w, this.h);
      gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
    }

    drawSurface(mesh, model, color, opts = {}) {
      const gl = this.gl;
      const p = this.progSurface.use();
      this.setCommon(p);
      p.m4('uModel', model);
      p.m3('uNormalMat', M3.transpose(M3.invert(M4.mat3(model)) || M3.identity()));
      p.v3('uBaseColor', color);
      p.f('uMetal', opts.metal !== undefined ? opts.metal : 0.0);
      p.f('uRough', opts.rough !== undefined ? opts.rough : 0.5);
      p.f('uNoise', opts.noise !== undefined ? opts.noise : 0.0);
      p.f('uEmissive', opts.emissive || 0.0);
      p.f('uSpot', opts.spot || 0.0);
      p.v3('uAccentColor', opts.accent || [0.08, 0.07, 0.06]);
      mesh.draw(opts.count);
    }

    drawFloor(y, opts = {}) {
      if (!this.floorMesh) this.floorMesh = GLU.makePlane(this.gl, 1, 1, 1);
      const gl = this.gl;
      gl.disable(gl.CULL_FACE);
      const m = M4.mul(M4.translation(0, y, 0), M4.scaling(40, 1, 40));
      this.drawSurface(this.floorMesh, m, opts.color || [0.035, 0.041, 0.047], { metal: 0.05, rough: 0.42, noise: 0.85, spot: 1, accent: [0.045, 0.055, 0.06] });
      gl.enable(gl.CULL_FACE);
    }

    render(scene) {
      const gl = this.gl;
      this.camera.update(this.w / Math.max(1, this.h));
      this.updateLightMatrix();
      scene.prepare(this);
      this.beginShadow();
      scene.drawShadow(this, this.progDepth);
      this.endShadow();
      this.beginScene();
      scene.renderOpaque(this);
      this.copyToRefraction();
      this.beginTransparent();
      scene.renderTransparent(this);
      this.beginAdditive();
      scene.renderAdditive(this);
      this.endScene();
      this.post(scene.demoTime !== undefined ? scene.demoTime : this.time);
    }

    savePixels() {
      // force completion for deterministic export frames
      this.gl.finish();
    }
  }

  window.Renderer = Renderer;
  window.OrbitCamera = OrbitCamera;
  window.GLSL_COMMON = GLSL_COMMON;
})();
