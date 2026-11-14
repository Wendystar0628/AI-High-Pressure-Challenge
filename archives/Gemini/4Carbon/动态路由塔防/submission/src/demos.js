// 三段实时实战演示编排器（总时长 55.0 秒 <= 60 秒）与确定性 window.videoExport 视频导出接口

import * as THREE from 'three';
import { gridToWorld } from './pathfinding.js';

function smoothstep01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export const DEMO_DEFS = {
  'demo-1': {
    id: 'demo-1',
    index: 1,
    title: '分段取舍',
    mapId: 'intranet',
    duration: 18.0,
    seed: 202601,
    summary: '西侧办公网段受创告急，将网闸拖至西边界节点预览并隔离，迫使办公网段敌人掉头经 DMZ 互联汇入东侧沙箱防区。'
  },
  'demo-2': {
    id: 'demo-2',
    index: 2,
    title: '旁路直通',
    mapId: 'backbone',
    duration: 18.5,
    seed: 202602,
    summary: '骨干洪峰三口齐发，洪泛团冲垮汇聚节点网闸使 C、B 改回原数据中心；玩家同时在 A 路线投下协议降级显形减速。'
  },
  'demo-3': {
    id: 'demo-3',
    index: 3,
    title: '蛰影现身',
    mapId: 'airgap_ics',
    duration: 18.5,
    seed: 202603,
    summary: '第 16 波首领蛰影预警并锁死西侧运维环，全域路线重收敛至东侧；玩家选中修复进程释放冗余切换破除加密稳住防线。'
  }
};

export class DemoDirector {
  constructor(app) {
    this.app = app;
    this.activeDemoId = null;
    this.elapsed = 0;
    this.duration = 18.0;
    this.firedEvents = new Set();
    this.exportMode = false;
    this.chainAll = false;
  }

  isRunning() {
    return !!this.activeDemoId;
  }

  startDemo(demoId, { forExport = false, chainAll = false } = {}) {
    const def = DEMO_DEFS[demoId] || DEMO_DEFS['demo-1'];
    this.activeDemoId = def.id;
    this.duration = def.duration;
    this.elapsed = 0;
    this.firedEvents.clear();
    this.exportMode = forExport;
    this.chainAll = chainAll && !forExport;

    // 启动对应地图与固定随机种子
    this.app.loadBattle(def.mapId, {
      seed: def.seed,
      isDemo: true,
      demoDef: def
    });

    const sim = this.app.sim;
    sim.speedMult = 1;
    sim.paused = false;

    // 编排各段演示的实战初始残局（势均力敌、有来有回！）
    if (def.id === 'demo-1') {
      this._setupDemo1(sim);
    } else if (def.id === 'demo-2') {
      this._setupDemo2(sim);
    } else if (def.id === 'demo-3') {
      this._setupDemo3(sim);
    }

    // 初始化第 0 帧镜头、光标与字幕
    this._applyTimelineAt(0);
    this.app.ui.syncAll();
    this.app.renderSingleFrame(0);
  }

  stopDemo(returnToMenu = true) {
    this.activeDemoId = null;
    this.exportMode = false;
    this.chainAll = false;
    this.app.vfx?.clearRoutePreview();
    this.app.vfx?.hidePlacementPreview();
    this.app.ui.hideDemoOverlay();
    if (returnToMenu) {
      this.app.showMainMenu();
    }
  }

