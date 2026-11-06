import * as THREE from 'three';
import { U, setLayers } from './G.js';
import { UNIFORMS_GLSL, NOISE_GLSL, FUNCS_GLSL } from './glsl.js';
import { makeToon } from './materials.js';

const SIMPLE_VERT = /* glsl */ `
varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
void main(){
  vec4 wp = vec4(position, 1.0);
  vec3 nrm = normal;
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp; nrm = mat3(instanceMatrix) * nrm;
  #endif
  wp = modelMatrix * wp;
  vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * nrm); vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const SP = {};
const texMatCache = new Map();

export function texMat(tex, opts = {}) {
  const key = tex.uuid + JSON.stringify(opts);
  if (!texMatCache.has(key)) texMatCache.set(key, makeToon({ map: tex, ...opts }));
  return texMatCache.get(key);
}

export function initSpecial() {
  SP.glass = new THREE.ShaderMaterial({
    uniforms: { ...U, uTint: { value: new THREE.Color(0.78, 0.93, 0.95) }, uBase: { value: 0.07 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: SIMPLE_VERT,
    fragmentShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      ${NOISE_GLSL}
      uniform vec3 uTint; uniform float uBase;
      varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
      void main(){
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        vec3 V = normalize(cameraPosition - vWP);
        float fr = pow(1.0 - abs(dot(N, V)), 3.0);
        vec3 c = mix(uTint, uSkyCol*1.1, fr);
        float a = uBase + fr*0.45;
        float along = abs(N.x) > abs(N.z) ? vWP.z : vWP.x;
        float s = fract((along*0.9 + vWP.y*1.1)*0.55);
        float streak = (step(0.86, s)*step(s, 0.9) + step(0.93, s)*step(s, 0.945)) * smoothstep(0.2, 0.6, vnoise(vec2(along, vWP.y)*0.7));
        c = mix(c, vec3(1.0), streak*0.85); a += streak*0.2;
        // raindrops on glass
        vec2 q = vec2(along, vWP.y) * vec2(22.0, 16.0);
        vec2 cid = floor(q);
        vec2 jit = hash22(cid) - 0.5;
        vec2 f = fract(q) - 0.5 - jit*0.5;
        float h = hash12(cid + 3.7);
        float rad = 0.08 + 0.1*hash12(cid + 9.1);
        float drop = step(0.93, h) * (1.0 - smoothstep(rad*0.7, rad, length(f*vec2(1.0, 0.75))));
        c = mix(c, vec3(1.0, 0.98, 0.92), drop*0.6); a += drop*0.18;
        gl_FragColor = vec4(c, clamp(a, 0.0, 0.8));
      }`,
  });

  SP.screen = (kind) => new THREE.ShaderMaterial({
    uniforms: { ...U, uKind: { value: kind } },
    vertexShader: SIMPLE_VERT,
    fragmentShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      ${NOISE_GLSL}
      uniform float uKind;
      varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
      void main(){
        if (uPass > 1.5 && uPass < 2.5) { gl_FragColor = vec4(1.0); return; }
        if (uPass > 0.5 && uPass < 1.5) { gl_FragColor = vec4(0.5, 0.5, -(viewMatrix*vec4(vWP,1.0)).z, 0.3); return; }
        vec2 uv = vUv;
        vec3 c;
        if (uKind < 0.5) {
          // radar
          vec2 p = uv*2.0 - 1.0;
          float r = length(p);
          float a = atan(p.y, p.x);
          float sweep = mod(a - uTime*1.6, 6.2832) / 6.2832;
          c = vec3(0.04, 0.16, 0.1);
          c += vec3(0.1, 0.9, 0.45) * pow(1.0 - sweep, 6.0) * 0.6 * step(r, 1.0);
          float rings = step(abs(fract(r*3.0) - 0.5), 0.03) * step(r, 1.0);
          c += vec3(0.2, 0.7, 0.4) * rings * 0.5;
          float blip = step(0.985, vnoise(p*7.0 + 3.0)) * step(r, 0.95);
          c += vec3(0.6, 1.0, 0.6) * blip * (0.3 + pow(1.0 - sweep, 3.0));
          c *= step(r, 1.0) * 0.9 + 0.1;
        } else {
          // fish finder echogram (scrolling)
          float x = uv.x + uTime*0.03;
          float bed = 0.25 + 0.08*sin(x*9.0) + 0.04*sin(x*23.0);
          c = vec3(0.05, 0.12, 0.38);
          float d = uv.y - bed;
          c = mix(c, vec3(0.95, 0.25, 0.15), step(d, 0.0) * step(-0.05, d));
          c = mix(c, vec3(0.95, 0.85, 0.2), step(d, -0.05) * step(-0.09, d));
          c = mix(c, vec3(0.3, 0.5, 0.9), step(d, -0.09));
          float fish = step(0.8, vnoise(vec2(x*30.0, uv.y*12.0))) * step(0.45, uv.y) * step(uv.y, 0.8);
          c = mix(c, vec3(0.95, 0.6, 0.2), fish);
          c += vec3(0.1, 0.3, 0.6) * step(0.97, uv.y);
        }
        gl_FragColor = vec4(c*1.25, 1.0);
      }`,
  });

  SP.glow = (col, strength = 1.6) => new THREE.ShaderMaterial({
    uniforms: { ...U, uCol: { value: new THREE.Color(col) }, uStr: { value: strength } },
    vertexShader: SIMPLE_VERT,
    fragmentShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      uniform vec3 uCol; uniform float uStr;
      varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
      void main(){
        if (uPass > 1.5 && uPass < 2.5) { gl_FragColor = vec4(1.0); return; }
        if (uPass > 0.5 && uPass < 1.5) { gl_FragColor = vec4(0.5, 0.5, -(viewMatrix*vec4(vWP,1.0)).z, 0.3); return; }
        gl_FragColor = vec4(uCol*uStr, 1.0);
      }`,
  });

  // sparkling droplet material (instanced)
  SP.drop = new THREE.ShaderMaterial({
    uniforms: { ...U },
    vertexShader: SIMPLE_VERT,
    fragmentShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      ${NOISE_GLSL}
      ${FUNCS_GLSL}
      varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWP);
        vec3 H = normalize(uSunDir + V);
        float sp = pow(max(dot(N, H), 0.0), 30.0);
        float cl = cloudAt(vWP.xz) * uSunVis;
        vec3 c = mix(vec3(0.72, 0.9, 0.92), vec3(0.95, 1.0, 1.0), smoothstep(0.0, 0.6, N.y));
        c += vec3(1.0, 0.86, 0.55) * step(0.35, sp) * 1.4 * cl;
        float fr = pow(1.0 - max(dot(N, V), 0.0), 2.0);
        c = mix(c, vec3(1.0), fr*0.5);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

  // god-ray / light-shaft material (additive)
  SP.beam = (strength = 1, warm = new THREE.Color(1.0, 0.86, 0.55)) => new THREE.ShaderMaterial({
    uniforms: { ...U, uStr: { value: strength }, uWarm: { value: warm }, uOrigin: { value: new THREE.Vector3() } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: SIMPLE_VERT,
    fragmentShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      ${NOISE_GLSL}
      ${FUNCS_GLSL}
      uniform float uStr; uniform vec3 uWarm; uniform vec3 uOrigin;
      varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWP);
        float face = pow(abs(dot(N, V)), 1.4);
        float along = vUv.y;
        float fadeL = smoothstep(0.0, 0.25, along) * smoothstep(1.0, 0.55, along);
        float across = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
        float n = 0.75 + 0.25*vnoise(vec2(vUv.x*6.0 + uTime*0.15, along*2.0 - uTime*0.05));
        float cl = cloudAt(uOrigin.xz) * uSunVis;
        // dust motes
        vec2 q = vec2(vUv.x*20.0, along*30.0 + uTime*0.3);
        float mote = step(0.97, hash12(floor(q))) * (1.0 - smoothstep(0.1, 0.3, length(fract(q) - 0.5)));
        float a = face * fadeL * across * n * uStr * cl;
        vec3 c = uWarm * a * 0.32 + vec3(1.0, 0.95, 0.8) * mote * fadeL * across * cl * uStr * 0.5;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

/** Make a box-shaped light shaft from a window along the sun direction. */
export function makeShaft(origin, size, length, dir, strength = 1) {
  // box with uv.y along the shaft; we build a prism manually
  const g = new THREE.BoxGeometry(size[0], length, size[1], 1, 1, 1);
  g.translate(0, -length / 2, 0);
  // map uv: y along length
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const y = -pos.getY(i) / length;
    const xs = pos.getX(i) / size[0] + 0.5;
    const zs = pos.getZ(i) / size[1] + 0.5;
    uv.setXY(i, Math.abs(pos.getX(i)) > size[0] * 0.49 ? zs : xs, y);
  }
  const mat = SP.beam(strength);
  mat.uniforms.uOrigin.value.copy(origin);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(origin);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  m.quaternion.copy(q);
  m.renderOrder = 5;
  setLayers(m, { main: true, shadow: false, outline: false, refl: false });
  return m;
}
