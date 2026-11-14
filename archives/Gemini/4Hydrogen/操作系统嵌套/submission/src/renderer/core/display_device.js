// Display Device & Shared Three.js WebGL2 Rendering Engine for Nested OS
// Owns:
// 1. Single shared offscreen THREE.WebGLRenderer (zero multi-context exhaustion across nested layers & projections)
// 2. Auto context-loss recovery rebuilding GPU resources from HostKernel stored scene resources
// 3. Data-driven 3D helicopter/terrain/obstacles/grass/particles/debris/lighting renderer + raycast picking
// 4. Declarative 2D Subsystem Desktop & App UI DOM reconciler (zero focus loss / zero canvas flicker)
// 5. Cross-layer Projection Viewport renderer & Real-time Chart Canvas renderer

import * as THREE from '../../../node_modules/three/build/three.module.js';
import { getAppIconSvg, getFileIconSvg } from '../assets/icons.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Analytical valley terrain heightfield — matches /System/player_scene.ns verbatim
export function terrainHeightAt(terrain, x, z) {
  if (!terrain) return 0;
  const baseY = terrain.baseY || 0;
  const hs = terrain.hillScale || 0;
  if (hs === 0) return baseY;
  const r = Math.hypot(x, z);
  const vr = terrain.valleyRadius || 38;
  let rim = 0;
  if (r > vr) {
    const d = r - vr;
    rim = Math.min(22, d * d * 0.0085);
  }
  const wave = (Math.sin(x * 0.075) * Math.cos(z * 0.068) + 0.45 * Math.sin((x + z) * 0.11)) * hs * 0.35;
  const d1 = Math.hypot(x + 22, z - 14);
  const d2 = Math.hypot(x - 22, z + 12);
  const f1 = clamp((d1 - 7) / 8, 0, 1);
  const f2 = clamp((d2 - 7) / 8, 0, 1);
  const blend = Math.min(f1, f2);
  let bumps = 0;
  if (Array.isArray(terrain.bumps)) {
    for (const b of terrain.bumps) {
      const db = Math.hypot(x - b.x, z - b.z);
      if (db < b.radius) {
        const k = 1 - db / b.radius;
        bumps += b.height * k * k;
      }
    }
  }
  return baseY + (rim + wave) * blend + bumps;
}

function pseudoRand(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Canvas texture for helipad markings (H1 / H2 + circle)
function makeHelipadTexture(label, accent) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle concrete noise
  for (let i = 0; i < 1600; i++) {
    const x = ((i * 397) % 512);
    const y = ((i * 743) % 512);
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(x, y, 3, 3);
  }

  ctx.strokeStyle = accent || '#facc15';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(256, 256, 210, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([28, 18]);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(256, 256, 176, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = accent || '#facc15';
  ctx.font = 'bold 148px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label || 'H', 256, 260);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Canvas livery texture for the #24 purple & yellow helicopter fuselage panels
function makeHelicopterLiveryTexture(livery) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  const primary = livery?.primary || '#5b21b6';
  const secondary = livery?.secondary || '#facc15';
  const trim = livery?.trim || '#1e1b4b';
  const numText = livery?.numberText || '24';

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, primary);
  grad.addColorStop(0.65, primary);
  grad.addColorStop(1, trim);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Diagonal racing stripes
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.moveTo(40, 188);
  ctx.lineTo(480, 92);
  ctx.lineTo(480, 134);
  ctx.lineTo(40, 226);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 18, 512, 6);

  // Sharp #24 emblem on side panel
  ctx.fillStyle = secondary;
  ctx.strokeStyle = trim;
  ctx.lineWidth = 8;
  ctx.font = '900 108px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(numText, 256, 128);
  ctx.fillText(numText, 256, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Sky gradient dome shader
function createSkyDome(env) {
  const top = new THREE.Color(env?.skyTop || '#1b3b6f');
  const horizon = new THREE.Color(env?.skyHorizon || '#e9b87c');
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: top },
      bottomColor: { value: horizon },
      sunDir: { value: new THREE.Vector3(...(env?.sunDir || [0.62, 0.54, 0.56])).normalize() }
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 sunDir;
      varying vec3 vWorldDir;
      void main() {
        float h = clamp(vWorldDir.y * 1.4 + 0.08, 0.0, 1.0);
        vec3 col = mix(bottomColor, topColor, pow(h, 0.65));
        float sunAmt = max(0.0, dot(normalize(vWorldDir), sunDir));
        col += vec3(1.0, 0.9, 0.72) * pow(sunAmt, 96.0) * 0.9;
        col += vec3(1.0, 0.76, 0.52) * pow(sunAmt, 12.0) * 0.25;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  return new THREE.Mesh(new THREE.SphereGeometry(260, 24, 16), mat);
}

// Build articulated purple/gold #24 helicopter group strictly from heroModel descriptor
function buildHelicopterRig(heroModel) {
  const livery = heroModel?.livery || {};
  const primaryCol = livery.primary || '#5b21b6';
  const secondaryCol = livery.secondary || '#facc15';
  const trimCol = livery.trim || '#1e1b4b';
  const glassCol = livery.glass || '#93c5fd';
  const metalCol = livery.metal || '#cbd5e1';

  const liveryTex = makeHelicopterLiveryTexture(livery);
  const bodyMat = new THREE.MeshStandardMaterial({ color: primaryCol, roughness: 0.34, metalness: 0.28 });
  const liveryMat = new THREE.MeshStandardMaterial({ map: liveryTex, roughness: 0.32, metalness: 0.25 });
  const accentMat = new THREE.MeshStandardMaterial({ color: secondaryCol, roughness: 0.3, metalness: 0.35 });
  const trimMat = new THREE.MeshStandardMaterial({ color: trimCol, roughness: 0.55, metalness: 0.45 });
  const metalMat = new THREE.MeshStandardMaterial({ color: metalCol, roughness: 0.32, metalness: 0.8 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: glassCol,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.76
  });

  const root = new THREE.Group();
  const partGroups = {};
  const interactiveMeshes = [];

  const registerPart = (partId, partName, group, baseColorHex) => {
    partGroups[partId] = group;
    group.userData.partId = partId;
    group.userData.partName = partName;
    group.traverse((ch) => {
      if (ch.isMesh) {
        ch.castShadow = true;
        ch.receiveShadow = true;
        ch.userData.partId = partId;
        ch.userData.partName = partName;
        ch.userData.baseColor = ch.material?.color ? ch.material.color.clone() : new THREE.Color(baseColorHex || primaryCol);
        interactiveMeshes.push(ch);
      }
    });
    root.add(group);
  };

  // 1. Fuselage (+Z nose forward so yaw=rot.y points nose along [sin(y), 0, cos(y)])
  const fuselageGroup = new THREE.Group();
  const cabinCore = new THREE.Mesh(new THREE.BoxGeometry(1.52, 1.32, 3.35), bodyMat.clone());
  cabinCore.position.set(0, 0.55, 0.2);
  fuselageGroup.add(cabinCore);

  // Curved livery flank panels displaying "24"
  const panelL = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 0.96), liveryMat.clone());
  panelL.position.set(-0.77, 0.58, 0.1);
  panelL.rotation.y = -Math.PI / 2;
  fuselageGroup.add(panelL);

  const panelR = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 0.96), liveryMat.clone());
  panelR.position.set(0.77, 0.58, 0.1);
  panelR.rotation.y = Math.PI / 2;
  fuselageGroup.add(panelR);

  // Nose cone (forward is +Z)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.78, 18, 14), bodyMat.clone());
  nose.scale.set(0.96, 0.76, 1.35);
  nose.position.set(0, 0.34, 1.9);
  fuselageGroup.add(nose);

  const noseStripe = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.16, 1.25), accentMat.clone());
  noseStripe.position.set(0, 0.25, 2.02);
  fuselageGroup.add(noseStripe);

  // Twin side sponsons
  for (const sx of [-0.9, 0.9]) {
    const sponson = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 2.2), accentMat.clone());
    sponson.position.set(sx, 0.08, -0.05);
    fuselageGroup.add(sponson);
  }
  registerPart('fuselage', '机身 (#24 紫金涂装)', fuselageGroup, primaryCol);

  // 2. Cockpit Glass
  const glassGroup = new THREE.Group();
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.72, 1.25), glassMat.clone());
  windshield.position.set(0, 0.88, 1.56);
  windshield.rotation.x = 0.42;
  glassGroup.add(windshield);
  for (const sx of [-0.76, 0.76]) {
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.95), glassMat.clone());
    sideWin.position.set(sx, 0.84, 0.95);
    glassGroup.add(sideWin);
  }
  registerPart('cockpit_glass', '座舱风挡', glassGroup, glassCol);

  // 3. Engine Cowling
  const cowlGroup = new THREE.Group();
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.66, 2.25, 14), trimMat.clone());
  cowl.rotation.x = Math.PI / 2;
  cowl.position.set(0, 1.45, -0.32);
  cowlGroup.add(cowl);
  const cowlStripe = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.14, 1.9), accentMat.clone());
  cowlStripe.position.set(0, 1.72, -0.26);
  cowlGroup.add(cowlStripe);
  for (const sx of [-0.3, 0.3]) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.5, 10), metalMat.clone());
    exhaust.rotation.x = Math.PI / 2 - 0.18;
    exhaust.position.set(sx, 1.48, -1.5);
    cowlGroup.add(exhaust);
  }
  registerPart('engine_cowling', '涡轴发动机舱', cowlGroup, trimCol);

  // 4. Left & Right Landing Skids (lowest point at y = -0.44 local so initial pos y=0.88 touches pad top y=0.44!)
  const makeSkid = (partId, partName, sign) => {
    const g = new THREE.Group();
    const xPos = sign * 0.94;
    const runner = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.6, 10), metalMat.clone());
    runner.rotation.x = Math.PI / 2;
    runner.position.set(xPos, -0.38, 0.18);
    g.add(runner);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.55, 8), accentMat.clone());
    tip.rotation.x = Math.PI / 2 - 0.65;
    tip.position.set(xPos, -0.22, 2.15);
    g.add(tip);
    for (const sz of [-0.65, 1.05]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 8), trimMat.clone());
      strut.position.set(xPos * 0.84, -0.14, sz);
      strut.rotation.z = sign * 0.36;
      g.add(strut);
    }
    registerPart(partId, partName, g, metalCol);
  };
  makeSkid('skid_left', '左起落架滑撬', -1);
  makeSkid('skid_right', '右起落架滑撬', 1);

  // 5. Main Rotor Hub
  const hubGroup = new THREE.Group();
  hubGroup.position.set(0, 1.85, 0.15);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.42, 12), metalMat.clone());
  hubGroup.add(mast);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.14, 12), accentMat.clone());
  cap.position.y = 0.2;
  hubGroup.add(cap);
  registerPart('main_rotor_hub', '主旋翼桨毂', hubGroup, metalCol);

  // 6. Main Rotor Blades (+ rotor blur disc)
  const bladesGroup = new THREE.Group();
  bladesGroup.position.set(0, 2.08, 0.15);
  for (let b = 0; b < 4; b++) {
    const arm = new THREE.Group();
    arm.rotation.y = (b * Math.PI) / 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 4.4), trimMat.clone());
    blade.position.z = 2.35;
    arm.add(blade);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.035, 0.48), accentMat.clone());
    tip.position.z = 4.35;
    arm.add(tip);
    bladesGroup.add(arm);
  }
  const blurDiscMat = new THREE.MeshBasicMaterial({
    color: secondaryCol,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const blurDisc = new THREE.Mesh(new THREE.RingGeometry(0.7, 4.6, 36), blurDiscMat);
  blurDisc.rotation.x = -Math.PI / 2;
  blurDisc.position.y = -0.01;
  bladesGroup.add(blurDisc);
  registerPart('main_rotor_blades', '主旋翼桨叶', bladesGroup, trimCol);

  // 7. Tail Boom
  const boomGroup = new THREE.Group();
  const boomTube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.34, 4.2, 12), bodyMat.clone());
  boomTube.rotation.x = Math.PI / 2;
  boomTube.position.set(0, 0.78, -3.55);
  boomGroup.add(boomTube);

  const boomStripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 3.6), accentMat.clone());
  boomStripe.position.set(0, 0.85, -3.4);
  boomGroup.add(boomStripe);

  const hStab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.56), accentMat.clone());
  hStab.position.set(0, 0.78, -4.65);
  boomGroup.add(hStab);

  const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.35, 0.82), bodyMat.clone());
  vFin.position.set(0, 1.35, -5.45);
  vFin.rotation.x = -0.25;
  boomGroup.add(vFin);

  const vFinTip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.76), accentMat.clone());
  vFinTip.position.set(0, 1.95, -5.58);
  vFinTip.rotation.x = -0.25;
  boomGroup.add(vFinTip);
  registerPart('tail_boom', '尾梁与水平安定面', boomGroup, primaryCol);

  // 8. Tail Rotor Blades
  const tailRotorGroup = new THREE.Group();
  tailRotorGroup.position.set(0.19, 1.72, -5.65);
  const trHub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 10), metalMat.clone());
  trHub.rotation.z = Math.PI / 2;
  tailRotorGroup.add(trHub);
  for (let b = 0; b < 4; b++) {
    const trArm = new THREE.Group();
    trArm.rotation.x = (b * Math.PI) / 2;
    const trBlade = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.78, 0.12), accentMat.clone());
    trBlade.position.y = 0.42;
    trArm.add(trBlade);
    tailRotorGroup.add(trArm);
  }
  registerPart('tail_rotor_blades', '尾桨叶', tailRotorGroup, secondaryCol);

  return {
    root,
    partGroups,
    interactiveMeshes,
    mainRotorPivot: bladesGroup,
    tailRotorPivot: tailRotorGroup,
    blurDiscMat,
    partsMeta: heroModel?.parts || []
  };
}

