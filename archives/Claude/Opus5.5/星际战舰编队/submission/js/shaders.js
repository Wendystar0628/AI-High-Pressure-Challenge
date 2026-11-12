'use strict';
// ---------------------------------------------------------------------------
// GLSL sources
// ---------------------------------------------------------------------------
const SH = {};

SH.common = `
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z); }
vec3 qrot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
`;

// ---------------------------------------------------------------- voxel
SH.voxelVS = (inst) => `#version 300 es
precision highp float; precision highp int;
layout(location=0) in vec3 aPos;
layout(location=1) in uvec4 aAttr;
${inst ? 'layout(location=2) in vec4 iPos; layout(location=3) in vec4 iRot; layout(location=4) in vec4 iEx;' : ''}
uniform mat4 uModel; uniform mat4 uVP; uniform vec3 uInstC;
out vec3 vObj; out vec3 vWorld; out vec3 vN; out vec3 vTU; out vec3 vTV; out vec3 vNObj; out float vAO; flat out int vMat; out vec2 vEx;
${SH.common}
const vec3 NRM[6] = vec3[6](vec3(1,0,0),vec3(-1,0,0),vec3(0,1,0),vec3(0,-1,0),vec3(0,0,1),vec3(0,0,-1));
void main(){
  int ni = int(aAttr.x);
  vec3 n = NRM[ni];
  vec3 tu = abs(n.x)>0.5 ? vec3(0,1,0) : (abs(n.y)>0.5 ? vec3(0,0,1) : vec3(1,0,0));
  vec3 tv = abs(n.x)>0.5 ? vec3(0,0,1) : (abs(n.y)>0.5 ? vec3(1,0,0) : vec3(0,1,0));
  vNObj = n; vAO = float(aAttr.z)/3.0; vMat = int(aAttr.y);
  vec4 wp;
${inst ? `
  vec3 lp = (aPos - uInstC) * iPos.w;
  wp = vec4(iPos.xyz + qrot(iRot, lp), 1.0);
  vN = qrot(iRot, n); vTU = qrot(iRot, tu); vTV = qrot(iRot, tv);
  vObj = aPos + vec3(iEx.z*13.0, iEx.z*7.0, 0.0);
  if (iEx.y > 0.5) vMat = int(iEx.y);
  vEx = iEx.xw;
` : `
  wp = uModel * vec4(aPos, 1.0);
  mat3 m3 = mat3(uModel);
  vN = m3*n; vTU = m3*tu; vTV = m3*tv; vObj = aPos; vEx = vec2(0.0);
`}
  vWorld = wp.xyz;
  gl_Position = uVP * wp;
}`;

