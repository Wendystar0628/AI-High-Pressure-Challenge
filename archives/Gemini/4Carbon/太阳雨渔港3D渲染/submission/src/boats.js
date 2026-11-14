import * as THREE from 'three';
import { PALETTE, WORLD_CYCLE } from './palette.js';
import { mulberry32, clamp, lerp, smoothstep, smootherstep } from './prng.js';
import {
  createAnimeMaterial,
  addInkEdges,
  createGlassMaterial,
  createSunbeamMaterial,
  createCausticsMaterial,
} from './materials.js';
import { makeNumberedTexture } from './textures.js';

/**
 * Builds a clean sculpted Japanese fishing boat hull (bow pointing -Z, stern at +Z).
 * Length = L, Beam = W, Depth = H. Waterline sits near local y = 0.
 */
function createBoatHullGeometry(L, W, H, sheerRise = 0.26, includeDeck = true) {
  const nz = 20;
  const ny = 6;
  const positions = [];
  const uvs = [];
  const indices = [];

  // Half-breadth profile from bow (u=0 -> z=-L/2) to stern (u=1 -> z=+L/2)
  function halfWidthAt(u, v) {
    // u: 0 = sharp bow, 1 = broad transom
    let plan;
    if (u < 0.42) {
      plan = Math.pow(u / 0.42, 0.68);
    } else {
      plan = 1.0 - 0.10 * Math.pow((u - 0.42) / 0.58, 1.6);
    }
    // v: 0 = keel bottom, 1 = gunwale flare
    const sectionFlare = 0.28 + 0.72 * Math.pow(v, 0.58);
    // Sharp bow stem at u near 0
    const stemPinch = smoothstep(0.0, 0.08, u);
    return (W * 0.5) * plan * lerp(0.04 + 0.96 * v, sectionFlare, stemPinch);
  }

  function yAt(u, v) {
    const keelY = -H * 0.42 + (1.0 - smoothstep(0.0, 0.22, u)) * (H * 0.22);
    const sheerY = H * 0.58 + Math.pow(1.0 - u, 2.2) * sheerRise + Math.pow(u, 3.0) * 0.05;
    return lerp(keelY, sheerY, v);
  }

  // Build port (-X) and starboard (+X) shells
  const colsPerSide = ny + 1;
  for (let side of [-1, 1]) {
    const baseIdx = positions.length / 3;
    for (let iz = 0; iz <= nz; iz++) {
      const u = iz / nz;
      const z = lerp(-L * 0.5, L * 0.5, u);
      for (let iy = 0; iy <= ny; iy++) {
        const v = iy / ny;
        const x = side * halfWidthAt(u, v);
        const y = yAt(u, v);
        positions.push(x, y, z);
        uvs.push(u, 1.0 - v);
      }
    }
    for (let iz = 0; iz < nz; iz++) {
      for (let iy = 0; iy < ny; iy++) {
        const a = baseIdx + iz * colsPerSide + iy;
        const b = a + 1;
        const c = baseIdx + (iz + 1) * colsPerSide + iy;
        const d = c + 1;
        if (side > 0) {
          indices.push(a, b, c, b, d, c);
        } else {
          indices.push(a, c, b, b, c, d);
        }
      }
    }
  }

  // Flat transom cap at stern (u = 1, z = +L/2)
  const transomBase = positions.length / 3;
  for (let iy = 0; iy <= ny; iy++) {
    const v = iy / ny;
    const hw = halfWidthAt(1.0, v);
    const y = yAt(1.0, v);
    positions.push(-hw, y, L * 0.5);
    uvs.push(0.2, 1.0 - v);
    positions.push(hw, y, L * 0.5);
    uvs.push(0.8, 1.0 - v);
  }
  for (let iy = 0; iy < ny; iy++) {
    const a = transomBase + iy * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  // Flat recessed work deck at v = 0.72
  if (includeDeck) {
    const deckBase = positions.length / 3;
    for (let iz = 0; iz <= nz; iz++) {
      const u = iz / nz;
      const z = lerp(-L * 0.48, L * 0.49, u);
      const hw = halfWidthAt(u, 0.75) * 0.96;
      const dy = yAt(u, 0.68);
      positions.push(-hw, dy, z);
      uvs.push(0.1, u);
      positions.push(hw, dy, z);
      uvs.push(0.9, u);
    }
    for (let iz = 0; iz < nz; iz++) {
      const a = deckBase + iz * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an orange-and-white lifebuoy (橙白色救生圈).
 */
function createLifebuoy(scale = 1.0, orangeMat, whiteMat) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.21 * scale, 0.062 * scale, 8, 18), orangeMat);
  g.add(ring);
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.21 * scale, 0.066 * scale, 8, 6, 0.42),
      whiteMat
    );
    band.rotation.z = (i * Math.PI) / 2 - 0.21;
    g.add(band);
  }
  return g;
}

/**
 * Populates a complete, clearly visible 6-detail Wheelhouse Interior (5.2 驾驶舱可见性)
 * inside every boat with a cabin:
 * 1) 船舵 (Spoked Ship's Wheel)
 * 2) 发着微光的雷达屏和鱼探仪 (Glowing Radar & Fishfinder)
 * 3) 夹在板上的海图与潮汐表 (Clipped Nautical Chart & Tide Table)
 * 4) 保温壶与搪瓷杯 (Thermos Flask & Enamel Mug)
 * 5) 挂在钩上的黄色雨衣 (Yellow Raincoat on Hook)
 * 6) 贴在窗边的护身符与渔获照片 (Omamori Charm & Catch Photo beside Window)
 * Plus open cabin door, clear glass windows, cabin sunbeam & roof caustics!
 */
