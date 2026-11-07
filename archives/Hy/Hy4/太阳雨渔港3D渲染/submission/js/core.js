/* ========================================================================
   core.js — 命名空间、色板、材质、几何、区域掩膜、场景环境
   ======================================================================== */
(function () {
'use strict';
const T = window.THREE;
const SR = window.SR = {};

/* ---------- 数值工具 ---------- */
SR.PI = Math.PI;
SR.TAU = Math.PI * 2;
SR.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
SR.sat = v => Math.min(1, Math.max(0, v));
SR.lerp = (a, b, t) => a + (b - a) * t;
SR.smooth = (a, b, v) => { const t = SR.clamp((v - a) / (b - a || 1), 0, 1); return t * t * (3 - 2 * t); };
SR.pulse = (t, period, width) => { const p = ((t % period) + period) % period / period; return SR.smooth(0, width, p) * (1 - SR.smooth(width, 2 * width, p)); };
SR.hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
SR.hash2 = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
let _seed = 20240611;
SR.rand = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };
SR.rnd = (a, b) => a + (b - a) * SR.rand();
SR.rint = (a, b) => Math.floor(SR.rnd(a, b + 1));
SR.pick = arr => arr[Math.floor(SR.rand() * arr.length)];
SR.noise2 = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = SR.hash2(xi, yi), b = SR.hash2(xi + 1, yi), c = SR.hash2(xi, yi + 1), d = SR.hash2(xi + 1, yi + 1);
  return SR.lerp(SR.lerp(a, b, u), SR.lerp(c, d, u), v);
};

/* ---------- 色板 ---------- */
SR.C = {
  skyTop:      0xbfe1e6,
  skyBottom:   0xf5faf1,
  fog:         0xdceee9,
  background:  0xdceff0,

  concrete:    0xd2dcd8,
  concreteLit: 0xe0e9e4,
  concreteDim: 0xb9c9c5,
  wall:        0xaebfbc,
  wallDark:    0x8fa7a4,
  tide1:       0x83a09c,
  tide2:       0x64837f,
  deepTeal:    0x3c6b70,
  shadowTeal:  0x2d565c,
  ink:         0x2f4f55,

  seaGlass:    0x8fd3cb,
  seaLight:    0xb3e5d9,
  seaMid:      0x69b6b0,
  seaDeep:     0x3f8b8c,
  waterBody:   0x83c9bd,
  seabed:      0x9fb9ac,
  foam:        0xf4fbf6,

  hull:        0xf1f5f0,
  hullShade:   0xd9e2dc,
  hullRust:    0xb8875d,
  deck:        0xe3e6da,
  cabin:       0xf6f7f1,

  hazardY:     0xf0c33f,
  hazardK:     0x2e3c3d,
  rope:        0xc87044,
  ropeWet:     0x7c5238,
  buoyO:       0xe8763c,
  buoyW:       0xf4f6ee,
  brass:       0xf4d08a,
  warm:        0xffe2a2,
  gold:        0xffd27a,

  lighthouseR: 0xd65a50,
  lighthouseW: 0xf0f2e9,
  tile:        0x5d8189,
  tileLight:   0x7fa0a4,
  plaster:     0xe9e5d7,
  wood:        0xc39a6b,
  woodDark:    0x8c6c4c,
  woodPale:    0xd9bb8e,
  leaf:        0x7fb06d,
  leafLight:   0xa4c981,
  leafDark:    0x5c8d5f,
  soil:        0xa2b08a,

  iron:        0x3d494b,
  ironLight:   0x68787a,
  rust:        0xa6663f,
  glass:       0xd3ece8,
  metal:       0xb9c4c2,
  metalDark:   0x8a9a99,
  plasticW:    0xe9efea,
  plasticB:    0x4a86ad,
  raincoat:    0xf0c843,
  cat:         0xd8cbb4,
  gull:        0xf3f5f0,
  gullWing:    0x9fb1b3,
};

