// 三维路线导引带、改道虚线预览、封死警示、攻击弹道/光束、首领地形预警与黑洞/锁死屏障特效

import * as THREE from 'three';
import { ENTRY_COLORS, TILE_SIZE, TOWERS, ITEMS } from './constants.js';
import { gridToWorld } from './pathfinding.js';
import { getTextures } from './textures.js';

const LANE_OFFSETS = {
  A: -0.24,
  C: 0.0,
  B: 0.24
};

export class VFXManager {
  constructor(scene, map) {
    this.scene = scene;
    this.map = map;
    this.tex = getTextures();

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.routeGroup = new THREE.Group();
    this.businessTrafficGroup = new THREE.Group();
    this.previewRouteGroup = new THREE.Group();
    this.blockedMarkerGroup = new THREE.Group();
    this.placementGroup = new THREE.Group();
    this.hazardGroup = new THREE.Group();
    this.tetherGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();

    this.root.add(
      this.routeGroup,
      this.businessTrafficGroup,
      this.previewRouteGroup,
      this.blockedMarkerGroup,
      this.placementGroup,
      this.hazardGroup,
      this.tetherGroup,
      this.fxGroup
    );

    this.activeRouteMeshes = {}; // entryId -> { mesh, mat, tex, flashTimer }
    this.businessStreams = []; // 承载正常业务流量的光学微帧流（直观体现“链路同时承载正常业务”）
    this.previewMeshes = [];
    this.tetherMeshes = [];
    this.beams = [];
    this.rings = [];
    this.particles = [];
    this.zones = []; // 沙箱2级特征码驻留区 Visuals
    this.hazardMeshes = new Map(); // id -> Group (黑洞 / 锁死屏障 / 预警框)

    this._initPlacementHelpers();
  }

  _initPlacementHelpers() {
    // 格子选中高亮框
    const tileMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.tileCursor = new THREE.Mesh(new THREE.RingGeometry(0.76, 0.94, 4), tileMat);
    this.tileCursor.rotation.x = -Math.PI / 2;
    this.tileCursor.rotation.z = Math.PI / 4;
    this.tileCursor.visible = false;
    this.placementGroup.add(this.tileCursor);

    // 圆形作用范围预览圈
    this.rangeCircleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.rangeCircle = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.rangeCircleMat);
    this.rangeCircle.rotation.x = -Math.PI / 2;
    this.rangeCircle.visible = false;
    this.placementGroup.add(this.rangeCircle);

