// 章节配色、灯光与后处理参数：由进度连续给出。
import * as THREE from 'three';
import { at, CHAPTERS } from './timeline.js';
import { lerp, sstep, iv, pulse, clamp, smoother, DEG } from './util.js';
import { FLOOR_Y } from '../gfx/world.js';

// 每章：背景内、背景外、强调底色
const PAL = [
  ['#141920', '#05070a', '#0b0e13'],
  ['#0f1c24', '#04090d', '#0a1218'],
  ['#1c150d', '#070507', '#100c0a'],
  ['#0a1a24', '#03090e', '#071218'],
  ['#f4f0e6', '#e7e1d3', '#efeadf'],
  ['#14101f', '#06050c', '#0d0a14'],
  ['#191b20', '#08090c', '#101216'],
  ['#1a150f', '#050505', '#0d0b09'],
];
const c0 = new THREE.Color(), c1 = new THREE.Color();
const srgb2 = (hex, out) => { const n = parseInt(hex.slice(1), 16); out.setRGB((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, THREE.LinearSRGBColorSpace); return out; };

const dirCh = [
  new THREE.Vector3(-.5, 1, .55), new THREE.Vector3(-.45, 1, .35), new THREE.Vector3(.35, 1, .6), new THREE.Vector3(-.25, 1, .7),
  new THREE.Vector3(-.3, 1, .4), new THREE.Vector3(-.5, 1, .45), new THREE.Vector3(.2, 1, .75), new THREE.Vector3(-.55, 1, .4),
].map(v => v.normalize());
const dir = new THREE.Vector3(), ctr = new THREE.Vector3();

// 接缝母题：3D 接缝在屏幕上的投影，延长到画面边缘
function seamLine(f, world, out) {
  const pkg = world.pkg;
  const y = 4.6 + pkg.parts.dieA.w.y;
  const a = f.proj(-300, y, 0), b = f.proj(300, y, 0);
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  out.x1 = a.x - dx / L * 3000; out.y1 = a.y - dy / L * 3000;
  out.x2 = b.x + dx / L * 3000; out.y2 = b.y + dy / L * 3000;
  return out;
}

export function theme(f, ctx, pose) {
  const { engine, world } = ctx;
  const P = engine.params, L = f.loc;
  const i = f.ci;
  // 章间配色过渡：覆盖在转场后半段
  let mixK = 0, a = i, b = i;
  const t = L[i];
  if (i < 7) {
    const windows = [[.82, 1], [.92, 1], [.82, 1], [.965, 1], [.97, 1], [.94, 1], [.84, 1]];
    const [u, v] = windows[i];
    mixK = sstep(u, v, t); b = i + 1;
  }
  // 明暗跨越（04→05，05→06）由“泛出”的圆负责，这里只在圆盖满后切换
  const paperEnter = sstep(.99, .995, L[3]);
  const paperLeave = sstep(.0, .001, L[5]);
  let bgA = PAL[a][0], bgB = PAL[a][1], bgC = PAL[a][2];
  srgb2(bgA, P.bgA); srgb2(bgB, P.bgB); srgb2(bgC, P.bgC);
  if (mixK > 0 && !((i === 3) || (i === 4))) {
    P.bgA.lerp(srgb2(PAL[b][0], c0), mixK); P.bgB.lerp(srgb2(PAL[b][1], c0), mixK); P.bgC.lerp(srgb2(PAL[b][2], c0), mixK);
  }
  P.grid = i === 4 ? .9 : .5;

  // 泛出的圆：04→05 从数据块展开成纸；05→06 从封装展开成机房的暗
  P.flood = null;
  if (L[3] > .94 && L[3] <= 1 && i === 3) {
    const r = sstep(.95, 1.0, L[3]);
    const e = f.floodCenter || { x: f.DW / 2, y: f.DH / 2 };
    P.flood = { x: e.x / f.DW, y: 1 - e.y / f.DH, r: r * r * 2.4, c: srgb2(PAL[4][0], c1) };
  }
  if (i === 4 && L[4] > .9) {
    const e = f.proj(0, 3, 0);
    const r = sstep(.93, 1.0, L[4]);
    P.flood = { x: e.x / f.DW, y: 1 - e.y / f.DH, r: r * r * 2.6, c: srgb2(PAL[5][0], c1) };
  }

  // CSS 主题：纸面章节墨色反转
  const paper = (i === 4 && L[4] < .975) || (i === 3 && L[3] > .985);
  const key = paper ? 'paper' : 'dark';
  if (ctx._theme !== key) {
    ctx._theme = key;
    document.documentElement.classList.toggle('paper', paper);
  }
  document.documentElement.dataset.ch = String(i + 1);

  // 灯光
  const intro = ctx.introAmount(f.p, f.time);
  const lit = sstep(0, .5, intro);
  const dA = dirCh[a], dB = dirCh[b];
  dir.copy(dA).lerp(dB, mixK).normalize();
  // 灯位缓慢移动，高光和阴影随之更新
  const wob = f.time * .13;
  dir.x += Math.sin(wob) * .1; dir.z += Math.cos(wob * .8) * .08;
  // 开场：一束掠射光扫过晶粒
  if (intro < 1) { dir.x = lerp(-1.6, dir.x, sstep(.08, .9, intro)); dir.y = lerp(.22, dir.y, sstep(.08, .9, intro)); }
  dir.normalize();
  const d = Math.exp(pose.d);
  ctr.set(pose.tx, pose.ty, pose.tz);
  const scale = clamp(d * .62, 26, 6000);
  engine.setKeyLight(ctr, scale, dir);
  engine.key.intensity = lerp(.15, 2.3, lit);
  engine.rim.intensity = lerp(1.6, .32, lit);
  P.exposure = lerp(.0, 1, sstep(0, .22, intro));

  P.aoRadius = clamp(d * .012, .08, 60);
  P.ao = 1;
  P.dof = pose.ap;
  P.focus = d;
  P.maxCoc = 16;
  P.bloom = .3;
  P.bloomTh = 1.7;
  P.vig = i === 4 ? .08 : .42;

  // 环境：纸面章节用明亮环境
  const useLight = (i === 4 && L[4] > .5) || (i === 5 && L[5] < .06);
  const envT = useLight ? engine.envLight : engine.envDark;
  if (engine.scene.environment !== envT) engine.scene.environment = envT;
  let envI = 1;
  if (i === 5) envI = lerp(.35, 1, sstep(.055, .09, L[5])) * (L[5] < .055 ? lerp(1, .35, sstep(.0, .055, L[5])) / .35 * .35 : 1);
  if (i === 5) envI *= lerp(1, 2.1, sstep(.55, .62, L[5]));
  if (i === 6) envI *= lerp(2.1, 1.2, sstep(.1, .22, L[6]));
  engine.fill.intensity = i === 5 || i === 6 ? lerp(.18, .75, i === 5 ? sstep(.55, .62, L[5]) : 1 - sstep(.1, .22, L[6]) * .6) : .18;
  engine.scene.environmentIntensity = envI;
  engine.scene.environmentRotation.y = f.time * .035 + f.p * 3.2;

  // 展台
  const stage = world.stage;
  const stageOn = (i <= 1 || (i === 7) || (i === 2 && L[2] < .3)) && pose.el > 6 * DEG;
  stage.visible = stageOn;
  if (stageOn) {
    stage.position.y = -.02 + world.pkg.parts.balls.w.y;
    world.M.floor.opacity = sstep(6 * DEG, 16 * DEG, pose.el) * (i === 7 ? sstep(.05, .2, L[7]) : 1);
  }

  // 接缝母题
  const line = {};
  seamLine(f, world, line);
  let op = 1;
  if (i === 0) op = sstep(.5, .95, intro) * .55;
  if (i === 1) op = .3 * (1 - sstep(.0, .05, L[1])) + .55 * sstep(.86, .95, L[1]);
  if (i === 2) op = 1;
  if (i === 3) op = 1 - sstep(.9, .95, L[3]);
  if (i === 7) op = sstep(.7, .95, L[7]) * .55;
  if (i === 4 || i === 5 || i === 6) {
    op = 0;
  }
  line.op = op;
  line.glow = i === 2 ? 1.4 : 1;
  f.seam = line;
}
