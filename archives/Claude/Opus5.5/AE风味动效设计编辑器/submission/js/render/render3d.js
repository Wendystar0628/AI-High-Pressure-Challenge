// 三维组渲染：PBR 材质 + 程序环境反射、阴影贴图、景深、三维平面、粒子与拖尾
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, M4 = U.M4, E = AE.Eval, GL = AE.GL, R = AE.R, Mesh = AE.Mesh, C = AE.Content, P = AE.Path;
  const R3 = AE.R3 = { stats: {} };
  const NEAR = 10, FAR = 40000;

  const ENV_GLSL = `
  uniform vec3 uEnvTop; uniform vec3 uEnvHor; uniform vec3 uEnvGnd; uniform float uEnvK; uniform vec4 uBoxD[3]; uniform vec4 uBoxC[3];
  vec3 envC(vec3 d, float r){
    float up = -d.y;
    float k = smoothstep(-0.18 - r*0.4, 0.18 + r*0.4, up);
    vec3 sky = mix(uEnvHor, uEnvTop, smoothstep(0.0, 0.9, up));
    vec3 c = mix(uEnvGnd*(0.6+0.4*smoothstep(-1.0,-0.2,up)), sky, k);
    for(int i=0;i<3;i++){
      float a = uBoxD[i].w; float bl = 0.015 + r*r*1.1;
      float cd = dot(d, normalize(uBoxD[i].xyz));
      float f = smoothstep(cos(a + bl), cos(max(a - bl*0.4, 0.001)), cd);
      float norm = (a*a)/((a+bl)*(a+bl));
      c += uBoxC[i].rgb * uBoxC[i].a * f * mix(1.0, norm, 0.85);
    }
    return c * uEnvK;
  }`;
  const TONE = `vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
  vec3 toSRGB(vec3 c){ return pow(aces(c), vec3(1.0/2.2)); }
  vec3 toLin(vec3 c){ return pow(max(c,vec3(0.0)), vec3(2.2)); }`;
  const SHADOW_GLSL = `
  uniform sampler2D uShMap; uniform mat4 uShVP; uniform int uShOn; uniform float uShDark; uniform float uShSoft; uniform float uShBias; uniform int uRecv;
  float shadowF(vec3 w, vec3 n, vec3 l){
    if(uShOn==0 || uRecv==0) return 1.0;
    vec4 s = uShVP*vec4(w,1.0); vec3 p = s.xyz/s.w*0.5+0.5;
    if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0||p.z>1.0) return 1.0;
    float nl = clamp(dot(n,l),0.0,1.0);
    float bias = uShBias*(1.0+3.0*(1.0-nl));
    vec2 ts = 1.0/vec2(textureSize(uShMap,0));
    float sum=0.0;
    for(int i=0;i<16;i++){
      float a = float(i)*2.39996+0.5; float r = sqrt((float(i)+0.5)/16.0);
      vec2 o = vec2(cos(a),sin(a))*r*uShSoft*ts;
      float d = texture(uShMap, p.xy+o).r;
      sum += (p.z - bias > d) ? 0.0 : 1.0;
    }
    float lit = sum/16.0;
    return mix(1.0, lit, uShDark);
  }`;
  const LIGHTS_GLSL = `
  uniform int uNL; uniform vec4 uLP[4]; uniform vec4 uLC[4]; uniform vec3 uAmb; uniform int uShL;
  `;
  const PBR_VS = `layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUV; layout(location=3) in float aExtra;
    uniform mat4 uModel; uniform mat4 uVP; uniform mat3 uNM;
    out vec3 vW; out vec3 vN; out vec2 vUV; out float vX;
    void main(){ vec4 w = uModel*vec4(aPos,1.0); vW=w.xyz; vN=normalize(uNM*aNrm); vUV=aUV; vX=aExtra; gl_Position = uVP*w; }`;
  const PBR_FS = ENV_GLSL + TONE + SHADOW_GLSL + LIGHTS_GLSL + `
    in vec3 vW; in vec3 vN; in vec2 vUV; in float vX; out vec4 o;
    uniform vec3 uCam; uniform vec4 uBase; uniform float uMetal; uniform float uRough; uniform vec3 uEmis; uniform float uEmisK; uniform float uOpacity;
    uniform int uFT; uniform float uFK; uniform int uLit; uniform int uDS;
    const float PI = 3.14159265;
    vec2 envBRDF(float NoV, float r){ vec4 c0=vec4(-1.0,-0.0275,-0.572,0.022), c1=vec4(1.0,0.0425,1.04,-0.04); vec4 rr=r*c0+c1; float a=min(rr.x*rr.x, exp2(-9.28*NoV))*rr.x+rr.y; return vec2(-1.04,1.04)*a+rr.zw; }
    void main(){
      vec3 N = normalize(vN); vec3 V = normalize(uCam - vW);
      if(dot(N,V)<0.0 && uDS==1) N = -N;
      vec3 base = toLin(uBase.rgb); float metal=uMetal, rough=uRough; vec3 em = toLin(uEmis)*uEmisK;
      if(uFT==1) em += toLin(uEmis)*vX*uFK; else if(uFT==2) rough = clamp(rough + vX*uFK,0.02,1.0); else if(uFT==3) metal = clamp(metal+vX*uFK,0.0,1.0); else if(uFT==4) base = mix(base, toLin(uEmis), clamp(vX*uFK,0.0,1.0));
      rough = clamp(rough, 0.03, 1.0);
      float NoV = max(dot(N,V), 1e-4);
      vec3 F0 = mix(vec3(0.04), base, metal);
      vec3 col = vec3(0.0);
      for(int i=0;i<4;i++){
        if(i>=uNL) break;
        vec3 L; float att=1.0;
        if(uLP[i].w>0.5){ L = normalize(-uLP[i].xyz); } else { vec3 d = uLP[i].xyz - vW; float dl=length(d); L=d/dl; att = 1.0/(1.0+ (dl*dl)/(uLC[i].a*uLC[i].a)); }
        float NoL = max(dot(N,L),0.0); if(NoL<=0.0) continue;
        vec3 H = normalize(L+V); float NoH=max(dot(N,H),0.0), VoH=max(dot(V,H),0.0);
        float a = rough*rough, a2=a*a; float dd = NoH*NoH*(a2-1.0)+1.0; float D = a2/(PI*dd*dd);
        float k = (rough+1.0)*(rough+1.0)/8.0; float Gs = (NoV/(NoV*(1.0-k)+k))*(NoL/(NoL*(1.0-k)+k));
        vec3 F = F0 + (1.0-F0)*pow(1.0-VoH,5.0);
        vec3 spec = D*Gs*F/(4.0*NoV*NoL+1e-4);
        vec3 kd = (1.0-F)*(1.0-metal);
        float sh = (i==uShL) ? shadowF(vW, N, L) : 1.0;
        col += (kd*base/PI + spec) * uLC[i].rgb * NoL * att * sh * PI;
      }
      vec3 R = reflect(-V, N);
      vec2 ab = envBRDF(NoV, rough);
      vec3 specIBL = envC(R, rough) * (F0*ab.x + ab.y);
      vec3 diffIBL = envC(N, 1.0) * base * (1.0-metal);
      float aoSh = 1.0;
      if(uShL>=0){ vec3 Ls = uLP[uShL].w>0.5 ? normalize(-uLP[uShL].xyz) : normalize(uLP[uShL].xyz - vW); aoSh = mix(1.0, shadowF(vW, N, Ls), 0.5); }
      col += (specIBL + diffIBL + uAmb*base) * aoSh;
      col += em;
      vec3 c = uLit==1 ? toSRGB(col) : uBase.rgb;
      o = vec4(c*uOpacity, uOpacity);
    }`;
  const PLANE_VS = `layout(location=0) in vec2 aPos; uniform mat4 uModel; uniform mat4 uVP; uniform vec4 uRect; uniform mat3 uNM; out vec2 vUV; out vec3 vW; out vec3 vN;
    void main(){ vec2 p = mix(uRect.xy, uRect.zw, aPos); vUV = vec2(aPos.x, 1.0-aPos.y); vec4 w = uModel*vec4(p,0.0,1.0); vW=w.xyz; vN = normalize(uNM*vec3(0.0,0.0,-1.0)); gl_Position = uVP*w; }`;
  const PLANE_FS = ENV_GLSL + TONE + SHADOW_GLSL + LIGHTS_GLSL + `
    in vec2 vUV; in vec3 vW; in vec3 vN; out vec4 o; uniform sampler2D uTex; uniform float uOp; uniform int uLit; uniform vec3 uCam; uniform float uCut;
    void main(){
      vec4 c = texture(uTex, vUV)*uOp;
      if(c.a < uCut) discard;
      if(uLit==1 && c.a>0.0){
        vec3 N = normalize(vN); vec3 V = normalize(uCam-vW); if(dot(N,V)<0.0) N=-N;
        vec3 base = toLin(c.rgb/c.a); vec3 col = uAmb*base;
        for(int i=0;i<4;i++){ if(i>=uNL) break; vec3 L; float att=1.0; if(uLP[i].w>0.5) L=normalize(-uLP[i].xyz); else { vec3 d=uLP[i].xyz-vW; float dl=length(d); L=d/dl; att=1.0/(1.0+(dl*dl)/(uLC[i].a*uLC[i].a)); }
          float sh = (i==uShL)? shadowF(vW,N,L):1.0; col += base*uLC[i].rgb*max(dot(N,L),0.0)*att*sh; }
        col += envC(N,1.0)*base*0.35;
        c = vec4(pow(col, vec3(1.0/2.2))*c.a, c.a);
      }
      o = c;
    }`;
  const SHADOW_VS = `layout(location=0) in vec3 aPos; uniform mat4 uModel; uniform mat4 uLVP; void main(){ gl_Position = uLVP*uModel*vec4(aPos,1.0); }`;
  const SHADOW_FS = `out vec4 o; void main(){ o = vec4(1.0); }`;
  const SHPLANE_VS = `layout(location=0) in vec2 aPos; uniform mat4 uModel; uniform mat4 uLVP; uniform vec4 uRect; out vec2 vUV; void main(){ vUV=vec2(aPos.x,1.0-aPos.y); gl_Position = uLVP*uModel*vec4(mix(uRect.xy,uRect.zw,aPos),0.0,1.0); }`;
  const SHPLANE_FS = `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform float uOp; void main(){ if(texture(uTex,vUV).a*uOp < 0.5) discard; o=vec4(1.0); }`;
  const SPRITE_VS = `layout(location=0) in vec2 aPos; layout(location=1) in vec3 iPos; layout(location=2) in vec4 iCol; layout(location=3) in vec2 iSR;
    uniform mat4 uV; uniform mat4 uP; out vec2 vQ; out vec4 vC;
    void main(){ vec4 c = uV*vec4(iPos,1.0); vec2 q = aPos*2.0-1.0; float cs=cos(iSR.y), sn=sin(iSR.y); vec2 r = vec2(q.x*cs-q.y*sn, q.x*sn+q.y*cs); c.xy += r*iSR.x; vQ=q; vC=iCol; gl_Position = uP*c; }`;
  const SPRITE_FS = `in vec2 vQ; in vec4 vC; out vec4 o; uniform int uShape; uniform float uGlow; uniform sampler2D uTex;
    void main(){ float a;
      if(uShape==1){ vec4 t = texture(uTex, vQ*0.5+0.5); a = t.a; o = vec4(vC.rgb*t.rgb, 1.0)*vC.a*a; if(o.a<0.002) discard; return; }
      float d = length(vQ); if(d>1.0) discard; a = exp(-d*d*3.2)*(1.0+uGlow) * 0.75 + smoothstep(1.0,0.35,d)*0.25; o = vec4(vC.rgb*a, a)*vC.a; }`;
  const PMESH_VS = `layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=4) in vec3 iPos; layout(location=5) in vec4 iCol; layout(location=6) in vec2 iSR; layout(location=7) in vec3 iAx;
    uniform mat4 uVP; out vec3 vW; out vec3 vN; out vec4 vC;
    mat3 rot(vec3 ax, float a){ ax=normalize(ax); float c=cos(a), s=sin(a), t=1.0-c; return mat3(t*ax.x*ax.x+c, t*ax.x*ax.y+s*ax.z, t*ax.x*ax.z-s*ax.y, t*ax.x*ax.y-s*ax.z, t*ax.y*ax.y+c, t*ax.y*ax.z+s*ax.x, t*ax.x*ax.z+s*ax.y, t*ax.y*ax.z-s*ax.x, t*ax.z*ax.z+c); }
    void main(){ mat3 R = rot(iAx, iSR.y); vec3 w = iPos + R*(aPos*iSR.x); vW=w; vN=R*aNrm; vC=iCol; gl_Position = uVP*vec4(w,1.0); }`;
  const PMESH_FS = ENV_GLSL + TONE + LIGHTS_GLSL + `in vec3 vW; in vec3 vN; in vec4 vC; out vec4 o; uniform vec3 uCam; uniform float uMetal; uniform float uRough; uniform float uGlow;
    void main(){ vec3 N=normalize(vN), V=normalize(uCam-vW); if(dot(N,V)<0.0) N=-N; vec3 base=toLin(vC.rgb); vec3 F0=mix(vec3(0.04),base,uMetal);
      vec3 col = uAmb*base + envC(N,1.0)*base*(1.0-uMetal) + envC(reflect(-V,N), uRough)*F0;
      for(int i=0;i<4;i++){ if(i>=uNL) break; vec3 L = uLP[i].w>0.5? normalize(-uLP[i].xyz) : normalize(uLP[i].xyz-vW); float nl=max(dot(N,L),0.0); vec3 H=normalize(L+V); col += uLC[i].rgb*(base*nl*(1.0-uMetal) + F0*pow(max(dot(N,H),0.0), 2.0/(uRough*uRough+0.01))*nl); }
      col += base*uGlow; o = vec4(toSRGB(col)*vC.a, vC.a); }`;
  const TRAIL_VS = `layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; uniform mat4 uVP; out vec4 vC; void main(){ vC=aCol; gl_Position=uVP*vec4(aPos,1.0); }`;
  const TRAIL_FS = `in vec4 vC; out vec4 o; void main(){ o = vec4(vC.rgb*vC.a, vC.a); }`;
  const DOF_FS = `in vec2 vUV; out vec4 o; uniform sampler2D uCol; uniform sampler2D uDep; uniform float uN; uniform float uF; uniform float uFocus; uniform float uK; uniform float uMax; uniform vec2 uPx;
    float lin(float d){ float z=d*2.0-1.0; return 2.0*uN*uF/(uF+uN-z*(uF-uN)); }
    float coc(float z){ return clamp(uK*abs(z-uFocus)/max(z,1.0), 0.0, uMax); }
    void main(){
      float zc = lin(texture(uDep,vUV).r); float cc = coc(zc);
      vec4 acc = texture(uCol,vUV)/max(cc*cc,1.0); float ws = 1.0/max(cc*cc,1.0);
      for(int i=0;i<64;i++){
        float r = sqrt((float(i)+0.5)/64.0)*uMax; float a=float(i)*2.39996;
        vec2 uv = vUV + vec2(cos(a),sin(a))*r*uPx;
        float zs = lin(texture(uDep,uv).r); float cs = coc(zs);
        float ce = zs > zc ? min(cs, cc*1.0+0.5) : cs;
        float w = smoothstep(r-1.0, r+0.5, ce)/max(ce*ce,1.0);
        acc += texture(uCol,uv)*w; ws += w;
      }
      o = acc/ws;
    }`;
  const FSV = `layout(location=0) in vec2 aPos; out vec2 vUV; void main(){ vUV=aPos; gl_Position=vec4(aPos*2.0-1.0,0.0,1.0); }`;
  const PICK_VS = PBR_VS, PICK_FS = `in vec3 vW; in vec3 vN; in vec2 vUV; in float vX; out vec4 o; uniform vec4 uId; void main(){ o = uId; }`;
  const PICKPL_FS = `in vec2 vUV; in vec3 vW; in vec3 vN; out vec4 o; uniform sampler2D uTex; uniform vec4 uId; uniform float uOp; void main(){ if(texture(uTex,vUV).a*uOp < 0.1) discard; o = uId; }`;
  const prog = (n) => {
    const S = { pbr: [PBR_VS, PBR_FS], plane: [PLANE_VS, PLANE_FS], shadow: [SHADOW_VS, SHADOW_FS], shplane: [SHPLANE_VS, SHPLANE_FS], sprite: [SPRITE_VS, SPRITE_FS], pmesh: [PMESH_VS, PMESH_FS], trail: [TRAIL_VS, TRAIL_FS], dof: [FSV, DOF_FS], pick: [PICK_VS, PICK_FS], pickpl: [PLANE_VS, PICKPL_FS] };
    return GL.prog('3d_' + n, S[n][0], S[n][1]);
  };

  // ---------- 环境 ----------
  R3.defaultEnv = () => ({ intensity: 1, top: [0.32, 0.38, 0.52], horizon: [0.62, 0.58, 0.6], ground: [0.08, 0.075, 0.08],
    boxes: [{ dir: [-0.5, -0.75, -0.45], size: 0.42, color: [1, 0.97, 0.92], k: 5.0 }, { dir: [0.8, -0.3, 0.5], size: 0.25, color: [0.55, 0.75, 1], k: 3.5 }, { dir: [0.1, -0.2, -1], size: 0.18, color: [1, 0.6, 0.35], k: 2.5 }] });
  function envUniforms(comp) {
    const e = comp.env || R3.defaultEnv();
    const bd = new Float32Array(12), bc = new Float32Array(12);
    (e.boxes || []).slice(0, 3).forEach((b, i) => { const d = U.norm(b.dir); bd.set([d[0], d[1], d[2], b.size], i * 4); bc.set([b.color[0], b.color[1], b.color[2], b.k], i * 4); });
    return { uEnvTop: e.top, uEnvHor: e.horizon, uEnvGnd: e.ground, uEnvK: e.intensity, uBoxD: { v4a: bd }, uBoxC: { v4a: bc } };
  }

  // ---------- 几何求值（带缓存） ----------
  const hashPolys = (polys) => { let h = polys.length * 7.13; for (const pl of polys) { const p = pl.p; for (let k = 0; k < p.length; k += 2) h = (h * 1.000173 + p[k] * 0.31 + p[k + 1] * 0.73 + k * 0.001) % 1e9; h += p.length; } return h.toFixed(4); };
  R3.hashPolys = hashPolys;
  function cacheGet(layer, key) { const c = layer._gc || (layer._gc = new Map()); const v = c.get(key); return v; }
  function cachePut(layer, key, v) { const c = layer._gc || (layer._gc = new Map()); if (c.size > 24) { const k0 = c.keys().next().value; const old = c.get(k0); c.delete(k0); if (old && old._vao) GL.freeMesh(old); } c.set(key, v); }
  // 源网格（变形前，图层空间）
  R3.baseMesh = (layer, t, ctx) => {
    const s = layer.geo.source, V = (p) => E.prop(p, t, ctx, layer);
    let key, build;
    if (s.kind === 'box') { const sz = V(s.size), bv = V(s.bevel); key = 'box' + sz.join(',') + ':' + bv; build = () => Mesh.box(sz[0], sz[1], sz[2], bv); }
    else if (s.kind === 'sphere') { const r = V(s.radius), sg = Math.round(V(s.segs)); key = 'sph' + r + ':' + sg; build = () => Mesh.sphere(r, sg); }
    else if (s.kind === 'torus') { const a = V(s.majorR), b = V(s.minorR), sg = Math.round(V(s.segs)); key = 'tor' + a + ':' + b + ':' + sg; build = () => Mesh.torus(a, b, sg); }
    else if (s.kind === 'plane') { const sz = V(s.size), sg = Math.round(V(s.segs)); key = 'pl' + sz.join(',') + ':' + sg; build = () => Mesh.plane(sz[0], sz[1], sg); }
    else if (s.kind === 'extrude' || s.kind === 'node') {
      let polys = [], mesh = null, pup = null;
      if (s.kind === 'extrude' && s.from && s.from.layer) {
        const src = E.layer(ctx.comp, s.from.layer);
        if (src) polys = C.layerGeometry(src, t, ctx, 0.6);
        if (src && AE.Puppet && src.puppet && src.puppet.on) { const pp = AE.Puppet.deformedOutline(src, t, ctx); if (pp) { polys = pp; if (src.puppet.overlap.length) pup = src; } }
      } else {
        const out = s.kind === 'node' ? s.output : s.from && s.from.output;
        if (out && AE.Nodes) { const g = AE.Nodes.output(ctx.comp, out, t, ctx); if (g) { if (g.mesh) mesh = g.mesh; else if (g.paths) polys = g.paths.filter(p => p.c); } }
      }
      if (mesh) { if (layer._lastNodeMesh && layer._lastNodeMesh !== mesh) GL.freeMesh(layer._lastNodeMesh); layer._lastNodeMesh = mesh; return mesh; }
      const d = s.depth ? V(s.depth) : 60, bv = s.bevel ? V(s.bevel) : 0, bs = s.bevelSegs || 4;
      key = 'ex' + hashPolys(polys) + ':' + d + ':' + bv + ':' + bs;
      build = () => {
        const m = Mesh.extrude(polys, d, bv, bs);
        if (pup) { // 二维叠放 → 局部深度（沿 -Z 前移）
          const pm = AE.Puppet.mesh(pup, t, ctx); const k = d * 1.2;
          if (pm) for (let i = 0; i < m.pos.length; i += 3) { let bi = 0, bd = Infinity; for (let j = 0; j < pm.pos.length / 2; j += 1) { const dd = (pm.pos[2 * j] - m.pos[i]) ** 2 + (pm.pos[2 * j + 1] - m.pos[i + 1]) ** 2; if (dd < bd) { bd = dd; bi = j; } } m.pos[i + 2] -= pm.depth[bi] * k; }
          m.rest = m.pos.slice(); Mesh.bounds(m);
        }
        return m;
      };
    } else return null;
    let m = cacheGet(layer, key);
    if (!m) { m = build(); m.key = key; cachePut(layer, key, m); }
    return m;
  };
  // 变形后的网格
  R3.geoMesh = (layer, t, ctx) => {
    const base = R3.baseMesh(layer, t, ctx);
    if (!base) return null;
    const defs = (layer.geo.deformers || []).filter(d => d.on);
    const fieldMats = Object.values(layer.geo.mats).some(m => m.fieldTarget && m.fieldTarget !== 'none' && m.field);
    if (!defs.length && !fieldMats) return base;
    const V = (p) => E.prop(p, t, ctx, layer);
    const sig = base.key + '|' + defs.map(d => JSON.stringify([d.type, d.angle && V(d.angle), d.range && V(d.range), d.center && V(d.center), d.amount && V(d.amount), d.axis, d.field, d.mode, d.frequency && V(d.frequency), d.speed && V(d.speed), d.noiseScale && V(d.noiseScale)])).join('|') + (defs.some(d => d.type === 'field' || d.type === 'noise' || d.type === 'wave') || fieldMats ? '@' + t + ctx.inst.key + JSON.stringify(Array.from(E.world(layer, t, ctx)).map(x => +x.toFixed(3))) : '');
    const ck = layer._dc;
    if (ck && ck.sig === sig && ck.base === base) return ck.mesh;
    const m = Mesh.clone(base);
    m.pos = base.rest.slice(); m.nrm = (base.restN || base.nrm).slice();
    const W = E.world(layer, t, ctx), Wi = M4.inv(W);
    let first = true;
    for (const d of defs) {
      let fn = null;
      if (d.type === 'bend') fn = Mesh.bendFn(V(d.angle), d.axis || 'x', V(d.center), Math.max(1, V(d.range)));
      else if (d.type === 'twist') fn = Mesh.twistFn(V(d.angle), d.axis || 'y', Math.max(1, V(d.range)));
      else if (d.type === 'noise') { const a = V(d.amount), sc = Math.max(1, V(d.noiseScale)), sp = V(d.speed); fn = p => { const n = U.noise3(p[0] / sc, p[1] / sc, p[2] / sc + t * sp); const n2 = U.noise3(p[0] / sc + 9.1, p[1] / sc + 3.3, p[2] / sc - t * sp); return [p[0] + n2 * a * 0.3, p[1] + n * a, p[2] + n * a * 0.5]; }; }
      else if (d.type === 'wave') { const a = V(d.amount), fq = V(d.frequency), sp = V(d.speed), ai = d.axis === 'y' ? 1 : 0; const L = base.bb ? Math.max(1, base.bb[3 + ai] - base.bb[ai]) : 400; fn = p => { const q = p.slice(); q[1 - ai === 0 ? 0 : 1] += 0; q[ai === 0 ? 1 : 0] += Math.sin(p[ai] / L * Math.PI * 2 * fq - t * sp * Math.PI * 2) * a; return q; }; }
      else if (d.type === 'field' && d.field && AE.Fields) {
        const amt = V(d.amount);
        fn = (p) => {
          const w = M4.apply(W, p);
          if (d.mode === 'vector') { const f = AE.Fields.sampleNamedVec(ctx.comp, d.field, w, t, ctx); const l = M4.applyDir(Wi, f); return [p[0] + l[0] * amt, p[1] + l[1] * amt, p[2] + l[2] * amt]; }
          const f = AE.Fields.sampleNamed(ctx.comp, d.field, w, t, ctx);
          // 沿径向（相对网格中心）鼓出
          const c = base.bb ? [(base.bb[0] + base.bb[3]) / 2, (base.bb[1] + base.bb[4]) / 2, (base.bb[2] + base.bb[5]) / 2] : [0, 0, 0];
          const dv = U.norm(U.sub(p, c)); return [p[0] + dv[0] * f * amt, p[1] + dv[1] * f * amt, p[2] + dv[2] * f * amt];
        };
      }
      if (!fn) continue;
      Mesh.deform(m, fn, !first);
      first = false;
    }
    // 场驱动的材质参数（逐顶点）
    if (fieldMats && AE.Fields) {
      const mt = Object.values(layer.geo.mats).find(m => m.fieldTarget !== 'none' && m.field);
      const n = m.pos.length / 3, ex = new Float32Array(n);
      for (let i = 0; i < n; i++) { const w = M4.apply(W, [m.pos[3 * i], m.pos[3 * i + 1], m.pos[3 * i + 2]]); ex[i] = AE.Fields.sampleNamed(ctx.comp, mt.field, w, t, ctx); }
      m.extra = ex;
    }
    m.ver = (layer._dcVer = (layer._dcVer || 0) + 1);
    Mesh.bounds(m);
    if (ck && ck.mesh && ck.mesh !== base) GL.freeMesh(ck.mesh);
    layer._dc = { sig, base, mesh: m };
    return m;
  };
  // 实例矩阵（图层空间）
  R3.instances = (layer, t, ctx) => {
    const ins = layer.geo.instances;
    if (!ins || ins.mode === 'none') return [M4.ident()];
    const V = (p) => E.prop(p, t, ctx, layer);
    const n = Math.max(1, Math.round(V(ins.count))), sp = V(ins.spacing), out = [];
    const W = E.world(layer, t, ctx), Wi = M4.inv(W);
    if (ins.mode === 'grid') {
      const side = Math.ceil(Math.sqrt(n));
      for (let k = 0; k < n; k++) { const i = k % side, j = Math.floor(k / side); out.push(M4.trans((i - (side - 1) / 2) * sp[0], (j - (side - 1) / 2) * sp[1], k * sp[2])); }
    } else if (ins.mode === 'radial') {
      const r = sp[0];
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + (ins.phase ? V(ins.phase) * U.deg : 0); out.push(M4.mul(M4.trans(Math.cos(a) * r, Math.sin(a) * r * (sp[1] / Math.max(1, sp[0])), Math.sin(a) * sp[2]), M4.rotZ(a))); }
    } else if (ins.mode === 'path' && ins.path) {
      const src = E.layer(ctx.comp, ins.path);
      if (src) {
        const g = C.shapeGeometry(src, t, ctx, 1); const pl = g.paths[0];
        if (pl) {
          const cum = P.cumLen(pl), L = cum[cum.length - 1], SW = E.world(src, t, ctx);
          const phase = ins.phase ? V(ins.phase) / 100 : 0;
          for (let k = 0; k < n; k++) {
            const s = ((k / (pl.c ? n : Math.max(1, n - 1)) + phase) % 1 + 1) % 1 * L;
            const pt = P.pointAt(pl, cum, s);
            const wpt = M4.apply(SW, [pt.x, pt.y, 0]), lp = M4.apply(Wi, wpt);
            out.push(M4.mul(M4.trans(lp[0], lp[1], lp[2]), M4.rotZ(Math.atan2(pt.ty, pt.tx))));
          }
        }
      }
    }
    // 场影响实例排布
    if (ins.field && AE.Fields) {
      const amt = ins.fieldAmount ? V(ins.fieldAmount) : 1;
      for (let k = 0; k < out.length; k++) {
        const m = out[k], wp = M4.apply(W, [m[12], m[13], m[14]]);
        const f = AE.Fields.sampleNamedVec(ctx.comp, ins.field, wp, t, ctx), l = M4.applyDir(Wi, f);
        const s = 1 + AE.Fields.sampleNamed(ctx.comp, ins.field, wp, t, ctx) * (ins.fieldScale || 0);
        out[k] = M4.mul(M4.trans(l[0] * amt, l[1] * amt, l[2] * amt), M4.mul(m, M4.scale(s, s, s)));
      }
    }
    return out;
  };
  // 文字挤出：逐字网格（缓存）+ 逐字三维排布
  R3.textMeshes = (layer, src, t, ctx) => {
    const s = layer.geo.source, V = (p) => E.prop(p, t, ctx, layer);
    const d = V(s.depth), bv = V(s.bevel), bs = s.bevelSegs || 4;
    const pl = C.textPlacements(src, t, ctx, 0.5);
    const out = [];
    for (const it of pl.items) {
      const key = 'gl' + it.c.ch + src.text.font + src.text.weight + ':' + d / it.c.size + ':' + bv / it.c.size + ':' + bs;
      let m = cacheGet(layer, key);
      if (!m) { m = Mesh.extrude(it.c.polys.map(p => ({ c: true, p: p.p.map(v => v * 1) })), d / it.c.size, bv / it.c.size, bs, { uvScale: 1 }); m.key = key; cachePut(layer, key, m); }
      const [sz, lx, ly] = it.local;
      let mm = M4.trans(it.pos3[0], it.pos3[1], it.pos3[2]);
      mm = M4.mul(mm, M4.rotX(it.rot3[0] * U.deg)); mm = M4.mul(mm, M4.rotY(it.rot3[1] * U.deg)); mm = M4.mul(mm, M4.rotZ(it.rot3[2] * U.deg));
      mm = M4.mul(mm, M4.scale(it.scl[0], it.scl[1], 1));
      mm = M4.mul(mm, M4.trans(lx, ly, -d / 2));
      mm = M4.mul(mm, M4.scale(sz, sz, sz));
      out.push({ mesh: m, m: mm, op: it.op });
    }
    return out;
  };

  // ---------- 收集三维组内容 ----------
  R3.gather = (comp, layers, t, ctx, opts, space, parentM, out, cam) => {
    out = out || { meshes: [], planes: [], particles: [] };
    for (const l of layers) {
      if (l.type === 'camera' || l.type === 'light' || l.type === 'null' || l.type === 'audio' || l.type === 'synth' || l.type === 'adjust') continue;
      const lt = R.layerTime(l, t, opts, comp);
      const W = parentM ? M4.mul(parentM, E.world(l, lt, ctx)) : E.world(l, lt, ctx);
      const op = E.opacity(l, lt, ctx) * (opts.opMul || 1);
      if (op <= 0.001) continue;
      if (l.type === 'geo3d') {
        const src = l.geo.source.kind === 'extrude' && l.geo.source.from && l.geo.source.from.layer ? E.layer(ctx.comp, l.geo.source.from.layer) : null;
        const inst = R3.instances(l, lt, ctx);
        if (src && src.type === 'text' && !(l.geo.deformers || []).some(d => d.on)) {
          const tm = R3.textMeshes(l, src, lt, ctx);
          for (const g of tm) for (const im of inst) out.meshes.push({ layer: l, mesh: g.mesh, W: M4.mul(M4.mul(W, im), g.m), op: op * g.op, t: lt, ctx });
        } else if (src && src.type === 'text') {
          // 有变形器：合并字形后整体变形
          const tm = R3.textMeshes(l, src, lt, ctx);
          const key = 'tm' + tm.map(g => g.mesh.key + Array.from(g.m).map(x => x.toFixed(2)).join(',')).join('|');
          let merged = cacheGet(l, key);
          if (!merged) { merged = Mesh.merge(tm.map(g => ({ mesh: g.mesh, m: g.m }))); merged.key = key; cachePut(l, key, merged); }
          const saved = R3.baseMesh; const mesh = deformCustom(l, merged, lt, ctx);
          for (const im of inst) out.meshes.push({ layer: l, mesh, W: M4.mul(W, im), op, t: lt, ctx });
        } else {
          const mesh = R3.geoMesh(l, lt, ctx);
          if (mesh) for (const im of inst) out.meshes.push({ layer: l, mesh, W: M4.mul(W, im), op, t: lt, ctx });
        }
      } else if (l.type === 'particles') {
        if (AE.Particles) {
          const st = AE.Particles.state(l, lt, ctx);
          if (st) { const it = { layer: l, st, W, op, t: lt, ctx }; const lk = l.particles.look; if (lk.mode === 'shape' && lk.shape) { const sl = E.layer(ctx.comp, lk.shape); if (sl) it.shapeTex = particleShapeTex(sl, lt, ctx); } out.particles.push(it); }
        }
      } else if (l.type === 'precomp' && l.precomp.space === 'keep3d') {
        const src = E.comp(l.precomp.source); if (!src) continue;
        const cctx = E.child(ctx, l, lt); if (!cctx || cctx.inst.depth > 10) continue;
        const it = E.innerTime(l, lt, ctx);
        const inner = src.layers.filter(x => x.visible && E.activeAt(x, it)).slice().reverse();
        const in3 = inner.filter(x => x.threeD);
        R3.gather(src, in3, it, cctx, Object.assign({}, opts, { opMul: op }), space, W, out, cam);
        // 内部二维图层作为位于 Z=0 的平面进入外层空间
        for (const x of inner.filter(x => !x.threeD && (x.type === 'shape' || x.type === 'text' || x.type === 'solid' || x.type === 'precomp'))) {
          const pxPer = estimatePx(space, M4.mul(W, E.world(x, it, cctx)), cam);
          const lt2 = R.layerTexLocal(x, it, cctx, pxPer, opts);
          if (lt2) out.planes.push({ layer: x, tex: lt2.tex, rect: lt2.rect, W: M4.mul(W, E.world(x, it, cctx)), op: op * E.opacity(x, it, cctx), lit: false, cast: x.mat.cast, recv: x.mat.accept });
        }
      } else if (l.type === 'shape' || l.type === 'text' || l.type === 'solid' || l.type === 'precomp') {
        const pxPer = estimatePx(space, W, cam);
        const lt2 = R.layerTexLocal(l, lt, ctx, pxPer, opts);
        if (lt2) out.planes.push({ layer: l, tex: lt2.tex, rect: lt2.rect, W, op, lit: l.mat.lit, cast: l.mat.cast, recv: l.mat.accept });
      }
    }
    return out;
  };
  function deformCustom(layer, merged, t, ctx) {
    const defs = (layer.geo.deformers || []).filter(d => d.on);
    const V = (p) => E.prop(p, t, ctx, layer);
    const sig = merged.key + defs.map(d => JSON.stringify([d.type, d.angle && V(d.angle), d.range && V(d.range), d.center && V(d.center), d.amount && V(d.amount), d.axis])).join('|');
    if (layer._tdc && layer._tdc.sig === sig) return layer._tdc.mesh;
    const m = Mesh.clone(merged); let first = true;
    for (const d of defs) {
      let fn = null;
      if (d.type === 'bend') fn = Mesh.bendFn(V(d.angle), d.axis || 'x', V(d.center), Math.max(1, V(d.range)));
      if (d.type === 'twist') fn = Mesh.twistFn(V(d.angle), d.axis || 'y', Math.max(1, V(d.range)));
      if (fn) { Mesh.deform(m, fn, !first); first = false; }
    }
    m.ver = Math.random();
    if (layer._tdc && layer._tdc.mesh) GL.freeMesh(layer._tdc.mesh);
    layer._tdc = { sig, mesh: m };
    return m;
  }
  function estimatePx(space, W, cam) {
    const ls = Math.cbrt(Math.abs(M4.mul(W, M4.ident())[0] * W[5] * W[10]) || 1) || 1;
    const s2 = Math.sqrt(Math.abs(W[0] * W[5] - W[1] * W[4])) || 1;
    let k = 1;
    if (cam) { const c = M4.apply(cam.view, [W[12], W[13], W[14]]); k = cam.zoom / Math.max(50, c[2]); }
    return U.clamp(space.scale * Math.max(ls, s2) * U.clamp(k, 0.3, 4) * 1.15, 0.1, 4);
  }

  // ---------- 灯光 ----------
  R3.lights = (comp, t, ctx) => {
    const L = [], amb = [0, 0, 0];
    let shadowIdx = -1;
    for (const l of comp.layers) {
      if (l.type !== 'light' || !l.visible || !E.activeAt(l, t)) continue;
      const V = (p) => E.prop(p, t, ctx, l);
      const c = V(l.light.color), k = V(l.light.intensity) / 100;
      if (l.light.kind === 'ambient') { amb[0] += c[0] * k * 0.6; amb[1] += c[1] * k * 0.6; amb[2] += c[2] * k * 0.6; continue; }
      if (L.length >= 4) continue;
      const W = E.world(l, t, ctx);
      const pos = [W[12], W[13], W[14]];
      if (l.light.kind === 'parallel') { const f = U.norm([W[8], W[9], W[10]]); L.push({ layer: l, dir: f, pos, w: 1, col: [c[0] * k, c[1] * k, c[2] * k], r: 1 }); }
      else L.push({ layer: l, pos, w: 0, col: [c[0] * k, c[1] * k, c[2] * k], r: V(l.light.falloffRadius) });
      if (l.light.cast && shadowIdx < 0) { shadowIdx = L.length - 1; L[shadowIdx].dark = U.clamp(V(l.light.shadowDarkness) / 100, 0, 1); L[shadowIdx].soft = V(l.light.shadowDiffusion); }
    }
    return { L, amb, shadowIdx };
  };
  function lightUniforms(lt) {
    const lp = new Float32Array(16), lc = new Float32Array(16);
    lt.L.forEach((l, i) => { if (l.w) lp.set([l.dir[0], l.dir[1], l.dir[2], 1], i * 4); else lp.set([l.pos[0], l.pos[1], l.pos[2], 0], i * 4); lc.set([l.col[0], l.col[1], l.col[2], l.r], i * 4); });
    return { uNL: GL.int(lt.L.length), uLP: { v4a: lp }, uLC: { v4a: lc }, uAmb: lt.amb, uShL: GL.int(lt.shadowIdx) };
  }

  // ---------- 阴影贴图 ----------
  let shadowRT = null;
  function getShadowRT(size) {
    const gl = GL.gl;
    if (shadowRT && shadowRT.size === size) return shadowRT;
    if (shadowRT) { gl.deleteFramebuffer(shadowRT.fbo); gl.deleteTexture(shadowRT.tex); }
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    shadowRT = { fbo, tex, size };
    return shadowRT;
  }
  function sceneBounds(items) {
    let b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    const addP = (p) => { for (let i = 0; i < 3; i++) { if (p[i] < b[i]) b[i] = p[i]; if (p[i] > b[i + 3]) b[i + 3] = p[i]; } };
    for (const it of items.meshes) { const bb = it.mesh.bb; if (!bb) continue; for (let c = 0; c < 8; c++) addP(M4.apply(it.W, [c & 1 ? bb[3] : bb[0], c & 2 ? bb[4] : bb[1], c & 4 ? bb[5] : bb[2]])); }
    for (const it of items.planes) { const r = it.rect; for (let c = 0; c < 4; c++) addP(M4.apply(it.W, [c & 1 ? r[2] : r[0], c & 2 ? r[3] : r[1], 0])); }
    return b[0] === Infinity ? null : b;
  }
  function shadowPass(items, lt) {
    const gl = GL.gl;
    if (lt.shadowIdx < 0) return null;
    const L = lt.L[lt.shadowIdx];
    const casters = { meshes: items.meshes.filter(m => m.layer.geo.cast !== false && m.op > 0.3), planes: items.planes.filter(p => p.cast) };
    const all = sceneBounds(items);
    if (!all) return null;
    const ctr = [(all[0] + all[3]) / 2, (all[1] + all[4]) / 2, (all[2] + all[5]) / 2];
    const rad = Math.max(10, Math.hypot(all[3] - all[0], all[4] - all[1], all[5] - all[2]) / 2);
    let view, proj;
    if (L.w) { const eye = U.sub(ctr, U.scale(L.dir, rad * 2)); view = M4.lookAt(eye, ctr); proj = M4.orthoCam(rad, rad, rad * 0.5, rad * 3.5); }
    else { view = M4.lookAt(L.pos, ctr); const d = Math.max(rad * 0.2, U.dist(L.pos, ctr)); const fov = Math.min(2.6, 2 * Math.atan(rad / Math.max(1, d - rad * 0.3)) + 0.1); proj = M4.persp(fov, 1, Math.max(5, d - rad * 1.5), d + rad * 2); }
    const VP = M4.mul(proj, view);
    const rt = getShadowRT(2048);
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo); gl.viewport(0, 0, rt.size, rt.size);
    gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.CULL_FACE); GL.blend(null);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2.0);
    const sp = prog('shadow'), vp = GL.m4(VP);
    for (const it of casters.meshes) {
      GL.use(sp, { uModel: GL.m4(it.W), uLVP: vp });
      gl.bindVertexArray(GL.meshVAO(it.mesh)); gl.drawElements(gl.TRIANGLES, it.mesh.idx.length, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
    const pp = prog('shplane');
    for (const it of casters.planes) { GL.use(pp, { uModel: GL.m4(it.W), uLVP: vp, uRect: it.rect, uTex: it.tex, uOp: it.op }); GL.drawQuad(); }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { VP, tex: rt.tex, dark: L.dark === undefined ? 0.8 : L.dark, soft: Math.max(0.5, L.soft || 3), bias: L.w ? 0.0015 : 0.0006 };
  }

  // ---------- 主渲染 ----------
  R3.camMatrices = (comp, cam, space) => {
    const aspect = comp.width / comp.height;
    const proj = cam.ortho ? M4.orthoCam(cam.ortho * aspect, cam.ortho, 1, 20000) : M4.persp(cam.fov, aspect, NEAR, FAR);
    const r = space.rect;
    const snx = (r[2] - r[0]) / comp.width, sny = (r[3] - r[1]) / comp.height;
    const cnx = (r[0] + r[2]) / comp.width - 1, cny = 1 - (r[1] + r[3]) / comp.height;
    const crop = M4.ident(); crop[0] = 1 / snx; crop[5] = 1 / sny; crop[12] = -cnx / snx; crop[13] = -cny / sny;
    return { proj: M4.mul(crop, proj), view: cam.view, VP: M4.mul(M4.mul(crop, proj), cam.view) };
  };
  R3.renderGroup = (comp, layers, t, ctx, space, opts = {}) => {
    const gl = GL.gl;
    const camT = (() => { const c = E.activeCamera(comp, t); return c ? R.layerTime(c, t, opts, comp) : t; })();
    const cam = opts.camOverride || E.cameraAt(comp, camT, ctx);
    const items = R3.gather(comp, layers.slice(), t, ctx, opts, space, null, null, cam);
    if (!items.meshes.length && !items.planes.length && !items.particles.length) { releaseItems(items); return null; }
    const lt = R3.lights(comp, t, ctx);
    const sh = shadowPass(items, lt);
    const cm = R3.camMatrices(comp, cam, space);
    const T = GL.target(space.w, space.h, 'd');
    GL.bind(T, true); GL.clear();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.CULL_FACE);
    const common = Object.assign({ uVP: GL.m4(cm.VP), uCam: cam.eye }, envUniforms(comp), lightUniforms(lt),
      sh ? { uShMap: sh.tex, uShVP: GL.m4(sh.VP), uShOn: GL.int(1), uShDark: sh.dark, uShSoft: sh.soft, uShBias: sh.bias } : { uShOn: GL.int(0), uShMap: GL.black });
    // 不透明网格
    const pbr = prog('pbr');
    const drawMesh = (it, transparent) => {
      const vao = GL.meshVAO(it.mesh);
      const nm = M4.normal3(it.W);
      const recv = it.layer.geo ? it.layer.geo.receive !== false : true;
      for (const g of it.mesh.groups) {
        const mat = it.layer.geo.mats[g.mat] || it.layer.geo.mats.front;
        const V = (p) => E.prop(p, it.t, it.ctx, it.layer);
        const op = U.clamp(V(mat.opacity) / 100, 0, 1) * it.op;
        if ((op < 0.999) !== transparent) continue;
        const ft = { none: 0, emissive: 1, roughness: 2, metallic: 3, baseColor: 4 }[mat.fieldTarget || 'none'] || 0;
        GL.use(pbr, Object.assign({}, common, {
          uModel: GL.m4(it.W), uNM: { m3: nm }, uBase: V(mat.baseColor), uMetal: V(mat.metallic), uRough: V(mat.roughness), uEmis: V(mat.emissive).slice(0, 3), uEmisK: V(mat.emissiveStrength),
          uOpacity: op, uFT: GL.int(ft && it.mesh.extra ? ft : 0), uFK: V(mat.fieldAmount), uLit: GL.int(1), uRecv: GL.int(recv ? 1 : 0), uDS: GL.int(1)
        }));
        gl.bindVertexArray(vao);
        gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, g.start * 4);
      }
      gl.bindVertexArray(null);
    };
    GL.blend('pre');
    for (const it of items.meshes) drawMesh(it, false);
    // 透明网格与平面：由远及近
    const depthOf = (W, c) => M4.apply(cm.view, M4.apply(W, c || [0, 0, 0]))[2];
    const trans = [];
    for (const it of items.meshes) { const bb = it.mesh.bb; trans.push({ k: 'm', it, z: depthOf(it.W, bb ? [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2] : null) }); }
    for (const it of items.planes) trans.push({ k: 'p', it, z: depthOf(it.W, [(it.rect[0] + it.rect[2]) / 2, (it.rect[1] + it.rect[3]) / 2, 0]) });
    trans.sort((a, b) => b.z - a.z);
    const pl = prog('plane');
    for (const e of trans) {
      if (e.k === 'm') { gl.depthMask(false); drawMesh(e.it, true); gl.depthMask(true); continue; }
      const it = e.it;
      // 先以阈值写深度（实心部分参与遮挡），再柔边混合
      GL.use(pl, Object.assign({}, common, { uModel: GL.m4(it.W), uNM: { m3: M4.normal3(it.W) }, uRect: it.rect, uTex: it.tex, uOp: it.op, uLit: GL.int(it.lit ? 1 : 0), uRecv: GL.int(it.recv ? 1 : 0), uCut: 0.004 }));
      gl.depthMask(false); GL.drawQuad();
      gl.colorMask(false, false, false, false); gl.depthMask(true);
      GL.use(pl, { uCut: 0.6 }); GL.drawQuad();
      gl.colorMask(true, true, true, true);
    }
    // 粒子与拖尾
    for (const p of items.particles) drawParticles(p, cm, cam, common, space);
    gl.depthMask(true); gl.disable(gl.DEPTH_TEST); GL.blend(null);
    GL.resolve(T, true);
    releaseItems(items);
    // 景深
    if (cam.dof && cam.aperture > 0.01) {
      const out = GL.target(space.w, space.h, 'c');
      const K = cam.aperture * cam.blur * space.scale * 0.5;
      GL.bind(out); GL.blend(null);
      GL.use(prog('dof'), { uCol: T, uDep: T.depthTex, uN: NEAR, uF: FAR, uFocus: cam.focus, uK: K, uMax: Math.min(48, 28 * space.scale + 4), uPx: [1 / space.w, 1 / space.h] });
      GL.drawQuad();
      GL.release(T);
      return out;
    }
    const out = GL.target(space.w, space.h, 'c');
    R.fs('copy', out, { uTex: T, uOp: 1 });
    GL.release(T);
    return out;
  };
  function releaseItems(items) { for (const p of items.planes) GL.release(p.tex); for (const p of items.particles) if (p.shapeTex) GL.release(p.shapeTex.tex); }

  // ---------- 粒子 ----------
  let pbuf = null;
  function particleBuffers() {
    const gl = GL.gl;
    if (pbuf) return pbuf;
    pbuf = { vao: gl.createVertexArray(), inst: gl.createBuffer(), quad: gl.createBuffer(), mvao: gl.createVertexArray(), tvao: gl.createVertexArray(), tbuf: gl.createBuffer(), size: 0, tsize: 0, meshes: {} };
    gl.bindVertexArray(pbuf.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, pbuf.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, pbuf.inst);
    const st = 12 * 4;
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 12); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, st, 28); gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(pbuf.tvao);
    gl.bindBuffer(gl.ARRAY_BUFFER, pbuf.tbuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);
    return pbuf;
  }
  function particleMeshVAO(kind) {
    const gl = GL.gl, b = particleBuffers();
    if (b.meshes[kind]) return b.meshes[kind];
    const m = kind === 'cube' ? Mesh.box(2, 2, 2, 0) : kind === 'sphere' ? Mesh.sphere(1, 10) : Mesh.tetra(0.8);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, m.pos, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, m.nrm, gl.STATIC_DRAW); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.inst);
    const st = 12 * 4;
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 3, gl.FLOAT, false, st, 0); gl.vertexAttribDivisor(4, 1);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, st, 12); gl.vertexAttribDivisor(5, 1);
    gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6, 2, gl.FLOAT, false, st, 28); gl.vertexAttribDivisor(6, 1);
    gl.enableVertexAttribArray(7); gl.vertexAttribPointer(7, 3, gl.FLOAT, false, st, 36); gl.vertexAttribDivisor(7, 1);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    b.meshes[kind] = { vao, count: m.idx.length };
    return b.meshes[kind];
  }
  function drawParticles(p, cm, cam, common, space) {
    const gl = GL.gl, b = particleBuffers(), st = p.st, look = p.layer.particles.look;
    const n = st.count; if (!n && !(st.trails && st.trails.length)) return;
    const V = (pp) => E.prop(pp, p.t, p.ctx, p.layer);
    // 由远及近排序
    const order = new Array(n); const zs = new Float32Array(n);
    for (let i = 0; i < n; i++) { order[i] = i; const x = st.pos[3 * i], y = st.pos[3 * i + 1], z = st.pos[3 * i + 2]; zs[i] = cm.view[2] * x + cm.view[6] * y + cm.view[10] * z + cm.view[14]; }
    order.sort((a, c) => zs[c] - zs[a]);
    // 拖尾
    const trail = p.layer.particles.trail;
    if (trail && trail.on && st.trails) {
      const verts = [];
      const width = V(trail.width), tc = V(trail.color), fade = V(trail.fade);
      const eye = cam.eye;
      for (const tr of st.trails) {
        const m = tr.pts.length / 3; if (m < 2) continue;
        let prevL = null, prevR = null, prevC = null;
        for (let k = 0; k < m; k++) {
          const x = tr.pts[3 * k], y = tr.pts[3 * k + 1], z = tr.pts[3 * k + 2];
          const k2 = Math.min(m - 1, k + 1), k1 = Math.max(0, k - 1);
          const dx = tr.pts[3 * k2] - tr.pts[3 * k1], dy = tr.pts[3 * k2 + 1] - tr.pts[3 * k1 + 1], dz = tr.pts[3 * k2 + 2] - tr.pts[3 * k1 + 2];
          const vx = x - eye[0], vy = y - eye[1], vz = z - eye[2];
          let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx; const sl = Math.hypot(sx, sy, sz) || 1;
          const f = k / (m - 1); // 0 = 最旧
          const w = width * (0.15 + 0.85 * f) * p.op * (tr.w || 1) / 2;
          sx = sx / sl * w; sy = sy / sl * w; sz = sz / sl * w;
          const col = trail.useParticleColor && tr.col ? tr.col : tc;
          const a = Math.pow(f, Math.max(0.1, fade)) * (col[3] === undefined ? 1 : col[3]) * p.op * (tr.a === undefined ? 1 : tr.a);
          const L = [x + sx, y + sy, z + sz, col[0], col[1], col[2], a], Rr = [x - sx, y - sy, z - sz, col[0], col[1], col[2], a];
          if (prevL) verts.push(...prevL, ...prevR, ...L, ...L, ...prevR, ...Rr);
          prevL = L; prevR = Rr;
        }
      }
      if (verts.length) {
        const arr = new Float32Array(verts);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.tbuf);
        if (arr.byteLength > b.tsize) { b.tsize = arr.byteLength * 2; gl.bufferData(gl.ARRAY_BUFFER, b.tsize, gl.DYNAMIC_DRAW); }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr);
        gl.depthMask(false); GL.blend(look.blend === 'add' ? 'add' : 'pre');
        GL.use(prog('trail'), { uVP: GL.m4(cm.VP) });
        gl.bindVertexArray(b.tvao); gl.drawArrays(gl.TRIANGLES, 0, arr.length / 7); gl.bindVertexArray(null);
        gl.depthMask(true); GL.blend('pre');
      }
    }
    if (!n) return;
    const isMesh = look.mode === 'mesh';
    const stride = 12;
    const data = new Float32Array(n * stride);
    const baseSize = V(look.size);
    for (let j = 0; j < n; j++) {
      const i = order[j], o = j * stride;
      data[o] = st.pos[3 * i]; data[o + 1] = st.pos[3 * i + 1]; data[o + 2] = st.pos[3 * i + 2];
      data[o + 3] = st.col[4 * i]; data[o + 4] = st.col[4 * i + 1]; data[o + 5] = st.col[4 * i + 2]; data[o + 6] = st.col[4 * i + 3] * p.op;
      data[o + 7] = st.size[i] * baseSize; data[o + 8] = st.rot[i];
      if (isMesh) { data[o + 9] = st.axis ? st.axis[3 * i] : 0.3; data[o + 10] = st.axis ? st.axis[3 * i + 1] : 1; data[o + 11] = st.axis ? st.axis[3 * i + 2] : 0.2; }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, b.inst);
    if (data.byteLength > b.size) { b.size = data.byteLength * 2; gl.bufferData(gl.ARRAY_BUFFER, b.size, gl.DYNAMIC_DRAW); }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    if (isMesh) {
      const pm = particleMeshVAO(look.meshKind || 'tetra');
      GL.blend('pre'); gl.depthMask(true);
      GL.use(prog('pmesh'), Object.assign({}, common, { uMetal: look.metal === undefined ? 0.6 : look.metal, uRough: look.rough === undefined ? 0.35 : look.rough, uGlow: V(look.glow) * 0.3 }));
      gl.bindVertexArray(pm.vao); gl.drawElementsInstanced(gl.TRIANGLES, pm.count, gl.UNSIGNED_INT, 0, n); gl.bindVertexArray(null);
      return;
    }
    const shapeTex = p.shapeTex || null;
    gl.depthMask(false); GL.blend(look.blend === 'add' ? 'add' : 'pre');
    GL.use(prog('sprite'), { uV: GL.m4(cm.view), uP: GL.m4(cm.proj), uShape: GL.int(shapeTex ? 1 : 0), uGlow: V(look.glow), uTex: shapeTex ? shapeTex.tex : GL.white });
    gl.bindVertexArray(b.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n); gl.bindVertexArray(null);
    gl.depthMask(true); GL.blend('pre');
  }
  function particleShapeTex(layer, t, ctx) {
    const b = R.contentBounds(layer, t, ctx); if (!b) return null;
    const s = Math.max(b[2] - b[0], b[3] - b[1]) / 2 || 1, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    const sp = R.space([cx - s, cy - s, cx + s, cy + s], 128, 128);
    const tex = R.layerTex(layer, t, ctx, sp, { world: M4.ident() });
    return { tex };
  }

  // ---------- 拾取（与最终画面同一投影） ----------
  R3.pickGroup = (comp, layers, t, ctx, space, target, idOf, camOv) => {
    const gl = GL.gl;
    const cam = camOv || E.cameraAt(comp, t, ctx);
    const items = R3.gather(comp, layers.slice(), t, ctx, {}, space, null, null, cam);
    const cm = R3.camMatrices(comp, cam, space);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.viewport(0, 0, target.w, target.h);
    gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); GL.blend(null);
    const pk = prog('pick');
    for (const it of items.meshes) { GL.use(pk, { uModel: GL.m4(it.W), uVP: GL.m4(cm.VP), uNM: { m3: M4.normal3(it.W) }, uId: idOf(it.layer) }); gl.bindVertexArray(GL.meshVAO(it.mesh)); gl.drawElements(gl.TRIANGLES, it.mesh.idx.length, gl.UNSIGNED_INT, 0); }
    gl.bindVertexArray(null);
    const pp = prog('pickpl');
    for (const it of items.planes) { GL.use(pp, { uModel: GL.m4(it.W), uVP: GL.m4(cm.VP), uNM: { m3: M4.normal3(it.W) }, uRect: it.rect, uTex: it.tex, uOp: it.op, uId: idOf(it.layer) }); GL.drawQuad(); }
    gl.disable(gl.DEPTH_TEST);
    releaseItems(items);
  };
})(typeof window !== 'undefined' ? window : globalThis);
