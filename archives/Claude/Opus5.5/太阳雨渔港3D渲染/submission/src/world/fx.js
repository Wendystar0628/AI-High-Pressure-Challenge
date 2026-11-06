import * as THREE from 'three';
import { U, WL, setLayers, rand, rr } from '../core/G.js';
import { UNIFORMS_GLSL, NOISE_GLSL, FUNCS_GLSL } from '../core/glsl.js';
import { SP, makeShaft } from '../core/special.js';
import { LAY } from './layout.js';

// GLSL version of the ground height (rain stops on roofs / quay / water / hill)
const GROUND_GLSL = /* glsl */ `
float hillHG(vec2 p){
  float u = clamp((p.x + 20.0)/12.8, 0.0, 1.0);
  float v = clamp((p.y + 20.0)/10.0, 0.0, 1.0);
  float h = 6.6*(1.0 - pow(u, 1.8))*(1.0 - v*v) + (1.0-u)*(1.0-v);
  return max(1.0, h + 0.9);
}
bool inRect(vec2 p, vec4 r){ return p.x > r.x && p.x < r.y && p.y > r.z && p.y < r.w; }
float groundG(vec2 p){
  if (abs(p.x) > 20.0 || abs(p.y) > 20.0) return 99.0;
  if (inRect(p, vec4(-20.1, -10.9, -9.9, 0.1))) return 5.0;    // warehouse roof
  if (inRect(p, vec4(-20.0, -13.4, 7.8, 13.2))) return 3.6;    // waiting room roof
  if (p.x < -7.2 && p.y < -10.0) return hillHG(p) + 0.2;
  if (p.y > 6.0) return 0.0;
  if (p.x < -8.0) return 0.0;
  if (p.y > -11.8 && p.y < -9.4 && p.x < 6.2) return 0.4;
  return uWL;
}
`;

