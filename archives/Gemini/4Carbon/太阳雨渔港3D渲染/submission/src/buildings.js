import * as THREE from 'three';
import { PALETTE, getWindAt } from './palette.js';
import { mulberry32, clamp, lerp } from './prng.js';
import {
  createAnimeMaterial,
  addInkEdges,
  createGlassMaterial,
  createSunbeamMaterial,
  createCausticsMaterial,
  SHARED_ANIME_UNIFORMS,
} from './materials.js';

export function buildBuildingsAndBackground(scene, textures) {
  const root = new THREE.Group();
  scene.add(root);
  const rng = mulberry32(2026);

  // Shared architectural materials
  const wallCreamMat = createAnimeMaterial({ color: 0xebf0ee, wetness: 0.15 });
  const wallMintMat = createAnimeMaterial({ color: 0xdcebea, wetness: 0.15 });
  const wallConcreteMat = createAnimeMaterial({ color: 0xd2dcde, wetness: 0.25 });
  const roofSlateMat = createAnimeMaterial({ color: 0x5c737f, wetness: 0.55 });
  const roofKawaraMat = createAnimeMaterial({ color: 0xffffff, map: textures.kawaraTiles, wetness: 0.5 });
  const shutterMat = createAnimeMaterial({ color: 0x9eb1b8, wetness: 0.25 });
  const steelFrameMat = createAnimeMaterial({ color: 0x455861, wetness: 0.2 });
  const woodWarmMat = createAnimeMaterial({ color: PALETTE.woodWarm, wetness: 0.1 });
  const woodDarkMat = createAnimeMaterial({ color: 0x735338, wetness: 0.1 });
  const glassMat = createGlassMaterial({ tint: 0xd9f4f7, opacity: 0.18, glareStrength: 0.34 });

  // ============================================================================
  // 1. FISHERY COOPERATIVE WAREHOUSE (7.1 渔协仓库)
  // Footprint: x in [-18.2, -9.2], z in [6.8, 16.8], floor y = 1.67
  // ============================================================================
  const warehouse = new THREE.Group();
  warehouse.position.set(-13.7, 1.66, 11.8); // Local center (width X = 9.0, length Z = 10.0)
  root.add(warehouse);

  // Interior wet concrete floor
  const whFloor = new THREE.Mesh(
    new THREE.BoxGeometry(8.9, 0.08, 9.9),
    createAnimeMaterial({ color: 0xbfcace, wetness: 0.65, roughPatch: 0.6 })
  );
  whFloor.position.y = 0.02;
  whFloor.receiveShadow = true;
  warehouse.add(whFloor);

  // Back wall (-X, local x = -4.4)
  const whBackWall = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.6, 10.0), wallConcreteMat);
  whBackWall.position.set(-4.39, 2.3, 0);
  whBackWall.castShadow = true;
  whBackWall.receiveShadow = true;
  addInkEdges(whBackWall);
  warehouse.add(whBackWall);

  // North wall (-Z, local z = -4.9) with high clerestory windows
  const whNorthLow = new THREE.Mesh(new THREE.BoxGeometry(9.0, 3.2, 0.22), wallConcreteMat);
  whNorthLow.position.set(0, 1.6, -4.89);
  whNorthLow.castShadow = true;
  whNorthLow.receiveShadow = true;
  addInkEdges(whNorthLow);
  warehouse.add(whNorthLow);

  const whNorthTop = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.55, 0.22), wallConcreteMat);
  whNorthTop.position.set(0, 4.32, -4.89);
  warehouse.add(whNorthTop);

  // South wall (+Z, local z = +4.9) with high clerestory window + side window so interior is bright & visible!
  const whSouthLeft = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.3, 0.22), wallConcreteMat);
  whSouthLeft.position.set(-2.9, 1.65, 4.89);
  addInkEdges(whSouthLeft);
  warehouse.add(whSouthLeft);

  const whSouthRight = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.3, 0.22), wallConcreteMat);
  whSouthRight.position.set(3.2, 1.65, 4.89);
  addInkEdges(whSouthRight);
  warehouse.add(whSouthRight);

  const whSouthSill = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 0.22), wallConcreteMat);
  whSouthSill.position.set(0.3, 0.55, 4.89);
  warehouse.add(whSouthSill);

  const whSouthGlass = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.1), glassMat);
  whSouthGlass.position.set(0.3, 2.15, 4.89);
  warehouse.add(whSouthGlass);

  const whSouthTop = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.55, 0.22), wallConcreteMat);
  whSouthTop.position.set(0, 4.32, 4.89);
  warehouse.add(whSouthTop);

  // Clerestory window glass strips (y = 3.2..4.05 -> world y = 4.86..5.71)
  for (const sz of [-4.89, 4.89]) {
    const cg = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 0.85), glassMat);
    cg.position.set(0, 3.62, sz);
    warehouse.add(cg);
    for (let mx = -3; mx <= 3; mx += 2) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.88, 0.08), steelFrameMat);
      mullion.position.set(mx, 3.62, sz);
      warehouse.add(mullion);
    }
  }

  // Front wall (+X, local x = +4.4) with WIDE doorway (z in [-2.8, +2.8], height 3.85m)
  // Left pier (z in [-5.0, -2.8]) & Right pier (z in [+2.8, +5.0])
  for (const [pz, pw] of [[-3.9, 2.2], [3.9, 2.2]]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.6, pw), wallConcreteMat);
    pier.position.set(4.38, 2.3, pz);
    pier.castShadow = true;
    pier.receiveShadow = true;
    addInkEdges(pier);
    warehouse.add(pier);
  }
  // Upper lintel above doorway (y = 3.85..4.6, with clerestory transoms!)
  const whFrontLintel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 5.6), wallConcreteMat);
  whFrontLintel.position.set(4.38, 4.21, 0);
  addInkEdges(whFrontLintel);
  warehouse.add(whFrontLintel);

  // Fishery Co-op Signboard above doorway ("汐見漁業協同組合 荷捌所")
  const coopSignMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.72, 3.6),
    createAnimeMaterial({ color: 0xffffff, map: textures.coopSign })
  );
  coopSignMesh.position.set(4.53, 4.24, 0);
  addInkEdges(coopSignMesh);
  warehouse.add(coopSignMesh);

  // HALF-RAISED CORRUGATED ROLLER SHUTTER DOOR (仓库卷帘门半拉起，露出内部空间)
  // Doorway height is 0..3.82m; shutter hangs from 3.82 down to 2.36m (~62% open so interior is super clear!)
  {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 5.75), shutterMat);
    hood.position.set(4.46, 3.82, 0);
    addInkEdges(hood);
    warehouse.add(hood);

    const shutterH = 1.44;
    const slatCount = 12;
    const slatH = shutterH / slatCount;
    for (let s = 0; s < slatCount; s++) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.06 + (s % 2) * 0.02, slatH - 0.01, 5.54),
        shutterMat
      );
      slat.position.set(4.42, 3.65 - s * slatH, 0);
      slat.castShadow = true;
      warehouse.add(slat);
    }
    // Bottom steel bar + pull cord of the half-raised roller shutter
    const botBar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 5.56), steelFrameMat);
    botBar.position.set(4.42, 3.65 - shutterH, 0);
    warehouse.add(botBar);
  }

  // Gabled Steel Roof + Gables + Eaves Overhang
  {
    const roofPitch = 0.30;
    for (const side of [-1, 1]) {
      const slope = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.14, 10.6), roofSlateMat);
      slope.position.set(side * 2.35, 5.22, 0);
      slope.rotation.z = -side * roofPitch;
      slope.castShadow = true;
      slope.receiveShadow = true;
      addInkEdges(slope);
      warehouse.add(slope);
    }
    // Triangular gable end fillers at z = -4.89 and +4.89
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-4.5, 4.6);
    gableShape.lineTo(4.5, 4.6);
    gableShape.lineTo(0, 5.95);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.18, bevelEnabled: false });
    for (const gz of [-4.98, 4.80]) {
      const gm = new THREE.Mesh(gableGeo, wallConcreteMat);
      gm.position.z = gz;
      warehouse.add(gm);
    }

    // Interior ceiling soffit & rafters + Animated Water Caustics swaying on the warehouse ceiling!
    const ceilingSoffit = new THREE.Mesh(
      new THREE.PlaneGeometry(8.6, 9.6),
      createAnimeMaterial({ color: 0xaabec4, side: THREE.DoubleSide })
    );
    ceilingSoffit.rotation.x = Math.PI / 2;
    ceilingSoffit.position.set(0, 4.18, 0);
    warehouse.add(ceilingSoffit);

    for (let rz = -3.6; rz <= 3.6; rz += 2.4) {
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.14, 0.12), steelFrameMat);
      rafter.position.set(0, 4.10, rz);
      warehouse.add(rafter);
    }

    const ceilingCaustic = new THREE.Mesh(
      new THREE.PlaneGeometry(8.0, 9.0),
      createCausticsMaterial(0.45)
    );
    ceilingCaustic.rotation.x = Math.PI / 2;
    ceilingCaustic.position.set(0.1, 4.15, 0);
    warehouse.add(ceilingCaustic);

    // Subtle upper-wall caustic bounce so caustics also shimmer right above the chalkboard!
    const upperWallCaustic = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 0.95),
      createCausticsMaterial(0.28)
    );
    upperWallCaustic.rotation.y = Math.PI / 2;
    upperWallCaustic.position.set(-4.26, 3.72, 0);
    warehouse.add(upperWallCaustic);
  }

  // Warm high-key interior bounce light so warehouse interior is clearly visible
  const whLight = new THREE.PointLight(0xfff6dd, 1.6, 13.0, 1.2);
  whLight.position.set(0.8, 3.6, 0.0);
  warehouse.add(whLight);

  // --- Warehouse Interior Props (7.1: 鱼箱、冰柜、磅秤、墙上雨靴、拍卖价格黑板、地面水渍与散落冰块、高窗淡金色光柱) ---
  {
    const foamWhiteMat = createAnimeMaterial({ color: 0xf4f9fa, wetness: 0.35 });
    const foamStripeMat = createAnimeMaterial({ color: 0x3f8fb0, wetness: 0.35 });
    const crateBlueMat = createAnimeMaterial({ color: 0x2e7ca6, wetness: 0.4 });
    const crateTealMat = createAnimeMaterial({ color: 0x3b9690, wetness: 0.4 });

    function makeFishBoxStack(lx, lz, count, isBlue = false, rotY = 0) {
      const g = new THREE.Group();
      g.position.set(lx, 0.06, lz);
      g.rotation.y = rotY;
      for (let i = 0; i < count; i++) {
        const bx = new THREE.Mesh(
          new THREE.BoxGeometry(0.92, 0.34, 0.58),
          isBlue ? (i % 2 === 0 ? crateBlueMat : crateTealMat) : foamWhiteMat
        );
        bx.position.set((rng() - 0.5) * 0.05, 0.17 + i * 0.345, (rng() - 0.5) * 0.05);
        bx.rotation.y = (rng() - 0.5) * 0.08;
        bx.castShadow = true;
        bx.receiveShadow = true;
        addInkEdges(bx, 30, 0.36);
        g.add(bx);
        if (!isBlue) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(0.93, 0.06, 0.59), foamStripeMat);
          band.position.copy(bx.position);
          band.rotation.y = bx.rotation.y;
          g.add(band);
        }
      }
      warehouse.add(g);
    }

    // Stacks of fish boxes clearly visible right through the half-raised shutter!
    makeFishBoxStack(-1.2, -1.6, 5, false, 0.12);
    makeFishBoxStack(-1.2, -0.85, 4, false, -0.05);
    makeFishBoxStack(-2.2, -1.3, 6, true, 0.08);
    makeFishBoxStack(-0.2, 2.2, 4, false, 0.25);
    makeFishBoxStack(-1.3, 2.4, 5, true, -0.15);
    makeFishBoxStack(1.4, -2.5, 3, false, 0.32);

    // 2 Commercial Chest Freezers (冰柜) along north/back interior
    const freezerBodyMat = createAnimeMaterial({ color: 0xe6eff0, wetness: 0.15 });
    const freezerLidMat = createAnimeMaterial({ color: 0xf7fbfb, wetness: 0.2 });
    for (const [fx, fz] of [[-2.9, 0.8], [-2.9, 2.8]]) {
      const fg = new THREE.Group();
      fg.position.set(fx, 0.06, fz);
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.96, 1.72), freezerBodyMat);
      body.position.y = 0.48;
      addInkEdges(body);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.10, 1.76), freezerLidMat);
      lid.position.y = 1.01;
      addInkEdges(lid);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.42), steelFrameMat);
      handle.position.set(0.61, 0.96, 0);
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.06, 0.14),
        new THREE.MeshBasicMaterial({ color: 0x52f2c2 })
      );
      led.position.set(0.58, 0.22, 0.62);
      fg.add(body, lid, handle, led);
      warehouse.add(fg);
    }

    // Platform Dial Weighing Scale (磅秤) right near the center-front workspace!
    {
      const sg = new THREE.Group();
      sg.position.set(1.15, 0.06, 0.35);
      sg.rotation.y = 0.35;
      const scaleGreen = createAnimeMaterial({ color: 0x4b7a70, wetness: 0.2 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.88), scaleGreen);
      base.position.y = 0.08;
      addInkEdges(base);
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.05, 0.76),
        createAnimeMaterial({ color: 0xd8e4e6, wetness: 0.5 })
      );
      tray.position.set(0.04, 0.19, 0);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.18, 8), scaleGreen);
      pillar.position.set(-0.30, 0.72, 0);
      const dialHead = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.12, 18), scaleGreen);
      dialHead.rotation.z = Math.PI / 2;
      dialHead.position.set(-0.28, 1.38, 0);
      addInkEdges(dialHead);
      const dialFace = new THREE.Mesh(
        new THREE.CircleGeometry(0.26, 18),
        createAnimeMaterial({ color: 0xffffff, map: textures.clockDial })
      );
      dialFace.rotation.y = Math.PI / 2;
      dialFace.position.set(-0.21, 1.38, 0);
      const needle = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.20, 0.02),
        new THREE.MeshBasicMaterial({ color: 0xd9483b })
      );
      needle.position.set(-0.20, 1.43, 0.04);
      needle.rotation.x = 0.65;
      sg.add(base, tray, pillar, dialHead, dialFace, needle);
      warehouse.add(sg);
    }

    // Auction Price Blackboard on the back wall facing straight out the open roller door! (黑板上写着拍卖价格)
    {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.75, 2.75), woodDarkMat);
      frame.position.set(-4.22, 2.35, -0.6);
      addInkEdges(frame);
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(2.58, 1.58),
        createAnimeMaterial({ color: 0xffffff, map: textures.auctionBlackboard })
      );
      board.rotation.y = Math.PI / 2;
      board.position.set(-4.16, 2.35, -0.6);
      warehouse.add(frame, board);
    }

    // Rubber Rain Boots hanging on wall pegs (墙上挂着雨靴 — hung upside down on pegs!)
    {
      const rackBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 1.8), woodWarmMat);
      rackBar.position.set(-4.22, 1.55, -3.1);
      warehouse.add(rackBar);

      const bootColors = [0xf0c238, 0x2c566e, 0x3b8a7e];
      bootColors.forEach((col, bIdx) => {
        const bMat = createAnimeMaterial({ color: col, wetness: 0.45 });
        for (const pairOff of [-0.14, 0.14]) {
          const bz = -3.65 + bIdx * 0.56 + pairOff;
          const boot = new THREE.Group();
          boot.position.set(-4.12, 1.52, bz);
          boot.rotation.x = (pairOff < 0 ? 0.05 : -0.04);
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.42, 8), bMat);
          shaft.position.y = -0.22;
          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.15), bMat);
          foot.position.set(0.05, 0.02, 0);
          boot.add(shaft, foot);
          warehouse.add(boot);
        }
      });
    }

    // Reflective Water Stains & Scattered Ice Cubes on Warehouse Floor (地面有反光水渍与散落冰块)
    {
      const stainMat = new THREE.MeshBasicMaterial({
        color: 0xaedce3,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      for (const [sx, sz, r1, r2] of [[0.6, -0.8, 1.3, 0.9], [1.5, 0.9, 1.1, 0.8], [-0.4, 1.5, 1.2, 0.85]]) {
        const st = new THREE.Mesh(new THREE.CircleGeometry(1.0, 18), stainMat);
        st.rotation.x = -Math.PI / 2;
        st.scale.set(r1, r2, 1);
        st.position.set(sx, 0.068, sz);
        warehouse.add(st);
      }

      const iceGeo = new THREE.BoxGeometry(0.11, 0.085, 0.11);
      const iceMat = createAnimeMaterial({
        color: 0xdff8fc,
        transparent: true,
        opacity: 0.78,
        wetness: 0.9,
      });
      const iceInst = new THREE.InstancedMesh(iceGeo, iceMat, 42);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < 42; i++) {
        const cluster = i % 3;
        const cx = cluster === 0 ? 0.2 : cluster === 1 ? 1.2 : -0.5;
        const cz = cluster === 0 ? -1.0 : cluster === 1 ? 0.6 : 1.7;
        dummy.position.set(cx + (rng() - 0.5) * 1.3, 0.09, cz + (rng() - 0.5) * 1.2);
        dummy.rotation.set(rng() * 0.4, rng() * Math.PI, rng() * 0.4);
        const s = 0.65 + rng() * 0.85;
        dummy.scale.set(s, s * 0.8, s);
        dummy.updateMatrix();
        iceInst.setMatrixAt(i, dummy.matrix);
      }
      warehouse.add(iceInst);
    }

    // Pale-golden Volumetric Sunbeams slanting in from high clerestory windows! (高窗允许阳光穿入，室内有可见的淡金色光柱)
    const beamMat = createSunbeamMaterial(0.19);
    for (const bz of [-2.4, 0.2, 2.6]) {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 5.4), beamMat);
      beam.position.set(1.1, 2.25, bz);
      beam.rotation.z = 0.52;
      beam.rotation.y = 0.28;
      warehouse.add(beam);
      // Cross-plane so volumetric shaft is visible from ALL camera angles!
      const beam2 = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 5.4), beamMat);
      beam2.position.copy(beam.position);
      beam2.rotation.z = 0.52;
      beam2.rotation.y = -0.95;
      warehouse.add(beam2);
    }

    // Exterior Sunbeams slanting down from cloud gaps onto warehouse high windows & harbor boats! (8.2)
    const extBeamMat = createSunbeamMaterial(0.11);
    const extBeamSpots = [
      [-9.8, 7.2, 11.5, 2.8, 10.5],  // Slanting onto Fishery Co-op high windows
      [-2.2, 5.4, -1.6, 2.4, 9.5],   // Slanting across Boat #2 cabin glass
      [-1.8, 5.6, -7.2, 2.2, 9.5],   // Slanting across Boat #3 cabin glass
      [2.5, 5.8, 9.5, 2.6, 10.2],    // Slanting across foreground puddle & umbrella
    ];
    for (const [bx, by, bz, bw, bh] of extBeamSpots) {
      const eb = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), extBeamMat);
      eb.position.set(bx, by, bz);
      eb.rotation.z = 0.52;
      eb.rotation.y = 0.62;
      root.add(eb);
    }
  }

  // ============================================================================
  // 2. FERRY WAITING ROOM (7.2 候船室: 落地玻璃窗、木长椅、褪色时刻表、老式收音机、热水壶与绿萝、略微歪斜的挂钟)
  // Footprint: x in [-16.6, -9.4], z in [-6.0, +1.8], floor y = 1.68
  // ============================================================================
  const waitingRoom = new THREE.Group();
  waitingRoom.position.set(-13.0, 1.66, -2.1); // Width X = 7.2, Length Z = 7.8
  root.add(waitingRoom);

  // Warm clean terrazzo floor
  const wrFloor = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.12, 7.8),
    createAnimeMaterial({ color: 0xe4e5dc, wetness: 0.15 })
  );
  wrFloor.position.y = 0.06;
  wrFloor.receiveShadow = true;
  addInkEdges(wrFloor);
  waitingRoom.add(wrFloor);

  // Solid Back Wall (-X, local x = -3.5) & North Wall (-Z, local z = -3.8)
  const wrBack = new THREE.Mesh(new THREE.BoxGeometry(0.20, 3.2, 7.8), wallCreamMat);
  wrBack.position.set(-3.5, 1.72, 0);
  wrBack.castShadow = true;
  wrBack.receiveShadow = true;
  addInkEdges(wrBack);
  waitingRoom.add(wrBack);

  const wrNorth = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.2, 0.20), wallMintMat);
  wrNorth.position.set(0, 1.72, -3.8);
  wrNorth.castShadow = true;
  wrNorth.receiveShadow = true;
  addInkEdges(wrNorth);
  waitingRoom.add(wrNorth);

  // FLOOR-TO-CEILING GLASS WINDOWS (+X front wall at x = +3.5, and +Z south wall at z = +3.8!)
  // Thin corner & mullion posts + open sliding glass door on +X!
  for (const [px, pz] of [[3.5, -3.8], [3.5, 3.8], [-3.5, 3.8], [3.5, -1.3], [3.5, 1.3], [0.0, 3.8]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.2, 0.14), steelFrameMat);
    post.position.set(px, 1.72, pz);
    waitingRoom.add(post);
  }
  // Low 0.18m threshold kickplate + top transom rail
  const frontTopRail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 7.8), steelFrameMat);
  frontTopRail.position.set(3.5, 3.22, 0);
  waitingRoom.add(frontTopRail);

  const southTopRail = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.22, 0.16), steelFrameMat);
  southTopRail.position.set(0, 3.22, 3.8);
  waitingRoom.add(southTopRail);

  // Floor-to-ceiling clear glass panes (+X north pane, +X south pane, leaving center doorway open, plus +Z full glass!)
  const fgPane1 = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 2.95), glassMat);
  fgPane1.rotation.y = Math.PI / 2;
  fgPane1.position.set(3.5, 1.62, -2.55);
  const fgPane2 = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 2.95), glassMat);
  fgPane2.rotation.y = Math.PI / 2;
  fgPane2.position.set(3.5, 1.62, 2.55);
  // Open sliding glass door leaf slid slightly back
  const fgDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.85), glassMat);
  fgDoor.rotation.y = Math.PI / 2;
  fgDoor.position.set(3.44, 1.58, -1.45);
  const doorFrame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.04, 2.85, 1.35)),
    new THREE.LineBasicMaterial({ color: 0x455861 })
  );
  doorFrame.position.copy(fgDoor.position);

  const sgPane = new THREE.Mesh(new THREE.PlaneGeometry(6.9, 2.95), glassMat);
  sgPane.position.set(0, 1.62, 3.8);
  waitingRoom.add(fgPane1, fgPane2, fgDoor, doorFrame, sgPane);

  // Overhanging flat/hipped coastal roof + Ferry Signboard
  const wrRoof = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.26, 8.8), roofSlateMat);
  wrRoof.position.set(0.15, 3.45, 0);
  wrRoof.castShadow = true;
  wrRoof.receiveShadow = true;
  addInkEdges(wrRoof);
  waitingRoom.add(wrRoof);

  const ferrySignMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.58, 3.2),
    createAnimeMaterial({ color: 0xffffff, map: textures.ferrySign })
  );
  ferrySignMesh.position.set(4.26, 3.46, 0);
  addInkEdges(ferrySignMesh);
  waitingRoom.add(ferrySignMesh);

  // Interior soft ceiling light so everything inside the waiting room shines clearly
  const wrLight = new THREE.PointLight(0xfff5db, 1.35, 10.5, 1.2);
  wrLight.position.set(0.2, 2.85, 0);
  waitingRoom.add(wrLight);

  // --- Waiting Room Interior Props (7.2) ---
  // 1) Wooden Benches (木长椅 — slatted warm cedar seat, backrest & armrests!)
  function addWoodenBench(lx, lz, rotY) {
    const bg = new THREE.Group();
    bg.position.set(lx, 0.12, lz);
    bg.rotation.y = rotY;
    for (let s = 0; s < 3; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.055, 2.26), woodWarmMat);
      slat.position.set(-0.17 + s * 0.17, 0.45, 0);
      addInkEdges(slat, 25, 0.36);
      bg.add(slat);
    }
    for (let b = 0; b < 2; b++) {
      const bSlat = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 2.26), woodWarmMat);
      bSlat.position.set(-0.24 - b * 0.025, 0.66 + b * 0.21, 0);
      bSlat.rotation.z = 0.12;
      addInkEdges(bSlat, 25, 0.36);
      bg.add(bSlat);
    }
    for (const sz of [-1.04, 1.04]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.08), woodDarkMat);
      arm.position.set(-0.02, 0.64, sz);
      addInkEdges(arm, 25, 0.36);
      bg.add(arm);
    }
    for (const sz of [-0.96, 0, 0.96]) {
      const legF = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.44, 0.07), woodDarkMat);
      legF.position.set(0.20, 0.22, sz);
      const legB = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.92, 0.07), woodDarkMat);
      legB.position.set(-0.23, 0.46, sz);
      bg.add(legF, legB);
    }
    waitingRoom.add(bg);
  }
  addWoodenBench(-1.15, -1.65, 0);
  addWoodenBench(-1.15, 1.55, 0);
  addWoodenBench(1.15, -2.55, -Math.PI / 2);

  // 2) Faded Ferry Timetable on the wall (墙上贴着褪色的航班时刻表)
  const timetable = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 1.78),
    createAnimeMaterial({ color: 0xffffff, map: textures.ferryTimetable })
  );
  timetable.rotation.y = Math.PI / 2;
  timetable.position.set(-3.38, 1.92, -1.55);
  waitingRoom.add(timetable);

  // 3) Slightly Crooked Wall Clock (墙上的挂钟略微歪斜 — octagonal Showa wooden clock hanging askew from a nail & cord!)
  const clockGroup = new THREE.Group();
  clockGroup.position.set(-3.36, 2.48, 0.05);
  clockGroup.rotation.order = 'YXZ';
  clockGroup.rotation.y = Math.PI / 2;
  clockGroup.rotation.z = -0.19; // Unmistakably crooked octagonal frame & dial!
  const clockRim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.07, 8), woodDarkMat);
  clockRim.rotation.x = Math.PI / 2;
  clockRim.rotation.y = Math.PI / 8;
  addInkEdges(clockRim, 20, 0.42);
  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.31, 20),
    createAnimeMaterial({ color: 0xffffff, map: textures.clockDial })
  );
  clockFace.position.z = 0.04;
  const hourHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.16, 0.01),
    new THREE.MeshBasicMaterial({ color: 0x26353b })
  );
  hourHand.position.set(0.05, -0.04, 0.05);
  hourHand.rotation.z = -2.35; // ~4:15 PM after school!
  const minHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.24, 0.01),
    new THREE.MeshBasicMaterial({ color: 0x26353b })
  );
  minHand.position.set(0.09, 0.01, 0.055);
  minHand.rotation.z = -1.48;
  clockGroup.add(clockRim, clockFace, hourHand, minHand);
  waitingRoom.add(clockGroup);

  // Brass wall nail + asymmetrical V-cord above the crooked clock!
  const clockNail = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), steelFrameMat);
  clockNail.position.set(-3.38, 2.94, -0.01);
  const cordLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-3.38, 2.75, 0.22),
      new THREE.Vector3(-3.38, 2.94, -0.01),
      new THREE.Vector3(-3.38, 2.81, -0.18),
    ]),
    new THREE.LineBasicMaterial({ color: 0x455861 })
  );
  waitingRoom.add(clockNail, cordLine);

  // 4) Wooden Side Counter + Vintage Analog Radio (老式收音机 — centered in gap between benches so 100% unobstructed!)
  {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.02, 1.18), woodWarmMat);
    counter.position.set(-2.90, 0.63, -0.02);
    addInkEdges(counter);
    waitingRoom.add(counter);

    const radio = new THREE.Group();
    radio.position.set(-2.80, 1.29, -0.02);
    radio.rotation.y = 0.18;
    const rBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.30, 0.48),
      createAnimeMaterial({ color: 0x8b5638 })
    );
    addInkEdges(rBody);
    const rGrille = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.21, 0.25),
      createAnimeMaterial({ color: 0xd8d0be })
    );
    rGrille.position.set(0.12, -0.01, -0.07);
    const rDial = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.085, 0.15),
      new THREE.MeshBasicMaterial({ color: 0xffe89e })
    );
    rDial.position.set(0.12, 0.06, 0.12);
    for (const ky of [-0.03, -0.09]) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 10), steelFrameMat);
      knob.rotation.z = Math.PI / 2;
      knob.position.set(0.13, ky, 0.12);
      radio.add(knob);
    }
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.009, 0.56, 6),
      createAnimeMaterial({ color: 0xdce6e8 })
    );
    antenna.position.set(-0.04, 0.37, -0.14);
    antenna.rotation.x = 0.32;
    radio.add(rBody, rGrille, rDial, antenna);
    waitingRoom.add(radio);
  }

  // 5) Corner Stand with Hot Water Kettle & Potted Pothos Plant (角落有热水壶和一盆绿萝 — raised cleanly above bench!)
  {
    const cornerTable = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.98, 0.92), woodWarmMat);
    cornerTable.position.set(-2.84, 0.61, 3.16);
    addInkEdges(cornerTable);
    waitingRoom.add(cornerTable);

    // Japanese electric hot-water thermos kettle (热水壶)
    const kettle = new THREE.Group();
    kettle.position.set(-2.72, 1.10, 2.90);
    const kBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.155, 0.38, 14),
      createAnimeMaterial({ color: 0xf4f5ef, wetness: 0.2 })
    );
    kBody.position.y = 0.19;
    addInkEdges(kBody);
    const kLid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.145, 0.055, 14),
      createAnimeMaterial({ color: 0xc9cfc9 })
    );
    kLid.position.y = 0.40;
    const kHandle = new THREE.Mesh(
      new THREE.TorusGeometry(0.10, 0.016, 6, 12, Math.PI),
      createAnimeMaterial({ color: 0xc9cfc9 })
    );
    kHandle.position.set(0, 0.41, 0);
    const kSpout = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.06), steelFrameMat);
    kSpout.position.set(0.145, 0.34, 0);
    const kLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6f47 })
    );
    kLight.position.set(0.15, 0.15, 0.03);
    kettle.add(kBody, kLid, kHandle, kSpout, kLight);
    waitingRoom.add(kettle);

    // Potted Pothos Plant with cascading heart-shaped leaves (一盆绿萝)
    const pothos = new THREE.Group();
    pothos.position.set(-2.86, 1.10, 3.38);
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.13, 0.26, 12),
      createAnimeMaterial({ color: 0xc47352 })
    );
    pot.position.y = 0.13;
    addInkEdges(pot);
    pothos.add(pot);

    const leafMat1 = createAnimeMaterial({ color: 0x4ca368, side: THREE.DoubleSide });
    const leafMat2 = createAnimeMaterial({ color: 0x72c47c, side: THREE.DoubleSide });
    const leafGeo = new THREE.SphereGeometry(0.085, 7, 5);
    leafGeo.scale(1.25, 0.22, 0.95);

    // Bushy top leaves + 3 trailing vines hanging over the corner table edge!
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const r = 0.04 + (i % 3) * 0.06;
      const lf = new THREE.Mesh(leafGeo, i % 2 === 0 ? leafMat1 : leafMat2);
      lf.position.set(Math.cos(ang) * r, 0.28 + (i % 4) * 0.04, Math.sin(ang) * r);
      lf.rotation.set((rng() - 0.5) * 0.6, ang, (rng() - 0.5) * 0.6);
      pothos.add(lf);
    }
    // Cascading pothos vines
    for (let v = 0; v < 3; v++) {
      const vx = 0.16 + v * 0.03;
      const vz = -0.08 + v * 0.09;
      for (let k = 0; k < 5; k++) {
        const lf = new THREE.Mesh(leafGeo, (v + k) % 2 === 0 ? leafMat1 : leafMat2);
        lf.position.set(vx + k * 0.035, 0.22 - k * 0.095, vz + Math.sin(k + v) * 0.03);
        lf.rotation.set(0.4, v * 0.5, -0.65);
        lf.scale.setScalar(0.85 - k * 0.08);
        pothos.add(lf);
      }
    }
    waitingRoom.add(pothos);
  }

  // ============================================================================
  // 3. SHORT BREAKWATER RED & WHITE LIGHTHOUSE (2.2 & 10.3 小型红白相间灯塔)
  // Located at (x = 8.45, y = 1.82, z = -14.3)
  // ============================================================================
  const lighthouse = new THREE.Group();
  lighthouse.position.set(8.45, 1.82, -14.3);
  root.add(lighthouse);

  const lhRedMat = createAnimeMaterial({ color: PALETTE.lighthouseRed, wetness: 0.35 });
  const lhWhiteMat = createAnimeMaterial({ color: PALETTE.lighthouseWhite, wetness: 0.35 });

  // Octagonal / cylindrical concrete plinth
  const lhPlinth = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.12, 0.42, 16), wallConcreteMat);
  lhPlinth.position.y = 0.21;
  lhPlinth.castShadow = true;
  lhPlinth.receiveShadow = true;
  addInkEdges(lhPlinth);
  lighthouse.add(lhPlinth);

  // 5 alternating Red & White bands up the tapered tower
  const bandHeights = [0.95, 0.92, 0.88, 0.85, 0.80];
  let curY = 0.42;
  bandHeights.forEach((bh, idx) => {
    const rBot = lerp(0.86, 0.60, idx / bandHeights.length);
    const rTop = lerp(0.86, 0.60, (idx + 1) / bandHeights.length);
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, bh, 18),
      idx % 2 === 0 ? lhWhiteMat : lhRedMat
    );
    seg.position.y = curY + bh * 0.5;
    seg.castShadow = true;
    seg.receiveShadow = true;
    addInkEdges(seg, 35, 0.28);
    lighthouse.add(seg);
    curY += bh;
  });

  // Little entry door facing along breakwater (-X)
  const lhDoor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.92, 0.52), steelFrameMat);
  lhDoor.position.set(-0.82, 0.88, 0);
  lighthouse.add(lhDoor);

  // Gallery balcony platform + iron handrail
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.66, 0.18, 18), lhWhiteMat);
  gallery.position.y = curY + 0.08;
  addInkEdges(gallery);
  lighthouse.add(gallery);

  const railRing = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.025, 6, 20), steelFrameMat);
  railRing.rotation.x = Math.PI / 2;
  railRing.position.y = curY + 0.52;
  lighthouse.add(railRing);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), steelFrameMat);
    post.position.set(Math.cos(a) * 0.84, curY + 0.32, Math.sin(a) * 0.84);
    lighthouse.add(post);
  }

  // Clear Glass Lantern Room + Glowing Optic + Red Cupola Roof
  const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.72, 14), glassMat);
  lanternGlass.position.y = curY + 0.52;
  lighthouse.add(lanternGlass);

  const opticMat = new THREE.MeshBasicMaterial({ color: 0xdff4f5 });
  const opticCore = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), opticMat);
  opticCore.position.y = curY + 0.52;
  lighthouse.add(opticCore);

  // Faint warm-gold daytime lantern halo & soft-edged beam (visible ONLY during rare cloud darkening in 10.3!)
  const lhBeamGroup = new THREE.Group();
  lhBeamGroup.position.y = curY + 0.52;
  const lhHaloUniforms = { uGlow: { value: 0.0 } };
  const lhHaloMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: lhHaloUniforms,
    vertexShader: `
      varying vec3 vNormalView;
      void main() {
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uGlow;
      varying vec3 vNormalView;
      void main() {
        if (uGlow < 0.005) discard;
        float facing = max(vNormalView.z, 0.0);
        float falloff = pow(facing, 3.2);
        gl_FragColor = vec4(1.0, 0.86, 0.42, falloff * uGlow * 0.36);
      }
    `,
  });
  const lhHaloSphere = new THREE.Mesh(new THREE.SphereGeometry(1.45, 20, 16), lhHaloMat);
  lhBeamGroup.add(lhHaloSphere);

  const lhWispMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: lhHaloUniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      void main() {
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uGlow;
      varying vec2 vUv;
      varying vec3 vNormalView;
      void main() {
        if (uGlow < 0.005) discard;
        // ConeGeometry uv.y = 1 at tip (lantern), uv.y = 0 at open base (far end)
        float along = smoothstep(0.0, 0.85, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
        float softSilhouette = pow(abs(vNormalView.z), 2.4);
        gl_FragColor = vec4(1.0, 0.88, 0.46, along * softSilhouette * uGlow * 0.14);
      }
    `,
  });
  for (const dir of [-1, 1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.95, 5.2, 20, 1, true), lhWispMat);
    cone.rotation.z = dir * (Math.PI / 2);
    cone.position.x = dir * 2.65;
    lhBeamGroup.add(cone);
  }
  const lhPointLight = new THREE.PointLight(0xffe28a, 0.0, 12.0, 1.5);
  lhBeamGroup.add(lhPointLight);
  lighthouse.add(lhBeamGroup);

  const cupola = new THREE.Mesh(
    new THREE.SphereGeometry(0.54, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
    lhRedMat
  );
  cupola.position.y = curY + 0.86;
  addInkEdges(cupola);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.035, 0.58, 6), lhRedMat);
  spire.position.y = curY + 1.55;
  lighthouse.add(cupola, spire);

  // ============================================================================
  // 4. FAR CORNER GREEN HILLSIDE & TILED-ROOF HOUSES (2.2 绿树山坡与瓦顶民家)
  // Strictly bounded within x in [-20.0, -5.2], z in [-20.0, -11.2]
  // ============================================================================
  const hillsideTrees = [];
  {
    const hillGroup = new THREE.Group();
    root.add(hillGroup);

    const grassSlopeMat = createAnimeMaterial({ color: 0x5c9c78, wetness: 0.35 });
    const stoneWallMat = createAnimeMaterial({ color: 0x8f9d9c, wetness: 0.45 });
    const earthCutMat = createAnimeMaterial({ color: 0x6c685e, shadowTintStrength: 0.42 });

    // Stepped hillside terrain blocks flush with x = -20 and z = -20 diorama walls!
    const hillTerraces = [
      { x0: -20.0, x1: -5.4, z0: -20.0, z1: -11.6, y0: 1.64, y1: 3.05, mat: stoneWallMat, top: grassSlopeMat },
      { x0: -20.0, x1: -7.2, z0: -20.0, z1: -13.2, y0: 3.04, y1: 4.55, mat: stoneWallMat, top: grassSlopeMat },
      { x0: -20.0, x1: -9.8, z0: -20.0, z1: -14.8, y0: 4.54, y1: 6.15, mat: earthCutMat, top: grassSlopeMat },
      { x0: -20.0, x1: -13.2, z0: -20.0, z1: -16.4, y0: 6.14, y1: 7.55, mat: earthCutMat, top: grassSlopeMat },
    ];
    for (const ht of hillTerraces) {
      const w = ht.x1 - ht.x0;
      const h = ht.y1 - ht.y0;
      const d = ht.z1 - ht.z0;
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        [ht.mat, earthCutMat, ht.top, earthCutMat, ht.mat, earthCutMat]
      );
      m.position.set((ht.x0 + ht.x1) * 0.5, (ht.y0 + ht.y1) * 0.5, (ht.z0 + ht.z1) * 0.5);
      m.castShadow = true;
      m.receiveShadow = true;
      addInkEdges(m, 30, 0.30);
      hillGroup.add(m);
    }

    // Winding coastal stone steps climbing the hillside
    for (let s = 0; s < 9; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.20, 0.48), wallConcreteMat);
      step.position.set(-8.6 - s * 0.25, 1.75 + s * 0.32, -11.4 - s * 0.38);
      hillGroup.add(step);
    }

    // 3 Traditional Kawara-Tiled Coastal Houses (几户瓦顶民家)
    function addCoastalHouse(hx, hy, hz, w, h, d, rotY, wallMat) {
      const hg = new THREE.Group();
      hg.position.set(hx, hy, hz);
      hg.rotation.y = rotY;

      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      body.position.y = h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      addInkEdges(body);
      hg.add(body);

      // Cedar wainscoting skirt
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, h * 0.38, d + 0.04), woodDarkMat);
      skirt.position.y = h * 0.19;
      hg.add(skirt);

      // Pitched kawara tiled roof with overhanging eaves + white ridge beam
      for (const side of [-1, 1]) {
        const rw = w * 0.62;
        const slope = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.12, d + 0.55), roofKawaraMat);
        slope.position.set(side * (w * 0.27), h + 0.34, 0);
        slope.rotation.z = -side * 0.44;
        slope.castShadow = true;
        addInkEdges(slope);
        hg.add(slope);
      }
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.16, d + 0.58), wallCreamMat);
      ridge.position.y = h + 0.62;
      hg.add(ridge);

      // Warm sliding shoji/glass windows
      const winMat = createAnimeMaterial({
        color: 0xffeec2,
        emissive: 0xffd982,
        emissiveIntensity: 0.35,
      });
      for (const wz of [-d * 0.24, d * 0.24]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.56, 0.65), winMat);
        win.position.set(w * 0.51, h * 0.62, wz);
        hg.add(win);
      }
      hillGroup.add(hg);
    }

    addCoastalHouse(-11.4, 3.05, -12.3, 2.7, 2.0, 2.4, 0.12, wallCreamMat);
    addCoastalHouse(-14.6, 4.55, -14.1, 3.0, 2.15, 2.6, -0.08, wallMintMat);
    addCoastalHouse(-16.8, 6.15, -17.8, 2.8, 2.1, 2.5, 0.22, wallCreamMat);

    // 28 Lush Layered Anime Tree Crowns (长满绿树的山坡, rustling sequentially in gusts!)
    const folMats = [
      createAnimeMaterial({ color: PALETTE.foliageDark, shadowTintStrength: 0.38 }),
      createAnimeMaterial({ color: PALETTE.foliageMid, shadowTintStrength: 0.35 }),
      createAnimeMaterial({ color: PALETTE.foliageLight, shadowTintStrength: 0.32 }),
    ];
    const puffGeo = new THREE.IcosahedronGeometry(0.85, 1);

    const treeCoords = [
      [-6.5, 3.05, -12.5, 1.0], [-7.8, 3.05, -15.2, 1.15], [-6.4, 3.05, -17.8, 1.1],
      [-8.8, 3.05, -18.6, 1.2], [-9.2, 4.55, -13.9, 1.05], [-10.8, 4.55, -16.2, 1.25],
      [-8.4, 4.55, -16.8, 1.1], [-12.2, 4.55, -18.5, 1.3], [-18.4, 3.05, -12.4, 1.15],
      [-16.4, 3.05, -12.2, 1.0], [-18.8, 4.55, -14.2, 1.25], [-11.5, 6.15, -15.6, 1.15],
      [-13.5, 6.15, -16.0, 1.2], [-18.6, 6.15, -15.6, 1.3], [-14.2, 7.55, -17.2, 1.25],
      [-16.0, 7.55, -19.1, 1.35], [-18.7, 7.55, -18.8, 1.4], [-18.9, 7.55, -17.0, 1.25],
      [-14.8, 6.15, -19.0, 1.2], [-10.4, 4.55, -19.0, 1.15], [-7.2, 3.05, -19.1, 1.05],
      [-17.2, 4.55, -13.6, 1.05], [-12.8, 3.05, -12.0, 0.92], [-19.0, 3.05, -13.2, 1.1],
    ];

    for (const [tx, ty, tz, sc] of treeCoords) {
      // Keep puffs strictly inside [-19.95, 20] x [-19.95, 20]
      const cx = Math.max(tx, -19.05);
      const cz = Math.max(tz, -19.05);
      const tg = new THREE.Group();
      tg.position.set(cx, ty, cz);

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11 * sc, 0.17 * sc, 1.1 * sc, 6),
        woodDarkMat
      );
      trunk.position.y = 0.5 * sc;
      tg.add(trunk);

      const crown = new THREE.Group();
      crown.position.y = 1.05 * sc;
      for (let p = 0; p < 3; p++) {
        const puff = new THREE.Mesh(puffGeo, folMats[(p + Math.floor(rng() * 3)) % 3]);
        puff.position.set(
          (p === 0 ? 0 : (p === 1 ? -0.35 : 0.35)) * sc,
          (p * 0.28) * sc,
          ((rng() - 0.5) * 0.35) * sc
        );
        puff.scale.set(
          (0.95 - p * 0.14) * sc,
          (0.75 - p * 0.08) * sc,
          (0.95 - p * 0.14) * sc
        );
        puff.castShadow = true;
        puff.receiveShadow = true;
        crown.add(puff);
      }
      tg.add(crown);
      hillGroup.add(tg);
      hillsideTrees.push({ crown, wx: cx, wz: cz, phase: rng() * 10 });
    }
  }

  // ============================================================================
  // 5. DISTANT LONGER BREAKWATER & SEA MIST RIBBONS (2.2 & 10.1)
  // On far edge of square base: z = -18.55, x in [-3.8, +18.8]
  // ============================================================================
  const mistRibbons = [];
  {
    const distWallMat = createAnimeMaterial({
      color: 0xa7c5cc,
      shadowTintStrength: 0.25,
      wetness: 0.2,
    });
    const distBase = new THREE.Mesh(new THREE.BoxGeometry(22.6, 0.72, 0.62), distWallMat);
    distBase.position.set(7.5, 0.32, -18.55);
    addInkEdges(distBase, 30, 0.20);
    root.add(distBase);

    const distParapet = new THREE.Mesh(new THREE.BoxGeometry(22.2, 0.30, 0.22), distWallMat);
    distParapet.position.set(7.4, 0.80, -18.72);
    root.add(distParapet);

    // Tiny distant white-green harbor beacon at tip of the far breakwater
    const distBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 1.35, 10),
      createAnimeMaterial({ color: 0xdff0ee })
    );
    distBeacon.position.set(18.45, 1.32, -18.55);
    const distTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.20, 0.24, 10),
      createAnimeMaterial({ color: 0x4ca38d })
    );
    distTop.position.set(18.45, 2.05, -18.55);
    root.add(distBeacon, distTop);

    // Cel-shaded drifting sea mist ribbons over the far horizon water (远处海面有极淡的雾气缓慢流动)
    const mistMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: SHARED_ANIME_UNIFORMS.uTime,
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float ex = smoothstep(0.0, 0.25, vUv.x) * (1.0 - smoothstep(0.75, 1.0, vUv.x));
          float ey = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
          float wisp = 0.75 + 0.25 * sin(vUv.x * 9.0 - uTime * 0.35);
          // Soft stepped anime mist band
          float band = smoothstep(0.18, 0.45, ex * ey * wisp);
          gl_FragColor = vec4(0.90, 0.97, 0.98, band * 0.24);
        }
      `,
    });

    for (let m = 0; m < 5; m++) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 1.55), mistMat);
      const baseX = -1.0 + m * 4.5;
      const baseZ = -19.2 + (m % 2) * 1.15;
      plane.position.set(baseX, 0.72 + (m % 3) * 0.28, baseZ);
      root.add(plane);
      mistRibbons.push({ mesh: plane, baseX, phase: m * 1.7 });
    }
  }

  function update(t, weather) {
    // 1. Hillside tree crowns rustle sequentially along sea-gust path! (10.2)
    for (const tr of hillsideTrees) {
      const wind = getWindAt(tr.wx, tr.wz, t, weather);
      const sway = wind.strength * 0.16;
      const rustle = Math.sin(t * (3.2 + wind.gustOnly * 4.5) + tr.phase) * (0.025 + wind.gustOnly * 0.085);
      tr.crown.rotation.z = sway * 0.75 + rustle;
      tr.crown.rotation.x = sway * 0.55 + rustle * 0.6;
    }

    // 2. Rare daytime lighthouse flash during thicker cloud dimming (10.3)
    const glow = weather.lighthouseDayGlow;
    if (glow > 0.005) {
      opticMat.color.setHex(0xfff2a6);
      lhHaloUniforms.uGlow.value = glow;
      lhPointLight.intensity = glow * 2.4;
      lhBeamGroup.rotation.y = t * 1.45;
    } else {
      opticMat.color.setHex(0xdff4f5);
      lhHaloUniforms.uGlow.value = 0.0;
      lhPointLight.intensity = 0.0;
    }

    // 3. Distant sea mist ribbons drift slowly while staying within [-19.5, +19.5]
    for (const mr of mistRibbons) {
      mr.mesh.position.x = clamp(mr.baseX + Math.sin(t * 0.14 + mr.phase) * 2.4, -3.5, 14.0);
    }
  }

  return {
    root,
    lighthouse,
    update,
  };
}
