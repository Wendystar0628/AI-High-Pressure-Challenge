import * as THREE from 'three';
import { U, LAYER } from './G.js';

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** Planar reflection helper (Reflector-style virtual camera, oblique clip plane) */
export class PlanarReflection {
  constructor(y, scale = 0.5) {
    this.y = y;
    this.scale = scale;
    this.rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 2 });
    this.cam = new THREE.PerspectiveCamera();
    this.texMat = { value: new THREE.Matrix4() };
    this.tex = { value: this.rt.texture };
  }
  setSize(w, h) { this.rt.setSize(Math.max(2, Math.floor(w * this.scale)), Math.max(2, Math.floor(h * this.scale))); }
  render(renderer, scene, camera) {
    const normal = new THREE.Vector3(0, 1, 0);
    const reflPos = new THREE.Vector3(0, this.y, 0);
    const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    if (camPos.y < this.y + 0.02) return false;
    const view = reflPos.clone().sub(camPos);
    // reflect camera position
    const vpos = camPos.clone(); vpos.y = 2 * this.y - camPos.y;
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const look = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(camPos);
    const target = look.clone(); target.y = 2 * this.y - look.y;
    const vc = this.cam;
    vc.position.copy(vpos);
    vc.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    vc.lookAt(target);
    vc.far = camera.far; vc.near = camera.near;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);
    // texture matrix (world -> reflection uv)
    const tm = this.texMat.value;
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(vc.projectionMatrix);
    tm.multiply(vc.matrixWorldInverse);
    // oblique clip plane
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, reflPos);
    plane.applyMatrix4(vc.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = vc.projectionMatrix;
    const q = new THREE.Vector4();
    q.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0;
    q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    pm.elements[2] = clip.x; pm.elements[6] = clip.y; pm.elements[10] = clip.z + 1.0 - 0.0; pm.elements[14] = clip.w;
    vc.projectionMatrixInverse.copy(pm).invert();
    vc.layers.set(LAYER.REFL);
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    const bg = scene.background; scene.background = null;
    U.uPass.value = 3;
    const pud = U.tPud.value, on = U.uPudOn.value;
    U.tPud.value = null; U.uPudOn.value = 0;
    renderer.render(scene, vc);
    U.tPud.value = pud; U.uPudOn.value = on;
    scene.background = bg;
    return true;
  }
}

