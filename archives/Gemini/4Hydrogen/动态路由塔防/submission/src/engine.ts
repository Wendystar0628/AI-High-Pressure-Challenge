import { audio } from './audio';
import {
  ENEMY_CONFIGS,
  GAME_CONSTANTS,
  ITEM_CONFIGS,
  TOWER_CONFIGS,
} from './config';
import { MAP_DEFS } from './maps';
import {
  computeAllEntryRoutes,
  createTilesFromMap,
  evaluateRouteChange,
  findShortestPathToAnyExit,
  findShortestPathToTarget,
  isTileWalkable,
  keyOf,
} from './pathfinding';
import type {
  BranchId,
  BurstVfx,
  Direction,
  EnemyEntity,
  EnemyType,
  GameAlert,
  GamePhase,
  GameStats,
  GridCoord,
  IsolatorEntity,
  ItemId,
  MapDef,
  MapId,
  ProjectileVfx,
  RoutePreviewResult,
  TileState,
  TowerEntity,
  TowerType,
} from './types';

interface PendingSpawn {
  time: number;
  enemy: EnemyType;
  entryId: 'A' | 'B' | 'C';
  isSurge?: boolean;
}

class SeededRng {
  private s: number;
  constructor(seed = 20261113) {
    this.s = seed >>> 0;
  }
  public setSeed(seed: number): void {
    this.s = seed >>> 0 || 1;
  }
  public next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export class GameEngine {
  public map: MapDef = MAP_DEFS.intranet;
  public tiles: TileState[][] = [];
  public phase: GamePhase = 'menu';
  public speed: 1 | 2 | 3 = 1;
  public elapsed = 0;

  public compute = 0;
  public intel = 0;
  public integrity = 20;
  public maxIntegrity = 20;

  public currentWaveIndex = 0; // 0 = pre-wave 1 prep, 1..N active/cleared
  public waveInProgress = false;
  public wavePrepTimer = 0;
  public pendingSpawns: PendingSpawn[] = [];
  public waveElapsed = 0;

  public towers: TowerEntity[] = [];
  public isolators: IsolatorEntity[] = [];
  public enemies: EnemyEntity[] = [];
  public projectiles: ProjectileVfx[] = [];
  public bursts: BurstVfx[] = [];
  public alerts: GameAlert[] = [];

  public itemCooldowns: Record<ItemId, number> = {
    isolator: 0,
    downgrade: 0,
    restore: 0,
  };

  public entryRoutes: Record<string, GridCoord[]> = {};
  public routeChangeFlashTimer = 0;
  public lastChangedEntries: Array<'A' | 'B' | 'C'> = [];
  public rejectedMarkers: Array<{ x: number; y: number; timer: number }> = [];

  public stats: GameStats = this.emptyStats();
  public rng = new SeededRng();
  private nextId = 1;
  private seenEnemyTypes = new Set<EnemyType>();

  // Hook for demo mode or UI feedback
  public onRoutesUpdated?: () => void;
  public onWaveChanged?: () => void;

  private emptyStats(): GameStats {
    return {
      enemiesDefeated: 0,
      leaks: 0,
      towersLost: 0,
      computeEarned: 0,
      intelEarned: 0,
      intelFromNodes: 0,
      reroutesTriggered: 0,
      damageToTowers: 0,
      healingTotal: 0,
    };
  }

  public startMap(mapId: MapId, isDemo = false): void {
    this.map = MAP_DEFS[mapId];
    this.tiles = createTilesFromMap(this.map);
    this.phase = isDemo ? 'demo' : 'playing';
    this.speed = 1;
    this.elapsed = 0;
    this.nextId = 1;
    this.rng.setSeed(mapId === 'intranet' ? 101 : mapId === 'backbone' ? 202 : 303);

    this.compute = this.map.startCompute;
    this.intel = this.map.startIntel;
    this.integrity = this.map.maxIntegrity;
    this.maxIntegrity = this.map.maxIntegrity;

    this.currentWaveIndex = 0;
    this.waveInProgress = false;
    this.wavePrepTimer = 6.0;
    this.pendingSpawns = [];
    this.waveElapsed = 0;

    this.towers = [];
    this.isolators = [];
    this.enemies = [];
    this.projectiles = [];
    this.bursts = [];
    this.alerts = [];
    this.rejectedMarkers = [];
    this.routeChangeFlashTimer = 0;
    this.lastChangedEntries = [];

    this.itemCooldowns = { isolator: 0, downgrade: 0, restore: 0 };
    this.stats = this.emptyStats();
    this.seenEnemyTypes.clear();

    this.recomputeRoutes(false);

    if (!isDemo) {
      this.pushAlert('info', `守护进程已接入【${this.map.name}】，布防准备就绪。点击“开始波次”迎敌。`);
      audio.setTrack(mapId);
    }
  }

  public pushAlert(level: GameAlert['level'], text: string): void {
    this.alerts.unshift({
      id: this.nextId++,
      level,
      text,
      timer: 4.5,
    });
    if (this.alerts.length > 5) {
      this.alerts.length = 5;
    }
  }

  public startNextWave(): boolean {
    if (this.waveInProgress) return false;
    if (this.currentWaveIndex >= this.map.waves.length) return false;

    this.currentWaveIndex++;
    const wave = this.map.waves[this.currentWaveIndex - 1];
    this.waveInProgress = true;
    this.waveElapsed = 0;
    this.pendingSpawns = [];

    for (const grp of wave.groups) {
      for (let i = 0; i < grp.count; i++) {
        this.pendingSpawns.push({
          time: grp.delay + i * grp.interval,
          enemy: grp.enemy,
          entryId: grp.entryId,
          isSurge: grp.isSurge,
        });
      }
    }
    this.pendingSpawns.sort((a, b) => a.time - b.time);

    if (wave.isBossWave) {
      audio.play('boss_warn');
      this.pushAlert('danger', `⚠ 最高警报：第 ${wave.index} 波【${wave.title}】首领正在接入网络！`);
    } else if (wave.isSurgeWave) {
      audio.play('boss_warn');
      this.pushAlert('warn', `⚡ 洪峰预警：第 ${wave.index} 波【${wave.title}】多入口并发来袭！`);
    } else {
      audio.play('wave_start');
      this.pushAlert('info', `第 ${wave.index}/${this.map.waves.length} 波【${wave.title}】威胁已进入。`);
    }
    this.onWaveChanged?.();
    return true;
  }

  public recomputeRoutes(flashChanges = true): void {
    const prev = this.entryRoutes;
    const next = computeAllEntryRoutes(this.tiles, this.map);
    const changed: Array<'A' | 'B' | 'C'> = [];
    for (const entry of this.map.entries) {
      const a = prev[entry.id];
      const b = next[entry.id];
      if (!a || !b || a.length !== b.length || a.some((p, idx) => p.x !== b[idx].x || p.y !== b[idx].y)) {
        changed.push(entry.id);
      }
    }
    this.entryRoutes = next;
    if (flashChanges && changed.length > 0) {
      this.routeChangeFlashTimer = 2.4;
      this.lastChangedEntries = changed;
      this.stats.reroutesTriggered++;
    }

    // Re-path all alive ground enemies from current tile position!
    const exitCoords = this.map.exits.map((e) => ({ x: e.x, y: e.y }));
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || enemy.isFlying) continue;
      // Clear node-breaker target if that node reopened
      if (enemy.targetNodeKey) {
        const [nx, ny] = enemy.targetNodeKey.split(',').map(Number);
        const nt = this.tiles[ny]?.[nx];
        if (!nt || (nt.towerId === null && nt.isolatorId === null)) {
          enemy.targetNodeKey = null;
        }
      }
      const cx = Math.max(0, Math.min(this.map.cols - 1, Math.round(enemy.x)));
      const cy = Math.max(0, Math.min(this.map.rows - 1, Math.round(enemy.y)));
      const newPath = findShortestPathToAnyExit(
        this.tiles,
        cx,
        cy,
        exitCoords,
        undefined,
        undefined,
        true
      );
      if (newPath && newPath.length > 0) {
        enemy.route = newPath;
        enemy.routeIndex = 0;
        const last = newPath[newPath.length - 1];
        const ex = this.map.exits.find((e) => e.x === last.x && e.y === last.y);
        if (ex) enemy.targetExitId = ex.id;
      }
    }

