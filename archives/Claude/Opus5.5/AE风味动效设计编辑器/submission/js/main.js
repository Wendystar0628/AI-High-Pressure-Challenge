'use strict';
// ============ 启动与逐帧导出接口 ============
const Boot = {
  ready: null,
  start() {
    let ok;
    this.ready = new Promise(r => ok = r);
    try {
      Toolbar.init(); Viewer.init(); Timeline.init(); Inspector.init(); NodeView.init(); Keys.init(); Splitters.init();
      App.setProject(Demo.build(), false); App.isDemo = true; History.init();
      App.sel.layers = [];
      Viewer.fit(); App.flush();
      App.status('已载入示例「锻字」。空格播放；首次点击后启用声音。');
    } catch (e) { console.error(e); App.status('初始化失败：' + e.message); }
    // 预热：生成字形与几何缓存
    setTimeout(() => { try { App.flush(); } catch (e) { } ok(true); }, 30);
  },
};
window.addEventListener('load', () => Boot.start());

// 导出导演：按阶段切换所选图层，使属性面板与时间轴展示当前阶段的工程内容
const Director = {
  plan: [[0, '字源'], [3.45, '字块'], [6.0, '锤'], [9.75, '火星'], [11.0, '字块']],
  apply(t) {
    const c = App.comp; let name = null; for (const [t0, n] of this.plan) if (t >= t0) name = n;
    const L = name && Model.layerByName(c, name); if (!L) return;
    if (App.sel.layers[0] !== L.id) {
      App.sel.layers = [L.id]; App.sel.props.clear();
      Timeline.expanded.clear(); Timeline.revealMap.clear(); Timeline.expanded.add(L.id + '');
      const set = new Set(); for (const f of Model.flatProps(L)) if (Anim.isAnimated(f.node.prop) || f.node.prop.xOn) set.add(f.node.prop.id);
      if (set.size) Timeline.revealMap.set(L.id, set);
      App.flags.add('struct');
    }
  },
};

window.videoExport = {
  runs: ['demo'],
  fps: 60,
  async begin(runId, opts = {}) {
    await Boot.ready;
    if (runId !== 'demo') throw new Error('未知的导出段：' + runId);
    if (App.playing) App.pause();
    App.exportMode = true; document.body.classList.add('exporting');
    App.setProject(Demo.build(), false); History.init(); App.isDemo = true;
    Inspector.mode = null; Timeline.mode = 'tl'; Timeline.updTabs();
    this.fps = opts.fps || 60;
    Viewer.fit(true); Timeline.fitAll();
    App.times[App.compId] = 0; Director.apply(0); App.flags.add('struct'); App.flags.add('time'); App.flush();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { frames: Math.round(App.comp.duration * this.fps) };
  },
  async frame(i) {
    const t = Math.min(i / this.fps, App.comp.duration - 1e-4);
    App.times[App.compId] = t; Director.apply(t);
    App.flags.add('time'); App.flags.add('vals');
    if (App._raf) { cancelAnimationFrame(App._raf); App._raf = 0; }
    App.flush();
    GLX.gl.finish();
    await new Promise(r => requestAnimationFrame(() => r()));
  },
  end() { App.exportMode = false; document.body.classList.remove('exporting'); App.request('struct'); },
};