/* ---------- 场景引用 ---------- */
SR.scene = null; SR.camera = null; SR.renderer = null; SR.clock = 0;
SR.root = null;
SR.g = {};
SR.obj = {
  boats: [], gulls: [], fish: [], seagrass: [], kelp: [],
  flags: [], nets: [], floats: [], trees: [], ripples: [],
  lamps: [], buoys: [], ropes: [], foam: [], caustics: [],
  gullPerches: [], propellers: [], interiorLights: [],
};
SR.build = {};
SR.updaters = [];
SR.onUpdate = fn => SR.updaters.push(fn);
SR.update = t => { for (let i = 0; i < SR.updaters.length; i++) SR.updaters[i](t); };

SR.group = function (name, parent) {
  const g = new T.Group(); g.name = name;
  (parent || SR.scene).add(g);
  SR.g[name] = g;
  return g;
};

/* ---------- 卡通渐变色阶 ---------- */
SR.M = {};
(function () {
  const steps = [0.46, 0.72, 0.90, 1.0];
  const data = new Uint8Array(16);
  for (let i = 0; i < 4; i++) {
    const v = Math.floor(steps[i] * 255);
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  const tex = new T.DataTexture(data, 4, 1, T.RGBAFormat);
  tex.minFilter = tex.magFilter = T.NearestFilter;
  tex.generateMipmaps = false; tex.needsUpdate = true;
  SR.M.grad = tex;
})();

SR.M.toon = function (color, o) {
  o = o || {};
  const m = new T.MeshToonMaterial({
    color: color === undefined ? 0xffffff : color,
    gradientMap: SR.M.grad,
    map: o.map || null,
    transparent: !!o.transparent,
    opacity: o.opacity === undefined ? 1 : o.opacity,
    side: o.side === undefined ? T.FrontSide : o.side,
    depthWrite: o.depthWrite === undefined ? true : o.depthWrite,
    alphaTest: o.alphaTest || 0,
    emissive: o.emissive === undefined ? 0x000000 : o.emissive,
    emissiveMap: o.emissiveMap || null,
  });
  if (o.emissiveIntensity !== undefined) m.emissiveIntensity = o.emissiveIntensity;
  return m;
};
SR.M.basic = function (color, o) {
  o = o || {};
  return new T.MeshBasicMaterial({
    color: color === undefined ? 0xffffff : color,
    map: o.map || null,
    transparent: !!o.transparent,
    opacity: o.opacity === undefined ? 1 : o.opacity,
    side: o.side === undefined ? T.FrontSide : o.side,
    depthWrite: o.depthWrite === undefined ? true : o.depthWrite,
    alphaTest: o.alphaTest || 0,
    blending: o.blending === undefined ? T.NormalBlending : o.blending,
  });
};
SR.M.glass = function (o) {
  o = o || {};
  return SR.M.basic(o.color === undefined ? SR.C.glass : o.color, {
    transparent: true, opacity: o.opacity === undefined ? 0.20 : o.opacity,
    side: T.DoubleSide, depthWrite: false,
  });
};
SR.M.edge = new T.LineBasicMaterial({ color: 0x27454a, transparent: true, opacity: 0.80, depthWrite: false });
SR.M.edgeSoft = new T.LineBasicMaterial({ color: 0x27454a, transparent: true, opacity: 0.40, depthWrite: false });
SR.M.edgeWarm = new T.LineBasicMaterial({ color: 0x6a7c72, transparent: true, opacity: 0.48, depthWrite: false });
SR.M.shell = new T.MeshBasicMaterial({ color: SR.C.ink, side: T.BackSide });

/* ---------- 几何与建模辅助 ---------- */
SR.G = {};
SR.G.box = (w, h, d) => new T.BoxGeometry(w, h, d);
SR.G.cyl = (rt, rb, h, seg, open) => new T.CylinderGeometry(rt, rb, h, seg || 16, 1, !!open);
SR.G.sph = (r, w, h) => new T.SphereGeometry(r, w || 16, h || 12);
SR.G.plane = (w, h, sw, sh) => new T.PlaneGeometry(w, h, sw || 1, sh || 1);
SR.G.torus = (r, tube, rs, ts) => new T.TorusGeometry(r, tube, rs || 8, ts || 20);
SR.G.cone = (r, h, seg) => new T.ConeGeometry(r, h, seg || 16);

SR.AUTO_EDGE = true;
SR.edgeCache = new Map();
SR.edge = function (mesh, threshold, mat) {
  threshold = threshold === undefined ? 24 : threshold;
  const key = mesh.geometry.uuid + '|' + threshold;
  let eg = SR.edgeCache.get(key);
  if (!eg) { eg = new T.EdgesGeometry(mesh.geometry, threshold); SR.edgeCache.set(key, eg); }
  const l = new T.LineSegments(eg, mat || SR.M.edge);
  l.scale.setScalar(1.0025);
  l.renderOrder = 3;
  mesh.add(l);
  return l;
};
SR.shell = function (mesh, scale, color) {
  const s = new T.Mesh(mesh.geometry, color ? new T.MeshBasicMaterial({ color: color, side: T.BackSide }) : SR.M.shell);
  s.scale.setScalar(scale || 1.025);
  s.renderOrder = -1;
  mesh.add(s);
  return s;
};

/* 通用添加一个 mesh；edge 可为 false / 数值阈值 / true */
SR.add = function (parent, geo, mat, pos, rot, edge) {
  const m = new T.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  parent.add(m);
  if (edge !== false && SR.AUTO_EDGE) {
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    if (geo.boundingSphere.radius > 0.19) SR.edge(m, typeof edge === 'number' ? edge : 24);
  }
  return m;
};
/* 便捷：盒 / 柱 / 球 */
SR.box = (p, w, h, d, mat, pos, rot, edge) => SR.add(p, SR.G.box(w, h, d), mat, pos, rot, edge);
SR.cyl = (p, rt, rb, h, mat, pos, rot, seg, edge) => SR.add(p, SR.G.cyl(rt, rb, h, seg), mat, pos, rot, edge);
SR.sph = (p, r, mat, pos, rot, edge) => SR.add(p, SR.G.sph(r), mat, pos, rot, edge === undefined ? false : edge);

/* 用一串点生成管状缆绳 / 电线 */
SR.tube = function (parent, points, radius, mat, seg, radial) {
  const curve = new T.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new T.Vector3(p[0], p[1], p[2])));
  const geo = new T.TubeGeometry(curve, seg || 24, radius, radial || 6, false);
  return SR.add(parent, geo, mat, null, null, false);
};
SR.line = function (parent, points, mat) {
  const g = new T.BufferGeometry().setFromPoints(points.map(p => p.isVector3 ? p : new T.Vector3(p[0], p[1], p[2])));
  const l = new T.Line(g, mat || SR.M.edge);
  parent.add(l);
  return l;
};