SH.voxelFS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DShadow;
in vec3 vObj; in vec3 vWorld; in vec3 vN; in vec3 vTU; in vec3 vTV; in vec3 vNObj; in float vAO; flat in int vMat; in vec2 vEx;
uniform vec4 uMatA[64]; uniform vec4 uMatE[64]; uniform vec4 uMatP[64];
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmbUp; uniform vec3 uAmbDown; uniform vec3 uFillDir; uniform vec3 uFillCol;
uniform float uSunAmt; uniform float uAmbAmt; uniform float uTime; uniform vec3 uCamPos;
uniform float uThrust; uniform vec2 uCharge; uniform vec4 uChargeAxis; uniform float uFlash; uniform float uPulse;
uniform vec4 uHits[4]; uniform vec4 uHeat; uniform vec4 uShield; uniform vec3 uShieldCol;
uniform vec4 uLights[40]; uniform vec4 uLightC[40]; uniform int uNumLights;
uniform vec3 uBeamA; uniform vec3 uBeamB; uniform vec4 uBeamC;
uniform sampler2DShadow uShadow0; uniform sampler2DShadow uShadow1; uniform mat4 uShadowM0; uniform mat4 uShadowM1; uniform float uShadowOn;
uniform vec4 uFog; uniform float uAlphaPass; uniform float uEmitMul; uniform float uChaseSpeed;
layout(location=0) out vec4 oCol;
${SH.common}
float shadowTap(sampler2DShadow s, vec3 q, float texel){
  float acc = 0.0;
  for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++) acc += texture(s, vec3(q.xy + vec2(x,y)*texel, q.z));
  return acc/9.0;
}
float shadowAt(vec3 wp, vec3 N){
  if (uShadowOn < 0.5) return 1.0;
  vec3 p = wp + N*0.7;
  vec4 a = uShadowM0 * vec4(p,1.0); vec3 q = a.xyz*0.5+0.5;
  if (all(greaterThan(q.xy, vec2(0.01))) && all(lessThan(q.xy, vec2(0.99))) && q.z < 1.0) return shadowTap(uShadow0, q - vec3(0,0,0.0004), 1.0/4096.0);
  a = uShadowM1 * vec4(p,1.0); q = a.xyz*0.5+0.5;
  if (all(greaterThan(q.xy, vec2(0.0))) && all(lessThan(q.xy, vec2(1.0))) && q.z < 1.0) return shadowTap(uShadow1, q - vec3(0,0,0.0006), 1.0/4096.0);
  return 1.0;
}
vec3 envCol(vec3 R){
  float up = R.y*0.5+0.5;
  vec3 c = mix(vec3(0.010,0.008,0.020), vec3(0.05,0.035,0.09), up);
  c += uSunCol*0.02*pow(max(dot(R,uSunDir),0.0), 6.0);
  c += uFillCol*0.6*pow(max(dot(R,uFillDir),0.0), 2.0);
  return c;
}
void main(){
  vec4 A = uMatA[vMat]; vec4 E = uMatE[vMat]; vec4 P = uMatP[vMat];
  vec3 nObj = normalize(vNObj);
  vec3 cell = floor(vObj - nObj*0.5);
  float h = hash13(cell + 0.37);
  vec3 alb = A.rgb * (0.955 + 0.09*h);
  if ((vMat>=1 && vMat<=3) || vMat==26) { float hp = hash13(floor(cell/vec3(9.0,7.0,13.0)) + 3.1); alb *= 0.93 + 0.14*hp; }
  // voxel bevel: in-plane coordinates of this face
  vec2 f = abs(nObj.x)>0.5 ? vObj.yz : (abs(nObj.y)>0.5 ? vObj.zx : vObj.xy);
  vec2 fw = fwidth(f);
  vec2 fr = fract(f);
  vec2 dE = min(fr, 1.0-fr);
  float px = max(fw.x, fw.y);
  float bw = 0.075;
  vec2 e = 1.0 - smoothstep(vec2(bw) - fw*0.7, vec2(bw) + fw*0.7, dE);
  float fade = 1.0 - smoothstep(0.10, 0.32, px);
  e *= fade;
  vec2 sg = sign(fr - 0.5);
  vec3 N0 = normalize(vN);
  vec3 N = normalize(N0 + (normalize(vTU)*sg.x*e.x + normalize(vTV)*sg.y*e.y)*0.32);
  vec3 V = normalize(uCamPos - vWorld);
  float dist = length(uCamPos - vWorld);
  float ao = mix(0.22, 1.0, vAO);
  float rough = A.w, metal = P.x;
  float shin = mix(6.0, 380.0, pow(1.0-rough, 2.2));
  float fres = 0.04 + 0.96*pow(1.0 - max(dot(N,V),0.0), 5.0);
  vec3 specCol = mix(vec3(0.05), alb*1.3+0.1, metal);
  vec3 dif = alb * (1.0 - metal*0.55);
  vec3 col = vec3(0.0);
  // sun
  float ndl = dot(N, uSunDir);
  if (uSunAmt > 0.0 && ndl > 0.0) {
    float sh = shadowAt(vWorld, N0);
    vec3 H = normalize(uSunDir + V);
    float sp = pow(max(dot(N,H),0.0), shin) * (shin+8.0)/25.0;
    float edgeSp = (e.x+e.y) * pow(max(dot(N,H),0.0), 60.0) * 1.5 * metal;
    col += uSunCol * uSunAmt * sh * ndl * (dif + specCol*(sp+edgeSp)*mix(0.35, 1.0, metal));
  }
  // ambient
  float up = N.y*0.5+0.5;
  vec3 amb = mix(uAmbDown, uAmbUp, up) + uFillCol*max(dot(N, uFillDir), 0.0);
  col += dif * amb * ao * uAmbAmt;
  vec3 R = reflect(-V, N);
  col += envCol(R) * specCol * fres * (1.0 - rough*0.8) * ao * uAmbAmt * 3.0;
  // point lights
  for (int i=0; i<40; i++) {
    if (i >= uNumLights) break;
    vec3 L = uLights[i].xyz - vWorld; float d2 = dot(L,L); float r = uLights[i].w;
    float att = 1.0/(1.0 + d2/(r*r)); float cut = clamp(1.0 - d2/(r*r*36.0), 0.0, 1.0);
    att *= cut*cut;
    if (att < 0.002) continue;
    vec3 l = L*inversesqrt(d2);
    float nl = max(dot(N,l)*0.85+0.15, 0.0);
    vec3 H = normalize(l + V);
    float sp = pow(max(dot(N,H),0.0), shin*0.5) * 0.4;
    col += uLightC[i].rgb * att * (dif*nl*mix(0.6,1.0,ao) + specCol*sp*nl);
  }
  // beam line light
  if (uBeamC.w > 0.0) {
    vec3 ab = uBeamB - uBeamA; float t = clamp(dot(vWorld - uBeamA, ab)/dot(ab,ab), 0.0, 1.0);
    vec3 L = uBeamA + ab*t - vWorld; float d2 = dot(L,L); float r = uBeamC.w;
    float att = 1.0/(1.0 + d2/(r*r)); float cut = clamp(1.0 - d2/(r*r*30.0), 0.0, 1.0); att *= cut*cut;
    vec3 l = L*inversesqrt(max(d2,1e-4));
    col += uBeamC.rgb * att * (dif*max(dot(N,l)*0.8+0.2,0.0));
  }
  // emission
  vec3 em = E.rgb; int mode = int(E.w + 0.5); float k = 1.0;
  if (mode == 1) k = uThrust;
  else if (mode == 2) {
    float zz = (vObj.z - uChargeAxis.x)/(uChargeAxis.y - uChargeAxis.x);
    float seg = floor(zz*uChargeAxis.z)/uChargeAxis.z;
    float lit = smoothstep(seg, seg + 0.6/uChargeAxis.z, uCharge.x*1.02);
    float flow = 0.7 + 0.3*sin(zz*60.0 - uTime*30.0);
    k = 0.04 + lit*(0.8 + 0.2*sin(uTime*40.0 + seg*30.0)) + uCharge.y*1.4*flow;
  }
  else if (mode == 3) k = uFlash;
  else if (mode == 4) k = 0.18 + 0.82*pow(fract(vObj.z*0.02 - uTime*uChaseSpeed), 5.0);
  else if (mode == 8) k = 0.2 + 0.8*pow(fract(vObj.y*0.02 - uTime*uChaseSpeed), 4.0);
  else if (mode == 9) k = 0.2 + 0.8*pow(fract(vObj.x*0.02 - uTime*uChaseSpeed), 4.0);
  else if (mode == 5) { vec2 bq = floor(vec2(cell.x+cell.z, cell.y)/vec2(2.0,1.0)); float tt = uTime*1.3; float a0 = hash12(bq+floor(tt)), a1 = hash12(bq+floor(tt)+1.0); k = 0.45 + 0.55*mix(a0,a1,smoothstep(0.0,1.0,fract(tt))); k *= 0.75 + 0.25*step(0.5, hash12(bq*1.7)); }
  else if (mode == 6) {
    float d0 = length(cell - uHits[0].xyz);
    k = uHeat.x * (1.0 - smoothstep(uHeat.y*0.8, uHeat.y, d0)) * (0.7 + 0.3*hash13(cell*0.5));
  }
  else if (mode == 7) k = uPulse * (0.8 + 0.2*sin(vObj.y*0.15 - uTime*3.0));
  else if (mode == 10) k = step(0.42, h) * (0.6 + 0.4*hash13(cell*1.3));
  else if (mode == 11) k = 0.7 + 0.3*sin(uTime*2.0 + vObj.y*0.3);
  vec3 emit = em * k * uEmitMul;
  // impact heating on rock surfaces
  if (vMat >= 20 && vMat <= 24) {
    vec3 hot = vec3(0.0);
    for (int i=0;i<4;i++){ if (uHits[i].w <= 0.0) continue; float d = length(cell - uHits[i].xyz); hot += vec3(1.0,0.42,0.12) * uHits[i].w * exp(-d/max(uHeat.z,1.0)); }
    emit += hot * (0.6 + 0.4*h);
  }
  // shield light washing the shell
  if (uShield.x > 0.0) {
    float band = exp(-pow((vObj.z - uShield.y)/max(uShield.z,1.0), 2.0));
    emit += uShieldCol * uShield.x * (0.035 + 0.25*band) * (0.4 + fres*2.0) * (vMat>=20 && vMat<=24 ? 0.0 : 1.0);
  }
  // per-instance heat (debris cubes)
  emit += vec3(1.0,0.4,0.1) * vEx.x * 6.0;
  float grout = 1.0 - 0.07*max(e.x, e.y);
  col = col * grout + emit;
  if (uFog.w > 0.0) col = mix(col, uFog.rgb, 1.0 - exp(-dist*uFog.w));
  oCol = vec4(col, uAlphaPass > 0.5 ? P.y : 1.0);
}`;

// ---------------------------------------------------------------- shadow depth
SH.shadowVS = (inst) => `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
${inst ? 'layout(location=2) in vec4 iPos; layout(location=3) in vec4 iRot;' : ''}
uniform mat4 uModel; uniform mat4 uVP; uniform vec3 uInstC;
${SH.common}
void main(){
${inst ? 'vec3 wp = iPos.xyz + qrot(iRot, (aPos-uInstC)*iPos.w); gl_Position = uVP*vec4(wp,1.0);' : 'gl_Position = uVP * uModel * vec4(aPos,1.0);'}
}`;
SH.shadowFS = `#version 300 es
precision mediump float; out vec4 o; void main(){ o = vec4(1.0); }`;

// ---------------------------------------------------------------- sky
SH.fullVS = `#version 300 es
precision highp float;
out vec2 vUV;
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUV = p; gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

