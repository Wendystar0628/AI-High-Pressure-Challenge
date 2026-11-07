/* enemies.js — 敌人逻辑 */
(function(){
'use strict';
const G = window.G;
const E = G.ENEMY_DATA;

class Enemy {
  constructor(type, game, entryId){
    this.type = type;
    this.game = game;
    this.entryId = entryId || 'A';
    this.id = game._nextId++;
    const d = E[type];
    this.hp = d.hp;
    this.maxHp = d.hp;
    this.speed = d.speed;
    this.baseSpeed = d.speed;
    this.bounty = d.bounty;
    this.intelReward = d.intel;
    this.dmg = d.dmg;
    this.attackRate = d.attackRate;
    this.attackRange = d.attackRange || 0;
    this.radius = d.radius;
    this.flying = d.flying;
    this.camo = d.camo;
    this.blockCost = d.blockCost;
    this.revealed = !d.camo;
    this.alive = true;
    this.leaking = false;
    this.blockedBy = null;
    this.luredBy = null;
    this.canBeLured = (d.dmg > 0 && !d.flying);
    this.shield = 0;
    this.shieldMax = 0;
    this.slowTimer = 0;
    this.slowFactor = 1;
    this.trapTimer = 0;
    this.copied = false;
    this.mesh = null;
    this.meshY = d.flying ? 2.5 : 0.35;
    this.animT = Math.random()*10;
    this.attackCooldown = 0;
    this.bossPhase = 0;
    this.bossAbilityTimer = 6;
    this.pathProgress = 0;
    this.payloadArmed = true; // 木马载荷

    // 路径
    this.path = [];
    this.pathIndex = 0;
    this.gx = 0; this.gz = 0;
  }

  get data(){ return E[this.type]; }
  get isBoss(){ return this.type.startsWith('boss_'); }

  worldPos(){
    if(this.mesh) return {x:this.mesh.position.x, y:this.mesh.position.y, z:this.mesh.position.z};
    const w = this.game.grid.toWorld(this.gx, this.gz);
    return {x:w.x, y:0, z:w.z};
  }

  // 设定路径
  setPath(gridPath){
    this.path = gridPath.map(p=>{
      const w = this.game.grid.toWorld(p.x, p.z);
      return {x:w.x, y:0, z:w.z, gx:p.x, gz:p.z};
    });
    this.pathIndex = 0;
    if(gridPath.length > 0){
      this.gx = gridPath[0].x;
      this.gz = gridPath[0].z;
    }
  }

  // 从当前位置重新寻路
  repath(){
    if(this.flying){
      // 飞行单位直飞出口
      const exits = this.game.grid.exits;
      if(exits.length > 0){
        const target = exits[0];
        const w = this.game.grid.toWorld(this.gx, this.gz);
        const tw = this.game.grid.toWorld(target.x, target.z);
        this.path = [
          {x:w.x, y:0, z:w.z, gx:this.gx, gz:this.gz},
          {x:tw.x, y:2.5, z:tw.z, gx:target.x, gz:target.z}
        ];
        this.pathIndex = 0;
      }
      return;
    }
    const p = this.game.router.pathFrom(this.gx, this.gz);
    if(p) this.setPath(p);
  }

  // 受击
  takeDamage(amount, source){
    if(this.shield > 0){
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
    }
    if(amount <= 0) return;
    // 木马未显形被波及消灭时释放载荷
    if(this.type === 'trojan' && !this.revealed && this.hp - amount <= 0 && this.payloadArmed){
      this.payloadArmed = false;
      this._releasePayload();
    }
    this.hp -= amount;
    if(this.mesh){
      const w = this.worldPos();
      G.effects.burst(w, 0xffaa44, 3, {speed:2, life:0.25, size:0.05});
    }
    if(this.hp <= 0){
      this.hp = 0;
      this.die(source);
    }
  }

  _releasePayload(){
    const w = this.worldPos();
    G.effects.ring(w, 3, 0xff4466, {life:0.5, expand:true});
    G.effects.burst(w, 0xff4466, 15, {speed:5, life:0.6});
    for(const t of this.game.towers){
      if(!t.alive) continue;
      const tw = t.worldPos();
      if(G.M.dist2(w.x, w.z, tw.x, tw.z) <= 9){
        t.takeDamage(35, this);
      }
    }
    G.audio.sfx('explode');
  }

  die(source){
    if(!this.alive) return;
    this.alive = false;
    if(this.blockedBy){
      const idx = this.blockedBy.blockedEnemies.indexOf(this);
      if(idx >= 0) this.blockedBy.blockedEnemies.splice(idx, 1);
      this.blockedBy = null;
    }
    // 资源
    this.game.comp += this.bounty;
    this.game.intel += this.intelReward;
    this.game.stats.kills++;
    this.game.stats.bountyEarned += this.bounty;
    const w = this.worldPos();
    // 死亡特效
    const color = this.data.color;
    G.effects.burst(w, color, this.isBoss ? 30 : 14, {speed: this.isBoss?8:4.5, life: this.isBoss?0.9:0.55, size: this.isBoss?0.15:0.09});
    G.effects.ring(w, this.isBoss?4:1.2, color, {life: this.isBoss?0.8:0.4, expand:true});
    if(this.isBoss){
      G.effects.burst(w, 0xffffff, 20, {speed:10, life:1.0});
      G.audio.sfx('boss');
    } else {
      G.audio.sfx('enemy_die');
    }
    G.effects.floatText(w, '+'+this.bounty, 0xffe066);
    // 移除 mesh
    if(this.mesh && this.game.meshGroup){
      this.game.meshGroup.remove(this.mesh);
    }
  }

  // 状态
  applySlow(duration, factor){
    this.slowTimer = Math.max(this.slowTimer, duration);
    this.slowFactor = Math.min(this.slowFactor, factor);
  }
  applyTrap(duration){
    this.trapTimer = Math.max(this.trapTimer, duration);
    G.audio.sfx('skill');
  }
  applyShield(amount){
    this.shieldMax = Math.max(this.shieldMax, amount);
    this.shield = Math.min(this.shield + amount, this.shieldMax);
  }

  get isTrapped(){ return this.trapTimer > 0; }
  get effectiveSpeed(){
    if(this.isTrapped) return 0;
    let s = this.baseSpeed * this.slowFactor;
    // 旧链路减速
    if(!this.flying){
      const gx = Math.round(this.gx), gz = Math.round(this.gz);
      if(this.game.grid.isOldLink(gx, gz)) s *= 0.65;
    }
    return s;
  }

  // ---- 更新 ----
  update(dt){
    if(!this.alive) return;
    this.animT += dt;
    if(this.slowTimer > 0){
      this.slowTimer -= dt;
      if(this.slowTimer <= 0) this.slowFactor = 1;
    }
    if(this.trapTimer > 0) this.trapTimer -= dt;
    if(this.attackCooldown > 0) this.attackCooldown -= dt;

    // Boss 能力
    if(this.isBoss) this._updateBoss(dt);

    // 被阻挡 → 攻击阻挡塔
    if(this.blockedBy && this.blockedBy.alive){
      this._attackTower(this.blockedBy, dt);
      return;
    }
    if(this.blockedBy && !this.blockedBy.alive){
      this.blockedBy = null;
      this.repath();
    }

    // 勒索者：远程攻击塔
    if(this.type === 'ransom' && this.attackCooldown <= 0){
      this._tryRangedAttack(dt);
    }

    // 加壳器：给同伴加盾
    if(this.type === 'packer'){
      this._updatePacker(dt);
    }

    // 蜜罐吸引
    if(this.luredBy && this.luredBy.alive && this.canBeLured && !this.flying){
      const lw = this.luredBy.worldPos();
      const w = this.worldPos();
      const dist = G.M.dist(w.x, w.z, lw.x, lw.z);
      if(dist < 1.5){
        // 到达蜜罐，开始攻击
        this.blockedBy = this.luredBy;
        if(!this.luredBy.blockedEnemies.includes(this)) this.luredBy.blockedEnemies.push(this);
        this.luredBy = null;
        return;
      } else if(dist < 8){
        // 被吸引，朝蜜罐移动
        const dx = lw.x - w.x, dz = lw.z - w.z;
        const speed = this.effectiveSpeed * dt;
        if(this.mesh){
          this.mesh.position.x += dx/dist * speed;
          this.mesh.position.z += dz/dist * speed;
          this.mesh.rotation.y = Math.atan2(dx, dz);
        }
        this._updateGridPos();
        return;
      }
    }

    // 洪泛团：冲击隔离节点
    if(this.type === 'flood'){
      this._updateFlood(dt);
    }

    // 移动
    this._move(dt);

    // 旧链路显形木马
    if(this.type === 'trojan' && !this.revealed && !this.flying){
      const gx = Math.round(this.gx), gz = Math.round(this.gz);
      if(this.game.grid.isOldLink(gx, gz)){
        this.revealed = true;
        this._reveal();
      }
    }
  }

  _move(dt){
    if(this.path.length === 0 || this.pathIndex >= this.path.length){
      // 到达出口
      if(this.alive && !this.leaking){
        this.leak();
      }
      return;
    }
    const speed = this.effectiveSpeed;
    if(speed <= 0) return;

    const target = this.path[this.pathIndex];
    const w = this.worldPos();
    const dx = target.x - w.x;
    const dz = target.z - w.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    const step = speed * dt;

    if(dist <= step + 0.05){
      // 到达路径点
      if(this.mesh){
        this.mesh.position.x = target.x;
        this.mesh.position.z = target.z;
        if(target.y !== undefined && this.flying) this.mesh.position.y = target.y;
      }
      this.pathIndex++;
      this.gx = target.gx;
      this.gz = target.gz;
      this.pathProgress = this.pathIndex;
      if(this.pathIndex >= this.path.length){
        this.leak();
      }
    } else {
      const nx = dx/dist, nz = dz/dist;
      if(this.mesh){
        this.mesh.position.x += nx * step;
        this.mesh.position.z += nz * step;
        if(!this.flying){
          this.mesh.rotation.y = G.M.angleLerp(this.mesh.rotation.y, Math.atan2(nx, nz), dt*10);
        } else {
          this.mesh.rotation.y = Math.atan2(nx, nz);
        }
      }
      this._updateGridPos();
    }
  }

  _updateGridPos(){
    if(!this.mesh) return;
    const g = this.game.grid.toGrid(this.mesh.position.x, this.mesh.position.z);
    this.gx = g.x;
    this.gz = g.z;
    // 木马被阻挡时显形
    if(this.type === 'trojan' && !this.revealed && this.blockedBy){
      this.revealed = true;
      this._reveal();
    }
  }

  _reveal(){
    if(this.mesh && this.mesh.userData.trueForm){
      this.mesh.userData.trueForm.visible = true;
      if(this.mesh.userData.shell) this.mesh.userData.shell.visible = false;
    }
    const w = this.worldPos();
    G.effects.burst(w, 0xaa66ff, 10, {speed:3, life:0.5});
    G.effects.floatText(w, '显形', 0xcc88ff);
  }

  leak(){
    if(!this.alive || this.leaking) return;
    this.leaking = true;
    this.alive = false;
    // 找最近出口
    let minDist = Infinity, bestExit = null;
    for(const ex of this.game.grid.exits){
      const ew = this.game.grid.toWorld(ex.x, ex.z);
      const w = this.worldPos();
      const d = G.M.dist(w.x, w.z, ew.x, ew.z);
      if(d < minDist){ minDist = d; bestExit = ex; }
    }
    if(bestExit){
      const ew = this.game.grid.toWorld(bestExit.x, bestExit.z);
      G.effects.burst(ew, 0xff4444, 15, {speed:5, life:0.7});
    }
    const dmg = this.isBoss ? 20 : (this.data.blockCost >= 3 ? 8 : 5);
    this.game.integrity -= dmg;
    this.game.stats.leaks++;
    this.game.stats.damageTaken += dmg;
    G.audio.sfx('leak');
    if(this.game.integrity <= 0){
      this.game.integrity = 0;
      this.game.gameOver(false);
    }
  }

  _attackTower(tower, dt){
    if(this.attackCooldown > 0) return;
    if(this.dmg <= 0) return;
    this.attackCooldown = 1 / this.attackRate;
    tower.takeDamage(this.dmg, this);
    const w = this.worldPos();
    const tw = tower.worldPos();
    G.effects.beam(
      new THREE.Vector3(w.x, this.meshY, w.z),
      new THREE.Vector3(tw.x, tower.tipY(), tw.z),
      0xff4444, {life:0.12, width:0.04}
    );
    G.audio.sfx('tower_hit');
    // 反弹（蜜罐分支）
    if(tower.type === 'honeypot' && tower.branch === 'reflect'){
      this.takeDamage(this.dmg * 0.3, tower);
    }
  }

  _tryRangedAttack(dt){
    const range = this.attackRange;
    const w = this.worldPos();
    let best = null, bestDist = Infinity;
    for(const t of this.game.towers){
      if(!t.alive) continue;
      const tw = t.worldPos();
      const d = G.M.dist(w.x, w.z, tw.x, tw.z);
      if(d > range) continue;
      // 优先攻击蜜罐
      const isHoney = t.type === 'honeypot';
      if(isHoney){ best = t; bestDist = -1; break; }
      if(d < bestDist){ bestDist = d; best = t; }
    }
    if(best){
      this.attackCooldown = 1 / this.attackRate;
      this._attackTower(best, dt);
      // 施加加密
      best.applyEncrypt(3);
    }
  }

  _updatePacker(dt){
    const w = this.worldPos();
    const range = this.data.shieldRange || 3.5;
    for(const e of this.game.enemies){
      if(e === this || !e.alive) continue;
      const ew = e.worldPos();
      if(G.M.dist2(w.x, w.z, ew.x, ew.z) <= range*range){
        if(e.shield < (this.data.shieldAmt || 80) * 0.5){
          e.applyShield(this.data.shieldAmt || 80);
        }
      }
    }
  }

  _updateFlood(dt){
    // 附近有隔离节点时，冲过去攻击
    if(this._floodTarget && this._floodTarget.alive) return;
    const w = this.worldPos();
    let best = null, bestDist = 12;
    for(const t of this.game.towers){
      if(!t.alive || !t.isNodeTower) continue;
      const tw = t.worldPos();
      const d = G.M.dist(w.x, w.z, tw.x, tw.z);
      if(d < bestDist){ bestDist = d; best = t; }
    }
    if(best){
      this._floodTarget = best;
      // 脱离路线冲过去
      this.blockedBy = null;
    }
  }

  // ---- Boss ----
  _updateBoss(dt){
    this.bossAbilityTimer -= dt;
    if(this.bossAbilityTimer > 0) return;

    const hpRatio = this.hp / this.maxHp;
    const w = this.worldPos();

    if(this.type === 'boss_kui'){
      if(hpRatio < 0.5 && this.bossPhase < 1){
        this.bossPhase = 1;
        // 释放蠕虫群
        for(let i=0;i<5;i++){
          const worm = this.game.spawnEnemy('worm', this.entryId);
          if(worm && worm.mesh){
            worm.mesh.position.x = w.x + (Math.random()-0.5)*3;
            worm.mesh.position.z = w.z + (Math.random()-0.5)*3;
            worm.repath();
          }
        }
        G.effects.burst(w, 0xff8844, 20, {speed:6, life:0.8});
        G.audio.sfx('warn');
        this.game.addToast('万傀释放虫群！', 'warn');
      } else {
        // 洪峰冲击
        this._floodSurge();
      }
      this.bossAbilityTimer = 8;
    }
    else if(this.type === 'boss_lou'){
      if(hpRatio < 0.5 && this.bossPhase < 1){
        this.bossPhase = 1;
        // 路由风暴
        for(const t of this.game.towers){
          if(!t.alive) continue;
          const tw = t.worldPos();
          if(G.M.dist2(w.x, w.z, tw.x, tw.z) <= 100){
            t.shield = Math.max(0, t.shield - 40);
            t.applyEncrypt(2);
          }
        }
        G.effects.ring(w, 10, 0x66ddff, {life:0.8, expand:true});
        G.audio.sfx('warn');
        this.game.addToast('蜃楼发动路由风暴！', 'warn');
      } else {
        // 伪路由黑洞
        this._routingBlackhole();
      }
      this.bossAbilityTimer = 9;
    }
    else if(this.type === 'boss_ying'){
      // 阶段切换
      if(hpRatio < 0.35 && this.bossPhase < 2){
        this.bossPhase = 2;
        this.speed *= 1.3;
        this._lockRoadSegment();
        this.game.addToast('蛰影进入破坏阶段！', 'warn');
        G.audio.sfx('boss');
      } else if(hpRatio < 0.65 && this.bossPhase < 1){
        this.bossPhase = 1;
        // 提权：强化护甲 + 放出木马
        this.shield += 300;
        this.shieldMax = Math.max(this.shieldMax, 300);
        for(let i=0;i<3;i++){
          const trojan = this.game.spawnEnemy('trojan', this.entryId);
          if(trojan && trojan.mesh){
            trojan.mesh.position.x = w.x + (Math.random()-0.5)*3;
            trojan.mesh.position.z = w.z + (Math.random()-0.5)*3;
            trojan.repath();
          }
        }
        G.effects.burst(w, 0x9944ff, 15, {speed:5, life:0.7});
        this.game.addToast('蛰影提权！护甲强化并释放木马', 'warn');
      } else if(this.bossPhase === 0){
        // 潜伏阶段：需要检测
        if(!this.revealed) this.revealed = false;
      }
      this.bossAbilityTimer = 7;
    }
  }

  _floodSurge(){
    const w = this.worldPos();
    G.effects.ring(w, 5, 0xff6622, {life:0.6, expand:true});
    for(const t of this.game.towers){
      if(!t.alive) continue;
      const tw = t.worldPos();
      const d = G.M.dist(w.x, w.z, tw.x, tw.z);
      if(d < 5){
        t.takeDamage(80, this);
      }
    }
    // 冲毁隔离器
    for(const item of this.game.activeItems){
      if(item.type === 'isolator'){
        const iw = this.game.grid.toWorld(item.gx, item.gz);
        if(G.M.dist(w.x, w.z, iw.x, iw.z) < 6){
          item.hp -= 150;
        }
      }
    }
    G.audio.sfx('explode');
  }

  _routingBlackhole(){
    // 在前方链路制造临时黑洞
    const w = this.worldPos();
    const ahead = this.path[Math.min(this.pathIndex + 3, this.path.length-1)];
    if(ahead){
      const g = this.game.grid.toGrid(ahead.x, ahead.z);
      this.game.addBlackhole(g.x, g.z, 6);
      G.effects.ring(ahead, 2.5, 0x66ddff, {life:1, expand:true});
      this.game.addToast('蜃楼制造路由黑洞！', 'warn');
    }
  }

  _lockRoadSegment(){
    // 锁死前方一段运维环
    const idx = this.pathIndex;
    for(let i=idx; i<Math.min(idx+4, this.path.length); i++){
      const p = this.path[i];
      const g = this.game.grid.toGrid(p.x, p.z);
      this.game.addBlackhole(g.x, g.z, 10);
    }
    G.audio.sfx('warn');
  }
}

G.Enemy = Enemy;

})();
