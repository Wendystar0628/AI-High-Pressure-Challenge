// 三维场景建筑、远景协议层、六种防御塔（含2级与双分支变形）、六种敌人、三位首领与道具的精细建模及骨骼级连续动作

import * as THREE from 'three';
import { TILE, TILE_SIZE, ENTRY_COLORS, TOWERS } from './constants.js';
import { gridToWorld, keyOf } from './pathfinding.js';
import { getTextures } from './textures.js';

// 共享几何体缓存，提升渲染性能
const GEO = {};
function getGeo(key, factory) {
  if (!GEO[key]) GEO[key] = factory();
  return GEO[key];
}

// 创建带文字的清晰 3D 精灵标牌（用于入口名、出口中枢名、节点编号）
export function makeTextSprite(text, { bg = 'rgba(8, 18, 34, 0.86)', border = '#38bdf8', color = '#f8fafc', fontSize = 30, scale = 2.5 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${fontSize}px "Microsoft YaHei UI", "PingFang SC", sans-serif`;
  const textWidth = Math.ceil(ctx.measureText(text).width);
  const padX = 28;
  const w = Math.max(160, textWidth + padX * 2);
  const h = fontSize + 28;
  canvas.width = w;
  canvas.height = h;

  ctx.font = `bold ${fontSize}px "Microsoft YaHei UI", "PingFang SC", sans-serif`;
  ctx.fillStyle = bg;
  roundRect(ctx, 4, 4, w - 8, h - 8, 12);
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = border;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  const aspect = w / h;
  sp.scale.set(scale * aspect * 0.42, scale * 0.42, 1);
  sp.renderOrder = 25;
  return sp;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================================
// 1. 构建整张地图立体战场 + 纵深协议层 + 远景自治域集群与跨网数据流
// ============================================================================
export function buildBattlefieldScene(map) {
  const tex = getTextures();
  const root = new THREE.Group();
  const tileVisuals = new Map(); // "x,z" -> { group, type, gatePylons, ringMat, cooldownRing, ... }
  const animatedProps = [];

  // 主题配色参数
  const themePalette = {
    enterprise: {
      fog: 0x06101e,
      bg: 0x050c18,
      strata1: 0x0ea5e9,
      strata2: 0x2563eb,
      cluster: 0x38bdf8,
      underGlow: 0x0284c7
    },
    backbone: {
      fog: 0x080b1c,
      bg: 0x060816,
      strata1: 0x6366f1,
      strata2: 0xf59e0b,
      cluster: 0x818cf8,
      underGlow: 0x4f46e5
    },
    industrial: {
      fog: 0x0c1014,
      bg: 0x090c10,
      strata1: 0xf59e0b,
      strata2: 0x14b8a6,
      cluster: 0xfbbf24,
      underGlow: 0xd97706
    }
  }[map.theme || 'enterprise'];

  // --------------------------------------------------------------------------
  // A. 下方纵深协议层 (OSI Protocol Strata)
  // --------------------------------------------------------------------------
  const strataGroup = new THREE.Group();
  const strataLevels = [
    { y: -2.8, size: 48, div: 24, col: themePalette.strata1, op: 0.22 },
    { y: -6.8, size: 72, div: 30, col: themePalette.strata2, op: 0.14 },
    { y: -12.5, size: 105, div: 36, col: themePalette.strata1, op: 0.08 }
  ];
  for (const st of strataLevels) {
    const gridHelper = new THREE.GridHelper(st.size, st.div, st.col, st.col);
    gridHelper.position.y = st.y;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = st.op;
    strataGroup.add(gridHelper);
  }

  // 战场底盘悬浮支撑能量核与下垂光纤立柱
  const underFrameGeo = new THREE.BoxGeometry(map.cols * TILE_SIZE + 0.6, 0.35, map.rows * TILE_SIZE + 0.6);
  const underFrameMat = new THREE.MeshStandardMaterial({
    color: 0x0b1322,
    metalness: 0.7,
    roughness: 0.4,
    transparent: true,
    opacity: 0.55
  });
  const underFrame = new THREE.Mesh(underFrameGeo, underFrameMat);
  underFrame.position.y = -0.58;
  strataGroup.add(underFrame);
  root.add(strataGroup);

  // --------------------------------------------------------------------------
  // B. 远景其他网络集群与往来数据流梭
  // --------------------------------------------------------------------------
  const horizonGroup = new THREE.Group();
  const clusterPositions = [];
  const clusterCount = 16;
  const monolithMat = new THREE.MeshStandardMaterial({
    color: 0x0f1b2e,
    emissive: themePalette.cluster,
    emissiveIntensity: 0.18,
    metalness: 0.75,
    roughness: 0.3
  });
  const ringMat = new THREE.MeshBasicMaterial({
    color: themePalette.cluster,
    transparent: true,
    opacity: 0.45
  });

  for (let i = 0; i < clusterCount; i++) {
    const ang = (i / clusterCount) * Math.PI * 2 + 0.18;
    const rad = 28 + (i % 3) * 7.5;
    const cx = Math.cos(ang) * rad * 1.18;
    const cz = Math.sin(ang) * rad * 0.92;
    const cy = -3.5 + ((i * 7) % 5) * 0.9;
    clusterPositions.push(new THREE.Vector3(cx, cy + 2.2, cz));

    const cg = new THREE.Group();
    cg.position.set(cx, cy, cz);
    const h = 4.5 + (i % 4) * 2.2;
    const towerMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, h, 1.8), monolithMat);
    cg.add(towerMesh);

    const subMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, h * 0.7, 1.0), monolithMat);
    subMesh.position.set(1.2, -h * 0.15, 0.6);
    cg.add(subMesh);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.06, 8, 24), ringMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = h * 0.35;
    cg.add(halo);
    animatedProps.push({ type: 'halo', mesh: halo, speed: (i % 2 === 0 ? 1 : -1) * 0.6, baseY: h * 0.35, phase: i });

    horizonGroup.add(cg);
  }

  // 远景集群之间的光桥与往来数据包光梭
  const shuttles = [];
  const shuttleGeo = new THREE.BoxGeometry(0.75, 0.18, 0.18);
  const shuttleMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
  const lineMat = new THREE.LineBasicMaterial({ color: themePalette.cluster, transparent: true, opacity: 0.22 });

  for (let i = 0; i < clusterPositions.length; i++) {
    const p1 = clusterPositions[i];
    const p2 = clusterPositions[(i + 1) % clusterPositions.length];
    const lg = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    horizonGroup.add(new THREE.Line(lg, lineMat));

    for (let k = 0; k < 2; k++) {
      const sm = new THREE.Mesh(shuttleGeo, shuttleMat);
      horizonGroup.add(sm);
      shuttles.push({ mesh: sm, p1, p2, offset: (i * 0.17 + k * 0.5) % 1, speed: 0.11 + (i % 3) * 0.04 });
    }
  }
  root.add(horizonGroup);

  // --------------------------------------------------------------------------
  // C. 逐格构建地图精细地形与主题设施
  // --------------------------------------------------------------------------
  const linkMat = new THREE.MeshStandardMaterial({
    map: tex.link,
    roughness: 0.36,
    metalness: 0.55,
    emissive: 0x0c4a6e,
    emissiveIntensity: 0.28
  });
  const legacyMat = new THREE.MeshStandardMaterial({
    map: tex.legacy,
    roughness: 0.55,
    metalness: 0.48,
    emissive: 0x78350f,
    emissiveIntensity: 0.22
  });
  const platformTopMat = new THREE.MeshStandardMaterial({
    map: tex.platform,
    roughness: 0.35,
    metalness: 0.68,
    emissive: 0x1e3a8a,
    emissiveIntensity: 0.18
  });
  const platformSideMat = new THREE.MeshStandardMaterial({
    color: 0x1b2842,
    roughness: 0.45,
    metalness: 0.72
  });
  const rackMat = new THREE.MeshStandardMaterial({
    map: tex.serverRack,
    roughness: 0.38,
    metalness: 0.65,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.24
  });

  const linkGeo = getGeo('tile_link', () => new THREE.BoxGeometry(TILE_SIZE * 0.96, 0.28, TILE_SIZE * 0.96));
  const legacyGeo = getGeo('tile_legacy', () => new THREE.BoxGeometry(TILE_SIZE * 0.95, 0.24, TILE_SIZE * 0.95));
  const platBaseGeo = getGeo('plat_base', () => new THREE.CylinderGeometry(TILE_SIZE * 0.58, TILE_SIZE * 0.66, 0.72, 8));
  const platCapGeo = getGeo('plat_cap', () => new THREE.BoxGeometry(TILE_SIZE * 0.92, 0.16, TILE_SIZE * 0.92));

  // 特效：如果为骨干流域(backbone)，在 z=5 生成一条壮观的横贯全场公网数据洪流带
  if (map.theme === 'backbone') {
    const riverPos = gridToWorld(map, (map.cols - 1) / 2, 5, -0.22);
    const riverMat = new THREE.MeshBasicMaterial({
      map: tex.publicStream,
      transparent: true,
      opacity: 0.92
    });
    tex.publicStream.repeat.set(6, 1);
    const riverMesh = new THREE.Mesh(new THREE.PlaneGeometry(map.cols * TILE_SIZE + 8, TILE_SIZE * 0.92), riverMat);
    riverMesh.rotation.x = -Math.PI / 2;
    riverMesh.position.set(riverPos.x, -0.18, riverPos.z);
    root.add(riverMesh);
    animatedProps.push({ type: 'uvScroll', tex: tex.publicStream, speedX: -0.65 });

    // 公网流河岸护栏光带
    const bankGeo = new THREE.BoxGeometry(map.cols * TILE_SIZE + 6, 0.12, 0.12);
    const bankMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (const dz of [-0.92, 0.92]) {
      const b = new THREE.Mesh(bankGeo, bankMat);
      b.position.set(riverPos.x, -0.08, riverPos.z + dz);
      root.add(b);
    }
  }

  // 特效：如果为气隙深层(industrial)，在中央 (x=5..9, z=4..6) 构建深邃的中央物理气隙井！
  if (map.theme === 'industrial') {
    const cPos = gridToWorld(map, 7, 5, 0);
    const gapW = 5 * TILE_SIZE - 0.15;
    const gapD = 3 * TILE_SIZE - 0.15;
    const gapGroup = new THREE.Group();
    gapGroup.position.set(cPos.x, 0, cPos.z);

    // 气隙四周黄黑警示围堰
    const borderMat = new THREE.MeshStandardMaterial({ map: tex.hazard, roughness: 0.5, metalness: 0.5 });
    tex.hazard.repeat.set(4, 1);
    const nWall = new THREE.Mesh(new THREE.BoxGeometry(gapW, 0.34, 0.24), borderMat);
    nWall.position.set(0, 0.02, -gapD / 2);
    const sWall = nWall.clone();
    sWall.position.set(0, 0.02, gapD / 2);
    const wWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, gapD), borderMat);
    wWall.position.set(-gapW / 2, 0.02, 0);
    const eWall = wWall.clone();
    eWall.position.set(gapW / 2, 0.02, 0);
    gapGroup.add(nWall, sWall, wWall, eWall);

    // 深井内旋转电磁隔离环与电弧抑制柱
    for (let rIdx = 0; rIdx < 2; rIdx++) {
      const rMesh = new THREE.Mesh(
        new THREE.TorusGeometry(2.1 - rIdx * 0.65, 0.08, 10, 32),
        new THREE.MeshBasicMaterial({ color: rIdx === 0 ? 0xf59e0b : 0x2dd4bf })
      );
      rMesh.rotation.x = Math.PI / 2;
      rMesh.position.y = -1.1 - rIdx * 0.9;
      gapGroup.add(rMesh);
      animatedProps.push({ type: 'spinZ', mesh: rMesh, speed: (rIdx === 0 ? 1 : -1) * 0.85 });
    }

    const coreSpire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.55, 3.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: 0xd97706, emissiveIntensity: 0.4, metalness: 0.8 })
    );
    coreSpire.position.y = -2.0;
    gapGroup.add(coreSpire);

    const label = makeTextSprite('物理气隙隔离区', {
      bg: 'rgba(24, 18, 10, 0.85)',
      border: '#f59e0b',
      color: '#fcd34d',
      fontSize: 24,
      scale: 2.2
    });
    label.position.set(0, 0.65, 0);
    gapGroup.add(label);

    root.add(gapGroup);
  }

  // 遍历全图格子生成 3D 单元
  for (let gz = 0; gz < map.rows; gz++) {
    for (let gx = 0; gx < map.cols; gx++) {
      const t = map.grid[gz][gx];
      if (t === TILE.VOID) continue;

      const wp = gridToWorld(map, gx, gz, 0);
      const cellGroup = new THREE.Group();
      cellGroup.position.set(wp.x, 0, wp.z);

      const visual = {
        gx,
        gz,
        type: t,
        group: cellGroup,
        surfaceY: 0.14
      };

      if (t === TILE.LINK || t === TILE.ENTRY || t === TILE.EXIT) {
        const deck = new THREE.Mesh(linkGeo, linkMat);
        deck.position.y = -0.14;
        deck.receiveShadow = true;
        cellGroup.add(deck);

        // 道路边缘精致导光护边（若邻格为非道路格，加上低矮导轨，让路径边界利落分明）
        const curbMat = getGeo('mat_link_curb', () =>
          new THREE.MeshStandardMaterial({ color: 0x1e3a5f, emissive: 0x0ea5e9, emissiveIntensity: 0.25, metalness: 0.75, roughness: 0.35 })
        );
        const curbGeoX = getGeo('geo_curb_x', () => new THREE.BoxGeometry(TILE_SIZE * 0.94, 0.06, 0.07));
        const curbGeoZ = getGeo('geo_curb_z', () => new THREE.BoxGeometry(0.07, 0.06, TILE_SIZE * 0.94));
        const isRoad = (nx, nz) => {
          const nt = map.grid[nz]?.[nx];
          return nt === TILE.LINK || nt === TILE.LEGACY || nt === TILE.NODE || nt === TILE.ENTRY || nt === TILE.EXIT;
        };
        if (!isRoad(gx, gz - 1)) {
          const c = new THREE.Mesh(curbGeoX, curbMat);
          c.position.set(0, 0.02, -TILE_SIZE * 0.45);
          cellGroup.add(c);
        }
        if (!isRoad(gx, gz + 1)) {
          const c = new THREE.Mesh(curbGeoX, curbMat);
          c.position.set(0, 0.02, TILE_SIZE * 0.45);
          cellGroup.add(c);
        }
        if (!isRoad(gx - 1, gz)) {
          const c = new THREE.Mesh(curbGeoZ, curbMat);
          c.position.set(-TILE_SIZE * 0.45, 0.02, 0);
          cellGroup.add(c);
        }
        if (!isRoad(gx + 1, gz)) {
          const c = new THREE.Mesh(curbGeoZ, curbMat);
          c.position.set(TILE_SIZE * 0.45, 0.02, 0);
          cellGroup.add(c);
        }

        // 协议降级覆盖层（默认隐藏，协议降级生效时亮起琥珀网格！）
        const dgMat = new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0,
          depthWrite: false
        });
        const dgOverlay = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE * 0.88, TILE_SIZE * 0.88), dgMat);
        dgOverlay.rotation.x = -Math.PI / 2;
        dgOverlay.position.y = 0.025;
        dgOverlay.visible = false;
        cellGroup.add(dgOverlay);
        visual.downgradeOverlay = dgOverlay;
        visual.downgradeMat = dgMat;

        // 骨干流域跨越公网流 (z=5) 的专属桥拱装饰
        if (map.theme === 'backbone' && gz === 5) {
          const archMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.45, metalness: 0.8 });
          for (const side of [-0.88, 0.88]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, TILE_SIZE * 0.96), archMat);
            rail.position.set(side, 0.2, 0);
            cellGroup.add(rail);
          }
        }
      } else if (t === TILE.LEGACY) {
        const deck = new THREE.Mesh(legacyGeo, legacyMat);
        deck.position.y = -0.18;
        deck.receiveShadow = true;
        cellGroup.add(deck);
        visual.surfaceY = 0.08;

        // 旧链路两侧复古铜管护栏 + 横向校验刻度档
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0xb45309, emissive: 0x92400e, emissiveIntensity: 0.3, metalness: 0.75, roughness: 0.4 });
        for (const side of [-0.84, 0.84]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, TILE_SIZE * 0.9, 6), pipeMat);
          p.rotation.x = Math.PI / 2;
          p.position.set(side, 0.04, 0);
          cellGroup.add(p);
        }
      } else if (t === TILE.PLATFORM) {
        visual.surfaceY = 0.56;
        const ped = new THREE.Mesh(platBaseGeo, platformSideMat);
        ped.position.y = 0.12;
        ped.rotation.y = Math.PI / 8;
        ped.castShadow = true;
        ped.receiveShadow = true;
        cellGroup.add(ped);

        const cap = new THREE.Mesh(platCapGeo, platformTopMat);
        cap.position.y = 0.48;
        cap.castShadow = true;
        cap.receiveShadow = true;
        cellGroup.add(cap);

        // 平台八角战术接驳底座环与四角卡扣，让高台部署点清晰醒目
        const socketRimGeo = getGeo('plat_socket_rim', () => new THREE.TorusGeometry(0.56, 0.032, 6, 8));
        const socketRimMat = getGeo('plat_socket_mat', () =>
          new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.38, metalness: 0.75, roughness: 0.3 })
        );
        const socketRim = new THREE.Mesh(socketRimGeo, socketRimMat);
        socketRim.rotation.x = Math.PI / 2;
        socketRim.rotation.z = Math.PI / 8;
        socketRim.position.y = 0.565;
        cellGroup.add(socketRim);

        const clampGeo = getGeo('plat_clamp', () => new THREE.BoxGeometry(0.16, 0.08, 0.16));
        for (const [cx, cz] of [[-0.68, -0.68], [0.68, -0.68], [-0.68, 0.68], [0.68, 0.68]]) {
          const cl = new THREE.Mesh(clampGeo, platformSideMat);
          cl.position.set(cx, 0.56, cz);
          cellGroup.add(cl);
        }
      } else if (t === TILE.NODE) {
        const nodeInfo = map.nodes.find((n) => n.x === gx && n.z === gz);
        const nodeMat = new THREE.MeshStandardMaterial({
          map: tex.nodeDeck,
          roughness: 0.35,
          metalness: 0.68
        });
        const deck = new THREE.Mesh(linkGeo, nodeMat);
        deck.position.y = -0.12;
        deck.receiveShadow = true;
        cellGroup.add(deck);

        // 节点状态发光环（直通青绿 #10b981 / 隔离橙红 #ff5722 / 冷却灰蓝）
        const statusMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.85 });
        const statusRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 24), statusMat);
        statusRing.rotation.x = -Math.PI / 2;
        statusRing.position.y = 0.03;
        cellGroup.add(statusRing);

        // 四角可升降物理隔离闸柱 + 斜面装甲挡板 + 激光封锁横梁
        const gatePylons = new THREE.Group();
        const pylonGeo = new THREE.BoxGeometry(0.22, 0.72, 0.22);
        const shutterGeo = getGeo('node_shutter', () => new THREE.BoxGeometry(0.92, 0.28, 0.1));
        const pylonMat = new THREE.MeshStandardMaterial({
          color: 0x334155,
          emissive: 0xff5722,
          emissiveIntensity: 0.0,
          metalness: 0.8,
          roughness: 0.3
        });
        const corners = [
          [-0.72, -0.72],
          [0.72, -0.72],
          [-0.72, 0.72],
          [0.72, 0.72]
        ];
        for (const [cx, cz] of corners) {
          const py = new THREE.Mesh(pylonGeo, pylonMat);
          py.position.set(cx, 0.24, cz);
          py.castShadow = true;
          gatePylons.add(py);
        }
        // 四向机械封锁闸板 + 激光栅栏带
        const laserBarMat = new THREE.MeshBasicMaterial({ color: 0xff5252, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
        for (let rot = 0; rot < 4; rot++) {
          const ang = (rot * Math.PI) / 2;
          const dist = 0.72;
          const lb = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.38), laserBarMat);
          lb.rotation.y = ang;
          lb.position.set(Math.sin(ang) * dist, 0.34, Math.cos(ang) * dist);
          gatePylons.add(lb);

          const shutter = new THREE.Mesh(shutterGeo, pylonMat);
          shutter.rotation.y = ang;
          shutter.position.set(Math.sin(ang) * 0.76, 0.14, Math.cos(ang) * 0.76);
          gatePylons.add(shutter);
        }
        gatePylons.position.y = -0.68; // 默认降下隐藏
        cellGroup.add(gatePylons);

        // 再次隔离冷却进度环
        const cdMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.0, side: THREE.DoubleSide });
        const cdRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.92, 28), cdMat);
        cdRing.rotation.x = -Math.PI / 2;
        cdRing.position.y = 0.04;
        cellGroup.add(cdRing);

        if (nodeInfo) {
          const badge = makeTextSprite(nodeInfo.name, {
            bg: 'rgba(6, 22, 28, 0.86)',
            border: '#2dd4bf',
            color: '#99f6e4',
            fontSize: 22,
            scale: 1.38
          });
          badge.position.set(0, 1.02, -0.42);
          cellGroup.add(badge);
          visual.badge = badge;
        }

        visual.statusMat = statusMat;
        visual.gatePylons = gatePylons;
        visual.pylonMat = pylonMat;
        visual.laserBarMat = laserBarMat;
        visual.cdRing = cdRing;
        visual.cdMat = cdMat;
        visual.gateProgress = 0; // 0=open, 1=isolated
      } else if (t === TILE.OBSTACLE) {
        // 根据地图主题构建不同障碍设施
        if (map.theme === 'backbone' && gz === 5) {
          // z=5 公网流河面不堆放固体方块，让高速数据流河完整呈现！仅点缀少量悬浮光标
          if (gx % 3 === 1) {
            const buoy = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.24, 0),
              new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7 })
            );
            buoy.position.y = 0.15;
            cellGroup.add(buoy);
            animatedProps.push({ type: 'bob', mesh: buoy, baseY: 0.15, phase: gx });
          }
        } else if (map.theme === 'industrial' && gx >= 5 && gx <= 9 && gz >= 4 && gz <= 6) {
          // 中央气隙井已在上方统一建模，此处留空展现深渊纵深！
        } else {
          // 主题立体设施建筑（企业机柜阵列 / 骨干光缆锚座 / 工控 PLC 机柜与冷却罐）
          buildObstacleFacility(cellGroup, map.theme, gx, gz, rackMat);
        }
      }

      // 挂载不可见的拾取碰撞盒，确保射线点选精准顺手
      const pickBox = new THREE.Mesh(
        getGeo('pick_box', () => new THREE.BoxGeometry(TILE_SIZE * 0.98, 0.6, TILE_SIZE * 0.98)),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      pickBox.position.y = t === TILE.PLATFORM ? 0.45 : 0.05;
      pickBox.userData = { pickType: 'tile', gx, gz, tileType: t };
      cellGroup.add(pickBox);
      visual.pickMesh = pickBox;

      root.add(cellGroup);
      tileVisuals.set(keyOf(gx, gz), visual);
    }
  }

  // --------------------------------------------------------------------------
  // D. 入口门廊 (Entry Portals) 与 中枢出口核心塔 (Exit Cores)
  // --------------------------------------------------------------------------
  for (const entry of map.entries) {
    const colInfo = ENTRY_COLORS[entry.id] || ENTRY_COLORS.A;
    const tv = tileVisuals.get(keyOf(entry.x, entry.z));
    if (!tv) continue;
    const portal = new THREE.Group();

    const archMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: colInfo.hex,
      emissiveIntensity: 0.55,
      metalness: 0.8,
      roughness: 0.25
    });
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.65, 0.28), archMat);
    leftPillar.position.set(-0.75, 0.82, 0);
    const rightPillar = leftPillar.clone();
    rightPillar.position.set(0.75, 0.82, 0);
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.26, 0.36), archMat);
    topBeam.position.set(0, 1.65, 0);
    portal.add(leftPillar, rightPillar, topBeam);

    const gateRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.06, 10, 28),
      new THREE.MeshBasicMaterial({ color: colInfo.hex })
    );
    gateRing.position.set(0, 0.88, 0);
    portal.add(gateRing);
    animatedProps.push({ type: 'spinZ', mesh: gateRing, speed: 1.5 });

    // 下垂至协议层的光纤立柱
    const conduit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 6.5, 8),
      new THREE.MeshBasicMaterial({ color: colInfo.hex, transparent: true, opacity: 0.28 })
    );
    conduit.position.set(0, -3.4, 0);
    portal.add(conduit);

    const label = makeTextSprite(`入口 ${entry.id} · ${entry.name}`, {
      bg: 'rgba(8, 15, 30, 0.9)',
      border: colInfo.css,
      color: '#ffffff',
      fontSize: 24,
      scale: 1.82
    });
    label.position.set(0, 2.15, -0.25);
    portal.add(label);

    tv.group.add(portal);
    tv.portal = portal;
  }

  const exitVisuals = {};
  for (const exit of map.exits) {
    const tv = tileVisuals.get(keyOf(exit.x, exit.z));
    if (!tv) continue;
    const coreGroup = new THREE.Group();

    const basePed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.92, 0.35, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 })
    );
    basePed.position.y = 0.18;
    coreGroup.add(basePed);

    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
      metalness: 0.3,
      roughness: 0.1
    });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 1), crystalMat);
    crystal.position.y = 1.25;
    crystal.castShadow = true;
    coreGroup.add(crystal);

    const gyro1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.86, 0.055, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    gyro1.position.y = 1.25;
    coreGroup.add(gyro1);

    const gyro2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.04, 0.04, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0xa5f3fc })
    );
    gyro2.position.y = 1.25;
    gyro2.rotation.x = Math.PI / 3;
    coreGroup.add(gyro2);

    const deepBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.5, 8.0, 12),
      new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.25 })
    );
    deepBeam.position.y = -4.1;
    coreGroup.add(deepBeam);

    const label = makeTextSprite(`中枢 · ${exit.name}`, {
      bg: 'rgba(6, 24, 42, 0.92)',
      border: '#38bdf8',
      color: '#e0f2fe',
      fontSize: 24,
      scale: 1.85
    });
    label.position.set(0, 2.25, 0.55);
    coreGroup.add(label);

    tv.group.add(coreGroup);
    exitVisuals[exit.id] = { group: coreGroup, crystal, crystalMat, gyro1, gyro2, hitFlash: 0 };
  }

  return {
    root,
    tileVisuals,
    exitVisuals,
    animatedProps,
    shuttles,
    themePalette
  };
}

function buildObstacleFacility(group, theme, gx, gz, rackMat) {
  const seed = (gx * 13 + gz * 7) % 5;
  if (theme === 'enterprise') {
    // 企业内网：深灰金属基座 + 带顶部散热光圈与状态指示条的机柜阵列
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(TILE_SIZE * 0.88, 0.16, TILE_SIZE * 0.88),
      new THREE.MeshStandardMaterial({ color: 0x090f1a, roughness: 0.7, metalness: 0.6 })
    );
    base.position.y = -0.18;
    group.add(base);

    const h = 0.88 + (seed % 3) * 0.34;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.78 });
    const rack1 = new THREE.Mesh(new THREE.BoxGeometry(0.68, h, 0.68), [bodyMat, bodyMat, bodyMat, bodyMat, rackMat, rackMat]);
    rack1.position.set(-0.34, h / 2 - 0.08, -0.18);
    rack1.castShadow = true;
    rack1.receiveShadow = true;
    group.add(rack1);

    const capRing = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.24, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
    );
    capRing.rotation.x = -Math.PI / 2;
    capRing.position.set(-0.34, h - 0.07, -0.18);
    group.add(capRing);

    const h2 = h * 0.78;
    const rack2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, h2, 0.64), [bodyMat, bodyMat, bodyMat, bodyMat, rackMat, rackMat]);
    rack2.position.set(0.38, h2 / 2 - 0.08, 0.22);
    rack2.castShadow = true;
    group.add(rack2);
  } else if (theme === 'backbone') {
    // 骨干流域：跨网光缆中继锚塔与悬浮双环谐振电容
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.8, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.75, roughness: 0.4 })
    );
    base.position.y = -0.12;
    group.add(base);

    const h = 1.05 + (seed % 2) * 0.38;
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.44, h, 6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x4f46e5, emissiveIntensity: 0.28, metalness: 0.85, roughness: 0.25 })
    );
    spire.position.y = h / 2 - 0.05;
    spire.castShadow = true;
    group.add(spire);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.04, 8, 18),
      new THREE.MeshBasicMaterial({ color: seed % 2 === 0 ? 0x818cf8 : 0x38bdf8 })
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = h * 0.68;
    group.add(collar);
  } else {
    // 工控网：重型 PLC 控制柜与工业储压冷却罐（带琥珀/青绿仪表盘条）
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(TILE_SIZE * 0.88, 0.2, TILE_SIZE * 0.88),
      new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.7, metalness: 0.6 })
    );
    base.position.y = -0.16;
    group.add(base);

    if (seed % 2 === 0) {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 1.02, 12),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.32 })
      );
      tank.position.set(-0.26, 0.44, 0);
      tank.castShadow = true;
      group.add(tank);

      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.39, 0.035, 6, 18),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      band.rotation.x = Math.PI / 2;
      band.position.set(-0.26, 0.65, 0);
      group.add(band);

      const cabinet = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.82, 0.68),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.72, roughness: 0.38 })
      );
      cabinet.position.set(0.42, 0.34, 0.1);
      cabinet.castShadow = true;
      group.add(cabinet);
    } else {
      const plc = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 0.88, 0.78),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.35 })
      );
      plc.position.y = 0.36;
      plc.castShadow = true;
      group.add(plc);

      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.65, 0.24),
        new THREE.MeshBasicMaterial({ color: 0x14b8a6 })
      );
      screen.position.set(0, 0.52, 0.4);
      group.add(screen);
    }
  }
}

export function updateBattlefieldVisuals(sceneBundle, simTime, dt, simState) {
  // 1. 远景光梭与动态旋转件
  for (const sh of sceneBundle.shuttles) {
    const u = (simTime * sh.speed + sh.offset) % 1;
    sh.mesh.position.lerpVectors(sh.p1, sh.p2, u);
    sh.mesh.lookAt(sh.p2);
  }
  for (const p of sceneBundle.animatedProps) {
    if (p.type === 'halo') {
      p.mesh.rotation.z = simTime * p.speed;
      p.mesh.position.y = p.baseY + Math.sin(simTime * 1.6 + p.phase) * 0.22;
    } else if (p.type === 'spinZ') {
      p.mesh.rotation.z = simTime * p.speed;
    } else if (p.type === 'bob') {
      p.mesh.position.y = p.baseY + Math.sin(simTime * 2.5 + p.phase) * 0.12;
      p.mesh.rotation.y = simTime * 1.2;
    } else if (p.type === 'uvScroll') {
      p.tex.offset.x = (simTime * p.speedX) % 1;
    }
  }

  // 2. 中枢核心晶体动画
  for (const id of Object.keys(sceneBundle.exitVisuals)) {
    const ev = sceneBundle.exitVisuals[id];
    ev.crystal.rotation.y = simTime * 0.9;
    ev.crystal.position.y = 1.25 + Math.sin(simTime * 2.2) * 0.08;
    ev.gyro1.rotation.y = simTime * 1.3;
    ev.gyro1.rotation.x = Math.sin(simTime * 0.8) * 0.45;
    ev.gyro2.rotation.z = -simTime * 1.1;
    if (ev.hitFlash > 0) {
      ev.hitFlash = Math.max(0, ev.hitFlash - dt * 3.0);
      ev.crystalMat.emissive.setHex(ev.hitFlash > 0.2 ? 0xff1744 : 0x0284c7);
      ev.crystalMat.emissiveIntensity = 0.85 + ev.hitFlash * 1.8;
    }
  }

  // 3. 交换节点升降闸门与协议降级覆盖层
  if (!simState) return;
  for (const [k, tv] of sceneBundle.tileVisuals.entries()) {
    if (tv.type === TILE.NODE) {
      const nodeState = simState.nodeStates.get(k);
      const isIsolated = nodeState?.isolated || false;
      const targetGate = isIsolated ? 1 : 0;
      tv.gateProgress += (targetGate - tv.gateProgress) * Math.min(1, dt * 9.0);
      tv.gatePylons.position.y = -0.68 + tv.gateProgress * 0.68;
      tv.gatePylons.visible = tv.gateProgress > 0.03;
      tv.pylonMat.emissiveIntensity = tv.gateProgress * 0.65;
      tv.laserBarMat.opacity = tv.gateProgress * (0.48 + 0.2 * Math.sin(simTime * 8.0));

      if (isIsolated) {
        tv.statusMat.color.setHex(0xff5722);
        tv.cdMat.opacity = 0;
      } else if (nodeState && nodeState.reisolateCd > 0) {
        tv.statusMat.color.setHex(0x64748b);
        tv.cdMat.opacity = 0.72;
        tv.cdRing.scale.setScalar(0.75 + 0.25 * (nodeState.reisolateCd / 10.0));
      } else {
        tv.statusMat.color.setHex(0x10b981);
        tv.cdMat.opacity = 0;
      }
    }

    if (tv.downgradeOverlay) {
      const dg = simState.downgradedTiles.get(k);
      if (dg && dg > 0) {
        tv.downgradeOverlay.visible = true;
        tv.downgradeMat.opacity = 0.34 + 0.14 * Math.sin(simTime * 7.0);
      } else {
        tv.downgradeOverlay.visible = false;
      }
    }
  }
}

// ============================================================================
// 2. 六种己方防御塔建模与升级/分支外观变形 + 连续动画
// 视觉准则：亮银白陶瓷装甲主体 + 鲜明职业发光核心，与深色地形及暗红/紫恶意软件一眼区分！
// ============================================================================
const armorWhiteMat = () =>
  new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.28, metalness: 0.55 });
const darkTrimMat = () =>
  new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.42, metalness: 0.75 });

export function createTowerModel(tower) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const def = TOWERS[tower.type];
  const coreMat = new THREE.MeshStandardMaterial({
    color: def.color,
    emissive: def.color,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.4
  });
  const whiteMat = armorWhiteMat();
  const trimMat = darkTrimMat();

  // 己方统一识别白银底座环（让己方设备与地形/敌人瞬间区分）
  const baseCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.76, 0.14, 8), whiteMat);
  baseCollar.position.y = 0.07;
  baseCollar.castShadow = true;
  baseCollar.receiveShadow = true;
  body.add(baseCollar);

  const parts = { coreMat, whiteMat, trimMat, lv2Group: new THREE.Group(), branchAGroup: new THREE.Group(), branchBGroup: new THREE.Group() };
  parts.lv2Group.visible = false;
  parts.branchAGroup.visible = false;
  parts.branchBGroup.visible = false;
  body.add(parts.lv2Group, parts.branchAGroup, parts.branchBGroup);

  if (tower.type === 'firewall') {
    // 防火墙：厚重银白双翼盾墙 + 斜面防暴护肩 + 中央蓝光拦截矩阵
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.48), whiteMat);
    pillar.position.y = 0.47;
    pillar.castShadow = true;
    body.add(pillar);

    const trimCap = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.1, 0.52), trimMat);
    trimCap.position.y = 0.89;
    body.add(trimCap);

    // 前后可脉冲撞击的能量防暴盾组
    const makeRiotShield = (zSign) => {
      const sg = new THREE.Group();
      sg.position.set(0, 0.48, zSign * 0.27);
      const centerPlate = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.12), coreMat);
      const leftFlank = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.64, 0.1), whiteMat);
      leftFlank.position.set(-0.38, 0, -zSign * 0.05);
      leftFlank.rotation.y = zSign * 0.32;
      const rightFlank = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.64, 0.1), whiteMat);
      rightFlank.position.set(0.38, 0, -zSign * 0.05);
      rightFlank.rotation.y = -zSign * 0.32;
      const visorBar = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.08, 0.14), coreMat);
      visorBar.position.y = 0.16;
      sg.add(centerPlate, leftFlank, rightFlank, visorBar);
      return sg;
    };
    const shieldFront = makeRiotShield(1);
    const shieldBack = makeRiotShield(-1);
    body.add(shieldFront, shieldBack);
    parts.shields = [shieldFront, shieldBack];

    // 若部署在交换节点上：自动展开四向跨格力场发生桩，直观体现 2.4.1“节点跨路拦截”！
    if (tower.onNode) {
      const nodePylons = new THREE.Group();
      for (let r = 0; r < 4; r++) {
        const ang = (r * Math.PI) / 2;
        const py = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.24), coreMat);
        py.position.set(Math.sin(ang) * 0.72, 0.26, Math.cos(ang) * 0.72);
        py.rotation.y = ang;
        py.rotation.x = -0.22;
        nodePylons.add(py);
      }
      body.add(nodePylons);
      parts.nodePylons = nodePylons;
    }

    // Lv.2 深度包检墙：展开双侧高耸反应装甲翼、底座能量抑波环与顶部全息规则碑
    for (const sx of [-0.66, 0.66]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.92, 0.6), whiteMat);
      wing.position.set(sx, 0.58, 0);
      wing.rotation.z = -sx * 0.12;
      const wingStripe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.64, 0.12), coreMat);
      wingStripe.position.set(sx * 1.04, 0.58, 0);
      parts.lv2Group.add(wing, wingStripe);
    }
    const lv2Ring = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.04, 6, 24), coreMat);
    lv2Ring.rotation.x = Math.PI / 2;
    lv2Ring.position.y = 0.18;
    const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), coreMat);
    crest.position.set(0, 1.2, 0);
    parts.lv2Group.add(lv2Ring, crest);
    parts.crest = crest;
  } else if (tower.type === 'honeypot') {
    // 蜜罐：悬浮旋转金色十二面伪装金库核心 + 持续升腾的全息诱捕波纹环
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 0.34, 6), trimMat);
    ped.position.y = 0.24;
    body.add(ped);

    const lureCore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 0), coreMat);
    lureCore.position.y = 0.78;
    lureCore.castShadow = true;
    body.add(lureCore);
    parts.spinner = lureCore;

    const dishRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.045, 8, 24), whiteMat);
    dishRing.rotation.x = Math.PI / 2;
    dishRing.position.y = 0.78;
    body.add(dishRing);
    parts.dishRing = dishRing;

    // 2 道持续向上升腾扩散的诱饵全息波纹
    const lureWaveMat = new THREE.MeshBasicMaterial({ color: 0xffca28, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const lureWaves = [];
    for (let i = 0; i < 2; i++) {
      const lw = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.49, 20), lureWaveMat.clone());
      lw.rotation.x = -Math.PI / 2;
      body.add(lw);
      lureWaves.push(lw);
    }
    parts.lureWaves = lureWaves;

    // 分支 A（高交互蜜网）：三具机械悬臂搭载逆向溯源激光探针 + 底部蜜网矩阵环
    const traceRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.035, 6, 24), coreMat);
    traceRing.rotation.x = Math.PI / 2;
    traceRing.position.y = 0.86;
    parts.branchAGroup.add(traceRing);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.28), whiteMat);
      arm.position.set(Math.cos(a) * 0.56, 0.86, Math.sin(a) * 0.56);
      arm.rotation.y = -a;
      const probe = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.38, 5), coreMat);
      probe.position.set(Math.cos(a) * 0.72, 0.88, Math.sin(a) * 0.72);
      probe.rotation.z = Math.PI;
      parts.branchAGroup.add(arm, probe);
    }

    // 分支 B（镜像诱饵阵）：双侧悬浮投影基座 + 两具绕轨旋转的半透明全息分身金库
    const holoMat = new THREE.MeshBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.68 });
    for (const sx of [-0.68, 0.68]) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.1, 6), whiteMat);
      pad.position.set(sx, 0.38, 0);
      const decoy = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), holoMat);
      decoy.position.set(sx, 0.72, 0);
      const decoyHalo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 16), coreMat);
      decoyHalo.position.set(sx, 0.72, 0);
      parts.branchBGroup.add(pad, decoy, decoyHalo);
    }
  } else if (tower.type === 'airgap') {
    // 网闸：重装十字合金物理断路堡垒 + 左右对向液压机械闸钳 + 顶部双联旋转警示灯
    const bunker = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.68, 1.06), whiteMat);
    bunker.position.y = 0.42;
    bunker.castShadow = true;
    body.add(bunker);

    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.42, 0.34), trimMat);
    cross1.position.y = 0.48;
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 1.2), trimMat);
    cross2.position.y = 0.48;
    body.add(cross1, cross2);

    // 左右对向闭合机械液压闸爪
    const jawL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.56, 0.72), coreMat);
    jawL.position.set(-0.56, 0.48, 0);
    const jawR = jawL.clone();
    jawR.position.set(0.56, 0.48, 0);
    body.add(jawL, jawR);
    parts.jaws = [jawL, jawR];

    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.26, 8), coreMat);
    beacon.position.y = 0.9;
    const strobeBar = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 0.14), coreMat);
    strobeBar.position.y = 1.04;
    body.add(beacon, strobeBar);
    parts.beacon = beacon;
    parts.strobeBar = strobeBar;

    // Lv.2 单向物理光闸：加高八角钨钢重甲帽 + 旋转电磁阻尼线圈 + 四角液压避震柱
    const heavyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.38, 8), trimMat);
    heavyCap.position.y = 0.88;
    const dampRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.065, 8, 24), coreMat);
    dampRing.rotation.x = Math.PI / 2;
    dampRing.position.y = 0.72;
    parts.lv2Group.add(heavyCap, dampRing);
    for (const [cx, cz] of [[-0.54, -0.54], [0.54, -0.54], [-0.54, 0.54], [0.54, 0.54]]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.88, 6), whiteMat);
      strut.position.set(cx, 0.52, cz);
      parts.lv2Group.add(strut);
    }
    parts.dampRing = dampRing;
  } else if (tower.type === 'interceptor') {
    // 拦截器（有朝向 + 俯仰角！turret 控制水平朝向，pitchPivot 控制打空中伪热点抬头/打地面俯射）
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.56, 0.34, 8), trimMat);
    mount.position.y = 0.24;
    body.add(mount);

    const turret = new THREE.Group();
    turret.position.y = 0.52;
    body.add(turret);
    parts.turret = turret;

    // 地面方向指示箭头（保持水平贴近台面，让设定朝向一目了然！）
    const dirArrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.38, 4), coreMat);
    dirArrow.rotation.x = Math.PI / 2;
    dirArrow.position.set(0, -0.32, 0.82);
    turret.add(dirArrow);

    // 俯仰关节（打高空伪热点时自动仰起炮口，打低处链路地面怪时微微俯射！）
    const pitchPivot = new THREE.Group();
    turret.add(pitchPivot);
    parts.pitchPivot = pitchPivot;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.38, 0.68), whiteMat);
    head.castShadow = true;
    pitchPivot.add(head);

    const barrelGroup = new THREE.Group();
    pitchPivot.add(barrelGroup);
    parts.barrelGroup = barrelGroup;

    // Lv.1 标准脉冲炮管 + 前向准星导环
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.84, 8), coreMat);
    b1.rotation.x = Math.PI / 2;
    b1.position.set(0, 0.04, 0.52);
    const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 14), whiteMat);
    muzzleRing.position.set(0, 0.04, 0.88);
    barrelGroup.add(b1, muzzleRing);
    parts.lv1Barrel = barrelGroup;

    // 分支 A（穿透轨道炮）：加长双联磁轨长炮 + 3道发光加速线圈环 + 充能电容尾翼
    for (const sx of [-0.14, 0.14]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 1.34), coreMat);
      rail.position.set(sx, 0.06, 0.72);
      parts.branchAGroup.add(rail);
    }
    for (const zCoil of [0.46, 0.78, 1.1]) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.028, 6, 16), whiteMat);
      coil.position.set(0, 0.06, zCoil);
      parts.branchAGroup.add(coil);
    }
    for (const sx of [-0.42, 0.42]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.6), whiteMat);
      fin.position.set(sx, 0.12, -0.1);
      parts.branchAGroup.add(fin);
    }
    pitchPivot.add(parts.branchAGroup);

    // 分支 B（压制防空阵）：双侧高速旋转多管速射荚舱 + 顶部旋转相控阵雷达
    const rotaryPods = [];
    for (const sx of [-0.38, 0.38]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.58), whiteMat);
      pod.position.set(sx, 0.08, 0.2);
      const rotorCluster = new THREE.Group();
      rotorCluster.position.set(sx, 0.08, 0.56);
      for (let bi = 0; bi < 3; bi++) {
        const ba = (bi * Math.PI * 2) / 3;
        const miniB = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.28, 6), coreMat);
        miniB.rotation.x = Math.PI / 2;
        miniB.position.set(Math.cos(ba) * 0.065, Math.sin(ba) * 0.065, 0);
        rotorCluster.add(miniB);
      }
      parts.branchBGroup.add(pod, rotorCluster);
      rotaryPods.push(rotorCluster);
    }
    parts.rotaryPods = rotaryPods;
    const radar = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.15, 0.08), coreMat);
    radar.position.set(0, 0.38, -0.08);
    parts.branchBGroup.add(radar);
    parts.radar = radar;
    pitchPivot.add(parts.branchBGroup);
  } else if (tower.type === 'sandbox') {
    // 沙箱：悬浮青翠色半透明隔离检疫舱 + 外层线框笼 + 双正交陀螺扫描环
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, 0.28, 6), trimMat);
    ped.position.y = 0.21;
    body.add(ped);

    const glassChamber = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.48, 0.48),
      new THREE.MeshStandardMaterial({
        color: 0x00e676,
        emissive: 0x00c853,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.32,
        roughness: 0.15
      })
    );
    glassChamber.position.y = 0.78;
    body.add(glassChamber);
    parts.glassChamber = glassChamber;

    const cubeWire = new THREE.Mesh(
      new THREE.BoxGeometry(0.64, 0.64, 0.64),
      new THREE.MeshStandardMaterial({
        color: 0x00e676,
        emissive: 0x00c853,
        emissiveIntensity: 0.68,
        wireframe: true
      })
    );
    cubeWire.position.y = 0.78;
    body.add(cubeWire);
    parts.cubeWire = cubeWire;

    const innerEye = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), whiteMat);
    innerEye.position.y = 0.78;
    body.add(innerEye);
    parts.innerEye = innerEye;

    const scanRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.04, 8, 24), coreMat);
    scanRing.position.y = 0.78;
    const scanRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.028, 8, 24), whiteMat);
    scanRing2.position.y = 0.78;
    body.add(scanRing, scanRing2);
    parts.scanRing = scanRing;
    parts.scanRing2 = scanRing2;

    // Lv.2 启发式深度沙箱：外层大棱镜环与顶部深层启发式天眼扫描器
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.05, 8, 28), whiteMat);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = 0.78;
    const topScanner = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.38, 6), coreMat);
    topScanner.position.y = 1.34;
    topScanner.rotation.x = Math.PI;
    parts.lv2Group.add(outerRing, topScanner);
    parts.topScanner = topScanner;
  } else if (tower.type === 'repair') {
    // 修复进程：洁白医疗十字方尖碑 + 双螺旋恢复光环 + 展翼纳米修复无人机
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.44, 0.8, 6), whiteMat);
    spire.position.y = 0.48;
    spire.castShadow = true;
    body.add(spire);

    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.18), coreMat);
    crossH.position.set(0, 0.78, 0);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.54, 0.18), coreMat);
    crossV.position.set(0, 0.78, 0);
    body.add(crossH, crossV);
    parts.crossGroup = [crossH, crossV];

    const droneOrbit = new THREE.Group();
    droneOrbit.position.y = 0.98;
    body.add(droneOrbit);
    parts.droneOrbit = droneOrbit;

    const makeRepairDrone = (matMain, matWing) => {
      const dg = new THREE.Group();
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), matMain);
      const wings = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.1), matWing);
      dg.add(sphere, wings);
      return dg;
    };

    const drone1 = makeRepairDrone(coreMat, whiteMat);
    drone1.position.set(0.6, 0, 0);
    droneOrbit.add(drone1);

    // Lv.2 第二架高阶无人机 + 双环谐振顶冠
    const drone2 = makeRepairDrone(whiteMat, coreMat);
    drone2.position.set(-0.62, 0.1, 0);
    const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 6, 20), whiteMat);
    crownRing.rotation.x = Math.PI / 2;
    crownRing.position.y = 0.34;
    parts.lv2Group.add(drone2, crownRing);
    droneOrbit.add(parts.lv2Group);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.04, 8, 24), coreMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.18;
    body.add(halo);
    parts.halo = halo;
  }

  // 通用状态特效挂点：1) 蓝青护盾罩；2) 紫色加密数字锁链环
  const shieldDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.88, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28, wireframe: false, side: THREE.DoubleSide })
  );
  shieldDome.position.y = 0.12;
  shieldDome.visible = false;
  root.add(shieldDome);
  parts.shieldDome = shieldDome;

  const encryptGroup = new THREE.Group();
  const chainMat = new THREE.MeshBasicMaterial({ color: 0xe040fb });
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.045, 6, 18), chainMat);
  r1.rotation.x = Math.PI / 2.6;
  r1.position.y = 0.62;
  const r2 = r1.clone();
  r2.rotation.x = -Math.PI / 2.6;
  const lockBox = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.14), chainMat);
  lockBox.position.set(0, 1.32, 0);
  encryptGroup.add(r1, r2, lockBox);
  encryptGroup.visible = false;
  root.add(encryptGroup);
  parts.encryptGroup = encryptGroup;

  // 拾取碰撞盒
  const pick = new THREE.Mesh(
    getGeo('tower_pick', () => new THREE.CylinderGeometry(0.75, 0.75, 1.35, 8)),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  pick.position.y = 0.65;
  pick.userData = { pickType: 'tower', towerId: tower.id };
  root.add(pick);

  return { root, body, parts };
}

export function syncTowerAppearance(tower) {
  if (!tower.model) return;
  const { parts } = tower.model;
  if (tower.level >= 2) {
    if (tower.branch === 'A') {
      parts.branchAGroup.visible = true;
      parts.branchBGroup.visible = false;
      if (parts.lv1Barrel) parts.lv1Barrel.visible = false;
    } else if (tower.branch === 'B') {
      parts.branchAGroup.visible = false;
      parts.branchBGroup.visible = true;
      if (parts.lv1Barrel) parts.lv1Barrel.visible = false;
    } else {
      parts.lv2Group.visible = true;
    }
  }
}

export function updateTowerAnimation(tower, simTime, dt) {
  if (!tower.model) return;
  const { body, parts } = tower.model;

  // 登场展开动画 + 受击装甲红橙闪烁与晃动
  const deployScale = Math.min(1, tower.age / 0.28);
  const hitWobble = tower.hitAnim > 0 ? Math.sin(tower.hitAnim * 35) * 0.08 * tower.hitAnim : 0;
  body.scale.set(deployScale, Math.max(0.1, deployScale), deployScale);
  body.rotation.z = hitWobble;
  if (tower.hitAnim > 0) {
    parts.whiteMat.emissive.setHex(0xff3d00);
    parts.whiteMat.emissiveIntensity = tower.hitAnim * 0.72;
  } else {
    parts.whiteMat.emissiveIntensity = 0;
  }

  // 加密状态表现
  const isEncrypted = tower.encryptTimer > 0;
  parts.encryptGroup.visible = isEncrypted;
  if (isEncrypted) {
    parts.encryptGroup.rotation.y = simTime * 2.2;
    parts.coreMat.emissiveIntensity = 0.15;
  } else {
    parts.coreMat.emissiveIntensity = tower.skillActiveTimer > 0 ? 1.48 : 0.78;
  }

  // 护盾罩表现
  parts.shieldDome.visible = tower.shield > 1;
  if (parts.shieldDome.visible) {
    parts.shieldDome.rotation.y = simTime * 0.8;
  }

  // 各职业连续机械动作
  if (tower.type === 'firewall') {
    const recoil = tower.attackAnim > 0 ? Math.sin(tower.attackAnim * Math.PI) * 0.18 : 0;
    if (parts.shields) {
      parts.shields[0].position.z = 0.27 + recoil;
      parts.shields[1].position.z = -0.27 - recoil;
    }
    if (parts.nodePylons) {
      parts.nodePylons.scale.setScalar(1 + recoil * 0.45);
    }
    if (parts.crest) {
      parts.crest.rotation.y = simTime * 2.1;
      parts.crest.position.y = 1.2 + Math.sin(simTime * 3.2) * 0.05;
    }
  } else if (tower.type === 'honeypot') {
    parts.spinner.rotation.y = simTime * 1.45;
    parts.spinner.rotation.x = Math.sin(simTime * 1.1) * 0.25;
    parts.spinner.position.y = 0.78 + Math.sin(simTime * 3.0) * 0.07;
    parts.dishRing.scale.setScalar(1 + Math.sin(simTime * 4.2) * 0.08);
    if (parts.lureWaves) {
      for (let i = 0; i < parts.lureWaves.length; i++) {
        const u = ((simTime * 0.65 + i * 0.5) % 1);
        const lw = parts.lureWaves[i];
        lw.position.y = 0.35 + u * 0.85;
        lw.scale.setScalar(0.75 + u * 0.95);
        lw.material.opacity = isEncrypted ? 0 : (1 - u) * 0.52;
      }
    }
    parts.branchAGroup.rotation.y = -simTime * 2.1;
    parts.branchBGroup.rotation.y = simTime * 1.2;
  } else if (tower.type === 'airgap') {
    parts.beacon.scale.y = 1 + Math.sin(simTime * 5.0) * 0.15;
    if (parts.strobeBar) parts.strobeBar.rotation.y = simTime * 4.2;
    if (parts.jaws) {
      const clampOff = 0.56 + Math.sin(simTime * 2.2) * 0.025;
      parts.jaws[0].position.x = -clampOff;
      parts.jaws[1].position.x = clampOff;
    }
    if (parts.dampRing) parts.dampRing.rotation.z = simTime * 1.6;
  } else if (tower.type === 'interceptor') {
    // 平滑水平偏转 + 空地俯仰角动作（对空仰射伪热点、对地俯射链路怪！）
    const baseYaw = tower.dirAngle || 0;
    const aimOffset = tower.aimOffset || 0;
    parts.turret.rotation.y = baseYaw + aimOffset;

    const targetPitch = tower.aimPitch || 0;
    parts.curPitch = (parts.curPitch || 0) + (targetPitch - (parts.curPitch || 0)) * Math.min(1, dt * 10.0);
    if (parts.pitchPivot) {
      parts.pitchPivot.rotation.x = -parts.curPitch;
    }

    const kick = tower.attackAnim > 0 ? -Math.sin(tower.attackAnim * Math.PI) * 0.19 : 0;
    parts.barrelGroup.position.z = kick;
    parts.branchAGroup.position.z = kick * 1.25;
    if (parts.rotaryPods) {
      const spinSpd = tower.attackAnim > 0 ? 18.0 : 2.5;
      for (const rp of parts.rotaryPods) {
        rp.rotation.z += dt * spinSpd;
      }
    }
    if (parts.radar && !isEncrypted) parts.radar.rotation.y = simTime * 5.5;
  } else if (tower.type === 'sandbox') {
    if (!isEncrypted) {
      parts.cubeWire.rotation.x = simTime * 0.9;
      parts.cubeWire.rotation.y = simTime * 1.3;
      if (parts.glassChamber) parts.glassChamber.rotation.y = -simTime * 0.7;
      parts.scanRing.rotation.x = Math.PI / 3 + Math.sin(simTime * 2.0) * 0.5;
      parts.scanRing.rotation.y = simTime * 2.2;
      if (parts.scanRing2) {
        parts.scanRing2.rotation.y = -simTime * 1.7;
        parts.scanRing2.rotation.z = Math.PI / 4 + Math.cos(simTime * 1.8) * 0.4;
      }
      const pulse = tower.attackAnim > 0 ? 1 + Math.sin(tower.attackAnim * Math.PI) * 0.38 : 1;
      parts.innerEye.scale.setScalar(pulse);
      if (parts.topScanner) {
        parts.topScanner.position.y = 1.34 - (tower.attackAnim > 0 ? Math.sin(tower.attackAnim * Math.PI) * 0.12 : 0);
      }
    }
  } else if (tower.type === 'repair') {
    if (!isEncrypted) {
      parts.droneOrbit.rotation.y = simTime * 2.6;
      parts.droneOrbit.position.y = 0.98 + Math.sin(simTime * 3.2) * 0.06;
      parts.halo.scale.setScalar(1 + Math.sin(simTime * 3.5) * 0.07);
    }
  }
}

// ============================================================================
// 3. 应急隔离器（道具实体模型）
// ============================================================================
export function createIsolatorModel() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.55, 0.22, 6),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 })
  );
  base.position.y = 0.11;
  g.add(base);

  const pylon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, 0.86, 6),
    new THREE.MeshStandardMaterial({ color: 0xffab40, emissive: 0xff6d00, emissiveIntensity: 0.75 })
  );
  pylon.position.y = 0.55;
  g.add(pylon);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.045, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0xffd180 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.65;
  g.add(ring);

  return { root: g, ring };
}

// ============================================================================
// 4. 六种敌人与三位 Boss 的独立剪影建模与连续骨骼动作
// 视觉准则：暗黑曜石 + 猩红/毒紫/琥珀高危能量核，造型凌厉，与白银友塔及深蓝场景强烈对比！
// ============================================================================
export function createEnemyModel(enemy) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const darkShell = new THREE.MeshStandardMaterial({ color: 0x18121e, roughness: 0.35, metalness: 0.72 });
  const baseGlowHex = enemy.type === 'worm' && enemy.isClone ? 0xff9100 : enemy.def.color;
  const glowMat = new THREE.MeshStandardMaterial({
    color: baseGlowHex,
    emissive: baseGlowHex,
    emissiveIntensity: 0.88,
    roughness: 0.25,
    metalness: 0.35
  });

  const parts = { glowMat, darkShell };

  if (enemy.type === 'worm') {
    // 蠕虫：5节蜿蜒蠕动的甲壳体节 + 两侧6支摆动节肢步足 + 前端张合噬塔颚钳（母体猩红，复制体暖橙易区分！）
    const segs = [];
    const wormLegs = [];
    for (let i = 0; i < 5; i++) {
      const r = 0.24 - i * 0.028;
      const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), i === 0 ? glowMat : darkShell);
      if (i > 0) {
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(r * 0.92, 0.028, 6, 12), glowMat);
        seg.add(stripe);
      }
      if (i >= 1 && i <= 3) {
        for (const sx of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.045), glowMat);
          leg.position.set(sx * (r + 0.06), -0.04, 0);
          leg.rotation.z = -sx * 0.42;
          seg.add(leg);
          wormLegs.push({ mesh: leg, sx, idx: i });
        }
      }
      seg.position.set(0, r + 0.04, 0.32 - i * 0.21);
      seg.castShadow = true;
      body.add(seg);
      segs.push(seg);
    }
    // 左右颚钳
    const jawL = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.28, 4), glowMat);
    jawL.rotation.x = Math.PI / 2;
    jawL.position.set(-0.12, 0.24, 0.52);
    const jawR = jawL.clone();
    jawR.position.x = 0.12;
    body.add(jawL, jawR);
    parts.segs = segs;
    parts.wormLegs = wormLegs;
    parts.jaws = [jawL, jawR];
    if (enemy.isClone) {
      root.scale.setScalar(0.84);
    }
  } else if (enemy.type === 'flood') {
    // 洪泛团：重装攻城前铲 + 熔岩聚合核 + 4块环绕蓄力猛砸的液压破闸冲锤
    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 0), glowMat);
    core.position.y = 0.48;
    core.castShadow = true;
    body.add(core);
    parts.core = core;

    const prow = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.42, 4), darkShell);
    prow.rotation.x = Math.PI / 2;
    prow.rotation.z = Math.PI / 4;
    prow.position.set(0, 0.38, 0.42);
    body.add(prow);
    parts.prow = prow;

    const rams = [];
    for (let i = 0; i < 4; i++) {
      const ram = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.38), darkShell);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.11, 0.4), glowMat);
      ram.add(edge);
      ram.castShadow = true;
      body.add(ram);
      rams.push(ram);
    }
    parts.rams = rams;
  } else if (enemy.type === 'trojan') {
    // 木马：外层两瓣铰接“正常业务信封壳”（带蓝青校验环），显形时左右弹开翻折露出内部6足暗紫机械毒蝎！
    const innerGroup = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), darkShell);
    hull.scale.set(0.92, 0.72, 1.38);
    hull.position.y = 0.34;
    innerGroup.add(hull);

    // 6支毒蝎机械步足 + 双螯钳
    const scorpLegs = [];
    for (let i = 0; i < 6; i++) {
      const sx = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2) - 1;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.06), glowMat);
      leg.position.set(sx * 0.28, 0.24, row * 0.18);
      leg.rotation.z = -sx * 0.48;
      innerGroup.add(leg);
      scorpLegs.push({ mesh: leg, sx, idx: i });
    }
    for (const sx of [-0.18, 0.18]) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 4), glowMat);
      claw.rotation.x = Math.PI / 2;
      claw.position.set(sx, 0.3, 0.42);
      innerGroup.add(claw);
    }

    // 多关节蝎尾毒刺
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.42, -0.2);
    const tailArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), glowMat);
    tailArm.position.set(0, 0.19, -0.05);
    tailArm.rotation.x = 0.45;
    const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 5), glowMat);
    stinger.rotation.x = Math.PI / 2;
    stinger.position.set(0, 0.38, 0.14);
    tailPivot.add(tailArm, stinger);
    innerGroup.add(tailPivot);
    body.add(innerGroup);
    parts.innerGroup = innerGroup;
    parts.scorpLegs = scorpLegs;
    parts.tailPivot = tailPivot;

    // 伪装正常数据包双瓣外壳（显形时平滑向两侧裂开翻折！）
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.48,
      transparent: true,
      opacity: 0.82
    });
    const disguiseShell = new THREE.Group();
    disguiseShell.position.y = 0.38;
    const halfGeo = new THREE.BoxGeometry(0.31, 0.56, 0.62);
    const shellL = new THREE.Mesh(halfGeo, shellMat);
    shellL.position.set(-0.16, 0, 0);
    const shellR = new THREE.Mesh(halfGeo, shellMat);
    shellR.position.set(0.16, 0, 0);
    const verifyBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.03, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 })
    );
    verifyBand.rotation.x = Math.PI / 2;
    disguiseShell.add(shellL, shellR, verifyBand);
    body.add(disguiseShell);
    parts.disguiseShell = disguiseShell;
    parts.shellL = shellL;
    parts.shellR = shellR;
    parts.shellMat = shellMat;
    parts.verifyBand = verifyBand;
    parts.openProgress = enemy.disguised ? 0 : 1;
  } else if (enemy.type === 'ransom') {
    // 勒索者：悬浮黑曜石方尖碑 + 机械爪臂托举旋转密码锁轮盘炮
    const pyramid = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.84, 4), darkShell);
    pyramid.position.y = 0.56;
    pyramid.rotation.x = Math.PI;
    pyramid.castShadow = true;
    body.add(pyramid);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10), glowMat);
    eye.position.set(0, 0.66, 0.22);
    body.add(eye);
    parts.eye = eye;

    const cipherArms = [];
    for (const sx of [-1, 1]) {
      const armPivot = new THREE.Group();
      armPivot.position.set(sx * 0.28, 0.62, 0.05);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.08), darkShell);
      strut.position.set(sx * 0.1, 0, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 6, 16), glowMat);
      ring.position.set(sx * 0.2, 0, 0.08);
      ring.rotation.y = Math.PI / 2;
      const lockCore = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.14), glowMat);
      lockCore.position.set(sx * 0.2, 0, 0.08);
      armPivot.add(strut, ring, lockCore);
      body.add(armPivot);
      cipherArms.push({ armPivot, ring, sx });
    }
    parts.cipherArms = cipherArms;
  } else if (enemy.type === 'rogue_ap') {
    // 伪热点（无线层飞行！y = 1.68，三旋翼独立高速旋转 + 下射信号波环 + 地面投影垂线，高度层次一目了然）
    body.position.y = 1.68;
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.24, 0.16, 6), darkShell);
    saucer.castShadow = true;
    body.add(saucer);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), glowMat);
    dome.position.y = 0.1;
    body.add(dome);

    const rotors = [];
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const boom = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.48), darkShell);
      boom.position.set(Math.cos(a) * 0.32, 0.02, Math.sin(a) * 0.32);
      boom.rotation.y = -a;
      body.add(boom);

      const bladeHub = new THREE.Group();
      bladeHub.position.set(Math.cos(a) * 0.52, 0.07, Math.sin(a) * 0.52);
      const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.05), glowMat);
      const blade2 = blade1.clone();
      blade2.rotation.y = Math.PI / 2;
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 14), glowMat);
      guard.rotation.x = Math.PI / 2;
      bladeHub.add(blade1, blade2, guard);
      body.add(bladeHub);
      rotors.push(bladeHub);
    }
    parts.rotors = rotors;

    // 向下扩散的无线干扰波纹 + 垂直高度导引细线 + 地面靶心投影锚圈
    const wifiWave = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.25, 18),
      new THREE.MeshBasicMaterial({ color: 0x18ffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    wifiWave.rotation.x = -Math.PI / 2;
    body.add(wifiWave);
    parts.wifiWave = wifiWave;

    const altLine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 1.6, 6),
      new THREE.MeshBasicMaterial({ color: 0x18ffff, transparent: true, opacity: 0.22 })
    );
    altLine.position.y = 0.84;
    root.add(altLine);

    const groundShadow = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.4, 20),
      new THREE.MeshBasicMaterial({ color: 0x18ffff, transparent: true, opacity: 0.62, side: THREE.DoubleSide })
    );
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.y = 0.04;
    root.add(groundShadow);
    parts.groundShadow = groundShadow;
  } else if (enemy.type === 'packer') {
    // 加壳器：4足机械步行的六棱护盾编译器 + 3片悬浮绕转的黄金护盾晶板
    const chassis = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.44, 6), darkShell);
    chassis.position.y = 0.48;
    chassis.castShadow = true;
    body.add(chassis);

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), glowMat);
    crystal.position.y = 0.86;
    body.add(crystal);
    parts.crystal = crystal;

    const plateOrbit = new THREE.Group();
    plateOrbit.position.y = 0.84;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.05), glowMat);
      pl.position.set(Math.cos(a) * 0.46, 0, Math.sin(a) * 0.46);
      pl.rotation.y = -a + Math.PI / 2;
      plateOrbit.add(pl);
    }
    body.add(plateOrbit);
    parts.plateOrbit = plateOrbit;

    const legs = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.1), glowMat);
      leg.position.set(Math.cos(a) * 0.34, 0.22, Math.sin(a) * 0.34);
      body.add(leg);
      legs.push(leg);
    }
    parts.legs = legs;
  } else if (enemy.type === 'wankuai') {
    // Boss 1：万傀（分段内网，巨型6足僵尸网络母巢蜘蛛王，二阶段展开裂变孵化翼！）
    const abdomen = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 1), darkShell);
    abdomen.scale.set(1.06, 0.8, 1.34);
    abdomen.position.set(0, 0.78, -0.2);
    abdomen.castShadow = true;
    body.add(abdomen);

    // 腹部发光孵化囊节点
    for (const [px, py, pz] of [[-0.45, 0.95, -0.35], [0.45, 0.95, -0.35], [0, 1.05, -0.68]]) {
      const pod = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), glowMat);
      pod.position.set(px, py, pz);
      body.add(pod);
    }

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.48, 0.62), glowMat);
    head.position.set(0, 0.72, 0.62);
    body.add(head);

    // 背部 C&C 控制信号塔 + 二阶段裂变展开双翼
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.95, 6), glowMat);
    spire.position.set(0, 1.48, -0.15);
    body.add(spire);
    parts.bossSpire = spire;

    const phase2Wings = new THREE.Group();
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.46), glowMat);
      w.position.set(sx * 0.75, 1.25, -0.18);
      w.rotation.z = sx * 0.42;
      phase2Wings.add(w);
    }
    phase2Wings.visible = false;
    body.add(phase2Wings);
    parts.phase2Wings = phase2Wings;

    const legs = [];
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2) - 1;
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.58, 0.62, row * 0.45);
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.14), darkShell);
      legMesh.position.set(side * 0.26, -0.22, 0);
      legMesh.rotation.z = -side * 0.65;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.48, 4), glowMat);
      tip.position.set(side * 0.52, -0.5, 0);
      tip.rotation.z = Math.PI;
      pivot.add(legMesh, tip);
      body.add(pivot);
      legs.push({ pivot, side, idx: i });
    }
    parts.spiderLegs = legs;
  } else if (enemy.type === 'shenlou') {
    // Boss 2：蜃楼（骨干流域，悬浮棱镜利维坦巨舰 + 双正交旋转吸积盘 + 6片波动翼鳍 + 二阶段风暴光冕）
    body.position.y = 0.55;
    const coreHole = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x160424 })
    );
    coreHole.position.y = 0.55;
    body.add(coreHole);

    const accretion = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.08, 10, 28), glowMat);
    accretion.rotation.x = Math.PI / 2.3;
    accretion.position.y = 0.55;
    const accretion2 = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.045, 8, 28), glowMat);
    accretion2.rotation.y = Math.PI / 3;
    accretion2.position.y = 0.55;
    body.add(accretion, accretion2);
    parts.accretion = accretion;
    parts.accretion2 = accretion2;

    const stormRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.055, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xff9100 })
    );
    stormRing.rotation.x = Math.PI / 2;
    stormRing.position.y = 0.55;
    stormRing.visible = false;
    body.add(stormRing);
    parts.stormRing = stormRing;

    const fins = [];
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const zOff = (Math.floor(i / 2) - 1) * 0.48;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.1, 0.34), i < 2 ? glowMat : darkShell);
      fin.position.set(side * 0.8, 0.55, zOff);
      body.add(fin);
      fins.push({ mesh: fin, side, idx: i });
    }
    parts.fins = fins;
  } else if (enemy.type === 'zheying') {
    // Boss 3：蛰影（气隙深层，暗影执政官机甲：1阶潜伏线框幻影罩 -> 2阶黑金提权重甲翼 -> 3阶猩红X翼超载锁死光轮！）
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.28, 1.18, 6), darkShell);
    torso.position.y = 0.98;
    torso.castShadow = true;
    body.add(torso);
    parts.torso = torso;

    const reactor = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), glowMat);
    reactor.position.set(0, 1.08, 0.35);
    body.add(reactor);
    parts.reactor = reactor;

    const helm = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 5), glowMat);
    helm.position.set(0, 1.78, 0.05);
    body.add(helm);

    // 1阶潜伏：外覆半透明光学隐匿线框罩
    const cloakCage = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.95, 0),
      new THREE.MeshBasicMaterial({ color: 0xb388ff, wireframe: true, transparent: true, opacity: 0.45 })
    );
    cloakCage.position.y = 1.05;
    body.add(cloakCage);
    parts.cloakCage = cloakCage;

    // 3阶破坏：背后竖立巨型猩红锁死光轮
    const lockHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.065, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xff1744 })
    );
    lockHalo.position.set(0, 1.28, -0.32);
    lockHalo.visible = false;
    body.add(lockHalo);
    parts.lockHalo = lockHalo;

    // 悬浮四刃肩翼（随阶段展开变色！）
    const blades = [];
    for (let i = 0; i < 4; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const upper = i < 2 ? 1 : -1;
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.92, 0.34), i < 2 ? glowMat : darkShell);
      bl.position.set(side * 0.78, 1.18 + upper * 0.24, -0.18);
      bl.rotation.z = side * (0.35 + upper * 0.15);
      body.add(bl);
      blades.push({ mesh: bl, side, upper });
    }
    parts.blades = blades;
  }

  // 敌方护盾环（当获得加壳器或阶段护盾时显示）
  const shieldRing = new THREE.Mesh(
    new THREE.SphereGeometry(enemy.isBoss ? 1.15 : 0.56, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.26, wireframe: true })
  );
  shieldRing.position.y = enemy.flying ? 1.68 : 0.48;
  shieldRing.visible = false;
  root.add(shieldRing);
  parts.shieldRing = shieldRing;

  // 诱捕定身牢笼圈
  const snareRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.55, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffca28, transparent: true, opacity: 0.52, wireframe: true })
  );
  snareRing.position.y = 0.28;
  snareRing.visible = false;
  root.add(snareRing);
  parts.snareRing = snareRing;

  // 拾取盒
  const pick = new THREE.Mesh(
    new THREE.SphereGeometry(enemy.isBoss ? 1.1 : 0.58, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  pick.position.y = enemy.flying ? 1.68 : 0.55;
  pick.userData = { pickType: 'enemy', enemyId: enemy.id };
  root.add(pick);

  return { root, body, parts };
}

export function updateEnemyAnimation(enemy, simTime, dt) {
  if (!enemy.model) return;
  const { root, body, parts } = enemy.model;

  // 平滑转向行进方向
  let diff = enemy.heading - root.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  root.rotation.y += diff * Math.min(1, dt * 11.0);

  // 退场崩解动画
  if (enemy.dyingTimer > 0) {
    const p = 1 - enemy.dyingTimer / 0.32;
    body.scale.setScalar(Math.max(0.05, 1 - p * 0.85));
    body.position.y += dt * 1.8;
    body.rotation.y += dt * 10;
    return;
  }

  // 受击后仰与甲壳闪白反馈
  const hitTilt = enemy.hitAnim > 0 ? -Math.sin(enemy.hitAnim * Math.PI) * 0.24 : 0;
  body.rotation.x = hitTilt;
  if (enemy.hitAnim > 0) {
    parts.darkShell.emissive.setHex(0xffffff);
    parts.darkShell.emissiveIntensity = enemy.hitAnim * 0.38;
  } else {
    parts.darkShell.emissiveIntensity = 0;
  }

  // 护盾与诱捕可视化
  parts.shieldRing.visible = enemy.shield > 1;
  if (parts.shieldRing.visible) parts.shieldRing.rotation.y = -simTime * 1.8;
  parts.snareRing.visible = enemy.snareTimer > 0;
  if (parts.snareRing.visible) parts.snareRing.rotation.y = simTime * 3.0;

  const t = simTime * (enemy.snareTimer > 0 ? 1.5 : 6.5) + enemy.animSeed;

  if (enemy.type === 'worm') {
    const lunge = enemy.attackAnim > 0 ? Math.sin(enemy.attackAnim * Math.PI) * 0.22 : 0;
    body.position.z = lunge;
    for (let i = 0; i < parts.segs.length; i++) {
      parts.segs[i].position.x = Math.sin(t - i * 0.85) * 0.11;
      parts.segs[i].position.y = 0.24 - i * 0.028 + Math.abs(Math.cos(t - i * 0.85)) * 0.06;
    }
    if (parts.wormLegs) {
      for (const wl of parts.wormLegs) {
        wl.mesh.rotation.y = Math.sin(t * 1.3 + wl.idx) * 0.35 * wl.sx;
      }
    }
    const bite = enemy.attackAnim > 0 ? Math.sin(enemy.attackAnim * Math.PI) * 0.38 : 0.09 * Math.sin(t * 1.5);
    parts.jaws[0].rotation.y = bite;
    parts.jaws[1].rotation.y = -bite;
  } else if (enemy.type === 'flood') {
    parts.core.rotation.x = t * 0.4;
    parts.core.rotation.y = t * 0.55;
    const slam = enemy.attackAnim > 0 ? Math.sin(enemy.attackAnim * Math.PI) * 0.52 : 0;
    if (parts.prow) parts.prow.position.z = 0.42 + slam * 0.65;
    for (let i = 0; i < parts.rams.length; i++) {
      const a = t * 0.55 + (i * Math.PI) / 2;
      parts.rams[i].position.set(Math.cos(a) * 0.54, 0.46 + Math.sin(t + i) * 0.07, Math.sin(a) * 0.54 + slam);
      parts.rams[i].rotation.y = -a;
    }
  } else if (enemy.type === 'trojan') {
    // 伪装壳开裂动画：显形后两瓣外壳平滑弹开后折，露出内部蠕动毒蝎与甩尾毒刺！
    const targetOpen = enemy.disguised ? 0 : 1;
    parts.openProgress += (targetOpen - parts.openProgress) * Math.min(1, dt * 8.5);
    const op = parts.openProgress;
    if (op < 0.98) {
      parts.disguiseShell.visible = true;
      parts.verifyBand.visible = op < 0.25;
      parts.shellL.position.x = -0.16 - op * 0.28;
      parts.shellR.position.x = 0.16 + op * 0.28;
      parts.shellL.rotation.z = op * 0.85;
      parts.shellR.rotation.z = -op * 0.85;
      parts.shellMat.opacity = 0.82 * (1 - op * 0.72);
      if (op < 0.05) {
        parts.disguiseShell.rotation.y = Math.sin(simTime * 2.2) * 0.08;
      } else {
        parts.disguiseShell.rotation.y = 0;
      }
    } else {
      parts.disguiseShell.visible = false;
    }
    if (parts.scorpLegs) {
      for (const sl of parts.scorpLegs) {
        sl.mesh.rotation.y = Math.sin(t * 1.4 + sl.idx * 0.9) * 0.28 * sl.sx;
      }
    }
    parts.tailPivot.rotation.x = Math.sin(t * 1.2) * 0.35 + (enemy.attackAnim > 0 ? 0.68 : 0);
  } else if (enemy.type === 'ransom') {
    body.position.y = Math.sin(t * 0.6) * 0.07;
    const shotKick = enemy.attackAnim > 0 ? Math.sin(enemy.attackAnim * Math.PI) * 0.25 : 0;
    if (parts.eye) parts.eye.scale.setScalar(1 + shotKick * 0.5);
    for (const ca of parts.cipherArms) {
      ca.ring.rotation.x = simTime * 3.8 * ca.sx;
      ca.armPivot.position.z = 0.05 + shotKick * 0.45;
    }
  } else if (enemy.type === 'rogue_ap') {
    body.position.y = 1.68 + Math.sin(simTime * 3.8 + enemy.animSeed) * 0.09;
    for (const r of parts.rotors) {
      r.rotation.y = simTime * 18.0;
    }
    if (parts.wifiWave) {
      const wu = (simTime * 0.9 + enemy.animSeed) % 1;
      parts.wifiWave.position.y = -wu * 1.45;
      parts.wifiWave.scale.setScalar(0.8 + wu * 1.35);
      parts.wifiWave.material.opacity = (1 - wu) * 0.45;
    }
    body.rotation.z = -diff * 0.6; // 转向侧倾
    parts.groundShadow.scale.setScalar(0.9 + Math.sin(simTime * 5.0) * 0.12);
  } else if (enemy.type === 'packer') {
    if (parts.plateOrbit) parts.plateOrbit.rotation.y = simTime * 2.2;
    if (parts.crystal) parts.crystal.rotation.y = -simTime * 3.0;
    for (let i = 0; i < parts.legs.length; i++) {
      parts.legs[i].rotation.x = Math.sin(t + (i % 2) * Math.PI) * 0.38;
    }
  } else if (enemy.type === 'wankuai') {
    for (const lg of parts.spiderLegs) {
      lg.pivot.rotation.y = Math.sin(t * 0.85 + lg.idx * 1.1) * 0.28;
      lg.pivot.rotation.z = Math.cos(t * 0.85 + lg.idx * 1.1) * 0.16;
    }
    if (enemy.bossPhase >= 2) {
      parts.bossSpire.scale.set(1.35, 1.35 + Math.sin(simTime * 8) * 0.2, 1.35);
      if (parts.phase2Wings) parts.phase2Wings.visible = true;
      parts.glowMat.emissive.setHex(0xff1744);
      parts.glowMat.emissiveIntensity = 1.35;
    }
  } else if (enemy.type === 'shenlou') {
    body.position.y = 0.55 + Math.sin(simTime * 2.2) * 0.12;
    parts.accretion.rotation.z = simTime * (enemy.bossPhase >= 2 ? 4.5 : 2.0);
    if (parts.accretion2) parts.accretion2.rotation.x = -simTime * (enemy.bossPhase >= 2 ? 3.6 : 1.5);
    if (parts.stormRing) {
      parts.stormRing.visible = enemy.bossPhase >= 2;
      parts.stormRing.rotation.z = -simTime * 3.0;
    }
    for (const f of parts.fins) {
      const flare = enemy.bossPhase >= 2 ? 0.38 : 0.15;
      f.mesh.rotation.z = f.side * (Math.sin(simTime * 3.2 + f.idx * 0.7) * flare);
    }
  } else if (enemy.type === 'zheying') {
    body.position.y = 0.12 + Math.sin(simTime * 2.4) * 0.08;
    parts.reactor.rotation.y = simTime * 3.0;
    // 三阶段显著形态变化：潜伏(半透明蓝紫线框罩) -> 提权(黑金护甲张开) -> 破坏(猩红超载X翼刃+背负锁死光轮)
    if (enemy.bossPhase === 1) {
      parts.darkShell.transparent = true;
      parts.darkShell.opacity = enemy.disguised ? 0.42 : 0.82;
      if (parts.cloakCage) {
        parts.cloakCage.visible = true;
        parts.cloakCage.rotation.y = -simTime * 1.2;
      }
      if (parts.lockHalo) parts.lockHalo.visible = false;
      parts.glowMat.color.setHex(0xb388ff);
      parts.glowMat.emissive.setHex(0x7c4dff);
    } else if (enemy.bossPhase === 2) {
      parts.darkShell.transparent = false;
      parts.darkShell.opacity = 1.0;
      if (parts.cloakCage) parts.cloakCage.visible = false;
      if (parts.lockHalo) parts.lockHalo.visible = false;
      parts.glowMat.color.setHex(0xffca28);
      parts.glowMat.emissive.setHex(0xff8f00);
      for (const b of parts.blades) {
        b.mesh.position.x = b.side * 0.98;
      }
    } else {
      parts.darkShell.transparent = false;
      parts.darkShell.opacity = 1.0;
      if (parts.cloakCage) parts.cloakCage.visible = false;
      if (parts.lockHalo) {
        parts.lockHalo.visible = true;
        parts.lockHalo.rotation.z = simTime * 2.8;
      }
      parts.glowMat.color.setHex(0xff1744);
      parts.glowMat.emissive.setHex(0xd50000);
      parts.glowMat.emissiveIntensity = 1.45;
      for (const b of parts.blades) {
        b.mesh.position.x = b.side * 1.15;
        b.mesh.rotation.x = Math.sin(simTime * 6) * 0.25;
      }
    }
  }
}