SH.skyFS = `#version 300 es
precision highp float;
in vec2 vUV; uniform mat4 uInvVP; uniform vec3 uSunDir; uniform vec3 uPlanetDir; uniform float uTime; uniform float uExposureSky;
out vec4 o;
${SH.common}
float fbm(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s += a*vnoise(p); p = p*2.03 + 1.7; a *= 0.5; } return s; }
void main(){
  vec4 a = uInvVP * vec4(vUV*2.0-1.0, 1.0, 1.0);
  vec4 b = uInvVP * vec4(vUV*2.0-1.0, -1.0, 1.0);
  vec3 dir = normalize(a.xyz/a.w - b.xyz/b.w);
  // galactic band
  vec3 bandN = normalize(vec3(0.25, 0.92, -0.3));
  float bd = dot(dir, bandN);
  float band = exp(-bd*bd*9.0);
  vec3 q = dir*2.2;
  vec3 w = vec3(fbm(q+3.1), fbm(q+7.7), fbm(q+1.3));
  float n1 = fbm(q*1.3 + w*1.6);
  float n2 = fbm(q*2.7 - w*1.1 + 9.0);
  float dust = smoothstep(0.42, 0.75, fbm(q*3.1 + w*2.0 + 4.0));
  vec3 col = mix(vec3(0.0035,0.004,0.010), vec3(0.008,0.006,0.020), dir.y*0.5+0.5);
  vec3 neb1 = vec3(0.30,0.07,0.32);   // magenta-violet
  vec3 neb2 = vec3(0.04,0.20,0.30);   // teal
  vec3 neb3 = vec3(0.45,0.20,0.08);   // warm glow near the star
  float m1 = smoothstep(0.38, 0.85, n1) * (0.25 + band*1.2);
  float m2 = smoothstep(0.45, 0.9, n2) * (0.2 + band*0.9);
  col += neb1 * m1 * 0.55 + neb2 * m2 * 0.45;
  float sd = max(dot(dir, uSunDir), 0.0);
  col += neb3 * pow(sd, 6.0) * (0.25 + 0.6*n1);
  col *= 1.0 - dust*0.75*band;
  col += vec3(0.02,0.015,0.03)*band;
  // star (light source)
  col += vec3(1.0,0.85,0.62) * (pow(sd, 1800.0)*60.0 + pow(sd, 120.0)*1.2 + pow(sd, 12.0)*0.06);
  // gas giant arc
  float pr = 0.42; float cp = dot(dir, uPlanetDir);
  float ang = acos(clamp(cp, -1.0, 1.0));
  if (ang < pr + 0.08) {
    float edge = ang/pr;
    if (edge < 1.0) {
      vec3 up0 = normalize(cross(uPlanetDir, vec3(0.2,1.0,0.1)));
      vec3 rt0 = cross(up0, uPlanetDir);
      vec2 lp = vec2(dot(dir, rt0), dot(dir, up0))/sin(pr);
      float z = sqrt(max(0.0, 1.0 - dot(lp,lp)));
      vec3 nrm = normalize(rt0*lp.x + up0*lp.y - uPlanetDir*z);
      float lam = max(dot(nrm, uSunDir), 0.0);
      float lat = lp.y*0.8 + lp.x*0.25;
      float bands = 0.5 + 0.5*sin(lat*26.0 + fbm(vec3(lp*4.0, 1.0))*5.0);
      vec3 pc = mix(vec3(0.10,0.16,0.22), vec3(0.32,0.30,0.36), bands);
      pc = mix(pc, vec3(0.38,0.22,0.16), smoothstep(0.55,0.9,fbm(vec3(lp*7.0,3.0))));
      vec3 pcol = pc * (lam*1.1) + vec3(0.004,0.006,0.012);
      float rim = pow(1.0 - z, 3.0);
      pcol += vec3(0.25,0.55,0.9) * rim * (0.15 + lam*1.2);
      float aa = smoothstep(1.0, 0.985, edge);
      col = mix(col, pcol, aa);
    }
    float halo = exp(-max(ang - pr, 0.0)*60.0) * step(pr*0.98, ang);
    vec3 hd = normalize(dir - uPlanetDir*cp);
    col += vec3(0.2,0.45,0.85) * halo * 0.35 * (0.3 + max(dot(hd, uSunDir),0.0));
  }
  o = vec4(col * uExposureSky, 1.0);
}`;

