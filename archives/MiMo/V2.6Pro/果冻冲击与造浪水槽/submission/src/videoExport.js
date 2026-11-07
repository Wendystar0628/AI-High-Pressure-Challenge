// Deterministic video-export interface (see spec §五)
// window.videoExport.runs / begin / frame / end
export function installVideoExport(app) {
  const RUNS = ['jelly-center', 'jelly-multi', 'jelly-offset', 'tank-full'];

  const state = {
    active: false,
    runId: null,
    fps: 60,
    frames: 0,
    simTime: 0,
    T: 0,
    fixedDt: 1 / 240,
  };

  function sceneFor(runId) {
    return runId.startsWith('jelly') ? app.scene1 : app.scene2;
  }

  async function begin(runId, opts = {}) {
    if (!RUNS.includes(runId)) throw new Error('unknown run: ' + runId);
    const fps = Math.max(1, Math.min(240, Math.floor(opts.fps || 60)));
    const scene = sceneFor(runId);

    // prepare scene
    app.setActiveScene(runId.startsWith('jelly') ? 1 : 2, { silent: true });
    if (runId.startsWith('jelly')) {
      app.scene1.applyDemoPreset(runId);
    } else {
      app.scene2.applyDemoPreset(runId);
    }

    // compute duration
    const T = scene.demoDuration();
    const frames = Math.ceil(T * fps);

    state.active = true;
    state.runId = runId;
    state.fps = fps;
    state.frames = frames;
    state.simTime = 0;
    state.T = T;

    document.body.classList.add('export-mode');
    app.exportMode = true;

    // initial render at t=0
    scene.setCamera(0);
    app.renderNow();
    return { frames };
  }

  async function frame(i) {
    if (!state.active) throw new Error('videoExport.frame: begin() first');
    const scene = sceneFor(state.runId);
    const target = i / state.fps;
    // step sim from state.simTime to target with fixed dt
    const dt = state.fixedDt;
    let t = state.simTime;
    // avoid tiny leftovers
    while (t < target - 1e-6) {
      const step = Math.min(dt, target - t);
      scene.step(step, { export: true });
      t += step;
    }
    state.simTime = target;

    scene.setCamera(target);
    // ensure visuals fully updated then render synchronously
    if (scene.jellyMesh) scene.jellyMesh.update();
    if (scene.waterMesh) scene.waterMesh.update();
    app.renderNow();
  }

  function end() {
    state.active = false;
    state.runId = null;
    document.body.classList.remove('export-mode');
    app.exportMode = false;
    // restore normal interactive state
    const scene = sceneFor(state.runId || 'jelly-center');
    app.setActiveScene(scene === app.scene1 ? 1 : 2, { silent: true });
  }

  window.videoExport = {
    runs: RUNS.slice(),
    begin,
    frame,
    end,
    // introspection helpers (not required by spec)
    _state: state,
  };

  return window.videoExport;
}
