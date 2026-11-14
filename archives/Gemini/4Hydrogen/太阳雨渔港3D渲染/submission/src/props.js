import * as THREE from 'three';
import { QUAY_Y, ENV_UNIFORMS, getWaterHeight, getSlipwayY, evalBoat4Trajectory, hash1 } from './state.js';
import { createAnimeToonMaterial } from './toon.js';
import {
  createWarningSignTexture,
  createVendingFrontTexture,
  createBuoyNumberTexture,
  createCorrugatedWallTexture,
  createFishnetTexture,
  createRopeFiberTexture,
} from './textures.js';

export function buildProps(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const matCastIron = createAnimeToonMaterial({
    color: 0x263138,
    wetness: 0.08, // matte cast iron contrast against wet ropes!
    rimStrength: 0.10,
    shadowTintStrength: 0.25,
  });
  const matRust = createAnimeToonMaterial({ color: 0x8f5038, wetness: 0.25 });
  const matSteel = createAnimeToonMaterial({ color: 0xbecbd0, wetness: 0.35 });
  const matPolePaint = createAnimeToonMaterial({ color: 0xc9d7db, wetness: 0.3 });
  const matLampShade = createAnimeToonMaterial({ color: 0x456b7d, wetness: 0.42, side: THREE.DoubleSide });
  const matWire = createAnimeToonMaterial({ color: 0x2c3b44, wetness: 0.1 });
  const matSilverCase = createAnimeToonMaterial({ color: 0xbcc8cd, wetness: 0.45, rimStrength: 0.28 });
  const matSilverTrim = createAnimeToonMaterial({ color: 0x62737c, wetness: 0.35 });
  const matSkiffWood = createAnimeToonMaterial({ color: 0xa67449, wetness: 0.35, side: THREE.DoubleSide });
  const matSkiffInside = createAnimeToonMaterial({ color: 0x6f4b2f, wetness: 0.15, side: THREE.DoubleSide });
  const matSkiffTrim = createAnimeToonMaterial({ color: 0x497d91, wetness: 0.35 });
  const matCrateWhite = createAnimeToonMaterial({ color: 0xf1f6f7, wetness: 0.58 });
  const matCrateBlue = createAnimeToonMaterial({ color: 0x3b8ab3, wetness: 0.58 });
  const fishnetTex = createFishnetTexture();
  const matNet = createAnimeToonMaterial({
    color: 0xffffff,
    map: fishnetTex,
    alphaTest: 0.35,
    wetness: 0.22,
    side: THREE.DoubleSide,
  });
  const matRope = createAnimeToonMaterial({
    color: 0xffffff,
    map: createRopeFiberTexture({ darkWet: false }),
    wetness: 0.22,
  });

  const lampPoints = [];
  const dripOrigins = []; // { x, y, z, phase } for dripping water droplets!

  // ---------------------------------------------------------
  // 1. Matte Black Cast-Iron Bollards (黑色铸铁系船柱)
  // ---------------------------------------------------------
  const bollardCoords = [
    [-5.6, QUAY_Y, -9.2],
    [-5.6, QUAY_Y, -4.4],
    [-5.6, QUAY_Y, -3.4],
    [-5.6, QUAY_Y, 2.1],
    [-5.6, QUAY_Y, 4.1],
    [-4.2, QUAY_Y, 5.85],
    [-1.4, QUAY_Y, 5.85],
    [0.95, QUAY_Y, 5.85],
    [3.1, QUAY_Y, 6.4],
    [5.1, 0.55, 7.9],
    [5.1, 0.55, 11.8],
  ];

  bollardCoords.forEach(([bx, by, bz], i) => {
    const bg = new THREE.Group();
    bg.position.set(bx, by, bz);
    root.add(bg);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.06, 10), matCastIron);
    base.position.y = 0.03;
    base.castShadow = true;
    bg.add(base);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.34, 10), matCastIron);
    shaft.position.y = 0.22;
    shaft.castShadow = true;
    bg.add(shaft);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.11, 0.09, 10), matCastIron);
    cap.position.y = 0.42;
    cap.castShadow = true;
    bg.add(cap);

    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.34, 6), matCastIron);
    horn.rotation.z = Math.PI / 2;
    horn.position.y = 0.34;
    bg.add(horn);

    // Coiled rope turns around half of the bollards
    if (i % 2 === 0) {
      for (let t = 0; t < 3; t++) {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.025, 6, 14), matRope);
        coil.rotation.x = Math.PI / 2;
        coil.position.y = 0.13 + t * 0.048;
        bg.add(coil);
      }
    }
  });

  // ---------------------------------------------------------
  // 2. Dock Lamp Posts with Circular Ring Shades + Overhead Catenary Wires
  // ---------------------------------------------------------
  const lampSpecs = [
    [-5.6, QUAY_Y, 4.9, 0.0],
    [-5.6, QUAY_Y, -5.2, 0.0],
    [1.6, QUAY_Y, 6.25, -Math.PI / 2],
    [-10.8, QUAY_Y, 10.6, Math.PI * 0.18],
  ];

  const lampWireTops = [];
  lampSpecs.forEach(([lx, ly, lz, rotY], idx) => {
    const lg = new THREE.Group();
    lg.position.set(lx, ly, lz);
    lg.rotation.y = rotY;
    root.add(lg);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.45, 8), matPolePaint);
    plinth.position.y = 0.225;
    plinth.castShadow = true;
    lg.add(plinth);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 4.15, 8), matPolePaint);
    pole.position.y = 2.35;
    pole.castShadow = true;
    lg.add(pole);

    // Curved gooseneck outreach arm
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 4.35, 0),
      new THREE.Vector3(0.28, 4.65, 0),
      new THREE.Vector3(0.68, 4.55, 0),
      new THREE.Vector3(0.82, 4.38, 0),
    ]);
    const armMesh = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 10, 0.032, 6, false), matPolePaint);
    armMesh.castShadow = true;
    lg.add(armMesh);

    // Circular Ring-Hood Shade (顶端带圆环形灯罩)
    const shadeRing = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.16, 16, 1, true), matLampShade);
    shadeRing.position.set(0.82, 4.30, 0);
    shadeRing.castShadow = true;
    lg.add(shadeRing);

    const shadeRim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.022, 6, 18), matLampShade);
    shadeRim.rotation.x = Math.PI / 2;
    shadeRim.position.set(0.82, 4.22, 0);
    lg.add(shadeRim);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff0c2 })
    );
    bulb.position.set(0.82, 4.24, 0);
    lg.add(bulb);

    const pLight = new THREE.PointLight(0xffdfb0, 0.55, 7.5, 2.0);
    pLight.position.set(0.82, 4.10, 0);
    pLight.layers.enableAll();
    lg.add(pLight);
    lampPoints.push(pLight);

    // World position of wire tie point near top of pole & shade drip tip
    const tieWorld = new THREE.Vector3(lx, ly + 4.12, lz);
    lampWireTops.push(tieWorld);

    const dripLocal = new THREE.Vector3(0.82, 4.20, 0.32).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    dripOrigins.push({
      x: lx + dripLocal.x,
      y: ly + dripLocal.y,
      z: lz + dripLocal.z,
      phase: idx * 1.37,
    });
  });

  // Slender overhead power lines crisscrossing diagonally across the sky
  const wireLinks = [
    [lampWireTops[0], lampWireTops[1]],
    [lampWireTops[0], lampWireTops[2]],
    [lampWireTops[0], lampWireTops[3]],
    [lampWireTops[3], new THREE.Vector3(-12.2, QUAY_Y + 3.4, 8.2)], // Waiting room corner bracket
    [lampWireTops[1], new THREE.Vector3(-10.6, QUAY_Y + 4.2, -3.5)], // Warehouse roof bracket
    [lampWireTops[1], new THREE.Vector3(-9.5, QUAY_Y + 4.8, -11.5)], // Up toward hillside houses
  ];

  wireLinks.forEach(([pA, pB]) => {
    const mid = new THREE.Vector3().lerpVectors(pA, pB, 0.5);
    mid.y -= pA.distanceTo(pB) * 0.055; // delicate catenary sag
    const curve = new THREE.QuadraticBezierCurve3(pA, mid, pB);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.014, 4, false), matWire);
    root.add(wire);
  });

  // Wall brackets & white ceramic insulators at wire termination points
  wireLinks.slice(3).forEach(([, anchorPt]) => {
    const ins = new THREE.Group();
    ins.position.copy(anchorPt);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), matCastIron);
    arm.position.x = -0.09;
    ins.add(arm);
    const ceramic = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.075, 8), matCrateWhite);
    ins.add(ceramic);
    root.add(ins);
  });

  // ---------------------------------------------------------
  // 3. Traces of Someone Just Left (乐器硬箱 & 透明雨伞 — Shot 4!)
  // ---------------------------------------------------------
  // Two silver-grey instrument hard cases side-by-side on the wet foreground pier
  const casesGroup = new THREE.Group();
  root.add(casesGroup);

  // Case 1: Sculpted contoured guitar hard case with metallic trim, handle & 3 latches!
  const case1 = new THREE.Group();
  case1.position.set(-0.38, QUAY_Y + 0.095, 11.4);
  case1.rotation.y = 0.28;
  casesGroup.add(case1);

  const gShape = new THREE.Shape();
  gShape.moveTo(-0.52, -0.13);
  gShape.bezierCurveTo(-0.54, -0.23, -0.28, -0.24, -0.12, -0.16);
  gShape.bezierCurveTo(-0.04, -0.12, 0.02, -0.18, 0.14, -0.17);
  gShape.bezierCurveTo(0.25, -0.16, 0.27, -0.09, 0.52, -0.09);
  gShape.lineTo(0.55, 0.0);
  gShape.lineTo(0.52, 0.09);
  gShape.bezierCurveTo(0.27, 0.09, 0.25, 0.16, 0.14, 0.17);
  gShape.bezierCurveTo(0.02, 0.18, -0.04, 0.12, -0.12, 0.16);
  gShape.bezierCurveTo(-0.28, 0.24, -0.54, 0.23, -0.52, 0.13);
  gShape.closePath();

  const guitarCaseGeo = new THREE.ExtrudeGeometry(gShape, {
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  guitarCaseGeo.rotateX(-Math.PI / 2);
  guitarCaseGeo.translate(0, -0.075, 0);
  const c1Body = new THREE.Mesh(guitarCaseGeo, matSilverCase);
  c1Body.castShadow = true;
  c1Body.receiveShadow = true;
  case1.add(c1Body);
  const c1NeckBand = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.032, 0.03), matSilverTrim);
  c1NeckBand.position.set(0.0, 0.0, 0.19);
  case1.add(c1NeckBand);
  [-0.34, -0.02, 0.30].forEach((lx) => {
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), matCastIron);
    latch.position.set(lx, 0.0, 0.21);
    case1.add(latch);
  });
  const c1Handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 5, 10, Math.PI), matCastIron);
  c1Handle.rotation.x = Math.PI / 2;
  c1Handle.position.set(-0.08, 0.0, 0.21);
  case1.add(c1Handle);

  // Case 2: Reinforced silver-grey aluminum flight case with corner bumpers & handle
  const case2 = new THREE.Group();
  case2.position.set(0.36, QUAY_Y + 0.13, 10.92);
  case2.rotation.y = -0.18;
  casesGroup.add(case2);

  const c2Body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.24, 0.48), matSilverCase);
  c2Body.castShadow = true;
  c2Body.receiveShadow = true;
  case2.add(c2Body);
  const c2Rim = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.04, 0.50), matSilverTrim);
  case2.add(c2Rim);
  [-0.38, 0.38].forEach((cx) => {
    [-0.10, 0.10].forEach((cy) => {
      [-0.22, 0.22].forEach((cz) => {
        const corner = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), matSilverTrim);
        corner.position.set(cx, cy, cz);
        case2.add(corner);
      });
    });
  });
  [-0.22, 0.22].forEach((lx) => {
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.035), matCastIron);
    latch.position.set(lx, 0, 0.25);
    case2.add(latch);
  });
  const c2Handle = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.015, 5, 10, Math.PI), matCastIron);
  c2Handle.rotation.x = Math.PI / 2;
  c2Handle.position.set(0, 0, 0.25);
  case2.add(c2Handle);
  // Small coastal band sticker accent on Case 2 lid
  const sticker = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.08),
    createAnimeToonMaterial({ color: 0x52a8bd })
  );
  sticker.rotation.x = -Math.PI / 2;
  sticker.rotation.z = 0.2;
  sticker.position.set(0.14, 0.124, -0.04);
  case2.add(sticker);

  // Clear Vinyl Umbrella leaning cleanly against the concrete step cheek wall!
  const umbGroup = new THREE.Group();
  umbGroup.position.set(1.92, QUAY_Y + 0.44, 11.72);
  umbGroup.rotation.set(0.14, -0.38, 0.52);
  root.add(umbGroup);

  const umbShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.88, 6), matSteel);
  umbShaft.position.y = 0.12;
  umbGroup.add(umbShaft);
  const umbHook = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 12, Math.PI), matCrateWhite);
  umbHook.position.set(0.045, -0.32, 0);
  umbHook.rotation.z = Math.PI;
  umbGroup.add(umbHook);

  const umbCanopyGeo = new THREE.SphereGeometry(0.52, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.44);
  const umbCanopyMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6f8fc,
    transparent: true,
    opacity: 0.34,
    roughness: 0.06,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const umbCanopy = new THREE.Mesh(umbCanopyGeo, umbCanopyMat);
  umbCanopy.position.y = 0.06;
  umbCanopy.layers.set(1);
  umbGroup.add(umbCanopy);

  // White edge binding + 8 delicate steel ribs (Layer 0 for crisp slender silhouette!)
  const umbEdge = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.011, 5, 24), matCrateWhite);
  umbEdge.rotation.x = Math.PI / 2;
  umbEdge.position.y = 0.15;
  umbGroup.add(umbEdge);

  for (let r = 0; r < 8; r++) {
    const a = (r / 8) * Math.PI * 2;
    const ribCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.58, 0),
      new THREE.Vector3(Math.cos(a) * 0.34, 0.44, Math.sin(a) * 0.34),
      new THREE.Vector3(Math.cos(a) * 0.51, 0.15, Math.sin(a) * 0.51)
    );
    const rib = new THREE.Mesh(new THREE.TubeGeometry(ribCurve, 6, 0.006, 4, false), matSteel);
    umbGroup.add(rib);
  }

  // Delicate sunlit raindrops clinging on umbrella dome + drip edge!
  const dropGeo = new THREE.SphereGeometry(0.009, 6, 5);
  const dropMat = new THREE.MeshBasicMaterial({ color: 0xfff8dc, transparent: true, opacity: 0.78 });
  for (let d = 0; d < 22; d++) {
    const a = hash1(d * 13) * Math.PI * 2;
    const phi = 0.25 + hash1(d * 29) * 0.9;
    const dr = new THREE.Mesh(dropGeo, dropMat);
    dr.position.set(
      Math.sin(phi) * Math.cos(a) * 0.525,
      0.06 + Math.cos(phi) * 0.525,
      Math.sin(phi) * Math.sin(a) * 0.525
    );
    dr.layers.set(1);
    umbGroup.add(dr);
  }
  // Lowest tip of leaning umbrella drips down periodically toward foreground quay / steps!
  dripOrigins.push({ x: 1.72, y: QUAY_Y + 0.38, z: 11.75, phase: 0.4 });
  // Boat 2 & Boat 1 gunwale drip points
  dripOrigins.push({ x: -2.4, y: 0.72, z: -0.6, phase: 2.1 });
  dripOrigins.push({ x: -1.2, y: 0.65, z: 3.3, phase: 3.4 });

  // ---------------------------------------------------------
  // 4. Overturned Small Wooden Skiff on Slipway (倒扣的小木舢板 — Shot 5!)
  // ---------------------------------------------------------
  const slipYCenter = getSlipwayY(2.55);
  const slipAngle = Math.atan2(QUAY_Y - (-0.45), 5.7);
  const skiffGroup = new THREE.Group();
  // Rear gunwale rests flush on slipway while front edge props open on chock so cat sits unobstructed below!
  skiffGroup.position.set(2.55, slipYCenter + 0.25, 14.12);
  skiffGroup.rotation.set(-0.34, 0.04, -slipAngle);
  root.add(skiffGroup);

  // Build arch-upward half-cylinder shell (open underside facing down -Y, rim edges at y=0, z=±r)
  const skiffOuterGeo = new THREE.CylinderGeometry(0.64, 0.78, 2.70, 14, 1, false, -Math.PI * 0.5, Math.PI);
  skiffOuterGeo.rotateZ(Math.PI / 2);
  skiffOuterGeo.rotateX(-Math.PI / 2);
  skiffOuterGeo.scale(1.0, 0.62, 1.0);
  const skiffHull = new THREE.Mesh(skiffOuterGeo, matSkiffWood);
  skiffHull.castShadow = true;
  skiffHull.receiveShadow = true;
  skiffGroup.add(skiffHull);

  // Dark dry interior wood planking liner slightly inside outer shell so Shot 5 underside looks rich & hollow!
  const skiffInnerGeo = new THREE.CylinderGeometry(0.61, 0.75, 2.64, 12, 1, true, -Math.PI * 0.5, Math.PI);
  skiffInnerGeo.rotateZ(Math.PI / 2);
  skiffInnerGeo.rotateX(-Math.PI / 2);
  skiffInnerGeo.scale(1.0, 0.60, 1.0);
  const skiffInner = new THREE.Mesh(skiffInnerGeo, matSkiffInside);
  skiffGroup.add(skiffInner);

  // Inner wooden cross thwarts (bench ribs seen inside upturned hull)
  [-0.45, 0.45].forEach((tx) => {
    const thwart = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.04, 1.15), matSkiffInside);
    thwart.position.set(tx, 0.14, 0);
    skiffGroup.add(thwart);
  });

  // Keel batten flush along the arched top ridge (y = ~0.46) & tapered blue gunwale strakes hugging rim!
  const keel = new THREE.Mesh(new THREE.BoxGeometry(2.70, 0.07, 0.09), matSkiffTrim);
  keel.position.set(0, 0.46, 0);
  keel.castShadow = true;
  skiffGroup.add(keel);
  [-1, 1].forEach((sz) => {
    const strake = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.08, 0.07), matSkiffTrim);
    strake.position.set(0, 0.02, sz * 0.73);
    strake.rotation.y = -sz * 0.052;
    strake.castShadow = true;
    skiffGroup.add(strake);
  });

  // Cross-braced timber chock cradle wedged neatly beneath camera-facing front blue gunwale strake!
  const chockGroup = new THREE.Group();
  chockGroup.position.set(2.02, getSlipwayY(2.02), 14.74);
  chockGroup.rotation.set(0.02, 0.04, -slipAngle);
  root.add(chockGroup);
  const chockBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.30), matSkiffInside);
  chockBase.position.y = 0.035;
  chockBase.castShadow = true;
  chockBase.receiveShadow = true;
  chockGroup.add(chockBase);
  [-0.08, 0.08].forEach((cz) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.07), matSkiffWood);
    leg.position.set(-cz * 0.65, 0.21, cz);
    leg.rotation.z = cz > 0 ? 0.28 : -0.28;
    leg.castShadow = true;
    chockGroup.add(leg);
  });
  const chockTop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.24), matSkiffWood);
  chockTop.position.y = 0.37;
  chockTop.castShadow = true;
  chockTop.receiveShadow = true;
  chockGroup.add(chockTop);

  // ---------------------------------------------------------
  // 5. Stacked Wet Plastic Fish Crates & Blue Totes (with molded lids, latches & carry handles)
  // ---------------------------------------------------------
  function addQuayCrateStack(x, z, count, startBlue = false) {
    for (let i = 0; i < count; i++) {
      const m = (i + (startBlue ? 1 : 0)) % 2 === 0 ? matCrateWhite : matCrateBlue;
      const boxGroup = new THREE.Group();
      boxGroup.position.set(x, QUAY_Y + 0.15 + i * 0.31, z);
      boxGroup.rotation.y = (hash1(x * 7 + i) - 0.5) * 0.24;

      const box = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.28, 0.44), m);
      box.castShadow = true;
      box.receiveShadow = true;
      boxGroup.add(box);

      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.045, 0.48), m);
      rim.position.y = 0.135;
      rim.castShadow = true;
      boxGroup.add(rim);

      [-0.33, 0.33].forEach((hx) => {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.055, 0.15), matCastIron);
        handle.position.set(hx, 0.04, 0);
        boxGroup.add(handle);
      });
      [-0.17, 0.17].forEach((lx) => {
        const latch = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.03), matCastIron);
        latch.position.set(lx, 0.095, 0.235);
        boxGroup.add(latch);
      });

      root.add(boxGroup);
    }
  }
  addQuayCrateStack(-9.5, -4.8, 3, false);
  addQuayCrateStack(-9.5, -0.35, 2, true);
  addQuayCrateStack(-8.5, 6.2, 2, true);
  addQuayCrateStack(-6.6, 6.4, 3, false);

  // ---------------------------------------------------------
  // 6. Drying Fishing Net on Iron Rack & Buoy-Strung Ropes (Shot 6!)
  // ---------------------------------------------------------
  const rackGroup = new THREE.Group();
  rackGroup.position.set(-6.15, QUAY_Y, 9.75);
  rackGroup.rotation.y = 0.14;
  root.add(rackGroup);

  // Iron A-frame drying posts + anchored foot plates + crossbar
  [-1.35, 1.35].forEach((rx) => {
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 2.05, 6), matRust);
    leg1.position.set(rx, 0.98, -0.25);
    leg1.rotation.x = 0.22;
    leg1.castShadow = true;
    rackGroup.add(leg1);

    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 2.05, 6), matRust);
    leg2.position.set(rx, 0.98, 0.25);
    leg2.rotation.x = -0.22;
    leg2.castShadow = true;
    rackGroup.add(leg2);

    [-0.47, 0.47].forEach((fz) => {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.03, 8), matCastIron);
      foot.position.set(rx, 0.015, fz);
      rackGroup.add(foot);
    });
  });
  const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 2.95, 6), matRust);
  topBar.rotation.z = Math.PI / 2;
  topBar.position.y = 1.94;
  topBar.castShadow = true;
  rackGroup.add(topBar);

  // Draped drying fishing net panels (pivoting from topBar so wind gusts blow them smoothly!)
  const netPivot = new THREE.Group();
  netPivot.position.set(0, 1.92, 0);
  rackGroup.add(netPivot);

  const netMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 1.48, 12, 8), matNet);
  netMesh.position.y = -0.76;
  netMesh.castShadow = true;
  netPivot.add(netMesh);

  // Top & bottom hem ropes, hanging rings & lead sinkers on drying net
  const topHem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.38, 6), matRope);
  topHem.rotation.z = Math.PI / 2;
  topHem.position.y = -0.02;
  netPivot.add(topHem);

  const botHem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.38, 6), matRope);
  botHem.rotation.z = Math.PI / 2;
  botHem.position.y = -1.50;
  netPivot.add(botHem);

  for (let i = 0; i < 7; i++) {
    const cx = -1.08 + i * 0.36;
    const clip = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.01, 5, 10), matCastIron);
    clip.rotation.y = Math.PI / 2;
    clip.position.set(cx, 0.01, 0);
    netPivot.add(clip);

    const sinker = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.045, 6), matCastIron);
    sinker.rotation.z = Math.PI / 2;
    sinker.position.set(cx, -1.50, 0);
    netPivot.add(sinker);
  }

  // Buoy-strung ropes (缀满浮球的绳串) hanging across rack & along warehouse awning
  const floatColors = [
    createAnimeToonMaterial({ color: 0xee7448, wetness: 0.42 }),
    createAnimeToonMaterial({ color: 0x50b89d, wetness: 0.42 }),
    createAnimeToonMaterial({ color: 0xf4c94e, wetness: 0.42 }),
  ];
  const buoyStrings = [];
  function addBuoyString(x0, y0, z0, x1, y1, z1, numFloats) {
    const bg = new THREE.Group();
    const mid = new THREE.Vector3((x0 + x1) * 0.5, (y0 + y1) * 0.5 - 0.34, (z0 + z1) * 0.5);
    bg.position.copy(mid);
    root.add(bg);

    const p0 = new THREE.Vector3(x0, y0, z0).sub(mid);
    const p1 = new THREE.Vector3(x1, y1, z1).sub(mid);
    const sag = new THREE.Vector3(0, -0.32, 0);
    const curve = new THREE.QuadraticBezierCurve3(p0, sag, p1);
    const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.016, 5, false), matRope);
    bg.add(rope);

    for (let i = 1; i <= numFloats; i++) {
      const pt = curve.getPoint(i / (numFloats + 1));
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), floatColors[i % 3]);
      fl.position.copy(pt);
      fl.castShadow = true;
      bg.add(fl);
    }
    buoyStrings.push({ group: bg, wx: mid.x, wz: mid.z });
  }
  addBuoyString(-7.52, QUAY_Y + 1.94, 9.94, -4.78, QUAY_Y + 1.94, 9.56, 7);
  addBuoyString(-10.3, QUAY_Y + 3.45, -5.8, -10.3, QUAY_Y + 3.45, -1.2, 8);

  // ---------------------------------------------------------
  // 7. Rusty Hand-Crank Winch & Small Davit Crane (手摇绞盘与小型吊杆)
  // ---------------------------------------------------------
  const craneGroup = new THREE.Group();
  craneGroup.position.set(-6.1, QUAY_Y, -7.8);
  craneGroup.rotation.y = 0.55;
  root.add(craneGroup);

  const cranePost = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.35, 8), matRust);
  cranePost.position.y = 1.175;
  cranePost.castShadow = true;
  craneGroup.add(cranePost);

  const boom = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.11, 0.11), matRust);
  boom.position.set(0.68, 2.55, 0);
  boom.rotation.z = 0.34;
  boom.castShadow = true;
  craneGroup.add(boom);

  // Brace connects exact mast pin (0, 1.50, 0) to boom underside (0.86, 2.58, 0)
  const bDx = 0.86;
  const bDy = 1.08;
  const brace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, Math.hypot(bDx, bDy) + 0.04, 6),
    matRust
  );
  brace.position.set(bDx * 0.5, 1.50 + bDy * 0.5, 0);
  brace.rotation.z = -Math.atan2(bDx, bDy);
  craneGroup.add(brace);

  const winchDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 10), matCastIron);
  winchDrum.rotation.x = Math.PI / 2;
  winchDrum.position.set(0.14, 0.92, 0);
  craneGroup.add(winchDrum);

  const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.04), matSteel);
  crankArm.position.set(0.14, 0.92, 0.16);
  craneGroup.add(crankArm);

  const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), matCastIron);
  pulley.rotation.x = Math.PI / 2;
  pulley.position.set(1.36, 2.75, 0);
  craneGroup.add(pulley);

  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.32, 5), matSteel);
  cable.position.set(1.36, 2.09, 0);
  craneGroup.add(cable);

  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 5, 10, Math.PI * 1.4), matRust);
  hook.position.set(1.36, 1.39, 0);
  hook.rotation.z = Math.PI * 0.7;
  craneGroup.add(hook);

  // ---------------------------------------------------------
  // 8. Numbered Floating Mooring Buoys (涂有褪色编号的系船浮标)
  // ---------------------------------------------------------
  const buoySpecs = [
    { x: 3.2, z: -4.5, label: '03', phase: 0.7 },
    { x: 8.4, z: -1.8, label: '07', phase: 2.3 },
  ];
  const mooringBuoys = buoySpecs.map((spec) => {
    const bg = new THREE.Group();
    bg.position.set(spec.x, 0, spec.z);
    root.add(bg);

    const bMat = createAnimeToonMaterial({
      color: 0xffffff,
      map: createBuoyNumberTexture(spec.label),
      wetness: 0.4,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.56, 14), bMat);
    body.position.y = 0.06;
    body.castShadow = true;
    bg.add(body);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), matCrateWhite);
    cap.position.y = 0.34;
    bg.add(cap);

    const eyeRing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 5, 10), matRust);
    eyeRing.position.y = 0.68;
    bg.add(eyeRing);

    return { ...spec, group: bg };
  });

  // ---------------------------------------------------------
  // 9. Long-Handled Landing Net & Bucket leaning flush against Waiting Room East pillar
  // ---------------------------------------------------------
  const netPoleGroup = new THREE.Group();
  netPoleGroup.position.set(-11.58, QUAY_Y, 2.55);
  root.add(netPoleGroup);

  const poleStick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.95, 6), matSkiffWood);
  poleStick.position.set(0.16, 0.94, 0.0);
  poleStick.rotation.z = 0.20;
  poleStick.castShadow = true;
  netPoleGroup.add(poleStick);

  const netHoop = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 6, 16), matSteel);
  netHoop.position.set(-0.04, 1.90, 0.14);
  netHoop.rotation.set(Math.PI * 0.45, 0, -0.18);
  netPoleGroup.add(netHoop);

  const netBag = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.42, 10, 1, true), matNet);
  netBag.position.set(-0.04, 1.69, 0.14);
  netBag.rotation.x = Math.PI;
  netPoleGroup.add(netBag);

  const bucketGroup = new THREE.Group();
  bucketGroup.position.set(-11.28, QUAY_Y + 0.17, 2.95);
  root.add(bucketGroup);

  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.34, 12), matCrateBlue);
  bucket.castShadow = true;
  bucketGroup.add(bucket);
  const bucketRim = new THREE.Mesh(new THREE.TorusGeometry(0.192, 0.013, 5, 16), matCrateWhite);
  bucketRim.rotation.x = Math.PI / 2;
  bucketRim.position.y = 0.165;
  bucketGroup.add(bucketRim);
  const bucketBail = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.008, 4, 14, Math.PI), matSteel);
  bucketBail.position.y = 0.16;
  bucketBail.rotation.x = 0.45;
  bucketGroup.add(bucketBail);

  // ---------------------------------------------------------
  // 10. Vending Machine with Rusty Rain Awning & Glowing Lightbox (clearly framed beside Waiting Room SE corner)
  // ---------------------------------------------------------
  const vmGroup = new THREE.Group();
  vmGroup.position.set(-10.85, QUAY_Y, 9.25);
  vmGroup.rotation.y = Math.PI * 0.25; // faces diagonally into foreground plaza & camera!
  root.add(vmGroup);

  const vmBody = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.92, 0.72), createAnimeToonMaterial({ color: 0xeaf1f3, wetness: 0.32 }));
  vmBody.position.y = 0.96;
  vmBody.castShadow = true;
  vmBody.receiveShadow = true;
  vmGroup.add(vmBody);

  // Lit showcase front (subtle warm emissive glow!)
  const vmFront = new THREE.Mesh(
    new THREE.PlaneGeometry(1.06, 1.78),
    new THREE.MeshBasicMaterial({ map: createVendingFrontTexture() })
  );
  vmFront.position.set(0, 0.98, 0.365);
  vmGroup.add(vmFront);

  const vmGlow = new THREE.PointLight(0xfff1cc, 0.55, 3.8, 2.0);
  vmGlow.position.set(0, 1.35, 0.75);
  vmGlow.layers.enableAll();
  vmGroup.add(vmGlow);

  // Rusty corrugated rain awning above vending machine
  const awningTex = createCorrugatedWallTexture('#996248');
  const vmAwning = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.06, 0.85),
    createAnimeToonMaterial({ color: 0xb67456, map: awningTex, wetness: 0.4 })
  );
  vmAwning.position.set(0, 2.06, 0.25);
  vmAwning.rotation.x = 0.24;
  vmAwning.castShadow = true;
  vmGroup.add(vmAwning);

  // ---------------------------------------------------------
  // 11. Weathered Signboard ("潮風漁港 / 注意落水")
  // ---------------------------------------------------------
  const signGroup = new THREE.Group();
  signGroup.position.set(-1.95, QUAY_Y, 6.45);
  signGroup.rotation.y = 0.35;
  root.add(signGroup);

  [-0.52, 0.52].forEach((sx) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 1.48, 6), matRust);
    leg.position.set(sx, 0.74, 0);
    leg.castShadow = true;
    signGroup.add(leg);
  });

  const signBack = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.94, 0.05), matSteel);
  signBack.position.y = 1.28;
  signBack.castShadow = true;
  signGroup.add(signBack);

  const signFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.30, 0.88),
    createAnimeToonMaterial({ color: 0xffffff, map: createWarningSignTexture(), wetness: 0.25 })
  );
  signFace.position.set(0, 1.28, 0.028);
  signGroup.add(signFace);

  // ---------------------------------------------------------
  // 12. Windsock & Small Signal Pennants (风向袋与小旗 — Shot 6!)
  // ---------------------------------------------------------
  const wsGroup = new THREE.Group();
  wsGroup.position.set(-5.25, QUAY_Y, -10.1);
  root.add(wsGroup);

  const wsPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 3.05, 6), matPolePaint);
  wsPole.position.y = 1.525;
  wsPole.castShadow = true;
  wsGroup.add(wsPole);

  const wsPivot = new THREE.Group();
  wsPivot.position.y = 2.98;
  wsGroup.add(wsPivot);

  const wsOrange = createAnimeToonMaterial({ color: 0xec6d3f, wetness: 0.2, side: THREE.DoubleSide });
  const wsWhite = createAnimeToonMaterial({ color: 0xf6f8f8, wetness: 0.2, side: THREE.DoubleSide });
  const wsSegments = [];
  for (let s = 0; s < 5; s++) {
    const r0 = 0.16 - s * 0.02;
    const r1 = 0.14 - s * 0.02;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(r1, r0, 0.22, 10, 1, true),
      s % 2 === 0 ? wsOrange : wsWhite
    );
    seg.rotation.z = -Math.PI / 2;
    seg.position.x = 0.14 + s * 0.21;
    const segPivot = new THREE.Group();
    if (s === 0) wsPivot.add(segPivot);
    else wsSegments[s - 1].add(segPivot);
    segPivot.position.x = s === 0 ? 0.05 : 0.20;
    seg.position.x = 0.10;
    segPivot.add(seg);
    wsSegments.push(segPivot);
  }

  // String of small triangular pennants between Waiting Room roof corner & Lamp Post 4
  const flagStart = new THREE.Vector3(-11.75, QUAY_Y + 3.18, 8.35);
  const flagEnd = new THREE.Vector3(-10.8, QUAY_Y + 3.95, 10.6);
  const flagMid = new THREE.Vector3().lerpVectors(flagStart, flagEnd, 0.5);
  flagMid.y -= 0.26;
  const flagCurve = new THREE.QuadraticBezierCurve3(flagStart, flagMid, flagEnd);
  root.add(new THREE.Mesh(new THREE.TubeGeometry(flagCurve, 10, 0.01, 4, false), matWire));

  const pennantMats = [
    createAnimeToonMaterial({ color: 0xe6654c, side: THREE.DoubleSide }),
    createAnimeToonMaterial({ color: 0xf2c641, side: THREE.DoubleSide }),
    createAnimeToonMaterial({ color: 0x4ca6ba, side: THREE.DoubleSide }),
    createAnimeToonMaterial({ color: 0xf4f7f8, side: THREE.DoubleSide }),
  ];
  const pennants = [];
  for (let i = 1; i <= 7; i++) {
    const u = i / 8;
    const pt = flagCurve.getPoint(u);
    const triGeo = new THREE.ConeGeometry(0.11, 0.26, 3);
    triGeo.rotateX(Math.PI);
    triGeo.translate(0, -0.13, 0);
    const pen = new THREE.Mesh(triGeo, pennantMats[i % 4]);
    pen.position.copy(pt);
    pen.castShadow = true;
    root.add(pen);
    pennants.push({ mesh: pen, wx: pt.x, wz: pt.z, phase: i * 0.9 });
  }

  return {
    root,
    dripOrigins,
    update(t, sunIntensity) {
      const windDir = ENV_UNIFORMS.uWindVec.value;
      const gustFront = ENV_UNIFORMS.uGustFrontPos.value;
      const gustStr = ENV_UNIFORMS.uGustStrength.value;

      function localGustAt(wx, wz) {
        const s = wx * windDir.x + wz * windDir.y;
        return gustStr * Math.exp(-Math.pow((s - gustFront) * 0.14, 2));
      }

      // 1) Windsock leans & ripples sequentially
      const wsGust = localGustAt(-5.25, -10.1);
      const wsTilt = 0.28 + wsGust * 0.55; // droops gently in breeze, lifts horizontally in gust!
      wsPivot.rotation.y = Math.atan2(-windDir.y, windDir.x);
      wsPivot.rotation.z = -0.65 + wsTilt;
      wsSegments.forEach((seg, idx) => {
        seg.rotation.z = Math.sin(t * (4.5 + wsGust * 6.0) - idx * 0.9) * (0.06 + wsGust * 0.12);
        seg.rotation.y = Math.cos(t * (3.8 + wsGust * 5.0) - idx * 0.8) * (0.05 + wsGust * 0.10);
      });

      // 2) Signal pennants flutter sequentially along the gust wavefront
      pennants.forEach((p) => {
        const g = localGustAt(p.wx, p.wz);
        p.mesh.rotation.z = 0.22 + g * 0.65 + Math.sin(t * (5.0 + g * 7.5) + p.phase) * (0.14 + g * 0.22);
        p.mesh.rotation.x = Math.cos(t * 4.2 + p.phase) * (0.08 + g * 0.18);
      });

      // 3) Drying fishing net & buoy-strung ropes sway cleanly
      const netGust = localGustAt(-6.15, 9.75);
      netPivot.rotation.x = 0.10 + netGust * 0.36 + Math.sin(t * 3.1) * (0.04 + netGust * 0.08);
      netPivot.rotation.z = Math.cos(t * 2.4) * (0.02 + netGust * 0.05);

      buoyStrings.forEach((bs, idx) => {
        const g = localGustAt(bs.wx, bs.wz);
        bs.group.rotation.x = 0.08 + g * 0.28 + Math.sin(t * 3.4 + idx) * (0.04 + g * 0.09);
      });

      // 4) Numbered mooring buoys bob & tilt with waves + Boat 4 wake!
      const b4Traj = evalBoat4Trajectory(t);
      mooringBuoys.forEach((mb) => {
        const baseH = getWaterHeight(mb.x, mb.z, t);
        let wakeLift = 0;
        let wakeTilt = 0;
        if (b4Traj.active) {
          const dist = Math.hypot(mb.x - b4Traj.pos.x, mb.z - b4Traj.pos.z);
          const wave = Math.sin(dist * 1.2 - t * 4.0) * Math.exp(-dist * 0.10) * b4Traj.speed;
          wakeLift = wave * 0.08;
          wakeTilt = wave * 0.28;
        }
        mb.group.position.y = baseH + wakeLift;
        mb.group.rotation.z = Math.sin(t * 1.5 + mb.phase) * 0.08 + wakeTilt;
        mb.group.rotation.x = Math.cos(t * 1.3 + mb.phase) * 0.07;
      });

      // 5) Lamp glow boosts gently when sky dims under cloud
      const dimBoost = 1.0 + (1.0 - sunIntensity) * 2.2;
      lampPoints.forEach((lp) => {
        lp.intensity = 0.45 * dimBoost;
      });
    },
  };
}