// ---------------------------------------------------------------- stars (points)
SH.starVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aDir; layout(location=1) in vec4 aCol;
uniform mat4 uVPRot; uniform float uPx;
out vec4 vCol;
void main(){ vec4 p = uVPRot * vec4(aDir, 0.0); gl_Position = p.xyww; gl_Position.z = gl_Position.w*0.99999; vCol = aCol; gl_PointSize = (1.3 + aCol.a*2.2)*uPx; }`;
SH.starFS = `#version 300 es
precision highp float; in vec4 vCol; out vec4 o;
void main(){ vec2 d = gl_PointCoord*2.0-1.0; float r = dot(d,d); float a = exp(-r*4.0); o = vec4(vCol.rgb*a, 1.0); }`;

// ---------------------------------------------------------------- FX (instanced billboard / streak)
// a0: p0.xyz, w0 ; a1: p1.xyz, w1 ; c: color rgb (HDR), alpha ; p: type, seed, param1, param2
SH.fxVS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 a0; layout(location=2) in vec4 a1; layout(location=3) in vec4 aC; layout(location=4) in vec4 aP;
uniform mat4 uVP; uniform vec3 uCamPos; uniform vec3 uCamRight; uniform vec3 uCamUp;
out vec2 vST; out vec2 vLW; out vec4 vC; out vec4 vP;
void main(){
  vec3 A = a0.xyz, B = a1.xyz; vec3 d = B - A; float L = length(d);
  int type = int(aP.x + 0.5);
  vec3 pos;
  if (type < 10 || L < 1e-4) {
    float w = a0.w;
    vec2 c = vec2(aCorner.x*2.0-1.0, aCorner.y);
    float rot = aP.w;
    vec2 rc = vec2(c.x*cos(rot) - c.y*sin(rot), c.x*sin(rot) + c.y*cos(rot));
    pos = A + (uCamRight*rc.x + uCamUp*rc.y) * w;
    vST = c; vLW = vec2(0.0, w);
  } else {
    vec3 dir = d/L;
    vec3 P = mix(A, B, aCorner.x);
    vec3 toCam = normalize(uCamPos - P);
    vec3 side = cross(dir, toCam); float sl = length(side);
    side = sl > 1e-4 ? side/sl : normalize(cross(dir, vec3(0.0,1.0,0.0)));
    float w = mix(a0.w, a1.w, aCorner.x);
    float ext = (aCorner.x*2.0-1.0) * w;
    pos = P + dir*ext + side*aCorner.y*w;
    vST = vec2(aCorner.x*L + ext, aCorner.y*w);
    vLW = vec2(L, w);
  }
  vC = aC; vP = aP;
  gl_Position = uVP * vec4(pos, 1.0);
}`;