class ThreeSceneManager {
  constructor(hostKernel) {
    this.hostKernel = hostKernel;
    this.renderer = null;
    this.contextLost = false;
    this.scenes = new Map(); // key = `${sysId}::${playerId}`
    this.initRenderer();
  }

  initRenderer() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.contextLost = true;
      });
      canvas.addEventListener('webglcontextrestored', () => {
        this.contextLost = false;
        // Rebuild all active loaded scenes on context restore
        const entries = Array.from(this.scenes.values());
        for (const rec of entries) {
          this.loadScene(rec.sysId, rec.playerId, rec.resource);
        }
      });
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      });
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.06;
    } catch (err) {
      this.renderer = null;
      console.warn('WebGLRenderer unavailable, using 2D HUD fallback:', err);
    }
  }

  disposeSceneRecord(rec) {
    if (!rec) return;
    rec.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
  }

  loadScene(sysId, playerId, res) {
    const key = `${sysId}::${playerId}`;
    const prev = this.scenes.get(key);
    if (prev) this.disposeSceneRecord(prev);

    const scene = new THREE.Scene();
    const env = res?.environment || {};
    scene.fog = new THREE.FogExp2(env.fogColor || '#c9a684', env.fogDensity ?? 0.004);

    // Sky Dome
    scene.add(createSkyDome(env));

    // Lights
    const hemi = new THREE.HemisphereLight(
      env.ambientColor || '#93c5fd',
      '#57534e',
      env.ambientIntensity ?? 0.78
    );
    scene.add(hemi);

    const sunDir = env.sunDir || [0.62, 0.54, 0.56];
    const sun = new THREE.DirectionalLight(env.sunColor || '#ffe7c4', env.sunIntensity ?? 2.5);
    sun.position.set(sunDir[0] * 75, sunDir[1] * 75, sunDir[2] * 75);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 190;
    const d = 55;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.4, 500);
    camera.position.set(-6, 12, 32);

    const rec = {
      key,
      sysId,
      playerId,
      resource: res,
      scene,
      camera,
      isGeneric: Boolean(res?.isGeneric),
      terrainMesh: null,
      heliRig: null,
      debrisMeshes: new Map(),
      genericMeshes: new Map(),
      beaconMeshes: [],
      grassInstanced: null,
      grassMeta: [],
      waypointRing: null,
      fxPools: null
    };

    if (res?.isGeneric) {
      // Build generic .scene objects + base ground grid
      const groundMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.85, metalness: 0.1 });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      rec.terrainMesh = ground;
      scene.add(new THREE.GridHelper(100, 40, '#64748b', '#1e293b'));

      for (const ent of res.entities || []) {
        let geom;
        const sz = ent.size || [2, 2, 2];
        if (ent.shape === 'sphere') geom = new THREE.SphereGeometry(ent.radius || 1.2, 20, 16);
        else if (ent.shape === 'cylinder') geom = new THREE.CylinderGeometry(ent.radius || 1, ent.radius || 1, ent.height || 2, 16);
        else if (ent.shape === 'cone') geom = new THREE.ConeGeometry(ent.radius || 1.2, ent.height || 2.4, 16);
        else geom = new THREE.BoxGeometry(sz[0], sz[1], sz[2]);
        const mat = new THREE.MeshStandardMaterial({
          color: ent.color || '#60a5fa',
          roughness: ent.roughness ?? 0.45,
          metalness: ent.metalness ?? 0.25
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(...(ent.pos || [0, 1, 0]));
        mesh.userData.partId = ent.id;
        mesh.userData.partName = ent.name || ent.id;
        scene.add(mesh);
        rec.genericMeshes.set(ent.id, mesh);
      }
      this.scenes.set(key, rec);
      return;
    }

    // Terrain Heightfield Mesh
    const tCfg = res?.terrain || { size: 220, baseY: 0, hillScale: 3.4, valleyRadius: 38 };
    const tSize = tCfg.size || 220;
    const tGeo = new THREE.PlaneGeometry(tSize, tSize, 88, 88);
    tGeo.rotateX(-Math.PI / 2);
    const posAttr = tGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const grassColor = new THREE.Color('#3d6a36');
    const ridgeColor = new THREE.Color('#5a6554');
    const peakColor = new THREE.Color('#6b7280');
    const apronColor = new THREE.Color('#475569');
    const tmpCol = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = terrainHeightAt(tCfg, vx, vz);
      posAttr.setY(i, vy);
      const dPad1 = Math.hypot(vx + 22, vz - 14);
      const dPad2 = Math.hypot(vx - 22, vz + 12);
      if (dPad1 < 9.5 || dPad2 < 9.5) {
        tmpCol.copy(apronColor).lerp(grassColor, clamp((Math.min(dPad1, dPad2) - 5.5) / 4.0, 0, 1));
      } else {
        const hNorm = clamp(vy / 14.0, 0, 1);
        tmpCol.copy(grassColor).lerp(ridgeColor, clamp(hNorm * 1.4, 0, 1)).lerp(peakColor, clamp((hNorm - 0.5) * 1.5, 0, 1));
      }
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }
    tGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    tGeo.computeVertexNormals();
    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.03
    });
    const terrainMesh = new THREE.Mesh(tGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
    rec.terrainMesh = terrainMesh;

    // Helipads
    for (const pad of res?.helipads || []) {
      const r = pad.radius || 5.5;
      const h = pad.height || 0.44;
      const topTex = makeHelipadTexture(pad.label, pad.accent);
      const sideMat = new THREE.MeshStandardMaterial({ color: pad.color || '#334155', roughness: 0.7, metalness: 0.2 });
      const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.65, metalness: 0.15 });
      const padMesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.4, h, 24), [sideMat, topMat, sideMat]);
      padMesh.position.set(pad.pos[0], pad.pos[1], pad.pos[2]);
      padMesh.receiveShadow = true;
      padMesh.castShadow = true;
      scene.add(padMesh);
    }

    // Obstacles & Airport Buildings
    for (const ob of res?.obstacles || []) {
      let mesh;
      if (ob.shape === 'cylinder') {
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(ob.radius || 1.5, ob.radius || 1.5, ob.height || 4, 16),
          new THREE.MeshStandardMaterial({ color: ob.color || '#94a3b8', roughness: ob.roughness ?? 0.5, metalness: ob.metalness ?? 0.4 })
        );
      } else {
        const sz = ob.size || [4, 4, 4];
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(sz[0], sz[1], sz[2]),
          new THREE.MeshStandardMaterial({ color: ob.color || '#94a3b8', roughness: ob.roughness ?? 0.5, metalness: ob.metalness ?? 0.3 })
        );
      }
      mesh.position.set(ob.pos[0], ob.pos[1], ob.pos[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      if (ob.accent && ob.shape === 'box' && ob.id !== 'rock_outcrop') {
        const sz = ob.size || [4, 4, 4];
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(sz[0] + 0.08, 0.35, sz[2] + 0.08),
          new THREE.MeshStandardMaterial({ color: ob.accent, roughness: 0.35, metalness: 0.5 })
        );
        band.position.set(ob.pos[0], ob.pos[1] + sz[1] * 0.25, ob.pos[2]);
        scene.add(band);
      }
      if (ob.hasBeacon) {
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 12, 10),
          new THREE.MeshBasicMaterial({ color: '#ef4444' })
        );
        const topY = ob.pos[1] + ((ob.size ? ob.size[1] : ob.height) || 10) * 0.5 + 3.6;
        beacon.position.set(ob.pos[0], topY, ob.pos[2]);
        scene.add(beacon);
        rec.beaconMeshes.push(beacon);
      }
    }

    // Conifer Pine Trees
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#274e2d', roughness: 0.85 });
    for (const tr of res?.trees || []) {
      const sc = tr.scale || 1.1;
      const gy = terrainHeightAt(tCfg, tr.pos[0], tr.pos[2]);
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * sc, 0.32 * sc, 2.2 * sc, 8), trunkMat);
      trunk.position.y = 1.1 * sc;
      trunk.castShadow = true;
      g.add(trunk);
      for (let tier = 0; tier < 3; tier++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry((1.8 - tier * 0.38) * sc, (2.6 - tier * 0.3) * sc, 9), leafMat);
        cone.position.y = (2.4 + tier * 1.45) * sc;
        cone.castShadow = true;
        cone.receiveShadow = true;
        g.add(cone);
      }
      g.position.set(tr.pos[0], gy, tr.pos[2]);
      scene.add(g);
    }

    // Dynamic Instanced Grass Field (responds smoothly to wind + rotor downwash!)
    const gCount = Math.min(1800, tCfg.grassCount || 1500);
    const gArea = tCfg.grassArea || 90;
    const bladeGeo = new THREE.ConeGeometry(0.06, 0.62, 4);
    bladeGeo.translate(0, 0.31, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#4d7c3f', roughness: 0.85 });
    const instGrass = new THREE.InstancedMesh(bladeGeo, bladeMat, gCount);
    const rng = pseudoRand(242424);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < gCount; i++) {
      let gx = (rng() - 0.5) * gArea * 1.8;
      let gz = (rng() - 0.5) * gArea * 1.5;
      // Avoid planting grass onto concrete helipads or main hangar
      if (Math.hypot(gx + 22, gz - 14) < 6.4 || Math.hypot(gx - 22, gz + 12) < 6.4) {
        gx += 14;
      }
      const gy = terrainHeightAt(tCfg, gx, gz);
      const scaleY = 0.65 + rng() * 0.85;
      const yaw = rng() * Math.PI * 2;
      rec.grassMeta.push({ x: gx, y: gy, z: gz, scaleY, yaw, phase: rng() * Math.PI * 2 });
      dummy.position.set(gx, gy, gz);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, scaleY, 1);
      dummy.updateMatrix();
      instGrass.setMatrixAt(i, dummy.matrix);
    }
    instGrass.instanceMatrix.needsUpdate = true;
    scene.add(instGrass);
    rec.grassInstanced = instGrass;

    // Hero #24 Articulated Helicopter
    if (res?.heroModel) {
      rec.heliRig = buildHelicopterRig(res.heroModel);
      rec.heliRig.root.position.set(-22, 0.88, 14);
      rec.heliRig.root.rotation.set(0, 0.85, 0);
      scene.add(rec.heliRig.root);
    }

    // Rehearsal target waypoint marker
    const wpGeo = new THREE.RingGeometry(1.1, 1.55, 28);
    wpGeo.rotateX(-Math.PI / 2);
    const wpMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.72, side: THREE.DoubleSide });
    rec.waypointRing = new THREE.Mesh(wpGeo, wpMat);
    rec.waypointRing.visible = false;
    scene.add(rec.waypointRing);

    // Preallocated Particle FX Pools (analytical deterministic evaluation!)
    rec.fxPools = {
      dust: this.createParticlePool(scene, 70, '#d6c29f', 0.22),
      smoke: this.createParticlePool(scene, 65, '#334155', 0.78),
      sparks: this.createParticlePool(scene, 45, '#fbbf24', 0.14),
      fire: this.createParticlePool(scene, 40, '#f97316', 1.15)
    };

    this.scenes.set(key, rec);
  }

  createParticlePool(scene, count, color, baseOpacity) {
    const geo = new THREE.SphereGeometry(0.45, 7, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: baseOpacity, depthWrite: false });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.frustumCulled = false;
    const dummy = new THREE.Object3D();
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (let i = 0; i < count; i++) inst.setMatrixAt(i, dummy.matrix);
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
    return { inst, count };
  }

  applyCamera(rec, frame) {
    const cam = rec.camera;
    if (rec.isGeneric) {
      const orb = frame?.cameraOrbit || { yaw: 0.65, pitch: 0.4, dist: 22 };
      const dist = orb.dist || 22;
      const yaw = orb.yaw ?? 0.65;
      const pitch = orb.pitch ?? 0.4;
      cam.position.set(
        Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist + 2,
        Math.cos(yaw) * Math.cos(pitch) * dist
      );
      cam.lookAt(0, 1.5, 0);
      return;
    }

    const hp = frame?.heliPose || { pos: [-22, 0.88, 14], rot: [0, 0.85, 0] };
    const focus = frame?.crashed && frame?.crashPos
      ? new THREE.Vector3(frame.crashPos[0], frame.crashPos[1] + 1.2, frame.crashPos[2])
      : new THREE.Vector3(hp.pos[0], hp.pos[1] + 0.9, hp.pos[2]);

    const mode = frame?.cameraMode || 'cinematic';
    const orb = frame?.cameraOrbit || { yaw: 0.65, pitch: 0.36, dist: 24 };
    const t = frame?.frameTime ?? 0;

    if (mode === 'orbit') {
      const dist = orb.dist || 24;
      const yaw = orb.yaw ?? 0.65;
      const pitch = orb.pitch ?? 0.36;
      cam.position.set(
        focus.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        focus.y + Math.sin(pitch) * dist,
        focus.z + Math.cos(yaw) * Math.cos(pitch) * dist
      );
      cam.lookAt(focus);
    } else if (mode === 'follow') {
      const yaw = hp.rot?.[1] ?? 0.85;
      const back = 13.5;
      const up = 4.8;
      cam.position.set(
        focus.x - Math.sin(yaw) * back,
        Math.max(focus.y + up, terrainHeightAt(rec.resource?.terrain, focus.x - Math.sin(yaw) * back, focus.z - Math.cos(yaw) * back) + 1.8),
        focus.z - Math.cos(yaw) * back
      );
      cam.lookAt(focus.x + Math.sin(yaw) * 3, focus.y + 0.3, focus.z + Math.cos(yaw) * 3);
    } else {
      // Cinematic dramatic framing tracking takeoff, tower flyby, fault & impact cleanly
      const panAngle = 0.55 + clamp(t / 15, 0, 1) * 1.15;
      const dist = t < 2 ? 15 : (t > 9.5 ? 20 : 17.5);
      const heightOff = t < 2 ? 4.5 : (t > 10.5 ? 7.2 : 6.0);
      const cx = focus.x + Math.sin(panAngle) * dist;
      const cz = focus.z + Math.cos(panAngle) * dist;
      const minGround = terrainHeightAt(rec.resource?.terrain, cx, cz) + 2.2;
      cam.position.set(cx, Math.max(minGround, focus.y + heightOff), cz);
      cam.lookAt(focus);
    }
  }

  applyFrameToScene(rec, frame, fx, ui) {
    const t = frame?.frameTime ?? 0;
    if (rec.isGeneric) {
      for (const ent of frame?.entities || []) {
        const mesh = rec.genericMeshes.get(ent.id);
        if (mesh) {
          if (ent.pos) mesh.position.set(...ent.pos);
          if (ent.rot) mesh.rotation.set(...ent.rot);
        }
      }
      this.applyCamera(rec, frame);
      return;
    }

    // Beacon pulse
    const pulse = Math.sin(t * 5.2) > 0.15;
    for (const b of rec.beaconMeshes) {
      b.material.color.setHex(pulse ? 0xff3b30 : 0x6b1d1d);
    }

    // Rehearsal waypoint indicator
    if (rec.waypointRing) {
      if (ui?.mode === 'rehearsal' && ui?.targetPos) {
        const tx = ui.targetPos[0] ?? 22;
        const tz = ui.targetPos[2] ?? -12;
        const gy = terrainHeightAt(rec.resource?.terrain, tx, tz);
        rec.waypointRing.visible = true;
        rec.waypointRing.position.set(tx, gy + 0.52, tz);
        rec.waypointRing.scale.setScalar(1 + 0.12 * Math.sin(t * 4));
      } else {
        rec.waypointRing.visible = false;
      }
    }

    // Helicopter pose & articulated parts
    const rig = rec.heliRig;
    if (rig && frame?.heliPose) {
      const hp = frame.heliPose;
      rig.root.position.set(hp.pos[0], hp.pos[1], hp.pos[2]);
      rig.root.rotation.order = 'YXZ';
      rig.root.rotation.set(hp.rot[0], hp.rot[1], hp.rot[2]);
      rig.mainRotorPivot.rotation.y = hp.mainRotorAngle || 0;
      rig.tailRotorPivot.rotation.x = hp.tailRotorAngle || 0;
      rig.blurDiscMat.opacity = clamp((hp.rpm - 0.35) * 0.42, 0, 0.34);

      const partsMap = frame.parts || {};
      for (const [partId, grp] of Object.entries(rig.partGroups)) {
        const st = partsMap[partId];
        if (!st) continue;
        grp.visible = !st.detached;
        const dmg = clamp(st.damage || 0, 0, 1);
        grp.traverse((ch) => {
          if (ch.isMesh && ch.userData.baseColor && ch.material?.color) {
            ch.material.color.copy(ch.userData.baseColor).lerp(new THREE.Color('#27272a'), dmg * 0.72);
          }
        });
      }
    }

    // Detached 3D Debris
    const activeDebrisIds = new Set();
    const charMat = new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.75, metalness: 0.45 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.5, metalness: 0.4 });
    for (const d of frame?.debris || []) {
      activeDebrisIds.add(d.id);
      let dMesh = rec.debrisMeshes.get(d.id);
      if (!dMesh) {
        const g = new THREE.Group();
        if (d.partId === 'main_rotor_blades') {
          g.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 3.6), charMat));
          const tip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.045, 0.45), goldMat);
          tip.position.z = 1.6;
          g.add(tip);
        } else if (d.partId === 'tail_boom') {
          const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, 3.2, 10), charMat);
          tube.rotation.x = Math.PI / 2;
          g.add(tube);
          const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.55), goldMat);
          fin.position.set(0, 0.45, -1.2);
          g.add(fin);
        } else if (d.partId && d.partId.startsWith('skid')) {
          const r = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 8), charMat);
          r.rotation.x = Math.PI / 2;
          g.add(r);
        } else {
          g.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 1.4), d.damaged ? charMat : goldMat));
        }
        g.traverse((ch) => { if (ch.isMesh) { ch.castShadow = true; ch.userData.partId = d.partId; ch.userData.partName = d.name || d.partId; } });
        rec.scene.add(g);
        rec.debrisMeshes.set(d.id, g);
        dMesh = g;
      }
      dMesh.visible = true;
      dMesh.position.set(d.pos[0], d.pos[1], d.pos[2]);
      dMesh.rotation.set(d.rot[0], d.rot[1], d.rot[2]);
    }
    for (const [id, mesh] of rec.debrisMeshes.entries()) {
      if (!activeDebrisIds.has(id)) mesh.visible = false;
    }

    // Dynamic Grass Wind + Downwash Bend
    if (rec.grassInstanced && rec.grassMeta.length > 0) {
      const dummy = new THREE.Object3D();
      const wind = fx?.wind || [1.4, 0, -0.6];
      const dwPos = fx?.downwashPos || [-999, -999];
      const dwStr = fx?.downwashStrength || 0;
      const meta = rec.grassMeta;
      for (let i = 0; i < meta.length; i++) {
        const m = meta[i];
        let bendX = wind[0] * 0.1 + Math.sin(t * 2.4 + m.phase) * 0.08;
        let bendZ = wind[2] * 0.1 + Math.cos(t * 2.1 + m.phase) * 0.08;
        if (dwStr > 0.05) {
          const dx = m.x - dwPos[0];
          const dz = m.z - dwPos[1];
          const dist = Math.hypot(dx, dz);
          if (dist < 13 && dist > 0.25) {
            const push = dwStr * (1 - dist / 13) * 0.95;
            bendX += (dx / dist) * push + Math.sin(t * 14 + m.phase) * push * 0.22;
            bendZ += (dz / dist) * push + Math.cos(t * 14 + m.phase) * push * 0.22;
          }
        }
        dummy.position.set(m.x, m.y, m.z);
        dummy.rotation.set(bendZ, m.yaw, -bendX);
        dummy.scale.set(1, m.scaleY, 1);
        dummy.updateMatrix();
        rec.grassInstanced.setMatrixAt(i, dummy.matrix);
      }
      rec.grassInstanced.instanceMatrix.needsUpdate = true;
    }

    // Deterministic Analytical Particle Emitters
    this.updateParticlePools(rec, fx, t);

    // Active Camera
    this.applyCamera(rec, frame);
  }

  updateParticlePools(rec, fx, t) {
    const pools = rec.fxPools;
    if (!pools) return;
    const dummy = new THREE.Object3D();
    const zeroOut = (pool) => {
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      for (let i = 0; i < pool.count; i++) pool.inst.setMatrixAt(i, dummy.matrix);
      pool.inst.instanceMatrix.needsUpdate = true;
    };

    zeroOut(pools.dust);
    zeroOut(pools.smoke);
    zeroOut(pools.sparks);
    zeroOut(pools.fire);

    const wind = fx?.wind || [1.4, 0, -0.6];
    const emitters = fx?.emitters || [];
    let smokeIdx = 0;

    for (const em of emitters) {
      const origin = em.origin || [0, 0, 0];
      const inten = em.intensity ?? 1;
      const seed = em.seed || 1;
      const rng = pseudoRand(seed);

      if (em.kind === 'dust_ring') {
        for (let i = 0; i < pools.dust.count; i++) {
          const ang = (i / pools.dust.count) * Math.PI * 2 + seed;
          const phase = ((t * 1.45 + rng()) % 1.0);
          const rad = 1.6 + phase * (5.5 + inten * 4.5);
          const px = origin[0] + Math.cos(ang + phase * 1.3) * rad + wind[0] * phase * 0.8;
          const pz = origin[2] + Math.sin(ang + phase * 1.3) * rad + wind[2] * phase * 0.8;
          const py = terrainHeightAt(rec.resource?.terrain, px, pz) + 0.25 + phase * (1.2 + inten);
          const sc = Math.sin(phase * Math.PI) * (0.36 + inten * 0.65);
          dummy.position.set(px, py, pz);
          dummy.scale.setScalar(Math.max(0.01, sc));
          dummy.updateMatrix();
          pools.dust.inst.setMatrixAt(i, dummy.matrix);
        }
        pools.dust.inst.instanceMatrix.needsUpdate = true;
      } else if (em.kind === 'engine_smoke' || em.kind === 'wreck_smoke') {
        const lifeSpan = em.kind === 'wreck_smoke' ? 3.5 : 2.1;
        const nP = em.kind === 'wreck_smoke' ? 40 : 25;
        const maxScale = em.kind === 'wreck_smoke' ? 3.6 : 1.7;
        for (let i = 0; i < nP && smokeIdx < pools.smoke.count; i++) {
          const phase = ((t / lifeSpan + (i / nP)) % 1.0);
          const px = origin[0] + wind[0] * phase * lifeSpan * 1.3 + (rng() - 0.5) * 1.2;
          const py = origin[1] + phase * (em.kind === 'wreck_smoke' ? 14.0 : 5.5);
          const pz = origin[2] + wind[2] * phase * lifeSpan * 1.3 + (rng() - 0.5) * 1.2;
          const sc = (0.55 + phase * maxScale) * inten * Math.sin(clamp(phase, 0.05, 0.98) * Math.PI);
          dummy.position.set(px, py, pz);
          dummy.scale.setScalar(Math.max(0.01, sc));
          dummy.updateMatrix();
          pools.smoke.inst.setMatrixAt(smokeIdx++, dummy.matrix);
        }
        pools.smoke.inst.instanceMatrix.needsUpdate = true;
      } else if (em.kind === 'sparks') {
        for (let i = 0; i < pools.sparks.count; i++) {
          const phase = ((t * 2.8 + rng()) % 1.0);
          const vx = (rng() - 0.5) * 7.5 + wind[0] * 1.2;
          const vy = 2.0 + rng() * 3.5;
          const vz = (rng() - 0.5) * 7.5 + wind[2] * 1.2;
          const px = origin[0] + vx * phase * 0.65;
          const py = origin[1] + vy * phase * 0.5 - 4.9 * phase * phase * 0.65;
          const pz = origin[2] + vz * phase * 0.65;
          const sc = (1 - phase) * (0.45 + inten * 0.65);
          dummy.position.set(px, Math.max(0.1, py), pz);
          dummy.scale.setScalar(Math.max(0.01, sc));
          dummy.updateMatrix();
          pools.sparks.inst.setMatrixAt(i, dummy.matrix);
        }
        pools.sparks.inst.instanceMatrix.needsUpdate = true;
      } else if (em.kind === 'fireball') {
        const since = clamp((t - (em.startTime || 0)) / 2.2, 0, 1);
        for (let i = 0; i < pools.fire.count; i++) {
          const rx = (rng() - 0.5) * 2;
          const ry = rng() * 1.4;
          const rz = (rng() - 0.5) * 2;
          const px = origin[0] + rx * (0.8 + since * 3.8);
          const py = origin[1] + ry * (1.2 + since * 5.2);
          const pz = origin[2] + rz * (0.8 + since * 3.8);
          const sc = Math.sin(clamp(1 - since * 0.85, 0, 1) * Math.PI * 0.5) * (1.6 + rng() * 2.4) * inten;
          dummy.position.set(px, py, pz);
          dummy.scale.setScalar(Math.max(0.01, sc));
          dummy.updateMatrix();
          pools.fire.inst.setMatrixAt(i, dummy.matrix);
        }
        pools.fire.inst.instanceMatrix.needsUpdate = true;
      }
    }
  }

  renderViewport(sysId, playerId, targetCanvas, ui) {
    if (!targetCanvas || !targetCanvas.isConnected) return;
    const slot = this.hostKernel.subsystems.get(sysId);
    if (!slot) return;
    const key = `${sysId}::${playerId}`;
    let rec = this.scenes.get(key);
    if (!rec && slot.scene3dResources?.[playerId]) {
      this.loadScene(sysId, playerId, slot.scene3dResources[playerId]);
      rec = this.scenes.get(key);
    }

    const rect = targetCanvas.getBoundingClientRect();
    const w = Math.max(240, Math.round(rect.width || targetCanvas.width || 640));
    const h = Math.max(140, Math.round(rect.height || targetCanvas.height || 360));
    const rw = Math.min(w, 1280);
    const rh = Math.min(h, 760);
    if (targetCanvas.width !== rw || targetCanvas.height !== rh) {
      targetCanvas.width = rw;
      targetCanvas.height = rh;
    }

    const ctx2d = targetCanvas.getContext('2d');
    if (!rec || !this.renderer || this.contextLost) {
      ctx2d.fillStyle = '#0f172a';
      ctx2d.fillRect(0, 0, rw, rh);
      ctx2d.fillStyle = '#94a3b8';
      ctx2d.font = '14px sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.fillText(this.contextLost ? 'WebGL 上下文正在自动恢复...' : '正在载入三维场景...', rw / 2, rh / 2);
      return;
    }

    const frame = slot.scene3dFrames?.[playerId];
    const fx = slot.scene3dFx?.[playerId];
    if (frame) {
      this.applyFrameToScene(rec, frame, fx, ui);
    }
    rec.camera.aspect = rw / Math.max(1, rh);
    rec.camera.updateProjectionMatrix();

    const rendererSize = this.renderer.getSize(new THREE.Vector2());
    if (rendererSize.x !== rw || rendererSize.y !== rh) {
      this.renderer.setSize(rw, rh, false);
    }
    this.renderer.render(rec.scene, rec.camera);
    ctx2d.clearRect(0, 0, rw, rh);
    ctx2d.drawImage(this.renderer.domElement, 0, 0, rw, rh);
  }

  raycast(sysId, playerId, nx, ny, camMode, camOrbit) {
    const key = `${sysId}::${playerId}`;
    const rec = this.scenes.get(key);
    if (!rec) return null;

    const slot = this.hostKernel.subsystems.get(sysId);
    const frame = slot?.scene3dFrames?.[playerId];
    if (frame) {
      this.applyFrameToScene(rec, { ...frame, cameraMode: camMode || frame.cameraMode, cameraOrbit: camOrbit || frame.cameraOrbit }, slot?.scene3dFx?.[playerId], null);
    }

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1));
    raycaster.setFromCamera(ndc, rec.camera);

    const targets = [];
    if (rec.heliRig) {
      for (const m of rec.heliRig.interactiveMeshes) {
        if (m.visible && m.parent?.visible !== false) targets.push(m);
      }
    }
    for (const dMesh of rec.debrisMeshes.values()) {
      if (dMesh.visible) {
        dMesh.traverse((ch) => { if (ch.isMesh) targets.push(ch); });
      }
    }
    if (rec.isGeneric) {
      for (const gm of rec.genericMeshes.values()) targets.push(gm);
    }

    const partHits = raycaster.intersectObjects(targets, false);
    if (partHits.length > 0) {
      const m = partHits[0].object;
      const pid = m.userData.partId || 'part';
      const st = frame?.parts?.[pid];
      return {
        hitType: 'part',
        partId: pid,
        partName: m.userData.partName || pid,
        damage: st ? st.damage : 0,
        detached: st ? Boolean(st.detached) : false
      };
    }

    if (rec.terrainMesh) {
      const gHits = raycaster.intersectObject(rec.terrainMesh, false);
      if (gHits.length > 0) {
        const pt = gHits[0].point;
        const hp = frame?.heliPose?.pos || [0, 0, 0];
        return {
          hitType: 'ground',
          point: [Number(pt.x.toFixed(2)), Number(pt.y.toFixed(2)), Number(pt.z.toFixed(2))],
          heliX: hp[0],
          heliZ: hp[2]
        };
      }
    }
    return null;
  }
}

