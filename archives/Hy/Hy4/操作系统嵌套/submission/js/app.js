/* ============================================================================
 * 启动引导与主循环。
 * 用 setInterval（而非仅 requestAnimationFrame）驱动逻辑步与绘制：主窗口被其它窗口
 * 完全盖住时，Chromium 会停止 rAF，但配合 main.js 的 backgroundThrottling=false 与
 * Chromium 启动参数，本循环仍持续推进、持续绘制，不停机、不留空白画面。
 * ========================================================================== */
(function (OS) {
  'use strict';
  const rt = OS.rt, ui = OS.ui;

  function boot() {
    // 轻量错误收集（开发自检/状态反馈，不影响运行）
    window.__errs = [];
    const benign = (m) => /ERR_ABORTED|loading URL|GUEST_VIEW_MANAGER_CALL|net::ERR_/i.test(m);
    const _ce = console.error;
    console.error = function () { try { const m = Array.prototype.map.call(arguments, String).join(' '); if (!benign(m)) window.__errs.push(m); } catch (e) {} _ce.apply(console, arguments); };
    window.addEventListener('error', (e) => { try { if (!benign(e.message)) window.__errs.push('ERR:' + e.message); } catch (x) {} });
    window.addEventListener('unhandledrejection', (e) => { try { if (!benign(String(e.reason))) window.__errs.push('REJ:' + String(e.reason)); } catch (x) {} });
    rt.init();
    // 逻辑步 + 界面帧。33ms ≈ 30fps，基础虚拟时间步 BASE_DT = 1/30s，1 倍速≈真实时间。
    let running = false;
    function loop() {
      if (running) return;
      running = true;
      try {
        rt.tick();
        ui.frame();
      } catch (e) {
        console.error('主循环异常', e && e.stack || e);
      } finally { running = false; }
    }
    loop();
    setInterval(loop, 33);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.OS = window.OS || {});
