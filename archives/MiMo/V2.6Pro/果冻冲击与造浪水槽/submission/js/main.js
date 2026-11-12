// main.js — 启动与主循环
(function (global) {
  'use strict';

  async function boot() {
    const canvas = document.getElementById('gpu-canvas');
    // 错误采集（调试面板）
    const errBox = document.createElement('div');
    errBox.style.cssText = 'position:fixed;left:8px;top:70px;z-index:99999;color:#ff8080;font:11px monospace;background:rgba(0,0,0,0.8);padding:6px 8px;max-width:520px;white-space:pre-wrap;display:none;pointer-events:none';
    document.body.appendChild(errBox);
    const errs = [];
    function showErr(msg) {
      errs.push(String(msg));
      if (errs.length > 12) errs.shift();
      errBox.style.display = 'block';
      errBox.textContent = errs.join('\n');
    }
    window.__showErr = showErr;
    window.__errs = errs;

    const renderer = new GPURenderer();
    try {
      await renderer.init(canvas);
      renderer.device.addEventListener('uncapturederror', (e) => {
        showErr('GPU: ' + (e.error && e.error.message ? e.error.message : e.error));
      });
    } catch (err) {
      showErr('初始化失败: ' + (err && err.message ? err.message : err));
      document.body.insertAdjacentHTML('beforeend',
        '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;padding:40px;font-size:18px;background:rgba(0,0,0,0.85);z-index:99998">' +
        '无法初始化 WebGPU：' + (err && err.message ? err.message : err) + '</div>');
      return;
    }

    let scene;
    try {
      scene = new SceneApp(renderer);
    } catch (err) {
      showErr('场景构建失败: ' + (err && err.stack ? err.stack : err));
      return;
    }
    const audio = new AudioEngine();
    scene.audio = audio;

    try {
      const player = installVideoExport(scene);
      bindUI(scene, player, audio);
      scene.setMode('jelly');

      let last = performance.now();
      let fpsAcc = 0, fpsCount = 0, fpsTimer = 0;
      const statusFps = document.getElementById('status-fps');
      const statusState = document.getElementById('status-state');

      let frames = 0;
      function frame(now) {
        requestAnimationFrame(frame);
        try {
          const dtRaw = (now - last) / 1000;
          last = now;
          const dt = Math.min(dtRaw, 1 / 24);

          if (player.exporting) {
            scene.render();
            return;
          }

          if (player.playing) {
            player.tick(dt);
          } else {
            scene.update(dt);
          }
          scene.render();
          frames++;
          if (frames === 3 && statusState) statusState.textContent = '运行中';

          fpsAcc += dtRaw;
          fpsCount++;
          fpsTimer += dtRaw;
          if (fpsTimer > 0.5) {
            const fps = fpsCount / Math.max(fpsAcc, 1e-4);
            if (statusFps) statusFps.textContent = fps.toFixed(0) + ' fps';
            fpsAcc = 0; fpsCount = 0; fpsTimer = 0;
            if (statusState && !scene.paused && !player.playing) {
              statusState.textContent = '运行中';
            }
          }
        } catch (err) {
          if (window.__showErr) window.__showErr('循环: ' + (err && err.stack ? err.stack : err));
        }
      }
      requestAnimationFrame(frame);
      window.addEventListener('resize', () => renderer.resize());
      global.__app = { renderer, scene, player, audio };
    } catch (err) {
      showErr('启动失败: ' + (err && err.stack ? err.stack : err));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot().catch((e) => {
      if (window.__showErr) window.__showErr('boot: ' + (e && e.stack ? e.stack : e));
    }));
  } else {
    boot().catch((e) => {
      if (window.__showErr) window.__showErr('boot: ' + (e && e.stack ? e.stack : e));
    });
  }
})(window);