export class DisplayDevice {
  constructor(hostKernel) {
    this.hostKernel = hostKernel;
    this.three = new ThreeSceneManager(hostKernel);
    this.mountedRoots = new Map(); // sysId -> { container, viewportEl, ... }
    this.projectionMounts = new Map(); // projWinId -> containerEl
    this.pendingDndCallback = null;

    hostKernel.setDisplayDevice({
      loadScene: (sysId, playerId, res) => this.three.loadScene(sysId, playerId, res),
      raycast: (sysId, playerId, nx, ny, camMode, camOrbit) => this.three.raycast(sysId, playerId, nx, ny, camMode, camOrbit)
    });
  }

  setCrossLayerDropHandler(cb) {
    this.crossLayerDropHandler = cb;
  }

  loadScene(sysId, playerId, res) {
    this.three.loadScene(sysId, playerId, res);
  }

  raycast(sysId, playerId, nx, ny, camMode, camOrbit) {
    return this.three.raycast(sysId, playerId, nx, ny, camMode, camOrbit);
  }

  mountSubsystem(sysId, containerEl) {
    const existing = this.mountedRoots.get(sysId);
    if (existing && existing.container === containerEl) return;
    containerEl.innerHTML = '';
    const host = document.createElement('div');
    host.className = 'subsys-scale-host';
    host.dataset.sysHost = sysId;

    const desk = document.createElement('div');
    desk.className = 'subsys-desktop';
    desk.setAttribute('data-testid', 'os-desktop');
    desk.setAttribute('data-system-id', sysId);

    // Static internal layer containers (never detached unnecessarily -> keeps focus!)
    const wall = document.createElement('div');
    wall.className = 'subsys-wallpaper';
    const iconsLayer = document.createElement('div');
    iconsLayer.className = 'subsys-icons-layer';
    const winsLayer = document.createElement('div');
    winsLayer.className = 'subsys-wins-layer';
    const overlaysLayer = document.createElement('div');
    overlaysLayer.className = 'subsys-overlays-layer';
    const taskbar = document.createElement('div');
    taskbar.className = 'subsys-taskbar';
    const statusOverlay = document.createElement('div');
    statusOverlay.className = 'subsys-state-banner';
    statusOverlay.setAttribute('data-system-id', sysId);

    desk.append(wall, iconsLayer, winsLayer, overlaysLayer, taskbar, statusOverlay);
    host.appendChild(desk);
    containerEl.appendChild(host);

    const rec = {
      sysId,
      container: containerEl,
      host,
      desk,
      iconsLayer,
      winsLayer,
      overlaysLayer,
      taskbar,
      statusOverlay,
      winNodes: new Map(), // winId -> node record
      lastSig: { icons: '', overlays: '', taskbar: '', banner: '', scale: '' }
    };
    this.mountedRoots.set(sysId, rec);
    this.attachSubsystemInputHandlers(rec);
    this.renderSubsystem(sysId);
  }

