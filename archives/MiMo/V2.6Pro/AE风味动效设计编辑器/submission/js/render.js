/* render.js — WebGL2 渲染器：三维场景/阴影/景深/2D合成/效果/运动模糊 */
(function(global) {
'use strict';

// ---------- GLSL ----------
const SH_SCENE_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uModel, uView, uProj, uLightVP;
out vec3 vWorld, vNormal;
out vec2 vUV;
out vec4 vLightPos;
void main(){
  vec4 w = uModel * vec4(aPos,1.0);
  vWorld = w.xyz;
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  vLightPos = uLightVP * w;
  gl_Position = uProj * uView * w;
}`;

const SH_SCENE_FS = `#version 300 es
precision highp float;
in vec3 vWorld, vNormal;
in vec2 vUV;
in vec4 vLightPos;
out vec4 frag;
uniform vec3 uBaseColor, uEmissiveColor, uCamPos;
uniform float uMetallic, uRoughness, uEmissive, uOpacity;
uniform vec3 uLightDir, uLightColor;
uniform float uLightIntensity;
uniform vec3 uPointPos[4], uPointColor[4];
uniform float uPointIntensity[4];
uniform int uNumPoints;
uniform float uAmbient, uEnvIntensity;
uniform sampler2D uShadowMap;
uniform float uShadowStrength;

float shadowCalc(vec4 lp, vec3 n, vec3 ld){
  vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
  if(p.z > 1.0) return 1.0;
  float bias = max(0.0025 * (1.0 - dot(n, ld)), 0.0008);
  float s = 0.0;
  vec2 texel = 1.0 / vec2(2048.0);
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++){
    float d = texture(uShadowMap, p.xy + vec2(x,y)*texel).r;
    s += (p.z - bias > d) ? 0.0 : 1.0;
  }
  return mix(1.0, s/9.0, uShadowStrength);
}

vec3 envColor(vec3 r){
  // 程序化环境：天光 + 地面 + 暖冷反射
  float t = r.y * 0.5 + 0.5;
  vec3 sky = mix(vec3(0.18,0.17,0.2), vec3(0.45,0.5,0.62), t);
  vec3 warm = vec3(1.0,0.72,0.42) * pow(max(0.0, dot(r, normalize(vec3(0.6,0.5,0.4)))), 8.0) * 1.2;
  vec3 cool = vec3(0.3,0.5,0.9) * pow(max(0.0, dot(r, normalize(vec3(-0.5,0.3,-0.6)))), 6.0) * 0.7;
  return sky + warm + cool;
}

void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 L = normalize(-uLightDir);
  vec3 H = normalize(L + V);
  float NdotL = max(0.0, dot(N, L));
  float NdotV = max(0.0, dot(N, V));
  float sh = shadowCalc(vLightPos, N, L);

  vec3 base = uBaseColor;
  float rough = clamp(uRoughness, 0.04, 1.0);
  float metal = clamp(uMetallic, 0.0, 1.0);
  vec3 F0 = mix(vec3(0.04), base, metal);

  // GGX
  float a = rough * rough;
  float a2 = a * a;
  float NdotH = max(0.0, dot(N, H));
  float denom = NdotH * NdotH * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159 * denom * denom);
  float k = (rough + 1.0); k = k * k / 8.0;
  float G = (NdotL / (NdotL * (1.0 - k) + k)) * (NdotV / (NdotV * (1.0 - k) + k));
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(0.0, dot(H, V)), 5.0);
  vec3 spec = D * G * F / (4.0 * max(0.001, NdotL * NdotV));

  vec3 diff = (1.0 - metal) * base / 3.14159;
  vec3 direct = (diff + spec) * uLightColor * uLightIntensity * NdotL * sh;

  // 点光源
  for(int i=0;i<4;i++){
    if(i >= uNumPoints) break;
    vec3 Lv = uPointPos[i] - vWorld;
    float dist = length(Lv); Lv /= max(dist, 0.001);
    float att = 1.0 / (1.0 + dist * dist * 0.00012);
    vec3 Hh = normalize(Lv + V);
    float nl = max(0.0, dot(N, Lv));
    float nh = max(0.0, dot(N, Hh));
    float d2 = nh * nh * (a2 - 1.0) + 1.0;
    float DD = a2 / (3.14159 * d2 * d2);
    direct += ((1.0 - metal) * base / 3.14159 + DD * F * 0.25) * uPointColor[i] * uPointIntensity[i] * nl * att;
  }

  // 环境
  vec3 R = reflect(-V, N);
  vec3 env = envColor(R) * uEnvIntensity;
  vec3 ambient = base * uAmbient * mix(1.0, 0.6, metal) + env * F * mix(0.25, 1.0, metal) * (1.0 - rough * 0.7);

  vec3 color = direct + ambient + uEmissiveColor * uEmissive;
  // 简单 tone
  color = color / (color + vec3(1.0));
  color = pow(color, vec3(1.0 / 2.2));
  frag = vec4(color, uOpacity);
}`;

const SH_DEPTH_VS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uModel, uLightVP;
void main(){ gl_Position = uLightVP * uModel * vec4(aPos,1.0); }`;
const SH_DEPTH_FS = `#version 300 es
precision mediump float;
out vec4 frag;
void main(){ frag = vec4(1.0); }`;

