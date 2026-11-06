// 三维显示设备（宿主）。程序把场景资源和逐帧状态作为可复制的数据提交到这里；设备按提交内容绘制，
// 不推进场景状态：相同的提交得到相同的画面，两次提交之间画面不变。设备代码里没有任何具体模型。
// 所有视图共用一个 WebGL 上下文，画完拷到各自的二维画布，所以视图数量不受上下文上限影响；
// 上下文丢失后重建，画面从保留的系统提交恢复。
import * as THREE from '../vendor/three.module.js';
import { hashText } from './vm.js';

const MAX_PARTICLES = 7000;
const DENTS = 6;

function joinChunks(v) { return Array.isArray(v) ? v.join('') : v; }
function decodeB64(lines) {
  const s = atob(joinChunks(lines));
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
function mulberry(a) { // 无状态伪随机
  let t = (a + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// —— 由场景数据构建图形资源 ——
class SceneRes {
  constructor(gfx, data, key) {
    this.gfx = gfx;
    this.data = data;
    this.key = key;
    this.scene = new THREE.Scene();
    this.textures = {};
    this.materials = {};
    this.geos = {};
    this.parts = [];
    this.partByName = new Map();
    this.pickables = [];
    this.uTime = { value: 0 };
    this.uDown = { value: new THREE.Vector4(0, 0, 0, 0) };
    this.uWind = { value: new THREE.Vector2(1, 0) };
    this.build();
  }
  texture(name) {
    if (this.textures[name]) return this.textures[name];
    const def = (this.data.textures || {})[name];
    if (!def) return null;
    const tex = new THREE.Texture();
    const img = new Image();
    img.onload = () => { tex.image = img; tex.needsUpdate = true; this.gfx.markAllDirty(); };
    img.src = joinChunks(def.chunks || def.data);
    if (def.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = def.aniso || 4;
    if (def.wrap === 'repeat') { tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; }
    this.textures[name] = tex;
    return tex;
  }
  material(name, forPart) {
    const def = (this.data.materials || {})[name] || { color: '#cccccc', roughness: 0.6 };
    const opts = {};
    if (def.color) opts.color = new THREE.Color(def.color);
    if (def.vertexColors) opts.vertexColors = true;
    if (def.map) { const t = this.texture(def.map); if (t) opts.map = t; }
    if (def.side === 'back') opts.side = THREE.BackSide;
    if (def.side === 'double') opts.side = THREE.DoubleSide;
    if (def.transparent) opts.transparent = true;
    if (def.depthWrite === false) opts.depthWrite = false;
    if (def.opacity !== undefined) { opts.opacity = def.opacity; opts.transparent = true; }
    let m;
    if (def.unlit) m = new THREE.MeshBasicMaterial(opts);
    else {
      opts.roughness = def.roughness === undefined ? 0.6 : def.roughness;
      opts.metalness = def.metalness === undefined ? 0 : def.metalness;
      if (def.envMapIntensity !== undefined) opts.envMapIntensity = def.envMapIntensity;
      if (def.clearcoat !== undefined || def.glass) {
        if (def.clearcoat !== undefined) { opts.clearcoat = def.clearcoat; opts.clearcoatRoughness = def.clearcoatRoughness === undefined ? 0.2 : def.clearcoatRoughness; }
        m = new THREE.MeshPhysicalMaterial(opts);
      } else m = new THREE.MeshStandardMaterial(opts);
    }
    if (def.emissive) { m.emissive = new THREE.Color(def.emissive); m.emissiveIntensity = def.emissiveIntensity || 1; }
    const extras = { uScorch: { value: 0 }, uDents: { value: new Array(DENTS).fill(0).map(() => new THREE.Vector4(0, 0, 0, 0)) }, uDepth: { value: new Array(DENTS).fill(0) } };
    m.userData.extras = extras;
    const isGlass = !!def.glass;
    if (isGlass) { m.transparent = true; m.depthWrite = false; m.blending = THREE.CustomBlending; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendEquation = THREE.AddEquation; }
    const detailTex = def.detail ? this.texture(def.detail) : null;
    const emissiveV = def.emissiveVertex || 0;
    const isPart = !!forPart && !def.unlit;
    if (isGlass || detailTex || emissiveV || isPart) {
      const repeat = def.detailRepeat || 100;
      m.onBeforeCompile = (sh) => {
        if (isPart) {
          sh.uniforms.uScorch = extras.uScorch;
          sh.uniforms.uDents = extras.uDents;
          sh.uniforms.uDepth = extras.uDepth;
          sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
            uniform vec4 uDents[${DENTS}]; uniform float uDepth[${DENTS}]; varying vec3 vLocalP;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
            vLocalP = position;
            for (int i = 0; i < ${DENTS}; i++) { if (uDepth[i] > 0.0) { float d = distance(position, uDents[i].xyz); if (d < uDents[i].w) { float k = 1.0 - d / uDents[i].w; transformed -= normalize(normal + vec3(0.0001)) * uDepth[i] * k * k * (3.0 - 2.0 * k); } } }`);
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
            uniform float uScorch; varying vec3 vLocalP;
            float nestN(vec3 p){ return fract(sin(dot(floor(p), vec3(12.9898,78.233,37.719))) * 43758.5453); }
            float nestF(vec3 p){ return nestN(p*7.0)*0.5 + nestN(p*17.0)*0.3 + nestN(p*39.0)*0.2; }`)
            .replace('#include <map_fragment>', `#include <map_fragment>
            float nestBurn = 0.0; if (uScorch > 0.001) { nestBurn = smoothstep(0.0, 0.75, uScorch * 1.5 - nestF(vLocalP) * 0.8); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.018, 0.016, 0.015), nestBurn * 0.94); }`)
            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            roughnessFactor = mix(roughnessFactor, 0.96, nestBurn);`);
        }
        if (detailTex) {
          sh.uniforms.uDetail = { value: detailTex };
          sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n varying vec2 vDetailUv;`).replace('#include <begin_vertex>', `#include <begin_vertex>\n vDetailUv = uv * ${repeat.toFixed(1)};`);
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n uniform sampler2D uDetail; varying vec2 vDetailUv;`)
            .replace('#include <map_fragment>', `#include <map_fragment>\n { float dd = texture2D(uDetail, vDetailUv).r; float d2 = texture2D(uDetail, vDetailUv * 0.13).r; diffuseColor.rgb *= (dd * 0.6 + d2 * 0.75); }`);
        }
        if (emissiveV) {
          sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * ${emissiveV.toFixed(2)};`);
        }
        if (isGlass) {
          // 玻璃：漫反射按透明度衰减，高光完整保留，所以透明的同时映出环境
          sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `outgoingLight = totalDiffuse * diffuseColor.a + totalSpecular + totalEmissiveRadiance;
            #include <opaque_fragment>
            gl_FragColor.a = clamp(diffuseColor.a + dot(totalSpecular, vec3(0.3,0.59,0.11)), 0.0, 1.0);`);
        }
      };
      m.customProgramCacheKey = () => `nest|${isPart}|${!!detailTex}|${repeat}|${emissiveV}|${isGlass}`;
    }
    return m;
  }
  sharedMaterial(name) {
    if (!this.materials[name]) this.materials[name] = this.material(name, false);
    return this.materials[name];
  }
  geometry(name) {
    if (this.geos[name]) return this.geos[name];
    const def = (this.data.geometries || {})[name];
    if (!def) return null;
    this.geos[name] = this.decodeGeometry(def);
    return this.geos[name];
  }
  decodeGeometry(def) {
    const g = new THREE.BufferGeometry();
    const pu = decodeB64(def.pos);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pu.buffer, 0, def.n * 3), 3));
    const nu = decodeB64(def.nor);
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(nu.buffer, 0, def.n * 3), 3, true));
    if (def.uv) { const uu = decodeB64(def.uv); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uu.buffer, 0, def.n * 2), 2)); }
    if (def.col) { const cu = decodeB64(def.col); g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(cu.buffer, 0, def.n * 3), 3, true)); }
    const iu = decodeB64(def.idx);
    g.setIndex(new THREE.BufferAttribute(def.wide ? new Uint32Array(iu.buffer) : new Uint16Array(iu.buffer), 1));
    return g;
  }
  primitive(p) {
    if (p.box) return new THREE.BoxGeometry(p.box[0], p.box[1], p.box[2]);
    if (p.sphere) return new THREE.SphereGeometry(p.sphere, 32, 20);
    if (p.cylinder) return new THREE.CylinderGeometry(p.cylinder[0], p.cylinder[0], p.cylinder[1], 32);
    if (p.plane) return new THREE.PlaneGeometry(p.plane[0], p.plane[1]);
    return new THREE.BoxGeometry(1, 1, 1);
  }
  build() {
    const D = this.data, S = this.scene, E = D.environment || {};
    // 光照与天空：场景决定时刻和天气
    const sun = E.sun || { dir: [0.5, 0.8, 0.3], color: '#ffffff', intensity: 3 };
    this.sunDir = new THREE.Vector3(sun.dir[0], sun.dir[1], sun.dir[2]).normalize();
    const light = new THREE.DirectionalLight(new THREE.Color(sun.color), sun.intensity);
    light.castShadow = true;
    light.shadow.mapSize.set(4096, 4096);
    const R = D.terrain ? 110 : 24;
    Object.assign(light.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 900 });
    light.shadow.bias = -0.00035; light.shadow.normalBias = 0.035;
    this.sun = light;
    S.add(light); S.add(light.target);
    const hemiDef = E.hemi || { sky: '#a0b8e0', ground: '#605840', intensity: 0.8 };
    S.add(new THREE.HemisphereLight(new THREE.Color(hemiDef.sky), new THREE.Color(hemiDef.ground), hemiDef.intensity));
    for (const l of D.lights || []) {
      const pl = new THREE.PointLight(new THREE.Color(l.color || '#ffffff'), l.intensity || 10, l.distance || 0);
      pl.position.set(...(l.pos || [0, 3, 0]));
      S.add(pl);
    }
    if (E.fog) S.fog = new THREE.FogExp2(new THREE.Color(E.fog.color), E.fog.density);
    this.far = E.far || 4000;
    this.buildSky(E);
    // 程序提交的动态灯（火光等）
    this.dynLights = [];
    for (let i = 0; i < 2; i++) { const pl = new THREE.PointLight(0xffa050, 0, 60, 1.8); S.add(pl); this.dynLights.push(pl); }
    if (D.terrain) this.buildTerrain(D.terrain);
    if (D.objects && D.models) this.buildObjects();
    if (D.grass && D.terrain) this.buildGrass();
    this.buildParts();
    this.buildParticles();
    this.buildScars();
    this.camera = new THREE.PerspectiveCamera(45, 1.6, 0.25, this.far);
  }
  buildSky(E) {
    const sky = E.sky || { zenith: '#3a68b0', horizon: '#dbe6f0' };
    const toC = (c) => new THREE.Color(c);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uZ: { value: toC(sky.zenith) }, uH: { value: toC(sky.horizon) }, uG: { value: toC(sky.sunGlow || sky.horizon) }, uSun: { value: this.sunDir.clone() }, uCloud: { value: sky.cloud === undefined ? 0.4 : sky.cloud } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }',
      fragmentShader: `varying vec3 vD; uniform vec3 uZ, uH, uG, uSun; uniform float uCloud;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ float s=0.,a=.5; for(int i=0;i<6;i++){ s+=a*n(p); p=p*2.03+vec2(7.1,3.3); a*=.5; } return s; }
        void main(){ vec3 d=normalize(vD); float y=max(d.y,0.0);
          vec3 c=mix(uH,uZ,pow(y,0.55)); float sd=max(dot(d,uSun),0.0);
          c+=uG*pow(sd,6.0)*0.35; c+=uG*pow(sd,64.0)*0.8; c+=vec3(1.0,0.95,0.85)*pow(sd,900.0)*6.0;
          if(d.y>0.01){ vec2 q=d.xz/(d.y+0.12)*1.6; float f=fbm(q+vec2(2.3,1.1)); float cl=smoothstep(1.0-uCloud*0.85,1.05-uCloud*0.35,f); float lit=fbm(q*1.3+uSun.xz*0.8+4.0);
            vec3 cc=mix(vec3(0.72,0.62,0.62),vec3(1.0,0.9,0.78),clamp(lit*1.3+pow(sd,3.0)*0.7,0.,1.)); c=mix(c,cc,cl*smoothstep(0.01,0.16,d.y)*0.88); }
          if(d.y<0.0){ c=mix(uH,uH*0.62,clamp(-d.y*4.0,0.,1.)); }
          gl_FragColor=vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat);
    this.skyMesh.frustumCulled = false;
    this.skyMesh.renderOrder = -10;
    this.scene.add(this.skyMesh);
    // 环境贴图：从同一片天空生成，漆面和玻璃反射它
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat.clone());
    envSky.material.uniforms = mat.uniforms;
    envScene.add(envSky);
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(30, 24), new THREE.MeshBasicMaterial({ color: 0x6b6a4a }));
    gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.4;
    envScene.add(gnd);
    const pm = new THREE.PMREMGenerator(this.gfx.renderer);
    const toneSave = this.gfx.renderer.toneMapping;
    this.gfx.renderer.toneMapping = THREE.NoToneMapping;
    this.scene.environment = pm.fromScene(envScene, 0.015).texture;
    this.gfx.renderer.toneMapping = toneSave;
    this.scene.environmentIntensity = E.envIntensity === undefined ? 0.9 : E.envIntensity;
    pm.dispose();
  }
  buildTerrain(T) {
    const n = T.n, size = T.size, h = T.heights;
    const pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      pos[k * 3] = (i / (n - 1) - 0.5) * size; pos[k * 3 + 1] = h[k]; pos[k * 3 + 2] = (j / (n - 1) - 0.5) * size;
      uv[k * 2] = i / (n - 1); uv[k * 2 + 1] = 1 - j / (n - 1);
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6);
    let w = 0;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx[w++] = a; idx[w++] = c; idx[w++] = b; idx[w++] = b; idx[w++] = c; idx[w++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const mat = this.sharedMaterial(T.material || 'terrain');
    if (mat.map) { mat.map.wrapS = mat.map.wrapT = THREE.ClampToEdgeWrapping; mat.map.flipY = true; }
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.ground = true;
    this.terrainMesh = mesh;
    this.scene.add(mesh);
    this.pickables.push(mesh);
    // 地形外的低地，防止边缘露底
    const skirt = new THREE.Mesh(new THREE.CircleGeometry(9000, 48), new THREE.MeshStandardMaterial({ color: 0x4f5a3c, roughness: 1 }));
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.y = Math.min(...[h[0], h[n - 1], h[n * n - 1], h[n * n - n]]) - 8;
    this.scene.add(skirt);
  }
  groundAt(x, z) {
    const T = this.data.terrain;
    if (!T) return -1e6;
    const n = T.n;
    let fx = (x / T.size + 0.5) * (n - 1), fz = (z / T.size + 0.5) * (n - 1);
    fx = Math.max(0, Math.min(n - 1.001, fx)); fz = Math.max(0, Math.min(n - 1.001, fz));
    const ix = Math.floor(fx), iz = Math.floor(fz), ax = fx - ix, az = fz - iz, h = T.heights;
    const a = h[iz * n + ix], b = h[iz * n + ix + 1], c = h[(iz + 1) * n + ix], d = h[(iz + 1) * n + ix + 1];
    return ax + az < 1 ? a + (b - a) * ax + (c - a) * az : d + (c - d) * (1 - ax) + (b - d) * (1 - az);
  }
  buildObjects() {
    const D = this.data;
    const groups = new Map();
    for (const o of D.objects) {
      const model = D.models[o.model];
      if (!model) continue;
      for (const [gname, mname] of model) {
        const key = gname + '|' + mname;
        if (!groups.has(key)) groups.set(key, { gname, mname, list: [] });
        groups.get(key).list.push(o);
      }
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const g of groups.values()) {
      const geo = this.geometry(g.gname);
      if (!geo) continue;
      const mesh = new THREE.InstancedMesh(geo, this.sharedMaterial(g.mname), g.list.length);
      g.list.forEach((o, i) => {
        p.set(o.x, o.y, o.z); q.setFromAxisAngle(up, o.ry || 0); const sc = o.s || 1; s.set(sc, sc, sc);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.userData.objects = g.list;
      this.scene.add(mesh);
      this.pickables.push(mesh);
    }
  }
  buildGrass() {
    const fields = this.data.grass;
    const total = fields.reduce((a, f) => a + f.count, 0);
    // 一片草叶：三段收窄
    const hw = 0.035;
    const pos = [], nor = [], idx = [];
    const rows = [[0, hw], [0.4, hw * 0.8], [0.75, hw * 0.45], [1, 0]];
    rows.forEach(([y, w]) => { pos.push(-w, y, 0, w, y, 0); nor.push(0, 0.6, 0.8, 0, 0.6, 0.8); });
    for (let i = 0; i < 3; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
    const uTime = this.uTime, uDown = this.uDown, uWind = this.uWind;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime; sh.uniforms.uDown = uDown; sh.uniforms.uWind = uWind;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n uniform float uTime; uniform vec4 uDown; uniform vec2 uWind;')
        .replace('#include <project_vertex>', `
          vec4 nestP = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            nestP = instanceMatrix * nestP;
          #endif
          nestP = modelMatrix * nestP;
          float nestK = position.y * position.y;
          float nestPh = nestP.x * 0.31 + nestP.z * 0.27;
          vec2 nestSway = uWind * (0.09 + 0.05 * sin(uTime * 2.1 + nestPh)) + vec2(sin(uTime * 3.3 + nestPh * 2.0), cos(uTime * 2.7 + nestPh * 1.7)) * 0.035;
          nestP.xz += nestSway * nestK;
          if (uDown.w > 0.001) {
            vec2 dd = nestP.xz - uDown.xz; float r = length(dd);
            float hk = uDown.w * smoothstep(19.0, 1.5, r);
            float ripple = 0.72 + 0.28 * sin(r * 1.9 - uTime * 15.0 + nestPh);
            nestP.xz += normalize(dd + vec2(0.001)) * hk * ripple * nestK * 0.62;
            nestP.y -= hk * ripple * nestK * 0.42;
          }
          vec4 mvPosition = viewMatrix * nestP;
          gl_Position = projectionMatrix * mvPosition;`);
    };
    mat.customProgramCacheKey = () => 'nest-grass';
    const mesh = new THREE.InstancedMesh(g, mat, total);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    let n = 0;
    for (const f of fields) {
      for (let i = 0; i < f.count; i++) {
        const r1 = mulberry(f.seed * 1000 + i * 3), r2 = mulberry(f.seed * 2000 + i * 3 + 1), r3 = mulberry(f.seed * 3000 + i * 3 + 2);
        const r = Math.sqrt(r1) * f.r, a = r2 * Math.PI * 2;
        const x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
        const keep = r > (f.inner || 0);
        const sc = keep ? f.height * (0.6 + r3 * 0.8) * (1 - 0.5 * Math.pow(r / f.r, 3)) : 0.0001;
        p.set(x, this.groundAt(x, z) - 0.02, z); q.setFromAxisAngle(up, r3 * 40); s.set(sc * 1.1, sc, sc);
        m.compose(p, q, s);
        mesh.setMatrixAt(n, m);
        c.setRGB(0.20 + r2 * 0.14, 0.33 + r3 * 0.16, 0.09 + r1 * 0.05);
        mesh.setColorAt(n, c);
        n++;
      }
    }
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }
  buildParts() {
    const list = this.data.parts || [];
    list.forEach((def, i) => {
      const local = new THREE.Matrix4();
      const pos = def.pos || [0, 0, 0], rot = def.rot || [0, 0, 0, 1], sc = def.scale || [1, 1, 1];
      local.compose(new THREE.Vector3(...pos), new THREE.Quaternion(...rot), new THREE.Vector3(...sc));
      const part = { i, name: def.name, def, local, world: new THREE.Matrix4(), parent: null, mesh: null, defVisible: def.visible !== false, defOpacity: def.opacity === undefined ? 1 : def.opacity, kids: [] };
      if (def.parent !== undefined && def.parent !== null) { part.parent = this.partByName.get(def.parent) || null; if (part.parent) part.parent.kids.push(part); }
      this.partByName.set(def.name, part);
      this.parts.push(part);
      const geo = def.geometry ? this.geometry(def.geometry) : def.primitive ? this.primitive(def.primitive) : null;
      if (geo) {
        const mat = this.material(def.material, true);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.matrixAutoUpdate = false;
        mesh.matrixWorldAutoUpdate = false;
        mesh.frustumCulled = false;
        mesh.castShadow = def.castShadow !== false && !mat.transparent;
        mesh.receiveShadow = def.receiveShadow !== false;
        mesh.userData.part = part;
        if (def.static) { mesh.matrixWorld.copy(local); mesh.renderOrder = -5; }
        part.mesh = mesh;
        part.baseOpacity = mat.opacity;
        part.baseTransparent = mat.transparent;
        part.baseDepthWrite = mat.depthWrite;
        this.scene.add(mesh);
        if (def.pick !== false) this.pickables.push(mesh);
      }
    });
  }
  buildParticles() {
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    const iA = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 4), 4); // x,y,z,size
    const iB = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 4), 4); // r,g,b,alpha
    const iC = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 2), 2); // seed, glow
    iA.setUsage(THREE.DynamicDrawUsage); iB.setUsage(THREE.DynamicDrawUsage); iC.setUsage(THREE.DynamicDrawUsage);
    quad.setAttribute('iA', iA); quad.setAttribute('iB', iB); quad.setAttribute('iC', iC);
    quad.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation, side: THREE.DoubleSide,
      uniforms: { uSun: { value: this.sunDir.clone() }, uFog: { value: this.scene.fog ? this.scene.fog.color : new THREE.Color(0) }, uFogD: { value: this.scene.fog ? this.scene.fog.density : 0 } },
      vertexShader: `attribute vec4 iA, iB; attribute vec2 iC; varying vec4 vC; varying vec2 vUv; varying float vSeed, vGlow, vDepth;
        void main(){ vC=iB; vSeed=iC.x; vGlow=iC.y; vUv=position.xy; vec4 mv=modelViewMatrix*vec4(iA.xyz,1.0);
          float a=iC.x*6.28; float c=cos(a), s=sin(a); vec2 q=vec2(position.x*c-position.y*s, position.x*s+position.y*c);
          mv.xy+=q*iA.w; vDepth=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec4 vC; varying vec2 vUv; varying float vSeed, vGlow, vDepth; uniform vec3 uFog; uniform float uFogD;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){ float r=length(vUv); if(r>1.0) discard; vec2 q=vUv*2.6+vSeed*37.0; float w=n(q)*.55+n(q*2.1)*.3+n(q*4.3)*.15;
          float a=smoothstep(1.0,0.25,r)*smoothstep(0.18,0.62,w+(1.0-r)*0.55)*vC.a; if(a<0.004) discard;
          vec3 col=vC.rgb*(0.82+w*0.36+ (vUv.y*0.18));
          float fog=1.0-exp(-uFogD*uFogD*vDepth*vDepth); col=mix(col,uFog,fog*(1.0-vGlow));
          gl_FragColor=vec4(col,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor=vec4(gl_FragColor.rgb*a*(1.0+vGlow*0.5), a*(1.0-vGlow*0.6));
        }`,
    });
    const mesh = new THREE.Mesh(quad, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    this.particles = { mesh, iA, iB, iC, buf: [] };
    this.scene.add(mesh);
  }
  buildScars() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    gr.addColorStop(0, 'rgba(6,5,5,.95)'); gr.addColorStop(0.55, 'rgba(14,11,9,.7)'); gr.addColorStop(1, 'rgba(20,16,12,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.scars = [];
    const geo = new THREE.PlaneGeometry(1, 1, 8, 8);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(geo.clone(), mat);
      m.visible = false;
      m.renderOrder = 2;
      this.scars.push(m);
      this.scene.add(m);
    }
  }
  // —— 应用一帧提交 ——
  apply(frame, aspect) {
    const f = frame || {};
    const T = f.t || 0;
    this.uTime.value = T;
    if (f.wind) this.uWind.value.set(f.wind[0], f.wind[1]);
    // 部件：先恢复默认，再套用提交
    const over = new Map();
    if (f.parts) for (const e of f.parts) over.set(e[0], e);
    const tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    const scorchGlobal = new Float32Array(this.parts.length), opacityGlobal = new Float32Array(this.parts.length).fill(1), hiddenGlobal = new Uint8Array(this.parts.length);
    for (const part of this.parts) {
      const e = over.get(part.i);
      let hidden = !part.defVisible;
      let scorch = part.parent ? scorchGlobal[part.parent.i] : 0;
      let op = (part.parent ? opacityGlobal[part.parent.i] : 1);
      const parentHidden = part.parent ? hiddenGlobal[part.parent.i] : 0;
      let selfOp = part.defOpacity;
      let worldFlag = false;
      let m = part.local;
      if (e) {
        const flags = e[8] || 0;
        if (flags & 2) hidden = true;
        else if (!part.defVisible && flags !== undefined) hidden = false;
        worldFlag = (flags & 1) !== 0;
        if (e[9] !== undefined && e[9] !== null) scorch = e[9];
        if (e[10] !== undefined && e[10] !== null) selfOp = e[10];
        if (e[1] !== null && !(flags & 2)) {
          tmpP.set(e[1], e[2], e[3]); tmpQ.set(e[4], e[5], e[6], e[7]);
          m = part.tmp || (part.tmp = new THREE.Matrix4());
          m.compose(tmpP, tmpQ, one);
        }
      }
      if (worldFlag || !part.parent) part.world.copy(m);
      else part.world.multiplyMatrices(part.parent.world, m);
      const hideNow = hidden || (parentHidden && !worldFlag);
      hiddenGlobal[part.i] = hideNow ? 1 : 0;
      scorchGlobal[part.i] = scorch;
      op *= selfOp;
      opacityGlobal[part.i] = op;
      if (part.mesh) {
        const me = part.mesh;
        if (!part.def.static) me.matrixWorld.copy(part.world);
        me.visible = !hideNow && op > 0.004;
        const mat = me.material;
        mat.opacity = part.baseOpacity * op;
        const wantTrans = part.baseTransparent || op < 0.999;
        if (mat.transparent !== wantTrans) { mat.transparent = wantTrans; mat.needsUpdate = true; }
        mat.depthWrite = wantTrans ? (part.baseTransparent ? part.baseDepthWrite : op > 0.75) : true;
        const ex = mat.userData.extras;
        if (ex) ex.uScorch.value = scorch;
      }
    }
    // 局部形变
    const dents = f.dents || [];
    for (const part of this.parts) {
      if (!part.mesh || part.parent !== this.parts[0]) continue;
      const ex = part.mesh.material.userData.extras;
      if (!ex) continue;
      for (let i = 0; i < DENTS; i++) {
        const d = dents[i];
        if (d) { ex.uDents.value[i].set(d[0], d[1], d[2], d[3]); ex.uDepth.value[i] = d[4]; } else ex.uDepth.value[i] = 0;
      }
    }
    // 动态灯
    const L = f.lights || [];
    this.dynLights.forEach((pl, i) => {
      const l = L[i];
      if (l) { pl.position.set(l[0], l[1], l[2]); pl.color.setRGB(l[3], l[4], l[5]); pl.intensity = l[6]; pl.distance = l[7] || 60; } else pl.intensity = 0;
    });
    // 下洗
    if (f.down) this.uDown.value.set(f.down[0], f.down[1], f.down[2], f.down[3]); else this.uDown.value.set(0, 0, 0, 0);
    // 焦痕
    const scars = f.scars || [];
    this.scars.forEach((m, i) => {
      const s = scars[i];
      if (s) {
        m.visible = true; m.scale.set(s[3], 1, s[3]);
        const posA = m.geometry.attributes.position;
        if (m.userData.sig !== `${s[0]},${s[2]},${s[3]}`) {
          m.userData.sig = `${s[0]},${s[2]},${s[3]}`;
          for (let k = 0; k < posA.count; k++) { const lx = posA.getX(k) * s[3] + s[0], lz = posA.getZ(k) * s[3] + s[2]; posA.setY(k, this.groundAt(lx, lz) + 0.05 - s[1]); }
          posA.needsUpdate = true;
          m.geometry.computeBoundingSphere();
        }
        m.position.set(s[0], s[1], s[2]);
      } else m.visible = false;
    });
    // 相机：同一机位，不同尺寸各自取景，不拉伸
    const C = f.cam || (this.data.cameras && this.data.cameras.default ? [...this.data.cameras.default.pos, ...this.data.cameras.default.target, this.data.cameras.default.fov || 45] : [6, 4, 8, 0, 0, 0, 45]);
    const cam = this.camera;
    cam.position.set(C[0], C[1], C[2]);
    cam.up.set(0, 1, 0);
    cam.lookAt(C[3], C[4], C[5]);
    cam.fov = C[6] || 45;
    // 竖向视野按宽幅基准换算，窄窗口不至于把主体裁掉
    if (aspect < 1.3) cam.fov = 2 * Math.atan(Math.tan(cam.fov * Math.PI / 360) * 1.3 / aspect) * 180 / Math.PI;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    this.skyMesh.position.copy(cam.position);
    this.skyMesh.scale.setScalar(Math.min(this.far * 0.9, 8000) / 10);
    // 阴影相机跟随焦点
    let fx = C[3], fy = C[4], fz = C[5];
    if (f.focus) { fx = f.focus[0]; fy = f.focus[1]; fz = f.focus[2]; }
    const gy = this.data.terrain ? Math.min(fy, this.groundAt(fx, fz) + 30) : fy;
    this.sun.target.position.set(fx, gy, fz);
    this.sun.position.set(fx + this.sunDir.x * 300, gy + this.sunDir.y * 300, fz + this.sunDir.z * 300);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
    this.updateParticles(f, T, cam);
  }
  // 由提交的发射记录展开粒子；每个粒子只由记录和时刻决定，不积累状态
  updateParticles(f, T, cam) {
    const P = this.particles;
    const rec = f.fx || [];
    const wind = f.wind || [0, 0];
    const out = P.buf;
    let n = 0;
    const camX = cam.position.x, camY = cam.position.y, camZ = cam.position.z;
    for (let k = 0; k + 11 < rec.length; k += 12) {
      const kind = rec[k], t0 = rec[k + 1], ox = rec[k + 2], oy = rec[k + 3], oz = rec[k + 4], vx = rec[k + 5], vy = rec[k + 6], vz = rec[k + 7], cnt = rec[k + 8], seed = rec[k + 9], size = rec[k + 10], life = rec[k + 11];
      for (let i = 0; i < cnt; i++) {
        if (n >= MAX_PARTICLES) break;
        const s0 = seed * 97 + i * 13;
        const r1 = mulberry(s0), r2 = mulberry(s0 + 1), r3 = mulberry(s0 + 2), r4 = mulberry(s0 + 3);
        const birth = t0 + r4 * 0.066;
        const age = T - birth;
        const L = life * (0.65 + r1 * 0.6);
        if (age < 0 || age > L) continue;
        const u = age / L;
        const a = r2 * Math.PI * 2;
        let x, y, z, sz, cr, cg, cb, al, glow = 0;
        const spread = r3;
        if (kind === 0) { // 尘土：贴地扩散后减速
          const rad = spread * size * 2.2;
          const drag = 1 - Math.exp(-age * 1.6);
          x = ox + (vx + Math.cos(a) * rad * 2.2) * drag + wind[0] * age * 0.5;
          z = oz + (vz + Math.sin(a) * rad * 2.2) * drag + wind[1] * age * 0.5;
          y = oy + 0.2 + (vy * 0.5 + r1 * 1.3) * drag + 0.25 * age;
          sz = size * (0.45 + u * 1.55);
          cr = 0.52 + r1 * 0.08; cg = 0.44 + r1 * 0.07; cb = 0.32 + r1 * 0.06;
          al = 0.38 * Math.min(1, age * 7) * Math.pow(1 - u, 1.4);
        } else if (kind === 1) { // 浓烟：上升、随风偏移
          const rad = spread * size * 0.8;
          x = ox + Math.cos(a) * rad + vx * age * 0.2 + wind[0] * age * (0.55 + age * 0.05);
          z = oz + Math.sin(a) * rad + vz * age * 0.2 + wind[1] * age * (0.55 + age * 0.05);
          y = oy + (2.3 + r1 * 1.5) * age * (1 - u * 0.25);
          sz = size * (0.55 + u * 2.6);
          const v = 0.05 + u * 0.13 + r1 * 0.03;
          cr = v; cg = v * 0.96; cb = v * 0.94;
          al = 0.62 * Math.min(1, age * 3.5) * Math.pow(1 - u, 1.15);
        } else if (kind === 2) { // 火：贴近机体、短命
          const rad = spread * size * 0.55;
          x = ox + Math.cos(a) * rad + wind[0] * age * 0.3;
          z = oz + Math.sin(a) * rad + wind[1] * age * 0.3;
          y = oy + (1.4 + r1 * 2.2) * age;
          sz = size * (0.8 - u * 0.5);
          cr = 1.0; cg = 0.62 - u * 0.42; cb = 0.18 - u * 0.15;
          al = 0.9 * (1 - u) * Math.min(1, age * 12);
          glow = 1;
        } else if (kind === 3) { // 火星：弹道
          const sp = 3 + r1 * 8;
          x = ox + (vx + Math.cos(a) * sp) * age;
          z = oz + (vz + Math.sin(a) * sp) * age;
          y = oy + (vy + 3 + r3 * 7) * age - 4.9 * age * age;
          if (this.data.terrain) { const gr = this.groundAt(x, z); if (y < gr) y = gr + 0.03; }
          sz = 0.07 + r2 * 0.09;
          cr = 1; cg = 0.72 - u * 0.5; cb = 0.28 - u * 0.25;
          al = 1 - u;
          glow = 1;
        } else { // 故障尾迹：灰色
          x = ox + Math.cos(a) * spread * 0.3 + vx * age * 0.35 + wind[0] * age * 0.8;
          z = oz + Math.sin(a) * spread * 0.3 + vz * age * 0.35 + wind[1] * age * 0.8;
          y = oy + vy * age * 0.35 + 0.8 * age;
          sz = size * (0.4 + u * 2.2);
          const v = 0.2 + r1 * 0.06 + u * 0.16;
          cr = v; cg = v; cb = v * 1.02;
          al = 0.48 * Math.min(1, age * 6) * Math.pow(1 - u, 1.25);
        }
        const dx = x - camX, dy = y - camY, dz = z - camZ;
        out[n] = { x, y, z, sz, cr, cg, cb, al, glow, s: r2, d: dx * dx + dy * dy + dz * dz };
        n++;
      }
    }
    // 由远到近
    const list = out.slice(0, n);
    list.sort((p, q) => q.d - p.d);
    const A = P.iA.array, B = P.iB.array, C = P.iC.array;
    for (let i = 0; i < n; i++) {
      const p = list[i];
      A[i * 4] = p.x; A[i * 4 + 1] = p.y; A[i * 4 + 2] = p.z; A[i * 4 + 3] = p.sz;
      B[i * 4] = p.cr; B[i * 4 + 1] = p.cg; B[i * 4 + 2] = p.cb; B[i * 4 + 3] = p.al;
      C[i * 2] = p.s; C[i * 2 + 1] = p.glow;
    }
    P.iA.needsUpdate = true; P.iB.needsUpdate = true; P.iC.needsUpdate = true;
    P.mesh.geometry.instanceCount = n;
    P.mesh.visible = n > 0;
  }
  dispose() {
    for (const g of Object.values(this.geos)) g.dispose();
    for (const t of Object.values(this.textures)) t.dispose();
    this.scene.traverse((o) => { if (o.material && o.material.dispose) o.material.dispose(); if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
    if (this.scene.environment) this.scene.environment.dispose();
  }
}

export class GfxDevice {
  constructor(device) {
    this.device = device;
    this.views = new Map();
    this.res = new Map();     // 内容哈希 -> { data, text, res, users }
    this.createRenderer();
    this.lastRaf = 0;
    const loop = () => { this.lastRaf = performance.now(); this.renderDirty(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    // 窗口被盖住时动画帧回调可能停止：定时器兜底，绘制不中断
    setInterval(() => { if (performance.now() - this.lastRaf > 60) this.renderDirty(); }, 33);
  }
  createRenderer() {
    const canvas = document.createElement('canvas');
    canvas.width = 1280; canvas.height = 720;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.onContextLost();
    });
    let r;
    try {
      r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    } catch (e) {
      console.error('WebGL 创建失败', e);
      this.renderer = null;
      setTimeout(() => this.createRenderer(), 1000);
      return;
    }
    r.setPixelRatio(1);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;
    this.glW = 1280; this.glH = 720;
    this.lostCount = this.lostCount || 0;
  }
  onContextLost() {
    this.lostCount++;
    // 丢弃图形对象，留下提交的数据；下一次绘制时从系统状态重建
    for (const e of this.res.values()) e.res = null;
    try { this.renderer.dispose(); } catch { /* 已丢失 */ }
    this.renderer = null;
    setTimeout(() => { this.createRenderer(); this.markAllDirty(); }, 50);
  }
  loseContextForTest() { const ext = this.renderer.getContext().getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
  key(sys, vid) { return sys + '|' + vid; }
  view(sys, vid) {
    const k = this.key(sys, vid);
    let v = this.views.get(k);
    if (!v) { v = { sys, vid, hash: null, frame: null, canvas: null, ctx: null, dirty: true }; this.views.set(k, v); }
    return v;
  }
  open(sys, vid, text) {
    let data;
    const hash = hashText(text);
    let entry = this.res.get(hash);
    if (!entry) {
      try { data = JSON.parse(text); } catch (e) { return { error: '场景文件不是合法的 JSON：' + e.message }; }
      if (data.format !== 'nest-scene') return { error: '不是场景文件（format 应为 nest-scene）' };
      entry = { data, text, res: null };
      this.res.set(hash, entry);
    }
    const v = this.view(sys, vid);
    v.hash = hash;
    v.frame = null;
    v.dirty = true;
    return true;
  }
  frame(sys, vid, frame) {
    const v = this.view(sys, vid);
    // 粒子记录没变化时程序可以省略 fx，沿用上一次提交的内容
    if (frame && frame.fx === undefined && v.frame && v.frame.fx) frame.fx = v.frame.fx;
    v.frame = frame;
    v.dirty = true;
  }
  close(sys, vid) {
    const k = this.key(sys, vid);
    const v = this.views.get(k);
    if (v) { if (v.canvas) v.canvas._nestView = null; this.views.delete(k); }
    this.gcRes();
  }
  gcRes() {
    const used = new Set();
    for (const v of this.views.values()) if (v.hash) used.add(v.hash);
    for (const [h, e] of this.res) if (!used.has(h)) { if (e.res) e.res.dispose(); this.res.delete(h); }
  }
  dropSystem(sys) { for (const v of [...this.views.values()]) if (v.sys === sys) this.close(sys, v.vid); }
  attach(sys, vid, canvas) {
    const v = this.view(sys, vid);
    v.canvas = canvas;
    canvas._nestView = v;
    v.ctx = null;
    v.dirty = true;
  }
  detach(canvas) { const v = canvas._nestView; if (v && v.canvas === canvas) { v.canvas = null; v.ctx = null; } }
  resized(canvas) { const v = canvas._nestView; if (v) v.dirty = true; }
  markAllDirty() { for (const v of this.views.values()) v.dirty = true; }
  exportViews(sys, scenes) {
    const out = {};
    for (const v of this.views.values()) {
      if (v.sys !== sys || !v.hash) continue;
      const e = this.res.get(v.hash);
      if (e) scenes[v.hash] = e.text;
      out[v.vid] = { scene: v.hash, frame: v.frame };
    }
    return out;
  }
  importViews(sys, views, scenes) {
    for (const vid of Object.keys(views)) {
      const d = views[vid];
      const text = scenes[d.scene];
      if (text === undefined) continue;
      this.open(sys, vid, text);
      this.view(sys, vid).frame = d.frame;
    }
  }
  resFor(v) {
    const e = this.res.get(v.hash);
    if (!e) return null;
    if (!e.res) {
      try { e.res = new SceneRes(this, e.data, v.hash); } catch (err) { console.error('构建场景失败', err); return null; }
    }
    return e.res;
  }
  renderDirty() {
    if (!this.renderer) return;
    let budget = 12;
    for (const v of this.views.values()) {
      if (!v.dirty || !v.canvas || !v.hash) continue;
      if (budget-- <= 0) break;
      this.renderView(v);
    }
  }
  renderView(v) {
    const c = v.canvas;
    if (!c.isConnected || c.offsetParent === null) return;
    const rect = c.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = window.devicePixelRatio || 1;
    let w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    const maxD = 2560;
    if (w > maxD) { h = Math.round(h * maxD / w); w = maxD; }
    if (h > 1600) { w = Math.round(w * 1600 / h); h = 1600; }
    const res = this.resFor(v);
    if (!res) return;
    const r = this.renderer;
    if (w > this.glW || h > this.glH) {
      this.glW = Math.max(this.glW, w); this.glH = Math.max(this.glH, h);
      r.setSize(this.glW, this.glH, false);
    }
    res.apply(v.frame, w / h);
    r.setViewport(0, 0, w, h);
    r.setScissor(0, 0, w, h);
    r.setScissorTest(true);
    r.render(res.scene, res.camera);
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    if (!v.ctx) v.ctx = c.getContext('2d', { alpha: false, desynchronized: false });
    if (v.ctx) v.ctx.drawImage(r.domElement, 0, this.glH - h, w, h, 0, 0, w, h);
    v.dirty = false;
    v.renderedT = v.frame ? v.frame.t : 0;
  }
  // 点选：按该视图当前提交的状态求交
  pick(sys, vid, x, y) {
    const v = this.views.get(this.key(sys, vid));
    if (!v || !v.hash) return null;
    const res = this.resFor(v);
    if (!res) return null;
    const c = v.canvas;
    const w = c ? c.clientWidth || 1 : 1, h = c ? c.clientHeight || 1 : 1;
    res.apply(v.frame, w / h);
    v.dirty = true;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x / w * 2 - 1, -(y / h * 2 - 1)), res.camera);
    const hits = ray.intersectObjects(res.pickables.filter((m) => m.visible), false);
    for (const hit of hits) {
      const o = hit.object;
      const pt = [hit.point.x, hit.point.y, hit.point.z];
      if (o.userData.part) return { kind: 'part', name: o.userData.part.name, point: pt };
      if (o.userData.ground) return { kind: 'ground', name: '地面', point: pt };
      if (o.userData.objects) { const ob = o.userData.objects[hit.instanceId]; return { kind: 'object', name: ob ? ob.name : '物体', point: pt }; }
    }
    return null;
  }
}