  // --------------------------------------------------------------------------
  // Demo 1 初始局面：分段取舍（分段内网）
  // --------------------------------------------------------------------------
  _setupDemo1(sim) {
    sim.waveIndex = 5; // 第 6 波激战中
    sim.waveState = 'spawning';
    sim.compute = 9999;
    sim.intel = 999;

    // 西侧办公网段仅有残血防火墙苦撑；东侧业务网段拥有 2级沙箱 + 2级拦截器 + 2级防火墙 + 修复进程完备防区！
    const westFw = sim.deployTower('firewall', 4, 6).tower;
    westFw.hp = 310; // 已被打残告急！

    const eastSb = sim.deployTower('sandbox', 9, 5).tower;
    sim.upgradeTower(eastSb.id);

    const eastInt = sim.deployTower('interceptor', 11, 5, -Math.PI / 2).tower; // 朝西覆盖东路业务网段 (10,3..6)
    sim.upgradeTower(eastInt.id, 'B');

    const eastFw = sim.deployTower('firewall', 10, 6).tower;
    sim.upgradeTower(eastFw.id);

    sim.deployTower('repair', 10, 7);
    sim.deployTower('interceptor', 7, 2, Math.PI); // 朝北覆盖 DMZ 互联！

    sim.compute = 145;
    sim.intel = 28;
    sim.stats.computeSpent = 0;
    sim.logs = [];
    sim.addLog('ALERT', '西侧办公网段防线受损告急，建议利用交换节点动态改道！');

    // 场上已有敌军：
    // 1) 西路先头部队正围攻残血西侧防火墙 (4,6)
    sim.spawnEnemy('worm', 'A', gridToWorld(sim.map, 4, 5.65));
    sim.spawnEnemy('ransom', 'A', gridToWorld(sim.map, 4, 4.3));
    // 2) 办公网段北中段 (4,2.1) ~ (4,3.3) 有成群蠕虫与木马正在南下（隔离 4,5 后它们将集体掉头北返走 DMZ 互联！）
    sim.spawnEnemy('worm', 'A', gridToWorld(sim.map, 4, 3.25));
    sim.spawnEnemy('trojan', 'A', gridToWorld(sim.map, 4, 2.85));
    sim.spawnEnemy('worm', 'A', gridToWorld(sim.map, 4, 2.15));
    sim.spawnEnemy('trojan', 'A', gridToWorld(sim.map, 4, 1.55));

    // 3) 东路业务网段也在持续交火，守方有击杀也有受击
    sim.spawnEnemy('worm', 'B', gridToWorld(sim.map, 10, 5.3));
    sim.spawnEnemy('trojan', 'B', gridToWorld(sim.map, 10, 4.1));
    sim.spawnEnemy('packer', 'B', gridToWorld(sim.map, 10, 2.8));

    sim.spawnQueue = [
      { entry: 'A', type: 'trojan', time: 1.5 },
      { entry: 'A', type: 'worm', time: 2.8 },
      { entry: 'B', type: 'worm', time: 2.2 },
      { entry: 'B', type: 'ransom', time: 4.5 },
      { entry: 'A', type: 'flood', time: 5.5 },
      { entry: 'B', type: 'rogue_ap', time: 7.0 },
      { entry: 'A', type: 'worm', time: 8.5 }
    ];
  }

  // --------------------------------------------------------------------------
  // Demo 2 初始局面：旁路直通（骨干流域的洪峰）
  // --------------------------------------------------------------------------
  _setupDemo2(sim) {
    sim.waveIndex = 9; // 第 10 波三路洪峰！
    sim.waveState = 'spawning';
    sim.compute = 9999;
    sim.intel = 999;

    // 东侧专线汇聚节点 N2(10,7) 上已有一座残血网闸，正将 C、B 拦向西侧数据中心 X！
    const eastGate = sim.deployTower('airgap', 10, 7).tower;
    eastGate.hp = 235; // 即将被洪泛团重锤冲垮！
    this.demo2GateId = eastGate.id;

    // 西侧数据中心 X 防区（正在承受高压合流）
    const westFw = sim.deployTower('firewall', 3, 7).tower;
    sim.upgradeTower(westFw.id);
    westFw.hp = 920;

    const westInt = sim.deployTower('interceptor', 3, 6, -Math.PI / 2).tower; // 覆盖西隧道 (2,4..6)!
    sim.upgradeTower(westInt.id, 'A');

    sim.deployTower('interceptor', 6, 4, -Math.PI / 2); // 覆盖中央主干隧道 (5,3..6)!
    sim.deployTower('repair', 3, 8);

    // 东侧数据中心 Y 也预留了沙箱与防火墙迎击旁路直通后的回流！
    sim.deployTower('sandbox', 11, 6);
    sim.deployTower('firewall', 10, 8);

    sim.compute = 165;
    sim.intel = 34;
    sim.stats.computeSpent = 0;
    sim.logs = [];
    sim.addLog('ALERT', '【洪峰告警】三路流量并发，东侧汇聚节点网闸正遭受洪泛团猛烈冲击！');

    // 东侧节点 (10,6) 旁已有两只洪泛团正在猛砸残血网闸 (10,7)！
    sim.spawnEnemy('flood', 'C', gridToWorld(sim.map, 10, 6.0));
    sim.spawnEnemy('flood', 'B', gridToWorld(sim.map, 10, 5.75));

    // 北骨干线上有 C、B 的部队正在西行（一旦 10,7 网闸被冲垮，立刻改回数据中心 Y！）
    sim.spawnEnemy('worm', 'C', gridToWorld(sim.map, 8.2, 2));
    sim.spawnEnemy('trojan', 'B', gridToWorld(sim.map, 10.6, 2));
    sim.spawnEnemy('ransom', 'B', gridToWorld(sim.map, 11.5, 2));

    // 西侧互联网入口 A 涌来伪装木马与蠕虫（等待玩家投下「协议降级」显形减速并触发动态改道！）
    sim.spawnEnemy('trojan', 'A', gridToWorld(sim.map, 2, 3.6));
    sim.spawnEnemy('trojan', 'A', gridToWorld(sim.map, 2, 4.4));
    sim.spawnEnemy('worm', 'A', gridToWorld(sim.map, 2, 2.5));
    sim.spawnEnemy('worm', 'A', gridToWorld(sim.map, 2, 6.3));

    sim.spawnQueue = [
      { entry: 'A', type: 'trojan', time: 1.2 },
      { entry: 'C', type: 'worm', time: 1.6 },
      { entry: 'B', type: 'trojan', time: 2.2 },
      { entry: 'A', type: 'worm', time: 3.0 },
      { entry: 'A', type: 'trojan', time: 4.4 },
      { entry: 'C', type: 'ransom', time: 5.2 },
      { entry: 'B', type: 'worm', time: 6.0 },
      { entry: 'A', type: 'rogue_ap', time: 7.5 }
    ];
  }

