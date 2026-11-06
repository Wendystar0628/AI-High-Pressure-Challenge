// 游戏逻辑：不依赖渲染，可在 Node 里运行测试。坐标单位是“格”，格心为整数坐标。
(function (root) {
  const TD = root.TD = root.TD || {};
  const INF = 1e9;
  const TT = TD.TT;
  const R = TD.RULES;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  function isRoad(t) { return t === TT.LINK || t === TT.LEGACY || t === TT.NODE || t === TT.ENTRANCE || t === TT.EXIT; }
  function angleDiff(a, b) { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
  TD.angleDiff = angleDiff;

  class Game {
    constructor(mapId, opts) {
      opts = opts || {};
      this.opts = opts;
      this.mapId = mapId;
      this.map = TD.compileMap(mapId);
      this.def = this.map.def;
      const n = this.map.w * this.map.h;
      this.n = n;
      this.blocked = new Uint8Array(n);
      this.slow = new Uint8Array(n);
      this.zoneCount = new Uint8Array(n);
      this.towerAt = new Array(n).fill(null);
      this.dist = new Float64Array(n);
      this.nodes = this.map.nodes.map(nd => Object.assign({}, nd, { tower: null, isolator: null, lockT: 0, flap: 0, lastOpen: -999, hold: 0 }));
      this.nodeByIdx = {};
      for (const nd of this.nodes) this.nodeByIdx[nd.idx] = nd;
      this.time = 0;
      this.nextId = 1;
      this.rng = opts.seed || 12345;
      this.compute = this.def.startCompute;
      this.intel = this.def.startIntel;
      this.integrity = R.startIntegrity;
      this.enemies = []; this.towers = []; this.shots = []; this.zones = []; this.holes = []; this.warnings = []; this.residues = [];
      this.itemCd = { isolator: 0, downgrade: 0, backup: 0 };
      this.waveIdx = -1;
      this.waveTotal = this.def.waves.length;
      this.waveState = 'prep';
      this.prepT = opts.prep != null ? opts.prep : R.prepFirst;
      this.spawnQueue = [];
      this.waveClock = 0;
      this.over = null;
      this.boss = null;
      this.events = [];
      this.logs = [];
      this.seenThreats = {};
      this.stats = {
        kills: {}, leaks: 0, leakBy: {}, built: 0, lost: 0, sold: 0, upgrades: 0, skills: 0, items: 0, reroutes: 0, isolations: 0,
        holdSeconds: 0, intelEarned: 0, computeEarned: 0, damage: 0, healing: 0, towerDamage: 0, breaches: 0, wavesCleared: 0, timeline: [],
      };
      this.routes = {};
      this.recompute();
      this.routes = this.computeRoutes(this.dist);
      this.log('info', `路由表就绪：${this.def.name}，${this.map.entrances.length} 个入口 / ${this.map.exits.length} 个出口 / ${this.nodes.length} 个交换节点`);
    }

    rand() { // 确定性随机，便于回归测试
      this.rng = (this.rng * 1664525 + 1013904223) >>> 0;
      return this.rng / 4294967296;
    }

    emit(type, data) { const ev = Object.assign({ type }, data || {}); this.events.push(ev); return ev; }
    log(level, text) {
      const l = { t: this.time, level, text };
      this.logs.push(l);
      if (this.logs.length > 200) this.logs.shift();
      this.emit('log', { entry: l });
    }
    mark(text) { this.stats.timeline.push({ t: this.time, wave: this.waveIdx + 1, text }); }

    idx(x, y) { return x + y * this.map.w; }
    inGrid(x, y) { return x >= 0 && y >= 0 && x < this.map.w && y < this.map.h; }
    tileType(x, y) { return this.inGrid(x, y) ? this.map.tiles[this.idx(x, y)] : TT.VOID; }
    isRoadIdx(i) { return isRoad(this.map.tiles[i]); }
    passable(i, blk) { return isRoad(this.map.tiles[i]) && !(blk || this.blocked)[i]; }

    // ────────── 路由 ──────────
    recompute() {
      const m = this.map;
      this.blocked.fill(0);
      for (const nd of this.nodes) if (nd.tower || nd.isolator) this.blocked[nd.idx] = 1;
      for (const h of this.holes) for (const i of h.tiles) this.blocked[i] = 1;
      for (let i = 0; i < this.n; i++) this.slow[i] = (m.tiles[i] === TT.LEGACY || this.zoneCount[i] > 0) ? 1 : 0;
      this.dist = this.computeDist(this.blocked, this.slow);
      // Boss 不受自己制造的封锁影响：另外维护一份只看节点隔离的通行表
      if (this.holes.length) {
        this.blockedB = new Uint8Array(this.n);
        for (const nd of this.nodes) if (nd.tower || nd.isolator) this.blockedB[nd.idx] = 1;
        this.distB = this.computeDist(this.blockedB, this.slow);
      } else { this.blockedB = this.blocked; this.distB = this.dist; }
    }

    bk(e) { return e.def.ownBlocks ? this.blockedB : this.blocked; }
    ds(e) { return e.def.ownBlocks ? this.distB : this.dist; }

    tileCost(i, slow) { return (slow || this.slow)[i] ? 1 / R.legacySpeed : 1; }

    computeDist(blk, slow) {
      const m = this.map, w = m.w, h = m.h, n = this.n;
      const dist = new Float64Array(n).fill(INF);
      const heap = [];
      const push = (i, d) => {
        heap.push([d, i]);
        let c = heap.length - 1;
        while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; const tmp = heap[p]; heap[p] = heap[c]; heap[c] = tmp; c = p; }
      };
      const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          let c = 0;
          for (;;) {
            const l = c * 2 + 1, r = l + 1; let s = c;
            if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
            if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
            if (s === c) break;
            const tmp = heap[s]; heap[s] = heap[c]; heap[c] = tmp; c = s;
          }
        }
        return top;
      };
      for (const ex of m.exits) { dist[ex.idx] = 0; push(ex.idx, 0); }
      while (heap.length) {
        const [d, i] = pop();
        if (d > dist[i]) continue;
        const x = i % w, y = (i / w) | 0;
        for (const D of DIRS) {
          const nx = x + D[0], ny = y + D[1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = nx + ny * w;
          if (!isRoad(m.tiles[j]) || blk[j]) continue;
          const nd = d + (this.tileCost(i, slow) + this.tileCost(j, slow)) / 2;
          if (nd < dist[j] - 1e-5) { dist[j] = nd; push(j, nd); }
        }
      }
      return dist;
    }

    walkRoute(startIdx, dist, blk, slow) {
      const w = this.map.w, path = [startIdx];
      let cur = startIdx, guard = 0, lastD = null;
      while (dist[cur] > 0 && guard++ < 400) {
        const x = cur % w, y = (cur / w) | 0;
        let best = -1, bestC = INF, bestD = null;
        for (const D of DIRS) {
          const nx = x + D[0], ny = y + D[1];
          if (!this.inGrid(nx, ny)) continue;
          const j = nx + ny * w;
          if (!isRoad(this.map.tiles[j]) || blk[j] || dist[j] >= INF) continue;
          let c = dist[j] + (this.tileCost(cur, slow) + this.tileCost(j, slow)) / 2;
          if (lastD && lastD[0] === D[0] && lastD[1] === D[1]) c -= 1e-4;
          if (c < bestC - 1e-6) { bestC = c; best = j; bestD = D; }
        }
        if (best < 0) break;
        path.push(best); cur = best; lastD = bestD;
      }
      return path;
    }

    computeRoutes(dist, blk, slow) {
      blk = blk || this.blocked; slow = slow || this.slow;
      const out = {};
      for (const en of this.map.entrances) {
        const d = dist[en.idx];
        if (d >= INF) { out[en.id] = { ent: en.id, exit: null, path: [en.idx], cost: INF, len: 0 }; continue; }
        const path = this.walkRoute(en.idx, dist, blk, slow);
        const last = path[path.length - 1];
        const ex = this.map.exits.find(e => e.idx === last);
        out[en.id] = { ent: en.id, exit: ex ? ex.id : null, path, cost: d, len: path.length - 1 };
      }
      return out;
    }

    routesDiff(oldR, newR) {
      const out = [];
      for (const en of this.map.entrances) {
        const a = oldR[en.id], b = newR[en.id];
        const same = a.path.length === b.path.length && a.path.every((v, i) => v === b.path[i]);
        if (!same) out.push({ ent: en.id, oldPath: a.path, newPath: b.path, oldExit: a.exit, newExit: b.exit, oldLen: a.len, newLen: b.len, oldCost: a.cost, newCost: b.cost });
      }
      return out;
    }

    // 预览一次通行变化：返回新路线、变化列表和会被封死的位置
    preview(change) {
      change = change || {};
      const blk = new Uint8Array(this.blocked), slow = new Uint8Array(this.slow);
      if (change.block) for (const i of change.block) blk[i] = 1;
      if (change.unblock) for (const i of change.unblock) blk[i] = 0;
      if (change.slow) for (const i of change.slow) slow[i] = 1;
      const dist = this.computeDist(blk, slow);
      const routes = this.computeRoutes(dist, blk, slow);
      const changes = this.routesDiff(this.routes, routes);
      const sealed = this.findSealed(dist, blk);
      return { routes, changes, sealed, ok: sealed.length === 0, dist };
    }

    findSealed(dist, blk) {
      const sealed = [];
      for (const en of this.map.entrances) if (dist[en.idx] >= INF) sealed.push({ kind: 'entrance', x: en.x, y: en.y, label: `入口 ${en.id}「${en.name}」将无路可走` });
      let blkB = null, distB = null;
      for (const e of this.enemies) {
        if (e.fly || e.dead) continue;
        const fi = this.idx(e.fx, e.fy), ti = this.idx(e.tx, e.ty);
        let useB = blk, useD = dist;
        if (e.def.ownBlocks) {
          if (!blkB) {
            blkB = new Uint8Array(blk);
            for (const h of this.holes) for (const i of h.tiles) blkB[i] = 0;
            if (this._pendingHole) for (const i of this._pendingHole) blkB[i] = 0;
            distB = this.computeDist(blkB, this.slow);
          }
          useB = blkB; useD = distB;
        }
        const okTo = !useB[ti] && useD[ti] < INF, okFrom = !useB[fi] && useD[fi] < INF;
        if (!okTo && !okFrom) sealed.push({ kind: 'enemy', x: e.x, y: e.y, label: `场上的${e.def.name}将被困死` });
      }
      return sealed;
    }

    converge(reason, opts) {
      opts = opts || {};
      this.recompute();
      const newR = this.computeRoutes(this.dist);
      const changes = this.routesDiff(this.routes, newR);
      this.routes = newR;
      for (const e of this.enemies) if (!e.fly && !e.dead) this.retarget(e);
      if (changes.length) {
        this.stats.reroutes++;
        const txt = changes.map(c => `${c.ent}→${c.newExit || '?'}（${c.oldLen}→${c.newLen} 跳）`).join('，');
        this.log('route', `路由收敛：${reason}。${txt}`);
        this.emit('routeChange', { changes, reason });
        this.mark(`路由收敛：${reason}`);
      }
      this.emit('routesUpdated', { changed: changes.length });
    }

    // 敌人从当前位置重新寻路：比较继续前进和掉头两种走法
    retarget(e) {
      if (e.mode === 'siege' && e.sieging && e.siegeNode && this.nodeIsolated(e.siegeNode)) return;
      if (e.mode === 'siege' || e.mode === 'lure') {
        e.mode = 'route'; e.pathOv = null; e.siegeNode = null; e.sieging = false;
        if (e.lureT) { e.lureT.claims = Math.max(0, e.lureT.claims - e.def.block); e.lureT = null; }
        e.nextSiege = this.time + 0.2;
      }
      const fi = this.idx(e.fx, e.fy), ti = this.idx(e.tx, e.ty);
      if (fi === ti) { this.chooseNext(e); return; }
      const dTo = Math.hypot(e.x - e.tx, e.y - e.ty), dFrom = Math.hypot(e.x - e.fx, e.y - e.fy);
      const blk = this.bk(e), dst = this.ds(e);
      const cTo = blk[ti] || dst[ti] >= INF ? INF : dst[ti] + dTo * this.tileCost(ti);
      const cFrom = blk[fi] || dst[fi] >= INF ? INF : dst[fi] + dFrom * this.tileCost(fi);
      if (cFrom < cTo - 0.01) {
        const tx = e.tx, ty = e.ty; e.tx = e.fx; e.ty = e.fy; e.fx = tx; e.fy = ty;
        e.turned = this.time;
      }
    }

    chooseNext(e) {
      const w = this.map.w;
      const cur = this.idx(e.fx, e.fy);
      const blkE = this.bk(e), dstE = this.ds(e);
      let best = -1, bestC = INF;
      for (const D of DIRS) {
        const nx = e.fx + D[0], ny = e.fy + D[1];
        if (!this.inGrid(nx, ny)) continue;
        const j = nx + ny * w;
        if (!isRoad(this.map.tiles[j]) || blkE[j] || dstE[j] >= INF) continue;
        let c = dstE[j] + (this.tileCost(cur) + this.tileCost(j)) / 2;
        if (e.lastDir && e.lastDir[0] === D[0] && e.lastDir[1] === D[1]) c -= 1e-4;
        if (c < bestC - 1e-6) { bestC = c; best = j; }
      }
      if (best < 0) {
        // 站在被封格内部的极端情况：沿道路走到最近的可通行格，不瞬移
        const p = this.bfsPath(cur, i => !this.blocked[i] && this.dist[i] < INF, 60, true);
        if (p && p.length) { e.pathOv = p; best = e.pathOv.shift(); }
      }
      if (best < 0) { e.tx = e.fx; e.ty = e.fy; return; }
      e.tx = best % w; e.ty = (best / w) | 0;
      e.lastDir = [e.tx - e.fx, e.ty - e.fy];
    }

    // 沿可通行道路做 BFS，返回不含起点的路径
    bfsPath(start, goal, maxDepth, ignoreBlock) {
      const w = this.map.w;
      const prev = new Int32Array(this.n).fill(-1);
      const depth = new Int16Array(this.n);
      const q = [start]; prev[start] = start;
      for (let h = 0; h < q.length; h++) {
        const c = q[h];
        if (c !== start && goal(c)) {
          const path = [];
          let k = c;
          while (k !== start) { path.push(k); k = prev[k]; }
          path.reverse();
          return path;
        }
        if (depth[c] >= maxDepth) continue;
        const x = c % w, y = (c / w) | 0;
        for (const D of DIRS) {
          const nx = x + D[0], ny = y + D[1];
          if (!this.inGrid(nx, ny)) continue;
          const j = nx + ny * w;
          if (prev[j] >= 0 || !isRoad(this.map.tiles[j])) continue;
          if (!ignoreBlock && this.blocked[j]) continue;
          prev[j] = c; depth[j] = depth[c] + 1; q.push(j);
        }
      }
      return null;
    }

    // ────────── 部署与操作 ──────────
    nodeIsolated(nd) { return !!(nd.tower || nd.isolator); }

    checkPlace(type, x, y) {
      const def = TD.TOWERS[type];
      if (!this.inGrid(x, y)) return { ok: false, reason: '不在战场范围内' };
      const i = this.idx(x, y), t = this.map.tiles[i];
      let cat = null;
      if (t === TT.LINK || t === TT.LEGACY) cat = 'link';
      else if (t === TT.NODE) cat = 'node';
      else if (t === TT.PLATFORM) cat = 'platform';
      const placeTxt = { link: '链路', node: '交换节点', platform: '设备平台' };
      const allowed = def.place.map(p => placeTxt[p]).join('或');
      if (!cat || def.place.indexOf(cat) < 0) {
        const name = t === TT.ENTRANCE ? '入口' : t === TT.EXIT ? '出口' : t === TT.OBSTACLE ? '障碍' : t === TT.VOID ? '空域' : placeTxt[cat];
        return { ok: false, reason: `${def.name}只能部署在${allowed}，这里是${name}`, cat };
      }
      if (this.towerAt[i]) return { ok: false, reason: '该位置已有设备', cat };
      if (this.blocked[i] && !this.nodeByIdx[i]) return { ok: false, reason: '该位置已被黑洞或锁死，暂时无法部署', cat };
      const res = { ok: true, cat, cost: def.cost, intel: 0, x, y };
      if (cat === 'node') {
        const nd = this.nodeByIdx[i];
        res.node = nd;
        if (nd.isolator) return { ok: false, reason: '节点已被应急隔离器占用', cat };
        if (this.blocked[i]) return { ok: false, reason: '节点已被锁死', cat };
        res.intel = def.nodeIntel || 0;
        if (nd.lockT > 0) return Object.assign(res, { ok: false, reason: `节点处于再隔离间隔，还需 ${Math.ceil(nd.lockT)} 秒` });
        const pv = this.preview({ block: [i] });
        res.preview = pv;
        if (!pv.ok) return Object.assign(res, { ok: false, sealed: pv.sealed, reason: '操作被拒绝：' + pv.sealed[0].label });
      }
      if (this.compute < res.cost) return Object.assign(res, { ok: false, reason: `算力不足（需要 ${res.cost}）`, lack: 'compute' });
      if (this.intel < res.intel) return Object.assign(res, { ok: false, reason: `情报不足（隔离节点需要 ${res.intel}）`, lack: 'intel' });
      return res;
    }

    placeTower(type, x, y, dir) {
      const chk = this.checkPlace(type, x, y);
      if (!chk.ok) { this.emit('reject', { reason: chk.reason, sealed: chk.sealed, x, y }); return chk; }
      this.compute -= chk.cost;
      this.intel -= chk.intel;
      const def = TD.TOWERS[type];
      const t = {
        id: this.nextId++, type, def, x, y, level: 1, branch: null, hp: def.hp, maxHp: def.hp, shield: 0, shieldT: 0, encT: 0,
        cd: 0, skillCd: 0, skillT: 0, dir: dir || 0, aim: dir || 0, blocked: [], claims: 0, onNode: chk.cat === 'node', cat: chk.cat,
        invested: chk.cost, healTargets: [], purgeT: 0, spawnT: this.time, fireAnim: 0, hitAnim: 0, redirectCd: 0, dmgDone: 0, s: TD.towerStats(type, 1, null),
      };
      this.towers.push(t);
      const i = this.idx(x, y);
      this.towerAt[i] = t;
      this.stats.built++;
      this.emit('towerPlaced', { tower: t });
      if (t.onNode) {
        const nd = this.nodeByIdx[i];
        nd.tower = t; t.node = nd;
        this.stats.isolations++;
        this.emit('nodeIsolated', { node: nd, by: t.type });
        this.log('warn', `${def.name}接管${nd.name}：节点隔离，消耗情报 ${chk.intel}`);
        this.converge(`隔离${nd.name}`);
      } else {
        this.log('info', `部署${def.name} @(${x},${y})`);
      }
      return { ok: true, tower: t };
    }

    upgradeCost(t, branch) {
      if (t.level >= 2) return null;
      if (t.def.branches) {
        if (!branch || !t.def.branches[branch]) return null;
        const b = t.def.branches[branch];
        return { cost: b.cost, intel: b.intel };
      }
      return { cost: t.def.lv2.cost, intel: 0 };
    }

    upgrade(t, branch) {
      const c = this.upgradeCost(t, branch);
      if (!c) return { ok: false, reason: '无法升级' };
      if (this.compute < c.cost) { this.emit('reject', { reason: `算力不足（需要 ${c.cost}）`, x: t.x, y: t.y }); return { ok: false, reason: '算力不足' }; }
      if (this.intel < c.intel) { this.emit('reject', { reason: `情报不足（分支需要 ${c.intel}）`, x: t.x, y: t.y }); return { ok: false, reason: '情报不足' }; }
      this.compute -= c.cost; this.intel -= c.intel;
      t.level = 2; t.branch = branch || null; t.invested += c.cost;
      t.s = TD.towerStats(t.type, 2, t.branch);
      const frac = t.hp / t.maxHp;
      t.maxHp = t.s.hp; t.hp = Math.max(t.hp, t.maxHp * frac);
      this.stats.upgrades++;
      this.emit('towerUpgraded', { tower: t });
      this.log('info', `${t.def.name}升级：${t.s.title}`);
      return { ok: true };
    }

    sellPreview(t) {
      if (!t.onNode) return null;
      return this.preview({ unblock: [t.node.idx] });
    }

    sell(t) {
      const refund = Math.round(t.invested * R.sellRefund);
      this.compute += refund;
      this.stats.sold++;
      this.emit('towerSold', { tower: t, refund });
      this.log('info', `撤下${t.def.name}，回收算力 ${refund}`);
      this.removeTower(t, '撤下');
      return { ok: true, refund };
    }

    removeTower(t, why) {
      const i = this.idx(t.x, t.y);
      this.towerAt[i] = null;
      this.towers.splice(this.towers.indexOf(t), 1);
      t.gone = true;
      for (const e of t.blocked) { e.blockedBy = null; e.trapT = 0; }
      t.blocked = [];
      for (const e of this.enemies) if (e.lureT === t) { e.lureT = null; if (e.mode === 'lure') { e.mode = 'route'; e.pathOv = null; this.retarget(e); } }
      if (t.onNode && t.node) {
        const nd = t.node;
        nd.tower = null;
        this.openNode(nd, why === '撤下' ? '撤下设备' : '设备被摧毁');
      }
    }

    openNode(nd, reason) {
      if (nd.tower || nd.isolator) return;
      const flapping = this.time - nd.lastOpen < R.flapWindow;
      nd.flap = flapping ? Math.min(nd.flap + 1, 4) : 0;
      nd.lastOpen = this.time;
      nd.lockT = R.relockBase + nd.flap * R.relockStep;
      this.emit('nodeOpen', { node: nd, reason });
      this.log(reason === '设备被摧毁' || reason === '隔离器被冲毁' ? 'alert' : 'info', `${nd.name}旁路直通（${reason}），再隔离间隔 ${nd.lockT} 秒${nd.flap ? '（路由抖动抑制）' : ''}`);
      this.converge(`${nd.name}恢复直通`);
    }

    canSkill(t) {
      if (t.ghostT > 0) return { ok: false, reason: '残影不能操作' };
      if (t.encT > 0) return { ok: false, reason: '设备被加密，无法释放技能' };
      if (t.skillCd > 0) return { ok: false, reason: `技能冷却中（${Math.ceil(t.skillCd)} 秒）` };
      return { ok: true };
    }

    useSkill(t) {
      const c = this.canSkill(t);
      if (!c.ok) { this.emit('reject', { reason: c.reason, x: t.x, y: t.y }); return c; }
      const sk = t.def.skill;
      t.skillCd = sk.cd;
      this.stats.skills++;
      const data = { tower: t, name: sk.name };
      switch (t.type) {
        case 'firewall': t.skillT = sk.dur; break;
        case 'gate': t.skillT = sk.dur; break;
        case 'interceptor': t.skillT = sk.dur; break;
        case 'honeypot': {
          const dur = t.s.trapDur || sk.dur;
          let n = 0;
          for (const e of t.blocked) {
            e.trapT = dur; n++;
            if (t.branch === 'trap') { e.exposedT = dur; e.trapBy = t; this.reveal(e, '诱捕'); }
          }
          data.count = n;
          break;
        }
        case 'sandbox': {
          let n = 0;
          for (const e of this.enemies) {
            if (Math.hypot(e.x - t.x, e.y - t.y) <= sk.radius) {
              this.reveal(e, '全量扫描');
              e.revealT = Math.max(e.revealT, sk.dur);
              if (e.shield > 0) e.shield *= (1 - sk.strip);
              n++;
            }
          }
          data.count = n;
          break;
        }
        case 'repair': {
          const amt = t.level >= 2 ? t.s.shield : sk.shield;
          const hit = [];
          for (const o of this.towers) {
            if (Math.hypot(o.x - t.x, o.y - t.y) <= t.s.range + 0.01) {
              if (o !== t) { o.shield = Math.max(o.shield, amt); o.shieldT = sk.dur; hit.push(o); }
              if (o.encT > 0) { o.encT = 0; this.emit('decrypt', { tower: o }); }
            }
          }
          t.shield = Math.max(t.shield, amt * 0.5); t.shieldT = sk.dur;
          data.targets = hit;
          break;
        }
      }
      this.emit('towerSkill', data);
      this.log('info', `${t.def.name}释放「${sk.name}」`);
      return { ok: true };
    }

    // 拦截器的转向也算操作，有独立冷却
    redirect(t, dir) {
      if (t.type !== 'interceptor') return { ok: false };
      if (t.redirectCd > 0) { this.emit('reject', { reason: `转向冷却中（${Math.ceil(t.redirectCd)} 秒）`, x: t.x, y: t.y }); return { ok: false }; }
      t.dir = dir; t.redirectCd = 10;
      this.emit('towerRedirect', { tower: t });
      return { ok: true };
    }

    checkItem(id, x, y, target) {
      const it = TD.ITEMS[id];
      if (this.itemCd[id] > 0) return { ok: false, reason: `${it.name}冷却中（${Math.ceil(this.itemCd[id])} 秒）` };
      if (it.res === 'intel' && this.intel < it.cost) return { ok: false, reason: `情报不足（需要 ${it.cost}）`, lack: 'intel' };
      if (it.res === 'compute' && this.compute < it.cost) return { ok: false, reason: `算力不足（需要 ${it.cost}）`, lack: 'compute' };
      if (id === 'isolator') {
        if (!this.inGrid(x, y)) return { ok: false, reason: '应急隔离器只能投放到直通节点' };
        const i = this.idx(x, y), nd = this.nodeByIdx[i];
        if (!nd) return { ok: false, reason: '应急隔离器只能投放到直通节点' };
        if (nd.tower || nd.isolator || this.blocked[i]) return { ok: false, reason: '这个节点已经被隔离' };
        if (nd.lockT > 0) return { ok: false, reason: `节点处于再隔离间隔，还需 ${Math.ceil(nd.lockT)} 秒` };
        const pv = this.preview({ block: [i] });
        if (!pv.ok) return { ok: false, sealed: pv.sealed, preview: pv, reason: '操作被拒绝：' + pv.sealed[0].label };
        return { ok: true, preview: pv, node: nd };
      }
      if (id === 'downgrade') {
        const tiles = this.zoneTiles(x, y, it.radius);
        if (!tiles.length) return { ok: false, reason: '范围内没有链路' };
        const pv = this.preview({ slow: tiles });
        return { ok: true, tiles, preview: pv };
      }
      if (id === 'backup') {
        const t = target || (this.inGrid(x, y) ? this.towerAt[this.idx(x, y)] : null);
        if (!t || t.ghostT > 0) return { ok: false, reason: '备份还原只能对一座塔使用' };
        if (t.hp >= t.maxHp && t.encT <= 0) return { ok: false, reason: '这座塔不需要还原' };
        return { ok: true, tower: t };
      }
      return { ok: false, reason: '未知道具' };
    }

    zoneTiles(x, y, r) {
      const out = [];
      const x0 = Math.floor(x - r), x1 = Math.ceil(x + r), y0 = Math.floor(y - r), y1 = Math.ceil(y + r);
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        if (!this.inGrid(xx, yy)) continue;
        const i = this.idx(xx, yy), tp = this.map.tiles[i];
        if ((tp === TT.LINK || tp === TT.NODE || tp === TT.LEGACY) && Math.hypot(xx - x, yy - y) <= r) out.push(i);
      }
      return out;
    }

    useItem(id, x, y, target) {
      const c = this.checkItem(id, x, y, target);
      if (!c.ok) { this.emit('reject', { reason: c.reason, sealed: c.sealed, x, y }); return c; }
      const it = TD.ITEMS[id];
      if (it.res === 'intel') this.intel -= it.cost; else this.compute -= it.cost;
      this.itemCd[id] = it.cd;
      this.stats.items++;
      if (id === 'isolator') {
        const nd = c.node;
        nd.isolator = { hp: it.hp, maxHp: it.hp, t: it.dur, dur: it.dur, node: nd, x: nd.x, y: nd.y, hitAnim: 0, spawnT: this.time };
        this.stats.isolations++;
        this.emit('itemUsed', { item: id, x: nd.x, y: nd.y, node: nd });
        this.emit('nodeIsolated', { node: nd, by: 'isolator' });
        this.log('warn', `应急隔离器投放到${nd.name}，有效期 ${it.dur} 秒`);
        this.converge(`应急隔离${nd.name}`);
      } else if (id === 'downgrade') {
        const z = { x, y, r: it.radius, t: it.dur, dur: it.dur, tiles: c.tiles };
        this.zones.push(z);
        for (const i of z.tiles) this.zoneCount[i]++;
        this.emit('itemUsed', { item: id, x, y, zone: z });
        this.log('warn', `协议降级生效：${c.tiles.length} 格链路切换旧协议 ${it.dur} 秒`);
        this.converge('协议降级生效');
      } else if (id === 'backup') {
        const t = c.tower;
        const amt = t.maxHp * it.heal;
        t.hp = Math.min(t.maxHp, t.hp + amt);
        this.stats.healing += amt;
        if (t.encT > 0) { t.encT = 0; this.emit('decrypt', { tower: t }); }
        this.emit('itemUsed', { item: id, x: t.x, y: t.y, tower: t });
        this.log('info', `备份还原：${t.def.name}恢复 ${Math.round(amt)} 生命`);
      }
      return { ok: true };
    }

    // ────────── 波次 ──────────
    currentWaveDef() { return this.def.waves[this.waveIdx] || null; }
    nextWaveDef() { return this.def.waves[this.waveIdx + 1] || null; }

    callNext() {
      if (this.waveState !== 'prep' || this.over) return false;
      const bonus = Math.floor(this.prepT * 1.5);
      if (bonus > 0) { this.compute += bonus; this.stats.computeEarned += bonus; this.emit('earlyBonus', { bonus }); }
      this.prepT = 0;
      return true;
    }

    startWave() {
      this.waveIdx++;
      const w = this.def.waves[this.waveIdx];
      this.waveClock = 0;
      this.waveState = 'spawning';
      this.spawnQueue = [];
      for (const g of w.groups) {
        const [type, count, ent, start, gap] = g;
        for (let k = 0; k < count; k++) this.spawnQueue.push({ t: start + k * gap, type, ent });
      }
      this.spawnQueue.sort((a, b) => a.t - b.t);
      const intelGain = 4 + Math.floor(this.waveIdx / 4);
      this.addIntel(intelGain, null);
      this.emit('waveStart', { index: this.waveIdx, def: w });
      this.log(w.boss ? 'alert' : w.surge ? 'alert' : 'info', `第 ${this.waveIdx + 1} 波「${w.label}」开始，情报 +${intelGain}`);
      if (w.surge) { this.emit('surge', { wave: w }); this.mark('三入口洪峰'); }
      // 新敌人提示
      for (const g of w.groups) {
        if (!this.seenThreats[g[0]]) {
          this.seenThreats[g[0]] = true;
          this.emit('newThreat', { threat: g[0], first: this.waveIdx > 0 });
          if (g[0] !== 'worm') this.log('warn', `威胁档案更新：首次检测到${(TD.ENEMIES[g[0]] || TD.BOSSES[g[0]]).name}`);
        }
      }
    }

    spawn(type, entId, opts) {
      opts = opts || {};
      const def = TD.ENEMIES[type] || TD.BOSSES[type];
      const hpMul = opts.hpMul || (def.boss ? 1 : (1 + 0.06 * Math.max(0, this.waveIdx)));
      let x, y, tx, ty;
      const ent = this.map.entrances.find(en => en.id === entId);
      if (opts.at) { x = opts.at.x; y = opts.at.y; } else { x = ent.x; y = ent.y; }
      const e = {
        id: this.nextId++, type, def, ent: entId, x, y, fx: Math.round(x), fy: Math.round(y), tx: Math.round(x), ty: Math.round(y),
        hp: def.hp * hpMul, maxHp: def.hp * hpMul, shield: 0, speed: def.speed, fly: !!def.fly, stealth: !!def.stealth, revealed: false, revealT: 0,
        blockedBy: null, trapT: 0, supT: 0, supMul: 1, exposedT: 0, trapBy: null, mode: 'route', pathOv: null, siegeNode: null, sieging: false, nextSiege: 0, lureT: null,
        atkT: 0.5 + this.rand() * 0.5, impactT: 0.8, canCopy: type === 'worm' && !opts.clone, clone: !!opts.clone, remain: 0, lane: (this.rand() - 0.5) * 0.5, dead: false,
        shieldT: 2 + this.rand() * 2, atkAnim: 0, hitAnim: 0, spawnT: this.time, aimTarget: null, lastDir: null,
      };
      if (def.boss) {
        e.phase = 0; e.skillT = 8; e.skill2T = 6; e.armor = 1;
        if (type === 'zheying') e.stealth = true;
      }
      if (e.fly) {
        // 飞向最近的出口（直线）
        let best = null, bd = INF;
        for (const ex of this.map.exits) { const d = Math.hypot(ex.x - x, ex.y - y); if (d < bd) { bd = d; best = ex; } }
        e.flyTo = best; e.flyFrom = { x, y }; e.tx = best.x; e.ty = best.y;
      } else if (opts.at) {
        e.fx = opts.at.fx != null ? opts.at.fx : Math.round(x); e.fy = opts.at.fy != null ? opts.at.fy : Math.round(y);
        e.tx = opts.at.tx != null ? opts.at.tx : e.fx; e.ty = opts.at.ty != null ? opts.at.ty : e.fy;
        if (e.fx === e.tx && e.fy === e.ty) this.chooseNext(e);
      } else {
        this.chooseNext(e);
      }
      this.enemies.push(e);
      this.emit('enemySpawn', { enemy: e });
      if (def.boss) {
        this.boss = e;
        this.emit('bossSpawn', { enemy: e });
        this.log('alert', `高危告警：${def.name}（${def.title}）进入战场，入口 ${entId}`);
        this.mark(`${def.name}现身`);
      }
      return e;
    }

    // ────────── 主循环 ──────────
    update(dt) {
      if (this.over) return;
      let left = dt;
      while (left > 1e-5) {
        const h = Math.min(left, 1 / 30);
        this.step(h);
        left -= h;
        if (this.over) break;
      }
    }

    step(dt) {
      this.time += dt;
      this.addCompute(R.computeRate * dt, false);
      for (const k in this.itemCd) if (this.itemCd[k] > 0) this.itemCd[k] = Math.max(0, this.itemCd[k] - dt);
      this.stepWaves(dt);
      this.stepWorld(dt);
      for (const t of this.towers.slice()) this.stepTower(t, dt);
      for (const e of this.enemies.slice()) if (!e.dead) this.stepEnemy(e, dt);
      this.stepShots(dt);
      this.enemies = this.enemies.filter(e => !e.dead);
      this.checkEnd();
    }

    addCompute(a, count) { this.compute += a; this.stats.computeEarned += a; }
    addIntel(a, src) {
      this.intel += a; this.stats.intelEarned += a;
      if (src) this.emit('intelGain', { amount: a, x: src.x, y: src.y });
    }

    stepWaves(dt) {
      if (this.opts.demo) return;
      if (this.waveState === 'prep') {
        this.prepT -= dt;
        if (this.prepT <= 0) this.startWave();
      } else if (this.waveState === 'spawning') {
        this.waveClock += dt;
        while (this.spawnQueue.length && this.spawnQueue[0].t <= this.waveClock) {
          const s = this.spawnQueue.shift();
          this.spawn(s.type, s.ent);
        }
        if (!this.spawnQueue.length) {
          this.stats.wavesCleared = this.waveIdx + 1;
          if (this.waveIdx + 1 >= this.waveTotal) this.waveState = 'final';
          else { this.waveState = 'prep'; this.prepT = R.prepNext; }
        }
      }
    }

    stepWorld(dt) {
      // 节点：再隔离间隔、隔离器、守点情报
      for (const nd of this.nodes) {
        if (nd.lockT > 0) nd.lockT = Math.max(0, nd.lockT - dt);
        if (nd.isolator) {
          nd.isolator.t -= dt;
          nd.isolator.hitAnim = Math.max(0, nd.isolator.hitAnim - dt * 3);
          if (nd.isolator.t <= 0) { nd.isolator = null; this.emit('isolatorEnd', { node: nd, reason: 'timeout' }); this.openNode(nd, '隔离器到期'); }
        }
        if (nd.tower && !nd.tower.ghostT) {
          let engaged = false;
          for (const e of this.enemies) if (!e.fly && Math.hypot(e.x - nd.x, e.y - nd.y) <= R.holdRadius) { engaged = true; break; }
          nd.engaged = engaged;
          if (engaged) {
            this.stats.holdSeconds += dt;
            nd.hold += dt * (nd.tower.s.holdRate || 1);
            if (nd.hold >= R.holdEvery) { nd.hold -= R.holdEvery; this.addIntel(1, nd); }
          }
        } else nd.engaged = false;
      }
      // 协议降级区
      let changed = false;
      for (const z of this.zones) {
        z.t -= dt;
        if (z.t <= 0) { for (const i of z.tiles) this.zoneCount[i]--; changed = true; this.emit('zoneEnd', { zone: z }); }
      }
      if (changed) { this.zones = this.zones.filter(z => z.t > 0); this.log('info', '协议降级结束，链路恢复'); this.converge('协议降级结束'); }
      // 残留场
      for (const r of this.residues) r.t -= dt;
      if (this.residues.length) this.residues = this.residues.filter(r => r.t > 0);
      // Boss 预警
      for (const w of this.warnings.slice()) {
        w.t -= dt;
        if (w.t <= 0) { this.warnings.splice(this.warnings.indexOf(w), 1); this.resolveWarning(w); }
      }
      // 黑洞 / 锁死段
      let hc = false;
      for (const h of this.holes) {
        h.t -= dt;
        if (h.t <= 0) { hc = true; this.emit('holeClose', { hole: h }); }
      }
      if (hc) { this.holes = this.holes.filter(h => h.t > 0); this.converge('临时封锁解除'); }
    }

    // ────────── 塔 ──────────
    stepTower(t, dt) {
      t.fireAnim = Math.max(0, t.fireAnim - dt * 3.5);
      t.hitAnim = Math.max(0, t.hitAnim - dt * 4);
      if (t.redirectCd > 0) t.redirectCd -= dt;
      if (t.ghostT > 0) {
        t.ghostT -= dt;
        if (t.ghostT <= 0) { this.emit('towerGhostEnd', { tower: t }); this.removeTower(t, '残影消散'); return; }
        this.lureStep(t, dt);
        return;
      }
      if (t.encT > 0) { t.encT -= dt; if (t.encT <= 0) { t.encT = 0; this.emit('decrypt', { tower: t, natural: true }); } }
      if (t.skillCd > 0) t.skillCd -= dt;
      if (t.skillT > 0) {
        t.skillT -= dt;
        if (t.skillT <= 0) { t.skillT = 0; this.trimBlocked(t); }
      }
      if (t.shieldT > 0) { t.shieldT -= dt; if (t.shieldT <= 0) { t.shield = 0; this.emit('shieldEnd', { tower: t }); } }
      if (t.cd > 0) t.cd -= dt;
      t.healTargets.length = 0;
      t.attackTarget = null;
      const s = t.s;
      if (t.encT > 0) return;
      switch (t.type) {
        case 'firewall': {
          if (t.blocked.length && t.cd <= 0) {
            t.cd = s.rate;
            t.fireAnim = 1;
            if (t.level >= 2) for (const e of t.blocked.slice()) this.damageEnemy(e, s.dmg, { tower: t, kind: 'melee' });
            else this.damageEnemy(t.blocked[0], s.dmg, { tower: t, kind: 'melee' });
            this.emit('firewallStrike', { tower: t, targets: t.level >= 2 ? t.blocked.slice() : t.blocked.slice(0, 1) });
          }
          break;
        }
        case 'honeypot': this.lureStep(t, dt); break;
        case 'interceptor': this.interceptorStep(t, dt, s); break;
        case 'sandbox': this.sandboxStep(t, dt, s); break;
        case 'repair': this.repairStep(t, dt, s); break;
      }
    }

    trimBlocked(t) {
      const cap = this.blockCap(t);
      while (this.blockLoad(t) > cap && t.blocked.length) {
        const e = t.blocked.pop();
        e.blockedBy = null;
      }
    }

    blockCap(t) {
      let c = t.s.block || 0;
      if (t.type === 'firewall' && t.skillT > 0) c += t.def.skill.blockBonus;
      return c;
    }
    blockLoad(t) { let l = 0; for (const e of t.blocked) l += e.def.block; return l; }

    lureStep(t) {
      const r = t.s.lureR;
      if (this.blockLoad(t) + t.claims >= this.blockCap(t)) return;
      for (const e of this.enemies) {
        if (e.dead || e.fly || !e.def.lurable || e.blockedBy || e.mode !== 'route') continue;
        if (Math.abs(e.x - t.x) > r || Math.abs(e.y - t.y) > r) continue;
        if (Math.hypot(e.x - t.x, e.y - t.y) > r) continue;
        if (this.blockLoad(t) + t.claims + e.def.block > this.blockCap(t)) continue;
        if (this.time < (e.nextLure || 0)) continue;
        const start = this.idx(e.tx, e.ty), goal = this.idx(t.x, t.y);
        let path;
        if (start === goal) path = [];
        else path = this.bfsPath(start, i => i === goal, Math.ceil(r + 3));
        if (path == null) { e.nextLure = this.time + 1; continue; }
        e.mode = 'lure'; e.lureT = t; e.pathOv = path; t.claims += e.def.block;
        e.nextLure = this.time + 2;
        this.emit('lured', { enemy: e, tower: t });
        if (this.blockLoad(t) + t.claims >= this.blockCap(t)) break;
      }
    }

    targetable(e) { return !e.dead && (!e.stealth || e.revealed || e.revealT > 0); }

    interceptorStep(t, dt, s) {
      const rate = t.skillT > 0 ? s.rate / t.def.skill.rateMul : s.rate;
      const half = s.arc * Math.PI / 360;
      const cands = [];
      for (const e of this.enemies) {
        if (!this.targetable(e)) continue;
        const dx = e.x - t.x, dy = e.y - t.y, d = Math.hypot(dx, dy);
        if (d > s.range || d < 0.01) continue;
        const a = Math.atan2(dy, dx);
        if (Math.abs(angleDiff(a, t.dir)) > half) continue;
        cands.push({ e, d, a });
      }
      if (!cands.length) return;
      let pick = null;
      if (t.branch === 'pierce') {
        let bestN = -1;
        for (const c of cands) {
          let n = 0;
          for (const o of this.enemies) {
            const dx = o.x - t.x, dy = o.y - t.y;
            const along = dx * Math.cos(c.a) + dy * Math.sin(c.a);
            if (along < 0 || along > s.range) continue;
            const off = Math.abs(-dx * Math.sin(c.a) + dy * Math.cos(c.a));
            if (off <= 0.55) n++;
          }
          if (n > bestN || (n === bestN && c.e.remain < pick.e.remain)) { bestN = n; pick = c; }
        }
      } else if (t.branch === 'suppress') {
        let best = INF;
        for (const c of cands) {
          const attacking = c.e.blockedBy || c.e.sieging || (c.e.def.ranged && c.e.aimTarget);
          const score = c.e.remain - (attacking && c.e.supT <= 0 ? 1000 : 0) + (c.e.supT > 0 ? 200 : 0);
          if (score < best) { best = score; pick = c; }
        }
      } else {
        let best = INF;
        for (const c of cands) if (c.e.remain < best) { best = c.e.remain; pick = c; }
      }
      t.aim = pick.a;
      t.attackTarget = pick.e;
      if (t.cd > 0) return;
      t.cd = rate;
      t.fireAnim = 1;
      if (t.branch === 'pierce') {
        const hit = [];
        for (const o of this.enemies) {
          if (o.dead) continue;
          const dx = o.x - t.x, dy = o.y - t.y;
          const along = dx * Math.cos(pick.a) + dy * Math.sin(pick.a);
          if (along < 0 || along > s.range) continue;
          const off = Math.abs(-dx * Math.sin(pick.a) + dy * Math.cos(pick.a));
          if (off <= 0.55) hit.push(o);
        }
        this.emit('railShot', { tower: t, angle: pick.a, range: s.range, hits: hit.length });
        for (const o of hit) this.damageEnemy(o, s.dmg, { tower: t, kind: 'pierce' });
      } else {
        const shot = { kind: t.branch === 'suppress' ? 'suppress' : 'bolt', x: t.x, y: t.y, z: 0, tower: t, target: pick.e, speed: 16, dmg: s.dmg, life: 2, born: this.time, sx: t.x, sy: t.y };
        this.shots.push(shot);
        this.emit('shot', { shot });
      }
    }

    sandboxStep(t, dt, s) {
      let best = null, bestR = INF;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d > s.range) continue;
        if (e.stealth && !e.revealed) {
          if (e.def.boss) { if (e.revealT < 0.3) this.emit('detected', { enemy: e, tower: t }); e.revealT = Math.max(e.revealT, 0.6); }
          else this.reveal(e, '沙箱检测', t);
        }
        if (!e.fly && e.remain < bestR) { bestR = e.remain; best = e; }
      }
      if (best) t.attackTarget = best;
      if (best && t.cd <= 0) {
        t.cd = s.rate; t.fireAnim = 1;
        const shot = { kind: 'orb', x: t.x, y: t.y, tower: t, target: best, speed: 9, dmg: s.dmg, blast: s.blast, residue: s.residue || 0, life: 3, born: this.time, sx: t.x, sy: t.y };
        this.shots.push(shot);
        this.emit('shot', { shot });
      }
    }

    repairStep(t, dt, s) {
      if (t.level >= 2 && s.purge) {
        t.purgeT -= dt;
        if (t.purgeT <= 0) {
          const v = this.towers.find(o => o !== t && o.encT > 0 && Math.hypot(o.x - t.x, o.y - t.y) <= s.range);
          if (v) { v.encT = 0; t.purgeT = s.purge; this.emit('decrypt', { tower: v, by: t }); } else t.purgeT = 0.5;
        }
      }
      const list = [];
      for (const o of this.towers) {
        if (o === t || o.ghostT > 0 || o.hp >= o.maxHp) continue;
        if (Math.hypot(o.x - t.x, o.y - t.y) <= s.range) list.push(o);
      }
      if (!list.length) return;
      list.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      const n = Math.min(s.targets, list.length);
      for (let i = 0; i < n; i++) {
        const o = list[i];
        const before = o.hp;
        o.hp = Math.min(o.maxHp, o.hp + s.heal * dt);
        this.stats.healing += o.hp - before;
        t.healTargets.push(o);
      }
    }

    reveal(e, why, tower) {
      if (!e.stealth || e.revealed) return;
      if (e.def.boss) return;
      e.revealed = true;
      this.emit('reveal', { enemy: e, why, tower });
    }

    towerDamage(t, amt, src) {
      if (t.gone || t.ghostT > 0) return;
      let a = amt;
      if ((t.type === 'firewall' || t.type === 'gate') && t.skillT > 0) a *= t.def.skill.dmgTaken;
      if (src && src.kind === 'impact' && t.s.impactTaken) a *= t.s.impactTaken;
      if (t.shield > 0) {
        const ab = Math.min(t.shield, a);
        t.shield -= ab; a -= ab;
        this.emit('shieldHit', { tower: t, amount: ab, src });
      }
      t.hp -= a;
      t.hitAnim = 1;
      this.stats.towerDamage += a;
      this.emit('towerHit', { tower: t, amount: a, src });
      if (t.hp <= 0) this.destroyTower(t, src);
    }

    destroyTower(t, src) {
      if (t.gone) return;
      this.stats.lost++;
      if (t.type === 'honeypot' && t.branch === 'net' && !t.ghostT) {
        // 残影继续诱敌
        t.ghostT = t.s.ghost;
        t.hp = 0;
        t.encT = 0;
        this.emit('towerGhost', { tower: t });
        this.log('warn', `影子蜜网被摧毁，残影继续诱敌 ${t.s.ghost} 秒`);
        return;
      }
      this.emit('towerDestroyed', { tower: t, src });
      this.log('alert', `${t.def.name} @(${t.x},${t.y}) 已被摧毁${src && src.enemy ? `（来源：${src.enemy.def.name}）` : ''}`);
      if (t.onNode) { this.stats.breaches++; this.mark(`${t.node.name}被打通`); }
      this.removeTower(t, '被摧毁');
    }

    // ────────── 弹道 ──────────
    stepShots(dt) {
      for (const s of this.shots) {
        s.life -= dt;
        if (s.target && !s.target.dead) { s.tx = s.target.x; s.ty = s.target.y; s.tz = s.target.fly ? 1 : 0; }
        if (s.tx == null) { s.done = true; continue; }
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
        const mv = s.speed * dt;
        if (d <= mv || s.life <= 0) { s.x = s.tx; s.y = s.ty; s.done = true; this.shotArrive(s); }
        else { s.x += dx / d * mv; s.y += dy / d * mv; }
      }
      if (this.shots.length) this.shots = this.shots.filter(s => !s.done);
    }

    shotArrive(s) {
      this.emit('shotHit', { shot: s });
      if (s.kind === 'bolt') {
        if (s.target && !s.target.dead) this.damageEnemy(s.target, s.dmg, { tower: s.tower, kind: 'bolt' });
      } else if (s.kind === 'suppress') {
        if (s.target && !s.target.dead) {
          const b = TD.TOWERS.interceptor.branches.suppress;
          s.target.supT = b.sup;
          this.damageEnemy(s.target, s.dmg, { tower: s.tower, kind: 'suppress' });
          this.emit('suppressed', { enemy: s.target });
        }
      } else if (s.kind === 'orb') {
        const blast = s.blast;
        this.emit('blast', { x: s.x, y: s.y, r: blast, tower: s.tower });
        for (const e of this.enemies.slice()) {
          if (e.dead || e.fly) continue;
          if (Math.hypot(e.x - s.x, e.y - s.y) <= blast) this.damageEnemy(e, s.dmg, { tower: s.tower, kind: 'blast' });
        }
        if (s.residue) {
          this.residues.push({ x: s.x, y: s.y, r: blast, t: s.residue, dur: s.residue, dps: s.dmg * 0.22 });
          this.emit('residue', { x: s.x, y: s.y, r: blast, dur: s.residue });
        }
      } else if (s.kind === 'shard') { // 勒索者
        const t = s.towerTarget;
        if (t && !t.gone && !(t.ghostT > 0)) {
          this.towerDamage(t, s.dmg, { enemy: s.enemy, kind: 'ranged' });
          if (!t.gone && !t.def.immuneEncrypt && !(t.ghostT > 0)) {
            if (t.encT <= 0) { this.emit('encrypted', { tower: t, enemy: s.enemy }); this.log('warn', `${t.def.name} @(${t.x},${t.y}) 被加密`); }
            t.encT = Math.max(t.encT, s.encrypt);
          }
        }
      }
    }

    // ────────── 敌人 ──────────
    damageEnemy(e, amt, src) {
      if (e.dead) return;
      let a = amt;
      if (e.exposedT > 0) a *= TD.TOWERS.honeypot.branches.trap.exposed;
      if (e.armor && e.armor !== 1) a *= e.armor;
      if (e.shield > 0) {
        const ab = Math.min(e.shield, a);
        e.shield -= ab; a -= ab;
        if (e.shield <= 0) this.emit('shieldBreak', { enemy: e });
      }
      e.hp -= a;
      e.hitAnim = 1;
      this.stats.damage += a;
      if (src && src.tower) src.tower.dmgDone += a;
      this.emit('enemyHit', { enemy: e, amount: a, src });
      if (e.hp <= 0) this.killEnemy(e, src);
    }

    killEnemy(e, src) {
      if (e.dead) return;
      e.dead = true;
      this.releaseEnemy(e);
      const def = e.def;
      const reward = e.clone ? Math.ceil(def.reward * 0.5) : def.reward;
      this.addCompute(reward);
      this.stats.kills[e.type] = (this.stats.kills[e.type] || 0) + 1;
      if (def.intel) this.addIntel(def.intel, e);
      if (e.trapBy && e.trapBy.branch === 'trap' && e.trapT > 0) this.addIntel(1, e);
      this.emit('enemyDie', { enemy: e, src, reward });
      if (e.stealth && !e.revealed && !def.boss && def.payload) {
        // 未显形被波及：释放载荷
        this.emit('payload', { x: e.x, y: e.y, r: def.payloadR });
        this.log('alert', `木马未显形被消灭，释放载荷 @(${Math.round(e.x)},${Math.round(e.y)})`);
        for (const t of this.towers.slice()) {
          if (Math.hypot(t.x - e.x, t.y - e.y) <= def.payloadR) this.towerDamage(t, def.payload, { enemy: e, kind: 'payload' });
        }
      }
      if (def.boss) {
        this.boss = null;
        for (const w of this.warnings.slice()) if (w.boss === e) this.warnings.splice(this.warnings.indexOf(w), 1);
        this.log('info', `${def.name}已被清除`);
        this.mark(`${def.name}被清除`);
      }
    }

    releaseEnemy(e) {
      if (e.blockedBy) {
        const t = e.blockedBy;
        const k = t.blocked.indexOf(e);
        if (k >= 0) t.blocked.splice(k, 1);
        e.blockedBy = null;
      }
      if (e.lureT) { e.lureT.claims = Math.max(0, e.lureT.claims - e.def.block); e.lureT = null; }
    }

    leak(e) {
      e.dead = true;
      this.releaseEnemy(e);
      const dmg = e.def.leak;
      this.integrity = Math.max(0, this.integrity - dmg);
      this.stats.leaks += dmg;
      this.stats.leakBy[e.type] = (this.stats.leakBy[e.type] || 0) + 1;
      const ex = this.map.exits.reduce((a, b) => Math.hypot(a.x - e.x, a.y - e.y) < Math.hypot(b.x - e.x, b.y - e.y) ? a : b);
      this.emit('enemyLeak', { enemy: e, exit: ex, dmg });
      this.log('alert', `${e.def.name}到达${ex.name}，中枢完整度 -${dmg}`);
      if (e.def.boss) { this.boss = null; this.warnings.length = 0; }
    }

    stepEnemy(e, dt) {
      e.atkAnim = Math.max(0, e.atkAnim - dt * 3);
      e.hitAnim = Math.max(0, e.hitAnim - dt * 4);
      if (e.revealT > 0) e.revealT -= dt;
      if (e.supT > 0) e.supT -= dt;
      if (e.exposedT > 0) e.exposedT -= dt;
      if (e.trapT > 0) e.trapT -= dt;
      if (e.fly) { this.stepFlyer(e, dt); return; }
      const ti = this.idx(e.tx, e.ty);
      const dstR = this.ds(e);
      e.remain = (dstR[ti] >= INF ? 999 : dstR[ti]) + Math.hypot(e.x - e.tx, e.y - e.ty);
      // 残留场
      let resSlow = 1;
      for (const r of this.residues) {
        if (Math.hypot(e.x - r.x, e.y - r.y) <= r.r) { resSlow = 0.7; this.damageEnemy(e, r.dps * dt, { kind: 'residue' }); if (e.dead) return; }
      }
      if (e.def.shieldR) this.packerStep(e, dt);
      if (e.def.boss) { this.bossStep(e, dt); if (e.dead) return; }
      this.combat(e, dt);
      if (e.dead) return;
      if (e.trapT > 0) return;
      if (e.def.siege) this.siegeStep(e, dt);
      if (!e.blockedBy && !e.sieging) this.checkBlock(e);
      if (e.blockedBy || e.sieging) return;
      this.moveEnemy(e, dt, resSlow);
    }

    stepFlyer(e, dt) {
      const ex = e.flyTo;
      const dx = ex.x - e.x, dy = ex.y - e.y, d = Math.hypot(dx, dy);
      e.remain = d;
      const sp = e.speed * (e.supT > 0 ? 0.55 : 1);
      const mv = sp * dt;
      if (d <= mv) { e.x = ex.x; e.y = ex.y; this.leak(e); return; }
      e.x += dx / d * mv; e.y += dy / d * mv;
    }

    moveEnemy(e, dt, resSlow) {
      const cur = this.idx(Math.round(e.x), Math.round(e.y));
      let sp = e.speed * (this.slow[cur] ? R.legacySpeed : 1) * resSlow * (e.supT > 0 ? TD.TOWERS.interceptor.branches.suppress.slow : 1);
      let left = sp * dt, guard = 0;
      while (left > 1e-5 && guard++ < 6) {
        const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
        if (d <= left) {
          e.x = e.tx; e.y = e.ty; left -= d;
          this.arrive(e);
          if (e.dead || e.blockedBy || e.sieging) break;
          if (e.tx === e.x && e.ty === e.y) break;
        } else { e.x += dx / d * left; e.y += dy / d * left; left = 0; }
      }
    }

    arrive(e) {
      e.fx = e.tx; e.fy = e.ty;
      const i = this.idx(e.fx, e.fy), tp = this.map.tiles[i];
      if (tp === TT.EXIT) { this.leak(e); return; }
      const nd = this.nodeByIdx[i];
      if (nd && !this.blocked[i] && e.canCopy) {
        e.canCopy = false;
        const c = this.spawn('worm', e.ent, { clone: true, hpMul: e.maxHp / e.def.hp * 0.7, at: { x: e.x, y: e.y, fx: e.fx, fy: e.fy } });
        c.lane = -e.lane;
        this.emit('wormCopy', { enemy: e, clone: c, node: nd });
      }
      if (this.slow[i] && e.stealth && !e.def.boss) this.reveal(e, '旧协议');
      if (e.pathOv) {
        while (e.pathOv.length) {
          const nx = e.pathOv.shift();
          if (nx === i) continue;
          if (this.blocked[nx] && e.mode !== 'route') { e.pathOv = null; break; }
          e.tx = nx % this.map.w; e.ty = (nx / this.map.w) | 0;
          e.lastDir = [e.tx - e.fx, e.ty - e.fy];
          return;
        }
        if (e.mode === 'siege') { e.pathOv = null; e.sieging = true; e.tx = e.fx; e.ty = e.fy; return; }
        if (e.mode === 'lure') { // 到了蜜罐所在格但没能进入阻挡（容量满）
          if (e.lureT) { e.lureT.claims = Math.max(0, e.lureT.claims - e.def.block); e.lureT = null; }
          e.mode = 'route'; e.nextLure = this.time + 4;
        }
        e.pathOv = null;
      }
      this.chooseNext(e);
    }

    checkBlock(e) {
      const ti = this.idx(e.tx, e.ty);
      const t = this.towerAt[ti];
      if (t && !t.onNode && t.s.block && Math.hypot(e.x - e.tx, e.y - e.ty) <= 0.62) {
        if (this.tryBlock(e, t)) return;
      }
      // 节点上的防火墙拦截相邻链路
      for (const nd of this.nodes) {
        const ft = nd.tower;
        if (!ft || ft.type !== 'firewall') continue;
        if (Math.abs(e.x - nd.x) + Math.abs(e.y - nd.y) > 1.4) continue;
        if (Math.hypot(e.x - nd.x, e.y - nd.y) <= 1.05 && this.tryBlock(e, ft)) return;
      }
    }

    tryBlock(e, t) {
      if (e.def.fly) return false;
      if (this.blockLoad(t) + e.def.block > this.blockCap(t)) return false;
      if (e.mode === 'lure' && e.lureT) { e.lureT.claims = Math.max(0, e.lureT.claims - e.def.block); e.lureT = null; }
      e.mode = 'route'; e.pathOv = null;
      e.blockedBy = t;
      t.blocked.push(e);
      this.reveal(e, '阻挡');
      this.emit('blockStart', { enemy: e, tower: t });
      return true;
    }

    combat(e, dt) {
      if (e.trapT > 0) return;
      const def = e.def;
      const mult = e.supT > 0 ? TD.TOWERS.interceptor.branches.suppress.atkMul : 1;
      if (def.ranged) {
        e.aimTarget = this.pickRangedTarget(e);
        e.atkT -= dt;
        if (e.aimTarget && e.atkT <= 0) {
          e.atkT = def.atkRate;
          e.atkAnim = 1;
          const shot = { kind: 'shard', x: e.x, y: e.y, enemy: e, towerTarget: e.aimTarget, tx: e.aimTarget.x, ty: e.aimTarget.y, speed: 9, dmg: def.atk * mult, encrypt: def.encrypt, life: 2 };
          this.shots.push(shot);
          this.emit('shot', { shot });
        }
        return;
      }
      if (e.sieging && e.siegeNode) {
        const nd = e.siegeNode;
        const tgt = nd.tower || nd.isolator;
        if (!tgt) return;
        e.impactT -= dt;
        if (e.impactT <= 0) {
          e.impactT = def.impactRate;
          e.atkAnim = 1;
          const dmg = def.impact * mult;
          this.emit('nodeImpact', { enemy: e, node: nd, dmg });
          if (nd.tower) this.towerDamage(nd.tower, dmg, { enemy: e, kind: 'impact' });
          else this.isolatorDamage(nd, dmg, e);
        }
        return;
      }
      if (def.boss && !e.blockedBy) {
        // Boss 经过时扫击身边的塔
        e.atkT -= dt;
        if (e.atkT <= 0) {
          let near = null, nd = 2.0;
          for (const t of this.towers) { if (t.ghostT > 0) continue; const d = Math.hypot(t.x - e.x, t.y - e.y); if (d < nd) { nd = d; near = t; } }
          if (near) {
            e.atkT = def.atkRate;
            e.atkAnim = 1;
            this.emit('enemyAttack', { enemy: e, tower: near });
            this.towerDamage(near, def.atk * mult, { enemy: e, kind: 'melee' });
          } else e.atkT = 0.2;
        }
        return;
      }
      if (e.blockedBy && def.atk) {
        e.atkT -= dt;
        if (e.atkT <= 0) {
          e.atkT = def.atkRate;
          e.atkAnim = 1;
          const t = e.blockedBy;
          this.emit('enemyAttack', { enemy: e, tower: t });
          this.towerDamage(t, def.atk * mult, { enemy: e, kind: 'melee' });
        }
      }
    }

    pickRangedTarget(e) {
      const r = e.def.range;
      let best = null, bd = INF, honey = null, hd = INF;
      for (const t of this.towers) {
        if (t.ghostT > 0) { const d = Math.hypot(t.x - e.x, t.y - e.y); if (d <= r && d < hd) { hd = d; honey = t; } continue; }
        const d = Math.hypot(t.x - e.x, t.y - e.y);
        if (d > r) continue;
        if (t.type === 'honeypot') { if (d < hd) { hd = d; honey = t; } }
        else if (d < bd) { bd = d; best = t; }
      }
      if (honey && honey.ghostT > 0) return null; // 残影吸引视线，但打不坏
      return honey || best;
    }

    isolatorDamage(nd, dmg, e) {
      const iso = nd.isolator;
      if (!iso) return;
      iso.hp -= dmg;
      iso.hitAnim = 1;
      this.emit('isolatorHit', { node: nd, amount: dmg, src: e ? { enemy: e, kind: 'impact' } : null });
      if (iso.hp <= 0) {
        nd.isolator = null;
        this.emit('isolatorEnd', { node: nd, reason: 'destroyed' });
        this.stats.breaches++;
        this.mark(`${nd.name}的隔离器被冲毁`);
        this.openNode(nd, '隔离器被冲毁');
      }
    }

    siegeStep(e, dt) {
      if (e.mode === 'siege') {
        if (!e.siegeNode || !this.nodeIsolated(e.siegeNode)) {
          e.mode = 'route'; e.sieging = false; e.siegeNode = null; e.pathOv = null;
          e.nextSiege = this.time + 0.5;
          this.retarget(e);
        }
        return;
      }
      if (e.blockedBy || e.mode === 'lure' || this.time < e.nextSiege) return;
      e.nextSiege = this.time + 0.5;
      // 找路程内最近的被隔离节点（必须有塔或隔离器可打）
      const cands = this.nodes.filter(nd => this.nodeIsolated(nd) && Math.hypot(nd.x - e.x, nd.y - e.y) <= e.def.siege);
      if (!cands.length) return;
      const start = this.idx(e.tx, e.ty);
      const isAdj = i => { for (const nd of cands) { const dx = Math.abs(nd.x - i % this.map.w), dy = Math.abs(nd.y - ((i / this.map.w) | 0)); if (dx + dy === 1) return nd; } return null; };
      let node = isAdj(start), path = [];
      if (!node) {
        path = this.bfsPath(start, i => !!isAdj(i), Math.ceil(e.def.siege));
        if (!path || !path.length) return;
        node = isAdj(path[path.length - 1]);
      }
      e.mode = 'siege'; e.siegeNode = node; e.pathOv = path;
      this.emit('siegeBegin', { enemy: e, node });
      this.log('warn', `洪泛团偏离路线，正在冲击${node.name}`);
    }

    packerStep(e, dt) {
      e.shieldT -= dt;
      if (e.shieldT > 0) return;
      e.shieldT = e.def.shieldRate;
      const hit = [];
      const amt = e.def.shieldAmt;
      for (const o of this.enemies) {
        if (o === e || o.dead || o.fly) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) > e.def.shieldR) continue;
        o.shield = Math.min(e.def.shieldCap, o.shield + amt);
        hit.push(o);
      }
      e.atkAnim = 1;
      this.emit('packerPulse', { enemy: e, targets: hit, r: e.def.shieldR });
    }

    // ────────── Boss ──────────
    bossStep(e, dt) {
      const hpf = e.hp / e.maxHp;
      const phases = e.def.phases;
      for (let p = e.phase + 1; p < phases.length; p++) {
        if (hpf <= phases[p].at) {
          e.phase = p;
          this.emit('bossPhase', { enemy: e, phase: p, name: phases[p].name });
          this.log('alert', `${e.def.name}进入阶段「${phases[p].name}」：${phases[p].desc}`);
          this.mark(`${e.def.name}进入「${phases[p].name}」`);
          if (e.type === 'zheying') {
            if (p === 1) { e.armor = 0.65; e.stealth = false; e.skill2T = 2; }
            if (p === 2) { e.skillT = 2; }
          }
          if (e.type === 'wankui' && p === 1) { e.skill2T = 1; }
          if (e.type === 'shenlou' && p === 1) { e.skill2T = 2; }
        }
      }
      // 融合近战：被挡时范围打击
      e.skillT -= dt; e.skill2T -= dt;
      if (e.type === 'wankui') {
        if (e.skillT <= 0) { e.skillT = e.phase >= 1 ? 11 : 15; this.bossSurge(e); }
        if (e.phase >= 1 && e.skill2T <= 0) { e.skill2T = 11; this.bossSwarm(e, 'worm', 6); }
      } else if (e.type === 'shenlou') {
        if (e.skillT <= 0) { e.skillT = 17; this.bossBlockAhead(e, 1, 'hole', 4, 13); }
        if (e.phase >= 1 && e.skill2T <= 0) { e.skill2T = 12; this.bossStorm(e); }
      } else if (e.type === 'zheying') {
        if (e.phase === 1 && e.skill2T <= 0) { e.skill2T = 13; this.bossSwarm(e, 'trojan', 3); }
        if (e.phase === 2 && e.skillT <= 0) { e.skillT = 18; this.bossBlockAhead(e, 3, 'lock', 4, 14); }
      }
    }

    bossSurge(e) {
      // 洪峰：优先被隔离节点，其次最近的塔
      let best = null, bd = INF;
      for (const nd of this.nodes) {
        if (!this.nodeIsolated(nd)) continue;
        const d = Math.hypot(nd.x - e.x, nd.y - e.y);
        if (d < bd) { bd = d; best = nd; }
      }
      if (best) {
        this.warnings.push({ kind: 'surge', tiles: [best.idx], t: 3, tmax: 3, boss: e, node: best, x: best.x, y: best.y });
        this.emit('bossWarn', { kind: 'surge', boss: e, tiles: [best.idx], x: best.x, y: best.y, text: `「洪峰」3 秒后冲击${best.name}` });
        this.log('alert', `万傀锁定${best.name}，洪峰预警`);
      } else {
        let t0 = null; bd = 9;
        for (const t of this.towers) { const d = Math.hypot(t.x - e.x, t.y - e.y); if (d < bd && !(t.ghostT > 0)) { bd = d; t0 = t; } }
        if (t0) {
          this.warnings.push({ kind: 'surge', tiles: [this.idx(t0.x, t0.y)], t: 3, tmax: 3, boss: e, towerT: t0, x: t0.x, y: t0.y });
          this.emit('bossWarn', { kind: 'surge', boss: e, tiles: [this.idx(t0.x, t0.y)], x: t0.x, y: t0.y, text: `「洪峰」3 秒后冲击${t0.def.name}` });
        }
      }
      e.atkAnim = 1;
    }

    bossSwarm(e, type, count) {
      for (let k = 0; k < count; k++) {
        const c = this.spawn(type, e.ent, { hpMul: 1, clone: true, at: { x: e.x, y: e.y, fx: e.fx, fy: e.fy, tx: e.tx, ty: e.ty } });
        c.lane = (this.rand() - 0.5) * 0.7;
        c.canCopy = false;
      }
      e.atkAnim = 1;
      this.emit('bossSwarm', { enemy: e, swarm: type, count });
      this.log('alert', `${e.def.name}释放 ${count} 只${TD.ENEMIES[type].name}`);
    }

    bossStorm(e) {
      const r = 6;
      e.atkAnim = 1;
      const hit = [];
      for (const t of this.towers.slice()) {
        if (Math.hypot(t.x - e.x, t.y - e.y) <= r) {
          t.shield *= 0.5;
          this.towerDamage(t, 34, { enemy: e, kind: 'storm' });
          hit.push(t);
        }
      }
      this.emit('bossStorm', { enemy: e, r, targets: hit });
      this.log('alert', `路由风暴：半径 ${r} 格内的塔护盾减半`);
    }

    // 沿 Boss 路线前方选一段可封锁的链路；会封死就改选别处
    bossBlockAhead(e, count, kind, warn, dur) {
      const tiles = this.pickBlockTiles(e, count, kind);
      if (!tiles) return;
      const i = tiles[0];
      const w = { kind, tiles, t: warn, tmax: warn, boss: e, dur, x: i % this.map.w, y: (i / this.map.w) | 0 };
      this.warnings.push(w);
      e.atkAnim = 1;
      const txt = kind === 'hole' ? `「伪路由」将在 ${warn} 秒后制造路由黑洞` : `蛰影将在 ${warn} 秒后锁死前方运维环`;
      this.emit('bossWarn', { kind, boss: e, tiles, x: w.x, y: w.y, text: txt });
      this.log('alert', txt);
    }

    pickBlockTiles(e, count, kind) {
      const start = this.idx(e.tx, e.ty);
      const route = this.walkRoute(start, this.ds(e), this.bk(e), this.slow);
      const ok = (seg) => {
        for (const i of seg) {
          const tp = this.map.tiles[i];
          if (tp === TT.ENTRANCE || tp === TT.EXIT) return false;
          if (this.blocked[i] || this.towerAt[i]) return false;
        }
        const blk = new Uint8Array(this.blocked);
        for (const i of seg) blk[i] = 1;
        const dist = this.computeDist(blk, this.slow);
        this._pendingHole = seg;
        const r = this.findSealed(dist, blk).length === 0;
        this._pendingHole = null;
        return r;
      };
      // 第一选择：路线前方 3~12 格
      for (let a = 3; a < Math.min(route.length - count, 14); a++) {
        const seg = route.slice(a, a + count);
        if (seg.length === count && ok(seg)) return seg;
      }
      // 改选：路线上的其他位置，再退到全图
      for (let a = 1; a < route.length - count; a++) {
        const seg = route.slice(a, a + count);
        if (seg.length === count && ok(seg)) return seg;
      }
      for (const key in this.routes) {
        const r = this.routes[key].path;
        for (let a = 2; a < r.length - count; a++) {
          const seg = r.slice(a, a + count);
          if (seg.length === count && ok(seg)) return seg;
        }
      }
      if (count > 1) return this.pickBlockTiles(e, count - 1, kind);
      return null;
    }

    resolveWarning(w) {
      if (w.boss && w.boss.dead) return;
      if (w.kind === 'surge') {
        const e = w.boss;
        e.atkAnim = 1;
        if (w.node) {
          const nd = w.node;
          this.emit('bossSurge', { enemy: e, x: nd.x, y: nd.y, node: nd });
          this.log('alert', `洪峰冲击${nd.name}`);
          if (nd.tower) this.towerDamage(nd.tower, nd.tower.maxHp * 0.42 + 90, { enemy: e, kind: 'impact' });
          else if (nd.isolator) this.isolatorDamage(nd, 99999, e);
        } else if (w.towerT && !w.towerT.gone) {
          this.emit('bossSurge', { enemy: e, x: w.towerT.x, y: w.towerT.y });
          this.towerDamage(w.towerT, 180, { enemy: e, kind: 'impact' });
        }
        // 冲击波及周围
        for (const t of this.towers.slice()) {
          const d = Math.hypot(t.x - w.x, t.y - w.y);
          if (d > 0.1 && d <= 2.2) this.towerDamage(t, 60, { enemy: e, kind: 'impact' });
        }
        return;
      }
      // 黑洞 / 锁死：落地前再验证一次，会封死就改选
      let tiles = w.tiles;
      const test = () => {
        const blk = new Uint8Array(this.blocked);
        for (const i of tiles) blk[i] = 1;
        const dist = this.computeDist(blk, this.slow);
        this._pendingHole = tiles;
        const r = this.findSealed(dist, blk).length === 0 && tiles.every(i => !this.towerAt[i]);
        this._pendingHole = null;
        return r;
      };
      if (!test()) {
        const alt = this.pickBlockTiles(w.boss, tiles.length, w.kind);
        if (!alt) return;
        tiles = alt;
        this.log('warn', `${w.boss.def.name}改选封锁位置以避免封死路由`);
      }
      const h = { kind: w.kind, tiles, t: w.dur, dur: w.dur, boss: w.boss };
      this.holes.push(h);
      this.emit('holeOpen', { hole: h });
      this.converge(w.kind === 'hole' ? `${w.boss.def.name}制造路由黑洞` : `${w.boss.def.name}锁死运维环`);
    }

    checkEnd() {
      if (this.over) return;
      if (this.opts.demo) { if (this.integrity < 3) this.integrity = 3; return; }
      if (this.integrity <= 0) {
        this.over = 'defeat';
        this.emit('defeat', {});
        this.log('alert', '中枢完整度归零，防线失守');
        this.mark('中枢失守');
        return;
      }
      if (!this.opts.demo && this.waveState === 'final' && this.enemies.length === 0) {
        this.over = 'victory';
        this.emit('victory', {});
        this.log('info', '全部波次已处置，入侵流量清零');
        this.mark('入侵流量清零');
      }
    }

    // ────────── 外部查询 ──────────
    forecast(waveIdx) {
      const w = this.def.waves[waveIdx];
      if (!w) return null;
      const byEnt = {};
      for (const g of w.groups) {
        const [type, count, ent] = g;
        const row = byEnt[ent] = byEnt[ent] || {};
        row[type] = (row[type] || 0) + count;
      }
      return { label: w.label, surge: !!w.surge, boss: w.boss, byEnt, index: waveIdx };
    }

    towerById(id) { return this.towers.find(t => t.id === id) || null; }
    enemyById(id) { return this.enemies.find(e => e.id === id) || null; }
  }

  TD.Game = Game;
  TD.INF = INF;
})(typeof window !== 'undefined' ? window : globalThis);
