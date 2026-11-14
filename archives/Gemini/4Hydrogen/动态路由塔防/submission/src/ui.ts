import { audio } from './audio';
import {
  ENEMY_CONFIGS,
  GAME_CONSTANTS,
  ITEM_CONFIGS,
  STATUS_DOCS,
  TOWER_CONFIGS,
} from './config';
import type { DemoController, DemoId } from './demos';
import type { GameEngine } from './engine';
import { getEnemySvg, getItemSvg, getTowerSvg } from './icons';
import { MAP_DEFS, MAP_ORDER } from './maps';
import { charToTileType, keyOf } from './pathfinding';
import type { HoverIntent, SceneManager } from './scene';
import type {
  Direction,
  EnemyEntity,
  EnemyType,
  ItemId,
  MapId,
  TileState,
  TowerEntity,
  TowerType,
} from './types';

type SelectionTarget =
  | { kind: 'none' }
  | { kind: 'tower'; id: number }
  | { kind: 'enemy'; id: number }
  | { kind: 'tile'; x: number; y: number };

type DragPayload =
  | { kind: 'tower'; towerType: TowerType }
  | { kind: 'item'; itemId: ItemId };

export class UIController {
  private engine: GameEngine;
  private scene: SceneManager;
  private demos: DemoController;

  private selection: SelectionTarget = { kind: 'none' };
  private armedPayload: DragPayload | null = null;
  private draggingPayload: DragPayload | null = null;
  private dragStartPos: { x: number; y: number } | null = null;

  private pendingOrient: {
    x: number;
    y: number;
    dir: Direction;
  } | null = null;

  private middleDragging = false;
  private lastPointer = { x: 0, y: 0 };
  private currentHoverGrid: { x: number; y: number } | null = null;
  private currentHoverIntent: HoverIntent | null = null;
  private settlementShown = false;
  private forecastCollapsed = false;
  private activeCompendiumTab: 'devices' | 'threats' | 'terrain' = 'devices';

  // DOM refs
  private menuScreen = document.getElementById('menu-screen')!;
  private battleHud = document.getElementById('battle-hud')!;
  private mapCardsEl = document.getElementById('map-cards')!;
  private inspectorPanel = document.getElementById('inspector-panel')!;
  private inspectorTitle = document.getElementById('inspector-title')!;
  private inspectorBody = document.getElementById('inspector-body')!;
  private orientBar = document.getElementById('orient-bar')!;
  private dragGhost = document.getElementById('drag-ghost')!;
  private hoverTooltip = document.getElementById('hover-tooltip')!;
  private routeDeltaBanner = document.getElementById('route-delta-banner')!;
  private alertsStack = document.getElementById('alerts-stack')!;
  private pauseModal = document.getElementById('pause-modal')!;
  private reportModal = document.getElementById('report-modal')!;
  private compendiumModal = document.getElementById('compendium-modal')!;
  private audioModal = document.getElementById('audio-modal')!;
  private demoOverlay = document.getElementById('demo-overlay')!;
  private demoCursor = document.getElementById('demo-cursor')!;
  private demoCursorBadge = document.getElementById('demo-cursor-badge')!;

  private lastForecastKey = '';
  private lastHoverSyncMs = 0;
  private lastInspectorKey = '';

  constructor(engine: GameEngine, scene: SceneManager, demos: DemoController) {
    this.engine = engine;
    this.scene = scene;
    this.demos = demos;

    this.renderMapCards();
    this.renderDeploymentDock();
    this.bindEvents();
    this.syncAudioUI();
  }

  private renderMapCards(): void {
    this.mapCardsEl.innerHTML = '';
    for (const id of MAP_ORDER) {
      const m = MAP_DEFS[id];
      const card = document.createElement('div');
      card.className = 'map-card';
      card.innerHTML = `
        <div class="map-card-top">
          <div>
            <div class="mono-dim">${m.networkTag}</div>
            <div class="map-card-title">${m.name}</div>
            <div class="map-card-sub">${m.subtitle}</div>
          </div>
          <span class="map-diff-badge">${m.difficulty}</span>
        </div>
        <div class="map-minimap-wrap">
          <div class="map-minimap">${this.buildMinimapSvg(id)}</div>
          <div class="map-minimap-legend">
            <span><i style="background:#38bdf8"></i>入口</span>
            <span><i style="background:#34d399"></i>核心</span>
            <span><i style="background:#10b981;transform:rotate(45deg)"></i>节点</span>
            <span><i style="background:#9a3412"></i>旧链路</span>
            <span><i style="background:#475569"></i>平台</span>
          </div>
        </div>
        <p class="map-card-desc">${m.description}</p>
        <div class="map-card-tip">💡 ${m.tacticalTip}</div>
        <button class="btn btn-primary" data-start-map="${id}">▶ 接入防区作战</button>
      `;
      this.mapCardsEl.appendChild(card);
    }
  }

