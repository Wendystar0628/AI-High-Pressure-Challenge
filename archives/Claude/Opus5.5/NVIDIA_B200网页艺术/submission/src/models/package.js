// 完整的 B200 封装模型（单位：毫米，Y 向上）。
// 外形与比例参考公开资料；晶粒内部布局、微凸点与硅通孔的数量是标明含义的示意。
//
// 俯视（x 向右，z 向观众）：
//        HBM0  ┌───────晶粒 A───────┐  HBM3
//        HBM1  └────────────────────┘  HBM2      z < 0
//   ─────────────── 接缝 z = 0 ────────────────
//        HBM4  ┌───────晶粒 B───────┐  HBM7      z > 0
//        HBM5  └────────────────────┘  HBM6
import * as THREE from 'three';
import { Batch, meshOf, instances, addGlowAttr, unitBox, lowSphere, tinySphere, unitCyl, canvasTex, PolyPath } from '../gfx/kit.js';
import { rng, lerp, clamp, sstep, hash1 } from '../core/util.js';
import { FORMATS } from '../core/numerics.js';

export const DIM = {
  sub: { x: 46, z: 42, y0: .55, y1: 2.75 },
  ip: { x: 30, z: 26.2, y0: 2.95, y1: 3.55 },
  die: { w: 34, d: 24.5, h: .85, y0: 3.62 },
  hbm: { w: 11, d: 11.8, x: 23.4, z: [6.2, 18.6], y0: 3.62 },
  ring: { xo: 45, zo: 41, xi: 35, zi: 31, y0: 2.75, y1: 4.2 },
};

// 颜色语义（全页统一）
export const KIND_COL = {
  sm: [.5, 1.0, .06],       // 计算：酸橙
  l2: [.2, .42, 1.0],       // 缓存：钴蓝
  phy: [.08, .72, 1.0],     // 显存接口：冰青
  hbi: [1.0, .46, .03],     // 片间互连：琥珀
  nvl: [.66, .2, 1.0],      // NVLink：紫
  hub: [1.0, .85, .55],     // 中枢：暖白
  dec: [1.0, .35, .55],     // 解压缩：玫红
  ras: [1.0, .42, .28],     // RAS：珊瑚
  sec: [.45, 1.0, .75],     // 机密计算：薄荷
};
const KIND_BASE = { sm: 0x5a606c, l2: 0x2e3a56, phy: 0x254a5a, hbi: 0x5c4220, nvl: 0x3e3258, hub: 0x4c473c, dec: 0x54323e, ras: 0x55362b, sec: 0x305247 };

// 功能区：u 沿 x，v 为离接缝的距离
export function makeRegions() {
  const R = [];
  const add = (die, id, kind, name, u0, u1, v0, v1, extra = {}) => {
    const sign = die === 'A' ? -1 : 1;
    const z0 = sign * v0, z1 = sign * v1;
    R.push({ id: `${die}.${id}`, die, kind, name, u0, u1, v0, v1, x0: u0, x1: u1, z0: Math.min(z0, z1), z1: Math.max(z0, z1), cx: (u0 + u1) / 2, cz: (z0 + z1) / 2, index: R.length, ...extra });
  };
  for (const die of ['A', 'B']) {
    add(die, 'hbi', 'hbi', '片间互连 NV-HBI', -15.2, 15.2, .2, 1.55);
    add(die, 'l2', 'l2', '二级缓存（左）', -15.2, -3.4, 1.8, 6.4);
    add(die, 'l2r', 'l2', '二级缓存（右）', 3.4, 15.2, 1.8, 6.4);
    if (die === 'A') {
      add(die, 'dec', 'dec', '解压缩引擎', -3.2, 3.2, 1.8, 4.0);
      add(die, 'ras', 'ras', 'RAS 引擎', -3.2, 3.2, 4.2, 6.4);
    } else {
      add(die, 'sec', 'sec', '机密计算', -3.2, 3.2, 1.8, 4.0);
      add(die, 'hub', 'hub', '控制中枢', -3.2, 3.2, 4.2, 6.4);
    }
    const gw = (30.4 - 4 * .35) / 5;
    for (let g = 0; g < 5; g++) {
      const u0 = -15.2 + g * (gw + .35);
      add(die, `gpc${g}`, 'sm', `计算单元组 ${g + 1}`, u0, u0 + gw, 6.7, 21.9, { gpc: g });
    }
    add(die, 'nvl', 'nvl', 'NVLink 接口', -15.2, 15.2, 22.2, 24.1);
    add(die, 'phyL', 'phy', '显存接口（左）', -16.8, -15.45, .4, 24.1);
    add(die, 'phyR', 'phy', '显存接口（右）', 15.45, 16.8, .4, 24.1);
  }
  return R;
}

export const STACK_POS = (() => {
  const { x, z } = DIM.hbm;
  return [[-x, -z[1]], [-x, -z[0]], [x, -z[0]], [x, -z[1]], [-x, z[0]], [-x, z[1]], [x, z[1]], [x, z[0]]];
})();
export const STACK_DIE = [0, 0, 0, 0, 1, 1, 1, 1];

// 每章的展开量（y 向上）
const EXPLODE = { balls: -17, substrate: 0, decaps: 0, stiffener: 11, c4: 18, interposer: 25, ubumps: 33, dies: 40, hbm: 40 };

export const PART_INFO = {
  balls: { name: '焊球阵列', en: 'BGA', dim: '约 4,800 颗（示意）', group: 'base', note: '封装与主板之间的电气与机械连接，底面居中留给去耦电容。' },
  substrate: { name: '封装基板', en: 'Substrate', dim: '92 × 84 mm · 9 层', group: 'base', note: '玻纤芯板两侧叠铜走线，把中介层的高密度信号扇出到焊球。' },
  stiffener: { name: '加固环', en: 'Stiffener', dim: '外框 90 × 82 mm', group: 'base', note: '抑制大尺寸封装回流焊时的翘曲。' },
  decaps: { name: '去耦元件', en: 'Decaps', dim: '顶面环布 + 底面阵列', group: 'base', note: '就近提供瞬态电流，压住上千瓦芯片的电压波动。' },
  c4: { name: 'C4 凸点', en: 'C4 bumps', dim: '约 1,200 颗（示意）', group: 'link', note: '中介层到基板的垂直连接，也是供电的主通道。' },
  interposer: { name: '中介层', en: 'CoWoS-L', dim: '60 × 52 mm', group: 'link', note: '表面 RDL 走线连接晶粒与显存，嵌入的硅桥承担最密的互连。' },
  ubumps: { name: '微凸点', en: 'µ-bumps', dim: '约 8,000 颗（示意）', group: 'link', note: '晶粒、显存与中介层之间的微米级连接层。' },
  dieA: { name: '计算晶粒 A', en: 'Die A', dim: '约 34 × 24.5 mm（示意）', group: 'die', note: '接近光罩极限的大晶粒。顶面按功能分区，底面布满微凸点。' },
  dieB: { name: '计算晶粒 B', en: 'Die B', dim: '约 34 × 24.5 mm（示意）', group: 'die', note: '与晶粒 A 镜像，经 10 TB/s 片间互连组成一颗 GPU。' },
};
for (let i = 0; i < 8; i++) PART_INFO[`hbm${i}`] = { name: `HBM3e 堆栈 ${i + 1}`, en: `Stack ${i + 1}`, dim: '基底 + 8 层 DRAM · 24 GB', group: 'mem', note: '八层 DRAM 叠在基底上，靠硅通孔与微凸点垂直互联；每层 3 GB。' };

export const PART_ORDER = ['dieA', 'dieB', 'hbm0', 'ubumps', 'interposer', 'c4', 'stiffener', 'decaps', 'substrate', 'balls'];