SH.fxFS = `#version 300 es
precision highp float;
in vec2 vST; in vec2 vLW; in vec4 vC; in vec4 vP;
uniform float uTime;
out vec4 o;
${SH.common}
void main(){
  int type = int(vP.x + 0.5);
  float a = 0.0; vec3 col = vC.rgb;
  if (type < 10) {
    vec2 c = vST; float r = length(c);
    if (r > 1.0) discard;
    if (type == 0) { a = exp(-r*r*5.0) + 0.25*exp(-r*r*40.0)*2.0; a *= smoothstep(1.0, 0.8, r); }
    else if (type == 1) { float rr = vP.z; float th = vP.y; a = exp(-pow((r - rr)/th, 2.0)) * smoothstep(1.0, 0.9, r); }
    else if (type == 2) { a = exp(-r*r*7.0) + (exp(-abs(c.y)*28.0)*exp(-abs(c.x)*2.5) + exp(-abs(c.x)*28.0)*exp(-abs(c.y)*2.5))*0.6; a *= smoothstep(1.0,0.85,r); }
    else if (type == 3) { float n = vnoise(vec3(c*2.5 + vP.y, vP.y*10.0 + uTime*0.3)); float n2 = vnoise(vec3(c*6.0 - vP.y, vP.y*3.0)); a = smoothstep(1.0, 0.15, r) * clamp(0.25 + 0.9*n + 0.3*n2 - 0.35, 0.0, 1.0);
      o = vec4(col * a * vC.a, a * vC.a); return; }
    else if (type == 4) { a = smoothstep(1.0, 0.0, r); a = a*a; }
  } else {
    float s = vST.x, t = vST.y, L = vLW.x, w = max(vLW.y, 1e-4);
    float dx = max(max(-s, s - L), 0.0);
    float dn = sqrt(dx*dx + t*t)/w;
    if (dn > 1.0) discard;
    float u = clamp(s/L, 0.0, 1.0);
    if (type == 10) { // energy bolt: head at B
      float core = exp(-dn*dn*28.0); float halo = exp(-dn*dn*4.0)*0.45;
      a = (core*2.0 + halo) * mix(0.15, 1.0, pow(u, 1.5));
      col = mix(col, vec3(1.0)*max(max(col.r,col.g),col.b), core*0.6);
    } else if (type == 11) { // tracer
      a = exp(-dn*dn*6.0) * mix(0.05, 1.0, pow(u, 2.0));
    } else if (type == 12) { // beam
      float across = abs(t)/w;
      float core = exp(-across*across*60.0);
      float glow = exp(-across*across*5.0);
      float fl = vnoise(vec3(s*0.035 - uTime*26.0, across*6.0, vP.y));
      float streak = pow(vnoise(vec3(s*0.012 - uTime*14.0, t*0.35, 3.0)), 3.0);
      float endFade = smoothstep(0.0, 6.0*w, s) * (1.0 - smoothstep(L - 2.0*w, L + w, s));
      a = (core*3.0 + glow*(0.35 + 0.5*fl) + streak*glow*1.5) * endFade;
      col = mix(col, vec3(dot(col, vec3(0.33))*1.4), core*0.7);
    } else if (type == 13) { // thruster plume, A at nozzle
      float wl = mix(1.0, 0.35, u);
      float across = abs(t)/(w*wl);
      float n = vnoise(vec3(s*0.06 - uTime*9.0, t*0.3, vP.y*7.0));
      float core = exp(-across*across*14.0) * exp(-u*vP.z);
      float outer = exp(-across*across*2.5) * exp(-u*vP.w) * (0.6 + 0.6*n);
      a = (core*2.2 + outer*0.7) * smoothstep(0.0, 0.04, u + 0.02) * step(across, 1.2);
      col = mix(col, vec3(1.0,0.98,0.95)*max(col.r, max(col.g,col.b)), core*0.5);
    } else if (type == 14) { // soft line
      a = exp(-dn*dn*5.0);
    } else if (type == 15) { // hard thin line
      a = smoothstep(1.0, 0.3, dn);
    }
  }
  o = vec4(col * a * vC.a, 0.0);
}`;