function buildCabinWithInterior(textures, mats, opts = {}) {
  const {
    cw = 1.48,
    ch = 1.42,
    cd = 1.72,
    roofTrimColor = PALETTE.boatTrimBlue,
  } = opts;

  const cabin = new THREE.Group();

  // Floor & Dashboard console inside wheelhouse
  const dashMat = createAnimeMaterial({ color: 0x566b73 });
  const woodHelmMat = createAnimeMaterial({ color: 0x8f5b38 });
  const trimMat = createAnimeMaterial({ color: roofTrimColor, wetness: 0.35 });

  // Lower cabin coaming walls (only up to y = 0.52 so 0.52..1.34 is HUGE clear glass all around!)
  const sillH = 0.50;
  // Front lower bulkhead (-Z)
  const frontLow = new THREE.Mesh(new THREE.BoxGeometry(cw, sillH, 0.07), mats.cabinWhite);
  frontLow.position.set(0, sillH * 0.5, -cd * 0.5);
  // Port lower wall (-X)
  const portLow = new THREE.Mesh(new THREE.BoxGeometry(0.07, sillH, cd), mats.cabinWhite);
  portLow.position.set(-cw * 0.5, sillH * 0.5, 0);
  // Starboard lower wall (+X, front 60%, leaving rear 40% wide OPEN doorway!)
  const stbdLow = new THREE.Mesh(new THREE.BoxGeometry(0.07, sillH, cd * 0.58), mats.cabinWhite);
  stbdLow.position.set(cw * 0.5, sillH * 0.5, -cd * 0.21);
  // Rear partial bulkhead (+Z, leaving wide open aft entry on right half!)
  const rearLeft = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.52, ch, 0.07), mats.cabinWhite);
  rearLeft.position.set(-cw * 0.24, ch * 0.5, cd * 0.5);
  addInkEdges(rearLeft);
  cabin.add(frontLow, portLow, stbdLow, rearLeft);

  // Corner window pillars (slim so interior visibility is unobstructed!)
  for (const [px, pz] of [
    [-cw * 0.48, -cd * 0.48],
    [cw * 0.48, -cd * 0.48],
    [-cw * 0.48, cd * 0.48],
    [cw * 0.48, cd * 0.08],
    [cw * 0.48, cd * 0.48],
  ]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.065, ch, 0.065), mats.cabinWhite);
    post.position.set(px, ch * 0.5, pz);
    cabin.add(post);
  }

  // Clear Glass Windows (front windshield, port side window, starboard side window)
  const winH = ch - sillH - 0.08;
  const winY = sillH + winH * 0.5;
  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(cw - 0.12, winH), mats.glass);
  frontGlass.position.set(0, winY, -cd * 0.5);
  const portGlass = new THREE.Mesh(new THREE.PlaneGeometry(cd - 0.12, winH), mats.glass);
  portGlass.rotation.y = Math.PI / 2;
  portGlass.position.set(-cw * 0.5, winY, 0);
  const stbdGlass = new THREE.Mesh(new THREE.PlaneGeometry(cd * 0.54, winH), mats.glass);
  stbdGlass.rotation.y = Math.PI / 2;
  stbdGlass.position.set(cw * 0.5, winY, -cd * 0.21);
  cabin.add(frontGlass, portGlass, stbdGlass);

  // OPEN CABIN DOOR (敞开的舱门 — swung open / slid back on starboard-aft so you see straight inside!)
  const openDoor = new THREE.Group();
  openDoor.position.set(cw * 0.52, 0, cd * 0.09);
  openDoor.rotation.y = -0.82; // Propped wide open outward!
  const doorLower = new THREE.Mesh(new THREE.BoxGeometry(0.05, sillH, 0.58), mats.cabinWhite);
  doorLower.position.set(0, sillH * 0.5, 0.29);
  addInkEdges(doorLower);
  const doorFrameTop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.58), mats.cabinWhite);
  doorFrameTop.position.set(0, ch - 0.06, 0.29);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.50, winH - 0.06), mats.glass);
  doorGlass.rotation.y = Math.PI / 2;
  doorGlass.position.set(0, winY, 0.29);
  openDoor.add(doorLower, doorFrameTop, doorGlass);
  cabin.add(openDoor);

  // Overhanging Cabin Roof + Blue Accent Trim + Aft CanopyCaustics
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.22, 0.10, cd + 0.34), mats.cabinWhite);
  roof.position.set(0, ch + 0.03, 0.06);
  roof.castShadow = true;
  addInkEdges(roof);
  const roofBand = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.24, 0.05, cd + 0.36), trimMat);
  roofBand.position.set(0, ch - 0.01, 0.06);
  cabin.add(roof, roofBand);

  // Animated water caustics projected onto the underside of the cabin roof overhang! (8.2 & 10.1)
  const roofCaustic = new THREE.Mesh(
    new THREE.PlaneGeometry(cw + 0.18, cd + 0.30),
    createCausticsMaterial(0.55)
  );
  roofCaustic.rotation.x = Math.PI / 2;
  roofCaustic.position.set(0, ch - 0.042, 0.06);
  cabin.add(roofCaustic);

  // Soft interior warm-cyan visibility light so wheelhouse interior is always legible!
  const cabLight = new THREE.PointLight(0xfff5dc, 0.72, 3.2, 1.3);
  cabLight.position.set(0.08, ch * 0.74, 0.0);
  cabin.add(cabLight);

  // --- THE 6 REQUIRED WHEELHOUSE INTERIOR DETAILS (5.2) ---
  // Console desk across front interior
  const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(cw - 0.16, 0.52, 0.46), dashMat);
  consoleBox.position.set(0, 0.26, -cd * 0.5 + 0.28);
  addInkEdges(consoleBox);
  cabin.add(consoleBox);

  // (1) Spoked Ship's Wheel (船舵) — clearly visible through starboard window, front glass & open door!
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0.24, 0.62, -cd * 0.5 + 0.52);
  wheelGroup.rotation.x = -0.45;
  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 7, 16), woodHelmMat);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), mats.brass);
  wheelHub.rotation.x = Math.PI / 2;
  wheelGroup.add(wheelRim, wheelHub);
  for (let sp = 0; sp < 6; sp++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.46, 6), woodHelmMat);
    spoke.rotation.z = (sp * Math.PI) / 3;
    wheelGroup.add(spoke);
  }
  cabin.add(wheelGroup);

  // (2) Softly Glowing Radar Screen & Fishfinder (发着微光的雷达屏和鱼探仪)
  const radarUnit = new THREE.Group();
  radarUnit.position.set(-0.28, 0.66, -cd * 0.5 + 0.30);
  radarUnit.rotation.y = 0.28; // Angled slightly toward helm & starboard window!
  const rCasing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.18), mats.darkMetal);
  addInkEdges(rCasing);
  const rScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.22),
    new THREE.MeshBasicMaterial({ map: textures.radarScreen })
  );
  rScreen.position.set(0, 0.01, 0.095);
  radarUnit.add(rCasing, rScreen);
  cabin.add(radarUnit);

  const finderUnit = new THREE.Group();
  finderUnit.position.set(0.03, 0.64, -cd * 0.5 + 0.27);
  finderUnit.rotation.y = 0.15;
  const fCasing = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.15), mats.darkMetal);
  addInkEdges(fCasing);
  const fScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.21, 0.16),
    new THREE.MeshBasicMaterial({ map: textures.fishFinder })
  );
  fScreen.position.set(0, 0.01, 0.078);
  finderUnit.add(fCasing, fScreen);
  cabin.add(finderUnit);

  // (3) Nautical Chart & Tide Table clipped to a board (夹在板上的海图与潮汐表)
  const clipboard = new THREE.Group();
  // Mounted angled on console/wall right where viewer peers in!
  clipboard.position.set(-0.46, 0.72, -0.02);
  clipboard.rotation.set(-0.22, Math.PI * 0.42, 0.08);
  const boardBack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.02), woodHelmMat);
  const chartSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(0.30, 0.37),
    createAnimeMaterial({ color: 0xffffff, map: textures.chartAndTide })
  );
  chartSheet.position.z = 0.014;
  const metalClip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.03), mats.silver);
  metalClip.position.set(0, 0.19, 0.02);
  clipboard.add(boardBack, chartSheet, metalClip);
  cabin.add(clipboard);

  // (4) Thermos Flask & Enamel Mug (保温壶与搪瓷杯) on side shelf (clear of helm wheel & lifebuoy!)
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.46), woodHelmMat);
  shelf.position.set(cw * 0.5 - 0.21, 0.59, 0.10);
  cabin.add(shelf);

  const thermos = new THREE.Mesh(
    new THREE.CylinderGeometry(0.050, 0.054, 0.23, 10),
    createAnimeMaterial({ color: 0x3b8a8c, wetness: 0.3 })
  );
  thermos.position.set(cw * 0.5 - 0.20, 0.72, 0.01);
  addInkEdges(thermos, 35, 0.35);
  const thermosCap = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.050, 0.052, 10), mats.silver);
  thermosCap.position.set(cw * 0.5 - 0.20, 0.86, 0.01);

  const enamelMug = new THREE.Group();
  enamelMug.position.set(cw * 0.5 - 0.20, 0.66, 0.20);
  enamelMug.rotation.y = Math.PI * 0.5; // Handle pointing cleanly sideways for unmistakable mug silhouette!
  const mugBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.048, 0.096, 12),
    createAnimeMaterial({ color: 0xf9faf4 })
  );
  addInkEdges(mugBody, 35, 0.35);
  const mugTea = new THREE.Mesh(
    new THREE.CircleGeometry(0.046, 10),
    createAnimeMaterial({ color: 0x6b3e26 })
  );
  mugTea.rotation.x = -Math.PI / 2;
  mugTea.position.y = 0.042;
  const mugRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.052, 0.0075, 6, 14),
    createAnimeMaterial({ color: 0x234c78 })
  );
  mugRim.rotation.x = Math.PI / 2;
  mugRim.position.y = 0.048;
  const mugHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.030, 0.007, 6, 10, Math.PI),
    createAnimeMaterial({ color: 0xf9faf4 })
  );
  mugHandle.position.set(0.052, 0.002, 0);
  mugHandle.rotation.z = -Math.PI / 2;
  enamelMug.add(mugBody, mugTea, mugRim, mugHandle);
  cabin.add(thermos, thermosCap, enamelMug);

  // (5) Yellow Raincoat hanging on a wall hook (挂在钩上的黄色雨衣) on rear-left interior bulkhead!
  const raincoat = new THREE.Group();
  raincoat.position.set(-0.22, ch - 0.29, cd * 0.5 - 0.09);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 8, Math.PI), mats.darkMetal);
  hook.position.set(0, 0.07, -0.02);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 8), mats.yellowRaincoat);
  hood.position.set(0, 0.0, -0.02);
  const coatBody = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 0.58, 9), mats.yellowRaincoat);
  coatBody.scale.set(1.15, 1.0, 0.58);
  coatBody.position.set(0, -0.32, -0.02);
  addInkEdges(coatBody, 35, 0.32);
  for (const sx of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.36, 7), mats.yellowRaincoat);
    sleeve.position.set(sx * 0.11, -0.25, -0.02);
    sleeve.rotation.z = sx * 0.22;
    raincoat.add(sleeve);
  }
  raincoat.add(hook, hood, coatBody);
  cabin.add(raincoat);

  // (6) Omamori Charm & Fish-Catch Photo taped beside the window (贴在窗边的护身符与渔获照片)
  const omamori = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.16, 0.105),
    createAnimeMaterial({ color: 0xffffff, map: textures.omamori })
  );
  // Hang right beside the starboard front window pillar so it's super visible!
  omamori.position.set(cw * 0.45, ch - 0.36, -cd * 0.36);
  omamori.rotation.z = 0.06;
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.12, 5),
    createAnimeMaterial({ color: 0xd9483b })
  );
  cord.position.set(cw * 0.45, ch - 0.24, -cd * 0.36);

  const catchPhoto = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.15, 0.18),
    createAnimeMaterial({ color: 0xffffff, map: textures.catchPhoto })
  );
  catchPhoto.position.set(cw * 0.45, ch - 0.60, -cd * 0.33);
  catchPhoto.rotation.x = 0.09; // Slightly crooked snapshot taped to window frame!
  cabin.add(omamori, cord, catchPhoto);

  // Warm-glinting Sunshower Raindrop Beads along cabin roof eaves & window sill (8.1 & 9.3)
  if (mats.sunBead) {
    const cBeadGeo = new THREE.SphereGeometry(0.0095, 6, 6);
    for (let i = 0; i < 10; i++) {
      const bz = lerp(-cd * 0.46, cd * 0.04, i / 9);
      const sillBead = new THREE.Mesh(cBeadGeo, mats.sunBead);
      sillBead.position.set(cw * 0.5 + 0.036, sillH + 0.008, bz);
      sillBead.scale.setScalar(0.75 + (i % 3) * 0.22);
      cabin.add(sillBead);
    }
    for (let i = 0; i < 12; i++) {
      const bz = lerp(-cd * 0.5 - 0.10, cd * 0.5 + 0.16, i / 11);
      const eaveBead = new THREE.Mesh(cBeadGeo, mats.sunBead);
      eaveBead.position.set(cw * 0.5 + 0.115, ch - 0.034, bz);
      eaveBead.scale.set(0.85, 1.25, 0.85);
      cabin.add(eaveBead);
    }
  }

  // Delicate golden sunbeam passing through cabin glass! (8.2 阳光穿过船舱玻璃)
  const cabBeam = new THREE.Mesh(
    new THREE.PlaneGeometry(0.65, 1.55),
    createSunbeamMaterial(0.14)
  );
  cabBeam.position.set(0.05, 0.78, -0.08);
  cabBeam.rotation.z = 0.48;
  cabBeam.rotation.y = 0.4;
  cabin.add(cabBeam);

  // Cabin Roof Equipment (5.1: 舱顶设置桅杆、天线、雷达罩和遮阳铁架)
  const roofY = ch + 0.08;
  // White Radome (雷达罩)
  const radomePed = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 0.14, 10), mats.cabinWhite);
  radomePed.position.set(0, roofY + 0.07, -0.25);
  const radome = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 16), mats.cabinWhite);
  radome.position.set(0, roofY + 0.22, -0.25);
  addInkEdges(radome);

  // Mast + Navigation lights + Whip Antennas
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.25, 8), mats.silver);
  mast.position.set(0, roofY + 0.62, 0.18);
  const yardarm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.72, 6), mats.silver);
  yardarm.rotation.z = Math.PI / 2;
  yardarm.position.set(0, roofY + 0.96, 0.18);
  const whip1 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.012, 1.45, 5), mats.cabinWhite);
  whip1.position.set(cw * 0.38, roofY + 0.70, -0.10);
  whip1.rotation.z = -0.08;
  const anchorLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff3b8 })
  );
  anchorLight.position.set(0, roofY + 1.26, 0.18);
  cabin.add(radomePed, radome, mast, yardarm, whip1, anchorLight);

  // Cabin Roof Perimeter Grab Railings (船顶栏杆 — 5.1 & 10.5 海鸥落在船顶栏杆上!)
  const railH = 0.15;
  const rx = cw * 0.46;
  const rz0 = -cd * 0.44;
  const rz1 = cd * 0.50;
  for (const sx of [-1, 1]) {
    const sideRail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, rz1 - rz0, 6),
      mats.silver
    );
    sideRail.rotation.x = Math.PI / 2;
    sideRail.position.set(sx * rx, roofY + railH, (rz0 + rz1) * 0.5);
    cabin.add(sideRail);
    for (const sz of [rz0, (rz0 + rz1) * 0.5, rz1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, railH, 5), mats.silver);
      post.position.set(sx * rx, roofY + railH * 0.5, sz);
      cabin.add(post);
    }
  }
  const frontRail = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, rx * 2.0, 6), mats.silver);
  frontRail.rotation.z = Math.PI / 2;
  frontRail.position.set(0, roofY + railH, rz0);
  cabin.add(frontRail);

  return cabin;
}

