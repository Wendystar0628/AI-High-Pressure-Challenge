// 核心确定性战斗模拟引擎（支持实时游玩与帧级确定性实战演示/视频导出）

import {
  TILE,
  TILE_SIZE,
  LEGACY_SPEED_MULT,
  NODE_REISOLATE_COOLDOWN,
  SELL_REFUND_RATIO,
  TOWERS,
  ITEMS,
  ENEMIES,
  BOSSES
} from './constants.js';
import {
  keyOf,
  gridToWorld,
  worldToGrid,
  computeAllEntryRoutes,
  validateConnectivity,
  findNearestIsolatedNodeApproach,
  routesDiffer
} from './pathfinding.js';
import {
  createTowerModel,
  syncTowerAppearance,
  updateTowerAnimation,
  createIsolatorModel,
  createEnemyModel,
  updateEnemyAnimation
} from './models.js';
import { sound } from './audio.js';

// 确定性伪随机数生成器（确保同一种子下帧推进完全可复现）
function createRng(seed = 20261113) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BattleSim {
  constructor(map, sceneBundle, vfx, { seed = 104729, onEvent = null } = {}) {
    this.map = map;
    this.sceneBundle = sceneBundle;
    this.vfx = vfx;
    this.rng = createRng(seed);
    this.onEvent = onEvent || (() => {});

    this.unitLayer = sceneBundle.root;
    this.simTime = 0;
    this.speedMult = 1;
    this.paused = false;
    this.outcome = null; // null | 'victory' | 'defeat'

    // 常驻核心资源
    this.compute = map.startCompute;
    this.intel = map.startIntel;
    this.integrity = map.coreIntegrity;
    this.maxIntegrity = map.coreIntegrity;

    // 统计数据（用于结算「事件报告」）
    this.stats = {
      kills: 0,
      bossKilled: false,
      computeEarned: 0,
      computeSpent: 0,
      intelEarned: 0,
      nodeIsolations: 0,
      routeShifts: 0,
      towersLost: 0,
      leakedCount: 0
    };

    // 实体表
    this.nextId = 1;
    this.towers = [];
    this.enemies = [];
    this.isolators = []; // 应急隔离器实体
    this.sandboxZones = []; // 沙箱2级特征码隔离区
    this.hazards = []; // 首领预警与地形封锁 (blackhole / lockdown / flood_warn)
    this.floatingTexts = []; // 飘字信息（供屏幕投影层渲染）
    this.logs = []; // 系统事件日志流

    // 道具冷却
    this.itemCooldowns = {
      isolator: 0,
      downgrade: 0,
      restore: 0
    };

    // 地形动态状态表
    this.nodeStates = new Map(); // "x,z" -> { isolated, source, towerId, isolatorId, reisolateCd, intelTick }
    for (const n of map.nodes) {
      this.nodeStates.set(keyOf(n.x, n.z), {
        nodeInfo: n,
        isolated: false,
        source: null,
        towerId: null,
        isolatorId: null,
        reisolateCd: 0,
        intelTick: 0
      });
    }
    this.downgradedTiles = new Map(); // "x,z" -> remainingSeconds

    // 波次状态机
    this.waveIndex = 0; // 当前波次 (0-based, 显示 +1)
    this.waveState = 'prep'; // 'prep' | 'spawning' | 'clearing' | 'done'
    this.prepTimer = 4.5; // 开局短准备期，玩家也可随时点立即迎击
    this.spawnQueue = [];
    this.seenEnemyTypes = new Set();

    // 初始化路由表
    this.blockedSet = new Set();
    this.downgradedSet = new Set();
    this.distanceField = null;
    this.entryRoutes = {};
    this.recomputeRoutes(null, true);

    this.addLog('INFO', `守护进程已挂载至自治域「汐域 · ${map.name}」，全域链路连通正常。`);
  }

  addLog(level, text) {
    this.logs.unshift({
      id: this.nextId++,
      time: this.simTime,
      level,
      text
    });
    if (this.logs.length > 28) this.logs.pop();
    this.onEvent({ type: 'log', level, text });
  }

  pushFloatText(x, y, z, text, color = '#ffffff', big = false) {
    this.floatingTexts.push({
      id: this.nextId++,
      x,
      y,
      z,
      text,
      color,
      big,
      timer: 1.05,
      maxTimer: 1.05
    });
  }

  // 构建当前所有不可通行格集合（已隔离节点 + 已生效首领黑洞/锁死段）
  _buildBlockedSet() {
    const s = new Set();
    for (const [k, st] of this.nodeStates.entries()) {
      if (st.isolated) s.add(k);
    }
    for (const h of this.hazards) {
      if (h.state === 'active' && h.blocksGround) {
        for (const c of h.cells) s.add(keyOf(c.x, c.z));
      }
    }
    return s;
  }

  _buildDowngradedSet() {
    const s = new Set();
    for (const [k, rem] of this.downgradedTiles.entries()) {
      if (rem > 0) s.add(k);
    }
    return s;
  }

  // 核心路由重收敛（2.7.2）
  recomputeRoutes(reason = null, silent = false) {
    const prevRoutes = this.entryRoutes || {};
    this.blockedSet = this._buildBlockedSet();
    this.downgradedSet = this._buildDowngradedSet();

    const { field, routes } = computeAllEntryRoutes(this.map, this.blockedSet, this.downgradedSet);
    this.distanceField = field;
    this.entryRoutes = routes;

    const changedEntries = [];
    for (const entry of this.map.entries) {
      if (!silent && prevRoutes[entry.id] && routesDiffer(prevRoutes[entry.id], routes[entry.id])) {
        changedEntries.push(entry.id);
      }
    }

    if (this.vfx) {
      this.vfx.rebuildActiveRoutes(this.entryRoutes, changedEntries);
    }

    // 令场上所有受地形约束的地面敌人从当前所在位置平滑转向新路线（3.2.2）
    for (const e of this.enemies) {
      if (e.dead || e.dyingTimer > 0 || e.flying) continue;
      this._refreshEnemyNextHop(e, !silent && changedEntries.length > 0);
    }

    if (!silent && changedEntries.length > 0) {
      this.stats.routeShifts++;
      sound.play('route_shift');
      const desc = changedEntries
        .map((id) => {
          const exId = routes[id]?.exitId || '';
          const exObj = this.map.exits.find((x) => x.id === exId);
          return `入口 ${id} ➔ ${exObj ? exObj.name : exId}`;
        })
        .join('，');
      this.addLog('ROUTE', `${reason ? `[${reason}] ` : ''}路由重收敛：${desc}`);
      this.onEvent({ type: 'route_shift', changedEntries, reason, desc });
    }
  }

  _refreshEnemyNextHop(enemy, markTurn = false) {
    if (enemy.flying || !this.distanceField) return;
    // 若洪泛团正在前往冲击附近隔离节点，检查目标节点是否仍处于隔离状态
    if (enemy.type === 'flood' && enemy.huntTarget) {
      const nk = keyOf(enemy.huntTarget.nodeX, enemy.huntTarget.nodeZ);
      if (!this.nodeStates.get(nk)?.isolated) {
        enemy.huntTarget = null;
      } else {
        return;
      }
    }

    const { gx, gz } = worldToGrid(this.map, enemy.x, enemy.z);
    if (gx < 0 || gx >= this.map.cols || gz < 0 || gz >= this.map.rows) return;
    const nh = this.distanceField.next[gz]?.[gx];
    if (nh) {
      const prevGoalKey = enemy.goalCell ? keyOf(enemy.goalCell.x, enemy.goalCell.z) : null;
      const newGoalKey = keyOf(nh.x, nh.z);
      enemy.goalCell = { x: nh.x, z: nh.z };
      if (markTurn && prevGoalKey && prevGoalKey !== newGoalKey) {
        enemy.rerouteIconTimer = 1.8;
      }
    }
  }

  // ==========================================================================
  // 预览与校验接口（供拖拽部署、道具悬停及演示系统调用）
  // ==========================================================================
  evaluateTowerPlacement(towerType, gx, gz) {
    const def = TOWERS[towerType];
    if (!def) return { ok: false, reason: '未知设备类型' };
    if (gx < 0 || gx >= this.map.cols || gz < 0 || gz >= this.map.rows) {
      return { ok: false, reason: '超出网格边界' };
    }
    const tileType = this.map.grid[gz][gx];
    if (!def.placeOn.includes(tileType)) {
      const needText = def.category;
      return { ok: false, reason: `「${def.name}」仅可部署于：${needText}` };
    }
    if (tileType === TILE.ENTRY || tileType === TILE.EXIT) {
      return { ok: false, reason: '入口与中枢出口不可部署设备' };
    }
    if (this.towers.some((t) => !t.dead && t.gx === gx && t.gz === gz)) {
      return { ok: false, reason: '该位置已部署守护设备' };
    }
    const k = keyOf(gx, gz);
    if (this.isolators.some((iso) => !iso.dead && keyOf(iso.gx, iso.gz) === k)) {
      return { ok: false, reason: '该节点当前插有应急隔离器' };
    }
    if (this.hazards.some((h) => h.state === 'active' && h.cells.some((c) => c.x === gx && c.z === gz))) {
      return { ok: false, reason: '该路段处于异常锁死/黑洞状态' };
    }

    const isNode = tileType === TILE.NODE;
    const needCompute = def.costCompute;
    const needIntel = isNode ? def.nodeIntelCost || 0 : 0;

    if (isNode) {
      const ns = this.nodeStates.get(k);
      if (ns && ns.reisolateCd > 0) {
        return { ok: false, reason: `节点旁路保护冷却中 (${ns.reisolateCd.toFixed(1)}s)` };
      }
    }

    // 若是节点隔离，先做连通性校验与路线预览（即使算力不足也可看出是否会封死！）
    let preview = null;
    if (isNode) {
      const candBlocked = new Set(this.blockedSet);
      candBlocked.add(k);
      preview = validateConnectivity(this.map, candBlocked, this.downgradedSet, this.enemies);
      if (!preview.ok) {
        const who = preview.blockedEntries.length > 0
          ? `将截断入口 ${preview.blockedEntries.map((e) => e.id).join('、')} 通往中枢的唯一道路`
          : '将导致场上地面敌方单位无路可走';
        return { ok: false, blockedError: true, reason: `禁止封路：${who}！`, preview };
      }
    }

    if (this.compute < needCompute) {
      return { ok: false, reason: `算力不足（需 ${needCompute} 算力）`, preview };
    }
    if (this.intel < needIntel) {
      return { ok: false, reason: `情报不足（隔离节点需 ${needIntel} 情报）`, preview };
    }

    return { ok: true, needCompute, needIntel, isNode, preview };
  }

  evaluateItemTarget(itemId, gx, gz) {
    const item = ITEMS[itemId];
    if (!item) return { ok: false, reason: '未知道具' };
    if (this.itemCooldowns[itemId] > 0) {
      return { ok: false, reason: `${item.name}冷却中 (${this.itemCooldowns[itemId].toFixed(1)}s)` };
    }
    if (gx < 0 || gx >= this.map.cols || gz < 0 || gz >= this.map.rows) {
      return { ok: false, reason: '目标超出范围' };
    }

    const tileType = this.map.grid[gz][gx];
    const k = keyOf(gx, gz);

    if (itemId === 'isolator') {
      if (tileType !== TILE.NODE) return { ok: false, reason: '应急隔离器只能投放在「交换节点」上' };
      const ns = this.nodeStates.get(k);
      if (!ns || ns.isolated) return { ok: false, reason: '该交换节点已处于隔离状态' };
      if (ns.reisolateCd > 0) return { ok: false, reason: `节点再次隔离冷却中 (${ns.reisolateCd.toFixed(1)}s)` };

      const candBlocked = new Set(this.blockedSet);
      candBlocked.add(k);
      const preview = validateConnectivity(this.map, candBlocked, this.downgradedSet, this.enemies);
      if (!preview.ok) {
        const who = preview.blockedEntries.length > 0
          ? `将截断入口 ${preview.blockedEntries.map((e) => e.id).join('、')} 通往中枢的唯一道路`
          : '将导致场上地面敌方单位无路可走';
        return { ok: false, blockedError: true, reason: `禁止封路：${who}！`, preview };
      }
      if (this.intel < item.cost) return { ok: false, reason: `情报不足（需 ${item.cost} 情报）`, preview };
      return { ok: true, preview };
    }

    if (itemId === 'downgrade') {
      if (tileType !== TILE.LINK && tileType !== TILE.LEGACY && tileType !== TILE.NODE) {
        return { ok: false, reason: '请投放在传输链路上' };
      }
      // 计算半径内受影响的链路格并生成速度改道预览！
      const affected = this._getDowngradeCells(gx, gz, item.radius);
      if (affected.length === 0) return { ok: false, reason: '范围内没有可降级的链路' };
      const candDg = new Set(this.downgradedSet);
      for (const c of affected) candDg.add(keyOf(c.x, c.z));
      const preview = validateConnectivity(this.map, this.blockedSet, candDg, this.enemies);
      if (this.intel < item.cost) return { ok: false, reason: `情报不足（需 ${item.cost} 情报）`, preview, affected };
      return { ok: true, preview, affected };
    }

    if (itemId === 'restore') {
      const targetTower = this.towers.find((t) => !t.dead && t.gx === gx && t.gz === gz);
      if (!targetTower) return { ok: false, reason: '请选择一座己方守护设备' };
      if (this.compute < item.cost) return { ok: false, reason: `算力不足（需 ${item.cost} 算力）` };
      return { ok: true, targetTower };
    }

    return { ok: false, reason: '无效目标' };
  }

  _getDowngradeCells(cx, cz, radius) {
    const out = [];
    for (let z = 0; z < this.map.rows; z++) {
      for (let x = 0; x < this.map.cols; x++) {
        const t = this.map.grid[z][x];
        if (t === TILE.LINK || t === TILE.LEGACY) {
          const d = Math.hypot(x - cx, z - cz);
          if (d <= radius + 0.05) out.push({ x, z });
        }
      }
    }
    return out;
  }

  // ==========================================================================
  // 玩家交互操作执行（部署、升级/选分支、释放技能、撤下、使用道具）
  // ==========================================================================
  deployTower(towerType, gx, gz, dirAngle = 0) {
    const check = this.evaluateTowerPlacement(towerType, gx, gz);
    if (!check.ok) {
      sound.play('error');
      this.addLog('WARN', check.reason);
      return { ok: false, reason: check.reason };
    }

    const def = TOWERS[towerType];
    this.compute -= check.needCompute;
    this.intel -= check.needIntel;
    this.stats.computeSpent += check.needCompute;

    const tv = this.sceneBundle.tileVisuals.get(keyOf(gx, gz));
    const wp = gridToWorld(this.map, gx, gz, tv ? tv.surfaceY : 0.14);

    const tower = {
      id: this.nextId++,
      type: towerType,
      def,
      gx,
      gz,
      onNode: check.isNode,
      x: wp.x,
      y: wp.y,
      z: wp.z,
      level: 1,
      branch: null, // null | 'A' | 'B'
      dirAngle,
      aimOffset: 0,
      hp: def.lv1.maxHp,
      maxHp: def.lv1.maxHp,
      shield: 0,
      shieldTimer: 0,
      encryptTimer: 0,
      encryptHitsTaken: 0,
      skillCd: def.skill.cooldown * 0.35, // 初始短预热即可使用
      skillActiveTimer: 0,
      atkTimer: 0.15,
      atkCount: 0,
      decoyTimer: 2.0,
      autoCleanseTimer: 6.0,
      investedCompute: check.needCompute,
      age: 0,
      attackAnim: 0,
      hitAnim: 0,
      blockedIds: new Set(),
      dead: false
    };

    tower.model = createTowerModel(tower);
    tower.model.root.position.set(tower.x, tower.y, tower.z);
    this.unitLayer.add(tower.model.root);
    this.towers.push(tower);

    this.vfx.spawnRing(tower.x, tower.y, tower.z, 1.25, def.color, 0.35);

    if (check.isNode) {
      const k = keyOf(gx, gz);
      const ns = this.nodeStates.get(k);
      ns.isolated = true;
      ns.source = 'tower';
      ns.towerId = tower.id;
      ns.intelTick = 0;
      this.stats.nodeIsolations++;
      sound.play('isolate_lock');
      this.addLog('ALERT', `已在「${ns.nodeInfo?.name || k}」部署${def.name}，节点闸门锁闭！`);
      this.recomputeRoutes(`${ns.nodeInfo?.name || '节点'}隔离`);
    } else {
      sound.play('deploy');
      this.addLog('INFO', `已部署「${def.name}」至坐标 (${gx}, ${gz})。`);
    }

    this.onEvent({ type: 'tower_deployed', tower });
    return { ok: true, tower };
  }

  upgradeTower(towerId, branchId = null) {
    const tower = this.towers.find((t) => !t.dead && t.id === towerId);
    if (!tower || tower.level >= 2) return { ok: false, reason: '无法继续升级' };

    const def = tower.def;
    let upSpec = null;
    if (def.branches) {
      if (!branchId || !def.branches[branchId]) {
        return { ok: false, reason: '请选择升级分支' };
      }
      upSpec = def.branches[branchId];
    } else {
      upSpec = def.lv2;
    }

    const costC = upSpec.costCompute || 0;
    const costI = upSpec.costIntel || 0;
    if (this.compute < costC) {
      sound.play('error');
      return { ok: false, reason: `算力不足（需 ${costC} 算力）` };
    }
    if (this.intel < costI) {
      sound.play('error');
      return { ok: false, reason: `情报不足（选择分支需 ${costI} 情报）` };
    }

    this.compute -= costC;
    this.intel -= costI;
    this.stats.computeSpent += costC;
    tower.investedCompute += costC;

    const hpDiff = upSpec.maxHp - tower.maxHp;
    tower.level = 2;
    tower.branch = branchId || null;
    tower.maxHp = upSpec.maxHp;
    tower.hp = Math.min(tower.maxHp, tower.hp + Math.max(0, hpDiff) + tower.maxHp * 0.25);

    if (tower.type === 'honeypot' && branchId === 'B') {
      tower.shield = Math.max(tower.shield, upSpec.decoyShield);
      tower.shieldTimer = 999;
    }

    syncTowerAppearance(tower);
    sound.play('upgrade');
    this.vfx.spawnRing(tower.x, tower.y, tower.z, 1.65, def.color, 0.45);
    this.vfx.spawnBurst(tower.x, tower.y + 0.8, tower.z, def.color, 10, 2.8);
    this.pushFloatText(tower.x, tower.y + 1.4, tower.z, `▲ ${upSpec.name}`, '#7dd3fc', true);
    this.addLog('INFO', `设备升级完成：「${upSpec.name}」已上线。`);
    this.onEvent({ type: 'tower_upgraded', tower });
    return { ok: true, tower };
  }

  castTowerSkill(towerId) {
    const tower = this.towers.find((t) => !t.dead && t.id === towerId);
    if (!tower) return { ok: false, reason: '设备不存在' };
    if (tower.encryptTimer > 0) {
      sound.play('error');
      return { ok: false, reason: '该设备正处于「勒索加密」状态，无法释放主动技能！' };
    }
    if (tower.skillCd > 0) {
      sound.play('error');
      return { ok: false, reason: `技能冷却中 (${tower.skillCd.toFixed(1)}s)` };
    }

    const sk = tower.def.skill;
    tower.skillCd = sk.cooldown;
    tower.attackAnim = 1.0;

    if (tower.type === 'firewall') {
      tower.skillActiveTimer = 6.0;
      sound.play('shot_firewall');
      this.vfx.spawnRing(tower.x, tower.y, tower.z, 1.85 * TILE_SIZE, 0x29b6f6, 0.45);
      for (const e of this.enemies) {
        if (e.dead || e.dyingTimer > 0 || e.flying) continue;
        const d = Math.hypot(e.x - tower.x, e.z - tower.z) / TILE_SIZE;
        if (d <= 1.75) {
          this._damageEnemy(e, 150, { sourceTower: tower, isAoE: true });
        }
      }
      this.pushFloatText(tower.x, tower.y + 1.3, tower.z, '数据包清洗!', '#38bdf8', true);
    } else if (tower.type === 'honeypot') {
      sound.play('skill_entrap');
      this.vfx.spawnRing(tower.x, tower.y, tower.z, 2.35 * TILE_SIZE, 0xffca28, 0.5);
      let count = 0;
      for (const e of this.enemies) {
        if (e.dead || e.dyingTimer > 0 || e.flying) continue;
        const d = Math.hypot(e.x - tower.x, e.z - tower.z) / TILE_SIZE;
        if (d <= 2.35) {
          e.snareTimer = Math.max(e.snareTimer, 4.5);
          e.vulnTimer = Math.max(e.vulnTimer, 4.5);
          e.luredByTowerId = tower.id;
          this._revealEnemy(e, '蜜罐诱捕');
          count++;
        }
      }
      this.pushFloatText(tower.x, tower.y + 1.3, tower.z, `诱捕定身 (${count})`, '#ffd54f', true);
    } else if (tower.type === 'airgap') {
      sound.play('isolate_lock');
      tower.shield = Math.max(tower.shield, 520);
      tower.shieldTimer = 10.0;
      tower.hp = Math.min(tower.maxHp, tower.hp + 260);
      tower.skillActiveTimer = 6.0;
      this.vfx.spawnRing(tower.x, tower.y, tower.z, 1.6 * TILE_SIZE, 0xffab40, 0.45);
      this.pushFloatText(tower.x, tower.y + 1.3, tower.z, '紧急物理锁死 +护盾', '#ffab40', true);
    } else if (tower.type === 'interceptor') {
      sound.play('shot_rail');
      tower.skillActiveTimer = 5.5;
      this.vfx.spawnRing(tower.x, tower.y, tower.z, 1.5 * TILE_SIZE, 0x00e5ff, 0.38);
      this.pushFloatText(tower.x, tower.y + 1.4, tower.z, '超频齐射!', '#00e5ff', true);
    } else if (tower.type === 'sandbox') {
      sound.play('skill_scan');
      const rad = 4.6;
      this.vfx.spawnRing(tower.x, tower.y, tower.z, rad * TILE_SIZE, 0x00e676, 0.6);
      for (const e of this.enemies) {
        if (e.dead || e.dyingTimer > 0) continue;
        const d = Math.hypot(e.x - tower.x, e.z - tower.z) / TILE_SIZE;
        if (d <= rad) {
          this._revealEnemy(e, '全域特征扫描');
          if (e.shield > 0) e.shield *= 0.4;
          if (!e.flying) {
            this._damageEnemy(e, 135, { sourceTower: tower, isAoE: true });
          }
        }
      }
      this.pushFloatText(tower.x, tower.y + 1.4, tower.z, '全域特征扫描!', '#00e676', true);
    } else if (tower.type === 'repair') {
      sound.play('skill_failover');
      const stats = this.getTowerStats(tower);
      const rad = stats.range + 0.5;
      this.vfx.spawnRing(tower.x, tower.y, tower.z, rad * TILE_SIZE, 0x69f0ae, 0.65);
      let cleansed = 0;
      for (const ally of this.towers) {
        if (ally.dead) continue;
        const d = Math.hypot(ally.x - tower.x, ally.z - tower.z) / TILE_SIZE;
        if (d <= rad) {
          if (ally.encryptTimer > 0) {
            ally.encryptTimer = 0;
            cleansed++;
            this.vfx.spawnBurst(ally.x, ally.y + 0.9, ally.z, 0x69f0ae, 8, 2.5);
          }
          ally.hp = Math.min(ally.maxHp, ally.hp + 180);
          ally.shield = Math.max(ally.shield, Math.round(Math.max(360, ally.maxHp * 0.35)));
          ally.shieldTimer = Math.max(ally.shieldTimer, 10.0);
          this.vfx.spawnBeam(
            { x: tower.x, y: tower.y + 0.95, z: tower.z },
            { x: ally.x, y: ally.y + 0.65, z: ally.z },
            0x69f0ae,
            0.1,
            0.35
          );
          this.pushFloatText(ally.x, ally.y + 1.25, ally.z, '+护盾 / 净化', '#69f0ae');
        }
      }
      this.addLog('INFO', `「修复进程」释放冗余切换：范围内友塔获得高强护盾${cleansed > 0 ? `，并解除 ${cleansed} 座设备加密` : ''}！`);
    }

    this.onEvent({ type: 'skill_cast', tower });
    return { ok: true };
  }

  retreatTower(towerId) {
    const idx = this.towers.findIndex((t) => !t.dead && t.id === towerId);
    if (idx === -1) return { ok: false, reason: '未找到该设备' };
    const tower = this.towers[idx];
    const refund = Math.round(tower.investedCompute * SELL_REFUND_RATIO);
    this.compute += refund;
    sound.play('sell');
    this.pushFloatText(tower.x, tower.y + 1.1, tower.z, `撤下 +${refund}算力`, '#94a3b8');

    this._removeTowerInternal(tower, false);
    this.addLog('INFO', `已撤下「${tower.def.name}」，回收 ${refund} 算力。`);
    return { ok: true, refund };
  }

  useItem(itemId, gx, gz) {
    const check = this.evaluateItemTarget(itemId, gx, gz);
    if (!check.ok) {
      sound.play('error');
      this.addLog('WARN', check.reason);
      return { ok: false, reason: check.reason };
    }

    const item = ITEMS[itemId];
    if (item.costType === 'intel') this.intel -= item.cost;
    else {
      this.compute -= item.cost;
      this.stats.computeSpent += item.cost;
    }
    this.itemCooldowns[itemId] = item.cooldown;

    const wp = gridToWorld(this.map, gx, gz, 0.14);

    if (itemId === 'isolator') {
      const k = keyOf(gx, gz);
      const ns = this.nodeStates.get(k);
      const model = createIsolatorModel();
      model.root.position.set(wp.x, 0.14, wp.z);
      this.unitLayer.add(model.root);

      const iso = {
        id: this.nextId++,
        gx,
        gz,
        x: wp.x,
        y: 0.14,
        z: wp.z,
        hp: item.maxHp,
        maxHp: item.maxHp,
        timer: item.duration,
        maxTimer: item.duration,
        model,
        dead: false
      };
      this.isolators.push(iso);

      ns.isolated = true;
      ns.source = 'isolator';
      ns.isolatorId = iso.id;
      this.stats.nodeIsolations++;

      sound.play('isolate_lock');
      this.vfx.spawnRing(wp.x, 0.2, wp.z, 1.5 * TILE_SIZE, 0xffab40, 0.42);
      this.addLog('ALERT', `已在「${ns.nodeInfo?.name || k}」插入应急隔离器（持续 ${item.duration}s）。`);
      this.recomputeRoutes('应急隔离');
    } else if (itemId === 'downgrade') {
      for (const c of check.affected) {
        this.downgradedTiles.set(keyOf(c.x, c.z), item.duration);
        const cwp = gridToWorld(this.map, c.x, c.z, 0.14);
        this.vfx.spawnRing(cwp.x, 0.18, cwp.z, 0.9 * TILE_SIZE, 0xffd740, 0.38);
      }
      // 区域内木马立即显形
      for (const e of this.enemies) {
        if (e.dead || e.flying) continue;
        const { gx: ex, gz: ez } = worldToGrid(this.map, e.x, e.z);
        if (this.downgradedTiles.get(keyOf(ex, ez)) > 0) {
          this._revealEnemy(e, '协议降级');
        }
      }
      sound.play('item_downgrade');
      this.addLog('ALERT', `已在 (${gx}, ${gz}) 投放「协议降级」，旧协议减速与显形生效，路由同步更新！`);
      this.recomputeRoutes('协议降级');
    } else if (itemId === 'restore') {
      const t = check.targetTower;
      const healAmt = Math.max(item.minHeal, Math.round(t.maxHp * item.healRatio));
      t.hp = Math.min(t.maxHp, t.hp + healAmt);
      t.encryptTimer = 0;
      t.shield = Math.max(t.shield, item.shieldBonus);
      t.shieldTimer = Math.max(t.shieldTimer, 5.0);
      sound.play('item_restore');
      this.vfx.spawnRing(t.x, t.y, t.z, 1.4 * TILE_SIZE, 0x69f0ae, 0.45);
      this.vfx.spawnBurst(t.x, t.y + 0.9, t.z, 0x69f0ae, 12, 2.8);
      this.pushFloatText(t.x, t.y + 1.35, t.z, `备份还原 +${healAmt}`, '#69f0ae', true);
      this.addLog('INFO', `已对「${t.def.name}」执行备份还原，恢复生命并解除加密！`);
    }

    this.onEvent({ type: 'item_used', itemId, gx, gz });
    return { ok: true };
  }

  getTowerStats(tower) {
    const def = tower.def;
    if (tower.level === 1) return def.lv1;
    if (def.branches && tower.branch) return def.branches[tower.branch];
    return def.lv2;
  }

  // 立即开始下一波（如果处于准备期）
  triggerNextWaveNow() {
    if (this.waveState === 'prep') {
      this.prepTimer = 0;
    }
  }

  // ==========================================================================
  // 主帧步进循环 step(dt) —— 完全确定性，不依赖真实时钟
  // ==========================================================================
  step(rawDt) {
    if (this.paused || this.outcome) return;
    const dt = rawDt * this.speedMult;
    if (dt <= 0) return;

    this.simTime += dt;

    // 1. 道具冷却与协议降级倒计时
    for (const k of Object.keys(this.itemCooldowns)) {
      if (this.itemCooldowns[k] > 0) {
        this.itemCooldowns[k] = Math.max(0, this.itemCooldowns[k] - dt);
      }
    }

    let dgExpired = false;
    for (const [k, rem] of this.downgradedTiles.entries()) {
      const nextRem = rem - dt;
      if (nextRem <= 0) {
        this.downgradedTiles.delete(k);
        dgExpired = true;
      } else {
        this.downgradedTiles.set(k, nextRem);
      }
    }
    if (dgExpired) {
      this.recomputeRoutes('协议恢复');
    }

    // 2. 交换节点冷却、守点情报产出与应急隔离器倒计时
    const inCombat = this.waveState === 'spawning' || this.waveState === 'clearing';
    if (inCombat) {
      // 算力随正常业务进程自然增长
      const gain = 4.2 * dt;
      this.compute += gain;
      this.stats.computeEarned += gain;
    }

    for (const [, ns] of this.nodeStates.entries()) {
      if (!ns.isolated && ns.reisolateCd > 0) {
        ns.reisolateCd = Math.max(0, ns.reisolateCd - dt);
      }
      // 2.9.2：在交战中持续守住隔离节点（塔隔离，非应急隔离器）获得情报！
      if (inCombat && ns.isolated && ns.source === 'tower') {
        ns.intelTick += dt;
        if (ns.intelTick >= 5.0) {
          ns.intelTick -= 5.0;
          this.intel += 1;
          this.stats.intelEarned += 1;
          const t = this.towers.find((tw) => tw.id === ns.towerId);
          if (t) this.pushFloatText(t.x, t.y + 1.35, t.z, '+1 情报 (守点)', '#fbbf24');
        }
      }
    }

    for (let i = this.isolators.length - 1; i >= 0; i--) {
      const iso = this.isolators[i];
      if (iso.dead) {
        this.isolators.splice(i, 1);
        continue;
      }
      iso.model.ring.rotation.z = this.simTime * 3.0;
      iso.timer -= dt;
      if (iso.timer <= 0 || iso.hp <= 0) {
        this._breakIsolator(iso, iso.hp <= 0 ? '被敌方冲毁' : '有效期结束');
        this.isolators.splice(i, 1);
      }
    }

    // 3. 首领地形预警与黑洞/锁死障碍更新
    this._updateHazards(dt);

    // 4. 波次生成推进
    this._updateWaves(dt);

    // 5. 沙箱2级地面特征码隔离区更新
    for (let i = this.sandboxZones.length - 1; i >= 0; i--) {
      const z = this.sandboxZones[i];
      z.timer -= dt;
      if (z.timer <= 0) {
        this.sandboxZones.splice(i, 1);
      } else {
        for (const e of this.enemies) {
          if (e.dead || e.dyingTimer > 0 || e.flying) continue;
          if (Math.hypot(e.x - z.x, e.z - z.z) <= z.radius) {
            this._revealEnemy(e, '沙箱特征区');
            e.noShieldTimer = 0.5;
            this._damageEnemy(e, z.dps * dt, { isAoE: true, silentFloat: true });
          }
        }
      }
    }

    // 6. 更新所有防御塔（阻挡配对、检测、治疗、攻击）
    this._updateTowers(dt);

    // 7. 更新所有敌人与首领（移动、复制、破点冲击、远程攻塔加密、加壳、首领阶段技能）
    this._updateEnemies(dt);

    // 8. 飘字生命周期与场景/特效同步
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.timer -= dt;
      ft.y += dt * 0.65;
      if (ft.timer <= 0) this.floatingTexts.splice(i, 1);
    }

    this.vfx.syncHazards(this.hazards, this.simTime);
    this.vfx.syncSandboxZones(this.sandboxZones, this.simTime);
    this.vfx.syncBlockTethers(this.towers, this.enemies, this.simTime);
    this.vfx.update(dt, this.simTime);

    // 9. 检查胜负结算
    if (this.integrity <= 0 && !this.outcome) {
      this.integrity = 0;
      this.outcome = 'defeat';
      sound.play('defeat');
      this.addLog('CRITICAL', '中枢完整度归零，全域核心数据失守！');
      this.onEvent({ type: 'gameover', victory: false });
    } else if (
      this.waveState === 'done' &&
      this.enemies.every((e) => e.dead) &&
      !this.outcome
    ) {
      this.outcome = 'victory';
      sound.play('victory');
      this.addLog('SUCCESS', '全部入侵波次已肃清，「汐域」中枢安全无虞！');
      this.onEvent({ type: 'gameover', victory: true });
    }
  }

  // ==========================================================================
  // 内部子系统：波次、首领地形技能、防御塔、敌人行为
  // ==========================================================================
  _updateWaves(dt) {
    const totalWaves = this.map.waves.length;
    if (this.waveIndex >= totalWaves) {
      this.waveState = 'done';
      return;
    }

    if (this.waveState === 'prep') {
      this.prepTimer -= dt;
      if (this.prepTimer <= 0) {
        this._startCurrentWave();
      }
    } else if (this.waveState === 'spawning') {
      for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
        const item = this.spawnQueue[i];
        item.time -= dt;
        if (item.time <= 0) {
          this.spawnEnemy(item.type, item.entry);
          this.spawnQueue.splice(i, 1);
        }
      }
      if (this.spawnQueue.length === 0) {
        this.waveState = 'clearing';
      }
    } else if (this.waveState === 'clearing') {
      const anyAlive = this.enemies.some((e) => !e.dead);
      if (!anyAlive) {
        const curWave = this.map.waves[this.waveIndex];
        if (curWave.bonusIntel > 0) {
          this.intel += curWave.bonusIntel;
          this.stats.intelEarned += curWave.bonusIntel;
          this.addLog('INFO', `第 ${curWave.wave} 波威胁清除，截获情报 +${curWave.bonusIntel}。`);
        }
        this.waveIndex++;
        if (this.waveIndex >= totalWaves) {
          this.waveState = 'done';
        } else {
          this.waveState = 'prep';
          this.prepTimer = 5.5;
          this.onEvent({ type: 'wave_prep', wave: this.waveIndex + 1 });
        }
      }
    }
  }

  _startCurrentWave() {
    const w = this.map.waves[this.waveIndex];
    this.waveState = 'spawning';
    this.spawnQueue = [];

    for (const g of w.groups) {
      for (let c = 0; c < g.count; c++) {
        this.spawnQueue.push({
          entry: g.entry,
          type: g.type,
          time: (g.delay || 0) + c * (g.interval || 1.1)
        });
      }
    }
    this.spawnQueue.sort((a, b) => a.time - b.time);

    if (w.alert) {
      this.addLog('ALERT', w.alert);
      this.onEvent({ type: 'banner', text: w.alert, critical: !!w.isBossWave || !!w.isFloodPeak });
    } else {
      this.addLog('INFO', `第 ${w.wave}/${this.map.waves.length} 波「${w.title}」来袭！`);
    }
    this.onEvent({ type: 'wave_start', wave: w.wave, waveDef: w });
  }

  spawnEnemy(type, entryId, customWorldPos = null, extraProps = {}) {
    const def = ENEMIES[type] || BOSSES[type];
    if (!def) return null;

    const entry = this.map.entries.find((e) => e.id === entryId) || this.map.entries[0];
    const wp = customWorldPos || gridToWorld(this.map, entry.x, entry.z, 0.14);

    // 飞行单位锁定最近出口
    let airTargetExit = this.map.exits[0];
    if (def.flying && this.map.exits.length > 1) {
      let bestD = Infinity;
      for (const ex of this.map.exits) {
        const d = Math.hypot(ex.x - entry.x, ex.z - entry.z);
        if (d < bestD) {
          bestD = d;
          airTargetExit = ex;
        }
      }
    }

    const enemy = {
      id: this.nextId++,
      type,
      def,
      isBoss: !!def.isBoss,
      flying: !!def.flying,
      entryId: entry.id,
      x: wp.x + (customWorldPos ? 0 : (this.rng() - 0.5) * 0.24),
      y: 0.14,
      z: wp.z + (customWorldPos ? 0 : (this.rng() - 0.5) * 0.24),
      hp: def.maxHp,
      maxHp: def.maxHp,
      shield: 0,
      speed: def.speed,
      heading: 0,
      disguised: !!def.startsDisguised,
      isClone: false,
      replicated: false,
      blockedByTowerId: null,
      luredByTowerId: null,
      snareTimer: 0,
      vulnTimer: 0,
      slowTimer: 0,
      slowPct: 0,
      noShieldTimer: 0,
      atkTimer: 0.4,
      auxTimer: 2.8,
      bossSkillTimer: 4.5,
      bossPhase: 1,
      huntCheckTimer: 0.2,
      huntTarget: null,
      goalCell: null,
      airExit: airTargetExit,
      rerouteIconTimer: 0,
      animSeed: this.rng() * 10,
      attackAnim: 0,
      hitAnim: 0,
      dyingTimer: 0,
      dead: false,
      ...extraProps
    };

    enemy.model = createEnemyModel(enemy);
    enemy.model.root.position.set(enemy.x, 0.14, enemy.z);
    this.unitLayer.add(enemy.model.root);
    this.enemies.push(enemy);

    if (!enemy.flying) {
      this._refreshEnemyNextHop(enemy, false);
    }

    if (!this.seenEnemyTypes.has(type)) {
      this.seenEnemyTypes.add(type);
      if (enemy.isBoss) {
        sound.play('boss_spawn');
      }
      this.onEvent({ type: 'new_enemy_seen', enemyType: type, def });
    }

    return enemy;
  }

  _revealEnemy(enemy, sourceLabel = '') {
    if (!enemy.disguised) return;
    enemy.disguised = false;
    sound.play('trojan_reveal');
    this.vfx.spawnBurst(enemy.x, 0.6, enemy.z, 0xce93d8, 7, 2.2);
    this.pushFloatText(enemy.x, 0.95, enemy.z, '已显形!', '#f472b6');
    if (enemy.isBoss) {
      this.addLog('INFO', `首领「${enemy.def.name}」已被${sourceLabel}剥离潜伏伪装！`);
    }
  }

  _updateTowers(dt) {
    // 清理失效阻挡引用
    for (const t of this.towers) {
      if (t.dead) continue;
      for (const eid of Array.from(t.blockedIds)) {
        const e = this.enemies.find((en) => en.id === eid);
        if (!e || e.dead || e.dyingTimer > 0 || e.blockedByTowerId !== t.id) {
          t.blockedIds.delete(eid);
        }
      }
    }

    for (const tower of this.towers) {
      if (tower.dead) continue;
      tower.age += dt;
      if (tower.skillCd > 0) tower.skillCd = Math.max(0, tower.skillCd - dt);
      if (tower.skillActiveTimer > 0) tower.skillActiveTimer = Math.max(0, tower.skillActiveTimer - dt);
      if (tower.encryptTimer > 0) tower.encryptTimer = Math.max(0, tower.encryptTimer - dt);
      if (tower.attackAnim > 0) tower.attackAnim = Math.max(0, tower.attackAnim - dt * 3.5);
      if (tower.hitAnim > 0) tower.hitAnim = Math.max(0, tower.hitAnim - dt * 3.5);
      if (tower.shieldTimer > 0) {
        tower.shieldTimer -= dt;
        if (tower.shieldTimer <= 0 && !(tower.type === 'honeypot' && tower.branch === 'B')) {
          tower.shield = 0;
        }
      }

      const stats = this.getTowerStats(tower);

      // 蜜罐分支 B：周期性刷新全息诱饵护盾
      if (tower.type === 'honeypot' && tower.branch === 'B' && tower.encryptTimer <= 0) {
        tower.decoyTimer -= dt;
        if (tower.decoyTimer <= 0) {
          tower.decoyTimer = stats.decoyPeriod || 8.0;
          tower.shield = Math.max(tower.shield, stats.decoyShield || 320);
          this.vfx.spawnRing(tower.x, tower.y, tower.z, 1.1 * TILE_SIZE, 0xffe082, 0.35);
        }
      }

      // 1) 阻挡吸附（防火墙在链路阻挡本格、在节点跨格拦截邻路；蜜罐阻挡本格并吸引邻近攻塔敌人）
      // 注意 2.8.3：加密不解除阻挡或节点隔离！
      const maxBlock = tower.onNode ? (stats.nodeBlockCap ?? 0) : (stats.blockCap ?? 0);
      if (maxBlock > 0) {
        let usedCap = 0;
        for (const eid of tower.blockedIds) {
          const en = this.enemies.find((x) => x.id === eid);
          if (en) usedCap += en.def.blockCost || 1;
        }

        if (usedCap < maxBlock) {
          const catchRad = tower.onNode
            ? 1.22 * TILE_SIZE
            : tower.type === 'honeypot'
              ? 1.45 * TILE_SIZE
              : 0.78 * TILE_SIZE;
          for (const e of this.enemies) {
            if (e.dead || e.dyingTimer > 0 || e.flying) continue;
            // 蜜罐主动将附近正在攻击其他友方链路塔的敌人嘲讽吸引过来承担伤害！
            if (tower.type === 'honeypot' && e.blockedByTowerId && e.blockedByTowerId !== tower.id) {
              const otherTw = this.towers.find((x) => x.id === e.blockedByTowerId);
              if (otherTw && otherTw.type !== 'honeypot' && Math.hypot(e.x - tower.x, e.z - tower.z) <= (stats.tauntRange || 2.9) * TILE_SIZE) {
                const cost = e.def.blockCost || 1;
                if (usedCap + cost <= maxBlock) {
                  otherTw.blockedIds.delete(e.id);
                  e.blockedByTowerId = tower.id;
                  e.luredByTowerId = tower.id;
                  tower.blockedIds.add(e.id);
                  usedCap += cost;
                  continue;
                }
              }
            }
            if (e.blockedByTowerId) continue;
            const cost = e.def.blockCost || 1;
            if (usedCap + cost > maxBlock) continue;
            const d = Math.hypot(e.x - tower.x, e.z - tower.z);
            if (d <= catchRad) {
              e.blockedByTowerId = tower.id;
              if (tower.type === 'honeypot') {
                e.luredByTowerId = tower.id;
                e.huntTarget = null;
              }
              tower.blockedIds.add(e.id);
              usedCap += cost;
              // 2.5.3 阻挡使伪装木马/潜伏目标立即显形！
              this._revealEnemy(e, '近战阻挡');
            }
          }
        }
      }

      // 若被勒索者加密，停止检测、攻击与治疗！
      if (tower.encryptTimer > 0) {
        updateTowerAnimation(tower, this.simTime, dt);
        continue;
      }

      // 2) 沙箱持续实时检测范围内所有伪装目标
      if (tower.type === 'sandbox') {
        const scanWorldR = stats.range * TILE_SIZE;
        for (const e of this.enemies) {
          if (e.dead || e.dyingTimer > 0 || !e.disguised) continue;
          if (Math.hypot(e.x - tower.x, e.z - tower.z) <= scanWorldR) {
            this._revealEnemy(e, '沙箱检测');
          }
        }
      }

      // 3) 修复进程 Lv.2 自动定时净化友塔加密
      if (tower.type === 'repair' && tower.level >= 2 && stats.autoCleanseInterval) {
        tower.autoCleanseTimer -= dt;
        if (tower.autoCleanseTimer <= 0) {
          const encryptedAlly = this.towers.find(
            (a) => !a.dead && a.encryptTimer > 0 && Math.hypot(a.x - tower.x, a.z - tower.z) <= stats.range * TILE_SIZE
          );
          if (encryptedAlly) {
            encryptedAlly.encryptTimer = 0;
            tower.autoCleanseTimer = stats.autoCleanseInterval;
            this.vfx.spawnBurst(encryptedAlly.x, encryptedAlly.y + 0.8, encryptedAlly.z, 0x69f0ae, 7, 2.2);
            this.pushFloatText(encryptedAlly.x, encryptedAlly.y + 1.2, encryptedAlly.z, '自动净化加密', '#69f0ae');
          } else {
            tower.autoCleanseTimer = 1.0;
          }
        }
      }

      // 4) 攻击 / 治疗循环
      if (!stats.atkInterval || stats.atkInterval <= 0) {
        updateTowerAnimation(tower, this.simTime, dt);
        continue;
      }

      const haste = tower.type === 'interceptor' && tower.skillActiveTimer > 0 ? 1.8 : 1.0;
      tower.atkTimer -= dt * haste;
      if (tower.atkTimer <= 0) {
        const fired = this._fireTower(tower, stats);
        tower.atkTimer = fired ? stats.atkInterval : 0.12;
      }

      updateTowerAnimation(tower, this.simTime, dt);
    }
  }

  // 计算敌人沿路线距离出口的剩余距离（用于 2.8.1 “塔优先攻击沿路线离出口最近的有效目标”）
  _getEnemyRemainingDist(e) {
    if (e.flying && e.airExit) {
      const wp = gridToWorld(this.map, e.airExit.x, e.airExit.z);
      return Math.hypot(e.x - wp.x, e.z - wp.z) / TILE_SIZE;
    }
    const { gx, gz } = worldToGrid(this.map, e.x, e.z);
    const d = this.distanceField?.dist[gz]?.[gx];
    return Number.isFinite(d) ? d : 999;
  }

  _fireTower(tower, stats) {
    if (tower.type === 'repair') {
      // 治疗范围内受损友方塔
      const candidates = this.towers
        .filter((a) => !a.dead && a.id !== tower.id && a.hp < a.maxHp - 1 && Math.hypot(a.x - tower.x, a.z - tower.z) <= stats.range * TILE_SIZE)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);

      if (candidates.length === 0) return false;
      const count = Math.min(stats.targets || 1, candidates.length);
      for (let i = 0; i < count; i++) {
        const target = candidates[i];
        const missing = target.maxHp - target.hp;
        const actual = Math.min(missing, stats.heal);
        target.hp += actual;
        if (stats.overhealShield && stats.heal > missing) {
          target.shield = Math.min(stats.overhealShield, target.shield + (stats.heal - missing));
          target.shieldTimer = Math.max(target.shieldTimer, 5.0);
        }
        this.vfx.spawnBeam(
          { x: tower.x, y: tower.y + 0.95, z: tower.z },
          { x: target.x, y: target.y + 0.6, z: target.z },
          0x69f0ae,
          0.07,
          0.22
        );
        this.pushFloatText(target.x, target.y + 1.15, target.z, `+${Math.round(stats.heal)}`, '#69f0ae');
      }
      tower.attackAnim = 1.0;
      sound.play('heal');
      return true;
    }

    if (tower.type === 'interceptor') {
      // 定向矩形射界筛选（可打击地面与飞行；显形前不可主动选中伪装目标！）
      const cosA = Math.cos(-tower.dirAngle);
      const sinA = Math.sin(-tower.dirAngle);
      const maxF = stats.forwardLen * TILE_SIZE;
      const maxW = stats.halfWidth * TILE_SIZE;

      const inSector = [];
      for (const e of this.enemies) {
        if (e.dead || e.dyingTimer > 0 || e.disguised) continue;
        const dx = e.x - tower.x;
        const dz = e.z - tower.z;
        // 转换到炮塔局部坐标 (+Z 为正前方)
        const localX = dx * cosA - dz * sinA;
        const localZ = dx * sinA + dz * cosA;
        if (localZ >= -0.2 && localZ <= maxF && Math.abs(localX) <= maxW) {
          inSector.push({ e, rem: this._getEnemyRemainingDist(e), localX, localZ });
        }
      }
      if (inSector.length === 0) {
        tower.aimOffset *= 0.85;
        tower.aimPitch = (tower.aimPitch || 0) * 0.85;
        return false;
      }

      // 压制分支优先锁定无线飞行单位伪热点，再按离出口最近排序
      inSector.sort((a, b) => {
        if (stats.preferAir && a.e.flying !== b.e.flying) return a.e.flying ? -1 : 1;
        return a.rem - b.rem;
      });

      const primary = inSector[0];
      tower.aimOffset = Math.max(-0.45, Math.min(0.45, Math.atan2(primary.localX, Math.max(0.5, primary.localZ))));
      const horizDist = Math.max(1.2, Math.hypot(primary.localX, primary.localZ));
      const targetY = primary.e.flying ? 1.68 : 0.46;
      tower.aimPitch = Math.max(-0.28, Math.min(0.45, Math.atan2(targetY - (tower.y + 0.52), horizDist)));
      tower.attackAnim = 1.0;

      const dmgBoost = tower.skillActiveTimer > 0 ? 1.25 : 1.0;
      const baseDmg = stats.atk * dmgBoost;

      if (stats.pierceLine) {
        // 分支 A：穿透轨道炮 —— 沿直线贯穿所有敌人（含未显形木马会被波及！）
        sound.play('shot_rail');
        const dirX = primary.e.x - tower.x;
        const dirZ = primary.e.z - tower.z;
        const len = Math.hypot(dirX, dirZ) || 1;
        const ux = dirX / len;
        const uz = dirZ / len;
        const endPos = {
          x: tower.x + ux * maxF,
          y: primary.e.flying ? 1.65 : 0.55,
          z: tower.z + uz * maxF
        };
        this.vfx.spawnBeam(
          { x: tower.x, y: tower.y + 0.65, z: tower.z },
          endPos,
          0x7dd3fc,
          0.13,
          0.22
        );

        for (const cand of this.enemies) {
          if (cand.dead || cand.dyingTimer > 0) continue;
          const vx = cand.x - tower.x;
          const vz = cand.z - tower.z;
          const proj = vx * ux + vz * uz;
          if (proj < 0 || proj > maxF + 0.4) continue;
          const perp = Math.abs(vx * uz - vz * ux);
          if (perp <= 0.68) {
            this._damageEnemy(cand, baseDmg, {
              sourceTower: tower,
              shieldMult: stats.shieldMult || 2.3,
              isAoE: true
            });
          }
        }
      } else {
        // 标准或分支 B（多目标压制减速）
        const lockMax = (stats.multiTargets || 1) + (tower.skillActiveTimer > 0 && tower.branch === 'B' ? 1 : 0);
        const count = Math.min(lockMax, inSector.length);
        sound.play(tower.branch === 'B' ? 'shot_suppress' : 'shot_interceptor');

        for (let i = 0; i < count; i++) {
          const tgt = inSector[i].e;
          this.vfx.spawnBeam(
            { x: tower.x, y: tower.y + 0.62, z: tower.z },
            { x: tgt.x, y: tgt.flying ? 1.65 : 0.52, z: tgt.z },
            0x00e5ff,
            0.065,
            0.13
          );
          if (stats.slowPct) {
            tgt.slowPct = Math.max(tgt.slowPct, stats.slowPct);
            tgt.slowTimer = Math.max(tgt.slowTimer, stats.slowDur || 2.2);
          }
          this._damageEnemy(tgt, baseDmg, { sourceTower: tower, isAoE: false });
        }
      }
      return true;
    }

    if (tower.type === 'sandbox') {
      // 沙箱：对地面敌人进行范围解析爆破
      const worldR = stats.range * TILE_SIZE;
      const groundIn = this.enemies
        .filter((e) => !e.dead && e.dyingTimer <= 0 && !e.flying && Math.hypot(e.x - tower.x, e.z - tower.z) <= worldR)
        .sort((a, b) => this._getEnemyRemainingDist(a) - this._getEnemyRemainingDist(b));

      if (groundIn.length === 0) return false;
      const center = groundIn[0];
      tower.attackAnim = 1.0;
      sound.play('shot_sandbox');

      const splashW = (stats.splashRadius || 1.35) * TILE_SIZE;
      this.vfx.spawnBeam(
        { x: tower.x, y: tower.y + 0.82, z: tower.z },
        { x: center.x, y: 0.35, z: center.z },
        0x00e676,
        0.075,
        0.16
      );
      this.vfx.spawnRing(center.x, 0.16, center.z, splashW, 0x00e676, 0.36);

      for (const e of this.enemies) {
        if (e.dead || e.dyingTimer > 0 || e.flying) continue;
        if (Math.hypot(e.x - center.x, e.z - center.z) <= splashW) {
          this._revealEnemy(e, '沙箱解析');
          this._damageEnemy(e, stats.atk, { sourceTower: tower, isAoE: true });
        }
      }

      if (stats.leaveZone) {
        this.sandboxZones.push({
          x: center.x,
          z: center.z,
          radius: splashW * 0.9,
          dps: stats.zoneDps || 28,
          timer: stats.zoneDur || 3.0
        });
      }
      return true;
    }

    if (tower.type === 'firewall' || tower.type === 'honeypot') {
      // 近战攻击被阻挡或邻近敌人
      const worldR = (stats.range || 1.25) * TILE_SIZE;
      const near = this.enemies
        .filter((e) => !e.dead && e.dyingTimer <= 0 && !e.flying && Math.hypot(e.x - tower.x, e.z - tower.z) <= worldR)
        .sort((a, b) => {
          const aBlk = a.blockedByTowerId === tower.id ? 0 : 1;
          const bBlk = b.blockedByTowerId === tower.id ? 0 : 1;
          if (aBlk !== bBlk) return aBlk - bBlk;
          return this._getEnemyRemainingDist(a) - this._getEnemyRemainingDist(b);
        });

      if (near.length === 0) return false;
      tower.attackAnim = 1.0;
      tower.atkCount++;
      sound.play('shot_firewall');

      if (stats.cleave) {
        // 防火墙 Lv.2 扇形顺劈 + 每3击规则自愈破盾
        this.vfx.spawnRing(tower.x, tower.y, tower.z, worldR, 0x29b6f6, 0.25);
        const healSelf = tower.atkCount % (stats.selfCleanseEvery || 3) === 0;
        if (healSelf) {
          tower.hp = Math.min(tower.maxHp, tower.hp + 45);
        }
        for (const tgt of near.slice(0, 4)) {
          if (healSelf && tgt.shield > 0) tgt.shield = Math.max(0, tgt.shield - 95);
          this.vfx.spawnBeam(
            { x: tower.x, y: tower.y + 0.48, z: tower.z },
            { x: tgt.x, y: 0.45, z: tgt.z },
            tower.def.color,
            0.055,
            0.12
          );
          this._damageEnemy(tgt, stats.atk, { sourceTower: tower, isAoE: true });
        }
      } else {
        const tgt = near[0];
        this.vfx.spawnBeam(
          { x: tower.x, y: tower.y + 0.48, z: tower.z },
          { x: tgt.x, y: 0.45, z: tgt.z },
          tower.def.color,
          0.055,
          0.12
        );
        this.vfx.spawnBurst(tgt.x, 0.45, tgt.z, tower.def.color, 4, 1.8);
        this._damageEnemy(tgt, stats.atk, { sourceTower: tower, isAoE: false });
      }
      return true;
    }

    return false;
  }

  _damageEnemy(enemy, rawDmg, { sourceTower = null, shieldMult = 1.0, isAoE = false, silentFloat = false } = {}) {
    if (enemy.dead || enemy.dyingTimer > 0) return;

    let dmg = rawDmg;
    if (enemy.vulnTimer > 0) dmg *= 1.3;
    // 蛰影提权阶段重甲减免
    if (enemy.type === 'zheying' && enemy.bossPhase === 2) dmg *= 0.72;

    if (enemy.shield > 0) {
      const sDmg = dmg * shieldMult;
      if (enemy.shield >= sDmg) {
        enemy.shield -= sDmg;
        dmg = 0;
      } else {
        const leftoverRatio = (sDmg - enemy.shield) / sDmg;
        enemy.shield = 0;
        dmg = dmg * leftoverRatio;
      }
    }

    enemy.hp -= dmg;
    enemy.hitAnim = 1.0;

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      this._killEnemy(enemy, sourceTower, isAoE);
    }
  }

  _killEnemy(enemy, killerTower, wasAoE) {
    if (enemy.dyingTimer > 0 || enemy.dead) return;
    enemy.dyingTimer = 0.32;

    // 释放被占用的阻挡位
    if (enemy.blockedByTowerId) {
      const bt = this.towers.find((t) => t.id === enemy.blockedByTowerId);
      if (bt) bt.blockedIds.delete(enemy.id);
      enemy.blockedByTowerId = null;
    }

    // 2.5.3 木马核心机制：未显形就被攻击波及消灭时释放载荷，炸伤附近的塔！
    if (enemy.type === 'trojan' && enemy.disguised) {
      const pRad = (enemy.def.payloadRadius || 2.25) * TILE_SIZE;
      const pDmg = enemy.def.payloadDamage || 165;
      sound.play('trojan_explode');
      this.vfx.spawnRing(enemy.x, 0.25, enemy.z, pRad, 0xe040fb, 0.55);
      this.vfx.spawnBurst(enemy.x, 0.6, enemy.z, 0xff4081, 14, 4.2);
      this.pushFloatText(enemy.x, 1.1, enemy.z, '隐匿载荷自爆!', '#ff4081', true);
      this.addLog('WARN', '未显形的「木马」被波及摧毁，释放恶意载荷炸伤周边设备！');

      for (const tw of this.towers) {
        if (tw.dead) continue;
        if (Math.hypot(tw.x - enemy.x, tw.z - enemy.z) <= pRad) {
          this._damageTower(tw, pDmg, enemy, '木马载荷');
        }
      }
    } else {
      this.vfx.spawnBurst(enemy.x, enemy.flying ? 1.65 : 0.55, enemy.z, enemy.def.color, enemy.isBoss ? 22 : 8, 3.0);
    }

    // 算力与情报奖励结算
    const cGain = enemy.def.rewardCompute || 10;
    let iGain = enemy.def.rewardIntel || 0;

    // 检查是否被蜜罐分支 A（高交互蜜网）诱捕或阻挡过
    if (enemy.luredByTowerId) {
      const hpTower = this.towers.find((t) => !t.dead && t.id === enemy.luredByTowerId);
      if (hpTower && hpTower.type === 'honeypot' && hpTower.branch === 'A') {
        iGain += 2;
      }
    }

    this.compute += cGain;
    this.intel += iGain;
    this.stats.kills++;
    this.stats.computeEarned += cGain;
    this.stats.intelEarned += iGain;
    if (enemy.isBoss) this.stats.bossKilled = true;

    if (iGain > 0) {
      this.pushFloatText(enemy.x, 1.0, enemy.z, `+${cGain}算力 +${iGain}情报`, '#fde047');
    }
  }

  _damageTower(tower, rawDmg, attackerEnemy = null, label = '') {
    if (tower.dead) return;
    const stats = this.getTowerStats(tower);
    let mult = 1 - (stats.armor || 0);
    if (tower.type === 'firewall' && tower.skillActiveTimer > 0) mult *= 0.55;
    let dmg = Math.max(1, rawDmg * mult);

    // 护盾优先吸收伤害
    if (tower.shield > 0) {
      if (tower.shield >= dmg) {
        tower.shield -= dmg;
        this.pushFloatText(tower.x, tower.y + 1.15, tower.z, `护盾 -${Math.round(dmg)}`, '#7dd3fc');
        dmg = 0;
      } else {
        dmg -= tower.shield;
        tower.shield = 0;
      }
    }

    if (dmg > 0) {
      tower.hp -= dmg;
      tower.hitAnim = 1.0;
      this.pushFloatText(tower.x, tower.y + 1.15, tower.z, `-${Math.round(dmg)}`, '#ff5252');
    }

    // 蜜罐分支 A（高交互蜜网）：反弹受击伤害并使攻击者显形！
    if (tower.type === 'honeypot' && tower.branch === 'A' && attackerEnemy && !attackerEnemy.dead) {
      this._revealEnemy(attackerEnemy, '蜜网溯源');
      this._damageEnemy(attackerEnemy, rawDmg * (stats.reflectRatio || 0.45), { sourceTower: tower });
    }

    if (tower.hp <= 0) {
      tower.hp = 0;
      this._destroyTower(tower, label || attackerEnemy?.def?.name || '敌方攻击');
    }
  }

  _destroyTower(tower, killerName) {
    if (tower.dead) return;
    this.stats.towersLost++;
    this.vfx.spawnRing(tower.x, tower.y, tower.z, 1.7 * TILE_SIZE, 0xff5252, 0.5);
    this.vfx.spawnBurst(tower.x, tower.y + 0.6, tower.z, 0xff7043, 16, 3.8);
    this.pushFloatText(tower.x, tower.y + 1.4, tower.z, `${tower.def.name}被摧毁!`, '#ff1744', true);
    this._removeTowerInternal(tower, true, killerName);
  }

  _removeTowerInternal(tower, wasDestroyed, killerName = '') {
    tower.dead = true;
    // 释放其阻挡的所有敌人
    for (const eid of tower.blockedIds) {
      const e = this.enemies.find((x) => x.id === eid);
      if (e && e.blockedByTowerId === tower.id) {
        e.blockedByTowerId = null;
      }
    }
    tower.blockedIds.clear();

    if (tower.model) {
      this.unitLayer.remove(tower.model.root);
    }

    const idx = this.towers.indexOf(tower);
    if (idx !== -1) this.towers.splice(idx, 1);

    // 若部署在交换节点上：解除隔离，触发设备旁路直通并进入再次隔离冷却（2.7.1 & 3.3）！
    if (tower.onNode) {
      const k = keyOf(tower.gx, tower.gz);
      const ns = this.nodeStates.get(k);
      if (ns && ns.isolated && ns.towerId === tower.id) {
        ns.isolated = false;
        ns.source = null;
        ns.towerId = null;
        ns.reisolateCd = NODE_REISOLATE_COOLDOWN;
        sound.play('bypass_open');
        const reasonText = wasDestroyed
          ? `「${ns.nodeInfo?.name || k}」上的${tower.def.name}被${killerName}冲垮，节点旁路直通！`
          : `「${ns.nodeInfo?.name || k}」设备撤离，恢复旁路直通！`;
        this.addLog('ALERT', reasonText);
        this.pushFloatText(tower.x, tower.y + 1.7, tower.z, '节点旁路直通!', '#ff9100', true);
        this.recomputeRoutes('旁路直通');
      }
    }

    this.onEvent({ type: 'tower_removed', tower, wasDestroyed });
  }

  _breakIsolator(iso, reasonText) {
    iso.dead = true;
    this.unitLayer.remove(iso.model.root);
    const k = keyOf(iso.gx, iso.gz);
    const ns = this.nodeStates.get(k);
    if (ns && ns.isolated && ns.isolatorId === iso.id) {
      ns.isolated = false;
      ns.source = null;
      ns.isolatorId = null;
      ns.reisolateCd = NODE_REISOLATE_COOLDOWN;
      sound.play('bypass_open');
      this.vfx.spawnRing(iso.x, 0.2, iso.z, 1.5 * TILE_SIZE, 0xff9100, 0.45);
      this.pushFloatText(iso.x, 1.35, iso.z, `隔离器失效 · 旁路直通`, '#ffab40', true);
      this.addLog('ALERT', `「${ns.nodeInfo?.name || k}」应急隔离器${reasonText}，道路重新开放！`);
      this.recomputeRoutes('隔离器失效');
    }
  }

  _updateEnemies(dt) {
    // 收集已隔离节点集合供洪泛团感知
    const isolatedNodeKeys = new Set();
    for (const [k, ns] of this.nodeStates.entries()) {
      if (ns.isolated) isolatedNodeKeys.add(k);
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        this.enemies.splice(i, 1);
        continue;
      }

      if (e.dyingTimer > 0) {
        e.dyingTimer -= dt;
        updateEnemyAnimation(e, this.simTime, dt);
        if (e.dyingTimer <= 0) {
          e.dead = true;
          this.unitLayer.remove(e.model.root);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      if (e.snareTimer > 0) e.snareTimer = Math.max(0, e.snareTimer - dt);
      if (e.vulnTimer > 0) e.vulnTimer = Math.max(0, e.vulnTimer - dt);
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        if (e.slowTimer <= 0) e.slowPct = 0;
      }
      if (e.noShieldTimer > 0) e.noShieldTimer = Math.max(0, e.noShieldTimer - dt);
      if (e.rerouteIconTimer > 0) e.rerouteIconTimer = Math.max(0, e.rerouteIconTimer - dt);
      if (e.attackAnim > 0) e.attackAnim = Math.max(0, e.attackAnim - dt * 3.5);
      if (e.hitAnim > 0) e.hitAnim = Math.max(0, e.hitAnim - dt * 3.8);

      const { gx, gz } = worldToGrid(this.map, e.x, e.z);
      const curTile = this.map.grid[gz]?.[gx];
      const curKey = keyOf(gx, gz);

      // A. 地面地形交互：旧链路/协议降级减速与显形 + 蠕虫经过直通节点复制
      let terrainSpeedMult = 1.0;
      if (!e.flying) {
        const onLegacy = curTile === TILE.LEGACY || (this.downgradedTiles.get(curKey) || 0) > 0;
        if (onLegacy) {
          terrainSpeedMult = LEGACY_SPEED_MULT;
          if (e.disguised) this._revealEnemy(e, '旧协议链路');
        }

        // 网闸 Lv.2 邻格电磁阻尼减速光环
        for (const tw of this.towers) {
          if (!tw.dead && tw.type === 'airgap' && tw.level >= 2) {
            if (Math.hypot(tw.x - e.x, tw.z - e.z) <= 1.55 * TILE_SIZE) {
              terrainSpeedMult = Math.min(terrainSpeedMult, 0.7);
            }
          }
        }

        // 2.5.1 蠕虫：首次经过直通交换节点时分裂复制同伴（复制体不再复制）！
        if (e.type === 'worm' && !e.isClone && !e.replicated && curTile === TILE.NODE) {
          const ns = this.nodeStates.get(curKey);
          if (ns && !ns.isolated) {
            e.replicated = true;
            const clone = this.spawnEnemy(
              'worm',
              e.entryId,
              { x: e.x + 0.32, y: 0.14, z: e.z - 0.25 },
              { isClone: true, replicated: true }
            );
            if (clone) {
              sound.play('enemy_split');
              this.vfx.spawnRing(e.x, 0.2, e.z, 0.9 * TILE_SIZE, 0xff5252, 0.35);
              this.pushFloatText(e.x, 0.9, e.z, '蠕虫复制 ×2!', '#ff8a80');
            }
          }
        }
      }

      // B. 加壳器周期性群体护盾支援（2.5.6）
      if (e.type === 'packer') {
        e.auxTimer -= dt;
        if (e.auxTimer <= 0) {
          e.auxTimer = e.def.shieldPeriod || 4.5;
          const sRad = (e.def.shieldRadius || 2.65) * TILE_SIZE;
          let count = 0;
          for (const ally of this.enemies) {
            if (ally.dead || ally.dyingTimer > 0 || ally.flying || ally.noShieldTimer > 0) continue;
            if (Math.hypot(ally.x - e.x, ally.z - e.z) <= sRad) {
              ally.shield = Math.max(ally.shield, e.def.shieldAmount || 190);
              count++;
            }
          }
          if (count > 0) {
            this.vfx.spawnRing(e.x, 0.25, e.z, sRad, 0xffd54f, 0.42);
          }
        }
      }

      // C. 勒索者边移动边远程攻击守方塔并施加加密（优先攻击蜜罐！2.5.4）
      if (e.type === 'ransom') {
        e.atkTimer -= dt;
        if (e.atkTimer <= 0) {
          const rWorld = (e.def.rangedRange || 3.25) * TILE_SIZE;
          const inRangeTowers = this.towers.filter(
            (tw) => !tw.dead && Math.hypot(tw.x - e.x, tw.z - e.z) <= rWorld
          );
          if (inRangeTowers.length > 0) {
            // 优先攻击射程内的蜜罐！
            inRangeTowers.sort((a, b) => {
              const aHp = a.type === 'honeypot' ? 0 : 1;
              const bHp = b.type === 'honeypot' ? 0 : 1;
              if (aHp !== bHp) return aHp - bHp;
              return Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z);
            });
            let targetTw = inRangeTowers[0];

            // 检查是否有蜜罐分支 B（镜像诱饵阵）偏转保护该友塔！
            if (targetTw.type !== 'honeypot') {
              const protector = this.towers.find(
                (h) =>
                  !h.dead &&
                  h.type === 'honeypot' &&
                  h.branch === 'B' &&
                  Math.hypot(h.x - targetTw.x, h.z - targetTw.z) <= 4.0 * TILE_SIZE
              );
              if (protector) targetTw = protector;
            }

            e.atkTimer = e.def.atkInterval || 1.45;
            e.attackAnim = 1.0;
            this.vfx.spawnBeam(
              { x: e.x, y: 0.68, z: e.z },
              { x: targetTw.x, y: targetTw.y + 0.62, z: targetTw.z },
              0xe040fb,
              0.08,
              0.22
            );
            this._damageTower(targetTw, e.def.towerAtk, e, '勒索者');

            if (!targetTw.dead && !targetTw.def.immuneEncrypt) {
              targetTw.encryptHitsTaken = (targetTw.encryptHitsTaken || 0) + 1;
              if (targetTw.encryptHitsTaken >= (e.def.encryptHits || 2)) {
                targetTw.encryptHitsTaken = 0;
                const wasEnc = targetTw.encryptTimer > 0;
                targetTw.encryptTimer = Math.max(targetTw.encryptTimer, e.def.encryptDur || 5.2);
                if (!wasEnc) {
                  sound.play('encrypt_lock');
                  this.pushFloatText(targetTw.x, targetTw.y + 1.45, targetTw.z, '🔒 勒索加密!', '#ea80fc', true);
                }
              }
            }
          } else {
            e.atkTimer = 0.25;
          }
        }
      }

      // D. 三位首领专属阶段转换与预警/地形改变技能（2.5）
      if (e.isBoss) {
        this._updateBossLogic(e, dt, isolatedNodeKeys);
      }

      // E. 洪泛团感知并脱离原路线冲击附近被隔离节点（2.5.2）
      if (e.type === 'flood' && !e.blockedByTowerId) {
        e.huntCheckTimer -= dt;
        if (e.huntCheckTimer <= 0) {
          e.huntCheckTimer = 0.65;
          if (isolatedNodeKeys.size > 0) {
            const approach = findNearestIsolatedNodeApproach(
              this.map,
              gx,
              gz,
              isolatedNodeKeys,
              this.blockedSet,
              e.def.nodeSenseDist || 6
            );
            e.huntTarget = approach;
          } else {
            e.huntTarget = null;
          }
        }
      }

      // F. 若处于被阻挡交战状态：停下脚步攻击挡住它的塔！
      if (e.blockedByTowerId) {
        const blkTower = this.towers.find((t) => !t.dead && t.id === e.blockedByTowerId);
        if (!blkTower) {
          e.blockedByTowerId = null;
        } else {
          e.heading = Math.atan2(blkTower.x - e.x, blkTower.z - e.z);
          if (e.def.towerAtk > 0) {
            e.atkTimer -= dt;
            if (e.atkTimer <= 0) {
              e.atkTimer = e.def.atkInterval || 1.05;
              e.attackAnim = 1.0;
              const mult = e.type === 'flood' && blkTower.onNode ? e.def.nodeStrikeMult || 1.85 : 1.0;
              if (mult > 1.2) sound.play('enemy_slam');
              this.vfx.spawnBeam(
                { x: e.x, y: 0.48, z: e.z },
                { x: blkTower.x, y: blkTower.y + 0.48, z: blkTower.z },
                e.def.color,
                0.06,
                0.14
              );
              this.vfx.spawnBurst(
                (e.x + blkTower.x) * 0.5,
                0.55,
                (e.z + blkTower.z) * 0.5,
                e.def.color,
                5,
                2.0
              );
              this._damageTower(blkTower, e.def.towerAtk * mult, e);
            }
          }
          updateEnemyAnimation(e, this.simTime, dt);
          continue;
        }
      }

      // G. 洪泛团抵达被隔离节点旁可通行侧时：重击节点上的网闸/防火墙或应急隔离器！
      if (e.type === 'flood' && e.huntTarget) {
        const nk = keyOf(e.huntTarget.nodeX, e.huntTarget.nodeZ);
        const ns = this.nodeStates.get(nk);
        if (!ns || !ns.isolated) {
          e.huntTarget = null;
          this._refreshEnemyNextHop(e, false);
        } else {
          const standWp = gridToWorld(this.map, e.huntTarget.standX, e.huntTarget.standZ);
          const distToStand = Math.hypot(standWp.x - e.x, standWp.z - e.z);
          if (distToStand <= 0.35) {
            const nodeWp = gridToWorld(this.map, e.huntTarget.nodeX, e.huntTarget.nodeZ);
            e.heading = Math.atan2(nodeWp.x - e.x, nodeWp.z - e.z);
            e.atkTimer -= dt;
            if (e.atkTimer <= 0) {
              e.atkTimer = e.def.atkInterval || 1.25;
              e.attackAnim = 1.0;
              sound.play('enemy_slam');
              const strikeDmg = e.def.towerAtk * (e.def.nodeStrikeMult || 1.85);
              this.vfx.spawnBeam(
                { x: e.x, y: 0.52, z: e.z },
                { x: nodeWp.x, y: 0.45, z: nodeWp.z },
                0xff6d00,
                0.09,
                0.18
              );
              this.vfx.spawnRing(nodeWp.x, 0.25, nodeWp.z, 1.25 * TILE_SIZE, 0xff6d00, 0.32);

              if (ns.source === 'tower') {
                const nt = this.towers.find((t) => !t.dead && t.id === ns.towerId);
                if (nt) this._damageTower(nt, strikeDmg, e, '洪泛团破闸冲击');
              } else if (ns.source === 'isolator') {
                const iso = this.isolators.find((x) => !x.dead && x.id === ns.isolatorId);
                if (iso) {
                  iso.hp -= strikeDmg;
                  this.pushFloatText(iso.x, 1.1, iso.z, `-${Math.round(strikeDmg)}`, '#ff6d00');
                }
              }
            }
            updateEnemyAnimation(e, this.simTime, dt);
            continue;
          }
        }
      }

      // H. 连续空间移动（地面沿动态寻路网格平滑前进；飞行沿无线层直飞中枢）
      if (e.snareTimer <= 0) {
        const effSpeed = e.speed * terrainSpeedMult * (1 - (e.slowPct || 0)) * TILE_SIZE;

        if (e.flying) {
          const ex = e.airExit || this.map.exits[0];
          const goalW = gridToWorld(this.map, ex.x, ex.z);
          const dx = goalW.x - e.x;
          const dz = goalW.z - e.z;
          const d = Math.hypot(dx, dz);
          if (d <= 0.38) {
            this._enemyReachExit(e, ex);
            continue;
          }
          e.heading = Math.atan2(dx, dz);
          e.x += (dx / d) * effSpeed * dt;
          e.z += (dz / d) * effSpeed * dt;
        } else {
          // 检查是否已抵达任意出口中枢
          if (curTile === TILE.EXIT) {
            const exObj = this.map.exits.find((x) => x.x === gx && x.z === gz) || this.map.exits[0];
            const exW = gridToWorld(this.map, exObj.x, exObj.z);
            if (Math.hypot(exW.x - e.x, exW.z - e.z) <= 0.42) {
              this._enemyReachExit(e, exObj);
              continue;
            }
          }

          let targetCell = null;
          if (e.type === 'flood' && e.huntTarget && e.huntTarget.path.length > 0) {
            // 沿破点路径走下一跳（若脱离原缓存路径则立即重寻安全道路，严禁斜穿转角！）
            let idxInPath = e.huntTarget.path.findIndex((p) => p.x === gx && p.z === gz);
            if (idxInPath === -1) {
              e.huntTarget = findNearestIsolatedNodeApproach(
                this.map,
                gx,
                gz,
                isolatedNodeKeys,
                this.blockedSet,
                e.def.nodeSenseDist || 6
              );
              idxInPath = e.huntTarget ? e.huntTarget.path.findIndex((p) => p.x === gx && p.z === gz) : -1;
            }
            if (e.huntTarget) {
              if (idxInPath >= 0 && idxInPath + 1 < e.huntTarget.path.length) {
                targetCell = e.huntTarget.path[idxInPath + 1];
              } else {
                targetCell = { x: e.huntTarget.standX, z: e.huntTarget.standZ };
              }
            }
          }
          if (!targetCell) {
            if (!e.goalCell || (e.goalCell.x === gx && e.goalCell.z === gz)) {
              const nh = this.distanceField?.next[gz]?.[gx];
              if (nh) e.goalCell = { x: nh.x, z: nh.z };
            }
            targetCell = e.goalCell;
          }

          if (targetCell) {
            const goalW = gridToWorld(this.map, targetCell.x, targetCell.z);
            // 转弯车道归中约束：保证地面单位严格沿道路网格行进，绝不擦碰障碍物内角（3.2.2）
            if (targetCell.x === gx && targetCell.z !== gz) {
              e.x += (goalW.x - e.x) * Math.min(1, dt * 7.5);
            } else if (targetCell.z === gz && targetCell.x !== gx) {
              e.z += (goalW.z - e.z) * Math.min(1, dt * 7.5);
            }
            const dx = goalW.x - e.x;
            const dz = goalW.z - e.z;
            const d = Math.hypot(dx, dz);
            if (d > 0.02) {
              e.heading = Math.atan2(dx, dz);
              const stepLen = Math.min(d, effSpeed * dt);
              e.x += (dx / d) * stepLen;
              e.z += (dz / d) * stepLen;
            }
            if (d <= 0.18) {
              // 抵达目标格中心，取下一跳
              const nh = this.distanceField?.next[targetCell.z]?.[targetCell.x];
              if (nh) e.goalCell = { x: nh.x, z: nh.z };
            }
          }
        }
      }

      e.model.root.position.set(e.x, 0.14, e.z);
      updateEnemyAnimation(e, this.simTime, dt);
    }
  }

  _enemyReachExit(enemy, exitObj) {
    enemy.dead = true;
    if (enemy.blockedByTowerId) {
      const bt = this.towers.find((t) => t.id === enemy.blockedByTowerId);
      if (bt) bt.blockedIds.delete(enemy.id);
    }
    this.unitLayer.remove(enemy.model.root);
    const dmg = enemy.def.coreDamage || 1;
    this.integrity = Math.max(0, this.integrity - dmg);
    this.stats.leakedCount++;

    const ev = this.sceneBundle.exitVisuals[exitObj.id];
    if (ev) ev.hitFlash = 1.0;

    const wp = gridToWorld(this.map, exitObj.x, exitObj.z);
    sound.play('core_leak');
    this.vfx.spawnRing(wp.x, 0.3, wp.z, 2.2 * TILE_SIZE, 0xff1744, 0.55);
    this.pushFloatText(wp.x, 2.1, wp.z, `中枢受损 -${dmg}`, '#ff1744', true);
    this.addLog('CRITICAL', `恶意程序「${enemy.def.name}」侵入「${exitObj.name}」，中枢完整度 -${dmg}！`);
  }

  // ==========================================================================
  // 三位首领阶段机与预警地形技能（2.5 & 2.7.4）
  // ==========================================================================
  _updateBossLogic(boss, dt, isolatedNodeKeys) {
    const hpRatio = boss.hp / boss.maxHp;

    if (boss.type === 'wankuai') {
      // 万傀：阶段二 (<55% HP) 释放成群蠕虫
      if (boss.bossPhase === 1 && hpRatio <= 0.55) {
        boss.bossPhase = 2;
        boss.shield = 550;
        boss.auxTimer = 1.0;
        sound.play('boss_warn');
        this.vfx.spawnRing(boss.x, 0.3, boss.z, 3.2 * TILE_SIZE, 0xff1744, 0.65);
        this.pushFloatText(boss.x, 1.9, boss.z, '万傀：傀儡裂变阶段!', '#ff1744', true);
        this.addLog('CRITICAL', '【阶段变化】万傀进入「傀儡裂变」阶段，开始持续释放次生蠕虫群！');
      }

      if (boss.bossPhase === 2) {
        boss.auxTimer -= dt;
        if (boss.auxTimer <= 0) {
          boss.auxTimer = 7.2;
          for (let k = 0; k < 3; k++) {
            const ang = (k * Math.PI * 2) / 3;
            this.spawnEnemy(
              'worm',
              boss.entryId,
              { x: boss.x + Math.cos(ang) * 0.55, y: 0.14, z: boss.z + Math.sin(ang) * 0.55 },
              { isClone: true, replicated: true }
            );
          }
          this.vfx.spawnRing(boss.x, 0.25, boss.z, 1.6 * TILE_SIZE, 0xff5252, 0.42);
        }
      }

      // 洪峰冲击：预警后重创被隔离节点上的塔并冲毁应急隔离器！
      boss.bossSkillTimer -= dt;
      if (boss.bossSkillTimer <= 0 && isolatedNodeKeys.size > 0) {
        boss.bossSkillTimer = 9.5;
        const targetKey = Array.from(isolatedNodeKeys)[0];
        const [nx, nz] = targetKey.split(',').map(Number);
        const ns = this.nodeStates.get(targetKey);
        sound.play('boss_warn');
        this.addLog('ALERT', `【首领预警】万傀正在蓄力「洪峰」，即将冲击「${ns?.nodeInfo?.name || targetKey}」！`);
        this.hazards.push({
          id: this.nextId++,
          kind: 'flood_strike',
          state: 'warning',
          blocksGround: false,
          bossId: boss.id,
          cells: [{ x: nx, z: nz }],
          timer: 2.4
        });
      }
    } else if (boss.type === 'shenlou') {
      // 蜃楼：阶段二 (<55% HP) 发动路由风暴削弱附近塔护盾
      if (boss.bossPhase === 1 && hpRatio <= 0.55) {
        boss.bossPhase = 2;
        boss.auxTimer = 0.6;
        sound.play('boss_warn');
        this.vfx.spawnRing(boss.x, 0.5, boss.z, 3.5 * TILE_SIZE, 0xff9100, 0.65);
        this.pushFloatText(boss.x, 2.0, boss.z, '蜃楼：路由风暴阶段!', '#ff9100', true);
        this.addLog('CRITICAL', '【阶段变化】蜃楼展开风暴翼，周期性释放「路由风暴」击碎周边设备护盾！');
      }

      if (boss.bossPhase === 2) {
        boss.auxTimer -= dt;
        if (boss.auxTimer <= 0) {
          boss.auxTimer = 6.5;
          const sRad = 4.0 * TILE_SIZE;
          this.vfx.spawnRing(boss.x, 0.4, boss.z, sRad, 0xff9100, 0.55);
          for (const tw of this.towers) {
            if (tw.dead) continue;
            if (Math.hypot(tw.x - boss.x, tw.z - boss.z) <= sRad) {
              if (tw.shield > 0) {
                tw.shield = Math.round(tw.shield * 0.2);
                this.pushFloatText(tw.x, tw.y + 1.3, tw.z, '风暴碎盾!', '#ff9100');
              }
              this._damageTower(tw, 68, boss, '路由风暴');
            }
          }
        }
      }

      // 伪路由黑洞：在前方找一格截断后不会封死任何入口/敌人的链路预警生成黑洞！
      boss.bossSkillTimer -= dt;
      if (boss.bossSkillTimer <= 0) {
        boss.bossSkillTimer = 11.5;
        const cell = this._pickSafeBossBlockCells(boss, 1);
        if (cell) {
          sound.play('boss_warn');
          this.addLog('ALERT', `【首领预警】蜃楼即将在坐标 (${cell[0].x}, ${cell[0].z}) 生成「伪路由黑洞」截断通行！`);
          this.hazards.push({
            id: this.nextId++,
            kind: 'blackhole',
            state: 'warning',
            blocksGround: true,
            cells: cell,
            timer: 2.4,
            activeDuration: 8.5
          });
        }
      }
    } else if (boss.type === 'zheying') {
      // 蛰影：潜伏 (100%-70%) -> 提权 (70%-38%) -> 破坏 (<38%)
      if (boss.bossPhase === 1 && hpRatio <= 0.70) {
        boss.bossPhase = 2;
        boss.disguised = false;
        boss.shield = 680;
        sound.play('boss_warn');
        this.vfx.spawnRing(boss.x, 0.4, boss.z, 3.2 * TILE_SIZE, 0xffca28, 0.6);
        this.pushFloatText(boss.x, 2.1, boss.z, '蛰影：提权阶段 (+重甲/木马)!', '#ffd54f', true);
        this.addLog('CRITICAL', '【阶段变化】蛰影完成「提权」，展开重甲护盾并释放伪装木马近卫！');
        for (const off of [-0.55, 0.55]) {
          this.spawnEnemy('trojan', boss.entryId, { x: boss.x + off, y: 0.14, z: boss.z });
        }
      } else if (boss.bossPhase <= 2 && hpRatio <= 0.38) {
        this.triggerZheyingDestructivePhase(boss);
      }
    }
  }

  // 供正常流程或实战演示 3 触发蛰影进入破坏阶段并预警锁死前方运维环路段
  triggerZheyingDestructivePhase(boss, preferredCells = null) {
    if (boss.bossPhase === 3 && !preferredCells) return;
    boss.bossPhase = 3;
    boss.disguised = false;
    boss.speed = Math.max(boss.speed, 0.62);
    sound.play('boss_warn');
    this.vfx.spawnRing(boss.x, 0.4, boss.z, 3.8 * TILE_SIZE, 0xff1744, 0.65);
    this.pushFloatText(boss.x, 2.2, boss.z, '蛰影：破坏阶段 · 锁死运维环!', '#ff1744', true);

    let cells = preferredCells;
    if (!cells) {
      cells = this._pickSafeBossBlockCells(boss, 2) || this._pickSafeBossBlockCells(boss, 1);
    } else {
      // 仍然执行连通性安全校验（2.7.4）
      const cand = new Set(this.blockedSet);
      for (const c of cells) cand.add(keyOf(c.x, c.z));
      if (!validateConnectivity(this.map, cand, this.downgradedSet, this.enemies).ok) {
        cells = this._pickSafeBossBlockCells(boss, 1);
      }
    }

    if (cells && cells.length > 0) {
      this.addLog('CRITICAL', '【高危预警】蛰影进入「破坏」阶段，即将锁死前方运维环路段并释放加密冲击！');
      this.hazards.push({
        id: this.nextId++,
        kind: 'lockdown',
        state: 'warning',
        blocksGround: true,
        bossId: boss.id,
        cells,
        timer: 2.2,
        activeDuration: 12.0
      });
    }
  }

  // 自动在首领前方路径挑选不会封死任何入口或地面敌人的安全封锁格（2.7.4）
  _pickSafeBossBlockCells(boss, count = 1) {
    const { gx, gz } = worldToGrid(this.map, boss.x, boss.z);
    const route = [];
    let cx = gx;
    let cz = gz;
    for (let step = 0; step < 8; step++) {
      const nh = this.distanceField?.next[cz]?.[cx];
      if (!nh) break;
      cx = nh.x;
      cz = nh.z;
      const t = this.map.grid[cz][cx];
      const hasTower = this.towers.some((tw) => !tw.dead && tw.gx === cx && tw.gz === cz);
      if (t === TILE.LINK && !hasTower) {
        route.push({ x: cx, z: cz });
      }
    }

    // 从前方第 2 格起尝试选取不会封死道路的位置
    for (let i = 1; i < route.length; i++) {
      const slice = route.slice(i, i + count);
      if (slice.length === 0) continue;
      const cand = new Set(this.blockedSet);
      for (const c of slice) cand.add(keyOf(c.x, c.z));
      const check = validateConnectivity(this.map, cand, this.downgradedSet, this.enemies);
      if (check.ok) return slice;
    }

    // 备选：全图扫描任意不会封死且能改变至少一条入口路线的空闲标准链路
    for (let z = 1; z < this.map.rows - 1; z++) {
      for (let x = 1; x < this.map.cols - 1; x++) {
        if (this.map.grid[z][x] !== TILE.LINK) continue;
        if (this.towers.some((tw) => !tw.dead && tw.gx === x && tw.gz === z)) continue;
        const cand = new Set(this.blockedSet);
        cand.add(keyOf(x, z));
        const check = validateConnectivity(this.map, cand, this.downgradedSet, this.enemies);
        if (!check.ok) continue;
        const changesRoute = this.map.entries.some((ent) =>
          routesDiffer(this.entryRoutes[ent.id], check.previewRoutes[ent.id])
        );
        if (changesRoute) return [{ x, z }];
      }
    }

    return null;
  }

  _updateHazards(dt) {
    let routeChangedReason = null;

    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.timer -= dt;

      if (h.state === 'warning' && h.timer <= 0) {
        if (h.kind === 'flood_strike') {
          // 万傀「洪峰」落地结算！
          const cell = h.cells[0];
          const wp = gridToWorld(this.map, cell.x, cell.z);
          const boss = this.enemies.find((e) => !e.dead && e.id === h.bossId);
          if (boss) {
            this.vfx.spawnBeam(
              { x: boss.x, y: 1.35, z: boss.z },
              { x: wp.x, y: 0.45, z: wp.z },
              0xff1744,
              0.22,
              0.38
            );
          }
          sound.play('enemy_slam');
          this.vfx.spawnRing(wp.x, 0.25, wp.z, 2.2 * TILE_SIZE, 0xff1744, 0.55);
          this.vfx.spawnBurst(wp.x, 0.7, wp.z, 0xff1744, 16, 4.0);

          const ns = this.nodeStates.get(keyOf(cell.x, cell.z));
          if (ns && ns.isolated) {
            if (ns.source === 'isolator') {
              const iso = this.isolators.find((x) => !x.dead && x.id === ns.isolatorId);
              if (iso) iso.hp = 0; // 直接冲毁隔离器！
            } else if (ns.source === 'tower') {
              const nt = this.towers.find((t) => !t.dead && t.id === ns.towerId);
              if (nt) this._damageTower(nt, 520, boss, '万傀洪峰');
            }
          }
          this.hazards.splice(i, 1);
        } else {
          // 蜃楼黑洞 或 蛰影锁死 正式生效（二次确认不会封死！）
          const cand = new Set(this.blockedSet);
          for (const c of h.cells) cand.add(keyOf(c.x, c.z));
          const check = validateConnectivity(this.map, cand, this.downgradedSet, this.enemies);
          if (!check.ok) {
            this.hazards.splice(i, 1);
            continue;
          }
          h.state = 'active';
          h.timer = h.activeDuration || 9.0;
          sound.play('isolate_lock');
          for (const c of h.cells) {
            const wp = gridToWorld(this.map, c.x, c.z);
            this.vfx.spawnRing(wp.x, 0.25, wp.z, 1.6 * TILE_SIZE, h.kind === 'blackhole' ? 0xd500f9 : 0xff1744, 0.5);
          }
          // 蛰影锁死生效同时对周边守方设备释放一次高压加密冲击
          if (h.kind === 'lockdown') {
            const c0 = gridToWorld(this.map, h.cells[0].x, h.cells[0].z);
            this.vfx.spawnRing(c0.x, 0.35, c0.z, 7.15 * TILE_SIZE, 0xe040fb, 0.65);
            for (const tw of this.towers) {
              if (!tw.dead && !tw.def.immuneEncrypt && Math.hypot(tw.x - c0.x, tw.z - c0.z) <= 7.15 * TILE_SIZE) {
                tw.encryptTimer = Math.max(tw.encryptTimer, 8.5);
                this.pushFloatText(tw.x, tw.y + 1.4, tw.z, '🔒 破坏脉冲加密!', '#ea80fc');
              }
            }
            sound.play('encrypt_lock');
          }
          routeChangedReason = h.kind === 'blackhole' ? '伪路由黑洞' : '运维环锁死';
        }
      } else if (h.state === 'active' && h.timer <= 0) {
        this.hazards.splice(i, 1);
        routeChangedReason = '异常封锁消退';
      }
    }

    if (routeChangedReason) {
      this.recomputeRoutes(routeChangedReason);
    }
  }
}
