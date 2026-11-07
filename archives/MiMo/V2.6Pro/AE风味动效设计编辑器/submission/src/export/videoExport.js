// 逐帧导出接口 window.videoExport
export function installVideoExport(app) {
  let fps = 30;
  let totalFrames = 0;
  let inExport = false;

  window.videoExport = {
    runs: ['demo'],

    async begin(runId, opts = {}) {
      fps = opts.fps || 30;
      const comp = app.project.getMainComp() || app.comp();
      // 回到起始状态
      app.playing = false;
      app.audio.stopAll();
      app.exportMode = true;
      app.time = 0;
      totalFrames = Math.round(comp.duration * fps);
      // 等待示例准备完成
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      app.seek(0);
      app.renderNow();
      inExport = true;
      return { frames: totalFrames };
    },

    async frame(i) {
      if (!inExport) return;
      const comp = app.project.getMainComp() || app.comp();
      const t = Math.min(comp.duration, i / fps);
      app.time = t;
      const frame = app.evaluateAt(t);
      app.engine.renderFrame(frame);
      // 同步界面
      app.ui.refreshTime();
      const ph = document.querySelector('.tl-playhead');
      if (ph) ph.style.left = (t * app.timelineScale) + 'px';
      // 轻量刷新时间相关 UI（属性值）
      app.ui.refreshInspector();
      // 确保画布已呈现
      await new Promise((r) => requestAnimationFrame(r));
    },

    end() {
      inExport = false;
      app.exportMode = false;
      app.seek(0);
      app.requestRender();
      app.ui.refreshTime();
    },
  };
}
