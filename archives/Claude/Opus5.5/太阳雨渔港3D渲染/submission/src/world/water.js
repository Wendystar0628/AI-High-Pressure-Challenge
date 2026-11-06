import * as THREE from 'three';
import { U, WL, setLayers, BASE_BOTTOM } from '../core/G.js';
import { UNIFORMS_GLSL, NOISE_GLSL, FUNCS_GLSL } from '../core/glsl.js';
import { LAY, seabedH } from './layout.js';

export const WAKE_N = 32;
export const wakeUniform = { value: Array.from({ length: WAKE_N }, () => new THREE.Vector4(0, 0, 999, 0)) };
export const foamSpots = { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, 0, 0)) };

const WATER_VERT = /* glsl */ `
varying vec3 vWP;
varying float vViewZ;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

export const WATER_FUNCS = /* glsl */ `
vec2 waveGrad(vec2 p, float t){
  vec2 g = vec2(0.0);
  g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6))*1.25 + t*1.05) * 0.045;
  g += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86))*2.0 + t*1.5) * 0.03;
  g += vec2(0.2, -0.98) * cos(dot(p, vec2(0.2, -0.98))*3.2 + t*1.9) * 0.018;
  float e = 0.2;
  vec2 q = p*0.9 + vec2(t*0.18, -t*0.12);
  float n0 = vnoise(q);
  g += vec2(vnoise(q + vec2(e, 0.0)) - n0, vnoise(q + vec2(0.0, e)) - n0) / e * 0.06;
  return g;
}
// rain ripple rings; returns ring intensity, accumulates gradient
float rainRings(vec2 p, float t, inout vec2 grad){
  float sum = 0.0;
  float cs = 0.85;
  vec2 cell = floor(p / cs);
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++){
    vec2 c = cell + vec2(float(i), float(j));
    vec2 h = hash22(c);
    float period = 1.3 + h.y*0.9;
    float tt = t/period + h.x;
    float k = floor(tt);
    float age = fract(tt);
    if (hash12(c + k*3.17) > 0.15 + uRain*0.75) continue;
    vec2 ctr = (c + 0.15 + 0.7*hash22(c + k*1.71)) * cs;
    float r = age * 0.42;
    vec2 dv = p - ctr;
    float d = length(dv);
    float w = 1.0 - smoothstep(0.0, 0.022, abs(d - r));
    float fade = (1.0 - age);
    sum += w * fade;
    grad += (dv / max(d, 1e-3)) * w * fade * 0.35;
  }
  return sum;
}
// boat wake: list of emitted wave sources
float wakeField(vec2 p, inout vec2 grad, out float foam){
  float h = 0.0; foam = 0.0;
  for (int i = 0; i < ${WAKE_N}; i++){
    vec4 w = uWake[i];
    if (w.z > 40.0) continue;
    float age = w.z;
    vec2 dv = p - w.xy;
    float d = length(dv);
    float front = age * 1.6;
    float x = d - front;
    float env = exp(-x*x*1.2) * exp(-age*0.09) * w.w;
    float ph = x*5.5;
    h += sin(ph) * env;
    grad += (dv/max(d,1e-3)) * cos(ph) * env * 0.5;
    // foam trail near the source while young
    foam += (1.0 - smoothstep(0.0, 0.7 + age*0.12, d)) * exp(-age*0.45) * w.w;
    // expanding ring crests: their envelope forms the V-shaped wake arms
    foam += (1.0 - smoothstep(0.0, 0.09 + age*0.012, abs(x))) * exp(-age*0.42) * w.w * 0.55 * step(0.4, age);
  }
  return h;
}
`;

export function buildWater(scene, pipeline, waterRefl) {
  const uniforms = {
    ...U,
    tRefl: waterRefl.tex,
    uReflMat: waterRefl.texMat,
    tDepth: { value: pipeline.normalRT.texture },
    uWake: wakeUniform,
    uFoamSpots: foamSpots,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: WATER_VERT,
    fragmentShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      uniform vec2 uResolution;
      uniform sampler2D tRefl;
      uniform mat4 uReflMat;
      uniform sampler2D tDepth;
      uniform vec4 uWake[${WAKE_N}];
      uniform vec4 uFoamSpots[12];
      varying vec3 vWP;
      varying float vViewZ;
      ${NOISE_GLSL}
      ${FUNCS_GLSL}
      ${WATER_FUNCS}
      void main(){
        vec3 wp = vWP;
        if (abs(wp.x) > 20.0 || abs(wp.z) > 20.0) discard;
        float t = uTime;
        vec2 p = wp.xz;
        vec3 V = normalize(cameraPosition - wp);
        vec2 g = waveGrad(p, t);
        float gs = gustAt(p);
        // gust cat's-paw ripples
        float gr = 0.0;
        if (gs > 0.01) {
          vec2 q = p*5.0 + vec2(t*1.4, -t*1.1);
          float e = 0.12;
          float n0 = vnoise(q);
          vec2 ng = vec2(vnoise(q + vec2(e,0.0)) - n0, vnoise(q + vec2(0.0,e)) - n0)/e;
          g += ng * 0.05 * gs;
          gr = smoothstep(0.55, 0.62, vnoise(p*vec2(2.2, 7.0) + vec2(t*0.9, 0.0))) * gs;
        }
        float rings = rainRings(p, t, g);
        float wfoam;
        float wk = wakeField(p, g, wfoam);
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        // depth / thickness of water in front of the opaque scene
        vec2 suv = gl_FragCoord.xy / uResolution;
        float sceneZ = texture2D(tDepth, suv).b;
        float thick = sceneZ < 0.001 ? 100.0 : max(sceneZ - vViewZ, 0.0);
        // base water colour (sea-glass)
        float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.5);
        vec3 base = mix(vec3(0.33, 0.72, 0.71), vec3(0.6, 0.86, 0.86), fres);
        base = mix(base, vec3(0.5, 0.86, 0.8), (1.0 - smoothstep(0.0, 2.5, thick))*0.35);
        // sun / cloud / shadow
        float cl = cloudAt(p) * uSunVis;
        float sh = shadowAt(vec3(wp.x, uWL, wp.z), vec3(0.0,1.0,0.0), uSunDir.y);
        float light = sh * cl;
        base *= mix(vec3(0.7, 0.84, 0.88), vec3(1.0), light);
        // gust darkening
        base = mix(base, base*vec3(0.82, 0.9, 0.95), gs*0.6);
        // posterized broken reflection
        vec2 vd = normalize(wp.xz - cameraPosition.xz + 1e-4);
        float along = dot(p, vd);
        float across = dot(p, vec2(-vd.y, vd.x));
        float camD = length(cameraPosition - wp);
        float bscale = clamp(camD / 26.0, 1.0, 3.2);
        float bandF = along*2.4/bscale + (vnoise(vec2(across*0.3/bscale, t*0.1)) - 0.5)*1.6 + wk*0.6;
        float band = floor(bandF);
        float bandOff = vnoise(vec2(band*0.71, t*0.28)) - 0.5;
        float breakM = step(0.24, vnoise(vec2(band*1.37 + 5.0, across*0.8/bscale + t*0.3 + band*0.5)));
        vec4 rc = uReflMat * vec4(wp.x, uWL, wp.z, 1.0);
        vec2 ruv = rc.xy / rc.w;
        ruv.x += bandOff*0.012 + g.x*0.008/bscale;
        ruv.y += g.y*0.008/bscale;
        vec4 refl = texture2D(tRefl, ruv);
        float rl = dot(refl.rgb, vec3(0.3, 0.55, 0.15));
        vec3 cWhite = vec3(0.92, 0.98, 0.97);
        vec3 cTeal = vec3(0.24, 0.6, 0.6);
        vec3 cDeep = vec3(0.1, 0.3, 0.42);
        vec3 rcol = rl > 0.8 ? cWhite : (rl > 0.52 ? cTeal : cDeep);
        float cov = smoothstep(0.35, 0.65, refl.a) * breakM;
        // alpha: transparent looking down, more opaque at grazing angles
        float alpha = mix(0.42, 0.88, fres);
        alpha = mix(alpha*0.4, alpha, smoothstep(0.0, 1.8, thick));
        vec3 col = base;
        col = mix(col, rcol, cov*0.88);
        alpha = mix(alpha, 0.94, cov*0.9);
        // sky sheen strokes (anime-style horizontal highlights)
        float streak = smoothstep(0.62, 0.66, vnoise(vec2(across*0.25, along*3.0 + t*0.2))) * (1.0 - cov) * 0.25;
        col = mix(col, vec3(0.86, 0.96, 0.95), streak*fres*2.0);
        // gust ripple dashes
        col = mix(col, vec3(0.8, 0.94, 0.94), gr*0.55);
        // rain rings
        col = mix(col, vec3(0.88, 0.98, 0.96), clamp(rings, 0.0, 1.0)*0.5);
        alpha = max(alpha, clamp(rings, 0.0, 1.0)*0.6);
        // shoreline foam (toon)
        float fn = vnoise(p*2.6 + t*0.35)*0.22 + vnoise(p*7.0 - t*0.5)*0.08;
        float pulse = 0.55 + 0.45*sin(t*1.1 + p.x*0.6 + p.y*0.45);
        float foamW = 0.1 + 0.12*pulse;
        float foam = 1.0 - smoothstep(foamW + fn - 0.02, foamW + fn, thick);
        // extra foam spots (splashes / tetrapods)
        float spots = 0.0;
        for (int i = 0; i < 12; i++){
          vec4 s = uFoamSpots[i];
          if (s.w <= 0.0) continue;
          float d = length(p - s.xy);
          spots = max(spots, (1.0 - smoothstep(s.z*0.6, s.z, d + (vnoise(p*4.0 + float(i))-0.5)*0.4)) * s.w);
        }
        float wakeFoam = smoothstep(0.35, 0.45, wfoam + (vnoise(p*3.5 + t*0.6)-0.5)*0.35);
        float F = max(max(foam, step(0.5, spots)), wakeFoam);
        col = mix(col, vec3(0.96, 1.0, 0.99), F*0.92);
        alpha = max(alpha, F*0.95);
        // sparkles
        float sgrid = 4.5 / bscale;
        vec2 sc = floor(p*sgrid);
        vec2 sf = fract(p*sgrid) - 0.5;
        float h = hash12(sc);
        float tw = sin(t*(1.5 + h*2.5) + h*50.0);
        vec3 R = reflect(-V, N);
        float lobe = smoothstep(-0.3, 0.7, dot(R, uSunDir));
        float on = smoothstep(0.9 - gs*0.08, 0.97, tw);
        float sz = 0.05 + 0.07*on;
        vec2 af = abs(sf);
        float core = 1.0 - smoothstep(sz*0.45, sz*0.75, length(sf));
        float star = (1.0 - smoothstep(0.0, 0.025, min(af.x, af.y))) * (1.0 - smoothstep(sz*0.5, sz*2.4, max(af.x, af.y)));
        float spark = max(core, star*0.8) * on * lobe * light * (1.0 - F) * step(0.4, hash12(sc + 3.3));
        col += vec3(1.0, 0.9, 0.65) * spark * 1.8;
        alpha = max(alpha, spark);
        // shadowed water is deeper teal
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const geo = new THREE.PlaneGeometry(40, 40, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const surface = new THREE.Mesh(geo, mat);
  surface.position.y = WL;
  surface.renderOrder = 2;
  setLayers(surface, { main: true, shadow: false, outline: false, refl: false });
  scene.add(surface);

  // --- water section panels (translucent cross-section walls) --------------
  const panelMat = new THREE.ShaderMaterial({
    uniforms: { ...U },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vWP; varying vec3 vN;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      ${NOISE_GLSL}
      ${FUNCS_GLSL}
      varying vec3 vWP; varying vec3 vN;
      void main(){
        float t = uTime;
        float along = abs(vN.x) > 0.5 ? vWP.z : vWP.x;
        float surfY = uWL + sin(along*1.1 + t*1.2)*0.03 + sin(along*2.7 - t*1.7)*0.015;
        float depth = surfY - vWP.y;
        if (depth < 0.0) discard;
        float k = smoothstep(0.0, 4.6, depth);
        vec3 c = mix(vec3(0.55, 0.88, 0.84), vec3(0.16, 0.46, 0.55), k);
        float a = mix(0.12, 0.42, k);
        // light rays in the section
        float rays = smoothstep(0.58, 0.8, vnoise(vec2(along*0.45 + vWP.y*0.32 + t*0.04, 1.0)));
        c += vec3(0.25, 0.3, 0.22) * rays * (1.0 - k);
        a += rays*0.05*(1.0 - k);
        // meniscus line + sub-surface band (posterized)
        float top = 1.0 - smoothstep(0.035, 0.06, depth);
        float band = (1.0 - smoothstep(0.0, 0.02, abs(depth - 0.2 - sin(along*0.9 + t*0.8)*0.04))) * 0.6;
        c = mix(c, vec3(0.94, 1.0, 0.98), max(top, band*0.5));
        a = max(a, max(top*0.9, band*0.25));
        // suspended specks
        vec2 sp = vec2(along, vWP.y)*3.0 + vec2(t*0.05, sin(t*0.3 + along)*0.1);
        float spk = step(0.985, hash12(floor(sp))) * (1.0 - smoothstep(0.1, 0.25, length(fract(sp)-0.5)));
        c += spk*0.25; a += spk*0.1;
        // cloud shadow dims the section slightly
        c *= mix(0.85, 1.0, cloudAt(vWP.xz) * uSunVis);
        gl_FragColor = vec4(c, a);
      }`,
  });
  const panels = new THREE.Group();
  const mkPanel = (axis, at, from, to, facing) => {
    const n = Math.ceil((to - from) / 0.5);
    const pos = [], nor = [];
    const top = WL + 0.06;
    for (let i = 0; i < n; i++) {
      const a = from + (i / n) * (to - from), c = from + ((i + 1) / n) * (to - from);
      const ha = (axis === 'z' ? seabedH(at, a) : seabedH(a, at)) - 0.05;
      const hc = (axis === 'z' ? seabedH(at, c) : seabedH(c, at)) - 0.05;
      const off = at + facing * 0.015;
      const P = (u, y) => (axis === 'z' ? [off, y, u] : [u, y, off]);
      let q = [P(a, ha), P(c, hc), P(c, top), P(a, ha), P(c, top), P(a, top)];
      for (const v of q) pos.push(...v);
      for (let k = 0; k < 6; k++) nor.push(axis === 'z' ? facing : 0, 0, axis === 'z' ? 0 : facing);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const m = new THREE.Mesh(g, panelMat);
    m.renderOrder = 3;
    panels.add(m);
  };
  mkPanel('z', 20, -20, LAY.frontZ, 1);
  mkPanel('x', -20, -7.2, 20, -1);
  setLayers(panels, { main: true, shadow: false, outline: false, refl: false });
  scene.add(panels);

  return { surface, panels, mat };
}
