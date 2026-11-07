/* ============================================================
   场景二：同尺寸多密度球与透明造浪水槽
   - 线性浅水方程（高度 + 深度平均流速）驱动水面与水流
   - 浮力 / 阻力 / 附加质量 / 球球与壁面碰撞
   - 侧向推板、摆板、垂直活塞三种造浪装置
   - 逐帧导出由外部驱动，全部确定性
   ============================================================ */
(function () {
  'use strict';

  const DEFAULTS = {
    tank: { length: 8.4, width: 3.2, height: 3.0 },
    fluid: { level: 1.8, gravity: 9.8, viscosity: 0.35 },
    ball: { radius: 0.24, perGroup: 4, releaseHeight: 1.15 },
    groups: [
      { name: '低密度', density: 0.32, color: '#ff5a36' },
      { name: '中低密度', density: 0.76, color: '#ffc02e' },
      { name: '中性浮力', density: 1.0, color: '#2fe08f' },
      { name: '高密度', density: 1.85, color: '#3c7bff' }
    ],
    wave: { type: 'piston', delay: 1.0, amplitude: 0.22, frequency: 0.62, duration: 5.0 }
  };

  const NX = 96;
  const NZ = 42;
  const GROUP_X = [0.28, 0.095, -0.095, -0.28];
  const GROUP_Z = [0.24, -0.2, 0.17, -0.24];

  function deepMerge(base, extra) {
    const out = {};
    for (const k in base) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        out[k] = deepMerge(base[k], (extra && extra[k]) || {});
      } else {
        out[k] = extra && extra[k] !== undefined ? extra[k] : base[k];
      }
    }
    return out;
  }

  class TankScene {
    constructor(renderer, envTex, events) {
      this.renderer = renderer;
      this.events = events || {};
      this.p = deepMerge(DEFAULTS, null);
      this.envTex = envTex;
      this.exportMode = false;
      this._initState();
      this._buildScene(envTex);
      this._rebuild();
      this.reset();
    }

    _initState() {
      this.time = 0;
      this.started = false;
      this.ended = false;
      this.waveActive = false;
      this.autoWave = false;
      this.waveT = 0;
      this.waveStartAt = -1;
      this.waveStopAt = -1;
      this.waveStoppedAt = -1;
      this.tLast = -1;
      this.entryCount = 0;
      this.current = 0;
      this.waveEnergy = 0;
      this.paddleDisp = 0;
      this.paddleVel = 0;
      this.paddleReturn = null;
      this.lastPaddleSound = 0;
      this.balls = [];
      this.fx = [];
      this.sprayPool = [];
      this.sprayCursor = 0;
      this.cameraShake = 0;
      this.orbit = null;
      this.releaseStart = 0;
      this.seq = 0;
      this.fxRand = U.rng(0x9e3779b9);
    }

    /* ==================== 场景骨架 ==================== */
    _buildScene(envTex) {
      const s = this.scene = new THREE.Scene();
      s.background = U.makeBackdropTexture(false);
      s.fog = new THREE.FogExp2(0x040a0d, 0.016);

      this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
      this.orbit = new U.OrbitCam(this.camera, this.renderer.domElement, {
        target: new THREE.Vector3(0, 1.6, 0),
        yaw: 0.33,
        pitch: 0.27,
        dist: 14.2,
        minPitch: 0.04,
        maxPitch: 0.9,
        minDist: 8.0,
        maxDist: 22
      });

      const hemi = new THREE.HemisphereLight(0x8fd8dd, 0x0a1418, 0.35);
      s.add(hemi);

      const key = new THREE.DirectionalLight(0xfff1dc, 1.15);
      key.position.set(5.5, 9.0, 6.8);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -8.5;
      key.shadow.camera.right = 8.5;
      key.shadow.camera.top = 8;
      key.shadow.camera.bottom = -4;
      key.shadow.camera.near = 0.5;
      key.shadow.camera.far = 32;
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.02;
      s.add(key);
      this.keyLight = key;

      const rim = new THREE.SpotLight(0x65f6e3, 2.8, 40, 0.62, 0.9, 1.2);
      rim.position.set(-6, 6.5, -8);
      rim.target.position.set(0, 1.3, 0);
      s.add(rim, rim.target);

      const fill = new THREE.SpotLight(0xffcbb0, 0.7, 35, 0.6, 1.0, 1.2);
      fill.position.set(7, 4.4, 9);
      fill.target.position.set(0, 1.2, 0);
      s.add(fill, fill.target);

      const back = new THREE.SpotLight(0x9fe8ff, 0.8, 32, 0.55, 0.9, 1.1);
      back.position.set(0.5, 5.0, -10);
      back.target.position.set(0, 1.2, 0);
      s.add(back, back.target);

      const pink = new THREE.PointLight(0xff5e9e, 0.45, 14, 1.8);
      pink.position.set(5.0, 1.2, -3.0);
      s.add(pink);

      // 演播室柔光
      const glowTex = U.glowTexture();
      const addGlow = (color, sx, sy, x, y, z, op) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, color, transparent: true, opacity: op,
          blending: THREE.AdditiveBlending, depthWrite: false
        }));
        sp.scale.set(sx, sy, 1);
        sp.position.set(x, y, z);
        s.add(sp);
      };
      addGlow(0x1e8f86, 15, 8, 0, 2.6, -11, 0.1);
      addGlow(0x81f8ff, 9, 3.2, 0.5, 5.2, -10, 0.06);
      addGlow(0xff8f62, 6.6, 4.0, 7.2, 2.0, -8.0, 0.06);
      addGlow(0xff5f9f, 6.0, 4.5, -7.4, 2.4, -8.5, 0.045);

      // 地面
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.MeshStandardMaterial({
          color: 0x050e12, metalness: 0.55, roughness: 0.38, envMapIntensity: 0.9
        })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.4;
      floor.receiveShadow = true;
      s.add(floor);

      this.root = new THREE.Group();
      s.add(this.root);
      this.structureGroup = new THREE.Group();
      this.waterGroup = new THREE.Group();
      this.ballGroup = new THREE.Group();
      this.holderGroup = new THREE.Group();
      this.fxGroup = new THREE.Group();
      this.particleGroup = new THREE.Group();
      this.root.add(this.structureGroup, this.waterGroup, this.ballGroup, this.holderGroup, this.fxGroup, this.particleGroup);

      s.environment = envTex;
      this._buildParticles();
    }

    _clearGroup(group) {
      while (group.children.length) {
        const ch = group.children[group.children.length - 1];
        group.remove(ch);
        if (ch.traverse) {
          ch.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
              if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
              else o.material.dispose();
            }
          });
        }
      }
    }

    _rebuild() {
      this.L = this.p.tank.length;
      this.W = this.p.tank.width;
      this.H = this.p.tank.height;
      this.level = Math.min(this.p.fluid.level, this.H - 0.22);
      this.radius = this.p.ball.radius;
      this._splashCooldown = new Map();

      this._clearGroup(this.structureGroup);
      this._clearGroup(this.waterGroup);
      this._clearGroup(this.ballGroup);
      this._clearGroup(this.holderGroup);
      this._clearGroup(this.fxGroup);

      this._initFluid();
      this._buildStructure();
      this._buildWater();
      this._buildBalls();
      this._buildParticlesPoolReset();
      this._applyCamera();
    }

    _applyCamera() {
      const view = { target: new THREE.Vector3(0, 1.6, 0), yaw: 0.33, pitch: 0.27, dist: 14.2 };
      this.orbit.home.yaw = this.orbit.goal.yaw = view.yaw;
      this.orbit.home.pitch = this.orbit.goal.pitch = view.pitch;
      this.orbit.home.dist = this.orbit.goal.dist = view.dist;
      this.orbit.target.copy(view.target);
      this.orbit.home.target.copy(view.target);
      this.orbit.cur.yaw = view.yaw;
      this.orbit.cur.pitch = view.pitch;
      this.orbit.cur.dist = view.dist;
    }

    /* ==================== 水槽结构 ==================== */
    _buildStructure() {
      const L = this.L, W = this.W, H = this.H;
      const g = this.structureGroup;

      const metal = new THREE.MeshStandardMaterial({
        color: 0x0d222a, metalness: 0.9, roughness: 0.24, envMapIntensity: 1.1
      });
      const darkMetal = new THREE.MeshStandardMaterial({
        color: 0x081318, metalness: 0.75, roughness: 0.34, envMapIntensity: 0.8
      });
      const accent = new THREE.MeshBasicMaterial({
        color: 0x63f7dd, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false
      });

      // 底座
      const base = new THREE.Mesh(U.roundedBox(L + 0.72, 0.34, W + 0.72, 0.1, 2), darkMetal);
      base.position.y = -0.2;
      base.receiveShadow = true;
      base.castShadow = true;
      g.add(base);
      const baseGlow = new THREE.Mesh(
        new THREE.BoxGeometry(L + 0.76, 0.018, W + 0.76),
        accent
      );
      baseGlow.position.y = -0.36;
      g.add(baseGlow);

      // 底部（水槽内底面）
        const bed = new THREE.Mesh(
        new THREE.BoxGeometry(L, 0.08, W),
        new THREE.MeshStandardMaterial({
          color: 0x03151a, metalness: 0.0, roughness: 0.82, envMapIntensity: 0.12
        })
      );
      bed.position.y = -0.04;
      bed.receiveShadow = true;
      g.add(bed);

      // 哑光深色底面，压住反射，让水下层次更清楚
      const bedTop = new THREE.Mesh(
        new THREE.PlaneGeometry(L - 0.02, W - 0.02),
        new THREE.MeshStandardMaterial({
          color: 0x010a0d, metalness: 0.0, roughness: 1.0, envMapIntensity: 0.0
        })
      );
      bedTop.rotation.x = -Math.PI / 2;
      bedTop.position.y = 0.006;
      bedTop.receiveShadow = true;
      g.add(bedTop);

      // 玻璃面板
      const glassMat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0x9df8ee) } },
        vertexShader: `
          varying vec3 vN;
          varying vec3 vV;
          varying vec2 vUv;
          void main(){
            vUv = uv;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec3 vN;
          varying vec3 vV;
          varying vec2 vUv;
          void main(){
            float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
            float streak = smoothstep(0.86, 1.0, sin((vUv.x * 1.2 + vUv.y) * 31.4) * 0.5 + 0.5);
            float edge = smoothstep(0.0, 0.015, vUv.x) * smoothstep(0.0, 0.015, vUv.y)
                       * smoothstep(0.0, 0.015, 1.0 - vUv.x) * smoothstep(0.0, 0.015, 1.0 - vUv.y);
            float a = 0.012 + f * 0.20 + streak * 0.012 + (1.0 - edge) * 0.05;
            vec3 col = mix(vec3(0.24, 0.72, 0.70), uColor, f * 0.8 + streak * 0.2);
            gl_FragColor = vec4(col, a);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const panels = [
        { w: L, h: H, pos: [0, H / 2, W / 2], rot: [0, 0, 0] },
        { w: L, h: H, pos: [0, H / 2, -W / 2], rot: [0, Math.PI, 0] },
        { w: W, h: H, pos: [-L / 2, H / 2, 0], rot: [0, Math.PI / 2, 0] },
        { w: W, h: H, pos: [L / 2, H / 2, 0], rot: [0, -Math.PI / 2, 0] }
      ];
      this.glassMeshes = [];
      for (const pn of panels) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(pn.w, pn.h, 1, 1), glassMat);
        m.position.set(pn.pos[0], pn.pos[1], pn.pos[2]);
        m.rotation.set(pn.rot[0], pn.rot[1], pn.rot[2]);
        m.renderOrder = 12;
        g.add(m);
        this.glassMeshes.push(m);
      }
      this.glassMaterial = glassMat;

      // 边框
      const bar = (w, h, d, x, y, z) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), metal);
        m.position.set(x, y, z);
        m.castShadow = false;
        g.add(m);
        return m;
      };
      const t = 0.065;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          bar(t, H + 0.16, t, sx * L / 2, H / 2, sz * W / 2);
        }
      }
      for (const sz of [-1, 1]) {
        bar(L + 0.12, t, t, 0, H, sz * W / 2);
        bar(L + 0.12, t * 0.7, t * 0.7, 0, 0.035, sz * W / 2);
      }
      for (const sx of [-1, 1]) {
        bar(t, t, W + 0.12, sx * L / 2, H, 0);
        bar(t * 0.7, t * 0.7, W + 0.12, sx * L / 2, 0.035, 0);
      }
      // 竖向灯条
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const l = new THREE.Mesh(new THREE.BoxGeometry(0.012, H * 0.8, 0.012), accent);
          l.position.set(sx * L / 2 + 0.038, H * 0.5, sz * W / 2 + 0.038);
          g.add(l);
        }
      }
      // 顶部四角晶亮端头
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), accent);
          knob.position.set(sx * L / 2, H + 0.05, sz * W / 2);
          g.add(knob);
        }
      }

      // 水位线（恒平均水位，提供清晰的水体边界）
      const wlMat = new THREE.MeshBasicMaterial({
        color: 0x67f5df, transparent: true, opacity: 0.34,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const wlFront = new THREE.Mesh(new THREE.BoxGeometry(L - 0.02, 0.014, 0.01), wlMat);
      wlFront.position.set(0, this.level, W / 2 - 0.015);
      wlFront.renderOrder = 14;
      g.add(wlFront);
      const wlBack = wlFront.clone();
      wlBack.position.z = -W / 2 + 0.015;
      g.add(wlBack);
      const wlSide = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.014, W - 0.02), wlMat);
      wlSide.position.set(-L / 2 + 0.015, this.level, 0);
      wlSide.renderOrder = 14;
      g.add(wlSide);
      const wlSide2 = wlSide.clone();
      wlSide2.position.x = L / 2 - 0.015;
      g.add(wlSide2);

      // 底座标牌
      this._buildLabel(g, L, W);

      // 水位刻度
      this._buildGauge(g, L, W, H);

      // 造浪装置
      this._buildWaveDevice();
      // 上方释放轨道
      this._buildRail();
    }

    _makeLabelTexture() {
      const c = U.canvas(1024, 256);
      const x = c.getContext('2d');
      x.clearRect(0, 0, 1024, 256);
      x.fillStyle = 'rgba(3,14,17,0.9)';
      x.fillRect(0, 0, 1024, 256);
      x.strokeStyle = 'rgba(99,247,221,0.35)';
      x.lineWidth = 3;
      x.strokeRect(10, 10, 1004, 236);
      x.fillStyle = '#d9fff7';
      x.font = '600 62px "Segoe UI", "Microsoft YaHei", sans-serif';
      x.fillText('WAVE  TANK', 54, 104);
      x.fillStyle = '#71d9ce';
      x.font = '400 30px "Microsoft YaHei", "Segoe UI", sans-serif';
      x.fillText('多密度球 · 分层与造浪实验', 56, 158);
      x.fillStyle = 'rgba(99,247,221,0.7)';
      x.font = '400 20px "Cascadia Mono", monospace';
      x.fillText('DENSITY GROUPS  ρ 0.32 — 1.85', 56, 204);
      x.strokeStyle = 'rgba(99,247,221,0.55)';
      x.beginPath();
      x.moveTo(790, 72);
      x.lineTo(950, 72);
      x.moveTo(790, 92);
      x.lineTo(920, 92);
      x.stroke();
      const tex = new THREE.CanvasTexture(c);
      if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

    _buildLabel(g, L, W) {
      const tex = this._makeLabelTexture();
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95 });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.52), mat);
      plane.position.set(-L * 0.5 + 1.5, -0.2, W / 2 + 0.372);
      g.add(plane);
    }

    _makeGaugeTexture(H) {
      const c = U.canvas(128, 512);
      const x = c.getContext('2d');
      x.clearRect(0, 0, 128, 512);
      x.fillStyle = 'rgba(7,22,26,0.5)';
      x.fillRect(0, 0, 128, 512);
      x.strokeStyle = 'rgba(130,255,235,0.65)';
      x.fillStyle = 'rgba(160,246,232,0.85)';
      x.font = '400 17px "Cascadia Mono", monospace';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(16, 0);
      x.lineTo(16, 512);
      x.stroke();
      for (let i = 0; i <= 30; i++) {
        const y = 512 - (i / 30) * 512;
        const long = i % 5 === 0;
        x.beginPath();
        x.moveTo(16, y);
        x.lineTo(long ? 58 : 38, y);
        x.stroke();
        if (long) x.fillText(String(i / 10).replace('.0', ''), 66, y + 6);
      }
      x.fillStyle = 'rgba(130,255,235,0.8)';
      x.font = '400 14px "Cascadia Mono", monospace';
      x.save();
      x.translate(112, 256);
      x.rotate(Math.PI / 2);
      x.fillText('WATER LEVEL / m', -72, 0);
      x.restore();
      const tex = new THREE.CanvasTexture(c);
      if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

    _buildGauge(g, L, W, H) {
      const tex = this._makeGaugeTexture(H);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, H), mat);
      m.position.set(-L / 2 + 0.45, H / 2, W / 2 + 0.02);
      m.renderOrder = 13;
      g.add(m);
    }

    _buildRail() {
      const L = this.L, W = this.W, H = this.H;
      const railY = H + 1.16;
      const g = this.holderGroup;
      const metal = new THREE.MeshStandardMaterial({
        color: 0x0b1e24, metalness: 0.85, roughness: 0.28, envMapIntensity: 1.0
      });
      const accent = new THREE.MeshBasicMaterial({
        color: 0x63f7dd, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, railY + 0.4, 0.07), metal);
        post.position.set(sx * (L / 2 + 0.3), railY / 2 - 0.2, -W / 2 - 0.3);
        g.add(post);
        const post2 = post.clone();
        post2.position.z = W / 2 + 0.3;
        g.add(post2);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(L + 0.8, 0.07, 0.07), metal);
      beam.position.set(0, railY, -W / 2 - 0.3);
      g.add(beam);
      const beam2 = beam.clone();
      beam2.position.z = W / 2 + 0.3;
      g.add(beam2);
      for (const sz of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, W + 0.66), metal);
        side.position.set(-L / 2 - 0.3, railY, 0);
        g.add(side);
        const side2 = side.clone();
        side2.position.x = L / 2 + 0.3;
        g.add(side2);
      }
      const glow = new THREE.Mesh(new THREE.BoxGeometry(L + 0.4, 0.012, 0.012), accent);
      glow.position.set(0, railY - 0.06, 0);
      g.add(glow);
      this.railY = railY;

      // 悬挂线（全部球共用）
      const cableGeo = new THREE.BufferGeometry();
      const pos = new Float32Array(2 * 3 * 20);
      cableGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const cableMat = new THREE.LineBasicMaterial({
        color: 0x7bf5e5, transparent: true, opacity: 0.22, depthWrite: false
      });
      this.cables = new THREE.LineSegments(cableGeo, cableMat);
      this.cables.frustumCulled = false;
      g.add(this.cables);
    }

    _buildWaveDevice() {
      const L = this.L, W = this.W, H = this.H;
      const type = this.p.wave.type;
      const g = new THREE.Group();
      this.structureGroup.add(g);
      this.paddleGroup = g;

      const pH = Math.min(H - 0.22, this.level + 0.62);
      const pW = W - 0.36;
      this.paddleHeight = pH;
      this.paddleWidth = pW;
      this.paddleBaseX = -L / 2 + 0.45;

      const plateMat = new THREE.MeshStandardMaterial({
        color: 0x0b3b41, metalness: 0.45, roughness: 0.32, envMapIntensity: 1.0,
        transparent: true, opacity: 0.62, side: THREE.DoubleSide,
        emissive: 0x062f2e, emissiveIntensity: 0.7
      });
      const trimMat = new THREE.MeshBasicMaterial({
        color: 0x6fffe9, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x0a171d, metalness: 0.8, roughness: 0.3
      });

      if (type === 'plunger') {
        // 水平压板，垂直往复
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, pW), plateMat);
        plate.position.set(this.paddleBaseX, this.level, 0);
        plate.castShadow = true;
        g.add(plate);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.015, pW * 0.98), trimMat);
        trim.position.set(this.paddleBaseX, this.level + 0.05, 0);
        g.add(trim);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 12), darkMat);
        shaft.position.set(this.paddleBaseX, this.level + 0.9, 0);
        g.add(shaft);
        this.paddlePlate = plate;
        this.paddleTrim = trim;
        this.paddleShaft = shaft;
        this.paddleMotion = 'vertical';
      } else {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.075, pH, pW), plateMat);
        plate.castShadow = true;
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.035, pW), trimMat);
        const inner = new THREE.Group();
        if (type === 'flap') {
          inner.position.y = 0.06;
          plate.position.y = pH / 2;
          trim.position.y = pH;
          inner.add(plate, trim);
          for (let i = -2; i <= 2; i++) {
            const rib = new THREE.Mesh(new THREE.BoxGeometry(0.09, pH * 0.86, 0.018), darkMat);
            rib.position.set(0.01, pH / 2, (i / 2.4) * pW * 0.42);
            inner.add(rib);
          }
          const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, pW, 16), darkMat);
          hinge.rotation.x = Math.PI / 2;
          hinge.position.y = 0.06;
          g.add(hinge);
          g.add(inner);
          g.position.set(this.paddleBaseX, 0, 0);
          this.paddleInner = inner;
          this.paddlePlate = plate;
          this.paddleTrim = trim;
          this.paddleMotion = 'rotate';
        } else {
          g.position.set(this.paddleBaseX, 0, 0);
          plate.position.y = pH / 2 + 0.05;
          trim.position.y = pH + 0.04;
          inner.add(plate, trim);
          for (let i = -2; i <= 2; i++) {
            const rib = new THREE.Mesh(new THREE.BoxGeometry(0.09, pH * 0.86, 0.018), darkMat);
            rib.position.set(0, pH / 2 + 0.05, (i / 2.4) * pW * 0.42);
            inner.add(rib);
          }
          g.add(inner);
          this.paddleInner = inner;
          this.paddleMotion = 'translate';
        }
      }

      // 外侧驱动机构
      const motorX = -L / 2 - 0.32;
      const motor = new THREE.Group();
      motor.position.set(motorX, this.level, 0);
      const box = new THREE.Mesh(U.roundedBox(0.42, 0.46, 0.52, 0.06, 1), darkMat);
      box.castShadow = true;
      motor.add(box);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.018, 8, 32),
        new THREE.MeshBasicMaterial({
          color: 0x6cffe9, transparent: true, opacity: 0.6,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      ring.rotation.y = Math.PI / 2;
      ring.position.set(-0.22, 0, 0);
      motor.add(ring);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 12), metalRod());
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0.44, 0, 0);
      motor.add(rod);
      this.structureGroup.add(motor);
      this.motorGroup = motor;
      this.motorRing = ring;
      this.rod = rod;

      function metalRod() {
        return new THREE.MeshStandardMaterial({ color: 0x80969a, metalness: 0.9, roughness: 0.22 });
      }
    }

    _buildWater() {
      this.waterGeo = new THREE.BufferGeometry();
      const n = this.nx * this.nz;
      const pos = new Float32Array(n * 3);
      const norm = new Float32Array(n * 3);
      const uv = new Float32Array(n * 2);
      const idx = [];
      for (let j = 0; j < this.nz; j++) {
        for (let i = 0; i < this.nx; i++) {
          const id = i + j * this.nx;
          const x = -this.L / 2 + (i / (this.nx - 1)) * this.L;
          const z = -this.W / 2 + (j / (this.nz - 1)) * this.W;
          pos[id * 3] = x;
          pos[id * 3 + 1] = this.level;
          pos[id * 3 + 2] = z;
          norm[id * 3] = 0;
          norm[id * 3 + 1] = 1;
          norm[id * 3 + 2] = 0;
          uv[id * 2] = i / (this.nx - 1);
          uv[id * 2 + 1] = j / (this.nz - 1);
        }
      }
      for (let j = 0; j < this.nz - 1; j++) {
        for (let i = 0; i < this.nx - 1; i++) {
          const a = i + j * this.nx;
          const b = a + 1;
          const c = a + this.nx;
          const d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      this.waterGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.waterGeo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
      this.waterGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      this.waterGeo.setIndex(idx);

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uActivity: { value: 0 },
          uLevel: { value: this.level },
          uL: { value: this.L },
          uW: { value: this.W },
          uSun: { value: new THREE.Vector3(0.4, 0.8, 0.45).normalize() },
          uCam: { value: new THREE.Vector3(0, 5, 12) }
        },
        vertexShader: `
          varying vec3 vWorld;
          varying vec3 vN;
          void main(){
            vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
            vN = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uActivity;
          uniform float uLevel;
          uniform float uL;
          uniform float uW;
          uniform vec3 uSun;
          uniform vec3 uCam;
          varying vec3 vWorld;
          varying vec3 vN;
          void main(){
            vec3 N = normalize(vN);
            vec3 V = normalize(uCam - vWorld);
            float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
            vec3 deep = vec3(0.02, 0.24, 0.27);
            vec3 shallow = vec3(0.18, 0.72, 0.64);
            float crest = clamp((vWorld.y - uLevel) * 2.5 + 0.35, 0.0, 1.0);
            vec3 base = mix(deep, shallow, crest);
            float diff = clamp(dot(N, normalize(vec3(0.4, 1.0, 0.3))), 0.0, 1.0);
            base *= 0.85 + 0.3 * diff;
            vec3 H = normalize(uSun + V);
            float spec = pow(max(dot(N, H), 0.0), 90.0) * 1.6;
            float sky = pow(max(dot(reflect(-V, N), normalize(vec3(0.2, 0.6, 0.4))), 0.0), 6.0) * 0.25;
            vec3 R0 = reflect(-V, N);
            float studio = pow(max(dot(R0, normalize(vec3(0.1, 0.55, 0.85))), 0.0), 5.0);
            vec3 col = base + vec3(0.6, 0.95, 0.9) * spec + vec3(0.35, 0.7, 0.68) * fres
                     + sky + vec3(0.3, 0.62, 0.6) * studio * 0.3;
            float f = sin(vWorld.x * 3.0 + uTime * 1.4) * sin(vWorld.z * 4.5 - uTime * 1.1);
            float foam = smoothstep(0.6, 1.0, f) * uActivity * 0.35
                       + exp(-pow((vWorld.x + uL * 0.5 - 0.45) / 0.5, 2.0)) * uActivity * 0.15;
            float steep = clamp(1.0 - N.y, 0.0, 1.0);
            float crestFoam = smoothstep(0.004, 0.055, steep)
                            * (0.35 + 0.65 * (0.5 + 0.5 * sin(vWorld.x * 6.0 - uTime * 2.2 + vWorld.z * 3.0)))
                            * clamp(uActivity * 1.6, 0.0, 1.0);
            foam = max(foam, crestFoam * 0.8);
            float rip = sin(vWorld.x * 16.0 + uTime * 2.2) * sin(vWorld.z * 20.0 - uTime * 1.8);
            col += rip * 0.012 * uActivity;
            col = mix(col, vec3(0.8, 0.98, 0.95), clamp(foam, 0.0, 0.55));
            float alpha = clamp(0.42 + fres * 0.32 + foam * 0.15, 0.0, 0.92);
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      this.waterMaterial = mat;
      const mesh = new THREE.Mesh(this.waterGeo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 10;
      this.waterMesh = mesh;
      this.waterGroup.add(mesh);
      this.waterPos = this.waterGeo.attributes.position.array;
      this.waterNorm = this.waterGeo.attributes.normal.array;

      // 水体染色体积
      const volMat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0x053c40) }, uLevel: { value: this.level } },
        vertexShader: `
          varying vec3 vWorld;
          void main(){ vWorld = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
        `,
        fragmentShader: `
          uniform vec3 uColor; uniform float uLevel;
          varying vec3 vWorld;
          void main(){
            float d = clamp(vWorld.y / uLevel, 0.0, 1.0);
            float a = 0.035 + (1.0 - d) * 0.12;
            gl_FragColor = vec4(uColor, a);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide
      });
      const vol = new THREE.Mesh(new THREE.BoxGeometry(this.L - 0.03, this.level, this.W - 0.03), volMat);
      vol.position.y = this.level / 2;
      vol.renderOrder = 8;
      this.waterGroup.add(vol);
      this.volumeTint = vol;

      // 底部焦散
      const causticMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uActivity: { value: 0 },
          uL: { value: this.L },
          uW: { value: this.W }
        },
        vertexShader: `
          varying vec3 vWorld;
          void main(){ vWorld = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
        `,
        fragmentShader: `
          uniform float uTime; uniform float uActivity; uniform float uL; uniform float uW;
          varying vec3 vWorld;
          void main(){
            vec2 p = vWorld.xz;
            float t = uTime;
            float a = sin(p.x*2.1 + t*0.9 + sin(p.y*1.9 + t*0.35)*1.7);
            float b = sin(p.y*2.7 - t*0.7 + sin(p.x*1.4 - t*0.5)*1.3);
            float c = sin((p.x+p.y)*3.1 + t*0.5);
            float ca = pow(max(a*0.5 + b*0.5, 0.0), 5.0) + pow(max(c, 0.0), 7.0)*0.55;
            float wall = smoothstep(0.0, 0.5, uL*0.5 - abs(p.x)) * smoothstep(0.0, 0.4, uW*0.5 - abs(p.y));
            float glow = (0.018 + uActivity*0.16) * ca * wall;
            gl_FragColor = vec4(vec3(0.16, 0.72, 0.66) * glow, 1.0);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const caustics = new THREE.Mesh(new THREE.PlaneGeometry(this.L - 0.05, this.W - 0.05), causticMat);
      caustics.rotation.x = -Math.PI / 2;
      caustics.position.y = 0.012;
      caustics.renderOrder = 5;
      this.waterGroup.add(caustics);
      this.causticMat = causticMat;
    }

    /* ==================== 粒子 ==================== */
    _buildParticles() {
      const count = 640;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const size = new Float32Array(count);
      const life = new Float32Array(count);
      const vel = new Float32Array(count * 3);
      const kind = new Uint8Array(count);
      const maxLife = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = 0;
        pos[i * 3 + 1] = -30;
        pos[i * 3 + 2] = 0;
        life[i] = 0;
        size[i] = 0.01;
        kind[i] = 0;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: U.sprayTexture() },
          uScale: { value: 1250 },
          uPixelRatio: { value: 1 }
        },
        vertexShader: `
          attribute vec3 aColor;
          attribute float aSize;
          attribute float aLife;
          varying vec3 vColor;
          varying float vLife;
          uniform float uScale;
          uniform float uPixelRatio;
          void main(){
            vColor = aColor;
            vLife = aLife;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uPixelRatio * (uScale / max(0.5, -mv.z));
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          varying vec3 vColor;
          varying float vLife;
          void main(){
            vec4 t = texture2D(uMap, gl_PointCoord);
            float a = t.a * vLife;
            if (a < 0.015) discard;
            gl_FragColor = vec4(vColor * (0.5 + vLife * 0.8), a);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      points.renderOrder = 11;
      this.particleGroup.add(points);
      this.particles = { geo, mat, points, pos, col, size, life, vel, kind, maxLife, count };
      this.particleGroup.visible = true;
    }

    _buildParticlesPoolReset() {
      const P = this.particles;
      if (!P) return;
      for (let i = 0; i < P.count; i++) {
        P.life[i] = 0;
        P.pos[i * 3 + 1] = -30;
      }
      P.geo.attributes.position.needsUpdate = true;
      P.geo.attributes.aLife.needsUpdate = true;
      this.sprayCursor = 0;
    }

    _spawnParticle(x, y, z, vx, vy, vz, sizeW, color, kind, lifeSec) {
      const P = this.particles;
      if (!P) return;
      const i = this.sprayCursor;
      this.sprayCursor = (i + 1) % P.count;
      P.pos[i * 3] = x;
      P.pos[i * 3 + 1] = y;
      P.pos[i * 3 + 2] = z;
      P.vel[i * 3] = vx;
      P.vel[i * 3 + 1] = vy;
      P.vel[i * 3 + 2] = vz;
      P.col[i * 3] = color.r;
      P.col[i * 3 + 1] = color.g;
      P.col[i * 3 + 2] = color.b;
      P.size[i] = sizeW;
      P.life[i] = 1;
      P.maxLife[i] = lifeSec;
      P.kind[i] = kind;
    }

    _spawnSplash(x, z, strength, color) {
      const c = new THREE.Color(color || 0xc9fffa);
      const y = this._surfaceAt(x, z);
      const n = 16 + Math.floor(strength * 18);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + (i % 3) * 0.3;
        const sp = (0.4 + this.fxRand() * 1.4) * (0.5 + strength);
        this._spawnParticle(
          x + Math.cos(ang) * 0.08, y + 0.03, z + Math.sin(ang) * 0.08,
          Math.cos(ang) * sp * 0.65, 0.6 + this.fxRand() * 1.8 * strength, Math.sin(ang) * sp * 0.65,
          0.028 + this.fxRand() * 0.035, c, 0, 0.6 + this.fxRand() * 0.5
        );
      }
      for (let i = 0; i < 10; i++) {
        this._spawnParticle(
          x + (this.fxRand() - 0.5) * 0.25, y - 0.15 - this.fxRand() * 0.3, z + (this.fxRand() - 0.5) * 0.25,
          (this.fxRand() - 0.5) * 0.3, 0.25 + this.fxRand() * 0.5, (this.fxRand() - 0.5) * 0.3,
          0.018 + this.fxRand() * 0.02, new THREE.Color(0xb8fffa), 1, 1.2 + this.fxRand() * 1.2
        );
      }
    }

    _updateParticles(dt) {
      const P = this.particles;
      if (!P) return;
      const pos = P.pos, vel = P.vel, life = P.life, kind = P.kind;
      for (let i = 0; i < P.count; i++) {
        if (life[i] <= 0) continue;
        const i3 = i * 3;
        if (kind[i] === 1) {
          vel[i3 + 1] += 1.3 * dt;
          vel[i3] += Math.sin(this.time * 4.0 + i) * 0.4 * dt;
          vel[i3] *= 0.995; vel[i3 + 2] *= 0.995;
        } else {
          vel[i3 + 1] -= 7.5 * dt;
          vel[i3] *= 0.995; vel[i3 + 2] *= 0.995;
        }
        pos[i3] += vel[i3] * dt;
        pos[i3 + 1] += vel[i3 + 1] * dt;
        pos[i3 + 2] += vel[i3 + 2] * dt;
        if (kind[i] === 1 && pos[i3 + 1] > this._surfaceAt(pos[i3], pos[i3 + 2])) {
          life[i] = 0;
        }
        life[i] -= dt / P.maxLife[i];
        if (life[i] < 0) life[i] = 0;
      }
      P.geo.attributes.position.needsUpdate = true;
      P.geo.attributes.aLife.needsUpdate = true;
      P.geo.attributes.aColor.needsUpdate = true;
      P.geo.attributes.aSize.needsUpdate = true;
    }

    /* ==================== 球体 ==================== */
    _ballPositions() {
      const arr = [];
      const nGroup = this.p.groups.length;
      const per = Math.max(2, Math.round(this.p.ball.perGroup));
      for (let g = 0; g < nGroup; g++) {
        for (let k = 0; k < per; k++) {
          const zBase = -this.W * 0.3 + (k / Math.max(1, per - 1)) * this.W * 0.6;
          const z = zBase + (g % 2 === 0 ? 1 : -1) * this.W * 0.02;
          const x = this.L * (GROUP_X[g] || 0) + ((k % 2) === 0 ? -0.12 : 0.12);
          const y = this.level + this.p.ball.releaseHeight + this.radius + k * 0.015;
          arr.push({ x, y, z, group: g, k });
        }
      }
      // 标记本轮最后一组的最后一颗球
      const last = arr[arr.length - 1];
      if (last) last.isAnchor = true;
      return arr;
    }

    _buildBalls() {
      this.balls = [];
      this.holderGroup.children.slice().forEach((c) => {
        if (c === this.cables) return;
      });
      // 清除上一轮的挂环与夹持灯
      if (this.holders) {
        for (const h of this.holders) {
          if (h.ring) this.holderGroup.remove(h.ring);
          if (h.clamp) this.holderGroup.remove(h.clamp);
        }
      }
      this.holders = [];
      if (this.cables) {
        this.holderGroup.remove(this.cables);
        this.cables.geometry.dispose();
        this.cables.material.dispose();
        this.cables = null;
      }
      // 重建悬挂线
      const cableGeo = new THREE.BufferGeometry();
      const total = this.balls.length || 1;
      cableGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 2 * (this.p.groups.length * this.p.ball.perGroup)), 3));
      const cableMat = new THREE.LineBasicMaterial({ color: 0x7bf5e5, transparent: true, opacity: 0.2, depthWrite: false });
      this.cables = new THREE.LineSegments(cableGeo, cableMat);
      this.cables.frustumCulled = false;
      this.holderGroup.add(this.cables);

      const positions = this._ballPositions();
      const r = this.radius;
      const ballGeo = new THREE.SphereGeometry(r, 40, 28);
      const bandGeo = new THREE.TorusGeometry(r * 1.001, r * 0.02, 6, 64);
      const dotGeo = new THREE.SphereGeometry(r * 0.055, 10, 8);
      const count = positions.length;
      for (let i = 0; i < count; i++) {
        const pp = positions[i];
        const grp = this.p.groups[pp.group];
        const color = new THREE.Color(grp.color);
        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.48,
          metalness: 0.02,
          emissive: color,
          emissiveIntensity: 0.015,
          envMapIntensity: 0.15
        });
        const mesh = new THREE.Mesh(ballGeo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const group = new THREE.Group();
        group.add(mesh);
        const band = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({
          color: 0xffffff, metalness: 0.2, roughness: 0.32,
          transparent: true, opacity: 0.18
        }));
        band.rotation.x = Math.PI / 2;
        group.add(band);
        const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
        dot.position.set(r * 0.68, r * 0.62, r * 0.38);
        group.add(dot);
        group.position.set(pp.x, pp.y, pp.z);
        this.ballGroup.add(group);

        // 挂环 / 夹持光点
        const ringMat = new THREE.MeshBasicMaterial({
          color: color, transparent: true, opacity: 0.55,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.35, 0.008, 6, 48), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(pp.x, pp.y - r - 0.14, pp.z);
        this.holderGroup.add(ring);
        const clamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 10, 8),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
        );
        clamp.position.set(pp.x, this.railY - 0.045, pp.z);
        this.holderGroup.add(clamp);

        const volume = (4 / 3) * Math.PI * r * r * r;
        this.balls.push({
          group, mesh, ring, ringMat, clamp,
          x: pp.x, y: pp.y, z: pp.z,
          vx: 0, vy: 0, vz: 0,
          radius: r, density: grp.density, groupIndex: pp.group,
          mass: volume * grp.density * 1000,
          active: false, held: true, entered: false, inWater: false, onBottom: false,
          releaseAt: 0, enteredAt: -1, isAnchor: !!pp.isAnchor,
          ang: new THREE.Vector3(), angVel: new THREE.Vector3(),
          lastSound: 0, spinPhase: i * 1.7
        });
      }
      this._buildCables();
      this.waterGroup.visible = true;
    }

    _buildCables() {
      if (!this.cables) return;
      const n = this.balls.length;
      const arr = this.cables.geometry.attributes.position.array;
      for (let i = 0; i < n; i++) {
        const b = this.balls[i];
        const o = i * 6;
        arr[o] = b.x; arr[o + 1] = this.railY - 0.05; arr[o + 2] = b.z;
        arr[o + 3] = b.x; arr[o + 4] = b.y + b.radius; arr[o + 5] = b.z;
      }
      this.cables.geometry.attributes.position.needsUpdate = true;
    }

    _updateHolders() {
      if (!this.cables) return;
      const arr = this.cables.geometry.attributes.position.array;
      for (let i = 0; i < this.balls.length; i++) {
        const b = this.balls[i];
        const o = i * 6;
        if (b.held) {
          arr[o] = b.x; arr[o + 1] = this.railY - 0.05; arr[o + 2] = b.z;
          arr[o + 3] = b.x; arr[o + 4] = b.y + b.radius * 0.95; arr[o + 5] = b.z;
          if (b.ring) {
            b.ring.visible = true;
            b.ring.rotation.z += 0.01;
            b.ringMat.opacity = 0.36 + Math.sin(this.time * 2.2 + b.spinPhase) * 0.12;
            b.ring.position.set(b.x, b.y - b.radius - 0.14, b.z);
          }
          if (b.clamp) b.clamp.visible = true;
        } else {
          for (let q = 0; q < 6; q++) arr[o + q] = arr[o + q]; // 保留位置
          if (b.ring) {
            if (b.ring.visible) {
              b.ring.scale.multiplyScalar(1.035);
              b.ringMat.opacity -= 0.035;
              if (b.ringMat.opacity <= 0) b.ring.visible = false;
            }
          }
          if (b.clamp) b.clamp.visible = false;
          // 线收回到轨道
          arr[o + 3] = b.x;
          arr[o + 4] = this.railY - 0.05;
          arr[o + 5] = b.z;
        }
      }
      this.cables.geometry.attributes.position.needsUpdate = true;
    }

    /* ==================== 流体求解 ==================== */
    _initFluid() {
      this.nx = NX;
      this.nz = NZ;
      this.dx = this.L / (NX - 1);
      this.dz = this.W / (NZ - 1);
      const n = NX * NZ;
      this.h = new Float32Array(n);
      this.hPrev = new Float32Array(n);
      this.u = new Float32Array(n);
      this.v = new Float32Array(n);
      this.etaV = new Float32Array(n);
      this.hVis = new Float32Array(n);
      this.du = new Float32Array(n);
      this.dv = new Float32Array(n);
      this.xs = new Float32Array(NX);
      this.zs = new Float32Array(NZ);
      for (let i = 0; i < NX; i++) this.xs[i] = -this.L / 2 + (i / (NX - 1)) * this.L;
      for (let j = 0; j < NZ; j++) this.zs[j] = -this.W / 2 + (j / (NZ - 1)) * this.W;
    }

    _fluidStep(dt) {
      const h = this.h, u = this.u, v = this.v, du = this.du, dv = this.dv;
      const nx = NX, nz = NZ, dx = this.dx, dz = this.dz;
      const g = this.p.fluid.gravity;
      const H = this.level;
      const vis = this.p.fluid.viscosity;
      const damp = Math.exp(-vis * 0.75 * dt);

      this.hPrev.set(h);

      for (let j = 1; j < nz - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const id = i + j * nx;
          const dhdx = (h[id + 1] - h[id - 1]) / (2 * dx);
          const dhdz = (h[id + nx] - h[id - nx]) / (2 * dz);
          du[id] = -g * dhdx;
          dv[id] = -g * dhdz;
        }
      }
      for (let j = 1; j < nz - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const id = i + j * nx;
          u[id] = (u[id] + du[id] * dt) * damp;
          v[id] = (v[id] + dv[id] * dt) * damp;
          if (Math.abs(u[id]) > 3) u[id] = Math.sign(u[id]) * 3;
          if (Math.abs(v[id]) > 3) v[id] = Math.sign(v[id]) * 3;
        }
      }
      // 边界
      for (let j = 0; j < nz; j++) {
        u[j * nx] = 0; u[nx - 1 + j * nx] = 0;
        v[j * nx] = 0; v[nx - 1 + j * nx] = 0;
      }
      for (let i = 0; i < nx; i++) {
        u[i] = 0; u[i + (nz - 1) * nx] = 0;
        v[i] = 0; v[i + (nz - 1) * nx] = 0;
      }

      // 连续性
      for (let j = 1; j < nz - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const id = i + j * nx;
          const div = (u[id + 1] - u[id - 1]) / (2 * dx) + (v[id + nx] - v[id - nx]) / (2 * dz);
          h[id] -= H * div * dt;
        }
      }

      // 推板体积源
      this._applyPaddleSource(dt);

      // 边界 Neumann + 阻尼
      for (let j = 1; j < nz - 1; j++) {
        h[j * nx] = h[1 + j * nx];
        h[nx - 1 + j * nx] = h[nx - 2 + j * nx];
      }
      for (let i = 1; i < nx - 1; i++) {
        h[i] = h[i + nx];
        h[i + (nz - 1) * nx] = h[i + (nz - 2) * nx];
      }
      // 角落
      h[0] = (h[1] + h[nx]) * 0.5;
      h[nx - 1] = (h[nx - 2] + h[nx - 1 + nx]) * 0.5;
      h[(nz - 1) * nx] = (h[1 + (nz - 1) * nx] + h[(nz - 2) * nx]) * 0.5;
      h[nx - 1 + (nz - 1) * nx] = (h[nx - 2 + (nz - 1) * nx] + h[nx - 1 + (nz - 2) * nx]) * 0.5;

      let mean = 0;
      for (let q = 0; q < h.length; q++) {
        if (h[q] > 0.7) h[q] = 0.7;
        if (h[q] < -0.7) h[q] = -0.7;
        mean += h[q];
      }
      mean /= h.length;
      const hd = Math.exp(-0.022 * dt);
      for (let q = 0; q < h.length; q++) h[q] = (h[q] - mean) * hd;

      // 轻度平滑，抑制细碎尖峰
      const hSm = this.hVisTmp || (this.hVisTmp = new Float32Array(h.length));
      for (let j = 1; j < nz - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const id = i + j * nx;
          hSm[id] = (h[id] * 4 + h[id - 1] + h[id + 1] + h[id - nx] + h[id + nx]) * 0.125;
        }
      }
      for (let j = 1; j < nz - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const id = i + j * nx;
          h[id] = h[id] * 0.9 + hSm[id] * 0.1;
        }
      }

      // 水面垂直速度
      for (let q = 0; q < h.length; q++) {
        const trend = (h[q] - this.hPrev[q]) / Math.max(1e-6, dt);
        this.etaV[q] = this.etaV[q] * 0.72 + trend * 0.28;
      }
    }

    _applyPaddleSource(dt) {
      if (Math.abs(this.paddleVel) < 0.0001) return;
      const nx = NX, nz = NZ;
      const typeScale = this.p.wave.type === 'piston' ? 1.0 : this.p.wave.type === 'flap' ? 0.78 : 0.55;
      const src = this.paddleVel * typeScale;
      if (Math.abs(src) < 0.0001) return;
      const x0 = -this.L / 2 + 0.3;
      const sigma = 0.16;
      const norm = 1 / (sigma * Math.sqrt(2 * Math.PI));
      const H = this.level;
      const amp = src * H * norm * 0.3;
      for (let j = 0; j < nz; j++) {
        const z = this.zs[j];
        const zShape = 0.9 + 0.1 * Math.cos((z / this.W) * Math.PI * 2.0);
        for (let i = 0; i < nx; i++) {
          const x = this.xs[i];
          const d = x - x0;
          if (Math.abs(d) > 0.9) continue;
          const w = Math.exp(-(d * d) / (2 * sigma * sigma));
          const id = i + j * nx;
          this.h[id] += amp * w * zShape * dt;
        }
      }
    }

    _updateWaterMesh() {
      if (!this.waterMesh) return;
      const pos = this.waterPos, norm = this.waterNorm;
      const nx = NX, nz = NZ;
      const h = this.h, hv = this.hVis;
      const dx = this.dx, dz = this.dz;
      // 显示用的平滑高度场，避免尖刺三角面
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const id = i + j * nx;
          if (i === 0 || j === 0 || i === nx - 1 || j === nz - 1) {
            hv[id] = h[id];
          } else {
            hv[id] = (h[id] * 4 + h[id - 1] + h[id + 1] + h[id - nx] + h[id + nx]) * 0.125;
          }
        }
      }
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const id = i + j * nx;
          pos[id * 3] = this.xs[i];
          pos[id * 3 + 1] = this.level + hv[id];
          pos[id * 3 + 2] = this.zs[j];
          const il = i > 0 ? id - 1 : id;
          const ir = i < nx - 1 ? id + 1 : id;
          const jl = j > 0 ? id - nx : id;
          const jr = j < nz - 1 ? id + nx : id;
          const dhdx = (hv[ir] - hv[il]) / (2 * dx);
          const dhdz = (hv[jr] - hv[jl]) / (2 * dz);
          const inv = 1 / Math.sqrt(dhdx * dhdx + 1 + dhdz * dhdz);
          norm[id * 3] = -dhdx * inv;
          norm[id * 3 + 1] = inv;
          norm[id * 3 + 2] = -dhdz * inv;
        }
      }
      this.waterGeo.attributes.position.needsUpdate = true;
      this.waterGeo.attributes.normal.needsUpdate = true;
      this.waterMaterial.uniforms.uTime.value = this.time;
      this.waterMaterial.uniforms.uActivity.value = this._activity();
      if (this.causticMat) {
        this.causticMat.uniforms.uTime.value = this.time;
        this.causticMat.uniforms.uActivity.value = this._activity();
      }
    }

    _activity() {
      return U.clamp(this.waveEnergy * 1.8 + (this.waveActive ? 0.22 : 0), 0, 1);
    }

    _updatePaddle(dt) {
      const wave = this.p.wave;
      if (this.waveActive) {
        this.waveT += dt;
        const omega = Math.PI * 2 * wave.frequency;
        const ramp = U.smoothstep(0, 0.35, this.waveT);
        const s = wave.amplitude * Math.sin(omega * this.waveT) * ramp;
        const v = wave.amplitude * omega * Math.cos(omega * this.waveT) * ramp;
        this.paddleDisp = s;
        this.paddleVel = v;
        this.paddleReturn = null;
        if (this.time - this.lastPaddleSound > 0.24 && Math.abs(v) > 0.2) {
          this.lastPaddleSound = this.time;
          if (this.events.onPaddle) this.events.onPaddle();
        }
      } else if (this.paddleReturn) {
        const k = U.clamp((this.time - this.paddleReturn.start) / 0.4, 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        this.paddleDisp = this.paddleReturn.from * (1 - e);
        this.paddleVel = this.paddleReturn.from * 3 * Math.pow(1 - k, 2) / 0.4;
        if (k >= 1) {
          this.paddleDisp = 0;
          this.paddleVel = 0;
          this.paddleReturn = null;
        }
      } else {
        this.paddleDisp = U.damp(this.paddleDisp, 0, 8, dt);
        if (Math.abs(this.paddleDisp) < 1e-4) this.paddleDisp = 0;
        this.paddleVel = 0;
      }
      // 更新装置外观
      const pg = this.paddleGroup;
      if (!pg) return;
      if (this.paddleMotion === 'translate') {
        pg.position.x = this.paddleBaseX + this.paddleDisp;
      } else if (this.paddleMotion === 'rotate') {
        const ang = Math.asin(U.clamp(this.paddleDisp / this.paddleHeight, -0.65, 0.65));
        this.paddleInner.rotation.z = ang;
      } else if (this.paddleMotion === 'vertical') {
        this.paddlePlate.position.y = this.level + this.paddleDisp;
        if (this.paddleTrim) this.paddleTrim.position.y = this.level + this.paddleDisp + 0.05;
        if (this.paddleShaft) this.paddleShaft.position.y = this.level + this.paddleDisp + 0.9;
      }
      // 联动杆
      if (this.rod) {
        let rx = -this.L / 2 - 0.32 + 0.7;
        let ry = this.level;
        if (this.paddleMotion === 'rotate') {
          ry = this.level * 0.75;
        }
        this.rod.position.set(rx, ry, 0);
        this.rod.scale.y = 1;
      }
      if (this.motorRing) {
        this.motorRing.rotation.z += dt * (this.waveActive ? 2.4 : 0.3);
      }
    }

    /* ==================== 采样 ==================== */
    _sampleGrid(arr, x, z) {
      const fx = U.clamp((x + this.L / 2) / this.dx, 0, NX - 1.001);
      const fz = U.clamp((z + this.W / 2) / this.dz, 0, NZ - 1.001);
      const i0 = Math.floor(fx), j0 = Math.floor(fz);
      const i1 = Math.min(i0 + 1, NX - 1), j1 = Math.min(j0 + 1, NZ - 1);
      const u = fx - i0, v = fz - j0;
      const a = arr[i0 + j0 * NX], b = arr[i1 + j0 * NX], c = arr[i0 + j1 * NX], d = arr[i1 + j1 * NX];
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }

    _surfaceAt(x, z) {
      return this.level + this._sampleGrid(this.h, x, z);
    }

    _etaVelAt(x, z) {
      return this._sampleGrid(this.etaV, x, z);
    }

    /* ==================== 球体更新 ==================== */
    _updateBalls(dt) {
      const g = this.p.fluid.gravity;
      const waterRho = 1.0;
      const currentTarget = this.waveActive ? U.clamp(0.6 + this.p.wave.amplitude * 1.3, 0, 1.15) : 0;
      this.current += (currentTarget - this.current) * (1 - Math.exp(-1.2 * dt));

      for (const b of this.balls) {
        if (!b.active) continue;
        const surface = this._surfaceAt(b.x, b.z);
        if (!b.entered && b.y - b.radius <= surface + 0.005 && b.vy < 0.3) {
          this._onEntry(b, surface);
        }

        const sub = this._submergedFraction(b, surface);
        const depthY = Math.min(b.y, this.level);
        const yn = U.clamp(depthY / Math.max(0.2, this.level), 0, 1.2);

        // 流体速度
        let fu = this._sampleGrid(this.u, b.x, b.z) * (0.3 + 0.7 * U.clamp(yn, 0, 1));
        let fv = this._sampleGrid(this.v, b.x, b.z) * (0.3 + 0.7 * U.clamp(yn, 0, 1));
        // 大尺度环流（表面向右、底部向左、左侧上升）
        const X = U.clamp((b.x + this.L / 2) / this.L, 0, 1);
        const Yn = U.clamp(depthY / Math.max(0.2, this.level), 0, 1);
        const Z = U.clamp((b.z + this.W / 2) / this.W, 0, 1);
        const U0 = this.current * 0.52;
        const swirlZ = 0.8 + 0.2 * Math.sin(Math.PI * Z * 2.0);
        const uG = -U0 * Math.sin(Math.PI * X) * Math.cos(Math.PI * Yn) * swirlZ;
        const vG = -U0 * 0.22 * Math.sin(Math.PI * X * 2.0) * Math.sin(Math.PI * Yn) * Math.cos(Math.PI * Z);
        let wG = U0 * (this.level / this.L) * Math.cos(Math.PI * X) * Math.sin(Math.PI * Yn);
        const turb = this.current * this.waveEnergy * 0.18;
        fu += uG + turb * Math.sin(2.3 * b.z + 1.7 * this.time) * Math.cos(1.4 * b.x - 0.9 * this.time);
        fv += vG + turb * Math.sin(1.9 * b.x - 1.3 * this.time) * Math.cos(2.2 * b.z + 0.7 * this.time);
        let fw = this._etaVelAt(b.x, b.z) * (0.25 + 0.75 * U.clamp(yn, 0, 1)) + wG;
        // 底部湍流抬升
        if (b.y - b.radius < 0.12) {
          fw += this.current * 0.12 * Math.sin(this.time * 2.1 + b.x * 1.4 + b.z);
        }

        const relx = b.vx - fu;
        const rely = b.vy - fw;
        const relz = b.vz - fv;
        const relMag = Math.hypot(relx, rely, relz);
        const r = b.radius;
        const area = Math.PI * r * r;
        const volume = (4 / 3) * Math.PI * r * r * r;
        const frac = sub;
        const effMass = volume * (b.density + 0.5 * waterRho * frac);

        let ax = 0, ay = -g, az = 0;
        ay += (waterRho / b.density) * g * frac;
        // 阻力（二次 + 线性）
        const cd = 1.05;
        const dragCoef = (0.5 * cd * waterRho * area * frac) / Math.max(1e-6, effMass);
        const dragMag = dragCoef * relMag;
        ax -= dragMag * relx + 1.1 * frac * relx * (area / Math.max(1e-6, effMass));
        ay -= dragMag * rely + 1.1 * frac * rely * (area / Math.max(1e-6, effMass));
        az -= dragMag * relz + 1.1 * frac * relz * (area / Math.max(1e-6, effMass));

        // 限幅
        const amax = 55;
        ax = U.clamp(ax, -amax, amax);
        ay = U.clamp(ay, -amax, amax);
        az = U.clamp(az, -amax, amax);

        b.vx += ax * dt;
        b.vy += ay * dt;
        b.vz += az * dt;
        // 速度上限
        const sp = Math.hypot(b.vx, b.vy, b.vz);
        if (sp > 9) {
          const k = 9 / sp;
          b.vx *= k; b.vy *= k; b.vz *= k;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;

        // 角速度
        if (frac > 0.2) {
          const targetSpinX = (relz) * 0.55 / Math.max(0.08, r);
          const targetSpinZ = (-relx) * 0.55 / Math.max(0.08, r);
          b.angVel.x += (targetSpinX - b.angVel.x) * Math.min(1, dt * 3.2);
          b.angVel.z += (targetSpinZ - b.angVel.z) * Math.min(1, dt * 3.2);
        }
        if (b.onBottom) {
          b.angVel.z = -b.vx / r;
          b.angVel.x = b.vz / r;
        }

        this._collideWalls(b);
        this._collideFloor(b);
        b.group.position.set(b.x, b.y, b.z);
        b.ang.x += b.angVel.x * dt;
        b.ang.y += b.angVel.y * dt;
        b.ang.z += b.angVel.z * dt;
        b.group.rotation.set(b.ang.x, b.ang.y, b.ang.z);
        b.inWater = frac > 0.01;
      }

      this._ballBallCollisions();
    }

    _submergedFraction(b, surface) {
      const d = U.clamp(surface - (b.y - b.radius), 0, 2 * b.radius);
      if (d <= 0) return 0;
      const cap = (Math.PI * d * d * (3 * b.radius - d)) / 3;
      const vol = (4 / 3) * Math.PI * b.radius * b.radius * b.radius;
      return U.clamp(cap / vol, 0, 1);
    }

    _onEntry(b, surface) {
      if (b.entered) return;
      b.entered = true;
      b.enteredAt = this.time;
      const strength = U.clamp((-b.vy + 2.0) / 7.0, 0.18, 1);
      this._splash(b.x, b.z, 0.018 + strength * 0.028, (b.radius + 0.55) * 2.0);
      this._spawnSplash(b.x, b.z, strength, this.p.groups[b.groupIndex].color);
      this._spawnFoamRing(b.x, b.z, strength, this.p.groups[b.groupIndex].color);
      this.cameraShake = Math.min(0.02, this.cameraShake + strength * 0.01);
      this.entryCount++;
      if (this.events.onEntry) this.events.onEntry(strength);
      if (this.events.onSplash) this.events.onSplash(strength);
      if (b.isAnchor && this.tLast < 0) {
        this.tLast = this.time;
        if (this.autoWave) {
          this.waveStartAt = this.tLast + this.p.wave.delay;
          this.waveStopAt = this.waveStartAt + this.p.wave.duration;
        }
      }
    }

    _splash(x, z, depth, sigma) {
      const nx = NX, nz = NZ;
      const x0 = U.clamp((x + this.L / 2) / this.dx, 1, NX - 2);
      const z0 = U.clamp((z + this.W / 2) / this.dz, 1, NZ - 2);
      const rad = Math.max(1.5, sigma / this.dx * 1.5);
      const iA = Math.max(1, Math.floor(x0 - rad));
      const iB = Math.min(NX - 2, Math.ceil(x0 + rad));
      const jA = Math.max(1, Math.floor(z0 - rad));
      const jB = Math.min(NZ - 2, Math.ceil(z0 + rad));
      for (let j = jA; j <= jB; j++) {
        for (let i = iA; i <= iB; i++) {
          const d2 = Math.pow((i - x0) * this.dx, 2) + Math.pow((j - z0) * this.dz, 2);
          const w = Math.exp(-d2 / (2 * sigma * sigma));
          const id = i + j * nx;
          this.h[id] -= depth * w;
          this.u[id] += ((i - x0) * this.dx) * w * 0.18;
          this.v[id] += ((j - z0) * this.dz) * w * 0.18;
        }
      }
    }

    _spawnFoamRing(x, z, strength, color) {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).lerp(new THREE.Color(0xd6fffa), 0.55),
        transparent: true, opacity: 0.55 * strength + 0.15,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, this._surfaceAt(x, z) + 0.015, z);
      ring.scale.setScalar(0.25);
      this.fxGroup.add(ring);
      this.fx.push({ type: 'ring', mesh: ring, mat, t: 0, dur: 1.1 });
    }

    _collideFloor(b) {
      const floor = 0.01 + b.radius;
      if (b.y < floor) {
        b.y = floor;
        if (b.vy < -0.25) {
          b.vy = -b.vy * 0.16;
          if (Math.abs(b.vy) > 0.2 && this.events.onBall) this.events.onBall(U.clamp(-b.vy * 0.25, 0.08, 0.6));
          this._spawnParticle(b.x, 0.08, b.z, (this.fxRand() - 0.5) * 0.3, 0.3, (this.fxRand() - 0.5) * 0.3, 0.016, new THREE.Color(0xc9fffa), 1, 1.0);
        } else {
          b.vy = 0;
        }
        const fr = b.density > 1.0 ? 1.4 : 2.6;
        b.vx *= Math.exp(-fr * 0.012);
        b.vz *= Math.exp(-fr * 0.012);
        b.onBottom = true;
      } else {
        b.onBottom = false;
      }
    }

    _collideWalls(b) {
      const r = b.radius;
      const minX = -this.L / 2 + 0.19 + r;
      const maxX = this.L / 2 - r;
      const minZ = -this.W / 2 + r;
      const maxZ = this.W / 2 - r;
      if (b.x < minX) {
        b.x = minX;
        if (b.vx < 0) b.vx = -b.vx * 0.25;
      } else if (b.x > maxX) {
        b.x = maxX;
        if (b.vx > 0) b.vx = -b.vx * 0.25;
      }
      if (b.z < minZ) {
        b.z = minZ;
        if (b.vz < 0) b.vz = -b.vz * 0.25;
      } else if (b.z > maxZ) {
        b.z = maxZ;
        if (b.vz > 0) b.vz = -b.vz * 0.25;
      }
    }

    _ballBallCollisions() {
      const balls = this.balls;
      for (let i = 0; i < balls.length; i++) {
        const A = balls[i];
        if (!A.active) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const B = balls[j];
          if (!B.active) continue;
          const dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z;
          const rr = A.radius + B.radius;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < rr * rr && d2 > 1e-9) {
            const d = Math.sqrt(d2);
            const nx = dx / d, ny = dy / d, nz = dz / d;
            const overlap = rr - d;
            const ma = A.mass, mb = B.mass;
            const wa = mb / (ma + mb), wb = ma / (ma + mb);
            A.x -= nx * overlap * wa; A.y -= ny * overlap * wa; A.z -= nz * overlap * wa;
            B.x += nx * overlap * wb; B.y += ny * overlap * wb; B.z += nz * overlap * wb;
            const rvx = B.vx - A.vx, rvy = B.vy - A.vy, rvz = B.vz - A.vz;
            const vn = rvx * nx + rvy * ny + rvz * nz;
            if (vn < 0) {
              const e = 0.22;
              const jimp = -(1 + e) * vn / (1 / ma + 1 / mb);
              A.vx -= nx * jimp / ma; A.vy -= ny * jimp / ma; A.vz -= nz * jimp / ma;
              B.vx += nx * jimp / mb; B.vy += ny * jimp / mb; B.vz += nz * jimp / mb;
              if (Math.abs(vn) > 0.8) {
                if (this.events.onBall) this.events.onBall(U.clamp(Math.abs(vn) * 0.14, 0.08, 0.7));
                for (let q = 0; q < 3; q++) {
                  this._spawnParticle(
                    (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2,
                    (this.fxRand() - 0.5) * 0.4, 0.2 + this.fxRand() * 0.4, (this.fxRand() - 0.5) * 0.4,
                    0.016, new THREE.Color(0xc9fffa), 1, 0.9
                  );
                }
              }
            }
            A.group.position.set(A.x, A.y, A.z);
            B.group.position.set(B.x, B.y, B.z);
          }
        }
      }
    }

    _updateFx(dt) {
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i];
        f.t += dt;
        const k = U.clamp(f.t / f.dur, 0, 1);
        if (f.type === 'ring') {
          f.mesh.scale.setScalar(0.25 + k * 2.4);
          f.mat.opacity = (1 - k) * 0.5;
        }
        if (k >= 1) {
          this.fxGroup.remove(f.mesh);
          f.mesh.geometry.dispose();
          f.mat.dispose();
          this.fx.splice(i, 1);
        }
      }
    }

    _updateHeld(dt) {
      for (const b of this.balls) {
        if (b.held && !b.active) {
          b.y += Math.sin(this.time * 1.4 + b.spinPhase) * 0.0015;
          b.group.position.set(
            b.x,
            b.y + Math.sin(this.time * 1.4 + b.spinPhase) * 0.018,
            b.z
          );
          b.group.rotation.y += dt * 0.12;
        }
      }
    }

    /* ==================== 主循环 ==================== */
    step(dt) {
      const simulate = this.started || this.waveActive;
      if (simulate) this.time += dt;
      this._updateHeld(dt);

      if (simulate) {
        this._updatePaddle(dt);
        // 自动放球
        if (this.started) {
          for (const b of this.balls) {
            if (b.held && !b.active && this.time >= b.releaseAt) {
              b.held = false;
              b.active = true;
              b.avy = 0;
            }
          }
        }
        const nSub = 2;
        for (let k = 0; k < nSub; k++) {
          this._fluidStep(dt / nSub);
          this._updateBalls(dt / nSub);
        }
        this._updateWaterMesh();
        this._updateHolders();
        this._updateParticles(dt);
        this._updateFx(dt);
        this._autoWaveCheck();

        // 水面能谱
        let en = 0;
        const h = this.h;
        for (let i = 0; i < h.length; i += 3) en += h[i] * h[i];
        en = Math.sqrt(en / (h.length / 3));
        this.waveEnergy = U.damp(this.waveEnergy, Math.min(1, en * 2.6), 2.0, dt);

        this.cameraShake *= Math.exp(-5.5 * dt);
        if (this.waveStoppedAt > 0 && this.time - this.waveStoppedAt > 6.0) this.ended = true;
        if (this.tLast > 0 && this.time - this.tLast > this.p.wave.delay + this.p.wave.duration + 6.0) this.ended = true;
      } else {
        // 静止初始状态也保持一点环境动感
        this._updateParticles(dt);
        this._updateFx(dt);
        this._updateWaterMesh();
        this._updateHolders();
        this.waveEnergy = U.damp(this.waveEnergy, 0, 2, dt);
      }
    }

    _autoWaveCheck() {
      if (this.autoWave && this.tLast > 0 && !this.waveActive) {
        if (this.waveStartAt < 0) this.waveStartAt = this.tLast + this.p.wave.delay;
        if (this.time >= this.waveStartAt) {
          this.startWave(true);
        }
      }
      if (this.waveActive && this.autoWave && this.waveStopAt > 0 && this.time >= this.waveStopAt) {
        this.stopWave(true);
      }
    }

    /* ==================== 生命周期 ==================== */
    configure(partial) {
      const old = this.p;
      this.p = deepMerge(this.p, partial);
      const structural = old.tank.length !== this.p.tank.length ||
        old.tank.width !== this.p.tank.width ||
        old.tank.height !== this.p.tank.height ||
        old.fluid.level !== this.p.fluid.level ||
        old.ball.radius !== this.p.ball.radius ||
        old.ball.perGroup !== this.p.ball.perGroup ||
        old.wave.type !== this.p.wave.type ||
        JSON.stringify(old.groups.map((g) => g.name)) !== JSON.stringify(this.p.groups.map((g) => g.name));
      if (structural) {
        this._rebuild();
        this.reset();
      } else {
        // 密度与视觉颜色即时更新
        for (const b of this.balls) {
          const grp = this.p.groups[b.groupIndex];
          b.density = grp.density;
          const vol = (4 / 3) * Math.PI * b.radius * b.radius * b.radius;
          b.mass = vol * b.density * 1000;
          b.mesh.material.color.set(grp.color);
          b.mesh.material.emissive.set(grp.color);
          if (b.ringMat) b.ringMat.color.set(grp.color);
        }
      }
    }

    applyPreset(partial) {
      this.p = deepMerge(DEFAULTS, partial);
      this._rebuild();
      this.reset();
    }

    reset() {
      this.time = 0;
      this.started = false;
      this.ended = false;
      this.waveActive = false;
      this.autoWave = false;
      this.waveT = 0;
      this.waveStartAt = -1;
      this.waveStopAt = -1;
      this.waveStoppedAt = -1;
      this.tLast = -1;
      this.entryCount = 0;
      this.current = 0;
      this.waveEnergy = 0;
      this.paddleDisp = 0;
      this.paddleVel = 0;
      this.paddleReturn = null;
      this.lastPaddleSound = 0;
      this.cameraShake = 0;
      this.fxRand = U.rng(0x9e3779b9);
      if (this.h) {
        this.h.fill(0);
        this.hPrev.fill(0);
        this.u.fill(0);
        this.v.fill(0);
        this.etaV.fill(0);
      }
      if (this.fxGroup) this._clearGroup(this.fxGroup);
      this.fx = [];
      this._buildParticlesPoolReset();
      if (this.waterMesh) this._updateWaterMesh();
      if (this.paddleGroup) {
        if (this.paddleMotion === 'translate') this.paddleGroup.position.x = this.paddleBaseX;
        if (this.paddleMotion === 'rotate' && this.paddleInner) this.paddleInner.rotation.z = 0;
        if (this.paddleMotion === 'vertical') {
          if (this.paddlePlate) this.paddlePlate.position.y = this.level;
          if (this.paddleTrim) this.paddleTrim.position.y = this.level + 0.05;
          if (this.paddleShaft) this.paddleShaft.position.y = this.level + 0.9;
        }
      }
      const positions = this._ballPositions();
      for (let i = 0; i < this.balls.length; i++) {
        const b = this.balls[i];
        const pp = positions[i];
        if (!pp) continue;
        b.x = pp.x; b.y = pp.y; b.z = pp.z;
        b.vx = b.vy = b.vz = 0;
        b.active = false; b.held = true; b.entered = false; b.inWater = false; b.onBottom = false;
        b.releaseAt = 0; b.enteredAt = -1;
        b.ang.set(0, 0, 0); b.angVel.set(0, 0, 0);
        b.group.position.set(b.x, b.y, b.z);
        b.group.rotation.set(0, 0, 0);
        if (b.ring) {
          b.ring.visible = true;
          b.ring.scale.setScalar(1);
          b.ringMat.opacity = 0.5;
          b.ring.position.set(b.x, b.y - b.radius - 0.14, b.z);
        }
        if (b.clamp) b.clamp.visible = true;
      }
      this._buildCables();
      this._updateHolders();
      this._applyCamera();
    }

    releaseBalls(opts) {
      opts = opts || {};
      const positions = this._ballPositions();
      const startDelay = opts.startDelay === undefined ? 0.28 : opts.startDelay;
      this.releaseStart = this.time + startDelay;
      for (let i = 0; i < this.balls.length; i++) {
        const b = this.balls[i];
        const pp = positions[i];
        b.x = pp.x; b.y = pp.y; b.z = pp.z;
        b.vx = b.vy = b.vz = 0;
        b.active = false; b.held = true; b.entered = false; b.inWater = false; b.onBottom = false;
        b.ang.set(0, 0, 0); b.angVel.set(0, 0, 0);
        b.group.position.set(b.x, b.y, b.z);
        b.group.rotation.set(0, 0, 0);
        if (b.ring) {
          b.ring.visible = true; b.ring.scale.setScalar(1); b.ringMat.opacity = 0.5;
          b.ring.position.set(b.x, b.y - b.radius - 0.14, b.z);
        }
        if (b.clamp) b.clamp.visible = true;
        const groupOrder = b.groupIndex;
        const intra = (i % Math.max(2, Math.round(this.p.ball.perGroup))) * 0.045;
        b.releaseAt = this.releaseStart + groupOrder * 0.26 + intra;
      }
      this.started = true;
      this.tLast = -1;
      this.entryCount = 0;
      this.autoWave = !!opts.auto;
      this.waveStartAt = -1;
      this.waveStopAt = -1;
      this.waveStoppedAt = -1;
      this.ended = false;
      this._buildCables();
    }

    startFull() {
      this.reset();
      this.releaseBalls({ auto: true, startDelay: 0.32 });
      this.time = 0;
    }

    startWave(automatic) {
      if (this.waveActive) return;
      this.waveActive = true;
      this.waveT = 0;
      this.waveStoppedAt = -1;
      if (!automatic) this.autoWave = false;
      if (automatic) this.autoWave = true;
      this.waveStopAt = automatic ? (this.time + this.p.wave.duration) : -1;
      if (this.events.onWave) this.events.onWave(true);
    }

    stopWave(automatic) {
      if (!this.waveActive) return;
      this.waveActive = false;
      this.waveStoppedAt = this.time;
      this.paddleReturn = { from: this.paddleDisp, start: this.time };
      this.autoWave = false;
      if (this.events.onWave) this.events.onWave(false);
    }

    exportReset() {
      this.exportMode = true;
      this.orbit.enabled = false;
      this._applyExportCamera();
      // 第一遍：计时到 t_last
      this.reset();
      this.releaseBalls({ auto: true, startDelay: 0.35 });
      this.time = 0;
      let guard = 0;
      while (this.tLast < 0 && guard < 2400) {
        this.time += 1 / 120;
        this._updatePaddle(1 / 120);
        for (const b of this.balls) {
          if (b.held && !b.active && this.time >= b.releaseAt) {
            b.held = false; b.active = true;
          }
        }
        for (let k = 0; k < 2; k++) {
          this._fluidStep(1 / 240);
          this._updateBalls(1 / 240);
        }
        this._autoWaveCheck();
        this._updateHolders();
        guard++;
      }
      const tLast = this.tLast;
      // 第二遍：回到初态
      this.reset();
      this.releaseBalls({ auto: true, startDelay: 0.35 });
      this.time = 0;
      this.exportMode = true;
      this.orbit.enabled = false;
      this._applyExportCamera();
      this._updateWaterMesh();
      this._updateHolders();
      return { tLast: tLast > 0 ? tLast : 2.0 };
    }

    _applyExportCamera() {
      this.orbit.goal.yaw = this.orbit.cur.yaw = 0.26;
      this.orbit.goal.pitch = this.orbit.cur.pitch = 0.29;
      this.orbit.goal.dist = this.orbit.cur.dist = 13.6;
      this.orbit.target.set(0, 1.55, 0);
      this.orbit.home.target.set(0, 1.55, 0);
    }

    /* ==================== 信息接口 ==================== */
    getPhase() {
      if (this.waveActive) return { key: 'wave', label: '造浪' };
      if (!this.started) return { key: 'ready', label: '准备' };
      if (this.tLast < 0) return { key: 'drop', label: '入水' };
      if (this.waveStoppedAt > 0) {
        if (this.ended) return { key: 'settled', label: '稳定' };
        return { key: 'decay', label: '衰减' };
      }
      return { key: 'float', label: '浮沉' };
    }

    getProgress() {
      if (!this.started) return 0;
      if (this.tLast < 0) return U.clamp(this.time / 3.0, 0, 0.15);
      const end = this.tLast + this.p.wave.delay + this.p.wave.duration + 6.0;
      return U.clamp(this.time / end, 0, 1);
    }

    getStatusLine() {
      if (!this.started) return '水槽静置，全部小球悬于水面上方';
      if (this.waveActive) return '造浪装置推动水体，球群持续响应';
      if (this.tLast < 0) return '小球依次入水，激起水面扰动';
      if (this.waveStoppedAt > 0) return '造浪停止，波动衰减，分层逐渐稳定';
      return '等待造浪启动';
    }

    getWaveInfo() {
      const delay = this.p.wave.delay;
      const dur = this.p.wave.duration;
      if (this.waveActive) {
        if (this.autoWave) {
          const elapsed = this.waveT;
          const remain = Math.max(0, dur - elapsed);
          return {
            state: 'active',
            status: `造浪进行中 · 剩余 ${remain.toFixed(1)}s`,
            small: `t_last = ${this.tLast > 0 ? this.tLast.toFixed(2) + 's' : '未触发'} · 振幅 ${this.p.wave.amplitude.toFixed(2)}m · ${this.p.wave.frequency.toFixed(2)}Hz`,
            progress: U.clamp(elapsed / dur, 0, 1),
            count: remain.toFixed(1)
          };
        }
        return {
          state: 'active',
          status: `手动造浪中 · 已持续 ${this.waveT.toFixed(1)}s`,
          small: `点击“停止造浪”结束 · 振幅 ${this.p.wave.amplitude.toFixed(2)}m · ${this.p.wave.frequency.toFixed(2)}Hz`,
          progress: U.clamp(this.waveT / dur, 0, 1),
          count: this.waveT.toFixed(1)
        };
      }
      if (!this.started) {
        return {
          state: 'wait',
          status: '水槽就绪 · 等待释放小球',
          small: `t_last 未触发 · 启动 +${delay.toFixed(1)}s · 持续 ${dur.toFixed(1)}s`,
          progress: 0, count: '--'
        };
      }
      if (this.tLast < 0) {
        const held = this.balls.filter((b) => b.held).length;
        return {
          state: 'wait',
          status: '等待最后一组最后一颗小球入水',
          small: `已入水 ${this.entryCount} 颗 · 待释放 ${held} 颗 · 启动延迟 ${delay.toFixed(1)}s`,
          progress: 0, count: '--'
        };
      }
      if (this.waveStoppedAt > 0) {
        return {
          state: 'stopped',
          status: '造浪结束 · 水体波动衰减中',
          small: `t_last = ${this.tLast.toFixed(2)}s · 停止于 ${this.waveStoppedAt.toFixed(2)}s · 趋于分层`,
          progress: 0, count: '0.0'
        };
      }
      const remain = Math.max(0, this.waveStartAt - this.time);
      const p = this.waveStartAt > 0 ? 1 - remain / Math.max(0.01, delay) : 0;
      return {
        state: 'wait',
        status: `入水完成 · ${remain.toFixed(1)}s 后启动造浪`,
        small: `t_last = ${this.tLast.toFixed(2)}s · 启动于 ${this.waveStartAt.toFixed(2)}s · 持续 ${dur.toFixed(1)}s`,
        progress: U.clamp(p, 0, 1),
        count: remain.toFixed(1)
      };
    }

    getDensityGroups() {
      const per = Math.round(this.p.ball.perGroup);
      return this.p.groups.map((g) => ({
        name: g.name,
        density: g.density,
        color: g.color,
        count: per
      }));
    }

    getBallCount() {
      return this.balls.length;
    }

    setActive(on) {
      this.orbit.enabled = on && !this.exportMode;
    }

    resize(w, h) {
      if (this.camera) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
    }

    render(dt) {
      this.orbit.update(dt || 0.016);
      if (!this.exportMode && this.cameraShake > 0.0005) {
        const t = performance.now() * 0.001;
        this.camera.position.x += Math.sin(t * 53) * this.cameraShake;
        this.camera.position.y += Math.sin(t * 67 + 1.2) * this.cameraShake * 0.5;
      }
      if (this.waterMaterial && this.waterMaterial.uniforms.uCam) {
        this.waterMaterial.uniforms.uCam.value.copy(this.camera.position);
      }
      // 更新粒子像素比例（随分辨率保持相对大小）
      if (this.particles) {
        const pr = this.renderer.getPixelRatio ? this.renderer.getPixelRatio() : 1;
        const db = new THREE.Vector2();
        this.renderer.getDrawingBufferSize(db);
        this.particles.mat.uniforms.uPixelRatio.value = pr;
        this.particles.mat.uniforms.uScale.value = 1250 * (db.y / 1080) / Math.max(0.5, pr);
      }
      this.renderer.render(this.scene, this.camera);
    }
  }

  TankScene.DEFAULTS = DEFAULTS;
  window.TankScene = TankScene;
})();
