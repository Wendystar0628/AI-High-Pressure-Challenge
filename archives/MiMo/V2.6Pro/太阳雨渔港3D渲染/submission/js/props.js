/* 港口道具：灯柱、鱼箱、渔网、绞盘、浮标、贩卖机、滑道舢板、风向袋、乐器箱、雨伞、水洼 */
(function () {
  'use strict';
  const H = window.H;
  const P = H.PAL;

  function texVending() {
    return H.canvasTex(128, function (ctx, s) {
      ctx.fillStyle = '#d8d4c8';
      ctx.fillRect(0, 0, s, s);
      // 亮箱（微微发光的饮料窗）
      const g = ctx.createLinearGradient(0, 10, 0, 80);
      g.addColorStop(0, '#f8f0d8');
      g.addColorStop(1, '#e0d0a8');
      ctx.fillStyle = g;
      ctx.fillRect(10, 12, s - 20, 66);
      // 罐装饮料
      const colors = ['#c84838', '#3e6e9e', '#e8a030', '#4a9a5a', '#d86a28', '#7a5aa0'];
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(16 + (i % 3) * 36, 18 + Math.floor(i / 3) * 30, 22, 24);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(18 + (i % 3) * 36, 20 + Math.floor(i / 3) * 30, 6, 20);
      }
      // 取货口
      ctx.fillStyle = '#4a4a48';
      ctx.fillRect(18, 92, s - 36, 24);
      // 锈迹
      const rng = H.makeRng(1212);
      for (let i = 0; i < 16; i++) {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#8a5c3c';
        ctx.beginPath();
        ctx.arc(rng() * s, rng() * s, 2 + rng() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  function texBuoy() {
    return H.canvasTex(64, function (ctx, s) {
      ctx.fillStyle = '#e0e2dc';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#c84838';
      ctx.fillRect(0, 0, s, s * 0.38);
      ctx.fillStyle = '#2a4050';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('7', 22, 52);
    });
  }

  function texFlag() {
    return H.canvasTex(64, function (ctx, s) {
      ctx.fillStyle = '#f0e8d0';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#c84838';
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  H.buildProps = function (scene) {
    const g = (H.props = {});
    const rng = H.makeRng(2025);

    const matIron = H.toonMat(P.iron, { steps: 3, gradKey: 'b' });
    const matIron2 = H.toonMat(P.ironLight, { steps: 3, gradKey: 'b' });
    const matRust = H.toonMat(P.rust, { map: H.texRust(), steps: 3, gradKey: 'b' });
    const matWhite = H.toonMat(P.plasticWhite, { steps: 3, gradKey: 'b' });
    const matBlue = H.toonMat(P.plasticBlue, { steps: 3, gradKey: 'b' });
    const matWood = H.toonMat(P.wood, { map: H.texWood(88), steps: 3, gradKey: 'b' });
    const matSilver = H.toonMat(0xb8b8b8, { steps: 3, gradKey: 'b' });

    // ================= 码头灯柱（圆环灯罩） =================
    g.lampPosts = [];
    const lampSpots = [
      [-1.7, -7.2], [-1.7, -1.2], [-1.7, 5.0], [3.6, 5.5], [-6.2, -3.6], [-3.2, 8.8],
    ];
    lampSpots.forEach(function (sp, i) {
      const lp = new THREE.Group();
      const pole = H.cyl(0.055, 0.075, 2.35, 10, matIron, 0, 1.17, 0);
      lp.add(pole);
      H.addOutline(pole, 0.011);
      // 圆环形灯罩
      const ringShade = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 20), matIron);
      ringShade.rotation.x = Math.PI / 2;
      ringShade.position.y = 2.5;
      lp.add(ringShade);
      const glowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.3, 18),
        new THREE.MeshBasicMaterial({ color: 0xffe8b8, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
      );
      glowDisc.rotation.x = Math.PI / 2;
      glowDisc.position.y = 2.47;
      lp.add(glowDisc);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c8 }));
      bulb.position.y = 2.42;
      lp.add(bulb);
      // 灯罩顶部小帽
      const cap = H.cyl(0.06, 0.2, 0.12, 10, matIron, 0, 2.62, 0);
      lp.add(cap);
      lp.position.set(sp[0], 0, sp[1]);
      lp.userData.bulb = bulb;
      lp.userData.glow = glowDisc;
      lp.userData.phase = i * 1.3;
      scene.add(lp);
      g.lampPosts.push(lp);
    });

    // ================= 灯柱上方斜穿的电线 =================
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x2e3438 });
    const wirePts = [
      new THREE.Vector3(-1.7, 2.62, -7.2),
      new THREE.Vector3(-2.6, 3.05, -4.2),
      new THREE.Vector3(-1.7, 2.62, -1.2),
      new THREE.Vector3(-2.4, 3.15, 2.0),
      new THREE.Vector3(-1.7, 2.62, 5.0),
      new THREE.Vector3(0.6, 2.9, 5.2),
      new THREE.Vector3(3.6, 2.62, 5.5),
    ];
    for (let i = 0; i < wirePts.length - 1; i++) {
      const mid = wirePts[i].clone().add(wirePts[i + 1]).multiplyScalar(0.5);
      mid.y -= 0.28;
      const curve = new THREE.CatmullRomCurve3([wirePts[i], mid, wirePts[i + 1]]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.012, 4, false), wireMat);
      scene.add(tube);
    }

    // ================= 鱼箱与周转筐 =================
    g.crates = [];
    function crateStack(x, z, rotY, n, blueRatio) {
      const st = new THREE.Group();
      for (let k = 0; k < n; k++) {
        const isBlue = k < n * blueRatio;
        const box = H.box(0.62, 0.2, 0.42, isBlue ? matBlue : matWhite, (rng() - 0.5) * 0.1, 0.2 + k * 0.215, (rng() - 0.5) * 0.1);
        box.rotation.y = (rng() - 0.5) * 0.35;
        st.add(box);
        if (k === n - 1) H.addOutline(box, 0.011);
      }
      st.position.set(x, 0, z);
      st.rotation.y = rotY;
      scene.add(st);
      g.crates.push(st);
    }
    crateStack(-4.9, -2.4, 0.3, 5, 0.4);
    crateStack(-5.6, -2.1, -0.2, 4, 0.0);
    crateStack(-4.4, -1.8, 0.7, 3, 0.7);
    crateStack(-3.0, 8.6, 0.1, 4, 0.5);
    crateStack(2.6, 4.6, -0.4, 3, 0.3);

    // ================= 晒在铁架上的渔网 + 浮球绳串 =================
    const netFrame = new THREE.Group();
    const postA = H.cyl(0.04, 0.05, 1.75, 8, matIron2, -1.3, 0.87, 0);
    const postB = H.cyl(0.04, 0.05, 1.75, 8, matIron2, 1.3, 0.87, 0);
    const topBar = H.cyl(0.035, 0.035, 2.7, 8, matIron2, 0, 1.72, 0);
    topBar.rotation.z = Math.PI / 2;
    netFrame.add(postA, postB, topBar);
    // 网面（线框感：细线网格 + 网目贴片）
    const netMat = H.toonMat(0x8a7a5a, { steps: 2, gradKey: 'b', transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const netPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.5, 12, 7), netMat);
    netPlane.position.y = 0.95;
    netFrame.add(netPlane);
    // 网线
    const netLineMat = new THREE.MeshBasicMaterial({ color: 0x7a6a4a });
    for (let i = 0; i <= 8; i++) {
      const lv = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.5, 4), netLineMat);
      lv.position.set(-1.25 + i * 0.31, 0.95, 0.01);
      netFrame.add(lv);
    }
    for (let j = 0; j <= 5; j++) {
      const lh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.5, 4), netLineMat);
      lh.rotation.z = Math.PI / 2;
      lh.position.set(0, 0.25 + j * 0.3, 0.01);
      netFrame.add(lh);
    }
    // 浮球绳串
    const floatRope = new THREE.Group();
    const ropeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.25, 1.62, 0.06),
      new THREE.Vector3(-0.4, 1.42, 0.1),
      new THREE.Vector3(0.5, 1.5, 0.08),
      new THREE.Vector3(1.25, 1.38, 0.06),
    ]);
    const ropeMesh = new THREE.Mesh(new THREE.TubeGeometry(ropeCurve, 16, 0.018, 5, false), H.toonMat(P.rope, { steps: 3, gradKey: 'b' }));
    floatRope.add(ropeMesh);
    const floatColors = [0xe8783a, 0xf0e8d8, 0x3e6e9e, 0xe8783a, 0xf0e8d8, 0xc84838, 0x3e6e9e, 0xe8783a];
    for (let i = 0; i < 8; i++) {
      const t = 0.08 + (i / 7) * 0.84;
      const p = ropeCurve.getPoint(t);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), H.toonMat(floatColors[i], { steps: 3, gradKey: 'b' }));
      fl.position.copy(p);
      fl.position.y -= 0.08;
      floatRope.add(fl);
    }
    netFrame.add(floatRope);
    netFrame.position.set(-3.4, 0, -3.9);
    netFrame.rotation.y = 0.35;
    scene.add(netFrame);
    g.netFrame = netFrame;
    g.netPlane = netPlane;

    // ================= 手摇绞盘 + 小吊杆 =================
    const winch = new THREE.Group();
    const wBase = H.box(0.75, 0.16, 0.5, matRust, 0, 0.08, 0);
    const wBody = H.box(0.45, 0.42, 0.38, matRust, 0, 0.36, 0);
    winch.add(wBase, wBody);
    H.addOutline(wBody, 0.012);
    // 卷筒
    const drum = H.cyl(0.18, 0.18, 0.42, 12, matIron2, 0.02, 0.52, 0);
    drum.rotation.z = Math.PI / 2;
    winch.add(drum);
    // 摇柄
    const crank = H.box(0.05, 0.3, 0.05, matIron, -0.3, 0.52, 0.18);
    crank.rotation.x = 0.4;
    winch.add(crank);
    const handle = H.cyl(0.035, 0.035, 0.16, 6, H.toonMat(P.wood, { steps: 3, gradKey: 'b' }), -0.3, 0.36, 0.24);
    handle.rotation.x = Math.PI / 2;
    winch.add(handle);
    // 小吊杆
    const davitPost = H.cyl(0.05, 0.06, 1.65, 8, matIron, 0.35, 0.82, -0.18);
    winch.add(davitPost);
    const davitArm = H.cyl(0.04, 0.045, 1.05, 8, matIron, 0.35, 1.62, 0.28);
    davitArm.rotation.x = Math.PI / 2 - 0.28;
    winch.add(davitArm);
    // 吊钩
    const hookLine = H.cyl(0.012, 0.012, 0.55, 4, matIron, 0.35, 1.28, 0.75);
    winch.add(hookLine);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 10, Math.PI * 1.4), matIron);
    hook.position.set(0.35, 0.98, 0.75);
    winch.add(hook);
    winch.position.set(-5.3, 0, 1.9);
    winch.rotation.y = -0.55;
    scene.add(winch);
    g.winch = winch;

    // ================= 系船浮标（褪色编号） =================
    const buoyMat = H.toonMat(0xffffff, { map: texBuoy(), steps: 3, gradKey: 'b' });
    g.buoys = [];
    [[1.8, -6.2], [4.2, -2.4], [2.8, 2.6], [7.2, -6.8], [5.2, 1.2]].forEach(function (sp, i) {
      const buoy = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), buoyMat);
      body.scale.y = 1.25;
      buoy.add(body);
      const top = H.cyl(0.05, 0.07, 0.16, 8, matIron, 0, 0.3, 0);
      buoy.add(top);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 10), matIron);
      ring.position.y = 0.42;
      buoy.add(ring);
      H.addOutline(body, 0.012);
      buoy.position.set(sp[0], H.L.WATER + 0.1, sp[1]);
      buoy.userData.phase = i * 1.4;
      buoy.userData.baseY = buoy.position.y;
      scene.add(buoy);
      g.buoys.push(buoy);
    });

    // ================= 长柄网兜 + 水桶 =================
    const netPole = new THREE.Group();
    const poleM = H.cyl(0.025, 0.03, 1.9, 6, matWood, 0, 0.95, 0);
    poleM.rotation.z = 0.28;
    netPole.add(poleM);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 14), matIron);
    hoop.position.set(0.42, 1.82, 0);
    hoop.rotation.x = 0.4;
    netPole.add(hoop);
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), H.toonMat(0x6a8a6a, { steps: 2, gradKey: 'b', transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    bag.position.set(0.42, 1.78, 0);
    bag.rotation.x = Math.PI + 0.4;
    netPole.add(bag);
    netPole.position.set(-6.9, 0, 1.5);
    netPole.rotation.y = 0.6;
    scene.add(netPole);

    const bucket = H.cyl(0.19, 0.15, 0.32, 10, matBlue, -6.55, 0.16, 2.05);
    scene.add(bucket);
    const bHandle = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 6, 12, Math.PI), matIron);
    bHandle.position.set(-6.55, 0.32, 2.05);
    scene.add(bHandle);
    H.addOutline(bucket, 0.01);

    // ================= 自动贩卖机（锈蚀遮雨檐、灯箱微亮） =================
    const vm = new THREE.Group();
    const vmBody = H.box(1.0, 1.85, 0.72, H.toonMat(0xd8d4c8, { steps: 3, gradKey: 'b' }), 0, 0.925, 0);
    vm.add(vmBody);
    H.addOutline(vmBody, 0.014);
    const vmFace = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 1.55), H.toonMat(0xffffff, { map: texVending(), steps: 3, gradKey: 'b' }));
    vmFace.position.set(0, 1.0, 0.37);
    vm.add(vmFace);
    // 灯箱微微发亮
    const vmGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 0.62),
      new THREE.MeshBasicMaterial({ color: 0xffe8b0, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    vmGlow.position.set(0, 1.42, 0.385);
    vm.add(vmGlow);
    // 锈蚀遮雨檐
    const awning = H.box(1.15, 0.05, 0.55, matRust, 0, 2.0, 0.32);
    awning.rotation.x = -0.18;
    vm.add(awning);
    H.addOutline(awning, 0.011);
    vm.position.set(-8.9, 0, -3.3);
    vm.rotation.y = 1.57;
    scene.add(vm);
    g.vending = vm;
    g.vmGlow = vmGlow;

    // ================= 滑道 + 倒扣舢板 =================
    const slipway = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const plank = H.box(1.5, 0.08, 0.38, matWood, 0, -0.05 - i * 0.14, i * 0.4);
      slipway.add(plank);
    }
    const rail1 = H.box(0.08, 0.1, 2.5, matRust, -0.72, -0.35, 1.0);
    const rail2 = H.box(0.08, 0.1, 2.5, matRust, 0.72, -0.35, 1.0);
    slipway.add(rail1, rail2);
    slipway.position.set(2.6, 0.15, 8.0);
    slipway.rotation.y = -0.42;
    scene.add(slipway);
    g.slipway = slipway;

    // 倒扣的小木舢板
    const sampan = new THREE.Group();
    const hullG = H.box(1.05, 0.32, 2.3, matWood, 0, 0.32, 0);
    const bowF = H.box(0.85, 0.3, 0.5, matWood, 0, 0.34, 1.25);
    bowF.rotation.x = 0.28;
    const bowB = H.box(0.85, 0.3, 0.5, matWood, 0, 0.34, -1.25);
    bowB.rotation.x = -0.28;
    sampan.add(bowF, bowB);
    // 船底弧度
    hullG.scale.set(1, 1, 1);
    sampan.add(hullG);
    const keel = H.box(0.1, 0.12, 2.25, H.toonMat(P.woodDark, { steps: 3, gradKey: 'b' }), 0, 0.14, 0);
    sampan.add(keel);
    // 船帮
    [-1, 1].forEach(function (sd) {
      const side = H.box(0.08, 0.36, 2.32, H.toonMat(P.woodDark, { steps: 3, gradKey: 'b' }), sd * 0.53, 0.32, 0);
      sampan.add(side);
    });
    // 船底板条
    for (let i = 0; i < 5; i++) {
      const plank = H.box(1.08, 0.035, 0.28, H.toonMat(0xa8885e, { steps: 3, gradKey: 'b' }), 0, 0.49, -0.85 + i * 0.42);
      sampan.add(plank);
    }
    H.addOutline(hullG, 0.014);
    for (let sk = 0; sk < 2; sk++) {
      const bunk = H.box(1.35, 0.16, 0.22, H.toonMat(P.woodDark, { steps: 3, gradKey: "b" }), 3.35, 0.12, 6.55 + sk * 1.55);
      bunk.rotation.y = 0.85;
      scene.add(bunk);
    }
    sampan.position.set(3.35, 0.36, 7.35);
    sampan.rotation.y = 0.85;
    sampan.rotation.z = 0.04;
    scene.add(sampan);
    g.sampan = sampan;

    // ================= 风向袋与小旗 =================
    // 风向袋（杆 + 布袋）
    const windsockGrp = new THREE.Group();
    const wsPole = H.cyl(0.035, 0.045, 2.1, 8, matIron, 0, 1.05, 0);
    windsockGrp.add(wsPole);
    const wsRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 6, 12), matIron);
    wsRing.position.y = 2.12;
    wsRing.rotation.x = Math.PI / 2;
    windsockGrp.add(wsRing);
    // 布袋（锥形筒，分段可摆动）
    g.windsockSegs = [];
    for (let i = 0; i < 5; i++) {
      const seg = H.cyl(0.13 - i * 0.012, 0.145 - i * 0.012, 0.24, 10,
        H.toonMat(i % 2 ? 0xe8783a : 0xf0e8d8, { steps: 3, gradKey: 'b', side: THREE.DoubleSide }), 0, 2.12, 0.14 + i * 0.235);
      seg.rotation.x = Math.PI / 2;
      seg.userData.idx = i;
      windsockGrp.add(seg);
      g.windsockSegs.push(seg);
    }
    windsockGrp.position.set(4.0, 0, 4.3);
    scene.add(windsockGrp);
    g.windsock = windsockGrp;

    // 小旗
    const flagGrp = new THREE.Group();
    const flagPole = H.cyl(0.025, 0.03, 1.65, 6, matIron, 0, 0.82, 0);
    flagGrp.add(flagPole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.36, 4, 2), H.toonMat(0xffffff, { map: texFlag(), steps: 3, gradKey: 'b', side: THREE.DoubleSide }));
    flag.position.set(0.27, 1.42, 0);
    flagGrp.add(flag);
    flagGrp.position.set(-5.5, 0, -5.4);
    scene.add(flagGrp);
    g.flag = flag;
    g.flagGrp = flagGrp;

    // ================= 乐器硬箱（两只银灰色） =================
    function instrumentCase(x, z, rotY, s) {
      const c = new THREE.Group();
      const body = H.box(1.15 * s, 0.42 * s, 0.42 * s, matSilver, 0, 0.24 * s, 0);
      c.add(body);
      H.addOutline(body, 0.012);
      // 棱条
      for (let i = 0; i < 3; i++) {
        const rib = H.box(1.18 * s, 0.03 * s, 0.44 * s, H.toonMat(0x9a9a98, { steps: 2, gradKey: 'b' }), 0, 0.12 * s + i * 0.12 * s, 0);
        c.add(rib);
      }
      // 把手
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09 * s, 0.018 * s, 6, 10, Math.PI), H.toonMat(0x3a3a38, { steps: 2, gradKey: 'b' }));
      handle.position.set(0, 0.45 * s, 0);
      handle.rotation.x = Math.PI / 2;
      handle.rotation.z = Math.PI / 2;
      c.add(handle);
      // 角护
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (cc) {
        const corner = H.box(0.08 * s, 0.08 * s, 0.08 * s, H.toonMat(0x3a3a38, { steps: 2, gradKey: 'b' }), cc[0] * 0.55 * s, 0.4 * s, cc[1] * 0.19 * s);
        c.add(corner);
      });
      // 锁扣
      [-1, 1].forEach(function (sd) {
        const latch = H.box(0.06 * s, 0.08 * s, 0.03 * s, H.toonMat(0xc8c8c0, { steps: 2, gradKey: 'b' }), sd * 0.3 * s, 0.34 * s, 0.22 * s);
        c.add(latch);
      });
      c.position.set(x, 0, z);
      c.rotation.y = rotY;
      scene.add(c);
      return c;
    }
    g.cases = [
      instrumentCase(-3.6, 6.9, 0.12, 1.0),
      instrumentCase(-3.55, 7.55, -0.22, 0.86),
    ];

    // ================= 透明雨伞（斜靠台阶边） =================
    const umbrella = new THREE.Group();
    const uMast = H.cyl(0.02, 0.022, 1.15, 6, H.toonMat(0xd8d8d0, { steps: 2, gradKey: 'b' }), 0, 0.58, 0);
    umbrella.add(uMast);
    // 弯钩手柄
    const hookHandle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 10, Math.PI * 1.2), H.toonMat(0x3a3a38, { steps: 2, gradKey: 'b' }));
    hookHandle.position.set(0.055, 0.02, 0);
    hookHandle.rotation.y = Math.PI / 2;
    umbrella.add(hookHandle);
    // 伞骨 + 透明伞面
    const canopyMat = new THREE.MeshPhongMaterial({
      color: 0xb8dce2, transparent: true, opacity: 0.52, shininess: 120,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.3, 10, 1, true), canopyMat);
    canopy.position.y = 1.12;
    umbrella.add(canopy);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.68, 4), H.toonMat(0xc8c8c0, { steps: 2, gradKey: 'b' }));
      rib.position.set(Math.cos(a) * 0.3, 1.06, Math.sin(a) * 0.3);
      rib.rotation.z = Math.cos(a) * 1.25;
      rib.rotation.x = -Math.sin(a) * 1.25;
      umbrella.add(rib);
    }
    // 伞面雨珠
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xd8f0f2, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 22; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), dropMat);
      const a = rng() * Math.PI * 2;
      const r = 0.25 + rng() * 0.34;
      drop.position.set(Math.cos(a) * r, 1.18 - (r - 0.25) * 0.48, Math.sin(a) * r);
      umbrella.add(drop);
    }
    // 雨伞斜靠
    umbrella.position.set(-2.35, 0.12, 6.6);
    umbrella.rotation.z = 0.72;
    umbrella.rotation.x = 0.12;
    umbrella.rotation.y = -0.4;
    scene.add(umbrella);
    g.umbrella = umbrella;

    // ================= 水洼（倒映船只灯柱） =================
    g.puddles = [];
    // 湿润反光斑
    const wetGlossMat = new THREE.MeshPhongMaterial({ color: 0xb8ccce, transparent: true, opacity: 0.22, shininess: 110, depthWrite: false });
    const rngW = H.makeRng(6161);
    for (let i = 0; i < 12; i++) {
      const wg = new THREE.Mesh(new THREE.CircleGeometry(0.35 + rngW() * 0.85, 14), wetGlossMat);
      wg.rotation.x = -Math.PI / 2;
      wg.scale.y = 0.5 + rngW() * 0.5;
      wg.position.set(-8.6 + rngW() * 7.6, 0.016, -8.5 + rngW() * 17);
      scene.add(wg);
    }
    const puddleMat = new THREE.MeshPhongMaterial({
      color: 0x9ac0c4, transparent: true, opacity: 0.42, shininess: 120,
      depthWrite: false, side: THREE.DoubleSide,
    });
    [[-2.9, 5.3, 0.75], [-4.8, -0.4, 0.5], [-1.9, -4.6, 0.6], [-5.9, 3.2, 0.42], [-2.2, 8.2, 0.5]].forEach(function (pp, i) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(pp[2], 18), puddleMat.clone());
      puddle.rotation.x = -Math.PI / 2;
      puddle.scale.y = 0.62 + (i % 3) * 0.14;
      puddle.rotation.z = i * 0.8;
      puddle.position.set(pp[0], 0.018, pp[1]);
      scene.add(puddle);
      g.puddles.push(puddle);
      // 水洼内假倒影（色块）
      const refA = new THREE.Mesh(new THREE.CircleGeometry(pp[2] * 0.55, 12),
        new THREE.MeshBasicMaterial({ color: 0x2e6e78, transparent: true, opacity: 0.28, depthWrite: false }));
      refA.rotation.x = -Math.PI / 2;
      refA.position.set(pp[0] - pp[2] * 0.18, 0.022, pp[1] + pp[2] * 0.1);
      scene.add(refA);
      const refB = new THREE.Mesh(new THREE.PlaneGeometry(pp[2] * 0.9, pp[2] * 0.18),
        new THREE.MeshBasicMaterial({ color: 0xf0f6f4, transparent: true, opacity: 0.35, depthWrite: false }));
      refB.rotation.x = -Math.PI / 2;
      refB.rotation.z = 0.5 + (i * 0.7);
      refB.position.set(pp[0] + pp[2] * 0.12, 0.024, pp[1] - pp[2] * 0.12);
      scene.add(refB);
    });

    // ================= 简易棚架 / 木箱等填充 =================
    const pallet = H.box(1.1, 0.12, 0.85, matWood, -7.9, 0.06, 2.2);
    scene.add(pallet);
    const smallCrate = H.box(0.5, 0.4, 0.45, H.toonMat(0xc8b890, { map: H.texWood(12), steps: 3, gradKey: 'b' }), -7.9, 0.32, 2.2);
    scene.add(smallCrate);
    H.addOutline(smallCrate, 0.011);

    return g;
  };
})();
