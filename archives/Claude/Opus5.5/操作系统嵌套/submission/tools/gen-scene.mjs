import { fileURLToPath } from 'node:url';
// 生成三维场景资源（数据，不含代码）：system/common/Demo/helicopter-24.scene 与 minimal.scene
// 场景包括：几何（含参数化机身网格）、材质与程序化贴图、灯光、环境、镜头、部件层级、
// 物理参数（地形、停机坪、障碍）与飞行记录（默认演出由 tools/gen-show.mjs 写入）。
import fs from 'node:fs';
import path from 'node:path';

const R3 = (v) => Math.round(v * 1000) / 1000;
let seed = 2024;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// ---------- 地形（与飞行模型、显示设备同一公式） ----------
export const TERRAIN = {
  size: 900, seg: 180, base: 0,
  waves: [[6.5, 0.011, 0.007, 0.4], [4.2, -0.006, 0.014, 1.9], [2.2, 0.021, 0.017, 2.7], [1.1, 0.043, -0.031, 0.8], [0.55, -0.07, 0.083, 4.1], [9, 0.0042, -0.0035, 5.2]],
  flats: [[0, 0, 34, 2.0, 26], [150, -64, 18, 14.0, 30], [-36, 22, 26, 2.0, 18]],
};
export function smooth01(x) { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); }
export function terrainH(x, z) {
  let h = TERRAIN.base;
  for (const w of TERRAIN.waves) h += w[0] * Math.sin(w[1] * x + w[2] * z + w[3]);
  for (const f of TERRAIN.flats) {
    const d = Math.hypot(x - f[0], z - f[1]);
    const k = 1 - smooth01((d - f[2]) / f[4]);
    if (k > 0) h = h * (1 - k) + f[3] * k;
  }
  return h;
}

// ---------- 网格工具 ----------
function meshBuilder() {
  const pos = [], nrm = [], uv = [], idx = [];
  return {
    pos, nrm, uv, idx,
    v(p, n, t) { pos.push(R3(p[0]), R3(p[1]), R3(p[2])); nrm.push(R3(n[0]), R3(n[1]), R3(n[2])); uv.push(R3(t[0]), R3(t[1])); return pos.length / 3 - 1; },
    out() { return { type: 'mesh', pos, nrm, uv, idx }; },
  };
}
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

// 机身：沿 x 轴的参数化“豆荚”，截面为椭圆。u 沿长度（机头→机尾），v 绕周向（顶 0，右 0.25，底 0.5，左 0.75）
function fuselage() {
  const NU = 44, NV = 28;
  const x0 = 2.55, x1 = -1.75;
  const prof = (u) => {
    // 半宽、半高、中心高度
    const nose = Math.min(1, Math.sqrt(u / 0.16));
    const tail = u > 0.62 ? 1 - smooth01((u - 0.62) / 0.38) * 0.72 : 1;
    const w = 0.86 * nose * tail * (1 - 0.06 * Math.sin(u * 7));
    const hgt = 0.98 * Math.min(1, Math.sqrt(u / 0.12)) * (u > 0.58 ? 1 - smooth01((u - 0.58) / 0.42) * 0.68 : 1);
    const c = -0.05 + (u > 0.55 ? smooth01((u - 0.55) / 0.45) * 0.38 : 0) - (u < 0.2 ? (0.2 - u) * 0.6 : 0);
    return [w, hgt, c];
  };
  const P = (u, v) => {
    const [w, hh, c] = prof(u);
    const th = v * Math.PI * 2;
    // 机腹略平
    const cy = Math.cos(th), sz = Math.sin(th);
    const flat = cy < 0 ? 0.78 : 1;
    return [x0 + (x1 - x0) * u, c + hh * cy * flat, w * sz];
  };
  const m = meshBuilder();
  const grid = [];
  for (let i = 0; i <= NU; i++) {
    const u = Math.pow(i / NU, 1.0); const row = [];
    for (let j = 0; j <= NV; j++) {
      const v = j / NV;
      const p = P(u, v);
      const du = 0.003, dv = 0.003;
      const pu = P(Math.min(1, u + du), v), pu0 = P(Math.max(0.0001, u - du), v);
      const pv = P(u, v + dv), pv0 = P(u, v - dv);
      const tu = [pu[0] - pu0[0], pu[1] - pu0[1], pu[2] - pu0[2]];
      const tv = [pv[0] - pv0[0], pv[1] - pv0[1], pv[2] - pv0[2]];
      let n = norm([tu[1] * tv[2] - tu[2] * tv[1], tu[2] * tv[0] - tu[0] * tv[2], tu[0] * tv[1] - tu[1] * tv[0]]);
      if (i === 0) n = [1, 0, 0];
      row.push(m.v(p, n, [u, 1 - v]));
    }
    grid.push(row);
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = grid[i][j], b = grid[i + 1][j], c = grid[i + 1][j + 1], d = grid[i][j + 1];
    m.idx.push(a, b, d, b, c, d);
  }
  // 机尾端盖
  const ce = m.v([x1, prof(1)[2], 0], [-1, 0, 0], [1, 0.5]);
  for (let j = 0; j < NV; j++) m.idx.push(grid[NU][j + 1], grid[NU][j], ce);
  return m.out();
}

