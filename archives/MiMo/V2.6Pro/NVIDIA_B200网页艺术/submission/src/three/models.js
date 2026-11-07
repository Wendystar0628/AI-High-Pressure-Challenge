// ============================================================
// 三维模型：B200 封装（基板·中介层·双晶粒·8×HBM3e·焊球·框架）
// 以及系统层：HGX 板 / DGX 服务器 / GB200 / NVL72 机柜
// 微凸点、TSV、走线等细节在推近、拆开后可观察
// ============================================================
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------
// B200 封装
// ------------------------------------------------------------
export function buildPackage(mats) {
  const group = new THREE.Group();
  group.name = 'B200Package';

  const parts = {};
  const detail = {}; // 需要随展开显隐的细节

  // ---- 基板（分层：阻焊 / 芯板 / 两层铜）----
  const substrate = new THREE.Group();
  substrate.name = 'substrate';
  const subTop = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.22, 11.4), mats.substrateMat);
  subTop.position.y = 0.11;
  subTop.castShadow = subTop.receiveShadow = true;
  subTop.userData.partId = 'substrate';
  const core = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.3, 11.2), mats.capMat);
  core.position.y = -0.16;
  core.castShadow = core.receiveShadow = true;
  core.userData.partId = 'substrate';
  const cu1 = new THREE.Mesh(new THREE.BoxGeometry(11.15, 0.05, 11.15), mats.copperMat);
  cu1.position.y = -0.02;
  cu1.userData.partId = 'substrate';
  const cu2 = new THREE.Mesh(new THREE.BoxGeometry(11.15, 0.05, 11.15), mats.copperMat);
  cu2.position.y = -0.32;
  cu2.userData.partId = 'substrate';
  const subBot = new THREE.Mesh(new THREE.BoxGeometry(11.35, 0.1, 11.35), mats.substrateMat);
  subBot.position.y = -0.42;
  subBot.receiveShadow = true;
  subBot.userData.partId = 'substrate';
  substrate.add(subTop, cu1, core, cu2, subBot);
  group.add(substrate);
  parts.substrate = substrate;

  // ---- 焊球阵列（底面 BGA）----
  const balls = new THREE.Group();
  balls.name = 'balls';
  const ballGeo = new THREE.SphereGeometry(0.085, 10, 8);
  const N = 34;
  const inst = new THREE.InstancedMesh(ballGeo, mats.solderMat, N * N);
  const m4 = new THREE.Matrix4();
  let bi = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      // 中央区让位给高密度区（示意）
      const x = -5.3 + (i / (N - 1)) * 10.6;
      const z = -5.3 + (j / (N - 1)) * 10.6;
      m4.makeTranslation(x, -0.58, z);
      inst.setMatrixAt(bi++, m4);
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = true;
  inst.userData.partId = 'balls';
  balls.add(inst);
  group.add(balls);
  parts.balls = balls;

  // ---- 中介层 ----
  const interposer = new THREE.Group();
  interposer.name = 'interposer';
  const ip = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.12, 7.4), mats.interposerMat);
  ip.position.y = 0.32;
  ip.castShadow = ip.receiveShadow = true;
  ip.userData.partId = 'interposer';
  interposer.add(ip);
  // 中介层表面走线（细金条）
  const traceGeo = new THREE.BoxGeometry(0.045, 0.012, 2.1);
  const traceCount = 42;
  const traceInst = new THREE.InstancedMesh(traceGeo, mats.goldMat, traceCount);
  for (let i = 0; i < traceCount; i++) {
    const x = -4.4 + (i / (traceCount - 1)) * 8.8;
    m4.makeTranslation(x, 0.392, (i % 2 ? -1.4 : 1.4));
    traceInst.setMatrixAt(i, m4);
  }
  traceInst.instanceMatrix.needsUpdate = true;
  traceInst.userData.partId = 'interposer';
  interposer.add(traceInst);
  group.add(interposer);
  parts.interposer = interposer;

  // ---- 两颗计算晶粒 ----
  const diesGroup = new THREE.Group();
  diesGroup.name = 'dies';

  function makeDie(id, xSign, mat, variant) {
    const g = new THREE.Group();
    g.name = id;
    g.position.set(xSign * 1.98, 0, 0);
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.26, 4.6), mat);
    body.position.y = 0.52;
    body.castShadow = body.receiveShadow = true;
    body.userData.partId = id;
    g.add(body);

    // 微凸点阵列（底面，展开后可见）
    const bumpGeo = new THREE.SphereGeometry(0.052, 8, 6);
    const bx = 22, bz = 28;
    const bumps = new THREE.InstancedMesh(bumpGeo, mats.solderMat, bx * bz);
    let k = 0;
    for (let i = 0; i < bx; i++) {
      for (let j = 0; j < bz; j++) {
        m4.makeTranslation(-1.55 + (i / (bx - 1)) * 3.1, 0.365, -2.0 + (j / (bz - 1)) * 4.0);
        bumps.setMatrixAt(k++, m4);
      }
    }
    bumps.instanceMatrix.needsUpdate = true;
    bumps.userData.partId = id;
    g.add(bumps);
    detail[id + 'Bumps'] = bumps;

    // 功能区（可选中的示意区：Tensor 阵列 / L2 / NVLink PHY / HBM PHY / D2D）
    const zones = new THREE.Group();
    zones.name = id + 'Zones';
    const zoneDefs = [
      { zid: 'tensor', w: 3.1, d: 2.6, x: 0, z: -0.95, color: mats.glowCyan, label: 'Tensor 阵列' },
      { zid: 'l2', w: 3.1, d: 0.7, x: 0, z: 0.62, color: mats.glowAmber, label: 'L2 缓存' },
      { zid: 'hbmphy', w: 3.1, d: 0.55, x: 0, z: 1.85, color: mats.glowGreen, label: 'HBM PHY' },
      { zid: 'nvlink', w: 0.5, d: 3.6, x: xSign * 1.42, z: 0, color: mats.glowCoral, label: 'NVLink PHY' },
      { zid: 'd2d', w: 0.36, d: 3.6, x: -xSign * 1.55, z: 0, color: mats.glowCyan, label: '片间互连' },
    ];
    for (const z of zoneDefs) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(z.w, 0.028, z.d), z.color.clone());
      mesh.position.set(z.x, 0.665, z.z);
      mesh.material.transparent = true;
      mesh.material.opacity = 0.0;
      mesh.userData.zoneId = z.zid;
      mesh.userData.partId = id;
      mesh.userData.baseColor = z.color.color.clone();
      zones.add(mesh);
    }
    g.add(zones);
    detail[id + 'Zones'] = zones;
    return g;
  }

  const dieA = makeDie('dieA', -1, mats.dieMatA, 0);
  const dieB = makeDie('dieB', 1, mats.dieMatB, 1);
  diesGroup.add(dieA, dieB);
  group.add(diesGroup);
  parts.dieA = dieA;
  parts.dieB = dieB;

  // NV-HBI 片间桥（接缝发光带）
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 3.9), mats.glowCyan.clone());
  bridge.position.set(0, 0.52, 0);
  bridge.material.transparent = true;
  bridge.material.opacity = 0.35;
  bridge.userData.partId = 'bridge';
  diesGroup.add(bridge);
  parts.bridge = bridge;
  detail.bridge = bridge;

  // ---- 8 个 HBM3e 堆栈 ----
  const hbmGroup = new THREE.Group();
  hbmGroup.name = 'hbm';
  const hbmStacks = [];
  // 布局：左右各 4 个
  const hbmPos = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      hbmPos.push({ x: side * 4.55, z: -1.85 + i * 1.28, id: `hbm${(side < 0 ? 0 : 4) + i}` });
    }
  }
  for (const hp of hbmPos) {
    const stack = new THREE.Group();
    stack.name = hp.id;
    stack.position.set(hp.x, 0, hp.z);
    stack.userData.partId = hp.id;

    // 底部逻辑基底（较厚）
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.24, 1.12), mats.logicDieMat);
    base.position.y = 0.5;
    base.castShadow = base.receiveShadow = true;
    base.userData.partId = hp.id;
    stack.add(base);

    // 8 层 DRAM + 微凸点 + TSV
    const layers = [];
    for (let L = 0; L < 8; L++) {
      const layer = new THREE.Group();
      layer.userData.layerIndex = L;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.085, 1.09), L % 2 ? mats.dramAltMat : mats.dramMat);
      slab.castShadow = slab.receiveShadow = true;
      slab.userData.partId = hp.id;
      layer.add(slab);

      // 层间微凸点
      const bg = new THREE.SphereGeometry(0.028, 6, 5);
      const bCount = 8 * 5;
      const bumps = new THREE.InstancedMesh(bg, mats.solderMat, bCount);
      let k = 0;
      for (let a = 0; a < 8; a++) {
        for (let b = 0; b < 5; b++) {
          m4.makeTranslation(-0.9 + a * 0.256, -0.055, -0.4 + b * 0.2);
          bumps.setMatrixAt(k++, m4);
        }
      }
      bumps.instanceMatrix.needsUpdate = true;
      layer.add(bumps);

      // TSV（贯穿层的硅通孔，展开后可见）
      const tsvGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.1, 6);
      const tCount = 6 * 4;
      const tsvs = new THREE.InstancedMesh(tsvGeo, mats.tsvMat, tCount);
      k = 0;
      for (let a = 0; a < 6; a++) {
        for (let b = 0; b < 4; b++) {
          m4.makeTranslation(-0.78 + a * 0.31, 0.0, -0.32 + b * 0.21);
          tsvs.setMatrixAt(k++, m4);
        }
      }
      tsvs.instanceMatrix.needsUpdate = true;
      layer.add(tsvs);

      layer.position.y = 0.68 + L * 0.115;
      stack.add(layer);
      layers.push(layer);
    }
    stack.userData.layers = layers;
    hbmGroup.add(stack);
    hbmStacks.push(stack);
  }
  group.add(hbmGroup);
  parts.hbmGroup = hbmGroup;

  // ---- 去耦电容（基板外围）----
  const caps = new THREE.Group();
  caps.name = 'caps';
  const capGeo = new THREE.BoxGeometry(0.28, 0.14, 0.16);
  const capCount = 56;
  const capInst = new THREE.InstancedMesh(capGeo, mats.capMat, capCount);
  let ci = 0;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 14; i++) {
      const t = -4.6 + i * 0.7;
      let x, z;
      if (side === 0) { x = t; z = -4.6; }
      else if (side === 1) { x = t; z = 4.6; }
      else if (side === 2) { x = -4.6; z = t; }
      else { x = 4.6; z = t; }
      m4.makeTranslation(x, 0.32, z);
      capInst.setMatrixAt(ci++, m4);
    }
  }
  capInst.instanceMatrix.needsUpdate = true;
  capInst.userData.partId = 'caps';
  caps.add(capInst);
  group.add(caps);
  parts.caps = caps;

  // ---- 加固框架 + 盖板 ----
  const frame = new THREE.Group();
  frame.name = 'frame';
  const fw = 0.55, fh = 0.42, fl = 11.9;
  const fTop = new THREE.Mesh(new THREE.BoxGeometry(fl, fh, fw), mats.frameMat);
  fTop.position.set(0, 0.62, -fl / 2 + fw / 2);
  fTop.castShadow = true;
  const fBot = fTop.clone(); fBot.position.z = fl / 2 - fw / 2;
  const fL = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fl - fw * 2), mats.frameMat);
  fL.position.set(-fl / 2 + fw / 2, 0.62, 0);
  fL.castShadow = true;
  const fR = fL.clone(); fR.position.x = fl / 2 - fw / 2;
  for (const m of [fTop, fBot, fL, fR]) m.userData.partId = 'frame';
  frame.add(fTop, fBot, fL, fR);
  group.add(frame);
  parts.frame = frame;

  const lid = new THREE.Group();
  lid.name = 'lid';
  const lidTop = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.16, 4.3), mats.lidMat);
  lidTop.position.y = 1.02;
  lidTop.castShadow = lidTop.receiveShadow = true;
  lidTop.userData.partId = 'lid';
  // 盖板侧裙
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(6.15, 0.28, 4.35), mats.lidMat);
  skirt.position.y = 0.86;
  skirt.userData.partId = 'lid';
  lid.add(lidTop, skirt);
  group.add(lid);
  parts.lid = lid;

  // ---- 数据流路径（HBM → 晶粒 / 跨缝）----
  const paths = [];
  for (const hp of hbmPos) {
    const dieX = hp.x < 0 ? -1.98 : 1.98;
    paths.push({
      id: hp.id + '-die',
      curve: new THREE.CatmullRomCurve3([
        V(hp.x, 1.1, hp.z),
        V((hp.x + dieX) / 2, 1.0, hp.z * 0.6),
        V(dieX, 0.9, hp.z * 0.3),
        V(dieX, 0.75, 0),
      ]),
      color: 0x46d8ff,
      partId: hp.id,
    });
  }
  // 跨缝路径
  paths.push({
    id: 'cross-seam',
    curve: new THREE.CatmullRomCurve3([
      V(-1.85, 0.8, -1.2), V(-0.6, 0.95, -0.5), V(0, 1.05, 0), V(0.6, 0.95, 0.5), V(1.85, 0.8, 1.2),
    ]),
    color: 0x9bebff,
    partId: 'bridge',
  });
  paths.push({
    id: 'cross-seam2',
    curve: new THREE.CatmullRomCurve3([
      V(-1.85, 0.8, 1.2), V(-0.6, 0.95, 0.5), V(0, 1.05, 0), V(0.6, 0.95, -0.5), V(1.85, 0.8, -1.2),
    ]),
    color: 0x9bebff,
    partId: 'bridge',
  });

  return { group, parts, detail, hbmStacks, paths, hbmPos };
}

