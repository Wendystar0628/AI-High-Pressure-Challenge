import * as THREE from 'three';
import {
  BASE_HALF,
  SLAB_BOTTOM,
  QUAY_Y,
  LANDING_Y,
  getSeabedY,
  isLandXZ,
  hash1,
} from './state.js';
import { createAnimeToonMaterial } from './toon.js';
import {
  createConcreteDeckTexture,
  createQuayMasonryTexture,
  createHazardCurbTexture,
  createSeabedTexture,
} from './textures.js';

function createTetrapodGeometry(scale = 1.0) {
  // 4-legged symmetric tetrahedron tetrapod built from merged tapered cylinders
  const dirs = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(Math.sqrt(8 / 9), -1 / 3, 0),
    new THREE.Vector3(-Math.sqrt(2 / 9), -1 / 3, Math.sqrt(2 / 3)),
    new THREE.Vector3(-Math.sqrt(2 / 9), -1 / 3, -Math.sqrt(2 / 3)),
  ];
  const group = new THREE.Group();
  const legMat = new THREE.MeshBasicMaterial();
  const legGeo = new THREE.CylinderGeometry(0.16 * scale, 0.34 * scale, 0.92 * scale, 8);
  legGeo.translate(0, 0.42 * scale, 0);

  const hubGeo = new THREE.SphereGeometry(0.32 * scale, 8, 6);
  const hub = new THREE.Mesh(hubGeo, legMat);
  group.add(hub);

  const up = new THREE.Vector3(0, 1, 0);
  dirs.forEach((d) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.quaternion.setFromUnitVectors(up, d.clone().normalize());
    group.add(leg);
  });

  return { dirs, legGeo, hubGeo };
}

