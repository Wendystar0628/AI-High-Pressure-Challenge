// 系统级模型的编排：从 B200 到 HGX、DGX、GB200、NVL72、成排机柜，再到 07 章的陈列架与 08 章的回归。
import * as THREE from 'three';
import { iv, sstep, smoother, lerp, pulse, clamp, easeIO } from './util.js';
import { RACK_X, FLOOR_Y } from '../gfx/world.js';
import { SHELF } from './director.js';

// 陈列架上每个产品的落点：与 07 章表格的列对齐
export const COLS = [524, 812, 1100, 1388, 1676];
const COL_DX = 449; // 世界距离（与相机距离配合：约 288 设计像素）
export const SHELF_POS = i => new THREE.Vector3(SHELF.x + (i - 2) * COL_DX, SHELF.y, 0);
const SHELF_ROT = -.5; // 每个模型统一的 3/4 朝向

const _v = new THREE.Vector3();
const place = (obj, from, to, k, scaleFrom, scaleTo, rotTo = 0) => {
  obj.position.lerpVectors(from, to, k);
  const s = lerp(scaleFrom, scaleTo, k);
  obj.scale.setScalar(s);
  obj.rotation.y = rotTo * k;
};
const ORIGIN = new THREE.Vector3(0, 0, 0);
const scPos = new THREE.Vector3();