// ------------------------------------------------------------
// 数据脉冲：沿路径运动的发光体
// ------------------------------------------------------------
export function buildPulses(paths, mats, countPerPath = 5) {
  const group = new THREE.Group();
  group.name = 'pulses';
  const items = [];
  for (const p of paths) {
    for (let i = 0; i < countPerPath; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), mats.glowCyan.clone());
      mesh.material.color.setHex(p.color);
      group.add(mesh);
      items.push({ mesh, curve: p.curve, offset: i / countPerPath, pathId: p.id, partId: p.partId });
    }
  }
  return { group, items };
}

// ------------------------------------------------------------
// HGX B200 八卡基板
// ------------------------------------------------------------
export function buildHGX(mats) {
  const group = new THREE.Group();
  group.name = 'HGX';
  const board = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 13), mats.pcbMat);
  board.position.y = 0;
  board.castShadow = board.receiveShadow = true;
  board.userData.partId = 'hgx';
  group.add(board);

  const gpus = [];
  for (let i = 0; i < 8; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    const g = new THREE.Group();
    g.position.set(-7.2 + col * 4.8, 0.25, row === 0 ? -3.4 : 3.4);
    const pkg = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.55, 2.6), mats.lidMat);
    pkg.castShadow = pkg.receiveShadow = true;
    pkg.userData.partId = 'hgxGpu' + i;
    pkg.userData.role = 'gpu';
    const dieGlow = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.8), mats.dieMatA.clone());
    dieGlow.position.y = 0.33;
    dieGlow.userData.partId = 'hgxGpu' + i;
    g.add(pkg, dieGlow);
    group.add(g);
    gpus.push(g);
  }

  // NVSwitch 芯片
  for (let i = 0; i < 4; i++) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.6), mats.logicDieMat);
    sw.position.set(-5.4 + i * 3.6, 0.42, 0);
    sw.userData.partId = 'nvswitch';
    sw.userData.role = 'switch';
    group.add(sw);
  }

  // NVLink 连接器条
  const conn = new THREE.Mesh(new THREE.BoxGeometry(18, 0.28, 0.7), mats.goldMat);
  conn.position.set(0, 0.42, -6.0);
  conn.userData.partId = 'hgx';
  group.add(conn);

  group.position.set(0, -26, 0);
  return { group, gpus };
}

