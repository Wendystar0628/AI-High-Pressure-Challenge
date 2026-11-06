"use strict";
class Game {
  constructor(index = 0) {
    this.map = makeMap(index);
    this.time = 0;
    this.compute = 510;
    this.intel = 36;
    this.integrity = 100;
    this.wave = 0;
    this.running = false;
    this.over = false;
    this.speed = 1;
    this.paused = false;
    this.towers = [];
    this.enemies = [];
    this.effects = [];
    this.cooldowns = {};
    this.nodeCooldown = {};
    this.hazards = [];
    this.downgrades = [];
    this.routes = {};
    this.queue = [];
    this.waveTime = 0;
    this.intermission = 0;
    this.uid = 0;
    this.seed = 8321 + index;
    this.stats = {
      kills: 0,
      lost: 0,
      built: 0,
      destroyed: 0,
      reroutes: 0,
      healed: 0,
    };
    this.known = new Set();
    this.events = [];
    this.recompute(false);
  }
  random() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  emit(type, data = {}) {
    this.events.push({ type, ...data, time: this.time });
    if (this.events.length > 500) this.events.shift();
    if (this.onEvent) this.onEvent(type, data);
  }
  cell(id) {
    return this.map.cells.get(id);
  }
  towerAt(id) {
    return this.towers.find((t) => t.cell === id && !t.dead);
  }
  blocked(extra) {
    const b = new Set(
      this.towers
        .filter((t) => !t.dead && this.cell(t.cell).type === "node")
        .map((t) => t.cell),
    );
    this.hazards.forEach((h) => {
      if (h.active) h.cells.forEach((id) => b.add(id));
    });
    if (extra) extra.forEach((id) => b.add(id));
    return b;
  }
  slow(c, preview) {
    return (
      c.old ||
      this.downgrades.some(
        (d) => Math.hypot(c.x - d.x, c.y - d.y) <= d.range,
      ) ||
      (preview && Math.hypot(c.x - preview.x, c.y - preview.y) <= preview.range)
    );
  }
  travelCost(c, preview) {
    let cost = c.old ? c.cost || 1.8 : 1;
    if (
      this.downgrades.some(
        (d) => Math.hypot(c.x - d.x, c.y - d.y) <= d.range,
      ) ||
      (preview && Math.hypot(c.x - preview.x, c.y - preview.y) <= preview.range)
    )
      cost = Math.max(cost, 1 / 0.55);
    return cost;
  }
  path(start, blocked = this.blocked(), targets = null, preview = null) {
    if (
      !["road", "node", "entry", "exit"].includes(this.cell(start)?.type) ||
      blocked.has(start)
    )
      return null;
    const goal = targets || this.map.exits.map((e) => e.x + "," + e.y),
      dist = new Map([[start, 0]]),
      prev = new Map(),
      open = [start],
      done = new Set();
    while (open.length) {
      let best = 0;
      for (let i = 1; i < open.length; i++)
        if (dist.get(open[i]) < dist.get(open[best])) best = i;
      let id = open.splice(best, 1)[0];
      if (done.has(id)) continue;
      done.add(id);
      if (goal.includes(id)) {
        let p = [id];
        while (prev.has(p[0])) p.unshift(prev.get(p[0]));
        return {
          cells: p,
          cost: dist.get(id),
          exit: this.cell(id).exit?.id || id,
        };
      }
      const c = this.cell(id);
      for (const [dx, dy] of [
        [0, 1],
        [1, 0],
        [-1, 0],
        [0, -1],
      ]) {
        let n = this.cell(c.x + dx + "," + (c.y + dy));
        if (
          !n ||
          !["road", "node", "entry", "exit"].includes(n.type) ||
          blocked.has(n.id)
        )
          continue;
        let d =
          dist.get(id) +
          (this.travelCost(c, preview) + this.travelCost(n, preview)) / 2;
        if (d < (dist.get(n.id) ?? Infinity)) {
          dist.set(n.id, d);
          prev.set(n.id, id);
          open.push(n.id);
        }
      }
    }
    return null;
  }
  preview(id, kind) {
    let b = this.blocked(),
      sl = null;
    if (kind === "downgrade") {
      let c = this.cell(id);
      sl = { x: c.x, y: c.y, range: 2.6 };
    } else b.add(id);
    let routes = {},
      invalid = [],
      invalidCells = [];
    for (const e of this.map.entries) {
      let p = this.path(e.x + "," + e.y, b, null, sl);
      routes[e.id] = p;
      if (!p) {
        invalid.push("入口 " + e.id + "（" + e.x + "," + e.y + "）");
        invalidCells.push(e.x + "," + e.y);
      }
    }
    for (const e of this.enemies.filter((e) => !e.dead && e.type !== "flyer")) {
      if (b.has(e.cell) || !this.path(e.cell, b, null, sl)) {
        invalid.push("在场 " + ENEMIES[e.type].name + "（" + e.cell + "）");
        invalidCells.push(e.cell);
      }
    }
    return {
      valid: invalid.length === 0,
      invalid,
      invalidCells: [...new Set(invalidCells)],
      routes,
      changed: Object.keys(routes).filter(
        (k) =>
          JSON.stringify(routes[k]?.cells) !==
          JSON.stringify(this.routes[k]?.cells),
      ),
    };
  }
  recompute(announce = true) {
    let old = this.routes;
    this.routes = {};
    for (const e of this.map.entries)
      this.routes[e.id] = this.path(e.x + "," + e.y);
    // A reverse, multi-source distance field also ranks enemies on detours.
    // A route to a lure or siege position is not a route to the core.
    this.exitDistance = new Map();
    const blocked = this.blocked(),
      open = [];
    for (const exit of this.map.exits) {
      const id = exit.x + "," + exit.y;
      this.exitDistance.set(id, 0);
      open.push(id);
    }
    while (open.length) {
      open.sort((a, b) => this.exitDistance.get(a) - this.exitDistance.get(b));
      const id = open.shift(),
        c = this.cell(id);
      for (const [dx, dy] of [
        [0, 1],
        [1, 0],
        [-1, 0],
        [0, -1],
      ]) {
        const n = this.cell(c.x + dx + "," + (c.y + dy));
        if (
          !n ||
          !["road", "node", "entry", "exit"].includes(n.type) ||
          blocked.has(n.id)
        )
          continue;
        const cost =
          this.exitDistance.get(id) +
          (this.travelCost(c) + this.travelCost(n)) / 2;
        if (cost < (this.exitDistance.get(n.id) ?? Infinity)) {
          this.exitDistance.set(n.id, cost);
          if (!open.includes(n.id)) open.push(n.id);
        }
      }
    }
    for (const e of this.enemies) {
      if (e.type === "flyer" || e.dead) continue;
      e.next = e.cell;
      e.route = null;
      e.siege = null;
    }
    let changed = Object.keys(this.routes).filter(
      (k) =>
        JSON.stringify(this.routes[k]?.cells) !== JSON.stringify(old[k]?.cells),
    );
    if (announce) {
      this.stats.reroutes++;
      this.emit("route", { changed, routes: this.routes });
    }
    this.emit("topology", {});
  }
  distanceToExit(e) {
    if (e.type === "flyer")
      return Math.hypot(e.target.x - e.x, e.target.y - e.y);
    const destination = this.cell(e.next || e.cell),
      anchor = this.cell(e.cell);
    if (!destination || !anchor) return Infinity;
    return (
      (this.exitDistance.get(destination.id) ?? Infinity) +
      (Math.hypot(destination.x - e.x, destination.y - e.y) *
        (this.travelCost(anchor) + this.travelCost(destination))) /
        2
    );
  }
  capacity(t) {
    return (TOWERS[t.type]?.capacity || 2) + (t.level === 2 ? 2 : 0);
  }
  canPlace(kind, id) {
    const c = this.cell(id);
    if (!c) return "请选择战场中的有效地块";
    if (ITEMS[kind]) {
      let d = ITEMS[kind];
      if ((this.cooldowns[kind] || 0) > 0) return "道具冷却中";
      if (this[d.resource] < d.cost) return "资源不足";
      if (kind === "restore")
        return this.towerAt(id) ? null : "请选择一座友方设备";
      if (kind === "downgrade")
        return ["road", "node", "entry", "exit"].includes(c.type)
          ? null
          : "请选择链路区域";
      if (c.type !== "node" || this.towerAt(id) || this.blocked().has(id))
        return "需要一个直通交换节点";
    } else {
      let d = TOWERS[kind];
      if (this.towerAt(id)) return "该位置已有设备";
      let allowed =
        kind === "gate"
          ? ["node"]
          : kind === "firewall"
            ? ["road", "node"]
            : kind === "honey"
              ? ["road"]
              : ["platform"];
      if (!allowed.includes(c.type)) return "部署位置不符：" + d.place;
      let intel = d.intel + (kind === "firewall" && c.type === "node" ? 6 : 0);
      if (this.compute < d.cost || this.intel < intel) return "算力或情报不足";
    }
    if (c.type === "node" && kind !== "restore" && kind !== "downgrade") {
      if ((this.nodeCooldown[id] || 0) > 0)
        return (
          "旁路保护中，" + Math.ceil(this.nodeCooldown[id]) + " 秒后可隔离"
        );
      let p = this.preview(id, kind);
      if (!p.valid) return "拒绝隔离：" + p.invalid.join("、") + " 将无路可走";
    }
    return null;
  }
  place(kind, id, dir = 0, free = false) {
    let err = this.canPlace(kind, id);
    if (err && !free) {
      this.emit("error", { message: err, cell: id });
      return false;
    }
    let c = this.cell(id);
    if (!c) return false;
    if (ITEMS[kind]) {
      let d = ITEMS[kind];
      if (!free) this[d.resource] -= d.cost;
      this.cooldowns[kind] = d.cd;
      if (kind === "restore") {
        let t = this.towerAt(id);
        if (!t) return false;
        this.heal(t, 160);
        t.encrypted = 0;
        this.emit("skill", { kind, x: c.x, y: c.y, range: 0.9 });
      }
      if (kind === "downgrade") {
        this.downgrades.push({
          x: c.x,
          y: c.y,
          range: 2.6,
          end: this.time + 14,
        });
        this.recompute();
        this.emit("skill", { kind, x: c.x, y: c.y, range: 2.6 });
      }
      if (kind === "isolate") {
        let t = {
          id: ++this.uid,
          type: "isolate",
          cell: id,
          x: c.x,
          y: c.y,
          hp: 220,
          maxHp: 220,
          level: 1,
          shield: 0,
          encrypted: 0,
          cd: 0,
          skillCd: 0,
          dir,
          end: this.time + 18,
        };
        this.towers.push(t);
        this.emit("build", { tower: t });
        this.recompute();
      }
      return true;
    }
    let d = TOWERS[kind];
    if (!free) {
      this.compute -= d.cost;
      this.intel -=
        d.intel + (kind === "firewall" && c.type === "node" ? 6 : 0);
    }
    let t = {
      id: ++this.uid,
      type: kind,
      cell: id,
      x: c.x,
      y: c.y,
      hp: d.hp,
      maxHp: d.hp,
      level: 1,
      shield: 0,
      encrypted: 0,
      cd: 0.1,
      skillCd: 0,
      dir,
      paid: d.cost,
      lastHit: -10,
      boost: 0,
    };
    this.towers.push(t);
    this.stats.built++;
    this.emit("build", { tower: t });
    if (c.type === "node") this.recompute();
    return t;
  }
  upgrade(t, branch) {
    if (t.dead || t.level === 2 || t.type === "isolate") return false;
    const d = TOWERS[t.type],
      cost = Math.round(d.cost * 0.8),
      intel = d.branches ? 8 : 3;
    if (this.compute < cost || this.intel < intel) {
      this.emit("error", {
        message: "升级需要 " + cost + " 算力 / " + intel + " 情报",
      });
      return false;
    }
    this.compute -= cost;
    this.intel -= intel;
    t.level = 2;
    t.branch = branch || 0;
    t.maxHp = Math.round(d.hp * 1.6);
    t.hp = Math.min(t.maxHp, t.hp + d.hp * 0.6);
    this.emit("upgrade", { tower: t });
    return true;
  }
  sell(t) {
    if (t.dead) return;
    this.compute += Math.floor((t.paid || 0) * 0.55);
    this.removeTower(t, "撤回");
  }
  removeTower(t, reason = "摧毁") {
    t.dead = true;
    if (reason === "摧毁") this.stats.destroyed++;
    this.emit("towerLost", { tower: t, reason });
    if (this.cell(t.cell).type === "node") {
      this.nodeCooldown[t.cell] = 8;
      this.recompute();
    }
  }
  skill(t) {
    if (t.dead || t.type === "isolate" || t.encrypted > 0 || t.skillCd > 0)
      return false;
    let d = TOWERS[t.type];
    t.skillCd = d.cd;
    let r = d.range + (t.level - 1) * 0.6;
    if (t.type === "honey") r = t.level === 2 && t.branch === 0 ? 4.5 : 3.2;
    if (t.type === "repair") {
      this.towers
        .filter((a) => !a.dead && Math.hypot(a.x - t.x, a.y - t.y) <= r)
        .forEach((a) => {
          a.shield += 100;
          a.encrypted = 0;
          this.emit("heal", { from: t, to: a, amount: 0 });
        });
    }
    if (t.type === "honey")
      this.enemies
        .filter(
          (e) => e.type !== "flyer" && Math.hypot(e.x - t.x, e.y - t.y) <= r,
        )
        .forEach((e) => (e.root = t.level === 2 && t.branch === 0 ? 7 : 4));
    if (t.type === "firewall") {
      t.shield += 90;
      this.enemies
        .filter(
          (e) => e.type !== "flyer" && Math.hypot(e.x - t.x, e.y - t.y) <= 2,
        )
        .forEach((e) => this.damageEnemy(e, 40, t));
    }
    if (t.type === "gate") t.shield += 150;
    if (t.type === "interceptor") t.boost = 6;
    if (t.type === "sandbox")
      this.enemies
        .filter((e) => Math.hypot(e.x - t.x, e.y - t.y) <= r + 2)
        .forEach((e) => {
          e.reveal = 10;
          if (e.type !== "flyer") this.damageEnemy(e, 55, t);
        });
    this.emit("skill", { kind: t.type, x: t.x, y: t.y, range: r });
    return true;
  }
  startWave() {
    if (this.running || this.over) return;
    this.wave++;
    this.queue = wavePlan(this.map, this.wave);
    this.waveTime = 0;
    this.running = true;
    this.intermission = 0;
    this.emit("wave", {
      wave: this.wave,
      flood: this.wave === 8 && this.map.index > 0,
    });
  }
  spawn(type, entry = "A", at = null, clone = false) {
    const d = ENEMIES[type],
      en = this.map.entries.find((e) => e.id === entry) || this.map.entries[0],
      c = at ? this.cell(at) : this.cell(en.x + "," + en.y),
      scale = 1 + Math.max(0, this.wave - 3) * 0.055;
    let e = {
      id: ++this.uid,
      type,
      entry,
      x: c.x,
      y: c.y,
      cell: c.id,
      next: null,
      route: null,
      hp: d.hp * (d.boss ? 1 : scale),
      maxHp: d.hp * (d.boss ? 1 : scale),
      shield: 0,
      cd: 1,
      root: 0,
      slow: 0,
      reveal: 0,
      cloned: clone,
      phase: 0,
      age: 0,
      ability: 5,
      dead: false,
    };
    if (type === "flyer") {
      let near = this.map.exits
        .slice()
        .sort(
          (a, b) =>
            Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y),
        )[0];
      e.target = near;
    }
    this.enemies.push(e);
    this.emit("spawn", { enemy: e, newType: !this.known.has(type) });
    this.known.add(type);
    return e;
  }
  damageEnemy(e, n, source) {
    if (e.dead) return;
    if (e.type === "boss2" && e.phase >= 1) n *= 0.7;
    let absorbed = Math.min(e.shield, n);
    e.shield -= absorbed;
    n -= absorbed;
    e.hp -= n;
    e.hit = 0.22;
    if (e.hp <= 0) {
      e.dead = true;
      this.stats.kills++;
      this.compute += ENEMIES[e.type].reward;
      if (["shell", "ransom", "flood"].includes(e.type)) this.intel += 2;
      if (e.type === "trojan" && e.reveal <= 0) {
        this.towers
          .filter((t) => !t.dead && Math.hypot(t.x - e.x, t.y - e.y) < 2)
          .forEach((t) => this.damageTower(t, 38, e));
        this.emit("burst", { x: e.x, y: e.y, color: 0xff8caa, range: 2 });
      }
      this.emit("kill", { enemy: e, source });
    }
  }
  damageTower(t, n, source) {
    if (t.dead) return;
    if (source && ENEMIES[source.type]) {
      source.attacking = 0.32;
      source.attackAngle = Math.atan2(t.x - source.x, t.y - source.y);
    }
    let absorbed = Math.min(t.shield, n);
    t.shield -= absorbed;
    t.hp -= n - absorbed;
    t.lastHit = this.time;
    t.hit = 0.25;
    this.emit("enemyAttack", {
      from: source,
      to: t,
      amount: n,
      healthDamage: n - absorbed,
      shieldDamage: absorbed,
    });
    if (t.type === "honey" && t.level === 2 && t.branch === 1)
      this.enemies
        .filter(
          (e) =>
            !e.dead &&
            e.type !== "flyer" &&
            Math.hypot(e.x - t.x, e.y - t.y) < 2,
        )
        .forEach((e) => this.damageEnemy(e, 10, t));
    if (t.hp <= 0) this.removeTower(t);
  }
  heal(t, n) {
    let amount = Math.min(t.maxHp - t.hp, n);
    t.hp += amount;
    this.stats.healed += amount;
    return amount;
  }
  safeHazardCells(ids) {
    let proposed = [];
    for (const id of ids) {
      let c = this.cell(id);
      if (!c || c.type !== "road" || this.towerAt(id) || this.blocked().has(id))
        continue;
      const b = this.blocked([...proposed, id]);
      if (
        this.map.entries.every((e) => this.path(e.x + "," + e.y, b)) &&
        this.enemies
          .filter((e) => !e.dead && e.type !== "flyer")
          .every((e) => this.path(e.cell, b))
      )
        proposed.push(id);
    }
    if (!proposed.length) {
      const origin = this.cell(ids[0]);
      const alternatives = [...this.map.cells.values()]
        .filter(
          (c) =>
            c.type === "road" &&
            !this.towerAt(c.id) &&
            !this.blocked().has(c.id),
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - (origin?.x || 0), a.y - (origin?.y || 0)) -
            Math.hypot(b.x - (origin?.x || 0), b.y - (origin?.y || 0)),
        );
      const safe = alternatives.find((c) => {
        const b = this.blocked([c.id]);
        return (
          this.map.entries.every((e) => this.path(e.x + "," + e.y, b)) &&
          this.enemies
            .filter((e) => !e.dead && e.type !== "flyer")
            .every((e) => this.path(e.cell, b))
        );
      });
      if (!safe) return [];
      proposed.push(safe.id);
    }
    return proposed;
  }
  setHazard(ids, duration = 10, warning = 2) {
    const proposed = this.safeHazardCells(ids);
    if (!proposed.length) return false;
    this.hazards.push({
      cells: proposed,
      active: false,
      start: this.time + warning,
      end: this.time + warning + duration,
      duration,
    });
    this.emit("warning", {
      cells: proposed,
      message: "拓扑告警 · " + warning + " 秒后链路中断",
    });
    return true;
  }
  bossAbility(e, dt) {
    let d = ENEMIES[e.type];
    if (!d.boss) return;
    let phase = e.hp / e.maxHp < 0.35 ? 2 : e.hp / e.maxHp < 0.68 ? 1 : 0;
    if (phase > e.phase) {
      e.phase = phase;
      this.emit("bossPhase", { enemy: e });
      if (e.type === "boss0")
        for (let i = 0; i < 5; i++) this.spawn("worm", e.entry, e.cell, true);
      if (e.type === "boss2") {
        for (let i = 0; i < 3; i++) this.spawn("trojan", e.entry, e.cell, true);
        if (phase === 2) {
          let p = this.path(e.cell);
          if (p) this.setHazard(p.cells.slice(3, 6), 12, 2);
        }
      }
    }
    e.ability -= dt;
    if (e.ability <= 0) {
      e.ability = 9;
      if (e.type === "boss0") {
        let ts = this.towers.filter(
          (t) => !t.dead && this.cell(t.cell).type === "node",
        );
        ts.forEach((t) =>
          this.damageTower(t, t.type === "isolate" ? 230 : 110, e),
        );
        this.emit("burst", { x: e.x, y: e.y, color: d.color, range: 4 });
      }
      if (e.type === "boss1") {
        let p = this.path(e.cell);
        if (p) this.setHazard(p.cells.slice(3, 5), 8, 2);
        if (e.phase >= 1)
          this.towers
            .filter((t) => Math.hypot(t.x - e.x, t.y - e.y) < 5)
            .forEach((t) => (t.shield *= 0.3));
      }
    }
  }
  move(e, dt) {
    const d = ENEMIES[e.type];
    e.block = null;
    if (e.type === "flyer") {
      let dx = e.target.x - e.x,
        dy = e.target.y - e.y,
        dist = Math.hypot(dx, dy);
      if (dist < 0.08) {
        this.leak(e);
        return;
      }
      let step = Math.min(dist, d.speed * dt * (e.slow > 0 ? 0.5 : 1));
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
      e.angle = Math.atan2(dx, dy);
      return;
    }
    let blockers = this.towers.filter(
      (t) =>
        !t.dead &&
        ["firewall", "honey"].includes(t.type) &&
        Math.hypot(e.x - t.x, e.y - t.y) <
          (this.cell(t.cell).type === "node" ? 1.32 : 0.85),
    );
    for (let t of blockers) {
      let cap = this.capacity(t);
      if ((t.blocked || 0) + d.weight <= cap) {
        t.blocked = (t.blocked || 0) + d.weight;
        e.block = t.id;
        e.reveal = 5;
        if (e.cd <= 0) {
          this.damageTower(t, d.damage, e);
          e.cd = d.rate;
        }
        return;
      }
    }
    if (e.siege && !e.siege.dead && this.cell(e.siege.cell).type === "node") {
      let dist = Math.hypot(e.x - e.siege.x, e.y - e.siege.y);
      if (dist < 1.25) {
        e.block = e.siege.id;
        if (e.cd <= 0) {
          this.damageTower(
            e.siege,
            d.damage * (e.type === "flood" ? 1.35 : 1),
            e,
          );
          e.cd = d.rate;
        }
        e.reveal = 5;
        return;
      }
    }
    if (e.root > 0) return;
    // Reconsider targets at cell boundaries, never jump backwards mid-edge.
    if (!e.route || (!e.next && e.routeCell !== e.cell)) {
      e.routeCell = e.cell;
      e.route = null;
      e.siege = null;
      let target = null;
      if (e.type === "flood" || e.type === "boss0") {
        let nodes = this.towers
          .filter(
            (t) =>
              !t.dead &&
              this.cell(t.cell).type === "node" &&
              Math.hypot(t.x - e.x, t.y - e.y) < 6,
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - e.x, a.y - e.y) -
              Math.hypot(b.x - e.x, b.y - e.y),
          );
        target = nodes[0];
      }
      let honey = this.towers.filter(
        (t) =>
          !t.dead &&
          t.type === "honey" &&
          (t.blocked || 0) + d.weight <= this.capacity(t) &&
          Math.hypot(t.x - e.x, t.y - e.y) <
            (t.level === 2 && t.branch === 0 ? 4.5 : 3.2),
      );
      honey.sort(
        (a, b) =>
          Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y),
      );
      if (honey.length) target = honey[0];
      if (target) {
        let goals =
          this.cell(target.cell).type === "node"
            ? [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ]
                .map(([dx, dy]) => target.x + dx + "," + (target.y + dy))
                .filter(
                  (id) => this.cell(id) && this.cell(id).type !== "platform",
                )
            : [target.cell];
        let p = this.path(e.cell, this.blocked(), goals);
        if (p) {
          e.route = p.cells.slice(1);
          e.siege = target;
        }
      }
      if (!e.route) {
        let p = this.path(e.cell);
        e.route = p ? p.cells.slice(1) : [];
        e.remaining = p?.cost || 0;
      }
    }
    if (!e.next) {
      e.next = e.route.shift();
      if (!e.next) {
        if (this.cell(e.cell).type === "exit") this.leak(e);
        else e.route = null;
        return;
      }
    }
    let c = this.cell(e.next);
    if (!c || this.blockedCache.has(c.id)) {
      e.next = e.cell;
      e.route = null;
      c = this.cell(e.cell);
    }
    let dx = c.x - e.x,
      dy = c.y - e.y,
      dist = Math.hypot(dx, dy),
      sp =
        (d.speed /
          ((this.travelCost(this.cell(e.cell)) + this.travelCost(c)) / 2)) *
        (e.slow > 0 ? 0.5 : 1);
    if (this.slow(this.cell(e.cell))) e.reveal = 4;
    let step = Math.min(dist, sp * dt);
    if (dist > 0.0001) {
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
      e.angle = Math.atan2(dx, dy);
    }
    if (dist <= step + 0.001) {
      e.cell = c.id;
      e.next = null;
      if (
        e.type === "worm" &&
        !e.cloned &&
        c.type === "node" &&
        !this.blockedCache.has(c.id)
      ) {
        e.cloned = true;
        this.spawn("worm", e.entry, c.id, true);
        this.emit("replicate", { enemy: e });
      }
      if (c.type === "exit") this.leak(e);
    }
  }
  leak(e) {
    e.dead = true;
    this.stats.lost++;
    this.integrity = Math.max(
      0,
      this.integrity - (ENEMIES[e.type].boss ? 30 : e.type === "flood" ? 5 : 3),
    );
    this.emit("leak", { enemy: e });
    if (this.integrity <= 0) this.finish(false);
  }
  step(dt) {
    if (this.paused || this.over) return;
    this.time += dt;
    this.compute += dt * 1.65;
    for (const k in this.cooldowns)
      this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    for (const k in this.nodeCooldown)
      this.nodeCooldown[k] = Math.max(0, this.nodeCooldown[k] - dt);
    let topology = false;
    this.downgrades = this.downgrades.filter((d) => {
      if (d.end <= this.time) {
        topology = true;
        return false;
      }
      return true;
    });
    this.hazards = this.hazards.filter((h) => {
      if (h.end <= this.time) {
        topology = true;
        return false;
      }
      if (!h.active && h.start <= this.time) {
        let b = this.blocked(h.cells);
        if (
          h.cells.every((id) => !this.towerAt(id)) &&
          this.map.entries.every((e) => this.path(e.x + "," + e.y, b)) &&
          this.enemies
            .filter((e) => !e.dead && e.type !== "flyer")
            .every((e) => this.path(e.cell, b))
        ) {
          h.active = true;
          topology = true;
        } else {
          const alternatives = this.safeHazardCells(h.cells);
          if (alternatives.length) {
            h.cells = alternatives;
            h.start = this.time + 2;
            h.end = h.start + (h.duration || 8);
            this.emit("warning", {
              cells: h.cells,
              message: "拓扑保护 · 改选链路，2 秒后中断",
            });
          } else {
            h.end = this.time;
            this.emit("log", {
              message: "拓扑保护：无安全阻断位置，维持业务连通",
            });
          }
        }
      }
      return true;
    });
    if (topology) this.recompute();
    if (this.running) {
      this.waveTime += dt;
      while (this.queue.length && this.queue[0].time <= this.waveTime) {
        let s = this.queue.shift();
        this.spawn(s.type, s.entry);
      }
    }
    this.blockedCache = this.blocked();
    for (let t of this.towers) {
      if (t.dead) continue;
      t.cd -= dt;
      t.skillCd = Math.max(0, t.skillCd - dt);
      t.encrypted = Math.max(0, t.encrypted - dt);
      t.boost = Math.max(0, (t.boost || 0) - dt);
      t.hit = Math.max(0, (t.hit || 0) - dt);
      t.blocked = 0;
      if (t.end && t.end <= this.time) {
        this.removeTower(t, "到期");
        continue;
      }
      if (t.type === "isolate") continue;
      let d = TOWERS[t.type];
      if (this.cell(t.cell).type === "node" && this.running)
        this.intel += dt * 0.09;
      if (t.encrypted > 0) continue;
      let range = d.range + (t.level === 2 ? 0.65 : 0);
      if (t.type === "gate") {
        if (t.level === 2 && this.time - t.lastHit > 3) this.heal(t, dt * 8);
        continue;
      }
      if (t.type === "sandbox")
        this.enemies
          .filter((e) => !e.dead && Math.hypot(e.x - t.x, e.y - t.y) <= range)
          .forEach((e) => (e.reveal = 4));
      if (t.cd > 0) continue;
      if (t.type === "repair") {
        let targets = this.towers
          .filter(
            (a) =>
              a !== t &&
              !a.dead &&
              a.hp < a.maxHp &&
              Math.hypot(a.x - t.x, a.y - t.y) <= range,
          )
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        if (t.level === 1) targets = targets.slice(0, 1);
        targets.forEach((a) => {
          let n = this.heal(a, 7 * (t.level === 2 ? 1.4 : 1));
          this.emit("heal", { from: t, to: a, amount: n });
        });
        t.cd = d.rate;
        continue;
      }
      if (t.type === "honey") range = 1.2;
      let targets = this.enemies.filter((e) => {
        if (e.dead || Math.hypot(e.x - t.x, e.y - t.y) > range) return false;
        if (e.type === "flyer" && t.type !== "interceptor") return false;
        if (t.type === "interceptor") {
          if (
            (e.type === "trojan" || (e.type === "boss2" && e.phase === 0)) &&
            e.reveal <= 0
          )
            return false;
          let angle = Math.atan2(e.x - t.x, e.y - t.y) - t.dir;
          return Math.cos(angle) > Math.cos((Math.PI * 4) / 9);
        }
        return true;
      });
      targets.sort((a, b) => {
        if (
          t.type === "interceptor" &&
          t.level === 2 &&
          t.branch === 1 &&
          (a.type === "flyer") !== (b.type === "flyer")
        )
          return a.type === "flyer" ? -1 : 1;
        return this.distanceToExit(a) - this.distanceToExit(b) || a.id - b.id;
      });
      if (!targets.length) continue;
      let e = targets[0],
        damage = d.damage * (t.level === 2 ? 1.5 : 1);
      t.aim = Math.atan2(e.x - t.x, e.y - t.y);
      this.emit("attack", { from: t, to: e, kind: t.type });
      t.cd = d.rate / (t.boost > 0 ? 2 : 1);
      t.firing = 0.25;
      if (t.type === "sandbox" || (t.type === "firewall" && t.level === 2)) {
        const radius =
          t.type === "sandbox" ? (t.level === 2 ? 1.8 : 1.25) : 0.8;
        this.enemies
          .filter(
            (a) =>
              !a.dead &&
              a.type !== "flyer" &&
              Math.hypot(a.x - e.x, a.y - e.y) < radius,
          )
          .forEach((a) => this.damageEnemy(a, damage, t));
        this.emit("burst", { x: e.x, y: e.y, range: radius, color: d.color });
      } else {
        this.damageEnemy(e, damage, t);
        if (t.type === "interceptor" && t.level === 2) {
          if (t.branch === 1) e.slow = 2.6;
          else {
            let vx = e.x - t.x,
              vy = e.y - t.y,
              l = Math.hypot(vx, vy);
            this.enemies
              .filter(
                (a) =>
                  a !== e &&
                  !a.dead &&
                  (a.type === "flyer") === (e.type === "flyer") &&
                  Math.hypot(a.x - t.x, a.y - t.y) <= range &&
                  (a.x - t.x) * vx + (a.y - t.y) * vy > 0 &&
                  Math.abs((a.x - t.x) * vy - (a.y - t.y) * vx) / l < 0.5,
              )
              .forEach((a) => this.damageEnemy(a, damage * 0.75, t));
          }
        }
      }
    }
    for (let e of [...this.enemies]) {
      if (e.dead) continue;
      e.age += dt;
      e.cd -= dt;
      e.root = Math.max(0, e.root - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.reveal = Math.max(0, e.reveal - dt);
      e.hit = Math.max(0, (e.hit || 0) - dt);
      e.attacking = Math.max(0, (e.attacking || 0) - dt);
      this.bossAbility(e, dt);
      if (e.type === "ransom" && e.cd <= 0) {
        let ts = this.towers
          .filter((t) => !t.dead && Math.hypot(t.x - e.x, t.y - e.y) < 4.3)
          .sort(
            (a, b) =>
              (a.type === "honey" ? -10 : 0) - (b.type === "honey" ? -10 : 0) ||
              Math.hypot(a.x - e.x, a.y - e.y) -
                Math.hypot(b.x - e.x, b.y - e.y),
          );
        if (ts.length) {
          this.damageTower(ts[0], ENEMIES.ransom.damage, e);
          if (ts[0].type !== "honey") ts[0].encrypted = 3;
          e.cd = ENEMIES.ransom.rate;
        }
      }
      if (e.type === "shell") {
        e.ability -= dt;
        if (e.ability <= 0) {
          e.ability = 4;
          this.enemies
            .filter((a) => !a.dead && Math.hypot(a.x - e.x, a.y - e.y) < 2.8)
            .forEach((a) => (a.shield = Math.max(a.shield, 32)));
          this.emit("shield", { enemy: e });
        }
      }
      this.move(e, dt);
    }
    this.towers = this.towers.filter((t) => !t.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.running && !this.queue.length && !this.enemies.length) {
      this.running = false;
      this.compute += 65 + this.wave * 3;
      this.intel += 6;
      this.intermission = 8;
      this.emit("waveEnd", { wave: this.wave });
      if (this.wave >= this.map.waves) this.finish(true);
    }
    if (!this.running && this.wave > 0 && this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0 && !this.demo) this.startWave();
    }
  }
  finish(win) {
    if (this.over) return;
    this.over = true;
    this.running = false;
    this.emit("finish", { win });
  }
}