export function systemsUpdate(f, ctx) {
  const { world } = ctx;
  const { pkg, hgx, dgx, rack, row, sc, dgxRack, floor, block } = world;
  const L = f.loc;
  const t5 = L[4], t6 = L[5], t7 = L[6], t8 = L[7];
  const i = f.ci;

  // 显隐窗口
  const showHgx = (i === 4 && t5 > .955) || (i === 5 && t6 < .74) || (i === 6) || (i === 7 && t8 < .1);
  const showDgx = (i === 5 && t6 > .56) || (i === 6) || (i === 7 && t8 < .1);
  const showRack = (i === 5 && t6 > .685) || i === 6 || (i === 7 && t8 < .1);
  const showRow = (i === 5 && t6 > .84) || (i === 6 && t7 < .24);
  const showFloor = (i === 5 && t6 > .55) || (i === 6 && t7 < .24);
  const showSc = (i === 5 && t6 > .7 && t6 < .9) || i === 6 || (i === 7 && t8 < .1);
  const showPkg = !((i === 4 && t5 < .865) || (i === 3 && L[3] > .994));

  world.setVis(pkg.group, showPkg);
  world.setVis(hgx.group, showHgx);
  world.setVis(dgx.group, showDgx);
  world.setVis(rack.group, showRack);
  world.setVis(row.group, showRow);
  world.setVis(floor, showFloor);
  world.setVis(sc.group, showSc);
  world.setVis(dgxRack, i === 5 && t6 > .73);

  // ---------- 05 → 06：基板从封装四周长出 ----------
  const grow = i === 4 ? smoother(.955, 1, t5) * .28 : smoother(-.02, .075, t6);
  const G = i === 6 || i === 7 ? 1 : (i === 5 ? lerp(.28, 1, smoother(0, .08, t6)) : grow);
  // 第 0 颗 GPU：普通状态由完整模型代替（放在原点），陈列架上独立占一列
  hgx.lite.die.visible = true;

  // ---------- 06 章：散热器、机箱合拢 ----------
  const sink = i === 5 ? smoother(.565, .63, t6) : (i >= 6 ? 1 : 0);
  // 07 章陈列的 HGX 要露出 GPU：散热器抬走
  const shelfOpen = i === 6 ? smoother(.02, .16, t7) : (i === 7 ? 1 : 0);
  hgx.setSink(sink * (1 - shelfOpen));
  const chassis = i === 5 ? smoother(.56, .62, t6) : 1;
  const closeLid = i === 5 ? smoother(.62, .69, t6) : 1;
  dgx.setOpen(1 - closeLid);

  // ---------- 机柜托盘抽出 ----------
  const pull = i === 5 ? pulse(.715, .76, .8, .835, t6) : 0;
  rack.setTrayPull(pull);
  // 超级芯片住在抽出的托盘里
  if (showSc) {
    scPos.set(RACK_X, FLOOR_Y + rack.heroSlot.y + 8, -210 + pull * 760);
    sc.setCold(i === 5 ? smoother(.71, .745, t6) * (1 - smoother(.805, .825, t6)) : 1);
  }

  // ---------- 成排机柜升起 ----------
  if (showRow) {
    const up = i === 5 ? t6 : 2;
    row.list.forEach((m, k) => {
      const e = smoother(.86 + k * .008, .94 + k * .008, up);
      m.position.y = (1 - e) * -2600;
      m.visible = e > .001;
    });
  }

  // ---------- 06 → 07 → 08：陈列架 ----------
  // k：0 = 世界位置，1 = 架上
  const inK = i === 6 ? smoother(.02, .2, t7) : (i === 5 ? 0 : (i === 7 ? 1 : 0));
  const outK = i === 6 ? smoother(.84, 1, t7) : (i === 7 ? smoother(-.0, .1, t8) : 0);

  const pkgShelf = 2.9, hgxShelf = .6, dgxShelf = .3, scShelf = .68, rackShelf = .13;
  // 完整封装：回到原点时占据 08 章中心
  const pP = SHELF_POS(0);
  pP.y += 14;
  if (i === 6 || (i === 7 && t8 < .12)) {
    const k = i === 6 ? inK : 1;
    const back = i === 6 ? smoother(.82, 1, t7) : 1;
    pkg.group.position.lerpVectors(ORIGIN, pP, k * (1 - back));
    const sc0 = lerp(1, pkgShelf, k * (1 - back));
    pkg.group.scale.setScalar(sc0);
    pkg.group.rotation.y = SHELF_ROT * k * (1 - back);
  } else {
    pkg.group.position.set(0, 0, 0);
    pkg.group.scale.setScalar(1);
    pkg.group.rotation.y = 0;
  }

  // HGX
  const hP = SHELF_POS(1); hP.y += 26; hP.z += 20;
  const hHome = hgx.home.clone();
  if (i === 6 || (i === 7 && t8 < .12)) {
    const leave = outK;
    hgx.group.position.lerpVectors(hHome, hP, inK);
    hgx.group.position.x -= leave * 1200;
    hgx.group.position.y -= leave * leave * 500;
    hgx.group.scale.setScalar(lerp(1, hgxShelf, inK) * (1 - leave * .3));
    hgx.group.rotation.y = SHELF_ROT * inK;
  } else {
    hgx.group.position.copy(hgx.home).multiplyScalar(G);
    hgx.group.scale.setScalar(G);
    hgx.group.rotation.y = 0;
  }
  // 第 0 颗精简 GPU：完整模型在原点时不重复显示
  const hideLite0 = !(i === 6 && inK > .4);
  hgx.setSlot0Hidden?.(hideLite0);

  // DGX
  const dP = SHELF_POS(2); dP.y += 10;
  const chassisY = (1 - chassis) * -900;
  if (i === 6 || (i === 7 && t8 < .12)) {
    dgx.group.position.lerpVectors(dgx.home, dP, inK);
    dgx.group.position.y -= outK * outK * 800;
    dgx.group.scale.setScalar(lerp(1, dgxShelf, inK) * (1 - outK * .3));
    dgx.group.rotation.y = SHELF_ROT * inK;
  } else {
    dgx.group.position.copy(dgx.home);
    dgx.group.position.y += chassisY;
    dgx.group.scale.setScalar(1);
    dgx.group.rotation.y = 0;
  }

  // GB200
  const sP = SHELF_POS(3); sP.y += 26;
  if (showSc) {
    if (i === 6 || i === 7) {
      sc.group.position.lerpVectors(scPos, sP, inK);
      sc.group.position.x += outK * 1200;
      sc.group.position.y -= outK * outK * 500;
      sc.group.scale.setScalar(lerp(1, scShelf, inK) * (1 - outK * .3));
      sc.group.rotation.y = SHELF_ROT * inK;
    } else {
      sc.group.position.copy(scPos);
      sc.group.scale.setScalar(1);
      sc.group.rotation.y = 0;
    }
  }

  // 机柜
  const rP = SHELF_POS(4);
  if (i === 6 || (i === 7 && t8 < .12)) {
    rack.group.position.lerpVectors(rack.home, rP, inK);
    rack.group.position.x += outK * 1400;
    rack.group.position.y -= outK * outK * 700;
    rack.group.scale.setScalar(lerp(1, rackShelf, inK) * (1 - outK * .3));
    rack.group.rotation.y = SHELF_ROT * inK;
  } else {
    rack.group.position.copy(rack.home);
    if (i === 5) rack.group.position.y -= (1 - smoother(.685, .735, t6)) * 2600;
    rack.group.scale.setScalar(1);
    rack.group.rotation.y = 0;
  }
  // 成排机柜散开离场，第一台留下成为第五列
  if (showRow && i === 6) {
    row.group.visible = smoother(0, .1, t7) < .99;
    row.list.forEach((m, k) => {
      const sink = smoother(0, .1, t7);
      m.position.y = -sink * (2800 + k * 120);
    });
  }
  if (showFloor) {
    floor.material.opacity = (i === 5 ? smoother(.55, .66, t6) : 1 - smoother(.02, .16, t7)) * .92;
  }

  // 数据块由 04/05 章控制
  if (i !== 3 && !(i === 4 && t5 < .03)) block.visible = false;
  ctx.engine.scene.updateMatrixWorld(true);
}
