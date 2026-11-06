// 系统级模型：HGX B200 八 GPU 基板、DGX B200 整机、GB200 超级芯片、计算/交换托盘、GB200 NVL72 机柜与成排机柜。
// 两条产品线的部件不混用：HGX/DGX = 八 B200 + 2 NVSwitch + x86；GB200 = 1 Grace + 2 B200；NVL72 = 18 计算托盘 + 9 交换托盘。
import * as THREE from 'three';
import { Batch, meshOf, instances, addGlowAttr, unitBox, unitBoxBev, unitCyl, canvasTex } from '../gfx/kit.js';
import { rng, lerp, clamp } from '../core/util.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

// 精简版 B200：结构与完整模型一致（基板、加固环、中介层、双晶粒、8 HBM），用实例化绘制多颗
export function liteGPUs(M, list) {
  const g = new THREE.Group();
  const subs = [], rings = [], ips = [], dies = [], hbms = [], caps = [];
  list.forEach(({ x, y, z, s = 1 }) => {
    subs.push({ x, y: y + 1.6 * s, z, sx: 92 * s, sy: 2.2 * s, sz: 84 * s });
    for (const [a, b, c, d] of [[-45, -35, -41, 41], [35, 45, -41, 41], [-35, 35, -41, -31], [-35, 35, 31, 41]]) {
      rings.push({ x: x + (a + b) / 2 * s, y: y + 3.5 * s, z: z + (c + d) / 2 * s, sx: (b - a) * s, sy: 1.45 * s, sz: (d - c) * s });
    }
    ips.push({ x, y: y + 3.25 * s, z, sx: 60 * s, sy: .6 * s, sz: 52.4 * s });
    dies.push({ x, y: y + 4.05 * s, z: z - 12.43 * s, sx: 34 * s, sy: .85 * s, sz: 24.5 * s }, { x, y: y + 4.05 * s, z: z + 12.43 * s, sx: 34 * s, sy: .85 * s, sz: 24.5 * s });
    for (const sx of [-23.4, 23.4]) for (const sz of [-18.6, -6.2, 6.2, 18.6]) hbms.push({ x: x + sx * s, y: y + 4.05 * s, z: z + sz * s, sx: 11 * s, sy: .85 * s, sz: 11.8 * s });
    for (let k = -29; k <= 29; k += 4) { caps.push({ x: x + k * s, y: y + 3.2 * s, z: z + 28 * s, sx: 1.6 * s, sy: .9 * s, sz: 1.2 * s }, { x: x + k * s, y: y + 3.2 * s, z: z - 28 * s, sx: 1.6 * s, sy: .9 * s, sz: 1.2 * s }); }
  });
  const die = instances(unitBoxBev, M.gpuGlow, dies); addGlowAttr(die);
  const hbm = instances(unitBoxBev, M.hbmGlow, hbms); addGlowAttr(hbm);
  g.add(instances(unitBoxBev, M.mask, subs), instances(unitBox, M.steel, rings), instances(unitBox, M.interposer, ips), die, hbm, instances(unitBox, M.capBody, caps));
  return {
    group: g, die, hbm, count: list.length,
    glowDie(i, r, gr, b, a) { for (const k of [i * 2, i * 2 + 1]) die.glow.setXYZW(k, r, gr, b, a); die.glow.needsUpdate = true; },
    glowHbm(i, r, gr, b, a) { for (let k = 0; k < 8; k++) hbm.glow.setXYZW(i * 8 + k, r, gr, b, a); hbm.glow.needsUpdate = true; },
  };
}

