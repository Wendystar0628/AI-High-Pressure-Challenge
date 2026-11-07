/* =========================================================================
   动态路由塔防 · 入口 / 主循环
   ========================================================================= */
(function () {
  'use strict';
  let world, lastTime = 0, acc = 0;
  const D = window.GAME_DATA;

  function boot() {
    const canvas = document.getElementById('webgl');
    world = new World(canvas);
    window.WORLD = world;
    window.UI.setScale();
    world.resize();
    window.UI.init(world);
    window.addEventListener('resize', () => {
      window.UI.setScale();
      world.resize();
    });
    // extra safety: resize after fonts/layout settle
    setTimeout(() => { window.UI.setScale(); world.resize(); }, 500);

    let last = performance.now();
    function frame(now) {
      const raw = (now - last) / 1000;
      last = now;
      const dt = Math.max(0.0001, Math.min(0.06, raw));
      const demo = window.DEMO;
      const UI = window.UI;
      if (demo && demo.exporting) {
        requestAnimationFrame(frame);
        return;
      }
      if (demo && demo.active) {
        demo.tick(dt);
      } else if (UI.game && !UI.game.paused && !UI.game.over && UI.screen === 'battle') {
        acc += dt * (UI.game.speed || 1);
        let steps = 0;
        while (acc >= D.FIXED_DT && steps < 14) {
          UI.game.update(D.FIXED_DT);
          acc -= D.FIXED_DT;
          steps++;
        }
        if (steps >= 14) acc = 0;
      } else {
        acc = 0;
      }
      UI.tick(dt);
      world.update(dt, UI.game);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    // expose for the evaluation console / export
    window.__TD = { world, get game() { return window.UI.game; } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
