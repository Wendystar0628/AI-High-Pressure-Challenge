import * as THREE from 'three';
import { ENEMY_CONFIGS, GAME_CONSTANTS, TOWER_CONFIGS } from './config';
import type { GameEngine } from './engine';
import {
  buildEnemyModel,
  buildEntryPortalModel,
  buildExitCoreModel,
  buildObstacleProp,
  buildTowerModel,
  createProceduralTextures,
  type ProceduralTextures,
} from './models';
import { keyOf } from './pathfinding';
import type {
  Direction,
  EnemyEntity,
  GridCoord,
  MapDef,
  MapId,
  RoutePreviewResult,
  TowerEntity,
  TowerType,
} from './types';

interface TileVisual {
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  topMat: THREE.MeshStandardMaterial;
  nodeRing?: THREE.Mesh;
  nodeShields?: THREE.Group;
  downgradeRing?: THREE.Mesh;
  telegraphMesh?: THREE.Mesh;
  blackholeMesh?: THREE.Group;
  lockdownMesh?: THREE.Group;
}

export interface HoverIntent {
  kind: 'none' | 'tower' | 'item' | 'orient';
  towerType?: TowerType;
  itemId?: 'isolator' | 'downgrade' | 'restore';
  x: number;
  y: number;
  direction?: Direction;
  valid: boolean;
  affectedTiles?: GridCoord[];
  routePreview?: RoutePreviewResult;
}

export class SceneManager {
  private container: HTMLElement;
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;

  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private tex: ProceduralTextures;

  private envGroup = new THREE.Group();
  private boardGroup = new THREE.Group();
  private routesGroup = new THREE.Group();
  private previewGroup = new THREE.Group();
  private unitsGroup = new THREE.Group();
  private vfxGroup = new THREE.Group();

  private tileVisuals: Map<string, TileVisual> = new Map();
  private hitMeshes: THREE.Mesh[] = [];
  private towerMeshes: Map<number, { mesh: THREE.Group; sig: string }> = new Map();
  private isolatorMeshes: Map<number, THREE.Group> = new Map();
  private enemyMeshes: Map<number, THREE.Group> = new Map();

  private ambientPackets: Array<{
    entryId: string;
    progress: number;
    speed: number;
    lateralOffset: number;
    mesh: THREE.Object3D;
  }> = [];
  private distantStreamCurves: Array<{
    curve: THREE.CatmullRomCurve3;
    bead: THREE.Mesh;
    t: number;
    speed: number;
  }> = [];
  private protocolPlane: THREE.Mesh | null = null;
  private spinProps: THREE.Object3D[] = [];
  private streamMaterials: THREE.MeshStandardMaterial[] = [];
  private routeTubes: THREE.Mesh[] = [];
  private routePulseTimer = 0;

  private hoverMesh: THREE.Group;
  private rangeCircle: THREE.LineLoop;
  private sectorMesh: THREE.Mesh;

  // Camera spherical orbit state (Blender style)
  private camTarget = new THREE.Vector3(0, 0, 0);
  private camTheta = 0.0;
  private camPhi = 0.72; // angle from top
  private camDist = 25;
  private defaultCamTarget = new THREE.Vector3(0, 0, 0);
  private defaultCamTheta = 0.0;
  private defaultCamPhi = 0.72;
  private defaultCamDist = 25;
  private demoCameraOverride = false;

  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();

  private animClock = 0;

  constructor(container: HTMLElement, overlayCanvas: HTMLCanvasElement) {
    this.container = container;
    this.overlayCanvas = overlayCanvas;
    this.overlayCtx = overlayCanvas.getContext('2d')!;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040914);
    this.scene.fog = new THREE.FogExp2(0x040914, 0.0115);

