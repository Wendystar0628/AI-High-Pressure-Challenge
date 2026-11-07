/* 动态路由塔防 · 确定性游戏核心
 * 固定步长模拟；所有视觉元素由 state 派生；随机可复现。
 * 不依赖 DOM / WebGL，可在 node 中单独验证。 */
(function () {
  'use strict';
  var TD = window.TD = window.TD || {};
  var Data = TD.Data, Path = TD.Path, Maps = TD.Maps;
  var DT = Data.DT, K = Data.COLORS;

  var ISOLATE_INTEL = 12;          // 隔离节点的情报消耗
  var REISO_SEC = 8;               // 节点恢复直通后的再次隔离间隔
  var SELL_REFUND = 0.55;
  var CORE_MAX = 160;
  // 全局平衡：让防线在合理布防下可撑过全部波次，同时保留敌人威胁
  var BAL = { core: 0.32, enemy: 0.68, tower: 1.55, hpScale: 0.035 };

  function rnd(s) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
  function nid(s) { return s.nextId++; }
  function col(hex) { return TD.col.hex(hex); }
  function log(s, text, kind) {
    var ev = { type: 'log', text: text, kind: kind || 'info', tick: s.tick };
    s.events.push(ev); s.logs.push(ev); if (s.logs.length > 80) s.logs.shift();
  }
  function addFx(s, o) { o.id = nid(s); o.born = s.tick; if (o.ttl === undefined) o.ttl = 0.6; o.maxTtl = o.ttl; s.fx.push(o); return o; }
  function wpos(map, x, z) { return { x: Maps.wx(map, x), z: Maps.wz(map, z) }; }
  function cellKey(c) { return c.x + ',' + c.z; }
  function dist2(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

  // ---------- 构建初始状态 ----------
  function create(mapId, opts) {
    opts = opts || {};
    var map = Maps.byId(mapId);
    var waves = Data.waves(mapId);
    var wp = (opts.wavePlan !== undefined) ? opts.wavePlan : Data.buildWavePlan(waves, map.entries, DT).plan;
    var s = {
      mapId: mapId, map: map, tick: 0, time: 0, rng: (opts.seed || 12345) >>> 0, seed: opts.seed || 12345,
      phase: 'battle', speed: 1, paused: false,
      compute: opts.compute !== undefined ? opts.compute : 380,
      intel: opts.intel !== undefined ? opts.intel : 60,
      core: CORE_MAX, coreMax: CORE_MAX, wave: 1, totalWaves: waves.length,
      isolated: {}, reIsoUntil: {}, blocks: {}, downgraded: {}, itemCd: {},
      towers: [], enemies: [], fx: [], warnings: [],
      field: null, access: null, routes: null, routeVersion: 1,
      wavePlan: wp, planIdx: 0, endTick: opts.endTick !== undefined ? opts.endTick : Data.buildWavePlan(waves, map.entries, DT).endTick,
      waveEndSeen: {},
      stats: { kills: 0, leaks: 0, built: 0, sold: 0, isoCount: 0, dmgDealt: 0, dmgTaken: 0, intelEarned: 0, computeEarned: 0, bossDown: 0 },
      events: [], logs: [], pendingBlocks: [], nextId: 1, demo: opts.demo || null, bossRef: null,
      lastRouteChange: -999, routeChangedEntries: []
    };
    recompute(s, 'init');
    if (opts.setup) opts.setup(s, G);
    return s;
  }

  // ---------- 距离场 / 路线 ----------
  function groundCells(s) {
    var a = [];
    for (var i = 0; i < s.enemies.length; i++) { var e = s.enemies[i]; if (!e.flying && !e.dying) a.push(e.cell); }
    return a;
  }
  function recompute(s, reason) {
    var access = Path.makeAccess(s.map, s);
    var field = Path.rebuild(s.map, access);
    var bad = Path.connectivity(s.map, field, access, groundCells(s));
    if (bad.length) { s.events.push({ type: 'rejected', bad: bad, reason: reason }); return false; }
    var oldR = s.routes;
    s.access = access; s.field = field;
    s.routes = Path.routes(s.map, field, access);
    s.routeVersion++;
    // 若敌人正在前往的格变为不可通行，先退回当前格再重新寻路（不穿过不可通行位置、不瞬移）
    for (var ei = 0; ei < s.enemies.length; ei++) {
      var e = s.enemies[ei];
      if (e.flying || e.dying) continue;
      if (!access.passable(e.next.x, e.next.z)) e.returning = true;
    }
    s.lastRouteChange = s.tick;
    var changed = [];
    if (oldR) for (var i = 0; i < s.map.entries.length; i++) {
      var id = s.map.entries[i].id;
      if (Path.pathKey(oldR[id]) !== Path.pathKey(s.routes[id])) changed.push(id);
    }
    s.routeChangedEntries = changed;
    s.events.push({ type: 'routeChange', reason: reason, entries: changed });
    addFx(s, { kind: 'routepulse', ttl: 1.1, color: col(K.intel) });
    return true;
  }

  // ---------- 节点隔离 ----------
  function isolatePreview(s, nodeId) {
    if (s.reIsoUntil[nodeId] && s.reIsoUntil[nodeId] > s.tick)
      return { ok: false, reason: 'cooldown', until: s.reIsoUntil[nodeId] };
    if (s.isolated[nodeId] && s.isolated[nodeId].active) return { ok: false, reason: 'already' };
    var pv = Path.previewIsolate(s.map, s, nodeId);
    return { ok: pv.ok, bad: pv.bad, routes: pv.routes, changed: pv.changed, reason: pv.ok ? '' : 'blocked' };
  }
  function isolateNode(s, nodeId, by, extra) {
    extra = extra || {};
    s.isolated[nodeId] = Object.assign({ active: true, by: by, tick: s.tick }, extra);
    s.stats.isoCount++;
    var n = s.map.nodes.filter(function (x) { return x.id === nodeId; })[0];
    if (n) {
      var w = wpos(s.map, n.x, n.z);
      addFx(s, { kind: 'isolate', x: w.x, z: w.z, ttl: 1.2, color: col(K.warn) });
    }
    log(s, '节点隔离生效：' + (n ? n.name : nodeId) + '，各入口路线重新收敛', 'alert');
    s.events.push({ type: 'isolate', nodeId: nodeId });
    return recompute(s, 'isolate');
  }
  function bypassNode(s, nodeId, why) {
    var iso = s.isolated[nodeId];
    if (!iso || !iso.active) return false;
    delete s.isolated[nodeId];
    s.reIsoUntil[nodeId] = s.tick + Math.round(REISO_SEC / DT);
    var n = s.map.nodes.filter(function (x) { return x.id === nodeId; })[0];
    if (n) { var w = wpos(s.map, n.x, n.z); addFx(s, { kind: 'bypass', x: w.x, z: w.z, ttl: 1.2, color: col(K.ally2) }); }
    log(s, '设备旁路直通：' + (n ? n.name : nodeId) + ' 恢复通行 ' + (why || ''), 'alert');
    s.events.push({ type: 'bypass', nodeId: nodeId });
    return recompute(s, 'bypass');
  }

  // ---------- 塔 ----------
  function tileAt(s, x, z) { if (x < 0 || z < 0 || x >= s.map.W || z >= s.map.H) return null; return s.map.grid[z][x]; }
  function towerAt(s, x, z) { for (var i = 0; i < s.towers.length; i++) { var t = s.towers[i]; if (!t.dying && t.x === x && t.z === z) return t; } return null; }
  function canPlace(s, type, x, z) {
    var def = Data.TOWERS[type]; if (!def) return { ok: false, reason: '未知设备' };
    var tile = tileAt(s, x, z); if (!tile) return { ok: false, reason: '超出边界' };
    var t = tile.t;
    var okTile = def.place.indexOf(t) >= 0 || (t === 'N' && (type === 'firewall' || type === 'gateway'));
    if (!okTile) return { ok: false, reason: '该地块不可部署此类设备' };
    if (towerAt(s, x, z)) return { ok: false, reason: '该位置已有设备' };
    if (t === 'N') {
      var nodeId = s.map.nodeAt[cellKey({ x: x, z: z })];
      if (s.isolated[nodeId] && s.isolated[nodeId].active) return { ok: false, reason: '节点已被隔离' };
      if (s.reIsoUntil[nodeId] && s.reIsoUntil[nodeId] > s.tick) return { ok: false, reason: '节点处于再次隔离间隔' };
      var pv = isolatePreview(s, nodeId); if (!pv.ok) return { ok: false, reason: pv.reason === 'blocked' ? '隔离将封死通路' : '暂不可隔离' };
      if (s.intel < ISOLATE_INTEL) return { ok: false, reason: '情报不足' };
    }
    if (s.compute < def.cost) return { ok: false, reason: '算力不足' };
    return { ok: true, nodeId: t === 'N' ? s.map.nodeAt[cellKey({ x: x, z: z })] : null };
  }
  function recalcTower(t) {
    var d = t.def, lv = t.lvl - 1, br = (t.branch && d.branches) ? d.branches[t.branch] : null;
    function pick(arr, key) { return br && br[key] !== undefined ? br[key] : (arr ? arr[Math.min(lv, arr.length - 1)] : 0); }
    t.maxHp = br && br.hp ? br.hp : d.hp[Math.min(lv, 1)];
    t.hp = Math.min(t.hp === undefined ? t.maxHp : t.hp, t.maxHp);
    if (t.hp === undefined) t.hp = t.maxHp;
    t.dmgNow = pick(d.dmg, 'dmg'); t.rangeNow = pick(d.range, 'range'); t.rateNow = pick(d.rate, 'rate');
    t.capNow = d.cap ? d.cap[Math.min(lv, 1)] : 0;
    t.pierce = br && br.pierce ? br.pierce : 0;
    t.slowPower = br && br.slow ? br.slow : 0;
    t.tauntRange = br && br.tauntRange ? br.tauntRange : (d.taunt ? 2.2 : 0);
    t.trapDur = br && br.trapDur ? br.trapDur : 3.2;
  }
  function build(s, type, x, z, facing) {
    var c = canPlace(s, type, x, z); if (!c.ok) return c;
    var def = Data.TOWERS[type];
    var t = {
      id: nid(s), type: type, def: def, x: x, z: z, nodeId: c.nodeId || null,
      lvl: 1, branch: null, facing: facing || 0,
      cd: 0, skillCd: 0, skillUntil: 0, blocking: [], targetId: null,
      shield: 0, encryptedUntil: 0, hitFlash: 0, dying: 0, hp: undefined
    };
    recalcTower(t); t.hp = t.maxHp;
    s.towers.push(t);
    s.compute -= def.cost; s.stats.built++;
    var w = wpos(s.map, x, z);
    addFx(s, { kind: 'build', x: w.x, z: w.z, ttl: 0.8, color: col(def.color) });
    s.events.push({ type: 'build', towerId: t.id });
    if (c.nodeId) { s.intel -= ISOLATE_INTEL; isolateNode(s, c.nodeId, 'tower', { towerId: t.id }); }
    return { ok: true, tower: t };
  }
  function upgrade(s, towerId, branch) {
    var t = findTower(s, towerId); if (!t || t.dying || t.lvl >= 2) return { ok: false, reason: '不可升级' };
    var d = t.def, cost = d.lvl2cost;
    if (s.compute < cost) return { ok: false, reason: '算力不足' };
    var needIntel = d.branchIntel > 0;
    if (needIntel && !branch) return { ok: false, reason: '需选择升级分支' };
    if (needIntel && s.intel < d.branchIntel) return { ok: false, reason: '情报不足' };
    s.compute -= cost; if (needIntel) s.intel -= d.branchIntel;
    t.lvl = 2; t.branch = branch || null;
    var oldMax = t.maxHp; recalcTower(t); t.hp += (t.maxHp - oldMax);
    var w = wpos(s.map, t.x, t.z);
    addFx(s, { kind: 'upgrade', x: w.x, z: w.z, ttl: 1.0, color: col(d.color) });
    log(s, d.name + ' 升级至 2 级' + (branch ? '（' + d.branches[branch].name + '）' : ''), 'good');
    s.events.push({ type: 'upgrade', towerId: t.id });
    return { ok: true };
  }
  function sell(s, towerId) {
    var t = findTower(s, towerId); if (!t || t.dying) return { ok: false, reason: '不可撤下' };
    var refund = Math.floor((t.def.cost + (t.lvl === 2 ? t.def.lvl2cost : 0)) * SELL_REFUND);
    s.compute += refund; s.stats.sold++;
    removeTower(s, t, true);
    return { ok: true, refund: refund };
  }
  function removeTower(s, t, silent) {
    t.dying = 0.001;
    for (var i = 0; i < s.enemies.length; i++) { var e = s.enemies[i]; if (e.blockedBy === t.id) e.blockedBy = null; }
    if (t.nodeId && s.isolated[t.nodeId] && s.isolated[t.nodeId].towerId === t.id) bypassNode(s, t.nodeId, '（设备撤下/摧毁）');
    var w = wpos(s.map, t.x, t.z);
    addFx(s, { kind: 'towerdown', x: w.x, z: w.z, ttl: 1.0, color: col(K.enemy) });
    if (!silent) { log(s, t.def.name + ' 已被摧毁', 'alert'); s.events.push({ type: 'towerdown', towerId: t.id }); }
  }
  function findTower(s, id) { for (var i = 0; i < s.towers.length; i++) if (s.towers[i].id === id && !s.towers[i].dying) return s.towers[i]; return null; }

  function skill(s, towerId) {
    var t = findTower(s, towerId); if (!t || t.dying) return { ok: false, reason: '无效目标' };
    if (t.skillCd > s.tick) return { ok: false, reason: '技能冷却中' };
    if (t.encryptedUntil > s.tick && !t.def.immuneEncrypt) return { ok: false, reason: '设备已被加密' };
    var d = t.def, w = wpos(s.map, t.x, t.z);
    t.skillCd = s.tick + Math.round(d.skill.cd / DT);
    t.skillUntil = s.tick + Math.round((d.skill.dur || 3) / DT);
    if (t.type === 'honeypot') {
      for (var i = 0; i < s.enemies.length; i++) { var e = s.enemies[i]; if (!e.flying && !e.dying && dist2(e.cell.x, e.cell.z, t.x, t.z) <= t.tauntRange * t.tauntRange) e.trappedUntil = s.tick + Math.round(t.trapDur / DT); }
      addFx(s, { kind: 'ring', x: w.x, z: w.z, ttl: 0.9, color: col(d.color), r: t.tauntRange * s.map.CELL });
    } else if (t.type === 'repair') {
      var r = t.rangeNow;
      for (var j = 0; j < s.towers.length; j++) { var o = s.towers[j]; if (o.dying || o.id === t.id) continue; if (dist2(o.x, o.z, t.x, t.z) <= r * r) { o.shield += 90; o.encryptedUntil = 0; } }
      addFx(s, { kind: 'ring', x: w.x, z: w.z, ttl: 1.0, color: col(K.heal), r: r * s.map.CELL });
    } else if (t.type === 'sandbox') {
      for (var k = 0; k < s.enemies.length; k++) { var en = s.enemies[k]; if (!en.dying && dist2(en.cell.x, en.cell.z, t.x, t.z) <= (t.rangeNow + 1.5) * (t.rangeNow + 1.5)) { if (en.disguised || en.latent) en.revealed = true; if (!en.flying) damageEnemy(s, en, t.dmgNow * 1.8, t, 'aoe'); } }
      addFx(s, { kind: 'scan', x: w.x, z: w.z, ttl: 1.1, color: col(d.color), r: (t.rangeNow + 1.5) * s.map.CELL });
    } else if (t.type === 'firewall') { t.capBonusUntil = t.skillUntil; }
    else if (t.type === 'gateway') { t.dmgReduceUntil = t.skillUntil; }
    else if (t.type === 'interceptor') { t.calibUntil = t.skillUntil; }
    log(s, d.name + ' 释放技能「' + d.skill.name + '」', 'good');
    addFx(s, { kind: 'skill', x: w.x, z: w.z, ttl: 0.8, color: col(d.color) });
    s.events.push({ type: 'skill', towerId: t.id });
    return { ok: true };
  }

  // ---------- 敌人 ----------
  function pickExit(s, e) {
    var best = s.map.exits[0], bd = 1e9;
    for (var i = 0; i < s.map.exits.length; i++) { var ex = s.map.exits[i], d = dist2(e.x, e.z, ex.x, ex.z); if (d < bd) { bd = d; best = ex; } }
    return best;
  }
  function spawn(s, item) {
    var entry = null;
    for (var i = 0; i < s.map.entries.length; i++) if (s.map.entries[i].id === item.entry) entry = s.map.entries[i];
    if (!entry) entry = s.map.entries[0];
    var boss = !!item.boss;
    var def = boss ? Data.bossOf(s.mapId) : Data.ENEMIES[item.type];
    if (!def) return;
    var scale = 1 + (item.wave - 1) * BAL.hpScale;
    var hp = Math.round((def.hp || 60) * (boss ? 1 : scale));
    var e = {
      id: nid(s), type: boss ? 'boss' : item.type, def: def, boss: boss, entryId: entry.id,
      hp: hp, maxHp: hp, shield: 0, coreDmg: def.coreDmg || 4,
      rewardC: def.rewardC || 8, rewardI: def.rewardI || 2,
      speed: def.speed || 1.2, dmg: def.dmg || 8, blockCost: def.block || 1,
      flying: !!def.flying, disguised: !!def.disguise, latent: boss && def.id === 'zheying',
      revealed: !(def.disguise) && !(boss && def.id === 'zheying'),
      melee: !!def.melee, ranged: !!def.ranged, siege: !!def.siege, copiesAtNode: !!def.copiesAtNode,
      isCopy: false, encrypt: !!def.encrypt, payload: def.payload || 0,
      cell: { x: entry.x, z: entry.z }, next: { x: entry.x, z: entry.z }, f: 0, path: [], rv: s.routeVersion,
      blockedBy: null, ignoreBlock: {}, attackCd: 0, trappedUntil: 0, slowedUntil: 0, slowFactor: 1,
      hitFlash: 0, dying: 0, dir: 0, ft: 0, ex: null,
      phaseIdx: 0, skillCd: s.tick + Math.round(5 / DT), armored: false, spawnTick: s.tick
    };
    if (e.flying) { e.ex = pickExit(s, entry); }
    else { var r = Path.trace(s.map, s.field, s.access, entry.x, entry.z); e.path = r ? r.path : [{ x: entry.x, z: entry.z }]; e.next = e.path[1] || e.path[0]; }
    s.enemies.push(e);
    s.events.push({ type: 'spawn', enemyId: e.id, boss: boss });
    var w = wpos(s.map, entry.x, entry.z);
    addFx(s, { kind: 'spawn', x: w.x, z: w.z, ttl: 0.7, color: col(def.color), boss: boss });
    if (boss) {
      s.bossRef = e.id;
      log(s, '【高危核心威胁】' + def.name + ' 已出现，改变地形前将先预警', 'alert');
      addFx(s, { kind: 'bossarrive', x: w.x, z: w.z, ttl: 2.0, color: col(def.color) });
    }
  }
  function repath(s, e) {
    var r = Path.trace(s.map, s.field, s.access, e.cell.x, e.cell.z);
    if (r) { e.path = r.path; e.next = e.path[1] || e.path[0]; e.rv = s.routeVersion; }
    else { e.next = e.cell; e.rv = s.routeVersion; }
  }
  function enemyPos(s, e) {
    if (e.flying && e.ex) {
      var en = null; for (var i = 0; i < s.map.entries.length; i++) if (s.map.entries[i].id === e.entryId) en = s.map.entries[i];
      var a = wpos(s.map, en.x, en.z), b = wpos(s.map, e.ex.x, e.ex.z);
      return { x: a.x + (b.x - a.x) * e.ft, z: a.z + (b.z - a.z) * e.ft, y: 2.35 };
    }
    var c = wpos(s.map, e.cell.x, e.cell.z), n = wpos(s.map, e.next.x, e.next.z);
    return { x: c.x + (n.x - c.x) * e.f, z: c.z + (n.z - c.z) * e.f, y: 0.0 };
  }

  function moveEnemies(s) {
    for (var i = 0; i < s.enemies.length; i++) {
      var e = s.enemies[i]; if (e.dying) continue;
      // 状态计时
      if (e.hitFlash > 0) e.hitFlash -= DT;
      if (e.slowedUntil <= s.tick) e.slowFactor = 1;
      if (e.flying) {
        if (e.trappedUntil > s.tick) continue;
        e.ft += e.speed * DT * 0.16;
        if (e.ft >= 1) reachExit(s, e);
        continue;
      }
      if (e.trappedUntil > s.tick) { addFx(s, { kind: 'trap', ttl: 0.1, color: col(K.encrypt) }); continue; }
      if (e.blockedBy) continue;
      // 改道后目标格不可通行：沿原段退回当前格，再从当前格重新寻路（连续掉头）
      if (e.returning) {
        e.f -= e.speed * DT;
        if (e.f <= 0) { e.f = 0; e.returning = false; repath(s, e); }
        continue;
      }
      // 阻挡检测（即将进入的格上的阻挡塔）
      var nx = e.next, tk = towerAt(s, nx.x, nx.z);
      if (tk && tk.def.blocks && !e.ignoreBlock[tk.id]) {
        var cap = tk.capNow + (tk.capBonusUntil > s.tick ? tk.capNow : 0);
        var used = 0; for (var b = 0; b < tk.blocking.length; b++) { var be = findEnemy(s, tk.blocking[b]); if (be && !be.dying) used += be.blockCost; }
        if (used + e.blockCost <= cap && !tk.dying) {
          e.blockedBy = tk.id; tk.blocking.push(e.id); e.f = Math.min(e.f, 0.42);
          if (e.disguised || e.latent) { e.revealed = true; log(s, '阻挡使伪装目标显形', 'info'); }
          continue;
        } else e.ignoreBlock[tk.id] = true;
      }
      var tile = tileAt(s, e.cell.x, e.cell.z);
      var slow = (tile && (tile.t === 'o' || (s.downgraded[cellKey(e.cell)] && s.downgraded[cellKey(e.cell)].expireTick > s.tick))) ? 0.52 : 1;
      if (e.disguised || e.latent) { if (slow < 1) e.revealed = true; }
      e.f += e.speed * slow * DT * (e.slowFactor || 1);
      var guard = 0;
      while (e.f >= 1 && guard++ < 8) {
        e.f -= 1; e.cell = { x: e.next.x, z: e.next.z };
        if (e.rv !== s.routeVersion) repath(s, e);
        if (e.path.length <= 1 || s.field.dist[e.cell.z * s.map.W + e.cell.x] <= 1e-6) { reachExit(s, e); break; }
        e.path.shift(); e.next = e.path[1] || e.path[0];
        // 蠕虫复制（首次经过直通节点）
        if (e.copiesAtNode && !e.isCopy) {
          var ct = tileAt(s, e.cell.x, e.cell.z);
          if (ct && ct.t === 'N') {
            var nodeId = s.map.nodeAt[cellKey(e.cell)];
            if (!s.isolated[nodeId] || !s.isolated[nodeId].active) {
              var clone = spawnClone(s, e); if (clone) log(s, '蠕虫在直通交换节点复制出同伴', 'alert');
            }
          }
        }
      }
      var cc = wpos(s.map, e.cell.x, e.cell.z), nn = wpos(s.map, e.next.x, e.next.z);
      e.dir = Math.atan2(nn.x - cc.x, nn.z - cc.z);
    }
  }
  function spawnClone(s, src) {
    if (s.enemies.length > 240) return null;
    var e = Object.assign({}, src, {
      id: nid(s), isCopy: true, copiesAtNode: false, hp: Math.round(src.maxHp * 0.7), maxHp: Math.round(src.maxHp * 0.7),
      rv: s.routeVersion, blockedBy: null, ignoreBlock: {}, f: 0, dying: 0, shield: 0
    });
    e.cell = { x: src.cell.x, z: src.cell.z };
    var r = Path.trace(s.map, s.field, s.access, e.cell.x, e.cell.z);
    e.path = r ? r.path.slice() : [{ x: e.cell.x, z: e.cell.z }]; e.next = e.path[1] || e.path[0];
    s.enemies.push(e);
    addFx(s, { kind: 'copy', ttl: 0.6, color: col(src.def.color) });
    return e;
  }
  function findEnemy(s, id) { for (var i = 0; i < s.enemies.length; i++) if (s.enemies[i].id === id) return s.enemies[i]; return null; }
  function reachExit(s, e) {
    if (e.dying) return;
    e.dying = 0.001;
    var cdmg = Math.max(1, Math.round(e.coreDmg * BAL.core));
    s.core -= cdmg; s.stats.leaks++;
    var w = wpos(s.map, e.cell.x, e.cell.z);
    addFx(s, { kind: 'leak', x: w.x, z: w.z, ttl: 1.0, color: col(K.core) });
    log(s, '告警：恶意程序进入 ' + s.map.coreName + '，中枢完整度 -' + cdmg, 'alert');
    s.events.push({ type: 'leak', amount: cdmg });
    if (s.core <= 0) { s.core = 0; s.phase = 'lose'; log(s, '中枢完整度归零，防线失守', 'alert'); }
  }

  // ---------- 伤害 ----------
  function damageEnemy(s, e, amount, src, kind) {
    if (e.dying) return;
    amount *= BAL.tower;
    if (e.armored) amount *= 0.6;
    var before = e.hp;
    if (e.shield > 0) { var ab = Math.min(e.shield, amount); e.shield -= ab; amount -= ab; }
    e.hp -= amount; e.hitFlash = 0.25;
    s.stats.dmgDealt += before - e.hp;
    var p = enemyPos(s, e);
    addFx(s, { kind: 'hit', x: p.x, z: p.z, y: p.y, ttl: 0.4, color: col(e.def.color) });
    if (e.hp <= 0) killEnemy(s, e, src, kind);
  }
  function killEnemy(s, e, src, kind) {
    if (e.dying) return;
    e.dying = 0.001;
    s.stats.kills++;
    s.compute += e.rewardC; s.stats.computeEarned += e.rewardC;
    s.intel += e.rewardI; s.stats.intelEarned += e.rewardI;
    if (e.blockedBy) { var t = findTower(s, e.blockedBy); if (t) t.blocking = t.blocking.filter(function (id) { return id !== e.id; }); }
    var p = enemyPos(s, e);
    addFx(s, { kind: 'death', x: p.x, z: p.z, y: p.y, ttl: 0.9, color: col(e.def.color), boss: e.boss });
    // 木马未显形被范围波及消灭 → 释放载荷
    if (e.payload && !e.revealed && (kind === 'aoe' || kind === 'splash')) {
      log(s, '木马载荷释放，冲击附近设备', 'alert');
      for (var i = 0; i < s.towers.length; i++) { var t2 = s.towers[i]; if (!t2.dying && dist2(t2.x, t2.z, e.cell.x, e.cell.z) <= 4) damageTower(s, t2, e.payload, e); }
      addFx(s, { kind: 'payload', x: p.x, z: p.z, ttl: 1.0, color: col(K.warn) });
    }
    if (e.boss) { s.stats.bossDown++; log(s, '核心威胁已清除', 'good'); }
    s.events.push({ type: 'kill', boss: e.boss });
  }
  // 便捷：算力回收统计（避免与字段混淆）
  function _computeEarned(s, v) { s.stats.computeEarned += v; }

  function damageTower(s, t, amount, src) {
    if (t.dying) return;
    amount *= BAL.enemy;
    if (t.dmgReduceUntil && t.dmgReduceUntil > s.tick) amount *= 0.25;
    if (t.shield > 0) { var ab = Math.min(t.shield, amount); t.shield -= ab; amount -= ab; }
    t.hp -= amount; t.hitFlash = 0.3; s.stats.dmgTaken += amount;
    var w = wpos(s.map, t.x, t.z);
    addFx(s, { kind: 'towhit', x: w.x, z: w.z, ttl: 0.4, color: col(K.enemy) });
    if (t.hp <= 0) removeTower(s, t, false);
  }

  // ---------- 敌人攻击 / AI ----------
  function enemyActions(s) {
    for (var i = 0; i < s.enemies.length; i++) {
      var e = s.enemies[i]; if (e.dying) continue;
      e.attackCd -= DT;
      // 加壳器护盾光环
      if (e.def.shieldAura) for (var j = 0; j < s.enemies.length; j++) {
        var o = s.enemies[j]; if (o.dying || o.id === e.id || o.flying) continue;
        if (dist2(e.cell.x, e.cell.z, o.cell.x, o.cell.z) <= e.def.auraRange * e.def.auraRange && o.shield <= 0) o.shield = e.def.shieldAura;
      }
      // 勒索者远程攻塔（优先蜜罐）
      if (e.ranged) {
        var best = null, bd = 1e9, honeypotBonus = true;
        for (var k = 0; k < s.towers.length; k++) {
          var t = s.towers[k]; if (t.dying) continue;
          var d = dist2(e.cell.x, e.cell.z, t.x, t.z);
          if (d <= (e.def.range || 3) * (e.def.range || 3)) {
            var score = d - (t.type === 'honeypot' ? 100 : 0);
            if (score < bd) { bd = score; best = t; }
          }
        }
        if (best && e.attackCd <= 0) {
          e.attackCd = 1 / (e.def.rate || 0.7);
          damageTower(s, best, e.dmg, e);
          if (e.encrypt && !best.def.immuneEncrypt) best.encryptedUntil = s.tick + Math.round(8 / DT);
          var a = enemyPos(s, e), b = wpos(s.map, best.x, best.z);
          addFx(s, { kind: 'bolt', x: a.x, z: a.z, y: a.y + 0.4, tx: b.x, tz: b.z, ty: 0.5, ttl: 0.35, color: col(e.def.color), style: 'encrypt' });
          if (e.encrypt) addFx(s, { kind: 'encrypt', x: b.x, z: b.z, ttl: 0.7, color: col(K.encrypt) });
        }
      }
      // 洪泛团：冲击附近被隔离节点上的塔 / 隔离器
      if (e.siege) {
        var iso = null, idist = 1e9, isoId = null;
        for (var key in s.isolated) if (s.isolated[key].active) {
          var n = nodeById(s, key); if (!n) continue;
          var dd = dist2(e.cell.x, e.cell.z, n.x, n.z); if (dd < idist) { idist = dd; iso = n; isoId = key; }
        }
        if (iso && idist <= 4.0) {
          var target = nodeDefender(s, isoId, iso);
          if (target && e.attackCd <= 0) {
            e.attackCd = 0.85;
            var dmg = e.dmg * 2.2;
            if (target.tower) damageTower(s, target.tower, dmg, e);
            else { s.isolated[isoId].hp -= dmg; if (s.isolated[isoId].hp <= 0) bypassNode(s, isoId, '（应急隔离器被冲毁）'); }
            var aa = enemyPos(s, e), bb = wpos(s.map, iso.x, iso.z);
            addFx(s, { kind: 'bolt', x: aa.x, z: aa.z, y: 0.5, tx: bb.x, tz: bb.z, ty: 0.4, ttl: 0.3, color: col(e.def.color), style: 'siege' });
            addFx(s, { kind: 'siege', x: bb.x, z: bb.z, ttl: 0.5, color: col(K.warn) });
          }
        }
      }
      // 被阻挡的近战敌人攻击挡住它的塔
      if (e.blockedBy && e.melee) {
        var t2 = findTower(s, e.blockedBy);
        if (!t2 || t2.dying) { e.blockedBy = null; }
        else {
          // 蜜罐诱敌：改打附近蜜罐
          if (e.def.taunt !== true) {
            var hp = nearestTaunt(s, e);
            if (hp) t2 = hp;
          }
          if (e.attackCd <= 0) {
            e.attackCd = 0.9;
            damageTower(s, t2, e.dmg, e);
            var a2 = enemyPos(s, e), b2 = wpos(s.map, t2.x, t2.z);
            addFx(s, { kind: 'bolt', x: a2.x, z: a2.z, y: 0.4, tx: b2.x, tz: b2.z, ty: 0.4, ttl: 0.22, color: col(e.def.color), style: 'melee' });
          }
        }
      }
      // Boss 阶段与技能
      if (e.boss) bossAI(s, e);
    }
  }
  function nodeById(s, id) { for (var i = 0; i < s.map.nodes.length; i++) if (s.map.nodes[i].id === id) return s.map.nodes[i]; return null; }
  function nodeDefender(s, nodeId, n) {
    var t = towerAt(s, n.x, n.z);
    if (t) return { tower: t };
    if (s.isolated[nodeId] && s.isolated[nodeId].hp !== undefined) return { item: true };
    return null;
  }
  function nearestTaunt(s, e) {
    var best = null, bd = 1e9;
    for (var i = 0; i < s.towers.length; i++) { var t = s.towers[i]; if (t.dying || !t.def.taunt) continue; var d = dist2(e.cell.x, e.cell.z, t.x, t.z); if (d <= t.tauntRange * t.tauntRange && d < bd) { bd = d; best = t; } }
    return best;
  }

  function bossAI(s, e) {
    var def = e.def, frac = e.hp / e.maxHp;
    // 阶段按血量阈值从高到低推进；另有时间保底，确保阶段演出稳定出现
    var idx = 0;
    for (var i = 0; i < def.phases.length; i++) if (frac <= def.phases[i].at + 1e-6) idx = i;
    var timeIdx = Math.min(def.phases.length - 1, Math.floor((s.tick - e.spawnTick) / Math.round(9 / DT)));
    if (timeIdx > idx) idx = timeIdx;
    if (idx > e.phaseIdx) {
      e.phaseIdx = idx;
      var pn = def.phases[idx].name;
      log(s, '【' + def.name + '】进入阶段：' + pn, 'alert');
      addFx(s, { kind: 'bossphase', ttl: 1.6, color: col(def.color) });
      s.events.push({ type: 'bossphase', name: pn });
      if (def.id === 'zheying' && pn === '提权') { e.armored = true; e.latent = false; e.revealed = true; spawnTrojans(s, e, 3); }
      if (def.id === 'zheying' && pn === '潜伏') { e.latent = true; e.revealed = false; }
      if (def.id === 'mirage' && pn === '路由风暴') stormShields(s, e);
      if (def.id === 'wankui' && pn === '傀群') spawnWorms(s, e, 8);
    }
    if (def.id === 'zheying' && e.phaseIdx === 0) { e.latent = !e.revealed; }
    // 周期性地形技能
    if (s.tick >= e.skillCd) {
      e.skillCd = s.tick + Math.round(11 / DT);
      if (def.id === 'mirage') scheduleBlackhole(s, e);
      else if (def.id === 'zheying' && e.phaseIdx >= 2) scheduleLock(s, e);
      else if (def.id === 'wankui') wankuiSurge(s, e);
    }
  }
  function spawnTrojans(s, e, n) { for (var i = 0; i < n; i++) spawnCloneOfType(s, e, 'trojan'); }
  function spawnWorms(s, e, n) { for (var i = 0; i < n; i++) spawnCloneOfType(s, e, 'worm'); }
  function spawnCloneOfType(s, e, type) {
    if (s.enemies.length > 240) return;
    var def = Data.ENEMIES[type];
    var c = { id: nid(s), type: type, def: def, boss: false, entryId: e.entryId, hp: def.hp, maxHp: def.hp, shield: 0,
      coreDmg: def.coreDmg, rewardC: def.rewardC, rewardI: def.rewardI, speed: def.speed, dmg: def.dmg, blockCost: def.block,
      flying: !!def.flying, disguised: !!def.disguise, latent: false, revealed: !def.disguise, melee: !!def.melee, ranged: false,
      siege: false, copiesAtNode: !!def.copiesAtNode, isCopy: true, encrypt: false, payload: def.payload || 0,
      cell: { x: e.cell.x, z: e.cell.z }, next: { x: e.cell.x, z: e.cell.z }, f: 0, path: [], rv: s.routeVersion,
      blockedBy: null, ignoreBlock: {}, attackCd: 0, trappedUntil: 0, slowedUntil: 0, slowFactor: 1,
      hitFlash: 0, dying: 0, dir: 0, ft: 0, ex: null, phaseIdx: 0, skillCd: 0, armored: false, spawnTick: s.tick };
    var r = Path.trace(s.map, s.field, s.access, c.cell.x, c.cell.z);
    c.path = r ? r.path.slice() : [c.cell]; c.next = c.path[1] || c.path[0];
    s.enemies.push(c);
  }
  function stormShields(s, e) {
    for (var i = 0; i < s.towers.length; i++) { var t = s.towers[i]; if (!t.dying && dist2(t.x, t.z, e.cell.x, e.cell.z) <= 16) t.shield = Math.max(0, t.shield * 0.3); }
    log(s, '蜃楼「路由风暴」削弱附近设备护盾', 'alert');
    addFx(s, { kind: 'storm', ttl: 1.4, color: col(e.def.color) });
  }
  function wankuiSurge(s, e) {
    // 冲击被隔离节点，重创节点上的塔/隔离器；无隔离节点时冲击附近塔
    var hit = false;
    for (var key in s.isolated) if (s.isolated[key].active) {
      var n = nodeById(s, key); if (!n) continue;
      if (dist2(e.cell.x, e.cell.z, n.x, n.z) > 25) continue;
      var df = nodeDefender(s, key, n);
      if (df && df.tower) damageTower(s, df.tower, 140, e);
      else if (df && df.item) { s.isolated[key].hp -= 140; if (s.isolated[key].hp <= 0) bypassNode(s, key, '（隔离器被洪峰冲毁）'); }
      var w = wpos(s.map, n.x, n.z);
      addFx(s, { kind: 'siege', x: w.x, z: w.z, ttl: 0.9, color: col(e.def.color) });
      hit = true; break;
    }
    if (!hit) { var wt = nearestTower(s, e); if (wt) damageTower(s, wt, 90, e); }
    log(s, '万傀「洪峰」冲击隔离节点', 'alert');
  }
  function nearestTower(s, e) { var b = null, bd = 1e9; for (var i = 0; i < s.towers.length; i++) { var t = s.towers[i]; if (t.dying) continue; var d = dist2(t.x, t.z, e.cell.x, e.cell.z); if (d < bd) { bd = d; b = t; } } return b; }

  // Boss 地形技能：先预警，再在不封死的位置生效
  function pushWarning(s, cells, text, color, delaySec) {
    var trigger = s.tick + Math.round((delaySec || 2.4) / DT);
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i], w = wpos(s.map, c.x, c.z);
      s.warnings.push({ x: c.x, z: c.z, wx: w.x, wz: w.z, trigger: trigger, text: text, color: color });
    }
    s.pendingBlocks = s.pendingBlocks || [];
    s.pendingBlocks.push({ trigger: trigger, cells: cells, type: 'blackhole' });
    log(s, '预警：' + text, 'alert');
    s.events.push({ type: 'warning', text: text });
  }
  function safeBlockCells(s, cells) {
    // 逐格尝试，剔除会封死入口/场上单位的格子
    var good = [];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i], k = cellKey(c);
      var tile = tileAt(s, c.x, c.z); if (!tile || tile.t === '#' || tile.t === '~' || tile.t === 'P' || tile.t === '.') continue;
      var test = Object.assign({}, s.blocks); test[k] = { expireTick: s.tick + 600, type: 'blackhole' };
      var acc = Path.makeAccess(s.map, Object.assign({}, s, { blocks: test }));
      var f = Path.rebuild(s.map, acc);
      var bad = Path.connectivity(s.map, f, acc, groundCells(s));
      if (bad.length === 0) good.push(c);
    }
    return good;
  }
  function scheduleBlackhole(s, e) {
    // 在 Boss 前方链路制造若干临时黑洞，选不会封死的位置
    var cand = [], cx = e.cell.x, cz = e.cell.z;
    var dirs = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]];
    for (var d = 0; d < dirs.length; d++) cand.push({ x: cx + dirs[d][0], z: cz + dirs[d][1] });
    cand = cand.filter(function (c) { var t = tileAt(s, c.x, c.z); return t && (t.t === '=' || t.t === 'o' || t.t === 'N'); });
    var good = safeBlockCells(s, cand).slice(0, 3);
    if (good.length) pushWarning(s, good, '蜃楼「伪路由」将在前方链路制造路由黑洞', col(K.encrypt), 2.6);
  }
  function scheduleLock(s, e) {
    var cand = [], cz = e.cell.z;
    for (var dz = 1; dz <= 2; dz++) for (var dx = -1; dx <= 1; dx++) cand.push({ x: e.cell.x + dx, z: cz + dz });
    cand = cand.filter(function (c) { var t = tileAt(s, c.x, c.z); return t && (t.t === '=' || t.t === 'o' || t.t === 'N'); });
    var good = safeBlockCells(s, cand).slice(0, 4);
    if (good.length) pushWarning(s, good, '蛰影「破坏」将锁死前方一段运维环', col(K.warn), 2.8);
  }
  function processWarnings(s) {
    if (s.pendingBlocks) for (var i = s.pendingBlocks.length - 1; i >= 0; i--) {
      var pb = s.pendingBlocks[i];
      if (s.tick >= pb.trigger) {
        var cells = safeBlockCells(s, pb.cells);
        for (var j = 0; j < cells.length; j++) s.blocks[cellKey(cells[j])] = { expireTick: s.tick + Math.round(9 / DT), type: 'blackhole' };
        if (cells.length) recompute(s, 'boss-block');
        s.pendingBlocks.splice(i, 1);
      }
    }
    for (var w = s.warnings.length - 1; w >= 0; w--) if (s.tick > s.warnings[w].trigger + Math.round(0.6 / DT)) s.warnings.splice(w, 1);
  }

  // ---------- 塔攻击 / 治疗 ----------
  function towerActions(s) {
    for (var i = 0; i < s.towers.length; i++) {
      var t = s.towers[i]; if (t.dying) continue;
      if (t.hitFlash > 0) t.hitFlash -= DT;
      if (t.cd > 0) t.cd -= DT;
      var encrypted = t.encryptedUntil > s.tick && !t.def.immuneEncrypt;
      if (encrypted) continue; // 加密：停止攻击/治疗/技能
      var w = wpos(s.map, t.x, t.z);
      if (t.def.heal) {
        if (t.cd <= 0) {
          var healed = false;
          for (var j = 0; j < s.towers.length; j++) {
            var o = s.towers[j]; if (o.dying || o.id === t.id) continue;
            if (dist2(o.x, o.z, t.x, t.z) <= t.rangeNow * t.rangeNow && o.hp < o.maxHp) {
              o.hp = Math.min(o.maxHp, o.hp + 14 * (t.lvl === 2 ? 1.6 : 1));
              var ow = wpos(s.map, o.x, o.z);
              addFx(s, { kind: 'heal', x: ow.x, z: ow.z, ttl: 0.7, color: col(K.heal) });
              healed = true;
            }
          }
          t.cd = 1 / t.rateNow; t.fireFlash = s.tick;
          if (healed) addFx(s, { kind: 'healring', x: w.x, z: w.z, ttl: 0.7, color: col(K.heal), r: t.rangeNow * s.map.CELL });
        }
        continue;
      }
      if (t.def.detect) { // 沙箱：检测显形 + 范围攻击
        for (var q = 0; q < s.enemies.length; q++) { var en = s.enemies[q]; if (en.dying || en.flying) continue; if (dist2(en.cell.x, en.cell.z, t.x, t.z) <= t.rangeNow * t.rangeNow) { if (en.disguised || en.latent) { en.revealed = true; en.latent = false; } } }
        if (t.cd <= 0) {
          var hitAny = false;
          for (var q2 = 0; q2 < s.enemies.length; q2++) { var en2 = s.enemies[q2]; if (en2.dying || en2.flying) continue; if (dist2(en2.cell.x, en2.cell.z, t.x, t.z) <= t.rangeNow * t.rangeNow) { damageEnemy(s, en2, t.dmgNow, t, 'aoe'); hitAny = true; } }
          t.cd = 1 / t.rateNow; t.fireFlash = s.tick;
          if (hitAny) addFx(s, { kind: 'aoe', x: w.x, z: w.z, ttl: 0.6, color: col(t.def.color), r: t.rangeNow * s.map.CELL });
          else addFx(s, { kind: 'scan', x: w.x, z: w.z, ttl: 0.6, color: col(t.def.color), r: t.rangeNow * s.map.CELL });
        }
        continue;
      }
      if (t.def.ranged) { // 拦截器
        if (t.cd > 0) continue;
        var target = pickTarget(s, t, true);
        if (target) {
          t.cd = 1 / t.rateNow; t.fireFlash = s.tick;
          var dmg = t.dmgNow * (t.calibUntil > s.tick ? 1.5 : 1);
          var tp = enemyPos(s, target);
          addFx(s, { kind: 'bolt', x: w.x, z: w.z, y: 0.9, tx: tp.x, tz: tp.z, ty: tp.y + 0.3, ttl: 0.3, color: col(t.def.color), style: 'interceptor' });
          damageEnemy(s, target, dmg, t, 'single');
          if (t.slowPower) { target.slowedUntil = s.tick + Math.round(2 / DT); target.slowFactor = 1 - t.slowPower; }
          if (t.pierce > 1) {
            var extra = pickTargets(s, t, true, t.pierce - 1, target.id);
            for (var pi = 0; pi < extra.length; pi++) damageEnemy(s, extra[pi], dmg * 0.7, t, 'splash');
          }
          t.targetId = target.id;
        }
        continue;
      }
      if (t.def.melee) { // 防火墙 / 蜜罐：反击被阻挡敌人 + 节点防火墙拦截相邻链路
        if (t.cd > 0) continue;
        var victims = [];
        for (var b = 0; b < t.blocking.length; b++) { var be = findEnemy(s, t.blocking[b]); if (be && !be.dying) victims.push(be); }
        if (!victims.length && t.nodeId) {
          for (var q3 = 0; q3 < s.enemies.length; q3++) { var en3 = s.enemies[q3]; if (en3.dying || en3.flying) continue; if (dist2(en3.cell.x, en3.cell.z, t.x, t.z) <= 2) victims.push(en3); }
        }
        if (victims.length) {
          victims.sort(function (a, c) { return s.field.dist[a.cell.z * s.map.W + a.cell.x] - s.field.dist[c.cell.z * s.map.W + c.cell.x]; });
          var v = victims[0]; t.cd = 1 / t.rateNow; t.fireFlash = s.tick;
          var vp = enemyPos(s, v);
          addFx(s, { kind: 'bolt', x: w.x, z: w.z, y: 0.6, tx: vp.x, tz: vp.z, ty: vp.y + 0.2, ttl: 0.22, color: col(t.def.color), style: 'melee' });
          damageEnemy(s, v, t.dmgNow, t, 'single');
          t.targetId = v.id;
        }
      }
    }
  }
  function validTarget(s, t, e) {
    if (e.dying) return false;
    if ((e.disguised || e.latent) && !e.revealed) return false;
    if (e.flying && !t.def.attacksAir) return false;
    return true;
  }
  function pickTarget(s, t, ranged) {
    var range = t.rangeNow + (t.calibUntil > s.tick ? 1.2 : 0);
    var best = null, bd = 1e9;
    for (var i = 0; i < s.enemies.length; i++) {
      var e = s.enemies[i]; if (!validTarget(s, t, e)) continue;
      var p = enemyPos(s, e), tw = wpos(s.map, t.x, t.z);
      var d = dist2(tw.x, tw.z, p.x, p.z);
      if (d > range * range * s.map.CELL * s.map.CELL) continue;
      if (t.def.facing) {
        var ang = Math.atan2(p.x - tw.x, p.z - tw.z);
        var diff = Math.abs(normAngle(ang - t.facing));
        if (diff > 1.45) continue;   // 朝向决定的约 166° 攻击扇区（背后仍不可打）
      }
      var prog = s.field.dist[e.cell.z * s.map.W + e.cell.x];
      if (!isFinite(prog)) prog = 999;
      if (prog < bd) { bd = prog; best = e; }
    }
    return best;
  }
  function pickTargets(s, t, ranged, n, exclude) {
    var out = [], range = t.rangeNow;
    for (var i = 0; i < s.enemies.length && out.length < n; i++) { var e = s.enemies[i]; if (e.id === exclude || !validTarget(s, t, e)) continue; var p = enemyPos(s, e), tw = wpos(s.map, t.x, t.z); if (dist2(tw.x, tw.z, p.x, p.z) <= range * range * s.map.CELL * s.map.CELL) out.push(e); }
    return out;
  }
  function normAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

  // ---------- 道具 ----------
  function itemReady(s, id) { return !s.itemCd[id] || s.itemCd[id] <= s.tick; }
  function useItem(s, id, x, z) {
    var def = Data.ITEMS[id]; if (!def) return { ok: false, reason: '未知道具' };
    if (!itemReady(s, id)) return { ok: false, reason: '道具冷却中' };
    var res = def.res === 'intel' ? s.intel : s.compute;
    if (res < def.cost) return { ok: false, reason: (def.res === 'intel' ? '情报' : '算力') + '不足' };
    var tile = tileAt(s, x, z); if (!tile) return { ok: false, reason: '超出边界' };
    var ok = false;
    if (id === 'isolator') {
      if (tile.t !== 'N') return { ok: false, reason: '需投放于交换节点' };
      var nodeId = s.map.nodeAt[cellKey({ x: x, z: z })];
      var pv = isolatePreview(s, nodeId); if (!pv.ok) return { ok: false, reason: pv.reason === 'blocked' ? '隔离将封死通路' : '暂不可隔离' };
      s.isolated[nodeId] = { active: true, by: 'item', hp: def.hp, maxHp: def.hp, expireTick: s.tick + Math.round(def.dur / DT), tick: s.tick };
      s.stats.isoCount++; ok = true;
      var w0 = wpos(s.map, x, z);
      addFx(s, { kind: 'isolate', x: w0.x, z: w0.z, ttl: 1.1, color: col(K.warn) });
      recompute(s, 'isolator');
      log(s, '应急隔离器部署，节点临时隔离', 'good');
    } else if (id === 'downgrade') {
      if (tile.t !== '=' && tile.t !== 'o' && tile.t !== 'N') return { ok: false, reason: '需投放于链路' };
      var R = def.radius, cnt = 0;
      for (var dz = -Math.ceil(R); dz <= Math.ceil(R); dz++) for (var dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
        if (dx * dx + dz * dz > R * R) continue;
        var tt = tileAt(s, x + dx, z + dz);
        if (tt && (tt.t === '=' || tt.t === 'o' || tt.t === 'N')) { s.downgraded[cellKey({ x: x + dx, z: z + dz })] = { expireTick: s.tick + Math.round(def.dur / DT) }; cnt++; }
      }
      if (!cnt) return { ok: false, reason: '无有效链路' };
      ok = true;
      var w1 = wpos(s.map, x, z);
      addFx(s, { kind: 'downgrade', x: w1.x, z: w1.z, ttl: 1.2, color: col(def.color), r: R * s.map.CELL });
      recompute(s, 'downgrade');
      log(s, '协议降级生效，局部链路切换旧协议', 'good');
    } else if (id === 'restore') {
      var t = towerAt(s, x, z); if (!t) return { ok: false, reason: '需指向一座设备' };
      t.hp = Math.min(t.maxHp, t.hp + Math.round(t.maxHp * 0.5));
      t.encryptedUntil = 0; ok = true;
      var w2 = wpos(s.map, x, z);
      addFx(s, { kind: 'restore', x: w2.x, z: w2.z, ttl: 1.0, color: col(K.heal) });
      log(s, '备份还原：' + t.def.name + ' 生命恢复、加密解除', 'good');
    }
    if (!ok) return { ok: false, reason: '投放失败' };
    if (def.res === 'intel') s.intel -= def.cost; else s.compute -= def.cost;
    s.itemCd[id] = s.tick + Math.round(def.cd / DT);
    s.events.push({ type: 'item', itemId: id });
    return { ok: true };
  }

  // ---------- 过期 / 清理 ----------
  function expirations(s) {
    var changed = false;
    for (var key in s.downgraded) if (s.downgraded[key].expireTick <= s.tick) { delete s.downgraded[key]; changed = true; }
    for (var k2 in s.blocks) if (s.blocks[k2].expireTick <= s.tick) { delete s.blocks[k2]; changed = true; }
    for (var id in s.isolated) {
      var iso = s.isolated[id];
      if (iso.active && iso.expireTick && iso.expireTick <= s.tick) { bypassNode(s, id, '（应急隔离器失效）'); }
    }
    if (changed) recompute(s, 'expire');
  }
  function cleanup(s) {
    s.towers = s.towers.filter(function (t) { return !t.dying; });
    for (var i = s.enemies.length - 1; i >= 0; i--) {
      var e = s.enemies[i];
      if (e.dying) { e.dying += DT; if (e.dying > 0.65) s.enemies.splice(i, 1); }
    }
    for (var j = s.fx.length - 1; j >= 0; j--) {
      var f = s.fx[j]; f.ttl -= DT;
      if (f.kind === 'spark' && f.vx !== undefined) { f.x += f.vx * DT; f.y += f.vy * DT; f.z += f.vz * DT; f.vy -= 4 * DT; }
      if (f.ttl <= 0) s.fx.splice(j, 1);
    }
  }
  function intelFromHeldNodes(s) {
    // 持续守住隔离节点：每 2 秒产出少量情报
    if (s.tick % Math.round(2 / DT) === 0) {
      var n = 0; for (var id in s.isolated) if (s.isolated[id].active && s.isolated[id].by === 'tower') n++;
      if (n) { s.intel += n * 2; s.stats.intelEarned += n * 2; }
    }
  }

  // ---------- 波次调度 ----------
  function processPlan(s) {
    while (s.planIdx < s.wavePlan.length && s.wavePlan[s.planIdx].tick <= s.tick) {
      var it = s.wavePlan[s.planIdx++];
      if (it.waveEnd) {
        if (!s.waveEndSeen[it.waveEnd]) {
          s.waveEndSeen[it.waveEnd] = true;
          s.intel += it.rewardIntel; s.stats.intelEarned += it.rewardIntel;
          s.compute += it.computeBonus; s.stats.computeEarned += it.computeBonus;
          log(s, '第 ' + it.waveEnd + ' 波结束 · 情报 +' + it.rewardIntel + ' / 算力 +' + it.computeBonus, 'good');
          s.events.push({ type: 'waveEnd', wave: it.waveEnd });
        }
      } else spawn(s, it);
    }
    // 当前波次显示
    var wv = 1;
    for (var i = 0; i < s.planIdx; i++) if (s.wavePlan[i].wave) wv = Math.max(wv, s.wavePlan[i].wave);
    if (wv > s.wave) { s.wave = Math.min(wv, s.totalWaves); log(s, '流量预报：第 ' + s.wave + ' 波来袭', 'info'); s.events.push({ type: 'waveStart', wave: s.wave }); }
    // 胜利：全部波次已完整出场且撑到收尾时刻（中枢未失守）
    if (s.planIdx >= s.wavePlan.length && s.tick >= s.endTick && s.phase === 'battle') {
      s.phase = 'win'; log(s, '全部波次已抵御，事件报告生成', 'good');
      s.events.push({ type: 'win' });
    }
  }

  // ---------- 主步进 ----------
  function step(s) {
    if (s.phase !== 'battle') { s.tick++; s.time = s.tick * DT; cleanup(s); return; }
    s.tick++; s.time = s.tick * DT;
    processPlan(s);
    processWarnings(s);
    expirations(s);
    moveEnemies(s);
    enemyActions(s);
    towerActions(s);
    intelFromHeldNodes(s);
    // 算力自然增长
    if (s.tick % Math.round(1 / DT) === 0) { s.compute += 3; s.stats.computeEarned += 3; }
    cleanup(s);
  }

  var G = {
    create: create, step: step, build: build, upgrade: upgrade, sell: sell, skill: skill,
    useItem: useItem, isolatePreview: isolatePreview, canPlace: canPlace, recompute: recompute,
    bypassNode: bypassNode, findTower: findTower, findEnemy: findEnemy, towerAt: towerAt,
    wpos: wpos, enemyPos: enemyPos, tileAt: tileAt, cellKey: cellKey,
    itemReady: itemReady, nodeById: nodeById, spawn: spawn, damageTower: damageTower,
    CORE_MAX: CORE_MAX, ISOLATE_INTEL: ISOLATE_INTEL, SELL_REFUND: SELL_REFUND,
    C: K, col: col, log: log, addFx: addFx, rnd: rnd
  };
  TD.Game = G;
})();
