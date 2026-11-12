// WebGL2 renderer, voxel mesh builder, post processing and procedural space backdrop.
const GFX = (() => {
  let gl = null;

  function compile(type, src, name) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      console.error('Shader compile error [' + name + ']:', log, '\n' + src);
      throw new Error('shader compile ' + name + ': ' + log);
    }
    return s;
  }
  function program(vsSrc, fsSrc, name) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc, name + '.vs'));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc, name + '.fs'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      console.error('Program link error [' + name + ']:', log);
      throw new Error('program link ' + name + ': ' + log);
    }
    return new Program(p);
  }

  class Program {
    constructor(p) {
      this.p = p;
      this.u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        let name = info.name.replace(/\[0\]$/, '');
        this.u[name] = gl.getUniformLocation(p, info.name);
      }
    }
    use() { gl.useProgram(this.p); return this; }
    m4(name, v) { if (this.u[name]) gl.uniformMatrix4fv(this.u[name], false, v); }
    f(name, v) { if (this.u[name]) gl.uniform1f(this.u[name], v); }
    i(name, v) { if (this.u[name]) gl.uniform1i(this.u[name], v); }
    v2(name, x, y) { if (this.u[name]) gl.uniform2f(this.u[name], x, y); }
    v3(name, v) { if (this.u[name]) gl.uniform3f(this.u[name], v[0], v[1], v[2]); }
    v4(name, v) { if (this.u[name]) gl.uniform4f(this.u[name], v[0], v[1], v[2], v[3]); }
    v3a(name, arr) { if (this.u[name]) gl.uniform3fv(this.u[name], arr); }
    v4a(name, arr) { if (this.u[name]) gl.uniform4fv(this.u[name], arr); }
  }

  // =====================================================================
  // Voxel mesh builder. Every primitive is a grid-aligned / rotated block.
  // =====================================================================
  const FACE_SHADE = [0.94, 0.72, 1.0, 0.55, 0.86, 0.8]; // +x,-x,+y,-y,+z,-z

  class MeshBuilder {
    constructor(seed = 1, voxel = 1) {
      this.pos = [];
      this.nrm = [];
      this.col = [];
      this.glow = [];
      this.idx = [];
      this.vc = 0;
      this.rng = M.mulberry32(seed);
      this.boxes = 0;
      this.voxel = voxel;
      this.min = [1e9, 1e9, 1e9];
      this.max = [-1e9, -1e9, -1e9];
    }
    _v(p, n, c, g) {
      this.pos.push(p[0], p[1], p[2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.col.push(c[0], c[1], c[2]);
      this.glow.push(g);
      this.vc++;
    }
    _quad(pts, n, color, glow, shade) {
      const base = this.vc;
      for (let i = 0; i < 4; i++) {
        this._v(pts[i], n, [color[0] * shade, color[1] * shade, color[2] * shade], glow);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      for (let i = 0; i < 4; i++) {
        const p = pts[i];
        if (p[0] < this.min[0]) this.min[0] = p[0];
        if (p[1] < this.min[1]) this.min[1] = p[1];
        if (p[2] < this.min[2]) this.min[2] = p[2];
        if (p[0] > this.max[0]) this.max[0] = p[0];
        if (p[1] > this.max[1]) this.max[1] = p[1];
        if (p[2] > this.max[2]) this.max[2] = p[2];
      }
    }
    _emitFace(local, rot, center, color, glow, vi, shade, variation) {
      // rotate local corner offsets
      const r = rot;
      const xf = (p) => {
        let x = p[0], y = p[1], z = p[2];
        // Rx
        let y1 = y * r.cx - z * r.sx, z1 = y * r.sx + z * r.cx;
        // Ry
        let x2 = x * r.cy + z1 * r.sy, z2 = -x * r.sy + z1 * r.cy;
        // Rz
        let x3 = x2 * r.cz - y1 * r.sz, y3 = x2 * r.sz + y1 * r.cz;
        return [x3 + center[0], y3 + center[1], z2 + center[2]];
      };
      const nl = local.n;
      // normals rotate the same way
      let nx = nl[0], ny = nl[1], nz = nl[2];
      let ny1 = ny * r.cx - nz * r.sx, nz1 = ny * r.sx + nz * r.cx;
      let nx2 = nx * r.cy + nz1 * r.sy, nz2 = -nx * r.sy + nz1 * r.cy;
      let nx3 = nx2 * r.cz - ny1 * r.sz, ny3 = nx2 * r.sz + ny1 * r.cz;
      const n = [nx3, ny3, nz2];
      const pts = [];
      for (let i = 0; i < 4; i++) pts.push(xf(local.p[i]));
      const varf = 1 + (this.rng() - 0.5) * variation;
      this._quad(pts, n, color, glow, shade * varf);
    }
    // axis aligned box from min/max corners
    box(x0, y0, z0, x1, y1, z1, color, opt = {}) {
      if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
      if (y0 > y1) { const t = y0; y0 = y1; y1 = t; }
      if (z0 > z1) { const t = z0; z0 = z1; z1 = t; }
      const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
      const h = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
      this.boxC(c[0], c[1], c[2], h[0], h[1], h[2], color, opt);
    }
    // center + half extents + euler rotation
    boxC(cx, cy, cz, hx, hy, hz, color, opt = {}) {
      if (hx <= 0 || hy <= 0 || hz <= 0) return;
      this.boxes++;
      const a = opt.rot || [0, 0, 0];
      const rot = {
        cx: Math.cos(a[0]), sx: Math.sin(a[0]),
        cy: Math.cos(a[1]), sy: Math.sin(a[1]),
        cz: Math.cos(a[2]), sz: Math.sin(a[2]),
      };
      const glow = opt.glow || 0;
      const variation = opt.var === undefined ? 0.055 : opt.var;
      const faces = opt.faces === undefined ? 63 : opt.faces;
      const c = [cx, cy, cz];
      const corners = (ix, iy, iz) => [ix * hx, iy * hy, iz * hz];
      const defs = [
        { n: [1, 0, 0], p: [corners(1, -1, -1), corners(1, 1, -1), corners(1, 1, 1), corners(1, -1, 1)], shade: FACE_SHADE[0], bit: 1 },
        { n: [-1, 0, 0], p: [corners(-1, -1, -1), corners(-1, -1, 1), corners(-1, 1, 1), corners(-1, 1, -1)], shade: FACE_SHADE[1], bit: 2 },
        { n: [0, 1, 0], p: [corners(-1, 1, -1), corners(-1, 1, 1), corners(1, 1, 1), corners(1, 1, -1)], shade: FACE_SHADE[2], bit: 4 },
        { n: [0, -1, 0], p: [corners(-1, -1, -1), corners(1, -1, -1), corners(1, -1, 1), corners(-1, -1, 1)], shade: FACE_SHADE[3], bit: 8 },
        { n: [0, 0, 1], p: [corners(-1, -1, 1), corners(1, -1, 1), corners(1, 1, 1), corners(-1, 1, 1)], shade: FACE_SHADE[4], bit: 16 },
        { n: [0, 0, -1], p: [corners(-1, -1, -1), corners(-1, 1, -1), corners(1, 1, -1), corners(1, -1, -1)], shade: FACE_SHADE[5], bit: 32 },
      ];
      for (const d of defs) {
        if (!(faces & d.bit)) continue;
        const shade = opt.flat ? 1.0 : d.shade;
        this._emitFace({ p: d.p, n: d.n }, rot, c, color, glow, 0, shade, opt.var === undefined ? variation : opt.var);
      }
    }
    scaleAll(s) {
      for (let i = 0; i < this.pos.length; i++) this.pos[i] *= s;
      for (let i = 0; i < 3; i++) { this.min[i] *= s; this.max[i] *= s; }
      return this;
    }
    // thin glowing strip
    glowBox(x0, y0, z0, x1, y1, z1, color, intensity = 2.2, opt = {}) {
      this.box(x0, y0, z0, x1, y1, z1, color, Object.assign({ glow: intensity, flat: true, var: 0.02 }, opt));
    }
    finish() {
      return makeMesh(this.pos, this.nrm, this.col, this.glow, this.idx);
    }
  }

  function makeMesh(pos, nrm, col, glow, idx) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const stride = 10 * 4;
    const data = new Float32Array(pos.length / 3 * 10);
    for (let i = 0, k = 0; i < pos.length / 3; i++) {
      data[k++] = pos[i * 3]; data[k++] = pos[i * 3 + 1]; data[k++] = pos[i * 3 + 2];
      data[k++] = nrm[i * 3]; data[k++] = nrm[i * 3 + 1]; data[k++] = nrm[i * 3 + 2];
      data[k++] = col[i * 3]; data[k++] = col[i * 3 + 1]; data[k++] = col[i * 3 + 2];
      data[k++] = glow[i];
    }
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 36);
    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    const indexData = (idx.length > 65535 * 3 ? new Uint32Array(idx) : new Uint32Array(idx));
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, vbo, ebo, count: idx.length, vertices: pos.length / 3 };
  }

  // =====================================================================
  // Shaders
  // =====================================================================
  const MAIN_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 aCol;
