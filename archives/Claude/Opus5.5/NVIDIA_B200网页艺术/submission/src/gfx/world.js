// 场景编排：所有模型放进同一个世界，尺度从毫米到数米连续。
import * as THREE from 'three';
import { makeMaterials, Streaks, Batch, meshOf, canvasTex } from './kit.js';
import { buildPackage, SectionCaps } from '../models/package.js';
import { buildHGX, buildDGX, buildSuperchip, buildRack, buildRow, buildHallFloor, liteGPUs, RACK } from '../models/systems.js';

export const FLOOR_Y = -900;
export const RACK_X = 1500;

// 三维的“一份数据”：4×4 的块，从 04 章飞进 05 章
function buildDataBlock(M) {
  const g = new THREE.Group();
  const b = new Batch();
  b.box(-.5, .5, -.5, .5, -.06, .06, .02);
  const body = new THREE.Mesh(b.build(), new THREE.MeshPhysicalMaterial({ color: 0xf2eee3, metalness: 0, roughness: .36, clearcoat: .6, clearcoatRoughness: .3, emissive: 0xf2eee3, emissiveIntensity: .5 }));
  body.castShadow = false;
  g.add(body);
  // 面上 4×4 的刻槽：之后变成矩阵的格子
  const tex = canvasTex(1024, (x, s) => {
    x.fillStyle = '#f2eee3'; x.fillRect(0, 0, s, s);
    x.strokeStyle = '#15181c'; x.lineWidth = 7;
    const m = s * .06, c = (s - m * 2) / 4;
    for (let i = 0; i <= 4; i++) {
      x.beginPath(); x.moveTo(m + i * c, m); x.lineTo(m + i * c, s - m); x.stroke();
      x.beginPath(); x.moveTo(m, m + i * c); x.lineTo(s - m, m + i * c); x.stroke();
    }
  }, 1, true);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.28, 1.28, 1.28), toneMapped: false }));
  face.position.z = .0605;
  g.add(face);
  g.visible = false;
  g.faceMat = face.material;
  return g;
}

export function createWorld(engine) {
  const scene = engine.scene;
  const M = makeMaterials();
  const pkg = buildPackage(M);
  scene.add(pkg.group);

  const caps = new SectionCaps();
  scene.add(caps.mesh);
  const streaks = new Streaks(16000);
  scene.add(streaks.mesh);

  // 展台：接触阴影与暗部的承托面
  const stage = new THREE.Mesh(new THREE.CircleGeometry(420, 96), M.floor);
  stage.rotation.x = -Math.PI / 2;
  stage.position.y = -.02;
  stage.receiveShadow = true;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(256, 256, 30, 256, 256, 256);
  g.addColorStop(0, '#fff'); g.addColorStop(.45, '#999'); g.addColorStop(1, '#000');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  M.floor.alphaMap = new THREE.CanvasTexture(c);
  scene.add(stage);

  // 系统
  const hgx = buildHGX(M);
  hgx.home = new THREE.Vector3(165, 0, 140);
  hgx.group.position.copy(hgx.home);
  scene.add(hgx.group);

  const dgx = buildDGX(M);
  dgx.home = new THREE.Vector3(165, 0, 70);
  dgx.group.position.copy(dgx.home);
  scene.add(dgx.group);

  const rack = buildRack(M);
  rack.home = new THREE.Vector3(RACK_X, FLOOR_Y, 0);
  rack.group.position.copy(rack.home);
  scene.add(rack.group);

  const row = buildRow(M, rack, 7);
  row.group.position.set(RACK_X, FLOOR_Y, 0);
  scene.add(row.group);

  // 抽出托盘里：一颗可追踪的 GB200 超级芯片 + 一颗静态的
  const sc = buildSuperchip(M);
  scene.add(sc.group);
  const sc2 = buildSuperchip(M);
  sc2.group.position.set(0, 8, 300);
  sc2.setCold(0);
  rack.hero.add(sc2.group);
  // 机箱内装 DGX 的 42U 机架
  const frame = new Batch();
  const fw = 620, fd = 1040, fh = RACK.H;
  for (const [a, b] of [[-fw / 2, -fd / 2], [fw / 2 - 26, -fd / 2], [-fw / 2, fd / 2 - 26], [fw / 2 - 26, fd / 2 - 26]]) frame.box(a, a + 26, 0, fh, b, b + 26, 2);
  frame.box(-fw / 2, fw / 2, fh - 26, fh, -fd / 2, fd / 2, 2);
  frame.box(-fw / 2, fw / 2, 0, 40, -fd / 2, fd / 2, 2);
  const dgxRack = meshOf(frame, M.chassisDark);
  dgxRack.position.set(dgx.home.x, FLOOR_Y, dgx.home.z);
  scene.add(dgxRack);

  const floor = buildHallFloor(M);
  floor.position.set(RACK_X * .6, FLOOR_Y, 0);
  scene.add(floor);

  const block = buildDataBlock(M);
  scene.add(block);

  // 所有系统默认隐藏，由导演按进度打开
  const setVis = (o, v) => { if (o.visible !== v) o.visible = v; };

  return { M, pkg, caps, streaks, stage, hgx, dgx, rack, row, sc, sc2, dgxRack, floor, block, setVis };
}