// ------------------------------------------------------------
// DGX B200 服务器
// ------------------------------------------------------------
export function buildServer(mats) {
  const group = new THREE.Group();
  group.name = 'DGX';
  // 机箱
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(24, 7, 15), mats.darkMetalMat);
  chassis.castShadow = chassis.receiveShadow = true;
  chassis.userData.partId = 'dgx';
  group.add(chassis);

  // 前面板（通风孔纹理）
  const front = new THREE.Mesh(new THREE.BoxGeometry(24.1, 6.6, 0.3), mats.rackMat);
  front.position.z = 7.55;
  front.userData.partId = 'dgxFront';
  group.add(front);

  // 风扇阵列
  for (let i = 0; i < 6; i++) {
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.3, 20), mats.darkMetalMat);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(-8 + i * 3.2, 2.2, -7.6);
    fan.userData.partId = 'dgxFan';
    group.add(fan);
  }

  // 8 卡指示光带（与 HGX GPU 对应）
  const leds = [];
  for (let i = 0; i < 8; i++) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.12), mats.glowGreen.clone());
    led.position.set(-8.4 + i * 2.4, 3.1, 7.75);
    led.userData.partId = 'hgxGpu' + i;
    group.add(led);
    leds.push(led);
  }

  // 顶部把手
  for (const x of [-8, 8]) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(3, 0.35, 0.5), mats.lidMat);
    handle.position.set(x, 3.75, 0);
    group.add(handle);
  }

  group.position.set(0, -52, 0);
  return { group, leds };
}

