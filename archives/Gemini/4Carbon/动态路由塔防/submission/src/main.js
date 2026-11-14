// 应用主入口：Three.js 渲染管线、辉光后处理、Blender 标准视图控制器、射线拾取与全局生命周期

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { getMapById, MAPS } from './maps.js';
import { buildBattlefieldScene, updateBattlefieldVisuals } from './models.js';
import { VFXManager } from './vfx.js';
import { BattleSim } from './sim.js';
import { UIController } from './ui.js';
import { DemoDirector, installVideoExportAPI } from './demos.js';
import { sound } from './audio.js';

class GameApp {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.inMenu = true;
    this.exportMode = false;
    this.currentMap = MAPS[0];
    this.sceneBundle = null;
    this.vfx = null;
    this.sim = null;

    this._initRenderer();
    this._initCamera();
    this._bindViewportInput();

    this.ui = new UIController(this);
    this.demoDirector = new DemoDirector(this);
    installVideoExportAPI(this);

    // 启动主菜单背景实时 3D 网络场景展示
    this.showMainMenu();

    this.lastFrameMs = performance.now();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true // 确保截图与视频导出任何时刻读取缓冲完整清晰
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050c18);
    this.scene.fog = new THREE.FogExp2(0x06101e, 0.014);

    // 生成程序化网络空间反射环境贴图，令金属装甲、高台切角与晶体棱面具备鲜明高光细节
    this.envMap = this._buildCyberEnvMap();
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.85;

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 180);

    // 后处理管线（适度辉光突出光纤、护盾与弹道，同时保持路线与UI文字锐利清晰）
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.38, // strength
      0.55, // radius
      0.78  // threshold
    );
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);

    window.addEventListener('resize', () => this._onResize());
  }

  _buildCyberEnvMap() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x0c192c);

    // 顶部天光柔光板（照亮高台、塔顶与装甲上沿）
    const topLight = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe, side: THREE.DoubleSide })
    );
    topLight.position.set(0, 14, 0);
    topLight.rotation.x = Math.PI / 2;
    envScene.add(topLight);

    // 青色冷光侧轮廓板
    const cyanPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 12),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
    );
    cyanPanel.position.set(-15, 5, 8);
    cyanPanel.lookAt(0, 0, 0);
    envScene.add(cyanPanel);

    // 暖琥珀/品红辅光轮廓板（丰富立体折面反差）
    const warmPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 10),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide })
    );
    warmPanel.position.set(15, 4, -10);
    warmPanel.lookAt(0, 0, 0);
    envScene.add(warmPanel);

    // 下方协议层微光反射面
    const bottomGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(32, 32),
      new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide })
    );
    bottomGlow.position.set(0, -12, 0);
    bottomGlow.rotation.x = -Math.PI / 2;
    envScene.add(bottomGlow);

    const rt = pmrem.fromScene(envScene, 0.04);
    pmrem.dispose();
    return rt.texture;
  }

  _setupSceneLights(themePalette) {
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.85);
    this.scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xf8fafc, 1.65);
    dirLight.position.set(14, 26, 16);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -22;
    dirLight.shadow.camera.right = 22;
    dirLight.shadow.camera.top = 18;
    dirLight.shadow.camera.bottom = -18;
    dirLight.shadow.camera.near = 4;
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(themePalette?.strata1 || 0x38bdf8, 0.65);
    rimLight.position.set(-18, 12, -14);
    this.scene.add(rimLight);
  }

  // ==========================================================================
  // Blender 一致的三维镜头控制：中键拖动环绕，Shift+中键平移，滚轮缩放；左键仅点选/部署
  // ==========================================================================
  _initCamera() {
    this.camTarget = new THREE.Vector3(0, 0, 0.5);
    this.camRadius = 29.5;
    this.camPolar = 0.88; // 俯仰角 (rad)
    this.camAzimuth = 0.0; // 水平方位角 (rad)
    this.mmbDragging = false;
    this.mmbPanMode = false;
    this.lastMouse = { x: 0, y: 0 };
    this._syncCameraFromSpherical();
  }

  getDefaultCameraPose() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const fitScale = aspect < 1.6 ? 1.6 / aspect : 1.0;
    return {
      tx: 0,
      tz: 0.55,
      radius: 29.2 * fitScale,
      polar: 0.89,
      azimuth: 0.0
    };
  }

  resetCameraToDefault() {
    this.setCameraPose(this.getDefaultCameraPose());
  }

  setCameraPose({ tx, tz, radius, polar, azimuth }) {
    this.camTarget.set(tx, 0, tz);
    this.camRadius = radius;
    this.camPolar = polar;
    this.camAzimuth = azimuth;
    this._syncCameraFromSpherical();
  }

  _syncCameraFromSpherical() {
    const sinP = Math.sin(this.camPolar);
    const cosP = Math.cos(this.camPolar);
    const x = this.camTarget.x + this.camRadius * sinP * Math.sin(this.camAzimuth);
    const y = this.camTarget.y + this.camRadius * cosP;
    const z = this.camTarget.z + this.camRadius * sinP * Math.cos(this.camAzimuth);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.camTarget);
  }

  _bindViewportInput() {
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.14);

    // 禁用浏览器中键自动滚屏与右键默认菜单
    window.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault();
    });
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.ui?.activeDrag) {
        sound.play('ui_click');
        this.ui.cancelActivePlacement();
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        if (this.demoDirector?.isRunning()) return;
        this.mmbDragging = true;
        this.mmbPanMode = e.shiftKey;
        this.lastMouse.x = e.clientX;
        this.lastMouse.y = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.mmbDragging && !this.demoDirector?.isRunning()) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        this.lastMouse.x = e.clientX;
        this.lastMouse.y = e.clientY;

        if (e.shiftKey || this.mmbPanMode) {
          // Shift + 中键平移
          const panFactor = this.camRadius * 0.0014;
          const right = new THREE.Vector3(Math.cos(this.camAzimuth), 0, -Math.sin(this.camAzimuth));
          const forward = new THREE.Vector3(-Math.sin(this.camAzimuth), 0, -Math.cos(this.camAzimuth));
          this.camTarget.addScaledVector(right, -dx * panFactor);
          this.camTarget.addScaledVector(forward, dy * panFactor);
          this.camTarget.x = Math.max(-18, Math.min(18, this.camTarget.x));
          this.camTarget.z = Math.max(-14, Math.min(14, this.camTarget.z));
        } else {
          // 中键拖动环绕
          this.camAzimuth -= dx * 0.0065;
          this.camPolar = Math.max(0.36, Math.min(1.28, this.camPolar - dy * 0.0055));
        }
        this._syncCameraFromSpherical();
      }

      // 部署/道具悬停实时预览
      if (!this.inMenu && this.ui?.activeDrag && !this.demoDirector?.isRunning()) {
        const hit = this._raycastTileOnly(e.clientX, e.clientY);
        const wp = this._raycastGroundPoint(e.clientX, e.clientY);
        this.ui.handleBattlePointerMove(e.clientX, e.clientY, hit, wp);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 1) {
        this.mmbDragging = false;
        return;
      }
      if (e.button === 0 && !this.inMenu && !this.demoDirector?.isRunning()) {
        const isOnCanvas = e.target === this.canvas;
        if (this.ui?.activeDrag) {
          const hit = isOnCanvas ? this._raycastTileOnly(e.clientX, e.clientY) : null;
          const consumed = this.ui.handleBattlePointerUp(e.clientX, e.clientY, hit, isOnCanvas);
          if (consumed) return;
        }
        if (isOnCanvas) {
          const pick = this._raycastUnitOrTile(e.clientX, e.clientY);
          this.ui.handleCanvasPick(pick);
        }
      }
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.inMenu || this.demoDirector?.isRunning()) return;
        const delta = Math.sign(e.deltaY);
        this.camRadius = Math.max(10.5, Math.min(43.0, this.camRadius * (1 + delta * 0.085)));
        this._syncCameraFromSpherical();
      },
      { passive: false }
    );
  }

  _setRayFromClient(clientX, clientY) {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  _raycastGroundPoint(clientX, clientY) {
    this._setRayFromClient(clientX, clientY);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, out);
  }

  _raycastTileOnly(clientX, clientY) {
    if (!this.sceneBundle) return null;
    this._setRayFromClient(clientX, clientY);
    const meshes = [];
    for (const tv of this.sceneBundle.tileVisuals.values()) {
      if (tv.pickMesh) meshes.push(tv.pickMesh);
    }
    const hits = this.raycaster.intersectObjects(meshes, false);
    return hits.length > 0 ? hits[0].object.userData : null;
  }

  _raycastUnitOrTile(clientX, clientY) {
    if (!this.sceneBundle || !this.sim) return null;
    this._setRayFromClient(clientX, clientY);
    const targets = [];
    for (const tw of this.sim.towers) {
      if (!tw.dead && tw.model) targets.push(...tw.model.root.children);
    }
    for (const en of this.sim.enemies) {
      if (!en.dead && en.dyingTimer <= 0 && en.model) targets.push(...en.model.root.children);
    }
    for (const tv of this.sceneBundle.tileVisuals.values()) {
      if (tv.pickMesh) targets.push(tv.pickMesh);
    }
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      let obj = h.object;
      while (obj) {
        if (obj.userData && obj.userData.pickType) return obj.userData;
        obj = obj.parent;
      }
    }
    return null;
  }

  // ==========================================================================
  // 场景切换：主菜单 / 关卡战斗 / 视频导出帧渲染
  // ==========================================================================
  _clearThreeScene() {
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
    this.sceneBundle = null;
    this.vfx = null;
    this.sim = null;
  }

  showMainMenu() {
    this.inMenu = true;
    this.ui.resetTransientUI();
    this.ui.hideDemoOverlay();
    this.ui.menuScreen.classList.remove('hidden');
    this.ui.battleHud.classList.add('hidden');
    this.ui.pauseModal.classList.add('hidden');
    this.ui.reportModal.classList.add('hidden');

    // 背景加载骨干流域动态立体网络供菜单观赏
    this._clearThreeScene();
    const bgMap = MAPS[1];
    this.sceneBundle = buildBattlefieldScene(bgMap);
    this.scene.background = new THREE.Color(this.sceneBundle.themePalette.bg);
    this.scene.fog = new THREE.FogExp2(this.sceneBundle.themePalette.fog, 0.013);
    this.scene.add(this.sceneBundle.root);
    this._setupSceneLights(this.sceneBundle.themePalette);
    this.setCameraPose({ tx: 0, tz: 0.5, radius: 33, polar: 0.98, azimuth: 0.35 });

    sound.setTheme('menu');
  }

  loadBattle(mapId, { seed = 20261113, isDemo = false } = {}) {
    const map = getMapById(mapId);
    this.currentMap = map;
    this.inMenu = false;

    this.ui.menuScreen.classList.add('hidden');
    this.ui.battleHud.classList.remove('hidden');
    this.ui.pauseModal.classList.add('hidden');
    this.ui.reportModal.classList.add('hidden');
    this.ui.resetTransientUI();

    this._clearThreeScene();
    this.sceneBundle = buildBattlefieldScene(map);
    this.scene.background = new THREE.Color(this.sceneBundle.themePalette.bg);
    this.scene.fog = new THREE.FogExp2(this.sceneBundle.themePalette.fog, 0.013);
    this.scene.add(this.sceneBundle.root);
    this._setupSceneLights(this.sceneBundle.themePalette);

    this.vfx = new VFXManager(this.scene, map);
    this.sim = new BattleSim(map, this.sceneBundle, this.vfx, {
      seed,
      onEvent: (ev) => this._onSimEvent(ev)
    });

    this.ui.buildBattleDock();
    this.resetCameraToDefault();
    this.ui.syncAll();

    if (!this.exportMode) {
      sound.setTheme(map.theme);
    }
  }

  _onSimEvent(ev) {
    if (ev.type === 'banner' && !this.demoDirector.isRunning()) {
      this.ui.showBanner(ev.text, ev.critical);
    } else if (ev.type === 'new_enemy_seen' && !this.demoDirector.isRunning()) {
      this.ui.showThreatToast(ev.def);
    } else if (ev.type === 'route_shift' && !this.demoDirector.isRunning()) {
      this.ui.showBanner(`${ev.reason ? `[${ev.reason}] ` : ''}路由重收敛：${ev.desc}`, false);
    } else if (ev.type === 'wave_start' || ev.type === 'wave_prep') {
      this.ui.syncForecast();
    } else if (ev.type === 'gameover' && !this.demoDirector.isRunning()) {
      this.ui.showIncidentReport(ev.victory);
    }
  }

  setExportMode(enabled) {
    this.exportMode = !!enabled;
    sound.suppressSfx = !!enabled;
    if (enabled) {
      sound.stopTheme();
    }
  }

  // 渲染单帧（支持实时循环与 videoExport.frame 同步渲染）
  renderSingleFrame(dt = 0) {
    const simTime = this.sim ? this.sim.simTime : performance.now() * 0.001;
    if (this.sceneBundle) {
      updateBattlefieldVisuals(this.sceneBundle, simTime, dt || 1 / 60, this.sim);
    }
    if (this.sim && !this.inMenu) {
      this.ui.updateWorldProjections(this.camera);
    }
    this.composer.render();
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(w, h);
    if (!this.inMenu && !this.demoDirector.isRunning()) {
      // 保持视野自适应完整显示地图
      this._syncCameraFromSpherical();
    }
  }

  _animate(nowMs) {
    requestAnimationFrame(this._animate);

    // 导出模式期间：正常实时循环绝不额外推进同一对局（严格遵守 2.15 节规定！）
    if (this.exportMode) return;

    const rawDt = Math.min(0.05, Math.max(0.001, (nowMs - this.lastFrameMs) / 1000));
    this.lastFrameMs = nowMs;

    if (this.inMenu) {
      // 菜单背景缓慢环绕展示立体网络空间
      this.camAzimuth += rawDt * 0.085;
      this._syncCameraFromSpherical();
      this.renderSingleFrame(rawDt);
      return;
    }

    if (this.demoDirector.isRunning()) {
      this.demoDirector.stepDemo(rawDt);
      this.ui.syncAll();
      this.renderSingleFrame(rawDt);
      return;
    }

    if (this.sim) {
      this.sim.step(rawDt);
      this.ui.syncAll();
      this.renderSingleFrame(rawDt);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new GameApp();
});
