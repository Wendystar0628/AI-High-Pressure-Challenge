/* ============================================================
 * 三维场景渲染：一个共享 WebGL 上下文 → 逐个视图渲染 → 2D 画布呈现
 * 这样同时打开的嵌套/投送三维视图不会触发 Chromium 的 WebGL 上下文上限。
 * ============================================================ */
import * as THREE from 'three';
import { rt } from './store.js';
import { sceneForPlayer, computeShowFrame } from './services.js';
import { groundAt, terrainHeight } from './terrain.js';
import { clamp, mulberry32, hashStr } from './util.js';

const views = new Set();
let sharedRenderer = null;
let raf = null;
let fallbackTimer = null;
let lastRenderAt = 0;
const cache = new Map(); // playerKey -> scene cache

function playerKey(sysId, winId) { return sysId + '|' + winId; }

export function registerView(opts) {
  const token = {
    id: 'v' + Math.random().toString(36).slice(2, 9),
    canvas: opts.canvas,
    sysId: opts.sysId,
    winId: opts.winId,
    kind: opts.kind || 'player',
    lastCam: null,
    w: 0, h: 0,
    visible: true
  };
  views.add(token);
  ensureLoop();
  return token;
}
export function unregisterView(token) {
  if (!token) return;
  views.delete(token);
  if (!views.size) { stopLoop(); }
}
function stopLoop() {
  if (raf) { cancelAnimationFrame(raf); raf = null; }
  if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
}
function ensureLoop() {
  if (!raf) {
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      if (t - lastRenderAt < 1000 / 45) return; // 限帧，留出逻辑预算
      lastRenderAt = t;
      renderAll(t / 1000);
    };
    raf = requestAnimationFrame(loop);
  }
  if (!fallbackTimer) {
    fallbackTimer = setInterval(() => {
      if (!views.size) return;
      if (document.hidden || performance.now() - lastRenderAt > 450) {
        lastRenderAt = performance.now();
        renderAll(performance.now() / 1000);
      }
    }, 280);
  }
}

function ensureRenderer() {
  if (sharedRenderer) return sharedRenderer;
  try {
    const canvas = document.createElement('canvas');
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.2;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('WebGL 上下文丢失，将从系统状态重建');
      try { r.dispose(); } catch (err) {}
      sharedRenderer = null;
    }, false);
    sharedRenderer = r;
    return r;
  } catch (e) {
    console.warn('WebGL 初始化失败', e);
    return null;
  }
}

let blurDiscTex = null;
function makeBlurDiscTexture() {
  return makeCanvasTexture((ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2;
    const g = ctx.createRadialGradient(cx, cy, s * .05, cx, cy, s * .5);
    g.addColorStop(0, 'rgba(190,200,220,0)');
    g.addColorStop(.32, 'rgba(180,190,210,.05)');
    g.addColorStop(.55, 'rgba(170,180,205,.16)');
    g.addColorStop(.78, 'rgba(160,170,195,.10)');
    g.addColorStop(1, 'rgba(150,160,190,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, s * .5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .16; ctx.strokeStyle = '#cfd8ea'; ctx.lineWidth = 3;
    for (const r of [.15, .27, .4, .47]) { ctx.beginPath(); ctx.arc(cx, cy, s * r, 0, Math.PI * 2); ctx.stroke(); }
  }, 256);
}

function makeCanvasTexture(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function particleTexture(kind) {
  return makeCanvasTexture((ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    if (kind === 'smoke') {
      g.addColorStop(0, 'rgba(215,220,230,.85)'); g.addColorStop(.45, 'rgba(145,150,165,.5)'); g.addColorStop(1, 'rgba(100,105,120,0)');
    } else if (kind === 'fire') {
      g.addColorStop(0, 'rgba(255,245,190,1)'); g.addColorStop(.3, 'rgba(255,180,70,.85)'); g.addColorStop(.65, 'rgba(255,90,30,.4)'); g.addColorStop(1, 'rgba(255,50,0,0)');
    } else {
      g.addColorStop(0, 'rgba(232,214,180,.85)'); g.addColorStop(.5, 'rgba(200,178,140,.35)'); g.addColorStop(1, 'rgba(190,170,130,0)');
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  }, 128);
}
let dustTex = null, smokeTex = null, fireTex = null;

function buildSky(scene, env) {
  const geo = new THREE.SphereGeometry(380, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(env.skyTop || '#050b1e') },
      bottom: { value: new THREE.Color(env.skyBottom || '#6c7c97') },
      horizon: { value: new THREE.Color(env.horizonColor || '#d9b98e') }
    },
    vertexShader: `varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 horizon; varying vec3 vP;
      void main(){ float h = normalize(vP).y; vec3 c = mix(bottom, top, smoothstep(0.0,0.55,h));
      c = mix(horizon, c, smoothstep(-0.02,0.16,h)); gl_FragColor = vec4(c,1.0); }`
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  scene.add(sky);
  // 星空
  const rnd = mulberry32(4451);
  const N = 380;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.9 + 0.05);
    const r = 350;
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    pos[i * 3 + 1] = Math.cos(ph) * r;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfeaff, size: 1.1, sizeAttenuation: false, transparent: true, opacity: .75, fog: false }));
  stars.frustumCulled = false;
  scene.add(stars);
  // 太阳
  const sunDir = new THREE.Vector3(...(env.sun && env.sun.dir || [-.4, .6, .4])).normalize();
  const sunTex = makeCanvasTexture((ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(.12, 'rgba(255,235,180,1)'); g.addColorStop(.35, 'rgba(255,200,120,.5)'); g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  }, 256);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  sun.position.copy(sunDir.clone().multiplyScalar(320));
  sun.scale.set(95, 95, 1);
  scene.add(sun);
}

