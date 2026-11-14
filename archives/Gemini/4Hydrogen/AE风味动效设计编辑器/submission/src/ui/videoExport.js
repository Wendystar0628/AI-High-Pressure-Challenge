// 评测与高清导出固定接口 window.videoExport
// 契约：runs: ['demo'], begin(runId, { fps }) -> { frames: 15 * fps }, frame(i), end()

import { createForgeDemoProject } from '../demo/forgeDemo.js';
import { getActiveComp, serializeProject, deserializeProject } from '../core/project.js';

export function installVideoExport(app) {
  let _savedState = null;
  let _exportState = null;

  const waitForPaint = () =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

  window.videoExport = {
    runs: ['demo'],

    async begin(runId, opts = {}) {
      if (runId !== 'demo') {
        throw new Error(`未知导出 runId: ${runId}`);
      }
      const fps = Math.max(1, Number(opts.fps) || 30);
      const durationSec = 15;
      const totalFrames = Math.round(durationSec * fps);

      app.stopPlayback();
      app.audio.stopAll();

      _savedState = {
        projectJson: serializeProject(app.project),
        showGizmos: app.viewport.showGizmos,
        centerMode: app.centerMode,
      };

      // 进入固定演示项目并关闭辅助框/声音播放循环，保留真实渲染与界面状态同步
      app.isExportMode = true;
      app.project = createForgeDemoProject();
      app.setCenterMode('viewport', true);
      app.viewport.showGizmos = false;

      const comp = getActiveComp(app.project);
      if (comp) {
        comp.currentTime = 0;
        comp.layers.forEach((l) => {
          l._simCache = null;
          if (l.particle) l.particle._simCache = null;
        });
      }

      _exportState = {
        fps,
        totalFrames,
        durationSec,
      };

      app.refreshAll();
      await waitForPaint();
      return { frames: totalFrames };
    },

    async frame(i) {
      if (!_exportState || !app.isExportMode) {
        throw new Error('videoExport.frame 调用前必须先调用 begin()');
      }
      const comp = getActiveComp(app.project);
      if (!comp) throw new Error('无有效活动合成');

      const t = Math.max(0, Math.min(_exportState.durationSec, i / _exportState.fps));
      comp.currentTime = t;

      // 精确推进到 t 时刻并刷新画布、播放头、时间线指针与属性面板（不触发音频与播放循环）
      app.renderCurrentFrame({ exportQuality: true });
      app.timelinePanel?.updatePlayheadOnly();
      app.propertiesPanel?.refreshValuesOnly();
      if (app.showGraphEditor) app.graphEditor?.render();

      await waitForPaint();
    },

    async end() {
      if (_savedState) {
        app.project = deserializeProject(_savedState.projectJson);
        app.viewport.showGizmos = _savedState.showGizmos;
        app.setCenterMode(_savedState.centerMode || 'viewport', true);
        _savedState = null;
      } else {
        app.viewport.showGizmos = true;
      }
      app.isExportMode = false;
      _exportState = null;
      app.refreshAll();
      await waitForPaint();
    },
  };
}
