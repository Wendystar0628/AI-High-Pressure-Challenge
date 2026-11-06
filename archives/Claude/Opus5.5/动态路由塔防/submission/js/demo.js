// 实战演示：从编排好的局面开始，操作走真实的交互接口，改道与效果由游戏逻辑实时演出。
(function () {
  const TD = window.TD;
  const $ = (id) => document.getElementById(id);

  class Cancelled extends Error {}

  const Demo = TD.Demo = {
    active: null,
    list: [
      { map: 'intranet', seed: 20261101, title: '分段取舍', desc: '玩家把网闸拖到西边界节点，预览中 A 折向 DMZ 互联，确认后办公网段的敌人掉头，与 B 汇流。', run: runSegment },
      { map: 'backbone', seed: 20261102, title: '旁路直通', desc: '洪峰中洪泛团冲垮节点上的网闸，C、B 的路线改回原来的数据中心，玩家同时在 A 的路线上投下协议降级。', run: runBypass },
      { map: 'airgap', seed: 20261103, title: '蛰影现身', desc: '第 16 波，蛰影锁死前方一段运维环，各入口路线重新收敛，玩家选中修复进程释放冗余切换。', run: runZheying },
    ],

    start(i) {
      const d = this.list[i];
      const ctx = this.newContext();
      TD.App.startMap(d.map, { demo: true, seed: d.seed, setup: (game) => this.launch(i, ctx, game) });
    },

    newContext() {
      return (this.active = { waits: [], tickers: [], t: 0, cancelled: false, cx: innerWidth * 0.5, cy: innerHeight * 0.5 });
    },

    launch(i, ctx, game) {
      const d = this.list[i];
      const app = TD.App;
      ctx.game = game;
      $('demotitle').textContent = `实战演示 · ${d.title}`;
      document.body.classList.add('demo');
      $('demotitle').style.display = 'block';
      $('demoexit').style.display = 'block';
      $('demobar').classList.add('show');
      $('fakecursor').style.display = 'block';
      this.setCursor(ctx.cx, ctx.cy);
      d.run(ctx, game, app.ui, app.view).then(() => this.finish(ctx)).catch((e) => {
        if (e instanceof Cancelled) return;
        console.error(e);
        if (ctx.exporting) { ctx.error = e; ctx.ended = true; }
      });
    },

    finish(ctx) {
      if (this.active !== ctx) return;
      ctx.ended = true;
      if (!ctx.exporting) this.exit();
    },

    // 中止当前演示并收起演示界面
    abort() {
      const ctx = this.active;
      if (!ctx) return;
      ctx.cancelled = true;
      for (const w of ctx.waits) w.reject(new Cancelled());
      ctx.waits = [];
      this.active = null;
      document.querySelectorAll('.clickfx, .fake-hover').forEach((e) => { if (e.classList.contains('clickfx')) e.remove(); else e.classList.remove('fake-hover'); });
      document.body.classList.remove('demo');
      $('demotitle').style.display = 'none';
      $('demoexit').style.display = 'none';
      $('demobar').classList.remove('show');
      $('fakecursor').style.display = 'none';
    },

    exit() {
      if (!this.active || TD.App.exporting) return;
      this.abort();
      TD.App.ui.fade(true, '退出演示…');
      const nav = ++TD.App.nav;
      setTimeout(() => { if (nav !== TD.App.nav) return; TD.App.toMenu(); TD.App.ui.fade(false); }, 260);
    },

    update(dt) {
      const ctx = this.active;
      if (!ctx || !ctx.game || TD.App.game !== ctx.game) return;
      ctx.t += dt;
      for (const f of ctx.tickers.slice()) {
        if (f.t != null) { f.left -= dt; if (f.left <= 0) { f.left += f.t; f.fn(); } } else f.fn(dt);
      }
      for (let i = ctx.waits.length - 1; i >= 0; i--) {
        const w = ctx.waits[i];
        if (w.until != null ? ctx.t >= w.until : w.cond()) { ctx.waits.splice(i, 1); w.resolve(); }
      }
    },

    caption(text) {
      const c = $('democap');
      c.textContent = text;
      c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse');
    },

    setCursor(x, y) {
      const c = $('fakecursor');
      c.style.left = x + 'px'; c.style.top = y + 'px';
    },
  };

  // ─── 演示脚本可用的动作 ───
  function wait(ctx, s) { return new Promise((resolve, reject) => { ctx.waits.push({ until: ctx.t + s, resolve, reject }); }); }
  function waitFor(ctx, cond, max) {
    const t0 = ctx.t;
    return new Promise((resolve, reject) => { ctx.waits.push({ cond: () => cond() || ctx.t - t0 > (max || 20), resolve, reject }); });
  }
  function every(ctx, s, fn) { ctx.tickers.push({ t: s, left: s, fn }); }

  // 走到时间轴上的某一刻。动作耗时不同也不影响总时长
  function until(ctx, t) { return wait(ctx, Math.max(0, t - ctx.t)); }

  // 人手移动鼠标的耗时：按菲茨定律估算，距离以屏高为单位，和分辨率无关
  function handTime(dx, dy, drag) {
    const D = Math.hypot(dx, dy) / innerHeight;
    return Math.min(1.1, (0.16 + 0.17 * Math.log2(1 + D / 0.035)) * (drag ? 1.2 : 1));
  }

  // target 每帧重新取：镜头在动时目标的屏幕位置也在变。路径带一点弧度，起停平滑
  function moveCursor(ctx, target, opts) {
    opts = opts || {};
    const sx = ctx.cx, sy = ctx.cy, t0 = ctx.t, first = target();
    const dur = handTime(first.x - sx, first.y - sy, opts.drag);
    ctx.bend = -(ctx.bend || 0.045);
    const bend = ctx.bend;
    return new Promise((resolve, reject) => {
      const tk = { fn: () => {
        const k = Math.min(1, (ctx.t - t0) / dur), e = k * k * k * (10 - 15 * k + 6 * k * k);
        const g = target(), arc = bend * Math.sin(Math.PI * k);
        ctx.cx = sx + (g.x - sx) * e - (g.y - sy) * arc;
        ctx.cy = sy + (g.y - sy) * e + (g.x - sx) * arc;
        Demo.setCursor(ctx.cx, ctx.cy);
        if (opts.onMove) opts.onMove(ctx.cx, ctx.cy);
      } };
      ctx.tickers.push(tk);
      ctx.waits.push({ until: t0 + dur, resolve: () => { ctx.tickers.splice(ctx.tickers.indexOf(tk), 1); resolve(); }, reject });
    });
  }

  function tileScreen(view, x, y) { return view.project(view.X(x), view.groundAt(x, y) + 0.2, view.Z(y)); }
  function elCenter(e) { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  // 按下：光标收缩，落点留一圈涟漪
  function press(ctx, on) {
    $('fakecursor').classList.toggle('down', on);
    if (!on) return;
    const fx = document.createElement('div');
    fx.className = 'clickfx';
    fx.style.left = ctx.cx + 'px'; fx.style.top = ctx.cy + 'px';
    document.getElementById('ui').appendChild(fx);
    TD.Clock.setTimeout(() => fx.remove(), 420);
  }

  async function dragCardTo(ctx, ui, view, kind, id, x, y) {
    const card = ui.cards[(kind === 'tower' ? 't_' : 'i_') + id];
    await moveCursor(ctx, () => elCenter(card));
    card.classList.add('fake-hover');
    await wait(ctx, 0.14);
    press(ctx, true);
    TD.Audio.play('pick');
    ui.beginDrag(kind, id);
    ui.dragMove(ctx.cx, ctx.cy);
    card.classList.remove('fake-hover');
    await wait(ctx, 0.08);
    await moveCursor(ctx, () => tileScreen(view, x, y), { drag: true, onMove: (cx, cy) => ui.dragMove(cx, cy) });
    ui.dragMove(ctx.cx, ctx.cy);
    // 松手前镜头可能还在动，光标贴住目标格
    const tk = { fn: () => { const p = tileScreen(view, x, y); ctx.cx = p.x; ctx.cy = p.y; Demo.setCursor(p.x, p.y); } };
    ctx.tickers.push(tk);
    ctx.glue = { tk, x, y, view };
  }
  async function release(ctx, ui) {
    const g = ctx.glue;
    if (g) {
      ctx.tickers.splice(ctx.tickers.indexOf(g.tk), 1);
      ctx.glue = null;
      const p = tileScreen(g.view, g.x, g.y);
      ctx.cx = p.x; ctx.cy = p.y;
      Demo.setCursor(p.x, p.y);
    }
    press(ctx, false);
    ui.dragDrop(ctx.cx, ctx.cy);
  }

  // 移过去、停一下、点击。选择器每帧重新查：面板可能还在滑入
  async function clickEl(ctx, sel) {
    const find = () => document.querySelector(sel);
    if (!find()) return;
    await moveCursor(ctx, () => { const e = find(); return e ? elCenter(e) : { x: ctx.cx, y: ctx.cy }; });
    const e = find();
    if (!e) return;
    e.classList.add('fake-hover');
    await wait(ctx, 0.14);
    press(ctx, true);
    await wait(ctx, 0.09);
    TD.Audio.play('uiClick');
    press(ctx, false);
    e.click();
    e.classList.remove('fake-hover');
  }

  // 在地图上点选一座塔
  async function clickTower(ctx, ui, view, t) {
    await moveCursor(ctx, () => tileScreen(view, t.x, t.y));
    await wait(ctx, 0.12);
    press(ctx, true);
    await wait(ctx, 0.09);
    press(ctx, false);
    TD.Audio.play('pick');
    if (!t.gone) ui.select({ kind: 'tower', unit: t });
  }

  // 编排好的局面一开始就在：不播落地动画，部署记录也不刷进日志
  function staged(game, view) {
    for (const t of game.towers) t.preplaced = true;
    const skip = { towerPlaced: 1, towerUpgraded: 1, log: 1, nodeIsolated: 1, routeChange: 1, routesUpdated: 1 };
    game.events = game.events.filter((e) => !skip[e.type]);
    game.logs.length = 0;
    view.rebuildRoutes(true);
  }

  // 把敌人放到路线上的第 k 格
  function onRoute(game, type, ent, k, extra) {
    const r = game.routes[ent].path;
    const i = r[Math.min(k, r.length - 2)], j = r[Math.min(k + 1, r.length - 1)];
    const w = game.map.w;
    const fx = i % w, fy = (i / w) | 0, tx = j % w, ty = (j / w) | 0;
    return game.spawn(type, ent, Object.assign({ at: { x: fx, y: fy, fx, fy, tx, ty } }, extra || {}));
  }

  function give(game, c, i) { game.compute = c; game.intel = i; }

  // ─── 演示镜头 ───
  // 开场停在全景，随后推近到交战区并跟着战况走。只写镜头目标值，时间全部来自 dt，导出时结果不变。
  function smooth(s, key, target, st, dt) { // 临界阻尼平滑，起停都不突兀
    const vk = key + 'V';
    const w = 2 / st, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const ch = s[key] - target, tmp = (s[vk] + w * ch) * dt;
    s[vk] = (s[vk] - w * tmp) * e;
    s[key] = target + (ch + tmp) * e;
  }

  // 当前的交战点：正在打、正在挨打、Boss 和预警位置权重高，只是在赶路的敌人权重低
  function combatPoints(game, shot) {
    const pts = [], mw = game.map.w;
    const add = (x, y, w) => { if (w > 0) pts.push({ x, y, w }); };
    for (const e of game.enemies) {
      if (e.dead) continue;
      let w = e.fly ? 0.05 : 0.12;
      if (e.blockedBy) w += 1.2;
      if (e.sieging) w += 2.4; else if (e.mode === 'siege') w += 1.0;
      if (e.def.ranged && e.aimTarget) w += 0.9;
      if (e.hitAnim > 0) w += 0.8;
      if (e.trapT > 0) w += 0.4;
      // Boss 模型很高，取它的视觉中心，否则头部会被挤出画面
      if (e.def.boss) add(e.x, e.y - 2.4, w + 3.5); else add(e.x, e.y, w);
    }
    for (const t of game.towers) add(t.x, t.y, (t.hitAnim > 0 ? 1.0 : 0) + (t.attackTarget ? 0.25 : 0));
    for (const w of game.warnings) for (const i of w.tiles) add(i % mw, (i / mw) | 0, 3.5);
    for (const h of game.holes) for (const i of h.tiles) add(i % mw, (i / mw) | 0, 1.2);
    if (shot.anchor) {
      const a = shot.anchor.ref;
      if (!a.dead) add(a.x, a.y - (a.def && a.def.boss ? 2.4 : 0), shot.anchor.w);
    }
    return pts;
  }

  // 找最密集的一团：先选得分最高的点，再向局部重心收敛。靠近当前焦点的加分，避免在两处之间来回跳
  function findCluster(pts, last) {
    const sig2 = 2 * 3.5 * 3.5;
    let best = null, bs = -1;
    for (const p of pts) {
      if (p.w < 0.5) continue;
      let sc = 0;
      for (const q of pts) sc += q.w * Math.exp(-((q.x - p.x) ** 2 + (q.y - p.y) ** 2) / sig2);
      if (last) sc *= 1 + 0.35 * Math.exp(-((last.x - p.x) ** 2 + (last.y - p.y) ** 2) / sig2);
      if (sc > bs) { bs = sc; best = p; }
    }
    if (!best) return null;
    let cx = best.x, cy = best.y, W = 0, sx = 0, sy = 0;
    for (let it = 0; it < 3; it++) {
      let mx = 0, my = 0;
      W = 0;
      for (const q of pts) { const g = q.w * Math.exp(-((q.x - cx) ** 2 + (q.y - cy) ** 2) / sig2); W += g; mx += g * q.x; my += g * q.y; }
      cx = mx / W; cy = my / W;
    }
    for (const q of pts) { const g = q.w * Math.exp(-((q.x - cx) ** 2 + (q.y - cy) ** 2) / sig2); sx += g * (q.x - cx) ** 2; sy += g * (q.y - cy) ** 2; }
    return { x: cx, y: cy, sx: Math.sqrt(sx / W), sy: Math.sqrt(sy / W) };
  }

  function directCamera(ctx, game, view) {
    const r = view.rig, S = TD.RULES.tile;
    const s = { x: r.tTarget.x, xV: 0, z: r.tTarget.z, zV: 0, d: r.tDist, dV: 0, phi: r.tPhi, phiV: 0, th: r.tTheta, thV: 0 };
    let shot = { kind: 'wide' }, focus = null, halfW = 8 * S, halfD = 8 * S, sample = 0;

    // 让焦点落在界面没有遮挡的区域中央，并求出刚好装下 halfW × halfD 的距离
    const frame = (phi, th) => {
      const ins = view.insets, rem = ins.l / 17, W = view.size.w, H = view.size.h;
      const t = ins.t + (game.boss ? 2.2 * rem : 0), b = ins.b + 3.4 * rem, l = ins.l, rr = ins.r + (shot.right ? 21 * rem : 0);
      const tan = Math.tan(view.camera.fov * Math.PI / 360);
      const d0 = view.defaultCam.dist;
      const d = Math.max(0.34 * d0, Math.min(d0, Math.max(halfW * H / ((W - l - rr) * tan), halfD * Math.sin(phi) * H / ((H - t - b) * tan))));
      const k = 2 * d * tan / H, ox = (l - rr) / 2, oy = (t - b) / 2;
      const fx = view.X(focus.x), fz = view.Z(focus.y);
      return {
        d,
        x: fx - Math.cos(th) * ox * k - Math.sin(th) * oy * k / Math.sin(phi),
        z: fz + Math.sin(th) * ox * k - Math.cos(th) * oy * k / Math.sin(phi),
      };
    };

    const update = (dt) => {
      if (dt <= 0) return;
      const def = view.defaultCam;
      let g;
      if (shot.kind === 'wide') {
        g = { x: def.target.x, z: def.target.z, d: def.dist, phi: def.phi, th: def.theta };
      } else {
        if (shot.kind === 'follow') {
          sample -= dt;
          if (sample <= 0) {
            sample = 0.25;
            const c = findCluster(combatPoints(game, shot), focus);
            if (c) {
              focus = { x: c.x, y: c.y };
              const hw = (1.8 * c.sx + 2.6) * S, hd = (1.8 * c.sy + 2.6) * S;
              // 大小变化不明显时不动，镜头不会跟着呼吸
              if (Math.abs(hw - halfW) > 0.12 * halfW) halfW = hw;
              if (Math.abs(hd - halfD) > 0.12 * halfD) halfD = hd;
            }
          }
        }
        if (focus) {
          const span = game.map.w * S / 2;
          const phi = shot.kind === 'fit' ? 0.88 : 0.8;
          const th = shot.kind === 'fit' ? 0 : Math.max(-1, Math.min(1, view.X(focus.x) / span)) * 0.14;
          const f = frame(phi, th);
          g = { x: f.x, z: f.z, d: f.d, phi, th };
        } else {
          g = { x: s.x, z: s.z, d: s.d, phi: s.phi, th: s.th };
        }
      }
      const stPos = shot.kind === 'follow' ? 1.25 : 0.9;
      smooth(s, 'x', g.x, stPos, dt);
      smooth(s, 'z', g.z, stPos, dt);
      smooth(s, 'd', g.d, 1.1, dt);
      smooth(s, 'phi', g.phi, 1.3, dt);
      smooth(s, 'th', g.th, 1.6, dt);
      r.tTarget.set(s.x, 0, s.z);
      r.tDist = s.d; r.tPhi = s.phi; r.tTheta = s.th;
    };
    ctx.tickers.push({ fn: update });

    return {
      wide() { shot = { kind: 'wide' }; },
      // 跟随交战区；anchor 是这一拍剧情要留在画面里的位置或单位（单位会被实时跟随）
      follow(anchor, w) {
        shot = { kind: 'follow', anchor: anchor ? { ref: anchor, w: w || 2.5 } : null };
        sample = 0;
      },
      // 对准一格，等操作完成
      hold(x, y, half, right) {
        shot = { kind: 'hold', right: !!right };
        focus = { x, y };
        halfW = halfD = (half || 5) * S;
      },
      // 把一串地块（比如改道后的路线）都装进画面
      fit(tiles) {
        const w = game.map.w;
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const i of tiles) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        shot = { kind: 'fit' };
        focus = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
        halfW = ((x1 - x0) / 2 + 1.6) * S;
        halfD = ((y1 - y0) / 2 + 1.6) * S;
      },
    };
  }

  // ─── 分段取舍（18.5 秒）───
  // 局面：A 线防线单薄、快被啃穿；DMZ 和业务网段的火力闲着。改道让这些火力开张，代价是洪泛团回头砸网闸。
  async function runSegment(ctx, game, ui, view) {
    game.waveIdx = 4;
    game.seenThreats = { worm: 1, flood: 1, trojan: 1 };
    give(game, 2000, 200);
    const place = (t, x, y, d) => game.placeTower(t, x, y, d || 0).tower;
    const fw = place('firewall', 7, 7);
    fw.hp = fw.maxHp * 0.42;
    place('interceptor', 4, 5, 0); place('interceptor', 4, 6, 0);
    // A 线此刻够不到的火力
    place('interceptor', 9, 3, -2.0); place('sandbox', 9, 4); place('interceptor', 16, 3, Math.PI);
    place('interceptor', 18, 4, Math.PI / 2); place('sandbox', 16, 8); place('interceptor', 14, 8, Math.PI / 2);
    place('repair', 17, 7); place('firewall', 15, 8);
    // 核心前只剩一门拦截器，漏过去的敌人真的会打到中枢
    place('interceptor', 10, 12, 0.6);
    staged(game, view);
    give(game, 420, 26);
    game.log('warn', '研判：办公网段入口压力上升，业务网段的火力覆盖不到 A 线');
    const W = game.nodes.find(nd => nd.id === 'W');
    const cam = directCamera(ctx, game, view);
    const types = ['flood', 'worm', 'flood', 'trojan', 'worm', 'flood', 'worm', 'worm', 'packer'];
    let n = 0;
    every(ctx, 1.05, () => { if (n < 17) { game.spawn(types[n % types.length], 'A'); n++; } });
    every(ctx, 2.6, () => game.spawn('worm', 'B'));
    for (let k = 3; k <= 10; k++) onRoute(game, 'worm', 'A', k);
    for (const k of [15, 17, 18, 19, 20]) onRoute(game, 'worm', 'A', k, { clone: true });
    onRoute(game, 'worm', 'B', 12); onRoute(game, 'worm', 'B', 9);

    Demo.caption('A 线的防火墙快被啃穿了，业务网段的火力够不到这里。');
    await until(ctx, 1.2);
    cam.follow(fw, 2);
    await until(ctx, 2.9);
    Demo.caption('把网闸拖到西边界节点：隔离它，把 A 赶去 DMZ 互联。');
    const area = [W.idx, game.idx(7, 7)];
    for (let x = 5; x <= 15; x++) area.push(game.idx(x, 2));
    cam.fit(area);
    await dragCardTo(ctx, ui, view, 'tower', 'gate', W.x, W.y);
    Demo.caption('预览：白色虚线是新路线，A 多走 20 跳，但会进入火力范围。');
    await wait(ctx, 1.9);
    await release(ctx, ui);
    await wait(ctx, 0.3);
    await clickEl(ctx, '#rp-yes');
    Demo.caption('确认隔离：路由收敛，办公网段入口的敌人当场掉头，退回 DMZ。');
    cam.follow({ x: 7, y: 3 }, 3);
    await until(ctx, 11.7);
    Demo.caption('洪泛团回头重击网闸。选中它，开断链加固顶住。');
    cam.follow(W, 4);
    const gate = W.tower;
    if (gate && !gate.gone) {
      await clickTower(ctx, ui, view, gate);
      await wait(ctx, 0.25);
      gate.encT = 0;
      await clickEl(ctx, '#inspector [data-skill]');
    }
    Demo.caption('减伤生效，网闸撑住了；掉头的敌人正被 DMZ 交叉火力收割。');
    await until(ctx, 16.4);
    ui.select(null);
    cam.wide();
    Demo.caption('A 线喘过气，可并流后的压力和受损的网闸都留给了下一波。');
    await until(ctx, 18.5);
  }

  // ─── 旁路直通（18.5 秒）───
  // 局面：C、B 被隔离后全压向 X 岸。网闸被冲垮是坏事也是转机：压力分回 Y 岸，玩家腾出手用协议降级救 A 线。
  async function runBypass(ctx, game, ui, view) {
    game.waveIdx = 8;
    game.seenThreats = { worm: 1, flood: 1, trojan: 1, ransom: 1, hotspot: 1, packer: 1 };
    give(game, 3000, 200);
    const H = game.nodes.find(nd => nd.id === 'H');
    const place = (t, x, y, d) => game.placeTower(t, x, y, d || 0).tower;
    // X 岸
    place('interceptor', 7, 6, Math.PI); place('sandbox', 8, 7);
    const fwA = place('firewall', 5, 10); const fwS = place('firewall', 7, 12);
    fwA.hp = fwA.maxHp * 0.7; fwS.hp = fwS.maxHp * 0.7;
    place('interceptor', 9, 13, -Math.PI / 2); place('interceptor', 6, 13, Math.PI); place('repair', 7, 13);
    place('sandbox', 8, 11); place('interceptor', 11, 11, 2.4);
    // Y 岸
    place('firewall', 22, 12); place('interceptor', 21, 7, 2.0); place('interceptor', 21, 11, Math.PI / 2); place('sandbox', 22, 13);
    const gate = place('gate', H.x, H.y);
    gate.hp = gate.maxHp * 0.8;
    staged(game, view);
    give(game, 380, 34);
    game.log('alert', '第 9 波「洪峰」：三入口同时大量出兵');
    game.emit('surge', {});
    ui.banner('洪 峰', '第 9 波 · 三入口同时大量出兵', '#EE7A3C', 2.4);
    const cam = directCamera(ctx, game, view);
    const hm = { hpMul: 1.2 };
    for (const k of [2, 4, 6, 7, 8, 9]) onRoute(game, k === 7 ? 'flood' : k === 6 ? 'ransom' : 'worm', 'A', k, hm);
    // 已经冲过防火墙的几只：开场就打到数据中心 X
    for (const k of [12, 13, 14]) onRoute(game, 'worm', 'A', k, { hpMul: 1.2, clone: true });
    for (const k of [6, 9, 12, 15, 17, 18, 20]) onRoute(game, k === 12 ? 'trojan' : k === 18 ? 'ransom' : 'worm', 'C', k, hm);
    // 洪泛团已经贴近汇聚节点
    for (const [x, y] of [[22, 5], [23, 5], [18, 5], [19, 5]]) {
      const e = game.spawn('flood', x < 20 ? 'C' : 'B', { hpMul: 1.2, at: { x, y, fx: x, fy: y, tx: x < 20 ? x + 1 : x - 1, ty: y } });
      e.nextSiege = 0;
    }
    let n = 0;
    const seq = ['worm', 'worm', 'trojan', 'worm', 'flood', 'worm', 'ransom'];
    every(ctx, 1.5, () => { if (n++ < 11) game.spawn(seq[n % 7], 'A', hm); });
    every(ctx, 2.4, () => { game.spawn(seq[(n + 2) % 7], 'C', hm); game.spawn(seq[(n + 4) % 7], 'B', hm); });

    Demo.caption('洪峰来了：C、B 被隔离在汇聚节点外，全部绕向数据中心 X。');
    await until(ctx, 1.2);
    cam.follow(H, 4);
    await until(ctx, 3.2);
    Demo.caption('洪泛团重击网闸。这次不救它，把资源留给 A 线。');
    await until(ctx, 5.4);
    // 关键事件由演示直接触发：网闸被冲垮
    if (!gate.gone) {
      const src = game.enemies.find(e => e.type === 'flood' && e.mode === 'siege') || game.enemies[0];
      gate.hp = 1;
      game.towerDamage(gate, 60, { enemy: src, kind: 'impact' });
    }
    Demo.caption('网闸被冲垮，旁路直通：C、B 改回旧专线，回到数据中心 Y。');
    cam.fit(game.routes.C.path.slice(game.routes.C.path.indexOf(H.idx)));
    await until(ctx, 7.9);
    Demo.caption('同时：把协议降级投到 A 的隧道前，拖住这一路。');
    cam.hold(5, 5, 6);
    await dragCardTo(ctx, ui, view, 'item', 'downgrade', 5, 4);
    await wait(ctx, 1.2);
    await release(ctx, ui);
    await wait(ctx, 0.3);
    await clickEl(ctx, '#rp-yes');
    Demo.caption('A 线切到旧协议：减速、木马显形，西岸火力多打一轮。');
    cam.follow({ x: 5, y: 6 }, 3);
    await until(ctx, 15.6);
    cam.wide();
    Demo.caption('两岸都在交火：X 岸喘过气，Y 岸接住了回流，谁也没有赢定。');
    await until(ctx, 18.5);
  }

  // ─── 蛰影现身（20.1 秒）───
  // 局面：东北角的火力把蛰影一路压低，它用加密和锁死反击；冗余切换把熄火的火力点重新拉起来。
  async function runZheying(ctx, game, ui, view) {
    game.waveIdx = 15;
    game.seenThreats = { worm: 1, flood: 1, trojan: 1, ransom: 1, hotspot: 1, packer: 1, zheying: 1 };
    give(game, 4000, 200);
    const place = (t, x, y, d) => game.placeTower(t, x, y, d || 0).tower;
    const N = -Math.PI / 2;
    const hurt = place('interceptor', 17, 3, 0);
    hurt.hp = hurt.maxHp * 0.25;
    place('sandbox', 17, 5);
    const hurt2 = place('interceptor', 18, 5, N);
    hurt2.hp = hurt2.maxHp * 0.3;
    place('interceptor', 20, 5, N);
    const repair = place('repair', 19, 5);
    place('sandbox', 22, 5); place('interceptor', 23, 4, Math.PI);
    game.upgrade(place('firewall', 21, 8));
    // 两个核心与西通道
    place('sandbox', 13, 15); place('interceptor', 14, 14, 0); place('interceptor', 16, 14, Math.PI);
    place('firewall', 18, 15);
    place('interceptor', 7, 5, 0); place('sandbox', 7, 7); place('firewall', 8, 8);
    // 修复进程要撑到演示的关键步骤，其余设备就是常规耐久，真的会被打掉
    repair.maxHp *= 2.5; repair.hp = repair.maxHp;
    staged(game, view);
    give(game, 520, 40);
    game.log('alert', '第 16 波：蛰影进入战场');
    const cam = directCamera(ctx, game, view);
    const boss = game.spawn('zheying', 'B', { at: { x: 16, y: 4, fx: 16, fy: 4, tx: 17, ty: 4 } });
    boss.maxHp = 4200;
    boss.hp = boss.maxHp * 0.73;
    boss.speed *= 0.72;
    boss.skillT = 99; boss.skill2T = 1.5;
    const hm = { hpMul: 1.15 };
    for (const [tp, k] of [['ransom', 7], ['ransom', 9], ['trojan', 6], ['worm', 3], ['worm', 11], ['worm', 13], ['worm', 18]]) onRoute(game, tp, 'B', k, hm);
    for (const [tp, k] of [['ransom', 6], ['worm', 2], ['worm', 4], ['flood', 5], ['worm', 11]]) onRoute(game, tp, 'C', k, hm);
    for (const k of [6, 9, 11, 16]) onRoute(game, 'worm', 'A', k, hm);
    let n = 0;
    const seq = ['worm', 'trojan', 'worm', 'worm', 'worm', 'flood'];
    every(ctx, 1.7, () => { if (n++ < 11) { game.spawn(seq[n % 6], 'A', hm); game.spawn(seq[(n + 1) % 6], 'C', hm); game.spawn(seq[(n + 3) % 6], 'B', hm); } });
    // 交叉火力逐步压低蛰影，血条连续下降，不会跳变；演示结束前它不会倒下
    const pressure = { rate: 0 };
    ctx.tickers.push({ fn: (dt) => { if (!boss.dead && boss.hp > boss.maxHp * 0.12) { boss.hp -= pressure.rate * dt; boss.hitAnim = Math.max(boss.hitAnim, 0.2); } if (boss.hp < boss.maxHp * 0.1) boss.hp = boss.maxHp * 0.1; } });

    Demo.caption('第 16 波，蛰影现身：只有沙箱能让它显形，火力才打得到。');
    await until(ctx, 1.2);
    cam.follow(boss, 6);
    pressure.rate = 70;
    await waitFor(ctx, () => boss.phase >= 1, 2.2);
    pressure.rate = 200;
    Demo.caption('提权：护甲强化，放出木马；勒索者开始加密东侧火力点。');
    await until(ctx, 6.4);
    // 破坏阶段由演示触发，封锁位置和改道由游戏逻辑决定
    boss.hp = Math.min(boss.hp, boss.maxHp * 0.345);
    pressure.rate = 0;
    await wait(ctx, 0.1);
    boss.skillT = 0;
    Demo.caption('破坏：蛰影预警，要锁死前方一段运维环。闪烁的红框就是位置。');
    await waitFor(ctx, () => game.holes.length > 0, 4.6);
    boss.skillT = 99;
    Demo.caption('运维环锁死：各入口路线重新收敛，流量转向另一侧和老总线。');
    cam.fit([].concat(...Object.values(game.routes).map(q => q.path.slice(2))));
    await until(ctx, 12.9);
    Demo.caption('东侧火力点被加密。选中修复进程，释放冗余切换。');
    cam.hold(repair.x, repair.y, 4.5, true);
    // 确保有被加密的塔可以被解除
    const enc = () => game.towers.filter(t => t.encT > 0 && Math.hypot(t.x - repair.x, t.y - repair.y) <= repair.s.range).length;
    for (const t of game.towers) {
      if (enc() >= 2) break;
      if (Math.hypot(t.x - repair.x, t.y - repair.y) <= repair.s.range && t !== repair && t.encT <= 0 && t.type === 'interceptor') { t.encT = 5; game.emit('encrypted', { tower: t }); }
    }
    await wait(ctx, 0.3);
    repair.encT = 0;
    await clickTower(ctx, ui, view, repair);
    await wait(ctx, 0.25);
    repair.encT = 0; repair.skillCd = 0;
    if (!repair.gone) await clickEl(ctx, '#inspector [data-skill]');
    Demo.caption('冗余切换：护盾加身，加密解除，火力恢复，蛰影的血条又动了。');
    pressure.rate = 60;
    await until(ctx, 17.8);
    ui.select(null);
    cam.follow(boss, 4);
    Demo.caption('蛰影还在推进，封锁解除后路线又要变。两个核心都得守。');
    await until(ctx, 20.1);
  }
})();
