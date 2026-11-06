import * as THREE from 'three';
import { U, WL, setLayers, rr, rand } from '../core/G.js';
import { UNIFORMS_GLSL, NOISE_GLSL, FUNCS_GLSL } from '../core/glsl.js';
import { GB, T, M } from '../core/builder.js';
import { tetrapodGeo } from './base.js';

export function buildSky(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      ${NOISE_GLSL}
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 zenith = vec3(0.56, 0.79, 0.9);
        vec3 horizon = vec3(0.9, 0.96, 0.95);
        vec3 c = mix(horizon, zenith, pow(smoothstep(0.0, 1.0, h), 0.55));
        vec3 haze = vec3(0.87, 0.94, 0.93);
        c = mix(haze, c, smoothstep(-0.03, 0.06, h));
        // below horizon: soft gradient to a slightly deeper sea-mist
        c = mix(c, vec3(0.8, 0.9, 0.9), smoothstep(-0.05, -0.6, h)*0.6);
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        c += vec3(1.0, 0.9, 0.68) * (pow(sd, 90.0)*0.7 + pow(sd, 8.0)*0.14) * uSunVis;
        if (h > -0.02) {
          vec2 p = d.xz / (max(h, 0.0) + 0.14) * 1.1 + vec2(uTime*0.004, uTime*0.002);
          float n = fbm(p*1.2);
          float n2 = fbm(p*0.6 + 3.0);
          float cl = smoothstep(0.52, 0.6, n*0.7 + n2*0.4);
          vec3 shadeC = vec3(0.78, 0.86, 0.92);
          vec3 litC = vec3(1.0, 0.99, 0.96);
          vec3 ccol = mix(shadeC, litC, smoothstep(0.55, 0.72, n + (sd - 0.5)*0.2));
          float fade = smoothstep(-0.02, 0.2, h);
          c = mix(c, ccol, cl * 0.7 * fade);
          // thin wisps
          float w = smoothstep(0.6, 0.7, vnoise(p*vec2(0.6, 4.0) + 8.0)) * 0.25 * fade;
          c = mix(c, vec3(0.97, 0.99, 1.0), w);
        }
        // darker sky event
        c = mix(c * vec3(0.78, 0.82, 0.86), c, uSunVis);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  setLayers(sky, { main: true, shadow: false, outline: false, refl: false });
  scene.add(sky);
  return sky;
}

