/* ========================================================================
   buildings.js — 渔协仓库（半拉卷帘门 + 可见室内）、候船室（落地玻璃 + 室内）
   ======================================================================== */
(function () {
'use strict';
const T = window.THREE;
const SR = window.SR;
const tx = SR.tex;

/* 卷帘门横纹 */
const shutterTex = tx.make(256, 256, (g, w, h) => {
  g.fillStyle = '#c8d0cb'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 13) {
    g.fillStyle = 'rgba(90,110,108,0.45)'; g.fillRect(0, y, w, 2);
    g.fillStyle = 'rgba(255,255,255,0.42)'; g.fillRect(0, y + 3, w, 2);
  }
  tx.stains(g, w, h, 26, ['#a5653d', '#b9c2bb', '#c99a6b'], 3, 16, 0.24);
  tx.grain(g, w, h, 1600, 'rgba(255,255,255,0.3)', 'rgba(70,90,88,0.3)');
});
/* 瓦片 */
const tileTex = tx.make(256, 256, (g, w, h) => {
  g.fillStyle = '#45666e'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 26) {
    for (let x = (y / 26 % 2) * -22; x < w; x += 44) {
      g.fillStyle = SR.pick(['#547780', '#3d5f68', '#62848a', '#375860']);
      g.fillRect(x + 2, y + 2, 40, 22);
      g.fillStyle = 'rgba(20,50,55,0.30)'; g.fillRect(x + 2, y + 22, 40, 3);
    }
  }
  tx.grain(g, w, h, 2200, 'rgba(255,255,255,0.22)', 'rgba(20,45,50,0.30)');
});
/* 光柱渐变 */
const shaftTex = tx.make(128, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(255,206,116,0.68)');
  grd.addColorStop(0.45, 'rgba(255,222,152,0.34)');
  grd.addColorStop(1, 'rgba(255,238,190,0)');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(w * 0.12, 0); g.lineTo(w * 0.88, 0);
  g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
});

function roof(parent, w, d, y, color) {
  const mat = SR.M.toon(0xffffff, { map: tx.tiled(tileTex, w / 1.6, d / 1.6), side: T.DoubleSide });
  const slope = 0.19;
  const half = d / 2 + 0.24;
  for (const s of [-1, 1]) {
    const m = SR.add(parent, SR.G.plane(w + 0.5, half), mat,
      [0, y + half * slope * 0.5, s * half * 0.5], [-SR.PI / 2 + s * slope, 0, 0], false);
    m.castShadow = false;
  }
  SR.box(parent, w + 0.55, 0.07, 0.10, SR.M.toon(color || SR.C.tileLight), [0, y + half * slope + 0.02, 0], null, false).castShadow = false;
  /* 檐口 */
  for (const s of [-1, 1]) SR.box(parent, w + 0.5, 0.05, 0.06, SR.M.toon(0x466a70), [0, y - 0.02, s * (d / 2 + 0.22)], null, false);
}

/* 白色塑料鱼箱 / 蓝色周转筐 */
function fishCrate(parent, x, y, z, w, h, d, blue, rot) {
  const grp = new T.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rot || 0;
  parent.add(grp);
  const mat = SR.M.toon(blue ? SR.C.plasticB : SR.C.plasticW);
  SR.box(grp, w, h, d, mat, [0, h / 2, 0], null, 24);
  /* 上沿 */
  SR.box(grp, w + 0.03, 0.035, d + 0.03, SR.M.toon(blue ? 0x6aa2c4 : 0xdfe8e0), [0, h, 0], null, false);
  /* 侧面镂空条纹 */
  for (let i = 0; i < 3; i++) {
    SR.box(grp, w + 0.004, 0.018, 0.02, SR.M.toon(blue ? 0x3d7799 : 0xc2cfc6),
      [0, h * (0.28 + i * 0.22), d / 2 + 0.004], null, false);
  }
  return grp;
}

