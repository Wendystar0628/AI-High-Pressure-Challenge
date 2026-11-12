// WebGL2 core: context, programs, fullscreen passes, bloom, instanced voxels
(function (global) {
  'use strict';

  const canvas = document.getElementById('c');
  const gl = canvas.getContext('webgl2', {
    antialias: false, alpha: false, depth: true, stencil: false,
    powerPreference: 'high-performance', preserveDrawingBuffer: false
  });
  if (!gl) {
    document.getElementById('loading').textContent = '需要支持 WebGL 2 的浏览器';
    throw new Error('WebGL2 unavailable');
  }

  const extFloat = gl.getExtension('EXT_color_buffer_float');
  const extHalf = gl.getExtension('EXT_color_buffer_half_float');
  const HDR_FMT = extFloat ? gl.RGBA16F : (extHalf ? gl.RGBA16F : gl.RGBA8);
  const HDR_TYPE = (extFloat || extHalf) ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

  // ---------- shader helpers ----------
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      console.error(log, src);
      throw new Error('shader: ' + log);
    }
    return s;
  }
  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('link: ' + gl.getProgramInfoLog(p));
    }
    const uniforms = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      uniforms[name] = gl.getUniformLocation(p, info.name);
    }
    return { prog: p, u: uniforms };
  }

  // ---------- voxel cube geometry ----------
  // 24 verts: pos(3) + normal(3)
  const CUBE = new Float32Array([
    // +X
    0.5, -0.5, -0.5, 1, 0, 0, 0.5, 0.5, -0.5, 1, 0, 0, 0.5, 0.5, 0.5, 1, 0, 0, 0.5, -0.5, 0.5, 1, 0, 0,
    // -X
    -0.5, -0.5, 0.5, -1, 0, 0, -0.5, 0.5, 0.5, -1, 0, 0, -0.5, 0.5, -0.5, -1, 0, 0, -0.5, -0.5, -0.5, -1, 0, 0,
    // +Y
    -0.5, 0.5, -0.5, 0, 1, 0, -0.5, 0.5, 0.5, 0, 1, 0, 0.5, 0.5, 0.5, 0, 1, 0, 0.5, 0.5, -0.5, 0, 1, 0,
    // -Y
    -0.5, -0.5, 0.5, 0, -1, 0, -0.5, -0.5, -0.5, 0, -1, 0, 0.5, -0.5, -0.5, 0, -1, 0, 0.5, -0.5, 0.5, 0, -1, 0,
    // +Z
    -0.5, -0.5, 0.5, 0, 0, 1, 0.5, -0.5, 0.5, 0, 0, 1, 0.5, 0.5, 0.5, 0, 0, 1, -0.5, 0.5, 0.5, 0, 0, 1,
    // -Z
    0.5, -0.5, -0.5, 0, 0, -1, -0.5, -0.5, -0.5, 0, 0, -1, -0.5, 0.5, -0.5, 0, 0, -1, 0.5, 0.5, -0.5, 0, 0, -1
  ]);
  const CUBE_IDX = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
  ]);

  const cubeVao = gl.createVertexArray();
  const cubeVbo = gl.createBuffer();
  const cubeIbo = gl.createBuffer();
  gl.bindVertexArray(cubeVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVbo);
  gl.bufferData(gl.ARRAY_BUFFER, CUBE, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, CUBE_IDX, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  // ---------- voxel shader ----------
  const VOXEL_VS = `#version 300 es
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec3 aNrm;
  layout(location=2) in vec3 aOffset;
  layout(location=3) in vec3 aColor;
  layout(location=4) in vec2 aMat; // x = emissive, y = variation
  uniform mat4 uProj, uView, uModel;
  out vec3 vNrm;
  out vec3 vColor;
  out vec2 vMat;
  out vec3 vWorld;
  void main(){
    vec4 w = uModel * vec4(aPos + aOffset, 1.0);
    vWorld = w.xyz;
    vNrm = mat3(uModel) * aNrm;
    vColor = aColor;
    vMat = aMat;
    gl_Position = uProj * uView * w;
  }`;

  const VOXEL_FS = `#version 300 es
  precision highp float;
  in vec3 vNrm;
  in vec3 vColor;
  in vec2 vMat;
  in vec3 vWorld;
  uniform vec3 uCamPos;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uAmbSky;
  uniform vec3 uAmbGround;
  uniform vec3 uPointPos[6];
  uniform vec3 uPointColor[6];
  uniform float uPointRadius[6];
  uniform int uPointCount;
  uniform float uFogDensity;
  uniform vec3 uFogColor;
  uniform float uEmissiveBoost;
  out vec4 frag;

  void main(){
    vec3 n = normalize(vNrm);
    vec3 albedo = vColor;
    albedo *= 1.0 + (vMat.y - 0.5) * 0.16;

    // voxel edge darkening: make each unit cube readable
    vec3 f = abs(fract(vWorld) - 0.5);
    float edge = max(f.x, max(f.y, f.z));
    float edgeShade = 1.0 - 0.30 * smoothstep(0.30, 0.47, edge);
    albedo *= edgeShade;

    float ndl = max(dot(n, uSunDir), 0.0);
    float wrap = max((dot(n, uSunDir) + 0.25) / 1.25, 0.0);
    vec3 sky = mix(uAmbGround, uAmbSky, n.y * 0.5 + 0.5);
    vec3 col = albedo * (uSunColor * (ndl * 0.85 + wrap * 0.15) + sky);

    // specular (sharp metal edge)
    vec3 v = normalize(uCamPos - vWorld);
    vec3 h = normalize(uSunDir + v);
    float spec = pow(max(dot(n, h), 0.0), 48.0);
    col += uSunColor * spec * 0.28 * (0.35 + 0.65 * ndl) * edgeShade;

    // point lights (interior / event lights)
    for (int i = 0; i < 6; i++) {
      if (i >= uPointCount) break;
      vec3 d = uPointPos[i] - vWorld;
      float dist = length(d);
      float att = clamp(1.0 - dist / uPointRadius[i], 0.0, 1.0);
      att *= att;
      float nd = max(dot(n, d / max(dist, 1e-3)), 0.0);
      col += albedo * uPointColor[i] * att * (nd * 0.8 + 0.2);
    }

    // emissive (ignore edge darkening so glow reads)
    col += vColor * vMat.x * uEmissiveBoost;

    // depth fog toward space haze
    float fd = length(uCamPos - vWorld) * uFogDensity;
    float fog = 1.0 - exp(-fd * fd);
    col = mix(col, uFogColor, clamp(fog, 0.0, 0.85));

    frag = vec4(col, 1.0);
  }`;

  const voxelProg = program(VOXEL_VS, VOXEL_FS);

  // ---------- fullscreen quad ----------
  const fsVao = gl.createVertexArray();
  const fsVbo = gl.createBuffer();
  gl.bindVertexArray(fsVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, fsVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const FS_VS = `#version 300 es
  layout(location=0) in vec2 aPos;
  out vec2 vUv;
  void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const BRIGHT_FS = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 frag;
  uniform sampler2D uTex;
  uniform float uThreshold;
  void main(){
    vec3 c = texture(uTex, vUv).rgb;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
    frag = vec4(c * k, 1.0);
  }`;

  const BLUR_FS = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 frag;
  uniform sampler2D uTex;
  uniform vec2 uDir; // texel-scaled direction
  void main(){
    vec3 s = texture(uTex, vUv).rgb * 0.227027;
    s += texture(uTex, vUv + uDir * 1.3846).rgb * 0.3162162;
    s += texture(uTex, vUv - uDir * 1.3846).rgb * 0.3162162;
    s += texture(uTex, vUv + uDir * 3.2308).rgb * 0.0702703;
    s += texture(uTex, vUv - uDir * 3.2308).rgb * 0.0702703;
    frag = vec4(s, 1.0);
  }`;

  const COMPOSITE_FS = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 frag;
  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform sampler2D uBloom2;
  uniform float uBloomStrength;
  uniform float uExposure;
  uniform float uTime;

  vec3 aces(vec3 x){
    const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
  }
  void main(){
    vec3 c = texture(uScene, vUv).rgb;
    vec3 b = texture(uBloom, vUv).rgb * 0.72 + texture(uBloom2, vUv).rgb * 0.55;
    c += b * uBloomStrength;
    c = aces(c * uExposure);
    vec2 q = vUv - 0.5;
    float vig = 1.0 - dot(q, q) * 0.55;
    c *= vig;
    float g = fract(sin(dot(vUv * 1234.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    c += (g - 0.5) * 0.012;
    c = pow(max(c, 0.0), vec3(1.0 / 2.2));
    frag = vec4(c, 1.0);
  }`;

  const brightProg = program(FS_VS, BRIGHT_FS);
  const blurProg = program(FS_VS, BLUR_FS);
  const compositeProg = program(FS_VS, COMPOSITE_FS);

  // ---------- glow shader (beams, flames, shields, trails) ----------
  const GLOW_VS = `#version 300 es
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec3 aNrm;
  layout(location=2) in vec3 aColor;
  layout(location=3) in vec2 aParam; // x = emissive strength, y = kind (0=flat color,1=use normal fade)
  uniform mat4 uProj, uView;
  out vec3 vColor;
  out vec2 vParam;
  out vec3 vNrm;
  out vec3 vWorld;
  void main(){
    vWorld = aPos;
    vNrm = aNrm;
    vColor = aColor;
    vParam = aParam;
    gl_Position = uProj * uView * vec4(aPos, 1.0);
  }`;

  const GLOW_FS = `#version 300 es
  precision highp float;
  in vec3 vColor;
  in vec2 vParam;
  in vec3 vNrm;
  in vec3 vWorld;
  uniform vec3 uCamPos;
  uniform float uGlobalAlpha;
  out vec4 frag;
  void main(){
    float a = vParam.x * uGlobalAlpha;
    if (a < 0.002) discard;
    vec3 v = normalize(uCamPos - vWorld);
    float nd = abs(dot(normalize(vNrm), v));
    if (vParam.y > 1.5) {
      // soft volumetric: bright when facing camera, fades at silhouette
      a *= pow(nd, 1.4);
    } else if (vParam.y > 0.5) {
      // rim glow: brighter at silhouette
      a *= mix(1.0, pow(1.0 - nd, 1.2), 0.85);
    }
    frag = vec4(vColor * a, a);
  }`;

  const glowProg = program(GLOW_VS, GLOW_FS);

  // ---------- point stars / dust ----------
  const POINT_VS = `#version 300 es
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec3 aColor;
  layout(location=2) in vec2 aSize; // x = size px, y = kind (0 star, 1 dust, 2 spark)
  uniform mat4 uProj, uView;
  uniform float uPixelRatio;
  out vec3 vColor;
  out float vAlpha;
  void main(){
    vec4 vp = uView * vec4(aPos, 1.0);
    gl_Position = uProj * vp;
    float d = max(-vp.z, 1.0);
    gl_PointSize = clamp(aSize.x * uPixelRatio * (2000.0 / d), 1.0, 64.0);
    vColor = aColor;
    vAlpha = aSize.y < 0.5 ? clamp(1.5 / d * 900.0, 0.15, 1.0) : 1.0;
  }`;

  const POINT_FS = `#version 300 es
  precision highp float;
  in vec3 vColor;
  in float vAlpha;
  out vec4 frag;
  void main(){
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = dot(p, p);
    if (r > 1.0) discard;
    float a = (1.0 - r) * (1.0 - r) * vAlpha;
    frag = vec4(vColor * a, a);
  }`;

  const pointProg = program(POINT_VS, POINT_FS);

  // ---------- sky (nebula + stars background) ----------
  const SKY_VS = `#version 300 es
  layout(location=0) in vec2 aPos;
  out vec2 vUv;
  void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.99999, 1.0); }`;

  const SKY_FS = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 frag;
  uniform mat4 uInvViewProj;
  uniform vec3 uCamPos;
  uniform float uTime;

  float hash21(vec2 p){
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i), b = hash21(i + vec2(1,0));
    float c = hash21(i + vec2(0,1)), d = hash21(i + vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main(){
    vec4 nd = uInvViewProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 dir = normalize(nd.xyz / nd.w - uCamPos);

    // deep space base
    vec3 col = vec3(0.008, 0.012, 0.024);

    // large nebula layers
    float n1 = fbm(dir.xy * 2.4 + dir.z * 1.2 + 3.7);
    float n2 = fbm(dir.yz * 3.1 - dir.x * 0.8 + 11.2);
    float band = smoothstep(0.25, 0.85, n1 * 0.7 + n2 * 0.5);
    vec3 nebA = vec3(0.07, 0.11, 0.28);
    vec3 nebB = vec3(0.20, 0.08, 0.26);
    vec3 nebC = vec3(0.05, 0.20, 0.26);
    col += nebA * band * 0.75;
    col += nebB * smoothstep(0.45, 0.95, n2) * 0.5;
    col += nebC * smoothstep(0.55, 1.0, fbm(dir.zx * 1.7 + 21.0)) * 0.35;

    // bright nebula core (soft)
    float core = pow(max(dot(dir, normalize(vec3(0.55, 0.22, -0.8))), 0.0), 6.0);
    col += vec3(0.28, 0.34, 0.60) * core * 0.5;

    // distant galaxy arc / celestial body limb
    float limb = pow(max(dot(dir, normalize(vec3(-0.75, 0.35, 0.55))), 0.0), 40.0);
    col += vec3(0.42, 0.36, 0.30) * limb * 0.7;

    // star field: 2 layers
    for (int layer = 0; layer < 2; layer++) {
      float scale = layer == 0 ? 140.0 : 320.0;
      vec2 sp = dir.xy / max(abs(dir.z) + 0.35, 0.2) * scale;
      sp += dir.z * 17.0;
      vec2 cell = floor(sp);
      float h = hash21(cell + float(layer) * 17.0);
      if (h > 0.976) {
        vec2 f = fract(sp) - 0.5;
        float d = length(f);
        float tw = 0.75 + 0.25 * sin(uTime * 1.7 + h * 40.0);
        float s = exp(-d * d * (layer == 0 ? 36.0 : 60.0)) * tw;
        vec3 sc = mix(vec3(0.70, 0.82, 1.0), vec3(1.0, 0.90, 0.75), hash21(cell + 3.3));
        col += sc * s * (layer == 0 ? 0.85 : 0.5);
      }
    }

    frag = vec4(col, 1.0);
  }`;

  const skyProg = program(SKY_VS, SKY_FS);

  // ---------- dynamic mesh (glow quads / boxes) ----------
  function createDynMesh(maxVerts) {
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, maxVerts * 11 * 4, gl.DYNAMIC_DRAW);
    // pos3, nrm3, color3, param2
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 44, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 44, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 44, 24);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 44, 36);
    gl.bindVertexArray(null);
    return { vao, vbo, maxVerts, count: 0, data: new Float32Array(maxVerts * 11) };
  }

  function createPointMesh(maxPts) {
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, maxPts * 8 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
    gl.bindVertexArray(null);
    return { vao, vbo, maxPts, count: 0, data: new Float32Array(maxPts * 8) };
  }

  // ---------- framebuffers ----------
  function createTexFBO(w, h, fmt, type, filter) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex, w, h };
  }

  function createDepthFBO(w, h, fmt, type) {
    const color = createTexFBO(w, h, fmt, type);
    gl.bindFramebuffer(gl.FRAMEBUFFER, color.fbo);
    const depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    color.depth = depth;
    return color;
  }

  // ---------- instanced voxel batch ----------
  function createVoxelBatch(maxInstances) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ARRAY_BUFFER, maxInstances * 8 * 4, gl.DYNAMIC_DRAW);
    // offset3, color3, mat2
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 32, 12);
    gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 32, 24);
    gl.vertexAttribDivisor(4, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIbo);
    gl.bindVertexArray(null);
    return {
      vao, ibo, maxInstances,
      count: 0,
      data: new Float32Array(maxInstances * 8),
      bounds: { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }
    };
  }

  function uploadVoxelBatch(batch, data, count) {
    batch.count = count;
    if (count > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, batch.ibo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * 8);
    }
  }

  function drawVoxelBatch(batch) {
    if (batch.count <= 0) return;
    gl.bindVertexArray(batch.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, batch.count);
    gl.bindVertexArray(null);
  }

  global.GL = {
    gl, canvas, extFloat,
    program, compile,
    voxelProg, glowProg, pointProg, skyProg,
    brightProg, blurProg, compositeProg,
    fsVao,
    createDynMesh, createPointMesh,
    createTexFBO, createDepthFBO,
    createVoxelBatch, uploadVoxelBatch, drawVoxelBatch,
    HDR_FMT, HDR_TYPE
  };
})(window);
