// ============================================================
// 场景控制：把 (progress, time, state) 映射到三维画面
// 相机 / 拆解 / 剖切 / 接缝 / 选中 / 数据脉冲 / 系统层
// ============================================================
import * as THREE from 'three';
import {
  buildPackage, buildPulses, buildHGX, buildServer, buildGB200, buildRack,
} from './models.js';
import { buildMaterials } from './materials.js';
import { sampleCamera, map, smooth, clamp01, lerp, segT, chapterLocal } from '../timeline.js';
import { store, FACTS } from '../state.js';

export class SceneCtrl {
  constructor(pipeline) {
    this.pipeline = pipeline;
    this.scene = pipeline.scene;
    this.mats = buildMaterials();

    // 封装
    const pkg = buildPackage(this.mats);
    this.pkg = pkg;
    this.scene.add(pkg.group);

    // 脉冲
    this.pulses = buildPulses(pkg.paths, this.mats, 5);
    this.scene.add(this.pulses.group);

    // 系统层
    this.hgx = buildHGX(this.mats);
    this.scene.add(this.hgx.group);
    this.server = buildServer(this.mats);
    this.scene.add(this.server.group);
    this.gb200 = buildGB200(this.mats);
    this.scene.add(this.gb200.group);
    this.rack = buildRack(this.mats);
    this.scene.add(this.rack.group);
    this.scene.add(this.rack.fleet);

    // 产品基座（第 07 章五种产品并排）
    this.podium = this.buildPodium();
    this.scene.add(this.podium);

    // 剖切平面
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 20);
    this.pipeline.renderer.clippingPlanes = [];

    // 用户视角偏移
    this.orbit = { az: 0, el: 0, zoom: 1 };
    this.targetOrbit = { az: 0, el: 0, zoom: 1 };

    // 选中高亮盒
    this.highlightBox = new THREE.Box3();
    this.highlightHelper = new THREE.Box3Helper(this.highlightBox, 0x46d8ff);
    this.highlightHelper.visible = false;
    this.highlightHelper.material.transparent = true;
    this.highlightHelper.material.opacity = 0.85;
    this.scene.add(this.highlightHelper);

