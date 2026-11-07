/* ============================================================
   场景一：重球冲击果冻台
   - 晶格 PBD 软体（结构 / 剪切 / 弯曲约束）
   - 半球—变形表面弹簧接触，双向作用
   - FFD 变形网格 + 透射材质
   ============================================================ */
(function () {
  'use strict';

  const E = 0.5;            // 超椭球指数（圆角方块的圆润程度）
  const M = 2 / E;          // 隐式曲面指数
  const BASE_W = 2.7;
  const BASE_H = 1.45;
  const BASE_D = 2.1;
  const NX = 9, NY = 7, NZ = 9;
  const DT = 1 / 120;
  const SUBSTEPS = 2;

  const THEMES = {
    mint: { color: 0x19d6b2, atten: 0x043f37, rim: 0x63fff0, glow: 0x54ffdd },
    berry: { color: 0xff6aa9, atten: 0x5c0d31, rim: 0xffa0cd, glow: 0xff7fc0 },
    amber: { color: 0xffbb55, atten: 0x633304, rim: 0xffd79a, glow: 0xffc166 }
  };

  const DEFAULTS = {
    mode: 'center',
    jelly: { scale: 1, softness: 0.55, damping: 0.22, density: 1.0, fixed: true, color: 'mint' },
    ball: { mass: 22, radius: 0.42, height: 1.8, count: 3, interval: 0.85 },
    env: { gravity: 9.8, friction: 0.55, restitution: 0.22, repeat: false }
  };

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

  class JellyScene {
    constructor(renderer, envTex, events) {
      this.renderer = renderer;
      this.events = events || {};
      this.p = deepMerge(DEFAULTS, null);
      this.a = BASE_W / 2;
      this.b = BASE_H / 2;
      this.c = BASE_D / 2;
      this.centerY = this.b;

      this.time = 0;
      this.started = false;
      this.ended = false;
      this.startAt = 0;
      this.startDelay = 0.25;
      this.lastImpactAt = -10;
      this.firstImpactAt = -10;
      this.contactCount = 0;
      this.settleTimer = 0;
      this.impactEnergy = 0;
      this.shake = 0;
      this.repeatCount = 0;
      this.autoSoundTimer = 0;
      this.exportMode = false;
      this.exportTime = 0;
      this.tune = { k: 900, kSoft: 1600, zeta: 0.5, dent: 1.0 };
      this.wob = { sq: 0, sqv: 0, sway: 0, swayv: 0, bend: 0, bendv: 0, twist: 0, twistv: 0, lean: 0, leanv: 0 };
      this._lastModeX = 0;

      this._buildScene(envTex);
      this._buildBody();
      this._buildBalls();
      this.reset();
    }

    /* =================== 场景骨架 =================== */
    _buildScene(envTex) {
      const s = this.scene = new THREE.Scene();
      s.background = U.makeBackdropTexture(false);
      s.fog = new THREE.FogExp2(0x040a0d, 0.036);

      this.camera = new THREE.PerspectiveCamera(43, 1, 0.1, 80);
      this.orbit = new U.OrbitCam(this.camera, this.renderer.domElement, {
        target: new THREE.Vector3(0, 1.42, 0),
        yaw: 0.1,
        pitch: 0.23,
        dist: 7.9,
        minPitch: 0.03,
        maxPitch: 0.9,
        minDist: 3.6,
        maxDist: 12
      });

      // 灯光
      const hemi = new THREE.HemisphereLight(0x9be0e4, 0x0b1518, 0.5);
      s.add(hemi);

      const key = new THREE.DirectionalLight(0xfff0d8, 0.95);
      key.position.set(4.5, 8.0, 5.4);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -6.5;
      key.shadow.camera.right = 6.5;
      key.shadow.camera.top = 8;
      key.shadow.camera.bottom = -3.5;
      key.shadow.camera.near = 0.5;
      key.shadow.camera.far = 26;
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.025;
      s.add(key);
      this.keyLight = key;

      const rim = new THREE.SpotLight(0x67f7e6, 2.0, 28, 0.68, 0.85, 1.4);
      rim.position.set(-5.2, 4.2, -3.4);
      rim.target.position.set(0, 1.1, 0);
      s.add(rim, rim.target);
      this.rimLight = rim;

      const fill = new THREE.SpotLight(0xffd9c2, 0.12, 26, 0.7, 1.0, 1.3);
      fill.position.set(3.6, 3.4, 7.2);
      fill.target.position.set(0, 0.9, 0);
      s.add(fill, fill.target);

      const back = new THREE.SpotLight(0x9ff8ff, 0.7, 30, 0.55, 0.9, 1.2);
      back.position.set(1.0, 3.2, -8.5);
      back.target.position.set(0, 1.2, 0);
      s.add(back, back.target);

      const pink = new THREE.PointLight(0xff5e9e, 0.8, 11, 1.8);
      pink.position.set(4.2, 1.2, -2.4);
      s.add(pink);

      const under = new THREE.PointLight(0x53ffe4, 0.55, 7, 2.0);
      under.position.set(-2.8, 0.6, 3.0);
      s.add(under);

      // 平台
      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(4.8, 5.1, 0.26, 96, 1),
        new THREE.MeshStandardMaterial({
          color: 0x0a1519, metalness: 0.82, roughness: 0.3, envMapIntensity: 1.0
        })
      );
      platform.position.y = -0.13;
      platform.receiveShadow = true;
      s.add(platform);

      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(3.86, 3.9, 0.035, 96, 1),
        new THREE.MeshStandardMaterial({
          color: 0x0d1d22, metalness: 0.9, roughness: 0.22, envMapIntensity: 1.1
        })
      );
      plate.position.y = 0.005;
      plate.receiveShadow = true;
      s.add(plate);

      // 平台上的发光环与刻度
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x57efd2, transparent: true, opacity: 0.33,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.84, 3.87, 128), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.026;
      s.add(ring);

      const ring2mat = ringMat.clone();
      ring2mat.opacity = 0.11;
      const ring2 = new THREE.Mesh(new THREE.RingGeometry(2.55, 2.575, 128), ring2mat);
      ring2.rotation.x = -Math.PI / 2;
      ring2.position.y = 0.027;
      s.add(ring2);

      const tickMat = new THREE.MeshBasicMaterial({
        color: 0x4fcfc0, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      for (let i = 0; i < 72; i++) {
        const ang = (i / 72) * Math.PI * 2;
        const len = i % 6 === 0 ? 0.18 : 0.07;
        const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.012, len), tickMat);
        tick.rotation.x = -Math.PI / 2;
        tick.rotation.z = -ang;
        tick.position.set(Math.cos(ang) * 3.76, 0.028, Math.sin(ang) * 3.76);
        s.add(tick);
      }

      // 中央地光
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: U.glowTexture(),
        color: 0x2f9f95,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      glow.scale.set(7.5, 7.5, 1);
      glow.position.set(0, 0.09, 0);
      s.add(glow);
      this.floorGlow = glow;

      // 果冻接触阴影
      this.jellyShadow = U.contactShadow(5.1, 4.2, 0.62);
      this.jellyShadow.position.y = 0.031;
      s.add(this.jellyShadow);

      // 背景柔光与灯条：为透明体和金属球提供可读的反射层次
      const glowTex = U.glowTexture();
      const addBackGlow = (color, sx, sy, x, y, z, op) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, color, transparent: true, opacity: op,
          blending: THREE.AdditiveBlending, depthWrite: false
        }));
        sp.scale.set(sx, sy, 1);
        sp.position.set(x, y, z);
        s.add(sp);
      };
      addBackGlow(0x1e8f86, 12, 7.2, 0, 2.0, -7.8, 0.18);
      addBackGlow(0xff8f62, 5.2, 4.0, 5.4, 1.5, -6.8, 0.1);
      addBackGlow(0xff5f9f, 5.0, 4.4, -5.6, 2.1, -6.6, 0.07);
      addBackGlow(0x81f8ff, 6.5, 3.4, 0.4, 4.1, -7.2, 0.12);

      const stripGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0x9ff8ee, transparent: true, opacity: 0.15,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      stripGlow.scale.set(9.5, 0.75, 1);
      stripGlow.position.set(0, 3.4, -7.05);
      s.add(stripGlow);

      // 地面浮尘
      this._buildDust();

      // 场景主体容器
      this.jellyGroup = new THREE.Group();
      this.jellyGroup.position.set(0, this.centerY, 0);
      s.add(this.jellyGroup);

      this.ballGroup = new THREE.Group();
      s.add(this.ballGroup);

      this.fxGroup = new THREE.Group();
      s.add(this.fxGroup);
      this.hoverGroup = new THREE.Group();
      s.add(this.hoverGroup);

      // 环境反射
      s.environment = envTex;
    }

    _buildDust() {
      const count = 90;
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const rand = U.rng(9173);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (rand() - 0.5) * 10;
        pos[i * 3 + 1] = rand() * 5.2;
        pos[i * 3 + 2] = (rand() - 0.5) * 8 - 1;
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.dustInitial = pos.slice();
      const mat = new THREE.PointsMaterial({
        map: U.glowTexture(),
        color: 0x9ff5e3,
        size: 0.028,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });
      this.dust = new THREE.Points(g, mat);
      this.scene.add(this.dust);
    }

    /* =================== 果冻几何与晶格 =================== */
    _buildBody() {
      if (this.jellyMesh) {
        this.jellyGroup.remove(this.jellyMesh);
        this.jellyMesh.geometry.dispose();
        this.jellyMesh.material.dispose();
      }
      if (this.bubbleGroup) {
        this.jellyGroup.remove(this.bubbleGroup);
      }

      const scale = this.p.jelly.scale;
      this.a = (BASE_W / 2) * scale;
      this.b = (BASE_H / 2) * scale;
      this.c = (BASE_D / 2) * scale;
      this.centerY = this.b;
      this.jellyGroup.position.set(0, this.centerY, 0);

      this._buildLattice();
      this._buildJellyGeometry();
      this._buildBubbles();

      this.jellyShadow.scale.set(1.0 * scale, 0.82 * scale, 1);
      this.jellyShadow.position.y = 0.031;
    }

    _buildLattice() {
      const n = NX * NY * NZ;
      this.nP = n;
      this.rest = new Float32Array(n * 3);
      this.pos = new Float32Array(n * 3);
      this.prev = new Float32Array(n * 3);
      this.vel = new Float32Array(n * 3);
      this.inv = new Float32Array(n);
      this.disp = new Float32Array(n * 3);

      const jellyMass = 34 * this.p.jelly.density;
      this.nodeMass = jellyMass / n;

      let idx = 0;
      for (let k = 0; k < NZ; k++) {
        for (let j = 0; j < NY; j++) {
          for (let i = 0; i < NX; i++) {
            const x = -this.a + (i / (NX - 1)) * 2 * this.a;
            const y = -this.b + (j / (NY - 1)) * 2 * this.b;
            const z = -this.c + (k / (NZ - 1)) * 2 * this.c;
            this.rest[idx * 3] = x;
            this.rest[idx * 3 + 1] = y;
            this.rest[idx * 3 + 2] = z;
            this.inv[idx] = this.p.jelly.fixed && j === 0 ? 0 : 1 / this.nodeMass;
            idx++;
          }
        }
      }

      // 约束构建
      const A = [], B = [], L = [], S = [];
      const add = (ia, ib, stiff) => {
        const ax = this.rest[ia * 3], ay = this.rest[ia * 3 + 1], az = this.rest[ia * 3 + 2];
        const bx = this.rest[ib * 3], by = this.rest[ib * 3 + 1], bz = this.rest[ib * 3 + 2];
        const d = Math.hypot(bx - ax, by - ay, bz - az);
        if (d > 1e-6) { A.push(ia); B.push(ib); L.push(d); S.push(stiff); }
      };
      const pi = (i, j, k) => (k * NY + j) * NX + i;

      for (let k = 0; k < NZ; k++) {
        for (let j = 0; j < NY; j++) {
          for (let i = 0; i < NX; i++) {
            const p = pi(i, j, k);
            if (i < NX - 1) add(p, pi(i + 1, j, k), 1.0);
            if (j < NY - 1) add(p, pi(i, j + 1, k), 1.0);
            if (k < NZ - 1) add(p, pi(i, j, k + 1), 1.0);

            // 剪切
            if (i < NX - 1 && j < NY - 1) {
              add(p, pi(i + 1, j + 1, k), 0.55);
              add(pi(i + 1, j, k), pi(i, j + 1, k), 0.55);
            }
            if (j < NY - 1 && k < NZ - 1) {
              add(p, pi(i, j + 1, k + 1), 0.55);
              add(pi(i, j + 1, k), pi(i, j, k + 1), 0.55);
            }
            if (i < NX - 1 && k < NZ - 1) {
              add(p, pi(i + 1, j, k + 1), 0.55);
              add(pi(i + 1, j, k), pi(i, j, k + 1), 0.55);
            }
            // 体对角线
            if (i < NX - 1 && j < NY - 1 && k < NZ - 1) {
              add(p, pi(i + 1, j + 1, k + 1), 0.16);
            }
            // 弯曲（隔点）
            if (i < NX - 2) add(p, pi(i + 2, j, k), 0.16);
            if (j < NY - 2) add(p, pi(i, j + 2, k), 0.16);
            if (k < NZ - 2) add(p, pi(i, j, k + 2), 0.16);
          }
        }
      }
      this.cA = new Int32Array(A);
      this.cB = new Int32Array(B);
      this.cL = new Float32Array(L);
      this.cS = new Float32Array(S);

      // 顶部 / 侧面 索引
      this.topBase = (NY - 1) * NX;
      this.topIds = [];
      for (let k = 0; k < NZ; k++) {
        for (let i = 0; i < NX; i++) {
          this.topIds.push(pi(i, NY - 1, k));
        }
      }
    }

    _buildJellyGeometry() {
      const uSeg = 100;
      const vSeg = 58;
      const verts = [];
      const indices = [];
      const grid = [];
      for (let iv = 0; iv <= vSeg; iv++) {
        const v = -Math.PI / 2 + (iv / vSeg) * Math.PI;
        const cv = Math.cos(v);
        const sv = Math.sin(v);
        const cvp = Math.pow(Math.abs(cv), E);
        const svp = Math.pow(Math.abs(sv), E);
        const row = [];
        for (let iu = 0; iu < uSeg; iu++) {
          const u = (iu / uSeg) * Math.PI * 2;
          const cu = Math.cos(u);
          const su = Math.sin(u);
          const cup = Math.pow(Math.abs(cu), E) * Math.sign(cu);
          const sup = Math.pow(Math.abs(su), E) * Math.sign(su);
          const x = this.a * cvp * cup;
          const y = this.b * svp * (sv >= 0 ? 1 : -1);
          const z = this.c * cvp * sup;
          row.push(verts.length / 3);
          verts.push(x, y, z);
        }
        grid.push(row);
      }
      for (let iv = 0; iv < vSeg; iv++) {
        for (let iu = 0; iu < uSeg; iu++) {
          const ni = (iu + 1) % uSeg;
          const a = grid[iv][iu], b = grid[iv][ni];
          const c = grid[iv + 1][iu], d = grid[iv + 1][ni];
          if (iv === 0) {
            indices.push(a, c, d);
          } else if (iv === vSeg - 1) {
            indices.push(a, c, b);
          } else {
            indices.push(a, c, b);
            indices.push(c, d, b);
          }
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
      geo.setIndex(indices);

      // 自动修正面向：以隐式曲面梯度作为外部方向
      const pos = geo.attributes.position;
      const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
      const ab = new THREE.Vector3(), ac = new THREE.Vector3(), fn = new THREE.Vector3();
      let score = 0;
      const idx = geo.index.array;
      for (let t = 0; t < idx.length; t += 3 * 7) {
        va.fromBufferAttribute(pos, idx[t]);
        vb.fromBufferAttribute(pos, idx[t + 1]);
        vc.fromBufferAttribute(pos, idx[t + 2]);
        ab.subVectors(vb, va); ac.subVectors(vc, va);
        fn.crossVectors(ab, ac);
        const mx = (va.x + vb.x + vc.x) / 3, my = (va.y + vb.y + vc.y) / 3, mz = (va.z + vb.z + vc.z) / 3;
        const nx = Math.sign(mx) * Math.pow(Math.abs(mx) / this.a, M - 1) / this.a;
        const ny = Math.sign(my) * Math.pow(Math.abs(my) / this.b, M - 1) / this.b;
        const nz = Math.sign(mz) * Math.pow(Math.abs(mz) / this.c, M - 1) / this.c;
        score += fn.x * nx + fn.y * ny + fn.z * nz;
      }
      if (score < 0) {
        for (let t = 0; t < idx.length; t += 3) {
          const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp;
        }
        geo.index.needsUpdate = true;
      }
      geo.computeVertexNormals();

      this.geo = geo;
      this.vCount = pos.count;
      this.vRest = new Float32Array(pos.array);
      this.vPids = new Int32Array(this.vCount * 8);
      this.vW = new Float32Array(this.vCount * 8);

      // 预计算 FFD 三线性权重
      const pi = (i, j, k) => (k * NY + j) * NX + i;
      for (let vi = 0; vi < this.vCount; vi++) {
        const x = this.vRest[vi * 3], y = this.vRest[vi * 3 + 1], z = this.vRest[vi * 3 + 2];
        const u = U.clamp((x + this.a) / (2 * this.a), 0, 0.99999) * (NX - 1);
        const v = U.clamp((y + this.b) / (2 * this.b), 0, 0.99999) * (NY - 1);
        const w = U.clamp((z + this.c) / (2 * this.c), 0, 0.99999) * (NZ - 1);
        const i0 = Math.floor(u), j0 = Math.floor(v), k0 = Math.floor(w);
        const fu = u - i0, fv = v - j0, fw = w - k0;
        const i1 = Math.min(i0 + 1, NX - 1), j1 = Math.min(j0 + 1, NY - 1), k1 = Math.min(k0 + 1, NZ - 1);
        const ws = [
          (1 - fu) * (1 - fv) * (1 - fw), fu * (1 - fv) * (1 - fw),
          (1 - fu) * fv * (1 - fw), fu * fv * (1 - fw),
          (1 - fu) * (1 - fv) * fw, fu * (1 - fv) * fw,
          (1 - fu) * fv * fw, fu * fv * fw
        ];
        const ids = [
          pi(i0, j0, k0), pi(i1, j0, k0), pi(i0, j1, k0), pi(i1, j1, k0),
          pi(i0, j0, k1), pi(i1, j0, k1), pi(i0, j1, k1), pi(i1, j1, k1)
        ];
        for (let q = 0; q < 8; q++) {
          this.vPids[vi * 8 + q] = ids[q];
          this.vW[vi * 8 + q] = ws[q];
        }
      }

      const theme = THEMES[this.p.jelly.color] || THEMES.mint;
      const mat = new THREE.MeshPhysicalMaterial({
        color: theme.color,
        roughness: 0.2,
        metalness: 0.0,
        transmission: 0.7,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        thickness: 0.35 * this.p.jelly.scale,
        ior: 1.34,
        clearcoat: 0.12,
        clearcoatRoughness: 0.4,
        attenuationColor: new THREE.Color(theme.atten),
        attenuationDistance: 0.7,
        envMapIntensity: 0.55,
        sheen: 0.12,
        sheenColor: new THREE.Color(theme.rim),
        sheenRoughness: 0.5
      });
      mat.receiveShadow = true;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      this.jellyMesh = mesh;
      this.jellyMaterial = mat;
      this.jellyGroup.add(mesh);

      // 内部气泡：让透射体有可读的内部层次
      const bubbleGroup = new THREE.Group();
      const bmat = new THREE.MeshBasicMaterial({
        color: theme.rim,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const bgeo = new THREE.IcosahedronGeometry(1, 1);
      const rand = U.rng(4411);
      this.bubbles = [];
      for (let i = 0; i < 22; i++) {
        const bx = (rand() * 2 - 1) * this.a * 0.74;
        const by = (rand() * 2 - 1) * this.b * 0.7;
        const bz = (rand() * 2 - 1) * this.c * 0.74;
        const r = 0.012 + rand() * 0.033 * this.p.jelly.scale;
        const m = new THREE.Mesh(bgeo, bmat);
        m.scale.setScalar(r);
        m.frustumCulled = false;
        m.renderOrder = 4;
        bubbleGroup.add(m);
        this.bubbles.push({ mesh: m, x: bx, y: by, z: bz, r });
      }
      // 内部柔光核（体积感）
      this.coreGlow = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 16),
        new THREE.MeshBasicMaterial({
          color: theme.glow, transparent: true, opacity: 0.028,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      this.coreGlow.scale.set(this.a * 0.82, this.b * 0.62, this.c * 0.82);
      this.coreGlow.renderOrder = 2;
      bubbleGroup.add(this.coreGlow);
      this.bubbleGroup = bubbleGroup;
      this.bubbleMaterial = bmat;
      this.jellyGroup.add(bubbleGroup);
    }

    _buildBubbles() { /* 气泡在几何构建中一并创建 */ }

    _buildBalls() {
      if (this.ballMeshes) {
        for (const b of this.ballMeshes) this.ballGroup.remove(b.group);
      }
      this.ballMeshes = [];
      this.balls = [];
      while (this.hoverGroup.children.length) {
        const ch = this.hoverGroup.children[this.hoverGroup.children.length - 1];
        this.hoverGroup.remove(ch);
        if (ch.geometry) ch.geometry.dispose();
        if (ch.material) ch.material.dispose();
      }
      const count = this.p.mode === 'multi' ? U.clamp(Math.round(this.p.ball.count), 2, 5) : 1;
      const theme = THEMES[this.p.jelly.color] || THEMES.mint;
      const r = this.p.ball.radius;
      const metal = new THREE.MeshStandardMaterial({
        color: 0xbfcfd3,
        metalness: 0.86,
        roughness: 0.2,
        envMapIntensity: 1.5
      });
      const grooveMat = new THREE.MeshStandardMaterial({
        color: 0x77858a,
        metalness: 0.9,
        roughness: 0.34,
        envMapIntensity: 1.1
      });
      const posList = this._ballPositions();
      for (let i = 0; i < count; i++) {
        const group = new THREE.Group();
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 36), metal);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // 赤道与纬度压线，增强旋转可读性
        for (const sy of [0, 0.48, -0.48]) {
          const rr = Math.sqrt(Math.max(0.02, 1 - sy * sy)) * r * 1.001;
          const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, r * 0.012, 6, 72), grooveMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = sy * r;
          group.add(ring);
        }
        // 小标记点
        const dot = new THREE.Mesh(new THREE.SphereGeometry(r * 0.055, 12, 8),
          new THREE.MeshStandardMaterial({ color: theme.glow, metalness: 0.2, roughness: 0.35, emissive: theme.glow, emissiveIntensity: 0.6 }));
        dot.position.set(r * 0.72, r * 0.56, r * 0.4);
        group.add(dot);

        const hover = this.centerY + this.b + this.p.ball.height + r;
        this.ballGroup.add(group);

        // 悬浮释放环
        const ringMat = new THREE.MeshBasicMaterial({
          color: theme.glow, transparent: true, opacity: 0.55,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        const hring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.35, 0.008, 6, 64), ringMat);
        hring.rotation.x = Math.PI / 2;
        hring.position.set(posList[i].x, hover - r - 0.16, posList[i].z);
        this.hoverGroup.add(hring);

        this.balls.push({
          group, mesh, x: posList[i].x, z: posList[i].z,
          hover, y: hover, vy: 0, vx: 0, vz: 0,
          speed: 0, active: false, released: false, inContact: false,
          contactSound: 0, landed: false, radius: r, mass: this.p.ball.mass, pen: 0,
          angVel: new THREE.Vector3(), ang: new THREE.Vector3(),
          hring, hringMat: ringMat, hoverPhase: i * 1.7,
          dropIndex: i
        });
        this.ballMeshes.push({ group });
      }
      this._syncBallMeshes(0);
    }

    _ballPositions() {
      const a = this.a, c = this.c;
      if (this.p.mode === 'offset') {
        return [{ x: -a * 0.68, z: c * 0.04 }];
      }
      if (this.p.mode === 'multi') {
        const base = [
          { x: 0, z: 0 },
          { x: -a * 0.36, z: -c * 0.18 },
          { x: a * 0.34, z: c * 0.16 },
          { x: -a * 0.12, z: c * 0.34 },
          { x: a * 0.16, z: -c * 0.32 }
        ];
        return base;
      }
      return [{ x: 0, z: 0 }];
    }

    /* =================== 生命周期 =================== */
    configure(partial) {
      const old = this.p;
      this.p = deepMerge(this.p, partial);
      const structural = !old || old.jelly.scale !== this.p.jelly.scale ||
        old.jelly.color !== this.p.jelly.color ||
        old.ball.radius !== this.p.ball.radius ||
        old.mode !== this.p.mode ||
        old.ball.count !== this.p.ball.count ||
        old.jelly.fixed !== this.p.jelly.fixed;
      if (structural) {
        this._buildBody();
        this._buildBalls();
      } else {
        const oldNodeMass = this.nodeMass;
        this.nodeMass = (34 * this.p.jelly.density) / this.nP;
        this.balls.forEach((b) => { b.mass = this.p.ball.mass; });
        if (oldNodeMass !== this.nodeMass) {
          for (let i = 0; i < this.nP; i++) {
            const pinned = this.p.jelly.fixed && Math.abs(this.rest[i * 3 + 1] + this.b) < 1e-6;
            this.inv[i] = pinned ? 0 : 1 / this.nodeMass;
          }
        }
      }
      this._applyModeCamera();
      this.reset();
    }

    applyPreset(partial) {
      this.p = deepMerge(DEFAULTS, partial);
      this._buildBody();
      this._buildBalls();
      this._applyModeCamera();
      this.reset();
    }

    setMode(mode) {
      if (this.p.mode === mode) return;
      this.p.mode = mode;
      this._buildBody();
      this._buildBalls();
      this._applyModeCamera();
      this.reset();
    }

    _applyModeCamera() {
      const base = this.p.mode === 'multi' ? 8.5 : (this.p.mode === 'offset' ? 7.7 : 7.9);
      const view = { target: new THREE.Vector3(0, 1.42, 0), yaw: 0.1, pitch: 0.23, dist: this._fitDist(base) };
      if (this.p.mode === 'multi') {
        view.target.set(0, 1.45, 0);
        view.pitch = 0.25;
      } else if (this.p.mode === 'offset') {
        view.yaw = 0.05;
      }
      this.orbit.home.yaw = this.orbit.goal.yaw = view.yaw;
      this.orbit.home.pitch = this.orbit.goal.pitch = view.pitch;
      this.orbit.home.dist = this.orbit.goal.dist = view.dist;
      this.orbit.target.copy(view.target);
      this.orbit.home.target.copy(view.target);
      this.orbit.cur.yaw = view.yaw;
      this.orbit.cur.pitch = view.pitch;
      this.orbit.cur.dist = view.dist;
    }

    _fitDist(base) {
      const ballTop = this.centerY + this.b + this.p.ball.height + this.p.ball.radius;
      const half = Math.max(2.6, ballTop - 1.42 + 0.55);
      const d = half / Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
      return U.clamp(Math.max(base, d), 7.4, 11.5);
    }

    reset() {
      this.time = 0;
      this.started = false;
      this.ended = false;
      this.startAt = 0;
      this.lastImpactAt = -10;
      this.firstImpactAt = -10;
      this.contactCount = 0;
      this.settleTimer = 0;
      this.repeatCount = 0;
      this.shake = 0;
      this.autoSoundTimer = 0;
      this.wob = { sq: 0, sqv: 0, sway: 0, swayv: 0, bend: 0, bendv: 0, twist: 0, twistv: 0, lean: 0, leanv: 0 };
      this._lastModeX = 0;
      if (this.dustInitial && this.dust) {
        this.dust.geometry.attributes.position.array.set(this.dustInitial);
        this.dust.geometry.attributes.position.needsUpdate = true;
      }
      this._clearFx();

      for (let i = 0; i < this.nP; i++) {
        this.pos[i * 3] = this.rest[i * 3];
        this.pos[i * 3 + 1] = this.rest[i * 3 + 1];
        this.pos[i * 3 + 2] = this.rest[i * 3 + 2];
        this.prev[i * 3] = this.rest[i * 3];
        this.prev[i * 3 + 1] = this.rest[i * 3 + 1];
        this.prev[i * 3 + 2] = this.rest[i * 3 + 2];
        this.vel[i * 3] = this.vel[i * 3 + 1] = this.vel[i * 3 + 2] = 0;
        if (this.p.jelly.fixed && Math.abs(this.rest[i * 3 + 1] + this.b) < 1e-6) {
          this.inv[i] = 0;
        } else {
          this.inv[i] = 1 / this.nodeMass;
        }
      }
      // 让自由放置的果冻稳定落座
      if (!this.p.jelly.fixed) {
        for (let s = 0; s < 100; s++) this._substep(1 / 120 / 2, true);
        for (let i = 0; i < this.nP; i++) {
          this.prev[i * 3] = this.pos[i * 3];
          this.prev[i * 3 + 1] = this.pos[i * 3 + 1];
          this.prev[i * 3 + 2] = this.pos[i * 3 + 2];
          this.vel[i * 3] = this.vel[i * 3 + 1] = this.vel[i * 3 + 2] = 0;
        }
      }

      for (const b of this.balls) {
        b.x = 0; // 重置位置在 _buildBalls 定的初始位置重新读取
      }
      this._resetBallPositions();
      this._updateMesh();
      this._updateBubbles();
      this._applyModeCamera();
    }

    _resetBallPositions() {
      const list = this._ballPositions();
      this.balls.forEach((b, i) => {
        const pp = list[i % list.length];
        b.x = pp.x;
        b.z = pp.z;
        b.hover = this.centerY + this.b + this.p.ball.height + b.radius;
        b.y = b.hover;
        b.vx = b.vy = b.vz = 0;
        b.speed = 0;
        b.active = false;
        b.released = false;
        b.inContact = false;
        b.landed = false;
        b.contactSound = 0;
        b.pen = 0;
        b.ang.set(0, 0, 0);
        b.angVel.set(0, 0, 0);
        if (b.hring) {
          b.hring.visible = true;
          b.hring.position.set(b.x, b.y - b.radius - 0.16, b.z);
          b.hring.scale.setScalar(1);
          b.hringMat.opacity = 0.5;
        }
        if (b.group) {
          b.group.position.set(b.x, b.y, b.z);
          b.group.rotation.set(0, 0, 0);
          b.group.visible = true;
        }
      });
    }

    trigger(delay) {
      if (this.started) this.reset();
      this.started = true;
      this.ended = false;
      this.startDelay = delay === undefined ? 0.25 : delay;
      this.startAt = this.time + this.startDelay;
      this.repeatCount = 0;
      if (this.events.onJelly) this.events.onJelly(0.18);
    }

    /** 导出：回到初始，使用演示镜头，准备计时 */
    exportReset() {
      this.exportMode = true;
      this.reset();
      this.orbit.enabled = false;
      this.orbit.goal.yaw = this.orbit.cur.yaw = 0.08;
      this.orbit.goal.pitch = this.orbit.cur.pitch = 0.225;
      const base = this.p.mode === 'multi' ? 8.5 : (this.p.mode === 'offset' ? 7.7 : 7.9);
      this.orbit.goal.dist = this.orbit.cur.dist = this._fitDist(base) + 0.1;
      this.orbit.target.set(0, 1.42, 0);
      this.orbit.home.target.set(0, 1.42, 0);
      if (this.p.mode === 'multi') {
        this.orbit.goal.dist = this.orbit.cur.dist = this._fitDist(8.5) + 0.1;
        this.orbit.target.set(0, 1.45, 0);
        this.orbit.home.target.set(0, 1.45, 0);
      } else if (this.p.mode === 'offset') {
        this.orbit.goal.dist = this.orbit.cur.dist = this._fitDist(7.7) + 0.1;
      }
    }

    /* =================== 模拟 =================== */
    step(dt) {
      const n = Math.max(1, Math.round(dt / (DT / SUBSTEPS)));
      const h = dt / n;
      for (let i = 0; i < n; i++) this._substep(h, false);
      this.time += dt;

      if (this.started && !this.ended) {
        const since = this.time - this.firstImpactAt;
        if (this.contactCount === 0 && this.time > this.startAt + 0.6) {
          // 尚未接触，正常下落
        }
        if (since > 1.8) {
          const calm = this._isCalm();
          if (calm) this.settleTimer += dt;
          else this.settleTimer = Math.max(0, this.settleTimer - dt * 0.8);
          if (this.settleTimer > 1.1) this.ended = true;
        }
        // 连击参数：自动重新释放
        if (this.p.env.repeat && this.contactCount > 0 && this.time - this.lastImpactAt > 3.0 && this.repeatCount < 2) {
          this.repeatCount++;
          this._resetBallPositions();
          this.started = true;
          this.startAt = this.time + 0.25;
          this.contactCount = 0;
          this.settleTimer = 0;
          this.ended = false;
          this.firstImpactAt = this.time;
          this.shake = 0.05;
        }
      }
      this._updateVisuals(dt);
      this._updateMesh();
      this._updateBubbles();
    }

    _substep(h, quiet) {
      const g = this.p.env.gravity;
      const p = this.pos, v = this.vel, prev = this.prev, inv = this.inv;
      const nP = this.nP;
      const dampF = Math.exp(-this.p.jelly.damping * 2.6 * h);

      this._integrateWobble(h);

      // 重球接触力（在积分前估计）
      if (!quiet) {
        for (const b of this.balls) {
          if (!b.active) continue;
          this._ballContact(b, h);
        }
      }

      // 粒子积分
      for (let i = 0; i < nP; i++) {
        const i3 = i * 3;
        prev[i3] = p[i3]; prev[i3 + 1] = p[i3 + 1]; prev[i3 + 2] = p[i3 + 2];
        if (inv[i] === 0) continue;
        v[i3 + 1] -= g * h;
        v[i3] *= dampF; v[i3 + 1] *= dampF; v[i3 + 2] *= dampF;
        p[i3] += v[i3] * h;
        p[i3 + 1] += v[i3 + 1] * h;
        p[i3 + 2] += v[i3 + 2] * h;
      }

      // 重球积分
      if (!quiet) {
        for (const b of this.balls) {
          if (!b.active) continue;
          b.vy -= g * h;
          const ad = Math.exp(-0.03 * h);
          b.vx *= ad; b.vy *= ad; b.vz *= ad;
          b.x += b.vx * h;
          b.y += b.vy * h;
          b.z += b.vz * h;
          b.speed = Math.hypot(b.vx, b.vy, b.vz);
          this._ballGround(b, h);
        }
        this._ballBallCollisions(h);
      }

      // 距离约束
      const iters = 3 + Math.round((1 - this.p.jelly.softness) * 3);
      const stiffScale = 0.45 + (1 - this.p.jelly.softness) * 0.3;
      for (let it = 0; it < iters; it++) {
        this._solveConstraints(h, stiffScale);
        if (!this.p.jelly.fixed) this._groundParticles(h);
      }
      this._shapeRestore();
      this._applyDents(h);

      // 速度回写
      for (let i = 0; i < nP; i++) {
        const i3 = i * 3;
        if (inv[i] === 0) {
          v[i3] = v[i3 + 1] = v[i3 + 2] = 0;
          p[i3] = this.rest[i3]; p[i3 + 1] = this.rest[i3 + 1]; p[i3 + 2] = this.rest[i3 + 2];
          continue;
        }
        v[i3] = (p[i3] - prev[i3]) / h;
        v[i3 + 1] = (p[i3 + 1] - prev[i3 + 1]) / h;
        v[i3 + 2] = (p[i3 + 2] - prev[i3 + 2]) / h;
        // 限制异常速度
        const sp = Math.hypot(v[i3], v[i3 + 1], v[i3 + 2]);
        if (sp > 22) {
          const k = 22 / sp;
          v[i3] *= k; v[i3 + 1] *= k; v[i3 + 2] *= k;
        }
      }

      // 球的旋转与地面摩擦
      if (!quiet) {
        for (const b of this.balls) {
          if (!b.active) continue;
          b.ang.x += b.angVel.x * h;
          b.ang.y += b.angVel.y * h;
          b.ang.z += b.angVel.z * h;
          b.angVel.multiplyScalar(Math.exp(-1.4 * h));
          b.group.rotation.set(b.ang.x, b.ang.y, b.ang.z);
          this._ballBounds(b);
          // 静置吸能，避免在果冻表面无限微振
          if (b.inContact) {
            if (Math.abs(b.vy) < 0.16) b.vy *= Math.exp(-14 * h);
            if (Math.abs(b.vx) < 0.06) b.vx *= Math.exp(-10 * h);
            if (Math.abs(b.vz) < 0.06) b.vz *= Math.exp(-10 * h);
          }
        }
        // 释放调度
        if (this.started && this.time >= this.startAt) {
          for (const b of this.balls) {
            if (!b.active && !b.released && this.time >= this.startAt + b.dropIndex * this.p.ball.interval) {
              b.active = true;
              b.released = true;
              b.vy = 0;
              if (this.events.onRelease) this.events.onRelease();
            }
          }
        }
      }
    }

    _solveConstraints(h, stiffScale) {
      const p = this.pos, inv = this.inv;
      const A = this.cA, B = this.cB, L = this.cL, S = this.cS;
      for (let c = 0; c < A.length; c++) {
        const ia = A[c], ib = B[c];
        const ia3 = ia * 3, ib3 = ib * 3;
        const dx = p[ib3] - p[ia3];
        const dy = p[ib3 + 1] - p[ia3 + 1];
        const dz = p[ib3 + 2] - p[ia3 + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1e-12) continue;
        const d = Math.sqrt(d2);
        const wa = inv[ia], wb = inv[ib];
        const wsum = wa + wb;
        if (wsum === 0) continue;
        const rest = L[c];
        const diff = ((d - rest) / d) * S[c] * stiffScale * 0.5;
        const ka = (wa / wsum) * diff;
        const kb = (wb / wsum) * diff;
        p[ia3] += dx * ka; p[ia3 + 1] += dy * ka; p[ia3 + 2] += dz * ka;
        p[ib3] -= dx * kb; p[ib3 + 1] -= dy * kb; p[ib3 + 2] -= dz * kb;
      }
    }

    _groundParticles(h) {
      const p = this.pos, prev = this.prev;
      const bottom = -this.b;
      for (let i = 0; i < this.nP; i++) {
        const i3 = i * 3;
        if (p[i3 + 1] < bottom) {
          p[i3 + 1] = bottom;
          p[i3] = (p[i3] + prev[i3]) * 0.5;
          p[i3 + 2] = (p[i3 + 2] + prev[i3 + 2]) * 0.5;
        }
      }
    }

    _volumeBulge(h) {
      // 顶部平均压缩 → 侧向鼓出（体积近似守恒）
      let sum = 0, cnt = 0;
      for (let k = 0; k < NZ; k++) {
        for (let i = 0; i < NX; i++) {
          const idx = (k * NY + (NY - 1)) * NX + i;
          sum += this.pos[idx * 3 + 1] - this.rest[idx * 3 + 1];
          cnt++;
        }
      }
      const avg = sum / Math.max(1, cnt);
      if (avg < -0.002) {
        const fac = 1 + Math.min(0.24, -avg * 0.85);
        for (let i = 0; i < this.nP; i++) {
          if (this.inv[i] === 0) continue;
          const i3 = i * 3;
          const wy = U.clamp((this.pos[i3 + 1] + this.b) / (2 * this.b), 0, 1);
          const f = 1 + (fac - 1) * wy;
          this.pos[i3] *= f;
          this.pos[i3 + 2] *= f;
        }
      }
    }

    _collideParticlesBall() {
      if (!this.balls) return;
      for (const b of this.balls) {
        if (!b.active) continue;
        const r = b.radius + 0.045;
        const bx = b.x, by = b.y, bz = b.z;
        const r2 = r * r;
        for (let i = 0; i < this.nP; i++) {
          const i3 = i * 3;
          const wx = this.pos[i3] + 0;
          const wy = this.pos[i3 + 1] + this.centerY;
          const wz = this.pos[i3 + 2] + 0;
          const dx = wx - bx, dy = wy - by, dz = wz - bz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < r2 && d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const push = (r - d);
            const nx = dx / d, ny = dy / d, nz = dz / d;
            // 只推开晶格粒子；重球受力由表面弹簧接触负责
            this.pos[i3] += nx * push * 0.85;
            this.pos[i3 + 1] += ny * push * 0.85;
            this.pos[i3 + 2] += nz * push * 0.85;
          }
        }
      }
    }

    _shapeRestore() {
      // 形状记忆：轻微拉回静止形，防止厚块在自重下塌陷（局部凹陷由外力覆盖）
      const k = 0.012;
      const p = this.pos, rest = this.rest, inv = this.inv;
      for (let i = 0; i < this.nP; i++) {
        if (inv[i] === 0) continue;
        const i3 = i * 3;
        p[i3] += (rest[i3] - p[i3]) * k;
        p[i3 + 1] += (rest[i3 + 1] - p[i3 + 1]) * k;
        p[i3 + 2] += (rest[i3 + 2] - p[i3 + 2]) * k;
      }
    }

    _ballGround(b, h) {
      const floor = 0.02 + b.radius;
      if (b.y < floor) {
        b.y = floor;
        if (b.vy < -0.2) {
          b.vy = -b.vy * this.p.env.restitution;
          if (this.events.onBall) this.events.onBall(U.clamp(-b.vy * 0.2, 0.1, 1));
        } else {
          b.vy = 0;
        }
        const fr = this.p.env.friction;
        b.vx *= (1 - fr * 0.22);
        b.vz *= (1 - fr * 0.22);
        // 滚动角速度
        b.angVel.z = -b.vx / b.radius * 0.85;
        b.angVel.x = b.vz / b.radius * 0.85;
        b.landed = true;
      }
    }

    _ballBounds(b) {
      const lim = 8.5;
      if (Math.abs(b.x) > lim || Math.abs(b.z) > lim || b.y < -2) {
        b.active = false;
        b.group.visible = false;
      }
    }

    _ballBallCollisions(h) {
      for (let i = 0; i < this.balls.length; i++) {
        const A = this.balls[i];
        if (!A.active) continue;
        for (let j = i + 1; j < this.balls.length; j++) {
          const B = this.balls[j];
          if (!B.active) continue;
          const dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z;
          const rr = A.radius + B.radius;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < rr * rr && d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const nx = dx / d, ny = dy / d, nz = dz / d;
            const overlap = rr - d;
            A.x -= nx * overlap * 0.5; A.y -= ny * overlap * 0.5; A.z -= nz * overlap * 0.5;
            B.x += nx * overlap * 0.5; B.y += ny * overlap * 0.5; B.z += nz * overlap * 0.5;
            const rvx = B.vx - A.vx, rvy = B.vy - A.vy, rvz = B.vz - A.vz;
            const vn = rvx * nx + rvy * ny + rvz * nz;
            if (vn < 0) {
              const e = 0.35;
              const jimp = -(1 + e) * vn * 0.5;
              A.vx -= nx * jimp; A.vy -= ny * jimp; A.vz -= nz * jimp;
              B.vx += nx * jimp; B.vy += ny * jimp; B.vz += nz * jimp;
              if (Math.abs(vn) > 0.4 && this.events.onBall) this.events.onBall(U.clamp(Math.abs(vn) * 0.12, 0.08, 1));
            }
          }
        }
      }
    }

    /** 变形表面高度（局部坐标） */
    _surfaceHeight(lx, lz, out) {
      const nx = U.clamp(lx / this.a, -0.999, 0.999);
      const nz = U.clamp(lz / this.c, -0.999, 0.999);
      const rr = 1 - Math.pow(Math.abs(nx), M) - Math.pow(Math.abs(nz), M);
      let y = rr > 0 ? this.b * Math.pow(rr, 1 / M) : 0;

      // 顶层的变形位移（双线性）
      const u = U.clamp((lx + this.a) / (2 * this.a), 0, 0.99999) * (NX - 1);
      const w = U.clamp((lz + this.c) / (2 * this.c), 0, 0.99999) * (NZ - 1);
      const i0 = Math.floor(u), k0 = Math.floor(w);
      const i1 = Math.min(i0 + 1, NX - 1), k1 = Math.min(k0 + 1, NZ - 1);
      const fu = u - i0, fw = w - k0;
      const top = (NY - 1) * NX;
      const idxOf = (i, k) => (k * NY + (NY - 1)) * NX + i;
      const id00 = idxOf(i0, k0), id10 = idxOf(i1, k0), id01 = idxOf(i0, k1), id11 = idxOf(i1, k1);
      const dy = (1 - fu) * (1 - fw) * (this.pos[id00 * 3 + 1] - this.rest[id00 * 3 + 1]) +
        fu * (1 - fw) * (this.pos[id10 * 3 + 1] - this.rest[id10 * 3 + 1]) +
        (1 - fu) * fw * (this.pos[id01 * 3 + 1] - this.rest[id01 * 3 + 1]) +
        fu * fw * (this.pos[id11 * 3 + 1] - this.rest[id11 * 3 + 1]);
      // 顶层速度
      const vy = (1 - fu) * (1 - fw) * this.vel[id00 * 3 + 1] +
        fu * (1 - fw) * this.vel[id10 * 3 + 1] +
        (1 - fu) * fw * this.vel[id01 * 3 + 1] +
        fu * fw * this.vel[id11 * 3 + 1];
      out.y = y + dy;
      out.vy = vy;
      return out;
    }

    _ballContact(b, h) {
      const lx = b.x; // 世界 x 即局部 x（果冻中心在 x=0）
      const lz = b.z;
      if (Math.abs(lx) > this.a * 1.04 + b.radius * 0.55 || Math.abs(lz) > this.c * 1.04 + b.radius * 0.55) {
        b.inContact = false;
        b.pen = 0;
        return;
      }
      const s = { y: 0, vy: 0 };
      this._surfaceHeight(lx, lz, s);
      const restTopW = this.centerY + this._restTop(lx, lz) + this._modeDispY(lx, this._restTop(lx, lz), lz);
      const bottom = b.y - b.radius;
      const pen = restTopW - bottom;
      if (pen <= 0.002) {
        b.inContact = false;
        b.pen = 0;
        return;
      }
      b.pen = Math.min(pen, this.b * 1.2);

      // 静态形状法线 + 温和的形变倾斜（避免局部凹坑把球横向弹出）
      const invA = 1 / this.a, invC = 1 / this.c;
      const nx0 = lx * invA, nz0 = lz * invC;
      let q = 1 - Math.pow(Math.abs(nx0), M) - Math.pow(Math.abs(nz0), M);
      q = Math.max(0.02, q);
      const qq = Math.pow(q, 1 / M - 1);
      const dhx = -this.b * qq * Math.pow(lx, 3) / Math.pow(this.a, 4);
      const dhz = -this.b * qq * Math.pow(lz, 3) / Math.pow(this.c, 4);
      let nx = -dhx, ny = 1, nz = -dhz;

      const eps = Math.max(0.24, b.radius * 0.7);
      const s1 = { y: 0, vy: 0 }, s2 = { y: 0, vy: 0 }, s3 = { y: 0, vy: 0 }, s4 = { y: 0, vy: 0 };
      this._surfaceHeight(lx + eps, lz, s1);
      this._surfaceHeight(lx - eps, lz, s2);
      this._surfaceHeight(lx, lz + eps, s3);
      this._surfaceHeight(lx, lz - eps, s4);
      // 只取位移场的斜率，减弱深坑边缘带来的异常法线
      const r1 = this._restTop(lx + eps, lz), r2 = this._restTop(lx - eps, lz);
      const r3 = this._restTop(lx, lz + eps), r4 = this._restTop(lx, lz - eps);
      const dsx = ((s1.y - r1) - (s2.y - r2)) / (2 * eps);
      const dsz = ((s3.y - r3) - (s4.y - r4)) / (2 * eps);
      nx += dsx * 0.55;
      nz += dsz * 0.55;

      const nl = Math.hypot(nx, ny, nz);
      nx /= nl; ny /= nl; nz /= nl;
      if (ny < 0.55) {
        nx *= 0.55 / ny; nz *= 0.55 / ny; ny = 0.55;
        const l2 = Math.hypot(nx, ny, nz);
        nx /= l2; ny /= l2; nz /= l2;
      }

      const soft = this.p.jelly.softness;
      const H = this.b * 2;
      const k = this.tune.k + (1 - soft) * this.tune.kSoft;
      const c = 2 * Math.sqrt(k * b.mass) * this.tune.zeta;
      const rvx = b.vx, rvy = b.vy, rvz = b.vz;
      const vn = rvx * nx + rvy * ny + rvz * nz;
      const stiffen = 1 + 2.2 * Math.min(1.5, (pen / H) * (pen / H));
      let fn = k * pen * stiffen - c * vn;
      fn = Math.max(0, Math.min(fn, 60000));

      // 施加在球上
      const imp = fn * h;
      b.vx += nx * imp / b.mass;
      b.vy += ny * imp / b.mass;
      b.vz += nz * imp / b.mass;

      // 切向摩擦 + 滚动
      const tx = rvx - vn * nx, tz = rvz - vn * nz;
      const ts = Math.hypot(tx, tz);
      if (ts > 1e-4) {
        const mu = this.p.env.friction;
        const fr = Math.min(ts, mu * fn * h / b.mass);
        b.vx -= (tx / ts) * fr;
        b.vz -= (tz / ts) * fr;
        b.angVel.x = (tz / ts) * fr / b.radius * 0.8;
        b.angVel.z = -(tx / ts) * fr / b.radius * 0.8;
      }

      // 局部凹陷是通过形变目标驱动的，这里保留少量力耦合让晶格获得侧向响应
      let sw = 0;
      const weights = [];
      const maxLat = Math.max(0.4, b.radius * 1.9);
      for (let i = 0; i < this.nP; i++) {
        const i3 = i * 3;
        const wx = this.pos[i3];
        const wy = this.pos[i3 + 1];
        const wz = this.pos[i3 + 2];
        if (wy < -this.b * 0.12) continue;
        const ddx = wx - lx, ddz = wz - lz;
        const lat2 = ddx * ddx + ddz * ddz;
        if (lat2 > maxLat * maxLat) continue;
        const wgt = Math.exp(-lat2 / (maxLat * maxLat * 0.55)) * (0.35 + 0.65 * U.clamp((wy + this.b * 0.2) / (this.b * 1.1), 0, 1));
        if (wgt < 0.01) continue;
        weights.push([i, wgt]);
        sw += wgt;
      }
      if (sw > 0) {
        const forceScale = fn * 0.08;
        for (const [i, wgt] of weights) {
          const i3 = i * 3;
          const amt = (forceScale * (wgt / sw) / this.nodeMass) * h;
          const lim = 1.25 * h * 120;
          this.vel[i3] += U.clamp(-nx * amt, -lim, lim);
          this.vel[i3 + 1] += U.clamp(-ny * amt, -lim, lim);
          this.vel[i3 + 2] += U.clamp(-nz * amt, -lim, lim);
        }
      }

      // 接触事件
      if (!b.inContact && b.speed > 0.2) {
        const strength = U.clamp((Math.abs(vn) + pen * 8) / 12, 0.15, 1);
        this.contactCount++;
        this.lastImpactAt = this.time;
        if (this.contactCount === 1) this.firstImpactAt = this.time;
        this.shake = Math.min(0.09, this.shake + strength * 0.075);
        this.impactEnergy = Math.max(this.impactEnergy, strength);
        this._spawnImpactFx(lx, restTopW, lz, strength);
        this._exciteWobble(strength, lx, lz, vn);
        if (this.events.onImpact) this.events.onImpact(strength);
        if (this.events.onJelly) this.events.onJelly(strength);
      }
      b.inContact = true;
      b.contactSound += h;
      if (b.vy > 5.2) b.vy = 5.2;
    }

    _applyDents(h) {
      if (!this.dentTarget) this.dentTarget = new Float32Array(this.nP);
      const target = this.dentTarget;
      target.fill(0);
      const H = this.b * 2;
      let any = false;
      for (const b of this.balls) {
        if (!b.active || !b.pen || b.pen <= 0) continue;
        const depth = Math.min(b.pen, H * 0.62) * (this.tune.dent || 1);
        const sigma = Math.max(0.16, b.radius * 0.62);
        const maxLat = b.radius * 2.15;
        const maxLat2 = maxLat * maxLat;
        for (let i = 0; i < this.nP; i++) {
          const i3 = i * 3;
          const dx = this.pos[i3] - b.x;
          const dz = this.pos[i3 + 2] - b.z;
          const lat2 = dx * dx + dz * dz;
          if (lat2 > maxLat2) continue;
          const ynRest = U.clamp((this.rest[i3 + 1] + this.b) / H, 0, 1);
          if (ynRest < 0.2) continue;
          const wLat = Math.exp(-lat2 / (2 * sigma * sigma));
          const wY = Math.pow(U.clamp(1 - (1 - ynRest) / 0.62, 0, 1), 0.72);
          const t = depth * wLat * wY;
          if (t > target[i]) { target[i] = t; any = true; }
        }
      }
      if (!any) return;
      const prev = this.prev;
      for (let i = 0; i < this.nP; i++) {
        if (target[i] <= 0 || this.inv[i] === 0) continue;
        const i3 = i * 3;
        const wantY = this.rest[i3 + 1] - target[i];
        const dy = (wantY - this.pos[i3 + 1]) * 0.9;
        this.pos[i3 + 1] += dy;
        // 同步上一位置，避免强制位移产生虚假的巨大速度
        prev[i3 + 1] += dy;
      }
    }

    _restTop(lx, lz) {
      const nx = U.clamp(lx / this.a, -0.999, 0.999);
      const nz = U.clamp(lz / this.c, -0.999, 0.999);
      const rr = 1 - Math.pow(Math.abs(nx), M) - Math.pow(Math.abs(nz), M);
      return rr > 0 ? this.b * Math.pow(rr, 1 / M) : 0;
    }

    /** 受冲击激发的低阶软体振荡模式（阻尼谐振子，与晶格形变叠加） */
    _exciteWobble(strength, lx, lz, vn) {
      const sx = U.clamp(lx / this.a, -1, 1);
      const sz = U.clamp(lz / this.c, -1, 1);
      const impact = U.clamp(strength, 0.1, 1.2);
      this.wob.sqv += impact * 8.4;
      this.wob.swayv += sx * impact * 2.9;
      this.wob.bendv += sx * impact * 1.6;
      this.wob.twistv += sx * sz * impact * 1.2;
    }

    _integrateWobble(h) {
      const w = this.wob;
      const scale = 1 / Math.sqrt(this.p.jelly.scale);
      const zeta = 0.027 + this.p.jelly.damping * 0.016;
      const stepMode = (x, v, omega) => {
        const a = -omega * omega * x - 2 * zeta * omega * v;
        v += a * h;
        x += v * h;
        return [x, v];
      };
      let r;
      r = stepMode(w.sq, w.sqv, 17 * scale); w.sq = r[0]; w.sqv = r[1];
      r = stepMode(w.sway, w.swayv, 9.5 * scale); w.sway = r[0]; w.swayv = r[1];
      r = stepMode(w.bend, w.bendv, 12.5 * scale); w.bend = r[0]; w.bendv = r[1];
      r = stepMode(w.twist, w.twistv, 10.5 * scale); w.twist = r[0]; w.twistv = r[1];
    }

    _modeDisp(x, y, z, out) {
      const h = U.clamp((y + this.b) / (2 * this.b), 0, 1);
      const hh = h * h;
      const w = this.wob;
      const sq = w.sq;
      out.x = x * sq * 0.35 * hh + w.sway * hh - z * w.twist * hh;
      out.z = z * sq * 0.35 * hh + x * w.twist * hh;
      out.y = -sq * this.b * Math.pow(h, 1.15) + w.bend * (x / this.a) * h * 0.9;
      return out;
    }

    _modeDispY(x, y, z) {
      const h = U.clamp((y + this.b) / (2 * this.b), 0, 1);
      return -this.wob.sq * this.b * Math.pow(h, 1.15) + this.wob.bend * (x / this.a) * h * 0.9;
    }

    _spawnImpactFx(x, y, z, strength) {
      const theme = THEMES[this.p.jelly.color] || THEMES.mint;
      const ringMat = new THREE.MeshBasicMaterial({
        color: theme.glow,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1.0, 80), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, y + 0.012, z);
      ring.scale.setScalar(0.25);
      this.fxGroup.add(ring);
      this._fx = this._fx || [];
      this._fx.push({ type: 'ring', mesh: ring, mat: ringMat, t: 0, dur: 1.1, strength });

      const sprMat = new THREE.SpriteMaterial({
        map: U.glowTexture(), color: theme.glow, transparent: true,
        opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false
      });
      const spr = new THREE.Sprite(sprMat);
      spr.position.set(x, y + 0.06, z);
      spr.scale.setScalar(1.5 + strength * 1.6);
      this.fxGroup.add(spr);
      this._fx.push({ type: 'glow', mesh: spr, mat: sprMat, t: 0, dur: 0.55, strength });

      // 微小水花般的胶体颗粒
      const rand = U.rng(Math.floor(this.time * 1000) + 71);
      const count = 14 + Math.floor(strength * 18);
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const vv = [];
      for (let i = 0; i < count; i++) {
        pos[i * 3] = x + (rand() - 0.5) * b0(this.a);
        pos[i * 3 + 1] = y + 0.03;
        pos[i * 3 + 2] = z + (rand() - 0.5) * b0(this.c);
        vv.push(new THREE.Vector3((rand() - 0.5) * 2.2, 0.7 + rand() * 2.2 * strength, (rand() - 0.5) * 2.2));
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pm = new THREE.PointsMaterial({
        map: U.sprayTexture(), color: theme.glow, size: 0.055, transparent: true,
        opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
      });
      const pts = new THREE.Points(geo, pm);
      this.fxGroup.add(pts);
      this._fx.push({ type: 'spray', mesh: pts, mat: pm, t: 0, dur: 0.8, vv, geo });

      function b0(v) { return v; }
    }

    _clearFx() {
      if (this._fx) {
        for (const f of this._fx) {
          this.fxGroup.remove(f.mesh);
          if (f.geo) f.geo.dispose();
          if (f.mat) f.mat.dispose();
          if (f.type === 'ring' && f.mesh.geometry) f.mesh.geometry.dispose();
        }
      }
      this._fx = [];
      while (this.fxGroup.children.length) {
        const ch = this.fxGroup.children[this.fxGroup.children.length - 1];
        this.fxGroup.remove(ch);
        if (ch.geometry && ch.isMesh) ch.geometry.dispose();
        if (ch.material && !ch.material.__keep) ch.material.dispose();
      }
    }

    _updateVisuals(dt) {
      // 悬浮环
      for (const b of this.balls) {
        if (!b.active) {
          b.group.position.set(
            b.x,
            b.y + Math.sin(this.time * 1.5 + b.hoverPhase) * 0.018,
            b.z
          );
          if (b.hring && b.hring.visible) {
            b.hring.rotation.z += dt * 0.7;
            b.hringMat.opacity = 0.36 + Math.sin(this.time * 2.2 + b.hoverPhase) * 0.12;
          }
        } else if (b.hring && b.hring.visible) {
          b.hring.scale.setScalar(b.hring.scale.x + dt * 2.4);
          b.hringMat.opacity = Math.max(0, b.hringMat.opacity - dt * 1.6);
          if (b.hringMat.opacity <= 0) b.hring.visible = false;
        }
        if (b.active) {
          b.group.position.set(b.x, b.y, b.z);
        }
      }

      // 特效
      if (this._fx) {
        for (let i = this._fx.length - 1; i >= 0; i--) {
          const f = this._fx[i];
          f.t += dt;
          const k = U.clamp(f.t / f.dur, 0, 1);
          if (f.type === 'ring') {
            f.mesh.scale.setScalar(0.3 + k * 2.6);
            f.mat.opacity = (1 - k) * 0.5 * f.strength;
          } else if (f.type === 'glow') {
            f.mat.opacity = (1 - k) * 0.75;
            f.mesh.scale.setScalar((1.5 + f.strength * 1.6) * (1 + k * 0.6));
          } else if (f.type === 'spray') {
            const pos = f.geo.attributes.position.array;
            for (let q = 0; q < f.vv.length; q++) {
              const v = f.vv[q];
              v.y -= 5.5 * dt;
              pos[q * 3] += v.x * dt;
              pos[q * 3 + 1] += v.y * dt;
              pos[q * 3 + 2] += v.z * dt;
            }
            f.geo.attributes.position.needsUpdate = true;
            f.mat.opacity = (1 - k) * 0.7;
          }
          if (k >= 1) {
            this.fxGroup.remove(f.mesh);
            if (f.geo) f.geo.dispose();
            if (f.mat) f.mat.dispose();
            this._fx.splice(i, 1);
          }
        }
      }

      // 浮尘缓慢上升
      if (this.dust) {
        const pos = this.dust.geometry.attributes.position.array;
        for (let i = 0; i < pos.length; i += 3) {
          pos[i + 1] += dt * 0.055;
          pos[i] += Math.sin(this.time * 0.25 + i) * dt * 0.012;
          if (pos[i + 1] > 5.4) pos[i + 1] = -0.2;
        }
        this.dust.geometry.attributes.position.needsUpdate = true;
      }

      // 地光强度随冲击
      if (this.floorGlow) {
        this.impactEnergy *= Math.exp(-2.4 * dt);
        this.floorGlow.material.opacity = 0.12 + this.impactEnergy * 0.3;
      }
      this.shake *= Math.exp(-5.5 * dt);
    }

    _isCalm() {
      const w = this.wob;
      if (Math.abs(w.sq) > 0.02 || Math.abs(w.sway) > 0.03 || Math.abs(w.bend) > 0.03 || Math.abs(w.twist) > 0.03) return false;
      for (const b of this.balls) {
        if (b.active && b.speed > 0.1) return false;
      }
      return true;
    }

    _updateMesh() {
      const nP = this.nP;
      const disp = this.disp;
      const p = this.pos, rest = this.rest;
      for (let i = 0; i < nP; i++) {
        const i3 = i * 3;
        disp[i3] = p[i3] - rest[i3];
        disp[i3 + 1] = p[i3 + 1] - rest[i3 + 1];
        disp[i3 + 2] = p[i3 + 2] - rest[i3 + 2];
      }
      const posArr = this.geo.attributes.position.array;
      const vRest = this.vRest;
      const pids = this.vPids;
      const ws = this.vW;
      const md = { x: 0, y: 0, z: 0 };
      for (let vi = 0; vi < this.vCount; vi++) {
        const vi3 = vi * 3;
        let dx = 0, dy = 0, dz = 0;
        const base = vi * 8;
        for (let q = 0; q < 8; q++) {
          const id3 = pids[base + q] * 3;
          const w = ws[base + q];
          dx += disp[id3] * w;
          dy += disp[id3 + 1] * w;
          dz += disp[id3 + 2] * w;
        }
        const rx = vRest[vi3], ry = vRest[vi3 + 1], rz = vRest[vi3 + 2];
        this._modeDisp(rx, ry, rz, md);
        posArr[vi3] = rx + dx + md.x;
        posArr[vi3 + 1] = ry + dy + md.y;
        posArr[vi3 + 2] = rz + dz + md.z;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.computeVertexNormals();
      this.geo.attributes.normal.needsUpdate = true;
    }

    _updateBubbles() {
      if (!this.bubbles) return;
      for (const b of this.bubbles) {
        const u = U.clamp((b.x + this.a) / (2 * this.a), 0, 0.99999) * (NX - 1);
        const v = U.clamp((b.y + this.b) / (2 * this.b), 0, 0.99999) * (NY - 1);
        const w = U.clamp((b.z + this.c) / (2 * this.c), 0, 0.99999) * (NZ - 1);
        const i0 = Math.floor(u), j0 = Math.floor(v), k0 = Math.floor(w);
        const i1 = Math.min(i0 + 1, NX - 1), j1 = Math.min(j0 + 1, NY - 1), k1 = Math.min(k0 + 1, NZ - 1);
        const fu = u - i0, fv = v - j0, fw = w - k0;
        const pi = (i, j, k) => (k * NY + j) * NX + i;
        const ids = [pi(i0, j0, k0), pi(i1, j0, k0), pi(i0, j1, k0), pi(i1, j1, k0),
          pi(i0, j0, k1), pi(i1, j0, k1), pi(i0, j1, k1), pi(i1, j1, k1)];
        const ws = [(1 - fu) * (1 - fv) * (1 - fw), fu * (1 - fv) * (1 - fw),
          (1 - fu) * fv * (1 - fw), fu * fv * (1 - fw),
          (1 - fu) * (1 - fv) * fw, fu * (1 - fv) * fw,
          (1 - fu) * fv * fw, fu * fv * fw];
        let dx = 0, dy = 0, dz = 0;
        for (let q = 0; q < 8; q++) {
          const id3 = ids[q] * 3;
          dx += this.disp[id3] * ws[q];
          dy += this.disp[id3 + 1] * ws[q];
          dz += this.disp[id3 + 2] * ws[q];
        }
        const md = { x: 0, y: 0, z: 0 };
        this._modeDisp(b.x, b.y, b.z, md);
        b.mesh.position.set(b.x + dx + md.x, b.y + dy + md.y, b.z + dz + md.z);
      }
    }

    _syncBallMeshes() {
      for (const b of this.balls) {
        b.group.position.set(b.x, b.y, b.z);
        b.group.rotation.set(b.ang.x, b.ang.y, b.ang.z);
      }
    }

    setActive(on) {
      this.orbit.enabled = on && !this.exportMode;
    }

    render(dt) {
      this.orbit.update(dt || 0.016);
      if (!this.exportMode && this.shake > 0.0005) {
        const t = performance.now() * 0.001;
        this.camera.position.x += Math.sin(t * 57) * this.shake;
        this.camera.position.y += Math.sin(t * 71 + 1.7) * this.shake * 0.8;
        this.camera.position.z += Math.sin(t * 63 + 0.6) * this.shake * 0.6;
      }
      this.renderer.render(this.scene, this.camera);
    }

    getPhase() {
      if (!this.started) return { key: 'ready', label: '准备' };
      if (this.time < this.startAt) return { key: 'ready', label: '准备' };
      if (this.contactCount === 0) return { key: 'drop', label: '下落' };
      if (this.ended) return { key: 'settled', label: '稳定' };
      if (this.time - this.firstImpactAt < 0.7) return { key: 'impact', label: '冲击' };
      return { key: 'after', label: '余波' };
    }

    getProgress() {
      const target = this.p.mode === 'multi' ? 9.5 : 7.2;
      if (!this.started) return 0;
      if (this.ended) return 1;
      return U.clamp(this.time / target, 0, 0.98);
    }

    getStatusLine() {
      if (!this.started) return '重球悬停，等待释放';
      if (this.time < this.startAt) return '系统就绪';
      if (this.contactCount === 0) return '重球自由下落';
      if (this.ended) return '振荡衰减，系统稳定';
      if (this.time - this.firstImpactAt < 0.7) return '接触 · 局部凹陷扩散';
      return '回弹 · 形变在晶格中传播';
    }
  }

  JellyScene.DEFAULTS = DEFAULTS;
  window.JellyScene = JellyScene;
})();
