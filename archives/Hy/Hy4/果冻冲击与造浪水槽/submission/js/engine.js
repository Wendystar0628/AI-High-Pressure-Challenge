/* ============================================================
   engine.js — 共享渲染引擎 / 材质 / 灯光 / 音效 / 相机
   依赖：three.min.js (UMD, 全局 THREE)
   ============================================================ */
(function (global) {
'use strict';
var T = global.THREE;
var JW = global.JW = global.JW || {};

/* ---------------- 工具 ---------------- */
var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
var lerp = function (a, b, t) { return a + (b - a) * t; };
var smoothstep = function (e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
var TAU = Math.PI * 2;

function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
JW.util = { clamp: clamp, lerp: lerp, smoothstep: smoothstep, TAU: TAU, mulberry32: mulberry32 };

/* ---------------- 共享 uniforms ---------------- */
try { if (T.ColorManagement) T.ColorManagement.legacyMode = true; } catch (e) {}

var U = JW.U = {
  uCam:        { value: new T.Vector3() },
  uTime:       { value: 0 },
  uLightDir:   { value: new T.Vector3(-0.52, 0.88, 0.66).normalize() },
  uLightColor: { value: new T.Color(1.00, 0.95, 0.86) },
  uFillDir:    { value: new T.Vector3(0.82, 0.42, -0.42).normalize() },
  uFillColor:  { value: new T.Color(0.40, 0.62, 1.00) },
  uRimDir:     { value: new T.Vector3(0.05, 0.30, -1.0).normalize() },
  uAmbient:    { value: new T.Color(0.26, 0.33, 0.46) }
};
function uniforms(extra) {
  var o = {};
  for (var k in U) o[k] = U[k];
  if (extra) for (var j in extra) o[j] = extra[j];
  return o;
}
JW.uniforms = uniforms;

/* ---------------- GLSL 片段 ---------------- */
var GLSL_COMMON = [
'uniform vec3 uCam;',
'uniform float uTime;',
'uniform vec3 uLightDir;',
'uniform vec3 uLightColor;',
'uniform vec3 uFillDir;',
'uniform vec3 uFillColor;',
'uniform vec3 uRimDir;',
'uniform vec3 uAmbient;'
].join('\n');

var GLSL_SHADE = [
'vec3 shade(vec3 N, vec3 V, vec3 base, float gloss, float specK){',
'  vec3 L = normalize(uLightDir), L2 = normalize(uFillDir), R = normalize(uRimDir);',
'  float d  = max(dot(N,L),0.0);',
'  float d2 = max(dot(N,L2),0.0);',
'  float rim = pow(max(dot(N,R),0.0), 2.0);',
'  vec3 H = normalize(L+V), H2 = normalize(L2+V);',
'  float s  = pow(max(dot(N,H),0.0), gloss);',
'  float s2 = pow(max(dot(N,H2),0.0), gloss*1.25);',
'  vec3 col = base * (uAmbient + uLightColor*d*1.02 + uFillColor*d2*0.42 + uFillColor*rim*0.16);',
'  col += uLightColor*s*specK + uFillColor*s2*specK*0.42;',
'  return col;',
'}'
].join('\n');
JW.GLSL = { COMMON: GLSL_COMMON, SHADE: GLSL_SHADE };

function shaderMat(opt) {
  return new T.ShaderMaterial({
    uniforms: opt.uniforms,
    vertexShader: opt.vertexShader,
    fragmentShader: opt.fragmentShader,
    transparent: opt.transparent !== false,
    depthWrite: !!opt.depthWrite,
    depthTest: opt.depthTest !== false,
    side: opt.side !== undefined ? opt.side : T.FrontSide,
    blending: opt.blending !== undefined ? opt.blending : T.NormalBlending
  });
}
JW.shaderMat = shaderMat;

/* ---------------- 程序化环境贴图（金属/清漆反射） ---------------- */
function makeEnvTexture() {
  var w = 256, h = 128;
  var data = new Uint8Array(w * h * 4);
  function setUV(u, v, r, g, b) {
    var x = clamp(Math.floor(u * w), 0, w - 1), y = clamp(Math.floor(v * h), 0, h - 1);
    var i = (y * w + x) * 4;
    data[i] = clamp(r, 0, 255); data[i + 1] = clamp(g, 0, 255); data[i + 2] = clamp(b, 0, 255); data[i + 3] = 255;
  }
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var u = x / w, v = y / h;
      var up = 1 - v;
      var r, g, b;
      if (up > 0.5) {
        var t = (up - 0.5) / 0.5;
        r = lerp(92, 196, t); g = lerp(122, 216, t); b = lerp(158, 240, t);
      } else {
        var t2 = up / 0.5;
        r = lerp(20, 92, t2); g = lerp(30, 122, t2); b = lerp(44, 158, t2);
      }
      // 柔光箱 1（主）：左上偏前
      var d1 = Math.pow(Math.max(0, Math.cos((u - 0.22) * TAU) * Math.cos((v - 0.30) * 6.0)), 22);
      // 柔光箱 2（辅）：右侧
      var d2 = Math.pow(Math.max(0, Math.cos((u - 0.72) * TAU) * Math.cos((v - 0.36) * 6.0)), 28);
      var boost = d1 * 150 + d2 * 95;
      var i = (y * w + x) * 4;
      data[i] = clamp(r + boost, 0, 255);
      data[i + 1] = clamp(g + boost * 0.98, 0, 255);
      data[i + 2] = clamp(b + boost * 0.92, 0, 255);
      data[i + 3] = 255;
    }
  }
  setUV(0.5, 0.5, 255, 255, 255);
  var tex = new T.DataTexture(data, w, h, T.RGBAFormat);
  tex.mapping = T.EquirectangularReflectionMapping;
  if (T.sRGBEncoding !== undefined) tex.encoding = T.sRGBEncoding;
  tex.needsUpdate = true;
  return tex;
}

function makeBackgroundTexture() {
  var c = document.createElement('canvas'); c.width = 512; c.height = 512;
  var g = c.getContext('2d');
  var grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0.00, '#070c15');
  grd.addColorStop(0.42, '#101c2e');
  grd.addColorStop(0.68, '#16263c');
  grd.addColorStop(1.00, '#080e18');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  var rg = g.createRadialGradient(256, 320, 10, 256, 320, 330);
  rg.addColorStop(0, 'rgba(88,150,205,0.20)');
  rg.addColorStop(0.55, 'rgba(52,100,150,0.07)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
  var vg = g.createRadialGradient(256, 256, 130, 256, 256, 370);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.46)');
  g.fillStyle = vg; g.fillRect(0, 0, 512, 512);
  var tex = new T.CanvasTexture(c);
  if (T.sRGBEncoding !== undefined) tex.encoding = T.sRGBEncoding;
  return tex;
}