export function buildHarborBoats(scene, textures) {
  const root = new THREE.Group();
  scene.add(root);
  const rng = mulberry32(5150);

  const mats = {
    hull: createAnimeMaterial({ color: 0xffffff, map: textures.boatHull, wetness: 0.5 }),
    cabinWhite: createAnimeMaterial({ color: PALETTE.boatWhite, wetness: 0.35 }),
    deck: createAnimeMaterial({ color: PALETTE.boatDeck, wetness: 0.55 }),
    trimBlue: createAnimeMaterial({ color: PALETTE.boatTrimBlue, wetness: 0.35 }),
    trimTeal: createAnimeMaterial({ color: PALETTE.boatTrimTeal, wetness: 0.35 }),
    lifebuoyOrange: createAnimeMaterial({ color: PALETTE.lifebuoyOrange, wetness: 0.3 }),
    tireBlack: createAnimeMaterial({ color: 0x283236, wetness: 0.4 }),
    darkMetal: createAnimeMaterial({ color: 0x36464e, wetness: 0.25 }),
    silver: createAnimeMaterial({ color: 0xcfdbe0, wetness: 0.4 }),
    brass: createAnimeMaterial({ color: 0xd9a84e, wetness: 0.3 }),
    yellowRaincoat: createAnimeMaterial({ color: PALETTE.raincoatYellow, wetness: 0.25 }),
    ropeOrange: createAnimeMaterial({ color: PALETTE.ropeOrange, wetness: 0.35 }),
    glass: createGlassMaterial({ tint: 0xdaf4f7, opacity: 0.17, glareStrength: 0.32 }),
    sunBead: new THREE.MeshBasicMaterial({ color: 0xfff3be }),
  };

  // Helper to attach tire fenders, lifebuoys, sunshade iron frame & registration number to a boat
  function garnishBoat(boatGroup, L, W, regCode, hasSunshade = true) {
    // Registration plaque on bow sides
    const regTex = makeNumberedTexture(regCode, '#f2f8f9', '#2b5868');
    const regMat = createAnimeMaterial({ color: 0xffffff, map: regTex });
    for (const sx of [-1, 1]) {
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.22), regMat);
      plaque.position.set(sx * (W * 0.46), 0.34, -L * 0.22);
      plaque.rotation.y = sx * (Math.PI / 2 - 0.18);
      boatGroup.add(plaque);
    }

    // Delicate warm-glinting sunshower raindrop beads accumulated along port & starboard gunwales (8.1 & 9.3)
    const gBeadGeo = new THREE.SphereGeometry(0.010, 6, 6);
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 7; k++) {
        const u = 0.22 + (k / 6) * 0.62;
        const gz = lerp(-L * 0.5, L * 0.5, u);
        const gb = new THREE.Mesh(gBeadGeo, mats.sunBead);
        gb.position.set(sx * (W * 0.485), 0.52 + (1.0 - u) * 0.08, gz);
        gb.scale.setScalar(0.75 + (k % 3) * 0.2);
        boatGroup.add(gb);
      }
    }

    // Old Tire Fenders (旧轮胎护舷) hung along port & starboard sides
    const fenders = [];
    for (const sx of [-1, 1]) {
      for (const zf of [-0.14, 0.22]) {
        const fg = new THREE.Group();
        fg.position.set(sx * (W * 0.51), 0.26, L * zf);
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), mats.ropeOrange);
        rope.position.y = 0.08;
        const tire = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.062, 8, 14), mats.tireBlack);
        tire.rotation.y = Math.PI / 2;
        tire.position.y = -0.10;
        fg.add(rope, tire);
        boatGroup.add(fg);
        fenders.push({ group: fg, sx });
      }
    }

    // Orange-and-white Lifebuoys (橙白色救生圈 — starboard buoy placed on aft work bulwark so cabin glass & mug stay 100% clear!)
    for (const sx of [-1, 1]) {
      const buoy = createLifebuoy(0.92, mats.lifebuoyOrange, mats.cabinWhite);
      buoy.position.set(sx * (W * 0.45), sx > 0 ? 0.58 : 0.72, sx > 0 ? L * 0.25 : 0.12);
      buoy.rotation.y = Math.PI / 2;
      boatGroup.add(buoy);
    }

    // Aft Sunshade Iron Pipe Frame (遮阳铁架) over rear work deck!
    if (hasSunshade) {
      const frame = new THREE.Group();
      const fw = W * 0.82;
      const fl = L * 0.28;
      const fz = L * 0.30;
      const fh = 1.72;
      for (const sx of [-fw * 0.5, fw * 0.5]) {
        for (const sz of [fz - fl * 0.5, fz + fl * 0.5]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, fh, 6), mats.silver);
          post.position.set(sx, 0.20 + fh * 0.5, sz);
          frame.add(post);
        }
        const sideBar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, fl + 0.1, 6), mats.silver);
        sideBar.rotation.x = Math.PI / 2;
        sideBar.position.set(sx, 0.20 + fh, fz);
        frame.add(sideBar);
      }
      for (let k = 0; k < 4; k++) {
        const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, fw + 0.08, 6), mats.silver);
        cross.rotation.z = Math.PI / 2;
        cross.position.set(0, 0.20 + fh, fz - fl * 0.48 + (k / 3) * fl * 0.96);
        frame.add(cross);
      }
      // Half-rolled blue-teal tarp on part of the sunshade iron frame + water caustics underneath
      const tarp = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.04, 0.025, fl * 0.48), mats.trimTeal);
      tarp.position.set(0, 0.22 + fh, fz - fl * 0.22);
      const tarpCaustic = new THREE.Mesh(
        new THREE.PlaneGeometry(fw, fl * 0.44),
        createCausticsMaterial(0.48)
      );
      tarpCaustic.rotation.x = Math.PI / 2;
      tarpCaustic.position.set(0, 0.205 + fh, fz - fl * 0.22);
      frame.add(tarp, tarpCaustic);
      boatGroup.add(frame);
    }

    return fenders;
  }

  const boats = [];

  // ============================================================================
  // BOAT #1: Small White Open Fishing Skiff (白色小型渔船) at inner L-corner berth
  // ============================================================================
  {
    const b1 = new THREE.Group();
    const L = 3.25, W = 1.38, H = 0.68;
    const hull = new THREE.Mesh(createBoatHullGeometry(L, W, H, 0.20), mats.hull);
    hull.castShadow = true;
    hull.receiveShadow = true;
    addInkEdges(hull, 32, 0.36);
    b1.add(hull);

    // Wooden thwarts (bench planks), outboard motor, coiled rope & blue fish basket
    for (const tz of [-0.55, 0.25]) {
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.82, 0.05, 0.26),
        createAnimeMaterial({ color: PALETTE.woodWarm, wetness: 0.35 })
      );
      seat.position.set(0, 0.20, tz);
      b1.add(seat);
    }
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.32), mats.darkMetal);
    motor.position.set(0, 0.42, L * 0.5 + 0.08);
    addInkEdges(motor);
    const propShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.58, 6), mats.darkMetal);
    propShaft.position.set(0, 0.05, L * 0.5 + 0.12);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 7, 14), mats.ropeOrange);
    coil.rotation.x = Math.PI / 2;
    coil.position.set(-0.18, 0.14, -0.95);
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.17, 0.24, 10),
      createAnimeMaterial({ color: 0x2e7ca6, wetness: 0.4 })
    );
    basket.position.set(0.18, 0.20, -0.15);
    const buoy = createLifebuoy(0.82, mats.lifebuoyOrange, mats.cabinWhite);
    buoy.rotation.x = Math.PI / 2;
    buoy.position.set(-0.20, 0.24, 0.25);
    b1.add(motor, propShaft, coil, basket, buoy);
    const fenders = garnishBoat(b1, L, W, 'SO3-108', false);

    b1.position.set(-1.35, 0.02, 2.55);
    b1.rotation.y = 1.48; // Moored neatly along z = +4.0 corner wall!
    root.add(b1);
    boats.push({
      id: 1,
      group: b1,
      baseX: -1.35,
      baseZ: 2.55,
      baseRotY: 1.48,
      bowLocal: new THREE.Vector3(0, 0.36, -L * 0.46),
      bollardPos: new THREE.Vector3(-1.2, 1.65, 4.32),
      freqRoll: 1.42,
      freqPitch: 1.11,
      phase: 0.4,
      fenders,
    });
  }

  // ============================================================================
  // BOAT #2: Sport-Fishing Cabin Cruiser (带驾驶舱的游钓船) — Hero Berth #2!
  // ============================================================================
  {
    const b2 = new THREE.Group();
    const L = 4.55, W = 1.96, H = 0.94;
    const hull = new THREE.Mesh(createBoatHullGeometry(L, W, H, 0.34), mats.hull);
    hull.castShadow = true;
    hull.receiveShadow = true;
    addInkEdges(hull, 30, 0.36);
    b2.add(hull);

    // Bow stainless pulpit railing (distinctive sport-fishing cruiser detail!)
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.55, 6), mats.silver);
      rail.rotation.x = Math.PI / 2 - 0.1;
      rail.position.set(sx * 0.56, 0.78, -1.35);
      rail.rotation.z = sx * 0.22;
      b2.add(rail);
    }

    const cabin = buildCabinWithInterior(textures, mats, {
      cw: 1.44,
      ch: 1.66,
      cd: 1.76,
      roofTrimColor: PALETTE.boatTrimBlue,
    });
    cabin.position.set(0, 0.28, -0.18);
    b2.add(cabin);
    const fenders = garnishBoat(b2, L, W, 'SO2-1847', true);

    // Positioned at (-2.55, 0.04, -1.35), port side right next to x = -4.0 seawall, starboard facing +X!
    b2.position.set(-2.55, 0.04, -1.35);
    b2.rotation.y = 0.04;
    root.add(b2);
    boats.push({
      id: 2,
      group: b2,
      cabin,
      baseX: -2.55,
      baseZ: -1.35,
      baseRotY: 0.04,
      bowLocal: new THREE.Vector3(-0.25, 0.56, -L * 0.45),
      bollardPos: new THREE.Vector3(-4.32, 1.65, -3.55),
      freqRoll: 1.18,
      freqPitch: 0.94,
      phase: 1.9,
      fenders,
    });
  }

  // ============================================================================
  // BOAT #3: Coastal Cabin Gillnetter / Trawler (带驾驶舱的白色渔船) — Berth #3
  // ============================================================================
  {
    const b3 = new THREE.Group();
    const L = 4.35, W = 1.88, H = 0.90;
    const hull = new THREE.Mesh(createBoatHullGeometry(L, W, H, 0.30), mats.hull);
    hull.castShadow = true;
    hull.receiveShadow = true;
    addInkEdges(hull, 30, 0.36);
    b3.add(hull);

    const cabin = buildCabinWithInterior(textures, mats, {
      cw: 1.38,
      ch: 1.62,
      cd: 1.66,
      roofTrimColor: PALETTE.boatTrimTeal,
    });
    cabin.position.set(0, 0.26, -0.05);
    b3.add(cabin);

    // Foredeck net roller & fish hold hatch
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.72), mats.trimTeal);
    hatch.position.set(0, 0.26, -1.32);
    addInkEdges(hatch);
    b3.add(hatch);

    const fenders = garnishBoat(b3, L, W, 'SO2-3092', true);

    b3.position.set(-2.52, 0.03, -6.25);
    b3.rotation.y = -0.03;
    root.add(b3);
    boats.push({
      id: 3,
      group: b3,
      cabin,
      baseX: -2.52,
      baseZ: -6.25,
      baseRotY: -0.03,
      bowLocal: new THREE.Vector3(-0.25, 0.52, -L * 0.45),
      bollardPos: new THREE.Vector3(-4.32, 1.65, -8.35),
      freqRoll: 1.31,
      freqPitch: 1.03,
      phase: 3.7,
      fenders,
    });
  }

  // ============================================================================
  // BOAT #4: Outermost Cabin Fishing Boat (10.5 最外侧白色渔船不时解缆出港兜一圈再回泊位系好)
  // ============================================================================
  const boat4LoopCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-2.45, 0.03, -10.85), // 0: Moored at outermost berth #4
      new THREE.Vector3(0.4, 0.03, -11.4),    // 1: Easing away from quay wall
      new THREE.Vector3(5.2, 0.03, -11.8),    // 2: Heading toward breakwater mouth
      new THREE.Vector3(10.8, 0.03, -12.2),   // 3: Clearing red-and-white lighthouse (8.45, -14.3)
      new THREE.Vector3(14.2, 0.03, -15.8),   // 4: Rounding outside the breakwater!
      new THREE.Vector3(16.6, 0.03, -11.2),   // 5: Wide outer harbor sweeping arc
      new THREE.Vector3(15.2, 0.03, -4.4),    // 6: Cruising south across open sea during Shot 12!
      new THREE.Vector3(9.8, 0.03, -4.8),     // 7: Turning back toward inner basin
      new THREE.Vector3(4.8, 0.03, -8.2),     // 8: Approaching outermost berth
      new THREE.Vector3(0.3, 0.03, -10.2),    // 9: Aligning alongside quay
      new THREE.Vector3(-2.45, 0.03, -10.85), // 10: Back at berth #4!
    ],
    false,
    'catmullrom',
    0.45
  );

  let boat4Ref = null;
  {
    const b4 = new THREE.Group();
    const L = 4.25, W = 1.84, H = 0.88;
    const hull = new THREE.Mesh(createBoatHullGeometry(L, W, H, 0.30), mats.hull);
    hull.castShadow = true;
    hull.receiveShadow = true;
    addInkEdges(hull, 30, 0.36);
    b4.add(hull);

    const cabin = buildCabinWithInterior(textures, mats, {
      cw: 1.36,
      ch: 1.60,
      cd: 1.62,
      roofTrimColor: PALETTE.boatTrimBlue,
    });
    cabin.position.set(0, 0.25, -0.08);
    b4.add(cabin);

    // Small fluttering stern flag on Boat #4!
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.85, 5), mats.silver);
    flagPole.position.set(0.62, 0.70, L * 0.45);
    const flagCloth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.22, 4, 1),
      createAnimeMaterial({ color: 0xe8643c, side: THREE.DoubleSide })
    );
    flagCloth.position.set(0.62, 1.01, L * 0.45 + 0.18);
    flagCloth.rotation.y = Math.PI / 2;
    b4.add(flagPole, flagCloth);

    const fenders = garnishBoat(b4, L, W, 'SO2-4510', true);
    b4.position.set(-2.45, 0.03, -10.85);
    root.add(b4);

    boat4Ref = {
      id: 4,
      group: b4,
      cabin,
      flagCloth,
      L,
      baseX: -2.45,
      baseZ: -10.85,
      baseRotY: 0.0,
      bowLocal: new THREE.Vector3(-0.25, 0.52, -L * 0.45),
      bollardPos: new THREE.Vector3(-4.32, 1.65, -12.15),
      freqRoll: 1.25,
      freqPitch: 0.98,
      phase: 5.1,
      fenders,
      isMoored: true,
    };
    boats.push(boat4Ref);
  }

  /**
   * Pure deterministic analytical state of Boat #4 at any world time `time`.
   * Casts off at tc = 44.2s, rounds the red-and-white lighthouse during Shot 11,
   * cruises across open water trailing a crisp white wake throughout Shot 12 (54.5..59.5s),
   * and settles smoothly back into Berth #4 at tc = 59.92s!
   */
  function evaluateBoat4At(time) {
    const tc = ((time % WORLD_CYCLE) + WORLD_CYCLE) % WORLD_CYCLE;
    const tStart = 44.2;
    const tEnd = 59.92;
    if (tc < tStart || tc >= tEnd) {
      return {
        x: -2.45,
        z: -10.85,
        rotY: 0.0,
        dirX: 0.0,
        dirZ: -1.0,
        speed: 0.0,
        mooredBlend: 1.0,
      };
    }
    const rawU = clamp((tc - tStart) / (tEnd - tStart), 0, 1);
    const u = clamp(lerp(rawU, smootherstep(0.0, 1.0, rawU), 0.55), 0, 0.999999);
    const pt = boat4LoopCurve.getPointAt(u);

    // Smooth tangent heading (boat bow is -Z in local space, so rotY = atan2(-dx, -dz))
    const uA = clamp(u - 0.015, 0, 0.999999);
    const uB = clamp(u + 0.015, 0, 0.999999);
    const pA = boat4LoopCurve.getPointAt(uA);
    const pB = boat4LoopCurve.getPointAt(uB);
    let dx = pB.x - pA.x;
    let dz = pB.z - pA.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;

    // Blend heading cleanly to 0.0 at very start and very end
    const travelHeading = Math.atan2(-dx, -dz);
    const edgeBlend = smoothstep(0.0, 0.07, rawU) * (1.0 - smoothstep(0.92, 1.0, rawU));
    let hDiff = travelHeading;
    while (hDiff > Math.PI) hDiff -= Math.PI * 2;
    while (hDiff < -Math.PI) hDiff += Math.PI * 2;
    const rotY = hDiff * edgeBlend;

    const speed = Math.sin(rawU * Math.PI); // Smooth 0 -> 1 -> 0 speed envelope
    const mooredBlend = 1.0 - smoothstep(0.0, 0.05, rawU) * (1.0 - smoothstep(0.95, 1.0, rawU));

    return {
      x: pt.x,
      z: pt.z,
      rotY,
      dirX: dx,
      dirZ: dz,
      speed,
      mooredBlend,
    };
  }

  // Dynamic 3D Cel-Shaded White Wake Ribbon trailing behind Boat #4! (船尾拖出白色航迹)
  const WAKE_SEGS = 24;
  const wakePositions = new Float32Array((WAKE_SEGS + 1) * 2 * 3);
  const wakeUvs = new Float32Array((WAKE_SEGS + 1) * 2 * 2);
  const wakeIndices = [];
  for (let i = 0; i <= WAKE_SEGS; i++) {
    const v = i / WAKE_SEGS;
    wakeUvs[i * 4 + 0] = 0;
    wakeUvs[i * 4 + 1] = v;
    wakeUvs[i * 4 + 2] = 1;
    wakeUvs[i * 4 + 3] = v;
    if (i < WAKE_SEGS) {
      const a = i * 2;
      wakeIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const wakeGeo = new THREE.BufferGeometry();
  wakeGeo.setAttribute('position', new THREE.BufferAttribute(wakePositions, 3));
  wakeGeo.setAttribute('uv', new THREE.BufferAttribute(wakeUvs, 2));
  wakeGeo.setIndex(wakeIndices);
  const wakeRibbonMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
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
        if (uOpacity < 0.02) discard;
        // Crisp anime V-arms + frothy center prop wash!
        float side = abs(vUv.x - 0.5) * 2.0; // 0 = center, 1 = outer edge
        float outerArm = smoothstep(0.68, 0.80, side) * (1.0 - smoothstep(0.92, 1.0, side));
        float centerWash = (1.0 - smoothstep(0.0, 0.42, side)) * (1.0 - smoothstep(0.0, 0.65, vUv.y));
        float scallop = 0.65 + 0.35 * sin(vUv.y * 28.0 + side * 6.0);
        float fadeTail = (1.0 - smoothstep(0.55, 1.0, vUv.y)) * smoothstep(0.0, 0.06, vUv.y);
        float mask = smoothstep(0.28, 0.45, (outerArm + centerWash) * scallop) * fadeTail;
        if (mask < 0.05) discard;
        gl_FragColor = vec4(0.95, 0.99, 0.99, mask * uOpacity * 0.88);
      }
    `,
  });
  const wakeRibbonMesh = new THREE.Mesh(wakeGeo, wakeRibbonMat);
  wakeRibbonMesh.frustumCulled = false;
  wakeRibbonMesh.renderOrder = 4;
  root.add(wakeRibbonMesh);

  /**
   * Computes sequential wake wave disturbance at world (x, z) at time `t`
   * caused by Boat #4's expanding wake waves (10.5 航迹浪沿途依次晃动浮标和泊位里的船).
   */
  function getWakeDisturbanceAt(x, z, t) {
    let impulse = 0;
    const waveSpeed = 3.2; // units/s propagation speed across harbor water
    for (let k = 1; k <= 14; k++) {
      const tau = t - k * 0.45;
      const st = evaluateBoat4At(tau);
      if (st.speed < 0.08) continue;
      const dist = Math.hypot(x - st.x, z - st.z);
      const waveRadius = (t - tau) * waveSpeed;
      const diff = Math.abs(dist - waveRadius);
      if (diff < 1.25) {
        const env = (1.0 - diff / 1.25) * (1.0 - k / 15) * st.speed;
        impulse += Math.sin((dist - waveRadius) * 4.2) * env;
      }
    }
    return clamp(impulse, -1.0, 1.0);
  }

  // ============================================================================
  // 5. UPSIDE-DOWN SMALL WOODEN SAMPAN ON SLIPWAY (6 & 10.5 倒扣着的小木舢板)
  // ============================================================================
  const sampan = new THREE.Group();
  {
    const sL = 2.65, sW = 1.12, sH = 0.44;
    const woodHullMat = createAnimeMaterial({
      color: 0xffffff,
      map: textures.woodenSampan,
      wetness: 0.55,
      side: THREE.DoubleSide,
    });
    const keelMat = createAnimeMaterial({ color: 0x5c4636, wetness: 0.55 });
    const ribMat = createAnimeMaterial({ color: 0x73563e, wetness: 0.25 });
    const sampanGeo = createBoatHullGeometry(sL, sW, sH, 0.14, false);
    const sampanMesh = new THREE.Mesh(sampanGeo, woodHullMat);
    sampanMesh.castShadow = true;
    sampanMesh.receiveShadow = true;
    addInkEdges(sampanMesh, 32, 0.36);

    // Keel strip along bottom (which faces UP when inverted!)
    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, sL * 0.88), keelMat);
    keel.position.set(0, -sH * 0.43, 0);
    sampan.add(sampanMesh, keel);

    // Traditional interior wooden ribs (船肋骨) & bow/stern thwarts visible underneath when propped open!
    for (const rz of [-0.90, -0.60, -0.30, 0.0, 0.30, 0.60, 0.90]) {
      const u = (rz + sL * 0.5) / sL;
      const plan = u < 0.42 ? Math.pow(u / 0.42, 0.68) : 1.0 - 0.10 * Math.pow((u - 0.42) / 0.58, 1.6);
      const hw = sW * 0.46 * plan;
      const ky = -sH * 0.36;
      const gy = sH * 0.52 + Math.pow(1.0 - u, 2.2) * 0.12;
      const ribCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-hw, gy, rz),
        new THREE.Vector3(-hw * 0.66, ky + 0.06, rz),
        new THREE.Vector3(0, ky, rz),
        new THREE.Vector3(hw * 0.66, ky + 0.06, rz),
        new THREE.Vector3(hw, gy, rz),
      ]);
      const rib = new THREE.Mesh(new THREE.TubeGeometry(ribCurve, 10, 0.015, 5, false), ribMat);
      sampan.add(rib);
    }
    for (const tz of [-0.60, 0.60]) {
      const u = (tz + sL * 0.5) / sL;
      const plan = u < 0.42 ? Math.pow(u / 0.42, 0.68) : 1.0 - 0.10 * Math.pow((u - 0.42) / 0.58, 1.6);
      const thwart = new THREE.Mesh(new THREE.BoxGeometry(sW * 0.86 * plan, 0.032, 0.18), ribMat);
      thwart.position.set(0, sH * 0.36, tz);
      sampan.add(thwart);
    }

    // Flip upside down cleanly ABOVE the concrete slipway ramp, propped open on west (-X) gunwale for the cat!
    const rampAngle = Math.atan2(1.65 - (-0.52), 8.2 - 3.6);
    sampan.position.set(2.92, 1.14, 6.18);
    sampan.rotation.order = 'YXZ';
    sampan.rotation.y = -0.04;
    sampan.rotation.x = -rampAngle;
    sampan.rotation.z = Math.PI - 0.32; // Propped open on west (-X) side facing across the wide slipway!
    root.add(sampan);

    // Two wooden chock blocks propping the west gunwale up cleanly at bow & stern ends
    for (const cz of [5.48, 6.86]) {
      const chockY = 0.732 + (cz - 6.18) * ((1.65 - (-0.52)) / (8.2 - 3.6));
      const chock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.22), keelMat);
      chock.position.set(2.35, chockY + 0.13, cz);
      chock.rotation.x = -rampAngle;
      addInkEdges(chock, 25, 0.35);
      root.add(chock);
    }
  }

  // ============================================================================
  // 6. DISTANT PASSING FISHING BOAT OUTSIDE FAR BREAKWATER (10.5 远处防波堤外也不时有渔船驶过)
  // Strictly inside square diorama base: z = -19.42, x in [-2.8, +18.0]
  // ============================================================================
  const distantBoat = new THREE.Group();
  const distHullMat = createAnimeMaterial({
    color: 0xdceef2,
    transparent: true,
    opacity: 0.78,
    shadowTintStrength: 0.20,
  });
  {
    const dHull = new THREE.Mesh(createBoatHullGeometry(1.22, 0.46, 0.24, 0.08), distHullMat);
    const dCab = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.30, 0.42), distHullMat);
    dCab.position.set(0, 0.16, -0.04);
    const dMast = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.36, 5), distHullMat);
    dMast.position.set(0, 0.40, 0.04);
    distantBoat.add(dHull, dCab, dMast);
    distantBoat.rotation.y = -Math.PI / 2; // Bow pointing +X
    distantBoat.position.set(5.0, 0.02, -19.42);
    root.add(distantBoat);
  }

  function update(t, weather) {
    // 1. Update Boat #4 (moored vs departing/looping/returning) + 3D Wake Trail Ribbon!
    const b4State = evaluateBoat4At(t);
    boat4Ref.isMoored = b4State.mooredBlend > 0.5;

    wakeRibbonMat.uniforms.uOpacity.value = smoothstep(0.05, 0.25, b4State.speed);
    if (b4State.speed > 0.04) {
      wakeRibbonMesh.visible = true;
      const pAttr = wakeGeo.attributes.position;
      for (let i = 0; i <= WAKE_SEGS; i++) {
        const frac = i / WAKE_SEGS;
        const hist = evaluateBoat4At(t - frac * 3.8);
        // Stern offset behind boat center
        const sx = hist.x - hist.dirX * 1.85;
        const sz = hist.z - hist.dirZ * 1.85;
        const nx = -hist.dirZ;
        const nz = hist.dirX;
        const halfW = 0.42 + frac * 1.95;
        const wy = 0.055;
        pAttr.setXYZ(i * 2, sx - nx * halfW, wy, sz - nz * halfW);
        pAttr.setXYZ(i * 2 + 1, sx + nx * halfW, wy, sz + nz * halfW);
      }
      pAttr.needsUpdate = true;
    } else {
      wakeRibbonMesh.visible = false;
    }

    // 2. Update all 4 harbor boats with individual rocking rhythms + sequential wake roll!
    for (const b of boats) {
      if (b.id === 4) {
        const roll = Math.sin(t * b.freqRoll + b.phase) * 0.032
                   - b4State.speed * 0.045 * Math.sin(t * 2.1);
        const pitch = Math.cos(t * b.freqPitch + b.phase) * 0.022
                    - b4State.speed * 0.035; // Slight bow-up trim when cruising!
        const heave = Math.sin(t * 1.35 + b.phase) * 0.035;
        b.group.position.set(b4State.x, 0.03 + heave, b4State.z);
        b.group.rotation.order = 'YXZ';
        b.group.rotation.y = b4State.rotY;
        b.group.rotation.z = roll;
        b.group.rotation.x = pitch;
      } else {
        const wakeHit = getWakeDisturbanceAt(b.baseX, b.baseZ, t);
        const gustBump = weather.gust1Active * 0.018 * Math.sin(t * 2.6 + b.phase);
        const roll = Math.sin(t * b.freqRoll + b.phase) * 0.034 + wakeHit * 0.065 + gustBump;
        const pitch = Math.cos(t * b.freqPitch + b.phase * 1.3) * 0.022 + wakeHit * 0.032;
        const heave = Math.sin(t * (b.freqRoll * 0.92) + b.phase) * 0.036 + wakeHit * 0.045;
        const swayX = Math.sin(t * 0.58 + b.phase) * 0.055;

        b.group.position.set(b.baseX + swayX, 0.03 + heave, b.baseZ);
        b.group.rotation.order = 'YXZ';
        b.group.rotation.y = b.baseRotY + Math.sin(t * 0.43 + b.phase) * 0.022;
        b.group.rotation.z = roll;
        b.group.rotation.x = pitch;

        // Subtle tire fender sway / seawall bump on port side! (10.1 护舷轮胎偶尔轻碰岸壁)
        for (const fd of b.fenders) {
          fd.group.rotation.z = -roll * 0.8 + (fd.sx < 0 ? Math.max(0, -swayX * 1.8) : 0);
        }
      }
    }

    // 3. Distant boat outside the far breakwater passes periodically (tc = 6..32s)
    const tc = ((t % WORLD_CYCLE) + WORLD_CYCLE) % WORLD_CYCLE;
    if (tc > 5.0 && tc < 33.0) {
      const du = (tc - 5.0) / 28.0;
      distantBoat.visible = true;
      distantBoat.position.x = lerp(-2.5, 18.2, du);
      distantBoat.position.y = 0.02 + Math.sin(t * 1.6) * 0.02;
      distHullMat.opacity = smoothstep(0.0, 0.12, du) * (1.0 - smoothstep(0.88, 1.0, du)) * 0.86;
    } else {
      distantBoat.visible = false;
    }

    const tetrapodWakeBoost = Math.abs(getWakeDisturbanceAt(9.2, -14.8, t)) * 0.85;
    const seawallWakeBoost = Math.max(
      Math.abs(getWakeDisturbanceAt(-3.9, -6.5, t)),
      Math.abs(getWakeDisturbanceAt(2.0, -13.1, t)),
      Math.abs(getWakeDisturbanceAt(6.0, 6.5, t))
    ) * 0.95;

    return {
      x: b4State.x,
      z: b4State.z,
      dirX: b4State.dirX,
      dirZ: b4State.dirZ,
      speed: b4State.speed,
      mooredBlend: b4State.mooredBlend,
      tetrapodWakeBoost,
      seawallWakeBoost,
    };
  }

  return {
    root,
    boats,
    sampan,
    getWakeDisturbanceAt,
    evaluateBoat4At,
    update,
  };
}