export function buildBaseAndQuay(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const deckTex = createConcreteDeckTexture();
  const masonryTex = createQuayMasonryTexture();
  const hazardTex = createHazardCurbTexture();
  const seabedTex = createSeabedTexture();

  const matDeck = createAnimeToonMaterial({
    color: 0xeaf0f1,
    map: deckTex,
    wetness: 0.48,
    rimStrength: 0.14,
  });

  const matMasonry = createAnimeToonMaterial({
    color: 0xd8e2e4,
    map: masonryTex,
    wetness: 0.32,
    tidalDarken: true,
    shadowTintStrength: 0.44,
  });

  const matCoping = createAnimeToonMaterial({
    color: 0xe3eaec,
    wetness: 0.42,
    rimStrength: 0.18,
  });

  const matPlinth = createAnimeToonMaterial({
    color: 0x263f4d,
    wetness: 0.08,
    rimStrength: 0.08,
    shadowTintStrength: 0.25,
  });

  const matBedrock = createAnimeToonMaterial({
    color: 0x4b5f68,
    wetness: 0.06,
    shadowTintStrength: 0.4,
  });

  const matHazard = createAnimeToonMaterial({
    color: 0xffffff,
    map: hazardTex,
    wetness: 0.35,
  });

  const matRust = createAnimeToonMaterial({
    color: 0x8b4e38,
    wetness: 0.24,
    shadowTintStrength: 0.35,
  });

  const matSeabed = createAnimeToonMaterial({
    color: 0xa4c8c3,
    map: seabedTex,
    wetness: 0.05,
    shadowTintStrength: 0.35,
  });

  const matTire = createAnimeToonMaterial({
    color: 0x2e3b42,
    wetness: 0.12,
    shadowTintStrength: 0.35,
  });

  const matBarnacle = createAnimeToonMaterial({
    color: 0xdde0d2,
    wetness: 0.28,
  });

  const matOyster = createAnimeToonMaterial({
    color: 0x8d978c,
    wetness: 0.28,
  });

  const matSeaweed = createAnimeToonMaterial({
    color: 0x3b7a5e,
    wetness: 0.12,
    side: THREE.DoubleSide,
  });

  const matSeagrass = createAnimeToonMaterial({
    color: 0x4b9371,
    wetness: 0.1,
    side: THREE.DoubleSide,
  });

  const matTetrapod = createAnimeToonMaterial({
    color: 0xd8e1e2,
    wetness: 0.4,
    tidalDarken: true,
    shadowTintStrength: 0.38,
  });

  // Helper to add shadow-enabled mesh cleanly
  function addBox(w, h, d, x, y, z, mat, parent = root) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // ---------------------------------------------------------
  // 1. Diorama Square Plinth & Sub-seabed Cross-section Slab
  // ---------------------------------------------------------
  // Crisp miniature collectible base rim at bottom
  addBox(BASE_HALF * 2 + 0.36, 0.42, BASE_HALF * 2 + 0.36, 0, SLAB_BOTTOM - 0.16, 0, matPlinth);

  // Dark bedrock sub-base below seabed up to Y = -3.7
  addBox(BASE_HALF * 2, 1.35, BASE_HALF * 2, 0, SLAB_BOTTOM + 0.675, 0, matBedrock);

  // ---------------------------------------------------------
  // 2. Concrete Quays (Foreground South + West Arm + Hillside Foundation)
  // ---------------------------------------------------------
  const quayH = QUAY_Y - SLAB_BOTTOM; // 6.4m total vertical slab height
  const quayMidY = SLAB_BOTTOM + quayH * 0.5;

  // Foreground South Quay: X in [-19, +3.5], Z in [+5.5, +19]
  // Split cleanly around the Steps notch (X in [2.1, 3.5], Z in [10.05, 11.95])
  // and Slipway notch (X in [0.5, 3.5], Z in [12.6, 16.0]) so neither is buried!
  function addQuayBlock(xMin, xMax, zMin, zMax, topY = QUAY_Y) {
    const w = xMax - xMin;
    const d = zMax - zMin;
    const cx = (xMin + xMax) * 0.5;
    const cz = (zMin + zMax) * 0.5;
    const h = topY - SLAB_BOTTOM;
    const midY = SLAB_BOTTOM + h * 0.5;
    addBox(w, h - 0.16, d, cx, midY - 0.08, cz, matMasonry);
    addBox(w, 0.18, d, cx, topY - 0.09, cz, matDeck);
  }

  // Main left block of foreground quay: X in [-19, +0.5], Z in [+5.5, +19]
  addQuayBlock(-19.0, 0.5, 5.5, 19.0);
  // North-east apron above steps: X in [0.5, 3.5], Z in [5.5, 10.05]
  addQuayBlock(0.5, 3.5, 5.5, 10.05);
  // Approach strip west of steps: X in [0.5, 2.1], Z in [10.05, 11.95]
  addQuayBlock(0.5, 2.1, 10.05, 11.95);
  // Divider finger between steps and slipway: X in [0.5, 3.5], Z in [11.95, 12.6]
  addQuayBlock(0.5, 3.5, 11.95, 12.6);
  // South-east corner block south of slipway: X in [0.5, 3.5], Z in [16.0, 19.0]
  addQuayBlock(0.5, 3.5, 16.0, 19.0);

  // West Quay Arm: X in [-19, -5.0], Z in [-19, +5.5]
  addQuayBlock(-19.0, -5.0, -19.0, 5.5);

  // Architectural masonry coping lip along inner harbor edges
  addBox(0.32, 0.18, 16.0, -5.0 + 0.08, QUAY_Y - 0.09, -2.5, matCoping);
  addBox(8.5, 0.18, 0.32, -0.75, QUAY_Y - 0.09, 5.5 - 0.08, matCoping);
  addBox(0.32, 0.18, 4.55, 3.5 - 0.08, QUAY_Y - 0.09, 7.775, matCoping);
  addBox(0.32, 0.18, 3.0, 3.5 - 0.08, QUAY_Y - 0.09, 17.5, matCoping);

  // ---------------------------------------------------------
  // 3. Lower Boarding Platform & Concrete Steps (East edge of Foreground Quay)
  // ---------------------------------------------------------
  // Lower landing platform: X in [3.5, 5.4], Z in [7.6, 12.2], top at LANDING_Y = 0.55
  const landH = LANDING_Y - SLAB_BOTTOM;
  addBox(1.9, landH - 0.12, 4.6, 4.45, SLAB_BOTTOM + (landH - 0.12) * 0.5, 9.9, matMasonry);
  addBox(1.94, 0.14, 4.64, 4.45, LANDING_Y - 0.07, 9.9, matDeck);

  // 5 Concrete Steps cleanly open in notch X in [2.1, 3.5], Z in [10.05, 11.95]
  const stepCount = 5;
  for (let i = 0; i < stepCount; i++) {
    const sx = 2.1 + (i + 0.5) * (1.4 / stepCount);
    const topY = QUAY_Y - (i + 1) * ((QUAY_Y - LANDING_Y) / stepCount);
    const stepH = topY - SLAB_BOTTOM;
    addBox(1.4 / stepCount + 0.02, stepH, 1.9, sx, SLAB_BOTTOM + stepH * 0.5, 11.0, matCoping);
  }
  // Low concrete cheek curb bordering steps on South edge (Z = 12.1)
  addBox(1.65, 0.22, 0.24, 2.7, QUAY_Y + 0.11, 12.24, matCoping);

  // ---------------------------------------------------------
  // 4. Concrete Slipway Ramp (斜坡式滑道) at X in [0.5, 6.2], Z in [12.6, 16.0]
  // ---------------------------------------------------------
  const slipGroup = new THREE.Group();
  root.add(slipGroup);
  const slipDx = 5.7;
  const slipDy = QUAY_Y - (-0.45);
  const slipLen = Math.hypot(slipDx, slipDy);
  const slipSlope = Math.atan2(slipDy, slipDx);
  const slipSlab = new THREE.Mesh(new THREE.BoxGeometry(slipLen, 0.44, 3.4), matDeck);
  // Position slab so top surface at x=0.5 is QUAY_Y (1.4) and at x=6.2 is -0.45
  const midSlipY = (QUAY_Y + (-0.45)) * 0.5 - 0.22 * Math.cos(slipSlope);
  const midSlipX = (0.5 + 6.2) * 0.5 - 0.22 * Math.sin(slipSlope);
  slipSlab.position.set(midSlipX, midSlipY, 14.3);
  slipSlab.rotation.z = -slipSlope;
  slipSlab.castShadow = true;
  slipSlab.receiveShadow = true;
  slipGroup.add(slipSlab);

  // Solid masonry under-fill below the slipway ramp down to SLAB_BOTTOM (never pokes above ramp!)
  addBox(5.6, 4.4, 3.38, 3.35, SLAB_BOTTOM + 2.2, 14.3, matMasonry, slipGroup);

  // Raised sloped concrete side curbs flanking the slipway
  [-1.58, 1.58].forEach((dz) => {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(slipLen, 0.20, 0.22), matCoping);
    curb.position.set(midSlipX + 0.06, midSlipY + 0.28, 14.3 + dz);
    curb.rotation.z = -slipSlope;
    curb.castShadow = true;
    curb.receiveShadow = true;
    slipGroup.add(curb);
  });

  // ---------------------------------------------------------
  // 5. Yellow-Black Diagonal Hazard Wheel-Guard Curbs (护轮坎)
  // ---------------------------------------------------------
  function addHazardCurb(w, d, cx, cz) {
    const long = Math.max(w, d);
    const short = Math.min(w, d);
    const geo = new THREE.BoxGeometry(long, 0.22, short);
    const uvAttr = geo.attributes.uv;
    const normAttr = geo.attributes.normal;
    for (let i = 0; i < uvAttr.count; i++) {
      const ny = Math.abs(normAttr.getY(i));
      const nx = Math.abs(normAttr.getX(i));
      if (nx > 0.5) {
        uvAttr.setX(i, uvAttr.getX(i) * (short / 1.8));
      } else {
        uvAttr.setX(i, uvAttr.getX(i) * (long / 1.8));
      }
      if (ny > 0.5) {
        uvAttr.setY(i, uvAttr.getY(i) * (short / 0.38));
      }
    }
    const m = new THREE.Mesh(geo, matHazard);
    m.position.set(cx, QUAY_Y + 0.11, cz);
    if (d > w) m.rotation.y = Math.PI / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }
  // West quay inner edge (X = -5.22, Z = -9.6 .. 5.2)
  addHazardCurb(0.38, 14.6, -5.22, -2.2);
  // South quay inner edge (X = -4.9 .. 3.2, Z = 5.28)
  addHazardCurb(8.2, 0.38, -0.85, 5.28);
  // East quay edge above landing (X = 3.28, Z = 5.5 .. 9.8)
  addHazardCurb(0.38, 4.2, 3.28, 7.65);
  // East quay edge south of slipway (X = 3.28, Z = 16.2 .. 18.7)
  addHazardCurb(0.38, 2.5, 3.28, 17.45);

  // ---------------------------------------------------------
  // 6. Short Breakwater & Red-White Lighthouse (短防波堤与灯塔)
  // ---------------------------------------------------------
  const bwH = 1.55 - SLAB_BOTTOM;
  const bwY = SLAB_BOTTOM + bwH * 0.5;
  // Main breakwater arm: X in [-5.5, +4.2], Z in [-12.6, -9.8]
  addBox(9.7, bwH - 0.15, 2.8, -0.65, bwY - 0.08, -11.2, matMasonry);
  addBox(9.7, 0.16, 2.8, -0.65, 1.55 - 0.08, -11.2, matDeck);
  // Outer sea-facing wave parapet wall along Z = -12.35
  addBox(9.5, 0.85, 0.45, -0.7, 1.55 + 0.425, -12.38, matCoping);

  // Pierhead circular bastion at (4.2, -11.2) using clean coping & concrete drum
  const matPierWall = createAnimeToonMaterial({
    color: 0xc2d0d4,
    wetness: 0.3,
    tidalDarken: true,
    shadowTintStrength: 0.42,
  });
  const pierHeadBase = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.18, bwH, 20), matPierWall);
  pierHeadBase.position.set(4.2, bwY, -11.2);
  pierHeadBase.castShadow = true;
  pierHeadBase.receiveShadow = true;
  root.add(pierHeadBase);

  const pierHeadCap = new THREE.Mesh(new THREE.CylinderGeometry(2.12, 2.12, 0.22, 20), matCoping);
  pierHeadCap.position.set(4.2, 1.46, -11.2);
  pierHeadCap.castShadow = true;
  pierHeadCap.receiveShadow = true;
  root.add(pierHeadCap);

  // Small Red-and-White Lighthouse on Pierhead
  const lhGroup = new THREE.Group();
  lhGroup.position.set(4.2, 1.56, -11.2);
  root.add(lhGroup);

  const matLhWhite = createAnimeToonMaterial({ color: 0xf4f7f8, wetness: 0.35, rimStrength: 0.22 });
  const matLhRed = createAnimeToonMaterial({ color: 0xd94d3b, wetness: 0.35, rimStrength: 0.22 });
  const matDarkMetal = createAnimeToonMaterial({ color: 0x354954, wetness: 0.25 });

  // Octagonal plinth
  const lhPlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.08, 0.55, 8), matLhWhite);
  lhPlinth.position.y = 0.275;
  lhPlinth.castShadow = true;
  lhPlinth.receiveShadow = true;
  lhGroup.add(lhPlinth);

  // Alternating Red-White bands
  const bandSpecs = [
    [0.55, 1.05, 0.84, 0.77, matLhWhite],
    [1.60, 1.05, 0.77, 0.69, matLhRed],
    [2.65, 1.05, 0.69, 0.61, matLhWhite],
    [3.70, 0.90, 0.61, 0.55, matLhRed],
  ];
  bandSpecs.forEach(([y0, h, rBot, rTop, mat]) => {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 16), mat);
    seg.position.y = y0 + h * 0.5;
    seg.castShadow = true;
    seg.receiveShadow = true;
    lhGroup.add(seg);
  });

  // Small iron access door on tower base with threshold sill & brass latch
  const lhDoor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.68, 0.14), matDarkMetal);
  lhDoor.position.set(0, 0.92, 0.80);
  lhGroup.add(lhDoor);
  const lhDoorStep = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.24), matLhWhite);
  lhDoorStep.position.set(0, 0.56, 0.84);
  lhGroup.add(lhDoorStep);
  const lhKnob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), createAnimeToonMaterial({ color: 0xe3b856, wetness: 0.35 }));
  lhKnob.position.set(0.11, 0.90, 0.88);
  lhGroup.add(lhKnob);

  // Observation gallery platform + thin railing
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.66, 0.18, 16), matLhWhite);
  gallery.position.y = 4.65;
  gallery.castShadow = true;
  lhGroup.add(gallery);

  const railRing = new THREE.Mesh(new THREE.TorusGeometry(0.80, 0.025, 6, 20), matDarkMetal);
  railRing.rotation.x = Math.PI / 2;
  railRing.position.y = 5.02;
  lhGroup.add(railRing);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 6), matDarkMetal);
    post.position.set(Math.cos(a) * 0.80, 4.86, Math.sin(a) * 0.80);
    lhGroup.add(post);
  }

  // Lantern room glass & warm beacon bulb (lights up warmly when sky dims!)
  const lanternGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 0.68, 12),
    new THREE.MeshPhysicalMaterial({
      color: 0xdff6fa,
      transparent: true,
      opacity: 0.46,
      roughness: 0.12,
    })
  );
  lanternGlass.position.y = 5.06;
  lanternGlass.layers.set(1);
  lhGroup.add(lanternGlass);

  const matBeacon = new THREE.MeshBasicMaterial({ color: 0xffefc0 });
  const beaconCore = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), matBeacon);
  beaconCore.position.y = 5.04;
  lhGroup.add(beaconCore);

  const beaconGlow = new THREE.PointLight(0xffcf70, 0.0, 9.0, 2.0);
  beaconGlow.position.set(4.2, 6.65, -11.2);
  beaconGlow.layers.enableAll();
  scene.add(beaconGlow);

  // Subtle cel-shaded rotating daytime flash beam cone (visible during rare sky-dimming flash!)
  const beamSweepPivot = new THREE.Group();
  beamSweepPivot.position.set(0, 5.04, 0);
  lhGroup.add(beamSweepPivot);
  const lhRayMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    uniforms: { uIntensity: { value: 0.0 } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        vViewNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      void main() {
        float radial = pow(abs(dot(normalize(vViewNormal), normalize(-vViewPos))), 2.6);
        float along = smoothstep(0.0, 0.42, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
        gl_FragColor = vec4(1.0, 0.87, 0.50, radial * along * uIntensity * 0.24);
      }
    `,
  });
  const coneGeo = new THREE.ConeGeometry(0.72, 5.5, 20, 1, true);
  coneGeo.translate(0, -2.75, 0);
  coneGeo.rotateX(Math.PI / 2);
  const lhRayA = new THREE.Mesh(coneGeo, lhRayMat);
  lhRayA.layers.set(1);
  beamSweepPivot.add(lhRayA);
  const lhRayB = lhRayA.clone();
  lhRayB.rotation.y = Math.PI;
  lhRayB.layers.set(1);
  beamSweepPivot.add(lhRayB);

  // Red dome cap & lightning finial
  const lhDome = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.58, 16), matLhRed);
  lhDome.position.y = 5.68;
  lhDome.castShadow = true;
  lhGroup.add(lhDome);

  const lhSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.45, 6), matDarkMetal);
  lhSpire.position.y = 6.12;
  lhGroup.add(lhSpire);

  // ---------------------------------------------------------
  // 7. Underwater Seabed + Diorama Side-Wall Skirt (below water)
  // ---------------------------------------------------------
  const gridN = 64;
  const size = BASE_HALF * 2;
  const bedGeo = new THREE.PlaneGeometry(size, size, gridN, gridN);
  bedGeo.rotateX(-Math.PI / 2);
  const posAttr = bedGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    posAttr.setY(i, getSeabedY(vx, vz));
  }
  bedGeo.computeVertexNormals();
  const seabedMesh = new THREE.Mesh(bedGeo, matSeabed);
  seabedMesh.receiveShadow = true;
  root.add(seabedMesh);

  // Build exposed cutaway earth-strata skirt walls along East (+19), South-East (Z=+19, X>3.5), North (Z=-19, X>-5.5)
  // connecting seabed height smoothly down to SLAB_BOTTOM + 1.35 so zero gap shows through water cutaway!
  function buildCutawaySkirt(samples, fixedAxis, fixedVal, flipNormal) {
    const positions = [];
    const indices = [];
    const baseTop = SLAB_BOTTOM + 1.32;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      let x, z;
      if (fixedAxis === 'x') {
        x = fixedVal;
        z = -BASE_HALF + t * (BASE_HALF * 2);
      } else {
        z = fixedVal;
        x = -BASE_HALF + t * (BASE_HALF * 2);
      }
      const sy = isLandXZ(x, z) ? baseTop : getSeabedY(x, z);
      positions.push(x, sy, z);
      positions.push(x, baseTop, z);
    }
    for (let i = 0; i < samples; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (flipNormal) {
        indices.push(a, c, b, b, c, d);
      } else {
        indices.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, matBedrock);
    m.receiveShadow = true;
    root.add(m);
  }
  buildCutawaySkirt(48, 'x', BASE_HALF, false);
  buildCutawaySkirt(48, 'z', BASE_HALF, true);
  buildCutawaySkirt(48, 'z', -BASE_HALF, false);

  // ---------------------------------------------------------
  // 8. Wall Barnacles, Oyster Shells, Seaweed, Mooring Rings & Rusty Ladders
  // ---------------------------------------------------------
  const barnacleGeo = new THREE.CylinderGeometry(0.025, 0.065, 0.055, 6);
  const oysterGeo = new THREE.DodecahedronGeometry(0.07, 0);
  const barnacleTransforms = [];
  const oysterTransforms = [];
  const dummy = new THREE.Object3D();

  // Helper to populate quay wall intertidal line
  function populateWallBio(x0, z0, x1, z1, nx, nz, count) {
    for (let i = 0; i < count; i++) {
      const u = (i + hash1(i * 19 + x0)) / count;
      const px = x0 + (x1 - x0) * u + nx * 0.02;
      const pz = z0 + (z1 - z0) * u + nz * 0.02;
      const py = -0.42 + hash1(i * 31 + z0 * 7) * 0.68;

      dummy.position.set(px, py, pz);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0, nz));
      const sc = 0.65 + hash1(i * 43) * 0.9;
      dummy.scale.set(sc, sc * 0.9, sc);
      dummy.updateMatrix();
      if (i % 3 === 0) {
        oysterTransforms.push(dummy.matrix.clone());
      } else {
        barnacleTransforms.push(dummy.matrix.clone());
      }
    }
  }

  // West quay inner wall (X = -5.0, Z = -9.6 .. 5.4, facing +X)
  populateWallBio(-5.0, -9.6, -5.0, 5.4, 1, 0, 130);
  // South quay inner wall (Z = 5.5, X = -4.9 .. 3.4, facing -Z)
  populateWallBio(-4.9, 5.5, 3.4, 5.5, 0, -1, 80);
  // East foreground wall (X = 3.5, Z = 5.6 .. 7.5 and 16.1 .. 18.8, facing +X)
  populateWallBio(3.5, 5.6, 3.5, 7.5, 1, 0, 22);
  populateWallBio(3.5, 16.1, 3.5, 18.8, 1, 0, 26);
  // Landing walls
  populateWallBio(5.4, 7.6, 5.4, 12.2, 1, 0, 42);
  // Breakwater south wall
  populateWallBio(-5.0, -9.8, 3.5, -9.8, 0, 1, 75);

  const barnacleInst = new THREE.InstancedMesh(barnacleGeo, matBarnacle, barnacleTransforms.length);
  barnacleTransforms.forEach((m, i) => barnacleInst.setMatrixAt(i, m));
  barnacleInst.instanceMatrix.needsUpdate = true;
  root.add(barnacleInst);

  const oysterInst = new THREE.InstancedMesh(oysterGeo, matOyster, oysterTransforms.length);
  oysterTransforms.forEach((m, i) => oysterInst.setMatrixAt(i, m));
  oysterInst.instanceMatrix.needsUpdate = true;
  root.add(oysterInst);

  // Swaying Seaweed ribbons along quay walls
  const seaweedBlades = [];
  const weedGeo = new THREE.PlaneGeometry(0.14, 1.05, 1, 5);
  weedGeo.translate(0, -0.525, 0);
  const weedAnchors = [
    [-4.92, -0.25, 4.2, 1, 0],
    [-4.92, -0.32, 2.0, 1, 0],
    [-4.92, -0.20, -1.0, 1, 0],
    [-4.92, -0.28, -3.5, 1, 0],
    [-4.92, -0.22, -6.2, 1, 0],
    [-4.92, -0.30, -8.5, 1, 0],
    [-2.5, -0.25, 5.42, 0, -1],
    [0.5, -0.22, 5.42, 0, -1],
    [2.6, -0.28, 5.42, 0, -1],
    [5.46, -0.26, 8.8, 1, 0],
    [5.46, -0.30, 11.2, 1, 0],
    [3.58, -0.25, 17.5, 1, 0],
    [-1.2, -0.25, -9.72, 0, 1],
    [2.2, -0.28, -9.72, 0, 1],
  ];
  weedAnchors.forEach(([wx, wy, wz, nx, nz], idx) => {
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(weedGeo, matSeaweed);
      m.position.set(wx + nx * 0.04, wy, wz + nz * 0.04 + (k - 0.5) * 0.24);
      m.scale.set(0.8 + k * 0.3, 0.75 + hash1(idx * 7 + k) * 0.55, 1);
      m.rotation.y = Math.atan2(nx, nz) + (k - 0.5) * 0.5;
      root.add(m);
      seaweedBlades.push({ mesh: m, baseRotY: m.rotation.y, phase: idx * 1.1 + k * 1.9 });
    }
  });

  // Iron Mooring Rings along quay walls
  const ringGeo = new THREE.TorusGeometry(0.11, 0.025, 6, 12);
  const plateGeo = new THREE.BoxGeometry(0.05, 0.16, 0.16);
  const ringSpots = [
    [-4.98, 0.58, 3.2, 1, 0],
    [-4.98, 0.58, -0.8, 1, 0],
    [-4.98, 0.58, -5.8, 1, 0],
    [-1.5, 0.58, 5.48, 0, -1],
    [1.8, 0.58, 5.48, 0, -1],
    [5.42, 0.28, 9.6, 1, 0],
  ];
  ringSpots.forEach(([rx, ry, rz, nx, nz]) => {
    const plate = new THREE.Mesh(plateGeo, matRust);
    plate.position.set(rx, ry, rz);
    if (nz !== 0) plate.rotation.y = Math.PI / 2;
    root.add(plate);

    const ring = new THREE.Mesh(ringGeo, matRust);
    ring.position.set(rx + nx * 0.07, ry - 0.08, rz + nz * 0.07);
    if (nz !== 0) ring.rotation.y = Math.PI / 2;
    ring.rotation.x = 0.25;
    root.add(ring);
  });

  // 2 Rusty Iron Harbor Ladders (descending down the quay wall into water!)
  function addQuayLadder(x, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    root.add(g);

    [-0.22, 0.22].forEach((sx) => {
      // Main vertical rail from Y=-1.85 up to Y=1.65
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 3.55, 6), matRust);
      rail.position.set(sx, -0.1, 0.10);
      rail.castShadow = true;
      g.add(rail);
      // Curved top grab handle over quay edge
      const topArc = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.026, 6, 10, Math.PI), matRust);
      topArc.position.set(sx, 1.68, -0.04);
      topArc.rotation.y = Math.PI / 2;
      g.add(topArc);
    });

    for (let y = -1.65; y <= 1.35; y += 0.30) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 6), matRust);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, y, 0.10);
      g.add(rung);
    }
  }
  addQuayLadder(-5.0, 1.5, Math.PI / 2);  // West quay inner wall
  addQuayLadder(5.4, 10.6, Math.PI / 2);  // Lower landing outer edge

  // ---------------------------------------------------------
  // 9. Underwater Props: Pebbles, Sunken Tires, Anchor + Chain, Seagrass
  // ---------------------------------------------------------
  // Scattered 3D gravel pebbles on seabed
  const pebbleGeo = new THREE.DodecahedronGeometry(0.16, 0);
  const pebbleTransforms = [];
  for (let i = 0; i < 85; i++) {
    const px = -4 + hash1(i * 11 + 3) * 22;
    const pz = -18 + hash1(i * 17 + 9) * 36;
    if (isLandXZ(px, pz)) continue;
    const py = getSeabedY(px, pz) + 0.04;
    dummy.position.set(px, py, pz);
    dummy.rotation.set(hash1(i) * 3, hash1(i + 1) * 3, hash1(i + 2) * 3);
    const sx = 0.6 + hash1(i * 23) * 1.4;
    dummy.scale.set(sx, sx * 0.55, sx * 0.9);
    dummy.updateMatrix();
    pebbleTransforms.push(dummy.matrix.clone());
  }
  const pebbleInst = new THREE.InstancedMesh(pebbleGeo, matCoping, pebbleTransforms.length);
  pebbleTransforms.forEach((m, i) => pebbleInst.setMatrixAt(i, m));
  pebbleInst.receiveShadow = true;
  root.add(pebbleInst);

  // Sunken Old Tires (clearly visible from above & through East/South-East cutaway walls)
  const sunkenTireGeo = new THREE.TorusGeometry(0.42, 0.16, 8, 16);
  const sunkenTires = [
    [8.2, 13.8, 1.35, 0.25],
    [13.4, 9.6, 1.48, -0.18],
    [1.8, -1.6, 1.42, 0.15],
    [14.2, -3.2, 1.25, -0.3],
    [6.6, 16.8, 1.50, 0.10],
  ];
  sunkenTires.forEach(([tx, tz, rx, rz]) => {
    const tire = new THREE.Mesh(sunkenTireGeo, matTire);
    tire.position.set(tx, getSeabedY(tx, tz) + 0.12, tz);
    tire.rotation.set(rx, hash1(tx * 7) * 3, rz);
    tire.castShadow = true;
    tire.receiveShadow = true;
    root.add(tire);
  });

  // Heavy Rusted Anchor & Interlocking Chain across seabed near South-East cutaway
  const anchorGroup = new THREE.Group();
  const ax = 10.6;
  const az = 6.8;
  anchorGroup.position.set(ax, getSeabedY(ax, az) + 0.20, az);
  anchorGroup.rotation.set(1.42, 0.6, -0.35);
  root.add(anchorGroup);

  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.078, 1.28, 8), matRust);
  anchorGroup.add(shank);
  const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.88, 6), matRust);
  stock.rotation.z = Math.PI / 2;
  stock.position.y = 0.48;
  anchorGroup.add(stock);
  const anchorShackle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.026, 6, 12), matRust);
  anchorShackle.position.y = 0.66;
  anchorGroup.add(anchorShackle);
  const flukeArc = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.062, 6, 12, Math.PI), matRust);
  flukeArc.position.y = -0.22;
  flukeArc.rotation.z = Math.PI;
  anchorGroup.add(flukeArc);
  [-0.44, 0.44].forEach((fx) => {
    const palm = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.20, 4), matRust);
    palm.position.set(fx, -0.18, 0);
    palm.rotation.z = fx < 0 ? 0.25 : -0.25;
    anchorGroup.add(palm);
  });

  // Interlocked chain links snaking cleanly from anchor shackle across seabed toward East cutaway
  const linkGeo = new THREE.TorusGeometry(0.085, 0.025, 5, 12);
  linkGeo.scale(1.25, 0.85, 1.0);
  const chainPts = [];
  for (let s = 0; s <= 12; s++) {
    const u = s / 12;
    const cx = 10.25 + u * 5.6;
    const cz = 6.25 + Math.sin(u * 3.4) * 1.1 + u * 2.1;
    chainPts.push(new THREE.Vector3(cx, getSeabedY(cx, cz) + 0.075, cz));
  }
  const chainCurve = new THREE.CatmullRomCurve3(chainPts);
  const linkCount = 42;
  for (let i = 0; i < linkCount; i++) {
    const u = i / (linkCount - 1);
    const p = chainCurve.getPoint(u);
    const tan = chainCurve.getTangent(u);
    const link = new THREE.Mesh(linkGeo, matRust);
    link.position.copy(p);
    link.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI / 2;
    link.rotation.x = i % 2 === 0 ? Math.PI / 2 - 0.18 : 0.18;
    root.add(link);
  }

  // Underwater Seagrass Clumps (swaying gently in water current)
  const seagrassBlades = [];
  const sgGeo = new THREE.PlaneGeometry(0.11, 0.72, 1, 4);
  sgGeo.translate(0, 0.36, 0);
  const sgClusters = [
    [7.5, 11.2],
    [11.8, 14.2],
    [15.6, 11.6],
    [14.8, 4.2],
    [10.2, 1.8],
    [13.6, -6.5],
    [7.2, -5.8],
    [16.2, -13.5],
    [1.6, 1.4],
    [17.0, 15.0],
  ];
  sgClusters.forEach(([gx, gz], cIdx) => {
    const gy = getSeabedY(gx, gz);
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2 + hash1(cIdx + b);
      const blade = new THREE.Mesh(sgGeo, matSeagrass);
      blade.position.set(gx + Math.cos(a) * 0.22, gy - 0.03, gz + Math.sin(a) * 0.22);
      blade.rotation.y = a;
      blade.scale.set(0.85, 0.7 + hash1(cIdx * 5 + b) * 0.65, 1);
      root.add(blade);
      seagrassBlades.push({
        mesh: blade,
        baseRotY: a,
        phase: cIdx * 0.9 + b * 0.7,
      });
    }
  });

  // ---------------------------------------------------------
  // 10. Concrete Tetrapods (消波块 / テトラポッド)
  // ---------------------------------------------------------
  const { dirs, legGeo, hubGeo } = createTetrapodGeometry(0.92);
  const upVec = new THREE.Vector3(0, 1, 0);
  function addTetrapod(x, y, z, rx, ry, rz, scale = 1.0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.set(rx, ry, rz);
    g.scale.setScalar(scale);
    root.add(g);

    const hub = new THREE.Mesh(hubGeo, matTetrapod);
    hub.castShadow = true;
    hub.receiveShadow = true;
    g.add(hub);

    dirs.forEach((d) => {
      const leg = new THREE.Mesh(legGeo, matTetrapod);
      leg.quaternion.setFromUnitVectors(upVec, d.clone().normalize());
      leg.castShadow = true;
      leg.receiveShadow = true;
      g.add(leg);
    });
  }

  // Cluster A: South-East foreground corner beside slipway & quay wall
  const sePods = [
    [4.6, -0.05, 17.5, 0.2, 0.5, 0.1, 0.98],
    [5.8, -0.15, 17.9, -0.3, 1.8, 0.4, 1.02],
    [6.6, -0.22, 16.9, 0.5, 2.4, -0.2, 0.94],
    [4.4, 0.48, 18.2, 1.1, 0.9, 0.3, 0.95],
    [5.4, 0.52, 17.1, 0.7, 2.1, -0.4, 0.90],
    [6.4, -0.25, 18.2, -0.4, 0.2, 0.6, 0.92],
    [7.4, -0.35, 17.6, 0.3, 1.2, -0.5, 0.88],
  ];
  sePods.forEach((p) => addTetrapod(...p));

  // Submerged stone riprap foundation berm under Breakwater pierhead tetrapods (grounds Cluster B on seabed in Shot 10!)
  const riprapMat = createAnimeToonMaterial({ color: 0x6f8791, map: masonryTex, wetness: 0.65 });
  const bwBermUpper = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 3.65, 2.35, 14), riprapMat);
  bwBermUpper.position.set(4.85, -1.55, -11.75);
  bwBermUpper.receiveShadow = true;
  root.add(bwBermUpper);
  const bwBermBase = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 4.35, 1.35, 14), riprapMat);
  bwBermBase.position.set(4.95, -2.55, -11.85);
  bwBermBase.receiveShadow = true;
  root.add(bwBermBase);

  // Cluster B: Around Short Breakwater pierhead & Lighthouse resting on stone berm
  const bwPods = [
    [5.7, -0.08, -12.6, 0.2, 0.7, 0.1, 0.96],
    [6.4, -0.15, -11.4, -0.4, 1.5, 0.3, 1.0],
    [6.0, -0.12, -10.2, 0.6, 2.2, -0.2, 0.94],
    [4.6, -0.10, -13.3, 0.3, 1.1, 0.4, 0.95],
    [3.3, -0.05, -13.4, -0.2, 2.6, -0.1, 0.98],
    [5.5, 0.54, -11.8, 0.8, 0.4, 0.5, 0.88],
    [4.8, 0.48, -12.9, -0.6, 1.9, -0.3, 0.86],
    [7.0, -0.28, -12.1, 0.4, 2.8, 0.2, 0.90],
  ];
  bwPods.forEach((p) => addTetrapod(...p));

  // ---------------------------------------------------------
  // 11. Distant Misty Outer Sea, Long Outer Breakwater & Passing Boats (Layer 2)
  // ---------------------------------------------------------
  const distantGroup = new THREE.Group();
  scene.add(distantGroup);

  // Soft outer ocean ring (inner radius 52m -> outer radius 155m) fading smoothly to 0 at edges
  // so it NEVER covers or collides with the 38x38 diorama side walls!
  const outerSeaMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColorNear: { value: new THREE.Color(0x9bd2da) },
      uColorFar: { value: new THREE.Color(0xdbeff3) },
    },
    vertexShader: `
      varying vec3 vWPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uColorNear;
      uniform vec3 uColorFar;
      varying vec3 vWPos;
      void main() {
        float r = length(vWPos.xz);
        float innerFade = smoothstep(50.0, 64.0, r);
        float outerFade = 1.0 - smoothstep(115.0, 155.0, r);
        // Emphasize background North/East coastal horizon
        float backBias = smoothstep(25.0, -35.0, vWPos.z) * 0.7 + 0.3;
        float a = innerFade * outerFade * backBias * 0.55;
        vec3 col = mix(uColorNear, uColorFar, smoothstep(55.0, 130.0, r));
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const outerSeaGeo = new THREE.RingGeometry(48, 158, 72);
  outerSeaGeo.rotateX(-Math.PI / 2);
  const outerSea = new THREE.Mesh(outerSeaGeo, outerSeaMat);
  outerSea.position.y = -0.35;
  outerSea.layers.set(2);
  distantGroup.add(outerSea);

  // Long misty outer breakwater far in the distance (Z = -68) grounded on outerSea with soft fade
  const matFarMist = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0x9fc2cd) },
    },
    vertexShader: `
      varying vec3 vWPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec3 vWPos;
      void main() {
        float edgeFade = smoothstep(-48.0, -28.0, vWPos.x) * (1.0 - smoothstep(42.0, 62.0, vWPos.x));
        float hFade = smoothstep(-0.35, 0.25, vWPos.y);
        gl_FragColor = vec4(uColor, 0.48 * edgeFade * hFade);
      }
    `,
  });
  const farBw = new THREE.Mesh(new THREE.BoxGeometry(108, 1.65, 3.0), matFarMist);
  farBw.position.set(6, 0.25, -68);
  farBw.layers.set(2);
  distantGroup.add(farBw);

  const farLighthouse = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.56, 2.0, 10), matFarMist);
  farLighthouse.position.set(28, 1.85, -68);
  farLighthouse.layers.set(2);
  distantGroup.add(farLighthouse);
  const farLhCap = new THREE.Mesh(
    new THREE.ConeGeometry(0.44, 0.52, 10),
    new THREE.MeshBasicMaterial({ color: 0xcca4a0, transparent: true, opacity: 0.48 })
  );
  farLhCap.position.set(28, 3.08, -68);
  farLhCap.layers.set(2);
  distantGroup.add(farLhCap);

  // 2 Distant Trawlers gliding smoothly outside the far breakwater
  const distantBoats = [];
  for (let i = 0; i < 2; i++) {
    const bGroup = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.75, 1.15),
      new THREE.MeshBasicMaterial({ color: 0xe3eff2, transparent: true, opacity: 0.7 })
    );
    hull.layers.set(2);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.85, 0.9),
      new THREE.MeshBasicMaterial({ color: 0x9ec0cc, transparent: true, opacity: 0.7 })
    );
    cabin.position.set(-0.3, 0.7, 0);
    cabin.layers.set(2);
    const wake = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 0.55),
      new THREE.MeshBasicMaterial({
        color: 0xf4fbfc,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      })
    );
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(-3.4, -0.25, 0);
    wake.layers.set(2);

    bGroup.add(hull, cabin, wake);
    bGroup.position.set(i === 0 ? -25 : 42, 0.1, i === 0 ? -77 : -84);
    bGroup.rotation.y = i === 0 ? 0 : Math.PI;
    distantGroup.add(bGroup);
    distantBoats.push({ group: bGroup, dir: i === 0 ? 1 : -1, baseX: i === 0 ? -36 : 48, z: i === 0 ? -77 : -84, speed: i === 0 ? 1.4 : 1.05 });
  }

  return {
    root,
    lighthouseBeacon: {
      material: matBeacon,
      light: beaconGlow,
    },
    update(t, sunIntensity) {
      // Sway wall seaweed gently
      seaweedBlades.forEach((s) => {
        s.mesh.rotation.z = Math.sin(t * 1.45 + s.phase) * 0.22;
        s.mesh.rotation.x = Math.cos(t * 1.1 + s.phase) * 0.14;
      });
      // Sway seabed seagrass gently
      seagrassBlades.forEach((s) => {
        s.mesh.rotation.z = Math.sin(t * 1.3 + s.phase) * 0.18;
        s.mesh.rotation.x = Math.cos(t * 1.05 + s.phase) * 0.12;
      });

      // Lighthouse daytime flash during rare cloud dimming
      const dimTrigger = Math.max(0, 1.0 - sunIntensity) / 0.24; // 0..1 when sky dips
      const flashCurve = dimTrigger > 0.2 ? Math.pow(Math.sin(((t * 1.8) % Math.PI)), 2) * dimTrigger : 0.08;
      beaconGlow.intensity = flashCurve * 5.2;
      const lum = 0.65 + flashCurve * 0.35;
      matBeacon.color.setRGB(1.0 * lum, 0.88 * lum, 0.55 * lum);
      lhRayMat.uniforms.uIntensity.value = dimTrigger > 0.2 ? flashCurve : 0.0;
      beamSweepPivot.rotation.y = t * 1.65;

      // Distant trawlers glide smoothly outside far breakwater
      distantBoats.forEach((db) => {
        const span = 104;
        const raw = ((t * db.speed) % span + span) % span;
        const x = db.dir > 0 ? -52 + raw : 52 - raw;
        db.group.position.x = x;
        db.group.position.y = 0.08 + Math.sin(t * 1.2 + db.z) * 0.06;
      });
    },
  };
}