// ------------------------------------------------------------
// GB200 Grace Blackwell Superchip（1 Grace + 2 B200）
// ------------------------------------------------------------
export function buildGB200(mats) {
  const group = new THREE.Group();
  group.name = 'GB200';
  const tray = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 9), mats.pcbMat);
  tray.receiveShadow = tray.castShadow = true;
  tray.userData.partId = 'gb200';
  group.add(tray);

  // 两颗 B200（左右）
  const gpus = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(s * 4.3, 0.25, 0);
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.6, 3.2), mats.lidMat);
    body.castShadow = true;
    body.userData.partId = 'gb200Gpu' + (s < 0 ? 'L' : 'R');
    const dieGlow = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 2.4), mats.dieMatA.clone());
    dieGlow.position.y = 0.36;
    dieGlow.userData.partId = body.userData.partId;
    g.add(body, dieGlow);
    group.add(g);
    gpus.push(g);
  }

  // Grace CPU（较大，纹理不同）
  const cpu = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 3.4), mats.interposerMat);
  cpu.position.set(0, 0.28, -3.0);
  cpu.castShadow = true;
  cpu.userData.partId = 'grace';
  group.add(cpu);
  const cpuDie = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 2.4), mats.logicDieMat);
  cpuDie.position.set(0, 0.6, -3.0);
  cpuDie.userData.partId = 'grace';
  group.add(cpuDie);

  // NVLink-C2C 桥（Grace ↔ GPU）
  for (const s of [-1, 1]) {
    const link = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 3.2), mats.glowCyan.clone());
    link.position.set(s * 2.1, 0.42, -1.3);
    link.material.transparent = true;
    link.material.opacity = 0.55;
    link.userData.partId = 'c2c';
    group.add(link);
  }

  group.position.set(0, -70, 8);
  return { group, gpus };
}

