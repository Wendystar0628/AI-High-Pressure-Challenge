import * as THREE from 'three';
import { PALETTE, WORLD_CYCLE, getWindAt } from './palette.js';
import { mulberry32, clamp, lerp, smoothstep, smootherstep } from './prng.js';
import {
  createAnimeMaterial,
  addInkEdges,
  createGlassMaterial,
  SHARED_ANIME_UNIFORMS,
} from './materials.js';
import { makeNumberedTexture } from './textures.js';

export function buildPropsAndLife(scene, textures, boatsSystem, baseWaterSystem) {
  const root = new THREE.Group();
  scene.add(root);
  const rng = mulberry32(8888);

  // Materials
  const bollardMat = createAnimeMaterial({
    color: PALETTE.bollardBlack,
    wetness: 0.06, // Matte black cast-iron finish (9.3 哑光黑色)
    shadowTintStrength: 0.35,
  });
  const silverCaseMat = createAnimeMaterial({
    color: 0xc9d4d9,
    wetness: 0.55,
  });
  const chromeMat = createAnimeMaterial({
    color: 0xeef5f7,
    wetness: 0.7,
  });
  const darkTrimMat = createAnimeMaterial({
    color: 0x2a363c,
    wetness: 0.25,
  });
  const rustMetalMat = createAnimeMaterial({
    color: 0x85503c,
    wetness: 0.35,
  });
  const lampPostMat = createAnimeMaterial({
    color: 0x6f848c,
    wetness: 0.3,
  });
  const foamBoxMat = createAnimeMaterial({ color: 0xf3f8f9, wetness: 0.6 });
  const crateBlueMat = createAnimeMaterial({ color: 0x2c7ea8, wetness: 0.55 });

  // ============================================================================
  // 1. MATTE-BLACK CAST-IRON BOLLARDS & MOORING ROPES (4.2 系船柱与粗缆绳)
  // ============================================================================
  const bollardCoords = [
    [-4.32, 2.60],
    [-4.32, -0.50],
    [-4.32, -3.55],
    [-4.32, -6.50],
    [-4.32, -8.35],
    [-4.32, -10.50],
    [-4.32, -12.15],
    [-1.20, 4.32],
    [4.95, 4.32],
    [5.55, 9.85],
  ];

  const ropeCoilMat = createAnimeMaterial({ color: PALETTE.ropeOrange, wetness: 0.4 });
  for (const [bx, bz] of bollardCoords) {
    const bg = new THREE.Group();
    bg.position.set(bx, 1.65, bz);
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.36), bollardMat);
    basePlate.position.y = 0.025;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.34, 12), bollardMat);
    post.position.y = 0.19;
    post.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.11, 0.07, 12), bollardMat);
    cap.position.y = 0.37;
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.34, 8), bollardMat);
    horn.rotation.z = Math.PI / 2;
    horn.position.y = 0.28;
    addInkEdges(post, 35, 0.35);
    bg.add(basePlate, post, cap, horn);

    // 3 wrapped coils of coarse mooring rope around the bollard! (粗缆绳绕系船柱数圈)
    for (let c = 0; c < 3; c++) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.022, 6, 14), ropeCoilMat);
      wrap.rotation.x = Math.PI / 2 + (c - 1) * 0.06;
      wrap.position.y = 0.12 + c * 0.042;
      bg.add(wrap);
    }
    root.add(bg);
  }

  // Slack ropes hanging off bollards right into the harbor water with darker wet submerged ends!
  // (粗缆绳绕系船柱数圈后垂入水中，浸水部分颜色变深)
  {
    const wetRopeMat = createAnimeMaterial({
      vertexColors: true,
      wetness: 0.55,
    });
    const waterDipRopes = [
      // Foreground hero bollard (4.95, 4.32) rope tail draping over curb into harbor water!
      [
        new THREE.Vector3(4.95, 1.82, 4.22),
        new THREE.Vector3(4.98, 1.88, 3.98),
        new THREE.Vector3(5.02, 1.45, 3.91),
        new THREE.Vector3(5.05, 0.42, 3.88),
        new THREE.Vector3(5.08, -0.68, 3.85),
      ],
      [
        new THREE.Vector3(-4.22, 1.82, 2.60),
        new THREE.Vector3(-3.94, 1.86, 2.58),
        new THREE.Vector3(-3.88, 0.52, 2.54),
        new THREE.Vector3(-3.84, -0.62, 2.50),
      ],
      [
        new THREE.Vector3(-4.22, 1.82, -0.50),
        new THREE.Vector3(-3.94, 1.86, -0.46),
        new THREE.Vector3(-3.86, 0.55, -0.41),
        new THREE.Vector3(-3.82, -0.60, -0.36),
      ],
      [
        new THREE.Vector3(5.55, 1.82, 9.85),
        new THREE.Vector3(6.04, 1.86, 9.82),
        new THREE.Vector3(6.10, 0.45, 9.78),
        new THREE.Vector3(6.14, -0.65, 9.74),
      ],
      [
        new THREE.Vector3(-4.22, 1.82, -6.50),
        new THREE.Vector3(-3.94, 1.86, -6.46),
        new THREE.Vector3(-3.86, 0.48, -6.42),
        new THREE.Vector3(-3.82, -0.58, -6.38),
      ],
    ];

    const dryCol = new THREE.Color(PALETTE.ropeOrange);
    const wetCol = new THREE.Color(0x521f12); // Distinctly darker wet submerged fiber tone!

    for (const pts of waterDipRopes) {
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.026, 6, false);
      const pAttr = tubeGeo.attributes.position;
      const colors = new Float32Array(pAttr.count * 3);
      for (let i = 0; i < pAttr.count; i++) {
        const y = pAttr.getY(i);
        // Smoothly darken rope below y = +0.35 (water splash & submerged zone!)
        const wetMix = 1.0 - smoothstep(-0.15, 0.42, y);
        const c = dryCol.clone().lerp(wetCol, wetMix);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      tubeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const m = new THREE.Mesh(tubeGeo, wetRopeMat);
      root.add(m);
    }
  }

  // Dynamic Catenary Mooring Ropes connecting bollards to rocking Boats #1..#4 (10.1 缆绳时紧时松)
  const dynamicRopes = [];
  {
    const dynRopeMat = createAnimeMaterial({ vertexColors: true, wetness: 0.45 });
    const dryCol = new THREE.Color(PALETTE.ropeOrange);
    const wetCol = new THREE.Color(PALETTE.ropeWet);

    for (const b of boatsSystem.boats) {
      const segs = 14;
      const curve = new THREE.CatmullRomCurve3([
        b.bollardPos.clone(),
        b.bollardPos.clone().lerp(new THREE.Vector3(b.baseX, 0.5, b.baseZ), 0.5),
        new THREE.Vector3(b.baseX, 0.5, b.baseZ),
      ]);
      const geo = new THREE.TubeGeometry(curve, segs, 0.022, 5, false);
      const colors = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < geo.attributes.position.count; i++) {
        colors[i * 3] = dryCol.r;
        colors[i * 3 + 1] = dryCol.g;
        colors[i * 3 + 2] = dryCol.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mesh = new THREE.Mesh(geo, dynRopeMat);
      root.add(mesh);
      dynamicRopes.push({ boat: b, mesh, dryCol, wetCol });
    }
  }

  // ============================================================================
  // 2. HARBOR LAMP POSTS WITH RING SHADES & OVERHEAD POWER LINES (6 & 4.2)
  // ============================================================================
  const lampPosts = [
    { x: 4.95, z: 8.85, rotY: -Math.PI * 0.75 },   // Foreground near steps & puddle!
    { x: -4.85, z: 4.85, rotY: -Math.PI * 0.25 },  // L-corner
    { x: -4.85, z: -3.45, rotY: 0 },               // Berth #2 / Waiting room
    { x: -4.85, z: -11.65, rotY: 0 },              // Outer berth / Breakwater mouth
  ];
  const lampTopPoints = [];
  const dripSources = [];

  for (const lp of lampPosts) {
    const lg = new THREE.Group();
    lg.position.set(lp.x, 1.65, lp.z);
    lg.rotation.y = lp.rotY;

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.35, 10), lampPostMat);
    plinth.position.y = 0.175;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.095, 4.15, 10), lampPostMat);
    pole.position.y = 2.25;
    pole.castShadow = true;
    addInkEdges(pole, 35, 0.28);

    // Crossbar insulators for thin power lines
    const crossArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.56), darkTrimMat);
    crossArm.position.set(0, 3.92, 0);

    // Curved gooseneck arm + Circular Ring-Shaped Lampshade (顶端带圆环形灯罩的码头灯柱)
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 4.25, 0),
      new THREE.Vector3(0.28, 4.55, 0),
      new THREE.Vector3(0.68, 4.48, 0),
      new THREE.Vector3(0.82, 4.26, 0),
    ]);
    const armMesh = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 12, 0.025, 6, false), lampPostMat);

    // Circular ring shade + conical cap + warm glass bulb
    const shadeCap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.14, 16), lampPostMat);
    shadeCap.position.set(0.82, 4.24, 0);
    const ringShade = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.028, 8, 20), lampPostMat);
    ringShade.rotation.x = Math.PI / 2;
    ringShade.position.set(0.82, 4.16, 0);
    addInkEdges(shadeCap);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      createAnimeMaterial({ color: 0xfff8df, emissive: 0xffe6a3, emissiveIntensity: 0.45 })
    );
    bulb.position.set(0.82, 4.10, 0);

    lg.add(plinth, pole, crossArm, armMesh, shadeCap, ringShade, bulb);
    root.add(lg);

    lampTopPoints.push(new THREE.Vector3(lp.x, 1.65 + 3.92, lp.z));
    // World position of lamp shade rim for raindrop dripping!
    const shadeWorld = new THREE.Vector3(0.82, 4.14, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), lp.rotY);
    dripSources.push({
      x: lp.x + shadeWorld.x,
      y: 1.65 + shadeWorld.y,
      z: lp.z + shadeWorld.z,
      groundY: 1.65,
      isWater: false,
      period: 2.9 + rng() * 1.4,
      offset: rng() * 4.0,
    });
  }

  // Thin Overhead Power Lines slanting across the sky (4.2 纤细电线从灯柱上方斜斜穿过天空)
  {
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x354b54,
      transparent: true,
      opacity: 0.68,
    });
    // Utility pole near warehouse back & hillside
    const utilPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 6.2, 8),
      createAnimeMaterial({ color: 0x705c4a })
    );
    utilPole.position.set(-15.5, 4.6, 17.8);
    root.add(utilPole);

    const wireSpans = [
      [new THREE.Vector3(-15.5, 7.4, 17.8), lampTopPoints[0]],
      [new THREE.Vector3(-15.5, 7.3, 17.8), lampTopPoints[1]],
      [lampTopPoints[0], lampTopPoints[1]],
      [lampTopPoints[1], lampTopPoints[2]],
      [lampTopPoints[2], lampTopPoints[3]],
      [lampTopPoints[3], new THREE.Vector3(-10.8, 6.4, -13.6)],
    ];
    for (const [p0, p1] of wireSpans) {
      for (const off of [-0.16, 0.16]) {
        const a = p0.clone().add(new THREE.Vector3(off * 0.5, 0, off));
        const b = p1.clone().add(new THREE.Vector3(off * 0.5, 0, off));
        const mid = a.clone().lerp(b, 0.5);
        mid.y -= a.distanceTo(b) * 0.038; // Natural catenary sag!
        const c = new THREE.QuadraticBezierCurve3(a, mid, b);
        const pts = c.getPoints(20);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat);
        root.add(line);
      }
    }
  }

  // ============================================================================
  // 3. TRACES OF PEOPLE WHO JUST LEFT (4.3 两只银灰色乐器硬箱 + 斜靠台阶边的透明雨伞)
  // ============================================================================
  {
    // Placed side-by-side right on the foreground quay beside the concrete steps & puddle!
    // Case #1: Contoured Brushed Silver-Gray Guitar / Cello Hard-Shell Flight Case (smooth beveled ExtrudeGeometry!)
    const case1 = new THREE.Group();
    case1.position.set(3.26, 1.65, 11.02);
    case1.rotation.y = -0.34;

    const gShape = new THREE.Shape();
    gShape.moveTo(0, -0.52);
    gShape.bezierCurveTo(0.085, -0.52, 0.085, -0.42, 0.075, -0.16);
    gShape.bezierCurveTo(0.18, -0.14, 0.195, -0.02, 0.145, 0.08);
    gShape.bezierCurveTo(0.115, 0.13, 0.125, 0.18, 0.185, 0.23);
    gShape.bezierCurveTo(0.255, 0.30, 0.245, 0.49, 0.0, 0.50);
    gShape.bezierCurveTo(-0.245, 0.49, -0.255, 0.30, -0.185, 0.23);
    gShape.bezierCurveTo(-0.125, 0.18, -0.115, 0.13, -0.145, 0.08);
    gShape.bezierCurveTo(-0.195, -0.02, -0.18, -0.14, -0.075, -0.16);
    gShape.bezierCurveTo(-0.085, -0.42, -0.085, -0.52, 0, -0.52);

    const gExtrude = new THREE.ExtrudeGeometry(gShape, {
      depth: 0.125,
      bevelEnabled: true,
      bevelThickness: 0.024,
      bevelSize: 0.020,
      bevelSegments: 3,
      curveSegments: 16,
    });
    gExtrude.rotateX(Math.PI / 2);
    const case1Shell = new THREE.Mesh(gExtrude, silverCaseMat);
    case1Shell.position.y = 0.155;
    addInkEdges(case1Shell, 28, 0.42);

    // Black rubber valence gasket around lid split + chrome latches + carrying handle + band sticker
    const gSeamPts = gShape.getPoints(36).map((pt) => new THREE.Vector3(pt.x * 1.11, 0.095, pt.y * 1.045));
    const gSeamCurve = new THREE.CatmullRomCurve3(gSeamPts, true);
    const gSeam = new THREE.Mesh(new THREE.TubeGeometry(gSeamCurve, 44, 0.011, 5, true), darkTrimMat);

    const handle1 = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 10, Math.PI), darkTrimMat);
    handle1.position.set(0.175, 0.095, 0.12);
    handle1.rotation.z = -Math.PI / 2;
    handle1.rotation.y = Math.PI / 2;
    for (const [lx, lz] of [[0.098, -0.34], [0.202, -0.04], [0.245, 0.32], [-0.245, 0.32]]) {
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.044, 0.034), chromeMat);
      latch.position.set(lx, 0.095, lz);
      case1.add(latch);
    }
    const sticker = new THREE.Mesh(
      new THREE.PlaneGeometry(0.095, 0.058),
      createAnimeMaterial({ color: 0xf2c138 })
    );
    sticker.rotation.x = -Math.PI / 2;
    sticker.rotation.z = 0.35;
    sticker.position.set(-0.06, 0.181, 0.30);

    case1.add(case1Shell, gSeam, handle1, sticker);
    case1.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    root.add(case1);

    // Case #2: Contoured Silver-Gray Saxophone / Brass Hard-Shell Flight Case side-by-side! (并排放置)
    const case2 = new THREE.Group();
    case2.position.set(3.76, 1.65, 11.18);
    case2.rotation.y = -0.30;

    const sShape = new THREE.Shape();
    const hw = 0.145, hl = 0.34, cr = 0.055;
    sShape.moveTo(-hw + cr, -hl);
    sShape.lineTo(hw - cr, -hl);
    sShape.quadraticCurveTo(hw, -hl, hw, -hl + cr);
    sShape.lineTo(hw, hl - cr);
    sShape.quadraticCurveTo(hw, hl, hw - cr, hl);
    sShape.lineTo(-hw + cr, hl);
    sShape.quadraticCurveTo(-hw, hl, -hw, hl - cr);
    sShape.lineTo(-hw, -hl + cr);
    sShape.quadraticCurveTo(-hw, -hl, -hw + cr, -hl);

    const sExtrude = new THREE.ExtrudeGeometry(sShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.022,
      bevelSize: 0.018,
      bevelSegments: 3,
    });
    sExtrude.rotateX(Math.PI / 2);
    const boxBody = new THREE.Mesh(sExtrude, silverCaseMat);
    boxBody.position.y = 0.165;
    addInkEdges(boxBody, 26, 0.42);

    // Subtle molded bell contour ridge on sax case lid
    const bellContour = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.025, 14), silverCaseMat);
    bellContour.position.set(0.01, 0.192, 0.16);
    bellContour.scale.set(1.0, 1.0, 1.25);

    const trimBand = new THREE.Mesh(new THREE.BoxGeometry(0.328, 0.016, 0.716), darkTrimMat);
    trimBand.position.y = 0.095;
    const handle2 = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 6, 10, Math.PI), darkTrimMat);
    handle2.position.set(0.168, 0.095, 0);
    handle2.rotation.z = -Math.PI / 2;
    handle2.rotation.y = Math.PI / 2;
    for (const lz of [-0.20, 0.20]) {
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.044, 0.036), chromeMat);
      latch.position.set(0.168, 0.095, lz);
      case2.add(latch);
    }
    case2.add(boxBody, bellContour, trimBand, handle2);
    case2.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    root.add(case2);

    // Transparent Vinyl Umbrella leaning obliquely right against the concrete steps & handrail!
    // (一把透明雨伞斜靠在台阶边，伞面挂着雨珠，伞沿偶尔滴水)
    const umbrella = new THREE.Group();
    // Exact two-point contact: ferrule tip rests on 1st step tread (y = 1.435 at z = 10.88),
    // while upper-left canopy rim rests cleanly on top quay step edge (y = 1.651) with zero clipping!
    umbrella.position.set(4.58, 1.436, 10.88);
    umbrella.rotation.set(0.0, -0.18, 0.45);

    // Shaft + White J-hook handle + Ferrule tip
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.88, 6), chromeMat);
    shaft.position.y = 0.44;
    const handleStick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.13, 8),
      createAnimeMaterial({ color: 0xf7f9f9 })
    );
    handleStick.position.y = 0.84;
    const jHook = new THREE.Mesh(
      new THREE.TorusGeometry(0.040, 0.012, 7, 12, Math.PI),
      createAnimeMaterial({ color: 0xf7f9f9 })
    );
    jHook.position.set(-0.040, 0.90, 0);

    // Clear Dome Canopy (8-sided vinyl umbrella)
    const canopyGeo = new THREE.SphereGeometry(0.54, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.44);
    const umbGlassMat = createGlassMaterial({ tint: 0xe6f8fa, opacity: 0.23, glareStrength: 0.48 });
    const canopy = new THREE.Mesh(canopyGeo, umbGlassMat);
    canopy.rotation.x = Math.PI;
    canopy.position.y = 0.60;
    umbrella.add(shaft, handleStick, jHook, canopy);

    // White vinyl hem trim & 8 thin ribs + warm sparkling raindrop beads on canopy! (伞面挂着雨珠)
    const rimRadius = 0.54 * Math.sin(Math.PI * 0.44);
    const rimY = 0.60 - 0.54 * Math.cos(Math.PI * 0.44);
    const hemRing = new THREE.Mesh(
      new THREE.TorusGeometry(rimRadius, 0.008, 6, 8),
      createAnimeMaterial({ color: 0xf4fafa })
    );
    hemRing.rotation.x = Math.PI / 2;
    hemRing.position.y = rimY;
    umbrella.add(hemRing);

    for (let r = 0; r < 8; r++) {
      const a = (r / 8) * Math.PI * 2;
      const ribPts = [
        new THREE.Vector3(0, 0.07, 0),
        new THREE.Vector3(Math.cos(a) * rimRadius * 0.58, 0.22, Math.sin(a) * rimRadius * 0.58),
        new THREE.Vector3(Math.cos(a) * rimRadius, rimY, Math.sin(a) * rimRadius),
      ];
      const ribCurve = new THREE.QuadraticBezierCurve3(ribPts[0], ribPts[1], ribPts[2]);
      const ribLine = new THREE.Mesh(new THREE.TubeGeometry(ribCurve, 6, 0.004, 4, false), chromeMat);
      umbrella.add(ribLine);
    }

    // 44 Delicate Warm-Glinting Raindrop Beads clinging to the transparent umbrella canopy! (雨珠在阳光下呈现细小、温暖的闪光)
    const beadGeo = new THREE.SphereGeometry(0.0085, 6, 6);
    const beadMat = new THREE.MeshBasicMaterial({ color: 0xfff5c8 });
    for (let b = 0; b < 44; b++) {
      const th = 0.10 + rng() * (Math.PI * 0.41);
      const ph = rng() * Math.PI * 2;
      const bx = 0.544 * Math.sin(th) * Math.cos(ph);
      const bz = 0.544 * Math.sin(th) * Math.sin(ph);
      const by = 0.60 - 0.544 * Math.cos(th);
      const bead = new THREE.Mesh(beadGeo, beadMat);
      bead.position.set(bx, by, bz);
      bead.scale.setScalar(0.65 + rng() * 0.70);
      umbrella.add(bead);
    }
    root.add(umbrella);

    // Register umbrella rim lowest point as a periodic water droplet dripper! (伞沿偶尔滴水)
    dripSources.push({
      x: 4.86,
      y: 1.72,
      z: 10.94,
      groundY: 1.43,
      isWater: false,
      period: 2.05,
      offset: 0.45,
    });
  }

  // Also add boat gunwale raindrop drippers into harbor water! (船舷不时滴水 -> 水面同心涟漪)
  dripSources.push(
    { x: -1.55, y: 0.58, z: -1.35, groundY: 0.0, isWater: true, period: 2.4, offset: 0.9 },
    { x: -1.58, y: 0.56, z: -6.10, groundY: 0.0, isWater: true, period: 2.8, offset: 1.8 },
    { x: -0.75, y: 0.42, z: 2.45, groundY: 0.0, isWater: true, period: 3.1, offset: 2.5 }
  );

  // ============================================================================
  // 4. SECTION 6 HARBOR PROPS (鱼箱周转筐、晒网与浮球绳串、绞盘吊杆、浮标、网兜水桶、自动贩卖机、告示牌、风向袋小旗)
  // ============================================================================

  // 4a. Stacked rain-wet white foam fish boxes & blue crates around quay & warehouse
  function addOutdoorCrateCluster(cx, cz, specs) {
    const g = new THREE.Group();
    g.position.set(cx, 1.65, cz);
    for (const [ox, oz, count, isBlue, rot] of specs) {
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.86, 0.32, 0.54),
          isBlue ? crateBlueMat : foamBoxMat
        );
        m.position.set(ox + (rng() - 0.5) * 0.04, 0.16 + i * 0.325, oz + (rng() - 0.5) * 0.04);
        m.rotation.y = rot + (rng() - 0.5) * 0.08;
        m.castShadow = true;
        m.receiveShadow = true;
        addInkEdges(m, 30, 0.35);
        g.add(m);
      }
    }
    root.add(g);
  }
  addOutdoorCrateCluster(-8.1, 15.2, [
    [0, 0, 4, false, 0.1],
    [0.1, 0.65, 3, true, -0.12],
    [-0.85, 0.25, 2, false, 0.3],
  ]);
  addOutdoorCrateCluster(-5.5, 5.8, [
    [0, 0, 3, true, 0.22],
    [0.68, 0.15, 2, false, -0.18],
  ]);
  // Additional foreground-south wooden pallet with wet blue crates & coiled spare hawser to balance the wide concrete quay!
  addOutdoorCrateCluster(-11.8, 17.8, [
    [0, 0, 3, true, -0.15],
    [0.72, 0.12, 2, false, 0.25],
  ]);
  {
    const pallet = new THREE.Group();
    pallet.position.set(-4.6, 1.65, 16.4);
    pallet.rotation.y = 0.24;
    const woodMat = createAnimeMaterial({ color: 0xa48058, wetness: 0.45 });
    const basePlank = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.10, 0.95), woodMat);
    basePlank.position.y = 0.05;
    addInkEdges(basePlank);
    const hawser = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.065, 7, 14), ropeCoilMat);
    hawser.rotation.x = Math.PI / 2;
    hawser.position.set(-0.22, 0.16, 0.08);
    const spareFloat = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      createAnimeMaterial({ color: 0xee6d38, wetness: 0.5 })
    );
    spareFloat.position.set(0.28, 0.21, -0.14);
    addInkEdges(spareFloat);
    pallet.add(basePlank, hawser, spareFloat);
    pallet.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    root.add(pallet);
  }

  // 4b. Iron Drying Rack with Fishing Nets & Float-Strung Ropes (晒在铁架上的渔网，以及缀满浮球的绳串)
  const netClothPanels = [];
  const floatStrings = [];
  {
    const rack = new THREE.Group();
    rack.position.set(-7.1, 1.65, -9.4);
    rack.rotation.y = 0.15;
    // Galvanized pipe A-frames & top bar
    for (const sz of [-1.7, 1.7]) {
      for (const tilt of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 2.35, 7), lampPostMat);
        leg.position.set(tilt * 0.38, 1.12, sz);
        leg.rotation.z = tilt * 0.18;
        leg.castShadow = true;
        rack.add(leg);
      }
    }
    const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.8, 8), lampPostMat);
    topBar.rotation.x = Math.PI / 2;
    topBar.position.set(0, 2.22, 0);
    rack.add(topBar);

    // Draped Fishing Net Curtain (custom cross-hatch anime mesh shader + vertex wind billow!)
    const netGeo = new THREE.PlaneGeometry(3.2, 1.75, 16, 10);
    // Shift origin to top edge (y=0 down to -1.75) so hanging from topBar sways naturally!
    netGeo.translate(0, -0.875, 0);
    const netMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: SHARED_ANIME_UNIFORMS.uTime,
        uWind: { value: 0.25 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWind;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          float hang = 1.0 - uv.y;
          p.x += (uWind * 0.42 + sin(uTime * 3.4 + p.z * 2.2) * (0.04 + uWind * 0.14)) * hang * hang;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          // Diamond fishing net mesh pattern + natural irregular bottom hem
          float hem = 0.08 + 0.06 * sin(vUv.x * 12.0);
          if (vUv.y < hem) discard;
          vec2 dUv = vec2(vUv.x * 38.0 + vUv.y * 22.0, vUv.x * 38.0 - vUv.y * 22.0);
          vec2 g = abs(fract(dUv) - 0.5);
          float thread = 1.0 - smoothstep(0.06, 0.14, min(g.x, g.y));
          float topBorder = smoothstep(0.94, 0.97, vUv.y);
          float alpha = clamp(thread * 0.78 + topBorder * 0.9, 0.0, 0.92);
          if (alpha < 0.12) discard;
          vec3 col = mix(vec3(0.18, 0.48, 0.46), vec3(0.85, 0.46, 0.28), topBorder);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const netMesh = new THREE.Mesh(netGeo, netMat);
    netMesh.rotation.y = Math.PI / 2;
    netMesh.position.set(0, 2.20, 0);
    rack.add(netMesh);
    netClothPanels.push({ mat: netMat, wx: -7.1, wz: -9.4 });

    // Rope strung with colorful glass/plastic fishing floats! (缀满浮球的绳串)
    const floatGroup = new THREE.Group();
    floatGroup.position.set(0.08, 2.20, 0);
    const floatCols = [0xee6d38, 0x4bb5ad, 0xf2c138, 0x3b849e];
    for (let f = 0; f < 13; f++) {
      const u = f / 12;
      const fz = lerp(-1.55, 1.55, u);
      const sagY = -Math.sin(u * Math.PI) * 0.52;
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 10, 8),
        createAnimeMaterial({ color: floatCols[f % floatCols.length], wetness: 0.5 })
      );
      ball.position.set(0, sagY, fz);
      addInkEdges(ball, 40, 0.25);
      floatGroup.add(ball);
    }
    const fCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, -1.6),
      new THREE.Vector3(0, -0.58, 0),
      new THREE.Vector3(0, 0, 1.6)
    );
    const fRope = new THREE.Mesh(new THREE.TubeGeometry(fCurve, 16, 0.012, 5, false), ropeCoilMat);
    floatGroup.add(fRope);
    rack.add(floatGroup);
    floatStrings.push({ group: floatGroup, wx: -7.1, wz: -9.4 });

    root.add(rack);
  }

  // 4c. Rusty Hand-Cranked Winch & Small Davit Crane (锈迹斑斑的手摇绞盘与小型吊杆)
  {
    // Davit Crane + Winch at berth edge (-4.55, 1.65, -4.85)
    const crane = new THREE.Group();
    crane.position.set(-4.52, 1.65, -4.85);
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38), rustMetalMat);
    ped.position.y = 0.08;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.85, 8), rustMetalMat);
    mast.position.y = 1.0;
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.45, 8), rustMetalMat);
    boom.position.set(0.52, 1.98, 0);
    boom.rotation.z = -1.12;
    addInkEdges(mast);
    addInkEdges(boom);

    // Hand-cranked drum winch bolted to mast
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 10), darkTrimMat);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(-0.14, 0.85, 0);
    const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.03), rustMetalMat);
    crankArm.position.set(-0.14, 0.94, 0.16);
    const handleGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 6), rustMetalMat);
    handleGrip.rotation.x = Math.PI / 2;
    handleGrip.position.set(-0.14, 1.04, 0.22);

    // Hanging cable + hook
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.85, 5), darkTrimMat);
    cable.position.set(1.12, 1.68, 0);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.016, 6, 10, Math.PI * 1.35), rustMetalMat);
    hook.position.set(1.12, 1.22, 0);

    crane.add(ped, mast, boom, drum, crankArm, handleGrip, cable, hook);
    crane.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    root.add(crane);

    // Second rusty open-frame geared hand winch at the top-east side of the concrete boat slipway! (3.52, 1.65, 8.48)
    const slipWinch = new THREE.Group();
    slipWinch.position.set(3.52, 1.65, 8.48);
    const wBase = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.44), rustMetalMat);
    wBase.position.y = 0.025;
    addInkEdges(wBase);
    slipWinch.add(wBase);
    for (const sx of [-0.21, 0.21]) {
      for (const sz of [-0.11, 0.11]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.46, 0.055), rustMetalMat);
        leg.position.set(sx, 0.24, sz * 0.65);
        leg.rotation.x = sz > 0 ? -0.24 : 0.24;
        slipWinch.add(leg);
      }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 8), rustMetalMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(sx, 0.43, 0);
      slipWinch.add(cap);
    }
    const wAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.56, 8), darkTrimMat);
    wAxle.rotation.z = Math.PI / 2;
    wAxle.position.y = 0.43;
    const wDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.34, 12), ropeCoilMat);
    wDrum.rotation.z = Math.PI / 2;
    wDrum.position.y = 0.43;
    const wGear = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.035, 14), rustMetalMat);
    wGear.rotation.z = Math.PI / 2;
    wGear.position.set(0.25, 0.43, 0);
    addInkEdges(wGear, 25, 0.4);
    const wCrank = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.28, 0.028), darkTrimMat);
    wCrank.position.set(0.30, 0.52, 0.05);
    wCrank.rotation.x = 0.45;
    const wGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 6), rustMetalMat);
    wGrip.rotation.z = Math.PI / 2;
    wGrip.position.set(0.36, 0.63, 0.11);
    slipWinch.add(wAxle, wDrum, wGear, wCrank, wGrip);
    slipWinch.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    root.add(slipWinch);

    // Haul cable stretching from winch drum down to the inverted wooden sampan on the slipway
    const haulCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(3.52, 2.06, 8.38),
      new THREE.Vector3(3.26, 1.64, 7.86),
      new THREE.Vector3(2.98, 1.38, 7.36)
    );
    const haulCable = new THREE.Mesh(new THREE.TubeGeometry(haulCurve, 8, 0.014, 5, false), ropeCoilMat);
    haulCable.castShadow = true;
    root.add(haulCable);
  }

  // 4d. Numbered Floating Mooring Buoys in Harbor Water (涂有褪色编号的系船浮标)
  const floatingBuoys = [];
  {
    const buoyDefs = [
      { x: 5.2, z: 1.5, label: 'S-04', bg: '#e67342' },
      { x: 6.4, z: -5.6, label: 'S-12', bg: '#d99b38' },
      { x: 10.8, z: -9.2, label: 'B-08', bg: '#e06848' },
    ];
    for (const bd of buoyDefs) {
      const bg = new THREE.Group();
      bg.position.set(bd.x, 0.0, bd.z);
      const tex = makeNumberedTexture(bd.label, bd.bg, '#f7f8f2');
      const bMat = createAnimeMaterial({ color: 0xffffff, map: tex, wetness: 0.65 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, 0.48, 14), bMat);
      body.position.y = 0.12;
      body.rotation.y = -0.75; // Turn faded stencil code cleanly toward camera!
      const coneTop = new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 0.22, 14),
        createAnimeMaterial({ color: bd.bg, wetness: 0.5 })
      );
      coneTop.position.y = 0.47;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 10), rustMetalMat);
      ring.position.y = 0.62;
      addInkEdges(body, 35, 0.3);
      bg.add(body, coneTop, ring);
      root.add(bg);
      floatingBuoys.push({ group: bg, x: bd.x, z: bd.z, phase: rng() * 6.28 });
    }
  }

  // 4e. Long-Handled Landing Net & Bucket leaning against Warehouse front pier (靠在墙边的长柄网兜和水桶)
  {
    const wallProps = new THREE.Group();
    wallProps.position.set(-9.18, 1.65, 8.70); // Leaning flush against Warehouse x = -9.20 front pier!

    // Coastal blue plastic harbor bucket with water inside
    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.145, 0.34, 14),
      createAnimeMaterial({ color: 0x458fb0, wetness: 0.55 })
    );
    bucket.position.set(0.28, 0.17, 0.20);
    bucket.castShadow = true;
    addInkEdges(bucket);
    const bucketWater = new THREE.Mesh(
      new THREE.CircleGeometry(0.165, 12),
      createAnimeMaterial({ color: 0x7bc8cc, wetness: 0.9 })
    );
    bucketWater.rotation.x = -Math.PI / 2;
    bucketWater.position.set(0.28, 0.29, 0.20);
    const bail = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.01, 5, 12, Math.PI), chromeMat);
    bail.position.set(0.28, 0.32, 0.20);
    bail.rotation.x = 0.65;

    // Long-handled landing net (长柄网兜) leaning against the concrete wall with a drooping diamond-mesh net bag!
    const netPole = new THREE.Group();
    netPole.position.set(0.24, 0, -0.14);
    netPole.rotation.z = 0.12; // Top tilts toward -X so hoop rests against x = -9.20 wall!
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.021, 1.95, 7),
      createAnimeMaterial({ color: 0xb88c58 })
    );
    handle.position.y = 0.98;
    handle.castShadow = true;
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.014, 6, 18), chromeMat);
    hoop.position.set(0, 2.20, 0);
    hoop.rotation.y = Math.PI / 2 - 0.15;

    // Drooping diamond-mesh net bag hanging DOWNWARD (-Y) from the hoop!
    const bagMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          vec2 dUv = vec2(vUv.x * 18.0 + vUv.y * 14.0, vUv.x * 18.0 - vUv.y * 14.0);
          vec2 g = abs(fract(dUv) - 0.5);
          float thread = 1.0 - smoothstep(0.07, 0.18, min(g.x, g.y));
          if (thread < 0.12) discard;
          gl_FragColor = vec4(0.19, 0.50, 0.47, thread * 0.85);
        }
      `,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
    });
    const bagGeo = new THREE.CylinderGeometry(0.24, 0.06, 0.44, 12, 4, true);
    // Curve bag vertices slightly downward under gravity in local space
    const bPos = bagGeo.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
      const f = 0.5 - bPos.getY(i) / 0.44; // 0 at hoop, 1 at tip
      bPos.setX(i, bPos.getX(i) + f * 0.20);
      bPos.setY(i, bPos.getY(i) * 0.55 - f * f * 0.24);
    }
    const meshBag = new THREE.Mesh(bagGeo, bagMat);
    meshBag.position.set(0.04, 2.16, 0);
    meshBag.rotation.z = -Math.PI / 2;
    netPole.add(handle, hoop, meshBag);

    wallProps.add(bucket, bucketWater, bail, netPole);
    root.add(wallProps);
  }

  // 4f. Vending Machine with Rusty Rain Awning & Softly Glowing Lightbox (带锈蚀遮雨檐的自动贩卖机，灯箱微微发亮)
  // Mounted FLUSH against the Warehouse front-north concrete pier (x = -9.26, z in [6.8, 9.0]) so its awning stays 100% inside the wall!
  {
    const vm = new THREE.Group();
    vm.position.set(-8.86, 1.65, 7.66);

    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 1.88, 1.06),
      createAnimeMaterial({ color: 0xeaf2f4, wetness: 0.25 })
    );
    cabinet.position.y = 0.94;
    cabinet.castShadow = true;
    addInkEdges(cabinet);

    // Softly glowing front panel (灯箱微微发亮!)
    const frontFace = new THREE.Mesh(
      new THREE.PlaneGeometry(1.00, 1.80),
      createAnimeMaterial({
        color: 0xffffff,
        map: textures.vendingFront,
        emissive: 0xfff5d6,
        emissiveMap: textures.vendingFront,
        emissiveIntensity: 0.62,
      })
    );
    frontFace.rotation.y = Math.PI / 2;
    frontFace.position.set(0.386, 0.94, 0);

    // Subtle warm glow light from vending machine onto wet quay pavement
    const vmGlow = new THREE.PointLight(0xfff1c4, 0.72, 3.8, 1.6);
    vmGlow.position.set(0.78, 1.15, 0);

    // Rusted Corrugated Rain Awning bolted flush into the Warehouse wall overhead (带锈蚀遮雨檐)
    const awning = new THREE.Group();
    awning.position.set(0.14, 2.06, 0);
    const roofSheet = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.05, 1.34), rustMetalMat);
    roofSheet.rotation.z = -0.22;
    addInkEdges(roofSheet);
    for (const sz of [-0.58, 0.58]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.04, 0.04), rustMetalMat);
      bracket.position.set(-0.14, -0.14, sz);
      bracket.rotation.z = 0.34;
      awning.add(bracket);
    }
    awning.add(roofSheet);

    // Companion Bottle/Can Recycling Bin right next to vending machine
    const recycleBin = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.72, 0.34),
      createAnimeMaterial({ color: 0x3b86a1, wetness: 0.35 })
    );
    recycleBin.position.set(-0.08, 0.36, 0.76);
    addInkEdges(recycleBin);

    vm.add(cabinet, frontFace, vmGlow, awning, recycleBin);
    root.add(vm);
  }

  // 4g. Faded Signboard with Harbor Name & "注意落水" (写有港名和“注意落水”的褪色告示牌)
  {
    const signGroup = new THREE.Group();
    signGroup.position.set(5.15, 1.65, 10.15); // Right near foreground steps & boats!
    signGroup.rotation.y = -0.52;

    for (const sx of [-0.46, 0.46]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 1.55, 8), rustMetalMat);
      post.position.set(sx, 0.77, 0);
      post.castShadow = true;
      signGroup.add(post);
    }
    const backing = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.86, 0.04), rustMetalMat);
    backing.position.y = 1.18;
    addInkEdges(backing);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 0.82),
      createAnimeMaterial({ color: 0xffffff, map: textures.harborSign, wetness: 0.3 })
    );
    face.position.set(0, 1.18, 0.025);
    const faceBack = face.clone();
    faceBack.rotation.y = Math.PI;
    faceBack.position.z = -0.025;
    signGroup.add(backing, face, faceBack);
    root.add(signGroup);
  }

  // 4h. Windsock & Small Harbor Flags blown askew by Sea Breeze (被海风吹得歪斜的风向袋与小旗)
  const windItems = [];
  {
    // Windsock near breakwater entrance (-4.6, 1.65, -13.35)
    const wsGroup = new THREE.Group();
    wsGroup.position.set(-4.6, 1.65, -13.35);
    const wsPole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.04, 3.65, 8), lampPostMat);
    wsPole.position.y = 1.82;
    wsGroup.add(wsPole);

    const sockPivot = new THREE.Group();
    sockPivot.position.y = 3.58;
    // 5 alternating orange & white conical segments
    const sockOrange = createAnimeMaterial({ color: PALETTE.lifebuoyOrange });
    const sockWhite = createAnimeMaterial({ color: 0xf7fafa });
    const sockSegs = [];
    for (let s = 0; s < 5; s++) {
      const r0 = lerp(0.16, 0.075, s / 5);
      const r1 = lerp(0.16, 0.075, (s + 1) / 5);
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(r1, r0, 0.22, 10, 1, true),
        s % 2 === 0 ? sockOrange : sockWhite
      );
      seg.rotation.z = Math.PI / 2;
      seg.position.x = -0.14 - s * 0.21;
      sockPivot.add(seg);
      sockSegs.push(seg);
    }
    wsGroup.add(sockPivot);
    root.add(wsGroup);
    windItems.push({ type: 'windsock', pivot: sockPivot, segs: sockSegs, wx: -4.6, wz: -13.35 });

    // Small Harbor Flags (on breakwater + near slipway!)
    const flagSpots = [
      { x: 3.8, y: 1.82, z: -14.95, col: 0xf2c138, h: 1.85 },
      { x: -1.2, y: 1.82, z: -14.95, col: 0xe8643c, h: 1.75 },
      { x: 0.95, y: 1.65, z: 8.45, col: 0x3da8a5, h: 1.95 },
    ];
    for (const fs of flagSpots) {
      const fg = new THREE.Group();
      fg.position.set(fs.x, fs.y, fs.z);
      fg.rotation.z = 0.07; // Slightly tilted pole from coastal wind!
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, fs.h, 6), lampPostMat);
      pole.position.y = fs.h * 0.5;
      fg.add(pole);

      const bannerGeo = new THREE.PlaneGeometry(0.56, 0.32, 6, 2);
      bannerGeo.translate(-0.28, 0, 0);
      const bannerMat = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: {
          uTime: SHARED_ANIME_UNIFORMS.uTime,
          uWind: { value: 0.3 },
          uColor: { value: new THREE.Color(fs.col) },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uWind;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            float dist = 1.0 - uv.x;
            p.z += sin(uTime * (6.5 + uWind * 6.0) - dist * 5.0) * (0.04 + uWind * 0.11) * dist;
            p.y -= (1.0 - clamp(uWind * 1.4, 0.0, 0.85)) * 0.16 * dist;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            // Triangular swallowtail/pennant cut
            if (abs(vUv.y - 0.5) > 0.5 * vUv.x + 0.06) discard;
            gl_FragColor = vec4(uColor, 1.0);
          }
        `,
      });
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.y = fs.h - 0.18;
      fg.add(banner);
      root.add(fg);
      windItems.push({ type: 'flag', banner, mat: bannerMat, wx: fs.x, wz: fs.z });
    }
  }

  // ============================================================================
  // 5. SEAGULLS (10.5 & 10.6 码头上空盘旋滑翔、掠过水面、停歇海鸥在镜头推近时扑翅飞走)
  // ============================================================================
  const whiteBirdMat = createAnimeMaterial({ color: 0xf7fbfc });
  const grayWingMat = createAnimeMaterial({ color: 0x8ea6b0 });
  const beakMat = createAnimeMaterial({ color: 0xf0ad38 });

  function createSeagullRig() {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), whiteBirdMat);
    body.scale.set(0.85, 0.82, 1.75);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 6), whiteBirdMat);
    head.position.set(0, 0.075, -0.15);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.085, 5), beakMat);
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0.068, -0.23);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.14, 4), grayWingMat);
    tail.rotation.x = Math.PI / 2;
    tail.scale.set(1.1, 1.0, 0.3);
    tail.position.set(0, 0.01, 0.20);
    bird.add(body, head, beak, tail);

    const leftWing = new THREE.Group();
    leftWing.position.set(-0.06, 0.04, -0.02);
    const lwInner = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.018, 0.13), whiteBirdMat);
    lwInner.position.set(-0.14, 0, 0);
    const lwTip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.095), grayWingMat);
    lwTip.position.set(-0.36, -0.01, 0.03);
    lwTip.rotation.y = 0.25;
    leftWing.add(lwInner, lwTip);

    const rightWing = new THREE.Group();
    rightWing.position.set(0.06, 0.04, -0.02);
    const rwInner = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.018, 0.13), whiteBirdMat);
    rwInner.position.set(0.14, 0, 0);
    const rwTip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.095), grayWingMat);
    rwTip.position.set(0.36, -0.01, 0.03);
    rwTip.rotation.y = -0.25;
    rightWing.add(rwInner, rwTip);

    // Folded wings mesh for perched state! (收起翅膀)
    const foldedWings = new THREE.Group();
    for (const sx of [-1, 1]) {
      const fw = new THREE.Mesh(new THREE.SphereGeometry(0.085, 7, 5), grayWingMat);
      fw.scale.set(0.45, 0.72, 1.85);
      fw.position.set(sx * 0.068, 0.02, 0.04);
      foldedWings.add(fw);
    }
    bird.add(leftWing, rightWing, foldedWings);

    return { bird, leftWing, rightWing, foldedWings, head };
  }

  // 5 Soaring / Skimming Seagulls in the harbor sky
  const flyingSeagulls = [];
  const orbitDefs = [
    { cx: 3.5, cz: 2.0, rx: 8.5, rz: 7.2, baseY: 6.8, swoopY: 2.2, speed: 0.34, phase: 0.0 },
    { cx: 5.5, cz: -3.5, rx: 9.2, rz: 6.5, baseY: 7.6, swoopY: 0.65, speed: 0.29, phase: 2.1 }, // Skims low over water!
    { cx: -1.5, cz: 4.5, rx: 7.5, rz: 6.8, baseY: 6.2, swoopY: 3.4, speed: 0.38, phase: 4.2 },
    { cx: 7.2, cz: -8.5, rx: 6.8, rz: 5.8, baseY: 8.2, swoopY: 1.2, speed: 0.31, phase: 1.1 },
    { cx: 1.5, cz: -1.0, rx: 10.2, rz: 8.4, baseY: 9.0, swoopY: 4.8, speed: 0.26, phase: 5.0 },
  ];
  for (const od of orbitDefs) {
    const rig = createSeagullRig();
    rig.foldedWings.visible = false;
    root.add(rig.bird);
    flyingSeagulls.push({ ...od, rig });
  }

  // 4 Perched Seagulls (on foreground bollard, inner bollard, Boat #3 cabin roof railing, and floating on water!)
  const perchedSeagulls = [];
  const perchDefs = [
    { id: 'bollardHero', pos: new THREE.Vector3(4.95, 2.11, 4.32), rotY: 0.55, onWater: false },
    { id: 'bollardInner', pos: new THREE.Vector3(-4.32, 2.11, 2.60), rotY: 1.25, onWater: false },
    {
      id: 'cabinRail',
      pos: new THREE.Vector3(-1.88, 1.92, -6.65),
      rotY: 1.35,
      onWater: false,
      boatCabinRef: boatsSystem.boats[2] ? boatsSystem.boats[2].cabin : null,
      cabinLocal: new THREE.Vector3(0.635, 1.705, -0.35),
    },
    { id: 'waterFloat', pos: new THREE.Vector3(8.2, 0.09, 4.6), rotY: -0.7, onWater: true },
  ];
  for (const pd of perchDefs) {
    const rig = createSeagullRig();
    rig.bird.position.copy(pd.pos);
    rig.bird.rotation.y = pd.rotY;
    root.add(rig.bird);
    perchedSeagulls.push({
      ...pd,
      rig,
      takeoffStart: -999,
      wasClose: false,
    });
  }

  // ============================================================================
  // 6. HARBOR CAT (10.5 & 10.6 舢板下避雨、雨疏时沿不同路线走动、雨密前跑回、镜头推近时抬头看镜头)
  // ============================================================================
  const catRig = (() => {
    const cat = new THREE.Group();
    const furGinger = createAnimeMaterial({ color: 0xe3944c });
    const furStripe = createAnimeMaterial({ color: 0xb8662a });
    const furWhite = createAnimeMaterial({ color: 0xf7f5ef });
    const eyeIris = new THREE.MeshBasicMaterial({ color: 0x3b7a5e });
    const eyePupil = new THREE.MeshBasicMaterial({ color: 0x162422 });
    const eyeCatch = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const nosePink = createAnimeMaterial({ color: 0xe88a84 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.22, 6, 10), furGinger);
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.17;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.092, 8, 6), furWhite);
    chest.position.set(0, 0.165, 0.10);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.23, 0.17);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), furWhite);
    const gingerCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.0908, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
      furGinger
    );
    gingerCap.rotation.x = -0.25;
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), furWhite);
    muzzle.scale.set(1.2, 0.85, 0.9);
    muzzle.position.set(0, -0.018, 0.072);
    const stripeMid = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.006, 0.036), furStripe);
    stripeMid.position.set(0, 0.052, 0.056);
    stripeMid.rotation.x = 0.56;
    headPivot.add(muzzle, stripeMid);

    // Delicate anime cat whiskers on both cheeks
    const whiskerMat = new THREE.LineBasicMaterial({ color: 0x627378, transparent: true, opacity: 0.65 });
    for (const sx of [-1, 1]) {
      for (const wy of [-0.010, -0.020]) {
        const wPts = [
          new THREE.Vector3(sx * 0.035, wy, 0.075),
          new THREE.Vector3(sx * 0.095, wy + (wy + 0.015) * 0.6, 0.068),
        ];
        headPivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wPts), whiskerMat));
      }
    }

    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.082, 4), furGinger);
      ear.position.set(sx * 0.052, 0.084, -0.008);
      ear.rotation.z = -sx * 0.28;
      const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.021, 0.052, 3), nosePink);
      innerEar.position.set(sx * 0.050, 0.078, 0.008);
      innerEar.rotation.z = -sx * 0.28;

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), eyeIris);
      eye.scale.set(1.0, 1.08, 0.55);
      eye.position.set(sx * 0.036, 0.012, 0.078);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.010, 6, 6), eyePupil);
      pupil.scale.set(0.65, 1.15, 0.6);
      pupil.position.set(sx * 0.036, 0.012, 0.085);
      const catchLight = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 5, 5), eyeCatch);
      catchLight.position.set(sx * 0.032, 0.018, 0.089);
      headPivot.add(ear, innerEar, eye, pupil, catchLight);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), nosePink);
    nose.position.set(0, -0.006, 0.092);
    headPivot.add(head, gingerCap, nose);

    const legs = [];
    for (const [lx, lz] of [[-0.05, 0.10], [0.05, 0.10], [-0.05, -0.10], [0.05, -0.10]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.15, 6), furWhite);
      leg.position.set(lx, 0.075, lz);
      cat.add(leg);
      legs.push(leg);
    }

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.19, -0.18);
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.08, -0.09),
      new THREE.Vector3(0.03, 0.18, -0.13),
    ]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 8, 0.018, 6, false), furGinger);
    tailPivot.add(tail);

    cat.add(body, chest, headPivot, tailPivot);
    cat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    root.add(cat);
    return { cat, body, headPivot, legs, tailPivot };
  })();

  // 3 distinct quay stroll routes starting & ending right under the upside-down wooden sampan! (每趟不同)
  // Sampan shelter spot on the slipway: (2.56, 0.75, 6.18) -> walks up slipway to (2.15, 1.65, 8.30) -> quay!
  const catRoutes = [
    // Route 0 (used in cycle 0): Emerges onto slipway top, strolls gracefully beside the puddle, returns!
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(2.56, 0.75, 6.18),
      new THREE.Vector3(2.22, 1.18, 7.15),
      new THREE.Vector3(1.95, 1.65, 8.20),
      new THREE.Vector3(0.75, 1.65, 8.95),
      new THREE.Vector3(0.35, 1.65, 10.05),
      new THREE.Vector3(0.95, 1.65, 8.85),
      new THREE.Vector3(1.95, 1.65, 8.20),
      new THREE.Vector3(2.22, 1.18, 7.15),
      new THREE.Vector3(2.56, 0.75, 6.18),
    ]),
    // Route 1: Walks up slipway, turns left toward L-corner bollards & boat #1, trots back!
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(2.56, 0.75, 6.18),
      new THREE.Vector3(2.22, 1.18, 7.15),
      new THREE.Vector3(2.15, 1.65, 8.30),
      new THREE.Vector3(0.20, 1.65, 6.80),
      new THREE.Vector3(-1.85, 1.65, 5.10),
      new THREE.Vector3(-0.40, 1.65, 7.20),
      new THREE.Vector3(2.15, 1.65, 8.30),
      new THREE.Vector3(2.22, 1.18, 7.15),
      new THREE.Vector3(2.56, 0.75, 6.18),
    ]),
    // Route 2: Walks up slipway, trots over to sniff the blue fish crates at (-5.2, 5.8), runs back!
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(2.56, 0.75, 6.18),
      new THREE.Vector3(2.22, 1.18, 7.15),
      new THREE.Vector3(2.15, 1.65, 8.30),
      new THREE.Vector3(-1.40, 1.65, 7.60),
      new THREE.Vector3(-4.65, 1.65, 6.15),
      new THREE.Vector3(-1.80, 1.65, 7.90),
      new THREE.Vector3(2.15, 1.65, 8.30),
      new THREE.Vector3(2.22, 1.18, 7.15),
      new THREE.Vector3(2.56, 0.75, 6.18),
    ]),
  ];

  // ============================================================================
  // 7. SUNSHOWER WEATHER VFX: GOLDEN RAIN STREAKS, DRIPPING BEADS, FAINT RAINBOW
  // ============================================================================

  // 7a. Sunshower Golden Slanted Rain Streaks (8.1 细雨持续斜落，在阳光中表现为带暖金色微光的短线)
  const RAIN_COUNT = 1550;
  const rainUniforms = {
    uTime: SHARED_ANIME_UNIFORMS.uTime,
    uDensity: { value: 0.6 },
    uWindTilt: { value: 0.16 },
    uCloudCenter: SHARED_ANIME_UNIFORMS.uCloudCenter,
    uCloudStrength: SHARED_ANIME_UNIFORMS.uCloudStrength,
    uSkyDimming: SHARED_ANIME_UNIFORMS.uSkyDimming,
  };
  {
    const positions = new Float32Array(RAIN_COUNT * 2 * 3);
    const seeds = new Float32Array(RAIN_COUNT * 2 * 4);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const rx = (rng() - 0.5) * 39.0;
      const ry = rng() * 18.0;
      const rz = (rng() - 0.5) * 39.0;
      const rank = rng(); // Used for smooth rainDensity filtering!
      const spd = 11.5 + rng() * 4.5;
      for (let end = 0; end < 2; end++) {
        const idx = i * 2 + end;
        positions[idx * 3] = rx;
        positions[idx * 3 + 1] = ry;
        positions[idx * 3 + 2] = rz;
        seeds[idx * 4] = end; // 0 = top of streak, 1 = bottom of streak
        seeds[idx * 4 + 1] = rank;
        seeds[idx * 4 + 2] = spd;
        seeds[idx * 4 + 3] = rng();
      }
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    rainGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));

    const rainMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: rainUniforms,
      vertexShader: `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform float uDensity;
        uniform float uWindTilt;
        varying float vVisible;
        varying float vGold;
        varying vec3 vWorldPos;

        void main() {
          float isTail = aSeed.x;
          float rank = aSeed.y;
          float speed = aSeed.z;

          vVisible = smoothstep(rank - 0.08, rank + 0.08, uDensity);

          vec3 wp = position;
          float fall = mod(wp.y - uTime * speed, 18.5) - 0.5;
          // Slight horizontal drift along sea breeze (-X, +Z)
          wp.x = mod(wp.x - uTime * speed * uWindTilt + 19.5, 39.0) - 19.5;
          wp.z = mod(wp.z + uTime * speed * (uWindTilt * 0.65) + 19.5, 39.0) - 19.5;
          wp.y = fall;

          float streakLen = 0.54 + uDensity * 0.22;
          if (isTail > 0.5) {
            wp.y -= streakLen;
            wp.x -= streakLen * uWindTilt;
            wp.z += streakLen * (uWindTilt * 0.65);
          }

          vWorldPos = wp;
          vGold = aSeed.w;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uCloudCenter;
        uniform float uCloudStrength;
        uniform float uSkyDimming;
        varying float vVisible;
        varying float vGold;
        varying vec3 vWorldPos;

        void main() {
          if (vVisible < 0.02 || vWorldPos.y < 0.05) discard;
          // Clip rain strictly outside roofed interiors & under the wooden sampan shelter!
          if (vWorldPos.x > -18.35 && vWorldPos.x < -9.05 && vWorldPos.z > 6.65 && vWorldPos.z < 16.95 && vWorldPos.y < 5.95) discard;
          if (vWorldPos.x > -16.75 && vWorldPos.x < -9.25 && vWorldPos.z > -6.15 && vWorldPos.z < 1.95 && vWorldPos.y < 5.15) discard;
          if (vWorldPos.x > 2.30 && vWorldPos.x < 3.55 && vWorldPos.z > 4.95 && vWorldPos.z < 7.45 && vWorldPos.y < 1.22) discard;

          float cloudAxis = -0.75 * vWorldPos.x + 0.66 * vWorldPos.z;
          float cloudDim = (1.0 - smoothstep(4.0, 15.0, abs(cloudAxis - uCloudCenter))) * uCloudStrength * 0.7;
          float sunFactor = clamp(1.0 - cloudDim - uSkyDimming * 0.6, 0.25, 1.0);

          // Linear-space warm golden sunshower glint mixed with delicate sky-silver!
          vec3 coolRain = vec3(0.62, 0.85, 0.90);
          vec3 warmGold = vec3(1.18, 0.88, 0.36);
          vec3 col = mix(coolRain, warmGold, (0.58 + 0.42 * vGold) * sunFactor);
          float alpha = vVisible * (0.20 + 0.24 * sunFactor);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.frustumCulled = false;
    rainLines.renderOrder = 6;
    root.add(rainLines);
  }

  // 7b. Falling Water Droplet Meshes from Umbrella Rim, Lamp Ring Shades & Boat Gunwales!
  const dropMeshes = [];
  {
    const dropGeo = new THREE.SphereGeometry(0.022, 6, 6);
    dropGeo.scale(0.8, 1.6, 0.8);
    const dropMat = new THREE.MeshBasicMaterial({
      color: 0xfff7d6,
      transparent: true,
      opacity: 0.85,
    });
    for (const src of dripSources) {
      const m = new THREE.Mesh(dropGeo, dropMat);
      root.add(m);
      dropMeshes.push({ mesh: m, src, lastCycle: -1 });
    }
  }

  // 7c. Faint Cel-Shaded Anime Rainbow over Outer Harbor (10.4 海面上空浮现一道极淡的彩虹，片刻后淡去)
  const rainbowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        if (uOpacity < 0.004) discard;
        vec2 p = vec2(vUv.x * 2.0 - 1.0, vUv.y);
        float r = length(p);
        if (r < 0.72 || r > 0.94 || p.y < 0.02) discard;

        float bandT = (r - 0.72) / 0.22; // 0 = inner violet, 1 = outer warm coral
        // Linear-space soft anime watercolor spectral palette so it reads delicately against pale cyan sky
        vec3 c1 = vec3(0.42, 0.50, 0.92);
        vec3 c2 = vec3(0.30, 0.80, 0.78);
        vec3 c3 = vec3(0.56, 0.88, 0.45);
        vec3 c4 = vec3(0.96, 0.82, 0.34);
        vec3 c5 = vec3(0.96, 0.45, 0.38);

        vec3 col = mix(c1, c2, smoothstep(0.05, 0.30, bandT));
        col = mix(col, c3, smoothstep(0.30, 0.52, bandT));
        col = mix(col, c4, smoothstep(0.52, 0.74, bandT));
        col = mix(col, c5, smoothstep(0.74, 0.94, bandT));

        float radialFade = smoothstep(0.72, 0.77, r) * (1.0 - smoothstep(0.89, 0.94, r));
        float footFade = smoothstep(0.02, 0.35, p.y);
        gl_FragColor = vec4(col, radialFade * footFade * uOpacity * 1.15);
      }
    `,
  });
  {
    const rbPlane = new THREE.Mesh(new THREE.PlaneGeometry(26.0, 13.0), rainbowMat);
    rbPlane.position.set(6.8, 3.2, -18.2);
    rbPlane.rotation.y = -0.32; // Facing front-right camera & arching in the sky above harbor sea!
    rbPlane.renderOrder = 5;
    root.add(rbPlane);
  }

  // ============================================================================
  // PER-FRAME DETERMINISTIC UPDATE
  // ============================================================================
  const tmpBowWorld = new THREE.Vector3();

  function update(t, weather, cameraPos, isExportTour) {
    // 1. Update dynamic catenary mooring ropes (tightening/slackening as boats rock; hiding when Boat #4 sails!)
    for (const dr of dynamicRopes) {
      const b = dr.boat;
      if (b.id === 4 && !b.isMoored) {
        dr.mesh.visible = false;
        continue;
      }
      dr.mesh.visible = true;
      b.group.updateMatrixWorld();
      tmpBowWorld.copy(b.bowLocal).applyMatrix4(b.group.matrixWorld);

      const dist = b.bollardPos.distanceTo(tmpBowWorld);
      // Shorter distance = more slack sag! (时紧时松)
      const slack = clamp(0.45 - (dist - 2.1) * 0.22, 0.08, 0.52);
      const mid = b.bollardPos.clone().lerp(tmpBowWorld, 0.5);
      mid.y -= slack;

      const curve = new THREE.QuadraticBezierCurve3(b.bollardPos, mid, tmpBowWorld);
      const newGeo = new THREE.TubeGeometry(curve, 12, 0.021, 5, false);
      const pAttr = newGeo.attributes.position;
      const colors = new Float32Array(pAttr.count * 3);
      for (let i = 0; i < pAttr.count; i++) {
        const y = pAttr.getY(i);
        const wetMix = 1.0 - smoothstep(0.05, 0.65, y);
        const c = dr.dryCol.clone().lerp(dr.wetCol, wetMix);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      newGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      dr.mesh.geometry.dispose();
      dr.mesh.geometry = newGeo;
    }

    // 2. Update wind-sensitive nets, float strings, windsock & flags along spatial gust path! (10.2)
    for (const np of netClothPanels) {
      const w = getWindAt(np.wx, np.wz, t, weather);
      np.mat.uniforms.uWind.value = w.strength;
    }
    for (const fs of floatStrings) {
      const w = getWindAt(fs.wx, fs.wz, t, weather);
      fs.group.rotation.z = w.strength * 0.28 + Math.sin(t * 3.2) * (0.03 + w.gustOnly * 0.09);
    }
    for (const wi of windItems) {
      const w = getWindAt(wi.wx, wi.wz, t, weather);
      if (wi.type === 'windsock') {
        wi.pivot.rotation.y = Math.atan2(w.dirZ, -w.dirX) + Math.sin(t * 2.5) * 0.08;
        wi.pivot.rotation.z = -(0.55 - clamp(w.strength * 0.55, 0.0, 0.48));
        wi.segs.forEach((seg, idx) => {
          seg.position.y = Math.sin(t * 6.5 - idx * 0.7) * (0.012 + w.gustOnly * 0.028);
        });
      } else if (wi.type === 'flag') {
        wi.mat.uniforms.uWind.value = w.strength;
        wi.banner.rotation.y = Math.atan2(w.dirZ, -w.dirX);
      }
    }

    // 3. Update floating numbered mooring buoys (waves + Boat #4 sequential wake!)
    for (const fb of floatingBuoys) {
      const wake = boatsSystem.getWakeDisturbanceAt(fb.x, fb.z, t);
      fb.group.position.y = Math.sin(t * 1.45 + fb.phase) * 0.045 + wake * 0.11;
      fb.group.rotation.z = Math.sin(t * 1.6 + fb.phase) * 0.09 + wake * 0.26;
      fb.group.rotation.x = Math.cos(t * 1.3 + fb.phase) * 0.08 + wake * 0.18;
    }

    // 4. Update soaring & skimming seagulls
    for (const sg of flyingSeagulls) {
      const a = t * sg.speed + sg.phase;
      const bx = clamp(sg.cx + Math.cos(a) * sg.rx, -18.5, 18.5);
      const bz = clamp(sg.cz + Math.sin(a * 1.0) * sg.rz, -18.5, 18.5);
      // Periodically glide low toward swoopY over open water, while clearing the breakwater cleanly!
      const swoopFactor = Math.pow(0.5 + 0.5 * Math.sin(a * 0.5 + sg.phase), 2.0);
      let by = lerp(sg.swoopY, sg.baseY, swoopFactor);
      if (bz < -12.2 && bx < 10.6) {
        by = Math.max(by, 2.95);
      }

      const tx = -Math.sin(a) * sg.rx;
      const tz = Math.cos(a) * sg.rz;
      sg.rig.bird.position.set(bx, by, bz);
      sg.rig.bird.rotation.order = 'YXZ';
      sg.rig.bird.rotation.y = Math.atan2(-tx, -tz);
      sg.rig.bird.rotation.z = 0.24; // Graceful banking turn!

      // Flap while climbing, hold wings steady while gliding!
      const isClimbing = Math.cos(a * 0.5 + sg.phase) > 0.15;
      const flap = isClimbing
        ? Math.sin(t * 8.5 + sg.phase) * 0.52
        : 0.12 + Math.sin(t * 1.8 + sg.phase) * 0.05;
      sg.rig.leftWing.rotation.z = -flap;
      sg.rig.rightWing.rotation.z = flap;
    }

    // 5. Update perched seagulls + camera-proximity takeoff! (10.6 镜头推近时，停歇的海鸥扑翅飞走)
    for (const ps of perchedSeagulls) {
      if (ps.boatCabinRef) {
        ps.boatCabinRef.updateMatrixWorld();
        ps.pos.copy(ps.cabinLocal).applyMatrix4(ps.boatCabinRef.matrixWorld);
      }
      let flyElapsed = -1;
      if (isExportTour && ps.id === 'bollardHero') {
        // Deterministic takeoff during Shot 3 (10.5..15.0s) right at t = 12.1s!
        if (t >= 12.1 && t <= 20.5) {
          flyElapsed = t - 12.1;
        }
      } else if (!isExportTour && cameraPos) {
        const d = cameraPos.distanceTo(ps.pos);
        const close = d < 6.8;
        if (close && !ps.wasClose && t - ps.takeoffStart > 8.5) {
          ps.takeoffStart = t;
        }
        ps.wasClose = close;
        if (t >= ps.takeoffStart && t - ps.takeoffStart < 8.0) {
          flyElapsed = t - ps.takeoffStart;
        }
      }

      if (flyElapsed >= 0) {
        // Spread wings, flap briskly, arc up into sky, and circle back cleanly!
        ps.rig.foldedWings.visible = false;
        ps.rig.leftWing.visible = true;
        ps.rig.rightWing.visible = true;

        const outBack = Math.sin(clamp(flyElapsed / 8.0, 0, 1) * Math.PI);
        const ang = flyElapsed * 1.15;
        ps.rig.bird.position.set(
          ps.pos.x + Math.sin(ang) * 4.2 * outBack,
          ps.pos.y + 3.6 * outBack,
          ps.pos.z - Math.cos(ang) * 3.8 * outBack + 3.8 * outBack
        );
        ps.rig.bird.rotation.y = ps.rotY + ang;
        const flap = Math.sin(t * 12.5) * 0.62;
        ps.rig.leftWing.rotation.z = -flap;
        ps.rig.rightWing.rotation.z = flap;
      } else {
        // Resting calmly with folded wings!
        ps.rig.foldedWings.visible = true;
        ps.rig.leftWing.visible = false;
        ps.rig.rightWing.visible = false;
        const bobY = ps.onWater ? Math.sin(t * 1.4) * 0.04 : 0;
        ps.rig.bird.position.set(ps.pos.x, ps.pos.y + bobY, ps.pos.z);
        ps.rig.bird.rotation.y = ps.rotY;
        ps.rig.head.rotation.y = Math.sin(t * 1.3 + ps.pos.x) * 0.32;
      }
    }

    // 6. Update Harbor Cat (10.5 & 10.6 舢板下避雨 -> 雨疏时沿不同路线走动 -> 雨变密前跑回 -> 看镜头!)
    {
      const tc = weather.tc;
      const cycleIdx = Math.max(0, Math.floor(t / WORLD_CYCLE));
      const route = catRoutes[cycleIdx % catRoutes.length];

      // Outing window: tc in [8.8, 20.2] (emerges when rain eases, strolls quay, and trots back under sampan by 20.2s before rain thickens!)
      if (tc >= 8.8 && tc <= 20.2) {
        let u;
        if (tc < 15.2) {
          u = lerp(0.0, 0.52, smootherstep(8.8, 15.2, tc));
        } else if (tc < 17.6) {
          u = lerp(0.52, 0.58, smoothstep(15.2, 17.6, tc)); // Lingering & sniffing quay!
        } else {
          u = lerp(0.58, 0.96, smootherstep(17.6, 20.2, tc)); // Trotting briskly back to sampan before rain thickens!
        }

        const pos = route.getPointAt(clamp(u, 0, 0.999999));
        const tan = route.getTangentAt(clamp(u, 0.001, 0.999));
        catRig.cat.position.copy(pos);
        catRig.cat.rotation.y = Math.atan2(tan.x, tan.z);

        const isTrottingBack = tc >= 17.6;
        const isPaused = tc >= 15.4 && tc < 17.5;
        const strideFreq = isTrottingBack ? 15.0 : 8.2;
        const strideAmp = isPaused ? 0.0 : (isTrottingBack ? 0.55 : 0.36);

        catRig.legs.forEach((l) => { l.position.y = 0.075; });
        catRig.legs[0].rotation.x = Math.sin(t * strideFreq) * strideAmp;
        catRig.legs[1].rotation.x = -Math.sin(t * strideFreq) * strideAmp;
        catRig.legs[2].rotation.x = -Math.sin(t * strideFreq) * strideAmp;
        catRig.legs[3].rotation.x = Math.sin(t * strideFreq) * strideAmp;
        catRig.body.position.y = 0.17 + (isPaused ? 0 : Math.abs(Math.sin(t * strideFreq)) * 0.015);
      } else {
        // Sheltering dry & cozy right under the propped-open west gunwale of the upside-down wooden sampan!
        catRig.cat.position.set(2.56, 0.75, 6.18);
        catRig.cat.rotation.y = -1.32; // Facing out across the slipway toward the harbor & camera!
        catRig.legs.forEach((l) => {
          l.position.y = 0.048;
          l.rotation.x = 1.48; // Tucked neatly beneath loaf body with zero poke-through!
        });
        catRig.body.position.y = 0.13;
      }

      catRig.tailPivot.rotation.y = Math.sin(t * 2.4) * 0.35;

      // Look up at camera when watched! (10.6 镜头推近时，港猫抬头看一眼镜头)
      let lookBlend = 0;
      if (isExportTour && t >= 20.0 && t <= 24.5) {
        lookBlend = smoothstep(20.3, 21.1, t) * (1.0 - smoothstep(23.5, 24.3, t));
      } else if (cameraPos) {
        const dCat = cameraPos.distanceTo(catRig.cat.position);
        lookBlend = 1.0 - smoothstep(5.5, 8.5, dCat);
      }

      if (lookBlend > 0.02 && cameraPos) {
        const toCam = cameraPos.clone().sub(catRig.cat.position);
        const worldYaw = Math.atan2(toCam.x, toCam.z);
        let relYaw = worldYaw - catRig.cat.rotation.y;
        while (relYaw > Math.PI) relYaw -= Math.PI * 2;
        while (relYaw < -Math.PI) relYaw += Math.PI * 2;
        relYaw = clamp(relYaw, -1.05, 1.05);
        const pitchUp = clamp(Math.atan2(toCam.y - 0.25, Math.hypot(toCam.x, toCam.z)), 0.08, 0.65);

        catRig.headPivot.rotation.y = relYaw * lookBlend;
        catRig.headPivot.rotation.x = -pitchUp * lookBlend;
      } else {
        catRig.headPivot.rotation.y = Math.sin(t * 1.2) * 0.14;
        catRig.headPivot.rotation.x = 0.05;
      }
    }

    // 7. Update Sunshower Rain Streaks, Falling Drips & Rainbow!
    rainUniforms.uDensity.value = weather.rainDensity;
    rainUniforms.uWindTilt.value = 0.15 + weather.gust1Active * 0.26; // 雨丝更斜 during gusts!
    rainbowMat.uniforms.uOpacity.value = weather.rainbowOpacity;

    // Update dripping water droplets (umbrella rim, lamp shades, boat gunwales)
    for (const dm of dropMeshes) {
      const s = dm.src;
      const localT = (t + s.offset) % s.period;
      const cycleNum = Math.floor((t + s.offset) / s.period);
      const fallDur = 0.55;
      if (localT < 0.45) {
        // Swelling bead clinging to edge before falling!
        dm.mesh.visible = true;
        dm.mesh.position.set(s.x, s.y, s.z);
        dm.mesh.scale.setScalar(0.35 + (localT / 0.45) * 0.55);
      } else if (localT < 0.45 + fallDur) {
        const ft = (localT - 0.45) / fallDur;
        const dropY = lerp(s.y, s.groundY, ft * ft);
        dm.mesh.visible = true;
        dm.mesh.position.set(s.x, dropY, s.z);
        dm.mesh.scale.set(0.7, 1.45, 0.7);
      } else {
        dm.mesh.visible = false;
        if (s.isWater && dm.lastCycle !== cycleNum) {
          dm.lastCycle = cycleNum;
          baseWaterSystem.spawnWaterRipple(s.x, s.z, 0.85, t);
        }
      }
    }
  }

  return {
    root,
    catRig,
    perchedSeagulls,
    update,
  };
}