/* ---------- 底座区域定义与掩膜 ---------- */
SR.SIZE = 20;            // 底座边长
SR.HALF = 10;
SR.BASE_BOTTOM = -2.6;   // 底座底面
SR.WATER_LEVEL = 0.0;

/* 陆地矩形：[x1,x2,z1,z2]，顶面 y=0 */
SR.LAND = [
  { x1: -10, x2: 2.0, z1: 2.0, z2: 10, kind: 'quay', name: 'mainQuay' },
  { x1: -1.0, x2: 2.0, z1: -5.0, z2: 2.0, kind: 'pier', name: 'pierStem' },
  { x1: 2.0, x2: 8.2, z1: -5.0, z2: -2.0, kind: 'arm', name: 'pierArm' },
  { x1: 6.8, x2: 8.2, z1: -8.0, z2: -5.0, kind: 'break', name: 'shortBreakwater' },
];
/* 额外非矩形陆地（画进 mask，单独建模） */
SR.LAND_EXTRA = [
  { type: 'ellipse', x: -8.3, z: -8.2, rx: 2.1, rz: 1.9 },     // 山坡岬角
];

SR.isLand = function (x, z) {
  for (const r of SR.LAND) if (x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2) return true;
  for (const e of SR.LAND_EXTRA) {
    if (e.type === 'ellipse') { const dx = (x - e.x) / e.rx, dz = (z - e.z) / e.rz; if (dx * dx + dz * dz < 1) return true; }
    else if (x >= e.x1 && x <= e.x2 && z >= e.z1 && z <= e.z2) return true;
  }
  return false;
};
SR.uvFromWorld = (x, z) => [(x + SR.HALF) / SR.SIZE, (z + SR.HALF) / SR.SIZE];