const SH_QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aUV;
out vec2 vUV;
void main(){ vUV = aUV; gl_Position = vec4(aPos,0.0,1.0); }`;

const SH_BLIT_FS = `#version 300 es
precision mediump float;
in vec2 vUV;
out vec4 frag;
uniform sampler2D uTex;
uniform float uOpacity;
void main(){ vec4 c = texture(uTex, vUV); frag = vec4(c.rgb, c.a * uOpacity); }`;

const SH_COMPOSITE_FS = `#version 300 es
precision mediump float;
in vec2 vUV;
out vec4 frag;
uniform sampler2D uTex;
uniform float uOpacity;
uniform int uBlendMode; // 0 normal 1 add 2 screen 3 multiply 4 overlay
void main(){
  vec4 c = texture(uTex, vUV);
  c.a *= uOpacity;
  frag = c;
}`;

const SH_BLUR_FS = `#version 300 es
precision mediump float;
in vec2 vUV;
out vec4 frag;
uniform sampler2D uTex;
uniform vec2 uDir;
uniform float uRadius;
void main(){
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  for(int i=-6;i<=6;i++){
    float w = exp(-float(i*i) / 18.0);
    sum += texture(uTex, vUV + uDir * float(i) * uRadius / 6.0) * w;
    wsum += w;
  }
  frag = sum / wsum;
}`;

const SH_GLOW_FS = `#version 300 es
precision mediump float;
in vec2 vUV;
out vec4 frag;
uniform sampler2D uScene, uBlur;
uniform float uIntensity, uThreshold;
void main(){
  vec4 s = texture(uScene, vUV);
  vec4 b = texture(uBlur, vUV);
  float lum = dot(b.rgb, vec3(0.299,0.587,0.114));
  float m = max(0.0, lum - uThreshold) * uIntensity;
  frag = s + vec4(b.rgb * m, b.a * m);
}`;

const SH_DOF_FS = `#version 300 es
precision mediump float;
in vec2 vUV;
out vec4 frag;
uniform sampler2D uScene, uBlur, uDepth;
uniform float uFocus, uAperture, uMaxCoC;
uniform vec2 uResolution;
float linearize(float d){
  float n = 10.0, f = 6000.0;
  float z = d * 2.0 - 1.0;
  return (2.0 * n * f) / (f + n - z * (f - n));
}
void main(){
  vec4 s = texture(uScene, vUV);
  float d = linearize(texture(uDepth, vUV).r);
  float coc = clamp(abs(d - uFocus) / max(uFocus, 1.0) * uAperture * 0.02, 0.0, 1.0) * uMaxCoC;
  vec4 b = texture(uBlur, vUV);
  frag = mix(s, b, clamp(coc, 0.0, 1.0));
}`;

const SH_PART_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 iPos;
layout(location=2) in vec3 iColor;
layout(location=3) in vec2 iSizeAlpha;
uniform mat4 uView, uProj;
out vec2 vUV;
out vec3 vColor;
out float vAlpha;
void main(){
  vec4 vp = uView * vec4(iPos, 1.0);
  vp.xy += aCorner * iSizeAlpha.x;
  gl_Position = uProj * vp;
  vUV = aCorner * 0.5 + 0.5;
  vColor = iColor;
  vAlpha = iSizeAlpha.y;
}`;