export function buildPackage(M) {
  const group = new THREE.Group();
  group.name = 'b200';
  const parts = {};
  const solids = []; // 剖切用的实体清单
  const R = rng(20240318);

  const node = (id, parent = group) => {
    const obj = new THREE.Group();
    parent.add(obj);
    const n = { id, obj, w: new THREE.Vector3(), mats: [] };
    return n;
  };
  const addSolid = (nd, x0, x1, y0, y1, z0, z1, mat, name) => solids.push({ nd, x0, x1, y0, y1, z0, z1, mat, name });

  // ========== 焊球 ==========
  const balls = node('balls'); parts.balls = balls;
  {
    const list = [];
    const pitch = 1.22;
    for (let x = -44.5; x <= 44.5; x += pitch) for (let z = -40.5; z <= 40.5; z += pitch) {
      if (Math.abs(x) < 14 && Math.abs(z) < 14) continue; // 中心留给背面去耦
      list.push({ x, y: .3, z, sx: .74, sy: .62, sz: .74 });
    }
    balls.count = list.length;
    const im = instances(lowSphere, M.solder, list);
    balls.obj.add(im);
    // 剖切：焊球按网格，用圆形截面
    balls.grid = { pitch, x0: -44.5, z0: -40.5, skip: 14, y: .3, r: .37, ry: .31, mat: 'solder' };
  }

  // ========== 基板：九层可分开 ==========
  const substrate = node('substrate'); parts.substrate = substrate;
  substrate.layers = [];
  {
    const { x: sx, z: sz, y0, y1 } = DIM.sub;
    const stackup = [
      { n: '底阻焊', t: .1, m: M.mask, mn: 'mask' },
      { n: 'BU3', t: .16, m: M.laminate, mn: 'laminate', cu: 3 },
      { n: 'BU2', t: .16, m: M.laminate, mn: 'laminate', cu: 2 },
      { n: 'BU1', t: .16, m: M.laminate, mn: 'laminate', cu: 1 },
      { n: '玻纤芯板', t: .9, m: M.core, mn: 'core', pth: true },
      { n: 'FU1', t: .16, m: M.laminate, mn: 'laminate', cu: 1 },
      { n: 'FU2', t: .16, m: M.laminate, mn: 'laminate', cu: 2 },
      { n: 'FU3', t: .16, m: M.laminate, mn: 'laminate', cu: 3 },
      { n: '顶阻焊', t: .24, m: M.mask, mn: 'mask', top: true },
    ];
    let y = y0;
    const totalT = stackup.reduce((a, b) => a + b.t, 0);
    const sc = (y1 - y0) / totalT;
    stackup.forEach((L, li) => {
      const t = L.t * sc;
      const nd = node(`sub${li}`, substrate.obj);
      nd.parentNode = substrate;
      nd.info = L;
      const b = new Batch();
      b.box(-sx, sx, y, y + t, -sz, sz, L.top ? .18 : .03);
      nd.obj.add(meshOf(b, L.m));
      addSolid(nd, -sx, sx, y, y + t, -sz, sz, L.mn, L.n);

      // 铜走线：每层方向不同，从中心扇出到外围
      if (L.cu) {
        const segs = [];
        const dir = (li % 2 === 0);
        const r2 = rng(100 + li);
        const nLines = 150;
        for (let k = 0; k < nLines; k++) {
          const a = k / nLines * Math.PI * 2;
          const r0 = 15 + r2() * 6, r1 = 28 + r2() * 14;
          const cx = Math.cos(a), cz = Math.sin(a);
          let px = cx * r0 * 1.1, pz = cz * r0;
          const qx = clamp(cx * r1 * 1.25, -sx + 1, sx - 1), qz = clamp(cz * r1 * 1.1, -sz + 1, sz - 1);
          // 45° 走线：先斜后直
          const dx = qx - px, dz = qz - pz;
          const m = Math.min(Math.abs(dx), Math.abs(dz));
          const mx = px + Math.sign(dx) * m, mz = pz + Math.sign(dz) * m;
          const seg = (ax, az, bx, bz) => {
            const l = Math.hypot(bx - ax, bz - az);
            if (l < .05) return;
            segs.push({ x: (ax + bx) / 2, y: y + t + .012, z: (az + bz) / 2, sx: l, sy: .025, sz: .13 + r2() * .1, ry: -Math.atan2(bz - az, bx - ax) });
          };
          if (dir) { seg(px, pz, mx, mz); seg(mx, mz, qx, qz); } else { seg(px, pz, qx, pz); seg(qx, pz, qx, qz); }
        }
        // 铜面：接地 / 电源铺铜块
        const planes = new Batch();
        for (let a = 0; a < 4; a++) {
          const cx = [-1, 1, 1, -1][a], cz = [-1, -1, 1, 1][a];
          planes.box(cx * 8, cx * (sx - 2), y + t, y + t + .018, cz * 3, cz * (3 + (sz - 16) * .35), .004);
        }
        const planeM = meshOf(planes, M.copperDull);
        planeM.castShadow = false;
        nd.obj.add(planeM);
        const im = instances(unitBox, M.copper, segs, { cast: false });
        nd.obj.add(im);
      }
      if (L.pth) {
        // 玻纤芯板里的镀通孔：抛光铜筒
        const list = [];
        for (let x = -40; x <= 40; x += 3.1) for (let z = -36; z <= 36; z += 3.1) {
          if (R() < .5) continue;
          list.push({ x, y: y + t / 2, z, sx: .42, sy: t * 1.02, sz: .42 });
        }
        nd.obj.add(instances(unitCyl, M.copper, list));
      }
      if (L.top) {
        // 顶面阻焊的细节：丝印、焊盘环
        const tex = canvasTex(2048, (c, s) => {
          c.fillStyle = '#000'; c.fillRect(0, 0, s, s);
          c.strokeStyle = 'rgba(230,220,180,.9)'; c.lineWidth = 2;
          const mx = v => (v / sx * .5 + .5) * s, mz = v => (v / sz * .5 + .5) * s;
          c.strokeRect(mx(-sx + 1.2), mz(-sz + 1.2), mx(sx - 1.2) - mx(-sx + 1.2), mz(sz - 1.2) - mz(-sz + 1.2));
          c.font = '26px "JetBrains Mono",Consolas,monospace'; c.fillStyle = 'rgba(232,226,200,.92)';
          c.fillText('B200 · 2×DIE · 8×HBM3e', mx(-sx + 2.4), mz(-sz + 3.4));
          c.fillText('CONCEPT MODEL 1:1', mx(12), mz(sz - 2));
          // 三角形 1 号角标
          c.beginPath(); c.moveTo(mx(-sx + 1.8), mz(sz - 1.8)); c.lineTo(mx(-sx + 4.2), mz(sz - 1.8)); c.lineTo(mx(-sx + 1.8), mz(sz - 4.2)); c.closePath(); c.fill();
        }, 1, true);
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(sx * 2, sz * 2), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: .6, metalness: 0 }));
        pl.rotation.x = -Math.PI / 2;
        pl.position.y = y + t + .004;
        pl.receiveShadow = true;
        nd.obj.add(pl);
      }
      if (li === 0) {
        // 底面焊盘与中央背面去耦
        const pads = [];
        const pitch = 1.22;
        for (let x = -44.5; x <= 44.5; x += pitch) for (let z = -40.5; z <= 40.5; z += pitch) {
          if (Math.abs(x) < 14 && Math.abs(z) < 14) continue;
          pads.push({ x, y: y - .004, z, sx: .92, sy: .012, sz: .92 });
        }
        nd.obj.add(instances(unitCyl, M.gold, pads, { cast: false }));
        const bodies = [], ends = [];
        for (let x = -12; x <= 12; x += 2.4) for (let z = -12; z <= 12; z += 1.6) {
          bodies.push({ x, y: y - .28, z, sx: 1.4, sy: .5, sz: .8 });
          ends.push({ x: x - .75, y: y - .28, z, sx: .32, sy: .54, sz: .84 }, { x: x + .75, y: y - .28, z, sx: .32, sy: .54, sz: .84 });
        }
        nd.obj.add(instances(unitBox, M.capBody, bodies), instances(unitBox, M.capEnd, ends));
      }
      substrate.layers.push({ nd, y0: y, y1: y + t, li, name: L.n });
      y += t;
    });
  }

  // ========== 顶面去耦 ==========
  const decaps = node('decaps'); parts.decaps = decaps;
  {
    const bodies = [], ends = [], pads = [];
    const y = DIM.sub.y1;
    const put = (x, z, rot, s = 1) => {
      const L = 2.0 * s, W = 1.2 * s, H = .95 * s;
      const ax = rot ? 0 : 1, az = rot ? 1 : 0;
      bodies.push({ x, y: y + H / 2, z, sx: rot ? W : L * .68, sy: H, sz: rot ? L * .68 : W });
      for (const d of [-1, 1]) {
        ends.push({ x: x + ax * d * L * .4, y: y + H / 2, z: z + az * d * L * .4, sx: rot ? W * 1.02 : L * .2, sy: H * 1.02, sz: rot ? L * .2 : W * 1.02 });
        pads.push({ x: x + ax * d * L * .4, y: y + .012, z: z + az * d * L * .4, sx: rot ? W * 1.1 : L * .34, sy: .024, sz: rot ? L * .34 : W * 1.1 });
      }
    };
    // 中介层与加固环之间的两圈
    for (let x = -29; x <= 29; x += 2.45) { put(x, 28.0, false); put(x, -28.0, false); }
    for (let z = -24; z <= 24; z += 2.45) { put(32.6, z, true); put(-32.6, z, true); }
    // 环外四周再布大电容
    for (let x = -40; x <= 40; x += 5.2) for (const s of [-1, 1]) if (Math.abs(x) > 2) { /* 加固环外宽度不足，留给丝印 */ }
    decaps.obj.add(instances(unitBox, M.capBody, bodies), instances(unitBox, M.capEnd, ends), instances(unitBox, M.gold, pads, { cast: false }));
    decaps.list = bodies;
  }

  // ========== 加固环 ==========
  const stiffener = node('stiffener'); parts.stiffener = stiffener;
  {
    const { xo, zo, xi, zi, y0, y1 } = DIM.ring;
    const shape = new THREE.Shape();
    const rr = (s, x0, z0, x1, z1, r) => {
      s.moveTo(x0 + r, z0); s.lineTo(x1 - r, z0); s.quadraticCurveTo(x1, z0, x1, z0 + r);
      s.lineTo(x1, z1 - r); s.quadraticCurveTo(x1, z1, x1 - r, z1);
      s.lineTo(x0 + r, z1); s.quadraticCurveTo(x0, z1, x0, z1 - r);
      s.lineTo(x0, z0 + r); s.quadraticCurveTo(x0, z0, x0 + r, z0);
    };
    rr(shape, -xo, -zo, xo, zo, 3);
    const hole = new THREE.Path();
    rr(hole, -xi, -zi, xi, zi, 2.2);
    shape.holes.push(hole);
    for (const [hx, hz] of [[-40, -36], [40, -36], [-40, 36], [40, 36]]) {
      const h = new THREE.Path(); h.absarc(hx, hz, 1.5, 0, Math.PI * 2, true); shape.holes.push(h);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0 - .36, bevelEnabled: true, bevelThickness: .18, bevelSize: .18, bevelSegments: 3, curveSegments: 18 });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, y1 - .18, 0);
    const m = new THREE.Mesh(geo, M.steel);
    m.castShadow = m.receiveShadow = true;
    stiffener.obj.add(m);
    addSolid(stiffener, -xo, -xi, y0, y1, -zo, zo, 'steel', '加固环');
    addSolid(stiffener, xi, xo, y0, y1, -zo, zo, 'steel', '加固环');
    addSolid(stiffener, -xi, xi, y0, y1, -zo, -zi, 'steel', '加固环');
    addSolid(stiffener, -xi, xi, y0, y1, zi, zo, 'steel', '加固环');
    // 胶层
    const b = new Batch();
    b.box(-xo + .4, -xi - .4, y0 - .04, y0, -zo + .4, zo - .4, .002);
    b.box(xi + .4, xo - .4, y0 - .04, y0, -zo + .4, zo - .4, .002);
    stiffener.obj.add(meshOf(b, M.plastic, { cast: false }));
    // 螺丝孔内的衬套
    const bb = new Batch();
    for (const [hx, hz] of [[-40, -36], [40, -36], [-40, 36], [40, 36]]) bb.cyl(hx, y0 + .1, y1 - .22, hz, 1.46, 20);
    stiffener.obj.add(meshOf(bb, M.steelDark));
  }

  // ========== C4 凸点 ==========
  const c4 = node('c4'); parts.c4 = c4;
  {
    const list = [];
    const pitch = 1.55;
    for (let x = -28.5; x <= 28.5; x += pitch) for (let z = -24.6; z <= 24.6; z += pitch) list.push({ x, y: (DIM.sub.y1 + DIM.ip.y0) / 2, z, sx: .9, sy: .3, sz: .9 });
    c4.obj.add(instances(lowSphere, M.solder, list));
    c4.grid = { pitch, x0: -28.5, z0: -24.6, xmax: 28.5, zmax: 24.6, y: (DIM.sub.y1 + DIM.ip.y0) / 2, r: .45, ry: .15, mat: 'solder' };
    c4.count = list.length;
  }

  // ========== 中介层 ==========
  const interposer = node('interposer'); parts.interposer = interposer;
  interposer.layers = [];
  {
    const { x: ix, z: iz, y0, y1 } = DIM.ip;
    const bottom = node('ipBottom', interposer.obj); bottom.parentNode = interposer;
    const bridges = node('ipBridge', interposer.obj); bridges.parentNode = interposer;
    const top = node('ipTop', interposer.obj); top.parentNode = interposer;
    const yMid = y0 + (y1 - y0) * .52, yTop = y1;
    // 下层：RDL 基层 + 贯穿孔
    const b0 = new Batch();
    b0.box(-ix, ix, y0, yMid, -iz, iz, .05);
    bottom.obj.add(meshOf(b0, M.rdl));
    addSolid(bottom, -ix, ix, y0, yMid, -iz, iz, 'rdl', '中介层基层');
    const tivs = [];
    for (let x = -28; x <= 28; x += 1.55) for (let z = -24.5; z <= 24.5; z += 1.55) tivs.push({ x, y: (y0 + yMid) / 2, z, sx: .34, sy: yMid - y0, sz: .34 });
    bottom.obj.add(instances(unitCyl, M.copper, tivs));

    // 嵌入的硅桥（CoWoS-L）：晶粒↔显存、晶粒↔晶粒
    const b1 = new Batch();
    const bridgeList = [];
    const addBr = (x0, x1, z0, z1, kind) => {
      b1.box(x0, x1, yMid - .1, yMid + .06, z0, z1, .012);
      bridgeList.push({ x0, x1, z0, z1, kind });
      addSolid(bridges, x0, x1, yMid - .1, yMid + .06, z0, z1, 'bridge', '硅桥');
    };
    for (const u of [-13.2, -6.6, 0, 6.6, 13.2]) addBr(u - 2.7, u + 2.7, -2.3, 2.3, 'd2d');
    for (const [sx, sz] of STACK_POS) addBr(Math.sign(sx) * 14.6 - 0 + (sx > 0 ? 0 : -6.2), Math.sign(sx) * 14.6 + (sx > 0 ? 6.2 : 0), sz - 3.6, sz + 3.6, 'hbm');
    bridges.obj.add(meshOf(b1, M.silicon));
    bridges.list = bridgeList;
    // 硅桥表面的细线：真正的最密互连
    const fine = [];
    for (const u of [-13.2, -6.6, 0, 6.6, 13.2]) for (let k = -13; k <= 13; k++) fine.push({ x: u + k * .19, y: yMid + .068, z: 0, sx: .05, sy: .012, sz: 4.2 });
    for (const [sx, sz] of STACK_POS) for (let k = -18; k <= 18; k++) fine.push({ x: Math.sign(sx) * 17.7, y: yMid + .068, z: sz + k * .19, sx: 5.6, sy: .012, sz: .05 });
    bridges.obj.add(instances(unitBox, M.gold, fine, { cast: false }));

    // 顶层：RDL + 表面走线（半透明感由薄膜表现）
    const b2 = new Batch();
    b2.box(-ix, ix, yMid, yTop, -iz, iz, .06);
    const topM = meshOf(b2, M.interposer);
    top.obj.add(topM);
    addSolid(top, -ix, ix, yMid, yTop, -iz, iz, 'interposer', '中介层 RDL');

    const segs = [];
    const lanes = [];
    const R2 = rng(77);
    // 显存 → 晶粒的扇形走线
    STACK_POS.forEach(([sx, sz], si) => {
      const sgn = Math.sign(sx);
      for (let k = 0; k < 42; k++) {
        const t = (k + .5) / 42;
        const zs = sz + (t - .5) * 9.6;
        const xStart = sx - sgn * 4.6;
        const xEnd = sgn * 13.2;
        const zEnd = sz + (t - .5) * 7.0 + (sz > 0 ? .4 : -.4);
        const xm = lerp(xStart, xEnd, .5);
        const add2 = (ax, az, bx, bz, w = .07) => {
          const l = Math.hypot(bx - ax, bz - az);
          if (l < .02) return;
          segs.push({ x: (ax + bx) / 2, y: yTop + .008, z: (az + bz) / 2, sx: l + w, sy: .016, sz: w, ry: -Math.atan2(bz - az, bx - ax) });
        };
        add2(xStart, zs, xm + sgn * Math.abs(zs - zEnd), zs);
        add2(xm + sgn * Math.abs(zs - zEnd), zs, xm, zEnd);
        add2(xm, zEnd, xEnd, zEnd);
        if (k % 7 === 3) lanes.push({ si, pts: [[xStart, zs], [xm + sgn * Math.abs(zs - zEnd), zs], [xm, zEnd], [xEnd, zEnd]] });
      }
    });
    // 跨缝走线
    for (let k = -120; k <= 120; k++) {
      const x = k * .125;
      if (Math.abs(x) > 15.2) continue;
      segs.push({ x, y: yTop + .008, z: 0, sx: .05, sy: .016, sz: 5 + (hash1(k) * 1.2), ry: 0 });
    }
    // 外围电源网格
    for (let x = -28; x <= 28; x += 2) segs.push({ x, y: yTop + .006, z: 0, sx: .12, sy: .01, sz: iz * 2 - 2 });
    for (let z = -24; z <= 24; z += 2) segs.push({ x: 0, y: yTop + .006, z, sx: ix * 2 - 2, sy: .01, sz: .12 });
    const traceMesh = instances(unitBox, M.copper, segs, { cast: false });
    top.obj.add(traceMesh);
    interposer.lanes = lanes;
    // 焊盘：晶粒与显存脚印
    const pads = [];
    const padP = .62;
    for (let x = -16.6; x <= 16.6; x += padP) for (let z = .4; z <= 24.2; z += padP) {
      pads.push({ x, y: yTop + .01, z, sx: .24, sy: .018, sz: .24 }, { x, y: yTop + .01, z: -z, sx: .24, sy: .018, sz: .24 });
    }
    STACK_POS.forEach(([sx, sz]) => {
      for (let x = -4.8; x <= 4.8; x += .7) for (let z = -5.2; z <= 5.2; z += .7) pads.push({ x: sx + x, y: yTop + .01, z: sz + z, sx: .2, sy: .018, sz: .2 });
    });
    top.obj.add(instances(unitCyl, M.gold, pads, { cast: false }));
    interposer.layers = [{ nd: bottom, y0, y1: yMid, name: '基层' }, { nd: bridges, y0: yMid - .1, y1: yMid + .06, name: '硅桥层' }, { nd: top, y0: yMid, y1: yTop, name: 'RDL' }];
  }

  // ========== 微凸点层 ==========
  const ubumps = node('ubumps'); parts.ubumps = ubumps;
  {
    const list = [];
    const y = (DIM.ip.y1 + DIM.die.y0) / 2;
    const pitch = .62;
    for (let x = -16.6; x <= 16.6; x += pitch) for (let z = .4; z <= 24.2; z += pitch) {
      list.push({ x, y, z, sx: .3, sy: .07, sz: .3 }, { x, y, z: -z, sx: .3, sy: .07, sz: .3 });
    }
    ubumps.dieCount = list.length;
    STACK_POS.forEach(([sx, sz]) => {
      for (let x = -4.8; x <= 4.8; x += .7) for (let z = -5.2; z <= 5.2; z += .7) list.push({ x: sx + x, y, z: sz + z, sx: .24, sy: .07, sz: .24 });
    });
    ubumps.obj.add(instances(unitCyl, M.solder, list));
    ubumps.count = list.length;
    ubumps.grid = { pitch, y, r: .15, ry: .035, mat: 'solder', dieOnly: true };
  }

  // ========== 两颗计算晶粒 ==========
  const regions = makeRegions();
  const regionById = Object.fromEntries(regions.map(r => [r.id, r]));
  const dieCells = {}; // 'A'|'B' → {im, map:[{regionIdx,x,z,seed}]}
  for (const [D, id] of [['A', 'dieA'], ['B', 'dieB']]) {
    const sign = D === 'A' ? -1 : 1;
    const nd = node(id); parts[id] = nd;
    const { w, d, h, y0 } = DIM.die;
    const pivot = new THREE.Group(); // 翻转用：绕晶粒中心
    pivot.position.set(0, y0 + h / 2, sign * d / 2);
    nd.obj.add(pivot);
    nd.pivot = pivot;
    const inner = new THREE.Group();
    inner.position.set(0, -(y0 + h / 2), -sign * d / 2);
    pivot.add(inner);
    const y1 = y0 + h;
    const z0 = sign > 0 ? .18 : -d - .18, z1 = sign > 0 ? d + .18 : -.18;
    const b = new Batch();
    b.box(-w / 2, w / 2, y0, y1 - .03, z0, z1, .025);
    const baseM = meshOf(b, M.dieSide);
    inner.add(baseM);
    addSolid(nd, -w / 2, w / 2, y0, y1, z0, z1, 'silicon', id === 'dieA' ? '晶粒 A' : '晶粒 B');
    // 顶面薄膜硅
    const t = new Batch();
    t.box(-w / 2 + .02, w / 2 - .02, y1 - .032, y1, z0 + .02, z1 - .02, .008);
    const skin = meshOf(t, M.silicon);
    inner.add(skin);

    // 功能区实例
    const list = [], map = [];
    const dieRegions = regions.filter(r => r.die === D);
    const yC = y1 + .009;
    const addCell = (r, x, z, sx, sz, shade = 0) => {
      list.push({ x, y: yC, z, sx, sy: .018, sz });
      map.push({ r: r.index, x, z, shade, seed: R() });
    };
    for (const r of dieRegions) {
      const sg = sign;
      if (r.kind === 'sm') {
        // 16 个计算单元（SM），每个含 4 个张量核心 + 一条控制带
        const pad = .1;
        const cw = (r.u1 - r.u0 - pad * 3) / 4, cd = (r.v1 - r.v0 - pad * 3) / 4;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          const cx = r.u0 + cw / 2 + i * (cw + pad);
          const cv = r.v0 + cd / 2 + j * (cd + pad);
          const q = .05;
          const tw = (cw - q) / 2, td = (cd * .78 - q) / 2;
          for (let a = 0; a < 2; a++) for (let b2 = 0; b2 < 2; b2++) {
            addCell(r, cx + (a - .5) * (tw + q), sg * (cv + cd * .1 + (b2 - .5) * (td + q)), tw, td, a * .08 + b2 * .05);
          }
          addCell(r, cx, sg * (cv - cd * .4), cw, cd * .14, -.35);
        }
      } else if (r.kind === 'l2') {
        const nx = 6, ny = 2;
        const cw = (r.u1 - r.u0 - .08 * (nx - 1)) / nx, cd = (r.v1 - r.v0 - .08) / ny;
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
          addCell(r, r.u0 + cw / 2 + i * (cw + .08), sg * (r.v0 + cd / 2 + j * (cd + .08)), cw, cd);
        }
      } else if (r.kind === 'hbi') {
        const n = 96, cw = (r.u1 - r.u0) / n;
        for (let i = 0; i < n; i++) addCell(r, r.u0 + (i + .5) * cw, sg * (r.v0 + r.v1) / 2, cw * .78, r.v1 - r.v0, (i % 8 === 0) ? -.25 : 0);
      } else if (r.kind === 'nvl') {
        const n = 9, cw = (r.u1 - r.u0 - .14 * (n - 1)) / n;
        for (let i = 0; i < n; i++) {
          const cx = r.u0 + cw / 2 + i * (cw + .14);
          for (let k = 0; k < 8; k++) addCell(r, cx + (k - 3.5) * (cw / 8), sg * (r.v0 + r.v1) / 2, cw / 8 * .8, r.v1 - r.v0, k === 0 ? -.3 : 0);
        }
      } else if (r.kind === 'phy') {
        const n = 34, cd = (r.v1 - r.v0) / n;
        for (let i = 0; i < n; i++) addCell(r, (r.u0 + r.u1) / 2, sg * (r.v0 + (i + .5) * cd), r.u1 - r.u0, cd * .74, (i % 5 === 0) ? -.2 : 0);
      } else {
        const nx = 5, ny = 2;
        const cw = (r.u1 - r.u0 - .06 * (nx - 1)) / nx, cd = (r.v1 - r.v0 - .06) / ny;
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) addCell(r, r.u0 + cw / 2 + i * (cw + .06), sg * (r.v0 + cd / 2 + j * (cd + .06)), cw, cd, ((i + j) % 2) * .1);
      }
    }
    const im = instances(unitBox, M.dieCell, list, { cast: false });
    const col = new THREE.Color(), tmp = new THREE.Color();
    map.forEach((c, i) => {
      const r = regions[c.r];
      col.set(KIND_BASE[r.kind]);
      const v = 1 + c.shade + (c.seed - .5) * .1;
      tmp.copy(col).multiplyScalar(v);
      im.setColorAt(i, tmp);
    });
    addGlowAttr(im);
    inner.add(im);
    dieCells[D] = { im, map };

    // 密封环
    const ring = new Batch();
    const e = .06;
    ring.box(-w / 2 + .08, w / 2 - .08, y1, y1 + .014, z0 + .08, z0 + .08 + e, .004);
    ring.box(-w / 2 + .08, w / 2 - .08, y1, y1 + .014, z1 - .08 - e, z1 - .08, .004);
    ring.box(-w / 2 + .08, -w / 2 + .08 + e, y1, y1 + .014, z0 + .08, z1 - .08, .004);
    ring.box(w / 2 - .08 - e, w / 2 - .08, y1, y1 + .014, z0 + .08, z1 - .08, .004);
    inner.add(meshOf(ring, M.aluminum, { cast: false }));

    // 底面：微凸点 + 分区标记（翻转后可见）
    const bumps = [];
    const pp = .62;
    for (let x = -16.6; x <= 16.6; x += pp) for (let v = .4; v <= 24.2; v += pp) bumps.push({ x, y: y0 - .03, z: sign * v, sx: .28, sy: .06, sz: .28 });
    inner.add(instances(unitCyl, M.gold, bumps, { cast: false }));
    const under = new Batch();
    under.box(-w / 2 + .05, w / 2 - .05, y0 - .004, y0, z0 + .05, z1 - .05, .001);
    inner.add(meshOf(under, M.rdl, { cast: false }));
    nd.inner = inner;
  }

  // ========== 8 个 HBM3e 堆栈 ==========
  const stacks = [];
  const tileColors = [];
  const hbmN = 8;
  // 共享实例数据
  const tsvXY = [], bumpXY = [];
  for (let c = -2; c <= 2; c++) for (let r = -7; r <= 7; r++) tsvXY.push([c * .62, r * .62]);
  for (let c = -5; c <= 5; c++) for (let r = -7; r <= 7; r++) {
    if (Math.abs(c) <= 2 || (r % 2 === 0)) bumpXY.push([c * .78, r * .72]);
  }
  const { w: hw, d: hd, y0: hy0 } = DIM.hbm;
  STACK_POS.forEach(([sx, sz], si) => {
    const id = `hbm${si}`;
    const nd = node(id); parts[id] = nd;
    nd.obj.position.set(0, 0, 0);
    nd.stack = si;
    nd.center = [sx, sz];
    nd.layers = [];
    const stackG = new THREE.Group();
    stackG.position.set(sx, 0, sz);
    nd.obj.add(stackG);
    // 基底 0；DRAM 1..8；顶盖 9
    const layerCount = 10;
    const ts = [.14, .068, .068, .068, .068, .068, .068, .068, .068, .12];
    const gap = .016;
    let y = hy0;
    for (let li = 0; li < layerCount; li++) {
      const lg = new THREE.Group();
      stackG.add(lg);
      const t = ts[li];
      const b = new Batch();
      const inset = li === 0 ? 0 : .12;
      const mat = li === 0 ? M.hbmBase : li === 9 ? M.hbmTop : M.dram;
      b.box(-hw / 2 + inset, hw / 2 - inset, y, y + t, -hd / 2 + inset, hd / 2 - inset, li === 9 ? .025 : .008);
      const slab = meshOf(b, mat);
      lg.add(slab);
      const lnd = { id: `${id}.${li}`, obj: lg, w: new THREE.Vector3(), mats: [], parentNode: nd, si, li };
      addSolid(lnd, sx - hw / 2 + inset, sx + hw / 2 - inset, y, y + t, sz - hd / 2 + inset, sz + hd / 2 - inset, li === 0 ? 'hbmBase' : li === 9 ? 'hbmTop' : 'dram', li === 0 ? '基底' : li === 9 ? '顶盖' : `DRAM ${li}`);

      // 硅通孔：每层一段，展开后看得到断面
      if (li < 9) {
        const tsvs = tsvXY.map(([a, c]) => ({ x: a, y: y + t / 2, z: c, sx: .1, sy: t + .004, sz: .1 }));
        lg.add(instances(unitCyl, M.copper, tsvs, { cast: false }));
      }
      // 层上方微凸点（挂在层顶）
      if (li < 9) {
        const bump = bumpXY.map(([a, c]) => ({ x: a, y: y + t + gap / 2, z: c, sx: .16, sy: gap * 1.15, sz: .16 }));
        lg.add(instances(tinySphere, M.solder, bump, { cast: false }));
      }
      // DRAM 表面：8×8 个逻辑分区
      if (li >= 1 && li <= 8) {
        const tiles = [];
        const tw = (hw - .6) / 8, td = (hd - .6) / 8;
        for (let a = 0; a < 8; a++) for (let c = 0; c < 8; c++) {
          tiles.push({ x: (a - 3.5) * tw, y: y + t + .002, z: (c - 3.5) * td, sx: tw * .9, sy: .004, sz: td * .9 });
        }
        const tm = instances(unitBox, M.tile, tiles, { cast: false, receive: false });
        const white = new THREE.Color(0x2a2f38);
        for (let i = 0; i < 64; i++) tm.setColorAt(i, white);
        addGlowAttr(tm);
        lg.add(tm);
        tm.visible = false;
        lnd.tiles = tm;
      }
      if (li === 0) {
        const pins = bumpXY.map(([a, c]) => ({ x: a, y: y - .03, z: c, sx: .18, sy: .06, sz: .18 }));
        lg.add(instances(unitCyl, M.gold, pins, { cast: false }));
      }
      lnd.y0 = y; lnd.y1 = y + t;
      lnd.solidsIndex = solids.length - 1;
      nd.layers.push(lnd);
      y += t + gap;
    }
    nd.top = y;
    stacks.push(nd);
  });

  // ========== 选中 / 高亮：为部件复制材质，互不影响 ==========
  const originalMat = new Map();
  const cloneFor = (nd) => {
    nd.obj.traverse(o => {
      if (o.isMesh && o.material && !o.material.userData.glow) {
        // 带发光补丁的材质走实例发光，不复制
        if (!originalMat.has(o)) {
          const cl = o.material.clone();
          cl.emissive = new THREE.Color(0xffffff);
          cl.emissiveIntensity = 0;
          o.material = cl;
          originalMat.set(o, cl);
          nd.mats.push(cl);
        }
      }
    });
  };
  for (const k of Object.keys(parts)) cloneFor(parts[k]);

  group.add(new THREE.Object3D());

  // ========== 运动状态 ==========
  const iso = { amt: 0, id: null };
  const lastOpen = new Array(8).fill(-1);

  const pkg = {
    group, parts, solids, regions, regionById, dieCells, stacks, STACK_POS, iso,
    st: { explode: 0, seam: 0, deep: 0, flip: 0, open: new Array(8).fill(0), layerSpread: 2.6, hbmSpread: 1, subSpread: 0, ipSpread: 0, isolate: null, isoAmt: 0 },

    offset(id) { return parts[id].w; },

    // 所有部件的世界偏移只在这里决定
    apply(st) {
      Object.assign(pkg.st, st);
      const s = pkg.st;
      const e = s.explode;
      const set = (nd, x, y, z) => { nd.obj.position.set(x, y, z); nd.w.set(x, y, z); };
      const gid = s.isolate;
      const isoY = (id, base) => {
        if (!gid || s.isoAmt <= 0) return 0;
        if (id === gid || (gid === 'dieAB' && (id === 'dieA' || id === 'dieB'))) return 0;
        const order = { balls: -2, substrate: -2, decaps: -2, stiffener: -1, c4: -1, interposer: 0, ubumps: 1, dieA: 2, dieB: 2 };
        const me = order[id] ?? 2, tgt = order[gid] ?? 2;
        const dir = me === tgt ? (id.startsWith('hbm') || gid.startsWith('hbm') ? 1 : 1) : Math.sign(me - tgt);
        return dir * s.isoAmt * s.isoAmt * 420;
      };
      set(parts.balls, 0, EXPLODE.balls * e + isoY('balls'), 0);
      set(parts.substrate, 0, EXPLODE.substrate * e + isoY('substrate'), 0);
      set(parts.decaps, 0, EXPLODE.decaps * e + isoY('decaps') + (s.subSpread * 2.2 * 8), 0);
      set(parts.stiffener, 0, EXPLODE.stiffener * e + isoY('stiffener') + (s.subSpread * 2.2 * 10), 0);
      set(parts.c4, 0, EXPLODE.c4 * e + isoY('c4'), 0);
      set(parts.interposer, 0, EXPLODE.interposer * e + isoY('interposer'), 0);
      set(parts.ubumps, 0, EXPLODE.ubumps * e + isoY('ubumps'), 0);
      const g = s.seam / 2;
      set(parts.dieA, 0, EXPLODE.dies * e + isoY('dieA'), -g);
      set(parts.dieB, 0, EXPLODE.dies * e + isoY('dieB'), g);
      // 基板内部分层
      for (const L of parts.substrate.layers) {
        const dy = s.subSpread * 2.2 * L.li;
        L.nd.obj.position.y = dy;
        L.nd.w.set(0, parts.substrate.w.y + dy, 0);
      }
      for (const L of parts.interposer.layers) {
        const dy = s.ipSpread * (L.name === '基层' ? -3.2 : L.name === 'RDL' ? 3.2 : 0);
        L.nd.obj.position.y = dy;
        L.nd.w.set(0, parts.interposer.w.y + dy, 0);
      }
      // 翻转晶粒：绕 x 轴
      for (const id of ['dieA', 'dieB']) {
        const nd = parts[id];
        const sel = gid === id || gid === 'dieAB' || !gid;
        nd.pivot.rotation.x = (sel ? s.flip : 0) * Math.PI * (id === 'dieA' ? 1 : -1);
      }
      // 显存
      for (let i = 0; i < hbmN; i++) {
        const nd = stacks[i];
        const [sx] = STACK_POS[i];
        const h = Math.sign(sx) * 6 * e * s.hbmSpread;
        set(nd, h, EXPLODE.hbm * e + isoY(`hbm${i}`), Math.sign(STACK_POS[i][1]) * (s.seam / 2) * .0);
        const open = s.open[i];
        if (Math.abs(open - lastOpen[i]) > 1e-4 || true) {
          for (const L of nd.layers) {
            const dy = open * s.layerSpread * L.li;
            L.obj.position.y = dy;
            L.w.set(nd.w.x, nd.w.y + dy, nd.w.z);
          }
          lastOpen[i] = open;
        }
      }
      // 隔离时把飞远的部件隐藏（到位后才隐藏，避免闪动）
      for (const k of Object.keys(parts)) {
        const nd = parts[k];
        nd.obj.visible = !(gid && s.isoAmt > .98 && Math.abs(isoY(k)) > 100);
      }
    },

    // 部件中心（世界坐标）
    center(id, out = new THREE.Vector3()) {
      const nd = parts[id];
      const c = PART_CENTER[id];
      if (id.startsWith('hbm')) {
        const open = pkg.st.open[nd.stack];
        return out.set(nd.center[0] + nd.w.x, DIM.hbm.y0 + .5 + nd.w.y + open * pkg.st.layerSpread * 4.5, nd.center[1]);
      }
      out.set(c[0] + nd.w.x, c[1] + nd.w.y, c[2] + nd.w.z);
      return out;
    },
    radius(id) { return PART_RADIUS[id] ?? (id.startsWith('hbm') ? 9 : 30); },

    // 射线拾取：对部件包围盒做解析求交（与遮挡判定共用）
    pick(o, d) {
      let best = null, bestT = Infinity;
      for (const b of pkg.pickBoxes()) {
        const t = rayBox(o, d, b);
        if (t !== null && t < bestT) { bestT = t; best = b; }
      }
      return best ? { id: best.id, t: bestT, layer: best.layer } : null;
    },
    pickBoxes() {
      const out = [];
      const put = (id, x0, x1, y0, y1, z0, z1, layer) => {
        const nd = parts[id];
        if (!nd.obj.visible) return;
        const w = nd.w;
        out.push({ id, layer, x0: x0 + w.x, x1: x1 + w.x, y0: y0 + w.y, y1: y1 + w.y, z0: z0 + w.z, z1: z1 + w.z });
      };
      const { sub, ip, die, ring } = DIM;
      put('balls', -sub.x, sub.x, 0, .6, -sub.z, sub.z);
      put('substrate', -sub.x, sub.x, sub.y0, sub.y1 + pkg.st.subSpread * 18, -sub.z, sub.z);
      put('decaps', -34, 34, sub.y1, sub.y1 + 1, -30, 30); // 去耦在环内一圈：放在后面比较
      put('stiffener', -ring.xo, -ring.xi, ring.y0, ring.y1, -ring.zo, ring.zo);
      put('stiffener', ring.xi, ring.xo, ring.y0, ring.y1, -ring.zo, ring.zo);
      put('stiffener', -ring.xi, ring.xi, ring.y0, ring.y1, -ring.zo, -ring.zi);
      put('stiffener', -ring.xi, ring.xi, ring.y0, ring.y1, ring.zi, ring.zo);
      put('c4', -ip.x, ip.x, sub.y1, ip.y0, -ip.z, ip.z);
      put('interposer', -ip.x, ip.x, ip.y0, ip.y1, -ip.z, ip.z);
      put('ubumps', -17, 17, ip.y1, die.y0, -25, 25);
      put('dieA', -die.w / 2, die.w / 2, die.y0, die.y0 + die.h, -die.d - .18, -.18);
      put('dieB', -die.w / 2, die.w / 2, die.y0, die.y0 + die.h, .18, die.d + .18);
      stacks.forEach((nd, i) => {
        if (!nd.obj.visible) return;
        const [sx, sz] = nd.center;
        const open = pkg.st.open[i], sp = pkg.st.layerSpread;
        if (open < .02) {
          put(`hbm${i}`, sx - hw / 2, sx + hw / 2, hy0, nd.top, sz - hd / 2, sz + hd / 2);
        } else {
          for (const L of nd.layers) put(`hbm${i}`, sx - hw / 2, sx + hw / 2, L.y0 + open * sp * L.li, L.y1 + open * sp * L.li + .02, sz - hd / 2, sz + hd / 2, L.li);
        }
      });
      return out;
    },

    // 从相机到某点是否被遮挡
    occluded(cam, p, ignoreId = null) {
      const dx = p.x - cam.x, dy = p.y - cam.y, dz = p.z - cam.z;
      const L = Math.hypot(dx, dy, dz);
      const d = { x: dx / L, y: dy / L, z: dz / L };
      for (const b of pkg.pickBoxes()) {
        if (ignoreId && b.id === ignoreId) continue;
        const t = rayBox(cam, d, b);
        if (t !== null && t < L - .4) return true;
      }
      return false;
    },

    // 截面：返回平面上每个实体的矩形（世界坐标），3D 截面盖与 2D 剖面共用这份数据
    sectionRects(axis, pos) {
      const out = [];
      for (const s of solids) {
        const w = s.nd.w;
        if (s.nd.parentNode && s.nd.parentNode.obj.visible === false) continue;
        if (s.nd.obj.visible === false) continue;
        if (axis === 'x') {
          if (pos < s.x0 + w.x || pos > s.x1 + w.x) continue;
          out.push({ a0: s.z0 + w.z, a1: s.z1 + w.z, y0: s.y0 + w.y, y1: s.y1 + w.y, mat: s.mat, name: s.name, id: s.nd.id });
        } else {
          if (pos < s.z0 + w.z || pos > s.z1 + w.z) continue;
          out.push({ a0: s.x0 + w.x, a1: s.x1 + w.x, y0: s.y0 + w.y, y1: s.y1 + w.y, mat: s.mat, name: s.name, id: s.nd.id });
        }
      }
      // 周期结构：焊球、C4、微凸点按网格算出截面圆（用同一规则）
      const gridCuts = (nd, g, xr, zr, skip, shape = 'dot') => {
        if (!nd.obj.visible) return;
        const w = nd.w;
        const P = axis === 'x' ? pos - w.x : pos - w.z;
        const c0 = axis === 'x' ? xr[0] : zr[0];
        const idx = Math.round((P - c0) / g.pitch);
        const near = c0 + idx * g.pitch;
        const d = Math.abs(P - near);
        if (d > g.r) return;
        const rr = Math.sqrt(Math.max(g.r * g.r - d * d, 0));
        const o0 = axis === 'x' ? zr[0] : xr[0], o1 = axis === 'x' ? zr[1] : xr[1];
        const fac = rr / g.r;
        for (let v = o0; v <= o1 + 1e-4; v += g.pitch) {
          if (skip && skip(near, v)) continue;
          out.push({ a0: v - rr + (axis === 'x' ? w.z : w.x), a1: v + rr + (axis === 'x' ? w.z : w.x), y0: g.y - g.ry * fac + w.y, y1: g.y + g.ry * fac + w.y, mat: g.mat, shape, id: nd.id });
        }
      };
      const bg = parts.balls.grid;
      gridCuts(parts.balls, bg, [bg.x0, 44.5], [bg.z0, 40.5], (a, b) => Math.abs(a) < 14 && Math.abs(b) < 14);
      const cg = parts.c4.grid;
      gridCuts(parts.c4, cg, [cg.x0, cg.xmax], [cg.z0, cg.zmax]);
      const ug = parts.ubumps.grid;
      gridCuts(parts.ubumps, { ...ug, pitch: ug.pitch }, [-16.6, 16.6], [-24.2, 24.2]);
      // 显存内的硅通孔：段状截面
      stacks.forEach((nd, si) => {
        if (!nd.obj.visible) return;
        const [sx, sz] = nd.center;
        for (const L of nd.layers) {
          if (L.li >= 9) continue;
          for (const [a, c] of tsvXY) {
            const P = axis === 'x' ? pos - L.w.x - sx : pos - L.w.z - sz;
            const q = axis === 'x' ? a : c;
            if (Math.abs(P - q) > .08) continue;
            const o = axis === 'x' ? sz + c + L.w.z : sx + a + L.w.x;
            out.push({ a0: o - .05, a1: o + .05, y0: L.y0 + L.w.y, y1: L.y1 + L.w.y + .016, mat: 'copper', id: `hbm${si}`, fine: true });
          }
        }
      });
      return out;
    },

    // 把 DRAM 的逻辑分区画到三维层面上（随精度变化）
    setPartition(layout, visible, glow = 1) {
      for (const nd of stacks) {
        for (const L of nd.layers) {
          if (!L.tiles) continue;
          L.tiles.visible = visible;
          if (!visible) continue;
        }
      }
      if (!visible) return;
      const col = new THREE.Color();
      for (let si = 0; si < 8; si++) {
        for (let li = 1; li <= 8; li++) {
          const L = stacks[si].layers[li];
          const tm = L.tiles;
          const off = (li - 1) * 64;
          for (let i = 0; i < 64; i++) {
            const t = layout(si, li - 1, i, off + i);
            col.setRGB(t.r, t.g, t.b);
            tm.setColorAt(i, col);
            tm.glow.setXYZW(i, t.gr, t.gg, t.gb, t.ga * glow);
          }
          tm.instanceColor.needsUpdate = true;
          tm.glow.needsUpdate = true;
        }
      }
    },

    // 晶粒顶面的发光：fn(region, cell) → [r,g,b,a]
    setActivation(fn) {
      for (const D of ['A', 'B']) {
        const { im, map } = dieCells[D];
        const a = im.glow.array;
        for (let i = 0; i < map.length; i++) {
          const c = map[i];
          const g = fn(regions[c.r], c);
          a[i * 4] = g[0]; a[i * 4 + 1] = g[1]; a[i * 4 + 2] = g[2]; a[i * 4 + 3] = g[3];
        }
        im.glow.needsUpdate = true;
      }
    },

    clearHighlight() {
      for (const k in parts) for (const m of parts[k].mats) m.emissiveIntensity = 0;
    },
    highlight(id, v, col = 0xffffff) {
      const nd = parts[id];
      if (!nd) return;
      for (const m of nd.mats) { m.emissive.set(col); m.emissiveIntensity = v; }
    },

    // 脉冲路径（挂接到部件的当前位置）
    pathHBMtoCompute(si, opts = {}) {
      const [sx, sz] = STACK_POS[si];
      const nd = stacks[si];
      const die = STACK_DIE[si] === 0 ? parts.dieA : parts.dieB;
      const sgnZ = STACK_DIE[si] === 0 ? -1 : 1;
      const sgnX = Math.sign(sx);
      const ip = parts.interposer.w;
      const yTop = DIM.ip.y1 + ip.y + .03;
      const li = opts.layer ?? 4 + (si % 4);
      const L = nd.layers[li];
      const lx = opts.lx ?? 0, lz = opts.lz ?? 0;
      const base = nd.layers[0];
      const dy = DIM.die.y0 + DIM.die.h + die.w.y + .05;
      const r = opts.gpc ?? ((si % 4));
      const gpc = regionById[`${STACK_DIE[si] === 0 ? 'A' : 'B'}.gpc${clamp(r, 0, 4)}`];
      return new PolyPath([
        [sx + nd.w.x + lx, L.y1 + L.w.y + .02, sz + lz],
        [sx + nd.w.x + lx, base.y0 + base.w.y, sz + lz],
        [sx + nd.w.x + lx, yTop, sz + lz],
        [sgnX * 15.4, yTop, sz + lz * .8],
        [sgnX * 16.1, dy, sz + lz * .6 + die.w.z],
        [sgnX * 11, dy, sgnZ * 4.1 + die.w.z],
        [gpc.cx, dy, sgnZ * 6.6 + die.w.z],
        [gpc.cx, dy, gpc.cz + die.w.z + (opts.gz ?? 0) * sgnZ],
      ]);
    },
    pathCross(k, n = 28) {
      // k∈[0,n) 跨缝一路
      const x = -14.6 + (k + .5) / n * 29.2;
      const yA = DIM.die.y0 + DIM.die.h + parts.dieA.w.y + .05;
      const yB = DIM.die.y0 + DIM.die.h + parts.dieB.w.y + .05;
      const a = parts.dieA.w.z, b = parts.dieB.w.z;
      return new PolyPath([[x, yA, -5.4 + a], [x, yA, -1.4 + a], [x, yA, -.2 + a], [x, yB, .2 + b], [x, yB, 1.4 + b], [x, yB, 5.4 + b]]);
    },
    pathNVLink(die, k) {
      const sign = die === 'A' ? -1 : 1;
      const nd = die === 'A' ? parts.dieA : parts.dieB;
      const x = -14 + (k + .5) / 9 * 28;
      const y = DIM.die.y0 + DIM.die.h + nd.w.y + .05;
      const s = parts.substrate.w;
      return new PolyPath([[x, y, sign * 16 + nd.w.z], [x, y, sign * 23.2 + nd.w.z], [x, y, sign * 24.9 + nd.w.z], [x * 1.2, DIM.sub.y1 + s.y + .1, sign * 33], [x * 1.45, DIM.sub.y1 + s.y + .1, sign * 41.5]]);
    },
  };
  const PART_CENTER = {
    balls: [0, .3, 0], substrate: [0, 1.6, 0], decaps: [0, 3.2, 28], stiffener: [0, 3.4, 36], c4: [0, 2.85, 0], interposer: [0, 3.25, 0], ubumps: [0, 3.58, 0],
    dieA: [0, 4.05, -12.5], dieB: [0, 4.05, 12.5],
  };
  const PART_RADIUS = { balls: 62, substrate: 62, decaps: 48, stiffener: 62, c4: 40, interposer: 40, ubumps: 34, dieA: 21, dieB: 21 };
  return pkg;
}

