// 守护进程操作系统界面控制器（关卡选择、实战演示栏、设备手册与威胁档案、战斗面板、拖拽预览、世界坐标投影血条与事件报告）

import * as THREE from 'three';
import {
  TILE,
  TOWERS,
  ITEMS,
  ENEMIES,
  BOSSES,
  TERRAIN_DOCS,
  STATUS_DOCS,
  ENTRY_COLORS,
  SELL_REFUND_RATIO
} from './constants.js';
import { MAPS } from './maps.js';
import { DEMO_DEFS } from './demos.js';
import { gridToWorld, keyOf, routesDiffer } from './pathfinding.js';
import { sound } from './audio.js';

// 自制矢量图标库（所有塔、道具、敌人的专属高辨识度 SVG 图标）
const ICONS = {
  firewall: `<svg viewBox="0 0 36 36"><rect x="5" y="7" width="26" height="22" rx="3" fill="none" stroke="#29b6f6" stroke-width="2.5"/><path d="M5 14h26M5 21h26M14 7v7M22 14v7M14 21v8" stroke="#7dd3fc" stroke-width="2"/><circle cx="18" cy="18" r="3.5" fill="#29b6f6"/></svg>`,
  honeypot: `<svg viewBox="0 0 36 36"><polygon points="18,4 30,11 30,25 18,32 6,25 6,11" fill="none" stroke="#ffca28" stroke-width="2.5"/><polygon points="18,10 24,14 24,22 18,26 12,22 12,14" fill="rgba(255,202,40,0.28)" stroke="#ffe082" stroke-width="1.8"/><circle cx="18" cy="18" r="3" fill="#ffca28"/></svg>`,
  airgap: `<svg viewBox="0 0 36 36"><rect x="6" y="6" width="24" height="24" rx="4" fill="none" stroke="#ff7043" stroke-width="2.5"/><path d="M12 6v24M24 6v24M6 18h24" stroke="#ffab91" stroke-width="2.2"/><circle cx="18" cy="18" r="4" fill="#ff7043"/></svg>`,
  interceptor: `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="11" fill="none" stroke="#00e5ff" stroke-width="2.2" stroke-dasharray="5 3"/><path d="M18 3v10M18 23v10M3 18h10M23 18h10" stroke="#00e5ff" stroke-width="2.4"/><polygon points="18,11 23,22 18,19 13,22" fill="#7dd3fc"/></svg>`,
  sandbox: `<svg viewBox="0 0 36 36"><rect x="7" y="7" width="22" height="22" rx="3" fill="rgba(0,230,118,0.14)" stroke="#00e676" stroke-width="2.4"/><circle cx="18" cy="18" r="6" fill="none" stroke="#69f0ae" stroke-width="2"/><path d="M10 18h4M22 18h4M18 10v4M18 22v4" stroke="#69f0ae" stroke-width="1.8"/></svg>`,
  repair: `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="13" fill="rgba(105,240,174,0.12)" stroke="#69f0ae" stroke-width="2.2"/><path d="M15 10h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="#69f0ae"/></svg>`,
  isolator: `<svg viewBox="0 0 36 36"><polygon points="18,4 32,29 4,29" fill="rgba(255,171,64,0.18)" stroke="#ffab40" stroke-width="2.4"/><path d="M18 13v8M18 24v2.5" stroke="#ffd180" stroke-width="2.8" stroke-linecap="round"/></svg>`,
  downgrade: `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="13" fill="rgba(255,215,64,0.14)" stroke="#ffd740" stroke-width="2.3"/><path d="M18 9v13M12 17l6 6 6-6M11 26h14" fill="none" stroke="#ffe57f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  restore: `<svg viewBox="0 0 36 36"><path d="M8 18a10 10 0 1 1 3 7.2" fill="none" stroke="#69f0ae" stroke-width="2.5" stroke-linecap="round"/><polyline points="7,12 8,19 15,18" fill="none" stroke="#69f0ae" stroke-width="2.5"/><circle cx="18" cy="18" r="3.5" fill="#69f0ae"/></svg>`,
  enemy: `<svg viewBox="0 0 28 28"><polygon points="14,2 25,9 21,24 7,24 3,9" fill="none" stroke="currentColor" stroke-width="2.3"/><circle cx="14" cy="14" r="4" fill="currentColor"/></svg>`
};

export class UIController {
  constructor(app) {
    this.app = app;
    this.selected = null; // { kind: 'tower'|'enemy'|'tile', id?, gx?, gz? }
    this.activeDrag = null; // { mode: 'tower'|'item', id, isPointerDrag, orienting, gx, gz, dirAngle }
    this.codexTab = 'devices';
    this.lastForecastWave = -1;
    this.worldLabels = new Map(); // key -> HTMLElement
    this.floatEls = new Map();

    this._cacheDom();
    this._renderMenuCards();
    this._renderCodex();
    this._bindEvents();
  }

  _cacheDom() {
    this.menuScreen = document.getElementById('menu-screen');
    this.battleHud = document.getElementById('battle-hud');
    this.worldHud = document.getElementById('world-hud-layer');
    this.codexModal = document.getElementById('codex-modal');
    this.pauseModal = document.getElementById('pause-modal');
    this.reportModal = document.getElementById('report-modal');
    this.bannerEl = document.getElementById('center-alert-banner');
    this.cursorTipEl = document.getElementById('cursor-preview-tip');
    this.orientBarEl = document.getElementById('orient-confirm-bar');

    // 顶部常驻状态
    this.elIntegrity = document.getElementById('val-integrity');
    this.elCompute = document.getElementById('val-compute');
    this.elIntel = document.getElementById('val-intel');
    this.elWave = document.getElementById('val-wave');
    this.elMapTitle = document.getElementById('val-map-title');
    this.btnNextWave = document.getElementById('btn-next-wave');

    // 面板容器
    this.forecastBody = document.getElementById('forecast-body');
    this.logList = document.getElementById('sys-log-list');
    this.towerDock = document.getElementById('tower-dock-cards');
    this.itemDock = document.getElementById('item-dock-cards');
    this.inspectorPanel = document.getElementById('inspector-panel');
    this.inspectorBody = document.getElementById('inspector-body');
    this.bossHud = document.getElementById('boss-top-bar');
    this.threatToastEl = document.getElementById('threat-toast');

    // 演示覆盖层
    this.demoOverlay = document.getElementById('demo-overlay');
    this.demoTitleEl = document.getElementById('demo-badge-title');
    this.demoProgEl = document.getElementById('demo-progress-fill');
    this.demoSubEl = document.getElementById('demo-subtitle-box');
    this.demoCursorEl = document.getElementById('demo-virtual-cursor');
    this.demoCursorTag = document.getElementById('demo-cursor-tag');
  }

  _renderMenuCards() {
    const mapGrid = document.getElementById('menu-map-grid');
    mapGrid.innerHTML = MAPS.map((m) => {
      const boss = BOSSES[m.bossId];
      const entriesStr = m.entries.map((e) => `<span class="port-chip port-${e.id}">${e.id} ${e.name}</span>`).join('');
      const exitsStr = m.exits.map((x) => `<span class="core-chip">${x.name}</span>`).join('');
      return `
        <div class="os-map-card theme-${m.theme}" data-start-map="${m.id}">
          <div class="map-card-header">
            <span class="map-index">SECTOR 0${m.index}</span>
            <span class="map-waves">${m.waveCount} 波入侵</span>
          </div>
          <h3 class="map-title">${m.name}</h3>
          <div class="map-sub">${m.subtitle}</div>
          <p class="map-desc">${m.ambientDesc}</p>
          <div class="map-ports-row">
            <div><small>接入端口：</small>${entriesStr}</div>
            <div><small>守护中枢：</small>${exitsStr}</div>
            <div><small>交换节点：</small><span class="node-chip">${m.nodes.length} 座可改道枢纽</span> <small>终局威胁：</small><span class="boss-chip">${boss.name}</span></div>
          </div>
          <button class="os-btn primary full-btn" data-start-map="${m.id}">接入守护防区 ➔</button>
        </div>
      `;
    }).join('');

    const demoGrid = document.getElementById('menu-demo-grid');
    demoGrid.innerHTML = Object.values(DEMO_DEFS)
      .map(
        (d) => `
        <div class="os-demo-card" data-start-demo="${d.id}">
          <div class="demo-card-top">
            <span class="demo-tag">实战演示 0${d.index}</span>
            <span class="demo-dur">${d.duration.toFixed(1)} 秒</span>
          </div>
          <h4>${d.title}</h4>
          <p>${d.summary}</p>
          <button class="os-btn accent" data-start-demo="${d.id}">▶ 实时演出</button>
        </div>
      `
      )
      .join('');
  }

  buildBattleDock() {
    const towerOrder = ['firewall', 'honeypot', 'airgap', 'interceptor', 'sandbox', 'repair'];
    this.towerDock.innerHTML = towerOrder
      .map((id) => {
        const t = TOWERS[id];
        const intelTag = t.nodeIntelCost > 0 ? `<span class="cost-intel" title="部署在交换节点时需消耗情报">+◈${t.nodeIntelCost}(节点)</span>` : '';
        return `
          <div class="dock-card tower-card" data-tower-card="${id}" title="${t.shortDesc}">
            <div class="card-role-tag">${t.category}</div>
            <div class="card-main-row">
              <div class="card-icon">${ICONS[id]}</div>
              <div class="card-meta">
                <div class="card-name">${t.name}</div>
                <div class="card-sub">${t.role}</div>
              </div>
            </div>
            <div class="card-cost-row">
              <span class="cost-compute">⚡${t.costCompute}算力</span>
              ${intelTag}
            </div>
          </div>
        `;
      })
      .join('');

    const itemOrder = ['isolator', 'downgrade', 'restore'];
    this.itemDock.innerHTML = itemOrder
      .map((id) => {
        const it = ITEMS[id];
        const costCls = it.costType === 'intel' ? 'cost-intel' : 'cost-compute';
        const costUnit = it.costType === 'intel' ? `◈${it.cost} 情报` : `⚡${it.cost} 算力`;
        return `
          <div class="dock-card item-card" data-item-card="${id}" title="${it.desc}">
            <div class="card-cd-mask" id="item-cd-mask-${id}"></div>
            <div class="card-role-tag item-target-tag">${it.targetLabel}</div>
            <div class="card-main-row">
              <div class="card-icon">${ICONS[id]}</div>
              <div class="card-meta">
                <div class="card-name">${it.name}</div>
                <div class="card-sub">冷却 ${it.cooldown}s</div>
              </div>
            </div>
            <div class="card-cost-row">
              <span class="${costCls}">${costUnit}</span>
              <span class="item-cd-text" id="item-cd-txt-${id}">就绪</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  _renderCodex() {
    const devPane = document.getElementById('codex-pane-devices');
    const thrPane = document.getElementById('codex-pane-threats');

    const towersHtml = Object.values(TOWERS)
      .map((t) => {
        let upHtml = '';
        if (t.branches) {
          upHtml = `
            <div class="codex-branch-box">
              <div><strong>2级分支 A · ${t.branches.A.name}</strong> (⚡${t.branches.A.costCompute} / ◈${t.branches.A.costIntel})：${t.branches.A.desc}</div>
              <div><strong>2级分支 B · ${t.branches.B.name}</strong> (⚡${t.branches.B.costCompute} / ◈${t.branches.B.costIntel})：${t.branches.B.desc}</div>
            </div>
          `;
        } else {
          upHtml = `
            <div class="codex-branch-box">
              <div><strong>2级升级 · ${t.lv2.name}</strong> (⚡${t.lv2.costCompute})：${t.lv2.desc}</div>
            </div>
          `;
        }
        return `
          <div class="codex-entry">
            <div class="codex-entry-head">
              <div class="codex-icon">${ICONS[t.id]}</div>
              <div>
                <h4>${t.name} <span class="badge">${t.role}</span> <span class="badge subtle">部署：${t.category}</span></h4>
                <div class="codex-cost">基础消耗：⚡${t.costCompute} 算力 ${t.nodeIntelCost ? `| 节点隔离附加：◈${t.nodeIntelCost} 情报` : ''}</div>
              </div>
            </div>
            <p><strong>1级机制：</strong>${t.lv1.desc}</p>
            ${upHtml}
            <p class="codex-skill"><strong>主动技能「${t.skill.name}」(冷却 ${t.skill.cooldown}s)：</strong>${t.skill.desc}</p>
          </div>
        `;
      })
      .join('');

    const itemsHtml = Object.values(ITEMS)
      .map(
        (it) => `
        <div class="codex-entry compact">
          <div class="codex-entry-head">
            <div class="codex-icon">${ICONS[it.id]}</div>
            <div>
              <h4>道具 · ${it.name} <span class="badge">投放：${it.targetLabel}</span></h4>
              <div class="codex-cost">消耗：${it.costType === 'intel' ? `◈${it.cost} 情报` : `⚡${it.cost} 算力`} | 间隔冷却：${it.cooldown}s</div>
            </div>
          </div>
          <p>${it.desc}</p>
        </div>
      `
      )
      .join('');

    const terrainHtml = TERRAIN_DOCS.map(
      (tr) => `
        <div class="codex-entry compact">
          <h4><span class="dot" style="background:${tr.color}"></span>地形 · ${tr.name} <span class="badge">${tr.badge}</span></h4>
          <p>${tr.desc}</p>
        </div>
      `
    ).join('');

    const statusHtml = STATUS_DOCS.map(
      (st) => `
        <div class="codex-entry compact">
          <h4><span class="dot" style="background:${st.color}"></span>状态与规则 · ${st.name}</h4>
          <p>${st.desc}</p>
        </div>
      `
    ).join('');

    devPane.innerHTML = `
      <h3 class="codex-sec-title">一、守护进程防御塔（6 类）</h3>
      <div class="codex-grid">${towersHtml}</div>
      <h3 class="codex-sec-title">二、战术调度道具（3 类）</h3>
      <div class="codex-grid">${itemsHtml}</div>
      <h3 class="codex-sec-title">三、立体网络地形与状态规则</h3>
      <div class="codex-grid">${terrainHtml}${statusHtml}</div>
    `;

    const enemiesHtml = Object.values(ENEMIES)
      .map(
        (e) => `
        <div class="codex-entry">
          <div class="codex-entry-head">
            <div class="codex-icon" style="color:${e.cssColor}">${ICONS.enemy}</div>
            <div>
              <h4>${e.name} <span class="badge">${e.badge}</span></h4>
              <div class="codex-cost">生命：${e.maxHp} | 移速：${e.speed} | 阻挡占用：${e.flying ? '无线飞行(不受阻挡)' : e.blockCost} | 中枢威胁：-${e.coreDamage}</div>
            </div>
          </div>
          <p>${e.desc}</p>
        </div>
      `
      )
      .join('');

    const bossesHtml = Object.values(BOSSES)
      .map(
        (b) => `
        <div class="codex-entry boss-codex">
          <div class="codex-entry-head">
            <div class="codex-icon" style="color:${b.cssColor}">${ICONS.enemy}</div>
            <div>
              <h4>首领 · ${b.name}（${b.title}） <span class="badge warn">${b.mapName}</span></h4>
              <div class="codex-cost">生命：${b.maxHp} | 阻挡占用：${b.blockCost} | 中枢威胁：-${b.coreDamage}</div>
            </div>
          </div>
          <p>${b.desc}</p>
        </div>
      `
      )
      .join('');

    thrPane.innerHTML = `
      <h3 class="codex-sec-title">一、「蛰影」常规入侵载荷（6 类）</h3>
      <div class="codex-grid">${enemiesHtml}</div>
      <h3 class="codex-sec-title">二、终局首领档案（3 位）</h3>
      <div class="codex-grid">${bossesHtml}</div>
    `;
  }

  _bindEvents() {
    // 菜单进入地图或实战演示
    document.addEventListener('click', (e) => {
      const mapBtn = e.target.closest('[data-start-map]');
      if (mapBtn) {
        sound.play('ui_click');
        this.app.loadBattle(mapBtn.dataset.startMap);
        return;
      }
      const demoBtn = e.target.closest('[data-start-demo]');
      if (demoBtn) {
        sound.play('ui_click');
        this.app.demoDirector.startDemo(demoBtn.dataset.startDemo);
        return;
      }
    });

    document.getElementById('btn-play-all-demos').addEventListener('click', () => {
      sound.play('ui_click');
      this.app.demoDirector.startDemo('demo-1', { chainAll: true });
    });

    document.getElementById('btn-exit-demo').addEventListener('click', () => {
      sound.play('ui_click');
      this.app.demoDirector.stopDemo(true);
    });

    // 图鉴开关与分页
    for (const btn of document.querySelectorAll('.js-open-codex')) {
      btn.addEventListener('click', () => {
        sound.play('ui_click');
        this.openCodex('devices');
      });
    }
    document.getElementById('btn-open-threats').addEventListener('click', () => {
      sound.play('ui_click');
      this.openCodex('threats');
    });
    document.getElementById('btn-close-codex').addEventListener('click', () => {
      sound.play('ui_click');
      this.codexModal.classList.add('hidden');
    });
    for (const tab of document.querySelectorAll('[data-codex-tab]')) {
      tab.addEventListener('click', () => {
        sound.play('ui_click');
        this.switchCodexTab(tab.dataset.codexTab);
      });
    }

    // 速度控制、视角复位与暂停菜单
    for (const sbtn of document.querySelectorAll('[data-speed]')) {
      sbtn.addEventListener('click', () => {
        if (!this.app.sim || this.app.demoDirector.isRunning()) return;
        sound.play('ui_click');
        const sp = Number(sbtn.dataset.speed);
        if (sp === 0) {
          this.app.sim.paused = !this.app.sim.paused;
        } else {
          this.app.sim.paused = false;
          this.app.sim.speedMult = sp;
        }
        this.syncTopBar();
      });
    }

    document.getElementById('btn-reset-cam').addEventListener('click', () => {
      sound.play('ui_click');
      this.app.resetCameraToDefault();
    });

    this.btnNextWave.addEventListener('click', () => {
      if (this.app.sim && !this.app.demoDirector.isRunning()) {
        sound.play('ui_click');
        this.app.sim.triggerNextWaveNow();
      }
    });

    // 音量与静音同步（菜单与战斗双端滑块联动）
    const muteBtns = document.querySelectorAll('.js-mute-btn');
    const volSliders = document.querySelectorAll('.js-vol-slider');
    const syncAudioUi = () => {
      for (const b of muteBtns) {
        const isCompact = b.classList.contains('compact-btn');
        b.textContent = sound.muted ? (isCompact ? '🔇' : '🔇 静音') : (isCompact ? '🔊' : '🔊 音效');
      }
      for (const s of volSliders) s.value = String(Math.round(sound.volume * 100));
    };
    for (const b of muteBtns) {
      b.addEventListener('click', () => {
        sound.toggleMute();
        if (!sound.muted) sound.play('ui_click');
        syncAudioUi();
      });
    }
    for (const s of volSliders) {
      s.addEventListener('input', () => {
        sound.setMuted(false);
        sound.setVolume(Number(s.value) / 100);
        syncAudioUi();
      });
    }
    syncAudioUi();

    // 暂停菜单与结算操作
    document.getElementById('btn-open-menu').addEventListener('click', () => {
      if (this.app.demoDirector.isRunning()) {
        this.app.demoDirector.stopDemo(true);
        return;
      }
      sound.play('ui_click');
      if (this.app.sim) this.app.sim.paused = true;
      this.pauseModal.classList.remove('hidden');
      this.syncTopBar();
    });

    document.getElementById('btn-resume-battle').addEventListener('click', () => {
      sound.play('ui_click');
      this.pauseModal.classList.add('hidden');
      if (this.app.sim) this.app.sim.paused = false;
      this.syncTopBar();
    });

    for (const b of document.querySelectorAll('.js-restart-map')) {
      b.addEventListener('click', () => {
        sound.play('ui_click');
        this.pauseModal.classList.add('hidden');
        this.reportModal.classList.add('hidden');
        if (this.app.currentMap) {
          this.app.loadBattle(this.app.currentMap.id);
        }
      });
    }

    for (const b of document.querySelectorAll('.js-back-select')) {
      b.addEventListener('click', () => {
        sound.play('ui_click');
        this.pauseModal.classList.add('hidden');
        this.reportModal.classList.add('hidden');
        this.app.showMainMenu();
      });
    }

    // 拦截器设定朝向取消按钮
    document.getElementById('btn-cancel-orient').addEventListener('click', () => {
      sound.play('ui_click');
      this.cancelActivePlacement();
    });

    // 底部部署栏与道具栏：支持左键按住拖放至战场部署，也支持点击选中再点击战场部署！
    this.towerDock.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.app.demoDirector.isRunning()) return;
      const card = e.target.closest('[data-tower-card]');
      if (!card) return;
      e.preventDefault();
      sound.play('ui_click');
      const id = card.dataset.towerCard;
      if (this.activeDrag && this.activeDrag.mode === 'tower' && this.activeDrag.id === id && !this.activeDrag.orienting) {
        this.cancelActivePlacement();
        return;
      }
      this.selected = null;
      this.syncSelectionPanel();
      this.activeDrag = {
        mode: 'tower',
        id,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        orienting: false,
        gx: -1,
        gz: -1,
        dirAngle: 0
      };
      this._highlightActiveCard();
    });

    this.itemDock.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.app.demoDirector.isRunning()) return;
      const card = e.target.closest('[data-item-card]');
      if (!card) return;
      e.preventDefault();
      sound.play('ui_click');
      const id = card.dataset.itemCard;
      if (this.activeDrag && this.activeDrag.mode === 'item' && this.activeDrag.id === id) {
        this.cancelActivePlacement();
        return;
      }
      this.selected = null;
      this.syncSelectionPanel();
      this.activeDrag = {
        mode: 'item',
        id,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        gx: -1,
        gz: -1
      };
      this._highlightActiveCard();
    });

    // 关闭选中面板
    document.getElementById('btn-close-inspector').addEventListener('click', () => {
      this.selected = null;
      this.app.vfx?.hidePlacementPreview();
      this.syncSelectionPanel();
    });

    // 点击新威胁识别卡片直接查阅威胁档案
    this.threatToastEl?.addEventListener('click', () => {
      sound.play('ui_click');
      this.threatToastEl.classList.add('hidden');
      this.openCodex('threats');
    });

    // 键盘快捷键：Space暂停、1/2/3调速、R或Home复位镜头、Esc取消部署或退出演示
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.app.demoDirector.isRunning() && !this.app.exportMode) {
          this.app.demoDirector.stopDemo(true);
          return;
        }
        if (this.activeDrag) {
          this.cancelActivePlacement();
          return;
        }
        if (!this.codexModal.classList.contains('hidden')) {
          this.codexModal.classList.add('hidden');
          return;
        }
        if (!this.pauseModal.classList.contains('hidden')) {
          this.pauseModal.classList.add('hidden');
          if (this.app.sim) this.app.sim.paused = false;
          this.syncTopBar();
          return;
        }
      }
      if (!this.app.sim || this.app.inMenu || this.app.demoDirector.isRunning()) return;
      if (e.key === ' ') {
        e.preventDefault();
        this.app.sim.paused = !this.app.sim.paused;
        this.syncTopBar();
      } else if (e.key === '1' || e.key === '2' || e.key === '3') {
        this.app.sim.paused = false;
        this.app.sim.speedMult = Number(e.key);
        this.syncTopBar();
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'Home') {
        this.app.resetCameraToDefault();
      }
    });
  }

  openCodex(tab = 'devices') {
    this.codexModal.classList.remove('hidden');
    this.switchCodexTab(tab);
  }

  switchCodexTab(tab) {
    this.codexTab = tab;
    for (const el of document.querySelectorAll('[data-codex-tab]')) {
      el.classList.toggle('active', el.dataset.codexTab === tab);
    }
    document.getElementById('codex-pane-devices').classList.toggle('hidden', tab !== 'devices');
    document.getElementById('codex-pane-threats').classList.toggle('hidden', tab !== 'threats');
  }

  // ==========================================================================
  // 部署拖放与拦截器朝向选择交互
  // ==========================================================================
  _highlightActiveCard() {
    for (const el of document.querySelectorAll('.dock-card')) {
      const isT = this.activeDrag?.mode === 'tower' && el.dataset.towerCard === this.activeDrag.id;
      const isI = this.activeDrag?.mode === 'item' && el.dataset.itemCard === this.activeDrag.id;
      el.classList.toggle('active-card', !!(isT || isI));
    }
    this.orientBarEl.classList.toggle('hidden', !this.activeDrag?.orienting);
  }

  cancelActivePlacement() {
    this.activeDrag = null;
    this._highlightActiveCard();
    this.cursorTipEl.classList.add('hidden');
    this.app.vfx?.clearRoutePreview();
    this.app.vfx?.hidePlacementPreview();
  }

  resetTransientUI() {
    this.cancelActivePlacement();
    this.selected = null;
    this.inspectorPanel.classList.add('hidden');
    this.bossHud.classList.add('hidden');
    this.bannerEl.classList.add('hidden');
    this.threatToastEl?.classList.add('hidden');
    this.worldHud.innerHTML = '';
    this.worldLabels.clear();
    this.floatEls.clear();
  }

  handleBattlePointerMove(clientX, clientY, hitTile, worldPoint) {
    if (!this.app.sim || !this.activeDrag || this.app.demoDirector.isRunning()) return;
    const sim = this.app.sim;

    if (Math.hypot(clientX - this.activeDrag.startX, clientY - this.activeDrag.startY) > 10) {
      this.activeDrag.moved = true;
    }

    // 若拦截器正处于朝向设定阶段：根据鼠标世界坐标实时旋转射界！
    if (this.activeDrag.orienting) {
      const wp = gridToWorld(sim.map, this.activeDrag.gx, this.activeDrag.gz, 0.56);
      if (worldPoint) {
        const dx = worldPoint.x - wp.x;
        const dz = worldPoint.z - wp.z;
        if (Math.hypot(dx, dz) > 0.15) {
          // 吸附 8 个方向或自由平滑旋转（这里采用自由平滑旋转带轻柔四向吸附感，直观精准！）
          this.activeDrag.dirAngle = Math.atan2(dx, dz);
        }
      }
      const def = TOWERS.interceptor;
      this.app.vfx.showPlacementPreview({
        wx: wp.x,
        wy: wp.y,
        wz: wp.z,
        valid: true,
        oriented: true,
        dirAngle: this.activeDrag.dirAngle,
        forwardLen: def.lv1.forwardLen,
        halfWidth: def.lv1.halfWidth
      });
      this._setCursorTip(clientX, clientY, '移动鼠标调整「拦截器」攻击朝向，左键点击确认', 'ok');
      return;
    }

    if (!hitTile) {
      this.app.vfx.hidePlacementPreview();
      this.app.vfx.clearRoutePreview();
      this.cursorTipEl.classList.add('hidden');
      return;
    }

    const { gx, gz } = hitTile;
    this.activeDrag.gx = gx;
    this.activeDrag.gz = gz;
    const tv = this.app.sceneBundle.tileVisuals.get(keyOf(gx, gz));
    const wp = gridToWorld(sim.map, gx, gz, tv ? tv.surfaceY : 0.14);

    if (this.activeDrag.mode === 'tower') {
      const def = TOWERS[this.activeDrag.id];
      const check = sim.evaluateTowerPlacement(this.activeDrag.id, gx, gz);
      const radius = def.lv1.range || def.lv1.tauntRange || 0;

      this.app.vfx.showPlacementPreview({
        wx: wp.x,
        wy: wp.y,
        wz: wp.z,
        valid: check.ok,
        radius,
        oriented: !!def.oriented,
        dirAngle: 0,
        forwardLen: def.lv1.forwardLen || 4.3,
        halfWidth: def.lv1.halfWidth || 1.55
      });

      if (check.preview) {
        this.app.vfx.showRoutePreview(check.preview, sim.entryRoutes);
      } else {
        this.app.vfx.clearRoutePreview();
      }

      if (check.ok) {
        const extra = check.isNode ? `（隔离节点并重收敛路由）` : def.oriented ? `（松手后设定朝向）` : '';
        this._setCursorTip(clientX, clientY, `可部署「${def.name}」${extra}`, 'ok');
      } else {
        this._setCursorTip(clientX, clientY, check.reason, check.blockedError ? 'danger' : 'warn');
      }
    } else if (this.activeDrag.mode === 'item') {
      const item = ITEMS[this.activeDrag.id];
      const check = sim.evaluateItemTarget(this.activeDrag.id, gx, gz);
      this.app.vfx.showPlacementPreview({
        wx: wp.x,
        wy: wp.y,
        wz: wp.z,
        valid: check.ok,
        radius: item.radius || 0.75
      });

      if (check.preview) {
        this.app.vfx.showRoutePreview(check.preview, sim.entryRoutes);
      } else {
        this.app.vfx.clearRoutePreview();
      }

      this._setCursorTip(
        clientX,
        clientY,
        check.ok ? `投放「${item.name}」` : check.reason,
        check.ok ? 'ok' : check.blockedError ? 'danger' : 'warn'
      );
    }
  }

  handleBattlePointerUp(clientX, clientY, hitTile, isOnCanvas) {
    if (!this.app.sim || !this.activeDrag || this.app.demoDirector.isRunning()) return false;
    const sim = this.app.sim;

    // 1. 拦截器朝向设定中：点击画布即正式确认朝向并完成部署！
    if (this.activeDrag.orienting) {
      if (!isOnCanvas) return false;
      const res = sim.deployTower('interceptor', this.activeDrag.gx, this.activeDrag.gz, this.activeDrag.dirAngle);
      this.cancelActivePlacement();
      if (res.ok) {
        this.selectTowerById(res.tower.id);
      }
      this.syncAll();
      return true;
    }

    // 若只是在底部卡片上单击松手（尚未拖进画布），保持选中态等待玩家点击地图位置
    if (!isOnCanvas && !this.activeDrag.moved) {
      return false;
    }

    if (!isOnCanvas || !hitTile) {
      if (this.activeDrag.moved) this.cancelActivePlacement();
      return false;
    }

    const { gx, gz } = hitTile;
    if (this.activeDrag.mode === 'tower') {
      const def = TOWERS[this.activeDrag.id];
      const check = sim.evaluateTowerPlacement(this.activeDrag.id, gx, gz);
      if (!check.ok) {
        sound.play('error');
        this.showBanner(check.reason, true);
        if (this.activeDrag.moved) this.cancelActivePlacement();
        return true;
      }

      if (def.oriented) {
        // 进入朝向设定步骤（确认前随时可右键或点按钮取消！）
        this.activeDrag.orienting = true;
        this.activeDrag.gx = gx;
        this.activeDrag.gz = gz;
        this.activeDrag.dirAngle = 0;
        this._highlightActiveCard();
        this.showBanner('请移动鼠标设定「拦截器」攻击区域朝向，左键点击确认（右键或 Esc 取消）', false);
        return true;
      }

      const res = sim.deployTower(this.activeDrag.id, gx, gz, 0);
      this.cancelActivePlacement();
      if (res.ok) this.selectTowerById(res.tower.id);
      this.syncAll();
      return true;
    }

    if (this.activeDrag.mode === 'item') {
      const res = sim.useItem(this.activeDrag.id, gx, gz);
      if (!res.ok) {
        this.showBanner(res.reason, true);
      }
      this.cancelActivePlacement();
      this.syncAll();
      return true;
    }

    return false;
  }

  _setCursorTip(x, y, text, level = 'ok') {
    this.cursorTipEl.textContent = text;
    this.cursorTipEl.className = `cursor-tip ${level}`;
    this.cursorTipEl.style.left = `${Math.min(window.innerWidth - 280, x + 18)}px`;
    this.cursorTipEl.style.top = `${Math.max(16, y - 36)}px`;
  }

  // ==========================================================================
  // 供实战演示 (DemoDirector) 调用的预览与叠加层接口
  // ==========================================================================
  showDemoTowerPreview(towerType, gx, gz) {
    const sim = this.app.sim;
    if (!sim) return;
    const check = sim.evaluateTowerPlacement(towerType, gx, gz);
    const wp = gridToWorld(sim.map, gx, gz, 0.16);
    this.app.vfx.showPlacementPreview({ wx: wp.x, wy: wp.y, wz: wp.z, valid: check.ok, radius: 0.9 });
    if (check.preview) {
      this.app.vfx.showRoutePreview(check.preview, sim.entryRoutes);
    }
    for (const el of document.querySelectorAll('.dock-card')) {
      el.classList.toggle('active-card', el.dataset.towerCard === towerType);
    }
  }

  selectItemForDemo(itemId) {
    for (const el of document.querySelectorAll('.dock-card')) {
      el.classList.toggle('active-card', el.dataset.itemCard === itemId);
    }
  }

  showDemoItemPreview(itemId, gx, gz) {
    const sim = this.app.sim;
    if (!sim) return;
    const item = ITEMS[itemId];
    const check = sim.evaluateItemTarget(itemId, gx, gz);
    const wp = gridToWorld(sim.map, gx, gz, 0.16);
    this.app.vfx.showPlacementPreview({ wx: wp.x, wy: wp.y, wz: wp.z, valid: check.ok, radius: item.radius || 1.0 });
    if (check.preview) {
      this.app.vfx.showRoutePreview(check.preview, sim.entryRoutes);
    }
  }

  clearDemoPreview() {
    this.app.vfx?.clearRoutePreview();
    this.app.vfx?.hidePlacementPreview();
    for (const el of document.querySelectorAll('.dock-card')) {
      el.classList.remove('active-card');
    }
  }

  updateDemoOverlay({ demoDef, elapsed, duration, subtitle, cursor }) {
    document.body.classList.add('demo-active');
    this.demoOverlay.classList.remove('hidden');
    this.demoTitleEl.textContent = `实战演示 0${demoDef.index}/03 · ${demoDef.title} (${elapsed.toFixed(1)}s / ${duration.toFixed(1)}s)`;
    this.demoProgEl.style.width = `${Math.min(100, (elapsed / duration) * 100)}%`;
    this.demoSubEl.textContent = subtitle || '';

    if (cursor) {
      this.demoCursorEl.style.left = `${cursor.x}px`;
      this.demoCursorEl.style.top = `${cursor.y}px`;
      this.demoCursorEl.classList.toggle('pressing', !!cursor.down);
      if (cursor.label) {
        this.demoCursorTag.textContent = cursor.label;
        this.demoCursorTag.classList.remove('hidden');
      } else {
        this.demoCursorTag.classList.add('hidden');
      }
    }
  }

  hideDemoOverlay() {
    document.body.classList.remove('demo-active');
    this.demoOverlay.classList.add('hidden');
    if (this.threatToastEl) this.threatToastEl.classList.add('hidden');
  }

  // ==========================================================================
  // 点选查看塔、敌人、首领与地块详情（2.10.4 & 3.7）
  // ==========================================================================
  selectTowerById(towerId) {
    this.selected = { kind: 'tower', id: towerId };
    this.syncSelectionPanel();
  }

  handleCanvasPick(pickInfo) {
    if (!this.app.sim || this.app.demoDirector.isRunning()) return;
    if (!pickInfo) {
      this.selected = null;
      this.app.vfx.hidePlacementPreview();
      this.syncSelectionPanel();
      return;
    }

    sound.play('ui_click');
    if (pickInfo.pickType === 'tower') {
      this.selected = { kind: 'tower', id: pickInfo.towerId };
    } else if (pickInfo.pickType === 'enemy') {
      this.selected = { kind: 'enemy', id: pickInfo.enemyId };
    } else if (pickInfo.pickType === 'tile') {
      // 若格子上已有塔，优先选中该塔！
      const tw = this.app.sim.towers.find((t) => !t.dead && t.gx === pickInfo.gx && t.gz === pickInfo.gz);
      if (tw) {
        this.selected = { kind: 'tower', id: tw.id };
      } else {
        this.selected = { kind: 'tile', gx: pickInfo.gx, gz: pickInfo.gz };
      }
    }
    this.syncSelectionPanel();
  }

  syncSelectionPanel() {
    const sim = this.app.sim;
    if (!sim || !this.selected) {
      this.inspectorPanel.classList.add('hidden');
      return;
    }

    if (this.selected.kind === 'tower') {
      const t = sim.towers.find((x) => !x.dead && x.id === this.selected.id);
      if (!t) {
        this.selected = null;
        this.inspectorPanel.classList.add('hidden');
        this.app.vfx.hidePlacementPreview();
        return;
      }

      const stats = sim.getTowerStats(t);
      const titleName = t.level >= 2 ? stats.name : t.def.name;

      // 在场上高亮该塔的作用范围或射界
      if (!this.activeDrag) {
        this.app.vfx.showPlacementPreview({
          wx: t.x,
          wy: t.y,
          wz: t.z,
          valid: true,
          radius: stats.range || stats.tauntRange || 0,
          oriented: !!t.def.oriented,
          dirAngle: t.dirAngle,
          forwardLen: stats.forwardLen || 4.3,
          halfWidth: stats.halfWidth || 1.55
        });
      }

      const maxBlk = t.onNode ? (stats.nodeBlockCap ?? 0) : (stats.blockCap ?? 0);
      let usedBlk = 0;
      for (const eid of t.blockedIds) {
        const en = sim.enemies.find((x) => x.id === eid);
        if (en) usedBlk += en.def.blockCost || 1;
      }

      const statusChips = [];
      if (t.encryptTimer > 0) statusChips.push(`<span class="st-chip enc">🔒 勒索加密 (${t.encryptTimer.toFixed(1)}s)</span>`);
      if (t.def.immuneEncrypt) statusChips.push(`<span class="st-chip ok">🛡 免疫加密</span>`);
      if (t.shield > 1) statusChips.push(`<span class="st-chip shd">能量护盾 ${Math.round(t.shield)}</span>`);
      if (t.onNode) statusChips.push(`<span class="st-chip warn">节点隔离执勤中</span>`);
      if (maxBlk > 0) statusChips.push(`<span class="st-chip">阻挡占用 ${usedBlk}/${maxBlk}</span>`);

      let upgradeSection = '';
      if (t.level === 1) {
        if (t.def.branches) {
          const bA = t.def.branches.A;
          const bB = t.def.branches.B;
          upgradeSection = `
            <div class="insp-sec-label">选择 2 级专精分支（二选一）：</div>
            <div class="branch-choice-grid">
              <button class="branch-btn" data-up-branch="A">
                <div class="b-title">分支 A · ${bA.name}</div>
                <div class="b-cost">⚡${bA.costCompute} 算力 · ◈${bA.costIntel} 情报</div>
                <div class="b-desc">${bA.desc}</div>
              </button>
              <button class="branch-btn" data-up-branch="B">
                <div class="b-title">分支 B · ${bB.name}</div>
                <div class="b-cost">⚡${bB.costCompute} 算力 · ◈${bB.costIntel} 情报</div>
                <div class="b-desc">${bB.desc}</div>
              </button>
            </div>
          `;
        } else {
          const lv2 = t.def.lv2;
          upgradeSection = `
            <button class="os-btn primary full-btn" id="btn-upgrade-tower">
              ▲ 升至 2 级「${lv2.name}」 (⚡${lv2.costCompute} 算力)
            </button>
            <div class="insp-note">${lv2.desc}</div>
          `;
        }
      } else {
        upgradeSection = `<div class="insp-maxed">★ 已达最高等级（${titleName}）</div>`;
      }

      const sk = t.def.skill;
      const skReady = t.skillCd <= 0 && t.encryptTimer <= 0;
      const skLabel = t.encryptTimer > 0
        ? `🔒 加密停火中 (${t.encryptTimer.toFixed(1)}s)`
        : t.skillCd > 0
          ? `技能「${sk.name}」冷却 ${t.skillCd.toFixed(1)}s`
          : `✦ 释放技能「${sk.name}」`;

      const refund = Math.round(t.investedCompute * SELL_REFUND_RATIO);

      this.inspectorPanel.classList.remove('hidden');
      this.inspectorBody.innerHTML = `
        <div class="insp-head">
          <div class="insp-icon">${ICONS[t.type]}</div>
          <div>
            <div class="insp-title">${titleName} <span class="badge">Lv.${t.level}${t.branch ? t.branch : ''}</span></div>
            <div class="insp-sub">${t.def.role}</div>
          </div>
        </div>
        <div class="insp-hp-bar">
          <div class="insp-hp-fill" style="width:${(t.hp / t.maxHp) * 100}%"></div>
          <span>结构耐久 ${Math.ceil(t.hp)} / ${t.maxHp}</span>
        </div>
        <div class="insp-chips">${statusChips.join('')}</div>
        <p class="insp-desc">${stats.desc}</p>
        <div class="insp-actions">
          <button class="os-btn accent full-btn ${skReady ? '' : 'disabled'}" id="btn-cast-skill">${skLabel}</button>
          <div class="insp-note">技能说明：${sk.desc}</div>
          ${upgradeSection}
          <button class="os-btn danger-outline full-btn" id="btn-retreat-tower">撤下设备（退还 ⚡${refund} 算力）</button>
        </div>
      `;

      document.getElementById('btn-cast-skill')?.addEventListener('click', () => {
        if (this.app.demoDirector.isRunning()) return;
        const r = sim.castTowerSkill(t.id);
        if (!r.ok) this.showBanner(r.reason, true);
        this.syncSelectionPanel();
      });

      document.getElementById('btn-upgrade-tower')?.addEventListener('click', () => {
        if (this.app.demoDirector.isRunning()) return;
        const r = sim.upgradeTower(t.id);
        if (!r.ok) this.showBanner(r.reason, true);
        this.syncAll();
      });

      for (const bb of this.inspectorBody.querySelectorAll('[data-up-branch]')) {
        bb.addEventListener('click', () => {
          if (this.app.demoDirector.isRunning()) return;
          const r = sim.upgradeTower(t.id, bb.dataset.upBranch);
          if (!r.ok) this.showBanner(r.reason, true);
          this.syncAll();
        });
      }

      document.getElementById('btn-retreat-tower')?.addEventListener('click', () => {
        if (this.app.demoDirector.isRunning()) return;
        sim.retreatTower(t.id);
        this.selected = null;
        this.app.vfx.hidePlacementPreview();
        this.syncAll();
      });
      return;
    }

    if (this.selected.kind === 'enemy') {
      const e = sim.enemies.find((x) => !x.dead && x.id === this.selected.id);
      if (!e) {
        this.selected = null;
        this.inspectorPanel.classList.add('hidden');
        return;
      }
      const st = [];
      if (e.disguised) st.push(`<span class="st-chip enc">👁 流量伪装中(单体不可选)</span>`);
      else if (e.def.startsDisguised) st.push(`<span class="st-chip ok">已显形</span>`);
      if (e.shield > 1) st.push(`<span class="st-chip shd">护盾 ${Math.round(e.shield)}</span>`);
      if (e.snareTimer > 0) st.push(`<span class="st-chip warn">诱捕定身 ${e.snareTimer.toFixed(1)}s</span>`);
      if (e.isBoss) st.push(`<span class="st-chip warn">当前阶段：第 ${e.bossPhase} 阶段</span>`);

      this.inspectorPanel.classList.remove('hidden');
      this.inspectorBody.innerHTML = `
        <div class="insp-head">
          <div class="insp-icon" style="color:${e.def.cssColor}">${ICONS.enemy}</div>
          <div>
            <div class="insp-title">${e.def.name}</div>
            <div class="insp-sub">${e.def.badge || e.def.title || '敌方威胁'}</div>
          </div>
        </div>
        <div class="insp-hp-bar enemy">
          <div class="insp-hp-fill" style="width:${(e.hp / e.maxHp) * 100}%"></div>
          <span>生命 ${Math.ceil(e.hp)} / ${e.maxHp}</span>
        </div>
        <div class="insp-chips">${st.join('')}</div>
        <div class="insp-note">移速：${e.speed} | 阻挡占用：${e.flying ? '飞行' : e.def.blockCost} | 侵入伤害：-${e.def.coreDamage}</div>
        <p class="insp-desc">${e.def.desc}</p>
      `;
      return;
    }

    if (this.selected.kind === 'tile') {
      const { gx, gz } = this.selected;
      const t = sim.map.grid[gz]?.[gx];
      const k = keyOf(gx, gz);
      const wp = gridToWorld(sim.map, gx, gz, 0.16);
      this.app.vfx.showPlacementPreview({ wx: wp.x, wy: wp.y, wz: wp.z, valid: true, radius: 0 });

      let docId = 'link';
      if (t === TILE.LEGACY) docId = 'legacy';
      else if (t === TILE.NODE) docId = 'node';
      else if (t === TILE.PLATFORM) docId = 'platform';
      else if (t === TILE.OBSTACLE) docId = 'obstacle';
      const doc = TERRAIN_DOCS.find((d) => d.id === docId) || TERRAIN_DOCS[0];

      let extraHtml = '';
      if (t === TILE.NODE) {
        const ns = sim.nodeStates.get(k);
        const stText = ns?.isolated
          ? `<span class="st-chip warn">状态：已隔离锁闭（截断通行）</span>`
          : ns?.reisolateCd > 0
            ? `<span class="st-chip enc">状态：直通 · 再次隔离冷却 ${ns.reisolateCd.toFixed(1)}s</span>`
            : `<span class="st-chip ok">状态：直通开放</span>`;
        extraHtml = `
          <div class="insp-chips">${stText}</div>
          <div class="insp-note"><strong>${ns?.nodeInfo?.name || '交换节点'}：</strong>${ns?.nodeInfo?.desc || ''}</div>
        `;
      } else if ((sim.downgradedTiles.get(k) || 0) > 0) {
        extraHtml = `<div class="insp-chips"><span class="st-chip warn">协议降级生效中 (${sim.downgradedTiles.get(k).toFixed(1)}s)</span></div>`;
      }

      this.inspectorPanel.classList.remove('hidden');
      this.inspectorBody.innerHTML = `
        <div class="insp-head">
          <div>
            <div class="insp-title">${doc.name} <span class="badge">(${gx}, ${gz})</span></div>
            <div class="insp-sub">${doc.badge}</div>
          </div>
        </div>
        ${extraHtml}
        <p class="insp-desc">${doc.desc}</p>
      `;
    }
  }

  // ==========================================================================
  // 常驻面板同步（资源、波次、流量预报、首领血条、日志、三维投影血条与飘字）
  // ==========================================================================
  syncAll() {
    this.syncTopBar();
    this.syncForecast();
    this.syncItemDock();
    this.syncLogs();
    this.syncSelectionPanel();
  }

  syncTopBar() {
    const sim = this.app.sim;
    if (!sim) return;
    this.elMapTitle.textContent = `汐域 // ${sim.map.name}`;
    this.elIntegrity.textContent = `${sim.integrity} / ${sim.maxIntegrity}`;
    this.elCompute.textContent = `${Math.floor(sim.compute)}`;
    this.elIntel.textContent = `${Math.floor(sim.intel)}`;

    const dispWave = Math.min(sim.waveIndex + 1, sim.map.waves.length);
    const wDef = sim.map.waves[dispWave - 1];
    this.elWave.textContent = `波次 ${dispWave}/${sim.map.waves.length} · ${wDef ? wDef.title : ''}`;

    if (sim.waveState === 'prep' && !this.app.demoDirector.isRunning()) {
      this.btnNextWave.classList.remove('hidden');
      this.btnNextWave.textContent = `立即迎击 (${Math.ceil(sim.prepTimer)}s)`;
    } else {
      this.btnNextWave.classList.add('hidden');
    }

    for (const sbtn of document.querySelectorAll('[data-speed]')) {
      const sp = Number(sbtn.dataset.speed);
      const active = sp === 0 ? sim.paused : !sim.paused && sim.speedMult === sp;
      sbtn.classList.toggle('active', active);
    }

    // 首领顶部醒目生命与阶段栏
    const activeBoss = sim.enemies.find((e) => !e.dead && e.isBoss);
    if (activeBoss) {
      this.bossHud.classList.remove('hidden');
      const phaseNames = {
        wankuai: ['阶段一：洪峰统御', '阶段二：傀儡裂变'],
        shenlou: ['阶段一：伪路由劫持', '阶段二：路由风暴'],
        zheying: ['阶段一：暗影潜伏', '阶段二：重甲提权', '阶段三：工控破坏']
      }[activeBoss.type] || ['首领交战中'];
      const pLabel = phaseNames[(activeBoss.bossPhase || 1) - 1] || phaseNames[0];
      document.getElementById('boss-bar-name').textContent = `${activeBoss.def.name} · ${pLabel}`;
      document.getElementById('boss-bar-hp').textContent = `${Math.ceil(activeBoss.hp)} / ${activeBoss.maxHp}`;
      document.getElementById('boss-bar-fill').style.width = `${(activeBoss.hp / activeBoss.maxHp) * 100}%`;
    } else {
      this.bossHud.classList.add('hidden');
    }
  }

  // “流量预报”：按各入口清晰列出本波/下一波来袭威胁及当前通往的出口中枢（2.1.4 & 2.12.1）
  syncForecast() {
    const sim = this.app.sim;
    if (!sim) return;
    const wIdx = Math.min(sim.waveIndex, sim.map.waves.length - 1);
    const waveDef = sim.map.waves[wIdx];
    if (!waveDef) return;

    const byEntry = {};
    for (const ent of sim.map.entries) byEntry[ent.id] = {};
    for (const g of waveDef.groups) {
      if (!byEntry[g.entry]) byEntry[g.entry] = {};
      byEntry[g.entry][g.type] = (byEntry[g.entry][g.type] || 0) + g.count;
    }

    this.forecastBody.innerHTML = sim.map.entries
      .map((ent) => {
        const col = ENTRY_COLORS[ent.id] || ENTRY_COLORS.A;
        const route = sim.entryRoutes[ent.id];
        const exObj = sim.map.exits.find((x) => x.id === route?.exitId);
        const destName = exObj ? exObj.name : '中枢';
        const threats = byEntry[ent.id] || {};
        const keys = Object.keys(threats);
        const chips =
          keys.length === 0
            ? `<span class="fc-idle">正常业务流（无恶意载荷）</span>`
            : keys
                .map((tp) => {
                  const ed = ENEMIES[tp] || BOSSES[tp];
                  return `<span class="fc-threat-chip" data-open-threat="1" style="border-color:${ed.cssColor}">
                    <i style="background:${ed.cssColor}"></i>${ed.name} ×${threats[tp]}
                  </span>`;
                })
                .join('');

        return `
          <div class="fc-entry-row">
            <div class="fc-entry-head">
              <span class="fc-port-dot" style="background:${col.css}"></span>
              <strong>入口 ${ent.id} · ${ent.name}</strong>
              <span class="fc-dest">➔ ${destName}</span>
            </div>
            <div class="fc-chips">${chips}</div>
          </div>
        `;
      })
      .join('');

    for (const chip of this.forecastBody.querySelectorAll('[data-open-threat]')) {
      chip.addEventListener('click', () => {
        this.openCodex('threats');
      });
    }
  }

  syncItemDock() {
    const sim = this.app.sim;
    if (!sim) return;
    for (const id of Object.keys(ITEMS)) {
      const it = ITEMS[id];
      const cd = sim.itemCooldowns[id] || 0;
      const mask = document.getElementById(`item-cd-mask-${id}`);
      const txt = document.getElementById(`item-cd-txt-${id}`);
      if (mask) mask.style.height = cd > 0 ? `${(cd / it.cooldown) * 100}%` : '0%';
      if (txt) txt.textContent = cd > 0 ? `${cd.toFixed(1)}s` : '就绪';
    }

    // 根据资源标记卡片是否可支付
    for (const card of this.towerDock.querySelectorAll('[data-tower-card]')) {
      const def = TOWERS[card.dataset.towerCard];
      card.classList.toggle('unaffordable', sim.compute < def.costCompute);
    }
    for (const card of this.itemDock.querySelectorAll('[data-item-card]')) {
      const it = ITEMS[card.dataset.itemCard];
      const lack = it.costType === 'intel' ? sim.intel < it.cost : sim.compute < it.cost;
      card.classList.toggle('unaffordable', lack || (sim.itemCooldowns[it.id] || 0) > 0);
    }
  }

  syncLogs() {
    const sim = this.app.sim;
    if (!sim) return;
    this.logList.innerHTML = sim.logs
      .slice(0, 5)
      .map((lg) => `<div class="log-item lv-${lg.level.toLowerCase()}">[${lg.level}] ${lg.text}</div>`)
      .join('');
  }

  showBanner(text, critical = false) {
    this.bannerEl.textContent = text;
    this.bannerEl.className = `center-banner ${critical ? 'critical' : ''}`;
    clearTimeout(this._bannerTid);
    this._bannerTid = setTimeout(() => {
      this.bannerEl.classList.add('hidden');
    }, 3400);
  }

  showThreatToast(def) {
    if (!this.threatToastEl || !def) return;
    this.threatToastEl.innerHTML = `
      <div class="tt-head">
        <span>⚠ 新威胁首次侦测</span>
        <small>点击查档案 ➔</small>
      </div>
      <div class="tt-name" style="color:${def.cssColor || '#fda4af'}">${def.name} <span class="badge">${def.badge || def.title || '高危'}</span></div>
      <div class="tt-desc">${def.desc}</div>
    `;
    this.threatToastEl.classList.remove('hidden');
    clearTimeout(this._toastTid);
    this._toastTid = setTimeout(() => {
      this.threatToastEl.classList.add('hidden');
    }, 5200);
  }

  // 每帧更新场上单位屏幕投影血条、护盾条、状态图标与伤害跳字（2.12.2 & 2.12.3）
  updateWorldProjections(camera) {
    const sim = this.app.sim;
    if (!sim || this.app.inMenu) {
      this.worldHud.innerHTML = '';
      this.worldLabels.clear();
      this.floatEls.clear();
      return;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    const activeKeys = new Set();
    const tmpV = new THREE.Vector3();

    const project = (wx, wy, wz) => {
      tmpV.set(wx, wy, wz).project(camera);
      if (tmpV.z > 1) return null;
      return {
        x: (tmpV.x * 0.5 + 0.5) * w,
        y: (-tmpV.y * 0.5 + 0.5) * h
      };
    };

    const upsertBar = (key, pos, html, cls = 'unit-hud-tag') => {
      if (!pos || pos.x < -60 || pos.x > w + 60 || pos.y < -40 || pos.y > h + 40) return;
      activeKeys.add(key);
      let el = this.worldLabels.get(key);
      if (!el) {
        el = document.createElement('div');
        el.className = cls;
        this.worldHud.appendChild(el);
        this.worldLabels.set(key, el);
      }
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      if (el.dataset.prevHtml !== html) {
        el.innerHTML = html;
        el.dataset.prevHtml = html;
      }
    };

    // 1. 己方塔状态条（受损、有护盾、被加密、正在阻挡或被选中时显示清晰血条与阻挡/加密标识）
    for (const t of sim.towers) {
      if (t.dead) continue;
      const stats = sim.getTowerStats(t);
      const maxBlk = t.onNode ? (stats.nodeBlockCap ?? 0) : (stats.blockCap ?? 0);
      const isSelected = this.selected?.kind === 'tower' && this.selected.id === t.id;
      const show =
        t.hp < t.maxHp * 0.99 ||
        t.shield > 1 ||
        t.encryptTimer > 0 ||
        t.blockedIds.size > 0 ||
        isSelected;
      if (!show) continue;

      const pos = project(t.x, t.y + 1.28, t.z);
      const hpPct = Math.max(0, Math.min(100, (t.hp / t.maxHp) * 100));
      const shPct = Math.max(0, Math.min(100, (t.shield / t.maxHp) * 100));
      const badges = [];
      if (t.encryptTimer > 0) badges.push(`<span class="mini-tag enc">🔒加密</span>`);
      if (maxBlk > 0 && t.blockedIds.size > 0) {
        let used = 0;
        for (const eid of t.blockedIds) {
          const en = sim.enemies.find((x) => x.id === eid);
          if (en) used += en.def.blockCost || 1;
        }
        badges.push(`<span class="mini-tag blk">阻挡 ${used}/${maxBlk}</span>`);
      }

      const html = `
        ${badges.length ? `<div class="mini-badges">${badges.join('')}</div>` : ''}
        <div class="whp-track friendly">
          <div class="whp-fill" style="width:${hpPct}%"></div>
          ${shPct > 0 ? `<div class="wsh-fill" style="width:${shPct}%"></div>` : ''}
        </div>
      `;
      upsertBar(`tw_${t.id}`, pos, html);
    }

    // 2. 应急隔离器耐久与倒计时条
    for (const iso of sim.isolators) {
      if (iso.dead) continue;
      const pos = project(iso.x, 1.15, iso.z);
      const hpPct = Math.max(0, (iso.hp / iso.maxHp) * 100);
      const tmPct = Math.max(0, (iso.timer / iso.maxTimer) * 100);
      const html = `
        <div class="mini-badges"><span class="mini-tag warn">隔离器 ${iso.timer.toFixed(0)}s</span></div>
        <div class="whp-track isolator"><div class="whp-fill" style="width:${hpPct}%"></div></div>
        <div class="wtm-track"><div class="wtm-fill" style="width:${tmPct}%"></div></div>
      `;
      upsertBar(`iso_${iso.id}`, pos, html);
    }

    // 3. 敌方与首领状态条（避免过多满血普通小兵遮挡路线：受损、有护盾、伪装、定身、改道转向或首领显示）
    for (const e of sim.enemies) {
      if (e.dead || e.dyingTimer > 0) continue;
      const show =
        e.isBoss ||
        e.hp < e.maxHp * 0.99 ||
        e.shield > 1 ||
        e.disguised ||
        e.snareTimer > 0 ||
        e.rerouteIconTimer > 0;
      if (!show) continue;

      const yOff = e.flying ? 2.15 : e.isBoss ? 2.1 : 0.95;
      const pos = project(e.x, yOff, e.z);
      const hpPct = Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100));
      const shPct = Math.max(0, Math.min(100, (e.shield / e.maxHp) * 100));

      const tags = [];
      if (e.rerouteIconTimer > 0) tags.push(`<span class="mini-tag turn">↻ 改道</span>`);
      if (e.disguised) tags.push(`<span class="mini-tag dis">伪装</span>`);
      if (e.snareTimer > 0) tags.push(`<span class="mini-tag warn">定身</span>`);

      const html = `
        ${tags.length ? `<div class="mini-badges">${tags.join('')}</div>` : ''}
        <div class="whp-track enemy ${e.isBoss ? 'boss' : ''}">
          <div class="whp-fill" style="width:${hpPct}%"></div>
          ${shPct > 0 ? `<div class="wsh-fill enemy-sh" style="width:${shPct}%"></div>` : ''}
        </div>
      `;
      upsertBar(`en_${e.id}`, pos, html);
    }

    for (const [k, el] of this.worldLabels.entries()) {
      if (!activeKeys.has(k)) {
        el.remove();
        this.worldLabels.delete(k);
      }
    }

    // 4. 伤害、治疗与事件飘字
    const activeFloatIds = new Set();
    for (const ft of sim.floatingTexts) {
      const pos = project(ft.x, ft.y, ft.z);
      if (!pos) continue;
      activeFloatIds.add(ft.id);
      let el = this.floatEls.get(ft.id);
      if (!el) {
        el = document.createElement('div');
        el.className = `world-float-txt ${ft.big ? 'big' : ''}`;
        el.style.color = ft.color;
        el.textContent = ft.text;
        this.worldHud.appendChild(el);
        this.floatEls.set(ft.id, el);
      }
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      el.style.opacity = String(Math.min(1, (ft.timer / ft.maxTimer) * 1.4));
    }
    for (const [fid, el] of this.floatEls.entries()) {
      if (!activeFloatIds.has(fid)) {
        el.remove();
        this.floatEls.delete(fid);
      }
    }
  }

  // ==========================================================================
  // 结算「事件报告」(Incident Report — 2.1.4 & 2.9.4)
  // ==========================================================================
  showIncidentReport(victory) {
    const sim = this.app.sim;
    if (!sim || this.app.demoDirector.isRunning()) return;

    this.reportModal.classList.remove('hidden');
    const stamp = document.getElementById('report-stamp');
    stamp.textContent = victory ? '事件结案 // 威胁全面肃清' : '严重事故 // 中枢数据失守';
    stamp.className = `report-stamp ${victory ? 'win' : 'lose'}`;

    const summary = victory
      ? `守护进程成功抵御攻击组织「蛰影」对自治域「汐域 · ${sim.map.name}」的全部 ${sim.map.waves.length} 波入侵，各入口业务连通保持稳定，中枢数据完整保留。`
      : `恶意程序突破防线涌入核心出口，中枢完整度降至 0。建议复盘节点隔离时机、利用沙箱提前显形木马并保护关键修复单元。`;

    document.getElementById('report-summary-text').textContent = summary;
    document.getElementById('report-stats-grid').innerHTML = `
      <div class="rep-stat"><span>中枢剩余完整度</span><strong>${sim.integrity} / ${sim.maxIntegrity}</strong></div>
      <div class="rep-stat"><span>拦截清除恶意载荷</span><strong>${sim.stats.kills} 个</strong></div>
      <div class="rep-stat"><span>触发动态路由收敛</span><strong>${sim.stats.routeShifts} 次</strong></div>
      <div class="rep-stat"><span>执行节点隔离调度</span><strong>${sim.stats.nodeIsolations} 次</strong></div>
      <div class="rep-stat"><span>损毁守护设备数</span><strong>${sim.stats.towersLost} 座</strong></div>
      <div class="rep-stat"><span>累计算力 / 情报获取</span><strong>⚡${Math.round(sim.stats.computeEarned)} / ◈${sim.stats.intelEarned}</strong></div>
    `;
  }
}