  unmountSubsystem(sysId) {
    this.mountedRoots.delete(sysId);
  }

  mountProjection(projWinId, containerEl) {
    this.projectionMounts.set(projWinId, containerEl);
    this.renderProjection(projWinId);
  }

  unmountProjection(projWinId) {
    this.projectionMounts.delete(projWinId);
  }

  getTopmostAncestorChild(sysId) {
    let cur = this.hostKernel.subsystems.get(sysId);
    while (cur && cur.parentId && cur.parentId !== 'outer') {
      cur = this.hostKernel.subsystems.get(cur.parentId);
    }
    return cur ? cur.id : sysId;
  }

  mapToDesktopCoords(sysId, clientX, clientY) {
    const rec = this.mountedRoots.get(sysId);
    if (!rec) return { x: 0, y: 0 };
    const slot = this.hostKernel.subsystems.get(sysId);
    const deskW = slot?.lastDesktop?.deskW || 960;
    const deskH = slot?.lastDesktop?.deskH || 600;
    const rect = rec.desk.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * deskW;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * deskH;
    return { x: Math.round(x), y: Math.round(y) };
  }

  routeToKernelInput(targetSysId, rawEv, stopTarget = null) {
    const topSysId = this.getTopmostAncestorChild(targetSysId);
    const coords = this.mapToDesktopCoords(topSysId, rawEv.clientX ?? 0, rawEv.clientY ?? 0);
    const ev = { ...rawEv, x: coords.x, y: coords.y };
    delete ev.clientX;
    delete ev.clientY;
    this.hostKernel.forwardInputToSubsystem(topSysId, ev);
  }

  routeControlAction(targetSysId, clientX, clientY, actionPayload) {
    const topSysId = this.getTopmostAncestorChild(targetSysId);
    const coords = this.mapToDesktopCoords(topSysId, clientX, clientY);
    this.hostKernel.forwardInputToSubsystem(topSysId, {
      type: 'control_action',
      targetSysId,
      x: coords.x,
      y: coords.y,
      ...actionPayload
    });
  }