  // --------------------------------------------------------------------------
  // Demo 3 初始局面：蛰影现身（气隙深层第 16 波）
  // --------------------------------------------------------------------------
  _setupDemo3(sim) {
    sim.waveIndex = 15; // 第 16 波终局！
    sim.waveState = 'spawning';
    sim.compute = 9999;
    sim.intel = 999;

    // 东侧通道（重兵核心防区，即将承接蛰影锁死西环后的全军合流，且将被勒索脉冲加密！）
    const eastFw = sim.deployTower('firewall', 10, 6).tower;
    sim.upgradeTower(eastFw.id);
    eastFw.hp = 1080;

    const eastSb = sim.deployTower('sandbox', 11, 5).tower;
    sim.upgradeTower(eastSb.id);
    eastSb.hp = 520;

    const eastInt = sim.deployTower('interceptor', 11, 4, -Math.PI / 2).tower;
    sim.upgradeTower(eastInt.id, 'A');
    eastInt.hp = 580;

    // 关键主角：平台 (11, 6) 上的修复进程（技能已就绪！）
    const rep = sim.deployTower('repair', 11, 6).tower;
    sim.upgradeTower(rep.id);
    rep.skillCd = 0;
    this.demo3RepairTower = rep;

    // 西侧前哨沙箱与蜜罐正在与蛰影先头部队交战
    sim.deployTower('sandbox', 3, 4);
    const westHp = sim.deployTower('honeypot', 4, 7).tower;
    westHp.hp = 420;

    sim.compute = 180;
    sim.intel = 36;
    sim.stats.computeSpent = 0;
    sim.logs = [];
    sim.addLog('CRITICAL', '【终局告警】首领「蛰影」正在冲击气隙深层，注意其阶段切换与锁死预警！');

    // 首领「蛰影」正位于北运维环 (5.8, 3.0) 向西侧通道推进，身边伴随加壳器、勒索者与蠕虫；东路也有敌军交火！
    const boss = sim.spawnEnemy('zheying', 'A', gridToWorld(sim.map, 5.8, 3.0), {
      bossPhase: 2,
      disguised: false
    });
    boss.hp = Math.round(boss.maxHp * 0.46);
    this.demo3Boss = boss;

    sim.spawnEnemy('packer', 'B', gridToWorld(sim.map, 4, 1.8));
    sim.spawnEnemy('worm', 'A', gridToWorld(sim.map, 6.2, 3.0));
    sim.spawnEnemy('ransom', 'C', gridToWorld(sim.map, 10, 3.8));
    sim.spawnEnemy('worm', 'C', gridToWorld(sim.map, 10, 5.4));
    sim.spawnEnemy('trojan', 'C', gridToWorld(sim.map, 10, 4.5));
    sim.spawnEnemy('worm', 'C', gridToWorld(sim.map, 10, 6.2));

    sim.spawnQueue = [
      { entry: 'A', type: 'worm', time: 1.4 },
      { entry: 'C', type: 'ransom', time: 2.0 },
      { entry: 'C', type: 'worm', time: 3.1 },
      { entry: 'C', type: 'worm', time: 4.0 },
      { entry: 'A', type: 'trojan', time: 4.8 },
      { entry: 'B', type: 'worm', time: 6.0 },
      { entry: 'C', type: 'rogue_ap', time: 7.4 }
    ];
  }

