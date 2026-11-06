"use strict";
const S = 1.5;
class World {
  constructor(canvas, host) {
    this.canvas = canvas;
    this.host = host;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x091416);
    this.scene.fog = new THREE.FogExp2(0x091416, 0.013);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 220);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.materials = {};
    this.geo = {};
    this.meshes = new Map();
    this.labels = [];
    this.effects = [];
    this.particles = [];
    this.pickables = [];
    this.routeGroup = new THREE.Group();
    this.engagementGroup = new THREE.Group();
    this.previewGroup = new THREE.Group();
    this.dynamic = new THREE.Group();
    this.fx = new THREE.Group();
    this.environment = new THREE.Group();
    this.board = new THREE.Group();
    this.scene.add(
      this.board,
      this.environment,
      this.routeGroup,
      this.engagementGroup,
      this.previewGroup,
      this.dynamic,
      this.fx,
    );
    this.theta = 0.54;
    this.phi = 0.74;
    this.zoom = 1;
    this.target = new THREE.Vector3();
    this.showRoutes = true;
    this.scene.add(new THREE.HemisphereLight(0xc4f4eb, 0x152b31, 2.5));
    const sun = new THREE.DirectionalLight(0xe1fff1, 3.7);
    this.sun = sun;
    sun.position.set(-15, 32, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x4a99b0, 2);
    this.rim = rim;
    rim.position.set(10, 5, -20);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0xdae5dc, 0.55));
    const orange = new THREE.PointLight(0xff9a54, 25, 35);
    orange.position.set(-15, 4, 10);
    this.scene.add(orange);
    this.glowTexture = this.makeGlow();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.installCamera();
  }
  mat(color, metal = 0.4, rough = 0.48, emissive = 0, opacity = 1) {
    let key = [color, metal, rough, emissive, opacity].join();
    if (!this.materials[key])
      this.materials[key] = new THREE.MeshStandardMaterial({
        color,
        metalness: metal,
        roughness: rough,
        emissive: emissive || 0,
        emissiveIntensity: emissive ? 0.65 : 0,
        transparent: opacity < 1,
        opacity,
      });
    return this.materials[key];
  }
  geom(type, args) {
    let k = type + args.join(",");
    if (!this.geo[k]) this.geo[k] = new THREE[type](...args);
    return this.geo[k];
  }
  box(g, w, h, d, x, y, z, color = 0x28423f, em = 0) {
    let m = new THREE.Mesh(
      w > 0.35 && d > 0.3 && h > 0.1
        ? this.bevel(w, h, d)
        : this.geom("BoxGeometry", [w, h, d]),
      this.mat(color, 0.5, 0.4, em),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  bevel(w, h, d) {
    let key = "bevel" + [w, h, d].join();
    if (this.geo[key]) return this.geo[key];
    let r = Math.min(0.055, h * 0.22),
      x = w / 2 - r,
      z = d / 2 - r,
      c = Math.min(0.1, w * 0.1, d * 0.1),
      shape = new THREE.Shape();
    shape.moveTo(-x + c, -z);
    shape.lineTo(x - c, -z);
    shape.lineTo(x, -z + c);
    shape.lineTo(x, z - c);
    shape.lineTo(x - c, z);
    shape.lineTo(-x + c, z);
    shape.lineTo(-x, z - c);
    shape.lineTo(-x, -z + c);
    shape.closePath();
    let geo = new THREE.ExtrudeGeometry(shape, {
      depth: h - 2 * r,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: r,
      bevelThickness: r,
      steps: 1,
      curveSegments: 1,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -h / 2 + r, 0);
    this.geo[key] = geo;
    return geo;
  }
  cyl(g, rt, rb, h, x, y, z, color = 0x355b52, n = 8, em = 0) {
    let m = new THREE.Mesh(
      this.geom("CylinderGeometry", [rt, rb, h, n]),
      this.mat(color, 0.55, 0.36, em),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  sphere(g, r, x, y, z, color, detail = 1) {
    let m = new THREE.Mesh(
      this.geom("IcosahedronGeometry", [r, detail]),
      this.mat(color, 0.45, 0.32, color),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }
  torus(g, r, t, x, y, z, color, vertical = false) {
    let m = new THREE.Mesh(
      this.geom("TorusGeometry", [r, t, 6, 40]),
      this.mat(color, 0.5, 0.3, color),
    );
    m.position.set(x, y, z);
    if (!vertical) m.rotation.x = Math.PI / 2;
    g.add(m);
    return m;
  }
  line(g, points, color, opacity = 1, dashed = false, width = 1) {
    let geo = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(...p)),
    );
    let mat = dashed
      ? new THREE.LineDashedMaterial({
          color,
          transparent: true,
          opacity,
          dashSize: 0.24,
          gapSize: 0.18,
          toneMapped: false,
        })
      : new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity,
          linewidth: width,
          toneMapped: false,
        });
    let l = new THREE.Line(geo, mat);
    if (dashed) l.computeLineDistances();
    g.add(l);
    return l;
  }
  makeGlow() {
    let c = document.createElement("canvas");
    c.width = c.height = 64;
    let x = c.getContext("2d"),
      g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,.8)");
    g.addColorStop(0.2, "rgba(255,255,255,.3)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  glow(g, color, x, y, z, size = 2, opacity = 0.4) {
    let s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    s.position.set(x, y, z);
    s.scale.set(size, size, 1);
    g.add(s);
    return s;
  }
  pos(x, y, height = 0) {
    return new THREE.Vector3(
      (x - (this.map.w - 1) / 2) * S,
      height,
      (y - (this.map.h - 1) / 2) * S,
    );
  }
  dispose(g) {
    let geometries = new Set(Object.values(this.geo)),
      materials = new Set(Object.values(this.materials));
    g.traverse((o) => {
      if (o.geometry && !geometries.has(o.geometry)) o.geometry.dispose();
      let mats = Array.isArray(o.material) ? o.material : [o.material];
      for (let m of mats)
        if (m && !materials.has(m)) {
          if (m.map && m.map !== this.glowTexture) m.map.dispose();
          m.dispose();
        }
    });
  }
  clear(g) {
    while (g.children.length) {
      let obj = g.children[0];
      g.remove(obj);
      this.dispose(obj);
    }
  }
  setGame(game, home = false) {
    this.game = game;
    this.selected = null;
    this.map = game.map;
    this.home = home;
    const theme = [0x091416, 0x08141d, 0x191616][this.map.index];
    this.scene.background.setHex(theme);
    this.scene.fog.color.setHex(theme);
    this.sun.color.setHex([0xe1fff1, 0xd6eaff, 0xffe3bd][this.map.index]);
    this.rim.color.setHex([0x4a99b0, 0x4f9fda, 0x8e79b3][this.map.index]);
    this.ambientAnimations = [];
    [
      this.board,
      this.dynamic,
      this.fx,
      this.routeGroup,
      this.engagementGroup,
      this.previewGroup,
      this.environment,
    ].forEach((g) => this.clear(g));
    this.meshes.clear();
    this.effects = [];
    this.particles = [];
    this.pickables = [];
    this.labels.forEach((l) => l.el.remove());
    this.labels = [];
    this.tileMeshes = new Map();
    this.resetCamera();
    this.buildEnvironment();
    this.buildBoard();
    this.buildInfrastructure();
    this.updateRoutes();
    this.sync(0);
    this.resize();
  }
  buildEnvironment() {
    let g = this.environment;
    const grid = new THREE.GridHelper(150, 100, 0x1c4d49, 0x12332f);
    grid.position.y = -6;
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    g.add(grid);
    let grid2 = new THREE.GridHelper(90, 30, 0x20544a, 0x15382f);
    grid2.position.y = -10;
    grid2.rotation.y = Math.PI / 4;
    grid2.material.transparent = true;
    grid2.material.opacity = 0.3;
    g.add(grid2);
    let ground = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      this.mat(0x081819, 0.2, 0.9),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -10.1;
    ground.receiveShadow = true;
    g.add(ground);
    let rng = () => {
      this.envSeed = (this.envSeed * 16807) % 2147483647;
      return this.envSeed / 2147483647;
    };
    this.envSeed = 54321 + this.map.index;
    for (let i = 0; i < 85; i++) {
      let x = (rng() - 0.5) * 95,
        z = (rng() - 0.5) * 85;
      if (Math.abs(x) < 19 && Math.abs(z) < 16) continue;
      let h = 0.5 + rng() * 5;
      let b = this.box(
        g,
        1 + rng() * 2,
        h,
        1 + rng() * 2,
        x,
        -6 + h / 2,
        z,
        0x173532,
      );
      b.material = this.mat(0x294b40, 0.45, 0.6);
      for (let j = 0; j < 3; j++)
        this.box(
          g,
          0.07,
          h * 0.75,
          0.03,
          x - 0.3 + j * 0.3,
          -6 + h * 0.5,
          z + 0.8,
          0x326a59,
          0x234a40,
        );
      this.box(g, 0.7, 0.04, 0.9, x, -6 + h + 0.03, z, 0x3b6957, 0x305b4c);
    }
    for (let i = 0; i < 24; i++) {
      let z = (rng() - 0.5) * 100,
        x = (rng() - 0.5) * 100,
        len = 4 + rng() * 12;
      this.line(
        g,
        [
          [x, -5.8, z],
          [x + len, -5.8, z],
          [x + len, -5.8, z + 5],
        ],
        0x337260,
        0.45,
      );
      let packet = this.box(g, 0.4, 0.08, 0.12, x, -5.7, z, 0x5cc8a2, 0x4fbc98);
      this.particles.push({
        mesh: packet,
        x,
        z,
        len,
        speed: 0.5 + rng(),
        offset: rng() * len,
      });
    }
    const coords = [];
    for (let i = 0; i < 350; i++)
      coords.push((rng() - 0.5) * 150, -3 - rng() * 30, (rng() - 0.5) * 140);
    let geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(coords, 3));
    g.add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size: 0.055,
          color: 0x90c9b7,
          transparent: true,
          opacity: 0.6,
        }),
      ),
    );
  }
  buildBoard() {
    let g = this.board,
      m = this.map,
      w = (m.w - 0.3) * S,
      h = (m.h - 0.3) * S;
    this.foundation(g, w, h);
    this.box(g, w + 0.1, 0.06, 0.06, 0, -0.4, h / 2, 0x558878, 0x458c71);
    this.box(g, w + 0.1, 0.06, 0.06, 0, -0.4, -h / 2, 0x558878, 0x458c71);
    this.box(g, 0.06, 0.06, h, -w / 2, -0.4, 0, 0x558878, 0x458c71);
    this.box(g, 0.06, 0.06, h, w / 2, -0.4, 0, 0x558878, 0x458c71);
    for (let x = 0; x < m.w; x++) {
      let p = this.pos(x, 0);
      this.box(g, 0.08, 0.1, 0.45, p.x, -0.35, -h / 2 + 0.2, 0x7ba890);
      this.box(g, 0.08, 0.1, 0.45, p.x, -0.35, h / 2 - 0.2, 0x7ba890);
    }
    for (let y = 0; y < m.h; y++) {
      let p = this.pos(0, y);
      this.box(g, 0.45, 0.1, 0.08, -w / 2 + 0.2, -0.35, p.z, 0x7ba890);
      this.box(g, 0.45, 0.1, 0.08, w / 2 - 0.2, -0.35, p.z, 0x7ba890);
    }
    for (let c of m.cells.values()) {
      if (c.type === "obstacle") continue;
      const p = this.pos(c.x, c.y),
        tile = new THREE.Group();
      tile.position.copy(p);
      g.add(tile);
      this.tileMeshes.set(c.id, tile);
      let isP = c.type === "platform";
      let base = this.box(
        tile,
        1.38,
        isP ? 0.55 : 0.24,
        1.38,
        0,
        isP ? 0.025 : -0.12,
        0,
        isP ? 0x73877a : c.old ? 0x534832 : 0x36524e,
      );
      base.userData.cell = c.id;
      this.pickables.push(base);
      this.box(
        tile,
        1.23,
        0.035,
        1.23,
        0,
        isP ? 0.32 : 0.025,
        0,
        isP ? 0x3d584b : c.old ? 0x3b352a : 0x253d3a,
      );
      if (isP) {
        for (const a of [-1, 1]) {
          this.box(tile, 0.22, 0.035, 0.05, a * 0.47, 0.36, -0.5, 0x8ea99b);
          this.box(tile, 0.05, 0.035, 0.22, -0.5, 0.36, a * 0.47, 0x8ea99b);
          this.box(tile, 0.22, 0.035, 0.05, a * 0.47, 0.36, 0.5, 0x8ea99b);
          this.box(tile, 0.05, 0.035, 0.22, 0.5, 0.36, a * 0.47, 0x8ea99b);
        }
        this.cyl(tile, 0.2, 0.2, 0.025, 0, 0.36, 0, 0x447a66, 6, 0x214e3c);
        this.line(
          tile,
          [
            [-0.13, 0.38, 0],
            [0.13, 0.38, 0],
          ],
          0x80c3a2,
        );
        this.line(
          tile,
          [
            [0, 0.38, -0.13],
            [0, 0.38, 0.13],
          ],
          0x80c3a2,
        );
      } else if (c.type === "node") {
        this.cyl(tile, 0.58, 0.64, 0.13, 0, 0.13, 0, 0x385b4d, 8);
        this.cyl(tile, 0.43, 0.46, 0.06, 0, 0.24, 0, 0x153c32, 8);
        tile.userData.nodeRing = this.torus(
          tile,
          0.46,
          0.035,
          0,
          0.28,
          0,
          0x89e9bf,
        );
        this.box(tile, 0.35, 0.04, 0.35, 0, 0.29, 0, 0x8ef2ca, 0x5ab88e);
        for (let j = 0; j < 4; j++) {
          let a = (j * Math.PI) / 2;
          this.box(
            tile,
            0.11,
            0.08,
            0.11,
            Math.sin(a) * 0.51,
            0.25,
            Math.cos(a) * 0.51,
            0xb5d2b8,
          );
        }
        this.addLabel(
          c.name + " · 直通",
          p.clone().add(new THREE.Vector3(0, 0.8, 0)),
          "node",
          c.id,
        );
      } else if (c.type === "entry") {
        const col = c.entry.color;
        for (let j = 0; j < 2; j++) {
          this.box(tile, 0.16, 1.5, 0.22, j ? 0.56 : -0.56, 0.75, 0, 0x44655a);
          this.box(
            tile,
            0.05,
            1.2,
            0.24,
            j ? 0.56 : -0.56,
            0.75,
            0.02,
            col,
            col,
          );
        }
        this.box(tile, 1.25, 0.12, 0.22, 0, 1.5, 0, col, col);
        this.glow(tile, col, 0, 0.7, 0, 2.2, 0.28);
        const entryLabel = this.addLabel(
          c.entry.id + " / " + c.entry.name,
          p.clone().add(new THREE.Vector3(0, 2.1, 0)),
          "entry",
        );
        entryLabel.style.color = "#" + col.toString(16);
        entryLabel.style.borderColor = "#" + col.toString(16) + "80";
      } else if (c.type === "exit") {
        this.core(tile);
        this.addLabel(
          c.exit.id + " / " + c.exit.name,
          p.clone().add(new THREE.Vector3(0, 3.1, 0)),
          "core",
        );
      } else {
        const color = c.old ? 0x8b6a3c : 0x43655b;
        for (let j = 0; j < 3; j++)
          this.box(tile, 0.055, 0.025, 0.12, 0, 0.06, (j - 1) * 0.38, color);
        this.box(tile, 0.8, 0.016, 0.018, 0, 0.05, -0.55, color);
        if (c.old) {
          this.box(tile, 0.22, 0.02, 0.07, 0.4, 0.06, 0.45, 0xc09953, 0x705329);
        }
      }
    }
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) {
        if (m.cells.get(x + "," + y)?.type !== "obstacle") continue;
        let p = this.pos(x, y);
        const proxy = new THREE.Mesh(
          this.geom("BoxGeometry", [1.38, 0.3, 1.38]),
          this.mat(0x172825),
        );
        proxy.position.set(p.x, -0.3, p.z);
        proxy.updateMatrixWorld();
        proxy.userData.cell = x + "," + y;
        this.pickables.push(proxy);
        if (m.index === 2 && x >= 5 && x <= 11 && y >= 4 && y <= 8) {
          if (x === 5 || x === 11 || y === 4 || y === 8) {
            this.box(g, 1.32, 0.18, 1.32, p.x, -0.27, p.z, 0x3c3327);
            this.box(g, 1.1, 0.03, 0.09, p.x, -0.15, p.z, 0x967442, 0x61452a);
          }
          continue;
        }
        if (m.index === 1 && (y === 6 || y === 7)) {
          this.box(g, 1.38, 0.06, 1.38, p.x, -0.43, p.z, 0x153b4b, 0x102f40);
          if (x % 2 === 0)
            this.line(
              g,
              [
                [p.x - 0.6, -0.35, p.z],
                [p.x + 0.6, -0.35, p.z],
              ],
              0x53a0c8,
              0.7,
            );
          continue;
        }
        if (
          (x * 7 + y * 3) % 5 === 0 &&
          x > 0 &&
          x < m.w - 1 &&
          y > 0 &&
          y < m.h - 1
        ) {
          let v = new THREE.Group();
          v.position.copy(p);
          g.add(v);
          this.server(v, (x + y) % 3, m.index);
          v.traverse((o) => {
            if (o.isMesh) {
              o.userData.cell = x + "," + y;
              this.pickables.push(o);
            }
          });
        } else {
          this.box(g, 1.35, 0.04, 1.35, p.x, -0.39, p.z, 0x1a302e);
          if ((x + y) % 3 === 0)
            this.line(
              g,
              [
                [p.x - 0.5, -0.35, p.z - 0.4],
                [p.x + 0.3, -0.35, p.z - 0.4],
                [p.x + 0.3, -0.35, p.z + 0.5],
              ],
              0x2e5045,
              0.6,
            );
        }
      }
    if (m.index === 2) {
      let p = this.pos(8, 6);
      let voidRing = this.torus(g, 2.45, 0.06, p.x, -0.55, p.z, 0xc1844f);
      for (let i = 0; i < 6; i++) {
        let a = (i * Math.PI) / 3;
        this.cyl(
          g,
          0.19,
          0.3,
          0.8,
          p.x + Math.cos(a) * 3.1,
          -0.1,
          p.z + Math.sin(a) * 2.5,
          0x82684a,
          6,
        );
        this.glow(
          g,
          0xffa55f,
          p.x + Math.cos(a) * 3.1,
          0.4,
          p.z + Math.sin(a) * 2.5,
          1,
          0.3,
        );
      }
      this.addLabel(
        "气隙隔离区 / NO PHYSICAL LINK",
        p.clone().add(new THREE.Vector3(0, 0.1, 0)),
        "zone",
      );
    }
    m.zones
      .filter((z) => !(m.index === 2 && z[0] === 8))
      .forEach(([x, y, t]) => this.addLabel(t, this.pos(x, y, 0.4), "zone"));
  }
  foundation(g, w, h) {
    const index = this.map.index;
    if (index === 0) {
      this.box(g, w, 0.6, h, 0, -0.75, 0, 0x172d2c);
      this.box(g, w - 0.6, 0.35, h - 0.6, 0, -1.2, 0, 0x0d2022);
      this.box(g, w - 1, 0.12, h - 1, 0, -1.45, 0, 0x3c6f5c, 0x1f5a44);
    } else if (index === 1) {
      let north = this.pos(0, 2.4).z,
        south = this.pos(0, 10.1).z;
      this.box(g, w, 0.75, 8.5, 0, -0.85, north, 0x18313b);
      this.box(g, w, 0.75, 6.5, 0, -0.85, south, 0x18313b);
      this.box(g, w, 0.12, 3.4, 0, -2, this.pos(0, 6.5).z, 0x14374a, 0x0c2b3d);
      for (let k = 0; k < 9; k++) {
        let z = this.pos(0, 5.7 + k * 0.2).z;
        this.line(
          g,
          [
            [-w / 2, -1.9, z],
            [w / 2, -1.9, z],
          ],
          k % 3 ? 0x2d7194 : 0x4cadd1,
          0.5,
        );
      }
      for (let x of [2, 8, 14]) {
        let p = this.pos(x, 6.5);
        this.box(g, 0.22, 1.2, 4.1, p.x - 0.65, -0.9, p.z, 0x385568);
        this.box(g, 0.22, 1.2, 4.1, p.x + 0.65, -0.9, p.z, 0x385568);
        this.box(g, 0.04, 0.06, 4.2, p.x - 0.7, -0.24, p.z, 0x6aacc5, 0x6aacc5);
        this.box(g, 0.04, 0.06, 4.2, p.x + 0.7, -0.24, p.z, 0x6aacc5, 0x6aacc5);
      }
      this.addLabel("公网流 / PUBLIC TRANSIT", this.pos(5, 6.6, -1.3), "zone");
    } else {
      let center = this.pos(8, 6),
        holeW = 10.7,
        holeH = 7.8;
      let left = (w - holeW) / 2,
        right = left;
      this.box(g, left, 0.75, h, -w / 2 + left / 2, -0.85, 0, 0x292f2b);
      this.box(g, right, 0.75, h, w / 2 - right / 2, -0.85, 0, 0x292f2b);
      let band = (h - holeH) / 2;
      this.box(g, holeW, 0.75, band, 0, -0.85, -h / 2 + band / 2, 0x292f2b);
      this.box(g, holeW, 0.75, band, 0, -0.85, h / 2 - band / 2, 0x292f2b);
      for (let i = 0; i < 3; i++)
        this.torus(
          g,
          1.5 + i * 0.55,
          0.035,
          center.x,
          -2 - i * 1.1,
          center.z,
          0x916644,
        );
      this.glow(g, 0xffa860, center.x, -2, center.z, 6, 0.12);
    }
    for (let x of [-w / 2 + 0.5, w / 2 - 0.5])
      for (let z of [-h / 2 + 0.5, h / 2 - 0.5]) {
        this.cyl(g, 0.2, 0.34, 0.65, x, -1.1, z, 0x708674, 6);
        this.cyl(g, 0.21, 0.21, 0.15, x, -1.5, z, 0x64d7ad, 6, 0x359873);
        this.glow(g, 0x51dca6, x, -1.6, z, 2, 0.25);
      }
  }
  buildInfrastructure() {
    const g = this.board,
      m = this.map;
    if (m.index === 0) {
      // Independent cooling modules make the enterprise server rooms tangible.
      for (const [x, y] of [
        [5, 6],
        [5, 8],
        [9, 8],
      ]) {
        if (m.cells.get(x + "," + y)?.type !== "obstacle") continue;
        const pod = new THREE.Group();
        pod.position.copy(this.pos(x, y));
        g.add(pod);
        this.box(pod, 1.12, 0.72, 1.05, 0, 0.12, 0, 0x36564b);
        this.box(pod, 0.94, 0.05, 0.92, 0, 0.51, 0, 0x172d29);
        for (let i = 0; i < 4; i++)
          this.box(pod, 0.73, 0.025, 0.035, 0, -0.1 + i * 0.12, 0.55, 0x71998b);
        this.torus(pod, 0.34, 0.035, 0, 0.55, 0, 0x6eaa92);
        const fan = new THREE.Group();
        fan.position.y = 0.57;
        pod.add(fan);
        for (let i = 0; i < 4; i++) {
          const blade = this.box(fan, 0.12, 0.025, 0.53, 0, 0, 0, 0x93b9a5);
          blade.rotation.y = (i * Math.PI) / 2 + 0.3;
        }
        this.cyl(fan, 0.09, 0.09, 0.06, 0, 0.02, 0, 0xa4cebb, 10);
        this.ambientAnimations.push({
          mesh: fan,
          axis: "y",
          speed: 1.6 + x * 0.07,
        });
        this.box(pod, 0.16, 0.06, 0.035, 0.35, 0.3, 0.56, 0x7ef3bd, 0x7ef3bd);
      }
    }
    if (m.index === 1) {
      const width = m.w * S;
      for (let lane = 0; lane < 7; lane++) {
        const z = this.pos(0, 5.8 + lane * 0.23).z;
        for (let i = 0; i < 5; i++) {
          const packet = this.box(
            g,
            0.38 + (i % 2) * 0.18,
            0.025,
            0.055,
            0,
            -0.32,
            z,
            0x6bb9d5,
            0x4bb5e5,
          );
          this.particles.push({
            mesh: packet,
            x: -width / 2,
            z,
            len: width,
            speed: 2.5 + lane * 0.28,
            offset: (width * i) / 5 + lane * 0.4,
          });
        }
      }
      for (const x of [2, 8, 14])
        for (const y of [5.7, 7.3]) {
          const p = this.pos(x, y),
            points = [];
          for (let i = 0; i <= 20; i++) {
            const a = (i / 20) * Math.PI;
            points.push(
              new THREE.Vector3(
                p.x + Math.cos(a) * 0.74,
                1 + Math.sin(a) * 0.65,
                p.z,
              ),
            );
          }
          const arch = new THREE.Mesh(
            new THREE.TubeGeometry(
              new THREE.CatmullRomCurve3(points),
              24,
              0.035,
              5,
              false,
            ),
            this.mat(0x8daeba, 0.55, 0.35),
          );
          arch.castShadow = true;
          g.add(arch);
          for (const side of [-1, 1]) {
            this.box(
              g,
              0.07,
              1.05,
              0.08,
              p.x + side * 0.74,
              0.5,
              p.z,
              0x779aaa,
            );
            this.box(
              g,
              0.025,
              0.45,
              0.04,
              p.x + side * 0.74,
              0.7,
              p.z + 0.05,
              0x88dafa,
              0x88dafa,
            );
          }
        }
    }
    if (m.index === 2) {
      for (const c of m.cells.values()) {
        if (
          c.name !== "中央气隙" ||
          !(c.x === 5 || c.x === 11 || c.y === 4 || c.y === 8)
        )
          continue;
        const p = this.pos(c.x, c.y);
        for (let i = 0; i < 3; i++) {
          const stripe = this.box(
            g,
            0.13,
            0.025,
            0.5,
            p.x - 0.38 + i * 0.36,
            -0.12,
            p.z,
            0xc49b52,
          );
          stripe.rotation.y = 0.65;
        }
      }
      for (const side of [-1, 1]) {
        const x = side * ((m.w * S) / 2 + 0.12),
          length = m.h * S * 0.8;
        const pipe = this.cyl(g, 0.13, 0.13, length, x, -0.7, 0, 0x706047, 12);
        pipe.rotation.x = Math.PI / 2;
        for (let i = -3; i <= 3; i++)
          this.torus(g, 0.17, 0.045, x, -0.7, i * 2.5, 0xb49865, true);
        for (const z of [-5, 5]) {
          this.box(g, 0.52, 0.2, 0.65, x, -0.95, z, 0x332f28);
          const valve = new THREE.Group();
          valve.position.set(x, -0.35, z);
          g.add(valve);
          this.torus(valve, 0.24, 0.025, 0, 0, 0, 0xcb914c);
          for (let i = 0; i < 3; i++) {
            const spoke = this.box(
              valve,
              0.46,
              0.025,
              0.035,
              0,
              0,
              0,
              0xcdaa6d,
            );
            spoke.rotation.y = (i * Math.PI) / 3;
          }
          this.ambientAnimations.push({
            mesh: valve,
            axis: "y",
            speed: side * 0.18,
          });
        }
      }
      for (const [x, y] of [
        [5, 4],
        [11, 4],
        [5, 8],
        [11, 8],
      ]) {
        const p = this.pos(x, y),
          beacon = this.glow(g, 0xffa553, p.x, 0.25, p.z, 0.65, 0.3);
        this.ambientAnimations.push({
          mesh: beacon,
          pulse: true,
          offset: x + y,
        });
      }
    }
  }
  server(g, type, index) {
    let height = 0.6 + type * 0.43,
      c = index === 2 ? 0x594d3b : 0x36524b;
    this.box(g, 1.22, 0.15, 1.22, 0, -0.25, 0, 0x203831);
    if (index === 2) {
      this.cyl(g, 0.38, 0.38, height, 0, height / 2 - 0.2, 0, c, 12);
      this.cyl(g, 0.42, 0.42, 0.12, 0, height - 0.13, 0, 0x84917a, 12);
      this.box(g, 0.12, 0.4, 0.12, 0, height, 0, 0x777f66);
      for (let j = 0; j < 3; j++)
        this.torus(g, 0.39, 0.02, 0, j * 0.24, 0, 0x82917c);
      this.box(g, 0.2, 0.35, 0.2, 0.5, 0.15, 0, 0xa39570);
      this.line(
        g,
        [
          [0.4, 0.4, 0],
          [0.6, 0.4, 0],
          [0.6, 0.05, 0],
        ],
        0xaaa88a,
      );
      return;
    }
    if (index === 1 && type > 0) {
      this.cyl(g, 0.32, 0.48, 0.55, 0, 0.1, 0, 0x506b79, 8);
      for (let x of [-0.25, 0.25])
        this.box(g, 0.075, 1.65, 0.075, x, 0.85, 0, 0x95b4c0);
      for (let j = 0; j < 5; j++)
        this.box(g, 0.55, 0.05, 0.06, 0, 0.35 + j * 0.3, 0, 0x7ba5b7);
      this.torus(g, 0.48, 0.045, 0, 1.55, 0, 0x79ceef, true);
      this.box(g, 0.08, 0.6, 0.08, 0, 1.95, 0, 0xb5dbda);
      this.glow(g, 0x74cdf5, 0, 2.3, 0, 1, 0.25);
      return;
    }
    for (let a of [-0.28, 0.28]) {
      this.box(g, 0.47, height, 0.8, a, height / 2 - 0.18, 0, c);
      this.box(
        g,
        0.41,
        height - 0.1,
        0.03,
        a,
        height / 2 - 0.18,
        0.42,
        0x152a28,
      );
      for (let j = 0; j < Math.floor(height / 0.16); j++) {
        this.box(g, 0.3, 0.035, 0.025, a, j * 0.15 - 0.08, 0.45, 0x5c7e6a);
        this.box(
          g,
          0.035,
          0.032,
          0.028,
          a - 0.13,
          j * 0.15 - 0.08,
          0.47,
          j % 3 === 0 ? 0xd1ac69 : 0x73b99a,
          j % 3 === 0 ? 0x70542c : 0x345d45,
        );
      }
    }
    this.box(g, 1, 0.06, 0.95, 0, height - 0.14, 0, 0x6c8576);
  }
  core(g) {
    this.cyl(g, 0.63, 0.75, 0.18, 0, 0.18, 0, 0x577265, 8);
    this.cyl(g, 0.46, 0.55, 0.65, 0, 0.58, 0, 0x3b5c50, 6);
    for (let i = 0; i < 4; i++) {
      let a = (i * Math.PI) / 2;
      this.box(
        g,
        0.2,
        1.6,
        0.2,
        Math.sin(a) * 0.45,
        1,
        Math.cos(a) * 0.45,
        0xc1c8ab,
      );
      this.box(
        g,
        0.065,
        1.4,
        0.065,
        Math.sin(a) * 0.45,
        1.1,
        Math.cos(a) * 0.45,
        0x92f4c9,
        0x72cba4,
      );
    }
    this.cyl(g, 0.51, 0.51, 0.12, 0, 1.86, 0, 0x91b497, 6);
    this.cyl(g, 0.23, 0.23, 1.2, 0, 1.12, 0, 0xa0f8cf, 6, 0x61d89f);
    this.torus(g, 0.68, 0.025, 0, 1.5, 0, 0x87deb0);
    this.torus(g, 0.8, 0.018, 0, 0.5, 0, 0x87deb0);
    this.glow(g, 0x6effbc, 0, 1, 0, 3.8, 0.3);
  }
  addLabel(text, p, cl, id) {
    let el = document.createElement("div");
    el.className = "world-label " + cl;
    el.textContent = text;
    document.getElementById("world-labels").appendChild(el);
    this.labels.push({ el, p, id, cl });
    return el;
  }
  buildTower(t, ghost = false) {
    let g = new THREE.Group(),
      c = this.game.cell(t.cell),
      y = c.type === "platform" ? 0.37 : 0.12;
    g.position.copy(this.pos(t.x, t.y, y));
    g.userData.entity = t;
    g.userData.baseY = y;
    let d = TOWERS[t.type] || { color: 0xffc16d },
      col = d.color,
      metal = 0xd1d9bc,
      dark = 0x244438;
    this.cyl(g, 0.53, 0.63, 0.14, 0, 0.08, 0, 0x668b72, 8);
    this.cyl(g, 0.46, 0.49, 0.12, 0, 0.2, 0, dark, 8);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      this.cyl(
        g,
        0.035,
        0.035,
        0.035,
        Math.sin(a) * 0.51,
        0.17,
        Math.cos(a) * 0.51,
        0xb9c8b7,
        6,
      );
    }
    for (let i = 0; i < t.level; i++)
      this.box(
        g,
        0.12,
        0.055,
        0.045,
        (i - (t.level - 1) / 2) * 0.18,
        0.27,
        0.5,
        col,
        col,
      );
    let animated = new THREE.Group();
    g.add(animated);
    g.userData.animated = animated;
    if (t.type === "firewall") {
      this.box(g, 1.05, 1.1, 0.42, 0, 0.83, 0, metal);
      this.box(g, 0.88, 0.87, 0.07, 0, 0.86, 0.26, dark);
      for (let x of [-0.3, 0, 0.3])
        this.box(g, 0.09, 0.72, 0.09, x, 0.88, 0.32, col, col);
      this.box(g, 1.18, 0.18, 0.56, 0, 1.43, 0, dark);
      for (let x of [-0.52, 0.52])
        this.box(g, 0.2, 1.3, 0.65, x, 0.75, 0, 0x63876d);
      this.box(animated, 0.36, 0.4, 0.12, 0, 0.85, 0.4, col, col);
      this.box(g, 1.1, 0.1, 0.08, 0, 0.38, 0.35, col, col);
    }
    if (t.type === "gate" || t.type === "isolate") {
      for (let x of [-0.44, 0.44]) {
        this.box(g, 0.22, 1.7, 0.36, x, 0.95, 0, metal);
        this.box(g, 0.05, 1.4, 0.4, x, 1, 0.02, col, col);
      }
      this.box(g, 1.12, 0.18, 0.42, 0, 1.8, 0, 0x6f967c);
      this.box(g, 0.82, 1.32, 0.08, 0, 0.98, 0, 0x1d5f49, col).material =
        this.mat(0x44c794, 0.3, 0.3, 0x267651, 0.28);
      for (let i = 0; i < 5; i++)
        this.box(
          animated,
          0.78,
          0.045,
          0.12,
          0,
          0.45 + i * 0.26,
          0.04,
          col,
          col,
        );
      this.box(g, 0.3, 0.12, 0.3, 0, 1.96, 0, col, col);
      if (t.type === "isolate") g.scale.setScalar(0.8);
    }
    if (t.type === "honey") {
      this.cyl(g, 0.42, 0.45, 0.55, 0, 0.59, 0, 0xbf9d66, 6);
      this.cyl(g, 0.49, 0.49, 0.12, 0, 0.94, 0, 0xe5c795, 6);
      this.cyl(g, 0.22, 0.22, 0.35, 0, 1.16, 0, 0xeac477, 6, col);
      this.torus(animated, 0.5, 0.025, 0, 1.3, 0, col);
      this.sphere(animated, 0.16, 0, 1.6, 0, col);
      for (let i = 0; i < 3; i++) {
        let a = (i * Math.PI * 2) / 3;
        this.box(
          g,
          0.12,
          0.4,
          0.12,
          Math.cos(a) * 0.39,
          0.58,
          Math.sin(a) * 0.39,
          dark,
        );
      }
    }
    if (t.type === "interceptor") {
      this.cyl(g, 0.3, 0.4, 0.55, 0, 0.49, 0, metal, 8);
      animated.position.y = 0.82;
      animated.rotation.y = t.dir;
      this.box(animated, 0.7, 0.35, 0.68, 0, 0.05, 0, 0x96b7a0);
      this.box(animated, 0.2, 0.23, 0.6, 0, 0.26, -0.1, dark);
      for (let x of [-0.25, 0.25]) {
        this.box(animated, 0.15, 0.17, 1.02, x, 0.13, 0.62, 0x445f55);
        this.box(animated, 0.18, 0.2, 0.12, x, 0.13, 1.13, col, col);
        this.box(animated, 0.21, 0.3, 0.37, x, 0.14, 0.1, 0xd0d7be);
      }
      this.box(animated, 0.12, 0.13, 0.7, 0, 0.35, 0.25, col, col);
      let fan = new THREE.Group();
      for (let i = 0; i < 3; i++)
        this.box(fan, 0.42, 0.05, 0.1, 0, 0.42 + i * 0.12, -0.24, dark);
      animated.add(fan);
    }
    if (t.type === "sandbox") {
      this.box(g, 0.8, 0.24, 0.8, 0, 0.4, 0, metal);
      for (let x of [-0.32, 0.32])
        for (let z of [-0.32, 0.32])
          this.box(g, 0.08, 0.9, 0.08, x, 0.9, z, metal);
      let cube = this.box(animated, 0.55, 0.55, 0.55, 0, 1, 0, col, col);
      cube.rotation.y = Math.PI / 4;
      this.box(g, 0.85, 0.12, 0.85, 0, 1.44, 0, 0x759d88);
      this.torus(animated, 0.58, 0.025, 0, 0.8, 0, col);
      this.glow(g, col, 0, 1, 0, 2, 0.3);
    }
    if (t.type === "repair") {
      this.cyl(g, 0.26, 0.36, 0.9, 0, 0.7, 0, metal, 8);
      animated.position.y = 1.27;
      this.box(animated, 0.7, 0.19, 0.2, 0, 0, 0, col, col);
      this.box(animated, 0.19, 0.7, 0.2, 0, 0, 0, col, col);
      this.box(animated, 0.2, 0.19, 0.7, 0, 0, 0, col, col);
      this.torus(g, 0.52, 0.025, 0, 0.72, 0, col);
      for (let a of [-1, 1]) {
        this.box(g, 0.18, 0.4, 0.24, a * 0.35, 0.64, 0, dark);
        this.glow(g, col, a * 0.45, 1, 0, 1.3, 0.3);
      }
    }
    if (t.level === 2) {
      this.torus(g, 0.62, 0.035, 0, 0.28, 0, col);
      for (let i = 0; i < 4; i++) {
        let a = (i * Math.PI) / 2;
        this.cyl(
          g,
          0.09,
          0.14,
          0.45,
          Math.sin(a) * 0.53,
          0.5,
          Math.cos(a) * 0.53,
          metal,
          5,
        );
        this.sphere(g, 0.07, Math.sin(a) * 0.53, 0.76, Math.cos(a) * 0.53, col);
      }
      if (t.type === "interceptor") {
        this.box(
          animated,
          t.branch === 0 ? 0.14 : 0.7,
          0.14,
          t.branch === 0 ? 1.25 : 0.18,
          0,
          0.45,
          0.5,
          t.branch === 0 ? 0xffd390 : 0xb9a1ff,
          t.branch === 0 ? 0xffd390 : 0xb9a1ff,
        );
      }
      if (t.type === "honey")
        this.torus(
          g,
          t.branch === 0 ? 0.75 : 0.45,
          0.055,
          0,
          1.8,
          0,
          t.branch === 0 ? 0x9ff7dd : 0xff8175,
        );
      if (t.type === "firewall") {
        for (const side of [-1, 1]) {
          const plate = this.box(
            g,
            0.28,
            1.13,
            0.2,
            side * 0.55,
            0.9,
            0.4,
            0xb6c4ac,
          );
          plate.rotation.z = side * -0.17;
          for (let i = 0; i < 3; i++)
            this.box(
              g,
              0.16,
              0.07,
              0.25,
              side * 0.6,
              0.62 + i * 0.18,
              -0.27,
              dark,
            );
        }
        this.box(animated, 0.16, 0.15, 0.45, 0, 1.5, 0.17, col, col);
      }
      if (t.type === "gate") {
        for (const side of [-1, 1]) {
          this.box(g, 0.28, 0.42, 0.38, side * 0.53, 1.61, 0, dark);
          this.cyl(g, 0.08, 0.1, 0.34, side * 0.53, 1.95, 0, col, 6, col);
        }
      }
      if (t.type === "sandbox") {
        this.torus(animated, 0.66, 0.035, 0, 1.2, 0, col, true);
        this.box(g, 0.25, 0.28, 0.35, 0.48, 0.64, 0, dark);
        this.box(g, 0.04, 0.14, 0.23, 0.62, 0.66, 0, col, col);
      }
      if (t.type === "repair") {
        const satellites = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const angle = (i * Math.PI * 2) / 3;
          this.box(
            satellites,
            0.23,
            0.13,
            0.3,
            Math.sin(angle) * 0.7,
            1.1,
            Math.cos(angle) * 0.7,
            metal,
          );
          this.sphere(
            satellites,
            0.055,
            Math.sin(angle) * 0.7,
            1.21,
            Math.cos(angle) * 0.7,
            col,
            0,
          );
        }
        g.add(satellites);
        g.userData.satellites = satellites;
      }
    }
    if (ghost) {
      const color = this.game.canPlace(t.type, t.cell) ? 0xff877d : 0xaaf7dd;
      g.traverse((mesh) => {
        if (mesh.isMesh) {
          mesh.material = this.mat(color, 0.1, 0.4, color, 0.32);
          mesh.castShadow = false;
        }
        if (mesh.isSprite) mesh.visible = false;
      });
      this.previewGroup.add(g);
      return g;
    }
    this.addHealth(g, t, 2.25, col);
    let shield = this.sphere(g, 0.9, 0, 1, 0, 0x85e1ff, 1);
    shield.material = new THREE.MeshBasicMaterial({
      color: 0x6cddf0,
      transparent: true,
      opacity: 0.13,
      wireframe: true,
    });
    shield.visible = false;
    g.userData.shield = shield;
    let encrypt = this.torus(g, 0.65, 0.06, 0, 1.6, 0, 0xca79ff);
    encrypt.visible = false;
    g.userData.encrypt = encrypt;
    g.userData.kind = t.type;
    g.userData.level = t.level;
    this.dynamic.add(g);
    this.meshes.set(t.id, g);
    return g;
  }
  addHealth(g, obj, y, col) {
    let hg = new THREE.Group();
    hg.position.y = y;
    let bg = new THREE.Mesh(
      this.geom("PlaneGeometry", [0.92, 0.08]),
      new THREE.MeshBasicMaterial({ color: 0x0b1d16, depthTest: false }),
    );
    hg.add(bg);
    let bar = new THREE.Mesh(
      this.geom("PlaneGeometry", [0.86, 0.04]),
      new THREE.MeshBasicMaterial({ color: col, depthTest: false }),
    );
    bar.position.z = 0.005;
    hg.add(bar);
    let state = new THREE.Mesh(
      this.geom("PlaneGeometry", [0.86, 0.025]),
      new THREE.MeshBasicMaterial({ color: 0x89dafa, depthTest: false }),
    );
    state.position.set(0, -0.08, 0.005);
    hg.add(state);
    g.add(hg);
    g.userData.health = { group: hg, bar, state };
  }
  buildEnemy(e) {
    let g = new THREE.Group(),
      d = ENEMIES[e.type],
      col = d.color,
      parts = [];
    g.userData.entity = e;
    let body = new THREE.Group();
    g.add(body);
    g.userData.body = body;
    let scale = d.boss ? 1.75 : 1;
    g.userData.size = scale;
    if (e.type === "worm") {
      for (let i = 0; i < 4; i++) {
        let seg = new THREE.Group();
        seg.position.set(0, 0.26, -i * 0.19);
        this.sphere(
          seg,
          0.2 - i * 0.022,
          0,
          0,
          0,
          i === 0 ? 0xffa080 : 0xcb5747,
          0,
        );
        for (let s of [-1, 1]) {
          let leg = this.box(
            seg,
            0.28,
            0.055,
            0.055,
            s * 0.22,
            -0.12,
            0,
            0xf4a17c,
          );
          leg.rotation.z = s * 0.35;
        }
        body.add(seg);
        parts.push(seg);
      }
      this.box(body, 0.24, 0.05, 0.09, 0, 0.32, 0.18, 0xffeab5, 0xffc282);
    }
    if (e.type === "flood" || e.type === "boss0") {
      this.box(body, 0.73, 0.5, 0.67, 0, 0.43, 0, 0x873e2c);
      this.box(body, 0.85, 0.16, 0.76, 0, 0.76, 0, 0xeea06e);
      this.cyl(body, 0.3, 0.38, 0.24, 0, 0.97, 0, 0xf4b77b, 6);
      for (let x of [-0.48, 0.48]) {
        let arm = new THREE.Group();
        arm.position.set(x, 0.5, 0.06);
        this.box(arm, 0.25, 0.36, 0.43, 0, 0, 0.1, 0xc86c45);
        this.box(arm, 0.28, 0.15, 0.18, 0, -0.05, 0.41, 0xffa65b, 0xf56c39);
        body.add(arm);
        parts.push(arm);
      }
      for (let z of [-0.3, 0.3])
        for (let x of [-0.29, 0.29]) {
          let leg = this.box(body, 0.18, 0.3, 0.2, x, 0.16, z, 0x543f34);
          parts.push(leg);
        }
      this.box(body, 0.5, 0.12, 0.06, 0, 0.65, 0.42, 0xffd8a1, 0xffa161);
      if (e.type === "boss0") {
        for (let i = 0; i < 5; i++) {
          let a = (i * 2 * Math.PI) / 5;
          this.sphere(
            body,
            0.16,
            Math.cos(a) * 0.6,
            1.3,
            Math.sin(a) * 0.6,
            0xffa56d,
            0,
          );
          this.line(
            body,
            [
              [0, 0.8, 0],
              [Math.cos(a) * 0.6, 1.3, Math.sin(a) * 0.6],
            ],
            0xffae73,
          );
        }
        this.torus(body, 0.7, 0.04, 0, 1.3, 0, 0xffa56f);
      }
    }
    if (e.type === "trojan") {
      this.box(body, 0.6, 0.5, 0.6, 0, 0.45, 0, 0x92b5a6);
      this.box(body, 0.65, 0.06, 0.65, 0, 0.72, 0, 0xc6d5c1);
      this.box(body, 0.1, 0.52, 0.63, 0, 0.46, 0, 0x486c5b);
      this.box(body, 0.63, 0.52, 0.1, 0, 0.46, 0, 0x486c5b);
      let head = this.sphere(body, 0.19, 0, 0.93, 0, col, 0);
      parts.push(head);
      for (let x of [-0.28, 0.28]) {
        let leg = this.box(body, 0.15, 0.22, 0.12, x, 0.14, 0.15, 0x78947d);
        parts.push(leg);
      }
    }
    if (e.type === "ransom") {
      this.cyl(body, 0.16, 0.36, 0.65, 0, 0.54, 0, 0x644572, 5);
      this.sphere(body, 0.23, 0, 1, 0, 0xc88bf0, 0);
      this.box(body, 0.34, 0.08, 0.08, 0, 1.02, 0.2, 0xffbdde, 0xffbdde);
      for (let x of [-0.35, 0.35]) {
        let arm = this.box(body, 0.12, 0.44, 0.14, x, 0.65, 0, 0xb882d3);
        arm.rotation.z = x;
        parts.push(arm);
      }
      let staff = this.box(
        body,
        0.06,
        0.9,
        0.06,
        0.43,
        0.69,
        0.15,
        0xf5c5ff,
        0xd796ff,
      );
      parts.push(staff);
      this.torus(body, 0.2, 0.03, 0.43, 1.18, 0.15, 0xf2a4ff, true);
    }
    if (e.type === "flyer") {
      this.sphere(body, 0.24, 0, 0, 0, 0xe676ac, 0);
      for (let side of [-1, 1]) {
        let wing = new THREE.Group();
        wing.position.x = side * 0.2;
        let mesh = this.box(
          wing,
          0.65,
          0.065,
          0.32,
          side * 0.25,
          0,
          -0.1,
          0xee91b4,
        );
        mesh.rotation.y = side * 0.4;
        this.box(
          wing,
          0.35,
          0.025,
          0.06,
          side * 0.23,
          0.05,
          0,
          0xffcedb,
          0xffcedb,
        );
        body.add(wing);
        parts.push(wing);
      }
      this.torus(body, 0.42, 0.02, 0, 0.1, 0, 0xffb2d3);
      this.glow(body, col, 0, 0, 0, 1.4, 0.3);
    }
    if (e.type === "shell") {
      this.cyl(body, 0.43, 0.5, 0.28, 0, 0.32, 0, 0x937ea9, 6);
      this.sphere(body, 0.36, 0, 0.77, 0, 0xa695d0, 1);
      for (let i = 0; i < 3; i++) {
        let ring = this.torus(body, 0.43, 0.025, 0, 0.78, 0, 0xd4c3fa);
        ring.rotation.set((i * Math.PI) / 3, 0, i);
        parts.push(ring);
      }
      for (let x of [-0.3, 0.3])
        this.box(body, 0.15, 0.22, 0.4, x, 0.14, 0, 0x5d5073);
    }
    if (e.type === "boss1") {
      this.cyl(body, 0.12, 0.68, 1.2, 0, 0.8, 0, 0x7d559f, 5);
      let crystal = this.sphere(body, 0.55, 0, 1.5, 0, 0xbc8ef7, 0);
      crystal.scale.y = 1.5;
      parts.push(crystal);
      for (let i = 0; i < 3; i++) {
        let r = this.torus(body, 0.8, 0.035, 0, 1, 0, 0xc89bff);
        r.rotation.set(i * 0.7, 0.3, i * 0.5);
        parts.push(r);
      }
      for (let x of [-0.65, 0.65])
        this.sphere(body, 0.2, x, 0.6, 0.2, 0xebb8ff, 0);
      this.glow(body, col, 0, 1, 0, 3, 0.3);
    }
    if (e.type === "boss2") {
      this.cyl(body, 0.19, 0.5, 0.8, 0, 0.8, 0, 0x67404e, 5);
      this.sphere(body, 0.3, 0, 1.5, 0.05, 0xf486a4, 0);
      this.box(body, 0.33, 0.07, 0.12, 0, 1.53, 0.29, 0xffd8d8, 0xff92a5);
      for (let i = 0; i < 6; i++) {
        let a = (i * Math.PI) / 3,
          arm = new THREE.Group();
        arm.position.set(Math.cos(a) * 0.35, 0.8, Math.sin(a) * 0.35);
        let leg = this.box(
          arm,
          0.12,
          0.8,
          0.12,
          Math.cos(a) * 0.26,
          -0.1,
          Math.sin(a) * 0.26,
          0xc17f93,
        );
        leg.rotation.z = Math.cos(a) * 0.8;
        leg.rotation.x = Math.sin(a) * 0.8;
        this.sphere(
          arm,
          0.1,
          Math.cos(a) * 0.5,
          -0.38,
          Math.sin(a) * 0.5,
          0xffa6b9,
          0,
        );
        body.add(arm);
        parts.push(arm);
      }
      this.torus(body, 0.5, 0.04, 0, 1.6, 0, 0xff87b6);
      this.glow(body, col, 0, 1, 0, 2, 0.3);
    }
    if (d.boss && e.phase > 0) {
      for (let i = 0; i < 4; i++) {
        let a = (i * Math.PI) / 2;
        let plate = this.box(
          body,
          0.3,
          0.45,
          0.15,
          Math.sin(a) * 0.43,
          1.02,
          Math.cos(a) * 0.43,
          e.type === "boss2" ? 0xc8a7b1 : 0xc2b1cb,
        );
        plate.rotation.y = a;
        parts.push(plate);
      }
      this.torus(body, 0.69, 0.035, 0, 1.5, 0, col);
    }
    body.scale.setScalar(scale * (1 + (e.phase || 0) * 0.045));
    g.userData.parts = parts;
    this.addHealth(g, e, d.boss ? 3.5 : e.type === "flyer" ? 0.65 : 1.5, col);
    let shield = new THREE.Mesh(
      this.geom("IcosahedronGeometry", [0.75 * scale, 1]),
      new THREE.MeshBasicMaterial({
        color: 0xaebdff,
        wireframe: true,
        transparent: true,
        opacity: 0.22,
      }),
    );
    shield.position.y = 0.55;
    shield.visible = false;
    g.add(shield);
    g.userData.shield = shield;
    g.position.copy(this.pos(e.x, e.y, e.type === "flyer" ? 2.8 : 0.12));
    const status = this.torus(g, 0.48 * scale, 0.025, 0, 0.08, 0, 0xffce80);
    status.visible = false;
    g.userData.status = status;
    this.dynamic.add(g);
    this.meshes.set(e.id, g);
    return g;
  }
  updateRoutes(preview = null) {
    let group = preview ? this.previewGroup : this.routeGroup;
    this.clear(group);
    if (!this.game) return;
    let routes = preview ? preview.routes : this.game.routes;
    this.routeSegments = [];
    Object.entries(routes).forEach(([key, route], i) => {
      if (!route) return;
      let color = preview
        ? 0xf7ecaa
        : this.map.entries.find((e) => e.id === key).color;
      let offset = (i - (this.map.entries.length - 1) / 2) * 0.12,
        points = route.cells.map((id) => {
          let c = this.game.cell(id),
            p = this.pos(c.x, c.y, 0.34 + (preview ? 0.13 : 0));
          return [p.x + offset, p.y, p.z + offset];
        });
      this.line(group, points, color, preview ? 0.95 : 0.9, !!preview);
      if (!preview) {
        const railMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.65,
          toneMapped: false,
          depthWrite: false,
        });
        for (let j = 1; j < points.length; j++) {
          let a = new THREE.Vector3(...points[j - 1]),
            b = new THREE.Vector3(...points[j]),
            len = a.distanceTo(b);
          let rail = new THREE.Mesh(
            this.geom("BoxGeometry", [0.037, 0.016, len]),
            railMat,
          );
          rail.position.copy(a).lerp(b, 0.5);
          rail.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
          group.add(rail);
        }
      }
      for (let j = 1; j < points.length; j += 3) {
        let a = points[j - 1],
          b = points[j],
          dx = b[0] - a[0],
          dz = b[2] - a[2];
        let arrow = new THREE.Mesh(
          this.geom("ConeGeometry", [0.075, 0.25, 3]),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: preview ? 0.8 : 0.65,
          }),
        );
        arrow.position.set(b[0], b[1] + 0.02, b[2]);
        arrow.rotation.x = Math.PI / 2;
        arrow.rotation.z = -Math.atan2(dx, dz);
        group.add(arrow);
      }
      if (!preview) {
        for (let j = 0; j < 3; j++) {
          let p = this.sphere(group, 0.055, 0, 0, 0, color, 0);
          p.userData.packet = { route: points, offset: j / 3 };
        }
      }
    });
    this.routeGroup.visible = this.showRoutes;
  }
  preview(id, kind, dir = 0, pending = false) {
    this.clear(this.previewGroup);
    if (!id) return;
    let c = this.game.cell(id);
    if (!c) return;
    let range = TOWERS[kind]?.range || ITEMS[kind]?.range || 0.7;
    let error = this.game.canPlace(kind, id),
      color = error ? 0xf8756e : 0x9df5cb;
    let change =
      (c.type === "node" && ["gate", "firewall", "isolate"].includes(kind)) ||
      kind === "downgrade";
    let preview = change ? this.game.preview(id, kind) : null;
    if (preview) this.updateRoutes(preview);
    for (const blockedId of preview?.invalidCells || []) {
      const c = this.game.cell(blockedId),
        p = this.pos(c.x, c.y);
      this.torus(this.previewGroup, 0.7, 0.06, p.x, 0.65, p.z, 0xff6b77);
      this.line(
        this.previewGroup,
        [
          [p.x - 0.4, 0.7, p.z - 0.4],
          [p.x + 0.4, 0.7, p.z + 0.4],
        ],
        0xff6b77,
      );
      this.line(
        this.previewGroup,
        [
          [p.x - 0.4, 0.7, p.z + 0.4],
          [p.x + 0.4, 0.7, p.z - 0.4],
        ],
        0xff6b77,
      );
    }
    let p = this.pos(c.x, c.y, 0.42);
    let circle = this.torus(
      this.previewGroup,
      Math.max(0.68, range * S),
      0.025,
      p.x,
      0.38,
      p.z,
      color,
    );
    circle.visible = kind !== "interceptor";
    let face = new THREE.Mesh(
      this.geom(
        "CircleGeometry",
        kind === "interceptor"
          ? [
              range * S,
              64,
              dir - Math.PI / 2 - (Math.PI * 4) / 9,
              (Math.PI * 8) / 9,
            ]
          : [Math.max(0.68, range * S), 64],
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    face.rotation.x = -Math.PI / 2;
    face.position.set(p.x, 0.33, p.z);
    this.previewGroup.add(face);
    this.box(
      this.previewGroup,
      1.4,
      0.07,
      1.4,
      p.x,
      0.35,
      p.z,
      color,
      color,
    ).material = this.mat(color, 0.2, 0.5, color, 0.22);
    if (kind === "interceptor") {
      let a1 = dir - (Math.PI * 4) / 9,
        a2 = dir + (Math.PI * 4) / 9;
      const arc = [];
      for (let i = 0; i <= 40; i++) {
        const a = a1 + ((a2 - a1) * i) / 40;
        arc.push([
          p.x + Math.sin(a) * range * S,
          0.48,
          p.z + Math.cos(a) * range * S,
        ]);
      }
      this.line(this.previewGroup, arc, color, 0.8);
      for (let a of [a1, a2])
        this.line(
          this.previewGroup,
          [
            [p.x, 0.48, p.z],
            [
              p.x + Math.sin(a) * range * S,
              0.48,
              p.z + Math.cos(a) * range * S,
            ],
          ],
          color,
          0.8,
        );
      this.line(
        this.previewGroup,
        [
          [p.x, 0.5, p.z],
          [
            p.x + Math.sin(dir) * range * S,
            0.5,
            p.z + Math.cos(dir) * range * S,
          ],
        ],
        0xffffff,
        0.8,
        true,
      );
    }
    if (TOWERS[kind] || kind === "isolate")
      this.buildTower(
        { id: -1, type: kind, cell: id, x: c.x, y: c.y, level: 1, dir },
        true,
      );
    this.previewState = { id, kind, error, preview, dir };
    return this.previewState;
  }
  clearPreview() {
    this.clear(this.previewGroup);
    this.previewState = null;
  }
  effectLine(a, b, color, life = 0.25, kind = "line") {
    let g = new THREE.Group();
    this.fx.add(g);
    const curve =
      kind === "sandbox" || kind === "heal"
        ? new THREE.QuadraticBezierCurve3(
            a,
            a
              .clone()
              .lerp(b, 0.5)
              .add(new THREE.Vector3(0, kind === "sandbox" ? 2 : 0.5, 0)),
            b,
          )
        : null;
    const trajectory =
      kind === "ransom"
        ? Array.from({ length: 9 }, (_, i) => {
            const p = a.clone().lerp(b, i / 8);
            if (i > 0 && i < 8) {
              p.y += Math.sin(i * 4.2) * 0.14;
              p.x += Math.cos(i * 2.5) * 0.1;
            }
            return [p.x, p.y, p.z];
          })
        : curve
          ? curve.getPoints(16).map((p) => [p.x, p.y, p.z])
          : [
              [a.x, a.y, a.z],
              [b.x, b.y, b.z],
            ];
    const trail = this.line(g, trajectory, color, 0.9);
    this.glow(g, color, b.x, b.y, b.z, 0.8, 0.5);
    let dot = this.sphere(
      g,
      kind === "sandbox" ? 0.13 : 0.065,
      a.x,
      a.y,
      a.z,
      color,
      0,
    );
    if (kind === "sandbox") {
      dot.geometry = this.geom("OctahedronGeometry", [0.14, 0]);
      this.glow(g, color, a.x, a.y, a.z, 0.5, 0.3).userData.follow = dot;
    }
    this.effects.push({
      group: g,
      life,
      max: life,
      kind: "beam",
      a,
      b,
      dot,
      curve,
      trail,
      weapon: kind,
    });
  }
  combatText(t, text, color) {
    if ((t.lastCombatText || -1) > this.game.time - 0.55) return;
    t.lastCombatText = this.game.time;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");
    ctx.font = "bold 27px Segoe UI, Microsoft YaHei";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#08151b";
    ctx.strokeText(text, 64, 24);
    ctx.fillStyle = color;
    ctx.fillText(text, 64, 24);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas),
        depthTest: false,
        depthWrite: false,
      }),
    );
    sprite.scale.set(1.7, 0.64, 1);
    sprite.position.copy(this.pos(t.x, t.y, 2.7));
    this.fx.add(sprite);
    this.effects.push({
      group: sprite,
      kind: "text",
      life: 0.9,
      max: 0.9,
      baseY: 2.7,
    });
  }
  burst(x, y, color, range = 1, life = 0.5) {
    let g = new THREE.Group(),
      p = this.pos(x, y, 0.25);
    g.position.copy(p);
    let ring = this.torus(g, 1, 0.025, 0, 0, 0, color);
    this.glow(g, color, 0, 0.25, 0, range * 2, 0.3);
    let shards = [];
    for (let i = 0; i < 6; i++) {
      let a = (i * Math.PI) / 3 + this.game.time;
      let shard = this.box(g, 0.055, 0.055, 0.16, 0, 0.15, 0, color, color);
      shards.push({
        mesh: shard,
        v: new THREE.Vector3(
          Math.cos(a) * range,
          1.1 + (i % 3) * 0.2,
          Math.sin(a) * range,
        ),
      });
    }
    this.fx.add(g);
    this.effects.push({
      group: g,
      life,
      max: life,
      kind: "burst",
      range: range * S,
      ring,
      shards,
    });
  }
  event(type, d) {
    if (type === "topology") {
      this.updateRoutes();
      for (let l of this.labels.filter((l) => l.id)) {
        let c = this.game.cell(l.id),
          closed = this.game.blocked().has(l.id);
        l.el.classList.toggle("isolated", closed);
        l.el.textContent = c.name + " · " + (closed ? "隔离" : "直通");
        const ring = this.tileMeshes.get(l.id)?.userData.nodeRing;
        if (ring)
          ring.material = this.mat(
            closed ? 0xffb673 : 0x89e9bf,
            0.4,
            0.3,
            closed ? 0xe18b38 : 0x64ce9e,
          );
      }
    }
    if (type === "build") {
      this.buildTower(d.tower);
      this.burst(d.tower.x, d.tower.y, 0x8ff7ca, 1, 0.6);
    }
    if (type === "upgrade") {
      let old = this.meshes.get(d.tower.id);
      if (old) {
        this.dynamic.remove(old);
        this.dispose(old);
      }
      this.meshes.delete(d.tower.id);
      this.buildTower(d.tower);
      this.burst(d.tower.x, d.tower.y, 0xb7f9d4, 1.2, 0.6);
    }
    if (type === "spawn") {
      this.buildEnemy(d.enemy);
      if (ENEMIES[d.enemy.type].boss)
        this.burst(d.enemy.x, d.enemy.y, ENEMIES[d.enemy.type].color, 2.4, 1.3);
    }
    if (type === "attack") {
      let a = this.pos(d.from.x, d.from.y, 1.4),
        b = this.pos(d.to.x, d.to.y, d.to.type === "flyer" ? 2.8 : 0.5);
      if (d.kind === "interceptor") {
        const angle =
          this.meshes.get(d.from.id)?.userData.animated.rotation.y ??
          d.from.dir;
        a.x += Math.sin(angle) * 1.05;
        a.z += Math.cos(angle) * 1.05;
        this.glow(this.fx, TOWERS[d.kind].color, a.x, a.y, a.z, 0.4, 0.6);
        const muzzle = this.fx.children[this.fx.children.length - 1];
        this.effects.push({
          group: muzzle,
          kind: "flash",
          life: 0.08,
          max: 0.08,
        });
        if (d.from.level === 2 && d.from.branch === 0) {
          const extension = b
            .clone()
            .sub(a)
            .normalize()
            .multiplyScalar((TOWERS.interceptor.range + 0.65) * S);
          b = a.clone().add(extension);
        }
      }
      this.effectLine(
        a,
        b,
        TOWERS[d.kind].color,
        d.kind === "sandbox" ? 0.4 : 0.16,
        d.kind,
      );
    }
    if (type === "enemyAttack") {
      const heavy = d.from.type === "flood" || ENEMIES[d.from.type]?.boss;
      this.effectLine(
        this.pos(d.from.x, d.from.y, 0.7),
        this.pos(d.to.x, d.to.y, 1),
        d.from.type === "ransom" ? 0xe6a4ff : heavy ? 0xffbc78 : 0xff8b88,
        heavy ? 0.35 : 0.22,
        d.from.type === "ransom" ? "ransom" : "melee",
      );
      this.burst(
        d.to.x,
        d.to.y,
        d.shieldDamage > 0 ? 0x89dfff : 0xff947d,
        heavy ? 0.65 : 0.3,
        0.3,
      );
      if (heavy || this.selected?.id === d.to.id)
        this.combatText(
          d.to,
          d.healthDamage > 0
            ? "−" + Math.round(d.healthDamage)
            : "护盾 −" + Math.round(d.shieldDamage),
          d.healthDamage > 0 ? "#ffac91" : "#94dff8",
        );
    }
    if (type === "heal") {
      this.effectLine(
        this.pos(d.from.x, d.from.y, 1.7),
        this.pos(d.to.x, d.to.y, 1),
        0x91f7a6,
        0.3,
        "heal",
      );
      if (this.selected?.id === d.to.id && d.amount > 0)
        this.combatText(d.to, "+" + Math.round(d.amount), "#a5ffca");
    }
    if (type === "shield") this.burst(d.enemy.x, d.enemy.y, 0xabb9ff, 2.1, 0.7);
    if (type === "kill")
      this.burst(d.enemy.x, d.enemy.y, ENEMIES[d.enemy.type].color, 0.5, 0.4);
    if (type === "towerLost")
      this.burst(d.tower.x, d.tower.y, 0xffba80, 1.2, 0.7);
    if (type === "burst") this.burst(d.x, d.y, d.color, d.range);
    if (type === "skill")
      this.burst(
        d.x,
        d.y,
        d.kind === "downgrade"
          ? 0xd8aa63
          : d.kind === "sandbox"
            ? 0xb997ff
            : 0x98f8be,
        d.range,
        0.9,
      );
    if (type === "bossPhase") {
      const old = this.meshes.get(d.enemy.id);
      if (old) {
        this.dynamic.remove(old);
        this.dispose(old);
        this.meshes.delete(d.enemy.id);
      }
      this.buildEnemy(d.enemy);
      this.burst(d.enemy.x, d.enemy.y, ENEMIES[d.enemy.type].color, 3, 1.2);
    }
  }
  sync(dt) {
    let time = this.game?.time || 0,
      entities = [...this.game.towers, ...this.game.enemies],
      alive = new Set(entities.map((e) => e.id));
    for (const a of this.ambientAnimations || []) {
      if (a.pulse)
        a.mesh.material.opacity =
          0.15 + (Math.sin(time * 2 + a.offset) + 1) * 0.12;
      else a.mesh.rotation[a.axis] = time * a.speed;
    }
    for (let [id, g] of this.meshes) {
      if (!alive.has(id)) {
        let e = g.userData.entity;
        if (!g.userData.dying) {
          g.userData.dying = 0.45;
        }
        g.userData.dying -= dt;
        g.position.y -= dt * 0.7;
        g.rotation.z += dt * 1.5;
        g.scale.multiplyScalar(Math.max(0.01, 1 - dt * 4));
        if (g.userData.dying <= 0) {
          this.dynamic.remove(g);
          this.dispose(g);
          this.meshes.delete(id);
        }
        continue;
      }
      let e = g.userData.entity;
      if (g.userData.health) {
        let h = g.userData.health;
        h.group.quaternion.copy(this.camera.quaternion);
        let f = Math.max(0, e.hp / e.maxHp);
        h.bar.scale.x = f;
        h.bar.position.x = (f - 1) * 0.43;
        h.state.visible = e.shield > 0 || e.encrypted > 0;
        h.state.material.color.setHex(e.encrypted > 0 ? 0xc88bff : 0x7be6f2);
        h.group.visible =
          !this.home &&
          (e.hp < e.maxHp ||
            e.shield > 0 ||
            e.encrypted > 0 ||
            !!ENEMIES[e.type] ||
            this.selected?.id === e.id);
      }
      g.userData.shield.visible = e.shield > 0;
      g.userData.shield.rotation.y = time * 0.7;
      if (g.userData.encrypt) {
        g.userData.encrypt.visible = e.encrypted > 0;
        g.userData.encrypt.rotation.z = Math.sin(time * 3) * 0.15;
      }
      if (e.hit > 0) {
        g.rotation.x = Math.sin(e.hit * 40) * 0.05;
      } else g.rotation.x = 0;
      if (ENEMIES[e.type]) {
        let fly = e.type === "flyer",
          height = fly ? 2.8 : 0.14;
        g.position.copy(this.pos(e.x, e.y, height));
        let body = g.userData.body;
        let target = e.attacking > 0 ? e.attackAngle : e.angle || 0;
        let diff =
          ((target - body.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        body.rotation.y += diff * Math.min(1, dt * 12);
        body.position.y = fly
          ? Math.sin(time * 5 + e.id) * 0.15
          : Math.sin(e.age * 9) * 0.035;
        const recoil =
          e.attacking > 0
            ? Math.sin((1 - e.attacking / 0.32) * Math.PI) * 0.16
            : 0;
        body.position.x = Math.sin(target) * recoil;
        body.position.z = Math.cos(target) * recoil;
        if (g.userData.status) {
          const status = g.userData.status;
          status.visible =
            e.root > 0 ||
            e.slow > 0 ||
            !!e.block ||
            (e.reveal > 0 && (e.type === "trojan" || e.type === "boss2"));
          status.material = this.mat(
            e.root > 0 ? 0xffcf82 : e.block ? 0xff9379 : 0x8ddff5,
            0.3,
            0.4,
            0x395d58,
          );
          status.scale.setScalar(1 + Math.sin(time * 6) * 0.06);
        }
        let parts = g.userData.parts;
        parts.forEach((p, i) => {
          if (e.type === "worm")
            p.position.x = Math.sin(e.age * 8 - i * 0.7) * 0.085;
          else if (fly)
            p.rotation.z = Math.sin(time * 16) * 0.25 * (i % 2 ? 1 : -1);
          else if (e.type === "shell" || e.type === "boss1")
            p.rotation.y = time * (i + 1) * 0.4;
          else {
            p.rotation.x = Math.sin(e.age * 7 + (i * Math.PI) / 2) * 0.17;
          }
        });
        if (e.type === "trojan") {
          let revealed = e.reveal > 0;
          body.children[0].material = this.mat(
            revealed ? 0xc75f8e : 0x92b5a6,
            0.4,
            0.4,
          );
          parts[0].visible = revealed;
        }
        if (e.type === "boss2") body.visible = true;
        if (e.type === "boss2" && e.phase === 2)
          body.rotation.z = Math.sin(time * 7) * 0.08;
      } else {
        let a = g.userData.animated;
        if (g.userData.satellites)
          g.userData.satellites.rotation.y = time * 0.75;
        if (e.type === "interceptor") {
          const aim = e.firing > 0 ? (e.aim ?? e.dir) : e.dir;
          const diff =
            ((aim - a.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          a.rotation.y += diff * Math.min(1, dt * 16);
          const recoil = e.firing > 0 ? Math.sin(e.firing * 15) * 0.1 : 0;
          a.position.x = -Math.sin(a.rotation.y) * recoil;
          a.position.z = -Math.cos(a.rotation.y) * recoil;
          e.firing = Math.max(0, (e.firing || 0) - dt);
        }
        if (e.type === "sandbox") a.rotation.y = time * 0.65;
        if (e.type === "repair") a.rotation.y = Math.sin(time) * 0.25;
        if (e.type === "honey") a.rotation.y = time * 0.8;
        if (e.type === "gate") a.position.y = Math.sin(time * 2) * 0.04;
        if (e.type === "firewall") {
          a.position.z = e.firing > 0 ? Math.sin(e.firing * 15) * 0.09 : 0;
          e.firing = Math.max(0, (e.firing || 0) - dt);
        }
      }
    }
    for (let child of this.routeGroup.children) {
      let p = child.userData.packet;
      if (p) {
        let n = p.route.length - 1,
          f = ((time * 0.11 + p.offset) % 1) * n,
          i = Math.floor(f);
        if (i >= 0 && i < n) {
          let a = p.route[i],
            b = p.route[i + 1];
          child.position.set(
            a[0] + (b[0] - a[0]) * (f - i),
            a[1] + 0.05,
            a[2] + (b[2] - a[2]) * (f - i),
          );
        }
      }
    }
    for (let p of this.particles) {
      let f = (time * p.speed + p.offset) % p.len;
      p.mesh.position.x = p.x + f;
    }
    for (let fx of this.effects) {
      fx.life -= dt;
      let f = 1 - fx.life / fx.max;
      if (fx.kind === "burst") {
        fx.ring.scale.setScalar(0.15 + f * fx.range);
        fx.shards?.forEach(({ mesh, v }) => {
          mesh.position.copy(v).multiplyScalar(f);
          mesh.position.y += 0.15 - f * f;
          mesh.rotation.x = f * 5;
          mesh.rotation.z = f * 3;
          mesh.scale.setScalar(Math.max(0.01, 1 - f));
        });
        fx.group.children.forEach((c) => {
          if (c.material?.transparent) c.material.opacity = (1 - f) * 0.4;
        });
      }
      if (fx.kind === "beam") {
        if (fx.curve)
          fx.dot.position.copy(fx.curve.getPoint(Math.min(1, f * 2)));
        else fx.dot.position.lerpVectors(fx.a, fx.b, Math.min(1, f * 3));
        fx.dot.rotation.y = f * 7;
        fx.trail.material.opacity = (1 - f) * 0.85;
        for (const child of fx.group.children)
          if (child.userData.follow)
            child.position.copy(child.userData.follow.position);
      }
      if (fx.kind === "text") {
        fx.group.position.y = fx.baseY + f * 0.75;
        fx.group.material.opacity = 1 - f * f;
      }
      if (fx.kind === "flash") {
        fx.group.material.opacity = (1 - f) * 0.6;
      }
      if (fx.life <= 0) {
        this.fx.remove(fx.group);
        this.dispose(fx.group);
      }
    }
    this.effects = this.effects.filter((f) => f.life > 0);
    this.drawEngagements();
    this.drawHazards(time);
    this.drawSelection();
    this.projectLabels();
  }
  drawEngagements() {
    let count = 0;
    for (const e of this.game.enemies) {
      if (e.dead || !e.block || this.home) continue;
      const t = this.game.towers.find((t) => t.id === e.block && !t.dead);
      if (!t) continue;
      let line = this.engagementGroup.children[count++];
      if (!line) {
        line = new THREE.Line(
          new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.Float32BufferAttribute(new Float32Array(6), 3),
          ),
          new THREE.LineDashedMaterial({
            color: 0xffb27b,
            transparent: true,
            opacity: 0.8,
            dashSize: 0.12,
            gapSize: 0.08,
            depthWrite: false,
          }),
        );
        this.engagementGroup.add(line);
      }
      const a = this.pos(e.x, e.y, 0.65),
        b = this.pos(t.x, t.y, 1.05);
      const positions = line.geometry.attributes.position;
      positions.setXYZ(0, a.x, a.y, a.z);
      positions.setXYZ(1, b.x, b.y, b.z);
      positions.needsUpdate = true;
      line.geometry.computeBoundingSphere();
      line.computeLineDistances();
      line.visible = true;
    }
    for (let i = count; i < this.engagementGroup.children.length; i++)
      this.engagementGroup.children[i].visible = false;
  }
  drawSelection() {
    if (!this.selectionGroup) {
      this.selectionGroup = new THREE.Group();
      this.scene.add(this.selectionGroup);
    }
    let e = this.selected;
    if (!e || e.dead || this.home) {
      this.selectionGroup.visible = false;
      this.selectionSignature = "";
      return;
    }
    this.selectionGroup.visible = true;
    let signature = e.id + "," + e.type + "," + e.level + "," + e.dir;
    if (signature !== this.selectionSignature) {
      this.selectionSignature = signature;
      this.clear(this.selectionGroup);
      let col = ENEMIES[e.type] ? 0xffa19d : 0xb1f8d1;
      this.torus(this.selectionGroup, 0.83, 0.025, 0, 0.44, 0, col);
      let range = TOWERS[e.type]?.range;
      if (range) {
        range += e.level === 2 ? 0.65 : 0;
        if (e.type === "honey")
          range = e.level === 2 && e.branch === 0 ? 4.5 : 3.2;
        if (e.type === "interceptor") {
          let pts = [[0, 0.4, 0]];
          for (let a = (-4 / 9) * Math.PI; a <= (4 / 9) * Math.PI; a += 0.04)
            pts.push([
              Math.sin(e.dir + a) * range * S,
              0.4,
              Math.cos(e.dir + a) * range * S,
            ]);
          pts.push([0, 0.4, 0]);
          this.line(this.selectionGroup, pts, col, 0.6, true);
        } else
          this.torus(this.selectionGroup, range * S, 0.016, 0, 0.35, 0, col);
      }
    }
    this.selectionGroup.position.copy(this.pos(e.x, e.y));
  }
  drawHazards(time) {
    if (!this.hazardGroup) {
      this.hazardGroup = new THREE.Group();
      this.scene.add(this.hazardGroup);
    }
    let signature =
      this.game.hazards.map((h) => h.cells.join() + "-" + h.active).join("|") +
      this.game.downgrades.map((d) => d.x + "," + d.y + "," + d.end).join("|");
    if (signature !== this.hazardSignature) {
      this.hazardSignature = signature;
      this.clear(this.hazardGroup);
      for (let h of this.game.hazards)
        for (let id of h.cells) {
          let c = this.game.cell(id),
            p = this.pos(c.x, c.y, 0.3);
          let block = this.box(
            this.hazardGroup,
            1.42,
            h.active ? 0.5 : 0.08,
            1.42,
            p.x,
            0.28,
            p.z,
            0xd15b79,
            0x8d304c,
          );
          block.material = this.mat(
            0xd9667d,
            0.2,
            0.5,
            0x8a2444,
            h.active ? 0.65 : 0.4,
          );
          if (!h.active)
            this.torus(this.hazardGroup, 0.75, 0.06, p.x, 0.4, p.z, 0xff6d85);
        }
      for (let d of this.game.downgrades) {
        let p = this.pos(d.x, d.y, 0.2);
        this.torus(
          this.hazardGroup,
          d.range * S,
          0.035,
          p.x,
          0.24,
          p.z,
          0xe5ac62,
        );
      }
    }
    this.hazardGroup.children.forEach((c) => {
      if (c.material?.transparent)
        c.material.opacity = 0.35 + Math.sin(time * 5) * 0.15;
    });
  }
  projectLabels() {
    const occupied = [],
      priority = { core: 0, entry: 1, node: 2, zone: 3 };
    const blocked = this.game.blocked();
    for (let l of [...this.labels].sort(
      (a, b) => priority[a.cl] - priority[b.cl],
    )) {
      if (l.cl === "node" && l.id) {
        const cooldown = this.game.nodeCooldown[l.id] || 0;
        const name = this.game.cell(l.id).name;
        const text =
          name +
          " · " +
          (blocked.has(l.id)
            ? "隔离"
            : cooldown > 0
              ? "旁路 " + Math.ceil(cooldown) + "s"
              : "直通");
        if (l.el.textContent !== text) l.el.textContent = text;
      }
      let p = l.p.clone().project(this.camera);
      let x = (p.x * 0.5 + 0.5) * this.host.clientWidth,
        y = (-p.y * 0.5 + 0.5) * this.host.clientHeight;
      const w = [...l.el.textContent].reduce(
          (n, c) => n + (c.charCodeAt(0) > 255 ? 11 : 6),
          18,
        ),
        h = 23;
      for (
        let i = 0;
        i < 4 &&
        occupied.some(
          (b) =>
            Math.abs(b.x - x) < (b.w + w) / 2 + 3 && Math.abs(b.y - y) < h + 2,
        );
        i++
      )
        y -= h + 3;
      occupied.push({ x, y, w });
      l.el.style.left = x + "px";
      l.el.style.top = y + "px";
      l.el.style.display =
        p.z > 1 || p.z < -1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1
          ? "none"
          : "";
      if (l.cl === "zone") l.el.style.opacity = this.home ? 0.65 : 0.48;
    }
  }
  project(x, y, height = 0) {
    let p = this.pos(x, y, height).project(this.camera),
      r = this.host.getBoundingClientRect();
    return {
      x: r.left + (p.x * 0.5 + 0.5) * r.width,
      y: r.top + (-p.y * 0.5 + 0.5) * r.height,
    };
  }
  pick(clientX, clientY) {
    let r = this.host.getBoundingClientRect();
    this.mouse.set(
      ((clientX - r.left) / r.width) * 2 - 1,
      (-(clientY - r.top) / r.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.mouse, this.camera);
    let hits = this.raycaster.intersectObjects(this.dynamic.children, true);
    for (let h of hits) {
      let g = h.object;
      while (g && !g.userData.entity) g = g.parent;
      if (g?.userData.entity && !g.userData.entity.dead)
        return { entity: g.userData.entity, cell: g.userData.entity.cell };
    }
    let tiles = this.raycaster.intersectObjects(this.pickables, false);
    return tiles.length ? { cell: tiles[0].object.userData.cell } : null;
  }
  resize() {
    let w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.updateCamera();
  }
  resetCamera() {
    this.theta = 0.55;
    this.phi = 0.72;
    this.zoom = 1;
    this.target.set(0, 0, 0);
    this.updateCamera();
  }
  updateCamera() {
    let r = this.host.getBoundingClientRect(),
      aspect = r.width / r.height;
    let hw = ((this.map?.w || 15) * S) / 2,
      hd = ((this.map?.h || 14) * S) / 2,
      hp =
        Math.abs(Math.cos(this.theta)) * hw +
        Math.abs(Math.sin(this.theta)) * hd,
      vp =
        (Math.abs(Math.sin(this.theta)) * hw +
          Math.abs(Math.cos(this.theta)) * hd) *
          Math.cos(this.phi) +
        1.4;
    let extent = Math.max(vp + 1, (hp + 1) / aspect);
    if (this.home) extent *= 1.03;
    extent /= this.zoom;
    this.camera.left = -extent * aspect;
    this.camera.right = extent * aspect;
    this.camera.top = extent;
    this.camera.bottom = -extent;
    this.camera.position.set(
      this.target.x + 45 * Math.sin(this.theta) * Math.sin(this.phi),
      this.target.y + 45 * Math.cos(this.phi),
      this.target.z + 45 * Math.cos(this.theta) * Math.sin(this.phi),
    );
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
  focus(x, y, zoom, blend = 1) {
    let p = this.pos(x, y);
    this.target.lerp(p, blend);
    this.zoom += (zoom - this.zoom) * blend;
    this.updateCamera();
  }
  installCamera() {
    let orbit = null;
    this.canvas.addEventListener("pointerdown", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        orbit = { x: e.clientX, y: e.clientY, shift: e.shiftKey };
        this.canvas.setPointerCapture(e.pointerId);
      }
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!orbit) return;
      let dx = e.clientX - orbit.x,
        dy = e.clientY - orbit.y;
      orbit.x = e.clientX;
      orbit.y = e.clientY;
      if (e.shiftKey) {
        let right = new THREE.Vector3().setFromMatrixColumn(
            this.camera.matrix,
            0,
          ),
          up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
        this.target.addScaledVector(right, (-dx * 0.035) / this.zoom);
        this.target.addScaledVector(up, (dy * 0.035) / this.zoom);
      } else {
        this.theta -= dx * 0.006;
        this.phi = Math.max(0.2, Math.min(1.3, this.phi + dy * 0.006));
      }
      this.updateCamera();
    });
    this.canvas.addEventListener("pointerup", (e) => {
      if (e.button === 1) orbit = null;
    });
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoom = Math.max(
          0.6,
          Math.min(3.5, this.zoom * Math.exp(-e.deltaY * 0.001)),
        );
        this.updateCamera();
      },
      { passive: false },
    );
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