function buildingTexture(env, b) {
  return makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = '#0c111a'; ctx.fillRect(0, 0, s, s);
    const cols = Math.max(2, Math.floor(b.w / 2.2)), rows = Math.max(3, Math.floor(b.h / 2.0));
    const rnd = mulberry32(hashStr(`b${b.x}${b.z}`));
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const lit = rnd() > 0.55;
      ctx.fillStyle = lit ? (rnd() > .5 ? '#ffd98a' : '#9fd8ff') : '#1b2432';
      ctx.globalAlpha = lit ? 0.85 : 0.8;
      const w = s / cols, h = s / rows;
      ctx.fillRect(x * w + w * 0.22, y * h + h * 0.22, w * 0.5, h * 0.36);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(120,150,190,.15)'; ctx.lineWidth = 2;
    for (let i = 1; i < rows; i++) { ctx.beginPath(); ctx.moveTo(0, i * s / rows); ctx.lineTo(s, i * s / rows); ctx.stroke(); }
  }, 256);
}

function buildEnvironment(scene, env) {
  const pads = env.pads || [];
  // 地形
  const size = env.terrain?.size || 420;
  const seg = env.terrain?.segments || 128;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(env.terrain?.color || '#1d2b2b');
  const cRock = new THREE.Color(env.terrain?.rock || '#26333c');
  const cSand = new THREE.Color('#6b6246');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = groundAt(pads, x, z);
    pos.setY(i, h);
    const slope = Math.abs(terrainHeight(x + 2, z) - terrainHeight(x - 2, z)) + Math.abs(terrainHeight(x, z + 2) - terrainHeight(x, z - 2));
    const c = cGrass.clone().lerp(cRock, clamp(slope * 0.15, 0, 1));
    if (h < (env.water?.level || -5) + 1.2) c.lerp(cSand, 0.65);
    c.offsetHSL(0, 0, (Math.sin(x * 0.2) + Math.cos(z * 0.23)) * 0.008);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const terrain = new THREE.Mesh(geo, mat);
  terrain.receiveShadow = true;
  terrain.name = 'terrain';
  scene.add(terrain);
  // 水面
  if (env.water) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: env.water.color || '#163145', transparent: true, opacity: env.water.opacity ?? .86, roughness: .16, metalness: .35 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = env.water.level ?? -5;
    scene.add(water);
  }
  // 停机坪
  for (const pad of pads) {
    const grp = new THREE.Group();
    grp.position.set(pad.x, pad.y + 0.06, pad.z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(pad.radius, pad.radius + .4, .35, 48),
      new THREE.MeshStandardMaterial({ color: pad.color || '#22262e', roughness: .85, metalness: .2 }));
    disc.receiveShadow = true;
    grp.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(pad.radius * .72, .12, 8, 64),
      new THREE.MeshStandardMaterial({ color: pad.ring || '#ffd166', emissive: pad.ring || '#ffd166', emissiveIntensity: .65, roughness: .4 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .2;
    grp.add(ring);
    const crossMat = new THREE.MeshStandardMaterial({ color: pad.ring || '#ffd166', emissive: pad.ring || '#ffd166', emissiveIntensity: .3 });
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(pad.radius * 1.1, .03, .28), crossMat); bar1.position.y = .21; grp.add(bar1);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(.28, .03, pad.radius * 1.1), crossMat); bar2.position.y = .21; grp.add(bar2);
    if (pad.label) {
      const tex = makeCanvasTexture((ctx, s) => {
        ctx.clearRect(0, 0, s, s); ctx.fillStyle = 'rgba(255,209,102,.9)';
        ctx.font = `900 ${Math.floor(s * .62)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(pad.label, s / 2, s / 2 + 8);
      }, 128);
      const lm = new THREE.Mesh(new THREE.PlaneGeometry(pad.radius * .7, pad.radius * .7),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      lm.rotation.x = -Math.PI / 2; lm.position.y = .23; grp.add(lm);
    }
    // 边灯
    const lightMat = new THREE.MeshStandardMaterial({ color: '#fff2b8', emissive: '#ffd166', emissiveIntensity: 2.4 });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), lightMat);
      l.position.set(Math.cos(a) * (pad.radius - .4), .27, Math.sin(a) * (pad.radius - .4));
      grp.add(l);
    }
    const flood = new THREE.PointLight(new THREE.Color(pad.ring || '#ffd166'), 18, 38, 2);
    flood.position.set(pad.x + pad.radius * .6, pad.y + 7, pad.z + pad.radius * .6);
    scene.add(flood);
    scene.add(grp);
  }
  // 建筑
  for (const b of env.buildings || []) {
    const tex = buildingTexture(env, b);
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: '#ffffff', roughness: .8, metalness: .2, emissive: '#6a7fa8', emissiveMap: tex, emissiveIntensity: .22 });
    const dark = new THREE.MeshStandardMaterial({ color: b.color || '#232b36', roughness: .9 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), [dark, dark, dark, dark, mat, mat]);
    mesh.position.set(b.x, groundAt(pads, b.x, b.z) + b.h / 2, b.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w * .5, .6, b.d * .5), dark);
    roof.position.set(b.x, mesh.position.y + b.h / 2 + .3, b.z);
    scene.add(roof);
  }
  // 树木（实例化）
  const treeData = env.trees || { count: 100, seed: 7, minR: 26, maxR: 160 };
  const rnd = mulberry32(treeData.seed || 7);
  const n = Math.min(260, treeData.count || 100);
  const trunkGeo = new THREE.CylinderGeometry(.22, .34, 4, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#3a2c25', roughness: 1 });
  const leafGeo = new THREE.ConeGeometry(2.2, 6.5, 8);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#183a2c', roughness: .95 });
  const trunkIM = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
  const leafIM = new THREE.InstancedMesh(leafGeo, leafMat, n);
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < n * 3 && placed < n; i++) {
    const a = rnd() * Math.PI * 2, r = (treeData.minR || 24) + rnd() * ((treeData.maxR || 160) - (treeData.minR || 24));
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (pads.some(p => Math.hypot(x - p.x, z - p.z) < (p.radius || 9) + 8)) continue;
    if (Math.abs(x) < 25 && Math.abs(z) < 25) continue;
    const y = groundAt(pads, x, z);
    const s = .7 + rnd() * .9;
    dummy.position.set(x, y + 2 * s, z); dummy.scale.set(s, s, s); dummy.rotation.set(0, rnd() * 6, 0);
    dummy.updateMatrix(); trunkIM.setMatrixAt(placed, dummy.matrix);
    dummy.position.set(x, y + 6.5 * s, z); dummy.scale.set(s, s, s);
    dummy.updateMatrix(); leafIM.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  trunkIM.count = placed; leafIM.count = placed;
  trunkIM.castShadow = true; leafIM.castShadow = true; leafIM.receiveShadow = true;
  scene.add(trunkIM, leafIM);
  // 岩石
  const rocks = env.rocks || { count: 24, seed: 9 };
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: '#3a4046', roughness: 1 });
  const rockIM = new THREE.InstancedMesh(rockGeo, rockMat, rocks.count || 24);
  const rr = mulberry32(rocks.seed || 9);
  for (let i = 0; i < (rocks.count || 24); i++) {
    const a = rr() * Math.PI * 2, r = 22 + rr() * 130;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = groundAt(pads, x, z);
    const s = .5 + rr() * 2.2;
    dummy.position.set(x, y + s * .3, z); dummy.scale.set(s, s * .7, s); dummy.rotation.set(rr(), rr() * 6, rr());
    dummy.updateMatrix(); rockIM.setMatrixAt(i, dummy.matrix);
  }
  rockIM.castShadow = true; rockIM.receiveShadow = true;
  scene.add(rockIM);
  // 草丛
  const grass = env.grass || { count: 400, seed: 5, radius: 60 };
  const grassGeo = new THREE.ConeGeometry(.08, .55, 3);
  const grassMat = new THREE.MeshStandardMaterial({ color: '#2d4a30', roughness: 1 });
  const grassIM = new THREE.InstancedMesh(grassGeo, grassMat, Math.min(1600, grass.count || 400));
  const gr = mulberry32(grass.seed || 5);
  for (let i = 0; i < grassIM.count; i++) {
    const a = gr() * Math.PI * 2, r = 6 + gr() * (grass.radius || 60);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = groundAt(pads, x, z);
    dummy.position.set(x, y + .25, z); dummy.scale.set(1, 1 + gr(), 1); dummy.rotation.set(0, gr() * 6, 0);
    dummy.updateMatrix(); grassIM.setMatrixAt(i, dummy.matrix);
  }
  scene.add(grassIM);
  return terrain;
}

function makeMaterial(m, overrides = {}) {
  const def = m || {};
  const isGlass = def.transparent;
  const physical = (def.clearcoat != null || isGlass);
  const params = {
    color: new THREE.Color(def.color || '#888888'),
    roughness: def.roughness ?? .55,
    metalness: def.metalness ?? .25,
    transparent: !!def.transparent,
    opacity: def.opacity ?? 1,
    side: THREE.FrontSide,
    emissive: new THREE.Color(def.emissive || '#000000'),
    emissiveIntensity: def.emissiveIntensity || 0
  };
  if (physical) { params.clearcoat = def.clearcoat ?? 0; params.clearcoatRoughness = .25; }
  const mat = physical ? new THREE.MeshPhysicalMaterial(params) : new THREE.MeshStandardMaterial(params);
  if (isGlass) { mat.depthWrite = false; mat.side = THREE.DoubleSide; }
  return mat;
}

function buildHelicopter(scene, model) {
  const group = new THREE.Group();
  group.name = 'helicopter';
  const mats = {};
  for (const [k, v] of Object.entries(model.materials || {})) mats[k] = makeMaterial(v);
  const body = new THREE.Group(); body.name = 'body';
  const glass = new THREE.Group(); glass.name = 'glass';
  const tail = new THREE.Group(); tail.name = 'tail';
  const skid = new THREE.Group(); skid.name = 'skid';
  const rotor = new THREE.Group(); rotor.name = 'rotor';
  const tailRotor = new THREE.Group(); tailRotor.name = 'tailRotor';
  const blur = new THREE.Group(); blur.name = 'rotorBlur';
  group.add(body, glass, tail, skid, rotor, tailRotor, blur);
  const parts = [];
  const fragMeshes = [];
  let rotorSpin = null, tailRotorSpin = null;
  for (const part of model.parts || []) {
    const mat = mats[part.material] || mats.dark || makeMaterial({ color: part.color || '#777' });
    const g = part.geometry || [1, 1, 1];
    let geo = null;
    if (part.type === 'ellipsoid') { geo = new THREE.SphereGeometry(1, 28, 20); }
    else if (part.type === 'box') geo = new THREE.BoxGeometry(g[0], g[1], g[2]);
    else if (part.type === 'cylinder') geo = new THREE.CylinderGeometry(g[0], g[1], g[2], 24);
    else if (part.type === 'cone') geo = new THREE.ConeGeometry(g[0], g[1], 20);
    else if (part.type === 'disc') geo = new THREE.CircleGeometry(g[0], g[1] || 48);
    else if (part.type === 'blade' || part.type === 'skid') geo = null; // 特殊处理
    const targetGroup = part.group === 'glass' ? glass : part.group === 'tail' ? tail : part.group === 'skid' ? skid
      : part.group === 'rotor' ? rotor : part.group === 'tailRotor' ? tailRotor : part.group === 'rotorBlur' ? blur : body;
    if (part.type === 'blade') {
      if (part.tip) continue;
      const pivot = new THREE.Group();
      if (part.group === 'rotor') rotorSpin = pivot; else if (part.group === 'tailRotor') tailRotorSpin = pivot;
      pivot.position.set(...(part.pivot || part.pos || [0, 0, 0]));
      targetGroup.add(pivot);
      const axis = part.axis || 'y';
      const count = Math.max(2, part.count || 2);
      const isTail = part.group === 'tailRotor';
      const bw = isTail ? g[0] : g[0];
      const bl = isTail ? g[2] : g[2];
      const bt = isTail ? g[1] : g[1];
      const shape = new THREE.BoxGeometry(isTail ? g[1] : g[0], isTail ? g[2] : g[1], isTail ? g[0] : g[2]);
      if (isTail) {
        // blade 长度沿 Y，绕 X 分布
        shape.dispose();
        const bg = new THREE.BoxGeometry(g[0], g[2], g[1]);
        for (let i = 0; i < count; i++) {
          const holder = new THREE.Group(); holder.rotation.x = i / count * Math.PI * 2;
          const mesh = new THREE.Mesh(bg, mat);
          mesh.position.y = g[2] / 2;
          mesh.castShadow = true;
          mesh.userData.partName = part.name;
          holder.add(mesh);
          const tip = new THREE.Mesh(new THREE.BoxGeometry(g[0] * 1.08, g[2] * 0.13, g[1] * 1.1), mats.yellow || mat);
          tip.position.y = g[2] * 0.93; tip.castShadow = true; holder.add(tip);
          pivot.add(holder);
        }
      } else {
        const bg = new THREE.BoxGeometry(g[0], g[1], g[2]);
        for (let i = 0; i < count; i++) {
          const holder = new THREE.Group(); holder.rotation.y = i / count * Math.PI * 2;
          const mesh = new THREE.Mesh(bg, mat);
          mesh.position.z = g[2] / 2;
          mesh.castShadow = true;
          mesh.userData.partName = part.name;
          holder.add(mesh);
          const tip = new THREE.Mesh(new THREE.BoxGeometry(g[0] * 1.08, g[1] * 1.1, g[2] * 0.14), mats.yellow || mat);
          tip.position.z = g[2] * 0.93; tip.castShadow = true; holder.add(tip);
          pivot.add(holder);
        }
      }
      continue;
    }
    if (part.type === 'disc') {
      if (!blurDiscTex) blurDiscTex = makeBlurDiscTexture();
      const disc = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: blurDiscTex, color: 0xffffff, transparent: true, opacity: part.opacity ?? .15, depthWrite: false, side: THREE.DoubleSide }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(...(part.pos || [0, 0, 0]));
      disc.userData.partName = part.name;
      targetGroup.add(disc);
      parts.push({ mesh: disc, part });
      continue;
    }
    if (part.type === 'skid') {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(g[0], g[1], g[2], 12), mat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(...part.pos);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.partName = part.name;
      targetGroup.add(mesh);
      parts.push({ mesh, part });
      continue;
    }
    if (!geo) continue;
    if (part.type === 'ellipsoid') { geo.scale(g[0], g[1], g[2]); }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...(part.pos || [0, 0, 0]));
    if (part.rot) mesh.rotation.set(part.rot[0] * Math.PI / 180, part.rot[1] * Math.PI / 180, part.rot[2] * Math.PI / 180);
    mesh.castShadow = !part.noShadow;
    mesh.receiveShadow = true;
    mesh.userData.partName = part.name;
    mesh.userData.fragment = !!part.fragment;
    targetGroup.add(mesh);
    parts.push({ mesh, part });
    if (part.fragment) fragMeshes.push(mesh);
  }
  // 数字 24 涂装
  for (const decal of model.decals || []) {
    const tex = makeCanvasTexture((ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      ctx.font = `900 ${Math.floor(s * .68)}px "Arial Black", Arial`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = s * .035; ctx.strokeStyle = decal.outline || '#2a1547';
      ctx.strokeText(decal.text || '24', s / 2, s / 2 + s * .02);
      ctx.fillStyle = decal.color || '#ffd23f';
      ctx.fillText(decal.text || '24', s / 2, s / 2 + s * .02);
      ctx.globalAlpha = .35; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * .012;
      ctx.strokeText(decal.text || '24', s / 2, s / 2 + s * .02);
    }, 256);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(decal.size?.[0] || 1.4, decal.size?.[1] || 1.0), mat);
    mesh.position.set(...decal.pos);
    mesh.rotation.set(...(decal.rot || [0, 0, 0]).map(d => d * Math.PI / 180));
    mesh.userData.partName = decal.name;
    mesh.userData.decal = true;
    body.add(mesh);
  }
  // 影子：让直升机投射实时阴影（阴影贴图）
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

  // 粒子系统
  if (!dustTex) dustTex = particleTexture('dust');
  if (!smokeTex) smokeTex = particleTexture('smoke');
  if (!fireTex) fireTex = particleTexture('fire');
  const mkPoints = (n, tex, size, opacity, blending, color) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setDrawRange(0, 0);
    const m = new THREE.PointsMaterial({ map: tex, size, sizeAttenuation: true, transparent: true, opacity, depthWrite: false, blending, color: color || 0xffffff });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    scene.add(p);
    return p;
  };
  const dust = mkPoints(100, dustTex, 2.0, .38, THREE.NormalBlending, 0xc7b794);
  const smoke = mkPoints(90, smokeTex, 3.0, .42, THREE.NormalBlending, 0x7e8798);
  const fire = mkPoints(50, fireTex, 1.5, .9, THREE.AdditiveBlending, 0xffb45e);

  // 碎片池
  const fragGroup = new THREE.Group();
  const fragMeshesPool = [];
  const fragMats = [mats.purple, mats.yellow, mats.metal, mats.dark].filter(Boolean);
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, .35, 1), fragMats[i % Math.max(1, fragMats.length)] || new THREE.MeshStandardMaterial({ color: '#444' }));
    m.castShadow = true; m.visible = false;
    fragGroup.add(m); fragMeshesPool.push(m);
  }
  scene.add(fragGroup);
  const fireLight = new THREE.PointLight(0xff7a2a, 0, 40, 2);
  scene.add(fireLight);
  scene.add(group);
  return { group, parts, body, glass, tail, skid, rotor, tailRotor, blur, rotorSpin, tailRotorSpin, mats, fragMeshes, dust, smoke, fire, fragGroup, fragMeshesPool, fireLight };
}

function buildPlayerScene(sys, p, sceneData) {
  const scene = new THREE.Scene();
  const env = sceneData.environment || {};
  scene.fog = new THREE.FogExp2(new THREE.Color(env.fog?.color || '#243352'), env.fog?.density ?? .005);
  buildSky(scene, env);
  buildEnvironment(scene, env);
  const sun = new THREE.DirectionalLight(new THREE.Color(env.sun?.color || '#ffe2b0'), env.sun?.intensity ?? 2.2);
  const dir = env.sun?.dir || [-.4, .7, .4];
  sun.position.set(dir[0] * 100, dir[1] * 100, dir[2] * 100);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90; sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const target = new THREE.Object3D(); scene.add(target); sun.target = target;
  scene.add(new THREE.HemisphereLight(new THREE.Color(env.ambient?.color || '#6a7fae'), new THREE.Color('#1a2028'), env.ambient?.intensity ?? .7));
  if (env.fill) {
    const fill = new THREE.DirectionalLight(new THREE.Color(env.fill.color || '#9b7bff'), env.fill.intensity ?? .3);
    fill.position.set(...(env.fill.dir || [.5, .3, -.7]).map(v => v * 100));
    scene.add(fill);
  }
  const heli = buildHelicopter(scene, sceneData.model || {});
  return { scene, heli, env, sceneData, resourceKey: '', camPos: new THREE.Vector3(14, 6, 18), camLook: new THREE.Vector3(0, 3, 0), camera: new THREE.PerspectiveCamera(45, 1, .3, 900), lastDamage: -1 };
}

function getCache(sys, p) {
  const key = playerKey(sys.id, p.winId);
  const node = sys.files[p.scenePath];
  const resourceKey = p.scenePath + '|' + (node ? node.content.length + ':' + (node.modified || 0) : '0');
  let c = cache.get(key);
  if (c && c.resourceKey === resourceKey) return c;
  if (c) {
    try { c.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.dispose && m.dispose()); } }); } catch (e) {}
  }
  const sd = sceneForPlayer(sys, p);
  if (!sd) return null;
  c = buildPlayerScene(sys, p, sd);
  c.resourceKey = resourceKey;
  cache.set(key, c);
  return c;
}

function setPointPositions(points, arr, scale = 1) {
  const g = points.geometry;
  const a = g.attributes.position.array;
  let n = 0;
  for (const d of arr) {
    if (n * 3 + 2 >= a.length) break;
    a[n * 3] = d.x; a[n * 3 + 1] = d.y; a[n * 3 + 2] = d.z; n++;
  }
  g.setDrawRange(0, n);
  g.attributes.position.needsUpdate = true;
  g.computeBoundingSphere();
}

function applyFrame(sys, p, c, frame, effects) {
  const heli = c.heli;
  if (!frame) return;
  const pos = frame.pos || [0, 0, 0];
  // 坠毁时机体侧躺，整体下沉到地面附近，避免看起来悬浮
  heli.group.position.set(pos[0], pos[1] - (frame.crashed ? 0.95 : .42), pos[2]);
  const rot = frame.rot || [0, 0, 0];
  heli.group.rotation.set(rot[0] * Math.PI / 180, rot[1] * Math.PI / 180, rot[2] * Math.PI / 180, 'YXZ');
  if (heli.rotorSpin) heli.rotorSpin.rotation.y = frame.rotorAngle || 0;
  if (heli.tailRotorSpin) heli.tailRotorSpin.rotation.x = (frame.rotorAngle || 0) * 1.7;
  for (const obj of heli.blur.children) if (obj.isMesh) obj.material.opacity = clamp((frame.rotorSpeed || 0) * .26, .015, .24);
  heli.blur.rotation.y = (frame.rotorAngle || 0) * .5;
  // 损伤：熏黑
  const dmg = Math.round((frame.damage || 0) * 8) / 8;
  if (dmg !== c.lastDamage) {
    c.lastDamage = dmg;
    for (const [name, mat] of Object.entries(c.heli.mats)) {
      if (!mat.userData.baseColor) mat.userData.baseColor = mat.color.clone();
      const base = mat.userData.baseColor;
      const dark = Math.min(1, dmg * 1.15);
      mat.color.copy(base).multiplyScalar(1 - dark * .32);
      mat.roughness = clamp((mat.roughness || .5) + dmg * .3, 0, 1);
    }
  }
  // 粒子
  const fx = effects || p.effects;
  if (fx) {
    setPointPositions(heli.dust, fx.dust || []);
    setPointPositions(heli.smoke, fx.smoke || []);
    setPointPositions(heli.fire, (fx.smoke || []).filter(s => s.fire));
    for (let i = 0; i < heli.fragMeshesPool.length; i++) {
      const m = heli.fragMeshesPool[i];
      const f = (fx.fragments || [])[i];
      if (!f) { m.visible = false; continue; }
      m.visible = true;
      m.position.set(f.x, f.y, f.z);
      m.rotation.set(f.rx, f.ry, f.rz);
      m.scale.setScalar(f.size || .4);
    }
    heli.fireLight.position.set(pos[0], pos[1] + 1.2, pos[2]);
    heli.fireLight.intensity = (frame.fire || 0) * 12 * (0.85 + Math.sin(performance.now() * .02) * .15);
  }
}

function cameraFor(sys, p, c, frame, aspect) {
  const cam = c.camera;
  cam.aspect = aspect;
  const shot = frame && frame.shot;
  const mode = p.camera || 'auto';
  const pos = frame ? frame.pos : [0, 0, 0];
  const target = new THREE.Vector3(pos[0], pos[1] + 1.6, pos[2]);
  let desired = null, look = target.clone();
  if (mode === 'free') {
    const fc = p.freeCam || { yaw: .6, pitch: .25, dist: 22 };
    desired = new THREE.Vector3(
      pos[0] + Math.sin(fc.yaw) * Math.cos(fc.pitch) * fc.dist,
      pos[1] + 2 + Math.sin(fc.pitch) * fc.dist,
      pos[2] + Math.cos(fc.yaw) * Math.cos(fc.pitch) * fc.dist
    );
    look = target.clone();
  } else if (mode === 'follow' || (shot && shot.mode === 'follow')) {
    const def = shot || { dist: 18, height: 6, lookAhead: 1.2 };
    const yaw = ((frame ? frame.rot[1] : 0) * Math.PI / 180);
    const camYaw = yaw + 0.42; // 后侧 3/4 视角，让机身侧面的 24 号涂装可见
    const dist = def.dist || 18, height = def.height || 6;
    const back = new THREE.Vector3(-Math.sin(camYaw) * dist, height, -Math.cos(camYaw) * dist);
    desired = new THREE.Vector3(pos[0], pos[1], pos[2]).add(back);
    const ahead = def.lookAhead || 1;
    look = new THREE.Vector3(pos[0] + Math.sin(yaw) * ahead * 4, pos[1] + 1.4, pos[2] + Math.cos(yaw) * ahead * 4);
  } else if (shot) {
    desired = new THREE.Vector3(...(shot.pos || [12, 6, 18]));
    look = new THREE.Vector3(...(shot.look || [pos[0], pos[1] + 1, pos[2]]));
    cam.fov = shot.fov || 45;
  } else {
    desired = new THREE.Vector3(pos[0] + 14, pos[1] + 7, pos[2] + 18);
  }
  if (desired) {
    // 直接到达目标机位：低帧率或被遮挡恢复时也能立即得到正确构图
    c.camPos.copy(desired);
    c.camLook.copy(look);
    const gh = terrainHeight(c.camPos.x, c.camPos.z);
    if (c.camPos.y < gh + 2.2) c.camPos.y = gh + 2.2;
    cam.position.copy(c.camPos);
    cam.lookAt(c.camLook);
  }
  if (mode === 'free' && shot) cam.fov = 46;
  cam.updateProjectionMatrix();
  return cam;
}

function renderView(token) {
  const model = rt.model;
  if (!model) return;
  const sys = model.systems[token.sysId];
  if (!sys) return;
  const p = sys.apps.players[token.winId];
  if (!p) return;
  const canvas = token.canvas;
  if (!canvas || !canvas.isConnected) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 12 || rect.height < 12) return;
  // 遮挡/隐藏：最小化窗口或祖先 display:none 时跳过
  if (canvas.offsetParent === null) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.4);
  const pw = Math.max(8, Math.round(rect.width * dpr));
  const ph = Math.max(8, Math.round(rect.height * dpr));
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return;
  const renderer = ensureRenderer();
  if (!renderer) return;
  const c = getCache(sys, p);
  if (!c) {
    ctx2d.fillStyle = '#0b1020'; ctx2d.fillRect(0, 0, pw, ph);
    ctx2d.fillStyle = '#8b93b8'; ctx2d.font = '13px sans-serif'; ctx2d.textAlign = 'center';
    ctx2d.fillText(p.sceneError || '正在载入场景资源…', pw / 2, ph / 2);
    return;
  }
  let frame = p.frame;
  if (!frame) {
    // 初次呈现：在场景进程运行前先展示 t=0 的一帧
    if (p.mode === 'show') {
      try { frame = computeShowFrame(sys, p); } catch (e) {}
    }
    if (!frame) {
      frame = { t: p.position || 0, pos: [0, 4, 0], rot: [0, 0, 0], rotorAngle: 0, rotorSpeed: 0, damage: 0, dust: 0, smoke: 0, fire: 0, pads: c.env.pads || [], shot: (c.sceneData.cameras?.shots || [])[0] };
    }
  }
  applyFrame(sys, p, c, frame, p.effects);
  const cam = cameraFor(sys, p, c, frame, rect.width / rect.height);
  renderer.setSize(pw, ph, false);
  if (renderer.getRenderTarget()) renderer.setRenderTarget(null);
  renderer.render(c.scene, cam);
  ctx2d.clearRect(0, 0, pw, ph);
  try { ctx2d.drawImage(renderer.domElement, 0, 0, pw, ph); } catch (e) { }
  token.lastCam = cam;
  token.lastFrame = frame;
  token.lastW = rect.width; token.lastH = rect.height;
}

function renderAll(now) {
  let count = 0;
  for (const token of [...views]) {
    try { renderView(token); count++; } catch (e) { console.warn('渲染视图失败', e); }
  }
  const chromium = rt.model && rt.model.systems.outer && rt.model.systems.outer.processes.find(p => p.service === 'chromium');
  if (chromium) chromium.note = `宿主 Chromium：${count} 个三维视图共享单个 WebGL 上下文`;
}

export function pickAt(token, clientX, clientY) {
  if (!token || !token.lastCam) return null;
  const rect = token.canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, token.lastCam);
  const sys = rt.model.systems[token.sysId];
  const p = sys && sys.apps.players[token.winId];
  const c = cache.get(playerKey(token.sysId, token.winId));
  if (!c) return null;
  const hits = ray.intersectObject(c.heli.group, true);
  if (hits.length) {
    const mesh = hits[0].object;
    return { kind: 'part', name: mesh.userData.partName || '部件', damage: p && p.frame ? p.frame.damage : 0, point: hits[0].point };
  }
  const terrain = c.scene.getObjectByName('terrain');
  if (terrain) {
    const th = ray.intersectObject(terrain, false);
    if (th.length) return { kind: 'ground', point: th[0].point, terrain: true };
  }
  return null;
}

export function invalidatePlayer(sysId, winId) {
  const key = playerKey(sysId, winId);
  const c = cache.get(key);
  if (c) { cache.delete(key); try { c.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } catch (e) {} }
}

window.addEventListener('resize', () => { /* 每个视图自行测量 */ });
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderAll(performance.now() / 1000); });