// ------------------------------------------------------------
// GB200 NVL72 机柜（18 计算托盘 + 9 交换托盘，液冷）
// ------------------------------------------------------------
export function buildRack(mats) {
  const group = new THREE.Group();
  group.name = 'NVL72';

  // 框架
  const H = 26, W = 12, D = 11;
  const frameMat = mats.darkMetalMat;
  const posts = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [sx, sz] of posts) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, H, 0.55), frameMat);
    post.position.set(sx * W / 2, H / 2, sz * D / 2);
    post.castShadow = true;
    post.userData.partId = 'rack';
    group.add(post);
  }
  for (const y of [0.4, H - 0.4]) {
    for (const sz of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(W, 0.5, 0.5), frameMat);
      bar.position.set(0, y, sz * D / 2);
      bar.userData.partId = 'rack';
      group.add(bar);
    }
    for (const sx of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, D), frameMat);
      bar.position.set(sx * W / 2, y, 0);
      bar.userData.partId = 'rack';
      group.add(bar);
    }
  }

  // 计算托盘 × 18（每托盘 2 个 superchip = 4 GPU）
  const trays = [];
  for (let i = 0; i < 18; i++) {
    const y = 1.4 + i * 1.35;
    const tray = new THREE.Group();
    tray.position.y = y;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W - 1.2, 1.05, D - 1.6), mats.darkMetalMat);
    slab.castShadow = slab.receiveShadow = true;
    slab.userData.partId = 'computeTray' + i;
    tray.add(slab);
    // 前把手
    const handle = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 0.32), mats.lidMat);
    handle.position.set(0, 0, D / 2 - 0.6);
    handle.userData.partId = 'computeTray' + i;
    tray.add(handle);
    // GPU 发光块 × 4（示意）
    for (let k = 0; k < 4; k++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 1.5), mats.glowCyan.clone());
      g.position.set(-3.4 + k * 2.3, 0.58, 0);
      g.material.transparent = true;
      g.material.opacity = 0.5;
      g.userData.partId = 'computeTray' + i;
      tray.add(g);
    }
    group.add(tray);
    trays.push(tray);
  }

  // 交换托盘 × 9（穿插）
  for (let i = 0; i < 9; i++) {
    const y = 2.2 + i * 2.75;
    const sw = new THREE.Group();
    sw.position.y = y;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W - 1.2, 0.85, D - 1.6), mats.frameMat);
    slab.userData.partId = 'switchTray' + i;
    sw.add(slab);
    const led = new THREE.Mesh(new THREE.BoxGeometry(W - 3, 0.1, 0.2), mats.glowAmber.clone());
    led.position.set(0, 0.2, D / 2 - 0.65);
    led.material.transparent = true;
    led.material.opacity = 0.75;
    sw.add(led);
    group.add(sw);
  }

  // 液冷管（青色透明管）
  for (const s of [-1, 1]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, H - 1.2, 12), mats.glassMat);
    tube.position.set(s * (W / 2 - 1.1), H / 2, -D / 2 + 1.0);
    tube.userData.partId = 'cooling';
    group.add(tube);
    const tube2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, H - 1.2, 10), mats.glassMat);
    tube2.position.set(s * (W / 2 - 0.5), H / 2, -D / 2 + 1.0);
    tube2.userData.partId = 'cooling';
    group.add(tube2);
  }

  // 顶部母线
  const bus = new THREE.Mesh(new THREE.BoxGeometry(W - 2, 0.4, 1.2), mats.goldMat);
  bus.position.set(0, H + 0.2, -D / 2 + 1.4);
  bus.userData.partId = 'rack';
  group.add(bus);

  group.position.set(0, -84, -18);

  // 远景：数个机柜
  const fleet = new THREE.Group();
  fleet.name = 'fleet';
  for (let i = 0; i < 4; i++) {
    const ghost = group.clone(true);
    ghost.position.set((i - 1.5) * 17, -84 + (i % 2) * 0.0, -36 - i * 5);
    ghost.scale.setScalar(0.98);
    ghost.traverse(o => {
      if (o.isMesh && o.material && o.material.clone) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.32;
        o.castShadow = false;
      }
    });
    fleet.add(ghost);
  }

  return { group, trays, fleet };
}

// ------------------------------------------------------------
// 五种产品示意字形（第 07 章平面图形；与三维结构对应）
// 由 SVG 模块调用生成路径数据
// ------------------------------------------------------------
export const PRODUCT_GLYPHS = {
  B200: { w: 120, h: 84, dies: 2, hbm: 8, layers: ['lid', 'dies', 'interposer', 'substrate', 'balls'] },
  HGX: { w: 160, h: 84, gpus: 8, layers: ['board', 'gpus', 'switches'] },
  DGX: { w: 150, h: 110, gpus: 8, layers: ['chassis', 'board', 'front'] },
  GB200: { w: 140, h: 84, cpus: 1, gpus: 2, layers: ['tray', 'grace', 'gpus'] },
  NVL72: { w: 90, h: 170, trays: 27, gpus: 72, layers: ['frame', 'compute', 'switch', 'cooling'] },
};