    this.rangeBorder = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1.0, 48),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    this.rangeBorder.rotation.x = -Math.PI / 2;
    this.rangeBorder.visible = false;
    this.placementGroup.add(this.rangeBorder);

    // 拦截器矩形定向射界预览框
    this.dirSectorGroup = new THREE.Group();
    const boxPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    boxPlane.rotation.x = -Math.PI / 2;
    boxPlane.position.set(0, 0, 0.5);
    this.dirBoxPlane = boxPlane;

    const borderPts = [
      new THREE.Vector3(-0.5, 0, 0),
      new THREE.Vector3(0.5, 0, 0),
      new THREE.Vector3(0.5, 0, 1),
      new THREE.Vector3(-0.5, 0, 1),
      new THREE.Vector3(-0.5, 0, 0)
    ];
    this.dirBorderLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(borderPts),
      new THREE.LineBasicMaterial({ color: 0x00e5ff })
    );
    this.dirSectorInner = new THREE.Group();
    this.dirSectorInner.add(boxPlane, this.dirBorderLine);
    this.dirSectorGroup.add(this.dirSectorInner);
    this.dirSectorGroup.visible = false;
    this.placementGroup.add(this.dirSectorGroup);
  }

  // 构建光滑带偏移的路线流光丝带几何体
  _buildRibbonMesh(path, laneOffset, yHeight, colorHex, texSource, width = 0.28, opacity = 0.86) {
    if (!path || path.length < 2) return null;

    const rawPts = path.map((p) => {
      const w = gridToWorld(this.map, p.x, p.z, yHeight);
      return new THREE.Vector3(w.x, yHeight, w.z);
    });

    // 对拐角做轻微圆角插值，使路线优美流畅且严格贴合道路内侧
    const pts = [rawPts[0]];
    for (let i = 1; i < rawPts.length - 1; i++) {
      const prev = rawPts[i - 1];
      const cur = rawPts[i];
      const next = rawPts[i + 1];
      const pA = new THREE.Vector3().lerpVectors(cur, prev, 0.22);
      const pB = new THREE.Vector3().lerpVectors(cur, next, 0.22);
      pts.push(pA, cur, pB);
    }
    pts.push(rawPts[rawPts.length - 1]);

    // 计算横向法线并施加入口专属车道偏移，避免多路重叠遮挡
    const positions = [];
    const uvs = [];
    const indices = [];
    let accLen = 0;

    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const tangent = new THREE.Vector3().subVectors(next, prev);
      if (tangent.lengthSq() < 1e-6) tangent.set(0, 0, 1);
      tangent.normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);

      if (i > 0) accLen += cur.distanceTo(prev);

      const center = cur.clone().addScaledVector(side, laneOffset);
      const left = center.clone().addScaledVector(side, -width * 0.5);
      const right = center.clone().addScaledVector(side, width * 0.5);

      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      const u = accLen * 0.72;
      uvs.push(u, 0, u, 1);

      if (i < pts.length - 1) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);

    const clonedTex = texSource.clone();
    clonedTex.wrapS = THREE.RepeatWrapping;
    clonedTex.wrapT = THREE.RepeatWrapping;
    clonedTex.needsUpdate = true;

    const mat = new THREE.MeshBasicMaterial({
      map: clonedTex,
      color: colorHex,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 8;
    return { mesh, mat, tex: clonedTex };
  }

  // 更新当前全部入口的实时路线标记（changedEntries 触发高亮扫掠动效）
  rebuildActiveRoutes(routes, changedEntries = []) {
    while (this.routeGroup.children.length > 0) {
      const ch = this.routeGroup.children.pop();
      if (ch.geometry) ch.geometry.dispose();
    }
    while (this.businessTrafficGroup.children.length > 0) {
      this.businessTrafficGroup.children.pop();
    }
    this.activeRouteMeshes = {};
    this.businessStreams = [];

    const packetGeo = new THREE.BoxGeometry(0.14, 0.04, 0.28);

    const entryIdxMap = { A: 0, C: 1, B: 2 };
    for (const entry of this.map.entries) {
      const r = routes[entry.id];
      if (!r || !r.path) continue;
      const col = ENTRY_COLORS[entry.id] || ENTRY_COLORS.A;
      const lane = LANE_OFFSETS[entry.id] ?? 0;
      const y = 0.055 + (entryIdxMap[entry.id] || 0) * 0.012;
      const built = this._buildRibbonMesh(r.path, lane, y, col.hex, this.tex.routeArrow, 0.28, 0.85);
      if (built) {
        this.routeGroup.add(built.mesh);
        this.activeRouteMeshes[entry.id] = {
          ...built,
          flashTimer: changedEntries.includes(entry.id) ? 2.0 : 0
        };
      }

      // 构建沿当前有效链路匀速传输的正常业务光学微数据包（扁平贴地，与立体敌军明显区分）
      if (r.path.length >= 2) {
        const pts = r.path.map((p) => {
          const w = gridToWorld(this.map, p.x, p.z, 0.085);
          return new THREE.Vector3(w.x, 0.085, w.z);
        });
        const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.15);
        const pktMat = new THREE.MeshBasicMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.62,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const pktCount = Math.max(4, Math.min(8, Math.floor(r.path.length * 0.45)));
        const packets = [];
        for (let k = 0; k < pktCount; k++) {
          const pm = new THREE.Mesh(packetGeo, pktMat);
          this.businessTrafficGroup.add(pm);
          packets.push({ mesh: pm, phase: k / pktCount });
        }
        this.businessStreams.push({
          curve,
          laneOffset: lane * 0.85,
          speed: 1 / Math.max(3.5, r.path.length * 0.36),
          packets
        });
      }
    }
  }

  // 显示改道预览路线（虚线高亮流光）或封死位置红圈警示
  showRoutePreview(previewResult, currentRoutes) {
    this.clearRoutePreview();
    if (!previewResult) return;

    if (!previewResult.ok) {
      // 操作被拒：标出会被封死的入口或受困地面敌人位置！（2.12.1）
      const markPos = (wx, wz) => {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.65, 0.95, 28),
          new THREE.MeshBasicMaterial({ color: 0xff1744, side: THREE.DoubleSide, transparent: true, opacity: 0.92, depthTest: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(wx, 0.2, wz);
        ring.renderOrder = 22;

        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.45, 3.2, 12),
          new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.42, depthWrite: false })
        );
        beam.position.set(wx, 1.6, wz);
        this.blockedMarkerGroup.add(ring, beam);
      };

      for (const ent of previewResult.blockedEntries || []) {
        const wp = gridToWorld(this.map, ent.x, ent.z);
        markPos(wp.x, wp.z);
      }
      for (const en of previewResult.trappedEnemies || []) {
        markPos(en.x, en.z);
      }
      return;
    }

    // 正常预览：对比 currentRoutes，只把发生改变的路线用醒目虚线高亮绘制，并将旧路线压暗
    for (const entry of this.map.entries) {
      const curR = currentRoutes[entry.id];
      const newR = previewResult.previewRoutes[entry.id];
      if (!newR) continue;
      let diff = false;
      if (!curR || curR.path.length !== newR.path.length) {
        diff = true;
      } else {
        for (let i = 0; i < curR.path.length; i++) {
          if (curR.path[i].x !== newR.path[i].x || curR.path[i].z !== newR.path[i].z) {
            diff = true;
            break;
          }
        }
      }

      if (diff) {
        if (this.activeRouteMeshes[entry.id]) {
          this.activeRouteMeshes[entry.id].mat.opacity = 0.25;
        }
        const col = ENTRY_COLORS[entry.id] || ENTRY_COLORS.A;
        const lane = LANE_OFFSETS[entry.id] ?? 0;
        const built = this._buildRibbonMesh(newR.path, lane, 0.14, 0xffffff, this.tex.routePreview, 0.36, 0.96);
        if (built) {
          built.mat.color.setHex(col.hex).lerp(new THREE.Color(0xffffff), 0.38);
          this.previewRouteGroup.add(built.mesh);
          this.previewMeshes.push(built);
        }
      }
    }
  }

  clearRoutePreview() {
    while (this.previewRouteGroup.children.length > 0) {
      const ch = this.previewRouteGroup.children.pop();
      if (ch.geometry) ch.geometry.dispose();
    }
    this.previewMeshes = [];

    while (this.blockedMarkerGroup.children.length > 0) {
      const ch = this.blockedMarkerGroup.children.pop();
      if (ch.geometry) ch.geometry.dispose();
    }

    for (const id of Object.keys(this.activeRouteMeshes)) {
      this.activeRouteMeshes[id].mat.opacity = 0.85;
    }
  }

  // 显示部署/选中范围与拦截器朝向框
  showPlacementPreview({ wx, wy, wz, valid, radius = 0, oriented = false, dirAngle = 0, forwardLen = 4.3, halfWidth = 1.55 }) {
    this.tileCursor.visible = true;
    this.tileCursor.position.set(wx, wy + 0.05, wz);
    this.tileCursor.material.color.setHex(valid ? 0x38bdf8 : 0xff1744);

    if (oriented) {
      this.rangeCircle.visible = false;
      this.rangeBorder.visible = false;
      this.dirSectorGroup.visible = true;
      this.dirSectorGroup.position.set(wx, 0.22, wz);
      this.dirSectorGroup.rotation.y = dirAngle;
      this.dirSectorInner.scale.set(halfWidth * 2 * TILE_SIZE, 1, forwardLen * TILE_SIZE);
    } else if (radius > 0) {
      this.dirSectorGroup.visible = false;
      const worldR = radius * TILE_SIZE;
      this.rangeCircle.visible = true;
      this.rangeBorder.visible = true;
      this.rangeCircle.position.set(wx, 0.2, wz);
      this.rangeBorder.position.set(wx, 0.21, wz);
      this.rangeCircle.scale.setScalar(worldR);
      this.rangeBorder.scale.setScalar(worldR);
      this.rangeCircleMat.color.setHex(valid ? 0x38bdf8 : 0xff1744);
    } else {
      this.rangeCircle.visible = false;
      this.rangeBorder.visible = false;
      this.dirSectorGroup.visible = false;
    }
  }

  hidePlacementPreview() {
    this.tileCursor.visible = false;
    this.rangeCircle.visible = false;
    this.rangeBorder.visible = false;
    this.dirSectorGroup.visible = false;
  }

  // 发射光束/弹道连线（单点射击、贯穿轨道炮、治疗纳米束、勒索加密光束、洪峰冲击束）
  spawnBeam(from, to, colorHex, width = 0.08, duration = 0.16) {
    const start = new THREE.Vector3(from.x, from.y, from.z);
    const end = new THREE.Vector3(to.x, to.y, to.z);
    const dist = start.distanceTo(end);
    if (dist < 0.05) return;

    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const geo = new THREE.CylinderGeometry(width, width, dist, 6);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(mid);
    mesh.lookAt(end);
    this.fxGroup.add(mesh);
    this.beams.push({ mesh, mat, timer: duration, maxTimer: duration });
  }

  // 地面扩散波纹环（范围攻击、技能爆发、破闸震波、冗余切换、加壳波）
  spawnRing(wx, wy, wz, maxRadius, colorHex, duration = 0.42) {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.78, 1.0, 32), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(wx, wy + 0.08, wz);
    mesh.scale.setScalar(0.2);
    this.fxGroup.add(mesh);
    this.rings.push({ mesh, mat, maxRadius, timer: duration, maxTimer: duration });
  }

  // 粒子爆裂（命中火花、单位崩解、木马载荷自爆、加密碎裂）
  spawnBurst(wx, wy, wz, colorHex, count = 10, speed = 3.2) {
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(wx, wy, wz);
      const ang = (i / count) * Math.PI * 2 + (i % 3) * 0.2;
      const spd = speed * (0.55 + (i % 4) * 0.2);
      const vx = Math.cos(ang) * spd;
      const vz = Math.sin(ang) * spd;
      const vy = 1.4 + (i % 3) * 0.9;
      this.fxGroup.add(m);
      this.particles.push({ mesh: m, mat, vx, vy, vz, timer: 0.42, maxTimer: 0.42 });
    }
  }

  // 同步 Boss 地形改变预警框、伪路由黑洞与工控锁死屏障（2.5 & 2.12.2）
  syncHazards(simHazards, simTime) {
    const activeIds = new Set(simHazards.map((h) => h.id));
    for (const [id, grp] of this.hazardMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.hazardGroup.remove(grp);
        this.hazardMeshes.delete(id);
      }
    }

    for (const h of simHazards) {
      let grp = this.hazardMeshes.get(h.id);
      if (!grp) {
        grp = new THREE.Group();
        for (const cell of h.cells) {
          const wp = gridToWorld(this.map, cell.x, cell.z, 0);
          const cg = new THREE.Group();
          cg.position.set(wp.x, 0, wp.z);

          if (h.state === 'warning') {
            // 醒目红橙色预警框与光柱！
            const warnPlane = new THREE.Mesh(
              new THREE.RingGeometry(0.55, 0.92, 4),
              new THREE.MeshBasicMaterial({ color: 0xff3d00, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
            );
            warnPlane.rotation.x = -Math.PI / 2;
            warnPlane.rotation.z = Math.PI / 4;
            warnPlane.position.y = 0.16;

            const pillar = new THREE.Mesh(
              new THREE.CylinderGeometry(0.5, 0.5, 2.2, 8, 1, true),
              new THREE.MeshBasicMaterial({ color: 0xff3d00, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
            );
            pillar.position.y = 1.1;
            cg.add(warnPlane, pillar);
          } else if (h.kind === 'blackhole') {
            // 蜃楼：伪路由黑洞漩涡球 + 吸积盘
            const sphere = new THREE.Mesh(
              new THREE.SphereGeometry(0.56, 16, 16),
              new THREE.MeshBasicMaterial({ color: 0x120024 })
            );
            sphere.position.y = 0.62;
            const disk = new THREE.Mesh(
              new THREE.TorusGeometry(0.82, 0.1, 8, 28),
              new THREE.MeshBasicMaterial({ color: 0xd500f9 })
            );
            disk.rotation.x = Math.PI / 2.2;
            disk.position.y = 0.62;
            disk.name = 'spinDisk';
            cg.add(sphere, disk);
          } else if (h.kind === 'lockdown') {
            // 蛰影：破坏阶段工控锁死激光障壁
            const barrierMat = new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
            const wall1 = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 1.35), barrierMat);
            wall1.position.y = 0.68;
            const wall2 = wall1.clone();
            wall2.rotation.y = Math.PI / 2;
            const post = new THREE.Mesh(
              new THREE.CylinderGeometry(0.2, 0.28, 1.45, 6),
              new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: 0xff1744, emissiveIntensity: 0.8 })
            );
            post.position.y = 0.72;
            cg.add(wall1, wall2, post);
          }
          grp.add(cg);
        }
        grp.userData.state = h.state;
        this.hazardGroup.add(grp);
        this.hazardMeshes.set(h.id, grp);
      } else if (grp.userData.state !== h.state) {
        // 从预警切换为生效实体：重建一次网格
        this.hazardGroup.remove(grp);
        this.hazardMeshes.delete(h.id);
      }

      // 动态脉冲更新
      for (const cg of grp.children) {
        const disk = cg.getObjectByName('spinDisk');
        if (disk) disk.rotation.z = simTime * 4.5;
        if (h.state === 'warning') {
          cg.scale.setScalar(0.92 + 0.1 * Math.sin(simTime * 12.0));
        }
      }
    }
  }

  // 同步沙箱 Lv.2 地面特征码驻留区
  syncSandboxZones(simZones, simTime) {
    while (this.zones.length > simZones.length) {
      const m = this.zones.pop();
      this.fxGroup.remove(m);
    }
    while (this.zones.length < simZones.length) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 1.0, 6),
        new THREE.MeshBasicMaterial({
          color: 0x00e676,
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      m.rotation.x = -Math.PI / 2;
      this.fxGroup.add(m);
      this.zones.push(m);
    }
    for (let i = 0; i < simZones.length; i++) {
      const z = simZones[i];
      const m = this.zones[i];
      m.position.set(z.x, 0.06, z.z);
      m.scale.setScalar(z.radius);
      m.rotation.z = simTime * 1.2;
      m.material.opacity = 0.16 + 0.12 * Math.sin(simTime * 6.0);
    }
  }

  // 同步近战阻挡与诱捕连接牵引线（让防火墙跨格节点拦截、蜜罐诱敌阻挡关系一目了然）
  syncBlockTethers(towers, enemies, simTime) {
    const pairs = [];
    for (const tw of towers) {
      if (tw.dead || tw.blockedIds.size === 0) continue;
      const col = tw.type === 'honeypot' ? 0xffca28 : 0x38bdf8;
      for (const eid of tw.blockedIds) {
        const en = enemies.find((x) => !x.dead && x.dyingTimer <= 0 && x.id === eid);
        if (en) pairs.push({ tw, en, col });
      }
    }

    while (this.tetherMeshes.length > pairs.length) {
      const m = this.tetherMeshes.pop();
      this.tetherGroup.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    while (this.tetherMeshes.length < pairs.length) {
      const geo = new THREE.CylinderGeometry(0.032, 0.032, 1, 6);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const m = new THREE.Mesh(geo, mat);
      this.tetherGroup.add(m);
      this.tetherMeshes.push(m);
    }

    const pulse = 0.5 + 0.25 * Math.sin(simTime * 8.0);
    for (let i = 0; i < pairs.length; i++) {
      const { tw, en, col } = pairs[i];
      const m = this.tetherMeshes[i];
      const p1 = new THREE.Vector3(tw.x, 0.34, tw.z);
      const p2 = new THREE.Vector3(en.x, 0.34, en.z);
      const dist = p1.distanceTo(p2);
      if (dist < 0.05) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.position.addVectors(p1, p2).multiplyScalar(0.5);
      m.scale.set(1, 1, dist);
      m.lookAt(p2);
      m.material.color.setHex(col);
      m.material.opacity = pulse;
    }
  }

  update(dt, simTime) {
    // 1. 路线 UV 流动动画、改道高光闪烁与正常业务流量包平滑传输
    for (const id of Object.keys(this.activeRouteMeshes)) {
      const r = this.activeRouteMeshes[id];
      r.tex.offset.x = -(simTime * 1.35) % 1;
      if (r.flashTimer > 0) {
        r.flashTimer = Math.max(0, r.flashTimer - dt);
        r.mat.opacity = 0.65 + 0.35 * Math.abs(Math.sin(simTime * 10.0));
      }
    }
    const tmpPt = new THREE.Vector3();
    const tmpTan = new THREE.Vector3();
    for (const st of this.businessStreams) {
      for (const pkt of st.packets) {
        const u = (pkt.phase + simTime * st.speed) % 1;
        st.curve.getPointAt(u, tmpPt);
        st.curve.getTangentAt(u, tmpTan);
        const sideX = -tmpTan.z * st.laneOffset;
        const sideZ = tmpTan.x * st.laneOffset;
        pkt.mesh.position.set(tmpPt.x + sideX, 0.088, tmpPt.z + sideZ);
        pkt.mesh.rotation.y = Math.atan2(tmpTan.x, tmpTan.z);
      }
    }
    for (const pr of this.previewMeshes) {
      pr.tex.offset.x = -(simTime * 2.4) % 1;
    }

    // 2. 光束衰减
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.timer -= dt;
      if (b.timer <= 0) {
        this.fxGroup.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mat.dispose();
        this.beams.splice(i, 1);
      } else {
        b.mat.opacity = (b.timer / b.maxTimer) * 0.92;
      }
    }

    // 3. 波纹扩散
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.timer -= dt;
      if (r.timer <= 0) {
        this.fxGroup.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mat.dispose();
        this.rings.splice(i, 1);
      } else {
        const p = 1 - r.timer / r.maxTimer;
        r.mesh.scale.setScalar(0.25 + p * r.maxRadius);
        r.mat.opacity = (1 - p) * 0.85;
      }
    }

    // 4. 粒子运动
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.timer -= dt;
      if (pt.timer <= 0) {
        this.fxGroup.remove(pt.mesh);
        pt.mat.dispose();
        this.particles.splice(i, 1);
      } else {
        pt.mesh.position.x += pt.vx * dt;
        pt.mesh.position.y += pt.vy * dt;
        pt.mesh.position.z += pt.vz * dt;
        pt.vy -= 6.5 * dt;
        pt.mat.opacity = pt.timer / pt.maxTimer;
      }
    }
  }

  dispose() {
    this.scene.remove(this.root);
  }
}
