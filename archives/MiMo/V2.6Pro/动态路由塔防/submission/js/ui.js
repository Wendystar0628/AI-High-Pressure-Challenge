/* ui.js — 菜单、面板、图鉴、结算 */
(function(){
'use strict';
const G = window.G;

class UI {
  constructor(){
    this.selectedEntity = null;
    this.currentScreen = 'loading';
    this.returnTo = null;
    this.hud = new G.HUD();
    this._setupMenus();
    this._setupGameControls();
  }

  showScreen(name){
    const screens = ['menu-main','menu-codex','menu-settings','menu-demos','menu-pause','menu-report'];
    screens.forEach(s=>G.util.show(s, s===name));
    G.util.show('topbar', name==='game');
    G.util.show('deploy-bar', name==='game');
    G.util.show('forecast', name==='game');
    G.util.show('item-bar', name==='game');
    this.currentScreen = name;
  }

  enterGame(){
    this.showScreen('game');
    G.util.show('pause-badge', false);
    this.selectedEntity = null;
    this._updateSelectPanel();
  }

  // ---- 主菜单 ----
  _setupMenus(){
    // 地图卡片
    this._buildMapGrid();

    G.util.on(G.util.el('btn-codex-main'), 'click', ()=>{
      this.returnTo = 'menu-main';
      this.showCodex();
      G.audio.sfx('ui_open');
    });
    G.util.on(G.util.el('btn-demos'), 'click', ()=>{
      this.showScreen('menu-demos');
      G.audio.sfx('ui_open');
    });
    G.util.on(G.util.el('btn-settings'), 'click', ()=>{
      this.returnTo = 'menu-main';
      this.showScreen('menu-settings');
      G.audio.sfx('ui_open');
    });
    G.util.on(G.util.el('btn-settings-back'), 'click', ()=>{
      this.showScreen(this.returnTo || 'menu-main');
      G.audio.sfx('ui_close');
    });
    G.util.on(G.util.el('btn-demos-back'), 'click', ()=>{
      this.showScreen('menu-main');
      G.audio.sfx('ui_close');
    });

    // 设置
    G.util.on(G.util.el('vol-master'), 'input', (e)=>{
      const v = e.target.value/100;
      G.audio.setVolume('master', v);
      G.util.el('vol-master-v').textContent = e.target.value;
    });
    G.util.on(G.util.el('vol-music'), 'input', (e)=>{
      const v = e.target.value/100;
      G.audio.setVolume('music', v);
      G.util.el('vol-music-v').textContent = e.target.value;
    });
    G.util.on(G.util.el('vol-sfx'), 'input', (e)=>{
      const v = e.target.value/100;
      G.audio.setVolume('sfx', v);
      G.util.el('vol-sfx-v').textContent = e.target.value;
    });
    G.util.on(G.util.el('btn-mute'), 'click', ()=>{
      const btn = G.util.el('btn-mute');
      const isMuted = btn.textContent === '开启';
      G.audio.setMute(!isMuted);
      btn.textContent = isMuted ? '关闭' : '开启';
      btn.classList.toggle('warn', !isMuted);
    });

    // 图鉴
    G.util.on(G.util.el('btn-codex-back'), 'click', ()=>{
      this.showScreen(this.returnTo || 'menu-main');
      G.audio.sfx('ui_close');
    });

    // 暂停菜单
    G.util.on(G.util.el('btn-resume'), 'click', ()=>{
      if(G.game) G.game.paused = false;
      this.showScreen('game');
      G.util.show('pause-badge', false);
      G.audio.sfx('ui_close');
    });
    G.util.on(G.util.el('btn-restart'), 'click', ()=>{
      this.showScreen('game');
      G.util.show('pause-badge', false);
      if(G.main) G.main.restartGame();
      G.audio.sfx('click');
    });
    G.util.on(G.util.el('btn-to-codex'), 'click', ()=>{
      this.returnTo = 'menu-pause';
      this.showCodex();
    });
    G.util.on(G.util.el('btn-to-settings'), 'click', ()=>{
      this.returnTo = 'menu-pause';
      this.showScreen('menu-settings');
    });
    G.util.on(G.util.el('btn-quit'), 'click', ()=>{
      if(G.game){ G.game.paused = true; G.game.gameEnded = true; }
      this.showScreen('menu-main');
      if(G.audio) G.audio.playMusic('menu');
      G.audio.sfx('ui_close');
    });

    // 结算
    G.util.on(G.util.el('btn-rep-restart'), 'click', ()=>{
      this.showScreen('game');
      if(G.main) G.main.restartGame();
    });
    G.util.on(G.util.el('btn-rep-codex'), 'click', ()=>{
      this.returnTo = 'menu-report';
      this.showCodex();
    });
    G.util.on(G.util.el('btn-rep-quit'), 'click', ()=>{
      this.showScreen('menu-main');
      if(G.audio) G.audio.playMusic('menu');
    });

    // 演示
    this._buildDemoList();
    G.util.on(G.util.el('btn-exit-demo'), 'click', ()=>{
      if(G.demo) G.demo.stop();
      this.showScreen('menu-main');
    });
  }

  _buildMapGrid(){
    const grid = G.util.el('map-grid');
    if(!grid) return;
    let html = '';
    const colors = ['corp','back','ics'];
    G.MAP_LIST.forEach((m, i)=>{
      const gradient = [
        'linear-gradient(135deg,#0a2a4a,#1a4a7a)',
        'linear-gradient(135deg,#0a1a3a,#1a3a6a)',
        'linear-gradient(135deg,#0a2a2a,#1a4a4a)'
      ][i] || 'linear-gradient(135deg,#0a2a4a,#1a4a7a)';
      html += `<div class="map-card" data-map="${m.id}">
        <div class="thumb" style="background:${gradient}">
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:42px;opacity:0.3;color:#7fd8ff">${['网','骨','工'][i]}</div>
        </div>
        <div class="info">
          <div class="nm">${m.name}</div>
          <div class="ds">${m.desc.substring(0,60)}…</div>
          <div class="meta"><span>${m.waves} 波</span><span>${m.subtitle}</span></div>
        </div>
      </div>`;
    });
    grid.innerHTML = html;
    grid.querySelectorAll('.map-card').forEach(card=>{
      card.addEventListener('click', ()=>{
        const mapId = card.dataset.map;
        if(G.main) G.main.startGame(mapId);
        G.audio.sfx('click');
      });
    });
  }

  _buildDemoList(){
    const list = G.util.el('demo-list');
    if(!list) return;
    const demos = [
      {id:'demo-1', name:'分段取舍', desc:'玩家把网闸拖到西边界节点，预览中 A 折向 DMZ 互联，确认后办公网段的敌人掉头。'},
      {id:'demo-2', name:'旁路直通', desc:'洪泛团冲垮节点上的网闸，C、B 的路线改回原来的数据中心，玩家同时在 A 的路线上投下协议降级。'},
      {id:'demo-3', name:'蛰影现身', desc:'蛰影锁死前方一段运维环，各入口的路线重新收敛，玩家选中修复进程释放冗余切换。'}
    ];
    let html = '';
    demos.forEach(d=>{
      html += `<div class="entry" data-demo="${d.id}">
        <div class="nm">${d.name}</div>
        <div class="ds">${d.desc}</div>
      </div>`;
    });
    list.innerHTML = html;
    list.querySelectorAll('.entry').forEach(el=>{
      el.addEventListener('click', ()=>{
        const demoId = el.dataset.demo;
        if(G.demo) G.demo.play(demoId);
        G.audio.sfx('click');
      });
    });
  }

  // ---- 游戏控制 ----
  _setupGameControls(){
    G.util.on(G.util.el('btn-pause'), 'click', ()=>this.togglePause());
    G.util.on(G.util.el('btn-sp05'), 'click', ()=>this.setSpeed(0.5));
    G.util.on(G.util.el('btn-sp1'), 'click', ()=>this.setSpeed(1));
    G.util.on(G.util.el('btn-sp2'), 'click', ()=>this.setSpeed(2));
    G.util.on(G.util.el('btn-sp3'), 'click', ()=>this.setSpeed(3));
    G.util.on(G.util.el('btn-next-wave'), 'click', ()=>{
      if(G.game && !G.game.waveActive && G.game.betweenWaveTimer > 0){
        G.game.betweenWaveTimer = 0.1;
        this.addToast('提前开始下一波', 'ok');
        G.audio.sfx('wave');
      }
    });
    G.util.on(G.util.el('btn-home'), 'click', ()=>{
      if(G.scene) G.scene.resetCamera();
      G.audio.sfx('click');
    });
    G.util.on(G.util.el('btn-codex'), 'click', ()=>{
      this.returnTo = 'game';
      if(G.game) G.game.paused = true;
      this.showCodex();
    });
    G.util.on(G.util.el('btn-menu'), 'click', ()=>{
      if(G.game) G.game.paused = true;
      this.showScreen('menu-pause');
      G.util.show('pause-badge', true);
    });
  }

  togglePause(){
    if(!G.game) return;
    if(G.game.gameEnded) return;
    G.game.paused = !G.game.paused;
    G.util.show('pause-badge', G.game.paused);
    if(G.game.paused){
      this.showScreen('menu-pause');
    } else {
      this.showScreen('game');
    }
    G.audio.sfx('click');
  }

  setSpeed(s){
    if(!G.game) return;
    G.game.speed = s;
    ['btn-sp05','btn-sp1','btn-sp2','btn-sp3'].forEach(id=>{
      const btn = G.util.el(id);
      if(btn) btn.classList.remove('on');
    });
    const map = {0.5:'btn-sp05', 1:'btn-sp1', 2:'btn-sp2', 3:'btn-sp3'};
    const btn = G.util.el(map[s]);
    if(btn) btn.classList.add('on');
    G.audio.sfx('click');
  }

  // ---- 选中面板 ----
  selectEntity(entity){
    this.selectedEntity = entity;
    this._updateSelectPanel();
    // 如果选中节点，显示路线预览
    if(entity && entity.kind === 'tile' && G.game){
      const g = G.game.grid;
      if(g.isNode(entity.gx, entity.gz)){
        const pv = G.game.router.previewIsolate(entity.gx, entity.gz);
        if(pv.ok && G.scene){
          G.scene.updateRoutePreview(pv.routes, 0xffaa33);
        } else if(G.scene){
          G.scene.clearRoutePreview();
        }
      } else if(G.scene){
        G.scene.clearRoutePreview();
      }
    } else if(G.scene){
      G.scene.clearRoutePreview();
    }
  }

  _updateSelectPanel(){
    const panel = G.util.el('select-panel');
    if(!panel) return;
    const sel = this.selectedEntity;
    if(!sel){
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    let html = '';

    if(sel.kind === 'tower'){
      const t = sel.data;
      const d = t.data;
      const color = '#'+d.color.toString(16).padStart(6,'0');
      html = `<div class="hd">
        <div class="nm" style="color:${color}">${t.name}</div>
        <div class="sub">${d.role} · 等级 ${t.level}</div>
      </div>
      <div class="body">
        <div class="hp-bar"><i style="width:${(t.hp/t.maxHp*100).toFixed(0)}%"></i></div>
        <div class="stat-row"><span class="k">生命</span><span class="v">${Math.ceil(t.hp)} / ${t.maxHp}</span></div>`;
      if(t.shield > 0) html += `<div class="stat-row"><span class="k">护盾</span><span class="v">${Math.ceil(t.shield)}</span></div>`;
      if(t.encrypted > 0) html += `<div class="status-tags"><span class="stag debuff">加密 ${t.encrypted.toFixed(1)}s</span></div>`;
      const ld = t.lvlData;
      if(ld.dmg) html += `<div class="stat-row"><span class="k">攻击</span><span class="v">${ld.dmg}</span></div>`;
      if(ld.range) html += `<div class="stat-row"><span class="k">射程</span><span class="v">${ld.range}</span></div>`;
      if(ld.block) html += `<div class="stat-row"><span class="k">阻挡</span><span class="v">${ld.block}</span></div>`;
      if(ld.healRate) html += `<div class="stat-row"><span class="k">治疗</span><span class="v">${ld.healRate}/s</span></div>`;

      html += `<div class="btn-row">`;
      if(t.level < 2){
        html += `<button class="btn primary" id="btn-upgrade" ${t.canUpgrade()?'':'disabled'}>升级 (${d.upCost}算力/${d.upIntel}情报)</button>`;
      }
      if(d.branches && t.level < 2){
        d.branches.forEach(b=>{
          html += `<button class="btn" id="btn-branch-${b.id}" title="${b.desc}">${b.name}</button>`;
        });
      }
      if((t.type==='honeypot' || t.type==='repair') && t.skillCooldown <= 0){
        html += `<button class="btn warn" id="btn-skill">${t.type==='honeypot'?'诱捕':'冗余切换'}</button>`;
      }
      html += `<button class="btn danger" id="btn-sell">撤下 (+${t.sellValue()})</button>`;
      html += `</div>`;
      if(t.level < 2 && d.branches){
        html += `<div style="margin-top:8px;font-size:11px;color:#7fa0c8">升级至 2 级时选择分支</div>`;
        d.branches.forEach(b=>{
          html += `<div style="font-size:11px;color:#7fa0c8;margin-top:4px"><b>${b.name}</b>: ${b.desc}</div>`;
        });
      }
      html += `</div>`;
    }
    else if(sel.kind === 'enemy'){
      const e = sel.data;
      const d = e.data;
      const color = '#'+d.color.toString(16).padStart(6,'0');
      html = `<div class="hd">
        <div class="nm" style="color:${color}">${d.name}</div>
        <div class="sub">${e.isBoss?'Boss':(e.flying?'飞行':'地面')} · ${e.camo&&!e.revealed?'伪装中':'已显形'}</div>
      </div>
      <div class="body">
        <div class="hp-bar"><i style="width:${(e.hp/e.maxHp*100).toFixed(0)}%"></i></div>
        <div class="stat-row"><span class="k">生命</span><span class="v">${Math.ceil(e.hp)} / ${e.maxHp}</span></div>`;
      if(e.shield > 0) html += `<div class="stat-row"><span class="k">护盾</span><span class="v">${Math.ceil(e.shield)}</span></div>`;
      html += `<div class="stat-row"><span class="k">速度</span><span class="v">${e.effectiveSpeed.toFixed(1)}</span></div>`;
      if(d.dmg) html += `<div class="stat-row"><span class="k">攻击</span><span class="v">${d.dmg}</span></div>`;
      html += `<div class="stat-row"><span class="k">阻挡占用</span><span class="v">${d.blockCost}</span></div>`;
      html += `<div class="stat-row"><span class="k">消灭奖励</span><span class="v">${d.bounty}算力 / ${d.intel}情报</span></div>`;
      html += `<div style="margin-top:10px;font-size:12px;color:#7fa0c8;line-height:1.6">${d.desc}</div>`;
      html += `</div>`;
    }
    else if(sel.kind === 'tile'){
      const g = G.game.grid;
      const t = g.get(sel.gx, sel.gz);
      const tileNames = ['虚空','链路','交换节点','设备平台','旧链路','入口','出口','障碍','装饰'];
      const isNode = t === G.TILE.NODE;
      const isolated = g.isBlocked(sel.gx, sel.gz);
      html = `<div class="hd">
        <div class="nm">${tileNames[t]||'未知'}</div>
        <div class="sub">坐标 (${sel.gx}, ${sel.gz})</div>
      </div>
      <div class="body">`;
      if(isNode){
        const nn = (g.namedNodes||[]).find(n=>n.x===sel.gx&&n.z===sel.gz);
        if(nn) html += `<div class="stat-row"><span class="k">名称</span><span class="v">${nn.name}</span></div>`;
        html += `<div class="stat-row"><span class="k">状态</span><span class="v" style="color:${isolated?'#ff5566':'#4dff9a'}">${isolated?'已隔离':'直通'}</span></div>`;
        html += `<div class="btn-row">`;
        if(!isolated){
          html += `<button class="btn warn" id="btn-isolate">隔离节点 (5情报)</button>`;
        } else {
          html += `<button class="btn primary" id="btn-release">解除隔离</button>`;
        }
        html += `</div>`;
        if(!isolated){
          html += `<div style="margin-top:8px;font-size:11px;color:#7fa0c8">隔离前可预览路线变化</div>`;
        }
      }
      if(t === G.TILE.OLDLINK){
        html += `<div style="font-size:12px;color:#7fa0c8">旧链路：经过的地面敌人减速，伪装的木马显形。</div>`;
      }
      if(t === G.TILE.PLATFORM){
        html += `<div style="font-size:12px;color:#7fa0c8">设备平台：可部署远程和修复支援塔。</div>`;
      }
      html += `</div>`;
    }

    panel.innerHTML = html;
    this._bindPanelEvents();
  }

  _bindPanelEvents(){
    const sel = this.selectedEntity;
    if(!sel) return;

    if(sel.kind === 'tower'){
      const t = sel.data;
      G.util.on(G.util.el('btn-upgrade'), 'click', ()=>{
        if(t.level < 2 && t.data.branches){
          // 需要选分支
          this.addToast('请选择升级分支', 'warn');
        } else {
          t.upgrade();
          if(G.scene) G.scene.rebuildTowerMesh(t);
          this._updateSelectPanel();
        }
      });
      if(t.data.branches){
        t.data.branches.forEach(b=>{
          G.util.on(G.util.el('btn-branch-'+b.id), 'click', ()=>{
            t.upgrade(b.id);
            if(G.scene) G.scene.rebuildTowerMesh(t);
            this._updateSelectPanel();
            this.addToast('升级至 '+b.name, 'ok');
          });
        });
      }
      G.util.on(G.util.el('btn-skill'), 'click', ()=>{
        t.useSkill();
        this._updateSelectPanel();
      });
      G.util.on(G.util.el('btn-sell'), 'click', ()=>{
        G.game.sellTower(t);
        if(G.scene && t.mesh) G.scene.entityGroup.remove(t.mesh);
        this.selectEntity(null);
      });
    }

    if(sel.kind === 'tile'){
      G.util.on(G.util.el('btn-isolate'), 'click', ()=>{
        const result = G.game.tryIsolateNode(sel.gx, sel.gz);
        if(result.ok){
          // 显示预览确认
          if(G.scene) G.scene.updateRoutePreview(result.routes, 0xffaa33);
          if(confirm('确认隔离该节点？隔离后路线将改变。')){
            G.game.confirmIsolateNode(sel.gx, sel.gz);
            if(G.scene){ G.scene.clearRoutePreview(); G.scene._updateRouteLines(); }
            this._updateSelectPanel();
          } else {
            if(G.scene) G.scene.clearRoutePreview();
          }
        } else {
          this.addToast(result.reason, 'err');
          G.audio.sfx('error');
        }
      });
      G.util.on(G.util.el('btn-release'), 'click', ()=>{
        if(confirm('确认解除隔离？')){
          G.game.confirmReleaseNode(sel.gx, sel.gz);
          if(G.scene) G.scene._updateRouteLines();
          this._updateSelectPanel();
        }
      });
    }
  }

  // ---- 图鉴 ----
  showCodex(){
    this.showScreen('menu-codex');
    this._buildCodexTabs('towers');
    G.audio.sfx('ui_open');
  }

  _buildCodexTabs(active){
    const tabs = G.util.el('codex-tabs');
    const list = G.util.el('codex-list');
    const detail = G.util.el('codex-detail');
    if(!tabs) return;

    const tabDefs = [
      {id:'towers', name:'设备手册'},
      {id:'enemies', name:'威胁档案'},
      {id:'items', name:'道具与状态'},
      {id:'terrain', name:'地形说明'}
    ];
    tabs.innerHTML = tabDefs.map(t=>
      `<button class="btn ${t.id===active?'on':''}" data-tab="${t.id}">${t.name}</button>`
    ).join('');
    tabs.querySelectorAll('.btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        this._buildCodexTabs(btn.dataset.tab);
      });
    });

    if(active === 'towers'){
      list.innerHTML = Object.keys(G.TOWER_DATA).map(k=>{
        const d = G.TOWER_DATA[k];
        return `<div class="it" data-key="${k}">${d.name}</div>`;
      }).join('');
      this._showCodexDetail('towers', Object.keys(G.TOWER_DATA)[0]);
    }
    else if(active === 'enemies'){
      list.innerHTML = Object.keys(G.ENEMY_DATA).map(k=>{
        const d = G.ENEMY_DATA[k];
        return `<div class="it" data-key="${k}">${d.name}</div>`;
      }).join('');
      this._showCodexDetail('enemies', Object.keys(G.ENEMY_DATA)[0]);
    }
    else if(active === 'items'){
      list.innerHTML = Object.keys(G.ITEM_DATA).map(k=>{
        const d = G.ITEM_DATA[k];
        return `<div class="it" data-key="${k}">${d.name}</div>`;
      }).join('') + `
        <div class="it" data-key="detect">检测</div>
        <div class="it" data-key="shield">护盾</div>
        <div class="it" data-key="encrypt">加密</div>
        <div class="it" data-key="slow">减速</div>`;
      this._showCodexDetail('items', Object.keys(G.ITEM_DATA)[0]);
    }
    else if(active === 'terrain'){
      list.innerHTML = `
        <div class="it" data-key="link">链路</div>
        <div class="it" data-key="node">交换节点</div>
        <div class="it" data-key="plat">设备平台</div>
        <div class="it" data-key="old">旧链路</div>
        <div class="it" data-key="obs">障碍</div>`;
      this._showCodexDetail('terrain', 'link');
    }

    list.querySelectorAll('.it').forEach(el=>{
      el.addEventListener('click', ()=>{
        list.querySelectorAll('.it').forEach(x=>x.classList.remove('on'));
        el.classList.add('on');
        this._showCodexDetail(active, el.dataset.key);
      });
    });
  }

  _showCodexDetail(category, key){
    const detail = G.util.el('codex-detail');
    if(!detail) return;
    let html = '';

    if(category === 'towers'){
      const d = G.TOWER_DATA[key];
      if(!d) return;
      html = `<h3>${d.name}</h3><div class="role">${d.role}</div><p>${d.desc}</p>`;
      html += `<div class="stats">
        <div><span>造价</span><b>${d.cost} 算力</b></div>
        <div><span>生命</span><b>${d.levels[0].hp}</b></div>
        ${d.levels[0].dmg?`<div><span>攻击</span><b>${d.levels[0].dmg}</b></div>`:''}
        ${d.levels[0].range?`<div><span>射程</span><b>${d.levels[0].range}</b></div>`:''}
        ${d.levels[0].block?`<div><span>阻挡</span><b>${d.levels[0].block}</b></div>`:''}
        ${d.levels[0].healRate?`<div><span>治疗</span><b>${d.levels[0].healRate}/s</b></div>`:''}
        <div><span>升级</span><b>${d.upCost}算力/${d.upIntel}情报</b></div>
      </div>`;
      if(d.branches){
        html += `<p style="margin-top:10px"><b>升级分支（2 级二选一）：</b></p>`;
        d.branches.forEach(b=>{
          html += `<p><b>${b.name}</b> — ${b.desc}</p>`;
        });
      }
    }
    else if(category === 'enemies'){
      const d = G.ENEMY_DATA[key];
      if(!d) return;
      html = `<h3>${d.name}</h3><div class="role">${d.flying?'飞行单位':'地面单位'}${d.camo?' · 可伪装':''}</div><p>${d.desc}</p>`;
      html += `<div class="stats">
        <div><span>生命</span><b>${d.hp}</b></div>
        <div><span>速度</span><b>${d.speed}</b></div>
        ${d.dmg?`<div><span>攻击</span><b>${d.dmg}</b></div>`:''}
        <div><span>阻挡占用</span><b>${d.blockCost}</b></div>
        <div><span>消灭奖励</span><b>${d.bounty}算力</b></div>
        <div><span>情报</span><b>${d.intel}</b></div>
      </div>`;
    }
    else if(category === 'items'){
      const statusDescs = {
        detect:'检测使伪装目标显形，使其可被远程单体攻击选中。',
        shield:'护盾吸收伤害，可被打破。冗余切换和加壳器可提供护盾。',
        encrypt:'加密使塔暂时停止攻击、治疗和释放技能，但不解除阻挡或节点隔离。备份还原和冗余切换可解除。',
        slow:'减速降低敌人的移动速度。旧链路和压制弹幕可造成减速。'
      };
      if(G.ITEM_DATA[key]){
        const d = G.ITEM_DATA[key];
        const costLabel = d.costType==='intel'?'情报':'算力';
        html = `<h3>${d.name}</h3><div class="role">道具</div><p>${d.desc}</p>
          <div class="stats">
            <div><span>消耗</span><b>${d.cost} ${costLabel}</b></div>
            <div><span>冷却</span><b>${d.cooldown}s</b></div>
          </div>`;
      } else {
        html = `<h3>${key === 'detect'?'检测':key === 'shield'?'护盾':key === 'encrypt'?'加密':'减速'}</h3>
          <div class="role">状态</div><p>${statusDescs[key]||''}</p>`;
      }
    }
    else if(category === 'terrain'){
      const descs = {
        link:'恶意程序与业务流量经过的道路。防火墙和蜜罐可以部署在入口、出口之外的链路上；它们阻挡敌人，但不截断这条道路。',
        node:'链路交汇处的网络设备。部署防火墙、网闸或插入应急隔离器，会隔离节点，使这一格不能通行；解除隔离后恢复直通。',
        plat:'部署远程和修复支援塔的位置，与链路有高低区别，敌人不能通行。',
        old:'保留旧协议的道路，经过的地面敌人减速，伪装的木马显形。敌人选择路线时也会考虑其较慢的通行速度。',
        obs:'数据设施、公网流和气隙等，不能通行，也不能部署。'
      };
      const names = {link:'链路', node:'交换节点', plat:'设备平台', old:'旧链路', obs:'障碍'};
      html = `<h3>${names[key]}</h3><div class="role">地形</div><p>${descs[key]}</p>`;
    }

    detail.innerHTML = html;
  }

  // ---- 结算 ----
  showReport(game, victory){
    const panel = G.util.el('menu-report');
    G.util.el('rep-title').textContent = victory ? '事件报告 · 防守成功' : '事件报告 · 中枢失守';
    G.util.el('rep-title').style.color = victory ? '#4dff9a' : '#ff5566';
    G.util.el('rep-sub').textContent = game.mapDef.name + ' · ' + game.mapDef.subtitle;

    const s = game.stats;
    G.util.el('rep-stats').innerHTML = `
      <div class="rs"><span>消灭威胁</span><span class="v">${s.kills}</span></div>
      <div class="rs"><span>突破次数</span><span class="v">${s.leaks}</span></div>
      <div class="rs"><span>承受伤害</span><span class="v">${s.damageTaken}</span></div>
      <div class="rs"><span>建造塔数</span><span class="v">${s.towersBuilt}</span></div>
      <div class="rs"><span>损失塔数</span><span class="v">${s.towersLost}</span></div>
      <div class="rs"><span>撤下塔数</span><span class="v">${s.towersSold}</span></div>
      <div class="rs"><span>获得算力</span><span class="v">${s.bountyEarned}</span></div>
      <div class="rs"><span>获得情报</span><span class="v">${s.intelEarned}</span></div>
      <div class="rs"><span>隔离次数</span><span class="v">${s.nodesIsolated}</span></div>
      <div class="rs"><span>道具使用</span><span class="v">${s.itemsUsed}</span></div>
      <div class="rs"><span>游戏时间</span><span class="v">${G.util.fmtTime(s.timePlayed)}</span></div>
      <div class="rs"><span>完成波次</span><span class="v">${s.wavesCompleted} / ${game.waves.length}</span></div>
    `;
    this.showScreen('menu-report');
  }

  // ---- Toast ----
  addToast(msg, type){
    const wrap = G.util.el('toast-wrap');
    if(!wrap) return;
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type||'');
    toast.textContent = msg;
    wrap.appendChild(toast);
    setTimeout(()=>{
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(()=>toast.remove(), 300);
    }, 2500);
    while(wrap.children.length > 5) wrap.removeChild(wrap.firstChild);
  }

  // ---- 字幕 ----
  showSubtitle(text, duration){
    const el = G.util.el('subtitle');
    if(!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this._subTimer);
    if(duration){
      this._subTimer = setTimeout(()=>el.classList.add('hidden'), duration*1000);
    }
  }
  hideSubtitle(){
    const el = G.util.el('subtitle');
    if(el) el.classList.add('hidden');
    clearTimeout(this._subTimer);
  }
}

G.UI = UI;

})();