  // Forward pointer, keyboard, and context actions cleanly through ancestor wm.ns chain
  attachSubsystemInputHandlers(rec) {
    const { desk, sysId } = rec;

    const buildHint = (target) => {
      const winEl = target.closest('.subsys-win');
      const winId = winEl ? winEl.getAttribute('data-window-id') : null;
      if (target.classList.contains('player-3d-canvas') || target.getAttribute('data-testid') === 'player-view') {
        return { windowId: winId, testId: 'player-view' };
      }
      const actEl = target.closest('[data-ns-action]');
      if (!actEl) return winId ? { windowId: winId } : null;
      const hint = {
        windowId: winId,
        action: actEl.dataset.nsAction,
        targetId: actEl.dataset.targetId || actEl.dataset.targetSystemId || undefined,
        path: actEl.dataset.filePath || undefined,
        by: actEl.dataset.sortBy || undefined,
        mode: actEl.dataset.camMode || undefined,
        fault: actEl.dataset.faultVal || undefined,
        col: actEl.dataset.col || undefined,
        pid: actEl.dataset.pid ? Number(actEl.dataset.pid) : undefined,
        value: actEl.dataset.val !== undefined ? actEl.dataset.val : undefined,
        field: actEl.dataset.field || undefined,
        testId: actEl.getAttribute('data-testid') || undefined
      };
      return hint;
    };

    const isChildDesktopElement = (target) => {
      const closestDesk = target.closest('.subsys-desktop');
      return closestDesk && closestDesk.getAttribute('data-system-id') !== sysId;
    };

    desk.addEventListener('pointerdown', (e) => {
      if (isChildDesktopElement(e.target)) return;
      if (e.button === 2) return; // handled by contextmenu
      const target = e.target;

      // Shell controls handled via control_action (taskbar, start toggle, start menu, modal, popup, ctxmenu)
      const shellEl = target.closest('[data-ns-shell]');
      if (shellEl) {
        e.stopPropagation();
        this.routeControlAction(sysId, e.clientX, e.clientY, {
          action: shellEl.dataset.nsShell,
          targetId: shellEl.dataset.targetId || shellEl.dataset.targetSystemId || ''
        });
        return;
      }

      const hint = buildHint(target);
      if (hint && hint.testId === 'player-view') {
        const rect = target.getBoundingClientRect();
        hint.normX = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
        hint.normY = clamp((e.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
      }

      // Note: Do NOT call e.preventDefault() on inputs/textareas/selects so typing focus works naturally!
      const isInteractiveForm = target.matches('input, textarea, select, option, button');
      if (!isInteractiveForm) {
        desk.focus({ preventScroll: true });
      }
      this.routeToKernelInput(sysId, {
        type: 'pointerdown',
        button: e.button,
        shift: e.shiftKey,
        ctrl: e.ctrlKey || e.metaKey,
        clientX: e.clientX,
        clientY: e.clientY,
        controlHint: hint
      });
    });

    desk.addEventListener('dblclick', (e) => {
      if (isChildDesktopElement(e.target)) return;
      const hint = buildHint(e.target);
      this.routeToKernelInput(sysId, {
        type: 'dblclick',
        button: 0,
        clientX: e.clientX,
        clientY: e.clientY,
        controlHint: hint
      });
    });

    desk.addEventListener('contextmenu', (e) => {
      if (isChildDesktopElement(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      this.routeToKernelInput(sysId, {
        type: 'contextmenu',
        clientX: e.clientX,
        clientY: e.clientY,
        controlHint: buildHint(e.target)
      });
    });

    desk.addEventListener('wheel', (e) => {
      if (isChildDesktopElement(e.target)) return;
      const target = e.target;
      const hint = buildHint(target);
      if (target.closest('.player-3d-canvas')) {
        e.preventDefault();
      }
      this.routeToKernelInput(sysId, {
        type: 'wheel',
        deltaY: e.deltaY,
        clientX: e.clientX,
        clientY: e.clientY,
        controlHint: hint
      });
    }, { passive: false });

    // Window-level pointermove/pointerup when active inside any subsystem
    const onWinMove = (e) => {
      if (!desk.isConnected) return;
      const slot = this.hostKernel.subsystems.get(sysId);
      if (!slot || slot.parentId !== 'outer') return; // Root child propagates move downwards automatically
      // Throttle only mildly if not dragging: wm.ns checks DRAG or hovered win
      const buttons = e.buttons;
      if (buttons === 0 && !this._draggingAny) return;
      this.routeToKernelInput(sysId, {
        type: 'pointermove',
        clientX: e.clientX,
        clientY: e.clientY,
        controlHint: buildHint(e.target)
      });
    };
    const onWinUp = (e) => {
      if (!desk.isConnected) return;
      const slot = this.hostKernel.subsystems.get(sysId);
      if (!slot || slot.parentId !== 'outer') return;
      if (this._draggingAny) {
        this._draggingAny = false;
        this.routeToKernelInput(sysId, {
          type: 'pointerup',
          button: e.button,
          clientX: e.clientX,
          clientY: e.clientY,
          controlHint: buildHint(e.target)
        });
      }
    };

    desk.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('button, input, select, textarea')) {
        this._draggingAny = true;
      }
    });
    window.addEventListener('pointermove', onWinMove);
    window.addEventListener('pointerup', onWinUp);
    rec._cleanupFns = [
      () => window.removeEventListener('pointermove', onWinMove),
      () => window.removeEventListener('pointerup', onWinUp)
    ];

    desk.addEventListener('keydown', (e) => {
      if (isChildDesktopElement(e.target)) return;
      if (e.key === 'Escape') {
        this.routeToKernelInput(sysId, { type: 'keydown', key: 'Escape', clientX: 0, clientY: 0 });
      }
    });
  }

  renderAll() {
    for (const sysId of Array.from(this.mountedRoots.keys())) {
      this.renderSubsystem(sysId);
    }
    for (const projWinId of Array.from(this.projectionMounts.keys())) {
      this.renderProjection(projWinId);
    }
  }

  renderSubsystem(sysId) {
    const rec = this.mountedRoots.get(sysId);
    if (!rec || !rec.container.isConnected) return;
    const slot = this.hostKernel.subsystems.get(sysId);
    if (!slot) return;

    const dt = slot.lastDesktop || {
      sysId,
      sysName: slot.name,
      depth: slot.depth,
      deskW: 960,
      deskH: 600,
      icons: [],
      windows: [],
      startOpen: false,
      contextMenu: null,
      confirmModal: null,
      projectPopup: null
    };

    // Fit 960x600 desktop cleanly inside host container using linear CSS scale
    const cw = Math.max(120, rec.container.clientWidth || 960);
    const ch = Math.max(90, rec.container.clientHeight || 600);
    const deskW = dt.deskW || 960;
    const deskH = dt.deskH || 600;
    const sx = cw / deskW;
    const sy = ch / deskH;
    const scaleKey = `${cw}x${ch}:${deskW}x${deskH}`;
    if (rec.lastSig.scale !== scaleKey) {
      rec.lastSig.scale = scaleKey;
      rec.desk.style.width = deskW + 'px';
      rec.desk.style.height = deskH + 'px';
      rec.desk.style.transform = `scale(${sx.toFixed(5)}, ${sy.toFixed(5)})`;
    }

    // Depth theme accent
    rec.desk.dataset.depth = String(slot.depth || 1);

    // State banner (paused / ancestor-paused / kernel_error / stopped)
    const pauseReason = this.hostKernel.getPauseReason(sysId);
    const isErr = slot.state === 'kernel_error';
    const isStopped = slot.state === 'stopped';
    const bannerSig = `${slot.state}|${pauseReason || ''}|${slot.kernelError || ''}`;
    if (rec.lastSig.banner !== bannerSig) {
      rec.lastSig.banner = bannerSig;
      if (isErr) {
        rec.statusOverlay.style.display = 'flex';
        rec.statusOverlay.className = 'subsys-state-banner is-error';
        rec.statusOverlay.setAttribute('data-testid', 'kernel-error');
        rec.statusOverlay.innerHTML = `
          <div class="subsys-banner-card">
            <div class="subsys-banner-title">内核异常 · ${escapeHtml(slot.name)} (${escapeHtml(sysId)})</div>
            <div class="subsys-banner-msg">${escapeHtml(slot.kernelError || '内核启动失败或发生未捕获异常')}</div>
            <div class="subsys-banner-hint">故障已隔离在本子系统内。可在父系统“程序编辑器”修改 kernel.ns 后通过任务管理器重启。</div>
          </div>
        `;
      } else if (isStopped) {
        rec.statusOverlay.style.display = 'flex';
        rec.statusOverlay.className = 'subsys-state-banner is-stopped';
        rec.statusOverlay.removeAttribute('data-testid');
        rec.statusOverlay.innerHTML = `<div class="subsys-banner-card"><div class="subsys-banner-title">子系统已停止 (${escapeHtml(sysId)})</div></div>`;
      } else if (pauseReason) {
        rec.statusOverlay.style.display = 'flex';
        rec.statusOverlay.className = 'subsys-state-banner is-paused';
        rec.statusOverlay.removeAttribute('data-testid');
        rec.statusOverlay.innerHTML = `<div class="subsys-pause-pill">${escapeHtml(pauseReason)}</div>`;
      } else {
        rec.statusOverlay.style.display = 'none';
        rec.statusOverlay.removeAttribute('data-testid');
      }
    }

    if (isErr) {
      rec.winsLayer.style.display = 'none';
      return;
    }
    rec.winsLayer.style.display = 'block';

    // Desktop Icons
    const iconSig = JSON.stringify({ icons: dt.icons, sel: dt.selectedIcon });
    if (rec.lastSig.icons !== iconSig) {
      rec.lastSig.icons = iconSig;
      rec.iconsLayer.innerHTML = (dt.icons || []).map((ic) => `
        <div class="subsys-icon ${dt.selectedIcon === ic.id ? 'selected' : ''}"
             data-testid="desktop-icon"
             data-system-id="${escapeHtml(sysId)}"
             data-app-id="${escapeHtml(ic.appId)}"
             style="left:${ic.x}px;top:${ic.y}px;">
          ${getAppIconSvg(ic.appId === 'new_system' ? 'subsystem' : ic.appId, 'subsys-icon-svg')}
          <div class="subsys-icon-label">${escapeHtml(ic.label)}</div>
        </div>
      `).join('');
    }

    // Keyed Window Nodes
    const wins = dt.windows || [];
    const aliveIds = new Set(wins.map((w) => w.id));
    for (const [wid, wRec] of rec.winNodes.entries()) {
      if (!aliveIds.has(wid)) {
        if (wRec.childSysId) this.unmountSubsystem(wRec.childSysId);
        wRec.el.remove();
        rec.winNodes.delete(wid);
      }
    }

    for (const w of wins) {
      let wRec = rec.winNodes.get(w.id);
      if (!wRec) {
        wRec = this.createSubsysWinNode(sysId, w);
        rec.winNodes.set(w.id, wRec);
        rec.winsLayer.appendChild(wRec.el);
      }
      this.updateSubsysWinNode(sysId, wRec, w);
    }

    // Overlays (Start menu, Context menu, Confirm modal, Project popup)
    const ovSig = JSON.stringify({
      startOpen: dt.startOpen,
      ctx: dt.contextMenu,
      modal: dt.confirmModal,
      proj: dt.projectPopup
    });
    if (rec.lastSig.overlays !== ovSig) {
      rec.lastSig.overlays = ovSig;
      rec.overlaysLayer.innerHTML = this.renderSubsysOverlaysHtml(sysId, dt);
    }

    // Taskbar
    const tbSig = JSON.stringify({
      sysName: dt.sysName,
      depth: dt.depth,
      startOpen: dt.startOpen,
      vtime: Math.floor((dt.virtualTime || 0) / 1000),
      wins: wins.map((w) => ({ id: w.id, title: w.title, focused: w.focused, minimized: w.minimized, appId: w.appId }))
    });
    if (rec.lastSig.taskbar !== tbSig) {
      rec.lastSig.taskbar = tbSig;
      const vtSec = ((dt.virtualTime || 0) / 1000).toFixed(1);
      rec.taskbar.innerHTML = `
        <button class="subsys-start-btn ${dt.startOpen ? 'active' : ''}"
                data-testid="start-toggle"
                data-system-id="${escapeHtml(sysId)}"
                data-ns-shell="start_toggle"
                aria-label="开始菜单">${getAppIconSvg('start', 'tb-svg')}<span>开始</span></button>
        <div class="subsys-tb-wins">
          ${wins.map((w) => `
            <button class="subsys-tb-item ${w.focused && !w.minimized ? 'focused' : ''} ${w.minimized ? 'minimized' : ''}"
                    data-testid="taskbar-item"
                    data-system-id="${escapeHtml(sysId)}"
                    data-window-id="${escapeHtml(w.id)}"
                    data-ns-shell="taskbar_toggle"
                    data-target-id="${escapeHtml(w.id)}">${escapeHtml(w.title)}</button>
          `).join('')}
        </div>
        <div class="subsys-tb-meta">
          <span class="subsys-depth-pill">L${dt.depth || 1} · ${escapeHtml(sysId)}</span>
          <span class="subsys-clock">T+${vtSec}s</span>
        </div>
      `;
    }
  }

  renderSubsysOverlaysHtml(sysId, dt) {
    let html = '';
    if (dt.startOpen) {
      const items = [
        { appId: 'player', label: '三维场景播放器', testid: 'launch-player', icon: 'player' },
        { appId: 'charts', label: '图表工作台', testid: 'launch-charts', icon: 'charts' },
        { appId: 'files', label: '文件管理器', testid: 'launch-files', icon: 'files' },
        { appId: 'editor', label: '文本与程序编辑器', testid: 'launch-editor', icon: 'editor' },
        { appId: 'tasks', label: '进程与系统管理器', testid: 'launch-tasks', icon: 'tasks' },
        { appId: 'new_system', label: '新建嵌套子系统', testid: 'start-new-system', icon: 'subsystem' }
      ];
      html += `
        <div class="subsys-start-menu" data-testid="start-menu" data-system-id="${escapeHtml(sysId)}">
          <div class="subsys-start-hdr">${escapeHtml(dt.sysName || sysId)} · L${dt.depth || 1}</div>
          <div class="subsys-start-list">
            ${items.map((it) => `
              <button class="subsys-start-item"
                      data-testid="${it.testid}"
                      data-system-id="${escapeHtml(sysId)}"
                      data-ns-shell="launch"
                      data-target-id="${it.appId}">
                ${getAppIconSvg(it.icon, 'start-svg')}<span>${escapeHtml(it.label)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (dt.contextMenu) {
      const cm = dt.contextMenu;
      html += `
        <div class="subsys-ctx-menu" style="left:${cm.x}px;top:${cm.y}px;">
          <button class="ctx-item" data-ns-shell="ctx_action" data-target-id="open_player">打开三维播放器</button>
          <button class="ctx-item" data-ns-shell="ctx_action" data-target-id="open_charts">打开图表工作台</button>
          <button class="ctx-item" data-ns-shell="ctx_action" data-target-id="open_files">打开文件管理器</button>
          <button class="ctx-item" data-ns-shell="ctx_action" data-target-id="open_tasks">打开进程管理器</button>
          <button class="ctx-item" data-ns-shell="ctx_action" data-target-id="new_system">新建子系统</button>
        </div>
      `;
    }

    if (dt.projectPopup) {
      const pp = dt.projectPopup;
      html += `
        <div class="subsys-proj-popup" style="left:${pp.x}px;top:${pp.y}px;">
          <div class="proj-popup-title">投送到上级桌面</div>
          ${(pp.targets || []).map((tg) => `
            <button class="proj-popup-item"
                    data-testid="project-target"
                    data-system-id="${escapeHtml(sysId)}"
                    data-window-id="${escapeHtml(pp.winId)}"
                    data-target-system-id="${escapeHtml(tg.id)}"
                    data-ns-shell="project_to"
                    data-target-id="${escapeHtml(tg.id)}">${escapeHtml(tg.label)}</button>
          `).join('')}
        </div>
      `;
    }

    if (dt.confirmModal) {
      html += `
        <div class="subsys-modal-backdrop">
          <div class="subsys-modal-card">
            <div class="subsys-modal-msg">${escapeHtml(dt.confirmModal.message)}</div>
            <div class="subsys-modal-actions">
              <button class="btn-danger" data-ns-shell="confirm_modal_yes">确认停止并关闭</button>
              <button class="btn-ghost" data-ns-shell="confirm_modal_no">取消</button>
            </div>
          </div>
        </div>
      `;
    }
    return html;
  }

  createSubsysWinNode(sysId, w) {
    const el = document.createElement('div');
    el.className = 'subsys-win';
    el.setAttribute('data-testid', 'app-window');
    el.setAttribute('data-system-id', sysId);
    el.setAttribute('data-window-id', w.id);
    el.setAttribute('data-app-id', w.appId);
    if (w.appId === 'projection') {
      el.setAttribute('data-source-system-id', w.sourceSystemId || '');
      el.setAttribute('data-source-window-id', w.sourceWindowId || '');
      el.setAttribute('data-source-app-id', w.sourceAppId || '');
    }

    const tb = document.createElement('div');
    tb.className = 'subsys-win-titlebar';
    tb.setAttribute('data-testid', 'window-titlebar');
    tb.setAttribute('data-system-id', sysId);
    tb.setAttribute('data-window-id', w.id);

    const titleWrap = document.createElement('div');
    titleWrap.className = 'subsys-win-title';
    const icoKey = w.appId === 'projection' ? (w.sourceAppId || 'player') : w.appId;
    titleWrap.innerHTML = `${getAppIconSvg(icoKey, 'win-svg')}<span class="win-title-text">${escapeHtml(w.title)}</span>`;

    const btns = document.createElement('div');
    btns.className = 'subsys-win-btns';
    if (w.canProject) {
      btns.innerHTML += `<button class="win-btn win-btn-proj" title="投送到桌面" data-testid="window-project" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(w.id)}" data-ns-action="win_project_menu" data-target-id="${escapeHtml(w.id)}">投送</button>`;
    }
    btns.innerHTML += `
      <button class="win-btn" title="最小化" data-testid="window-minimize" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(w.id)}" data-ns-action="win_minimize" data-target-id="${escapeHtml(w.id)}">─</button>
      <button class="win-btn" title="最大化" data-testid="window-maximize" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(w.id)}" data-ns-action="win_maximize" data-target-id="${escapeHtml(w.id)}">□</button>
      <button class="win-btn win-btn-close" title="关闭" data-testid="window-close" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(w.id)}" data-ns-action="win_close" data-target-id="${escapeHtml(w.id)}">×</button>
    `;
    tb.append(titleWrap, btns);

    const client = document.createElement('div');
    client.className = 'subsys-win-client';

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'subsys-win-resize-se';
    resizeHandle.setAttribute('data-testid', 'window-resize');
    resizeHandle.setAttribute('data-system-id', sysId);
    resizeHandle.setAttribute('data-window-id', w.id);

    el.append(tb, client, resizeHandle);

    return {
      el,
      tb,
      titleTextEl: titleWrap.querySelector('.win-title-text'),
      client,
      childSysId: w.childSystemId || null,
      appCtx: null,
      lastRectSig: '',
      lastUiSig: ''
    };
  }

  updateSubsysWinNode(sysId, wRec, w) {
    const rectSig = `${w.x},${w.y},${w.w},${w.h},${w.zIndex},${w.focused},${w.minimized},${w.maximized},${w.title}`;
    if (wRec.lastRectSig !== rectSig) {
      wRec.lastRectSig = rectSig;
      wRec.el.style.left = w.x + 'px';
      wRec.el.style.top = w.y + 'px';
      wRec.el.style.width = w.w + 'px';
      wRec.el.style.height = w.h + 'px';
      wRec.el.style.zIndex = String(w.zIndex || 10);
      wRec.el.style.display = w.minimized ? 'none' : 'flex';
      wRec.el.classList.toggle('focused', Boolean(w.focused));
      wRec.el.classList.toggle('maximized', Boolean(w.maximized));
      wRec.titleTextEl.textContent = w.title;
    }

    if (w.appId === 'subsystem' && w.childSystemId) {
      if (!wRec.childMounted) {
        wRec.childMounted = true;
        wRec.childSysId = w.childSystemId;
        this.mountSubsystem(w.childSystemId, wRec.client);
      } else {
        this.renderSubsystem(w.childSystemId);
      }
      return;
    }

    if (w.appId === 'projection') {
      if (!wRec.projMounted) {
        wRec.projMounted = true;
        this.mountProjection(w.id, wRec.client);
      } else {
        this.renderProjection(w.id);
      }
      return;
    }

    const slot = this.hostKernel.subsystems.get(sysId);
    const ui = slot?.appUIs?.[w.id] || w.ui;
    if (!ui) return;

    this.reconcileAppContent(sysId, w.id, wRec.client, ui, wRec, null);
  }

  // Shared App UI reconciler used for BOTH normal subsystem windows AND Cross-Layer Projection windows
  reconcileAppContent(sourceSysId, sourceWinId, containerEl, ui, stateHolder, projContext) {
    const targetSysId = projContext ? projContext.targetSysId : sourceSysId;
    const domWinId = projContext ? projContext.projWinId : sourceWinId;

    const sendAction = (action, extra = {}) => {
      const ev = {
        type: 'control_action',
        controlHint: {
          windowId: sourceWinId,
          action,
          ...extra
        },
        value: extra.value
      };
      if (projContext) {
        this.hostKernel.sendInputFromProjection(projContext.projWinId, ev);
      } else {
        const topSysId = this.getTopmostAncestorChild(sourceSysId);
        this.hostKernel.forwardInputToSubsystem(sourceSysId, {
          type: 'keydown',
          key: '',
          ...ev
        });
      }
    };

    const sendAppInput = (action, value, extra = {}) => {
      const ev = {
        type: 'input_text',
        value,
        field: extra.field,
        controlHint: {
          windowId: sourceWinId,
          action,
          ...extra
        }
      };
      if (projContext) {
        this.hostKernel.sendInputFromProjection(projContext.projWinId, ev);
      } else {
        const slot = this.hostKernel.subsystems.get(sourceSysId);
        const w = slot?.lastDesktop?.windows?.find((x) => x.id === sourceWinId);
        if (w) {
          this.hostKernel.forwardInputToSubsystem(sourceSysId, ev);
        }
      }
    };

    if (ui.kind === 'loading') {
      if (stateHolder.lastKind !== 'loading') {
        stateHolder.lastKind = 'loading';
        containerEl.innerHTML = `<div class="app-loading-pane">${escapeHtml(ui.text || '正在启动...')}</div>`;
      }
      return;
    }

    if (ui.kind === 'player') {
      this.reconcilePlayerUI(sourceSysId, sourceWinId, targetSysId, domWinId, containerEl, ui, stateHolder, projContext, sendAppInput);
      return;
    }

    if (ui.kind === 'charts') {
      this.reconcileChartsUI(sourceSysId, sourceWinId, targetSysId, domWinId, containerEl, ui, stateHolder, projContext, sendAppInput);
      return;
    }

    if (ui.kind === 'files') {
      this.reconcileFilesUI(sourceSysId, sourceWinId, containerEl, ui, stateHolder, sendAppInput);
      return;
    }

    if (ui.kind === 'editor') {
      this.reconcileEditorUI(sourceSysId, sourceWinId, containerEl, ui, stateHolder, sendAppInput);
      return;
    }

    if (ui.kind === 'tasks') {
      this.reconcileTasksUI(sourceSysId, sourceWinId, containerEl, ui, stateHolder, sendAppInput);
      return;
    }
  }

  reconcilePlayerUI(srcSysId, srcWinId, domSysId, domWinId, container, ui, holder, projCtx, sendAppInput) {
    if (!holder.playerDom) {
      container.innerHTML = `
        <div class="ns-player-root">
          <div class="ns-player-topbar">
            <input class="ns-inp player-scene-inp" data-testid="player-scene-path" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="scene_input" />
            <button class="ns-btn" data-testid="player-open" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="open_scene">打开</button>
            <button class="ns-btn" data-testid="player-camera" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="set_camera"></button>
            <span class="ns-badge player-mode-badge"></span>
            <button class="ns-btn ns-btn-accent" data-testid="rehearsal-start" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="start_rehearsal">转入飞行排演</button>
          </div>
          <div class="ns-player-stage">
            <canvas class="player-3d-canvas" data-testid="player-view" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}"></canvas>
            <div class="ns-player-hud">
              <div class="hud-chip" data-testid="player-selection" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}">未选中部件</div>
              <div class="hud-chip hud-alt">高度: 0.0m</div>
            </div>
          </div>
          <div class="ns-player-controls">
            <button class="ns-btn" data-testid="player-play" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="play">播放</button>
            <button class="ns-btn" data-testid="player-pause" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="pause">暂停</button>
            <button class="ns-btn" data-testid="player-stop" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="stop">停止</button>
            <button class="ns-btn" data-testid="player-step" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="step">单步</button>
            <button class="ns-btn" data-testid="player-loop" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="toggle_loop">循环: 关</button>
            <input type="range" min="0" max="15" step="0.05" class="ns-slider" data-testid="player-seek" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="seek" />
            <span class="ns-time-pill" data-testid="player-time" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}">0.00s / 15.00s</span>
            <label class="ns-lbl">倍率<input type="number" step="0.25" min="0.1" max="4" class="ns-inp ns-inp-xs" data-testid="player-rate" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="set_rate" /></label>
          </div>
          <div class="ns-rehearsal-bar">
            <label class="ns-lbl">风速<input type="number" step="0.5" class="ns-inp ns-inp-xs" data-testid="rehearsal-wind" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="set_wind" /></label>
            <label class="ns-lbl">航向<input type="number" step="0.2" class="ns-inp ns-inp-xs" data-testid="rehearsal-heading" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="set_heading" /></label>
            <button class="ns-btn" data-ns-action="land_pad2">前往2号坪降落</button>
            <button class="ns-btn" data-testid="rehearsal-fault" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="trigger_fault">故障注入</button>
            <label class="ns-lbl">飞控<input type="text" class="ns-inp ns-inp-sm" data-testid="rehearsal-controller" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="ctrl_path_input" /></label>
            <button class="ns-btn" data-ns-action="reload_controller">应用</button>
            <button class="ns-btn" data-ns-action="save_rehearsal">保存排演</button>
            <span class="ns-status-txt player-status-txt"></span>
          </div>
        </div>
      `;

      const rootEl = container.querySelector('.ns-player-root');
      const canvas = rootEl.querySelector('.player-3d-canvas');
      const sceneInp = rootEl.querySelector('[data-testid="player-scene-path"]');
      const seekInp = rootEl.querySelector('[data-testid="player-seek"]');
      const rateInp = rootEl.querySelector('[data-testid="player-rate"]');
      const windInp = rootEl.querySelector('[data-testid="rehearsal-wind"]');
      const headInp = rootEl.querySelector('[data-testid="rehearsal-heading"]');
      const ctrlInp = rootEl.querySelector('[data-testid="rehearsal-controller"]');

      const bindField = (el, action) => {
        el.addEventListener('input', () => sendAppInput(action, el.value));
        el.addEventListener('change', () => sendAppInput(action, el.value));
      };
      bindField(sceneInp, 'scene_input');
      bindField(seekInp, 'seek');
      bindField(rateInp, 'set_rate');
      bindField(windInp, 'set_wind');
      bindField(headInp, 'set_heading');
      bindField(ctrlInp, 'ctrl_path_input');

      // Special projection click & 3D orbit/raycast forwarding
      const dispatchProj = (type, payload) => {
        if (projCtx) this.hostKernel.sendInputFromProjection(projCtx.projWinId, { type, ...payload });
      };
      if (projCtx) {
        let dragCanvas = false;
        let lastX = 0;
        let lastY = 0;
        rootEl.addEventListener('pointerdown', (e) => {
          const activeCanvas = holder.playerDom?.canvas || canvas;
          if (e.target === activeCanvas || e.target?.closest?.('[data-testid="player-view"]') === activeCanvas) {
            dragCanvas = true;
            lastX = e.clientX;
            lastY = e.clientY;
            const r = activeCanvas.getBoundingClientRect();
            const hint = {
              windowId: srcWinId,
              testId: 'player-view',
              normX: clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1),
              normY: clamp((e.clientY - r.top) / Math.max(1, r.height), 0, 1)
            };
            dispatchProj('pointerdown', { x: e.clientX, y: e.clientY, controlHint: hint });
            return;
          }
          const btn = e.target.closest('[data-ns-action]');
          if (!btn || btn.matches('input')) return;
          const act = btn.dataset.nsAction;
          const hint = { windowId: srcWinId, action: act, mode: btn.dataset.camMode };
          if (act === 'set_camera') {
            const order = ['cinematic', 'follow', 'orbit'];
            const cur = holder.playerDom.camBtn.dataset.camMode || 'cinematic';
            hint.mode = order[(order.indexOf(cur) + 1) % order.length];
          }
          dispatchProj('pointerdown', { x: 0, y: 0, controlHint: hint });
        });
        window.addEventListener('pointermove', (e) => {
          if (!dragCanvas || !canvas.isConnected) return;
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;
          dispatchProj('pointermove', { x: e.clientX, y: e.clientY, dx, dy });
        });
        window.addEventListener('pointerup', () => {
          if (dragCanvas) { dragCanvas = false; dispatchProj('pointerup', {}); }
        });
        canvas.addEventListener('wheel', (e) => {
          e.preventDefault();
          dispatchProj('wheel', { deltaY: e.deltaY, controlHint: { testId: 'player-view' } });
        }, { passive: false });
      }

      holder.playerDom = {
        rootEl,
        canvas,
        sceneInp,
        camBtn: rootEl.querySelector('[data-testid="player-camera"]'),
        modeBadge: rootEl.querySelector('.player-mode-badge'),
        startRehBtn: rootEl.querySelector('[data-testid="rehearsal-start"]'),
        selChip: rootEl.querySelector('[data-testid="player-selection"]'),
        altChip: rootEl.querySelector('.hud-alt'),
        loopBtn: rootEl.querySelector('[data-testid="player-loop"]'),
        seekInp,
        timePill: rootEl.querySelector('[data-testid="player-time"]'),
        rateInp,
        windInp,
        headInp,
        faultBtn: rootEl.querySelector('[data-testid="rehearsal-fault"]'),
        ctrlInp,
        statusTxt: rootEl.querySelector('.player-status-txt')
      };
    }

    const d = holder.playerDom;
    // Render live 3D frame onto canvas every tick
    this.three.renderViewport(srcSysId, srcWinId, d.canvas, ui);

    const camLabels = { cinematic: '镜头: 演出', follow: '镜头: 跟随', orbit: '镜头: 环绕' };
    const camOrder = ['cinematic', 'follow', 'orbit'];
    const curCam = ui.cameraMode || 'cinematic';
    d.camBtn.textContent = camLabels[curCam] || '镜头: 演出';
    d.camBtn.dataset.camMode = camOrder[(camOrder.indexOf(curCam) + 1) % camOrder.length];

    d.modeBadge.textContent = ui.mode === 'rehearsal' ? '闭环排演' : '录像回放';
    d.modeBadge.classList.toggle('is-rehearsal', ui.mode === 'rehearsal');
    d.startRehBtn.textContent = ui.mode === 'rehearsal' ? '排演中' : '转入飞行排演';

    d.selChip.textContent = ui.selection || '未选中部件';
    d.altChip.textContent = `高度 ${(ui.heliAlt ?? 0).toFixed(1)}m${ui.crashed ? ' · 已坠毁' : ''}`;
    d.loopBtn.textContent = ui.loop ? '循环: 开' : '循环: 关';

    const dur = Math.max(0.1, ui.duration || 15);
    const pt = ui.playTime || 0;
    d.seekInp.max = String(dur);
    if (document.activeElement !== d.seekInp) d.seekInp.value = String(pt.toFixed(2));
    d.timePill.textContent = `${pt.toFixed(2)}s / ${dur.toFixed(2)}s`;

    if (document.activeElement !== d.sceneInp) d.sceneInp.value = ui.sceneOpenInput || ui.scenePath || '';
    if (document.activeElement !== d.rateInp) d.rateInp.value = String(ui.rate ?? 1);
    if (document.activeElement !== d.windInp) d.windInp.value = String((ui.wind?.[0] ?? 1.4).toFixed(1));
    if (document.activeElement !== d.headInp) d.headInp.value = String((ui.targetHeading ?? 0.85).toFixed(2));
    if (document.activeElement !== d.ctrlInp) d.ctrlInp.value = ui.controllerPath || '/System/flight_ctrl.ns';
    d.faultBtn.textContent = ui.faultMode && ui.faultMode !== 'none' ? '清除故障' : '尾桨故障';
    d.statusTxt.textContent = ui.statusMsg || '';
  }

  reconcileChartsUI(srcSysId, srcWinId, domSysId, domWinId, container, ui, holder, projCtx, sendAppInput) {
    if (!holder.chartDom) {
      container.innerHTML = `
        <div class="ns-charts-root">
          <div class="ns-charts-bar">
            <select class="ns-inp ns-inp-sm" data-testid="chart-source" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="select_source"></select>
            <input class="ns-inp ns-inp-xs" data-testid="chart-range" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="input_range" placeholder="A1:D4" />
            <input class="ns-inp ns-inp-xxs" data-testid="chart-label-column" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="select_label_col" title="分类列" />
            <input class="ns-inp ns-inp-xs" data-testid="chart-series" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="select_series" title="数值列" />
            <button class="ns-btn ns-btn-accent" data-testid="chart-connect" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="connect">连接</button>
            <button class="ns-btn" data-testid="chart-disconnect" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="disconnect">断开</button>
            <button class="ns-btn" data-testid="chart-type" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}" data-ns-action="toggle_type">柱状图</button>
          </div>
          <div class="ns-charts-status-row">
            <span class="ns-conn-pill">未连接</span>
            <span class="ns-charts-info"></span>
          </div>
          <div class="ns-charts-canvas-wrap">
            <canvas class="ns-charts-canvas" data-testid="chart-canvas" data-system-id="${escapeHtml(domSysId)}" data-window-id="${escapeHtml(domWinId)}"></canvas>
          </div>
        </div>
      `;

      const root = container.querySelector('.ns-charts-root');
      const srcSel = root.querySelector('[data-testid="chart-source"]');
      const rngInp = root.querySelector('[data-testid="chart-range"]');
      const lblInp = root.querySelector('[data-testid="chart-label-column"]');
      const serInp = root.querySelector('[data-testid="chart-series"]');
      const bindField = (el, act) => {
        el.addEventListener('change', () => sendAppInput(act, el.value));
        if (el.tagName === 'INPUT') el.addEventListener('input', () => sendAppInput(act, el.value));
      };
      bindField(srcSel, 'select_source');
      bindField(rngInp, 'input_range');
      bindField(lblInp, 'select_label_col');
      bindField(serInp, 'select_series');

      if (projCtx) {
        root.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-ns-action]');
          if (!btn) return;
          this.hostKernel.sendInputFromProjection(projCtx.projWinId, {
            type: 'pointerdown',
            controlHint: { windowId: srcWinId, action: btn.dataset.nsAction }
          });
        });
      }

      holder.chartDom = {
        root,
        srcSel,
        rngInp,
        lblInp,
        serInp,
        typeBtn: root.querySelector('[data-testid="chart-type"]'),
        connPill: root.querySelector('.ns-conn-pill'),
        infoEl: root.querySelector('.ns-charts-info'),
        canvas: root.querySelector('.ns-charts-canvas')
      };
    }

