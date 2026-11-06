// 启动
(function () {
  'use strict';
  const AE = window.AE, App = AE.App, E = AE.Eval;
  function boot() {
    AE.Viewer.init();
    App.initLayout();
    if (AE.UI && AE.UI.init) AE.UI.init();
    App.proj = AE.Demo.build();
    E.bump(); E.index(App.proj);
    App.stack = [{ comp: App.proj.mainComp }];
    App.resetHistory();
    addEventListener('keydown', (e) => { if (AE.Viewer.penKey && AE.Viewer.penKey(e)) { e.preventDefault(); return; } App.onKey(e); });
    // 点击按钮/下拉后释放焦点，避免空格等快捷键再次触发按钮
    document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button,select,input[type=checkbox]'); if (b && b.tagName !== 'SELECT') setTimeout(() => b.blur(), 0); });
    document.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') e.target.blur(); });
    setTimeout(() => { AE.Viewer.fit(); App.mark(); }, 30);
    requestAnimationFrame(App.frame);
    window.__ready = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
