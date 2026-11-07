/* main.js — 启动与主循环 */
(function(){
'use strict';
const G = window.G;

class Main {
  constructor(){
    this.scene = null;
    this.game = null;
    this.ui = null;
    this.demo = null;
    this.hud = null;
    this.exportMode = false;
    this._lastTime = 0;
    this._animFrame = 0;
  }

  async init(){
    const loadMsg = G.util.el('load-msg');
    const loadFill = G.util.el('load-fill');

    const setProgress = (p, msg)=>{
      if(loadFill) loadFill.style.width = (p*100)+'%';
      if(loadMsg) loadMsg.textContent = msg;
    };

    setProgress(0.1, '初始化渲染引擎…');
    await this._sleep(50);

    // 创建场景
    const canvas = G.util.el('gl');
    this.scene = new G.SceneManager(canvas);
    G.scene = this.scene;

    setProgress(0.3, '构建用户界面…');
    await this._sleep(50);

    // UI
    this.ui = new G.UI();
    G.ui = this.ui;
    this.hud = this.ui.hud;
    G.hud = this.hud;

    setProgress(0.5, '加载地图数据…');
    await this._sleep(50);

    // 演示系统
    this.demo = new G.Demo();
    G.demo = this.demo;
    G.main = this;

    setProgress(0.7, '构建部署面板…');
    await this._sleep(50);

    // 构建 HUD
    this.hud.buildDeployBar();
    this.hud.buildItemBar();

    setProgress(0.9, '启动守护进程…');
    await this._sleep(100);

    // 初始场景（预览地图 1）
    this._buildPreviewScene();

    setProgress(1.0, '就绪');
    await this._sleep(200);

    // 隐藏加载，显示主菜单
    G.util.show('loading', false);
    this.ui.showScreen('menu-main');

    // 播放菜单音乐
    G.audio.playMusic('menu');

    // 主循环
    this._lastTime = performance.now();
    this._loop();
  }

  _sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

  _buildPreviewScene(){
    // 用地图 1 构建预览场景
    const mapDef = G.MAPS.map1;
    this.game = new G.Game(mapDef);
    G.game = this.game;
    this.scene.buildScene(this.game);
    this.game.running = false;
    this.game.paused = true;
  }

  startGame(mapId, isDemo){
    const mapDef = G.MAPS[mapId];
    if(!mapDef) return;

    // 重置 RNG
    G.RNG.seed(mapId.charCodeAt(4) * 1000 + Date.now() % 10000);

    this.game = new G.Game(mapDef);
    G.game = this.game;

    // 回调
    this.game.onToast = (msg, type)=>this.ui.addToast(msg, type);
    this.game.onGameOver = (win)=>this.ui.showReport(this.game, win);

    // 构建场景
    this.scene.buildScene(this.game);

    // 开始游戏
    this.game.running = true;
    this.game.paused = isDemo ? false : true;
    this.game.betweenWaveTimer = 8;

    // UI
    this.ui.enterGame();
    if(!isDemo){
      this.ui.addToast('部署防御，然后开始第一波', 'ok');
    }

    // 音乐
    G.audio.playMusic(mapId);

    if(!isDemo){
      // 显示提示
      this.ui.showSubtitle('拖动塔卡片到地图部署 · 中键拖动旋转视角 · 空格暂停', 5);
    }
  }

  restartGame(){
    if(!this.game) return;
    this.startGame(this.game.mapDef.id);
  }

  _loop(){
    this._animFrame = requestAnimationFrame(()=>this._loop());

    const now = performance.now();
    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    dt = Math.min(dt, 0.1); // 防止大跳

    if(this.exportMode){
      // 导出模式：由 videoExport.frame() 驱动
      if(G.scene) G.scene.render(0);
      return;
    }

    // 演示更新
    if(this.demo && this.demo.playing){
      this.demo.update(dt);
    }

    // 游戏更新
    if(this.game && this.game.running && !this.game.paused && !this.game.gameEnded){
      // 固定时间步
      const simDt = 1 / G.CFG.simHz;
      this._accum = (this._accum || 0) + dt * this.game.speed;
      while(this._accum >= simDt){
        this.game.update(simDt);
        this._accum -= simDt;
        if(this.game.gameEnded) break;
      }
    }

    // 渲染
    if(G.scene) G.scene.render(dt);

    // HUD
    if(this.hud && this.game){
      this.hud.update(this.game, dt);
    }
  }
}

// 启动
window.addEventListener('DOMContentLoaded', ()=>{
  const main = new Main();
  G.main = main;
  main.init();
});

})();
