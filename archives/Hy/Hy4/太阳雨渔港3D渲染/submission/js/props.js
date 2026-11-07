/* ========================================================================
   props.js — 乐器箱、透明雨伞、鱼箱渔网、绞盘吊杆、浮标网兜、
              贩卖机、滑道舢板、风向袋与旗
   ======================================================================== */
(function () {
'use strict';
const T = window.THREE;
const SR = window.SR;
const tx = SR.tex;

/* 银灰乐器硬箱 */
function instrumentCase(parent, x, z, rot, w) {
  const grp = new T.Group();
  grp.position.set(x, 0, z);
  grp.rotation.y = rot || 0;
  parent.add(grp);
  const h = 0.26, d = 0.38;
  const body = SR.M.toon(0xaeb9b8);
  SR.box(grp, w || 0.92, h, d, body, [0, h / 2 + 0.02, 0], null, 24);
  /* 边缘铝条 */
  SR.box(grp, w + 0.02, 0.025, 0.025, SR.M.toon(0xd7dedb), [0, h + 0.03, d / 2], null, false);
  SR.box(grp, w + 0.02, 0.025, 0.025, SR.M.toon(0xd7dedb), [0, 0.02, d / 2], null, false);
  for (const s of [-1, 1]) {
    SR.box(grp, 0.025, h, 0.025, SR.M.toon(0xd7dedb), [s * (w / 2), h / 2 + 0.02, d / 2], null, false);
    /* 包角 */
    SR.box(grp, 0.07, 0.07, 0.07, SR.M.toon(0x8d9b99), [s * (w / 2 - 0.02), h + 0.02, d / 2 - 0.01], null, false);
  }
  /* 锁扣 */
  for (const s of [-1, 1]) SR.box(grp, 0.06, 0.07, 0.03, SR.M.toon(SR.C.metal), [s * 0.24, h + 0.02, d / 2 + 0.012], null, false);
  /* 提手 */
  SR.add(grp, SR.G.torus(0.075, 0.016, 5, 10, SR.PI), SR.M.toon(0x5d6b69), [0, h + 0.02, d / 2 + 0.01], [0, 0, 0], false);
  /* 贴纸 */
  const st = new T.Mesh(SR.G.plane(0.16, 0.09), SR.M.basic(0xffffff, {
    map: tx.label('FRAGILE', '#e8e2cf', '#5a6d68', 26), transparent: true, side: T.DoubleSide,
  }));
  st.position.set(-0.24, 0.16, d / 2 + 0.014); grp.add(st);
  return grp;
}

/* 透明雨伞（斜靠） */
function umbrella(parent, x, z) {
  const grp = new T.Group();
  grp.position.set(x, 0, z);
  grp.rotation.z = 0.30;
  grp.rotation.y = -0.35;
  parent.add(grp);
  /* 伞柄 */
  SR.cyl(grp, 0.016, 0.018, 1.32, SR.M.toon(SR.C.ironLight), [0, 0.66, 0], null, 8, false);
  SR.add(grp, SR.G.torus(0.09, 0.018, 6, 12, SR.PI), SR.M.toon(SR.C.woodDark), [0, 0.06, 0], [0, SR.PI / 2, 0], false);
  /* 伞面：透明浅青 */
  const canopyMat = SR.M.basic(0xdff2ec, {
    transparent: true, opacity: 0.26, side: T.DoubleSide, depthWrite: false,
  });
  const canopy = SR.add(grp, SR.G.cone(0.68, 0.34, 16, 1, true), canopyMat, [0, 1.30, 0], null, false);
  canopy.renderOrder = 14;
  /* 伞骨（细线由中心到边缘） */
  const ribMat = new T.LineBasicMaterial({ color: 0x7d9893, transparent: true, opacity: 0.65 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * SR.TAU;
    SR.line(grp, [[0, 1.47, 0], [Math.cos(a) * 0.68, 1.13, Math.sin(a) * 0.68]], ribMat);
  }
  /* 伞沿环 */
  SR.add(grp, SR.G.torus(0.68, 0.008, 5, 24), SR.M.toon(0x9fb6ae), [0, 1.13, 0], [SR.PI / 2, 0, 0], false);
  /* 伞顶帽 */
  SR.cyl(grp, 0.018, 0.018, 0.10, SR.M.toon(SR.C.ironLight), [0, 1.50, 0], null, 6, false);
  /* 伞面雨珠 */
  const beadMat = SR.M.basic(0xfff0c0, { transparent: true, opacity: 0.85 });
  const beads = [];
  for (let i = 0; i < 26; i++) {
    const a = SR.rand() * SR.TAU, r = SR.rnd(0.12, 0.64);
    const y = 1.47 - (r / 0.68) * 0.34;
    const b = SR.add(grp, SR.G.sph(SR.rnd(0.010, 0.024), 6, 5), beadMat,
      [Math.cos(a) * r, y + 0.005, Math.sin(a) * r], null, false);
    beads.push(b);
  }
  SR.obj.umbrella = { g: grp, beads: beads, x: x, z: z };
  return grp;
}

/* 晒网铁架 + 渔网 */
function netRack(parent, x, z, rot) {
  const grp = new T.Group();
  grp.position.set(x, 0, z);
  grp.rotation.y = rot || 0;
  parent.add(grp);
  const iron = SR.M.toon(0x8a9a91);
  for (const s of [-1, 1]) {
    SR.cyl(grp, 0.032, 0.042, 1.65, iron, [s * 1.15, 0.82, 0], null, 8, false);
    SR.cyl(grp, 0.032, 0.042, 1.65, iron, [s * 1.15, 0.82, 1.05], null, 8, false);
    SR.box(grp, 2.35, 0.035, 0.035, iron, [0, 1.63, s > 0 ? 1.05 : 0], null, false);
  }
  SR.box(grp, 0.035, 0.035, 1.10, iron, [-1.15, 1.63, 0.52], null, false);
  SR.box(grp, 0.035, 0.035, 1.10, iron, [1.15, 1.63, 0.52], null, false);
  /* 渔网：横竖线组成的网片 */
  const netMat = new T.LineBasicMaterial({ color: 0x8ba89c, transparent: true, opacity: 0.62 });
  const pts = [];
  const W = 2.2, H = 1.35, nx = 15, ny = 10;
  for (let i = 0; i <= nx; i++) {
    const px = -W / 2 + i * W / nx;
    pts.push([px, 1.60, 0.02], [px, 1.60 - H, 0.02]);
  }
  for (let j = 0; j <= ny; j++) {
    const py = 1.60 - j * H / ny;
    pts.push([-W / 2, py, 0.02], [W / 2, py, 0.02]);
  }
  const geo = new T.BufferGeometry().setFromPoints(pts.map(p => new T.Vector3(p[0], p[1], p[2])));
  const net = new T.LineSegments(geo, netMat);
  grp.add(net);
  SR.obj.nets.push({ m: net, z: z, ph: SR.rnd(0, 10) });
  /* 网脚坠子 */
  for (let i = 0; i < 8; i++) {
    SR.sph(grp, 0.025, SR.M.toon(0x6e8a80), [-W / 2 + i * W / 7, 1.60 - H, 0.02], null, false);
  }
  /* 缀满浮球的绳串（沿铁架上方挂） */
  const floats = [];
  const ropePts = [[-1.15, 1.70, 0], [0, 1.52, 0.05], [1.15, 1.70, 0.10]];
  SR.tube(grp, ropePts, 0.014, SR.M.toon(SR.C.rope), 20, 5);
  for (let i = 0; i < 9; i++) {
    const p = i / 8;
    const fx = SR.lerp(-1.15, 1.15, p);
    const fy = 1.70 - Math.sin(p * SR.PI) * 0.18;
    const col = SR.pick([SR.C.buoyO, SR.C.buoyW, SR.C.hazardY, SR.C.plasticB, 0xd98c5a]);
    const f = SR.add(grp, SR.G.sph(0.085, 10, 8), SR.M.toon(col), [fx, fy - 0.11, 0.03], null, false);
    floats.push(f);
  }
  SR.obj.floats.push({ items: floats, z: z, ph: SR.rnd(0, 10) });
  return grp;
}

/* 锈迹手摇绞盘 + 小型吊杆 */
function winch(parent, x, z) {
  const grp = new T.Group();
  grp.position.set(x, 0, z);
  parent.add(grp);
  const rustMat = SR.M.toon(0xffffff, { map: tx.rust('#9aa8a0') });
  const iron = SR.M.toon(SR.C.iron);
  SR.box(grp, 0.72, 0.14, 0.60, SR.M.toon(SR.C.concreteDim), [0, 0.07, 0], null, false);
  for (const s of [-1, 1]) SR.box(grp, 0.10, 0.44, 0.10, rustMat, [s * 0.28, 0.30, 0], null, false);
  const drum = SR.cyl(grp, 0.17, 0.17, 0.56, rustMat, [0, 0.46, 0], [0, 0, SR.PI / 2], 14, false);
  /* 卷绕的缆绳 */
  for (let i = 0; i < 7; i++) {
    SR.add(grp, SR.G.torus(0.175, 0.018, 5, 12), SR.M.toon(SR.C.ropeWet),
      [-0.24 + i * 0.08, 0.46, 0], [0, SR.PI / 2, 0], false);
  }
  /* 齿轮 */
  SR.add(grp, SR.G.cyl(0.22, 0.22, 0.035, 12), rustMat, [0.33, 0.46, 0], [0, 0, SR.PI / 2], false);
  /* 曲柄 */
  SR.cyl(grp, 0.022, 0.022, 0.30, iron, [0.36, 0.50, 0], [0, 0, SR.PI / 2], 6, false);
  SR.cyl(grp, 0.02, 0.02, 0.16, SR.M.toon(SR.C.woodDark), [0.52, 0.50, 0.12], [SR.PI / 2, 0, 0], 6, false);
  /* 小型吊杆 */
  SR.cyl(grp, 0.045, 0.06, 2.05, rustMat, [-0.15, 1.02, -0.18], null, 8, false);
  SR.cyl(grp, 0.032, 0.032, 1.25, rustMat, [0.25, 1.85, -0.18], [0, 0, -0.95], 8, false);
  SR.tube(grp, [[-0.15, 1.75, -0.18], [-0.15, 2.05, -0.18], [0.42, 2.02, -0.18]], 0.012, iron, 12, 5);
  /* 滑轮与吊钩 */
  SR.add(grp, SR.G.torus(0.075, 0.018, 6, 12), iron, [0.94, 1.56, -0.18], [SR.PI / 2, 0, 0], false);
  SR.tube(grp, [[0.94, 1.50, -0.18], [0.94, 1.10, -0.18]], 0.010, SR.M.toon(SR.C.ropeWet), 8, 5);
  SR.add(grp, SR.G.torus(0.055, 0.015, 6, 12, SR.PI * 1.4), iron, [0.94, 1.04, -0.18], [0, 0, 0], false);
  return grp;
}

/* 褪色编号系船浮标（浮在水面） */
function mooringBuoy(parent, x, z, n) {
  const grp = new T.Group();
  grp.position.set(x, 0.02, z);
  parent.add(grp);
  const body = SR.M.toon(0xffffff, { map: tx.rust('#e8d08a') });
  SR.add(grp, SR.G.sph(0.22, 12, 10), body, [0, 0.10, 0], null, false).scale.set(1, 0.85, 1);
  SR.add(grp, SR.G.torus(0.225, 0.025, 6, 16), SR.M.toon(SR.C.ropeWet), [0, 0.12, 0], [SR.PI / 2, 0, 0], false);
  SR.cyl(grp, 0.02, 0.02, 0.22, SR.M.toon(SR.C.iron), [0, 0.32, 0], null, 6, false);
  const num = new T.Mesh(SR.G.plane(0.20, 0.10), SR.M.basic(0xffffff, { map: tx.buoyNumber(n), side: T.DoubleSide }));
  num.position.set(0, 0.14, 0.221);
  grp.add(num);
  /* 系绳垂入水 */
  SR.tube(grp, [[0, 0.02, 0], [0.08, -0.16, 0.06], [0.12, -0.40, 0.10]], 0.014, SR.M.toon(SR.C.ropeWet), 10, 5);
  SR.obj.buoys.push({ g: grp, ph: SR.rnd(0, 10), x: x, z: z });
  return grp;
}

/* 长柄网兜 + 水桶 */
function netAndBucket(parent, x, z, rot) {
  const grp = new T.Group();
  grp.position.set(x, 0, z);
  grp.rotation.y = rot || 0;
  parent.add(grp);
  /* 长柄网兜斜靠墙 */
  const pole = SR.cyl(grp, 0.018, 0.022, 1.75, SR.M.toon(SR.C.woodPale), [0.18, 0.88, 0], [0, 0, -0.24], 8, false);
  SR.add(grp, SR.G.torus(0.18, 0.018, 6, 16), SR.M.toon(SR.C.metal), [0.18 - Math.sin(-0.24) * 1.75 * 0, 1.72, 0], [SR.PI / 2, 0, 0], false);
  SR.line(grp, [[0.0, 1.72, 0], [0.36, 1.72, 0], [0.18, 1.42, 0], [0.0, 1.72, 0]], new T.LineBasicMaterial({ color: 0x8ba89c }));
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * SR.TAU;
    SR.line(grp, [[0.18 + Math.cos(a) * 0.18, 1.72, Math.sin(a) * 0.18], [0.18, 1.38, 0]],
      new T.LineBasicMaterial({ color: 0x9ab3a6, transparent: true, opacity: 0.6 }));
  }
  /* 水桶 */
  SR.cyl(grp, 0.20, 0.16, 0.32, SR.M.toon(SR.C.plasticB), [-0.15, 0.16, 0.15], null, 14, 20);
  SR.add(grp, SR.G.torus(0.20, 0.018, 6, 16), SR.M.toon(0x356a8e), [-0.15, 0.32, 0.15], [SR.PI / 2, 0, 0], false);
  SR.add(grp, SR.G.torus(0.17, 0.012, 5, 14, SR.PI), SR.M.toon(SR.C.metal), [-0.15, 0.34, 0.15], [0, 0, 0], false);
  return grp;
}

/* 自动贩卖机 */
function vendingMachine(parent, x, z, rot) {
  const grp = new T.Group();
  grp.position.set(x, 0, z);
  grp.rotation.y = rot || 0;
  parent.add(grp);
  const bodyMat = SR.M.toon(0xffffff, { map: tx.rust('#dfe6dc') });
  SR.box(grp, 0.86, 1.72, 0.66, bodyMat, [0, 0.86, 0], null, 24);
  /* 灯箱（微亮） */
  const panel = new T.Mesh(SR.G.plane(0.74, 1.44), SR.M.basic(0xffffff, { map: tx.vending(), side: T.DoubleSide }));
  panel.position.set(0, 0.92, 0.336);
  grp.add(panel);
  SR.box(grp, 0.78, 1.48, 0.02, SR.M.toon(0x8d9b95), [0, 0.92, 0.328], null, false);
  const panel2 = new T.Mesh(SR.G.plane(0.72, 1.42), SR.M.basic(0xffffff, { map: tx.vending(), side: T.DoubleSide }));
  panel2.position.set(0, 0.92, 0.342);
  grp.add(panel2);
  SR.obj.interiorLights.push({ m: panel2, ph: 1.2, kind: 'vending' });
  /* 灯箱外框发光边 */
  SR.box(grp, 0.80, 0.03, 0.03, SR.M.basic(0xfff0c0), [0, 1.67, 0.35], null, false);
  /* 锈蚀遮雨檐 */
  SR.box(grp, 1.12, 0.06, 0.86, SR.M.toon(0xffffff, { map: tx.rust('#a2ada4') }), [0, 1.80, 0], null, false);
  for (const s of [-1, 1]) SR.box(grp, 0.04, 0.20, 0.04, SR.M.toon(0x8b9a93), [s * 0.48, 1.70, 0.32], null, false);
  /* 取货口 */
  SR.box(grp, 0.56, 0.20, 0.03, SR.M.toon(0x4a5a58), [0, 0.16, 0.345], null, false);
  return grp;
}

/* 斜坡滑道 + 倒扣小木舢板 */
function slipway(parent, x, z) {
  const grp = new T.Group();
  grp.position.set(x, 0, z);
  parent.add(grp);
  /* 斜坡（向 +x 下降入水） */
  const slope = SR.box(grp, 2.0, 0.10, 1.15, SR.M.toon(SR.C.concreteDim), [0.95, -0.30, 0], [0, 0, -0.28], 20);
  for (let i = 0; i < 7; i++) {
    SR.box(grp, 0.03, 0.02, 1.12, SR.M.toon(SR.C.concreteLit), [0.15 + i * 0.26, -0.30 + (0.15 + i * 0.26) * 0.28 + 0.055, 0],
      [0, 0, -0.28], false);
  }
  /* 两侧挡边 */
  for (const s of [-1, 1]) SR.box(grp, 2.0, 0.10, 0.06, SR.M.toon(SR.C.concrete), [0.95, -0.24, s * 0.58], [0, 0, -0.28], false);
  /* 倒扣的小木舢板：空心半球壳架在垫木上，壳下留出港猫避雨的空隙 */
  const boat = new T.Group();
  boat.position.set(0.55, 0.34, 0.0);
  boat.rotation.set(0.06, 0.12, 0.10);
  grp.add(boat);
  const wood = SR.M.toon(0xffffff, { map: tx.tiled(tx.wood('#b98d60'), 1, 1), side: T.DoubleSide });
  /* 开口朝下的半球壳 */
  const shell = SR.add(boat, new T.SphereGeometry(0.62, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    wood, [0, 0, 0], null, false);
  shell.scale.set(1.75, 0.62, 0.72);
  /* 船舷一圈边条 */
  SR.add(boat, SR.G.torus(0.60, 0.035, 6, 22), SR.M.toon(SR.C.woodDark),
    [0, 0, 0], [SR.PI / 2, 0, 0], false).scale.set(1.75, 0.72, 1);
  /* 壳顶板缝 */
  for (let i = -2; i <= 2; i++) {
    SR.box(boat, 0.028, 0.018, 0.80, SR.M.toon(SR.C.woodDark), [i * 0.30, 0.30, 0], null, false);
  }
  /* 壳内座板 */
  SR.box(boat, 0.10, 0.035, 0.78, SR.M.toon(SR.C.woodPale), [0, -0.10, 0], null, false);
  /* 两块垫木把舢板架起 */
  for (const s of [-1, 1]) {
    SR.box(grp, 0.13, 0.28, 0.15, SR.M.toon(SR.C.woodDark),
      [0.55 + s * 0.72, 0.14, s * 0.18], null, false);
  }
  /* 一支木桨斜靠 */
  SR.cyl(boat, 0.018, 0.018, 1.30, SR.M.toon(SR.C.woodPale), [0.40, -0.18, 0.78], [0.2, 0.4, 0.5], 6, false);
  SR.box(boat, 0.13, 0.02, 0.28, SR.M.toon(SR.C.woodPale), [0.72, -0.26, 0.94], [0.2, 0.4, 0.5], false);
  SR.obj.sampan = { g: boat, x: x + 0.55, z: z };
  return grp;
}

/* 风向袋与小旗 */
function windSock(parent, x, z, h) {
  const grp = new T.Group();
  grp.position.set(x, 0, z);
  parent.add(grp);
  SR.cyl(grp, 0.030, 0.045, h, SR.M.toon(SR.C.ironLight), [0, h / 2, 0], null, 8, false);
  SR.add(grp, SR.G.torus(0.18, 0.016, 6, 14), SR.M.toon(SR.C.iron), [0, h - 0.03, 0], [SR.PI / 2, 0, 0], false);
  /* 风向袋：几段锥筒，红白相间 */
  const sock = new T.Group();
  sock.position.set(0, h - 0.03, 0);
  grp.add(sock);
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const r0 = 0.17 - i * 0.026, r1 = 0.17 - (i + 1) * 0.026;
    const seg = SR.add(sock, SR.G.cyl(r1, r0, 0.20, 10, true),
      SR.M.toon(i % 2 === 0 ? 0xe07a5a : 0xf0ece0, { side: T.DoubleSide }),
      [0.20 * i + 0.10, 0, 0], [0, 0, -SR.PI / 2], false);
  }
  SR.obj.flags.push({ m: sock, z: z, x: x, ph: SR.rnd(0, 10), amp: 0.30, kind: 'sock' });
  return grp;
}

function smallFlag(parent, x, z, h, rot) {
  const grp = new T.Group();
  grp.position.set(x, 0, z);
  grp.rotation.y = rot || 0;
  parent.add(grp);
  SR.cyl(grp, 0.016, 0.022, h, SR.M.toon(0x8d9b94), [0, h / 2, 0], null, 6, false);
  const f = SR.add(grp, SR.G.plane(0.42, 0.26), SR.M.toon(0xffffff, { map: tx.flag(), side: T.DoubleSide }),
    [0.21, h - 0.18, 0], [0, 0, 0], false);
  SR.obj.flags.push({ m: f, z: z, x: x, ph: SR.rnd(0, 10), amp: 0.26, kind: 'flag' });
  return grp;
}

SR.build.props = function () {
  const g = SR.group('props');

  /* 乐器硬箱两只（并排） */
  instrumentCase(g, -0.55, 5.75, 0.06, 0.96);
  instrumentCase(g, -0.42, 5.22, -0.05, 0.86);
  /* 透明雨伞斜靠台阶边 */
  umbrella(g, 1.15, 3.55);

  /* 堤岸上叠放的白色鱼箱与蓝色周转筐 */
  function crate(parent3, x, y, z, w, h, d, blue, rot) {
    const grp = new T.Group(); grp.position.set(x, y, z); grp.rotation.y = rot || 0; parent3.add(grp);
    SR.box(grp, w, h, d, SR.M.toon(blue ? SR.C.plasticB : SR.C.plasticW), [0, h / 2, 0], null, 24);
    SR.box(grp, w + 0.02, 0.03, d + 0.02, SR.M.toon(blue ? 0x6aa2c4 : 0xdfe8e0), [0, h, 0], null, false);
    for (let i = 0; i < 2; i++) SR.box(grp, w + 0.004, 0.016, 0.018, SR.M.toon(blue ? 0x35709a : 0xc7d3ca), [0, h * (0.35 + i * 0.3), d / 2 + 0.004], null, false);
    return grp;
  }
  for (let i = 0; i < 4; i++) crate(g, 3.10, 0.01 + i * 0.20, -3.55, 0.66, 0.19, 0.46, i === 3, i * 0.05);
  for (let i = 0; i < 3; i++) crate(g, 3.85, 0.01 + i * 0.19, -3.75, 0.58, 0.18, 0.42, true, -0.1 + i * 0.06);
  for (let i = 0; i < 3; i++) crate(g, -3.9, 0.01 + i * 0.20, 8.6, 0.64, 0.19, 0.46, false, i * 0.04);
  crate(g, 6.7, 0.01, -3.5, 0.66, 0.19, 0.46, false, 0.2);
  crate(g, 6.7, 0.21, -3.5, 0.60, 0.18, 0.42, true, 0.24);

  /* 晒网铁架与浮球绳串 */
  netRack(g, 5.0, -4.15, 0.06);
  netRack(g, -2.6, 9.4, -0.25);

  /* 绞盘与吊杆 */
  winch(g, 7.35, -3.55);

  /* 系船浮标（浮在水面） */
  mooringBuoy(g, 3.55, 1.75, 12);
  mooringBuoy(g, 5.55, 1.85, 7);
  mooringBuoy(g, 8.65, 3.15, 3);
  mooringBuoy(g, 9.0, -1.0, 21);

  /* 长柄网兜与水桶（靠仓库墙） */
  netAndBucket(g, -4.65, 6.15, 0.15);
  netAndBucket(g, -4.7, 5.2, -0.1);

  /* 自动贩卖机（靠仓库墙，灯箱微亮；避开卷帘门视线） */
  vendingMachine(g, -4.45, 9.35, SR.PI / 2);
  /* 贩卖机遮雨檐下的阴影 */
  SR.shadowBlob(g, -4.45, 9.35, 1.5, 1.3, 0.18);

  /* 斜坡滑道 + 倒扣舢板（半拖上岸） */
  slipway(g, 2.05, 2.95);

  /* 风向袋与小旗 */
  windSock(g, 8.0, -4.35, 2.05);
  smallFlag(g, 6.2, -2.65, 1.35, 0.3);
  smallFlag(g, -1.0, 2.45, 1.15, -0.2);
  smallFlag(g, 8.9, 5.4, 1.05, 0.5);

  /* 乐器箱与舢板阴影 */
  SR.shadowBlob(g, -0.5, 5.5, 1.9, 1.2, 0.16);
  SR.shadowBlob(g, 2.6, 2.95, 2.2, 1.3, 0.18);
};

})();