  // --------------------------------------------------------------------------
  // 推进演示时间轴（实时循环与 videoExport.frame 共用同一逻辑！）
  // --------------------------------------------------------------------------
  stepDemo(dt) {
    if (!this.activeDemoId) return;
    this.elapsed += dt;
    this.app.sim.step(dt);
    this._applyTimelineAt(this.elapsed);

    if (!this.exportMode && this.elapsed >= this.duration) {
      if (this.chainAll) {
        if (this.activeDemoId === 'demo-1') {
          this.startDemo('demo-2', { chainAll: true });
          return;
        }
        if (this.activeDemoId === 'demo-2') {
          this.startDemo('demo-3', { chainAll: true });
          return;
        }
      }
      this.stopDemo(true);
    }
  }

  _once(tag, fn) {
    if (this.firedEvents.has(tag)) return;
    this.firedEvents.add(tag);
    fn();
  }

  // 将三维格子坐标投影到当前屏幕像素坐标 (clientX, clientY)
  _gridScreenPos(gx, gz, y = 0.25) {
    const wp = gridToWorld(this.app.sim.map, gx, gz, y);
    const v = new THREE.Vector3(wp.x, wp.y, wp.z);
    this.app.camera.updateMatrixWorld();
    v.project(this.app.camera);
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x: (v.x * 0.5 + 0.5) * w,
      y: (-v.y * 0.5 + 0.5) * h
    };
  }

  _domCenterPos(selector) {
    const el = document.querySelector(selector);
    if (!el) return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.9 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
  }

  _lerpScreen(p1, p2, t) {
    const k = smoothstep01(t);
    return {
      x: lerp(p1.x, p2.x, k),
      y: lerp(p1.y, p2.y, k)
    };
  }

  _applyCameraKeyframes(keyframes, t) {
    let k0 = keyframes[0];
    let k1 = keyframes[keyframes.length - 1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (t >= keyframes[i].t && t <= keyframes[i + 1].t) {
        k0 = keyframes[i];
        k1 = keyframes[i + 1];
        break;
      }
    }
    const u = k1.t > k0.t ? smoothstep01((t - k0.t) / (k1.t - k0.t)) : 1;
    this.app.setCameraPose({
      tx: lerp(k0.tx, k1.tx, u),
      tz: lerp(k0.tz, k1.tz, u),
      radius: lerp(k0.radius, k1.radius, u),
      polar: lerp(k0.polar, k1.polar, u),
      azimuth: lerp(k0.azimuth, k1.azimuth, u)
    });
  }

  _applyTimelineAt(t) {
    const sim = this.app.sim;
    const ui = this.app.ui;

    if (this.activeDemoId === 'demo-1') {
      // 镜头：全景 -> 聚焦西边界与DMZ -> 跟随掉头敌军横移至东侧业务网段杀伤区
      this._applyCameraKeyframes(
        [
          { t: 0.0, tx: 0, tz: 0.5, radius: 29.5, polar: 0.92, azimuth: 0.0 },
          { t: 2.2, tx: 0, tz: 0.5, radius: 29.0, polar: 0.92, azimuth: 0.0 },
          { t: 5.0, tx: -3.6, tz: -1.6, radius: 20.5, polar: 0.84, azimuth: 0.12 },
          { t: 10.5, tx: -1.5, tz: -2.2, radius: 21.0, polar: 0.84, azimuth: 0.05 },
          { t: 14.5, tx: 4.5, tz: 0.5, radius: 20.0, polar: 0.82, azimuth: -0.14 },
          { t: 18.0, tx: 3.0, tz: 0.8, radius: 22.5, polar: 0.86, azimuth: -0.08 }
        ],
        t
      );

      // 字幕与鼠标动作编排
      let sub = '';
      let cursor = { x: window.innerWidth * 0.55, y: window.innerHeight * 0.62, down: false, label: '' };

      const cardPos = this._domCenterPos('[data-tower-card="airgap"]');
      const nodePos = this._gridScreenPos(4, 5, 0.2);

      if (t < 2.6) {
        sub = '【分段取舍】西侧办公网段防火墙受创告急，东侧业务网段沙箱与防空火力充裕。';
        cursor = { ...this._lerpScreen({ x: window.innerWidth * 0.56, y: window.innerHeight * 0.52 }, cardPos, (t - 1.2) / 1.4), down: false };
      } else if (t < 4.5) {
        sub = '按住底部「网闸」拖向西边界节点，实时预览门户网站新路线……';
        const p = this._lerpScreen(cardPos, nodePos, (t - 2.6) / 1.6);
        cursor = { ...p, down: true, label: '拖拽：网闸' };
        if (t >= 3.9) {
          ui.showDemoTowerPreview('airgap', 4, 5);
        }
      } else if (t < 6.6) {
        sub = '路线预览：虚线标出入口 A 将折向北侧「DMZ 互联」并入东侧防区！';
        cursor = { ...nodePos, down: true, label: '预览改道' };
        ui.showDemoTowerPreview('airgap', 4, 5);
      } else if (t < 12.2) {
        this._once('d1_deploy', () => {
          ui.clearDemoPreview();
          sim.deployTower('airgap', 4, 5);
        });
        sub = '松手确认隔离！办公网段内的入侵程序立即掉头北返，经 DMZ 互联转向东路！';
        const restPos = { x: nodePos.x + 90, y: nodePos.y - 50 };
        cursor = { ...this._lerpScreen(nodePos, restPos, (t - 6.6) / 1.2), down: false };
      } else {
        sub = '合流敌军踏入东侧沙箱扫描域显形，守方集中优势火力化解双路攻势！';
        cursor = { x: window.innerWidth * 0.72, y: window.innerHeight * 0.56, down: false };
      }

      ui.updateDemoOverlay({
        demoDef: DEMO_DEFS['demo-1'],
        elapsed: t,
        duration: this.duration,
        subtitle: sub,
        cursor
      });
    } else if (this.activeDemoId === 'demo-2') {
      // 镜头：全景 -> 聚焦东汇聚节点(10,7)被洪泛团冲垮 -> 横移至西专线隧道(2,5)投放协议降级 -> 双活全景拉锯
      this._applyCameraKeyframes(
        [
          { t: 0.0, tx: 0, tz: 0.5, radius: 30.0, polar: 0.92, azimuth: 0.0 },
          { t: 2.0, tx: 4.5, tz: 2.2, radius: 20.5, polar: 0.82, azimuth: -0.15 },
          { t: 5.8, tx: 4.0, tz: 1.5, radius: 22.0, polar: 0.85, azimuth: -0.08 },
          { t: 8.6, tx: -7.5, tz: -0.2, radius: 20.5, polar: 0.82, azimuth: 0.16 },
          { t: 13.5, tx: -6.2, tz: 0.5, radius: 21.5, polar: 0.84, azimuth: 0.1 },
          { t: 18.5, tx: -1.0, tz: 1.2, radius: 27.5, polar: 0.9, azimuth: 0.0 }
        ],
        t
      );

      // 确保在 t=3.8s 左右若洪泛团还差一点血没砸碎网闸，洪泛团关键重击冲垮网闸触发实时旁路直通！
      if (t >= 3.8) {
        this._once('d2_smash_gate', () => {
          const gate = sim.towers.find((tw) => !tw.dead && tw.id === this.demo2GateId);
          if (gate) {
            sim._damageTower(gate, gate.hp + 50, null, '洪泛团破闸冲击');
          }
        });
      }

      const itemCardPos = this._domCenterPos('[data-item-card="downgrade"]');
      const tunnelPos = this._gridScreenPos(2, 5, 0.2);

      let sub = '';
      let cursor = { x: window.innerWidth * 0.62, y: window.innerHeight * 0.55, down: false, label: '' };

      if (t < 3.8) {
        sub = '【旁路直通】骨干洪峰三路并发，洪泛团正猛烈锤击东侧汇聚节点上的网闸！';
        cursor = { x: window.innerWidth * 0.64, y: window.innerHeight * 0.52, down: false };
      } else if (t < 7.2) {
        sub = '网闸被洪泛团冲垮，节点旁路直通！分支专线与云端互联流量改回数据中心 Y！';
        cursor = { ...this._lerpScreen({ x: window.innerWidth * 0.64, y: window.innerHeight * 0.52 }, itemCardPos, (t - 5.4) / 1.6), down: false };
      } else if (t < 9.2) {
        this._once('d2_pick_item', () => {
          ui.selectItemForDemo('downgrade');
        });
        sub = '点选道具「协议降级」移至互联网入口隧道，预览影响范围与调速改道……';
        const p = this._lerpScreen(itemCardPos, tunnelPos, (t - 7.4) / 1.4);
        cursor = { ...p, down: t < 7.6, label: '准备投放：协议降级' };
        if (t >= 8.5) {
          ui.showDemoItemPreview('downgrade', 2, 5);
        }
      } else if (t < 10.9) {
        sub = '确认前可见降级范围与新路线：链路降速将令后续互联网流量改走中央主干隧道！';
        cursor = { ...tunnelPos, down: false, label: '范围与改道预览' };
        ui.showDemoItemPreview('downgrade', 2, 5);
      } else if (t < 14.5) {
        this._once('d2_cast_item', () => {
          ui.clearDemoPreview();
          sim.useItem('downgrade', 2, 5);
        });
        sub = '投下协议降级！隧道上的伪装木马当场显形并大幅减速，被轨道炮精准歼灭！';
        cursor = { x: tunnelPos.x + 80, y: tunnelPos.y - 40, down: t < 11.15 };
      } else {
        sub = '后续流量自动切换主干隧道，双活数据中心 X、Y 两线协同顶住洪峰！';
        cursor = { x: window.innerWidth * 0.52, y: window.innerHeight * 0.55, down: false };
      }

      ui.updateDemoOverlay({
        demoDef: DEMO_DEFS['demo-2'],
        elapsed: t,
        duration: this.duration,
        subtitle: sub,
        cursor
      });
    } else if (this.activeDemoId === 'demo-3') {
      // 镜头：全景 -> 聚焦中央气隙与西侧蛰影预警锁死 -> 跟随重收敛路线移至东侧受加密防区 -> 释放冗余切换反击蛰影
      this._applyCameraKeyframes(
        [
          { t: 0.0, tx: 0, tz: 0.4, radius: 30.0, polar: 0.92, azimuth: 0.0 },
          { t: 2.0, tx: -4.2, tz: -1.2, radius: 20.5, polar: 0.8, azimuth: 0.15 },
          { t: 5.4, tx: -1.2, tz: -1.4, radius: 22.8, polar: 0.84, azimuth: 0.04 },
          { t: 8.4, tx: 6.0, tz: 0.4, radius: 19.6, polar: 0.8, azimuth: -0.16 },
          { t: 14.5, tx: 5.4, tz: -0.2, radius: 19.8, polar: 0.81, azimuth: -0.11 },
          { t: 18.5, tx: 2.5, tz: 0.4, radius: 24.5, polar: 0.87, azimuth: -0.05 }
        ],
        t
      );

      // t=1.6s 触发蛰影进入破坏阶段，预警 2.2s 后在 t=3.8s 锁死西运维环入口 (4,4) 并加密东侧前线塔！
      if (t >= 1.6) {
        this._once('d3_boss_warn', () => {
          if (this.demo3Boss && !this.demo3Boss.dead) {
            sim.triggerZheyingDestructivePhase(this.demo3Boss, [{ x: 4, z: 4 }]);
            this.demo3Boss.speed = 0.42; // 预警期间稳步逼近 (4,3)，锁死生效后再全速转向东路！
            this.demo3Boss.shield = 650;
          }
          if (this.demo3RepairTower) {
            this.demo3RepairTower.autoCleanseTimer = 9.0;
          }
        });
      }
      if (t >= 3.9) {
        this._once('d3_boss_sprint_east', () => {
          if (this.demo3Boss && !this.demo3Boss.dead) {
            this.demo3Boss.speed = 0.86;
          }
        });
      }

      const repScreenPos = this._gridScreenPos(11, 6, 0.75);

      let sub = '';
      let cursor = { x: window.innerWidth * 0.48, y: window.innerHeight * 0.5, down: false, label: '' };

      if (t < 3.85) {
        sub = '【蛰影现身】首领「蛰影」切入破坏阶段，红色高危预警即将锁死西侧运维环！';
        cursor = { x: window.innerWidth * 0.45, y: window.innerHeight * 0.48, down: false };
      } else if (t < 7.6) {
        sub = '西运维环被激光障壁锁死！全域路线重收敛至东侧，前线三座设备遭破坏脉冲加密！';
        cursor = { ...this._lerpScreen({ x: window.innerWidth * 0.45, y: window.innerHeight * 0.48 }, repScreenPos, (t - 5.8) / 1.6), down: false };
      } else if (t < 9.5) {
        if (t >= 8.0) {
          this._once('d3_select_repair', () => {
            if (this.demo3RepairTower && !this.demo3RepairTower.dead) {
              ui.selectTowerById(this.demo3RepairTower.id);
            }
          });
        }
        sub = '左键点选后方平台上的「修复进程」，打开控制面板准备释放主动技能……';
        cursor = { ...repScreenPos, down: t >= 7.95 && t <= 8.25, label: '选中：修复进程' };
      } else if (t < 11.2) {
        const curBtnPos = this._domCenterPos('#btn-cast-skill');
        const p = this._lerpScreen(repScreenPos, curBtnPos, (t - 9.5) / 1.15);
        sub = '移动光标至「冗余切换」技能按钮，一键净化东侧防区加密并张开应急护盾！';
        cursor = { ...p, down: t >= 10.95, label: '释放：冗余切换' };
      } else {
        this._once('d3_cast_failover', () => {
          if (this.demo3RepairTower && !this.demo3RepairTower.dead) {
            sim.castTowerSkill(this.demo3RepairTower.id);
            ui.syncSelectionPanel();
          }
        });
        sub = '「冗余切换」瞬间击碎三塔加密锁链并赋予护盾，轨道炮与沙箱火力全开迎击蛰影！';
        const curBtnPos = this._domCenterPos('#btn-cast-skill');
        cursor = {
          ...this._lerpScreen(curBtnPos, { x: window.innerWidth * 0.58, y: window.innerHeight * 0.5 }, (t - 11.2) / 1.5),
          down: false
        };
      }

      ui.updateDemoOverlay({
        demoDef: DEMO_DEFS['demo-3'],
        elapsed: t,
        duration: this.duration,
        subtitle: sub,
        cursor
      });
    }
  }
}