SR.build.buildings = function () {
  const g = SR.group('buildings');
  const plaster = SR.M.toon(SR.C.plaster);
  const wallMat = SR.M.toon(0xdfe3d7);
  const frameMat = SR.M.toon(0x8a9a91);
  const glassMat = SR.M.glass({ opacity: 0.14 });
  const shineMat = SR.M.basic(0xffffff, { transparent: true, opacity: 0.11, depthWrite: false, side: T.DoubleSide });

  /* =================== 渔协仓库 =================== */
  const W = new T.Group();
  W.position.set(-7.15, 0, 7.35);
  g.add(W);
  /* 地板 */
  const floorW = SR.box(W, 4.3, 0.10, 3.7, SR.M.toon(0xb9c5ba), [0, 0.05, 0], null, false);
  floorW.receiveShadow = true;
  /* 后墙 -x */
  SR.box(W, 0.18, 2.80, 3.70, wallMat, [-2.15, 1.40, 0], null, 24);
  /* 左墙 -z */
  SR.box(W, 4.30, 2.80, 0.18, wallMat, [0, 1.40, -1.85], null, 24);
  /* 右墙 +z：开高窗 */
  SR.box(W, 4.30, 1.62, 0.18, wallMat, [0, 0.81, 1.85], null, 24);
  SR.box(W, 4.30, 0.50, 0.18, wallMat, [0, 2.55, 1.85], null, false);
  SR.box(W, 0.55, 0.68, 0.18, wallMat, [-1.87, 1.96, 1.85], null, false);
  SR.box(W, 0.55, 0.68, 0.18, wallMat, [1.87, 1.96, 1.85], null, false);
  const hiWin = new T.Mesh(SR.G.plane(3.15, 0.62), SR.M.glass({ opacity: 0.22 }));
  hiWin.position.set(0, 1.96, 1.86); hiWin.renderOrder = 12; W.add(hiWin);
  for (let i = -1; i <= 1; i++) SR.box(W, 0.035, 0.66, 0.04, frameMat, [i * 1.05, 1.96, 1.88], null, false);
  SR.box(W, 3.20, 0.05, 0.05, frameMat, [0, 1.62, 1.88], null, false);
  /* 前墙 +x：门洞（半拉卷帘门） */
  SR.box(W, 0.18, 2.05, 1.10, wallMat, [2.15, 1.025, -1.30], null, 24);
  SR.box(W, 0.18, 2.05, 0.70, wallMat, [2.15, 1.025, 1.50], null, 24);
  SR.box(W, 0.18, 0.75, 1.90, wallMat, [2.15, 2.425, 0.20], null, 24);
  /* 门洞内侧深色门框 */
  SR.box(W, 0.06, 2.05, 0.06, SR.M.toon(0x6f817b), [2.20, 1.025, -0.75], null, false);
  SR.box(W, 0.06, 2.05, 0.06, SR.M.toon(0x6f817b), [2.20, 1.025, 1.15], null, false);
  /* 卷轴与卷帘门片 */
  const roller = SR.cyl(W, 0.13, 0.13, 2.02, SR.M.toon(0x8b9a95), [2.22, 2.02, 0.20], [SR.PI / 2, 0, 0], 14, false);
  const shutter = new T.Mesh(SR.G.plane(1.92, 0.40), SR.M.toon(0xffffff, {
    map: tx.tiled(shutterTex, 1, 1), side: T.DoubleSide,
  }));
  shutter.position.set(2.235, 1.82, 0.20);
  shutter.rotation.y = SR.PI / 2;
  W.add(shutter);
  SR.box(W, 0.07, 0.055, 1.96, SR.M.toon(0x6d7c77), [2.245, 1.62, 0.20], null, false);
  /* 门洞上方遮雨檐 */
  SR.box(W, 0.55, 0.06, 2.35, SR.M.toon(0xffffff, { map: tx.rust('#b9c4bb') }), [2.42, 2.14, 0.20], null, false);
  /* 招牌 */
  const wsign = new T.Mesh(SR.G.plane(1.60, 0.34), SR.M.basic(0xffffff, {
    map: tx.board({ bg: '#e6e1cd', lines: ['漁協　倉庫'], fontSize: 68, w: 512, h: 120 }),
  }));
  wsign.position.set(2.25, 2.52, 0.20); wsign.rotation.y = SR.PI / 2; W.add(wsign);
  /* 屋顶 */
  roof(W, 4.3, 3.7, 2.80);

  /* ---- 仓库室内 ---- */
  /* 成垛鱼箱 */
  const crateSets = [
    [-0.55, 0, 0.65, 0], [0.35, 0, 0.75, 0.12], [-1.25, 0, -0.55, -0.08],
    [0.55, 0, -0.75, 0.2], [-0.15, 0, 1.35, 0.05],
  ];
  crateSets.forEach((c, i) => {
    const n = SR.rint(2, 4);
    for (let k = 0; k < n; k++) fishCrate(W, c[0], 0.10 + k * 0.23, c[1], 0.72, 0.22, 0.52, k === 2 && i % 2 === 0, c[3] + k * 0.02);
  });
  /* 蓝色周转筐一摞 */
  for (let k = 0; k < 3; k++) fishCrate(W, 1.35, 0.10 + k * 0.20, 0.85, 0.60, 0.19, 0.44, true, 0.15);
  /* 冰柜 */
  const freezer = SR.box(W, 0.78, 1.02, 0.66, SR.M.toon(0xe6ece4), [-1.45, 0.51, 1.05], null, 24);
  freezer.castShadow = false;
  SR.box(W, 0.66, 0.80, 0.02, SR.M.toon(0xc3d0c8), [-1.45, 0.58, 1.39], null, false);
  SR.box(W, 0.04, 0.22, 0.04, SR.M.toon(SR.C.metal), [-1.16, 0.70, 1.41], null, false);
  /* 磅秤 */
  const scale = new T.Group(); scale.position.set(0.85, 0.10, 0.15); W.add(scale);
  SR.box(scale, 0.56, 0.10, 0.48, SR.M.toon(0x8b9b94), [0, 0.05, 0], null, false);
  SR.box(scale, 0.50, 0.03, 0.42, SR.M.toon(SR.C.metal), [0, 0.12, 0], null, false);
  SR.cyl(scale, 0.025, 0.025, 0.55, SR.M.toon(SR.C.metal), [0, 0.40, -0.20], null, 7, false);
  SR.cyl(scale, 0.15, 0.15, 0.05, SR.M.toon(0xf0f0e4), [0, 0.68, -0.20], [SR.PI / 2, 0, 0], 14, false);
  SR.box(scale, 0.015, 0.11, 0.012, SR.M.toon(SR.C.buoyO), [0, 0.72, -0.17], [0, 0, 0.4], false);
  /* 墙上雨靴 */
  const bootMat = [SR.M.toon(0x4f6f5c), SR.M.toon(0x3c5250), SR.M.toon(0x6b7a58)];
  for (let i = 0; i < 4; i++) {
    const bx = -2.02, bz = 0.62 + i * 0.16;
    const boot = SR.cyl(W, 0.075, 0.10, 0.42, SR.pick(bootMat), [bx, 1.02, bz], null, 9, false);
    boot.rotation.z = 0.12 * (i % 2 ? 1 : -1);
    SR.box(W, 0.16, 0.10, 0.20, SR.pick(bootMat), [bx + 0.06, 0.82, bz], null, false);
  }
  SR.box(W, 0.05, 0.05, 0.82, SR.M.toon(0x7b8a80), [-2.00, 1.26, 0.86], null, false);
  /* 黑板（拍卖价格）：挂在正对门洞的后墙上，清楚可见 */
  const bb = new T.Mesh(SR.G.plane(0.96, 0.70), SR.M.basic(0xffffff, { map: tx.blackboard(), side: T.DoubleSide }));
  bb.position.set(-2.02, 1.10, -0.18);
  bb.rotation.y = SR.PI / 2;
  W.add(bb);
  /* 地面反光水渍 */
  for (let i = 0; i < 8; i++) {
    const m = new T.Mesh(SR.G.plane(SR.rnd(0.4, 1.1), SR.rnd(0.3, 0.8)),
      SR.M.basic(0xffffff, { map: tx.blob(), transparent: true, opacity: SR.rnd(0.10, 0.24), depthWrite: false, side: T.DoubleSide }));
    m.rotation.x = -SR.PI / 2;
    m.position.set(SR.rnd(-1.8, 1.8), 0.105, SR.rnd(-1.5, 1.5));
    W.add(m);
  }
  /* 散落冰块 */
  const iceMat = SR.M.toon(0xdff0ec, { transparent: true, opacity: 0.78, side: T.DoubleSide });
  for (let i = 0; i < 16; i++) {
    const s = SR.rnd(0.05, 0.11);
    SR.add(W, SR.G.box(s, s * 0.8, s), iceMat,
      [SR.rnd(-1.6, 1.9), 0.11, SR.rnd(-1.4, 1.6)], [SR.rand(), SR.rand() * 3, SR.rand()], false);
  }
  /* 淡金色光柱（从高窗射入） */
  for (let i = 0; i < 4; i++) {
    const shaft = new T.Mesh(SR.G.plane(0.55, 2.6), SR.M.basic(0xffffff, {
      map: shaftTex, transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide,
    }));
    shaft.position.set(-1.2 + i * 0.8, 1.25, 0.95);
    shaft.rotation.set(-0.62, 0, (i - 1.5) * 0.06);
    shaft.renderOrder = 14;
    W.add(shaft);
    SR.obj.interiorLights.push({ m: shaft, ph: i * 1.7, kind: 'shaft' });
  }
  /* 天花板粼粼反光 */
  const ceilCaus = new T.Mesh(SR.G.plane(3.4, 2.8), SR.M.basic(0xffffff, {
    map: tx.caustic(), transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide,
  }));
  ceilCaus.rotation.x = SR.PI / 2;
  ceilCaus.position.set(0, 2.72, 0);
  W.add(ceilCaus);
  SR.obj.caustics.push({ m: ceilCaus, ph: 0.4 });
  /* 仓库内暖光 */
  const wLight = new T.PointLight(0xffe6b0, 0.42, 6, 2);
  wLight.position.set(0.3, 2.1, 0.2);
  W.add(wLight);

  /* =================== 候船室 =================== */
  const R = new T.Group();
  R.position.set(-7.65, 0, 3.40);
  g.add(R);
  SR.box(R, 3.3, 0.10, 2.4, SR.M.toon(0xc9c0a8), [0, 0.05, 0], null, false).receiveShadow = true;
  /* 后墙 -x */
  SR.box(R, 0.16, 2.20, 2.40, wallMat, [-1.65, 1.10, 0], null, 24);
  /* 左墙 -z */
  SR.box(R, 3.30, 2.20, 0.16, wallMat, [0, 1.10, -1.20], null, 24);
  /* +z 落地玻璃 */
  SR.box(R, 3.30, 0.28, 0.12, wallMat, [0, 0.14, 1.20], null, false);
  SR.box(R, 3.30, 0.20, 0.12, wallMat, [0, 2.10, 1.20], null, false);
  const glassZ = new T.Mesh(SR.G.plane(3.20, 1.70), glassMat);
  glassZ.position.set(0, 1.20, 1.215); glassZ.renderOrder = 12; R.add(glassZ);
  for (let i = -1; i <= 1; i++) SR.box(R, 0.045, 1.72, 0.05, frameMat, [i * 1.05, 1.20, 1.23], null, false);
  SR.box(R, 3.24, 0.04, 0.05, frameMat, [0, 1.15, 1.23], null, false);
  /* +x 落地玻璃 */
  SR.box(R, 0.12, 0.28, 2.40, wallMat, [1.65, 0.14, 0], null, false);
  SR.box(R, 0.12, 0.20, 2.40, wallMat, [1.65, 2.10, 0], null, false);
  const glassX = new T.Mesh(SR.G.plane(2.30, 1.70), glassMat);
  glassX.position.set(1.665, 1.20, 0); glassX.rotation.y = SR.PI / 2; glassX.renderOrder = 12; R.add(glassX);
  SR.box(R, 0.05, 1.72, 0.045, frameMat, [1.68, 1.20, 0], null, false);
  SR.box(R, 0.05, 0.04, 2.34, frameMat, [1.68, 1.15, 0], null, false);
  /* 玻璃斜高光 */
  for (let i = 0; i < 3; i++) {
    const s = new T.Mesh(SR.G.plane(0.14, 1.9), shineMat);
    s.position.set(-0.9 + i * 0.9, 1.2, 1.225); s.rotation.z = 0.42; s.renderOrder = 13; R.add(s);
  }
  /* 屋顶 */
  roof(R, 3.3, 2.4, 2.20);
  /* 招牌 */
  const rsign = new T.Mesh(SR.G.plane(1.40, 0.30), SR.M.basic(0xffffff, {
    map: tx.board({ bg: '#e6e1cd', lines: ['待合所'], fontSize: 72, w: 400, h: 120 }),
  }));
  rsign.position.set(0, 2.34, 1.28); R.add(rsign);

  /* ---- 候船室室内 ---- */
  /* 木长椅 */
  const bench = new T.Group(); bench.position.set(-0.85, 0.10, 0.15); R.add(bench);
  const woodMat = SR.M.toon(0xffffff, { map: tx.tiled(tx.wood('#c39a6b'), 1, 1) });
  SR.box(bench, 0.52, 0.07, 1.90, woodMat, [0, 0.44, 0], null, false).castShadow = false;
  SR.box(bench, 0.07, 0.48, 1.90, woodMat, [-0.24, 0.72, 0], null, false).castShadow = false;
  for (let i = 0; i < 3; i++) {
    for (const sz of [-1, 1]) SR.box(bench, 0.07, 0.42, 0.07, SR.M.toon(SR.C.woodDark), [0.16, 0.22, sz * 0.78], null, false);
    SR.box(bench, 0.52, 0.05, 0.06, SR.M.toon(SR.C.woodDark), [0, 0.24, (i - 1) * 0.7], null, false);
  }
  /* 航班时刻表（褪色） */
  const tt = new T.Mesh(SR.G.plane(0.62, 0.82), SR.M.basic(0xffffff, { map: tx.timetable(), side: T.DoubleSide }));
  tt.position.set(-1.55, 1.48, 0.42); tt.rotation.y = SR.PI / 2; R.add(tt);
  /* 老式收音机 */
  const table = new T.Group(); table.position.set(0.95, 0.10, -0.55); R.add(table);
  SR.box(table, 0.80, 0.05, 0.55, SR.M.toon(SR.C.woodDark), [0, 0.52, 0], null, false).castShadow = false;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) SR.box(table, 0.05, 0.50, 0.05, SR.M.toon(SR.C.woodDark), [sx * 0.34, 0.26, sz * 0.22], null, false);
  const radio = SR.box(table, 0.56, 0.30, 0.26, SR.M.toon(0xb98b58), [0, 0.69, 0], null, 20);
  radio.castShadow = false;
  SR.box(table, 0.26, 0.22, 0.02, SR.M.toon(0x8b8b78), [-0.12, 0.69, 0.14], null, false);
  for (let i = 0; i < 7; i++) SR.box(table, 0.02, 0.20, 0.005, SR.M.toon(0x6b6b58), [-0.23 + i * 0.035, 0.69, 0.152], null, false);
  SR.cyl(table, 0.035, 0.035, 0.03, SR.M.toon(SR.C.brass), [0.17, 0.69, 0.14], [SR.PI / 2, 0, 0], 10, false);
  SR.cyl(table, 0.008, 0.008, 0.42, SR.M.toon(SR.C.metal), [0.22, 0.98, -0.08], [0, 0, 0.25], 5, false);
  /* 热水壶与绿萝 */
  const corner = new T.Group(); corner.position.set(0.95, 0.10, 0.80); R.add(corner);
  SR.box(corner, 0.62, 0.05, 0.48, SR.M.toon(SR.C.woodDark), [0, 0.42, 0], null, false).castShadow = false;
  SR.cyl(corner, 0.10, 0.12, 0.24, SR.M.toon(SR.C.metal), [-0.14, 0.57, 0], null, 12, 20);
  SR.cyl(corner, 0.05, 0.05, 0.04, SR.M.toon(SR.C.iron), [-0.14, 0.71, 0], null, 10, false);
  SR.add(corner, SR.G.torus(0.07, 0.014, 5, 10, SR.PI), SR.M.toon(SR.C.iron), [-0.03, 0.62, 0], [0, SR.PI / 2, 0], false);
  /* 绿萝 */
  SR.cyl(corner, 0.11, 0.09, 0.16, SR.M.toon(0xb9784f), [0.17, 0.53, 0], null, 10, false);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * SR.TAU;
    const leaf = SR.add(corner, SR.G.plane(0.16, 0.24), SR.M.toon(SR.pick([SR.C.leaf, SR.C.leafLight, SR.C.leafDark]), { side: T.DoubleSide }),
      [0.17 + Math.cos(a) * 0.10, 0.70 + SR.rnd(-0.03, 0.12), Math.sin(a) * 0.10], [SR.rnd(-0.4, 0.4), a, SR.rnd(-0.5, 0.5)], false);
    SR.obj.trees.push({ g: leaf, ph: SR.rnd(0, 10), z: 3.4, amp: 0.03 });
  }
  /* 歪斜挂钟 */
  const clock = new T.Group(); clock.position.set(0.55, 1.60, -1.09); R.add(clock);
  clock.rotation.z = 0.10;
  SR.add(clock, SR.G.cyl(0.20, 0.20, 0.045, 20), SR.M.toon(0x6b7a70), [0, 0, 0], [SR.PI / 2, 0, 0], false);
  const cf = new T.Mesh(SR.G.plane(0.36, 0.36), SR.M.basic(0xffffff, { map: tx.clockFace(), transparent: true, side: T.DoubleSide }));
  cf.position.z = 0.028; clock.add(cf);
  /* 候船室暖光 */
  const rLight = new T.PointLight(0xffe9c0, 0.38, 5, 2);
  rLight.position.set(0, 1.8, 0);
  R.add(rLight);

  /* 建筑底部阴影 */
  SR.shadowBlob(g, -7.15, 7.35, 5.4, 4.8, 0.16);
  SR.shadowBlob(g, -7.65, 3.40, 4.2, 3.2, 0.16);
};

})();
