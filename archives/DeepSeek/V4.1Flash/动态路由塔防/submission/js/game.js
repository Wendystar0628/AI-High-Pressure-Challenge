/* =========================================================================
   动态路由塔防 · 战斗与路由核心
   ========================================================================= */
(function (global) {
  'use strict';
  const D = global.GAME_DATA;
  const CELL = D.CELL;
  const FIXED = D.FIXED_DT;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const KEY = (x, y) => x + ',' + y;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let uid = 1;

  /* ------------------------------------------------------------------ */
  class BattleMap {
    constructor(def, world) {
      this.def = def;
      this.world = world || null;
      // Share the rendered map's cell objects when possible. This keeps
      // selection, placement, isolation and routing on the exact same cells.
      if (this.world && this.world.map && this.world.map.def === def) {
        const wm = this.world.map;
        this.W = wm.W; this.H = wm.H;
        this.cells = wm.cells; this.byKey = wm.byKey;
        this.entrances = wm.entrances; this.exits = wm.exits; this.switches = wm.switches;
        for (const c of this.cells) {
          c.tower = c.tower || null; c.isolation = c.isolation || null;
          c.bossBlockUntil = c.bossBlockUntil || 0; c.bossBlockFrom = c.bossBlockFrom || 0;
          c.downUntil = c.downUntil || 0; c.lastReiso = c.lastReiso == null ? -99 : c.lastReiso;
          c.wx = (c.x - (this.W - 1) / 2) * CELL;
          c.wz = (c.y - (this.H - 1) / 2) * CELL;
        }
        this.version = 0;
        this.routes = {};
        this.time = 0;
        this.segments = [];
        this.recomputeRoutes();
        return;
      }
      this.H = def.rows.length;
      this.W = def.rows[0].length;
      this.cells = [];
      this.byKey = {};
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          const ch = def.rows[y][x];
          const walk = '.oABCXY'.includes(ch);
          const cell = {
            x, y, ch, walk, platform: ch === 'P', old: ch === 'o',
            type: ch === 'P' ? 'platform' : ch === '#' ? 'void' : walk ? (ch === 'o' ? 'old' : 'link') : 'obstacle',
            tower: null, isolation: null, bossBlockUntil: 0,
            downUntil: 0, lastReiso: -99, wx: (x - (this.W - 1) / 2) * CELL, wz: (y - (this.H - 1) / 2) * CELL,
            inPath: false
          };
          this.cells.push(cell); this.byKey[KEY(x, y)] = cell;
        }
      }
      this.entrances = def.entrances.map(e => {
        const c = this.byKey[KEY(e.x, e.y)];
        c.type = 'entrance'; c.walk = true;
        return Object.assign({}, e, { cell: c });
      });
      this.exits = def.exits.map(e => {
        const c = this.byKey[KEY(e.x, e.y)];
        c.type = 'exit'; c.walk = true;
        return Object.assign({}, e, { cell: c });
      });
      this.switches = def.switches.map(s => {
        const c = this.byKey[KEY(s.x, s.y)];
        c.type = 'switch'; c.walk = true; c.switch = s;
        return Object.assign({}, s, { cell: c });
      });
      this.version = 0;
      this.routes = {};
      this.time = 0;
      this.segments = [];
      this.recomputeRoutes();
    }
    at(x, y) { return this.byKey[KEY(x, y)]; }
    neighbors(c) {
      const out = [];
      for (const [dx, dy] of DIRS) {
        const n = this.byKey[KEY(c.x + dx, c.y + dy)];
        if (n && (n.walk || false)) out.push(n);
      }
      return out;
    }
    isBlockedCell(c) {
      return !!c.isolation || (c.bossBlockUntil > this.time && (c.bossBlockFrom || 0) <= this.time);
    }
    isOpen(c) {
      return c.walk && !this.isBlockedCell(c);
    }
    isSlow(c) {
      return !!c.old || (c.downUntil || 0) > this.time;
    }
    stepCost(c) { return this.isSlow(c) ? 1.85 : 1; }
    top(c) { return c.platform ? 1.05 : 0.32; }

    findPath(start, opts) {
      opts = opts || {};
      const extra = opts.extraBlocked;
      const target = opts.toCell;
      const dist = new Map(), prev = new Map();
      const sk = KEY(start.x, start.y);
      dist.set(sk, 0);
      const pq = [{ x: start.x, y: start.y, d: 0 }];
      let best = null;
      while (pq.length) {
        pq.sort((a, b) => a.d - b.d);
        const cur = pq.shift();
        const ck = KEY(cur.x, cur.y);
        if (cur.d > (dist.get(ck) ?? 1e9) + 1e-9) continue;
        const c = this.byKey[ck];
        if (target && target.includes(c)) { best = { cell: c, d: cur.d }; break; }
        if (!target && c.type === 'exit') { best = { cell: c, d: cur.d }; break; }
        for (const [dx, dy] of DIRS) {
          const n = this.byKey[KEY(cur.x + dx, cur.y + dy)];
          if (!n || !n.walk) continue;
          if (extra && extra.has(KEY(n.x, n.y))) continue;
          if (this.isBlockedCell(n)) continue;
          if (n.tower && n.tower.defId === 'netgap' && !n.isolation) { /* never */ }
          const nd = cur.d + this.stepCost(n);
          const nk = KEY(n.x, n.y);
          if (nd < (dist.get(nk) ?? 1e9) - 1e-9) {
            dist.set(nk, nd); prev.set(nk, c); pq.push({ x: n.x, y: n.y, d: nd });
          }
        }
      }
      if (!best) return null;
      const path = [];
      let cur = best.cell;
      while (cur) {
        path.push(cur);
        if (cur.x === start.x && cur.y === start.y) break;
        cur = prev.get(KEY(cur.x, cur.y));
      }
      path.reverse();
      return { path, cost: best.d, exit: best.cell };
    }

    recomputeRoutes(opts) {
      opts = opts || {};
      const old = this.routes;
      const routes = {};
      for (const e of this.entrances) {
        const r = this.findPath(e.cell, opts);
        if (r) routes[e.id] = { cells: r.path, cost: r.cost, exitId: r.exit.name || r.exit.ch };
        else routes[e.id] = null;
      }
      const changed = [];
      for (const e of this.entrances) {
        const a = old[e.id], b = routes[e.id];
        if (!a || !b) { changed.push(e.id); continue; }
        const sa = a.cells.map(c => c.x + ',' + c.y).join('>');
        const sb = b.cells.map(c => c.x + ',' + c.y).join('>');
        if (sa !== sb) changed.push(e.id);
      }
      this.routes = routes;
      this.version++;
      return changed;
    }

    wouldSeal(extraBlocked, enemies, ignoreEnemy) {
      const sealed = [];
      for (const e of this.entrances) {
        const r = this.findPath(e.cell, { extraBlocked });
        if (!r) sealed.push(e.id);
      }
      const stuck = [];
      if (enemies) {
        for (const en of enemies) {
          if (en.dead || en.def.flying || en.luredBy || en.blockedBy) continue;
          if (ignoreEnemy && ignoreEnemy === en) continue;
          if (!en.cell || !en.cell.walk) continue;
          if (extraBlocked && extraBlocked.has(KEY(en.cell.x, en.cell.y))) { stuck.push(en); continue; }
          if (this.isBlockedCell(en.cell)) continue;
          const r = this.findPath(en.cell, { extraBlocked });
          if (!r) stuck.push(en);
        }
      }
      return { sealed, stuck };
    }
  }

  /* ------------------------------------------------------------------ */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function seeded(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  class Game {
    constructor(opts) {
      opts = opts || {};
      this.opts = opts;
      this.mapDef = D.MAPS.find(m => m.id === opts.mapId) || D.MAPS[0];
      this.mode = opts.mode || 'live';
      this.world = opts.world || null;
      this.seed = opts.seed || (Date.now() & 0x7fffffff);
      this.rng = seeded(this.seed);
      this.time = 0;
      this.paused = false;
      this.speed = 1;
      this.over = false;
      this.victory = false;
      this.integrity = 100;
      this.compute = this.mapDef.startCompute;
      this.intel = this.mapDef.startIntel;
      this.towers = [];
      this.enemies = [];
      this.waves = D.WAVES[this.mapDef.id] || [];
      this.waveIndex = -1;
      this.waveState = 'prep';
      this.prepTimer = opts.prepTime != null ? opts.prepTime : 10;
      this.spawnQueue = [];
      this.waveNote = '';
      this.stats = { kills: 0, leaks: 0, towersLost: 0, built: 0, damageDealt: 0, computeEarned: 0, intelEarned: 0, startTime: 0, bossKills: 0, reroutes: 0 };
      this.itemCooldowns = {};
      this.towerCooldowns = {};
      this.logs = [];
      this.events = [];
      this.onEvent = null;
      if (this.world) this.world.setMap(this.mapDef, this);
      this.map = new BattleMap(this.mapDef, this.world);
      this.isolatedAccum = 0;
      this.activeBoss = null;
      this.selected = null;
      this.routePulse = {};
      this.routeFlash = 0;
      this.phase = 'battle';
      this.bossSegments = [];
      this.lastWaveClear = -1;
      this.computeRate = 1.4;
      this.difficulty = this.mapDef.id === 'segment' ? 1.0 : this.mapDef.id === 'backbone' ? 1.08 : 1.15;
      if (this.world) this.syncRoutes();
      this.spawnTimerBase = 0;
    }

    emit(type, data) {
      const ev = { type, data: data || {}, time: this.time };
      this.events.push(ev);
      if (this.events.length > 80) this.events.shift();
      if (this.onEvent) { try { this.onEvent(type, data || {}); } catch (e) { console.error(e); } }
    }
    log(text, cls) {
      this.logs.push({ t: this.time, text, cls: cls || '' });
      if (this.logs.length > 60) this.logs.shift();
      this.emit('log', { text, cls });
    }

    /* ---------------- wave / flow ---------------- */
    totalWaves() { return this.waves.length; }
    currentWaveNo() { return Math.max(1, this.waveIndex + 1); }
    nextWaveDef() { return this.waveIndex + 1 < this.waves.length ? this.waves[this.waveIndex + 1] : null; }

    start() {
      this.beginPrep(10);
      this.log('守护进程已加载 · ' + this.mapDef.name + ' 自治域进入警戒', 'sys');
      this.emit('start', {});
    }
    beginPrep(t) {
      this.waveState = 'prep';
      this.prepTimer = t;
    }
    startWave() {
      if (this.over) return;
      if (this.waveState === 'active') return;
      this.waveIndex++;
      if (this.waveIndex >= this.waves.length) { this.finishVictory(); return; }
      const w = this.waves[this.waveIndex];
      this.waveState = 'active';
      this.waveNote = w.note || '';
      this.spawnQueue = [];
      let maxT = 0;
      const nerf = this.waveIndex >= 4 ? 0.82 : this.waveIndex <= 1 ? 0.68 : 0.85;
      const gapScale = this.waveIndex >= 8 ? 1.15 : 1;
      w.groups.forEach(g => {
        const cnt = Math.max(1, Math.round(g.n * nerf));
        for (let i = 0; i < cnt; i++) {
          const t = (g.delay || 0) + i * (g.gap || 1) * gapScale;
          maxT = Math.max(maxT, t);
          this.spawnQueue.push({ t, type: g.e, ent: g.ent });
        }
      });
      this.spawnQueue.sort((a, b) => a.t - b.t);
      if (w.boss) {
        this.spawnQueue.push({ t: maxT + 3.5, type: w.boss, ent: w.bossEnt || this.mapDef.entrances[0].id, boss: true });
      }
      this.waveT = 0;
      this.log('第 ' + this.currentWaveNo() + ' / ' + this.totalWaves() + ' 波 · ' + this.waveNote, 'wave');
      this.emit('waveStart', { index: this.waveIndex, note: this.waveNote });
    }
    skipPrep() {
      if (this.waveState === 'prep') {
        this.compute += 8;
        this.log('提前接敌 +8 算力', 'sys');
        this.startWave();
      }
    }
    updateWave(dt) {
      if (this.scripted) return;
      if (this.waveState === 'prep') {
        this.prepTimer -= dt;
        if (this.prepTimer <= 0) this.startWave();
        return;
      }
      if (this.waveState === 'active') {
        this.waveT += dt;
        for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
          if (this.spawnQueue[i].t <= this.waveT) {
            const s = this.spawnQueue[i];
            this.spawnQueue.splice(i, 1);
            this.spawnEnemy(s.type, s.ent);
          }
        }
        if (!this.spawnQueue.length && !this.enemies.some(e => !e.dead)) {
          this.waveState = 'clear';
          const reward = 4 + Math.min(6, this.waveIndex);
          this.intel += reward; this.stats.intelEarned += reward;
          this.log('第 ' + this.currentWaveNo() + ' 波已清除 · 情报 +' + reward, 'ok');
          this.emit('waveClear', { index: this.waveIndex, reward });
          if (this.waveIndex >= this.waves.length - 1) { this.finishVictory(); return; }
          this.beginPrep(8);
        }
      }
    }
    finishVictory() {
      if (this.over || this.scripted) return;
      this.over = true; this.victory = true;
      this.log('全部波次已抵御 · 中枢完整度 ' + Math.round(this.integrity) + '%', 'ok');
      this.emit('victory', {});
    }
    finishDefeat() {
      if (this.over || this.scripted) return;
      this.over = true; this.victory = false;
      this.log('中枢完整度归零 · 汐域失守', 'bad');
      this.emit('defeat', {});
    }

    /* ---------------- economy ---------------- */
    addIntel(n, reason) {
      this.intel += n; this.stats.intelEarned += n;
      this.emit('resource', { intel: this.intel, compute: this.compute, reason });
    }
    addCompute(n, reason) {
      this.compute += n; this.stats.computeEarned += n;
      this.emit('resource', { intel: this.intel, compute: this.compute, reason });
    }

    /* ---------------- placement ---------------- */
    towerStats(t) {
      const def = D.TOWER_DEFS[t.defId];
      const lv = def.levels[t.level - 1] || def.levels[0];
      const s = Object.assign({}, lv);
      s.name = def.name; s.defId = def.id; s.cost = def.cost; s.skill = def.skill; s.cone = def.cone;
      s.armor = def.armor || 0; s.immuneEncrypt = !!def.immuneEncrypt;
      s.isolate = !!def.isolate;
      s.lureRadius = lv.lureRadius != null ? lv.lureRadius : def.lureRadius;
      s.lureCap = lv.lureCap != null ? lv.lureCap : def.lureCap;
      if (t.branch) {
        const b = (def.branches || []).find(x => x.id === t.branch);
        if (b) Object.assign(s, b);
      }
      if (t.defId === 'firewall' && t.skillUntil > this.time) s.block += 2;
      if (t.defId === 'interceptor' && t.skillUntil > this.time) { s.rate *= 3; s.range *= 1.15; }
      if (t.defId === 'repair' && t.skillUntil > this.time) s.heal *= 1.5;
      if (t.defId === 'sandbox' && t.skillUntil > this.time) s.detect *= 1.6;
      return s;
    }
    towerCost(defId, cell) {
      const def = D.TOWER_DEFS[defId];
      const cost = { compute: def.cost.compute || 0, intel: def.cost.intel || 0 };
      if (cell && cell.type === 'switch') {
        if (defId === 'firewall') cost.intel += 18;
        if (defId === 'netgap') cost.intel += 0;
      }
      return cost;
    }
    canPlace(defId, cell) {
      if (!cell) return { ok: false, reason: '无效位置' };
      if (this.over) return { ok: false, reason: '战斗已结束' };
      if (cell.tower) return { ok: false, reason: '该位置已有设备' };
      const def = D.TOWER_DEFS[defId];
      const layer = def.layer;
      if (layer === 'platform') {
        if (!cell.platform) return { ok: false, reason: '需要部署在设备平台' };
      } else if (layer === 'switch') {
        if (cell.type !== 'switch' || !cell.switch) return { ok: false, reason: '网闸只能部署在交换节点' };
      } else {
        if (!cell.walk || cell.type === 'entrance' || cell.type === 'exit') return { ok: false, reason: '不能部署在出入口' };
        if (cell.platform) return { ok: false, reason: '远程塔需部署在平台' };
      }
      if (cell.type === 'switch') {
        if (cell.isolation) return { ok: false, reason: '节点已处于隔离状态' };
        if (this.time < (cell.lastReiso || -99)) return { ok: false, reason: '节点正在路由收敛，' + Math.ceil(cell.lastReiso - this.time) + ' 秒后可再次隔离' };
        if (defId === 'honeypot') return { ok: false, reason: '蜜罐只能部署在链路' };
      }
      const cost = this.towerCost(defId, cell);
      if (this.compute < cost.compute) return { ok: false, reason: '算力不足（需要 ' + cost.compute + '）', cost };
      if (this.intel < cost.intel) return { ok: false, reason: '情报不足（需要 ' + cost.intel + '）', cost };
      if (cell.type === 'switch' && (defId === 'netgap' || defId === 'firewall')) {
        const blocked = new Set([KEY(cell.x, cell.y)]);
        const v = this.map.wouldSeal(blocked, this.enemies);
        if (v.sealed.length) return { ok: false, reason: '隔离后会封死入口 ' + v.sealed.join('、') + ' 的通路', cost, sealed: v.sealed };
        if (v.stuck.length) return { ok: false, reason: '有 ' + v.stuck.length + ' 个地面敌人将被封死', cost };
        if (this.enemies.some(e => !e.dead && e.cell === cell && !e.def.flying)) return { ok: false, reason: '节点正被敌人占用，无法隔离', cost };
      }
      return { ok: true, cost };
    }
    placeTower(defId, cell, opts) {
      opts = opts || {};
      const chk = this.canPlace(defId, cell);
      if (!chk.ok) return chk;
      const def = D.TOWER_DEFS[defId];
      this.compute -= chk.cost.compute;
      this.intel -= chk.cost.intel;
      const t = {
        id: 'T' + (uid++), defId, def, cell, level: 1, branch: null,
        hp: def.levels[0].hp, maxHp: def.levels[0].hp, shield: 0, encryptedUntil: 0,
        cooldown: 0, skillCd: 0, skillUntil: 0, aimAngle: 0, pitch: 0.1,
        facing: opts.facing != null ? opts.facing : 0, recoil: 0, blockedSet: new Set(), luredSet: new Set(),
        shieldTimer: 0, cleanseTimer: 0, kills: 0, damageDealt: 0, isNodeTower: cell.type === 'switch'
      };
      if (defId === 'netgap' || (defId === 'firewall' && cell.type === 'switch')) t.isolates = true;
      cell.tower = t;
      if (t.isolates) this.isolateCell(cell, { kind: 'tower', tower: t }, true);
      this.towers.push(t);
      this.stats.built++;
      if (this.world) {
        this.world.addTower(t);
        if (cell.node) this.world.updateSwitchView(cell);
      }
      this.emit('towerPlaced', { tower: t, cost: chk.cost });
      this.log('部署 ' + def.name + ' · ' + cell.x + ',' + cell.y + (t.isolates ? '（节点隔离）' : ''), 'build');
      if (window.AUDIO) AUDIO.sfx('build');
      if (t.isolates || cell.type === 'switch') this.applyRoutingChange('隔离 ' + (cell.switch ? cell.switch.name : '节点'));
      return { ok: true, tower: t, cost: chk.cost };
    }
    isolateCell(cell, info, silent) {
      cell.isolation = Object.assign({ started: this.time }, info);
      cell.lastReiso = this.time;
      if (this.world && cell.node) this.world.updateSwitchView(cell);
      this.emit('isolation', { cell, info });
    }
    releaseIsolation(cell, reason) {
      if (!cell.isolation) return;
      cell.isolation = null;
      cell.lastReiso = this.time + 12;
      if (cell.tower && (cell.tower.defId === 'netgap')) {
        // tower remains but no longer isolates
      }
      if (this.world && cell.node) this.world.updateSwitchView(cell);
      this.emit('isolationEnd', { cell, reason });
      this.applyRoutingChange('节点恢复直通');
    }
    upgradeCost(t) {
      const def = D.TOWER_DEFS[t.defId];
      return def.costLv2 || { compute: 100, intel: 25 };
    }
    canUpgrade(t) {
      if (!t || t.level >= 2) return { ok: false, reason: t && t.level >= 2 ? '已满级' : '无效设备' };
      const c = this.upgradeCost(t);
      if (this.compute < c.compute) return { ok: false, reason: '算力不足', cost: c };
      if (this.intel < c.intel) return { ok: false, reason: '情报不足', cost: c };
      return { ok: true, cost: c };
    }
    upgradeTower(t, branchId) {
      const chk = this.canUpgrade(t);
      if (!chk.ok) return chk;
      const def = D.TOWER_DEFS[t.defId];
      if (t.level === 1 && def.branches && def.branches.length && !branchId) {
        return { ok: false, needBranch: true, reason: '请选择升级分支' };
      }
      if (branchId && (!def.branches || !def.branches.some(b => b.id === branchId))) return { ok: false, reason: '无效分支' };
      this.compute -= chk.cost.compute; this.intel -= chk.cost.intel;
      const oldMax = t.maxHp;
      t.level = 2; t.branch = branchId || null;
      const st = this.towerStats(t);
      t.maxHp = st.hp;
      t.hp = Math.min(t.maxHp, t.hp + (t.maxHp - oldMax));
      if (this.world) { this.world.rebuildTower(t); if (t.cell.node) this.world.updateSwitchView(t.cell); }
      this.log('升级 ' + def.name + ' → Lv.2' + (branchId ? ' · ' + def.branches.find(b => b.id === branchId).name : ''), 'build');
      this.emit('towerUpgraded', { tower: t });
      if (window.AUDIO) AUDIO.sfx('upgrade');
      return { ok: true, tower: t };
    }
    sellTower(t) {
      if (!t) return { ok: false };
      const idx = this.towers.indexOf(t);
      if (idx < 0) return { ok: false, reason: '无效设备' };
      const cell = t.cell;
      const refund = Math.floor(D.TOWER_DEFS[t.defId].cost.compute * 0.6) + (t.level > 1 ? Math.floor(this.upgradeCost(t).compute * 0.35) : 0);
      this.towers.splice(idx, 1);
      cell.tower = null;
      this.releaseBlocked(cell);
      t.blockedSet.forEach(e => { if (e.blockedBy === t) { e.blockedBy = null; e.state = 'move'; } });
      t.luredSet.forEach(e => { if (e.luredBy === t) { e.luredBy = null; e.state = 'move'; } });
      if (t.isolates || cell.isolation) { cell.isolation = null; cell.lastReiso = this.time + 12; }
      this.compute += refund; this.stats.computeEarned += refund;
      if (this.world) { this.world.removeTower(t); if (cell.node) this.world.updateSwitchView(cell); }
      this.log('撤下 ' + D.TOWER_DEFS[t.defId].name + ' · 返还算力 +' + refund, 'sys');
      this.emit('towerSold', { tower: t, refund });
      if (window.AUDIO) AUDIO.sfx('sell');
      this.applyRoutingChange('撤下节点设备');
      return { ok: true, refund };
    }
    releaseBlocked(cell) {
      if (this.enemies) this.enemies.forEach(e => { if (e.blockedBy && e.blockedBy.cell === cell) { e.blockedBy.blockedSet.delete(e); e.blockedBy = null; e.state = 'move'; } });
    }

    /* ---------------- routing ---------------- */
    syncRoutes() {
      if (!this.world) return;
      const list = this.map.entrances.map(e => {
        const r = this.map.routes[e.id];
        return { id: e.id, color: e.color, cells: r ? r.cells : [], exitId: r ? r.exitId : '' };
      }).filter(r => r.cells && r.cells.length);
      this.world.setRoutes(list);
    }
    previewRoutes(extraCell) {
      const blocked = extraCell ? new Set([KEY(extraCell.x, extraCell.y)]) : new Set();
      const out = this.map.entrances.map(e => {
        const r = this.map.findPath(e.cell, { extraBlocked: blocked });
        return { id: e.id, color: e.color, cells: r ? r.path : [], exitId: r ? (r.exit.name || r.exit.ch) : '', ok: !!r };
      });
      const sealed = out.filter(o => !o.ok).map(o => o.id);
      return { routes: out, sealed };
    }
    applyRoutingChange(reason) {
      const changed = this.map.recomputeRoutes();
      this.stats.reroutes++;
      this.syncRoutes();
      this.rerouteEnemies();
      if (changed.length) {
        this.routeFlash = 2.4;
        changed.forEach(id => { this.routePulse[id] = this.time; });
        this.log('路由收敛 · ' + changed.join(' / ') + ' 改道', 'route');
        this.emit('routeChange', { changed, reason });
        if (window.AUDIO) AUDIO.sfx('route');
        const w = this.world;
        if (w) {
          changed.forEach((id, i) => {
            const e = this.map.entrances.find(x => x.id === id);
            if (e) {
              const p = w.cellCenter(e.cell, 0.4);
              w.effects.ring(p, parseInt(e.color.slice(1), 16), 7, { dur: 1.2 });
              w.effects.floatText(p.clone().add({ x: 0, y: 4, z: 0 }), id + ' 改道', 'route');
            }
          });
        }
      }
      this.emit('routesUpdated', { changed });
      return changed;
    }
    rerouteEnemies() {
      for (const e of this.enemies) {
        if (e.dead || e.def.flying) continue;
        if (e.blockedBy || e.luredBy) continue;
        if (e.mode === 'rush') continue;
        const r = this.map.findPath(e.cell);
        if (r) { e.path = r.path; e.pi = 1; e.exitId = r.exit.name || r.exit.ch; }
      }
    }

    /* ---------------- spawning / enemies ---------------- */
    scaledHp(def) {
      if (def.boss) return def.hp;
      return Math.round(def.hp * this.difficulty * (1 + Math.max(0, this.waveIndex) * 0.045));
    }
    spawnEnemy(typeId, entId, opts) {
      opts = opts || {};
      const def = D.ENEMY_DEFS[typeId];
      if (!def) return null;
      const ent = this.map.entrances.find(e => e.id === entId) || this.map.entrances[0];
      if (!ent) return null;
      const route = this.map.routes[ent.id];
      if (!route) return null;
      const e = {
        id: 'E' + (uid++), defId: typeId, def, def_name: def.name,
        maxHp: opts.hp || this.scaledHp(def), hp: opts.hp || this.scaledHp(def),
        shield: 0, cell: ent.cell, path: opts.path || route.cells.slice(), pi: 1,
        wx: ent.cell.wx, wz: ent.cell.wz, heading: 0, moving: true, dead: false,
        atkCd: 0, state: 'move', blockedBy: null, luredBy: null, revealed: !def.disguise,
        stolen: false, replicated: false, canReplicate: def.id === 'worm', slowUntil: 0, slowFactor: 0,
        stunUntil: 0, spawnedAt: this.time, bob: Math.random() * 6.28, lastRush: 0,
        phase: 0, phaseCount: 0, entId: ent.id, baseY: 0, heightOffset: 0, wy: 0,
        markedUntil: 0, intelReward: (def.id === 'packer' || def.id === 'boss_wankui' || def.id === 'boss_mirage' || def.id === 'boss_zheying') ? 3 : 0
      };
      if (def.flying) {
        const exit = opts.exit || this.map.exits[0];
        e.exitCell = exit.cell;
        e.fly = { x: ent.cell.wx, z: ent.cell.wz, tx: exit.cell.wx, tz: exit.cell.wz, exitId: exit.id };
        e.wx = ent.cell.wx; e.wz = ent.cell.wz;
        e.pi = 0; e.path = [ent.cell, exit.cell];
      } else if (!route.cells || route.cells.length < 2) {
        return null;
      }
      if (def.id === 'trojan' && opts.revealed) e.revealed = true;
      this.enemies.push(e);
      if (!this.seenTypes) this.seenTypes = new Set();
      if (!this.seenTypes.has(typeId)) {
        this.seenTypes.add(typeId);
        this.log('首次发现威胁实体 · ' + def.name, 'warn');
        this.emit('newThreat', { enemy: e, def });
      }
      if (this.world) this.world.addEnemy(e);
      if (def.boss) {
        this.activeBoss = e;
        this.log('威胁等级临界 · ' + def.name + ' 已进入 ' + ent.name, 'boss');
        this.emit('bossSpawn', { enemy: e });
        if (this.world) {
          const p = this.world.cellCenter(e.cell, 2.5);
          this.world.effects.shock(p, 0xff4d6d, 12);
          this.world.effects.warning(p.clone().setY(0.4), 0xff4d6d, CELL * 2.4, 'BOSS ' + def.name);
        }
        if (window.AUDIO) AUDIO.sfx('boss');
      }
      return e;
    }
    killEnemy(e, opts) {
      if (!e || e.dead) return;
      opts = opts || {};
      e.dead = true;
      const idx = this.enemies.indexOf(e);
      if (idx >= 0) this.enemies.splice(idx, 1);
      if (e.blockedBy) { e.blockedBy.blockedSet.delete(e); e.blockedBy = null; }
      if (e.luredBy) { e.luredBy.luredSet.delete(e); e.luredBy = null; }
      this.towers.forEach(t => { t.blockedSet.delete(e); t.luredSet.delete(e); });
      this.stats.kills++;
      const reward = e.def.reward || 5;
      this.compute += reward; this.stats.computeEarned += reward;
      if (e.intelReward) this.addIntel(e.intelReward, 'kill');
      if (e.def.boss) {
        this.stats.bossKills++;
        this.activeBoss = null;
        this.addIntel(18, 'boss');
        this.emit('bossKilled', { enemy: e });
        if (window.AUDIO) AUDIO.sfx('bossDown');
      }
      if (this.world) {
        const p = e.view ? e.view.position.clone() : this.world.cellCenter(e.cell, 1);
        const col = e.def.boss ? 0xff5a6e : (e.def.id === 'hotspot' ? 0xff4fd0 : (e.def.id === 'packer' ? 0x75d98b : 0xff7a5a));
        this.world.effects.burst(p, col, e.def.boss ? 90 : 16, { spread: e.def.boss ? 8 : 3, speed: e.def.boss ? 9 : 4, life: e.def.boss ? 1.4 : 0.7, size: e.def.boss ? 1.2 : 0.5 });
        this.world.effects.shock(p, col, e.def.boss ? 10 : 2.2);
        this.world.effects.floatText(p, '+' + reward + ' 算力', 'compute');
        this.world.removeEnemy(e);
      }
      if (window.AUDIO) AUDIO.sfx(e.def.boss ? 'explosionBig' : 'kill');
      this.emit('enemyKilled', { enemy: e, reward });
      this.checkWaveDoneSoon();
    }
    checkWaveDoneSoon() {
      if (this.waveState === 'active' && !this.spawnQueue.length && !this.enemies.some(x => !x.dead)) {
        // let updateWave handle transition on the next tick so effects can finish
        this.waveState = 'active';
      }
    }
    damageEnemy(e, amount, source, opts) {
      if (!e || e.dead) return;
      opts = opts || {};
      let dmg = amount;
      if (e.def.armor) dmg *= (1 - e.def.armor);
      if (e.markedUntil > this.time) dmg *= 1.25;
      if (e.luredBy && e.luredBy.branch === 'matrix') dmg *= 1.12;
      if (e.shield > 0) {
        const absorb = Math.min(e.shield, dmg);
        e.shield -= absorb; dmg -= absorb;
        if (this.world) this.world.effects.burst(e.view ? e.view.position : this.world.cellCenter(e.cell, 1), 0x9dffb4, 4, { spread: 1.5, speed: 2, life: 0.35, size: 0.35 });
      }
      if (dmg > 0) e.hp -= dmg;
      this.stats.damageDealt += amount;
      if (source && source.damageDealt != null) source.damageDealt += amount;
      if (this.time >= (e.nextFlashAt || 0)) { e.hitFlash = 0.1; e.nextFlashAt = this.time + 0.35; }
      this.checkTrojanPayload(e);
      if (this.world && e.view) {
        const col = dmg > 0 ? (e.shield > 0 ? '#9dffb4' : '#ffe1a0') : '#9dffb4';
        if (Math.random() < (opts.showText === false ? 0 : 0.35)) this.world.effects.floatText(e.view.position.clone().add({ x: 0, y: 1.4, z: 0 }), '-' + Math.round(amount * 10) / 10, 'damage');
      }
      if (e.hp <= 0) {
        if (e.def.boss) this.onBossDeath(e);
        else this.killEnemy(e);
      }
    }
    checkTrojanPayload(e) {
      if (e.hp <= 0 && e.def.id === 'trojan' && !e.revealed && !e._payloadDone) {
        e._payloadDone = true;
        this.towers.forEach(t => {
          const d = Math.hypot(t.cell.x - e.cell.x, t.cell.y - e.cell.y);
          if (d <= 2.1) this.damageTower(t, e.def.payload, e, { payload: true });
        });
        if (this.world) {
          this.world.effects.shock(e.view ? e.view.position : this.world.cellCenter(e.cell, 1), 0xffb04a, 5);
          this.world.effects.floatText(e.view ? e.view.position : this.world.cellCenter(e.cell, 1), '载荷释放', 'warning');
        }
        this.log('未显形木马被清除 · 释放载荷，附近设备受损', 'warn');
        if (window.AUDIO) AUDIO.sfx('payload');
      }
    }
    onBossDeath(e) {
      const p = this.world ? (e.view ? e.view.position.clone() : this.world.cellCenter(e.cell, 2)) : null;
      if (p && this.world) {
        this.world.effects.burst(p, 0xff6b8a, 140, { spread: 12, speed: 12, life: 1.8, size: 1.4 });
        this.world.effects.shock(p, 0xff6b8a, 16);
        this.world.effects.flash(p, 0xffffff, 12, 1.2);
      }
      if (window.AUDIO) AUDIO.sfx('bossDown');
      this.killEnemy(e);
      if (this.waveIndex >= this.waves.length - 1) {
        this.finishVictory();
      }
    }

    damageTower(t, amount, source, opts) {
      if (!t || t.hp <= 0) return;
      opts = opts || {};
      let dmg = amount;
      const st = this.towerStats(t);
      if (opts.payload) dmg *= 0.7;
      let reduction = 1 - (st.armor || 0);
      if (t.defId === 'firewall' && t.skillUntil > this.time) reduction *= 0.4;
      if (t.defId === 'netgap' && t.skillUntil > this.time) reduction *= 0.35;
      dmg *= reduction;
      if (t.shield > 0) {
        const a = Math.min(t.shield, dmg); t.shield -= a; dmg -= a;
      }
      if (t.defId === 'firewall' && t.skillUntil > this.time && source && source.def && !source.dead) {
        this.damageEnemy(source, amount * 0.25, t, { showText: false });
      }
      t.hp -= dmg; t.hitFlash = 0.1;
      if (this.world) {
        const p = this.world.cellCenter(t.cell, 1.6);
        this.world.effects.floatText(p, '-' + Math.round(amount), 'damage');
        if (Math.random() < 0.35) this.world.effects.burst(p, 0xffb457, 3, { spread: 1.5, speed: 2, life: 0.35, size: 0.35 });
      }
      if (t.hp <= 0) this.destroyTower(t, source);
    }
    destroyTower(t, source) {
      const idx = this.towers.indexOf(t);
      if (idx < 0) return;
      t.hp = 0;
      this.towers.splice(idx, 1);
      const cell = t.cell;
      cell.tower = null;
      if (t.isolates || cell.isolation) {
        cell.isolation = null; cell.lastReiso = this.time + 12;
        if (this.world && cell.node) this.world.updateSwitchView(cell);
      }
      t.blockedSet.forEach(e => { if (e.blockedBy === t) { e.blockedBy = null; e.state = 'move'; } });
      t.luredSet.forEach(e => { if (e.luredBy === t) { e.luredBy = null; e.state = 'move'; } });
      this.stats.towersLost++;
      if (this.world) {
        const p = this.world.cellCenter(cell, 1);
        this.world.effects.shock(p, 0xffb457, 4);
        this.world.effects.burst(p, 0xffcc88, 30, { spread: 4, speed: 5, life: 1, size: 0.6 });
        this.world.removeTower(t);
        if (cell.node) this.world.updateSwitchView(cell);
      }
      this.log(D.TOWER_DEFS[t.defId].name + ' 被摧毁 · ' + (t.isolates ? '节点隔离解除' : '防线出现缺口'), 'bad');
      this.emit('towerDestroyed', { tower: t });
      if (window.AUDIO) AUDIO.sfx('explosion');
      this.applyRoutingChange('节点设备被摧毁');
    }

    /* ---------------- items / skills ---------------- */
    itemReady(id) {
      return (this.itemCooldowns[id] || 0) <= this.time;
    }
    canUseItem(id, target) {
      const def = D.ITEM_DEFS[id];
      if (!def) return { ok: false, reason: '无效道具' };
      if (!this.itemReady(id)) return { ok: false, reason: '冷却中 ' + Math.ceil((this.itemCooldowns[id] || 0) - this.time) + 's' };
      if (this.compute < def.cost.compute) return { ok: false, reason: '算力不足' };
      if (this.intel < def.cost.intel) return { ok: false, reason: '情报不足' };
      if (id === 'isolator') {
        if (!target || target.type !== 'switch') return { ok: false, reason: '目标必须是交换节点' };
        if (target.isolation) return { ok: false, reason: '节点已隔离' };
        if (this.time < (target.lastReiso || -99)) return { ok: false, reason: '节点正在路由收敛' };
        const blocked = new Set([KEY(target.x, target.y)]);
        const v = this.map.wouldSeal(blocked, this.enemies);
        if (v.sealed.length) return { ok: false, reason: '会封死入口 ' + v.sealed.join('、') };
        if (v.stuck.length) return { ok: false, reason: '有敌人位于节点上' };
        if (this.enemies.some(e => !e.dead && e.cell === target && !e.def.flying)) return { ok: false, reason: '节点正被敌人占用' };
      }
      if (id === 'downgrade') {
        if (!target) return { ok: false, reason: '请选择投放位置' };
        if (!target.walk) return { ok: false, reason: '只能投放在链路上' };
      }
      if (id === 'backup') {
        if (!target || !target.tower) return { ok: false, reason: '请选择一座塔' };
      }
      return { ok: true };
    }
    useItem(id, target) {
      const def = D.ITEM_DEFS[id];
      const chk = this.canUseItem(id, target);
      if (!chk.ok) return chk;
      this.compute -= def.cost.compute; this.intel -= def.cost.intel;
      this.itemCooldowns[id] = this.time + def.cd;
      if (id === 'isolator') {
        this.isolateCell(target, { kind: 'item', hp: def.hp, maxHp: def.hp, until: this.time + def.duration });
        if (this.world) {
          const p = this.world.cellCenter(target, 0.8);
          this.world.effects.shock(p, 0xffce6a, 4.5);
          this.world.effects.warning(p.clone().setY(0.5), 0xffce6a, CELL * 1.4, '应急隔离');
        }
        this.log('应急隔离器已投放 · ' + (target.switch ? target.switch.name : '节点') + ' 临时隔离 ' + def.duration + 's', 'warn');
        this.applyRoutingChange('应急隔离');
      } else if (id === 'downgrade') {
        const affected = [];
        for (const c of this.map.cells) {
          if (!c.walk) continue;
          if (Math.hypot(c.x - target.x, c.y - target.y) <= def.radius + 0.35) {
            c.downUntil = this.time + def.duration;
            affected.push(c);
          }
        }
        if (this.world) {
          affected.forEach(c => {
            const p = this.world.cellCenter(c, 0.6);
            this.world.effects.ring(p, 0xff9c6b, CELL * 0.7, { dur: 1.1 });
          });
          const p = this.world.cellCenter(target, 1);
          this.world.effects.shock(p, 0xff9c6b, def.radius * CELL);
        }
        this.enemies.forEach(e => { if (!e.def.flying && affected.includes(e.cell)) this.revealEnemy(e, '协议降级'); });
        this.log('协议降级生效 · ' + affected.length + ' 格链路进入旧协议 ' + def.duration + 's', 'warn');
        this.applyRoutingChange('协议降级');
      } else if (id === 'backup') {
        const t = target.tower;
        t.hp = Math.min(t.maxHp, t.hp + t.maxHp * def.heal);
        t.encryptedUntil = 0;
        if (this.world) {
          const p = this.world.cellCenter(t.cell, 2);
          this.world.effects.beam(p.clone().add({ x: 0, y: 6, z: 0 }), p, 0x9dffb4, { width: 0.12, life: 0.5 });
          this.world.effects.burst(p, 0x9dffb4, 20, { spread: 3, speed: 3, life: 0.7, size: 0.5 });
          this.world.effects.floatText(p, '备份还原', 'heal');
        }
        this.log('备份还原 · ' + D.TOWER_DEFS[t.defId].name + ' 恢复生命并解除加密', 'ok');
      }
      this.emit('itemUsed', { id, target });
      if (window.AUDIO) AUDIO.sfx(id === 'backup' ? 'heal' : 'item');
      return { ok: true };
    }
    useSkill(t) {
      if (!t || !D.TOWER_DEFS[t.defId].skill) return { ok: false, reason: '无主动技能' };
      if (t.encryptedUntil > this.time) return { ok: false, reason: '设备处于加密状态' };
      const sk = D.SKILLS[D.TOWER_DEFS[t.defId].skill];
      if (!sk) return { ok: false };
      if (t.skillCd > this.time) return { ok: false, reason: '技能冷却 ' + Math.ceil(t.skillCd - this.time) + 's' };
      t.skillCd = this.time + sk.cd;
      t.skillUntil = this.time + sk.dur;
      const p = this.world ? this.world.cellCenter(t.cell, 1.6) : null;
      if (t.defId === 'honeypot') {
        t.luredSet.forEach(e => { e.stunUntil = Math.max(e.stunUntil, this.time + sk.dur); e.markedUntil = this.time + sk.dur; });
        if (this.world && p) { this.world.effects.ring(p, 0xff8ad8, CELL * 3.5, { dur: 1.2 }); this.world.effects.shock(p, 0xff8ad8, 4); }
      } else if (t.defId === 'repair') {
        let n = 0;
        this.towers.forEach(o => {
          if (o === t || n >= 4) return;
          const d = Math.hypot(o.cell.x - t.cell.x, o.cell.y - t.cell.y);
          if (d <= 5) {
            o.shield = Math.max(o.shield, 130); o.encryptedUntil = 0; n++;
            if (this.world) {
              const q = this.world.cellCenter(o.cell, 1.5);
              this.world.effects.ring(q, 0x9dff9d, 3, { dur: 1.4 });
              this.world.effects.burst(q, 0x9dff9d, 12, { spread: 2, speed: 2.4, life: 0.8, size: 0.4 });
            }
          }
        });
        if (this.world && p) this.world.effects.shock(p, 0x9dff9d, 8);
      } else if (t.defId === 'sandbox') {
        this.enemies.forEach(e => { if (!e.dead && !e.def.flying && Math.hypot(e.cell.x - t.cell.x, e.cell.y - t.cell.y) <= 6) e.markedUntil = this.time + sk.dur; });
      } else if (t.defId === 'interceptor') {
        if (this.world && p) this.world.effects.flash(p, 0x7fb4ff, 3, 0.3);
      } else if (t.defId === 'firewall') {
        if (this.world && p) this.world.effects.ring(p, 0x57e0ff, 4, { dur: 0.8 });
      } else if (t.defId === 'netgap') {
        if (this.world && p) this.world.effects.ring(p, 0x8df5b8, 5, { dur: 1.0 });
      }
      if (this.world && p) {
        this.world.effects.floatText(p.clone().add({ x: 0, y: 2.4, z: 0 }), sk.name, 'skill');
        this.world.effects.burst(p, parseInt(D.TOWER_DEFS[t.defId].color.slice(1), 16), 18, { spread: 3, speed: 3, life: 0.8, size: 0.55 });
      }
      this.log(sk.name + ' 已启动 · ' + D.TOWER_DEFS[t.defId].name, 'skill');
      this.emit('skillUsed', { tower: t, skill: sk });
      if (window.AUDIO) AUDIO.sfx('skill');
      return { ok: true };
    }

    revealEnemy(e, reason) {
      if (!e || e.revealed) return;
      e.revealed = true;
      this.emit('revealed', { enemy: e, reason });
      if (this.world && e.view) {
        this.world.effects.burst(e.view.position.clone().add({ x: 0, y: 1, z: 0 }), 0x5ff0d2, 16, { spread: 2, speed: 2.5, life: 0.7, size: 0.45 });
        this.world.effects.floatText(e.view.position.clone().add({ x: 0, y: 2, z: 0 }), '显形', 'detect');
      }
      if (window.AUDIO) AUDIO.sfx('reveal');
    }

    /* ---------------- enemy update ---------------- */
    enemySpeed(e) {
      let s = e.def.speed;
      if (this.map.isSlow(e.cell)) s *= 0.55;
      if (e.slowUntil > this.time) s *= (1 - (e.slowFactor || 0));
      if (e.def.boss) s *= (e.phase >= 1 && e.defId === 'boss_zheying') ? 1.2 : 1;
      return s;
    }
    updateEnemy(e, dt) {
      if (e.dead) return;
      if (e.stunUntil > this.time) { e.moving = false; return; }
      const def = e.def;
      // stealth reveal on old links
      if (def.disguise && !e.revealed && this.map.isSlow(e.cell)) this.revealEnemy(e, '旧链路');
      // packer aura
      if (def.id === 'packer') {
        e.shieldCd = (e.shieldCd || 3) - dt;
        if (e.shieldCd <= 0) {
          e.shieldCd = 3.6;
          this.enemies.forEach(o => {
            if (o.dead || o === e || o.def.boss) return;
            if (Math.hypot(o.cell.x - e.cell.x, o.cell.y - e.cell.y) <= 3.8) {
              const before = o.shield;
              o.shield = Math.max(o.shield, 85);
              if (o.shield > before && this.world && o.view) this.world.effects.ring(o.view.position, 0x8dffc0, 1.6, { dur: 0.5 });
            }
          });
          e.shield = Math.max(e.shield, 90);
          if (this.world) this.world.effects.ring(e.view ? e.view.position : this.world.cellCenter(e.cell, 1), 0x8dffc0, 4, { dur: 0.8 });
        }
      }
      // flood node rush
      if (def.nodeRush && !e.blockedBy && !e.luredBy && e.mode !== 'rush') {
        e.rushCd = (e.rushCd || 2.5) - dt;
        if (e.rushCd <= 0) {
          e.rushCd = 4.5;
          const node = this.findRushTarget(e);
          if (node) {
            const target = this.map.findPath(e.cell, { toCell: this.map.neighbors(node) });
            if (target) { e.mode = 'rush'; e.rushNode = node; e.rushPath = target.path; e.path = target.path; e.pi = 1; e.rushAtk = 0; }
          }
        }
      }
      if (e.mode === 'rush') {
        if (!e.rushNode || !e.rushNode.isolation) { e.mode = 'move'; const r = this.map.findPath(e.cell); if (r) { e.path = r.path; e.pi = 1; } }
      }
      // ranged attack (ransomware) and boss tower attacks
      if (def.ranged || def.boss) this.updateRangedAttacker(e, dt);
      // blocked/lured attack
      if (e.blockedBy) {
        if (!this.towers.includes(e.blockedBy) || e.blockedBy.hp <= 0) { e.blockedBy = null; e.state = 'move'; }
        else {
          e.moving = false;
          e.atkCd -= dt;
          if (e.atkCd <= 0) { e.atkCd = def.attackInterval; this.enemyHitTower(e, e.blockedBy); }
          return;
        }
      }
      if (e.luredBy) {
        if (!this.towers.includes(e.luredBy) || e.luredBy.hp <= 0) { e.luredBy = null; e.state = 'move'; }
        else {
          e.moving = false;
          e.atkCd -= dt;
          if (e.atkCd <= 0) { e.atkCd = def.attackInterval; this.enemyHitTower(e, e.luredBy, true); }
          return;
        }
      }
      if (e.mode === 'rush' && e.rushNode) {
        const node = e.rushNode;
        if (!node.isolation || !this.map.isBlockedCell(node)) { e.mode = 'move'; return; }
        const d = Math.hypot(e.wx - node.wx, e.wz - node.wz);
        if (e.pi >= e.path.length || d <= CELL * 1.25) {
          e.moving = false;
          e.atkCd -= dt;
          if (e.atkCd <= 0) {
            e.atkCd = def.attackInterval;
            this.floodSlam(e, node);
          }
          return;
        }
      }
      // movement
      if (def.flying) { this.flyEnemy(e, dt); return; }
      if (e.pi >= e.path.length) { this.leak(e); return; }
      const next = e.path[e.pi];
      if (!next) { this.leak(e); return; }
      // blocking check
      if (next.tower && next.tower.defId === 'firewall') {
        const tower = next.tower;
        const st = this.towerStats(tower);
        let usedCap = 0;
        tower.blockedSet.forEach(o => { usedCap += (o.def.block || 1); });
        if (usedCap + (e.def.block || 1) <= (st.block || 0)) {
          tower.blockedSet.add(e); e.blockedBy = tower; e.state = 'blocked'; e.moving = false;
          if (e.def.disguise) this.revealEnemy(e, '阻挡');
          e.atkCd = Math.min(def.attackInterval, 0.4);
          if (this.world) this.world.effects.ring(this.world.cellCenter(next, 0.4), 0xffb457, 2.2, { dur: 0.5 });
          return;
        }
      }
      const dist = Math.hypot(next.wx - e.wx, next.wz - e.wz);
      const step = this.enemySpeed(e) * CELL * dt;
      e.moving = true;
      if (dist <= step) {
        e.wx = next.wx; e.wz = next.wz; e.cell = next; e.pi++;
        if (this.map.isSlow(next)) { if (e.def.disguise) this.revealEnemy(e, '旧链路'); }
        if (next.type === 'switch' && !next.isolation) this.onSwitchPass(e, next);
        if (next.type === 'exit') { this.leak(e); return; }
      } else {
        const nx = (next.wx - e.wx) / dist, nz = (next.wz - e.wz) / dist;
        e.wx += nx * step; e.wz += nz * step;
        e.heading = Math.atan2(nx, nz);
      }
      // hovering height for ground enemies over roads
      e.wy = 0.1;
    }
    onSwitchPass(e, cell) {
      if (e.defId !== 'worm' || !e.canReplicate || e.replicated) return;
      if (this.enemies.filter(x => x.defId === 'worm').length > 38) return;
      e.replicated = true;
      const ent = this.map.entrances.find(x => x.id === e.entId);
      const copy = this.spawnEnemy('worm', e.entId, {});
      if (copy) {
        copy.cell = cell; copy.wx = cell.wx; copy.wz = cell.wz; copy.hp *= 0.7; copy.maxHp *= 0.7;
        copy.replicated = true; copy.canReplicate = false; copy.revealed = true;
        const croute = this.map.routes[e.entId];
        if (croute) { copy.path = croute.cells.slice(); const idx = croute.cells.indexOf(cell); copy.pi = Math.max(1, idx + 1); }
        if (this.world && copy.view) { copy.view.position.set(cell.wx, 0.15, cell.wz); }
        this.log('蠕虫在 ' + (cell.switch ? cell.switch.name : '交换节点') + ' 完成复制', 'warn');
        this.emit('wormCopy', { enemy: copy });
        if (this.world) this.world.effects.burst(this.world.cellCenter(cell, 0.8), 0xff5468, 12, { spread: 2, speed: 2, life: 0.6, size: 0.4 });
      }
    }
    flyEnemy(e, dt) {
      const f = e.fly;
      const dx = f.tx - e.wx, dz = f.tz - e.wz;
      const d = Math.hypot(dx, dz);
      const step = (e.slowUntil > this.time ? e.def.speed * (1 - e.slowFactor) : e.def.speed) * CELL * dt;
      e.moving = true;
      if (d <= step + 1) { this.leak(e); return; }
      e.wx += dx / d * step; e.wz += dz / d * step;
      e.heading = Math.atan2(dx, dz);
    }
    spawnAdd(type, cell, opts) {
      opts = opts || {};
      if (!cell || !cell.walk) return null;
      const ent = this.map.entrances.find(x => x.id === opts.entId) || this.map.entrances[0];
      const e = this.spawnEnemy(type, ent.id, opts);
      if (!e) return null;
      const r = this.map.findPath(cell);
      e.cell = cell;
      e.path = r ? r.path : [cell];
      e.pi = 1;
      e.wx = cell.wx + (opts.offX || 0);
      e.wz = cell.wz + (opts.offZ || 0);
      e.entId = ent.id;
      if (e.view) { e.view.position.set(e.wx, 0.15, e.wz); }
      return e;
    }
    findRushTarget(e) {
      let best = null, bd = 1e9;
      this.map.switches.forEach(s => {
        if (!s.cell.isolation) return;
        const d = Math.hypot(s.cell.x - e.cell.x, s.cell.y - e.cell.y);
        if (d < 6.5 && d < bd) { bd = d; best = s.cell; }
      });
      return best;
    }
    floodSlam(e, node) {
      this.map.neighbors(node).forEach(c => {
        if (c.tower && (c.tower.isolates || c.tower.hp > 0)) { /* noop */ }
      });
      const tower = node.tower || (node.isolation && node.isolation.tower);
      if (node.isolation && node.isolation.kind === 'item') {
        node.isolation.hp -= 55;
        if (this.world) {
          const p = this.world.cellCenter(node, 0.6);
          this.world.effects.shock(p, 0xffb457, 4);
          this.world.effects.floatText(p, '隔离器 -55', 'damage');
        }
        if (node.isolation.hp <= 0) {
          this.log('应急隔离器被洪泛团冲毁 · 节点恢复直通', 'bad');
          this.releaseIsolation(node, 'destroyed');
        }
      } else if (tower) {
        this.damageTower(tower, 58, e, {});
        if (this.world) {
          const p = this.world.cellCenter(node, 0.6);
          this.world.effects.shock(p, 0xff7a45, 4.2);
          this.world.effects.lightning(p, p.clone().add({ x: (Math.random() - 0.5) * 3, y: 3, z: (Math.random() - 0.5) * 3 }), 0xff7a45, {});
        }
      }
      if (this.world) {
        const p = e.view ? e.view.position.clone() : this.world.cellCenter(e.cell, 0.8);
        this.world.effects.ring(p, 0xff7a45, 3, { dur: 0.5 });
      }
      if (window.AUDIO) AUDIO.sfx('slam');
      if (!node.isolation) { e.mode = 'move'; const r = this.map.findPath(e.cell); if (r) { e.path = r.path; e.pi = 1; } }
    }
    updateRangedAttacker(e, dt) {
      e.rangedCd = (e.rangedCd || 0.6) - dt;
      if (e.rangedCd > 0) return;
      const range = (e.def.reach || 3) * CELL;
      let best = null, bd = 1e9;
      this.towers.forEach(t => {
        if (!t || t.hp <= 0) return;
        const d = Math.hypot(t.cell.x - e.cell.x, t.cell.y - e.cell.y) * CELL;
        if (d > range) return;
        let score = d;
        if (t.defId === 'honeypot') score -= 1000;
        if (score < bd) { bd = score; best = t; }
      });
      if (!best) return;
      e.rangedCd = e.def.attackInterval;
      const from = this.world ? (e.view ? e.view.position.clone().add({ x: 0, y: 1, z: 0 }) : this.world.cellCenter(e.cell, 1.5)) : null;
      const to = this.world ? this.world.cellCenter(best.cell, 1.3) : null;
      if (this.world && from) {
        if (e.def.ranged) {
          this.world.effects.beam(from, to, 0xc45bff, { width: 0.07, life: 0.18 });
          this.world.effects.burst(to, 0xc45bff, 5, { spread: 1.6, speed: 1.8, life: 0.4, size: 0.35 });
        } else if (e.def.boss) {
          this.world.effects.lightning(from, to, 0xff5a6e, { life: 0.18 });
        }
      }
      this.damageTower(best, e.def.dmg * (e.weakenUntil > this.time ? 0.8 : 1), e, {});
      if (e.def.encrypt) {
        if (!this.towerStats(best).immuneEncrypt && !(best.shield > 0) && best.encryptedUntil < this.time) {
          best.encryptedUntil = this.time + e.def.encrypt;
          if (this.world) this.world.effects.floatText(to, '已加密', 'encrypt');
          if (window.AUDIO) AUDIO.sfx('encrypt');
          this.emit('encrypted', { tower: best, duration: e.def.encrypt });
        }
      }
      if (window.AUDIO) AUDIO.sfx('rangedHit');
    }
    enemyHitTower(e, t, rangedLure) {
      const from = this.world ? (e.view ? e.view.position.clone().add({ x: 0, y: 0.8, z: 0 }) : this.world.cellCenter(e.cell, 1)) : null;
      const to = this.world ? this.world.cellCenter(t.cell, 1.4) : null;
      if (this.world && from) {
        if (rangedLure) {
          this.world.effects.beam(from, to, 0xff8ad8, { width: 0.06, life: 0.2 });
        } else {
          this.world.effects.lightning(from, to, 0xffb457, { life: 0.12 });
          this.world.effects.burst(to, 0xffb457, 3, { spread: 1.4, speed: 1.5, life: 0.3, size: 0.3 });
        }
      }
      this.damageTower(t, e.def.dmg * (e.markedUntil > this.time ? 1.2 : 1) * (e.weakenUntil > this.time ? 0.8 : 1), e, {});
      if (window.AUDIO) AUDIO.sfx('meleeHit');
    }
    leak(e) {
      if (e.dead) return;
      e.dead = true;
      const idx = this.enemies.indexOf(e);
      if (idx >= 0) this.enemies.splice(idx, 1);
      this.towers.forEach(t => { t.blockedSet.delete(e); t.luredSet.delete(e); });
      const dmg = e.def.integrity || 10;
      this.integrity = Math.max(this.scripted ? 20 : 0, this.integrity - dmg);
      this.stats.leaks++;
      if (this.world) {
        const gv = this.world.gateViews[e.def.flying ? (this.mapDef.exits[0].id) : (e.exitId || this.mapDef.exits[0].id)] || Object.values(this.world.gateViews).find(x => x.core);
        if (gv) {
          this.world.effects.shock(gv.group.position.clone().add({ x: 0, y: 3, z: 0 }), 0xff4d6d, 7);
          this.world.effects.burst(gv.group.position.clone().add({ x: 0, y: 3, z: 0 }), 0xff4d6d, 40, { spread: 6, speed: 6, life: 1.0, size: 0.8 });
        }
        this.world.effects.floatText(this.world.cellCenter(e.cell, 2), '中枢 -' + dmg, 'warning');
        this.world.effects.warning(this.world.cellCenter(e.cell, 0), 0xff4d6d, 4, '中枢受损');
      }
      this.log(e.def.name + ' 抵达出口 · 中枢完整度 -' + dmg + '%', 'bad');
      this.emit('leak', { enemy: e, damage: dmg });
      if (window.AUDIO) AUDIO.sfx('leak');
      if (this.world) this.world.removeEnemy(e);
      if (this.integrity <= 0) this.finishDefeat();
    }

    /* ---------------- tower combat ---------------- */
    validTarget(t, e, st) {
      if (!e || e.dead) return false;
      if (e.def.flying && t.defId !== 'interceptor') return false;
      if (!e.revealed && (t.defId === 'interceptor' || t.defId === 'firewall')) return false;
      const dx = e.wx - t.cell.wx, dz = e.wz - t.cell.wz;
      const d = Math.hypot(dx, dz);
      if (d > (st.range || 2) * CELL) return false;
      if (t.defId === 'interceptor') {
        let ang = Math.atan2(dx, dz) - t.facing;
        while (ang > Math.PI) ang -= Math.PI * 2;
        while (ang < -Math.PI) ang += Math.PI * 2;
        if (Math.abs(ang) > (st.cone || 42) * Math.PI / 180) return false;
      }
      return true;
    }
    pickTarget(t, st, filter) {
      let best = null, bi = -Infinity;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (filter && !filter(e)) continue;
        if (!this.validTarget(t, e, st)) continue;
        const remaining = e.path ? (e.path.length - e.pi) : 99;
        const score = -remaining * 10 + (e.def.boss ? 500 : 0) + (e.shield > 0 ? -0.2 : 0);
        if (score > bi) { bi = score; best = e; }
      }
      return best;
    }
    towerPosition(t) { return { x: t.cell.wx, z: t.cell.wz }; }
    updateTower(t, dt) {
      if (t.hp <= 0) return;
      const st = this.towerStats(t);
      if (t.encryptedUntil > this.time) {
        t.aimAngle = t.aimAngle || 0;
        return;
      }
      t.cooldown -= dt;
      // per-type passive
      if (t.defId === 'repair') { this.towerHeal(t, st, dt); return; }
      if (t.defId === 'honeypot') { t.cooldown = 0; return; }
      if (t.defId === 'netgap') {
        if (t.level >= 2) {
          t.shieldTimer = (t.shieldTimer || 0) + dt;
          if (t.shieldTimer > 8) { t.shieldTimer = 0; t.shield = Math.min(140, t.shield + 70); if (this.world) this.world.effects.ring(this.world.cellCenter(t.cell, 1), 0x8df5b8, 3, { dur: 0.6 }); }
        }
        return;
      }
      if (t.defId === 'sandbox') { this.sandboxTick(t, st, dt); return; }
      if (t.cooldown > 0) return;
      let target = this.pickTarget(t, st);
      if (!target) return;
      t.cooldown = 1 / (st.rate || 1);
      this.fireTower(t, st, target);
    }
    towerHeal(t, st, dt) {
      let best = null, br = 1;
      this.towers.forEach(o => {
        if (o === t || o.hp >= o.maxHp) return;
        const d = Math.hypot(o.cell.x - t.cell.x, o.cell.y - t.cell.y);
        if (d > (st.healRange || 4)) return;
        const r = o.hp / o.maxHp;
        if (r < br) { br = r; best = o; }
      });
      t.cleanseTimer = (t.cleanseTimer || 0) + dt;
      if (t.level >= 2 && t.cleanseTimer > 5) {
        t.cleanseTimer = 0;
        const enc = this.towers.find(o => o.encryptedUntil > this.time && Math.hypot(o.cell.x - t.cell.x, o.cell.y - t.cell.y) <= (st.healRange || 4));
        if (enc) { enc.encryptedUntil = 0; this.log('修复进程解除 ' + D.TOWER_DEFS[enc.defId].name + ' 的加密', 'ok'); if (this.world) this.world.effects.floatText(this.world.cellCenter(enc.cell, 2.2), '已解密', 'heal'); }
      }
      if (best) {
        const heal = (st.heal || 15) * dt * (t.skillUntil > this.time ? 1.5 : 1);
        best.hp = Math.min(best.maxHp, best.hp + heal);
        t.healTick = (t.healTick || 0) + dt;
        if (t.healTick > 0.45) {
          t.healTick = 0;
          if (this.world) {
            const a = this.world.cellCenter(t.cell, 2);
            const b = this.world.cellCenter(best.cell, 1.6);
            this.world.effects.beam(a, b, 0x9dff9d, { width: 0.06, life: 0.35, opacity: 0.7 });
            this.world.effects.burst(b, 0x9dff9d, 3, { spread: 1, speed: 1.2, life: 0.5, size: 0.3 });
            this.world.effects.floatText(b, '+' + Math.round((st.heal || 15) * 0.45), 'heal');
          }
        }
      }
    }
    sandboxTick(t, st, dt) {
      // detection
      const det = (st.detect || 3.6) * CELL;
      this.enemies.forEach(e => {
        if (e.dead || e.def.flying) return;
        if (!e.revealed && Math.hypot(e.wx - t.cell.wx, e.wz - t.cell.wz) <= det) this.revealEnemy(e, '沙箱检测');
      });
      if (t.cooldown > 0) return;
      let best = null, bestN = 0;
      for (const e of this.enemies) {
        if (e.dead || e.def.flying) continue;
        if (Math.hypot(e.wx - t.cell.wx, e.wz - t.cell.wz) > (st.range || 3.2) * CELL) continue;
        let n = 0;
        for (const o of this.enemies) if (!o.dead && !o.def.flying && Math.hypot(o.wx - e.wx, o.wz - e.wz) <= (st.aoe || 2.2) * CELL) n++;
        if (n > bestN) { bestN = n; best = e; }
      }
      if (!best) return;
      t.cooldown = 1 / (st.rate || 1);
      t.aimAngle = Math.atan2(best.wx - t.cell.wx, best.wz - t.cell.wz);
      const center = { x: best.wx, z: best.wz };
      const r = (st.aoe || 2.2) * CELL;
      this.enemies.slice().forEach(e => {
        if (e.dead || e.def.flying) return;
        if (Math.hypot(e.wx - center.x, e.wz - center.z) <= r) this.damageEnemy(e, st.dmg, t, {});
      });
      if (this.world) {
        const p = new THREE.Vector3(center.x, 0.5, center.z);
        this.world.effects.ring(p, 0x5ff0d2, r, { dur: 0.6 });
        this.world.effects.beam(this.world.cellCenter(t.cell, 2.2), p.clone().setY(1), 0x5ff0d2, { width: 0.07, life: 0.2 });
        this.world.effects.burst(p, 0x5ff0d2, 10, { spread: 3, speed: 2, life: 0.5, size: 0.4 });
      }
      if (window.AUDIO) AUDIO.sfx('sandbox');
    }
    fireTower(t, st, target) {
      const from = this.world ? this.world.cellCenter(t.cell, t.cell.platform ? 2.1 : 1.9) : null;
      t.aimAngle = Math.atan2(target.wx - t.cell.wx, target.wz - t.cell.wz);
      t.recoil = 1;
      if (!this.world) { this.damageEnemy(target, st.dmg, t, {}); return; }
      const to = target.view ? target.view.position.clone().add({ x: 0, y: target.def.boss ? 2 : 0.9, z: 0 }) : this.world.cellCenter(target.cell, 1);
      const color = D.TOWER_DEFS[t.defId].color;
      const colNum = parseInt(color.slice(1), 16);
      // Damage resolves immediately in simulation time; the projectile is a
      // purely cosmetic tracer so that 2x/3x speed and video export stay in sync.
      if (t.defId === 'interceptor') {
        this.damageEnemy(target, st.dmg, t, {});
        if (t.branch === 'suppress' && !target.dead) {
          target.slowUntil = this.time + (st.slowTime || 2.5); target.slowFactor = st.slow || 0.35;
          target.weakenUntil = this.time + (st.slowTime || 2.5); target.weakenFactor = 0.2;
        }
        if (t.branch === 'pierce') {
          let n = 1;
          this.enemies.forEach(o => {
            if (o === target || o.dead || n >= (st.pierce || 3)) return;
            if (Math.hypot(o.wx - target.wx, o.wz - target.wz) < CELL * 1.1) { this.damageEnemy(o, st.dmg * 0.65, t, {}); n++; }
          });
          this.world.effects.beam(from, to, 0x9fd0ff, { width: 0.07, life: 0.12, opacity: 0.7 });
        }
        this.world.effects.flash(from, 0xbfe4ff, 1.8, 0.1);
        this.world.effects.projectile(from, to, {
          color: t.branch === 'suppress' ? 0xffe08a : 0x9fd0ff, size: 0.17, speed: 38,
          onHit: () => {
            this.world.effects.burst(to, 0x9fd0ff, 5, { spread: 1.4, speed: 2, life: 0.3, size: 0.28 });
            if (t.branch === 'suppress') this.world.effects.ring(to, 0xffe08a, 2, { dur: 0.45 });
          }
        });
        if (window.AUDIO) AUDIO.sfx('interceptor');
      } else if (t.defId === 'firewall') {
        this.damageEnemy(target, st.dmg, t, {});
        this.world.effects.projectile(from, to, {
          color: 0x57e0ff, size: 0.14, speed: 30, arc: 0.6,
          onHit: () => { this.world.effects.burst(to, 0xffd28a, 5, { spread: 1.5, speed: 2, life: 0.35, size: 0.3 }); }
        });
        if (window.AUDIO) AUDIO.sfx('firewall');
      } else {
        this.damageEnemy(target, st.dmg, t, {});
      }
    }
    updateLures(dt) {
      this.towers.forEach(t => {
        if (t.defId !== 'honeypot' || t.hp <= 0) return;
        const st = this.towerStats(t);
        const radius = (st.lureRadius || 3.2) * CELL;
        const cap = st.lureCap || 3;
        if (t.luredSet.size >= cap) return;
        for (const e of this.enemies) {
          if (e.dead || e.luredBy || e.blockedBy || e.def.flying || e.def.boss) continue;
          if (!(e.def.dmg > 0)) continue;
          if (Math.hypot(e.wx - t.cell.wx, e.wz - t.cell.wz) > radius) continue;
          t.luredSet.add(e); e.luredBy = t; e.state = 'lured'; e.moving = false;
          if (e.def.disguise) this.revealEnemy(e, '诱捕');
          if (this.world) this.world.effects.beam(this.world.cellCenter(t.cell, 2), e.view ? e.view.position.clone().add({ x: 0, y: 1, z: 0 }) : this.world.cellCenter(e.cell, 1), 0xff8ad8, { width: 0.05, life: 0.4 });
          if (t.luredSet.size >= cap) break;
        }
        // snare branch dot
        if (st.dot) {
          t.luredSet.forEach(e => { if (!e.dead) this.damageEnemy(e, st.dot * dt, t, { showText: false }); });
        }
      });
      // lured enemy must remain in range? lure holds until death; release if far > 1.5x radius
      this.enemies.forEach(e => {
        if (!e.luredBy) return;
        const t = e.luredBy;
        if (!this.towers.includes(t) || t.hp <= 0) { e.luredBy = null; e.state = 'move'; }
      });
    }

    /* ---------------- bosses ---------------- */
    onBossPhase(e, idx) {
      const def = e.def;
      e.defId === 'boss_wankui' && this.bossWankui(e, idx);
      e.defId === 'boss_mirage' && this.bossMirage(e, idx);
      e.defId === 'boss_zheying' && this.bossZheying(e, idx);
    }
    bossWankui(e, idx) {
      if (idx === 0) {
        this.log('万傀发动「洪峰」· 节点隔离正在被冲击', 'boss');
        this.emit('bossSkill', { name: '洪峰', boss: e });
        const nodes = this.map.switches.filter(s => s.cell.isolation).sort((a, b) => Math.hypot(a.x - e.cell.x, a.y - e.cell.y) - Math.hypot(b.x - e.cell.x, b.y - e.cell.y));
        const node = nodes[0];
        if (node) {
          if (this.world) this.world.effects.warning(this.world.cellCenter(node.cell, 0.4), 0xff4d3e, CELL * 2.2, '洪峰冲击');
          setTimeout(() => {}, 0);
          this.pendingBossEvents = this.pendingBossEvents || [];
          this.pendingBossEvents.push({ t: this.time + 1.4, fn: () => this.bossSlamNode(node.cell, 300) });
        } else {
          const t = this.nearestTower(e, 8);
          if (t) this.damageTower(t, 120, e, {});
        }
        for (let i = 0; i < 3; i++) this.spawnAdd('worm', e.cell, { entId: e.entId, offX: (i - 1) * 1.5, offZ: 1.5 });
      } else if (idx === 1) {
        this.log('万傀进入第二阶段 · 释放傀儡群', 'boss');
        this.emit('bossSkill', { name: '傀儡群', boss: e });
        for (let i = 0; i < 7; i++) {
          const w = this.spawnAdd('worm', e.cell, { entId: e.entId, offX: (Math.random() - 0.5) * 6, offZ: (Math.random() - 0.5) * 6 });
          if (w) { w.hp *= 0.8; w.maxHp *= 0.8; w.revealed = true; w.replicated = true; w.canReplicate = false; }
        }
      }
    }
    bossSlamNode(cell, dmg) {
      if (!cell.isolation) return;
      if (this.world) {
        const p = this.world.cellCenter(cell, 0.6);
        this.world.effects.shock(p, 0xff4d3e, 7);
        this.world.effects.burst(p, 0xff6b5a, 40, { spread: 5, speed: 6, life: 1, size: 0.7 });
      }
      if (cell.isolation.kind === 'item') {
        cell.isolation.hp -= dmg;
        if (cell.isolation.hp <= 0) { this.log('洪峰冲毁应急隔离器 · 节点恢复直通', 'bad'); this.releaseIsolation(cell, 'boss'); }
      } else if (cell.tower) {
        this.damageTower(cell.tower, dmg, null, {});
      }
    }
    bossMirage(e, idx) {
      if (idx === 0) {
        this.log('蜃楼发动「伪路由」· 前方链路出现路由黑洞', 'boss');
        this.emit('bossSkill', { name: '伪路由', boss: e });
        this.castBlackhole(e, 3, 10, 2.0);
        this.pendingBossEvents = this.pendingBossEvents || [];
        this.pendingBossEvents.push({ t: this.time + 12, fn: () => this.castBlackhole(e, 3, 10, 1.2) });
      } else if (idx === 1) {
        this.log('蜃楼发动「路由风暴」· 附近护盾被削弱', 'boss');
        this.emit('bossSkill', { name: '路由风暴', boss: e });
        this.towers.forEach(t => {
          const d = Math.hypot(t.cell.x - e.cell.x, t.cell.y - e.cell.y);
          if (d <= 10) { t.shield = 0; t.encryptedUntil = Math.max(t.encryptedUntil, this.time + 2.5); }
        });
        if (this.world) {
          const p = e.view ? e.view.position.clone() : this.world.cellCenter(e.cell, 2);
          for (let i = 0; i < 12; i++) {
            const a = Math.random() * 6.28, r = 4 + Math.random() * 12;
            const q = p.clone().add({ x: Math.cos(a) * r, y: Math.random() * 5, z: Math.sin(a) * r });
            this.world.effects.lightning(p, q, 0xb88cff, { life: 0.5 });
          }
          this.world.effects.shock(p, 0xb88cff, 14);
        }
      }
    }
    castBlackhole(e, count, duration, warningTime) {
      // pick a segment on the boss's current/next route
      const route = e.path || [];
      const startIdx = Math.min(e.pi + 1, Math.max(0, route.length - count - 1));
      let cells = route.slice(startIdx, startIdx + count).filter(c => c && !c.isolation && c.type !== 'exit' && c.type !== 'entrance');
      if (!cells.length) {
        // fallback: use an entrance route ahead
        const r = this.map.routes[this.map.entrances[0].id];
        if (r) cells = r.cells.slice(3, 3 + count).filter(c => c.type !== 'exit' && c.type !== 'entrance');
      }
      if (!cells.length) return;
      const blocked = new Set(cells.map(c => KEY(c.x, c.y)));
      const v = this.map.wouldSeal(blocked, this.enemies);
      if (v.sealed.length || v.stuck.length) {
        // try another segment on any entrance route
        let found = false;
        for (const ent of this.map.entrances) {
          const r = this.map.routes[ent.id];
          if (!r) continue;
          for (let s = 2; s < r.cells.length - count - 1 && !found; s++) {
            const cs = r.cells.slice(s, s + count).filter(c => c.type !== 'exit' && c.type !== 'entrance' && !c.isolation);
            if (cs.length < count) continue;
            const bs = new Set(cs.map(c => KEY(c.x, c.y)));
            const vv = this.map.wouldSeal(bs, this.enemies);
            if (!vv.sealed.length && !vv.stuck.length) { cells = cs; found = true; }
          }
          if (found) break;
        }
        if (!found) { this.log('伪路由未能找到安全的截断位置', 'warn'); return; }
      }
      const color = 0xb88cff;
      const from = this.time + warningTime;
      cells.forEach(c => {
        c.bossBlockFrom = Math.min(c.bossBlockFrom || 1e9, from);
        c.bossBlockUntil = Math.max(c.bossBlockUntil, from + duration);
        if (this.world) this.world.effects.warning(this.world.cellCenter(c, 0.4), color, CELL * 1.4, '路由黑洞');
      });
      this.bossSegments.push({ cells, until: from + duration, activeAt: from, activated: false, color, kind: 'blackhole' });
      this.log('路由黑洞预警 · ' + cells.length + ' 格链路将在 ' + warningTime.toFixed(1) + ' 秒后截断', 'warn');
      this.emit('bossTerrain', { kind: 'blackhole', cells, warning: warningTime });
      if (this.world) {
        cells.forEach(c => this.world.effects.ring(this.world.cellCenter(c, 0.5), color, CELL * 2, { dur: 1.2 }));
      }
    }
    bossZheying(e, idx) {
      if (idx === 0) {
        e.revealed = false;
        e.def = Object.assign({}, e.def, { armor: 0.35 });
        this.log('蛰影完成提权 · 护甲强化，放出木马', 'boss');
        this.emit('bossSkill', { name: '提权', boss: e });
        for (let i = 0; i < 2; i++) {
          this.spawnAdd('trojan', e.cell, { entId: e.entId, offX: i ? 3 : -3, offZ: 1 });
        }
        this.towers.forEach(t => { const d = Math.hypot(t.cell.x - e.cell.x, t.cell.y - e.cell.y); if (d < 5) t.encryptedUntil = Math.max(t.encryptedUntil, this.time + 2.5); });
      } else if (idx === 1) {
        this.log('蛰影进入破坏阶段 · 运维环正在被锁死', 'boss');
        this.emit('bossSkill', { name: '锁死运维环', boss: e });
        let cells = [];
        // pick cells just ahead of the boss on the ops ring
        for (let s = 1; s < 5; s++) {
          const c = e.path[e.pi + s];
          if (c && c.type !== 'exit' && c.type !== 'entrance' && !c.isolation) cells.push(c);
          if (cells.length >= 2) break;
        }
        const prefer = cells[0] || e.path[e.pi + 1] || e.cell;
        if (cells.length < 1) {
          const alt = this.findSafeLockCell(prefer);
          cells = alt ? [alt] : [];
        } else {
          const blocked = new Set(cells.map(c => KEY(c.x, c.y)));
          const v = this.map.wouldSeal(blocked, null);
          if (v.sealed.length) {
            const alt = this.findSafeLockCell(prefer);
            cells = alt ? [alt] : [];
          }
        }
        const from = this.time + 1.6;
        cells.forEach(c => {
          c.bossBlockFrom = Math.min(c.bossBlockFrom || 1e9, from);
          c.bossBlockUntil = Math.max(c.bossBlockUntil, from + 14);
          if (this.world) this.world.effects.warning(this.world.cellCenter(c, 0.4), 0xe6e6ff, CELL * 1.4, '环网锁死');
        });
        this.bossSegments.push({ cells, until: from + 14, activeAt: from, activated: false, color: 0xe6e6ff, kind: 'lock' });
        this.applyRoutingChange('蛰影锁死运维环');
        e.phase1Done = true;
      }
      if (this.world && e.view) {
        this.world.effects.shock(e.view.position.clone(), 0xe6e6ff, 10);
      }
    }
    nearestTower(e, range) {
      let best = null, bd = range * CELL;
      this.towers.forEach(t => { const d = Math.hypot(t.cell.x - e.cell.x, t.cell.y - e.cell.y) * CELL; if (d < bd) { bd = d; best = t; } });
      return best;
    }
    updateBossSegments(dt) {
      this.pendingBossEvents = (this.pendingBossEvents || []).filter(ev => {
        if (this.time >= ev.t) { try { ev.fn(); } catch (err) { console.error(err); } return false; }
        return true;
      });
      // boss phase triggers run every tick
      this.enemies.forEach(e => {
        if (!e.def.boss || e.dead) return;
        const ratio = e.hp / e.maxHp;
        const phases = e.def.phases || [];
        for (let i = 0; i < phases.length; i++) {
          if (ratio <= phases[i] && e.phaseCount <= i) {
            e.phaseCount = i + 1;
            this.onBossPhase(e, i);
          }
        }
      });
      if (!this.bossSegments.length) return;
      let changed = false, activated = false;
      this.bossSegments = this.bossSegments.filter(seg => {
        if (!seg.activated && this.time >= seg.activeAt) {
          const blocked = new Set(seg.cells.map(c => KEY(c.x, c.y)));
          const v = this.map.wouldSeal(blocked, null);
          const relocated = v.sealed.length ? false : this.relocateEnemiesFrom(seg.cells);
          if (v.sealed.length || !relocated) {
            seg.cells.forEach(c => { c.bossBlockUntil = 0; c.bossBlockFrom = 0; });
            const alt = this.findSafeLockCell(seg.cells[0]);
            if (alt) {
              const from = this.time + 1.1;
              const dur = seg.kind === 'lock' ? 14 : 10;
              alt.bossBlockFrom = from; alt.bossBlockUntil = from + dur;
              this.bossSegments.push({ cells: [alt], until: from + dur, activeAt: from, activated: false, color: seg.color, kind: seg.kind, relocated: true });
              if (this.world) this.world.effects.warning(this.world.cellCenter(alt, 0.4), seg.color, CELL * 1.4, seg.kind === 'lock' ? '环网锁死 · 改选' : '路由黑洞 · 改选');
              this.log('Boss 改选他处 · 新的走廊截断位置已确认', 'warn');
            } else {
              this.log('地形改写被路由保护拒绝 · 未封死任何入口', 'warn');
            }
            return false;
          }
          seg.activated = true; activated = true;
          if (this.world) {
            seg.cells.forEach(c => {
              const p = this.world.cellCenter(c, 0.5);
              this.world.effects.shock(p, seg.color, 4);
              this.world.effects.burst(p, seg.color, 24, { spread: 4, speed: 4, life: 1.0, size: 0.7 });
            });
          }
          this.log((seg.kind === 'lock' ? '运维环已被锁死' : '路由黑洞成型') + ' · ' + seg.cells.length + ' 格链路截断', 'boss');
        }
        if (this.time > seg.until) {
          seg.cells.forEach(c => { c.bossBlockUntil = 0; c.bossBlockFrom = 0; });
          changed = true;
          this.log(seg.kind === 'lock' ? '环网锁死解除 · 链路恢复' : '路由黑洞消退 · 链路恢复通行', 'route');
          if (this.world) seg.cells.forEach(c => this.world.effects.ring(this.world.cellCenter(c, 0.5), 0x5ff0c0, 3, { dur: 1.0 }));
          return false;
        }
        return true;
      });
      if (activated || changed) this.applyRoutingChange(activated ? 'Boss 改写地形' : '链路恢复');
    }

    relocateEnemiesFrom(cells) {
      const set = new Set(cells.map(c => KEY(c.x, c.y)));
      for (const e of this.enemies) {
        if (e.dead || e.def.flying) continue;
        if (!set.has(KEY(e.cell.x, e.cell.y))) continue;
        let moved = false;
        for (const n of this.map.neighbors(e.cell)) {
          if (set.has(KEY(n.x, n.y)) || n.isolation) continue;
          const r = this.map.findPath(n);
          if (!r) continue;
          e.cell = n; e.wx = n.wx; e.wz = n.wz; e.path = r.path; e.pi = 1;
          e.blockedBy = null; e.luredBy = null; e.state = 'move';
          if (e.view) e.view.position.set(n.wx, 0.2, n.wz);
          if (this.world) this.world.effects.burst(this.world.cellCenter(n, 1), 0xb08cff, 10, { spread: 2, speed: 2, life: 0.5, size: 0.4 });
          moved = true; break;
        }
        if (!moved) return false;
      }
      return true;
    }

    findSafeLockCell(prefer) {
      const candidates = [];
      for (const c of this.map.cells) {
        if (!c.walk || c.type === 'entrance' || c.type === 'exit' || c.isolation) continue;
        if (c.tower && c.tower.defId === 'netgap') continue;
        if (this.enemies.some(e => !e.dead && !e.def.flying && e.cell === c)) continue;
        const v = this.map.wouldSeal(new Set([KEY(c.x, c.y)]), this.enemies);
        if (v.sealed.length || v.stuck.length) continue;
        let d = 999;
        if (prefer) d = Math.hypot(c.x - prefer.x, c.y - prefer.y);
        candidates.push({ c, d });
      }
      candidates.sort((a, b) => a.d - b.d);
      return candidates.length ? candidates[0].c : null;
    }

    /* ---------------- main update ---------------- */
    update(dt) {
      if (this.over || this.paused) return;
      dt = Math.min(dt, 0.1);
      this.time += dt;
      // economy
      const rate = (this.waveState === 'active' ? 4.2 : 2.2) * (this.over ? 0 : 1);
      this.compute += rate * dt;
      // intel from held nodes
      let isolatedTowers = 0;
      this.map.switches.forEach(s => { if (s.cell.isolation && s.cell.isolation.kind === 'tower') isolatedTowers++; });
      if (isolatedTowers) {
        this.isolatedAccum += dt * isolatedTowers;
        while (this.isolatedAccum >= 6) { this.isolatedAccum -= 6; this.addIntel(1, 'isolation'); }
      }
      // isolation expiry / item durability
      this.map.switches.forEach(s => {
        const iso = s.cell.isolation;
        if (iso && iso.kind === 'item' && (this.time > iso.until || iso.hp <= 0)) {
          this.log('应急隔离器失效 · ' + s.name + ' 恢复直通', 'warn');
          this.releaseIsolation(s.cell, 'expired');
        }
      });
      this.updateWave(dt);
      this.updateBossSegments(dt);
      this.updateLures(dt);
      // towers
      for (const t of this.towers.slice()) this.updateTower(t, dt);
      // enemies
      for (const e of this.enemies.slice()) this.updateEnemy(e, dt);
      // clean dead
      if (this.enemies.some(e => e.dead)) this.enemies = this.enemies.filter(e => !e.dead);
      this.emit('tick', { time: this.time });
    }

    /* ---------------- demo / debug helpers ---------------- */
    freeTower(defId, x, y, opts) {
      opts = opts || {};
      const cell = this.map.at(x, y);
      if (!cell) return null;
      const def = D.TOWER_DEFS[defId];
      const t = {
        id: 'T' + (uid++), defId, def, cell, level: opts.level || 1, branch: opts.branch || null,
        hp: 1, maxHp: 1, shield: opts.shield || 0, encryptedUntil: 0, cooldown: 0,
        skillCd: 0, skillUntil: 0, aimAngle: opts.facing || 0, pitch: 0.12, facing: opts.facing || 0,
        recoil: 0, blockedSet: new Set(), luredSet: new Set(), shieldTimer: 0, cleanseTimer: 0,
        kills: 0, damageDealt: 0, isNodeTower: cell.type === 'switch'
      };
      t.maxHp = this.towerStats(t).hp; t.hp = t.maxHp * (opts.hpRatio == null ? 1 : opts.hpRatio);
      if (defId === 'netgap' || (defId === 'firewall' && cell.type === 'switch')) t.isolates = true;
      cell.tower = t;
      if (t.isolates) { cell.isolation = { kind: 'tower', tower: t, started: this.time }; cell.lastReiso = this.time; }
      this.towers.push(t);
      if (this.world) this.world.addTower(t);
      return t;
    }
    forceRouteUpdate(reason) { return this.applyRoutingChange(reason || 'manual'); }
    setBossPhase(e, idx) { this.onBossPhase(e, idx); }

    /* ---------------- serialization for results ---------------- */
    results() {
      const total = this.stats;
      return {
        victory: this.victory, map: this.mapDef.name, waves: this.waves.length,
        waveReached: Math.min(this.waveIndex + 1, this.waves.length),
        kills: total.kills, leaks: total.leaks, towersLost: total.towersLost, built: total.built,
        integrity: Math.round(this.integrity), duration: this.time,
        computeEarned: Math.round(total.computeEarned), intelEarned: total.intelEarned,
        reroutes: total.reroutes, bossKills: total.bossKills
      };
    }
  }

  global.BattleMap = BattleMap;
  global.Game = Game;
})(window);
