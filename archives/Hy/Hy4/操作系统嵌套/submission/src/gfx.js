'use strict';
// 显示设备：接收程序提交的可复制场景资源与逐时刻场景状态，按提交绘制，不推进状态。
// 所有三维视图共用一个 WebGL 上下文，逐视图渲染后拷贝到各自的 2D 画布，避免上下文数量上限。
const U = require('./util');
const SCENE = require('./scene');
let THREE = null;
try { THREE = require('three'); } catch (e) { console.warn('three.js 不可用', e.message); }

class GFX {
  constructor(engine) {
    this.engine = engine;
    this.views = {}; this.data = {}; this.scenes = {}; this.renderer = null; this.canvas = null;
    this.lastRender = 0; this.ctxLost = false;
    this.initRenderer();
    // rAF 与定时器双驱动：窗口被完全盖住时 rAF 可能停止，setInterval 仍持续绘制。
    this.loop = () => { this.renderAll(); requestAnimationFrame(this.loop); };
    requestAnimationFrame(this.loop);
    if (this._renderTimer) clearInterval(this._renderTimer);
    this._renderTimer = setInterval(() => this.renderAll(), 40);
  }
  initRenderer() {
    if (!THREE) return;
    try {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1024; this.canvas.height = 768;
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;
      this.canvas.addEventListener('webglcontextlost', () => { this.ctxLost = true; });
      this.canvas.addEventListener('webglcontextrestored', () => { this.ctxLost = false; this.scenes = {}; });
    } catch (e) { console.warn('WebGL 初始化失败', e.message); this.renderer = null; }
  }
  clear() { this.views = {}; this.data = {}; this.scenes = {}; }
  dataKey(sysId, winId) { return sysId + ':' + winId; }
  submit(sysId, winId, data) {
    const key = this.dataKey(sysId, winId);
    if (data && data.type === 'sceneResource') {
      this.loadScene(sysId, winId, data.scene);
      return;
    }
    this.data[key] = data;
  }
  link(targetSysId, winId, srcSysId, srcWinId) {
    // 投送视图注册时使用源 dataKey，由 UI 调用 registerView 时传入。
  }
  loadScene(sysId, winId, scene) {
    if (!THREE || !scene) return;
    const key = this.dataKey(sysId, winId);
    if (this.scenes[key] && this.scenes[key].hash === U.jsonSize(scene)) return;
    try { this.scenes[key] = this.buildScene(scene); }
    catch (e) { console.warn('场景构建失败', e); }
  }
  registerView(key, canvas, dataKey, opts) {
    opts = opts || {};
    const v = { key, canvas, ctx: canvas.getContext('2d'), dataKey: dataKey || key,
      kind: opts.kind || 'scene', w: canvas.width, h: canvas.height, systemId: opts.systemId, winId: opts.winId };
    this.views[key] = v;
    return v;
  }
  unregister(key) { delete this.views[key]; }
  resizeView(key, w, h) {
    const v = this.views[key]; if (!v) return;
    const nw = Math.max(2, Math.floor(w)), nh = Math.max(2, Math.floor(h));
    if (v.canvas.width === nw && v.canvas.height === nh) { v.w = nw; v.h = nh; return; }
    v.canvas.width = nw; v.canvas.height = nh;
    v.w = nw; v.h = nh;
  }

