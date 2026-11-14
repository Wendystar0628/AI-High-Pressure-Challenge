import * as THREE from 'three';
import { QUAY_Y, ENV_UNIFORMS, hash1 } from './state.js';
import { createAnimeToonMaterial } from './toon.js';
import {
  createCorrugatedWallTexture,
  createRoofTileTexture,
  createAuctionBlackboardTexture,
  createTimetableTexture,
  createClockTexture,
  createQuayMasonryTexture,
  createScaleDialTexture,
} from './textures.js';

export function buildBuildings(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const corrugatedTex = createCorrugatedWallTexture('#dce7ea');
  const tileTex = createRoofTileTexture();
  const blackboardTex = createAuctionBlackboardTexture();
  const timetableTex = createTimetableTexture();
  const clockTex = createClockTexture();
  const stoneWallTex = createQuayMasonryTexture();

  const matWarehouseWall = createAnimeToonMaterial({
    color: 0xe3ecef,
    map: corrugatedTex,
    wetness: 0.28,
    rimStrength: 0.14,
  });

  const matWarehouseCeiling = createAnimeToonMaterial({
    color: 0xc5d4d9,
    wetness: 0.1,
    causticsStrength: 0.85,
    causticsScale: 0.65,
    side: THREE.DoubleSide,
  });

  const matShutter = createAnimeToonMaterial({
    color: 0xb6cad0,
    map: createCorrugatedWallTexture('#b9cdd3'),
    wetness: 0.35,
  });

  const matRoofMetal = createAnimeToonMaterial({
    color: 0x5c8497,
    wetness: 0.45,
    rimStrength: 0.2,
    side: THREE.DoubleSide,
  });

  const matRoofTile = createAnimeToonMaterial({
    color: 0x4b6e87,
    map: tileTex,
    wetness: 0.45,
    rimStrength: 0.2,
  });

  const matPlaster = createAnimeToonMaterial({
    color: 0xf4f2e8,
    wetness: 0.2,
  });

  const matWood = createAnimeToonMaterial({
    color: 0xb88454,
    wetness: 0.15,
  });

  const matDarkWood = createAnimeToonMaterial({
    color: 0x735036,
    wetness: 0.12,
  });

  const matFrameTeal = createAnimeToonMaterial({
    color: 0xd0e2e6,
    wetness: 0.3,
  });

  const matCrateWhite = createAnimeToonMaterial({ color: 0xf3f7f8, wetness: 0.55 });
  const matCrateBlue = createAnimeToonMaterial({ color: 0x4392ba, wetness: 0.55 });
  const matYellowBoot = createAnimeToonMaterial({ color: 0xefb936, wetness: 0.4 });
  const matNavyBoot = createAnimeToonMaterial({ color: 0x2e4a62, wetness: 0.4 });
  const matSteel = createAnimeToonMaterial({ color: 0xcbd6d9, wetness: 0.42 });
  const matDarkIron = createAnimeToonMaterial({ color: 0x384b54, wetness: 0.25 });

  const matGlass = new THREE.MeshPhysicalMaterial({
    color: 0xdff5f9,
    transparent: true,
    opacity: 0.22,
    roughness: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // ---------------------------------------------------------
  // 1. FISHERY CO-OP WAREHOUSE (渔协仓库): X in [-17.5, -10.5], Z in [-7.5, +0.5]
  // ---------------------------------------------------------
  const wh = new THREE.Group();
  root.add(wh);

  const whMinX = -17.5;
  const whMaxX = -10.5;
  const whMinZ = -7.5;
  const whMaxZ = 0.5;
  const whW = whMaxX - whMinX; // 7.0
  const whD = whMaxZ - whMinZ; // 8.0
  const whMidX = (whMinX + whMaxX) * 0.5; // -14.0
  const whMidZ = (whMinZ + whMaxZ) * 0.5; // -3.5
  const wallH = 4.2;

  function addBox(w, h, d, x, y, z, mat, parent = wh) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // Interior floor slab (slightly darker wet concrete)
  addBox(whW - 0.1, 0.04, whD - 0.1, whMidX, QUAY_Y + 0.02, whMidZ, createAnimeToonMaterial({ color: 0xc2cfd2, wetness: 0.65 }));

  // Back wall (West, X = -17.5) with high clerestory window cutout (Y = 4.55 .. 5.25)
  addBox(0.24, 3.15, whD, whMinX + 0.12, QUAY_Y + 1.575, whMidZ, matWarehouseWall);
  addBox(0.24, 0.35, whD, whMinX + 0.12, QUAY_Y + wallH - 0.175, whMidZ, matWarehouseWall);
  // Window mullions on West high clerestory
  for (let z = -7.3; z <= 0.4; z += 1.9) {
    addBox(0.24, 0.72, 0.16, whMinX + 0.12, QUAY_Y + 3.5, z, matFrameTeal);
  }
  const whWestClerestoryGlass = new THREE.Mesh(new THREE.PlaneGeometry(whD - 0.3, 0.7), matGlass);
  whWestClerestoryGlass.rotation.y = Math.PI / 2;
  whWestClerestoryGlass.position.set(whMinX + 0.12, QUAY_Y + 3.5, whMidZ);
  whWestClerestoryGlass.layers.set(1);
  wh.add(whWestClerestoryGlass);

  // North side wall (Z = -7.5) solid
  addBox(whW, wallH, 0.24, whMidX, QUAY_Y + wallH * 0.5, whMinZ + 0.12, matWarehouseWall);

  // South side wall (Z = +0.5) with high clerestory windows for golden sunbeams!
  addBox(whW, 3.15, 0.24, whMidX, QUAY_Y + 1.575, whMaxZ - 0.12, matWarehouseWall);
  addBox(whW, 0.35, 0.24, whMidX, QUAY_Y + wallH - 0.175, whMaxZ - 0.12, matWarehouseWall);
  for (let x = -17.3; x <= -10.6; x += 1.7) {
    addBox(0.16, 0.72, 0.24, x, QUAY_Y + 3.5, whMaxZ - 0.12, matFrameTeal);
  }
  const whSouthClerestoryGlass = new THREE.Mesh(new THREE.PlaneGeometry(whW - 0.3, 0.7), matGlass);
  whSouthClerestoryGlass.position.set(whMidX, QUAY_Y + 3.5, whMaxZ - 0.12);
  whSouthClerestoryGlass.layers.set(1);
  wh.add(whSouthClerestoryGlass);

  // Front wall (East, X = -10.5) framing wide 4.4m roller shutter bay Z in [-5.7, -1.3]
  addBox(0.24, wallH, 1.8, whMaxX - 0.12, QUAY_Y + wallH * 0.5, -6.6, matWarehouseWall);
  addBox(0.24, wallH, 1.8, whMaxX - 0.12, QUAY_Y + wallH * 0.5, -0.4, matWarehouseWall);
  addBox(0.24, 0.9, 4.4, whMaxX - 0.12, QUAY_Y + wallH - 0.45, whMidZ, matWarehouseWall);

  // Half-raised corrugated roller shutter (leaves bottom Y = 1.4 .. 3.55 completely open!)
  addBox(0.14, 1.35, 4.35, whMaxX - 0.14, QUAY_Y + 2.82, whMidZ, matShutter);
  // Shutter bottom handle bar, side guide tracks & housing drum box
  addBox(0.20, 0.08, 4.38, whMaxX - 0.14, QUAY_Y + 2.13, whMidZ, matDarkIron);
  [-5.68, -1.32].forEach((gz) => addBox(0.10, 3.3, 0.08, whMaxX - 0.12, QUAY_Y + 1.65, gz, matDarkIron));
  addBox(0.38, 0.42, 4.55, whMaxX - 0.02, QUAY_Y + 3.72, whMidZ, matFrameTeal);

  // Small blue metal sign above warehouse shutter ("漁協荷捌所")
  const whHeader = addBox(0.12, 0.46, 2.8, whMaxX + 0.02, QUAY_Y + 4.02, whMidZ, createAnimeToonMaterial({ color: 0x37728c }));
  whHeader.castShadow = false;

  // Pitched warehouse roof (two sloped eaves + interior ceiling with water caustics!)
  const roofPitch = 0.25;
  [-1, 1].forEach((sideSign) => {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.14, whD + 0.8), matRoofMetal);
    slope.position.set(whMidX + sideSign * 1.92, QUAY_Y + wallH + 0.48, whMidZ);
    slope.rotation.z = -sideSign * roofPitch;
    slope.castShadow = true;
    slope.receiveShadow = true;
    wh.add(slope);

    // Underside ceiling liner strictly tucked flush beneath roof slope (zero overhang!)
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.04, whD - 0.32), matWarehouseCeiling);
    ceil.position.set(whMidX + sideSign * 1.65, QUAY_Y + wallH + 0.38, whMidZ);
    ceil.rotation.z = -sideSign * roofPitch;
    wh.add(ceil);
  });
  // Triangular Gable Wall Fills (North & South), roof ridge cap, and timber rafters
  const whGableShape = new THREE.Shape();
  whGableShape.moveTo(-whW * 0.5, 0.0);
  whGableShape.lineTo(0, 0.94);
  whGableShape.lineTo(whW * 0.5, 0.0);
  whGableShape.closePath();
  const whGableGeo = new THREE.ExtrudeGeometry(whGableShape, { depth: 0.24, bevelEnabled: false });
  whGableGeo.translate(0, 0, -0.12);
  [whMinZ + 0.12, whMaxZ - 0.12].forEach((gz) => {
    const gableMesh = new THREE.Mesh(whGableGeo, matWarehouseWall);
    gableMesh.position.set(whMidX, QUAY_Y + wallH - 0.01, gz);
    gableMesh.castShadow = true;
    gableMesh.receiveShadow = true;
    wh.add(gableMesh);
  });
  addBox(0.24, 0.08, whD + 0.82, whMidX, QUAY_Y + wallH + 1.03, whMidZ, matFrameTeal);
  addBox(0.16, 0.16, whD - 0.18, whMidX, QUAY_Y + wallH + 0.83, whMidZ, matDarkWood);
  for (let rz = -6.5; rz <= -0.5; rz += 1.5) {
    addBox(6.6, 0.14, 0.16, whMidX, QUAY_Y + wallH - 0.08, rz, matDarkWood);
  }

  // --- Warehouse Interior Furnishings ---
  // 1) Auction Price Blackboard on inner back wall + chalk ledge & eraser
  const boardFrame = addBox(0.08, 1.38, 2.24, whMinX + 0.28, QUAY_Y + 2.25, -3.5, matDarkWood);
  addBox(0.14, 0.05, 2.20, whMinX + 0.34, QUAY_Y + 1.56, -3.5, matDarkWood);
  addBox(0.06, 0.04, 0.14, whMinX + 0.37, QUAY_Y + 1.60, -3.15, matDarkIron); // chalk eraser
  const boardFace = new THREE.Mesh(
    new THREE.PlaneGeometry(2.12, 1.26),
    createAnimeToonMaterial({ color: 0xffffff, map: blackboardTex, wetness: 0.08 })
  );
  boardFace.rotation.y = Math.PI / 2;
  boardFace.position.set(whMinX + 0.33, QUAY_Y + 2.25, -3.5);
  wh.add(boardFace);
  void boardFrame;

  // 2) Stacked Fish Crates inside warehouse (white & blue stacks with molded rims & handle cutouts)
  function addCrateStack(x, z, layers, colors) {
    for (let i = 0; i < layers; i++) {
      const m = colors[i % colors.length];
      const cg = new THREE.Group();
      cg.position.set(x + (i % 2) * 0.02, QUAY_Y + 0.16 + i * 0.33, z);
      cg.rotation.y = (hash1(x * 11 + i) - 0.5) * 0.16;

      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.28, 0.46), m);
      crate.castShadow = true;
      crate.receiveShadow = true;
      cg.add(crate);

      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.045, 0.50), m);
      rim.position.y = 0.138;
      rim.castShadow = true;
      cg.add(rim);

      [-0.335, 0.335].forEach((hx) => {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.055, 0.15), matDarkIron);
        slot.position.set(hx, 0.04, 0);
        cg.add(slot);
      });
      wh.add(cg);
    }
  }
  addCrateStack(-15.6, -5.6, 4, [matCrateBlue, matCrateWhite]);
  addCrateStack(-14.7, -5.5, 3, [matCrateWhite, matCrateBlue]);
  addCrateStack(-15.5, -4.8, 3, [matCrateWhite]);
  addCrateStack(-12.6, -5.6, 2, [matCrateBlue, matCrateWhite]);
  addCrateStack(-13.3, -1.25, 2, [matCrateWhite, matCrateBlue]);

  // 3) Commercial Ice Chest / Freezer (with metal handles, latch & frost basket)
  addBox(1.85, 0.88, 0.92, -15.3, QUAY_Y + 0.46, -2.15, matCrateWhite);
  addBox(1.90, 0.10, 0.96, -15.3, QUAY_Y + 0.94, -2.15, matSteel);
  addBox(0.08, 0.10, 0.28, -14.35, QUAY_Y + 0.91, -2.15, matDarkIron); // front freezer latch
  addBox(0.42, 0.18, 0.30, -15.45, QUAY_Y + 1.08, -2.15, matCrateBlue);  // ice scoop crate atop freezer

  // 4) Platform Weighing Scale with graduated kg dial gauge
  addBox(0.75, 0.14, 0.75, -13.1, QUAY_Y + 0.09, -3.5, matDarkIron); // base platform
  addBox(0.10, 1.05, 0.10, -13.42, QUAY_Y + 0.62, -3.5, matSteel);  // upright post
  const scaleDial = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.09, 20), matSteel);
  scaleDial.rotation.z = Math.PI / 2;
  scaleDial.position.set(-13.38, QUAY_Y + 1.18, -3.5);
  wh.add(scaleDial);
  const dialFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.20, 20),
    createAnimeToonMaterial({ color: 0xffffff, map: createScaleDialTexture() })
  );
  dialFace.rotation.y = Math.PI / 2;
  dialFace.position.set(-13.332, QUAY_Y + 1.18, -3.5);
  wh.add(dialFace);
  addBox(0.54, 0.24, 0.42, -13.0, QUAY_Y + 0.28, -3.5, matCrateBlue); // crate on scale

  // 5) Sculpted Hanging Rubber Rain Boots on North/Back inner wall pegs (cuff, rounded toe & sole)
  addBox(0.10, 0.12, 1.8, whMinX + 0.26, QUAY_Y + 2.0, -5.8, matWood);
  [
    [-5.3, matYellowBoot],
    [-5.6, matYellowBoot],
    [-6.1, matNavyBoot],
    [-6.4, matNavyBoot],
  ].forEach(([bz, mat], idx) => {
    const bootShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.072, 0.36, 10), mat);
    bootShaft.position.set(whMinX + 0.36, QUAY_Y + 1.78, bz);
    bootShaft.rotation.z = 0.06 * (idx % 2 === 0 ? 1 : -1);
    wh.add(bootShaft);
    const bootCuff = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.014, 6, 12), mat);
    bootCuff.rotation.x = Math.PI / 2;
    bootCuff.position.set(whMinX + 0.36, QUAY_Y + 1.96, bz);
    wh.add(bootCuff);
    const bootFoot = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.11, 5, 8), mat);
    bootFoot.rotation.z = Math.PI / 2;
    bootFoot.position.set(whMinX + 0.43, QUAY_Y + 1.60, bz);
    wh.add(bootFoot);
    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.024, 0.11), matDarkIron);
    bootSole.position.set(whMinX + 0.43, QUAY_Y + 1.545, bz);
    wh.add(bootSole);
  });

  // 6) Warehouse Floor Reflective Water Puddles & Scattered Crystalline Ice Chunks
  const floorPuddleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: ENV_UNIFORMS.uTime,
      uSunIntensity: ENV_UNIFORMS.uSunIntensity,
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uSunIntensity;
      varying vec2 vUv;
      void main() {
        float ang = atan(vUv.y, vUv.x);
        float rad = length(vUv) + 0.12 * sin(ang * 3.0 + 0.7) + 0.06 * cos(ang * 5.0);
        if (rad > 0.94) discard;
        // High-key glossy sky/clerestory window reflection + bright specular streak
        float reflBand = smoothstep(-0.35, 0.35, vUv.x * 0.7 + vUv.y * 0.5 + 0.08 * sin(uTime * 1.1 + vUv.y * 4.0));
        vec3 deepWet = vec3(0.32, 0.56, 0.64);
        vec3 skySheen = vec3(0.86, 0.96, 0.98);
        vec3 warmHighlight = vec3(1.0, 0.96, 0.80);
        vec3 col = mix(deepWet, skySheen, reflBand * 0.85);
        float glint = smoothstep(0.68, 0.88, 1.0 - abs(vUv.x - 0.15 + vUv.y * 0.35)) * uSunIntensity;
        col = mix(col, warmHighlight, glint * 0.55);
        float rim = smoothstep(0.94, 0.78, rad);
        gl_FragColor = vec4(col, rim * 0.64);
      }
    `,
  });
  [
    [-12.2, -3.4, 2.5, 1.8],
    [-14.2, -2.3, 1.9, 1.4],
  ].forEach(([px, pz, sx, sz]) => {
    const pd = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), floorPuddleMat);
    pd.rotation.x = -Math.PI / 2;
    pd.position.set(px, QUAY_Y + 0.045, pz);
    pd.layers.set(1);
    wh.add(pd);
  });

  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6fbff,
    emissive: 0x8adcf0,
    emissiveIntensity: 0.18,
    transparent: true,
    opacity: 0.84,
    roughness: 0.06,
  });
  const iceGeo = new THREE.OctahedronGeometry(0.068, 0);
  const iceSpots = [
    [-14.1, -2.2], [-13.8, -2.5], [-14.4, -2.6], [-13.6, -2.1],
    [-13.9, -2.9], [-13.3, -2.5], [-14.5, -2.1], [-12.7, -3.1],
    [-13.1, -2.9], [-12.9, -2.4],
  ];
  iceSpots.forEach(([ix, iz], i) => {
    const cube = new THREE.Mesh(iceGeo, iceMat);
    cube.position.set(ix, QUAY_Y + 0.075, iz);
    cube.scale.set(1.15, 0.72 + (i % 3) * 0.14, 0.95);
    cube.rotation.set(i * 0.4, i * 0.9, i * 0.2);
    cube.layers.set(1);
    wh.add(cube);
  });

  // ---------------------------------------------------------
  // 2. HARBOR WAITING ROOM (候船室): X in [-17.2, -11.8], Z in [+2.2, +8.4]
  // ---------------------------------------------------------
  const wr = new THREE.Group();
  root.add(wr);

  const wrMinX = -17.2;
  const wrMaxX = -11.8;
  const wrMinZ = 2.2;
  const wrMaxZ = 8.4;
  const wrW = wrMaxX - wrMinX; // 5.4
  const wrD = wrMaxZ - wrMinZ; // 6.2
  const wrMidX = (wrMinX + wrMaxX) * 0.5; // -14.5
  const wrMidZ = (wrMinZ + wrMaxZ) * 0.5; // 5.3
  const wrH = 3.15;

  // Interior warm tile/concrete floor
  addBox(wrW, 0.06, wrD, wrMidX, QUAY_Y + 0.03, wrMidZ, createAnimeToonMaterial({ color: 0xe7e3d4, wetness: 0.12 }), wr);

  // Back wall (West, X = -17.2) & North wall (Z = +2.2) in clean cream plaster
  addBox(0.22, wrH, wrD, wrMinX + 0.11, QUAY_Y + wrH * 0.5, wrMidZ, matPlaster, wr);
  addBox(wrW, wrH, 0.22, wrMidX, QUAY_Y + wrH * 0.5, wrMinZ + 0.11, matPlaster, wr);

  // Low knee-wall wainscot along window sides (0.35m high) + mullions + FLOOR-TO-CEILING GLASS!
  // East wall (X = -11.8) with open sliding entrance bay in center & floor-to-ceiling glass
  addBox(0.16, 0.28, 2.0, wrMaxX - 0.08, QUAY_Y + 0.14, 3.2, matPlaster, wr);
  addBox(0.16, 0.28, 1.8, wrMaxX - 0.08, QUAY_Y + 0.14, 7.5, matPlaster, wr);
  // Corner & window posts
  [2.3, 4.2, 6.5, 8.3].forEach((mz) => {
    addBox(0.14, wrH, 0.14, wrMaxX - 0.07, QUAY_Y + wrH * 0.5, mz, matFrameTeal, wr);
  });
  addBox(0.16, 0.26, wrD, wrMaxX - 0.08, QUAY_Y + wrH - 0.13, wrMidZ, matFrameTeal, wr);

  // Floor-to-ceiling glass panes on East side (leaving doorway Z in [4.3, 6.4] slid open!)
  const wrEastGlass1 = new THREE.Mesh(new THREE.PlaneGeometry(1.85, wrH - 0.55), matGlass);
  wrEastGlass1.rotation.y = Math.PI / 2;
  wrEastGlass1.position.set(wrMaxX - 0.08, QUAY_Y + 1.55, 3.25);
  wrEastGlass1.layers.set(1);
  wr.add(wrEastGlass1);

  const wrEastGlass2 = new THREE.Mesh(new THREE.PlaneGeometry(1.75, wrH - 0.55), matGlass);
  wrEastGlass2.rotation.y = Math.PI / 2;
  wrEastGlass2.position.set(wrMaxX - 0.08, QUAY_Y + 1.55, 7.4);
  wrEastGlass2.layers.set(1);
  wr.add(wrEastGlass2);

  // South wall (Z = +8.4) floor-to-ceiling glass window!
  addBox(wrW, 0.26, 0.16, wrMidX, QUAY_Y + 0.13, wrMaxZ - 0.08, matPlaster, wr);
  addBox(wrW, 0.26, 0.16, wrMidX, QUAY_Y + wrH - 0.13, wrMaxZ - 0.08, matFrameTeal, wr);
  [-17.1, -15.3, -13.5, -11.9].forEach((mx) => {
    addBox(0.14, wrH, 0.14, mx, QUAY_Y + wrH * 0.5, wrMaxZ - 0.08, matFrameTeal, wr);
  });
  const wrSouthGlass = new THREE.Mesh(new THREE.PlaneGeometry(wrW - 0.3, wrH - 0.52), matGlass);
  wrSouthGlass.position.set(wrMidX, QUAY_Y + 1.55, wrMaxZ - 0.08);
  wrSouthGlass.layers.set(1);
  wr.add(wrSouthGlass);

  // Waiting room flat coastal overhang roof + trim fascia
  addBox(wrW + 0.9, 0.22, wrD + 0.9, wrMidX + 0.2, QUAY_Y + wrH + 0.11, wrMidZ, matRoofMetal, wr);
  addBox(wrW + 0.96, 0.14, wrD + 0.96, wrMidX + 0.2, QUAY_Y + wrH + 0.24, wrMidZ, matFrameTeal, wr);

  // --- Waiting Room Interior Furnishings ---
  // 1) Two slatted wooden waiting benches with iron frames & armrests
  function addBench(bx, bz, rotY) {
    const bg = new THREE.Group();
    bg.position.set(bx, QUAY_Y + 0.06, bz);
    bg.rotation.y = rotY;
    wr.add(bg);
    [-0.14, 0.0, 0.14].forEach((sz) => addBox(1.85, 0.045, 0.12, 0, 0.42, sz, matWood, bg));
    [0.64, 0.78].forEach((by) => addBox(1.85, 0.11, 0.05, 0, by, -0.22, matWood, bg));
    [-0.75, 0.75].forEach((lx) => {
      addBox(0.06, 0.42, 0.46, lx, 0.21, 0, matDarkIron, bg);
      addBox(0.05, 0.44, 0.05, lx, 0.62, -0.22, matDarkIron, bg);
      addBox(0.06, 0.04, 0.44, lx, 0.54, -0.02, matDarkWood, bg); // wooden armrest
    });
  }
  addBench(-14.3, 4.1, 0);
  addBench(-14.3, 6.2, Math.PI);

  // 2) Faded Ferry Timetable on West inner wall
  const ttBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 1.25),
    createAnimeToonMaterial({ color: 0xffffff, map: timetableTex, wetness: 0.04 })
  );
  ttBoard.rotation.y = Math.PI / 2;
  ttBoard.position.set(wrMinX + 0.24, QUAY_Y + 1.65, 5.2);
  wr.add(ttBoard);

  // 3) Slightly Crooked Wall Clock on West inner wall (clear of window mullion!)
  const clockGroup = new THREE.Group();
  clockGroup.position.set(wrMinX + 0.25, QUAY_Y + 2.26, 3.88);
  clockGroup.rotation.y = Math.PI / 2;
  clockGroup.rotation.z = -0.15; // ~8.6 deg tilted crookedly!
  wr.add(clockGroup);

  const clockRim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20), matDarkWood);
  clockRim.rotation.x = Math.PI / 2;
  clockGroup.add(clockRim);
  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.25, 20),
    createAnimeToonMaterial({ color: 0xffffff, map: clockTex })
  );
  clockFace.position.z = 0.036;
  clockGroup.add(clockFace);

  // 4) Vintage Radio centered cleanly on wooden side table (knobs, speaker grille & lit dial!)
  addBox(0.84, 0.64, 0.72, -16.04, QUAY_Y + 0.38, 7.36, matDarkWood, wr);
  const radioGroup = new THREE.Group();
  radioGroup.position.set(-16.14, QUAY_Y + 0.83, 7.22);
  radioGroup.rotation.y = Math.PI * 0.42;
  wr.add(radioGroup);
  addBox(0.44, 0.27, 0.22, 0, 0, 0, createAnimeToonMaterial({ color: 0x8f5d3e }), radioGroup);
  addBox(0.19, 0.17, 0.03, -0.09, 0, 0.115, createAnimeToonMaterial({ color: 0xebd7ae }), radioGroup); // speaker grille
  addBox(0.15, 0.10, 0.03, 0.10, 0.04, 0.115, createAnimeToonMaterial({ color: 0xffe4a0, emissive: 0xffd27a, emissiveIntensity: 0.55 }), radioGroup); // lit dial
  [0.06, 0.14].forEach((kx) => {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 8), matDarkWood);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(kx, -0.07, 0.12);
    radioGroup.add(knob);
  });
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.44, 6), matSteel);
  antenna.position.set(0.15, 0.30, -0.06);
  antenna.rotation.z = -0.22;
  radioGroup.add(antenna);

  // 5) Enamel Pour-Spout Kettle (热水壶), Teacup & Trailing Golden Pothos Plant (绿萝)
  const kettleGroup = new THREE.Group();
  kettleGroup.position.set(-15.86, QUAY_Y + 0.70, 7.45);
  kettleGroup.rotation.y = 0.45;
  wr.add(kettleGroup);
  const matKettleEnamel = createAnimeToonMaterial({ color: 0xe36e53, wetness: 0.32 });
  const kettleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.115, 0.19, 12), matKettleEnamel);
  kettleBody.position.y = 0.095;
  kettleBody.castShadow = true;
  kettleGroup.add(kettleBody);
  const kettleLid = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.078, 0.03, 12), matSteel);
  kettleLid.position.y = 0.205;
  kettleGroup.add(kettleLid);
  const kettleKnob = new THREE.Mesh(new THREE.SphereGeometry(0.020, 8, 6), matDarkWood);
  kettleKnob.position.y = 0.232;
  kettleGroup.add(kettleKnob);
  const kettleSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.024, 0.13, 8), matKettleEnamel);
  kettleSpout.position.set(0.105, 0.145, 0);
  kettleSpout.rotation.z = -0.68;
  kettleGroup.add(kettleSpout);
  const kettleHandle = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.012, 5, 14, Math.PI), matDarkIron);
  kettleHandle.position.y = 0.195;
  kettleGroup.add(kettleHandle);

  const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.038, 0.08, 10), matPlaster);
  cupBody.position.set(-15.84, QUAY_Y + 0.74, 7.64);
  wr.add(cupBody);
  const cupHandle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 4, 8), matPlaster);
  cupHandle.position.set(-15.79, QUAY_Y + 0.74, 7.64);
  wr.add(cupHandle);

  // Potted Golden Pothos (绿萝): canopy above soil + trailing vines strictly outside pot rim (zero clipping!)
  const potMat = createAnimeToonMaterial({ color: 0xc97b59, wetness: 0.18 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.36, 12), potMat);
  pot.position.set(-15.45, QUAY_Y + 0.24, 7.52);
  pot.castShadow = true;
  wr.add(pot);

  const leafMat = createAnimeToonMaterial({ color: 0x62b462, wetness: 0.2, side: THREE.DoubleSide });
  const leafGeo = new THREE.CircleGeometry(0.105, 7);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const isTrail = i >= 12;
    const r = isTrail ? 0.30 + ((i - 12) % 2) * 0.035 : 0.07 + (i % 3) * 0.065;
    const ly = isTrail ? QUAY_Y + 0.40 - ((i - 12) % 3) * 0.075 : QUAY_Y + 0.48 + (i % 3) * 0.045;
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(-15.45 + Math.cos(a) * r, ly, 7.52 + Math.sin(a) * r);
    leaf.rotation.set(isTrail ? -1.05 : -0.45 + (i % 2) * 0.22, a, 0.18);
    wr.add(leaf);
  }

  // ---------------------------------------------------------
  // 3. GREEN HILLSIDE, RETAINING WALL, TILED-ROOF HOUSES & TREES (NW Corner)
  // ---------------------------------------------------------
  const hillGroup = new THREE.Group();
  root.add(hillGroup);

  const matStoneWall = createAnimeToonMaterial({
    color: 0xb7c4c7,
    map: stoneWallTex,
    wetness: 0.24,
  });
  const matGrass = createAnimeToonMaterial({
    color: 0x7cb875,
    wetness: 0.2,
    rimStrength: 0.16,
  });

  // Stone retaining walls separating hillside from West Quay & Breakwater approach (with coping caps & corner pier)
  addBox(13.2, 2.0, 0.45, -12.4, QUAY_Y + 1.0, -8.5, matStoneWall, hillGroup);
  addBox(0.45, 2.0, 10.5, -5.8, QUAY_Y + 1.0, -13.75, matStoneWall, hillGroup);
  const matCoping = createAnimeToonMaterial({ color: 0xbfc7c9, wetness: 0.35 });
  addBox(13.35, 0.12, 0.54, -12.4, QUAY_Y + 2.04, -8.5, matCoping, hillGroup);
  addBox(0.54, 0.12, 10.65, -5.8, QUAY_Y + 2.04, -13.75, matCoping, hillGroup);
  addBox(0.62, 2.18, 0.62, -5.8, QUAY_Y + 1.09, -8.5, matCoping, hillGroup);

  // Sculpted layered green hillside mesh inside X in [-18.9, -5.9], Z in [-18.9, -8.6]
  const hillGeo = new THREE.PlaneGeometry(13.0, 10.3, 28, 24);
  hillGeo.rotateX(-Math.PI / 2);
  const hPos = hillGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    const lx = hPos.getX(i); // -6.5 .. +6.5
    const lz = hPos.getZ(i); // -5.15 .. +5.15
    const u = Math.max(0, (6.5 - lx) / 13.0);
    const v = Math.max(0, (5.15 - lz) / 10.3);
    const rise = Math.pow(Math.max(0, u * 0.65 + v * 0.55), 1.15) * 4.2 + 0.65 * Math.sin(u * 3.1) * Math.cos(v * 2.8);
    const edgeDrop =
      (lx > 5.8 ? (6.5 - lx) / 0.7 : 1) *
      (lz > 4.4 ? (5.15 - lz) / 0.75 : 1);
    hPos.setY(i, QUAY_Y + 1.85 + Math.max(0, rise * edgeDrop));
  }
  hillGeo.computeVertexNormals();
  const hillMesh = new THREE.Mesh(hillGeo, matGrass);
  hillMesh.position.set(-12.4, 0, -13.75);
  hillMesh.castShadow = true;
  hillMesh.receiveShadow = true;
  hillGroup.add(hillMesh);

  // Vertical cutaway skirts on outer West (X=-19) & North (Z=-19) edges under the hill
  addBox(0.28, 4.6, 10.4, -18.86, QUAY_Y + 2.3, -13.8, matStoneWall, hillGroup);
  addBox(13.2, 4.6, 0.28, -12.4, QUAY_Y + 2.3, -18.86, matStoneWall, hillGroup);

  // 3 Japanese Tiled-Roof Coastal Houses on the hillside (sealed gables + window mullions + porch eaves)
  const houseGableShape = new THREE.Shape();
  houseGableShape.moveTo(-1.0, 0.0);
  houseGableShape.lineTo(0, 0.56);
  houseGableShape.lineTo(1.0, 0.0);
  houseGableShape.closePath();
  const houseGableGeo = new THREE.ExtrudeGeometry(houseGableShape, { depth: 0.14, bevelEnabled: false });
  houseGableGeo.rotateY(Math.PI / 2);
  houseGableGeo.translate(-0.07, 0, 0);

  function addCoastalHouse(x, y, z, scale = 1.0, rotY = 0) {
    const hg = new THREE.Group();
    hg.position.set(x, y, z);
    hg.rotation.y = rotY;
    hg.scale.setScalar(scale);
    hillGroup.add(hg);

    // Stone foundation + white plaster walls + sealed triangular gable ends
    addBox(2.8, 0.6, 2.2, 0, 0.3, 0, matStoneWall, hg);
    addBox(2.6, 1.65, 2.0, 0, 1.35, 0, matPlaster, hg);
    [-1.23, 1.23].forEach((gx) => {
      const gable = new THREE.Mesh(houseGableGeo, matPlaster);
      gable.position.set(gx, 2.16, 0);
      gable.castShadow = true;
      gable.receiveShadow = true;
      hg.add(gable);
    });

    // Warm sunlit windows with wood frames + cross mullions & wooden sliding door + doorstep
    const winMat = createAnimeToonMaterial({ color: 0xfff0c2, emissive: 0xffd98a, emissiveIntensity: 0.34 });
    addBox(0.84, 0.74, 0.07, -0.55, 1.4, 0.99, matDarkWood, hg);
    addBox(0.74, 0.64, 0.08, -0.55, 1.4, 1.01, winMat, hg);
    addBox(0.04, 0.64, 0.09, -0.55, 1.4, 1.02, matDarkWood, hg);
    addBox(0.74, 0.04, 0.09, -0.55, 1.4, 1.02, matDarkWood, hg);

    // Side sunlit window on +X wall
    addBox(0.07, 0.68, 0.72, 1.29, 1.42, 0.0, matDarkWood, hg);
    addBox(0.08, 0.58, 0.62, 1.31, 1.42, 0.0, winMat, hg);
    addBox(0.09, 0.58, 0.04, 1.32, 1.42, 0.0, matDarkWood, hg);

    // Wooden sliding entrance door, small rain awning & stone step
    addBox(0.72, 1.20, 0.08, 0.58, 1.16, 1.00, matDarkWood, hg);
    addBox(0.58, 1.12, 0.09, 0.58, 1.16, 1.01, matWood, hg);
    const doorAwning = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.05, 0.42), matRoofTile);
    doorAwning.position.set(0.58, 1.84, 1.16);
    doorAwning.rotation.x = 0.22;
    doorAwning.castShadow = true;
    hg.add(doorAwning);
    addBox(0.86, 0.16, 0.36, 0.58, 0.08, 1.22, matStoneWall, hg);

    // Pitched Japanese Kawara tile roof (gable + ridge beam)
    const rLeft = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.14, 1.48), matRoofTile);
    rLeft.position.set(0, 2.45, -0.56);
    rLeft.rotation.x = -0.46;
    rLeft.castShadow = true;
    hg.add(rLeft);

    const rRight = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.14, 1.48), matRoofTile);
    rRight.position.set(0, 2.45, 0.56);
    rRight.rotation.x = 0.46;
    rRight.castShadow = true;
    hg.add(rRight);

    addBox(3.22, 0.16, 0.20, 0, 2.74, 0, matDarkIron, hg); // ridge tile
  }

  addCoastalHouse(-10.2, QUAY_Y + 2.25, -11.8, 0.92, 0.14);
  addCoastalHouse(-15.5, QUAY_Y + 3.45, -12.6, 1.02, -0.18);
  addCoastalHouse(-13.0, QUAY_Y + 4.05, -16.2, 0.96, 0.08);

  // Layered Anime Foliage Trees on the hillside (sway sequentially during sea wind gust!)
  const treePivots = [];
  const trunkMat = createAnimeToonMaterial({ color: 0x6b4f3a });
  const leafColors = [
    createAnimeToonMaterial({ color: 0x5ba363, wetness: 0.22, rimStrength: 0.22 }),
    createAnimeToonMaterial({ color: 0x73bc6d, wetness: 0.22, rimStrength: 0.22 }),
    createAnimeToonMaterial({ color: 0x4b8a57, wetness: 0.22, rimStrength: 0.22 }),
  ];

  function addHillTree(x, y, z, scale, colorIdx) {
    const tg = new THREE.Group();
    tg.position.set(x, y, z);
    hillGroup.add(tg);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.10 * scale, 0.18 * scale, 1.1 * scale, 7), trunkMat);
    trunk.position.y = 0.55 * scale;
    trunk.castShadow = true;
    tg.add(trunk);

    const canopyPivot = new THREE.Group();
    canopyPivot.position.y = 0.95 * scale;
    tg.add(canopyPivot);

    const matL = leafColors[colorIdx % leafColors.length];
    const blobs = [
      [0, 0.45, 0, 0.78],
      [-0.45, 0.22, 0.25, 0.56],
      [0.42, 0.25, -0.2, 0.58],
      [0.1, 0.75, 0.15, 0.52],
    ];
    blobs.forEach(([bx, by, bz, br]) => {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(br * scale, 1), matL);
      puff.position.set(bx * scale, by * scale, bz * scale);
      puff.castShadow = true;
      puff.receiveShadow = true;
      canopyPivot.add(puff);
    });

    treePivots.push({
      pivot: canopyPivot,
      wx: x,
      wz: z,
      phase: x * 0.7 + z * 0.5,
    });
  }

  const treeSpecs = [
    [-7.6, QUAY_Y + 2.35, -10.8, 1.05, 0],
    [-8.4, QUAY_Y + 2.65, -14.2, 1.18, 1],
    [-11.8, QUAY_Y + 3.15, -10.2, 0.92, 2],
    [-13.4, QUAY_Y + 3.45, -13.6, 1.15, 0],
    [-16.8, QUAY_Y + 3.85, -10.4, 1.02, 1],
    [-17.4, QUAY_Y + 4.45, -15.4, 1.24, 2],
    [-15.6, QUAY_Y + 4.75, -17.4, 1.12, 1],
    [-10.4, QUAY_Y + 3.55, -16.8, 1.18, 0],
    [-7.2, QUAY_Y + 2.75, -17.0, 0.98, 2],
    [-17.6, QUAY_Y + 3.35, -12.6, 0.85, 0],
    [-11.4, QUAY_Y + 2.70, -14.2, 0.88, 1],
  ];
  treeSpecs.forEach((spec) => addHillTree(...spec));

  return {
    root,
    update(t) {
      const windDir = ENV_UNIFORMS.uWindVec.value;
      const gustFront = ENV_UNIFORMS.uGustFrontPos.value;
      const gustStr = ENV_UNIFORMS.uGustStrength.value;

      // Gentle breeze + sequential gust wave passing up the hillside trees
      treePivots.forEach((tr) => {
        const s = tr.wx * windDir.x + tr.wz * windDir.y;
        const localGust = gustStr * Math.exp(-Math.pow((s - gustFront) * 0.14, 2));
        const baseBreeze = Math.sin(t * 1.4 + tr.phase) * 0.035;
        const gustSway = localGust * (0.16 + 0.07 * Math.sin(t * 5.2 + tr.phase));
        tr.pivot.rotation.z = -(baseBreeze + gustSway) * 0.85;
        tr.pivot.rotation.x = (baseBreeze + gustSway) * 0.45;
      });
    },
  };
}
