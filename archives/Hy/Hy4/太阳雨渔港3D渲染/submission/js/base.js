/* ========================================================================
   base.js — L 形码头陆地、岸壁剖面细节、山坡民家、防波堤灯塔、消波块
   ======================================================================== */
(function () {
'use strict';
const T = window.THREE;
const SR = window.SR;
const tx = SR.tex;

function capStrip(parent, x, z, w, d, y, mat) {
  SR.box(parent, w, 0.10, d, mat, [x, y, z], null, false);
}

/* 消波块：四条腿的混凝土 tetrapod */
function tetrapod(parent, x, y, z, s, rot) {
  const grp = new T.Group();
  grp.position.set(x, y, z);
  grp.rotation.set(rot[0], rot[1], rot[2]);
  grp.scale.setScalar(s);
  parent.add(grp);
  const mat = SR.M.toon(0xaebdb4);
  SR.add(grp, SR.G.sph(0.30, 12, 9), mat, [0, 0, 0], null, 20);
  const dirs = [
    new T.Vector3(1, 1, 1), new T.Vector3(-1, -1, 1),
    new T.Vector3(-1, 1, -1), new T.Vector3(1, -1, -1),
  ];
  const up = new T.Vector3(0, 1, 0);
  for (const d of dirs) {
    const n = d.clone().normalize();
    const leg = SR.add(grp, SR.G.cyl(0.14, 0.23, 0.78, 10), mat, n.clone().multiplyScalar(0.36).toArray(), null, 20);
    leg.quaternion.setFromUnitVectors(up, n);
    const foot = SR.add(grp, SR.G.cyl(0.20, 0.20, 0.14, 10), mat,
      n.clone().multiplyScalar(0.76).toArray(), null, 20);
    foot.quaternion.setFromUnitVectors(up, n);
  }
  return grp;
}

/* 一株低多边形树 */
function tree(parent, x, y, z, s, color) {
  const grp = new T.Group();
  grp.position.set(x, y, z);
  grp.scale.setScalar(s);
  parent.add(grp);
  SR.cyl(grp, 0.055, 0.085, 0.52, SR.M.toon(SR.C.woodDark), [0, 0.26, 0], null, 7, false);
  const crown = new T.Group();
  crown.position.y = 0.62;
  grp.add(crown);
  const c = color || SR.C.leaf;
  SR.add(crown, SR.G.sph(0.42, 9, 7), SR.M.toon(c), [0, 0.10, 0], null, false).scale.set(1, 0.9, 1);
  SR.add(crown, SR.G.sph(0.30, 9, 7), SR.M.toon(SR.C.leafLight), [0.25, -0.02, 0.12], null, false);
  SR.add(crown, SR.G.sph(0.27, 9, 7), SR.M.toon(SR.C.leafDark), [-0.24, 0.02, -0.10], null, false);
  SR.obj.trees.push({ g: crown, ph: SR.rnd(0, 10), z: z, amp: SR.rnd(0.04, 0.09) });
  return grp;
}

/* 瓦顶民家 */
function house(parent, x, y, z, s, rot) {
  const grp = new T.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rot || 0;
  grp.scale.setScalar(s || 1);
  parent.add(grp);
  SR.box(grp, 1.05, 0.68, 0.86, SR.M.toon(SR.C.plaster), [0, 0.34, 0], null, 30);
  /* 四坡瓦顶 */
  const roof = SR.M.toon(SR.C.tile, { side: T.DoubleSide });
  const r1 = SR.add(grp, SR.G.plane(1.28, 0.78), roof, [0, 0.83, 0.44], [-0.62, 0, 0], false);
  const r2 = SR.add(grp, SR.G.plane(1.28, 0.78), roof, [0, 0.83, -0.44], [0.62, 0, 0], false);
  const r3 = SR.add(grp, SR.G.plane(0.78, 0.78), roof, [0.63, 0.83, 0], [0, 0, 0.62], false);
  const r4 = SR.add(grp, SR.G.plane(0.78, 0.78), roof, [-0.63, 0.83, 0], [0, 0, -0.62], false);
  [r1, r2, r3, r4].forEach(m => { m.material.side = T.DoubleSide; });
  /* 屋脊 */
  SR.box(grp, 1.10, 0.05, 0.05, SR.M.toon(SR.C.tileLight), [0, 1.05, 0], null, false);
  /* 门窗 */
  SR.box(grp, 0.26, 0.40, 0.02, SR.M.toon(SR.C.woodDark), [-0.22, 0.20, 0.44], null, false);
  SR.box(grp, 0.20, 0.20, 0.02, SR.M.toon(0xbfe0dc), [0.25, 0.38, 0.44], null, false);
  SR.box(grp, 0.03, 0.22, 0.03, SR.M.toon(SR.C.iron), [0.25, 0.38, 0.45], null, false);
  SR.box(grp, 0.20, 0.03, 0.03, SR.M.toon(SR.C.iron), [0.25, 0.38, 0.45], null, false);
  return grp;
}

SR.build.base = function () {
  const g = SR.group('base');
  const H = -SR.BASE_BOTTOM;
  const cy = SR.BASE_BOTTOM + H / 2;
  const concreteTex = tx.concrete();
  const wallTex = tx.wall();

  /* ---------------- 陆地分块 ---------------- */
  const capMat = SR.M.toon(SR.C.concreteLit);
  SR.LAND.forEach(r => {
    const w = r.x2 - r.x1, d = r.z2 - r.z1;
    const cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
    const top = SR.M.toon(0xffffff, { map: tx.tiled(concreteTex, Math.max(1, w / 4), Math.max(1, d / 4)) });
    const sideX = SR.M.toon(0xffffff, { map: tx.tiled(wallTex, Math.max(1, d / 3), 1) });
    const sideZ = SR.M.toon(0xffffff, { map: tx.tiled(wallTex, Math.max(1, w / 3), 1) });
    const bottomMat = SR.M.toon(SR.C.deepTeal);
    const mats = [sideX, sideX, top, bottomMat, sideZ, sideZ];
    const box = SR.add(g, SR.G.box(w, H, d), mats, [cx, cy, cz], null, false);
    box.receiveShadow = true;
    box.name = r.name;
    /* 顶面压顶石 */
    capStrip(g, cx, r.z1 + 0.06, w, 0.12, 0.045, capMat);
    capStrip(g, cx, r.z2 - 0.06, w, 0.12, 0.045, capMat);
    capStrip(g, r.x1 + 0.06, cz, 0.12, d, 0.045, capMat);
    capStrip(g, r.x2 - 0.06, cz, 0.12, d, 0.045, capMat);
  });

  /* ---------------- 岸壁细节：藤壶、牡蛎、系船环、铁梯 ---------------- */
  const barnacleMats = [SR.M.toon(0xd6dccb), SR.M.toon(0xbcc6b6), SR.M.toon(0xc9d0bd)];
  const wallX = 2.0;   // 面向内湾的长岸壁
  for (let i = 0; i < 170; i++) {
    const z = SR.rnd(-5, 10);
    const y = SR.rnd(-2.45, -1.15);
    const r = SR.rnd(0.025, 0.085);
    SR.add(g, SR.G.sph(r, 6, 5), SR.pick(barnacleMats),
      [wallX + 0.02, y, z], [SR.rand() * 3, SR.rand() * 3, SR.rand() * 3], false);
  }
  /* 主堤岸朝相机的 +z 侧壁 */
  for (let i = 0; i < 90; i++) {
    const x = SR.rnd(-10, 2);
    const y = SR.rnd(-2.45, -1.25);
    SR.add(g, SR.G.sph(SR.rnd(0.025, 0.075), 6, 5), SR.pick(barnacleMats),
      [x, y, 10.02], [SR.rand() * 3, SR.rand() * 3, SR.rand() * 3], false);
  }
  /* 牡蛎壳（稍大的扁片） */
  const oysterMat = SR.M.toon(0xc9cdb8, { side: T.DoubleSide });
  for (let i = 0; i < 44; i++) {
    const z = SR.rnd(-4.8, 9.8);
    const m = SR.add(g, SR.G.plane(0.18, 0.12), oysterMat,
      [wallX + 0.025, SR.rnd(-2.3, -1.5), z], [0, SR.PI / 2, SR.rnd(-1, 1)], false);
    m.scale.set(1, 1, SR.rnd(0.6, 1.4));
  }

  /* 系船环 + 短链 */
  const ringMat = SR.M.toon(0x596b68);
  for (let i = 0; i < 6; i++) {
    const z = -4.0 + i * 2.55;
    const ring = SR.add(g, SR.G.torus(0.15, 0.035, 7, 14), ringMat,
      [wallX + 0.10, -0.42, z], [0, SR.PI / 2, 0], false);
    SR.box(g, 0.10, 0.10, 0.10, SR.M.toon(SR.C.iron), [wallX + 0.05, -0.38, z], null, false);
    for (let k = 0; k < 5; k++) {
      SR.add(g, SR.G.torus(0.045, 0.014, 5, 8), ringMat,
        [wallX + 0.13 + k * 0.05, -0.52 - k * 0.07, z], [0, SR.PI / 2 + k * 0.5, 0], false);
    }
  }

  /* 锈蚀铁梯（沿岸壁向下） */
  const ladder = new T.Group();
  ladder.position.set(wallX + 0.16, -0.1, 5.4);
  g.add(ladder);
  const ironMat = SR.M.toon(0xffffff, { map: tx.rust('#8b9a95') });
  for (const s of [-1, 1]) SR.cyl(ladder, 0.035, 0.035, 2.25, ironMat, [0, -1.12, s * 0.28], null, 8, false);
  for (let i = 0; i < 9; i++) {
    SR.cyl(ladder, 0.026, 0.026, 0.62, ironMat, [0.02, -0.25 - i * 0.24, 0], [SR.PI / 2, 0, 0], 7, false);
  }
  /* 顶部弯钩扶手 */
  for (const s of [-1, 1]) {
    SR.tube(ladder, [[0, 0, s * 0.28], [0, 0.4, s * 0.28], [0.14, 0.48, s * 0.28], [0.24, 0.42, s * 0.28]],
      0.03, ironMat, 12, 6);
  }

  /* 岸壁底部随水轻轻摆动的海藻 */
  const kelpMats = [
    SR.M.toon(0x6d9f79, { side: T.DoubleSide, transparent: true, opacity: 0.92 }),
    SR.M.toon(0x84b47c, { side: T.DoubleSide, transparent: true, opacity: 0.92 }),
    SR.M.toon(0x5b9370, { side: T.DoubleSide, transparent: true, opacity: 0.92 }),
  ];
  for (let k = 0; k < 16; k++) {
    const kz = SR.rnd(-4.6, 9.6);
    const cl = new T.Group();
    cl.position.set(wallX + 0.045, SR.rnd(-2.15, -1.25), kz);
    g.add(cl);
    for (let b = 0; b < 3; b++) {
      const kh = SR.rnd(0.34, 0.78), kw = SR.rnd(0.05, 0.11);
      SR.add(cl, SR.G.plane(kw, kh, 1, 4), SR.pick(kelpMats),
        [SR.rnd(-0.09, 0.09), kh / 2, SR.rnd(-0.03, 0.03)], [0, 0, SR.rnd(-0.22, 0.22)], false);
    }
    SR.obj.kelp.push({ g: cl, ph: SR.rnd(0, 10), z: kz });
  }

  /* ---------------- 山坡岬角与瓦顶民家 ---------------- */
  const hill = new T.Group();
  hill.position.set(-8.3, 0, -8.2);
  g.add(hill);
  const soilMat = SR.M.toon(0x9aad86);
  const rockMat = SR.M.toon(0x83988b);
  SR.add(hill, SR.G.cyl(1.55, 2.05, 0.62, 9), rockMat, [0, -0.31, 0], null, false);
  SR.add(hill, SR.G.cyl(1.42, 1.62, 1.25, 9), soilMat, [0, 0.32, 0], null, false);
  SR.add(hill, SR.G.cyl(0.92, 1.42, 0.82, 9), SR.M.toon(0x8aa377), [0, 1.30, 0], null, false);
  /* 草皮顶 */
  SR.add(hill, SR.G.cyl(0.94, 0.94, 0.10, 9), SR.M.toon(0x6fa15f), [0, 1.74, 0], null, false);
  /* 岩块 */
  for (let i = 0; i < 22; i++) {
    const a = SR.rand() * SR.TAU, r = SR.rnd(1.3, 2.1);
    SR.add(hill, new T.IcosahedronGeometry(SR.rnd(0.14, 0.38), 0), SR.pick([rockMat, SR.M.toon(0x8fa79d)]),
      [Math.cos(a) * r, SR.rnd(-0.45, 0.1), Math.sin(a) * r], [SR.rand() * 3, SR.rand() * 3, SR.rand() * 3], false);
  }
  /* 树 */
  const treePositions = [[-0.55, 1.8, -0.35, 0.95], [0.55, 1.8, -0.5, 1.1], [0.1, 1.8, 0.55, 0.85],
    [-0.85, 1.72, 0.4, 0.8], [0.85, 1.72, 0.45, 0.9], [-0.3, 1.78, 0.8, 0.7]];
  treePositions.forEach(p => tree(hill, p[0], p[1], p[2], p[3], SR.pick([SR.C.leaf, SR.C.leafLight, SR.C.leafDark])));
  /* 民家 */
  house(hill, -0.45, 1.76, -0.05, 0.62, 0.35);
  house(hill, 0.48, 1.76, 0.12, 0.55, -0.3);
  house(hill, 0.05, 1.76, 0.72, 0.48, 0.1);
  /* 蜿蜒小路 */
  const pathPts = [];
  for (let i = 0; i <= 18; i++) {
    const p = i / 18;
    const a = p * 2.6 - 0.4;
    const r = SR.lerp(1.45, 0.55, p);
    pathPts.push([Math.cos(a) * r, SR.lerp(0.45, 1.78, p) + 0.02, Math.sin(a) * r * 0.8]);
  }
  SR.tube(hill, pathPts, 0.10, SR.M.toon(0xd6d2bb), 36, 5);

  /* ---------------- 短防波堤与红白灯塔 ---------------- */
  const lg = new T.Group();
  lg.position.set(7.5, 0, -7.3);
  g.add(lg);
  /* 灯塔基座 */
  SR.cyl(lg, 0.62, 0.70, 0.24, SR.M.toon(SR.C.concreteDim), [0, 0.12, 0], null, 12, 28);
  /* 塔身：红白相间 */
  const lhR = SR.M.toon(SR.C.lighthouseR), lhW = SR.M.toon(SR.C.lighthouseW);
  for (let i = 0; i < 6; i++) {
    SR.cyl(lg, 0.40 - i * 0.025, 0.43 - i * 0.025, 0.36, i % 2 === 0 ? lhW : lhR,
      [0, 0.24 + 0.18 + i * 0.36, 0], null, 14, 20);
  }
  /* 灯室平台 */
  SR.cyl(lg, 0.52, 0.52, 0.09, SR.M.toon(SR.C.iron), [0, 2.62, 0], null, 14, 20);
  SR.cyl(lg, 0.36, 0.36, 0.36, SR.M.toon(0xf7e6b8, { transparent: true, opacity: 0.30, side: T.DoubleSide }), [0, 2.84, 0], null, 12, false);
  /* 灯室内灯泡 */
  const bulb = SR.add(lg, SR.G.sph(0.15, 10, 8), SR.M.basic(0xfff0b8), [0, 2.84, 0], null, false);
  SR.obj.lighthouseBulb = bulb;
  /* 灯光晕 */
  const beam = new T.Mesh(SR.G.sph(0.42, 12, 10), SR.M.basic(0xffe9a8, { transparent: true, opacity: 0, depthWrite: false }));
  beam.position.set(0, 2.84, 0);
  lg.add(beam);
  SR.obj.lighthouseBeam = beam;
  /* 顶盖 */
  SR.add(lg, SR.G.cone(0.48, 0.32, 14), lhR, [0, 3.20, 0], null, 20);
  /* 栏杆 */
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * SR.TAU;
    SR.cyl(lg, 0.018, 0.018, 0.26, SR.M.toon(SR.C.iron), [Math.cos(a) * 0.49, 2.76, Math.sin(a) * 0.49], null, 5, false);
  }
  SR.add(lg, SR.G.torus(0.49, 0.022, 6, 20), SR.M.toon(SR.C.iron), [0, 2.89, 0], [SR.PI / 2, 0, 0], false);
  /* 小门 */
  SR.box(lg, 0.20, 0.36, 0.03, SR.M.toon(0x6f8a86), [0, 0.42, 0.43], null, false);
  /* 防波堤端部消波块 */
  for (let i = 0; i < 2; i++) tetrapod(g, 6.6 + i * 0.95, 0.04, -8.45 + (i % 2) * 0.45, 0.50, [SR.rand(), SR.rand() * 3, SR.rand()]);

  /* ---------------- 远处长防波堤（淡雾背景） ---------------- */
  const farB = new T.Group();
  farB.position.set(0, 0, -9.4);
  g.add(farB);
  const farMat = SR.M.toon(0xb9cfc9);
  SR.box(farB, 9.5, 0.34, 0.55, farMat, [5.0, 0.08, 0], null, false);
  for (let i = 0; i < 9; i++) {
    SR.box(farB, 0.24, 0.16, 0.62, SR.M.toon(0xa8c2bd), [0.7 + i * 1.05, 0.30, 0], null, false);
  }
  /* 远处小灯柱 */
  for (let i = 0; i < 3; i++) {
    const x = 1.8 + i * 3.1;
    SR.cyl(farB, 0.028, 0.028, 0.62, SR.M.toon(0x8fa9a4), [x, 0.56, 0], null, 6, false);
    SR.sph(farB, 0.07, SR.M.toon(0xe8d9a0), [x, 0.90, 0], null, false);
  }

  /* ---------------- 底座边角消波块 ---------------- */
  const clusters = [[9.1, 9.0], [9.2, 6.9], [-9.2, 3.8], [9.3, -1.6]];
  clusters.forEach((c) => {
    for (let i = 0; i < 2; i++) {
      const x = c[0] + SR.rnd(-0.32, 0.32), z = c[1] + SR.rnd(-0.32, 0.32);
      const y = 0.02 + (i === 0 ? 0.26 : SR.rnd(0.0, 0.10));
      tetrapod(g, x, y, z, SR.rnd(0.46, 0.62), [SR.rnd(0, 1.5), SR.rand() * SR.TAU, SR.rnd(0, 1.5)]);
    }
  });

  /* 水下岸壁暗色投影（船底、岸壁阴影的深青色） */
  const shadeMat = SR.M.basic(SR.C.shadowTeal, { transparent: true, opacity: 0.10, depthWrite: false, side: T.DoubleSide });
  for (const r of SR.LAND) {
    const m = new T.Mesh(SR.G.plane(r.x2 - r.x1, r.z2 - r.z1), shadeMat);
    m.rotation.x = -SR.PI / 2;
    m.position.set((r.x1 + r.x2) / 2, SR.BASE_BOTTOM + 0.10, (r.z1 + r.z2) / 2);
    g.add(m);
  }
};

})();