// ==================== HGX B200 基板 ====================
export function buildHGX(M) {
  const group = new THREE.Group();
  const W = 460, D = 560; // 基板尺寸（示意，比例取自公开照片）
  const gpuXZ = [];
  for (const z of [-140, 140]) for (const x of [-165, -55, 55, 165]) gpuXZ.push([x, z]);
  const swXZ = [[-70, 0], [70, 0]];
  const R = rng(5);

  const b = new Batch();
  b.box(-W / 2, W / 2, -6, -1, -D / 2, D / 2, .4);
  group.add(meshOf(b, M.pcb));

  // SXM 子卡
  const sx = new Batch(), caps = [], ind = [], cyl = [];
  gpuXZ.forEach(([x, z]) => {
    sx.box(x - 51, x + 51, -1, 0, z - 62, z + 62, .3);
    for (let k = 0; k < 18; k++) {
      const a = -46 + k * 5.4;
      ind.push({ x: x + a, y: 2.6, z: z - 54, sx: 4.2, sy: 5.2, sz: 5.0 }, { x: x + a, y: 2.6, z: z + 54, sx: 4.2, sy: 5.2, sz: 5.0 });
      cyl.push({ x: x + a, y: 1.8, z: z - 48.5, sx: 3, sy: 3.6, sz: 3 }, { x: x + a, y: 1.8, z: z + 48.5, sx: 3, sy: 3.6, sz: 3 });
    }
  });
  group.add(meshOf(sx, M.pcb));
  group.add(instances(unitBoxBev, M.plasticMid, ind), instances(unitCyl, M.aluminum, cyl));

  // 精简 GPU（第 0 颗在需要时由完整模型替代）
  const list = gpuXZ.map(([x, z]) => ({ x, y: 0, z }));
  const lite = liteGPUs(M, list);
  group.add(lite.group);

  // NVSwitch：两颗
  const swPkg = [], swDie = [];
  swXZ.forEach(([x, z]) => {
    swPkg.push({ x, y: 1.2, z, sx: 62, sy: 2.4, sz: 62 });
    swDie.push({ x, y: 3.1, z, sx: 30, sy: 1.5, sz: 30 });
    for (let a = 0; a < 16; a++) caps.push({ x: x - 28 + a * 3.8, y: .8, z: z + 34, sx: 2.2, sy: 1.6, sz: 1.4 }, { x: x - 28 + a * 3.8, y: .8, z: z - 34, sx: 2.2, sy: 1.6, sz: 1.4 });
  });
  group.add(instances(unitBoxBev, M.mask, swPkg));
  const sw = instances(unitBoxBev, M.swGlow, swDie); addGlowAttr(sw);
  group.add(sw);
  group.add(instances(unitBox, M.capBody, caps));

  // 板上 NVLink 走线：每颗 GPU 到两颗交换芯片，各 9 路（成束）
  const seg = [];
  const links = [];
  const addSeg = (ax, az, bx, bz, w) => {
    const l = Math.hypot(bx - ax, bz - az);
    if (l < .1) return;
    seg.push({ x: (ax + bx) / 2, y: -.7, z: (az + bz) / 2, sx: l, sy: .4, sz: w, ry: -Math.atan2(bz - az, bx - ax) });
  };
  gpuXZ.forEach(([x, z], gi) => {
    swXZ.forEach(([sx0, sz0], si) => {
      const dirZ = -Math.sign(z);
      const pts = [];
      const ox = (si === 0 ? -14 : 14);
      const startZ = z + dirZ * 42, mid = lerp(z, 0, .55) + (si === 0 ? -8 : 8) * Math.sign(z);
      const endX = sx0 + Math.sign(x - sx0 || 1) * 26, endZ = sz0 + Math.sign(z) * 30;
      pts.push([x + ox, 1, startZ], [x + ox, -.4, mid], [endX, -.4, mid], [endX, 1, endZ], [sx0, 3.8, sz0 + Math.sign(z) * 12]);
      links.push({ gi, si, pts });
      for (let k = -4; k <= 4; k++) {
        const o = k * 1.6;
        addSeg(x + ox + o, startZ, x + ox + o, mid + o * Math.sign(z), .9);
        addSeg(x + ox + o, mid + o * Math.sign(z), endX + o, mid + o * Math.sign(z), .9);
        addSeg(endX + o, mid + o * Math.sign(z), endX + o, endZ, .9);
      }
    });
  });
  group.add(instances(unitBox, M.copper, seg, { cast: false }));

  // 周边：连接器、电源汇流排、重定时器
  const c = new Batch(), bus = new Batch();
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < 6; i++) c.box(-W / 2 + 26 + i * 72, -W / 2 + 86 + i * 72, 0, 11, sgn * (D / 2 - 18), sgn * (D / 2 - 4), .5);
    bus.box(-W / 2 + 10, W / 2 - 10, 0, 3, sgn * 66, sgn * 76, .3);
  }
  group.add(meshOf(c, M.plastic), meshOf(bus, M.copperPlate));
  const small = [];
  for (let i = 0; i < 90; i++) small.push({ x: (R() - .5) * (W - 30), y: .8, z: (R() < .5 ? -1 : 1) * (32 + R() * 28), sx: 3 + R() * 7, sy: 1.6, sz: 3 + R() * 7 });
  group.add(instances(unitBoxBev, M.plasticMid, small));

  // 散热器：放下即为整机形态
  const fin = new Batch();
  fin.box(-48, 48, 0, 3, -58, 58, .4);
  for (let k = -23; k <= 23; k++) fin.box(k * 2, k * 2 + .7, 3, 62, -56, 56, .08);
  const finGeo = fin.build();
  const fins = [];
  gpuXZ.forEach(([x, z], i) => {
    const m = new THREE.Mesh(finGeo, M.aluminum);
    m.position.set(x, 5.4, z);
    m.castShadow = m.receiveShadow = true;
    m.visible = false;
    group.add(m);
    fins.push(m);
  });

  const hgx = {
    group, lite, sw, W, D, gpuXZ, swXZ, links, fins,
    setSink(a) { // a=0 全部抬走，a=1 落到位
      fins.forEach((m, i) => {
        const t = clamp(a * 1.6 - i * .05);
        m.visible = a > .001;
        m.position.y = 5.4 + (1 - t) * (1 - t) * 520;
      });
    },
    gpuWorld(i, out = new THREE.Vector3()) { const [x, z] = gpuXZ[i]; return group.localToWorld(out.set(x, 4.5, z)); },
    swWorld(i, out = new THREE.Vector3()) { const [x, z] = swXZ[i]; return group.localToWorld(out.set(x, 4, z)); },
    glowSw(i, r, g, bb, a) { sw.glow.setXYZW(i, r, g, bb, a); sw.glow.needsUpdate = true; },
    // 第 0 颗由完整模型代替时，把精简版缩到零
    setSlot0Hidden(hide) {
      if (this._slot0 === hide) return;
      this._slot0 = hide;
      const meshes = lite.group.children;
      const S0 = hide ? 1e-5 : 1;
      const counts = [1, 4, 1, 2, 8, 30];
      meshes.forEach((m, mi) => {
        if (!this._m0) this._m0 = [];
        if (!this._m0[mi]) { this._m0[mi] = []; for (let k = 0; k < counts[mi]; k++) { const q = new THREE.Matrix4(); m.getMatrixAt(k, q); this._m0[mi][k] = q; } }
        for (let k = 0; k < counts[mi]; k++) {
          const q = this._m0[mi][k].clone();
          if (hide) q.makeScale(S0, S0, S0);
          m.setMatrixAt(k, q);
        }
        m.instanceMatrix.needsUpdate = true;
      });
    },
    linkWorld(gi, si) {
      const L = links.find(l => l.gi === gi && l.si === si);
      return L.pts.map(p => { const v = group.localToWorld(new THREE.Vector3(p[0], p[1], p[2])); return [v.x, v.y, v.z]; });
    },
  };
  return hgx;
}

