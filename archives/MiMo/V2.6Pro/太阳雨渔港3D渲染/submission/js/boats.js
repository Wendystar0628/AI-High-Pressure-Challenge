/* 船只：渔船 / 游钓船 + 可见驾驶舱内饰 */
(function () {
  'use strict';
  const H = window.H;
  const P = H.PAL;

  // ---------- 帆布纹理 ----------
  function texChart() {
    return H.canvasTex(256, function (ctx, s) {
      ctx.fillStyle = '#f2ecd8';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#6a8ca0';
      ctx.lineWidth = 1.2;
      // 等深线
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        for (let x = 0; x <= s; x += 8) {
          const y = 30 + i * 28 + Math.sin(x * 0.03 + i * 1.7) * 12;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // 岸线
      ctx.strokeStyle = '#4a6a52';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 180);
      for (let x = 0; x <= s; x += 10) {
        ctx.lineTo(x, 180 + Math.sin(x * 0.02) * 18 + Math.sin(x * 0.07) * 6);
      }
      ctx.stroke();
      // 经纬线
      ctx.strokeStyle = 'rgba(90,110,130,0.5)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(20 + i * 52, 0);
        ctx.lineTo(20 + i * 52, s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 16 + i * 52);
        ctx.lineTo(s, 16 + i * 52);
        ctx.stroke();
      }
      ctx.fillStyle = '#3a5560';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('潮 流 图', 96, 22);
      ctx.font = '11px sans-serif';
      ctx.fillText('S-12  港湾', 10, s - 8);
    });
  }

  function texTideTable() {
    return H.canvasTex(128, function (ctx, s) {
      ctx.fillStyle = '#f6f4ea';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#2a4050';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('潮汐表', 34, 18);
      ctx.font = '10px sans-serif';
      const rows = ['04:12 满', '10:35 干', '16:48 满', '23:02 干', '大 3.2m', '小 0.8m'];
      rows.forEach(function (r, i) {
        ctx.fillText(r, 16, 38 + i * 15);
      });
      ctx.strokeStyle = '#8aa0b0';
      ctx.strokeRect(4, 4, s - 8, s - 8);
    });
  }

  function texPhotoFish() {
    return H.canvasTex(128, function (ctx, s) {
      ctx.fillStyle = '#e8e2d2';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#7ab0c2';
      ctx.fillRect(8, 8, s - 16, s - 16);
      // 一条鱼
      ctx.fillStyle = '#e8f0e8';
      ctx.beginPath();
      ctx.ellipse(64, 72, 34, 15, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(24, 72);
      ctx.lineTo(8, 56);
      ctx.lineTo(8, 88);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a4050';
      ctx.beginPath();
      ctx.arc(86, 66, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0e8c8';
      ctx.font = '11px sans-serif';
      ctx.fillText('8.2kg', 46, 108);
    });
  }

  function texRadio() {
    return H.canvasTex(128, function (ctx, s) {
      ctx.fillStyle = '#c8b898';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#3a3a38';
      ctx.fillRect(12, 18, 104, 56);
      ctx.fillStyle = '#c8a86a';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(18 + i * 16, 24, 10, 44);
      }
      ctx.fillStyle = '#8a7458';
      ctx.beginPath();
      ctx.arc(34, 96, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(92, 96, 14, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ---------- 船体放样 ----------
  function hullGeometry(len, beam, depth, sternW) {
    const stations = 9;
    const rings = 7;
    const pos = [];
    const idx = [];
    for (let i = 0; i < stations; i++) {
      const t = i / (stations - 1); // 0=船尾 1=船首
      const z = (t - 0.5) * len;
      // 宽度剖面：船首收窄
      const w = beam * (sternW + (1 - sternW) * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5));
      const d = depth * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.2 + 0.15) * Math.PI * 0.5));
      for (let j = 0; j < rings; j++) {
        const u = j / (rings - 1); // -1..1 横向
        const x = (u * 2 - 1) * w;
        const y = -d * (1 - Math.pow(Math.abs(u * 2 - 1), 1.7));
        pos.push(x, y, z);
      }
    }
    for (let i = 0; i < stations - 1; i++) {
      for (let j = 0; j < rings - 1; j++) {
        const a = i * rings + j;
        const b = a + 1;
        const c = a + rings;
        const dd = c + 1;
        idx.push(a, c, b, b, c, dd);
      }
    }
    // 船尾封口
    const base = 0;
    for (let j = 0; j < rings - 1; j++) {
      idx.push(base + j, base + j + 1, base + (rings - 1) + j);
      idx.push(base + j + 1, base + (rings - 1) + j + 1, base + (rings - 1) + j);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // ---------- 驾驶舱内饰 ----------
  function buildCabinInterior(grp, opts) {
    const S = opts.scale || 1;
    const matPanel = H.toonMat(0xe4e2d8, { steps: 3, gradKey: 'b' });
    const matDark = H.toonMat(0x3a4248, { steps: 3, gradKey: 'b' });
    const matMetal = H.toonMat(0x9aa0a4, { steps: 3, gradKey: 'b' });
    const matYellow = H.toonMat(0xf0c828, { steps: 3, gradKey: 'b' });
    const matCup = H.toonMat(0xf2f2ec, { steps: 3, gradKey: 'b' });
    const matRed = H.toonMat(0xc04838, { steps: 3, gradKey: 'b' });

    // 仪表台
    const dash = H.box(1.15 * S, 0.34 * S, 0.28 * S, matDark, 0, 0.42 * S, -0.62 * S);
    grp.add(dash);
    H.addOutline(dash, 0.008);

    // 船舵（方向盘）
    const wheelG = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17 * S, 0.024 * S, 8, 18), matDark);
    wheelG.add(rim);
    for (let i = 0; i < 3; i++) {
      const sp = H.box(0.32 * S, 0.022 * S, 0.022 * S, matDark, 0, 0, 0);
      sp.rotation.z = (i / 3) * Math.PI;
      wheelG.add(sp);
    }
    const hub = H.cyl(0.038 * S, 0.038 * S, 0.05 * S, 8, matMetal, 0, 0, 0);
    hub.rotation.x = Math.PI / 2;
    wheelG.add(hub);
    const col = H.cyl(0.03 * S, 0.035 * S, 0.22 * S, 8, matMetal, 0, -0.1 * S, 0.1 * S);
    col.rotation.x = 0.9;
    wheelG.add(col);
    wheelG.position.set(-0.42 * S, 0.6 * S, -0.46 * S);
    wheelG.rotation.x = -0.42;
    grp.add(wheelG);
    H.addOutline(rim, 0.01);

    // 雷达屏（发微光）
    const radarFrame = H.box(0.38 * S, 0.28 * S, 0.06 * S, matDark, 0.12 * S, 0.68 * S, -0.56 * S);
    radarFrame.rotation.y = -1.05;
    grp.add(radarFrame);
    const radarScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.31 * S, 0.22 * S),
      new THREE.MeshBasicMaterial({ color: 0x2af0a0, transparent: true, opacity: 0.95 })
    );
    radarScreen.position.set(0.052 * S, 0.68 * S, -0.512 * S);
    radarScreen.rotation.y = -1.05;
    grp.add(radarScreen);
    opts.radarScreens.push(radarScreen);

    // 鱼探仪（微光）
    const finder = H.box(0.22 * S, 0.16 * S, 0.05 * S, matDark, 0.12 * S, 0.42 * S, -0.58 * S);
    finder.rotation.y = -1.05;
    grp.add(finder);
    const finderScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.17 * S, 0.11 * S),
      new THREE.MeshBasicMaterial({ color: 0x20b8f0, transparent: true, opacity: 0.92 })
    );
    finderScreen.position.set(0.052 * S, 0.42 * S, -0.532 * S);
    finderScreen.rotation.y = -1.05;
    grp.add(finderScreen);
    opts.radarScreens.push(finderScreen);

    // 海图板（夹在台上，斜放）
    const chart = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34 * S, 0.26 * S),
      new THREE.MeshToonMaterial({ map: texChart(), gradientMap: H.toonGradient(3) })
    );
    chart.position.set(-0.36 * S, 0.66 * S, -0.24 * S);
    chart.rotation.x = -0.62;
    chart.rotation.y = -0.45;
    grp.add(chart);
    const chartClip = H.box(0.36 * S, 0.012 * S, 0.03 * S, matMetal, -0.36 * S, 0.68 * S, -0.22 * S);
    chartClip.rotation.x = -0.62;
    chartClip.rotation.y = -0.45;
    grp.add(chartClip);

    // 潮汐表（贴在侧壁）
    const tide = new THREE.Mesh(
      new THREE.PlaneGeometry(0.17 * S, 0.17 * S),
      new THREE.MeshToonMaterial({ map: texTideTable(), gradientMap: H.toonGradient(3) })
    );
    tide.position.set(-0.42 * S, 0.72 * S, -0.68 * S);
    tide.rotation.y = -1.25;
    grp.add(tide);

    // 保温壶
    const thermos = H.cyl(0.062 * S, 0.068 * S, 0.22 * S, 10, matMetal, -0.14 * S, 0.74 * S, -0.38 * S);
    grp.add(thermos);
    const thCap = H.cyl(0.05 * S, 0.05 * S, 0.04 * S, 8, matRed, -0.14 * S, 0.87 * S, -0.38 * S);
    grp.add(thCap);

    // 搪瓷杯
    const cup = H.cyl(0.045 * S, 0.04 * S, 0.075 * S, 10, matCup, 0.08 * S, 0.64 * S, -0.66 * S);
    grp.add(cup);
    const cupRim = new THREE.Mesh(new THREE.TorusGeometry(0.045 * S, 0.008 * S, 6, 12), matRed);
    cupRim.position.set(0.08 * S, 0.68 * S, -0.66 * S);
    cupRim.rotation.x = Math.PI / 2;
    grp.add(cupRim);

    // 黄色雨衣（挂在钩上）
    const coat = new THREE.Group();
    const coatBody = H.box(0.26 * S, 0.42 * S, 0.1 * S, matYellow, 0, -0.22 * S, 0);
    coat.add(coatBody);
    const sleeveL = H.box(0.08 * S, 0.3 * S, 0.08 * S, matYellow, -0.16 * S, -0.18 * S, 0);
    sleeveL.rotation.z = 0.25;
    const sleeveR = H.box(0.08 * S, 0.3 * S, 0.08 * S, matYellow, 0.16 * S, -0.18 * S, 0);
    sleeveR.rotation.z = -0.25;
    coat.add(sleeveL, sleeveR);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.11 * S, 8, 6), matYellow);
    hood.position.set(0, 0.02 * S, 0);
    hood.scale.set(1, 0.8, 0.7);
    coat.add(hood);
    const hook = H.cyl(0.012 * S, 0.012 * S, 0.1 * S, 6, matMetal, 0, 0.14 * S, 0);
    coat.add(hook);
    coat.position.set(-0.12 * S, 1.02 * S, -0.72 * S);
    grp.add(coat);
    H.addOutline(coatBody, 0.01);

    // 窗边护身符 + 渔获照片
    const charm = new THREE.Group();
    const charmStr = H.box(0.008 * S, 0.1 * S, 0.008 * S, matRed, 0, -0.05 * S, 0);
    charm.add(charmStr);
    const charmBody = new THREE.Mesh(new THREE.SphereGeometry(0.038 * S, 8, 6), H.toonMat(0xf0e8e0, { steps: 2, gradKey: 'b' }));
    charmBody.position.y = -0.12 * S;
    charm.add(charmBody);
    const charmRed = H.box(0.05 * S, 0.02 * S, 0.02 * S, matRed, 0, -0.16 * S, 0);
    charm.add(charmRed);
    charm.position.set(-0.3 * S, 0.92 * S, -0.3 * S);
    grp.add(charm);

    const photo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.13 * S, 0.11 * S),
      new THREE.MeshToonMaterial({ map: texPhotoFish(), gradientMap: H.toonGradient(3) })
    );
    photo.position.set(-0.42 * S, 0.5 * S, -0.62 * S);
    photo.rotation.y = -1.25;
    photo.rotation.z = 0.12;
    grp.add(photo);
  }

  // ---------- 单艘船 ----------
  function makeBoat(opts) {
    const o = opts || {};
    const S = o.scale || 1;
    const grp = new THREE.Group();
    grp.userData.isBoat = true;
    const radarScreens = [];

    const matHull = H.toonMat(o.hullColor || P.boatWhite, { steps: 4, gradKey: 'a' });
    const matDeck = H.toonMat(o.deckColor || 0xd8d4c8, { steps: 3, gradKey: 'b' });
    const matTrim = H.toonMat(o.trimColor || P.seaDeep, { steps: 3, gradKey: 'b' });
    const matRust = H.toonMat(P.rust, { map: H.texRust(), steps: 3, gradKey: 'b' });
    const matIron = H.toonMat(P.iron, { steps: 3, gradKey: 'b' });
    const matWhite = H.toonMat(P.white, { steps: 3, gradKey: 'b' });
    const matOrange = H.toonMat(P.ringOrange, { steps: 3, gradKey: 'b' });
    const matRoof = H.toonMat(0xe8e4d8, { steps: 3, gradKey: 'b' });

    const L = o.len || 3.2;
    const B = o.beam || 0.85;
    const D = o.depth || 0.42;

    // 船体
    const hull = new THREE.Mesh(hullGeometry(L, B, D, 0.72), matHull);
    hull.position.y = D * 0.22;
    hull.castShadow = true;
    hull.receiveShadow = true;
    grp.add(hull);
    H.addOutline(hull, 0.014);

    // 船舷饰带
    const stripe = new THREE.Mesh(hullGeometry(L * 0.99, B * 1.03, D * 0.42, 0.72), matTrim);
    stripe.position.y = D * 0.58;
    grp.add(stripe);
    const bottomPaint = new THREE.Mesh(hullGeometry(L * 0.98, B * 0.92, D * 0.55, 0.72), H.toonMat(0x2a5a66, { steps: 3, gradKey: "b" }));
    bottomPaint.position.y = D * 0.02;
    grp.add(bottomPaint);

    // 甲板
    const deck = new THREE.Mesh(new THREE.BoxGeometry(B * 1.55, 0.06, L * 0.86), matDeck);
    deck.position.y = D * 0.55;
    deck.castShadow = deck.receiveShadow = true;
    grp.add(deck);

    // 锈迹斑块
    const rng = H.makeRng(o.seed || 11);
    for (let i = 0; i < 9; i++) {
      const rp = new THREE.Mesh(new THREE.PlaneGeometry(0.2 + rng() * 0.32, 0.12 + rng() * 0.18), matRust);
      const side = rng() > 0.5 ? 1 : -1;
      rp.position.set(side * B * 0.78, D * (0.15 + rng() * 0.3), (rng() - 0.5) * L * 0.7);
      rp.rotation.y = side * Math.PI / 2;
      rp.rotation.z = (rng() - 0.5) * 0.8;
      grp.add(rp);
    }

    // 轮胎护舷
    const tireGeo = new THREE.TorusGeometry(0.19, 0.075, 8, 14);
    for (let i = 0; i < 3; i++) {
      const side = o.fenderSide || -1;
      const tire = new THREE.Mesh(tireGeo, matIron);
      tire.position.set(side * B * 0.92, D * 0.28, -L * 0.22 + i * L * 0.22);
      tire.rotation.y = Math.PI / 2;
      grp.add(tire);
    }

    // 救生圈（橙白）
    const ring = new THREE.Group();
    const ringT = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.055, 8, 16), matOrange);
    ring.add(ringT);
    for (let i = 0; i < 4; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.058, 6, 4, Math.PI / 2.6), matWhite);
      band.rotation.z = (i / 4) * Math.PI * 2;
      ring.add(band);
    }
    ring.position.set(B * 0.72, D * 0.95, -L * 0.12);
    ring.rotation.y = Math.PI / 2;
    ring.rotation.z = 0.3;
    grp.add(ring);
    H.addOutline(ringT, 0.01);

    // ---------- 驾驶舱 ----------
    const cabinG = new THREE.Group();
    const cabinLen = L * 0.46;
    const cabinW = B * 1.28;
    const cabinH = o.cabinH || 0.78;
    const cabinY = D * 0.58;
    cabinG.position.set(0, cabinY, o.cabinZ === undefined ? -L * 0.08 : o.cabinZ);

    if (o.hasCabin) {
      // 舱体（后壁+顶+前壁+侧壁下部）
      const back = H.box(cabinW, cabinH, 0.06, matRoof, 0, cabinH / 2, -cabinLen / 2);
      const top = H.box(cabinW, 0.07, cabinLen, matRoof, 0, cabinH, 0);
      const frontLow = H.box(cabinW, cabinH * 0.42, 0.05, matRoof, 0, cabinH * 0.21, cabinLen / 2);
      cabinG.add(back, top, frontLow);
      H.addOutline(top, 0.012);
      // 侧壁下部
      [-1, 1].forEach(function (sd) {
        const low = H.box(0.05, cabinH * 0.34, cabinLen, matRoof, sd * cabinW / 2, cabinH * 0.17, 0);
        cabinG.add(low);
      });
      // 前风挡玻璃（透明）
      const glassMat = new THREE.MeshPhongMaterial({
        color: P.glass,
        transparent: true,
        opacity: 0.1,
        shininess: 90,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const windshield = new THREE.Mesh(new THREE.PlaneGeometry(cabinW * 0.92, cabinH * 0.5), glassMat);
      windshield.position.set(0, cabinH * 0.7, cabinLen / 2 + 0.01);
      cabinG.add(windshield);
      // 侧窗玻璃
      [-1, 1].forEach(function (sd) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(cabinLen * 0.88, cabinH * 0.52), glassMat);
        win.position.set(sd * (cabinW / 2 + 0.012), cabinH * 0.62, 0);
        win.rotation.y = sd * Math.PI / 2;
        cabinG.add(win);
        // 窗框
        const frameT = H.box(0.03, 0.03, cabinLen * 0.9, matRoof, sd * cabinW / 2, cabinH * 0.94, 0);
        const frameB = H.box(0.03, 0.03, cabinLen * 0.9, matRoof, sd * cabinW / 2, cabinH * 0.5, 0);
        cabinG.add(frameT, frameB);
      });
      // 敞开的舱门（右侧）
      const door = H.box(0.05, cabinH * 0.8, 0.32, matRoof, cabinW / 2 + 0.14, cabinH * 0.42, -cabinLen * 0.22);
      door.rotation.y = 1.05;
      cabinG.add(door);
      H.addOutline(door, 0.01);

      // 内饰
      buildCabinInterior(cabinG, { scale: 1, radarScreens: radarScreens });

      // 顶上设备
      const roofY = cabinH + 0.05;
      // 桅杆
      const mast = H.cyl(0.028, 0.035, 1.35, 8, matWhite, -B * 0.32, roofY + 0.62, cabinLen * 0.18);
      cabinG.add(mast);
      H.addOutline(mast, 0.008);
      // 横桁
      const yard = H.cyl(0.02, 0.02, 0.62, 6, matWhite, -B * 0.32, roofY + 1.05, cabinLen * 0.18);
      yard.rotation.z = Math.PI / 2;
      cabinG.add(yard);
      // 天线
      const ant1 = H.cyl(0.008, 0.012, 0.85, 5, matIron, B * 0.22, roofY + 0.55, -cabinLen * 0.2);
      cabinG.add(ant1);
      const ant2 = H.cyl(0.006, 0.008, 0.55, 5, matIron, B * 0.38, roofY + 0.35, cabinLen * 0.24);
      ant2.rotation.z = -0.18;
      cabinG.add(ant2);
      // 雷达罩
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), matWhite);
      dome.position.set(B * 0.12, roofY + 0.12, -cabinLen * 0.06);
      cabinG.add(dome);
      H.addOutline(dome, 0.01);
      // 遮阳铁架
      const frameM = H.toonMat(0x7a8488, { steps: 3, gradKey: 'b' });
      [-1, 1].forEach(function (sd) {
        const post = H.cyl(0.018, 0.018, 0.42, 6, frameM, sd * cabinW * 0.42, roofY + 0.21, cabinLen * 0.34);
        cabinG.add(post);
      });
      const shade = H.box(cabinW * 1.02, 0.035, cabinLen * 0.42, matRoof, 0, roofY + 0.42, cabinLen * 0.32);
      cabinG.add(shade);
      H.addOutline(shade, 0.012);
    } else {
      // 无舱小渔船：小驾驶台 + 篷架
      const console = H.box(0.42, 0.42, 0.34, matRoof, 0, D * 0.85, -L * 0.05);
      cabinG.add(console);
      const tinyWheel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 6, 12), matIron);
      tinyWheel.position.set(0, D * 1.18, -L * 0.02);
      tinyWheel.rotation.x = -0.5;
      cabinG.add(tinyWheel);
      const mast = H.cyl(0.022, 0.03, 1.1, 6, matWhite, 0, D * 1.2, -L * 0.16);
      cabinG.add(mast);
      // 帆布篷架
      const canvasMat = H.toonMat(0xe8e0c8, { steps: 3, gradKey: 'b', side: THREE.DoubleSide });
      for (let i = 0; i < 3; i++) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.018, 6, 12, Math.PI), matIron);
        arc.position.set(0, D * 1.05, -L * 0.12 + i * L * 0.18);
        arc.rotation.y = Math.PI / 2;
        cabinG.add(arc);
      }
      const canvasTop = new THREE.Mesh(new THREE.PlaneGeometry(1.15, L * 0.42), canvasMat);
      canvasTop.rotation.x = -Math.PI / 2;
      canvasTop.position.set(0, D * 1.62, -L * 0.02);
      cabinG.add(canvasTop);
    }
    grp.add(cabinG);

    // 船尾缆绳桩
    const bitt = H.cyl(0.04, 0.05, 0.16, 6, matIron, 0, D * 0.68, -L * 0.42);
    grp.add(bitt);

    // 舷窗雨珠
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xd8ecec, transparent: true, opacity: 0.6 });
    const rngD = H.makeRng((o.seed || 11) * 7);
    for (let i = 0; i < 10; i++) {
      const dr = new THREE.Mesh(new THREE.SphereGeometry(0.016 + rngD() * 0.012, 5, 4), dropMat);
      const sd = rngD() > 0.5 ? 1 : -1;
      dr.position.set(sd * B * 0.66, D * 0.85 + rngD() * 0.35, (rngD() - 0.5) * L * 0.6);
      grp.add(dr);
    }
    // 舱顶水面粼光
    if (o.hasCabin) {
      const glimmer = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3),
        new THREE.MeshBasicMaterial({ color: 0xbfe8ea, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      glimmer.rotation.x = Math.PI / 2;
      glimmer.position.set(0, cabinY + cabinH - 0.02, 0);
      glimmer.userData.isCeilGlimmer = true;
      grp.add(glimmer);
    }
    grp.userData.radarScreens = radarScreens;
    grp.userData.hull = hull;
    grp.userData.cabin = cabinG;
    return grp;
  }

  // ---------- 缆绳 ----------
  function makeRope(from, to, sag, mat) {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.y -= sag;
    const curve = new THREE.CatmullRomCurve3([from, mid, to]);
    const geo = new THREE.TubeGeometry(curve, 12, 0.032, 6, false);
    return new THREE.Mesh(geo, mat);
  }

  // ---------- 构建全部船只 ----------
  H.buildBoats = function (scene) {
    const g = (H.boats = {});
    const list = [];
    const matRope = H.toonMat(P.rope, { steps: 3, gradKey: 'b' });
    const matRopeDark = H.toonMat(P.ropeDark, { steps: 3, gradKey: 'b' });

    const defs = [
      {
        // 小型渔船（无舱）
        x: -2.35, y: 0, z: -6.6, rotY: 0,
        len: 2.7, beam: 0.78, depth: 0.4, seed: 31,
        hasCabin: false, hullColor: 0xeceee8, trimColor: 0x2e6e78,
        fenderSide: -1,
      },
      {
        // 白色渔船（带驾驶舱）— 重点展示
        x: -2.35, y: 0, z: -2.5, rotY: 0,
        len: 3.4, beam: 0.92, depth: 0.46, seed: 47,
        hasCabin: true, hullColor: 0xf2f4ee, trimColor: 0x2a6070,
        fenderSide: -1, cabinZ: -0.35, cabinH: 0.82,
      },
      {
        // 游钓船
        x: -2.35, y: 0, z: 1.7, rotY: 0,
        len: 3.2, beam: 0.9, depth: 0.44, seed: 63,
        hasCabin: true, hullColor: 0xeef0ea, trimColor: 0xc85a32,
        fenderSide: -1, cabinZ: -0.28, cabinH: 0.8,
      },
      {
        // 外侧泊位渔船（会出港）
        x: -2.4, y: 0, z: -9.2, rotY: 0,
        len: 3.0, beam: 0.86, depth: 0.42, seed: 81,
        hasCabin: true, hullColor: 0xf0f2ec, trimColor: 0x3e6e9e,
        fenderSide: -1, cabinZ: -0.3, cabinH: 0.76,
      },
    ];

    defs.forEach(function (d, i) {
      const boat = makeBoat(d);
      boat.position.set(d.x, H.L.WATER + 0.16, d.z);
      boat.rotation.y = d.rotY;
      scene.add(boat);
      // 缆绳到系船柱
      const bollard = H.L.QUAY_E - 0.42;
      [-1, 1].forEach(function (sd) {
        const from = new THREE.Vector3(bollard, 0.42, d.z + sd * 1.0);
        const to = new THREE.Vector3(d.x + 0.72, H.L.WATER + 0.55, d.z + sd * 1.15);
        const rope = makeRope(from, to, 0.22, i % 2 ? matRope : matRopeDark);
        scene.add(rope);
        (g.ropes = g.ropes || []).push(rope);
      });
      boat.userData.index = i;
      boat.userData.baseY = boat.position.y;
      boat.userData.baseRotY = d.rotY;
      boat.userData.phase = i * 1.7;
      list.push(boat);
    });

    g.list = list;
    g.leavingBoat = list[3];
    return g;
  };
})();