// ---------------------------------------------------------------- ribbons (missile trails)
SH.ribbonVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; layout(location=2) in vec2 aUV;
uniform mat4 uVP; out vec4 vCol; out vec2 vUV;
void main(){ vCol = aCol; vUV = aUV; gl_Position = uVP*vec4(aPos,1.0); }`;
SH.ribbonFS = `#version 300 es
precision highp float; in vec4 vCol; in vec2 vUV; uniform float uTime; out vec4 o;
${SH.common}
void main(){ float n = vnoise(vec3(vUV.x*0.08, vUV.y*2.0, 1.0)); float a = exp(-vUV.y*vUV.y*3.0) * (0.55 + 0.6*n); o = vec4(vCol.rgb*a*vCol.a, 0.0); }`;

// ---------------------------------------------------------------- shields
SH.shieldVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uModel; uniform mat4 uVP; uniform vec3 uRadii; uniform float uExpand;
out vec3 vS; out vec3 vW; out vec3 vNW;
void main(){
  vS = aPos;
  vec3 p = aPos * uRadii * uExpand;
  vec4 wp = uModel * vec4(p, 1.0);
  vW = wp.xyz;
  vNW = normalize(mat3(uModel) * (aPos / uRadii));
  gl_Position = uVP * wp;
}`;
SH.shieldFS = `#version 300 es
precision highp float;
in vec3 vS; in vec3 vW; in vec3 vNW;
uniform vec3 uCamPos; uniform float uTime; uniform vec3 uCol; uniform vec4 uState; // x: arcs, y: fill, z: wave (-1..1 along z), w: overall
uniform vec4 uRipple; uniform float uSeed;
out vec4 o;
${SH.common}
void main(){
  vec3 V = normalize(uCamPos - vW);
  float ndv = abs(dot(normalize(vNW), V));
  float fres = pow(1.0 - ndv, 2.6);
  // plate pattern (forward chevrons on a staggered grid, echoing the shell plates)
  float lon = atan(vS.y, vS.x) / 6.2831853;
  float zz = vS.z;
  vec2 g = vec2(lon*28.0, zz*9.0 - uTime*0.346154);
  float row = floor(g.y);
  g.x += mod(row, 2.0)*0.5;
  vec2 cf = fract(g) - 0.5;
  float chev = abs(cf.y + abs(cf.x)*0.9 - 0.2);
  float lines = smoothstep(0.08, 0.0, chev) + smoothstep(0.06, 0.0, 0.5 - abs(cf.x))*0.5;
  float cellRnd = hash12(floor(g) + uSeed);
  float flow = 0.5 + 0.5*sin(zz*14.0 - uTime*2.174863 + lon*30.0);
  float arcs = uState.x * lines * step(cellRnd, uState.x*1.1) * (0.6 + 0.8*flow);
  float wave = exp(-pow((zz - uState.z)*5.0, 2.0)) * step(-1.5, uState.z);
  // ripples
  float rip = 0.0;
  if (uRipple.w > 0.0) { float dd = length(normalize(vS) - normalize(uRipple.xyz)); float rr = (1.0-uRipple.w)*1.1; rip = uRipple.w * uRipple.w * (exp(-pow((dd - rr)*14.0, 2.0)) + 0.5*exp(-pow((dd - rr*0.7)*18.0, 2.0))) * (0.5 + lines); }
  float fill = uState.y * (0.012 + fres*0.55 + pow(fres, 4.0)*0.6 + lines*0.045*flow);
  float a = (arcs*0.45 + fill + wave*(0.5 + lines*1.4) + rip*0.55*uState.y) * uState.w;
  o = vec4(uCol * a, 0.0);
}`;