/* 生成水/陆 mask（白=水，黑=陆）与岸线柔边 */
SR.MASK_N = 512;
SR.makeMask = function () {
  const N = SR.MASK_N;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  const X = x => (x + SR.HALF) / SR.SIZE * N;
  const Z = z => (z + SR.HALF) / SR.SIZE * N;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, N, N);
  g.fillStyle = '#000000';
  for (const r of SR.LAND) {
    g.fillRect(X(r.x1), Z(r.z1), X(r.x2) - X(r.x1), Z(r.z2) - Z(r.z1));
  }
  for (const e of SR.LAND_EXTRA) {
    if (e.type === 'ellipse') {
      g.beginPath();
      g.ellipse(X(e.x), Z(e.z), e.rx / SR.SIZE * N, e.rz / SR.SIZE * N, 0, 0, SR.TAU);
      g.fill();
    } else {
      g.fillRect(X(e.x1), Z(e.z1), X(e.x2) - X(e.x1), Z(e.z2) - Z(e.z1));
    }
  }
  /* 轻微柔化岸线 */
  const tex = new T.CanvasTexture(c);
  tex.flipY = false;
  tex.minFilter = T.LinearFilter; tex.magFilter = T.LinearFilter;
  tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  SR.maskCanvas = c;
  SR.maskTexture = tex;
  return tex;
};
SR.sampleMask = function (x, z) {
  const u = SR.sat((x + SR.HALF) / SR.SIZE), v = SR.sat((z + SR.HALF) / SR.SIZE);
  const c = SR.maskCanvas, N = SR.MASK_N;
  const px = Math.min(N - 1, Math.floor(u * N)), py = Math.min(N - 1, Math.floor(v * N));
  return SR.maskImage ? SR.maskImage.data[(py * N + px) * 4] / 255 : 1;
};

