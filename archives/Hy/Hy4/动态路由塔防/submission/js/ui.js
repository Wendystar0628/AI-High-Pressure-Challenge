/* 动态路由塔防 · 界面层（DOM 叠加） */
(function () {
  'use strict';
  var TD = window.TD = window.TD || {};
  var Data = TD.Data, Maps = TD.Maps, Game = TD.Game;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function fmt(n) { return Math.floor(n); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var screen = 'menu', prevScreen = 'menu';
  var ovPool = [], lastForecast = '', lastLog = '', lastCards = '', lastInspector = '';
  var toastTimer = null;

  var UI = {
    init: function () {
      buildMenu();
      buildCodex();
      buildHelp();
      bind();
      this.setScreen('menu');
    },

    // ---------------- 屏幕切换 ----------------
    setScreen: function (name) {
      screen = name;
      ['menu', 'codex', 'help', 'report'].forEach(function (s) { $(s).classList.toggle('hidden', s !== name); });
      $('hud').classList.toggle('hidden', !(name === 'battle' || name === 'report'));
      $('pauseMask').classList.add('hidden');
      if (name !== 'battle') { $('subtitle').classList.add('hidden'); $('demoTop').classList.add('hidden'); $('demoCursor').classList.add('hidden'); }
    },
    openOverlayScreen: function (name) { prevScreen = screen; this.setScreen(name); },
    closeOverlayScreen: function () { this.setScreen(prevScreen === 'codex' || prevScreen === 'help' ? 'menu' : prevScreen); },

    // ---------------- 菜单 / 图鉴 / 说明 ----------------
    showReport: function (s) {
      var win = s.phase === 'win';
      $('reportTitle').textContent = win ? '事件报告 · 防线稳固' : '事件报告 · 防线失守';
      $('reportTitle').className = win ? '' : 'lose';
      $('reportTag').textContent = win ? 'INCIDENT CLOSED / SEK-CORE' : 'INCIDENT CRITICAL / SEK-CORE';
      var st = s.stats;
      var lines = [
        ['战区', s.map.name], ['抵御波次', (win ? s.totalWaves : s.wave) + ' / ' + s.totalWaves],
        ['中枢完整度', Math.round(Math.max(0, s.core) / s.coreMax * 100) + '%'],
        ['消灭威胁', st.kills], ['突破次数', st.leaks],
        ['部署设备', st.built], ['撤下设备', st.sold], ['改道次数', st.isoCount],
        ['造成杀伤', Math.round(st.dmgDealt)], ['承受损伤', Math.round(st.dmgTaken)],
        ['累计算力', Math.round(st.computeEarned)], ['累计情报', Math.round(st.intelEarned)]
      ];
      var html = lines.map(function (l) { return '<div class="rp-line"><span>' + l[0] + '</span><b>' + l[1] + '</b></div>'; }).join('');
      html += '<div class="rp-note">' + s.map.lore + '<br>本报告由守护进程自动生成。' +
        (win ? '全部入侵流量已被抵御，链路连通性维持至终局。' : '中枢完整度归零，建议调整隔离策略与火力覆盖后重试。') + '</div>';
      $('reportBody').innerHTML = html;
      this.setScreen('report');
    },

    // ---------------- 每帧渲染 ----------------
    render: function (s, scene, view, w, h) {
      if (!s) return;
      // 常驻信息
      $('vCpu').textContent = fmt(s.compute);
      $('vIntel').textContent = fmt(s.intel);
      var corePct = Math.max(0, s.core) / s.coreMax * 100;
      $('vCore').textContent = Math.round(corePct) + '%';
      $('coreFill').style.width = corePct + '%';
      $('vWave').textContent = s.wave + ' / ' + s.totalWaves;
      $('btnSpeed').textContent = s.speed + '×';
      $('btnPause').textContent = s.paused ? '▶ 继续' : '⏸ 暂停';
      $('btnMute').textContent = TD.Audio.isMuted() ? '🔇' : '♪';
      $('btnMute').classList.toggle('on', TD.Audio.isMuted());
      $('volSlider').value = Math.round(TD.Audio.getVolume() * 100);

      renderForecast(s);
      renderLog(s);
      renderCards(s, view);
      renderInspector(s, view);
      renderOverlay(s, scene, view, w, h);
    },

    // ---------------- 提示 / 演示 ----------------
    toast: function (msg, type) {
      var t = $('toast'); t.textContent = msg; t.className = type || '';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 1900);
      t.classList.remove('hidden');
    },
    subtitle: function (step, text) {
      var d = $('subtitle');
      if (!text) { d.classList.add('hidden'); return; }
      d.innerHTML = '<span class="st-step">' + esc(step || '') + '</span>' + esc(text);
      d.classList.remove('hidden');
    },
    demoCursor: function (x, y, press, visible) {
      var d = $('demoCursor');
      d.classList.toggle('hidden', !visible);
      d.classList.toggle('press', !!press);
      d.style.left = x + 'px'; d.style.top = y + 'px';
    },
    demoHud: function (name, time, total) {
      $('demoTop').classList.remove('hidden');
      $('demoName').textContent = name;
      $('demoTimer').textContent = time.toFixed(1) + 's / ' + total.toFixed(0) + 's';
    },
    showPause: function (on) { $('pauseMask').classList.toggle('hidden', !on); }
  };

  // ---------------- 菜单 ----------------
  function buildMenu() {
    var mc = $('mapCards'); mc.innerHTML = '';
    Maps.list.forEach(function (m, i) {
      var c = el('div', 'map-card');
      c.style.setProperty('--mc', m.env.node + '33');
      c.innerHTML = '<div class="mc-num">SECTOR 0' + (i + 1) + ' / ' + m.env.ambience.toUpperCase() + '</div>' +
        '<div class="mc-name">' + m.name + '</div>' +
        '<div class="mc-sub">' + m.sub + '</div>' +
        '<div class="mc-lore">' + m.lore + '</div>' +
        '<div class="mc-foot"><span class="mc-waves">◈ ' + m.waves + ' 波 · 出口 ' + m.exits.map(function (e) { return e.name; }).join(' / ') + '</span>' +
        '<button class="btn">进入战区 ▶</button></div>';
      c.querySelector('button').onclick = function () { TD.App.start(m.id); };
      c.onclick = function (e) { if (e.target.tagName !== 'BUTTON') TD.App.start(m.id); };
      mc.appendChild(c);
    });
    var demos = [
      ['DEMO 01', '分段取舍', '把网闸拖到西边界节点，预览中 A 折向 DMZ 互联；确认后办公网段的敌人掉头。'],
      ['DEMO 02', '旁路直通', '骨干流域洪峰：洪泛团冲垮节点上的网闸，C、B 路线改回原数据中心，同时在 A 路线投协议降级。'],
      ['DEMO 03', '蛰影现身', '气隙深层第 16 波：蛰影锁死前方运维环，各入口路线重新收敛，选中修复进程释放冗余切换。']
    ];
    var dc = $('demoCards'); dc.innerHTML = '';
    demos.forEach(function (d, i) {
      var c = el('div', 'demo-card');
      c.innerHTML = '<div class="dc-num">' + d[0] + '</div><div class="dc-name">' + d[1] + '</div>' +
        '<div class="dc-desc">' + d[2] + '</div><button class="btn dc-btn">▶ 播放演示</button>';
      c.querySelector('button').onclick = function () { TD.App.startDemo('demo-' + (i + 1)); };
      dc.appendChild(c);
    });
  }

  // ---------------- 图鉴 ----------------
  var codexTabs = [
    { id: 'device', name: '设备手册' }, { id: 'threat', name: '威胁档案' },
    { id: 'terrain', name: '状态与地形' }, { id: 'system', name: '系统说明' }
  ];
  function buildCodex() {
    var tabs = $('codexTabs'); tabs.innerHTML = '';
    codexTabs.forEach(function (t, i) {
      var b = el('div', 'tab' + (i === 0 ? ' on' : ''), t.name);
      b.onclick = function () {
        Array.prototype.forEach.call(tabs.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on'); renderCodex(t.id);
      };
      tabs.appendChild(b);
    });
    renderCodex('device');
  }
  function cxItem(glyph, color, name, role, desc, detail, extra) {
    return '<div class="cx-item"><div class="cx-h"><div class="cx-g" style="color:' + color + '">' + glyph + '</div>' +
      '<div><div class="cx-n">' + name + '</div><div class="cx-r">' + role + '</div></div></div>' +
      '<div class="cx-d">' + desc + '</div>' + (detail ? '<div class="cx-p">' + detail + '</div>' : '') + (extra || '') + '</div>';
  }
  function renderCodex(tab) {
    var body = $('codexBody'), html = '';
    if (tab === 'device') {
      html += '<div class="cx-sect">守方设备 · 六种塔均可升至 2 级</div><div class="cx-grid">';
      Data.towerList().forEach(function (t) {
        var br = t.branches ? '<div class="cx-p">2 级分支：' + t.branches.a.name + ' / ' + t.branches.b.name + '</div>' : '';
        html += cxItem(t.glyph, t.color, t.name, t.role + ' · 算力 ' + t.cost + (t.branchIntel ? ' · 分支需情报 ' + t.branchIntel : ''), t.desc, t.detail, br + '<div class="cx-p">技能「' + t.skill.name + '」：' + t.skill.desc + '</div>');
      });
      html += '</div><div class="cx-sect" style="margin-top:18px">支援道具</div><div class="cx-grid">';
      Data.itemList().forEach(function (it) {
        html += cxItem(it.glyph, it.color, it.name, (it.res === 'intel' ? '情报 ' : '算力 ') + it.cost + ' · 冷却 ' + it.cd + 's', it.desc, it.detail);
      });
      html += '</div>';
    } else if (tab === 'threat') {
      html += '<div class="cx-sect">恶意程序</div><div class="cx-grid">';
      Data.enemyList().forEach(function (e) { html += cxItem(e.glyph, e.color, e.name, 'HP ' + e.hp + ' · 阻挡 ' + e.block + ' · 中枢伤害 ' + e.coreDmg, e.desc, e.detail); });
      html += '</div><div class="cx-sect" style="margin-top:18px">核心威胁 · Boss</div><div class="cx-grid">';
      Object.keys(Data.BOSSES).forEach(function (k) { var b = Data.BOSSES[k]; html += cxItem(b.glyph, b.color, b.name, 'HP ' + b.hp + ' · 阶段 ' + b.phases.map(function (p) { return p.name; }).join(' → '), b.desc, b.detail); });
      html += '</div>';
    } else if (tab === 'terrain') {
      html += '<div class="cx-sect">地块与地形</div><div class="cx-grid">';
      Data.TERRAIN_INFO.forEach(function (t) { html += cxItem('▦', t.color, t.name, 'TERRAIN', t.text); });
      html += '</div><div class="cx-sect" style="margin-top:18px">状态与作用</div><div class="cx-grid">';
      Data.STATUS_INFO.forEach(function (t) { html += cxItem('◈', t.color, t.name, 'STATUS', t.text); });
      html += '</div>';
    } else {
      html += '<div class="cx-sect">系统与资源</div><div class="cx-grid">';
      Data.SYSTEM_INFO.forEach(function (t) { html += cxItem('▤', '#8fe3ff', t.name, 'SYSTEM', t.text); });
      html += '</div>';
      html += '<div class="cx-sect" style="margin-top:18px">镜头与操作</div><div class="cx-grid">' +
        cxItem('◉', '#39d0e6', '镜头', 'CAMERA', '中键拖动环绕；Shift + 中键平移；滚轮缩放；左键点选与拖放部署；可随时回到默认视角。') +
        cxItem('▤', '#7dff9b', '部署', 'DEPLOY', '把待部署栏卡片拖到战场，拖动时预览作用范围；拦截器由玩家设定朝向，确认前可取消。') +
        cxItem('◇', '#ffd27f', '暂停与调速', 'CONTROL', '空格暂停；1 / 2 / 3 调速；暂停与加速统一作用于整场战斗。局中与结算后均可重开本图或返回关卡选择。') +
        '</div>';
    }
    body.innerHTML = html;
  }

  function buildHelp() {
    var body = $('helpBody');
    body.innerHTML = '<div class="cx-grid">' +
      cxItem('◈', '#39d0e6', '目标', 'OBJECTIVE', '作为守护进程抵御涌向中枢的恶意程序，同时维持各入口到中枢的连通。敌人进入出口，中枢完整度下降；撑过全部波次即胜利。') +
      cxItem('⊟', '#7f8cff', '改道', 'ROUTING', '在交换节点部署网闸 / 防火墙或投放应急隔离器会隔离节点、截断道路。确认前可预览各入口新路线；任何会封死通路的操作都会被拒绝且不消耗资源。') +
      cxItem('≋', '#ff5a4f', '攻防', 'COMBAT', '近战攻塔、远程压制与节点冲击形成不同压力；治疗与解除加密维持防线。塔优先攻击沿路线离出口最近的有效目标。') +
      cxItem('◱', '#ffd27f', '资源', 'RESOURCE', '算力来自进程增长与消灭敌人，用于部署与升级；情报来自波次、重点威胁与守住隔离节点，用于隔离、分支与情报道具。两者不能互换。') +
      cxItem('⌖', '#6fe8c8', '镜头', 'CAMERA', '中键拖动环绕 · Shift+中键平移 · 滚轮缩放 · 左键点选 / 拖放 · 按 F 回到默认视角。') +
      cxItem('✚', '#7dff9b', '道具与技能', 'SUPPORT', '道具卡片显示图标、名称、投放位置、消耗与冷却；选中塔可升级、释放技能或撤下。') +
      '</div><div class="cx-sect" style="margin-top:16px">快捷键</div><div class="cx-grid">' +
      cxItem('␣', '#8fe3ff', '空格', 'KEY', '暂停 / 继续') +
      cxItem('1 2 3', '#8fe3ff', '数字键', 'KEY', '1× / 2× / 3× 速度') +
      cxItem('F', '#8fe3ff', 'F', 'KEY', '回到默认视角') +
      cxItem('Esc', '#8fe3ff', 'Esc', 'KEY', '取消部署 / 取消选择') +
      cxItem('R', '#8fe3ff', 'R', 'KEY', '重开本图') +
      '</div>';
  }

  // ---------------- 流量预报 / 日志 ----------------
  function renderForecast(s) {
    var cur = s.wave, html = '<div class="fc-wave">● 当前第 ' + cur + ' 波 / 次波 ' + (cur + 1) + '</div>';
    var byEntry = {};
    for (var i = 0; i < s.wavePlan.length; i++) {
      var it = s.wavePlan[i];
      if (!it.type || (it.wave !== cur && it.wave !== cur + 1)) continue;
      var key = it.entry + '|' + it.wave;
      byEntry[key] = byEntry[key] || {};
      byEntry[key][it.type] = (byEntry[key][it.type] || 0) + 1;
    }
    s.map.entries.forEach(function (en) {
      var curSet = byEntry[en.id + '|' + cur] || {}, nextSet = byEntry[en.id + '|' + (cur + 1)] || {};
      function str(set) {
        var ks = Object.keys(set);
        if (!ks.length) return '<span style="color:#4a6a7a">—</span>';
        return ks.map(function (k) { var d = Data.ENEMIES[k] || Data.BOSSES[k]; return '<span style="color:' + (d ? d.color : '#fff') + '">' + (d ? d.name : k) + '×' + set[k] + '</span>'; }).join(' ');
      }
      html += '<div class="fc-row"><span class="fc-tag ' + en.id + '">' + en.id + '</span><span class="fc-name">' + en.name + '</span>' +
        '<span class="fc-list">' + str(curSet) + '<br><span style="color:#4a6a7a;font-size:9px">次波 ' + str(nextSet) + '</span></span></div>';
    });
    if (html !== lastForecast) { $('forecast').innerHTML = html; lastForecast = html; }
  }
  function renderLog(s) {
    var logs = s.logs.slice(-14), html = '';
    for (var i = logs.length - 1; i >= 0; i--) {
      var l = logs[i], sec = (l.tick * Data.DT).toFixed(0);
      html += '<div class="lg ' + l.kind + '"><b>' + sec + 's</b>' + esc(l.text) + '</div>';
    }
    if (html !== lastLog) { $('syslog').innerHTML = html; lastLog = html; }
  }

  // ---------------- 部署栏 ----------------
  function buildCardsOnce() {
    var tc = $('towerCards'); tc.innerHTML = '';
    Data.towerList().forEach(function (t) {
      var c = el('div', 'card'); c.dataset.type = t.id;
      c.innerHTML = '<div class="cg" style="color:' + t.color + '">' + t.glyph + '</div>' +
        '<div class="cn">' + t.name + '</div><div class="cr">' + t.role + '</div>' +
        '<div class="cc cpu">◱ ' + t.cost + '</div>';
      c.addEventListener('mousedown', function (e) { e.preventDefault(); TD.App.beginDeploy(t.id); });
      tc.appendChild(c);
    });
    var ic = $('itemCards'); ic.innerHTML = '';
    Data.itemList().forEach(function (it) {
      var c = el('div', 'card item-card'); c.dataset.item = it.id;
      c.innerHTML = '<div class="cg" style="color:' + it.color + '">' + it.glyph + '</div>' +
        '<div class="cn">' + it.name + '</div><div class="cr">' + (it.place === 'node' ? '投放：节点' : it.place === 'tower' ? '投放：设备' : '投放：链路') + '</div>' +
        '<div class="cc ' + (it.res === 'intel' ? 'intel' : 'cpu') + '">' + (it.res === 'intel' ? '◇ ' : '◱ ') + it.cost + '</div>' +
        '<div class="cd hidden"></div>';
      c.addEventListener('mousedown', function (e) { e.preventDefault(); TD.App.beginItem(it.id); });
      ic.appendChild(c);
    });
  }
  function renderCards(s, view) {
    if (!$('towerCards').children.length) buildCardsOnce();
    var key = Math.floor(s.compute) + '|' + Math.floor(s.intel) + '|' + s.tick + '|' + (view.deploy ? view.deploy.type : '') + '|' + (view.itemMode || '');
    // 每 6 帧更新一次即可
    if (key === lastCards && s.tick % 6 !== 0) return;
    lastCards = key;
    Array.prototype.forEach.call($('towerCards').children, function (c) {
      var t = Data.TOWERS[c.dataset.type];
      c.classList.toggle('disabled', s.compute < t.cost);
      c.classList.toggle('active', !!(view.deploy && view.deploy.type === c.dataset.type));
    });
    Array.prototype.forEach.call($('itemCards').children, function (c) {
      var it = Data.ITEMS[c.dataset.item];
      var ready = Game.itemReady(s, c.dataset.item);
      var res = it.res === 'intel' ? s.intel : s.compute;
      c.classList.toggle('disabled', !ready || res < it.cost);
      c.classList.toggle('active', view.itemMode === c.dataset.item);
      var cd = c.querySelector('.cd');
      if (!ready) { var left = ((s.itemCd[c.dataset.item] - s.tick) * Data.DT).toFixed(0); cd.classList.remove('hidden'); cd.textContent = left + 's'; }
      else cd.classList.add('hidden');
    });
  }

  // ---------------- 选中信息 ----------------
  function renderInspector(s, view) {
    var sel = view.selected, html = '', acts = '';
    if (!sel || !sel.kind) {
      html = '<div class="empty-info">左键点选设备、敌人或地块<br>查看详细信息与可执行操作</div>';
    } else if (sel.kind === 'tower') {
      var t = Game.findTower(s, sel.id);
      if (!t) { view.selected = null; return; }
      var d = t.def, hpPct = Math.max(0, t.hp / t.maxHp * 100);
      html = '<div class="insp-name" style="color:' + d.color + '">' + d.glyph + ' ' + d.name + '</div>' +
        '<div class="insp-role">' + d.role + ' · ' + t.lvl + ' 级' + (t.branch ? ' · ' + d.branches[t.branch].name : '') + '</div>' +
        '<div class="hpbar"><i style="width:' + hpPct + '%"></i></div>' +
        '<div class="insp-stat"><span>生命</span><b>' + Math.max(0, Math.round(t.hp)) + ' / ' + t.maxHp + '</b></div>' +
        '<div class="insp-stat"><span>阻挡容量</span><b>' + (t.capNow || '—') + '</b></div>' +
        (t.encryptedUntil > s.tick ? '<span class="chip bad">加密中</span>' : '') +
        (t.shield > 0 ? '<span class="chip good">护盾 ' + Math.round(t.shield) + '</span>' : '') +
        (t.nodeId && s.isolated[t.nodeId] && s.isolated[t.nodeId].active ? '<span class="chip warn">节点隔离中</span>' : '') +
        '<div class="insp-desc">' + d.desc + '</div>' +
        '<div class="insp-stat"><span>技能</span><span>' + d.skill.name + (t.skillCd > s.tick ? ' (冷却 ' + ((t.skillCd - s.tick) * Data.DT).toFixed(0) + 's)' : ' 就绪') + '</span></div>';
      if (t.lvl < 2) {
        acts += '<button class="btn" data-act="upgrade" data-id="' + t.id + '">升级至 2 级 ◱' + d.lvl2cost + '</button>';
        if (d.branchIntel) acts += '<button class="btn" data-act="upgrade" data-id="' + t.id + '" data-branch="a">' + d.branches.a.name + '</button>' +
          '<button class="btn" data-act="upgrade" data-id="' + t.id + '" data-branch="b">' + d.branches.b.name + '</button>';
      }
      acts += '<button class="btn" data-act="skill" data-id="' + t.id + '">释放技能</button>';
      acts += '<button class="btn danger" data-act="sell" data-id="' + t.id + '">撤下 (返还 ◱' + Math.floor((d.cost + (t.lvl === 2 ? d.lvl2cost : 0)) * Game.SELL_REFUND) + ')</button>';
    } else if (sel.kind === 'enemy') {
      var e = Game.findEnemy(s, sel.id);
      if (!e || e.dying) { view.selected = null; return; }
      var ed = e.def, pct = Math.max(0, e.hp / e.maxHp * 100);
      html = '<div class="insp-name" style="color:' + ed.color + '">' + ed.glyph + ' ' + ed.name + (e.boss ? ' [BOSS]' : '') + '</div>' +
        '<div class="insp-role">来源入口 ' + e.entryId + (e.boss ? ' · 阶段 ' + ed.phases[Math.min(e.phaseIdx, ed.phases.length - 1)].name : '') + '</div>' +
        '<div class="hpbar enemy' + (e.boss ? '' : '') + '"><i style="width:' + pct + '%"></i></div>' +
        '<div class="insp-stat"><span>生命</span><b>' + Math.max(0, Math.round(e.hp)) + ' / ' + e.maxHp + '</b></div>' +
        (e.shield > 0 ? '<span class="chip warn">护盾 ' + Math.round(e.shield) + '</span>' : '') +
        ((e.disguised || e.latent) && !e.revealed ? '<span class="chip bad">未显形</span>' : '') +
        (e.armored ? '<span class="chip bad">强化护甲</span>' : '') +
        (e.blockedBy ? '<span class="chip">交战中</span>' : '') +
        '<div class="insp-desc">' + ed.desc + '</div>';
    } else if (sel.kind === 'cell') {
      var tile = Game.tileAt(s, sel.x, sel.z);
      var tn = tileName(tile ? tile.t : '.');
      html = '<div class="insp-name">▦ ' + tn.name + '</div><div class="insp-role">坐标 ' + sel.x + ' , ' + sel.z + '</div>' +
        '<div class="insp-desc">' + tn.text + '</div>';
      if (tile && tile.t === 'N') {
        var nid = s.map.nodeAt[Game.cellKey({ x: sel.x, z: sel.z })];
        var iso = s.isolated[nid] && s.isolated[nid].active;
        html += '<div class="insp-stat"><span>通行状态</span><b style="color:' + (iso ? '#ff6b8a' : '#7dff9b') + '">' + (iso ? '已隔离' : '直通') + '</b></div>';
        if (iso) html += '<div class="insp-stat"><span>隔离来源</span><span>' + (s.isolated[nid].by === 'item' ? '应急隔离器' : '设备') + '</span></div>';
        if (s.reIsoUntil[nid] && s.reIsoUntil[nid] > s.tick) html += '<div class="insp-stat"><span>再次隔离</span><span>' + ((s.reIsoUntil[nid] - s.tick) * Data.DT).toFixed(0) + 's</span></div>';
      }
    }
    var key2 = html + '|' + acts;
    if (key2 !== lastInspector) { $('inspector').innerHTML = html; $('inspectorActions').innerHTML = acts; lastInspector = key2; }
  }
  function tileName(t) {
    var m = {
      '=': ['链路', '恶意程序与业务流量经过的道路；可部署防火墙 / 蜜罐，阻挡敌人但不截断道路。'],
      'o': ['旧链路', '保留旧协议的道路：地面敌人减速、木马显形，敌人选路也会考虑较慢的通行速度。'],
      'N': ['交换节点', '链路交汇处的网络设备。部署网闸 / 防火墙或插入应急隔离器会隔离这一格，解除后恢复直通。'],
      'P': ['设备平台', '部署远程、检测与修复支援塔的高台，敌人不能通行。'],
      '#': ['障碍 · 数据设施 / 气隙', '不能通行，也不能部署。'],
      '~': ['障碍 · 公网流', '横贯的公网数据流，不能通行，也不能部署。'],
      '.': ['深渊 / 协议层', '战场之下的协议层与空隙，不可通行、不可部署。'],
      'A': ['入口', '威胁接入点，链路连通的起点。'], 'B': ['入口', '威胁接入点，链路连通的起点。'], 'C': ['入口', '威胁接入点，链路连通的起点。'],
      'S': ['出口 · 中枢', '需要守住的目标；敌人进入会削减中枢完整度。'],
      'X': ['出口 · 中枢', '需要守住的目标；敌人进入会削减中枢完整度。'], 'Y': ['出口 · 中枢', '需要守住的目标；敌人进入会削减中枢完整度。']
    };
    var v = m[t] || m['.'];
    return { name: v[0], text: v[1] };
  }

  // ---------------- 3D 投影覆盖层 ----------------
  function ensurePool(n) {
    while (ovPool.length < n) { var d = el('div', ''); $('overlay').appendChild(d); ovPool.push(d); }
    return ovPool;
  }
  var _tmp = 0;
  function put(idx, x, y, cls, html, style) {
    var p = ensurePool(idx + 1)[idx];
    p.className = cls; p.style.display = 'block'; p.style.left = x + 'px'; p.style.top = y + 'px';
    p.innerHTML = html === undefined ? '' : html;
    if (style) p.style.cssText += style;
    return p;
  }
  function renderOverlay(s, scene, view, w, h) {
    var i = 0, map = s.map;
    function P(wx, wy, wz) { return scene.project(wx, wy, wz, w, h); }
    // 入口 / 出口 / 节点标签
    map.entries.forEach(function (en) {
      var p = P(Maps.wx(map, en.x), 1.7, Maps.wz(map, en.z));
      if (p) put(i++, p.x, p.y, 'ov-tag entry', en.id + ' · ' + en.name);
    });
    map.exits.forEach(function (ex) {
      var p = P(Maps.wx(map, ex.x), 1.9, Maps.wz(map, ex.z));
      if (p) put(i++, p.x, p.y, 'ov-tag exit', '◉ ' + ex.name);
    });
    map.nodes.forEach(function (n) {
      var iso = s.isolated[n.id] && s.isolated[n.id].active;
      var p = P(Maps.wx(map, n.x), 1.0, Maps.wz(map, n.z));
      if (p) put(i++, p.x, p.y, 'ov-tag node' + (iso ? ' iso' : ''), (iso ? '⊘ ' : '◇ ') + n.name);
    });
    // 塔血条
    s.towers.forEach(function (t) {
      var p = P(Maps.wx(map, t.x), 1.5, Maps.wz(map, t.z));
      if (!p) return;
      var pct = Math.max(0, t.hp / t.maxHp * 100);
      put(i++, p.x, p.y, 'ov-hp', '<i style="width:' + pct + '%"></i>');
      if (t.encryptedUntil > s.tick) { var pe = P(Maps.wx(map, t.x), 1.85, Maps.wz(map, t.z)); if (pe) put(i++, pe.x, pe.y, 'ov-state', '<span style="color:#c08bff">⊘加密</span>'); }
    });
    // 敌人血条 / 状态 / Boss 名
    s.enemies.forEach(function (e) {
      if (e.dying) return;
      var ep = Game.enemyPos(s, e), py = ep.y + (e.boss ? 2.6 : 1.0);
      var p = P(ep.x, py, ep.z);
      if (!p) return;
      var pct = Math.max(0, e.hp / e.maxHp * 100);
      put(i++, p.x, p.y, 'ov-hp en' + (e.boss ? ' boss' : ''), '<i style="width:' + pct + '%"></i>');
      if (e.boss) { var pb = P(ep.x, py + 0.6, ep.z); if (pb) put(i++, pb.x, pb.y, 'ov-boss', e.def.name + ' · ' + e.def.phases[Math.min(e.phaseIdx, e.def.phases.length - 1)].name); }
      var marks = '';
      if (e.shield > 0) marks += '<span style="color:#6fe8ff">⬡</span>';
      if ((e.disguised || e.latent) && !e.revealed) marks += '<span style="color:#9fb6c8">◈</span>';
      if (marks) { var pm = P(ep.x, py + 0.35, ep.z); if (pm) put(i++, pm.x, pm.y, 'ov-state', marks); }
    });
    // 预警倒计时
    s.warnings.forEach(function (wn) {
      var p = P(wn.wx, 2.6, wn.wz);
      if (p) put(i++, p.x, p.y, 'ov-warn', '⚠ ' + ((wn.trigger - s.tick) * Data.DT).toFixed(1) + 's');
    });
    // 封死位置提示
    if (view.rejectCells) view.rejectCells.forEach(function (c) {
      var p = P(Maps.wx(map, c.x), 0.8, Maps.wz(map, c.z));
      if (p) put(i++, p.x, p.y, 'ov-warn', '⛔ 会封死');
    });
    // 隐藏多余
    for (; i < ovPool.length; i++) ovPool[i].style.display = 'none';
  }

  // ---------------- 事件绑定 ----------------
  function bind() {
    $('btnSpeed').onclick = function () { TD.App.cycleSpeed(); };
    $('btnPause').onclick = function () { TD.App.togglePause(); };
    $('btnRestart').onclick = function () { TD.App.restart(); };
    $('btnMenu').onclick = function () { TD.App.backToMenu(); };
    $('btnMute').onclick = function () { TD.App.toggleMute(); };
    $('volSlider').oninput = function () { TD.App.setVolume(this.value / 100); };
    $('btnRetry').onclick = function () { TD.App.restart(); };
    $('btnBack').onclick = function () { TD.App.backToMenu(); };
    $('btnCodex').onclick = function () { UI.openOverlayScreen('codex'); };
    $('btnHelp').onclick = function () { UI.openOverlayScreen('help'); };
    $('codexClose').onclick = function () { UI.closeOverlayScreen(); };
    $('helpClose').onclick = function () { UI.closeOverlayScreen(); };
    $('btnDemoExit').onclick = function () { TD.App.demoExit(); };
    $('inspectorActions').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var act = b.dataset.act, id = +b.dataset.id, br = b.dataset.branch || null;
      if (act === 'upgrade') TD.App.upgradeTower(id, br);
      else if (act === 'skill') TD.App.towerSkill(id);
      else if (act === 'sell') TD.App.sellTower(id);
    });
  }

  TD.UI = UI;
})();