// ==================== DGX B200 整机 ====================
export function buildDGX(M) {
  const group = new THREE.Group();
  const W = 482, H = 444, D = 897;
  const wall = new Batch();
  wall.box(-W / 2, W / 2, -24, -18, -D / 2, D / 2, 1);          // 底板
  wall.box(-W / 2, -W / 2 + 5, -24, H - 24, -D / 2, D / 2, 1);
  wall.box(W / 2 - 5, W / 2, -24, H - 24, -D / 2, D / 2, 1);
  group.add(meshOf(wall, M.chassis));

  // 风扇墙（前部）
  const fan = new Batch(), hubs = [];
  const fanY = [50, 150, 250];
  const fanN = 4;
  const fanZ = D / 2 - 52;
  for (const y of fanY) for (let i = 0; i < fanN; i++) {
    const x = (i - (fanN - 1) / 2) * 112;
    fan.box(x - 52, x + 52, y - 48, y + 48, fanZ - 26, fanZ - 20, 1);
    fan.box(x - 52, x + 52, y - 48, y + 48, fanZ + 20, fanZ + 26, 1);
    fan.box(x - 52, x - 48, y - 48, y + 48, fanZ - 26, fanZ + 26, 1);
    fan.box(x + 48, x + 52, y - 48, y + 48, fanZ - 26, fanZ + 26, 1);
    hubs.push({ x, y, z: fanZ, sx: 28, sz: 46, sy: 28, rx: Math.PI / 2 });
    for (let b = 0; b < 7; b++) {
      const a = b / 7 * Math.PI * 2;
      fan.cylAxis([x + Math.cos(a) * 12, y + Math.sin(a) * 12, fanZ], [x + Math.cos(a + .3) * 44, y + Math.sin(a + .3) * 44, fanZ + 2], 3.4, 4);
    }
  }
  group.add(meshOf(fan, M.plasticMid), instances(unitCyl, M.plastic, hubs));

  // 前面板：格栅 + 把手 + 硬盘
  const face = new Batch();
  face.box(-W / 2, W / 2, 300, H - 24, D / 2 - 8, D / 2, 1);
  for (let y = -10; y < 296; y += 12) face.box(-W / 2 + 12, W / 2 - 12, y, y + 5, D / 2 - 3, D / 2 + 1, .6);
  group.add(meshOf(face, M.chassisDark));
  const front = new Batch();
  for (let i = 0; i < 8; i++) front.box(-200 + i * 50, -200 + i * 50 + 42, 330, 390, D / 2, D / 2 + 3, .8);
  group.add(meshOf(front, M.aluminum));

  // 后部：6 个电源、网卡
  const psu = new Batch();
  for (let i = 0; i < 6; i++) {
    const x = -W / 2 + 40 + i * 78;
    psu.box(x, x + 72, -10, 74, -D / 2, -D / 2 + 240, 1.2);
    psu.box(x + 6, x + 66, 8, 66, -D / 2 - 1, -D / 2 + 2, .6);
  }
  group.add(meshOf(psu, M.chassisDark));

  // CPU 托盘：可抬起
  const tray = new THREE.Group();
  group.add(tray);
  const pcb = new Batch();
  pcb.box(-W / 2 + 12, W / 2 - 12, 0, 3, -D / 2 + 6, D / 2 - 90, .5);
  pcb.box(-W / 2 + 6, W / 2 - 6, -5, 0, -D / 2 + 4, D / 2 - 86, .5);
  tray.add(meshOf(pcb, M.pcb));
  // 两颗 Xeon 8570
  const cpuSink = new Batch();
  for (const x of [-112, 112]) {
    cpuSink.box(x - 56, x + 56, 3, 8, 40, 160, .5);
    for (let k = -18; k <= 18; k++) cpuSink.box(x + k * 3, x + k * 3 + 1, 8, 72, 44, 156, .1);
  }
  tray.add(meshOf(cpuSink, M.aluminum));
  // 32 根内存
  const dimm = [];
  for (const cx of [-112, 112]) for (const s of [-1, 1]) for (let i = 0; i < 8; i++) dimm.push({ x: cx + s * (72 + i * 8), y: 22, z: 100, sx: 3.5, sy: 38, sz: 130 });
  tray.add(instances(unitBoxBev, M.plasticMid, dimm));
  // PCIe 网卡（ConnectX-7 / BlueField-3）
  const nic = new Batch();
  for (let i = 0; i < 10; i++) {
    const x = -W / 2 + 26 + i * 44;
    nic.box(x, x + 4, 6, 92, -D / 2 + 22, -D / 2 + 180, .4, 0x173126);
    nic.box(x + 4, x + 22, 16, 68, -D / 2 + 60, -D / 2 + 140, .6, 0x8a8f96);
  }
  tray.add(meshOf(nic, M.aluminum));

  // 顶盖
  const lid = new Batch();
  lid.box(-W / 2, W / 2, 0, 4, -D / 2, D / 2 + .2, 1);
  const lidM = meshOf(lid, M.chassis);
  group.add(lidM);

  // 盖面的“透视”发光块，表示内部对应部件（07 章选择指标时反馈）
  const pads = [];
  for (let i = 0; i < 8; i++) pads.push({ x: -165 + (i % 4) * 110, y: H - 24 + 5, z: (i < 4 ? -140 : 140) - 20, sx: 88, sy: .6, sz: 100 });
  for (let i = 0; i < 2; i++) pads.push({ x: i ? 70 : -70, y: H - 24 + 5, z: -20, sx: 58, sy: .6, sz: 58 });
  const padM = instances(unitBox, M.gpuGlow, pads, { cast: false });
  addGlowAttr(padM);
  group.add(padM);

  const dgx = {
    group, tray, lidM, padM, W, H, D,
    setOpen(a) {
      // a=0 合拢，a=1 打开（盖子与 CPU 托盘抬起）
      lidM.position.y = lerp(H - 24, H + 500, a);
      padM.position.y = lerp(0, 524, a);
      tray.position.y = lerp(320, 690, a);
    },
    setPads(rgb, a, kinds = 'gpu') {
      for (let i = 0; i < 10; i++) {
        const on = kinds === 'all' || (kinds === 'gpu' && i < 8) || (kinds === 'sw' && i >= 8);
        padM.glow.setXYZW(i, rgb[0], rgb[1], rgb[2], on ? a : 0);
      }
      padM.glow.needsUpdate = true;
    },
  };
  dgx.setOpen(1);
  return dgx;
}