    this._tmpV = new THREE.Vector3();
    this._explode = 0;
    this._userExplode = null;
  }

  buildPodium() {
    const g = new THREE.Group();
    g.name = 'podium';
    const m = this.mats;
    const defs = [
      { id: 'B200', x: -26 }, { id: 'HGX', x: -13 }, { id: 'DGX', x: 0 },
      { id: 'GB200', x: 13 }, { id: 'NVL72', x: 26 },
    ];
    for (const d of defs) {
      const item = new THREE.Group();
      item.position.set(d.x, -70, 0);
      item.userData.product = d.id;
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.8, 28), m.darkMetalMat);
      pedestal.position.y = -2.4;
      item.add(pedestal);
      if (d.id === 'B200') {
        const pkg = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.9, 4.6), m.lidMat);
        pkg.position.y = -1.4;
        const die1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.8), m.dieMatA);
        die1.position.set(-0.9, -0.85, 0);
        const die2 = die1.clone(); die2.position.x = 0.9;
        item.add(pkg, die1, die2);
      } else if (d.id === 'HGX') {
        const board = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.4, 4.2), m.pcbMat);
        board.position.y = -1.6;
        item.add(board);
        for (let i = 0; i < 8; i++) {
          const g2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.9), m.lidMat);
          g2.position.set(-2.3 + (i % 4) * 1.55, -1.15, i < 4 ? -1.1 : 1.1);
          item.add(g2);
        }
      } else if (d.id === 'DGX') {
        const box = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.4, 4.6), m.darkMetalMat);
        box.position.y = -1.0;
        const front = new THREE.Mesh(new THREE.BoxGeometry(6.85, 2.2, 0.16), m.rackMat);
        front.position.set(0, -1.0, 2.35);
        item.add(box, front);
      } else if (d.id === 'GB200') {
        const tray = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.35, 3.8), m.pcbMat);
        tray.position.y = -1.7;
        const cpu = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.4), m.interposerMat);
        cpu.position.set(0, -1.25, -1.0);
        item.add(tray, cpu);
        for (const s of [-1, 1]) {
          const gpu = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.5), m.lidMat);
          gpu.position.set(s * 1.7, -1.2, 0.4);
          item.add(gpu);
        }
      } else if (d.id === 'NVL72') {
        for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.6, 0.22), m.darkMetalMat);
          post.position.set(sx * 1.6, 0.5, sz * 1.2);
          item.add(post);
        }
        for (let i = 0; i < 9; i++) {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 2.4), m.frameMat);
          slab.position.y = -1.5 + i * 0.5;
          item.add(slab);
        }
      }
      item.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.userData.product = d.id;
        }
      });
      g.add(item);
    }
    return g;
  }

  setUserExplode(v) { this._userExplode = v; }
  clearUserExplode() { this._userExplode = null; }

  /** 拖动旋转 */
  orbitDelta(daz, del) {
    this.targetOrbit.az += daz;
    this.targetOrbit.el += del;
    this.targetOrbit.el = Math.max(-0.85, Math.min(0.85, this.targetOrbit.el));
  }
  zoomDelta(d) {
    this.targetOrbit.zoom = Math.max(0.45, Math.min(2.4, this.targetOrbit.zoom + d));
  }
  resetOrbit() {
    this.targetOrbit.az = 0; this.targetOrbit.el = 0; this.targetOrbit.zoom = 1;
    this._userExplode = null;
  }

  // 章节局部进度快捷方式
  chT(id, p) { return chapterLocal(id, p); }

  update(progress, time) {
    const p = progress;
    const state = store;

    // ---------- 相机 ----------
    const cam = sampleCamera(p);
    // 用户轨道偏移（绕 look 旋转）；导出模式直接到位，保证逐帧确定
    const instant = !!window.__exportMode;
    const k = instant ? 1 : 0.12;
    this.orbit.az += (this.targetOrbit.az - this.orbit.az) * k;
    this.orbit.el += (this.targetOrbit.el - this.orbit.el) * k;
    this.orbit.zoom += (this.targetOrbit.zoom - this.orbit.zoom) * k;

    const look = new THREE.Vector3(cam.look[0], cam.look[1], cam.look[2]);
    const offset = new THREE.Vector3(cam.pos[0] - look.x, cam.pos[1] - look.y, cam.pos[2] - look.z);
    const radius = offset.length() / this.orbit.zoom;
    // 球坐标旋转
    const sph = new THREE.Spherical().setFromVector3(offset);
    sph.theta += this.orbit.az;
    sph.phi = Math.max(0.15, Math.min(Math.PI - 0.15, sph.phi - this.orbit.el));
    sph.radius = radius;
    offset.setFromSpherical(sph);
    this.pipeline.camera.position.set(look.x + offset.x, look.y + offset.y, look.z + offset.z);
    this.pipeline.camera.lookAt(look);
    this.pipeline.camera.fov = cam.fov;
    this.pipeline.camera.updateProjectionMatrix();

    // 运动模糊：由轨迹瞬时速度解析求得（纯 progress 函数，导出逐帧确定）
    {
      const eps = 0.0025;
      const a = sampleCamera(Math.max(0, p - eps));
      const b = sampleCamera(Math.min(1, p + eps));
      const vx = b.pos[0] - a.pos[0], vy = b.pos[1] - a.pos[1], vz = b.pos[2] - a.pos[2];
      const spd = Math.sqrt(vx * vx + vy * vy + vz * vz) / (2 * eps);
      const amt = Math.min(0.32, spd * 0.00085);
      if (spd > 1e-4) {
        const inv = 1 / (spd * (2 * eps));
        this.pipeline.blurDir.set(vx * inv, vy * inv).normalize();
      }
      this.pipeline.motionBlur = amt;
      this.pipeline.finalPass.uniforms.uBlurAmount.value = amt;
      this.pipeline.finalPass.uniforms.uBlurDir.value.copy(this.pipeline.blurDir);
    }

    // 景深：焦点对准观看中心；近景章节（03/04）加大光圈
    const camDist = this.pipeline.camera.position.distanceTo(look);
    const nearBoost = (this.chT('ch03', p) > 0 && this.chT('ch03', p) < 1)
      || (this.chT('ch04', p) > 0 && this.chT('ch04', p) < 1) ? 2.2 : 1.0;
    this.pipeline.updateDof(camDist, 0.00012 * nearBoost);

    // ---------- 灯光随时间缓慢移动（阴影与接触暗部更新）----------
    const lightAngle = time * 0.055 + 0.8;
    this.pipeline.keyLight.position.set(Math.cos(lightAngle) * 22, 20 + Math.sin(time * 0.11) * 3, Math.sin(lightAngle) * 20);
    this.pipeline.rimCyan.position.set(Math.cos(lightAngle + 2.2) * 20, 9, Math.sin(lightAngle + 2.2) * 18);

    // ---------- 拆解 ----------
    const ch02 = this.chT('ch02', p);
    // 章节驱动的拆解曲线
    let scrollExplode = 0;
    if (p < segT('ch02', 0)) scrollExplode = 0;
    else if (p <= segT('ch02', 0.75)) scrollExplode = smooth(map(p, segT('ch02', 0.02), segT('ch02', 0.75), 0, 1));
    else if (p <= segT('tr02-03', 1)) scrollExplode = smooth(map(p, segT('ch02', 0.75), segT('tr02-03', 1), 1, 0.22));
    else if (p < segT('ch05', 1)) scrollExplode = 0.22 * (1 - smooth(map(p, segT('ch03', 0), segT('ch03', 0.5), 0, 1))) * 0 + 0.08;
    // ch03 之后保持微展开便于观察，ch08 收回完整
    if (p >= segT('ch08', 0.05)) scrollExplode = 0;

    const explode = this._userExplode != null ? this._userExplode : scrollExplode;
    if (!Number.isFinite(explode)) {
      if (!window.__nanExplode) {
        window.__nanExplode = true;
        console.error('[B200 NaN explode]', explode, 'p=', p, 'userExplode=', this._userExplode);
      }
      return;
    }
    this._explode += (explode - this._explode) * (instant ? 1 : 0.14);
    const e = this._explode;
    store._effExplode = e; // 供 SVG 分层线稿同步

    const { parts, hbmStacks, detail } = this.pkg;
    parts.lid.position.y = e * 3.2;
    parts.frame.position.y = e * 1.9;
    parts.dieA.position.y = e * 1.35;
    parts.dieB.position.y = e * 1.35;
    parts.interposer.position.y = e * 0.62;
    parts.balls.position.y = -e * 0.3;
    parts.caps.position.y = e * 0.18;

    // HBM 堆栈内部展开
    const hbmExpand = clamp01(smooth(map(ch02, 0.42, 0.9, 0, 1)) + (this.chT('ch04', p) > 0 && this.chT('ch04', p) < 1 ? 0.35 : 0));
    for (const stack of hbmStacks) {
      stack.position.y = e * 0.95;
      const layers = stack.userData.layers;
      for (let L = 0; L < layers.length; L++) {
        layers[L].position.y = 0.68 + L * 0.115 + hbmExpand * (0.14 + L * 0.16);
      }
    }
    // 微凸点在展开后显形（材质透明度模拟）
    detail.dieABumps && (detail.dieABumps.visible = e > 0.06);
    detail.dieBBumps && (detail.dieBBumps.visible = e > 0.06);

    // ---------- 晶粒接缝 ----------
    const gap = state.dieSeamGap;
    const gapX = gap * 1.9;
    parts.dieA.position.x = -1.98 - gapX;
    parts.dieB.position.x = 1.98 + gapX;
    const bridge = parts.bridge;
    bridge.scale.x = 1 + gap * 4.2;
    bridge.material.opacity = 0.42 * (1 - gap * 0.85);
    bridge.material.color.setHex(gap > 0.55 ? 0xff6b6b : 0x46d8ff);

    // ---------- 剖切 ----------
    const cut = state.cutaway;
    if (cut > 0.001) {
      const zPos = lerp(7.5, -7.5, cut);
      this.clipPlane.constant = zPos;
      this.pipeline.renderer.clippingPlanes = [this.clipPlane];
    } else {
      this.pipeline.renderer.clippingPlanes = [];
    }

    // ---------- 功能区激活（第 03 章）----------
    const ch03 = this.chT('ch03', p);
    for (const die of [parts.dieA, parts.dieB]) {
      const zones = die.getObjectByName(die.name + 'Zones');
      if (!zones) continue;
      for (const z of zones.children) {
        const zid = z.userData.zoneId;
        let op = 0;
        if (ch03 > 0 && ch03 < 1.01) {
          op = 0.18 + 0.5 * (0.5 + 0.5 * Math.sin(time * 1.4 + zid.length));
          if (state.selectedZone === zid) op = 0.85;
        }
        if (state.selectedPart === die.name && state.selectedZone === zid) op = 0.95;
        z.material.opacity += (op - z.material.opacity) * (instant ? 1 : 0.15);
      }
    }

    // ---------- 数据脉冲 ----------
    const seamBroken = gap > 0.35;
    for (const it of this.pulses.items) {
      const isCross = it.pathId.startsWith('cross');
      if (isCross && seamBroken) {
        // 断开处停止：停在断裂前
        const t = (it.offset + time * 0.12) % 1;
        const stopT = 0.42 - gap * 0.35;
        const tt = Math.min(t, Math.max(0.06, stopT));
        it.curve.getPointAt(tt, it.mesh.position);
        it.mesh.material.opacity = 0.25;
        it.mesh.material.transparent = true;
      } else {
        const t = (it.offset + time * 0.12) % 1;
        it.curve.getPointAt(t, it.mesh.position);
        it.mesh.material.opacity = 1;
        it.mesh.material.transparent = false;
      }
      const s = 0.7 + 0.3 * Math.sin(time * 3 + it.offset * 12);
      it.mesh.scale.setScalar(s);
    }
    // 脉冲可见性：ch01 微弱，ch03–04 强，之后跟随
    const pulseVis = clamp01(0.25 + 0.75 * smooth(map(p, segT('ch03', 0), segT('ch03', 0.25), 0, 1)));
    this.pulses.group.visible = pulseVis > 0.05;

    // ---------- 功能区光晕（配合 2D 激活图）----------
    // selectedZone 时，对应 3D 区高亮
    if (state.selectedZone && (ch03 > 0 || this.chT('ch04', p) > 0)) {
      for (const die of [parts.dieA, parts.dieB]) {
        const zones = die.getObjectByName(die.name + 'Zones');
        if (!zones) continue;
        for (const z of zones.children) {
          if (z.userData.zoneId === state.selectedZone) z.material.opacity = Math.max(z.material.opacity, 0.9);
        }
      }
    }

    // ---------- 选中高亮 ----------
    this.updateHighlight(state.selectedPart);

    // ---------- 系统层显隐 ----------
    const inSystems = p > segT('tr05-06', 0.25) && p < segT('tr07-08', 0.4);
    const inPodium = p > segT('tr06-07', 0.4) && p < segT('tr07-08', 0.75);
    this.hgx.group.visible = p > segT('tr05-06', 0.2) && p < segT('ch06', 0.72);
    this.server.group.visible = p > segT('ch06', 0.32) && p < segT('ch06', 0.95);
    this.gb200.group.visible = p > segT('ch06', 0.42) && p < segT('ch06', 1);
    this.rack.group.visible = p > segT('ch06', 0.5);
    this.rack.fleet.visible = p > segT('ch06', 0.72) && p < segT('tr07-08', 0.6);
    this.podium.visible = inPodium;

    // HGX GPU 载荷动画（第 06 章分片）
    const ch06 = this.chT('ch06', p);
    if (this.hgx.group.visible && ch06 > 0.35) {
      const phase = time * 0.9;
      for (let i = 0; i < this.hgx.gpus.length; i++) {
        const g = this.hgx.gpus[i];
        const act = 0.5 + 0.5 * Math.sin(phase + i * 0.8);
        g.position.y = 0.25 + act * 0.12;
      }
    }

    // 封装整体显隐（ch06 中段拉远后淡出，由雾自然过渡）
    const pkgVisible = p < segT('ch06', 0.28) || p > segT('tr07-08', 0.35);
    this.pkg.group.visible = pkgVisible;
    this.pulses.group.visible = this.pulses.group.visible && pkgVisible;

    // 第 08 章：封装自转
    if (p > segT('ch08', 0)) {
      const rot = (p - segT('ch08', 0)) * 1.2 + Math.sin(time * 0.12) * 0.06;
      this.pkg.group.rotation.y = rot * 0.55;
    } else {
      this.pkg.group.rotation.y = Math.sin(time * 0.05) * 0.04;
    }
  }

  updateHighlight(partId) {
    if (!partId) {
      this.highlightHelper.visible = false;
      return;
    }
    const obj = this.pkg.group.getObjectByName(partId)
      || this.hgx.group.getObjectByName(partId)
      || this.rack.group.getObjectByName(partId);
    if (!obj) {
      this.highlightHelper.visible = false;
      return;
    }
    this.highlightBox.setFromObject(obj);
    // 稍微膨胀
    this.highlightBox.expandByScalar(0.12);
    this.highlightHelper.box = this.highlightBox;
    this.highlightHelper.visible = true;
    this.highlightHelper.updateMatrixWorld(true);
  }

  /** 点击拾取 */
  pick(ndcX, ndcY) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.pipeline.camera);
    const targets = [];
    this.pkg.group.traverse(o => { if (o.isMesh) targets.push(o); });
    if (this.hgx.group.visible) this.hgx.group.traverse(o => { if (o.isMesh) targets.push(o); });
    if (this.rack.group.visible) this.rack.group.traverse(o => { if (o.isMesh) targets.push(o); });
    if (this.podium.visible) this.podium.traverse(o => { if (o.isMesh) targets.push(o); });
    const hits = ray.intersectObjects(targets, false);
    if (!hits.length) return null;
    const h = hits[0];
    return {
      partId: h.object.userData.partId || null,
      zoneId: h.object.userData.zoneId || null,
      product: h.object.userData.product || null,
    };
  }

  /**
   * 第 08 章七组标注的三维锚点 → 屏幕坐标（随自转更新，含朝向遮挡）
   */
  projectAnchors() {
    const anchors = [
      { id: 'te',     local: new THREE.Vector3(-1.98, 0.72, -1.2) },   // Transformer Engine（晶粒 A 计算区）
      { id: 'd2d',    local: new THREE.Vector3(0, 0.62, 0) },          // 片间互连
      { id: 'decomp', local: new THREE.Vector3(2.3, 0.72, 1.5) },      // 解压缩引擎
      { id: 'hbm',    local: new THREE.Vector3(-4.55, 1.75, -1.85) },  // HBM3e
      { id: 'nvlink', local: new THREE.Vector3(-3.5, 0.72, 0) },       // NVLink PHY
      { id: 'ras',    local: new THREE.Vector3(-1.2, 0.32, 3.6) },     // RAS / 机密计算（基板区）
      { id: 'power',  local: new THREE.Vector3(4.4, 0.95, 4.4) },      // 功耗（框架/供电区）
    ];
    const out = {};
    const camPos = this.pipeline.camera.position;
    const pkgPos = this.pkg.group.position;
    for (const a of anchors) {
      const world = a.local.clone();
      // 应用封装整体自转
      world.applyQuaternion(this.pkg.group.quaternion);
      world.add(pkgPos);
      const facing = world.clone().sub(pkgPos).normalize()
        .dot(camPos.clone().sub(pkgPos).normalize());
      const v = world.clone().project(this.pipeline.camera);
      out[a.id] = {
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight,
        visible: v.z < 1 && facing > -0.25,
        facing,
      };
      if (!Number.isFinite(facing) || !Number.isFinite(out[a.id].x)) {
        if (!window.__nanAnchor) {
          window.__nanAnchor = true;
          console.error('[B200 NaN anchor]', a.id, 'cam', camPos.toArray(), 'pkg', pkgPos.toArray(), 'world', world.toArray(), 'v', v.toArray());
        }
      }
    }
    return out;
  }
}