export function buildRain(scene, camera) {
  const COUNT = 22000;
  const base = new THREE.PlaneGeometry(1, 1);
  base.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  g.setAttribute('uv', base.attributes.uv);
  const seed = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random(); }
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  g.instanceCount = COUNT;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uPixK: { value: 0.001 } },
    transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      ${NOISE_GLSL}
      ${FUNCS_GLSL}
      ${GROUND_GLSL}
      uniform float uPixK;
      attribute vec4 aSeed;
      varying float vA; varying vec2 vUv; varying float vGlint; varying float vLit;
      void main(){
        vec2 xz = (aSeed.xy - 0.5) * 46.0;
        float top = 19.0;
        float wind = windAt(xz);
        vec2 wdir = vec2(-0.72, 0.69);
        float slant = 0.12 + wind*0.55;
        // fall
        float speed = 10.5 + aSeed.w*2.0;
        float period = 26.0 / speed;
        float ph = fract(uTime/period + aSeed.z);
        float y = top - ph*26.0;
        vec2 pxz = xz + wdir * slant * (top - y);
        float gnd = groundG(pxz);
        float vis = step(aSeed.w, uRain) * step(gnd, y);
        vec3 p = vec3(pxz.x, y, pxz.y);
        vec3 vel = normalize(vec3(wdir.x*slant, -1.0, wdir.y*slant));
        vec3 toCam = normalize(cameraPosition - p);
        vec3 side = normalize(cross(vel, toCam));
        float dist = length(cameraPosition - p);
        float w = max(0.012, dist*uPixK*0.9);
        float len = 0.5 + aSeed.x*0.3;
        vec3 pos = p + side*(position.x*w) - vel*(position.y*len);
        vA = vis * (0.32 + 0.25*aSeed.y) * smoothstep(1.5, 4.0, dist) * (1.0 - smoothstep(60.0, 110.0, dist));
        vUv = uv;
        float lit = cloudAt(p.xz) * uSunVis;
        // inside sky light beams -> sparkle
        float beam = 0.0;
        for (int i = 0; i < 3; i++){
          vec4 b = uBeams[i];
          if (b.w <= 0.0) continue;
          vec3 g0 = vec3(b.x, 0.0, b.y);
          vec3 d = p - g0;
          float dd = length(d - uSunDir*dot(d, uSunDir));
          beam = max(beam, (1.0 - smoothstep(b.z*0.6, b.z, dd)) * b.w);
        }
        vLit = lit;
        float tw = sin(uTime*(3.0 + aSeed.x*4.0) + aSeed.y*60.0);
        vGlint = (step(0.82, tw)*0.6 + beam*1.4) * lit;
        gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA; varying vec2 vUv; varying float vGlint; varying float vLit;
      void main(){
        if (vA <= 0.001) discard;
        float across = 1.0 - abs(vUv.x - 0.5)*2.0;
        float along = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        // cool grey-blue body (reads on bright ground) with a bright core; warm golden glints in the sun
        vec3 body = mix(vec3(0.62, 0.74, 0.82), vec3(0.78, 0.84, 0.86), vLit);
        vec3 core = mix(vec3(0.92, 0.97, 1.0), vec3(1.08, 1.0, 0.86), vLit);
        vec3 c = mix(body, core, smoothstep(0.5, 0.9, across));
        c = mix(c, vec3(1.35, 1.1, 0.68), clamp(vGlint, 0.0, 1.0));
        float a = vA * along * (0.55 + 0.45*across) * (1.15 + vGlint*0.9);
        gl_FragColor = vec4(c, clamp(a, 0.0, 0.9));
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  setLayers(mesh, { main: true, shadow: false, outline: false, refl: false });
  scene.add(mesh);

  // ground splashes (tiny crowns on the quay)
  const SC = 1600;
  const sg = new THREE.InstancedBufferGeometry();
  sg.index = base.index;
  sg.setAttribute('position', base.attributes.position);
  sg.setAttribute('uv', base.attributes.uv);
  const ss = new Float32Array(SC * 4);
  for (let i = 0; i < SC; i++) { ss[i * 4] = Math.random(); ss[i * 4 + 1] = Math.random(); ss[i * 4 + 2] = Math.random(); ss[i * 4 + 3] = Math.random(); }
  sg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(ss, 4));
  sg.instanceCount = SC;
  const smat = new THREE.ShaderMaterial({
    uniforms: { ...U },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      ${GROUND_GLSL}
      attribute vec4 aSeed;
      varying vec2 vUv; varying float vA; varying float vAge;
      void main(){
        vec2 xz = (aSeed.xy - 0.5) * 40.0;
        float g = groundG(xz);
        float period = 0.9 + aSeed.z*1.2;
        float tt = uTime/period + aSeed.w*10.0;
        float age = fract(tt);
        float k = floor(tt);
        float on = step(fract(sin(k*12.9898 + aSeed.x*78.233)*43758.5453), uRain*0.9) * step(uWL + 0.2, g);
        vec3 p = vec3(xz.x, g + 0.005, xz.y);
        vec3 toCam = normalize(cameraPosition - p);
        vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
        float s = 0.05 + age*0.1;
        vec3 pos = p + right*(position.x*s) + vec3(0.0, 1.0, 0.0)*(position.y*s*0.9);
        vUv = uv; vA = on * (1.0 - age); vAge = age;
        gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying float vA; varying float vAge;
      void main(){
        if (vA <= 0.01) discard;
        vec2 q = vUv - vec2(0.5, 0.0);
        float r = length(q*vec2(1.0, 1.6));
        float crown = smoothstep(0.5, 0.4, r) * smoothstep(0.2 + vAge*0.2, 0.35 + vAge*0.15, r);
        if (crown < 0.3) discard;
        gl_FragColor = vec4(0.97, 1.0, 1.0, vA*0.7);
      }`,
  });
  const smesh = new THREE.Mesh(sg, smat);
  smesh.frustumCulled = false;
  smesh.renderOrder = 7;
  setLayers(smesh, { main: true, shadow: false, outline: false, refl: false });
  scene.add(smesh);

  return {
    mesh, mat,
    update() {
      const H = U.uResolution.value.y || 900;
      mat.uniforms.uPixK.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / H;
    },
  };
}

/** Drips: drops forming at edges, falling, ripple rings on impact */
export function buildDrips(scene, emitters) {
  const N = emitters.length;
  const drop = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), SP.drop, N);
  drop.frustumCulled = false;
  setLayers(drop, { main: true, shadow: false, outline: false, refl: false });
  scene.add(drop);
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { ...U },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv; attribute float aLife; varying float vLife;
      void main(){ vUv = uv; vLife = 1.0;
        vec4 wp = vec4(position,1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main(){
        float r = length(vUv - 0.5)*2.0;
        float ring = smoothstep(0.78, 0.86, r) * smoothstep(1.0, 0.92, r);
        if (ring < 0.05) discard;
        gl_FragColor = vec4(0.95, 1.0, 1.0, ring*0.75);
      }`,
  });
  const rings = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), ringMat, N);
  rings.frustumCulled = false;
  rings.renderOrder = 6;
  setLayers(rings, { main: true, shadow: false, outline: false, refl: false });
  scene.add(rings);
  const st = emitters.map((e) => ({ ...e, phase: Math.random(), y: 0, fallT: 0 }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  return {
    update(now) {
      for (let i = 0; i < N; i++) {
        const e = st[i];
        const src = e.getPos ? e.getPos() : e.pos;
        const per = e.period * (1.4 - U.uRain.value * 0.6);
        const tt = now / per + e.phase;
        const f = tt - Math.floor(tt);
        const grow = 0.7;
        const fallDist = Math.max(0.05, src.y - e.ground);
        const fallTime = Math.sqrt((2 * fallDist) / 9.8);
        const tf = (f - grow) * per;
        if (f < grow) {
          const r = 0.006 + 0.016 * (f / grow);
          p.copy(src); p.y -= r * 0.8;
          s.set(r, r * 1.25, r);
          m.compose(p, q, s);
          drop.setMatrixAt(i, m);
          // ring from previous impact
          const age = (f + 1 - grow) * per - fallTime;
          const ra = age < 1.2 && age > 0 ? age : -1;
          if (ra > 0) { p.set(src.x, e.ground + 0.012, src.z); const rs = 0.05 + ra * 0.35; s.set(rs, 1, rs); m.compose(p, q, s); }
          else { s.set(0, 0, 0); m.compose(p, q, s); }
          rings.setMatrixAt(i, m);
        } else if (tf < fallTime) {
          p.copy(src); p.y -= 0.5 * 9.8 * tf * tf;
          s.set(0.02, 0.035, 0.02);
          m.compose(p, q, s);
          drop.setMatrixAt(i, m);
          s.set(0, 0, 0); m.compose(p, q, s); rings.setMatrixAt(i, m);
        } else {
          s.set(0, 0, 0); m.compose(p, q, s); drop.setMatrixAt(i, m);
          const age = tf - fallTime;
          p.set(src.x, e.ground + 0.012, src.z);
          const rs = 0.05 + age * 0.35;
          s.set(rs, 1, rs); m.compose(p, q, s);
          rings.setMatrixAt(i, m);
        }
      }
      drop.instanceMatrix.needsUpdate = true;
      rings.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Sky light beams through cloud gaps */
export function buildSkyBeams(scene) {
  const sd = U.uSunDir.value.clone();
  const defs = [
    { g: new THREE.Vector3(3.5, 0, 12.5), r: 1.6 },
    { g: new THREE.Vector3(-4.0, WL, -3.0), r: 2.2 },
    { g: new THREE.Vector3(12.0, WL, -8.0), r: 1.3 },
  ];
  const beams = defs.map((d, i) => {
    const len = 42;
    const origin = d.g.clone().add(sd.clone().multiplyScalar(len));
    const m = makeShaft(origin, [d.r * 2, d.r * 2], len + 2, sd.clone().negate(), 0.0);
    m.material.uniforms.uOrigin.value.copy(d.g);
    scene.add(m);
    return { mesh: m, def: d, phase: i * 2.1 };
  });
  return {
    beams,
    update(now) {
      beams.forEach((b, i) => {
        const k = 0.5 + 0.5 * Math.sin(now * 0.05 + b.phase);
        const str = 0.35 + 0.65 * k * k;
        b.mesh.material.uniforms.uStr.value = str;
        U.uBeams.value[i].set(b.def.g.x, b.def.g.z, b.def.r, str * 1.4);
      });
    },
  };
}

export function buildLighthouseGlow(scene, pos) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * 6.5; mv.z += 1.0; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uLighthouse; uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 q = vUv - 0.5; float r = length(q)*2.0;
        float core = smoothstep(0.12, 0.0, r);
        float halo = pow(smoothstep(1.0, 0.0, r), 2.0) * 0.45;
        float ring = smoothstep(0.04, 0.0, abs(r - 0.32)) * 0.15;
        float a = atan(q.y, q.x) + uTime*0.15;
        float spikes = pow(abs(cos(a*2.0)), 30.0) * smoothstep(1.0, 0.05, r) * 0.7;
        vec3 c = vec3(1.0, 0.86, 0.55) * (core*2.0 + halo + spikes + ring);
        gl_FragColor = vec4(c * uLighthouse, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.position.copy(pos);
  m.renderOrder = 9;
  m.frustumCulled = false;
  setLayers(m, { main: true, shadow: false, outline: false, refl: false });
  scene.add(m);
  // lamp core
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), SP.glow(0xffe2a0, 1.0));
  lamp.position.copy(pos);
  setLayers(lamp, { main: true, shadow: false, outline: false, refl: true });
  scene.add(lamp);
  return {
    update() {
      const k = U.uLighthouse.value;
      lamp.material.uniforms.uStr.value = 0.75 + k * 1.4;
      lamp.material.uniforms.uCol.value.setRGB(1.0, 0.9 + 0.0 * k, 0.7 + 0.1 * (1 - k));
    },
  };
}

/** Very faint cel-style mist drifting over the distant sea */
export function buildMist(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWP;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      ${NOISE_GLSL}
      varying vec2 vUv; varying vec3 vWP;
      void main(){
        vec2 q = vUv;
        float n = fbm(vec2(q.x*3.0 + uTime*0.01 + vWP.x*0.01, q.y*1.5));
        float shape = smoothstep(0.0, 0.3, q.y) * smoothstep(1.0, 0.45, q.y) * smoothstep(0.0, 0.2, q.x) * smoothstep(1.0, 0.8, q.x);
        float a = smoothstep(0.42, 0.5, n * shape + shape*0.25) * 0.22;
        a += smoothstep(0.55, 0.6, n * shape + shape*0.25) * 0.12;
        gl_FragColor = vec4(vec3(0.95, 0.98, 0.98), a);
      }`,
  });
  const group = new THREE.Group();
  const list = [];
  for (let i = 0; i < 9; i++) {
    const w = rr(60, 120), h = rr(6, 12);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const a = rr(-2.6, -0.3) + (i % 3 === 0 ? Math.PI * 0.9 : 0);
    const r = rr(70, 140);
    m.position.set(Math.cos(a) * r, WL + h * 0.35, Math.sin(a) * r);
    m.userData = { a, r, speed: rr(0.002, 0.005) * (rand() > 0.5 ? 1 : -1) };
    m.renderOrder = -3;
    group.add(m);
    list.push(m);
  }
  setLayers(group, { main: true, shadow: false, outline: false, refl: false });
  scene.add(group);
  return {
    update(now, camera) {
      for (const m of list) {
        const u = m.userData;
        const a = u.a + now * u.speed;
        m.position.x = Math.cos(a) * u.r; m.position.z = Math.sin(a) * u.r;
        m.lookAt(camera.position.x, m.position.y, camera.position.z);
      }
    },
  };
}
