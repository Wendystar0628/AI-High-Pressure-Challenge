/* ========================================================================
   boats.js — 泊位船只外观 + 可透视的驾驶舱内部生活细节
   ======================================================================== */
(function () {
'use strict';
const T = window.THREE;
const SR = window.SR;
const tx = SR.tex;

/* 船壳几何：尖船头、方船尾、斜侧板 */
function hullGeo(L, W, topY, botY) {
  const d = [
    [0, -L / 2],
    [W * 0.40, -L * 0.30],
    [W * 0.50, L * 0.28],
    [W * 0.46, L * 0.50],
    [-W * 0.46, L * 0.50],
    [-W * 0.50, L * 0.28],
    [-W * 0.40, -L * 0.30],
  ];
  const b = d.map(p => [p[0] * 0.62, p[1] * 0.90]);
  const pos = [], uv = [], idx = [];
  d.forEach(p => { pos.push(p[0], topY, p[1]); uv.push(p[0] / W + 0.5, p[1] / L + 0.5); });
  b.forEach(p => { pos.push(p[0], botY, p[1]); uv.push(p[0] / W + 0.5, p[1] / L + 0.5); });
  pos.push(0, topY, 0); uv.push(0.5, 0.5);
  pos.push(0, botY, 0); uv.push(0.5, 0.5);
  const n = d.length;
  /* 侧面 */
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    idx.push(i, j, n + j, i, n + j, n + i);
  }
  const sideCount = idx.length;
  /* 甲板 */
  for (let i = 0; i < n; i++) idx.push(2 * n, (i + 1) % n, i);
  const deckCount = idx.length - sideCount;
  /* 底 */
  for (let i = 0; i < n; i++) idx.push(2 * n + 1, n + i, n + (i + 1) % n);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.addGroup(0, sideCount, 0);
  geo.addGroup(sideCount, deckCount, 1);
  geo.addGroup(sideCount + deckCount, idx.length - sideCount - deckCount, 2);
  geo.computeVertexNormals();
  return geo;
}

/* 白船漆：干净色面 + 局部磨损斑驳锈迹 */
const paintTex = tx.make(512, 512, (g, w, h) => {
  g.fillStyle = '#f2f5ef'; g.fillRect(0, 0, w, h);
  /* 水线 */
  const grd = g.createLinearGradient(0, h * 0.72, 0, h);
  grd.addColorStop(0, 'rgba(110,150,150,0)');
  grd.addColorStop(1, 'rgba(90,135,135,0.22)');
  g.fillStyle = grd; g.fillRect(0, h * 0.72, w, h * 0.28);
  tx.stains(g, w, h, 26, ['#e4e8df', '#dfe7e0', '#e9ece4'], 8, 40, 0.25);
  for (let i = 0; i < 22; i++) {
    const x = SR.rand() * w, y = SR.rnd(h * 0.45, h);
    tx.stains(g, w, h, 3, ['#b8875d', '#c99a6b', '#9c7048'], 2, 7, 0.34);
    g.fillStyle = 'rgba(170,110,66,0.28)';
    g.beginPath(); g.ellipse(x, y, SR.rnd(3, 12), SR.rnd(2, 6), 0, 0, SR.TAU); g.fill();
  }
  /* 竖向旧漆流痕 */
  for (let i = 0; i < 18; i++) {
    const x = SR.rand() * w, y = SR.rnd(0, h * 0.6);
    g.strokeStyle = 'rgba(150,160,150,0.12)'; g.lineWidth = SR.rnd(1, 4);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + SR.rnd(-2, 2), y + SR.rnd(20, 80)); g.stroke();
  }
  tx.grain(g, w, h, 3000, 'rgba(255,255,255,0.4)', 'rgba(120,140,135,0.35)');
});

