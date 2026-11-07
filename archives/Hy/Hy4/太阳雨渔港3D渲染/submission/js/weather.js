/* ========================================================================
   weather.js — 太阳雨雨丝、淡金光柱、彩虹、云影贴片、海鸥、港猫
   ======================================================================== */
(function () {
'use strict';
const T = window.THREE;
const SR = window.SR;
const tx = SR.tex;

/* 体积光柱贴图：周向柔边、两端淡去 */
const shaftTex = tx.make(128, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const hg = g.createLinearGradient(0, 0, w, 0);
  hg.addColorStop(0, 'rgba(255,224,146,0.02)');
  hg.addColorStop(0.22, 'rgba(255,232,168,0.42)');
  hg.addColorStop(0.50, 'rgba(255,246,208,0.72)');
  hg.addColorStop(0.78, 'rgba(255,232,168,0.42)');
  hg.addColorStop(1, 'rgba(255,224,146,0.02)');
  g.fillStyle = hg; g.fillRect(0, 0, w, h);
  const v = g.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(0,0,0,0.96)');
  v.addColorStop(0.38, 'rgba(0,0,0,0)');
  v.addColorStop(0.78, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.94)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
});

/* 阳光落在地面的暖金光斑 */
const poolTex = tx.make(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const grd = g.createRadialGradient(w / 2, h / 2, 3, w / 2, h / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,230,158,0.95)');
  grd.addColorStop(0.32, 'rgba(255,226,150,0.58)');
  grd.addColorStop(0.70, 'rgba(255,234,184,0.17)');
  grd.addColorStop(1, 'rgba(255,238,196,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

/* 云影贴片 */
const cloudShadowTex = tx.make(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) {
    const x = SR.rnd(0, w), y = SR.rnd(0, h), r = SR.rnd(30, 85);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(60,95,100,0.28)');
    grd.addColorStop(1, 'rgba(60,95,100,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, SR.TAU); g.fill();
  }
});

/* ---------------- 海鸥 ---------------- */
function gullModel(scale) {
  const g = new T.Group();
  g.scale.setScalar(scale || 1);
  const white = SR.M.toon(SR.C.gull);
  const wingMat = SR.M.toon(SR.C.gullWing, { side: T.DoubleSide });
  const body = SR.add(g, SR.G.sph(0.13, 10, 8), white, [0, 0, 0], null, false);
  body.scale.set(1.5, 0.72, 0.85);
  SR.add(g, SR.G.sph(0.075, 9, 7), white, [0.17, 0.055, 0], null, false);
  /* 喙 */
  SR.add(g, SR.G.cone(0.028, 0.10, 6), SR.M.toon(0xe2a24c), [0.26, 0.045, 0], [0, 0, -SR.PI / 2], false);
  /* 眼 */
  SR.sph(g, 0.012, SR.M.toon(0x3a4a48), [0.20, 0.075, 0.055], null, false);
  SR.sph(g, 0.012, SR.M.toon(0x3a4a48), [0.20, 0.075, -0.055], null, false);
  /* 尾 */
  const tail = SR.add(g, SR.G.cone(0.075, 0.18, 5), white, [-0.21, 0.02, 0], [0, 0, SR.PI / 2], false);
  tail.scale.set(1, 1, 0.5);
  /* 双翼（水平展开，俯视呈清晰鸟形；可上下扑动） */
  const wings = [];
  for (const s of [-1, 1]) {
    const wg = new T.Group();
    wg.position.set(-0.02, 0.035, 0);
    g.add(wg);
    const wing = SR.add(wg, SR.G.plane(0.34, 0.48), wingMat,
      [0, 0, s * 0.28], [-SR.PI / 2, 0, 0], false);
    /* 深色翼尖 */
    SR.add(wg, SR.G.plane(0.10, 0.20), SR.M.toon(0x7e9598, { side: T.DoubleSide }),
      [-0.04, 0.002, s * 0.47], [-SR.PI / 2, 0, 0], false);
    wings.push(wg);
  }
  return { g: g, wings: wings };
}

/* ---------------- 港猫 ---------------- */
function catModel() {
  const g = new T.Group();
  const fur = SR.M.toon(SR.C.cat);
  const furDark = SR.M.toon(0xb9a98f);
  const body = SR.add(g, SR.G.sph(0.16, 12, 9), fur, [0, 0.11, 0], null, false);
  body.scale.set(1.6, 0.80, 0.90);
  const head = SR.add(g, SR.G.sph(0.10, 10, 8), fur, [0.24, 0.20, 0], null, false);
  for (const s of [-1, 1]) {
    SR.add(g, SR.G.cone(0.045, 0.10, 5), fur, [0.24, 0.30, s * 0.055], [0, 0, 0], false);
    SR.sph(g, 0.014, SR.M.toon(0x4e5a50), [0.32, 0.22, s * 0.045], null, false);
  }
  SR.sph(g, 0.018, SR.M.toon(0xd08a80), [0.335, 0.185, 0], null, false);
  /* 四条腿 */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    SR.cyl(g, 0.028, 0.028, 0.14, fur, [sx * 0.17, 0.07, sz * 0.09], null, 6, false);
  }
  /* 尾巴 */
  SR.tube(g, [[-0.25, 0.14, 0], [-0.38, 0.22, 0.04], [-0.44, 0.34, 0.02]], 0.022, furDark, 12, 5);
  /* 斑纹 */
  for (let i = 0; i < 3; i++) {
    SR.box(g, 0.03, 0.012, 0.16, furDark, [-0.12 + i * 0.12, 0.215, 0], null, false);
  }
  return { g: g, head: head, body: body };
}

SR.build.weather = function () {
  const g = SR.group('weather');

  /* ---------------- 太阳雨：斜落的暖金短线 ---------------- */
  const N = 2600;
  const pos = new Float32Array(N * 2 * 3);
  const phase = new Float32Array(N * 2);
  const end = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const x = SR.rnd(-16, 16), y = SR.rnd(0, 15), z = SR.rnd(-16, 16);
    const ph = SR.rand();
    for (let k = 0; k < 2; k++) {
      const j = i * 2 + k;
      pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z;
      phase[j] = ph; end[j] = k;
    }
  }
  const rgeo = new T.BufferGeometry();
  rgeo.setAttribute('position', new T.BufferAttribute(pos, 3));
  rgeo.setAttribute('aPhase', new T.BufferAttribute(phase, 1));
  rgeo.setAttribute('aEnd', new T.BufferAttribute(end, 1));
  const rainUniforms = {
    uTime: { value: 0 }, uRain: { value: 0.55 }, uWind: { value: 0 }, uCloud: { value: 1.0 },
  };
  const rainMat = new T.ShaderMaterial({
    uniforms: rainUniforms, transparent: true, depthWrite: false,
    blending: T.NormalBlending,
    vertexShader: `
      attribute float aPhase; attribute float aEnd;
      uniform float uTime; uniform float uRain; uniform float uWind; uniform float uCloud;
      varying float vA; varying float vGlow;
      void main(){
        vec3 p = position;
        float speed = 7.0 + uRain*5.0;
        float y = mod(p.y - uTime*speed - aPhase*9.0, 16.0) - 1.5;
        p.y = y;
        float slant = 0.10 + uWind*0.42;
        p.x -= slant * (14.0 - y) * 0.32;
        p.z += 0.035 * (14.0 - y);
        vec3 dir = vec3(-slant, -0.32, 0.05) * (0.65 + uRain*0.55);
        p += dir * aEnd;
        float keep = step(aPhase, 0.30 + uRain*0.70);
        vA = keep * (0.28 + 0.42*uRain) * mix(0.55, 1.0, uCloud);
        /* 光柱中的雨丝更亮 */
        float inBeam = smoothstep(3.0, 0.0, abs(p.x + 1.0)) * smoothstep(9.0, 1.0, abs(p.z - 2.0));
        vGlow = inBeam;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying float vA; varying float vGlow;
      void main(){
        vec3 c = mix(vec3(1.0,0.95,0.80), vec3(1.0,0.86,0.55), vGlow);
        gl_FragColor = vec4(c, vA * (0.72 + 0.5*vGlow));
      }`,
  });
  const rain = new T.LineSegments(rgeo, rainMat);
  rain.frustumCulled = false;
  rain.renderOrder = 20;
  g.add(rain);
  SR.obj.rainUniforms = rainUniforms;

  /* ---------------- 淡金色光柱：斜射光锥 + 地面暖金光斑 ---------------- */
  const beams = [];
  const shaftMat = SR.M.basic(0xffe3a8, {
    map: shaftTex, transparent: true, opacity: 0.20, depthWrite: false,
    side: T.DoubleSide, blending: T.NormalBlending,
  });
  const poolMat = SR.M.basic(0xffe9b4, {
    map: poolTex, transparent: true, opacity: 0.36, depthWrite: false,
    side: T.DoubleSide, blending: T.NormalBlending,
  });
  const beamSpots = [
    [-2.2, 5.0, 1.45], [-6.3, 7.0, 1.65], [3.9, 0.3, 1.35],
    [7.1, -3.2, 1.15], [-0.6, 8.3, 1.55], [8.1, 5.3, 1.25],
  ];
  beamSpots.forEach((s, i) => {
    const x = s[0], z = s[1], r = s[2], H = 11.5;
    /* 天空端细、地面端宽的光锥，从云隙斜射而下 */
    const cone = new T.Mesh(new T.CylinderGeometry(r * 0.42, r, H, 12, 1, true), shaftMat.clone());
    cone.position.set(x + 0.85, H / 2 - 0.35, z + 0.65);
    cone.rotation.set(-0.13, i * 0.12, -0.11);
    cone.renderOrder = 18;
    g.add(cone);
    beams.push({ m: cone, base: 0.12 + SR.rnd(0, 0.05), ph: i * 1.3 });
    /* 落在码头 / 水面上的暖金光斑（俯视清晰可见） */
    const pool = new T.Mesh(SR.G.plane(r * 3.2, r * 3.2), poolMat.clone());
    pool.rotation.x = -SR.PI / 2;
    pool.position.set(x, 0.048, z);
    pool.renderOrder = 13;
    g.add(pool);
    beams.push({ m: pool, base: 0.46 + SR.rnd(0, 0.12), ph: i * 1.3 + 0.6 });
  });
  SR.obj.beams = beams;

  /* ---------------- 彩虹（雨疏时浮现） ---------------- */
  const rainbow = new T.Mesh(SR.G.plane(15, 7.5), SR.M.basic(0xffffff, {
    map: tx.rainbow(), transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide,
  }));
  rainbow.position.set(1.5, 5.2, -15.5);
  rainbow.rotation.y = 0.25;
  rainbow.renderOrder = 17;
  g.add(rainbow);
  SR.obj.rainbow = rainbow;

  /* ---------------- 云影贴片（掠过底座） ---------------- */
  const shadowMat = SR.M.basic(0xffffff, {
    map: cloudShadowTex, transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide,
  });
  const cShadow = new T.Mesh(SR.G.plane(14, 14), shadowMat);
  cShadow.rotation.x = -SR.PI / 2;
  cShadow.position.set(0, 0.026, 0);
  cShadow.renderOrder = 12;
  g.add(cShadow);
  SR.obj.cloudShadow = cShadow;

  /* ---------------- 海鸥 ---------------- */
  SR.obj.gullPerches = [
    [1.55, 0.62, 6.4], [2.55, 0.62, -2.30], [7.75, 0.62, -2.30],
    [7.5, 3.42, -7.3], [6.15, 1.60, 0.15], [3.85, 0.62, -2.30],
  ];
  for (let i = 0; i < 8; i++) {
    const gm = gullModel(SR.rnd(1.05, 1.35));
    g.add(gm.g);
    const perch = i < 3;
    SR.obj.gulls.push({
      g: gm.g, wings: gm.wings, ph: SR.rnd(0, 20),
      radius: SR.rnd(5.5, 10.5), speed: SR.rnd(0.10, 0.20),
      height: SR.rnd(3.2, 6.2), perch: perch,
      perchIdx: i % SR.obj.gullPerches.length, flyOff: 0,
    });
  }

  /* ---------------- 港猫 ---------------- */
  const cm = catModel();
  g.add(cm.g);
  SR.obj.cat = { g: cm.g, head: cm.head, body: cm.body };

  /* ---------------- 远处防波堤外不时驶过的小渔船 ---------------- */
  const pb = new T.Group();
  SR.add(pb, SR.G.box(1.90, 0.18, 0.46), SR.M.toon(SR.C.hull), [0, 0.11, 0], null, 22);
  SR.box(pb, 1.86, 0.045, 0.48, SR.M.toon(SR.C.ironLight), [0, 0.20, 0], null, false);
  SR.add(pb, SR.G.cone(0.24, 0.56, 4), SR.M.toon(SR.C.hull), [1.02, 0.11, 0], [0, 0, -SR.PI / 2], false);
  SR.box(pb, 0.42, 0.28, 0.38, SR.M.toon(SR.C.cabin), [-0.30, 0.37, 0], null, 20);
  SR.box(pb, 0.48, 0.04, 0.42, SR.M.toon(SR.C.ironLight), [-0.30, 0.53, 0], null, false);
  SR.cyl(pb, 0.010, 0.010, 0.60, SR.M.toon(SR.C.iron), [0.10, 0.82, 0], null, 5, false);
  SR.add(pb, SR.G.plane(0.20, 0.10), SR.M.toon(SR.C.buoyO, { side: T.DoubleSide }), [0.20, 1.06, 0], null, false);
  pb.scale.setScalar(0.80);   /* 远海的距离感 */
  g.add(pb);
  const pbWake = [];
  for (let i = 0; i < 5; i++) {
    const w = new T.Mesh(SR.G.plane(0.38, 0.18), SR.M.basic(0xffffff, {
      map: tx.foam(), transparent: true, opacity: 0.45, depthWrite: false, side: T.DoubleSide,
    }));
    w.rotation.x = -SR.PI / 2;
    w.position.y = 0.052;
    w.renderOrder = 11;
    g.add(w);
    pbWake.push(w);
  }
  SR.obj.passBoat = { g: pb, wake: pbWake };

  /* ---------------- 滴水（伞沿、灯罩、船舷） ---------------- */
  const dropMat = SR.M.basic(0xdff2ea, { transparent: true, opacity: 0.82 });
  const drops = [];
  const dropSources = [
    [1.70, 1.12, 3.55], [0.62, 1.12, 3.55], [1.15, 1.12, 4.18],
    [-2.10, 3.20, 5.60], [1.00, 3.05, 8.70], [5.9, 2.90, -3.40],
    [7.75, 0.32, 0.15], [6.15, 0.32, 0.15],
  ];
  dropSources.forEach((s, i) => {
    const d = SR.add(g, SR.G.sph(0.022, 7, 6), dropMat, s, null, false);
    d.scale.set(0.8, 1.5, 0.8);
    drops.push({ m: d, x: s[0], y: s[1], z: s[2], ph: i * 1.37, period: SR.rnd(2.6, 5.2) });
  });
  SR.obj.drops = drops;

  /* ---------------- 船舷 / 灯罩上的雨珠闪光 ---------------- */
  const sparkMat = SR.M.basic(SR.C.warm, { transparent: true, opacity: 0.85 });
  const sparks = [];
  for (let i = 0; i < 34; i++) {
    const b = SR.obj.boats[Math.floor(SR.rand() * SR.obj.boats.length)];
    const x = b.x + SR.rnd(-0.6, 0.6), z = b.z + SR.rnd(-1.6, 1.6);
    const s = SR.add(g, SR.G.sph(SR.rnd(0.009, 0.020), 6, 5), sparkMat,
      [x, SR.rnd(0.30, 0.55), z], null, false);
    sparks.push({ m: s, ph: SR.rnd(0, 10) });
  }
  SR.obj.sparkles = sparks;
};

})();
