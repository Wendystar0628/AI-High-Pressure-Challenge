/* 场景主体：底座、L形码头、岸壁剖面、台阶、系泊、防波堤、灯塔、山坡、消波块 */
(function () {
  'use strict';
  const H = window.H;
  const P = H.PAL;

  // ---------- 布局常量 ----------
  const L = (H.L = {
    BASE: 10, // 半宽
    BOT: -1.55,
    DECK: 0,
    WATER: -0.15,
    QUAY_E: -0.6, // 主码头东缘
    ARM_N: 3.4, // L臂北缘
    ARM_S: 7.6, // L臂南缘
    ARM_E: 4.6, // L臂东端
    BW_E: 6.2, // 防波堤东缘
    BW_N: -5.0, // 防波堤北端
  });

  // 水域矩形（不含防波堤/码头）
  L.WATER_RECTS = [
    [-0.6, -10, 4.6, 3.4], // 内湾
    [4.6, -10, 6.2, -5], // 防波堤以北
    [6.2, -10, 10, 3.4], // 东部水面
    [4.6, 3.4, 10, 7.6], // L臂以东
    [-0.6, 7.6, 10, 10], // L臂以南（外海）
  ];

  function texRepeat(tex, rx, ry) {
    const t = tex.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    return t;
  }

  H.buildWorld = function (scene) {
    const g = (H.g = {}); // 场景引用集合

    // ---------- 材质 ----------
    const concreteTex = H.texConcrete(7, 0xd2d2ca);
    const concreteTex2 = H.texConcrete(11, 0xc9c9c1);
    const seawallTex = H.texSeawall();
    const gravelTex = H.texGravel();
    const warnTex = H.texWarnStripe();

    const matConcrete = H.toonMat(0xb6b6ae, { map: concreteTex, steps: 4, gradKey: 'a' });
    const matConcrete2 = H.toonMat(0x9a9a92, { map: concreteTex2, steps: 4, gradKey: 'a' });
    const matSeawall = H.toonMat(0xaeaea6, { map: seawallTex, steps: 4, gradKey: 'a' });
    const matWarn = H.toonMat(0xffffff, { map: warnTex, steps: 3, gradKey: 'b' });
    const matGravel = H.toonMat(0x8a9890, { map: gravelTex, steps: 4, gradKey: 'a' });
    const matIron = H.toonMat(P.iron, { steps: 3, gradKey: 'b' });
    const matIron2 = H.toonMat(P.ironLight, { steps: 3, gradKey: 'b' });
    const matRust = H.toonMat(P.rust, { map: H.texRust(), steps: 3, gradKey: 'b' });
    const matWood = H.toonMat(P.wood, { map: H.texWood(55), steps: 3, gradKey: 'b' });
    const matGreen = H.toonMat(P.green, { steps: 3, gradKey: 'b' });
    const matGreenD = H.toonMat(P.greenDark, { steps: 3, gradKey: 'b' });
    const matGreenL = H.toonMat(P.greenLight, { steps: 3, gradKey: 'b' });
    const matWhite = H.toonMat(P.white, { steps: 3, gradKey: 'b' });
    const matRed = H.toonMat(P.red, { steps: 3, gradKey: 'b' });
    const matGold = H.toonMat(P.goldWarm, { steps: 3, gradKey: 'b', emissive: 0x664400 });

    // ---------- 底座：混凝土区 ----------
    // 主码头（西）
    const quay = H.box(9.4, 1.55, 20, matSeawall, -5.3, L.BOT + 0.775, 0);
    quay.material = [matSeawall, matSeawall, matConcrete, matSeawall, matSeawall, matSeawall];
    scene.add(quay);
    g.quay = quay;

    // L 臂
    const arm = H.box(5.2, 1.55, 4.2, matSeawall, 2.0, L.BOT + 0.775, 5.5);
    arm.material = [matSeawall, matSeawall, matConcrete, matSeawall, matSeawall, matSeawall];
    scene.add(arm);
    g.arm = arm;

    // 防波堤
    const bw = H.box(1.6, 1.7, 8.4, matSeawall, 5.4, L.BOT + 0.85, -0.8);
    bw.material = [matSeawall, matSeawall, matConcrete, matSeawall, matSeawall, matSeawall];
    scene.add(bw);
    g.breakwater = bw;

    // ---------- 水体块（半透明剖面） ----------
    const matWaterBody = new THREE.MeshPhongMaterial({
      color: 0x2f96a2,
      transparent: true,
      opacity: 0.34,
      shininess: 40,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const matSeabedSide = new THREE.MeshBasicMaterial({ color: 0x4e7a74, transparent: true, opacity: 0.35, depthWrite: false });
    g.waterRects = [];
    L.WATER_RECTS.forEach(function (r) {
      const x0 = r[0], z0 = r[1], x1 = r[2], z1 = r[3];
      const w = x1 - x0, d = z1 - z0;
      const h = L.WATER - L.BOT;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matWaterBody);
      mesh.position.set((x0 + x1) / 2, L.BOT + h / 2, (z0 + z1) / 2);
      mesh.renderOrder = 2;
      scene.add(mesh);
      g.waterRects.push(mesh);
      // 海床
      const bed = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), matGravel);
      bed.position.set((x0 + x1) / 2, L.BOT + 0.04, (z0 + z1) / 2);
      bed.receiveShadow = true;
      scene.add(bed);
    });

    // ---------- 岸壁细节 ----------
    buildSeawallDetails(scene, g, matIron, matRust, matGreenD, matGreen);

    // ---------- 台阶与上下船平台 ----------
    buildSteps(scene, g, matConcrete, matConcrete2, matWarn);

    // ---------- 系船柱 ----------
    buildBollards(scene, g, matIron, matIron2);

    // ---------- 护轮坎警示条 ----------
    buildCurbs(scene, g, matWarn);

    // ---------- 消波块 ----------
    buildTetrapods(scene, g, matConcrete2);

    // ---------- 防波堤 + 灯塔 ----------
    buildLighthouse(scene, g, matWhite, matRed, matIron, matGold);

    // ---------- 远处防波堤（雾中） ----------
    buildFarBreakwater(scene, g);

    // ---------- 山坡与房屋 ----------
    buildHill(scene, g, matGreen, matGreenD, matGreenL, matWood, matWhite, matIron);

    // ---------- 水下道具（轮胎、锚链、海草） ----------
    buildUnderwater(scene, g, matIron, matRust, matGreenD, matGreen);

    return g;
  };

  // ================= 岸壁细节 =================
  function buildSeawallDetails(scene, g, matIron, matRust, matGreenD, matGreen) {
    const rng = H.makeRng(1234);
    // 主码头东缘岸壁（面向内湾，x ≈ -0.6）
    // 藤壶/牡蛎：小圆片散布在水线附近
    const barnacleGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.03, 6);
    const matBarnacle = H.toonMat(0xcfc8b8, { steps: 2, gradKey: 'b' });
    const barnacles = new THREE.InstancedMesh(barnacleGeo, matBarnacle, 220);
    const dummy = new THREE.Object3D();
    let bi = 0;
    for (let i = 0; i < 220; i++) {
      const z = -9.6 + rng() * 19.2;
      const y = L.WATER - 0.32 + rng() * 0.62;
      dummy.position.set(L.QUAY_E + 0.015 + rng() * 0.03, y, z);
      dummy.rotation.set(0, 0, Math.PI / 2 + (rng() - 0.5) * 0.5);
      const s = 0.5 + rng() * 1.1;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      barnacles.setMatrixAt(bi++, dummy.matrix);
    }
    scene.add(barnacles);

    // 系船环（沿岸壁）
    const ringGeo = new THREE.TorusGeometry(0.11, 0.028, 8, 16);
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(ringGeo, matIron);
      ring.position.set(L.QUAY_E + 0.06, 0.06, -8.5 + i * 3.4);
      ring.rotation.y = Math.PI / 2;
      ring.castShadow = true;
      scene.add(ring);
      H.addOutline(ring, 0.01);
    }

    // 锈蚀铁梯（沿岸壁向下）
    const ladder = new THREE.Group();
    const rail1 = H.box(0.05, 1.5, 0.05, matRust, 0, -0.62, -0.22);
    const rail2 = H.box(0.05, 1.5, 0.05, matRust, 0, -0.62, 0.22);
    ladder.add(rail1, rail2);
    for (let i = 0; i < 6; i++) {
      const rung = H.box(0.05, 0.05, 0.48, matRust, 0, -0.1 - i * 0.24, 0);
      ladder.add(rung);
    }
    ladder.position.set(L.QUAY_E + 0.1, 0.1, -2.2);
    scene.add(ladder);
    H.addOutline(rail1, 0.012);

    // 海藻（岸壁底部，随水摆动——动画中更新）
    g.seaweeds = [];
    const weedGeo = new THREE.PlaneGeometry(0.16, 0.7, 1, 4);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(
        weedGeo,
        H.toonMat(i % 2 ? 0x3f7a52 : 0x5a8a58, { steps: 2, gradKey: 'b', side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
      );
      const z = -9.2 + rng() * 18.4;
      const side = rng() > 0.5 ? 1 : -1;
      if (i < 16) {
        m.position.set(L.QUAY_E + 0.05, L.WATER - 0.42, z);
        m.rotation.y = Math.PI / 2;
      } else {
        // L臂北缘
        m.position.set(-0.2 + rng() * 4.4, L.WATER - 0.42, L.ARM_N - 0.05);
      }
      m.userData.phase = rng() * Math.PI * 2;
      m.userData.baseRot = m.rotation.z;
      scene.add(m);
      g.seaweeds.push(m);
    }
  }

  // ================= 台阶 =================
  function buildSteps(scene, g, matConcrete, matConcrete2, matWarn) {
    const grp = new THREE.Group();
    // 从主码头伸向水边的矮台阶（x 方向，靠近 z=6）
    for (let i = 0; i < 4; i++) {
      const w = 1.5 - i * 0.12;
      const step = H.box(0.55, 0.22, w, matConcrete2, L.QUAY_E - 0.28 - i * 0.5, -0.11 - i * 0.22, 6.4);
      grp.add(step);
      H.addOutline(step, 0.012);
    }
    // 上下船平台（略低）
    const plat = H.box(1.5, 0.16, 2.0, matConcrete, L.QUAY_E - 0.45, -0.5, 8.3);
    grp.add(plat);
    H.addOutline(plat, 0.014);
    // 平台边缘警示条
    const platEdge = H.box(1.55, 0.1, 0.12, matWarn, L.QUAY_E - 0.45, -0.4, 7.35);
    grp.add(platEdge);
    scene.add(grp);
    g.steps = grp;
  }

  // ================= 系船柱 =================
  function buildBollards(scene, g, matIron, matIron2) {
    const grp = new THREE.Group();
    g.bollards = [];
    // 沿主码头东缘一列
    const zs = [-8.2, -5.6, -3.0, -0.4, 2.2, 4.8, 7.4, 9.2];
    zs.forEach(function (z, i) {
      const b = makeBollard(matIron, matIron2);
      b.position.set(L.QUAY_E - 0.42, 0, z);
      grp.add(b);
      g.bollards.push(b);
    });
    // L臂北缘几个
    [-0.1, 1.6, 3.3].forEach(function (x) {
      const b = makeBollard(matIron, matIron2);
      b.position.set(x, 0, L.ARM_N + 0.4);
      grp.add(b);
      g.bollards.push(b);
    });
    scene.add(grp);
  }

  function makeBollard(matIron, matIron2) {
    const g = new THREE.Group();
    const base = H.box(0.34, 0.1, 0.34, matIron2, 0, 0.05, 0);
    const stem = H.cyl(0.11, 0.14, 0.34, 10, matIron, 0, 0.27, 0);
    const cap = H.cyl(0.17, 0.13, 0.12, 10, matIron, 0, 0.5, 0);
    const knob = H.cyl(0.09, 0.11, 0.1, 8, matIron, 0, 0.6, 0);
    g.add(base, stem, cap, knob);
    // 缆绳绕柱数圈
    const coilMat = H.toonMat(0xb85830, { steps: 3, gradKey: "b" });
    const coilMatWet = H.toonMat(0x7e4028, { steps: 3, gradKey: "b" });
    for (let ci = 0; ci < 3; ci++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.032, 6, 14), ci === 2 ? coilMatWet : coilMat);
      coil.position.y = 0.3 + ci * 0.062;
      coil.rotation.x = Math.PI / 2 + (ci - 1) * 0.08;
      coil.rotation.y = ci * 0.7;
      g.add(coil);
    }
    // 垂入水中的绳段（湿色）
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.75, 6), coilMatWet);
    drop.position.set(0.14, -0.12, 0.1);
    drop.rotation.z = 0.18;
    drop.rotation.x = -0.12;
    g.add(drop);
    H.addOutline(stem, 0.012);
    H.addOutline(cap, 0.012);
    return g;
  }

  // ================= 护轮坎 =================
  function buildCurbs(scene, g, matWarn) {
    // 主码头东缘
    const c1 = H.box(0.18, 0.16, 19.4, matWarn, L.QUAY_E - 0.06, 0.08, 0);
    scene.add(c1);
    // L臂北缘
    const c2 = H.box(5.1, 0.16, 0.18, matWarn, 2.0, 0.08, L.ARM_N + 0.06);
    scene.add(c2);
    // L臂南缘（外侧）
    const c3 = H.box(5.1, 0.16, 0.18, matWarn, 2.0, 0.08, L.ARM_S - 0.06);
    scene.add(c3);
    H.addOutline(c1, 0.01);
  }

  // ================= 消波块 =================
  function buildTetrapods(scene, g, matConcrete2) {
    const grp = new THREE.Group();
    g.tetrapods = [];
    const spots = [
      [8.2, 8.6, 0.3],
      [9.0, 7.8, 1.2],
      [7.4, 9.2, 2.1],
      [8.8, 9.2, 0.7],
      [6.6, 8.8, 1.8],
      [9.4, 8.6, 2.6],
      [7.9, 7.6, 0.1],
    ];
    spots.push([6.6, -5.6, 0.4], [5.6, -6.2, 1.3], [7.0, -6.6, 2.2], [6.2, -7.2, 0.9], [7.6, -5.2, 1.7]);
    spots.forEach(function (s, i) {
      const t = makeTetrapod(matConcrete2);
      t.position.set(s[0], L.WATER + 0.12 + (i % 3) * 0.05, s[1]);
      t.rotation.y = s[2];
      t.rotation.z = (i % 2 ? 1 : -1) * 0.18;
      grp.add(t);
      g.tetrapods.push(t);
    });
    scene.add(grp);
  }

  function makeTetrapod(mat) {
    const g = new THREE.Group();
    // 三条腿 + 一条竖腿
    for (let i = 0; i < 3; i++) {
      const leg = H.cyl(0.16, 0.22, 1.05, 8, mat, 0, 0, 0);
      leg.rotation.z = Math.PI / 2;
      leg.rotation.y = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.42, 0, Math.sin((i / 3) * Math.PI * 2) * 0.42);
      g.add(leg);
    }
    const up = H.cyl(0.15, 0.21, 0.95, 8, mat, 0, 0.42, 0);
    g.add(up);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat);
    g.add(core);
    g.traverse(function (o) {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    H.addOutline(core, 0.012);
    return g;
  }

  // ================= 灯塔 =================
  function buildLighthouse(scene, g, matWhite, matRed, matIron, matGold) {
    const grp = new THREE.Group();
    // 基座
    const base = H.box(1.5, 0.5, 1.5, matWhite, 0, 0.25, 0);
    grp.add(base);
    // 塔身（红白相间）
    const segs = [
      [0.55, 0.62, 0.9, 0.85, matWhite],
      [0.48, 0.55, 0.85, 1.72, matRed],
      [0.42, 0.48, 0.85, 2.55, matWhite],
      [0.36, 0.42, 0.8, 3.35, matRed],
    ];
    segs.forEach(function (s) {
      const m = H.cyl(s[0], s[1], s[2], 14, s[4], 0, s[3], 0);
      grp.add(m);
      H.addOutline(m, 0.014);
    });
    // 灯室
    const deck = H.cyl(0.52, 0.52, 0.1, 14, matWhite, 0, 3.85, 0);
    grp.add(deck);
    const lampGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.5, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe8b0, transparent: true, opacity: 0.55 })
    );
    lampGlass.position.y = 4.15;
    grp.add(lampGlass);
    g.lampGlass = lampGlass;
    // 灯芯（发光）
    const lampCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2c8 })
    );
    lampCore.position.y = 4.15;
    grp.add(lampCore);
    g.lampCore = lampCore;
    // 顶盖
    const roof = H.cyl(0.1, 0.42, 0.36, 12, matRed, 0, 4.55, 0);
    grp.add(roof);
    const finial = H.cyl(0.03, 0.03, 0.3, 6, matIron, 0, 4.85, 0);
    grp.add(finial);
    // 栏杆
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const post = H.cyl(0.02, 0.02, 0.32, 5, matIron, Math.cos(a) * 0.48, 4.05, Math.sin(a) * 0.48);
      grp.add(post);
    }
    const rail = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.022, 6, 20), matIron);
    rail.position.y = 4.2;
    rail.rotation.x = Math.PI / 2;
    grp.add(rail);
    // 小窗
    for (let i = 0; i < 3; i++) {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.2, 0.04),
        new THREE.MeshBasicMaterial({ color: 0x35505a })
      );
      win.position.set(0, 1.3 + i * 1.0, 0.5 - i * 0.05);
      grp.add(win);
    }
    grp.position.set(L.BW_E - 0.8, 0.08, L.BW_N + 0.2);
    scene.add(grp);
    g.lighthouse = grp;
  }

  // ================= 远处防波堤 =================
  function buildFarBreakwater(scene, g) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x9ab6ba, transparent: true, opacity: 0.5 });
    const grp = new THREE.Group();
    // 沿北缘一条长堤
    const wall = H.box(9.2, 0.42, 0.55, mat, 4.8, L.WATER + 0.2, -9.55);
    grp.add(wall);
    for (let i = 0; i < 7; i++) {
      const t = makeTetrapodSimple(mat);
      t.position.set(0.8 + i * 1.35, L.WATER + 0.15, -9.3);
      t.scale.setScalar(0.5);
      grp.add(t);
    }
    scene.add(grp);
    g.farBreakwater = grp;
  }

  function makeTetrapodSimple(mat) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const leg = H.cyl(0.16, 0.22, 1.0, 6, mat, 0, 0, 0);
      leg.rotation.z = Math.PI / 2;
      leg.rotation.y = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.4, 0, Math.sin((i / 3) * Math.PI * 2) * 0.4);
      g.add(leg);
    }
    g.add(H.cyl(0.15, 0.2, 0.9, 6, mat, 0, 0.4, 0));
    return g;
  }

  // ================= 山坡 =================
  function buildHill(scene, g, matGreen, matGreenD, matGreenL, matWood, matWhite, matIron) {
    const grp = new THREE.Group();
    // 起伏的小山（几个压扁球体）
    const hills = [
      [-7.2, -7.2, 3.2, 1.35],
      [-5.2, -8.2, 2.6, 1.05],
      [-8.6, -5.4, 2.4, 0.95],
      [-6.0, -6.0, 2.2, 0.8],
      [-4.2, -7.0, 1.8, 0.7],
    ];
    hills.forEach(function (h, i) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(h[2], 14, 10), i % 2 ? matGreen : matGreenD);
      m.position.set(h[0], -h[3] * 0.45, h[1]);
      m.scale.set(1, h[3] / h[2], 1);
      m.receiveShadow = true;
      m.castShadow = true;
      grp.add(m);
    });
    // 树木（圆锥 + 圆柱）
    const treePos = [];
    const rng = H.makeRng(555);
    for (let i = 0; i < 26; i++) {
      const x = -9.3 + rng() * 5.6;
      const z = -9.3 + rng() * 5.2;
      const d = Math.hypot(x + 6.6, z + 7.0);
      if (d > 3.4) continue;
      const y = Math.max(0, (1 - d / 3.6) * 1.15) + 0.15;
      treePos.push([x, y, z, 0.75 + rng() * 0.7, rng()]);
    }
    treePos.forEach(function (t) {
      const tree = makeTree(t[4] > 0.5 ? matGreen : matGreenD, matGreenL, matWood, t[3]);
      tree.position.set(t[0], t[1], t[2]);
      grp.add(tree);
    });
    // 几户瓦顶民家
    const houses = [
      [-7.8, -7.6, 0.35, 1.0],
      [-5.8, -8.4, -0.25, 0.85],
      [-6.8, -5.8, 0.6, 0.9],
    ];
    houses.forEach(function (h) {
      const house = makeHouse(matWhite, matWood, h[3]);
      house.position.set(h[0], h[2] + 0.95, h[1]);
      house.rotation.y = h[2];
      grp.add(house);
    });
    scene.add(grp);
    g.hill = grp;
    g.trees = grp.children.filter(function (c) { return c.userData && c.userData.isTree; });
  }

  function makeTree(matGreen, matGreenL, matWood, s) {
    const g = new THREE.Group();
    const trunk = H.cyl(0.05 * s, 0.08 * s, 0.5 * s, 6, matWood, 0, 0.25 * s, 0);
    g.add(trunk);
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.38 * s, 0.75 * s, 8), matGreen);
    c1.position.y = 0.72 * s;
    g.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.28 * s, 0.6 * s, 8), matGreenL);
    c2.position.y = 1.1 * s;
    g.add(c2);
    c1.castShadow = c2.castShadow = true;
    g.userData.isTree = true;
    g.userData.phase = s * 10;
    return g;
  }

  function makeHouse(matWhite, matWood, s) {
    const g = new THREE.Group();
    const body = H.box(1.15 * s, 0.75 * s, 0.95 * s, matWhite, 0, 0.38 * s, 0);
    g.add(body);
    // 瓦顶（两个斜面）
    const roofMat = H.toonMat(P.roofTile, { steps: 3, gradKey: 'b' });
    const r1 = H.box(1.35 * s, 0.07 * s, 0.72 * s, roofMat, 0, 0.86 * s, -0.28 * s);
    r1.rotation.x = 0.55;
    const r2 = H.box(1.35 * s, 0.07 * s, 0.72 * s, roofMat, 0, 0.86 * s, 0.28 * s);
    r2.rotation.x = -0.55;
    g.add(r1, r2);
    // 窗与门
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.24 * s, 0.03), new THREE.MeshBasicMaterial({ color: 0x3a5560 }));
    win.position.set(0.28 * s, 0.45 * s, 0.49 * s);
    g.add(win);
    const door = H.box(0.26 * s, 0.5 * s, 0.03, matWood, -0.25 * s, 0.26 * s, 0.49 * s);
    g.add(door);
    H.addOutline(body, 0.014);
    return g;
  }

  // ================= 水下 =================
  function buildUnderwater(scene, g, matIron, matRust, matGreenD, matGreen) {
    const y = L.BOT + 0.12;
    // 旧轮胎
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.16, 10, 20), H.toonMat(0x2e2e30, { steps: 2, gradKey: 'b' }));
    tire.position.set(3.2, y + 0.16, -3.2);
    tire.rotation.x = Math.PI / 2 - 0.35;
    tire.rotation.z = 0.4;
    scene.add(tire);
    g.tire = tire;

    // 锚链（一串环）
    const chainGrp = new THREE.Group();
    const linkGeo = new THREE.TorusGeometry(0.11, 0.035, 6, 12);
    const chainMat = H.toonMat(0x4a4a48, { steps: 2, gradKey: 'b' });
    for (let i = 0; i < 14; i++) {
      const link = new THREE.Mesh(linkGeo, chainMat);
      link.position.set(2.2 + i * 0.28, y + 0.1 + Math.sin(i * 0.6) * 0.06, -1.2 + i * 0.34);
      link.rotation.x = Math.PI / 2;
      link.rotation.y = i % 2 ? 0 : Math.PI / 2;
      chainGrp.add(link);
    }
    scene.add(chainGrp);
    g.anchorChain = chainGrp;

    // 海草丛（水下）
    g.underWeeds = [];
    const rng = H.makeRng(888);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, 0.9, 1, 4),
        H.toonMat(i % 2 ? 0x2f6a48 : 0x4a8a5c, { steps: 2, gradKey: 'b', side: THREE.DoubleSide })
      );
      const x = 0.4 + rng() * 8.6;
      const z = -8.8 + rng() * 11;
      m.position.set(x, L.BOT + 0.5, z);
      m.rotation.y = rng() * Math.PI;
      m.userData.phase = rng() * Math.PI * 2;
      scene.add(m);
      g.underWeeds.push(m);
    }
  }
})();