// ---------------------------------------------------------------- post
SH.downFS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uFirst; out vec4 o;
vec3 s(vec2 uv){ return texture(uTex, uv).rgb; }
void main(){
  vec2 t = uTexel;
  vec3 a = s(vUV + t*vec2(-2,2)), b = s(vUV + t*vec2(0,2)), c = s(vUV + t*vec2(2,2));
  vec3 d = s(vUV + t*vec2(-2,0)), e = s(vUV), f = s(vUV + t*vec2(2,0));
  vec3 g = s(vUV + t*vec2(-2,-2)), h = s(vUV + t*vec2(0,-2)), i = s(vUV + t*vec2(2,-2));
  vec3 j = s(vUV + t*vec2(-1,1)), k = s(vUV + t*vec2(1,1)), l = s(vUV + t*vec2(-1,-1)), m = s(vUV + t*vec2(1,-1));
  vec3 r = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  if (uFirst > 0.5) { r = min(r, vec3(400.0)); }
  o = vec4(r, 1.0);
}`;
SH.upFS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uW; out vec4 o;
void main(){
  vec2 t = uTexel;
  vec3 r = texture(uTex, vUV).rgb*4.0;
  r += (texture(uTex, vUV+vec2(t.x,0)).rgb + texture(uTex, vUV-vec2(t.x,0)).rgb + texture(uTex, vUV+vec2(0,t.y)).rgb + texture(uTex, vUV-vec2(0,t.y)).rgb)*2.0;
  r += texture(uTex, vUV+t).rgb + texture(uTex, vUV-t).rgb + texture(uTex, vUV+vec2(t.x,-t.y)).rgb + texture(uTex, vUV+vec2(-t.x,t.y)).rgb;
  o = vec4(r/16.0*uW, 1.0);
}`;
SH.compFS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uScene; uniform sampler2D uBloom; uniform float uExposure; uniform float uBloomAmt; uniform vec2 uRes; uniform vec4 uGrade; out vec4 o;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec3 c = texture(uScene, vUV).rgb;
  vec3 b = texture(uBloom, vUV).rgb;
  c = c + b*uBloomAmt;
  c *= uExposure;
  // gentle grade: cool shadows, warm highlights
  float lum = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(c*vec3(0.94,0.98,1.08), c*vec3(1.05,1.0,0.95), smoothstep(0.05, 1.5, lum));
  c = aces(c);
  vec2 q = vUV - 0.5;
  c *= 1.0 - dot(q,q)*uGrade.x;
  c = pow(c, vec3(1.0/2.2));
  c += (h12(gl_FragCoord.xy) - 0.5)/255.0;
  o = vec4(c, 1.0);
}`;
SH.blitFS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; out vec4 o; void main(){ o = texture(uTex, vUV); }`;