// 座舱玻璃：机头上方的前半椭球罩
function canopy() {
  const m = meshBuilder(); const NT = 14, NP = 24; const grid = [];
  const rx = 1.05, ry = 0.66, rz = 0.8;
  for (let i = 0; i <= NT; i++) {
    const th = (i / NT) * Math.PI / 2; const row = [];
    for (let j = 0; j <= NP; j++) {
      const ph = -Math.PI / 2 + (j / NP) * Math.PI;
      const x = rx * Math.cos(th) * Math.cos(ph), y = ry * Math.sin(th), z = rz * Math.cos(th) * Math.sin(ph);
      row.push(m.v([x, y, z], norm([x / (rx * rx), y / (ry * ry), z / (rz * rz)]), [j / NP, i / NT]));
    }
    grid.push(row);
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NP; j++) { const a = grid[i][j], b = grid[i + 1][j], c = grid[i + 1][j + 1], d = grid[i][j + 1]; m.idx.push(a, d, b, b, d, c); }
  return m.out();
}

// 环形远山
function mountains() {
  const m = meshBuilder(); const N = 160; const ring = [];
  seed = 77;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const h = 60 + 70 * Math.abs(Math.sin(a * 3.1 + 0.7)) + 45 * Math.abs(Math.sin(a * 7.3)) + 30 * rnd();
    const r = 1150;
    const top = [Math.cos(a) * r, h, Math.sin(a) * r], bot = [Math.cos(a) * (r - 40), -30, Math.sin(a) * (r - 40)];
    const n = norm([-Math.cos(a), 0.6, -Math.sin(a)]);
    ring.push([m.v(bot, n, [i / N, 0]), m.v(top, n, [i / N, 1])]);
  }
  for (let i = 0; i < N; i++) { const [a, b] = ring[i], [c, d] = ring[i + 1]; m.idx.push(a, c, b, b, c, d); }
  return m.out();
}

// ---------- 贴图（绘制指令，由显示设备在画布上执行） ----------
const PURPLE = '#6a2fa8', PURPLE_D = '#46207a', YELLOW = '#ffcc1a';
const livery = {
  w: 1024, h: 512,
  draw: [
    ['fill', PURPLE],
    ['grad', 0, 0, 0, 512, [[0, '#6c35a6'], [0.45, PURPLE], [0.5, PURPLE_D], [0.55, PURPLE], [1, '#6c35a6']]],
    // 左侧（上半）与右侧（下半，旋转 180°）的黄色腰线
    ['rect', 0, 150, 1024, 26, YELLOW], ['rect', 0, 182, 1024, 6, YELLOW],
    ['rect', 0, 336, 1024, 26, YELLOW], ['rect', 0, 324, 1024, 6, YELLOW],
    // 机头黄色警示块
    ['rect', 0, 0, 70, 512, YELLOW],
    ['rect', 70, 0, 14, 512, '#1a0d2a'],
    // 座舱侧窗（深色玻璃）
    ['rrect', 120, 34, 210, 70, 18, '#0d1626'], ['rrect', 120, 408, 210, 70, 18, '#0d1626'],
    ['rrect', 352, 44, 120, 56, 12, '#0d1626'], ['rrect', 352, 412, 120, 56, 12, '#0d1626'],
    // 数字 24：左侧正写，右侧旋转 180°，使两侧都能正读
    ['text', '24', 640, 110, 120, YELLOW, 900, 'Segoe UI', 0, '#1a0d2a', 6],
    ['text', '24', 640, 402, 120, YELLOW, 900, 'Segoe UI', 180, '#1a0d2a', 6],
    // 呼号小字
    ['text', 'NEST-24', 860, 200, 26, '#ffffff', 700, 'Segoe UI', 0],
    ['text', 'NEST-24', 860, 312, 26, '#ffffff', 700, 'Segoe UI', 180],
    ['noise', 0.05, 11],
  ],
};
const boomTex = { w: 256, h: 64, draw: [['fill', PURPLE], ['rect', 0, 12, 256, 8, YELLOW], ['rect', 0, 44, 256, 8, YELLOW], ['rect', 200, 0, 56, 64, YELLOW], ['noise', 0.04, 3]] };
const padTex = { w: 512, h: 512, draw: [['fill', '#6b6e72'], ['noise', 0.18, 5], ['circle', 256, 256, 236, '#f6c51b'], ['circle', 256, 256, 214, '#5d6064'], ['noise', 0.12, 6],
  ['rect', 150, 130, 50, 252, '#f4f4f4'], ['rect', 312, 130, 50, 252, '#f4f4f4'], ['rect', 150, 231, 212, 50, '#f4f4f4']] };
