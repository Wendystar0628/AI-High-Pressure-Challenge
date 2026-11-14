import * as THREE from '../../../node_modules/three/build/three.module.js';

function sampleTerrainHeight(env, x, z) {
  if (!env || !env.terrain) return 0;
  const tr = env.terrain;
  const base = Number(tr.baseY || 0);
  const amp = Number(tr.hillAmp || 0);
  const freq = Number(tr.hillFreq ?? 0.06);
  let h =
    base +
    amp * (Math.sin(x * freq + 0.4) * Math.cos(z * freq - 0.3) + 0.45 * Math.sin((x + z) * freq * 1.7));

  if (Array.isArray(env.pads)) {
    for (const pad of env.pads) {
      const dx = x - pad.pos[0];
      const dz = z - pad.pos[2];
      const r = Math.sqrt(dx * dx + dz * dz);
      const pr = Number(pad.radius || 4.2);
      if (r <= pr + 2.5) {
        const blend = Math.max(0, Math.min(1, (pr + 2.5 - r) / 2.5));
        h = h * (1 - blend) + Number(pad.pos[1]) * blend;
      }
    }
  }
  return h;
}

function makeLiveryTexture(desc) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Rich purple metallic base gradient around circumference
  const grad = ctx.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, '#3b0764');
  grad.addColorStop(0.25, desc.secondaryColor || '#6d28d9');
  grad.addColorStop(0.5, desc.primaryColor || '#4c1d95');
  grad.addColorStop(0.75, desc.secondaryColor || '#6d28d9');
  grad.addColorStop(1, '#3b0764');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Sleek golden-yellow longitudinal racing stripes nose-to-tail along both starboard (u=0.25) and port (u=0.75) flanks!
  for (const flankX of [256, 768]) {
    ctx.fillStyle = desc.stripeColor || '#facc15';
    ctx.fillRect(flankX - 28, 0, 56, 512);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(flankX + 34, 0, 12, 512);
    ctx.fillRect(flankX - 46, 0, 10, 512);
  }

  // Subtle station seam lines along fuselage length
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.lineWidth = 3;
  for (let y = 96; y < 512; y += 96) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Draw bold upright "24" insignia on both starboard (+X, u=0.25 -> x=256) and port (-X, u=0.75 -> x=768) flanks!
  // UV mapping on fuselage_loft:
  //   u (canvas X) runs around circumference: 0=top(+Y), 0.25=starboard(+X), 0.5=belly(-Y), 0.75=port(-X)
  //   v runs nose(-Z) -> tail(+Z); with CanvasTexture flipY=true, canvas +Y is nose(-Z) and canvas -Y is tail(+Z).
  //   Starboard (+X) viewer: Right = -Z (+canvasY = [0,1]), Down = -Y (+canvasX = [1,0]) -> transform(0, 1, 1, 0, cx, cy)
  //   Port (-X) viewer:      Right = +Z (-canvasY = [0,-1]), Down = -Y (-canvasX = [-1,0]) -> transform(0, -1, -1, 0, cx, cy)
  const text = String(desc.numberText || '24');
  const drawSideBadge = (cx, cy, isPort) => {
    ctx.save();
    if (isPort) {
      ctx.transform(0, -1, -1, 0, cx, cy);
    } else {
      ctx.transform(0, 1, 1, 0, cx, cy);
    }

    // Dark badge backing plate for crisp contrast
    ctx.fillStyle = 'rgba(30, 27, 75, 0.88)';
    ctx.strokeStyle = desc.stripeColor || '#facc15';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(-96, -68, 192, 136, 18);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 104px "Segoe UI", "Microsoft YaHei UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 11;
    ctx.strokeStyle = desc.outlineColor || '#1e1b4b';
    ctx.strokeText(text, 0, 5);
    ctx.fillStyle = desc.numberColor || '#fde047';
    ctx.fillText(text, 0, 5);
    ctx.restore();
  };

  drawSideBadge(256, 248, false);
  drawSideBadge(768, 248, true);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function makeHelipadTexture(code, baseColor, ringColor) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = baseColor || '#334155';
  ctx.fillRect(0, 0, 512, 512);

  // Concrete radial ring markings
  ctx.strokeStyle = ringColor || '#facc15';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(256, 256, 214, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.setLineDash([28, 18]);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(256, 256, 168, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = ringColor || '#facc15';
  ctx.font = '900 160px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(code || 'H'), 256, 264);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildFuselageLoftGeometry(stations) {
  const radialSegs = 28;
  const ringCount = stations.length;
  const positions = [];
  const uvs = [];
  const indices = [];

  const zMin = stations[0].z;
  const zMax = stations[ringCount - 1].z;
  const zSpan = Math.max(0.01, zMax - zMin);

  for (let s = 0; s < ringCount; s++) {
    const st = stations[s];
    const vCoord = (st.z - zMin) / zSpan;
    for (let r = 0; r <= radialSegs; r++) {
      const theta = (r / radialSegs) * Math.PI * 2;
      // Slightly squared belly for realistic helicopter cabin silhouette
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const x = sinT * st.rx;
      const y = st.y + cosT * st.ry * (cosT < 0 ? 0.84 : 1.0);
      const z = st.z;
      positions.push(x, y, z);

      // Map U around circumference so port (theta ~ -pi/2 -> u ~ 0.75) and starboard (theta ~ pi/2 -> u ~ 0.25) receive upright "24"
      const uCoord = r / radialSegs;
      uvs.push(uCoord, 0.15 + vCoord * 0.7);
    }
  }

  const stride = radialSegs + 1;
  for (let s = 0; s < ringCount - 1; s++) {
    for (let r = 0; r < radialSegs; r++) {
      const a = s * stride + r;
      const b = (s + 1) * stride + r;
      const c = (s + 1) * stride + (r + 1);
      const d = s * stride + (r + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Cap front & back ends
  const frontCenterIdx = positions.length / 3;
  positions.push(0, stations[0].y, stations[0].z - 0.08);
  uvs.push(0.5, 0.05);
  for (let r = 0; r < radialSegs; r++) {
    indices.push(frontCenterIdx, r, r + 1);
  }

  const backStart = (ringCount - 1) * stride;
  const backCenterIdx = positions.length / 3;
  positions.push(0, stations[ringCount - 1].y, stations[ringCount - 1].z + 0.08);
  uvs.push(0.5, 0.95);
  for (let r = 0; r < radialSegs; r++) {
    indices.push(backCenterIdx, backStart + r + 1, backStart + r);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function buildDeclarativeNodeMesh(nodeSpec) {
  const g = nodeSpec.geometry;
  if (!g) {
    return new THREE.Group();
  }

  const matSpec = nodeSpec.material || {};
  const makeStdMat = (override = {}) => {
    const opts = {
      color: new THREE.Color(override.color || matSpec.color || '#cbd5e1'),
      roughness: override.roughness ?? matSpec.roughness ?? 0.45,
      metalness: override.metalness ?? matSpec.metalness ?? 0.2
    };
    if (matSpec.opacity !== undefined && matSpec.opacity < 1) {
      opts.transparent = true;
      opts.opacity = matSpec.opacity;
    }
    if (matSpec.texture && matSpec.texture.type === 'heli_livery' && !override.skipTex) {
      opts.map = makeLiveryTexture(matSpec.texture);
      opts.color = new THREE.Color('#ffffff');
    }
    return new THREE.MeshStandardMaterial(opts);
  };

  if (g.type === 'box') {
    const [sx, sy, sz] = g.size || [1, 1, 1];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), makeStdMat());
    if (matSpec.stripeColor) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(sx * 1.02, sy * 0.24, sz * 1.01),
        new THREE.MeshStandardMaterial({ color: matSpec.stripeColor, roughness: 0.3, metalness: 0.25 })
      );
      mesh.add(stripe);
    }
    return mesh;
  }

  if (g.type === 'sphere') {
    return new THREE.Mesh(new THREE.SphereGeometry(g.radius || 1, 24, 18), makeStdMat());
  }

  if (g.type === 'cylinder') {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(g.radiusTop ?? 0.5, g.radiusBottom ?? 0.5, g.height ?? 1, 20),
      makeStdMat()
    );
  }

  if (g.type === 'fuselage_loft') {
    return new THREE.Mesh(buildFuselageLoftGeometry(g.stations), makeStdMat());
  }

  if (g.type === 'rotor_4blade') {
    const group = new THREE.Group();
    const span = Number(g.span || 6.6);
    const bladeLen = span * 0.48;
    const chord = Number(g.chord || 0.24);
    const thick = Number(g.thickness || 0.035);
    const mainMat = makeStdMat({ skipTex: true });
    const tipMat = new THREE.MeshStandardMaterial({
      color: matSpec.tipColor || '#facc15',
      roughness: 0.28,
      metalness: 0.3
    });

    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = (i * Math.PI) / 2;
      const inner = new THREE.Mesh(new THREE.BoxGeometry(chord, thick, bladeLen * 0.78), mainMat);
      inner.position.z = bladeLen * 0.41;
      inner.castShadow = true;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(chord * 1.02, thick * 1.05, bladeLen * 0.22), tipMat);
      tip.position.z = bladeLen * 0.91;
      tip.castShadow = true;
      arm.add(inner, tip);
      group.add(arm);
    }

    // High-RPM motion blur disc (alpha driven by submitted pose.blurAlpha!)
    const blurMat = new THREE.MeshBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const blurDisc = new THREE.Mesh(new THREE.RingGeometry(0.45, span * 0.5, 36), blurMat);
    blurDisc.rotation.x = -Math.PI / 2;
    blurDisc.name = '__rotor_blur__';
    group.add(blurDisc);
    return group;
  }

  if (g.type === 'tail_rotor_4blade') {
    const group = new THREE.Group();
    const span = Number(g.span || 1.3);
    const half = span * 0.46;
    const chord = Number(g.chord || 0.11);
    const thick = Number(g.thickness || 0.025);
    const bladeMat = makeStdMat({ skipTex: true });
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(thick, half, chord), bladeMat);
      const ang = (i * Math.PI) / 2;
      b.rotation.x = ang;
      b.position.y = Math.cos(ang) * half * 0.5;
      b.position.z = Math.sin(ang) * half * 0.5;
      group.add(b);
    }
    const blurMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const blurDisc = new THREE.Mesh(new THREE.RingGeometry(0.12, span * 0.5, 24), blurMat);
    blurDisc.rotation.y = Math.PI / 2;
    blurDisc.name = '__rotor_blur__';
    group.add(blurDisc);
    return group;
  }

  if (g.type === 'skid') {
    const group = new THREE.Group();
    const len = Number(g.length || 2.6);
    const rad = Number(g.radius || 0.055);
    const side = Number(g.side || 1);
    const mat = makeStdMat({ skipTex: true });

    const runner = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 12), mat);
    runner.rotation.x = Math.PI / 2;
    runner.castShadow = true;
    group.add(runner);

    // Front upturned toe
    const toe = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.9, rad, 0.42, 10), mat);
    toe.position.set(0, 0.12, -len * 0.5 - 0.14);
    toe.rotation.x = Math.PI * 0.32;
    group.add(toe);

    // Two angled struts connecting skid to belly
    for (const zOff of [-0.65, 0.65]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.78, rad * 0.78, 0.72, 10), mat);
      strut.position.set(-side * 0.18, 0.32, zOff);
      strut.rotation.z = side * 0.42;
      strut.castShadow = true;
      group.add(strut);
    }
    return group;
  }

  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), makeStdMat());
}