// ============================================================================
// 挂载题面 2.15 节规定的固定全局接口 window.videoExport
// ============================================================================
export function installVideoExportAPI(app) {
  let activeRunId = null;
  let exportFps = 30;
  let totalFrames = 0;
  let currentFrameIndex = -1;

  const waitNextPaint = () =>
    new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  window.videoExport = {
    runs: ['demo-1', 'demo-2', 'demo-3'],

    async begin(runId, { fps = 30 } = {}) {
      const def = DEMO_DEFS[runId];
      if (!def) {
        throw new Error(`Unknown videoExport runId: ${runId}. Expected one of demo-1, demo-2, demo-3.`);
      }
      activeRunId = runId;
      exportFps = Math.max(1, Number(fps) || 30);
      totalFrames = Math.round(def.duration * exportFps);
      currentFrameIndex = -1;

      app.setExportMode(true);
      app.demoDirector.startDemo(runId, { forExport: true });
      await waitNextPaint();

      return { frames: totalFrames };
    },

    async frame(i) {
      if (!activeRunId) {
        throw new Error('window.videoExport.begin(runId, { fps }) must be called before frame(i).');
      }
      const targetIdx = Math.max(0, Math.floor(i));
      const targetTime = targetIdx / exportFps;

      // 若跳帧或重回第 0 帧，重新从起始状态确定性步进
      if (targetIdx === 0 || targetIdx <= currentFrameIndex) {
        app.demoDirector.startDemo(activeRunId, { forExport: true });
        currentFrameIndex = 0;
      }

      // 使用固定小步长确定性推进模拟、自动操作、镜头与字幕，完全不依赖真实时间
      const maxStep = 1 / 60;
      while (app.demoDirector.elapsed + 1e-7 < targetTime) {
        const rem = targetTime - app.demoDirector.elapsed;
        const step = Math.min(maxStep, rem);
        app.demoDirector.stepDemo(step);
      }

      currentFrameIndex = targetIdx;
      app.ui.syncAll();
      app.renderSingleFrame(0);
      await waitNextPaint();
    },

    end() {
      activeRunId = null;
      currentFrameIndex = -1;
      app.setExportMode(false);
      app.demoDirector.stopDemo(true);
    }
  };
}