const padTexB = { w: 512, h: 512, draw: [['fill', '#6b6e72'], ['noise', 0.18, 8], ['circle', 256, 256, 236, '#ffffff'], ['circle', 256, 256, 218, '#5d6064'], ['noise', 0.12, 9],
  ['rect', 150, 130, 50, 252, '#f6c51b'], ['rect', 312, 130, 50, 252, '#f6c51b'], ['rect', 150, 231, 212, 50, '#f6c51b'], ['text', 'B', 440, 470, 64, '#ffffff', 900, 'Segoe UI', 0]] };
const concrete = { w: 256, h: 256, draw: [['fill', '#8d8f8f'], ['noise', 0.22, 21], ['lines', 64, '#7a7c7c']] };
const hangarTex = { w: 512, h: 256, draw: [['fill', '#a9b3bd'], ['stripes', 16, '#98a2ac'], ['rect', 0, 200, 512, 56, '#6c757d'], ['text', 'HANGAR 2', 256, 60, 44, '#30363d', 800, 'Segoe UI', 0], ['noise', 0.08, 31]] };
const towerTex = { w: 256, h: 256, draw: [['fill', '#d9d4c7'], ['stripes', 8, '#cfc9bb'], ['rect', 0, 0, 256, 30, '#b6402f'], ['noise', 0.06, 41]] };
const grassTex = { w: 256, h: 256, draw: [['fill', '#6d8f3c'], ['noise', 0.35, 51]] };
const bark = { w: 64, h: 128, draw: [['fill', '#5a4030'], ['stripes', 6, '#4a3326'], ['noise', 0.2, 61]] };