    this.camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.2, 220);
    this.tex = createProceduralTextures();

    this.setupLights();
    this.scene.add(
      this.envGroup,
      this.boardGroup,
      this.routesGroup,
      this.previewGroup,
      this.unitsGroup,
      this.vfxGroup
    );

    // Placement hover indicator + range indicators
    this.hoverMesh = new THREE.Group();
    const hBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.14, 1.9),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.45,
      })
    );
    this.hoverMesh.add(hBox);
    this.hoverMesh.visible = false;
    this.previewGroup.add(this.hoverMesh);

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a), 0.1, Math.sin(a)));
    }
    this.rangeCircle = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
    );
    this.rangeCircle.visible = false;
    this.previewGroup.add(this.rangeCircle);

    this.sectorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
      })
    );
    this.sectorMesh.rotation.x = -Math.PI / 2;
    this.sectorMesh.visible = false;
    this.previewGroup.add(this.sectorMesh);

    this.resize();
  }

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 1.1);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xe0f2fe, 1.65);
    dir.position.set(14, 26, 16);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 4;
    dir.shadow.camera.far = 70;
    const d = 20;
    dir.shadow.camera.left = -d;
    dir.shadow.camera.right = d;
    dir.shadow.camera.top = d;
    dir.shadow.camera.bottom = -d;
    dir.shadow.bias = -0.0005;
    this.scene.add(dir);

    const rim = new THREE.DirectionalLight(0x818cf8, 0.65);
    rim.position.set(-16, 10, -14);
    this.scene.add(rim);
  }

  public resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    this.overlayCanvas.width = Math.round(w * dpr);
    this.overlayCanvas.height = Math.round(h * dpr);
    this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  public gridToWorld(gx: number, gy: number, cols = 15, rows = 11): THREE.Vector3 {
    const ts = GAME_CONSTANTS.TILE_SIZE;
    return new THREE.Vector3(
      (gx - (cols - 1) / 2) * ts,
      0,
      (gy - (rows - 1) / 2) * ts
    );
  }

  public resetCamera(): void {
    this.demoCameraOverride = false;
    this.camTarget.copy(this.defaultCamTarget);
    this.camTheta = this.defaultCamTheta;
    this.camPhi = this.defaultCamPhi;
    this.camDist = this.defaultCamDist;
    this.applyOrbitCamera();
  }

  public orbitBy(dx: number, dy: number): void {
    this.demoCameraOverride = false;
    this.camTheta -= dx * 0.0065;
    this.camPhi = Math.max(0.28, Math.min(1.28, this.camPhi - dy * 0.0055));
    this.applyOrbitCamera();
  }

  public panBy(dx: number, dy: number): void {
    this.demoCameraOverride = false;
    const scale = this.camDist * 0.0014;
    const right = new THREE.Vector3(Math.cos(this.camTheta), 0, -Math.sin(this.camTheta));
    const fwd = new THREE.Vector3(Math.sin(this.camTheta), 0, Math.cos(this.camTheta));
    this.camTarget.addScaledVector(right, -dx * scale);
    this.camTarget.addScaledVector(fwd, -dy * scale);
    this.camTarget.x = Math.max(-14, Math.min(14, this.camTarget.x));
    this.camTarget.z = Math.max(-10, Math.min(10, this.camTarget.z));
    this.applyOrbitCamera();
  }

  public zoomBy(deltaY: number): void {
    this.demoCameraOverride = false;
    this.camDist = Math.max(11, Math.min(44, this.camDist * (1 + deltaY * 0.0009)));
    this.applyOrbitCamera();
  }

  public setDemoCamera(pos: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.demoCameraOverride = true;
    this.camera.position.copy(pos);
    this.camera.lookAt(lookAt);
  }

  private applyOrbitCamera(): void {
    if (this.demoCameraOverride) return;
    const sinP = Math.sin(this.camPhi);
    const cosP = Math.cos(this.camPhi);
    const x = this.camTarget.x + this.camDist * sinP * Math.sin(this.camTheta);
    const y = this.camTarget.y + this.camDist * cosP;
    const z = this.camTarget.z + this.camDist * sinP * Math.cos(this.camTheta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.camTarget);
  }

  public buildMapScene(engine: GameEngine): void {
    this.clearGroup(this.envGroup);
    this.clearGroup(this.boardGroup);
    this.clearGroup(this.routesGroup);
    this.clearGroup(this.unitsGroup);
    this.clearGroup(this.vfxGroup);
    this.tileVisuals.clear();
    this.hitMeshes = [];
    this.towerMeshes.clear();
    this.isolatorMeshes.clear();
    this.enemyMeshes.clear();
    this.ambientPackets = [];
    this.distantStreamCurves = [];
    this.spinProps = [];
    this.streamMaterials = [];

    const map = engine.map;
    this.buildCyberspaceEnvironment(map);

    // Default overview framing fits whole board cleanly above bottom dock
    this.defaultCamTarget.set(0, 0.25, 1.6);
    this.defaultCamTheta = 0.0;
    this.defaultCamPhi = 0.7;
    this.defaultCamDist = 30.2;
    this.resetCamera();

    // Floating chassis under-deck
    const deckW = map.cols * GAME_CONSTANTS.TILE_SIZE + 1.4;
    const deckD = map.rows * GAME_CONSTANTS.TILE_SIZE + 1.4;
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(deckW, 0.6, deckD),
      new THREE.MeshStandardMaterial({
        color: 0x060d1c,
        metalness: 0.85,
        roughness: 0.35,
      })
    );
    chassis.position.y = -0.45;
    chassis.receiveShadow = true;
    this.boardGroup.add(chassis);

    // Glowing edge trim frame around island
    const trimColor =
      map.id === 'intranet' ? 0x38bdf8 : map.id === 'backbone' ? 0x818cf8 : 0xf59e0b;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(deckW + 0.08, 0.62, deckD + 0.08)),
      new THREE.LineBasicMaterial({ color: trimColor, transparent: true, opacity: 0.55 })
    );
    edges.position.y = -0.45;
    this.boardGroup.add(edges);

    // Build tiles
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        const t = engine.tiles[y][x];
        if (t.type === 'void') continue;
        const pos = this.gridToWorld(x, y, map.cols, map.rows);
        const tg = new THREE.Group();
        tg.position.copy(pos);

        let topMat: THREE.MeshStandardMaterial;
        let hitMesh: THREE.Mesh;

        if (t.type === 'platform') {
          topMat = new THREE.MeshStandardMaterial({
            map: this.tex.platformAlbedo,
            emissive: 0x082f49,
            emissiveIntensity: 0.25,
            roughness: 0.4,
            metalness: 0.55,
          });
          const plat = new THREE.Mesh(
            new THREE.BoxGeometry(1.9, GAME_CONSTANTS.PLATFORM_HEIGHT + 0.14, 1.9),
            topMat
          );
          plat.position.y = (GAME_CONSTANTS.PLATFORM_HEIGHT - 0.14) * 0.5;
          plat.castShadow = true;
          plat.receiveShadow = true;
          tg.add(plat);

          const capTrim = new THREE.Mesh(
            new THREE.BoxGeometry(1.74, 0.05, 1.74),
            new THREE.MeshStandardMaterial({
              color: 0x334155,
              metalness: 0.85,
              roughness: 0.26,
            })
          );
          capTrim.position.y = GAME_CONSTANTS.PLATFORM_HEIGHT + 0.01;
          capTrim.receiveShadow = true;
          tg.add(capTrim);

          const pinMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
          for (const px of [-0.76, 0.76]) {
            for (const pz of [-0.76, 0.76]) {
              const pin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), pinMat);
              pin.position.set(px, GAME_CONSTANTS.PLATFORM_HEIGHT + 0.02, pz);
              tg.add(pin);
            }
          }
          hitMesh = plat;
        } else if (t.type === 'legacy') {
          topMat = new THREE.MeshStandardMaterial({
            map: this.tex.legacyAlbedo,
            emissive: 0x78350f,
            emissiveIntensity: 0.36,
            roughness: 0.52,
            metalness: 0.48,
          });
          const road = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.14, 1.94), topMat);
          road.position.y = -0.09;
          road.receiveShadow = true;
          tg.add(road);

          const warnBarMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.6 });
          for (const sx of [-0.88, 0.88]) {
            const curb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 1.76), warnBarMat);
            curb.position.set(sx, -0.01, 0);
            tg.add(curb);
          }
          hitMesh = road;
        } else if (t.type === 'node') {
          topMat = new THREE.MeshStandardMaterial({
            map: this.tex.nodeAlbedo,
            emissive: 0x065f46,
            emissiveIntensity: 0.45,
            roughness: 0.3,
            metalness: 0.75,
          });
          const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 1.0, 0.24, 8), topMat);
          plinth.position.y = -0.03;
          plinth.receiveShadow = true;
          tg.add(plinth);
          hitMesh = plinth;

          const nodeRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.68, 0.045, 8, 24),
            new THREE.MeshBasicMaterial({ color: 0x10b981 })
          );
          nodeRing.rotation.x = Math.PI / 2;
          nodeRing.position.y = 0.12;
          tg.add(nodeRing);

          // Blast shields shown when node is isolated!
          const shields = new THREE.Group();
          const bMat = new THREE.MeshStandardMaterial({
            color: 0xf43f5e,
            emissive: 0xe11d48,
            emissiveIntensity: 1.1,
            transparent: true,
            opacity: 0.7,
          });
          for (let k = 0; k < 4; k++) {
            const ang = (k * Math.PI) / 2;
            const wall = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.52, 0.12), bMat);
            wall.position.set(Math.sin(ang) * 0.85, 0.28, Math.cos(ang) * 0.85);
            wall.rotation.y = ang;
            shields.add(wall);
          }
          shields.visible = false;
          tg.add(shields);

          const tv: TileVisual = {
            group: tg,
            hitMesh,
            topMat,
            nodeRing,
            nodeShields: shields,
          };
          this.attachSharedTileEffects(tg, tv);
          this.tileVisuals.set(keyOf(x, y), tv);
        } else if (t.type === 'obstacle') {
          topMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
          const hit = new THREE.Mesh(
            new THREE.BoxGeometry(1.94, 0.2, 1.94),
            new THREE.MeshBasicMaterial({ visible: false })
          );
          tg.add(hit);
          const prop = buildObstacleProp(map.id, x, y, this.tex);
          tg.add(prop);
          if (prop.userData.spinCrystal) this.spinProps.push(prop.userData.spinCrystal);
          if (prop.userData.isPublicStream) {
            const m = (prop.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
            this.streamMaterials.push(m);
          }
          hitMesh = hit;
        } else if (t.type === 'entry') {
          const entry = map.entries.find((e) => e.id === t.entryId)!;
          topMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            emissive: entry.hex,
            emissiveIntensity: 0.65,
          });
          const pad = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.2, 1.94), topMat);
          pad.position.y = -0.05;
          tg.add(pad);

          const portal = buildEntryPortalModel(entry.hex);
          tg.add(portal);
          hitMesh = pad;
        } else if (t.type === 'exit') {
          topMat = new THREE.MeshStandardMaterial({
            color: 0x064e3b,
            emissive: 0x22d3ee,
            emissiveIntensity: 0.65,
          });
          const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.08, 0.26, 8), topMat);
          pad.position.y = -0.02;
          tg.add(pad);

          const { group: coreGroup, spinParts } = buildExitCoreModel(map.id);
          tg.add(coreGroup);
          for (const sp of spinParts) this.spinProps.push(sp);

          hitMesh = pad;
        } else {
          // Standard link road
          topMat = new THREE.MeshStandardMaterial({
            map: this.tex.linkAlbedo,
            bumpMap: this.tex.linkBump,
            bumpScale: 0.03,
            emissive: 0x0c192c,
            emissiveIntensity: 0.35,
            roughness: 0.48,
            metalness: 0.5,
          });
          const road = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.16, 1.94), topMat);
          road.position.y = -0.08;
          road.receiveShadow = true;
          tg.add(road);

          const curbMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.78,
            roughness: 0.35,
          });
          const frame = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.06, 1.98), curbMat);
          frame.position.y = -0.13;
          tg.add(frame);
          hitMesh = road;
        }

        hitMesh.userData = { gridX: x, gridY: y };
        this.hitMeshes.push(hitMesh);

        if (!this.tileVisuals.has(keyOf(x, y))) {
          const tv: TileVisual = { group: tg, hitMesh, topMat };
          this.attachSharedTileEffects(tg, tv);
          this.tileVisuals.set(keyOf(x, y), tv);
        }

        this.boardGroup.add(tg);
      }
    }

    this.rebuildRouteSplines(engine);
    this.routePulseTimer = 0;
  }

  private attachSharedTileEffects(tg: THREE.Group, tv: TileVisual): void {
    const dg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.88, 1.88),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
      })
    );
    dg.rotation.x = -Math.PI / 2;
    dg.position.y = 0.06;
    dg.visible = false;
    tg.add(dg);
    tv.downgradeRing = dg;

    const tel = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.85, 16),
      new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    tel.rotation.x = -Math.PI / 2;
    tel.position.y = 0.16;
    tel.visible = false;
    tg.add(tel);
    tv.telegraphMesh = tel;

    const bhGroup = new THREE.Group();
    const bhCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x050008 })
    );
    const bhRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.06, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0xec4899 })
    );
    bhRing.rotation.x = Math.PI / 2;
    bhGroup.position.y = 0.42;
    bhGroup.add(bhCore, bhRing);
    bhGroup.visible = false;
    tg.add(bhGroup);
    tv.blackholeMesh = bhGroup;

    const lockGroup = new THREE.Group();
    const lockMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.72,
    });
    const lockBox = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.9, 1.65), lockMat);
    lockBox.position.y = 0.45;
    lockGroup.add(lockBox);
    lockGroup.visible = false;
    tg.add(lockGroup);
    tv.lockdownMesh = lockGroup;
  }

  private buildCyberspaceEnvironment(map: MapDef): void {
    const mapId = map.id;
    const bgHex = mapId === 'intranet' ? 0x040b18 : mapId === 'backbone' ? 0x06071a : 0x0c070a;
    this.scene.background = new THREE.Color(bgHex);
    (this.scene.fog as THREE.FogExp2).color.setHex(bgHex);

    // Deep Protocol Layer 1 & 2
    const pGeo = new THREE.PlaneGeometry(180, 180);
    const pMat = new THREE.MeshBasicMaterial({
      map: this.tex.protocolGridTex,
      color: mapId === 'intranet' ? 0x0ea5e9 : mapId === 'backbone' ? 0x6366f1 : 0xf59e0b,
      transparent: true,
      opacity: 0.28,
    });
    const plane1 = new THREE.Mesh(pGeo, pMat);
    plane1.rotation.x = -Math.PI / 2;
    plane1.position.y = -4.5;
    this.envGroup.add(plane1);
    this.protocolPlane = plane1;

    const plane2 = new THREE.Mesh(
      pGeo,
      new THREE.MeshBasicMaterial({
        map: this.tex.protocolGridTex,
        color: mapId === 'airgap' ? 0xef4444 : 0x1e3a8a,
        transparent: true,
        opacity: 0.16,
      })
    );
    plane2.rotation.x = -Math.PI / 2;
    plane2.position.y = -11.0;
    this.envGroup.add(plane2);

    // Distant Autonomous System (AS) Multi-Tier Skyline Clusters via InstancedMesh
    const count = 96;
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const accentHex = mapId === 'intranet' ? 0x0284c7 : mapId === 'backbone' ? 0x4f46e5 : 0xd97706;
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: accentHex,
      emissiveIntensity: 0.22,
      metalness: 0.85,
      roughness: 0.35,
    });
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0x162036,
      emissive: accentHex,
      emissiveIntensity: 0.55,
      metalness: 0.82,
      roughness: 0.3,
    });
    const crownMat = new THREE.MeshBasicMaterial({
      color: mapId === 'intranet' ? 0x38bdf8 : mapId === 'backbone' ? 0x818cf8 : 0xfbbf24,
      transparent: true,
      opacity: 0.72,
    });

    const plinthInst = new THREE.InstancedMesh(boxGeo, baseMat, count);
    const towerInst = new THREE.InstancedMesh(boxGeo, spireMat, count);
    const crownInst = new THREE.InstancedMesh(boxGeo, crownMat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + (i % 5) * 0.12;
      const rad = 22 + ((i * 19) % 26);
      const h = 5.0 + ((i * 23) % 14);
      const w = 1.6 + ((i * 7) % 3) * 0.85;
      const px = Math.cos(ang) * rad;
      const pz = Math.sin(ang) * rad;

      dummy.position.set(px, -5.8 + h * 0.22, pz);
      dummy.scale.set(w * 1.35, h * 0.44, w * 1.35);
      dummy.rotation.y = ang;
      dummy.updateMatrix();
      plinthInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(px, -5.8 + h * 0.65, pz);
      dummy.scale.set(w * 0.82, h * 0.7, w * 0.82);
      dummy.updateMatrix();
      towerInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(px, -5.8 + h + 0.16, pz);
      dummy.scale.set(w * 0.86, 0.22, w * 0.86);
      dummy.updateMatrix();
      crownInst.setMatrixAt(i, dummy.matrix);
    }
    this.envGroup.add(plinthInst, towerInst, crownInst);

    // Anchor pylons connecting floating board chassis down to deep protocol layers
    const deckHalfW = map.cols * GAME_CONSTANTS.TILE_SIZE * 0.5;
    const deckHalfD = map.rows * GAME_CONSTANTS.TILE_SIZE * 0.5;
    const strutMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.35,
    });
    const beamMat = new THREE.MeshBasicMaterial({
      color: mapId === 'intranet' ? 0x38bdf8 : mapId === 'backbone' ? 0x818cf8 : 0xf59e0b,
      transparent: true,
      opacity: 0.38,
    });
    for (const [cx, cz] of [
      [-deckHalfW + 0.5, -deckHalfD + 0.5],
      [deckHalfW - 0.5, -deckHalfD + 0.5],
      [-deckHalfW + 0.5, deckHalfD - 0.5],
      [deckHalfW - 0.5, deckHalfD - 0.5],
    ]) {
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.48, 3.9, 6), strutMat);
      pylon.position.set(cx, -2.65, cz);
      this.envGroup.add(pylon);

      const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9.8, 6), beamMat);
      conduit.position.set(cx, -5.6, cz);
      this.envGroup.add(conduit);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 6, 16), beamMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(cx, -4.45, cz);
      this.envGroup.add(ring);
    }

    // Direct aerial trunk cables anchoring each map entry & exit core into distant AS clusters
    for (const entry of map.entries) {
      const ew = this.gridToWorld(entry.x, entry.y, map.cols, map.rows);
      const outX = ew.x * 1.45;
      const outZ = ew.z - 17;
      const p0 = new THREE.Vector3(outX, -2.2, outZ);
      const p1 = new THREE.Vector3(ew.x * 1.18, 3.2, ew.z - 7.5);
      const p2 = new THREE.Vector3(ew.x, 0.72, ew.z);
      const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
      const cable = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, 0.055, 6, false),
        new THREE.MeshBasicMaterial({ color: entry.hex, transparent: true, opacity: 0.35 })
      );
      this.envGroup.add(cable);
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 6, 6),
        new THREE.MeshBasicMaterial({ color: entry.hex })
      );
      this.envGroup.add(bead);
      this.distantStreamCurves.push({ curve, bead, t: 0.2, speed: 0.38 });
    }
    for (const exit of map.exits) {
      const xw = this.gridToWorld(exit.x, exit.y, map.cols, map.rows);
      const p0 = new THREE.Vector3(xw.x, -0.35, xw.z);
      const p1 = new THREE.Vector3(xw.x * 1.2, -3.0, xw.z + 6);
      const p2 = new THREE.Vector3(xw.x * 1.5, -5.2, xw.z + 18);
      const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
      const cable = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 20, 0.06, 6, false),
        new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.28 })
      );
      this.envGroup.add(cable);
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x6ee7b7 })
      );
      this.envGroup.add(bead);
      this.distantStreamCurves.push({ curve, bead, t: 0.55, speed: 0.32 });
    }

    // Far-distance luminous AS data arcs connecting distant clusters to the island edge
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI * 2;
      const p0 = new THREE.Vector3(Math.cos(a0) * 14, -0.3, Math.sin(a0) * 10);
      const p1 = new THREE.Vector3(Math.cos(a0 + 0.15) * 26, 4.5, Math.sin(a0 + 0.15) * 22);
      const p2 = new THREE.Vector3(Math.cos(a0 + 0.35) * 42, -3.5, Math.sin(a0 + 0.35) * 38);
      const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
      const pts = curve.getPoints(32);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          color: mapId === 'airgap' ? 0xf59e0b : 0x38bdf8,
          transparent: true,
          opacity: 0.18,
        })
      );
      this.envGroup.add(line);

      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 6),
        new THREE.MeshBasicMaterial({ color: mapId === 'airgap' ? 0xfbbf24 : 0x7dd3fc })
      );
      this.envGroup.add(bead);
      this.distantStreamCurves.push({ curve, bead, t: (k * 0.17) % 1, speed: 0.22 + (k % 3) * 0.08 });
    }
  }

  public rebuildRouteSplines(engine: GameEngine): void {
    this.clearGroup(this.routesGroup);
    this.ambientPackets = [];
    this.routeTubes = [];
    this.routePulseTimer = 1.25;

    const map = engine.map;
    const offsets = [-0.28, 0.28, 0.0];

    map.entries.forEach((entry, idx) => {
      const path = engine.entryRoutes[entry.id];
      if (!path || path.length < 2) return;
      const off = offsets[idx % offsets.length];
      const pts = path.map((c) => {
        const w = this.gridToWorld(c.x, c.y, map.cols, map.rows);
        w.x += off;
        w.y = 0.08 + idx * 0.015;
        w.z += off * 0.6;
        return w;
      });
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, path.length * 4, 0.06, 6, false),
        new THREE.MeshBasicMaterial({
          color: entry.hex,
          transparent: true,
          opacity: 0.72,
        })
      );
      this.routesGroup.add(tube);
      this.routeTubes.push(tube);

      // Animated directional traffic chevrons traveling along the link!
      for (let b = 0; b < 4; b++) {
        const holder = new THREE.Group();
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.14, 0.34, 4),
          new THREE.MeshBasicMaterial({ color: entry.hex })
        );
        cone.rotation.x = Math.PI / 2;
        holder.add(cone);
        this.routesGroup.add(holder);
        this.ambientPackets.push({
          entryId: entry.id,
          progress: b / 4,
          speed: 0.2,
          lateralOffset: off,
          mesh: holder,
        });
      }

      // Subtle wireless aerial route indicators (for Rogue Hotspot intuition)
      const startW = this.gridToWorld(entry.x, entry.y, map.cols, map.rows);
      startW.y = GAME_CONSTANTS.FLY_HEIGHT;
      for (const exit of map.exits) {
        const endW = this.gridToWorld(exit.x, exit.y, map.cols, map.rows);
        endW.y = GAME_CONSTANTS.FLY_HEIGHT;
        const airGeo = new THREE.BufferGeometry().setFromPoints([startW, endW]);
        const airLine = new THREE.Line(
          airGeo,
          new THREE.LineDashedMaterial({
            color: entry.hex,
            dashSize: 0.45,
            gapSize: 0.45,
            transparent: true,
            opacity: 0.24,
          })
        );
        airLine.computeLineDistances();
        this.routesGroup.add(airLine);
      }
    });
  }

  public raycastGrid(clientX: number, clientY: number): GridCoord | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    if (hits.length === 0) return null;
    const ud = hits[0].object.userData;
    if (typeof ud.gridX === 'number' && typeof ud.gridY === 'number') {
      return { x: ud.gridX, y: ud.gridY };
    }
    return null;
  }

  public updateHoverPreview(
    engine: GameEngine,
    hover: HoverIntent | null,
    selectedTower: TowerEntity | null
  ): void {
    // Clear dynamic preview route splines (keep first 3 children: hoverMesh, rangeCircle, sectorMesh)
    while (this.previewGroup.children.length > 3) {
      const ch = this.previewGroup.children[3];
      this.previewGroup.remove(ch);
    }
    this.hoverMesh.visible = false;
    this.rangeCircle.visible = false;
    this.sectorMesh.visible = false;

    const map = engine.map;

    // Show selected tower range/sector in 3D!
    if (selectedTower) {
      const w = this.gridToWorld(selectedTower.x, selectedTower.y, map.cols, map.rows);
      if (selectedTower.type === 'interceptor') {
        this.showSectorPreview(
          w,
          selectedTower.direction,
          engine.getTowerRange(selectedTower),
          0x22d3ee
        );
      } else {
        const r = engine.getTowerRange(selectedTower);
        if (r > 0) {
          this.rangeCircle.position.set(w.x, 0.22, w.z);
          const sc = r * GAME_CONSTANTS.TILE_SIZE;
          this.rangeCircle.scale.set(sc, 1, sc);
          this.rangeCircle.visible = true;
        }
      }
    }

    if (!hover || hover.kind === 'none') return;

    const w = this.gridToWorld(hover.x, hover.y, map.cols, map.rows);
    this.hoverMesh.visible = true;
    this.hoverMesh.position.set(w.x, 0.12, w.z);
    const boxMesh = this.hoverMesh.children[0] as THREE.Mesh;
    (boxMesh.material as THREE.MeshBasicMaterial).color.setHex(
      hover.valid ? 0x22d3ee : 0xf43f5e
    );

    if (hover.kind === 'tower' && hover.towerType) {
      const cfg = TOWER_CONFIGS[hover.towerType];
      if (hover.towerType === 'interceptor') {
        this.showSectorPreview(w, hover.direction ?? 0, cfg.range, hover.valid ? 0x22d3ee : 0xf43f5e);
      } else if (cfg.range > 0) {
        this.rangeCircle.position.set(w.x, 0.22, w.z);
        const sc = cfg.range * GAME_CONSTANTS.TILE_SIZE;
        this.rangeCircle.scale.set(sc, 1, sc);
        this.rangeCircle.visible = true;
      }
    }

    if (hover.kind === 'orient' && hover.direction !== undefined) {
      this.showSectorPreview(w, hover.direction, TOWER_CONFIGS.interceptor.range, 0x38bdf8);
    }

    if (hover.affectedTiles && hover.affectedTiles.length > 0) {
      for (const c of hover.affectedTiles) {
        const aw = this.gridToWorld(c.x, c.y, map.cols, map.rows);
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(1.75, 1.75),
          new THREE.MeshBasicMaterial({
            color: hover.valid ? 0xf59e0b : 0xf43f5e,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
          })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set(aw.x, 0.14, aw.z);
        this.previewGroup.add(m);
      }
    }

    // Route change preview splines!
    if (hover.routePreview) {
      if (!hover.routePreview.valid) {
        for (const bp of hover.routePreview.blockedPoints) {
          const bw = this.gridToWorld(bp.x, bp.y, map.cols, map.rows);
          const xRing = new THREE.Mesh(
            new THREE.RingGeometry(0.55, 0.92, 16),
            new THREE.MeshBasicMaterial({ color: 0xf43f5e, side: THREE.DoubleSide })
          );
          xRing.rotation.x = -Math.PI / 2;
          xRing.position.set(bw.x, 0.45, bw.z);
          this.previewGroup.add(xRing);

          const xMat = new THREE.MeshBasicMaterial({ color: 0xfda4af });
          const barA = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 0.14), xMat);
          barA.position.set(bw.x, 0.62, bw.z);
          barA.rotation.y = Math.PI / 4;
          const barB = barA.clone();
          barB.rotation.y = -Math.PI / 4;
          this.previewGroup.add(barA, barB);
        }
      } else {
        for (const eid of hover.routePreview.changedEntries) {
          // Subtle crimson/rose dashed trace on the retiring current route for crisp before->after contrast
          const oldPath = engine.entryRoutes[eid];
          if (oldPath && oldPath.length >= 2) {
            const oldPts = oldPath.map((c) => {
              const ow = this.gridToWorld(c.x, c.y, map.cols, map.rows);
              ow.y = 0.22;
              return ow;
            });
            const oldLine = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(oldPts),
              new THREE.LineDashedMaterial({
                color: 0xfb7185,
                dashSize: 0.25,
                gapSize: 0.35,
                transparent: true,
                opacity: 0.65,
              })
            );
            oldLine.computeLineDistances();
            this.previewGroup.add(oldLine);
          }

          const p = hover.routePreview.previewRoutes[eid];
          if (!p || p.length < 2) continue;
          const pts = p.map((c) => {
            const pw = this.gridToWorld(c.x, c.y, map.cols, map.rows);
            pw.y = 0.3;
            return pw;
          });
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineDashedMaterial({
              color: 0xfacc15,
              dashSize: 0.45,
              gapSize: 0.25,
              transparent: true,
              opacity: 0.95,
            })
          );
          line.computeLineDistances();
          this.previewGroup.add(line);

          // Bold 3D dashed ribbon dashes so reroute preview is unmistakable at any resolution
          const dashMat = new THREE.MeshBasicMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: 0.92,
          });
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const mid = new THREE.Vector3().lerpVectors(a, b, 0.5);
            const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.72), dashMat);
            dash.position.copy(mid);
            dash.lookAt(b);
            this.previewGroup.add(dash);
          }
        }
      }
    }
  }

  private showSectorPreview(
    worldCenter: THREE.Vector3,
    dir: Direction,
    reachTiles: number,
    colorHex: number
  ): void {
    const ts = GAME_CONSTANTS.TILE_SIZE;
    const lengthWorld = (reachTiles + 0.6) * ts;
    const widthWorld = 3.1 * ts;
    this.sectorMesh.scale.set(widthWorld, lengthWorld, 1);

    const midOffset = (reachTiles - 0.6) * 0.5 * ts;
    let ox = 0;
    let oz = 0;
    let rotZ = 0;
    if (dir === 0) {
      oz = midOffset;
      rotZ = 0;
    } else if (dir === 1) {
      ox = midOffset;
      rotZ = Math.PI / 2;
    } else if (dir === 2) {
      oz = -midOffset;
      rotZ = Math.PI;
    } else {
      ox = -midOffset;
      rotZ = -Math.PI / 2;
    }
    this.sectorMesh.position.set(
      worldCenter.x + ox,
      GAME_CONSTANTS.PLATFORM_HEIGHT + 0.08,
      worldCenter.z + oz
    );
    this.sectorMesh.rotation.set(-Math.PI / 2, 0, rotZ);
    (this.sectorMesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    this.sectorMesh.visible = true;
  }

  public renderFrame(
    engine: GameEngine,
    dt: number,
    selectedTowerId: number | null,
    selectedEnemyId: number | null
  ): void {
    this.animClock += dt;
    const map = engine.map;

    // Animate environment & public stream
    if (this.protocolPlane) {
      this.tex.protocolGridTex.offset.y = (this.animClock * 0.04) % 1;
    }
    this.tex.streamTex.offset.x = (this.animClock * 0.35) % 1;
    for (const sp of this.spinProps) {
      sp.rotation.y += dt * 1.4;
      sp.rotation.z += dt * 0.6;
    }
    for (const dc of this.distantStreamCurves) {
      dc.t = (dc.t + dc.speed * dt) % 1;
      dc.bead.position.copy(dc.curve.getPoint(dc.t));
    }

    // Pulse route tubes & traffic speed briefly after any reroute / node bypass!
    if (this.routePulseTimer > 0) {
      this.routePulseTimer = Math.max(0, this.routePulseTimer - dt);
    }
    const routeSurge = this.routePulseTimer > 0 ? this.routePulseTimer / 1.25 : 0;
    for (const tube of this.routeTubes) {
      const mat = tube.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.68 + routeSurge * 0.32 * (0.55 + 0.45 * Math.sin(this.animClock * 18));
    }

    // Animate benign traffic chevrons along active routes with matching lane offset & facing
    const packetSurgeMult = 1 + routeSurge * 2.2;
    for (const pkt of this.ambientPackets) {
      const path = engine.entryRoutes[pkt.entryId];
      if (!path || path.length < 2) {
        pkt.mesh.visible = false;
        continue;
      }
      pkt.mesh.visible = true;
      pkt.progress = (pkt.progress + pkt.speed * packetSurgeMult * dt) % 1;
      const fIdx = pkt.progress * (path.length - 1);
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(path.length - 1, i0 + 1);
      const frac = fIdx - i0;
      const w0 = this.gridToWorld(path[i0].x, path[i0].y, map.cols, map.rows);
      const w1 = this.gridToWorld(path[i1].x, path[i1].y, map.cols, map.rows);
      w0.x += pkt.lateralOffset;
      w0.z += pkt.lateralOffset * 0.6;
      w1.x += pkt.lateralOffset;
      w1.z += pkt.lateralOffset * 0.6;
      pkt.mesh.position.lerpVectors(w0, w1, frac);
      pkt.mesh.position.y = 0.14;
      w1.y = 0.14;
      if (i1 !== i0) pkt.mesh.lookAt(w1);
    }

    // Update tile visual states (node rings/shields, downgrades, blackholes, lockdowns, telegraphs)
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        const t = engine.tiles[y][x];
        const tv = this.tileVisuals.get(keyOf(x, y));
        if (!tv) continue;

        if (t.type === 'node' && tv.nodeRing && tv.nodeShields) {
          const isolated = t.towerId !== null || t.isolatorId !== null;
          tv.nodeShields.visible = isolated;
          if (isolated) {
            tv.nodeShields.position.y = 0.04 * Math.sin(this.animClock * 4.5 + x);
          }
          const rMat = tv.nodeRing.material as THREE.MeshBasicMaterial;
          if (isolated) {
            rMat.color.setHex(0xf43f5e);
          } else if (t.nodeCooldown > 0) {
            rMat.color.setHex(0xf59e0b);
          } else {
            rMat.color.setHex(0x10b981);
          }
          tv.nodeRing.rotation.z += dt * (isolated ? 0.4 : 1.8);
        }
        if (tv.downgradeRing) {
          tv.downgradeRing.visible = t.downgradeTimer > 0;
          if (t.downgradeTimer > 0) {
            (tv.downgradeRing.material as THREE.MeshBasicMaterial).opacity =
              0.22 + 0.16 * Math.sin(this.animClock * 6);
          }
        }
        if (tv.telegraphMesh) {
          tv.telegraphMesh.visible = t.telegraphTimer > 0;
          if (t.telegraphTimer > 0) {
            const s = 0.8 + 0.3 * Math.sin(this.animClock * 14);
            tv.telegraphMesh.scale.set(s, s, 1);
          }
        }
        if (tv.blackholeMesh) {
          tv.blackholeMesh.visible = t.blackholeTimer > 0;
          if (t.blackholeTimer > 0) tv.blackholeMesh.rotation.y += dt * 4.5;
        }
        if (tv.lockdownMesh) {
          tv.lockdownMesh.visible = t.lockdownTimer > 0;
        }
      }
    }

    // Sync Tower meshes
    const activeTowerIds = new Set<number>();
    for (const tw of engine.towers) {
      activeTowerIds.add(tw.id);
      const sig = `${tw.type}_${tw.level}_${tw.branch ?? 'base'}`;
      let entry = this.towerMeshes.get(tw.id);
      if (!entry || entry.sig !== sig) {
        if (entry) this.unitsGroup.remove(entry.mesh);
        const mesh = buildTowerModel(tw.type, tw.level, tw.branch, this.tex);
        this.unitsGroup.add(mesh);
        entry = { mesh, sig };
        this.towerMeshes.set(tw.id, entry);
      }

      const m = entry.mesh;
      const w = this.gridToWorld(tw.x, tw.y, map.cols, map.rows);
      const tile = engine.getTile(tw.x, tw.y);
      const baseY =
        tile?.type === 'platform'
          ? GAME_CONSTANTS.PLATFORM_HEIGHT
          : tile?.type === 'node'
          ? GAME_CONSTANTS.NODE_HEIGHT
          : 0;
      m.position.set(w.x, baseY, w.z);

      // Animate parts & reactive action motions (including hit shudder for non-static hit feedback)
      const hitDip = tw.hitFlash * 0.055;
      const hitTilt = tw.hitFlash * Math.sin(this.animClock * 42 + tw.id) * 0.08;
      m.position.y -= hitDip;
      m.rotation.set(hitTilt, 0, hitTilt * 0.7);
      if (tw.type === 'firewall') {
        const lunge = tw.recoil * 0.24;
        m.position.x += Math.sin(tw.aimYaw) * lunge;
        m.position.z += Math.cos(tw.aimYaw) * lunge;
        const guardPulse = tw.targetId !== null || tw.hitFlash > 0.08
          ? 1 + 0.04 * Math.sin(this.animClock * 6 + tw.id)
          : 1;
        m.scale.set(guardPulse, 1 + tw.recoil * 0.08 - tw.hitFlash * 0.06, guardPulse);
      } else {
        m.scale.set(1 + tw.hitFlash * 0.04, 1 - tw.hitFlash * 0.05, 1 + tw.hitFlash * 0.04);
      }
      if (m.userData.headPivot) {
        (m.userData.headPivot as THREE.Object3D).rotation.y = tw.aimYaw;
      }
      if (m.userData.barrelGroup) {
        (m.userData.barrelGroup as THREE.Object3D).position.z = 0.28 - tw.recoil * 0.16;
      }
      if (m.userData.spinBarrel) {
        (m.userData.spinBarrel as THREE.Object3D).rotation.z +=
          dt * (tw.targetId ? 9.0 : 1.5);
      }
      if (m.userData.spinRing) {
        const activeSpin =
          (tw.type === 'repair' && tw.targetId !== null) ||
          (tw.type === 'gate' && tw.hitFlash > 0.05) ||
          (tw.type === 'sandbox' && tw.recoil > 0.05);
        const spinSpd = activeSpin ? 4.8 : 1.8;
        (m.userData.spinRing as THREE.Object3D).rotation.y += dt * spinSpd;
      }
      if (m.userData.bobCrystal) {
        const crys = m.userData.bobCrystal as THREE.Object3D;
        const isLuring = tw.type === 'honeypot' && (tw.hitFlash > 0.06 || tw.recoil > 0.05);
        const lureBoost = isLuring ? 5.2 : 3.0;
        const baseCrysY = tw.type === 'repair' ? 1.15 : tw.type === 'honeypot' ? 0.68 : 0.72;
        crys.position.y = baseCrysY + Math.sin(this.animClock * lureBoost + tw.id) * 0.08;
        crys.rotation.y += dt * (tw.type === 'sandbox' && tw.recoil > 0.1 ? 6.5 : 1.4);
        if (tw.type === 'sandbox') {
          const pulse = 1 + tw.recoil * 0.32;
          crys.scale.setScalar(pulse);
        } else if (tw.type === 'honeypot') {
          const lureScale = isLuring ? 1.12 + 0.08 * Math.sin(this.animClock * 8) : 1;
          crys.scale.setScalar(lureScale);
        }
      }
      if (m.userData.shieldDome) {
        (m.userData.shieldDome as THREE.Object3D).visible = tw.shield > 0;
        (m.userData.shieldDome as THREE.Object3D).rotation.y += dt * 0.8;
      }
      if (m.userData.encryptGroup) {
        (m.userData.encryptGroup as THREE.Object3D).visible = tw.encryptedTimer > 0;
        (m.userData.encryptGroup as THREE.Object3D).rotation.y -= dt * 2.2;
      }
      this.applyUnitFlash(m, tw.hitFlash, tw.healFlash, tw.encryptedTimer > 0);
    }
    for (const [tid, entry] of this.towerMeshes) {
      if (!activeTowerIds.has(tid)) {
        this.towerMeshes.delete(tid);
        this.pushDyingUnit(entry.mesh, 'tower_break', 0.32);
      }
    }

    // Sync Isolator meshes
    const activeIsoIds = new Set<number>();
    for (const iso of engine.isolators) {
      activeIsoIds.add(iso.id);
      let m = this.isolatorMeshes.get(iso.id);
      if (!m) {
        m = new THREE.Group();
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.45, 0.85, 6),
          new THREE.MeshStandardMaterial({
            color: 0x451a03,
            emissive: 0xfbbf24,
            emissiveIntensity: 0.7,
            metalness: 0.8,
          })
        );
        pillar.position.y = 0.44;
        const beacon = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.24),
          new THREE.MeshBasicMaterial({ color: 0xfef08a })
        );
        beacon.position.y = 1.05;
        m.add(pillar, beacon);
        m.userData.beacon = beacon;
        this.unitsGroup.add(m);
        this.isolatorMeshes.set(iso.id, m);
      }
      const w = this.gridToWorld(iso.x, iso.y, map.cols, map.rows);
      m.position.set(w.x, GAME_CONSTANTS.NODE_HEIGHT, w.z);
      (m.userData.beacon as THREE.Object3D).rotation.y += dt * 3.5;
    }
    for (const [iid, m] of this.isolatorMeshes) {
      if (!activeIsoIds.has(iid)) {
        this.isolatorMeshes.delete(iid);
        this.pushDyingUnit(m, 'isolator_fade', 0.28);
      }
    }

    // Sync Enemy meshes
    const activeEnemyIds = new Set<number>();
    for (const e of engine.enemies) {
      activeEnemyIds.add(e.id);
      let m = this.enemyMeshes.get(e.id);
      if (!m) {
        m = buildEnemyModel(e.type, e.isClone);
        this.unitsGroup.add(m);
        this.enemyMeshes.set(e.id, m);
      }

      const w = this.gridToWorld(e.x, e.y, map.cols, map.rows);
      const yPos = e.isFlying
        ? GAME_CONSTANTS.FLY_HEIGHT + Math.sin(e.animPhase * 1.1) * 0.14
        : 0.04;
      m.position.set(w.x, yPos, w.z);
      m.rotation.set(0, e.yaw, 0);

      // Continuous procedural enemy animations & attack/phase actions
      if (m.userData.segments) {
        const segs = m.userData.segments as THREE.Mesh[];
        segs.forEach((s, idx) => {
          s.position.x = Math.sin(e.animPhase - idx * 0.7) * 0.1;
          s.position.y = 0.24 + Math.abs(Math.cos(e.animPhase - idx * 0.6)) * 0.04;
        });
      }
      if (m.userData.jaws) {
        const snap = 0.24 + e.attackAnim * 0.52 + Math.abs(Math.sin(e.animPhase * 2.2)) * 0.12;
        for (const jaw of m.userData.jaws as THREE.Mesh[]) {
          const sx = (jaw.userData.side as number) ?? 1;
          jaw.rotation.y = (sx > 0 ? -1 : 1) * snap;
        }
      }
      if (m.userData.ramHead) {
        (m.userData.ramHead as THREE.Object3D).position.z =
          0.52 + e.attackAnim * 0.28 + Math.sin(e.animPhase) * 0.04;
        m.rotation.x = -e.attackAnim * 0.16;
      }
      if (m.userData.disguiseShell && m.userData.revealedBlades) {
        (m.userData.disguiseShell as THREE.Object3D).visible = e.disguised;
        (m.userData.revealedBlades as THREE.Object3D).visible = !e.disguised;
        if (e.disguised) {
          (m.userData.disguiseShell as THREE.Object3D).position.y =
            0.4 + Math.sin(e.animPhase) * 0.05;
        } else {
          (m.userData.revealedBlades as THREE.Object3D).rotation.y += dt * (4.5 + e.attackAnim * 8.0);
          m.rotation.x = -e.attackAnim * 0.14;
        }
      }
      if (m.userData.cipherBody) {
        (m.userData.cipherBody as THREE.Object3D).position.y =
          0.72 + Math.sin(e.animPhase) * 0.08;
      }
      if (m.userData.cipherRings) {
        const rings = m.userData.cipherRings as THREE.Mesh[];
        const yOff = 0.72 + Math.sin(e.animPhase) * 0.08;
        rings[0].position.y = yOff;
        rings[1].position.y = yOff;
        const flare = 1 + e.attackAnim * 0.22;
        rings[0].scale.setScalar(flare);
        rings[1].scale.setScalar(flare);
        rings[0].rotation.x += dt * (3.0 + e.attackAnim * 4.0);
        rings[1].rotation.z -= dt * (2.5 + e.attackAnim * 4.0);
      }
      if (m.userData.rotors) {
        m.rotation.x = 0.15;
        m.rotation.z = Math.sin(e.animPhase * 0.7) * 0.14;
        for (const r of m.userData.rotors as THREE.Mesh[]) {
          r.rotation.y += dt * 24;
        }
      }
      if (m.userData.shenlouUpper) {
        (m.userData.shenlouUpper as THREE.Object3D).position.y =
          1.2 + Math.sin(e.animPhase * 1.4) * 0.12;
      }
      if (m.userData.orbitPlates) {
        const plates = m.userData.orbitPlates as THREE.Object3D;
        const orbitSpd = e.isBoss && e.bossPhase >= 2 ? 4.8 : 2.2;
        if (e.type === 'boss_zheying') {
          const flare = e.bossPhase >= 3 ? 1.24 : e.bossPhase === 2 ? 1.1 : 1.0;
          plates.scale.setScalar(flare + e.attackAnim * 0.15);
          plates.rotation.z = Math.sin(e.animPhase) * 0.08;
        } else {
          plates.rotation.y += dt * orbitSpd;
        }
      }
      if (m.userData.bossCore) {
        const core = m.userData.bossCore as THREE.Object3D;
        const cPulse = 1 + Math.sin(e.animPhase * 2.4) * (e.bossPhase >= 2 ? 0.18 : 0.1) + e.attackAnim * 0.22;
        core.scale.setScalar(cPulse);
      }
      if (m.userData.bossLegs) {
        const gaitAmp = e.isBoss && e.bossPhase >= 2 ? 0.14 : 0.09;
        (m.userData.bossLegs as THREE.Mesh[]).forEach((leg, idx) => {
          leg.position.y = 0.46 + Math.sin(e.animPhase + idx * 1.1) * gaitAmp;
        });
      }
      if (m.userData.zheyingMat) {
        const mat = m.userData.zheyingMat as THREE.MeshStandardMaterial;
        mat.opacity = e.disguised ? 0.35 : 0.96;
        mat.color.setHex(e.bossPhase === 2 ? 0xf59e0b : e.bossPhase === 3 ? 0xf43f5e : 0x0f172a);
      }
      if (m.userData.enemyShield) {
        (m.userData.enemyShield as THREE.Object3D).visible = e.shield > 0;
        (m.userData.enemyShield as THREE.Object3D).rotation.y += dt * 1.6;
      }
      // Subtle hit recoil pitch & attack squeeze
      m.rotation.x -= e.hitFlash * 0.14;
      m.rotation.z += e.hitFlash * Math.sin(this.animClock * 46 + e.id) * 0.08;
      const pulseScale = 1 + e.hitFlash * 0.09 + e.attackAnim * 0.06;
      m.scale.set(pulseScale, 1 - e.hitFlash * 0.05, pulseScale);
      this.applyUnitFlash(m, e.hitFlash, 0, e.snaredTimer > 0);
    }
    for (const [eid, m] of this.enemyMeshes) {
      if (!activeEnemyIds.has(eid)) {
        this.enemyMeshes.delete(eid);
        const nearExit = map.exits.some((ex) => {
          const ew = this.gridToWorld(ex.x, ex.y, map.cols, map.rows);
          const dx = m.position.x - ew.x;
          const dz = m.position.z - ew.z;
          return dx * dx + dz * dz < 1.85;
        });
        this.pushDyingUnit(m, nearExit ? 'enemy_leak' : 'enemy_die', 0.34);
      }
    }

    this.tickDyingUnits(dt);

    // Sync VFX Beams & Expanding Bursts
    this.renderVfx(engine);

    // Render WebGL Scene
    this.renderer.render(this.scene, this.camera);

    // Render crisp 2D projected HUD overlay (HP bars, labels, status icons, block indicators)
    this.renderOverlay(engine, selectedTowerId, selectedEnemyId);
  }

  private pushDyingUnit(
    mesh: THREE.Group,
    kind: 'enemy_die' | 'enemy_leak' | 'tower_break' | 'isolator_fade',
    duration: number
  ): void {
    const list = (this.unitsGroup.userData.dyingUnits ??= []) as Array<{
      mesh: THREE.Group;
      timer: number;
      duration: number;
      kind: 'enemy_die' | 'enemy_leak' | 'tower_break' | 'isolator_fade';
      baseY: number;
    }>;
    list.push({ mesh, timer: 0, duration, kind, baseY: mesh.position.y });
  }

  private tickDyingUnits(dt: number): void {
    const list = this.unitsGroup.userData.dyingUnits as
      | Array<{
          mesh: THREE.Group;
          timer: number;
          duration: number;
          kind: 'enemy_die' | 'enemy_leak' | 'tower_break' | 'isolator_fade';
          baseY: number;
        }>
      | undefined;
    if (!list || list.length === 0) return;

    for (let i = list.length - 1; i >= 0; i--) {
      const item = list[i];
      if (item.mesh.parent !== this.unitsGroup) {
        list.splice(i, 1);
        continue;
      }
      item.timer += dt;
      const p = Math.min(1, item.timer / item.duration);
      const easeOut = 1 - p * p;

      if (item.kind === 'enemy_leak') {
        item.mesh.position.y = item.baseY + p * 2.2;
        item.mesh.rotation.y += dt * 11;
        const xz = Math.max(0.06, 1 - p * 0.9);
        item.mesh.scale.set(xz, 1 + p * 1.4, xz);
        this.applyUnitFlash(item.mesh, Math.max(0.35, 1 - p), 0, false);
      } else if (item.kind === 'enemy_die') {
        item.mesh.position.y = item.baseY - p * 0.22;
        item.mesh.rotation.y += dt * 6;
        item.mesh.rotation.z = p * 0.35;
        const s = Math.max(0.03, easeOut);
        item.mesh.scale.set(s * 1.12, s * 0.55, s * 1.12);
        this.applyUnitFlash(item.mesh, Math.max(0, 1 - p * 1.4), 0, false);
      } else if (item.kind === 'tower_break') {
        item.mesh.position.y = item.baseY - p * 0.18;
        item.mesh.scale.set(Math.max(0.05, easeOut), Math.max(0.04, 1 - p * 0.95), Math.max(0.05, easeOut));
        this.applyUnitFlash(item.mesh, Math.max(0, 0.85 - p), 0, false);
      } else {
        const s = Math.max(0.05, 1 - p * 0.92);
        item.mesh.position.y = item.baseY - p * 0.12;
        item.mesh.scale.set(s, s, s);
      }

      if (item.timer >= item.duration) {
        this.unitsGroup.remove(item.mesh);
        list.splice(i, 1);
      }
    }
  }

  private applyUnitFlash(
    m: THREE.Group,
    hitFlash: number,
    healFlash: number,
    specialTint: boolean
  ): void {
    const mats = m.userData.unitMats as
      | Array<{ mat: THREE.MeshStandardMaterial; baseEmissive: THREE.Color; baseIntensity: number }>
      | undefined;
    if (!mats) return;
    for (const item of mats) {
      if (hitFlash > 0.02) {
        item.mat.emissive.setHex(0xff3344);
        item.mat.emissiveIntensity = item.baseIntensity + hitFlash * 1.8;
      } else if (healFlash > 0.02) {
        item.mat.emissive.setHex(0x10b981);
        item.mat.emissiveIntensity = item.baseIntensity + healFlash * 1.2;
      } else if (specialTint) {
        item.mat.emissive.setHex(0xc026d3);
        item.mat.emissiveIntensity = Math.max(0.85, item.baseIntensity);
      } else {
        item.mat.emissive.copy(item.baseEmissive);
        item.mat.emissiveIntensity = item.baseIntensity;
      }
    }
  }

  private renderVfx(engine: GameEngine): void {
    this.clearGroup(this.vfxGroup);
    const map = engine.map;
    const upVec = new THREE.Vector3(0, 1, 0);

    for (const p of engine.projectiles) {
      const prog = Math.min(1, p.timer / p.duration);
      const a = Math.max(0.15, 1 - prog);
      const v0 = this.gridToWorld(p.fromX, p.fromY, map.cols, map.rows);
      v0.y = p.fromZ;
      const v1 = this.gridToWorld(p.toX, p.toY, map.cols, map.rows);
      v1.y = p.toZ;

      const delta = new THREE.Vector3().subVectors(v1, v0);
      const len = delta.length();
      if (len < 0.01) continue;
      const mid = new THREE.Vector3().addVectors(v0, v1).multiplyScalar(0.5);
      const quat = new THREE.Quaternion().setFromUnitVectors(upVec, delta.clone().normalize());

      // Oriented 3D volumetric core beam
      const coreR = Math.max(0.032, p.width * 0.026 * (0.4 + 0.6 * a));
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(coreR, coreR, len, 6),
        new THREE.MeshBasicMaterial({
          color: p.kind === 'pierce_rail' ? 0xffffff : p.color,
          transparent: true,
          opacity: a,
        })
      );
      beam.position.copy(mid);
      beam.quaternion.copy(quat);
      this.vfxGroup.add(beam);

      // Soft outer plasma sheath
      const sheathR = coreR * (p.kind === 'pierce_rail' || p.kind === 'boss_surge' ? 2.6 : 2.1);
      const sheath = new THREE.Mesh(
        new THREE.CylinderGeometry(sheathR, sheathR, len, 6),
        new THREE.MeshBasicMaterial({
          color: p.color,
          transparent: true,
          opacity: a * 0.34,
          depthWrite: false,
        })
      );
      sheath.position.copy(mid);
      sheath.quaternion.copy(quat);
      this.vfxGroup.add(sheath);

      // Travelling energy tracer orb & impact splash flash
      const tracer = new THREE.Mesh(
        new THREE.SphereGeometry(coreR * 2.4, 8, 8),
        new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: a })
      );
      tracer.position.lerpVectors(v0, v1, Math.min(1, prog * 1.45));
      this.vfxGroup.add(tracer);

      const impact = new THREE.Mesh(
        new THREE.SphereGeometry(coreR * (1.8 + prog * 2.4), 8, 8),
        new THREE.MeshBasicMaterial({
          color: p.color,
          transparent: true,
          opacity: a * 0.52,
          depthWrite: false,
        })
      );
      impact.position.copy(v1);
      this.vfxGroup.add(impact);
    }

    for (const b of engine.bursts) {
      const prog = Math.min(1, b.timer / b.duration);
      const w = this.gridToWorld(b.x, b.y, map.cols, map.rows);
      const rad = b.radius * GAME_CONSTANTS.TILE_SIZE * (0.25 + 0.75 * prog);
      const opacity = (1 - prog) * 0.88;

      const ringY = b.kind === 'intel_ping' ? b.z + prog * 0.8 : b.z;
      // Ground / elevated expanding ring
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(0.05, rad * 0.82), rad, 28),
        new THREE.MeshBasicMaterial({
          color: b.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(w.x, ringY, w.z);
      this.vfxGroup.add(ring);

      if (b.kind === 'intel_ping') {
        const nodeSpark = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.14 * (1 - prog * 0.45)),
          new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity })
        );
        nodeSpark.position.set(w.x, ringY + 0.16, w.z);
        nodeSpark.rotation.y = prog * 5;
        this.vfxGroup.add(nodeSpark);
      }

      // Rising cylindrical shockwave wall for skills & explosions
      if (
        b.kind === 'sandbox_ring' ||
        b.kind === 'snare_cage' ||
        b.kind === 'failover_wave' ||
        b.kind === 'route_storm' ||
        b.kind === 'node_break' ||
        b.kind === 'payload_blast'
      ) {
        const wall = new THREE.Mesh(
          new THREE.CylinderGeometry(rad, rad * 0.94, 0.45 + prog * 0.65, 24, 1, true),
          new THREE.MeshBasicMaterial({
            color: b.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: opacity * 0.32,
            depthWrite: false,
          })
        );
        wall.position.set(w.x, b.z + 0.25, w.z);
        this.vfxGroup.add(wall);
      }

      // Flying crystalline shatter debris shards on death / payload / node breach
      if (
        b.kind === 'death_shard' ||
        b.kind === 'payload_blast' ||
        b.kind === 'node_break' ||
        b.kind === 'teleport_spawn'
      ) {
        const shardMat = new THREE.MeshBasicMaterial({
          color: b.color,
          transparent: true,
          opacity,
        });
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * Math.PI * 2 + b.id * 0.7;
          const dist = rad * 0.85 * prog;
          const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.14 * (1 - prog * 0.5)), shardMat);
          shard.position.set(
            w.x + Math.cos(ang) * dist,
            b.z + 0.2 + Math.sin(prog * Math.PI) * 0.75,
            w.z + Math.sin(ang) * dist
          );
          shard.rotation.set(prog * 5, ang, prog * 3);
          this.vfxGroup.add(shard);
        }
      }
    }

    for (const rm of engine.rejectedMarkers) {
      const w = this.gridToWorld(rm.x, rm.y, map.cols, map.rows);
      const s = 0.8 + 0.25 * Math.sin(this.animClock * 16);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.65 * s, 0.95 * s, 16),
        new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: Math.min(1, rm.timer),
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(w.x, 0.55, w.z);
      this.vfxGroup.add(ring);
    }
  }

  private renderOverlay(
    engine: GameEngine,
    selectedTowerId: number | null,
    selectedEnemyId: number | null
  ): void {
    const ctx = this.overlayCtx;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    if (engine.phase === 'menu') return;

    const map = engine.map;
    const proj = new THREE.Vector3();
    const toScreen = (gx: number, gy: number, gz: number): { sx: number; sy: number } | null => {
      const wp = this.gridToWorld(gx, gy, map.cols, map.rows);
      wp.y = gz;
      proj.copy(wp).project(this.camera);
      if (proj.z > 1) return null;
      return {
        sx: (proj.x * 0.5 + 0.5) * w,
        sy: (-proj.y * 0.5 + 0.5) * h,
      };
    };

    const drawPill = (
      text: string,
      cx: number,
      cy: number,
      fg: string,
      border: string,
      font = '700 11px "HarmonyOS Sans SC", "Microsoft YaHei UI", sans-serif'
    ): void => {
      ctx.font = font;
      ctx.textAlign = 'center';
      const tw = ctx.measureText(text).width + 12;
      ctx.fillStyle = 'rgba(4, 9, 20, 0.88)';
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.roundRect(cx - tw / 2, cy - 12, tw, 17, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = fg;
      ctx.fillText(text, cx, cy + 1);
    };

    // Keep 2D projected world labels inside the central battlefield band so pills/bars never bleed under top/bottom HUD chrome.
    const topBandY = Math.min(h * 0.2, Math.max(54, h * 0.068));
    const botBandY = h - 18;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, topBandY, w, Math.max(0, botBandY - topBandY));
    ctx.clip();

    // Entry & Exit holographic labels (showing current target Exit & hop count!)
    ctx.font = '700 12px "HarmonyOS Sans SC", "Microsoft YaHei UI", sans-serif';
    ctx.textAlign = 'center';
    for (const en of map.entries) {
      const pt = toScreen(en.x, en.y, 1.35);
      if (!pt || pt.sy < topBandY + 14 || pt.sy > botBandY - 14) continue;
      const route = engine.entryRoutes[en.id];
      let destSuffix = '';
      if (route && route.length >= 2) {
        const end = route[route.length - 1];
        const destExit = map.exits.find((ex) => ex.x === end.x && ex.y === end.y);
        if (destExit) {
          destSuffix = ` → ${destExit.id} (${route.length - 1}跳)`;
        }
      }
      ctx.fillStyle = 'rgba(7, 13, 24, 0.88)';
      ctx.strokeStyle = en.color;
      ctx.lineWidth = 1.5;
      const label = `入口 ${en.id} · ${en.name}${destSuffix}`;
      const tw = ctx.measureText(label).width + 14;
      ctx.beginPath();
      ctx.roundRect(pt.sx - tw / 2, pt.sy - 11, tw, 20, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = en.color;
      ctx.fillText(label, pt.sx, pt.sy + 3);
    }

    for (const ex of map.exits) {
      const pt = toScreen(ex.x, ex.y, 2.08);
      if (!pt || pt.sy < topBandY + 14 || pt.sy > botBandY - 14) continue;
      const label =
        ex.id === 'M' || ex.name.includes(ex.id) ? ex.name : `核心 ${ex.id} · ${ex.name}`;
      const tw = ctx.measureText(label).width + 16;
      ctx.fillStyle = 'rgba(6, 30, 26, 0.9)';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(pt.sx - tw / 2, pt.sy - 11, tw, 22, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText(label, pt.sx, pt.sy + 4);
    }

    // Node Cooldown / Isolation tags
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        const t = engine.tiles[y][x];
        if (t.type !== 'node') continue;
        if (t.nodeCooldown > 0) {
          const pt = toScreen(x, y, 0.7);
          if (pt) drawPill(`冷却 ${t.nodeCooldown.toFixed(1)}s`, pt.sx, pt.sy, '#fbbf24', '#d97706');
        }
        if (t.telegraphTimer > 0) {
          const pt = toScreen(x, y, 1.2);
          const tag = t.telegraphType === 'surge' ? '⚠ 洪峰蓄能' : '⚠ 预警';
          if (pt) drawPill(`${tag} ${t.telegraphTimer.toFixed(1)}s`, pt.sx, pt.sy, '#fda4af', '#f43f5e');
        }
      }
    }

    // Telegraph labels on road tiles too!
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        const t = engine.tiles[y][x];
        if (t.telegraphTimer > 0 && t.type !== 'node') {
          const pt = toScreen(x, y, 1.0);
          if (!pt) continue;
          const tag = t.telegraphType === 'blackhole' ? '⚠ 伪路由黑洞' : '⚠ 运维环锁定';
          drawPill(`${tag} ${t.telegraphTimer.toFixed(1)}s`, pt.sx, pt.sy, '#fda4af', '#f43f5e');
        }
      }
    }

    // Isolator HP & Duration bars
    for (const iso of engine.isolators) {
      const pt = toScreen(iso.x, iso.y, 1.45);
      if (!pt) continue;
      this.drawBar(ctx, pt.sx, pt.sy, 46, 5, iso.hp / iso.maxHp, '#fbbf24', 0);
      drawPill(`隔离器 ${iso.timer.toFixed(0)}s`, pt.sx, pt.sy - 6, '#fde68a', '#f59e0b');
    }

    // Tower HP / Shield / Encrypt / Selected Ring
    for (const tw of engine.towers) {
      const tile = engine.getTile(tw.x, tw.y);
      const baseZ =
        tile?.type === 'platform'
          ? GAME_CONSTANTS.PLATFORM_HEIGHT
          : tile?.type === 'node'
          ? GAME_CONSTANTS.NODE_HEIGHT
          : 0;
      const pt = toScreen(tw.x, tw.y, baseZ + 1.35);
      if (!pt) continue;

      const isSel = tw.id === selectedTowerId;
      if (isSel || tw.hp < tw.maxHp || tw.shield > 0 || tw.encryptedTimer > 0) {
        this.drawBar(
          ctx,
          pt.sx,
          pt.sy,
          44,
          5,
          tw.hp / tw.maxHp,
          tw.type === 'gate' ? '#10b981' : '#38bdf8',
          tw.shield / tw.maxHp
        );
      }

      if (tw.encryptedTimer > 0) {
        drawPill(`🔒 已加密 ${tw.encryptedTimer.toFixed(1)}s`, pt.sx, pt.sy - 7, '#f0abfc', '#c026d3');
      } else if (isSel) {
        drawPill(`${TOWER_CONFIGS[tw.type].name} Lv.${tw.level}`, pt.sx, pt.sy - 7, '#bae6fd', '#0284c7');
      }

      // Draw subtle dashed link lines to Repair heal targets!
      if (tw.type === 'repair' && (tw.targetId !== null || tw.secondaryTargetId !== null)) {
        const sPt = toScreen(tw.x, tw.y, baseZ + 0.9);
        if (sPt) {
          ctx.save();
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 1.6;
          for (const tid of [tw.targetId, tw.secondaryTargetId]) {
            if (tid === null) continue;
            const ally = engine.getTowerById(tid);
            if (!ally) continue;
            const aPt = toScreen(ally.x, ally.y, 0.65);
            if (!aPt) continue;
            ctx.beginPath();
            ctx.moveTo(sPt.sx, sPt.sy);
            ctx.lineTo(aPt.sx, aPt.sy);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Draw subtle dashed link lines to blocked enemies!
      if (tw.blockedEnemyIds.length > 0) {
        const tPt = toScreen(tw.x, tw.y, baseZ + 0.45);
        if (tPt) {
          ctx.save();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 1.5;
          for (const eid of tw.blockedEnemyIds) {
            const en = engine.enemies.find((e) => e.id === eid);
            if (!en) continue;
            const ePt = toScreen(en.x, en.y, 0.45);
            if (!ePt) continue;
            ctx.beginPath();
            ctx.moveTo(tPt.sx, tPt.sy);
            ctx.lineTo(ePt.sx, ePt.sy);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    // Enemy HP / Shield / Boss Nameplates
    for (const e of engine.enemies) {
      const z = e.isFlying ? GAME_CONSTANTS.FLY_HEIGHT + 0.55 : e.isBoss ? 1.85 : 0.95;
      const pt = toScreen(e.x, e.y, z);
      if (!pt) continue;

      const isSel = e.id === selectedEnemyId;
      if (e.isBoss || isSel || e.hp < e.maxHp || e.shield > 0 || e.snaredTimer > 0) {
        const bw = e.isBoss ? 78 : 34;
        const bh = e.isBoss ? 7 : 4;
        this.drawBar(
          ctx,
          pt.sx,
          pt.sy,
          bw,
          bh,
          e.hp / e.maxHp,
          e.isBoss ? '#f43f5e' : '#fb7185',
          e.shield / e.maxHp
        );
      }

      if (e.isBoss) {
        const cfg = ENEMY_CONFIGS[e.type];
        const phaseTxt =
          e.type === 'boss_zheying'
            ? e.bossPhase === 1
              ? '潜伏'
              : e.bossPhase === 2
              ? '提权'
              : '破坏'
            : `P${e.bossPhase}`;
        drawPill(`★ ${cfg.name} [${phaseTxt}]`, pt.sx, pt.sy - 8, '#fda4af', '#e11d48', '700 12px "HarmonyOS Sans SC", sans-serif');
      } else if (e.snaredTimer > 0) {
        drawPill('诱捕定身', pt.sx, pt.sy - 6, '#fbcfe8', '#db2777', '700 10px "HarmonyOS Sans SC", sans-serif');
      } else if (e.vulnerableTimer > 0) {
        drawPill('易伤', pt.sx, pt.sy - 6, '#fde68a', '#d97706', '700 10px "HarmonyOS Sans SC", sans-serif');
      } else if (e.type === 'trojan' && e.detected) {
        drawPill('木马[显形]', pt.sx, pt.sy - 6, '#fda4af', '#be123c', '600 10px "HarmonyOS Sans SC", sans-serif');
      }

      // Draw Flood Pack node-breaker target link or active Ransomware/attack lock line
      if (e.type === 'flood' && e.targetNodeKey) {
        const [nx, ny] = e.targetNodeKey.split(',').map(Number);
        const ePt = toScreen(e.x, e.y, 0.45);
        const nPt = toScreen(nx, ny, 0.35);
        if (ePt && nPt) {
          ctx.save();
          ctx.strokeStyle = 'rgba(249, 115, 22, 0.72)';
          ctx.setLineDash([5, 3]);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(ePt.sx, ePt.sy);
          ctx.lineTo(nPt.sx, nPt.sy);
          ctx.stroke();
          ctx.restore();
        }
      } else if (e.lastTargetTowerId !== null && e.attackAnim > 0.1) {
        const tgt = engine.getTowerById(e.lastTargetTowerId);
        if (tgt) {
          const ePt = toScreen(e.x, e.y, 0.5);
          const tPt = toScreen(tgt.x, tgt.y, 0.65);
          if (ePt && tPt) {
            ctx.save();
            ctx.strokeStyle =
              e.type === 'ransomware' ? 'rgba(192, 132, 252, 0.8)' : 'rgba(244, 63, 94, 0.75)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(ePt.sx, ePt.sy);
            ctx.lineTo(tPt.sx, tPt.sy);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }
    ctx.restore();
  }

  private drawBar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    hpRatio: number,
    color: string,
    shieldRatio: number
  ): void {
    const x = cx - w / 2;
    const y = cy;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);

    const clamped = Math.max(0, Math.min(1, hpRatio));
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * clamped, h);

    if (shieldRatio > 0) {
      const sw = w * Math.min(1, shieldRatio);
      ctx.fillStyle = '#5eead4';
      ctx.fillRect(x, y - 2, sw, 2);
    }
  }

  private clearGroup(g: THREE.Group): void {
    while (g.children.length > 0) {
      const ch = g.children[0];
      g.remove(ch);
    }
  }
}