const SH_PART_FS = `#version 300 es
precision mediump float;
in vec2 vUV;
in vec3 vColor;
in float vAlpha;
out vec4 frag;
void main(){
  float d = length(vUV - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.1, d) * vAlpha;
  frag = vec4(vColor * a, a);
}`;

const SH_LINE_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aColor;
uniform mat4 uView, uProj;
out vec4 vColor;
void main(){
  gl_Position = uProj * uView * vec4(aPos, 1.0);
  vColor = aColor;
}`;
const SH_LINE_FS = `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 frag;
void main(){ frag = vColor; }`;

// ---------- 渲染器 ----------
const R = {};

R.init = function(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: true, premultipliedAlpha: false,
    preserveDrawingBuffer: true, depth: true
  });
  if (!gl) throw new Error('需要 WebGL2');
  R.gl = gl;
  R.canvas = canvas;

  R.progScene = compile(gl, SH_SCENE_VS, SH_SCENE_FS);
  R.progDepth = compile(gl, SH_DEPTH_VS, SH_DEPTH_FS);
  R.progBlit = compile(gl, SH_QUAD_VS, SH_BLIT_FS);
  R.progBlur = compile(gl, SH_QUAD_VS, SH_BLUR_FS);
  R.progGlow = compile(gl, SH_QUAD_VS, SH_GLOW_FS);
  R.progDOF = compile(gl, SH_QUAD_VS, SH_DOF_FS);
  R.progPart = compile(gl, SH_PART_VS, SH_PART_FS);
  R.progLine = compile(gl, SH_LINE_VS, SH_LINE_FS);

  // 全屏四边形
  R.quadVAO = gl.createVertexArray();
  gl.bindVertexArray(R.quadVAO);
  const qb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const quv = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quv);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // 粒子四边形
  R.partVAO = gl.createVertexArray();
  gl.bindVertexArray(R.partVAO);
  const cb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  R.partInstanceBuf = gl.createBuffer();
  gl.bindVertexArray(null);

  // 阴影贴图
  const SHADOW = 2048;
  R.shadowTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, R.shadowTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW, SHADOW, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  R.shadowFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, R.shadowFBO);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, R.shadowTex, 0);
  gl.drawBuffers([gl.NONE]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  R.w = canvas.width; R.h = canvas.height;
  R._makeSceneFBO(R.w, R.h);
  R._2dCanvas = document.createElement('canvas');
  R._2dCtx = R._2dCanvas.getContext('2d');
  R.texCache = new Map();
  return R;
};

R._makeSceneFBO = function(w, h) {
  const gl = R.gl;
  w = Math.max(2, w | 0); h = Math.max(2, h | 0);
  if (R.sceneFBO && R._sceneW === w && R._sceneH === h) return;
  R._sceneW = w; R._sceneH = h;
  [R.sceneFBO, R.sceneColor, R.sceneDepthTex, R.tempFBO, R.tempColor, R.blurFBO, R.blurColor].forEach(x => {
    if (x && x.delete) { try { x.delete(); } catch (e) {} }
  });
  R.sceneColor = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, R.sceneColor);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  R.sceneDepthTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, R.sceneDepthTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  R.sceneFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, R.sceneFBO);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, R.sceneColor, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, R.sceneDepthTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const mk = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo: f, tex: t };
  };
  const a = mk(), b = mk();
  R.tempFBO = a.fbo; R.tempColor = a.tex;
  R.blurFBO = b.fbo; R.blurColor = b.tex;
};

R.resize = function(w, h) {
  R.canvas.width = w; R.canvas.height = h;
  R.w = w; R.h = h;
  R._makeSceneFBO(w, h);
  R.gl.viewport(0, 0, w, h);
};

function compile(gl, vs, fs) {
  const p = gl.createProgram();
  const v = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(v, vs); gl.compileShader(v);
  if (!gl.getShaderParameter(v, gl.COMPILE_STATUS)) throw new Error('VS: ' + gl.getShaderInfoLog(v));
  const f = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(f, fs); gl.compileShader(f);
  if (!gl.getShaderParameter(f, gl.COMPILE_STATUS)) throw new Error('FS: ' + gl.getShaderInfoLog(f));
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  p.u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    p.u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
  }
  return p;
}

// ---------- 网格上传 ----------
R.uploadMesh = function(mesh) {
  const gl = R.gl;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const pb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pb);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const nb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, nb);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  // uv 占位
  const uv = new Float32Array((mesh.positions.length / 3) * 2);
  const ub = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ub);
  gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: mesh.indices.length, indexType: gl.UNSIGNED_INT };
};

R.drawMesh = function(meshGpu) {
  const gl = R.gl;
  gl.bindVertexArray(meshGpu.vao);
  gl.drawElements(gl.TRIANGLES, meshGpu.count, meshGpu.indexType, 0);
  gl.bindVertexArray(null);
};

// ---------- 纹理（2D 层内容） ----------
R.updateTexture = function(key, canvas) {
  const gl = R.gl;
  let tex = R.texCache.get(key);
  if (!tex) { tex = gl.createTexture(); R.texCache.set(key, tex); }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
};

// ---------- 绘制辅助 ----------
R._fullQuad = function() {
  const gl = R.gl;
  gl.bindVertexArray(R.quadVAO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
};

R.blitToScreen = function(tex, opacity = 1) {
  const gl = R.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, R.w, R.h);
  gl.useProgram(R.progBlit);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(R.progBlit.u.uTex, 0);
  gl.uniform1f(R.progBlit.u.uOpacity, opacity);
  R._fullQuad();
};

// 将纹理以 blend 模式画到当前 FBO（用固定功能混合）
R.compositeTex = function(tex, blendMode, opacity) {
  const gl = R.gl;
  gl.enable(gl.BLEND);
  switch (blendMode) {
    case 'add': case 'additive': gl.blendFunc(gl.SRC_ALPHA, gl.ONE); break;
    case 'screen': gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR); break;
    case 'multiply': gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA); break;
    case 'overlay': gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); break;
    default: gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  gl.useProgram(R.progBlit);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(R.progBlit.u.uTex, 0);
  gl.uniform1f(R.progBlit.u.uOpacity, opacity);
  R._fullQuad();
  gl.disable(gl.BLEND);
};

R.blurTexture = function(srcTex, radius, w, h) {
  const gl = R.gl;
  // 横向
  gl.bindFramebuffer(gl.FRAMEBUFFER, R.tempFBO);
  gl.viewport(0, 0, w, h);
  gl.useProgram(R.progBlur);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.uniform1i(R.progBlur.u.uTex, 0);
  gl.uniform2f(R.progBlur.u.uDir, 1 / w, 0);
  gl.uniform1f(R.progBlur.u.uRadius, radius);
  R._fullQuad();
  // 纵向
  gl.bindFramebuffer(gl.FRAMEBUFFER, R.blurFBO);
  gl.useProgram(R.progBlur);
  gl.bindTexture(gl.TEXTURE_2D, R.tempColor);
  gl.uniform2f(R.progBlur.u.uDir, 0, 1 / h);
  R._fullQuad();
  return R.blurColor;
};

// ---------- 阴影 ----------
R.renderShadow = function(items, lightDir, lightVP) {
  const gl = R.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, R.shadowFBO);
  gl.viewport(0, 0, 2048, 2048);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(2.0, 4.0);
  gl.useProgram(R.progDepth);
  gl.uniformMatrix4fv(R.progDepth.u.uLightVP, false, lightVP);
  items.forEach(it => {
    if (!it.meshGpu || it.castShadow === false) return;
    gl.uniformMatrix4fv(R.progDepth.u.uModel, false, it.model);
    R.drawMesh(it.meshGpu);
  });
  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

// ---------- 三维场景 ----------
R.renderScene = function(items, cam, light, points, opts = {}) {
  const gl = R.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, R.sceneFBO);
  gl.viewport(0, 0, R._sceneW, R._sceneH);
  const bg = opts.bg || { r: 0.06, g: 0.06, b: 0.08, a: 1 };
  gl.clearColor(bg.r, bg.g, bg.b, bg.a);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  gl.useProgram(R.progScene);
  gl.uniformMatrix4fv(R.progScene.u.uView, false, cam.view);
  gl.uniformMatrix4fv(R.progScene.u.uProj, false, cam.proj);
  gl.uniformMatrix4fv(R.progScene.u.uLightVP, false, light.vp);
  gl.uniform3f(R.progScene.u.uCamPos, cam.pos.x, cam.pos.y, cam.pos.z);
  gl.uniform3f(R.progScene.u.uLightDir, light.dir.x, light.dir.y, light.dir.z);
  gl.uniform3f(R.progScene.u.uLightColor, light.color.r, light.color.g, light.color.b);
  gl.uniform1f(R.progScene.u.uLightIntensity, light.intensity);
  gl.uniform1f(R.progScene.u.uAmbient, opts.ambient != null ? opts.ambient : 0.28);
  gl.uniform1f(R.progScene.u.uEnvIntensity, opts.envIntensity != null ? opts.envIntensity : 1.0);
  gl.uniform1f(R.progScene.u.uShadowStrength, light.castsShadow ? 1.0 : 0.0);

  const pts = points || [];
  for (let i = 0; i < 4; i++) {
    const p = pts[i];
    const locPos = gl.getUniformLocation(R.progScene, `uPointPos[${i}]`);
    const locCol = gl.getUniformLocation(R.progScene, `uPointColor[${i}]`);
    const locInt = gl.getUniformLocation(R.progScene, `uPointIntensity[${i}]`);
    if (p) {
      gl.uniform3f(locPos, p.pos.x, p.pos.y, p.pos.z);
      gl.uniform3f(locCol, p.color.r, p.color.g, p.color.b);
      gl.uniform1f(locInt, p.intensity);
    } else {
      gl.uniform3f(locPos, 0, 0, 0);
      gl.uniform3f(locCol, 0, 0, 0);
      gl.uniform1f(locInt, 0);
    }
  }
  gl.uniform1i(R.progScene.u.uNumPoints, Math.min(4, pts.length));

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, R.shadowTex);
  gl.uniform1i(R.progScene.u.uShadowMap, 0);

  items.forEach(it => {
    if (!it.meshGpu) return;
    gl.uniformMatrix4fv(R.progScene.u.uModel, false, it.model);
    const m = it.material || {};
    gl.uniform3f(R.progScene.u.uBaseColor, m.baseColor ? m.baseColor[0] : 0.8, m.baseColor ? m.baseColor[1] : 0.8, m.baseColor ? m.baseColor[2] : 0.85);
    gl.uniform3f(R.progScene.u.uEmissiveColor, m.emissiveColor ? m.emissiveColor[0] : 1, m.emissiveColor ? m.emissiveColor[1] : 0.55, m.emissiveColor ? m.emissiveColor[2] : 0.2);
    gl.uniform1f(R.progScene.u.uMetallic, m.metallic != null ? m.metallic : 0.8);
    gl.uniform1f(R.progScene.u.uRoughness, m.roughness != null ? m.roughness : 0.35);
    gl.uniform1f(R.progScene.u.uEmissive, m.emissive != null ? m.emissive : 0);
    gl.uniform1f(R.progScene.u.uOpacity, m.opacity != null ? m.opacity : 1);
    if (m.opacity != null && m.opacity < 0.99) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      R.drawMesh(it.meshGpu);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    } else {
      R.drawMesh(it.meshGpu);
    }
  });
};

// ---------- 粒子 ----------
R.renderParticles = function(particles, cam, opts = {}) {
  const gl = R.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, R.sceneFBO);
  gl.viewport(0, 0, R._sceneW, R._sceneH);
  gl.useProgram(R.progPart);
  gl.uniformMatrix4fv(R.progPart.u.uView, false, cam.view);
  gl.uniformMatrix4fv(R.progPart.u.uProj, false, cam.proj);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.depthMask(false);
  gl.disable(gl.CULL_FACE);

  const n = particles.length;
  if (n > 0) {
    const data = new Float32Array(n * 7);
    particles.forEach((p, i) => {
      const o = i * 7;
      data[o] = p.x; data[o + 1] = p.y; data[o + 2] = p.z;
      data[o + 3] = p.r; data[o + 4] = p.g; data[o + 5] = p.b;
      data[o + 6] = p.size * (opts.sizeScale || 1);
      // alpha 存到 size 后面？扩展
    });
    // 重新打包：pos3 color3 size1 alpha1 = 8
    const d2 = new Float32Array(n * 8);
    particles.forEach((p, i) => {
      const o = i * 8;
      d2[o] = p.x; d2[o + 1] = p.y; d2[o + 2] = p.z;
      d2[o + 3] = p.r; d2[o + 4] = p.g; d2[o + 5] = p.b;
      d2[o + 6] = p.size * (opts.sizeScale || 1);
      d2[o + 7] = p.alpha != null ? p.alpha : 1;
    });
    gl.bindVertexArray(R.partVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.partInstanceBuf);
    gl.bufferData(gl.ARRAY_BUFFER, d2, gl.DYNAMIC_DRAW);
    const stride = 32;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 12);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 24);
    gl.vertexAttribDivisor(3, 1);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.vertexAttribDivisor(1, 0);
    gl.vertexAttribDivisor(2, 0);
    gl.vertexAttribDivisor(3, 0);
    gl.bindVertexArray(null);
  }

  // 拖尾
  if (opts.trails !== false) {
    const lines = [];
    particles.forEach(p => {
      if (!p.trail || p.trail.length < 2) return;
      const len = Math.min(p.trail.length, opts.trailLength || 12);
      for (let k = 0; k < len - 1; k++) {
        const a = p.trail.get(k), b = p.trail.get(k + 1);
        const fade = 1 - k / len;
        lines.push(a.x, a.y, a.z, p.r, p.g, p.b, fade * 0.7 * p.alpha);
        lines.push(b.x, b.y, b.z, p.r, p.g, p.b, fade * 0.7 * p.alpha);
      }
    });
    if (lines.length) {
      gl.useProgram(R.progLine);
      gl.uniformMatrix4fv(R.progLine.u.uView, false, cam.view);
      gl.uniformMatrix4fv(R.progLine.u.uProj, false, cam.proj);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
      gl.drawArrays(gl.LINES, 0, lines.length / 7);
      gl.deleteBuffer(buf);
    }
  }

  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.enable(gl.CULL_FACE);
};

// ---------- 景深 + 光晕后处理 ----------
R.postProcess = function(opts = {}) {
  const gl = R.gl;
  const w = R._sceneW, h = R._sceneH;
  // blur scene
  const blurred = R.blurTexture(R.sceneColor, opts.blurRadius || 3, w, h);

  if (opts.dof && opts.dof.aperture > 0.01) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.tempFBO);
    gl.viewport(0, 0, w, h);
    gl.useProgram(R.progDOF);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, R.sceneColor);
    gl.uniform1i(R.progDOF.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, R.blurColor);
    gl.uniform1i(R.progDOF.u.uBlur, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, R.sceneDepthTex);
    gl.uniform1i(R.progDOF.u.uDepth, 2);
    gl.uniform1f(R.progDOF.u.uFocus, opts.dof.focus);
    gl.uniform1f(R.progDOF.u.uAperture, opts.dof.aperture);
    gl.uniform1f(R.progDOF.u.uMaxCoC, opts.dof.maxCoC != null ? opts.dof.maxCoC : 1.0);
    gl.uniform2f(R.progDOF.u.uResolution, w, h);
    R._fullQuad();
    // copy temp → scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.sceneFBO);
    gl.useProgram(R.progBlit);
    gl.bindTexture(gl.TEXTURE_2D, R.tempColor);
    gl.uniform1i(R.progBlit.u.uTex, 0);
    gl.uniform1f(R.progBlit.u.uOpacity, 1);
    R._fullQuad();
  }

  if (opts.glow && opts.glow.intensity > 0.01) {
    const gb = R.blurTexture(R.sceneColor, opts.glow.radius || 8, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.tempFBO);
    gl.viewport(0, 0, w, h);
    gl.useProgram(R.progGlow);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, R.sceneColor);
    gl.uniform1i(R.progGlow.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gb);
    gl.uniform1i(R.progGlow.u.uBlur, 1);
    gl.uniform1f(R.progGlow.u.uIntensity, opts.glow.intensity);
    gl.uniform1f(R.progGlow.u.uThreshold, opts.glow.threshold != null ? opts.glow.threshold : 0.35);
    R._fullQuad();
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.sceneFBO);
    gl.useProgram(R.progBlit);
    gl.bindTexture(gl.TEXTURE_2D, R.tempColor);
    gl.uniform1i(R.progBlit.u.uTex, 0);
    gl.uniform1f(R.progBlit.u.uOpacity, 1);
    R._fullQuad();
  }
};

R.sceneColorTex = () => R.sceneColor;
R.getSceneCanvasSize = () => ({ w: R._sceneW, h: R._sceneH });

global.Renderer = R;
})(window);