export function buildFarSea(scene, mats) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWP;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      ${NOISE_GLSL}
      ${FUNCS_GLSL}
      varying vec3 vWP;
      void main(){
        float r = length(vWP.xz);
        float a = smoothstep(46.0, 110.0, r);
        if (a <= 0.001) discard;
        float t = uTime;
        vec3 c = vec3(0.5, 0.79, 0.78);
        // painted horizontal streaks
        float s1 = smoothstep(0.6, 0.64, vnoise(vec2(vWP.x*0.05 + t*0.01, vWP.z*0.6)));
        float s2 = smoothstep(0.66, 0.7, vnoise(vec2(vWP.x*0.03 - t*0.008, vWP.z*0.25 + 9.0)));
        c = mix(c, vec3(0.72, 0.9, 0.88), s1*0.6);
        c = mix(c, vec3(0.38, 0.66, 0.7), s2*0.4);
        // sparkles
        vec2 g = vWP.xz*vec2(0.5, 1.6);
        float h = hash12(floor(g));
        float sp = step(0.985, h) * step(0.6, sin(t*(1.0 + h*3.0) + h*30.0)) * (1.0 - smoothstep(0.1, 0.3, length(fract(g) - 0.5)));
        c += vec3(1.0, 0.92, 0.72) * sp * 0.8 * uSunVis;
        // haze toward the horizon
        float f = smoothstep(90.0, 420.0, r);
        c = mix(c, vec3(0.87, 0.94, 0.93), f);
        // slow mist bands
        float mist = smoothstep(0.45, 0.75, vnoise(vec2(vWP.x*0.012 + t*0.006, vWP.z*0.03)));
        c = mix(c, vec3(0.9, 0.96, 0.95), mist*0.35);
        gl_FragColor = vec4(c, a);
      }`,
  });
  const g = new THREE.PlaneGeometry(1000, 1000, 1, 1);
  g.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(g, mat);
  sea.position.y = WL - 0.02;
  sea.renderOrder = -5;
  setLayers(sea, { main: true, shadow: false, outline: false, refl: false });
  scene.add(sea);

  // distant long breakwater (hazy) toward the back
  const b = new GB();
  const ang = 0.42;
  const cx = -38, cz = -112, len = 170;
  b.push(M(cx, WL, cz, 0, ang, 0));
  b.box(len, 1.8, 4.0, { c: [0.8, 0.83, 0.83], t: T.CONCRETE, l: 0.15 }, 0, 0.3, 0);
  b.box(len, 0.9, 1.0, { c: [0.84, 0.86, 0.86], t: T.CONCRETE, l: 0.15 }, 0, 1.6, -1.5);
  const tgeo = tetrapodGeo(1.8).build();
  for (let x = -len / 2 + 2; x < len / 2; x += 2.6) {
    const m = M(x + rr(-0.4, 0.4), rr(-0.6, 0.3), -3.2 + rr(-0.4, 0.4), rand() * 6, rand() * 6, rand() * 6);
    const geo = tgeo.clone(); geo.applyMatrix4(b.base.clone().multiply(m));
    b.parts.push(geo);
  }
  // little lighthouse at its tip (red)
  b.cyl(0.9, 1.2, 6, { c: [0.85, 0.3, 0.26], l: 0.4 }, len / 2 - 2, 4, 0, 0, 0, 0, 12);
  b.cyl(0.7, 0.7, 1.2, { c: [0.95, 0.95, 0.93], l: 0.4 }, len / 2 - 2, 7.6, 0, 0, 0, 0, 12);
  b.pop();
  // a far headland silhouette with hills on the left horizon
  const hill = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  b.add(hill, { c: [0.56, 0.72, 0.62], t: T.LEAF, l: 0.2 }, M(-170, WL - 2, -150, 0, 0.4, 0, 70, 22, 34));
  b.add(hill, { c: [0.6, 0.76, 0.66], t: T.LEAF, l: 0.2 }, M(-110, WL - 2, -190, 0, 0.2, 0, 50, 16, 26));
  b.add(hill, { c: [0.62, 0.77, 0.7], t: T.LEAF, l: 0.2 }, M(150, WL - 2, -230, 0, -0.3, 0, 80, 18, 30));
  const far = b.mesh(mats.toon);
  setLayers(far, { main: true, shadow: false, outline: true, refl: false });
  scene.add(far);
  return { sea, far };
}

export function buildRainbow(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWP;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform float uRainbow; uniform float uTime;
      varying vec2 vUv; varying vec3 vWP;
      vec3 hue(float h){ return clamp(abs(mod(h*6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main(){
        vec2 p = (vUv - vec2(0.5, 0.0)) * vec2(2.0, 1.0);
        float r = length(p);
        float b = (r - 0.78) / 0.12;   // 0..1 across the band
        if (b < 0.0 || b > 1.0) discard;
        // posterized bands (anime style)
        float q = floor(b * 6.0) / 6.0;
        vec3 c = hue(0.78 - q*0.78);
        c = mix(c, vec3(1.0), 0.28);
        float edge = smoothstep(0.0, 0.15, b) * smoothstep(1.0, 0.85, b);
        float vfade = smoothstep(0.05, 0.45, vUv.y);
        float a = uRainbow * 0.25 * edge * vfade;
        gl_FragColor = vec4(c, a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), mat);
  mesh.geometry.translate(0, 30, 0);
  mesh.renderOrder = -4;
  setLayers(mesh, { main: true, shadow: false, outline: false, refl: false });
  scene.add(mesh);
  return mesh;
}