// ==================== GB200 超级芯片（1 Grace + 2 B200） ====================
export function buildSuperchip(M) {
  const group = new THREE.Group();
  const W = 420, D = 210;
  const b = new Batch();
  b.box(-W / 2, W / 2, -5, 0, -D / 2, D / 2, .5);
  group.add(meshOf(b, M.pcb));
  // 两颗 B200
  const lite = liteGPUs(M, [{ x: -128, y: 0, z: 0, s: 1 }, { x: 128, y: 0, z: 0, s: 1 }]);
  group.add(lite.group);
  // Grace：单晶粒 + 周围 LPDDR5X
  const graceS = [{ x: 0, y: 1.5, z: 0, sx: 74, sy: 3, sz: 74 }];
  const graceD = [{ x: 0, y: 3.4, z: 0, sx: 30, sy: 1, sz: 36 }];
  const lp = [];
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) lp.push({ x: sx * 28, y: 3.4, z: -24 + k * 16, sx: 12, sy: 1.4, sz: 14 });
  for (const sz of [-1, 1]) for (let k = 0; k < 2; k++) lp.push({ x: -8 + k * 16, y: 3.4, z: sz * 30, sx: 13, sy: 1.4, sz: 10 });
  group.add(instances(unitBoxBev, M.mask, graceS));
  const grace = instances(unitBoxBev, M.cpuGlow, graceD); addGlowAttr(grace);
  group.add(grace, instances(unitBoxBev, M.hbmTop, lp));
  // VRM 与 NVLink-C2C 走线
  const c2c = [], vrm = [];
  for (const s of [-1, 1]) for (let k = -8; k <= 8; k++) c2c.push({ x: s * 56, y: .15, z: k * 1.7, sx: 48, sy: .25, sz: .8 });
  for (let i = 0; i < 40; i++) vrm.push({ x: -190 + i * 9.7, y: 2.4, z: (i % 2 ? 1 : -1) * 92, sx: 6, sy: 4.8, sz: 8 });
  group.add(instances(unitBox, M.gold, c2c, { cast: false }), instances(unitBoxBev, M.plasticMid, vrm));
  // NVLink 高速连接器
  const con = new Batch();
  for (const s of [-1, 1]) con.box(s * 128 - 44, s * 128 + 44, 0, 10, -D / 2 + 2, -D / 2 + 14, .4);
  group.add(meshOf(con, M.plastic));
  // 液冷板（可抬起）
  const coldG = new THREE.Group();
  const cold = new Batch();
  for (const x of [-128, 0, 128]) cold.box(x - (x === 0 ? 42 : 48), x + (x === 0 ? 42 : 48), 0, 7, -46, 46, .8);
  coldG.add(meshOf(cold, M.copperPlate));
  const pipe = new Batch();
  pipe.cylAxis([-180, 11, -22], [180, 11, -22], 4.5, 12);
  pipe.cylAxis([-180, 11, 22], [180, 11, 22], 4.5, 12);
  coldG.add(meshOf(pipe, M.pipeBlue));
  group.add(coldG);

  return {
    group, lite, grace, W, D, coldG,
    setCold(a) { coldG.position.y = lerp(6, 170, a); coldG.visible = a < .995; },
    gpuWorld(i, out = new THREE.Vector3()) { return group.localToWorld(out.set(i === 0 ? -128 : 128, 4.5, 0)); },
    cpuWorld(out = new THREE.Vector3()) { return group.localToWorld(out.set(0, 4, 0)); },
    glowCpu(r, g, b, a) { grace.glow.setXYZW(0, r, g, b, a); grace.glow.needsUpdate = true; },
  };
}

