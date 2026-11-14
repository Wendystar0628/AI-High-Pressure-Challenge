import * as THREE from 'three';
import { audio } from './audio';
import type { GameEngine } from './engine';
import type { HoverIntent, SceneManager } from './scene';
import type { Direction, ItemId, MapId, TowerEntity, TowerType } from './types';

export type DemoId = 'demo-1' | 'demo-2' | 'demo-3';

export interface DemoUIHooks {
  onSelectTower: (tower: TowerEntity | null) => void;
  onRefreshHud: () => void;
  onSetSubtitle: (title: string, text: string) => void;
  onSetCursor: (state: {
    visible: boolean;
    x: number;
    y: number;
    clicking: boolean;
    badge?: string;
  }) => void;
  getElementCenter: (selector: string) => { x: number; y: number } | null;
  onDemoStarted?: () => void;
  onDemoEnded?: () => void;
}

interface DemoConfig {
  id: DemoId;
  title: string;
  mapId: MapId;
  duration: number;
  setup: (engine: GameEngine) => void;
  updateTimeline: (
    engine: GameEngine,
    scene: SceneManager,
    hooks: DemoUIHooks,
    t: number,
    state: DemoRuntimeState
  ) => void;
}

interface DemoRuntimeState {
  firedEvents: Set<string>;
  selectedTowerId: number | null;
  lastHover: HoverIntent | null;
}

function easeInOutCubic(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpVec3(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  return new THREE.Vector3().lerpVectors(a, b, easeInOutCubic(t));
}

function projectGridToScreen(
  scene: SceneManager,
  engine: GameEngine,
  gx: number,
  gy: number,
  gz = 0.25
): { x: number; y: number } {
  const wp = scene.gridToWorld(gx, gy, engine.map.cols, engine.map.rows);
  wp.y = gz;
  wp.project(scene.camera);
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: (wp.x * 0.5 + 0.5) * w,
    y: (-wp.y * 0.5 + 0.5) * h,
  };
}

function smoothCursorBetween(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const e = easeInOutCubic(t);
  return {
    x: p0.x + (p1.x - p0.x) * e,
    y: p0.y + (p1.y - p0.y) * e,
  };
}

function buildHoverTower(
  engine: GameEngine,
  type: TowerType,
  x: number,
  y: number,
  direction?: Direction
): HoverIntent {
  const res = engine.previewTowerPlacement(type, x, y);
  return {
    kind: 'tower',
    towerType: type,
    x,
    y,
    direction,
    valid: res.ok,
    routePreview: res.routePreview,
  };
}

function buildHoverItem(
  engine: GameEngine,
  itemId: ItemId,
  x: number,
  y: number
): HoverIntent {
  const res = engine.previewItemPlacement(itemId, x, y);
  return {
    kind: 'item',
    itemId,
    x,
    y,
    valid: res.ok,
    affectedTiles: res.affectedTiles,
    routePreview: res.routePreview,
  };
}

