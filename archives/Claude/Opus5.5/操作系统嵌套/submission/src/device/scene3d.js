// 三维显示设备（宿主提供）：按程序经系统接口提交的场景资源与逐次场景状态绘制画面。
// - 资源（几何、材质、贴图绘制指令、灯光、环境）与每次提交的状态都是可复制的数据；
// - 设备只按提交的内容和时刻绘制：烟尘、火焰、草叶弯曲、旋翼模糊等细节由提交数据确定性地展开，
//   相同的提交得到相同的画面，两次提交之间画面不变；设备不推进场景状态。
// - 所有三维视图共用一个 WebGL 上下文（逐视图渲染后复制到各自的二维画布），
//   因此同时打开的视图数量不受浏览器上下文上限影响；上下文丢失后按保存的资源与最近一次提交重建。
import * as THREE from '../vendor/three/three.module.js';

const DEG = Math.PI / 180;
const sysOf = (sid) => sid.split(':')[0];

// ---------- 确定性随机 ----------
function hash(a, b) { let h = Math.imul((a * 73856093) ^ (b * 19349663), 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
function terrainH(T, x, z) {
  let h = T.base || 0;
  for (const w of T.waves || []) h += w[0] * Math.sin(w[1] * x + w[2] * z + w[3]);
  for (const f of T.flats || []) {
    const d = Math.hypot(x - f[0], z - f[1]);
    let t = Math.min(1, Math.max(0, (d - f[2]) / f[4])); t = t * t * (3 - 2 * t);
    const k = 1 - t;
    if (k > 0) h = h * (1 - k) + f[3] * k;
  }
  return h;
}

// ---------- 贴图：执行绘制指令 ----------
function paintTexture(def) {
  const c = document.createElement('canvas'); c.width = def.w || 256; c.height = def.h || 256;
  const g = c.getContext('2d');
  for (const op of def.draw || []) {
    const k = op[0];
    if (k === 'fill') { g.fillStyle = op[1]; g.fillRect(0, 0, c.width, c.height); }
    else if (k === 'rect') { g.fillStyle = op[5]; g.fillRect(op[1], op[2], op[3], op[4]); }
    else if (k === 'rrect') { g.fillStyle = op[6]; g.beginPath(); g.roundRect(op[1], op[2], op[3], op[4], op[5]); g.fill(); }
    else if (k === 'circle') { g.fillStyle = op[4]; g.beginPath(); g.arc(op[1], op[2], op[3], 0, Math.PI * 2); g.fill(); }
    else if (k === 'grad') { const gr = g.createLinearGradient(op[1], op[2], op[3], op[4]); for (const [o, col] of op[5]) gr.addColorStop(o, col); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height); }
    else if (k === 'text') {
      const [, str, x, y, size, color, weight, font, rot, stroke, sw] = op;
      g.save(); g.translate(x, y); g.rotate((rot || 0) * DEG);
      g.font = `${weight || 700} ${size}px "${font || 'Segoe UI'}", "Microsoft YaHei", sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (stroke) { g.lineWidth = sw || 4; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(str, 0, 0); }
      g.fillStyle = color; g.fillText(str, 0, 0); g.restore();
    } else if (k === 'noise') {
      const amt = op[1]; const s = op[2] || 1;
      const img = g.getImageData(0, 0, c.width, c.height); const d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (hash(i, s) - 0.5) * 255 * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      g.putImageData(img, 0, 0);
    } else if (k === 'stripes') { g.fillStyle = op[2]; const n = op[1]; for (let i = 0; i < n; i++) g.fillRect((i + 0.5) * c.width / n, 0, 2, c.height); }
    else if (k === 'lines') { g.strokeStyle = op[2]; g.lineWidth = 2; const n = op[1]; for (let i = 0; i <= c.width; i += n) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, c.height); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(c.width, i); g.stroke(); } }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ---------- 几何 ----------
function buildGeometry(d) {
  if (!d) return null;
  let g;
  switch (d.type) {
    case 'box': g = new THREE.BoxGeometry(d.w, d.h, d.d); break;
    case 'cyl': {
      g = new THREE.CylinderGeometry(d.rt, d.rb, d.h, d.seg || 16, 1, !!d.open, d.half ? Math.PI : 0, d.half ? Math.PI : Math.PI * 2);
      if (d.axis === 'x') g.rotateZ(d.flip ? Math.PI / 2 : -Math.PI / 2);
      if (d.axis === 'z') g.rotateX(Math.PI / 2);
      break;
    }
    case 'sphere': g = new THREE.SphereGeometry(d.r, d.ws || 16, d.hs || 12); break;
    case 'disc': g = new THREE.CircleGeometry(d.r, d.seg || 32); break;
    case 'plane': g = new THREE.PlaneGeometry(d.w, d.h); break;
    case 'dodeca': g = new THREE.DodecahedronGeometry(d.r || 1, 0); break;
    case 'mesh': {
      g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
      if (d.nrm) g.setAttribute('normal', new THREE.Float32BufferAttribute(d.nrm, 3));
      if (d.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2));
      if (d.idx) g.setIndex(d.idx);
      if (!d.nrm) g.computeVertexNormals();
      break;
    }
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  return g;
}

// ---------- 粒子（广告牌实例，软边圆斑） ----------
const PARTICLE_VS = `
#include <fog_pars_vertex>
attribute vec4 iPos; attribute vec4 iCol;
varying vec4 vCol; varying vec2 vUv;
void main() {
  vUv = uv; vCol = iCol;
  vec4 mvPosition = modelViewMatrix * vec4(iPos.xyz, 1.0);
  mvPosition.xy += position.xy * iPos.w;
  gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const PARTICLE_FS = `
varying vec4 vCol; varying vec2 vUv;
uniform float uSoft;
void main() {
  vec2 p = vUv - 0.5; float r = length(p) * 2.0;
  float a = 1.0 - smoothstep(uSoft, 1.0, r);
  float n = 0.85 + 0.15 * sin(vUv.x * 23.0 + vUv.y * 17.0);
  if (a * vCol.a < 0.004) discard;
  gl_FragColor = vec4(vCol.rgb * n, a * vCol.a);
  #include <fog_fragment>
}`;
function particleMesh(max, additive) {
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
  const pos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); pos.setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); col.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iPos', pos); g.setAttribute('iCol', col);
  g.instanceCount = 0;
  const m = new THREE.ShaderMaterial({ vertexShader: PARTICLE_VS, fragmentShader: '#include <common>\n#include <fog_pars_fragment>\n' + PARTICLE_FS, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSoft: { value: additive ? 0.0 : 0.15 } }]), transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false; mesh.renderOrder = additive ? 11 : 10;
  return { mesh, pos, col, max, n: 0 };
}

// ---------- 场景实例 ----------
class SceneInst {
  constructor(sid, res, dev) {
    this.sid = sid; this.res = res; this.dev = dev;
    this.layers = { scene: [], fx: [] };
    this.presented = null; this.version = 0; this.lastRendered = -1;
    this.build();
  }
  build() {
    const res = this.res; const env = res.environment || {};
    const scene = this.scene = new THREE.Scene();
    this.parts = new Map(); this.partDefs = new Map(); this.objects = new Map();
    const tex = this.textures = {};
    for (const [k, d] of Object.entries(res.textures || {})) tex[k] = paintTexture(d);
    const mats = this.mats = {};
    for (const [k, d] of Object.entries(res.materials || {})) mats[k] = this.material(d);
    this.matDefault = new THREE.MeshStandardMaterial({ color: 0x9999aa, roughness: 0.6 });
    const geos = this.geos = {};
    for (const [k, d] of Object.entries(res.geometries || {})) geos[k] = buildGeometry(d);
    // 天空与雾
    const sky = env.sky || {};
    const sunDir = new THREE.Vector3(...(env.sun ? env.sun.dir : [0.4, 0.6, 0.3])).normalize();
    this.sunDir = sunDir;
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { top: { value: new THREE.Color(sky.top || '#3a6fb0') }, hor: { value: new THREE.Color(sky.horizon || '#f0b878') }, gnd: { value: new THREE.Color(sky.ground || '#3e3a33') }, glow: { value: new THREE.Color(sky.sunGlow || '#ffd59a') }, sun: { value: sunDir } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w * 0.9999; }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 gnd; uniform vec3 glow; uniform vec3 sun; varying vec3 vDir; void main(){ float y = vDir.y; vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y,0.0,1.0), 0.55)) : mix(hor, gnd, clamp(-y*4.0,0.0,1.0)); float s = max(dot(normalize(vDir), normalize(sun)), 0.0); c += glow * (pow(s, 7.0) * 0.55 + pow(s, 400.0) * 2.5); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
    });
    const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(2600, 32, 16), skyMat);
    skyMesh.renderOrder = -10; skyMesh.frustumCulled = false;
    scene.add(skyMesh);
    this.skyMesh = skyMesh;
    if (env.fog) scene.fog = new THREE.Fog(new THREE.Color(env.fog.color), env.fog.near, env.fog.far);
    // 灯光
    const amb = env.ambient || {};
    scene.add(new THREE.HemisphereLight(new THREE.Color(amb.sky || '#9fbbe8'), new THREE.Color(amb.ground || '#6b5236'), amb.intensity != null ? amb.intensity : 0.6));
    const sun = this.sun = new THREE.DirectionalLight(new THREE.Color(env.sun ? env.sun.color : '#ffffff'), env.sun ? env.sun.intensity : 2.5);
    const sh = (env.sun && env.sun.shadow) || { size: 2048, area: 30, far: 200 };
    sun.castShadow = true;
    sun.shadow.mapSize.set(sh.size, sh.size);
    sun.shadow.camera.left = -sh.area; sun.shadow.camera.right = sh.area; sun.shadow.camera.top = sh.area; sun.shadow.camera.bottom = -sh.area;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = sh.far || 200;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    this.shadowDist = (sh.far || 200) * 0.5;
    scene.add(sun); scene.add(sun.target);
    // 地形
    if (res.terrain) this.buildTerrain(res.terrain);
    // 静态物体与实例
    for (const o of res.objects || []) {
      const geo = typeof o.geo === 'string' ? geos[o.geo] : buildGeometry(o.geo);
      const m = new THREE.Mesh(geo, mats[o.mat] || this.matDefault);
      this.placeObj(m, o);
      m.castShadow = !!o.cast; m.receiveShadow = !!o.receive;
      if (o.windsock) this.sock = m;
      scene.add(m); this.objects.set(o.id, m);
    }
    for (const ins of res.instances || []) {
      const geo = typeof ins.geo === 'string' ? geos[ins.geo] : buildGeometry(ins.geo);
      const im = new THREE.InstancedMesh(geo, mats[ins.mat] || this.matDefault, ins.items.length);
      const mtx = new THREE.Matrix4(); const q = new THREE.Quaternion(); const off = ins.offset || [0, 0, 0];
      ins.items.forEach((it, i) => {
        const s = it[4] || 1;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it[3] || 0);
        mtx.compose(new THREE.Vector3(it[0] + off[0] * s, it[1] + off[1] * s, it[2] + off[2] * s), q, new THREE.Vector3(s, s, s));
        im.setMatrixAt(i, mtx);
      });
      im.castShadow = !!ins.cast; im.receiveShadow = ins.receive !== false;
      im.computeBoundingSphere();
      scene.add(im);
    }
    if (res.grass) this.buildGrass(res.grass);
    // 动态部件层级
    this.rootParts = [];
    for (const p of res.parts || []) {
      this.partDefs.set(p.id, p);
      let o;
      if (p.geo) {
        const geo = typeof p.geo === 'string' ? geos[p.geo] : buildGeometry(p.geo);
        o = new THREE.Mesh(geo, p.blurOf ? (mats[p.mat] || this.matDefault).clone() : (mats[p.mat] || this.matDefault));
        o.castShadow = !!p.cast; o.receiveShadow = p.receive !== false;
      } else o = new THREE.Group();
      o.name = p.id;
      this.setLocal(o, p);
      o.userData.base = { pos: o.position.clone(), quat: o.quaternion.clone(), scale: o.scale.clone() };
      if (p.hidden) o.visible = false;
      this.parts.set(p.id, o);
    }
    for (const p of res.parts || []) {
      const o = this.parts.get(p.id);
      const par = p.parent ? this.parts.get(p.parent) : null;
      if (par) par.add(o); else { scene.add(o); this.rootParts.push(o); }
      o.userData.parent = par || scene;
    }
    // 粒子
    this.pNormal = particleMesh(5000, false); this.pAdd = particleMesh(3000, true);
    scene.add(this.pNormal.mesh); scene.add(this.pAdd.mesh);
    // 环境反射
    this.camera = new THREE.PerspectiveCamera(45, 1.6, 0.3, 5000);
    const cams = res.cameras || {};
    const f = cams.show && cams.show.fixed;
    if (f) { this.camera.position.set(...f.pos); this.camera.lookAt(new THREE.Vector3(...f.look)); this.camera.fov = f.fov || 45; }
    else this.camera.position.set(20, 10, 20);
    this.envDirty = true;
  }
  material(d) {
    const opts = { color: new THREE.Color(d.color || '#ffffff'), roughness: d.rough != null ? d.rough : 0.6, metalness: d.metal != null ? d.metal : 0 };
    if (d.map && this.textures[d.map]) { opts.map = this.textures[d.map]; if (d.repeat) { opts.map = opts.map.clone(); opts.map.wrapS = opts.map.wrapT = THREE.RepeatWrapping; opts.map.repeat.set(d.repeat[0], d.repeat[1]); opts.map.needsUpdate = true; } }
    if (d.emissive) { opts.emissive = new THREE.Color(d.emissive); opts.emissiveIntensity = d.emissiveIntensity || 1; }
    if (d.opacity != null && d.opacity < 1) { opts.transparent = true; opts.opacity = d.opacity; }
    if (d.transparent) opts.transparent = true;
    if (d.depthWrite === false) opts.depthWrite = false;
    if (d.side === 'double') opts.side = THREE.DoubleSide;
    if (d.vertexColors) opts.vertexColors = true;
    if (d.flat) opts.flatShading = true;
    const m = d.clearcoat ? new THREE.MeshPhysicalMaterial({ ...opts, clearcoat: d.clearcoat, clearcoatRoughness: 0.25 }) : new THREE.MeshStandardMaterial(opts);
    if (d.envBoost) m.envMapIntensity = d.envBoost;
    if (d.fog === false) m.fog = false;
    return m;
  }
  setLocal(o, p) {
    if (p.pos) o.position.set(...p.pos);
    if (p.rot) o.rotation.set(p.rot[0] * DEG, p.rot[1] * DEG, p.rot[2] * DEG);
    if (p.scale) { if (Array.isArray(p.scale)) o.scale.set(...p.scale); else o.scale.setScalar(p.scale); }
  }
  placeObj(m, o) { this.setLocal(m, o); }
  buildTerrain(T) {
    const size = T.size || 600, seg = T.seg || 120;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position; const cols = new Float32Array(pos.count * 3);
    const C = T.colors || {}; const cl = new THREE.Color(C.low || '#5c7a33'), chi = new THREE.Color(C.high || '#8b8a55'), cr = new THREE.Color(C.rock || '#7d725f'), cd = new THREE.Color(C.dirt || '#8a6e4b');
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainH(T, x, z);
      pos.setY(i, h);
      const sx = terrainH(T, x + 1, z) - h, sz = terrainH(T, x, z + 1) - h;
      const slope = Math.min(1, Math.hypot(sx, sz) * 1.6);
      tmp.copy(cl).lerp(chi, Math.min(1, Math.max(0, (h + 6) / 24)) * 0.8 + hash(i, 7) * 0.12);
      tmp.lerp(cr, smoothstep(0.35, 0.9, slope));
      let nearPad = 0;
      for (const f of T.flats || []) { const d = Math.hypot(x - f[0], z - f[1]); nearPad = Math.max(nearPad, 1 - smoothstep(f[2] * 0.5, f[2] + 6, d)); }
      tmp.lerp(cd, nearPad * 0.55);
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.mats[T.material] || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    m.receiveShadow = true;
    this.scene.add(m);
    this.terrain = m; this.T = T;
  }
  buildGrass(G) {
    const T = this.res.terrain || { waves: [], flats: [] };
    const blade = new THREE.BufferGeometry();
    // 三段的细长叶片，局部 y 为高度
    const v = [-0.035, 0, 0, 0.035, 0, 0, -0.025, 0.45, 0.01, 0.025, 0.45, 0.01, 0, 1, 0.03];
    blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    blade.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0.3, 1, 0, 0.3, 1, 0, 0.3, 1, 0, 0.3, 1, 0, 0.5, 1], 3));
    blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, vertexColors: false });
    const uniforms = this.grassU = { uDown: { value: new THREE.Vector4(0, -100, 0, 0) }, uWind: { value: new THREE.Vector3(1, 0, 0.5) }, uTime: { value: 0 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = 'uniform vec4 uDown; uniform vec3 uWind; uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float hgt = position.y;
        float sway = sin(uTime * 1.7 + wp.x * 0.35 + wp.z * 0.27) * 0.12 + 0.06;
        vec2 bend = uWind.xz * sway * hgt * hgt;
        vec2 dv = wp.xz - uDown.xz; float dd = length(dv) + 0.001;
        float h = max(0.0, uDown.y - wp.y);
        float push = uDown.w * exp(-dd * 0.11) * exp(-h * 0.12);
        bend += (dv / dd) * push * hgt * hgt * 1.4;
        transformed.xz += (inverse(mat2(instanceMatrix[0].xz, instanceMatrix[2].xz)) * bend);
        transformed.y -= length(bend) * 0.45 * hgt;`);
    };
    const n = G.count || 10000; const im = new THREE.InstancedMesh(blade, mat, n);
    const cols = (G.colors || ['#5d7f31']).map((c) => new THREE.Color(c));
    const mtx = new THREE.Matrix4(); const q = new THREE.Quaternion(); const col = new THREE.Color();
    let k = 0;
    for (let i = 0; k < n && i < n * 4; i++) {
      const area = G.areas[i % G.areas.length];
      const a = hash(i, 11) * Math.PI * 2, r = Math.sqrt(hash(i, 12)) * area[2];
      const x = area[0] + Math.cos(a) * r, z = area[1] + Math.sin(a) * r;
      if ((G.avoid || []).some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
      const hh = G.height[0] + (G.height[1] - G.height[0]) * hash(i, 13);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i, 14) * 6.28);
      mtx.compose(new THREE.Vector3(x, terrainH(T, x, z) - 0.02, z), q, new THREE.Vector3(1.6, hh, 1.6));
      im.setMatrixAt(k, mtx);
      col.copy(cols[Math.floor(hash(i, 15) * cols.length)]).multiplyScalar(0.8 + hash(i, 16) * 0.35);
      im.setColorAt(k, col);
      k++;
    }
    im.count = k;
    im.receiveShadow = true; im.castShadow = false;
    im.frustumCulled = false;
    this.scene.add(im);
    this.grass = im;
  }
  // 设备侧：选择同一时刻的场景层与特效层
  pickFrame() {
    const S = this.layers.scene, F = this.layers.fx;
    if (!S.length) return null;
    const needFx = !!this.res.fx;
    if (!needFx) return { s: S[S.length - 1], f: null };
    for (let i = S.length - 1; i >= 0; i--) {
      const s = S[i];
      const f = F.find((x) => Math.abs(x.t - s.t) < 1e-6);
      if (f) return { s, f };
    }
    const lf = F[F.length - 1];
    const ls = S[S.length - 1];
    // 特效进程落后太多（例如被单独挂起）：各用最新的提交
    if (!lf || lf.t < ls.t - 0.25 || lf.t > ls.t + 0.25) return { s: ls, f: lf || null };
    return this.presented ? { s: this.presented.s, f: this.presented.f } : { s: ls, f: lf };
  }
  applyFrame(fr) {
    if (!fr) return;
    const s = fr.s, f = fr.f;
    // 部件变换
    for (const [id, x] of Object.entries(s.xf || {})) {
      const o = this.parts.get(id); if (!o) continue;
      o.position.set(x[0], x[1], x[2]); o.quaternion.set(x[3], x[4], x[5], x[6]);
    }
    for (const [id, a] of Object.entries(s.spins || {})) {
      const o = this.parts.get(id); const d = this.partDefs.get(id); if (!o || !d || !d.spin) continue;
      o.quaternion.copy(o.userData.base.quat);
      const ax = d.spin.axis === 'x' ? new THREE.Vector3(1, 0, 0) : d.spin.axis === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      o.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(ax, a));
    }
    // 脱落的部件（碎片）放到世界坐标
    const det = s.detached || {};
    for (const [id, o] of this.parts) {
      const d = this.partDefs.get(id);
      if (det[id]) {
        if (o.parent !== this.scene) this.scene.add(o);
        const x = det[id];
        o.position.set(x[0], x[1], x[2]); o.quaternion.set(x[3], x[4], x[5], x[6]); o.scale.copy(o.userData.base.scale);
        o.visible = true;
        if (d.spin) { /* 脱落后不再旋转 */ }
      } else {
        if (o.parent !== o.userData.parent && o.userData.parent) { o.userData.parent.add(o); o.position.copy(o.userData.base.pos); o.quaternion.copy(o.userData.base.quat); }
        if (d.hidden) o.visible = false;
      }
    }
    for (const id of s.hide || []) { const o = this.parts.get(id); if (o) o.visible = false; }
    // 旋翼模糊
    const rpm = s.rpm || 0;
    for (const [id, d] of this.partDefs) {
      if (!d.blurOf) continue;
      const o = this.parts.get(id);
      const a = d.blurOf === 'trot' ? (s.trpm != null ? s.trpm : rpm) : rpm;
      o.material.opacity = Math.max(0, Math.min(0.42, (a - 0.3) * 0.75));
      o.visible = o.material.opacity > 0.01 && !(det[d.parent]);
    }
    // 机身损伤：烧焦变暗
    const dmg = s.damage || 0;
    if (this.mats.body) this.mats.body.color.setScalar(1 - dmg * 0.55);
    if (this.mats.boom) this.mats.boom.color.setScalar(1 - dmg * 0.5);
    for (const [id, d] of this.partDefs) if (d.blink) { const o = this.parts.get(id); o.material.emissiveIntensity = (Math.sin(s.t * Math.PI * 2 / d.blink) > 0.6 && !s.crashed) ? 4 : 0.2; }
    // 关键帧部件的局部变换
    for (const [id, x] of Object.entries(s.local || {})) {
      const o = this.parts.get(id); if (!o) continue;
      if (x.pos) o.position.set(...x.pos);
      if (x.rot) o.rotation.set(x.rot[0] * DEG, x.rot[1] * DEG, x.rot[2] * DEG);
      if (x.scale) o.scale.set(...x.scale);
    }
    // 相机
    if (s.cam) { this.camPos = s.cam.pos; this.camLook = s.cam.look; this.camFov = s.cam.fov || 45; }
    // 阴影跟随
    const at = s.shadowAt || (s.cam && s.cam.look) || [0, 0, 0];
    this.sun.target.position.set(at[0], at[1], at[2]);
    this.sun.position.set(at[0] + this.sunDir.x * this.shadowDist, at[1] + this.sunDir.y * this.shadowDist, at[2] + this.sunDir.z * this.shadowDist);
    // 特效
    this.applyFx(f, s.t);
    this.presented = fr;
  }
  applyFx(f, t) {
    const PN = this.pNormal, PA = this.pAdd;
    PN.n = 0; PA.n = 0;
    if (this.grassU) this.grassU.uTime.value = t;
    if (!f) { PN.mesh.geometry.instanceCount = 0; PA.mesh.geometry.instanceCount = 0; return; }
    const FX = this.res.fx || {};
    const wind = f.wind || [0, 0];
    if (this.grassU) {
      this.grassU.uWind.value.set(wind[0] * 0.25, 0, wind[1] * 0.25);
      const d = f.downwash || [0, -100, 0, 0];
      this.grassU.uDown.value.set(d[0], d[1], d[2], d[3]);
    }
    if (this.sock) { this.sock.rotation.set(0, Math.atan2(-wind[1], wind[0]), 0); }
    const pushN = (x, y, z, size, r, g, b, a) => { if (PN.n >= PN.max || a <= 0.003) return; const i = PN.n++; PN.pos.array.set([x, y, z, size], i * 4); PN.col.array.set([r, g, b, a], i * 4); };
    const pushA = (x, y, z, size, r, g, b, a) => { if (PA.n >= PA.max || a <= 0.003) return; const i = PA.n++; PA.pos.array.set([x, y, z, size], i * 4); PA.col.array.set([r, g, b, a], i * 4); };
    const T = this.res.terrain;
    const col = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    const dustC = col((FX.dust || {}).color || '#c9a77c');
    const smokeC = col((FX.smoke || {}).color || '#3a3532');
    const fsC = col((FX.faultSmoke || {}).color || '#5b5652');
    for (const b of f.bursts || []) {
      const [kind, t0, x, y, z, strength, seed, vx, vy, vz] = b;
      const age0 = t - t0;
      if (age0 < 0) continue;
      if (kind === 'dust') {
        const cfg = FX.dust || {}; const life = cfg.life || 2.5; if (age0 > life) continue;
        const n = Math.round((cfg.count || 12) * Math.min(1.6, strength));
        for (let i = 0; i < n; i++) {
          const a = hash(seed, i) * Math.PI * 2; const sp = (4 + hash(seed, i + 50) * 9) * Math.min(1.5, strength);
          const k = 1.5; const rr = sp / k * (1 - Math.exp(-k * age0));
          const px = x + Math.cos(a) * rr + wind[0] * age0 * 0.7, pz = z + Math.sin(a) * rr + wind[1] * age0 * 0.7;
          const gy = T ? terrainH(T, px, pz) : y;
          const py = Math.max(gy + 0.2, y) + 0.3 + (0.4 + hash(seed, i + 9) * 1.4) * age0 * Math.exp(-0.4 * age0);
          const u = age0 / life; const sz = (cfg.size ? cfg.size[0] + (cfg.size[1] - cfg.size[0]) * u : 2) * (0.7 + hash(seed, i + 3) * 0.6);
          pushN(px, py, pz, sz, dustC[0], dustC[1], dustC[2], 0.42 * Math.pow(1 - u, 1.4) * Math.min(1, age0 * 6) * Math.min(1, strength));
        }
      } else if (kind === 'fsmoke') {
        const cfg = FX.faultSmoke || {}; const life = cfg.life || 2; if (age0 > life) continue;
        for (let i = 0; i < (cfg.count || 3); i++) {
          const k = 0.9; const dmp = (1 - Math.exp(-k * age0)) / k;
          const px = x + (vx || 0) * dmp + wind[0] * age0 + (hash(seed, i) - 0.5) * age0 * 1.2;
          const py = y + (vy || 0) * dmp + (cfg.rise || 0.8) * age0 + (hash(seed, i + 7) - 0.5) * 0.4;
          const pz = z + (vz || 0) * dmp + wind[1] * age0 + (hash(seed, i + 3) - 0.5) * age0 * 1.2;
          const u = age0 / life; const sz = (cfg.size ? cfg.size[0] + (cfg.size[1] - cfg.size[0]) * u : 1);
          pushN(px, py, pz, sz, fsC[0], fsC[1], fsC[2], 0.55 * (1 - u) * strength);
        }
      } else if (kind === 'flash') {
        const cfg = FX.flash || {}; const life = cfg.life || 0.9; if (age0 > life) continue;
        const u = age0 / life;
        for (let i = 0; i < (cfg.count || 20); i++) {
          const a = hash(seed, i) * 6.28, e = hash(seed, i + 40) * 1.4 - 0.2, sp = (5 + hash(seed, i + 80) * 9) * (1 - Math.exp(-3 * age0)) / 3 * 3;
          const px = x + Math.cos(a) * Math.cos(e) * sp, py = y + 0.8 + Math.sin(e) * sp + age0 * 2, pz = z + Math.sin(a) * Math.cos(e) * sp;
          const sz = (cfg.size ? cfg.size[0] + (cfg.size[1] - cfg.size[0]) * Math.sqrt(u) : 6) * (0.6 + hash(seed, i + 5) * 0.7);
          const heat = 1 - u;
          pushA(px, py, pz, sz, 1, 0.45 + 0.35 * heat, 0.08 + 0.3 * heat * heat, 0.5 * Math.pow(1 - u, 1.8));
        }
        // 撞击扬尘
        for (let i = 0; i < 26; i++) {
          const a = hash(seed, i + 300) * 6.28; const k = 1.2; const sp = 7 + hash(seed, i + 340) * 10; const rr = sp / k * (1 - Math.exp(-k * age0 * 1.5));
          const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; const py = (T ? terrainH(T, px, pz) : y) + 0.6 + age0 * 1.2;
          pushN(px, py, pz, 3 + u * 6, dustC[0] * 0.9, dustC[1] * 0.85, dustC[2] * 0.8, 0.5 * (1 - u));
        }
      } else if (kind === 'sparks') {
        const cfg = FX.sparks || {}; const life = cfg.life || 1.5;
        for (let i = 0; i < (cfg.count || 30); i++) {
          const lf = life * (0.5 + hash(seed, i + 9) * 0.5); if (age0 > lf) continue;
          const a = hash(seed, i) * 6.28, up = 4 + hash(seed, i + 2) * 9, sp = 3 + hash(seed, i + 4) * 8;
          const px = x + Math.cos(a) * sp * age0, pz = z + Math.sin(a) * sp * age0;
          const py = Math.max(T ? terrainH(T, px, pz) + 0.05 : 0, y + up * age0 - 4.9 * age0 * age0);
          pushA(px, py, pz, 0.28, 1, 0.8, 0.35, 1 - age0 / lf);
        }
      }
    }
    for (const e of f.emitters || []) {
      const [kind, t0, t1, x, y, z, rate, seed, strength] = e;
      if (t < t0) continue;
      const cfg = kind === 'fire' ? (FX.fire || {}) : (FX.smoke || {});
      const life = cfg.life || 3;
      const tEnd = Math.min(t, t1 == null ? t : t1);
      const jMin = Math.max(0, Math.ceil((t - life - t0) * rate));
      const jMax = Math.floor((tEnd - t0) * rate);
      const k = strength == null ? 1 : strength;
      for (let j = jMin; j <= jMax; j++) {
        const tj = t0 + j / rate; const age = t - tj; if (age < 0 || age > life) continue;
        const u = age / life;
        const jx = (hash(seed, j) - 0.5) * 1.6, jz = (hash(seed, j + 999) - 0.5) * 1.6;
        if (kind === 'fire') {
          const px = x + jx * (1 - u) + wind[0] * age * 0.35, py = y + (cfg.rise || 3) * age + hash(seed, j + 5) * 0.3, pz = z + jz * (1 - u) + wind[1] * age * 0.35;
          const sz = (cfg.size ? cfg.size[0] + (cfg.size[1] - cfg.size[0]) * Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.6) : 2) * k;
          pushA(px, py, pz, sz, 1, 0.42 + 0.45 * (1 - u), 0.08 + 0.2 * (1 - u) * (1 - u), 0.85 * (1 - u) * k);
        } else {
          const rise = (cfg.rise || 2.5) * age;
          const px = x + jx * 0.5 + wind[0] * age * 0.9 + Math.sin(age * 0.8 + j) * 0.4 * age, py = y + 1 + rise, pz = z + jz * 0.5 + wind[1] * age * 0.9 + Math.cos(age * 0.7 + j) * 0.4 * age;
          const sz = (cfg.size ? cfg.size[0] + (cfg.size[1] - cfg.size[0]) * u : 3) * k;
          const g = 0.75 + 0.5 * u;
          pushN(px, py, pz, sz, smokeC[0] * g, smokeC[1] * g, smokeC[2] * g, 0.42 * Math.pow(1 - u, 1.1) * Math.min(1, age * 2.5) * k);
        }
      }
    }
    PN.mesh.geometry.instanceCount = PN.n; PA.mesh.geometry.instanceCount = PA.n;
    PN.pos.needsUpdate = true; PN.col.needsUpdate = true; PA.pos.needsUpdate = true; PA.col.needsUpdate = true;
  }
  dispose() {
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => m.dispose()); } });
    for (const t of Object.values(this.textures)) t.dispose();
    if (this.envRT) this.envRT.dispose();
  }
}
function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

export class Scene3D {
  constructor(device) {
    this.device = device; this.scenes = new Map(); this.views = new Map();
    this.renderer = null; this.lost = false; this.pending = false; this.frameCount = 0;
  }
  ensureRenderer() {
    if (this.renderer) return this.renderer;
    const canvas = document.createElement('canvas');
    canvas.width = 1920; canvas.height = 1080;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.35;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.autoClear = true;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => {
      // 上下文恢复：按保存的资源与最近一次提交重建全部场景
      this.lost = false;
      for (const [sid, inst] of [...this.scenes]) { const layers = inst.layers; inst.dispose(); const ni = new SceneInst(sid, inst.res, this); ni.layers = layers; this.scenes.set(sid, ni); }
      this.kick();
    });
    this.renderer = r;
    this.pmrem = new THREE.PMREMGenerator(r);
    window.__nestGL = { renderer: r, lose: () => r.getContext().getExtension('WEBGL_lose_context') };
    return r;
  }
  op(op, sid, data) {
    if (op === 'load') {
      const old = this.scenes.get(sid); if (old) old.dispose();
      try { this.ensureRenderer(); const inst = new SceneInst(sid, data, this); this.scenes.set(sid, inst); }
      catch (e) { console.error('scene load failed', e); }
      this.kick();
    } else if (op === 'frame') {
      const inst = this.scenes.get(sid);
      if (!inst || !data) return;
      const L = inst.layers[data.layer === 'fx' ? 'fx' : 'scene'];
      // 跳转后时间可能变小：清掉不连续的旧提交
      if (data.reset) { inst.layers.scene = []; inst.layers.fx = []; }
      const LL = inst.layers[data.layer === 'fx' ? 'fx' : 'scene'];
      LL.push(data); while (LL.length > 8) LL.shift();
      void L;
      inst.version++;
      this.kick();
    } else if (op === 'drop') {
      const inst = this.scenes.get(sid); if (inst) { inst.dispose(); this.scenes.delete(sid); }
    }
  }
  attachCanvas(canvas, sceneId, w, h, node) {
    let v = this.views.get(canvas);
    const dpr = Math.min(2, window.devicePixelRatio || 1) * (this.device.zoomHint || 1);
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    if (!v) { v = { canvas, ctx: canvas.getContext('2d'), sceneId, w: 0, h: 0, drawn: -1 }; this.views.set(canvas, v); }
    if (v.sceneId !== sceneId) { v.sceneId = sceneId; v.drawn = -1; }
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; v.drawn = -1; }
    v.w = w; v.h = h; v.pw = pw; v.ph = ph;
    this.kick();
  }
  detachCanvas(c) { this.views.delete(c); }
  detachSurface(el) { for (const c of el.querySelectorAll ? el.querySelectorAll('canvas') : []) this.views.delete(c); }
  dropSystems(ids) { for (const [sid, inst] of [...this.scenes]) if (ids.has(sysOf(sid))) { inst.dispose(); this.scenes.delete(sid); } }
  capture(ids) {
    const out = [];
    for (const [sid, inst] of this.scenes) if (ids.has(sysOf(sid))) out.push([sid, inst.res, { scene: inst.layers.scene.slice(-1), fx: inst.layers.fx.slice(-1) }]);
    return out;
  }
  restore(list) {
    for (const [sid, res, layers] of list) {
      this.op('load', sid, res);
      const inst = this.scenes.get(sid);
      if (inst && layers) { inst.layers.scene = layers.scene || []; inst.layers.fx = layers.fx || []; }
    }
    this.kick();
  }
  presentedTime(sid) { const inst = this.scenes.get(sid); return inst && inst.presented ? inst.presented.s.t : null; }
  kick() {
    if (this.pending) return;
    this.pending = true;
    // 不依赖 requestAnimationFrame（窗口被遮挡时它可能停止）
    setTimeout(() => { this.pending = false; this.renderAll(); }, 0);
  }
  renderAll() {
    if (this.lost) return;
    const r = this.ensureRenderer();
    // 每个场景每轮只应用一次最新的同时刻提交
    const applied = new Set();
    for (const v of this.views.values()) {
      if (!v.canvas.isConnected) { this.views.delete(v.canvas); continue; }
      const inst = this.scenes.get(v.sceneId);
      if (!inst) { this.placeholder(v, '等待场景数据…'); continue; }
      if (!applied.has(inst)) {
        if (inst.lastRendered !== inst.version) { inst.applyFrame(inst.pickFrame()); inst.lastRendered = inst.version; inst.renderStamp = (inst.renderStamp || 0) + 1; }
        applied.add(inst);
      }
      if (v.drawn === inst.renderStamp && v.drawnScene === inst) continue;
      this.renderView(r, inst, v);
      v.drawn = inst.renderStamp; v.drawnScene = inst;
    }
  }
  renderView(r, inst, v) {
    const pw = v.pw, ph = v.ph;
    const cw = r.domElement.width, ch = r.domElement.height;
    if (cw < pw || ch < ph) r.setSize(Math.max(cw, pw), Math.max(ch, ph), false);
    const H = r.domElement.height;
    if (inst.envDirty) {
      try { const sc = new THREE.Scene(); sc.add(inst.skyMesh.clone()); inst.envRT = this.pmrem.fromScene(sc, 0.02); inst.scene.environment = inst.envRT.texture; } catch {}
      inst.envDirty = false;
    }
    const cam = inst.camera;
    cam.aspect = v.w / Math.max(1, v.h);
    if (inst.camPos) { cam.position.set(...inst.camPos); cam.lookAt(new THREE.Vector3(...inst.camLook)); cam.fov = inst.camFov; }
    cam.updateProjectionMatrix();
    r.setViewport(0, 0, pw / r.getPixelRatio(), ph / r.getPixelRatio());
    r.setScissor(0, 0, pw, ph); r.setScissorTest(false);
    r.render(inst.scene, cam);
    try { v.ctx.drawImage(r.domElement, 0, H - ph, pw, ph, 0, 0, pw, ph); } catch (e) { void e; }
    this.frameCount++;
  }
  placeholder(v, text) {
    const g = v.ctx; g.fillStyle = '#0b0f1a'; g.fillRect(0, 0, v.canvas.width, v.canvas.height);
    g.fillStyle = '#7f8aa3'; g.font = `${Math.round(14 * (v.pw / v.w))}px "Microsoft YaHei UI"`; g.textAlign = 'center'; g.fillText(text, v.canvas.width / 2, v.canvas.height / 2);
  }
}