layout(location=3) in float aGlow;
uniform mat4 uVP;
uniform mat4 uModel;
out vec3 vWorld;
out vec3 vN;
out vec3 vCol;
out float vGlow;
out vec3 vLocal;
void main(){
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vN = mat3(uModel) * aNrm;
  vCol = aCol;
  vGlow = aGlow;
  vLocal = aPos;
  gl_Position = uVP * w;
}`;

  const MAIN_FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vN;
in vec3 vCol;
in float vGlow;
in vec3 vLocal;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform vec3 uFillDir;
uniform vec3 uFillColor;
uniform vec3 uCamFill;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uEmissive;
uniform vec3 uTint;
uniform int uLightCount;
uniform vec4 uLightPos[8];
uniform vec3 uLightColor[8];
out vec4 outColor;
void main(){
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vWorld);
  float ndl = max(dot(N, uSunDir), 0.0);
  vec3 amb = mix(uAmbGround, uAmbSky, N.y * 0.5 + 0.5);
  // soft wrapped diffuse for a chunkier, filmic falloff
  float wrap = max(dot(N, uSunDir) * 0.65 + 0.35, 0.0);
  vec3 col = vCol * (amb + uSunColor * mix(ndl, wrap, 0.45));
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 38.0);
  col += uSunColor * spec * 0.22;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2);
  col += vCol * uFillColor * max(dot(N, uFillDir), 0.0);
  col += vCol * uCamFill * max(dot(N, V), 0.0);
  col += vec3(0.07, 0.15, 0.20) * rim * 1.1;
  for (int i = 0; i < 8; i++) {
    if (i >= uLightCount) break;
    vec3 L = uLightPos[i].xyz - vWorld;
    float d = length(L);
    float r = uLightPos[i].w;
    float att = clamp(1.0 - d / r, 0.0, 1.0);
    att *= att;
    col += vCol * uLightColor[i] * att * max(dot(N, normalize(L)) * 0.7 + 0.3, 0.0) * 2.0;
  }
  col += vCol * vGlow * uEmissive;
  float dist = length(uCamPos - vWorld);
  float fog = 1.0 - exp(-dist * uFogDensity);
  col = mix(col, uFogColor, fog * (1.0 - min(vGlow, 1.0) * 0.55));
  col *= uTint;
  outColor = vec4(col, 1.0);
}`;

  const BG_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const BG_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;