export const DEMO_CONFIGS: Record<DemoId, DemoConfig> = {
  'demo-1': {
    id: 'demo-1',
    title: '实战演示 I · 分段取舍',
    mapId: 'intranet',
    duration: 17.0,
    setup(engine) {
      engine.startMap('intranet', true);
      engine.compute = 450;
      engine.intel = 60;
      engine.currentWaveIndex = 6;
      engine.waveInProgress = true;

      // West Office line: battered Lv2 Firewall + Sandbox holding front cleanly without dying or leaking
      const westFw = engine.deployTower('firewall', 4, 5);
      if (westFw) {
        engine.upgradeTower(westFw.id);
        westFw.hp = 680;
      }
      engine.deployTower('sandbox', 3, 5);

      // East Business killzone: Interceptor (Pierce), Pulse, Sandbox, Lv2 Firewall & Repair
      const eastInt = engine.deployTower('interceptor', 9, 2, 0);
      if (eastInt) {
        engine.upgradeTower(eastInt.id, 'interceptor_pierce');
      }
      const eastPulse = engine.deployTower('interceptor', 11, 2, 0);
      if (eastPulse) {
        engine.upgradeTower(eastPulse.id, 'interceptor_suppress');
      }
      engine.deployTower('sandbox', 9, 5);
      const eastFw = engine.deployTower('firewall', 10, 5);
      if (eastFw) {
        engine.upgradeTower(eastFw.id);
        eastFw.hp = 780;
      }
      engine.deployTower('repair', 11, 5);

      // Restore balanced resources for UI authenticity
      engine.compute = 125;
      engine.intel = 28;
      engine.alerts = [];

      // Frontline Office pressure: Lv2 Firewall blocking heavy breachers + stealth trojan south of N1(4,3)
      const westFlood = engine.spawnEnemy('flood', 'A', { x: 4, y: 4 });
      westFlood.y = 4.05;
      const w1 = engine.spawnEnemy('worm', 'A', { x: 4, y: 4 });
      w1.y = 4.65;
      const w2 = engine.spawnEnemy('trojan', 'A', { x: 4, y: 4 });
      w2.y = 4.32;

      engine.pendingSpawns = [
        // Batch reaching (4,2) inside West Office around t=5.9~6.15s -> visibly U-turn back through DMZ at t=6.2s!
        { time: 0.4, enemy: 'worm', entryId: 'A' },
        { time: 1.5, enemy: 'trojan', entryId: 'A' },
        { time: 5.15, enemy: 'trojan', entryId: 'A' },
        { time: 5.4, enemy: 'worm', entryId: 'A' },
        { time: 5.65, enemy: 'worm', entryId: 'A' },
        // Post-Gate stream continuing through DMZ merge
        { time: 7.0, enemy: 'trojan', entryId: 'A' },
        { time: 8.1, enemy: 'flood', entryId: 'A' },
        { time: 9.4, enemy: 'worm', entryId: 'A' },

        { time: 0.9, enemy: 'worm', entryId: 'B' },
        { time: 2.0, enemy: 'packer', entryId: 'B' },
        { time: 2.9, enemy: 'trojan', entryId: 'B' },
        { time: 4.1, enemy: 'flood', entryId: 'B' },
        { time: 6.2, enemy: 'worm', entryId: 'B' },
        { time: 8.0, enemy: 'trojan', entryId: 'B' },
      ];
    },
    updateTimeline(engine, scene, hooks, t, state) {
      // Camera choreography: overview -> zoom NW DMZ/West Boundary -> follow DMZ merge East
      const camOverviewPos = new THREE.Vector3(0, 22.0, 19.8);
      const camOverviewLook = new THREE.Vector3(0, 0.25, 1.4);
      const camWestPos = new THREE.Vector3(-4.0, 15.0, 9.6);
      const camWestLook = new THREE.Vector3(-2.6, 0.2, -3.0);
      const camEastPos = new THREE.Vector3(4.8, 15.4, 11.4);
      const camEastLook = new THREE.Vector3(4.2, 0.3, -0.4);

      if (t < 2.2) {
        scene.setDemoCamera(camOverviewPos, camOverviewLook);
      } else if (t < 4.2) {
        const k = (t - 2.2) / 2.0;
        scene.setDemoCamera(
          lerpVec3(camOverviewPos, camWestPos, k),
          lerpVec3(camOverviewLook, camWestLook, k)
        );
      } else if (t < 7.8) {
        scene.setDemoCamera(camWestPos, camWestLook);
      } else if (t < 11.2) {
        const k = (t - 7.8) / 3.4;
        scene.setDemoCamera(
          lerpVec3(camWestPos, camEastPos, k),
          lerpVec3(camWestLook, camEastLook, k)
        );
      } else {
        scene.setDemoCamera(camEastPos, camEastLook);
      }

      // Subtitles
      if (t < 2.8) {
        hooks.onSetSubtitle(
          '分段取舍 · 分段内网',
          '办公网段防线承压，蠕虫与木马正源源不断涌向西边界节点。'
        );
      } else if (t < 6.2) {
        hooks.onSetSubtitle(
          '预览改道路线',
          '拖拽「网闸」至西边界节点，预览显示入口 A 将改走 DMZ 互联与 B 汇流。'
        );
      } else if (t < 11.5) {
        hooks.onSetSubtitle(
          '节点隔离 · 办公网段掉头',
          '确认隔离！原本进入办公网段的敌军立即掉头，经 DMZ 互联并入东线火力网。'
        );
      } else {
        hooks.onSetSubtitle(
          '多防线协同交锋',
          '沙箱显形木马并协同穿甲光矛压制合流队列，东线防火墙承受正面冲击。'
        );
      }

      // Cursor & interaction timeline
      const cardPt = hooks.getElementCenter('[data-card-tower="gate"]') ?? {
        x: window.innerWidth * 0.35,
        y: window.innerHeight - 60,
      };
      const nodePt = projectGridToScreen(scene, engine, 4, 3, 0.2);

      if (t < 2.4) {
        hooks.onSetCursor({ visible: false, x: cardPt.x, y: cardPt.y, clicking: false });
        state.lastHover = null;
      } else if (t < 3.4) {
        const startPt = { x: window.innerWidth * 0.55, y: window.innerHeight * 0.5 };
        const p = smoothCursorBetween(startPt, cardPt, (t - 2.4) / 1.0);
        hooks.onSetCursor({ visible: true, x: p.x, y: p.y, clicking: false });
      } else if (t < 4.5) {
        const p = smoothCursorBetween(cardPt, nodePt, (t - 3.4) / 1.1);
        hooks.onSetCursor({ visible: true, x: p.x, y: p.y, clicking: true, badge: '网闸' });
        if (t > 4.2) {
          state.lastHover = buildHoverTower(engine, 'gate', 4, 3);
        }
      } else if (t < 6.2) {
        // Hold over N1(4,3) so user clearly sees dashed gold DMZ preview route!
        hooks.onSetCursor({ visible: true, x: nodePt.x, y: nodePt.y, clicking: true, badge: '网闸 · 预览改道' });
        state.lastHover = buildHoverTower(engine, 'gate', 4, 3);
      } else if (!state.firedEvents.has('place_gate')) {
        state.firedEvents.add('place_gate');
        engine.deployTower('gate', 4, 3);
        state.lastHover = null;
        hooks.onSetCursor({ visible: true, x: nodePt.x, y: nodePt.y, clicking: false });
      } else if (t < 7.8) {
        hooks.onSetCursor({ visible: true, x: nodePt.x, y: nodePt.y, clicking: false });
        state.lastHover = null;
      } else {
        hooks.onSetCursor({ visible: false, x: nodePt.x, y: nodePt.y, clicking: false });
      }

      scene.updateHoverPreview(engine, state.lastHover, null);
    },
  },

  'demo-2': {
    id: 'demo-2',
    title: '实战演示 II · 旁路直通',
    mapId: 'backbone',
    duration: 19.0,
    setup(engine) {
      engine.startMap('backbone', true);
      engine.compute = 900;
      engine.intel = 120;
      engine.currentWaveIndex = 7;
      engine.waveInProgress = true;

      // Damaged Gate on Convergence Node (7,5) lasting ~4.3-4.7s under Flood Pack battering!
      const hubGate = engine.deployTower('gate', 7, 5);
      if (hubGate) hubGate.hp = 470;

      // East Y defense (holding South Backbone + East Tunnel + air cover)
      const yFw = engine.deployTower('firewall', 11, 8);
      if (yFw) engine.upgradeTower(yFw.id);
      const yInt = engine.deployTower('interceptor', 10, 8, 2); // facing North along east tunnel
      if (yInt) engine.upgradeTower(yInt.id, 'interceptor_suppress');
      engine.deployTower('sandbox', 12, 6);

      // West X perimeter (Lv2 Firewalls holding X, Pierce along A, Pulse & Lv2 Repair stabilizing bypass)
      const aFw = engine.deployTower('firewall', 2, 8);
      if (aFw) engine.upgradeTower(aFw.id);
      const xFw = engine.deployTower('firewall', 5, 8);
      if (xFw) {
        engine.upgradeTower(xFw.id);
      }
      const xHp = engine.deployTower('honeypot', 5, 7); // Soaks ransomware cipher + splits post-breach flood wave ahead of xFw
      if (xHp) engine.upgradeTower(xHp.id, 'honeypot_snare');
      const xInt = engine.deployTower('interceptor', 3, 8, 2);
      if (xInt) engine.upgradeTower(xInt.id, 'interceptor_pierce');
      const midSupp = engine.deployTower('interceptor', 6, 8, 2); // Direct north cover over C+B bypass & south hub!
      if (midSupp) engine.upgradeTower(midSupp.id, 'interceptor_suppress');
      const xRep = engine.deployTower('repair', 6, 6);
      if (xRep) engine.upgradeTower(xRep.id);
      const xSb = engine.deployTower('sandbox', 3, 6);
      if (xSb) engine.upgradeTower(xSb.id);

      engine.compute = 145;
      engine.intel = 28;
      engine.alerts = [];

      // Flood Packs right on Legacy Line hitting Gate at (7,5) cleanly around t=4.2..4.7s!
      const f1 = engine.spawnEnemy('flood', 'C', { x: 7, y: 3 });
      f1.y = 3.55;
      const f2 = engine.spawnEnemy('flood', 'C', { x: 7, y: 3 });
      f2.y = 2.95;

      // Balanced Three-entry Surge stream: hub falls (~4.5s) + early pressure (-2~3 max), stabilized cleanly after Downgrade!
      engine.pendingSpawns = [
        { time: 0.4, enemy: 'worm', entryId: 'A', isSurge: true },
        { time: 1.8, enemy: 'hotspot', entryId: 'A', isSurge: true },
        { time: 3.6, enemy: 'trojan', entryId: 'A', isSurge: true },
        { time: 6.0, enemy: 'worm', entryId: 'A', isSurge: true },
        { time: 8.2, enemy: 'trojan', entryId: 'A', isSurge: true },

        { time: 1.2, enemy: 'worm', entryId: 'C', isSurge: true },
        { time: 3.0, enemy: 'packer', entryId: 'C', isSurge: true },
        { time: 5.8, enemy: 'ransomware', entryId: 'C', isSurge: true },

        { time: 1.0, enemy: 'worm', entryId: 'B', isSurge: true },
        { time: 2.8, enemy: 'trojan', entryId: 'B', isSurge: true },
        { time: 4.8, enemy: 'hotspot', entryId: 'B', isSurge: true },
      ];
    },
    updateTimeline(engine, scene, hooks, t, state) {
      const camOverviewPos = new THREE.Vector3(0, 22.0, 19.8);
      const camOverviewLook = new THREE.Vector3(0, 0.25, 1.4);
      const camHubPos = new THREE.Vector3(1.5, 13.8, 10.2);
      const camHubLook = new THREE.Vector3(0.2, 0.2, 0.2);
      const camWestPos = new THREE.Vector3(-5.8, 14.0, 11.4);
      const camWestLook = new THREE.Vector3(-5.8, 0.2, 1.8);

      if (t < 2.2) {
        scene.setDemoCamera(camOverviewPos, camOverviewLook);
      } else if (t < 4.2) {
        const k = (t - 2.2) / 2.0;
        scene.setDemoCamera(
          lerpVec3(camOverviewPos, camHubPos, k),
          lerpVec3(camOverviewLook, camHubLook, k)
        );
      } else if (t < 7.2) {
        scene.setDemoCamera(camHubPos, camHubLook);
      } else if (t < 10.0) {
        const k = (t - 7.2) / 2.8;
        scene.setDemoCamera(
          lerpVec3(camHubPos, camWestPos, k),
          lerpVec3(camHubLook, camWestLook, k)
        );
      } else {
        scene.setDemoCamera(camWestPos, camWestLook);
      }

      if (t < 4.6) {
        hooks.onSetSubtitle(
          '旁路直通 · 骨干流域洪峰',
          '三路洪峰并发推进，洪泛团正在猛烈撞击汇聚节点上的受损网闸。'
        );
      } else if (t < 8.2) {
        hooks.onSetSubtitle(
          '网闸被冲垮 · 节点旁路直通',
          '汇聚节点失守！C、B 两路流量瞬间改道回流至数据中心 X，西翼面临双线合围！'
        );
      } else if (t < 10.6) {
        hooks.onSetSubtitle(
          '应急指令 · 协议降级',
          '将「协议降级」拖放至西线入口通道，预览降级范围并压制入口 A 的突击集群。'
        );
      } else {
        hooks.onSetSubtitle(
          '降速显形 · 稳固西翼防线',
          '协议降级令伪装木马显形且敌军减速，拦截器点杀空地目标，防火墙死守核心 X 门户。'
        );
      }

      // Guarantee dramatic breach of hub gate at t = 4.9 if Flood Packs haven't already finished it
      if (t >= 4.9 && !state.firedEvents.has('breach_gate')) {
        state.firedEvents.add('breach_gate');
        const gate = engine.getTowerAt(7, 5);
        if (gate) {
          engine.breachTower(gate.id);
        }
      }

      // Cursor deploys Protocol Downgrade onto West Tunnel (2,4)
      const itemPt = hooks.getElementCenter('[data-card-item="downgrade"]') ?? {
        x: window.innerWidth * 0.65,
        y: window.innerHeight - 60,
      };
      const targetPt = projectGridToScreen(scene, engine, 2, 4, 0.2);

      if (t < 6.8) {
        hooks.onSetCursor({ visible: false, x: itemPt.x, y: itemPt.y, clicking: false });
        state.lastHover = null;
      } else if (t < 7.9) {
        const startPt = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.45 };
        const p = smoothCursorBetween(startPt, itemPt, (t - 6.8) / 1.1);
        hooks.onSetCursor({ visible: true, x: p.x, y: p.y, clicking: false });
      } else if (t < 9.0) {
        const p = smoothCursorBetween(itemPt, targetPt, (t - 7.9) / 1.1);
        hooks.onSetCursor({ visible: true, x: p.x, y: p.y, clicking: true, badge: '协议降级' });
        if (t > 8.6) {
          state.lastHover = buildHoverItem(engine, 'downgrade', 2, 4);
        }
      } else if (t < 10.6) {
        hooks.onSetCursor({ visible: true, x: targetPt.x, y: targetPt.y, clicking: true, badge: '协议降级 · 预览影响' });
        state.lastHover = buildHoverItem(engine, 'downgrade', 2, 4);
      } else if (!state.firedEvents.has('cast_downgrade')) {
        state.firedEvents.add('cast_downgrade');
        engine.useItem('downgrade', 2, 4);
        state.lastHover = null;
        hooks.onSetCursor({ visible: true, x: targetPt.x, y: targetPt.y, clicking: false });
      } else if (t < 11.8) {
        hooks.onSetCursor({ visible: true, x: targetPt.x, y: targetPt.y, clicking: false });
        state.lastHover = null;
      } else {
        hooks.onSetCursor({ visible: false, x: targetPt.x, y: targetPt.y, clicking: false });
      }

      scene.updateHoverPreview(engine, state.lastHover, null);
    },
  },

  'demo-3': {
    id: 'demo-3',
    title: '实战演示 III · 蛰影现身',
    mapId: 'airgap',
    duration: 20.0,
    setup(engine) {
      engine.startMap('airgap', true);
      engine.compute = 1200;
      engine.intel = 160;
      engine.currentWaveIndex = 16;
      engine.waveInProgress = true;

      // West Core X stronghold
      const fwXFront = engine.deployTower('firewall', 3, 7);
      if (fwXFront) {
        engine.upgradeTower(fwXFront.id);
        fwXFront.hp = 680;
      }
      const hpX = engine.deployTower('honeypot', 3, 8);
      if (hpX) engine.upgradeTower(hpX.id, 'honeypot_snare');
      const fwXGuard = engine.deployTower('firewall', 3, 9);
      if (fwXGuard) {
        engine.upgradeTower(fwXGuard.id);
      }
      const intX = engine.deployTower('interceptor', 4, 7, 2); // facing North
      if (intX) {
        engine.upgradeTower(intX.id, 'interceptor_pierce');
      }
      const intCross = engine.deployTower('interceptor', 4, 5, 0); // facing South crossfire
      if (intCross) {
        engine.upgradeTower(intCross.id, 'interceptor_pierce');
      }
      const intWest = engine.deployTower('interceptor', 2, 9, 2); // Pulse air+ground guard
      if (intWest) {
        engine.upgradeTower(intWest.id, 'interceptor_suppress');
      }
      const sbX = engine.deployTower('sandbox', 2, 6);
      if (sbX) engine.upgradeTower(sbX.id);
      const repX = engine.deployTower('repair', 4, 9);
      if (repX) repX.skillCooldown = 0; // Redundant Failover ready!

      // East corridor strong flank (dual Lv2 Firewalls + Lv2 Sandbox + dual interceptors holds B & C)
      const eastFw2 = engine.deployTower('firewall', 10, 7);
      if (eastFw2) engine.upgradeTower(eastFw2.id);
      const eastFw = engine.deployTower('firewall', 10, 8);
      if (eastFw) engine.upgradeTower(eastFw.id);
      const eastSb = engine.deployTower('sandbox', 9, 7);
      if (eastSb) engine.upgradeTower(eastSb.id);
      const eastInt = engine.deployTower('interceptor', 9, 5, 1); // South/East cover over (10,5..8)
      if (eastInt) engine.upgradeTower(eastInt.id, 'interceptor_suppress');
      const eastInt2 = engine.deployTower('interceptor', 11, 9, 2);
      if (eastInt2) engine.upgradeTower(eastInt2.id, 'interceptor_pierce');

      engine.compute = 160;
      engine.intel = 24;
      engine.alerts = [];

      // Boss Zheying entering West Ops Ring at (3,2) in Escalate phase (~54% HP) -> naturally hits Sabotage (<35%) around t=4.5s!
      const boss = engine.spawnEnemy('boss_zheying', 'A', { x: 3, y: 2 });
      boss.hp = Math.round(boss.maxHp * 0.54);
      boss.bossPhase = 2;
      boss.disguised = false;
      boss.detected = true;
      boss.armor = 28;

      // Escort Ransomware + Packer + trailing Waves
      const r1 = engine.spawnEnemy('ransomware', 'A', { x: 3, y: 4 });
      r1.y = 4.3;
      const r2 = engine.spawnEnemy('ransomware', 'A', { x: 4, y: 2 });
      r2.x = 4.2;
      engine.spawnEnemy('packer', 'A', { x: 3, y: 3 });

      engine.pendingSpawns = [
        { time: 1.5, enemy: 'worm', entryId: 'A' },
        { time: 6.8, enemy: 'trojan', entryId: 'A' },
        { time: 8.5, enemy: 'hotspot', entryId: 'A' },
        { time: 2.2, enemy: 'worm', entryId: 'B' },
        { time: 4.8, enemy: 'trojan', entryId: 'C' },
      ];
    },
    updateTimeline(engine, scene, hooks, t, state) {
      const camOverviewPos = new THREE.Vector3(0, 22.0, 19.8);
      const camOverviewLook = new THREE.Vector3(0, 0.25, 1.4);
      const camWestPos = new THREE.Vector3(-4.0, 14.8, 11.4);
      const camWestLook = new THREE.Vector3(-4.2, 0.4, 2.6);
      const camCorePos = new THREE.Vector3(-4.0, 14.8, 12.2);
      const camCoreLook = new THREE.Vector3(-4.2, 0.4, 3.2);

      if (t < 2.2) {
        scene.setDemoCamera(camOverviewPos, camOverviewLook);
      } else if (t < 4.4) {
        const k = (t - 2.2) / 2.2;
        scene.setDemoCamera(
          lerpVec3(camOverviewPos, camWestPos, k),
          lerpVec3(camOverviewLook, camWestLook, k)
        );
      } else if (t < 10.5) {
        scene.setDemoCamera(camWestPos, camWestLook);
      } else if (t < 14.0) {
        const k = (t - 10.5) / 3.5;
        scene.setDemoCamera(
          lerpVec3(camWestPos, camCorePos, k),
          lerpVec3(camWestLook, camCoreLook, k)
        );
      } else {
        scene.setDemoCamera(camCorePos, camCoreLook);
      }

      if (t < 5.0) {
        hooks.onSetSubtitle(
          '蛰影现身 · 气隙深层第 16 波',
          '“蛰影”率勒索者强攻西走廊，核心前的防火墙与拦截器遭到远程加密冻结！'
        );
      } else if (t < 9.5) {
        hooks.onSetSubtitle(
          '破坏阶段 · 运维环锁死',
          '蛰影锁死前方一段运维环，后续敌军被迫绕行老工控总线；防线核心正遭加密压制！'
        );
      } else if (t < 12.6) {
        hooks.onSetSubtitle(
          '反制操作 · 冗余切换',
          '选中修复进程并启动「冗余切换」，瞬间赋予护盾并清除加密锁定！'
        );
      } else {
        hooks.onSetSubtitle(
          '防线重启 · 全力迎战蛰影',
          '护盾展开与加密解除后，穿甲光矛与沙箱全速倾泻火力拦截蛰影！'
        );
      }

      // Ensure Ransomware visibly encrypts front Firewall & Interceptor around t=3.2
      if (t >= 3.2 && !state.firedEvents.has('encrypt_pressure')) {
        state.firedEvents.add('encrypt_pressure');
        const fw = engine.getTowerAt(3, 7);
        const inter = engine.getTowerAt(4, 7);
        if (fw && fw.encryptedTimer <= 0) fw.encryptedTimer = 9.0;
        if (inter && inter.encryptedTimer <= 0) inter.encryptedTimer = 9.0;
      }

      // Fallback: ensure Sabotage lockdown telegraph occurs by t=5.4 if Zheying hasn't already transitioned naturally
      if (t >= 5.4 && !state.firedEvents.has('zheying_sabotage')) {
        state.firedEvents.add('zheying_sabotage');
        const boss = engine.enemies.find((e) => e.type === 'boss_zheying');
        const alreadyLocked =
          engine.tiles.some((row) =>
            row.some((tile) => tile.lockdownTimer > 0 || tile.telegraphType === 'lockdown')
          );
        if (boss && !alreadyLocked) {
          boss.bossPhase = 3;
          boss.hp = Math.min(boss.hp, Math.round(boss.maxHp * 0.34));
          boss.armor = 34;
          const tile = engine.getTile(3, 4);
          if (tile && tile.telegraphType === 'none' && tile.lockdownTimer <= 0) {
            tile.telegraphType = 'lockdown';
            tile.telegraphTimer = 2.0;
            audio.play('boss_phase');
          }
        }
      }

      // Cursor selects Repair Daemon (4,9), then clicks Redundant Failover skill button
      const repairPt = projectGridToScreen(scene, engine, 4, 9, 0.9);
      const repairTower = engine.getTowerAt(4, 9);

      if (t < 8.6) {
        hooks.onSetCursor({ visible: false, x: repairPt.x, y: repairPt.y, clicking: false });
      } else if (t < 9.9) {
        const startPt = { x: window.innerWidth * 0.55, y: window.innerHeight * 0.45 };
        const p = smoothCursorBetween(startPt, repairPt, (t - 8.6) / 1.3);
        hooks.onSetCursor({ visible: true, x: p.x, y: p.y, clicking: false });
      } else if (t < 10.6) {
        if (!state.firedEvents.has('select_repair')) {
          state.firedEvents.add('select_repair');
          if (repairTower) {
            state.selectedTowerId = repairTower.id;
            hooks.onSelectTower(repairTower);
          }
        }
        hooks.onSetCursor({ visible: true, x: repairPt.x, y: repairPt.y, clicking: t < 10.2 });
      } else if (t < 11.9) {
        const btnPt = hooks.getElementCenter('#btn-tower-skill') ?? {
          x: window.innerWidth - 150,
          y: window.innerHeight * 0.55,
        };
        const p = smoothCursorBetween(repairPt, btnPt, (t - 10.6) / 1.1);
        hooks.onSetCursor({ visible: true, x: p.x, y: p.y, clicking: t > 11.65 });
      } else if (!state.firedEvents.has('cast_failover')) {
        state.firedEvents.add('cast_failover');
        if (repairTower) {
          engine.triggerTowerSkill(repairTower.id);
          hooks.onSelectTower(repairTower);
        }
        const btnPt = hooks.getElementCenter('#btn-tower-skill') ?? {
          x: window.innerWidth - 150,
          y: window.innerHeight * 0.55,
        };
        hooks.onSetCursor({ visible: true, x: btnPt.x, y: btnPt.y, clicking: false });
      } else if (t < 13.0) {
        const btnPt = hooks.getElementCenter('#btn-tower-skill') ?? {
          x: window.innerWidth - 150,
          y: window.innerHeight * 0.55,
        };
        hooks.onSetCursor({ visible: true, x: btnPt.x, y: btnPt.y, clicking: false });
      } else {
        hooks.onSetCursor({ visible: false, x: 0, y: 0, clicking: false });
      }

      const selT = state.selectedTowerId ? engine.getTowerById(state.selectedTowerId) : null;
      scene.updateHoverPreview(engine, null, selT);
    },
  },
};

