"use strict";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
let game,
  world,
  mode = "home",
  mission = 0,
  selected = null,
  placement = null,
  hoverCell = null,
  pending = null,
  pendingRelease = null,
  dragging = false,
  dir = 0,
  logs = [],
  toastUntil = 0,
  modalPaused = false,
  exportMode = false,
  demo = null,
  uiTick = 0;
const audioEngine = {
  ctx: null,
  volume: 0.3,
  muted: false,
  next: 0,
  beat: 0,
  start() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.mix();
      } catch {}
    }
    if (this.ctx?.state === "suspended") this.ctx.resume();
  },
  mix() {
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.muted || exportMode ? 0 : this.volume,
        this.ctx.currentTime,
        0.025,
      );
  },
  tone(freq, duration = 0.1, type = "sine", volume = 0.12, slide = 1) {
    if (!this.ctx || this.muted || exportMode) return;
    let o = this.ctx.createOscillator(),
      g = this.ctx.createGain(),
      now = this.ctx.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(20, freq * slide),
      now + duration,
    );
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(now + duration);
  },
  noise(duration, frequency, volume, highpass = false) {
    if (!this.ctx || this.muted || exportMode) return;
    if (!this.noiseBuffer) {
      this.noiseBuffer = this.ctx.createBuffer(
        1,
        this.ctx.sampleRate * 3,
        this.ctx.sampleRate,
      );
      const samples = this.noiseBuffer.getChannelData(0);
      let seed = 19181;
      for (let i = 0; i < samples.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        samples[i] = seed / 2147483648 - 1;
      }
    }
    const source = this.ctx.createBufferSource(),
      filter = this.ctx.createBiquadFilter(),
      gain = this.ctx.createGain(),
      now = this.ctx.currentTime;
    source.buffer = this.noiseBuffer;
    filter.type = highpass ? "bandpass" : "lowpass";
    filter.frequency.value = frequency;
    filter.Q.value = highpass ? 1.8 : 0.7;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(
      volume,
      now + Math.min(0.05, duration / 4),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    source.stop(now + duration);
  },
  event(type, d = {}) {
    if (type === "attack") {
      if (this.ctx && this.ctx.currentTime - this.lastShot < 0.08) return;
      this.lastShot = this.ctx?.currentTime || 0;
      const pitches = {
        interceptor: 950,
        sandbox: 240,
        firewall: 140,
        honey: 450,
      };
      this.tone(
        pitches[d.kind] || 670,
        d.kind === "sandbox" ? 0.24 : 0.08,
        d.kind === "firewall" ? "sawtooth" : "triangle",
        0.08,
        d.kind === "sandbox" ? 1.6 : 0.4,
      );
    } else if (type === "enemyAttack") {
      const kind = d.from?.type;
      this.tone(
        kind === "ransom" ? 640 : kind === "flood" ? 74 : 160,
        kind === "flood" ? 0.24 : 0.13,
        kind === "ransom" ? "square" : "sawtooth",
        0.055,
        kind === "ransom" ? 0.6 : 0.35,
      );
      if (kind === "flood" || ENEMIES[kind]?.boss) this.noise(0.18, 330, 0.16);
    } else if (type === "kill") this.tone(190, 0.16, "triangle", 0.08, 0.3);
    else if (type === "build" || type === "upgrade") {
      this.tone(520, 0.18, "sine", 0.18, 1.5);
    } else if (type === "skill") {
      this.tone(
        d.kind === "repair" || d.kind === "restore"
          ? 440
          : d.kind === "downgrade"
            ? 180
            : 300,
        0.5,
        "sine",
        0.13,
        d.kind === "downgrade" ? 0.4 : 3,
      );
      if (d.kind === "isolate" || d.kind === "downgrade")
        this.noise(0.4, 1800, 0.06, true);
    } else if (type === "warning" || type === "bossPhase")
      this.tone(160, 0.6, "sawtooth", 0.12, 1.4);
    else if (type === "route") {
      this.tone(940, 0.16, "sine", 0.12, 0.6);
    } else if (type === "error") this.tone(130, 0.22, "triangle", 0.14, 0.7);
    else if (type === "wave" || type === "waveEnd") {
      this.tone(type === "wave" ? 330 : 660, 0.5, "sine", 0.12, 1.5);
    } else if (type === "towerLost" || type === "leak") {
      this.noise(0.45, 450, 0.18);
      this.tone(120, 0.4, "triangle", 0.13, 0.4);
    } else if (
      type === "heal" &&
      d.amount > 0 &&
      this.ctx?.currentTime > (this.lastHeal || 0) + 0.4
    ) {
      this.lastHeal = this.ctx.currentTime;
      this.tone(880, 0.12, "sine", 0.035, 1.2);
    }
  },
  music() {
    this.mix();
    if (!this.ctx || this.muted || exportMode) return;
    const now = this.ctx.currentTime;
    if (now < this.next) return;
    this.next = now + [0.48, 0.4, 0.58][mission];
    const scales = [
        [110, 164.81, 220, 246.94, 329.63, 220, 164.81, 146.83],
        [98, 146.83, 196, 261.63, 293.66, 196, 146.83, 130.81],
        [82.41, 123.47, 164.81, 185, 246.94, 164.81, 123.47, 110],
      ],
      notes = scales[mission];
    this.tone(notes[this.beat % 8], 1.7, "sine", 0.055);
    if (this.beat % 4 === 0) this.tone(notes[0] / 2, 2, "triangle", 0.09);
    if (this.beat % 4 === 0) {
      // Server cooling / broad network current / low industrial ventilation.
      this.noise(
        2.5,
        [320, 950, 150][mission],
        [0.045, 0.065, 0.08][mission],
        mission === 1,
      );
      if (mission === 0) this.tone(1760, 0.11, "sine", 0.012, 1.15);
      if (mission === 2) this.tone(55, 2.2, "sine", 0.045);
    }
    if (mode === "game" && game.running && this.beat % 2 === 0)
      this.tone(47, 0.14, "sine", 0.15, 0.4);
    this.beat++;
  },
};
function log(message) {
  logs.unshift({ time: game?.time || 0, message });
  logs = logs.slice(0, 5);
  renderLog();
}
function clock(t) {
  return (
    String(Math.floor(t / 60)).padStart(2, "0") +
    ":" +
    String(Math.floor(t % 60)).padStart(2, "0")
  );
}
function notify(message, error = false) {
  $("#toast").textContent = message;
  $("#toast").className = "show" + (error ? " error" : "");
  toastUntil = (game?.time || 0) + 3.4;
  if (!exportMode) {
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => $("#toast").classList.remove("show"), 3400);
  }
}
function renderLog() {
  $("#event-log").innerHTML = logs
    .map(
      (l) =>
        '<div class="log-line"><time>' +
        clock(l.time) +
        "</time><span>" +
        l.message +
        "</span></div>",
    )
    .join("");
}
function onEvent(type, d) {
  world?.event(type, d);
  audioEngine.event(type, d);
  if (["attack", "heal", "enemyAttack", "burst", "shield"].includes(type))
    return;
  if (type === "error") notify(d.message, true);
  if (type === "route") {
    let changes = d.changed
      .map((k) => k + " → " + (game.routes[k]?.exit || "?"))
      .join(" / ");
    log("路由收敛 " + (changes || "业务连通已验证"));
    if (d.changed.length) notify("路由已更新 · " + changes);
  }
  if (type === "build")
    log((TOWERS[d.tower.type]?.name || "隔离器") + " 已上线");
  if (type === "towerLost") {
    log(
      (TOWERS[d.tower.type]?.name || "隔离器") +
        " " +
        d.reason +
        (game.cell(d.tower.cell).type === "node" ? " · 旁路保护 8s" : ""),
    );
    if (selected === d.tower) selected = null;
    if (pendingRelease === d.tower) cancelPlacement();
  }
  if (type === "wave")
    log(
      "第 " + d.wave + " 波" + (d.flood ? " · 三入口洪峰告警" : "入侵流量接入"),
    );
  if (type === "waveEnd") {
    log("第 " + d.wave + " 波清除 · 资源回收");
    notify("流量已清除 · 算力与情报补给到账");
  }
  if (type === "spawn" && d.newType) {
    log("威胁识别：" + ENEMIES[d.enemy.type].name);
    const counters = {
      worm: "守住直通节点，抑制复制扩散",
      flood: "会冲击隔离节点，及时维修",
      trojan: "用沙箱或旧协议揭露伪装",
      ransom: "会加密平台设备，蜜罐可分担攻击",
      flyer: "无线层入侵，请部署拦截器",
      shell: "击破同伴护盾，集中攻击支援单位",
    };
    if (counters[d.enemy.type])
      notify(
        "发现 " + ENEMIES[d.enemy.type].name + " · " + counters[d.enemy.type],
      );
    if (ENEMIES[d.enemy.type].boss) {
      $("#boss-alert").hidden = false;
      $("#boss-alert").textContent =
        "核心威胁 / " + ENEMIES[d.enemy.type].name + " 已接入";
      bossUntil = game.time + 4;
      audioEngine.tone(65, 1.5, "sawtooth", 0.14, 1.3);
    }
  }
  if (type === "warning") {
    log(d.message);
    $("#boss-alert").hidden = false;
    $("#boss-alert").textContent = d.message;
    bossUntil = game.time + 3;
  }
  if (type === "bossPhase") {
    let names =
      d.enemy.type === "boss2"
        ? ["潜伏", "提权", "破坏"]
        : ["潜伏", "强化", "狂暴"];
    log(ENEMIES[d.enemy.type].name + " / " + names[d.enemy.phase] + "阶段");
    notify("威胁升级 · " + names[d.enemy.phase] + "阶段");
  }
  if (type === "leak") log("中枢告警 · 入侵流量突破防线");
  if (type === "log") log(d.message);
  if (type === "finish" && !demo) showReport(d.win);
  renderHUD();
}
let bossUntil = 0;
function setup(index, home = false) {
  mission = index;
  selected = null;
  placement = null;
  pending = null;
  hoverCell = null;
  $("#placement").hidden = true;
  $("#boss-alert").hidden = true;
  $("#toast").className = "";
  game = new Game(index);
  $("#items").replaceChildren();
  $("#sidebar-scroll").scrollTop = 0;
  world.setGame(game, home);
  game.onEvent = onEvent;
  logs = [];
  if (home) seedDefense(true);
  $("#map-code").textContent = game.map.code;
  $("#map-title").textContent = game.map.name;
  $("#legend-c").hidden = game.map.entries.length < 3;
  renderHUD();
  renderForecast();
  renderInspector();
  renderCards();
  renderItems();
  log("路由校验完成 · 所有入口连通");
  window.game = game;
  window.world = world;
}
function seedDefense(showcase = false) {
  const routes = Object.values(game.routes).flatMap((r) => r?.cells || []),
    platforms = game.map.platforms;
  let picks = platforms.filter((c) =>
    routes.some((id) => {
      let a = game.cell(id);
      return Math.hypot(c.x - a.x, c.y - a.y) < 2.3;
    }),
  );
  const targets =
    mission === 0
      ? [
          [4, 7],
          [10, 7],
          [6, 9],
          [8, 9],
          [4, 5],
          [10, 5],
        ]
      : mission === 1
        ? [
            [3, 7],
            [11, 7],
            [9, 9],
            [7, 4],
            [13, 7],
            [3, 9],
          ]
        : [
            [4, 7],
            [12, 7],
            [4, 9],
            [12, 9],
            [2, 5],
            [14, 5],
          ];
  let types = [
    "interceptor",
    "interceptor",
    "repair",
    "sandbox",
    "sandbox",
    "interceptor",
  ];
  targets.forEach((a, i) => {
    let c = picks
      .filter((p) => !game.towerAt(p.id))
      .sort(
        (p, q) =>
          Math.hypot(p.x - a[0], p.y - a[1]) -
          Math.hypot(q.x - a[0], q.y - a[1]),
      )[0];
    if (!c) return;
    let near = routes
      .map((id) => game.cell(id))
      .sort(
        (p, q) =>
          Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(q.x - c.x, q.y - c.y),
      )[0];
    game.place(types[i], c.id, Math.atan2(near.x - c.x, near.y - c.y), true);
  });
  if (showcase) {
    game.place(
      "firewall",
      mission === 0 ? "3,8" : mission === 1 ? "2,8" : "3,9",
      0,
      true,
    );
    game.place(
      "honey",
      mission === 0 ? "11,8" : mission === 1 ? "12,7" : "13,7",
      0,
      true,
    );
  }
}
function home(index = mission) {
  mode = "home";
  demo = null;
  exportMode = false;
  $("#demo-ui").hidden = true;
  $("#home").hidden = false;
  $("#home-scene-caption").hidden = false;
  $("#home-bottom").hidden = false;
  $("#game-ui").hidden = true;
  $("#app").className = "menu-mode";
  closeModal();
  setup(index, true);
  $("#missions").innerHTML = MAPS.map(
    (m, i) =>
      '<button class="mission ' +
      (i === index ? "active" : "") +
      '" data-map="' +
      i +
      '"><span class="number">0' +
      (i + 1) +
      '</span><div><div class="name">' +
      m.name +
      '</div><div class="desc">' +
      m.type +
      '</div></div><span class="wave-count">' +
      m.waves +
      ' WAVES</span><span class="arrow">↗</span></button>',
  ).join("");
  $$(".mission").forEach(
    (b) =>
      (b.onclick = () => {
        audioEngine.start();
        audioEngine.tone(700, 0.08);
        home(+b.dataset.map);
      }),
  );
  $("#preview-title").textContent = MAPS[index].name;
  $("#preview-desc").textContent =
    MAPS[index].entries.length +
    " 个入侵入口 / " +
    MAPS[index].exits.length +
    " 个数据中枢 / " +
    MAPS[index].nodes.length +
    " 个交换节点";
  world.resize();
}
function start(index = mission) {
  mode = "game";
  demo = null;
  $("#demo-ui").hidden = true;
  $("#home").hidden = true;
  $("#home-scene-caption").hidden = true;
  $("#home-bottom").hidden = true;
  $("#game-ui").hidden = false;
  $("#app").className = "game-mode";
  closeModal();
  setup(index);
  world.resize();
  notify("守护进程已接管 · 拖动设备部署，准备后放行第一波");
}
function renderHUD() {
  if (!game) return;
  $("#resources").innerHTML =
    '<div class="resource"><span class="resource-icon">⬡</span><div><small>可用算力</small><b>' +
    Math.floor(game.compute) +
    '</b></div></div><div class="resource intel"><span class="resource-icon">◈</span><div><small>情报</small><b>' +
    Math.floor(game.intel) +
    '</b></div></div><div class="resource health"><span class="resource-icon">◌</span><div><small>中枢完整度</small><b>' +
    game.integrity +
    '<em> %</em></b></div></div><div class="resource wave"><span class="resource-icon">≋</span><div><small>入侵波次</small><b>' +
    String(game.wave).padStart(2, "0") +
    "<em> / " +
    game.map.waves +
    "</em></b></div></div>";
  $("#clock").textContent = clock(game.time);
  $("#pause-btn").textContent = game.paused ? "▶ 继续" : "Ⅱ 暂停";
  $("#speed-btn").textContent = game.speed + "×";
  $("#phase-tag").textContent = game.paused
    ? "系统已暂停"
    : game.running
      ? "入侵进行中 / " + game.enemies.length + " 威胁"
      : game.wave
        ? "整备中 / " + Math.ceil(Math.max(0, game.intermission)) + "s"
        : "部署阶段 / 等待接入";
  $("#next-wave").disabled = game.running || game.over;
  $("#next-wave").innerHTML = game.running
    ? "入侵流量处置中 <span>" + game.enemies.length + "</span>"
    : "放行第 " +
      Math.min(game.map.waves, game.wave + 1) +
      " 波 <span>↗</span>";
  if (game.time > bossUntil) $("#boss-alert").hidden = true;
  const boss = game.enemies.find((e) => ENEMIES[e.type].boss && !e.dead);
  $("#boss-status").hidden = !boss;
  if (boss) {
    let phases =
      boss.type === "boss2"
        ? ["潜伏", "提权", "破坏"]
        : boss.type === "boss1"
          ? ["伪路由", "路由风暴", "路由风暴"]
          : ["群体控制", "蠕虫增殖", "洪峰"];
    $("#boss-status").innerHTML =
      '<span class="boss-title">' +
      ENEMIES[boss.type].name +
      " <small>" +
      phases[boss.phase] +
      " / 核心威胁</small></span><b>" +
      Math.ceil(boss.hp) +
      " / " +
      Math.round(boss.maxHp) +
      '</b><span class="boss-track"><i style="width:' +
      (boss.hp / boss.maxHp) * 100 +
      '%"></i></span>';
    $("#boss-status").onclick = () => selectEntity(boss);
  }
  if (exportMode && game.time > toastUntil)
    $("#toast").classList.remove("show");
}
function renderForecast() {
  let w = Math.min(game.map.waves, game.running ? game.wave : game.wave + 1),
    plan = wavePlan(game.map, w);
  $("#forecast-wave").textContent =
    "WAVE " + String(w).padStart(2, "0") + " / " + game.map.waves;
  $("#forecast").innerHTML = game.map.entries
    .map((e) => {
      let list = (game.running ? game.queue : plan).filter(
          (p) => p.entry === e.id,
        ),
        active = game.enemies.filter((p) => !p.dead && p.entry === e.id),
        types = [
          ...new Set(
            [...list, ...(game.running ? active : [])].map(
              (p) => ENEMIES[p.type].name,
            ),
          ),
        ];
      return (
        '<div class="forecast-row"><span class="entry-letter" style="color:#' +
        e.color.toString(16) +
        '">' +
        e.id +
        '</span><div><div class="entry-name">' +
        e.name +
        " → " +
        (game.routes[e.id]?.exit || "中枢") +
        '</div><div class="enemy-list">' +
        (types.join(" · ") ||
          (game.running ? "当前入口已清除" : "暂无异常流量")) +
        '</div></div><span class="amount" title="待入场 / 场上威胁">' +
        (game.running
          ? list.length +
            "<small>待入</small>" +
            active.length +
            "<small>在场</small>"
          : "×" + list.length) +
        "</span></div>"
      );
    })
    .join("");
}
function renderCards() {
  $("#tower-cards").innerHTML = Object.entries(TOWERS)
    .map(
      ([k, d], i) =>
        '<button class="tower-card ' +
        (placement === k ? "selected" : "") +
        '" data-tower="' +
        k +
        '" title="' +
        d.desc +
        '"><span class="key">0' +
        (i + 1) +
        "</span>" +
        icon(k, "tower-svg") +
        "<div><b>" +
        d.name +
        "</b><small>" +
        d.role +
        '</small><div class="cost">⬡ ' +
        d.cost +
        (d.intel ? "<em>◈ " + d.intel + "</em>" : "") +
        "</div></div></button>",
    )
    .join("");
  $$("[data-tower]").forEach((b) => {
    b.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || demo) return;
      audioEngine.start();
      choosePlacement(b.dataset.tower);
      dragging = true;
      dragOrigin = { x: e.clientX, y: e.clientY };
    });
    b.addEventListener("click", () => {
      if (!demo && !placement) choosePlacement(b.dataset.tower);
    });
  });
}
function renderItems() {
  if (!$("#items").children.length) {
    $("#items").innerHTML = Object.entries(ITEMS)
      .map(
        ([k, d]) =>
          '<button class="item ' +
          (placement === k ? "selected" : "") +
          '" data-item="' +
          k +
          '" title="' +
          d.desc +
          '">' +
          icon(k) +
          "<span><b>" +
          d.name +
          "</b><small>" +
          d.place +
          " · " +
          d.cd +
          's 冷却</small></span><span class="item-cost">' +
          ((game.cooldowns[k] || 0) > 0
            ? Math.ceil(game.cooldowns[k]) + "s"
            : (d.resource === "intel" ? "◈ " : "⬡ ") + d.cost) +
          "</span></button>",
      )
      .join("");
    $$("[data-item]").forEach(
      (b) =>
        (b.onclick = () => {
          if (!demo) choosePlacement(b.dataset.item);
        }),
    );
  }
  for (const button of $$("[data-item]")) {
    const kind = button.dataset.item,
      d = ITEMS[kind],
      cooldown = game.cooldowns[kind] || 0;
    button.classList.toggle("selected", placement === kind);
    button.classList.toggle("cooling", cooldown > 0);
    button.querySelector(".item-cost").textContent =
      (d.resource === "intel" ? "◈ " : "⬡ ") + d.cost;
    button.querySelector("small").textContent =
      cooldown > 0 ? "冷却 " + Math.ceil(cooldown) + "s" : d.place;
    button.style.setProperty(
      "--cooldown",
      Math.min(100, (cooldown / d.cd) * 100) + "%",
    );
    button.title = d.place + " · " + d.desc + " 冷却 " + d.cd + " 秒";
  }
}
function choosePlacement(kind) {
  placement = kind;
  pending = null;
  dir = 0;
  hoverCell = null;
  selected = null;
  world.selected = null;
  world.clearPreview();
  renderCards();
  renderItems();
  renderInspector();
  $("#placement").hidden = false;
  $("#placement").innerHTML =
    '<div class="placement-title"><b>' +
    (TOWERS[kind] || ITEMS[kind]).name +
    " / 等待投放</b><span>ESC 取消</span></div><p>" +
    (TOWERS[kind] || ITEMS[kind]).place +
    "。移动到地块查看作用范围，点击或松开后确认。</p>";
  audioEngine.tone(650, 0.08);
}
function cancelPlacement() {
  pendingRelease = null;
  placement = null;
  pending = null;
  dragging = false;
  world.clearPreview();
  $("#placement").hidden = true;
  renderCards();
  renderItems();
}
function routeComparison(routes) {
  return (
    '<div class="route-compare">' +
    game.map.entries
      .map((entry) => {
        const before = game.routes[entry.id],
          after = routes[entry.id];
        const same =
          before &&
          after &&
          JSON.stringify(before.cells) === JSON.stringify(after.cells) &&
          Math.abs(before.cost - after.cost) < 0.001;
        return (
          '<div class="route-row"><b style="color:#' +
          entry.color.toString(16) +
          '">' +
          entry.id +
          "</b><span>" +
          (before?.exit || "—") +
          " → " +
          (after?.exit || "无通路") +
          '</span><em class="' +
          (same ? "same" : "") +
          '">' +
          (after
            ? before.cost.toFixed(1) + " → " + after.cost.toFixed(1)
            : "将被封死") +
          "</em></div>"
        );
      })
      .join("") +
    '</div><small class="route-footnote">右侧为通行代价，已计入旧协议延迟。</small>'
  );
}
function placementFingerprint() {
  if (!pending || !placement) return "";
  const c = game.cell(pending.id),
    changing =
      (c.type === "node" &&
        ["gate", "firewall", "isolate"].includes(placement)) ||
      placement === "downgrade";
  return JSON.stringify([
    pending.id,
    placement,
    dir,
    game.canPlace(placement, pending.id),
    changing ? game.preview(pending.id, placement) : null,
  ]);
}
function refreshPlacement() {
  if (
    pending &&
    placement &&
    placementFingerprint() !== preparePlacement.fingerprint
  )
    preparePlacement(pending.id);
  if (pendingRelease && !pendingRelease.dead) {
    const signature = JSON.stringify([
      game.hazards.map((h) => [h.cells, h.active]),
      game.downgrades,
      game.towers.map((t) => t.cell),
    ]);
    if (signature !== previewRelease.fingerprint)
      previewRelease(pendingRelease);
  }
}
function preparePlacement(id) {
  if (!placement) return;
  hoverCell = id;
  pending = { id, kind: placement };
  let state = world.preview(id, placement, dir, true);
  if (!state) return;
  let d = TOWERS[placement] || ITEMS[placement],
    c = game.cell(id),
    changing = state.preview;
  preparePlacement.fingerprint = placementFingerprint();
  const panel = $("#placement"),
    panelKey = placement + ":" + id;
  const actions =
    panel.dataset.previewKey === panelKey
      ? panel.querySelector(".actions")
      : null;
  panel.dataset.previewKey = panelKey;
  $("#placement").hidden = false;
  $("#placement").innerHTML =
    '<div class="placement-title"><b>' +
    d.name +
    " / " +
    c.x +
    "," +
    c.y +
    "</b><span>" +
    (state.error ? "不可部署" : "等待确认") +
    "</span></div><p" +
    (state.error ? ' class="warning-text"' : "") +
    ">" +
    (state.error ||
      (changing
        ? "新路由预览：" +
          (changing.changed
            .map((k) => k + " → " + changing.routes[k]?.exit)
            .join(" / ") || "当前路线保持连通") +
          "。浅黄色虚线为预览。"
        : d.desc)) +
    "</p>" +
    (changing ? routeComparison(changing.routes) : "") +
    (placement === "interceptor"
      ? "<p>朝向 " +
        directionText(dir) +
        " · 点击转向或按 R，扇形为火力覆盖。</p>"
      : "") +
    '<div class="actions">' +
    (placement === "interceptor"
      ? '<button id="rotate-place">↻ 转向 45°</button>'
      : "") +
    '<button id="confirm-place" class="primary" ' +
    (state.error ? "disabled" : "") +
    ">确认" +
    (changing ? "改道" : "部署") +
    ' ↗</button><button id="cancel-place">取消</button></div>';
  if (actions) panel.querySelector(".actions").replaceWith(actions);
  $("#confirm-place").disabled = !!state.error;
  $("#confirm-place").onclick = confirmPlacement;
  $("#cancel-place").onclick = cancelPlacement;
  if ($("#rotate-place"))
    $("#rotate-place").onclick = () => {
      dir += Math.PI / 4;
      preparePlacement(id);
    };
}
function confirmPlacement() {
  if (demo && $("#confirm-place")) {
    const rect = $("#confirm-place").getBoundingClientRect();
    demo.confirmPoint = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }
  if (!pending) return;
  let kind = pending.kind,
    id = pending.id,
    result = game.place(kind, id, dir);
  if (result) {
    cancelPlacement();
    if (typeof result === "object") selectEntity(result);
    renderHUD();
    renderForecast();
  } else preparePlacement(id);
}
function previewRelease(t) {
  pendingRelease = t;
  const routes = {};
  let blocked = game.blocked();
  blocked.delete(t.cell);
  for (let e of game.map.entries)
    routes[e.id] = game.path(e.x + "," + e.y, blocked);
  world.updateRoutes({ routes });
  previewRelease.fingerprint = JSON.stringify([
    game.hazards.map((h) => [h.cells, h.active]),
    game.downgrades,
    game.towers.map((t) => t.cell),
  ]);
  $("#placement").hidden = false;
  $("#placement").innerHTML =
    '<div class="placement-title"><b>旁路恢复 / 撤回设备</b><span>路由预览</span></div><p>浅黄色虚线显示恢复后的路线。再次隔离需要等待 8 秒；情报不予返还。</p>' +
    routeComparison(routes) +
    '<div class="actions"><button id="confirm-release" class="primary">确认恢复直通</button><button id="cancel-release">保留隔离</button></div>';
  $("#confirm-release").onclick = () => {
    if (t.type === "isolate") game.removeTower(t, "撤回");
    else game.sell(t);
    selected = null;
    cancelPlacement();
    renderInspector();
  };
  $("#cancel-release").onclick = cancelPlacement;
}
function directionText(a) {
  return ["南", "东南", "东", "东北", "北", "西北", "西", "西南"][
    ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8
  ];
}
function selectEntity(e) {
  selected = e;
  world.selected = e;
  cancelPlacement();
  renderInspector();
  $(".inspector").scrollIntoView({ block: "nearest", behavior: "instant" });
  audioEngine.tone(500, 0.06);
}
function renderInspector() {
  if (!game) return;
  let el = $("#inspect");
  if (el._entity !== selected) el._variant = null;
  $("#inspect-heading").textContent = selected
    ? "对象信息"
    : placement
      ? "部署说明"
      : "网络监测";
  if (placement && !selected) {
    let d = TOWERS[placement] || ITEMS[placement];
    el.innerHTML =
      '<span class="inspect-id">DEPLOY / PREVIEW</span><div class="inspect-name">' +
      d.name +
      '</div><div class="inspect-copy">' +
      d.desc +
      '</div><div class="inspect-stats">允许位置：' +
      d.place +
      "</div>";
    return;
  }
  if (!selected) {
    el.innerHTML =
      '<span class="inspect-id">GUARDIAN PROCESS / ONLINE</span><div class="inspect-name">保持连通，改变战局。</div><div class="inspect-copy">' +
      game.map.strategy +
      '</div><div class="inspect-stats"><span>已拦截 ' +
      game.stats.kills +
      "</span><span>设备 " +
      game.towers.length +
      "</span><span>路由收敛 " +
      game.stats.reroutes +
      "</span></div>";
    return;
  }
  let e = selected;
  if (e.dead) {
    selected = null;
    renderInspector();
    return;
  }
  if (
    e.type === "platform" ||
    e.type === "road" ||
    e.type === "node" ||
    e.type === "entry" ||
    e.type === "exit" ||
    e.type === "obstacle"
  ) {
    let names = {
      platform: "设备平台",
      road: e.old ? "旧链路" : "业务链路",
      node: "交换节点 · " + e.name,
      entry: "入侵入口 " + e.entry?.id,
      exit: "数据中枢 " + e.exit?.id,
      obstacle: e.name + " / 不可部署",
    };
    el.innerHTML =
      '<span class="inspect-id">CELL / ' +
      e.id +
      '</span><div class="inspect-name">' +
      names[e.type] +
      '</div><div class="inspect-copy">' +
      {
        platform:
          "高架设备接口。部署拦截器、沙箱或修复进程；地面敌人无法通行。",
        road: e.old
          ? "旧协议按链路延迟降低通行速度，并揭露伪装。路线选择与实际移动使用相同的通行代价。"
          : "承载正常业务与入侵流量。防火墙、蜜罐只阻挡敌人，不会切断通行。",
        node: "部署网闸、防火墙或应急隔离器可关闭本节点；确认前显示新路线。恢复直通后有 8 秒隔离保护间隔。",
        entry: "流量入口。不能部署设备，必须始终有到达中枢的路线。",
        exit: "核心数据出口。恶意程序抵达会扣除中枢完整度；完整度归零，防守失败。",
        obstacle:
          e.name === "中央气隙"
            ? "物理隔离的协议空洞。地面威胁必须沿两侧运维环或外围总线绕行。"
            : e.name === "公网流"
              ? "跨网公网数据流。仅专线桥允许地面通行，不能在流域内布防。"
              : "保留的网络基础设施。不能通行或部署；高架接口才是设备的有效位置。",
      }[e.type] +
      "</div>";
    return;
  }
  let enemy = !!ENEMIES[e.type],
    d = enemy
      ? ENEMIES[e.type]
      : TOWERS[e.type] || { name: "应急隔离器", desc: ITEMS.isolate.desc };
  const states = [];
  if (e.encrypted > 0) states.push("加密 " + e.encrypted.toFixed(1) + "s");
  if (e.root > 0) states.push("诱捕 " + e.root.toFixed(1) + "s");
  if (e.slow > 0) states.push("压制减速");
  if (e.shield > 0) states.push("护盾 " + Math.ceil(e.shield));
  if (e.type === "trojan" || (e.type === "boss2" && !e.phase))
    states.push(e.reveal > 0 ? "已显形" : "伪装 / 潜伏");
  let state = states.join(" · ") || "运行正常";
  const blocking = enemy
    ? e.block
      ? "正在交战 → " +
        (TOWERS[game.towers.find((t) => t.id === e.block)?.type]?.name ||
          "隔离器")
      : "向中枢推进 · 路由距离 " + game.distanceToExit(e).toFixed(1)
    : ["firewall", "honey"].includes(e.type)
      ? "阻挡占用 " +
        (e.blocked || 0) +
        " / " +
        game.capacity(e) +
        " · 橙色虚线标记交战对象"
      : "";
  const variant = e.type + ":" + e.level + ":" + e.branch;
  // Keep interactive nodes alive while their telemetry updates.
  if (el._entity === e && el._variant === variant) {
    el.querySelector(".bar i").style.width =
      Math.max(0, (e.hp / e.maxHp) * 100) + "%";
    el.querySelector(".inspect-stats").innerHTML =
      "<span>耐久 " +
      Math.ceil(e.hp) +
      " / " +
      Math.round(e.maxHp) +
      "</span><span>" +
      state +
      "</span>";
    el.querySelector(".engagement-note").textContent = blocking;
    const skill = $("#skill-btn"),
      rotate = $("#rotate-tower");
    if (skill) {
      skill.disabled = e.skillCd > 0 || e.encrypted > 0;
      skill.textContent =
        d.skill + (e.skillCd > 0 ? " " + Math.ceil(e.skillCd) + "s" : "");
    }
    if (rotate) rotate.textContent = "↻ " + directionText(e.dir);
    return;
  }
  el._entity = e;
  el._variant = variant;
  el.innerHTML =
    '<span class="inspect-id">' +
    (enemy
      ? "THREAT / " + e.type.toUpperCase()
      : "DEVICE / LV." +
        e.level +
        (d.branches && e.level === 2 ? " / " + d.branches[e.branch] : "")) +
    '</span><div class="inspect-name">' +
    d.name +
    '</div><div class="bar"><i style="width:' +
    Math.max(0, (e.hp / e.maxHp) * 100) +
    '%"></i></div><div class="inspect-stats"><span>耐久 ' +
    Math.ceil(e.hp) +
    " / " +
    Math.round(e.maxHp) +
    "</span><span>" +
    state +
    '</span></div><div class="inspect-copy">' +
    (e.level === 2
      ? d.branchDetails?.[e.branch] || d.upgrade || d.desc
      : d.desc) +
    '</div><div class="engagement-note">' +
    blocking +
    "</div>";
  if (!enemy && e.type !== "isolate") {
    let btns = '<div class="inspect-actions">';
    if (e.level < 2) {
      let cost = Math.round(d.cost * 0.8);
      if (d.branches)
        d.branches.forEach(
          (b, i) =>
            (btns +=
              '<button data-upgrade="' +
              i +
              '">' +
              b +
              "<br>⬡" +
              cost +
              " ◈8</button>"),
        );
      else
        btns +=
          '<button data-upgrade="0">升级 Lv.2<br>⬡' + cost + " ◈3</button>";
    }
    btns +=
      '<button id="skill-btn" ' +
      (e.skillCd > 0 || e.encrypted > 0 ? "disabled" : "") +
      ">" +
      d.skill +
      (e.skillCd > 0 ? " " + Math.ceil(e.skillCd) + "s" : "") +
      "</button>";
    if (e.type === "interceptor")
      btns +=
        '<button id="rotate-tower">↻ ' + directionText(e.dir) + "</button>";
    btns +=
      '<button class="sell" id="sell-btn">撤下 +' +
      Math.floor((e.paid || 0) * 0.55) +
      '</button></div><div class="inspect-copy" style="font-size:11px;margin-top:8px">技能：' +
      (e.type === "honey" && e.level === 2 && e.branch === 0
        ? "困住 4.5 格诱敌范围内的地面敌人 7 秒。"
        : d.active) +
      "</div>";
    el.innerHTML += btns;
    $$("[data-upgrade]").forEach(
      (b) =>
        (b.onclick = () => {
          game.upgrade(e, +b.dataset.upgrade);
          renderInspector();
        }),
    );
    $("#skill-btn").onclick = () => {
      game.skill(e);
      renderInspector();
    };
    $("#sell-btn").onclick = () => {
      if (game.cell(e.cell).type === "node") previewRelease(e);
      else {
        game.sell(e);
        selected = null;
        renderInspector();
      }
    };
    if ($("#rotate-tower"))
      $("#rotate-tower").onclick = () => {
        e.dir += Math.PI / 4;
        renderInspector();
      };
  } else if (!enemy) {
    el.innerHTML +=
      '<div class="inspect-actions"><button id="remove-isolate">拔出隔离器</button></div>';
    $("#remove-isolate").onclick = () => previewRelease(e);
  }
}
function modal(html, wide = true) {
  if (mode === "game") {
    if ($("#modal").hidden) modalPaused = game.paused;
    game.paused = true;
  }
  $("#modal-content").innerHTML = html;
  $("#modal").hidden = false;
  $("#modal .modal-card").style.width = wide
    ? "min(960px,90vw)"
    : "min(570px,90vw)";
}
function closeModal() {
  if (!$("#modal").hidden && game && mode === "game") game.paused = modalPaused;
  $("#modal").hidden = true;
}
function showMenu() {
  if (mode === "home") {
    showDemos();
    return;
  }
  modal(
    '<div class="eyebrow">GUARDIAN / SYSTEM</div><h2>守护进程控制台</h2><p>当前对局已暂停，业务拓扑保持在当前状态。</p><div class="menu-actions"><button id="resume">▶ 返回战场</button><button id="restart">↻ 重开本图</button><button id="to-home">◈ 区域选择</button><button id="open-demos">▷ 实战演示</button><button id="open-guide">▤ 设备与威胁档案</button><button id="mute-menu">♫ ' +
      (audioEngine.muted ? "开启声音" : "静音") +
      '</button></div><div class="volume-row">系统音量 <input id="volume" type="range" min="0" max="100" value="' +
      audioEngine.volume * 100 +
      '"><span id="volume-value">' +
      Math.round(audioEngine.volume * 100) +
      "%</span></div>",
    false,
  );
  $("#resume").onclick = closeModal;
  $("#restart").onclick = () => start();
  $("#to-home").onclick = () => home();
  $("#open-demos").onclick = showDemos;
  $("#open-guide").onclick = () => showManual();
  $("#mute-menu").onclick = () => {
    toggleSound();
    showMenu();
  };
  $("#volume").oninput = (e) => {
    audioEngine.volume = +e.target.value / 100;
    $("#volume-value").textContent = e.target.value + "%";
  };
}
function showManual(tab = "设备手册") {
  modal(
    '<div class="eyebrow">SENTINEL / KNOWLEDGE BASE</div><h2>防御知识库</h2><div class="modal-tabs">' +
      ["设备手册", "威胁档案", "系统规则", "操作指南"]
        .map(
          (t) =>
            '<button class="' +
            (t === tab ? "active" : "") +
            '" data-tab="' +
            t +
            '">' +
            t +
            "</button>",
        )
        .join("") +
      '</div><div id="manual-body"></div>',
  );
  $$("[data-tab]").forEach(
    (b) => (b.onclick = () => showManual(b.dataset.tab)),
  );
  let content = "";
  if (tab === "设备手册")
    content =
      '<div class="manual-grid">' +
      Object.entries(TOWERS)
        .map(
          ([k, d]) =>
            '<div class="manual-entry">' +
            icon(k) +
            "<h3>" +
            d.name +
            "</h3><small>" +
            d.place +
            " / ⬡" +
            d.cost +
            (d.intel ? " ◈" + d.intel : "") +
            "</small><p>" +
            d.desc +
            "</p><p>Lv.2 · " +
            d.upgrade +
            "</p><small>" +
            d.skill +
            " / " +
            d.cd +
            "s<br>" +
            d.active +
            "</small></div>",
        )
        .join("") +
      "</div>";
  if (tab === "威胁档案")
    content =
      '<div class="manual-grid">' +
      Object.entries(ENEMIES)
        .map(
          ([k, d]) =>
            '<div class="manual-entry threat-entry">' +
            icon(k, "threat-icon") +
            '<span class="inspect-id" style="color:#' +
            d.color.toString(16) +
            '">' +
            (d.boss ? "CRITICAL / BOSS" : "MALWARE / " + k.toUpperCase()) +
            "</span><h3>" +
            d.name +
            "</h3><p>" +
            d.desc +
            "</p><small>基础生命 " +
            d.hp +
            " · " +
            (k === "flyer" ? "无线层飞行" : "地面威胁") +
            "</small></div>",
        )
        .join("") +
      "</div>";
  if (tab === "系统规则")
    content =
      '<div class="manual-grid">' +
      Object.entries(ITEMS)
        .map(
          ([k, d]) =>
            '<div class="manual-entry">' +
            icon(k) +
            "<h3>" +
            d.name +
            "</h3><p>" +
            d.desc +
            "</p><small>" +
            d.place +
            " · " +
            d.cost +
            (d.resource === "intel" ? " 情报" : " 算力") +
            " · 冷却 " +
            d.cd +
            "s</small></div>",
        )
        .join("") +
      [
        [
          "路由与连通",
          "节点隔离、旁路恢复、协议降级及 Boss 封路都会同步更新各入口路线。在场敌人从当前位置连续转向。任何会切断业务或困住敌人的操作都会拒绝且不扣资源。",
        ],
        [
          "检测 / 护盾 / 加密",
          "检测让木马与潜伏 Boss 显形；护盾先承受伤害。加密停止攻击、治疗与技能，但阻挡和隔离保留。备份还原、冗余切换可解除加密，蜜罐免疫加密。",
        ],
        [
          "算力与情报",
          "算力随时间增长与击杀回收。情报来自波次、重点威胁击杀与交战中守住节点。撤下退还 55% 基础算力；隔离情报不退。节点恢复直通后 8 秒内不能再次隔离。",
        ],
        [
          "地形与部署",
          "链路可放防火墙或蜜罐；高架平台可放远程、检测与治疗设备；节点可被隔离。旧链路减速并显形。障碍、公网流与中央气隙不可通行、不可部署。",
        ],
        [
          "威胁优先级",
          "设备优先锁定沿路线接近出口的有效目标。防火墙容量 3，蜜罐容量 2；洪泛团占 2 容量，超出容量的敌人继续推进。压制拦截器优先打击空中目标。",
        ],
        [
          "波次与结算",
          "三张图分别有 14 / 15 / 16 波，最后一波为独立 Boss。后两图第 8 波三入口洪峰。中枢完整度归零失败，全部威胁清除后胜利。清波后有 8 秒整备，也可手动放行。",
        ],
      ]
        .map(
          ([h, p]) =>
            '<div class="manual-entry"><h3>' +
            h +
            "</h3><p>" +
            p +
            "</p></div>",
        )
        .join("") +
      "</div>";
  if (tab === "操作指南")
    content =
      '<div class="manual-grid">' +
      [
        [
          "01 / 接管网络",
          "从区域选择直接进入任意地图。先拖动设备卡片部署，再放行第一波。所有操作都可以在战斗中进行。",
        ],
        [
          "02 / 预览与部署",
          "拖动卡片或点击卡片后选择地块。范围圈预览覆盖区，浅黄色虚线预览各入口新路线。点击确认完成操作；Esc 取消。拦截器按 R 每次转向 45°。",
        ],
        [
          "03 / 镜头与时间",
          "中键拖动环绕，Shift + 中键平移，滚轮缩放。Home 恢复默认视角。空格暂停，右下角切换 1× / 2× / 3×；暂停冻结所有战斗、冷却与波次。",
        ],
        [
          "04 / 对象信息",
          "左键选择设备、敌人或地块。右侧可以查看生命、状态与详细信息，升级、选择分支、释放技能和撤下。数字 1–6 快速选择设备。",
        ],
        [
          "05 / 路由判断",
          "青绿 / 琥珀 / 紫色路线对应 A / B / C。节点标明直通或隔离；目标出口见流量预报。被拒操作会指出入口或在场敌人受困。",
        ],
        [
          "06 / 实战演示",
          "菜单提供三段共 56 秒的实时演示。演示中的拖动、道具与技能都调用同一套游戏逻辑，可随时退出并接管战场。",
        ],
        [
          "内网 / 汇流布防",
          "可先在西边界（3,6）部署网闸，再用（6,6）的沙箱与（8,7）朝西的拦截器覆盖中央流量。洪泛团会回头攻击网闸，需要增援西侧火力与维修。",
        ],
        [
          "骨干 / 双核心接力",
          "先让（3,9）与（11,7）的沙箱分别覆盖两座核心前的通道，再加入朝向来路的拦截器。保留一部分算力维修；汇聚节点被打通后，Y 的防线必须能接住回流。",
        ],
        [
          "工控 / 两侧互保",
          "（4,8）与（12,9）的沙箱可分别检测两侧运维环，核心前的拦截器负责对空。维修与蜜罐能维持狭窄通道；最终波观察红色封路预警，及时补强另一侧。",
        ],
      ]
        .map(
          ([h, p]) =>
            '<div class="manual-entry"><h3>' +
            h +
            "</h3><p>" +
            p +
            "</p></div>",
        )
        .join("") +
      "</div>";
  $("#manual-body").innerHTML = content;
}
function showDemos() {
  modal(
    '<div class="eyebrow">LIVE OPERATIONS / 56 SECONDS</div><h2>实战演示</h2><p>从编排局面实时推演。观察改道、设备受损与恢复如何改变战况。</p>' +
      [
        ["分段取舍", "拖入网闸，预览 A 转入 DMZ，办公网段流量掉头。", 18],
        [
          "旁路直通",
          "洪峰冲垮网闸，B / C 重返原中枢；协议降级缓解 A 的压力。",
          18,
        ],
        ["蛰影现身", "运维环锁死，路线收敛；冗余切换为关键设备续航。", 20],
      ]
        .map(
          ([h, p, t], i) =>
            '<button class="demo-card" data-demo="' +
            i +
            '"><span>0' +
            (i + 1) +
            "</span><div><h3>" +
            h +
            "</h3><p>" +
            p +
            "</p></div><small>" +
            t +
            " SEC ↗</small></button>",
        )
        .join(""),
  );
  $$("[data-demo]").forEach(
    (b) => (b.onclick = () => startDemo(+b.dataset.demo)),
  );
}
function showReport(win) {
  modal(
    '<div class="eyebrow">INCIDENT REPORT / ' +
      game.map.code +
      "</div><h2>" +
      (win ? "威胁已清除。" : "中枢连接已丢失。") +
      '</h2><div class="report-seal">' +
      (win ? "CONTAINED / 事件已闭环" : "BREACH DETECTED / 防线突破") +
      "</div><p>" +
      game.map.name +
      " · 第 " +
      game.wave +
      " 波 · 运行时长 " +
      clock(game.time) +
      "。" +
      (win
        ? "业务链路持续在线。守护进程完成本次响应。"
        : "已保存本次事件遥测，重新部署以恢复防线。") +
      '</p><div class="report-stats"><div><b>' +
      game.stats.kills +
      "</b><small>消灭威胁</small></div><div><b>" +
      game.stats.reroutes +
      "</b><small>路由收敛</small></div><div><b>" +
      Math.round(game.stats.healed) +
      "</b><small>恢复生命</small></div><div><b>" +
      game.integrity +
      "%</b><small>中枢完整度</small></div></div><p>部署 " +
      game.stats.built +
      " 台设备　损失 " +
      game.stats.destroyed +
      " 台　突破流量 " +
      game.stats.lost +
      ' 个</p><div class="menu-actions"><button class="primary" id="report-restart">↻ 重新接管本图</button><button id="report-home">◈ 返回区域选择</button></div>',
  );
  $("#report-restart").onclick = () => start();
  $("#report-home").onclick = () => home();
}
function toggleSound() {
  audioEngine.start();
  audioEngine.muted = !audioEngine.muted;
  audioEngine.mix();
  $("#sound-btn").textContent = audioEngine.muted ? "♪̸" : "♫";
  $("#sound-btn").title = audioEngine.muted ? "开启声音" : "静音";
}
let dragOrigin = null;
document.addEventListener("pointermove", (e) => {
  if (!placement || pending || demo) return;
  let rect = $("#viewport").getBoundingClientRect();
  if (
    e.clientX < rect.left ||
    e.clientX > rect.right ||
    e.clientY < rect.top ||
    e.clientY > rect.bottom
  )
    return;
  let hit = world.pick(e.clientX, e.clientY);
  if (hit?.cell && hit.cell !== hoverCell) {
    hoverCell = hit.cell;
    world.preview(hit.cell, placement, dir);
  }
});
document.addEventListener("pointerup", (e) => {
  if (!dragging || demo) return;
  dragging = false;
  let rect = $("#viewport").getBoundingClientRect();
  if (
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom
  ) {
    let hit = world.pick(e.clientX, e.clientY);
    if (hit?.cell) preparePlacement(hit.cell);
  }
});
$("#world").addEventListener("click", (e) => {
  if (mode !== "game" || demo || e.button !== 0) return;
  let hit = world.pick(e.clientX, e.clientY);
  if (!hit) {
    if (!placement) {
      selected = null;
      renderInspector();
    }
    return;
  }
  if (placement) {
    preparePlacement(hit.cell);
  } else selectEntity(hit.entity || game.cell(hit.cell));
});
document.addEventListener("keydown", (e) => {
  audioEngine.start();
  if (e.key === "Escape") {
    if (demo) {
      exitDemo();
      return;
    }
    if (!$("#modal").hidden) closeModal();
    else if (placement || pendingRelease) cancelPlacement();
    else showMenu();
  }
  if (!$("#modal").hidden || demo) return;
  if (e.key === " " && mode === "game") {
    e.preventDefault();
    game.paused = !game.paused;
    renderHUD();
  }
  if (e.key.toLowerCase() === "r" && placement === "interceptor") {
    dir += Math.PI / 4;
    if (pending) preparePlacement(pending.id);
    else if (hoverCell) world.preview(hoverCell, placement, dir);
  }
  if (e.key === "Home") world.resetCamera();
  if (/^[1-6]$/.test(e.key) && mode === "game")
    choosePlacement(Object.keys(TOWERS)[+e.key - 1]);
});
document.addEventListener("pointerdown", () => audioEngine.start(), {
  once: true,
});
document.addEventListener("click", (e) => {
  if (e.target.closest("button") && !e.target.closest("[disabled]"))
    audioEngine.tone(720, 0.035, "sine", 0.035, 1.2);
});
$("#launch").onclick = () => {
  audioEngine.start();
  start();
};
$("#help-btn").onclick = () => showManual("操作指南");
$("#archive-btn").onclick = () => showManual();
$("#menu-btn").onclick = showMenu;
$("#demos-btn").onclick = showDemos;
$("#sound-btn").onclick = toggleSound;
$("#close-modal").onclick = closeModal;
$(".modal-backdrop").onclick = closeModal;
$("#next-wave").onclick = () => {
  audioEngine.start();
  game.startWave();
  renderForecast();
};
$("#pause-btn").onclick = () => {
  game.paused = !game.paused;
  renderHUD();
};
$("#speed-btn").onclick = () => {
  game.speed = (game.speed % 3) + 1;
  renderHUD();
};
$("#reset-view").onclick = () => world.resetCamera();
$("#routes-btn").onclick = () => {
  world.showRoutes = !world.showRoutes;
  world.routeGroup.visible = world.showRoutes;
  $("#routes-btn").textContent = world.showRoutes ? "◉ 路由可视" : "○ 路由隐藏";
};
$("#exit-demo").onclick = exitDemo;
const DEMO_NAMES = ["分段取舍", "旁路直通", "蛰影现身"],
  DEMO_DURATION = [18, 18, 20];