function lifeRing(parent, x, y, z, rot) {
  const grp = new T.Group();
  grp.position.set(x, y, z);
  grp.rotation.set(0, rot || 0, 0);
  parent.add(grp);
  const orange = SR.M.toon(SR.C.buoyO), white = SR.M.toon(SR.C.buoyW);
  SR.add(grp, SR.G.torus(0.19, 0.055, 8, 20), orange, [0, 0, 0], null, false);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * SR.TAU + SR.PI / 4;
    const seg = SR.add(grp, new T.TorusGeometry(0.19, 0.058, 8, 6, 0.42), white, [0, 0, 0], [0, 0, a], false);
    seg.rotation.z = a;
  }
  /* 系绳 */
  SR.tube(grp, [[0, 0.18, 0], [0.02, 0.27, 0.02], [0.04, 0.30, 0.04]], 0.008, SR.M.toon(SR.C.rope), 8, 4);
  return grp;
}

function tireFender(parent, x, y, z) {
  const grp = new T.Group();
  grp.position.set(x, y, z);
  parent.add(grp);
  SR.add(grp, SR.G.torus(0.17, 0.062, 8, 16), SR.M.toon(0x3a4648), [0, 0, 0], [SR.PI / 2, 0, 0], false);
  SR.tube(grp, [[0, 0.06, 0], [0, 0.16, 0.01], [0, 0.22, 0.02]], 0.010, SR.M.toon(SR.C.ropeWet), 8, 4);
  return grp;
}