export class DemoController {
  private engine: GameEngine;
  private scene: SceneManager;
  private hooks: DemoUIHooks;

  public activeDemoId: DemoId | null = null;
  public playAllQueue: DemoId[] = [];
  public demoTime = 0;
  public isExportMode = false;
  private exportFps = 30;
  private simAccum = 0;
  private runtimeState: DemoRuntimeState = {
    firedEvents: new Set(),
    selectedTowerId: null,
    lastHover: null,
  };

  constructor(engine: GameEngine, scene: SceneManager, hooks: DemoUIHooks) {
    this.engine = engine;
    this.scene = scene;
    this.hooks = hooks;
  }

  public startDemo(id: DemoId, queueRest = false, forExport = false): number {
    this.activeDemoId = id;
    this.isExportMode = forExport;
    audio.exportMode = forExport;

    if (queueRest && !forExport) {
      const order: DemoId[] = ['demo-1', 'demo-2', 'demo-3'];
      const idx = order.indexOf(id);
      this.playAllQueue = idx >= 0 ? order.slice(idx + 1) : [];
    } else {
      this.playAllQueue = [];
    }

    this.demoTime = 0;
    this.simAccum = 0;
    this.runtimeState = {
      firedEvents: new Set(),
      selectedTowerId: null,
      lastHover: null,
    };

    const cfg = DEMO_CONFIGS[id];
    cfg.setup(this.engine);
    this.scene.buildMapScene(this.engine);
    this.hooks.onDemoStarted?.();
    this.hooks.onSelectTower(null);
    this.hooks.onSetCursor({ visible: false, x: 0, y: 0, clicking: false });
    cfg.updateTimeline(this.engine, this.scene, this.hooks, 0, this.runtimeState);
    this.hooks.onRefreshHud();
    this.scene.renderFrame(this.engine, 0, null, null);

    if (!forExport) {
      audio.setTrack(cfg.mapId);
    }

    return cfg.duration;
  }