function startDemo(index) {
  closeModal();
  start(index);
  demo = {
    index,
    time: 0,
    duration: DEMO_DURATION[index],
    fired: new Set(),
    cursor: { x: 100, y: 100 },
  };
  game.demo = true;
  $("#app").classList.add("demo-mode");
  game.compute = 1100;
  game.intel = 110;
  game.wave = index === 0 ? 5 : index === 1 ? 8 : 16;
  game.running = true;
  game.queue = [];
  game.waveTime = 0;
  seedDefense();
  game.stats = {
    kills: 0,
    lost: 0,
    built: game.towers.length,
    destroyed: 0,
    reroutes: 0,
    healed: 0,
  };
  if (index === 0) {
    game.place("firewall", "3,9", 0, true);
    game.place("honey", "11,8", 0, true);
    for (let i = 0; i < 4; i++) {
      let e = game.spawn(
        i === 2 ? "ransom" : "worm",
        "A",
        "3," + (7 + (i % 2)),
        true,
      );
      e.x += i * 0.05;
    }
    game.spawn("flood", "B", "11,7");
    game.spawn("ransom", "B", "11,5");
    game.queue = [
      { type: "worm", entry: "B", time: 5 },
      { type: "trojan", entry: "B", time: 7 },
      { type: "ransom", entry: "B", time: 11 },
    ];
  }
  if (index === 1) {
    let gate = game.place("gate", "12,9", 0, true);
    gate.hp = 380;
    demo.gate = gate;
    game.place("firewall", "2,9", 0, true);
    game.place("honey", "14,5", 0, true);
    for (let i = 0; i < 2; i++) {
      let e = game.spawn("flood", i % 2 ? "B" : "C", "12,8", true);
      e.cd = 1 + i * 0.7;
    }
    game.spawn("ransom", "B", "14,6");
    for (let i = 0; i < 4; i++)
      game.spawn(i % 2 ? "worm" : "trojan", "A", "2," + (3 + i), true);
    game.queue = [
      { type: "flood", entry: "C", time: 1 },
      { type: "worm", entry: "B", time: 2 },
      { type: "ransom", entry: "A", time: 3 },
      { type: "flood", entry: "C", time: 7 },
    ];
  }
  if (index === 2) {
    game.place("firewall", "3,9", 0, true);
    game.place("honey", "13,10", 0, true);
    let boss = game.spawn("boss2", "B", "13,5");
    boss.reveal = 20;
    boss.hp = boss.maxHp * 0.34;
    boss.phase = 2;
    game.emit("bossPhase", { enemy: boss });
    demo.boss = boss;
    game.spawn("ransom", "B", "13,6");
    game.spawn("ransom", "A", "3,7");
    game.spawn("flood", "A", "3,8");
    game.spawn("trojan", "C", "14,6");
    game.spawn("worm", "B", "13,7", true);
    demo.repair = game.towers.find((t) => t.type === "repair");
    if (demo.repair) {
      demo.repair.hp = 90;
      game.towers
        .filter(
          (t) =>
            t !== demo.repair &&
            Math.hypot(t.x - demo.repair.x, t.y - demo.repair.y) < 4,
        )
        .forEach((t) => {
          t.hp *= 0.75;
          t.shield = 35;
          t.encrypted = 13;
        });
    }
    game.queue = [
      { type: "worm", entry: "A", time: 3 },
      { type: "ransom", entry: "C", time: 5 },
      { type: "trojan", entry: "B", time: 8 },
    ];
  }
  game.recompute(false);
  $("#demo-ui").hidden = false;
  $("#demo-name").textContent = "0" + (index + 1) + " / " + DEMO_NAMES[index];
  $("#demo-cursor span").textContent = "守护进程";
  $("#demo-subtitle").textContent = "";
  world.resetCamera();
  renderForecast();
  renderHUD();
  renderInspector();
  demoVisual(0);
  world.sync(0);
  world.render();
}
function once(key, time, fn) {
  if (demo.time + 1e-7 >= time && !demo.fired.has(key)) {
    demo.fired.add(key);
    fn();
  }
}
function demoStep(dt) {
  if (!demo || game.paused) return;
  demo.time += dt;
  const idx = demo.index;
  if (idx === 0) {
    once("choose", 1.6, () => choosePlacement("gate"));
    once("preview", 3.2, () => preparePlacement("3,6"));
    once("incoming", 4.4, () => {
      game.spawn("worm", "A", "3,3", true);
      game.spawn("flood", "A", "3,4", true);
      game.spawn("ransom", "A", "3,3", true);
    });
    once("confirm", 6, () => {
      pending = { kind: "gate", id: "3,6" };
      placement = "gate";
      confirmPlacement();
    });
    once("select-honey", 8.8, () => {
      let t = game.towers.find((t) => t.type === "honey");
      if (t) selectEntity(t);
    });
    once("honey", 10, () => {
      let t = game.towers.find((t) => t.type === "honey");
      if (t) game.skill(t);
    });
  }
  if (idx === 1) {
    once("collapse", 5.8, () => {
      if (!demo.gate.dead)
        game.damageTower(
          demo.gate,
          1000,
          game.enemies.find((e) => e.type === "flood") || { x: 12, y: 8 },
        );
    });
    once("choose", 6.6, () => choosePlacement("downgrade"));
    once("preview", 8.2, () => preparePlacement("2,5"));
    once("confirm", 10, () => {
      pending = { kind: "downgrade", id: "2,5" };
      placement = "downgrade";
      confirmPlacement();
    });
  }
  if (idx === 2) {
    once("warning", 3, () => game.setHazard(["13,9", "3,5"], 14, 2));
    once("select", 8, () => {
      if (demo.repair && !demo.repair.dead) selectEntity(demo.repair);
    });
    once("repair", 10.5, () => {
      if (demo.repair && !demo.repair.dead) {
        game.skill(demo.repair);
      }
    });
    once("reinforce", 14, () => game.spawn("ransom", "C", "14,6"));
  }
  game.step(dt);
  world.sync(dt);
  demoVisual(demo.time);
  if (!exportMode && demo.time >= demo.duration) {
    let index = demo.index;
    exitDemo();
    notify("实战演示完成 · 现在可以接管战场");
    game.paused = true;
    renderHUD();
  }
}
function demoVisual(t) {
  if (!demo) return;
  let idx = demo.index,
    p = {},
    label = "守护进程",
    click = false,
    sub = "";
  // Project cursor targets after the current frame's camera, without a one-frame lag.
  if (idx === 0) cameraDemo(t, 3, 6, 1.27, 10, 7, 1.2);
  if (idx === 1) cameraDemo(t, 12, 8, 1.3, 3, 6, 1.2);
  if (idx === 2)
    cameraDemo(t, 13, 7, 1.28, demo.repair?.x || 4, demo.repair?.y || 9, 1.22);
  let r = $("#viewport").getBoundingClientRect();
  const center = { x: r.left + r.width * 0.5, y: r.top + r.height * 0.55 };
  let target =
    idx === 0
      ? world.project(3, 6, 0.5)
      : idx === 1
        ? world.project(12, 9, 1)
        : world.project(13, 8, 1);
  function rectPoint(selector) {
    let el = $(selector);
    if (!el) return center;
    let b = el.getBoundingClientRect();
    return { x: b.left + b.width * 0.5, y: b.top + b.height * 0.5 };
  }
  function mix(a, b, f) {
    f = Math.max(0, Math.min(1, f));
    f = f * f * (3 - 2 * f);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  if (idx === 0) {
    sub =
      t < 1.6
        ? "分段内网 / 办公网段正承受持续入侵。"
        : t < 3.2
          ? "拖入网闸，接管西边界交换节点。"
          : t < 6
            ? "预览：A 将转入 DMZ，与 B 汇流。业务链路仍然连通。"
            : t < 10
              ? "确认隔离。办公网段的敌人从当前位置转向备用链路。"
              : t < 14
                ? "蜜罐诱捕，分担东侧防线压力；隔离点仍需持续守护。"
                : "隔离换来火力集中，也把压力带到了另一侧。";
    let card = rectPoint('[data-tower="gate"]');
    if (t < 1.6) p = mix(center, card, t / 1.6);
    else if (t < 3.2) {
      p = mix(card, target, (t - 1.6) / 1.6);
      label = "拖动 · 网闸";
      click = true;
    } else if (t < 5.1) {
      p = target;
      label = "预览新路由";
    } else if (t < 6) {
      p = mix(target, rectPoint("#confirm-place"), (t - 5.1) / 0.9);
      label = "确认隔离";
    } else if (t < 7) {
      p = mix(demo.confirmPoint || target, target, Math.max(0, t - 6.3) / 0.7);
      label = "节点已隔离";
      click = t < 6.3;
    } else {
      p = target;
      label = "节点已隔离";
    }
    if (t >= 7.6) {
      let a = game.towers.find((t) => t.type === "honey");
      const hp = a ? world.project(a.x, a.y, 1.3) : target;
      const skill = rectPoint("#skill-btn");
      if (t < 8.8) p = mix(target, hp, (t - 7.6) / 1.2);
      else if (t < 9.2) p = hp;
      else if (t < 10) p = mix(hp, skill, (t - 9.2) / 0.8);
      else p = mix(skill, hp, Math.max(0, t - 10.35) / 1.1);
      label = t < 8.8 ? "选择蜜罐" : t < 10 ? "释放诱捕" : "诱捕已释放";
      click = (t >= 8.8 && t < 9.1) || (t >= 10 && t < 10.35);
    }
  }
  if (idx === 1) {
    sub =
      t < 2
        ? "骨干流域 / 三入口洪峰，汇聚网闸正承受重击。"
        : t < 5.8
          ? "洪泛团离开主路，冲击隔离点；修复火力只能暂缓损耗。"
          : t < 8.2
            ? "网闸被冲垮。旁路恢复，B / C 重新流向数据中心 Y。"
            : t < 10
              ? "在 A 的主路预览协议降级，以通行速度引导流量。"
              : t < 14
                ? "降级协议生效：减速、显形，争取重新布防的时间。"
                : "有代价的改道：隔离消失，原有交战分布随之改变。";
    let item = rectPoint('[data-item="downgrade"]'),
      dest = world.project(2, 5, 0.3);
    if (t < 5.8) {
      p = target;
      label = "网闸受损";
    } else if (t < 6.6) {
      p = mix(target, item, (t - 5.8) / 0.8);
      label = "选择协议降级";
    } else if (t < 8.2) {
      p = mix(item, dest, (t - 6.6) / 1.6);
      label = "投放 · 协议降级";
      click = true;
    } else if (t < 9) {
      p = dest;
      label = "预览减速区域";
    } else if (t < 10) {
      p = mix(dest, rectPoint("#confirm-place"), t - 9);
      label = "确认投放";
    } else {
      p = mix(demo.confirmPoint || dest, dest, Math.max(0, t - 10.3) / 0.9);
      label = "旧协议已生效";
      click = t < 10.3;
    }
  }
  if (idx === 2) {
    sub =
      t < 3
        ? "气隙深层 / 最终波。蛰影进入破坏阶段。"
        : t < 5
          ? "链路锁死预警：运维环即将中断，备用通路仍然可用。"
          : t < 8
            ? "锁死生效。入口路线重新收敛，在场敌人转入外环。"
            : t < 10.5
              ? "选择修复进程。附近设备被加密，生命持续下降。"
              : t < 14
                ? "冗余切换：解除加密、提供护盾，恢复整条防线。"
                : "守住设备，才能守住路线。核心威胁仍在推进。";
    let rp = demo.repair
      ? world.project(demo.repair.x, demo.repair.y, 1.3)
      : center;
    if (t < 7) p = target;
    else if (t < 8) p = mix(target, rp, t - 7);
    else if (t < 9.5) {
      p = rp;
      label = "修复进程";
      click = t < 8.3;
    } else if (t < 10.5) {
      p = mix(rp, rectPoint("#skill-btn"), t - 9.5);
      label = "冗余切换";
    } else {
      p = mix(rectPoint("#skill-btn"), rp, Math.max(0, t - 10.8) / 1.1);
      label = "护盾上线 / 加密解除";
      click = t < 10.8;
    }
  }
  $("#demo-cursor").style.left = p.x / uiScale + "px";
  $("#demo-cursor").style.top = p.y / uiScale + "px";
  $("#demo-cursor").classList.toggle("click", click);
  $("#demo-cursor span").textContent = label;
  $("#demo-subtitle").textContent = sub;
  $("#demo-progress-bar").style.width =
    Math.min(100, (t / demo.duration) * 100) + "%";
}
function cameraDemo(t, x, y, z, x2, y2, z2) {
  let focus =
    t < 2
      ? 0
      : t < 5
        ? (t - 2) / 3
        : t < 12
          ? 1
          : t < 16
            ? 1 - (t - 12) / 4
            : 0;
  let transition = t >= 9 && t <= 12 ? (t - 9) / 3 : t > 12 ? 1 : 0;
  let q = world.pos(x, y).lerp(world.pos(x2, y2), transition);
  world.target.set(q.x * focus, 0, q.z * focus);
  world.zoom = 1 + (z + (z2 - z) * transition - 1) * focus;
  world.updateCamera();
}
function exitDemo() {
  $("#app").classList.remove("demo-mode");
  demo = null;
  exportMode = false;
  document.body.classList.remove("exporting");
  $("#demo-ui").hidden = true;
  cancelPlacement();
  game.demo = false;
  game.paused = false;
  world.resetCamera();
  renderHUD();
}
window.videoExport = {
  runs: ["demo-1", "demo-2", "demo-3"],
  async begin(runId, { fps = 60 } = {}) {
    let i = this.runs.indexOf(runId);
    if (i < 0) throw new Error("Unknown run: " + runId);
    fps = Number(fps);
    if (!(fps > 0 && fps <= 240)) throw new Error("fps must be in (0, 240]");
    exportMode = true;
    audioEngine.mix();
    clearTimeout(notify.timer);
    startDemo(i);
    exportMode = true;
    this.fps = fps;
    this.last = -1;
    this.frames = Math.ceil(DEMO_DURATION[i] * fps);
    document.body.classList.add("exporting");
    renderHUD();
    renderInspector();
    world.sync(0);
    world.render();
    return { frames: this.frames };
  },
  async frame(i) {
    if (!exportMode || !demo) throw new Error("Call begin first");
    if (!Number.isInteger(i) || i < 0 || i >= this.frames)
      throw new Error("Frame out of range");
    if (i < this.last) throw new Error("Frames must be sequential");
    game.paused = false;
    let target = i / this.fps;
    while (demo.time < target - 1e-8) {
      let dt = Math.min(1 / 60, target - demo.time);
      demoStep(dt);
    }
    renderHUD();
    renderInspector();
    renderForecast();
    renderItems();
    refreshPlacement();
    demoVisual(target);
    world.sync(0);
    world.render();
    this.last = i;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return { frame: i, time: target };
  },
  end() {
    if (demo) exitDemo();
    else exportMode = false;
    return { ok: true };
  },
};
let uiScale = 1;
function fitInterface() {
  uiScale = innerWidth >= 2400 ? innerWidth / 1920 : 1;
  document.body.style.zoom = uiScale;
  $("#app").style.height = innerHeight / uiScale + "px";
  if (world) {
    world.renderer.setPixelRatio(Math.min(devicePixelRatio * uiScale, 2));
    world.resize();
  }
}
addEventListener("resize", fitInterface);
fitInterface();
world = new World($("#world"), $("#viewport"));
fitInterface();
home(0);
let last = performance.now(),
  accumulator = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let elapsed = Math.max(0, Math.min(0.08, (now - last) / 1000));
  last = now;
  if (exportMode) return;
  if (mode === "home") {
    game.time += elapsed;
    world.sync(elapsed);
  } else if (demo) {
    accumulator += elapsed * game.speed;
    if (game.paused) accumulator = 0;
    while (accumulator >= 1 / 60) {
      demoStep(1 / 60);
      accumulator -= 1 / 60;
      if (!demo) break;
    }
  } else {
    accumulator += elapsed * game.speed;
    if (game.paused) accumulator = 0;
    while (accumulator >= 1 / 60) {
      game.step(1 / 60);
      world.sync(1 / 60);
      accumulator -= 1 / 60;
    }
    if (game.paused) world.sync(0);
  }
  uiTick += elapsed;
  if (uiTick > 0.18) {
    uiTick = 0;
    renderHUD();
    if (mode === "game") {
      renderInspector();
      renderItems();
      renderForecast();
      refreshPlacement();
    }
  }
  if (demo) demoVisual(demo.time);
  world.projectLabels();
  world.render();
  audioEngine.music();
}
requestAnimationFrame(loop);
window.sentinel = {
  start,
  home,
  startDemo,
  choosePlacement,
  preparePlacement,
  confirmPlacement,
  selectEntity,
  get game() {
    return game;
  },
  get world() {
    return world;
  },
};
