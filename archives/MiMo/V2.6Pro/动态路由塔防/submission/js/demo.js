/* demo.js — 三段实战演示 */
(function(){
'use strict';
const G = window.G;

class Demo {
  constructor(){
    this.playing = false;
    this.currentId = null;
    this.time = 0;
    this.timeline = [];
    this.camTarget = null;
    this.camDist = null;
    this.camTheta = null;
    this.camPhi = null;
    this._camLerp = null;
  }

  play(demoId){
    this.currentId = demoId;
    this.playing = true;
    this.time = 0;
    G.util.show('demo-badge', true);
    G.util.el('demo-name').textContent = demoId === 'demo-1' ? '分段取舍' : demoId === 'demo-2' ? '旁路直通' : '蛰影现身';
    G.util.show('topbar', true);
    G.util.show('deploy-bar', true);
    G.util.show('forecast', true);
    G.util.show('item-bar', true);

    // 根据演示选择地图
    const mapId = demoId === 'demo-1' ? 'map1' : demoId === 'demo-2' ? 'map2' : 'map3';
    if(G.main) G.main.startGame(mapId, true);

    // 设置演示时间线
    this._buildTimeline(demoId);
    G.audio.sfx('click');
  }

  stop(){
    this.playing = false;
    this.currentId = null;
    G.util.show('demo-badge', false);
    G.ui.hideSubtitle();
    if(G.ui) G.ui.showScreen('menu-main');
    if(G.audio) G.audio.playMusic('menu');
  }

  _buildTimeline(demoId){
    this.timeline = [];
    // 全局地图中心
    const cx = 0, cz = 0;

    if(demoId === 'demo-1'){
      this.timeline = [
        {t:0, action:()=>{
          G.ui.showSubtitle('实战演示 · 分段取舍：西边界节点隔离', 4);
          this._camTo(cx, 0, cz, 32, 0.35, 0.32);
        }},
        {t:3, action:()=>{
          G.ui.showSubtitle('玩家将网闸拖向西边界节点 N1…', 3);
          if(G.scene) G.scene.startDrag('gate');
        }},
        {t:5, action:()=>{
          const g = G.game.grid;
          const nn = (g.namedNodes||[]).find(n=>n.id==='N1');
          if(nn && G.game){
            const pv = G.game.router.previewIsolate(nn.x, nn.z);
            if(pv.ok && G.scene) G.scene.updateRoutePreview(pv.routes, 0xffaa33);
            G.ui.showSubtitle('预览：A 折向 DMZ 互联，与 B 汇流', 3);
            const w = g.toWorld(nn.x, nn.z);
            this._camTo(w.x, 0, w.z, 20, 0.4, 0.35);
          }
        }},
        {t:8, action:()=>{
          const g = G.game.grid;
          const nn = (g.namedNodes||[]).find(n=>n.id==='N1');
          if(nn && G.game){
            G.game.deployTower('gate', nn.x, nn.z);
            if(G.scene){
              const tower = G.game.getTowerAt(nn.x, nn.z);
              if(tower) G.scene.buildTowerMesh(tower);
              G.scene.clearRoutePreview();
              G.scene._updateRouteLines();
              G.scene.cancelDrag();
            }
            G.ui.showSubtitle('确认隔离！办公网段的敌人掉头', 3);
          }
        }},
        {t:12, action:()=>{
          G.ui.showSubtitle('敌人沿新路线转向 DMZ 通道', 3);
          this._camTo(cx, 0, cz, 28, 0.5, 0.33);
        }},
        {t:16, action:()=>{
          G.ui.showSubtitle('守方火力覆盖新路线，击退部分入侵', 3);
        }},
        {t:20, action:()=>{
          G.ui.showSubtitle('演示结束', 2);
          this._camTo(cx, 0, cz, 38, 0.35, 0.28);
        }},
        {t:22, action:()=>{ this.stop(); }}
      ];
    }
    else if(demoId === 'demo-2'){
      this.timeline = [
        {t:0, action:()=>{
          G.ui.showSubtitle('实战演示 · 旁路直通：洪峰中的节点攻防', 4);
          this._camTo(cx, 0, cz, 32, 0.35, 0.32);
        }},
        {t:3, action:()=>{
          G.ui.showSubtitle('洪泛团冲击节点上的网闸！', 3);
        }},
        {t:6, action:()=>{
          G.ui.showSubtitle('网闸被冲毁，C、B 路线改回原数据中心', 3);
          const g = G.game.grid;
          const nn = (g.namedNodes||[]).find(n=>n.id==='N2');
          if(nn){
            const tower = G.game.getTowerAt(nn.x, nn.z);
            if(tower){ tower.hp = 0; tower.alive = false; G.game.onTowerDestroyed(tower); }
          }
          if(G.scene) G.scene._updateRouteLines();
        }},
        {t:10, action:()=>{
          G.ui.showSubtitle('同时在 A 的路线上投下协议降级', 3);
          if(G.game){
            const route = G.game.router.routes['A'];
            if(route && route.length > 3){
              const mid = route[Math.floor(route.length/2)];
              G.game.itemMgr.confirmUse('downgrade', mid.gx, mid.gz);
            }
          }
        }},
        {t:14, action:()=>{
          G.ui.showSubtitle('协议降级生效：敌人减速，木马显形', 3);
          this._camTo(cx, 0, cz, 26, 0.6, 0.33);
        }},
        {t:18, action:()=>{
          G.ui.showSubtitle('守方趁机集中火力，击退洪泛团', 3);
        }},
        {t:22, action:()=>{
          G.ui.showSubtitle('演示结束', 2);
        }},
        {t:24, action:()=>{ this.stop(); }}
      ];
    }
    else if(demoId === 'demo-3'){
      this.timeline = [
        {t:0, action:()=>{
          G.ui.showSubtitle('实战演示 · 蛰影现身：潜伏—提权—破坏', 4);
          this._camTo(cx, 0, cz, 32, 0.35, 0.32);
        }},
        {t:3, action:()=>{
          G.ui.showSubtitle('蛰影锁死前方一段运维环！', 3);
          if(G.game){
            const boss = G.game.enemies.find(e=>e.type==='boss_ying');
            if(boss) boss._lockRoadSegment();
          }
          if(G.scene) G.scene._updateRouteLines();
        }},
        {t:7, action:()=>{
          G.ui.showSubtitle('各入口路线重新收敛', 3);
          this._camTo(cx, 0, cz, 28, 0.5, 0.33);
        }},
        {t:11, action:()=>{
          G.ui.showSubtitle('选中修复进程，释放冗余切换', 3);
          if(G.game){
            const repair = G.game.towers.find(t=>t.type==='repair');
            if(repair){
              if(G.ui) G.ui.selectEntity({kind:'tower', data:repair});
              repair.useSkill();
            }
          }
        }},
        {t:15, action:()=>{
          G.ui.showSubtitle('友塔获得护盾，加密解除', 3);
          this._camTo(cx, 0, cz, 26, 0.4, 0.34);
        }},
        {t:19, action:()=>{
          G.ui.showSubtitle('蛰影提权，强化护甲并释放木马', 3);
          if(G.game){
            const boss = G.game.enemies.find(e=>e.type==='boss_ying');
            if(boss && boss.hp/boss.maxHp > 0.65) boss.hp = boss.maxHp * 0.6;
          }
        }},
        {t:23, action:()=>{
          G.ui.showSubtitle('守方承受压力，仍有来有回', 3);
        }},
        {t:26, action:()=>{
          G.ui.showSubtitle('演示结束', 2);
        }},
        {t:28, action:()=>{ this.stop(); }}
      ];
    }
  }

  _camTo(tx, ty, tz, dist, theta, phi){
    if(!G.scene) return;
    // 相对于地图中心的位置
    this._camLerp = {
      target: new THREE.Vector3(tx, ty, tz),
      dist: dist || G.scene.cameraDist,
      theta: theta !== undefined ? theta : G.scene.cameraTheta,
      phi: phi !== undefined ? phi : G.scene.cameraPhi,
      t: 0
    };
  }

  update(dt){
    if(!this.playing) return;
    this.time += dt;

    // 执行时间线
    while(this.timeline.length > 0 && this.timeline[0].t <= this.time){
      const event = this.timeline.shift();
      event.action();
    }

    // 相机过渡
    if(this._camLerp && G.scene){
      const l = this._camLerp;
      l.t += dt * 0.8;
      const k = G.M.easeInOutCubic(Math.min(l.t, 1));
      G.scene.cameraTarget.lerp(l.target, k * 0.1);
      G.scene.cameraDist = G.M.lerp(G.scene.cameraDist, l.dist, k * 0.1);
      G.scene.cameraTheta = G.M.lerp(G.scene.cameraTheta, l.theta, k * 0.1);
      G.scene.cameraPhi = G.M.lerp(G.scene.cameraPhi, l.phi, k * 0.1);
      G.scene.updateCamera();
      if(l.t >= 1) this._camLerp = null;
    }
  }
}

G.Demo = Demo;

})();