uniform mat4 uInvVP;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uSpaceMode;
uniform float uStarScale;
uniform vec3 uTint;

float hash13(vec3 p3){
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise3(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x);
  f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i), hash13(i+vec3(1,0,0)), f.x),
                 mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x),
                 mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){
  float a = 0.5; float s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * noise3(p); p = p * 2.03 + vec3(11.3, 7.7, 3.1); a *= 0.5; }
  return s;
}
vec3 starLayer(vec3 d, float scale, float density, float bright, float seed){
  float lon = atan(d.z, d.x) * 0.15915494;
  float lat = asin(clamp(d.y, -1.0, 1.0)) * 0.31830989;
  vec2 sp = vec2(lon * cos(lat * 3.14159), lat) * scale;
  vec2 ci = floor(sp); vec2 f = fract(sp) - 0.5;
  float h = hash13(vec3(ci, seed));
  float h2 = hash13(vec3(ci.yx + 17.0, seed + 3.1));
  vec2 off = (vec2(h, h2) - 0.5) * 0.72;
  float rad = length(f - off);
  float core = smoothstep(0.075, 0.0, rad);
  float on = step(1.0 - density, hash13(vec3(ci, seed + 7.7)));
  float mag = pow(hash13(vec3(ci * 1.31, seed + 11.0)), 4.0);
  return vec3(core * on * mag * bright);
}
void main(){
  vec4 fp = uInvVP * vec4(vUV, 1.0, 1.0);
  vec3 dir = normalize(fp.xyz / fp.w - uCamPos);
  vec3 col = vec3(0.0025, 0.0042, 0.010);
  vec3 q = dir * 2.5 + vec3(0.0, 0.2, 1.7);
  float n = fbm(q + fbm(q * 1.7) * 0.6);
  float band = exp(-pow(abs(dot(dir, normalize(vec3(0.25, 0.9, 0.35)))), 2.0) * 7.0);
  col += vec3(0.030, 0.105, 0.140) * smoothstep(0.34, 0.80, n) * (0.65 + band * 0.7);
  col += vec3(0.160, 0.062, 0.130) * smoothstep(0.52, 0.92, n * 1.1 + band * 0.18) * band;
  col += vec3(0.018, 0.040, 0.070) * n * 0.55;
  vec3 st = vec3(0.0);
  st += starLayer(dir, 430.0 * uStarScale, 0.15, 1.25, 1.3) * vec3(0.88, 0.95, 1.10);
  st += starLayer(dir, 175.0 * uStarScale, 0.11, 0.95, 7.1) * vec3(1.05, 0.90, 0.78);
  st += starLayer(dir, 72.0 * uStarScale, 0.075, 1.7, 3.7) * vec3(0.82, 0.92, 1.0);
  float tw = 0.82 + 0.18 * sin(uTime * 1.1 + st.g * 34.0);
  col += st * tw;
  // ---- distant ringed world ----
  vec3 pcDir = normalize(vec3(0.56, 0.06, 0.61));
  float pd = dot(dir, pcDir);
  if (pd > 0.94) {
    vec3 t1 = normalize(cross(pcDir, vec3(0.0, 1.0, 0.0)));
    vec3 t2 = cross(t1, pcDir);
    float sinA = 0.125;
    vec2 q = vec2(dot(dir, t1), dot(dir, t2)) / sinA;
    float rr = length(q);
    // rings first (behind and in front of the globe)
    vec2 rq = vec2(q.x, q.y / 0.30);
    float ringR = length(rq);
    float ringBand = smoothstep(0.10, 0.0, abs(ringR - 1.85))
                   + smoothstep(0.06, 0.0, abs(ringR - 2.08)) * 0.65;
    ringBand += smoothstep(0.03, 0.0, abs(ringR - 1.62)) * 0.35;
    float ringNoise = 0.55 + 0.45 * noise3(vec3(rq * 3.0, 4.2));
    float ring = ringBand * ringNoise;
    ring *= smoothstep(3.0, 1.25, ringR) * smoothstep(0.94, 1.35, ringR);
    if (rr < 1.0) {
      float zz = sqrt(max(0.0, 1.0 - rr * rr));
      vec3 n = normalize(pcDir * zz + t1 * q.x + t2 * q.y);
      float lat = n.y + (fbm(n * 5.0 + 3.0) - 0.5) * 0.22;
      float bands = 0.5 + 0.5 * sin(lat * 26.0 + fbm(n * 3.0) * 3.5 + 1.3);
      bands = smoothstep(0.2, 0.85, bands);
      float lit = smoothstep(-0.25, 0.45, dot(n, uSunDir));
      vec3 surf = mix(vec3(0.030, 0.070, 0.085), vec3(0.21, 0.27, 0.25), bands);
      surf = mix(surf, vec3(0.36, 0.24, 0.15), smoothstep(0.72, 0.95, bands) * 0.45);
      vec3 pcol = surf * (0.16 + lit * 1.25);
      pcol += vec3(0.14, 0.32, 0.44) * pow(1.0 - zz, 3.0) * 0.55 * (0.3 + lit);
      float edge = smoothstep(1.0, 0.985, rr);
      col = mix(col, pcol, edge);
      // ring crossing over the lit globe
      col += vec3(0.55, 0.42, 0.28) * ring * 0.28;
    } else {
      col += vec3(0.55, 0.44, 0.32) * ring * 0.30;
    }
  }
  float sd = max(dot(dir, uSunDir), 0.0);
  vec3 sunCol = vec3(1.0, 0.80, 0.55);
  col += sunCol * pow(sd, 2600.0) * 3.0;
  col += sunCol * pow(sd, 110.0) * 0.26;
  col += sunCol * pow(sd, 9.0) * 0.045;
  // deep space is dimmed when inside a ship
  col *= mix(1.0, 0.42, uSpaceMode);
  outColor = vec4(col * uTint, 1.0);
}`;

  const SPRITE_VS = `#version 300 es