// ==================== GB200 NVL72 机柜 ====================
export const RACK = { W: 600, H: 2236, D: 1068, U: 44.45 };
// 自上而下：电源 / 10 计算 / 9 交换 / 8 计算 / 电源
const slots = (() => {
  const s = [];
  let u = 0;
  const push = (kind, n) => { for (let i = 0; i < n; i++) s.push({ kind, u: u++ }); };
  push('power', 4); push('compute', 10); push('switch', 9); push('compute', 8); push('power', 4);
  return s;
})();

export function buildRack(M) {
  const group = new THREE.Group();
  const { W, H, D, U } = RACK;
  // 框架
  const fr = new Batch();
  const t = 28;
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2 - t, -D / 2], [-W / 2, D / 2 - t], [W / 2 - t, D / 2 - t]]) fr.box(x, x + t, 0, H, z, z + t, 2);
  fr.box(-W / 2, W / 2, H - 30, H, -D / 2, D / 2, 3);
  fr.box(-W / 2, W / 2, 0, 60, -D / 2, D / 2, 3);
  fr.box(-W / 2 + 28, -W / 2 + 36, 60, H - 30, -D / 2 + 28, D / 2 - 28, 1);
  fr.box(W / 2 - 36, W / 2 - 28, 60, H - 30, -D / 2 + 28, D / 2 - 28, 1);
  group.add(meshOf(fr, M.chassisDark));

  const total = slots.length * U;
  const baseY = 90;
  const space = (H - 90 - 60 - total) / (slots.length - 1);
  const pitch = U + space;

  // 托盘外观（合批的单托盘几何，用实例摆放）
  const trayGeo = (() => {
    const b = new Batch();
    b.box(-268, 268, 0, U - 5, -D / 2 + 90, D / 2 - 40, 1.4);
    return b.build();
  })();
  const faceC = (() => {
    const b = new Batch();
    b.box(-268, 268, 0, U - 5, D / 2 - 41, D / 2 - 30, 1.5, 0x20242a);
    for (let i = 0; i < 12; i++) b.box(-250 + i * 22, -250 + i * 22 + 12, 8, U - 13, D / 2 - 31, D / 2 - 28.5, .6, 0x0c0d0f);
    b.box(40, 250, 8, U - 13, D / 2 - 31, D / 2 - 28.5, .6, 0x3a3e45);
    b.box(-264, -256, 4, U - 9, D / 2 - 30, D / 2 - 18, .5, 0xaeb3ba);
    b.box(256, 264, 4, U - 9, D / 2 - 30, D / 2 - 18, .5, 0xaeb3ba);
    return b.build();
  })();
  const faceS = (() => {
    const b = new Batch();
    b.box(-268, 268, 0, U - 5, D / 2 - 41, D / 2 - 30, 1.5, 0x1a1c20);
    for (let i = 0; i < 8; i++) b.box(-240 + i * 62, -240 + i * 62 + 50, 9, U - 14, D / 2 - 31, D / 2 - 28, .6, 0x050506);
    b.box(-264, -256, 4, U - 9, D / 2 - 30, D / 2 - 18, .5, 0xd0a06a);
    b.box(256, 264, 4, U - 9, D / 2 - 30, D / 2 - 18, .5, 0xd0a06a);
    return b.build();
  })();
  const faceP = (() => {
    const b = new Batch();
    b.box(-268, 268, 0, U - 5, D / 2 - 41, D / 2 - 30, 1.5, 0x111215);
    for (let i = 0; i < 6; i++) b.box(-256 + i * 86, -256 + i * 86 + 80, 5, U - 10, D / 2 - 31, D / 2 - 28, .6, 0x2a2c31);
    return b.build();
  })();
  const pM = new THREE.Matrix4();
  const trays = [];
  const trayBody = new THREE.InstancedMesh(trayGeo, M.chassis, slots.length);
  const vcM = M.plasticMid.clone(); vcM.vertexColors = true; vcM.metalness = .6; vcM.roughness = .5;
  const cnt = { compute: slots.filter(s => s.kind === 'compute').length, switch: 9, power: 8 };
  const faces = {
    compute: new THREE.InstancedMesh(faceC, vcM, cnt.compute),
    switch: new THREE.InstancedMesh(faceS, vcM, cnt.switch),
    power: new THREE.InstancedMesh(faceP, vcM, cnt.power),
  };
  const idxBy = { compute: 0, switch: 0, power: 0 };
  slots.forEach((s, i) => {
    s.y = H - 30 - pitch * (i + 1) + space / 2 + 8;
    s.idx = idxBy[s.kind]++;
    s.i = i;
    pM.makeTranslation(0, s.y, 0);
    trayBody.setMatrixAt(i, pM);
    faces[s.kind].setMatrixAt(s.idx, pM);
    trays.push(s);
  });
  trayBody.castShadow = trayBody.receiveShadow = true; trayBody.frustumCulled = false;
  group.add(trayBody);
  for (const k in faces) { faces[k].castShadow = false; faces[k].frustumCulled = false; group.add(faces[k]); }

  // 每个托盘的状态灯（可发光）
  const leds = slots.map(s => ({ x: 262, y: s.y + 14, z: D / 2 - 27, sx: 6, sy: 18, sz: 2 }));
  const led = instances(unitBox, M.trayGlow, leds, { cast: false });
  addGlowAttr(led);
  group.add(led);
  // 托盘前脸的宽发光条：选中托盘时可见
  const bars = slots.map(s => ({ x: 0, y: s.y + 1, z: D / 2 - 27.4, sx: 500, sy: 2, sz: 1.5 }));
  const bar = instances(unitBox, M.trayGlow, bars, { cast: false });
  addGlowAttr(bar);
  group.add(bar);

  // 背部：四组 NVLink 铜缆背板 + 液冷立管
  const spine = new Batch();
  for (const x of [-210, -70, 70, 210]) {
    spine.box(x - 56, x + 56, 90, H - 60, -D / 2 + 34, -D / 2 + 86, 2);
    for (let i = 0; i < 28; i++) spine.box(x - 50 + i * 3.6, x - 50 + i * 3.6 + 1.6, 96, H - 66, -D / 2 + 28, -D / 2 + 34, .3);
  }
  group.add(meshOf(spine, M.plasticMid));
  const pipeB = new Batch(), pipeR = new Batch();
  for (const s of [-1, 1]) {
    pipeB.cyl(s * 284, 60, H - 40, D / 2 - 90, 11, 14);
    pipeR.cyl(s * 284, 60, H - 40, D / 2 - 130, 11, 14);
  }
  group.add(meshOf(pipeB, M.pipeBlue), meshOf(pipeR, M.pipeRed));

  // 用于展开的“抽出托盘”：含 2 颗超级芯片与盖板打开的内部（占位于第 2 计算托盘）
  const heroSlot = trays.find(s => s.kind === 'compute' && s.idx === 4);
  const hero = new THREE.Group();
  hero.position.set(0, heroSlot.y, 0);
  group.add(hero);
  const hb = new Batch();
  hb.box(-268, 268, 0, 6, -D / 2 + 90, D / 2 - 40, 1.2);
  hb.box(-268, -262, 0, U - 5, -D / 2 + 90, D / 2 - 40, .8);
  hb.box(262, 268, 0, U - 5, -D / 2 + 90, D / 2 - 40, .8);
  hero.add(meshOf(hb, M.chassis));

  // 交换芯片（9 托盘 × 2 颗）：显示在抽出的展开图里
  const dup = {
    group, trays, trayBody, faces, led, bar, hero, heroSlot, pitch,
    setTrayPull(a) {
      // 抽出英雄托盘：把原托盘隐藏（缩小到零）并让替身沿 z 拉出
      const s = heroSlot;
      pM.makeScale(a > .001 ? 1e-4 : 1, a > .001 ? 1e-4 : 1, a > .001 ? 1e-4 : 1).setPosition(0, s.y, 0);
      trayBody.setMatrixAt(s.i, pM);
      trayBody.instanceMatrix.needsUpdate = true;
      hero.visible = a > .001;
      hero.position.z = a * 760;
      pM.makeTranslation(0, s.y, a * 760);
      faces.compute.setMatrixAt(s.idx, pM);
      faces.compute.instanceMatrix.needsUpdate = true;
      _m.makeTranslation(leds[s.i].x, leds[s.i].y, leds[s.i].z + a * 760);
      led.setMatrixAt(s.i, _m);
      led.instanceMatrix.needsUpdate = true;
      _m.makeTranslation(0, s.y + 1, bars[s.i].z + a * 760);
      _s.set(500, 2, 1.5); _p.set(0, s.y + 1, bars[s.i].z + a * 760); _q.identity();
      _m.compose(_p, _q, _s);
      bar.setMatrixAt(s.i, _m);
      bar.instanceMatrix.needsUpdate = true;
    },
    glowTray(i, r, g, b, a) { led.glow.setXYZW(i, r, g, b, Math.max(a, .0)); bar.glow.setXYZW(i, r, g, b, a * .6); led.glow.needsUpdate = bar.glow.needsUpdate = true; },
    trayWorld(i, out = new THREE.Vector3()) { return group.localToWorld(out.set(0, trays[i].y + 20, D / 2 - 26)); },
  };
  return dup;
}

