/* =========================================================================
   动态路由塔防 · 实战演示（实时演出 + 确定性视频导出）
   ========================================================================= */
(function (global) {
  'use strict';
  const D = global.GAME_DATA;
  const CELL = D.CELL;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const btnCenter = sel => {
    const el = document.querySelector(sel);
    if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const DEMO = {
    active: false, exporting: false, finished: false, game: null, cfg: null,
    t: 0, duration: 0, acc: 0, lastFrame: -1, fps: 60, frames: 0,
    actions: [], cursor: { x: 0, y: 0 }, clickPulse: 0,
    lastSub: null, lastCamKey: '', sub: '',
    runs: ['demo-1', 'demo-2', 'demo-3'],

    /* ---------------- public ---------------- */
    start(id) {
      if (!this.configs[id]) return;
      this.exporting = false;
      this.finished = false;
      this._setup(id);
      this.active = true;
      global.UI.setDemo(true, this.cfg.title);
      global.UI.setSubtitle('');
      global.UI.setDemoProgress(0, this.duration);
      global.AUDIO && global.AUDIO.unlock();
      global.AUDIO && global.AUDIO.startMusic(this.cfg.mapId);
      document.getElementById('app').classList.add('demo-active');
    },
    stop() {
      this.active = false; this.finished = false; this.exporting = false;
      document.getElementById('app').classList.remove('demo-active');
      global.UI.setDemo(false);
      global.UI.setCursor(0, 0, false);
      if (this.game) this.game.paused = true;
      this.game = null;
      global.UI.quitBattle();
    },

    async begin(runId, opts) {
      opts = opts || {};
      if (!this.configs[runId]) throw new Error('unknown run: ' + runId);
      this.exporting = true;
      this.finished = false;
      this.fps = opts.fps || 60;
      this._setup(runId);
      this.frames = Math.max(1, Math.ceil(this.duration * this.fps));
      this.lastFrame = -1;
      global.UI.setDemo(true, this.cfg.title);
      document.getElementById('app').classList.add('demo-active');
      // render frame 0 immediately
      await this.frame(0);
      return { frames: this.frames };
    },

    async frame(i) {
      if (!this.exporting || !this.cfg) return;
      i = Math.max(0, Math.floor(i));
      if (i < this.lastFrame) {
        // caller jumped backwards: rebuild the deterministic start
        this._setup(this.cfg.id);
        global.UI.setDemo(true, this.cfg.title);
        document.getElementById('app').classList.add('demo-active');
        this.lastFrame = -1;
      }
      const target = Math.min(this.duration, i / this.fps);
      // Large non-sequential jumps should not inherit a pile of transient FX
      // from skipped frames; sequential export remains fully deterministic.
      const jumped = target - this.t > 0.25;
      if (jumped && global.UI.world) global.UI.world.effects.reset();
      // step the simulation in deterministic fixed sub-steps
      let guard = 0;
      while (this.t < target - 1e-9 && guard++ < 20000) {
        const dt = Math.min(1 / 60, target - this.t);
        this.t += dt;
        this._runActions();
        this.game.update(dt);
      }
      if (this.t < target) this.t = target;
      if (jumped && global.UI.world) global.UI.world.effects.reset();
      this._applyPresentation(target, true);
      if (jumped) this._applyPresentation(target, true);
      this._renderFrame();
      this.lastFrame = i;
      return;
    },

    end() {
      this.exporting = false;
      this.active = false;
      this.finished = false;
      document.getElementById('app').classList.remove('demo-active');
      global.UI.setDemo(false);
      global.UI.setSubtitle('');
      if (this.game) this.game.paused = true;
      this.game = null;
      global.UI.quitBattle();
    },

    /* ---------------- live loop ---------------- */
    tick(dt) {
      if (!this.active || this.exporting || this.finished) return;
      this.acc += Math.min(dt, 0.1);
      const limit = 1 / 60;
      let steps = 0;
      while (this.acc >= limit && steps < 6) {
        this.acc -= limit;
        this.t += limit;
        this._runActions();
        this.game.update(limit);
        steps++;
      }
      if (this.t >= this.duration) {
        this.finished = true;
        this.t = this.duration;
      }
      this._applyPresentation(this.t, false);
    },

    /* ---------------- setup ---------------- */
    _setup(id) {
      const cfg = this.configs[id];
      this.cfg = cfg;
      this.duration = cfg.duration;
      this.t = 0; this.acc = 0; this.actions = []; this.cursor = { x: innerWidth / 2, y: innerHeight * 0.6 };
      this.clickPulse = 0; this.sub = ''; this.lastSub = null;
      const ui = global.UI;
      const game = ui.startBattle(cfg.mapId, { mode: 'demo', demo: true, seed: cfg.seed || 7319 });
      this.game = game;
      game.scripted = true;
      game.paused = false;
      game.time = 0;
      game.waveIndex = cfg.waveIndex != null ? cfg.waveIndex : 0;
      game.waveState = 'active';
      game.waveNote = cfg.note || '';
      game.spawnQueue = [];
      game.enemies = [];
      game.integrity = cfg.integrity == null ? 88 : cfg.integrity;
      game.compute = cfg.compute == null ? 280 : cfg.compute;
      game.intel = cfg.intel == null ? 60 : cfg.intel;
      game.stats = { kills: 0, leaks: 0, towersLost: 0, built: 0, damageDealt: 0, computeEarned: 0, intelEarned: 0, startTime: 0, bossKills: 0, reroutes: 0 };
      game.over = false; game.victory = false;
      const api = this._api(game);
      cfg.setup(game, api, this);
      game.map.recomputeRoutes();
      game.syncRoutes();
      game.rerouteEnemies();
      if (ui.world) {
        game.map.switches.forEach(s => ui.world.updateSwitchView(s.cell));
        game.towers.forEach(t => { if (t.cell.node) ui.world.updateSwitchView(t.cell); });
        ui.world.effects.reset();
      }
      ui.updateHUD(true);
      ui.setDemoProgress(0, this.duration);
      this._applyPresentation(0, true);
    },

    _api(game) {
      const ui = global.UI;
      return {
        cell: (x, y) => game.map.at(x, y),
        pos: (cell, h) => ui.getClientPos(cell, h == null ? 1.2 : h),
        card: id => ui.getCardCenter(id),
        btn: sel => btnCenter(sel),
        tower: (defId, x, y, opts) => {
          opts = opts || {};
          const t = game.freeTower(defId, x, y, opts);
          if (!t) { console.warn('demo tower fail', defId, x, y); return null; }
          if (opts.hpRatio != null) t.hp = t.maxHp * opts.hpRatio;
          if (opts.facing != null) { t.facing = opts.facing; t.aimAngle = opts.facing; }
          if (opts.encrypted) t.encryptedUntil = 999;
          if (opts.shield) t.shield = opts.shield;
          return t;
        },
        enemy: (type, x, y, opts) => {
          opts = opts || {};
          const cell = game.map.at(x, y);
          if (!cell) { console.warn('demo enemy fail', type, x, y); return null; }
          const e = game.spawnAdd(type, cell, { entId: opts.ent || game.mapDef.entrances[0].id });
          if (!e) return null;
          if (opts.hpRatio != null) e.hp = e.maxHp * opts.hpRatio;
          if (opts.shield) e.shield = opts.shield;
          if (opts.revealed != null) e.revealed = !!opts.revealed;
          if (opts.speed != null) { e.def = Object.assign({}, e.def, { speed: opts.speed }); }
          if (opts.canReplicate != null) e.canReplicate = !!opts.canReplicate;
          else e.canReplicate = false;
          if (opts.rushNode) {
            e.mode = 'rush'; e.rushNode = opts.rushNode; e.path = [cell]; e.pi = 1; e.wx = cell.wx; e.wz = cell.wz;
          }
          if (e.view) e.view.position.set(e.wx, 0.1, e.wz);
          return e;
        },
        boss: (type, x, y, opts) => {
          opts = opts || {};
          const cell = game.map.at(x, y);
          const e = game.spawnAdd(type, cell, { entId: opts.ent || game.mapDef.entrances[0].id });
          if (!e) return null;
          if (opts.hpRatio != null) e.hp = e.maxHp * opts.hpRatio;
          if (opts.revealed != null) e.revealed = !!opts.revealed;
          if (opts.speed != null) e.def = Object.assign({}, e.def, { speed: opts.speed });
          if (opts.phaseCount != null) e.phaseCount = opts.phaseCount;
          if (opts.armor != null) e.def = Object.assign({}, e.def, { armor: opts.armor });
          game.activeBoss = e;
          return e;
        },
        action: (t, fn) => { this.actions.push({ t, fn, done: false }); },
        spawnLater: (t, type, x, y, opts) => { this.actions.push({ t, fn: () => this._api(game).enemy(type, x, y, opts), done: false }); },
        fx: () => ui.world.effects
      };
    },

    _runActions() {
      for (const a of this.actions) {
        if (!a.done && this.t >= a.t - 1e-9) {
          a.done = true;
          try { a.fn(); } catch (e) { console.error('demo action', e); }
        }
      }
    },

    /* ---------------- presentation ---------------- */
    _cameraAt(t) {
      const keys = this.cfg.camera;
      if (!keys || !keys.length) return { cell: { x: 8, y: 7 }, yaw: -0.5, pitch: 1.0, dist: 110 };
      const normalize = k => ({
        cell: { x: Array.isArray(k.cell) ? k.cell[0] : k.cell.x, y: Array.isArray(k.cell) ? k.cell[1] : k.cell.y },
        yaw: k.yaw, pitch: k.pitch, dist: k.dist
      });
      if (t <= keys[0].t) return normalize(keys[0]);
      if (t >= keys[keys.length - 1].t) return normalize(keys[keys.length - 1]);
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i], b = keys[i + 1];
        if (t >= a.t && t <= b.t) {
          const k = ease((t - a.t) / Math.max(0.001, b.t - a.t));
          return {
            cell: { x: lerp(a.cell[0], b.cell[0], k), y: lerp(a.cell[1], b.cell[1], k) },
            yaw: lerp(a.yaw, b.yaw, k),
            pitch: lerp(a.pitch, b.pitch, k),
            dist: lerp(a.dist, b.dist, k)
          };
        }
      }
      return keys[keys.length - 1];
    },
    _subtitleAt(t) {
      let text = '';
      for (const s of this.cfg.subtitles || []) if (t >= s.t) text = s.text;
      return text;
    },
    _applyPresentation(t, exact) {
      const ui = global.UI;
      const world = ui.world;
      if (!world || !this.game) return;
      const cam = this._cameraAt(t);
      if (cam) {
        const p = world.cellPos(cam.cell, 0);
        world.camGoal.target.set(p.x, 0, p.z);
        world.camGoal.yaw = cam.yaw;
        world.camGoal.pitch = cam.pitch;
        world.camGoal.dist = cam.dist;
        if (exact || this.exporting) {
          world.cam.target.set(p.x, 0, p.z);
          world.cam.yaw = cam.yaw; world.cam.pitch = cam.pitch; world.cam.dist = cam.dist;
          world._updateCamera(0);
        }
      }
      // cursor from per-demo logic
      if (this.cfg.interaction) {
        try { this.cfg.interaction(this, this.game, this._api(this.game), t); } catch (e) { console.error('demo interaction', e); }
      }
      if (this.cursor) {
        const cp = this.clickPulse > 0 && t <= this.clickPulse + 0.08;
        ui.setCursor(this.cursor.x, this.cursor.y, cp);
      }
      const sub = this._subtitleAt(t);
      if (sub !== this.lastSub) { ui.setSubtitle(sub); this.lastSub = sub; }
      ui.setDemoProgress(t, this.duration);
      ui.updateHUD();
      if (this.game.selected) ui.renderSelection();
    },
    _renderFrame() {
      const ui = global.UI;
      if (!ui.world || !this.game) return;
      // use a stable visual delta for effects/animation; state is already at t
      ui.world.update(1 / 60, this.game);
    }
  };

  /* ===================================================================== *
   *  RUN 1 · 分段取舍
   * ===================================================================== */
  DEMO.configs = {
    'demo-1': {
      title: '实战演示 01 · 分段取舍', mapId: 'segment', duration: 18, waveIndex: 4,
      note: '门户网站的蠕虫试探', integrity: 88, compute: 260, intel: 60, seed: 41001,
      camera: [
        { t: 0, cell: [8.5, 7], yaw: -0.5, pitch: 1.02, dist: 118 },
        { t: 2.2, cell: [5, 5], yaw: -0.18, pitch: 0.93, dist: 58 },
        { t: 4.7, cell: [5, 5], yaw: -0.18, pitch: 0.93, dist: 52 },
        { t: 6.3, cell: [4, 4], yaw: 0.1, pitch: 0.9, dist: 50 },
        { t: 8.4, cell: [3, 6], yaw: 0.15, pitch: 0.9, dist: 46 },
        { t: 12.0, cell: [3, 7], yaw: 0.05, pitch: 0.92, dist: 44 },
        { t: 14.6, cell: [6.5, 6], yaw: -0.35, pitch: 0.95, dist: 82 },
        { t: 17.8, cell: [8.5, 7], yaw: -0.5, pitch: 1.02, dist: 118 }
      ],
      subtitles: [
        { t: 0.3, text: '分段内网 · 门户与邮件两路流量在 DMZ 汇流。' },
        { t: 2.1, text: '西边界互联，是门户进入 DMZ 的必经交换节点。' },
        { t: 4.6, text: '路由预览：隔离后 A 折向办公网段，确认前仍可取消。' },
        { t: 6.5, text: '路由收敛。办公网段的入侵体掉头，进入预设火力区。' },
        { t: 9.7, text: '蜜罐替中央防火墙吸收了攻击，耐久正在见底。' },
        { t: 12.1, text: '守方能清理威胁，敌方也能让设备付出代价。' },
        { t: 14.9, text: '每一次隔离，都是一次取舍：路线、火力与生存。' },
        { t: 17.0, text: '演示结束 · 分段取舍' }
      ],
      setup(g, api, demo) {
        api.tower('firewall', 2, 7, { level: 2, hpRatio: 0.52 });
        api.tower('firewall', 9, 9, { level: 1, hpRatio: 0.7 });
        api.tower('honeypot', 9, 6, { level: 1, hpRatio: 1.0 });
        api.tower('interceptor', 7, 4, { level: 1, facing: 0.95, hpRatio: 0.9 });
        api.tower('sandbox', 7, 7, { level: 1 });
        api.tower('interceptor', 11, 4, { level: 1, facing: -1.1 });
        api.tower('repair', 7, 11, { level: 2 });
        demo.state = { begun: false, confirm: false, placed: false, destroyed: false, hidSel: false };
        // B-side pressure keeps the central firefight alive
        api.enemy('worm', 9, 3, { hpRatio: 1 });
        api.enemy('ransomware', 10, 5, { hpRatio: 0.9 });
        // A-side contacts arrive just before the isolation and are slowed so
        // the boundary node stays clear until the player confirms.
        demo.state.aUnits = [];
        const addA = (type, x, y, opts) => { const e = api.enemy(type, x, y, opts); if (e) demo.state.aUnits.push(e); return e; };
        api.action(3.9, () => addA('worm', 3, 3, { speed: 0.5 }));
        api.action(4.15, () => addA('worm', 4, 3, { speed: 0.5 }));
        api.action(4.4, () => addA('worm', 3, 2, { speed: 0.5 }));
        api.action(4.7, () => addA('trojan', 2, 3, { speed: 0.5, revealed: false }));
        api.action(6.35, () => demo.state.aUnits.forEach(e => { if (!e.dead) e.def = Object.assign({}, e.def, { speed: 1.15 }); }));
        api.action(7.4, () => api.enemy('worm', 2, 3, {}));
        api.action(8.8, () => api.enemy('worm', 9, 2, {}));
        api.action(10.2, () => api.enemy('flood', 9, 1, { hpRatio: 0.8 }));
        api.action(11.8, () => api.enemy('ransomware', 9, 2, {}));
        api.action(13.0, () => api.enemy('worm', 2, 4, {}));
      },
      interaction(demo, g, api, t) {
        const st = demo.state;
        if (!st.begun && t >= 2.35) {
          st.begun = true;
          global.UI.beginPlacement('tower', 'netgap');
          if (global.UI.placementEl) global.UI.placementEl.classList.add('dragging');
        }
        if (st.begun && !st.confirm) {
          const k = clamp((t - 2.35) / (4.55 - 2.35), 0, 1);
          const a = api.card('netgap'), b = api.pos(api.cell(5, 5), 0.9);
          demo.cursor = { x: lerp(a.x, b.x, ease(k)), y: lerp(a.y, b.y, ease(k)) };
          if (t > 2.55) global.UI.updatePlacementFromScreen(demo.cursor.x, demo.cursor.y);
          if (t >= 4.55) {
            global.UI.placement.cell = api.cell(5, 5);
            global.UI.attemptPlacement(api.cell(5, 5));
            st.confirm = true;
          }
        } else if (st.confirm && !st.placed) {
          demo.cursor = api.btn('#confirm-ok');
          if (t >= 5.75) {
            demo.clickPulse = t;
            global.UI.okConfirm();
            st.placed = true;
          }
        } else if (st.placed) {
          if (!st.hidSel && t >= 7.4) { st.hidSel = true; global.UI.hideSelection(); }
          if (t < 6.2) demo.cursor = { x: demo.cursor.x + 2, y: demo.cursor.y - 1 };
          else if (t < 8.5) demo.cursor = api.pos(api.cell(4, 5), 0.7);
          else if (t < 11.6) demo.cursor = api.pos(api.cell(3, 7), 0.7);
          else demo.cursor = { x: innerWidth * 0.58, y: innerHeight * 0.56 };
        }
        if (!st.destroyed && t >= 9.6) {
          st.destroyed = true;
          const honey = g.towers.find(x => x.defId === 'honeypot');
          if (honey) {
            const p = global.UI.world.cellCenter(honey.cell, 1);
            global.UI.world.effects.shock(p, 0xffb06a, 5);
            global.UI.world.effects.warning(p.clone().setY(0.4), 0xffb06a, 4, '蜜罐被摧毁');
            g.damageTower(honey, 99999, null, {});
          }
        }
      }
    },

    /* ===================================================================== *
     *  RUN 2 · 旁路直通
     * ===================================================================== */
    'demo-2': {
      title: '实战演示 02 · 旁路直通', mapId: 'backbone', duration: 18, waveIndex: 8,
      note: '洪峰 · 三入口同时大量出兵', integrity: 84, compute: 300, intel: 74, seed: 41002,
      camera: [
        { t: 0, cell: [8.5, 7], yaw: -0.5, pitch: 1.02, dist: 126 },
        { t: 1.7, cell: [13, 11], yaw: 0.75, pitch: 0.9, dist: 58 },
        { t: 4.0, cell: [13, 10], yaw: 0.8, pitch: 0.9, dist: 48 },
        { t: 6.5, cell: [13, 11], yaw: 0.4, pitch: 0.85, dist: 56 },
        { t: 7.6, cell: [13, 11], yaw: -0.1, pitch: 0.9, dist: 66 },
        { t: 9.2, cell: [3, 2], yaw: -0.3, pitch: 0.95, dist: 52 },
        { t: 11.8, cell: [3, 2], yaw: -0.3, pitch: 0.9, dist: 46 },
        { t: 13.8, cell: [10, 7], yaw: -0.5, pitch: 1.0, dist: 96 },
        { t: 17.8, cell: [8.5, 7], yaw: -0.5, pitch: 1.02, dist: 126 }
      ],
      subtitles: [
        { t: 0.3, text: '骨干流域 · 洪峰批次，三个入口同时大量出兵。' },
        { t: 1.8, text: '双活汇流点被网闸隔离，C、B 正被导向 X。' },
        { t: 3.9, text: '洪泛团离开原路线，扑向节点上的网闸。' },
        { t: 6.1, text: '网闸耐久见底——' },
        { t: 6.8, text: '旁路直通。C、B 的路线改回原来的数据中心 Y。' },
        { t: 8.8, text: 'A 的压力上升。降低这一段链路的协议等级。' },
        { t: 10.6, text: '预览：受影响链路将减速、显形，路线同步重算。' },
        { t: 11.8, text: '协议降级生效：木马在旧协议链路上显形。' },
        { t: 13.5, text: '两条入口重新分流，但设备缺口已经出现。' },
        { t: 17.0, text: '演示结束 · 旁路直通' }
      ],
      setup(g, api, demo) {
        const netgap = api.tower('netgap', 13, 11, { level: 1, hpRatio: 1 });
        demo.state = { netgap, dead: false, begun: false, confirm: false, placed: false };
        api.tower('firewall', 4, 10, { level: 2, hpRatio: 0.62 });
        api.tower('interceptor', 11, 8, { level: 1, facing: 0.6, hpRatio: 0.85 });
        api.tower('sandbox', 6, 8, { level: 1 });
        api.tower('repair', 11, 13, { level: 2 });
        api.tower('firewall', 12, 9, { level: 1, hpRatio: 0.55 });
        api.tower('honeypot', 5, 11, { level: 1, hpRatio: 0.5 });
        api.tower('interceptor', 2, 8, { level: 2, branch: 'suppress', facing: 0.7, hpRatio: 0.9 });
        api.tower('firewall', 4, 8, { level: 2, hpRatio: 0.6 });
        // floods already on the node
        api.enemy('flood', 14, 11, { rushNode: api.cell(13, 11), hpRatio: 0.9 });
        api.enemy('flood', 13, 12, { rushNode: api.cell(13, 11), hpRatio: 0.8 });
        api.enemy('worm', 9, 2, { hpRatio: 1 });
        api.enemy('worm', 4, 3, { hpRatio: 1 });
        api.enemy('ransomware', 14, 4, { hpRatio: 0.9 });
        api.action(7.8, () => api.enemy('worm', 9, 2, {}));
        api.action(8.6, () => api.enemy('worm', 4, 2, {}));
        api.action(9.4, () => api.enemy('flood', 14, 11, { rushNode: api.cell(13, 11), hpRatio: 0.7 }));
        api.action(10.6, () => api.enemy('trojan', 3, 2, { revealed: false }));
        api.action(12.0, () => api.enemy('worm', 9, 2, {}));
        api.action(13.0, () => api.enemy('ransomware', 14, 4, {}));
        api.action(14.2, () => api.enemy('flood', 13, 12, { rushNode: api.cell(13, 11) }));
      },
      interaction(demo, g, api, t) {
        const st = demo.state;
        if (!st.dead && t >= 6.35) {
          st.dead = true;
          if (st.netgap && g.towers.includes(st.netgap)) {
            const p = global.UI.world.cellCenter(st.netgap.cell, 1.2);
            global.UI.world.effects.shock(p, 0xffb457, 8);
            global.UI.world.effects.burst(p, 0xffcf8a, 46, { spread: 6, speed: 6, life: 1.1, size: 0.8 });
            g.damageTower(st.netgap, 99999, null, {});
          }
        }
        if (!st.begun && t >= 8.9) {
          st.begun = true;
          global.UI.beginPlacement('item', 'downgrade');
          if (global.UI.placementEl) global.UI.placementEl.classList.add('dragging');
        }
        if (st.begun && !st.confirm) {
          const k = clamp((t - 8.9) / (10.7 - 8.9), 0, 1);
          const a = api.card('downgrade'), b = api.pos(api.cell(3, 2), 0.8);
          demo.cursor = { x: lerp(a.x, b.x, ease(k)), y: lerp(a.y, b.y, ease(k)) };
          if (t > 9.1) global.UI.updatePlacementFromScreen(demo.cursor.x, demo.cursor.y);
          if (t >= 10.7) {
            global.UI.placement.cell = api.cell(3, 2);
            global.UI.attemptPlacement(api.cell(3, 2));
            st.confirm = true;
          }
        } else if (st.confirm && !st.placed) {
          demo.cursor = api.btn('#confirm-ok');
          if (t >= 11.85) {
            demo.clickPulse = t;
            global.UI.okConfirm();
            st.placed = true;
          }
        } else if (st.placed) {
          demo.cursor = t < 13.5 ? api.pos(api.cell(3, 2), 0.8) : { x: innerWidth * 0.55, y: innerHeight * 0.54 };
        }
      }
    },

    /* ===================================================================== *
     *  RUN 3 · 蛰影现身
     * ===================================================================== */
    'demo-3': {
      title: '实战演示 03 · 蛰影现身', mapId: 'airgap', duration: 18, waveIndex: 15,
      note: '蛰影正在气隙中潜伏', integrity: 88, compute: 320, intel: 70, seed: 41003,
      camera: [
        { t: 0, cell: [8, 7], yaw: -0.5, pitch: 1.02, dist: 118 },
        { t: 1.7, cell: [4, 6], yaw: 0.25, pitch: 0.92, dist: 56 },
        { t: 4.2, cell: [4, 7], yaw: 0.3, pitch: 0.9, dist: 50 },
        { t: 7.0, cell: [4, 8], yaw: 0.35, pitch: 0.88, dist: 54 },
        { t: 9.6, cell: [4, 9], yaw: 0.15, pitch: 0.9, dist: 58 },
        { t: 11.6, cell: [5, 11], yaw: -0.15, pitch: 0.92, dist: 52 },
        { t: 13.2, cell: [8, 10], yaw: -0.35, pitch: 0.9, dist: 48 },
        { t: 15.6, cell: [8, 10], yaw: -0.4, pitch: 0.95, dist: 74 },
        { t: 17.8, cell: [8, 7], yaw: -0.5, pitch: 1.02, dist: 118 }
      ],
      subtitles: [
        { t: 0.3, text: '气隙深层 · 第 16 波。蛰影从运维环的阴影中进入。' },
        { t: 1.9, text: '潜伏阶段：未被检测前，远程单体攻击无法锁定它。' },
        { t: 4.3, text: '沙箱捕捉到异常行为，蛰影显形。' },
        { t: 6.7, text: '提权完成：护甲强化，并放出携带载荷的木马。' },
        { t: 10.3, text: '破坏阶段：蛰影锁死前方运维环，各入口路线重新收敛。' },
        { t: 12.0, text: '核心防火墙被加密，节点压力上升。选择修复进程。' },
        { t: 13.4, text: '冗余切换：友塔获得护盾，加密被解除，生命持续恢复。' },
        { t: 15.8, text: '守住道路，也守住每一次取舍的余量。' },
        { t: 17.0, text: '演示结束 · 蛰影现身' }
      ],
      setup(g, api, demo) {
        const boss = api.boss('boss_zheying', 4, 4, { hpRatio: 0.72, revealed: false, speed: 0.5, phaseCount: 0 });
        if (boss) { boss.maxHp = 5200; boss.hp = boss.maxHp * 0.72; }
        demo.state = { boss, selected: false, skill: false, clickedSkill: false, phase1: false, phase2: false };
        api.tower('sandbox', 3, 9, { level: 1, hpRatio: 0.9 });
        api.tower('interceptor', 3, 6, { level: 1, facing: 0.15, hpRatio: 0.85 });
        api.tower('interceptor', 13, 6, { level: 2, branch: 'pierce', facing: -1.2, hpRatio: 0.8 });
        api.tower('sandbox', 13, 9, { level: 1 });
        api.tower('interceptor', 8, 4, { level: 2, branch: 'suppress', facing: 0.9, hpRatio: 0.9 });
        api.tower('firewall', 10, 11, { level: 2, hpRatio: 0.7 });
        api.tower('firewall', 6, 11, { level: 2, hpRatio: 0.6 });
        api.tower('repair', 8, 10, { level: 2, hpRatio: 1 });
        api.tower('honeypot', 12, 7, { level: 1, hpRatio: 0.45 });
        api.enemy('worm', 8, 2, { hpRatio: 0.9 });
        api.enemy('trojan', 14, 6, { revealed: false });
        demo.state.repair = g.towers.find(t => t.defId === 'repair');
        api.action(6.6, () => { if (boss && !demo.state.phase1) { demo.state.phase1 = true; boss.hp = boss.maxHp * 0.65; } });
        api.action(7.2, () => api.enemy('worm', 8, 2, {}));
        api.action(8.4, () => {
          api.enemy('ransomware', 7, 11, { hpRatio: 0.8 });
          api.enemy('trojan', 14, 6, { revealed: false });
        });
        api.action(10.4, () => { if (boss && !demo.state.phase2) { demo.state.phase2 = true; boss.hp = boss.maxHp * 0.33; } });
        api.action(10.8, () => api.enemy('trojan', 14, 8, { revealed: false }));
        api.action(14.0, () => api.enemy('worm', 8, 1, {}));
      },
      interaction(demo, g, api, t) {
        const st = demo.state;
        const boss = st.boss;
        if (!st.selected && t >= 12.2) {
          st.selected = true;
          if (st.repair) {
            global.UI.selectTower(st.repair);
            demo.cursor = api.pos(st.repair.cell, 1.4);
            demo.clickPulse = t;
          }
        }
        if (!st.skill && t >= 12.55) {
          demo.cursor = api.btn('#sel-body [data-act="skill"]');
          if (t >= 13.05) {
            demo.clickPulse = t;
            if (st.repair) {
              const r = g.useSkill(st.repair);
              if (r.ok) {
                demo.lastSub = null;
                global.UI.renderSelection();
              }
            }
            st.skill = true;
          }
        } else if (!st.skill) {
          // move cursor toward selection panel while camera focuses
          if (t >= 11.9) demo.cursor = api.pos(api.cell(5, 11), 0.9);
        } else {
          demo.cursor = { x: innerWidth * 0.72, y: innerHeight * 0.55 };
        }
        // camera shake-ish cue when lock forms
        if (boss && !st.revealFx && t >= 2.6 && !boss.revealed) {
          st.revealFx = true;
        }
      }
    }
  };

  /* ---------------- video export facade ---------------- */
  global.DEMO = DEMO;
  global.videoExport = {
    runs: ['demo-1', 'demo-2', 'demo-3'],
    begin(runId, opts) { return DEMO.begin(runId, opts); },
    frame(i) { return DEMO.frame(i); },
    end() { DEMO.end(); }
  };
})(window);
