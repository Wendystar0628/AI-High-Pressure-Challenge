/* videoexport.js — window.videoExport 接口 */
(function(){
'use strict';
const G = window.G;

const videoExport = {
  runs: ['demo-1', 'demo-2', 'demo-3'],
  _active: false,
  _runId: null,
  _fps: 30,
  _frames: 0,
  _currentFrame: -1,
  _demo: null,

  async begin(runId, opts){
    if(!this.runs.includes(runId)) throw new Error('Unknown run: '+runId);
    opts = opts || {};
    this._fps = opts.fps || 30;
    this._runId = runId;
    this._active = true;

    // 演示时长（秒）
    const durations = {'demo-1':21, 'demo-2':24, 'demo-3':28};
    const dur = durations[runId] || 20;
    this._frames = Math.ceil(dur * this._fps);
    this._currentFrame = -1;

    // 启动演示（确定性模式）
    if(G.demo){
      // 先启动对应地图的对局
      const mapId = runId === 'demo-1' ? 'map1' : runId === 'demo-2' ? 'map2' : 'map3';
      if(G.main){
        G.main.startGame(mapId, true);
      }
      // 设置演示但不实时播放
      G.demo.currentId = runId;
      G.demo.playing = true;
      G.demo.time = 0;
      G.demo._buildTimeline(runId);
      // 确保 UI 显示
      G.util.show('demo-badge', true);
      G.util.el('demo-name').textContent = runId === 'demo-1' ? '分段取舍' : runId === 'demo-2' ? '旁路直通' : '蛰影现身';
    }

    // 暂停实时循环，由 frame() 驱动
    if(G.game){
      G.game.paused = true;
    }
    if(G.main) G.main.exportMode = true;

    return { frames: this._frames };
  },

  async frame(i){
    if(!this._active) throw new Error('Not in export mode');
    if(i < 0 || i >= this._frames) throw new Error('Frame out of range: '+i);

    const targetTime = i / this._fps;

    // 从上一帧推进到当前帧
    const startTime = this._currentFrame < 0 ? 0 : (this._currentFrame + 1) / this._fps;
    const dt = 1 / this._fps;

    // 推进游戏逻辑
    if(G.game && G.demo){
      // 设置精确时间
      const steps = Math.max(0, Math.round((targetTime - G.demo.time) / dt));
      for(let s = 0; s < steps; s++){
        // 更新演示时间线
        G.demo.time += dt;
        while(G.demo.timeline.length > 0 && G.demo.timeline[0].t <= G.demo.time){
          const event = G.demo.timeline.shift();
          event.action();
        }
        // 更新游戏（暂停状态但手动步进）
        const wasPaused = G.game.paused;
        G.game.paused = false;
        G.game.update(dt);
        G.game.paused = wasPaused;
      }
      // 相机过渡
      if(G.demo._camLerp && G.scene){
        const l = G.demo._camLerp;
        l.t += dt * 0.8;
        const k = G.M.easeInOutCubic(Math.min(l.t, 1));
        G.scene.cameraTarget.lerp(l.target, k * 0.1);
        G.scene.cameraDist = G.M.lerp(G.scene.cameraDist, l.dist, k * 0.1);
        G.scene.cameraTheta = G.M.lerp(G.scene.cameraTheta, l.theta, k * 0.1);
        G.scene.cameraPhi = G.M.lerp(G.scene.cameraPhi, l.phi, k * 0.1);
        G.scene.updateCamera();
        if(l.t >= 1) G.demo._camLerp = null;
      }
    }

    this._currentFrame = i;

    // 渲染当前帧
    if(G.scene) G.scene.render(0);
    if(G.hud) G.hud.update(G.game, 0);

    // 确保页面已绘制
    return new Promise(resolve => requestAnimationFrame(resolve));
  },

  end(){
    this._active = false;
    this._runId = null;
    this._currentFrame = -1;
    if(G.main) G.main.exportMode = false;
    if(G.game) G.game.paused = false;
    if(G.demo){
      G.demo.playing = false;
      G.demo.currentId = null;
    }
    G.util.show('demo-badge', false);
    if(G.ui) G.ui.hideSubtitle();
  }
};

window.videoExport = videoExport;

})();
