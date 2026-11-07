/* =========================================================================
   动态路由塔防 · 界面 / 交互 / HUD
   ========================================================================= */
(function (global) {
  'use strict';
  const D = global.GAME_DATA;
  const CELL = D.CELL;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const ICONS = {
    firewall: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M24 4 40 10v13c0 10-7 17-16 21C15 40 8 33 8 23V10Z"/><path d="M16 22h16M16 28h16M24 22v12M17 15h14" stroke-width="1.6"/><circle cx="24" cy="9.5" r="1.6" fill="currentColor"/></svg>`,
    honeypot: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 5 40 14v18L24 41 8 32V14Z"/><path d="M16 18c0 8 3 13 8 16 5-3 8-8 8-16" stroke-width="1.8"/><circle cx="24" cy="25" r="4" fill="currentColor" opacity=".5"/><path d="M13 9 35 39" stroke-width=".9" opacity=".35"/></svg>`,
    gap: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="8" width="10" height="32"/><rect x="31" y="8" width="10" height="32"/><path d="M17 18c7 4 7 8 14 12M31 18c-7 4-7 8-14 12" stroke-width="1.4"/><circle cx="24" cy="24" r="3"/><path d="M12 12v6M36 12v6M12 32v5M36 32v5" stroke-width="1.2"/></svg>`,
    turret: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 40h28M15 40v-5h18v5"/><circle cx="24" cy="26" r="9"/><path d="M24 17V8M24 17l-8 6M24 17l8 6" stroke-width="2.4"/><path d="M24 12h13" stroke-width="2.4"/><circle cx="38" cy="12" r="2.2" fill="currentColor"/></svg>`,
    sandbox: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M24 8 39 16v16L24 40 9 32V16Z"/><path d="M9 16l15 8 15-8M24 24v16" opacity=".65"/><circle cx="24" cy="24" r="4" fill="currentColor" opacity=".5"/><path d="M19 6h10M22 3h4" stroke-width="1.3"/></svg>`,
    repair: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="22" r="13"/><path d="M24 14v16M16 22h16" stroke-width="2.6"/><path d="M12 38c4 4 8 6 12 6s8-2 12-6" stroke-width="1.6"/><circle cx="24" cy="22" r="5" opacity=".5"/></svg>`,
    isolator: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 4v10M14 14h20v10c0 9-4 14-10 20-6-6-10-11-10-20Z"/><path d="M19 20v5M29 20v5M24 25v10" stroke-width="1.5"/><path d="M8 44h32" stroke-width="1.2"/></svg>`,
    downgrade: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 14h32M8 34h32" stroke-width="1.4"/><path d="M24 7v22M17 22l7 8 7-8" stroke-width="2.4"/><path d="M12 40h24" stroke-width="1.2" opacity=".5"/><circle cx="24" cy="40" r="2" fill="currentColor"/></svg>`,
    skill: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 4 36 12v12L24 44 12 24V12Z"/><path d="M24 14v16M18 22h12" stroke-width="1.5"/></svg>`,
    backup: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M36 20a13 13 0 1 0 1 9"/><path d="M36 10v10H26"/><path d="M20 22h8M24 18v8" stroke-width="1.8"/></svg>`,
    compute: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 3 27 16 16 29 5 16Z"/><path d="M16 9v14M11 16h10" stroke-width="1.2"/></svg>`,
    intel: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="16" cy="16" r="12"/><path d="M16 10v12M10 16h12" stroke-width="1.1"/><circle cx="16" cy="16" r="4" stroke-width="1.2"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>`,
    camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 10a8 8 0 1 1 2 6M4 4v6h6"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg>`
  };

  ICONS.shield = ICONS.firewall; ICONS.honey = ICONS.honeypot;
  const ENEMY_DOT = {
    worm: '#ff5468', flood: '#ff7a45', trojan: '#ff4d6d', ransomware: '#c45bff',
    hotspot: '#ff4fd0', packer: '#75d98b', boss_wankui: '#ff3b51', boss_mirage: '#b88cff', boss_zheying: '#e6e6ff'
  };

  const UI = {
    world: null, game: null, screen: 'title', selected: null, selectedType: null,
    placement: null, placementEl: null, facingMode: false, drag: null,
    previewCell: null, previewActive: false, logsShown: 0, hudT: 0, attractT: 0,
    resultTimer: null, codexReturn: 'title', demoMode: false, exportMode: false,
    confirm: null, soundOn: true, scanOn: true, autoCam: false, hoverEntity: null,
    lastResult: null, cardMap: {}, itemMap: {}, aiming: 0,

    init(world) {
      this.world = world;
      this.dom = {
        compute: $('#compute-val'), intel: $('#intel-val'), integrity: $('#integrity-num'),
        integrityBar: $('#integrity-bar'), integrityState: $('#integrity-state'), leaks: $('#leak-count'),
        waveNow: $('#wave-now'), waveMax: $('#wave-max'), waveNote: $('#wave-note'),
        waveTimer: $('#wave-timer'), prepTime: $('#prep-time'), skipWave: $('#btn-skip-wave'),
        bossBanner: $('#boss-banner'), bossName: $('#boss-name'), bossEn: $('#boss-en'),
        bossHp: $('#boss-hp-bar'), bossPhase: $('#boss-phase'),
        threatList: $('#threat-list'), forecastWave: $('#forecast-wave'), logPanel: $('#log-panel'),
        routeRows: $('#route-legend-rows'), entChips: $('#ent-chips'),
        selPanel: $('#selection-panel'), selType: $('#sel-type'), selName: $('#sel-name'), selBody: $('#sel-body'),
        buildHint: $('#build-hint'), toasts: $('#toasts'), tooltip: $('#tooltip'), report: $('#report'),
        pause: $('#overlay-pause'), menu: $('#overlay-menu'), confirm: $('#overlay-confirm'),
        branch: $('#overlay-branch'), result: $('#screen-result'),
        demoLayer: $('#demo-layer'), subtitle: $('#subtitle-text'), demoTitle: $('#demo-title'),
        demoProgress: $('#demo-progress'), demoCursor: $('#demo-cursor'),
        mapsGrid: $('#maps-grid'), mapNameHud: $('#map-name-hud'), reportStats: $('#report-stats')
      };
      this.injectIcons();
      this.buildMapCards();
      this.buildDeck();
      this.bind();
      this.setScreen('title');
      this.startAttract('segment');
      // initial icons
      $('#ico-compute').innerHTML = ICONS.compute;
      $('#ico-intel').innerHTML = ICONS.intel;
      this.loadSettings();
    },
    injectIcons() {
      const menu = $('#btn-menu'); if (menu) menu.innerHTML = ICONS.menu;
      const pause = $('#btn-pause'); if (pause) pause.textContent = '❚❚';
      const reset = $('#btn-cam-reset'); if (reset) reset.innerHTML = ICONS.camera + ' 回到默认视角';
      $('#sel-close').textContent = '×';
    },

    /* ---------------- screens ---------------- */
    setScreen(name) {
      this.screen = name;
      $$('.screen').forEach(s => s.classList.remove('active'));
      const el = $('#screen-' + name);
      if (el) el.classList.add('active');
      this.dom.pause.classList.remove('show');
      this.dom.menu.classList.remove('show');
      if (name === 'battle') $('#screen-battle').classList.add('active');
      if (name !== 'codex') this.codexReturn = this.codexReturn || 'title';
      this.updateCursor();
    },
    startAttract(mapId) {
      if (!this.world) return;
      this.game = null;
      this.selected = null; this.selectedType = null;
      this.world.effects.reset();
      const def = D.MAPS.find(m => m.id === mapId) || D.MAPS[0];
      this.world.setMap(def, null);
      const bm = new BattleMap(def);
      this.world.setRoutes(def.entrances.map(e => ({ id: e.id, color: e.color, cells: bm.routes[e.id] ? bm.routes[e.id].cells : [], exitId: bm.routes[e.id] ? bm.routes[e.id].exitId : '' })));
      this.world.camGoal.yaw = -0.7;
      this.world.camGoal.pitch = 1.02;
      this.world.camGoal.dist = Math.max(def.rows[0].length, def.rows.length) * CELL * 1.5;
      this.attract = true;
      this.attractT = 0;
      this.hideSelection();
      this.dom.demoLayer.classList.remove('show');
      this.dom.buildHint.classList.add('hidden');
    },
    openMaps() {
      this.setScreen('maps');
      this.attract = true;
      this.game = null;
      this.world.setMap(D.MAPS[0], null);
      const bm0 = new BattleMap(D.MAPS[0]);
      this.world.setRoutes(D.MAPS[0].entrances.map(e => ({ id: e.id, color: e.color, cells: bm0.routes[e.id] ? bm0.routes[e.id].cells : [], exitId: bm0.routes[e.id] ? bm0.routes[e.id].exitId : '' })));
      this.world.camGoal.yaw = -0.7; this.world.camGoal.pitch = 1.0;
      this.world.camGoal.dist = 104;
      if (global.AUDIO) AUDIO.startMusic('segment');
    },
    startBattle(mapId, opts) {
      opts = opts || {};
      this.clearPlacement();
      this.selected = null; this.hideSelection();
      this.logsShown = 0;
      this.dom.logPanel.innerHTML = '';
      const mapDef = D.MAPS.find(m => m.id === mapId) || D.MAPS[0];
      if (!this.world) return;
      this.world.effects.reset();
      if (global.AUDIO) { AUDIO.unlock(); AUDIO.startMusic(mapId); }
      const game = new global.Game({ mapId, world: this.world, mode: opts.mode || 'live', seed: opts.seed });
      this.game = game;
      this.attract = false;
      this.demoMode = !!opts.demo; this.exportMode = !!opts.export;
      game.onEvent = (type, data) => this.onGameEvent(type, data);
      document.getElementById('screen-result').classList.remove('active');
      document.getElementById('overlay-pause').classList.remove('show');
      document.getElementById('overlay-menu').classList.remove('show');
      this.dom.mapNameHud.textContent = mapDef.code + ' · ' + mapDef.name;
      this.dom.demoLayer.classList.toggle('show', !!(this.demoMode || this.exportMode));
      this.dom.buildHint.classList.add('hidden');
      this.setScreen('battle');
      this.setSpeed(1);
      game.paused = false;
      game.start();
      this.updateHUD(true);
      this.hideSelection();
      if (opts.skipPrep) game.prepTimer = 0.01;
      this.updateCursor();
      return game;
    },
    quitBattle() {
      if (this.game) { this.game.paused = true; }
      this.game = null;
      this.clearPlacement();
      this.hideSelection();
      this.setScreen('maps');
      this.dom.demoLayer.classList.remove('show');
      this.world.setMap(D.MAPS[0], null);
      const bm0 = new BattleMap(D.MAPS[0]);
      this.world.setRoutes(D.MAPS[0].entrances.map(e => ({ id: e.id, color: e.color, cells: bm0.routes[e.id] ? bm0.routes[e.id].cells : [], exitId: bm0.routes[e.id] ? bm0.routes[e.id].exitId : '' })));
      this.world.camGoal.yaw = -0.7; this.world.camGoal.pitch = 1.0; this.world.camGoal.dist = 104;
      this.attract = true;
      if (global.AUDIO) AUDIO.startMusic('segment');
    },
    restartBattle() {
      if (!this.game) return;
      const mapId = this.game.mapDef.id;
      const mode = this.game.mode;
      this.startBattle(mapId, { mode: mode === 'demo' ? 'demo' : 'live' });
    },

    /* ---------------- map cards ---------------- */
    buildMapCards() {
      const grid = this.dom.mapsGrid;
      grid.innerHTML = '';
      D.MAPS.forEach((m, idx) => {
        const card = document.createElement('div');
        card.className = 'map-card';
        card.dataset.map = m.id;
        card.innerHTML = `
          <div class="art"><canvas width="640" height="380"></canvas><div class="tag">${m.code} / ${idx + 1 < 10 ? '0' : ''}${idx + 1}</div></div>
          <div class="body">
            <h3>${m.name}</h3>
            <div class="sub">${m.subtitle}</div>
            <p>${m.desc}</p>
            <div class="stats"><span>难度 <b>${m.difficulty}</b></span><span>波次 <b>${m.waves}</b></span><span>入口 <b>${m.entrances.length}</b></span><span>出口 <b>${m.exits.length}</b></span></div>
            <div class="go"><span>${m.entrances.map(e => e.id).join(' / ')} → ${m.exits.map(e => e.id).join(' / ')}</span></div>
          </div>`;
        grid.appendChild(card);
        this.drawMapArt(card.querySelector('canvas'), m);
        card.addEventListener('click', () => {
          if (global.AUDIO) AUDIO.sfx('ui');
          this.startBattle(m.id);
        });
      });
    },
    drawMapArt(canvas, m) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const theme = m.theme;
      const accent = theme.accent;
      const bg = '#' + theme.bg.toString(16).padStart(6, '0');
      const cols = m.rows[0].length, rows = m.rows.length;
      const cw = W / cols, ch = H / rows;
      const rgb = c => '#' + c.toString(16).padStart(6, '0');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 10, W * 0.5, H * 0.5, W * 0.72);
      g.addColorStop(0, 'rgba(40,140,145,.3)'); g.addColorStop(0.55, 'rgba(12,50,60,.14)'); g.addColorStop(1, 'rgba(0,0,0,.2)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // technical grid
      ctx.strokeStyle = 'rgba(110,240,230,.09)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(110,240,230,.045)';
      for (let i = -H; i < W; i += 96) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke(); }
      // links: glowing circuit lines
      const isRoad = (x, y) => y >= 0 && y < rows && x >= 0 && x < m.rows[y].length && '.oABCXY'.includes(m.rows[y][x]);
      const zoneColor = (cellX, cellY) => {
        for (const z of m.zones || []) if (cellX >= z.x1 && cellY >= z.y1 && cellX <= z.x2 && cellY <= z.y2) return theme.zone[z.id] || theme.road;
        return theme.road;
      };
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!isRoad(x, y)) continue;
          const px = x * cw + cw / 2, py = y * ch + ch / 2;
          const col = m.rows[y][x] === 'o' ? '#c07848' : accent;
          const linked = [[1, 0], [0, 1], [-1, 0], [0, -1]].some(([dx, dy]) => isRoad(x + dx, y + dy));
          if (!linked) continue;
          for (const [dx, dy] of [[1, 0], [0, 1]]) {
            if (!isRoad(x + dx, y + dy)) continue;
            ctx.save();
            ctx.strokeStyle = col; ctx.globalAlpha = m.rows[y][x] === 'o' || m.rows[y + dy][x + dx] === 'o' ? 0.55 : 0.72;
            ctx.lineWidth = Math.min(cw, ch) * 0.2;
            ctx.shadowColor = col; ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + dx * cw, py + dy * ch);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
      // tiles / nodes
      m.rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch0 = row[x];
          const px = x * cw + cw / 2, py = y * ch + ch / 2;
          if ('.oABCXY'.includes(ch0)) {
            const base = zoneColor(x, y);
            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = rgb(base);
            const s = Math.min(cw, ch) * 0.6;
            ctx.beginPath();
            ctx.roundRect(px - s / 2, py - s / 2, s, s, 3);
            ctx.fill();
            ctx.strokeStyle = ch0 === 'o' ? 'rgba(255,166,110,.65)' : 'rgba(130,255,245,.35)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
            if (x % 2 === 0 && y % 2 === 0) {
              ctx.fillStyle = 'rgba(180,255,250,.5)';
              ctx.fillRect(px - 1, py - 1, 2, 2);
            }
          } else if (ch0 === 'P') {
            ctx.save();
            ctx.fillStyle = 'rgba(30,74,92,.75)';
            ctx.beginPath(); ctx.arc(px, py, Math.min(cw, ch) * 0.28, 0, 6.283); ctx.fill();
            ctx.strokeStyle = 'rgba(140,250,255,.6)'; ctx.lineWidth = 1.2; ctx.stroke();
            ctx.strokeStyle = 'rgba(140,250,255,.3)';
            ctx.beginPath(); ctx.arc(px, py, Math.min(cw, ch) * 0.38, 0, 6.283); ctx.stroke();
            ctx.restore();
          }
        }
      });
      // switch nodes
      (m.switches || []).forEach(sw => {
        const px = sw.x * cw + cw / 2, py = sw.y * ch + ch / 2;
        const r = Math.min(cw, ch) * 0.38;
        ctx.save(); ctx.translate(px, py);
        ctx.shadowColor = accent; ctx.shadowBlur = 16;
        ctx.fillStyle = 'rgba(6,18,20,.95)';
        ctx.strokeStyle = 'rgba(140,255,235,.95)'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 - Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(140,255,235,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, 6.283); ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(0, 0, 2.3, 0, 6.283); ctx.fill();
        ctx.restore();
      });
      // entrances
      (m.entrances || []).forEach(en => {
        const px = en.x * cw + cw / 2, py = en.y * ch + ch / 2;
        ctx.save();
        const col = en.color;
        const rg = ctx.createRadialGradient(px, py, 0, px, py, 48);
        rg.addColorStop(0, col); rg.addColorStop(0.18, col + 'cc'); rg.addColorStop(0.5, col + '44'); rg.addColorStop(1, 'transparent');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, 48, 0, 6.283); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, 17, 0, 6.283); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 24, 0.4, 2.2); ctx.stroke();
        ctx.fillStyle = '#eaffff'; ctx.font = '700 22px Bahnschrift, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = col; ctx.shadowBlur = 12;
        ctx.fillText(en.id, px, py + 1);
        ctx.shadowBlur = 0;
        ctx.fillStyle = col; ctx.font = '600 12px Bahnschrift, sans-serif';
        ctx.fillText(en.name, px, py + 36);
        ctx.restore();
      });
      // exits core
      (m.exits || []).forEach(ex => {
        const px = ex.x * cw + cw / 2, py = ex.y * ch + ch / 2;
        const rg = ctx.createRadialGradient(px, py, 0, px, py, 58);
        rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.12, ex.color); rg.addColorStop(0.4, ex.color + '66'); rg.addColorStop(1, 'transparent');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, 58, 0, 6.283); ctx.fill();
        ctx.strokeStyle = ex.color; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(px, py, 24, 0, 6.283); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 30, -0.6, 1.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 30, 2.4, 4.2); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '700 16px Bahnschrift, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = ex.color; ctx.shadowBlur = 14;
        ctx.fillText(ex.id, px, py + 1);
        ctx.shadowBlur = 0;
        ctx.fillStyle = ex.color; ctx.font = '600 11px Bahnschrift, sans-serif';
        ctx.fillText(ex.name, px, py + 40);
      });
      // top-left telemetry strips
      ctx.save();
      ctx.strokeStyle = 'rgba(150,255,245,.25)'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(18, 18 + i * 7); ctx.lineTo(18 + 26 + i * 9, 18 + i * 7); ctx.stroke(); }
      ctx.fillStyle = 'rgba(150,255,245,.4)'; ctx.font = '10px Consolas, monospace';
      ctx.fillText(m.code + ' // TOPOLOGY', 18, 58);
      ctx.restore();
      // scanlines and vignette
      ctx.fillStyle = 'rgba(0,0,0,.10)';
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, W * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    },

    /* ---------------- deck ---------------- */
    buildDeck() {
      const deck = $('#deck-towers'); deck.innerHTML = '';
      D.TOWER_ORDER.forEach((id, i) => {
        const def = D.TOWER_DEFS[id];
        const el = document.createElement('div');
        el.className = 'card';
        el.dataset.type = 'tower'; el.dataset.id = id;
        el.style.color = def.color;
        el.innerHTML = `
          <div class="card-top"><span class="role">${def.role}</span><span class="hotkey">${i + 1}</span></div>
          <div class="ico-wrap"><div class="halo"></div>${ICONS[def.icon] || ''}</div>
          <div class="name">${def.name}</div>
          <div class="desc">${def.tags[0]}</div>
          <div class="cost"><span class="cost-chip"><span class="cico"></span>${def.cost.compute}</span>${def.cost.intel ? `<span class="cost-chip intel"><span class="cico"></span>${def.cost.intel}</span>` : ''}</div>
          <div class="card-foot" style="background:linear-gradient(90deg,transparent,${def.color},transparent)"></div>`;
        el.addEventListener('pointerdown', (e) => this.onCardDown(e, 'tower', id));
        el.addEventListener('mouseenter', () => this.showCardTooltip(el, 'tower', id));
        el.addEventListener('mouseleave', () => this.hideTooltip());
        deck.appendChild(el); this.cardMap[id] = el;
      });
      const items = $('#deck-items'); items.innerHTML = '';
      D.ITEM_ORDER.forEach((id, i) => {
        const def = D.ITEM_DEFS[id];
        const el = document.createElement('div');
        el.className = 'card item';
        el.dataset.type = 'item'; el.dataset.id = id;
        el.style.color = def.color;
        el.innerHTML = `
          <div class="card-top"><span class="role">${def.cost.intel ? '情报' : '算力'}</span><span class="hotkey">${['Q', 'W', 'E'][i]}</span></div>
          <div class="ico-wrap"><div class="halo"></div>${ICONS[def.icon] || ''}</div>
          <div class="name">${def.name}</div>
          <div class="cost"><span class="cost-chip ${def.cost.intel ? 'intel' : ''}"><span class="cico"></span>${def.cost.intel || def.cost.compute}</span></div>
          <div class="cd-mask">0s</div>
          <div class="card-foot"></div>`;
        el.addEventListener('pointerdown', (e) => this.onCardDown(e, 'item', id));
        el.addEventListener('mouseenter', () => this.showCardTooltip(el, 'item', id));
        el.addEventListener('mouseleave', () => this.hideTooltip());
        items.appendChild(el); this.itemMap[id] = el;
      });
    },
    showCardTooltip(el, type, id) {
      const def = type === 'tower' ? D.TOWER_DEFS[id] : D.ITEM_DEFS[id];
      const tip = this.dom.tooltip;
      const rect = el.getBoundingClientRect();
      let html = `<b>${def.name} <span class="k">${type === 'tower' ? def.role : '道具'}</span></b><div>${def.desc}</div>`;
      if (type === 'tower') {
        html += `<div class="k" style="margin-top:.3rem">算力 ${def.cost.compute}${def.cost.intel ? ' · 情报 ' + def.cost.intel : ''}</div>`;
        html += `<div class="k">${def.tags.join(' · ')}</div>`;
        if (def.branches) html += `<div class="k">Lv.2 分支：${def.branches.map(b => b.name).join(' / ')}</div>`;
      } else {
        html += `<div class="k" style="margin-top:.3rem">消耗 ${def.cost.intel ? '情报 ' + def.cost.intel : '算力 ' + def.cost.compute} · 冷却 ${def.cd}s</div>`;
      }
      tip.innerHTML = html;
      tip.style.display = 'block';
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = rect.left + rect.width / 2 - tw / 2;
      let y = rect.top - th - 10;
      if (y < 8) y = rect.bottom + 10;
      x = clamp(x, 8, innerWidth - tw - 8);
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    },
    hideTooltip() { this.dom.tooltip.style.display = 'none'; },

    /* ---------------- events ---------------- */
    bind() {
      $('#btn-start').addEventListener('click', () => { AUDIO.unlock(); AUDIO.sfx('ui'); this.openMaps(); });
      $('#btn-codex-title').addEventListener('click', () => this.openCodex('title'));
      $('#btn-demos-title').addEventListener('click', () => { this.openMaps(); });
      $('#maps-back').addEventListener('click', () => this.setScreen('title'));
      $$('.demo-btn').forEach(b => b.addEventListener('click', () => {
        if (global.DEMO) global.DEMO.start(b.dataset.demo);
      }));
      $('#codex-back').addEventListener('click', () => this.closeCodex());
      $$('.codex-tab').forEach(tab => tab.addEventListener('click', () => {
        $$('.codex-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active'); this.renderCodex(tab.dataset.tab);
      }));
      $('#btn-cam-reset').addEventListener('click', () => { this.world.resetCamera(); AUDIO.sfx('ui'); });
      $('#btn-menu').addEventListener('click', () => { this.game && (this.game.paused = true); this.dom.menu.classList.add('show'); AUDIO.sfx('ui'); });
      $('#btn-menu-close').addEventListener('click', () => { this.dom.menu.classList.remove('show'); if (this.game) this.game.paused = false; });
      $('#btn-pause').addEventListener('click', () => this.togglePause());
      $('#btn-resume').addEventListener('click', () => this.togglePause(false));
      $('#btn-pause-restart').addEventListener('click', () => this.restartBattle());
      $('#btn-pause-quit').addEventListener('click', () => this.quitBattle());
      $('#btn-pause-codex').addEventListener('click', () => this.openCodex('pause'));
      $('#btn-menu-codex').addEventListener('click', () => this.openCodex('menu'));
      $('#btn-menu-restart').addEventListener('click', () => { this.dom.menu.classList.remove('show'); this.restartBattle(); });
      $('#btn-menu-quit').addEventListener('click', () => { this.dom.menu.classList.remove('show'); this.quitBattle(); });
      $$('.speed-group button[data-speed]').forEach(b => {
        b.addEventListener('click', () => {
          const s = parseFloat(b.dataset.speed);
          if (s === 0) this.togglePause();
          else { this.setSpeed(s); if (this.game) this.game.paused = false; this.dom.pause.classList.remove('show'); }
        });
      });
      $('#btn-skip-wave').addEventListener('click', () => { if (this.game) this.game.skipPrep(); });
      $('#sel-close').addEventListener('click', () => this.hideSelection());
      $('#sel-body').addEventListener('click', (e) => this.onSelAction(e));
      $('#confirm-cancel').addEventListener('click', () => this.cancelConfirm());
      $('#confirm-ok').addEventListener('click', () => this.okConfirm());
      $('#branch-cancel').addEventListener('click', () => this.dom.branch.classList.remove('show'));
      $('#branch-body').addEventListener('click', (e) => {
        const b = e.target.closest('[data-branch]');
        if (b) this.doUpgrade(this.selected, b.dataset.branch);
      });
      $('#master-volume').addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10) / 100;
        AUDIO.setVolume(v); $('#volume-val').textContent = e.target.value;
        try { localStorage.setItem('td_volume', e.target.value); } catch (x) {}
      });
      $('#toggle-mute').addEventListener('click', (e) => {
        const el = e.currentTarget; el.classList.toggle('on');
        AUDIO.setMuted(el.classList.contains('on'));
      });
      $('#toggle-scan').addEventListener('click', (e) => {
        const el = e.currentTarget; el.classList.toggle('on');
        $('#scanlines').style.display = el.classList.contains('on') ? 'block' : 'none';
      });
      $('#toggle-autocam').addEventListener('click', (e) => e.currentTarget.classList.toggle('on'));
      $('#btn-result-retry').addEventListener('click', () => { this.dom.result.classList.remove('active'); this.restartBattle(); });
      $('#btn-result-maps').addEventListener('click', () => { this.dom.result.classList.remove('active'); this.quitBattle(); });
      $('#btn-result-codex').addEventListener('click', () => this.openCodex('result'));
      $('#btn-demo-exit').addEventListener('click', () => { if (global.DEMO) global.DEMO.stop(); });
      // canvas pointer
      const canvas = this.world.canvas;
      canvas.addEventListener('pointermove', (e) => this.onCanvasMove(e));
      canvas.addEventListener('pointerdown', (e) => {
        if (e.button === 0) this.onCanvasDown(e);
        if (e.button === 2) this.cancelPlacement();
      });
      canvas.addEventListener('pointerleave', () => { this.hoverEntity = null; if (!this.placement) this.hideTooltip(); });
      window.addEventListener('pointermove', (e) => this.onWindowMove(e));
      window.addEventListener('pointerup', (e) => this.onWindowUp(e));
      window.addEventListener('keydown', (e) => this.onKey(e));
      window.addEventListener('resize', () => { this.world.resize(); this.updateCursor(); });
      document.addEventListener('contextmenu', (e) => { if (this.screen === 'battle') e.preventDefault(); });
      ['click', 'keydown'].forEach(ev => window.addEventListener(ev, () => AUDIO.unlock(), { once: true }));
      window.addEventListener('blur', () => { if (this.game && !this.game.over && !this.demoMode) { /* no auto pause */ } });
    },
    loadSettings() {
      try {
        const v = localStorage.getItem('td_volume');
        if (v != null) { $('#master-volume').value = v; $('#volume-val').textContent = v; AUDIO.setVolume(parseInt(v, 10) / 100); }
      } catch (e) {}
    },

    /* ---------------- placement flow ---------------- */
    onCardDown(e, type, id) {
      if (this.demoMode || this.exportMode || !this.game || this.game.over) return;
      e.preventDefault();
      if (e.button != null && e.button !== 0) return;
      AUDIO.sfx('ui');
      this.beginPlacement(type, id);
      this.drag = { x: e.clientX, y: e.clientY, moved: false, fromCard: true };
      if (this.placementEl) this.placementEl.classList.add('dragging');
      this.updatePlacementFromScreen(e.clientX, e.clientY);
      this.showHintFor(type, id);
    },
    beginPlacement(type, id) {
      this.clearPlacement(true);
      this.placement = { type, id, cell: null, facing: 0, stage: 'drag' };
      this.placementEl = (type === 'tower' ? this.cardMap[id] : this.itemMap[id]) || null;
      this.previewActive = false;
      this.facingMode = false;
      this.aiming = 0;
    },
    showHintFor(type, id) {
      const hint = this.dom.buildHint;
      hint.classList.remove('hidden');
      if (type === 'tower') {
        const def = D.TOWER_DEFS[id];
        hint.innerHTML = `部署 <b>${def.name}</b> · ${def.layer === 'platform' ? '拖到设备平台' : def.layer === 'switch' ? '拖到交换节点' : '拖到链路'} · 右键 / Esc 取消`;
      } else {
        const def = D.ITEM_DEFS[id];
        hint.innerHTML = `投放 <b>${def.name}</b> · ${def.target === 'switch' ? '选择交换节点' : def.target === 'area' ? '选择链路区域' : '选择一座塔'} · 右键 / Esc 取消`;
      }
    },
    updatePlacementFromScreen(cx, cy) {
      if (!this.placement) return;
      const cell = this.world.pickCell(cx, cy);
      this.placement.cell = cell;
      if (!cell) { this.world.hidePlacement(); this.clearRoutePreview(); return; }
      const type = this.placement.type, id = this.placement.id;
      if (type === 'item' && id === 'backup') {
        const valid = !!cell.tower;
        this.world.showPlacement(cell, null, 0.8, { valid, color: 0x9dffb4 });
        return;
      }
      if (type === 'item' && id === 'downgrade') {
        this.world.showArea(cell, D.ITEM_DEFS.downgrade.radius, 0xff9c6b, 0xffce6a);
        this.updateRoutePreview(cell, null);
        return;
      }
      if (type === 'item' && id === 'isolator') {
        const chk = this.game.canUseItem(id, cell);
        this.world.showPlacement(cell, null, 1.4, { valid: chk.ok, color: 0xffce6a });
        this.updateRoutePreview(cell, 'isolator');
        return;
      }
      const def = D.TOWER_DEFS[id];
      if (!def) return;
      const chk = this.game.canPlace(id, cell);
      let radius = def.levels[0].range || def.levels[0].healRange || 1.8;
      if (id === 'sandbox') radius = def.levels[0].detect || 3.6;
      if (id === 'repair') radius = def.levels[0].healRange || 3.8;
      this.world.showPlacement(cell, id, radius, { valid: chk.ok, color: parseInt(def.color.slice(1), 16), facing: this.placement.facing, cone: id === 'interceptor' ? (def.levels[0].cone || 42) : null });
      if (cell.type === 'switch' && (id === 'netgap' || id === 'firewall')) this.updateRoutePreview(cell, id);
      else this.clearRoutePreview();
    },
    updateRoutePreview(cell, kind) {
      if (!cell || !this.game) return;
      if (cell.type !== 'switch') {
        this.clearRoutePreview();
        if (kind === 'isolator') this.world.showArea(cell, 1.2, 0xffce6a, 0xffce6a);
        return;
      }
      if (cell.isolation) { this.clearRoutePreview(); return; }
      const preview = this.game.previewRoutes(cell);
      this.world.setPreviewRoutes(preview.routes);
      this.previewActive = true;
      this.previewCell = cell;
      this.previewInfo = preview;
      const hint = this.dom.buildHint;
      const affected = preview.routes.map(r => r.id + (r.ok ? '' : '×')).join(' / ');
      hint.innerHTML = `<b>路由预览</b> · 隔离 ${cell.switch ? cell.switch.name : '节点'} 后：${preview.sealed.length ? '<span style="color:#ff8fa1">将封死 ' + preview.sealed.join('/') + '</span>' : '各入口路线已同步更新'} · 确认前可取消`;
      if (preview.sealed.length) hint.innerHTML += ` <span style="color:#ff8fa1">（操作将被拒绝）</span>`;
    },
    clearRoutePreview() {
      if (!this.previewActive) return;
      this.previewActive = false;
      this.previewCell = null;
      this.previewInfo = null;
      this.world.setPreviewRoutes([]);
    },
    onWindowMove(e) {
      if (this.demoMode || this.exportMode) return;
      if (this.drag && this.placement) {
        if (Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 6) this.drag.moved = true;
        this.updatePlacementFromScreen(e.clientX, e.clientY);
      } else if (this.placement && this.placement.stage === 'facing') {
        this.updateFacing(e.clientX, e.clientY);
      }
    },
    updateFacing(cx, cy) {
      if (!this.placement || !this.placement.cell) return;
      const cell = this.placement.cell;
      const p = this.world.cellCenter(cell, 0);
      const rect = this.world.canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      this.world.raycaster.setFromCamera(ndc, this.world.camera);
      const hit = new THREE.Vector3();
      if (this.world.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4), hit)) {
        this.placement.facing = Math.atan2(hit.x - p.x, hit.z - p.z);
        this.world.showPlacement(cell, 'interceptor', D.TOWER_DEFS.interceptor.levels[0].range, {
          valid: true, color: 0x7fb4ff, facing: this.placement.facing, cone: 42
        });
      }
    },
    onWindowUp(e) {
      if (this.demoMode || this.exportMode) return;
      if (!this.placement || !this.drag) return;
      const wasClick = !this.drag.moved;
      const overCard = this.placementEl && e.target instanceof Node && this.placementEl.contains(e.target);
      if (this.placementEl) this.placementEl.classList.remove('dragging');
      this.drag = null;
      if (wasClick && overCard) {
        // click-to-place mode: keep ghost following cursor until next click
        this.placement.stage = 'click';
        this.dom.buildHint.classList.remove('hidden');
        return;
      }
      if (this.placement.stage === 'facing') return;
      if (this.placement.cell) this.attemptPlacement(this.placement.cell);
      else this.cancelPlacement();
    },
    onCanvasDown(e) {
      if (this.demoMode || this.exportMode || !this.game) return;
      const cell = this.world.pickCell(e.clientX, e.clientY);
      if (this.placement && this.placement.stage === 'facing') {
        this.commitPlacement();
        return;
      }
      if (this.placement) {
        if (cell) { this.updatePlacementFromScreen(e.clientX, e.clientY); this.attemptPlacement(cell); }
        return;
      }
      // selection
      const hit = this.world.pickEntity(e.clientX, e.clientY, this.game);
      if (hit && hit.type === 'tower') { this.selectTower(hit.obj); AUDIO.sfx('select'); return; }
      if (hit && hit.type === 'enemy') { this.selectEnemy(hit.obj); AUDIO.sfx('select'); return; }
      if (cell) { this.selectCell(cell); AUDIO.sfx('select'); return; }
      this.hideSelection();
    },
    attemptPlacement(cell) {
      if (!this.placement || !this.game) return;
      const { type, id } = this.placement;
      if (type === 'tower') {
        const id2 = id;
        const def = D.TOWER_DEFS[id2];
        const chk = this.game.canPlace(id2, cell);
        if (!chk.ok) { this.toast(chk.reason, 'bad'); AUDIO.sfx('error'); this.cancelPlacement(); return; }
        if (cell.type === 'switch' && (id2 === 'netgap' || id2 === 'firewall')) {
          this.openConfirm({
            kind: 'tower', id: id2, cell,
            title: '确认隔离节点',
            kicker: 'ROUTE PREVIEW / 路由预览',
            body: `在 <b>${cell.switch ? cell.switch.name : '交换节点'}</b> 部署 ${def.name}，该节点将被隔离、无法通行。确认前可查看各入口的新路线；若操作会封死任何入口，系统将拒绝执行。`,
            okText: '确认部署并隔离'
          });
          return;
        }
        if (id2 === 'interceptor') {
          this.placement.stage = 'facing';
          this.placement.cell = cell;
          this.updateFacing(window.innerWidth / 2, window.innerHeight / 2);
          this.dom.buildHint.classList.remove('hidden');
          this.dom.buildHint.innerHTML = `设定 <b>拦截器</b> 朝向 · 移动鼠标旋转攻击扇区 · 左键确认 · 右键 / Esc 取消`;
          return;
        }
        this.doPlaceTower(id2, cell);
      } else if (type === 'item') {
        if (id === 'backup') {
          if (!cell.tower) { this.toast('请选择一座塔', 'bad'); AUDIO.sfx('error'); return; }
          const r = this.game.useItem('backup', cell);
          if (!r.ok) { this.toast(r.reason, 'bad'); AUDIO.sfx('error'); }
          else this.flashRes('compute');
          this.cancelPlacement();
        } else if (id === 'isolator') {
          const chk = this.game.canUseItem('isolator', cell);
          if (!chk.ok) { this.toast(chk.reason, 'bad'); AUDIO.sfx('error'); this.cancelPlacement(); return; }
          this.openConfirm({
            kind: 'item', id: 'isolator', cell,
            title: '投放应急隔离器',
            kicker: 'EMERGENCY ISOLATION / 应急隔离',
            body: `在 <b>${cell.switch ? cell.switch.name : '交换节点'}</b> 插入应急隔离器，临时隔离 ${D.ITEM_DEFS.isolator.duration} 秒（耐久 ${D.ITEM_DEFS.isolator.hp}，会被敌人冲毁，不产生情报）。`,
            okText: '确认投放'
          });
        } else if (id === 'downgrade') {
          if (!cell.walk) { this.toast('只能投放在链路上', 'bad'); AUDIO.sfx('error'); return; }
          this.openConfirm({
            kind: 'item', id: 'downgrade', cell,
            title: '投放协议降级',
            kicker: 'PROTOCOL DOWNGRADE / 区域降级',
            body: `一片链路将暂时使用旧协议 ${D.ITEM_DEFS.downgrade.duration} 秒：经过的地面敌人减速，木马显形，各入口的路线会随通行速度重新计算。`,
            okText: '确认投放'
          });
        }
      }
    },
    commitPlacement() {
      if (!this.placement) return;
      const { id, cell } = this.placement;
      if (id === 'interceptor' && this.placement.stage === 'facing') {
        const chk = this.game.canPlace('interceptor', cell);
        if (!chk.ok) { this.toast(chk.reason, 'bad'); AUDIO.sfx('error'); this.cancelPlacement(); return; }
        this.doPlaceTower('interceptor', cell, this.placement.facing);
      }
    },
    doPlaceTower(id, cell, facing) {
      const r = this.game.placeTower(id, cell, { facing: facing == null ? this.aiming : facing });
      if (!r.ok) { this.toast(r.reason, 'bad'); AUDIO.sfx('error'); this.cancelPlacement(); return; }
      this.toast(D.TOWER_DEFS[id].name + ' 已部署', 'ok');
      if (this.dom.buildHint) this.dom.buildHint.classList.add('hidden');
      this.flashRes('compute'); this.flashRes('intel');
      this.cancelPlacement();
      this.selectTower(r.tower);
    },
    openConfirm(ctx) {
      this.confirm = ctx;
      const preview = this.game.previewRoutes(ctx.cell);
      this.world.setPreviewRoutes(preview.routes);
      this.previewActive = true;
      $('#confirm-title').textContent = ctx.title;
      $('#confirm-kicker').textContent = ctx.kicker;
      $('#confirm-body').innerHTML = ctx.body + (preview.sealed.length ? `<div style="color:#ff9cae;margin-top:.4rem">警告：该操作会封死入口 ${preview.sealed.join('、')}，系统将拒绝执行。</div>` : '');
      const box = $('#confirm-preview'); box.innerHTML = '';
      preview.routes.forEach(r => {
        const def = D.MAPS.find(m => m.id === this.game.mapDef.id);
        const ent = def.entrances.find(e => e.id === r.id);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:.5rem;font-family:var(--mono);font-size:.62rem;color:#a9c6d0';
        row.innerHTML = `<span style="width:1.2rem;color:${ent.color}">${r.id}</span><span style="flex:1;color:${ent.color};height:2px;background:linear-gradient(90deg,${ent.color},transparent)"></span><span>${r.ok ? '→ ' + (r.exitId || '出口') : '<span style="color:#ff8fa1">无可行路线</span>'}</span>`;
        box.appendChild(row);
      });
      const ok = $('#confirm-ok'); ok.textContent = ctx.okText || '确认';
      ok.disabled = preview.sealed.length > 0;
      this.dom.confirm.classList.add('show');
      this.previewConfirmCtx = ctx;
      if (global.AUDIO) AUDIO.sfx('ui');
    },
    cancelConfirm() {
      this.dom.confirm.classList.remove('show');
      this.confirm = null;
      this.world.setPreviewRoutes([]);
      this.previewActive = false;
      this.cancelPlacement();
    },
    okConfirm() {
      if (!this.confirm) return;
      const ctx = this.confirm;
      this.dom.confirm.classList.remove('show');
      this.confirm = null;
      this.world.setPreviewRoutes([]);
      this.previewActive = false;
      if (ctx.kind === 'tower') {
        const chk = this.game.canPlace(ctx.id, ctx.cell);
        if (!chk.ok) { this.toast(chk.reason, 'bad'); AUDIO.sfx('error'); this.cancelPlacement(); return; }
        this.doPlaceTower(ctx.id, ctx.cell);
      } else {
        const r = this.game.useItem(ctx.id, ctx.cell);
        if (!r.ok) { this.toast(r.reason, 'bad'); AUDIO.sfx('error'); }
        else { this.toast(D.ITEM_DEFS[ctx.id].name + ' 已投放', 'ok'); if (this.dom.buildHint) this.dom.buildHint.classList.add('hidden'); this.flashRes('intel'); this.flashRes('compute'); }
        this.cancelPlacement();
      }
    },
    cancelPlacement() {
      if (this.placementEl) this.placementEl.classList.remove('dragging');
      this.placement = null; this.placementEl = null; this.drag = null; this.facingMode = false;
      this.world.hidePlacement();
      this.clearRoutePreview();
      this.dom.buildHint.classList.add('hidden');
    },
    clearPlacement(silent) {
      if (this.placementEl) this.placementEl.classList.remove('dragging');
      this.placement = null; this.placementEl = null; this.drag = null; this.facingMode = false;
      if (this.world) this.world.hidePlacement();
      if (this.world) this.world.setPreviewRoutes([]);
      this.previewActive = false;
      if (!silent) this.dom.buildHint.classList.add('hidden');
    },
    togglePause(force) {
      if (!this.game || this.game.over) return;
      const pause = force == null ? !this.game.paused : force;
      this.game.paused = pause;
      this.dom.pause.classList.toggle('show', pause);
      if (!pause) this.dom.menu.classList.remove('show');
      AUDIO.sfx('ui');
      this.updateSpeedButtons();
    },
    setSpeed(s) {
      if (!this.game) return;
      this.game.speed = s;
      this.game.paused = false;
      this.dom.pause.classList.remove('show');
      this.updateSpeedButtons();
    },
    updateSpeedButtons() {
      const paused = this.game && this.game.paused;
      $$('.speed-group button[data-speed]').forEach(b => {
        const s = parseFloat(b.dataset.speed);
        b.classList.toggle('active', paused ? s === 0 : (this.game && s === this.game.speed));
      });
      const pb = $('#btn-pause'); if (pb) pb.textContent = paused ? '▶' : '❚❚';
    },

    /* ---------------- selection ---------------- */
    hideSelection() {
      this.selected = null; this.selectedType = null;
      this.dom.selPanel.classList.remove('show');
      if (this.world) this.world.selectRing(null);
    },
    selectTower(t) {
      if (!t) return;
      this.selected = t; this.selectedType = 'tower';
      this.renderSelection();
      this.world.selectRing('tower', this.world.cellCenter(t.cell, 0.7), 0x6effff);
      this.dom.selPanel.classList.add('show');
    },
    selectEnemy(e) {
      if (!e) return;
      this.selected = e; this.selectedType = 'enemy';
      this.renderSelection();
      this.world.selectRing('enemy', e.view ? e.view.position.clone() : this.world.cellCenter(e.cell, 0.5), 0xff8fa1);
      this.dom.selPanel.classList.add('show');
    },
    selectCell(cell) {
      this.selected = cell; this.selectedType = 'cell';
      this.renderSelection();
      this.world.selectRing('cell', this.world.cellCenter(cell, 0.4), 0x6effff);
      this.dom.selPanel.classList.add('show');
    },
    renderSelection() {
      if (!this.selected || !this.game) return;
      const body = this.dom.selBody;
      if (this.selectedType === 'tower') {
        const t = this.selected;
        if (!this.game.towers.includes(t)) { this.hideSelection(); return; }
        const st = this.game.towerStats(t);
        const def = t.def;
        const enc = t.encryptedUntil > this.game.time;
        this.dom.selType.textContent = 'TOWER / 守方设备 · ' + def.role;
        this.dom.selName.innerHTML = `${def.name} <small>Lv.${t.level}${t.branch ? ' · ' + (def.branches.find(b => b.id === t.branch) || {}).name : ''}</small>`;
        const hpPct = clamp(t.hp / t.maxHp * 100, 0, 100);
        let stats = '';
        if (def.id === 'firewall') stats = `<div class="stat"><span>伤害</span><b>${st.dmg}</b></div><div class="stat"><span>射速</span><b>${st.rate.toFixed(2)}/s</b></div><div class="stat"><span>射程</span><b>${st.range} 格</b></div><div class="stat"><span>阻挡</span><b>${t.isNodeTower ? '隔离' : ([...t.blockedSet].reduce((a,e)=>a+(e.def.block||1),0) + ' / ' + st.block)}</b></div>`;
        else if (def.id === 'honeypot') stats = `<div class="stat"><span>诱敌范围</span><b>${st.lureRadius} 格</b></div><div class="stat"><span>诱敌容量</span><b>${t.luredSet.size} / ${st.lureCap}</b></div><div class="stat"><span>加密免疫</span><b>是</b></div><div class="stat"><span>耐久</span><b>较低</b></div>`;
        else if (def.id === 'netgap') stats = `<div class="stat"><span>节点状态</span><b>${t.cell.isolation ? '已隔离' : '直通'}</b></div><div class="stat"><span>耐久</span><b>高</b></div><div class="stat"><span>攻击</span><b>无</b></div><div class="stat"><span>再隔离间隔</span><b>12s</b></div>`;
        else if (def.id === 'interceptor') stats = `<div class="stat"><span>伤害</span><b>${st.dmg}</b></div><div class="stat"><span>射速</span><b>${st.rate.toFixed(2)}/s</b></div><div class="stat"><span>射程</span><b>${st.range} 格</b></div><div class="stat"><span>扇区</span><b>${st.cone}°</b></div>`;
        else if (def.id === 'sandbox') stats = `<div class="stat"><span>范围伤害</span><b>${st.dmg}</b></div><div class="stat"><span>攻击半径</span><b>${st.aoe} 格</b></div><div class="stat"><span>检测半径</span><b>${st.detect} 格</b></div><div class="stat"><span>目标</span><b>地面</b></div>`;
        else if (def.id === 'repair') stats = `<div class="stat"><span>治疗</span><b>${st.heal}/s</b></div><div class="stat"><span>范围</span><b>${st.healRange} 格</b></div><div class="stat"><span>攻击</span><b>无</b></div><div class="stat"><span>解除加密</span><b>${st.cleanseEvery ? '每 5s' : 'Lv.2 解锁'}</b></div>`;
        const sk = D.SKILLS[def.skill];
        const cd = t.skillCd > this.game.time ? Math.ceil(t.skillCd - this.game.time) : 0;
        body.innerHTML = `
          <div class="hp-line"><div class="top"><span>设备生命</span><b>${Math.ceil(t.hp)} / ${t.maxHp}</b></div><div class="hp-bar"><i class="${hpPct < 35 ? 'bad' : hpPct < 65 ? 'warn' : ''}" style="width:${hpPct}%"></i></div></div>
          <div class="stat-grid">${stats}</div>
          <div class="tag-row">${def.tags.map(tg => `<span class="tag-pill">${tg}</span>`).join('')}${t.level >= 2 ? '<span class="tag-pill gold">Lv.2</span>' : ''}${enc ? '<span class="tag-pill pink">已加密</span>' : ''}${t.isolates && t.cell.isolation ? '<span class="tag-pill gold">节点隔离中</span>' : ''}</div>
          <div class="sel-desc">${def.desc}</div>
          <button class="skill-btn ${enc ? 'encrypted' : ''} ${cd > 0 && !enc ? 'cooling' : ''}" data-act="skill" ${enc || cd > 0 ? 'disabled' : ''}>${enc ? '加密中 · 无法释放技能' : sk.name + ' · ' + sk.desc}
            ${cd > 0 && !enc ? `<span class="cd">冷却 ${cd}s</span>` : ''}
          </button>
          <div class="sel-actions">
            <button class="btn ghost" data-act="upgrade" ${t.level >= 2 ? 'disabled' : ''}>${t.level >= 2 ? '已达 Lv.2' : '升级 Lv.2 · ' + this.game.upgradeCost(t).compute + ' 算力 / ' + this.game.upgradeCost(t).intel + ' 情报'}</button>
            <button class="btn ghost" data-act="sell">撤下 · 返还 ${Math.floor(def.cost.compute * 0.6)} 算力</button>
          </div>
          <div class="sel-footnote">${def.branches ? 'Lv.2 时可在两个互斥分支中二选一。' : ''}节点上的塔被摧毁后隔离会解除，道路重新打开。</div>`;
      } else if (this.selectedType === 'enemy') {
        const e = this.selected;
        if (e.dead || !this.game.enemies.includes(e)) { this.hideSelection(); return; }
        const hpPct = clamp(e.hp / e.maxHp * 100, 0, 100);
        this.dom.selType.textContent = (e.def.boss ? 'BOSS / 异常实体' : 'THREAT / 威胁实体') + ' · ' + (e.def.flying ? '飞行' : '地面');
        this.dom.selName.innerHTML = `${e.def.name} <small>${e.def.en || ''}</small>`;
        body.innerHTML = `
          <div class="hp-line"><div class="top"><span>威胁生命</span><b>${Math.ceil(e.hp)} / ${e.maxHp}</b></div><div class="hp-bar"><i class="${hpPct < 35 ? 'bad' : ''}" style="width:${hpPct}%"></i></div></div>
          <div class="stat-grid">
            <div class="stat"><span>移动速度</span><b>${e.def.speed}</b></div>
            <div class="stat"><span>阻挡占用</span><b>${e.def.block || 0}</b></div>
            <div class="stat"><span>护盾</span><b>${Math.ceil(e.shield || 0)}</b></div>
            <div class="stat"><span>出口伤害</span><b>${e.def.integrity || 0}</b></div>
          </div>
          <div class="tag-row">${e.def.tags.map(t => `<span class="tag-pill">${t}</span>`).join('')}
            ${e.revealed ? '<span class="tag-pill" style="color:#7effe8">已显形</span>' : '<span class="tag-pill pink">伪装中</span>'}
            ${e.blockedBy ? '<span class="tag-pill gold">被阻挡</span>' : ''}
            ${e.luredBy ? '<span class="tag-pill pink">被诱捕</span>' : ''}
            ${e.slowUntil > this.game.time ? '<span class="tag-pill">减速</span>' : ''}
            ${e.markedUntil > this.game.time ? '<span class="tag-pill" style="color:#7effe8">被标记</span>' : ''}
          </div>
          <div class="sel-desc">${e.def.desc}</div>
          <div class="sel-actions"><button class="btn ghost wide" data-act="focus">镜头聚焦</button></div>`;
      } else {
        const c = this.selected;
        const hasTower = c.tower;
        const types = { link: '链路 / LINK', old: '旧链路 / LEGACY', switch: '交换节点 / SWITCH', platform: '设备平台 / PLATFORM', entrance: '入口 / GATEWAY', exit: '出口 / CORE', void: '障碍 / VOID', obstacle: '障碍 / OBSTACLE' };
        this.dom.selType.textContent = types[c.type] || '地形 / TERRAIN';
        let name = '链路节点';
        if (c.switch) name = c.switch.name;
        else if (c.type === 'platform') name = '设备平台';
        else if (c.type === 'old') name = '旧协议链路';
        else if (c.type === 'entrance') name = (this.game.mapDef.entrances.find(e => e.cell === c) || {}).name || '入口';
        else if (c.type === 'exit') name = (this.game.mapDef.exits.find(e => e.cell === c) || {}).name || '出口';
        this.dom.selName.innerHTML = `${name} <small>${c.x},${c.y}</small>`;
        let extra = '';
        if (c.type === 'old') extra = '<div class="sel-desc">旧协议链路：经过的地面敌人减速，伪装单位显形。敌人规划路线时会把它视为更慢的通行选择。</div>';
        else if (c.type === 'platform') extra = '<div class="sel-desc">设备平台高于链路，敌人不可通行。可部署拦截器、沙箱与修复进程。远程塔的朝向与覆盖范围是关键取舍。</div>';
        else if (c.type === 'switch') extra = `<div class="sel-desc">${c.switch ? c.switch.note : ''}<br>${c.isolation ? '<span style="color:#ffce6a">当前已隔离：该格不可通行。</span>' : '当前直通。部署网闸或防火墙可隔离节点，改变各入口路线。'}${c.lastReiso > this.game.time ? `<br><span style="color:#ff9c6b">路由收敛中：${Math.ceil(c.lastReiso - this.game.time)} 秒内无法再次隔离。</span>` : ''}</div>`;
        else if (c.walk) extra = '<div class="sel-desc">可通行链路。防火墙与蜜罐可部署在此；它们阻挡敌人，但不截断道路。</div>';
        else extra = '<div class="sel-desc">不可通行且不可部署的区域。</div>';
        if (hasTower) extra += `<div class="sel-desc" style="color:#9dffb4">该位置已部署 ${D.TOWER_DEFS[hasTower.defId].name}，点击选中可查看详情。</div>`;
        body.innerHTML = `<div class="tag-row">${c.walk ? '<span class="tag-pill">可通行</span>' : '<span class="tag-pill" style="color:#ff8fa1">不可通行</span>'}${c.old ? '<span class="tag-pill gold">旧协议</span>' : ''}${c.isolation ? '<span class="tag-pill gold">节点隔离</span>' : ''}${c.tower ? '<span class="tag-pill">已部署</span>' : ''}</div>${extra}`;
      }
    },
    onSelAction(e) {
      const btn = e.target.closest('[data-act]');
      if (!btn || !this.game || !this.selected) return;
      const act = btn.dataset.act;
      if (this.selectedType === 'tower') {
        if (act === 'skill') {
          const r = this.game.useSkill(this.selected);
          if (!r.ok) { this.toast(r.reason, 'bad'); AUDIO.sfx('error'); }
        } else if (act === 'upgrade') {
          const def = this.selected.def;
          const chk = this.game.canUpgrade(this.selected);
          if (!chk.ok) { this.toast(chk.reason, 'bad'); AUDIO.sfx('error'); return; }
          if (def.branches && def.branches.length) {
            $('#branch-title').textContent = def.name + ' · 选择 Lv.2 分支';
            const box = $('#branch-body'); box.innerHTML = '';
            def.branches.forEach(b => {
              const el = document.createElement('div');
              el.className = 'branch-option'; el.dataset.branch = b.id;
              el.innerHTML = `<b>${b.name} <span class="mono" style="font-size:.55rem;color:#8f7a4a">${b.en || ''}</span></b><span>${b.desc}</span>`;
              box.appendChild(el);
            });
            this.dom.branch.classList.add('show');
          } else {
            const r = this.game.upgradeTower(this.selected);
            if (!r.ok) { this.toast(r.reason, 'bad'); AUDIO.sfx('error'); } else this.toast(def.name + ' 已升级至 Lv.2', 'ok');
          }
        } else if (act === 'sell') {
          const r = this.game.sellTower(this.selected);
          if (r.ok) { this.toast('设备已撤下 · 算力 +' + r.refund, 'ok'); this.hideSelection(); }
        }
        this.renderSelection();
        this.updateHUD(true);
      } else if (this.selectedType === 'enemy' && act === 'focus') {
        const e = this.selected;
        if (e && e.view) {
          this.world.flyTo({ x: e.view.position.x, z: e.view.position.z, dist: 46, pitch: 0.82, yaw: this.world.camGoal.yaw });
          this.world.camGoal.follow = e;
        }
      }
    },
    doUpgrade(t, branch) {
      this.dom.branch.classList.remove('show');
      const r = this.game.upgradeTower(t, branch);
      if (!r.ok) { this.toast(r.reason, 'bad'); AUDIO.sfx('error'); return; }
      this.toast(t.def.name + ' 已升级至 Lv.2' + (branch ? ' · ' + t.def.branches.find(b => b.id === branch).name : ''), 'ok');
      this.renderSelection(); this.updateHUD(true);
    },

    /* ---------------- hover ---------------- */
    onCanvasMove(e) {
      if (this.demoMode || this.exportMode) return;
      if (this.placement) {
        if (this.placement.stage === 'facing') this.updateFacing(e.clientX, e.clientY);
        else if (!this.drag) this.updatePlacementFromScreen(e.clientX, e.clientY);
      }
      if (!this.game || this.placement) { this.hideTooltip(); return; }
      const hit = this.world.pickEntity(e.clientX, e.clientY, this.game);
      if (hit && hit.type === 'tower') {
        const d = hit.obj.def;
        this.showMapTooltip(e.clientX, e.clientY, `${d.name} · Lv.${hit.obj.level}`, `${Math.ceil(hit.obj.hp)} / ${hit.obj.maxHp} 生命 · 点击查看`);
        return;
      }
      if (hit && hit.type === 'enemy') {
        const d = hit.obj.def;
        this.showMapTooltip(e.clientX, e.clientY, `${d.name}${hit.obj.revealed ? '' : ' · 伪装'}`, `${Math.ceil(hit.obj.hp)} / ${hit.obj.maxHp} 生命 · 点击查看`);
        return;
      }
      const cell = this.world.pickCell(e.clientX, e.clientY);
      if (cell && cell.switch) {
        const st = cell.isolation ? '已隔离' : (cell.lastReiso > this.game.time ? '路由收敛中' : '直通');
        this.showMapTooltip(e.clientX, e.clientY, cell.switch.name, `${cell.switch.code} · ${st}`);
        return;
      }
      if (cell && cell.type === 'platform') { this.showMapTooltip(e.clientX, e.clientY, '设备平台', '可部署远程与支援塔'); return; }
      if (cell && cell.old) { this.showMapTooltip(e.clientX, e.clientY, '旧链路', '减速 · 显形'); return; }
      this.hideTooltip();
    },
    showMapTooltip(x, y, title, sub) {
      const tip = this.dom.tooltip;
      tip.innerHTML = `<b>${title}</b><div class="k">${sub}</div>`;
      tip.style.display = 'block';
      tip.style.left = clamp(x + 16, 8, innerWidth - 250) + 'px';
      tip.style.top = clamp(y + 16, 8, innerHeight - 80) + 'px';
    },

    /* ---------------- keyboard ---------------- */
    onKey(e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === 'Escape') {
        if (this.dom.confirm.classList.contains('show')) { this.cancelConfirm(); return; }
        if (this.dom.branch.classList.contains('show')) { this.dom.branch.classList.remove('show'); return; }
        if (this.dom.menu.classList.contains('show')) { this.dom.menu.classList.remove('show'); if (this.game) this.game.paused = false; return; }
        if (this.screen === 'codex') { this.closeCodex(); return; }
        if (this.placement) { this.cancelPlacement(); return; }
        if (this.dom.pause.classList.contains('show')) { this.togglePause(false); return; }
        this.hideSelection();
      }
      if (this.screen !== 'battle' || !this.game || this.demoMode) return;
      if (e.key === ' ') { e.preventDefault(); this.togglePause(); }
      if (e.key === 'm' || e.key === 'M') { AUDIO.setMuted(!AUDIO.muted); this.toast(AUDIO.muted ? '已静音' : '声音已开启'); }
      if (e.key === 'c' || e.key === 'C') this.openCodex('battle');
      const towerKeys = ['1', '2', '3', '4', '5', '6'];
      const i = towerKeys.indexOf(e.key);
      if (i >= 0) { this.beginPlacement('tower', D.TOWER_ORDER[i]); this.showHintFor('tower', D.TOWER_ORDER[i]); return; }
      const itemKeys = ['q', 'w', 'e', 'Q', 'W', 'E'];
      const j = itemKeys.indexOf(e.key);
      if (j >= 0) { const id = D.ITEM_ORDER[j % 3]; this.beginPlacement('item', id); this.showHintFor('item', id); }
      if (e.key === '[' || e.key === ']') { const s = clamp((this.game ? this.game.speed : 1) + (e.key === ']' ? 1 : -1), 1, 3); this.setSpeed(s); }
    },

    /* ---------------- HUD ---------------- */
    onGameEvent(type, data) {
      if (type === 'log') this.appendLog(data.text, data.cls, true);
      else if (type === 'victory' || type === 'defeat') this.scheduleResult();
      else if (type === 'waveStart') { this.toast('第 ' + (data.index + 1) + ' 波来袭', 'warn'); AUDIO.sfx('wave'); }
      else if (type === 'routeChange') {
        const names = data.changed.map(id => id).join(' / ');
        this.toast('路由收敛 · ' + names + ' 改道', '');
        this.addLogicalLog('路由收敛：' + data.changed.join(' / ') + ' 的路线已更新', 'route');
      } else if (type === 'newThreat') {
        if (!this.demoMode && !(global.DEMO && DEMO.exporting)) this.toast('【新威胁】' + data.def.name + ' · ' + (data.def.tags || []).slice(0, 2).join(' / '), 'warn');
      } else if (type === 'bossSpawn') {
        this.toast('【BOSS】' + data.enemy.def.name + ' 已现身', 'bad');
      } else if (type === 'towerDestroyed') {
        this.toast(D.TOWER_DEFS[data.tower.defId].name + ' 被摧毁', 'bad');
      } else if (type === 'isolation' || type === 'isolationEnd') {
        this.updateHUD(true);
      } else if (type === 'leak') {
        document.getElementById('vignette').style.background = 'radial-gradient(ellipse at 50% 45%, rgba(255,40,60,.12), rgba(255,20,40,.22) 70%, rgba(0,2,4,.9) 100%)';
        setTimeout(() => { document.getElementById('vignette').style.background = ''; }, 260);
      } else if (type === 'encrypted') {
        this.toast(D.TOWER_DEFS[data.tower.defId].name + ' 被加密，攻击暂停', 'warn');
      } else if (type === 'revealed') {
        this.toast(data.enemy.def.name + ' 已显形', '');
      } else if (type === 'bossSkill') {
        this.toast('BOSS 技能 · ' + data.name, 'bad');
      }
      if (this.selectedType === 'tower' || this.selectedType === 'enemy') this.renderSelection();
      this.updateHUD(true);
    },
    addLogicalLog(text, cls) {
      if (!this.game) return;
      this.game.logs.push({ t: this.game.time, text, cls: cls || '' });
      this.appendLog(text, cls || '', true);
    },
    appendLog(text, cls, force) {
      const panel = this.dom.logPanel;
      const line = document.createElement('div');
      line.className = 'log-line ' + (cls || '');
      const t = this.game ? this.game.time : 0;
      line.innerHTML = `<span class="ts">[${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}]</span>${this.escape(text)}`;
      panel.appendChild(line);
      while (panel.children.length > 9) panel.removeChild(panel.firstChild);
    },
    escape(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); },
    toast(text, cls) {
      while (this.dom.toasts.children.length >= 2) this.dom.toasts.firstChild.remove();
      const el = document.createElement('div');
      el.className = 'toast ' + (cls || '');
      el.textContent = text;
      this.dom.toasts.appendChild(el);
      setTimeout(() => el.classList.add('out'), 2200);
      setTimeout(() => el.remove(), 2600);
    },
    flashRes(kind) {
      const el = kind === 'compute' ? $('#res-compute') : $('#res-intel');
      if (!el) return;
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    },
    scheduleResult() {
      if (this.resultTimer) clearTimeout(this.resultTimer);
      this.resultTimer = setTimeout(() => this.showResult(), 1100);
    },
    showResult() {
      if (!this.game) return;
      const r = this.game.results();
      this.lastResult = r;
      const report = this.dom.report;
      report.classList.toggle('bad', !r.victory);
      $('#result-title').textContent = r.victory ? '防线守住了' : '中枢失守';
      $('#result-title').classList.toggle('bad', !r.victory);
      $('#result-map').textContent = '汐域 · ' + r.map + ' · ' + (r.victory ? '任务完成' : '事件升级');
      const stamp = $('#result-stamp');
      stamp.textContent = r.victory ? 'MISSION CLEAR' : 'DOMAIN LOST';
      stamp.classList.toggle('bad', !r.victory);
      const stats = [
        ['完成波次', r.waveReached + ' <small>/ ' + r.waves + '</small>'],
        ['清除威胁', r.kills + ''],
        ['中枢完整度', r.integrity + '<small>%</small>'],
        ['设备损失', r.towersLost + ''],
        ['交战时长', this.fmtTime(r.duration)],
        ['路由改写', r.reroutes + ''],
        ['算力回收', r.computeEarned + ''],
        ['情报获取', r.intelEarned + ''],
        ['BOSS 清除', r.bossKills + '']
      ];
      this.dom.reportStats.innerHTML = stats.map(s => `<div class="report-stat"><div class="k">${s[0]}</div><div class="v">${s[1]}</div></div>`).join('');
      const grade = r.victory ? (r.integrity >= 85 ? 'S' : r.integrity >= 65 ? 'A' : r.integrity >= 40 ? 'B' : 'C') : 'D';
      $('#report-grade').textContent = grade;
      let note = '';
      if (r.victory) {
        note = r.integrity >= 85 ? '路由收敛稳定，防线几乎没有出现结构性缺口。每一次改道都被用于放大交叉火力，而不是单纯拖延。' :
          r.integrity >= 65 ? '中枢保持完整。局部曾被突破，但节点隔离与支援及时补位，入侵流量未形成持续走廊。' :
            '防线在高压下维持住了。中枢受损明显，修复进程与隔离点的取舍将决定下一次交战的余量。';
      } else {
        note = '入侵绕过或击穿了防线。复盘入口的路线收益与节点耐久，重新分配算力与情报：单一防线无法覆盖所有改道路径。';
      }
      $('#report-note').textContent = note;
      this.dom.result.classList.add('active');
      this.setScreen('result');
      if (global.AUDIO) AUDIO.sfx(r.victory ? 'upgrade' : 'defeat');
      if (this.world && this.game) this.game.paused = true;
    },
    fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); },

    updateHUD(force) {
      if (this.screen !== 'battle' || !this.game) return;
      const g = this.game;
      const integrity = clamp(g.integrity, 0, 100);
      this.dom.integrity.textContent = Math.round(integrity);
      this.dom.integrity.classList.toggle('low', integrity < 35);
      this.dom.integrityBar.style.width = integrity + '%';
      this.dom.integrityBar.classList.toggle('low', integrity < 35);
      this.dom.integrityState.textContent = integrity > 70 ? '稳定' : integrity > 35 ? '受损' : integrity > 0 ? '危急' : '失守';
      this.dom.leaks.textContent = g.stats.leaks;
      this.dom.compute.textContent = Math.floor(g.compute);
      this.dom.intel.textContent = Math.floor(g.intel);
      const nextNo = g.waveState === 'prep' ? Math.min(g.waveIndex + 2, g.waves.length) : Math.min(g.waveIndex + 1, g.waves.length);
      this.dom.waveNow.textContent = String(Math.max(1, nextNo)).padStart(2, '0');
      this.dom.waveMax.textContent = String(g.waves.length).padStart(2, '0');
      this.dom.waveNote.textContent = g.waveState === 'prep' ? (g.nextWaveDef() ? g.nextWaveDef().note : '') : (g.waveNote || '交战中');
      this.dom.skipWave.style.display = g.waveState === 'prep' ? 'inline' : 'none';
      if (g.waveState === 'prep') {
        this.dom.waveTimer.innerHTML = `<span>下一波 <b>${Math.max(0, g.prepTimer).toFixed(1)}</b>s</span><button id="btn-skip-wave">提前接敌</button>`;
        const b = $('#btn-skip-wave'); if (b) b.onclick = () => g.skipPrep();
      } else if (g.waveState === 'active') {
        const left = g.enemies.filter(e => !e.dead).length;
        this.dom.waveTimer.innerHTML = `<span>交战中 · 场上威胁 <b>${left}</b></span>`;
      } else {
        this.dom.waveTimer.innerHTML = `<span>正在结算波次…</span>`;
      }
      // forecast
      this.renderForecast();
      // boss
      const boss = g.enemies.find(e => e.def.boss && !e.dead);
      if (boss) {
        this.dom.bossBanner.classList.add('show');
        this.dom.bossName.textContent = boss.def.name;
        this.dom.bossEn.textContent = boss.def.en || '';
        this.dom.bossHp.style.width = clamp(boss.hp / boss.maxHp * 100, 0, 100) + '%';
        this.dom.bossPhase.textContent = 'PHASE ' + ['I', 'II', 'III'][Math.min(2, boss.phaseCount)] + (boss.revealed ? '' : ' · 潜伏');
      } else this.dom.bossBanner.classList.remove('show');
      // cards
      D.TOWER_ORDER.forEach(id => {
        const def = D.TOWER_DEFS[id];
        const el = this.cardMap[id];
        if (!el) return;
        const cost = g.towerCost(id, { type: 'link', x: 0, y: 0 });
        const afford = g.compute >= cost.compute && g.intel >= cost.intel;
        el.classList.toggle('unaffordable', !afford);
      });
      D.ITEM_ORDER.forEach(id => {
        const el = this.itemMap[id];
        if (!el) return;
        const def = D.ITEM_DEFS[id];
        const cd = (g.itemCooldowns[id] || 0) - g.time;
        el.classList.toggle('cooling', cd > 0.1);
        const mask = el.querySelector('.cd-mask');
        if (mask) mask.textContent = cd > 0.1 ? Math.ceil(cd) + 's' : '';
        const afford = g.compute >= def.cost.compute && g.intel >= def.cost.intel;
        el.classList.toggle('unaffordable', !afford);
      });
      if (force) { this.renderSelection(); this.renderRouteLegend(); this.renderEntChips(); }
      this.updateSpeedButtons();
    },
    renderForecast() {
      const g = this.game;
      const wave = g.waveState === 'prep' ? g.nextWaveDef() : g.waves[Math.min(g.waveIndex, g.waves.length - 1)];
      const next = g.waveState === 'prep' ? g.waves[g.waveIndex + 2] : g.nextWaveDef();
      this.dom.forecastWave.textContent = 'WAVE ' + String(Math.min(g.waves.length, (g.waveState === 'prep' ? g.waveIndex + 2 : g.waveIndex + 1))).padStart(2, '0');
      const box = this.dom.threatList; box.innerHTML = '';
      const renderWave = (w, isNext) => {
        if (!w) return;
        const byEnt = {};
        w.groups.forEach(gr => {
          byEnt[gr.ent] = byEnt[gr.ent] || {};
          byEnt[gr.ent][gr.e] = (byEnt[gr.ent][gr.e] || 0) + gr.n;
        });
        if (w.boss) {
          const ent = w.bossEnt || g.mapDef.entrances[0].id;
          byEnt[ent] = byEnt[ent] || {};
          byEnt[ent][w.boss] = 1;
        }
        Object.keys(byEnt).sort().forEach(entId => {
          const ent = g.mapDef.entrances.find(e => e.id === entId);
          const row = document.createElement('div'); row.className = 'threat-row' + (isNext ? ' next' : '');
          let chips = Object.keys(byEnt[entId]).map(t => {
            const def = D.ENEMY_DEFS[t];
            const c = ENEMY_DOT[t] || '#ff6b6b';
            return `<span class="threat-chip"><span class="dot" style="background:${c};box-shadow:0 0 6px ${c}"></span>${def ? def.name : t}×${byEnt[entId][t]}</span>`;
          }).join('');
          row.innerHTML = `<span class="ent" style="color:${ent ? ent.color : '#fff'}">${entId}</span><span class="chips">${chips}</span>`;
          box.appendChild(row);
        });
      };
      if (g.waveState === 'prep') {
        const label = document.createElement('div'); label.style.cssText = 'font-family:var(--mono);font-size:.54rem;letter-spacing:.12em;color:#617f8a;margin-bottom:.1rem';
        label.textContent = 'NEXT / 下一波'; box.appendChild(label);
        renderWave(wave, false);
        if (next) {
          const l2 = document.createElement('div'); l2.style.cssText = 'font-family:var(--mono);font-size:.54rem;letter-spacing:.12em;color:#4e6a75;margin:.35rem 0 .1rem';
          l2.textContent = 'LATER / 后续'; box.appendChild(l2);
          renderWave(next, true);
        }
      } else {
        renderWave(wave, false);
      }
    },
    renderRouteLegend() {
      if (!this.game) return;
      const box = this.dom.routeRows; box.innerHTML = '';
      this.game.mapDef.entrances.forEach(e => {
        const route = this.game.map.routes[e.id];
        const exit = this.game.mapDef.exits.find(x => x.id === (route && route.exitId));
        const row = document.createElement('div'); row.className = 'legend-row';
        row.innerHTML = `<span class="legend-line" style="background:${e.color};color:${e.color}"></span><span class="id" style="color:${e.color}">${e.id}</span><span class="name">${e.name}</span><span class="exit">→ ${exit ? exit.id : '—'}</span>`;
        box.appendChild(row);
      });
    },
    renderEntChips() {
      if (!this.game) return;
      const box = this.dom.entChips; box.innerHTML = '';
      this.game.mapDef.entrances.forEach(e => {
        const chip = document.createElement('div'); chip.className = 'ent-chip';
        chip.innerHTML = `<span class="dot" style="background:${e.color};box-shadow:0 0 8px ${e.color}"></span>${e.id} · ${e.name}`;
        box.appendChild(chip);
      });
    },

    /* ---------------- codex ---------------- */
    openCodex(returnTo) {
      this.codexReturn = returnTo || 'title';
      this.codexTab = this.codexTab || 'towers';
      this.setScreen('codex');
      $$('.codex-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === this.codexTab));
      this.renderCodex(this.codexTab);
      if (this.game && returnTo !== 'title') this.game.paused = true;
      AUDIO.sfx('ui');
    },
    closeCodex() {
      this.setScreen(this.codexReturn === 'pause' || this.codexReturn === 'menu' ? 'battle' : this.codexReturn);
      if (this.codexReturn === 'pause') this.dom.pause.classList.add('show');
      if (this.codexReturn === 'menu') this.dom.menu.classList.add('show');
      if (this.codexReturn === 'result') this.dom.result.classList.add('active');
      if (this.codexReturn === 'title') this.startAttract('segment');
      if (this.game && this.codexReturn === 'battle') this.game.paused = false;
    },
    renderCodex(tab) {
      this.codexTab = tab;
      const body = $('#codex-body'); body.innerHTML = '';
      const grid = document.createElement('div'); grid.className = 'codex-grid'; body.appendChild(grid);
      if (tab === 'towers') {
        D.TOWER_ORDER.forEach(id => {
          const def = D.TOWER_DEFS[id];
          const el = document.createElement('div'); el.className = 'codex-entry';
          el.style.color = def.color;
          el.innerHTML = `<div class="icon">${ICONS[def.icon] || ''}</div>
            <div><h4>${def.name}<span>${def.en} · ${def.role}</span></h4>
            <div class="tags">${def.tags.map(t => `<span class="tag-pill">${t}</span>`).join('')}</div>
            <p>${def.desc}</p>
            <div class="stats"><span>生命 <b>${def.levels[0].hp} → ${def.levels[1].hp}</b></span><span>算力 <b>${def.cost.compute}</b></span>${def.cost.intel ? `<span>情报 <b>${def.cost.intel}</b></span>` : ''}</div>
            ${def.branches ? `<div class="codex-branches">${def.branches.map(b => `<div class="codex-branch"><b>${b.name} · ${b.en}</b>${b.desc}</div>`).join('')}</div>` : ''}
            <div class="stats" style="color:#b39be0"><span>主动技能 <b>${D.SKILLS[def.skill].name}</b> · ${D.SKILLS[def.skill].desc}</span></div></div>`;
          grid.appendChild(el);
        });
      } else if (tab === 'enemies') {
        Object.values(D.ENEMY_DEFS).forEach(def => {
          const el = document.createElement('div'); el.className = 'codex-entry';
          el.innerHTML = `<div class="icon" style="color:${ENEMY_DOT[def.id] || '#ff6b6b'}"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 6 40 15v18L24 42 8 33V15Z"/><path d="M16 22h6M26 22h6M18 31c4 3 8 3 12 0" stroke-width="1.8"/><circle cx="24" cy="17" r="2.2" fill="currentColor"/></svg></div>
            <div><h4>${def.name}<span>${def.en || ''}${def.boss ? ' · BOSS' : ''}</span></h4>
            <div class="tags">${def.tags.map(t => `<span class="tag-pill">${t}</span>`).join('')}</div>
            <p>${def.desc}</p>
            <div class="stats"><span>生命 <b>${def.hp}</b></span><span>速度 <b>${def.speed}</b></span><span>阻挡 <b>${def.block || '—'}</b></span><span>中枢伤害 <b>${def.integrity || 0}</b></span></div>
            ${def.boss ? `<div class="stats" style="color:#ff9aab"><span>阶段阈值 <b>${(def.phases || []).map(x => Math.round(x * 100) + '%').join(' / ')}</b></span></div>` : ''}</div>`;
          grid.appendChild(el);
        });
      } else if (tab === 'items') {
        D.ITEM_ORDER.forEach(id => {
          const def = D.ITEM_DEFS[id];
          const el = document.createElement('div'); el.className = 'codex-entry'; el.style.color = def.color;
          el.innerHTML = `<div class="icon">${ICONS[def.icon] || ''}</div>
            <div><h4>${def.name}<span>${def.en}</span></h4>
            <div class="tags">${def.tags.map(t => `<span class="tag-pill">${t}</span>`).join('')}</div>
            <p>${def.desc}</p>
            <div class="stats"><span>消耗 <b>${def.cost.intel ? def.cost.intel + ' 情报' : def.cost.compute + ' 算力'}</b></span><span>冷却 <b>${def.cd}s</b></span><span>目标 <b>${def.target === 'switch' ? '交换节点' : def.target === 'area' ? '链路区域' : '守方设备'}</b></span></div></div>`;
          grid.appendChild(el);
        });
        const skills = document.createElement('div'); skills.className = 'codex-grid'; skills.style.marginTop = '.7rem';
        Object.keys(D.SKILLS).forEach(k => {
          const s = D.SKILLS[k];
          const el = document.createElement('div'); el.className = 'codex-entry'; el.style.color = s.color;
          el.innerHTML = `<div class="icon">${ICONS.skill || ICONS.repair}</div><div><h4>${s.name}<span>ACTIVE SKILL</span></h4><p>${s.desc}</p><div class="stats"><span>冷却 <b>${s.cd}s</b></span><span>持续 <b>${s.dur}s</b></span></div></div>`;
          skills.appendChild(el);
        });
        body.appendChild(skills);
      } else {
        D.CODEX.system.forEach(s => {
          const el = document.createElement('div'); el.className = 'codex-entry system';
          el.innerHTML = `<div class="title-row"><span class="swatch" style="background:${s.color};box-shadow:0 0 10px ${s.color}"></span><h4 style="margin:0">${s.name}</h4></div><p>${s.desc}</p>`;
          grid.appendChild(el);
        });
        const controls = document.createElement('div'); controls.className = 'codex-entry system';
        controls.innerHTML = `<div class="title-row"><span class="swatch" style="background:#56e8d8"></span><h4 style="margin:0">操作与镜头</h4></div><p>中键拖动环绕视角；Shift + 中键平移；滚轮缩放；左键用于选择与拖放部署。空格暂停 / 继续，1–6 选择设备，Q / W / E 选择道具，Esc 取消操作。所有战斗都在 1×/2×/3× 速度下统一推进；暂停时战斗完全静止。</p>`;
        grid.appendChild(controls);
        const connectivity = document.createElement('div'); connectivity.className = 'codex-entry system';
        connectivity.innerHTML = `<div class="title-row"><span class="swatch" style="background:#ffcf6e"></span><h4 style="margin:0">隔离与连通</h4></div><p>隔离一个交换节点会截断该格。系统在确认任何会封死入口或场上地面敌人的操作前拒绝执行，且不消耗资源。节点恢复直通后有 12 秒的路由收敛间隔；隔离消耗情报，撤下设备仅返还算力。</p>`;
        grid.appendChild(connectivity);
      }
    },

    /* ---------------- demo support ---------------- */
    setDemo(on, title) {
      this.demoMode = !!on;
      this.dom.demoLayer.classList.toggle('show', !!on);
      this.dom.buildHint.classList.toggle('hidden', !!on);
      if (title) this.dom.demoTitle.textContent = title;
      if (on) { this.hideSelection(); this.clearPlacement(); }
      this.dom.demoCursor.classList.toggle('show', !!on);
    },
    setSubtitle(text) { this.dom.subtitle.textContent = text || ''; this.dom.subtitle.style.opacity = text ? 1 : 0; },
    setDemoProgress(t, dur) { this.dom.demoProgress.textContent = this.fmtTime(t) + ' / ' + this.fmtTime(dur); },
    setCursor(x, y, click) {
      const c = this.dom.demoCursor;
      c.style.left = x + 'px'; c.style.top = y + 'px';
      c.classList.add('show');
      if (click) { c.classList.remove('click'); void c.offsetWidth; c.classList.add('click'); }
    },
    getCardCenter(id) {
      const el = this.cardMap[id] || this.itemMap[id];
      if (!el) return { x: innerWidth / 2, y: innerHeight - 80 };
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    getClientPos(cell, h) {
      if (!this.world) return { x: innerWidth / 2, y: innerHeight / 2 };
      const p = this.world.cellCenter(cell, h == null ? 1.5 : h);
      const s = this.world.toScreen(p);
      return s || { x: innerWidth / 2, y: innerHeight / 2 };
    },
    setScale() {
      const s = Math.min(1.7, Math.max(1.0, innerWidth / 1920));
      document.documentElement.style.fontSize = (17.5 * s) + 'px';
    },

    /* ---------------- frame ---------------- */
    tick(dt) {
      if (this.demoMode && this.demoStartTime != null) {
        // demo.js drives time/progress
      }
      this.hudT += dt;
      if (this.screen === 'battle' && this.game) {
        if (this.game.over) { this.updateHUD(); }
        else if (this.hudT > 0.12) { this.hudT = 0; this.updateHUD(); }
        if (this.selectedType === 'enemy' && this.selected && this.selected.view && this.world.selRing) {
          this.world.selectRing('enemy', this.selected.view.position.clone(), 0xff8fa1);
        }
        // selection panel refresh (HP and encryption)
        if (this.selected && this.selectedType !== 'cell' && this.hudT === 0) this.renderSelection();
      }
      if (this.attract) {
        this.attractT += dt;
        this.world.camGoal.yaw += dt * 0.018;
      }
      const autoCam = $('#toggle-autocam');
      if (this.game && autoCam && autoCam.classList.contains('on') && this.screen === 'battle' && !this.game.paused) {
        // subtle motion of target toward active battle
        const es = this.game.enemies;
        if (es.length && this.game.time - (this._lastFocus || 0) > 4) {
          const e = es[Math.floor(es.length / 2)];
          this._lastFocus = this.game.time;
          this.world.camGoal.target.x += (e.wx - this.world.camGoal.target.x) * 0.2;
          this.world.camGoal.target.z += (e.wz - this.world.camGoal.target.z) * 0.2;
        }
      }
      // cooldown mask update at 10fps
      if (this.screen === 'battle' && this.game && this.hudT === 0) {
        D.ITEM_ORDER.forEach(id => {
          const el = this.itemMap[id]; if (!el) return;
          const cd = (this.game.itemCooldowns[id] || 0) - this.game.time;
          el.classList.toggle('cooling', cd > 0.1);
          const m = el.querySelector('.cd-mask'); if (m) m.textContent = cd > 0.1 ? Math.ceil(cd) + 's' : '';
        });
      }
    },
    updateCursor() {
      const canvas = this.world && this.world.canvas;
      if (!canvas) return;
      canvas.style.cursor = this.placement ? 'crosshair' : (this.screen === 'battle' ? 'default' : 'default');
    }
  };

  global.UI = UI;
})(window);