    const d = holder.chartDom;
    // Update workbook dropdown options if changed
    const optsSig = JSON.stringify(ui.sources || []) + '|' + (ui.selectedDocId || '');
    if (d.lastOptsSig !== optsSig && document.activeElement !== d.srcSel) {
      d.lastOptsSig = optsSig;
      const list = ui.sources || [];
      d.srcSel.innerHTML = list.length === 0
        ? '<option value="">(无已打开工作簿)</option>'
        : list.map((s) => `<option value="${escapeHtml(s.docId)}" ${s.docId === ui.selectedDocId ? 'selected' : ''}>${escapeHtml(s.title)}</option>`).join('');
    }
    if (document.activeElement !== d.rngInp) d.rngInp.value = ui.rangeStr || 'A1:D4';
    if (document.activeElement !== d.lblInp) d.lblInp.value = ui.labelCol || 'A';
    if (document.activeElement !== d.serInp) d.serInp.value = ui.seriesStr || 'B,C,D';
    d.typeBtn.textContent = ui.chartType === 'line' ? '图表: 折线图 (切换)' : '图表: 柱状图 (切换)';

    const connLabels = {
      disconnected: '已断开',
      connected: `实时同步 · v${ui.version || 1}`,
      source_closed: '数据源已关闭',
      restored_pending: '快照恢复 · 待重连'
    };
    d.connPill.textContent = connLabels[ui.connectionState] || ui.connectionState;
    d.connPill.dataset.conn = ui.connectionState || 'disconnected';
    d.infoEl.textContent = ui.statusMsg || '';