/* ---------------- Stage ---------------- */
function Stage(canvas) {
  this.canvas = canvas;
  var renderer = this.renderer = new T.WebGLRenderer({
    canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(1);
  renderer.outputEncoding = (T.sRGBEncoding !== undefined) ? T.sRGBEncoding : renderer.outputEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.autoClear = true;

  var scene = this.scene = new T.Scene();
  scene.background = makeBackgroundTexture();

  var pmrem = new T.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  try {
    var eq = makeEnvTexture();
    var rt = pmrem.fromEquirectangular(eq);
    scene.environment = rt.texture;
    eq.dispose();
  } catch (e) { console.warn('env map failed', e); }
  pmrem.dispose();

  var camera = this.camera = new T.PerspectiveCamera(40, 1, 0.1, 120);
  camera.position.set(7, 7, 12);

  var hemi = new T.HemisphereLight(0x9dc4ff, 0x121a27, 0.62);
  scene.add(hemi);

  var key = this.keyLight = new T.DirectionalLight(0xfff1de, 2.15);
  key.position.set(-6.5, 12, 7.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1; key.shadow.camera.far = 42;
  key.shadow.camera.left = -10; key.shadow.camera.right = 10;
  key.shadow.camera.top = 10; key.shadow.camera.bottom = -10;
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.025;
  key.shadow.radius = 3;
  scene.add(key);

  var fill = new T.DirectionalLight(0x86b4ff, 0.78);
  fill.position.set(8, 5.5, -4); scene.add(fill);

  var rim = new T.DirectionalLight(0xbfe6ff, 0.62);
  rim.position.set(0.5, 3.5, -10); scene.add(rim);

  // 舞台地面（暗色，中心微亮、边缘融入背景）
  var groundMat = new T.MeshStandardMaterial({
    color: 0x070c15, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.02
  });
  var ground = new T.Mesh(new T.CylinderGeometry(11, 11, 0.18, 100), groundMat);
  ground.position.y = -0.16; ground.receiveShadow = true; scene.add(ground);

  var topMat = new T.MeshStandardMaterial({
    color: 0x0e1a2a, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.05,
    transparent: true, opacity: 0.99
  });
  topMat.onBeforeCompile = function (sh) {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;');
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\nfloat rd = length(vWP.xz)/10.9;\ndiffuseColor.rgb *= mix(0.30, 0.015, smoothstep(0.10, 0.95, rd));');
  };
  var topDisc = new T.Mesh(new T.CircleGeometry(10.9, 100), topMat);
  topDisc.rotation.x = -Math.PI / 2; topDisc.position.y = -0.065; topDisc.receiveShadow = true; scene.add(topDisc);

  // 同心装饰环
  var ringGroup = new T.Group();
  for (var i = 0; i < 5; i++) {
    var rr = 2.1 + i * 1.75;
    var pts = [];
    for (var s = 0; s <= 128; s++) {
      var a = s / 128 * TAU;
      pts.push(new T.Vector3(Math.cos(a) * rr, -0.058, Math.sin(a) * rr));
    }
    var lg = new T.BufferGeometry().setFromPoints(pts);
    ringGroup.add(new T.Line(lg, new T.LineBasicMaterial({ color: 0x5c86b4, transparent: true, opacity: 0.10 - i * 0.012 })));
  }
  scene.add(ringGroup);

  // 地面柔光
  var glow = new T.Mesh(new T.PlaneGeometry(20, 20), new T.ShaderMaterial({
    uniforms: {},
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv; void main(){float d=length(vUv-0.5)*2.0;float a=pow(max(0.0,1.0-d),2.6)*0.10;gl_FragColor=vec4(vec3(0.34,0.60,0.86)*a,a);}',
    transparent: true, depthWrite: false, blending: T.AdditiveBlending
  }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.05; scene.add(glow);

  this.subjects = {};
  this.subjectName = '';
  this.rig = new CameraRig(camera, canvas);
  this._fit = { halfW: 5, halfH: 4, targetY: 2.0 };
  this.resize();
}
JW.Stage = Stage;

Stage.prototype.addSubject = function (name, group) {
  this.subjects[name] = group;
  this.scene.add(group);
  group.visible = false;
};
Stage.prototype.setSubject = function (name) {
  for (var k in this.subjects) this.subjects[k].visible = (k === name);
  this.subjectName = name;
};
Stage.prototype.setFit = function (halfW, halfH, targetY) {
  this._fit.halfW = halfW; this._fit.halfH = halfH; this._fit.targetY = targetY;
  this.rig.setTarget(0, targetY, 0);
  this.resize();
};
Stage.prototype.resize = function () {
  var w = global.innerWidth || 1280, h = global.innerHeight || 720;
  this.renderer.setSize(w, h, false);
  var aspect = w / h;
  this.camera.aspect = aspect;
  var vFov = this.camera.fov * Math.PI / 180;
  var hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  var dV = this._fit.halfH / Math.tan(vFov / 2);
  var dH = this._fit.halfW / Math.tan(hFov / 2);
  this.rig.distance = Math.max(dV, dH) * 1.06;
  this.camera.updateProjectionMatrix();
  this.rig.apply();
};
Stage.prototype.render = function (time) {
  U.uTime.value = time;
  U.uCam.value.copy(this.camera.position);
  this.rig.apply();
  this.renderer.render(this.scene, this.camera);
};

/* ---------------- 相机控制器 ---------------- */
function CameraRig(camera, dom) {
  this.camera = camera; this.dom = dom;
  this.azimuth = 0.40; this.polar = 1.16;
  this.tAzimuth = 0.40; this.tPolar = 1.16;
  this.distance = 12;
  this.target = new T.Vector3(0, 2, 0);
  this.tTarget = new T.Vector3(0, 2, 0);
  this.enabled = true;
  this.drift = 0;
  var self = this, dragging = false, lx = 0, ly = 0;
  dom.addEventListener('pointerdown', function (e) {
    if (!self.enabled) return;
    dragging = true; lx = e.clientX; ly = e.clientY;
    try { dom.setPointerCapture(e.pointerId); } catch (err) {}
  });
  dom.addEventListener('pointermove', function (e) {
    if (!dragging || !self.enabled) return;
    self.tAzimuth -= (e.clientX - lx) * 0.005;
    self.tPolar = clamp(self.tPolar - (e.clientY - ly) * 0.004, 0.42, 1.48);
    lx = e.clientX; ly = e.clientY;
  });
  var up = function () { dragging = false; };
  dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
  dom.addEventListener('wheel', function (e) {
    if (!self.enabled) return;
    e.preventDefault();
    self.distance = clamp(self.distance * (1 + Math.sign(e.deltaY) * 0.07), 6, 30);
  }, { passive: false });
}
JW.CameraRig = CameraRig;
CameraRig.prototype.setTarget = function (x, y, z) { this.tTarget.set(x, y, z); this.target.copy(this.tTarget); };
CameraRig.prototype.setView = function (az, pol) { this.tAzimuth = this.azimuth = az; this.tPolar = this.polar = pol; };
CameraRig.prototype.apply = function () {
  this.azimuth += (this.tAzimuth + this.drift - this.azimuth) * 0.09;
  this.polar += (this.tPolar - this.polar) * 0.09;
  this.target.lerp(this.tTarget, 0.09);
  var sp = Math.sin(this.polar), cp = Math.cos(this.polar);
  this.camera.position.set(
    this.target.x + this.distance * sp * Math.sin(this.azimuth),
    this.target.y + this.distance * cp,
    this.target.z + this.distance * sp * Math.cos(this.azimuth)
  );
  this.camera.lookAt(this.target);
};

/* ---------------- 材质工厂 ---------------- */
var VERT_WORLD = [
'varying vec3 vN;',
'varying vec3 vW;',
'void main(){',
'  vec4 wp = modelMatrix * vec4(position,1.0);',
'  vW = wp.xyz;',
'  vN = normalize(mat3(modelMatrix) * normal);',
'  gl_Position = projectionMatrix * viewMatrix * wp;',
'}'
].join('\n');

/* 果冻：半透明、菲涅尔轮廓、内部条纹随形变弯曲 */
JW.jellyMaterial = function (side) {
  var u = uniforms({
    uColorA: { value: new T.Color(0.16, 0.78, 0.66) },
    uColorB: { value: new T.Color(0.30, 0.52, 0.95) },
    uOpacity: { value: 0.34 },
    uHeight: { value: 1.3 }
  });
  return shaderMat({
    uniforms: u, side: side,
    vertexShader: [
      'attribute vec3 aRest;',
      'varying vec3 vN; varying vec3 vW; varying vec3 vR;',
      'void main(){',
      '  vec4 wp = modelMatrix * vec4(position,1.0);',
      '  vW = wp.xyz; vR = aRest;',
      '  vN = normalize(mat3(modelMatrix) * normal);',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_COMMON, GLSL_SHADE,
      'uniform vec3 uColorA; uniform vec3 uColorB; uniform float uOpacity; uniform float uHeight;',
      'varying vec3 vN; varying vec3 vW; varying vec3 vR;',
      'void main(){',
      '  vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;',
      '  vec3 V = normalize(uCam - vW);',
      '  float fres = pow(1.0 - max(dot(N,V),0.0), 2.3);',
      '  float hy = clamp(vR.y / max(uHeight,0.001), 0.0, 1.0);',
      '  vec3 base = mix(uColorA, uColorB, hy*0.72);',
      '  vec3 col = shade(N, V, base, 46.0, 0.85);',
      // 内部层纹：沿静止坐标，随形变弯曲，直观显示形变传播
      '  float band = abs(fract(vR.y*3.1) - 0.5);',
      '  float line = 1.0 - smoothstep(0.0, 0.055, band);',
      '  float band2 = abs(fract((vR.x+vR.z)*1.15) - 0.5);',
      '  float line2 = 1.0 - smoothstep(0.0, 0.028, band2);',
      '  col += base*line*0.20 + vec3(0.85,0.95,1.0)*line2*0.045;',
      '  col += vec3(0.55,0.92,1.0)*fres*0.42;',
      '  float alpha = clamp(uOpacity + fres*0.46 + line*0.05, 0.0, 0.97);',
      '  gl_FragColor = vec4(col, alpha);',
      '}'
    ].join('\n')
  });
};

/* 水面 */
JW.waterSurfaceMaterial = function () {
  var u = uniforms({
    uWaterLevel: { value: 2.4 },
    uShallow: { value: new T.Color(0.22, 0.68, 0.82) },
    uDeep: { value: new T.Color(0.05, 0.24, 0.45) }
  });
  return shaderMat({
    uniforms: u, side: T.DoubleSide,
    vertexShader: [
      'attribute float aH;',
      'varying vec3 vN; varying vec3 vW; varying float vH;',
      'void main(){',
      '  vec4 wp = modelMatrix * vec4(position,1.0);',
      '  vW = wp.xyz; vH = aH;',
      '  vN = normalize(mat3(modelMatrix) * normal);',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_COMMON, GLSL_SHADE,
      'uniform vec3 uShallow; uniform vec3 uDeep; uniform float uWaterLevel;',
      'varying vec3 vN; varying vec3 vW; varying float vH;',
      'void main(){',
      '  vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;',
      '  vec3 V = normalize(uCam - vW);',
      '  float fres = pow(1.0 - max(dot(N,V),0.0), 3.0);',
      '  float foam = smoothstep(0.085, 0.24, vH) * 0.55 + smoothstep(0.20,0.42,vH)*0.45;',
      '  vec3 base = mix(uDeep, uShallow, clamp(N.y*0.55+0.45,0.0,1.0));',
      '  vec3 col = shade(N, V, base, 92.0, 1.05);',
      '  col += vec3(0.62,0.88,1.0)*fres*0.62;',
      '  col += vec3(0.92,0.98,1.0)*foam*0.42;',
      '  vec3 H = normalize(normalize(uLightDir)+V);',
      '  col += uLightColor * pow(max(dot(N,H),0.0), 190.0)*1.55;',
      '  float sp2 = pow(max(0.0, sin(vW.x*7.0+uTime*2.4)*sin(vW.z*9.0-uTime*1.7)), 24.0);',
      '  col += vec3(0.8,0.95,1.0)*sp2*0.10;',
      '  float alpha = clamp(0.36 + fres*0.46 + foam*0.24, 0.0, 0.94);',
      '  gl_FragColor = vec4(col, alpha);',
      '}'
    ].join('\n')
  });
};

/* 水体（体积） */
JW.waterBodyMaterial = function (alphaScale) {
  var u = uniforms({
    uLevel: { value: 2.4 }, uTint: { value: new T.Color(0.06, 0.34, 0.55) },
    uAlpha: { value: alphaScale === undefined ? 1 : alphaScale }
  });
  return shaderMat({
    uniforms: u, side: T.DoubleSide,
    vertexShader: VERT_WORLD,
    fragmentShader: [
      GLSL_COMMON,
      'uniform vec3 uTint; uniform float uLevel; uniform float uAlpha;',
      'varying vec3 vN; varying vec3 vW;',
      'void main(){',
      '  vec3 N = normalize(vN); vec3 V = normalize(uCam-vW);',
      '  float fres = pow(1.0-max(dot(N,V),0.0), 2.0);',
      '  float depth = clamp(vW.y/max(uLevel,0.001),0.0,1.0);',
      '  vec3 col = mix(uTint*0.42, uTint*1.25, depth) + vec3(0.25,0.55,0.72)*fres*0.35;',
      '  float alpha = clamp((0.085 + fres*0.11 + (1.0-depth)*0.035)*uAlpha, 0.0, 0.34);',
      '  gl_FragColor = vec4(col, alpha);',
      '}'
    ].join('\n')
  });
};

/* 玻璃 */
JW.glassMaterial = function (alphaScale) {
  return shaderMat({
    uniforms: uniforms({ uAlpha: { value: alphaScale === undefined ? 1 : alphaScale } }), side: T.DoubleSide,
    vertexShader: VERT_WORLD,
    fragmentShader: [
      GLSL_COMMON, 'uniform float uAlpha;',
      'varying vec3 vN; varying vec3 vW;',
      'void main(){',
      '  vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;',
      '  vec3 V = normalize(uCam-vW);',
      '  float fres = pow(1.0-max(dot(N,V),0.0), 2.6);',
      '  vec3 H = normalize(normalize(uLightDir)+V);',
      '  float sp = pow(max(dot(N,H),0.0), 70.0);',
      '  vec3 col = mix(vec3(0.055,0.10,0.16), vec3(0.62,0.84,1.0), fres)*0.9 + vec3(1.0)*sp*0.55;',
      '  float alpha = clamp((0.014 + fres*0.30 + sp*0.16)*uAlpha, 0.0, 0.52);',
      '  gl_FragColor = vec4(col, alpha);',
      '}'
    ].join('\n')
  });
};

/* 水槽小球：自定义着色，保持密度组颜色鲜明可辨 */
JW.tankBallMaterial = function (colorHex) {
  return shaderMat({
    uniforms: uniforms({ uColor: { value: new T.Color(colorHex) } }),
    transparent: false, depthWrite: true, side: T.FrontSide,
    vertexShader: VERT_WORLD,
    fragmentShader: [
      GLSL_COMMON, 'uniform vec3 uColor;',
      'varying vec3 vN; varying vec3 vW;',
      'void main(){',
      '  vec3 N = normalize(vN); vec3 V = normalize(uCam-vW);',
      '  float d = max(dot(N, normalize(uLightDir)), 0.0);',
      '  float d2 = max(dot(N, normalize(uFillDir)), 0.0);',
      '  vec3 H = normalize(normalize(uLightDir)+V);',
      '  float sp = pow(max(dot(N,H),0.0), 44.0);',
      '  float fres = pow(1.0-max(dot(N,V),0.0), 2.6);',
      '  vec3 col = uColor*(0.42 + 0.62*d + 0.20*d2);',
      '  col += vec3(1.0)*sp*0.40;',
      '  col += uColor*fres*0.42 + vec3(0.18,0.32,0.48)*fres*0.26;',
      '  col = mix(col, uColor, 0.18);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  });
};

/* ---------------- 音效（程序化 Web Audio，无外部文件） ---------------- */
function AudioEngine() {
  this.ctx = null; this.master = null; this.enabled = true;
  this.noise = null; this.wave = null;
  this.last = {};
}
AudioEngine.prototype.ensure = function () {
  if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
  var AC = global.AudioContext || global.webkitAudioContext;
  if (!AC) return;
  try {
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.75;
    this.master.connect(this.ctx.destination);
    var len = Math.floor(this.ctx.sampleRate * 1.2);
    var b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = b.getChannelData(0), seed = mulberry32(9182), last = 0;
    for (var i = 0; i < len; i++) {
      var wn = seed() * 2 - 1;
      last = (last + 0.02 * wn) / 1.02; d[i] = last * 3.2;
    }
    this.noise = b;
  } catch (e) { this.ctx = null; }
};
AudioEngine.prototype.gate = function (key, gap) {
  var t = this.ctx ? this.ctx.currentTime : 0;
  if (this.last[key] !== undefined && t - this.last[key] < gap) return false;
  this.last[key] = t; return true;
};
AudioEngine.prototype.env = function (g, t0, peak, atk, dec) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + dec);
};
AudioEngine.prototype.tone = function (type, f0, f1, dur, peak, key, gap) {
  if (!this.enabled) return; this.ensure(); if (!this.ctx) return;
  if (key && !this.gate(key, gap || 0.04)) return;
  var c = this.ctx, t = c.currentTime;
  var o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  this.env(g, t, peak, 0.006, dur);
  o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
};
AudioEngine.prototype.noiseBurst = function (freq, q, dur, peak, key, gap, sweepTo) {
  if (!this.enabled) return; this.ensure(); if (!this.ctx) return;
  if (key && !this.gate(key, gap || 0.04)) return;
  var c = this.ctx, t = c.currentTime;
  var s = c.createBufferSource(); s.buffer = this.noise;
  var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  var g = c.createGain(); this.env(g, t, peak, 0.005, dur);
  s.connect(f); f.connect(g); g.connect(this.master);
  s.start(t); s.stop(t + dur + 0.05);
};
AudioEngine.prototype.impact = function (s) {
  s = clamp(s, 0.05, 1);
  this.tone('sine', 150, 42, 0.26, 0.55 * s, 'imp', 0.06);
  this.noiseBurst(190, 1.1, 0.17, 0.30 * s, 'impn', 0.06, 70);
};
AudioEngine.prototype.bounce = function (s) {
  s = clamp(s, 0.05, 1);
  this.tone('sine', 330, 160, 0.13, 0.20 * s, 'bnc', 0.05);
};
AudioEngine.prototype.click = function (s) {
  s = clamp(s, 0.05, 1);
  this.noiseBurst(1500, 2.2, 0.055, 0.13 * s, 'clk', 0.035);
};
AudioEngine.prototype.splash = function (s) {
  s = clamp(s, 0.05, 1);
  this.noiseBurst(2400, 0.7, 0.32, 0.34 * s, 'spl', 0.05, 420);
  this.tone('sine', 420, 130, 0.16, 0.10 * s, 'splt', 0.05);
};
AudioEngine.prototype.startWave = function () {
  if (!this.enabled) return; this.ensure(); if (!this.ctx || this.wave) return;
  var c = this.ctx, t = c.currentTime;
  var s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
  var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240; f.Q.value = 0.6;
  var g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.11, t + 0.35);
  s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  this.wave = { src: s, gain: g };
};
AudioEngine.prototype.stopWave = function () {
  if (!this.wave || !this.ctx) return;
  var c = this.ctx, t = c.currentTime, w = this.wave;
  w.gain.gain.cancelScheduledValues(t);
  w.gain.gain.setValueAtTime(Math.max(0.0002, w.gain.gain.value), t);
  w.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  try { w.src.stop(t + 0.6); } catch (e) {}
  this.wave = null;
};
AudioEngine.prototype.setEnabled = function (on) {
  this.enabled = !!on;
  if (!on) { this.stopWave(); if (this.master) this.master.gain.value = 0; }
  else { this.ensure(); if (this.master) this.master.gain.value = 0.75; }
};
JW.AudioEngine = AudioEngine;

})(window);