layout(location=0) in vec3 aCenter;
layout(location=1) in vec2 aCorner;
layout(location=2) in vec3 aColor;
layout(location=3) in vec2 aSize;
layout(location=4) in float aShape;
layout(location=5) in float aRot;
uniform mat4 uVP;
uniform vec3 uRight;
uniform vec3 uUp;
out vec2 vUV;
out vec3 vCol;
out float vShape;
void main(){
  float c = cos(aRot), s = sin(aRot);
  vec2 cr = vec2(aCorner.x * c - aCorner.y * s, aCorner.x * s + aCorner.y * c);
  vec3 wp = aCenter + (uRight * cr.x * aSize.x + uUp * cr.y * aSize.y);
  vUV = aCorner;
  vCol = aColor;
  vShape = aShape;
  gl_Position = uVP * vec4(wp, 1.0);
}`;

  const SPRITE_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vCol;
in float vShape;
uniform float uTime;
out vec4 outColor;
void main(){
  float r = length(vUV);
  float a;
  if (vShape < 0.5) {
    a = exp(-r * r * 4.6);
  } else if (vShape < 1.5) {
    a = (1.0 - smoothstep(0.30, 1.0, r)) * 0.85;
  } else if (vShape < 2.5) {
    a = (1.0 - smoothstep(0.0, 0.06, abs(r - 0.72))) + 0.10 * (1.0 - smoothstep(0.7, 0.95, r));
  } else if (vShape < 3.5) {
    float ang = atan(vUV.y, vUV.x);
    float spikes = pow(max(0.0, cos(ang * 2.0)), 10.0);
    a = exp(-r * 3.2) * (0.30 + spikes * 1.7);
  } else if (vShape < 4.5) {
    a = (1.0 - smoothstep(0.0, 1.0, r)) * 0.32 + exp(-r * r * 9.0);
  } else {
    // energy shield dome: thin bright rim, faint glass, flowing interior bands
    float ang = atan(vUV.y, vUV.x);
    float rim = (1.0 - smoothstep(0.0, 0.055, abs(r - 0.90))) * 0.9;
    float glass = smoothstep(1.0, 0.52, r) * 0.055;
    float bands = 0.5 + 0.5 * sin(ang * 7.0 + r * 15.0 - uTime * 1.7);
    float band = smoothstep(0.94, 0.55, r) * smoothstep(0.30, 0.92, bands) * 0.07;
    float hex = (1.0 - smoothstep(0.0, 0.04, abs(sin(ang * 9.0 + uTime * 0.4) * sin(r * 18.0)))) * 0.035;
    a = rim + glass + band + hex;
  }
  a = clamp(a, 0.0, 2.0);
  outColor = vec4(vCol * a, a);
}`;

  const BEAM_VS = `#version 300 es
layout(location=0) in vec2 aTS;
uniform mat4 uVP;
uniform vec3 uStart;
uniform vec3 uEnd;
uniform vec3 uWidthDir;
uniform float uWidth0;
uniform float uWidth1;
out float vT;
out float vSide;
void main(){
  float t = aTS.x;
  float side = aTS.y;
  vec3 p = mix(uStart, uEnd, t);
  float w = mix(uWidth0, uWidth1, t);
  vec3 wp = p + uWidthDir * side * w;
  vT = t; vSide = side;
  gl_Position = uVP * vec4(wp, 1.0);
}`;

  const BEAM_FS = `#version 300 es
precision highp float;
in float vT;
in float vSide;
uniform vec3 uColor;
uniform float uTime;
uniform float uAlpha;
uniform float uMode;
out vec4 outColor;
void main(){
  float e = abs(vSide);
  float core = exp(-e * e * 70.0);
  float glow = exp(-e * e * 5.0) * 0.55;
  float stripes = 0.72 + 0.28 * sin(vT * 140.0 - uTime * 38.0 + vSide * 2.0);
  float ends;
  if (uMode < 0.5) {
    ends = smoothstep(0.0, 0.025, vT) * smoothstep(1.0, 0.90, vT);
  } else {
    ends = smoothstep(0.0, 0.02, vT) * pow(max(1.0 - vT, 0.0), 1.35);
  }
  float a = (core * 1.35 + glow) * stripes * uAlpha * ends;
  outColor = vec4(uColor * a, a);
}`;

  const SHIELD_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUV;
