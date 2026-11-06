// 视频导出接口 window.videoExport：把三段实战演示按固定时间步逐帧演出。
// 第 i 帧就是游戏时刻 i/fps，逻辑、定时器、CSS 动画和随机数都不读真实时间，机器快慢不影响结果。
(function () {
  const TD = window.TD;
  const $ = (id) => document.getElementById(id);

  const RUNS = Object.freeze(['demo-1', 'demo-2', 'demo-3']);
  const MAX_STEP_RATE = 30;   // 低帧率时把一帧拆成小步，步长不超过逻辑步长上限
  const MAX_SECONDS = 600;    // 演示脚本异常时的保护上限
  const nativeRandom = Math.random;

  const S = {
    active: false, token: 0, run: -1, fps: 30, frames: 0,
    cur: -1, t: 0, rng: 0, seen: new WeakMap(), ctx: null, prevPixelRatio: 1, drawnW: 0, drawnH: 0,
    cache: new Map(),
  };

  // 固定种子的随机数（mulberry32）。只在逻辑步内替换 Math.random，帧与帧之间还给调用方
  function seededRandom() {
    S.rng = (S.rng + 0x6D2B79F5) | 0;
    let t = Math.imul(S.rng ^ (S.rng >>> 15), 1 | S.rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  async function withSeededRandom(fn) {
    Math.random = seededRandom;
    try { return await fn(); } finally { Math.random = nativeRandom; }
  }

  // 让演示脚本 await 之后的部分跑完。MessageChannel 不受后台页面的定时器节流影响
  const channel = new MessageChannel();
  const hopQueue = [];
  channel.port1.onmessage = () => { const r = hopQueue.shift(); if (r) r(); };
  const hop = () => new Promise((r) => { hopQueue.push(r); channel.port2.postMessage(0); });

  function checkToken(tok) { if (tok !== S.token) throw new Error('videoExport 已被 end() 结束'); }

  // ─── CSS 动画与过渡：按虚拟时间定格 ───
  function syncCSS() {
    const now = S.t * 1000;
    for (const a of document.getAnimations()) {
      let t0 = S.seen.get(a);
      if (t0 === undefined) { t0 = now; S.seen.set(a, t0); a.pause(); }
      const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      if (now - t0 >= end) { if (a.playState !== 'finished') a.finish(); continue; }
      a.currentTime = now - t0;
    }
  }

  // 进场前把画面切换的过渡全部走完，第 0 帧就是完整的起始局面
  function settleCSS() {
    for (const a of document.getAnimations()) {
      const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      if (Number.isFinite(end)) a.finish(); else { a.pause(); a.currentTime = 0; }
    }
    S.seen = new WeakMap();
  }

  function resetView(view) {
    view.shake = 0;
    view.time = 0;
    view._flashK = 0;
    view.grade.uniforms.uFlash.value.setRGB(0, 0, 0);
    view.hoverTile = null;
    // 这些缓存绑定了旧世界的时钟或第一次生成时的随机数，要随每次重开重建
    view._sm = null; view._esm = null; view._scorchTex = null;
    view.worldId = null;   // 强制重建世界：动画时钟和随机摆放都从头开始
  }

  function resetUI(ui) {
    if ($('modal').classList.contains('show')) ui.closeModal();
    ui.fade(false);
    ui.hideTip();
    ui.setAim(null);
    ui.inspT = 0;
    ui.inspKey = null;
    $('toasts').innerHTML = '';
    $('banner').innerHTML = '';
    $('tilehint').style.display = 'none';
    delete $('inspector').dataset.key;
    delete $('wavepips').dataset.map;
    delete $('wavepips').dataset.cur;
    delete $('boss-bb').dataset.b;
    document.querySelectorAll('.stat').forEach((e) => e.classList.remove('hit', 'gain'));
    $('democap').textContent = '';
    $('democap').classList.remove('pulse');
    $('fakecursor').classList.remove('down');
  }

  // 回到这一段的起始局面
  function rewind() {
    const app = TD.App;
    S.rng = TD.Demo.list[S.run].seed;
    S.t = 0;
    S.cur = -1;
    TD.Demo.abort();
    TD.Clock.start();
    app.nav++;
    resetView(app.view);
    resetUI(app.ui);
    const ctx = TD.Demo.newContext();
    ctx.exporting = true;
    S.ctx = ctx;
    const d = TD.Demo.list[S.run];
    app.enterMap(d.map, {
      demo: true,
      seed: d.seed,
      setup: (game) => {
        // 重建 HUD 图层：上一段留下的亚像素栅格不能影响这一段的画面
        const hud = $('hud');
        hud.style.display = 'none';
        void hud.offsetWidth;
        hud.style.display = '';
        settleCSS();
        TD.Demo.launch(S.run, ctx, game);
      },
    });
  }

  // 一个逻辑步。顺序和主循环一致，只是时间由这里给定
  // mode：measure 只跑逻辑；skip 不合成 3D 画面；show 完整绘制
  async function step(h, t, mode) {
    const tok = S.token, app = TD.App;
    S.t = t;
    TD.Clock.advance(t * 1000);
    const g = app.game;
    if (g && !g.over) g.update(h);
    app.pumpEvents();
    TD.Demo.update(h);
    await hop();
    checkToken(tok);
    app.view.frame(h, h, 1, mode === 'measure' ? { noOverlay: true, noComposite: true } : mode === 'skip' ? { noComposite: true } : null);
    app.ui.update(h);
    syncCSS();
    if (mode === 'show') { S.drawnW = app.view.size.w; S.drawnH = app.view.size.h; }
  }

  async function advanceOneFrame(mode) {
    const n = Math.max(1, Math.ceil(MAX_STEP_RATE / S.fps - 1e-9));
    const h = 1 / S.fps / n;
    for (let k = 1; k <= n; k++) {
      await step(h, (S.cur + k / n) / S.fps, k === n ? mode : (mode === 'measure' ? 'measure' : 'skip'));
    }
    S.cur++;
  }

  // 不渲染地跑完整段，量出脚本实际结束的帧
  async function measure() {
    rewind();
    await step(0, 0, 'measure');
    S.cur = 0;
    const limit = MAX_SECONDS * S.fps;
    while (!S.ctx.ended) {
      if (S.cur > limit) throw new Error('实战演示没有在预期时间内结束');
      await advanceOneFrame('measure');
    }
    if (S.ctx.error) throw S.ctx.error;
    return S.cur + 1;
  }

  async function buildTo(i) {
    if (S.cur < 0) {
      await step(0, 0, i === 0 ? 'show' : 'skip');
      S.cur = 0;
      return i === 0 ? undefined : buildTo(i);
    }
    if (S.cur === i) { TD.App.view.redraw(); return undefined; }
    while (S.cur < i) await advanceOneFrame(S.cur + 1 === i ? 'show' : 'skip');
    return undefined;
  }

  // 等这一帧真正显示到页面上。页面在后台时 rAF 不触发，不能把调用方卡死
  function present() {
    return new Promise((resolve) => {
      if (document.visibilityState === 'hidden') { window.setTimeout(resolve, 0); return; }
      let done = false;
      const ok = () => { if (!done) { done = true; resolve(); } };
      requestAnimationFrame(() => requestAnimationFrame(ok));
      window.setTimeout(ok, 400);
    });
  }

  function ready() {
    return new Promise((resolve) => {
      const poll = () => { if (TD.App && TD.App.view && TD.App.ui && TD.Demo) resolve(); else window.setTimeout(poll, 30); };
      poll();
    }).then(() => (document.fonts ? document.fonts.ready : null));
  }

  function enter() {
    if (S.active) return;
    const app = TD.App, view = app.view;
    S.active = true;
    S.prevPixelRatio = view.pixelRatio;
    app.exporting = true;
    view.exporting = true;
    app.applyUIScale();
    app.onExportFrame = () => {
      // 导出中窗口尺寸真的变了：画布被清空，用当前帧状态补画，不推进时间
      if (S.cur >= 0 && (view.size.w !== S.drawnW || view.size.h !== S.drawnH)) {
        S.drawnW = view.size.w; S.drawnH = view.size.h;
        view.redraw();
      }
    };
    document.body.classList.add('exporting');
    TD.Audio.setHold(true);
    // 分辨率只由窗口决定，不受之前自动降画质的影响
    view.pixelRatio = window.devicePixelRatio || 1;
    view.resize(true);
  }

  // 所有异步操作排队执行，调用方忘了 await 也不会交错
  let chain = Promise.resolve();
  function enqueue(fn) {
    const p = chain.then(fn);
    chain = p.catch(() => {});
    return p;
  }

  function begin(runId, opts) {
    return enqueue(async () => {
      const run = RUNS.indexOf(runId);
      if (run < 0) throw new Error(`未知的实战演示：${runId}，可用：${RUNS.join(', ')}`);
      const fps = opts && opts.fps != null ? Number(opts.fps) : 30;
      if (!Number.isFinite(fps) || fps <= 0) throw new Error(`fps 必须是正数：${opts && opts.fps}`);
      await ready();
      enter();
      const tok = S.token;
      S.run = run;
      S.fps = fps;
      const key = `${runId}|${fps}|${innerWidth}x${innerHeight}|${window.devicePixelRatio || 1}`;
      const frames = await withSeededRandom(async () => {
        let n = S.cache.get(key);
        if (n == null) { n = await measure(); checkToken(tok); S.cache.set(key, n); }
        rewind();
        await buildTo(0);
        return n;
      });
      S.frames = frames;
      await present();
      return { frames };
    });
  }

  function frame(i) {
    return enqueue(async () => {
      if (!S.active || S.run < 0) throw new Error('请先调用 videoExport.begin()');
      if (!Number.isInteger(i) || i < 0 || i >= S.frames) throw new RangeError(`帧序号超出范围：${i}，应为 0 到 ${S.frames - 1} 的整数`);
      const tok = S.token;
      await withSeededRandom(async () => {
        if (i < S.cur) rewind();   // 回退也能得到同样的画面：结果是确定的，重放到第 i 帧即可
        await buildTo(i);
      });
      checkToken(tok);
      await present();
    });
  }

  function end() {
    if (!S.active) return;
    const app = TD.App, view = app.view;
    S.active = false;
    S.token++;
    S.run = -1;
    S.frames = 0;
    S.cur = -1;
    Math.random = nativeRandom;
    TD.Demo.abort();
    TD.Clock.stop();
    for (const a of document.getAnimations()) {
      const stop = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      if (Number.isFinite(stop)) a.finish(); else a.play();
    }
    document.body.classList.remove('exporting');
    app.exporting = false;
    view.exporting = false;
    app.applyUIScale();
    app.onExportFrame = null;
    app.nav++;
    TD.Audio.setHold(false);
    view.pixelRatio = S.prevPixelRatio;
    view.resize(true);
    resetUI(app.ui);
    app.toMenu();
  }

  window.videoExport = Object.freeze({ runs: RUNS, begin, frame, end });
})();