export function rayBox(o, d, b) {
  let t0 = 0, t1 = Infinity;
  for (const [oc, dc, lo, hi] of [[o.x, d.x, b.x0, b.x1], [o.y, d.y, b.y0, b.y1], [o.z, d.z, b.z0, b.z1]]) {
    if (Math.abs(dc) < 1e-9) { if (oc < lo || oc > hi) return null; continue; }
    let a = (lo - oc) / dc, c = (hi - oc) / dc;
    if (a > c) { const s = a; a = c; c = s; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    if (t0 > t1) return null;
  }
  return t0;
}

// 截面盖：与实体清单同源的实心截面，按材料着色并带剖面线
export const SECTION_COL = {
  mask: [.05, .25, .19], laminate: [.09, .32, .24], core: [.55, .5, .32], steel: [.72, .75, .8], rdl: [.26, .3, .38], bridge: [.48, .56, .74],
  interposer: [.16, .2, .3], silicon: [.5, .56, .68], hbmBase: [.3, .36, .46], dram: [.42, .5, .62], hbmTop: [.12, .13, .15], solder: [.85, .87, .9], copper: [.95, .55, .28],
};
export const MAT_NAME = {
  mask: '阻焊', laminate: '积层介质', core: '玻纤芯板', steel: '不锈钢', rdl: 'RDL 介质', bridge: '硅桥', interposer: 'RDL 顶层', silicon: '硅', hbmBase: '基底硅', dram: 'DRAM 硅', hbmTop: '顶盖', solder: '焊料', copper: '铜',
};

export class SectionCaps {
  constructor(cap = 9000) {
    this.cap = cap;
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    this.P = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); // a0,y0,a1,y1
    this.C = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); // rgb + shape
    this.P.setUsage(THREE.DynamicDrawUsage); this.C.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aRect', this.P); g.setAttribute('aCol', this.C);
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uAxis: { value: 0 }, uPos: { value: 0 }, uTime: { value: 0 } },
      vertexShader: /* glsl */`
        attribute vec4 aRect; attribute vec4 aCol; uniform float uAxis,uPos;
        varying vec2 vUvR; varying vec3 vC; varying float vS; varying vec2 vW; varying vec2 vSize;
        void main(){
          vec2 uvv=position.xy+.5;
          float a=mix(aRect.x,aRect.z,uvv.x), y=mix(aRect.y,aRect.w,uvv.y);
          vec3 P= uAxis<.5 ? vec3(uPos,y,a) : vec3(a,y,uPos);
          vUvR=uvv; vC=aCol.rgb; vS=aCol.a; vW=vec2(a,y); vSize=vec2(aRect.z-aRect.x,aRect.w-aRect.y);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(P,1.);
        }`,
      fragmentShader: /* glsl */`
        varying vec2 vUvR; varying vec3 vC; varying float vS; varying vec2 vW; varying vec2 vSize;
        void main(){
          vec2 d=abs(vUvR-.5)*2.;
          if(vS>.5 && dot(d,d)>1.) discard;
          float px=fwidth(vUvR.x)*2.+fwidth(vUvR.y)*2.;
          float hatch=smoothstep(.45,.5,abs(fract((vW.x+vW.y*1.0)*2.4)-.5));
          vec2 e=(1.-d)*vSize*.5;
          float edge=smoothstep(0.,.05,min(e.x,e.y));
          vec3 c=vC*(.82+.18*hatch)*mix(.35,1.,edge);
          // 截面自发一点光，保证在阴影里也能读
          gl_FragColor=vec4(c*1.25,1.);
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.g = g;
    this.mesh.visible = false;
  }
  update(rects, axis, pos) {
    const n = Math.min(rects.length, this.cap);
    const P = this.P.array, C = this.C.array;
    for (let i = 0; i < n; i++) {
      const r = rects[i];
      P[i * 4] = r.a0; P[i * 4 + 1] = r.y0; P[i * 4 + 2] = r.a1; P[i * 4 + 3] = r.y1;
      const c = SECTION_COL[r.mat] || [.5, .5, .5];
      C[i * 4] = c[0]; C[i * 4 + 1] = c[1]; C[i * 4 + 2] = c[2]; C[i * 4 + 3] = r.shape ? 1 : 0;
    }
    this.g.instanceCount = n;
    this.P.needsUpdate = this.C.needsUpdate = true;
    this.P.clearUpdateRanges?.(); this.C.clearUpdateRanges?.();
    this.mat.uniforms.uAxis.value = axis === 'x' ? 0 : 1;
    this.mat.uniforms.uPos.value = pos;
    this.mesh.visible = n > 0;
  }
}
