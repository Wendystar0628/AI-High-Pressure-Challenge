/* towers.js — 塔逻辑 */
(function(){
'use strict';
const G = window.G;
const T = G.TOWER_DATA;

class Tower {
  constructor(type, gx, gz, game){
    this.type = type;
    this.gx = gx; this.gz = gz;
    this.game = game;
    this.level = 1;
    this.branch = null;
    this.hp = T[type].levels[0].hp;
    this.maxHp = this.hp;
    this.cooldown = 0;
    this.skillCooldown = 0;
    this.encrypted = 0;       // 加密剩余时间
    this.shield = 0;          // 护盾值
    this.shieldMax = 0;
    this.angle = 0;           // 拦截器朝向
    this.target = null;
    this.id = game._nextId++;
    this.blockedEnemies = []; // 被阻挡的敌人
    this.animT = Math.random()*10;
    this.mesh = null;
    this.isNodeTower = game.grid.isNode(gx,gz);
    this.alive = true;
  }
  get data(){ return T[this.type]; }
  get lvlData(){ return this.data.levels[this.level-1]; }
  get name(){ return this.data.name + (this.level>=2 ? '·'+(this.branch?this.data.branches.find(b=>b.id===this.branch).name:'II') : ''); }
  get isEncrypted(){ return this.encrypted > 0; }
  get canAct(){ return !this.isEncrypted && this.alive; }

  worldPos(){
    const w = this.game.grid.toWorld(this.gx, this.gz);
    return w;
  }
  tipY(){ return (this.mesh && this.mesh.userData.tipY) || 1.0; }

  // 升级
  canUpgrade(){
    if(this.level >= 2) return false;
    return this.game.comp >= this.data.upCost && this.game.intel >= this.data.upIntel;
  }
  upgrade(branchId){
    if(!this.canUpgrade()) return false;
    this.game.comp -= this.data.upCost;
    this.game.intel -= this.data.upIntel;
    this.level = 2;
    if(this.data.branches && branchId) this.branch = branchId;
    const d = this.lvlData;
    this.maxHp = d.hp;
    this.hp = Math.min(this.hp + d.hp*0.5, this.maxHp);
    this.game.rebuildTowerMesh(this);
    G.audio.sfx('upgrade');
    return true;
  }

  // 撤下
  sellValue(){
    return Math.floor(this.data.cost * G.CFG.towerSellRatio);
  }

  // 受击
  takeDamage(amount, source){
    if(this.shield > 0){
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
    }
    if(amount <= 0) return;
    this.hp -= amount;
    if(this.hp <= 0){
      this.hp = 0;
      this.alive = false;
      this.game.onTowerDestroyed(this);
    }
  }

  // 施加加密
  applyEncrypt(duration){
    if(this.type === 'honeypot') return; // 蜜罐不会被加密
    this.encrypted = Math.max(this.encrypted, duration);
    if(this.mesh) G.effects.burst(this.worldPos(), 0xff4466, 6, {speed:2, life:0.4});
    G.audio.sfx('encrypt');
  }

  // 解除加密
  clearEncrypt(){ this.encrypted = 0; }

  // 加护盾
  addShield(amount){
    this.shieldMax = Math.max(this.shieldMax, amount);
    this.shield = Math.min(this.shield + amount, this.shieldMax);
  }

  // 治疗
  heal(amount){
    if(this.hp >= this.maxHp) return;
    this.hp = Math.min(this.hp + amount, this.maxHp);
    if(this.mesh) G.effects.burst(this.worldPos(), 0x44ff88, 3, {speed:1.5, life:0.3, size:0.05});
  }

  // ---- 每帧更新 ----
  update(dt){
    if(!this.alive) return;
    this.animT += dt;
    if(this.encrypted > 0) this.encrypted -= dt;
    if(this.cooldown > 0) this.cooldown -= dt;
    if(this.skillCooldown > 0) this.skillCooldown -= dt;

    if(this.canAct){
      switch(this.type){
        case 'firewall': this._updateFirewall(dt); break;
        case 'honeypot': this._updateHoneypot(dt); break;
        case 'interceptor': this._updateInterceptor(dt); break;
        case 'sandbox': this._updateSandbox(dt); break;
        case 'repair': this._updateRepair(dt); break;
      }
    }
  }

  _inRange(tx, tz, range){
    const w = this.worldPos();
    return G.M.dist2(w.x, w.z, tx, tz) <= range*range;
  }

  _findTarget(filter){
    const range = this.lvlData.range || 0;
    const w = this.worldPos();
    let best = null, bestDist = -Infinity;
    for(const e of this.game.enemies){
      if(!e.alive) continue;
      if(filter && !filter(e)) continue;
      const ew = e.worldPos();
      const d2 = G.M.dist2(w.x, w.z, ew.x, ew.z);
      if(d2 > range*range) continue;
      // 优先攻击沿路线离出口最近的
      const progress = e.pathProgress || 0;
      if(progress > bestDist){ bestDist = progress; best = e; }
    }
    return best;
  }

  _updateFirewall(dt){
    const d = this.lvlData;
    // 阻挡敌人
    this.blockedEnemies = this.blockedEnemies.filter(e=>e.alive && !e.leaking);
    // 在链路上：阻挡来犯敌人；在节点上：拦截相邻链路
    for(const e of this.game.enemies){
      if(!e.alive || e.flying) continue;
      const w = this.worldPos();
      const ew = e.worldPos();
      const dist = G.M.dist(w.x, w.z, ew.x, ew.z);
      const blockRange = this.isNodeTower ? 3.2 : 2.2;
      if(dist < blockRange && e.blockedBy === null && this.blockedEnemies.length < d.block){
        e.blockedBy = this;
        this.blockedEnemies.push(e);
      }
    }
    // 攻击
    if(this.cooldown <= 0){
      const target = this._findTarget(e=>{
        if(this.isNodeTower) return true;
        return this.blockedEnemies.includes(e) || this._inRange(e.worldPos().x, e.worldPos().z, d.range);
      });
      if(target){
        this.cooldown = 1 / d.attackRate;
        this._attack(target, d.dmg);
      }
    }
  }

  _updateHoneypot(dt){
    const d = this.lvlData;
    // 吸引会攻击塔的敌人
    const lureRange = d.lureRange || 5;
    for(const e of this.game.enemies){
      if(!e.alive || e.flying) continue;
      const w = this.worldPos();
      const ew = e.worldPos();
      const dist = G.M.dist(w.x, w.z, ew.x, ew.z);
      if(dist < lureRange && e.canBeLured && !e.luredBy){
        e.luredBy = this;
      }
    }
    // 阻挡
    this.blockedEnemies = this.blockedEnemies.filter(e=>e.alive);
    for(const e of this.game.enemies){
      if(!e.alive || e.flying) continue;
      const w = this.worldPos();
      const ew = e.worldPos();
      const dist = G.M.dist(w.x, w.z, ew.x, ew.z);
      if(dist < 1.5 && e.blockedBy === null && this.blockedEnemies.length < d.block){
        e.blockedBy = this;
        this.blockedEnemies.push(e);
      }
    }
    // 攻击
    if(this.cooldown <= 0){
      const target = this._findTarget(e=>this.blockedEnemies.includes(e) || this._inRange(e.worldPos().x, e.worldPos().z, d.range));
      if(target){
        this.cooldown = 1 / d.attackRate;
        this._attack(target, d.dmg);
      }
    }
  }

  _updateInterceptor(dt){
    const d = this.lvlData;
    // 旋转到目标
    const target = this._findTarget(e=>{
      if(this._inArc(e)) return true;
      return false;
    });
    if(target){
      const tw = target.worldPos();
      const w = this.worldPos();
      const desiredAngle = Math.atan2(tw.x - w.x, tw.z - w.z);
      this.angle = G.M.angleLerp(this.angle, desiredAngle, dt*8);
      this.target = target;
    }
    if(this.cooldown <= 0 && this.target && this.target.alive && this._inArc(this.target)){
      this.cooldown = 1 / d.attackRate;
      this._attack(this.target, d.dmg);
    }
    // 更新 mesh 朝向
    if(this.mesh && this.mesh.userData.turret){
      this.mesh.userData.turret.rotation.y = this.angle;
    }
  }

  _inArc(enemy){
    const d = this.lvlData;
    const w = this.worldPos();
    const ew = enemy.worldPos();
    const dist = G.M.dist(w.x, w.z, ew.x, ew.z);
    if(dist > d.range) return false;
    const arc = d.arc || Math.PI*0.75;
    const angleToEnemy = Math.atan2(ew.x - w.x, ew.z - w.z);
    let diff = angleToEnemy - this.angle;
    while(diff > Math.PI) diff -= Math.PI*2;
    while(diff < -Math.PI) diff += Math.PI*2;
    return Math.abs(diff) <= arc/2;
  }

  _updateSandbox(dt){
    const d = this.lvlData;
    // 检测
    const detectRange = d.detectRange || d.range;
    for(const e of this.game.enemies){
      if(!e.alive) continue;
      const w = this.worldPos();
      const ew = e.worldPos();
      if(G.M.dist2(w.x, w.z, ew.x, ew.z) <= detectRange*detectRange){
        if(e.camo && !e.revealed){
          e.revealed = true;
          G.effects.burst(ew, 0x44ffaa, 8, {speed:3, life:0.5});
        }
      }
    }
    // 范围攻击地面敌人
    if(this.cooldown <= 0){
      const w = this.worldPos();
      let hitAny = false;
      for(const e of this.game.enemies){
        if(!e.alive || e.flying) continue;
        const ew = e.worldPos();
        if(G.M.dist2(w.x, w.z, ew.x, ew.z) <= d.range*d.range){
          e.takeDamage(d.dmg, this);
          hitAny = true;
        }
      }
      if(hitAny){
        this.cooldown = 1 / d.attackRate;
        G.effects.ring(this.worldPos(), d.range, 0x44ffaa, {life:0.35, expand:true});
        G.audio.sfx('shoot');
      }
    }
  }

  _updateRepair(dt){
    const d = this.lvlData;
    // 治疗
    const w = this.worldPos();
    for(const t of this.game.towers){
      if(t === this || !t.alive) continue;
      const tw = t.worldPos();
      if(G.M.dist2(w.x, w.z, tw.x, tw.z) <= d.range*d.range){
        if(t.hp < t.maxHp){
          t.heal(d.healRate * dt);
          if(Math.random() < dt*2){
            G.effects.beam(
              new THREE.Vector3(w.x, this.tipY(), w.z),
              new THREE.Vector3(tw.x, t.tipY(), tw.z),
              0xffe066, {life:0.15, width:0.03}
            );
          }
        }
      }
    }
  }

  _attack(target, dmg){
    const w = this.worldPos();
    const from = new THREE.Vector3(w.x, this.tipY(), w.z);
    const tw = target.worldPos();
    const to = new THREE.Vector3(tw.x, (target.meshY||0.8), tw.z);

    let kind = 'bolt';
    let color = 0x66ccff;
    let size = 0.12;
    if(this.type === 'firewall'){
      kind='missile'; color=0xff8844; size=0.18;
      G.audio.sfx('shoot_heavy');
    }
    else if(this.type === 'interceptor'){
      kind = this.branch === 'pierce' ? 'laser' : 'bolt';
      color = 0x37d8ff;
      size = this.branch === 'pierce' ? 0.14 : 0.11;
      G.audio.sfx('shoot');
    }
    else if(this.type === 'honeypot'){
      color = 0xcc88ff; size = 0.13;
      G.audio.sfx('shoot');
    }
    else { G.audio.sfx('shoot'); }

    // 攻击闪光
    const flash = G.effects.statusHalo(color, 0.3, 0);
    flash.position.copy(from);
    this.game.meshGroup ? this.game.meshGroup.add(flash) : null;
    setTimeout(()=>{
      if(this.game.meshGroup) this.game.meshGroup.remove(flash);
    }, 100);

    G.effects.spawnProjectile(from, to, {
      color, kind, speed: this.type==='interceptor'?35:24,
      size,
      target: target,
      onHit: (pos, proj)=>{
        if(!target.alive) return;
        target.takeDamage(dmg, this);
        // 命中特效
        G.effects.ring(pos, 0.5, color, {life:0.25, expand:true});
        if(this.branch === 'pierce' && this.type === 'interceptor'){
          const behind = this._findPierceTargets(target);
          behind.forEach((e,i)=>{
            e.takeDamage(dmg * Math.pow(0.6, i+1), this);
            const ew = e.worldPos();
            G.effects.burst(ew, color, 5, {speed:3, life:0.3});
          });
        }
        if(this.branch === 'suppress' && this.type === 'interceptor'){
          target.applySlow(2.0, 0.4);
        }
      }
    });
  }

  _findPierceTargets(primary){
    const results = [];
    const w = primary.worldPos();
    const dx = Math.sin(this.angle), dz = Math.cos(this.angle);
    for(const e of this.game.enemies){
      if(!e.alive || e === primary) continue;
      const ew = e.worldPos();
      const ex = ew.x - w.x, ez = ew.z - w.z;
      // 在射线上
      const proj = ex*dx + ez*dz;
      if(proj < 0.5 || proj > 4) continue;
      const perp = Math.abs(ex*dz - ez*dx);
      if(perp < 0.8) results.push(e);
    }
    results.sort((a,b)=>{
      const aw = a.worldPos(), bw = b.worldPos();
      return G.M.dist2(w.x,w.z,aw.x,aw.z) - G.M.dist2(w.x,w.z,bw.x,bw.z);
    });
    return results;
  }

  // ---- 主动技能 ----
  useSkill(){
    if(!this.canAct || this.skillCooldown > 0) return false;
    if(this.type === 'honeypot'){
      // 诱捕
      this.skillCooldown = 12;
      const w = this.worldPos();
      const range = (this.lvlData.lureRange || 5) * (this.branch === 'deep' ? 1.25 : 1);
      for(const e of this.game.enemies){
        if(!e.alive || e.flying) continue;
        const ew = e.worldPos();
        if(G.M.dist2(w.x, w.z, ew.x, ew.z) <= range*range){
          e.applyTrap(this.branch === 'deep' ? 3.5 : 2.5);
          if(this.branch === 'deep') e.takeDamage(30, this);
        }
      }
      G.effects.ring(w, range, 0xcc88ff, {life:0.5, expand:true});
      G.audio.sfx('skill');
      return true;
    }
    if(this.type === 'repair'){
      // 冗余切换
      this.skillCooldown = 15;
      const w = this.worldPos();
      const range = this.lvlData.range;
      for(const t of this.game.towers){
        if(t === this || !t.alive) continue;
        const tw = t.worldPos();
        if(G.M.dist2(w.x, w.z, tw.x, tw.z) <= range*range){
          t.addShield(60);
          t.clearEncrypt();
          G.effects.burst(tw, 0x88ccff, 8, {speed:3, life:0.5});
        }
      }
      G.audio.sfx('shield');
      return true;
    }
    return false;
  }
}

G.Tower = Tower;

})();