    this.onRoutesUpdated?.();
  }

  public getTile(x: number, y: number): TileState | null {
    if (y < 0 || y >= this.map.rows || x < 0 || x >= this.map.cols) return null;
    return this.tiles[y][x];
  }

  public getTowerAt(x: number, y: number): TowerEntity | null {
    const t = this.getTile(x, y);
    if (!t || t.towerId === null) return null;
    return this.towers.find((tw) => tw.id === t.towerId) ?? null;
  }

  public getTowerById(id: number): TowerEntity | null {
    return this.towers.find((tw) => tw.id === id) ?? null;
  }

  public getIsolatorAt(x: number, y: number): IsolatorEntity | null {
    const t = this.getTile(x, y);
    if (!t || t.isolatorId === null) return null;
    return this.isolators.find((iso) => iso.id === t.isolatorId) ?? null;
  }

  public previewTowerPlacement(
    type: TowerType,
    x: number,
    y: number
  ): {
    ok: boolean;
    reason?: string;
    routePreview?: RoutePreviewResult;
  } {
    const tile = this.getTile(x, y);
    if (!tile) return { ok: false, reason: '目标位置超出网络边界' };
    const cfg = TOWER_CONFIGS[type];

    if (!cfg.allowedTiles.includes(tile.type as 'link' | 'legacy' | 'node' | 'platform')) {
      return {
        ok: false,
        reason: `${cfg.name}只能部署于${cfg.allowedTiles
          .map((t) =>
            t === 'link' ? '链路' : t === 'legacy' ? '旧链路' : t === 'node' ? '交换节点' : '设备平台'
          )
          .join('/')}`,
      };
    }
    if (tile.towerId !== null || tile.isolatorId !== null) {
      return { ok: false, reason: '该位置已部署设施或隔离器' };
    }
    if (tile.blackholeTimer > 0 || tile.lockdownTimer > 0) {
      return { ok: false, reason: '该区域正处于异常封锁状态，无法部署' };
    }

    let routePreview: RoutePreviewResult | undefined;
    if (tile.type === 'node') {
      if (tile.nodeCooldown > 0) {
        return {
          ok: false,
          reason: `节点旁路冷却中（剩余 ${tile.nodeCooldown.toFixed(1)} 秒），暂不能再次隔离`,
        };
      }
      routePreview = evaluateRouteChange(this.tiles, this.map, this.enemies, [{ x, y }]);
      if (!routePreview.valid) {
        return { ok: false, reason: routePreview.reason, routePreview };
      }
      if (this.intel < cfg.nodeIntelCost) {
        return {
          ok: false,
          reason: `情报不足（隔离节点需 ${cfg.nodeIntelCost} 情报）`,
          routePreview,
        };
      }
    }

    if (this.compute < cfg.computeCost) {
      return {
        ok: false,
        reason: `算力不足（需 ${cfg.computeCost} 算力）`,
        routePreview,
      };
    }

    return { ok: true, routePreview };
  }

  public deployTower(
    type: TowerType,
    x: number,
    y: number,
    direction: Direction = 0
  ): TowerEntity | null {
    const check = this.previewTowerPlacement(type, x, y);
    if (!check.ok) {
      audio.play('reject');
      if (check.reason) this.pushAlert('warn', check.reason);
      if (check.routePreview && !check.routePreview.valid) {
        this.rejectedMarkers = check.routePreview.blockedPoints.map((p) => ({
          x: p.x,
          y: p.y,
          timer: 2.2,
        }));
      }
      return null;
    }

    const tile = this.getTile(x, y)!;
    const cfg = TOWER_CONFIGS[type];
    const intelCost = tile.type === 'node' ? cfg.nodeIntelCost : 0;

    this.compute -= cfg.computeCost;
    this.intel -= intelCost;

    const dirYawMap: Record<Direction, number> = {
      0: 0,
      1: Math.PI / 2,
      2: Math.PI,
      3: -Math.PI / 2,
    };

    const tower: TowerEntity = {
      id: this.nextId++,
      type,
      x,
      y,
      level: 1,
      branch: null,
      direction,
      hp: cfg.maxHp,
      maxHp: cfg.maxHp,
      shield: 0,
      maxShield: 260,
      encryptedTimer: 0,
      encryptResistTimer: 0,
      attackCooldown: 0.15,
      skillCooldown: cfg.skillCooldown ? 2.5 : 0,
      maxSkillCooldown: cfg.skillCooldown ?? 0,
      skillActiveTimer: 0,
      intelTickTimer: GAME_CONSTANTS.NODE_HOLD_INTEL_INTERVAL,
      computeSpent: cfg.computeCost,
      intelSpent: intelCost,
      blockedEnemyIds: [],
      targetId: null,
      secondaryTargetId: null,
      aimYaw: dirYawMap[direction],
      recoil: 0,
      hitFlash: 0,
      healFlash: 0,
      kills: 0,
      damageDealt: 0,
      healingDone: 0,
    };

    this.towers.push(tower);
    tile.towerId = tower.id;

    if (tile.type === 'node') {
      audio.play('isolate');
      this.bursts.push({
        id: this.nextId++,
        kind: 'node_slam',
        x,
        y,
        z: 0.2,
        radius: 1.5,
        color: cfg.accentHex,
        timer: 0,
        duration: 0.45,
      });
      this.recomputeRoutes(true);
      this.pushAlert(
        'info',
        `节点【${tile.nodeName ?? keyOf(x, y)}】已隔离，入侵流量重新收敛。`
      );
    } else {
      audio.play('deploy');
    }

    return tower;
  }

  public upgradeTower(towerId: number, branchId?: BranchId): boolean {
    const tower = this.getTowerById(towerId);
    if (!tower || tower.level >= 2) return false;
    const cfg = TOWER_CONFIGS[tower.type];

    if (cfg.branches) {
      const branch = cfg.branches.find((b) => b.id === branchId);
      if (!branch) return false;
      if (this.compute < branch.computeCost) {
        audio.play('reject');
        this.pushAlert('warn', `算力不足（升级需要 ${branch.computeCost} 算力）`);
        return false;
      }
      if (this.intel < branch.intelCost) {
        audio.play('reject');
        this.pushAlert('warn', `情报不足（分支改造需 ${branch.intelCost} 情报）`);
        return false;
      }
      this.compute -= branch.computeCost;
      this.intel -= branch.intelCost;
      tower.computeSpent += branch.computeCost;
      tower.intelSpent += branch.intelCost;
      tower.level = 2;
      tower.branch = branch.id;

      const hpGain = branch.maxHpBonus;
      tower.maxHp += hpGain;
      tower.hp = Math.min(tower.maxHp, tower.hp + hpGain);
      if (branch.skillCdMult && tower.maxSkillCooldown > 0) {
        tower.maxSkillCooldown *= branch.skillCdMult;
        tower.skillCooldown = Math.min(tower.skillCooldown, tower.maxSkillCooldown);
      }
      audio.play('upgrade');
      this.bursts.push({
        id: this.nextId++,
        kind: 'restore_burst',
        x: tower.x,
        y: tower.y,
        z: this.getTowerElevation(tower) + 0.3,
        radius: 1.35,
        color: cfg.accentHex,
        timer: 0,
        duration: 0.55,
      });
      this.pushAlert('success', `${cfg.name}已改造为【${branch.name}】`);
      return true;
    }

    if (this.compute < cfg.lv2ComputeCost) {
      audio.play('reject');
      this.pushAlert('warn', `算力不足（升级需 ${cfg.lv2ComputeCost} 算力）`);
      return false;
    }
    this.compute -= cfg.lv2ComputeCost;
    tower.computeSpent += cfg.lv2ComputeCost;
    tower.level = 2;
    const hpDiff = cfg.lv2Hp - cfg.maxHp;
    tower.maxHp = cfg.lv2Hp;
    tower.hp = Math.min(tower.maxHp, tower.hp + hpDiff);
    if (tower.type === 'gate') {
      tower.shield = Math.max(tower.shield, 200);
    }
    audio.play('upgrade');
    this.bursts.push({
      id: this.nextId++,
      kind: 'restore_burst',
      x: tower.x,
      y: tower.y,
      z: this.getTowerElevation(tower) + 0.3,
      radius: 1.35,
      color: cfg.accentHex,
      timer: 0,
      duration: 0.55,
    });
    this.pushAlert('success', `${cfg.name}已升级至 2 级【${cfg.lv2Name}】`);
    return true;
  }

  public triggerTowerSkill(towerId: number): boolean {
    const tower = this.getTowerById(towerId);
    if (!tower) return false;
    const cfg = TOWER_CONFIGS[tower.type];
    if (!cfg.skillName) return false;
    if (tower.encryptedTimer > 0) {
      audio.play('reject');
      this.pushAlert('warn', `${cfg.name}正处于「加密」锁定中，无法释放技能！`);
      return false;
    }
    if (tower.skillCooldown > 0) {
      audio.play('reject');
      return false;
    }

    tower.skillCooldown = tower.maxSkillCooldown;
    tower.skillActiveTimer = 1.2;

    if (tower.type === 'honeypot') {
      const isMimic = tower.branch === 'honeypot_mimic';
      const isSnare = tower.branch === 'honeypot_snare';
      const radius = isMimic ? 3.2 : 2.5;
      const rootDur = isMimic ? 4.5 : 3.6;

      for (const e of this.enemies) {
        if (e.hp <= 0 || e.isFlying) continue;
        const d = Math.hypot(e.x - tower.x, e.y - tower.y);
        if (d <= radius) {
          e.snaredTimer = Math.max(e.snaredTimer, rootDur);
          if (isSnare) {
            e.vulnerableTimer = Math.max(e.vulnerableTimer, 5.0);
          }
          if (e.disguised) {
            e.disguised = false;
            e.detected = true;
          }
          this.damageEnemy(e, isMimic ? 42 : 30, tower, false);
        }
      }

      audio.play('snare_cast');
      this.bursts.push({
        id: this.nextId++,
        kind: 'snare_cage',
        x: tower.x,
        y: tower.y,
        z: 0.15,
        radius,
        color: cfg.accentHex,
        timer: 0,
        duration: 0.9,
      });
      this.pushAlert('info', `蜜罐释放「诱捕」，禁锢周围来袭恶意程序！`);
      return true;
    }

    if (tower.type === 'repair') {
      const range = this.getTowerRange(tower);
      let affected = 0;
      for (const ally of this.towers) {
        if (ally.hp <= 0) continue;
        const d = Math.hypot(ally.x - tower.x, ally.y - tower.y);
        if (d <= range) {
          ally.encryptedTimer = 0;
          ally.encryptResistTimer = 2.0;
          ally.shield = Math.min(ally.maxShield, ally.shield + 240);
          const healAmt = 70;
          const prevHp = ally.hp;
          ally.hp = Math.min(ally.maxHp, ally.hp + healAmt);
          ally.healFlash = 0.7;
          const gained = ally.hp - prevHp;
          tower.healingDone += gained;
          this.stats.healingTotal += gained;
          affected++;
        }
      }
      audio.play('failover_cast');
      this.bursts.push({
        id: this.nextId++,
        kind: 'failover_wave',
        x: tower.x,
        y: tower.y,
        z: GAME_CONSTANTS.PLATFORM_HEIGHT + 0.3,
        radius: range,
        color: 0x34d399,
        timer: 0,
        duration: 0.85,
      });
      this.pushAlert('success', `「冗余切换」已启动，为 ${affected} 座友塔施加护盾并解除加密！`);
      return true;
    }

    return false;
  }

  public undeployTower(towerId: number): boolean {
    const idx = this.towers.findIndex((t) => t.id === towerId);
    if (idx === -1) return false;
    const tower = this.towers[idx];
    const refund = Math.round(tower.computeSpent * GAME_CONSTANTS.REFUND_RATIO);
    this.compute += refund;

    this.releaseBlockedEnemies(tower);
    this.towers.splice(idx, 1);

    const tile = this.getTile(tower.x, tower.y);
    if (tile) {
      tile.towerId = null;
      if (tile.type === 'node') {
        tile.nodeCooldown = GAME_CONSTANTS.NODE_REISOLATE_COOLDOWN;
        this.recomputeRoutes(true);
        this.pushAlert('info', `节点【${tile.nodeName ?? keyOf(tile.x, tile.y)}】已撤防，道路旁路直通。`);
      }
    }

    audio.play('undeploy');
    return true;
  }

  public previewItemPlacement(
    itemId: ItemId,
    x: number,
    y: number
  ): {
    ok: boolean;
    reason?: string;
    affectedTiles?: GridCoord[];
    routePreview?: RoutePreviewResult;
  } {
    const tile = this.getTile(x, y);
    if (!tile) return { ok: false, reason: '超出目标区域' };
    const cfg = ITEM_CONFIGS[itemId];

    if (this.itemCooldowns[itemId] > 0) {
      return {
        ok: false,
        reason: `${cfg.name}冷却中（剩余 ${this.itemCooldowns[itemId].toFixed(1)} 秒）`,
      };
    }

    if (itemId === 'isolator') {
      if (tile.type !== 'node') {
        return { ok: false, reason: '应急隔离器只能投放于直通交换节点' };
      }
      if (tile.towerId !== null || tile.isolatorId !== null) {
        return { ok: false, reason: '该节点已被占用或隔离' };
      }
      if (tile.nodeCooldown > 0) {
        return {
          ok: false,
          reason: `节点冷却中（剩余 ${tile.nodeCooldown.toFixed(1)} 秒）`,
        };
      }
      const routePreview = evaluateRouteChange(this.tiles, this.map, this.enemies, [{ x, y }]);
      if (!routePreview.valid) {
        return { ok: false, reason: routePreview.reason, routePreview };
      }
      if (this.intel < cfg.cost) {
        return { ok: false, reason: `情报不足（需 ${cfg.cost} 情报）`, routePreview };
      }
      return { ok: true, affectedTiles: [{ x, y }], routePreview };
    }

    if (itemId === 'downgrade') {
      const affectedTiles: GridCoord[] = [];
      for (let ty = 0; ty < this.map.rows; ty++) {
        for (let tx = 0; tx < this.map.cols; tx++) {
          const t = this.tiles[ty][tx];
          if (t.type !== 'link' && t.type !== 'legacy') continue;
          if (Math.hypot(tx - x, ty - y) <= GAME_CONSTANTS.DOWNGRADE_RADIUS) {
            affectedTiles.push({ x: tx, y: ty });
          }
        }
      }
      if (affectedTiles.length === 0) {
        return { ok: false, reason: '协议降级需覆盖至少一条链路道路' };
      }
      const routePreview = evaluateRouteChange(
        this.tiles,
        this.map,
        this.enemies,
        undefined,
        affectedTiles
      );
      if (this.intel < cfg.cost) {
        return { ok: false, reason: `情报不足（需 ${cfg.cost} 情报）`, affectedTiles, routePreview };
      }
      return { ok: true, affectedTiles, routePreview };
    }

    if (itemId === 'restore') {
      const tower = this.getTowerAt(x, y);
      if (!tower) {
        return { ok: false, reason: '备份还原需选中一座已部署的友塔' };
      }
      if (this.compute < cfg.cost) {
        return { ok: false, reason: `算力不足（需 ${cfg.cost} 算力）` };
      }
      return { ok: true, affectedTiles: [{ x, y }] };
    }

    return { ok: false };
  }

  public useItem(itemId: ItemId, x: number, y: number): boolean {
    const check = this.previewItemPlacement(itemId, x, y);
    if (!check.ok) {
      audio.play('reject');
      if (check.reason) this.pushAlert('warn', check.reason);
      if (check.routePreview && !check.routePreview.valid) {
        this.rejectedMarkers = check.routePreview.blockedPoints.map((p) => ({
          x: p.x,
          y: p.y,
          timer: 2.2,
        }));
      }
      return false;
    }

    const cfg = ITEM_CONFIGS[itemId];
    if (cfg.resource === 'intel') this.intel -= cfg.cost;
    else this.compute -= cfg.cost;
    this.itemCooldowns[itemId] = cfg.cooldown;

    if (itemId === 'isolator') {
      const tile = this.getTile(x, y)!;
      const iso: IsolatorEntity = {
        id: this.nextId++,
        x,
        y,
        hp: GAME_CONSTANTS.ISOLATOR_HP,
        maxHp: GAME_CONSTANTS.ISOLATOR_HP,
        timer: GAME_CONSTANTS.ISOLATOR_DURATION,
        maxTimer: GAME_CONSTANTS.ISOLATOR_DURATION,
        hitFlash: 0,
      };
      this.isolators.push(iso);
      tile.isolatorId = iso.id;
      audio.play('isolate');
      this.bursts.push({
        id: this.nextId++,
        kind: 'node_slam',
        x,
        y,
        z: 0.2,
        radius: 1.4,
        color: 0xfbbf24,
        timer: 0,
        duration: 0.45,
      });
      this.recomputeRoutes(true);
      this.pushAlert('info', `应急隔离器部署于【${tile.nodeName ?? keyOf(x, y)}】。`);
      return true;
    }

    if (itemId === 'downgrade') {
      for (const c of check.affectedTiles ?? []) {
        const t = this.getTile(c.x, c.y);
        if (t) {
          t.downgradeTimer = Math.max(t.downgradeTimer, GAME_CONSTANTS.DOWNGRADE_DURATION);
        }
      }
      audio.play('item_downgrade');
      this.bursts.push({
        id: this.nextId++,
        kind: 'downgrade_ring',
        x,
        y,
        z: 0.1,
        radius: GAME_CONSTANTS.DOWNGRADE_RADIUS,
        color: 0xf59e0b,
        timer: 0,
        duration: 0.75,
      });
      this.recomputeRoutes(true);
      this.pushAlert('info', `协议降级生效：目标链路降速并强制显形伪装目标。`);
      return true;
    }

    if (itemId === 'restore') {
      const tower = this.getTowerAt(x, y);
      if (!tower) return false;
      const heal = Math.max(
        GAME_CONSTANTS.RESTORE_HEAL_AMOUNT,
        Math.round(tower.maxHp * GAME_CONSTANTS.RESTORE_HEAL_RATIO)
      );
      const prev = tower.hp;
      tower.hp = Math.min(tower.maxHp, tower.hp + heal);
      tower.encryptedTimer = 0;
      tower.healFlash = 0.8;
      const gained = tower.hp - prev;
      this.stats.healingTotal += gained;
      audio.play('item_restore');
      this.bursts.push({
        id: this.nextId++,
        kind: 'restore_burst',
        x: tower.x,
        y: tower.y,
        z: 0.4,
        radius: 1.2,
        color: 0x34d399,
        timer: 0,
        duration: 0.65,
      });
      this.pushAlert('success', `备份还原完成：${TOWER_CONFIGS[tower.type].name}恢复生命并解除加密。`);
      return true;
    }

    return false;
  }

  public getTowerRange(t: TowerEntity): number {
    const cfg = TOWER_CONFIGS[t.type];
    let r = t.level === 2 ? cfg.lv2Range : cfg.range;
    if (t.branch && cfg.branches) {
      const b = cfg.branches.find((br) => br.id === t.branch);
      if (b?.rangeBonus) r += b.rangeBonus;
    }
    return r;
  }

  public getTowerDamage(t: TowerEntity): number {
    const cfg = TOWER_CONFIGS[t.type];
    let d = t.level === 2 ? cfg.lv2Damage : cfg.attackDamage;
    if (t.branch && cfg.branches) {
      const b = cfg.branches.find((br) => br.id === t.branch);
      if (b?.damageMult) d *= b.damageMult;
    }
    return d;
  }

  public getTowerBlockCap(t: TowerEntity): number {
    const cfg = TOWER_CONFIGS[t.type];
    let c = t.level === 2 ? cfg.lv2BlockCap : cfg.blockCap;
    if (t.branch && cfg.branches) {
      const b = cfg.branches.find((br) => br.id === t.branch);
      if (b?.blockBonus) c += b.blockBonus;
    }
    return c;
  }

  public isInInterceptorZone(tower: TowerEntity, ex: number, ey: number): boolean {
    const dx = ex - tower.x;
    const dy = ey - tower.y;
    const reach = this.getTowerRange(tower);
    // Project onto facing forward vector and lateral perpendicular
    let forward = 0;
    let lateral = 0;
    switch (tower.direction) {
      case 0: // +Y (South on screen)
        forward = dy;
        lateral = Math.abs(dx);
        break;
      case 1: // +X (East)
        forward = dx;
        lateral = Math.abs(dy);
        break;
      case 2: // -Y (North)
        forward = -dy;
        lateral = Math.abs(dx);
        break;
      case 3: // -X (West)
        forward = -dx;
        lateral = Math.abs(dy);
        break;
    }
    return forward >= -0.6 && forward <= reach && lateral <= 1.55;
  }

  public step(dt: number): void {
    if (this.phase !== 'playing' && this.phase !== 'demo') return;
    const simDt = dt * (this.phase === 'demo' ? 1 : this.speed);
    this.elapsed += simDt;

    // Passive compute recovery
    if (this.waveInProgress) {
      const inc = GAME_CONSTANTS.PASSIVE_COMPUTE_PER_SEC * simDt;
      this.compute += inc;
      this.stats.computeEarned += inc;
    } else if (this.phase === 'playing') {
      this.compute += 1.2 * simDt;
      this.stats.computeEarned += 1.2 * simDt;
    }

    // Alerts & flashes
    for (let i = this.alerts.length - 1; i >= 0; i--) {
      this.alerts[i].timer -= dt;
      if (this.alerts[i].timer <= 0) this.alerts.splice(i, 1);
    }
    for (let i = this.rejectedMarkers.length - 1; i >= 0; i--) {
      this.rejectedMarkers[i].timer -= dt;
      if (this.rejectedMarkers[i].timer <= 0) this.rejectedMarkers.splice(i, 1);
    }
    if (this.routeChangeFlashTimer > 0) {
      this.routeChangeFlashTimer = Math.max(0, this.routeChangeFlashTimer - dt);
    }

    // Item cooldowns
    for (const k of Object.keys(this.itemCooldowns) as ItemId[]) {
      if (this.itemCooldowns[k] > 0) {
        this.itemCooldowns[k] = Math.max(0, this.itemCooldowns[k] - simDt);
      }
    }

    // Tile timers (cooldowns, downgrade, blackholes, lockdowns, telegraphs)
    let routeNeedsRecalc = false;
    for (let y = 0; y < this.map.rows; y++) {
      for (let x = 0; x < this.map.cols; x++) {
        const t = this.tiles[y][x];
        if (t.nodeCooldown > 0) {
          t.nodeCooldown = Math.max(0, t.nodeCooldown - simDt);
        }
        if (t.downgradeTimer > 0) {
          t.downgradeTimer = Math.max(0, t.downgradeTimer - simDt);
          if (t.downgradeTimer === 0) routeNeedsRecalc = true;
        }
        if (t.blackholeTimer > 0) {
          t.blackholeTimer = Math.max(0, t.blackholeTimer - simDt);
          if (t.blackholeTimer === 0) routeNeedsRecalc = true;
        }
        if (t.lockdownTimer > 0) {
          t.lockdownTimer = Math.max(0, t.lockdownTimer - simDt);
          if (t.lockdownTimer === 0) routeNeedsRecalc = true;
        }
        if (t.telegraphTimer > 0) {
          t.telegraphTimer = Math.max(0, t.telegraphTimer - simDt);
          if (t.telegraphTimer === 0 && t.telegraphType !== 'none') {
            this.resolveTileTelegraph(t);
          }
        }
      }
    }
    if (routeNeedsRecalc) {
      this.recomputeRoutes(true);
    }

    // Isolator timers
    for (let i = this.isolators.length - 1; i >= 0; i--) {
      const iso = this.isolators[i];
      iso.timer -= simDt;
      iso.hitFlash = Math.max(0, iso.hitFlash - simDt * 4);
      if (iso.timer <= 0 || iso.hp <= 0) {
        const tile = this.getTile(iso.x, iso.y);
        if (tile) {
          tile.isolatorId = null;
          tile.nodeCooldown = GAME_CONSTANTS.NODE_REISOLATE_COOLDOWN;
        }
        this.bursts.push({
          id: this.nextId++,
          kind: 'node_break',
          x: iso.x,
          y: iso.y,
          z: 0.3,
          radius: 1.5,
          color: 0xfbbf24,
          timer: 0,
          duration: 0.55,
        });
        audio.play('node_break');
        this.isolators.splice(i, 1);
        this.recomputeRoutes(true);
      }
    }

    // Wave spawning
    if (this.waveInProgress) {
      this.waveElapsed += simDt;
      while (this.pendingSpawns.length > 0 && this.pendingSpawns[0].time <= this.waveElapsed) {
        const sp = this.pendingSpawns.shift()!;
        this.spawnEnemy(sp.enemy, sp.entryId);
      }
    }

    // Update towers
    this.updateTowers(simDt);

    // Update enemies
    this.updateEnemies(simDt);

    // Update VFX timers
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].timer += simDt;
      if (this.projectiles[i].timer >= this.projectiles[i].duration) {
        this.projectiles.splice(i, 1);
      }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      this.bursts[i].timer += simDt;
      if (this.bursts[i].timer >= this.bursts[i].duration) {
        this.bursts.splice(i, 1);
      }
    }

    // Check wave completion / victory / defeat
    if (this.phase === 'playing') {
      if (this.integrity <= 0) {
        this.integrity = 0;
        this.phase = 'defeat';
        audio.play('defeat');
        audio.stopMusic();
        return;
      }

      if (
        this.waveInProgress &&
        this.pendingSpawns.length === 0 &&
        this.enemies.length === 0
      ) {
        const wave = this.map.waves[this.currentWaveIndex - 1];
        this.waveInProgress = false;
        this.intel += wave.intelBonus;
        this.stats.intelEarned += wave.intelBonus;

        if (this.currentWaveIndex >= this.map.waves.length) {
          this.phase = 'victory';
          audio.play('victory');
          audio.stopMusic();
          return;
        } else {
          this.pushAlert(
            'success',
            `第 ${wave.index} 波【${wave.title}】已击退！回收情报 +${wave.intelBonus}。`
          );
          this.onWaveChanged?.();
        }
      }
    }
  }

  private resolveTileTelegraph(tile: TileState): void {
    const kind = tile.telegraphType;
    tile.telegraphType = 'none';

    if (kind === 'blackhole') {
      // Re-verify connectivity before locking!
      const check = evaluateRouteChange(this.tiles, this.map, this.enemies, [
        { x: tile.x, y: tile.y },
      ]);
      if (check.valid) {
        tile.blackholeTimer = 9.0;
        audio.play('node_break');
        this.bursts.push({
          id: this.nextId++,
          kind: 'route_storm',
          x: tile.x,
          y: tile.y,
          z: 0.25,
          radius: 1.4,
          color: 0xec4899,
          timer: 0,
          duration: 0.75,
        });
        this.pushAlert('danger', '蜃楼「伪路由」生效：前方链路出现路由黑洞，流向被迫改道！');
        this.recomputeRoutes(true);
      }
    } else if (kind === 'lockdown') {
      const check = evaluateRouteChange(this.tiles, this.map, this.enemies, [
        { x: tile.x, y: tile.y },
      ]);
      if (check.valid) {
        tile.lockdownTimer = 12.0;
        audio.play('node_break');
        this.bursts.push({
          id: this.nextId++,
          kind: 'node_slam',
          x: tile.x,
          y: tile.y,
          z: 0.25,
          radius: 1.5,
          color: 0xf43f5e,
          timer: 0,
          duration: 0.7,
        });
        this.pushAlert('danger', '蛰影「破坏阶段」触发：运维环路段被锁死，全网流量重收敛！');
        this.recomputeRoutes(true);
      }
    } else if (kind === 'surge') {
      const boss = this.enemies.find((en) => en.type === 'boss_wankui' && en.hp > 0);
      if (boss) {
        this.projectiles.push({
          id: this.nextId++,
          kind: 'boss_surge',
          fromX: boss.x,
          fromY: boss.y,
          fromZ: 1.0,
          toX: tile.x,
          toY: tile.y,
          toZ: 0.45,
          color: 0xef4444,
          timer: 0,
          duration: 0.48,
          width: 3.6,
        });
      }
      audio.play('node_break');
      this.bursts.push({
        id: this.nextId++,
        kind: 'node_slam',
        x: tile.x,
        y: tile.y,
        z: 0.45,
        radius: 1.75,
        color: 0xef4444,
        timer: 0,
        duration: 0.65,
      });
      if (tile.isolatorId !== null) {
        const iso = this.isolators.find((x) => x.id === tile.isolatorId);
        if (iso) {
          iso.hp = 0;
          this.pushAlert('danger', '万傀「洪峰」命中节点，瞬间震毁应急隔离器！');
        }
      } else if (tile.towerId !== null) {
        const tw = this.getTowerById(tile.towerId);
        if (tw) {
          this.damageTower(tw, 310, boss ?? null);
          this.pushAlert('danger', '万傀「洪峰」过载轰击节点，重创守卫防御设施！');
        }
      }
    }
  }

  public spawnEnemy(
    type: EnemyType,
    entryId: 'A' | 'B' | 'C',
    atPos?: GridCoord,
    isClone = false
  ): EnemyEntity {
    const cfg = ENEMY_CONFIGS[type];
    const entry = this.map.entries.find((e) => e.id === entryId) ?? this.map.entries[0];
    const sx = atPos ? atPos.x : entry.x;
    const sy = atPos ? atPos.y : entry.y;

    let route = this.entryRoutes[entry.id] ?? [];
    if (atPos) {
      const exitCoords = this.map.exits.map((ex) => ({ x: ex.x, y: ex.y }));
      route =
        findShortestPathToAnyExit(this.tiles, sx, sy, exitCoords, undefined, undefined, true) ??
        route;
    }

    // Assign exit for flying enemies cleanly
    let targetExit = this.map.exits[0];
    if (cfg.isFlying) {
      if (this.map.exits.length > 1) {
        // Pick nearest or entry-mapped exit
        if (entryId === 'B' && this.map.exits[1]) {
          targetExit = this.map.exits[1];
        } else if (entryId === 'C' && this.map.exits[1]) {
          targetExit = this.rng.next() < 0.5 ? this.map.exits[0] : this.map.exits[1];
        }
      }
    } else if (route.length > 0) {
      const end = route[route.length - 1];
      targetExit = this.map.exits.find((e) => e.x === end.x && e.y === end.y) ?? targetExit;
    }

    const disguised = type === 'trojan' || type === 'boss_zheying';
    const e: EnemyEntity = {
      id: this.nextId++,
      type,
      entryId: entry.id,
      targetExitId: targetExit.id,
      isBoss: cfg.category === 'boss',
      isFlying: cfg.isFlying,
      isClone,
      x: sx,
      y: sy,
      vx: 0,
      vy: 0,
      yaw: 0,
      hp: isClone ? Math.round(cfg.maxHp * 0.72) : cfg.maxHp,
      maxHp: isClone ? Math.round(cfg.maxHp * 0.72) : cfg.maxHp,
      shield: 0,
      maxShield: GAME_CONSTANTS.PACKER_SHIELD_MAX,
      armor: cfg.armor,
      speed: cfg.speed,
      blockWeight: cfg.blockWeight,
      blockedByTowerId: null,
      disguised,
      detected: !disguised,
      snaredTimer: 0,
      slowTimer: 0,
      slowFactor: 1,
      vulnerableTimer: 0,
      dotTimer: 0,
      dotDps: 0,
      attackCooldown: 0.4,
      abilityCooldown: cfg.category === 'boss' ? 4.5 : 2.5,
      bossPhase: 1,
      hasReplicated: isClone,
      passedNodes: new Set(),
      route: route.map((c) => ({ ...c })),
      routeIndex: 0,
      targetNodeKey: null,
      flightProgress: 0,
      animPhase: this.rng.next() * Math.PI * 2,
      hitFlash: 0,
      attackAnim: 0,
      lastTargetTowerId: null,
    };

    this.enemies.push(e);

    if (!isClone && !this.seenEnemyTypes.has(type)) {
      this.seenEnemyTypes.add(type);
      if (cfg.category === 'boss') {
        audio.play('boss_warn');
        this.pushAlert('danger', `★ 首领【${cfg.name}】从入口 ${entry.id} 突入！${cfg.summary}`);
      } else if (this.phase === 'playing') {
        this.pushAlert('info', `🔍 新威胁接入：【${cfg.name}】— ${cfg.role}`);
      }
    }

    return e;
  }

  private getRemainingRouteDistance(e: EnemyEntity): number {
    if (e.isFlying) {
      const exit = this.map.exits.find((ex) => ex.id === e.targetExitId) ?? this.map.exits[0];
      return Math.hypot(exit.x - e.x, exit.y - e.y);
    }
    if (e.route.length === 0) return 999;
    const idx = Math.min(e.routeIndex, e.route.length - 1);
    const nextPt = e.route[idx];
    const distToNext = Math.hypot(nextPt.x - e.x, nextPt.y - e.y);
    return distToNext + (e.route.length - 1 - idx);
  }

  private updateTowers(dt: number): void {
    const aliveInCombat = this.waveInProgress || this.enemies.length > 0;

    for (let i = this.towers.length - 1; i >= 0; i--) {
      const tower = this.towers[i];
      tower.recoil = Math.max(0, tower.recoil - dt * 4.5);
      tower.hitFlash = Math.max(0, tower.hitFlash - dt * 4.0);
      tower.healFlash = Math.max(0, tower.healFlash - dt * 2.5);
      tower.skillActiveTimer = Math.max(0, tower.skillActiveTimer - dt);
      tower.encryptResistTimer = Math.max(0, tower.encryptResistTimer - dt);

      if (tower.encryptedTimer > 0) {
        tower.encryptedTimer = Math.max(0, tower.encryptedTimer - dt);
      }
      if (tower.skillCooldown > 0 && tower.encryptedTimer <= 0) {
        tower.skillCooldown = Math.max(0, tower.skillCooldown - dt);
      }

      // Lv2 Gate slow shield regen
      if (tower.type === 'gate' && tower.level === 2 && tower.shield < 200) {
        tower.shield = Math.min(200, tower.shield + 8 * dt);
      }

      // Continuous Intel generation on isolated nodes during combat!
      const tile = this.getTile(tower.x, tower.y);
      if (tile?.type === 'node' && aliveInCombat && (tower.type === 'gate' || tower.type === 'firewall')) {
        tower.intelTickTimer -= dt;
        if (tower.intelTickTimer <= 0) {
          const interval =
            tower.type === 'gate'
              ? tower.level === 2
                ? 3.1
                : 3.8
              : 4.8;
          tower.intelTickTimer = interval;
          const amount = tower.type === 'gate' && tower.level === 2 ? 2 : 1;
          this.intel += amount;
          this.stats.intelEarned += amount;
          this.stats.intelFromNodes += amount;
          this.bursts.push({
            id: this.nextId++,
            kind: 'intel_ping',
            x: tower.x,
            y: tower.y,
            z: GAME_CONSTANTS.NODE_HEIGHT + 1.15,
            radius: 0.72,
            color: 0x38bdf8,
            timer: 0,
            duration: 0.62,
          });
        }
      }

      // Clean up dead/escaped blocked enemies
      tower.blockedEnemyIds = tower.blockedEnemyIds.filter((eid) => {
        const en = this.enemies.find((x) => x.id === eid);
        return en && en.hp > 0 && en.blockedByTowerId === tower.id;
      });

      // Encryption freezes attack, heal, and active skills (but NOT blocking or node isolation!)
      if (tower.encryptedTimer > 0) {
        tower.targetId = null;
        tower.secondaryTargetId = null;
        continue;
      }

      const cfg = TOWER_CONFIGS[tower.type];

      // Sandbox Detection Aura + AOE Attack
      if (tower.type === 'sandbox') {
        const radius = this.getTowerRange(tower);
        const candidates: EnemyEntity[] = [];
        for (const e of this.enemies) {
          if (e.hp <= 0 || e.isFlying) continue;
          const d = Math.hypot(e.x - tower.x, e.y - tower.y);
          if (d <= radius) {
            if (!e.detected) {
              e.detected = true;
              e.disguised = false;
              audio.play('trojan_reveal');
              this.pushAlert('info', `沙箱检测显形了伪装目标【${ENEMY_CONFIGS[e.type].name}】！`);
            }
            candidates.push(e);
          }
        }
        tower.attackCooldown -= dt;
        if (tower.attackCooldown <= 0 && candidates.length > 0) {
          tower.attackCooldown = cfg.attackInterval;
          tower.recoil = 1.0;
          const dmg = this.getTowerDamage(tower);
          for (const e of candidates) {
            this.damageEnemy(e, dmg, tower, false);
            if (tower.level === 2) {
              e.dotTimer = 2.2;
              e.dotDps = 14;
              e.slowTimer = Math.max(e.slowTimer, 1.5);
              e.slowFactor = Math.min(e.slowFactor, 0.85);
            }
          }
          audio.play('sandbox_pulse');
          this.bursts.push({
            id: this.nextId++,
            kind: 'sandbox_ring',
            x: tower.x,
            y: tower.y,
            z: GAME_CONSTANTS.PLATFORM_HEIGHT + 0.35,
            radius,
            color: cfg.accentHex,
            timer: 0,
            duration: 0.55,
          });
        }
        continue;
      }

      // Repair Daemon Healing
      if (tower.type === 'repair') {
        const range = this.getTowerRange(tower);
        const damaged = this.towers
          .filter(
            (ally) =>
              ally.hp > 0 &&
              ally.hp < ally.maxHp &&
              Math.hypot(ally.x - tower.x, ally.y - tower.y) <= range
          )
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);

        tower.targetId = damaged[0]?.id ?? null;
        tower.secondaryTargetId = tower.level === 2 ? damaged[1]?.id ?? null : null;

        const rate = tower.level === 2 ? cfg.lv2HealPerSec : cfg.healPerSec;
        const targets = tower.level === 2 ? damaged.slice(0, 2) : damaged.slice(0, 1);

        tower.attackCooldown -= dt;
        for (const ally of targets) {
          const prev = ally.hp;
          ally.hp = Math.min(ally.maxHp, ally.hp + rate * dt);
          ally.healFlash = Math.max(ally.healFlash, 0.25);
          const gained = ally.hp - prev;
          tower.healingDone += gained;
          this.stats.healingTotal += gained;

          if (tower.attackCooldown <= 0) {
            this.projectiles.push({
              id: this.nextId++,
              kind: 'heal_beam',
              fromX: tower.x,
              fromY: tower.y,
              fromZ: GAME_CONSTANTS.PLATFORM_HEIGHT + 1.0,
              toX: ally.x,
              toY: ally.y,
              toZ: this.getTowerElevation(ally) + 0.55,
              color: 0x34d399,
              timer: 0,
              duration: 0.42,
              width: 1.5,
            });
          }
        }
        if (tower.attackCooldown <= 0) {
          tower.attackCooldown = 0.42;
        }
        continue;
      }

      // Interceptor Directional Ranged Attack
      if (tower.type === 'interceptor') {
        tower.attackCooldown -= dt;
        const validTargets = this.enemies
          .filter(
            (e) =>
              e.hp > 0 &&
              e.detected &&
              this.isInInterceptorZone(tower, e.x, e.y)
          )
          .sort((a, b) => this.getRemainingRouteDistance(a) - this.getRemainingRouteDistance(b));

        const target = validTargets[0];
        tower.targetId = target?.id ?? null;

        if (target) {
          tower.aimYaw = Math.atan2(target.x - tower.x, target.y - tower.y);
          if (tower.attackCooldown <= 0) {
            let interval = cfg.attackInterval;
            if (tower.branch && cfg.branches) {
              const b = cfg.branches.find((br) => br.id === tower.branch);
              if (b?.rateMult) interval *= b.rateMult;
            }
            tower.attackCooldown = interval;
            tower.recoil = 1.0;

            const dmg = this.getTowerDamage(tower);
            const toZ = target.isFlying ? GAME_CONSTANTS.FLY_HEIGHT : 0.48;

            if (tower.branch === 'interceptor_pierce') {
              // Piercing rail lance hits target + up to 2 aligned enemies behind along ray
              const dx = target.x - tower.x;
              const dy = target.y - tower.y;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len;
              const uy = dy / len;

              this.damageEnemy(target, dmg, tower, true, true);
              let pierced = 0;
              let endX = target.x + ux * 1.4;
              let endY = target.y + uy * 1.4;

              const behind = this.enemies
                .filter((e) => e.id !== target.id && e.hp > 0)
                .map((e) => {
                  const ex = e.x - tower.x;
                  const ey = e.y - tower.y;
                  const proj = ex * ux + ey * uy;
                  const perp = Math.abs(ex * uy - ey * ux);
                  return { e, proj, perp };
                })
                .filter((x) => x.proj > len - 0.15 && x.proj <= len + 3.2 && x.perp <= 0.72)
                .sort((a, b) => a.proj - b.proj);

              for (const b of behind) {
                if (pierced >= 2) break;
                this.damageEnemy(b.e, dmg * 0.85, tower, true, true);
                endX = b.e.x;
                endY = b.e.y;
                pierced++;
              }

              audio.play('laser_pierce');
              this.projectiles.push({
                id: this.nextId++,
                kind: 'pierce_rail',
                fromX: tower.x,
                fromY: tower.y,
                fromZ: GAME_CONSTANTS.PLATFORM_HEIGHT + 0.85,
                toX: endX,
                toY: endY,
                toZ,
                color: 0xe0f2fe,
                timer: 0,
                duration: 0.24,
                width: 2.8,
              });
            } else if (tower.branch === 'interceptor_suppress') {
              this.damageEnemy(target, dmg, tower, false);
              target.slowTimer = Math.max(target.slowTimer, 2.2);
              target.slowFactor = Math.min(target.slowFactor, 0.55);
              audio.play('suppress_shot');
              this.projectiles.push({
                id: this.nextId++,
                kind: 'suppress_bolt',
                fromX: tower.x,
                fromY: tower.y,
                fromZ: GAME_CONSTANTS.PLATFORM_HEIGHT + 0.85,
                toX: target.x,
                toY: target.y,
                toZ,
                color: 0x38bdf8,
                timer: 0,
                duration: 0.2,
                width: 2.0,
              });
            } else {
              this.damageEnemy(target, dmg, tower, false);
              audio.play('laser_rail');
              this.projectiles.push({
                id: this.nextId++,
                kind: 'rail',
                fromX: tower.x,
                fromY: tower.y,
                fromZ: GAME_CONSTANTS.PLATFORM_HEIGHT + 0.85,
                toX: target.x,
                toY: target.y,
                toZ,
                color: 0x22d3ee,
                timer: 0,
                duration: 0.16,
                width: 1.6,
              });
            }
          }
        }
        continue;
      }

      // Firewall / Honeypot Melee & Adjacent Interception
      if (tower.type === 'firewall' || tower.type === 'honeypot') {
        const range = tower.type === 'firewall' ? this.getTowerRange(tower) : 1.1;
        const isSnareBranch = tower.branch === 'honeypot_snare';

        // Magnetic Snare branch passive micro-slow + zap inside lure radius
        if (tower.type === 'honeypot' && isSnareBranch) {
          const lureR = this.getTowerRange(tower);
          for (const e of this.enemies) {
            if (e.hp <= 0 || e.isFlying) continue;
            if (Math.hypot(e.x - tower.x, e.y - tower.y) <= lureR) {
              e.slowTimer = Math.max(e.slowTimer, 0.4);
              e.slowFactor = Math.min(e.slowFactor, 0.65);
            }
          }
        }

        tower.attackCooldown -= dt;
        const blockedList = tower.blockedEnemyIds
          .map((eid) => this.enemies.find((e) => e.id === eid))
          .filter((e): e is EnemyEntity => !!e && e.hp > 0);

        let targets = blockedList;
        // Node-mounted firewall also intercepts adjacent link enemies!
        if (targets.length === 0 && tower.type === 'firewall' && tile?.type === 'node') {
          targets = this.enemies
            .filter(
              (e) =>
                e.hp > 0 &&
                !e.isFlying &&
                Math.hypot(e.x - tower.x, e.y - tower.y) <= range + 0.35
            )
            .sort((a, b) => this.getRemainingRouteDistance(a) - this.getRemainingRouteDistance(b));
        }

        const maxHits = tower.type === 'firewall' && tower.level === 2 ? 2 : 1;
        const strikeTargets = targets.slice(0, maxHits);
        tower.targetId = strikeTargets[0]?.id ?? null;

        if (strikeTargets.length > 0 && tower.attackCooldown <= 0) {
          tower.attackCooldown = cfg.attackInterval;
          tower.recoil = 1.0;
          const dmg = this.getTowerDamage(tower);
          for (const st of strikeTargets) {
            tower.aimYaw = Math.atan2(st.x - tower.x, st.y - tower.y);
            this.damageEnemy(st, dmg, tower, false);
            this.projectiles.push({
              id: this.nextId++,
              kind: 'firewall_pulse',
              fromX: tower.x,
              fromY: tower.y,
              fromZ: 0.5,
              toX: st.x,
              toY: st.y,
              toZ: 0.45,
              color: cfg.accentHex,
              timer: 0,
              duration: 0.16,
              width: 1.8,
            });
          }
          audio.play('firewall_hit');
        }
      }
    }
  }

  private getTowerElevation(t: TowerEntity): number {
    const tile = this.getTile(t.x, t.y);
    if (!tile) return 0;
    if (tile.type === 'platform') return GAME_CONSTANTS.PLATFORM_HEIGHT;
    if (tile.type === 'node') return GAME_CONSTANTS.NODE_HEIGHT;
    return 0;
  }

  private updateEnemies(dt: number): void {
    // 1. Packer Shield Aura Pass
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.type !== 'packer') continue;
      const emitVfx = e.attackCooldown <= 0;
      let beamed = 0;
      for (const ally of this.enemies) {
        if (ally.hp <= 0 || ally.isFlying) continue;
        const d = Math.hypot(ally.x - e.x, ally.y - e.y);
        if (d <= GAME_CONSTANTS.PACKER_SHIELD_RADIUS) {
          const cap = ally.id === e.id ? 60 : ally.maxShield;
          if (ally.shield < cap) {
            ally.shield = Math.min(cap, ally.shield + GAME_CONSTANTS.PACKER_SHIELD_RATE * dt);
            if (emitVfx && ally.id !== e.id && beamed < 3) {
              beamed++;
              this.projectiles.push({
                id: this.nextId++,
                kind: 'packer_shield',
                fromX: e.x,
                fromY: e.y,
                fromZ: 0.78,
                toX: ally.x,
                toY: ally.y,
                toZ: 0.45,
                color: 0x2dd4bf,
                timer: 0,
                duration: 0.36,
                width: 1.0,
              });
            }
          }
        }
      }
      if (emitVfx && beamed > 0) {
        e.attackCooldown = 0.65;
        e.attackAnim = 0.65;
      }
    }

    // 2. Main Enemy Update
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        this.enemies.splice(i, 1);
        continue;
      }

      e.animPhase += dt * (e.blockedByTowerId ? 3.2 : 6.0);
      e.hitFlash = Math.max(0, e.hitFlash - dt * 4.5);
      e.attackAnim = Math.max(0, e.attackAnim - dt * 3.5);
      e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      e.abilityCooldown = Math.max(0, e.abilityCooldown - dt);

      if (e.snaredTimer > 0) e.snaredTimer = Math.max(0, e.snaredTimer - dt);
      if (e.vulnerableTimer > 0) e.vulnerableTimer = Math.max(0, e.vulnerableTimer - dt);
      if (e.slowTimer > 0) {
        e.slowTimer = Math.max(0, e.slowTimer - dt);
        if (e.slowTimer === 0) e.slowFactor = 1;
      }
      if (e.dotTimer > 0) {
        e.dotTimer = Math.max(0, e.dotTimer - dt);
        this.damageEnemy(e, e.dotDps * dt, null, true, false, true);
        if (e.hp <= 0) {
          this.enemies.splice(i, 1);
          continue;
        }
      }

      // Boss phase & special mechanics
      if (e.isBoss) {
        this.updateBossBehavior(e, dt);
      }

      // Flying Rogue Hotspot
      if (e.isFlying) {
        const entry = this.map.entries.find((en) => en.id === e.entryId) ?? this.map.entries[0];
        const exit = this.map.exits.find((ex) => ex.id === e.targetExitId) ?? this.map.exits[0];
        const totalDist = Math.max(1, Math.hypot(exit.x - entry.x, exit.y - entry.y));
        const spd = e.speed * (e.slowTimer > 0 ? e.slowFactor : 1);
        e.flightProgress += (spd * dt) / totalDist;
        e.x = entry.x + (exit.x - entry.x) * e.flightProgress;
        e.y = entry.y + (exit.y - entry.y) * e.flightProgress;
        e.yaw = Math.atan2(exit.x - entry.x, exit.y - entry.y);

        if (e.flightProgress >= 1.0) {
          this.handleEnemyLeak(e);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      // Tile effects (Legacy slow + Trojan/Zheying detection)
      const cx = Math.max(0, Math.min(this.map.cols - 1, Math.round(e.x)));
      const cy = Math.max(0, Math.min(this.map.rows - 1, Math.round(e.y)));
      const currTile = this.tiles[cy][cx];
      const onLegacy = currTile.type === 'legacy' || currTile.downgradeTimer > 0;

      if (onLegacy && e.disguised) {
        e.disguised = false;
        e.detected = true;
        audio.play('trojan_reveal');
      }

      // Worm replication on first pass-through open node
      if (
        e.type === 'worm' &&
        !e.hasReplicated &&
        !e.isClone &&
        currTile.type === 'node' &&
        currTile.towerId === null &&
        currTile.isolatorId === null
      ) {
        const nk = keyOf(cx, cy);
        if (!e.passedNodes.has(nk)) {
          e.passedNodes.add(nk);
          e.hasReplicated = true;
          const clone = this.spawnEnemy('worm', e.entryId, { x: cx, y: cy }, true);
          clone.x = e.x - Math.sin(e.yaw) * 0.22;
          clone.y = e.y - Math.cos(e.yaw) * 0.22;
          clone.route = e.route.map((c) => ({ ...c }));
          clone.routeIndex = e.routeIndex;
          this.bursts.push({
            id: this.nextId++,
            kind: 'teleport_spawn',
            x: cx,
            y: cy,
            z: 0.3,
            radius: 0.9,
            color: 0xfb7185,
            timer: 0,
            duration: 0.4,
          });
        }
      }

      // Check existing block validity
      if (e.blockedByTowerId !== null) {
        const blocker = this.getTowerById(e.blockedByTowerId);
        if (
          !blocker ||
          blocker.hp <= 0 ||
          Math.hypot(blocker.x - e.x, blocker.y - e.y) > 1.55
        ) {
          e.blockedByTowerId = null;
        }
      }

      // Try acquiring block if unblocked and not snared
      if (e.blockedByTowerId === null) {
        this.tryAcquireBlock(e);
      }

      // Ransomware fires while moving OR blocked!
      if (e.type === 'ransomware' && e.attackCooldown <= 0) {
        this.performRansomwareAttack(e);
      }

      // If blocked by a tower, perform melee attack on blocker
      if (e.blockedByTowerId !== null) {
        const blocker = this.getTowerById(e.blockedByTowerId);
        if (blocker && e.attackCooldown <= 0) {
          const cfg = ENEMY_CONFIGS[e.type];
          e.attackCooldown = cfg.attackInterval;
          e.attackAnim = 1.0;
          e.yaw = Math.atan2(blocker.x - e.x, blocker.y - e.y);
          e.lastTargetTowerId = blocker.id;
          this.damageTower(blocker, cfg.attackDamage, e);
          this.projectiles.push({
            id: this.nextId++,
            kind: 'firewall_pulse',
            fromX: e.x,
            fromY: e.y,
            fromZ: e.isBoss ? 0.85 : 0.42,
            toX: blocker.x,
            toY: blocker.y,
            toZ: this.getTowerElevation(blocker) + 0.45,
            color: cfg.accentHex,
            timer: 0,
            duration: 0.22,
            width: e.isBoss ? 3.2 : 1.7,
          });
        }
        continue; // Blocked enemies don't advance
      }

      // Flood Pack Node-Breaker AI: check nearby isolated node or honeypot lure!
      if (e.type === 'flood') {
        const handled = this.updateFloodPackNodeAttack(e, cx, cy);
        if (handled) continue;
      }

      // If snared by Honeypot Trap, cannot move!
      if (e.snaredTimer > 0) {
        continue;
      }

      // Advance along route
      if (e.routeIndex < e.route.length) {
        const targetPt = e.route[e.routeIndex];
        const dx = targetPt.x - e.x;
        const dy = targetPt.y - e.y;
        const dist = Math.hypot(dx, dy);

        let spd = e.speed;
        if (onLegacy) spd *= GAME_CONSTANTS.LEGACY_SPEED_MULT;
        if (e.slowTimer > 0) spd *= e.slowFactor;
        if (e.isBoss && e.bossPhase === 3 && e.type === 'boss_zheying') spd *= 1.15;

        const stepDist = spd * dt;
        if (dist <= stepDist + 0.04) {
          e.x = targetPt.x;
          e.y = targetPt.y;
          e.routeIndex++;
          if (e.routeIndex >= e.route.length) {
            // Reached exit!
            const endTile = this.getTile(targetPt.x, targetPt.y);
            if (endTile?.type === 'exit') {
              this.handleEnemyLeak(e);
              this.enemies.splice(i, 1);
              continue;
            }
          }
        } else if (dist > 0.001) {
          e.vx = dx / dist;
          e.vy = dy / dist;
          e.x += e.vx * stepDist;
          e.y += e.vy * stepDist;
          e.yaw = Math.atan2(dx, dy);
        }
      }
    }
  }

  private tryAcquireBlock(e: EnemyEntity): void {
    if (e.isFlying || e.blockWeight <= 0) return;

    // Look for Honeypot or Firewall on current/nearby link OR node-mounted Firewall adjacent!
    const candidates = this.towers
      .filter((t) => {
        if (t.hp <= 0) return false;
        if (t.type !== 'firewall' && t.type !== 'honeypot') return false;
        const cap = this.getTowerBlockCap(t);
        const used = t.blockedEnemyIds.reduce((acc, eid) => {
          const en = this.enemies.find((x) => x.id === eid);
          return acc + (en ? en.blockWeight : 0);
        }, 0);
        if (used + e.blockWeight > cap) return false;
        const tile = this.getTile(t.x, t.y);
        const maxDist = tile?.type === 'node' ? 1.25 : 0.65;
        return Math.hypot(t.x - e.x, t.y - e.y) <= maxDist;
      })
      .sort((a, b) => {
        // Honeypots have stronger aggro draw!
        const pa = a.type === 'honeypot' ? -0.5 : 0;
        const pb = b.type === 'honeypot' ? -0.5 : 0;
        return (
          Math.hypot(a.x - e.x, a.y - e.y) + pa - (Math.hypot(b.x - e.x, b.y - e.y) + pb)
        );
      });

    const blocker = candidates[0];
    if (blocker) {
      e.blockedByTowerId = blocker.id;
      blocker.blockedEnemyIds.push(e.id);
      if (e.disguised) {
        e.disguised = false;
        e.detected = true;
        audio.play('trojan_reveal');
      }
    }
  }

  private updateFloodPackNodeAttack(e: EnemyEntity, cx: number, cy: number): boolean {
    const cfg = ENEMY_CONFIGS.flood;

    // Honeypot lure check: if an active Honeypot is within lure radius, ignore distant nodes and march toward Honeypot!
    const lure = this.towers.find(
      (t) =>
        t.type === 'honeypot' &&
        t.hp > 0 &&
        Math.hypot(t.x - e.x, t.y - e.y) <= this.getTowerRange(t)
    );
    if (lure) {
      e.targetNodeKey = null;
      return false;
    }

    // Check if an isolated node is directly adjacent right now!
    for (const d of [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: -1, y: 0 },
    ]) {
      const nt = this.getTile(cx + d.x, cy + d.y);
      if (nt && nt.type === 'node' && (nt.towerId !== null || nt.isolatorId !== null)) {
        // Attack this isolated node!
        e.targetNodeKey = keyOf(nt.x, nt.y);
        e.yaw = Math.atan2(nt.x - e.x, nt.y - e.y);
        if (e.attackCooldown <= 0) {
          e.attackCooldown = cfg.attackInterval;
          e.attackAnim = 1.0;
          if (nt.towerId !== null) {
            const tw = this.getTowerById(nt.towerId);
            if (tw) this.damageTower(tw, cfg.attackDamage, e);
          } else if (nt.isolatorId !== null) {
            const iso = this.isolators.find((x) => x.id === nt.isolatorId);
            if (iso) {
              iso.hp -= cfg.attackDamage;
              iso.hitFlash = 1.0;
            }
          }
          this.bursts.push({
            id: this.nextId++,
            kind: 'node_slam',
            x: nt.x,
            y: nt.y,
            z: 0.35,
            radius: 0.75,
            color: 0xf97316,
            timer: 0,
            duration: 0.3,
          });
        }
        return true; // stay here and keep pounding!
      }
    }

    // Otherwise scan for a nearby isolated node reachable on passable side
    if (!e.targetNodeKey) {
      let bestScore = 999;
      let bestRoute: GridCoord[] | null = null;
      let bestKey: string | null = null;

      for (let y = 0; y < this.map.rows; y++) {
        for (let x = 0; x < this.map.cols; x++) {
          const nt = this.tiles[y][x];
          if (nt.type !== 'node' || (nt.towerId === null && nt.isolatorId === null)) continue;
          if (Math.hypot(x - e.x, y - e.y) > 4.6) continue;

          for (const d of [
            { x: 0, y: 1 },
            { x: 1, y: 0 },
            { x: 0, y: -1 },
            { x: -1, y: 0 },
          ]) {
            const adj = this.getTile(x + d.x, y + d.y);
            if (!adj || !isTileWalkable(adj)) continue;
            const path = findShortestPathToTarget(this.tiles, cx, cy, adj.x, adj.y);
            if (path && path.length <= 6 && path.length < bestScore) {
              bestScore = path.length;
              bestRoute = path;
              bestKey = keyOf(x, y);
            }
          }
        }
      }

      if (bestRoute && bestKey) {
        e.targetNodeKey = bestKey;
        e.route = bestRoute;
        e.routeIndex = 0;
      }
    }

    return false;
  }

  private performRansomwareAttack(e: EnemyEntity): void {
    const cfg = ENEMY_CONFIGS.ransomware;
    const inRange = this.towers.filter(
      (t) => t.hp > 0 && Math.hypot(t.x - e.x, t.y - e.y) <= cfg.attackRange
    );
    if (inRange.length === 0) return;

    // Priority 1: Honeypots in range!
    const honeypots = inRange.filter((t) => t.type === 'honeypot');
    const pool = honeypots.length > 0 ? honeypots : inRange;
    pool.sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y));

    const target = pool[0];
    e.attackCooldown = cfg.attackInterval;
    e.attackAnim = 1.0;
    e.lastTargetTowerId = target.id;

    this.damageTower(target, cfg.attackDamage, e);

    // Apply Encryption (Honeypots are immune!)
    if (target.type !== 'honeypot' && target.encryptResistTimer <= 0) {
      let dur = GAME_CONSTANTS.RANSOM_ENCRYPT_DURATION;
      // Lv2 Repair Daemon reduces nearby encryption duration by 35%
      const nearLv2Repair = this.towers.some(
        (r) =>
          r.type === 'repair' &&
          r.level === 2 &&
          r.encryptedTimer <= 0 &&
          Math.hypot(r.x - target.x, r.y - target.y) <= this.getTowerRange(r)
      );
      if (nearLv2Repair) dur *= 0.65;
      target.encryptedTimer = Math.max(target.encryptedTimer, dur);
      audio.play('encrypt_zap');
    }

    this.projectiles.push({
      id: this.nextId++,
      kind: 'ransom_beam',
      fromX: e.x,
      fromY: e.y,
      fromZ: 0.72,
      toX: target.x,
      toY: target.y,
      toZ: this.getTowerElevation(target) + 0.65,
      color: 0xc084fc,
      timer: 0,
      duration: 0.35,
      width: 2.0,
    });
  }

  private updateBossBehavior(e: EnemyEntity, dt: number): void {
    const hpRatio = e.hp / e.maxHp;

    if (e.type === 'boss_wankui') {
      if (e.bossPhase === 1 && hpRatio <= 0.6) {
        e.bossPhase = 2;
        audio.play('boss_phase');
        this.bursts.push({
          id: this.nextId++,
          kind: 'route_storm',
          x: e.x,
          y: e.y,
          z: 0.6,
          radius: 3.2,
          color: 0xef4444,
          timer: 0,
          duration: 0.85,
        });
        this.pushAlert('danger', '⚠ 万傀进入二阶段【蜂群过载】：背部虫巢开启并释放成群蠕虫！');
        this.spawnBossEscorts(e, 'worm', 3);
      }

      if (e.abilityCooldown <= 0) {
        e.abilityCooldown = e.bossPhase === 2 ? 7.5 : 9.5;
        // Surge strike against nearest isolated node (with 1.5s telegraph warning!)
        const isolatedNodes: Array<{ x: number; y: number; d: number }> = [];
        for (let y = 0; y < this.map.rows; y++) {
          for (let x = 0; x < this.map.cols; x++) {
            const nt = this.tiles[y][x];
            if (
              nt.type === 'node' &&
              nt.telegraphTimer <= 0 &&
              (nt.towerId !== null || nt.isolatorId !== null)
            ) {
              isolatedNodes.push({ x, y, d: Math.hypot(x - e.x, y - e.y) });
            }
          }
        }
        isolatedNodes.sort((a, b) => a.d - b.d);
        if (isolatedNodes[0] && isolatedNodes[0].d <= 4.8) {
          const targetNode = this.tiles[isolatedNodes[0].y][isolatedNodes[0].x];
          targetNode.telegraphType = 'surge';
          targetNode.telegraphTimer = 1.5;
          audio.play('boss_warn');
          this.pushAlert(
            'warn',
            `万傀正蓄能「洪峰」冲击节点【${targetNode.nodeName ?? keyOf(targetNode.x, targetNode.y)}】，即将引发重创！`
          );
        } else if (e.bossPhase === 2) {
          this.spawnBossEscorts(e, 'worm', 2);
        }
      }
    }

    if (e.type === 'boss_shenlou') {
      if (e.bossPhase === 1 && hpRatio <= 0.55) {
        e.bossPhase = 2;
        audio.play('boss_phase');
        this.pushAlert('danger', '⚠ 蜃楼发动「路由风暴」：削弱周围防线护盾！');
        this.bursts.push({
          id: this.nextId++,
          kind: 'route_storm',
          x: e.x,
          y: e.y,
          z: 0.7,
          radius: 4.0,
          color: 0xec4899,
          timer: 0,
          duration: 0.9,
        });
        for (const t of this.towers) {
          if (Math.hypot(t.x - e.x, t.y - e.y) <= 4.0) {
            t.shield = Math.max(0, t.shield * 0.25);
            t.attackCooldown += 1.4;
          }
        }
      }

      if (e.abilityCooldown <= 0) {
        e.abilityCooldown = e.bossPhase === 2 ? 8.5 : 10.5;
        const targetTile = this.selectSafeRoadTelegraphTile(e, 4);
        if (targetTile) {
          targetTile.telegraphType = 'blackhole';
          targetTile.telegraphTimer = 2.6;
          audio.play('boss_warn');
          this.pushAlert('warn', '蜃楼正在前方链路构筑「伪路由黑洞」，即将截断道路！');
        }
      }
    }

    if (e.type === 'boss_zheying') {
      if (e.bossPhase === 1 && hpRatio <= 0.7) {
        e.bossPhase = 2;
        e.disguised = false;
        e.detected = true;
        e.armor = 44;
        audio.play('boss_phase');
        this.bursts.push({
          id: this.nextId++,
          kind: 'route_storm',
          x: e.x,
          y: e.y,
          z: 0.7,
          radius: 3.0,
          color: 0xf59e0b,
          timer: 0,
          duration: 0.8,
        });
        this.pushAlert('danger', '⚠ 蛰影切换至二阶段【提权】：护甲大幅强化并放出木马群！');
        this.spawnBossEscorts(e, 'trojan', 2);
      } else if (e.bossPhase === 2 && hpRatio <= 0.35) {
        e.bossPhase = 3;
        e.armor = 36;
        audio.play('boss_phase');
        this.bursts.push({
          id: this.nextId++,
          kind: 'route_storm',
          x: e.x,
          y: e.y,
          z: 0.7,
          radius: 3.6,
          color: 0xf43f5e,
          timer: 0,
          duration: 0.9,
        });
        this.pushAlert('danger', '⚠ 蛰影进入终极三阶段【破坏】：即将锁死前方运维环！');
        this.triggerZheyingLockdown(e);
      }

      if (e.abilityCooldown <= 0) {
        if (e.bossPhase === 2) {
          e.abilityCooldown = 8.0;
          this.spawnBossEscorts(e, 'trojan', 2);
        } else if (e.bossPhase === 3) {
          e.abilityCooldown = 10.5;
          this.triggerZheyingLockdown(e);
        }
      }
    }
    void dt;
  }

  /**
   * Select a road tile for Boss terrain hazards (blackhole / lockdown) without blocking all routes.
   * Prefers tiles 2..maxAhead steps along the Boss's current route, falling back to nearby active-route tiles.
   */
  private selectSafeRoadTelegraphTile(boss: EnemyEntity, maxAhead: number): TileState | null {
    const canHostHazard = (tile: TileState | null): tile is TileState => {
      if (!tile || (tile.type !== 'link' && tile.type !== 'legacy')) return false;
      if (tile.towerId !== null || tile.telegraphTimer > 0) return false;
      if (tile.blackholeTimer > 0 || tile.lockdownTimer > 0) return false;
      return true;
    };

    const tried = new Set<string>();
    for (let step = 2; step <= maxAhead; step++) {
      const cand = boss.route[boss.routeIndex + step];
      if (!cand) continue;
      tried.add(keyOf(cand.x, cand.y));
      const tile = this.getTile(cand.x, cand.y);
      if (!canHostHazard(tile)) continue;
      if (evaluateRouteChange(this.tiles, this.map, this.enemies, [{ x: tile.x, y: tile.y }]).valid) {
        return tile;
      }
    }

    // Fallback: re-select across other entry routes & nearby road tiles so connectivity constraint never stalls the Boss
    const fallbacks: Array<{ tile: TileState; dist: number }> = [];
    for (const route of Object.values(this.entryRoutes)) {
      for (const c of route) {
        const k = keyOf(c.x, c.y);
        if (tried.has(k)) continue;
        tried.add(k);
        const tile = this.getTile(c.x, c.y);
        if (canHostHazard(tile)) {
          fallbacks.push({ tile, dist: Math.hypot(tile.x - boss.x, tile.y - boss.y) });
        }
      }
    }
    for (let y = 0; y < this.map.rows; y++) {
      for (let x = 0; x < this.map.cols; x++) {
        const k = keyOf(x, y);
        if (tried.has(k)) continue;
        const dist = Math.hypot(x - boss.x, y - boss.y);
        if (dist > 6.5) continue;
        const tile = this.tiles[y][x];
        if (canHostHazard(tile)) {
          tried.add(k);
          fallbacks.push({ tile, dist });
        }
      }
    }
    fallbacks.sort((a, b) => a.dist - b.dist);
    for (const item of fallbacks) {
      if (
        evaluateRouteChange(this.tiles, this.map, this.enemies, [{ x: item.tile.x, y: item.tile.y }]).valid
      ) {
        return item.tile;
      }
    }
    return null;
  }

  public triggerZheyingLockdown(boss: EnemyEntity): boolean {
    const tile = this.selectSafeRoadTelegraphTile(boss, 5);
    if (!tile) return false;
    tile.telegraphType = 'lockdown';
    tile.telegraphTimer = 2.2;
    audio.play('boss_warn');
    this.pushAlert('warn', '蛰影正在锁定前方运维环路段，准备应对路由收敛！');
    return true;
  }

  private spawnBossEscorts(boss: EnemyEntity, type: EnemyType, count: number): void {
    const cx = Math.max(0, Math.min(this.map.cols - 1, Math.round(boss.x)));
    const cy = Math.max(0, Math.min(this.map.rows - 1, Math.round(boss.y)));
    for (let k = 0; k < count; k++) {
      const esc = this.spawnEnemy(type, boss.entryId, { x: cx, y: cy });
      esc.x += (k - (count - 1) / 2) * 0.18;
      esc.route = boss.route.map((c) => ({ ...c }));
      esc.routeIndex = boss.routeIndex;
    }
    this.bursts.push({
      id: this.nextId++,
      kind: 'teleport_spawn',
      x: boss.x,
      y: boss.y,
      z: 0.5,
      radius: 1.4,
      color: 0xf43f5e,
      timer: 0,
      duration: 0.5,
    });
  }

  private damageTower(tower: TowerEntity, rawDmg: number, sourceEnemy: EnemyEntity | null): void {
    if (tower.hp <= 0) return;

    let dmg = rawDmg;
    this.stats.damageToTowers += dmg;
    tower.hitFlash = 1.0;

    // Mimic Deepwell Honeypot reflects 35% damage!
    if (
      tower.type === 'honeypot' &&
      tower.branch === 'honeypot_mimic' &&
      sourceEnemy &&
      sourceEnemy.hp > 0
    ) {
      this.damageEnemy(sourceEnemy, rawDmg * 0.35, tower, true);
    }

    if (tower.shield > 0) {
      const absorbed = Math.min(tower.shield, dmg);
      tower.shield -= absorbed;
      dmg -= absorbed;
    }
    tower.hp -= dmg;

    if (tower.hp <= 0) {
      tower.hp = 0;
      this.handleTowerDestroyed(tower);
    }
  }

  public breachTower(towerId: number): void {
    const tower = this.getTowerById(towerId);
    if (!tower) return;
    tower.hp = 0;
    this.handleTowerDestroyed(tower);
  }

  private handleTowerDestroyed(tower: TowerEntity): void {
    const cfg = TOWER_CONFIGS[tower.type];
    this.stats.towersLost++;
    this.releaseBlockedEnemies(tower);

    const idx = this.towers.findIndex((t) => t.id === tower.id);
    if (idx !== -1) this.towers.splice(idx, 1);

    const tile = this.getTile(tower.x, tower.y);
    if (tile) {
      tile.towerId = null;
      if (tile.type === 'node') {
        tile.nodeCooldown = GAME_CONSTANTS.NODE_REISOLATE_COOLDOWN;
        audio.play('node_break');
        this.bursts.push({
          id: this.nextId++,
          kind: 'node_break',
          x: tower.x,
          y: tower.y,
          z: 0.35,
          radius: 1.8,
          color: 0xf43f5e,
          timer: 0,
          duration: 0.65,
        });
        this.recomputeRoutes(true);
        this.pushAlert(
          'danger',
          `⚠ 节点【${tile.nodeName ?? keyOf(tile.x, tile.y)}】上的${cfg.name}被摧毁！道路旁路直通！`
        );
        return;
      }
    }

    audio.play('node_break');
    this.bursts.push({
      id: this.nextId++,
      kind: 'death_shard',
      x: tower.x,
      y: tower.y,
      z: this.getTowerElevation(tower) + 0.4,
      radius: 1.2,
      color: 0xf43f5e,
      timer: 0,
      duration: 0.5,
    });
    this.pushAlert('danger', `⚠ 防御单位【${cfg.name}】已被敌方摧毁！`);
  }

  private releaseBlockedEnemies(tower: TowerEntity): void {
    for (const eid of tower.blockedEnemyIds) {
      const en = this.enemies.find((e) => e.id === eid);
      if (en && en.blockedByTowerId === tower.id) {
        en.blockedByTowerId = null;
      }
    }
    tower.blockedEnemyIds = [];
  }

  private damageEnemy(
    e: EnemyEntity,
    rawDmg: number,
    sourceTower: TowerEntity | null,
    ignoreArmor = false,
    pierceShieldBonus = false,
    silent = false
  ): void {
    if (e.hp <= 0) return;
    let dmg = rawDmg;
    if (e.vulnerableTimer > 0) dmg *= 1.25;

    if (e.shield > 0) {
      const shieldMult = pierceShieldBonus ? 1.45 : 1.0;
      const absorbed = Math.min(e.shield, dmg * shieldMult);
      e.shield -= absorbed;
      dmg = Math.max(0, dmg - absorbed / shieldMult);
    }

    const armorFactor = ignoreArmor ? e.armor * 0.35 : e.armor;
    const netDmg = Math.max(Math.max(2, rawDmg * 0.15), dmg - armorFactor);

    e.hp -= netDmg;
    if (!silent) e.hitFlash = 1.0;

    if (sourceTower) {
      sourceTower.damageDealt += netDmg;
    }

    if (e.hp <= 0) {
      e.hp = 0;
      if (sourceTower) sourceTower.kills++;
      this.handleEnemyKilled(e);
    }
  }

  private handleEnemyKilled(e: EnemyEntity): void {
    const cfg = ENEMY_CONFIGS[e.type];
    this.stats.enemiesDefeated++;

    if (!e.isClone) {
      this.compute += cfg.computeReward;
      this.stats.computeEarned += cfg.computeReward;
      if (cfg.intelReward > 0) {
        this.intel += cfg.intelReward;
        this.stats.intelEarned += cfg.intelReward;
      }
    } else {
      this.compute += 4;
      this.stats.computeEarned += 4;
    }

    // Release from blocker
    if (e.blockedByTowerId !== null) {
      const blocker = this.getTowerById(e.blockedByTowerId);
      if (blocker) {
        blocker.blockedEnemyIds = blocker.blockedEnemyIds.filter((id) => id !== e.id);
      }
      e.blockedByTowerId = null;
    }

    // Undetected Trojan death payload!
    if (e.type === 'trojan' && !e.detected) {
      audio.play('payload_blast');
      this.bursts.push({
        id: this.nextId++,
        kind: 'payload_blast',
        x: e.x,
        y: e.y,
        z: 0.45,
        radius: GAME_CONSTANTS.TROJAN_PAYLOAD_RADIUS,
        color: 0xf43f5e,
        timer: 0,
        duration: 0.65,
      });
      this.pushAlert('danger', '⚠ 未显形木马死亡引爆载荷，溅射损伤附近友塔！');
      for (let i = this.towers.length - 1; i >= 0; i--) {
        const tw = this.towers[i];
        if (Math.hypot(tw.x - e.x, tw.y - e.y) <= GAME_CONSTANTS.TROJAN_PAYLOAD_RADIUS) {
          this.damageTower(tw, GAME_CONSTANTS.TROJAN_PAYLOAD_DMG, null);
        }
      }
    } else {
      audio.play('enemy_die');
      this.bursts.push({
        id: this.nextId++,
        kind: 'death_shard',
        x: e.x,
        y: e.y,
        z: e.isFlying ? GAME_CONSTANTS.FLY_HEIGHT : 0.45,
        radius: e.isBoss ? 2.2 : 0.85,
        color: cfg.accentHex,
        timer: 0,
        duration: e.isBoss ? 0.9 : 0.42,
      });
    }
  }

  private handleEnemyLeak(e: EnemyEntity): void {
    const cfg = ENEMY_CONFIGS[e.type];
    this.stats.leaks++;
    this.integrity = Math.max(0, this.integrity - cfg.coreLeakDamage);
    audio.play('core_hit');

    const exit = this.map.exits.find((ex) => ex.id === e.targetExitId) ?? this.map.exits[0];
    this.bursts.push({
      id: this.nextId++,
      kind: 'payload_blast',
      x: exit.x,
      y: exit.y,
      z: 0.6,
      radius: 1.5,
      color: 0xef4444,
      timer: 0,
      duration: 0.6,
    });
    this.pushAlert(
      'danger',
      `⚠ 【${cfg.name}】突破至${exit.name}！中枢完整度 -${cfg.coreLeakDamage}`
    );
  }
}
