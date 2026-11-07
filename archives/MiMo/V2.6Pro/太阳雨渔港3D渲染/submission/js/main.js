/* 主入口：装配场景、渲染循环、导出接口 */
(function () {
  'use strict';
  const H = window.H;

  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0xd8eef0, 1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  H.renderer = renderer;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    H.camera.aspect = w / h;
    H.camera.updateProjectionMatrix();
    window.__size = { w: w, h: h };
  }

  const scene = new THREE.Scene();
  H.scene = scene;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  H.camera = camera;

  // 构建
  const sky = H.buildSky(scene, renderer);
  H.sky = sky;
  H.buildWorld(scene);
  const water = H.buildWater(scene, renderer, camera);
  H.water = water;

  // 可选模块（后续加载）
  if (H.buildBoats) H.buildBoats(scene);
  if (H.buildBuildings) H.buildBuildings(scene);
  if (H.buildProps) H.buildProps(scene);
  if (H.buildWeather) H.buildWeather(scene);
  if (H.buildCreatures) H.buildCreatures(scene);

  const ctrl = H.makeCamera(camera, canvas);
  H.ctrl = ctrl;

  window.addEventListener('resize', resize);
  resize();

  // ---------- 动画更新 ----------
  const updaters = [];
  H.addUpdater = function (fn) { updaters.push(fn); };

  if (H.registerAnim) H.registerAnim(H);

  function step(dt, t) {
    H.sim.t = t;
    // 天气参数（缓慢起伏）
    const s = H.sim;
    s.rainAmount = 0.45 + 0.35 * Math.sin(t * 0.06 + 1.2) + 0.12 * Math.sin(t * 0.17);
    s.rainAmount = H.clamp(s.rainAmount, 0.12, 1);
    // 阵风：周期性
    const gustWave = Math.sin(t * 0.045) * 0.5 + 0.5;
    const gustPulse = Math.pow(Math.max(0, Math.sin(t * 0.11 - 0.6)), 6);
    s.wind = H.clamp(gustWave * 0.22 + gustPulse * 0.95, 0, 1);
    // 云影
    const cl = Math.sin(t * 0.023) * 0.5 + 0.5;
    s.cloudShadow = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(t * 0.021 + 0.8));
    void cl;
    // 灯塔白天偶尔亮一次
    const lp = (t % 97) / 97;
    s.lighthouseOn = lp > 0.93 ? Math.sin((lp - 0.93) / 0.07 * Math.PI) : 0;

    for (let i = 0; i < updaters.length; i++) updaters[i](dt, t);
    if (H.updateAnim) H.updateAnim(dt, t);
    ctrl.update(dt, t);
    H.syncOutlines();
  }

  // ---------- 渲染 ----------
  let reflTick = 0;
  function render() {
    if (reflTick++ % 3 === 0) water.updateReflection(camera, [water.surface]);
    if (reflTick % 24 === 0) renderer.shadowMap.needsUpdate = true;
    sky.sky.position.copy(camera.position);
    renderer.render(scene, camera);
  }

  // ---------- 实时循环 ----------
  let last = performance.now();
  let acc = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (H.sim.exportMode) {
      last = now;
      return;
    }
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    step(dt, acc);
    render();
    window.__frames = (window.__frames || 0) + 1;
    window.__simT = acc;
  }
  requestAnimationFrame(loop);

  // ---------- 视频导出接口 ----------
  const TOUR_SECONDS = 60;
  const videoExport = {
    runs: ['tour'],
    begin: async function (runId, opts) {
      opts = opts || {};
      const fps = opts.fps || 60;
      H.sim.exportMode = true;
      H.sim.exportFps = fps;
      if (H.tourReset) H.tourReset();
      // 回到起始状态
      if (H.tourApply) H.tourApply(0);
      return { frames: Math.round(TOUR_SECONDS * fps) };
    },
    frame: async function (i) {
      const t = i / H.sim.exportFps;
      if (H.tourApply) H.tourApply(t);
      render();
    },
    end: function () {
      H.sim.exportMode = false;
    },
    duration: TOUR_SECONDS,
  };
  window.videoExport = videoExport;

  // 简单调试标记
  window.__ready = true;
})();