export class SharedDisplayDevice {
  constructor() {
    this.glCanvas = document.createElement('canvas');
    this.glCanvas.width = 1280;
    this.glCanvas.height = 720;
    this.contextLost = false;
    this.sceneCache = new Map(); // resourceKey -> built Three.js scene bundle
    this.lastFrameSig = new Map(); // viewKey -> signature string
    this.lastPackets = new Map(); // viewKey -> { canvas, packet }
    this.raycaster = new THREE.Raycaster();

    this.initRenderer();

    this.glCanvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });

    this.glCanvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.disposeSceneCache();
      this.initRenderer();
      this.redrawAllActiveViews();
    });
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.glCanvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  disposeSceneCache() {
    this.sceneCache.clear();
    this.lastFrameSig.clear();
  }

  unregisterView(viewKey) {
    this.lastFrameSig.delete(viewKey);
    this.lastPackets.delete(viewKey);
  }

  getOrBuildSceneBundle(sceneResource) {
    const resourceSig =
      (sceneResource.meta && sceneResource.meta.name ? sceneResource.meta.name : 'scene') +
      '::' +
      JSON.stringify({
        env: sceneResource.environment,
        nodes: sceneResource.nodes
      });

    if (this.sceneCache.has(resourceSig)) {
      return this.sceneCache.get(resourceSig);
    }

    // Evict oldest cached scene resources if > 8 distinct modified scenes were loaded
    if (this.sceneCache.size >= 8) {
      const firstKey = this.sceneCache.keys().next().value;
      this.sceneCache.delete(firstKey);
    }

    const threeScene = new THREE.Scene();
    const env = sceneResource.environment || {};
    threeScene.background = new THREE.Color(env.skyHorizon || '#1e293b');
    if (env.fogColor) {
      threeScene.fog = new THREE.Fog(env.fogColor, env.fogNear || 50, env.fogFar || 170);
    }

    // Sky dome gradient sphere
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 64;
    skyCanvas.height = 256;
    const sctx = skyCanvas.getContext('2d');
    const sgrad = sctx.createLinearGradient(0, 0, 0, 256);
    sgrad.addColorStop(0, env.skyTop || '#0f172a');
    sgrad.addColorStop(0.58, env.skyHorizon || '#eab676');
    sgrad.addColorStop(1, env.skyHorizon || '#eab676');
    sctx.fillStyle = sgrad;
    sctx.fillRect(0, 0, 64, 256);
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(155, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    threeScene.add(skyDome);

    // Ambient + Lights
    const amb = new THREE.AmbientLight(env.ambientColor || '#cbd5e1', env.ambientIntensity ?? 0.6);
    threeScene.add(amb);

    let sunLight = null;
    if (Array.isArray(env.lights)) {
      for (const l of env.lights) {
        if (l.type === 'directional') {
          const dl = new THREE.DirectionalLight(l.color || '#ffffff', l.intensity ?? 2.0);
          const [lx, ly, lz] = l.pos || [30, 45, 25];
          dl.position.set(lx, ly, lz);
          if (l.castShadow) {
            dl.castShadow = true;
            dl.shadow.mapSize.width = 2048;
            dl.shadow.mapSize.height = 2048;
            dl.shadow.camera.near = 5;
            dl.shadow.camera.far = 160;
            dl.shadow.camera.left = -45;
            dl.shadow.camera.right = 45;
            dl.shadow.camera.top = 45;
            dl.shadow.camera.bottom = -45;
            dl.shadow.bias = -0.0005;
          }
          threeScene.add(dl);
          threeScene.add(dl.target);
          sunLight = dl;
        } else if (l.type === 'hemisphere') {
          threeScene.add(new THREE.HemisphereLight(l.skyColor || '#93c5fd', l.groundColor || '#365314', l.intensity ?? 0.5));
        }
      }
    }

    // Terrain heightfield mesh with vertex elevation coloring
    let terrainMesh = null;
    if (env.terrain) {
      const tSpec = env.terrain;
      const tSize = Number(tSpec.size || 140);
      const segs = Math.min(120, Math.max(16, Number(tSpec.segments || 80)));
      const tGeom = new THREE.PlaneGeometry(tSize, tSize, segs, segs);
      tGeom.rotateX(-Math.PI / 2);
      const posAttr = tGeom.attributes.position;
      const colors = new Float32Array(posAttr.count * 3);
      const lowCol = new THREE.Color(tSpec.color || '#4d7c3f');
      const highCol = new THREE.Color(tSpec.ridgeColor || '#6b7280');

      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        const vy = sampleTerrainHeight(env, vx, vz);
        posAttr.setY(i, vy);
        const blend = Math.max(0, Math.min(1, (vy - (tSpec.baseY || 0) + 1.5) / 4.8));
        const c = lowCol.clone().lerp(highCol, blend * 0.65);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      tGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      tGeom.computeVertexNormals();
      terrainMesh = new THREE.Mesh(
        tGeom,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: tSpec.roughness ?? 0.88,
          metalness: tSpec.metalness ?? 0.04
        })
      );
      terrainMesh.receiveShadow = true;
      terrainMesh.userData = { pickKind: 'ground' };
      threeScene.add(terrainMesh);
    }

    // Helipads (H1 & H2)
    const pickableObjects = [];
    if (terrainMesh) pickableObjects.push(terrainMesh);

    if (Array.isArray(env.pads)) {
      for (const pad of env.pads) {
        const pr = Number(pad.radius || 4.2);
        const padGroup = new THREE.Group();
        padGroup.position.set(pad.pos[0], pad.pos[1], pad.pos[2]);

        const baseCyl = new THREE.Mesh(
          new THREE.CylinderGeometry(pr, pr + 0.5, 0.36, 32),
          new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.75, metalness: 0.15 })
        );
        baseCyl.position.y = -0.17;
        baseCyl.receiveShadow = true;
        baseCyl.castShadow = true;

        const topDisc = new THREE.Mesh(
          new THREE.CylinderGeometry(pr * 0.96, pr * 0.96, 0.05, 32),
          new THREE.MeshStandardMaterial({
            map: makeHelipadTexture(pad.code || 'H', pad.color, pad.ringColor),
            roughness: 0.65,
            metalness: 0.1
          })
        );
        topDisc.position.y = 0.02;
        topDisc.receiveShadow = true;
        topDisc.userData = { pickKind: 'ground' };
        pickableObjects.push(topDisc);

        padGroup.add(baseCyl, topDisc);
        threeScene.add(padGroup);
      }
    }

    // Volumetric 3D Obstacles (Tower, Hangar, Radar building, Rocks)
    if (Array.isArray(env.obstacles)) {
      for (const ob of env.obstacles) {
        const obGroup = new THREE.Group();
        const [sx, sy, sz] = ob.size || [4, 5, 4];
        const gy = sampleTerrainHeight(env, ob.pos[0], ob.pos[2]);
        obGroup.position.set(ob.pos[0], gy, ob.pos[2]);

        const baseMat = new THREE.MeshStandardMaterial({
          color: ob.color || '#64748b',
          roughness: ob.roughness ?? 0.55,
          metalness: ob.metalness ?? 0.3
        });
        const accentMat = new THREE.MeshStandardMaterial({
          color: ob.accentColor || '#facc15',
          roughness: 0.35,
          metalness: 0.4
        });

        if (ob.type === 'tower') {
          const shaft = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.58, sy * 0.78, sz * 0.58), baseMat);
          shaft.position.y = sy * 0.39;
          shaft.castShadow = true;
          shaft.receiveShadow = true;
          const cab = new THREE.Mesh(
            new THREE.CylinderGeometry(sx * 0.56, sx * 0.46, sy * 0.2, 8),
            new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.15, metalness: 0.8 })
          );
          cab.position.y = sy * 0.86;
          cab.castShadow = true;
          const roof = new THREE.Mesh(new THREE.ConeGeometry(sx * 0.6, 1.2, 8), accentMat);
          roof.position.y = sy + 0.3;
          obGroup.add(shaft, cab, roof);
        } else if (ob.type === 'hangar') {
          const walls = new THREE.Mesh(new THREE.BoxGeometry(sx, sy * 0.68, sz), baseMat);
          walls.position.y = sy * 0.34;
          walls.castShadow = true;
          walls.receiveShadow = true;
          const arch = new THREE.Mesh(new THREE.CylinderGeometry(sz * 0.5, sz * 0.5, sx, 18, 1, false, 0, Math.PI), accentMat);
          arch.rotation.z = Math.PI / 2;
          arch.rotation.y = Math.PI / 2;
          arch.position.y = sy * 0.68;
          arch.scale.set(1, 0.55, 1);
          arch.castShadow = true;
          obGroup.add(walls, arch);
        } else if (ob.type === 'rock') {
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.max(sx, sz) * 0.52, 1), baseMat);
          rock.position.y = sy * 0.42;
          rock.scale.set(1.1, sy / Math.max(1, sx), 0.92);
          rock.castShadow = true;
          rock.receiveShadow = true;
          obGroup.add(rock);
        } else {
          const body = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), baseMat);
          body.position.y = sy * 0.5;
          body.castShadow = true;
          body.receiveShadow = true;
          const band = new THREE.Mesh(new THREE.BoxGeometry(sx * 1.03, 0.45, sz * 1.03), accentMat);
          band.position.y = sy * 0.88;
          obGroup.add(body, band);
        }

        obGroup.traverse((child) => {
          if (child.isMesh) {
            child.userData = { pickKind: 'part', partId: ob.id, label: ob.label || ob.id };
            pickableObjects.push(child);
          }
        });
        threeScene.add(obGroup);
      }
    }

    // Trees, Bendable Grass Blades & Distant Mountain Silhouette
    const grassBlades = [];
    if (env.foliage) {
      const seed = Number(env.foliage.seed || 2401);
      const pseudo = (n) => {
        const x = Math.sin(n * 91.7 + seed) * 43758.5453;
        return x - Math.floor(x);
      };

      const trunkMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 });
      const pineMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.82 });
      const treeCount = Number(env.foliage.treeCount || 36);
      for (let i = 0; i < treeCount; i++) {
        const ang = pseudo(i * 3 + 1) * Math.PI * 2;
        const dist = 26 + pseudo(i * 3 + 2) * 38;
        const tx = Math.cos(ang) * dist;
        const tz = Math.sin(ang) * dist;
        // Keep clear of helipads
        const nearPad = (env.pads || []).some((p) => Math.hypot(tx - p.pos[0], tz - p.pos[2]) < 9.5);
        if (nearPad) continue;
        const ty = sampleTerrainHeight(env, tx, tz);
        const tGrp = new THREE.Group();
        tGrp.position.set(tx, ty, tz);
        const s = 0.8 + pseudo(i * 3 + 3) * 0.65;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.26 * s, 1.4 * s, 7), trunkMat);
        trunk.position.y = 0.7 * s;
        const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.35 * s, 2.8 * s, 8), pineMat);
        c1.position.y = 2.2 * s;
        c1.castShadow = true;
        const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.0 * s, 2.3 * s, 8), pineMat);
        c2.position.y = 3.5 * s;
        c2.castShadow = true;
        tGrp.add(trunk, c1, c2);
        threeScene.add(tGrp);
      }

      // Grass blade clusters around H1, valley path, and H2 (bend under helicopter downwash!)
      const grassMat = new THREE.MeshStandardMaterial({ color: '#65a30d', roughness: 0.78 });
      const bladeGeom = new THREE.ConeGeometry(0.09, 0.68, 4);
      bladeGeom.translate(0, 0.34, 0);
      const gCount = Number(env.foliage.grassClusters || 110);
      for (let i = 0; i < gCount; i++) {
        const gx = -26 + pseudo(i * 5 + 10) * 56;
        const gz = -18 + pseudo(i * 5 + 11) * 36;
        const onPad = (env.pads || []).some((p) => Math.hypot(gx - p.pos[0], gz - p.pos[2]) < (p.radius || 4.2) + 0.4);
        if (onPad) continue;
        const gy = sampleTerrainHeight(env, gx, gz);
        const tuft = new THREE.Group();
        tuft.position.set(gx, gy, gz);
        for (let b = 0; b < 3; b++) {
          const bl = new THREE.Mesh(bladeGeom, grassMat);
          bl.position.set((b - 1) * 0.14, 0, (b % 2) * 0.12);
          bl.rotation.y = b * 1.1;
          tuft.add(bl);
        }
        threeScene.add(tuft);
        grassBlades.push(tuft);
      }
    }

    if (env.distantPeaks) {
      const dp = env.distantPeaks;
      const peakMat = new THREE.MeshStandardMaterial({ color: dp.color || '#475569', roughness: 0.92, fog: true });
      const count = Number(dp.count || 16);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const r = Number(dp.radius || 110);
        const h = Number(dp.minHeight || 16) + ((i * 37) % 19);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(18 + (i % 4) * 5, h, 7), peakMat);
        cone.position.set(Math.cos(a) * r, h * 0.42 - 2, Math.sin(a) * r);
        threeScene.add(cone);
      }
    }

    // Build Declarative Node Hierarchy (Helicopter #24 parts or generic scene nodes!)
    const nodeMap = new Map();
    const baseTransforms = new Map();

    for (const nSpec of sceneResource.nodes || []) {
      const obj = buildDeclarativeNodeMesh(nSpec);
      obj.name = nSpec.id;
      const [px, py, pz] = nSpec.pos || [0, 0, 0];
      const [rx, ry, rz] = nSpec.rot || [0, 0, 0];
      const [sx, sy, sz] = nSpec.scale || [1, 1, 1];
      obj.position.set(px, py, pz);
      obj.rotation.set(rx, ry, rz, 'YXZ');
      obj.scale.set(sx, sy, sz);

      obj.traverse((ch) => {
        if (ch.isMesh && ch.name !== '__rotor_blur__') {
          if (nSpec.castShadow) ch.castShadow = true;
          if (nSpec.receiveShadow) ch.receiveShadow = true;
          ch.userData = {
            pickKind: 'part',
            partId: nSpec.id,
            label: nSpec.label || nSpec.id
          };
          pickableObjects.push(ch);
        }
      });

      nodeMap.set(nSpec.id, obj);
      baseTransforms.set(nSpec.id, { pos: [px, py, pz], rot: [rx, ry, rz], scale: [sx, sy, sz] });
    }

    for (const nSpec of sceneResource.nodes || []) {
      const obj = nodeMap.get(nSpec.id);
      if (nSpec.parentId && nodeMap.has(nSpec.parentId)) {
        nodeMap.get(nSpec.parentId).add(obj);
      } else {
        threeScene.add(obj);
      }
    }

    // Dynamic pools for 3D Debris, Dust/Smoke Puffs, Fireballs & Sparks
    const dynamicGroup = new THREE.Group();
    threeScene.add(dynamicGroup);

    const fireLight = new THREE.PointLight('#fb923c', 0, 26);
    threeScene.add(fireLight);

    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.25, 260);

    const bundle = {
      threeScene,
      camera,
      sunLight,
      nodeMap,
      baseTransforms,
      grassBlades,
      dynamicGroup,
      fireLight,
      pickableObjects,
      debrisPool: [],
      sphereGeom: new THREE.SphereGeometry(1, 12, 10),
      boxGeom: new THREE.BoxGeometry(1, 1, 1)
    };
    this.sceneCache.set(resourceSig, bundle);
    return bundle;
  }

  applyStateToBundle(bundle, packet, aspect) {
    const { nodeMap, baseTransforms, grassBlades, dynamicGroup, fireLight, sunLight, camera } = bundle;
    const pose = packet.pose;
    const fx = packet.fx;
    const sceneResource = packet.sceneResource;

    // 1. Reset & apply nodeOverrides
    for (const [id, obj] of nodeMap.entries()) {
      const base = baseTransforms.get(id);
      const ov = pose && pose.nodeOverrides ? pose.nodeOverrides[id] : null;
      obj.visible = !(ov && ov.hidden);
      const p = ov && ov.pos ? ov.pos : base.pos;
      const r = ov && ov.rot ? ov.rot : base.rot;
      obj.position.set(p[0], p[1], p[2]);
      obj.rotation.set(r[0], r[1], r[2], 'YXZ');

      const blurChild = obj.getObjectByName('__rotor_blur__');
      if (blurChild && blurChild.material) {
        const ba = ov && ov.blurAlpha !== undefined ? Number(ov.blurAlpha) : 0;
        blurChild.material.opacity = ba * 0.34;
        blurChild.visible = ba > 0.03;
      }
    }

    // Keep directional shadow frustum centered near aircraft for crisp ground & self shadows
    if (sunLight && pose && pose.craftSummary) {
      const cp = pose.craftSummary.pos;
      sunLight.target.position.set(cp[0], cp[1], cp[2]);
      sunLight.position.set(cp[0] + 34, cp[1] + 46, cp[2] + 26);
      sunLight.target.updateMatrixWorld();
    }

    // 2. Grass bending under rotor downwash
    const gb = fx && fx.grassBend ? fx.grassBend : null;
    for (const tuft of grassBlades) {
      if (!gb || gb.strength <= 0.02) {
        tuft.rotation.set(0, 0, 0);
      } else {
        const dx = tuft.position.x - gb.center[0];
        const dz = tuft.position.z - gb.center[2];
        const dist = Math.hypot(dx, dz);
        if (dist < gb.radius && dist > 0.05) {
          const factor = (1 - dist / gb.radius) * gb.strength * 0.95;
          tuft.rotation.set((dz / dist) * factor, 0, -(dx / dist) * factor);
        } else {
          tuft.rotation.set(0, 0, 0);
        }
      }
    }

    // 3. Rebuild transient 3D Debris + Volumetric Smoke/Dust/Fire/Sparks for exact frameTime
    while (dynamicGroup.children.length > 0) {
      const ch = dynamicGroup.children.pop();
      if (ch.material && ch.material.dispose) ch.material.dispose();
    }

    const dynamicPickables = [];
    if (pose && Array.isArray(pose.debris)) {
      for (const deb of pose.debris) {
        const mat = new THREE.MeshStandardMaterial({
          color: deb.color || '#5b21b6',
          roughness: 0.42,
          metalness: 0.35
        });
        const mesh = new THREE.Mesh(bundle.boxGeom, mat);
        mesh.position.set(deb.pos[0], deb.pos[1], deb.pos[2]);
        mesh.rotation.set(deb.rot[0], deb.rot[1], deb.rot[2], 'YXZ');
        mesh.scale.set(deb.size[0], deb.size[1], deb.size[2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
          pickKind: 'part',
          partId: deb.partId || deb.id,
          label: deb.label || deb.id
        };
        dynamicGroup.add(mesh);
        dynamicPickables.push(mesh);
      }
    }

    if (fx) {
      // Downwash dust puffs
      if (fx.downwash && Array.isArray(fx.downwash.puffs)) {
        for (const pf of fx.downwash.puffs) {
          if (pf.alpha <= 0.02) continue;
          const m = new THREE.Mesh(
            bundle.sphereGeom,
            new THREE.MeshStandardMaterial({
              color: '#d6b88d',
              roughness: 0.95,
              transparent: true,
              opacity: pf.alpha,
              depthWrite: false
            })
          );
          m.position.set(pf.pos[0], pf.pos[1], pf.pos[2]);
          m.scale.set(pf.radius * 1.35, pf.radius * 0.55, pf.radius * 1.35);
          dynamicGroup.add(m);
        }
      }

      // 3D Smoke & Shockwave Dust Puffs (depth-tested against terrain & fuselage!)
      if (Array.isArray(fx.smokePuffs)) {
        for (const sm of fx.smokePuffs) {
          if (sm.alpha <= 0.02) continue;
          const gVal = Math.max(0.08, Math.min(0.75, Number(sm.darkness ?? 0.2)));
          const col = new THREE.Color(gVal, gVal * 0.96, gVal * 0.92);
          const m = new THREE.Mesh(
            bundle.sphereGeom,
            new THREE.MeshStandardMaterial({
              color: col,
              roughness: 0.96,
              transparent: true,
              opacity: sm.alpha,
              depthWrite: false
            })
          );
          m.position.set(sm.pos[0], sm.pos[1], sm.pos[2]);
          m.scale.setScalar(sm.radius);
          dynamicGroup.add(m);
        }
      }

      // 3D Impact Fireballs & Sparks
      let maxFire = 0;
      let fireCenter = null;
      if (Array.isArray(fx.fireBalls)) {
        for (const fb of fx.fireBalls) {
          if (fb.alpha <= 0.02) continue;
          const heat = Number(fb.heat ?? 0.8);
          const fCol = new THREE.Color().setHSL(0.04 + heat * 0.08, 1.0, 0.45 + heat * 0.25);
          const m = new THREE.Mesh(
            bundle.sphereGeom,
            new THREE.MeshBasicMaterial({
              color: fCol,
              transparent: true,
              opacity: fb.alpha
            })
          );
          m.position.set(fb.pos[0], fb.pos[1], fb.pos[2]);
          m.scale.setScalar(fb.radius);
          dynamicGroup.add(m);
          if (fb.alpha > maxFire) {
            maxFire = fb.alpha;
            fireCenter = fb.pos;
          }
        }
      }
      if (maxFire > 0.05 && fireCenter) {
        fireLight.intensity = maxFire * 8.5;
        fireLight.position.set(fireCenter[0], fireCenter[1] + 1.2, fireCenter[2]);
      } else {
        fireLight.intensity = 0;
      }

      if (Array.isArray(fx.sparks)) {
        for (const spk of fx.sparks) {
          const m = new THREE.Mesh(
            bundle.boxGeom,
            new THREE.MeshBasicMaterial({ color: '#fef08a' })
          );
          m.position.set(spk.pos[0], spk.pos[1], spk.pos[2]);
          m.scale.setScalar(Math.max(0.06, spk.size || 0.1));
          dynamicGroup.add(m);
        }
      }
    } else {
      fireLight.intensity = 0;
    }

    // 4. Camera setup (independent aspect ratio per viewport, zero stretching!)
    const camSpec = packet.camera || {};
    const defCam = (sceneResource && sceneResource.cameras) || {};
    const eye = camSpec.eye || defCam.defaultEye || [8, 5, 10];
    const target = camSpec.target || defCam.defaultTarget || [0, 1, 0];
    camera.fov = Number(camSpec.fov || defCam.fov || 46);
    camera.aspect = Math.max(0.2, aspect);
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    bundle.currentPickables = [...bundle.pickableObjects, ...dynamicPickables];
  }

  render3DViewport(viewKey, targetCanvas, packet) {
    if (!targetCanvas || !packet || !packet.sceneResource) return;
    const rect = targetCanvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pixelW = Math.max(64, Math.min(2560, Math.round((rect.width || targetCanvas.clientWidth || 480) * dpr)));
    const pixelH = Math.max(48, Math.min(1600, Math.round((rect.height || targetCanvas.clientHeight || 300) * dpr)));

    if (targetCanvas.width !== pixelW || targetCanvas.height !== pixelH) {
      targetCanvas.width = pixelW;
      targetCanvas.height = pixelH;
    }

    const sig = JSON.stringify({
      w: pixelW,
      h: pixelH,
      sc: packet.scenePath,
      ft: packet.frameTime,
      cam: packet.camera,
      poseT: packet.pose ? packet.pose.frameTime : -1,
      poseOv: packet.pose ? packet.pose.nodeOverrides : null,
      fxT: packet.fx ? fxSig(packet.fx) : -1
    });

    this.lastPackets.set(viewKey, { canvas: targetCanvas, packet });
    if (this.contextLost) return;
    if (this.lastFrameSig.get(viewKey) === sig) {
      return; // Identical submission -> identical frame, zero redundant GPU work!
    }
    this.lastFrameSig.set(viewKey, sig);

    const bundle = this.getOrBuildSceneBundle(packet.sceneResource);
    this.applyStateToBundle(bundle, packet, pixelW / pixelH);

    if (this.glCanvas.width < pixelW || this.glCanvas.height < pixelH) {
      this.renderer.setSize(Math.max(this.glCanvas.width, pixelW), Math.max(this.glCanvas.height, pixelH), false);
    }

    this.renderer.setViewport(0, 0, pixelW, pixelH);
    this.renderer.setScissor(0, 0, pixelW, pixelH);
    this.renderer.setScissorTest(true);
    this.renderer.render(bundle.threeScene, bundle.camera);

    const ctx2d = targetCanvas.getContext('2d');
    if (ctx2d) {
      // In WebGL viewport (0, 0) is bottom-left, so source rect starts at glCanvas.height - pixelH
      const srcY = this.glCanvas.height - pixelH;
      ctx2d.clearRect(0, 0, pixelW, pixelH);
      ctx2d.drawImage(this.glCanvas, 0, srcY, pixelW, pixelH, 0, 0, pixelW, pixelH);
    }
  }

  pick3DViewport(viewKey, normX, normY) {
    const entry = this.lastPackets.get(viewKey);
    if (!entry || !entry.packet || !entry.packet.sceneResource) return null;
    const { canvas, packet } = entry;
    const aspect = (canvas.width || 480) / Math.max(1, canvas.height || 300);
    const bundle = this.getOrBuildSceneBundle(packet.sceneResource);
    this.applyStateToBundle(bundle, packet, aspect);
    bundle.threeScene.updateMatrixWorld(true);

    const ndc = new THREE.Vector2(normX * 2 - 1, -(normY * 2 - 1));
    this.raycaster.setFromCamera(ndc, bundle.camera);
    const hits = this.raycaster.intersectObjects(bundle.currentPickables || bundle.pickableObjects, true);
    if (!hits || hits.length === 0) return null;

    // Prefer craft parts over ground if near silhouette, otherwise exact closest intersection
    const top = hits[0];
    let cur = top.object;
    while (cur && (!cur.userData || !cur.userData.pickKind)) {
      cur = cur.parent;
    }
    if (!cur || !cur.userData) return null;
    if (cur.userData.pickKind === 'part') {
      return {
        kind: 'part',
        partId: cur.userData.partId,
        label: cur.userData.label,
        point: [top.point.x, top.point.y, top.point.z]
      };
    }
    return {
      kind: 'ground',
      point: [top.point.x, top.point.y, top.point.z]
    };
  }

  redrawAllActiveViews() {
    this.lastFrameSig.clear();
    for (const [viewKey, entry] of this.lastPackets.entries()) {
      if (entry.canvas && entry.canvas.isConnected) {
        this.render3DViewport(viewKey, entry.canvas, entry.packet);
      } else {
        this.lastPackets.delete(viewKey);
      }
    }
  }

  // Test hook to verify WebGL context loss & restoration resilience
  simulateContextLossAndRestore() {
    const ext = this.renderer.getContext().getExtension('WEBGL_lose_context');
    if (ext) {
      ext.loseContext();
      setTimeout(() => ext.restoreContext(), 120);
    }
  }
}