uniform mat4 uVP;
uniform mat4 uModel;
out vec3 vWorld;
out vec3 vN;
out vec2 vUV;
void main(){
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vN = mat3(uModel) * aNrm;
  vUV = aUV;
  gl_Position = uVP * w;
}`;

  const SHIELD_FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vN;
in vec2 vUV;
uniform vec3 uCamPos;
uniform vec3 uColor;
uniform vec3 uCenter;
uniform vec3 uRadii;
uniform float uTime;
uniform float uAlpha;
uniform float uDeploy;
out vec4 outColor;
void main(){
  vec3 N = normalize((vWorld - uCenter) / (uRadii * uRadii));
  vec3 V = normalize(uCamPos - vWorld);
  float fres = pow(1.0 - abs(dot(N, V)), 2.2);
  float lon = atan(N.z, N.x);
  float lat = asin(clamp(N.y, -1.0, 1.0));
  float hexu = lon * 7.0 + sin(lat * 5.0) * 0.7;
  float hexv = lat * 9.0;
  float lines = smoothstep(0.86, 1.0, abs(sin(hexu * 3.0))) * 0.25
              + smoothstep(0.88, 1.0, abs(sin(hexv * 3.0))) * 0.20;
  float flow = 0.5 + 0.5 * sin(lat * 22.0 - uTime * 2.2 + sin(lon * 3.0 + uTime * 0.7) * 2.0);
  float wave = (1.0 - smoothstep(0.0, 0.10, abs(fract(vUV.y - uTime * 0.16) - 0.5))) * 0.35;
  float rim = fres * 0.55 + lines * 0.30 + flow * 0.05 + wave * 0.5;
  float a = clamp(rim * uAlpha * uDeploy, 0.0, 1.0);
  outColor = vec4(uColor * a, a);
}`;

  const DEBRIS_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 iPos;
layout(location=3) in vec3 iHalf;
layout(location=4) in vec3 iColor;
uniform mat4 uVP;
out vec3 vN;
out vec3 vCol;
out vec3 vWorld;
void main(){
  vec3 w = iPos + aPos * iHalf;
  vWorld = w;
  vN = aNrm;
  vCol = iColor;
  gl_Position = uVP * vec4(w, 1.0);
}`;

  const DEBRIS_FS = `#version 300 es
precision highp float;
in vec3 vN;
in vec3 vCol;
in vec3 vWorld;
uniform vec3 uSunDir;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uCamPos;
out vec4 outColor;
void main(){
  vec3 N = normalize(vN);
  float ndl = max(dot(N, uSunDir), 0.0);
  float wrap = max(dot(N, uSunDir) * 0.6 + 0.4, 0.0);
  vec3 amb = mix(uGround, uSky, N.y * 0.5 + 0.5);
  vec3 col = vCol * (amb + vec3(1.0, 0.92, 0.82) * mix(ndl, wrap, 0.4));
  vec3 V = normalize(uCamPos - vWorld);
  col += vCol * pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.12;
  outColor = vec4(col, 1.0);
}`;

  const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const BRIGHT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 outColor;
void main(){
  vec3 c = texture(uTex, vUV + uTexel * vec2(-0.5, -0.5)).rgb;
  c += texture(uTex, vUV + uTexel * vec2(0.5, -0.5)).rgb;
  c += texture(uTex, vUV + uTexel * vec2(-0.5, 0.5)).rgb;
  c += texture(uTex, vUV + uTexel * vec2(0.5, 0.5)).rgb;
  c *= 0.25;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = max(l - 0.88, 0.0) / max(l, 0.0001);
  outColor = vec4(c * k, 1.0);
}`;

  const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 outColor;
