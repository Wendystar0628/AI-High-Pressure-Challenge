// 界面层：Daemon OS 风格的菜单、战斗面板与部署交互。交互入口都接受屏幕坐标，实战演示也走同一套逻辑。
(function (root) {
  const TD = root.TD = root.TD || {};
  const THREE = root.THREE;
  const TT = TD.TT;
  const $ = (id) => document.getElementById(id);
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };

  // 界面定时器统一走这里：平时就是 setTimeout，视频导出时由虚拟时钟驱动
  const Clock = TD.Clock = {
    virtual: false, now: 0, seq: 0, queue: [],
    start() { this.virtual = true; this.now = 0; this.queue = []; },
    stop() { this.virtual = false; this.queue = []; },
    setTimeout(fn, ms) {
      if (!this.virtual) return window.setTimeout(fn, ms);
      this.queue.push({ id: ++this.seq, at: this.now + (ms || 0), fn });
      return this.seq;
    },
    advance(t) {
      this.now = t;
      const due = this.queue.filter((q) => q.at <= t).sort((a, b) => a.at - b.at || a.id - b.id);
      if (!due.length) return;
      this.queue = this.queue.filter((q) => q.at > t);
      for (const q of due) q.fn();
    },
  };
  const setTimeout = (fn, ms) => Clock.setTimeout(fn, ms);

  const ICON = {
    compute: '<svg class="ic" viewBox="0 0 24 24"><path d="M7 3h2v3h2V3h2v3h2V3h2v3h1a2 2 0 0 1 2 2v1h2v2h-2v2h2v2h-2v2h2v2h-2v1a2 2 0 0 1-2 2h-1v2h-2v-2h-2v2h-2v-2H9v2H7v-2H6a2 2 0 0 1-2-2v-1H2v-2h2v-2H2v-2h2V9H2V7h2V8a2 2 0 0 1 2-2h1V3zm1 6v7h8V9H8zm2 2h4v3h-4v-3z"/></svg>',
    intel: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5c5 0 9 4 11 7-2 3-6 7-11 7S3 15 1 12c2-3 6-7 11-7zm0 2.6A4.4 4.4 0 1 0 12 16.4 4.4 4.4 0 0 0 12 7.600zm0 2a2.400 2.400 0 1 1 0 4.800 2.400 2.400 0 0 1 0-4.800z"/></svg>',
    core: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 2l8.700 5v10L12 22l-8.700-5V7L12 2zm0 2.300L5.300 8.200v7.600L12 19.700l6.700-3.900V8.200L12 4.300zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/></svg>',
    wave: '<svg class="ic" viewBox="0 0 24 24"><path d="M2 8c3 0 3-3 6-3s3 3 6 3 3-3 6-3 2 1 2 1v3s-1-1-2-1c-3 0-3 3-6 3S11 8 8 8s-3 3-6 3V8zm0 7c3 0 3-3 6-3s3 3 6 3 3-3 6-3 2 1 2 1v3s-1-1-2-1c-3 0-3 3-6 3s-3-3-6-3-3 3-6 3v-3z"/></svg>',
    pause: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    play: '<svg class="ic" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
    home: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 4h6v2H5v4H3V4zm12 0h6v6h-2V6h-4V4zM3 14h2v4h4v2H3v-6zm16 0h2v6h-6v-2h4v-4zM12 8l4 4-4 4-4-4 4-4z"/></svg>',
    book: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 3h13a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V3zm3 14a1 1 0 0 0 0 2h11v-2H7zM7 7v2h9V7H7zm0 4v2h6v-2H7z"/></svg>',
    sound: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4V9zm12 .2a4 4 0 0 1 0 5.600l-1.400-1.400a2 2 0 0 0 0-2.800L16 9.200zm2.800-2.800a8 8 0 0 1 0 11.200l-1.400-1.400a6 6 0 0 0 0-8.400l1.400-1.400z"/></svg>',
    mute: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4V9zm12.400.6L18.500 11.700l2.100-2.100L22 11l-2.100 2.100L22 15.200l-1.400 1.400-2.100-2.100-2.100 2.100-1.400-1.400 2.100-2.100L15 11l1.400-1.400z"/></svg>',
    menu: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 5h18v2.500H3zM3 10.800h18v2.500H3zM3 16.500h18V19H3z"/></svg>',
    downgrade: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 12h36M6 36h36" /><path d="M24 8v28" /><path d="M14 26l10 10 10-10" /><path d="M9 20h6M33 20h6" stroke-dasharray="3 3"/></svg>',
    backup: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3"><path d="M10 24a14 14 0 1 1 4 10" /><path d="M6 22l4 6 6-4" /><path d="M24 15v10l7 4" /></svg>',
  };
  TD.ICON = ICON;

  const fmtT = (s) => { const m = Math.floor(s / 60); const r = Math.floor(s % 60); return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; };
  const entName = (g, id) => { const e = g.map.entrances.find(x => x.id === id); return e ? e.name : id; };
  const exName = (g, id) => { const e = g.map.exits.find(x => x.id === id); return e ? e.name : '无'; };

  class UI {
    constructor(app) {
      this.app = app;
      this.root = $('ui');
      this.drag = null;
      this.pending = null;
      this.sel = null;
      this.logCount = 0;
      this.inspT = 0;
      this.cards = {};
      this.lastVals = {};
      this.build();
      this.bindGlobal();
    }

    get game() { return this.app.game; }
    get view() { return this.app.view; }

    build() {
      this.root.innerHTML = `
      <div id="screen-title" class="screen"></div>
      <div id="screen-levels" class="screen"></div>
      <div id="hud">
        <div id="topbar">
          <div id="brand" class="panel"><div class="t" id="b-map"></div><div class="s" id="b-sub"></div></div>
          <div class="stat compute panel" id="s-compute" data-tip="compute"><span class="ico">${ICON.compute}</span><div><div class="lb">算力 <span id="v-crate" class="mono"></span></div><div class="val" id="v-compute">0</div></div></div>
          <div class="stat intel panel" id="s-intel" data-tip="intel"><span class="ico">${ICON.intel}</span><div><div class="lb">情报 <span id="v-irate" class="mono"></span></div><div class="val" id="v-intel">0</div></div></div>
          <div class="stat panel" id="integrity" data-tip="integrity"><span class="ico" style="color:#86D9A8">${ICON.core}</span><div><div class="lb">中枢完整度 <span class="val mono" id="v-int" style="font-size:1rem">20</span></div><div class="bar"><i id="b-int" style="width:100%"></i></div></div></div>
          <div class="stat panel" id="waveinfo" data-tip="wave"><span class="ico" style="color:#EE9A78">${ICON.wave}</span><div><div class="lb" id="v-wlabel">波次</div><div class="val" id="v-wave">0/14</div></div></div>
          <div id="topctl">
            <button class="btn icon" id="b-pause" title="暂停 / 继续（空格）">${ICON.pause}</button>
            <div class="seg" title="游戏速度（F 切换）">
              <button class="btn" data-sp="1">1×</button><button class="btn" data-sp="2">2×</button><button class="btn" data-sp="3">3×</button>
            </div>
            <button class="btn icon" id="b-home" title="回到默认视角（H）">${ICON.home}</button>
            <button class="btn icon" id="b-book" title="图鉴（B）">${ICON.book}</button>
            <button class="btn icon" id="b-mute" title="静音（M）">${ICON.sound}</button>
            <button class="btn icon" id="b-menu" title="菜单（Esc）">${ICON.menu}</button>
          </div>
        </div>
        <div id="leftcol">
          <div id="forecast" class="panel"><div class="wintitle"><span class="led" id="fc-led"></span><b>流量预报</b><span class="path">/sys/forecast</span></div><div class="wavepips" id="wavepips"></div><div class="body" id="fc-body"></div></div>
          <div id="routetable" class="panel"><div class="wintitle"><span class="led"></span><b>当前路由表</b><span class="path">/net/rib</span></div><div id="rt-body" style="padding:.2rem 0"></div></div>
          <div id="syslog" class="panel"><div class="wintitle"><span class="led" id="log-led"></span><b>系统日志</b><span class="path">/var/log/daemon</span></div><div class="lines" id="log-lines"></div></div>
        </div>
        <div id="dock"></div>
        <div id="inspector" class="panel hide"></div>
        <div id="routepanel" class="panel hide"></div>
        <div id="bossbar" class="hide"><div class="bn"><span id="boss-name"></span><span id="boss-title" style="font-size:.84rem;font-weight:400;color:#EDC0B0"></span><span class="ph" id="boss-phase"></span></div><div class="bb" id="boss-bb"><i id="boss-hp"></i></div></div>
        <div id="threatcards"></div>
        <div id="aimhint"></div>
        <div id="pausetag">已暂停</div>
        <div id="guide"></div>
      </div>
      <div id="toasts"></div>
      <div id="banner"></div>
      <div id="tip"></div>
      <div id="tilehint"></div>
      <div id="dragicon"></div>
      <div id="modal"></div>
      <div id="demotitle"></div>
      <div id="demobar"><div id="democap"></div></div>
      <button class="btn danger" id="demoexit">退出演示（Esc）</button>
      <div id="fakecursor"><svg viewBox="0 0 24 24"><path d="M3 2l15 11.500-6.800.8 4 7.200-3 1.600-3.900-7.300L3.800 20z" fill="#fff" stroke="#141414" stroke-width="1.500"/></svg></div>
      <div id="fade"><div class="ln" id="fade-text">ROUTING…</div><div class="br"><i></i></div></div>`;
      this.buildTitle();
      this.buildLevels();
      this.buildDock();
      $('b-pause').onclick = () => { this.click(); this.app.togglePause(); };
      this.root.querySelectorAll('[data-sp]').forEach(b => { b.onclick = () => { this.click(); this.app.setSpeed(+b.dataset.sp); }; });
      $('b-home').onclick = () => { this.click(); this.view.resetCamera(); };
      $('b-book').onclick = () => { this.click(); this.openHandbook(); };
      $('b-mute').onclick = () => { this.click(); this.toggleMute(); };
      $('b-menu').onclick = () => { this.click(); this.openPauseMenu(); };
      $('demoexit').onclick = () => { if (TD.Demo) TD.Demo.exit(); };
      const TIPS = {
        compute: () => `<div class="h" style="color:var(--compute)">算力</div>随时间增长（每秒 ${TD.RULES.computeRate}），消灭敌人回收。用于塔、升级和备份还原。撤下返还 ${Math.round(TD.RULES.sellRefund * 100)}%，被摧毁不退款。`,
        intel: () => `<div class="h" style="color:var(--intel)">情报</div>来自波次开始、消灭重点威胁，以及交战中持续守住隔离节点（附近 ${TD.RULES.holdRadius} 格有地面敌人时每 ${TD.RULES.holdEvery} 秒 +1）。用于隔离节点、升级分支和情报道具，与算力不能互换。`,
        integrity: () => `<div class="h" style="color:var(--ok)">中枢完整度</div>敌人到达出口时下降，归零即失败。不同敌人扣除的数值不同，Boss 到达会造成重创。`,
        wave: () => { const g = this.game; return `<div class="h">波次</div>当前第 ${Math.max(0, g ? g.waveIdx + 1 : 0)} 波，共 ${g ? g.waveTotal : 0} 波。撑过全部波次并清空场上威胁即胜利。`; },
      };
      this.root.querySelectorAll('[data-tip]').forEach(e => {
        e.addEventListener('pointerenter', () => { const r = e.getBoundingClientRect(); this.showTip(TIPS[e.dataset.tip](), r.left + r.width / 2, r.bottom + 6, 'below'); });
        e.addEventListener('pointerleave', () => this.hideTip());
      });
      this.updateMuteIcon();
    }

    click() { TD.Audio.play('uiClick'); }
    toggleMute() { TD.Audio.setMuted(!TD.Audio.muted); this.updateMuteIcon(); }
    updateMuteIcon() { $('b-mute').innerHTML = TD.Audio.muted ? ICON.mute : ICON.sound; $('b-mute').classList.toggle('off', false); }

    fade(on, text) { const f = $('fade'); if (text) $('fade-text').textContent = text; f.classList.toggle('on', on); }

    // ────────── 标题 ──────────
    buildTitle() {
      const s = $('screen-title');
      s.innerHTML = `
        <div class="title-wrap">
          <div class="os">TIDAL-AS DAEMON OS · v7.31 · 汐域自治域</div>
          <h1>网络安全<br>攻防战</h1>
          <div class="sub">动态路由塔防 · 守护进程值守终端</div>
          <div class="brief">攻击组织“蛰影”正在入侵自治域“汐域”：蠕虫、木马、勒索软件和僵尸网络混在正常流量里，涌向保存全域数据的“中枢”。链路还承载着业务，你不能切断任何入口到中枢的连通，只能用隔离改变它们走哪条路。</div>
          <div class="menu">
            <button class="btn primary" id="m-start">接入战区 <span class="m">SELECT AS</span></button>
            <button class="btn" id="m-demo">实战演示 <span class="m">REPLAY × 3</span></button>
            <button class="btn" id="m-book">图鉴 · 设备手册与威胁档案 <span class="m">MAN</span></button>
            <button class="btn" id="m-help">值守手册（规则与操作） <span class="m">HELP</span></button>
            <button class="btn" id="m-set">系统设置 <span class="m">CONFIG</span></button>
          </div>
        </div>
        <div id="bootlog"></div>`;
      s.querySelector('#m-start').onclick = () => { TD.Audio.play('uiOpen'); this.showScreen('levels'); this.drawLevelCanvases(); };
      s.querySelector('#m-demo').onclick = () => { TD.Audio.play('uiOpen'); this.openDemoMenu(); };
      s.querySelector('#m-book').onclick = () => { TD.Audio.play('uiOpen'); this.openHandbook('device'); };
      s.querySelector('#m-help').onclick = () => { TD.Audio.play('uiOpen'); this.openHandbook('rules'); };
      s.querySelector('#m-set').onclick = () => { TD.Audio.play('uiOpen'); this.openSettings(); };
    }

    bootLog() {
      const lines = ['[ ok ] mount /net/ribd', '[ ok ] 协议层 L2-L4 就绪', '[warn] 边界检测到异常封装 4,812 条', '[warn] 蛰影 C2 特征命中：3 个战区', '[ ok ] 守护进程待命，等待操作员接入'];
      const b = $('bootlog');
      b.innerHTML = '';
      clearInterval(this._bootT);
      let i = 0;
      this._bootT = setInterval(() => {
        if (i >= lines.length) { clearInterval(this._bootT); return; }
        const d = document.createElement('div');
        d.textContent = lines[i++];
        if (d.textContent.includes('warn')) d.style.color = '#E9A83E';
        b.appendChild(d);
      }, 420);
    }

    showScreen(name) {
      for (const n of ['title', 'levels']) $('screen-' + n).classList.toggle('show', n === name);
      $('hud').classList.toggle('show', name === 'hud');
      if (name === 'title') this.bootLog();
    }

    // ────────── 关卡选择 ──────────
    buildLevels() {
      const s = $('screen-levels');
      const accent = { intranet: '#8FD3B8', backbone: '#D9B45B', airgap: '#E8884A' };
      const cards = TD.MAP_ORDER.map((id, i) => {
        const d = TD.MAPS[id];
        return `<div class="lv-card panel" data-map="${id}" style="--tc:${accent[id]}">
          <canvas data-canvas="${id}"></canvas>
          <div class="inf">
            <div class="no">AS-0${i + 1} · ${d.en}</div>
            <div class="nm">${d.name}</div>
            <div class="ty">${d.kind} · ${d.waves.length} 波 · Boss：${TD.BOSSES[d.waves[d.waves.length - 1].boss].name}</div>
            <p>${d.summary}</p>
            <p class="doc">${d.doctrine}</p>
            <div class="meta"><span>${d.entrances.length} 入口</span><span>${d.exits.length} 出口</span><span>${d.nodes.length} 交换节点</span></div>
            <div class="best" data-best="${id}"></div>
            <button class="btn primary go">接入 ${d.name}</button>
          </div>
        </div>`;
      }).join('');
      s.innerHTML = `
        <div class="lv-top"><button class="btn" id="lv-back">返回</button><h2>选择战区</h2><span class="m">/net/autonomous-systems —— 三个战区均可直接接入</span></div>
        <div class="lv-grid">${cards}</div>`;
      s.querySelector('#lv-back').onclick = () => { TD.Audio.play('uiClose'); this.showScreen('title'); };
      s.querySelectorAll('.lv-card').forEach(c => {
        c.onmouseenter = () => TD.Audio.play('uiHover');
        c.onclick = () => { TD.Audio.play('uiOpen'); this.app.startMap(c.dataset.map); };
      });
    }

    // 选关界面的路线持续流动
    animateLevels() {
      if (this._lvAnim) return;
      this._lvAnim = true;
      const tick = (now) => {
        if (!$('screen-levels').classList.contains('show')) { this._lvAnim = false; return; }
        for (const id of TD.MAP_ORDER) {
          const cv = this.root.querySelector(`[data-canvas="${id}"]`);
          if (cv && cv._flow) cv._flow(now / 1000);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    drawLevelCanvases() {
      this.animateLevels();
      const best = this.app.loadBest();
      this.root.querySelectorAll('[data-best]').forEach(e => {
        const b = best[e.dataset.best];
        e.textContent = b ? `最佳处置评级 ${b.grade} · 完整度 ${b.integrity}/20` : '尚无处置记录';
      });
      for (const id of TD.MAP_ORDER) {
        const cv = this.root.querySelector(`[data-canvas="${id}"]`);
        if (cv) this.drawSchematic(cv, id);
      }
    }

    // 网络拓扑简图
    drawSchematic(cv, id) {
      const r = cv.getBoundingClientRect();
      const W = Math.max(50, Math.floor(r.width)), H = Math.max(50, Math.floor(r.height));
      cv.width = W * 2; cv.height = H * 2;
      const g = new TD.Game(id);
      const m = g.map;
      const c = cv.getContext('2d');
      c.scale(2, 2);
      const s = Math.min((W - 16) / m.w, (H - 12) / m.h);
      const ox = (W - s * m.w) / 2, oy = (H - s * m.h) / 2;
      const th = TD.THEMES[TD.MAPS[id].theme];
      const hex = (v) => '#' + new THREE.Color(v).getHexString();
      c.fillStyle = hex(th.skyLow);
      c.fillRect(0, 0, W, H);
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const t = m.tiles[x + y * m.w];
        const px = ox + x * s, py = oy + y * s;
        if (t === TT.PLATFORM) { c.fillStyle = hex(th.plate); c.globalAlpha = 0.72; c.fillRect(px + 1, py + 1, s - 2, s - 2); c.globalAlpha = 1; }
        else if (t === TT.OBSTACLE) { c.fillStyle = m.kinds[x + y * m.w] === 'flow' ? hex(th.nebula2) : m.kinds[x + y * m.w] === 'gap' ? '#2C120C' : '#44464A'; c.fillRect(px + 0.5, py + 0.5, s - 1, s - 1); }
        else if (t === TT.LEGACY) { c.fillStyle = hex(th.legacy); c.fillRect(px, py, s, s); }
        else if (t !== TT.VOID) { c.fillStyle = '#20232A'; c.fillRect(px, py, s, s); }
      }
      // 静态底图缓存起来，路线每帧重画
      const base = document.createElement('canvas');
      base.width = cv.width; base.height = cv.height;
      base.getContext('2d').drawImage(cv, 0, 0);
      const lab = (x, y, t, col) => {
        c.fillStyle = col; c.fillRect(ox + x * s - 1, oy + y * s - 1, s + 2, s + 2);
        c.fillStyle = '#0B0B0D'; c.font = `900 ${s * 0.95}px "Bahnschrift",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(t, ox + (x + 0.5) * s, oy + (y + 0.5) * s + 0.5);
      };
      const paths = m.entrances.map((en, i) => {
        const lane = (i - (m.entrances.length - 1) / 2) * s * 0.26;
        return { col: TD.ENTRANCE_COLORS[en.id], pts: g.routes[en.id].path.map(p => [ox + (p % m.w + 0.5) * s + lane, oy + (((p / m.w) | 0) + 0.5) * s + lane]) };
      });
      const draw = (t) => {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(base, 0, 0);
        c.setTransform(2, 0, 0, 2, 0, 0);
        for (const p of paths) {
          c.beginPath();
          p.pts.forEach((q, k) => { if (k) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); });
          c.strokeStyle = p.col; c.globalAlpha = 0.45; c.lineWidth = Math.max(1.6, s * 0.2); c.setLineDash([]); c.stroke();
          c.globalAlpha = 1; c.lineWidth = Math.max(2, s * 0.26); c.setLineDash([s * 0.7, s * 1.5]); c.lineDashOffset = -t * s * 2.4; c.stroke();
          c.setLineDash([]);
        }
        for (const nd of m.nodes) {
          c.fillStyle = '#6FDFAE'; c.strokeStyle = '#0A1410'; c.lineWidth = 1;
          c.beginPath(); c.arc(ox + (nd.x + 0.5) * s, oy + (nd.y + 0.5) * s, s * 0.42, 0, 7); c.fill(); c.stroke();
        }
        for (const en of m.entrances) lab(en.x, en.y, en.id, TD.ENTRANCE_COLORS[en.id]);
        for (const ex of m.exits) lab(ex.x, ex.y, ex.id, TD.EXIT_COLORS[ex.id]);
      };
      cv._flow = draw;
      draw(0);
    }

    // ────────── 部署栏 ──────────
    buildDock() {
      const groups = [
        { cap: '链路 / 节点 · 阻挡与隔离', items: ['firewall', 'honeypot', 'gate'] },
        { cap: '设备平台 · 火力与支援', items: ['interceptor', 'sandbox', 'repair'] },
      ];
      const dock = $('dock');
      dock.innerHTML = '';
      for (const g of groups) {
        const box = el(`<div class="dockgroup"><div class="cap">${g.cap}</div><div class="cards"></div></div>`);
        for (const id of g.items) {
          const t = TD.TOWERS[id];
          const c = el(`<div class="card" data-kind="tower" data-id="${id}" style="--rc:${TD.ROLE_COLORS[t.roleKey]}">
            <span class="hk">${t.key}</span><img data-thumb="${id}_1"><div class="nm">${t.name}</div><div class="role">${t.role}</div>
            <div class="cost"><span class="c">${ICON.compute} ${t.cost}</span>${t.nodeIntel ? `<span class="i">${ICON.intel} ${t.nodeIntel}</span>` : ''}</div></div>`);
          box.querySelector('.cards').appendChild(c);
          this.cards['t_' + id] = c;
          this.bindCard(c, 'tower', id);
        }
        dock.appendChild(box);
      }
      const box = el(`<div class="dockgroup"><div class="cap">道具 · 有使用间隔</div><div class="cards"></div></div>`);
      const itemColor = { isolator: '#E9A83E', downgrade: '#E8A868', backup: '#8FE0C0' };
      for (const id of TD.ITEM_ORDER) {
        const it = TD.ITEMS[id];
        const pic = id === 'isolator' ? `<img data-thumb="isolator">` : `<div class="svgicon">${ICON[id]}</div>`;
        const c = el(`<div class="card" data-kind="item" data-id="${id}" style="--rc:${itemColor[id]}">
          <span class="hk">${it.key}</span>${pic}<div class="nm" style="font-size:.84rem">${it.name}</div><div class="role">${it.target === 'node' ? '投放节点' : it.target === 'area' ? '投放链路' : '投放到塔'}</div>
          <div class="cost">${it.res === 'intel' ? `<span class="i">${ICON.intel} ${it.cost}</span>` : `<span class="c">${ICON.compute} ${it.cost}</span>`}</div><div class="cdmask" style="height:0"></div></div>`);
        box.querySelector('.cards').appendChild(c);
        this.cards['i_' + id] = c;
        this.bindCard(c, 'item', id);
      }
      dock.appendChild(box);
    }

    applyThumbs() {
      this.root.querySelectorAll('img[data-thumb]').forEach(img => { const u = TD.thumbs && TD.thumbs[img.dataset.thumb]; if (u) img.src = u; });
    }

    bindCard(c, kind, id) {
      c.addEventListener('pointerenter', () => { TD.Audio.play('uiHover'); this.showCardTip(c, kind, id); });
      c.addEventListener('pointerleave', () => this.hideTip());
      c.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !this.game || this.app.demo) return;
        e.preventDefault(); e.stopPropagation();
        this.hideTip();
        TD.Audio.unlock();
        if (this.drag && this.drag.id === id) { this.cancelDrag(); return; }
        this.beginDrag(kind, id);
        this.drag.downAt = { x: e.clientX, y: e.clientY };
        this.drag.fromCard = true;
      });
    }

    showCardTip(c, kind, id) {
      const r = c.getBoundingClientRect();
      let html;
      if (kind === 'tower') {
        const t = TD.TOWERS[id];
        html = `<div class="h" style="color:${TD.ROLE_COLORS[t.roleKey]}">${t.name} <span class="m">· ${t.role}</span></div>${t.brief}<div class="m">部署：${t.place.map(p => ({ link: '链路', node: '节点', platform: '平台' }[p])).join(' / ')} · 算力 ${t.cost}${t.nodeIntel ? ` · 上节点另需情报 ${t.nodeIntel}` : ''}</div><div class="m">技能：${t.skill.name}。拖到地图部署，或按 ${t.key} 选取后点击。</div>`;
      } else {
        const it = TD.ITEMS[id];
        html = `<div class="h">${it.name}</div>${it.desc}<div class="m">消耗 ${it.res === 'intel' ? '情报' : '算力'} ${it.cost} · 使用间隔 ${it.cd} 秒 · 快捷键 ${it.key}</div>`;
      }
      this.showTip(html, r.left + r.width / 2, r.top - 8, 'above');
    }

    showTip(html, x, y, mode) {
      const t = $('tip');
      t.innerHTML = html;
      t.style.display = 'block';
      const b = t.getBoundingClientRect();
      let px = x - b.width / 2, py = mode === 'above' ? y - b.height : y;
      px = Math.max(6, Math.min(window.innerWidth - b.width - 6, px));
      py = Math.max(6, Math.min(window.innerHeight - b.height - 6, py));
      t.style.left = px + 'px'; t.style.top = py + 'px';
    }
    hideTip() { $('tip').style.display = 'none'; }

    // ────────── 全局输入 ──────────
    bindGlobal() {
      const cv = this.view.renderer.domElement;
      const onDown = (e) => {
        TD.Audio.unlock();
        if (this.app.demo) { e.preventDefault(); return; }
        if (e.button === 1) { // 中键
          e.preventDefault();
          this.camDrag = { x: e.clientX, y: e.clientY, pan: e.shiftKey };
          return;
        }
        if (e.button === 2) { this.cancelInteraction(); return; }
        if (e.button === 0) this.onCanvasLeft(e.clientX, e.clientY);
      };
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('wheel', (e) => { if (this.app.demo) return; e.preventDefault(); this.view.zoom(e.deltaY); }, { passive: false });
      window.addEventListener('contextmenu', (e) => e.preventDefault());
      window.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
      window.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
      window.addEventListener('pointermove', (e) => {
        this.mouse = { x: e.clientX, y: e.clientY };
        if (this.camDrag) {
          const dx = e.clientX - this.camDrag.x, dy = e.clientY - this.camDrag.y;
          this.camDrag.x = e.clientX; this.camDrag.y = e.clientY;
          if (e.shiftKey) this.view.pan(dx, dy); else this.view.orbit(dx, dy);
          return;
        }
        if (this.app.demo) return;
        if (this.pending && this.pending.kind === 'aim') { this.aimMove(e.clientX, e.clientY); return; }
        if (this.drag) { this.dragMove(e.clientX, e.clientY); return; }
        this.hoverMove(e.clientX, e.clientY, e.target);
      });
      window.addEventListener('pointerup', (e) => {
        if (e.button === 1) this.camDrag = null;
        if (this.app.demo || e.button !== 0) return;
        if (this.drag && this.drag.fromCard) {
          const moved = Math.hypot(e.clientX - this.drag.downAt.x, e.clientY - this.drag.downAt.y) > 12;
          if (!moved) { // 点选卡片：转为“已选取”状态，下一次左键放置
            this.drag.fromCard = false;
            this.drag.armed = true;
            return;
          }
          this.dragDrop(e.clientX, e.clientY);
        }
      });
      window.addEventListener('pointerdown', () => TD.Audio.unlock(), { capture: true });
      // 所有按钮统一的悬停音
      document.addEventListener('pointerover', (e) => {
        const b = e.target.closest && e.target.closest('.btn, .tab, .hb-it');
        if (b && b !== this._hoverBtn) { this._hoverBtn = b; TD.Audio.play('uiHover'); }
        else if (!b) this._hoverBtn = null;
      });
      window.addEventListener('keydown', (e) => { TD.Audio.unlock(); this.onKey(e); });
    }

    onKey(e) {
      if (e.repeat) return;
      const k = e.key;
      if (this.app.demo) { if (k === 'Escape' && TD.Demo) TD.Demo.exit(); return; }
      if (k === 'Escape') {
        if ($('modal').classList.contains('show')) { if (this.modalKind !== 'report') this.closeModal(); return; }
        if (this.drag || this.pending) { this.cancelInteraction(); return; }
        if (this.sel) { this.select(null); return; }
        if (this.game) this.openPauseMenu();
        return;
      }
      if (!this.game || $('modal').classList.contains('show')) return;
      if (k === ' ') { e.preventDefault(); this.app.togglePause(); return; }
      if (k === 'Enter') { if (this.pending && this.pending.kind !== 'aim') this.confirmPending(); return; }
      if (k === 'f' || k === 'F') { this.app.setSpeed(this.app.speed % 3 + 1); return; }
      if (k === 'h' || k === 'H') { this.view.resetCamera(); return; }
      if (k === 'b' || k === 'B') { this.openHandbook(); return; }
      if (k === 'm' || k === 'M') { this.toggleMute(); return; }
      if (k === 'n' || k === 'N') { this.game.callNext(); return; }
      for (const id of TD.TOWER_ORDER) if (TD.TOWERS[id].key === k) { this.armFromKey('tower', id); return; }
      for (const id of TD.ITEM_ORDER) if (TD.ITEMS[id].key.toLowerCase() === k.toLowerCase()) { this.armFromKey('item', id); return; }
      if (this.sel && this.sel.kind === 'tower') {
        if (k === 'r' || k === 'R') this.game.useSkill(this.sel.unit);
        if (k === 'x' || k === 'X') this.requestSell(this.sel.unit);
        if ((k === 'u' || k === 'U') && this.sel.unit.def.lv2) this.game.upgrade(this.sel.unit);
      }
    }

    armFromKey(kind, id) {
      if (this.drag && this.drag.id === id) { this.cancelDrag(); return; }
      this.beginDrag(kind, id);
      this.drag.armed = true;
      if (this.mouse) this.dragMove(this.mouse.x, this.mouse.y);
    }

    onCanvasLeft(x, y) {
      if (!this.game) return;
      if (this.pending && this.pending.kind === 'aim') { this.confirmAim(); return; }
      if (this.drag) { this.dragDrop(x, y); return; }
      if (this.pending) return;
      const u = this.view.pickUnit(x, y);
      const tile = this.view.pickTile(x, y);
      if (u && !(tile && this.game.towerAt[this.game.idx(tile.x, tile.y)] && u.unit.def && !u.unit.def.boss)) { this.select(u); TD.Audio.play('pick'); return; }
      if (tile) {
        const t = this.game.towerAt[this.game.idx(tile.x, tile.y)];
        if (t) this.select({ kind: 'tower', unit: t });
        else if (u) this.select(u);
        else this.select({ kind: 'tile', x: tile.x, y: tile.y });
        TD.Audio.play('pick');
      } else this.select(null);
    }

    hoverMove(x, y, target) {
      const hint = $('tilehint');
      const cv = this.view.renderer.domElement;
      if (!this.game || target !== cv) { hint.style.display = 'none'; this.view.hoverTile = null; return; }
      const t = this.view.pickTile(x, y);
      this.view.hoverTile = t;
      if (!t) { hint.style.display = 'none'; cv.style.cursor = 'default'; return; }
      const name = this.tileName(t.x, t.y);
      const u = this.view.pickUnit(x, y);
      cv.style.cursor = (u || this.game.towerAt[this.game.idx(t.x, t.y)]) ? 'pointer' : 'default';
      hint.textContent = u ? `${u.unit.def.name}（点击查看）` : name;
      hint.style.display = 'block';
      hint.style.left = (x + 14) + 'px'; hint.style.top = (y + 16) + 'px';
    }

    tileName(x, y) {
      const g = this.game;
      if (!g.inGrid(x, y)) return '';
      const i = g.idx(x, y), t = g.map.tiles[i];
      if (g.towerAt[i]) return `${g.towerAt[i].def.name} Lv.${g.towerAt[i].level}`;
      if (t === TT.NODE) { const nd = g.nodeByIdx[i]; return `${nd.name} · ${nd.isolator ? '应急隔离中' : g.blocked[i] ? '被封锁' : nd.lockT > 0 ? `再隔离间隔 ${Math.ceil(nd.lockT)} 秒` : '直通'}`; }
      if (t === TT.LINK) return g.zoneCount[i] ? '链路（协议降级中）' : '链路 · 可部署防火墙 / 蜜罐';
      if (t === TT.LEGACY) return '旧链路 · 减速并显形木马';
      if (t === TT.PLATFORM) return '设备平台 · 可部署拦截器 / 沙箱 / 修复进程';
      if (t === TT.OBSTACLE) return g.map.kinds[i] === 'flow' ? '公网流（障碍）' : g.map.kinds[i] === 'gap' ? '气隙（障碍）' : '数据设施（障碍）';
      if (t === TT.ENTRANCE) { const en = g.map.entrances.find(e => e.idx === i); return `入口 ${en.id} ${en.name}`; }
      if (t === TT.EXIT) { const ex = g.map.exits.find(e => e.idx === i); return `出口 ${ex.id} ${ex.name}`; }
      return '';
    }

    // ────────── 拖放部署 ──────────
    beginDrag(kind, id) {
      this.cancelInteraction();
      this.select(null);
      const g = this.game;
      this.drag = { kind, id, tile: null, check: null, dir: 0 };
      const card = this.cards[(kind === 'tower' ? 't_' : 'i_') + id];
      if (card) card.classList.add('armed');
      TD.Audio.play('pick');
      const icon = $('dragicon');
      const src = kind === 'tower' ? TD.thumbs && TD.thumbs[id + '_1'] : TD.thumbs && TD.thumbs[id];
      icon.innerHTML = src ? `<img src="${src}">` : '';
      icon.style.display = 'block';
      // 可部署位置提示
      const list = [];
      if (kind === 'tower') {
        const def = TD.TOWERS[id];
        for (let y = 0; y < g.map.h; y++) for (let x = 0; x < g.map.w; x++) {
          const i = g.idx(x, y), t = g.map.tiles[i];
          const cat = (t === TT.LINK || t === TT.LEGACY) ? 'link' : t === TT.NODE ? 'node' : t === TT.PLATFORM ? 'platform' : null;
          if (cat && def.place.indexOf(cat) >= 0 && !g.towerAt[i]) list.push({ x, y });
        }
        this.view.showHints(list, TD.ROLE_COLORS[def.roleKey]);
      } else if (id === 'isolator') {
        for (const nd of g.nodes) if (!nd.tower && !nd.isolator && !g.blocked[nd.idx]) list.push({ x: nd.x, y: nd.y });
        this.view.showHints(list, 0xE9A83E);
      } else if (id === 'backup') {
        for (const t of g.towers) list.push({ x: t.x, y: t.y });
        this.view.showHints(list, 0x8FE0C0);
      }
      this.view.renderer.domElement.style.cursor = 'crosshair';
      if (kind === 'tower') this.setAim(`拖到高亮位置部署 ${TD.TOWERS[id].name}，右键或 Esc 取消`);
      else this.setAim(`${TD.ITEMS[id].name}：${TD.ITEMS[id].brief} 右键或 Esc 取消`);
    }

    setAim(t) { const a = $('aimhint'); if (t) { a.textContent = t; a.style.display = 'block'; } else a.style.display = 'none'; }

    dragMove(x, y) {
      const d = this.drag;
      if (!d) return;
      const icon = $('dragicon');
      icon.style.left = x + 'px'; icon.style.top = y + 'px';
      const elem = document.elementFromPoint(x, y);
      const overMap = this.app.demo ? y < $('dock').getBoundingClientRect().top : elem === this.view.renderer.domElement;
      const tile = overMap ? this.view.pickTile(x, y) : null;
      if (!tile) {
        d.tile = null; d.check = null;
        this.view.showCursor(null); this.view.showGhost(null); this.view.hideRange(); this.view.clearPreview();
        this.hideRoutePanel();
        icon.style.display = 'block';
        return;
      }
      icon.style.display = 'none';
      const same = d.tile && d.tile.x === tile.x && d.tile.y === tile.y;
      d.tile = tile;
      const g = this.game;
      if (!same || !d.check) {
        if (d.kind === 'tower') d.check = g.checkPlace(d.id, tile.x, tile.y);
        else d.check = g.checkItem(d.id, tile.x, tile.y);
      }
      const chk = d.check;
      if (d.kind === 'tower') {
        const def = TD.TOWERS[d.id];
        const validSpot = chk.ok || chk.lack;
        this.view.showCursor(tile.x, tile.y, chk.ok);
        this.view.showGhost(validSpot ? d.id : null, tile.x, tile.y, d.dir);
        if (d.id === 'interceptor' && !same) d.dir = this.bestDir(tile.x, tile.y, def.range, def.arc);
        this.showTowerRange(d.id, tile.x, tile.y, d.dir, 1, null, validSpot);
        if (chk.cat === 'node' && chk.preview) { this.view.setPreview(chk.preview); this.showRoutePanel(chk.preview, `隔离预览：${chk.node.name}`, chk); if (!same) TD.Audio.play('preview'); }
        else if (chk.cat === 'node' && chk.sealed) { this.view.setPreview(chk.preview); this.showRoutePanel(chk.preview, `隔离预览：${chk.node.name}`, chk); }
        else { this.view.clearPreview(); this.hideRoutePanel(); }
        if (!chk.ok) this.setAim(chk.reason); else this.setAim(chk.cat === 'node' ? '松开后确认隔离' : d.id === 'interceptor' ? '松开后再用鼠标设定朝向' : `松开部署 ${def.name}`);
      } else {
        this.view.showCursor(tile.x, tile.y, chk.ok);
        this.view.hideRange();
        if (d.id === 'downgrade') {
          this.view.showRange(tile.x, tile.y, TD.ITEMS.downgrade.radius, chk.ok ? 0xE8A868 : 0xE8583F);
          if (chk.preview) { this.view.setPreview(chk.preview); this.showRoutePanel(chk.preview, '协议降级预览', chk); } else { this.view.clearPreview(); this.hideRoutePanel(); }
        } else if (d.id === 'isolator') {
          this.view.showGhost(chk.ok ? 'isolator' : null, tile.x, tile.y);
          if (chk.preview) { this.view.setPreview(chk.preview); this.showRoutePanel(chk.preview, `应急隔离预览：${g.nodeByIdx[g.idx(tile.x, tile.y)].name}`, chk); } else { this.view.clearPreview(); this.hideRoutePanel(); }
        } else {
          this.view.clearPreview(); this.hideRoutePanel();
        }
        if (!chk.ok) this.setAim(chk.reason); else this.setAim(`松开使用 ${TD.ITEMS[d.id].name}`);
      }
    }

    // 路线上有多少格处在攻击塔的射程内（拦截器按扇区算）
    coverage(path) {
      const g = this.game, w = g.map.w;
      const shooters = g.towers.filter(t => t.type === 'interceptor' || t.type === 'sandbox' || (t.type === 'firewall' && !t.onNode));
      let n = 0;
      for (const i of path) {
        const x = i % w, y = (i / w) | 0;
        for (const t of shooters) {
          const dx = x - t.x, dy = y - t.y, d = Math.hypot(dx, dy);
          const r = t.type === 'firewall' ? 1.1 : t.s.range;
          if (d > r) continue;
          if (t.type === 'interceptor' && d > 0.01 && Math.abs(TD.angleDiff(Math.atan2(dy, dx), t.dir)) > t.s.arc * Math.PI / 360) continue;
          n++;
          break;
        }
      }
      return n;
    }

    // 给拦截器挑覆盖路线最多的朝向
    bestDir(x, y, range, arc) {
      const g = this.game, half = arc * Math.PI / 360;
      const pts = [];
      for (const k in g.routes) for (const i of g.routes[k].path) {
        const dx = i % g.map.w - x, dy = ((i / g.map.w) | 0) - y;
        const d = Math.hypot(dx, dy);
        if (d <= range && d > 0.5) pts.push(Math.atan2(dy, dx));
      }
      let best = 0, bn = -1;
      for (let a = 0; a < 16; a++) {
        const ang = a * Math.PI / 8;
        let n = 0;
        for (const p of pts) if (Math.abs(TD.angleDiff(p, ang)) <= half) n++;
        if (n > bn) { bn = n; best = ang; }
      }
      return best;
    }

    showTowerRange(id, x, y, dir, level, branch, valid) {
      const s = TD.towerStats(id, level, branch);
      this.view.hideRange();
      if (!valid) return;
      const col = TD.ROLE_COLORS[TD.TOWERS[id].roleKey];
      if (id === 'interceptor') this.view.showRange(x, y, s.range, col, s.arc * Math.PI / 360, dir);
      else if (id === 'sandbox') { this.view.showRange(x, y, s.range, col); }
      else if (id === 'repair') this.view.showRange(x, y, s.range, col);
      else if (id === 'honeypot') this.view.showRange(x, y, s.lureR, col);
      else if (id === 'firewall') this.view.showRange(x, y, 1.05, col);
    }

    dragDrop(x, y) {
      const d = this.drag;
      if (!d) return;
      const g = this.game;
      this.dragMove(x, y);
      if (!d.tile) { this.cancelDrag(); return; }
      const chk = d.check;
      if (!chk.ok) {
        g.emit('reject', { reason: chk.reason, sealed: chk.sealed, x: d.tile.x, y: d.tile.y });
        this.toast(chk.reason, 'bad');
        if (chk.preview) this.view.setPreview(chk.preview);
        this.flashResource(chk.lack);
        this.cancelDrag(true);
        return;
      }
      const tile = d.tile;
      if (d.kind === 'tower') {
        const id = d.id;
        if (id === 'interceptor') {
          this.endDragVisual();
          this.pending = { kind: 'aim', type: id, x: tile.x, y: tile.y, dir: d.dir, redirect: null };
          this.drag = null;
          this.view.showCursor(tile.x, tile.y, true);
          this.setAim('移动鼠标设定朝向，左键确认，右键或 Esc 取消');
          this.view.showGhost(id, tile.x, tile.y, this.pending.dir);
          this.showTowerRange(id, tile.x, tile.y, this.pending.dir, 1, null, true);
          return;
        }
        if (chk.cat === 'node') {
          this.endDragVisual();
          this.drag = null;
          this.pending = { kind: 'confirm', x: tile.x, y: tile.y, apply: () => g.placeTower(id, tile.x, tile.y), title: `确认隔离 ${chk.node.name}（算力 ${chk.cost} · 情报 ${chk.intel}）`, preview: chk.preview, ghost: id };
          this.view.setPreview(chk.preview);
          this.view.showGhost(id, tile.x, tile.y);
          this.view.showCursor(tile.x, tile.y, true);
          this.showRoutePanel(chk.preview, this.pending.title, chk, true);
          this.setAim(null);
          return;
        }
        this.endDrag();
        g.placeTower(id, tile.x, tile.y, 0);
      } else {
        const id = d.id;
        if (id === 'backup') {
          this.endDrag();
          g.useItem(id, tile.x, tile.y);
          return;
        }
        this.endDragVisual();
        this.drag = null;
        const label = id === 'isolator' ? `确认投放应急隔离器到 ${chk.node.name}（情报 ${TD.ITEMS.isolator.cost}）` : `确认协议降级（情报 ${TD.ITEMS.downgrade.cost}）`;
        this.pending = { kind: 'confirm', x: tile.x, y: tile.y, apply: () => g.useItem(id, tile.x, tile.y), title: label, preview: chk.preview, item: id };
        this.view.setPreview(chk.preview);
        if (id === 'downgrade') this.view.showRange(tile.x, tile.y, TD.ITEMS.downgrade.radius, 0xE8A868);
        this.view.showCursor(tile.x, tile.y, true);
        this.showRoutePanel(chk.preview, label, chk, true);
        this.setAim(null);
      }
    }

    aimMove(x, y) {
      const p = this.pending;
      if (!p) return;
      const hit = this.view.pickFloat(x, y, 0.9);
      if (!hit) return;
      p.dir = Math.atan2(hit.y - p.y, hit.x - p.x);
      const s = p.redirect ? p.redirect.s : TD.towerStats('interceptor', 1, null);
      if (!p.redirect) this.view.showGhost('interceptor', p.x, p.y, p.dir);
      this.view.showRange(p.x, p.y, s.range, p.redirect && p.redirect.branch === 'suppress' ? '#A99BE8' : TD.ROLE_COLORS.ranged, s.arc * Math.PI / 360, p.dir);
    }

    confirmAim() {
      const p = this.pending;
      if (!p || p.kind !== 'aim') return;
      this.clearPending();
      if (p.redirect) { this.game.redirect(p.redirect, p.dir); this.select({ kind: 'tower', unit: p.redirect }, true); return; }
      const res = this.game.placeTower(p.type, p.x, p.y, p.dir);
      if (!res.ok) this.toast(res.reason, 'bad');
    }

    confirmPending() {
      const p = this.pending;
      if (!p || p.kind === 'aim') return;
      const r = p.apply();
      this.clearPending();
      if (r && r.ok === false) this.toast(r.reason || '操作被拒绝', 'bad');
    }

    clearPending() {
      this.pending = null;
      this.endDragVisual();
      this.setAim(null);
      this.hideRoutePanel();
      this.view.clearPreview();
    }

    cancelPending() { if (this.pending) { TD.Audio.play('uiClose'); this.clearPending(); } }

    endDragVisual() {
      this.view.renderer.domElement.style.cursor = 'default';
      this.view.showCursor(null); this.view.showGhost(null); this.view.hideRange(); this.view.showHints(null);
      $('dragicon').style.display = 'none';
      for (const k in this.cards) this.cards[k].classList.remove('armed');
    }

    endDrag() {
      this.drag = null;
      this.endDragVisual();
      this.view.clearPreview();
      this.hideRoutePanel();
      this.setAim(null);
    }

    cancelDrag(keepPreview) {
      const pv = keepPreview ? this.view.preview : null;
      this.endDrag();
      TD.Audio.play('uiClose');
      if (pv && pv.sealed && pv.sealed.length) this.view.setSealed(pv.sealed, 4);
    }

    cancelInteraction() {
      if (this.pending) this.cancelPending();
      if (this.drag) this.cancelDrag();
    }

    flashResource(kind) {
      if (kind === 'compute') { const e = $('s-compute'); e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit'); }
      if (kind === 'intel') { const e = $('s-intel'); e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit'); }
    }

    // ────────── 路由预览面板 ──────────
    showRoutePanel(pv, title, chk, withButtons) {
      const g = this.game;
      const p = $('routepanel');
      let rows = '';
      if (pv) {
        if (pv.sealed && pv.sealed.length) {
          for (const s of pv.sealed.slice(0, 3)) rows += `<div class="note bad">✕ ${s.label}</div>`;
          rows += `<div class="note bad">保持连通规则：这个操作不能完成，也不消耗资源。</div>`;
        } else if (!pv.changes.length) {
          rows += `<div class="note">各入口路线不变。</div>`;
        } else {
          for (const c of pv.changes) {
            const delta = c.newLen - c.oldLen;
            const exitChanged = c.oldExit !== c.newExit;
            const costD = (c.newCost - c.oldCost);
            const cov0 = this.coverage(c.oldPath), cov1 = this.coverage(c.newPath);
            rows += `<div class="r"><span class="sw" style="background:${TD.ENTRANCE_COLORS[c.ent]}"></span><span><b>${c.ent}</b> ${entName(g, c.ent)} → ${exitChanged ? `<b style="color:${TD.EXIT_COLORS[c.newExit]}">${exName(g, c.newExit)}</b>（原 ${c.oldExit}）` : exName(g, c.newExit)}</span><span class="d ${costD >= 0 ? 'up' : 'down'}">${c.oldLen} → ${c.newLen} 跳 ${delta > 0 ? '+' + delta : delta < 0 ? delta : ''}</span><span class="d ${cov1 >= cov0 ? 'down' : 'up'}" style="margin-left:.7rem" title="路线上处于你的火力范围内的格数">火力 ${cov0} → ${cov1} 格</span></div>`;
          }
          const unchanged = g.map.entrances.filter(en => !pv.changes.some(c => c.ent === en.id)).map(en => en.id);
          if (unchanged.length) rows += `<div class="note">入口 ${unchanged.join('、')} 路线不变。</div>`;
        }
      }
      if (chk && chk.reason && chk.ok === false && !(pv && pv.sealed && pv.sealed.length)) rows += `<div class="note bad">${chk.reason}</div>`;
      p.innerHTML = `<div class="wintitle"><span class="led ${pv && pv.sealed && pv.sealed.length ? 'bad' : 'warn'}"></span><b>${title}</b><span class="path">/net/rib --dry-run</span></div><div class="rows">${rows}</div>${withButtons ? `<div class="btns"><button class="btn" id="rp-no">取消（Esc）</button><button class="btn primary" id="rp-yes">确认（Enter）</button></div>` : ''}`;
      p.classList.remove('hide');
      if (withButtons) {
        p.querySelector('#rp-yes').onclick = () => { this.click(); this.confirmPending(); };
        p.querySelector('#rp-no').onclick = () => this.cancelPending();
      }
    }
    hideRoutePanel() { $('routepanel').classList.add('hide'); }

    requestSell(t) {
      const g = this.game;
      if (t.onNode) {
        const pv = g.sellPreview(t);
        this.cancelInteraction();
        this.pending = { kind: 'confirm', apply: () => g.sell(t), preview: pv };
        this.view.setPreview(pv);
        this.showRoutePanel(pv, `确认撤下 ${t.def.name}（回收算力 ${Math.round(t.invested * TD.RULES.sellRefund)}），${t.node.name}将旁路直通`, null, true);
      } else {
        g.sell(t);
        this.select(null);
      }
    }

    requestRedirect(t) {
      this.cancelInteraction();
      this.pending = { kind: 'aim', redirect: t, x: t.x, y: t.y, dir: t.dir };
      this.setAim('移动鼠标设定新朝向，左键确认，右键或 Esc 取消');
      this.view.showRange(t.x, t.y, t.s.range, TD.ROLE_COLORS.ranged, t.s.arc * Math.PI / 360, t.dir);
    }

    // ────────── 选中面板 ──────────
    select(sel, keepSound) {
      this.sel = sel;
      this.view.selected = sel && sel.kind !== 'tile' ? sel : null;
      this.view.hideRange();
      this.renderInspector();
    }

    renderInspector() {
      const box = $('inspector');
      const s = this.sel;
      if (!s) { box.classList.add('hide'); this.inspKey = null; return; }
      box.classList.remove('hide');
      let html = '';
      if (s.kind === 'tower') html = this.towerPanel(s.unit);
      else if (s.kind === 'enemy') html = this.enemyPanel(s.unit);
      else html = this.tilePanel(s.x, s.y);
      box.innerHTML = html;
      this.bindInspector();
      this.updateInspector();
    }

    towerPanel(t) {
      const stats = TD.towerDescribe(t.type, t.level, t.branch);
      const thumb = TD.thumbs ? TD.thumbs[`${t.type}_${t.level}${t.branch ? '_' + t.branch : ''}`] : '';
      let upgrade = '';
      if (t.level === 1) {
        if (t.def.branches) {
          upgrade = `<div class="sec">升级分支（二选一，消耗情报）</div><div class="actions"><div class="branchrow">`;
          for (const k in t.def.branches) {
            const b = t.def.branches[k];
            upgrade += `<button class="btn branch" data-branch="${k}"><img src="${TD.thumbs ? TD.thumbs[`${t.type}_2_${k}`] : ''}"><b>${b.title}</b><span class="pr">${ICON.compute} ${b.cost} ${ICON.intel} ${b.intel}</span><span class="bd">${b.desc}</span></button>`;
          }
          upgrade += `</div></div>`;
        } else {
          const u = t.def.lv2;
          upgrade = `<div class="actions"><button class="btn" data-up="1"><span><b>升级：${u.title}</b><span class="bd">${u.desc}</span></span><span class="pr">${ICON.compute} ${u.cost}</span></button></div>`;
        }
      } else {
        const tt = t.s.title, d = t.s.desc;
        upgrade = `<div class="sec">当前强化：${tt}</div><div class="desc">${d}</div>`;
      }
      const sk = t.def.skill;
      const skText = t.type === 'honeypot' ? (t.branch === 'trap' ? '诱捕延长到 5.5 秒，被困者暴露并显形，被困时消灭回收情报。' : t.branch === 'net' ? `困住被诱来的敌人 ${t.s.trapDur} 秒。` : sk.desc) : sk.desc;
      const actions = `<div class="actions">
        <button class="btn" data-skill="1"><span><b>技能：${sk.name}</b> <span class="mono" data-k="skcd"></span><span class="bd">${skText}</span></span><span class="pr">R</span></button>
        ${t.type === 'interceptor' ? `<button class="btn" data-redirect="1"><span><b>调整朝向</b> <span class="mono" data-k="rdcd"></span><span class="bd">重新设定攻击扇区，间隔 10 秒。</span></span></button>` : ''}
        <button class="btn danger" data-sell="1"><span><b>撤下</b>${t.onNode ? `<span class="bd">节点将恢复直通并进入再隔离间隔，情报不返还。</span>` : ''}</span><span class="pr">${ICON.compute} +${Math.round(t.invested * TD.RULES.sellRefund)}</span></button>
      </div>`;
      return `<div class="wintitle"><span class="led"></span><b>设备详情</b><span class="path">/dev/${t.type}${t.id}</span></div>
        <div class="head"><img src="${thumb}"><div><div class="nm">${t.def.name} <span class="mono" style="font-size:.9rem;color:${TD.ROLE_COLORS[t.def.roleKey]}">Lv.${t.level}</span></div><div class="sub">${t.def.role}${t.onNode ? ` · 隔离${t.node.name}` : ''}</div></div></div>
        <div class="hpb"><i data-k="hp"></i><u data-k="sh"></u></div><div class="hptext"><span data-k="hpt"></span><span data-k="sht"></span></div>
        <div class="chips" data-k="chips"></div>
        <table>${stats.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>
        ${upgrade}${actions}`;
    }

    enemyPanel(e) {
      const d = e.def;
      const thumb = TD.thumbs ? TD.thumbs[e.type] : '';
      const phases = d.phases ? `<div class="sec">阶段</div><table>${d.phases.map((p, i) => `<tr><td data-phase="${i}">${p.name}${p.at ? `（${Math.round(p.at * 100)}%）` : ''}</td><td style="font-family:inherit;text-align:left;font-size:.78rem;padding-left:.5rem">${p.desc}</td></tr>`).join('')}</table>` : '';
      return `<div class="wintitle"><span class="led bad"></span><b>威胁详情</b><span class="path">/threat/${e.type}</span></div>
        <div class="head"><img src="${thumb}"><div><div class="nm" style="color:#EE9C84">${d.name}</div><div class="sub">${d.tag}</div></div></div>
        <div class="hpb"><i data-k="hp" style="background:#E05A50"></i><u data-k="sh" style="background:#D98AF0"></u></div><div class="hptext"><span data-k="hpt"></span><span data-k="sht"></span></div>
        <div class="chips" data-k="chips"></div>
        <div class="desc">${d.desc}</div>
        <div class="desc" style="color:#EDD3A0">对策：${d.counter}</div>${phases}
        <table><tr><td>到达出口扣除完整度</td><td>${d.leak}</td></tr>${d.block ? `<tr><td>占用阻挡容量</td><td>${d.block}</td></tr>` : ''}<tr><td>来源入口</td><td>${e.ent}</td></tr></table>
        <div class="actions"><button class="btn" data-open-book="threat:${e.type}">查看威胁档案</button></div>`;
    }

    tilePanel(x, y) {
      const g = this.game;
      const i = g.idx(x, y), t = g.map.tiles[i];
      const terr = { [TT.LINK]: 'link', [TT.LEGACY]: 'legacy', [TT.NODE]: 'node', [TT.PLATFORM]: 'platform', [TT.OBSTACLE]: 'obstacle', [TT.ENTRANCE]: 'entrance', [TT.EXIT]: 'exit' }[t];
      if (!terr) return `<div class="wintitle"><span class="led"></span><b>空域</b></div><div class="desc">这里没有网络设施，能看到下方的协议层。不能部署。</div>`;
      const d = TD.TERRAIN.find(q => q.id === terr);
      let title = d.name, extra = '';
      if (t === TT.NODE) {
        const nd = g.nodeByIdx[i];
        title = nd.name;
        const pv = g.preview({ block: [i] });
        extra = `<div class="sec">节点状态</div><div class="desc" data-k="nodest"></div>`;
        if (!nd.tower && !nd.isolator && !g.blocked[i]) {
          extra += `<div class="sec">隔离后的路线（预览）</div><div class="desc">`;
          if (!pv.ok) extra += `<span style="color:#EC8A74">${pv.sealed[0].label}，当前无法隔离。</span>`;
          else if (!pv.changes.length) extra += '当前路线不经过这里。';
          else extra += pv.changes.map(c => `<div><b style="color:${TD.ENTRANCE_COLORS[c.ent]}">${c.ent}</b> → ${c.newExit}：${c.oldLen} → ${c.newLen} 跳</div>`).join('');
          extra += `</div>`;
        }
      } else if (t === TT.ENTRANCE) {
        const en = g.map.entrances.find(e => e.idx === i);
        title = `入口 ${en.id} · ${en.name}`;
        const r = g.routes[en.id];
        extra = `<div class="desc">当前路线：通往 ${exName(g, r.exit)}，${r.len} 跳。</div>`;
      } else if (t === TT.EXIT) {
        const ex = g.map.exits.find(e => e.idx === i);
        title = `出口 ${ex.id} · ${ex.name}`;
        const rr = g.map.entrances.filter(en => g.routes[en.id].exit === ex.id).map(en => en.id);
        extra = `<div class="desc">当前有 ${rr.length ? rr.join('、') + ' 入口' : '0 个入口'} 的流量通向这里。</div>`;
      } else if (t === TT.OBSTACLE) {
        const k = g.map.kinds[i];
        const names = { flow: '公网流：不属于汐域的高速流量，跨越只能走隧道或旧专线。', gap: '气隙：物理断开的安全隔离带。', gapfence: '气隙围栏。', dmz: 'DMZ 服务器厅。', drsite: '灾备数据中心。' };
        if (names[k]) extra = `<div class="desc">${names[k]}</div>`;
      }
      return `<div class="wintitle"><span class="led"></span><b>地块信息</b><span class="path">(${x},${y})</span></div>
        <div class="head" style="padding-bottom:.1rem"><div style="width:1.5rem;height:1.5rem;background:${d.color};flex:none"></div><div class="nm">${title}</div></div>
        <div class="desc">${d.desc}</div>${extra}`;
    }

    bindInspector() {
      const box = $('inspector');
      box.querySelectorAll('[data-branch]').forEach(b => {
        b.onclick = () => {
          const r = this.game.upgrade(this.sel.unit, b.dataset.branch);
          if (r.ok) { this.click(); this.renderInspector(); } else this.toast(r.reason, 'bad');
        };
        b.onmouseenter = () => {
          const t = this.sel && this.sel.unit;
          if (!t) return;
          const s = TD.towerStats(t.type, 2, b.dataset.branch);
          if (t.type === 'interceptor') this.view.showRange(t.x, t.y, s.range, b.dataset.branch === 'suppress' ? '#A99BE8' : TD.ROLE_COLORS.ranged, s.arc * Math.PI / 360, t.dir);
          else if (t.type === 'honeypot') this.view.showRange(t.x, t.y, s.lureR, TD.ROLE_COLORS.lure);
        };
        b.onmouseleave = () => this.showSelectedRange();
      });
      box.querySelectorAll('[data-up]').forEach(b => { b.onclick = () => { const r = this.game.upgrade(this.sel.unit); if (r.ok) { this.click(); this.renderInspector(); } else this.toast(r.reason, 'bad'); }; });
      box.querySelectorAll('[data-skill]').forEach(b => { b.onclick = () => { if (!this.sel) return; const r = this.game.useSkill(this.sel.unit); if (r.ok) this.click(); else this.toast(r.reason, 'bad'); }; });
      box.querySelectorAll('[data-redirect]').forEach(b => { b.onclick = () => { if (this.sel.unit.redirectCd > 0) { this.toast('转向冷却中', 'bad'); return; } this.requestRedirect(this.sel.unit); }; });
      box.querySelectorAll('[data-sell]').forEach(b => {
        b.onclick = () => { this.requestSell(this.sel.unit); };
      });
      box.querySelectorAll('[data-open-book]').forEach(b => { b.onclick = () => { const [tab, id] = b.dataset.openBook.split(':'); this.openHandbook(tab, id); }; });
      this.showSelectedRange();
    }

    showSelectedRange() {
      const s = this.sel;
      if (!s || s.kind !== 'tower' || s.unit.gone) { this.view.hideRange(); return; }
      const t = s.unit, c = TD.ROLE_COLORS[t.def.roleKey];
      if (t.type === 'interceptor') this.view.showRange(t.x, t.y, t.s.range, t.branch === 'suppress' ? '#A99BE8' : c, t.s.arc * Math.PI / 360, t.dir);
      else if (t.type === 'sandbox') this.view.showRange(t.x, t.y, t.s.range, c);
      else if (t.type === 'repair') this.view.showRange(t.x, t.y, t.s.range, c);
      else if (t.type === 'honeypot') this.view.showRange(t.x, t.y, t.s.lureR, c);
      else if (t.type === 'firewall' && t.onNode) this.view.showRange(t.x, t.y, 1.05, c);
      else this.view.hideRange();
    }

    updateInspector() {
      const s = this.sel;
      if (!s) return;
      const box = $('inspector');
      const q = (k) => box.querySelector(`[data-k="${k}"]`);
      if (s.kind === 'tower') {
        const t = s.unit;
        if (t.gone) { this.select(null); return; }
        const key = `${t.id}_${t.level}_${t.branch}`;
        if (this.inspKey !== key) { this.inspKey = key; if (box.dataset.key !== key) { box.dataset.key = key; box.innerHTML = this.towerPanel(t); this.bindInspector(); } }
        q('hp').style.width = Math.max(0, t.hp / t.maxHp * 100) + '%';
        q('sh').style.width = Math.min(100, t.shield / t.maxHp * 100) + '%';
        q('hpt').textContent = `生命 ${Math.ceil(Math.max(0, t.hp))}/${t.maxHp}`;
        q('sht').textContent = t.shield > 0 ? `护盾 ${Math.ceil(t.shield)}` : '';
        const chips = [];
        if (t.ghostT > 0) chips.push(['残影', '#EAC15A']);
        if (t.encT > 0) chips.push([`加密 ${t.encT.toFixed(1)} 秒`, '#B08CF0']);
        if (t.skillT > 0) chips.push([`${t.def.skill.name} ${t.skillT.toFixed(1)} 秒`, TD.ROLE_COLORS[t.def.roleKey]]);
        if (t.s.block) chips.push([`阻挡 ${this.game.blockLoad(t)}/${this.game.blockCap(t)}`, '#EE8A4A']);
        if (t.onNode) chips.push([t.node.engaged ? '交战守点：产出情报' : '隔离节点', '#EC7A66']);
        if (t.healTargets.length) chips.push([`治疗 ${t.healTargets.length} 座`, '#7FDBC0']);
        q('chips').innerHTML = chips.map(c => `<span class="chip" style="color:${c[1]}">${c[0]}</span>`).join('');
        const cd = q('skcd');
        if (cd) {
          const can = this.game.canSkill(t);
          cd.textContent = t.encT > 0 ? '（被加密）' : t.skillCd > 0 ? `（${Math.ceil(t.skillCd)} 秒）` : '（就绪）';
          const b = box.querySelector('[data-skill]');
          if (b) b.classList.toggle('off', !can.ok);
        }
        const rd = q('rdcd');
        if (rd) rd.textContent = t.redirectCd > 0 ? `（${Math.ceil(t.redirectCd)} 秒）` : '';
        const g = this.game;
        box.querySelectorAll('[data-branch]').forEach(b => { const c = t.def.branches[b.dataset.branch]; b.classList.toggle('off', g.compute < c.cost || g.intel < c.intel); });
        box.querySelectorAll('[data-up]').forEach(b => { b.classList.toggle('off', g.compute < t.def.lv2.cost); });
      } else if (s.kind === 'enemy') {
        const e = s.unit;
        if (e.dead) { this.select(null); return; }
        q('hp').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
        q('sh').style.width = Math.min(100, e.shield / e.maxHp * 100) + '%';
        q('hpt').textContent = `生命 ${Math.ceil(Math.max(0, e.hp))}/${Math.round(e.maxHp)}`;
        q('sht').textContent = e.shield > 0 ? `护盾 ${Math.ceil(e.shield)}` : '';
        const chips = [];
        if (e.stealth && !e.revealed && e.revealT <= 0) chips.push(['未显形', '#A8B4BC']);
        if (e.revealT > 0 || (e.revealed && e.def.stealth)) chips.push(['已显形', '#F0D878']);
        if (e.blockedBy) chips.push([`被${e.blockedBy.def.name}阻挡`, '#EE8A4A']);
        if (e.mode === 'siege') chips.push([`冲击${e.siegeNode ? e.siegeNode.name : '节点'}`, '#EE6A2E']);
        if (e.mode === 'lure') chips.push(['被蜜罐吸引', '#EAC15A']);
        if (e.trapT > 0) chips.push([`被困 ${e.trapT.toFixed(1)} 秒`, '#EAC15A']);
        if (e.exposedT > 0) chips.push(['暴露 +40%', '#D29A4A']);
        if (e.supT > 0) chips.push(['被压制', '#A99BE8']);
        if (e.armor && e.armor < 1) chips.push(['护甲强化', '#D9A441']);
        if (e.def.phases) chips.push([`阶段：${e.def.phases[e.phase].name}`, '#E8C66E']);
        if (e.fly) chips.push(['飞行', '#8FD8F0']);
        q('chips').innerHTML = chips.map(c => `<span class="chip" style="color:${c[1]}">${c[0]}</span>`).join('');
      } else {
        const st = q('nodest');
        if (st) {
          const nd = this.game.nodeByIdx[this.game.idx(s.x, s.y)];
          st.textContent = nd.tower ? `已隔离（${nd.tower.def.name}）。${nd.engaged ? '交战中，持续产出情报。' : ''}` : nd.isolator ? `应急隔离中，还剩 ${Math.ceil(nd.isolator.t)} 秒，不产生情报。` : this.game.blocked[nd.idx] ? '被 Boss 封锁，当前不可通行。' : nd.lockT > 0 ? `直通，再隔离间隔还剩 ${Math.ceil(nd.lockT)} 秒${nd.flap ? '（路由抖动抑制中）' : ''}。` : '直通，可以隔离。';
        }
      }
    }

    // ────────── HUD 更新 ──────────
    enterBattle(game) {
      const d = game.def;
      $('b-map').textContent = d.name;
      $('b-sub').textContent = d.en;
      const acc = { intranet: '#8FD3B8', backbone: '#D9B45B', airgap: '#E8884A' }[d.id];
      document.documentElement.style.setProperty('--accent', acc);
      this.showScreen('hud');
      this.logCount = 0;
      this.lastLog = null;
      $('log-lines').innerHTML = '';
      $('threatcards').innerHTML = '';
      $('bossbar').classList.add('hide');
      this.select(null);
      this.fcKey = null; this.rtKey = null;
      this.lastVals = {};
      this.renderRouteTable(true);
      const ins = this.computeInsets();
      this.view.insets = ins;
      this.view.fitDefault(false);
      this.applyThumbs();
    }

    computeInsets() {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return { l: rem * 17, r: rem * 0.8, t: rem * 4.2, b: rem * 8.9 };
    }

    renderRouteTable(force) {
      const g = this.game;
      const key = g.map.entrances.map(en => `${en.id}${g.routes[en.id].exit}${g.routes[en.id].len}`).join('|');
      if (key === this.rtKey && !force) return;
      this.rtKey = key;
      $('rt-body').innerHTML = g.map.entrances.map(en => {
        const r = g.routes[en.id];
        return `<div class="row"><span class="dot" style="background:${TD.ENTRANCE_COLORS[en.id]}"></span><span>${en.id} ${en.name}</span><span class="exit">→<b style="color:${TD.EXIT_COLORS[r.exit]}"> ${r.exit}</b> ${r.len} 跳</span></div>`;
      }).join('');
    }

    renderWavePips() {
      const g = this.game, box = $('wavepips');
      if (box.dataset.map !== g.mapId) {
        box.dataset.map = g.mapId;
        box.innerHTML = g.def.waves.map((w, i) => `<i data-w="${i}" class="${w.boss ? 'boss' : w.surge ? 'surge' : ''}" title="第 ${i + 1} 波 · ${w.label}${w.boss ? '（Boss）' : w.surge ? '（洪峰）' : ''}"></i>`).join('');
      }
      const cur = g.waveIdx;
      if (box.dataset.cur !== String(cur)) {
        box.dataset.cur = String(cur);
        box.querySelectorAll('i').forEach(e => {
          const n = +e.dataset.w;
          e.classList.toggle('done', n < cur);
          e.classList.toggle('now', n === cur);
          e.classList.toggle('next', n === cur + 1);
        });
      }
    }

    renderForecast() {
      const g = this.game;
      this.renderWavePips();
      const nextIdx = g.waveIdx + 1;
      const fc = g.forecast(nextIdx);
      const key = `${nextIdx}_${g.waveState}`;
      if (key !== this.fcKey) {
        this.fcKey = key;
        const body = $('fc-body');
        if (!fc) {
          body.innerHTML = `<div class="fc-head"><span class="wname">最后一波进行中</span></div><div style="font-size:.9rem;color:#D4CEC0">肃清场上威胁即可结束事件。</div>`;
        } else {
          const tag = fc.boss ? `<span class="fc-tag" style="color:#EC6450">BOSS</span>` : fc.surge ? `<span class="fc-tag" style="color:#EE8E50">洪峰</span>` : '';
          let rows = '';
          for (const en of g.map.entrances) {
            const row = fc.byEnt[en.id];
            if (!row) continue;
            rows += `<div class="fc-ent" style="border-color:${TD.ENTRANCE_COLORS[en.id]}"><div class="nm"><span>${en.id} ${en.name}</span><span class="rt" data-rt="${en.id}"></span></div><div class="fc-list">`;
            for (const t in row) {
              const nw = !g.seenThreats[t];
              const def = TD.ENEMIES[t] || TD.BOSSES[t];
              rows += `<span class="fc-it ${nw ? 'new' : ''}" data-threat="${t}" title="${def.name}${nw ? '（首次出现）' : ''}"><img src="${TD.thumbs ? TD.thumbs[t] : ''}">×${row[t]}</span>`;
            }
            rows += `</div></div>`;
          }
          body.innerHTML = `<div class="fc-head"><span class="wname">第 ${nextIdx + 1} 波 · ${fc.label}${tag}</span><span class="tt" id="fc-timer"></span></div>${rows}<button class="btn" id="btn-next"></button>`;
          body.querySelector('#btn-next').onclick = () => { if (this.game.callNext()) this.click(); };
          body.querySelectorAll('[data-threat]').forEach(e => {
            e.onmouseenter = () => {
              const d = TD.ENEMIES[e.dataset.threat] || TD.BOSSES[e.dataset.threat];
              const r = e.getBoundingClientRect();
              this.showTip(`<div class="h" style="color:#EE9C84">${d.name}</div><div class="m">${d.tag}</div>${d.desc}`, r.right + 170, r.top, 'below');
            };
            e.onmouseleave = () => this.hideTip();
          });
        }
      }
      const led = $('fc-led');
      led.className = 'led' + (fc && (fc.boss || fc.surge) ? ' bad' : g.waveState === 'prep' && g.prepT < 8 ? ' warn' : '');
      const tm = $('fc-timer');
      if (tm) tm.textContent = g.waveState === 'prep' ? `${Math.ceil(g.prepT)} 秒后抵达` : '上一波投放中';
      const bn = $('btn-next');
      if (bn) {
        if (g.waveState === 'prep') { bn.textContent = `提前调度 · 算力 +${Math.floor(g.prepT * 1.5)}（N）`; bn.classList.remove('off'); }
        else { bn.textContent = '等待当前波次投放完成'; bn.classList.add('off'); }
      }
      if (fc) for (const en of g.map.entrances) {
        const e = this.root.querySelector(`[data-rt="${en.id}"]`);
        if (e) { const r = g.routes[en.id]; e.textContent = `→ ${r.exit} ${r.len} 跳`; }
      }
    }

    update(dt) {
      const g = this.game;
      if (!g) return;
      const crate = `+${TD.RULES.computeRate}/秒`;
      if (this.lastVals.crate !== crate) { this.lastVals.crate = crate; $('v-crate').textContent = crate; }
      const holding = g.nodes.filter(n => n.engaged).length;
      const irate = holding ? `守点 ×${holding}` : '';
      if (this.lastVals.irate !== irate) { this.lastVals.irate = irate; $('v-irate').textContent = irate; }
      this.setVal('v-compute', Math.floor(g.compute), 's-compute');
      this.setVal('v-intel', Math.floor(g.intel), 's-intel');
      const iv = g.integrity;
      if (this.lastVals.int !== iv) {
        if (this.lastVals.int != null && iv < this.lastVals.int) { const e = $('integrity'); e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit'); }
        this.lastVals.int = iv;
        $('v-int').textContent = `${iv}/${TD.RULES.startIntegrity}`;
        $('b-int').style.width = (iv / TD.RULES.startIntegrity * 100) + '%';
      }
      const wv = `${Math.max(0, g.waveIdx + 1)}/${g.waveTotal}`;
      if (this.lastVals.wv !== wv) { this.lastVals.wv = wv; $('v-wave').textContent = wv; }
      const cur = g.currentWaveDef();
      const wl = `波次${cur ? ' · ' + cur.label : ' · 准备中'} · 场上 ${g.enemies.length}`;
      if (this.lastVals.wl !== wl) { this.lastVals.wl = wl; $('v-wlabel').textContent = wl; }
      $('pausetag').style.display = this.app.paused && !this.app.modalPause ? 'block' : 'none';
      this.updateGuide();
      $('b-pause').innerHTML = this.app.paused ? ICON.play : ICON.pause;
      $('b-pause').classList.toggle('on', this.app.paused);
      this.root.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', +b.dataset.sp === this.app.speed && !this.app.paused));
      this.inspT -= dt;
      if (this.inspT <= 0) {
        this.inspT = 0.12;
        this.updateCards();
        this.updateInspector();
        this.renderForecast();
        this.renderRouteTable();
        this.flushLogs();
        this.updateBossBar();
      }
    }

    setVal(id, v, pid) {
      if (this.lastVals[id] === v) return;
      const prev = this.lastVals[id];
      this.lastVals[id] = v;
      $(id).textContent = v;
      if (prev != null && v > prev + 1) { const e = $(pid); e.classList.remove('gain'); void e.offsetWidth; e.classList.add('gain'); }
    }

    updateCards() {
      const g = this.game;
      for (const id of TD.TOWER_ORDER) {
        const t = TD.TOWERS[id];
        this.cards['t_' + id].classList.toggle('lack', g.compute < t.cost);
      }
      for (const id of TD.ITEM_ORDER) {
        const it = TD.ITEMS[id], c = this.cards['i_' + id];
        const has = it.res === 'intel' ? g.intel >= it.cost : g.compute >= it.cost;
        const cd = g.itemCd[id];
        c.classList.toggle('lack', !has || cd > 0);
        const m = c.querySelector('.cdmask');
        m.style.height = cd > 0 ? (cd / it.cd * 100) + '%' : '0';
        m.textContent = cd > 0 ? Math.ceil(cd) : '';
      }
    }

    flushLogs() {
      const g = this.game;
      const box = $('log-lines');
      const logs = g.logs;
      const lastT = this.lastLog || null;
      let start = lastT ? logs.indexOf(lastT) + 1 : 0;
      if (start >= logs.length) return;
      for (let i = start; i < logs.length; i++) {
        const l = logs[i];
        this.lastLog = l;
        const prev = box.lastChild;
        if (prev && prev.dataset.text === l.text) {
          prev.dataset.n = (+prev.dataset.n || 1) + 1;
          prev.innerHTML = `<i>${fmtT(l.t)}</i>${l.text} <b>×${prev.dataset.n}</b>`;
          continue;
        }
        const d = document.createElement('div');
        d.className = 'l ' + l.level;
        d.dataset.text = l.text;
        d.innerHTML = `<i>${fmtT(l.t)}</i>${l.text}`;
        box.appendChild(d);
      }
      while (box.children.length > 16) box.removeChild(box.firstChild);
    }

    updateBossBar() {
      const g = this.game;
      const bar = $('bossbar');
      if (g.boss && !g.boss.dead) {
        const e = g.boss;
        bar.classList.remove('hide');
        $('boss-name').textContent = e.def.name;
        $('boss-title').textContent = e.def.title;
        $('boss-phase').textContent = `阶段：${e.def.phases[e.phase].name}${e.type === 'zheying' && e.phase === 0 ? (e.revealT > 0 ? '（已检测）' : '（未检测，需沙箱）') : ''}`;
        $('boss-hp').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
        const bb = $('boss-bb');
        if (bb.dataset.b !== e.type) {
          bb.dataset.b = e.type;
          bb.querySelectorAll('.tick').forEach(t => t.remove());
          for (const p of e.def.phases) if (p.at) { const t = document.createElement('div'); t.className = 'tick'; t.style.left = (p.at * 100) + '%'; bb.appendChild(t); }
        }
      } else bar.classList.add('hide');
    }

    toast(text, level) {
      const box = $('toasts');
      const d = document.createElement('div');
      d.className = 'toast ' + (level || '');
      d.textContent = text;
      box.appendChild(d);
      while (box.children.length > 3) box.removeChild(box.firstChild);
      setTimeout(() => d.remove(), 2600);
      if (level === 'bad') TD.Audio.play('uiDeny');
    }

    banner(big, small, color, dur) {
      const b = $('banner');
      b.innerHTML = '';
      const d = el(`<div class="bannerbox" style="--bc:${color || '#fff'}"><div class="big">${big}</div><div class="small">${small || ''}</div></div>`);
      b.appendChild(d);
      setTimeout(() => { if (d.parentNode) d.remove(); }, (dur || 3) * 1000);
    }

    threatCard(type) {
      const d = TD.ENEMIES[type] || TD.BOSSES[type];
      const box = $('threatcards');
      const c = el(`<div class="threat"><img src="${TD.thumbs ? TD.thumbs[type] : ''}"><div><div class="t">新威胁：${d.name} <span style="font-weight:400;font-size:.76rem">${d.tag}</span></div><div class="d">${d.counter}</div></div></div>`);
      c.onclick = () => { this.openHandbook('threat', type); c.remove(); };
      box.appendChild(c);
      while (box.children.length > 2) box.removeChild(box.firstChild);
      setTimeout(() => c.remove(), 8000);
    }

    onEvent(ev) {
      switch (ev.type) {
        case 'newThreat': if (ev.first && !this.app.demo && !TD.BOSSES[ev.threat]) this.threatCard(ev.threat); break;
        case 'waveStart': {
          const w = ev.def;
          if (w.boss) break;
          if (w.surge) this.banner('洪 峰', `三入口同时大量出兵 · 第 ${ev.index + 1} 波「${w.label}」`, '#EE7A3C', 3.2);
          else this.toast(`第 ${ev.index + 1} 波 · ${w.label}`, '');
          break;
        }
        case 'bossSpawn': {
          const e = ev.enemy;
          this.banner(e.def.name, `高危告警：${e.def.title} · 改变地形前会先预警`, '#E25A4E', 3.6);
          if (!this.app.demo) this.threatCard(e.type);
          break;
        }
        case 'bossPhase': this.banner(ev.name, `${ev.enemy.def.name}进入新阶段：${ev.enemy.def.phases[ev.phase].desc}`, '#E8C66E', 2.8); break;
        case 'bossWarn': this.toast(ev.text, 'warn'); break;
        case 'routeChange': {
          const txt = ev.changes.map(c => `${c.ent}→${c.newExit}`).join('、');
          this.toast(`路由收敛：${txt}`, 'warn');
          break;
        }
        case 'nodeOpen': this.toast(`${ev.node.name}旁路直通：${ev.reason}`, ev.reason.includes('摧毁') || ev.reason.includes('冲毁') ? 'bad' : ''); break;
        case 'towerDestroyed': if (ev.tower.onNode) this.toast(`${ev.tower.def.name}被摧毁，隔离解除`, 'bad'); break;
        case 'earlyBonus': this.toast(`提前调度：算力 +${ev.bonus}`, ''); break;
        case 'reject': if (ev.reason && !this.drag) this.toast(ev.reason, 'bad'); break;
        case 'victory': case 'defeat': if (!this.app.demo) this.app.scheduleReport(); break;
      }
    }

    // ────────── 新手引导：只在玩家还没做过对应操作时出现 ──────────
    startGuide(game) {
      this.guide = { game, step: 0, shown: null };
      let seen = {};
      try { seen = JSON.parse(localStorage.getItem('td_guide') || '{}'); } catch (e) { /* 忽略 */ }
      this.guideSeen = seen;
      this.setAim('把下方卡片拖到地图上部署。中键环绕 · Shift+中键平移 · 滚轮缩放');
      setTimeout(() => { if (this.game === game && !this.drag && !this.pending) this.setAim(null); }, 7000);
    }

    updateGuide() {
      const gd = this.guide, box = $('guide');
      const g = this.game;
      if (!gd || gd.game !== g || this.app.demo) { box.style.display = 'none'; return; }
      const steps = [
        { id: 'tower', done: () => g.towers.some(t => t.cat === 'platform'), html: '<b>第一步：</b>把<b>拦截器</b>拖到路线旁的设备平台，松开后用鼠标设定朝向，左键确认。' },
        { id: 'block', done: () => g.towers.some(t => t.cat === 'link'), html: '<b>第二步：</b>把<b>防火墙</b>或<b>蜜罐</b>放到路线上拦住敌人，让远程塔有时间开火。阻挡不会截断道路。' },
        { id: 'node', done: () => g.stats.isolations > 0, html: '<b>改道：</b>把<b>网闸</b>拖到绿色的交换节点上，先看白色虚线预览，再确认隔离。把路线拖长或并流，代价是隔离点会被攻击。', when: () => g.waveIdx >= 0 },
      ];
      const s = steps.find(st => !this.guideSeen[st.id] && !st.done() && (!st.when || st.when()));
      for (const st of steps) if (st.done() && !this.guideSeen[st.id]) { this.guideSeen[st.id] = 1; try { localStorage.setItem('td_guide', JSON.stringify(this.guideSeen)); } catch (e) { /* 忽略 */ } }
      if (!s || this.drag || this.pending) { box.style.display = 'none'; return; }
      if (gd.shown !== s.id) {
        gd.shown = s.id;
        box.innerHTML = `<span class="x" id="guide-x">关闭</span>${s.html}`;
        box.querySelector('#guide-x').onclick = () => { for (const st of steps) this.guideSeen[st.id] = 1; try { localStorage.setItem('td_guide', JSON.stringify(this.guideSeen)); } catch (e) { /* 忽略 */ } box.style.display = 'none'; };
      }
      box.style.display = 'block';
    }

    // ────────── 模态窗 ──────────
    openModal(html, kind, noPause) {
      const m = $('modal');
      m.innerHTML = html;
      m.classList.add('show');
      this.modalKind = kind;
      this.app.modalPause = !noPause;
      this.cancelInteraction();
      this.hideTip();
    }
    closeModal() {
      TD.Audio.play('uiClose');
      if (this.viewer) this.viewer.stop();
      $('modal').classList.remove('show');
      $('modal').innerHTML = '';
      this.modalKind = null;
      this.app.modalPause = false;
    }

    openPauseMenu() {
      TD.Audio.play('uiOpen');
      const g = this.game;
      this.openModal(`<div class="window small panel menuwin"><div class="wintitle"><span class="led warn"></span><b>守护进程菜单</b><span class="path">战斗已暂停</span></div><div class="inner">
        <button class="btn primary" id="pm-resume">继续值守</button>
        <button class="btn" id="pm-book">图鉴</button>
        <button class="btn" id="pm-help">值守手册（规则与操作）</button>
        <button class="btn" id="pm-set">系统设置（音量 / 画质）</button>
        <button class="btn" id="pm-restart">重开本图</button>
        <button class="btn danger" id="pm-levels">返回关卡选择</button>
      </div></div>`, 'pause');
      $('pm-resume').onclick = () => this.closeModal();
      $('pm-book').onclick = () => this.openHandbook();
      $('pm-help').onclick = () => this.openHandbook('rules');
      $('pm-set').onclick = () => this.openSettings();
      $('pm-restart').onclick = () => { this.closeModal(); this.app.restart(); };
      $('pm-levels').onclick = () => { this.closeModal(); this.app.toLevels(); };
    }

    openSettings() {
      const v = TD.Audio.volume;
      this.openModal(`<div class="window small panel"><div class="wintitle"><span class="led"></span><b>系统设置</b><span class="path">/etc/daemon.conf</span><button class="btn close" id="st-x">关闭</button></div>
        <div style="padding:.7rem 0">
        <div class="setrow"><label>主音量</label><input type="range" min="0" max="100" value="${v.master * 100}" id="st-m"><span class="v" id="st-mv">${Math.round(v.master * 100)}</span></div>
        <div class="setrow"><label>音乐环境</label><input type="range" min="0" max="100" value="${v.music * 100}" id="st-u"><span class="v" id="st-uv">${Math.round(v.music * 100)}</span></div>
        <div class="setrow"><label>音效</label><input type="range" min="0" max="100" value="${v.sfx * 100}" id="st-s"><span class="v" id="st-sv">${Math.round(v.sfx * 100)}</span></div>
        <div class="setrow"><label>静音</label><button class="btn" id="st-mute">${TD.Audio.muted ? '已静音，点击恢复' : '点击静音'}</button></div>
        <div class="setrow"><label>渲染缩放</label><input type="range" min="60" max="150" step="10" value="${Math.round(this.view.pixelRatio * 100)}" id="st-r"><span class="v" id="st-rv">${Math.round(this.view.pixelRatio * 100)}%</span></div>
        <div class="setrow" style="color:var(--dim);font-size:.84rem">帧率过低时渲染缩放会自动下调。</div>
        </div></div>`, 'settings');
      const bind = (id, key, vid) => { const e = $(id); e.oninput = () => { TD.Audio.setVolume(key, e.value / 100); $(vid).textContent = e.value; }; };
      bind('st-m', 'master', 'st-mv'); bind('st-u', 'music', 'st-uv'); bind('st-s', 'sfx', 'st-sv');
      $('st-mute').onclick = () => { this.toggleMute(); $('st-mute').textContent = TD.Audio.muted ? '已静音，点击恢复' : '点击静音'; };
      $('st-r').oninput = (e) => { this.view.pixelRatio = e.target.value / 100; $('st-rv').textContent = e.target.value + '%'; this.view.resize(true); };
      $('st-x').onclick = () => this.closeModal();
    }

    openDemoMenu() {
      const d = TD.Demo.list;
      this.openModal(`<div class="window panel" style="height:auto;width:min(80vw,62rem)"><div class="wintitle"><span class="led"></span><b>实战演示</b><span class="path">/usr/share/replay</span><button class="btn close" id="dm-x">关闭</button></div>
        <div style="padding:1rem;display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem">
        ${d.map((x, i) => `<div class="panel" style="padding:.8rem;display:flex;flex-direction:column;gap:.4rem"><div class="mono" style="color:var(--accent);font-size:.8rem">REPLAY-0${i + 1} · ${TD.MAPS[x.map].name}</div><div style="font-size:1.34rem;font-weight:900">${x.title}</div><div style="font-size:.92rem;line-height:1.5;color:#D4CEC0;flex:1">${x.desc}</div><button class="btn primary" data-demo="${i}">开始演示</button></div>`).join('')}
        </div></div>`, 'demo', true);
      $('dm-x').onclick = () => this.closeModal();
      $('modal').querySelectorAll('[data-demo]').forEach(b => { b.onclick = () => { this.closeModal(); TD.Demo.start(+b.dataset.demo); }; });
    }

    // ────────── 图鉴 ──────────
    openHandbook(tab, id) {
      TD.Audio.play('uiOpen');
      this.openModal(`<div class="window panel"><div class="wintitle"><span class="led"></span><b>守护进程图鉴</b><span class="path">/usr/share/man</span><button class="btn close" id="hb-x">关闭（Esc）</button></div>
        <div class="tabs" id="hb-tabs"></div><div class="hb-body" id="hb-body"></div></div>`, 'book');
      $('hb-x').onclick = () => this.closeModal();
      const tabs = [['device', '设备手册'], ['threat', '威胁档案'], ['item', '道具与状态'], ['terrain', '地形与路由'], ['maps', '战区档案'], ['rules', '值守手册']];
      const bar = $('hb-tabs');
      bar.innerHTML = tabs.map(t => `<div class="tab" data-tab="${t[0]}">${t[1]}</div>`).join('');
      bar.querySelectorAll('.tab').forEach(t => { t.onclick = () => { this.click(); this.hbTab(t.dataset.tab); }; });
      this.hbTab(tab || 'device', id);
    }

    hbTab(tab, id) {
      $('hb-tabs').querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
      const body = $('hb-body');
      if (tab === 'device' || tab === 'threat') {
        const list = tab === 'device' ? TD.TOWER_ORDER.map(k => TD.TOWERS[k]) : TD.ENEMY_ORDER.map(k => TD.ENEMIES[k]).concat(TD.BOSS_ORDER.map(k => TD.BOSSES[k]));
        body.innerHTML = `<div class="hb-list">${list.map(x => `<div class="hb-it" data-id="${x.id}"><img src="${TD.thumbs ? TD.thumbs[tab === 'device' ? x.id + '_1' : x.id] : ''}"><div>${x.name}<small>${tab === 'device' ? x.role : x.tag}</small></div></div>`).join('')}</div>
          <div class="hb-main"><div class="hb-view" id="hb-view"><div class="note">模型实时演示 · 自动循环攻击与受击动作</div></div><div class="hb-text" id="hb-text"></div></div>`;
        body.querySelectorAll('.hb-it').forEach(i => { i.onclick = () => { this.click(); this.hbEntry(tab, i.dataset.id); }; });
        this.hbEntry(tab, id || list[0].id);
      } else if (tab === 'item') {
        body.innerHTML = `<div class="hb-wide"><h4>道具</h4>${TD.ITEM_ORDER.map(k => { const it = TD.ITEMS[k]; const col = { isolator: '#E9A83E', downgrade: '#E8A868', backup: '#8FE0C0' }[k]; return `<div class="stcard"><div class="ic2" style="color:${col}">${k === 'isolator' ? `<img src="${TD.thumbs ? TD.thumbs.isolator : ''}" style="width:2.3rem">` : `<div style="width:1.7rem;height:1.7rem">${ICON[k]}</div>`}</div><div><b>${it.name}</b> <span class="mono" style="color:var(--dim)">${it.res === 'intel' ? '情报' : '算力'} ${it.cost} · 间隔 ${it.cd} 秒 · 快捷键 ${it.key}</span><div>${it.desc}</div></div></div>`; }).join('')}
          <h4>状态</h4>${TD.STATUSES.map(s => `<div class="stcard"><div class="ic2" style="color:${s.color}">${s.icon}</div><div><b style="color:${s.color}">${s.name}</b><div>${s.desc}</div></div></div>`).join('')}</div>`;
      } else if (tab === 'maps') {
        const cur = id || (this.game ? this.game.mapId : TD.MAP_ORDER[0]);
        body.innerHTML = `<div class="hb-list">${TD.MAP_ORDER.map(k => `<div class="hb-it" data-id="${k}"><div style="padding:.2rem .3rem">${TD.MAPS[k].name}<small>${TD.MAPS[k].kind}</small></div></div>`).join('')}</div><div class="hb-wide" id="hb-maptext"></div>`;
        body.querySelectorAll('.hb-it').forEach(i => { i.onclick = () => { this.click(); this.hbMap(i.dataset.id); }; });
        this.hbMap(cur);
      } else if (tab === 'terrain') {
        body.innerHTML = `<div class="hb-wide"><h4>地形</h4>${TD.TERRAIN.map(s => `<div class="stcard"><div class="ic2" style="background:${s.color};border-color:${s.color}"></div><div><b>${s.name}</b><div>${s.desc}</div></div></div>`).join('')}
          <h4>路由规则</h4><ul>
          <li><b>隔离</b>：防火墙、网闸或应急隔离器占据节点时，这一格不能通行。塔被摧毁或撤下、隔离器失效后，设备旁路直通。</li>
          <li><b>收敛</b>：通行或通行速度变化时，各入口路线同步更新；场上地面敌人从当前位置按新路线转向，可能掉头，不会瞬移或穿墙。</li>
          <li><b>寻路</b>：敌人总选代价最低的路通向最近的出口。旧链路和协议降级区的代价是普通链路的 ${(1 / TD.RULES.legacySpeed).toFixed(1)} 倍。</li>
          <li><b>保持连通</b>：会让某个入口或场上地面敌人无路可走的操作不能完成，也不消耗资源，并在地图上标出会被封死的位置。Boss 的封锁会改选不会封死的位置。</li>
          <li><b>再隔离间隔</b>：节点恢复直通后 ${TD.RULES.relockBase} 秒内不能再隔离。${TD.RULES.flapWindow} 秒内反复切换同一节点会触发路由抖动抑制，每次再加 ${TD.RULES.relockStep} 秒。</li>
          <li><b>阻挡不是隔离</b>：链路上的防火墙和蜜罐只让敌人停下交战，不截断道路，超过容量的敌人继续前进。</li></ul>
          <h4>路线颜色</h4><div>${Object.keys(TD.ENTRANCE_COLORS).map(k => `<span class="chip" style="color:${TD.ENTRANCE_COLORS[k]}">入口 ${k}</span> `).join('')}${Object.keys(TD.EXIT_COLORS).map(k => `<span class="chip" style="color:${TD.EXIT_COLORS[k]}">出口 ${k}（路线边线）</span> `).join('')} <span class="chip" style="color:#fff">白色虚线 = 预览路线</span> <span class="chip" style="color:#EC8A70">红色虚线 = 刚被替换的旧路线</span></div></div>`;
      } else {
        body.innerHTML = `<div class="hb-wide">
          <h4>值守目标</h4>守住中枢完整度（${TD.RULES.startIntegrity} 点），撑过全部波次。敌人进入出口时完整度下降，归零即失败。
          <h4>镜头（与 Blender 一致）</h4><ul><li><kbd>中键拖动</kbd> 环绕 · <kbd>Shift + 中键拖动</kbd> 平移 · <kbd>滚轮</kbd> 缩放 · <kbd>H</kbd> 回到默认视角</li><li>左键只用于点选和拖放部署。</li></ul>
          <h4>部署</h4><ul><li>把卡片拖到地图上；也可以点击卡片或按数字键选取，再左键点击放置。</li><li>拖动时预览作用范围。拦截器松开后再移动鼠标设定朝向。</li><li>涉及改变路线的操作都会先弹出预览和确认：白色虚线是新路线。</li><li><kbd>右键</kbd> 或 <kbd>Esc</kbd> 取消。</li></ul>
          <h4>快捷键</h4><ul><li><kbd>1-6</kbd> 选塔 · <kbd>Q W E</kbd> 选道具 · <kbd>R</kbd> 选中塔释放技能 · <kbd>U</kbd> 升级 · <kbd>X</kbd> 撤下</li><li><kbd>空格</kbd> 暂停 · <kbd>F</kbd> 调速 · <kbd>N</kbd> 提前调度下一波 · <kbd>B</kbd> 图鉴 · <kbd>M</kbd> 静音 · <kbd>Esc</kbd> 菜单</li></ul>
          <h4>资源（不能互换）</h4><ul><li><b style="color:var(--compute)">算力</b>：随时间增长（每秒 ${TD.RULES.computeRate}），消灭敌人回收；用于塔、升级和备份还原。撤下返还 ${Math.round(TD.RULES.sellRefund * 100)}%，被摧毁不退。</li><li><b style="color:var(--intel)">情报</b>：来自波次开始、消灭重点威胁、交战中持续守住隔离节点（附近 ${TD.RULES.holdRadius} 格有地面敌人时每 ${TD.RULES.holdEvery} 秒 +1）；用于隔离节点、选择升级分支和情报道具。应急隔离器不产生情报。</li></ul>
          <h4>取舍思路</h4><ul><li>路线变长给了更多开火时间，但可能离开你的火力覆盖。</li><li>隔离点是洪泛团和 Boss 的目标：守住它要花治疗和技能，放弃它可能白白浪费情报。</li><li>同一个节点对不同入口的收益不同：先看预览，再决定要不要让两路流量挤到一起。</li></ul>
        </div>`;
      }
    }

    // 战区档案：逐个节点列出“隔离后谁改道、改去哪、代价多少”，用的是真实路由计算
    hbMap(id) {
      $('hb-body').querySelectorAll('.hb-it').forEach(i => i.classList.toggle('on', i.dataset.id === id));
      const d = TD.MAPS[id];
      const g = new TD.Game(id);
      const rows = g.nodes.map(nd => {
        const pv = g.preview({ block: [nd.idx] });
        const cells = pv.changes.map(c => {
          const delta = c.newLen - c.oldLen;
          return `<span class="chip" style="color:${TD.ENTRANCE_COLORS[c.ent]}">${c.ent} → ${c.newExit}${c.newExit !== c.oldExit ? '（换出口）' : ''} ${delta >= 0 ? '+' : ''}${delta} 跳</span>`;
        }).join(' ');
        return `<tr><td style="white-space:nowrap"><b>${nd.name}</b></td><td>${cells || '—'}</td></tr>`;
      }).join('');
      const defaults = g.map.entrances.map(en => { const r = g.routes[en.id]; return `<span class="chip" style="color:${TD.ENTRANCE_COLORS[en.id]}">${en.id} ${en.name} → ${r.exit} ${exName(g, r.exit)} · ${r.len} 跳</span>`; }).join(' ');
      const waves = d.waves.map((w, i) => `<span class="chip" style="color:${w.boss ? '#EC6450' : w.surge ? '#EE8E50' : '#A8A294'}">${i + 1}. ${w.label}</span>`).join(' ');
      $('hb-maptext').innerHTML = `<div style="display:flex;gap:1rem;align-items:flex-start"><canvas id="hb-mapcv" style="width:26rem;height:15.6rem;flex:none;border:1px solid var(--line2)"></canvas><div>
          <h3 style="margin:0;font-size:1.6rem">${d.name} <span class="mono" style="font-size:.86rem;color:var(--dim)">${d.en}</span></h3>
          <div style="color:var(--accent)">${d.kind} · ${d.waves.length} 波 · Boss ${TD.BOSSES[d.waves[d.waves.length - 1].boss].name}</div>
          <p style="margin:.4rem 0">${d.summary}</p><p style="margin:.4rem 0;color:var(--accent2)">${d.doctrine}</p></div></div>
        <h4>默认路由</h4><div>${defaults}</div>
        <h4>单独隔离每个节点的效果（其他节点直通时）</h4>
        <table style="width:100%;border-collapse:collapse;font-size:.94rem">${rows}</table>
        <h4>波次</h4><div>${waves}</div>`;
      this.drawSchematic($('hb-mapcv'), id);
    }

    hbEntry(tab, id) {
      $('hb-body').querySelectorAll('.hb-it').forEach(i => i.classList.toggle('on', i.dataset.id === id));
      const text = $('hb-text');
      let html = '';
      if (tab === 'device') {
        const t = TD.TOWERS[id];
        const col = TD.ROLE_COLORS[t.roleKey];
        const onField = this.game ? this.game.towers.filter(x => x.type === id && !x.ghostT) : [];
        const lvBox = (lv, br, title, desc, cost) => {
          const key = `${id}_${lv}${br ? '_' + br : ''}`;
          const stats = TD.towerDescribe(id, lv, br);
          const count = onField.filter(x => x.level === lv && x.branch === (br || null)).length;
          return `<div class="lv"><img src="${TD.thumbs ? TD.thumbs[key] : ''}"><b>${title}</b> ${cost ? `<span class="mono" style="color:var(--dim);font-size:.82rem">${cost}</span>` : ''}${this.game ? `<div class="mono" style="color:var(--accent);font-size:.8rem">场上 ${count} 座</div>` : ''}<div style="font-size:.86rem;color:#D4CEC0">${desc || ''}</div><table>${stats.map(r => `<tr><th>${r[0]}</th><td class="mono">${r[1]}</td></tr>`).join('')}</table></div>`;
        };
        let levels = lvBox(1, null, 'Lv.1 基础型', t.brief, `算力 ${t.cost}`);
        if (t.lv2) levels += lvBox(2, null, `Lv.2 ${t.lv2.title}`, t.lv2.desc, `算力 ${t.lv2.cost}`);
        if (t.branches) for (const k in t.branches) { const b = t.branches[k]; levels += lvBox(2, k, `Lv.2 ${b.title}`, b.desc, `算力 ${b.cost} · 情报 ${b.intel}`); }
        html = `<h3 style="color:${col}">${t.name}</h3><div class="tagl">${t.role} · 部署于${t.place.map(p => ({ link: '链路', node: '节点', platform: '平台' }[p])).join(' / ')}${t.nodeIntel ? ` · 上节点消耗情报 ${t.nodeIntel}` : ''}${t.immuneEncrypt ? ' · 免疫加密' : ''}</div>
          <div>${t.brief}</div>
          <h4>主动技能：${t.skill.name}（冷却 ${t.skill.cd} 秒）</h4><div>${t.skill.desc}</div>
          <h4>等级与分支</h4><div class="lvbox">${levels}</div>`;
        if (this.viewer) this.viewer.show('tower', id, 1, null);
      } else {
        const e = TD.ENEMIES[id] || TD.BOSSES[id];
        const kills = this.game ? (this.game.stats.kills[id] || 0) : null;
        html = `<h3 style="color:#EE9C84">${e.name}${e.title ? ` · ${e.title}` : ''}</h3><div class="tagl">${e.tag}</div><div>${e.desc}</div><h4>对策</h4><div>${e.counter}</div>
          <h4>数据</h4><table><tr><th>基础生命</th><td class="mono">${e.hp}</td></tr><tr><th>移动速度</th><td class="mono">${e.speed} 格/秒</td></tr>${e.atk ? `<tr><th>近战</th><td class="mono">${e.atk} / ${e.atkRate} 秒</td></tr>` : ''}${e.impact ? `<tr><th>节点冲击</th><td class="mono">${e.impact} / ${e.impactRate} 秒</td></tr>` : ''}${e.range ? `<tr><th>射程</th><td class="mono">${e.range} 格</td></tr>` : ''}<tr><th>阻挡占用</th><td class="mono">${e.block || '无法阻挡'}</td></tr><tr><th>到达扣完整度</th><td class="mono">${e.leak}</td></tr><tr><th>消灭回收</th><td class="mono">算力 ${e.reward}${e.intel ? ` · 情报 ${e.intel}` : ''}</td></tr>${kills != null ? `<tr><th>本局已消灭</th><td class="mono">${kills}</td></tr>` : ''}</table>`;
        if (e.phases) html += `<h4>阶段变化</h4><table>${e.phases.map(p => `<tr><th>${p.name}${p.at ? `（生命 ${Math.round(p.at * 100)}%）` : ''}</th><td>${p.desc}</td></tr>`).join('')}</table>`;
        if (this.viewer) this.viewer.show('enemy', id);
      }
      text.innerHTML = html;
      if (!this.viewer) this.viewer = new TD.ModelViewer();
      this.viewer.attach($('hb-view'));
      if (tab === 'device') this.viewer.show('tower', id, 1, null);
      else this.viewer.show('enemy', id);
      // 点击等级卡切换展示模型
      text.querySelectorAll('.lv').forEach((box, i) => {
        box.style.cursor = 'pointer';
        box.onclick = () => {
          const t = TD.TOWERS[id];
          if (i === 0) this.viewer.show('tower', id, 1, null);
          else if (t.lv2) this.viewer.show('tower', id, 2, null);
          else this.viewer.show('tower', id, 2, Object.keys(t.branches)[i - 1]);
        };
      });
    }

    // ────────── 事件报告 ──────────
    showReport() {
      const g = this.game;
      if (!g) return;
      const st = g.stats;
      const win = g.over === 'victory';
      const kills = Object.values(st.kills).reduce((a, b) => a + b, 0);
      const grade = !win ? 'F' : g.integrity >= 19 ? 'S' : g.integrity >= 15 ? 'A' : g.integrity >= 9 ? 'B' : 'C';
      if (win) this.app.saveBest(g.mapId, grade, g.integrity);
      const incId = `INC-${String(g.def.index).padStart(2, '0')}${String(Math.floor(g.time) % 10000).padStart(4, '0')}`;
      const wave = Math.max(0, g.waveIdx + 1);
      const summary = win
        ? `入侵流量已在 ${fmtT(g.time)} 内被完全处置。守护进程共隔离节点 ${st.isolations} 次，触发路由收敛 ${st.reroutes} 次，在交战中守点 ${Math.round(st.holdSeconds)} 秒。中枢完整度保持 ${g.integrity}/${TD.RULES.startIntegrity}。`
        : `防线在第 ${wave} 波失守。${st.leaks} 点完整度损失来自突破出口的威胁，有 ${st.breaches} 处隔离点被打通。建议复盘路线与火力覆盖后重新接入。`;
      // 根因分析：把这一局最突出的问题和对策写进报告
      const findings = [];
      const leakTypes = Object.keys(st.leakBy).sort((a, b) => st.leakBy[b] - st.leakBy[a]);
      if (leakTypes.length) {
        const top = leakTypes[0], d = TD.ENEMIES[top] || TD.BOSSES[top];
        findings.push(`主要突破者是${d.name}（${st.leakBy[top]} 个）。${d.counter}`);
      }
      if (st.breaches >= 2) findings.push(`${st.breaches} 处隔离点被打通：隔离点需要修复进程覆盖，或在洪泛团抵达前开启断链加固。`);
      if (st.isolations === 0) findings.push('全程没有使用节点隔离：路线从未被改变，所有压力都由正面火力承担。');
      else if (st.reroutes >= 12) findings.push(`路由收敛 ${st.reroutes} 次：频繁改道会让火力覆盖失效，抖动抑制也会拉长再隔离间隔。`);
      if (st.healing < 200 && st.lost >= 4) findings.push(`损毁 ${st.lost} 座设备而治疗量很低：防线缺少修复进程。`);
      if (!findings.length) findings.push(win ? '路线、火力与资源投入配合良好，没有发现明显缺口。' : '火力覆盖不足以应对后期波次，建议提前规划第二道防线。');
      const rootCause = findings.map(f => `<li>${f}</li>`).join('');
      const killHtml = Object.keys(st.kills).map(k => `<div class="k"><img src="${TD.thumbs ? TD.thumbs[k] : ''}">${(TD.ENEMIES[k] || TD.BOSSES[k]).name} ×${st.kills[k]}</div>`).join('') || '<span style="color:var(--dim)">无</span>';
      const tl = st.timeline.slice(-18).map(e => `<div><i>${fmtT(e.t)}</i><u>W${e.wave}</u><span>${e.text}</span></div>`).join('') || '<div>无关键事件</div>';
      const stampCol = win ? 'var(--ok)' : 'var(--danger)';
      this.openModal(`<div class="report panel"><div class="rhead">
          <div class="stamp" style="color:${stampCol}">${win ? '已处置' : '已失守'}</div>
          <div><div class="rid">事件报告 ${incId} · 严重等级 ${win ? (g.integrity >= 15 ? '中' : '高') : '紧急'}</div><div class="rt">${g.def.name}：${win ? '入侵流量清零' : '中枢完整度归零'}</div></div>
          <div class="grade"><div class="g" style="color:${stampCol}">${grade}</div><div class="l">处置评级</div></div>
        </div>
        <div class="rbody">
          <div class="col"><h4>摘要</h4><p>${summary}</p>
            <h4>本局统计</h4><div class="kv">
              <div><b>${wave}/${g.waveTotal}</b><span>到达波次</span></div>
              <div><b>${g.integrity}/${TD.RULES.startIntegrity}</b><span>中枢完整度</span></div>
              <div><b>${fmtT(g.time)}</b><span>处置用时</span></div>
              <div><b>${kills}</b><span>消灭威胁</span></div>
              <div><b>${st.leaks}</b><span>完整度损失</span></div>
              <div><b>${st.reroutes}</b><span>路由收敛</span></div>
              <div><b>${st.built}</b><span>部署设备</span></div>
              <div><b>${st.lost}</b><span>设备损毁</span></div>
              <div><b>${st.upgrades}</b><span>升级次数</span></div>
              <div><b>${Math.round(st.damage)}</b><span>造成伤害</span></div>
              <div><b>${Math.round(st.towerDamage)}</b><span>设备承伤</span></div>
              <div><b>${Math.round(st.healing)}</b><span>治疗量</span></div>
              <div><b>${st.isolations}</b><span>隔离操作</span></div>
              <div><b>${st.breaches}</b><span>隔离点被打通</span></div>
              <div><b>${Math.round(st.intelEarned)}</b><span>情报收入</span></div>
            </div>
            <h4>处置的威胁</h4><div class="killlist">${killHtml}</div>
          </div>
          <div class="col"><h4>${win ? '复盘' : '根因分析'}</h4><ul class="rootcause">${rootCause}</ul><h4>关键时间线</h4><div class="timeline">${tl}</div></div>
        </div>
        <div class="rfoot"><button class="btn" id="rp-levels">返回关卡选择</button><button class="btn primary" id="rp-again">重开本图</button></div></div>`, 'report');
      $('rp-again').onclick = () => { $('modal').classList.remove('show'); this.closeModal(); this.app.restart(); };
      $('rp-levels').onclick = () => { $('modal').classList.remove('show'); this.closeModal(); this.app.toLevels(); };
    }
  }

  TD.UI = UI;

  // ────────── 图鉴模型查看器 ──────────
  class ModelViewer {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
      this.scene.add(new THREE.HemisphereLight(0xECE8DC, 0x3A3A3A, 1.15));
      const d = new THREE.DirectionalLight(0xfff2dc, 2.0); d.position.set(4, 8, 5); this.scene.add(d);
      const r = new THREE.DirectionalLight(0xA8D0E0, 1.4); r.position.set(-6, 3, -4); this.scene.add(r);
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x33363A);
      const b = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 5) })); b.position.set(4, 8, 4); envScene.add(b);
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromScene(envScene, 0.04).texture;
      pm.dispose();
      this.running = false;
      this.model = null;
      this.t = 0;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.08, 40), new THREE.MeshStandardMaterial({ color: 0x1E2022, metalness: 0.6, roughness: 0.4 }));
      plate.position.y = -0.04;
      this.scene.add(plate);
      this.plate = plate;
    }
    attach(parent) {
      parent.insertBefore(this.canvas, parent.firstChild);
      this.parent = parent;
      this.resize();
      if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame((n) => this.loop(n)); }
    }
    resize() {
      const r = this.parent.getBoundingClientRect();
      this.renderer.setSize(r.width, r.height, false);
      this.camera.aspect = r.width / Math.max(1, r.height);
      this.camera.updateProjectionMatrix();
    }
    show(kind, id, lv, br) {
      if (this.model) this.model.dispose();
      this.kind = kind; this.id = id;
      this.model = kind === 'tower' ? TD.makeTower(id, lv || 1, br || null, {}) : TD.makeEnemy(id, {});
      this.scene.add(this.model.root);
      const h = Math.max(this.model.height, 1.2);
      this.h = h;
      this.camera.position.set(0, h * 0.95 + 0.6, h * 2.7 + 2.0);
      this.camera.lookAt(0, h * 0.42, 0);
      const sc = Math.max(1.2, h * 0.62);
      this.plate.scale.set(sc, 1, sc);
      this.model.setVariant('normal');
      this.t = 0;
    }
    loop(now) {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      if (this.model) {
        const phase = this.t % 6;
        const atk = phase > 3 && phase < 3.6 ? 1 - (phase - 3) / 0.6 : 0;
        const hit = phase > 4.6 && phase < 4.85 ? 1 - (phase - 4.6) / 0.25 : 0;
        const st = this.kind === 'tower'
          ? { fire: atk, hit, dir: Math.PI / 2, aim: Math.PI / 2 + Math.sin(this.t * 0.8) * 0.6, hasTarget: phase > 2.6 && phase < 4, arc: 1, healing: phase > 2 && phase < 4, blocked: phase > 3 ? 1 : 0, skill: phase > 2.5 && phase < 3.8 }
          : { moving: phase < 2.6 || phase > 4.9, speedF: 1, attack: atk, hit, blocked: phase > 2.6 && phase < 4.9, revealed: this.t % 12 > 6, phase: Math.floor(this.t / 6) % 3, sieging: phase > 2.6 && phase < 4 };
        this.model.update(dt, st);
        this.model.root.rotation.y = this.t * 0.55;
      }
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame((n) => this.loop(n));
    }
    stop() { this.running = false; }
  }
  TD.ModelViewer = ModelViewer;

  // ────────── 缩略图：把模型渲染成图标 ──────────
  TD.buildThumbs = function () {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.toneMapping = THREE.NoToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xECE8DC, 0x403F3C, 1.25));
    const d = new THREE.DirectionalLight(0xfff0d8, 2.0); d.position.set(4, 8, 6); scene.add(d);
    const r = new THREE.DirectionalLight(0xA8D0E0, 1.5); r.position.set(-6, 2, -3); scene.add(r);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x3A3D40);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0.04).texture;
    pm.dispose();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    const out = {};
    const snap = (key, model, st) => {
      scene.add(model.root);
      for (let k = 0; k < 20; k++) model.update(0.1, st || {});
      const box = new THREE.Box3().setFromObject(model.root);
      const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      const span = Math.max(s.x, s.y, s.z, 0.8);
      cam.position.set(c.x + span * 1.15, c.y + span * 1.05, c.z + span * 2.0);
      cam.lookAt(c);
      renderer.render(scene, cam);
      out[key] = canvas.toDataURL('image/png');
      model.dispose();
    };
    for (const id of TD.TOWER_ORDER) {
      const t = TD.TOWERS[id];
      const st = { dir: Math.PI / 2 + 0.6, aim: Math.PI / 2 + 0.6, hasTarget: true, arc: 1 };
      snap(`${id}_1`, TD.makeTower(id, 1, null, {}), st);
      if (t.lv2) snap(`${id}_2`, TD.makeTower(id, 2, null, {}), st);
      if (t.branches) for (const k in t.branches) snap(`${id}_2_${k}`, TD.makeTower(id, 2, k, {}), st);
    }
    for (const id of TD.ENEMY_ORDER) snap(id, TD.makeEnemy(id, {}), { revealed: true, moving: false });
    for (const id of TD.BOSS_ORDER) snap(id, TD.makeEnemy(id, {}), { revealed: true, phase: 1, moving: false });
    snap('isolator', TD.makeIsolator(), {});
    renderer.dispose();
    renderer.forceContextLoss();
    TD.thumbs = out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