  private buildMinimapSvg(mapId: MapId): string {
    const m = MAP_DEFS[mapId];
    const cw = 20;
    const ch = 16;
    const vw = m.cols * cw;
    const vh = m.rows * ch;
    let shapes = '';
    for (let y = 0; y < m.rows; y++) {
      for (let x = 0; x < m.cols; x++) {
        const chCode = m.grid[y][x];
        const t = charToTileType(chCode);
        if (t === 'void') continue;
        let fill = '#0f172a';
        if (t === 'link') fill = '#1e3a5f';
        else if (t === 'legacy') fill = '#78350f';
        else if (t === 'platform') fill = '#334155';
        else if (t === 'node') fill = '#065f46';
        else if (t === 'entry') fill = '#0284c7';
        else if (t === 'exit') fill = '#059669';
        else if (t === 'obstacle') {
          fill = mapId === 'backbone' && (y === 3 || y === 4) ? '#1d4ed8' : '#090f1d';
        }
        const px = x * cw + 1;
        const py = y * ch + 1;
        const pw = cw - 2;
        const ph = ch - 2;
        shapes += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="2" fill="${fill}"/>`;
        if (t === 'node') {
          const cx = x * cw + cw * 0.5;
          const cy = y * ch + ch * 0.5;
          shapes += `<polygon points="${cx},${cy - 4.5} ${cx + 4.5},${cy} ${cx},${cy + 4.5} ${cx - 4.5},${cy}" fill="#34d399"/>`;
        } else if (t === 'entry' || t === 'exit') {
          const cx = x * cw + cw * 0.5;
          const cy = y * ch + ch * 0.5 + 3.5;
          shapes += `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="10" font-weight="800" fill="#ffffff" font-family="monospace">${chCode}</text>`;
        }
      }
    }
    return `<svg viewBox="0 0 ${vw} ${vh}" width="100%" height="100%">${shapes}</svg>`;
  }

  private renderDeploymentDock(): void {
    const dockDef = document.getElementById('dock-defense')!;
    const dockSup = document.getElementById('dock-support')!;
    const dockItem = document.getElementById('dock-items')!;

    dockDef.innerHTML = '';
    dockSup.innerHTML = '';
    dockItem.innerHTML = '';

    const towerOrder: TowerType[] = [
      'firewall',
      'honeypot',
      'gate',
      'interceptor',
      'sandbox',
      'repair',
    ];
    for (const type of towerOrder) {
      const cfg = TOWER_CONFIGS[type];
      const card = document.createElement('div');
      card.className = 'deploy-card';
      card.dataset.cardTower = type;
      card.style.color = cfg.colorHex;
      card.innerHTML = `
        <div class="deploy-card-icon">${getTowerSvg(type)}</div>
        <div class="deploy-card-name">${cfg.name}</div>
        <div class="deploy-card-costs">
          <span class="cost-c">${cfg.computeCost}算</span>
          ${cfg.nodeIntelCost > 0 ? `<span class="cost-i">+${cfg.nodeIntelCost}情</span>` : ''}
        </div>
      `;
      this.attachCardEvents(card, { kind: 'tower', towerType: type }, () => {
        return `<strong>${cfg.name}</strong> · ${cfg.role}<br/>${cfg.shortDesc}<br/><span style="color:#38bdf8">消耗：${cfg.computeCost} 算力${
          cfg.nodeIntelCost > 0 ? `（隔离节点另需 ${cfg.nodeIntelCost} 情报）` : ''
        }</span>`;
      });
      if (cfg.category === 'defense') dockDef.appendChild(card);
      else dockSup.appendChild(card);
    }

    const itemOrder: ItemId[] = ['isolator', 'downgrade', 'restore'];
    for (const id of itemOrder) {
      const cfg = ITEM_CONFIGS[id];
      const card = document.createElement('div');
      card.className = 'deploy-card';
      card.dataset.cardItem = id;
      card.style.color = cfg.colorHex;
      card.innerHTML = `
        <div class="deploy-card-icon">${getItemSvg(id)}</div>
        <div class="deploy-card-name">${cfg.name}</div>
        <div class="deploy-card-costs">
          <span class="${cfg.resource === 'intel' ? 'cost-i' : 'cost-c'}">${cfg.cost}${
        cfg.resource === 'intel' ? '情' : '算'
      }</span>
        </div>
        <div class="deploy-card-cd hidden" data-item-cd="${id}"></div>
      `;
      this.attachCardEvents(card, { kind: 'item', itemId: id }, () => {
        return `<strong>${cfg.name}</strong> · 目标：${cfg.targetLabel}<br/>${cfg.shortDesc}<br/><span style="color:#fbbf24">消耗：${cfg.cost} ${
          cfg.resource === 'intel' ? '情报' : '算力'
        } · 冷却 ${cfg.cooldown}秒</span>`;
      });
      dockItem.appendChild(card);
    }
  }

  private attachCardEvents(
    card: HTMLElement,
    payload: DragPayload,
    getTooltipHtml: () => string
  ): void {
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.engine.phase === 'demo') return;
      e.preventDefault();
      audio.play('ui_click');
      this.cancelOrientation();
      this.draggingPayload = payload;
      this.dragStartPos = { x: e.clientX, y: e.clientY };
      this.armedPayload = payload;
      this.updateDockSelectionVisual();

      const label =
        payload.kind === 'tower'
          ? TOWER_CONFIGS[payload.towerType].name
          : ITEM_CONFIGS[payload.itemId].name;
      this.dragGhost.textContent = `部署：${label}`;
      this.dragGhost.style.left = `${e.clientX}px`;
      this.dragGhost.style.top = `${e.clientY}px`;
      this.dragGhost.classList.remove('hidden');
      this.hoverTooltip.classList.add('hidden');
    });

    card.addEventListener('pointerenter', (e) => {
      audio.play('ui_hover');
      if (this.draggingPayload) return;
      this.hoverTooltip.innerHTML = getTooltipHtml();
      this.hoverTooltip.classList.remove('hidden');
      this.positionTooltip(e.clientX, e.clientY);
    });
    card.addEventListener('pointermove', (e) => {
      if (this.draggingPayload) return;
      this.positionTooltip(e.clientX, e.clientY);
    });
    card.addEventListener('pointerleave', () => {
      this.hoverTooltip.classList.add('hidden');
    });
  }

  private positionTooltip(cx: number, cy: number): void {
    const pad = 16;
    const w = this.hoverTooltip.offsetWidth || 260;
    const h = this.hoverTooltip.offsetHeight || 110;
    const left = Math.min(window.innerWidth - w - pad, cx + 14);
    const top = Math.max(pad, cy - h - 16);
    this.hoverTooltip.style.left = `${left}px`;
    this.hoverTooltip.style.top = `${top}px`;
  }

  private bindEvents(): void {
    // Menu map cards
    this.mapCardsEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-start-map]') as HTMLElement | null;
      if (!btn) return;
      audio.play('ui_click');
      this.startBattle(btn.dataset.startMap as MapId);
    });

    // Demo buttons
    document.getElementById('btn-demo-all')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.launchDemo('demo-1', true);
    });
    document.querySelectorAll('[data-demo]').forEach((el) => {
      el.addEventListener('click', () => {
        audio.play('ui_click');
        this.launchDemo((el as HTMLElement).dataset.demo as DemoId, false);
      });
    });
    document.getElementById('btn-exit-demo')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.demos.stopDemo();
      this.showMenu();
    });

    // Compendium & Audio buttons
    document.getElementById('btn-menu-compendium')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.openCompendium();
    });
    document.getElementById('btn-hud-compendium')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.openCompendium();
    });
    document.getElementById('btn-pause-compendium')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.openCompendium();
    });
    document.getElementById('btn-close-compendium')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.compendiumModal.classList.add('hidden');
    });
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.play('ui_click');
        this.activeCompendiumTab = (btn as HTMLElement).dataset.tab as 'devices' | 'threats' | 'terrain';
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderCompendiumContent();
      });
    });

    document.getElementById('btn-menu-audio')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.audioModal.classList.remove('hidden');
    });
    document.getElementById('btn-pause-audio')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.audioModal.classList.remove('hidden');
    });
    document.getElementById('btn-close-audio')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.audioModal.classList.add('hidden');
    });

    // Audio controls
    const chkMute = document.getElementById('chk-audio-mute') as HTMLInputElement;
    const rngMaster = document.getElementById('rng-master') as HTMLInputElement;
    const rngMusic = document.getElementById('rng-music') as HTMLInputElement;
    const rngSfx = document.getElementById('rng-sfx') as HTMLInputElement;

    const applyAudio = () => {
      audio.setSettings({
        muted: chkMute.checked,
        master: Number(rngMaster.value) / 100,
        music: Number(rngMusic.value) / 100,
        sfx: Number(rngSfx.value) / 100,
      });
      this.syncAudioUI();
    };
    chkMute.addEventListener('change', applyAudio);
    rngMaster.addEventListener('input', applyAudio);
    rngMusic.addEventListener('input', applyAudio);
    rngSfx.addEventListener('input', applyAudio);

    document.getElementById('btn-mute')!.addEventListener('click', () => {
      const s = audio.getSettings();
      audio.setSettings({ muted: !s.muted });
      this.syncAudioUI();
    });

    // Top HUD Actions
    document.getElementById('btn-start-wave')!.addEventListener('click', () => {
      if (this.engine.phase === 'paused') this.togglePause();
      this.engine.startNextWave();
      this.refreshHud(true);
    });
    document.getElementById('btn-pause')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.togglePause();
    });
    document.querySelectorAll('.btn-speed').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.play('ui_click');
        this.setSpeed(Number((btn as HTMLElement).dataset.speed) as 1 | 2 | 3);
      });
    });
    document.getElementById('btn-reset-cam')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.scene.resetCamera();
    });
    document.getElementById('btn-hud-menu')!.addEventListener('click', () => {
      audio.play('ui_click');
      if (this.engine.phase === 'playing') this.engine.phase = 'paused';
      this.pauseModal.classList.remove('hidden');
      this.refreshHud(true);
    });

    // Pause Modal Buttons
    document.getElementById('btn-resume-game')!.addEventListener('click', () => this.resumeFromPause());
    document.getElementById('btn-pause-close')!.addEventListener('click', () => this.resumeFromPause());
    document.getElementById('btn-restart-map')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.pauseModal.classList.add('hidden');
      this.startBattle(this.engine.map.id);
    });
    document.getElementById('btn-back-to-menu')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.pauseModal.classList.add('hidden');
      this.showMenu();
    });

    // Settlement Modal Buttons
    document.getElementById('btn-report-restart')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.reportModal.classList.add('hidden');
      this.startBattle(this.engine.map.id);
    });
    document.getElementById('btn-report-menu')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.reportModal.classList.add('hidden');
      this.showMenu();
    });
    document.getElementById('btn-report-next')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.reportModal.classList.add('hidden');
      const idx = MAP_ORDER.indexOf(this.engine.map.id);
      const next = MAP_ORDER[idx + 1] ?? MAP_ORDER[0];
      this.startBattle(next);
    });

    // Forecast Toggle & Inspector Close
    document.getElementById('btn-toggle-forecast')!.addEventListener('click', () => {
      this.forecastCollapsed = !this.forecastCollapsed;
      document.getElementById('forecast-body')!.classList.toggle('hidden', this.forecastCollapsed);
      document.getElementById('btn-toggle-forecast')!.textContent = this.forecastCollapsed
        ? '展开'
        : '收起';
    });
    document.getElementById('btn-close-inspector')!.addEventListener('click', () => {
      this.selectNothing();
    });

    // Orientation Bar Buttons
    document.querySelectorAll('.orient-dir').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.pendingOrient) return;
        audio.play('ui_click');
        this.pendingOrient.dir = Number((btn as HTMLElement).dataset.dir) as Direction;
        this.syncOrientBar();
        this.refreshHoverPreview();
      });
    });
    document.getElementById('btn-orient-confirm')!.addEventListener('click', () => {
      this.confirmOrientation();
    });
    document.getElementById('btn-orient-cancel')!.addEventListener('click', () => {
      audio.play('ui_click');
      this.cancelOrientation();
    });

    // Viewport Pointer Interactions (Blender MMB orbit, Shift+MMB pan, Wheel zoom, LMB select/deploy)
    const vp = document.getElementById('viewport')!;
    vp.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault();
    });
    vp.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.pendingOrient) this.cancelOrientation();
      else if (this.armedPayload) this.clearArmed();
    });

    vp.addEventListener('pointerdown', (e) => {
      if (this.engine.phase === 'menu' || this.engine.phase === 'demo') return;

      if (e.button === 1) {
        e.preventDefault();
        this.middleDragging = true;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        return;
      }

      if (e.button === 0) {
        if (this.pendingOrient) {
          const hitDir = this.scene.raycastGrid(e.clientX, e.clientY);
          if (hitDir) {
            const dx = hitDir.x - this.pendingOrient.x;
            const dy = hitDir.y - this.pendingOrient.y;
            if (dx !== 0 || dy !== 0) {
              this.pendingOrient.dir =
                Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2;
            }
          }
          this.confirmOrientation();
          return;
        }
        const hit = this.scene.raycastGrid(e.clientX, e.clientY);
        if (this.armedPayload) {
          if (hit) {
            this.tryExecuteDeployment(this.armedPayload, hit.x, hit.y);
          } else {
            this.clearArmed();
          }
          return;
        }
        if (hit) {
          this.handleTileOrUnitClick(hit.x, hit.y);
        } else {
          this.selectNothing();
        }
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (this.middleDragging) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        if (e.shiftKey) this.scene.panBy(dx, dy);
        else this.scene.orbitBy(dx, dy);
        return;
      }

      if (this.draggingPayload) {
        this.dragGhost.style.left = `${e.clientX}px`;
        this.dragGhost.style.top = `${e.clientY}px`;
      }

      if (this.engine.phase === 'playing' || this.engine.phase === 'paused') {
        const hit = this.scene.raycastGrid(e.clientX, e.clientY);
        this.currentHoverGrid = hit;

        if (this.pendingOrient && hit) {
          const dx = hit.x - this.pendingOrient.x;
          const dy = hit.y - this.pendingOrient.y;
          if (dx !== 0 || dy !== 0) {
            if (Math.abs(dx) > Math.abs(dy)) {
              this.pendingOrient.dir = dx > 0 ? 1 : 3;
            } else {
              this.pendingOrient.dir = dy > 0 ? 0 : 2;
            }
            this.syncOrientBar();
          }
        }
        this.refreshHoverPreview();
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (e.button === 1) {
        this.middleDragging = false;
      }
      if (e.button === 0 && this.draggingPayload) {
        const payload = this.draggingPayload;
        const start = this.dragStartPos;
        this.draggingPayload = null;
        this.dragStartPos = null;
        this.dragGhost.classList.add('hidden');

        const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) : 0;
        if (moved > 18) {
          const hit = this.scene.raycastGrid(e.clientX, e.clientY);
          if (hit) {
            this.tryExecuteDeployment(payload, hit.x, hit.y);
            this.clearArmed();
          } else {
            this.clearArmed();
          }
        }
        // If clicked without dragging onto map, keep armedPayload active for click-to-place!
      }
    });

    vp.addEventListener(
      'wheel',
      (e) => {
        if (this.engine.phase === 'menu' || this.engine.phase === 'demo') return;
        e.preventDefault();
        this.scene.zoomBy(e.deltaY);
      },
      { passive: false }
    );

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.engine.phase === 'demo' && !this.demos.isExportMode) {
          this.demos.stopDemo();
          this.showMenu();
          return;
        }
        if (!this.compendiumModal.classList.contains('hidden')) {
          this.compendiumModal.classList.add('hidden');
          return;
        }
        if (!this.audioModal.classList.contains('hidden')) {
          this.audioModal.classList.add('hidden');
          return;
        }
        if (this.pendingOrient) {
          this.cancelOrientation();
          return;
        }
        if (this.armedPayload) {
          this.clearArmed();
          return;
        }
        if (this.engine.phase === 'playing' || this.engine.phase === 'paused') {
          this.togglePause();
        }
      }

      if (this.engine.phase !== 'playing' && this.engine.phase !== 'paused') return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePause();
      } else if (e.key === 'r' || e.key === 'R') {
        this.scene.resetCamera();
      } else if (e.key === '1') this.setSpeed(1);
      else if (e.key === '2') this.setSpeed(2);
      else if (e.key === '3') this.setSpeed(3);
    });
  }

  private tryExecuteDeployment(payload: DragPayload, x: number, y: number): void {
    if (payload.kind === 'tower') {
      if (payload.towerType === 'interceptor') {
        const check = this.engine.previewTowerPlacement('interceptor', x, y);
        if (!check.ok) {
          audio.play('reject');
          if (check.reason) this.engine.pushAlert('warn', check.reason);
          this.refreshHud(true);
          return;
        }
        this.pendingOrient = { x, y, dir: 0 };
        this.clearArmed();
        this.syncOrientBar();
        this.refreshHoverPreview();
        return;
      }

      const tw = this.engine.deployTower(payload.towerType, x, y, 0);
      if (tw) {
        this.clearArmed();
        this.selectTower(tw);
      }
      this.refreshHud(true);
      return;
    }

    if (payload.kind === 'item') {
      const ok = this.engine.useItem(payload.itemId, x, y);
      if (ok) {
        this.clearArmed();
      }
      this.refreshHud(true);
    }
  }

  private confirmOrientation(): void {
    if (!this.pendingOrient) return;
    const { x, y, dir } = this.pendingOrient;
    this.pendingOrient = null;
    this.orientBar.classList.add('hidden');
    const tw = this.engine.deployTower('interceptor', x, y, dir);
    if (tw) this.selectTower(tw);
    this.refreshHoverPreview();
    this.refreshHud(true);
  }

  private cancelOrientation(): void {
    this.pendingOrient = null;
    this.orientBar.classList.add('hidden');
    this.refreshHoverPreview();
  }

  private syncOrientBar(): void {
    if (!this.pendingOrient) {
      this.orientBar.classList.add('hidden');
      return;
    }
    this.orientBar.classList.remove('hidden');
    document.querySelectorAll('.orient-dir').forEach((b) => {
      b.classList.toggle(
        'active',
        Number((b as HTMLElement).dataset.dir) === this.pendingOrient!.dir
      );
    });
  }

  private clearArmed(): void {
    this.armedPayload = null;
    this.draggingPayload = null;
    this.dragGhost.classList.add('hidden');
    this.updateDockSelectionVisual();
    this.refreshHoverPreview();
  }

  private updateDockSelectionVisual(): void {
    document.querySelectorAll('.deploy-card').forEach((el) => {
      const h = el as HTMLElement;
      const sel =
        (this.armedPayload?.kind === 'tower' &&
          h.dataset.cardTower === this.armedPayload.towerType) ||
        (this.armedPayload?.kind === 'item' && h.dataset.cardItem === this.armedPayload.itemId);
      h.classList.toggle('selected', sel);
    });
  }

  private handleTileOrUnitClick(x: number, y: number): void {
    const tower = this.engine.getTowerAt(x, y);
    if (tower) {
      audio.play('ui_click');
      this.selectTower(tower);
      return;
    }
    // Check nearby enemy near clicked tile
    const enemy = this.engine.enemies.find(
      (en) => en.hp > 0 && Math.hypot(en.x - x, en.y - y) <= 0.72
    );
    if (enemy) {
      audio.play('ui_click');
      this.selectEnemy(enemy);
      return;
    }
    const tile = this.engine.getTile(x, y);
    if (tile && tile.type !== 'void') {
      audio.play('ui_click');
      this.selectTile(tile);
    }
  }

  public selectTower(tower: TowerEntity | null): void {
    if (!tower) {
      this.selectNothing();
      return;
    }
    this.selection = { kind: 'tower', id: tower.id };
    this.lastInspectorKey = '';
    this.refreshInspector();
  }

  private selectEnemy(enemy: EnemyEntity): void {
    this.selection = { kind: 'enemy', id: enemy.id };
    this.lastInspectorKey = '';
    this.refreshInspector();
  }

  private selectTile(tile: TileState): void {
    this.selection = { kind: 'tile', x: tile.x, y: tile.y };
    this.lastInspectorKey = '';
    this.refreshInspector();
  }

  public selectNothing(): void {
    this.selection = { kind: 'none' };
    this.inspectorPanel.classList.add('hidden');
    this.lastInspectorKey = '';
  }

  public getSelectedTowerId(): number | null {
    return this.selection.kind === 'tower' ? this.selection.id : null;
  }

  public getSelectedEnemyId(): number | null {
    return this.selection.kind === 'enemy' ? this.selection.id : null;
  }

  public startBattle(mapId: MapId): void {
    this.settlementShown = false;
    this.clearArmed();
    this.cancelOrientation();
    this.selectNothing();
    this.pauseModal.classList.add('hidden');
    this.reportModal.classList.add('hidden');
    this.demoOverlay.classList.add('hidden');
    this.menuScreen.classList.remove('active');
    this.battleHud.classList.remove('hidden');

    this.engine.startMap(mapId, false);
    this.scene.buildMapScene(this.engine);
    this.refreshHud(true);
    this.setSpeed(1);
  }

  public enterDemoView(): void {
    this.settlementShown = false;
    this.clearArmed();
    this.cancelOrientation();
    this.selectNothing();
    this.pauseModal.classList.add('hidden');
    this.reportModal.classList.add('hidden');
    this.compendiumModal.classList.add('hidden');
    this.audioModal.classList.add('hidden');
    this.menuScreen.classList.remove('active');
    this.battleHud.classList.remove('hidden');
    this.demoOverlay.classList.remove('hidden');
  }

  public launchDemo(id: DemoId, playAll: boolean): void {
    this.enterDemoView();
    this.demos.startDemo(id, playAll, false);
    this.refreshHud(true);
  }

  public showMenu(): void {
    const needsCleanBoard =
      this.engine.map?.id !== 'intranet' ||
      this.engine.towers.length > 0 ||
      this.engine.enemies.length > 0 ||
      this.engine.isolators.length > 0 ||
      this.engine.elapsed > 0;
    this.engine.phase = 'menu';
    this.clearArmed();
    this.cancelOrientation();
    this.selectNothing();
    this.pauseModal.classList.add('hidden');
    this.reportModal.classList.add('hidden');
    this.battleHud.classList.add('hidden');
    this.demoOverlay.classList.add('hidden');
    this.demoCursor.classList.add('hidden');
    if (needsCleanBoard) {
      this.engine.startMap('intranet', false);
      this.engine.phase = 'menu';
      this.scene.buildMapScene(this.engine);
      this.scene.resetCamera();
    }
    this.menuScreen.classList.add('active');
    audio.setTrack('menu');
  }

  private togglePause(): void {
    if (this.engine.phase === 'playing') {
      this.engine.phase = 'paused';
      this.pauseModal.classList.remove('hidden');
    } else if (this.engine.phase === 'paused') {
      this.engine.phase = 'playing';
      this.pauseModal.classList.add('hidden');
    }
    this.refreshHud(true);
  }

  private resumeFromPause(): void {
    audio.play('ui_click');
    if (this.engine.phase === 'paused') this.engine.phase = 'playing';
    this.pauseModal.classList.add('hidden');
    this.refreshHud(true);
  }

  private setSpeed(s: 1 | 2 | 3): void {
    this.engine.speed = s;
    document.querySelectorAll('.btn-speed').forEach((b) => {
      b.classList.toggle('active', Number((b as HTMLElement).dataset.speed) === s);
    });
  }

  private syncAudioUI(): void {
    const s = audio.getSettings();
    (document.getElementById('chk-audio-mute') as HTMLInputElement).checked = s.muted;
    (document.getElementById('rng-master') as HTMLInputElement).value = String(
      Math.round(s.master * 100)
    );
    (document.getElementById('rng-music') as HTMLInputElement).value = String(
      Math.round(s.music * 100)
    );
    (document.getElementById('rng-sfx') as HTMLInputElement).value = String(
      Math.round(s.sfx * 100)
    );
    document.getElementById('val-master')!.textContent = `${Math.round(s.master * 100)}%`;
    document.getElementById('val-music')!.textContent = `${Math.round(s.music * 100)}%`;
    document.getElementById('val-sfx')!.textContent = `${Math.round(s.sfx * 100)}%`;
    document.getElementById('btn-mute')!.textContent = s.muted ? '🔇' : '🔊';
  }

  private refreshHoverPreview(): void {
    let intent: HoverIntent | null = null;
    if (this.pendingOrient) {
      intent = {
        kind: 'orient',
        x: this.pendingOrient.x,
        y: this.pendingOrient.y,
        direction: this.pendingOrient.dir,
        valid: true,
      };
    } else if (this.armedPayload && this.currentHoverGrid) {
      const { x, y } = this.currentHoverGrid;
      const hoverTile = this.engine.getTile(x, y);
      const isVoidTile = !hoverTile || hoverTile.type === 'void';
      if (this.armedPayload.kind === 'tower') {
        const res = this.engine.previewTowerPlacement(this.armedPayload.towerType, x, y);
        intent = {
          kind: 'tower',
          towerType: this.armedPayload.towerType,
          x,
          y,
          direction: 0,
          valid: res.ok,
          routePreview: res.routePreview,
        };
        this.showRouteDeltaBanner(
          res.routePreview,
          res.ok || isVoidTile ? undefined : res.reason
        );
      } else {
        const res = this.engine.previewItemPlacement(this.armedPayload.itemId, x, y);
        intent = {
          kind: 'item',
          itemId: this.armedPayload.itemId,
          x,
          y,
          valid: res.ok,
          affectedTiles: res.affectedTiles,
          routePreview: res.routePreview,
        };
        this.showRouteDeltaBanner(
          res.routePreview,
          res.ok || isVoidTile ? undefined : res.reason
        );
      }
    } else {
      this.routeDeltaBanner.classList.add('hidden');
    }

    this.currentHoverIntent = intent;
    const selTower =
      this.selection.kind === 'tower' ? this.engine.getTowerById(this.selection.id) : null;
    this.scene.updateHoverPreview(this.engine, this.currentHoverIntent, selTower);
  }

  private showRouteDeltaBanner(rp?: HoverIntent['routePreview'], invalidReason?: string): void {
    if (invalidReason) {
      this.routeDeltaBanner.textContent = invalidReason;
      this.routeDeltaBanner.classList.add('invalid');
      this.routeDeltaBanner.classList.remove('hidden');
      return;
    }
    if (rp && rp.valid && rp.changedEntries.length > 0) {
      const exits = this.engine.map.exits;
      const details = rp.changedEntries.map((eid) => {
        const curr = rp.currentRoutes[eid] ?? [];
        const next = rp.previewRoutes[eid] ?? [];
        const cHops = Math.max(0, curr.length - 1);
        const nHops = Math.max(0, next.length - 1);
        const cEnd = curr[curr.length - 1];
        const nEnd = next[next.length - 1];
        const cEx = cEnd ? exits.find((ex) => ex.x === cEnd.x && ex.y === cEnd.y)?.id : undefined;
        const nEx = nEnd ? exits.find((ex) => ex.x === nEnd.x && ex.y === nEnd.y)?.id : undefined;
        const exitShift = cEx && nEx && cEx !== nEx ? `·改赴核心${nEx}` : '';
        return `入口${eid}(${cHops}→${nHops}跳${exitShift})`;
      });
      this.routeDeltaBanner.textContent = `改道预览：${details.join(' ｜ ')}`;
      this.routeDeltaBanner.classList.remove('invalid');
      this.routeDeltaBanner.classList.remove('hidden');
      return;
    }
    this.routeDeltaBanner.classList.add('hidden');
  }

  public refreshHud(force = false): void {
    if (this.engine.phase === 'menu') return;

    document.getElementById('hud-map-tag')!.textContent = this.engine.map.networkTag;
    document.getElementById('hud-map-name')!.textContent = this.engine.map.name;

    const totalW = this.engine.map.waves.length;
    const currW = this.engine.currentWaveIndex;
    document.getElementById('hud-wave-num')!.textContent = `波次 ${currW} / ${totalW}`;
    const waveDef = currW > 0 ? this.engine.map.waves[currW - 1] : null;
    document.getElementById('hud-wave-title')!.textContent = this.engine.waveInProgress
      ? `进行中 · ${waveDef?.title ?? ''}`
      : currW >= totalW
      ? '全部波次完成'
      : '等待接入下一波';

    const btnWave = document.getElementById('btn-start-wave') as HTMLButtonElement;
    const canStartWave =
      !this.engine.waveInProgress &&
      currW < totalW &&
      this.engine.phase !== 'demo';
    btnWave.disabled = !canStartWave;
    btnWave.classList.toggle('pulse', canStartWave);
    btnWave.textContent = this.engine.waveInProgress
      ? '波次交战中'
      : currW === 0
      ? '▶ 开始第 1 波'
      : `▶ 接入第 ${currW + 1} 波`;

    document.getElementById('hud-compute')!.textContent = String(Math.floor(this.engine.compute));
    document.getElementById('hud-intel')!.textContent = String(Math.floor(this.engine.intel));
    const integEl = document.getElementById('hud-integrity')!;
    integEl.textContent = `${this.engine.integrity} / ${this.engine.maxIntegrity}`;
    integEl.parentElement!.classList.toggle('low', this.engine.integrity <= 6);

    const btnPause = document.getElementById('btn-pause')!;
    btnPause.textContent = this.engine.phase === 'paused' ? '▶ 继续' : '⏸ 暂停';

    // Demo top timer
    if (this.engine.phase === 'demo' && this.demos.activeDemoId) {
      document.getElementById('demo-timer-badge')!.textContent = `${this.demos.demoTime.toFixed(1)}s`;
    }

    // Update dock affordability & item cooldowns
    document.querySelectorAll('[data-card-tower]').forEach((el) => {
      const h = el as HTMLElement;
      const cfg = TOWER_CONFIGS[h.dataset.cardTower as TowerType];
      h.classList.toggle('unaffordable', this.engine.compute < cfg.computeCost);
    });
    document.querySelectorAll('[data-card-item]').forEach((el) => {
      const h = el as HTMLElement;
      const id = h.dataset.cardItem as ItemId;
      const cfg = ITEM_CONFIGS[id];
      const afford =
        cfg.resource === 'intel'
          ? this.engine.intel >= cfg.cost
          : this.engine.compute >= cfg.cost;
      const cd = this.engine.itemCooldowns[id];
      h.classList.toggle('unaffordable', !afford || cd > 0);
      const cdEl = h.querySelector(`[data-item-cd="${id}"]`) as HTMLElement;
      if (cd > 0) {
        cdEl.classList.remove('hidden');
        cdEl.textContent = `${cd.toFixed(0)}s`;
      } else {
        cdEl.classList.add('hidden');
      }
    });

    // Alerts stack
    this.alertsStack.innerHTML = this.engine.alerts
      .slice(0, 3)
      .map((a) => `<div class="alert-toast ${a.level}">${a.text}</div>`)
      .join('');

    // Forecast panel (update when wave changes)
    const fKey = `${this.engine.map.id}_${currW}_${this.engine.waveInProgress}`;
    if (force || fKey !== this.lastForecastKey) {
      this.lastForecastKey = fKey;
      this.renderForecast();
    }

    // Inspector refresh
    this.refreshInspector();

    // Sync armed hover preview periodically so node/item cooldown countdown flips live under cursor
    if (this.armedPayload && this.currentHoverGrid) {
      const nowMs = performance.now();
      if (force || nowMs - this.lastHoverSyncMs >= 120) {
        this.lastHoverSyncMs = nowMs;
        this.refreshHoverPreview();
      }
    }

    // Settlement report check
    if (
      !this.settlementShown &&
      (this.engine.phase === 'victory' || this.engine.phase === 'defeat')
    ) {
      this.settlementShown = true;
      this.showReportModal(this.engine.phase === 'victory');
    }
  }

  private renderForecast(): void {
    const body = document.getElementById('forecast-body')!;
    const targetWaveIdx = this.engine.waveInProgress
      ? this.engine.currentWaveIndex
      : Math.min(this.engine.map.waves.length, this.engine.currentWaveIndex + 1);
    const wave = this.engine.map.waves[targetWaveIdx - 1];
    if (!wave) {
      body.innerHTML = `<div class="mono-dim">所有波次预报已清空。</div>`;
      return;
    }

    const byEntry: Record<string, Map<EnemyType, number>> = {};
    for (const en of this.engine.map.entries) byEntry[en.id] = new Map();
    for (const g of wave.groups) {
      const m = byEntry[g.entryId];
      if (m) m.set(g.enemy, (m.get(g.enemy) ?? 0) + g.count);
    }

    const waveBadge = wave.isBossWave
      ? '☠ 首领来袭 · '
      : wave.isSurgeWave
      ? '🔥 三路洪峰 · '
      : '';
    let html = `
      <div class="forecast-wave-head">
        <span>${this.engine.waveInProgress ? '当前来袭' : '下波预报'}：第 ${wave.index} 波</span>
        <span style="color:${wave.isBossWave ? '#fb7185' : wave.isSurgeWave ? '#fbbf24' : '#38bdf8'}">${waveBadge}${wave.title}</span>
      </div>
    `;

    for (const en of this.engine.map.entries) {
      const counts = byEntry[en.id];
      if (!counts || counts.size === 0) continue;
      let chips = '';
      for (const [etype, num] of counts.entries()) {
        const ec = ENEMY_CONFIGS[etype];
        chips += `
          <span class="enemy-chip" style="color:${ec.colorHex}">
            ${getEnemySvg(etype)}
            <span>${ec.name}</span>
            <strong class="mono-num">×${num}</strong>
          </span>
        `;
      }
      html += `
        <div class="forecast-entry-row" style="border-left-color:${en.color}">
          <div class="forecast-entry-title">
            <span style="color:${en.color}">入口 ${en.id} · ${en.name}</span>
          </div>
          <div class="forecast-chips">${chips}</div>
        </div>
      `;
    }

    body.innerHTML = html;
  }

  private refreshInspector(): void {
    if (this.selection.kind === 'none') {
      this.inspectorPanel.classList.add('hidden');
      return;
    }

    if (this.selection.kind === 'tower') {
      const tw = this.engine.getTowerById(this.selection.id);
      if (!tw) {
        this.selectNothing();
        return;
      }
      this.inspectorPanel.classList.remove('hidden');
      const cfg = TOWER_CONFIGS[tw.type];
      const branch = tw.branch ? cfg.branches?.find((b) => b.id === tw.branch) : undefined;

      const branchSig = cfg.branches
        ? cfg.branches
            .map((b) => (this.engine.compute >= b.computeCost && this.engine.intel >= b.intelCost ? '1' : '0'))
            .join('')
        : this.engine.compute >= cfg.lv2ComputeCost
        ? '1'
        : '0';
      const beingHealed = this.engine.towers.some(
        (r) =>
          r.type === 'repair' &&
          r.hp > 0 &&
          r.encryptedTimer <= 0 &&
          (r.targetId === tw.id || r.secondaryTargetId === tw.id)
      );
      const key = `T_${tw.id}_${tw.level}_${tw.branch}_${Math.round(tw.hp)}_${Math.round(
        tw.shield
      )}_${tw.encryptedTimer.toFixed(1)}_${tw.skillCooldown.toFixed(1)}_${branchSig}_${
        tw.blockedEnemyIds.length
      }_${beingHealed ? 1 : 0}_${tw.kills}`;

      if (key === this.lastInspectorKey) return;
      this.lastInspectorKey = key;

      const titleName = branch ? `${cfg.name} · ${branch.name}` : tw.level === 2 ? `${cfg.name} · ${cfg.lv2Name}` : cfg.name;
      this.inspectorTitle.textContent = `${titleName} (Lv.${tw.level})`;

      const tile = this.engine.getTile(tw.x, tw.y);
      const dmg = Math.round(this.engine.getTowerDamage(tw));
      const rng = this.engine.getTowerRange(tw);
      const blkCap = this.engine.getTowerBlockCap(tw);
      const refund = Math.round(tw.computeSpent * GAME_CONSTANTS.REFUND_RATIO);

      let badges = '';
      if (tw.encryptedTimer > 0) {
        badges += `<span class="status-badge encrypt">🔒 已加密 ${tw.encryptedTimer.toFixed(1)}s（停火/停技，保留阻挡与隔离）</span>`;
      }
      if (beingHealed) {
        badges += `<span class="status-badge intel">🔧 正在接受修复治疗</span>`;
      }
      if (tw.blockedEnemyIds.length > 0) {
        badges += `<span class="status-badge warn">🛡 正阻挡 ${tw.blockedEnemyIds.length} 名敌军</span>`;
      }
      if (tile?.type === 'node' && (tw.type === 'gate' || tw.type === 'firewall')) {
        const intelDesc =
          tw.type === 'gate'
            ? tw.level === 2
              ? '每 3.1s +2 情报'
              : '每 3.8s +1 情报'
            : '每 4.8s +1 情报';
        badges += `<span class="status-badge intel">📡 正在隔离节点（交战中${intelDesc}）</span>`;
      }

      const activeDesc = branch
        ? branch.summary
        : tw.level === 2
        ? cfg.lv2Summary
        : cfg.shortDesc;

      const bullets = branch
        ? branch.behaviorBullet
        : tw.level === 2
        ? [`2 级强化：${cfg.lv2Summary}`, ...cfg.traits]
        : cfg.traits;
      const bulletHtml = bullets.map((b) => `<li>${b}</li>`).join('');

      let upgradeHtml = '';
      if (tw.level === 1 && this.engine.phase !== 'demo') {
        if (cfg.branches) {
          upgradeHtml = cfg.branches
            .map((b) => {
              const can =
                this.engine.compute >= b.computeCost && this.engine.intel >= b.intelCost;
              return `
                <div class="branch-card">
                  <div class="branch-card-head">
                    <span>⚡ 分支：${b.name}</span>
                    <span class="mono-dim">${b.tag}</span>
                  </div>
                  <p class="ins-desc">${b.summary}</p>
                  <button class="btn btn-primary" data-branch-up="${b.id}" ${can ? '' : 'disabled'}>
                    改造 (${b.computeCost}算 + ${b.intelCost}情)
                  </button>
                </div>
              `;
            })
            .join('');
        } else {
          const can = this.engine.compute >= cfg.lv2ComputeCost;
          upgradeHtml = `
            <div class="branch-card">
              <div class="branch-card-head">
                <span>⬆ 升至 2 级：${cfg.lv2Name}</span>
              </div>
              <p class="ins-desc">${cfg.lv2Summary}</p>
              <button class="btn btn-primary" id="btn-tower-upgrade" ${can ? '' : 'disabled'}>
                升级 (${cfg.lv2ComputeCost} 算力)
              </button>
            </div>
          `;
        }
      }

      let skillHtml = '';
      if (cfg.skillName) {
        const ready = tw.skillCooldown <= 0 && tw.encryptedTimer <= 0;
        const label =
          tw.encryptedTimer > 0
            ? `🔒 加密中 (${cfg.skillName})`
            : tw.skillCooldown > 0
            ? `${cfg.skillName} (${tw.skillCooldown.toFixed(1)}s)`
            : `⚡ 释放「${cfg.skillName}」`;
        skillHtml = `
          <div class="branch-card">
            <p class="ins-desc">${cfg.skillDesc}</p>
            <button class="btn btn-accent" id="btn-tower-skill" ${ready ? '' : 'disabled'}>${label}</button>
          </div>
        `;
      }

      this.inspectorBody.innerHTML = `
        <div class="ins-head">
          <div class="ins-icon" style="color:${cfg.colorHex}">${getTowerSvg(tw.type)}</div>
          <div>
            <div style="font-weight:700;font-size:15px;">${titleName}</div>
            <div class="mono-dim">${cfg.role}</div>
          </div>
        </div>
        ${badges ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${badges}</div>` : ''}
        <div class="ins-stats-grid">
          <div class="ins-stat"><span>生命值</span><strong>${Math.ceil(tw.hp)} / ${tw.maxHp}</strong></div>
          <div class="ins-stat"><span>护盾值</span><strong>${Math.ceil(tw.shield)}</strong></div>
          <div class="ins-stat"><span>${tw.type === 'repair' ? '治疗速率' : '单次伤害'}</span><strong>${
        tw.type === 'repair'
          ? `${tw.level === 2 ? cfg.lv2HealPerSec : cfg.healPerSec}/s`
          : dmg
      }</strong></div>
          <div class="ins-stat"><span>${blkCap > 0 ? '阻挡数' : '作用范围'}</span><strong>${
        blkCap > 0 ? `${tw.blockedEnemyIds.length} / ${blkCap}` : `${rng.toFixed(1)} 格`
      }</strong></div>
        </div>
        <p class="ins-desc">${activeDesc}</p>
        <ul class="ins-bullets">${bulletHtml}</ul>
        ${skillHtml}
        ${upgradeHtml}
        ${
          this.engine.phase !== 'demo'
            ? `<button class="btn btn-danger" id="btn-tower-undeploy">撤下设施 (返还 +${refund} 算力)</button>`
            : ''
        }
      `;

      document.getElementById('btn-tower-upgrade')?.addEventListener('click', () => {
        this.engine.upgradeTower(tw.id);
        this.refreshHud(true);
      });
      document.querySelectorAll('[data-branch-up]').forEach((b) => {
        b.addEventListener('click', () => {
          this.engine.upgradeTower(tw.id, (b as HTMLElement).dataset.branchUp as any);
          this.refreshHud(true);
        });
      });
      document.getElementById('btn-tower-skill')?.addEventListener('click', () => {
        this.engine.triggerTowerSkill(tw.id);
        this.refreshHud(true);
      });
      document.getElementById('btn-tower-undeploy')?.addEventListener('click', () => {
        this.engine.undeployTower(tw.id);
        this.selectNothing();
        this.refreshHud(true);
      });
      return;
    }

    if (this.selection.kind === 'enemy') {
      const targetId = this.selection.id;
      const en = this.engine.enemies.find((e) => e.id === targetId && e.hp > 0);
      if (!en) {
        this.selectNothing();
        return;
      }
      this.inspectorPanel.classList.remove('hidden');
      const cfg = ENEMY_CONFIGS[en.type];
      const eTile = this.engine.getTile(Math.round(en.x), Math.round(en.y));
      const onLegacyOrDown = !en.isFlying && !!eTile && (eTile.type === 'legacy' || eTile.downgradeTimer > 0);
      const effSpeed =
        en.snaredTimer > 0
          ? 0
          : en.speed *
            (onLegacyOrDown ? GAME_CONSTANTS.LEGACY_SPEED_MULT : 1) *
            (en.slowTimer > 0 ? en.slowFactor : 1);
      const remainHops = Math.max(0, en.route.length - 1 - en.routeIndex);
      const key = `E_${en.id}_${Math.round(en.hp)}_${Math.round(en.shield)}_${en.detected}_${en.disguised}_${en.bossPhase}_${en.blockedByTowerId ?? 0}_${onLegacyOrDown ? 1 : 0}_${en.slowTimer.toFixed(1)}_${en.snaredTimer.toFixed(1)}_${remainHops}`;
      if (key === this.lastInspectorKey) return;
      this.lastInspectorKey = key;

      const blocker = en.blockedByTowerId ? this.engine.getTowerById(en.blockedByTowerId) : null;
      this.inspectorTitle.textContent = `威胁档案 · ${cfg.name}`;
      this.inspectorBody.innerHTML = `
        <div class="ins-head">
          <div class="ins-icon" style="color:${cfg.colorHex}">${getEnemySvg(en.type)}</div>
          <div>
            <div style="font-weight:700;font-size:15px;">${cfg.name}${en.isClone ? ' (克隆体)' : ''}${en.isBoss ? ` · 阶段 ${en.bossPhase}` : ''}</div>
            <div class="mono-dim">${cfg.role}</div>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          <span class="status-badge">${en.isFlying ? `✈ 无线直飞 → 核心 ${en.targetExitId}` : `🧭 去往核心 ${en.targetExitId}（剩 ${remainHops} 跳）`}</span>
          ${en.disguised ? `<span class="status-badge warn">🎭 伪装未显形（免受拦截器瞄准）</span>` : `<span class="status-badge intel">🔍 已显形（可被单体集火）</span>`}
          ${blocker ? `<span class="status-badge warn">🧱 正被「${TOWER_CONFIGS[blocker.type].name}」阻挡</span>` : ''}
          ${onLegacyOrDown || en.slowTimer > 0 ? `<span class="status-badge warn">🐢 协议/力场减速中</span>` : ''}
          ${en.snaredTimer > 0 ? `<span class="status-badge encrypt">🕸 诱捕定身 ${en.snaredTimer.toFixed(1)}s</span>` : ''}
        </div>
        <div class="ins-stats-grid">
          <div class="ins-stat"><span>生命值</span><strong>${Math.ceil(en.hp)} / ${en.maxHp}</strong></div>
          <div class="ins-stat"><span>护盾值</span><strong>${Math.ceil(en.shield)}</strong></div>
          <div class="ins-stat"><span>护甲</span><strong>${en.armor}</strong></div>
          <div class="ins-stat"><span>当前移速</span><strong>${effSpeed.toFixed(2)} 格/秒</strong></div>
        </div>
        <p class="ins-desc">${cfg.summary}</p>
        <ul class="ins-bullets">${cfg.mechanics.map((m) => `<li>${m}</li>`).join('')}</ul>
      `;
      return;
    }

    if (this.selection.kind === 'tile') {
      const tile = this.engine.getTile(this.selection.x, this.selection.y);
      if (!tile) {
        this.selectNothing();
        return;
      }
      this.inspectorPanel.classList.remove('hidden');
      const key = `G_${tile.x}_${tile.y}_${tile.nodeCooldown.toFixed(1)}_${tile.downgradeTimer.toFixed(1)}_${tile.blackholeTimer.toFixed(1)}_${tile.lockdownTimer.toFixed(1)}`;
      if (key === this.lastInspectorKey) return;
      this.lastInspectorKey = key;

      const labelMap: Record<string, string> = {
        link: '标准链路',
        legacy: '旧协议链路',
        platform: '设备平台',
        node: `交换节点 · ${tile.nodeName ?? keyOf(tile.x, tile.y)}`,
        obstacle: '物理设施 / 气隙屏障',
        entry: '网络入口',
        exit: '核心出口',
      };
      const descMap: Record<string, string> = {
        link: '常规高速数据通路。可部署「防火墙」与「蜜罐」进行阻挡或诱敌。',
        legacy: '保留旧协议的慢速链路：经过的地面敌人减速 45%，伪装木马与潜伏蛰影立即显形；敌人寻路会避让其高通行代价。',
        platform: '高架设备基座，地面敌人无法通行。可部署「拦截器」「沙箱」「修复进程」。',
        node: '链路交汇交换节点。部署防火墙、网闸或应急隔离器可截断道路触发全图改道；解除隔离后存在 4.5 秒冷却。',
        obstacle: '数据机柜、公网流或物理气隙，不可通行且不可部署地面设备。',
        entry: '恶意流量与正常业务接入点。',
        exit: '受保护的数据中枢核心。',
      };

      this.inspectorTitle.textContent = `节点/地块 (${tile.x}, ${tile.y})`;
      this.inspectorBody.innerHTML = `
        <div style="font-size:16px;font-weight:700;color:#38bdf8;">${labelMap[tile.type] ?? tile.type}</div>
        <p class="ins-desc">${descMap[tile.type] ?? ''}</p>
        ${tile.nodeCooldown > 0 ? `<span class="status-badge warn">再次隔离冷却：${tile.nodeCooldown.toFixed(1)}s</span>` : ''}
        ${tile.downgradeTimer > 0 ? `<span class="status-badge warn">协议降级生效中：${tile.downgradeTimer.toFixed(1)}s</span>` : ''}
        ${tile.blackholeTimer > 0 ? `<span class="status-badge encrypt">伪路由黑洞阻断：${tile.blackholeTimer.toFixed(1)}s</span>` : ''}
        ${tile.lockdownTimer > 0 ? `<span class="status-badge encrypt">运维环锁死：${tile.lockdownTimer.toFixed(1)}s</span>` : ''}
      `;
    }
  }

  private showReportModal(victory: boolean): void {
    const s = this.engine.stats;
    document.getElementById('report-case-id')!.textContent =
      `INCIDENT_REPORT // ${this.engine.map.networkTag}`;
    document.getElementById('report-title')!.textContent = victory
      ? `事件报告：防区【${this.engine.map.name}】安全肃清`
      : `事件报告：防区【${this.engine.map.name}】核心失守`;

    const stamp = document.getElementById('report-stamp')!;
    stamp.textContent = victory ? 'DEFENDED' : 'BREACHED';
    stamp.className = `report-stamp ${victory ? 'pass' : 'fail'}`;

    document.getElementById('report-summary')!.textContent = victory
      ? `守护进程成功抵御了全部 ${this.engine.map.waves.length} 波渗透与首领攻势，自治域「汐域」核心数据库与链路连通性保持完好。`
      : `第 ${this.engine.currentWaveIndex} 波期间中枢完整度归零，建议调整节点隔离时机与交叉火力配置后重新接入防御。`;

    document.getElementById('report-stats-grid')!.innerHTML = `
      <div class="report-stat-item"><span>剩余中枢完整度</span><strong>${this.engine.integrity} / ${this.engine.maxIntegrity}</strong></div>
      <div class="report-stat-item"><span>击毁恶意程序</span><strong>${s.enemiesDefeated}</strong></div>
      <div class="report-stat-item"><span>总计拦截漏防</span><strong>${s.leaks} 次</strong></div>
      <div class="report-stat-item"><span>节点守卫回收情报</span><strong>+${s.intelFromNodes}</strong></div>
      <div class="report-stat-item"><span>触发动态改道</span><strong>${s.reroutesTriggered} 次</strong></div>
      <div class="report-stat-item"><span>友方设备损毁 / 治疗</span><strong>${s.towersLost} 台 / ${Math.round(s.healingTotal)}</strong></div>
    `;

    const nextIdx = MAP_ORDER.indexOf(this.engine.map.id);
    const hasNext = victory && nextIdx >= 0 && nextIdx < MAP_ORDER.length - 1;
    document.getElementById('btn-report-next')!.classList.toggle('hidden', !hasNext);
    this.reportModal.classList.remove('hidden');
  }

  private openCompendium(): void {
    this.compendiumModal.classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.tab === this.activeCompendiumTab);
    });
    this.renderCompendiumContent();
  }

  private renderCompendiumContent(): void {
    const body = document.getElementById('compendium-content')!;
    if (this.activeCompendiumTab === 'devices') {
      const towersHtml = (Object.keys(TOWER_CONFIGS) as TowerType[])
        .map((t) => {
          const c = TOWER_CONFIGS[t];
          const branchText = c.branches
            ? c.branches
                .map((b) => `<div class="comp-subbox"><strong>2级分支 · ${b.name}（${b.computeCost}算+${b.intelCost}情）：</strong>${b.summary}</div>`)
                .join('')
            : `<div class="comp-subbox"><strong>2级升级 · ${c.lv2Name}（${c.lv2ComputeCost}算）：</strong>${c.lv2Summary}</div>`;
          const skillText = c.skillName
            ? `<div class="comp-subbox" style="border-left-color:#34d399;"><strong>主动技能 · ${c.skillName}（CD ${c.skillCooldown}s）：</strong>${c.skillDesc}</div>`
            : '';
          return `
            <div class="comp-card">
              <div class="comp-card-head" style="color:${c.colorHex}">
                ${getTowerSvg(t)}
                <div>
                  <h3>${c.name}</h3>
                  <div class="comp-role">${c.role} · 耗费 ${c.computeCost} 算力${c.nodeIntelCost > 0 ? ` (+${c.nodeIntelCost} 情报/节点)` : ''}</div>
                </div>
              </div>
              <p class="ins-desc">${c.shortDesc}</p>
              <ul class="comp-bullets">${c.traits.map((tr) => `<li>${tr}</li>`).join('')}</ul>
              ${skillText}
              ${branchText}
            </div>
          `;
        })
        .join('');

      const itemsHtml = (Object.keys(ITEM_CONFIGS) as ItemId[])
        .map((id) => {
          const it = ITEM_CONFIGS[id];
          return `
            <div class="comp-card">
              <div class="comp-card-head" style="color:${it.colorHex}">
                ${getItemSvg(id)}
                <div>
                  <h3>应急指令 · ${it.name}</h3>
                  <div class="comp-role">目标：${it.targetLabel} · 消耗 ${it.cost}${it.resource === 'intel' ? '情报' : '算力'} · CD ${it.cooldown}s</div>
                </div>
              </div>
              <p class="ins-desc">${it.detailDesc}</p>
            </div>
          `;
        })
        .join('');

      body.innerHTML = `<div class="comp-grid">${towersHtml}${itemsHtml}</div>`;
    } else if (this.activeCompendiumTab === 'threats') {
      const enemiesHtml = (Object.keys(ENEMY_CONFIGS) as EnemyType[])
        .map((et) => {
          const e = ENEMY_CONFIGS[et];
          return `
            <div class="comp-card">
              <div class="comp-card-head" style="color:${e.colorHex}">
                ${getEnemySvg(et)}
                <div>
                  <h3>${e.name}</h3>
                  <div class="comp-role">${e.role} · 生命 ${e.maxHp} · 护甲 ${e.armor} · 移速 ${e.speed.toFixed(2)}</div>
                </div>
              </div>
              <p class="ins-desc">${e.summary}</p>
              <ul class="comp-bullets">${e.mechanics.map((m) => `<li>${m}</li>`).join('')}</ul>
            </div>
          `;
        })
        .join('');

      body.innerHTML = `<div class="comp-grid">${enemiesHtml}</div>`;
    } else {
      const terrainDefs = [
        {
          name: '标准链路 (Link)',
          color: '#38bdf8',
          role: '地面通路 · 阻挡部署格',
          summary: '恶意流量与正常业务流共同行进的数据通路。可在入口、出口之外部署「防火墙」与「蜜罐」。',
          bullets: [
            '部署防火墙或蜜罐仅按阻挡上限拦截敌人，不会截断链路或引发全图改道',
            '高亮青/橙/紫光束指示各入口到目标核心的最短当前路由',
          ],
        },
        {
          name: '旧协议链路 (Legacy Link)',
          color: '#f59e0b',
          role: '降速显形通路 · 高路由代价',
          summary: '保留老旧明文协议的慢速链路，地面敌军通行速度降为 55%，且会迫使伪装木马与潜伏态蛰影立即显形。',
          bullets: [
            '敌人与各入口寻路时会优先绕开旧链路（代价系数 ×1.85），仅当主干道被隔离或过长时才会切入',
            '应急指令「协议降级」可让一片标准链路在 10 秒内退化为同等特性并实时重算路线',
          ],
        },
        {
          name: '交换节点 (Switch Node)',
          color: '#10b981',
          role: '核心拓扑枢纽 · 隔离改道点',
          summary: '链路交汇点。部署「网闸」「防火墙」或投放「应急隔离器」将截断该节点并同步触发动态改道（受全图保持连通约束）。',
          bullets: [
            '节点隔离被摧毁或主动撤下后，该节点进入 4.5 秒旁路冷却，冷却内无法再次隔离',
            '交战期间用防火墙或网闸守住隔离节点可定期产出情报；应急隔离器不产出情报',
          ],
        },
        {
          name: '设备平台 (Platform)',
          color: '#60a5fa',
          role: '高架支援位 · 非通行地块',
          summary: '高于路面架设的高速设备基座，地面敌人无法翻越，专为部署「拦截器」「沙箱」「修复进程」打造。',
          bullets: [
            '仅拦截器需由玩家手动设定 4 方向扇区射界，且对飞行与已显形地面目标均有效',
            '修复进程可同时覆盖附近链路、平台及交换节点上的受损友塔',
          ],
        },
        {
          name: '物理设施与气隙障碍 (Obstacle)',
          color: '#64748b',
          role: '不可通行 · 不可部署',
          summary: '包含核心机柜、跨网公网流河道与工控物理气隙区，地面单位必须绕行，但飞行「伪热点」可直接飞越无线空域。',
          bullets: [
            '「伪路由黑洞」与「运维环锁死」等首领技能会临时封闭部分路段，触发同样受连通性保护的重路由',
          ],
        },
      ];

      const terrainHtml = terrainDefs
        .map(
          (td) => `
          <div class="comp-card">
            <h3 style="color:${td.color}">${td.name}</h3>
            <div class="comp-role" style="margin:4px 0 8px;">${td.role}</div>
            <p class="ins-desc">${td.summary}</p>
            <ul class="comp-bullets">${td.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
          </div>
        `
        )
        .join('');

      const statusHtml = STATUS_DOCS.map(
        (s) => `
        <div class="comp-card">
          <h3 style="color:${s.color}">状态法则 · ${s.name}</h3>
          <p class="ins-desc">${s.summary}</p>
          <div class="comp-subbox" style="border-left-color:${s.color};">${s.counter}</div>
        </div>
      `
      ).join('');

      const controlsHtml = `
        <div class="comp-card">
          <h3 style="color:#a7f3d0">操控与视口指北（PC 键鼠）</h3>
          <div class="comp-role" style="margin:4px 0 8px;">Blender 同构视角 · 实时可调速</div>
          <ul class="comp-bullets">
            <li><strong>中键拖动</strong>：环绕旋转三维视角 · <strong>Shift + 中键</strong>：平移战场</li>
            <li><strong>鼠标滚轮</strong>：推近查看三维模型/材质细节或拉远俯瞰全局</li>
            <li><strong>左键点选 / 拖放</strong>：部署设施、选中敌我单位与空地块查看详情，或设置拦截器朝向</li>
            <li><strong>右键 / Esc</strong>：取消当前拖拽或朝向选择；空闲按 <strong>Space</strong> 暂停，<strong>1 / 2 / 3</strong> 切倍速，<strong>R</strong> 恢复默认视角</li>
          </ul>
        </div>
      `;

      body.innerHTML = `<div class="comp-grid">${terrainHtml}${statusHtml}${controlsHtml}</div>`;
    }
  }

  public setDemoSubtitle(title: string, text: string): void {
    const titleEl = document.getElementById('demo-sub-title')!;
    const textEl = document.getElementById('demo-sub-text')!;
    titleEl.textContent = title;
    textEl.textContent = text;
    document.getElementById('demo-title-badge')!.textContent = title || '实战演示';
  }

  public setDemoCursor(state: {
    visible: boolean;
    x: number;
    y: number;
    clicking: boolean;
    badge?: string;
  }): void {
    this.demoCursor.classList.toggle('hidden', !state.visible);
    this.demoCursor.classList.toggle('clicking', state.clicking);
    this.demoCursor.style.left = `${state.x}px`;
    this.demoCursor.style.top = `${state.y}px`;
    if (state.badge) {
      this.demoCursorBadge.textContent = state.badge;
      this.demoCursorBadge.classList.remove('hidden');
    } else {
      this.demoCursorBadge.classList.add('hidden');
    }
  }
}
