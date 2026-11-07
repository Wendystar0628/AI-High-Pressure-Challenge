/* =========================================================================
   dynamic route tower defense · WebGL world / renderer / effects / camera
   ========================================================================= */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  const D = global.GAME_DATA;
  const M = global.MODELS;
  const CELL = D.CELL;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const hexColor = c => (typeof c === 'string' ? c : '#' + c.toString(16).padStart(6, '0'));

  const SHARED_GEO = new Set();
  function disposeGroup(g) {
    const mats = new Set(), geos = new Set();
    g.traverse(o => {
      if (o.geometry) geos.add(o.geometry);
      if (o.material) {
        const arr = Array.isArray(o.material) ? o.material : [o.material];
        arr.forEach(m => { if (!m.__shared) mats.add(m); });
      }
    });
    const shared = global.MODELS && global.MODELS.GEO ? new Set(Object.values(global.MODELS.GEO)) : new Set();
    geos.forEach(x => { if (!shared.has(x)) x.dispose(); });
    mats.forEach(x => x.dispose());
  }

  /* ===================================================================== *
   *  Effects
   * ===================================================================== */
  class Effects {
    constructor(world) {
      this.world = world;
      this.scene = world.scene;
      this.projectiles = [];
      this.beams = [];
      this.rings = [];
      this.flashes = [];
      this.warnings = [];
      this.texts = [];
      this.particles = null;
      this.pdata = [];
      this._initParticles(1200);
      this.floatLayer = document.getElementById('float-layer');
    }
    _initParticles(n) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const size = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos[i * 3 + 1] = -999; size[i] = 0; }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('psize', new THREE.BufferAttribute(size, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTex: { value: M.glowTexture() } },
        vertexShader: `attribute float psize; varying vec3 vC;
          void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize = psize * (300.0 / max(1.0,-mv.z)); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform sampler2D uTex; varying vec3 vC;
          void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(vC,1.0)*t; }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true
      });
      this.pmesh = new THREE.Points(geo, mat);
      this.pmesh.frustumCulled = false;
      this.scene.add(this.pmesh);
      this._pgeo = geo;
      this._pcount = n;
      this._pidx = 0;
      this._pdata = new Array(n).fill(null).map(() => ({ life: 0, max: 1, vel: new THREE.Vector3(), grav: 0 }));
    }
    particle(pos, color, count, opts) {
      opts = opts || {};
      const spread = opts.spread == null ? 1.4 : opts.spread;
      const speed = opts.speed == null ? 3 : opts.speed;
      const c = new THREE.Color(color);
      for (let i = 0; i < count; i++) {
        const idx = this._pidx = (this._pidx + 1) % this._pcount;
        const d = this._pdata[idx];
        d.life = d.max = (opts.life || 0.8) * (0.6 + Math.random() * 0.8);
        d.grav = opts.grav == null ? 2 : opts.grav;
        d.vel.set((Math.random() - 0.5) * spread, (Math.random() * 0.8 + 0.2) * speed * (opts.up == null ? 0.7 : opts.up), (Math.random() - 0.5) * spread);
        const p = this._pgeo.attributes.position.array;
        p[idx * 3] = pos.x + (Math.random() - 0.5) * (opts.jitter || 0.2);
        p[idx * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.2;
        p[idx * 3 + 2] = pos.z + (Math.random() - 0.5) * (opts.jitter || 0.2);
        const ca = this._pgeo.attributes.color.array;
        ca[idx * 3] = c.r; ca[idx * 3 + 1] = c.g; ca[idx * 3 + 2] = c.b;
        this._pgeo.attributes.psize.array[idx] = (opts.size || 0.55) * (0.6 + Math.random() * 0.8);
      }
      this._pgeo.attributes.position.needsUpdate = true;
      this._pgeo.attributes.color.needsUpdate = true;
      this._pgeo.attributes.psize.needsUpdate = true;
    }
    burst(pos, color, count, opts) { this.particle(pos, color, count, opts); }
    _updateParticles(dt) {
      const pos = this._pgeo.attributes.position.array;
      const size = this._pgeo.attributes.psize.array;
      for (let i = 0; i < this._pcount; i++) {
        const d = this._pdata[i];
        if (d.life <= 0) { if (size[i] !== 0) { size[i] = 0; pos[i * 3 + 1] = -999; } continue; }
        d.life -= dt;
        const life = Math.max(0, d.life / d.max);
        d.vel.y -= d.grav * dt;
        pos[i * 3] += d.vel.x * dt; pos[i * 3 + 1] += d.vel.y * dt; pos[i * 3 + 2] += d.vel.z * dt;
        size[i] *= (1 - dt * 1.2);
        if (d.life <= 0) size[i] = 0;
      }
      this._pgeo.attributes.position.needsUpdate = true;
      this._pgeo.attributes.psize.needsUpdate = true;
    }
    projectile(from, to, opts) {
      opts = opts || {};
      const g = new THREE.Group();
      const color = opts.color || 0x6bdcff;
      const core = new THREE.Mesh(new THREE.SphereGeometry(opts.size || 0.16, 8, 6), new THREE.MeshBasicMaterial({ color }));
      g.add(core);
      const gl = M.glowSprite(color, (opts.size || 0.16) * 6, 0.55); g.add(gl);
      if (opts.trail !== false) {
        const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, 1.2, 5, 1, true), new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        trail.position.z = -0.6; trail.rotation.x = Math.PI / 2; g.add(trail);
      }
      g.position.copy(from);
      this.scene.add(g);
      const speed = opts.speed || 26;
      const dur = Math.max(0.05, from.distanceTo(to) / speed);
      this.projectiles.push({ obj: g, from: from.clone(), to: to.clone(), t: 0, dur, onHit: opts.onHit, arc: opts.arc || 0, color });
      return g;
    }
    beam(from, to, color, opts) {
      opts = opts || {};
      const dir = new THREE.Vector3().subVectors(to, from);
      const len = dir.length();
      if (len < 0.01) return;
      const geo = new THREE.CylinderGeometry(opts.width || 0.035, opts.width || 0.035, len, 5, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: opts.opacity == null ? 0.5 : opts.opacity,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(from).addScaledVector(dir, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      this.scene.add(m);
      this.beams.push({ obj: m, life: opts.life || 0.12, max: opts.life || 0.12 });
    }
    lightning(from, to, color, opts) {
      opts = opts || {};
      const pts = [from.clone()];
      const n = 6;
      for (let i = 1; i < n; i++) {
        const p = new THREE.Vector3().lerpVectors(from, to, i / n);
        p.x += (Math.random() - 0.5) * 1.2; p.y += (Math.random() - 0.5) * 1.2; p.z += (Math.random() - 0.5) * 1.2;
        pts.push(p);
      }
      pts.push(to.clone());
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending }));
      this.scene.add(line);
      this.beams.push({ obj: line, life: opts.life || 0.2, max: opts.life || 0.2, geo: true });
      if (Math.random() < 0.4) this.particle(to, color, 4, { spread: 2, speed: 2 });
    }
    ring(pos, color, radius, opts) {
      opts = opts || {};
      const geo = new THREE.RingGeometry(0.9, 1.0, 48);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.copy(pos); m.position.y += 0.15;
      this.scene.add(m);
      this.rings.push({ obj: m, t: 0, dur: opts.dur || 0.8, r0: radius * 0.2, r1: radius, mat });
    }
    shock(pos, color, radius) {
      this.ring(pos, color, radius, { dur: 0.7 });
      this.particle(pos, color, 26, { spread: radius * 1.4, speed: radius * 1.2, life: 0.7, size: 0.7, up: 0.5 });
      this.flash(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), color, radius * 1.8, 0.5);
    }
    flash(pos, color, size, life) {
      const s = M.glowSprite(color, size, 0.9);
      s.position.copy(pos); this.scene.add(s);
      this.flashes.push({ obj: s, t: 0, dur: life || 0.25, size });
    }
    warning(cellPos, color, radius, label) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.86, radius, 48), new THREE.MeshBasicMaterial({
        color: color || 0xff5252, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      ring.rotation.x = -Math.PI / 2; g.add(ring);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.84, 40), new THREE.MeshBasicMaterial({
        color: color || 0xff5252, transparent: true, opacity: 0.07, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02; g.add(disc);
      const lbl = M.labelSprite(label || '警告', { color: hexColor(color || 0xff5252), fontSize: 34, scale: 0.8 });
      lbl.position.y = 2.2; g.add(lbl);
      g.position.copy(cellPos); this.scene.add(g);
      this.warnings.push({ obj: g, t: 0, dur: 3.0, ring, disc });
    }
    reset() {
      this.projectiles.forEach(p => { this.scene.remove(p.obj); disposeGroup(p.obj); });
      this.projectiles = [];
      this.beams.forEach(b => { this.scene.remove(b.obj); if (b.geo) b.obj.geometry.dispose(); b.obj.material.dispose(); });
      this.beams = [];
      this.rings.forEach(r => { this.scene.remove(r.obj); r.obj.geometry.dispose(); r.mat.dispose(); });
      this.rings = [];
      this.flashes.forEach(f => this.scene.remove(f.obj));
      this.flashes = [];
      this.warnings.forEach(w => { this.scene.remove(w.obj); disposeGroup(w.obj); });
      this.warnings = [];
      this.texts.forEach(t => t.div.remove());
      this.texts = [];
      for (let i = 0; i < this._pcount; i++) { this._pdata[i].life = 0; this._pgeo.attributes.psize.array[i] = 0; this._pgeo.attributes.position.array[i * 3 + 1] = -999; }
      this._pgeo.attributes.psize.needsUpdate = true;
      this._pgeo.attributes.position.needsUpdate = true;
    }
    floatText(world, text, cls) {
      if (!this.floatLayer) return;
      const div = document.createElement('div');
      div.className = 'float-text ' + (cls || '');
      div.textContent = text;
      this.floatLayer.appendChild(div);
      this.texts.push({ div, pos: world.clone(), t: 0, dur: 1.15, off: 0 });
    }
    update(dt, t) {
      this._updateParticles(dt);
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.t += dt;
        const k = clamp(p.t / p.dur, 0, 1);
        const pos = new THREE.Vector3().lerpVectors(p.from, p.to, k);
        if (p.arc) pos.y += Math.sin(k * Math.PI) * p.arc;
        p.obj.position.copy(pos);
        p.obj.lookAt(p.to);
        if (k >= 1) {
          this.scene.remove(p.obj); disposeGroup(p.obj);
          if (p.onHit) p.onHit();
          this.projectiles.splice(i, 1);
        }
      }
      for (let i = this.beams.length - 1; i >= 0; i--) {
        const b = this.beams[i]; b.life -= dt;
        b.obj.material.opacity = Math.max(0, (b.life / b.max) * 0.9);
        if (b.life <= 0) { this.scene.remove(b.obj); if (b.geo) b.obj.geometry.dispose(); b.obj.material.dispose(); this.beams.splice(i, 1); }
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i]; r.t += dt;
        const k = Math.min(1, r.t / r.dur);
        const s = lerp(r.r0, r.r1, ease(k));
        r.obj.scale.set(s, s, s);
        r.mat.opacity = (1 - k) * 0.8;
        if (k >= 1) { this.scene.remove(r.obj); r.obj.geometry.dispose(); r.mat.dispose(); this.rings.splice(i, 1); }
      }
      for (let i = this.flashes.length - 1; i >= 0; i--) {
        const f = this.flashes[i]; f.t += dt;
        const k = f.t / f.dur;
        f.obj.scale.setScalar(f.size * (0.5 + k * 0.8));
        f.obj.material.opacity = Math.max(0, (1 - k) * 0.9);
        if (k >= 1) { this.scene.remove(f.obj); this.flashes.splice(i, 1); }
      }
      for (let i = this.warnings.length - 1; i >= 0; i--) {
        const w = this.warnings[i]; w.t += dt;
        w.ring.material.opacity = 0.35 + Math.sin(t * 8) * 0.25;
        w.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.03);
        w.obj.position.y = Math.sin(t * 2) * 0.04;
        if (w.t > w.dur) { this.scene.remove(w.obj); disposeGroup(w.obj); this.warnings.splice(i, 1); }
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const tx = this.texts[i]; tx.t += dt;
        const k = tx.t / tx.dur;
        const s = this.world.toScreen(tx.pos);
        if (s) {
          tx.div.style.transform = `translate(${s.x}px,${s.y - 30 - k * 42}px) translate(-50%,-100%)`;
          tx.div.style.opacity = k < 0.65 ? 1 : (1 - (k - 0.65) / 0.35);
        }
        if (k >= 1) { tx.div.remove(); this.texts.splice(i, 1); }
      }
    }
  }

  /* ===================================================================== *
   *  World
   * ===================================================================== */
  class World {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.22;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(42, 1, 0.2, 800);
      this.clock = 0;
      this.map = null;
      this.theme = null;
      this.cameraTarget = new THREE.Vector3();
      this.cam = { target: new THREE.Vector3(), yaw: -0.55, pitch: 1.02, dist: 104 };
      this.camGoal = { target: new THREE.Vector3(), yaw: -0.55, pitch: 1.02, dist: 104 };
      this.camAnim = null;
      this.pointer = { x: 0, y: 0 };
      this.raycaster = new THREE.Raycaster();
      this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      this.towerViews = new Map();
      this.enemyViews = new Map();
      this.routeViews = {};
      this.previewRoutes = [];
      this.switchViews = new Map();
      this.elapsed = 0;
      this._initBasics();
      this._bindCamera();
      this.resize();
    }

    _initBasics() {
      this.root = new THREE.Group(); this.scene.add(this.root);
      this.mapGroup = new THREE.Group(); this.root.add(this.mapGroup);
      this.bgGroup = new THREE.Group(); this.root.add(this.bgGroup);
      this.effects = new Effects(this);
      // blocking / lure tethers
      const tg = new THREE.BufferGeometry();
      const tp = new Float32Array(400 * 3);
      const tc = new Float32Array(400 * 3);
      tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
      tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
      tg.setDrawRange(0, 0);
      this.tethers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({
        transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, vertexColors: true, depthWrite: false
      }));
      this.tethers.frustumCulled = false;
      this.root.add(this.tethers);

      const hemi = new THREE.HemisphereLight(0x9fe6ff, 0x1a1020, 0.8);
      this.scene.add(hemi);
      const key = new THREE.DirectionalLight(0xdfefff, 1.9);
      key.position.set(42, 85, 30);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -70; key.shadow.camera.right = 70;
      key.shadow.camera.top = 70; key.shadow.camera.bottom = -70;
      key.shadow.camera.near = 1; key.shadow.camera.far = 240;
      key.shadow.bias = -0.0008;
      this.scene.add(key); this.keyLight = key;
      const fill = new THREE.DirectionalLight(0x3a5f8a, 0.55);
      fill.position.set(-60, 40, -40); this.scene.add(fill);
      const rim = new THREE.PointLight(0x38e0c0, 0.8, 180, 1.4);
      rim.position.set(0, 26, 0); this.scene.add(rim);
      this.rimLight = rim;

      // sky dome
      const skyGeo = new THREE.SphereGeometry(520, 32, 20);
      const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { uTop: { value: new THREE.Color(0x020509) }, uBot: { value: new THREE.Color(0x071522) }, uTime: { value: 0 } },
        vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uTop,uBot; uniform float uTime; varying vec3 vP;
          float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
          void main(){ vec3 d=normalize(vP); float h=clamp(d.y*0.5+0.5,0.0,1.0);
          vec3 c=mix(uBot,uTop,smoothstep(0.3,0.95,h));
          float a=sin(d.x*8.0+uTime*0.03)*sin(d.z*6.0-uTime*0.02);
          c+=vec3(0.015,0.045,0.055)*smoothstep(0.4,1.0,a);
          vec2 g=floor(d.xz*180.0); float s=step(0.9965,hash(g));
          c+=vec3(0.45,0.65,0.8)*s*smoothstep(0.3,0.9,h);
          gl_FragColor=vec4(c,1.0);
          }`
      });
      this.sky = new THREE.Mesh(skyGeo, skyMat); this.scene.add(this.sky);
      this.skyMat = skyMat;

      // distant clusters
      this.farGroup = new THREE.Group(); this.bgGroup.add(this.farGroup);
      this._buildFarNetworks();
      // protocol layers
      this.layers = [];
      this._buildProtocolLayers();
      // ambient motes
      this.motes = this._buildMotes();
    }

    _buildFarNetworks() {
      const rng = mulberry32(9271);
      const mats = [
        new THREE.MeshBasicMaterial({ color: 0x1b3d4a, transparent: true, opacity: 0.55 }),
        new THREE.MeshBasicMaterial({ color: 0x14202e, transparent: true, opacity: 0.65 }),
        new THREE.MeshBasicMaterial({ color: 0x2a1838, transparent: true, opacity: 0.5 })
      ];
      const glowMats = [0x2de0cf, 0x6b8cff, 0xffc76b, 0xff6b9d].map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending }));
      const boxes = [];
      for (let i = 0; i < 22; i++) {
        const a = rng() * Math.PI * 2;
        const r = 115 + rng() * 150;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const y = -25 + rng() * 55;
        const g = new THREE.Group();
        const n = 2 + Math.floor(rng() * 4);
        for (let j = 0; j < n; j++) {
          const h = 5 + rng() * 24;
          const b = new THREE.Mesh(new THREE.BoxGeometry(4 + rng() * 10, h, 4 + rng() * 10), mats[j % 3]);
          b.position.set((rng() - 0.5) * 8, h / 2, (rng() - 0.5) * 8);
          g.add(b);
          const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, h * 0.7, 0.3), glowMats[Math.floor(rng() * 4)]);
          strip.position.set(b.position.x + 2, h / 2, b.position.z + 2);
          g.add(strip);
        }
        g.position.set(x, y, z);
        g.rotation.y = rng() * Math.PI;
        this.farGroup.add(g);
      }
      // far data streaks
      const streakMat = new THREE.LineBasicMaterial({ color: 0x3a86a8, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending });
      for (let i = 0; i < 14; i++) {
        const a = rng() * Math.PI * 2, r1 = 100 + rng() * 120, r2 = 200 + rng() * 80;
        const pts = [];
        for (let k = 0; k <= 10; k++) {
          const t = k / 10;
          const rr = lerp(r1, r2, t);
          pts.push(new THREE.Vector3(Math.cos(a + t * 0.5) * rr, 5 + Math.sin(t * 3.14) * 30 - 10, Math.sin(a + t * 0.5) * rr));
        }
        this.farGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), streakMat));
      }
    }

    _buildProtocolLayers() {
      const cfg = [
        { y: -13, color: 0x1f8fa0, size: 340, opacity: 0.22 },
        { y: -25, color: 0x4354b0, size: 460, opacity: 0.16 },
        { y: -41, color: 0x7a3a8a, size: 600, opacity: 0.11 }
      ];
      cfg.forEach((c, i) => {
        const geo = new THREE.PlaneGeometry(c.size, c.size, 1, 1);
        const mat = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
          uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(c.color) }, uOpacity: { value: c.opacity }, uSpeed: { value: 0.3 + i * 0.15 } },
          vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
          fragmentShader: `uniform vec3 uColor; uniform float uTime,uOpacity,uSpeed; varying vec2 vUv;
            float grid(vec2 p,float w){ vec2 g=abs(fract(p-0.5)-0.5)/fwidth(p); return 1.0-min(min(g.x,g.y),1.0); }
            void main(){
              vec2 p=vUv*38.0;
              float l=grid(p,1.0)*0.45;
              vec2 q=vUv*11.0+vec2(uTime*uSpeed*0.05,0.0);
              float l2=grid(q,1.0)*0.55;
              float d=length(vUv-0.5);
              float scan=smoothstep(0.02,0.0,abs(fract(d*3.0-uTime*0.08)-0.5)-0.48);
              float a=(l+l2*0.7+scan*0.8)*uOpacity*(1.0-smoothstep(0.32,0.5,d));
              gl_FragColor=vec4(uColor*(0.7+scan*2.0),a);
            }`
        });
        const m = new THREE.Mesh(geo, mat);
        m.rotation.x = -Math.PI / 2; m.position.y = c.y;
        this.bgGroup.add(m);
        this.layers.push({ mesh: m, mat, baseY: c.y, phase: i * 1.7 });
      });
      // vertical light shafts
      const shaftMat = new THREE.MeshBasicMaterial({ color: 0x1da8b8, transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2 + 0.4;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4 + i, 1.5 + i * 0.8, 34, 6, 1, true), shaftMat);
        shaft.position.set(Math.cos(a) * (55 + i * 6), -22, Math.sin(a) * (55 + i * 6));
        this.bgGroup.add(shaft);
      }
    }

    _buildMotes() {
      const n = 260, geo = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3);
      const rng = mulberry32(44);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (rng() - 0.5) * 190;
        pos[i * 3 + 1] = -8 + rng() * 40;
        pos[i * 3 + 2] = (rng() - 0.5) * 190;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: 0x7de6ff, size: 0.5, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      const p = new THREE.Points(geo, mat);
      this.bgGroup.add(p);
      return { obj: p, phase: 0 };
    }

    /* ---------------- map construction ---------------- */
    setMap(def, game) {
      if (this.map) this.clearMap();
      this.def = def;
      this.theme = def.theme;
      this.game = game || null;
      this.map = this._parseMap(def);
      this.scene.fog = new THREE.FogExp2(this.theme.fog, this.theme.fogDensity);
      this.renderer.setClearColor(this.theme.bg, 1);
      this.skyMat.uniforms.uTop.value.setHex(this.theme.bg);
      this.skyMat.uniforms.uBot.value.setHex(this.theme.fog);
      this.keyLight.color.setHex(this.theme.key);
      this.rimLight.color.setHex(this.theme.rim);
      this._buildBoard();
      this._buildRoads();
      this._buildPlatforms();
      this._buildSwitches();
      this._buildGates();
      this._buildProps();
      this._buildZoneMarkers();
      this._buildCity();
      this._buildPickVolumes();
      this._buildRoutes();
      this._setupCamera();
      this.effects.floatLayer = document.getElementById('float-layer');
      this.labelGroup = new THREE.Group(); this.mapGroup.add(this.labelGroup);
      this._buildLabels();
    }

    _parseMap(def) {
      const H = def.rows.length, W = def.rows[0].length;
      const cells = [];
      const byKey = {};
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const ch = def.rows[y][x];
          const c = {
            x, y, ch, platform: ch === 'P',
            walk: '.oABCXY'.includes(ch),
            old: ch === 'o',
            type: ch === 'P' ? 'platform' : ch === '#' ? 'void' : (ch === 'A' || ch === 'B' || ch === 'C') ? 'entrance' : (ch === 'X' || ch === 'Y') ? 'exit' : (ch === 'o' ? 'old' : 'link'),
            tower: null, isolation: null, bossBlock: null, cellRect: null, node: null,
            decor: null
          };
          c.zone = 'core';
          if (def.zones) for (const z of def.zones) if (x >= z.x1 && y >= z.y1 && x <= z.x2 && y <= z.y2) { c.zone = z.id; break; }
          cells.push(c); byKey[x + ',' + y] = c;
        }
      }
      const entrances = def.entrances.map(e => {
        const cell = byKey[e.x + ',' + e.y];
        cell.walk = true; cell.type = 'entrance';
        return Object.assign({}, e, { cell });
      });
      const exits = def.exits.map(e => {
        const cell = byKey[e.x + ',' + e.y];
        cell.walk = true; cell.type = 'exit';
        return Object.assign({}, e, { cell });
      });
      const switches = def.switches.map(s => {
        const cell = byKey[s.x + ',' + s.y];
        cell.walk = true; cell.type = 'switch'; cell.switch = s;
        return Object.assign({}, s, { cell });
      });
      return { def, W, H, cells, byKey, entrances, exits, switches, cellSize: CELL };
    }

    cellPos(c, up) {
      const m = this.map;
      const wx = (c.x - (m.W - 1) / 2) * CELL;
      const wz = (c.y - (m.H - 1) / 2) * CELL;
      return new THREE.Vector3(wx, (up == null ? 0 : up), wz);
    }
    cellTop(c) { return c.platform ? 1.05 : 0.32; }
    cellCenter(c, h) {
      const p = this.cellPos(c, this.cellTop(c) + (h == null ? 0 : h));
      return p;
    }

    _buildBoard() {
      const m = this.map;
      const w = m.W * CELL, h = m.H * CELL;
      const tex = M.plateTexture();
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 6);
      const topMat = new THREE.MeshStandardMaterial({
        color: { segment: 0x08141c, backbone: 0x0e0a18, airgap: 0x121308 }[this.def.id] || 0x0b1a24, roughness: 0.78, metalness: 0.45, map: tex, emissive: this.theme.roadEdge, emissiveIntensity: 0.018
      });
      const shape = new THREE.Shape();
      const r = 3.2, hw = w / 2 + 1.2, hh = h / 2 + 1.2;
      shape.moveTo(-hw + r, -hh); shape.lineTo(hw - r, -hh); shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
      shape.lineTo(hw, hh - r); shape.quadraticCurveTo(hw, hh, hw - r, hh);
      shape.lineTo(-hw + r, hh); shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
      shape.lineTo(-hw, -hh + r); shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.5, bevelSegments: 2, curveSegments: 6 });
      geo.rotateX(-Math.PI / 2);
      const base = new THREE.Mesh(geo, topMat);
      base.position.y = -1.98;
      base.receiveShadow = true; base.castShadow = true;
      this.mapGroup.add(base);
      // underside
      const under = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.16, 7, 7, 1), new THREE.MeshStandardMaterial({ color: 0x050a0e, roughness: 0.8, metalness: 0.4 }));
      under.position.y = -5.2; under.rotation.y = 0.4; this.mapGroup.add(under);
      // glowing rim
      const rimPts = [];
      for (let i = 0; i <= 64; i++) {
        const a = i / 64 * Math.PI * 2;
        rimPts.push(new THREE.Vector3(Math.cos(a) * (hw + 0.1), 0.35, Math.sin(a) * (hh + 0.1)));
      }
      const rim = new THREE.Line(new THREE.BufferGeometry().setFromPoints(rimPts), new THREE.LineBasicMaterial({ color: this.theme.roadEdge, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
      this.mapGroup.add(rim);
      // corner marker posts
      for (let i = 0; i < 4; i++) {
        const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x24323c, metalness: 0.8, roughness: 0.3 }));
        post.position.set(sx * (hw - 1), 1.0, sz * (hh - 1)); post.castShadow = true; this.mapGroup.add(post);
        const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: this.theme.roadEdge }));
        tip.position.set(sx * (hw - 1), 2.8, sz * (hh - 1)); this.mapGroup.add(tip);
        this.effects.flash(tip.position, this.theme.roadEdge, 1.5, 99);
      }
      this.board = base;
    }

    _buildRoads() {
      const m = this.map;
      const roadCells = m.cells.filter(c => c.walk && !c.platform);
      const links = roadCells.filter(c => !c.old);
      const olds = roadCells.filter(c => c.old);
      const palettes = {
        segment: { base: '#163845', line: 'rgba(110,245,235,.42)' },
        backbone: { base: '#251d3e', line: 'rgba(175,140,255,.44)' },
        airgap: { base: '#2a2d17', line: 'rgba(218,236,120,.42)' }
      };
      const pal = palettes[this.def.id] || palettes.segment;
      const roadTex = M.roadTexture(pal.base, pal.line);
      roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
      const mat = new THREE.MeshStandardMaterial({
        color: 0xd8f0f2, map: roadTex, roughness: 0.38, metalness: 0.42,
        emissive: 0xffffff, emissiveMap: roadTex, emissiveIntensity: 0.22, vertexColors: false
      });
      const geo = new THREE.BoxGeometry(CELL * 0.94, 0.55, CELL * 0.94);
      const makeInst = (cells, old) => {
        const im = new THREE.InstancedMesh(geo, mat, cells.length);
        im.castShadow = true; im.receiveShadow = true;
        const dummy = new THREE.Object3D(); const col = new THREE.Color();
        cells.forEach((c, i) => {
          dummy.position.copy(this.cellPos(c, 0.02)); dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
          let base = this.theme.zone[c.zone] || this.theme.road;
          if (old) base = this.theme.zone.old;
          col.setHex(base).lerp(new THREE.Color(0xffffff), old ? 0.02 : 0.16);
          if (!old && (c.type === 'entrance' || c.type === 'exit' || c.type === 'switch')) col.setHex(this.theme.road).lerp(new THREE.Color(this.theme.roadEdge), 0.35);
          im.setColorAt(i, col);
        });
        im.instanceColor.needsUpdate = true;
        this.mapGroup.add(im);
        return im;
      };
      this.roadInst = makeInst(links, false);
      if (olds.length) { this.oldInst = makeInst(olds, true); }
      // old link decay strips
      olds.forEach(c => {
        const p = this.cellPos(c, 0.34);
        for (let i = 0; i < 2; i++) {
          const s = new THREE.Mesh(new THREE.BoxGeometry(CELL * (0.5 + Math.random() * 0.3), 0.03, 0.12), new THREE.MeshBasicMaterial({ color: 0xff8c5a, transparent: true, opacity: 0.35 }));
          s.position.copy(p); s.position.x += (Math.random() - 0.5) * 2; s.position.z += (Math.random() - 0.5) * 2;
          s.rotation.y = Math.random() * Math.PI; this.mapGroup.add(s);
        }
      });
      // edge trims: along borders of walkable tiles
      const trims = [];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const c of roadCells) {
        for (const [dx, dy] of dirs) {
          const n = m.byKey[(c.x + dx) + ',' + (c.y + dy)];
          if (n && n.walk) continue;
          trims.push({ c, dx, dy });
        }
      }
      const tGeo = new THREE.BoxGeometry(CELL * 0.94, 0.09, 0.1);
      const tMat = new THREE.MeshBasicMaterial({ color: this.theme.roadEdge, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false });
      const tim = new THREE.InstancedMesh(tGeo, tMat, trims.length * 2);
      const dummy = new THREE.Object3D();
      trims.forEach((t, i) => {
        for (let k = 0; k < 2; k++) {
          const idx = i * 2 + k;
          const p = this.cellPos(t.c, 0.30);
          if (t.dx !== 0) {
            p.x += t.dx * CELL * 0.47; p.z += (k ? 1 : -1) * CELL * 0.47;
            dummy.rotation.y = Math.PI / 2;
          } else {
            p.z += t.dy * CELL * 0.47; p.x += (k ? 1 : -1) * CELL * 0.47;
            dummy.rotation.y = 0;
          }
          dummy.position.copy(p); dummy.scale.set(0.55, 1, 1); dummy.updateMatrix();
          tim.setMatrixAt(idx, dummy.matrix);
        }
      });
      tim.frustumCulled = false;
      this.mapGroup.add(tim);
      this.trimMat = tMat;
    }

    _buildPlatforms() {
      const m = this.map;
      const plats = m.cells.filter(c => c.platform);
      const baseMat = new THREE.MeshStandardMaterial({ color: this.theme.plat, roughness: 0.4, metalness: 0.8 });
      const edgeMat = new THREE.MeshBasicMaterial({ color: this.theme.roadEdge, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
      this.platformMeshes = [];
      plats.forEach((c, i) => {
        const g = new THREE.Group();
        const top = this.cellCenter(c);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.42, CELL * 0.34, 0.75, 8), baseMat);
        base.position.copy(top); base.position.y -= 0.22; base.castShadow = true; base.receiveShadow = true; g.add(base);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(CELL * 0.4, 0.07, 6, 8), edgeMat);
        ring.position.copy(top); ring.position.y += 0.19; ring.rotation.x = Math.PI / 2; g.add(ring);
        for (let k = 0; k < 4; k++) {
          const a = k / 4 * Math.PI * 2 + Math.PI / 4;
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 5), baseMat);
          post.position.set(top.x + Math.cos(a) * CELL * 0.32, top.y + 0.3, top.z + Math.sin(a) * CELL * 0.32);
          g.add(post);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshBasicMaterial({ color: this.theme.roadEdge }));
          tip.position.copy(post.position); tip.position.y += 0.3; g.add(tip);
        }
        // hologram slot marker
        const slot = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.02, 32), new THREE.MeshBasicMaterial({ color: this.theme.roadEdge, transparent: true, opacity: 0.3, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
        slot.rotation.x = -Math.PI / 2; slot.position.copy(top); slot.position.y += 0.33; g.add(slot); c.slotMarker = slot;
        this.mapGroup.add(g);
        this.platformMeshes.push({ cell: c, group: g, ring, slot });
      });
    }

    _buildSwitches() {
      this.switches = [];
      const m = this.map;
      m.switches.forEach((s, i) => {
        const g = new THREE.Group();
        const p = this.cellPos(s.cell, 0.36);
        g.position.copy(p);
        const coreMat = new THREE.MeshStandardMaterial({ color: 0x142229, emissive: 0x1de9c0, emissiveIntensity: 1.2, metalness: 0.7, roughness: 0.3 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.85, 0.28, 6), new THREE.MeshStandardMaterial({ color: 0x1a2b34, metalness: 0.8, roughness: 0.4 }));
        base.position.y = 0.12; base.receiveShadow = true; g.add(base);
        const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.9, 0.55, 6), coreMat);
        hex.position.y = 0.55; hex.castShadow = true; g.add(hex);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0x0e1a20, emissive: 0x1de9c0, emissiveIntensity: 1.8 }));
        cap.position.y = 0.88; g.add(cap);
        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0x3ef0c8, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
        ring1.rotation.x = Math.PI / 2; ring1.position.y = 0.32; g.add(ring1);
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.035, 6, 6), new THREE.MeshBasicMaterial({ color: 0x9dfff0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
        ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.32; g.add(ring2);
        const field = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 4.6, 16, 1, true), new THREE.MeshBasicMaterial({
          color: 0xffb457, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        field.position.y = 2.6; g.add(field);
        const label = M.labelSprite(s.name, { fontSize: 34, color: '#b8fff0', scale: 0.62, bg: 'rgba(3,16,18,.72)' });
        label.position.set(0, 3.1, 0); g.add(label);
        this.mapGroup.add(g);
        const view = { def: s, cell: s.cell, group: g, hex, cap, ring1, ring2, field, label, coreMat, isolated: false, hit: 0 };
        s.cell.node = view;
        this.switchViews.set(s.id, view);
        this.switches.push(view);
      });
    }

    _buildGates() {
      this.gateViews = {};
      const m = this.map;
      m.entrances.forEach((e, i) => {
        const g = new THREE.Group();
        const p = this.cellPos(e.cell, 0.25);
        g.position.copy(p);
        const angle = Math.atan2(e.dir[0], e.dir[1]);
        g.rotation.y = angle;
        g.scale.setScalar(1.3);
        const col = new THREE.Color(e.color);
        const metal = new THREE.MeshStandardMaterial({ color: 0x1a2a33, metalness: 0.85, roughness: 0.35 });
        const glow = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
        for (const s of [-1, 1]) {
          const pil = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.2, 0.55), metal);
          pil.position.set(s * 2.1, 2.5, 0); pil.castShadow = true; g.add(pil);
          const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.2, 0.72), glow);
          strip.position.set(s * 2.1, 2.2, 0.05); g.add(strip);
          const top = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 4), glow);
          top.position.set(s * 2.1, 5.3, 0); g.add(top);
        }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.4, 0.6), metal);
        beam.position.set(0, 5.0, 0); g.add(beam);
        const beamGlow = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.09, 0.1), glow);
        beamGlow.position.set(0, 4.8, 0.35); g.add(beamGlow);
        const portal = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.4, 1, 1), new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.14, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        portal.position.set(0, 2.6, 0); g.add(portal);
        const label = M.labelSprite('入口 ' + e.id + ' · ' + e.name, { fontSize: 34, color: e.color, scale: 0.72, bg: 'rgba(3,12,16,.72)' });
        label.position.set(0, 6.5, 0); g.add(label);
        this.mapGroup.add(g);
        this.gateViews[e.id] = { group: g, portal, label, def: e, color: col };
        // entry pad glow
        const pad = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
        pad.rotation.x = -Math.PI / 2; pad.position.set(p.x, 0.36, p.z); this.mapGroup.add(pad);
        this.gateViews[e.id].pad = pad;
      });
      m.exits.forEach((x, i) => {
        const g = new THREE.Group();
        const p = this.cellPos(x.cell, 0.25); g.position.copy(p);
        g.scale.setScalar(1.35);
        const col = new THREE.Color(x.color);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x0d1a23, metalness: 0.85, roughness: 0.35 });
        const darkSteel = new THREE.MeshStandardMaterial({ color: 0x1b2a34, metalness: 0.9, roughness: 0.3 });
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.2, 0.55, 8), baseMat);
        disc.position.y = 0.28; disc.receiveShadow = true; g.add(disc);
        const disc2 = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.12, 8), darkSteel);
        disc2.position.y = 0.6; g.add(disc2);
        // containment pylons
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * Math.PI * 2 + 0.2;
          const pil = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.6, 0.36), darkSteel);
          pil.position.set(Math.cos(a) * 2.55, 2.6, Math.sin(a) * 2.55);
          pil.rotation.y = -a; g.add(pil);
          const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.3, 0.06), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
          strip.position.set(Math.cos(a) * 2.55, 2.5, Math.sin(a) * 2.55); g.add(strip);
        }
        const rim = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.045, 5, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
        rim.rotation.x = Math.PI / 2; rim.position.y = 4.85; g.add(rim);
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), new THREE.MeshStandardMaterial({
          color: 0x07141c, emissive: col, emissiveIntensity: 0.78, metalness: 0.55, roughness: 0.18, transparent: true, opacity: 0.95
        }));
        core.position.y = 2.7; g.add(core);
        const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
        inner.position.y = 2.7; g.add(inner);
        const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 1), new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.28 }));
        wire.position.y = 2.7; g.add(wire);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.07, 6, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 1.15; g.add(ring);
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
        ring2.rotation.x = 1.2; ring2.position.y = 2.7; g.add(ring2);
        const shards = [];
        for (let k = 0; k < 5; k++) {
          const a = k / 5 * Math.PI * 2;
          const sh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
          sh.position.set(Math.cos(a) * 2.1, 2.7 + Math.sin(a * 2) * 0.5, Math.sin(a) * 2.1);
          g.add(sh); shards.push({ mesh: sh, a, r: 2.1, y: 2.7 + Math.sin(a * 2) * 0.5 });
        }
        const label = M.labelSprite('出口 ' + x.id + ' · ' + x.name, { fontSize: 34, color: x.color, scale: 0.74, bg: 'rgba(3,12,16,.72)' });
        label.position.set(0, 6.4, 0); g.add(label);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 2.2, 18, 18, 1, true), new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.045, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        beam.position.y = 9.5; g.add(beam);
        const light = new THREE.PointLight(col, 0.65, 26, 1.7);
        light.position.y = 3.2; g.add(light);
        this.mapGroup.add(g);
        this.gateViews[x.id] = { group: g, core, inner, wire, ring, ring2, shards, def: x, color: col, beam };
      });
    }

    _buildProps() {
      const m = this.map;
      const rng = mulberry32(m.W * 91 + m.H * 13 + (this.def.id === 'segment' ? 3 : this.def.id === 'backbone' ? 7 : 11));
      const cells = m.cells.filter(c => !c.walk && !c.platform);
      // pick near-road cells
      const near = cells.filter(c => {
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        return nb.some(([dx, dy]) => { const n = m.byKey[(c.x + dx) + ',' + (c.y + dy)]; return n && (n.walk || n.platform); });
      });
      shuffle(near, rng);
      const count = Math.min(near.length, this.def.id === 'airgap' ? 16 : 22);
      this.props = [];
      for (let i = 0; i < count; i++) {
        const c = near[i];
        const p = this.cellPos(c, 0);
        const kind = Math.floor(rng() * 4);
        const g = new THREE.Group(); g.position.copy(p);
        const col = this.theme.zone[c.zone] || this.theme.road;
        if (this.def.id === 'airgap' && c.x > 4 && c.x < 12 && c.y > 3 && c.y < 11) continue;
        this._propFor(kind, g, col, rng);
        g.rotation.y = rng() * Math.PI * 2;
        this.mapGroup.add(g);
        this.props.push(g);
      }
      // airgap special: dark central block + hazard
      if (this.def.id === 'airgap') {
        const cx = this.cellPos({ x: 8, y: 7 }, 0);
        const block = new THREE.Mesh(new THREE.BoxGeometry(CELL * 7.4, 3.4, CELL * 6.6), new THREE.MeshStandardMaterial({ color: 0x040604, metalness: 0.55, roughness: 0.85 }));
        block.position.set(cx.x, -2.2, cx.z); block.receiveShadow = true; this.mapGroup.add(block);
        const hz = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 7.2, CELL * 6.4), new THREE.MeshBasicMaterial({
          map: M.canvasTex(512, 512, (g2) => {
            g2.fillStyle = '#0a0c06'; g2.fillRect(0, 0, 512, 512);
            g2.strokeStyle = 'rgba(200,255,80,.28)'; g2.lineWidth = 2;
            for (let k = -512; k < 1024; k += 34) { g2.beginPath(); g2.moveTo(k, 0); g2.lineTo(k + 512, 512); g2.stroke(); }
            g2.strokeStyle = 'rgba(255,214,80,.5)'; g2.lineWidth = 8;
            for (let k = -512; k < 1024; k += 86) { g2.beginPath(); g2.moveTo(k, 0); g2.lineTo(k + 512, 512); g2.stroke(); }
            g2.strokeStyle = 'rgba(255,220,90,.7)'; g2.lineWidth = 5; g2.strokeRect(3, 3, 506, 506);
          }), transparent: true, opacity: 0.64
        }));
        hz.rotation.x = -Math.PI / 2; hz.position.set(cx.x, -0.035, cx.z); this.mapGroup.add(hz);
        // hazard edge frame
        const frameMat = new THREE.MeshBasicMaterial({ color: 0xffd257, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
        const hw = CELL * 3.7, hh = CELL * 3.3;
        for (const [ax, az, len, rot] of [[0, -hh, hw * 2, 0], [0, hh, hw * 2, 0], [-hw, 0, hh * 2, Math.PI / 2], [hw, 0, hh * 2, Math.PI / 2]]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.14), frameMat);
          bar.position.set(cx.x + ax, 0.3, cx.z + az); bar.rotation.y = rot; this.mapGroup.add(bar);
        }
        // deep glow + warning beacons
        const pitGlow = new THREE.PointLight(0xffb34a, 1.3, 44, 1.6);
        pitGlow.position.set(cx.x, -1.0, cx.z); this.mapGroup.add(pitGlow);
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2;
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.4, 5), new THREE.MeshStandardMaterial({ color: 0x2a2a18, metalness: 0.7 }));
          pole.position.set(cx.x + Math.cos(a) * CELL * 3.85, 0.8, cx.z + Math.sin(a) * CELL * 3.45); this.mapGroup.add(pole);
          const lp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd257 }));
          lp.position.copy(pole.position); lp.position.y += 1.25; this.mapGroup.add(lp);
        }
        // containment arcs
        for (let i = 0; i < 3; i++) {
          const arc = new THREE.Mesh(new THREE.TorusGeometry(CELL * 3.0, 0.05, 5, 64, Math.PI), new THREE.MeshBasicMaterial({
            color: 0xd7f56a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false
          }));
          arc.rotation.set(0, i * Math.PI / 3, 0); arc.position.set(cx.x, 0.1, cx.z); this.mapGroup.add(arc);
        }
        const pitLabel = M.labelSprite('气隙 / AIR GAP · 物理隔离', { fontSize: 34, plain: true, color: '#e7ff9a', opacity: 0.52, scale: 1.4 });
        pitLabel.position.set(cx.x, 3.6, cx.z); this.mapGroup.add(pitLabel);
      }
      // public flow for backbone
      if (this.def.id === 'backbone') {
        const y = 6.5;
        const pos = this.cellPos({ x: 0, y }, 0);
        const mat = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xb08cff) } },
          vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
          fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
            float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);}
            void main(){ vec2 p=vUv*vec2(26.0,2.0); p.x-=uTime*1.8; float s=step(0.38,h(floor(p*vec2(2.0,1.0))));
              float line=smoothstep(0.46,0.5,abs(fract(vUv.y*2.0)-0.5))*0.7;
              float a=(0.38*s+0.12)*smoothstep(0.0,0.12,vUv.x)*smoothstep(1.0,0.88,vUv.x);
              gl_FragColor=vec4(uColor*(1.3+s),min(0.75,a+line*0.35));}`
        });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(m.W * CELL + 8, CELL * 3.1), mat);
        plane.rotation.x = -Math.PI / 2; plane.position.set(0, 0.02, pos.z);
        this.mapGroup.add(plane);
        this.publicFlow = { plane, mat };
        // moving packets
        const pGeo = new THREE.BufferGeometry();
        const arr = new Float32Array(60 * 3);
        for (let i = 0; i < 60; i++) { arr[i * 3] = (Math.random() - 0.5) * m.W * CELL; arr[i * 3 + 1] = 0.3; arr[i * 3 + 2] = pos.z + (Math.random() - 0.5) * CELL * 2.6; }
        pGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xe0c8ff, size: 0.55, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        pts.position.y = 0.35;
        this.mapGroup.add(pts); this.publicFlow.points = pts;
        // crossing tunnels above the public flow
        [4, 8, 13].forEach((bx) => {
          const cp = this.cellPos({ x: bx, y: 6.5 }, 0);
          const tg = new THREE.Group(); tg.position.set(cp.x, 0, cp.z);
          const steel = new THREE.MeshStandardMaterial({ color: 0x2a2344, metalness: 0.85, roughness: 0.35 });
          const glow = new THREE.MeshBasicMaterial({ color: 0xb08cff, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false });
          for (const sz of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.0, 0.55), steel);
            post.position.set(0, 2.5, sz * CELL * 1.15); post.castShadow = true; tg.add(post);
            const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.0, 0.62), glow);
            strip.position.set(0.3, 2.4, sz * CELL * 1.15); tg.add(strip);
          }
          const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, CELL * 2.7), steel);
          top.position.y = 5.1; tg.add(top);
          const topGlow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, CELL * 2.3), glow);
          topGlow.position.set(0.38, 5.0, 0); tg.add(topGlow);
          const arch = new THREE.Mesh(new THREE.TorusGeometry(CELL * 1.25, 0.05, 5, 24, Math.PI), glow);
          arch.rotation.y = Math.PI / 2; arch.position.y = 4.9; tg.add(arch);
          this.mapGroup.add(tg);
        });
        const flowLabel = M.labelSprite('公网流 / PUBLIC FLOW', { fontSize: 34, plain: true, color: '#d8c6ff', opacity: 0.55, scale: 1.3 });
        flowLabel.position.set(-8, 4.2, pos.z);
        this.mapGroup.add(flowLabel);
      }
    }
    _propFor(kind, g, col, rng) {
      const metal = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.6), metalness: 0.75, roughness: 0.45 });
      const glow = new THREE.MeshBasicMaterial({ color: this.theme.roadEdge, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending });
      if (kind === 0) {
        for (let i = 0; i < 3; i++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4 + i * 0.5, 1.8), metal);
          b.position.set((i - 1) * 2.7, 0.7, (rng() - 0.5) * 1.2); b.castShadow = true; g.add(b);
          for (let k = 0; k < 4; k++) {
            const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.08), glow);
            led.position.set(b.position.x - 0.8 + k * 0.5, 1.0 + (k % 2) * 0.4, b.position.z + 0.92); g.add(led);
          }
        }
      } else if (kind === 1) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 6, 6), metal);
        mast.position.y = 3; mast.castShadow = true; g.add(mast);
        for (let i = 0; i < 3; i++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7 + i * 0.35, 0.04, 5, 20), glow);
          ring.rotation.x = Math.PI / 2; ring.position.y = 2.2 + i * 1.2; g.add(ring);
        }
        const dish = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal);
        dish.scale.y = 0.4; dish.position.set(0.5, 4.2, 0); dish.rotation.z = 0.7; g.add(dish);
      } else if (kind === 2) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 5, 8), metal);
        pipe.rotation.z = Math.PI / 2; pipe.position.y = 0.7; pipe.castShadow = true; g.add(pipe);
        const pipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 3.4, 8), metal);
        pipe2.position.set(-1.2, 1.4, 0.8); g.add(pipe2);
        const valve = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 6, 14), glow);
        valve.position.set(1.0, 1.0, 0); valve.rotation.x = Math.PI / 2; g.add(valve);
        const glowPipe = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.05, 0.06), glow);
        glowPipe.position.set(0, 1.05, 0.4); g.add(glowPipe);
      } else {
        const obelisk = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.8, 4), new THREE.MeshStandardMaterial({
          color: new THREE.Color(col).multiplyScalar(0.5), emissive: this.theme.roadEdge, emissiveIntensity: 0.25, metalness: 0.8, roughness: 0.25
        }));
        obelisk.position.y = 2.4; obelisk.rotation.y = Math.PI / 4; obelisk.castShadow = true; g.add(obelisk);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.04, 5, 18), glow);
        ring.rotation.x = Math.PI / 2; ring.position.y = 1.1; g.add(ring);
      }
    }

    _buildZoneMarkers() {
      const zoneNames = {
        segment: { dmz: 'DMZ / 隔离区', office: '办公网段 / OFFICE', business: '业务网段 / BUSINESS', core: '核心数据库 / CORE', dr: '灾备环' },
        backbone: { dmz: '骨干接入 / BACKBONE', business: '公网流 / PUBLIC FLOW', core: '双活数据中心 / DUAL DC' },
        airgap: { dmz: '接入层 / ACCESS', business: '气隙 · 运维环 / AIRGAP', core: '工控核心 / ICS CORE' }
      };
      const names = zoneNames[this.def.id] || {};
      const ids = new Set();
      (this.map.def.zones || []).forEach(z => {
        if (ids.has(z.id)) return;
        ids.add(z.id);
        const x1 = (z.x1 - 0.48 - (this.map.W - 1) / 2) * CELL;
        const x2 = (z.x2 + 0.48 - (this.map.W - 1) / 2) * CELL;
        const z1 = (z.y1 - 0.48 - (this.map.H - 1) / 2) * CELL;
        const z2 = (z.y2 + 0.48 - (this.map.H - 1) / 2) * CELL;
        const y = 0.36;
        const pts = [
          new THREE.Vector3(x1, y, z1), new THREE.Vector3(x2, y, z1),
          new THREE.Vector3(x2, y, z2), new THREE.Vector3(x1, y, z2)
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
          color: this.theme.roadEdge, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.mapGroup.add(line);
        // corner ticks
        const tickMat = new THREE.LineBasicMaterial({ color: this.theme.roadEdge, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending });
        for (const [px, pz, dx, dz] of [[x1, z1, 1, 1], [x2, z1, -1, 1], [x2, z2, -1, -1], [x1, z2, 1, -1]]) {
          const g2 = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(px, y + 0.02, pz), new THREE.Vector3(px + dx * 5, y + 0.02, pz),
            new THREE.Vector3(px, y + 0.02, pz), new THREE.Vector3(px, y + 0.02, pz + dz * 5)
          ]);
          this.mapGroup.add(new THREE.LineSegments(g2, tickMat));
        }
        if (names[z.id]) {
          const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
          const lbl = M.labelSprite(names[z.id], {
            fontSize: 40, color: this.def.theme.accent, plain: true, opacity: 0.46, scale: 1.8
          });
          lbl.position.set(cx, 1.9, cz);
          this.mapGroup.add(lbl);
        }
      });
      // sweeping scan ring
      const scan = new THREE.Mesh(new THREE.RingGeometry(CELL * 2.2, CELL * 2.32, 96), new THREE.MeshBasicMaterial({
        color: this.theme.roadEdge, transparent: true, opacity: 0.10, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      scan.rotation.x = -Math.PI / 2; scan.position.y = 0.42;
      this.mapGroup.add(scan);
      this.scanRing = scan;
    }

    _buildCity() {
      const rng = global.TDUTIL.mulberry32(this.map.W * 77 + this.map.H * 31 + this.def.id.length * 17);
      const spots = {
        segment: [[1, 1], [17, 1], [1, 13], [17, 13], [3, 13], [15, 13], [7, 1], [11, 1], [15, 10], [3, 6]],
        backbone: [[9, 1], [1, 6], [16, 6], [8, 13], [1, 13], [16, 13], [2, 9], [15, 2], [6, 6], [11, 6]],
        airgap: [[8, 13], [8, 1], [2, 7], [14, 2], [2, 5], [14, 9], [8, 4], [8, 10], [6, 2], [10, 12]]
      }[this.def.id] || [];
      const used = [];
      const glows = [0x2ee6cf, 0xffcf6e, 0x8b7bff, 0xff7cd8];
      spots.forEach(([x, y], idx) => {
        const c = this.map.byKey[x + ',' + y];
        if (!c || c.walk || c.platform) return;
        const p = this.cellPos(c, 0);
        const g = new THREE.Group(); g.position.copy(p);
        const h = 7 + rng() * 11 + (idx % 3) * 2.2;
        const metal = new THREE.MeshStandardMaterial({ color: 0x101d26, roughness: 0.4, metalness: 0.86 });
        const accent = glows[idx % glows.length];
        const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.6, 1.1, 6), metal);
        base.position.y = 0.4; base.receiveShadow = true; base.castShadow = true; g.add(base);
        const segs = 3 + Math.floor(rng() * 3);
        let yy = 1.0;
        for (let i = 0; i < segs; i++) {
          const sh = h / segs * (0.72 + rng() * 0.3);
          const r = 1.6 - i * 0.18;
          const b = new THREE.Mesh(new THREE.BoxGeometry(r * 2, sh, r * 2), metal);
          b.position.y = yy + sh / 2; b.rotation.y = i * 0.35 + rng(); b.castShadow = true; g.add(b);
          const band = new THREE.Mesh(new THREE.BoxGeometry(r * 2 + 0.06, 0.09, r * 2 + 0.06), glow);
          band.position.y = yy + sh * 0.82; g.add(band);
          yy += sh;
        }
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 3.4, 5), metal);
        mast.position.y = yy + 1.7; g.add(mast);
        const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), new THREE.MeshBasicMaterial({ color: accent }));
        beacon.position.y = yy + 3.5; g.add(beacon);
        const halo = M.glowSprite(accent, 4.2, 0.35); halo.position.y = yy + 3.5; g.add(halo);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.035, 5, 24), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 2.6; g.add(ring);
        g.userData.beacon = beacon; g.userData.ring = ring; g.userData.h = yy + 3.5;
        this.mapGroup.add(g);
        used.push({ group: g, pos: p.clone().add(new THREE.Vector3(0, yy + 2, 0)), color: accent });
      });
      // suspension cables between adjacent towers
      for (let i = 0; i < used.length - 1; i++) {
        const a = used[i], b = used[i + 1];
        if (a.pos.distanceTo(b.pos) > 52) continue;
        const mid = a.pos.clone().lerp(b.pos, 0.5); mid.y = Math.max(a.pos.y, b.pos.y) * 0.7 - 3;
        const curve = new THREE.QuadraticBezierCurve3(a.pos.clone(), mid, b.pos.clone());
        const pts = curve.getPoints(22);
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        this.mapGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: a.color, transparent: true, opacity: 0.16 })));
      }
      // floating data cubes
      for (let i = 0; i < 16; i++) {
        const a = rng() * Math.PI * 2;
        const r = 18 + rng() * 38;
        const cube = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({
          color: glows[i % glows.length], transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, wireframe: true
        }));
        cube.position.set(Math.cos(a) * r, 3 + rng() * 14, Math.sin(a) * r);
        cube.userData.spin = 0.2 + rng();
        cube.userData.baseY = cube.position.y;
        this.mapGroup.add(cube);
        if (!this.floatCubes) this.floatCubes = [];
        this.floatCubes.push(cube);
      }
      // decorative point lights
      if (used[0]) {
        const l = new THREE.PointLight(used[0].color, 0.8, 55, 1.6);
        l.position.copy(used[0].group.position).add(new THREE.Vector3(0, 8, 0));
        this.mapGroup.add(l);
      }
      if (used[1]) {
        const l2 = new THREE.PointLight(used[1].color, 0.6, 50, 1.6);
        l2.position.copy(used[1].group.position).add(new THREE.Vector3(0, 7, 0));
        this.mapGroup.add(l2);
      }
      this.citySpires = used;
    }

    _buildLabels() {
      this.switchLabels = [];
      this.switches.forEach(v => this.switchLabels.push(v.label));
    }

    /* ---------------- routes ---------------- */
    _buildRoutes() {
      if (this.routesGroup) { this.mapGroup.remove(this.routesGroup); disposeGroup(this.routesGroup); }
      this.routesGroup = new THREE.Group(); this.mapGroup.add(this.routesGroup);
      this.routeViews = {};
      this._routeSig = null;
      this.previewGroup = new THREE.Group(); this.mapGroup.add(this.previewGroup);
    }

    _routeStrip(points, color, opts) {
      opts = opts || {};
      const width = opts.width || 0.72;
      const verts = [], uvs = [], indices = [];
      let dist = 0;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        let dir;
        if (i === 0) dir = new THREE.Vector3().subVectors(points[1], p);
        else if (i === points.length - 1) dir = new THREE.Vector3().subVectors(p, points[i - 1]);
        else dir = new THREE.Vector3().subVectors(points[i + 1], points[i - 1]);
        dir.y = 0; dir.normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        if (i > 0) dist += points[i].distanceTo(points[i - 1]);
        for (let k = -1; k <= 1; k += 2) {
          const v = p.clone().addScaledVector(side, width * 0.5 * k + (opts.offset || 0));
          v.y = p.y;
          verts.push(v.x, v.y, v.z);
          uvs.push(k < 0 ? 0 : 1, dist / 4);
        }
        if (i < points.length - 1) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending,
        uniforms: {
          uTime: { value: 0 }, uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opts.opacity == null ? 0.62 : opts.opacity },
          uSpeed: { value: opts.speed == null ? 1.2 : opts.speed },
          uPreview: { value: opts.preview ? 1 : 0 }
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uTime,uOpacity,uSpeed,uPreview; varying vec2 vUv;
          void main(){
            float across=abs(vUv.x-0.5)*2.0;
            float edge=smoothstep(1.0,0.72,across);
            float d=fract(vUv.y*0.62-uTime*uSpeed);
            float chev=smoothstep(0.0,0.06,d)*smoothstep(0.42,0.14,d);
            float base=(0.34+chev*0.5)*edge;
            vec3 c=uColor*(0.9+chev*0.8);
            float a=base*uOpacity;
            if(uPreview>0.5){ float dash=step(0.40,fract(vUv.y*0.7+uTime*0.35)); a=(0.30+0.62*edge)*dash*uOpacity; c=uColor*1.1+vec3(0.82); }
            gl_FragColor=vec4(c,a);
          }`
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = opts.preview ? 8 : 3;
      if (opts.preview) { mat.depthTest = false; mat.depthWrite = false; }
      return mesh;
    }

    setRoutes(routes) {
      // routes: [{id,color,cells,exitId}] ; rebuild only if changed signature
      const sig = routes.map(r => r.id + ':' + r.cells.map(c => c.x + ',' + c.y).join('.')).join('|');
      if (this._routeSig === sig) return;
      this._routeSig = sig;
      for (const k in this.routeViews) {
        const rv = this.routeViews[k];
        this.mapGroup.remove(rv.mesh); disposeMesh(rv.mesh);
        if (rv.line) { this.mapGroup.remove(rv.line); rv.line.geometry.dispose(); rv.line.material.dispose(); }
        if (rv.mks) rv.mks.forEach(m => { this.mapGroup.remove(m); disposeGroup(m); });
      }
      this.routeViews = {};
      routes.forEach((r, idx) => {
        if (!r.cells || r.cells.length < 2) return;
        const off = (idx - (routes.length - 1) / 2) * 0.4;
        const raw = r.cells.map(c => this.cellPos(c, 0.58));
        const pts = raw.map((p, i) => {
          let dir;
          if (i === 0) dir = new THREE.Vector3().subVectors(raw[1], p);
          else if (i === raw.length - 1) dir = new THREE.Vector3().subVectors(p, raw[i - 1]);
          else dir = new THREE.Vector3().subVectors(raw[i + 1], raw[i - 1]);
          dir.y = 0; dir.normalize();
          return p.clone().add(new THREE.Vector3(-dir.z * off, 0, dir.x * off));
        });
        const mesh = this._routeStrip(pts, r.color, { opacity: 0.72, width: 0.82 });
        this.mapGroup.add(mesh);
        // crisp colored line for route identity
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => p.clone().setY(p.y + 0.03))),
          new THREE.LineBasicMaterial({ color: r.color, transparent: true, opacity: 0.7, depthWrite: false }));
        this.mapGroup.add(line);
        // moving flat chevrons (clear direction without 3D cones)
        const mks = [];
        for (let k = 0; k < 3; k++) {
          const m = new THREE.Group();
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute([
            -0.62, 0, -0.45, 0.62, 0, -0.45, 0, 0, 0.72
          ], 3));
          geo.computeVertexNormals();
          const arrow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color: r.color, transparent: true, opacity: 0.96, side: THREE.DoubleSide, depthWrite: false
          }));
          m.add(arrow);
          const glow = M.glowSprite(r.color, 1.15, 0.18); glow.position.y = 0.06; m.add(glow);
          m.scale.setScalar(1.05);
          this.mapGroup.add(m); mks.push(m);
        }
        // cumulative lengths
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
        this.routeViews[r.id] = { mesh, line, mat: mesh.material, color: r.color, cells: r.cells, entrance: r.id, exit: r.exitId, pts, cum, len: cum[cum.length - 1], mks };
      });
      this._routeIndex = {};
    }

    setPreviewRoutes(previews) {
      if (this.previewGroup) { this.mapGroup.remove(this.previewGroup); disposeGroup(this.previewGroup); }
      this.previewGroup = new THREE.Group(); this.mapGroup.add(this.previewGroup);
      if (!previews || !previews.length) return;
      previews.forEach((r, idx) => {
        if (!r.cells || r.cells.length < 2) return;
        const pts = r.cells.map(c => this.cellPos(c, 0.7));
        const mesh = this._routeStrip(pts, r.color || '#ffffff', { preview: true, offset: (idx - (previews.length - 1) / 2) * 0.5, opacity: 0.95, width: 1.5 });
        this.previewGroup.add(mesh);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => p.clone().setY(p.y + 0.04))), new THREE.LineBasicMaterial({ color: 0xfff4cf, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
        line.renderOrder = 9; this.previewGroup.add(line);
        if (idx === 0) {
          const lbl = M.labelSprite('预览路线 → ' + (r.exitId || ''), { fontSize: 32, color: '#fff4cf', scale: 0.62, bg: 'rgba(24,18,5,.78)' });
          const ep = pts[pts.length - 1]; lbl.position.set(ep.x, ep.y + 2.4, ep.z); this.previewGroup.add(lbl);
        }
      });
    }

    /* ---------------- camera ---------------- */
    _setupCamera() {
      const m = this.map;
      const w = m.W * CELL, h = m.H * CELL;
      const d = Math.max(w, h) * 1.62;
      this.camGoal.target.set(0, 0, 0);
      this.camGoal.yaw = -0.5;
      this.camGoal.pitch = 1.03;
      this.camGoal.dist = d;
      this.cam.target.copy(this.camGoal.target);
      this.cam.yaw = this.camGoal.yaw; this.cam.pitch = this.camGoal.pitch; this.cam.dist = this.camGoal.dist;
      this.defaultCam = { target: this.camGoal.target.clone(), yaw: this.camGoal.yaw, pitch: this.camGoal.pitch, dist: this.camGoal.dist };
      this._updateCamera(0);
    }
    resetCamera() {
      const d = this.defaultCam;
      this.camGoal.target.copy(d.target); this.camGoal.yaw = d.yaw; this.camGoal.pitch = d.pitch; this.camGoal.dist = d.dist;
    }
    flyTo(v, dur) {
      this.camGoal.target.set(v.x, v.y || 0, v.z);
      if (v.yaw != null) this.camGoal.yaw = v.yaw;
      if (v.pitch != null) this.camGoal.pitch = v.pitch;
      if (v.dist != null) this.camGoal.dist = v.dist;
      this._camSmooth = dur || 0.9;
      this._camT = 0;
    }
    _bindCamera() {
      const dom = this.canvas;
      let dragging = false, panning = false, lx = 0, ly = 0, btn = 0;
      dom.addEventListener('contextmenu', e => e.preventDefault());
      dom.addEventListener('pointerdown', e => {
        if (e.button === 1) {
          dragging = true; panning = e.shiftKey; btn = 1; lx = e.clientX; ly = e.clientY;
          dom.setPointerCapture(e.pointerId); e.preventDefault();
        }
      });
      dom.addEventListener('pointermove', e => {
        this.pointer.x = e.clientX; this.pointer.y = e.clientY;
        if (!dragging) return;
        const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
        if (panning) {
          const scale = this.cam.dist * 0.0016;
          const right = new THREE.Vector3(Math.cos(this.cam.yaw), 0, -Math.sin(this.cam.yaw));
          const fwd = new THREE.Vector3(-Math.sin(this.cam.yaw), 0, -Math.cos(this.cam.yaw));
          this.camGoal.target.addScaledVector(right, -dx * scale);
          this.camGoal.target.addScaledVector(fwd, -dy * scale);
          this.camGoal.target.x = clamp(this.camGoal.target.x, -this.map.W * CELL / 2, this.map.W * CELL / 2);
          this.camGoal.target.z = clamp(this.camGoal.target.z, -this.map.H * CELL / 2, this.map.H * CELL / 2);
        } else {
          this.camGoal.yaw -= dx * 0.006;
          this.camGoal.pitch = clamp(this.camGoal.pitch + dy * 0.005, 0.25, 1.5);
        }
      });
      dom.addEventListener('pointerup', e => {
        if (e.button === 1 || dragging) { dragging = false; try { dom.releasePointerCapture(e.pointerId); } catch (x) {} }
      });
      dom.addEventListener('wheel', e => {
        e.preventDefault();
        this.camGoal.dist = clamp(this.camGoal.dist * (1 + Math.sign(e.deltaY) * 0.08), 26, 210);
      }, { passive: false });
    }
    _updateCamera(dt) {
      const k = dt <= 0 ? 1 : 1 - Math.pow(0.0015, dt);
      this.cam.yaw = lerp(this.cam.yaw, this.camGoal.yaw, k);
      this.cam.pitch = lerp(this.cam.pitch, this.camGoal.pitch, k);
      this.cam.dist = lerp(this.cam.dist, this.camGoal.dist, k);
      this.cam.target.lerp(this.camGoal.target, k);
      const cp = this.cam;
      const x = cp.target.x + Math.sin(cp.yaw) * Math.cos(cp.pitch) * cp.dist;
      const y = cp.target.y + Math.sin(cp.pitch) * cp.dist;
      const z = cp.target.z + Math.cos(cp.yaw) * Math.cos(cp.pitch) * cp.dist;
      this.camera.position.set(x, y, z);
      this.camera.lookAt(cp.target);
    }

    /* ---------------- interaction helpers ---------------- */
    resize() {
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.width = w; this.height = h;
    }
    toScreen(v) {
      const p = v.clone().project(this.camera);
      if (p.z > 1) return null;
      return { x: (p.x * 0.5 + 0.5) * this.width, y: (-p.y * 0.5 + 0.5) * this.height, z: p.z };
    }
    pickCell(clientX, clientY) {
      if (!this.map) return null;
      const rect = this.canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      if (this.pickMeshes && this.pickMeshes.length) {
        const hits = this.raycaster.intersectObjects(this.pickMeshes, false);
        if (hits.length) return hits[0].object.userData.cell;
      }
      // screen-space fallback: catch clicks on raised nodes, towers and platforms
      let best = null, bd = 34;
      const rect2 = this.canvas.getBoundingClientRect();
      const sx = clientX - rect2.left, sy = clientY - rect2.top;
      for (const c of this.map.cells) {
        if (!c.walk && !c.platform) continue;
        const h = c.type === 'switch' ? 1.3 : c.platform ? 1.55 : 0.55;
        const sp = this.toScreen(this.cellPos(c, this.cellTop(c) + h));
        if (!sp) continue;
        const dd = Math.hypot(sp.x - sx, sp.y - sy);
        if (dd < bd) { bd = dd; best = c; }
      }
      if (best) return best;
      const hit = new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.32), hit)) return null;
      const m = this.map;
      const gx = Math.round(hit.x / CELL + (m.W - 1) / 2);
      const gy = Math.round(hit.z / CELL + (m.H - 1) / 2);
      return m.byKey[gx + ',' + gy] || null;
    }

    _buildPickVolumes() {
      this.pickMeshes = [];
      const geo = new THREE.BoxGeometry(CELL * 0.94, 0.26, CELL * 0.94);
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      for (const c of this.map.cells) {
        if (!c.walk && !c.platform) continue;
        const top = this.cellTop(c);
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(this.cellPos(c, top + 0.1));
        m.userData.cell = c;
        this.pickMeshes.push(m);
        this.mapGroup.add(m);
      }
    }
    pickEntity(clientX, clientY, game) {
      const rect = this.canvas.getBoundingClientRect();
      let best = null, bestD = 40;
      const consider = (obj, worldPos, type) => {
        const s = this.toScreen(worldPos);
        if (!s) return;
        const d = Math.hypot(s.x + rect.left - clientX, s.y + rect.top - clientY);
        if (d < bestD) { bestD = d; best = { type, obj }; }
      };
      if (game) {
        game.enemies.forEach(e => { if (!e.dead) { const p = e.view ? e.view.position.clone() : this.cellCenter(e.cell, 1); p.y += e.def.boss ? 2.5 : 0.8; consider(e, p, 'enemy'); } });
        game.towers.forEach(t => { const p = this.cellCenter(t.cell, 1.4); consider(t, p, 'tower'); });
      }
      if (best) return best;
      const cell = this.pickCell(clientX, clientY);
      if (!cell) return null;
      if (cell.tower) return { type: 'tower', obj: cell.tower, cell };
      if (cell.walk || cell.platform) return { type: 'cell', cell };
      return null;
    }
    cellWorld(c, h) { return this.cellCenter(c, h); }

    /* ---------------- placement visuals ---------------- */
    ensurePlacement() {
      if (this.placeGroup) return;
      this.placeGroup = new THREE.Group(); this.mapGroup.add(this.placeGroup);
      this.rangeDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({
        color: 0x4fe3ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      this.rangeDisc.rotation.x = -Math.PI / 2; this.placeGroup.add(this.rangeDisc);
      this.rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({
        color: 0x4fe3ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      this.rangeRing.rotation.x = -Math.PI / 2; this.placeGroup.add(this.rangeRing);
      this.coneMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48, -Math.PI / 2 - 0.7, 1.4), new THREE.MeshBasicMaterial({
        color: 0x9fd0ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      this.coneMesh.rotation.x = -Math.PI / 2; this.placeGroup.add(this.coneMesh);
      this.cellFrame = new THREE.Group(); this.placeGroup.add(this.cellFrame);
      const fm = new THREE.MeshBasicMaterial({ color: 0x5fffc8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let i = 0; i < 4; i++) {
        const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1;
        const h1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.14), fm);
        h1.position.set(sx * CELL * 0.42, 0.4, sz * CELL * 0.42); this.cellFrame.add(h1);
        const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 1.6), fm);
        h2.position.set(sx * CELL * 0.42, 0.4, sz * CELL * 0.42 - sz * 0.8); this.cellFrame.add(h2);
      }
      this.frameMat = fm;
      this.ghost = null;
      this.invalidMat = new THREE.MeshBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
    }
    showPlacement(cell, defId, radius, opts) {
      this.ensurePlacement();
      opts = opts || {};
      const p = this.cellCenter(cell, 0.42);
      this.placeGroup.visible = true;
      this.cellFrame.position.set(p.x, 0, p.z);
      this.cellFrame.visible = true;
      this.frameMat.color.setHex(opts.valid === false ? 0xff5566 : 0x5fffc8);
      const r = radius * CELL;
      this.rangeDisc.position.set(p.x, p.y, p.z); this.rangeDisc.scale.set(r, r, 1);
      this.rangeRing.position.set(p.x, p.y + 0.02, p.z); this.rangeRing.scale.set(r, r, 1);
      this.rangeDisc.material.color.setHex(opts.valid === false ? 0xff5566 : (opts.color || 0x4fe3ff));
      this.rangeRing.material.color.setHex(opts.valid === false ? 0xff5566 : (opts.color || 0x4fe3ff));
      if (opts.cone != null && opts.facing != null) {
        this.coneMesh.visible = true;
        this.coneMesh.position.set(p.x, p.y + 0.03, p.z);
        this.coneMesh.scale.set(r, r, 1);
        this.coneMesh.rotation.z = -opts.facing + Math.PI / 2;
        this.coneMesh.material.color.setHex(opts.valid === false ? 0xff5566 : 0x9fd0ff);
      } else this.coneMesh.visible = false;
      if (defId) {
        if (this.ghost) { this.placeGroup.remove(this.ghost); disposeGroup(this.ghost); }
        const ghost = M.makeTower(defId, 1, null, this.theme);
        ghost.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.castShadow = false; } if (o.isSprite) o.visible = false; });
        ghost.position.set(p.x, p.y - 0.42, p.z);
        if (opts.facing != null) ghost.rotation.y = opts.facing;
        this.placeGroup.add(ghost); this.ghost = ghost;
      }
    }
    hidePlacement() {
      if (this.placeGroup) this.placeGroup.visible = false;
      if (this.ghost) { this.placeGroup.remove(this.ghost); disposeGroup(this.ghost); this.ghost = null; }
    }
    showArea(cell, radiusCells, color, ringColor) {
      this.ensurePlacement();
      const p = this.cellCenter(cell, 0.45);
      this.placeGroup.visible = true;
      this.cellFrame.visible = true; this.cellFrame.position.set(p.x, 0, p.z);
      this.frameMat.color.setHex(ringColor || 0xffce6a);
      const r = radiusCells * CELL;
      this.rangeDisc.position.set(p.x, p.y, p.z); this.rangeDisc.scale.set(r, r, 1);
      this.rangeDisc.material.color.setHex(color || 0xff9c6b);
      this.rangeRing.position.set(p.x, p.y + 0.02, p.z); this.rangeRing.scale.set(r, r, 1);
      this.rangeRing.material.color.setHex(color || 0xff9c6b);
      this.coneMesh.visible = false;
      if (this.ghost) { this.placeGroup.remove(this.ghost); this.ghost = null; }
    }

    selectRing(kind, worldPos, color) {
      if (!this.selRing) {
        this.selRing = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.86, 48), new THREE.MeshBasicMaterial({
          color: 0x6effff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.selRing.rotation.x = -Math.PI / 2; this.mapGroup.add(this.selRing);
        this.selBrackets = new THREE.Group(); this.mapGroup.add(this.selBrackets);
      }
      if (!worldPos) { this.selRing.visible = false; this.selBrackets.visible = false; return; }
      this.selRing.visible = true; this.selBrackets.visible = true;
      this.selRing.position.copy(worldPos); this.selRing.position.y = 0.5;
      this.selRing.material.color.set(color || 0x6effff);
      this.selRing.userData.t = 0;
      this.selBrackets.position.copy(worldPos);
      this.selBrackets.children.forEach(c => c.material.color.set(color || 0x6effff));
    }

    /* ---------------- entities ---------------- */
    addTower(t) {
      const g = M.makeTower(t.defId, t.level, t.branch, this.theme);
      const p = this.cellCenter(t.cell, t.cell.platform ? 0.05 : 0.02);
      g.position.copy(p);
      if (t.facing != null) g.rotation.y = t.facing;
      this.mapGroup.add(g);
      t.view = g;
      t.viewData = { type: t.defId, headYaw: t.facing || 0, recoil: 0, shield: 0, encrypted: false, level: t.level, aimAngle: null };
      g.userData.game = t;
      this._attachTowerBar(g);
      this.towerViews.set(t.id, g);
      if (t.cell.slotMarker) t.cell.slotMarker.visible = false;
      return g;
    }
    _attachTowerBar(g) {
      const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x04080c, transparent: true, opacity: 0.62, depthWrite: false, depthTest: true }));
      const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x63f0d0, transparent: true, opacity: 0.95, depthWrite: false, depthTest: true }));
      const wrap = new THREE.Group();
      wrap.position.y = 3.35;
      bg.scale.set(2.7, 0.22, 1); fill.scale.set(2.7, 0.15, 1);
      bg.position.y = 0.06; fill.position.y = 0.06;
      wrap.add(bg); wrap.add(fill); wrap.visible = false;
      g.add(wrap);
      g.userData.hpBar = { bg, fill, wrap };
    }

    removeTower(t) {
      if (t.view) { this.mapGroup.remove(t.view); disposeGroup(t.view); t.view = null; }
      this.towerViews.delete(t.id);
      if (t.cell.slotMarker) t.cell.slotMarker.visible = true;
    }
    rebuildTower(t) {
      const old = t.view;
      if (old) { this.mapGroup.remove(old); disposeGroup(old); }
      const g = M.makeTower(t.defId, t.level, t.branch, this.theme);
      const p = this.cellCenter(t.cell, t.cell.platform ? 0.05 : 0.02);
      g.position.copy(p);
      if (t.facing != null) g.rotation.y = t.facing;
      this.mapGroup.add(g); t.view = g;
      t.viewData.level = t.level;
      this._attachTowerBar(g);
      this.towerViews.set(t.id, g);
    }
    addEnemy(e) {
      const g = M.makeEnemy(e.defId === 'boss_wankui' || e.defId === 'boss_mirage' || e.defId === 'boss_zheying' ? e.defId : e.defId, this.theme);
      const p = this.cellCenter(e.cell, e.def.flying ? 0 : 0.18);
      g.position.copy(p);
      g.position.y += e.def.flying ? 6.2 : 0.1;
      e.baseY = g.position.y;
      this.mapGroup.add(g);
      e.view = g;
      this.enemyViews.set(e.id, g);
      return g;
    }
    removeEnemy(e) {
      if (e.view) { this.mapGroup.remove(e.view); disposeGroup(e.view); e.view = null; }
      this.enemyViews.delete(e.id);
    }
    updateSwitchView(cell) {
      const view = cell.node;
      if (!view) return;
      const iso = !!cell.isolation;
      view.isolated = iso;
      view.hex.material.emissive.setHex(iso ? 0xffa23e : 0x1de9c0);
      view.cap.material.emissive.setHex(iso ? 0xffcb7a : 0x1de9c0);
      view.ring1.material.color.setHex(iso ? 0xffb457 : 0x3ef0c8);
      view.ring2.material.color.setHex(iso ? 0xffd9a0 : 0x9dfff0);
      view.field.material.opacity = iso ? 0.13 : 0;
      view.label.material.opacity = iso ? 1 : 0.8;
      if (iso && !view.towerHidden) {
        // tower occupies node: lower the central device
        view.hex.visible = !cell.tower;
        view.cap.visible = !cell.tower;
      }
    }

    /* ---------------- effects wrappers ---------------- */
    muzzle(tower) {
      const p = this.cellCenter(tower.cell, 1);
      p.y += 1.2;
      const c = tower.def.color;
      this.effects.flash(p, parseInt(c.slice(1), 16), 1.6, 0.12);
    }

    /* ---------------- frame ---------------- */
    _drawTethers(game) {
      if (!this.tethers) return;
      const pos = this.tethers.geometry.attributes.position.array;
      const col = this.tethers.geometry.attributes.color.array;
      let n = 0;
      if (game) {
        const push = (t, e, color) => {
          if (n >= 398) return;
          const a = this.cellCenter(t.cell, 1.0);
          const b = e.view ? e.view.position.clone().add(new THREE.Vector3(0, 0.9, 0)) : this.cellCenter(e.cell, 1.2);
          pos[n * 3] = a.x; pos[n * 3 + 1] = a.y; pos[n * 3 + 2] = a.z;
          pos[(n + 1) * 3] = b.x; pos[(n + 1) * 3 + 1] = b.y; pos[(n + 1) * 3 + 2] = b.z;
          const c = new THREE.Color(color);
          for (let k = 0; k < 2; k++) { col[(n + k) * 3] = c.r; col[(n + k) * 3 + 1] = c.g; col[(n + k) * 3 + 2] = c.b; }
          n += 2;
        };
        game.towers.forEach(t => {
          if (t.blockedSet && t.blockedSet.size) t.blockedSet.forEach(e => push(t, e, 0xffb457));
        });
        game.enemies.forEach(e => {
          if (e.luredBy && !e.dead) push(e.luredBy, e, 0xff7cd8);
        });
      }
      this.tethers.geometry.setDrawRange(0, n);
      this.tethers.geometry.attributes.position.needsUpdate = true;
      this.tethers.geometry.attributes.color.needsUpdate = true;
    }

    update(dt, game) {
      this.elapsed += dt;
      const t = this.elapsed;
      this._updateCamera(dt);
      this.skyMat.uniforms.uTime.value = t;
      this.sky.position.copy(this.camera.position);
      for (const l of this.layers) {
        l.mat.uniforms.uTime.value = t;
        l.mesh.position.y = l.baseY + Math.sin(t * 0.2 + l.phase) * 0.6;
      }
      if (this.motes) {
        this.motes.obj.rotation.y = t * 0.006;
        this.motes.obj.position.y = Math.sin(t * 0.15) * 1.2;
      }
      if (this.farGroup) this.farGroup.rotation.y = t * 0.002;
      if (this.scanRing) { this.scanRing.rotation.z = t * 0.22; const ss = 1 + Math.sin(t * 0.6) * 0.06; this.scanRing.scale.set(ss, ss, 1); this.scanRing.material.opacity = 0.06 + (Math.sin(t * 0.9) + 1) * 0.035; }
      if (this.citySpires) this.citySpires.forEach((sp, i) => { sp.group.userData.ring.rotation.z = t * (0.18 + i * 0.02); sp.group.userData.beacon.rotation.y = t * 0.6; sp.group.userData.beacon.position.y += Math.sin(t * 1.4 + i) * 0.002; });
      if (this.floatCubes) this.floatCubes.forEach((c, i) => { c.rotation.x += dt * 0.3 * c.userData.spin; c.rotation.y += dt * 0.45 * c.userData.spin; c.position.y = c.userData.baseY + Math.sin(t * 0.5 + i) * 0.6; });
      if (this.publicFlow) {
        this.publicFlow.mat.uniforms.uTime.value = t;
        const pos = this.publicFlow.points.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          let x = pos.array[i * 3] + dt * 22;
          const lim = this.map.W * CELL * 0.5 + 4;
          if (x > lim) x = -lim;
          pos.array[i * 3] = x;
        }
        pos.needsUpdate = true;
      }
      // switch idle
      this.switches.forEach((v, i) => {
        v.ring1.rotation.z = t * (v.isolated ? 2.4 : 0.7) + i;
        v.ring2.rotation.z = -t * (v.isolated ? 1.7 : 0.5);
        v.hex.rotation.y = t * 0.6;
        v.group.position.y = Math.sin(t * 1.5 + i) * 0.04;
        if (v.isolated && Math.random() < dt * 6) {
          const p = v.group.position.clone(); p.y += 2.5;
          this.effects.lightning(p, p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, -2, (Math.random() - 0.5) * 3)), 0xffb457, { life: 0.1 });
        }
      });
      // gates
      for (const k in this.gateViews) {
        const gv = this.gateViews[k];
        if (gv.def && this.map.entrances.find(e => e.id === k)) {
          gv.portal.material.opacity = 0.1 + Math.sin(t * 2 + k.charCodeAt(0)) * 0.04;
          if (gv.pad) gv.pad.material.opacity = 0.09 + Math.sin(t * 1.5 + k.charCodeAt(0)) * 0.03;
        } else if (gv.core) {
          gv.core.rotation.y = t * 0.4; gv.core.rotation.x = Math.sin(t * 0.25) * 0.08;
          gv.wire.rotation.y = -t * 0.2; gv.wire.rotation.x = Math.sin(t * 0.3) * 0.2;
          gv.ring.rotation.z = t * 0.3; gv.ring2.rotation.z = -t * 0.2;
          gv.inner.scale.setScalar(1 + Math.sin(t * 2.4) * 0.08);
          if (gv.shards) gv.shards.forEach((s, si) => {
            s.a += dt * 0.35;
            s.mesh.position.set(Math.cos(s.a) * s.r, s.y + Math.sin(t * 1.2 + si) * 0.25, Math.sin(s.a) * s.r);
            s.mesh.rotation.y += dt; s.mesh.rotation.x += dt * 0.6;
          });
          const integrity = game ? game.integrity / 100 : 1;
          gv.core.material.emissiveIntensity = 0.55 + Math.sin(t * 2) * 0.12 + integrity * 0.38;
          gv.inner.material.opacity = 0.4 + integrity * 0.3 + Math.sin(t * 3) * 0.06;
        }
      }
      // routes animation
      for (const k in this.routeViews) {
        const rv = this.routeViews[k];
        rv.mat.uniforms.uTime.value = t;
        rv.mat.uniforms.uOpacity.value = 0.4 + Math.sin(t * 1.3 + k.charCodeAt(0)) * 0.08;
        if (rv.mks && rv.len > 1) {
          rv.mks.forEach((m, i) => {
            const d = ((t * 5.2 + i * rv.len / 3) % rv.len);
            let seg = 0;
            while (seg < rv.cum.length - 2 && rv.cum[seg + 1] < d) seg++;
            const f = (d - rv.cum[seg]) / Math.max(0.001, rv.cum[seg + 1] - rv.cum[seg]);
            const a = rv.pts[seg], b = rv.pts[seg + 1];
            m.position.set(lerp(a.x, b.x, f), 0.72 + Math.sin(t * 4 + i) * 0.03, lerp(a.z, b.z, f));
            m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
            m.visible = true;
          });
        }
      }
      if (this.previewGroup) this.previewGroup.children.forEach(m => { if (m.material && m.material.uniforms) m.material.uniforms.uTime.value = t; });
      // towers
      if (game) {
        game.towers.forEach(tw => {
          if (!tw.view) return;
          const vd = tw.viewData;
          vd.shield = tw.shield || 0; vd.encrypted = tw.encryptedUntil > game.time;
          vd.headYaw = tw.aimAngle || vd.headYaw || 0;
          vd.recoil = Math.max(0, (tw.recoil || 0));
          M.tickTower(tw.view, vd, dt, t);
          const hb = tw.view.userData.hpBar;
          if (hb) {
            const ratio = Math.max(0, Math.min(1, tw.hp / tw.maxHp));
            hb.wrap.visible = ratio < 0.999 || tw.shield > 0 || tw.encryptedUntil > game.time;
            if (hb.wrap.visible) {
              hb.fill.scale.set(2.7 * ratio, 0.15, 1);
              hb.fill.center.set(0, 0.5); hb.fill.position.x = -1.35;
              hb.fill.material.color.setHex(tw.encryptedUntil > game.time ? 0xc46bff : ratio < 0.35 ? 0xff5f7e : ratio < 0.65 ? 0xffcf6e : 0x63f0d0);
              hb.wrap.position.y = tw.cell.platform ? 4.0 : 3.5;
            }
          }
          if (tw.defId === 'interceptor' && tw.view.userData.parts.heads[0]) {
            tw.view.userData.parts.heads[0].rotation.y = tw.aimAngle || 0;
            if (tw.view.userData.parts.pitch) tw.view.userData.parts.pitch.rotation.x = -(tw.pitch || 0.12);
          }
          if (tw.defId === 'firewall' && tw.view.userData.parts.heads[1]) {
            tw.view.userData.parts.heads[1].rotation.y = (tw.aimAngle || 0) - (tw.view.rotation.y || 0);
            tw.view.userData.parts.heads[0].rotation.y = (tw.aimAngle || 0) - (tw.view.rotation.y || 0);
          }
          tw.recoil = Math.max(0, (tw.recoil || 0) - dt * 6);
        });
        // enemies
        game.enemies.forEach(e => {
          if (!e.view || e.dead) return;
          const p = this.cellCenter(e.cell, 0);
          const targetY = e.def.flying ? 6.4 + Math.sin(t * 2 + e.id) * 0.2 : 0.12;
          const h = e.def.boss ? 0 : 0;
          e.view.position.x = e.wx != null ? e.wx : p.x;
          e.view.position.z = e.wz != null ? e.wz : p.z;
          e.view.position.y = (e.heightOffset || 0) + targetY;
          e.baseY = e.view.position.y;
          if (e.heading != null) e.view.rotation.y = e.heading;
          M.tickEnemy(e.view, e, dt, t, this.camera);
          if (e.hitFlash > 0 && !e.def.boss) {
            e.hitFlash -= dt;
            if (!e._flashApplied) {
              e._flashApplied = true;
              e.view.traverse(o => {
                if (o.isMesh && o.material && o.material.emissive) {
                  if (!o.userData._oe) o.userData._oe = { e: o.material.emissive.getHex(), i: o.material.emissiveIntensity };
                  o.material.emissive.setHex(0xffd7df); o.material.emissiveIntensity = 0.9;
                }
              });
            }
          } else if (e._flashApplied) {
            e._flashApplied = false;
            e.view.traverse(o => { if (o.isMesh && o.userData._oe && o.material && o.material.emissive) { o.material.emissive.setHex(o.userData._oe.e); o.material.emissiveIntensity = o.userData._oe.i; } });
          }
          if (e.def.boss) e.view.position.y += Math.sin(t * 1.2 + e.id) * 0.05;
        });
      }
      this._drawTethers(game);
      // platform slot pulses
      (this.platformMeshes || []).forEach(pm => {
        if (pm.cell.tower) { pm.slot.visible = false; return; }
        pm.slot.visible = true;
        pm.slot.material.opacity = 0.18 + Math.sin(t * 2 + pm.cell.x) * 0.1;
      });
      if (this.selRing && this.selRing.visible) {
        this.selRing.rotation.z = t * 0.6;
        this.selRing.scale.setScalar(1 + Math.sin(t * 3) * 0.04);
      }
      this.effects.update(dt, t);
      this.renderer.render(this.scene, this.camera);
    }

    clearMap() {
      if (this.effects) this.effects.reset();
      this.towerViews.clear(); this.enemyViews.clear(); this.switchViews.clear();
      if (this.mapGroup) {
        this.mapGroup.parent && this.mapGroup.parent.remove(this.mapGroup);
        disposeGroup(this.mapGroup);
      }
      this.mapGroup = new THREE.Group(); this.root.add(this.mapGroup);
      this.map = null; this.routesGroup = null; this.previewGroup = null; this._routeSig = null;
      this.placeGroup = null; this.ghost = null;
      this.selRing = null; this.selBrackets = null;
      this.labelGroup = null; this.citySpires = null; this.floatCubes = null; this.scanRing = null;
      if (this.publicFlow) this.publicFlow = null;
    }
  }

  /* helpers */
  function disposeMesh(m) {
    if (!m) return;
    if (m.geometry) m.geometry.dispose();
    if (m.material) m.material.dispose();
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, rng) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  global.World = World;
  global.TDUTIL = { clamp, lerp, ease, hexColor, mulberry32, disposeGroup, shuffle };
})(window);