function fxSig(fx) {
  return [
    fx.frameTime,
    fx.downwash ? fx.downwash.strength.toFixed(2) : 0,
    fx.smokePuffs ? fx.smokePuffs.length : 0,
    fx.fireBalls ? fx.fireBalls.length : 0
  ].join(':');
}

export function render2DChartCanvas(canvas, surface) {
  if (!canvas || !surface || !surface.geometry) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = Math.max(220, rect.width || canvas.clientWidth || 500);
  const cssH = Math.max(140, rect.height || canvas.clientHeight || 250);
  const pw = Math.round(cssW * dpr);
  const ph = Math.round(cssH * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const g = surface.geometry;
  const scaleX = pw / g.viewW;
  const scaleY = ph / g.viewH;

  ctx.save();
  ctx.clearRect(0, 0, pw, ph);
  ctx.scale(scaleX, scaleY);

  // Subtle chart background card
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, g.viewW, g.viewH);

  // Title & Legend
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 12px "Microsoft YaHei UI", "Segoe UI", sans-serif';
  const titleStr = surface.sourceTitle
    ? `${surface.sourceTitle} · ${surface.range} (v${surface.version || 0})`
    : '实时数据可视化视图';
  ctx.fillText(titleStr, 14, 18);

  if (Array.isArray(surface.series)) {
    let lx = g.viewW - 16;
    ctx.textAlign = 'right';
    ctx.font = '11px "Microsoft YaHei UI", sans-serif';
    for (let i = surface.series.length - 1; i >= 0; i--) {
      const s = surface.series[i];
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(s.name, lx, 18);
      lx -= ctx.measureText(s.name).width + 6;
      ctx.fillStyle = s.color || '#8b5cf6';
      ctx.fillRect(lx - 10, 9, 9, 9);
      lx -= 18;
    }
    ctx.textAlign = 'left';
  }

  // Gridlines & Y-axis ticks
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 1;
  ctx.font = '10px Consolas, monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  for (const tk of g.ticks || []) {
    ctx.beginPath();
    ctx.moveTo(g.padL, tk.y);
    ctx.lineTo(g.padL + g.plotW, tk.y);
    ctx.stroke();
    ctx.fillText(tk.label, g.padL - 7, tk.y + 3);
  }

  // Zero baseline
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.42)';
  ctx.beginPath();
  ctx.moveTo(g.padL, g.zeroY);
  ctx.lineTo(g.padL + g.plotW, g.zeroY);
  ctx.stroke();

  // Category labels
  ctx.textAlign = 'center';
  ctx.font = '11px "Microsoft YaHei UI", sans-serif';
  for (const cl of g.catLabels || []) {
    ctx.fillStyle = cl.active ? '#facc15' : '#cbd5e1';
    ctx.fillText(cl.text, cl.x, cl.y);
  }

  // Draw Bars or Lines
  const hitRegions = [];
  if (surface.chartType === 'bar') {
    for (const b of g.bars || []) {
      const isHovered = surface.hoverIndex === b.catIdx;
      const isSelected =
        surface.selectedPoint &&
        surface.selectedPoint.catIdx === b.catIdx &&
        surface.selectedPoint.seriesIdx === b.seriesIdx;

      ctx.fillStyle = b.color || '#8b5cf6';
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, [4, 4, 0, 0]);
      ctx.fill();

      if (isHovered || isSelected) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 10px Consolas, monospace';
      ctx.fillText(String(b.value), b.x + b.w / 2, b.y - 5);

      hitRegions.push({
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
        point: { catIdx: b.catIdx, seriesIdx: b.seriesIdx, label: b.label, seriesName: b.seriesName, value: b.value }
      });
    }
  } else {
    for (const ln of g.lines || []) {
      const pts = ln.points || [];
      if (pts.length === 0) continue;
      ctx.strokeStyle = ln.color || '#8b5cf6';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      pts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      for (const p of pts) {
        const isSel =
          surface.selectedPoint &&
          surface.selectedPoint.catIdx === p.catIdx &&
          surface.selectedPoint.seriesIdx === p.seriesIdx;
        ctx.fillStyle = isSel ? '#fde047' : ln.color || '#8b5cf6';
        ctx.beginPath();
        ctx.arc(p.x, p.y, isSel ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 10px Consolas, monospace';
        ctx.fillText(String(p.value), p.x, p.y - 8);
        hitRegions.push({
          x: p.x - 10,
          y: p.y - 10,
          w: 20,
          h: 20,
          point: { catIdx: p.catIdx, seriesIdx: p.seriesIdx, label: p.label, seriesName: p.seriesName, value: p.value }
        });
      }
    }
  }

  canvas.__chartHitRegions = { viewW: g.viewW, viewH: g.viewH, regions: hitRegions };
  ctx.restore();
}
