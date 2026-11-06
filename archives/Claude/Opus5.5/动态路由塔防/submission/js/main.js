// 程序入口：应用状态机与主循环
(function () {
  const TD = window.TD;

  const App = TD.App = {
    view: null, ui: null, game: null, state: 'boot', speed: 1, paused: false, modalPause: false, demo: false, reportT: -1, menuT: 0, mapId: null, nav: 0, exporting: false, onExportFrame: null,

    init() {
      if (this.view) return;
      const scale = () => {
        // 视频导出不封顶：4K 画面里的界面比例和 1080p 一致
        const k = Math.max(0.9, Math.min(this.exporting ? Infinity : 1.5, Math.min(innerWidth / 1600, innerHeight / 900)));
        document.documentElement.style.fontSize = (16 * k) + 'px';
      };
      scale();
      this.applyUIScale = scale;
      window.addEventListener('resize', () => {
        scale();
        if (this.game && this.ui) { this.view.insets = this.ui.computeInsets(); this.view.fitDefault(!this.view.atDefault(), !this.view.atDefault()); }
      });
      this.view = new TD.View(document.getElementById('gl'), document.getElementById('overlay'), 'high');
      TD.buildThumbs();
      this.ui = new TD.UI(this);
      const boot = document.getElementById('boot');
      if (boot) boot.remove();
      this.ui.applyThumbs();
      TD.view = this.view;
      this.toMenu(true);
      this.last = performance.now();
      requestAnimationFrame((n) => this.loop(n));
    },

    toMenu() {
      if (this.game) this.endGame();
      this.state = 'menu';
      this.view.insets = { l: 0, r: 0, t: 0, b: 0 };
      this.view.setWorld(this.menuMap || 'backbone');
      this.view.unbind();
      this.view.fitDefault(false);
      this.view.rig.tDist *= 0.86; this.view.rig.dist *= 0.86;
      this.ui.showScreen('title');
      TD.Audio.setScene('menu');
    },

    toLevels() {
      if (this.game) this.endGame();
      this.state = 'menu';
      this.view.insets = { l: 0, r: 0, t: 0, b: 0 };
      this.view.unbind();
      this.view.fitDefault(false);
      this.ui.showScreen('levels');
      this.ui.drawLevelCanvases();
      TD.Audio.setScene('menu');
    },

    endGame() {
      this.game = null;
      this.demo = false;
      this.paused = false;
      this.modalPause = false;
      this.reportT = -1;
      this.ui.cancelInteraction();
      this.ui.select(null);
    },

    startMap(id, opts) {
      opts = opts || {};
      const ui = this.ui;
      if (document.getElementById('modal').classList.contains('show')) ui.closeModal();
      this.reportT = -1;
      ui.fade(true, opts.demo ? '载入实战演示…' : `正在接入 ${TD.MAPS[id].name}…`);
      const nav = ++this.nav;
      setTimeout(() => {
        if (nav !== this.nav) return;
        const game = this.enterMap(id, opts);
        setTimeout(() => { if (nav === this.nav) ui.fade(false); }, 120);
        if (!opts.demo) {
          ui.banner(TD.MAPS[id].name, TD.MAPS[id].doctrine, '#BFE6D4', 4.2);
          ui.startGuide(game);
        }
      }, 300);
    },

    // 同步进入一张地图：不带过场，视频导出直接从这里回到起始局面
    enterMap(id, opts) {
      const ui = this.ui;
      if (this.game) this.endGame();
      this.mapId = id;
      this.menuMap = id;
      this.view.setWorld(id);
      const game = new TD.Game(id, { seed: opts.seed != null ? opts.seed : (Date.now() % 100000) + 1, demo: !!opts.demo });
      this.game = game;
      TD.game = game;
      this.speed = 1;
      this.paused = false;
      this.reportT = -1;
      this.demo = !!opts.demo;
      this.state = 'battle';
      this.view.theta0 = 0;
      this.view.bind(game);
      this.view.showLabels = true;
      ui.enterBattle(game);
      if (opts.setup) opts.setup(game);
      TD.Audio.setScene(id);
      return game;
    },

    pumpEvents() {
      const g = this.game;
      if (!g) return;
      const evs = g.events;
      if (evs.length) {
        g.events = [];
        for (const ev of evs) {
          this.view.onEvent(ev);
          TD.Audio.onEvent(ev);
          this.ui.onEvent(ev);
        }
      }
    },

    restart() {
      if (this.mapId) this.startMap(this.mapId);
    },

    togglePause() { if (this.game && !this.game.over) this.paused = !this.paused; },
    setSpeed(s) { this.speed = s; this.paused = false; },

    scheduleReport() { this.reportT = 2.2; },

    loadBest() { try { return JSON.parse(localStorage.getItem('td_best') || '{}'); } catch (e) { return {}; } },
    saveBest(id, grade, integrity) {
      const b = this.loadBest();
      const rank = { S: 4, A: 3, B: 2, C: 1 };
      if (!b[id] || rank[grade] >= rank[b[id].grade]) b[id] = { grade, integrity };
      try { localStorage.setItem('td_best', JSON.stringify(b)); } catch (e) { /* 忽略 */ }
    },

    loop(now) {
      if (this.exporting) {
        // 视频导出接管了时间：主循环只保留心跳，不推进任何东西
        this.last = now;
        if (this.onExportFrame) this.onExportFrame();
        requestAnimationFrame((n) => this.loop(n));
        return;
      }
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1;
      let simDt = 0;
      const g = this.game;
      if (g && !this.paused && !this.modalPause) simDt = dt * this.speed;
      if (g && !g.over) g.update(simDt);
      this.pumpEvents();
      if (this.reportT > 0) {
        this.reportT -= dt;
        if (this.reportT <= 0) this.ui.showReport();
      }
      if (TD.Demo) TD.Demo.update(dt);
      if (this.state === 'menu') this.view.rig.tTheta += dt * 0.035;
      this.view.frame(dt, simDt, this.speed);
      this.ui.update(dt);
      requestAnimationFrame((n) => this.loop(n));
    },
  };

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => App.init());
  else App.init();
})();
