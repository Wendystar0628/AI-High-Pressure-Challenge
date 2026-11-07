/* game.js — 主游戏状态与模拟 */
(function(){
'use strict';
const G = window.G;

class Game {
  constructor(mapDef){
    this.mapDef = mapDef;
    this.grid = mapDef.grid;
    this.router = new G.Router(this.grid);
    this._nextId = 1;

    // 资源
    this.comp = G.CFG.startComp;
    this.intel = G.CFG.startIntel;
    this.integrity = G.CFG.integrityMax;

    // 状态
    this.speed = 1;
    this.paused = false;
    this.running = false;
    this.gameEnded = false;
    this.victory = false;
    this.time = 0;
    this.waveIndex = 0;
    this.waves = G.makeWaves(mapDef.waves, mapDef.waves);
    this.waveActive = false;
    this.waveTimer = 0;
    this.spawnQueue = [];
    this.betweenWaveTimer = 0;

    // 实体
    this.towers = [];
    this.enemies = [];
    this.blackholes = [];  // {x,z,duration,maxDuration}

    // 道具
    this.itemMgr = new G.ItemManager(this);
    this.activeItems = this.itemMgr.activeItems;

    // 统计
    this.stats = {
      kills:0, leaks:0, damageTaken:0,
      towersBuilt:0, towersLost:0, towersSold:0,
      intelEarned:0, bountyEarned:0,
      nodesIsolated:0, itemsUsed:0,
      timePlayed:0, wavesCompleted:0
    };

    // 回调
    this.onStateChange = null;
    this.onWaveStart = null;
    this.onGameOver = null;
    this.onToast = null;

    // 事件日志
    this.eventLog = [];

    this.router.refreshRoutes();
  }

  addToast(msg, type){
    if(this.onToast) this.onToast(msg, type);
    this.eventLog.push({time:this.time, msg, type});
    if(this.eventLog.length > 50) this.eventLog.shift();
  }

  // ---- 塔操作 ----
  canDeploy(type, gx, gz){
    const d = G.TOWER_DATA[type];
    if(!d) return {ok:false, reason:'无效塔类型'};
    if(this.comp < d.cost) return {ok:false, reason:'算力不足'};
    if(!this.grid.inBounds(gx, gz)) return {ok:false, reason:'超出范围'};
    const tile = this.grid.get(gx, gz);

    // 检查放置位置
    if(type === 'firewall'){
      // 链路或节点
      if(tile !== G.TILE.LINK && tile !== G.TILE.NODE && tile !== G.TILE.OLDLINK && tile !== G.TILE.ENTRY && tile !== G.TILE.EXIT)
        return {ok:false, reason:'防火墙只能部署在链路或节点上'};
      if(tile === G.TILE.ENTRY || tile === G.TILE.EXIT)
        return {ok:false, reason:'不能在入口或出口部署'};
    }
    else if(type === 'honeypot'){
      if(tile !== G.TILE.LINK && tile !== G.TILE.OLDLINK)
        return {ok:false, reason:'蜜罐只能部署在链路上'};
    }
    else if(type === 'gate'){
      if(tile !== G.TILE.NODE)
        return {ok:false, reason:'网闸只能部署在交换节点上'};
    }
    else {
      // 平台塔
      if(tile !== G.TILE.PLATFORM)
        return {ok:false, reason:'该塔只能部署在设备平台上'};
    }

    // 检查是否已有塔
    if(this.getTowerAt(gx, gz)) return {ok:false, reason:'该位置已有塔'};

    // 节点隔离检查（防火墙/网闸在节点上会隔离）
    if((type === 'firewall' || type === 'gate') && tile === G.TILE.NODE){
      const pv = this.router.previewIsolate(gx, gz);
      if(!pv.ok) return {ok:false, reason:'隔离后会封死通路'};
    }

    return {ok:true};
  }

  deployTower(type, gx, gz, angle){
    const check = this.canDeploy(type, gx, gz);
    if(!check.ok) return null;
    const d = G.TOWER_DATA[type];
    this.comp -= d.cost;
    const tower = new G.Tower(type, gx, gz, this);
    if(angle !== undefined) tower.angle = angle;
    this.towers.push(tower);
    this.stats.towersBuilt++;

    // 节点隔离
    if((type === 'firewall' || type === 'gate') && this.grid.isNode(gx, gz)){
      this.grid.setBlocked(gx, gz, true);
      this.router.refreshRoutes();
      this.rerouteAllEnemies();
      this.stats.nodesIsolated++;
      G.audio.sfx('isolate');
    }

    G.audio.sfx('deploy');
    return tower;
  }

  sellTower(tower){
    const idx = this.towers.indexOf(tower);
    if(idx < 0) return;
    const refund = tower.sellValue();
    this.comp += refund;
    this.towers.splice(idx, 1);
    this.stats.towersSold++;

    // 如果是节点塔，解除隔离
    if(tower.isNodeTower && this.grid.isNode(tower.gx, tower.gz)){
      // 检查是否有其他隔离方式
      const hasItem = this.activeItems.some(i=>i.type==='isolator' && i.gx===tower.gx && i.gz===tower.gz);
      if(!hasItem){
        this.grid.setBlocked(tower.gx, tower.gz, false);
        this.router.refreshRoutes();
        this.rerouteAllEnemies();
      }
    }
    G.audio.sfx('sell');
    this.addToast('撤下 '+tower.data.name+'，返还 '+refund+' 算力', 'ok');
  }

  getTowerAt(gx, gz){
    return this.towers.find(t=>t.gx===gx && t.gz===gz && t.alive);
  }

  onTowerDestroyed(tower){
    this.stats.towersLost++;
    const w = tower.worldPos();
    G.effects.burst(w, 0xff4444, 15, {speed:5, life:0.6});
    G.audio.sfx('tower_down');
    this.addToast(tower.data.name+' 被摧毁！', 'err');

    // 节点塔被毁 → 隔离解除
    if(tower.isNodeTower && this.grid.isNode(tower.gx, tower.gz)){
      const hasItem = this.activeItems.some(i=>i.type==='isolator' && i.gx===tower.gx && i.gz===tower.gz);
      if(!hasItem){
        this.grid.setBlocked(tower.gx, tower.gz, false);
        this.router.refreshRoutes();
        this.rerouteAllEnemies();
        this.addToast('节点隔离解除，道路重新开放', 'warn');
      }
    }

    const idx = this.towers.indexOf(tower);
    if(idx >= 0) this.towers.splice(idx, 1);
    if(this.meshGroup) this.meshGroup.remove(tower.mesh);
  }

  // ---- 节点隔离操作 ----
  isNodeIsolated(gx, gz){
    return this.grid.isBlocked(gx, gz);
  }

  tryIsolateNode(gx, gz){
    if(!this.grid.isNode(gx, gz)) return {ok:false, reason:'不是交换节点'};
    if(this.isNodeIsolated(gx, gz)) return {ok:false, reason:'已被隔离'};
    if(this.intel < 5) return {ok:false, reason:'情报不足（需要 5）'};
    const pv = this.router.previewIsolate(gx, gz);
    if(!pv.ok) return {ok:false, reason:'隔离后会封死通路'};
    // 检查敌人是否有路
    return {ok:true, routes:pv.routes};
  }

  confirmIsolateNode(gx, gz){
    const check = this.tryIsolateNode(gx, gz);
    if(!check.ok) return false;
    this.intel -= 5;
    this.grid.setBlocked(gx, gz, true);
    this.router.refreshRoutes();
    this.rerouteAllEnemies();
    this.stats.nodesIsolated++;
    G.audio.sfx('isolate');
    this.addToast('节点已隔离', 'ok');
    return true;
  }

  tryReleaseNode(gx, gz){
    if(!this.grid.isNode(gx, gz)) return {ok:false, reason:'不是交换节点'};
    if(!this.isNodeIsolated(gx, gz)) return {ok:false, reason:'未被隔离'};
    // 检查是否有塔在上面
    const tower = this.getTowerAt(gx, gz);
    return {ok:true, tower};
  }

  confirmReleaseNode(gx, gz){
    const check = this.tryReleaseNode(gx, gz);
    if(!check.ok) return false;
    if(check.tower){
      this.sellTower(check.tower);
    }
    // 检查道具隔离器
    const item = this.activeItems.find(i=>i.type==='isolator' && i.gx===gx && i.gz===gz);
    if(item){
      this.itemMgr._removeItem(item);
      const idx = this.activeItems.indexOf(item);
      if(idx>=0) this.activeItems.splice(idx,1);
    }
    this.grid.setBlocked(gx, gz, false);
    // 再次隔离间隔
    this.grid._reisolateBlock = this.grid._reisolateBlock || {};
    this.grid._reisolateBlock[gx+','+gz] = G.CFG.nodeReisolateDelay;
    this.router.refreshRoutes();
    this.rerouteAllEnemies();
    G.audio.sfx('release');
    this.addToast('隔离解除', 'ok');
    return true;
  }

  // ---- 敌人 ----
  spawnEnemy(type, entryId){
    const e = new G.Enemy(type, this, entryId);
    // 从入口出发
    const entry = this.grid.entries.find(en=>en.id===entryId) || this.grid.entries[0];
    const w = this.grid.toWorld(entry.x, entry.z);
    const startPos = {x:w.x, y: e.flying?2.5:0, z:w.z};
    e.gx = entry.x; e.gz = entry.z;

    if(e.flying){
      // 飞行：直飞最近出口
      const exits = this.grid.exits;
      const target = exits[0];
      const tw = this.grid.toWorld(target.x, target.z);
      e.path = [
        {x:startPos.x, y:2.5, z:startPos.z, gx:entry.x, gz:entry.z},
        {x:tw.x, y:2.5, z:tw.z, gx:target.x, gz:target.z}
      ];
    } else {
      const p = this.router.findPath(entry.x, entry.z);
      if(p) e.setPath(p);
    }

    e.mesh = G.buildEnemyModel(type);
    e.mesh.position.set(startPos.x, startPos.y, startPos.z);
    if(this.meshGroup) this.meshGroup.add(e.mesh);
    this.enemies.push(e);
    return e;
  }

  rerouteAllEnemies(){
    for(const e of this.enemies){
      if(!e.alive || e.flying) continue;
      e.repath();
    }
  }

  addBlackhole(gx, gz, duration){
    this.grid.setBlocked(gx, gz, true);
    this.blackholes.push({x:gx, z:gz, duration, maxDuration:duration});
    this.router.refreshRoutes();
    this.rerouteAllEnemies();
    G.audio.sfx('warn');
  }

  // ---- 波次 ----
  startWave(){
    if(this.waveIndex >= this.waves.length) return;
    const wave = this.waves[this.waveIndex];
    this.waveActive = true;
    this.waveTimer = 0;
    this.spawnQueue = [];

    for(const g of wave.groups){
      for(let i=0; i<g.count; i++){
        this.spawnQueue.push({
          type: g.type,
          entryId: g.entryId,
          time: g.delay + i * g.interval
        });
      }
    }
    this.spawnQueue.sort((a,b)=>a.time-b.time);

    if(wave.isBoss){
      G.audio.sfx('boss');
      this.addToast('警告：Boss 级威胁接近！', 'warn');
    } else if(wave.isFlood){
      G.audio.sfx('warn');
      this.addToast('洪峰来袭！多入口大量出兵', 'warn');
    } else {
      G.audio.sfx('wave');
      this.addToast('第 '+(this.waveIndex+1)+' 波开始', 'ok');
    }
    if(this.onWaveStart) this.onWaveStart(this.waveIndex);
  }

  nextWave(){
    if(this.waveIndex < this.waves.length - 1){
      this.waveIndex++;
      this.betweenWaveTimer = 5;
    }
  }

  // ---- 主更新 ----
  update(dt){
    if(this.gameEnded || this.paused) return;
    this.time += dt;
    this.stats.timePlayed = this.time;

    // 资源增长
    this.comp += G.CFG.compPerSecond * dt;

    // 再次隔离间隔
    if(this.grid._reisolateBlock){
      for(const k in this.grid._reisolateBlock){
        if(this.grid._reisolateBlock[k] > 0) this.grid._reisolateBlock[k] -= dt;
      }
    }

    // 旧链路降级倒计时
    for(let i=0; i<this.grid.oldOverlay.length; i++){
      if(this.grid.oldOverlay[i] > 0) this.grid.oldOverlay[i] -= dt;
    }

    // 黑洞倒计时
    for(let i=this.blackholes.length-1; i>=0; i--){
      this.blackholes[i].duration -= dt;
      if(this.blackholes[i].duration <= 0){
        const bh = this.blackholes[i];
        // 检查是否有其他阻断
        const hasOther = this.blackholes.some((b,j)=>j!==i && b.x===bh.x && b.z===bh.z);
        const hasItem = this.activeItems.some(it=>it.type==='isolator' && it.gx===bh.x && it.gz===bh.z);
        const hasTower = this.getTowerAt(bh.x, bh.z);
        if(!hasOther && !hasItem && !hasTower){
          this.grid.setBlocked(bh.x, bh.z, false);
        }
        this.blackholes.splice(i, 1);
        this.router.refreshRoutes();
        this.rerouteAllEnemies();
      }
    }

    // 道具
    this.itemMgr.update(dt);

    // 波次推进
    if(this.betweenWaveTimer > 0){
      this.betweenWaveTimer -= dt;
      if(this.betweenWaveTimer <= 0) this.startWave();
    }
    if(this.waveActive){
      this.waveTimer += dt;
      // 生成敌人
      while(this.spawnQueue.length > 0 && this.spawnQueue[0].time <= this.waveTimer){
        const spawn = this.spawnQueue.shift();
        this.spawnEnemy(spawn.type, spawn.entryId);
      }
      // 检查波次完成
      if(this.spawnQueue.length === 0 && this.enemies.filter(e=>e.alive).length === 0){
        this.waveActive = false;
        this.stats.wavesCompleted++;
        // 波次奖励
        const waveBonus = 30 + this.waveIndex * 8;
        this.intel += waveBonus;
        this.stats.intelEarned += waveBonus;
        this.addToast('第 '+(this.waveIndex+1)+' 波完成，情报 +'+waveBonus, 'ok');
        if(this.waveIndex >= this.waves.length - 1){
          this.gameOver(true);
        } else {
          this.nextWave();
        }
      }
    }

    // 更新塔
    for(const t of this.towers){
      if(t.alive) t.update(dt);
    }

    // 更新敌人
    for(const e of this.enemies){
      if(e.alive) e.update(dt);
    }

    // 清理死亡敌人
    this.enemies = this.enemies.filter(e=>e.alive || e.leaking);

    // 情报：持续守住隔离节点
    const isolatedNodes = [];
    this.grid.forEach((x,z,t)=>{
      if(t === G.TILE.NODE && this.grid.isBlocked(x,z)) isolatedNodes.push({x,z});
    });
    if(isolatedNodes.length > 0 && this.time % 5 < dt){
      this.intel += isolatedNodes.length;
      this.stats.intelEarned += isolatedNodes.length;
    }
  }

  gameOver(win){
    if(this.gameEnded) return;
    this.gameEnded = true;
    this.victory = win;
    this.running = false;
    if(win){
      G.audio.sfx('victory');
    } else {
      G.audio.sfx('defeat');
    }
    if(this.onGameOver) this.onGameOver(win);
  }

  // 获取流量预报数据
  getForecast(){
    const result = {};
    for(const e of this.grid.entries){
      result[e.id] = {types:{}, total:0};
    }
    // 当前场上的
    for(const e of this.enemies){
      if(!e.alive) continue;
      const eid = e.entryId;
      if(!result[eid]) result[eid] = {types:{}, total:0};
      result[eid].types[e.type] = (result[eid].types[e.type]||0) + 1;
      result[eid].total++;
    }
    // 即将到来的
    if(this.waveActive){
      for(const s of this.spawnQueue){
        const eid = s.entryId;
        if(!result[eid]) result[eid] = {types:{}, total:0};
        result[eid].types[s.type] = (result[eid].types[s.type]||0) + 1;
        result[eid].total++;
      }
    }
    return result;
  }
}

G.Game = Game;

})();
