// 视图层：渲染器、镜头、把逻辑状态同步到 3D 模型、路线标记、预览与叠加信息。
(function (root) {
  const TD = root.TD = root.TD || {};
  const THREE = root.THREE;
  const { Mesher, C } = TD.Gfx;
  const S = TD.RULES.tile;
  const TT = TD.TT;
  const V3 = THREE.Vector3;

  const GROUND_Y = 0.0, PLAT_Y = 0.9, FLY_Y = 4.2;

  class View {
    constructor(canvas, overlay, quality) {
      this.canvas = canvas;
      this.overlay = overlay;
      this.octx = overlay.getContext('2d');
      this.quality = quality || 'high';
      const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.NoToneMapping;
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFShadowMap;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 1.5 : 1);
      r.setPixelRatio(this.pixelRatio);
      this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 1800);
      this.rig = { theta: 0, phi: 0.92, dist: 80, target: new V3(), tTheta: 0, tPhi: 0.92, tDist: 80, tTarget: new V3() };
      this.insets = { l: 0, r: 0, t: 0, b: 0 };
      this.world = null;
      this.game = null;
      this.towerViews = new Map();
      this.enemyViews = new Map();
      this.shotViews = new Map();
      this.dying = [];
      this.floats = [];
      this.alerts = [];
      this.preview = null;
      this.shake = 0;
      this.flashCol = null;
      this.selected = null;
      this.hoverTile = null;
      this.size = { w: 1, h: 1 };
      this.routeMeshes = {};
      this.ghostRoutes = [];
      this.previewMeshes = [];
      this.zoneMeshes = new Map();
      this.holeMeshes = new Map();
      this.warnMeshes = new Map();
      this.residueMeshes = new Map();
      this.isoViews = new Map();
      this.time = 0;
      this.evHandlers = [];
      this.fpsAcc = 0; this.fpsCount = 0; this.fps = 60; this.lowFor = 0;
      this.initComposer();
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    initComposer() {
      const r = this.renderer;
      const size = r.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.quality === 'low' ? 0 : 4 });
      const comp = this.composer = new THREE.EffectComposer(r, rt);
      this.renderPass = new THREE.RenderPass(new THREE.Scene(), this.camera);
      comp.addPass(this.renderPass);
      // 过滤 NaN / 过亮像素，防止辉光把一个坏像素扩散到全屏
      comp.addPass(new THREE.ShaderPass({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.);} `,
        fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; void main(){ vec4 c=texture2D(tDiffuse,vUv); vec3 k=c.rgb; if(!(k.r==k.r)||!(k.g==k.g)||!(k.b==k.b)) k=vec3(0.); gl_FragColor=vec4(clamp(k,vec3(0.),vec3(24.)),1.); }`,
      }));
      this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.45, 0.5, 1.12);
      comp.addPass(this.bloom);
      this.grade = new THREE.ShaderPass({
        uniforms: { tDiffuse: { value: null }, uVig: { value: 0.42 }, uFlash: { value: new THREE.Color(0, 0, 0) }, uExpo: { value: 1 }, uSat: { value: 1.0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.);} `,
        fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uVig,uExpo,uSat; uniform vec3 uFlash;
          void main(){ vec4 c=texture2D(tDiffuse,vUv); vec3 col=c.rgb*uExpo;
            float l=dot(col,vec3(.2126,.7152,.0722)); col=mix(vec3(l),col,uSat);
            vec2 p=vUv-.5; float v=1.-uVig*smoothstep(.28,.85,length(p)*1.15);
            col=col*v+uFlash;
            // ACES 近似色调映射：按峰值通道缩放保住色相，再混入少量逐通道结果让极亮处自然发白
            vec3 pc=(col*(2.51*col+.03))/(col*(2.43*col+.59)+.14);
            float L=max(col.r,max(col.g,col.b)); float Lm=(L*(2.51*L+.03))/(L*(2.43*L+.59)+.14);
            vec3 hp=col*(Lm/max(L,1e-4));
            col=mix(hp,pc,.3);
            gl_FragColor=vec4(clamp(col,0.,1.),1.); }`,
      });
      comp.addPass(this.grade);
      this.output = new THREE.OutputPass();
      comp.addPass(this.output);
    }

    resize(force) {
      const w = window.innerWidth, h = window.innerHeight;
      const same = this.size.w === w && this.size.h === h;
      if (same && !force) return;
      this.size = { w, h };
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(w, h, false);
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.overlay.width = w * dpr; this.overlay.height = h * dpr;
      this.overlay.style.width = w + 'px'; this.overlay.style.height = h + 'px';
      this.octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ovDpr = dpr;
      if (this.world) this.fitDefault(!this.atDefault(), !this.atDefault());
    }

    atDefault() {
      const d = this.defaultCam, r = this.rig;
      if (!d) return true;
      return Math.abs(r.tDist - d.dist) < 0.05 && Math.abs(r.tTheta - d.theta) < 0.002 && Math.abs(r.tPhi - d.phi) < 0.002 && r.tTarget.distanceTo(d.target) < 0.05;
    }

    // ────────── 场景切换 ──────────
    setWorld(mapId) {
      if (this.worldId === mapId && this.world) return this.world;
      this.clearUnits();
      if (this.fx) { this.fx.dispose(); this.fx = null; }
      if (this.world) { this.world.dispose(); this.world = null; }
      this.world = new TD.World(this.renderer, mapId, this.quality);
      this.worldId = mapId;
      this.fx = new TD.FX(this.world.scene, this.quality);
      this.overlayGroup = new THREE.Group();
      this.world.scene.add(this.overlayGroup);
      this.renderPass.scene = this.world.scene;
      this.bloom.strength = this.world.th.bloom;
      this.grade.uniforms.uExpo.value = this.world.th.exposure;
      this.buildMarkers();
      this.fitDefault(false);
      return this.world;
    }

    bind(game) {
      this.clearUnits();
      this.game = game;
      if (this.fx) this.fx.clear();
      this.rebuildRoutes(true);
      this.previewMeshes.forEach(m => m.removeFromParent());
      this.previewMeshes = [];
      this.preview = null;
      this.lastNodeStates = {};
      if (this.trafficMesh) this.trafficMesh.count = this.traffic.length;
      for (const v of this.world.nodeViews) v.setState('direct');
    }

    clearUnits() {
      for (const v of this.towerViews.values()) { v.model.dispose(); if (v.shield) v.shield.removeFromParent(); if (v.enc) v.enc.removeFromParent(); }
      for (const v of this.enemyViews.values()) { v.model.dispose(); if (v.shield) v.shield.removeFromParent(); if (v.net) v.net.removeFromParent(); if (v.groundMark) v.groundMark.removeFromParent(); }
      for (const v of this.dying) v.model.dispose();
      for (const v of this.shotViews.values()) v.obj.removeFromParent();
      for (const v of this.isoViews.values()) v.model.dispose();
      for (const v of this.zoneMeshes.values()) v.removeFromParent();
      for (const v of this.holeMeshes.values()) v.removeFromParent();
      for (const v of this.warnMeshes.values()) v.removeFromParent();
      for (const v of this.residueMeshes.values()) v.removeFromParent();
      for (const g of this.ghostRoutes) g.mesh.removeFromParent();
      this.ghostRoutes = [];
      this.towerViews.clear(); this.enemyViews.clear(); this.shotViews.clear(); this.isoViews.clear();
      this.zoneMeshes.clear(); this.holeMeshes.clear(); this.warnMeshes.clear(); this.residueMeshes.clear();
      this.dying = []; this.floats = []; this.alerts = [];
      this.selected = null;
      this.sealedMarks = [];
    }

    X(x) { return (x - (this.world.w - 1) / 2) * S; }
    Z(y) { return (y - (this.world.h - 1) / 2) * S; }
    tileFromWorld(wx, wz) { return { x: Math.round(wx / S + (this.world.w - 1) / 2), y: Math.round(wz / S + (this.world.h - 1) / 2) }; }
    groundAt(x, y) { return this.world.tileAt(Math.round(x), Math.round(y)) === TT.PLATFORM ? PLAT_Y : GROUND_Y; }

    // ────────── 镜头 ──────────
    camPosFrom(target, theta, phi, dist) {
      return new V3(target.x + Math.sin(theta) * Math.cos(phi) * dist, target.y + Math.sin(phi) * dist, target.z + Math.cos(theta) * Math.cos(phi) * dist);
    }

    fitDefault(animate, keepCamera) {
      const w = this.world.w * S, h = this.world.h * S;
      const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(c => new V3(c[0], 0, c[1]));
      corners.push(new V3(-w / 2, 3, h / 2), new V3(w / 2, 3, h / 2), new V3(-w / 2, 7, -h / 2), new V3(w / 2, 7, -h / 2));
      const { w: W, h: H } = this.size;
      const ins = this.insets;
      const safe = { x0: ins.l, x1: W - ins.r, y0: ins.t, y1: H - ins.b };
      const cam = this.camera.clone();
      cam.aspect = W / H; cam.updateProjectionMatrix();
      const theta = 0, phi = 0.95;
      const target = new V3(0, 0, 0);
      let dist = 70;
      for (let it = 0; it < 24; it++) {
        cam.position.copy(this.camPosFrom(target, theta, phi, dist));
        cam.lookAt(target);
        cam.updateMatrixWorld(true);
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const c of corners) {
          const p = c.clone().project(cam);
          const sx = (p.x * 0.5 + 0.5) * W, sy = (-p.y * 0.5 + 0.5) * H;
          x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
        }
        const sw = safe.x1 - safe.x0, sh = safe.y1 - safe.y0;
        const k = Math.max((x1 - x0) / sw, (y1 - y0) / sh);
        dist *= 1 + (k - 1) * 0.8;
        // 平移目标点，把包围盒移到安全区中心
        const dx = ((x0 + x1) / 2 - (safe.x0 + safe.x1) / 2) / W;
        const dy = ((y0 + y1) / 2 - (safe.y0 + safe.y1) / 2) / H;
        target.x += dx * dist * 0.75;
        target.z += dy * dist * 0.75;
      }
      this.defaultCam = { theta, phi, dist, target: target.clone() };
      if (keepCamera) return;
      this.rig.tTheta = theta; this.rig.tPhi = phi; this.rig.tDist = dist; this.rig.tTarget.copy(target);
      if (!animate) { this.rig.theta = theta; this.rig.phi = phi; this.rig.dist = dist; this.rig.target.copy(target); }
    }

    resetCamera() { if (this.defaultCam) { this.rig.tTheta = this.defaultCam.theta; this.rig.tPhi = this.defaultCam.phi; this.rig.tDist = this.defaultCam.dist; this.rig.tTarget.copy(this.defaultCam.target); this.fitDefault(true); } }
    orbit(dx, dy) { this.rig.tTheta -= dx * 0.005; this.rig.tPhi = Math.max(0.28, Math.min(1.5, this.rig.tPhi + dy * 0.004)); }
    pan(dx, dy) {
      const d = this.rig.dist;
      const k = d * 0.00125 * (900 / this.size.h);
      const sin = Math.sin(this.rig.theta), cos = Math.cos(this.rig.theta);
      this.rig.tTarget.x += (-dx * cos - dy * sin / Math.max(0.5, Math.sin(this.rig.phi))) * k;
      this.rig.tTarget.z += (dx * sin - dy * cos / Math.max(0.5, Math.sin(this.rig.phi))) * k;
      const lim = 60;
      this.rig.tTarget.x = Math.max(-lim, Math.min(lim, this.rig.tTarget.x));
      this.rig.tTarget.z = Math.max(-lim, Math.min(lim, this.rig.tTarget.z));
    }
    zoom(delta) {
      this.rig.tDist = Math.max(10, Math.min(this.defaultCam ? this.defaultCam.dist * 1.8 : 160, this.rig.tDist * Math.exp(delta * 0.0011)));
    }
    focus(x, y, dist) { this.rig.tTarget.set(this.X(x), 0, this.Z(y)); if (dist) this.rig.tDist = dist; }

    updateCamera(dt) {
      const r = this.rig;
      const k = Math.min(1, dt * 9);
      r.theta += (r.tTheta - r.theta) * k;
      r.phi += (r.tPhi - r.phi) * k;
      r.dist += (r.tDist - r.dist) * k;
      r.target.lerp(r.tTarget, k);
      const p = this.camPosFrom(r.target, r.theta, r.phi, r.dist);
      if (this.shake > 0.001) {
        p.x += (Math.random() - 0.5) * this.shake; p.y += (Math.random() - 0.5) * this.shake; p.z += (Math.random() - 0.5) * this.shake;
        this.shake *= Math.max(0, 1 - dt * 5);
      }
      this.camera.position.copy(p);
      this.camera.lookAt(r.target);
      this.camera.updateMatrixWorld(true);
    }

    project(wx, wy, wz) {
      const v = this._v || (this._v = new V3());
      v.set(wx, wy, wz).project(this.camera);
      const k = this._ovK || 1;
      return { x: (v.x * 0.5 + 0.5) * this.size.w / k, y: (-v.y * 0.5 + 0.5) * this.size.h / k, z: v.z };
    }

    // 屏幕坐标到地块：先试平台高度，再试路面高度
    pickTile(px, py) {
      if (!this.world) return null;
      const ndc = new THREE.Vector2(px / this.size.w * 2 - 1, -(py / this.size.h) * 2 + 1);
      const rc = this._rc || (this._rc = new THREE.Raycaster());
      rc.setFromCamera(ndc, this.camera);
      const hit = (y) => {
        const o = rc.ray.origin, d = rc.ray.direction;
        if (Math.abs(d.y) < 1e-4) return null;
        const t = (y - o.y) / d.y;
        if (t < 0) return null;
        return { x: o.x + d.x * t, z: o.z + d.z * t };
      };
      const hp = hit(PLAT_Y);
      if (hp) {
        const t = this.tileFromWorld(hp.x, hp.z);
        if (this.world.tileAt(t.x, t.y) === TT.PLATFORM) return t;
      }
      const hg = hit(0);
      if (!hg) return null;
      const t = this.tileFromWorld(hg.x, hg.z);
      if (t.x < 0 || t.y < 0 || t.x >= this.world.w || t.y >= this.world.h) return null;
      return t;
    }

    // 屏幕坐标在某一高度平面上的格坐标（浮点）
    pickFloat(px, py, y) {
      const ndc = new THREE.Vector2(px / this.size.w * 2 - 1, -(py / this.size.h) * 2 + 1);
      const rc = this._rc || (this._rc = new THREE.Raycaster());
      rc.setFromCamera(ndc, this.camera);
      const o = rc.ray.origin, d = rc.ray.direction;
      if (Math.abs(d.y) < 1e-4) return null;
      const t = (y - o.y) / d.y;
      if (t < 0) return null;
      return { x: (o.x + d.x * t) / S + (this.world.w - 1) / 2, y: (o.z + d.z * t) / S + (this.world.h - 1) / 2 };
    }

    unbind() {
      this.clearUnits();
      for (const k in this.routeMeshes) this.routeMeshes[k].removeFromParent();
      this.routeMeshes = {};
      this.clearPreview();
      this.game = null;
      this.showLabels = false;
      if (this.selMesh) this.selMesh.visible = false;
      if (this.fx) this.fx.clear();
      if (this.trafficMesh) this.trafficMesh.count = 0;
      if (this.flyLines) for (const f of this.flyLines) f.line.material.uniforms.uA.value = 0;
    }

    pickUnit(px, py) {
      let best = null, bd = 34;
      if (!this.game) return null;
      for (const e of this.game.enemies) {
        const v = this.enemyViews.get(e.id);
        if (!v) continue;
        const p = this.project(v.pos.x, v.pos.y + v.model.height * v.scale * 0.5, v.pos.z);
        const d = Math.hypot(p.x - px, p.y - py);
        const lim = e.def.boss ? 60 : 30;
        if (d < lim && d < bd + (e.def.boss ? 26 : 0)) { bd = d; best = { kind: 'enemy', unit: e }; }
      }
      return best;
    }

    // ────────── 路线标记 ──────────
    rebuildRoutes(instant) {
      if (!this.world || !this.game) return;
      for (const k in this.routeMeshes) this.routeMeshes[k].removeFromParent();
      this.routeMeshes = {};
      const ents = this.game.map.entrances;
      ents.forEach((en, i) => {
        const r = this.game.routes[en.id];
        if (!r || !r.exit) return;
        const lane = (i - (ents.length - 1) / 2) * 0.5;
        const mesh = this.makeRibbon(r.path, lane, en.id, r.exit, { y: 0.1, width: 0.42 });
        this.overlayGroup.add(mesh);
        this.routeMeshes[en.id] = mesh;
      });
    }

    routePoints(path, lane) {
      const w = this.game.map.w;
      const raw = path.map(i => new THREE.Vector2(this.X(i % w), this.Z((i / w) | 0)));
      // 先做圆角，再做横向偏移
      const pts = [];
      for (let i = 0; i < raw.length; i++) {
        const c = raw[i];
        if (i === 0 || i === raw.length - 1) { pts.push(c); continue; }
        const a = raw[i - 1], b = raw[i + 1];
        const d1 = c.clone().sub(a).normalize(), d2 = b.clone().sub(c).normalize();
        if (Math.abs(d1.dot(d2)) > 0.99) { pts.push(c); continue; }
        const r = 0.8;
        const p0 = c.clone().addScaledVector(d1, -r), p2 = c.clone().addScaledVector(d2, r);
        for (let k = 0; k <= 6; k++) {
          const t = k / 6, u = 1 - t;
          pts.push(new THREE.Vector2(u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, u * u * p0.y + 2 * u * t * c.y + t * t * p2.y));
        }
      }
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const d = b.clone().sub(a).normalize();
        const n = new THREE.Vector2(-d.y, d.x);
        out.push({ x: pts[i].x + n.x * lane, z: pts[i].y + n.y * lane, nx: n.x, nz: n.y });
      }
      return out;
    }

    makeRibbon(path, lane, entId, exitId, opts) {
      const pts = this.routePoints(path, lane);
      const hw = (opts.width || 0.34) / 2, y = opts.y || 0.1;
      const P = [], U = [], Idx = [];
      let len = 0;
      for (let i = 0; i < pts.length; i++) {
        if (i) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
        const q = pts[i];
        P.push(q.x - q.nx * hw, y, q.z - q.nz * hw, q.x + q.nx * hw, y, q.z + q.nz * hw);
        U.push(len, 0, len, 1);
        if (i < pts.length - 1) { const v = i * 2; Idx.push(v, v + 1, v + 3, v, v + 3, v + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      g.setIndex(Idx);
      const col = new THREE.Color(TD.ENTRANCE_COLORS[entId]);
      const exitCol = new THREE.Color(exitId ? TD.EXIT_COLORS[exitId] : 0xffffff);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: {
          uTime: this.world.uTime, c: { value: col }, ec: { value: exitCol }, uAlpha: { value: 1 }, uMode: { value: opts.mode || 0 }, uSweep: { value: 1 }, uLen: { value: len },
        },
        vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
        fragmentShader: `varying vec2 vU; uniform float uTime,uAlpha,uMode,uSweep,uLen; uniform vec3 c,ec;
          void main(){ float v=vU.y-.5; float av=abs(v);
            // 箭头图案
            float s=fract(vU.x*.5-uTime*(uMode>1.5?.9:.55)-av*.9);
            float chev=smoothstep(.0,.06,s)*smoothstep(.38,.32,s);
            float edge=smoothstep(.34,.38,av);
            vec3 col=mix(c*.55,c*1.5,chev);
            col=mix(col,ec*1.35,edge);
            float a=.42+chev*.5; if(av>.48) a*=.3;
            if(uMode>1.5){ // 预览：白色虚线 + 明亮箭头
              float dash=step(.45,fract(vU.x*.8-uTime*.8));
              col=mix(c*.75,c*1.5+vec3(.2),chev); col=mix(col,vec3(1.25),edge*dash); a=(.34+.5*chev)*(1.-edge)+edge*dash*.95;
            } else if(uMode>.5&&uMode<1.5){ // 旧路线幽灵
              float dash=step(.5,fract(vU.x*.6));
              col=vec3(1.3,.5,.34); a=.55*dash;
            }
            // 改道时从起点扫到终点
            float sweepPos=uSweep*uLen; float sweep=smoothstep(sweepPos-3.,sweepPos,vU.x)*smoothstep(sweepPos+.2,sweepPos,vU.x);
            if(uSweep<1.) { a*=smoothstep(sweepPos+.2,sweepPos,vU.x); col+=vec3(3.)*sweep; a=max(a,sweep); }
            gl_FragColor=vec4(col,a*uAlpha);
}`,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.renderOrder = opts.mode === 2 ? 6 : 4;
      mesh.frustumCulled = false;
      mesh.userData = { len, pts };
      return mesh;
    }

    setPreview(pv, opts) {
      this.clearPreview();
      if (!pv) return;
      opts = opts || {};
      this.preview = pv;
      const ents = this.game.map.entrances;
      for (const c of pv.changes) {
        const i = ents.findIndex(e => e.id === c.ent);
        const lane = (i - (ents.length - 1) / 2) * 0.46;
        if (c.newExit) {
          const m = this.makeRibbon(c.newPath, lane, c.ent, c.newExit, { y: 0.34, width: 0.52, mode: 2 });
          this.overlayGroup.add(m);
          this.previewMeshes.push(m);
        }
        const rm = this.routeMeshes[c.ent];
        if (rm) rm.material.uniforms.uAlpha.value = 0.3;
      }
      if (pv.sealed && pv.sealed.length) this.setSealed(pv.sealed, 2.2);
    }

    clearPreview() {
      this.previewMeshes.forEach(m => m.removeFromParent());
      this.previewMeshes = [];
      this.preview = null;
      for (const k in this.routeMeshes) this.routeMeshes[k].material.uniforms.uAlpha.value = 1;
    }

    setSealed(list, dur) { this.sealedMarks = list.map(s => ({ x: s.x, y: s.y, label: s.label, t: dur, dur })); }

    // ────────── 标记物体（预览范围、落点等） ──────────
    buildMarkers() {
      const g = this.overlayGroup;
      // 范围圈
      const rangeMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { c: { value: new THREE.Color(0x5FB8E6) }, uTime: this.world.uTime, uArc: { value: 3.1416 }, uDir: { value: 0 }, uSoft: { value: 0.22 } },
        vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
        fragmentShader: `varying vec2 vP; uniform vec3 c; uniform float uTime,uArc,uDir,uSoft;
          void main(){ float d=length(vP); if(d>1.) discard; float a=atan(vP.y,vP.x)-uDir; a=atan(sin(a),cos(a));
            float inArc=step(abs(a),uArc); if(inArc<.5) discard;
            float edgeArc= uArc<3.1 ? smoothstep(uArc-.03,uArc,abs(a)) : 0.;
            float rim=smoothstep(.975,.99,d);
            float scan=smoothstep(.0,.3,fract(d*5.-uTime*.8))*.1;
            float al=rim*.95+edgeArc*.9+uSoft*(.5+.5*d)+scan*d;
            gl_FragColor=vec4(c*1.8,al);
}`,
      });
      this.rangeMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 64), rangeMat);
      this.rangeMesh.rotation.x = -Math.PI / 2;
      this.rangeMesh.visible = false;
      this.rangeMesh.renderOrder = 7;
      g.add(this.rangeMesh);
      this.rangeMesh2 = this.rangeMesh.clone();
      this.rangeMesh2.material = rangeMat.clone();
      this.rangeMesh2.material.uniforms.uTime = this.world.uTime;
      this.rangeMesh2.visible = false;
      g.add(this.rangeMesh2);
      // 落点框
      const cm = new Mesher();
      const a = 0.98, t = 0.09;
      for (const s of [-1, 1]) {
        cm.box(0, 0, s * a, a * 2, 0.05, t, 0xffffff, {});
        cm.box(s * a, 0, 0, t, 0.05, a * 2, 0xffffff, {});
      }
      this.cursorMesh = new THREE.Mesh(cm.geometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: false }));
      this.cursorMesh.visible = false;
      this.cursorMesh.renderOrder = 8;
      g.add(this.cursorMesh);
      // 可部署提示：实例化方块
      const instG = new THREE.PlaneGeometry(1.84, 1.84);
      instG.rotateX(-Math.PI / 2);
      this.hintMesh = new THREE.InstancedMesh(instG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }), 600);
      this.hintMesh.count = 0;
      this.hintMesh.frustumCulled = false;
      this.hintMesh.renderOrder = 5;
      g.add(this.hintMesh);
      // 选中圈
      const sg = new THREE.RingGeometry(0.92, 1.04, 48);
      sg.rotateX(-Math.PI / 2);
      this.selMesh = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      this.selMesh.visible = false;
      this.selMesh.renderOrder = 8;
      g.add(this.selMesh);
      // 飞行路线
      this.flyLines = [];
      if (this.world) {
        for (const en of this.world.map.entrances) {
          let best = null, bd = 1e9;
          for (const ex of this.world.map.exits) { const d = Math.hypot(ex.x - en.x, ex.y - en.y); if (d < bd) { bd = d; best = ex; } }
          const a0 = new V3(this.X(en.x), FLY_Y, this.Z(en.y)), b0 = new V3(this.X(best.x), FLY_Y, this.Z(best.y));
          const len = a0.distanceTo(b0);
          const lg = new THREE.PlaneGeometry(len, 0.09);
          lg.rotateX(-Math.PI / 2);
          const lm = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, side: THREE.DoubleSide,
            uniforms: { uTime: this.world.uTime, c: { value: new THREE.Color(TD.ENTRANCE_COLORS[en.id]) }, uLen: { value: len }, uA: { value: 0 } },
            vertexShader: `varying float vX; varying float vV; uniform float uLen; void main(){ vX=position.x+uLen*.5; vV=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
            fragmentShader: `varying float vX; uniform float uTime,uA; uniform vec3 c; void main(){ float s=fract(vX*.5-uTime*.9); float d=smoothstep(.0,.05,s)*smoothstep(.3,.25,s); gl_FragColor=vec4(c*1.2,d*uA*.8);
}`,
          });
          const line = new THREE.Mesh(lg, lm);
          line.position.copy(a0).lerp(b0, 0.5);
          line.rotation.y = -Math.atan2(b0.z - a0.z, b0.x - a0.x);
          line.renderOrder = 6;
          g.add(line);
          this.flyLines.push({ line, ent: en.id });
        }
      }
      // 业务流量：与木马伪装相似的小数据包，沿当前路线流动
      const n = this.quality === 'low' ? 24 : 54;
      const pg = new THREE.BoxGeometry(0.34, 0.2, 0.42);
      this.trafficMesh = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0xd7e6f2, emissive: 0x6DB2D8, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.5 }), n);
      this.trafficMesh.frustumCulled = false;
      g.add(this.trafficMesh);
      this.traffic = [];
      for (let i = 0; i < n; i++) this.traffic.push({ route: i, u: Math.random(), sp: 1.3 + Math.random() * 0.8 });
    }

    showRange(x, y, r, color, arc, dir, secondary) {
      const m = secondary ? this.rangeMesh2 : this.rangeMesh;
      const gy = this.groundAt(x, y);
      m.visible = true;
      m.position.set(this.X(x), gy + 0.16, this.Z(y));
      m.scale.setScalar(r * S);
      m.material.uniforms.c.value.set(color);
      m.material.uniforms.uArc.value = arc != null ? arc : 3.1416;
      // CircleGeometry 在 xy 平面，绕 x 轴转 -90° 后 y → -z，所以格子角度 dy 要取反
      m.material.uniforms.uDir.value = dir != null ? -dir : 0;
    }
    hideRange() { if (this.rangeMesh) { this.rangeMesh.visible = false; this.rangeMesh2.visible = false; } }

    showCursor(x, y, ok) {
      if (x == null) { this.cursorMesh.visible = false; return; }
      this.cursorMesh.visible = true;
      this.cursorMesh.material.color.set(ok ? 0x86E0AE : 0xE8583F).multiplyScalar(1.8);
      this.cursorMesh.position.set(this.X(x), this.groundAt(x, y) + 0.18, this.Z(y));
    }

    showHints(list, color) {
      const d = new THREE.Object3D();
      let c = 0;
      if (list) for (const t of list) {
        d.position.set(this.X(t.x), this.groundAt(t.x, t.y) + 0.13, this.Z(t.y));
        d.updateMatrix();
        this.hintMesh.setMatrixAt(c++, d.matrix);
      }
      this.hintMesh.count = c;
      this.hintMesh.instanceMatrix.needsUpdate = true;
      if (color) this.hintMesh.material.color.set(color);
    }

    // 拖拽时的半透明模型
    showGhost(type, x, y, dir, level, branch, ok) {
      if (!type) { if (this.ghost) { this.ghost.dispose(); this.ghost = null; this.ghostKey = null; } return; }
      const onNode = this.world.tileAt(x, y) === TT.NODE;
      const key = `${type}_${onNode}`;
      if (this.ghostKey !== key) {
        if (this.ghost) this.ghost.dispose();
        this.ghost = type === 'isolator' ? TD.makeIsolator() : TD.makeTower(type, level || 1, branch, { onNode });
        this.ghostKey = key;
        this.overlayGroup.add(this.ghost.root);
        this.ghost.setVariant('ghost');
        for (const m of this.ghost.meshes) m.castShadow = false;
      }
      this.ghost.root.position.set(this.X(x), this.groundAt(x, y), this.Z(y));
      this.orientTower(this.ghost.root, type, x, y);
      this.ghost.update(0.016, { dir: dir || 0, hasTarget: true, aim: dir || 0, arc: 1 });
    }

    orientTower(rootObj, type, x, y) {
      // 防火墙和蜜罐横跨车道
      const w = this.world;
      const horizontal = w.isRoad(x - 1, y) || w.isRoad(x + 1, y);
      const vertical = w.isRoad(x, y - 1) || w.isRoad(x, y + 1);
      if (type === 'firewall' || type === 'honeypot' || type === 'gate') rootObj.rotation.y = (horizontal && !vertical) ? Math.PI / 2 : 0;
    }

    // ────────── 主帧 ──────────
    // opts.noOverlay / opts.noComposite 供视频导出快进时跳过绘制
    frame(dt, simDt, speed, opts) {
      this.time += dt;
      if (!this.world) return;
      this.fx.beginFrame();
      this.world.update(dt);
      this.fx.update(simDt);
      if (this.game) this.syncGame(dt, simDt);
      this.updateCamera(dt);
      if (!(opts && opts.noOverlay)) this.renderOverlay(dt, simDt);
      if (this.composer && !(opts && opts.noComposite)) {
        const sc = this.world.scene;
        this.composer.render(dt);
      }
      if (!this.exporting) this.autoQuality(dt);
    }

    // 不推进时间，把当前状态重新画一遍
    redraw() {
      this.renderOverlay(0, 0);
      this.composer.render(0);
    }

    autoQuality(dt) {
      this.fpsAcc += dt; this.fpsCount++;
      if (this.fpsAcc >= 1) {
        this.fps = this.fpsCount / this.fpsAcc;
        this.fpsAcc = 0; this.fpsCount = 0;
        if (this.fps < 26 && document.visibilityState === 'visible') {
          this.lowFor++;
          if (this.lowFor >= 3 && this.pixelRatio > 0.8) { this.pixelRatio = Math.max(0.8, this.pixelRatio - 0.2); this.lowFor = 0; this.resize(true); }
        } else this.lowFor = 0;
      }
    }

    syncGame(dt, simDt) {
      const g = this.game;
      this.syncNodes(dt);
      this.syncTowers(dt, simDt);
      this.syncEnemies(dt, simDt);
      this.syncShots(dt, simDt);
      this.syncAreas(dt, simDt);
      this.syncTraffic(dt, simDt);
      // 飞行路线：下一波或当前有飞行敌人时可见
      const fc = g.forecast(g.waveIdx + 1);
      const flyEnts = {};
      for (const e of g.enemies) if (e.fly) flyEnts[e.ent] = 1;
      if (fc) for (const ent in fc.byEnt) if (fc.byEnt[ent].hotspot) flyEnts[ent] = 1;
      for (const f of this.flyLines) f.line.material.uniforms.uA.value += ((flyEnts[f.ent] ? 0.85 : 0) - f.line.material.uniforms.uA.value) * Math.min(1, dt * 3);
      // 旧路线幽灵
      for (let i = this.ghostRoutes.length - 1; i >= 0; i--) {
        const r = this.ghostRoutes[i];
        r.t -= dt;
        r.mesh.material.uniforms.uAlpha.value = Math.max(0, Math.min(1, r.t / 1.5));
        if (r.t <= 0) { r.mesh.removeFromParent(); this.ghostRoutes.splice(i, 1); }
      }
      for (const k in this.routeMeshes) {
        const m = this.routeMeshes[k];
        const u = m.material.uniforms.uSweep;
        if (u.value < 1) u.value = Math.min(1, u.value + dt * 0.55);
      }
      if (this.selected) {
        const s = this.selected;
        if (s.kind === 'tower' && !s.unit.gone) {
          this.selMesh.visible = true;
          this.selMesh.material.color.set(TD.ROLE_COLORS[s.unit.def.roleKey]).multiplyScalar(2);
          this.selMesh.position.set(this.X(s.unit.x), this.groundAt(s.unit.x, s.unit.y) + 0.22, this.Z(s.unit.y));
          this.selMesh.scale.setScalar(1 + Math.sin(this.time * 4) * 0.03);
        } else if (s.kind === 'enemy' && !s.unit.dead) {
          const v = this.enemyViews.get(s.unit.id);
          if (v) { this.selMesh.visible = true; this.selMesh.material.color.set(0xEC6450).multiplyScalar(2); this.selMesh.position.set(v.pos.x, (s.unit.fly ? 0.3 : v.pos.y) + 0.2, v.pos.z); this.selMesh.scale.setScalar((s.unit.def.boss ? 2.2 : 0.7) * (1 + Math.sin(this.time * 5) * 0.04)); }
        } else this.selMesh.visible = false;
      } else if (this.selMesh) this.selMesh.visible = false;
    }

    syncNodes(dt) {
      const g = this.game;
      for (const nd of g.nodes) {
        let st = 'direct';
        if (nd.tower || nd.isolator) st = 'isolated';
        else if (g.blocked[nd.idx]) st = 'blocked';
        else if (nd.lockT > 0) st = 'lockout';
        this.world.setNodeState(nd.index, st);
      }
      for (const nd of g.nodes) {
        const iv = this.isoViews.get(nd.index);
        if (nd.isolator && !iv) {
          const model = TD.makeIsolator();
          model.root.position.set(this.X(nd.x), 0.1, this.Z(nd.y));
          this.overlayGroup.add(model.root);
          this.isoViews.set(nd.index, { model });
        } else if (!nd.isolator && iv) {
          iv.model.dispose();
          this.isoViews.delete(nd.index);
        } else if (iv) iv.model.update(dt, { hit: nd.isolator.hitAnim });
      }
    }

    syncTowers(dt, simDt) {
      const g = this.game;
      for (const t of g.towers) {
        let v = this.towerViews.get(t.id);
        if (!v) v = this.addTowerView(t);
        if (v.level !== t.level || v.branch !== t.branch) {
          v.model.dispose();
          v.model = this.makeTowerModel(t);
          this.overlayGroup.add(v.model.root);
          v.level = t.level; v.branch = t.branch; v.spawn = 0.6;
          this.placeTowerRoot(v, t);
        }
        if (v.spawn > 0) {
          v.spawn = Math.max(0, v.spawn - dt);
          const k = 1 - v.spawn / 0.6;
          const e = 1 - Math.pow(1 - k, 3);
          const y = t.type === 'firewall' || t.type === 'gate' ? 1 : Math.max(0.05, e + Math.sin(k * 8) * 0.06 * (1 - k));
          v.model.root.scale.set(1, v.spawn > 0 ? y : 1, 1);
        }
        const st = v.st;
        st.fire = t.fireAnim; st.hit = t.hitAnim; st.enc = t.encT > 0; st.skill = t.skillT > 0 || (t.type === 'honeypot' && t.blocked.some(e => e.trapT > 0));
        st.blocked = t.blocked.length; st.dir = t.dir; st.aim = t.aim; st.hasTarget = !!t.attackTarget; st.arc = (t.s.arc || 60) * Math.PI / 360;
        st.healing = t.healTargets.length > 0;
        st.build = v.spawn > 0 ? 1 - v.spawn / 0.6 : null;
        v.model.update(simDt, st);
        const mv = t.ghostT > 0 ? 'ghost' : t.encT > 0 ? 'encrypt' : t.hitAnim > 0.65 ? 'flash' : 'normal';
        v.model.setVariant(mv);
        // 工作脉冲：只在真的有工作时出现，不抢画面
        v.pulseT = (v.pulseT || Math.random()) - simDt;
        if (v.pulseT <= 0 && !(t.encT > 0) && !(t.ghostT > 0)) {
          if (t.type === 'honeypot') {
            v.pulseT = 2.1;
            const near = g.enemies.some(e => !e.fly && e.def.lurable && Math.hypot(e.x - t.x, e.y - t.y) < t.s.lureR + 2);
            if (near) this.fx.ring(this.X(t.x), 0.2, this.Z(t.y), t.s.lureR * S, 0x6E5418, 0.95, { w: 0.05, r0: 0.5 });
          } else if (t.type === 'sandbox') {
            v.pulseT = 2.7;
            const near = g.enemies.some(e => !e.fly && Math.hypot(e.x - t.x, e.y - t.y) < t.s.range + 1.5);
            if (near) this.fx.ring(this.X(t.x), PLAT_Y + 0.12, this.Z(t.y), t.s.range * S, 0x2F5A32, 1.1, { w: 0.03, r0: 0.5 });
          } else if (t.type === 'repair') {
            v.pulseT = 1.5;
            if (t.healTargets.length) this.fx.ring(this.X(t.x), PLAT_Y + 0.12, this.Z(t.y), t.s.range * S, 0x24604E, 0.9, { w: 0.03, r0: 0.5 });
          } else v.pulseT = 5;
        }
        // 护盾泡
        this.syncShield(v, t);
        // 加密环
        this.syncEncrypt(v, t, dt);
        // 治疗束
        if (t.type === 'repair' && t.healTargets.length) {
          const from = v.model.root.position;
          for (const o of t.healTargets) {
            const tp = this.towerViews.get(o.id);
            if (!tp) continue;
            const to = tp.model.root.position;
            const h1 = v.model.height + 0.1, h2 = tp.model.height * 0.55;
            this.fx.frameBeam(from.x, from.y + h1, from.z, to.x, to.y + h2, to.z, new THREE.Color(0.45, 1.9, 1.35), 0.06 + Math.sin(this.time * 12) * 0.02, 0.85);
            if (Math.random() < simDt * 30) {
              const k = Math.random();
              this.fx.p(from.x + (to.x - from.x) * k, from.y + h1 + (to.y + h2 - from.y - h1) * k, from.z + (to.z - from.z) * k, 0, 0.8, 0, 0.5, 0.22, 0.45, 1.9, 1.35, { size2: 0.02 });
            }
            if (Math.random() < simDt * 14) this.fx.p(to.x + (Math.random() - 0.5) * 0.9, to.y + 0.2 + Math.random() * h2, to.z + (Math.random() - 0.5) * 0.9, 0, 1.4, 0, 0.7, 0.3, 0.45, 1.9, 1.4, { size2: 0.02 });
          }
        }
        // 阻挡连线
        if (t.blocked.length) {
          const from = v.model.root.position;
          for (const e of t.blocked) {
            const ev = this.enemyViews.get(e.id);
            if (!ev) continue;
            this.fx.frameBeam(from.x, from.y + 0.5, from.z, ev.pos.x, ev.pos.y + 0.45, ev.pos.z, new THREE.Color(1.7, 0.85, 0.35), 0.035, 0.75);
          }
        }
        // 拦截器锁定线
        if (t.attackTarget && t.type === 'interceptor') {
          const ev = this.enemyViews.get(t.attackTarget.id);
          if (ev && this.selected && this.selected.unit === t) {
            const from = v.model.root.position;
            this.fx.frameBeam(from.x, from.y + 1, from.z, ev.pos.x, ev.pos.y + 0.5, ev.pos.z, new THREE.Color(0.45, 1.5, 2.1), 0.02, 0.5);
          }
        }
      }
      for (const [id, v] of this.towerViews) {
        if (v.unit.gone) {
          if (!v.removing) { this.removeTowerView(v); }
          this.towerViews.delete(id);
        }
      }
    }

    makeTowerModel(t) { return TD.makeTower(t.type, t.level, t.branch, { onNode: t.onNode }); }

    placeTowerRoot(v, t) {
      v.model.root.position.set(this.X(t.x), this.groundAt(t.x, t.y) + (t.onNode ? 0.08 : t.cat === 'link' ? 0.02 : 0), this.Z(t.y));
      this.orientTower(v.model.root, t.type, t.x, t.y);
    }

    addTowerView(t) {
      const model = this.makeTowerModel(t);
      this.overlayGroup.add(model.root);
      const v = { unit: t, model, st: {}, level: t.level, branch: t.branch, spawn: t.preplaced ? 0 : 0.6, shield: null, enc: null, hpLag: t.hp };
      this.placeTowerRoot(v, t);
      this.towerViews.set(t.id, v);
      return v;
    }

    removeTowerView(v) {
      const t = v.unit;
      if (v.shield) v.shield.removeFromParent();
      if (v.enc) v.enc.removeFromParent();
      v.model.setVariant('normal');
      if (v.sold) { this.dying.push({ model: v.model, retract: 0 }); return; }
      v.model.beginDie('bits');
      this.dying.push({ model: v.model, dur: 0.95 });
      this.addScorch(t.x, t.y);
    }

    syncShield(v, t) {
      if (t.shield > 0) {
        if (!v.shield) {
          v.shield = new THREE.Mesh(this.shieldGeo(), this.shieldMat());
          v.shield.renderOrder = 9;
          this.overlayGroup.add(v.shield);
          v.shieldK = 0;
        }
        v.shieldK = Math.min(1, v.shieldK + 0.08);
        const h = v.model.height;
        v.shield.position.copy(v.model.root.position).setY(v.model.root.position.y + h * 0.45);
        const s = 1.2 + h * 0.2;
        v.shield.scale.set(s * v.shieldK, (h * 0.75 + 0.4) * v.shieldK, s * v.shieldK);
        v.shield.material = this.shieldMat(Math.min(1, t.shield / 80));
      } else if (v.shield) { v.shield.removeFromParent(); v.shield = null; }
    }

    shieldGeo() { return this._sg || (this._sg = new THREE.IcosahedronGeometry(1, 3)); }
    shieldMat(k) {
      if (!this._sm) {
        this._sm = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          uniforms: { uTime: this.world.uTime, c: { value: new THREE.Color(0x8FD6F0) } },
          vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
          fragmentShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV; uniform float uTime; uniform vec3 c;
            void main(){ float f=pow(1.-abs(dot(vN,vV)),2.2); vec2 q=vP.xz*6.; q.x+=mod(floor(q.y),2.)*.5; vec2 g=abs(fract(q)-.5); float hex=smoothstep(.42,.5,max(g.x,g.y));
              float sc=step(.86,fract(vP.y*2.-uTime*.8)); gl_FragColor=vec4(c*(f*1.7+hex*.28*(.5+f)+sc*.2)*.95,1.);
}`,
        });
      }
      return this._sm;
    }

    syncEncrypt(v, t, dt) {
      if (t.encT > 0) {
        if (!v.enc) {
          const m = new Mesher();
          for (let i = 0; i < 3; i++) {
            const a = i * 2.094;
            m.pushM(); m.tf(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78, 0, -a, 0);
            m.box(0, 0, 0, 0.22, 0.18, 0.08, 0xB08CF0, { bevel: 0.015 });
            m.torus(0, 0.08, 0, 0.07, 0.02, 0xDCCBF5, { arc: Math.PI, seg: 8 });
            m.popM();
          }
          m.torus(0, 0, 0, 0.78, 0.018, 0xB08CF0, { rx: Math.PI / 2, seg: 32 });
          v.enc = new THREE.Mesh(m.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.0, 2.6) }));
          this.overlayGroup.add(v.enc);
        }
        v.enc.position.copy(v.model.root.position).setY(v.model.root.position.y + v.model.height * 0.68);
        v.enc.rotation.y += dt * 2.4;
        v.enc.rotation.z = Math.sin(this.time * 2) * 0.1;
      } else if (v.enc) { v.enc.removeFromParent(); v.enc = null; }
    }

    syncEnemies(dt, simDt) {
      const g = this.game;
      for (const e of g.enemies) {
        let v = this.enemyViews.get(e.id);
        if (!v) v = this.addEnemyView(e);
        const lateral = this.enemyLateral(e, v);
        // 目标位置：路线位置 + 横向车道
        const hd = Math.atan2(e.ty - e.y, e.tx - e.x);
        let dx = e.tx - e.x, dy = e.ty - e.y;
        if (Math.hypot(dx, dy) < 0.001 && v.lastDir) { dx = v.lastDir[0]; dy = v.lastDir[1]; }
        const L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L, ny = dx / L;
        v.lane += (lateral - v.lane) * Math.min(1, simDt * 5);
        const tx = this.X(e.x) + nx * v.lane * S, tz = this.Z(e.y) + ny * v.lane * S;
        const base = e.fly ? FLY_Y : this.enemyGroundY(e);
        if (v.first) { v.pos.set(tx, base, tz); v.first = false; }
        const moved = Math.hypot(tx - v.pos.x, tz - v.pos.z);
        v.pos.x += (tx - v.pos.x) * Math.min(1, simDt * 14);
        v.pos.z += (tz - v.pos.z) * Math.min(1, simDt * 14);
        v.pos.y += (base - v.pos.y) * Math.min(1, simDt * 8);
        v.model.root.position.copy(v.pos);
        // 从入口冒出来：身体由小变大、由下而上
        if (v.born < 0.5) {
          v.born += simDt;
          const b = Math.min(1, v.born / 0.5), eb = 1 - (1 - b) * (1 - b);
          v.model.root.scale.setScalar(v.scale * (0.2 + 0.8 * eb));
          if (!e.fly) v.model.root.position.y -= (1 - eb) * 1.1;
          else v.model.root.position.y -= (1 - eb) * 2.4;
        }
        // 转向
        let faceAngle;
        const lockOn = e.blockedBy && !e.blockedBy.gone ? e.blockedBy : (e.sieging && e.siegeNode ? e.siegeNode : null);
        if (lockOn) faceAngle = Math.atan2(this.X(lockOn.x) - v.pos.x, this.Z(lockOn.y) - v.pos.z);
        else if (e.fly) faceAngle = Math.atan2(dx, dy);
        else if (L > 0.001) faceAngle = Math.atan2(dx, dy);
        else faceAngle = v.face;
        let d = faceAngle - v.face;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const turnRate = e.def.boss ? 2.6 : 8;
        v.face += d * Math.min(1, simDt * turnRate);
        v.model.root.rotation.y = v.face;
        // 转弯时身体倾斜，飞行单位压坡度更明显
        const rollT = Math.max(-0.42, Math.min(0.42, d * (e.fly ? 0.7 : 0.24)));
        v.roll += (rollT - v.roll) * Math.min(1, simDt * 8);
        v.model.root.rotation.z = -v.roll;
        if (L > 0.001) v.lastDir = [dx, dy];
        const st = v.st;
        st.moving = !e.blockedBy && !e.sieging && e.trapT <= 0 && moved > 0.0001;
        st.chain = true;
        // Boss 落足扬尘与震感
        if (e.type === 'wankui' && st.moving) {
          v.stepT = (v.stepT || 0) - simDt;
          if (v.stepT <= 0) {
            v.stepT = 0.68;
            const a = Math.random() * 6.28, rr = 2.2 + Math.random() * 0.8;
            this.fx.burst(v.pos.x + Math.cos(a) * rr, 0.2, v.pos.z + Math.sin(a) * rr, 0x9a8f7a, 9, 2.2, 0.32, 0.45, { flat: true, grav: 0.5 });
            this.shake = Math.max(this.shake, 0.1);
          }
        }
        st.blocked = !!e.blockedBy; st.sieging = !!e.sieging; st.attack = e.atkAnim; st.hit = e.hitAnim; st.phase = e.phase || 0;
        st.revealed = !e.stealth || e.revealed || e.revealT > 0;
        st.speedF = this.game.slow[this.game.idx(Math.round(e.x), Math.round(e.y))] ? 0.55 : 1;
        if (e.supT > 0) st.speedF *= 0.55;
        st.aimRel = null;
        if (e.def.ranged && e.aimTarget) {
          const a = Math.atan2(this.X(e.aimTarget.x) - v.pos.x, this.Z(e.aimTarget.y) - v.pos.z);
          st.aimRel = Math.atan2(Math.sin(a - v.face), Math.cos(a - v.face));
        }
        v.model.update(simDt, st);
        // 外观状态
        let mv = 'normal';
        if (e.type === 'zheying' && e.phase === 0) mv = e.revealT > 0 ? 'normal' : 'shadow';
        else if (e.trapT > 0) mv = 'trap';
        else if (e.hitAnim > 0.6) mv = 'flash';
        v.model.setVariant(mv);
        if (e.fly) {
          this.fx.frameBeam(v.pos.x, v.pos.y - 0.2, v.pos.z, v.pos.x, 0.12, v.pos.z, new THREE.Color(1.1, 0.55, 0.72), 0.018, 0.55);
          if (!v.groundMark) {
            const gm = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.5, 0.8), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
            gm.renderOrder = 6;
            this.overlayGroup.add(gm);
            v.groundMark = gm;
          }
          v.groundMark.position.set(v.pos.x, this.groundAt(e.x, e.y) + 0.16, v.pos.z);
        }
        // 敌人护盾
        if (e.shield > 0.5) {
          if (!v.shield) { v.shield = new THREE.Mesh(this.shieldGeo(), this.enemyShieldMat()); v.shield.renderOrder = 9; this.overlayGroup.add(v.shield); }
          const s = (e.def.r + 0.12) * S * (0.92 + 0.14 * Math.min(1, e.shield / 90));
          v.shield.position.set(v.pos.x, v.pos.y + v.model.height * 0.42 * v.scale, v.pos.z);
          v.shield.scale.set(s, s * 0.9, s);
        } else if (v.shield) { v.shield.removeFromParent(); v.shield = null; }
        // 被困网
        if (e.trapT > 0) {
          if (!v.net) {
            const m = new Mesher();
            for (let i = 0; i < 4; i++) m.torus(0, 0, 0, 0.72, 0.012, 0xEAC15A, { ry: i * 0.785, seg: 24, glow: 3 });
            m.torus(0, 0.3, 0, 0.64, 0.012, 0xEAC15A, { rx: Math.PI / 2, seg: 24, glow: 3 });
            m.torus(0, -0.3, 0, 0.64, 0.012, 0xEAC15A, { rx: Math.PI / 2, seg: 24, glow: 3 });
            v.net = new THREE.Mesh(m.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.1, 1.3) }));
            this.overlayGroup.add(v.net);
          }
          v.net.position.set(v.pos.x, v.pos.y + 0.5, v.pos.z);
          v.net.rotation.y += simDt * 1.2;
        } else if (v.net) { v.net.removeFromParent(); v.net = null; }
      }
      for (const [id, v] of this.enemyViews) {
        if (v.unit.dead) {
          this.killEnemyView(v);
          this.enemyViews.delete(id);
        }
      }
      for (let i = this.dying.length - 1; i >= 0; i--) {
        const d = this.dying[i];
        const sd = simDt > 0 ? simDt : 0;
        if (d.retract != null) {
          d.retract += sd / 0.45;
          TD.retractModel(d.model, Math.min(1, d.retract));
          if (d.retract >= 1) { d.model.dispose(); this.dying.splice(i, 1); }
          continue;
        }
        if (d.leak != null) {
          d.leak += sd / 0.5;
          const k = Math.min(1, d.leak), e = k * k;
          const r = d.model.root;
          r.position.set(d.x0 + (d.x1 - d.x0) * e, d.y0 + Math.sin(k * Math.PI) * 1.2 + k * 1.4, d.z0 + (d.z1 - d.z0) * e);
          r.scale.setScalar(Math.max(0.02, d.s0 * (1 - e)));
          r.rotation.y += sd * 14;
          if (k >= 1) { d.model.dispose(); this.dying.splice(i, 1); }
          continue;
        }
        if (sd > 0 && d.model.stepDie(sd, d.dur, this.fx, this)) { d.model.dispose(); this.dying.splice(i, 1); }
      }
    }

    enemyShieldMat() {
      if (!this._esm) { this._esm = this.shieldMat().clone(); this._esm.uniforms.c.value = new THREE.Color(0x8A4FA0); this._esm.uniforms.uTime = this.world.uTime; }
      return this._esm;
    }

    enemyGroundY(e) {
      return (this.game.map.tiles[this.game.idx(Math.round(e.x), Math.round(e.y))] === TT.NODE ? 0.14 : 0.0) + 0.03;
    }

    // 车道：超出阻挡容量的敌人挤到边缘，被挡敌人展开排列
    enemyLateral(e, v) {
      if (e.fly || e.def.boss) return 0;
      let lane = e.lane * 0.55;
      if (e.blockedBy && !e.blockedBy.gone) {
        const idx = e.blockedBy.blocked.indexOf(e);
        const n = e.blockedBy.blocked.length;
        lane = (idx - (n - 1) / 2) * 0.24;
      } else {
        const ti = this.game.idx(e.tx, e.ty);
        const t = this.game.towerAt[ti];
        if (t && !t.onNode && Math.hypot(e.x - e.tx, e.y - e.ty) < 1.1) lane = Math.sign(lane || 1) * 0.36;
        const c = this.game.towerAt[this.game.idx(Math.round(e.x), Math.round(e.y))];
        if (c && !c.onNode && Math.hypot(e.x - c.x, e.y - c.y) < 0.9) lane = Math.sign(lane || 1) * 0.36;
      }
      return lane;
    }

    addEnemyView(e) {
      const model = TD.makeEnemy(e.type, { clone: e.clone });
      this.overlayGroup.add(model.root);
      const scale = e.def.boss ? 1 : (e.type === 'flood' ? 1.28 : e.type === 'hotspot' ? 1.3 : 1.2);
      model.root.scale.setScalar(scale);
      model.root.rotation.order = 'YXZ';
      const v = { unit: e, model, st: {}, pos: new V3(), first: true, lane: e.lane * 0.5, face: 0, roll: 0, born: 0, scale, hpLag: e.hp, shield: null, net: null };
      const dx = e.tx - e.x, dy = e.ty - e.y;
      if (Math.hypot(dx, dy) > 0.01) v.face = Math.atan2(dx, dy);
      this.enemyViews.set(e.id, v);
      if (!e.fly) this.fx.ring(this.X(e.x), 0.15, this.Z(e.y), 1.2, TD.ENTRANCE_COLORS[e.ent] || 0xffffff, 0.45, { w: 0.2 });
      return v;
    }

    killEnemyView(v) {
      const e = v.unit;
      if (v.shield) v.shield.removeFromParent();
      if (v.net) v.net.removeFromParent();
      if (v.groundMark) v.groundMark.removeFromParent();
      if (e.leaked) {
        // 被吸进出口
        const ex = this.game.map.exits.reduce((a, b) => Math.hypot(a.x - e.x, a.y - e.y) < Math.hypot(b.x - e.x, b.y - e.y) ? a : b);
        this.dying.push({ model: v.model, leak: 0, x0: v.pos.x, y0: v.pos.y, z0: v.pos.z, x1: this.X(ex.x), z1: this.Z(ex.y), s0: v.scale });
        return;
      }
      v.model.setVariant('normal');
      v.model.beginDie();
      this.dying.push({ model: v.model, dur: e.def.boss ? 2.2 : 0.6 });
    }

    syncShots(dt, simDt) {
      const g = this.game;
      const alive = new Set(g.shots);
      for (const [s, v] of this.shotViews) {
        if (!alive.has(s)) { v.obj.removeFromParent(); this.shotViews.delete(s); }
      }
      for (const s of g.shots) {
        let v = this.shotViews.get(s);
        if (!v) { v = this.addShotView(s); this.shotViews.set(s, v); }
        const x = this.X(s.x), z = this.Z(s.y);
        let y;
        const startY = v.startY;
        const endY = s.target && s.target.fly ? FLY_Y + 0.3 : (s.towerTarget ? this.groundAt(s.towerTarget.x, s.towerTarget.y) + (this.towerViews.get(s.towerTarget.id)?.model.height || 1) * 0.6 : 0.5);
        const total = Math.max(0.01, Math.hypot((s.tx != null ? s.tx : s.x) - s.sx0, (s.ty != null ? s.ty : s.y) - s.sy0));
        const prog = Math.min(1, Math.hypot(s.x - s.sx0, s.y - s.sy0) / total);
        if (s.kind === 'orb') y = startY + (endY - startY) * prog + Math.sin(prog * Math.PI) * 3.2;
        else y = startY + (endY - startY) * prog;
        const prev = v.obj.position.clone();
        v.obj.position.set(x, y, z);
        const dirv = v.obj.position.clone().sub(prev);
        if (dirv.lengthSq() > 1e-6) v.obj.lookAt(v.obj.position.clone().add(dirv));
        if (s.kind === 'orb') { if (Math.random() < simDt * 60) this.fx.p(x, y, z, 0, 0.3, 0, 0.5, 0.42, 0.8, 1.9, 0.8, { size2: 0.03 }); v.obj.rotation.z += dt * 8; }
        else if (s.kind === 'shard') { if (Math.random() < simDt * 50) this.fx.p(x, y, z, 0, 0, 0, 0.35, 0.26, 1.3, 0.85, 2.3, { size2: 0.02 }); }
        else if (s.kind === 'bolt') { if (Math.random() < simDt * 40) this.fx.p(x, y, z, 0, 0, 0, 0.18, 0.18, 0.55, 1.6, 2.3, { size2: 0.02 }); }
        else if (s.kind === 'suppress') { if (Math.random() < simDt * 50) this.fx.p(x, y, z, 0, 0, 0, 0.26, 0.26, 1.2, 1.05, 2.4, { size2: 0.02 }); }
      }
    }

    addShotView(s) {
      s.sx0 = s.x; s.sy0 = s.y;
      const startY = s.tower ? this.groundAt(s.x, s.y) + (s.tower.type === 'sandbox' ? 2.2 : 1.1) : 1.1;
      let obj;
      if (s.kind === 'bolt') {
        obj = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.05, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.5, 3.1) }));
      } else if (s.kind === 'suppress') {
        obj = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.75, 3.6) }));
      } else if (s.kind === 'orb') {
        const m = new Mesher();
        m.sph(0, 0, 0, 0.22, 0xA6D88F, { seg: 12 });
        m.box(0, 0, 0, 0.3, 0.3, 0.3, 0xE8F2D8, { rx: 0.7, rz: 0.7 });
        obj = new THREE.Mesh(m.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 2.3, 1.5) }));
      } else {
        const m = new Mesher();
        m.box(0, 0, 0, 0.2, 0.16, 0.08, 0xB08CF0, {});
        m.torus(0, 0.08, 0, 0.065, 0.02, 0xDCCBF5, { arc: Math.PI, seg: 8 });
        m.cone(0, 0, -0.4, 0.08, 0.6, 5, 0x6C45C8, { rx: -Math.PI / 2 });
        obj = new THREE.Mesh(m.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.0, 3.0) }));
      }
      obj.position.set(this.X(s.x), startY, this.Z(s.y));
      this.overlayGroup.add(obj);
      return { obj, startY };
    }

    syncAreas(dt, simDt) {
      const g = this.game;
      // 协议降级
      const zset = new Set(g.zones);
      for (const [z, m] of this.zoneMeshes) if (!zset.has(z)) { m.removeFromParent(); this.zoneMeshes.delete(z); }
      for (const z of g.zones) {
        if (!this.zoneMeshes.has(z)) {
          const me = new Mesher();
          for (const i of z.tiles) {
            const x = i % g.map.w, y = (i / g.map.w) | 0;
            me.plane(this.X(x), 0.12, this.Z(y), 1.9, 1.9, new THREE.Color(1, 1, 1), { u0: x, v0: y });
          }
          const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false,
            uniforms: { uTime: this.world.uTime, uA: { value: 1 } },
            vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
            fragmentShader: `varying vec2 vU; uniform float uTime,uA; void main(){ float s=step(.5,fract((vU.x+vU.y)*1.5-uTime*.3)); vec2 g=abs(fract(vU)-.5); float e=smoothstep(.42,.48,max(g.x,g.y)); vec3 c=mix(vec3(1.25,.85,.3),vec3(.42,.28,.08),s); gl_FragColor=vec4(c+vec3(1.5,1.05,.4)*e,(.42+e*.5)*uA);
}`,
          });
          const mesh = new THREE.Mesh(me.geometry(), mat);
          mesh.renderOrder = 5;
          mesh.frustumCulled = false;
          this.overlayGroup.add(mesh);
          this.zoneMeshes.set(z, mesh);
        }
        const m = this.zoneMeshes.get(z);
        m.material.uniforms.uA.value = Math.min(1, z.t * 1.4);
      }
      // 黑洞 / 锁死
      const hset = new Set(g.holes);
      for (const [h, m] of this.holeMeshes) if (!hset.has(h)) { m.removeFromParent(); this.holeMeshes.delete(h); }
      for (const h of g.holes) {
        if (!this.holeMeshes.has(h)) this.holeMeshes.set(h, this.makeHoleMesh(h));
        const m = this.holeMeshes.get(h);
        m.userData.spin && m.userData.spin(dt);
        if (simDt > 0) for (const i of h.tiles) {
          const hx = this.X(i % g.map.w), hz = this.Z((i / g.map.w) | 0);
          if (h.kind === 'hole') {
            if (Math.random() < simDt * 22) {
              const a = Math.random() * 6.28, r = 1.3 + Math.random() * 0.5;
              this.fx.p(hx + Math.cos(a) * r, 0.3 + Math.random() * 0.5, hz + Math.sin(a) * r, -Math.cos(a) * r * 2.2, -0.2, -Math.sin(a) * r * 2.2, 0.42, 0.2, 0.85, 0.55, 1.4, { size2: 0.02 });
            }
          } else if (Math.random() < simDt * 7) {
            this.fx.burst(hx + (Math.random() - 0.5) * 1.4, 0.9, hz + (Math.random() - 0.5) * 1.4, 0xE8342E, 3, 2.2, 0.12, 0.3, { grav: 8 });
          }
        }
      }
      // 预警
      const wset = new Set(g.warnings);
      for (const [w, m] of this.warnMeshes) if (!wset.has(w)) { m.removeFromParent(); this.warnMeshes.delete(w); }
      for (const w of g.warnings) {
        if (!this.warnMeshes.has(w)) this.warnMeshes.set(w, this.makeWarnMesh(w));
        const m = this.warnMeshes.get(w);
        const k = 1 - w.t / w.tmax;
        m.material.uniforms.k.value = k;
        // 指向线：看得出是谁、要打哪里，越接近发动越粗
        const bv = w.boss && this.enemyViews.get(w.boss.id);
        if (bv) {
          const col = w.kind === 'surge' ? new THREE.Color(1.5, 0.55, 0.18) : w.kind === 'hole' ? new THREE.Color(0.95, 0.55, 1.5) : new THREE.Color(1.5, 0.25, 0.18);
          const i0 = w.tiles[0];
          const blink = 0.45 + 0.55 * Math.abs(Math.sin(this.time * (5 + k * 11)));
          this.fx.frameBeam(bv.pos.x, bv.pos.y + bv.model.height * 0.55, bv.pos.z, this.X(i0 % g.map.w), 0.4, this.Z((i0 / g.map.w) | 0), col, 0.03 + k * 0.05, blink);
        }
      }
      // 残留场
      const rset = new Set(g.residues);
      for (const [r, m] of this.residueMeshes) if (!rset.has(r)) { m.removeFromParent(); this.residueMeshes.delete(r); }
      for (const r of g.residues) {
        if (!this.residueMeshes.has(r)) {
          const mesh = new THREE.Mesh(new THREE.CircleGeometry(r.r * S, 32).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, uniforms: { uTime: this.world.uTime, uA: { value: 1 } },
            vertexShader: `varying vec2 vU; varying vec3 vP; void main(){ vU=uv; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
            fragmentShader: `varying vec2 vU; uniform float uTime,uA; void main(){ float d=length(vU-.5)*2.; float b=sin(d*20.-uTime*5.)*.5+.5; gl_FragColor=vec4(vec3(.42,.9,.46)*(.5+b*.7),(1.-d*d)*.24*uA);
}`,
          }));
          mesh.position.set(this.X(r.x), 0.13, this.Z(r.y));
          mesh.renderOrder = 5;
          this.overlayGroup.add(mesh);
          this.residueMeshes.set(r, mesh);
        }
        this.residueMeshes.get(r).material.uniforms.uA.value = Math.min(1, r.t * 2);
      }
    }

    makeHoleMesh(h) {
      const group = new THREE.Group();
      const g = this.game;
      const purple = h.kind === 'hole';
      const spinners = [];
      for (const i of h.tiles) {
        const x = i % g.map.w, y = (i / g.map.w) | 0;
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
          transparent: true, depthWrite: false,
          uniforms: { uTime: this.world.uTime, c: { value: new THREE.Color(purple ? 0x9B6BE0 : 0xE8342E) } },
          vertexShader: `varying vec2 vU; void main(){ vU=uv*2.-1.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
          fragmentShader: `varying vec2 vU; uniform float uTime; uniform vec3 c; void main(){ float r=length(vU); float a=atan(vU.y,vU.x); float s=sin(a*4.+r*16.-uTime*7.)*.5+.5; float rim=smoothstep(.72,.98,r); vec3 col=c*(s*rim*2.4)+c*2.8*smoothstep(.9,1.,r); float al=smoothstep(1.,.92,r); col*=step(.0,r); vec3 k=mix(vec3(0.),col,smoothstep(.3,.9,r)); gl_FragColor=vec4(k,al);
}`,
        }));
        mesh.position.set(this.X(x), 0.2, this.Z(y));
        mesh.renderOrder = 6;
        group.add(mesh);
        if (!purple) {
          // 锁死：红色铁闸与锁链
          const m = new Mesher();
          for (const s of [-1, 1]) { m.box(s * 0.6, 0.6, 0, 0.14, 1.2, 1.6, 0x3a0d12, { bevel: 0.02 }); m.box(s * 0.68, 0.9, 0, 0.02, 0.1, 1.4, 0xE8342E, { glow: 5 }); }
          m.box(0, 1.2, 0, 1.5, 0.14, 0.2, 0x5d1218, { bevel: 0.02 });
          m.box(0, 1.2, 0.12, 0.3, 0.3, 0.05, 0xE8342E, { glow: 5 });
          const lock = new THREE.Mesh(m.geometry(), TD.Gfx.patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.4 })));
          lock.position.set(this.X(x), 0.05, this.Z(y));
          const horiz = this.world.isRoad(x - 1, y) || this.world.isRoad(x + 1, y);
          if (!horiz) lock.rotation.y = Math.PI / 2;
          group.add(lock);
        } else {
          const swirl = new Mesher();
          for (let k = 0; k < 3; k++) swirl.torus(0, 0.2 + k * 0.4, 0, 0.7 - k * 0.12, 0.018, 0xCDB0F5, { rx: Math.PI / 2, seg: 24, glow: 3 });
          const sm = new THREE.Mesh(swirl.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.2, 1.6, 2.6) }));
          sm.position.set(this.X(x), 0.1, this.Z(y));
          group.add(sm);
          spinners.push(sm);
        }
        this.fx.ring(this.X(x), 0.25, this.Z(y), 2.2, purple ? 0x9B6BE0 : 0xE8342E, 0.7, { w: 0.2, fill: 0.6 });
        this.fx.pillar(this.X(x), 0, this.Z(y), 1.1, 7, purple ? 0x9B6BE0 : 0xE8342E, 0.9);
      }
      group.userData.spin = (dt) => { for (const s of spinners) { s.rotation.y += dt * 2.6; s.position.y = 0.1 + Math.sin(this.time * 3) * 0.1; } };
      this.overlayGroup.add(group);
      return group;
    }

    makeWarnMesh(w) {
      const me = new Mesher();
      const g = this.game;
      for (const i of w.tiles) me.plane(this.X(i % g.map.w), 0.26, this.Z((i / g.map.w) | 0), 2.05, 2.05, new THREE.Color(1, 1, 1), { u0: 0, v0: 0 });
      const col = w.kind === 'surge' ? 0xEE6A2E : w.kind === 'hole' ? 0x9B6BE0 : 0xE8342E;
      const mesh = new THREE.Mesh(me.geometry(), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: this.world.uTime, k: { value: 0 }, c: { value: new THREE.Color(col) } },
        vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
        fragmentShader: `varying vec2 vU; uniform float uTime,k; uniform vec3 c; void main(){ vec2 p=abs(vU-.5)*2.; float e=smoothstep(.78,.92,max(p.x,p.y)); float st=step(.5,fract((vU.x+vU.y)*3.-uTime*2.)); float blink=.55+.45*sin(uTime*(8.+k*16.)); gl_FragColor=vec4(c*2.6,(e*.95+st*.34*(1.-e))*blink);
}`,
      }));
      mesh.renderOrder = 7;
      mesh.frustumCulled = false;
      this.overlayGroup.add(mesh);
      return mesh;
    }

    syncTraffic(dt, simDt) {
      if (!this.trafficMesh) return;
      const g = this.game;
      const ents = g.map.entrances;
      const d = this._d || (this._d = new THREE.Object3D());
      const w = g.map.w;
      for (let i = 0; i < this.traffic.length; i++) {
        const p = this.traffic[i];
        const en = ents[i % ents.length];
        const r = g.routes[en.id];
        if (!r || r.path.length < 2) continue;
        p.u += simDt * p.sp / r.path.length;
        if (p.u >= 1) p.u -= 1;
        const f = p.u * (r.path.length - 1), k = Math.floor(f), t = f - k;
        const a = r.path[k], b = r.path[Math.min(k + 1, r.path.length - 1)];
        const ax = a % w, ay = (a / w) | 0, bx = b % w, by = (b / w) | 0;
        const off = ((i * 7) % 5 - 2) * 0.18;
        const lx = -(by - ay) * off, ly = (bx - ax) * off;
        d.position.set(this.X(ax + (bx - ax) * t + lx * 0.5), 0.2 + Math.sin(this.time * 3 + i) * 0.015, this.Z(ay + (by - ay) * t + ly * 0.5));
        d.rotation.y = Math.atan2(bx - ax, by - ay);
        d.scale.setScalar(0.72);
        d.updateMatrix();
        this.trafficMesh.setMatrixAt(i, d.matrix);
      }
      this.trafficMesh.instanceMatrix.needsUpdate = true;
    }

    // 塔被摧毁后留下的灼痕，几秒后消退
    addScorch(x, y) {
      if (!this._scorchTex) {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
        gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(0.55, 'rgba(10,6,4,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        g.strokeStyle = 'rgba(226,120,64,.55)'; g.lineWidth = 1.5;
        for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, r = 12 + Math.random() * 40; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); g.stroke(); }
        this._scorchTex = new THREE.CanvasTexture(c);
        this._scorchTex.colorSpace = THREE.SRGBColorSpace;
      }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this._scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
      m.position.set(this.X(x), this.groundAt(x, y) + 0.03, this.Z(y));
      m.rotation.y = Math.random() * 6.28;
      m.renderOrder = 3;
      this.fx.addMisc(m, 7, (o, dt, k) => { o.material.opacity = 1 - k * k; });
    }

    // ────────── 事件表现 ──────────
    onEvent(ev) {
      if (!this.world) return;
      const fx = this.fx, X = (v) => this.X(v), Z = (v) => this.Z(v);
      switch (ev.type) {
        case 'towerPlaced': {
          const t = ev.tower, gy = this.groundAt(t.x, t.y);
          fx.ring(X(t.x), gy + 0.2, Z(t.y), 2.4, TD.ROLE_COLORS[t.def.roleKey], 0.6, { w: 0.25, fill: 0.4 });
          fx.burst(X(t.x), gy + 0.3, Z(t.y), TD.ROLE_COLORS[t.def.roleKey], 22, 3.2, 0.26, 0.7, { up: 1.4, grav: 1 });
          break;
        }
        case 'towerUpgraded': {
          const t = ev.tower, gy = this.groundAt(t.x, t.y);
          fx.pillar(X(t.x), gy, Z(t.y), 1.1, 9, TD.ROLE_COLORS[t.def.roleKey], 0.9);
          fx.ring(X(t.x), gy + 0.2, Z(t.y), 3.2, 0xffffff, 0.7, { w: 0.15 });
          fx.burst(X(t.x), gy + 1, Z(t.y), 0xffffff, 30, 4, 0.2, 0.8, { up: 2, grav: 2 });
          break;
        }
        case 'towerSold': {
          const t = ev.tower;
          const v = this.towerViews.get(t.id);
          if (v) v.sold = true;
          this.addFloat(t.x, t.y, 1.6, `+${ev.refund}`, '#86E0AE', 1.2);
          fx.ring(X(t.x), this.groundAt(t.x, t.y) + 0.2, Z(t.y), 2.0, 0x86E0AE, 0.5, { w: 0.2 });
          break;
        }
        case 'towerDestroyed': {
          const t = ev.tower, gy = this.groundAt(t.x, t.y);
          fx.burst(X(t.x), gy + 0.8, Z(t.y), 0xEE6A2E, 46, 7.5, 0.45, 1.0, { up: 3, grav: 7 });
          fx.burst(X(t.x), gy + 0.8, Z(t.y), 0xfff0c0, 18, 4, 0.3, 0.5, { up: 2, grav: 2 });
          fx.ring(X(t.x), gy + 0.2, Z(t.y), 4, 0xE8502F, 0.65, { w: 0.2, fill: 0.5 });
          this.shake = Math.max(this.shake, 0.4);
          this.addFloat(t.x, t.y, 2.6, `${t.def.name}被摧毁`, '#EC8A70', 1.6, 15);
          break;
        }
        case 'towerGhost': {
          const t = ev.tower;
          fx.ring(X(t.x), 0.2, Z(t.y), 4, 0xEAC15A, 0.7, { w: 0.2 });
          this.addFloat(t.x, t.y, 2.2, '残影诱敌', '#EAC15A', 1.4, 14);
          break;
        }
        case 'towerHit': {
          const t = ev.tower;
          const v = this.towerViews.get(t.id);
          const gy = this.groundAt(t.x, t.y);
          const h = v ? v.model.height : 1.5;
          if (ev.amount > 0.5) this.addFloat(t.x + (Math.random() - 0.5) * 0.3, t.y, h + 0.5, `-${Math.round(ev.amount)}`, ev.src && ev.src.kind === 'impact' ? '#EE6A3A' : '#EE9080', 0.8, ev.amount > 40 ? 17 : 13);
          // 来源连线：看得出谁打谁
          if (ev.src && ev.src.enemy && !ev.src.enemy.dead) {
            const sv = this.enemyViews.get(ev.src.enemy.id);
            if (sv) {
              const colr = ev.src.kind === 'ranged' ? 0xB08CF0 : ev.src.kind === 'impact' ? 0xEE6A2E : 0xE24A3A;
              fx.beam(sv.pos.x, sv.pos.y + 0.5, sv.pos.z, X(t.x), gy + h * 0.5, Z(t.y), colr, 0.22, ev.src.kind === 'impact' ? 0.12 : 0.05);
            }
          }
          const n = ev.src && ev.src.kind === 'impact' ? 14 : 5;
          fx.burst(X(t.x) + (Math.random() - 0.5) * 0.5, gy + h * 0.5, Z(t.y) + (Math.random() - 0.5) * 0.5, ev.src && ev.src.kind === 'ranged' ? 0xB08CF0 : 0xEFA864, n, 3.6, 0.18, 0.35, { grav: 6 });
          break;
        }
        case 'shieldHit': {
          const t = ev.tower;
          fx.ring(X(t.x), this.groundAt(t.x, t.y) + 1, Z(t.y), 1.6, 0x8FD6F0, 0.3, { w: 0.2 });
          break;
        }
        case 'towerSkill': this.skillFx(ev); break;
        case 'towerRedirect': fx.ring(X(ev.tower.x), PLAT_Y + 0.2, Z(ev.tower.y), 1.8, 0x5FB8E6, 0.4, { w: 0.2 }); break;
        case 'firewallStrike': {
          const t = ev.tower;
          for (const e of ev.targets) {
            const sv = this.enemyViews.get(e.id);
            if (!sv) continue;
            fx.beam(X(t.x), this.groundAt(t.x, t.y) + 0.8, Z(t.y), sv.pos.x, sv.pos.y + 0.45, sv.pos.z, 0xEE8A4A, 0.16, 0.13);
            fx.burst(sv.pos.x, sv.pos.y + 0.4, sv.pos.z, 0xEE8A4A, 8, 3.6, 0.24, 0.35, { grav: 3 });
          }
          break;
        }
        case 'shot': {
          // 枪口闪光与抛射：弹道从模型开火点出发
          const s = ev.shot;
          if (s.kind === 'bolt' || s.kind === 'suppress') {
            const t = s.tower, a = t.aim, gy = this.groundAt(t.x, t.y) + 0.92;
            const mx = X(t.x) + Math.cos(a) * 1.05, mz = Z(t.y) + Math.sin(a) * 1.05;
            const col = s.kind === 'bolt' ? 0x8FD8F0 : 0xA99BE8;
            fx.burst(mx, gy, mz, col, 5, 3.4, 0.17, 0.16, { grav: 0, drag: 5 });
            fx.p(mx, gy, mz, 0, 0, 0, 0.09, 0.62, 1.3, 1.5, 1.7, { size2: 0.1 });
          } else if (s.kind === 'orb') {
            const t = s.tower, gy = this.groundAt(t.x, t.y) + 2.0;
            fx.burst(X(t.x), gy, Z(t.y), 0x86C98A, 7, 2.2, 0.2, 0.3, { up: 2, grav: 2 });
          } else if (s.kind === 'shard') {
            const v = this.enemyViews.get(s.enemy.id);
            if (v) {
              fx.burst(v.pos.x, v.pos.y + 1.1, v.pos.z, 0xB08CF0, 6, 2.6, 0.18, 0.22, { grav: 1 });
              fx.beam(v.pos.x, v.pos.y + 1.1, v.pos.z, X(s.tx), this.groundAt(s.tx, s.ty) + 1, Z(s.ty), 0x6C45C8, 0.32, 0.03);
            }
          }
          break;
        }
        case 'victory': {
          for (const ex of this.game.map.exits) {
            fx.pillar(X(ex.x), 0, Z(ex.y), 2.4, 36, 0x86E0AE, 2.2);
            for (let k = 0; k < 3; k++) fx.ring(X(ex.x), 0.3, Z(ex.y), 10 + k * 7, 0x86E0AE, 1.2 + k * 0.4, { w: 0.08 });
          }
          for (const nd of this.game.nodes) fx.ring(X(nd.x), 0.3, Z(nd.y), 3.4, 0x86E0AE, 1.0, { w: 0.14 });
          break;
        }
        case 'defeat': {
          for (const ex of this.game.map.exits) {
            fx.pillar(X(ex.x), 0, Z(ex.y), 3.0, 40, 0xE2492F, 2.4);
            fx.burst(X(ex.x), 2, Z(ex.y), 0xE8502F, 120, 12, 0.6, 1.6, { up: 4, grav: 6 });
            for (let k = 0; k < 3; k++) fx.ring(X(ex.x), 0.3, Z(ex.y), 12 + k * 7, 0xE2492F, 1.1 + k * 0.4, { w: 0.1, fill: 0.2 });
          }
          this.shake = Math.max(this.shake, 1.6);
          this.flash(0.4, 0.02, 0.02);
          break;
        }
        case 'railShot': {
          const t = ev.tower;
          const ax = X(t.x), az = Z(t.y), ay = PLAT_Y + 0.95;
          const bx = ax + Math.cos(ev.angle) * ev.range * S, bz = az + Math.sin(ev.angle) * ev.range * S;
          fx.beam(ax, ay, az, bx, 0.8, bz, 0x6FC4EC, 0.24, 0.1);
          fx.beam(ax, ay, az, bx, 0.8, bz, 0xCDEBF5, 0.12, 0.035);
          fx.burst(ax + Math.cos(ev.angle) * 1.8, ay, az + Math.sin(ev.angle) * 1.8, 0xB4E4F2, 10, 5, 0.2, 0.3, { grav: 0 });
          break;
        }
        case 'enemyHit': {
          const e = ev.enemy, v = this.enemyViews.get(e.id);
          if (!v) break;
          const k = ev.src && ev.src.kind;
          if (k === 'bolt') fx.burst(v.pos.x, v.pos.y + 0.5, v.pos.z, 0x8FD8F0, 5, 3, 0.16, 0.25, { grav: 3 });
          else if (k === 'suppress') fx.ring(v.pos.x, v.pos.y + 0.5, v.pos.z, 1.0, 0xA99BE8, 0.3, { w: 0.3 });
          else if (k === 'pierce') fx.burst(v.pos.x, v.pos.y + 0.5, v.pos.z, 0xffffff, 7, 4, 0.2, 0.3, { grav: 3 });
          if (ev.amount >= 14 && k !== 'residue' && this.time - (v.lastNum || 0) > 0.3) {
            v.lastNum = this.time;
            this.addFloat(e.x, e.y, (e.fly ? FLY_Y : 0) + v.model.height * v.scale + 0.3, `${Math.round(ev.amount)}`, '#ffffff', 0.55, 12);
          }
          break;
        }
        case 'blast': {
          fx.ring(X(ev.x), 0.25, Z(ev.y), ev.r * S, 0x7FBF7F, 0.36, { w: 0.16, fill: 0.28 });
          fx.burst(X(ev.x), 0.5, Z(ev.y), 0x86C98A, 18, 6, 0.24, 0.45, { up: 2, grav: 7 });
          break;
        }
        case 'residue': fx.ring(X(ev.x), 0.2, Z(ev.y), ev.r * S, 0x86C98A, 0.8, { w: 0.08 }); break;
        case 'shardHit': break;
        case 'enemyDie': {
          const e = ev.enemy, v = this.enemyViews.get(e.id);
          const x = v ? v.pos.x : X(e.x), y = v ? v.pos.y + 0.5 : 0.5, z = v ? v.pos.z : Z(e.y);
          const col = { worm: 0xE0355E, flood: 0xF0522A, trojan: 0xE8403A, ransom: 0x6C45C8, hotspot: 0xF2558F, packer: 0xD277E8 }[e.type] || 0xE24A3A;
          if (e.def.boss) {
            fx.ring(x, 0.3, z, 7, 0xffffff, 0.8, { w: 0.15 });
            fx.burst(x, 3, z, col, 40, 8, 0.5, 0.9, { up: 3, grav: 4 });
            this.shake = Math.max(this.shake, 0.6);
          } else {
            fx.burst(x, y, z, col, e.type === 'flood' ? 34 : 15, e.type === 'flood' ? 6 : 4.4, 0.28, 0.5, { up: 1.4, grav: 6 });
            fx.ring(x, (e.fly ? y : 0.2), z, e.type === 'flood' ? 2.6 : 1.3, col, 0.3, { w: 0.25 });
          }
          if (ev.reward >= 10) this.addFloat(e.x, e.y, (e.fly ? FLY_Y : 0.6) + 0.8, `+${ev.reward}`, '#8FD8F0', 0.8, 12);
          break;
        }
        case 'enemyLeak': {
          const e = ev.enemy;
          e.leaked = true;
          const ex = this.world.exitViews && this.world.exitViews[ev.exit.id];
          if (ex) ex.flash = 1;
          fx.ring(X(ev.exit.x), 0.3, Z(ev.exit.y), 6, 0xE2492F, 0.7, { w: 0.14, fill: 0.5 });
          fx.pillar(X(ev.exit.x), 0, Z(ev.exit.y), 1.6, 12, 0xE2492F, 0.7);
          this.addFloat(ev.exit.x, ev.exit.y, 7, `完整度 -${ev.dmg}`, '#E8583F', 1.5, 18);
          this.shake = Math.max(this.shake, 0.5);
          this.flash(0.25, 0.02, 0.02);
          break;
        }
        case 'reveal': {
          const e = ev.enemy, v = this.enemyViews.get(e.id);
          if (v) { fx.ring(v.pos.x, 0.3, v.pos.z, 2.4, 0xF0D878, 0.5, { w: 0.2 }); fx.burst(v.pos.x, 0.6, v.pos.z, 0xd7e6f2, 14, 3, 0.14, 0.5, { grav: 4 }); }
          this.addFloat(e.x, e.y, 2.0, '显形', '#F0D878', 1.0, 13);
          break;
        }
        case 'detected': {
          const e = ev.enemy, v = this.enemyViews.get(e.id);
          if (v) fx.ring(v.pos.x, 0.3, v.pos.z, 5, 0xF0D878, 0.6, { w: 0.1 });
          break;
        }
        case 'wormCopy': {
          const nd = ev.node;
          fx.ring(X(nd.x), 0.25, Z(nd.y), 1.8, 0xE0355E, 0.45, { w: 0.25 });
          fx.burst(X(nd.x), 0.5, Z(nd.y), 0xE8C76A, 12, 3, 0.18, 0.4, { grav: 4 });
          this.addFloat(nd.x, nd.y, 1.6, '复制', '#F08AA8', 0.9, 13);
          break;
        }
        case 'packerPulse': {
          const e = ev.enemy, v = this.enemyViews.get(e.id);
          if (v) {
            fx.ring(v.pos.x, 0.3, v.pos.z, ev.r * S, 0xD277E8, 0.6, { w: 0.08, fill: 0.14 });
            for (const o of ev.targets) { const ov = this.enemyViews.get(o.id); if (ov) fx.beam(v.pos.x, v.pos.y + 1, v.pos.z, ov.pos.x, ov.pos.y + 0.5, ov.pos.z, 0xD277E8, 0.35, 0.03); }
          }
          break;
        }
        case 'shieldBreak': {
          const e = ev.enemy, v = this.enemyViews.get(e.id);
          if (v) fx.burst(v.pos.x, v.pos.y + 0.5, v.pos.z, 0xD98AF0, 16, 4, 0.2, 0.4, { grav: 3 });
          break;
        }
        case 'payload': {
          fx.ring(X(ev.x), 0.3, Z(ev.y), ev.r * S, 0xEE7A36, 0.5, { w: 0.2, fill: 0.7 });
          fx.burst(X(ev.x), 0.7, Z(ev.y), 0xEE7A36, 44, 8, 0.4, 0.7, { up: 3, grav: 7 });
          this.shake = Math.max(this.shake, 0.35);
          break;
        }
        case 'nodeImpact': {
          const nd = ev.node, e = ev.enemy, v = this.enemyViews.get(e.id);
          fx.ring(X(nd.x), 0.3, Z(nd.y), 3.2, 0xEE6A2E, 0.42, { w: 0.2, fill: 0.5 });
          fx.burst(X(nd.x), 0.8, Z(nd.y), 0xEFA864, 18, 6, 0.28, 0.45, { up: 2, grav: 7 });
          if (v) fx.beam(v.pos.x, 0.7, v.pos.z, X(nd.x), 0.8, Z(nd.y), 0xEE6A2E, 0.22, 0.2);
          this.shake = Math.max(this.shake, 0.18);
          break;
        }
        case 'isolatorHit': {
          const nd = ev.node;
          this.addFloat(nd.x, nd.y, 2, `-${Math.round(ev.amount)}`, '#E9A83E', 0.8, 14);
          break;
        }
        case 'nodeIsolated': {
          const nd = ev.node;
          fx.ring(X(nd.x), 0.3, Z(nd.y), 4, 0xEC4E3A, 0.6, { w: 0.15, fill: 0.5 });
          fx.pillar(X(nd.x), 0, Z(nd.y), 1.2, 9, 0xEC4E3A, 0.7);
          fx.burst(X(nd.x), 0.5, Z(nd.y), 0xE86A4A, 18, 4, 0.24, 0.5, { flat: true, grav: 1 });
          this.addFloat(nd.x, nd.y, 3, '节点隔离', '#EC7A66', 1.6, 16);
          break;
        }
        case 'nodeOpen': {
          const nd = ev.node;
          fx.ring(X(nd.x), 0.3, Z(nd.y), 5, 0x6FDFAE, 0.8, { w: 0.14, fill: 0.4 });
          fx.pillar(X(nd.x), 0, Z(nd.y), 1.1, 11, 0x6FDFAE, 0.8);
          fx.burst(X(nd.x), 0.5, Z(nd.y), 0x6FDFAE, 26, 5.4, 0.26, 0.6, { flat: true, grav: 0 });
          this.addFloat(nd.x, nd.y, 3, '旁路直通', '#6FDFAE', 1.8, 17);
          for (let k = 1; k <= 3; k++) fx.ring(X(nd.x), 0.25, Z(nd.y), 2.2 + k, 0x6FDFAE, 0.5 + k * 0.28, { w: 0.08 });
          this.shake = Math.max(this.shake, 0.25);
          break;
        }
        case 'routeChange': this.onRouteChange(ev); break;
        case 'routesUpdated': if (!ev.changed) break; break;
        case 'itemUsed': {
          const c = { isolator: 0xE9A83E, downgrade: 0xE8A868, backup: 0x8FE0C0 }[ev.item];
          fx.ring(X(ev.x), 0.3, Z(ev.y), ev.item === 'downgrade' ? TD.ITEMS.downgrade.radius * S : 3, c, 0.6, { w: 0.14, fill: 0.5 });
          fx.pillar(X(ev.x), 0, Z(ev.y), 1, 8, c, 0.6);
          if (ev.item === 'backup') { const gy = this.groundAt(ev.x, ev.y); fx.burst(X(ev.x), gy + 0.8, Z(ev.y), 0x8FE0C0, 30, 3, 0.26, 0.9, { up: 2.4, grav: 0.5 }); }
          break;
        }
        case 'encrypted': {
          const t = ev.tower;
          fx.ring(X(t.x), this.groundAt(t.x, t.y) + 1, Z(t.y), 1.6, 0xB08CF0, 0.4, { w: 0.2 });
          this.addFloat(t.x, t.y, 2.8, '已加密', '#B08CF0', 1.0, 14);
          break;
        }
        case 'decrypt': {
          const t = ev.tower;
          if (!ev.natural) { fx.burst(X(t.x), this.groundAt(t.x, t.y) + 1.2, Z(t.y), 0xDCCBF5, 18, 3, 0.2, 0.5, { grav: 2 }); this.addFloat(t.x, t.y, 2.8, '解密', '#8FE0C0', 1.0, 14); }
          break;
        }
        case 'lured': {
          const e = ev.enemy, v = this.enemyViews.get(e.id);
          if (v) fx.beam(v.pos.x, 0.5, v.pos.z, X(ev.tower.x), 1.2, Z(ev.tower.y), 0xEAC15A, 0.4, 0.04);
          break;
        }
        case 'blockStart': {
          const e = ev.enemy, v = this.enemyViews.get(e.id);
          if (v) fx.ring(v.pos.x, 0.25, v.pos.z, 1.2, 0xEE8A4A, 0.3, { w: 0.3 });
          break;
        }
        case 'bossSpawn': {
          const e = ev.enemy;
          this.shake = Math.max(this.shake, 1.5);
          fx.pillar(X(e.x), 0, Z(e.y), 4.5, 60, 0xE2392F, 2.2);
          for (let k = 0; k < 3; k++) fx.ring(X(e.x), 0.3, Z(e.y), 14 + k * 6, 0xE2392F, 1.2 + k * 0.3, { w: 0.08 });
          fx.burst(X(e.x), 2, Z(e.y), 0xE2392F, 80, 11, 0.5, 1.4, { up: 4, grav: 2 });
          this.flash(0.35, 0.02, 0.05);
          break;
        }
        case 'bossPhase': {
          const e = ev.enemy, v = this.enemyViews.get(e.id);
          if (v) {
            this.shake = Math.max(this.shake, 1.0);
            fx.pillar(v.pos.x, 0, v.pos.z, 3.2, 40, 0xE8C66E, 1.4);
            fx.ring(v.pos.x, 0.3, v.pos.z, 14, 0xE8C66E, 0.9, { w: 0.1, fill: 0.2 });
            fx.burst(v.pos.x, 3, v.pos.z, 0xE8C66E, 60, 9, 0.4, 1.0, { up: 3, grav: 3 });
          }
          this.flash(0.2, 0.15, 0.02);
          break;
        }
        case 'bossWarn': {
          this.alerts.push({ x: ev.x, y: ev.y, text: ev.text, t: 3.4, color: ev.kind === 'hole' ? '#B89AF0' : ev.kind === 'lock' ? '#EE5A50' : '#EE8E50' });
          break;
        }
        case 'bossSurge': {
          const e = ev.enemy, v = this.enemyViews.get(e.id);
          fx.ring(X(ev.x), 0.3, Z(ev.y), 8, 0xEE6A2E, 0.8, { w: 0.14, fill: 0.5 });
          fx.pillar(X(ev.x), 0, Z(ev.y), 2, 15, 0xEE6A2E, 0.8);
          fx.burst(X(ev.x), 1, Z(ev.y), 0xEFA864, 60, 10, 0.42, 0.9, { up: 3, grav: 7 });
          if (v) {
            fx.beam(v.pos.x, 4, v.pos.z, X(ev.x), 0.8, Z(ev.y), 0xEE6A2E, 0.5, 0.42);
            fx.beam(v.pos.x, 4, v.pos.z, X(ev.x), 0.8, Z(ev.y), 0xffffff, 0.3, 0.14);
          }
          this.shake = Math.max(this.shake, 0.9);
          break;
        }
        case 'bossSwarm': {
          const v = this.enemyViews.get(ev.enemy.id);
          if (v) { fx.ring(v.pos.x, 0.3, v.pos.z, 7, 0xD8C24A, 0.7, { w: 0.14, fill: 0.2 }); fx.burst(v.pos.x, 3, v.pos.z, 0xD8C24A, 40, 7, 0.3, 0.8, { up: 1, grav: 6 }); }
          break;
        }
        case 'bossStorm': {
          const v = this.enemyViews.get(ev.enemy.id);
          if (v) {
            for (let k = 0; k < 3; k++) fx.ring(v.pos.x, 0.5 + k * 1.4, v.pos.z, ev.r * S, k % 2 ? 0xE58CD8 : 0xA8E4F5, 0.7 + k * 0.2, { w: 0.05 });
            for (const t of ev.targets) { fx.beam(v.pos.x, 4, v.pos.z, X(t.x), this.groundAt(t.x, t.y) + 1, Z(t.y), 0xE58CD8, 0.4, 0.05); }
            this.shake = Math.max(this.shake, 0.6);
          }
          break;
        }
        case 'waveStart': {
          for (const en of this.game.map.entrances) {
            if (ev.def.groups.some(g => g[2] === en.id)) { fx.ring(X(en.x), 0.3, Z(en.y), 6, TD.ENTRANCE_COLORS[en.id], 0.8, { w: 0.12 }); fx.pillar(X(en.x), 0, Z(en.y), 1.6, 16, TD.ENTRANCE_COLORS[en.id], 0.8); }
          }
          break;
        }
        case 'surge': this.shake = Math.max(this.shake, 0.7); this.flash(0.18, 0.05, 0.02); break;
        case 'intelGain': if (ev.amount) this.addFloat(ev.x, ev.y, 2.5, `情报 +${ev.amount}`, '#EBD58A', 1.1, 13); break;
        case 'reject': {
          if (ev.sealed) this.setSealed(ev.sealed, 4);
          if (ev.x != null && this.game.inGrid(Math.round(ev.x), Math.round(ev.y))) this.fx.ring(X(ev.x), 0.4, Z(ev.y), 1.8, 0xE2492F, 0.4, { w: 0.25 });
          break;
        }
      }
    }

    skillFx(ev) {
      const t = ev.tower, fx = this.fx, x = this.X(t.x), z = this.Z(t.y), gy = this.groundAt(t.x, t.y);
      const col = TD.ROLE_COLORS[t.def.roleKey];
      fx.pillar(x, gy, z, 1.2, 7, col, 0.6);
      if (t.type === 'repair') {
        const r = t.s.range * S;
        fx.ring(x, gy + 0.2, z, r, 0x8FD6F0, 0.8, { w: 0.05, fill: 0.2 });
        fx.ring(x, gy + 1.2, z, r * 0.8, 0x8FE0C0, 0.6, { w: 0.08 });
        for (const o of ev.targets || []) {
          fx.beam(x, gy + 2.2, z, this.X(o.x), this.groundAt(o.x, o.y) + 1, this.Z(o.y), 0x8FD6F0, 0.5, 0.1);
          fx.burst(this.X(o.x), this.groundAt(o.x, o.y) + 1, this.Z(o.y), 0x8FD6F0, 16, 3, 0.2, 0.5, { up: 1, grav: 0.5 });
        }
      } else if (t.type === 'honeypot') {
        fx.ring(x, gy + 0.3, z, t.s.lureR * S, 0xEAC15A, 0.6, { w: 0.08, fill: 0.2 });
        fx.burst(x, gy + 1, z, 0xEAC15A, 26, 5, 0.22, 0.5, { up: 1, grav: 4 });
      } else if (t.type === 'sandbox') {
        const r = t.def.skill.radius * S;
        for (let k = 0; k < 2; k++) fx.ring(x, gy + 0.3, z, r * (1 - k * 0.15), 0xCFE8D4, 1.0 + k * 0.2, { w: 0.03, fill: 0.08 });
      } else if (t.type === 'firewall') {
        fx.ring(x, gy + 0.3, z, 3.2, 0xEE8A4A, 0.5, { w: 0.15, fill: 0.5 });
        fx.burst(x, gy + 1.6, z, 0xEE8A4A, 32, 5, 0.3, 0.6, { up: 3, grav: 5 });
      } else if (t.type === 'gate') {
        fx.ring(x, gy + 0.3, z, 3.2, 0xE8604A, 0.5, { w: 0.15, fill: 0.5 });
      } else if (t.type === 'interceptor') {
        fx.ring(x, gy + 1, z, 2.2, 0x5FB8E6, 0.4, { w: 0.15 });
      }
    }

    onRouteChange(ev) {
      const ents = this.game.map.entrances;
      this.rebuildRoutes();
      for (const c of ev.changes) {
        const i = ents.findIndex(e => e.id === c.ent);
        const lane = (i - (ents.length - 1) / 2) * 0.46;
        // 旧路线短暂保留为虚线
        const ghost = this.makeRibbon(c.oldPath, lane, c.ent, c.oldExit, { y: 0.12, width: 0.3, mode: 1 });
        this.overlayGroup.add(ghost);
        this.ghostRoutes.push({ mesh: ghost, t: 3.2 });
        const m = this.routeMeshes[c.ent];
        if (m) m.material.uniforms.uSweep.value = 0;
        // 分叉点标注
        let k = 0;
        while (k < c.oldPath.length && k < c.newPath.length && c.oldPath[k] === c.newPath[k]) k++;
        const w = this.game.map.w;
        const at = c.newPath[Math.min(k, c.newPath.length - 1)];
        const delta = c.newLen - c.oldLen;
        const text = `${c.ent} 改道 → ${c.newExit}${delta ? `（${delta > 0 ? '+' : ''}${delta} 跳）` : ''}`;
        this.alerts.push({ x: at % w, y: (at / w) | 0, text, t: 3.5, color: TD.ENTRANCE_COLORS[c.ent] });
      }
    }

    flash(r, g, b) {
      const u = this.grade.uniforms.uFlash.value;
      u.setRGB(r, g, b);
      this._flashK = 1;
    }

    addFloat(x, y, h, text, color, dur, size) {
      if (this.floats.length > 90) this.floats.shift();
      this.floats.push({ wx: this.X(x), wy: h, wz: this.Z(y), text, color, t: dur, dur, size: size || 13 });
    }

    // ────────── 叠加层：血条、状态、标签 ──────────
    renderOverlay(dt, simDt) {
      // 导出高分辨率视频时，血条和标签随窗口等比放大
      const k = this.exporting ? Math.max(1, Math.min(this.size.w / 1600, this.size.h / 900)) : 1;
      this._ovK = k;
      this.octx.setTransform(this.ovDpr * k, 0, 0, this.ovDpr * k, 0, 0);
      this.drawOverlay(dt, simDt, this.size.w / k, this.size.h / k);
      this._ovK = 1;
    }

    drawOverlay(dt, simDt, W, H) {
      const c = this.octx;
      c.clearRect(0, 0, W, H);
      if (this._flashK > 0) {
        this._flashK = Math.max(0, this._flashK - dt * 2.4);
        const u = this.grade.uniforms.uFlash.value;
        u.multiplyScalar(this._flashK > 0 ? 0.92 : 0);
      }
      if (!this.game || !this.showLabels) return;
      const g = this.game;
      const zoom = Math.max(0.65, Math.min(1.5, 90 / this.rig.dist));
      this.drawGateLabels(c, zoom);
      this.drawNodeLabels(c, zoom);
      // 敌人血条
      for (const e of g.enemies) {
        const v = this.enemyViews.get(e.id);
        if (!v) continue;
        const stealth = e.stealth && !e.revealed && !(e.revealT > 0);
        if (stealth && e.hp >= e.maxHp && e.type !== 'zheying') continue; // 伪装时看起来是普通流量
        const p = this.project(v.pos.x, v.pos.y + v.model.height * v.scale + 0.25, v.pos.z);
        if (p.z > 1 || p.x < -40 || p.y < -40 || p.x > W + 40 || p.y > H + 40) continue;
        if (e.def.boss) continue; // Boss 血条在顶部
        const w = (e.type === 'flood' ? 34 : 24) * zoom;
        v.hpLag += (e.hp - v.hpLag) * Math.min(1, dt * 5);
        if (e.hp >= e.maxHp && e.shield <= 0) c.globalAlpha = 0.45;
        this.drawBar(c, p.x - w / 2, p.y, w, 3.6 * Math.max(0.9, zoom), e.hp / e.maxHp, v.hpLag / e.maxHp, '#E05A50', e.shield / e.maxHp, '#D98AF0');
        c.globalAlpha = 1;
        this.drawEnemyStatus(c, e, p.x, p.y - 5 * zoom, zoom);
      }
      // 塔血条与状态
      for (const t of g.towers) {
        const v = this.towerViews.get(t.id);
        if (!v || t.ghostT > 0) continue;
        const gy = v.model.root.position.y;
        const p = this.project(v.model.root.position.x, gy + v.model.height + 0.5, v.model.root.position.z);
        if (p.z > 1) continue;
        const w = 40 * zoom;
        v.hpLag += (t.hp - v.hpLag) * Math.min(1, dt * 4);
        const damaged = t.hp < t.maxHp || t.shield > 0 || t.encT > 0 || t.hitAnim > 0;
        if (damaged || this.selected && this.selected.unit === t || t.blocked.length) {
          this.drawBar(c, p.x - w / 2, p.y, w, 5 * Math.max(0.9, zoom), t.hp / t.maxHp, v.hpLag / t.maxHp, '#86D9A8', t.shield / t.maxHp, '#8FD6F0');
        }
        let ix = p.x;
        if (t.s.block && (t.blocked.length || (this.selected && this.selected.unit === t))) {
          const load = g.blockLoad(t), cap = g.blockCap(t);
          this.drawPips(c, p.x, p.y - 8 * zoom, load, cap, zoom);
        }
        if (t.encT > 0) {
          this.drawTag(c, ix, p.y - 18 * zoom, `🔒 ${t.encT.toFixed(1)}`, '#B08CF0', zoom);
        } else if (t.skillT > 0) {
          this.drawTag(c, ix, p.y - 18 * zoom, `${t.def.skill.name} ${t.skillT.toFixed(0)}`, TD.ROLE_COLORS[t.def.roleKey], zoom);
        }
      }
      // 隔离器
      for (const nd of g.nodes) {
        if (!nd.isolator) continue;
        const p = this.project(this.X(nd.x), 2.1, this.Z(nd.y));
        const w = 38 * zoom;
        this.drawBar(c, p.x - w / 2, p.y, w, 4.4, nd.isolator.hp / nd.isolator.maxHp, nd.isolator.hp / nd.isolator.maxHp, '#E9A83E', 0, null);
        this.drawTag(c, p.x, p.y - 12, `隔离器 ${nd.isolator.t.toFixed(0)} 秒`, '#E9A83E', zoom);
      }
      // 预警倒计时
      for (const w of g.warnings) {
        for (const i of w.tiles.slice(0, 1)) {
          const x = i % g.map.w, y = (i / g.map.w) | 0;
          const p = this.project(this.X(x), 1.8, this.Z(y));
          const txt = (w.kind === 'surge' ? '洪峰 ' : w.kind === 'hole' ? '黑洞 ' : '锁死 ') + Math.ceil(w.t);
          this.drawTag(c, p.x, p.y, txt, w.kind === 'surge' ? '#EE8E50' : w.kind === 'hole' ? '#B89AF0' : '#EE5A50', 1.3 * zoom);
        }
      }
      for (const h of g.holes) {
        const i = h.tiles[0];
        const p = this.project(this.X(i % g.map.w), 1.6, this.Z((i / g.map.w) | 0));
        this.drawTag(c, p.x, p.y, `${h.kind === 'hole' ? '路由黑洞' : '运维环锁死'} ${Math.ceil(h.t)} 秒`, h.kind === 'hole' ? '#B89AF0' : '#EE5A50', zoom);
      }
      for (const z of g.zones) {
        const p = this.project(this.X(z.x), 1.0, this.Z(z.y));
        this.drawTag(c, p.x, p.y, `协议降级 ${Math.ceil(z.t)} 秒`, '#E8A868', zoom);
      }
      // 封死位置
      if (this.sealedMarks) for (let i = this.sealedMarks.length - 1; i >= 0; i--) {
        const s = this.sealedMarks[i];
        s.t -= dt;
        if (s.t <= 0) { this.sealedMarks.splice(i, 1); continue; }
        const p = this.project(this.X(s.x), 0.3, this.Z(s.y));
        const a = 0.5 + 0.5 * Math.sin(this.time * 12);
        c.save();
        c.strokeStyle = `rgba(226,73,47,${0.5 + a * 0.5})`; c.lineWidth = 3;
        c.beginPath(); c.arc(p.x, p.y, 18 + a * 7, 0, 7); c.stroke();
        c.beginPath(); c.moveTo(p.x - 9, p.y - 9); c.lineTo(p.x + 9, p.y + 9); c.moveTo(p.x + 9, p.y - 9); c.lineTo(p.x - 9, p.y + 9); c.stroke();
        c.restore();
        this.drawTag(c, p.x, p.y - 34, s.label, '#EC6450', 1.1);
      }
      // 地图告警气泡
      for (let i = this.alerts.length - 1; i >= 0; i--) {
        const a = this.alerts[i];
        a.t -= dt;
        if (a.t <= 0) { this.alerts.splice(i, 1); continue; }
        const p = this.project(this.X(a.x), 1.4, this.Z(a.y));
        c.globalAlpha = Math.min(1, a.t * 2);
        this.drawTag(c, p.x, p.y - 12 - (3.5 - a.t) * 6, a.text, a.color, 1.15);
        c.globalAlpha = 1;
      }
      // 飘字
      c.textAlign = 'center';
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i];
        f.t -= simDt > 0 ? simDt : dt * 0.2;
        if (f.t <= 0) { this.floats.splice(i, 1); continue; }
        const k = 1 - f.t / f.dur;
        const p = this.project(f.wx, f.wy + k * 1.6, f.wz);
        c.globalAlpha = Math.min(1, f.t / f.dur * 2.2);
        c.font = `700 ${f.size * Math.max(0.9, zoom)}px "Microsoft YaHei UI","Bahnschrift",sans-serif`;
        c.lineWidth = 3; c.strokeStyle = 'rgba(12, 11, 11,.85)';
        c.strokeText(f.text, p.x, p.y);
        c.fillStyle = f.color;
        c.fillText(f.text, p.x, p.y);
        c.globalAlpha = 1;
      }
    }

    drawBar(c, x, y, w, h, frac, lag, col, shieldFrac, shieldCol) {
      frac = Math.max(0, Math.min(1, frac)); lag = Math.max(frac, Math.min(1, lag));
      c.fillStyle = 'rgba(11, 10, 10,.82)';
      c.fillRect(x - 1, y - 1, w + 2, h + 2);
      c.fillStyle = 'rgba(255,255,255,.75)';
      c.fillRect(x, y, w * lag, h);
      c.fillStyle = frac < 0.3 ? '#E2492F' : col;
      c.fillRect(x, y, w * frac, h);
      if (shieldFrac > 0.005) {
        c.fillStyle = shieldCol;
        c.fillRect(x, y - 2.6, w * Math.min(1, shieldFrac), 2.2);
      }
    }

    drawPips(c, x, y, load, cap, zoom) {
      const s = 5 * zoom, gap = 2;
      const total = cap * s + (cap - 1) * gap;
      let px = x - total / 2;
      for (let i = 0; i < cap; i++) {
        c.fillStyle = i < load ? '#EE8A4A' : 'rgba(255,255,255,.28)';
        c.fillRect(px, y, s, s * 0.8);
        px += s + gap;
      }
    }

    drawEnemyStatus(c, e, x, y, zoom) {
      const icons = [];
      if (e.stealth && !e.revealed && e.revealT <= 0) icons.push(['◌', '#A8B4BC']);
      if (e.revealT > 0 || (e.revealed && e.def.stealth)) icons.push(['◉', '#F0D878']);
      if (e.supT > 0) icons.push(['≋', '#A99BE8']);
      if (e.trapT > 0) icons.push(['⛓', '#EAC15A']);
      if (e.exposedT > 0) icons.push(['!', '#D29A4A']);
      if (e.mode === 'siege') icons.push(['⚡', '#EE6A2E']);
      if (e.shield > 0.5) icons.push(['⬡', '#D98AF0']);
      if (!icons.length) return;
      c.font = `700 ${12 * Math.max(0.9, zoom)}px "Segoe UI Symbol","Microsoft YaHei UI",sans-serif`;
      c.textAlign = 'center';
      let px = x - (icons.length - 1) * 6.5 * zoom;
      for (const [t, col] of icons) {
        c.lineWidth = 2.5; c.strokeStyle = 'rgba(11, 10, 10,.9)'; c.strokeText(t, px, y);
        c.fillStyle = col; c.fillText(t, px, y);
        px += 13 * zoom;
      }
    }

    drawTag(c, x, y, text, color, zoom) {
      const size = 12 * Math.max(0.95, zoom || 1);
      c.font = `600 ${size}px "Microsoft YaHei UI","Bahnschrift",sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const w = c.measureText(text).width + 12, h = size + 7;
      c.fillStyle = 'rgba(13, 12, 12,.84)';
      c.beginPath();
      if (c.roundRect) c.roundRect(x - w / 2, y - h / 2, w, h, 3); else c.rect(x - w / 2, y - h / 2, w, h);
      c.fill();
      c.strokeStyle = color; c.lineWidth = 1; c.stroke();
      c.fillStyle = color;
      c.fillText(text, x, y + 0.5);
      c.textBaseline = 'alphabetic';
    }

    drawGateLabels(c, zoom) {
      const g = this.game;
      for (const en of g.map.entrances) {
        const p = this.project(this.X(en.x), 7.6, this.Z(en.y));
        const r = g.routes[en.id];
        this.drawTag(c, p.x, p.y, `${en.id} ${en.name} → ${r.exit || '?'}`, TD.ENTRANCE_COLORS[en.id], 0.98);
      }
      for (const ex of g.map.exits) {
        const p = this.project(this.X(ex.x), 7.2, this.Z(ex.y) + 0.8);
        const coming = g.map.entrances.filter(en => g.routes[en.id].exit === ex.id).map(en => en.id).join('');
        this.drawTag(c, p.x, p.y, `${ex.id} ${ex.name}${coming ? ` ← ${coming}` : ''}`, TD.EXIT_COLORS[ex.id], 0.98);
      }
    }

    drawNodeLabels(c, zoom) {
      const g = this.game;
      const showNames = this.rig.dist < (this.defaultCam ? this.defaultCam.dist * 0.72 : 40);
      for (const nd of g.nodes) {
        const p = this.project(this.X(nd.x), 0.6, this.Z(nd.y));
        if (nd.lockT > 0 && !nd.tower && !nd.isolator) {
          // 再隔离间隔的倒计时环
          const k = nd.lockT / (TD.RULES.relockBase + nd.flap * TD.RULES.relockStep);
          c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 5;
          c.beginPath(); c.arc(p.x, p.y, 13 * zoom, 0, 7); c.stroke();
          c.strokeStyle = '#E9A83E'; c.lineWidth = 3;
          c.beginPath(); c.arc(p.x, p.y, 13 * zoom, -1.57, -1.57 + k * 6.283); c.stroke();
          c.font = `700 ${11 * zoom}px "Bahnschrift",sans-serif`;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillStyle = '#EDD0A4'; c.fillText(Math.ceil(nd.lockT), p.x, p.y);
          c.textBaseline = 'alphabetic';
        }
        if (showNames || (this.hoverTile && this.hoverTile.x === nd.x && this.hoverTile.y === nd.y)) {
          const st = (nd.tower || nd.isolator) ? '隔离' : g.blocked[nd.idx] ? '封锁' : nd.lockT > 0 ? '等待' : '直通';
          const col = st === '直通' ? '#6FDFAE' : st === '等待' ? '#E9A83E' : st === '封锁' ? '#B89AF0' : '#EC6450';
          this.drawTag(c, p.x, p.y + 22 * zoom, `${nd.name} · ${st}`, col, 0.92);
        } else {
          // 紧凑的状态标：一眼看出通行状态
          const st = (nd.tower || nd.isolator) ? '✕' : g.blocked[nd.idx] ? '⊘' : nd.lockT > 0 ? '' : '';
          if (st) {
            c.font = `800 ${15 * zoom}px "Segoe UI Symbol",sans-serif`;
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(st, p.x, p.y + 17 * zoom);
            c.fillStyle = '#EC6450'; c.fillText(st, p.x, p.y + 17 * zoom);
            c.textBaseline = 'alphabetic';
          }
        }
      }
    }
  }
  TD.View = View;
})(typeof window !== 'undefined' ? window : globalThis);
