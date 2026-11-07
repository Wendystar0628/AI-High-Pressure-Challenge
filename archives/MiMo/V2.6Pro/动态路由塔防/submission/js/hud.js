/* hud.js — 游戏内 HUD */
(function(){
'use strict';
const G = window.G;

class HUD {
  constructor(){
    this.forecastTimer = 0;
  }

  update(game, dt){
    if(!game) return;

    // 资源
    const el = G.util.el;
    if(el('val-comp')) el('val-comp').textContent = Math.floor(game.comp);
    if(el('val-intel')) el('val-intel').textContent = Math.floor(game.intel);
    if(el('val-hp')) el('val-hp').textContent = Math.ceil(game.integrity);
    if(el('val-wave')) el('val-wave').textContent = (game.waveIndex+1) + ' / ' + game.waves.length;
    if(el('val-time')) el('val-time').textContent = G.util.fmtTime(game.time);

    // 中枢完整度颜色
    const hpEl = el('val-hp');
    if(hpEl){
      if(game.integrity > 60) hpEl.style.color = '#4dff9a';
      else if(game.integrity > 30) hpEl.style.color = '#ffe066';
      else hpEl.style.color = '#ff5566';
    }

    // 流量预报（每 0.5 秒刷新）
    this.forecastTimer -= dt;
    if(this.forecastTimer <= 0){
      this.forecastTimer = 0.5;
      this._updateForecast(game);
    }

    // 待部署栏可用状态
    this._updateDeployBar(game);

    // 道具栏
    this._updateItemBar(game);
  }

  _updateForecast(game){
    const list = G.util.el('forecast-list');
    if(!list) return;
    const fc = game.getForecast();
    let html = '';
    const entryNames = game.mapDef.entryNames || {};
    const entryColors = game.mapDef.entryColors || {};
    for(const entryId in fc){
      const data = fc[entryId];
      if(data.total === 0) continue;
      const name = entryNames[entryId] || entryId;
      const color = '#'+(entryColors[entryId]||0x44aaff).toString(16).padStart(6,'0');
      let types = '';
      for(const t in data.types){
        const d = G.ENEMY_DATA[t];
        if(!d) continue;
        types += `<span style="margin-right:6px">${d.name}×${data.types[t]}</span>`;
      }
      html += `<div class="fc-row">
        <div class="tag" style="background:${color}22;color:${color};border:1px solid ${color}44">${entryId}</div>
        <div class="info"><div class="nm">${name}</div><div class="sub">${types}</div></div>
        <div class="cnt">${data.total}</div>
      </div>`;
    }
    if(!html) html = '<div class="fc-row"><div class="info"><div class="sub">暂无来袭流量</div></div></div>';
    list.innerHTML = html;
  }

  _updateDeployBar(game){
    const cards = G.util.qsa('.tower-card');
    cards.forEach(card=>{
      const type = card.dataset.type;
      const d = G.TOWER_DATA[type];
      if(!d) return;
      const canAfford = game.comp >= d.cost;
      card.classList.toggle('disabled', !canAfford);
    });
  }

  _updateItemBar(game){
    const cards = G.util.qsa('.item-card');
    cards.forEach(card=>{
      const type = card.dataset.type;
      const d = G.ITEM_DATA[type];
      if(!d) return;
      const cd = game.itemMgr.cooldowns[type] || 0;
      const cdEl = card.querySelector('.cd');
      if(cdEl){
        if(cd > 0){
          cdEl.style.display = 'flex';
          cdEl.textContent = Math.ceil(cd) + 's';
        } else {
          cdEl.style.display = 'none';
        }
      }
      const canUse = game.itemMgr.canUse(type);
      card.classList.toggle('disabled', !canUse);
    });
  }

  buildDeployBar(){
    const container = G.util.el('deploy-cards');
    if(!container) return;
    let html = '';
    for(const type in G.TOWER_DATA){
      const d = G.TOWER_DATA[type];
      const color = '#'+d.color.toString(16).padStart(6,'0');
      html += `<div class="tower-card" data-type="${type}" draggable="true">
        <div class="top">
          <div class="ic" style="background:${color}22;color:${color};border:1px solid ${color}44">${d.icon}</div>
          <div><div class="nm">${d.name}</div><div class="role">${d.role}</div></div>
        </div>
        <div class="cost"><b>算力 ${d.cost}</b></div>
        <div class="desc">${d.desc.substring(0,40)}…</div>
      </div>`;
    }
    container.innerHTML = html;

    // 拖放事件
    container.querySelectorAll('.tower-card').forEach(card=>{
      card.addEventListener('dragstart', (e)=>{
        const type = card.dataset.type;
        e.dataTransfer.setData('text/plain', type);
        if(G.scene) G.scene.startDrag(type);
      });
      card.addEventListener('click', ()=>{
        const type = card.dataset.type;
        if(G.scene && G.scene.dragType !== type){
          G.scene.startDrag(type);
        }
      });
    });
  }

  buildItemBar(){
    const container = G.util.el('item-bar');
    if(!container) return;
    let html = '';
    for(const type in G.ITEM_DATA){
      const d = G.ITEM_DATA[type];
      const costLabel = d.costType === 'intel' ? '情报' : '算力';
      html += `<div class="item-card" data-type="${type}">
        <div class="top">
          <div class="ic">${d.icon}</div>
          <div><div class="nm">${d.name}</div><div class="cost">${costLabel} ${d.cost} · 冷却 ${d.cooldown}s</div></div>
        </div>
        <div class="cd" style="display:none"></div>
      </div>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.item-card').forEach(card=>{
      card.addEventListener('click', ()=>{
        const type = card.dataset.type;
        if(G.game && G.game.itemMgr.canUse(type)){
          G.game.itemMgr.startUse(type);
          if(G.scene) G.scene.startDrag('item:'+type);
          G.audio.sfx('click');
        } else {
          G.audio.sfx('error');
        }
      });
    });
  }
}

G.HUD = HUD;

})();