void main(){
  vec3 c = texture(uTex, vUV).rgb * 0.227027;
  c += texture(uTex, vUV + uDir * 1.3846).rgb * 0.316216;
  c += texture(uTex, vUV - uDir * 1.3846).rgb * 0.316216;
  c += texture(uTex, vUV + uDir * 3.2308).rgb * 0.070270;
  c += texture(uTex, vUV - uDir * 3.2308).rgb * 0.070270;
  outColor = vec4(c, 1.0);
}`;

  const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uTime;
out vec4 outColor;
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main(){
  vec3 c = texture(uScene, vUV).rgb;
  vec3 b = texture(uBloom, vUV).rgb;
  c += b * uBloomStrength;
  c *= uExposure;
  // soft highlight shoulder
  c = c * (1.0 + 0.10) / (1.0 + c * 0.22);
  // gentle cool grade in the shadows, warm highlights
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, c * vec3(0.90, 1.00, 1.10), (1.0 - smoothstep(0.0, 0.35, l)) * 0.45);
  c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, 1.09);
  vec2 q = vUV - 0.5;
  float vig = 1.0 - smoothstep(0.28, 0.95, length(q * vec2(1.05, 1.25)));
  c *= mix(0.80, 1.0, vig);
  c += (hash12(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.0035;
  outColor = vec4(max(c, vec3(0.0)), 1.0);
}`;

  // =====================================================================
  // Renderer
  // =====================================================================
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      gl = canvas.getContext('webgl2', {
        alpha: false, antialias: false, depth: true, stencil: false,
        powerPreference: 'high-performance', preserveDrawingBuffer: false,
      });
      if (!gl) throw new Error('WebGL2 unavailable');
      this.gl = gl;
      this.samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
      this.w = 0; this.h = 0;
      this.progMain = program(MAIN_VS, MAIN_FS, 'main');
      this.progBg = program(BG_VS, BG_FS, 'bg');
      this.progSprite = program(SPRITE_VS, SPRITE_FS, 'sprite');
      this.progBeam = program(BEAM_VS, BEAM_FS, 'beam');
      this.progShield = program(SHIELD_VS, SHIELD_FS, 'shield');
      this.progDebris = program(DEBRIS_VS, DEBRIS_FS, 'debris');
      this.progBright = program(QUAD_VS, BRIGHT_FS, 'bright');
      this.progBlur = program(QUAD_VS, BLUR_FS, 'blur');
      this.progComposite = program(QUAD_VS, COMPOSITE_FS, 'composite');
      this.quadVao = gl.createVertexArray();
      gl.bindVertexArray(this.quadVao);
      const qb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, qb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      this.sprites = new SpriteBatch(this);
      this.beams = new BeamRenderer(this);
      this.shields = new ShieldRenderer(this);
      this.debris = new DebrisRenderer(this);
      this.env = {
        sunDir: [0.5, 0.45, -0.65], sunColor: [1.0, 0.92, 0.82],
        ambSky: [0.15, 0.21, 0.27], ambGround: [0.05, 0.07, 0.10],
        fillDir: [0.45, 0.22, 0.78], fillColor: [0.10, 0.145, 0.175],
        fogColor: [0.008, 0.016, 0.028], fogDensity: 0.000045,
        emissive: 1.9, tint: [1, 1, 1],
        lights: [],
      };
      this.resize(1, 1);
    }

    resize(w, h) {
      w = Math.max(1, Math.floor(w));
      h = Math.max(1, Math.floor(h));
      if (w === this.w && h === this.h) return;
      this.w = w; this.h = h;
      this.canvas.width = w; this.canvas.height = h;
      this._deleteTargets();
      this.sceneTex = this._makeTex(w, h);
      this.sceneFBO = this._makeFBO(this.sceneTex, null);
      if (this.samples > 0) {
        this.msaaColor = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaColor);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.RGBA8, w, h);
        this.msaaDepth = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaDepth);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.DEPTH_COMPONENT24, w, h);
        this.msaaFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFBO);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.msaaColor);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.msaaDepth);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
      this.hw = hw; this.hh = hh;
      this.brightTex = this._makeTex(hw, hh);
      this.brightFBO = this._makeFBO(this.brightTex, null);
      this.blurTexA = this._makeTex(hw, hh);
      this.blurFBOA = this._makeFBO(this.blurTexA, null);
      this.blurTexB = this._makeTex(hw, hh);
      this.blurFBOB = this._makeFBO(this.blurTexB, null);
    }

    _makeTex(w, h) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    _makeFBO(tex, depth) {
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      if (depth) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) console.warn('incomplete FBO');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return f;
    }
    _deleteTargets() {
      const del = (x, fn) => { if (x) fn.call(gl, x); };
      del(this.sceneTex, gl.deleteTexture); del(this.sceneFBO, gl.deleteFramebuffer);
      del(this.brightTex, gl.deleteTexture); del(this.brightFBO, gl.deleteFramebuffer);
      del(this.blurTexA, gl.deleteTexture); del(this.blurFBOA, gl.deleteFramebuffer);
      del(this.blurTexB, gl.deleteTexture); del(this.blurFBOB, gl.deleteFramebuffer);
      del(this.msaaColor, gl.deleteRenderbuffer); del(this.msaaDepth, gl.deleteRenderbuffer);
      del(this.msaaFBO, gl.deleteFramebuffer);
      this.msaaColor = this.msaaDepth = this.msaaFBO = null;
    }

    beginFrame(cam, env, opts = {}) {
      const dpr = opts.dpr || 1;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.samples > 0 ? this.msaaFBO : this.sceneFBO);
      gl.viewport(0, 0, this.w, this.h);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.clearColor(0.002, 0.004, 0.009, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      this.cam = cam;
      this.env = Object.assign(this.env, env);
      this.frameOpts = opts;
      // background
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      this.progBg.use();
      this.progBg.m4('uInvVP', cam.invVP);
      this.progBg.v3('uCamPos', cam.pos);
      this.progBg.v3('uSunDir', this.env.sunDir);
      this.progBg.f('uTime', cam.time);
      this.progBg.f('uSpaceMode', opts.spaceMode || 0);
      this.progBg.f('uStarScale', opts.starScale || 1);
      this.progBg.v3('uTint', opts.bgTint || [1, 1, 1]);
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.frontFace(gl.CCW);
      // sprite camera basis
      const v = cam.view;
      this.camRight = [v[0], v[4], v[8]];
      this.camUp = [v[1], v[5], v[9]];
      this.camFwd = [-v[2], -v[6], -v[10]];
    }

    drawMesh(mesh, model, tint) {
      if (!mesh) return;
      const p = this.progMain.use();
      p.m4('uVP', this.cam.viewProj);
      p.m4('uModel', model);
      p.v3('uCamPos', this.cam.pos);
      p.v3('uSunDir', this.env.sunDir);
      p.v3('uSunColor', this.env.sunColor);
      p.v3('uAmbSky', this.env.ambSky);
      p.v3('uAmbGround', this.env.ambGround);
      p.v3('uFillDir', this.env.fillDir || [0.45, 0.22, 0.78]);
      p.v3('uFillColor', this.env.fillColor || [0.10, 0.145, 0.175]);
      p.v3('uCamFill', this.env.camFill || [0.05, 0.07, 0.09]);
      p.v3('uFogColor', this.env.fogColor);
      p.f('uFogDensity', this.env.fogDensity);
      p.f('uEmissive', this.env.emissive);
      p.v3('uTint', tint || this.env.tint || [1, 1, 1]);
      const lights = this.env.lights || [];
      const n = Math.min(lights.length, 8);
      const pos = new Float32Array(32), col = new Float32Array(24);
      for (let i = 0; i < n; i++) {
        pos[i * 4] = lights[i].pos[0]; pos[i * 4 + 1] = lights[i].pos[1];
        pos[i * 4 + 2] = lights[i].pos[2]; pos[i * 4 + 3] = lights[i].radius;
        col[i * 3] = lights[i].color[0]; col[i * 3 + 1] = lights[i].color[1]; col[i * 3 + 2] = lights[i].color[2];
      }
      p.i('uLightCount', n);
      p.v4a('uLightPos', pos);
      p.v3a('uLightColor', col);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
    }

    beginAdditive() {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
    }
    endAdditive() {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
    }

    endFrame(opts = {}) {
      if (this.samples > 0) {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaaFBO);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.sceneFBO);
        gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      // bright pass
      gl.disable(gl.DEPTH_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.brightFBO);
      gl.viewport(0, 0, this.hw, this.hh);
      this.progBright.use();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
      this.progBright.i('uTex', 0);
      this.progBright.v2('uTexel', 1 / this.w, 1 / this.h);
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // blur H
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBOA);
      this.progBlur.use();
      gl.bindTexture(gl.TEXTURE_2D, this.brightTex);
      this.progBlur.i('uTex', 0);
      this.progBlur.v2('uDir', 1 / this.hw, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // blur V
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBOB);
      gl.bindTexture(gl.TEXTURE_2D, this.blurTexA);
      this.progBlur.v2('uDir', 0, 1 / this.hh);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // second wider blur
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBOA);
      gl.bindTexture(gl.TEXTURE_2D, this.blurTexB);
      this.progBlur.v2('uDir', 1.7 / this.hw, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBOB);
      gl.bindTexture(gl.TEXTURE_2D, this.blurTexA);
      this.progBlur.v2('uDir', 0, 1.7 / this.hh);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // composite to screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.w, this.h);
      this.progComposite.use();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
      this.progComposite.i('uScene', 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.blurTexB);
      this.progComposite.i('uBloom', 1);
      this.progComposite.f('uBloomStrength', opts.bloom !== undefined ? opts.bloom : 1.0);
      this.progComposite.f('uExposure', opts.exposure !== undefined ? opts.exposure : 1.0);
      this.progComposite.f('uTime', this.cam ? this.cam.time : 0);
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      gl.activeTexture(gl.TEXTURE0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
    }
  }

  // =====================================================================
  // Sprite batch
  // =====================================================================
  class SpriteBatch {
    constructor(r) {
      this.r = r;
      this.max = 14000;
      this.data = new Float32Array(this.max * 6 * 12);
      this.n = 0;
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      this.vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      const stride = 12 * 4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 20);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 32);
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 40);
      gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 1, gl.FLOAT, false, stride, 44);
      gl.bindVertexArray(null);
    }
    begin() { this.n = 0; }
    add(pos, size, color, shape = 0, rot = 0, sizeY = null) {
      if (this.n >= this.max) return;
      const d = this.data;
      let o = this.n * 72;
      const sx = size, sy = sizeY === null ? size : sizeY;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
      for (let i = 0; i < 6; i++) {
        d[o++] = pos[0]; d[o++] = pos[1]; d[o++] = pos[2];
        d[o++] = corners[i][0]; d[o++] = corners[i][1];
        d[o++] = color[0]; d[o++] = color[1]; d[o++] = color[2];
        d[o++] = sx; d[o++] = sy;
        d[o++] = shape; d[o++] = rot;
      }
      this.n++;
    }
    draw(cam) {
      if (!this.n) return;
      const r = this.r;
      r.beginAdditive();
      const p = r.progSprite.use();
      p.m4('uVP', cam.viewProj);
      p.v3('uRight', r.camRight);
      p.v3('uUp', r.camUp);
      p.f('uTime', cam.time || 0);
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * 72));
      gl.drawArrays(gl.TRIANGLES, 0, this.n * 6);
      gl.bindVertexArray(null);
      r.endAdditive();
    }
  }

  // =====================================================================
  // Beam / flame ribbons
  // =====================================================================
  class BeamRenderer {
    constructor(r) {
      this.r = r;
      const N = 72;
      const arr = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        arr.push(t, -1, t, 1);
      }
      this.count = arr.length / 2;
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      this.arr = arr;
    }
    // opts: color, alpha, width0, width1, mode, time
    draw(cam, start, end, opts) {
      const dir = M.norm(M.sub(end, start));
      const mid = M.mul(M.add(start, end), 0.5);
      const toCam = M.norm(M.sub(cam.pos, mid));
      let wd = M.cross(dir, toCam);
      if (M.len(wd) < 1e-4) wd = M.cross(dir, [0, 1, 0]);
      wd = M.norm(wd);
      const r = this.r;
      r.beginAdditive();
      const p = r.progBeam.use();
      p.m4('uVP', cam.viewProj);
      p.v3('uStart', start);
      p.v3('uEnd', end);
      p.v3('uWidthDir', wd);
      p.f('uWidth0', opts.width0);
      p.f('uWidth1', opts.width1);
      p.v3('uColor', opts.color);
      p.f('uTime', opts.time || 0);
      p.f('uAlpha', opts.alpha);
      p.f('uMode', opts.mode || 0);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
      gl.bindVertexArray(null);
      r.endAdditive();
    }
  }

  // =====================================================================
  // Shield spheres
  // =====================================================================
  class ShieldRenderer {
    constructor(r) {
      this.r = r;
      const seg = 48, rings = 28;
      const pos = [], nrm = [], uv = [], idx = [];
      for (let y = 0; y <= rings; y++) {
        const v = y / rings;
        const phi = v * Math.PI;
        for (let x = 0; x <= seg; x++) {
          const u = x / seg;
          const th = u * Math.PI * 2;
          const nx = Math.sin(phi) * Math.cos(th);
          const ny = Math.cos(phi);
          const nz = Math.sin(phi) * Math.sin(th);
          pos.push(nx, ny, nz); nrm.push(nx, ny, nz); uv.push(u, v);
        }
      }
      for (let y = 0; y < rings; y++) {
        for (let x = 0; x < seg; x++) {
          const a = y * (seg + 1) + x;
          const b = a + seg + 1;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      const data = new Float32Array(pos.length + nrm.length + uv.length);
      data.set(pos, 0); data.set(nrm, pos.length); data.set(uv, pos.length + nrm.length);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const stride = 8 * 4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 24);
      const ebo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
      this.count = idx.length;
      gl.bindVertexArray(null);
    }
    draw(cam, model, opts) {
      const r = this.r;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
      const p = r.progShield.use();
      p.m4('uVP', cam.viewProj);
      p.m4('uModel', model);
      p.v3('uCamPos', cam.pos);
      p.v3('uColor', opts.color || [0.30, 0.72, 1.0]);
      p.v3('uCenter', opts.center || [0, 0, 0]);
      p.v3('uRadii', opts.radii || [1, 1, 1]);
      p.f('uTime', opts.time);
      p.f('uAlpha', opts.alpha);
      p.f('uDeploy', opts.deploy === undefined ? 1 : opts.deploy);
      gl.bindVertexArray(this.vao);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
    }
  }

  // =====================================================================
  // Voxel debris instancing
  // =====================================================================
  class DebrisRenderer {
    constructor(r) {
      this.r = r;
      this.max = 6000;
      this.data = new Float32Array(this.max * 9);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      // cube positions with normals
      const verts = [];
      const cube = [
        // +x
        [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1], [1, 0, 0]],
        [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, 0, 0]],
        [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [0, 1, 0]],
        [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [0, -1, 0]],
        [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [0, 0, 1]],
        [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1], [0, 0, -1]],
      ];
      for (const f of cube) {
        const n = f[4];
        for (const a of [0, 1, 2, 0, 2, 3]) {
          const p = f[a];
          verts.push(p[0], p[1], p[2], n[0], n[1], n[2]);
        }
      }
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      this.inst = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      const stride = 9 * 4;
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(2, 1);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 12); gl.vertexAttribDivisor(3, 1);
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 3, gl.FLOAT, false, stride, 24); gl.vertexAttribDivisor(4, 1);
      gl.bindVertexArray(null);
      this.n = 0;
      this.verts = 36;
    }
    begin() { this.n = 0; }
    add(pos, half, color) {
      if (this.n >= this.max) return;
      const d = this.data; let o = this.n * 9;
      d[o++] = pos[0]; d[o++] = pos[1]; d[o++] = pos[2];
      d[o++] = half[0]; d[o++] = half[1]; d[o++] = half[2];
      d[o++] = color[0]; d[o++] = color[1]; d[o++] = color[2];
      this.n++;
    }
    draw(cam, env) {
      if (!this.n) return;
      const r = this.r;
      const p = r.progDebris.use();
      p.m4('uVP', cam.viewProj);
      p.v3('uSunDir', env.sunDir);
      p.v3('uSky', env.ambSky);
      p.v3('uGround', env.ambGround);
      p.v3('uCamPos', cam.pos);
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * 9));
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, this.n);
      gl.bindVertexArray(null);
    }
  }

  return { get gl() { return gl; }, Renderer, MeshBuilder, makeMesh, Program, SpriteBatch, BeamRenderer, ShieldRenderer, DebrisRenderer };
})();
