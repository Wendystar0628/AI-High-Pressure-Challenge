(function () {
  const canvas = document.getElementById('view');
  const renderer = new GFX.Renderer(canvas);
  const t0build = performance.now();
  SCENE.init();
  ASTEROIDS.init();
  BATTLE.init();
  INTERIORS.init();
  console.log('[fleet] geometry built in ' + (performance.now() - t0build).toFixed(0) + ' ms',
    'boxes:', SCENE.state.ships.map(s => s.model.name + ':' + s.model.boxes).filter((v, i, a) => a.indexOf(v) === i).join(', '));

  let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  function resize() {
    let w = Math.max(1, Math.floor(window.innerWidth * dpr));
    let h = Math.max(1, Math.floor(window.innerHeight * dpr));
    const capW = 3840, capH = 2160;
    const k = Math.min(1, capW / w, capH / h);
    w = Math.max(1, Math.floor(w * k));
    h = Math.max(1, Math.floor(h * k));
    renderer.resize(w, h);
    window.__ASPECT = w / h;
  }
  window.addEventListener('resize', resize);
  resize();

  let paused = false;
  let exporting = false;
  let fixedTime = 0;
  let origin = performance.now() / 1000;
  let lastRenderT = -1;

  function currentTime() {
    if (paused) return fixedTime;
    return (performance.now() / 1000 - origin) % 80;
  }

  const envBase = {
    sunDir: M.norm([-0.52, 0.60, -0.52]),
    sunColor: [1.18, 1.06, 0.92],
    ambSky: [0.220, 0.280, 0.330],
    ambGround: [0.050, 0.070, 0.090],
    fogColor: [0.0065, 0.0135, 0.026],
    fogDensity: 0.000037,
    emissive: 1.55,
    fillDir: M.norm([0.45, 0.22, 0.78]),
    fillColor: [0.260, 0.310, 0.350],
    camFill: [0.075, 0.095, 0.115],
    tint: [1, 1, 1],
    lights: [],
  };
  const envInterior = {
    sunDir: M.norm([-0.35, 0.75, -0.45]),
    sunColor: [0.55, 0.62, 0.70],
    ambSky: [0.175, 0.215, 0.245],
    ambGround: [0.038, 0.050, 0.064],
    fogColor: [0.008, 0.016, 0.025],
    fogDensity: 0.0026,
    emissive: 1.65,
    fillDir: M.norm([0.30, 0.40, 0.86]),
    fillColor: [0.16, 0.20, 0.23],
    camFill: [0.44, 0.52, 0.58],
    tint: [1, 1, 1],
    lights: [],
  };

  function renderAt(t) {
    lastRenderT = t;
    const spec = window.__CAM_OVERRIDE || CAM.sample(t);
    const cam = spec.view ? spec : CAM.build(spec.pos, spec.target, spec.fov, spec.roll || 0, t);
    renderer.sprites.begin();
    if (spec.scene) cam.scene = spec.scene;
    window.__CAM = cam;
    let env;
    if (cam.scene === 'exterior') {
      env = Object.assign({}, envBase);
      env.lights = BATTLE.lights(t);
      renderer.beginFrame(cam, env, { spaceMode: 0, starScale: 1 });
      SCENE.draw(renderer, cam, t);
      BATTLE.draw(renderer, cam, t);
      renderer.sprites.draw(cam);
      renderer.endFrame({ bloom: 0.62, exposure: 1.04 });
    } else {
      env = Object.assign({}, envInterior, INTERIORS.envFor(cam.scene) || {});
      env.lights = INTERIORS.lightsFor(cam.scene, t) || [];
      renderer.beginFrame(cam, env, { spaceMode: 1, starScale: 1.35 });
      INTERIORS.draw(renderer, cam, t);
      renderer.sprites.draw(cam);
      renderer.endFrame({ bloom: 0.68, exposure: 1.06 });
    }
  }

  function loop() {
    if (!exporting) {
      const t = currentTime();
      if (!paused || lastRenderT !== t) renderAt(t);
    }
    requestAnimationFrame(loop);
  }

  const videoExport = {
    runs: ['tour'],
    _fps: 60,
    _start: 0,
    async begin(runId, opts) {
      exporting = true;
      paused = true;
      this._fps = (opts && opts.fps) || 60;
      this._start = runId === 'tour' || !runId ? 0 : 0;
      fixedTime = this._start;
      renderAt(fixedTime);
      renderer.gl.finish();
      return { frames: Math.round(80 * this._fps) };
    },
    async frame(i) {
      fixedTime = ((this._start + i / this._fps) % 80 + 80) % 80;
      renderAt(fixedTime);
      renderer.gl.finish();
    },
    end() {
      exporting = false;
      paused = false;
      origin = performance.now() / 1000 - fixedTime;
    },
  };
  window.videoExport = videoExport;
  window.__R = renderer;
  window.__APP = {
    seek(t) { paused = true; fixedTime = ((t % 80) + 80) % 80; renderAt(fixedTime); },
    pause() { if (!paused) { fixedTime = currentTime(); paused = true; } },
    play() { paused = false; origin = performance.now() / 1000 - fixedTime; },
    get time() { return paused ? fixedTime : currentTime(); },
    setCam(pos, target, fov, roll, scene) {
      window.__CAM_OVERRIDE = { pos, target, fov: fov || 48, roll: roll || 0, scene: scene || 'exterior' };
      renderAt(currentTime());
    },
    clearCam() { window.__CAM_OVERRIDE = null; renderAt(currentTime()); },
    renderAt,
    stats: () => SCENE.stats && SCENE.stats(),
  };
  window.__READY = true;
  requestAnimationFrame(loop);
})();
