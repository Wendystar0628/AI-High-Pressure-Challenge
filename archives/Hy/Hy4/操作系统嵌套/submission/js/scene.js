/* ============================================================================
 * 三维显示设备：接收程序提交的「场景状态」(部件位姿/损坏/相机/粒子发射)，按时刻绘制。
 * 单一共享 WebGLRenderer + 每视图一块 2D 画布：无论打开多少三维视图，都只有一个
 * WebGL 上下文（规避 Chromium 每线程 ~16 上下文上限），上下文丢失后从状态恢复。
 * 场景资源（几何/材质/灯光/镜头/时序）是数据；播放器与设备代码里没有这架直升机。
 * ========================================================================== */
(function (OS) {
  'use strict';
  const T = window.THREE;
  if (!T) { console.error('Three.js 未加载'); }

  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.needsUpdate = true; return t; }
  function color(hex) { return new T.Color(hex || '#ffffff'); }

  // -------------------------------------------------- 共享渲染器（单 WebGL 上下文）
  const SharedRenderer = {
    renderer: null, canvas: null, W: 960, H: 600, views: [], lost: false,
    ensure() {
      if (this.renderer || !T) return;
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.W; this.canvas.height = this.H;
      try {
        this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
      } catch (e) { console.error('WebGL 初始化失败', e); return; }
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(this.W, this.H, false);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); SharedRenderer.lost = true; });
      this.canvas.addEventListener('webglcontextrestored', () => { SharedRenderer.lost = false; });
    },
    register(v) { if (this.views.indexOf(v) < 0) this.views.push(v); },
    unregister(v) { this.views = this.views.filter((x) => x !== v); },
    frame() {
      this.ensure(); if (!this.renderer || this.lost) return;
      let mw = this.W, mh = this.H;
      for (const v of this.views) if (v.visible && v.canvas) { mw = Math.max(mw, v.w); mh = Math.max(mh, v.h); }
      if (mw > this.W || mh > this.H) { this.W = mw; this.H = mh; this.renderer.setSize(this.W, this.H, false); }
      for (const v of this.views) {
        if (!v.visible || !v.canvas || !v.ctx || v.w < 2 || v.h < 2) continue;
        try {
          v.applyCamera();
          this.renderer.setViewport(0, this.H - v.h, v.w, v.h);
          this.renderer.setScissor(0, this.H - v.h, v.w, v.h);
          this.renderer.setScissorTest(true);
          this.renderer.setClearColor(v.clear, 1);
          this.renderer.render(v.scene, v.camera);
          v.ctx.clearRect(0, 0, v.w, v.h);
          v.ctx.drawImage(this.canvas, 0, 0, v.w, v.h, 0, 0, v.w, v.h);
        } catch (e) { /* 单视图异常不影响其它视图 */ }
      }
      this.renderer.setScissorTest(false);
    },
  };

  // -------------------------------------------------- 场景视图
  function SceneView(container, res, opts) {
    this.container = container; this.res = res; this.opts = opts || {};
    this.cameraState = this.opts.camera || { mode: 'show', theta: 0.9, phi: 1.05, radius: 14 };
    this.visible = true; this.state = null; this.w = 300; this.h = 200;
    this.clear = color(res.environment.skyBottom || '#20304a');
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(48, 1.5, 0.1, 800);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'scene-canvas';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this._build();
    this.resize();
    SharedRenderer.register(this);
  }

  SceneView.prototype._build = function () {
    const R = this.res, E = R.environment;
    // 天空穹顶
    const sky = new T.Mesh(new T.SphereGeometry(400, 32, 20), new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: { top: { value: color(E.skyTop) }, mid: { value: color(E.skyMid) }, bottom: { value: color(E.skyBottom) } },
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; void main(){ float h=normalize(vP).y; vec3 c = h>0.0 ? mix(mid,top,clamp(h,0.0,1.0)) : mix(bottom,mid,clamp(h+1.0,0.0,1.0)); gl_FragColor=vec4(c,1.0); }',
    }));
    this.scene.add(sky);
    this.scene.fog = new T.Fog(color(E.fog), E.fogNear || 30, E.fogFar || 110);

    // 灯光
    const amb = new T.AmbientLight(color(E.ambient), 0.75); this.scene.add(amb);
    const hemi = new T.HemisphereLight(color(E.skyTop), color(R.terrain.grass), E.hemi || 0.5); this.scene.add(hemi);
    const sun = new T.DirectionalLight(color(E.sunColor), E.sunIntensity || 1.5);
    sun.position.set(-30, 46, 20); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 140; sun.shadow.bias = -0.0006;
    this.scene.add(sun); this.sun = sun;

    // 地形（起伏）
    const tg = new T.PlaneGeometry(R.terrain.size, R.terrain.size, R.terrain.segments, R.terrain.segments);
    tg.rotateX(-Math.PI / 2);
    const pos = tg.attributes.position; const seed = R.terrain.seed || 7;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = Math.sin(x * 0.09 + seed) * Math.cos(z * 0.11 - seed) * R.terrain.amplitude
        + Math.sin(x * 0.03 + z * 0.04) * R.terrain.amplitude * 0.6;
      pos.setY(i, h - 0.4);
    }
    tg.computeVertexNormals();
    const groundTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = R.terrain.grass; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(30,70,30,.22)' : 'rgba(150,170,70,.18)'; const s = 2 + Math.random() * 6; g.fillRect(Math.random() * w, Math.random() * h, s, s); }
    });
    groundTex.wrapS = groundTex.wrapT = T.RepeatWrapping; groundTex.repeat.set(14, 14); groundTex.colorSpace = T.SRGBColorSpace;
    const ground = new T.Mesh(tg, new T.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0 }));
    ground.receiveShadow = true; this.scene.add(ground); this.ground = ground;
    this.terrainHeight = (x, z) => Math.sin(x * 0.09 + seed) * Math.cos(z * 0.11 - seed) * R.terrain.amplitude + Math.sin(x * 0.03 + z * 0.04) * R.terrain.amplitude * 0.6 - 0.4;

    // 停机坪
    (R.helipads || []).forEach((p, i) => {
      const disc = new T.Mesh(new T.CylinderGeometry(p.r, p.r, 0.12, 40), new T.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.85 }));
      disc.position.set(p.x, (this.terrainHeight(p.x, p.z) + 0.06), p.z); disc.receiveShadow = true; this.scene.add(disc);
      const ring = new T.Mesh(new T.RingGeometry(p.r * 0.82, p.r * 0.94, 40), new T.MeshBasicMaterial({ color: color(R.colors.accent), side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, disc.position.y + 0.07, p.z); this.scene.add(ring);
      const hTex = canvasTex(128, 128, (g) => { g.clearRect(0, 0, 128, 128); g.fillStyle = R.colors.accent; g.font = 'bold 96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 64, 68); });
      const hm = new T.Mesh(new T.PlaneGeometry(p.r, p.r), new T.MeshBasicMaterial({ map: hTex, transparent: true }));
      hm.rotation.x = -Math.PI / 2; hm.position.set(p.x, disc.position.y + 0.075, p.z); this.scene.add(hm);
    });

    // 障碍 / 建筑 / 树木
    (R.obstacles || []).forEach((o) => {
      if (o.type === 'building') {
        const winTex = canvasTex(64, 64, (g) => { g.fillStyle = o.color || '#5a5470'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(255,220,150,.5)'; for (let y = 6; y < 64; y += 14) for (let x = 6; x < 64; x += 14) if (Math.random() > 0.35) g.fillRect(x, y, 7, 8); });
        winTex.colorSpace = T.SRGBColorSpace;
        const b = new T.Mesh(new T.BoxGeometry(o.w, o.h, o.d), new T.MeshStandardMaterial({ map: winTex, roughness: 0.8 }));
        b.position.set(o.x, this.terrainHeight(o.x, o.z) + o.h / 2, o.z); b.castShadow = true; b.receiveShadow = true; this.scene.add(b);
      } else if (o.type === 'tower') {
        const t = new T.Mesh(new T.CylinderGeometry(o.r * 0.6, o.r, o.h, 10), new T.MeshStandardMaterial({ color: o.color, roughness: 0.7, metalness: 0.2 }));
        t.position.set(o.x, this.terrainHeight(o.x, o.z) + o.h / 2, o.z); t.castShadow = true; this.scene.add(t);
      }
    });
    (R.trees || []).forEach((tr) => {
      const g = new T.Group();
      const trunk = new T.Mesh(new T.CylinderGeometry(0.14 * tr.s, 0.2 * tr.s, 1.4 * tr.s, 6), new T.MeshStandardMaterial({ color: 0x5a4028, roughness: 1 }));
      trunk.position.y = 0.7 * tr.s; trunk.castShadow = true; g.add(trunk);
      const crown = new T.Mesh(new T.ConeGeometry(1.0 * tr.s, 2.6 * tr.s, 7), new T.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 1 }));
      crown.position.y = 2.1 * tr.s; crown.castShadow = true; g.add(crown);
      g.position.set(tr.x, this.terrainHeight(tr.x, tr.z), tr.z); this.scene.add(g);
    });
    // 远景山丘
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2; const rr = 62 + (i % 3) * 6;
      const hill = new T.Mesh(new T.ConeGeometry(14, 12 + (i % 4) * 4, 6), new T.MeshStandardMaterial({ color: 0x3a3358, roughness: 1 }));
      hill.position.set(Math.cos(a) * rr, 4, Math.sin(a) * rr); this.scene.add(hill);
    }

    this._buildHeli();
    this._buildParticles();
  };

  SceneView.prototype._buildHeli = function () {
    const R = this.res, C = R.colors, H = R.heli;
    const heli = new T.Group(); this.heli = heli; this.scene.add(heli);
    const bodyMat = new T.MeshStandardMaterial({ color: color(C.body), roughness: 0.35, metalness: 0.35 });
    const darkMat = new T.MeshStandardMaterial({ color: color(C.trim), roughness: 0.5, metalness: 0.3 });
    const accMat = new T.MeshStandardMaterial({ color: color(C.accent), roughness: 0.4, metalness: 0.2 });
    const glassMat = new T.MeshStandardMaterial({ color: color(C.glass), roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55 });
    const skidMat = new T.MeshStandardMaterial({ color: color(C.skid), roughness: 0.5, metalness: 0.6 });

    const parts = [];
    const fus = new T.Mesh(new T.SphereGeometry(1, 24, 16), bodyMat);
    fus.scale.set(H.length * 0.52, H.height * 0.5, H.width * 0.5); fus.castShadow = true; fus.receiveShadow = true;
    heli.add(fus); parts.push({ mesh: fus, name: '机身' });
    // 机头驾驶舱玻璃
    const cock = new T.Mesh(new T.SphereGeometry(0.62, 18, 14), glassMat);
    cock.position.set(H.length * 0.42, 0.12, 0); cock.scale.set(1.1, 0.8, 0.9); cock.castShadow = true;
    heli.add(cock); parts.push({ mesh: cock, name: '驾驶舱' });
    // 黄色识别带
    const stripe = new T.Mesh(new T.TorusGeometry(H.width * 0.5, 0.09, 8, 24), accMat);
    stripe.rotation.y = Math.PI / 2; stripe.scale.set(1, H.height * 0.5 / (H.width * 0.5), 1);
    stripe.position.x = -H.length * 0.12; heli.add(stripe);
    // 尾梁
    const boom = new T.Mesh(new T.CylinderGeometry(0.16, 0.28, H.length * 0.9, 10), bodyMat);
    boom.rotation.z = Math.PI / 2; boom.position.set(-H.length * 0.85, 0.12, 0); boom.castShadow = true;
    heli.add(boom); parts.push({ mesh: boom, name: '尾梁' });
    // 尾翼
    const fin = new T.Mesh(new T.BoxGeometry(0.12, 0.9, 0.5), darkMat);
    fin.position.set(-H.length * 1.28, 0.5, 0); heli.add(fin);
    // 主旋翼
    const rotor = new T.Group(); rotor.position.set(0, H.height * 0.52, 0); heli.add(rotor); this.mainRotor = rotor;
    const hub = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.24, 10), darkMat); rotor.add(hub);
    for (let i = 0; i < H.blades; i++) {
      const blade = new T.Mesh(new T.BoxGeometry(H.rotorR, 0.045, 0.16), darkMat);
      blade.position.x = H.rotorR * 0.5; blade.rotation.y = (i / H.blades) * Math.PI * 2;
      const holder = new T.Group(); holder.rotation.y = (i / H.blades) * Math.PI * 2; holder.add(blade);
      rotor.add(holder);
    }
    // 尾旋翼
    const tailRotor = new T.Group(); tailRotor.position.set(-H.length * 1.3, 0.5, 0.12); heli.add(tailRotor); this.tailRotor = tailRotor;
    for (let i = 0; i < 3; i++) { const b = new T.Mesh(new T.BoxGeometry(H.tailRotorR, 0.03, 0.07), accMat); b.position.x = H.tailRotorR * 0.4; const g = new T.Group(); g.rotation.x = (i / 3) * Math.PI * 2; g.add(b); tailRotor.add(g); }
    // 起落滑橇
    for (const z of [-H.width * 0.42, H.width * 0.42]) {
      const skid = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, H.length * 0.9, 8), skidMat);
      skid.rotation.z = Math.PI / 2; skid.position.set(0, -H.height * 0.5, z); skid.castShadow = true; heli.add(skid);
      for (const x of [-H.length * 0.25, H.length * 0.25]) { const st = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, H.height * 0.5, 6), skidMat); st.position.set(x, -H.height * 0.25, z); heli.add(st); }
    }
    // 数字 24（贴合机身两侧，随表面受光）
    const numTex = canvasTex(256, 128, (g) => {
      g.clearRect(0, 0, 256, 128); g.fillStyle = C.accent; g.font = 'bold 104px "Arial Black",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 6;
      g.strokeText('24', 128, 66); g.fillText('24', 128, 66);
    });
    numTex.colorSpace = T.SRGBColorSpace;
    for (const s of [1, -1]) {
      const plate = new T.Mesh(new T.PlaneGeometry(1.35, 0.7), new T.MeshStandardMaterial({ map: numTex, transparent: true, roughness: 0.5, metalness: 0.1, side: T.DoubleSide }));
      plate.position.set(-H.length * 0.05, 0.05, s * (H.width * 0.5 + 0.02));
      plate.rotation.y = s > 0 ? 0 : Math.PI;
      heli.add(plate);
    }
    this.parts = parts;
    // 碎片（有厚度、翻滚落地后停稳）
    this.debris = [];
    for (let i = 0; i < 14; i++) {
      const d = new T.Mesh(new T.BoxGeometry(0.22 + (i % 3) * 0.12, 0.12, 0.3 + (i % 2) * 0.15), i % 2 ? bodyMat : accMat);
      d.castShadow = true; d.visible = false; this.scene.add(d); this.debris.push(d);
    }
  };

  SceneView.prototype._buildParticles = function () {
    const spr = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    function makePoints(n, size, colorHex, blending) {
      const geo = new T.BufferGeometry(); const arr = new Float32Array(n * 3); geo.setAttribute('position', new T.BufferAttribute(arr, 3));
      const mat = new T.PointsMaterial({ size, map: spr, color: color(colorHex), transparent: true, depthWrite: false, blending: blending || T.NormalBlending, opacity: 0.9 });
      const pts = new T.Points(geo, mat); pts.frustumCulled = false; return pts;
    }
    this.dust = makePoints(160, 0.5, '#c9b18c'); this.scene.add(this.dust);
    this.smoke = makePoints(90, 1.6, '#3a3a44'); this.scene.add(this.smoke);
    this.fire = makePoints(60, 1.3, '#ff8a24', T.AdditiveBlending); this.scene.add(this.fire);
    this.crashT = 10.6;
    for (const k of this.res.keyframes || []) if (k.crash) { this.crashT = k.t; break; }
  };

  SceneView.prototype.resize = function () {
    const r = this.container.getBoundingClientRect();
    this.w = Math.max(2, Math.round(r.width)); this.h = Math.max(2, Math.round(r.height));
    if (this.canvas.width !== this.w || this.canvas.height !== this.h) { this.canvas.width = this.w; this.canvas.height = this.h; }
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
  };

  SceneView.prototype.applyCamera = function () {
    const st = this.state || { x: 0, y: 1, z: 0 }; const C = this.res.camera || {}; const cs = this.cameraState;
    let px, py, pz, lx = st.x, ly = st.y, lz = st.z;
    if (cs.mode === 'orbit') {
      const r = cs.radius || 14; px = st.x + r * Math.sin(cs.phi) * Math.cos(cs.theta); py = st.y + r * Math.cos(cs.phi); pz = st.z + r * Math.sin(cs.phi) * Math.sin(cs.theta);
    } else if (cs.mode === 'follow') {
      const o = C.followOffset || [-9, 4, 9]; px = st.x + o[0]; py = st.y + o[1]; pz = st.z + o[2]; ly = st.y;
    } else { // show：跟随主要动作的演出镜头
      const sp = C.showPos || [16, 9, 20]; px = sp[0] + st.x * 0.45; py = sp[1] + st.y * 0.25; pz = sp[2] + st.z * 0.45;
      lx = st.x; ly = st.y + 0.6; lz = st.z;
    }
    this.camera.position.set(px, py, pz); this.camera.lookAt(lx, ly, lz);
  };

  function setPoints(pts, t, count, fn) {
    const a = pts.geometry.attributes.position.array; const n = a.length / 3;
    for (let i = 0; i < n; i++) { const v = fn(i, t, i < count); a[i * 3] = v[0]; a[i * 3 + 1] = v[1]; a[i * 3 + 2] = v[2]; }
    pts.geometry.attributes.position.needsUpdate = true;
  }

  SceneView.prototype.setState = function (st) {
    if (!st) return;
    this.state = st;
    const H = this.heli;
    H.position.set(st.x || 0, (st.y || 0) + (this.terrainHeight ? this.terrainHeight(st.x || 0, st.z || 0) : 0) + 0.0, st.z || 0);
    // y 已是离地高度，叠加地形高度
    H.rotation.set(st.pitch || 0, st.yaw || 0, st.roll || 0);
    this.mainRotor.rotation.y = (st.rotor || 0);
    this.tailRotor.rotation.x = (st.rotor || 0) * 2.4;
    // 损坏：主旋翼偏转、机身下沉
    const dmg = st.damage || 0;
    this.mainRotor.rotation.z = dmg * 0.25;
    // 阴影随高度由灯光自然产生；下洗气流带起尘土
    const gy = this.terrainHeight ? this.terrainHeight(st.x || 0, st.z || 0) : 0;
    const dustN = Math.round((st.dust || 0) * (st.y > 6 ? 20 : 150));
    const t = st.t || 0;
    setPoints(this.dust, t, dustN, (i) => {
      const a = i * 2.399; const rr = 1.5 + (i % 9) * 0.35 + Math.sin(t * 3 + i) * 0.3;
      const life = ((t * 0.6 + i * 0.13) % 1);
      return [ (st.x || 0) + Math.cos(a) * rr, gy + life * (2.5 + (st.y || 0) * 0.15), (st.z || 0) + Math.sin(a) * rr ];
    });
    this.dust.material.opacity = Math.min(0.85, 0.25 + (st.dust || 0) * 0.5);
    // 碎片 / 烟 / 火：只由该时刻及之前的过程决定（纯函数）
    const age = t - this.crashT;
    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      if (age < 0) { d.visible = false; continue; }
      d.visible = true;
      const seed = i * 1.7;
      const vx = Math.cos(seed) * (2 + (i % 5)); const vz = Math.sin(seed) * (2 + (i % 4)); const vy = 3 + (i % 6);
      const tt = Math.min(age, 2.2);
      let px = (st.x || 0) + vx * tt; let pz = (st.z || 0) + vz * tt;
      let py = Math.max(gy + 0.12, gy + 0.4 + vy * tt - 4.9 * tt * tt);
      d.position.set(px, py, pz);
      d.rotation.set(seed + tt * 3, seed * 2 + tt * 2.1, tt * 2.5);
    }
    const smokeOn = age > 0;
    const smokeN = smokeOn ? Math.round(90 * Math.max(0.1, (st.smoke || 0))) : 0;
    setPoints(this.smoke, t, smokeN, (i) => {
      const life = ((t * 0.35 + i * 0.11) % 1); const a = i * 2.399; const rr = 0.6 + life * 3;
      return [ (st.x || 0) + Math.cos(a) * rr * 0.5 + life * 1.2, gy + 0.4 + life * 8, (st.z || 0) + Math.sin(a) * rr * 0.5 ];
    });
    const fireN = smokeOn ? Math.round(60 * Math.max(0, (st.fire || 0))) : 0;
    setPoints(this.fire, t, fireN, (i) => {
      const life = ((t * 1.3 + i * 0.17) % 1); const a = i * 2.399; const rr = 0.4 + (i % 4) * 0.25;
      return [ (st.x || 0) + Math.cos(a) * rr, gy + 0.3 + life * 2.6, (st.z || 0) + Math.sin(a) * rr ];
    });
  };

  SceneView.prototype.pick = function (nx, ny) {
    if (!T) return null;
    const rc = new T.Raycaster(); rc.setFromCamera({ x: nx, y: ny }, this.camera);
    const hits = rc.intersectObjects(this.heli.children, true);
    if (hits.length) {
      const obj = hits[0].object;
      let part = null; for (const p of this.parts) if (p.mesh === obj || p.mesh === obj.parent) part = p;
      const dmg = (this.state && this.state.damage) || 0;
      return { name: part ? part.name : '部件', damage: dmg > 0.6 ? '损毁' : dmg > 0.2 ? '受损' : '完好', point: hits[0].point };
    }
    return null;
  };
  SceneView.prototype.setCameraMode = function (m) { this.cameraState.mode = m; };
  SceneView.prototype.orbit = function (dx, dy) { const c = this.cameraState; c.theta = (c.theta || 0.9) + dx * 0.01; c.phi = Math.max(0.2, Math.min(1.5, (c.phi || 1.05) + dy * 0.01)); };
  SceneView.prototype.zoom = function (d) { const c = this.cameraState; c.radius = Math.max(6, Math.min(40, (c.radius || 14) + d * 0.02)); };
  SceneView.prototype.setVisible = function (v) { this.visible = !!v; };
  SceneView.prototype.dispose = function () { SharedRenderer.unregister(this); if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas); };

  OS.SceneView = SceneView;
  OS.SharedRenderer = SharedRenderer;
})(window.OS = window.OS || {});
