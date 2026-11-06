// Shared GLSL library
export const UNIFORMS_GLSL = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uShadeCol;
uniform vec3 uSkyCol;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMat;
uniform float uShadowTexel;
uniform vec4 uCloudA;
uniform vec2 uCloudDir;
uniform float uSunVis;
uniform float uWL;
uniform vec4 uGust;
uniform float uWindBase;
uniform float uRain;
uniform float uPass;
uniform vec3 uFogCol;
uniform vec3 uWaterDeep;
uniform vec3 uWaterShallow;
uniform float uCamFar;
uniform float uClipY;
uniform vec4 uBeams[3];
uniform sampler2D tPud;
uniform mat4 uPudMat;
uniform float uPudOn;
`;

export const NOISE_GLSL = /* glsl */ `
float hash11(float p){ p = fract(p*0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float hash13(vec3 p3){ p3 = fract(p3*0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y)*p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash12(i), b = hash12(i+vec2(1,0)), c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float vnoise3(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); vec3 u = f*f*(3.0-2.0*f);
  float n000 = hash13(i), n100 = hash13(i+vec3(1,0,0)), n010 = hash13(i+vec3(0,1,0)), n110 = hash13(i+vec3(1,1,0));
  float n001 = hash13(i+vec3(0,0,1)), n101 = hash13(i+vec3(1,0,1)), n011 = hash13(i+vec3(0,1,1)), n111 = hash13(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,u.x), mix(n010,n110,u.x), u.y), mix(mix(n001,n101,u.x), mix(n011,n111,u.x), u.y), u.z);
}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
float fbm3(vec3 p){ float s = 0.0, a = 0.5; for(int i=0;i<3;i++){ s += a*vnoise3(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
`;

export const FUNCS_GLSL = /* glsl */ `
float gustAt(vec2 p){
  float s = dot(p, uGust.xy);
  float d = uGust.z - s;
  if (d <= 0.0) return 0.0;
  float rise = smoothstep(0.0, 3.0, d);
  return rise * exp(-d/16.0) * uGust.w;
}
float windAt(vec2 p){
  return uWindBase*(0.75 + 0.25*sin(uTime*0.7 + p.x*0.21 + p.y*0.13)) + gustAt(p);
}
float cloudAt(vec2 p){
  vec2 d = p - uCloudA.xy;
  float n = (vnoise(p*0.11 + uTime*0.015) - 0.5)*6.0;
  float r = length(d) + n;
  float m = 1.0 - smoothstep(uCloudA.z - 5.0, uCloudA.z + 2.0, r);
  // permanent faint thin-cloud dapple
  float thin = smoothstep(0.58, 0.75, vnoise(p*0.045 + uCloudDir*uTime*0.02));
  return (1.0 - m*uCloudA.w) * (1.0 - 0.12*thin);
}
float shadowAt(vec3 wp, vec3 N, float ndl){
  vec3 p = wp + N*0.035 + uSunDir*0.02;
  vec4 sc = uShadowMat * vec4(p, 1.0);
  vec3 c = sc.xyz / sc.w;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float bias = 0.00035 + 0.0012*(1.0 - clamp(ndl,0.0,1.0));
  float s = 0.0;
  float tx = uShadowTexel*1.25;
  for (int i=-1;i<=1;i++) for (int j=-1;j<=1;j++){
    s += step(c.z - bias, texture2D(uShadowMap, c.xy + vec2(float(i), float(j))*tx).r);
  }
  s /= 9.0;
  return smoothstep(0.3, 0.7, s);
}
float causticPat(vec2 p, float t){
  vec2 q = p*1.15;
  float a = vnoise(q + vec2(t*0.31, t*0.17));
  float b = vnoise(q*1.37 + vec2(-t*0.22, t*0.27) + 5.3);
  float v = abs(a - b);
  return 1.0 - smoothstep(0.02, 0.07, v);
}
// distance travelled through water from wp to the viewer (approximate, base box)
float waterPath(vec3 wp, vec3 cam){
  vec3 rd = normalize(cam - wp);
  float t = 1e4;
  if (rd.y > 1e-4) t = min(t, (uWL - wp.y)/rd.y);
  if (abs(rd.x) > 1e-4) t = min(t, ((rd.x > 0.0 ? 20.0 : -20.0) - wp.x)/rd.x);
  if (abs(rd.z) > 1e-4) t = min(t, ((rd.z > 0.0 ? 20.0 : -20.0) - wp.z)/rd.z);
  return max(t, 0.0);
}
vec3 underwaterTint(vec3 col, vec3 wp, vec3 cam){
  float depth = uWL - wp.y;
  if (depth <= 0.0) return col;
  if (max(abs(wp.x), abs(wp.z)) > 19.93) return col;
  float path = waterPath(wp, cam);
  float f = 1.0 - exp(-path*0.085 - depth*0.04);
  vec3 wc = mix(uWaterShallow, uWaterDeep, smoothstep(0.0, 4.0, depth));
  vec3 tinted = col * mix(vec3(1.0), vec3(0.62, 0.9, 0.92), smoothstep(0.0, 2.5, depth));
  return mix(tinted, wc, clamp(f, 0.0, 0.82));
}
vec3 applyFog(vec3 col, vec3 wp, vec3 cam){
  float d = length(wp - cam);
  float r = length(wp.xz);
  float f = smoothstep(36.0, 150.0, r) * 0.93;
  col = mix(col, uFogCol, f);
  return col;
}
`;

// Lighting of the vertex-coloured toon surfaces
export const SHADE_GLSL = /* glsl */ `
vec3 surfaceDetail(vec3 base, float type, vec3 wp, inout vec3 N, vec2 uv, inout float wet, inout float lineW){
  float along = abs(N.x) > abs(N.z) ? wp.z : wp.x;
  if (type < 0.5) return base;
  if (type < 1.5) { // wet concrete ground
    if (N.y > 0.5) {
      vec2 g = abs(fract(wp.xz/4.0 + 0.5) - 0.5)*4.0;
      float joint = 1.0 - smoothstep(0.012, 0.03, min(g.x, g.y));
      float st = fbm(wp.xz*0.32);
      float damp = smoothstep(0.48, 0.66, st);
      float grain = vnoise(wp.xz*21.0)*0.06 + vnoise(wp.xz*5.3)*0.05;
      base *= (0.97 + grain - 0.055) * mix(1.0, 0.86, damp) * mix(1.0, 0.72, joint);
      float speck = step(0.93, hash12(floor(wp.xz*26.0)));
      base *= 1.0 - speck*0.06;
      wet = clamp(wet + damp*0.35, 0.0, 1.0);
    } else {
      float streak = vnoise(vec2(along*3.1, wp.y*0.25));
      base *= 0.95 + 0.07*streak;
    }
    return base;
  }
  if (type < 2.5) { // quay wall with tide lines
    float h = wp.y - uWL + (vnoise(vec2(along*1.7, 3.0)) - 0.5)*0.14 + (vnoise(vec2(along*6.0, 1.0))-0.5)*0.05;
    float rough = vnoise(vec2(along, wp.y)*7.0)*0.08 + vnoise(vec2(along, wp.y)*1.9)*0.08;
    base *= 0.92 + rough;
    float streak = smoothstep(0.55, 0.85, vnoise(vec2(along*2.3, wp.y*0.18 + 4.0)));
    base *= 1.0 - streak*0.12*smoothstep(0.0, 1.2, -wp.y + 0.2);
    vec3 algae = vec3(0.42, 0.52, 0.42);
    if (h < 0.0) base *= mix(vec3(0.66, 0.78, 0.7), vec3(0.5,0.64,0.58), smoothstep(0.0,-1.5,h));
    else if (h < 0.24) base *= vec3(0.56, 0.66, 0.62);
    else if (h < 0.5) base = mix(base, base*algae*1.5, 0.75);
    else if (h < 0.58) base *= 0.82;
    else if (h < 0.78) base *= mix(1.0, 0.9, vnoise(vec2(along*4.0, 9.0)));
    wet = max(wet, 1.0 - smoothstep(0.1, 0.5, h));
    return base;
  }
  if (type < 3.5) { // rusty metal
    float r = smoothstep(0.5, 0.72, fbm3(wp*6.5));
    float pit = smoothstep(0.74, 0.78, vnoise3(wp*16.0));
    base = mix(base, vec3(0.62, 0.36, 0.22), r*0.7);
    base = mix(base, vec3(0.42, 0.24, 0.15), pit*0.45);
    return base;
  }
  if (type < 4.5) { // white paint with wear
    float spots = smoothstep(0.88, 0.91, vnoise3(wp*9.5)) * smoothstep(0.4, 0.7, vnoise3(wp*1.1));
    float streak = smoothstep(0.75, 0.95, vnoise(vec2(along*9.0, wp.y*0.6))) * smoothstep(0.75, 0.0, fract(wp.y*0.8));
    base = mix(base, vec3(0.7, 0.45, 0.3), spots*0.55);
    base = mix(base, base*vec3(0.94, 0.86, 0.78), streak*0.3);
    return base;
  }
  if (type < 5.5) { // rope
    float tw = sin((uv.x*18.0 + uv.y*3.0)*6.2832);
    base *= 0.88 + 0.14*smoothstep(-0.3, 0.6, tw);
    float h = wp.y - uWL;
    float w = 1.0 - smoothstep(-0.05, 0.25, h);
    base *= mix(1.0, 0.52, w);
    wet = max(wet, w);
    return base;
  }
  if (type < 6.5) { // wood
    float g = vnoise(vec2(uv.x*2.0, uv.y*40.0)) * 0.12 + vnoise(vec2(uv.x*0.5, uv.y*9.0))*0.1;
    base *= 0.9 + g;
    return base;
  }
  if (type < 7.5) { // tetrapod concrete
    float n = vnoise3(wp*4.0)*0.08 + vnoise3(wp*1.2)*0.06;
    base *= 0.94 + n;
    float h = wp.y - uWL;
    base *= mix(vec3(0.62, 0.74, 0.7), vec3(1.0), smoothstep(-0.1, 0.5, h + (vnoise(wp.xz*2.0)-0.5)*0.3));
    wet = max(wet, 1.0 - smoothstep(0.0, 0.8, h));
    return base;
  }
  if (type < 8.5) return base; // foliage handled in lighting
  if (type < 9.5) { // kawara tiles
    float c = abs(fract(uv.x*3.6) - 0.5);
    float r = fract(uv.y*3.2);
    base *= 0.86 + 0.22*smoothstep(0.5, 0.1, c);
    base *= mix(0.78, 1.0, smoothstep(0.0, 0.12, r));
    return base;
  }
  if (type < 10.5) { // seabed
    float n = vnoise(wp.xz*3.0)*0.12 + vnoise(wp.xz*0.7)*0.12;
    float peb = step(0.8, hash12(floor(wp.xz*9.0)));
    base *= 0.88 + n + peb*0.08;
    return base;
  }
  if (type < 11.5) { // hazard stripes
    float s = step(0.5, fract((along + wp.y*1.0)*1.35));
    vec3 c = mix(vec3(0.97, 0.80, 0.12), vec3(0.11, 0.11, 0.12), s);
    float wear = smoothstep(0.66, 0.74, fbm(vec2(along*3.5, wp.y*9.0 + wp.x*0.3)));
    float chip = smoothstep(0.86, 0.9, vnoise(vec2(along, wp.y)*23.0));
    float edge = smoothstep(0.06, 0.0, abs(fract(wp.y*5.5) - 0.5) - 0.4) * 0.0;
    return mix(c, vec3(0.74, 0.74, 0.71), max(wear*0.6, chip*0.8));
  }
  if (type < 12.5) { // fabric
    return base * (0.95 + 0.06*vnoise(uv*40.0));
  }
  if (type < 13.5) { // corrugated metal siding (vertical ribs)
    float ph = along*6.2832*4.5;
    vec3 tang = abs(N.x) > abs(N.z) ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    N = normalize(N + tang * cos(ph) * 0.45);
    base *= 0.95 + 0.05*sin(ph);
    float st = smoothstep(0.7, 0.95, vnoise(vec2(along*3.0, 2.0))) * smoothstep(0.0, 1.0, fract(-wp.y*0.25 + vnoise(vec2(along*3.0, 5.0))));
    base = mix(base, base*vec3(0.88, 0.78, 0.68), st*0.3);
    float sp = smoothstep(0.86, 0.9, vnoise3(wp*9.0));
    base = mix(base, vec3(0.62, 0.4, 0.28), sp*0.35);
    return base;
  }
  if (type < 14.5) { // section fill: packed gravel / soil
    vec2 q = vec2(along + 0.5 * floor(wp.y * 7.0), wp.y) * vec2(7.0, 7.0);
    vec2 cid = floor(q);
    vec2 f = fract(q) - 0.5 - (hash22(cid) - 0.5) * 0.25;
    float r = 0.3 + 0.17 * hash12(cid + 2.3);
    float peb = 1.0 - smoothstep(r - 0.06, r, length(f * vec2(0.85, 1.35)));
    float tone = hash12(cid + 7.1);
    vec3 c = base * (0.9 + 0.08 * vnoise(vec2(along, wp.y) * 2.0));
    c = mix(c, base * (0.95 + 0.3 * tone), peb * 0.8);
    c *= 1.0 - (1.0 - peb) * 0.1;
    // larger cobbles
    vec2 q2 = vec2(along, wp.y) * 3.2;
    vec2 c2 = floor(q2);
    vec2 f2 = fract(q2) - 0.5 - (hash22(c2 + 4.0) - 0.5) * 0.4;
    float big = (1.0 - smoothstep(0.2, 0.24, length(f2 * vec2(1.0, 1.4)))) * step(0.6, hash12(c2 + 1.7));
    c = mix(c, base * (1.05 + 0.15 * hash12(c2)), big * 0.8);
    return c;
  }
  if (type < 15.5) { // hull white with waterline grime + rust streaks
    float h = wp.y - uWL;
    float grime = 1.0 - smoothstep(0.03, 0.22, h);
    base = mix(base, base*vec3(0.72, 0.8, 0.66), grime*0.65);
    float st = smoothstep(0.8, 0.97, vnoise(vec2(along*7.0, 1.3))) * smoothstep(0.0, 0.8, h) ;
    float fade = smoothstep(0.0, 0.6, fract(-wp.y*0.6 + vnoise(vec2(along*7.0,4.0))));
    base = mix(base, vec3(0.66, 0.45, 0.32), st*fade*0.3);
    float sp = smoothstep(0.9, 0.93, vnoise3(wp*11.0)) * smoothstep(0.45, 0.7, vnoise3(wp*1.3));
    base = mix(base, vec3(0.62, 0.4, 0.26), sp*0.45);
    return base;
  }
  if (type < 16.5) { // concrete block (rough)
    float n = vnoise3(wp*6.0)*0.07 + vnoise3(wp*1.7)*0.07;
    float pit = step(0.86, vnoise3(wp*14.0));
    base *= 0.93 + n - pit*0.08;
    return base;
  }
  if (type < 17.5) { // roll-up shutter (horizontal slats)
    float ph = wp.y*6.2832*9.0;
    N = normalize(N + vec3(0.0, 1.0, 0.0)*cos(ph)*0.5);
    base *= 0.93 + 0.07*sin(ph);
    float st = smoothstep(0.55, 0.85, vnoise(vec2(along*4.0, 1.0)));
    base = mix(base, base*vec3(0.8, 0.66, 0.55), st*0.35*smoothstep(1.0, 3.5, wp.y));
    return base;
  }
  if (type < 18.5) { // grass
    float n = vnoise(wp.xz*1.3)*0.5 + vnoise(wp.xz*4.0)*0.3;
    base *= 0.85 + n*0.3;
    float fl = step(0.985, hash12(floor(wp.xz*9.0)));
    base = mix(base, vec3(1.0, 0.95, 0.75), fl*0.6);
    return base;
  }
  if (type < 19.5) { // corrugated roof (ribs along uv.y)
    float ph = uv.x*6.2832*4.0;
    base *= 0.9 + 0.1*sin(ph);
    float up = step(0.0, N.y);
    float sp = smoothstep(0.8, 0.85, vnoise3(wp*3.0)) * up;
    base = mix(base, vec3(0.6, 0.38, 0.25), sp*0.5);
    if (up < 0.5) return base * vec3(0.95, 0.97, 0.98);
    float st = smoothstep(0.65, 0.9, vnoise(vec2(uv.x*2.0, uv.y*0.5)));
    base = mix(base, base*vec3(0.85,0.7,0.6), st*0.3);
    return base;
  }
  if (type < 20.5) { // dry-stone masonry (ishigaki): staggered irregular stones
    float rowH = 0.36;
    float y = wp.y / rowH;
    float row = floor(y);
    float fy = fract(y);
    float sw = 0.55 + 0.25 * hash11(row * 3.7);
    float a = along / sw + hash11(row * 1.3) * 3.0;
    float col = floor(a);
    float fx = fract(a);
    float jx = min(fx, 1.0 - fx) * sw, jy = min(fy, 1.0 - fy) * rowH;
    float joint = 1.0 - smoothstep(0.015, 0.035, min(jx, jy));
    float tone = hash12(vec2(col, row));
    vec3 c = base * (0.86 + 0.24 * tone) * (0.95 + 0.06 * vnoise(vec2(along, wp.y) * 6.0));
    c = mix(c, c * vec3(0.92, 1.0, 0.9), step(0.8, hash12(vec2(col + 3.0, row))) * 0.5);
    c = mix(c, base * 0.45, joint);
    if (abs(N.y) > 0.6) c = base * (0.95 + 0.08 * vnoise(wp.xz * 3.0));
    return c;
  }
  return base;
}

vec3 toonShade(vec3 base, vec3 N, vec3 wp, vec4 s, vec2 uv, out float lineW){
  float caus = step(31.5, s.x);
  float type = s.x - 32.0*caus;
  float wet = s.y;
  float emis = s.z;
  lineW = s.w;
  base = surfaceDetail(base, type, wp, N, uv, wet, lineW);
  vec3 V = normalize(cameraPosition - wp);
  float ndl = dot(N, uSunDir);
  float isLeaf = step(7.5, type) * step(type, 8.5);
  float sh = shadowAt(wp, N, ndl);
  float cl = cloudAt(wp.xz) * uSunVis;
  float edge0 = -0.02, edge1 = 0.05;
  if (isLeaf > 0.5) {
    float n = vnoise3(wp*2.2) - 0.5;
    ndl += n*0.9;
    edge0 = -0.05; edge1 = 0.02;
  }
  float direct = smoothstep(edge0, edge1, ndl) * sh;
  float sunAmt = direct * cl;
  float nearWater = (1.0 - smoothstep(-0.3, 1.6, wp.y - uWL)) * step(max(abs(wp.x), abs(wp.z)), 19.9);
  vec3 shade = mix(uShadeCol, vec3(0.36, 0.56, 0.62), nearWater*0.75);
  if (isLeaf > 0.5) shade = vec3(0.5, 0.66, 0.66);
  vec3 lit = base * uSunCol;
  vec3 dark = base * shade;
  vec3 c = mix(dark, lit, sunAmt);
  // warm terminator band
  float term = smoothstep(edge0, edge1, ndl) * (1.0 - smoothstep(edge1, edge1 + 0.22, ndl)) * sh * cl;
  c += base * vec3(0.06, 0.03, -0.01) * term;
  // sky fill
  c += base * uSkyCol * (0.07 + 0.07*N.y);
  // bounce light from water on undersides
  c += base * vec3(0.04, 0.09, 0.09) * max(-N.y, 0.0);
  // specular (stepped)
  vec3 H = normalize(uSunDir + V);
  float spw = mix(30.0, 140.0, wet);
  float sp = pow(max(dot(N, H), 0.0), spw);
  sp = smoothstep(0.42, 0.52, sp) * (0.12 + wet*0.75);
  c += uSunCol * sp * sunAmt * 0.55;
  // wet sky sheen on up-facing surfaces
  float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  c = mix(c, uSkyCol*1.04, fr * wet * 0.42 * smoothstep(0.3, 0.8, N.y));
  // rim light
  float rim = smoothstep(0.72, 0.86, 1.0 - max(dot(N, V), 0.0)) * smoothstep(-0.2, 0.4, N.y);
  c += uSkyCol * rim * 0.08;
  // caustics: underwater surfaces facing up, flagged ceilings facing down
  float t = uTime;
  if (wp.y < uWL && N.y > 0.2) {
    float depth = uWL - wp.y;
    c += vec3(0.75, 0.95, 0.9) * causticPat(wp.xz*0.9, t*0.6) * 0.22 * cl * smoothstep(6.0, 0.5, depth) * N.y;
  }
  if (caus > 0.5 && N.y < -0.3) {
    float cp = causticPat(wp.xz*0.7 + vec2(sin(t*0.21), cos(t*0.17))*0.4, t*0.35);
    float cp2 = causticPat(wp.xz*1.3 + 3.0, t*0.28);
    c += vec3(0.95, 0.96, 0.82) * (cp*0.75 + cp2*0.35) * 0.42 * cl;
  }
  // wet ground mirrors the harbour faintly (smeared vertical reflections)
  if (uPudOn > 0.5 && type > 0.5 && type < 1.5 && N.y > 0.9 && abs(wp.y) < 0.08) {
    vec4 rc = uPudMat * vec4(wp, 1.0);
    vec2 ruv = rc.xy / rc.w;
    ruv.x += (vnoise(vec2(wp.x*3.0, wp.z*0.5)) - 0.5) * 0.004;
    vec4 r = texture2D(tPud, ruv) * 0.4 + texture2D(tPud, ruv + vec2(0.0, 0.008)) * 0.3 + texture2D(tPud, ruv - vec2(0.0, 0.008)) * 0.3;
    float rl = dot(r.rgb, vec3(0.3, 0.55, 0.15)) / max(r.a, 0.01);
    vec3 rcol = rl > 0.75 ? vec3(0.92, 0.96, 0.97) : (rl > 0.45 ? vec3(0.66, 0.75, 0.78) : vec3(0.46, 0.55, 0.6));
    float k = smoothstep(0.2, 0.8, r.a) * (0.12 + wet * 0.3);
    c = mix(c, rcol * mix(vec3(1.0), uSunCol, 0.2), k);
  }
  // emissive (lamps / light boxes glow a little more when the sky darkens)
  float dim = 1.0 - uSunVis;
  c = mix(c, base * (1.35 + dim * 1.4), clamp(emis * (1.0 + dim * 1.6), 0.0, 1.0));
  return c;
}
`;

export const VERT_COMMON = /* glsl */ `
attribute vec3 acol;
attribute vec4 surf;
varying vec3 vWP;
varying vec3 vN;
varying vec3 vCol;
varying vec4 vSurf;
varying vec2 vUv;
`;
