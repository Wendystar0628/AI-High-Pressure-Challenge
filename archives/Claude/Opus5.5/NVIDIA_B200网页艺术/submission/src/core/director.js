// 镜头导演：全页进度 → 相机。关键帧按“章内位置”书写，用单调三次插值，保证停住、倒放都沿同一条路径。
import * as THREE from 'three';
import { at } from './timeline.js';
import { hermite, DEG, sstep, lerp, iv } from './util.js';
import { FLOOR_Y, RACK_X } from '../gfx/world.js';

// tx,ty,tz 目标；d 距离；az 方位；el 俯仰；roll 滚转；fov；sx,sy 画面中心偏移（屏宽/屏高比例）；ap 光圈（景深强度）
const K = [];
const key = (ch, t, o) => K.push(Object.assign({ p: at(ch, t) }, o));
const P = (tx, ty, tz, d, az, el, extra = {}) => ({ tx, ty, tz, d: Math.log(d), az: az * DEG, el: el * DEG, roll: 0, fov: 26, sx: 0, sy: 0, ap: 0, ...extra });

export const HERO = P(0, 2.5, 0, 262, -30, 34, { sx: .16, sy: .0 });
const RX = RACK_X, RY = FLOOR_Y;
export const SHELF = { x: 900, y: -640, z: 0 };

// 01 整颗
key(0, 0, HERO);
key(0, .3, P(0, 2.5, 0, 248, -22, 38, { sx: .17, sy: .02 }));
key(0, .58, P(0, 2.5, 0, 225, -6, 68, { sx: .2, sy: 0 }));
key(0, .76, P(0, 2.5, 0, 225, -8, 62, { sx: .2 }));
key(0, 1, P(0, 7, 0, 240, -30, 26, { sx: .1 }));
// 02 拆解
key(1, .1, P(0, 12, 0, 250, -36, 20, { sx: .07 }));
key(1, .22, P(0, 14, 0, 292, -40, 16, { sx: .08 }));
key(1, .25, P(0, 10, 0, 280, -48, 8, { sx: .08 }));
key(1, .31, P(0, -6, 0, 158, -62, -36, { sx: .1 }));
key(1, .35, P(0, 2, 4, 150, -40, -6, { sx: .1 }));
key(1, .39, P(0, 12, 8, 150, -22, 34, { sx: .1 }));
key(1, .46, P(0, 30, 10, 112, -16, 26, { sx: .1 }));
key(1, .5, P(0, 34, 6, 110, -14, 22, { sx: .1 }));
key(1, .55, P(0, 46, 0, 92, -8, 40, { sx: .1, ap: .25 }));
key(1, .6, P(-14, 46, 8, 82, -26, 34, { sx: .1, ap: .35 }));
key(1, .66, P(-29, 54, 18, 62, -44, 18, { sx: .1, ap: .55 }));
key(1, .71, P(-29, 58, 18, 58, -58, 12, { sx: .08, ap: .55 }));
key(1, .75, P(0, 12, 0, 170, 62, 16, { sx: -.06 }));
key(1, .83, P(0, 10, 0, 160, 70, 12, { sx: -.06 }));
key(1, .87, P(0, 18, 0, 124, -6, 46, { sx: .06 }));
key(1, .94, P(0, 18, 0, 108, -6, 52, { sx: .06, ap: .2 }));
key(1, 1, P(0, 8, 0, 120, -50, 66, { sx: .03, ap: .15 }));
// 03 接缝：方位 -90 时接缝在屏幕上竖直，晶粒 A 在左、B 在右
key(2, .16, P(0, 4.6, 0, 130, -90, 84, { sx: -.06, sy: 0 }));
key(2, .24, P(0, 4.6, 0, 214, -90, 90, { sx: -.06, fov: 15 }));
key(2, .42, P(0, 4.6, 0, 218, -90, 90, { sx: -.06, fov: 15 }));
key(2, .5, P(0, 4.6, 0, 104, -72, 60, { sx: -.05, fov: 22, ap: .6 }));
key(2, .74, P(0, 4.6, 0, 92, -58, 48, { sx: -.05, fov: 22, ap: .7 }));
key(2, .86, P(0, 4.6, 0, 130, -84, 72, { sx: -.05, fov: 24, ap: .15 }));
// 03 → 04：方位转到 0，接缝转成水平，HBM 列排到左右两端，运动顺势往左滑
key(3, 0, P(-24, 8, 0, 128, -14, 48, { sy: .2, ap: .08 }));
key(3, .1, P(-26, 12, 0, 118, -24, 34, { sy: .2, ap: .12 }));
key(3, .22, P(-20, 9, 0, 120, -18, 40, { sy: .2 }));
key(3, .36, P(-6, 5, 0, 118, -4, 54, { sy: .2 }));
key(3, .47, P(2, 5, 0, 118, 3, 58, { sy: .2 }));
key(3, .57, P(0, 4, 0, 260, 0, 90, { fov: 15, sy: .0 }));
key(3, .7, P(0, 4, 0, 260, 0, 90, { fov: 15, sy: .0 }));
key(3, .78, P(16, 9, 0, 120, 18, 40, { sy: .2 }));
key(3, .88, P(26, 12, 0, 118, 24, 34, { sy: .2, ap: .12 }));
key(3, .94, P(30, 8, 6, 34, 18, 28, { sy: .03, ap: .9 }));
key(3, 1, P(36, 10, 12, 7, 24, 14, { sy: 0, ap: .5, fov: 30 }));
// 05 精度：纸面，三维只在首尾出现
key(4, .018, P(36, 10, 12, 3.2, 24, 10, { fov: 30 }));
key(4, .8, P(0, 3, 0, 300, 0, 90, { sx: .19, fov: 18 }));
key(4, .88, P(0, 3, 0, 300, 0, 90, { sx: .19, fov: 18 }));
key(4, 1, P(0, 3, 0, 280, -6, 76, { sx: .17, fov: 22 }));
// 06 集群
key(5, .04, P(0, 3, 0, 300, -10, 68, { sx: .14, fov: 24 }));
key(5, .1, P(120, 0, 100, 1240, -18, 54, { sx: -.17, fov: 26 }));
key(5, .16, P(165, 0, 140, 1400, -14, 62, { sx: -.2 }));
key(5, .22, P(165, 0, 140, 1720, 0, 82, { sx: -.2, fov: 26 }));
key(5, .5, P(165, 0, 140, 1720, -4, 78, { sx: -.2, fov: 26 }));
key(5, .57, P(165, 40, 140, 1800, -16, 56, { sx: -.2 }));
key(5, .64, P(165, 180, 70, 2500, -30, 26, { sx: -.2 }));
key(5, .7, P(165, 190, 70, 2600, -34, 22, { sx: -.2 }));
key(5, .75, P(RX, RY + 1690, 700, 1560, 18, 40, { sx: -.2 }));
key(5, .79, P(RX, RY + 1690, 600, 860, 12, 58, { sx: -.2, ap: .18 }));
key(5, .83, P(RX, RY + 1300, 300, 2600, -14, 22, { sx: -.2 }));
key(5, .89, P(RX, RY + 1120, 0, 5400, -22, 10, { sx: -.22 }));
key(5, .94, P(RX, RY + 1120, 0, 5600, -24, 10, { sx: -.22 }));
key(5, 1, P(RX + 1800, RY + 1100, 0, 9200, -30, 13, { sx: -.1 }));
// 07 对照：陈列架
key(6, .22, P(SHELF.x, SHELF.y + 230, 0, 3650, 0, 9, { sx: .073, sy: .372, fov: 26 }));
key(6, .8, P(SHELF.x, SHELF.y + 230, 0, 3650, 0, 9, { sx: .073, sy: .372, fov: 26 }));
// 07 → 08：回到整颗
key(7, 0, P(0, 3, 0, 300, -16, 30, { sx: 0, sy: .02 }));
key(7, .1, P(0, 3, 0, 230, -28, 30, { sx: .0 }));
key(7, .3, P(0, 3, 0, 190, -32, 34, { sx: 0 }));
key(7, .7, P(0, 3, 0, 186, -28, 38, { sx: 0 }));
key(7, .9, { ...HERO, d: Math.log(250) });
key(7, 1, HERO);
K.sort((a, b) => a.p - b.p);