// 成排机柜：共用一个合批外形，节省绘制
export function buildRow(M, rack, n = 7) {
  const group = new THREE.Group();
  const { W, H, D, U } = RACK;
  const b = new Batch();
  b.box(-W / 2, W / 2, 0, H, -D / 2, D / 2 - 26, 3, 0x30343b);
  for (let i = 0; i < 35; i++) {
    const y = 90 + i * (H - 150) / 35;
    b.box(-268, 268, y, y + U - 5, D / 2 - 26, D / 2 - 22, 1, i >= 4 && i < 14 || i >= 23 && i < 31 ? 0x62676f : i >= 14 && i < 23 ? 0x3a3048 : 0x24262b);
    for (let k = 0; k < 10; k++) b.box(-250 + k * 22, -250 + k * 22 + 12, y + 8, y + U - 13, D / 2 - 22, D / 2 - 20, .5, 0x0a0b0c);
  }
  const geo = b.build();
  const vm = M.chassis.clone(); vm.vertexColors = true; vm.metalness = .45; vm.roughness = .58;
  // 每个托盘一条状态灯带：绿色计算、紫色交换
  const ledC = new Batch(), ledS = new Batch();
  for (let i = 0; i < 35; i++) {
    const y = 90 + i * (H - 150) / 35;
    if (i >= 4 && i < 14 || i >= 23 && i < 31) ledC.box(60, 258, y + 14, y + 18, D / 2 - 20, D / 2 - 18, .2);
    else if (i >= 14 && i < 23) ledS.box(-258, 258, y + 14, y + 17, D / 2 - 20, D / 2 - 18, .2);
  }
  const geoC = ledC.build(), geoS = ledS.build();
  const mC = new THREE.MeshBasicMaterial({ color: new THREE.Color(.5, 1.6, .1) }), mS = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, .35, 1.8) });
  const list = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, vm);
    m.add(new THREE.Mesh(geoC, mC), new THREE.Mesh(geoS, mS));
    m.castShadow = m.receiveShadow = true;
    m.position.set((i + 1) * (W + 34), 0, 0);
    group.add(m);
    list.push(m);
  }
  return { group, list };
}

// 机房地面：架空地板，与灯光共同给出尺度
export function buildHallFloor(M) {
  const tex = canvasTex(1024, (x, s) => {
    x.fillStyle = '#16181d'; x.fillRect(0, 0, s, s);
    x.strokeStyle = '#272a31'; x.lineWidth = 6;
    x.strokeRect(0, 0, s, s);
    x.fillStyle = 'rgba(255,255,255,.015)';
    for (let i = 0; i < 400; i++) x.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }, 1, true);
  tex.repeat.set(40, 40);
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0x6d727c, metalness: .1, roughness: .78, transparent: true, envMapIntensity: .4 });
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(256, 256, 40, 256, 256, 256);
  g.addColorStop(0, '#fff'); g.addColorStop(.72, '#aaa'); g.addColorStop(1, '#000');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  mat.alphaMap = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000), mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}