  public stopDemo(): void {
    this.activeDemoId = null;
    this.playAllQueue = [];
    this.isExportMode = false;
    audio.exportMode = false;
    this.hooks.onSelectTower(null);
    this.hooks.onSetCursor({ visible: false, x: 0, y: 0, clicking: false });
    this.hooks.onSetSubtitle('', '');
    this.scene.resetCamera();
    this.hooks.onDemoEnded?.();
  }

  public stepLive(dt: number): void {
    if (!this.activeDemoId || this.isExportMode) return;
    const cfg = DEMO_CONFIGS[this.activeDemoId];
    this.advanceToTime(this.demoTime + dt);
    if (this.demoTime >= cfg.duration) {
      if (this.playAllQueue.length > 0) {
        const nextId = this.playAllQueue.shift()!;
        this.startDemo(nextId, false, false);
      } else {
        this.stopDemo();
      }
    }
  }

  public advanceToTime(targetTime: number): void {
    if (!this.activeDemoId) return;
    const cfg = DEMO_CONFIGS[this.activeDemoId];
    const clampedTarget = Math.max(0, Math.min(cfg.duration, targetTime));

    // If seeking backward (e.g. frame(0) after previous run), reset cleanly
    if (clampedTarget < this.demoTime - 1e-6) {
      this.startDemo(this.activeDemoId, false, this.isExportMode);
    }

    const FIXED_DT = 1 / 60;
    const startTime = this.demoTime;
    let delta = clampedTarget - this.demoTime;
    while (delta > 1e-6) {
      const stepDt = Math.min(FIXED_DT, delta);
      this.demoTime += stepDt;
      cfg.updateTimeline(this.engine, this.scene, this.hooks, this.demoTime, this.runtimeState);
      this.engine.step(stepDt);
      delta -= stepDt;
    }

    if (clampedTarget === 0) {
      cfg.updateTimeline(this.engine, this.scene, this.hooks, 0, this.runtimeState);
    }

    this.hooks.onRefreshHud();
    if (this.runtimeState.selectedTowerId !== null) {
      this.hooks.onSelectTower(this.engine.getTowerById(this.runtimeState.selectedTowerId));
    }
    const renderDt =
      clampedTarget === 0 ? 0 : Math.min(0.1, Math.max(FIXED_DT, clampedTarget - startTime));
    this.scene.renderFrame(
      this.engine,
      renderDt,
      this.runtimeState.selectedTowerId,
      null
    );
  }

  public installVideoExport(onExitToMenu: () => void): void {
    const self = this;
    (window as unknown as { videoExport: unknown }).videoExport = {
      runs: ['demo-1', 'demo-2', 'demo-3'] as DemoId[],
      async begin(runId: DemoId, opts?: { fps?: number }): Promise<{ frames: number }> {
        const id: DemoId =
          runId === 'demo-2' || runId === 'demo-3' ? runId : 'demo-1';
        self.exportFps = Math.max(1, opts?.fps ?? 30);
        const dur = self.startDemo(id, false, true);
        const frames = Math.round(dur * self.exportFps);
        return { frames };
      },
      async frame(i: number): Promise<void> {
        if (!self.activeDemoId) return;
        const targetT = i / self.exportFps;
        self.advanceToTime(targetT);
      },
      end(): void {
        self.isExportMode = false;
        audio.exportMode = false;
        self.activeDemoId = null;
        self.playAllQueue = [];
        self.hooks.onSetCursor({ visible: false, x: 0, y: 0, clicking: false });
        self.hooks.onSetSubtitle('', '');
        onExitToMenu();
      },
    };
  }
}
