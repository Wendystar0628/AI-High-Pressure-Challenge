/* items.js — 道具逻辑 */
(function(){
'use strict';
const G = window.G;
const I = G.ITEM_DATA;

class ItemManager {
  constructor(game){
    this.game = game;
    this.cooldowns = {isolator:0, downgrade:0, restore:0};
    this.activeItems = []; // 场上的临时道具（隔离器等）
    this.pendingItem = null; // 正在选点的道具
  }

  update(dt){
    for(const k in this.cooldowns){
      if(this.cooldowns[k] > 0) this.cooldowns[k] -= dt;
    }
    // 更新场上道具
    for(let i=this.activeItems.length-1; i>=0; i--){
      const item = this.activeItems[i];
      item.duration -= dt;
      if(item.duration <= 0 || item.hp <= 0){
        this._removeItem(item);
        this.activeItems.splice(i, 1);
      }
    }
  }

  canUse(type){
    const d = I[type];
    if(this.cooldowns[type] > 0) return false;
    if(d.costType === 'intel' && this.game.intel < d.cost) return false;
    if(d.costType === 'comp' && this.game.comp < d.cost) return false;
    return true;
  }

  startUse(type){
    if(!this.canUse(type)){
      G.audio.sfx('error');
      return false;
    }
    this.pendingItem = {type, time:0};
    return true;
  }

  cancelUse(){
    this.pendingItem = null;
  }

  // 确认使用（在指定格子）
  confirmUse(type, gx, gz){
    const d = I[type];
    if(!this.canUse(type)) return false;

    if(type === 'isolator'){
      // 需要是直通节点
      if(!this.game.grid.isNode(gx, gz)){
        this.game.addToast('只能在交换节点上放置应急隔离器', 'err');
        G.audio.sfx('error');
        return false;
      }
      if(this.game.isNodeIsolated(gx, gz)){
        this.game.addToast('该节点已被隔离', 'err');
        G.audio.sfx('error');
        return false;
      }
      // 检查连通性
      const pv = this.game.router.previewIsolate(gx, gz);
      if(!pv.ok){
        this.game.addToast('隔离后会封死通路，操作被拒绝', 'err');
        G.audio.sfx('error');
        return false;
      }
      this.game.intel -= d.cost;
      this.cooldowns[type] = d.cooldown;
      this.game.grid.setBlocked(gx, gz, true);
      this.game.router.refreshRoutes();
      this.game.rerouteAllEnemies();
      this.activeItems.push({
        type:'isolator', gx, gz, hp:300, duration:20,
        name:'应急隔离器'
      });
      G.audio.sfx('isolate');
      this.game.addToast('应急隔离器已部署', 'ok');
      return true;
    }

    if(type === 'downgrade'){
      // 一片链路暂时使用旧协议
      this.game.intel -= d.cost;
      this.cooldowns[type] = d.cooldown;
      const range = 3;
      for(let x=gx-range; x<=gx+range; x++){
        for(let z=gz-range; z<=gz+range; z++){
          if(this.game.grid.inBounds(x,z) && this.game.grid.isLinkish(x,z)){
            this.game.grid.oldOverlay[this.game.grid.idx(x,z)] = 12;
          }
        }
      }
      this.game.router.refreshRoutes();
      this.game.rerouteAllEnemies();
      G.audio.sfx('item');
      this.game.addToast('协议降级生效', 'ok');
      return true;
    }

    if(type === 'restore'){
      // 恢复一座塔
      const tower = this.game.getTowerAt(gx, gz);
      if(!tower){
        this.game.addToast('该位置没有塔', 'err');
        G.audio.sfx('error');
        return false;
      }
      this.game.comp -= d.cost;
      this.cooldowns[type] = d.cooldown;
      tower.heal(tower.maxHp * 0.5);
      tower.clearEncrypt();
      G.effects.burst(tower.worldPos(), 0x88ccff, 12, {speed:4, life:0.6});
      G.audio.sfx('heal');
      this.game.addToast('备份还原完成', 'ok');
      return true;
    }
    return false;
  }

  _removeItem(item){
    if(item.type === 'isolator'){
      this.game.grid.setBlocked(item.gx, item.gz, false);
      this.game.router.refreshRoutes();
      this.game.rerouteAllEnemies();
      const w = this.game.grid.toWorld(item.gx, item.gz);
      G.effects.burst(w, 0xffaa44, 8, {speed:3, life:0.5});
    }
  }

  // 隔离器被攻击
  damageItem(item, amount){
    item.hp -= amount;
    if(item.hp <= 0){
      this._removeItem(item);
      const idx = this.activeItems.indexOf(item);
      if(idx >= 0) this.activeItems.splice(idx, 1);
      this.game.addToast('应急隔离器被冲毁！', 'warn');
    }
  }
}

G.ItemManager = ItemManager;

})();
