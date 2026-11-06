// 三维战场：地形、设施、协议层、远景网络。一张地图对应一个 World 实例。
(function (root) {
  const TD = root.TD = root.TD || {};
  const THREE = root.THREE;
  const { Mesher, C } = TD.Gfx;
  const TT = TD.TT;
  const S = TD.RULES.tile;

  const THEMES = {
    // 晨雾青磁：冷青的雾气里，胡粉色的平台最亮，黄土做点缀
    intranet: {
      skyTop: 0x0E2226, skyMid: 0x2B4E4C, skyLow: 0x0A1618, nebula: 0xB08A5A, nebula2: 0x5FA894, skyNeb: 0x3F6E6A, skyNeb2: 0x3E7F74, fog: 0x16282A, fogD: 0.0042,
      sun: 0xFFF1DC, sunI: 3.4, sunDir: [0.55, 1.0, 0.42], hemiT: 0xCFE6DE, hemiB: 0x2A3532, hemiI: 1.0, rim: 0x8FD3C0, rimI: 0.8,
      link: 0x2C3538, linkEdge: 0xA8DCC8, curb: 0x606C6C, legacy: 0x8A6236, legacyGlow: 0xE0A95A, plate: 0xE4DFD0, plates: [0xE4DFD0, 0xC8D6C8, 0xD9CDB6, 0xC3CFCB], plateEdge: 0xC9964A, plateSide: 0x7F7A6C, pad: 0x2F7F73,
      steel: 0x4C5A5C, under: 0x1C2628, layer: [0x5FB8A0, 0x5F8FC0, 0x8FAE9A], layerBright: 0.8, bloom: 0.34, cluster: 'campus', exposure: 1.0,
    },
    // 夜潮藍金：藏蓝的夜色，月白的公网流，金箔勾边
    backbone: {
      skyTop: 0x070E1F, skyMid: 0x1C3058, skyLow: 0x060B18, nebula: 0x5A78B4, nebula2: 0x3F6EA8, skyNeb: 0x3E4C8C, skyNeb2: 0x2F5C9C, fog: 0x0C1630, fogD: 0.0038,
      sun: 0xDFE8FF, sunI: 3.1, sunDir: [-0.5, 1.0, 0.5], hemiT: 0xB8C8E8, hemiB: 0x141C34, hemiI: 1.0, rim: 0x7FA8FF, rimI: 1.0,
      link: 0x1E2940, linkEdge: 0xA9CFFF, curb: 0x505E7E, legacy: 0x96703E, legacyGlow: 0xECC27A, plate: 0x93A3BC, plates: [0x93A3BC, 0x8496B2, 0xA2ABC0, 0x8CA2B4], plateEdge: 0xD9B45B, plateSide: 0x4A5670, pad: 0xE8D9A0,
      steel: 0x3F4E6C, under: 0x141C30, layer: [0x7FB4E8, 0x5F7FD0, 0x8A9AD8], layerBright: 0.8, bloom: 0.38, cluster: 'orbital', exposure: 1.0,
    },
    // 余烬朱墨：墨黑的厂房，炉火在远处，路面用冷白压住暖色
    airgap: {
      skyTop: 0x0A0908, skyMid: 0x33231A, skyLow: 0x0A0706, nebula: 0x8A4A22, nebula2: 0x4F6A58, fog: 0x17110C, fogD: 0.0048,
      sun: 0xFFCFA0, sunI: 3.2, sunDir: [0.75, 0.85, -0.25], hemiT: 0xD8C8A8, hemiB: 0x1C1812, hemiI: 0.85, rim: 0xE8703A, rimI: 1.1,
      link: 0x2E2E2A, linkEdge: 0xC2D0D2, curb: 0x66665A, legacy: 0x8F7434, legacyGlow: 0xE8C56A, plate: 0x8F8A78, plates: [0x85857A, 0x748078, 0x8E877A, 0x7E8480], plateEdge: 0xD29A3E, plateSide: 0x4E4C40, pad: 0xD8D3B0,
      steel: 0x4E4E44, under: 0x1A1A16, layer: [0xC8622A, 0x8E7434, 0xB03C26], layerBright: 0.36, bloom: 0.36, cluster: 'plant', exposure: 1.0,
    },
  };
  TD.THEMES = THEMES;

  class World {
    constructor(renderer, mapId, quality) {
      this.renderer = renderer;
      this.quality = quality || 'high';
      this.map = TD.compileMap(mapId);
      this.def = this.map.def;
      this.th = THEMES[this.def.theme];
      this.scene = new THREE.Scene();
      this.group = new THREE.Group();
      this.scene.add(this.group);
      this.anims = [];
      this.nodeViews = [];
      this.time = 0;
      this.uTime = { value: 0 };
      this.w = this.map.w; this.h = this.map.h;
      TD.Gfx.buildTextures();
      this.buildMaterials();
      this.buildSkyAndLights();
      this.buildBatches();
      this.buildProtocolLayers();
      this.buildRemote();
      this.buildGates();
      this.buildNodes();
      this.buildRegionDecals();
    }

    X(x) { return (x - (this.w - 1) / 2) * S; }
    Z(y) { return (y - (this.h - 1) / 2) * S; }
    tileAt(x, y) { return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.map.tiles[x + y * this.w] : TT.VOID; }
    isRoad(x, y) { const t = this.tileAt(x, y); return t === TT.LINK || t === TT.LEGACY || t === TT.NODE || t === TT.ENTRANCE || t === TT.EXIT; }
    groundY(x, y) { return this.tileAt(Math.round(x), Math.round(y)) === TT.PLATFORM ? 0.9 : 0.0; }

    buildMaterials() {
      const T = TD.Gfx.textures, std = (o) => TD.Gfx.patchMaterial(new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, o)));
      const M = this.M = {};
      M.road = std({ map: T.road.map, normalMap: T.road.normalMap, roughnessMap: T.road.roughnessMap, metalness: 0.62, roughness: 0.82, normalScale: new THREE.Vector2(0.8, 0.8) });
      M.rust = std({ map: T.rust.map, normalMap: T.rust.normalMap, roughnessMap: T.rust.roughnessMap, metalness: 0.45, roughness: 1.0 });
      M.plate = std({ map: T.plate.map, normalMap: T.plate.normalMap, roughnessMap: T.plate.roughnessMap, metalness: 0.18, roughness: 0.75 });
      M.metal = std({ map: T.metal.map, normalMap: T.metal.normalMap, roughnessMap: T.metal.roughnessMap, metalness: 0.72, roughness: 0.75 });
      M.paint = std({ metalness: 0.15, roughness: 0.55 });
      M.concrete = std({ map: T.concrete.map, normalMap: T.concrete.normalMap, roughnessMap: T.concrete.roughnessMap, metalness: 0.0, roughness: 1.0 });
      M.vent = std({ map: T.vent.map, normalMap: T.vent.normalMap, metalness: 0.6, roughness: 0.6 });
      M.hazard = std({ map: T.hazard.map, metalness: 0.2, roughness: 0.7 });
      M.rack = TD.Gfx.patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, map: T.rack.map, emissiveMap: T.rack.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.8, metalness: 0.5, roughness: 0.5 }));
      M.window = TD.Gfx.patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, map: T.window.map, emissiveMap: T.window.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.28 }));
      M.glass = TD.Gfx.patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.9, roughness: 0.08, transparent: true, opacity: 0.32, depthWrite: false }));
      M.glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true });
      M.glowAdd = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      {
        const c = document.createElement('canvas'); c.width = 8; c.height = 64;
        const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 64);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gr; x.fillRect(0, 0, 8, 64);
        const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
        M.ao = new THREE.MeshBasicMaterial({ map: t, color: 0x000000, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
        M.ao.alphaMap = null;
      }
      // 让发光批次也响应 per-vertex 强度
      M.glow.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float emis;\nvarying float vEmis;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmis = emis;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vEmis;').replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 1.0 + vEmis * 0.6;');
      };
    }

    buildSkyAndLights() {
      const th = this.th;
      const scene = this.scene;
      scene.fog = new THREE.FogExp2(th.fog, th.fogD);
      const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 32), new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {
          top: { value: new THREE.Color(th.skyTop) }, mid: { value: new THREE.Color(th.skyMid) }, low: { value: new THREE.Color(th.skyLow) },
          neb: { value: new THREE.Color(th.skyNeb || th.nebula) }, neb2: { value: new THREE.Color(th.skyNeb2 || th.nebula2) }, uTime: this.uTime,
        },
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `varying vec3 vP; uniform vec3 top,mid,low,neb,neb2; uniform float uTime;
          float h(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
          float n(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
            return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                       mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
          float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+7.1; a*=.5;} return s; }
          void main(){ vec3 d=normalize(vP); float y=d.y;
            vec3 c = y>0.0 ? mix(mid,top,smoothstep(0.0,0.6,y)) : mix(mid,low,smoothstep(0.0,-0.22,y));
            float a=fbm(d*3.2+vec3(uTime*.004,0.,uTime*.003));
            float b=fbm(d*6.0-vec3(0.,uTime*.003,0.));
            c += neb*pow(a,2.6)*0.75 + neb2*pow(b,3.2)*0.7;
            float st=h(floor(d*420.0)); c+= vec3(1.0)*smoothstep(0.9975,1.0,st)*(0.5+0.5*y);
            gl_FragColor=vec4(c,1.0);
}`,
      }));
      scene.add(sky);
      this.sky = sky;

      const hemi = new THREE.HemisphereLight(th.hemiT, th.hemiB, th.hemiI);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(th.sun, th.sunI);
      const d = th.sunDir;
      sun.position.set(d[0] * 70, d[1] * 70, d[2] * 70);
      sun.castShadow = true;
      const q = this.quality;
      sun.shadow.mapSize.set(q === 'high' ? 4096 : q === 'mid' ? 2048 : 1024, q === 'high' ? 4096 : q === 'mid' ? 2048 : 1024);
      const span = Math.max(this.w, this.h) * S * 0.72;
      const cam = sun.shadow.camera;
      cam.left = -span; cam.right = span; cam.top = span; cam.bottom = -span; cam.near = 5; cam.far = 190;
      sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.035;
      scene.add(sun); scene.add(sun.target);
      this.sun = sun;
      const rim = new THREE.DirectionalLight(th.rim, th.rimI);
      rim.position.set(-d[0] * 60, 25, -d[2] * 60);
      scene.add(rim);
      // 环境反射：由程序场景生成
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(th.skyMid).multiplyScalar(0.7);
      const addP = (col, x, y, z, s, it) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(it) }));
        m.position.set(x, y, z); envScene.add(m);
      };
      addP(th.sun, d[0] * 12, 14, d[2] * 12, 9, 6);
      addP(th.nebula, -14, 4, 8, 7, 3);
      addP(th.nebula2, 12, 3, -14, 7, 3);
      addP(th.skyTop, 0, 18, 0, 26, 1);
      addP(th.skyLow, 0, -16, 0, 30, 0.7);
      addP(th.linkEdge, 0, 2, 17, 5, 3);
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.envRT = pm.fromScene(envScene, 0.03);
      scene.environment = this.envRT.texture;
      scene.environmentIntensity = 0.75;
      pm.dispose();
    }

    // ────────── 地形合并批次 ──────────
    buildBatches() {
      const B = this.B = { ao: new Mesher(), road: new Mesher(), rust: new Mesher(), plate: new Mesher(), metal: new Mesher(), paint: new Mesher(), concrete: new Mesher(), vent: new Mesher(), hazard: new Mesher(), rack: new Mesher(), window: new Mesher(), glass: new Mesher(), glow: new Mesher(), glowAdd: new Mesher() };
      this.buildRoadTiles();
      this.buildPlatformTiles();
      this.buildSubstructure();
      const fac = TD.Facilities;
      for (const r of this.def.obstacles) {
        const fn = fac[r[4]];
        if (fn) fn.call(fac, this, { x0: r[0], y0: r[1], x1: r[2], y1: r[3], cx: this.X((r[0] + r[2]) / 2), cz: this.Z((r[1] + r[3]) / 2), w: (r[2] - r[0] + 1) * S, d: (r[3] - r[1] + 1) * S, nx: r[2] - r[0] + 1, ny: r[3] - r[1] + 1 });
      }
      for (const key in B) {
        if (!B[key].count) continue;
        const mesh = new THREE.Mesh(B[key].geometry(), this.M[key]);
        const lit = !(key === 'glow' || key === 'glowAdd' || key === 'glass' || key === 'ao');
        mesh.castShadow = lit; mesh.receiveShadow = lit;
        if (key === 'glass') mesh.renderOrder = 2;
        if (key === 'ao') mesh.renderOrder = 1;
        this.group.add(mesh);
      }
      this.B = null;
    }

    buildRoadTiles() {
      const th = this.th, B = this.B;
      const W = 1.74, H = 0.36;
      const edge = C(th.linkEdge), legacyG = C(th.legacyGlow), curb = C(th.curb);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (!this.isRoad(x, y)) continue;
        const t = this.tileAt(x, y);
        const cx = this.X(x), cz = this.Z(y);
        const legacy = t === TT.LEGACY;
        const m = legacy ? B.rust : B.road;
        const color = C(legacy ? th.legacy : th.link, 0.9 + ((x * 7 + y * 13) % 5) * 0.05);
        const conn = [this.isRoad(x + 1, y), this.isRoad(x, y + 1), this.isRoad(x - 1, y), this.isRoad(x, y - 1)];
        const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
        const tunnel = this.map.tunnelAt[x + y * this.w];
        m.box(cx, -H / 2, cz, W, H, W, color, { uv: 0.25, world: true, bevel: 0.03 });
        const arm = (S - W) / 2;
        dirs.forEach((D, k) => {
          const ax = cx + D[0] * (W / 2 + arm / 2), az = cz + D[1] * (W / 2 + arm / 2);
          if (conn[k]) {
            m.box(ax, -H / 2, az, D[0] ? arm + 0.01 : W, H, D[1] ? arm + 0.01 : W, color, { uv: 0.25, world: true });
          } else {
            // 紧贴高台的路面压暗，做出接触阴影
            const nt = this.tileAt(x + D[0], y + D[1]);
            if (nt === TT.PLATFORM || nt === TT.OBSTACLE) {
              const len = W, dep = 0.62, ax2 = cx + D[0] * (W / 2 - dep / 2), az2 = cz + D[1] * (W / 2 - dep / 2);
              const hx = D[0] ? dep / 2 : len / 2, hz = D[1] ? dep / 2 : len / 2;
              const yy = 0.012;
              const P = (px, pz, v) => [px, yy, pz, 0, 1, 0, 0, v];
              // v=1 贴着高台最暗（画布上端），v=0 朝向路中央
              const a = [ax2 - hx, ax2 + hx], b = [az2 - hz, az2 + hz];
              const vOf = (px, pz) => { const t = D[0] ? (px - (ax2 - D[0] * hx)) * D[0] / (2 * hx) : (pz - (az2 - D[1] * hz)) * D[1] / (2 * hz); return t; };
              const q = [[a[0], b[0]], [a[0], b[1]], [a[1], b[1]], [a[1], b[0]]].map(k => P(k[0], k[1], vOf(k[0], k[1])));
              B.ao.quad(q[0], q[1], q[2], q[3], [1, 1, 1], 0);
            }
            // 路缘 + 发光边
            const ex = cx + D[0] * (W / 2 + 0.05), ez = cz + D[1] * (W / 2 + 0.05);
            B.metal.box(ex, 0.04, ez, D[0] ? 0.14 : W + 0.28, 0.2, D[1] ? 0.14 : W + 0.28, curb, { bevel: 0.03 });
            const g = legacy ? legacyG : edge;
            B.glow.box(ex - D[0] * 0.05, 0.148, ez - D[1] * 0.05, D[0] ? 0.045 : W * 0.86, 0.02, D[1] ? 0.045 : W * 0.86, g, {});
            if (!legacy && (x + y) % 2 === 0) {
              B.paint.box(ex + D[0] * 0.08, -0.04, ez + D[1] * 0.08, D[0] ? 0.06 : 0.5, 0.14, D[1] ? 0.06 : 0.5, 0x1C2024, {});
              B.glow.box(ex + D[0] * 0.115, -0.02, ez + D[1] * 0.115, D[0] ? 0.012 : 0.14, 0.03, D[1] ? 0.012 : 0.14, C(th.plateEdge, 1.2), {});
            }
            if ((x * 5 + y * 3) % 7 === 0) {
              // 接线箱挂在路缘外侧
              B.metal.box(ex + D[0] * 0.16, -0.28, ez + D[1] * 0.16, D[0] ? 0.16 : 0.42, 0.4, D[1] ? 0.16 : 0.42, C(th.steel, 1.1), { bevel: 0.015 });
              B.glow.box(ex + D[0] * 0.245, -0.2, ez + D[1] * 0.245, D[0] ? 0.012 : 0.2, 0.05, D[1] ? 0.012 : 0.2, C(th.pad, 1.1), {});
            }
          }
        });
        if (legacy) {
          // 旧协议：枕木、裸露电缆和老式铜排
          const horiz = conn[0] || conn[2];
          for (let k = -1; k <= 1; k++) {
            const off = k * 0.62;
            B.paint.box(cx + (horiz ? off : 0), 0.025, cz + (horiz ? 0 : off), horiz ? 0.2 : W * 0.92, 0.05, horiz ? W * 0.92 : 0.2, C(0x3b2a18), {});
          }
          for (const s of [-0.62, 0.62]) {
            B.metal.box(cx + (horiz ? 0 : s), 0.05, cz + (horiz ? s : 0), horiz ? S : 0.08, 0.06, horiz ? 0.08 : S, C(0xB88A50), {});
          }
          if ((x * 3 + y * 5) % 4 === 0) B.glow.box(cx, 0.055, cz, 0.24, 0.02, 0.24, C(th.legacyGlow, 1.6), {});
        } else {
          // 中线点缀
          const horiz = conn[0] || conn[2];
          const vert = conn[1] || conn[3];
          if (horiz && !vert) B.paint.box(cx, 0.008, cz, 0.7, 0.012, 0.05, C(th.linkEdge, 0.55), {});
          else if (vert && !horiz) B.paint.box(cx, 0.008, cz, 0.05, 0.012, 0.7, C(th.linkEdge, 0.55), {});
        }
        // 隧道：透明管壳
        if (tunnel) {
          for (const s of [-1, 1]) {
            B.metal.box(cx + s * 0.92, 0.5, cz, 0.08, 1.05, S, C(th.steel), {});
          }
          B.glass.box(cx, 1.05, cz, 1.9, 0.05, S, C(th.linkEdge, 0.9), {});
          for (const s of [-0.9, 0.9]) B.glow.box(cx + s * 0.98, 1.02, cz, 0.04, 0.04, S, edge, {});
          B.metal.box(cx, 1.06, cz - 0.9, 2, 0.1, 0.1, C(th.steel), {});
        }
        // 下层主梁与桁架
        const horiz = conn[0] || conn[2];
        m === B.rust;
        B.metal.box(cx, -H - 0.22, cz, horiz ? S : 0.7, 0.44, horiz ? 0.7 : S, C(th.under, 1.2), { uv: 0.4, world: true });
        if ((x + y * 2) % 3 === 0 && !tunnel) {
          const depth = 6 + ((x * 11 + y * 7) % 9);
          B.metal.box(cx, -H - 0.44 - depth / 2, cz, 0.32, depth, 0.32, C(th.under, 1.1), { uv: 0.3, world: true, bevel: 0.03 });
          for (let k = 1; k < depth; k += 3) B.glow.box(cx, -H - 0.44 - k, cz, 0.36, 0.05, 0.36, C(th.linkEdge, 0.7), {});
          B.metal.cyl(cx, -H - 0.44 - depth, cz, 0.3, 0.55, 0.5, 8, C(th.under, 1.3), {});
        }
      }
    }

    buildPlatformTiles() {
      const th = this.th, B = this.B;
      const top = 0.9;
      const plate = th.plate, side = C(th.plateSide), edge = C(th.plateEdge), pad = C(th.pad);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.tileAt(x, y) !== TT.PLATFORM) continue;
        const cx = this.X(x), cz = this.Z(y);
        const v = 0.86 + ((x * 5 + y * 3) % 4) * 0.035;
        const zone = this.map.platZone[x + y * this.w];
        const zc = th.plates ? th.plates[Math.max(0, zone) % th.plates.length] : plate;
        B.plate.box(cx, top - 0.09, cz, 1.95, 0.18, 1.95, C(zc, v), { uv: 0.5, bevel: 0.035 });
        // 面板细节：散热口、指示灯、检修盖、线槽，每格不同，推近看也有内容
        const dk = C(th.steel, 0.9), det = (x * 7 + y * 13) % 6;
        if (det === 0) { B.vent.box(cx + 0.42, top + 0.012, cz - 0.42, 0.5, 0.025, 0.34, dk, {}); }
        else if (det === 1) { for (let k = 0; k < 3; k++) B.glow.box(cx - 0.56 + k * 0.13, top + 0.012, cz + 0.58, 0.07, 0.02, 0.07, C(k === 1 ? th.plateEdge : th.pad, 1.2), {}); }
        else if (det === 2) { B.metal.cyl(cx - 0.45, top + 0.015, cz - 0.42, 0.2, 0.22, 0.03, 12, dk, {}); B.metal.box(cx - 0.45, top + 0.035, cz - 0.42, 0.26, 0.012, 0.04, C(th.steel, 1.5), {}); }
        else if (det === 3) { B.metal.box(cx + 0.5, top + 0.012, cz + 0.12, 0.08, 0.02, 0.92, dk, {}); B.metal.box(cx + 0.38, top + 0.012, cz + 0.12, 0.08, 0.02, 0.92, C(th.plateEdge, 0.6), {}); }
        else if (det === 4) { B.metal.box(cx - 0.42, top + 0.02, cz + 0.45, 0.42, 0.04, 0.3, dk, { bevel: 0.01 }); B.glow.box(cx - 0.42, top + 0.042, cz + 0.45, 0.28, 0.006, 0.05, C(th.pad, 1.3), {}); }
        const conn = [this.tileAt(x + 1, y) === TT.PLATFORM, this.tileAt(x, y + 1) === TT.PLATFORM, this.tileAt(x - 1, y) === TT.PLATFORM, this.tileAt(x, y - 1) === TT.PLATFORM];
        // 机身
        B.metal.box(cx, top - 0.18 - 0.5, cz, 1.86, 1.0, 1.86, side, { uv: 0.5, world: true });
        const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
        dirs.forEach((D, k) => {
          if (conn[k]) return;
          const ex = cx + D[0] * 0.98, ez = cz + D[1] * 0.98;
          B.glow.box(ex, top - 0.2, ez, D[0] ? 0.03 : 1.5, 0.05, D[1] ? 0.03 : 1.5, edge, {});
          B.vent.box(ex - D[0] * 0.04, top - 0.72, ez - D[1] * 0.04, D[0] ? 0.05 : 1.24, 0.62, D[1] ? 0.05 : 1.24, C(th.plateSide, 1.15), {});
          B.metal.box(ex - D[0] * 0.02, top - 1.14, ez - D[1] * 0.02, D[0] ? 0.1 : 1.7, 0.1, D[1] ? 0.1 : 1.7, C(th.steel, 1.2), {});
        });
        // 部署标记：内凹方框 + 四角
        const a = 1.46, t = 0.035;
        for (const s of [-1, 1]) {
          for (const q of [-1, 1]) {
            B.glow.box(cx + s * a / 2 - s * 0.14, top + 0.005, cz + q * a / 2, 0.28, 0.01, t, pad, {});
            B.glow.box(cx + s * a / 2, top + 0.005, cz + q * a / 2 - q * 0.14, t, 0.01, 0.28, pad, {});
          }
        }
        B.paint.box(cx, top + 0.003, cz, 0.28, 0.008, 0.28, C(th.plate, 0.62), {});
        if ((x + y) % 2 === 0) {
          const depth = 5 + ((x * 3 + y * 11) % 7);
          B.metal.box(cx, -0.7 - depth / 2, cz, 0.5, depth, 0.5, C(th.under, 1.15), { uv: 0.3, world: true, bevel: 0.04 });
        }
      }
    }

    // 战场外框与悬挂结构，把地块连成悬浮的立体网络
    buildSubstructure() {
      const th = this.th, B = this.B;
      const W = this.w * S, D = this.h * S;
      const y = -2.3;
      const frame = C(th.under, 1.5), glow = C(th.linkEdge, 0.9);
      for (const s of [-1, 1]) {
        B.metal.box(0, y, s * (D / 2 + 1.6), W + 4, 0.8, 0.8, frame, { uv: 0.3, world: true, bevel: 0.1 });
        B.metal.box(s * (W / 2 + 1.6), y, 0, 0.8, 0.8, D + 4, frame, { uv: 0.3, world: true, bevel: 0.1 });
        B.glow.box(0, y + 0.43, s * (D / 2 + 1.6), W + 3, 0.04, 0.12, glow, {});
        B.glow.box(s * (W / 2 + 1.6), y + 0.43, 0, 0.12, 0.04, D + 3, glow, {});
      }
      // 横纵次梁
      for (let i = 0; i <= 5; i++) {
        const x = -W / 2 + W * i / 5;
        B.metal.box(x, y - 0.9, 0, 0.4, 0.5, D + 2, C(th.under, 1.15), { uv: 0.3, world: true });
      }
      for (let i = 0; i <= 3; i++) {
        const z = -D / 2 + D * i / 3;
        B.metal.box(0, y - 1.2, z, W + 2, 0.4, 0.4, C(th.under, 1.15), { uv: 0.3, world: true });
      }
      // 悬挂线缆束：从外框垂到路面下方，形成立体结构
      {
        const cableCols = [C(th.under, 2.2), C(th.steel, 1.2), C(th.layer[0], 0.5)];
        const rnd = (() => { let s = this.def.index * 37 + 5; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
        const roadPts = [];
        for (let yy = 0; yy < this.h; yy++) for (let xx = 0; xx < this.w; xx++) if (this.isRoad(xx, yy) && (xx + yy) % 5 === 0) roadPts.push([this.X(xx), this.Z(yy)]);
        const nCables = Math.min(26, roadPts.length);
        for (let i = 0; i < nCables; i++) {
          const p = roadPts[Math.floor(rnd() * roadPts.length)];
          const side = Math.floor(rnd() * 4);
          const fx0 = side === 0 ? -W / 2 - 1.6 : side === 1 ? W / 2 + 1.6 : p[0];
          const fz0 = side === 2 ? -D / 2 - 1.6 : side === 3 ? D / 2 + 1.6 : p[1];
          const a = new THREE.Vector3(fx0, y - 0.3, fz0), b = new THREE.Vector3(p[0], -0.7, p[1]);
          const mid = a.clone().lerp(b, 0.5); mid.y -= 2.4 + rnd() * 2.6;
          const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
          const tube = new THREE.TubeGeometry(curve, 10, 0.05 + rnd() * 0.04, 5, false);
          B.metal.geo(tube, 0, 0, 0, cableCols[i % 3], {});
          if (i % 4 === 0) {
            for (let k = 2; k < 9; k += 3) { const q = curve.getPoint(k / 10); B.glow.sph(q.x, q.y, q.z, 0.09, C(th.linkEdge, 1.4), { seg: 6 }); }
          }
        }
      }
      // 四角悬挂塔
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const px = sx * (W / 2 + 1.6), pz = sz * (D / 2 + 1.6);
        B.metal.cyl(px, -9, pz, 0.55, 0.9, 14, 8, frame, {});
        B.metal.cyl(px, y + 1.2, pz, 0.35, 0.7, 3, 8, frame, {});
        B.glow.cyl(px, y + 2.85, pz, 0.28, 0.28, 0.25, 8, C(th.plateEdge, 1.5), {});
        B.metal.torus(px, -5, pz, 1.1, 0.14, frame, { rx: Math.PI / 2, seg: 16 });
        B.metal.torus(px, -11, pz, 1.4, 0.14, frame, { rx: Math.PI / 2, seg: 16 });
      }
    }

    // ────────── 协议层 ──────────
    buildProtocolLayers() {
      const th = this.th;
      this.layers = [];
      const names = ['传输层', '网络层', '数据链路层'];
      const ys = [-20, -44, -78];
      ys.forEach((yy, i) => {
        const size = 560 + i * 200;
        const mat = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
          uniforms: { uTime: this.uTime, col: { value: new THREE.Color(th.layer[i]) }, cell: { value: 8 + i * 4 }, seed: { value: i * 3.1 + 0.7 }, shift: { value: i === 1 ? 1 : 0 }, uBright: { value: th.layerBright || 1 } },
          vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
          fragmentShader: `varying vec2 vUv; varying vec3 vW; uniform float uTime,cell,seed,shift,uBright; uniform vec3 col;
            float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+seed)*43758.5453); }
            void main(){ vec2 p=vW.xz/cell; vec2 g=abs(fract(p)-.5); float line=smoothstep(.485,.5,max(g.x,g.y));
              // 六边形 / 方格两种层的差异
              vec2 id=floor(p); float r=h(id);
              float blink=step(.82,r)*(.5+.5*sin(uTime*(1.+r*3.)+r*40.));
              float cellGlow=blink*.07;
              // 沿网格线跑的脉冲
              float rowId=floor(p.y); float colId=floor(p.x);
              float sp=1.5+h(vec2(rowId,seed))*3.;
              float px=fract(p.x*.05+uTime*sp*.05+h(vec2(rowId,1.))*7.);
              float pulseX=smoothstep(.96,1.,px)*step(.5,h(vec2(rowId,2.)))*smoothstep(.46,.5,abs(fract(p.y)-.5));
              float py=fract(p.y*.05-uTime*sp*.04+h(vec2(colId,3.))*7.);
              float pulseZ=smoothstep(.96,1.,py)*step(.55,h(vec2(colId,4.)))*smoothstep(.46,.5,abs(fract(p.x)-.5));
              float d=length(vW.xz)/${(size / 2).toFixed(1)}; float fade=smoothstep(1.,.15,d);
              vec3 c=(col*(line*.2+cellGlow)+col*2.0*(pulseX+pulseZ))*uBright;
              float a=fade*(1.0-seed*.06);
              gl_FragColor=vec4(c*a,1.0);
}`,
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
        m.rotation.x = -Math.PI / 2;
        m.position.y = yy;
        m.renderOrder = -5 + i;
        this.scene.add(m);
        this.layers.push(m);
        // 层名标识
        const tt = TD.Gfx.textTexture(`L${4 - i}  ${names[i]}`, { size: 56, color: '#ffffff' });
        const lbl = new THREE.Mesh(new THREE.PlaneGeometry(26 * tt.aspect / 3, 26 / 3), new THREE.MeshBasicMaterial({ map: tt.tex, transparent: true, opacity: 0.32, color: th.layer[i], depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
        lbl.rotation.x = -Math.PI / 2;
        lbl.position.set(-this.w * S * 0.62, yy + 0.3, this.h * S * 0.72 + i * 8);
        this.scene.add(lbl);
      });

      // 贯穿协议层的数据立柱：从战场底部一路连到最深层，脉冲沿柱上下流动
      {
        const P = [], N = [], Col = [], Sd = [], Idx = [];
        const addRiser = (x, z, y0, y1, r, color, seed) => {
          const seg = 6, base = P.length / 3;
          for (let k = 0; k <= 1; k++) {
            const y = k ? y1 : y0;
            for (let i = 0; i < seg; i++) {
              const a = i / seg * Math.PI * 2;
              P.push(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
              N.push(y);
              Col.push(color.r, color.g, color.b);
              Sd.push(seed);
            }
          }
          for (let i = 0; i < seg; i++) {
            const j = (i + 1) % seg;
            Idx.push(base + i, base + j, base + seg + j, base + i, base + seg + j, base + seg + i);
          }
        };
        const w = this.w * S, d = this.h * S, cc = new THREE.Color();
        // 战场四周和下方的主干立柱
        const spots = [];
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) spots.push([sx * (w / 2 + 1.6), sz * (d / 2 + 1.6)]);
        for (let i = 0; i < 18; i++) { const a = i * 2.399; spots.push([Math.cos(a) * (w * 0.2 + i * 2.6), Math.sin(a) * (d * 0.2 + i * 2.0)]); }
        for (let i = 0; i < 14; i++) { const a = i * 1.7 + 0.4; spots.push([Math.cos(a) * (w * 0.7 + (i % 4) * 8), Math.sin(a) * (d * 0.8 + (i % 3) * 8)]); }
        spots.forEach((p, i) => {
          cc.set(th.layer[i % 3]);
          addRiser(p[0], p[1], -80, -2.6 - (i % 3) * 3, i < 4 ? 0.34 : 0.16 + (i % 3) * 0.05, cc, i * 0.37);
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(Col, 3));
        g.setAttribute('aS', new THREE.Float32BufferAttribute(Sd, 1));
        g.setIndex(Idx);
        const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, vertexColors: true,
          uniforms: { uTime: this.uTime },
          vertexShader: `attribute float aS; varying vec3 vC; varying float vY; varying float vS; void main(){ vC=color; vY=position.y; vS=aS; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
          fragmentShader: `varying vec3 vC; varying float vY; varying float vS; uniform float uTime;
            void main(){ float s=fract(vY*.045-uTime*(.22+fract(vS*7.)*.3)+vS); float p=smoothstep(.86,1.,s); float base=.07+.06*smoothstep(-80.,-20.,vY); gl_FragColor=vec4(vC*(base+p*1.1),1.); }`,
        }));
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        // 协议层上的枢纽：缓慢旋转的多面体 + 光环，把层与立柱接起来
        const hubGeo = new Mesher();
        hubGeo.geo(new THREE.OctahedronGeometry(1.6, 0), 0, 0, 0, C(0xffffff), {});
        hubGeo.torus(0, 0, 0, 2.6, 0.06, C(0xffffff), { rx: Math.PI / 2, seg: 32 });
        hubGeo.torus(0, 0, 0, 3.4, 0.03, C(0xffffff), { rx: Math.PI / 2, seg: 6 });
        const hg = hubGeo.geometry();
        this.hubs = [];
        spots.slice(4, 22).forEach((p, i) => {
          const layer = i % 3;
          const yy = [-20, -44, -78][layer] + 2.6;
          const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(th.layer[layer]).multiplyScalar(0.8 * (th.layerBright || 1) + 0.15), wireframe: i % 2 === 0, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
          const h = new THREE.Mesh(hg, mat);
          h.position.set(p[0], yy, p[1]);
          h.scale.setScalar(0.8 + (i % 3) * 0.35);
          this.scene.add(h);
          this.anims.push((t) => { h.rotation.y = t * (0.3 + (i % 4) * 0.1); h.position.y = yy + Math.sin(t * 0.7 + i) * 0.4; });
        });
      }

      // 协议层上奔跑的数据包（实例化，顶点着色器内推进）
      const count = this.quality === 'low' ? 260 : 700;
      const g = new THREE.InstancedBufferGeometry();
      const base = new THREE.BoxGeometry(1, 1, 1);
      g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.normal = base.attributes.normal;
      const A = new Float32Array(count * 4), B2 = new Float32Array(count * 4), CC = new Float32Array(count * 3);
      const color = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const layerY = [-19.4, -43.4, -77.4, -9, -32][i % 5];
        const horizontal = i % 2 === 0;
        const span = 300;
        const lane = Math.round((Math.random() - 0.5) * 40) * 8;
        A[i * 4] = horizontal ? 0 : lane; A[i * 4 + 1] = layerY; A[i * 4 + 2] = horizontal ? lane : 0; A[i * 4 + 3] = Math.random() * span * 2;
        B2[i * 4] = horizontal ? 1 : 0; B2[i * 4 + 1] = 0; B2[i * 4 + 2] = horizontal ? 0 : 1; B2[i * 4 + 3] = (6 + Math.random() * 18) * (Math.random() < 0.5 ? -1 : 1);
        color.set(th.layer[i % 3]).multiplyScalar(1.4);
        CC[i * 3] = color.r; CC[i * 3 + 1] = color.g; CC[i * 3 + 2] = color.b;
      }
      g.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
      g.setAttribute('iB', new THREE.InstancedBufferAttribute(B2, 4));
      g.setAttribute('iC', new THREE.InstancedBufferAttribute(CC, 3));
      g.instanceCount = count;
      const pk = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: { uTime: this.uTime },
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        vertexShader: `attribute vec4 iA; attribute vec4 iB; attribute vec3 iC; uniform float uTime; varying vec3 vC; varying float vF;
          void main(){ float span=300.0; float t=mod(iA.w+uTime*iB.w+span*4.0,span*2.0)-span;
            vec3 dir=iB.xyz; vec3 p=position; p*=vec3(.5,.28,.5); p+=dir*position*4.5;
            vec3 w=iA.xyz+dir*t+p; vC=iC; vF=smoothstep(span,span*.5,abs(t));
            gl_Position=projectionMatrix*viewMatrix*vec4(w,1.0); }`,
        fragmentShader: `varying vec3 vC; varying float vF; void main(){ gl_FragColor=vec4(vC*vF,1.0);
}`,
      }));
      pk.frustumCulled = false;
      this.scene.add(pk);
    }

    // ────────── 远景网络 ──────────
    buildRemote() {
      const th = this.th;
      const rand = (() => { let s = this.def.index * 991 + 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
      const m = new Mesher(), mg = new Mesher(), w = new Mesher();
      const clusters = [];
      const nCluster = 14;
      for (let c = 0; c < nCluster; c++) {
        const a = (c / nCluster) * Math.PI * 2 + rand() * 0.2;
        const r = 120 + rand() * 120;
        const cy = -16 - rand() * 34 + (c % 3) * 6;
        const cx = Math.cos(a) * r, cz = Math.sin(a) * r * 0.86;
        const size = 14 + rand() * 18;
        clusters.push({ x: cx, y: cy, z: cz, size });
        // 岛基
        m.cyl(cx, cy - 2.5, cz, size, size * 0.55, 5, 7, C(th.under, 1.8), { ry: rand() * 3 });
        mg.torus(cx, cy + 0.2, cz, size * 0.98, 0.25, C(th.layer[c % 3], 1.4), { rx: Math.PI / 2, seg: 24 });
        const nB = 7 + (rand() * 9 | 0);
        for (let b = 0; b < nB; b++) {
          const ba = rand() * 6.28, br = rand() * size * 0.8;
          const bx = cx + Math.cos(ba) * br, bz = cz + Math.sin(ba) * br;
          const type = th.cluster;
          if (type === 'campus') {
            const h = 5 + rand() * 24;
            w.box(bx, cy + h / 2, bz, 3 + rand() * 4, h, 3 + rand() * 4, C(0xC2D2CC, 0.7 + rand() * 0.5), { uv: 0.09 });
            mg.box(bx, cy + h + 0.15, bz, 1.6, 0.3, 1.6, C(th.nebula, 1.5), {});
          } else if (type === 'orbital') {
            const h = 4 + rand() * 16;
            w.box(bx, cy + h / 2, bz, 4 + rand() * 3, h, 2 + rand() * 3, C(0xA8B8DC, 0.6 + rand() * 0.5), { uv: 0.08 });
            if (rand() < 0.4) mg.torus(bx, cy + h + 2, bz, 2.6, 0.12, C(th.nebula2, 1.6), { rx: 1.2, ry: rand() * 3, seg: 18 });
          } else {
            if (rand() < 0.5) {
              const h = 8 + rand() * 18;
              m.cyl(bx, cy + h / 2, bz, 1.1, 2.2, h, 8, C(0x6a5f4a, 1.1), {});
              mg.cyl(bx, cy + h + 0.2, bz, 1.2, 1.2, 0.4, 8, C(th.nebula, 2.4), {});
            } else {
              const h = 5 + rand() * 10;
              w.box(bx, cy + h / 2, bz, 5 + rand() * 4, h, 4 + rand() * 3, C(0xa89a78, 0.6), { uv: 0.08 });
            }
          }
        }
      }
      // 远端的巨型结构，每张图不同
      if (th.cluster === 'orbital') {
        mg.torus(0, 40, -300, 160, 1.3, C(th.nebula, 1.6), { rx: 1.25, seg: 96 });
        mg.torus(0, 40, -300, 188, 0.7, C(th.nebula2, 1.6), { rx: 1.2, ry: 0.1, seg: 96 });
      } else if (th.cluster === 'plant') {
        for (let k = 0; k < 5; k++) {
          const a = -0.6 + k * 0.3;
          const x = Math.sin(a) * 290, z = -Math.cos(a) * 290;
          m.cyl(x, -10, z, 8, 22, 80, 16, C(0x4a4235, 1), {});
          mg.torus(x, 30, z, 8.2, 0.5, C(th.nebula, 2.0), { rx: Math.PI / 2, seg: 24 });
        }
      } else {
        for (let k = 0; k < 7; k++) {
          const a = -1 + k * 0.33;
          const x = Math.sin(a) * 300, z = -Math.cos(a) * 280;
          const h = 60 + (k % 3) * 28;
          w.box(x, -20 + h / 2, z, 22, h, 22, C(0xB4C8C2, 0.8), { uv: 0.05 });
          mg.box(x, -20 + h + 2, z, 2, 4, 2, C(th.nebula, 3), {});
        }
      }
      const add = (me, mat) => { if (me.count) { const k = new THREE.Mesh(me.geometry(), mat); this.scene.add(k); } };
      add(m, this.M.metal); add(mg, this.M.glow); add(w, this.M.window);

      // 集群之间与通往战场的数据弧线
      const arcs = new THREE.BufferGeometry();
      const P = [], T = [], Col = [], Idx = [];
      const addArc = (a, b, lift, color) => {
        const N = 40, base = P.length / 3;
        const rad = 0.2;
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
          const y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * lift;
          const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
          const nx = -dz / l * rad, nz = dx / l * rad;
          P.push(x - nx, y, z - nz, x + nx, y, z + nz, x, y + rad, z, x, y - rad, z);
          for (let q = 0; q < 4; q++) { T.push(t * l / 26); Col.push(color.r, color.g, color.b); }
          if (i < N) {
            const v = base + i * 4;
            Idx.push(v, v + 1, v + 5, v, v + 5, v + 4, v + 2, v + 3, v + 7, v + 2, v + 7, v + 6);
          }
        }
      };
      const color = new THREE.Color();
      for (let i = 0; i < clusters.length; i++) {
        const a = clusters[i], b = clusters[(i + 1) % clusters.length];
        color.set(th.layer[i % 3]);
        addArc(a, b, 12 + (i % 4) * 5, color);
      }
      // 通向战场的上行链路：每个入口连到离它最近、且在同一侧的集群，弧线从战场外缘接入
      for (const gate of this.map.entrances) {
        const gx = this.X(gate.x), gz = this.Z(gate.y);
        const out = { x: gate.x === this.w - 1 ? 1 : gate.x === 0 ? -1 : 0, z: gate.y === 0 ? -1 : gate.y === this.h - 1 ? 1 : 0 };
        let best = null, bd = 1e9;
        for (const c of clusters) {
          if ((c.x - gx) * out.x + (c.z - gz) * out.z < 40) continue;
          const d = Math.hypot(c.x - gx, c.z - gz);
          if (d < bd) { bd = d; best = c; }
        }
        if (best) { color.set(TD.ENTRANCE_COLORS[gate.id]); addArc(best, { x: gx + out.x * 5, y: -1, z: gz + out.z * 5 }, 8, color); }
      }
      arcs.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      arcs.setAttribute('aT', new THREE.Float32BufferAttribute(T, 1));
      arcs.setAttribute('color', new THREE.Float32BufferAttribute(Col, 3));
      arcs.setIndex(Idx);
      const arcM = new THREE.Mesh(arcs, new THREE.ShaderMaterial({
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, vertexColors: true,
        uniforms: { uTime: this.uTime },
        vertexShader: `attribute float aT; varying float vT; varying vec3 vC; void main(){ vT=aT; vC=color; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `varying float vT; varying vec3 vC; uniform float uTime; void main(){ float s=fract(vT*.6-uTime*.28); float p=smoothstep(.84,1.,s); gl_FragColor=vec4(vC*(.08+p*1.5),1.0);
}`,
      }));
      arcM.frustumCulled = false;
      this.scene.add(arcM);

      // 大气尘埃
      const dustN = this.quality === 'low' ? 200 : 520;
      const dg = new THREE.BufferGeometry();
      const dp = new Float32Array(dustN * 3), ds = new Float32Array(dustN);
      for (let i = 0; i < dustN; i++) {
        dp[i * 3] = (rand() - 0.5) * 140; dp[i * 3 + 1] = -8 + rand() * 34; dp[i * 3 + 2] = (rand() - 0.5) * 100; ds[i] = rand();
      }
      dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      dg.setAttribute('aS', new THREE.BufferAttribute(ds, 1));
      const dust = new THREE.Points(dg, new THREE.ShaderMaterial({
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        uniforms: { uTime: this.uTime, c: { value: new THREE.Color(th.nebula2).lerp(new THREE.Color(0xffffff), 0.45) }, uPx: { value: this.renderer.getPixelRatio() } },
        vertexShader: `attribute float aS; uniform float uTime,uPx; varying float vA; void main(){ vec3 p=position; p.x+=sin(uTime*.1+aS*40.)*3.; p.y=mod(p.y+uTime*(.2+aS*.5)+8.,34.)-8.; p.z+=cos(uTime*.13+aS*30.)*3.; vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=(1.2+aS*2.8)*uPx*(90./-mv.z); vA=.25+.5*sin(uTime*(.6+aS)+aS*40.)*.5; }`,
        fragmentShader: `varying float vA; uniform vec3 c; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(c*(1.-d*2.)*vA,1.);
}`,
      }));
      dust.frustumCulled = false;
      this.scene.add(dust);
    }

    // ────────── 入口与出口 ──────────
    buildGates() {
      this.gateViews = {};
      const mapDef = this.def;
      for (const en of this.map.entrances) {
        const g = new THREE.Group();
        const cx = this.X(en.x), cz = this.Z(en.y);
        const colHex = TD.ENTRANCE_COLORS[en.id];
        const col = new THREE.Color(colHex);
        const m = new Mesher();
        const steel = C(0x23262f), red = C(colHex);
        // 判断朝向：入口总是从地图边缘进来
        const dirIn = en.x === this.w - 1 ? [-1, 0] : en.x === 0 ? [1, 0] : en.y === this.h - 1 ? [0, -1] : [0, 1];
        const ry = Math.atan2(dirIn[0], dirIn[1]);
        m.box(0, -0.2, 0, 2.6, 0.5, 2.6, steel, { bevel: 0.08 });
        for (const s of [-1, 1]) {
          m.box(s * 1.45, 1.9, 0, 0.5, 3.8, 0.9, C(0x2f323d), { bevel: 0.08 });
          m.box(s * 1.45, 3.9, 0, 0.72, 0.3, 1.1, red, { glow: 2.2 });
          m.box(s * 1.2, 1.9, 0.0, 0.06, 3.2, 0.7, red, { glow: 1.8 });
          m.box(s * 1.76, 1.2, 0, 0.14, 1.8, 0.5, C(0x41444f), {});
          // 尖刺警戒柱，强调敌对入口
          m.cone(s * 1.45, 4.5, 0, 0.26, 1.0, 4, red, { glow: 1.4 });
        }
        m.box(0, 4.1, 0, 3.4, 0.5, 1.0, C(0x2f323d), { bevel: 0.08 });
        m.box(0, 4.42, 0, 1.3, 0.14, 0.7, red, { glow: 2 });
        // 特色设备：对应入口用途
        const stationY = 0;
        const gm = new THREE.Mesh(m.geometry(), this.M.paint);
        gm.castShadow = true; gm.receiveShadow = true;
        const inner = new THREE.Group();
        inner.add(gm);
        // 传送面：扭动的流场
        const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.5), new THREE.ShaderMaterial({
          transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
          uniforms: { uTime: this.uTime, c: { value: col } },
          vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
          fragmentShader: `varying vec2 vU; uniform float uTime; uniform vec3 c; void main(){ vec2 p=vU-.5; p.y*=1.4; float r=length(p); float a=atan(p.y,p.x);
            float s=sin(a*5.+r*18.-uTime*4.)*.5+.5; float e=smoothstep(.62,.1,r); gl_FragColor=vec4(c*(s*.9+.3)*e*1.6,1.);
}`,
        }));
        portal.position.set(0, 1.9, 0);
        inner.add(portal);
        inner.rotation.y = ry;
        g.add(inner);
        // 浮动字母环
        const tt = TD.Gfx.textTexture(en.id, { size: 120, color: colHex, weight: 900 });
        const ring = new THREE.Group();
        const hm = new Mesher();
        hm.torus(0, 0, 0, 1.05, 0.05, C(colHex), { glow: 2, seg: 32 });
        hm.torus(0, 0, 0, 1.25, 0.025, C(colHex), { glow: 1.4, seg: 6 });
        const ringMesh = new THREE.Mesh(hm.geometry(), this.M.glow);
        ring.add(ringMesh);
        const letter = new THREE.Sprite(new THREE.SpriteMaterial({ map: tt.tex, transparent: true, depthWrite: false, depthTest: false }));
        letter.scale.set(1.7 * tt.aspect, 1.7, 1);
        const lg = new THREE.Group();
        lg.position.set(0, 6.1, 0);
        lg.add(ring);
        lg.add(letter);
        g.add(lg);
        g.position.set(cx, stationY, cz);
        this.group.add(g);
        const label = { kind: 'entrance', id: en.id, name: en.name, x: cx, y: 6.1, z: cz, color: colHex };
        this.gateViews[en.id] = { group: g, ring, label };
        this.anims.push((t) => { ring.rotation.y = t * 0.9; ringMesh.rotation.x = Math.sin(t * 0.7) * 0.5; lg.position.y = 6.1 + Math.sin(t * 1.4 + en.x) * 0.15; });
        // 入口的飞入数据流
        TD.Facilities.entranceProp(this, en, g, dirIn);
      }
      for (const ex of this.map.exits) {
        TD.Facilities.core(this, ex);
      }
    }

    // ────────── 交换节点 ──────────
    buildNodes() {
      for (const nd of this.map.nodes) {
        const v = TD.Facilities.nodeView(this, nd);
        this.nodeViews[nd.index] = v;
        this.group.add(v.group);
      }
    }

    // 地面上的区域铭牌
    buildRegionDecals() {
      if (!this.def.regions) return;
      for (const r of this.def.regions) {
        const tt = TD.Gfx.textTexture(r.text, { size: 60, color: '#ffffff', weight: 700 });
        const onPlate = this.tileAt(Math.round(r.x), Math.round(r.y)) === TT.PLATFORM;
        const mat = new THREE.MeshBasicMaterial({ map: tt.tex, transparent: true, opacity: onPlate ? 0.62 : 0.72, depthWrite: false, color: onPlate ? 0x15181A : this.th.pad, polygonOffset: true, polygonOffsetFactor: -2 });
        const h = 0.85;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(h * tt.aspect, h), mat);
        m.rotation.x = -Math.PI / 2;
        const tile = this.tileAt(Math.round(r.x), Math.round(r.y));
        const y = tile === TT.PLATFORM ? 0.93 : tile === TT.LEGACY || tile === TT.LINK ? 0.06 : 1.6;
        m.position.set(this.X(r.x), y, this.Z(r.y));
        m.renderOrder = 3;
        this.group.add(m);
      }
    }

    setNodeState(index, state) { const v = this.nodeViews[index]; if (v) v.setState(state); }

    update(dt) {
      this.time += dt;
      this.uTime.value = this.time;
      for (const f of this.anims) f(this.time, dt);
      for (const v of this.nodeViews) v.update(dt, this.time);
    }

    dispose() {
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { const mats = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mats) { if (m.map && m.map.isCanvasTexture && !m.map.isShared) m.map.dispose(); m.dispose(); } }
      });
      if (this.envRT) this.envRT.dispose();
      for (const k in this.M) this.M[k].dispose();
    }
  }
  TD.World = World;
})(typeof window !== 'undefined' ? window : globalThis);
