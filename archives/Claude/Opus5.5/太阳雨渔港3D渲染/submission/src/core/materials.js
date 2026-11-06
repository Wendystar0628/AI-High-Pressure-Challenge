import * as THREE from 'three';
import { U } from './G.js';
import { UNIFORMS_GLSL, NOISE_GLSL, FUNCS_GLSL, SHADE_GLSL, VERT_COMMON } from './glsl.js';

export const SWAY = {
  none: '',
  leaf: /* glsl */ `
    {
      float w = windAt(wp.xz);
      float sw = aux.x; float ph = aux.y;
      vec2 dir = vec2(-0.72, 0.69);
      float osc = sin(uTime*1.6 + ph)*0.5 + sin(uTime*2.7 + ph*1.7)*0.3;
      wp.xz += dir * sw * (w*0.75 + osc*(0.05 + w*0.35));
      wp.y -= sw * w * 0.12;
    }`,
  weed: /* glsl */ `
    {
      float sw = aux.x; float ph = aux.y;
      wp.x += sin(uTime*0.8 + ph + wp.y*1.4) * 0.13 * sw;
      wp.z += cos(uTime*0.63 + ph*1.3 + wp.y*1.1) * 0.11 * sw;
    }`,
  net: /* glsl */ `
    {
      float w = windAt(wp.xz);
      float sw = aux.x; float ph = aux.y;
      vec2 dir = vec2(-0.72, 0.69);
      wp.xz += dir * sw * (w*0.5 + sin(uTime*1.25 + ph + wp.y*1.5)*(0.03 + w*0.12));
      wp.y += sw * sin(uTime*1.7 + ph*2.0 + wp.x)*0.02;
    }`,
  flag: /* glsl */ `
    {
      float w = windAt(wp.xz);
      float d = aux.x; float ph = aux.y;
      float amp = 0.05 + w*0.18;
      float wave = sin(uTime*(4.0 + w*6.0) - d*7.0 + ph);
      wp.xyz += wn * wave * amp * d;
    }`,
};

let matCount = 0;

/**
 * Vertex-coloured cel-shaded material shared by most of the scene.
 */
export function makeToon({
  side = THREE.FrontSide,
  sway = 'none',
  map = null,
  alphaTest = 0,
  transparent = false,
  opacity = 1,
  defines = {},
  extraFrag = '',
} = {}) {
  const uniforms = { ...U, map: { value: map }, uOpacity: { value: opacity } };
  const d = { ...defines };
  if (map) d.USE_MAP2 = '';
  if (alphaTest > 0) d.ALPHA_TEST = alphaTest.toFixed(3);
  const vertexShader = /* glsl */ `
    ${UNIFORMS_GLSL}
    ${NOISE_GLSL}
    ${FUNCS_GLSL}
    ${VERT_COMMON}
    attribute vec2 aux;
    void main(){
      vec3 pos = position;
      vec3 nrm = normal;
      vec4 wp = vec4(pos, 1.0);
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
        nrm = mat3(instanceMatrix) * nrm;
      #endif
      wp = modelMatrix * wp;
      vec3 wn = normalize(mat3(modelMatrix) * nrm);
      ${SWAY[sway]}
      vWP = wp.xyz;
      vN = wn;
      vCol = acol;
      #ifdef USE_INSTANCING_COLOR
        vCol *= instanceColor;
      #endif
      vSurf = surf;
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const fragmentShader = /* glsl */ `
    ${UNIFORMS_GLSL}
    ${NOISE_GLSL}
    ${FUNCS_GLSL}
    ${SHADE_GLSL}
    varying vec3 vWP;
    varying vec3 vN;
    varying vec3 vCol;
    varying vec4 vSurf;
    varying vec2 vUv;
    uniform sampler2D map;
    uniform float uOpacity;
    void main(){
      if (vWP.y < uClipY) discard;
      vec3 N = normalize(vN);
      if (!gl_FrontFacing) N = -N;
      vec3 base = vCol;
      float alpha = uOpacity;
      #ifdef USE_MAP2
        vec4 tx = texture2D(map, vUv);
        base *= tx.rgb;
        alpha *= tx.a;
      #endif
      #ifdef ALPHA_TEST
        if (alpha < ALPHA_TEST) discard;
      #endif
      ${extraFrag}
      if (uPass > 1.5 && uPass < 2.5) { gl_FragColor = vec4(1.0); return; }
      if (uPass > 0.5 && uPass < 1.5) {
        float lw = vSurf.w;
        if (vWP.y < uWL) lw *= 0.3;
        vec3 vn = normalize((viewMatrix * vec4(N, 0.0)).xyz);
        float vz = -(viewMatrix * vec4(vWP, 1.0)).z;
        gl_FragColor = vec4(vn.xy*0.5 + 0.5, vz, lw);
        return;
      }
      float lw;
      vec3 c = toonShade(base, N, vWP, vSurf, vUv, lw);
      c = underwaterTint(c, vWP, cameraPosition);
      c = applyFog(c, vWP, cameraPosition);
      gl_FragColor = vec4(c, alpha);
    }`;
  const m = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side,
    transparent,
    defines: d,
  });
  m.name = 'toon' + matCount++;
  return m;
}

// --- shared default materials ------------------------------------------------
export const MAT = {};
export function initMaterials() {
  MAT.toon = makeToon();
  MAT.toonDS = makeToon({ side: THREE.DoubleSide });
  MAT.leaf = makeToon({ sway: 'leaf' });
  MAT.weed = makeToon({ sway: 'weed', side: THREE.DoubleSide });
  MAT.net = makeToon({ sway: 'net', side: THREE.DoubleSide, alphaTest: 0.5, defines: { NET: '' }, extraFrag: /* glsl */`
    #ifdef NET
    { vec2 g = abs(fract(vUv*vec2(26.0, 26.0)) - 0.5); if (min(g.x, g.y) > 0.13) discard; }
    #endif
  ` });
  MAT.flag = makeToon({ sway: 'flag', side: THREE.DoubleSide });
}

/** Textured toon material (signs, posters, screens). */
export function makeTexToon(tex, { side = THREE.FrontSide, alphaTest = 0 } = {}) {
  return makeToon({ map: tex, side, alphaTest });
}