const CH = ['tx', 'ty', 'tz', 'd', 'az', 'el', 'roll', 'fov', 'sx', 'sy', 'ap'];
export function pose(p, out = {}) {
  for (const c of CH) out[c] = hermite(K, p, c);
  return out;
}

// 把姿态写进相机
const _pos = new THREE.Vector3(), _tgt = new THREE.Vector3(), _up = new THREE.Vector3(), _view = new THREE.Vector3(), _m = new THREE.Matrix4();
export function applyPose(cam, o, W, H) {
  const d = Math.exp(o.d), ce = Math.cos(o.el), se = Math.sin(o.el), ca = Math.cos(o.az), sa = Math.sin(o.az);
  _tgt.set(o.tx, o.ty, o.tz);
  _pos.set(o.tx + d * ce * sa, o.ty + d * se, o.tz + d * ce * ca);
  // 由切向量求上方向，正上方俯视时也不会退化
  _up.set(-se * sa, ce, -se * ca);
  if (o.roll) {
    _view.copy(_tgt).sub(_pos).normalize();
    _up.applyAxisAngle(_view, o.roll);
  }
  cam.position.copy(_pos);
  cam.up.copy(_up);
  cam.lookAt(_tgt);
  cam.fov = o.fov;
  cam.aspect = W / H;
  cam.near = Math.max(d * .02, .02);
  cam.far = Math.max(d * 40, 5000);
  // 画面中心偏移：不改变透视，只平移投影
  if (o.sx || o.sy) cam.setViewOffset(W, H, -o.sx * W, o.sy * H, W, H);
  else cam.clearViewOffset();
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  return d;
}