/* ---------- 初始化 renderer / scene / camera ---------- */
SR.init = function () {
  const canvas = document.getElementById('view');
  const renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(SR.C.background, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  SR.renderer = renderer;

  const scene = new T.Scene();
  scene.background = new T.Color(SR.C.background);
  scene.fog = new T.Fog(SR.C.fog, 34, 96);
  SR.scene = scene;
  SR.root = scene;

  const camera = new T.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(21, 15, 23);
  camera.lookAt(0, -0.4, 0);
  SR.camera = camera;

  SR.makeMask();
  const N = SR.MASK_N;
  SR.maskImage = SR.maskCanvas.getContext('2d').getImageData(0, 0, N, N);

  window.addEventListener('resize', () => {
    SR.camera.aspect = window.innerWidth / window.innerHeight;
    SR.camera.updateProjectionMatrix();
    SR.renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (SR.onResize) SR.onResize();
  });
  return SR;
};

/* ---------- 环境：天空穹顶、薄云、光照 ---------- */
SR.build.env = function () {
  const g = SR.group('env');

  /* 渐变天空球 */
  const skyGeo = new T.SphereGeometry(180, 32, 24);
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new T.Color(SR.C.skyTop) },
      bottom: { value: new T.Color(SR.C.skyBottom) },
      sun: { value: new T.Color(0xffe1a0) },
      sunDir: { value: new T.Vector3(-0.45, 0.10, -0.89).normalize() },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 top; uniform vec3 bottom; uniform vec3 sun; uniform vec3 sunDir;
      void main(){
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y*0.5+0.5, 0.0, 1.0);
        vec3 col = mix(bottom, top, pow(h, 0.85));
        /* 被阳光冲淡的暖金带，水彩般通透 */
        float warm = exp(-pow((h - 0.40) * 4.0, 2.0));
        col = mix(col, vec3(1.0, 0.955, 0.845), warm * 0.17);
        /* 云隙阳光的大范围淡金光晕 */
        float d = max(dot(dir, sunDir), 0.0);
        float glow = pow(d, 1.6);
        col = mix(col, sun, glow * 0.26);
        float core = pow(d, 16.0);
        col = mix(col, vec3(1.0, 0.975, 0.88), core * 0.40);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  g.add(new T.Mesh(skyGeo, skyMat));

  /* 薄云：几片带柔边的白色云带 */
  const cloudTex = SR.tex.cloud();
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const w = SR.rnd(16, 34), h = SR.rnd(3.5, 7);
    const m = new T.Mesh(SR.G.plane(w, h), SR.M.basic(0xffffff, {
      map: cloudTex, transparent: true, opacity: SR.rnd(0.30, 0.62), depthWrite: false, side: T.DoubleSide,
    }));
    m.position.set(SR.rnd(-40, 40), SR.rnd(26, 46), SR.rnd(-60, -20));
    m.rotation.x = -SR.PI / 2 + SR.rnd(-0.18, 0.18);
    m.renderOrder = -2;
    g.add(m);
    clouds.push({ m: m, x0: m.position.x, spd: SR.rnd(0.12, 0.3), ph: SR.rnd(0, 10) });
  }
  SR.obj.clouds = clouds;

  /* 面向镜头的薄云带：位于场景之后的高空，给浅青白天空一点层次 */
  const skyClouds = [];
  for (let i = 0; i < 5; i++) {
    const w = SR.rnd(20, 38), h = SR.rnd(4.5, 8.5);
    const m = new T.Mesh(SR.G.plane(w, h), SR.M.basic(0xffffff, {
      map: cloudTex, transparent: true, opacity: SR.rnd(0.18, 0.34),
      depthWrite: false, depthTest: true, side: T.DoubleSide,
    }));
    m.position.set(SR.rnd(-34, 34), SR.rnd(20, 36), SR.rnd(-52, -32));
    m.renderOrder = -2;
    g.add(m);
    skyClouds.push({ m: m, x0: m.position.x, spd: SR.rnd(0.20, 0.55), ph: SR.rnd(0, 10) });
  }
  SR.obj.skyClouds = skyClouds;

  SR.onUpdate(t => {
    for (const c of clouds) {
      c.m.position.x = c.x0 + Math.sin(t * 0.012 + c.ph) * 6 + t * c.spd * 0.35;
      c.m.position.x = ((c.m.position.x + 70) % 140) - 70;
    }
    for (const c of skyClouds) {
      c.m.position.x = ((c.x0 + t * c.spd + 48) % 96) - 48;
      c.m.quaternion.copy(SR.camera.quaternion);
    }
  });

  /* 光照：高调、低对比 */
  const hemi = new T.HemisphereLight(0xf2fbf7, 0x8fb6b3, 0.42);
  sceneAdd(hemi);
  const amb = new T.AmbientLight(0xdcf0ec, 0.14);
  sceneAdd(amb);
  const sun = new T.DirectionalLight(0xffe6b0, 0.52);
  sun.position.set(16, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 1; sc.far = 70;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  sceneAdd(sun);
  SR.obj.sun = sun;
  const fill = new T.DirectionalLight(0xd2ecf6, 0.10);
  fill.position.set(-14, 10, -12);
  sceneAdd(fill);

  function sceneAdd(o) { SR.scene.add(o); }
  SR.obj.hemi = hemi; SR.obj.amb = amb; SR.obj.fill = fill;

  /* 太阳方向上的暖色光晕（镜头光感，不用贴图） */
  const halo = new T.Mesh(SR.G.plane(70, 70), SR.M.basic(0xfff3d2, {
    map: SR.tex.halo(), transparent: true, opacity: 0.5, depthWrite: false, side: T.DoubleSide, depthTest: false,
  }));
  halo.position.set(58, 80, 40);
  halo.lookAt(0, 0, 0);
  halo.renderOrder = -3;
  g.add(halo);
};

/* 常用物体阴影贴片（柔边椭圆） */
SR.shadowBlob = function (parent, x, z, w, h, opacity) {
  const m = new T.Mesh(SR.G.plane(w, h), SR.M.basic(0x3b5f60, {
    map: SR.tex.blob(), transparent: true, opacity: opacity === undefined ? 0.22 : opacity,
    depthWrite: false, side: T.DoubleSide,
  }));
  m.rotation.x = -SR.PI / 2;
  m.position.set(x, 0.012, z);
  m.renderOrder = 1;
  parent.add(m);
  return m;
};

/* 让一个 mesh 参与阴影 */
SR.cast = function (m, receive) {
  m.castShadow = true; if (receive !== false) m.receiveShadow = true;
  return m;
};

})();