/* ---------------- 驾驶舱（含完整内部陈设） ---------------- */
function buildCabin(parent, opts) {
  const cab = new T.Group();
  cab.position.set(0, 0.30, opts.cz || 0.30);
  parent.add(cab);
  const halfW = 0.53, z0 = 0, z1 = 1.32, y0 = 0, y1 = 0.96;
  const white = SR.M.toon(SR.C.cabin);
  const frame = SR.M.toon(0xe7ece4);
  const dark = SR.M.toon(0x4e6665);

  /* 地板 */
  SR.box(cab, 1.02, 0.04, 1.30, SR.M.toon(0x9aa9a0), [0, 0.02, 0.66], null, false).castShadow = false;
  /* 四角立柱与上下横梁 */
  for (const sx of [-1, 1]) for (const sz of [0, 1]) {
    SR.box(cab, 0.055, y1, 0.055, frame, [sx * halfW, y1 / 2, sz ? z1 : z0], null, false);
  }
  for (const sz of [0, 1]) {
    SR.box(cab, 1.10, 0.055, 0.055, frame, [0, y1 - 0.03, sz ? z1 : z0], null, false);
    SR.box(cab, 1.10, 0.055, 0.055, frame, [0, 0.06, sz ? z1 : z0], null, false);
  }
  for (const sx of [-1, 1]) {
    SR.box(cab, 0.055, 0.05, 1.30, frame, [sx * halfW, y1 - 0.03, 0.66], null, false);
  }
  /* 顶棚（不投影，保证室内明亮） */
  const roof = SR.box(cab, 1.20, 0.075, 1.46, white, [0, y1 + 0.02, 0.66], null, 20);
  roof.castShadow = false;
  SR.box(cab, 1.26, 0.035, 1.52, SR.M.toon(0xd6ded6), [0, y1 + 0.07, 0.66], null, false).castShadow = false;

  /* 玻璃窗：+x / -x / +z / -z，透明可透视 */
  const glassMat = SR.M.glass({ opacity: 0.10 });
  function windowPane(w, h, pos, rot) {
    const m = new T.Mesh(SR.G.plane(w, h), glassMat);
    m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.renderOrder = 12;
    cab.add(m);
    /* 窗框十字细条 */
    return m;
  }
  windowPane(1.24, 0.78, [0, 0.50, z1], [0, 0, 0]);                 // +z 船尾窗
  windowPane(1.24, 0.78, [0, 0.50, z0], [0, SR.PI, 0]);              // -z 前窗
  windowPane(1.20, 0.78, [-halfW, 0.50, 0.66], [0, SR.PI / 2, 0]);   // -x 窗
  /* +x 面：前半玻璃，后半敞开舱门 */
  windowPane(0.70, 0.78, [halfW, 0.50, 0.35], [0, SR.PI / 2, 0]);
  /* 窗框中横档 */
  SR.box(cab, 0.02, 0.025, 1.26, frame, [halfW, 0.54, 0.66], null, false);
  SR.box(cab, 0.025, 0.025, 1.24, frame, [0, 0.54, z1], null, false);
  /* 玻璃斜向高光 */
  const shine = SR.M.basic(0xffffff, { transparent: true, opacity: 0.07, depthWrite: false, side: T.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const s = new T.Mesh(SR.G.plane(0.10, 1.0), shine);
    s.position.set(halfW + 0.006, 0.5, 0.10 + i * 0.28);
    s.rotation.set(0, SR.PI / 2, 0.5);
    s.renderOrder = 13;
    cab.add(s);
  }
  const s2 = new T.Mesh(SR.G.plane(0.12, 1.1), shine);
  s2.position.set(-0.24 + 0.0, 0.5, z1 + 0.006);
  s2.rotation.z = 0.5; s2.renderOrder = 13; cab.add(s2);

  /* ---- 敞开的舱门（+x 后半部，向外打开） ---- */
  const door = new T.Group();
  door.position.set(halfW, 0, z1);
  cab.add(door);
  door.rotation.y = -1.25;
  const dw = 0.60, dh = 0.86;
  SR.box(door, 0.035, dh, 0.035, frame, [0, dh / 2, 0], null, false);
  SR.box(door, 0.035, dh, 0.035, frame, [dw, dh / 2, 0], null, false);
  SR.box(door, dw, 0.035, 0.035, frame, [dw / 2, dh, 0], null, false);
  SR.box(door, dw, 0.035, 0.035, frame, [dw / 2, 0.06, 0], null, false);
  const dg = new T.Mesh(SR.G.plane(dw - 0.05, dh - 0.12), glassMat);
  dg.position.set(dw / 2, dh / 2, 0); dg.rotation.y = 0; dg.renderOrder = 12;
  door.add(dg);
  SR.box(door, 0.05, 0.05, 0.05, SR.M.toon(SR.C.brass), [dw - 0.09, dh * 0.5, 0.04], null, false);
  /* 门框在舱体上的立柱 */
  SR.box(cab, 0.05, y1, 0.05, frame, [halfW, y1 / 2, 0.70], null, false);

  /* ---- 内部：控制台、雷达屏、鱼探仪 ---- */
  const console1 = SR.box(cab, 0.86, 0.16, 0.34, dark, [0, 0.62, 0.26], [-0.30, 0, 0], 20);
  console1.castShadow = false;
  SR.box(cab, 0.88, 0.10, 0.34, SR.M.toon(0x5d7370), [0, 0.51, 0.34], null, false).castShadow = false;
  /* 雷达屏（发光） */
  const radar = new T.Mesh(SR.G.plane(0.30, 0.24), SR.M.basic(0xffffff, { map: tx.radar(), side: T.DoubleSide }));
  radar.position.set(-0.20, 0.73, 0.235); radar.rotation.x = -0.30; cab.add(radar);
  SR.box(cab, 0.34, 0.27, 0.03, SR.M.toon(0x354845), [-0.20, 0.73, 0.225], [-0.30, 0, 0], false).castShadow = false;
  const radar2 = new T.Mesh(SR.G.plane(0.28, 0.22), SR.M.basic(0xffffff, { map: tx.radar(), side: T.DoubleSide }));
  radar2.position.set(-0.20, 0.735, 0.243); radar2.rotation.x = -0.30; cab.add(radar2);
  SR.obj.interiorLights.push({ m: radar2, ph: SR.rnd(0, 10) });
  /* 鱼探仪 */
  const ff = new T.Mesh(SR.G.plane(0.22, 0.20), SR.M.basic(0xffffff, { map: tx.fishfinder(), side: T.DoubleSide }));
  ff.position.set(0.20, 0.72, 0.235); ff.rotation.x = -0.30; cab.add(ff);
  SR.box(cab, 0.25, 0.23, 0.03, SR.M.toon(0x354845), [0.20, 0.72, 0.225], [-0.30, 0, 0], false).castShadow = false;
  /* 按钮与旋钮 */
  for (let i = 0; i < 5; i++) {
    SR.cyl(cab, 0.012, 0.012, 0.02, SR.M.toon(SR.pick([SR.C.buoyO, SR.C.brass, SR.C.ironLight])),
      [-0.38 + i * 0.19, 0.72, 0.40], [SR.PI / 2 - 0.3, 0, 0], 6, false);
  }

  /* ---- 船舵 ---- */
  const wheel = new T.Group();
  wheel.position.set(0.0, 0.86, 0.60);
  wheel.rotation.x = 0.42;
  cab.add(wheel);
  SR.add(wheel, SR.G.torus(0.20, 0.022, 7, 18), SR.M.toon(SR.C.woodDark), [0, 0, 0], null, false);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * SR.TAU;
    const spoke = SR.box(wheel, 0.022, 0.42, 0.022, SR.M.toon(SR.C.woodDark), [0, 0, 0], [0, 0, a], false);
  }
  SR.cyl(wheel, 0.045, 0.045, 0.07, SR.M.toon(SR.C.brass), [0, 0, 0], [SR.PI / 2, 0, 0], 10, false);
  SR.cyl(wheel, 0.025, 0.035, 0.34, SR.M.toon(SR.C.iron), [0, -0.18, 0], null, 8, false);

  /* ---- 夹在板上的海图与潮汐表 ---- */
  const chart = new T.Group();
  chart.position.set(0.30, 0.66, 0.52);
  chart.rotation.set(-0.55, -0.35, 0);
  cab.add(chart);
  SR.box(chart, 0.46, 0.34, 0.025, SR.M.toon(SR.C.woodDark), [0, 0, 0], null, false).castShadow = false;
  const chartFace = new T.Mesh(SR.G.plane(0.42, 0.30), SR.M.basic(0xffffff, { map: tx.chart(), side: T.DoubleSide }));
  chartFace.position.z = 0.015; chart.add(chartFace);
  SR.box(chart, 0.14, 0.035, 0.03, SR.M.toon(SR.C.metal), [0, 0.18, 0.02], null, false);
  /* 潮汐表贴窗边 */
  const tide = new T.Mesh(SR.G.plane(0.19, 0.25), SR.M.basic(0xffffff, { map: tx.tideTable(), side: T.DoubleSide }));
  tide.position.set(-halfW + 0.02, 0.72, 0.95);
  tide.rotation.y = SR.PI / 2;
  cab.add(tide);

  /* ---- 保温壶与搪瓷杯 ---- */
  const shelf = SR.box(cab, 0.40, 0.035, 0.26, SR.M.toon(SR.C.woodDark), [-0.26, 0.52, 1.02], null, false);
  shelf.castShadow = false;
  const flask = new T.Group(); flask.position.set(-0.34, 0.54, 1.02); cab.add(flask);
  SR.cyl(flask, 0.065, 0.065, 0.24, SR.M.toon(SR.C.metal), [0, 0.12, 0], null, 12, 20);
  SR.cyl(flask, 0.055, 0.055, 0.05, SR.M.toon(SR.C.buoyO), [0, 0.26, 0], null, 12, false);
  SR.add(flask, SR.G.torus(0.055, 0.012, 5, 10, SR.PI), SR.M.toon(SR.C.iron), [0.06, 0.16, 0], [0, 0, -SR.PI / 2], false);
  const cup = new T.Group(); cup.position.set(-0.14, 0.54, 1.02); cab.add(cup);
  SR.cyl(cup, 0.045, 0.040, 0.085, SR.M.toon(0xf3f4ea), [0, 0.043, 0], null, 12, 20);
  SR.add(cup, SR.G.torus(0.045, 0.008, 5, 12), SR.M.toon(SR.C.plasticB), [0, 0.085, 0], [SR.PI / 2, 0, 0], false);
  SR.add(cup, SR.G.torus(0.028, 0.008, 5, 10, SR.PI * 1.2), SR.M.toon(0xf3f4ea), [0.05, 0.05, 0], [0, SR.PI / 2, 0], false);

  /* ---- 挂在钩上的黄色雨衣 ---- */
  const hook = SR.add(cab, SR.G.torus(0.028, 0.008, 5, 9, SR.PI), SR.M.toon(SR.C.iron),
    [-halfW + 0.05, 0.86, 1.08], [0, SR.PI / 2, 0], false);
  const coat = new T.Group();
  coat.position.set(-halfW + 0.06, 0.78, 1.08);
  coat.rotation.y = SR.PI / 2;
  cab.add(coat);
  const ym = SR.M.toon(SR.C.raincoat, { side: T.DoubleSide });
  SR.box(coat, 0.26, 0.32, 0.035, ym, [0, -0.16, 0], null, false);
  SR.add(coat, SR.G.cone(0.13, 0.16, 8), ym, [0, 0.06, 0], null, false);
  SR.box(coat, 0.07, 0.26, 0.04, ym, [-0.16, -0.18, 0], [0, 0, 0.25], false);
  SR.box(coat, 0.07, 0.26, 0.04, ym, [0.16, -0.18, 0], [0, 0, -0.25], false);
  SR.box(coat, 0.02, 0.28, 0.005, SR.M.toon(0xd9b23e), [0, -0.16, 0.02], null, false);

  /* ---- 护身符与渔获照片（贴窗边） ---- */
  const omamori = new T.Mesh(SR.G.plane(0.10, 0.15), SR.M.basic(0xffffff, { map: tx.omamori(), side: T.DoubleSide }));
  omamori.position.set(0, 0.88, z1 - 0.035);
  cab.add(omamori);
  const photo = new T.Mesh(SR.G.plane(0.25, 0.18), SR.M.basic(0xffffff, { map: tx.photo(), side: T.DoubleSide }));
  photo.position.set(halfW - 0.03, 0.76, 0.52);
  photo.rotation.y = SR.PI / 2;
  cab.add(photo);

  /* ---- 座椅 ---- */
  SR.box(cab, 0.34, 0.10, 0.30, SR.M.toon(0x6b7f7a), [0, 0.44, 0.92], null, false).castShadow = false;
  SR.box(cab, 0.34, 0.34, 0.06, SR.M.toon(0x6b7f7a), [0, 0.62, 1.08], [0.15, 0, 0], false).castShadow = false;

  /* ---- 舱内顶灯（暖色小发光片，不投影） ---- */
  const lamp = new T.Mesh(SR.G.plane(0.24, 0.12), SR.M.basic(0xffefc0, { transparent: true, opacity: 0.85, side: T.DoubleSide }));
  lamp.rotation.x = SR.PI / 2;
  lamp.position.set(0, y1 - 0.02, 0.66);
  cab.add(lamp);
  /* 舱内暖光，让玻璃后的陈设清楚可见 */
  const cabLight = new T.PointLight(0xffedc4, 0.52, 3.0, 2);
  cabLight.position.set(0, 0.82, 0.70);
  cab.add(cabLight);

  /* ---- 舱顶：桅杆、天线、雷达罩、遮阳铁架 ---- */
  const rig = new T.Group();
  rig.position.set(0, y1 + 0.10, 0.66);
  cab.add(rig);
  const metal = SR.M.toon(SR.C.metal);
  SR.cyl(rig, 0.022, 0.030, 1.15, metal, [0, 0.58, 0], null, 8, false);
  /* 雷达罩 */
  const dome = SR.add(rig, SR.G.sph(0.15, 12, 9), SR.M.toon(0xf0f2ea), [0, 1.02, 0], null, false);
  dome.scale.set(1.5, 0.65, 1.0);
  /* 天线 */
  for (const s of [-1, 1]) {
    SR.cyl(rig, 0.008, 0.008, 0.55, SR.M.toon(SR.C.iron), [s * 0.16, 0.85, 0], [0, 0, s * 0.32], 5, false);
  }
  SR.cyl(rig, 0.006, 0.006, 0.32, SR.M.toon(SR.C.iron), [0, 1.28, 0], null, 5, false);
  /* 航行灯 */
  SR.sph(rig, 0.045, SR.M.basic(0xd8564e), [-0.18, 0.42, 0], null, false);
  SR.sph(rig, 0.045, SR.M.basic(0x6fbf86), [0.18, 0.42, 0], null, false);
  /* 遮阳铁架 */
  const canopy = new T.Group();
  canopy.position.set(0, y1 + 0.30, 0.62);
  cab.add(canopy);
  for (const s of [-1, 1]) {
    SR.cyl(canopy, 0.014, 0.014, 0.34, SR.M.toon(SR.C.ironLight), [s * 0.52, 0.17, -0.52], null, 5, false);
    SR.cyl(canopy, 0.014, 0.014, 0.34, SR.M.toon(SR.C.ironLight), [s * 0.52, 0.17, 0.52], null, 5, false);
  }
  const shade = SR.box(canopy, 1.18, 0.025, 1.20, SR.M.toon(0xe8ede2), [0, 0.35, 0], null, false);
  shade.castShadow = false;
  SR.box(canopy, 1.20, 0.02, 0.02, SR.M.toon(SR.C.ironLight), [0, 0.36, -0.60], null, false);
  SR.box(canopy, 1.20, 0.02, 0.02, SR.M.toon(SR.C.ironLight), [0, 0.36, 0.60], null, false);

  return cab;
}

