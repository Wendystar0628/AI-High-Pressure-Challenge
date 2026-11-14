import * as THREE from 'three';
import { QUAY_Y, ENV_UNIFORMS, getWaterHeight, getSlipwayY, hash1 } from './state.js';
import { createAnimeToonMaterial } from './toon.js';

export function buildCreatures(scene, boatsRef = []) {
  const root = new THREE.Group();
  scene.add(root);

  // ---------------------------------------------------------
  // 1. SEAGULLS (7 stylized cel-shaded gulls: soaring, bollard-perched, boat-perched, floating)
  // ---------------------------------------------------------
  const matGullWhite = createAnimeToonMaterial({ color: 0xf8fbfc, wetness: 0.15, rimStrength: 0.25 });
  const matGullWing = createAnimeToonMaterial({ color: 0xc2d5de, wetness: 0.15 });
  const matGullTip = createAnimeToonMaterial({ color: 0x2e434f });
  const matGullBeak = createAnimeToonMaterial({ color: 0xf0a638 });

  const matGullEye = new THREE.MeshToonMaterial({ color: 0x1a232b });

  function makeGullWingPiece(pts, depth) {
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 2,
    });
    geo.translate(0, 0, -depth * 0.5);
    // Rotate +PI/2 around X: (x, y_2d, z) -> (x, -z, y_2d) so +y_2d aligns with +Z (forward).
    geo.rotateX(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }

  const tailGeo = makeGullWingPiece([
    [0.032, 0.02],
    [-0.032, 0.02],
    [-0.082, -0.145],
    [0.0, -0.165],
    [0.082, -0.145],
  ], 0.013);

  function createSeagull() {
    const g = new THREE.Group();

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), matGullWhite);
    body.scale.set(0.85, 0.85, 1.85);
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), matGullWhite);
    head.position.set(0, 0.08, 0.19);
    g.add(head);

    [-1, 1].forEach((s) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), matGullEye);
      eye.position.set(s * 0.056, 0.098, 0.232);
      g.add(eye);
    });

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.10, 6), matGullBeak);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.07, 0.29);
    g.add(beak);

    const tail = new THREE.Mesh(tailGeo, matGullWhite);
    tail.position.set(0, 0.022, -0.155);
    g.add(tail);

    // Left & Right Articulated Cambered Wings (sleek wrist-forward sweep + tapered primary tips)
    const wings = [];
    [-1, 1].forEach((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.07, 0.04, 0.02);
      g.add(pivot);

      const innerGeo = makeGullWingPiece([
        [0, 0.062],
        [side * 0.11, 0.078],
        [side * 0.21, 0.068],
        [side * 0.21, -0.056],
        [side * 0.11, -0.068],
        [0, -0.070],
      ], 0.018);
      const innerW = new THREE.Mesh(innerGeo, matGullWing);
      innerW.rotation.z = side * 0.14;
      innerW.castShadow = true;
      pivot.add(innerW);

      const elbow = new THREE.Group();
      elbow.position.set(side * 0.20, 0.028, 0.004);
      elbow.rotation.z = -side * 0.20;
      pivot.add(elbow);

      const outerBaseGeo = makeGullWingPiece([
        [0, 0.064],
        [side * 0.108, 0.018],
        [side * 0.108, -0.074],
        [0, -0.058],
      ], 0.015);
      const outerBase = new THREE.Mesh(outerBaseGeo, matGullWing);
      outerBase.castShadow = true;
      elbow.add(outerBase);

      const outerTipGeo = makeGullWingPiece([
        [side * 0.104, 0.019],
        [side * 0.235, -0.052],
        [side * 0.258, -0.078],
        [side * 0.238, -0.095],
        [side * 0.104, -0.074],
      ], 0.012);
      const outerW = new THREE.Mesh(outerTipGeo, matGullTip);
      outerW.castShadow = true;
      elbow.add(outerW);

      wings.push({ pivot, side });
    });

    return { group: g, wings };
  }

  // Soaring gulls circling harbor & occasionally skimming gracefully low over water & quay
  const flyingGulls = [
    { cx: 1.5, cz: -1.5, rx: 7.2, rz: 5.5, yBase: 6.4, swoopAmp: 0.95, speed: 0.42, phase: 0.2 },
    { cx: 4.5, cz: -7.5, rx: 6.0, rz: 4.8, yBase: 7.6, swoopAmp: 0.95, speed: 0.36, phase: 2.1 },
    { cx: -2.0, cz: 3.0, rx: 5.8, rz: 4.6, yBase: 5.2, swoopAmp: 0.95, speed: -0.45, phase: 4.0 },
    { cx: 4.2, cz: 4.2, rx: 5.5, rz: 4.5, yBase: 2.65, swoopAmp: 1.45, speed: 0.52, phase: 1.4 },
  ].map((spec) => {
    const bird = createSeagull();
    root.add(bird.group);
    return { ...spec, ...bird };
  });

  // Bollard-perched gull at (-4.2, QUAY_Y + 0.53, 5.85) — FEATURED in Shot 3!
  const bollardGull = createSeagull();
  const bollardAnchor = new THREE.Vector3(-4.2, QUAY_Y + 0.53, 5.85);
  bollardGull.group.position.copy(bollardAnchor);
  bollardGull.group.rotation.y = 0.65;
  root.add(bollardGull.group);

  // Boat-perched gull resting on Boat 3's cabin roof
  const boatGull = createSeagull();
  root.add(boatGull.group);

  // Water-floating gull bobbing peacefully in harbor basin
  const waterGull = createSeagull();
  const wgPos = { x: 1.8, z: -2.4 };
  root.add(waterGull.group);

  // ---------------------------------------------------------
  // 2. HARBOR CAT (港猫 — sheltering under overturned skiff + varied strolls + head-lift look!)
  // ---------------------------------------------------------
  const catRoot = new THREE.Group();
  root.add(catRoot);

  const matCatWhite = createAnimeToonMaterial({ color: 0xf7f5ef, wetness: 0.1 });
  const matCatGinger = createAnimeToonMaterial({ color: 0xe38a4c, wetness: 0.1 });
  const matCatDark = createAnimeToonMaterial({ color: 0x3b3532 });
  const matCatPink = createAnimeToonMaterial({ color: 0xf09c96 });

  const catBodyGroup = new THREE.Group();
  catRoot.add(catBodyGroup);

  // Torso (warm white + calico ginger back patch)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 6, 10), matCatWhite);
  torso.rotation.x = Math.PI / 2;
  torso.position.y = 0.16;
  torso.castShadow = true;
  catBodyGroup.add(torso);

  const patch1 = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), matCatGinger);
  patch1.scale.set(0.95, 0.72, 1.15);
  patch1.position.set(0.02, 0.20, -0.02);
  catBodyGroup.add(patch1);

  const patch2 = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), matCatDark);
  patch2.position.set(-0.04, 0.19, -0.10);
  catBodyGroup.add(patch2);

  // Articulated Head Pivot (rotates smoothly to look up at camera when zoomed close!)
  const catHeadPivot = new THREE.Group();
  catHeadPivot.position.set(0, 0.24, 0.16);
  catBodyGroup.add(catHeadPivot);

  const catHead = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 12), matCatWhite);
  catHead.scale.set(1.06, 0.96, 0.98);
  catHead.castShadow = true;
  catHeadPivot.add(catHead);

  // Calico ear patches + pointed ears + subtle pink inner ear
  [-1, 1].forEach((side) => {
    const earMat = side < 0 ? matCatGinger : matCatDark;
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.085, 4), earMat);
    ear.position.set(side * 0.065, 0.09, -0.01);
    ear.rotation.z = -side * 0.28;
    ear.rotation.y = side * 0.2;
    catHeadPivot.add(ear);

    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.046, 4), matCatPink);
    innerEar.position.set(side * 0.063, 0.086, 0.008);
    innerEar.rotation.z = -side * 0.28;
    innerEar.rotation.y = side * 0.2;
    catHeadPivot.add(innerEar);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), matCatDark);
    eye.position.set(side * 0.042, 0.015, 0.088);
    catHeadPivot.add(eye);
  });

  // Nose, glossy eye catchlights & delicate cat whiskers
  const matEyeSpark = createAnimeToonMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 });
  [-1, 1].forEach((side) => {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 5), matEyeSpark);
    spark.position.set(side * 0.045, 0.021, 0.098);
    catHeadPivot.add(spark);
    [-0.08, 0.08].forEach((ang) => {
      const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.0015, 0.075, 4), matCatDark);
      whisker.rotation.z = Math.PI / 2 + side * ang;
      whisker.position.set(side * 0.072, -0.012 + ang * 0.05, 0.082);
      catHeadPivot.add(whisker);
    });
  });

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), matCatPink);
  nose.position.set(0, -0.008, 0.10);
  catHeadPivot.add(nose);

  // 4 Paws
  const catLegs = [];
  [
    [-0.065, 0.06, 0.11],
    [0.065, 0.06, 0.11],
    [-0.065, 0.06, -0.11],
    [0.065, 0.06, -0.11],
  ].forEach(([lx, ly, lz], idx) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.13, 6), matCatWhite);
    leg.position.set(lx, ly, lz);
    catBodyGroup.add(leg);
    catLegs.push({ mesh: leg, baseZ: lz, idx });
  });

  // Low gently curled tail trailing sideways behind hip (so it never pokes up behind ears!)
  const catTailPivot = new THREE.Group();
  catTailPivot.position.set(0, 0.14, -0.17);
  catBodyGroup.add(catTailPivot);
  const tailSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.22, 6), matCatGinger);
  tailSeg.position.set(0.05, -0.01, -0.09);
  tailSeg.rotation.set(1.22, 0.35, -0.35);
  catTailPivot.add(tailSeg);

  // Cat rest spot on the sloped slipway deck right under overturned skiff
  const skiffShelterPos = new THREE.Vector3(2.55, getSlipwayY(2.55) + 0.02, 14.15);
  const catRoutes = [
    [
      skiffShelterPos,
      new THREE.Vector3(1.1, QUAY_Y, 13.1),
      new THREE.Vector3(0.7, QUAY_Y, 11.4), // checking instrument cases & umbrella
      new THREE.Vector3(1.6, QUAY_Y, 9.6),  // peeking at puddle
      new THREE.Vector3(1.1, QUAY_Y, 13.1),
      skiffShelterPos,
    ],
    [
      skiffShelterPos,
      new THREE.Vector3(0.4, QUAY_Y, 12.6),
      new THREE.Vector3(-1.8, QUAY_Y, 7.6), // strolling near warning signboard & bollards
      new THREE.Vector3(-4.2, QUAY_Y, 6.2), // looking down at moored Boat 1
      new THREE.Vector3(-1.4, QUAY_Y, 10.5),
      skiffShelterPos,
    ],
    [
      skiffShelterPos,
      new THREE.Vector3(-1.2, QUAY_Y, 12.8),
      new THREE.Vector3(-6.2, QUAY_Y, 10.6), // wandering past drying net
      new THREE.Vector3(-9.1, QUAY_Y, 9.6),  // checking vending machine
      new THREE.Vector3(-4.5, QUAY_Y, 11.8),
      skiffShelterPos,
    ],
  ].map((pts) => new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.45));

  // ---------------------------------------------------------
  // 3. UNDERWATER FISH SCHOOL (22 small silver-cyan fish — scatter & regroup!)
  // ---------------------------------------------------------
  const fishCount = 22;
  const matFishBody = createAnimeToonMaterial({ color: 0xbdeff4, wetness: 0.28, rimStrength: 0.35 });
  const matFishBack = createAnimeToonMaterial({ color: 0x3b7b94, wetness: 0.2 });

  const fishes = [];
  for (let i = 0; i < fishCount; i++) {
    const fg = new THREE.Group();
    const fBody = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), matFishBody);
    fBody.scale.set(0.46, 0.72, 1.88);
    fg.add(fBody);

    const fStripe = new THREE.Mesh(new THREE.SphereGeometry(0.092, 6, 6), matFishBack);
    fStripe.scale.set(0.48, 0.45, 1.62);
    fStripe.position.y = 0.026;
    fg.add(fStripe);

    const tailPivot = new THREE.Group();
    tailPivot.position.z = -0.17;
    fg.add(tailPivot);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.14, 3), matFishBody);
    tail.rotation.x = Math.PI / 2;
    tail.rotation.z = Math.PI / 2;
    tail.scale.set(0.35, 1, 1);
    tail.position.z = -0.06;
    tailPivot.add(tail);

    root.add(fg);

    fishes.push({
      group: fg,
      tailPivot,
      phase: hash1(i * 19 + 5) * Math.PI * 2,
      radiusX: 1.1 + hash1(i * 7 + 1) * 2.4,
      radiusZ: 1.4 + hash1(i * 13 + 3) * 3.0,
      baseY: -0.95 - hash1(i * 29 + 2) * 1.1,
      speed: 0.42 + hash1(i * 37) * 0.28,
      scatterAngle: (i / fishCount) * Math.PI * 2 + hash1(i * 5) * 0.4,
      centerOffsetX: 11.4 + (hash1(i * 41) - 0.5) * 4.0,
      centerOffsetZ: 4.4 + (hash1(i * 43) - 0.5) * 6.8,
    });
  }

  const tmpLookDir = new THREE.Vector3();

  return {
    root,
    catRoot,
    bollardAnchor,
    update(t, sim) {
      // 1) Update Soaring Gulls
      flyingGulls.forEach((g, idx) => {
        const ang = t * g.speed + g.phase;
        const x = g.cx + Math.cos(ang) * g.rx;
        const z = g.cz + Math.sin(ang) * g.rz;
        // Occasional gentle dip toward water
        const swoop = Math.sin(ang * 2.0 + idx) * g.swoopAmp;
        const y = g.yBase + swoop;
        g.group.position.set(x, y, z);

        const dx = -Math.sin(ang) * g.rx * g.speed;
        const dz = Math.cos(ang) * g.rz * g.speed;
        g.group.rotation.y = Math.atan2(dx, dz);
        g.group.rotation.z = -g.speed * 0.35; // gentle bank into turn

        // Alternating flap & graceful glide phases
        const glideMix = Math.max(0, Math.sin(t * 0.55 + g.phase));
        const flapAngle = Math.sin(t * 7.2 + g.phase) * 0.45 * (1 - glideMix * 0.72) + 0.08 * glideMix;
        g.wings.forEach((w) => {
          w.pivot.rotation.z = w.side * flapAngle;
        });
      });

      // 2) Bollard Gull (perched calmly, or takes off gracefully when camera approaches — Shot 3!)
      const fleeT = sim.gullFleeTimer;
      if (fleeT <= 0) {
        bollardGull.group.position.copy(bollardAnchor);
        bollardGull.group.rotation.set(0, 0.65 + Math.sin(t * 0.9) * 0.14, 0);
        bollardGull.wings.forEach((w) => {
          // Folded sleekly backward along flanks
          w.pivot.rotation.y = w.side * 1.32;
          w.pivot.rotation.z = -w.side * 0.24;
        });
      } else {
        // Smooth helical takeoff over harbor (starts continuously from bollardAnchor at fleeT = 0!)
        const ramp = Math.min(1.0, fleeT / 1.4);
        const arc = fleeT * 0.85;
        const x = bollardAnchor.x + Math.sin(arc) * 1.65 * ramp + fleeT * 0.55;
        const z = bollardAnchor.z - (1.0 - Math.cos(arc)) * 2.35 - fleeT * 0.78;
        const y = bollardAnchor.y + Math.pow(fleeT, 0.92) * 1.68;
        bollardGull.group.position.set(x, y, z);

        const ft2 = fleeT + 0.05;
        const ramp2 = Math.min(1.0, ft2 / 1.4);
        const arc2 = ft2 * 0.85;
        const nextX = bollardAnchor.x + Math.sin(arc2) * 1.65 * ramp2 + ft2 * 0.55;
        const nextZ = bollardAnchor.z - (1.0 - Math.cos(arc2)) * 2.35 - ft2 * 0.78;
        bollardGull.group.rotation.set(
          -0.26 * Math.max(0, 1 - fleeT * 0.3),
          Math.atan2(nextX - x, nextZ - z),
          -0.18
        );
        const flap = Math.sin(fleeT * 14.5) * 0.58;
        bollardGull.wings.forEach((w) => {
          w.pivot.rotation.y = 0;
          w.pivot.rotation.z = w.side * flap;
        });
      }

      // 3) Boat 3 roof gull & Water-floating gull
      if (boatsRef[2]) {
        const b3 = boatsRef[2].mesh;
        boatGull.group.position.set(b3.position.x + 0.36, b3.position.y + 1.91, b3.position.z + 0.18);
        boatGull.group.rotation.y = -0.5 + Math.sin(t * 0.7) * 0.12;
        boatGull.wings.forEach((w) => {
          w.pivot.rotation.y = w.side * 1.32;
          w.pivot.rotation.z = -w.side * 0.24;
        });
      }

      const wgH = getWaterHeight(wgPos.x, wgPos.z, t);
      waterGull.group.position.set(wgPos.x + Math.sin(t * 0.35) * 0.25, wgH + 0.07, wgPos.z + Math.cos(t * 0.28) * 0.2);
      waterGull.group.rotation.y = 1.2 + Math.sin(t * 0.4) * 0.25;
      waterGull.wings.forEach((w) => {
        w.pivot.rotation.y = w.side * 1.28;
        w.pivot.rotation.z = -w.side * 0.22;
      });

      // 4) Harbor Cat: shelters under overturned skiff during rain & Shot 5; strolls varied quay paths when rain eases!
      // Stroll windows occur during light-rain intervals AFTER t=60s (and/or brief t=62..82s cycles) so Shot 5 at 21-25.5s always finds cat under skiff!
      const cyclePos = t % 84;
      const isStrolling = t > 60.5 && cyclePos > 60.5 && cyclePos < 80.5;
      if (!isStrolling) {
        // Resting cozily under overturned skiff
        catRoot.position.copy(skiffShelterPos);
        catRoot.rotation.set(0, 0.55, 0);
        // Crouched sheltering posture
        catBodyGroup.position.y = -0.04;
        catLegs.forEach((l) => (l.mesh.rotation.x = 0));
        catTailPivot.rotation.y = Math.sin(t * 1.4) * 0.35;

        // Look straight up at approaching camera when viewed closely (Shot 5 & zoom)!
        const lookAmt = sim.catLookAmount;
        if (lookAmt > 0.02) {
          tmpLookDir.subVectors(sim.cameraPos, catRoot.position);
          const worldYawToCam = Math.atan2(tmpLookDir.x, tmpLookDir.z);
          const relYaw = Math.atan2(
            Math.sin(worldYawToCam - catRoot.rotation.y),
            Math.cos(worldYawToCam - catRoot.rotation.y)
          );
          catHeadPivot.rotation.y = relYaw * 0.72 * lookAmt;
          catHeadPivot.rotation.x = -0.45 * lookAmt; // lifts chin up toward camera!
        } else {
          catHeadPivot.rotation.y = Math.sin(t * 0.8) * 0.15;
          catHeadPivot.rotation.x = 0.08;
        }
      } else {
        // Strolling varied route around the harbor quay!
        const routeIdx = Math.floor(t / 84) % catRoutes.length;
        const u = (cyclePos - 60.5) / 20.0;
        const route = catRoutes[routeIdx];
        const pos = route.getPointAt(u);
        const tan = route.getTangentAt(u);
        catRoot.position.copy(pos);
        catRoot.rotation.y = Math.atan2(tan.x, tan.z);

        // Walking stride animation
        catBodyGroup.position.y = Math.abs(Math.sin(t * 8.0)) * 0.02;
        catLegs.forEach((l) => {
          const swing = Math.sin(t * 8.0 + (l.idx % 2 === 0 ? 0 : Math.PI)) * 0.35;
          l.mesh.rotation.x = swing;
        });
        catTailPivot.rotation.y = Math.sin(t * 3.0) * 0.42;
        catHeadPivot.rotation.y = Math.sin(t * 1.6) * 0.25 * (1 - sim.catLookAmount);
        catHeadPivot.rotation.x = -0.35 * sim.catLookAmount;
      }

      // 5) Underwater Fish School (scatter outward when camera nears, regroup smoothly!)
      const scatter = sim.fishScatterAmount;
      const schoolCenterX = 11.2;
      const schoolCenterZ = 4.0;

      fishes.forEach((f) => {
        const ang = t * f.speed + f.phase;
        let x = f.centerOffsetX + Math.cos(ang) * f.radiusX;
        let z = f.centerOffsetZ + Math.sin(ang) * f.radiusZ;
        let y = f.baseY + Math.sin(t * 0.9 + f.phase) * 0.22;

        // Next point for swim tangent heading
        const ang2 = (t + 0.05) * f.speed + f.phase;
        let nx = f.centerOffsetX + Math.cos(ang2) * f.radiusX;
        let nz = f.centerOffsetZ + Math.sin(ang2) * f.radiusZ;

        // Radial scatter offset when camera inspects underwater cutaway!
        if (scatter > 0.01) {
          const sDist = scatter * (2.6 + (f.phase % 1.4));
          const sx = Math.cos(f.scatterAngle) * sDist;
          const sz = Math.sin(f.scatterAngle) * sDist;
          x = THREE.MathUtils.clamp(x + sx, 5.8, 17.8);
          z = THREE.MathUtils.clamp(z + sz, -8.4, 17.2);
          nx = x + Math.cos(f.scatterAngle) * 0.4;
          nz = z + Math.sin(f.scatterAngle) * 0.4;
        }
        // Deflect cleanly around submerged pierhead riprap berm (4.95, -11.85)
        const bx = x - 4.95;
        const bz = z + 11.85;
        const bDist = Math.hypot(bx, bz);
        if (bDist < 4.95 && bDist > 0.001) {
          x = 4.95 + (bx / bDist) * 4.95;
          z = -11.85 + (bz / bDist) * 4.95;
        }

        f.group.position.set(x, y, z);
        f.group.rotation.y = Math.atan2(nx - x, nz - z);
        f.tailPivot.rotation.y = Math.sin(t * (7.5 + scatter * 12.0) + f.phase * 3.0) * (0.34 + scatter * 0.28);
      });
    },
  };
}