// ---------- 场景 ----------
export function buildScene() {
  seed = 2024;
  const padA = { id: 'A', x: 0, z: 0, r: 8.5, top: TERRAIN.flats[0][3] + 0.42 };
  const padB = { id: 'B', x: 150, z: -64, r: 8.5, top: TERRAIN.flats[1][3] + 0.42 };
  const objects = [];
  const boxes = []; const cyls = [];
  const addBox = (id, mat, x, z, sx, sy, sz, label, y0) => {
    const base = y0 != null ? y0 : terrainH(x, z) - 0.5;
    objects.push({ id, geo: { type: 'box', w: sx * 2, h: sy * 2, d: sz * 2 }, mat, pos: [x, base + sy, z], cast: true, receive: true, label });
    boxes.push({ name: label, x, y: base + sy, z, sx, sy, sz });
  };
  // 停机坪
  objects.push({ id: 'padA', geo: { type: 'cyl', rt: padA.r, rb: padA.r + 0.4, h: 1.2, seg: 48 }, mat: 'concrete', pos: [padA.x, padA.top - 0.6, padA.z], receive: true, cast: false, label: '停机坪 A' });
  objects.push({ id: 'padA-mark', geo: { type: 'disc', r: padA.r - 0.3, seg: 48 }, mat: 'padA', pos: [padA.x, padA.top + 0.02, padA.z], rot: [-90, 0, 0], receive: true, label: '停机坪 A' });
  objects.push({ id: 'padB', geo: { type: 'cyl', rt: padB.r, rb: padB.r + 0.4, h: 1.2, seg: 48 }, mat: 'concrete', pos: [padB.x, padB.top - 0.6, padB.z], receive: true, cast: false, label: '停机坪 B' });
  objects.push({ id: 'padB-mark', geo: { type: 'disc', r: padB.r - 0.3, seg: 48 }, mat: 'padB', pos: [padB.x, padB.top + 0.02, padB.z], rot: [-90, 0, 0], receive: true, label: '停机坪 B' });
  // 机库与建筑群
  addBox('hangar', 'hangar', -38, 24, 13, 5.5, 9, '机库');
  objects.push({ id: 'hangar-roof', geo: { type: 'cyl', rt: 9, rb: 9, h: 26, seg: 24, axis: 'x', half: true }, mat: 'roof', pos: [-38, terrainH(-38, 24) - 0.5 + 11, 24], cast: true, receive: true, label: '机库' });
  addBox('office', 'office', -18, 40, 6, 3.5, 5, '调度楼');
  addBox('store', 'office', -60, 4, 5, 2.5, 7, '仓库');
  addBox('fuel-shed', 'hangar', 24, 30, 4, 2.2, 3, '油料间');
  // 塔台
  const tx = 26, tz = -22, tb = terrainH(tx, tz) - 0.3;
  objects.push({ id: 'tower', geo: { type: 'cyl', rt: 1.6, rb: 2.1, h: 18, seg: 20 }, mat: 'tower', pos: [tx, tb + 9, tz], cast: true, receive: true, label: '塔台' });
  objects.push({ id: 'tower-cab', geo: { type: 'cyl', rt: 3.6, rb: 3.0, h: 3.2, seg: 8 }, mat: 'glass', pos: [tx, tb + 19.6, tz], cast: true, label: '塔台' });
  objects.push({ id: 'tower-roof', geo: { type: 'cyl', rt: 0.4, rb: 4.0, h: 1.4, seg: 8 }, mat: 'roofRed', pos: [tx, tb + 21.9, tz], cast: true, label: '塔台' });
  cyls.push({ name: '塔台', x: tx, z: tz, r: 3.4, h: 23, base: tb });
  // 油罐
  for (const [i, [x, z]] of [[34, 38], [40, 33], [30, 44]].entries()) {
    const b = terrainH(x, z) - 0.3;
    objects.push({ id: 'tank' + i, geo: { type: 'cyl', rt: 2.4, rb: 2.4, h: 4.6, seg: 24 }, mat: 'tank', pos: [x, b + 2.3, z], cast: true, receive: true, label: '油罐' });
    cyls.push({ name: '油罐', x, z, r: 2.4, h: 4.6, base: b });
  }
  // 风向袋
  const wx = 14, wz = 12, wb = terrainH(wx, wz);
  objects.push({ id: 'sock-pole', geo: { type: 'cyl', rt: 0.06, rb: 0.08, h: 7, seg: 8 }, mat: 'metal', pos: [wx, wb + 3.5, wz], cast: true, label: '风向袋' });
  objects.push({ id: 'sock', geo: { type: 'cyl', rt: 0.15, rb: 0.42, h: 2.2, seg: 12, axis: 'x' }, mat: 'sock', pos: [wx + 1.1, wb + 6.6, wz], cast: true, label: '风向袋', windsock: true });
  // 灯杆
  for (const [x, z] of [[11, -9], [-11, -9], [11, 10], [-11, 10], [157, -55], [143, -73]]) {
    const b = terrainH(x, z);
    objects.push({ id: `lamp${x}_${z}`, geo: { type: 'cyl', rt: 0.07, rb: 0.1, h: 5, seg: 6 }, mat: 'metal', pos: [x, b + 2.5, z], cast: true, label: '灯杆' });
    objects.push({ id: `lampH${x}_${z}`, geo: { type: 'sphere', r: 0.22 }, mat: 'lampGlow', pos: [x, b + 5.1, z], label: '灯杆' });
  }
  // 树木（实例化）；避开停机坪、建筑与航线附近
  const trees = [];
  const avoid = [[0, 0, 40], [150, -64, 26], [-38, 24, 26], [-18, 40, 12], [26, -22, 10], [34, 38, 12], [-60, 4, 12], [24, 30, 8]];
  for (let i = 0; trees.length < 900 && i < 20000; i++) {
    const x = (rnd() - 0.5) * 760, z = (rnd() - 0.5) * 760;
    if (avoid.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r)) continue;
    // 成片分布：用低频噪声控制密度
    const dens = 0.5 + 0.5 * Math.sin(x * 0.018 + 1.3) * Math.cos(z * 0.021 - 0.4);
    if (rnd() > dens * 0.95) continue;
    const s = 0.75 + rnd() * 0.8;
    trees.push([R3(x), R3(terrainH(x, z) - 0.2), R3(z), R3(rnd() * 6.283), R3(s)]);
  }
  // 树木的空间网格（飞行模型只检查附近的树）
  const cell = 20; const cells = {};
  trees.forEach((t, i) => {
    const cx = Math.floor(t[0] / cell), cz = Math.floor(t[2] / cell);
    (cells[`${cx},${cz}`] ||= []).push(i);
  });
  const rocks = [];
  for (let i = 0; rocks.length < 160 && i < 5000; i++) {
    const x = (rnd() - 0.5) * 700, z = (rnd() - 0.5) * 700;
    if (avoid.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r)) continue;
    rocks.push([R3(x), R3(terrainH(x, z) + 0.1), R3(z), R3(rnd() * 6.283), R3(0.5 + rnd() * 1.8)]);
  }

  // ---------- 直升机部件层级（机体坐标：+x 机头，+y 上，+z 右侧） ----------
  const parts = [
    { id: 'heli', parent: null, label: '直升机 24' },
    { id: 'fuselage', parent: 'heli', geo: 'fuselage', mat: 'body', cast: true, receive: true, label: '机身', pick: { r: 1.4, at: [0.4, 0, 0] } },
    { id: 'canopy', parent: 'heli', geo: 'canopy', mat: 'glass', pos: [1.2, 0.12, 0], scale: [1.15, 1, 1], cast: true, label: '座舱', pick: { r: 0.8, at: [1.6, 0.4, 0] } },
    { id: 'cowl', parent: 'heli', geo: { type: 'box', w: 1.9, h: 0.5, d: 0.95, bevel: 0.2 }, mat: 'body2', pos: [-0.2, 0.98, 0], cast: true, label: '发动机舱', pick: { r: 0.7, at: [-0.2, 1.0, 0] } },
    { id: 'exhaust', parent: 'heli', geo: { type: 'cyl', rt: 0.16, rb: 0.2, h: 0.5, seg: 12, axis: 'x' }, mat: 'metalDark', pos: [-1.25, 0.95, 0.25], cast: true, label: '排气管' },
    { id: 'mast', parent: 'heli', geo: { type: 'cyl', rt: 0.09, rb: 0.12, h: 0.55, seg: 10 }, mat: 'metalDark', pos: [0.05, 1.4, 0], cast: true, label: '旋翼轴' },
    { id: 'rotor', parent: 'heli', pos: [0.05, 1.72, 0], spin: { axis: 'y', source: 'rot' }, label: '主旋翼' },
    { id: 'hub', parent: 'rotor', geo: { type: 'cyl', rt: 0.26, rb: 0.3, h: 0.22, seg: 14 }, mat: 'metalDark', cast: true, label: '旋翼毂', pick: { r: 0.4, at: [0, 0, 0] } },
    ...[0, 1, 2, 3].map((i) => ({ id: 'blade' + (i + 1), parent: 'rotor', geo: 'blade', mat: 'blade', pos: [2.75 * Math.cos(i * Math.PI / 2), 0.02, -2.75 * Math.sin(i * Math.PI / 2)].map(R3), rot: [0, i * 90, 4], cast: true, label: `主旋翼桨叶 ${i + 1}`, pick: { r: 0.6, at: [0, 0, 0] } })),
    ...[0, 1, 2, 3].map((i) => ({ id: 'tip' + (i + 1), parent: 'blade' + (i + 1), geo: { type: 'box', w: 0.42, h: 0.05, d: 0.33 }, mat: 'yellow', pos: [2.42, 0, 0], label: `桨尖 ${i + 1}` })),
    { id: 'disc', parent: 'rotor', geo: { type: 'disc', r: 5.25, seg: 64 }, mat: 'rotorBlur', rot: [-90, 0, 0], pos: [0, 0.03, 0], blurOf: 'rot', label: '旋翼' },
    { id: 'tailboom', parent: 'heli', geo: { type: 'cyl', rt: 0.13, rb: 0.3, h: 4.6, seg: 14, axis: 'x', flip: true }, mat: 'boom', pos: [-3.85, 0.33, 0], cast: true, label: '尾梁', pick: { r: 0.5, at: [-2.3, 0, 0], len: 2.3 } },
    { id: 'fin', parent: 'tailboom', geo: { type: 'box', w: 1.0, h: 1.45, d: 0.1, bevel: 0.04 }, mat: 'body2', pos: [-2.25, 0.62, 0], rot: [0, 0, -18], cast: true, label: '垂直尾翼', pick: { r: 0.6, at: [0, 0, 0] } },
    { id: 'finTip', parent: 'fin', geo: { type: 'box', w: 0.5, h: 0.3, d: 0.11 }, mat: 'yellow', pos: [0.15, 0.62, 0], label: '尾翼尖' },
    { id: 'hstab', parent: 'tailboom', geo: { type: 'box', w: 0.7, h: 0.06, d: 2.1 }, mat: 'body2', pos: [-1.45, 0.02, 0], cast: true, label: '水平尾翼' },
    { id: 'trotor', parent: 'tailboom', pos: [-2.42, 0.62, 0.22], spin: { axis: 'z', source: 'trot' }, label: '尾桨' },
    { id: 'tblade1', parent: 'trotor', geo: { type: 'box', w: 0.16, h: 1.3, d: 0.03 }, mat: 'blade', cast: true, label: '尾桨桨叶', pick: { r: 0.6, at: [0, 0, 0] } },
    { id: 'tblade2', parent: 'trotor', geo: { type: 'box', w: 1.3, h: 0.16, d: 0.03 }, mat: 'blade', cast: true, label: '尾桨桨叶' },
    { id: 'tdisc', parent: 'trotor', geo: { type: 'disc', r: 0.68, seg: 32 }, mat: 'rotorBlur', blurOf: 'trot', pos: [0, 0, 0.02], label: '尾桨' },
    { id: 'skidL', parent: 'heli', geo: { type: 'cyl', rt: 0.06, rb: 0.06, h: 3.0, seg: 10, axis: 'x' }, mat: 'metal', pos: [0.15, -1.14, -0.84], cast: true, label: '左起落架滑橇', pick: { r: 0.5, at: [0, 0, 0], len: 1.5 } },
    { id: 'skidR', parent: 'heli', geo: { type: 'cyl', rt: 0.06, rb: 0.06, h: 3.0, seg: 10, axis: 'x' }, mat: 'metal', pos: [0.15, -1.14, 0.84], cast: true, label: '右起落架滑橇', pick: { r: 0.5, at: [0, 0, 0], len: 1.5 } },
    ...[[0.8, -0.84], [-0.6, -0.84], [0.8, 0.84], [-0.6, 0.84]].map(([x, z], i) => ({ id: 'strut' + i, parent: 'heli', geo: { type: 'cyl', rt: 0.045, rb: 0.045, h: 0.7, seg: 8 }, mat: 'metal', pos: [x, -0.82, z * 0.82], rot: [z > 0 ? -16 : 16, 0, 0], cast: true, label: '起落架支柱' })),
    { id: 'door', parent: 'heli', geo: { type: 'box', w: 0.9, h: 0.75, d: 0.05, bevel: 0.03 }, mat: 'body', pos: [0.45, -0.05, 0.86], cast: true, label: '舱门', pick: { r: 0.5, at: [0, 0, 0] } },
    { id: 'navR', parent: 'heli', geo: { type: 'sphere', r: 0.07 }, mat: 'navGreen', pos: [-0.2, 0.2, 0.86], label: '航行灯' },
    { id: 'navL', parent: 'heli', geo: { type: 'sphere', r: 0.07 }, mat: 'navRed', pos: [-0.2, 0.2, -0.86], label: '航行灯' },
    { id: 'beacon', parent: 'heli', geo: { type: 'sphere', r: 0.08 }, mat: 'beacon', pos: [-0.8, 1.25, 0], label: '防撞灯', blink: 1.1 },
    // 撞击后才出现的碎块（有厚度的部件）
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: 'chunk' + i, parent: 'heli', geo: { type: 'box', w: 0.3 + (i % 3) * 0.12, h: 0.12 + (i % 2) * 0.06, d: 0.26 + (i % 2) * 0.1, bevel: 0.02 }, mat: i % 2 ? 'body' : 'yellowPaint', pos: [0.3 - i * 0.35, 0.2, (i % 2 ? 0.5 : -0.5)], hidden: true, cast: true, label: '碎片', pick: { r: 0.4, at: [0, 0, 0] } })),
  ];
  const hub = [0.05, 1.72, 0];
  const debris = [
    ...[1, 2, 3, 4].map((i) => ({ id: 'blade' + i, local: hub, r: 0.12, blade: true, burst: 3 })),
    { id: 'tailboom', local: [-3.85, 0.33, 0], r: 0.35, burst: 3 },
    { id: 'skidR', local: [0.15, -1.14, 0.84], r: 0.08, burst: 4 },
    { id: 'door', local: [0.45, -0.05, 0.9], r: 0.08, burst: 6 },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: 'chunk' + i, local: [0.3 - i * 0.35, 0.2, (i % 2 ? 0.5 : -0.5)], r: 0.1, burst: 7 })),
  ];

  const scene = {
    format: 'nest-scene', version: 1, name: '24 号直升机 · 黄昏机场',
    description: '紫黄配色的 24 号直升机：默认演出（起飞、前飞转向、故障失控、坠毁与余波）与飞行排演。',
    fps: 60, duration: 15,
    environment: {
      time: '17:40', weather: '晴，西南风 3 级',
      sky: { top: '#2f5ba8', horizon: '#f3b07a', ground: '#3e3a33', sunGlow: '#ffd59a' },
      sun: { dir: [-0.62, 0.36, 0.72], color: '#ffd6a8', intensity: 3.8, shadow: { size: 4096, area: 46, far: 260 } },
      ambient: { sky: '#a9c4ee', ground: '#7a5f3e', intensity: 1.25 },
      fog: { color: '#e5b88f', near: 140, far: 1150 },
      exposure: 1.0,
    },
    textures: { livery, boom: boomTex, padA: padTex, padB: padTexB, concrete, hangar: hangarTex, tower: towerTex, grass: grassTex, bark },
    materials: {
      body: { color: '#ffffff', map: 'livery', rough: 0.3, metal: 0.15, clearcoat: 0.7 },
      body2: { color: '#5a2a8c', rough: 0.38, metal: 0.2 },
      boom: { color: '#ffffff', map: 'boom', rough: 0.38, metal: 0.2 },
      yellow: { color: '#f6c51b', rough: 0.4, metal: 0.1 },
      yellowPaint: { color: '#f6c51b', rough: 0.5, metal: 0.1 },
      glass: { color: '#16263d', rough: 0.05, metal: 0.6, opacity: 0.82, envBoost: 1.6 },
      blade: { color: '#22252b', rough: 0.55, metal: 0.3 },
      rotorBlur: { color: '#2a2d33', rough: 0.9, metal: 0, opacity: 0, transparent: true, depthWrite: false, side: 'double' },
      metal: { color: '#9aa3ad', rough: 0.35, metal: 0.85 },
      metalDark: { color: '#3b4048', rough: 0.4, metal: 0.8 },
      navGreen: { color: '#22ff66', emissive: '#22ff66', emissiveIntensity: 2.5 },
      navRed: { color: '#ff2a2a', emissive: '#ff2a2a', emissiveIntensity: 2.5 },
      beacon: { color: '#ff4422', emissive: '#ff3311', emissiveIntensity: 3.5 },
      concrete: { color: '#ffffff', map: 'concrete', rough: 0.92, metal: 0, repeat: [3, 3] },
      padA: { color: '#ffffff', map: 'padA', rough: 0.85, metal: 0 },
      padB: { color: '#ffffff', map: 'padB', rough: 0.85, metal: 0 },
      hangar: { color: '#ffffff', map: 'hangar', rough: 0.7, metal: 0.3 },
      office: { color: '#c9c2b4', rough: 0.85, metal: 0 },
      roof: { color: '#7c8792', rough: 0.45, metal: 0.65 },
      roofRed: { color: '#a8382a', rough: 0.6, metal: 0.2 },
      tower: { color: '#ffffff', map: 'tower', rough: 0.8, metal: 0 },
      tank: { color: '#d8dde2', rough: 0.3, metal: 0.75 },
      sock: { color: '#ff5a1f', rough: 0.8, metal: 0, side: 'double' },
      lampGlow: { color: '#fff2c4', emissive: '#ffd98a', emissiveIntensity: 1.6 },
      trunk: { color: '#ffffff', map: 'bark', rough: 0.95, metal: 0 },
      leaves: { color: '#36592b', rough: 0.88, metal: 0 },
      leaves2: { color: '#4a6b2f', rough: 0.88, metal: 0 },
      rock: { color: '#8a8478', rough: 0.95, metal: 0, flat: true },
      mountain: { color: '#6d6f8a', rough: 1, metal: 0, fog: true },
      terrain: { color: '#ffffff', rough: 0.96, metal: 0, vertexColors: true, map: 'grass', repeat: [90, 90] },
    },
    geometries: {
      fuselage: fuselage(),
      canopy: canopy(),
      blade: { type: 'box', w: 5.1, h: 0.05, d: 0.32 },
      mountains: mountains(),
      treeTrunk: { type: 'cyl', rt: 0.16, rb: 0.26, h: 3.2, seg: 6 },
      treeCrown: { type: 'cyl', rt: 0, rb: 1.75, h: 5.4, seg: 7 },
      treeCrown2: { type: 'cyl', rt: 0, rb: 1.3, h: 3.6, seg: 7 },
      rock: { type: 'dodeca', r: 1 },
    },
    terrain: { ...TERRAIN, material: 'terrain', colors: { low: '#5c7a33', high: '#8b8a55', rock: '#7d725f', dirt: '#8a6e4b', pad: '#7a7466' } },
    objects: [...objects, { id: 'mountains', geo: 'mountains', mat: 'mountain', pos: [0, 0, 0], label: '远山' }],
    instances: [
      { id: 'trunks', geo: 'treeTrunk', mat: 'trunk', items: trees, offset: [0, 1.6, 0], cast: true, label: '树木' },
      { id: 'crowns', geo: 'treeCrown', mat: 'leaves', items: trees, offset: [0, 5.1, 0], cast: true, label: '树木' },
      { id: 'crowns2', geo: 'treeCrown2', mat: 'leaves2', items: trees, offset: [0, 7.4, 0], cast: true, label: '树木' },
      { id: 'rocks', geo: 'rock', mat: 'rock', items: rocks, offset: [0, 0, 0], cast: true, receive: true, label: '岩石' },
    ],
    grass: { count: 30000, seed: 9, areas: [[0, 0, 46], [150, -64, 30], [-36, 22, 30], [60, 40, 40], [-80, -60, 50]], height: [0.35, 0.9], colors: ['#5d7f31', '#9aa956', '#7a9a3d'], avoid: [[0, 0, 9.5], [150, -64, 9.5], [-38, 24, 16], [-18, 40, 8]] },
    parts,
    cameras: {
      // 演出镜头：[时间, 方位角°, 仰角°, 距离, 视场角°]，看向直升机（撞击后看向残骸）
      show: { keys: [[0, 205, 14, 17, 42], [2.4, 212, 12, 15, 40], [4.5, 222, 15, 20, 44], [7.0, 240, 12, 18, 42], [8.6, 228, 10, 16, 40], [10.6, 212, 13, 21, 46], [11.3, 205, 15, 26, 50], [13.5, 186, 17, 27, 48], [15, 172, 19, 26, 46]] },
      follow: { dist: 16, height: 4.5, fov: 50 },
      orbit: { dist: 22, yaw: 210, pitch: 14, fov: 48 },
    },
    fx: {
      dust: { color: '#d2b48a', maxAlt: 16, interval: 0.07, life: 2.8, size: [1.4, 5.2], count: 22 },
      smoke: { color: '#4d4743', life: 7.5, rise: 2.8, size: [2, 10], count: 10, interval: 0.09 },
      faultSmoke: { color: '#5b5652', life: 2.2, rise: 0.8, size: [0.4, 2.2], count: 4, interval: 0.05 },
      fire: { color: '#ff8a2a', life: 1.2, rise: 3.4, size: [1.2, 3.6], count: 8, interval: 0.06 },
      flash: { color: '#ffd28a', life: 1.0, size: [3, 13], count: 18 },
      sparks: { color: '#ffd166', life: 1.6, count: 40 },
    },
    physics: {
      g: 9.81, inertia: [1.0, 1.7, 1.3], thrustMax: 21.5, rpmTau: 1.3, rotorRadius: 5.25, groundEffect: 0.22,
      drag: 0.012, dragV: 0.08, obsTop: 40, angDamp: [1.3, 1.4, 1.3],
      torque: { roll: 2.4, pitch: 2.4, yaw: 2.0, mainReaction: 2.6 }, tailYawDamp: 0.35, instability: 2.4,
      skids: [[1.25, -1.2, 0.84], [-0.95, -1.2, 0.84], [1.25, -1.2, -0.84], [-0.95, -1.2, -0.84]],
      wreckPoints: [[1.6, -0.8, 0.7], [-1.2, -0.7, 0.7], [1.6, -0.8, -0.7], [-1.2, -0.7, -0.7], [0.2, 1.1, 0.5], [0.2, 1.1, -0.5], [2.4, 0, 0], [-1.7, 0.3, 0], [0.3, 0, 0.95], [0.3, 0, -0.95]],
      rotorRim: [[5.2, 1.75, 0], [-5.2, 1.75, 0], [0, 1.75, 5.2], [0, 1.75, -5.2], [3.7, 1.75, 3.7], [-3.7, 1.75, -3.7], [3.7, 1.75, -3.7], [-3.7, 1.75, 3.7]],
      bodySpheres: [[0.4, -0.1, 0, 1.05], [-3.2, 0.3, 0, 0.45], [-6.0, 0.9, 0, 0.55]],
      contact: { k: 140, c: 16, mu: 0.75, crashSpeed: 6.0, crashTilt: 0.5 },
      terrain: { base: TERRAIN.base, waves: TERRAIN.waves, flats: TERRAIN.flats },
      pads: [padA, padB], boxes, cyls, trees: 'trunks', treeGrid: { cell, cells },
      debris,
    },
    timeline: { type: 'record', record: 'show' },
    records: {},
  };
  return scene;
}

