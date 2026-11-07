/* 生物：海鸥、港猫、水下小鱼 */
(function () {
  'use strict';
  const H = window.H;
  const P = H.PAL;

  function makeGull() {
    const g = new THREE.Group();
    const matBody = H.toonMat(0xf2f4f2, { steps: 3, gradKey: 'b' });
    const matWing = H.toonMat(0xdfe4e6, { steps: 3, gradKey: 'b', side: THREE.DoubleSide });
    const matBeak = H.toonMat(0xe8a030, { steps: 3, gradKey: 'b' });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), matBody);
    body.scale.set(1, 0.85, 1.55);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), matBody);
    head.position.set(0, 0.075, 0.16);
    g.add(head);
    const beak = H.cyl(0.012, 0.03, 0.1, 6, matBeak, 0, 0.065, 0.26);
    beak.rotation.x = Math.PI / 2;
    g.add(beak);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.12), matWing);
    tail.position.set(0, 0.02, -0.2);
    tail.rotation.x = -0.5;
    g.add(tail);
    // 翅膀
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.19), matWing);
    wingL.position.set(-0.27, 0.05, 0.01);
    const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.19), matWing);
    wingR.position.set(0.27, 0.05, 0.01);
    g.add(wingL, wingR);
    // 脚
    [-1, 1].forEach(function (sd) {
      const leg = H.cyl(0.01, 0.01, 0.07, 4, matBeak, sd * 0.045, -0.1, 0.02);
      g.add(leg);
    });
    g.userData.wingL = wingL;
    g.userData.wingR = wingR;
    g.userData.body = body;
    return g;
  }

  function makeCat() {
    const g = new THREE.Group();
    const matFur = H.toonMat(0x5a5e62, { steps: 3, gradKey: 'b' });
    const matFur2 = H.toonMat(0x7a8086, { steps: 3, gradKey: 'b' });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), matFur);
    body.scale.set(1, 0.82, 1.35);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), matFur2);
    head.position.set(0, 0.13, 0.22);
    g.add(head);
    // 耳
    [-1, 1].forEach(function (sd) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 4), matFur2);
      ear.position.set(sd * 0.07, 0.24, 0.22);
      ear.rotation.z = sd * 0.3;
      g.add(ear);
    });
    // 尾
    const tail = H.cyl(0.025, 0.045, 0.32, 6, matFur, 0, 0.1, -0.28);
    tail.rotation.x = -1.15;
    g.add(tail);
    g.userData.tail = tail;
    g.userData.head = head;
    // 腿（趴卧时收起）
    g.userData.legs = [];
    [[-0.09, 0.16], [0.09, 0.16], [-0.09, -0.12], [0.09, -0.12]].forEach(function (lp) {
      const leg = H.cyl(0.028, 0.032, 0.11, 5, matFur, lp[0], -0.1, lp[1]);
      g.add(leg);
      g.userData.legs.push(leg);
    });
    return g;
  }

  function makeFish(color) {
    const g = new THREE.Group();
    const mat = H.toonMat(color, { steps: 3, gradKey: 'b' });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat);
    body.scale.set(0.75, 0.6, 1.6);
    g.add(body);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.11), mat);
    tail.position.z = -0.16;
    tail.rotation.y = Math.PI / 2;
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.06), mat);
    fin.position.y = 0.07;
    g.add(fin);
    return g;
  }

  H.buildCreatures = function (scene) {
    const g = (H.creatures = {});

    // ================= 海鸥 =================
    g.gulls = [];
    const perchSpots = [
      new THREE.Vector3(-1.12, 0.68, -5.6), // 系船柱
      new THREE.Vector3(-1.12, 0.68, -0.4),
      new THREE.Vector3(-2.35, 1.15, -2.5), // 船顶
      new THREE.Vector3(-2.35, 1.15, 1.7),
      new THREE.Vector3(5.4, 1.9, -5.0), // 灯塔
    ];
    for (let i = 0; i < 6; i++) {
      const gull = makeGull();
      gull.userData.idx = i;
      gull.userData.perch = perchSpots[i % perchSpots.length];
      gull.userData.flyPhase = i * 1.05;
      gull.scale.setScalar(0.85 + (i % 3) * 0.12);
      scene.add(gull);
      g.gulls.push(gull);
    }

    // ================= 港猫 =================
    const cat = makeCat();
    cat.position.set(3.22, 0.26, 7.28); // 舢板下
    cat.rotation.y = 2.3;
    cat.scale.setScalar(0.92);
    scene.add(cat);
    g.cat = cat;

    // ================= 水下小鱼群 =================
    g.fish = [];
    const fishColors = [0x8ab8c2, 0x6a9aa8, 0xa8c8c0, 0x7aa8b0, 0x98b8c8];
    for (let i = 0; i < 16; i++) {
      const f = makeFish(fishColors[i % fishColors.length]);
      f.userData.idx = i;
      const fx = i < 6 ? 7.2 + (i % 3) * 0.9 : 1.2 + (i % 5) * 1.2;
      const fz = i < 6 ? -5 + (i % 2) * 3.2 : -5.5 + Math.floor(i / 5) * 2.6 + (i % 2) * 0.7;
      f.userData.center = new THREE.Vector3(fx, H.L.BOT + 0.55 + (i % 3) * 0.22, fz);
      f.userData.phase = i * 0.83;
      f.userData.radius = 0.55 + (i % 4) * 0.3;
      f.scale.setScalar(0.8 + (i % 3) * 0.18);
      scene.add(f);
      g.fish.push(f);
    }

    // 远处驶过的渔船（防波堤外）
    const farBoat = new THREE.Group();
    const fbMat = new THREE.MeshBasicMaterial({ color: 0x8aaab2, transparent: true, opacity: 0.55 });
    const fbHull = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.42), fbMat);
    fbHull.position.y = 0.12;
    const fbCabin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.36), fbMat);
    fbCabin.position.set(-0.15, 0.42, 0);
    const fbMast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.8, 5), fbMat);
    fbMast.position.set(0.2, 0.75, 0);
    farBoat.add(fbHull, fbCabin, fbMast);
    farBoat.position.set(-14, H.L.WATER + 0.05, -11.2);
    farBoat.scale.setScalar(1.15);
    scene.add(farBoat);
    g.farBoat = farBoat;

    return g;
  };
})();
