/* ========================================================================
   harbor.js — 护轮坎警示条、台阶平台、系船柱与缆绳、灯柱电线、告示牌、水洼
   ======================================================================== */
(function () {
'use strict';
const T = window.THREE;
const SR = window.SR;
const tx = SR.tex;

/* 一根码头灯柱：顶端圆环形灯罩 */
function lampPost(parent, x, z, scale) {
  const grp = new T.Group();
  grp.position.set(x, 0, z);
  grp.scale.setScalar(scale || 1);
  parent.add(grp);
  const iron = SR.M.toon(SR.C.iron);
  /* 基座 */
  SR.cyl(grp, 0.16, 0.20, 0.20, SR.M.toon(SR.C.concreteDim), [0, 0.10, 0], null, 10, 20);
  /* 杆 */
  SR.cyl(grp, 0.045, 0.065, 3.05, iron, [0, 1.72, 0], null, 10, false);
  SR.cyl(grp, 0.075, 0.075, 0.12, SR.M.toon(SR.C.ironLight), [0, 0.55, 0], null, 10, false);
  SR.cyl(grp, 0.075, 0.075, 0.12, SR.M.toon(SR.C.ironLight), [0, 2.20, 0], null, 10, false);
  /* 顶部圆环形灯罩 */
  const ring = SR.add(grp, SR.G.torus(0.30, 0.055, 8, 22), SR.M.toon(SR.C.ironLight),
    [0, 3.28, 0], [SR.PI / 2, 0, 0], false);
  /* 灯盘 / 发光罩 */
  const glow = SR.add(grp, SR.G.cyl(0.26, 0.20, 0.16, 16), SR.M.basic(0xfff2c4), [0, 3.22, 0], null, false);
  SR.add(grp, SR.G.cone(0.30, 0.20, 16), SR.M.toon(SR.C.ironLight), [0, 3.46, 0], null, false);
  /* 灯罩支柱 */
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * SR.TAU;
    SR.cyl(grp, 0.016, 0.016, 0.20, iron, [Math.cos(a) * 0.24, 3.14, Math.sin(a) * 0.24], null, 5, false);
  }
  /* 顶端小避雷针 */
  SR.cyl(grp, 0.012, 0.012, 0.22, iron, [0, 3.66, 0], null, 5, false);
  /* 挂环（雨珠附着处） */
  SR.add(grp, SR.G.torus(0.05, 0.012, 5, 9), iron, [0.30, 3.28, 0], [0, SR.PI / 2, 0], false);
  SR.obj.lamps.push({ g: grp, glow: glow, x: x, z: z });
  return grp;
}

/* 黑色铸铁系船柱 */
function bollard(parent, x, z, rot) {
  const grp = new T.Group();
  grp.position.set(x, 0, z);
  grp.rotation.y = rot || 0;
  parent.add(grp);
  const iron = SR.M.toon(SR.C.iron);
  SR.cyl(grp, 0.17, 0.21, 0.10, SR.M.toon(0x4a5658), [0, 0.05, 0], null, 12, 20);
  SR.cyl(grp, 0.115, 0.14, 0.34, iron, [0, 0.27, 0], null, 12, 20);
  SR.cyl(grp, 0.19, 0.155, 0.09, iron, [0, 0.48, 0], null, 12, 20);
  SR.add(grp, SR.G.sph(0.075, 10, 7), iron, [0, 0.53, 0], null, false);
  /* 横向双耳 */
  SR.box(grp, 0.44, 0.055, 0.09, iron, [0, 0.36, 0], null, false);
  return grp;
}

/* 绕系船柱数圈后垂入水中的粗缆绳 */
function mooringRope(parent, bx, bz, endX, endZ, wet) {
  const rope = SR.M.toon(SR.C.rope);
  const ropeWet = SR.M.toon(SR.C.ropeWet);
  const pts = [];
  /* 绕柱两三圈 */
  for (let i = 0; i <= 22; i++) {
    const a = i / 22 * SR.TAU * 2.6;
    const r = 0.17 - i / 22 * 0.02;
    pts.push([bx + Math.cos(a) * r, 0.34 + i / 22 * 0.10, bz + Math.sin(a) * r]);
  }
  /* 从柱到水边的弧线 */
  pts.push([bx + (endX - bx) * 0.28, 0.30, bz + (endZ - bz) * 0.28]);
  pts.push([bx + (endX - bx) * 0.62, 0.14, bz + (endZ - bz) * 0.62]);
  pts.push([endX, -0.05, endZ]);
  const tube = SR.tube(parent, pts, 0.030, rope, 48, 6);
  SR.obj.ropes.push({ m: tube, ph: SR.rnd(0, 10) });
  if (wet) {
    /* 浸水部分颜色变深 */
    const sub = [
      [endX, -0.04, endZ],
      [endX + (endX - bx) * 0.10, -0.24, endZ + (endZ - bz) * 0.10],
      [endX + (endX - bx) * 0.16, -0.52, endZ + (endZ - bz) * 0.16],
    ];
    SR.tube(parent, sub, 0.029, ropeWet, 14, 6);
  }
  return pts;
}

SR.build.harbor = function () {
  const g = SR.group('harbor');
  const hazardTex = tx.hazard();

  /* ---------------- 护轮坎 + 黄黑斜纹警示条 ---------------- */
  const curbMat = SR.M.toon(SR.C.concreteLit);
  const hazardMat = SR.M.toon(0xffffff, { map: tx.tiled(hazardTex, 6, 1) });
  const hazardTop = SR.M.toon(0xffffff, { map: tx.tiled(hazardTex, 6, 1) });

  function curb(x, z, w, d, face) {
    SR.box(g, w, 0.30, d, curbMat, [x, 0.15, z], null, 20);
    /* 朝水立面的警示条 */
    const h = 0.13;
    if (face === 'z') {
      SR.box(g, w, h, 0.012, hazardMat, [x, 0.17, z + d / 2 + 0.008], null, false);
      SR.box(g, w, 0.012, d, hazardTop, [x, 0.305, z], null, false);
    } else {
      SR.box(g, 0.012, h, d, hazardMat, [x + w / 2 + 0.008, 0.17, z], null, false);
      SR.box(g, w, 0.012, d, hazardTop, [x, 0.305, z], null, false);
    }
  }
  /* C 边：z=-2 面向泊位 */
  curb(5.10, -2 + 0.16, 6.15, 0.32, 'z');
  /* B 边：x=2 面向泊位（z 从 -2 到 1.9） */
  curb(2 - 0.16, 0.0, 0.32, 3.85, 'x');
  /* A 边：x=2 面向内湾（避开台阶区） */
  curb(2 - 0.16, 7.9, 0.32, 4.0, 'x');
  /* 短防波堤根部一小段 */
  curb(7.5, -5 + 0.16, 1.3, 0.32, 'z');

  /* ---------------- 矮混凝土台阶与上下船平台 ---------------- */
  const stepMat = SR.M.toon(SR.C.concrete);
  const stepEdge = SR.M.toon(SR.C.concreteLit);
  /* 台阶从堤岸(x=1.6)向水面(+x)下降，位于 z≈4.2 */
  const sz = 4.3;
  for (let i = 0; i < 4; i++) {
    const x = 1.62 + i * 0.34;
    const y = -0.055 - i * 0.115;
    SR.box(g, 0.36, 0.13, 1.55, stepMat, [x, y, sz], null, 20);
    SR.box(g, 0.37, 0.022, 1.56, stepEdge, [x, y + 0.075, sz], null, false);
  }
  /* 台阶侧墙 */
  SR.box(g, 1.45, 0.34, 0.13, SR.M.toon(SR.C.concreteDim), [2.15, -0.22, sz - 0.84], null, false);
  SR.box(g, 1.45, 0.34, 0.13, SR.M.toon(SR.C.concreteDim), [2.15, -0.22, sz + 0.84], null, false);
  /* 略低的上下船平台 */
  SR.box(g, 1.20, 0.14, 1.55, stepMat, [3.42, -0.43, sz], null, 20);
  for (let i = 0; i < 5; i++) {
    SR.box(g, 0.02, 0.012, 1.45, SR.M.toon(SR.C.concreteDim), [2.95 + i * 0.24, -0.35, sz], null, false);
  }
  /* 平台护角 */
  SR.box(g, 1.20, 0.10, 0.06, SR.M.toon(SR.C.concreteLit), [3.42, -0.31, sz - 0.78], null, false);
  /* 系船环在平台边 */
  SR.add(g, SR.G.torus(0.09, 0.022, 6, 12), SR.M.toon(0x5c6b68), [3.95, -0.32, sz], [SR.PI / 2, 0, 0], false);

  /* ---------------- 一列黑色铸铁系船柱 + 缆绳 ---------------- */
  const bollardSpots = [
    [2.55, -2.30, 0], [3.85, -2.30, 0], [5.15, -2.30, 0], [6.45, -2.30, 0], [7.75, -2.30, 0],
  ];
  bollardSpots.forEach((p, i) => {
    bollard(g, p[0], p[1], p[2]);
    mooringRope(g, p[0], p[1], p[0] + 0.28, -0.55, true);
  });
  /* 靠近前景堤岸的两只 */
  bollard(g, 1.55, 6.4, SR.PI / 2);
  bollard(g, 1.55, 8.6, SR.PI / 2);
  mooringRope(g, 1.55, 6.4, 2.5, 6.9, true);

  /* 缆绳浸入水中的深色段（额外几根从岸壁垂下） */
  for (let i = 0; i < 4; i++) {
    const z = -3.6 + i * 1.5;
    SR.tube(g, [[2.02, -0.15, z], [2.16, -0.6, z], [2.22, -1.25, z + 0.1], [2.30, -1.9, z + 0.22]],
      0.026, SR.M.toon(SR.C.ropeWet), 20, 6);
  }

  /* ---------------- 码头灯柱 ---------------- */
  lampPost(g, -2.4, 5.6, 1.0);
  lampPost(g, 0.7, 8.7, 0.92);
  lampPost(g, 5.9, -3.4, 0.88);
  lampPost(g, 0.55, -3.6, 0.82);

  /* 纤细电线从灯柱上方斜斜穿过天空 */
  const wireMat = new T.LineBasicMaterial({ color: 0x5a6d6c, transparent: true, opacity: 0.55 });
  const lw = [
    [[-2.4, 3.55, 5.6], [-0.9, 3.30, 3.2], [0.55, 3.12, -3.6]],
    [[0.7, 3.30, 8.7], [3.2, 3.20, 3.0], [5.9, 3.05, -3.4]],
    [[-2.4, 3.40, 5.6], [-5.6, 3.05, 2.0], [-8.0, 2.90, -2.0]],
  ];
  lw.forEach(pts => {
    const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1] - 0.15, p[2])));
    const g2 = new T.BufferGeometry().setFromPoints(curve.getPoints(28));
    g.add(new T.Line(g2, wireMat));
  });

  /* ---------------- 褪色告示牌 ---------------- */
  const sign = new T.Group();
  sign.position.set(-4.0, 0, 2.65);
  sign.rotation.y = 0.28;
  g.add(sign);
  for (const s of [-1, 1]) SR.cyl(sign, 0.045, 0.055, 1.55, SR.M.toon(0x7d8a82), [s * 0.75, 0.78, 0], null, 8, false);
  SR.box(sign, 1.75, 0.80, 0.07, SR.M.toon(0xd8d3bd), [0, 1.55, 0], null, 20);
  const signFace = new T.Mesh(SR.G.plane(1.66, 0.72), SR.M.basic(0xffffff, { map: tx.signHarbor() }));
  signFace.position.set(0, 1.55, 0.041);
  sign.add(signFace);
  /* 牌背 */
  const signBack = new T.Mesh(SR.G.plane(1.66, 0.72), SR.M.toon(0xc9c4ae));
  signBack.position.set(0, 1.55, -0.041);
  signBack.rotation.y = SR.PI;
  sign.add(signBack);
  /* 牌顶小遮檐 */
  SR.box(sign, 1.85, 0.05, 0.16, SR.M.toon(0x8f9a90), [0, 1.98, 0], null, false);

  /* 第二块小告示牌（注意落水） */
  const sign2 = new T.Group();
  sign2.position.set(6.4, 0, -2.9);
  sign2.rotation.y = -0.18;
  g.add(sign2);
  SR.cyl(sign2, 0.035, 0.045, 1.15, SR.M.toon(0x7d8a82), [0, 0.58, 0], null, 8, false);
  const board2 = new T.Mesh(SR.G.plane(0.95, 0.52), SR.M.basic(0xffffff, {
    map: tx.board({ bg: '#e7e2cd', lines: ['注意落水'], fontSize: 62, w: 384, h: 208 }),
  }));
  board2.position.set(0, 1.20, 0);
  sign2.add(board2);

  /* ---------------- 低洼水洼与倒影 ---------------- */
  const puddleMat = SR.M.basic(0x4f7f80, { transparent: true, opacity: 0.42, depthWrite: false, side: T.DoubleSide });
  const puddleReflTex = tx.reflection([]);
  function puddle(x, z, w, d, rot) {
    const pg = new T.Group();
    pg.position.set(x, 0, z);
    pg.rotation.y = rot || 0;
    g.add(pg);
    /* 湿边 */
    const wet = new T.Mesh(SR.G.plane(w * 1.35, d * 1.4),
      SR.M.basic(0x8aa8a2, { map: tx.blob(), transparent: true, opacity: 0.28, depthWrite: false, side: T.DoubleSide }));
    wet.rotation.x = -SR.PI / 2; wet.position.y = 0.008; pg.add(wet);
    /* 水面 */
    const pm = new T.Mesh(SR.G.plane(w, d), puddleMat);
    pm.rotation.x = -SR.PI / 2; pm.position.y = 0.014; pm.renderOrder = 4; pg.add(pm);
    /* 概括倒影色块 */
    const refl = new T.Mesh(SR.G.plane(w * 0.94, d * 0.94),
      SR.M.basic(0xffffff, { map: puddleReflTex, transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide }));
    refl.rotation.x = -SR.PI / 2; refl.position.y = 0.020; refl.renderOrder = 5; pg.add(refl);
    /* 船只 / 灯柱的白色倒影碎块 */
    for (let i = 0; i < 7; i++) {
      const b = new T.Mesh(SR.G.plane(SR.rnd(w * 0.15, w * 0.45), SR.rnd(0.03, 0.08)),
        SR.M.basic(SR.pick([SR.C.hull, SR.C.concreteLit, SR.C.deepTeal]),
          { transparent: true, opacity: SR.rnd(0.35, 0.75), depthWrite: false, side: T.DoubleSide }));
      b.rotation.x = -SR.PI / 2;
      b.position.set(SR.rnd(-w * 0.3, w * 0.3), 0.024, SR.rnd(-d * 0.35, d * 0.35));
      b.renderOrder = 6;
      pg.add(b);
    }
    return pg;
  }
  const p1 = puddle(-1.6, 6.4, 2.0, 1.35, 0.2);
  puddle(-3.6, 4.0, 1.25, 0.85, -0.3);
  puddle(0.0, 8.0, 1.0, 0.7, 0.5);
  /* 海鸥飞过的倒影（随时间掠过水洼） */
  const gullRefl = new T.Mesh(SR.G.plane(0.34, 0.08),
    SR.M.basic(SR.C.gull, { transparent: true, opacity: 0.6, depthWrite: false, side: T.DoubleSide }));
  gullRefl.rotation.x = -SR.PI / 2;
  gullRefl.position.set(-1.6, 0.028, 6.4);
  gullRefl.renderOrder = 7;
  g.add(gullRefl);
  SR.obj.gullRefl = gullRefl;

  /* 湿润地面：柔和高光斑与水渍 */
  for (let i = 0; i < 26; i++) {
    const x = SR.rnd(-9.5, 1.6), z = SR.rnd(2.3, 9.7);
    if (!SR.isLand(x, z)) continue;
    const m = new T.Mesh(SR.G.plane(SR.rnd(0.5, 1.8), SR.rnd(0.3, 1.1)),
      SR.M.basic(SR.pick([0xffffff, 0x7fa8a2, 0xffe3a0, 0xffedbc]), {
        map: tx.blob(), transparent: true, opacity: SR.rnd(0.06, 0.19), depthWrite: false, side: T.DoubleSide,
      }));
    m.rotation.x = -SR.PI / 2; m.position.set(x, 0.009, z);
    m.renderOrder = 2;
    g.add(m);
  }

  /* 岸线深色轮廓线（强化三渲二的纤细轮廓） */
  const outlineMat = new T.LineBasicMaterial({ color: SR.C.ink, transparent: true, opacity: 0.42 });
  function edgeLine(points) {
    const gg = new T.BufferGeometry().setFromPoints(points.map(p => new T.Vector3(p[0], p[1], p[2])));
    g.add(new T.Line(gg, outlineMat));
  }
  edgeLine([[2, 0.012, 2], [2, 0.012, 10], [-10, 0.012, 10]]);
  edgeLine([[2, 0.012, 2], [2, 0.012, -5]]);
  edgeLine([[2, 0.012, -2], [8.2, 0.012, -2]]);
  edgeLine([[8.2, 0.012, -2], [8.2, 0.012, -5]]);
};

})();
