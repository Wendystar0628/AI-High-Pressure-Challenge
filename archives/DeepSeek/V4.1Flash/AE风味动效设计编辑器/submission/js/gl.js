/* ============================================================
   gl.js — WebGL 2 渲染器：PBR 实体、阴影、粒子、景深、运动模糊
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const M = AE.model;
  const P = AE.particles;
  const GL = AE.gl = {};

  let gl = null;
  let W = 1, H = 1;
  let progs = {};
  let scene = null;
  let shadow = null;
  let supported = false;
  let currentCanvas = null;

  // ---------------- 着色器 ----------------
  const VS_QUAD = `#version 300 es
  const vec2 POS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  void main(){ gl_Position = vec4(POS[gl_VertexID], 0.0, 1.0); }`;

  const VS_SOLID = `#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec3 aNrm;
  uniform mat4 uViewProj;
  uniform mat4 uLightVP;
  out vec3 vWorld;
  out vec3 vNrm;
  out vec4 vLS;
  void main(){
    vWorld = aPos;
    vNrm = aNrm;
    vLS = uLightVP * vec4(aPos, 1.0);
    gl_Position = uViewProj * vec4(aPos, 1.0);
  }`;

  const FS_SOLID = `#version 300 es
  precision highp float;
  in vec3 vWorld;
  in vec3 vNrm;
  in vec4 vLS;
  uniform vec3 uCamPos;
  uniform vec3 uBaseColor;
  uniform float uMetal;
  uniform float uRough;
  uniform float uEmissive;
  uniform vec3 uEmissiveColor;
  uniform float uOpacity;
  uniform vec3 uDirDir[2];
  uniform vec3 uDirColor[2];
  uniform int uDirCount;
  uniform vec3 uPtPos[4];
  uniform vec3 uPtColor[4];
  uniform float uPtRadius[4];
  uniform int uPtCount;
  uniform sampler2D uShadowMap;
  uniform float uUseShadow;
  uniform vec2 uShadowTexel;
  out vec4 outColor;
  const float PI = 3.141592653589793;
  float D_GGX(float NoH, float a){
    float a2 = a*a;
    float d = NoH*NoH*(a2-1.0)+1.0;
    return a2 / (PI*d*d + 1e-7);
  }
  float V_Smith(float NoV, float NoL, float a){
    float k = a*0.5;
    return 0.25 / ((NoV*(1.0-k)+k)*(NoL*(1.0-k)+k)+1e-5);
  }
  vec3 F_Schlick(vec3 f0, float u){
    return f0 + (1.0-f0)*pow(1.0-u,5.0);
  }
  vec3 envColor(vec3 d, float rough){
    float up = -d.y;
    vec3 sky = mix(vec3(0.012,0.014,0.018), vec3(0.16,0.20,0.26), smoothstep(-0.5,1.0,up));
    float warm = exp(-abs(up+0.15)*2.4);
    sky += vec3(0.40,0.15,0.045) * warm * 0.85;
    sky += vec3(0.38,0.10,0.02) * (1.0 - smoothstep(-0.35,0.45,up)) * 0.45;
    vec3 l1 = normalize(vec3(-0.55,-0.72,0.62));
    vec3 l2 = normalize(vec3(0.72,-0.25,0.62));
    vec3 l3 = normalize(vec3(0.05,-0.95,-0.4));
    vec3 l4 = normalize(vec3(-0.08,0.1,1.0));
    float s1 = pow(max(dot(d,l1),0.0), 46.0);
    float s2 = pow(max(dot(d,l2),0.0), 22.0);
    float s3 = pow(max(dot(d,l3),0.0), 90.0);
    float s4 = pow(max(dot(d,l4),0.0), 5.0);
    sky += vec3(1.0,0.84,0.64) * s1 * 0.9;
    sky += vec3(0.35,0.55,0.80) * s2 * 0.55;
    sky += vec3(1.0,0.45,0.18) * s3 * 0.5;
    sky += vec3(0.62,0.68,0.78) * s4 * 0.55;
    return mix(sky, vec3(0.11,0.095,0.085), rough*rough*0.8);
  }
  float shadowFactor(vec3 N, vec3 L){
    if(uUseShadow < 0.5) return 1.0;
    vec3 proj = vLS.xyz / vLS.w;
    proj = proj*0.5 + 0.5;
    if(proj.x <= 0.001 || proj.x >= 0.999 || proj.y <= 0.001 || proj.y >= 0.999 || proj.z >= 1.0) return 1.0;
    float bias = 0.0012 + 0.002*(1.0 - max(dot(N,L),0.0));
    float s = 0.0;
    for(int x=-1;x<=1;x++){
      for(int y=-1;y<=1;y++){
        float d = texture(uShadowMap, proj.xy + vec2(float(x),float(y))*uShadowTexel*1.4).r;
        s += (proj.z - bias <= d) ? 1.0 : 0.0;
      }
    }
    return s / 9.0;
  }
  void main(){
    vec3 N = normalize(vNrm);
    vec3 V = normalize(uCamPos - vWorld);
    float NoV = max(dot(N,V), 0.001);
    float rough = clamp(uRough, 0.03, 1.0);
    float a = max(rough*rough, 0.004);
    float metal = clamp(uMetal, 0.0, 1.0);
    vec3 f0 = mix(vec3(0.04), uBaseColor, metal);
    vec3 kd = (1.0 - metal) * uBaseColor;
    vec3 color = vec3(0.0);
    for(int i=0;i<2;i++){
      if(i >= uDirCount) break;
      vec3 L = normalize(-uDirDir[i]);
      vec3 H = normalize(V + L);
      float NoL = max(dot(N,L), 0.0);
      float NoH = max(dot(N,H), 0.0);
      float VoH = max(dot(V,H), 0.0);
      float sh = shadowFactor(N,L);
      vec3 spec = F_Schlick(f0, VoH) * D_GGX(NoH, a) * V_Smith(NoV, NoL, a);
      color += (kd/PI + spec) * uDirColor[i] * NoL * sh;
    }
    for(int i=0;i<4;i++){
      if(i >= uPtCount) break;
      vec3 dv = uPtPos[i] - vWorld;
      float dist = length(dv);
      vec3 L = dv / max(dist, 0.0001);
      vec3 H = normalize(V + L);
      float NoL = max(dot(N,L), 0.0);
      float NoH = max(dot(N,H), 0.0);
      float VoH = max(dot(V,H), 0.0);
      float atten = 1.0 / (1.0 + pow(dist / max(uPtRadius[i],1.0), 2.0));
      vec3 spec = F_Schlick(f0, VoH) * D_GGX(NoH, a) * V_Smith(NoV, NoL, a);
      color += (kd/PI + spec) * uPtColor[i] * NoL * atten;
    }
    vec3 R = reflect(-V, N);
    vec3 env = envColor(R, rough);
    vec3 Fenv = F_Schlick(f0, NoV);
    color += kd * envColor(N, 1.0) * 1.1;
    color += env * (Fenv * 1.55 + 0.07);
    color += uEmissiveColor * uEmissive * 1.15;
    color = 1.0 - exp(-max(color, vec3(0.0)) * 1.25);
    float alpha = clamp(uOpacity, 0.0, 1.0);
    outColor = vec4(color * alpha, alpha);
  }`;

  const VS_SHADOW = `#version 300 es
  layout(location=0) in vec3 aPos;
  uniform mat4 uLightVP;
  void main(){ gl_Position = uLightVP * vec4(aPos,1.0); }`;
  const FS_SHADOW = `#version 300 es
  precision highp float;
  out vec4 o;
  void main(){ o = vec4(1.0); }`;

  const VS_PARTICLE = `#version 300 es
  precision highp float;
  layout(location=0) in vec3 aCenter;
  layout(location=1) in vec3 aColor;
  layout(location=2) in float aSize;
  layout(location=3) in float aAlpha;
  layout(location=4) in vec2 aCorner;
  uniform mat4 uViewProj;
  uniform vec3 uCamRight;
  uniform vec3 uCamUp;
  out vec3 vColor;
  out float vAlpha;
  out vec2 vUv;
  void main(){
    vec3 p = aCenter + (uCamRight*aCorner.x + uCamUp*aCorner.y) * aSize;
    gl_Position = uViewProj * vec4(p,1.0);
    vColor = aColor;
    vAlpha = aAlpha;
    vUv = aCorner;
  }`;
  const FS_PARTICLE = `#version 300 es
  precision highp float;
  in vec3 vColor;
  in float vAlpha;
  in vec2 vUv;
  out vec4 outColor;
  void main(){
    float d = length(vUv);
    if(d > 1.0) discard;
    float edge = smoothstep(1.0, 0.25, d);
    vec3 col = vColor * (0.85 + 0.7*smoothstep(0.65, 0.0, d));
    col = 1.0 - exp(-col*1.4);
    float a = vAlpha * edge;
    outColor = vec4(col*a, a);
  }`;

  const VS_TRAIL = `#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec3 aColor;
  layout(location=2) in float aAlpha;
  uniform mat4 uViewProj;
  out vec3 vColor;
  out float vAlpha;
  void main(){
    gl_Position = uViewProj * vec4(aPos,1.0);
    vColor = aColor;
    vAlpha = aAlpha;
  }`;
  const FS_TRAIL = `#version 300 es
  precision highp float;
  in vec3 vColor;
  in float vAlpha;
  out vec4 outColor;
  void main(){
    vec3 col = 1.0 - exp(-vColor*1.5);
    outColor = vec4(col*vAlpha, vAlpha);
  }`;

  const FS_DOF = `#version 300 es
  precision highp float;
  uniform sampler2D uColor;
  uniform sampler2D uDepth;
  uniform vec2 uRes;
  uniform float uNear, uFar, uFocus, uAperture, uMaxRadius;
  out vec4 outColor;
  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    vec4 center = texture(uColor, uv);
    float z = texture(uDepth, uv).r;
    float ld = (2.0*uNear*uFar) / (uFar + uNear - z*(uFar-uNear));
    if(z >= 0.999999) ld = uFar;
    float coc = abs(1.0 - uFocus / max(ld, 1.0)) * uAperture * 26.0;
    coc = clamp(coc, 0.0, uMaxRadius);
    if(coc < 0.35) { outColor = center; return; }
    vec4 sum = center;
    float wsum = 1.0;
    for(int i=0;i<16;i++){
      float ang = float(i) * 2.39996323;
      float r = sqrt((float(i)+0.5)/16.0) * coc;
      vec2 off = vec2(cos(ang), sin(ang)) * r / uRes;
      vec4 s = texture(uColor, uv + off);
      sum += s;
      wsum += 1.0;
    }
    outColor = sum / wsum;
  }`;

  const FS_COPY = `#version 300 es
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2 uRes;
  uniform vec4 uTint;
  out vec4 outColor;
  void main(){
    vec4 c = texture(uTex, gl_FragCoord.xy / uRes);
    outColor = c * uTint;
  }`;

  // ---------------- 基础工具 ----------------
  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      console.error('着色器编译失败', log, src);
      throw new Error(log);
    }
    return sh;
  }
  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      console.error('着色器链接失败', log);
      throw new Error(log);
    }
    return p;
  }
  function uniforms(p) {
    const out = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      let name = info.name.replace(/\[0\]$/, '');
      out[name] = gl.getUniformLocation(p, name);
    }
    return out;
  }

  function makeTarget(w, h, opts) {
    opts = opts || {};
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const internal = opts.float ? gl.RGBA16F : gl.RGBA8;
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, opts.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.nearest ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts.nearest ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    let depthTex = null;
    if (opts.depth) {
      depthTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, depthTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, depthTex, w, h, float: !!opts.float };
  }
  function freeTarget(t) {
    if (!t) return;
    if (t.fb) gl.deleteFramebuffer(t.fb);
    if (t.tex) gl.deleteTexture(t.tex);
    if (t.depthTex) gl.deleteTexture(t.depthTex);
  }

  function drawFullscreen() {
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---------------- 初始化 ----------------
  GL.init = function (canvas) {
    currentCanvas = canvas;
    gl = canvas.getContext('webgl2', {
      alpha: true, antialias: false, premultipliedAlpha: true,
      preserveDrawingBuffer: true, powerPreference: 'high-performance',
      depth: true, stencil: false
    });
    if (!gl) {
      supported = false;
      console.error('WebGL 2 不可用');
      return false;
    }
    supported = true;
    GL.gl = gl;
    progs = {
      solid: program(VS_SOLID, FS_SOLID),
      shadow: program(VS_SHADOW, FS_SHADOW),
      particle: program(VS_PARTICLE, FS_PARTICLE),
      trail: program(VS_TRAIL, FS_TRAIL),
      dof: program(VS_QUAD, FS_DOF),
      copy: program(VS_QUAD, FS_COPY)
    };
    for (const k in progs) progs[k].u = uniforms(progs[k]);
    // 场景对象
    scene = {
      ms: null, resolve: null, sum: null, dof: null, sumTmp: null,
      msFBO: null, msColor: null, msDepth: null, samples: Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 1)
    };
    // 阴影
    const shSize = 2048;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, shSize, shSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    shadow = { fb, tex, size: shSize };
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    GL.supported = true;
    return true;
  };

  GL.isSupported = () => supported;

  function ensureSize(w, h) {
    w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
    if (w === W && h === H && scene.msFBO) return;
    W = w; H = h;
    freeTarget(scene.resolve);
    freeTarget(scene.sum);
    freeTarget(scene.dof);
    if (scene.msFBO) {
      gl.deleteFramebuffer(scene.msFBO);
      gl.deleteRenderbuffer(scene.msColor);
      gl.deleteRenderbuffer(scene.msDepth);
    }
    const samples = scene.samples;
    scene.msFBO = gl.createFramebuffer();
    scene.msColor = gl.createRenderbuffer();
    scene.msDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, scene.msColor);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, W, H);
    gl.bindRenderbuffer(gl.RENDERBUFFER, scene.msDepth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.msFBO);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, scene.msColor);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, scene.msDepth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    scene.resolve = makeTarget(W, H, { depth: true });
    scene.sum = makeTarget(W, H, { depth: false });
    scene.dof = makeTarget(W, H, { depth: false });
  }

  // ---------------- 摄像机 ----------------
  function getCameraInfo(comp, t, opts) {
    opts = opts || {};
    const w = W, h = H;
    let eye = { x: 0, y: -30, z: 1200 }, target = { x: 0, y: 0, z: 0 }, roll = 0;
    let focal = 50, focus = 1100, aperture = 0;
    let layer = null;
    if (opts.freeView) {
      const fc = (AE.app && AE.app.view && AE.app.view.freeCamera) || { yaw: 0.28, pitch: 0.1, dist: 1350, target: { x: 0, y: 0, z: 0 } };
      const cp = Math.cos(fc.pitch), sp = Math.sin(fc.pitch);
      target = { x: fc.target.x, y: fc.target.y, z: fc.target.z };
      eye = {
        x: target.x + Math.sin(fc.yaw) * fc.dist * cp,
        y: target.y - Math.sin(fc.pitch) * fc.dist,
        z: target.z + Math.cos(fc.yaw) * fc.dist * cp
      };
      focal = 50;
      focus = U.vlen(U.vsub(target, eye));
      aperture = 0;
    } else {
      layer = comp.layers.find(l => l.id === comp.activeCameraId && l.type === 'camera' && l.enabled)
        || comp.layers.find(l => l.type === 'camera' && l.enabled);
      if (layer) {
        const ctx = A.newCtx(comp, layer, t);
        const wm = A.worldMatrix(layer, t, ctx);
        const p = U.m4.applyPoint(wm, { x: 0, y: 0, z: 0 });
        eye = { x: p.x, y: p.y, z: p.z };
        const tg = A.sample(layer.camera.target, t, layer, ctx);
        target = { x: tg.x, y: tg.y, z: tg.z };
        focal = Math.max(1, A.n(A.sample(layer.camera.focalLength, t, layer, ctx)));
        focus = Math.max(1, A.n(A.sample(layer.camera.focusDistance, t, layer, ctx))) || U.vlen(U.vsub(target, eye));
        aperture = Math.max(0, A.n(A.sample(layer.camera.aperture, t, layer, ctx)));
        roll = A.n(A.sample(layer.transform.rotation, t, layer, ctx)) * U.DEG;
      } else {
        const fc = (AE.app && AE.app.view && AE.app.view.freeCamera) || { yaw: 0.25, pitch: 0.1, dist: 1350, target: { x: 0, y: 0, z: 0 } };
        target = { x: fc.target.x, y: fc.target.y, z: fc.target.z };
        const cp = Math.cos(fc.pitch);
        eye = {
          x: target.x + Math.sin(fc.yaw) * fc.dist * cp,
          y: target.y - Math.sin(fc.pitch) * fc.dist,
          z: target.z + Math.cos(fc.yaw) * fc.dist * cp
        };
        focal = 50; focus = U.vlen(U.vsub(target, eye)); aperture = 0;
      }
    }
    const vfov = 2 * Math.atan(12 / focal);
    const aspect = w / h;
    const near = 1, far = 30000;
    const view = U.m4.view(eye, target, roll);
    const proj = U.m4.perspective(vfov, aspect, near, far);
    const vp = U.m4.mul(proj, view);
    return {
      eye, target, fov: vfov, focal, focus, aperture, roll, near, far,
      view, proj, viewProj: vp, invViewProj: U.m4.invert(vp),
      width: w, height: h, aspect, cameraLayer: layer ? layer.id : null
    };
  }
  GL.getCameraInfo = function (comp, t, opts) {
    ensureSize(W, H);
    return getCameraInfo(comp, t, opts);
  };

  // ---------------- 灯光 ----------------
  function gatherLights(comp, t) {
    const dirs = [], points = [];
    for (const layer of comp.layers) {
      if (layer.type !== 'light' || !layer.enabled) continue;
      const ctx = A.newCtx(comp, layer, t);
      const lg = layer.light;
      const color = U.rgb01(A.sample(lg.color, t, layer, ctx));
      const intensity = A.n(A.sample(lg.intensity, t, layer, ctx)) / 100;
      const c = color.map(v => v * intensity * 2.2);
      if (lg.type === 'directional') {
        const d = A.vec3(A.sample(lg.direction, t, layer, ctx));
        const wm = A.worldMatrix(layer, t, ctx);
        const dir = U.vnorm(U.m4.applyDir(wm, d));
        dirs.push({ dir, color: c, layer });
      } else {
        const wm = A.worldMatrix(layer, t, ctx);
        const p = U.m4.applyPoint(wm, { x: 0, y: 0, z: 0 });
        const radius = A.n(A.sample(lg.radius, t, layer, ctx));
        points.push({ pos: p, color: c, radius, layer });
      }
    }
    if (!dirs.length && !points.length) {
      dirs.push({ dir: U.vnorm({ x: -0.45, y: -0.7, z: 0.55 }), color: [1.1, 1.0, 0.9] });
      points.push({ pos: { x: 0, y: 80, z: 500 }, color: [0.9, 0.35, 0.1], radius: 900 });
    }
    return { dirs: dirs.slice(0, 2), points: points.slice(0, 4) };
  }

  function findShadowLight(lights, comp, t) {
    const l = lights.dirs.find(d => d.layer.light.shadow);
    return l || null;
  }

  function buildShadowMatrix(shadowLight, meshes, floorY) {
    const dir = U.vnorm(shadowLight.dir);
    let center = { x: 0, y: 0, z: 0 };
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let count = 0;
    for (const m of meshes) {
      if (!m.mesh || !m.mesh.bounds) continue;
      const b = m.mesh.bounds;
      minX = Math.min(minX, b.x0); maxX = Math.max(maxX, b.x1);
      minY = Math.min(minY, b.y0); maxY = Math.max(maxY, b.y1);
      minZ = Math.min(minZ, b.z0); maxZ = Math.max(maxZ, b.z1);
      count++;
    }
    if (!count) { center = { x: 0, y: 0, z: 0 }; }
    else center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
    const span = count ? Math.max(maxX - minX, maxY - minY, maxZ - minZ, 600) : 1600;
    const half = span * 0.85 + 200;
    const eye = { x: center.x - dir.x * span * 3, y: center.y - dir.y * span * 3, z: center.z - dir.z * span * 3 };
    const view = U.m4.view(eye, center);
    const proj = U.m4.ortho(-half, half, -half, half, 1, span * 8 + 2000);
    return { viewProj: U.m4.mul(proj, view), half, center, span };
  }

  // ---------------- 网格 GPU 缓存 ----------------
  function meshGPU(mesh) {
    if (!mesh || !mesh.posData) return null;
    if (mesh._gpu && mesh._gpu.ctx === gl) return mesh._gpu;
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.posData, gl.STATIC_DRAW);
    const nrmBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.nrmData, gl.STATIC_DRAW);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    const g = { vao, posBuf, nrmBuf, count: mesh.primCount, ctx: gl };
    mesh._gpu = g;
    return g;
  }

  // ---------------- 粒子 ----------------
  const particleVAO = { vao: null, buf: null, count: 0 };
  const trailVAO = { vao: null, buf: null, count: 0 };
  function ensureParticleBuffers() {
    if (!particleVAO.vao) {
      particleVAO.vao = gl.createVertexArray();
      particleVAO.buf = gl.createBuffer();
      gl.bindVertexArray(particleVAO.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, particleVAO.buf);
      const stride = 10 * 4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 24);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 28);
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 2, gl.FLOAT, false, stride, 32);
      gl.bindVertexArray(null);
    }
    if (!trailVAO.vao) {
      trailVAO.vao = gl.createVertexArray();
      trailVAO.buf = gl.createBuffer();
      gl.bindVertexArray(trailVAO.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, trailVAO.buf);
      const stride = 7 * 4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 24);
      gl.bindVertexArray(null);
    }
  }

  function renderParticles(comp, t, camera, progs) {
    ensureParticleBuffers();
    const right = { x: camera.view[0], y: camera.view[4], z: camera.view[8] };
    const up = { x: camera.view[1], y: camera.view[5], z: camera.view[9] };
    for (const layer of comp.layers) {
      if (layer.type !== 'particle' || !layer.enabled) continue;
      if (t < layer.inPoint || t > layer.outPoint) continue;
      const data = P.getRenderData(layer, t);
      if (!data) continue;
      const verts = [];
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
      for (const p of data.particles) {
        for (const c of corners) {
          verts.push(p.x, p.y, p.z, p.color[0], p.color[1], p.color[2], p.size, p.alpha, c[0], c[1]);
        }
      }
      if (verts.length) {
        gl.useProgram(progs.particle);
        gl.uniformMatrix4fv(progs.particle.u.uViewProj, false, camera.viewProj);
        gl.uniform3f(progs.particle.u.uCamRight, right.x, right.y, right.z);
        gl.uniform3f(progs.particle.u.uCamUp, up.x, up.y, up.z);
        gl.bindVertexArray(particleVAO.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, particleVAO.buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.drawArrays(gl.TRIANGLES, 0, verts.length / 10);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
      if (data.trails.length) {
        const tv = [];
        for (const tr of data.trails) {
          const pts = tr.points;
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            const wa = a.w * 0.5, wb = b.w * 0.5;
            const A0 = { x: a.x + right.x * wa, y: a.y + right.y * wa, z: a.z + right.z * wa };
            const A1 = { x: a.x - right.x * wa, y: a.y - right.y * wa, z: a.z - right.z * wa };
            const B0 = { x: b.x + right.x * wb, y: b.y + right.y * wb, z: b.z + right.z * wb };
            const B1 = { x: b.x - right.x * wb, y: b.y - right.y * wb, z: b.z - right.z * wb };
            const ca = tr.color, aa = a.a, ab = b.a;
            tv.push(A0.x, A0.y, A0.z, ca[0], ca[1], ca[2], aa);
            tv.push(B0.x, B0.y, B0.z, ca[0], ca[1], ca[2], ab);
            tv.push(A1.x, A1.y, A1.z, ca[0], ca[1], ca[2], aa);
            tv.push(A1.x, A1.y, A1.z, ca[0], ca[1], ca[2], aa);
            tv.push(B0.x, B0.y, B0.z, ca[0], ca[1], ca[2], ab);
            tv.push(B1.x, B1.y, B1.z, ca[0], ca[1], ca[2], ab);
          }
        }
        if (tv.length) {
          gl.useProgram(progs.trail);
          gl.uniformMatrix4fv(progs.trail.u.uViewProj, false, camera.viewProj);
          gl.bindVertexArray(trailVAO.vao);
          gl.bindBuffer(gl.ARRAY_BUFFER, trailVAO.buf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tv), gl.DYNAMIC_DRAW);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          gl.depthMask(false);
          gl.drawArrays(gl.TRIANGLES, 0, tv.length / 7);
          gl.depthMask(true);
          gl.disable(gl.BLEND);
        }
      }
    }
  }

  // ---------------- 场景渲染 ----------------
  function buildObjects(comp, centerT, opts) {
    const objects = [];
    for (const layer of comp.layers) {
      if (!layer.enabled || layer.type === 'camera' || layer.type === 'light' || layer.type === 'field' || layer.type === 'sound' || layer.type === 'adjustment') continue;
      if (layer.type === 'particle') { objects.push({ layer, kind: 'particle' }); continue; }
      if (!M.renders3D(layer)) continue;
      if (centerT < layer.inPoint || centerT > layer.outPoint) continue;
      objects.push({ layer, kind: 'solid' });
    }
    return objects;
  }

  function renderScene(comp, t, opts) {
    opts = opts || {};
    ensureSize(opts.width || currentCanvas.width, opts.height || currentCanvas.height);
    const camera = getCameraInfo(comp, t, opts);
    const lights = gatherLights(comp, t);
    const objects = buildObjects(comp, t, opts);
    const samples = (opts.noMotionBlur ? 1 : (() => {
      const mb = comp.motionBlur;
      if (!mb || !mb.enabled) return 1;
      const any = comp.layers.some(l => l.motionBlur && l.enabled && (l.type === 'shape' || l.type === 'text' || l.type === 'node3d' || l.type === 'camera'));
      if (!any) return 1;
      return U.clamp(Math.round(mb.samples || 4), 2, 8);
    })());
    const shutter = comp.motionBlur ? (comp.motionBlur.shutterAngle / 360) / comp.fps : 0;
    const phase = comp.motionBlur ? (comp.motionBlur.phase || 0) : 0;
    const times = [];
    if (samples <= 1) times.push(t);
    else {
      for (let i = 0; i < samples; i++) {
        const f = samples === 1 ? 0.5 : i / (samples - 1);
        times.push(t + (phase + f - 0.5) * shutter);
      }
      times[times.length - 1] = t; // 中心样本最后渲染以供深度使用
    }
    // 阴影光源
    const shadowLight = findShadowLight(lights, comp, t);
    // 先构建物体（网格按中心时间用于阴影范围）
    let shadowMeshes = [];
    if (shadowLight) {
      for (const o of objects) {
        if (o.kind !== 'solid') continue;
        const mat = A.is3D && o.layer.material;
        if (!o.layer.material || !o.layer.material.castShadow) continue;
        const ltime = o.layer.motionBlur ? t : t;
        const mesh = P.meshForLayer(o.layer, ltime);
        if (mesh) shadowMeshes.push({ mesh, layer: o.layer });
      }
    }
    const shadowMat = shadowMeshes.length ? buildShadowMatrix(shadowLight, shadowMeshes) : null;
    // 阴影贴图
    if (shadowMat) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadow.fb);
      gl.viewport(0, 0, shadow.size, shadow.size);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.useProgram(progs.shadow);
      gl.uniformMatrix4fv(progs.shadow.u.uLightVP, false, shadowMat.viewProj);
      for (const sm of shadowMeshes) {
        const gpu = meshGPU(sm.mesh);
        if (!gpu) continue;
        const mat = sm.layer.material;
        const op = mat && mat.opacity ? A.n(A.sample(mat.opacity, t, sm.layer, A.newCtx(comp, sm.layer, t))) / 100 : 1;
        if (op < 0.35) continue;
        gl.bindVertexArray(gpu.vao);
        gl.drawArrays(gl.TRIANGLES, 0, gpu.count);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // 清空累计
    if (samples > 1) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.sum.fb);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    const centerDepthTarget = scene.resolve;
    for (let si = 0; si < times.length; si++) {
      const st = times[si];
      // MSAA 目标
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.msFBO);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      // 不透明物体
      const opaque = [], transparent = [];
      for (const o of objects) {
        if (o.kind !== 'solid') continue;
        const ltime = o.layer.motionBlur ? st : t;
        if (ltime < o.layer.inPoint || ltime > o.layer.outPoint) continue;
        const mesh = P.meshForLayer(o.layer, ltime);
        if (!mesh) continue;
        const mat = o.layer.material;
        const ctx = A.newCtx(comp, o.layer, ltime);
        const layerOp = U.clamp(A.n(A.sample(o.layer.transform.opacity, ltime, o.layer, ctx)), 0, 100) / 100;
        const matOp = mat && mat.opacity ? U.clamp(A.n(A.sample(mat.opacity, ltime, o.layer, ctx)), 0, 100) / 100 : 1;
        const opacity = layerOp * matOp;
        const entry = { o, mesh, ltime, opacity, mat, ctx, st };
        if (opacity < 0.999) transparent.push(entry); else opaque.push(entry);
      }
      transparent.sort((a, b) => {
        const ca = a.mesh.bounds, cb = b.mesh.bounds;
        const da = Math.hypot((ca.x0 + ca.x1) / 2 - camera.eye.x, (ca.y0 + ca.y1) / 2 - camera.eye.y, (ca.z0 + ca.z1) / 2 - camera.eye.z);
        const db = Math.hypot((cb.x0 + cb.x1) / 2 - camera.eye.x, (cb.y0 + cb.y1) / 2 - camera.eye.y, (cb.z0 + cb.z1) / 2 - camera.eye.z);
        return db - da;
      });
      const drawSolid = (entry) => {
        const p = progs.solid;
        gl.useProgram(p);
        gl.uniformMatrix4fv(p.u.uViewProj, false, camera.viewProj);
        gl.uniformMatrix4fv(p.u.uLightVP, false, shadowMat ? shadowMat.viewProj : U.m4.identity());
        gl.uniform3f(p.u.uCamPos, camera.eye.x, camera.eye.y, camera.eye.z);
        const mat = entry.mat;
        const base = U.rgb01(A.sample(mat.baseColor, entry.ltime, entry.o.layer, entry.ctx));
        gl.uniform3f(p.u.uBaseColor, base[0], base[1], base[2]);
        gl.uniform1f(p.u.uMetal, U.clamp(A.n(A.sample(mat.metalness, entry.ltime, entry.o.layer, entry.ctx)) / 100, 0, 1));
        gl.uniform1f(p.u.uRough, U.clamp(A.n(A.sample(mat.roughness, entry.ltime, entry.o.layer, entry.ctx)) / 100, 0.02, 1));
        gl.uniform1f(p.u.uEmissive, Math.max(0, A.n(A.sample(mat.emissive, entry.ltime, entry.o.layer, entry.ctx))) / 100);
        const em = U.rgb01(A.sample(mat.emissiveColor, entry.ltime, entry.o.layer, entry.ctx));
        gl.uniform3f(p.u.uEmissiveColor, em[0], em[1], em[2]);
        gl.uniform1f(p.u.uOpacity, entry.opacity);
        gl.uniform3fv(p.u.uDirDir, new Float32Array(6));
        gl.uniform3fv(p.u.uDirColor, new Float32Array(6));
        gl.uniform1i(p.u.uDirCount, Math.min(2, lights.dirs.length));
        for (let i = 0; i < Math.min(2, lights.dirs.length); i++) {
          gl.uniform3f(gl.getUniformLocation(p, `uDirDir[${i}]`), lights.dirs[i].dir.x, lights.dirs[i].dir.y, lights.dirs[i].dir.z);
          gl.uniform3fv(gl.getUniformLocation(p, `uDirColor[${i}]`), lights.dirs[i].color);
        }
        gl.uniform1i(p.u.uPtCount, Math.min(4, lights.points.length));
        for (let i = 0; i < Math.min(4, lights.points.length); i++) {
          const lp = lights.points[i];
          gl.uniform3f(gl.getUniformLocation(p, `uPtPos[${i}]`), lp.pos.x, lp.pos.y, lp.pos.z);
          gl.uniform3fv(gl.getUniformLocation(p, `uPtColor[${i}]`), lp.color);
          gl.uniform1f(gl.getUniformLocation(p, `uPtRadius[${i}]`), lp.radius || 500);
        }
        gl.uniform1f(p.u.uUseShadow, shadowMat ? 1 : 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, shadow.tex);
        gl.uniform1i(p.u.uShadowMap, 0);
        gl.uniform2f(p.u.uShadowTexel, 1 / shadow.size, 1 / shadow.size);
        const gpu = meshGPU(entry.mesh);
        if (!gpu) return;
        gl.bindVertexArray(gpu.vao);
        gl.drawArrays(gl.TRIANGLES, 0, gpu.count);
      };
      for (const e of opaque) drawSolid(e);
      renderParticles(comp, t, camera, progs);
      if (transparent.length) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        for (const e of transparent) drawSolid(e);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
      // 解析 MSAA
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, scene.msFBO);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, scene.resolve.fb);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (samples > 1) {
        // 累加
        const p = progs.copy;
        gl.bindFramebuffer(gl.FRAMEBUFFER, scene.sum.fb);
        gl.viewport(0, 0, W, H);
        gl.useProgram(p);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, scene.resolve.tex);
        gl.uniform1i(p.u.uTex, 0);
        gl.uniform2f(p.u.uRes, W, H);
        gl.uniform4f(p.u.uTint, 1 / samples, 1 / samples, 1 / samples, 1 / samples);
        drawFullscreen();
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
    }
    let colorTex = samples > 1 ? scene.sum.tex : scene.resolve.tex;
    // 景深
    if (camera.aperture > 0.01 && colorTex) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.dof.fb);
      gl.viewport(0, 0, W, H);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(progs.dof);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, colorTex); gl.uniform1i(progs.dof.u.uColor, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, scene.resolve.depthTex); gl.uniform1i(progs.dof.u.uDepth, 1);
      gl.uniform2f(progs.dof.u.uRes, W, H);
      gl.uniform1f(progs.dof.u.uNear, camera.near);
      gl.uniform1f(progs.dof.u.uFar, camera.far);
      gl.uniform1f(progs.dof.u.uFocus, camera.focus);
      gl.uniform1f(progs.dof.u.uAperture, camera.aperture);
      gl.uniform1f(progs.dof.u.uMaxRadius, Math.min(18, Math.max(2, camera.aperture * 6)));
      drawFullscreen();
      gl.enable(gl.DEPTH_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      colorTex = scene.dof.tex;
    }
    comp._cameraInfo = camera;
    comp._sceneInfo = { objects: objects.length, shadow: !!shadowMat, samples };
    return { colorTex, depthTex: scene.resolve.depthTex, camera, shadow: !!shadowMat, samples };
  }

  GL.renderScene = renderScene;

  // 直接绘制纹理至画布（用于最终画面之外的检查）
  GL.blitToCanvas = function (tex) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, currentCanvas.width, currentCanvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(progs.copy);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(progs.copy.u.uTex, 0);
    gl.uniform2f(progs.copy.u.uRes, W, H);
    gl.uniform4f(progs.copy.u.uTint, 1, 1, 1, 1);
    drawFullscreen();
    gl.enable(gl.DEPTH_TEST);
  };

  // ---------------- 合成着色器 ----------------
  const VS_LAYER = `#version 300 es
  precision highp float;
  const vec2 P[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  void main(){ gl_Position = vec4(P[gl_VertexID],0.0,1.0); }`;
  const FS_LAYER = `#version 300 es
  precision highp float;
  uniform sampler2D uSrc;
  uniform sampler2D uDst;
  uniform sampler2D uMask;
  uniform sampler2D uMatte;
  uniform vec2 uRes;
  uniform vec2 uCompSize;
  uniform vec2 uSrcSize;
  uniform mat3 uInvWorld;
  uniform float uHasSrc;
  uniform float uHasDst;
  uniform float uHasMask;
  uniform float uHasMatte;
  uniform float uFlipSrc;
  uniform float uMatteType;
  uniform float uMatteInvert;
  uniform float uOpacity;
  uniform float uAlphaScale;
  uniform int uBlend;
  uniform vec4 uMatteRect;
  out vec4 outColor;
  vec3 blendColor(vec3 cs, vec3 cb, float as, float ab, int mode, out float oa){
    oa = as + ab*(1.0-as);
    if(mode == 0) return cs + cb*(1.0-as);
    if(mode == 1) return min(cs + cb, vec3(1.0));
    if(mode == 2) return cs + cb - cs*cb;
    if(mode == 3) {
      vec3 csa = as > 0.0001 ? cs/as : vec3(0.0);
      vec3 cba = ab > 0.0001 ? cb/ab : vec3(0.0);
      vec3 r = csa * cba;
      return r*as*ab + cs*(1.0-ab) + cb*(1.0-as);
    }
    if(mode == 4) {
      vec3 csa = as > 0.0001 ? cs/as : vec3(0.0);
      vec3 cba = ab > 0.0001 ? cb/ab : vec3(0.0);
      vec3 r = mix(2.0*csa*cba, 1.0-2.0*(1.0-csa)*(1.0-cba), step(0.5, cba));
      return r*as*ab + cs*(1.0-ab) + cb*(1.0-as);
    }
    return cs + cb*(1.0-as);
  }
  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 compPos = vec2((uv.x - 0.5) * uCompSize.x, (0.5 - uv.y) * uCompSize.y);
    // 世界坐标（层源空间）
    vec3 srcPos = uInvWorld * vec3(compPos, 1.0);
    if(uHasSrc < 0.5) { outColor = uHasDst > 0.5 ? texture(uDst, uv) : vec4(0.0); return; }
    vec2 srcUv = srcPos.xy / uSrcSize + 0.5;
    if(uFlipSrc > 0.5) srcUv.y = 1.0 - srcUv.y;
    vec2 maskUv = srcPos.xy / uSrcSize + 0.5;
    if(srcUv.x < 0.0 || srcUv.x > 1.0 || srcUv.y < 0.0 || srcUv.y > 1.0) { outColor = uHasDst > 0.5 ? texture(uDst, uv) : vec4(0.0); return; }
    vec4 src = texture(uSrc, srcUv);
    src *= uAlphaScale;
    if(src.a <= 0.001) { outColor = uHasDst > 0.5 ? texture(uDst, uv) : vec4(0.0); return; }
    if(uHasMask > 0.5){
      float m = texture(uMask, maskUv).a;
      src *= m;
    }
    if(uHasMatte > 0.5){
      vec4 mt = texture(uMatte, uv);
      float m = uMatteType < 0.5 ? mt.a : dot(mt.rgb, vec3(0.299,0.587,0.114)) * mt.a;
      if(uMatteInvert > 0.5) m = 1.0 - m;
      src *= clamp(m, 0.0, 1.0);
    }
    src *= uOpacity;
    if(!gl_FrontFacing) { /* noop */ }
    vec4 dst = uHasDst > 0.5 ? texture(uDst, uv) : vec4(0.0);
    vec3 csa = src.a > 0.0001 ? src.rgb / src.a : vec3(0.0);
    vec3 cba = dst.a > 0.0001 ? dst.rgb / dst.a : vec3(0.0);
    float oa;
    vec3 blended = blendColor(csa*src.a, cba*dst.a, src.a, dst.a, uBlend, oa);
    outColor = vec4(blended, oa);
  }`;
  const FS_BG = `#version 300 es
  precision highp float;
  uniform vec2 uRes;
  uniform vec4 uColor;
  out vec4 o;
  void main(){ o = uColor; }`;

  GL.setupComposite = function () {
    progs.layer = program(VS_LAYER, FS_LAYER);
    progs.layer.u = uniforms(progs.layer);
    progs.bg = program(VS_QUAD, FS_BG);
    progs.bg.u = uniforms(progs.bg);
    progs.copy2 = program(VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uTex; uniform vec2 uRes; uniform vec4 uTint;
      out vec4 o;
      void main(){ o = texture(uTex, gl_FragCoord.xy/uRes) * uTint; }`);
    progs.copy2.u = uniforms(progs.copy2);
    // 效果程序
    progs.blur = program(VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uTex;
      uniform vec2 uRes;
      uniform vec2 uDir;
      uniform float uRadius;
      out vec4 o;
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;
        vec2 texel = 1.0 / uRes;
        if(uRadius < 0.3){ o = texture(uTex, uv); return; }
        vec4 sum = vec4(0.0); float ws = 0.0;
        for(int i=-9;i<=9;i++){
          float fi = float(i);
          float w = exp(-fi*fi/28.0);
          sum += texture(uTex, uv + uDir*texel*fi*uRadius*0.22) * w;
          ws += w;
        }
        o = sum/ws;
      }`);
    progs.blur.u = uniforms(progs.blur);
    progs.hsl = program(VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uTex;
      uniform vec2 uRes;
      uniform float uHue, uSat, uLight, uOp;
      out vec4 o;
      vec3 rgb2hsl(vec3 c){
        float mx = max(max(c.r,c.g),c.b); float mn = min(min(c.r,c.g),c.b);
        float h = 0.0, s = 0.0, l = (mx+mn)*0.5;
        if(mx != mn){
          float d = mx-mn;
          s = l > 0.5 ? d/(2.0-mx-mn) : d/(mx+mn);
          if(mx == c.r) h = (c.g-c.b)/d + (c.g<c.b?6.0:0.0);
          else if(mx == c.g) h = (c.b-c.r)/d + 2.0;
          else h = (c.r-c.g)/d + 4.0;
          h /= 6.0;
        }
        return vec3(h,s,l);
      }
      float hue2rgb(float p,float q,float t){
        if(t<0.0) t+=1.0; if(t>1.0) t-=1.0;
        if(t<1.0/6.0) return p+(q-p)*6.0*t;
        if(t<0.5) return q;
        if(t<2.0/3.0) return p+(q-p)*(2.0/3.0-t)*6.0;
        return p;
      }
      vec3 hsl2rgb(vec3 c){
        if(c.y <= 0.0001) return vec3(c.z);
        float q = c.z < 0.5 ? c.z*(1.0+c.y) : c.z+c.y-c.z*c.y;
        float p = 2.0*c.z - q;
        return vec3(hue2rgb(p,q,c.x+1.0/3.0), hue2rgb(p,q,c.x), hue2rgb(p,q,c.x-1.0/3.0));
      }
      void main(){
        vec2 uv = gl_FragCoord.xy/uRes;
        vec4 c = texture(uTex, uv);
        if(c.a < 0.0001){ o = c; return; }
        vec3 col = c.rgb / c.a;
        vec3 hsl = rgb2hsl(col);
        hsl.x = fract(hsl.x + uHue/360.0);
        hsl.y = clamp(hsl.y * uSat, 0.0, 1.0);
        hsl.z = clamp(hsl.z * uLight, 0.0, 1.0);
        col = hsl2rgb(hsl);
        o = vec4(col * c.a * uOp, c.a * uOp);
      }`);
    progs.hsl.u = uniforms(progs.hsl);
    progs.add = program(VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uA, uB;
      uniform vec2 uRes;
      uniform float uWeight;
      uniform vec4 uTintA;
      out vec4 o;
      void main(){
        vec2 uv = gl_FragCoord.xy/uRes;
        vec4 a = texture(uA, uv)*uTintA;
        vec4 b = texture(uB, uv);
        o = a*uWeight + b;
      }`);
    progs.add.u = uniforms(progs.add);
    GL.compositeReady = true;
  };

  GL.getPrograms = () => progs;
  GL.getGL = () => gl;
  GL.ensureSize = ensureSize;
  GL.makeTarget = makeTarget;
  GL.freeTarget = freeTarget;
  GL.drawFullscreen = drawFullscreen;
  GL.getSize = () => ({ w: W, h: H });
  GL.compileProgram = (vs, fs) => {
    const p = program(vs, fs);
    p.u = uniforms(p);
    return p;
  };
  GL.VS_QUAD = VS_QUAD;

  // 上传画布纹理
  const texCache = new Map();
  GL.canvasTexture = function (canvas) {
    if (!canvas) return null;
    const key = canvas.__texKey || (canvas.__texKey = 'c' + (++GL._texN || (GL._texN = 1)));
    let e = texCache.get(canvas);
    if (!e) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      e = { tex, w: 0, h: 0 };
      texCache.set(canvas, e);
    }
    gl.bindTexture(gl.TEXTURE_2D, e.tex);
    if (e.w !== canvas.width || e.h !== canvas.height) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      e.w = canvas.width; e.h = canvas.height;
    } else {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    }
    return e.tex;
  };

  GL.createRenderTarget = function (w, h, opts) { return makeTarget(w, h, opts); };
  GL.deleteTextureCache = function () {
    for (const [, e] of texCache) gl.deleteTexture(e.tex);
    texCache.clear();
  };

})(window);