  buildScene(scene) {
    const env = scene.environment || {};
    const g = new THREE.Group();
    const root = new THREE.Scene();
    root.add(g);
    const sky = new THREE.Color(env.sky || '#8fb7dd');
    root.background = sky;
    root.fog = new THREE.Fog(env.fog || '#a9c3d8', 45, 150);
    const mats = {};
    for (const k in (scene.materials || {})) {
      const m = scene.materials[k];
      mats[k] = new THREE.MeshStandardMaterial({ color: new THREE.Color(m.color || '#cccccc'),
        roughness: m.roughness === undefined ? 0.6 : m.roughness, metalness: m.metalness || 0,
        transparent: !!m.transparent, opacity: m.opacity === undefined ? 1 : m.opacity,
        side: m.transparent ? THREE.DoubleSide : THREE.FrontSide });
    }
    const mat = k => mats[k] || mats.purple || new THREE.MeshStandardMaterial({ color: '#888' });
    // 灯光
    for (const l of (scene.lights || [])) {
      if (l.type === 'directional') {
        const L = new THREE.DirectionalLight(new THREE.Color(l.color), l.intensity || 2);
        L.position.set(l.dir[0] * 40, l.dir[1] * 40, l.dir[2] * 40);
        L.castShadow = true; L.shadow.mapSize.set(1024, 1024);
        L.shadow.camera.left = -40; L.shadow.camera.right = 40; L.shadow.camera.top = 40; L.shadow.camera.bottom = -40;
        L.shadow.camera.near = 1; L.shadow.camera.far = 160; L.shadow.bias = -0.0007;
        root.add(L);
      } else if (l.type === 'hemisphere') root.add(new THREE.HemisphereLight(new THREE.Color(l.color), new THREE.Color(l.ground), l.intensity || 0.8));
      else if (l.type === 'ambient') root.add(new THREE.AmbientLight(new THREE.Color(l.color), l.intensity || 0.3));
    }
    const fireLight = new THREE.PointLight('#ff7a2a', 0, 28); root.add(fireLight);
    // 地形
    const t = env.terrain || { size: 120, segments: 48, height: 1.5, seed: 7, color: '#6f8f52' };
    const geo = new THREE.PlaneGeometry(t.size, t.size, t.segments, t.segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, SCENE.terrainHeight(scene, x, z) - 0.05);
    }
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(t.color || '#6f8f52'), roughness: 0.96, vertexColors: false }));
    ground.receiveShadow = true; g.add(ground);
    // 停机坪
    for (const hp of (env.helipads || [])) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(typeof hp === 'object' ? hp.radius || 5 : 5, typeof hp === 'object' ? hp.radius || 5 : 5, 0.12, 40),
        new THREE.MeshStandardMaterial({ color: '#555f6b', roughness: 0.9 }));
      pad.position.set(hp[0], SCENE.terrainHeight(scene, hp[0], hp[1]) + 0.02, hp[1]);
      pad.receiveShadow = true; g.add(pad);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.12, 8, 48),
        new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.6 }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(hp[0], SCENE.terrainHeight(scene, hp[0], hp[1]) + 0.1, hp[1]); g.add(ring);
      const h = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.42), new THREE.MeshStandardMaterial({ color: '#f4f4f4' }));
      h.position.set(hp[0], SCENE.terrainHeight(scene, hp[0], hp[1]) + 0.1, hp[1]); g.add(h);
      const h2 = h.clone(); h2.rotation.y = Math.PI / 2; g.add(h2);
    }
    // 环境物件
    for (const o of (env.objects || [])) {
      const y = SCENE.terrainHeight(scene, o.pos[0], o.pos[2]);
      if (o.type === 'helipad') continue;
      let mesh = null;
      if (o.type === 'building' || o.type === 'obstacle') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(o.size[0], o.size[1], o.size[2]),
          new THREE.MeshStandardMaterial({ color: new THREE.Color(o.color || '#9aa'), roughness: 0.8 }));
        mesh.position.set(o.pos[0], y + o.size[1] / 2, o.pos[2]);
        mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
      } else if (o.type === 'tree') {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, o.size[1] * 0.55, 8), new THREE.MeshStandardMaterial({ color: '#6a4b2f', roughness: 1 }));
        trunk.position.set(o.pos[0], y + o.size[1] * 0.27, o.pos[2]); trunk.castShadow = true; g.add(trunk);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(o.size[0] * 1.5, o.size[1] * 0.85, 10), new THREE.MeshStandardMaterial({ color: '#3f7b3c', roughness: 0.95 }));
        crown.position.set(o.pos[0], y + o.size[1] * 0.75, o.pos[2]); crown.castShadow = true; g.add(crown);
      } else if (o.type === 'grass') {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(o.size[0] * 0.4, o.size[1], 4), new THREE.MeshStandardMaterial({ color: '#7fa84c', roughness: 1 }));
        blade.position.set(o.pos[0], y + o.size[1] / 2, o.pos[2]); g.add(blade);
      }
    }
    // 直升机
    const heli = new THREE.Group(); g.add(heli);
    const rotorGroup = new THREE.Group(); rotorGroup.position.set(0, 2.8, 0); heli.add(rotorGroup);
    const tailGroup = new THREE.Group(); tailGroup.position.set(-5.5, 2.0, 0.3); heli.add(tailGroup);
    const parts = {};
    for (const part of (scene.model.parts || [])) {
      let mesh;
      const pm = (part.geo === 'decal24') ? this.decalMaterial() : mat(part.mat).clone();
      if (part.geo === 'sphere') mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), pm);
      else if (part.geo === 'box') mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), pm);
      else if (part.geo === 'cyl') mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18), pm);
      else if (part.geo === 'blade') mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), pm);
      else if (part.geo === 'decal24') mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), pm);
      else mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), pm);
      mesh.userData.baseColor = new THREE.Color((scene.materials[part.mat] || {}).color || '#888888');
      mesh.scale.set(part.scale[0], part.scale[1], part.scale[2]);
      mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
      mesh.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
      mesh.castShadow = part.mat !== 'glass' && part.geo !== 'decal24';
      mesh.receiveShadow = true;
      mesh.userData.partName = part.name;
      parts[part.name] = mesh;
      if (part.name.startsWith('主桨叶')) { mesh.position.set(0, 0, 0); rotorGroup.add(mesh); }
      else if (part.name.startsWith('尾桨叶')) { mesh.position.set(0, 0, 0); tailGroup.add(mesh); }
      else heli.add(mesh);
    }
    // 旋翼模糊盘
    const blur = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.02, 48),
      new THREE.MeshBasicMaterial({ color: '#c9c9d8', transparent: true, opacity: 0.0, depthWrite: false }));
    blur.position.set(0, 2.8, 0); heli.add(blur);
    // 地面投影
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32),
      new THREE.MeshBasicMaterial({ color: '#1a2030', transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; g.add(shadow);
    // 粒子池
    const pools = { dust: [], smoke: [], debris: [], fire: [] };
    const mkPool = (kind, n, geo, material) => {
      const arr = [];
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo, material.clone()); m.visible = false; g.add(m); arr.push(m);
      }
      return arr;
    };
    pools.dust = mkPool('dust', 20, new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: '#c9b48c', transparent: true, opacity: 0.4, depthWrite: false }));
    pools.smoke = mkPool('smoke', 18, new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshStandardMaterial({ color: '#4a4a52', transparent: true, opacity: 0.5, depthWrite: false }));
    pools.debris = mkPool('debris', 18, new THREE.BoxGeometry(0.4, 0.25, 0.3), new THREE.MeshStandardMaterial({ color: '#6c34c9', roughness: 0.5 }));
    pools.fire = mkPool('fire', 8, new THREE.ConeGeometry(0.5, 1.2, 8), new THREE.MeshBasicMaterial({ color: '#ff9a2a', transparent: true, opacity: 0.8, depthWrite: false }));
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
    return { root, g, heli, rotorGroup, tailGroup, parts, blur, shadow, pools, fireLight, camera,
      scene, hash: U.jsonSize(scene), mats };
  }
  decalMaterial() {
    if (!this._decalTex) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 160;
      const x = c.getContext('2d');
      x.clearRect(0, 0, 256, 160);
      x.fillStyle = '#ffc21e'; x.font = 'bold 132px "Segoe UI", Arial, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('24', 128, 84);
      this._decalTex = new THREE.CanvasTexture(c); this._decalTex.colorSpace = THREE.SRGBColorSpace;
    }
    return new THREE.MeshBasicMaterial({ map: this._decalTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  }

  renderAll() {
    const now = performance.now();
    if (now - this.lastRender < 24) return;
    this.lastRender = now;
    if (this.ctxLost) { this.initRenderer(); this.ctxLost = false; }
    for (const key in this.views) {
      const v = this.views[key];
      if (!v.canvas.isConnected) continue;
      const d = this.data[v.dataKey];
      if (!d) {
        if (v.kind === 'chart') this.renderChart(v, { rows: [], series: [], title: '图表工作台', range: '', version: 0 });
        else if (v.kind === 'scene') { v.ctx.fillStyle = '#0e1424'; v.ctx.fillRect(0, 0, v.w, v.h); v.ctx.fillStyle = '#7c86a8'; v.ctx.font = '13px "Microsoft YaHei",sans-serif'; v.ctx.fillText('场景装载中…', 16, 26); }
        continue;
      }
      if (d.type === 'chart') this.renderChart(v, d);
      else if (d.type === 'scene') this.renderScene(v, d);
    }
  }
  renderScene(v, d) {
    const key = v.dataKey;
    let sc = this.scenes[key];
    if (!sc && d.scene) { this.loadScene(v.systemId, v.winId, d.scene); sc = this.scenes[key]; }
    if (!sc || !this.renderer) return;
    try {
      const w = v.w, h = v.h;
      this.renderer.setSize(w, h, false);
      sc.camera.aspect = w / h;
      const cam = d.camera || { pos: [13, 7, 13], target: [0, 1.5, 0], fov: 48 };
      sc.camera.fov = cam.fov || 48; sc.camera.updateProjectionMatrix();
      sc.camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
      sc.camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
      const pose = d.pose || {};
      const p = pose.pos || [0, 0.42, 0], r = pose.rot || [0, 0, 0];
      sc.heli.position.set(p[0], p[1], p[2]);
      sc.heli.rotation.set(r[0], r[1], r[2]);
      sc.rotorGroup.rotation.y = pose.rotor || 0;
      sc.tailGroup.rotation.x = pose.tail || 0;
      const rpm = Math.min(1, Math.abs(pose.rotor || 0) * 0.02 + 0.3);
      sc.blur.material.opacity = pose.impact ? 0 : Math.min(0.22, rpm * 0.18);
      // 地面投影
      const gh = SCENE.terrainHeight(sc.scene, p[0], p[2]);
      sc.shadow.position.set(p[0], gh + 0.06, p[2]);
      const sc2 = Math.max(0.7, 2.6 - Math.max(0, p[1] - gh) * 0.06);
      sc.shadow.scale.set(sc2 / 2.6, sc2 / 2.6, 1);
      sc.shadow.material.opacity = Math.max(0.05, 0.32 - Math.max(0, p[1] - gh) * 0.02);
      // 损坏：机身熏黑、部件错位
      const deform = pose.deform || 0;
      for (const name in sc.parts) {
        const m = sc.parts[name];
        const burn = deform > 0 && /机身|机鼻|舱门|发动机|尾梁/.test(name);
        if (m.material && m.material.color && m.userData.baseColor) {
          m.material.color.copy(m.userData.baseColor);
          if (burn) m.material.color.lerp(new THREE.Color('#241c28'), Math.min(0.85, deform * 0.8));
        }
        if (deform > 0) {
          if (name.includes('桨叶')) { m.rotation.z = deform * (name.endsWith('A') ? 0.5 : -0.3); m.visible = deform < 0.85; }
          else if (name.includes('尾梁')) m.rotation.z = -deform * 0.18;
        } else {
          if (name.includes('桨叶')) { m.rotation.z = 0; m.visible = true; }
          else if (name.includes('尾梁')) m.rotation.z = 0;
        }
      }
      // 粒子
      const fx = d.fx || {};
      const place = (arr, list, fn) => {
        for (let i = 0; i < arr.length; i++) {
          const m = arr[i], it = list && list[i];
          if (!it) { m.visible = false; continue; }
          m.visible = true; fn(m, it);
        }
      };
      place(sc.pools.dust, fx.dust, (m, it) => { m.position.set(it.pos[0], it.pos[1], it.pos[2]); m.scale.setScalar(it.size); m.material.opacity = it.alpha; });
      place(sc.pools.smoke, fx.smoke, (m, it) => { m.position.set(it.pos[0], it.pos[1], it.pos[2]); m.scale.setScalar(it.size); m.material.opacity = it.alpha; });
      place(sc.pools.debris, fx.debris, (m, it) => { m.position.set(it.pos[0], it.pos[1], it.pos[2]); m.rotation.set(it.rot[0], it.rot[1], it.rot[2]); m.scale.setScalar(it.size * 2.2); });
      place(sc.pools.fire, fx.fire, (m, it) => { m.position.set(it.pos[0], it.pos[1] + it.size * 0.5, it.pos[2]); m.scale.setScalar(it.size); m.material.opacity = it.alpha; });
      sc.fireLight.position.set(p[0], gh + 1.2, p[2]);
      sc.fireLight.intensity = pose.impact && (d.t - (pose.impactT || 0)) < 4 ? 3.2 : 0;
      this.renderer.render(sc.root, sc.camera);
      v.ctx.clearRect(0, 0, w, h);
      v.ctx.drawImage(this.renderer.domElement, 0, 0, w, h);
    } catch (e) { /* 单个视图绘制失败不影响其它视图 */ }
  }
  renderChart(v, d) {
    const c = v.ctx, w = v.w, h = v.h;
    c.clearRect(0, 0, w, h);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--panel') || '#ffffff';
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    const rows = d.rows || [], series = d.series || ['D'], type = d.chartType || 'bar';
    const pad = { l: 58, r: 18, t: 46, b: 42 };
    const cw = Math.max(10, w - pad.l - pad.r), ch = Math.max(10, h - pad.t - pad.b);
    c.fillStyle = '#243047'; c.font = 'bold 15px "Microsoft YaHei", "Segoe UI", sans-serif';
    c.fillText(d.title || (d.docTitle || '实时数据') + ' · ' + (d.range || ''), pad.l, 26);
    let max = 1;
    for (const r of rows) for (const v2 of r.values) max = Math.max(max, Math.abs(Number(v2) || 0));
    max = Math.ceil(max * 1.15) || 1;
    c.strokeStyle = '#d8deea'; c.lineWidth = 1; c.fillStyle = '#6b768c'; c.font = '11px "Segoe UI", sans-serif';
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ch - (ch * i / 4);
      c.beginPath(); c.moveTo(pad.l, y); c.lineTo(pad.l + cw, y); c.stroke();
      c.fillText(String(Math.round(max * i / 4)), 8, y + 4);
    }
    const colors = ['#7c5cff', '#ffb020', '#28c2a0', '#ff6b8b', '#4a9be8', '#a06bff'];
    if (type === 'bar') {
      const n = rows.length, gn = Math.max(1, series.length);
      const gw = cw / Math.max(1, n), bw = Math.max(2, (gw * 0.68) / gn);
      rows.forEach((r, i) => {
        r.values.forEach((val, j) => {
          const bh = (Math.max(0, Number(val) || 0) / max) * ch;
          const x = pad.l + i * gw + gw * 0.16 + j * bw;
          c.fillStyle = colors[j % colors.length];
          if (d.selectionLabel === r.label) { c.globalAlpha = 1; c.fillRect(x, pad.t + ch - bh, bw - 1, bh); }
          else { c.globalAlpha = 0.88; c.fillRect(x, pad.t + ch - bh, bw - 1, bh); }
          c.globalAlpha = 1;
          c.fillStyle = '#34405c'; c.font = '10px "Segoe UI", sans-serif';
          c.fillText(String(Math.round((Number(val) || 0) * 10) / 10), x, pad.t + ch - bh - 3);
        });
        c.fillStyle = '#4a5570'; c.font = '11px "Microsoft YaHei", "Segoe UI", sans-serif';
        c.fillText(String(r.label).slice(0, 6), pad.l + i * gw + gw * 0.1, pad.t + ch + 16);
      });
    } else {
      const n = rows.length;
      series.forEach((s, j) => {
        c.strokeStyle = colors[j % colors.length]; c.lineWidth = 2.4; c.beginPath();
        rows.forEach((r, i) => {
          const x = pad.l + (n <= 1 ? cw / 2 : (cw * i / (n - 1)));
          const y = pad.t + ch - (Math.max(0, Number(r.values[j]) || 0) / max) * ch;
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        });
        c.stroke();
        rows.forEach((r, i) => {
          const x = pad.l + (n <= 1 ? cw / 2 : (cw * i / (n - 1)));
          const y = pad.t + ch - (Math.max(0, Number(r.values[j]) || 0) / max) * ch;
          c.fillStyle = colors[j % colors.length]; c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill();
        });
      });
      rows.forEach((r, i) => {
        const x = pad.l + (n <= 1 ? cw / 2 : (cw * i / (n - 1)));
        c.fillStyle = '#4a5570'; c.font = '11px "Microsoft YaHei", "Segoe UI", sans-serif';
        c.fillText(String(r.label).slice(0, 6), x - 12, pad.t + ch + 16);
      });
    }
    // 图例
    series.forEach((s, j) => {
      const x = pad.l + j * 86, y = h - 10;
      c.fillStyle = colors[j % colors.length]; c.fillRect(x, y - 9, 11, 9);
      c.fillStyle = '#4a5570'; c.font = '11px "Segoe UI", sans-serif'; c.fillText('列 ' + s, x + 15, y);
    });
    c.fillStyle = '#8a93a8'; c.font = '10px "Segoe UI", sans-serif';
    c.fillText('版本 ' + (d.version || 0), w - 76, 26);
  }
}

module.exports = GFX;
