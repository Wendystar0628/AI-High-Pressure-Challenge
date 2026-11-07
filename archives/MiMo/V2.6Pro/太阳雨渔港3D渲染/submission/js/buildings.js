/* 港口建筑：渔协仓库（半开卷帘门+室内）与候船室（落地玻璃+室内） */
(function () {
  'use strict';
  const H = window.H;
  const P = H.PAL;

  function texBlackboard() {
    return H.canvasTex(256, function (ctx, s) {
      ctx.fillStyle = '#2e4a3e';
      ctx.fillRect(0, 0, s, s);
      // 粉笔字：拍卖价格
      ctx.fillStyle = 'rgba(240,240,230,0.92)';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('本日拍卖', 68, 40);
      ctx.font = '19px sans-serif';
      ctx.fillText('アジ  620', 36, 82);
      ctx.fillText('イワシ 380', 36, 116);
      ctx.fillText('タコ 1,240', 36, 150);
      ctx.fillText('ホッケ 890', 36, 184);
      ctx.font = '15px sans-serif';
      ctx.fillText('— 魚協 —', 92, 226);
      // 粉笔灰痕
      const rng = H.makeRng(321);
      for (let i = 0; i < 40; i++) {
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rng() * s, rng() * s, 4 + rng() * 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  function texTimetable() {
    return H.canvasTex(256, function (ctx, s) {
      ctx.fillStyle = '#e8e2cc';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#2a4050';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('航 班 时 刻', 62, 36);
      ctx.font = '15px sans-serif';
      const rows = ['07:30  大島行き', '09:15  沖港', '11:00  島影', '13:40  大島行き', '15:20  沖港', '17:00  島影'];
      rows.forEach(function (r, i) {
        ctx.fillText(r, 30, 70 + i * 28);
      });
      // 褪色
      const rng = H.makeRng(555);
      for (let i = 0; i < 30; i++) {
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#d8d0b8';
        ctx.fillRect(rng() * s, rng() * s, 20 + rng() * 40, 8 + rng() * 16);
      }
      ctx.globalAlpha = 1;
    });
  }

  function texSignboard() {
    return H.canvasTex(256, function (ctx, s) {
      ctx.fillStyle = '#d8d2bc';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#7a8890';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, s - 12, s - 12);
      ctx.fillStyle = '#2e5468';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('太陽雨漁港', 40, 78);
      ctx.fillStyle = '#b04838';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('注意落水', 72, 138);
      ctx.fillStyle = '#2e5468';
      ctx.font = '18px sans-serif';
      ctx.fillText('SWIMMING PROHIBITED', 30, 182);
      // 褪色斑驳
      const rng = H.makeRng(777);
      for (let i = 0; i < 36; i++) {
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = rng() > 0.5 ? '#c8c0a8' : '#a8b0b4';
        ctx.beginPath();
        ctx.arc(rng() * s, rng() * s, 3 + rng() * 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  H.texSignboard = texSignboard;

  function texBoots() {
    return H.canvasTex(64, function (ctx, s) {
      ctx.clearRect(0, 0, s, s);
      ctx.fillStyle = '#3a4c44';
      ctx.fillRect(12, 8, 18, 40);
      ctx.fillRect(34, 8, 18, 40);
      ctx.fillStyle = '#2a3a34';
      ctx.fillRect(10, 42, 22, 12);
      ctx.fillRect(32, 42, 22, 12);
    });
  }

  // ---------- 渔协仓库 ----------
  function buildWarehouse(scene) {
    const grp = new THREE.Group();
    const matWall = H.toonMat(0xd8d4c8, { map: H.texConcrete(31, 0xd0ccc0), steps: 4, gradKey: 'a' });
    const matRoof = H.toonMat(0x6a7a84, { steps: 3, gradKey: 'b' });
    const matFrame = H.toonMat(0x5a6468, { steps: 3, gradKey: 'b' });
    const matFloor = H.toonMat(0x8a9498, { steps: 3, gradKey: 'b' });
    const matCrate = H.toonMat(P.plasticWhite, { steps: 3, gradKey: 'b' });
    const matCrateB = H.toonMat(P.plasticBlue, { steps: 3, gradKey: 'b' });
    const matMetal = H.toonMat(0x9aa4a8, { steps: 3, gradKey: 'b' });

    const W = 3.4, D = 3.8, Hh = 2.75;
    const wallT = 0.14;

    // 地面
    const floor = H.box(W, 0.1, D, matFloor, 0, 0.05, 0);
    grp.add(floor);
    // 地面反光水渍
    const wetMat = new THREE.MeshPhongMaterial({
      color: 0xaab8bc, transparent: true, opacity: 0.32, shininess: 100, depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const wet = new THREE.Mesh(new THREE.CircleGeometry(0.35 + i * 0.12, 12), wetMat);
      wet.rotation.x = -Math.PI / 2;
      wet.position.set(-0.6 + i * 0.5, 0.107, -0.6 + (i % 2) * 1.1);
      grp.add(wet);
    }

    // 后墙 / 侧墙 / 前墙（带卷帘门开口）
    const back = H.box(W, Hh, wallT, matWall, 0, Hh / 2, -D / 2);
    const left = H.box(wallT, Hh, D, matWall, -W / 2, Hh / 2, 0);
    const right = H.box(wallT, Hh, D, matWall, W / 2, Hh / 2, 0);
    grp.add(back, left, right);
    H.addOutline(back, 0.012);

    // 顶
    const roof = H.box(W + 0.2, 0.12, D + 0.2, matRoof, 0, Hh + 0.06, 0);
    grp.add(roof);
    H.addOutline(roof, 0.014);

    // 前墙（东面）：卷帘门开口上方横梁 + 两侧柱
    const lintel = H.box(W, 0.5, wallT, matWall, 0, Hh - 0.25, D / 2);
    const postL = H.box(0.55, Hh - 0.5, wallT, matWall, -W / 2 + 0.28, (Hh - 0.5) / 2, D / 2);
    const postR = H.box(0.55, Hh - 0.5, wallT, matWall, W / 2 - 0.28, (Hh - 0.5) / 2, D / 2);
    grp.add(lintel, postL, postR);

    // 卷帘门（半拉起：上部卷起片 + 下部门片留出开口）
    const shutter = new THREE.Group();
    // 卷起的上部（数条横向片）
    for (let i = 0; i < 6; i++) {
      const slat = H.box(W - 1.15, 0.075, 0.05, matMetal, 0, Hh - 0.62 - i * 0.085, D / 2 + 0.03);
      shutter.add(slat);
    }
    // 卷筒
    const roll = H.cyl(0.13, 0.13, W - 1.05, 10, matMetal, 0, Hh - 0.52, D / 2 + 0.06);
    roll.rotation.z = Math.PI / 2;
    shutter.add(roll);
    grp.add(shutter);
    H.addOutline(shutter.children[0], 0.008);

    // 高窗（后墙上方，阳光穿入）
    const glassMat = new THREE.MeshBasicMaterial({ color: 0xfdf0d0, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 3; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.5), glassMat);
      win.position.set(-1.0 + i * 1.0, Hh - 0.72, -D / 2 + 0.02);
      grp.add(win);
      const wf = H.box(0.8, 0.58, 0.05, matFrame, -1.0 + i * 1.0, Hh - 0.72, -D / 2 - 0.01);
      grp.add(wf);
    }

    // 光柱（淡金色，从高窗斜射入）
    const shaftGrp = new THREE.Group();
    const shaftMat = new THREE.MeshBasicMaterial({
      color: 0xffc878,
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 3; i++) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.85, 3.6, 8, 1, true), shaftMat.clone());
      shaft.position.set(-1.0 + i * 1.0, 1.55, -0.15);
      shaft.rotation.x = 0.52;
      shaft.rotation.z = -0.12;
      shaftGrp.add(shaft);
    }
    grp.add(shaftGrp);

    // 天花板水面反光（摇曳光斑）
    const causticGrp = new THREE.Group();
    const causticMat = new THREE.MeshBasicMaterial({
      color: 0xbfe8ea, transparent: true, opacity: 0.16, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.3), causticMat.clone());
      c.rotation.x = Math.PI / 2;
      c.position.set(-1.2 + (i % 4) * 0.85, Hh - 0.12, -1.0 + Math.floor(i / 4) * 1.1 + (i % 2) * 0.3);
      c.userData.phase = i * 0.9;
      causticGrp.add(c);
    }
    grp.add(causticGrp);

    // ---- 室内陈设 ----
    // 成垛鱼箱
    for (let i = 0; i < 3; i++) {
      const x = -1.15 + i * 0.02, z = -1.25 + i * 0.12;
      const stack = new THREE.Group();
      const n = 3 + (i % 3);
      for (let k = 0; k < n; k++) {
        const box = H.box(0.62, 0.22, 0.42, k % 2 ? matCrate : matCrateB, 0, 0.21 + k * 0.235, 0);
        stack.add(box);
        // 箱格
        for (let r = 0; r < 2; r++) {
          const rib = H.box(0.64, 0.02, 0.045, matCrate, 0, 0.14 + k * 0.235, -0.12 + r * 0.24);
          stack.add(rib);
        }
      }
      stack.position.set(x, 0, z);
      stack.rotation.y = i * 0.22 - 0.2;
      grp.add(stack);
    }

    // 冰柜
    const freezer = H.box(1.15, 0.95, 0.7, H.toonMat(0xdfe4e2, { steps: 3, gradKey: 'b' }), 1.05, 0.58, -1.25);
    grp.add(freezer);
    const fzLid = H.box(1.18, 0.08, 0.72, H.toonMat(0xc2cac8, { steps: 3, gradKey: 'b' }), 1.05, 1.1, -1.25);
    grp.add(fzLid);
    H.addOutline(freezer, 0.012);

    // 磅秤
    const scale = new THREE.Group();
    const scaleBase = H.box(0.55, 0.12, 0.42, matMetal, 0, 0.06, 0);
    const scaleBody = H.box(0.4, 0.3, 0.3, H.toonMat(0xc8a848, { steps: 3, gradKey: 'b' }), 0, 0.27, -0.02);
    const scalePlate = H.box(0.5, 0.04, 0.38, H.toonMat(0xe0e4e2, { steps: 3, gradKey: 'b' }), 0, 0.16, 0.06);
    scale.add(scaleBase, scaleBody, scalePlate);
    scale.position.set(1.15, 0.1, 0.35);
    grp.add(scale);
    H.addOutline(scaleBody, 0.01);

    // 墙上雨靴（挂一排）
    const bootsMat = H.toonMat(0x3a5248, { steps: 3, gradKey: 'b' });
    for (let i = 0; i < 3; i++) {
      const boot = new THREE.Group();
      const leg = H.box(0.12, 0.3, 0.14, bootsMat, 0, -0.16, 0);
      const foot = H.box(0.13, 0.1, 0.26, bootsMat, 0, -0.35, 0.05);
      boot.add(leg, foot);
      boot.position.set(-0.95 + i * 0.38, 1.7, -D / 2 + 0.14);
      boot.rotation.z = 0.12;
      boot.rotation.y = 0;
      grp.add(boot);
    }

    // 黑板（拍卖价格）
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 0.85),
      new THREE.MeshToonMaterial({ map: texBlackboard(), gradientMap: H.toonGradient(3) })
    );
    board.position.set(0.35, 1.55, -D / 2 + 0.07);
    board.rotation.y = 0;
    grp.add(board);
    const boardFrame = H.box(1.45, 0.95, 0.05, matFrame, 0.35, 1.55, -D / 2 + 0.03);
    grp.add(boardFrame);

    // 散落冰块
    const iceMat = new THREE.MeshPhongMaterial({ color: 0xd8f0f2, transparent: true, opacity: 0.75, shininess: 80 });
    const rng = H.makeRng(909);
    for (let i = 0; i < 14; i++) {
      const ice = new THREE.Mesh(new THREE.BoxGeometry(0.08 + rng() * 0.1, 0.05, 0.08 + rng() * 0.1), iceMat);
      ice.position.set(-1.2 + rng() * 2.2, 0.16, -0.8 + rng() * 1.9);
      ice.rotation.y = rng() * 3;
      grp.add(ice);
    }

    // 位置：主码头西侧
    grp.position.set(-7.9, 0, -0.4);
    grp.rotation.y = Math.PI / 2;
    scene.add(grp);
    return grp;
  }

  // ---------- 候船室 ----------
  function buildWaitingRoom(scene) {
    const grp = new THREE.Group();
    const matWall = H.toonMat(0xe2ddd0, { map: H.texConcrete(51, 0xdcd8cc), steps: 4, gradKey: 'a' });
    const matRoof = H.toonMat(0x5e7284, { steps: 3, gradKey: 'b' });
    const matWood = H.toonMat(P.wood, { map: H.texWood(66), steps: 3, gradKey: 'b' });
    const matFrame = H.toonMat(0x6a7478, { steps: 3, gradKey: 'b' });
    const matGreen = H.toonMat(P.green, { steps: 3, gradKey: 'b' });

    const W = 3.0, D = 3.2, Hh = 2.45;
    const wallT = 0.12;

    const floor = H.box(W, 0.1, D, matWood, 0, 0.05, 0);
    grp.add(floor);
    const back = H.box(W, Hh, wallT, matWall, 0, Hh / 2, -D / 2);
    const left = H.box(wallT, Hh, D, matWall, -W / 2, Hh / 2, 0);
    const right = H.box(wallT, Hh, D, matWall, W / 2, Hh / 2, 0);
    grp.add(back, left, right);
    const roof = H.box(W + 0.18, 0.11, D + 0.18, matRoof, 0, Hh + 0.055, 0);
    grp.add(roof);
    H.addOutline(roof, 0.014);

    // 落地玻璃窗（东面整面）
    const glassMat = new THREE.MeshPhongMaterial({
      color: 0xcfe8ea, transparent: true, opacity: 0.16, shininess: 110,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, Hh - 0.35), glassMat);
    glass.position.set(0, (Hh - 0.35) / 2 + 0.1, D / 2);
    grp.add(glass);
    // 玻璃框
    for (let i = 0; i <= 3; i++) {
      const mull = H.box(0.05, Hh - 0.3, 0.05, matFrame, -W / 2 + 0.08 + (i * (W - 0.16)) / 3, Hh / 2, D / 2 + 0.01);
      grp.add(mull);
    }
    const sill = H.box(W - 0.06, 0.07, 0.08, matFrame, 0, 0.16, D / 2 + 0.01);
    const head = H.box(W - 0.06, 0.07, 0.08, matFrame, 0, Hh - 0.14, D / 2 + 0.01);
    grp.add(sill, head);

    // 室内：木长椅
    for (let b = 0; b < 2; b++) {
      const bench = new THREE.Group();
      const seat = H.box(1.75, 0.08, 0.4, matWood, 0, 0.42, 0);
      const backrest = H.box(1.75, 0.36, 0.07, matWood, 0, 0.72, -0.2);
      bench.add(seat, backrest);
      [-1, 1].forEach(function (sd) {
        const legL = H.box(0.07, 0.42, 0.38, matWood, sd * 0.75, 0.21, 0);
        bench.add(legL);
      });
      bench.position.set(0, 0.1, -0.72 + b * 1.05);
      grp.add(bench);
      if (b === 0) H.addOutline(seat, 0.01);
    }

    // 褪色航班时刻表（后墙）
    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 0.8),
      new THREE.MeshToonMaterial({ map: texTimetable(), gradientMap: H.toonGradient(3) })
    );
    table.position.set(-0.45, 1.6, -D / 2 + 0.02);
    grp.add(table);
    const tableFrame = H.box(1.15, 0.9, 0.04, matFrame, -0.45, 1.6, -D / 2 + 0.0);
    grp.add(tableFrame);

    // 老式收音机（小桌上）
    const radioTable = H.box(0.55, 0.06, 0.4, matWood, 1.05, 0.72, -D / 2 + 0.45);
    grp.add(radioTable);
    [-1, 1].forEach(function (sd) {
      const lg = H.box(0.05, 0.72, 0.05, matWood, 1.05 + sd * 0.22, 0.36, -D / 2 + 0.45);
      grp.add(lg);
    });
    const radio = H.box(0.34, 0.2, 0.16, H.toonMat(0xb89878, { map: H.canvasTex(64, function (c, s) {
      c.fillStyle = '#b89878'; c.fillRect(0, 0, s, s);
      c.fillStyle = '#3a3a38'; c.fillRect(6, 8, 40, 28);
      c.fillStyle = '#c8a86a';
      for (let i = 0; i < 4; i++) c.fillRect(10 + i * 10, 12, 6, 20);
      c.fillStyle = '#8a7458';
      c.beginPath(); c.arc(16, 50, 8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(46, 50, 8, 0, Math.PI * 2); c.fill();
    }), steps: 3, gradKey: 'b' }), 1.05, 0.86, -D / 2 + 0.45);
    grp.add(radio);
    H.addOutline(radio, 0.01);

    // 热水壶 + 绿萝（角落）
    const kettle = H.cyl(0.11, 0.13, 0.24, 10, H.toonMat(0xd8d4cc, { steps: 3, gradKey: 'b' }), -1.15, 0.24, -D / 2 + 0.5);
    grp.add(kettle);
    const kHandle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 12, Math.PI), H.toonMat(0x3a3a38, { steps: 2, gradKey: 'b' }));
    kHandle.position.set(-1.15, 0.38, -D / 2 + 0.5);
    grp.add(kHandle);
    const pot = H.cyl(0.15, 0.12, 0.2, 10, H.toonMat(0xb06848, { steps: 3, gradKey: 'b' }), -1.15, 0.2, -D / 2 + 0.95);
    grp.add(pot);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), i % 2 ? matGreen : H.toonMat(P.greenLight, { steps: 3, gradKey: 'b' }));
      leaf.position.set(-1.15 + Math.cos(i * 1.7) * 0.17, 0.38 + (i % 3) * 0.11, -D / 2 + 0.95 + Math.sin(i * 1.7) * 0.15);
      leaf.scale.set(1, 0.55, 0.8);
      leaf.rotation.z = (i - 3) * 0.35;
      grp.add(leaf);
    }

    // 墙上挂钟（略微歪斜）
    const clock = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 16), H.toonMat(0xf2f0e8, { steps: 3, gradKey: 'b' }));
    face.rotation.x = Math.PI / 2;
    clock.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 6, 18), H.toonMat(0x5a4a3a, { steps: 3, gradKey: 'b' }));
    clock.add(rim);
    const handM = H.box(0.015, 0.11, 0.012, H.toonMat(0x2a2a28, { steps: 2, gradKey: 'b' }), 0, 0.045, 0.03);
    const handH = H.box(0.013, 0.075, 0.012, H.toonMat(0x2a2a28, { steps: 2, gradKey: 'b' }), 0, 0.03, 0.032);
    handM.rotation.z = -0.7;
    handH.rotation.z = 1.9;
    clock.add(handM, handH);
    clock.position.set(W / 2 - 0.1, 1.72, 0.2);
    clock.rotation.y = -Math.PI / 2;
    clock.rotation.z = 0.16; // 歪斜
    grp.add(clock);
    H.addOutline(face, 0.008);

    // 室内光（暖）
    const lamp = new THREE.PointLight(0xffe0b0, 0.5, 6, 2);
    lamp.position.set(0, 1.9, 0);
    grp.add(lamp);

    grp.position.set(-7.9, 0, 4.8);
    grp.rotation.y = Math.PI / 2;
    scene.add(grp);
    return grp;
  }

  H.buildBuildings = function (scene) {
    const g = (H.buildings = {});
    g.warehouse = buildWarehouse(scene);
    g.waitingRoom = buildWaitingRoom(scene);

    // 码头告示牌（褪色：港名 + 注意落水）
    const matBoard = H.toonMat(0xffffff, { map: texSignboard(), steps: 3, gradKey: 'b' });
    const signGrp = new THREE.Group();
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.85, 0.07), matBoard);
    sign.position.y = 1.35;
    signGrp.add(sign);
    H.addOutline(sign, 0.012);
    const post1 = H.box(0.07, 1.0, 0.07, H.toonMat(0x6a7478, { steps: 3, gradKey: 'b' }), -0.5, 0.5, 0);
    const post2 = H.box(0.07, 1.0, 0.07, H.toonMat(0x6a7478, { steps: 3, gradKey: 'b' }), 0.5, 0.5, 0);
    signGrp.add(post1, post2);
    signGrp.position.set(-5.2, 0, -6.2);
    signGrp.rotation.y = 0.95;
    scene.add(signGrp);
    g.sign = signGrp;
  };
})();
