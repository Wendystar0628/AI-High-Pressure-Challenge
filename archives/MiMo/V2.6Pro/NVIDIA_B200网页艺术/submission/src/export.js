// ============================================================
// videoExport 固定接口：begin / frame / end（本地 file:// 可用）
// ============================================================
import { chapterRanges, progressToScrollY, LAYOUT } from './timeline.js';
import { store } from './state.js';

export function installVideoExport(ctx) {
  /**
   * ctx: {
   *   setExportMode(bool),
   *   renderAt(progress, time) -> void  (同步设置并渲染一帧),
   *   resetInteractions(),
   * }
   */
  let active = false;

  const api = {
    runs: ['page'],
    async begin(run = 'page', opts = {}) {
      if (run !== 'page') throw new Error('unknown run: ' + run);
      active = true;
      window.__exportMode = true;
      ctx.setExportMode(true);
      // 回到开场状态：进度 0、复位临时交互
      ctx.resetInteractions();
      ctx.renderAt(0, 0);
      // 等待两帧确保已上屏
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const chapters = chapterRanges();
      return { chapters, fps: opts.fps || 60 };
    },
    async frame(progress, time) {
      if (!active) {
        active = true;
        window.__exportMode = true;
        ctx.setExportMode(true);
      }
      const p = Math.min(1, Math.max(0, Number(progress) || 0));
      const t = Math.max(0, Number(time) || 0);
      ctx.renderAt(p, t);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { progress: p, time: t };
    },
    end() {
      active = false;
      window.__exportMode = false;
      ctx.setExportMode(false);
      ctx.resetInteractions();
      // 恢复正常滚动位置对应的画面
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      ctx.renderAt(p, performance.now() / 1000);
    },
    get active() { return active; },
  };

  window.videoExport = api;
  return api;
}