export class Pipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    // shadow
    const S = 4096;
    this.shadowRT = new THREE.WebGLRenderTarget(S, S);
    this.shadowRT.depthTexture = new THREE.DepthTexture(S, S, THREE.UnsignedIntType);
    this.shadowRT.depthTexture.minFilter = THREE.NearestFilter;
    this.shadowRT.depthTexture.magFilter = THREE.NearestFilter;
    U.uShadowMap.value = this.shadowRT.depthTexture;
    U.uShadowTexel.value = 1 / S;
    const e = 30;
    this.shadowCam = new THREE.OrthographicCamera(-e, e, e, -e, 1, 160);
    this.shadowCam.layers.set(LAYER.SHADOW);
    // render targets
    this.mainRT = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
    this.normalRT = new THREE.WebGLRenderTarget(16, 16, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.bloomA = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
    this.bloomB = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
    this.reflections = [];
    this.fsScene = new THREE.Scene();
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);
    this.res = new THREE.Vector2(1, 1);
    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tColor, vUv).rgb; float l = max(c.r, max(c.g, c.b));
          // soft airy glow of the bright areas + stronger bloom for real highlights
          vec3 soft = c * smoothstep(0.8, 1.0, l) * 0.35;
          vec3 hot = c * smoothstep(1.02, 1.4, l);
          gl_FragColor = vec4(soft + hot, 1.0); }`,
      depthTest: false, depthWrite: false,
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor; uniform vec2 uDir; varying vec2 vUv;
        void main(){
          vec3 s = texture2D(tColor, vUv).rgb * 0.227;
          s += texture2D(tColor, vUv + uDir*1.385).rgb * 0.316;
          s += texture2D(tColor, vUv - uDir*1.385).rgb * 0.316;
          s += texture2D(tColor, vUv + uDir*3.23).rgb * 0.07;
          s += texture2D(tColor, vUv - uDir*3.23).rgb * 0.07;
          gl_FragColor = vec4(s, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tNormal: { value: null }, tBloom: { value: null },
        uRes: { value: this.res }, uTime: U.uTime, uLine: { value: 1.0 },
      },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor; uniform sampler2D tNormal; uniform sampler2D tBloom;
        uniform vec2 uRes; uniform float uTime; uniform float uLine;
        varying vec2 vUv;
        float dOf(vec4 n){ return n.b < 0.001 ? 1e5 : n.b; }
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          vec3 col = texture2D(tColor, vUv).rgb;
          vec2 px = uLine / uRes;
          vec4 n0 = texture2D(tNormal, vUv);
          vec4 nx1 = texture2D(tNormal, vUv + vec2(px.x, 0.0));
          vec4 nx2 = texture2D(tNormal, vUv - vec2(px.x, 0.0));
          vec4 ny1 = texture2D(tNormal, vUv + vec2(0.0, px.y));
          vec4 ny2 = texture2D(tNormal, vUv - vec2(0.0, px.y));
          float d0 = dOf(n0);
          float e = 0.0;
          if (n0.b > 0.001) {
            float i0 = 1.0/d0;
            float lx = (1.0/dOf(nx1) + 1.0/dOf(nx2) - 2.0*i0) * d0;
            float ly = (1.0/dOf(ny1) + 1.0/dOf(ny2) - 2.0*i0) * d0;
            float de = smoothstep(0.035, 0.09, max(-lx, -ly));
            // thicker outer silhouettes: look 2px away for large depth jumps
            vec2 p2 = px*2.0;
            float s1 = dOf(texture2D(tNormal, vUv + vec2(p2.x, 0.0)));
            float s2 = dOf(texture2D(tNormal, vUv - vec2(p2.x, 0.0)));
            float s3 = dOf(texture2D(tNormal, vUv + vec2(0.0, p2.y)));
            float s4 = dOf(texture2D(tNormal, vUv - vec2(0.0, p2.y)));
            float far = max(max(s1, s2), max(s3, s4));
            float sil = smoothstep(0.18, 0.4, (far - d0)/d0);
            de = max(de, sil*0.9);
            // normal creases (one-sided)
            float dn1 = length(n0.rg - nx1.rg) * step(abs(dOf(nx1)-d0)/d0, 0.08) * step(0.001, nx1.b);
            float dn2 = length(n0.rg - ny1.rg) * step(abs(dOf(ny1)-d0)/d0, 0.08) * step(0.001, ny1.b);
            float ne = smoothstep(0.3, 0.5, max(dn1, dn2));
            e = max(de, ne) * n0.a;
          }
          vec3 lineCol = col * vec3(0.30, 0.39, 0.45);
          col = mix(col, lineCol, clamp(e, 0.0, 1.0) * 0.88);
          // bloom
          vec3 bl = texture2D(tBloom, vUv).rgb;
          col += bl * vec3(1.0, 0.94, 0.8) * 0.5;
          // grading: high-key, airy
          col = col / (1.0 + max(col - 0.9, 0.0) * 0.9);
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(l), col, 1.04);
          col = col * 0.93 + vec3(0.055, 0.065, 0.07);
          // soft vignette (very subtle, cool)
          vec2 q = vUv - 0.5;
          float vg = smoothstep(0.85, 0.25, length(q*vec2(1.0, 0.85)));
          col = mix(col * vec3(0.93, 0.96, 0.98), col, vg);
          // paper grain
          col += (hash(vUv*uRes + fract(uTime*0.0)) - 0.5) * 0.012;
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
  }

  addReflection(r) { this.reflections.push(r); return r; }

  setSize(w, h, dpr) {
    const W = Math.floor(w * dpr), H = Math.floor(h * dpr);
    this.res.set(W, H);
    U.uResolution.value.set(W, H);
    this.mainRT.setSize(W, H);
    this.normalRT.setSize(W, H);
    this.bloomA.setSize(Math.floor(W / 4), Math.floor(H / 4));
    this.bloomB.setSize(Math.floor(W / 4), Math.floor(H / 4));
    for (const r of this.reflections) r.setSize(W, H);
    this.compMat.uniforms.uLine.value = Math.max(1, dpr * 0.9);
  }

  updateShadowCam() {
    const sd = U.uSunDir.value;
    const c = this.shadowCam;
    c.position.copy(sd).multiplyScalar(80).add(new THREE.Vector3(0, -2, 0));
    c.up.set(0, 1, 0);
    c.lookAt(0, -2, 0);
    c.updateMatrixWorld();
    c.updateProjectionMatrix();
    const m = U.uShadowMat.value;
    m.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    m.multiply(c.projectionMatrix);
    m.multiply(c.matrixWorldInverse);
  }

  fs(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCam);
  }

  render() {
    const r = this.renderer, scene = this.scene, cam = this.camera;
    r.autoClear = true;
    // 1. shadow
    this.updateShadowCam();
    U.uPass.value = 2;
    const bg = scene.background;
    scene.background = null;
    r.setRenderTarget(this.shadowRT);
    r.setClearColor(0xffffff, 1);
    U.uShadowMap.value = null;
    const pud = U.tPud.value; U.tPud.value = null;
    r.render(scene, this.shadowCam);
    U.uShadowMap.value = this.shadowRT.depthTexture;
    U.tPud.value = pud;
    // 2. reflections
    for (const refl of this.reflections) refl.render(r, scene, cam);
    // 3. normals
    U.uPass.value = 1;
    cam.layers.set(LAYER.OUTLINE);
    r.setRenderTarget(this.normalRT);
    r.setClearColor(0x000000, 0);
    r.render(scene, cam);
    // 4. main
    scene.background = bg;
    U.uPass.value = 0;
    cam.layers.set(LAYER.MAIN);
    r.setRenderTarget(this.mainRT);
    r.setClearColor(0xdfeeee, 1);
    r.render(scene, cam);
    // 5. bloom
    this.brightMat.uniforms.tColor.value = this.mainRT.texture;
    this.fs(this.brightMat, this.bloomA);
    const bw = this.bloomA.width, bh = this.bloomA.height;
    for (let i = 0; i < 2; i++) {
      this.blurMat.uniforms.tColor.value = this.bloomA.texture;
      this.blurMat.uniforms.uDir.value.set(1 / bw * (1 + i), 0);
      this.fs(this.blurMat, this.bloomB);
      this.blurMat.uniforms.tColor.value = this.bloomB.texture;
      this.blurMat.uniforms.uDir.value.set(0, 1 / bh * (1 + i));
      this.fs(this.blurMat, this.bloomA);
    }
    // 6. composite
    const cu = this.compMat.uniforms;
    cu.tColor.value = this.mainRT.texture;
    cu.tNormal.value = this.normalRT.texture;
    cu.tBloom.value = this.bloomA.texture;
    this.fs(this.compMat, null);
  }
}
