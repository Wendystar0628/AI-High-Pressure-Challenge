/* scene.js — Three.js 场景管理、相机、渲染 */
(function(){
'use strict';
const G = window.G;

class SceneManager {
  constructor(canvas){
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias:true, alpha:false,
      powerPreference:'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    // 渐变背景
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 2; bgCanvas.height = 256;
    const bgCtx = bgCanvas.getContext('2d');
    const grad = bgCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#0c1828');
    grad.addColorStop(0.5, '#080e1c');
    grad.addColorStop(1, '#040810');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, 2, 256);
    const bgTex = new THREE.CanvasTexture(bgCanvas);
    this.scene.background = bgTex;
    this.scene.fog = new THREE.FogExp2(0x080e1c, 0.011);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.cameraDist = 38;
    this.cameraTheta = Math.PI * 0.35;
    this.cameraPhi = Math.PI * 0.28;
    this._defaultCam = {dist:38, theta:Math.PI*0.35, phi:Math.PI*0.28, target:new THREE.Vector3(0,0,0)};

    // 光照
    this.ambient = new THREE.AmbientLight(0x445577, 0.85);
    this.scene.add(this.ambient);
    this.keyLight = new THREE.DirectionalLight(0xaaccff, 1.5);
    this.keyLight.position.set(15, 25, 10);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 5;
    this.keyLight.shadow.camera.far = 80;
    this.keyLight.shadow.camera.left = -30;
    this.keyLight.shadow.camera.right = 30;
    this.keyLight.shadow.camera.top = 30;
    this.keyLight.shadow.camera.bottom = -30;
    this.scene.add(this.keyLight);
    this.fillLight = new THREE.DirectionalLight(0x4466cc, 0.65);
    this.fillLight.position.set(-10, 15, -10);
    this.scene.add(this.fillLight);
    // 底部辉光
    this.underGlow = new THREE.PointLight(0x2244aa, 0.8, 60);
    this.underGlow.position.set(0, -5, 0);
    this.scene.add(this.underGlow);

    // 效果系统
    this.effects = new G.Effects(this.scene);
    G.effects = this.effects;

    // 环境
    this.environment = null;

    // 地形和实体组
    this.terrainGroup = new THREE.Group();
    this.entityGroup = new THREE.Group();
    this.routeGroup = new THREE.Group();
    this.ui3dGroup = new THREE.Group();
    this.scene.add(this.terrainGroup);
    this.scene.add(this.entityGroup);
    this.scene.add(this.routeGroup);
    this.scene.add(this.ui3dGroup);

    this.game = null;
    this.meshMap = new Map();
    this.routeLines = [];
    this.previewLines = [];
    this.nodeStatusRings = [];
    this.selectedEntity = null;
    this.hoveredTile = null;

    // 拖放
    this.dragType = null;
    this.dragPreview = null;
    this.dragAngle = 0;

    this._setupInput();
    this.resize();
    window.addEventListener('resize', ()=>this.resize());
  }

  resize(){
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- 相机 ----
  updateCamera(){
    const r = this.cameraDist;
    const x = this.cameraTarget.x + r * Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);
    const y = this.cameraTarget.y + r * Math.cos(this.cameraPhi);
    const z = this.cameraTarget.z + r * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);
  }

  resetCamera(){
    this.cameraDist = this._defaultCam.dist;
    this.cameraTheta = this._defaultCam.theta;
    this.cameraPhi = this._defaultCam.phi;
    this.cameraTarget.copy(this._defaultCam.target);
    this.updateCamera();
  }

  fitMap(grid){
    const s = G.CFG.tileSize;
    const w = grid.w * s, h = grid.h * s;
    this._defaultCam.dist = Math.max(w, h) * 1.05;
    this._defaultCam.target.set(0, 0, 0);
    this._defaultCam.theta = Math.PI * 0.35;
    this._defaultCam.phi = Math.PI * 0.28;
    this.resetCamera();
  }

  // ---- 输入 ----
  _setupInput(){
    const el = this.canvas;
    let mmbDown = false;
    let smmbDown = false;
    let lastX = 0, lastY = 0;

    el.addEventListener('mousedown', (e)=>{
      if(e.button === 1){ // 中键
        e.preventDefault();
        mmbDown = true;
        smmbDown = e.shiftKey;
        lastX = e.clientX; lastY = e.clientY;
      }
    });
    window.addEventListener('mousemove', (e)=>{
      if(mmbDown){
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        if(smmbDown){
          // 平移
          const right = new THREE.Vector3();
          const up = new THREE.Vector3(0,1,0);
          this.camera.getWorldDirection(right);
          right.cross(up).normalize();
          const speed = this.cameraDist * 0.0015;
          this.cameraTarget.addScaledVector(right, -dx * speed);
          this.cameraTarget.y += dy * speed;
        } else {
          // 环绕
          this.cameraTheta -= dx * 0.005;
          this.cameraPhi = G.M.clamp(this.cameraPhi - dy * 0.005, 0.15, Math.PI*0.48);
        }
        this.updateCamera();
      }
      // 拖放预览
      if(this.dragType){
        this._updateDragPreview(e);
      }
    });
    window.addEventListener('mouseup', (e)=>{
      if(e.button === 1) mmbDown = false;
    });
    el.addEventListener('wheel', (e)=>{
      e.preventDefault();
      this.cameraDist = G.M.clamp(this.cameraDist * (1 + e.deltaY * 0.001), 8, 120);
      this.updateCamera();
    }, {passive:false});

    // 左键点选
    el.addEventListener('click', (e)=>{
      if(this.dragType){
        this._confirmDrag(e);
        return;
      }
      this._handleClick(e);
    });
    el.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      if(this.dragType){
        this.cancelDrag();
      }
    });

    // 键盘
    window.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape'){
        if(this.dragType) this.cancelDrag();
        else if(G.ui) G.ui.togglePause();
      }
      if(e.key === ' '){
        e.preventDefault();
        if(G.ui) G.ui.togglePause();
      }
      if(e.key === 'Home' || e.key === 'r'){
        this.resetCamera();
      }
    });
  }

  // 射线拾取
  _raycast(e){
    const rect = this.canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    return raycaster;
  }

  _getTileFromEvent(e){
    const raycaster = this._raycast(e);
    // 射线与 y=0 平面求交
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, point);
    if(!point) return null;
    const g = this.game ? this.game.grid.toGrid(point.x, point.z) : null;
    return g ? {gx:g.x, gz:g.z, world:point} : null;
  }

  _handleClick(e){
    if(!this.game) return;
    const tile = this._getTileFromEvent(e);
    if(!tile) return;
    const {gx, gz} = tile;
    if(!this.game.grid.inBounds(gx, gz)){
      if(G.ui) G.ui.selectEntity(null);
      return;
    }
    // 优先选中塔
    const tower = this.game.getTowerAt(gx, gz);
    if(tower && G.ui){
      G.ui.selectEntity({kind:'tower', data:tower});
      G.audio.sfx('click');
      return;
    }
    // 敌人
    const enemy = this._findEnemyNear(tile.world);
    if(enemy && G.ui){
      G.ui.selectEntity({kind:'enemy', data:enemy});
      G.audio.sfx('click');
      return;
    }
    // 地块
    if(G.ui){
      G.ui.selectEntity({kind:'tile', gx, gz});
      G.audio.sfx('click');
    }
  }

  _findEnemyNear(worldPos){
    let best = null, bestDist = 1.5;
    for(const e of (this.game ? this.game.enemies : [])){
      if(!e.alive) continue;
      const ew = e.worldPos();
      const d = G.M.dist(worldPos.x, worldPos.z, ew.x, ew.z);
      if(d < bestDist){ bestDist = d; best = e; }
    }
    return best;
  }

  // ---- 拖放部署 ----
  startDrag(type){
    this.dragType = type;
    this.dragAngle = 0;
    if(this.dragPreview){
      this.ui3dGroup.remove(this.dragPreview);
      this.dragPreview = null;
    }
    // 创建范围预览
    const d = G.TOWER_DATA[type];
    const range = d.levels[0].range || 3;
    const geo = new THREE.RingGeometry(range*0.95, range, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x37d8ff, transparent:true, opacity:0.3,
      side: THREE.DoubleSide, depthWrite:false
    });
    this.dragPreview = new THREE.Mesh(geo, mat);
    this.dragPreview.rotation.x = -Math.PI/2;
    this.dragPreview.position.y = 0.3;
    this.ui3dGroup.add(this.dragPreview);
  }

  _updateDragPreview(e){
    if(!this.dragPreview || !this.game) return;
    const tile = this._getTileFromEvent(e);
    if(!tile) return;
    const w = this.game.grid.toWorld(tile.gx, tile.gz);
    this.dragPreview.position.set(w.x, 0.3, w.z);
    // 检查可部署
    const check = this.game.canDeploy(this.dragType, tile.gx, tile.gz);
    this.dragPreview.material.color.setHex(check.ok ? 0x37d8ff : 0xff4444);
    // 显示拖动提示
    const hint = G.util.el('drag-hint');
    if(hint){
      hint.style.left = (e.clientX + 15) + 'px';
      hint.style.top = (e.clientY - 10) + 'px';
      hint.textContent = check.ok ? '点击部署' : check.reason;
      hint.classList.remove('hidden');
    }
    this._dragTile = tile;
  }

  _confirmDrag(e){
    if(!this._dragTile || !this.game) return;
    const {gx, gz} = this._dragTile;
    const type = this.dragType;

    // 拦截器需要设朝向
    if(type === 'interceptor'){
      // 先放置，再让用户设朝向
      const tower = this.game.deployTower(type, gx, gz, this.dragAngle);
      if(tower){
        this.buildTowerMesh(tower);
      }
      this.cancelDrag();
      return;
    }

    const tower = this.game.deployTower(type, gx, gz);
    if(tower){
      this.buildTowerMesh(tower);
    }
    this.cancelDrag();
  }

  cancelDrag(){
    this.dragType = null;
    this._dragTile = null;
    if(this.dragPreview){
      this.ui3dGroup.remove(this.dragPreview);
      this.dragPreview = null;
    }
    const hint = G.util.el('drag-hint');
    if(hint) hint.classList.add('hidden');
  }

  // ---- 构建场景 ----
  buildScene(game){
    this.game = game;
    game.meshGroup = this.entityGroup;

    // 清理
    while(this.terrainGroup.children.length) this.terrainGroup.remove(this.terrainGroup.children[0]);
    while(this.entityGroup.children.length) this.entityGroup.remove(this.entityGroup.children[0]);
    while(this.routeGroup.children.length) this.routeGroup.remove(this.routeGroup.children[0]);
    while(this.ui3dGroup.children.length) this.ui3dGroup.remove(this.ui3dGroup.children[0]);
    this.effects.clear();
    this.nodeStatusRings = [];

    // 环境
    if(this.environment) this.scene.remove(this.environment.group);
    this.environment = new G.Environment(this.scene, game.mapDef.theme);

    // 地形
    const grid = game.grid;
    const theme = game.mapDef.theme;
    grid.forEach((x, z, t)=>{
      if(t === G.TILE.VOID) return;
      let typeStr = 'link';
      if(t === G.TILE.NODE) typeStr = 'node';
      else if(t === G.TILE.PLATFORM) typeStr = 'plat';
      else if(t === G.TILE.OLDLINK) typeStr = 'old';
      else if(t === G.TILE.ENTRY) typeStr = 'entry';
      else if(t === G.TILE.EXIT) typeStr = 'exit';
      else if(t === G.TILE.OBSTACLE) typeStr = 'obs';
      else if(t === G.TILE.DECOR) typeStr = 'decor';

      const tileMesh = G.buildTileVisual(typeStr, theme);
      const w = grid.toWorld(x, z);
      tileMesh.position.set(w.x, 0, w.z);
      tileMesh.receiveShadow = true;
      tileMesh.traverse(c=>{ if(c.isMesh){ c.receiveShadow = true; } });
      this.terrainGroup.add(tileMesh);

      // 节点状态环
      if(t === G.TILE.NODE){
        const ring = G.effects.statusHalo(0x33ccff, 0.9, 0.35);
        ring.position.set(w.x, 0, w.z);
        this.terrainGroup.add(ring);
        this.nodeStatusRings.push({ring, gx:x, gz:z});
      }
    });

    // 入口/出口标记
    for(const e of grid.entries){
      const marker = G.buildEntryMarker(e.id, theme);
      const w = grid.toWorld(e.x, e.z);
      marker.position.set(w.x, 0, w.z);
      this.terrainGroup.add(marker);
    }
    for(const ex of grid.exits){
      const marker = G.buildExitMarker(ex.id);
      const w = grid.toWorld(ex.x, ex.z);
      marker.position.set(w.x, 0, w.z);
      this.terrainGroup.add(marker);
    }

    // 拟合地图
    this.fitMap(grid);
    this.updateCamera();
    this._updateRouteLines();
  }

  buildTowerMesh(tower){
    if(tower.mesh) this.entityGroup.remove(tower.mesh);
    tower.mesh = G.buildTowerModel(tower.type, tower.level, tower.branch, tower.angle);
    const w = this.game.grid.toWorld(tower.gx, tower.gz);
    tower.mesh.position.set(w.x, this.game.grid.height(tower.gx, tower.gz), w.z);
    tower.mesh.traverse(c=>{ if(c.isMesh){ c.castShadow = true; } });
    this.entityGroup.add(tower.mesh);
  }

  rebuildTowerMesh(tower){
    this.buildTowerMesh(tower);
  }

  // ---- 路线标记 ----
  _updateRouteLines(){
    while(this.routeGroup.children.length) this.routeGroup.remove(this.routeGroup.children[0]);
    this.routeLines = [];
    if(!this.game) return;
    const colors = this.game.mapDef.entryColors || {};
    for(const entryId in this.game.router.routes){
      const route = this.game.router.routes[entryId];
      if(!route) continue;
      const color = colors[entryId] || 0x44aaff;
      const points = route.map(p=>{
        const w = this.game.grid.toWorld(p.x, p.z);
        return new THREE.Vector3(w.x, 0.25, w.z);
      });
      if(points.length < 2) continue;
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color, transparent:true, opacity:0.65,
        linewidth: 3
      });
      const line = new THREE.Line(geo, mat);
      this.routeGroup.add(line);
      this.routeLines.push({line, entryId});

      // 路线上的方向箭头
      for(let i=1; i<points.length-1; i+=3){
        const dir = new THREE.Vector3().subVectors(points[i+1], points[i]).normalize();
        const arrow = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.35, 4),
          new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.5})
        );
        arrow.position.copy(points[i]);
        arrow.position.y += 0.05;
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
        this.routeGroup.add(arrow);
      }
    }
  }

  updateRoutePreview(routes, color){
    // 清除旧预览
    for(const p of this.previewLines){
      this.routeGroup.remove(p);
    }
    this.previewLines = [];
    if(!routes) return;
    for(const entryId in routes){
      const route = routes[entryId];
      if(!route) continue;
      const points = route.map(p=>{
        const w = this.game.grid.toWorld(p.x, p.z);
        return new THREE.Vector3(w.x, 0.35, w.z);
      });
      if(points.length < 2) continue;
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineDashedMaterial({
        color: color||0xffaa33, transparent:true, opacity:0.7,
        dashSize: 0.5, gapSize: 0.3
      });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      this.routeGroup.add(line);
      this.previewLines.push(line);
    }
  }

  clearRoutePreview(){
    for(const p of this.previewLines){
      this.routeGroup.remove(p);
    }
    this.previewLines = [];
  }

  // ---- 每帧渲染 ----
  render(dt){
    if(this.game && !this.game.paused && !this.game.gameEnded){
      // 更新塔动画
      for(const t of this.game.towers){
        if(!t.mesh || !t.alive) continue;
        const u = t.mesh.userData;
        if(u.ring) u.ring.rotation.z += dt * 1.5;
        if(u.ring2) u.ring2.rotation.z -= dt * 1.0;
        if(u.scanRing) u.scanRing.rotation.z += dt * 2;
        if(u.scanRing2) u.scanRing2.rotation.z -= dt * 1.5;
        if(u.core) u.core.position.y = 0.5 + Math.sin(t.animT*2)*0.08;
        if(u.shieldRing) u.shieldRing.rotation.z += dt * 2;
        if(u.reflectOrb) u.reflectOrb.position.y = 1.2 + Math.sin(t.animT*3)*0.1;
        // 加密效果
        if(t.encrypted > 0 && t.mesh){
          t.mesh.rotation.y += dt * 2;
        }
      }

      // 更新敌人动画
      for(const e of this.game.enemies){
        if(!e.mesh || !e.alive) continue;
        const u = e.mesh.userData;
        // 蠕虫蠕动
        if(u.segs){
          u.segs.forEach((s,i)=>{
            s.position.y = 0.22 + Math.sin(e.animT*4 + i*0.8)*0.08;
            s.position.x = Math.sin(e.animT*3 + i*1.2)*0.08;
          });
        }
        // 洪泛团脉动
        if(u.core && e.type==='flood'){
          const s = 1 + Math.sin(e.animT*3)*0.12;
          u.core.scale.set(1.25*s, 0.9*s, 1.1*s);
        }
        // 伪热点环旋转
        if(u.rings){
          u.rings.forEach((r,i)=>{ r.rotation.z += dt*(2+i*0.8); });
        }
        // 加壳器护盾
        if(u.shieldDome){
          u.shieldDome.visible = e.shield > 0;
          u.shieldDome.rotation.y += dt*0.8;
        }
        // 木马闪烁
        if(e.type === 'trojan' && !e.revealed && e.mesh.userData.shell){
          e.mesh.userData.shell.position.y = 0.32 + Math.sin(e.animT*2)*0.03;
        }
        // 勒索者光环
        if(e.type === 'ransom' && u.orb){
          u.orb.position.y = 0.92 + Math.sin(e.animT*3)*0.08;
          u.orb.scale.setScalar(1 + Math.sin(e.animT*4)*0.15);
        }
        // Boss 动画
        if(e.isBoss){
          e.mesh.position.y = (e.meshY||0) + Math.sin(e.animT*1.5)*0.15;
          if(u.swarm){
            u.swarm.forEach(s=>{
              if(s.userData.orbit){
                const o = s.userData.orbit;
                o.a += dt * (o.sp||0.5) * 0.6;
                s.position.x = Math.cos(o.a)*o.r;
                s.position.z = Math.sin(o.a)*o.r*0.8;
                s.position.y = o.y + Math.sin(e.animT*2+o.a)*0.4;
              }
            });
          }
          if(u.rings && e.type==='boss_lou'){
            u.rings.forEach(r=>{ r.rotation.z += dt*(r.userData.spin||0.5); });
            if(u.echoes) u.echoes.forEach(echo=>{
              echo.position.x = Math.cos(e.animT*0.5 + (echo.userData.echo||0)*Math.PI)*1.3;
              echo.position.z = Math.sin(e.animT*0.5 + (echo.userData.echo||0)*Math.PI)*1.3;
            });
          }
          if(e.type === 'boss_ying' && u.core){
            u.core.scale.setScalar(1 + Math.sin(e.animT*3)*0.25);
          }
        }

        // 血条
        this._updateEnemyHealthBar(e);

        // 状态光环
        if(e.trapTimer > 0 && !e._trapHalo){
          e._trapHalo = G.effects.statusHalo(0xcc88ff, e.radius+0.3, 0.1);
          e.mesh.add(e._trapHalo);
        }
        if(e.trapTimer <= 0 && e._trapHalo){
          e.mesh.remove(e._trapHalo);
          e._trapHalo = null;
        }
        if(e.shield > 0 && !e._shieldHalo){
          e._shieldHalo = G.effects.statusHalo(0x4488ff, e.radius+0.25, 0.08);
          e.mesh.add(e._shieldHalo);
        }
        if(e.shield <= 0 && e._shieldHalo){
          e.mesh.remove(e._shieldHalo);
          e._shieldHalo = null;
        }
      }

      // 节点状态环颜色
      for(const ns of this.nodeStatusRings){
        const isolated = this.game.grid.isBlocked(ns.gx, ns.gz);
        if(ns.ring.material){
          ns.ring.material.color.setHex(isolated ? 0xff4444 : 0x33ccff);
          ns.ring.material.opacity = isolated ? 0.7 : 0.45;
        }
      }

      // 更新路线
      if(this._routeVersion !== this.game.router.routeVersion){
        this._routeVersion = this.game.router.routeVersion;
        this._updateRouteLines();
      }

      // 特效
      this.effects.update(dt, this.camera);
    } else {
      this.effects.update(dt, this.camera);
    }

    // 环境
    if(this.environment) this.environment.update(dt, this.camera);

    // 选中高亮
    this._updateSelectionHighlight();

    this.renderer.render(this.scene, this.camera);
  }

  _updateEnemyHealthBar(e){
    if(!e.mesh) return;
    if(!e._hpBar){
      const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.1),
        new THREE.MeshBasicMaterial({color:0x111111, transparent:true, opacity:0.8, depthTest:false}));
      const barFg = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.06),
        new THREE.MeshBasicMaterial({color:0x44ff66, transparent:true, opacity:0.95, depthTest:false}));
      barBg.position.y = e.isBoss ? 3.5 : 1.8;
      barFg.position.y = barBg.position.y;
      barFg.position.z = 0.01;
      e.mesh.add(barBg);
      e.mesh.add(barFg);
      e._hpBar = {bg:barBg, fg:barFg};
    }
    const ratio = e.hp / e.maxHp;
    e._hpBar.fg.scale.x = Math.max(0.01, ratio);
    e._hpBar.fg.position.x = -(1-ratio)*0.47;
    // 面向相机
    e._hpBar.bg.lookAt(this.camera.position);
    e._hpBar.fg.lookAt(this.camera.position);
    // 显示状态
    if(e.shield > 0) e._hpBar.fg.material.color.setHex(0x4488ff);
    else if(ratio > 0.5) e._hpBar.fg.material.color.setHex(0x44ff66);
    else if(ratio > 0.25) e._hpBar.fg.material.color.setHex(0xffaa44);
    else e._hpBar.fg.material.color.setHex(0xff4444);
  }

  _updateSelectionHighlight(){
    if(!this.game) return;
    for(const t of this.game.towers){
      if(!t.mesh) continue;
      const isSelected = G.ui && G.ui.selectedEntity &&
        G.ui.selectedEntity.kind === 'tower' && G.ui.selectedEntity.data === t;
      // 范围指示环
      if(isSelected && !t._rangeRing){
        const range = t.lvlData.range || 3;
        const geo = new THREE.RingGeometry(range*0.96, range, 36);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x37d8ff, transparent:true, opacity:0.25,
          side: THREE.DoubleSide, depthWrite:false
        });
        t._rangeRing = new THREE.Mesh(geo, mat);
        t._rangeRing.rotation.x = -Math.PI/2;
        const w = t.worldPos();
        t._rangeRing.position.set(w.x, 0.2, w.z);
        this.ui3dGroup.add(t._rangeRing);
      }
      if(!isSelected && t._rangeRing){
        this.ui3dGroup.remove(t._rangeRing);
        t._rangeRing = null;
      }
    }
    // 选中塔的发光
    for(const t of this.game.towers){
      if(!t.mesh) continue;
      const isSelected = G.ui && G.ui.selectedEntity &&
        G.ui.selectedEntity.kind === 'tower' && G.ui.selectedEntity.data === t;
      t.mesh.traverse(c=>{
        if(c.isMesh && c.material && c.material.emissiveIntensity !== undefined){
          const base = 0.3;
          c.material.emissiveIntensity = isSelected ? Math.max(base, 0.8) : base;
        }
      });
    }
  }
}

G.SceneManager = SceneManager;

})();