/* ---------------- 一艘船 ---------------- */
function makeBoat(opts) {
  const boat = new T.Group();
  boat.position.set(opts.x, 0.06, opts.z);
  boat.rotation.y = opts.rot || 0;
  SR.g.boats.add(boat);

  const L = opts.L || 3.5, W = opts.W || 1.28;
  const mats = [
    SR.M.toon(0xffffff, { map: paintTex }),
    SR.M.toon(SR.C.deck),
    SR.M.toon(SR.C.deepTeal),
  ];
  const hull = SR.add(boat, hullGeo(L, W, 0.30, -0.36), mats, null, null, 22);
  hull.castShadow = true; hull.receiveShadow = true;

  /* 船舷护舷条（沿甲板轮廓） */
  const railPts = [
    [0, 0.32, -L / 2], [W * 0.40, 0.32, -L * 0.30], [W * 0.50, 0.32, L * 0.28],
    [W * 0.46, 0.32, L * 0.50], [-W * 0.46, 0.32, L * 0.50], [-W * 0.50, 0.32, L * 0.28],
    [-W * 0.40, 0.32, -L * 0.30], [0, 0.32, -L / 2],
  ];
  SR.tube(boat, railPts, 0.032, SR.M.toon(SR.C.ironLight), 48, 6);
  /* 船舷深青水线：船底阴影的冷色，增强船体立体感 */
  const wlPts = [
    [0, -L / 2], [W * 0.40, -L * 0.30], [W * 0.50, L * 0.28],
    [W * 0.46, L * 0.50], [-W * 0.46, L * 0.50], [-W * 0.50, L * 0.28],
    [-W * 0.40, -L * 0.30], [0, -L / 2],
  ].map(p => [p[0] * 0.88, 0.085, p[1] * 0.90]);
  SR.tube(boat, wlPts, 0.024, SR.M.toon(SR.C.deepTeal), 48, 5);
  /* 甲板内衬 */
  SR.box(boat, W * 0.78, 0.02, L * 0.66, SR.M.toon(0xd7ded2), [0, 0.305, 0.05], null, false).castShadow = false;

  /* 船舷救生圈与旧轮胎护舷（面向相机 +x 侧） */
  lifeRing(boat, W * 0.50 + 0.10, 0.46, 0.55, SR.PI / 2);
  lifeRing(boat, -W * 0.50 - 0.10, 0.46, -0.4, -SR.PI / 2);
  tireFender(boat, W * 0.50 + 0.08, 0.12, 1.05);
  tireFender(boat, W * 0.50 + 0.08, 0.10, -0.95);
  tireFender(boat, -W * 0.50 - 0.08, 0.12, 0.20);

  /* 船名（贴在 +x 船舷） */
  const namePlane = new T.Mesh(SR.G.plane(0.9, 0.22),
    SR.M.basic(0xffffff, { map: tx.boatName(opts.name || '福丸'), transparent: true, side: T.DoubleSide }));
  namePlane.position.set(W * 0.50 + 0.012, 0.12, 1.30);
  namePlane.rotation.y = SR.PI / 2;
  boat.add(namePlane);

  /* 船头小栏杆与锚 */
  SR.cyl(boat, 0.014, 0.014, 0.42, SR.M.toon(SR.C.ironLight), [0, 0.50, -L * 0.40], null, 6, false);
  SR.add(boat, SR.G.torus(0.09, 0.016, 5, 10), SR.M.toon(SR.C.iron), [0, 0.68, -L * 0.40], [SR.PI / 2, 0, 0], false);

  if (opts.cabin) {
    buildCabin(boat, { cz: 0.02 });
  } else {
    /* 敞口小渔船：渔具、简易桅杆、遮阳棚 */
    SR.box(boat, W * 0.72, 0.12, 0.50, SR.M.toon(0xc9d2c4), [0, 0.36, 0.95], null, false).castShadow = false;
    /* 桅杆与横桁 */
    SR.cyl(boat, 0.020, 0.028, 1.35, SR.M.toon(SR.C.woodPale), [0, 0.98, -0.45], null, 8, false);
    SR.cyl(boat, 0.008, 0.008, 0.46, SR.M.toon(SR.C.iron), [0.10, 1.62, -0.45], [0, 0, 0.38], 5, false);
    /* 简单的遮阳铁架与帆布 */
    for (const s of [-1, 1]) {
      SR.cyl(boat, 0.014, 0.014, 0.60, SR.M.toon(SR.C.ironLight), [s * 0.44, 0.60, 0.62], null, 5, false);
    }
    const cover = SR.box(boat, 1.0, 0.02, 1.15, SR.M.toon(0xdfe6d6), [0, 0.90, 0.60], null, false);
    cover.castShadow = false;
    /* 渔具：鱼箱、网兜、浮球 */
    SR.box(boat, 0.44, 0.22, 0.32, SR.M.toon(SR.C.plasticW), [0.18, 0.42, 0.05], null, 20);
    SR.add(boat, SR.G.torus(0.11, 0.04, 6, 12), SR.M.toon(SR.C.buoyO), [-0.22, 0.40, -0.15], [SR.PI / 2, 0, 0], false);
    /* 短天线 */
    SR.cyl(boat, 0.006, 0.006, 0.34, SR.M.toon(SR.C.iron), [0.20, 1.62, -0.45], [0.2, 0, 0.1], 5, false);
  }

  /* 船尾小旗 */
  SR.cyl(boat, 0.010, 0.010, 0.46, SR.M.toon(SR.C.iron), [-W * 0.35, 0.52, L * 0.46], null, 5, false);
  const flag = SR.add(boat, SR.G.plane(0.24, 0.13), SR.M.toon(0xffffff, { map: tx.flag(), side: T.DoubleSide }),
    [-W * 0.35 + 0.13, 0.68, L * 0.46], [0, 0, 0], false);
  SR.obj.flags.push({ m: flag, z: opts.z, x: opts.x, ph: SR.rnd(0, 10), amp: 0.20, kind: 'flag' });

  /* 缆绳连接到泊位系船柱 */
  SR.tube(boat, [[W * 0.30, 0.30, -L * 0.42], [W * 0.45, 0.20, -L * 0.60], [0.30, 0.06, -2.05]],
    0.020, SR.M.toon(SR.C.rope), 16, 5);

  const rec = {
    g: boat, x: opts.x, z: opts.z, ph: SR.rnd(0, 10),
    amp: SR.rnd(0.012, 0.026), period: SR.rnd(3.2, 5.6),
    depart: !!opts.depart, name: opts.name,
  };
  SR.obj.boats.push(rec);
  return rec;
}

SR.build.boats = function () {
  SR.group('boats');
  const list = [
    { x: 2.95, z: 0.15, name: '第一福丸', cabin: false, rot: 0.02 },
    { x: 4.55, z: 0.15, name: '第三福丸', cabin: false, rot: -0.015 },
    { x: 6.15, z: 0.15, name: '第八福丸', cabin: true, rot: 0.015 },
    { x: 7.70, z: 0.15, name: '海友丸', cabin: true, rot: -0.02, depart: true },
  ];
  list.forEach(o => makeBoat(o));
  SR.obj.departBoat = SR.obj.boats.find(b => b.depart);
  SR.obj.boatHome = { x: SR.obj.departBoat.x, z: SR.obj.departBoat.z };
};

})();