    this.drawChartCanvas(d.canvas, ui.geometry);
  }

  drawChartCanvas(canvas, geom) {
    if (!canvas || !canvas.isConnected) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(280, Math.round(rect.width || 560));
    const h = Math.max(160, Math.round(rect.height || 260));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    if (!geom || !geom.series || geom.series.length === 0 || !geom.labels || geom.labels.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('选择根系统工作簿与区域后点击“连接”加载实时图表', w / 2, h / 2);
      return;
    }

    const pad = { l: 54, r: 22, t: 36, b: 36 };
    const pw = Math.max(40, w - pad.l - pad.r);
    const ph = Math.max(40, h - pad.t - pad.b);
    const yMin = geom.yMin ?? 0;
    const yMax = Math.max(yMin + 1, geom.yMax ?? 10);
    const toY = (val) => pad.t + ph - ((val - yMin) / (yMax - yMin)) * ph;

    // Grid lines
    ctx.strokeStyle = 'rgba(148,163,184,0.16)';
    ctx.lineWidth = 1;
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const val = yMin + ((yMax - yMin) * i) / 4;
      const y = toY(val);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + pw, y);
      ctx.stroke();
      ctx.fillText(Number.isInteger(val) ? String(val) : val.toFixed(1), pad.l - 8, y);
    }

    const colors = ['#38bdf8', '#34d399', '#facc15', '#f472b6', '#a78bfa'];
    const labels = geom.labels;
    const nCat = labels.length;
    const nSer = geom.series.length;
    const groupW = pw / nCat;

    // X labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#cbd5e1';
    for (let i = 0; i < nCat; i++) {
      ctx.fillText(String(labels[i]), pad.l + groupW * (i + 0.5), pad.t + ph + 8);
    }

    // Legend
    let lx = pad.l;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let s = 0; s < nSer; s++) {
      ctx.fillStyle = colors[s % colors.length];
      ctx.fillRect(lx, 12, 12, 12);
      ctx.fillStyle = '#e2e8f0';
      const nm = String(geom.series[s].name || geom.series[s].col);
      ctx.fillText(nm, lx + 16, 18);
      lx += 28 + ctx.measureText(nm).width;
    }

    if (geom.chartType === 'line') {
      for (let s = 0; s < nSer; s++) {
        const ser = geom.series[s];
        const col = colors[s % colors.length];
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        for (let i = 0; i < nCat; i++) {
          const v = ser.animVals?.[i] ?? ser.targetVals?.[i] ?? 0;
          const x = pad.l + groupW * (i + 0.5);
          const y = toY(v);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        for (let i = 0; i < nCat; i++) {
          const v = ser.animVals?.[i] ?? ser.targetVals?.[i] ?? 0;
          const x = pad.l + groupW * (i + 0.5);
          const y = toY(v);
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(x, y, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(Math.round(v * 10) / 10), x, y - 10);
        }
      }
    } else {
      const barPad = Math.max(4, groupW * 0.16);
      const barW = Math.max(8, (groupW - barPad * 2) / nSer - 3);
      const baseZero = toY(Math.max(0, yMin));
      for (let s = 0; s < nSer; s++) {
        const ser = geom.series[s];
        const col = colors[s % colors.length];
        for (let i = 0; i < nCat; i++) {
          const v = ser.animVals?.[i] ?? ser.targetVals?.[i] ?? 0;
          const bx = pad.l + i * groupW + barPad + s * (barW + 3);
          const by = toY(v);
          const bh = Math.max(2, baseZero - by);
          ctx.fillStyle = col;
          ctx.fillRect(bx, Math.min(by, baseZero), barW, Math.abs(bh));
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(Math.round(v * 10) / 10), bx + barW / 2, Math.min(by, baseZero) - 10);
        }
      }
    }
  }

  reconcileFilesUI(sysId, winId, container, ui, holder, sendAppInput) {
    if (!holder.filesDom) {
      container.innerHTML = `
        <div class="ns-files-root" data-drop-sys-id="${escapeHtml(sysId)}" data-drop-win-id="${escapeHtml(winId)}">
          <div class="ns-files-toolbar">
            <button class="ns-btn" data-testid="files-new-file" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="new_file">新建文件</button>
            <button class="ns-btn" data-testid="files-new-folder" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="new_folder">新建目录</button>
            <button class="ns-btn" data-testid="files-open" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="open_selected">打开</button>
            <button class="ns-btn" data-testid="files-copy" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="copy_selected">复制</button>
            <button class="ns-btn" data-testid="files-paste" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="paste">粘贴</button>
            <button class="ns-btn" data-ns-action="start_rename">重命名</button>
            <button class="ns-btn" data-ns-action="delete_selected">删除</button>
            <button class="ns-btn files-restore-btn" data-ns-action="restore_selected">回收站还原</button>
            <button class="ns-btn" data-ns-action="toggle_sort" data-sort-by="name">按名称</button>
            <button class="ns-btn" data-ns-action="toggle_sort" data-sort-by="size">按大小</button>
          </div>
          <div class="ns-files-pathbar">
            <input class="ns-inp flex-1" data-testid="files-path" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="path_input" />
            <button class="ns-btn" data-ns-action="path_go">前往</button>
            <button class="ns-btn files-host-import-btn" title="从宿主机本机导入文件">本机导入</button>
            <button class="ns-btn" data-ns-action="host_export">导出本机</button>
          </div>
          <div class="ns-files-body">
            <div class="ns-files-nav">
              ${['/Documents', '/System', '/Demo', '/RecycleBin'].map((p) => `
                <button class="ns-nav-item" data-testid="files-nav" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-file-path="${p}" data-ns-action="nav">${escapeHtml(p === '/Documents' ? '文档 /Documents' : p === '/System' ? '系统 /System' : p === '/Demo' ? '演示 /Demo' : '回收站')}</button>
              `).join('')}
            </div>
            <div class="ns-files-list" data-testid="files-list" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}"></div>
          </div>
          <div class="ns-files-modal-slot"></div>
          <div class="ns-files-footer">
            <span class="files-status-txt"></span>
            <span class="files-quota-txt"></span>
          </div>
        </div>
      `;

      const root = container.querySelector('.ns-files-root');
      const pathInp = root.querySelector('[data-testid="files-path"]');
      pathInp.addEventListener('input', () => sendAppInput('path_input', pathInp.value));
      pathInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.hostKernel.forwardInputToSubsystem(sysId, {
            type: 'pointerdown',
            controlHint: { windowId: winId, action: 'path_go' }
          });
        }
      });

      // Host import bridge (opens OS file picker in preload and pushes external_drop into this Files window)
      const importBtn = root.querySelector('.files-host-import-btn');
      importBtn.addEventListener('click', async () => {
        if (!window.hostBridge?.importFile) return;
        const res = await window.hostBridge.importFile();
        if (res && !res.canceled) {
          this.hostKernel.forwardInputToSubsystem(sysId, {
            type: 'drop_file_to_window',
            winId,
            name: res.name,
            content: res.content
          });
        }
      });

      holder.filesDom = {
        root,
        pathInp,
        listEl: root.querySelector('[data-testid="files-list"]'),
        restoreBtn: root.querySelector('.files-restore-btn'),
        modalSlot: root.querySelector('.ns-files-modal-slot'),
        statusTxt: root.querySelector('.files-status-txt'),
        quotaTxt: root.querySelector('.files-quota-txt'),
        lastListSig: '',
        lastModalSig: ''
      };
    }

    const d = holder.filesDom;
    if (document.activeElement !== d.pathInp) d.pathInp.value = ui.pathInput || ui.curDir || '/';
    d.restoreBtn.style.display = ui.curDir === '/RecycleBin' ? 'inline-flex' : 'none';
    d.statusTxt.textContent = ui.statusMsg || '';
    const usedKB = Math.round((ui.storageUsed || 0) / 1024);
    const quotaKB = Math.round((ui.storageQuota || 0) / 1024);
    d.quotaTxt.textContent = `存储 ${usedKB} / ${quotaKB} KB`;

    const listSig = JSON.stringify({ curDir: ui.curDir, entries: ui.entries, sel: ui.selected });
    if (d.lastListSig !== listSig) {
      d.lastListSig = listSig;
      const selSet = new Set(ui.selected || []);
      d.listEl.innerHTML = (ui.entries || []).length === 0
        ? '<div class="ns-empty-dir">(空目录 · 可从其他层拖放文件至此)</div>'
        : (ui.entries || []).map((ent) => `
          <div class="ns-file-row ${selSet.has(ent.path) ? 'selected' : ''}"
               data-testid="files-item"
               data-system-id="${escapeHtml(sysId)}"
               data-window-id="${escapeHtml(winId)}"
               data-file-path="${escapeHtml(ent.path)}"
               data-file-name="${escapeHtml(ent.name)}"
               data-file-type="${escapeHtml(ent.type)}"
               data-ns-action="select_item">
            ${getFileIconSvg(ent.name, ent.type === 'dir', 'file-row-svg')}
            <span class="file-row-name">${escapeHtml(ent.name)}</span>
            <span class="file-row-size">${ent.type === 'dir' ? '目录' : `${ent.size} B`}</span>
          </div>
        `).join('');
    }

    const modalSig = JSON.stringify({ rename: ui.renameTarget, ov: ui.overwritePrompt, snap: ui.snapModal });
    if (d.lastModalSig !== modalSig) {
      d.lastModalSig = modalSig;
      if (ui.overwritePrompt) {
        d.modalSlot.innerHTML = `
          <div class="ns-inline-prompt">
            <span>同名文件 ${escapeHtml(ui.overwritePrompt.name)} 已存在，是否覆盖？</span>
            <button class="ns-btn ns-btn-accent" data-ns-action="overwrite_yes">覆盖</button>
            <button class="ns-btn" data-ns-action="overwrite_no">取消</button>
          </div>
        `;
      } else if (ui.snapModal) {
        d.modalSlot.innerHTML = `
          <div class="ns-inline-prompt">
            <span>快照文件: ${escapeHtml(ui.snapModal.path)}</span>
            <button class="ns-btn ns-btn-accent" data-ns-action="snap_fork">从快照新建分支子树</button>
            <button class="ns-btn" data-ns-action="snap_close">关闭</button>
          </div>
        `;
      } else if (ui.renameTarget) {
        d.modalSlot.innerHTML = `
          <div class="ns-inline-prompt">
            <span>重命名为:</span>
            <input class="ns-inp ns-inp-sm rename-inp" value="${escapeHtml(ui.renameText || '')}" />
            <button class="ns-btn ns-btn-accent" data-ns-action="rename_confirm">确定</button>
            <button class="ns-btn" data-ns-action="rename_cancel">取消</button>
          </div>
        `;
        const ri = d.modalSlot.querySelector('.rename-inp');
        ri.addEventListener('input', () => sendAppInput('rename_input', ri.value));
      } else {
        d.modalSlot.innerHTML = '';
      }
    }
  }

  reconcileEditorUI(sysId, winId, container, ui, holder, sendAppInput) {
    if (!holder.editorDom) {
      container.innerHTML = `
        <div class="ns-editor-root">
          <div class="ns-editor-toolbar">
            <input class="ns-inp flex-1" data-testid="editor-filename" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="edit_text" data-field="filename" />
            <button class="ns-btn" data-ns-action="open_file_path">打开</button>
            <button class="ns-btn" data-ns-action="new_blank">新建</button>
            <button class="ns-btn ns-btn-accent" data-testid="editor-save" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="save">保存</button>
            <button class="ns-btn" data-ns-action="run">运行</button>
            <button class="ns-btn editor-rebuild-btn" data-ns-action="rebuild_compiler" style="display:none;">重建自举编译器</button>
          </div>
          <textarea class="ns-editor-area" spellcheck="false" data-testid="editor-text" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="edit_text"></textarea>
          <div class="ns-editor-err" style="display:none;"></div>
          <div class="ns-editor-footer">
            <span class="editor-status"></span>
            <span class="editor-run-badge"></span>
          </div>
        </div>
      `;
      const root = container.querySelector('.ns-editor-root');
      const fnInp = root.querySelector('[data-testid="editor-filename"]');
      const ta = root.querySelector('[data-testid="editor-text"]');

      fnInp.addEventListener('input', () => sendAppInput('edit_text', fnInp.value, { field: 'filename' }));
      fnInp.addEventListener('change', () => sendAppInput('edit_text', fnInp.value, { field: 'filename' }));
      ta.addEventListener('input', () => sendAppInput('edit_text', ta.value, { field: 'content' }));
      ta.addEventListener('change', () => sendAppInput('edit_text', ta.value, { field: 'content' }));

      holder.editorDom = {
        fnInp,
        ta,
        rebuildBtn: root.querySelector('.editor-rebuild-btn'),
        errEl: root.querySelector('.ns-editor-err'),
        statusEl: root.querySelector('.editor-status'),
        runBadge: root.querySelector('.editor-run-badge'),
        lastSyncedPath: ''
      };
    }

    const d = holder.editorDom;
    if (document.activeElement !== d.fnInp) d.fnInp.value = ui.filePath || '';
    // Update textarea when opening a different file or when user isn't typing in it
    if (document.activeElement !== d.ta || d.lastSyncedPath !== ui.filePath) {
      d.ta.value = ui.content || '';
      d.lastSyncedPath = ui.filePath;
    }
    d.rebuildBtn.style.display = ui.isCompilerFile ? 'inline-flex' : 'none';
    if (ui.compileError) {
      d.errEl.style.display = 'block';
      d.errEl.textContent = ui.compileError;
    } else {
      d.errEl.style.display = 'none';
    }
    d.statusEl.textContent = (ui.dirty ? '● 未保存 · ' : '') + (ui.statusMsg || '');
    d.runBadge.textContent = ui.runInfo ? `运行 PID ${ui.runInfo.pid}: ${ui.runInfo.state}` : (ui.runPid ? `PID ${ui.runPid}` : '');
  }

  reconcileTasksUI(sysId, winId, container, ui, holder, sendAppInput) {
    if (!holder.tasksDom) {
      container.innerHTML = `
        <div class="ns-tasks-root">
          <div class="ns-tasks-section">
            <div class="ns-tasks-hdr">系统预算、配额与实时遥测 (<span class="tasks-sys-name"></span>)</div>
            <div class="ns-tasks-quotas">
              <label class="ns-lbl">总预算<input type="number" class="ns-inp ns-inp-xs" data-testid="tasks-budget" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="input_budget" /></label>
              <label class="ns-lbl">内存(KB)<input type="number" class="ns-inp ns-inp-xs" data-testid="tasks-memory" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="input_mem" /></label>
              <label class="ns-lbl">存储(KB)<input type="number" class="ns-inp ns-inp-xs" data-testid="tasks-storage" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="input_storage" /></label>
              <button class="ns-btn ns-btn-accent" data-ns-action="apply_quotas">应用配额</button>
            </div>
            <div class="ns-tasks-telemetry"></div>
            <div class="ns-tasks-status" data-testid="tasks-status" style="font-size:11px;color:#38bdf8;margin-top:4px;min-height:14px;"></div>
          </div>
          <div class="ns-tasks-section">
            <div class="ns-tasks-hdr-row">
              <span class="ns-tasks-hdr">直属子系统实例</span>
              <button class="ns-btn ns-btn-accent" data-testid="system-new" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-ns-action="sys_new">新建子系统</button>
            </div>
            <div class="ns-tasks-children"></div>
          </div>
          <div class="ns-tasks-section flex-1">
            <div class="ns-tasks-hdr">本系统进程列表</div>
            <div class="ns-tasks-procs"></div>
          </div>
        </div>
      `;

      const root = container.querySelector('.ns-tasks-root');
      const bInp = root.querySelector('[data-testid="tasks-budget"]');
      const mInp = root.querySelector('[data-testid="tasks-memory"]');
      const sInp = root.querySelector('[data-testid="tasks-storage"]');
      const sendWinControl = (el, controlHint) => {
        const rect = el.getBoundingClientRect();
        const pt = this.toDesktopCoords(sysId, rect.left + rect.width / 2, rect.top + rect.height / 2);
        this.hostKernel.forwardInputToSubsystem(sysId, {
          type: 'pointerdown',
          x: pt.x,
          y: pt.y,
          controlHint
        });
      };
      bInp.addEventListener('input', () => sendAppInput('input_budget', bInp.value));
      mInp.addEventListener('input', () => sendAppInput('input_mem', mInp.value));
      sInp.addEventListener('input', () => sendAppInput('input_storage', sInp.value));
      for (const el of [bInp, mInp, sInp]) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            sendWinControl(el, { windowId: winId, action: 'apply_quotas' });
          }
        });
      }

      const childrenBox = root.querySelector('.ns-tasks-children');
      childrenBox.addEventListener('input', (e) => {
        const inp = e.target.closest('[data-testid="tasks-grant"]');
        if (inp) sendAppInput('input_grant', inp.value, { targetId: inp.dataset.targetSystemId });
      });
      childrenBox.addEventListener('keydown', (e) => {
        const inp = e.target.closest('[data-testid="tasks-grant"]');
        if (inp && e.key === 'Enter') {
          sendWinControl(inp, { windowId: winId, action: 'apply_grant', targetId: inp.dataset.targetSystemId });
        }
      });
      childrenBox.addEventListener('change', (e) => {
        const sel = e.target.closest('[data-ns-action="sys_speed"]');
        if (sel) {
          sendWinControl(sel, { windowId: winId, action: 'sys_speed', targetId: sel.dataset.targetSystemId, value: Number(sel.value) });
        }
      });

      holder.tasksDom = {
        sysNameEl: root.querySelector('.tasks-sys-name'),
        bInp,
        mInp,
        sInp,
        telemetryEl: root.querySelector('.ns-tasks-telemetry'),
        statusEl: root.querySelector('.ns-tasks-status'),
        childrenEl: childrenBox,
        procsEl: root.querySelector('.ns-tasks-procs'),
        lastChildrenSig: '',
        lastProcsSig: ''
      };
    }

    const d = holder.tasksDom;
    const info = ui.sysInfo || {};
    d.sysNameEl.textContent = `${info.name || sysId} · 编译器 ${info.compilerId || 'self'}`;
    if (d.statusEl) d.statusEl.textContent = ui.statusMsg || '';
    if (document.activeElement !== d.bInp) d.bInp.value = ui.inputBudget || String(info.totalBudget || '');
    if (document.activeElement !== d.mInp) d.mInp.value = ui.inputMemKB || '';
    if (document.activeElement !== d.sInp) d.sInp.value = ui.inputStorageKB || '';

    const tel = info.telemetry || {};
    const memKB = Math.round((info.memUsed || 0) / 1024);
    const memMaxKB = Math.round((info.memQuota || 1) / 1024);
    const stKB = Math.round((info.storageUsed || 0) / 1024);
    const stMaxKB = Math.round((info.storageQuota || 1) / 1024);
    d.telemetryEl.innerHTML = `
      <span>实际拨付: <b>${tel.lastGrant ?? info.totalBudget ?? 0}</b></span>
      <span>内核: <b>${tel.kernelSteps ?? 0}</b></span>
      <span>应用: <b>${tel.userSteps ?? 0}</b></span>
      <span>子承载: <b>${tel.carrierSteps ?? 0}</b></span>
      <span>剩余工作: <b>${tel.remainingWork ?? 0}</b></span>
      <span>内存: <b>${memKB}/${memMaxKB} KB</b></span>
      <span>存储: <b>${stKB}/${stMaxKB} KB</b></span>
    `;

    const children = ui.children || [];
    const childSig = JSON.stringify(children.map((c) => ({
      id: c.id,
      state: c.state,
      paused: Boolean(c.paused),
      timeRate: c.timeRate,
      grantCap: c.grantCap,
      gi: ui.grantInputs?.[c.id]
    })));
    const activeEl = document.activeElement;
    const activeTag = activeEl?.tagName;
    const editingChildInput = d.childrenEl.contains(activeEl) && (activeTag === 'INPUT' || activeTag === 'SELECT');
    if (d.lastChildrenSig !== childSig && !editingChildInput) {
      d.lastChildrenSig = childSig;
      d.childrenEl.innerHTML = children.length === 0
        ? '<div class="ns-empty-row">尚无直属子系统</div>'
        : children.map((c) => `
          <div class="ns-child-row">
            <span class="child-id-badge">${escapeHtml(c.id)}</span>
            <span class="child-state-pill is-${escapeHtml(c.state)}">${escapeHtml(c.state)}</span>
            <label class="ns-lbl-xs">拨付<input type="number" class="ns-inp ns-inp-xxs" value="${escapeHtml(ui.grantInputs?.[c.id] ?? String(c.grantCap || 20000))}" data-testid="tasks-grant" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-target-system-id="${escapeHtml(c.id)}" data-ns-action="input_grant" /></label>
            <button class="ns-btn ns-btn-xs" data-ns-action="apply_grant" data-target-system-id="${escapeHtml(c.id)}">设拨付</button>
            <button class="ns-btn ns-btn-xs" data-testid="${c.paused ? 'system-resume' : 'system-pause'}" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-target-system-id="${escapeHtml(c.id)}" data-ns-action="${c.paused ? 'sys_resume' : 'sys_pause'}">${c.paused ? '继续' : '暂停'}</button>
            <button class="ns-btn ns-btn-xs" data-ns-action="sys_step" data-target-system-id="${escapeHtml(c.id)}">单步</button>
            <select class="ns-inp ns-inp-xxs" data-ns-action="sys_speed" data-target-system-id="${escapeHtml(c.id)}">
              ${[0.25, 0.5, 1, 2].map((sp) => `<option value="${sp}" ${(c.timeRate || 1) === sp ? 'selected' : ''}>${sp}x</option>`).join('')}
            </select>
            <button class="ns-btn ns-btn-xs" data-testid="system-restart" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-target-system-id="${escapeHtml(c.id)}" data-ns-action="sys_restart">重启</button>
            <button class="ns-btn ns-btn-xs" data-testid="kernel-open" data-system-id="${escapeHtml(sysId)}" data-window-id="${escapeHtml(winId)}" data-target-system-id="${escapeHtml(c.id)}" data-ns-action="kernel_open">内核源码</button>
            <button class="ns-btn ns-btn-xs" data-ns-action="sys_snapshot" data-target-system-id="${escapeHtml(c.id)}">快照</button>
            <button class="ns-btn ns-btn-xs" data-ns-action="sys_restore_latest" data-target-system-id="${escapeHtml(c.id)}">恢复</button>
            <button class="ns-btn ns-btn-xs" data-ns-action="sys_fork_latest" data-target-system-id="${escapeHtml(c.id)}">分叉</button>
          </div>
        `).join('');
    }

    const procs = ui.procs || [];
    const procSig = JSON.stringify(procs);
    if (d.lastProcsSig !== procSig) {
      d.lastProcsSig = procSig;
      d.procsEl.innerHTML = procs.map((p) => `
        <div class="ns-proc-row">
          <span class="proc-pid">#${p.pid}</span>
          <span class="proc-name">${escapeHtml(p.name)}</span>
          <span class="proc-role">${escapeHtml(p.role)}</span>
          <span class="proc-state is-${escapeHtml(p.state)}">${escapeHtml(p.state)}</span>
          <span class="proc-steps">${p.stepsThisTick || 0}/tick</span>
          <span class="proc-mem">${Math.round((p.memBytes || 0) / 1024)}KB</span>
          ${p.role !== 'wm' ? `
            <button class="ns-btn ns-btn-xs" data-ns-action="${p.state === 'suspended' ? 'proc_resume' : 'proc_suspend'}" data-pid="${p.pid}">${p.state === 'suspended' ? '恢复' : '挂起'}</button>
            <button class="ns-btn ns-btn-xs btn-danger-sm" data-ns-action="proc_kill" data-pid="${p.pid}">结束</button>
          ` : ''}
        </div>
      `).join('');
    }
  }

  renderProjection(projWinId) {
    const container = this.projectionMounts.get(projWinId);
    if (!container || !container.isConnected) return;
    const proj = this.hostKernel.projections.get(projWinId);
    if (!proj) return;

    const srcSlot = this.hostKernel.subsystems.get(proj.sourceSystemId);
    const ui = srcSlot?.appUIs?.[proj.sourceWindowId];
    if (!ui) {
      container.innerHTML = '<div class="app-loading-pane">正在同步源应用画面...</div>';
      return;
    }

    let holder = container._projHolder;
    if (!holder) {
      holder = { lastKind: '' };
      container._projHolder = holder;
    }

    const pauseReason = this.hostKernel.getPauseReason(proj.sourceSystemId);
    this.reconcileAppContent(proj.sourceSystemId, proj.sourceWindowId, container, ui, holder, {
      projWinId,
      targetSysId: proj.targetSysId
    });

    // Show subtle read-only source pause badge if source subtree is currently paused
    let pauseBadge = container.querySelector('.proj-pause-badge');
    if (pauseReason) {
      if (!pauseBadge) {
        pauseBadge = document.createElement('div');
        pauseBadge.className = 'proj-pause-badge';
        container.appendChild(pauseBadge);
      }
      pauseBadge.textContent = `源系统已暂停 (${proj.sourceSystemId})`;
      pauseBadge.style.display = 'block';
    } else if (pauseBadge) {
      pauseBadge.style.display = 'none';
    }
  }
}