export function buildMinimal() {
  return {
    format: 'nest-scene', version: 1, name: '最小场景：一个立方体、一盏灯、一台相机',
    fps: 60, duration: 4,
    environment: { sky: { top: '#24324f', horizon: '#6b7da3', ground: '#222', sunGlow: '#ffffff' }, sun: { dir: [0.5, 0.8, 0.3], color: '#ffffff', intensity: 2.5, shadow: { size: 1024, area: 6, far: 40 } }, ambient: { sky: '#8899bb', ground: '#332211', intensity: 0.5 } },
    materials: { red: { color: '#e5484d', rough: 0.4, metal: 0.1 }, floor: { color: '#8899aa', rough: 0.9 } },
    objects: [{ id: 'floor', geo: { type: 'box', w: 8, h: 0.2, d: 8 }, mat: 'floor', pos: [0, -0.1, 0], receive: true }],
    parts: [{ id: 'cube', parent: null, geo: { type: 'box', w: 1, h: 1, d: 1 }, mat: 'red', pos: [0, 0.6, 0], cast: true, label: '立方体', pick: { r: 0.8, at: [0, 0, 0] } }],
    cameras: { show: { fixed: { pos: [3, 2.2, 3.5], look: [0, 0.5, 0], fov: 45 } }, orbit: { dist: 5, yaw: 40, pitch: 20, fov: 45 } },
    timeline: { type: 'keys', tracks: [{ part: 'cube', prop: 'rot', keys: [[0, [0, 0, 0]], [4, [0, 360, 0]]] }, { part: 'cube', prop: 'pos', keys: [[0, [0, 0.6, 0]], [2, [0, 1.6, 0]], [4, [0, 0.6, 0]]] }] },
  };
}

if (process.argv[1] && process.argv[1].endsWith('gen-scene.mjs')) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  fs.mkdirSync(path.join(root, 'system/common/Demo'), { recursive: true });
  const s = buildScene();
  fs.writeFileSync(path.join(root, 'build/scene-base.json'), JSON.stringify(s));
  fs.writeFileSync(path.join(root, 'system/common/Demo/minimal.scene'), JSON.stringify(buildMinimal(), null, 1));
  console.log('scene base', JSON.stringify(s).length, 'bytes; trees', s.physics.trees.length);
}
