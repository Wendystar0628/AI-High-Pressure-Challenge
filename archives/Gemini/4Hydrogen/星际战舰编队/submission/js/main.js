(function (global) {
  'use strict';

  const SF = (global.SF = global.SF || {});

  function bootstrap() {
    const canvas = document.getElementById('glcanvas');
    const renderer = new SF.Renderer(canvas);
    const gl = renderer.gl;
    const vfx = new SF.VFXSystem(renderer);

    // ---------------------------------------------------------
    // 1. 生成全部同一格距 (1x1x1) 的原创造型体素资产并上传 GPU
    // ---------------------------------------------------------
    const t0 = performance.now();
    const shipAssets = SF.buildShipAssets();
    const t1 = performance.now();
    const interiorAssets = SF.buildInteriors();
    const t2 = performance.now();
    const asteroidAssets = SF.buildAsteroidAssets();
    const t3 = performance.now();
    console.log('[Init ms] ships:', (t1 - t0).toFixed(1), 'interiors:', (t2 - t1).toFixed(1), 'asteroids:', (t3 - t2).toFixed(1));

    const upload = (meshData) => SF.Voxel.uploadMeshToGPU(gl, meshData);

    const gpuAssets = {
      flagship: upload(shipAssets.flagship.meshData),
      flagshipInfo: shipAssets.flagship,

      guardian: upload(shipAssets.guardian.meshData),
      guardianInfo: shipAssets.guardian,

      vanguard: upload(shipAssets.vanguard.meshData),
      vanguardInfo: shipAssets.vanguard,

      shuttle: upload(shipAssets.shuttle.meshData),
      shuttleInfo: shipAssets.shuttle,

      pulseBase: upload(shipAssets.pulseTurret.baseMeshData),
      pulseHead: upload(shipAssets.pulseTurret.headMeshData),
      pulseMuzzles: shipAssets.pulseTurret.muzzleOffsets,

      ciwsTurret: upload(shipAssets.ciwsTurret.meshData),
      ciwsMuzzles: shipAssets.ciwsTurret.muzzleOffsets,

      missile: upload(shipAssets.missile.meshData),

      bridgeHall: upload(interiorAssets.bridge.hallMeshData),
      bridgeHolo: upload(interiorAssets.bridge.holoMeshData),
      bridgeHoloPos: interiorAssets.bridge.holoPos,

      reactorHall: upload(interiorAssets.reactor.hallMeshData),
      reactorCoreStatic: upload(interiorAssets.reactor.coreStaticMeshData),
      reactorRingInner: upload(interiorAssets.reactor.ringInner),
      reactorRingMid: upload(interiorAssets.reactor.ringMid),
      reactorRingOuter: upload(interiorAssets.reactor.ringOuter),

      hangarHall: upload(interiorAssets.hangar.meshData),
      hangarSlots: interiorAssets.hangar.parkedShuttleSlots,

      corridorHall: upload(interiorAssets.corridor.hallMeshData),
      corridorPod: upload(interiorAssets.corridor.podMeshData),
      corridorArm: upload(interiorAssets.corridor.armMeshData),

      largeTargets: asteroidAssets.largeTargets.map(a => ({
        radius: a.radius,
        wholeMesh: upload(a.wholeMeshData),
        pieces: a.pieces.map(p => ({
          mesh: upload(p.meshData),
          localOffset: p.localOffset,
          dir: p.dir,
          spinAxis: p.spinAxis,
          spinSpeed: p.spinSpeed,
          sepSpeed: p.sepSpeed
        }))
      })),
      mediumRocks: asteroidAssets.mediumRocks.map(m => upload(m.meshData)),
      debrisChunks: asteroidAssets.debrisChunks.map(d => upload(d))
    };

    const director = new SF.Timeline.TimelineDirector(gpuAssets);
    const TOTAL = SF.Timeline.TOTAL_DURATION;

    // ---------------------------------------------------------
    // 2. 分辨率自适应（最高支持 3840x2160）
    // ---------------------------------------------------------
    function syncCanvasSize() {
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth || window.innerWidth || 1280;
      const ch = canvas.clientHeight || window.innerHeight || 720;
      let rawW = Math.max(1, Math.round(cw * dpr));
      let rawH = Math.max(1, Math.round(ch * dpr));
      if (rawW > 3840 || rawH > 2160) {
        const s = Math.min(3840 / rawW, 2160 / rawH);
        rawW = Math.max(1, Math.round(rawW * s));
        rawH = Math.max(1, Math.round(rawH * s));
      }
      renderer.resize(rawW, rawH);
    }

    window.addEventListener('resize', syncCanvasSize);
    syncCanvasSize();

    // ---------------------------------------------------------
    // 3. 确定性单帧渲染与自动播放循环
    // ---------------------------------------------------------
    let isExporting = false;
    let currentTimeSec = 0;
    let lastPerfTime = performance.now();
    let rafId = 0;

    function renderAtGlobalTime(t) {
      syncCanvasSize();
      const clampedT = ((t % TOTAL) + TOTAL) % TOTAL;
      currentTimeSec = clampedT;
      const sceneState = director.evaluate(clampedT, vfx);
      renderer.renderFrame(sceneState);
    }

    function autoLoop(now) {
      if (isExporting) return;
      const dt = Math.min(0.1, Math.max(0, (now - lastPerfTime) / 1000));
      lastPerfTime = now;
      renderAtGlobalTime((currentTimeSec + dt) % TOTAL);
      rafId = requestAnimationFrame(autoLoop);
    }

    // 立即渲染第 0 帧，启动自动循环
    renderAtGlobalTime(0);
    lastPerfTime = performance.now();
    rafId = requestAnimationFrame(autoLoop);

    // ---------------------------------------------------------
    // 4. 固定视频导出接口 window.videoExport
    // ---------------------------------------------------------
    let exportRun = null;
    let exportFps = 60;
    let exportFrames = 0;

    const runsMap = new Map();
    for (const r of SF.Timeline.RUNS) {
      runsMap.set(r.id, r);
    }

    function waitFramePresented() {
      return new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        const timer = setTimeout(finish, 36);
        requestAnimationFrame(() => {
          clearTimeout(timer);
          finish();
        });
      });
    }

    global.videoExport = {
      runs: SF.Timeline.RUNS.map(r => r.id),

      async begin(runId, opts = {}) {
        const run = runsMap.get(runId);
        if (!run) {
          throw new Error('Unknown videoExport runId: ' + runId);
        }
        isExporting = true;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        exportRun = run;
        exportFps = Math.max(1, Number(opts.fps) || 60);
        exportFrames = Math.round(run.duration * exportFps);

        // 重建该分块的全局起始状态
        renderAtGlobalTime(run.start);
        gl.finish();
        await waitFramePresented();

        return { frames: exportFrames };
      },

      async frame(i) {
        if (!exportRun) {
          throw new Error('videoExport.frame() called before begin()');
        }
        const t = exportRun.start + i / exportFps;
        renderAtGlobalTime(t);
        gl.finish();
        await waitFramePresented();
      },

      end() {
        isExporting = false;
        exportRun = null;
        lastPerfTime = performance.now();
        if (!rafId) {
          rafId = requestAnimationFrame(autoLoop);
        }
      }
    };
  }

  window.addEventListener('DOMContentLoaded', bootstrap);
})(window);
