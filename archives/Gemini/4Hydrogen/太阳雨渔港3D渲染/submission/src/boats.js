import * as THREE from 'three';
import { getWaterHeight, evalBoat4Trajectory, QUAY_Y, LANDING_Y } from './state.js';
import { createAnimeToonMaterial } from './toon.js';
import {
  createBoatHullTexture,
  createRadarScreenTexture,
  createFishfinderTexture,
  createChartClipboardTexture,
  createCatchPhotoTexture,
  createOmamoriTexture,
  createRopeFiberTexture,
} from './textures.js';

/**
 * Generates a realistic Japanese coastal fishing boat / sport-fisher hull mesh
 * oriented with bow pointing toward -Z and stern toward +Z, centered at waterline Y=0.
 */
function buildHullGeometry(length, beam, draft, freeboard) {
  const segZ = 18;
  const segX = 8;
  const positions = [];
  const uvs = [];
  const indices = [];

  // Split Port (ip 0..3) and Starboard (ip 3..6) cleanly at keel so hull registration text
  // reads right-side-up and left-to-right on BOTH sides of the boat!
  function buildHalf(ipStart, flipU) {
    const baseVertex = positions.length / 3;
    const halfPts = 4;
    for (let iz = 0; iz <= segZ; iz++) {
      const u = iz / segZ; // 0 = stern (+L/2), 1 = bow (-L/2)
      const z = length * 0.5 - u * length;
      const beamFactor = u < 0.35 ? 1.0 : Math.pow(Math.cos(((u - 0.35) / 0.65) * (Math.PI * 0.48)), 0.72);
      const halfB = beam * 0.5 * Math.max(0.04, beamFactor);
      const sheerBoost = Math.pow(u, 2.2) * 0.28;
      const keelLift = u > 0.72 ? Math.pow((u - 0.72) / 0.28, 2.0) * 0.35 : 0;

      const topY = freeboard + sheerBoost;
      const chineY = -draft * 0.35 + sheerBoost * 0.25 + keelLift * 0.4;
      const keelY = -draft + keelLift;

      const profile = [
        [-halfB, topY],
        [-halfB * 0.96, (topY + chineY) * 0.48],
        [-halfB * 0.78, chineY],
        [0, keelY],
        [halfB * 0.78, chineY],
        [halfB * 0.96, (topY + chineY) * 0.48],
        [halfB, topY],
      ];

      for (let k = 0; k < halfPts; k++) {
        const ip = ipStart + k;
        positions.push(profile[ip][0], profile[ip][1], z);
        const vCoord = Math.abs(ip - 3) / 3.0; // gunwale = 1.0 (canvas top), keel = 0.0 (canvas bottom)
        uvs.push(flipU ? 1.0 - u : u, vCoord);
      }
    }
    for (let iz = 0; iz < segZ; iz++) {
      for (let k = 0; k < halfPts - 1; k++) {
        const a = baseVertex + iz * halfPts + k;
        const b = a + 1;
        const c = a + halfPts;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  buildHalf(0, true);  // Port (-X): bow on left (1-u=0), stern on right (1-u=1)
  buildHalf(3, false); // Starboard (+X): stern on left (u=0), bow on right (u=1)

  // Transom stern cap (iz = 0) matching all 7 hull profile vertices hermetically
  const sternIdx = positions.length / 3;
  const hw = beam * 0.5;
  const midY = (freeboard + -draft * 0.35) * 0.48;
  const sternPts = [
    [-hw, freeboard, 1.0],
    [-hw * 0.96, midY, 0.67],
    [-hw * 0.78, -draft * 0.35, 0.33],
    [0, -draft, 0.0],
    [hw * 0.78, -draft * 0.35, 0.33],
    [hw * 0.96, midY, 0.67],
    [hw, freeboard, 1.0],
  ];
  sternPts.forEach(([sx, sy, sv]) => {
    positions.push(sx, sy, length * 0.5);
    uvs.push(0.02, sv);
  });
  // Fan triangles from bottom keel center (sternIdx + 3) across transom perimeter (CCW = +Z normal)
  indices.push(
    sternIdx + 3, sternIdx + 0, sternIdx + 1,
    sternIdx + 3, sternIdx + 1, sternIdx + 2,
    sternIdx + 3, sternIdx + 6, sternIdx + 0,
    sternIdx + 3, sternIdx + 5, sternIdx + 6,
    sternIdx + 3, sternIdx + 4, sternIdx + 5
  );

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildBoats(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const radarTex = createRadarScreenTexture();
  const fishfinderTex = createFishfinderTexture();
  const chartTex = createChartClipboardTexture();
  const photoTex = createCatchPhotoTexture();
  const omamoriTex = createOmamoriTexture();

  const matDeck = createAnimeToonMaterial({ color: 0xe6eef0, wetness: 0.35 });
  const matTrimTeal = createAnimeToonMaterial({ color: 0x3b7b94, wetness: 0.3 });
  const matCabinWhite = createAnimeToonMaterial({ color: 0xf4f7f8, wetness: 0.35, rimStrength: 0.2 });
  const matCabinCeiling = createAnimeToonMaterial({
    color: 0xcbdde2,
    wetness: 0.1,
    causticsStrength: 1.25,
    causticsScale: 0.9,
    side: THREE.DoubleSide,
  });
  const matDarkMetal = createAnimeToonMaterial({ color: 0x384b54, wetness: 0.28 });
  const matSteel = createAnimeToonMaterial({ color: 0xcbd8dc, wetness: 0.42 });
  const matLifebuoyOrange = createAnimeToonMaterial({ color: 0xee6a44, wetness: 0.35 });
  const matLifebuoyWhite = createAnimeToonMaterial({ color: 0xf7f9f9, wetness: 0.35 });
  const matTireFender = createAnimeToonMaterial({ color: 0x2c383f, wetness: 0.22 });
  const matYellowCoat = createAnimeToonMaterial({ color: 0xf2c238, wetness: 0.25 });
  const matWood = createAnimeToonMaterial({ color: 0xb98555, wetness: 0.12 });
  const matThermos = createAnimeToonMaterial({ color: 0xd95f49, wetness: 0.3 });
  const matBlueCrate = createAnimeToonMaterial({ color: 0x3e8db5, wetness: 0.5 });

  const matRadar = new THREE.MeshBasicMaterial({ map: radarTex });
  const matFishfinder = new THREE.MeshBasicMaterial({ map: fishfinderTex });
  const matChart = createAnimeToonMaterial({ color: 0xffffff, map: chartTex, wetness: 0.05 });
  const matPhoto = createAnimeToonMaterial({ color: 0xffffff, map: photoTex, side: THREE.DoubleSide });
  const matOmamori = createAnimeToonMaterial({ color: 0xffffff, map: omamoriTex, side: THREE.DoubleSide });

  const matCabinGlass = new THREE.MeshPhysicalMaterial({
    color: 0xd9f4fa,
    transparent: true,
    opacity: 0.24,
    roughness: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Helper: orange-and-white lifebuoy ring
  function makeLifebuoy() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.065, 8, 16), matLifebuoyOrange);
    g.add(ring);
    for (let i = 0; i < 4; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.068, 8, 6, 0.35), matLifebuoyWhite);
      band.rotation.z = (i * Math.PI) / 2;
      g.add(band);
    }
    return g;
  }

  // Helper: complete 6-item cockpit interior (helm wheel, glowing radar & fishfinder,
  // clipped chart & tide table, thermos & enamel mug, hanging yellow raincoat, omamori & catch photo)
  function populateCockpitInterior(cabinGroup, width, length, deckY, floorH) {
    const interior = new THREE.Group();
    cabinGroup.add(interior);

    // Subtle interior illumination so cockpit instruments & raincoat stay readable through glass
    const cabinLight = new THREE.PointLight(0xfff4dc, 0.65, 3.2, 1.5);
    cabinLight.position.set(0, deckY + floorH - 0.25, -length * 0.05);
    cabinLight.layers.enableAll();
    interior.add(cabinLight);

    // Helm console desk at forward end of cockpit
    const dashZ = -length * 0.26;
    const dash = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, 0.56, 0.42), matCabinWhite);
    dash.position.set(0, deckY + 0.30, dashZ);
    dash.castShadow = true;
    interior.add(dash);

    const dashTop = new THREE.Mesh(new THREE.BoxGeometry(width * 0.80, 0.06, 0.46), matDarkMetal);
    dashTop.position.set(0, deckY + 0.59, dashZ);
    interior.add(dashTop);

    // 1) Spoked Ship's Wheel (船舵) on starboard helm side
    const helmGroup = new THREE.Group();
    helmGroup.position.set(width * 0.16, deckY + 0.64, dashZ + 0.26);
    helmGroup.rotation.x = 0.42;
    interior.add(helmGroup);

    const helmHub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 8), matDarkMetal);
    helmHub.rotation.x = Math.PI / 2;
    helmGroup.add(helmHub);
    const helmRim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 16), matSteel);
    helmRim.position.z = 0.05;
    helmGroup.add(helmRim);
    for (let s = 0; s < 5; s++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.34, 5), matSteel);
      sp.rotation.z = (s / 5) * Math.PI;
      sp.position.z = 0.05;
      helmGroup.add(sp);
    }

    // Helm seat
    const seatPed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.36, 8), matSteel);
    seatPed.position.set(width * 0.16, deckY + 0.18, dashZ + 0.68);
    interior.add(seatPed);
    const seatCush = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.30), matTrimTeal);
    seatCush.position.set(width * 0.16, deckY + 0.38, dashZ + 0.68);
    interior.add(seatCush);

    // 2) Glowing Radar Screen & Fishfinder Sonar (发着微光的雷达屏和鱼探仪 — staggered clearly in view!)
    const radarCase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.20, 0.12), matDarkMetal);
    radarCase.position.set(-width * 0.16, deckY + 0.72, dashZ + 0.02);
    radarCase.rotation.y = 0.24;
    radarCase.rotation.x = -0.15;
    interior.add(radarCase);
    const radarScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.15), matRadar);
    radarScreen.position.set(0, 0, 0.062);
    radarCase.add(radarScreen);

    const ffStand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.07), matDarkMetal);
    ffStand.position.set(width * 0.01, deckY + 0.65, dashZ + 0.04);
    interior.add(ffStand);
    const ffCase = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.10), matDarkMetal);
    ffCase.position.set(width * 0.01, deckY + 0.76, dashZ + 0.05);
    ffCase.rotation.y = 0.38;
    ffCase.rotation.x = -0.12;
    interior.add(ffCase);
    const ffScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.14), matFishfinder);
    ffScreen.position.set(0, 0, 0.052);
    ffCase.add(ffScreen);

    // 3) Clipped Chart & Tide Table (夹在板上的海图与潮汐表) angled visibly toward Shot 7 camera
    const clipGroup = new THREE.Group();
    clipGroup.position.set(-width * 0.28, deckY + 0.68, dashZ + 0.14);
    clipGroup.rotation.set(-0.78, 0.56, -0.06);
    interior.add(clipGroup);
    const clipBoard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.015), matWood);
    clipGroup.add(clipBoard);
    const chartPaper = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.24), matChart);
    chartPaper.position.z = 0.01;
    clipGroup.add(chartPaper);
    const metalClip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.025), matSteel);
    metalClip.position.set(0, 0.12, 0.012);
    clipGroup.add(metalClip);

    // 4) Thermos Flask & Enamel Mug (保温壶与搪瓷杯 — staggered clearly side-by-side in Shot 7!)
    const thermos = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.20, 10), matThermos);
    thermos.position.set(width * 0.26, deckY + 0.72, dashZ + 0.04);
    interior.add(thermos);
    const tCap = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.05, 10), matSteel);
    tCap.position.set(width * 0.26, deckY + 0.84, dashZ + 0.04);
    interior.add(tCap);

    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.075, 10), matLifebuoyWhite);
    mug.position.set(width * 0.34, deckY + 0.655, dashZ + 0.14);
    interior.add(mug);
    const mugRim = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.0055, 5, 10), matTrimTeal);
    mugRim.rotation.x = Math.PI / 2;
    mugRim.position.set(width * 0.34, deckY + 0.692, dashZ + 0.14);
    interior.add(mugRim);
    const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 4, 8), matLifebuoyWhite);
    mugHandle.position.set(width * 0.34 + 0.036, deckY + 0.655, dashZ + 0.14);
    interior.add(mugHandle);

    // 5) Yellow Raincoat Hanging on Hook (挂在钩上的黄色雨衣) anchored cleanly to aft-port solid bulkhead
    const coatGroup = new THREE.Group();
    coatGroup.position.set(-width * 0.28, deckY + 0.99, length * 0.39);
    coatGroup.rotation.y = Math.PI * 0.36;
    interior.add(coatGroup);

    const coatHookBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.02), matWood);
    coatHookBar.position.set(0, 0.14, -0.05);
    coatGroup.add(coatHookBar);
    const coatHook = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.06, 6), matSteel);
    coatHook.rotation.x = Math.PI / 2;
    coatHook.position.set(0, 0.14, -0.025);
    coatGroup.add(coatHook);

    // Draped oilskin slicker: curved yoke shoulders, smooth A-line body, flush placket, relaxed sleeves & folded collar hood
    const coatShoulders = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), matYellowCoat);
    coatShoulders.scale.set(1.38, 0.50, 0.42);
    coatShoulders.position.set(0, 0.04, 0.005);
    coatGroup.add(coatShoulders);
    const coatBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.185, 0.49, 12), matYellowCoat);
    coatBody.position.set(0, -0.20, 0.005);
    coatBody.scale.set(1.36, 1, 0.42);
    coatGroup.add(coatBody);
    const coatPlacket = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.45, 0.026), matDarkMetal);
    coatPlacket.position.set(0, -0.20, 0.068);
    coatPlacket.rotation.x = 0.06;
    coatGroup.add(coatPlacket);
    [-1, 1].forEach((s) => {
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.036, 0.39, 10), matYellowCoat);
      sleeve.position.set(s * 0.175, -0.15, 0.01);
      sleeve.rotation.z = s * 0.16;
      coatGroup.add(sleeve);
    });
    const coatCollar = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.022, 6, 12), matYellowCoat);
    coatCollar.rotation.x = Math.PI * 0.56;
    coatCollar.position.set(0, 0.09, -0.005);
    coatGroup.add(coatCollar);
    const coatHood = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), matYellowCoat);
    coatHood.scale.set(1.05, 0.65, 0.85);
    coatHood.position.set(0, 0.06, -0.045);
    coatHood.rotation.x = 0.48;
    coatGroup.add(coatHood);

    // 6) Omamori Charm & Catch Photo taped inside Front/Starboard Window Corner (贴在窗边的护身符与渔获照片)
    const omamoriString = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 5), matThermos);
    omamoriString.position.set(width * 0.34, deckY + 1.07, dashZ + 0.14);
    interior.add(omamoriString);
    const omamori = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.115, 0.016), matOmamori);
    omamori.position.set(width * 0.34, deckY + 0.99, dashZ + 0.14);
    omamori.rotation.y = 0.55; // angled straight toward helm & Shot 7 camera!
    interior.add(omamori);

    const photoCard = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.125, 0.012), matLifebuoyWhite);
    photoCard.position.set(width * 0.27, deckY + 0.90, -length * 0.44);
    photoCard.rotation.y = 0.42;
    interior.add(photoCard);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.11), matPhoto);
    photo.position.z = 0.008;
    photoCard.add(photo);
  }

  /**
   * Builds a complete boat group (either open-console small fisher or cabin sport-fisher)
   */
  function createBoat({
    length,
    beam,
    draft,
    freeboard,
    regCode,
    stripeHex,
    seed,
    hasCabin,
    fenderSide, // +1 = starboard, -1 = port
  }) {
    const boat = new THREE.Group();

    const hullTex = createBoatHullTexture(regCode, stripeHex, seed);
    const matHull = createAnimeToonMaterial({
      color: 0xffffff,
      map: hullTex,
      wetness: 0.45,
      rimStrength: 0.22,
      side: THREE.DoubleSide,
    });

    // Outer hull shell
    const hullMesh = new THREE.Mesh(buildHullGeometry(length, beam, draft, freeboard), matHull);
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;
    boat.add(hullMesh);

    // Inner deck floor shaped cleanly inside curved hull walls (zero bow overhang!)
    const deckY = freeboard * 0.52;
    const dShape = new THREE.Shape();
    const dPts = [];
    for (let i = 0; i <= 12; i++) {
      const u = 0.04 + (i / 12) * 0.82;
      const z = length * 0.5 - u * length;
      const bf = u < 0.35 ? 1.0 : Math.pow(Math.cos(((u - 0.35) / 0.65) * (Math.PI * 0.48)), 0.72);
      const hb = Math.max(0.02, beam * 0.5 * bf * 0.86);
      dPts.push([hb, z]);
    }
    dShape.moveTo(-dPts[0][0], dPts[0][1]);
    dPts.forEach(([x, z]) => dShape.lineTo(x, z));
    for (let i = dPts.length - 1; i >= 0; i--) dShape.lineTo(-dPts[i][0], dPts[i][1]);
    dShape.closePath();
    const deckGeo = new THREE.ExtrudeGeometry(dShape, { depth: 0.08, bevelEnabled: false });
    deckGeo.rotateX(Math.PI / 2);
    const deckFloor = new THREE.Mesh(deckGeo, matDeck);
    deckFloor.position.set(0, deckY + 0.04, 0);
    deckFloor.receiveShadow = true;
    boat.add(deckFloor);

    // Bow foredeck cap matching exact hull gunwale curve cleanly (zero triangular overhang!)
    const fPos = [];
    const fIdx = [];
    const fSegs = 8;
    for (let i = 0; i <= fSegs; i++) {
      const u = 0.62 + (i / fSegs) * 0.38;
      const z = length * 0.5 - u * length;
      const bf = Math.pow(Math.cos(((u - 0.35) / 0.65) * (Math.PI * 0.48)), 0.72);
      const hb = Math.max(0.015, beam * 0.5 * bf - 0.025);
      const y = freeboard + Math.pow(u, 2.2) * 0.28 - 0.035;
      fPos.push(-hb, y, z, 0, y + 0.025, z, hb, y, z);
    }
    for (let i = 0; i < fSegs; i++) {
      const b = i * 3;
      const n = b + 3;
      fIdx.push(b, b + 1, n, b + 1, n + 1, n, b + 1, b + 2, n + 1, b + 2, n + 2, n + 1);
    }
    const bowDeckGeo = new THREE.BufferGeometry();
    bowDeckGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
    bowDeckGeo.setIndex(fIdx);
    bowDeckGeo.computeVertexNormals();
    const bowDeck = new THREE.Mesh(bowDeckGeo, matDeck);
    boat.add(bowDeck);

    // Sculpted 3D gunwale cap / rub-rail molding along port, bow, starboard & transom rim
    const rimPts = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const bf = u < 0.35 ? 1.0 : Math.pow(Math.cos(((u - 0.35) / 0.65) * (Math.PI * 0.48)), 0.72);
      const hb = beam * 0.5 * Math.max(0.04, bf);
      const ry = freeboard + Math.pow(u, 2.2) * 0.28 + 0.01;
      rimPts.push(new THREE.Vector3(-hb, ry, length * 0.5 - u * length));
    }
    for (let i = 14; i >= 0; i--) {
      const u = i / 14;
      const bf = u < 0.35 ? 1.0 : Math.pow(Math.cos(((u - 0.35) / 0.65) * (Math.PI * 0.48)), 0.72);
      const hb = beam * 0.5 * Math.max(0.04, bf);
      const ry = freeboard + Math.pow(u, 2.2) * 0.28 + 0.01;
      rimPts.push(new THREE.Vector3(hb, ry, length * 0.5 - u * length));
    }
    rimPts.push(rimPts[0].clone());
    const rubRail = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, false), 42, 0.036, 6, false),
      matTrimTeal
    );
    rubRail.castShadow = true;
    boat.add(rubRail);

    // Aft engine cover (with seat cushion lid & latch) & molded blue fish crate on working deck
    const engBox = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.44, 0.40, 0.65), matCabinWhite);
    engBox.position.set(0, deckY + 0.22, length * 0.34);
    engBox.castShadow = true;
    boat.add(engBox);
    const engLid = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.46, 0.05, 0.68), matTrimTeal);
    engLid.position.set(0, deckY + 0.44, length * 0.34);
    engLid.castShadow = true;
    boat.add(engLid);
    const engLatch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.03), matDarkMetal);
    engLatch.position.set(0, deckY + 0.39, length * 0.34 - 0.33);
    boat.add(engLatch);

    const deckCrate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.26, 0.38), matBlueCrate);
    deckCrate.position.set(-beam * 0.22, deckY + 0.17, length * 0.26);
    deckCrate.rotation.y = 0.22;
    deckCrate.castShadow = true;
    boat.add(deckCrate);
    const deckCrateRim = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.04, 0.42), matBlueCrate);
    deckCrateRim.position.set(-beam * 0.22, deckY + 0.30, length * 0.26);
    deckCrateRim.rotation.y = 0.22;
    boat.add(deckCrateRim);

    // Tire fenders along quay-facing hull side (gently kiss quay wall!)
    [-length * 0.22, 0, length * 0.22].forEach((fz) => {
      const fender = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.065, 7, 14), matTireFender);
      fender.rotation.y = Math.PI / 2;
      fender.position.set(fenderSide * (beam * 0.51), freeboard * 0.55, fz);
      fender.castShadow = true;
      boat.add(fender);
    });

    // Orange-white lifebuoy mounted flush outside the harbor-facing gunwale hull side (zero hull clipping!)
    const buoy = makeLifebuoy();
    buoy.rotation.y = Math.PI / 2;
    buoy.position.set(-fenderSide * (beam * 0.50 + 0.085), freeboard * 0.68, length * 0.14);
    boat.add(buoy);

    if (hasCabin) {
      // Wheelhouse / Cabin superstructure (centered slightly forward)
      const cabW = beam * 0.72;
      const cabL = length * 0.34;
      const cabH = 1.38;
      const cabZ = -length * 0.06;

      const cabGroup = new THREE.Group();
      cabGroup.position.set(0, 0, cabZ);
      boat.add(cabGroup);

      // Lower solid coaming walls (up to sill height 0.62m above deck so windows are huge & clear!)
      const sillH = 0.60;
      const winH = cabH - sillH - 0.12;
      // Port & Starboard lower side panels
      [-1, 1].forEach((sx) => {
        const lowWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, sillH, cabL), matCabinWhite);
        lowWall.position.set(sx * cabW * 0.5, deckY + sillH * 0.5, 0);
        lowWall.castShadow = true;
        cabGroup.add(lowWall);

        // Corner & mid window mullions
        [-cabL * 0.48, 0, cabL * 0.48].forEach((mz) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, winH + 0.12, 0.08), matCabinWhite);
          post.position.set(sx * cabW * 0.5, deckY + sillH + (winH + 0.12) * 0.5, mz);
          cabGroup.add(post);
        });

        // Large transparent side window
        const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(cabL - 0.12, winH), matCabinGlass);
        sideGlass.rotation.y = Math.PI / 2;
        sideGlass.position.set(sx * cabW * 0.5, deckY + sillH + winH * 0.5, 0);
        sideGlass.layers.set(1);
        cabGroup.add(sideGlass);
      });

      // Front lower bulkhead & slanted windshield glass
      const frontLow = new THREE.Mesh(new THREE.BoxGeometry(cabW, sillH, 0.08), matCabinWhite);
      frontLow.position.set(0, deckY + sillH * 0.5, -cabL * 0.5);
      cabGroup.add(frontLow);
      const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(cabW - 0.12, winH), matCabinGlass);
      frontGlass.position.set(0, deckY + sillH + winH * 0.5, -cabL * 0.5);
      frontGlass.layers.set(1);
      cabGroup.add(frontGlass);

      // Aft bulkhead with OPEN SLIDING DOORWAY (left half solid, right half open!)
      const aftSolid = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.46, cabH, 0.08), matCabinWhite);
      aftSolid.position.set(-cabW * 0.27, deckY + cabH * 0.5, cabL * 0.5);
      aftSolid.castShadow = true;
      cabGroup.add(aftSolid);
      // Slid-open door frame edge
      const doorTop = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.54, 0.16, 0.08), matCabinWhite);
      doorTop.position.set(cabW * 0.23, deckY + cabH - 0.08, cabL * 0.5);
      cabGroup.add(doorTop);

      // Cabin Roof + Shimmering Water Caustic Liner Underneath!
      const roof = new THREE.Mesh(new THREE.BoxGeometry(cabW + 0.18, 0.10, cabL + 0.26), matCabinWhite);
      roof.position.set(0, deckY + cabH + 0.05, 0.04);
      roof.castShadow = true;
      roof.receiveShadow = true;
      cabGroup.add(roof);

      const roofCausticLiner = new THREE.Mesh(new THREE.PlaneGeometry(cabW - 0.08, cabL - 0.08), matCabinCeiling);
      roofCausticLiner.rotation.x = Math.PI / 2;
      roofCausticLiner.position.set(0, deckY + cabH - 0.01, 0);
      cabGroup.add(roofCausticLiner);

      // Populate ALL 6 detailed cockpit interior items!
      populateCockpitInterior(cabGroup, cabW, cabL, deckY, cabH);

      // Cabin Roof Rig: Mast, Whip Antennas, Radar Dome, & Aft Sunshade Iron Frame!
      const roofTopY = deckY + cabH + 0.10;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.25, 6), matSteel);
      mast.position.set(0, roofTopY + 0.62, -cabL * 0.12);
      mast.castShadow = true;
      cabGroup.add(mast);
      const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.72, 6), matSteel);
      crossbar.rotation.z = Math.PI / 2;
      crossbar.position.set(0, roofTopY + 0.92, -cabL * 0.12);
      cabGroup.add(crossbar);

      // Radar dome on roof
      const domePed = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 8), matSteel);
      domePed.position.set(0, roofTopY + 0.07, -cabL * 0.28);
      cabGroup.add(domePed);
      const radome = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.16, 14), matCabinWhite);
      radome.position.set(0, roofTopY + 0.20, -cabL * 0.28);
      radome.castShadow = true;
      cabGroup.add(radome);

      // Twin slender antennas
      [-cabW * 0.36, cabW * 0.36].forEach((ax) => {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 1.35, 5), matSteel);
        ant.position.set(ax, roofTopY + 0.62, cabL * 0.2);
        ant.rotation.x = 0.20;
        cabGroup.add(ant);
      });

      // Aft sunshade steel pipe frame (遮阳铁架) + taut coastal canvas awning
      const shadeLen = length * 0.28;
      const shadeZ = cabL * 0.5 + shadeLen * 0.5;
      [-cabW * 0.42, cabW * 0.42].forEach((px) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, cabH, 6), matSteel);
        post.position.set(px, deckY + cabH * 0.5, cabL * 0.5 + shadeLen - 0.08);
        cabGroup.add(post);
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, shadeLen, 6), matSteel);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(px, deckY + cabH, shadeZ);
        cabGroup.add(rail);
      });
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(cabW * 0.90, 0.03, shadeLen),
        createAnimeToonMaterial({ color: 0x5ca3b5, wetness: 0.35 })
      );
      awning.position.set(0, deckY + cabH + 0.02, shadeZ);
      awning.castShadow = true;
      cabGroup.add(awning);

      // Port (red) & Starboard (green) navigation sidelights on cabin roof sides
      const portNav = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.10), matLifebuoyOrange);
      portNav.position.set(-cabW * 0.52, roofTopY + 0.02, -cabL * 0.32);
      cabGroup.add(portNav);
      const stbdNav = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.07, 0.10),
        createAnimeToonMaterial({ color: 0x4db88a })
      );
      stbdNav.position.set(cabW * 0.52, roofTopY + 0.02, -cabL * 0.32);
      cabGroup.add(stbdNav);

      // Coiled deck mooring line on aft quarter deck
      const deckCoil = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.028, 6, 14), matThermos);
      deckCoil.rotation.x = Math.PI / 2;
      deckCoil.position.set(-cabW * 0.26, deckY + 0.06, cabL * 0.5 + shadeLen * 0.65);
      cabGroup.add(deckCoil);
    } else {
      // Open-deck small fishing boat (Boat 1) with crisp center console, windshield, mast & details!
      const console = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.72, 0.52), matCabinWhite);
      console.position.set(0, deckY + 0.36, -0.2);
      console.castShadow = true;
      boat.add(console);

      const windShield = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.38), matCabinGlass);
      windShield.position.set(0, deckY + 0.88, -0.40);
      windShield.rotation.x = 0.25;
      windShield.layers.set(1);
      boat.add(windShield);

      const helm = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 14), matSteel);
      helm.position.set(0.12, deckY + 0.65, 0.10);
      helm.rotation.x = 0.4;
      boat.add(helm);

      const ff = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.08), matDarkMetal);
      ff.position.set(-0.16, deckY + 0.79, -0.18);
      boat.add(ff);
      const ffGlowScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.11),
        new THREE.MeshBasicMaterial({ map: fishfinderTex })
      );
      ffGlowScreen.position.set(-0.16, deckY + 0.79, -0.135);
      boat.add(ffGlowScreen);

      const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 0.30), matTrimTeal);
      benchSeat.position.set(0, deckY + 0.36, 0.42);
      boat.add(benchSeat);

      const thermos = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.18, 8), matThermos);
      thermos.position.set(0.24, deckY + 0.81, -0.22);
      boat.add(thermos);

      // Fish basket, coiled deck rope & fishing rod tucked in gunwale holder
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.34), matBlueCrate);
      basket.position.set(-0.32, deckY + 0.16, length * 0.24);
      basket.castShadow = true;
      boat.add(basket);
      const b1Coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 6, 12), matThermos);
      b1Coil.rotation.x = Math.PI / 2;
      b1Coil.position.set(0.32, deckY + 0.055, length * 0.24);
      boat.add(b1Coil);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.016, 1.85, 6), matSteel);
      rod.position.set(-beam * 0.36, deckY + 0.92, length * 0.16);
      rod.rotation.set(-0.42, 0, 0.15);
      boat.add(rod);

      // Small tubular A-frame mast & fishing rod holders
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 1.35, 6), matSteel);
      mast.position.set(0, deckY + 0.68, length * 0.22);
      boat.add(mast);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.95, 5), matSteel);
      ant.position.set(0.28, deckY + 1.05, -0.25);
      boat.add(ant);
    }

    return boat;
  }

  // ---------------------------------------------------------
  // Instantiate 4 Distinct Harbor Boats
  // ---------------------------------------------------------
  const boatConfigs = [
    {
      // Boat 1: Inner corner white small open fishing boat moored along South Quay (bow East +X!)
      id: 'boat1',
      baseX: -0.35,
      baseZ: 4.44,
      baseYaw: -Math.PI * 0.5, // bow pointing East (+X), starboard (+X) against South Quay Z=5.5
      length: 4.4,
      beam: 1.80,
      draft: 0.45,
      freeboard: 0.62,
      regCode: 'SF-218',
      stripeHex: '#3f8ea8',
      seed: 11,
      hasCabin: false,
      fenderSide: 1, // starboard side touches South Quay Z=5.5 when yaw = -PI/2!
      phase: 0.4,
      freq: 1.05,
    },
    {
      // Boat 2: Mid-West berth cabin sport-fisher (FEATURED in Shot 7 Cockpit Close-up!)
      id: 'boat2',
      baseX: -3.45,
      baseZ: -0.65,
      baseYaw: 0, // bow pointing North (-Z), port side (-X) against West Quay X=-5.0
      length: 5.75,
      beam: 2.15,
      draft: 0.55,
      freeboard: 0.72,
      regCode: 'YM-104',
      stripeHex: '#2f7e91',
      seed: 22,
      hasCabin: true,
      fenderSide: -1,
      phase: 1.7,
      freq: 0.92,
    },
    {
      // Boat 3: Outer-West berth white cabin fishing boat (generous berth gap ahead of Boat 2 bow!)
      id: 'boat3',
      baseX: -3.45,
      baseZ: -7.95,
      baseYaw: 0,
      length: 5.65,
      beam: 2.10,
      draft: 0.54,
      freeboard: 0.70,
      regCode: 'KM-307',
      stripeHex: '#d45c47',
      seed: 33,
      hasCabin: true,
      fenderSide: -1,
      phase: 3.1,
      freq: 0.98,
    },
    {
      // Boat 4: Outer berth cabin fishing boat alongside Lower Boarding Platform (departs & cruises!)
      id: 'boat4',
      baseX: 6.62,
      baseZ: 9.4,
      baseYaw: 0,
      length: 5.8,
      beam: 2.10,
      draft: 0.52,
      freeboard: 0.70,
      regCode: 'CH-09',
      stripeHex: '#357b99',
      seed: 44,
      hasCabin: true,
      fenderSide: -1,
      phase: 4.5,
      freq: 0.88,
    },
  ];

  const boats = boatConfigs.map((cfg) => {
    const mesh = createBoat(cfg);
    mesh.position.set(cfg.baseX, 0, cfg.baseZ);
    mesh.rotation.y = cfg.baseYaw;
    root.add(mesh);
    return { ...cfg, mesh };
  });

  // ---------------------------------------------------------
  // Dynamic Mooring Ropes (braided coarse fiber lines, darkening smoothly where wet!)
  // ---------------------------------------------------------
  const matRopeDry = createAnimeToonMaterial({
    color: 0xffffff,
    map: createRopeFiberTexture({ darkWet: false }),
    wetness: 0.12,
  });
  const matRopeWet = createAnimeToonMaterial({
    color: 0xffffff,
    map: createRopeFiberTexture({ darkWet: true }),
    wetness: 0.48,
  });

  // Dynamic line entries for moored boats 1, 2, 3 + Boat 4 (clears bollard (-4.2, 5.85) for gull!)
  const mooringSpecs = [
    // Boat 1 bow & stern lines from starboard cleats cleanly onto South Quay bollards
    { boatIdx: 0, localCleat: new THREE.Vector3(0.70, 0.65, -1.6), bollardPos: new THREE.Vector3(0.95, QUAY_Y + 0.34, 5.85), alwaysAttached: true },
    { boatIdx: 0, localCleat: new THREE.Vector3(0.70, 0.62, 1.6), bollardPos: new THREE.Vector3(-1.4, QUAY_Y + 0.34, 5.85), alwaysAttached: true },
    // Boat 2 bow & stern lines to West Quay bollards
    { boatIdx: 1, localCleat: new THREE.Vector3(-0.7, 0.75, -2.1), bollardPos: new THREE.Vector3(-5.6, QUAY_Y + 0.34, -3.4), alwaysAttached: true },
    { boatIdx: 1, localCleat: new THREE.Vector3(-0.7, 0.70, 2.1), bollardPos: new THREE.Vector3(-5.6, QUAY_Y + 0.34, 2.1), alwaysAttached: true },
    // Boat 3 bow & stern lines to West Quay bollards
    { boatIdx: 2, localCleat: new THREE.Vector3(-0.7, 0.74, -1.9), bollardPos: new THREE.Vector3(-5.6, QUAY_Y + 0.34, -9.2), alwaysAttached: true },
    { boatIdx: 2, localCleat: new THREE.Vector3(-0.7, 0.68, 2.0), bollardPos: new THREE.Vector3(-5.6, QUAY_Y + 0.34, -4.4), alwaysAttached: true },
    // Boat 4 bow & stern lines to Lower Landing cleats (shown when berthed)
    { boatIdx: 3, localCleat: new THREE.Vector3(-0.7, 0.72, -2.2), bollardPos: new THREE.Vector3(5.1, LANDING_Y + 0.28, 7.9), alwaysAttached: false },
    { boatIdx: 3, localCleat: new THREE.Vector3(-0.7, 0.68, 2.2), bollardPos: new THREE.Vector3(5.1, LANDING_Y + 0.28, 11.8), alwaysAttached: false },
  ];

  // Build reusable 12-segment cylinder-chain rope meshes for smooth tension/slack catenary updates
  const ropeSegCount = 10;
  const ropeLines = mooringSpecs.map((spec) => {
    const segs = [];
    for (let i = 0; i < ropeSegCount; i++) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 1.0, 5),
        i < 5 ? matRopeDry : matRopeWet
      );
      m.castShadow = true;
      root.add(m);
      segs.push(m);
    }
    return { ...spec, segs };
  });

  // Also add static coiled bollard ropes that dip straight down into the water (dark wet submerged ends!)
  const dippingLines = [
    [-5.6, QUAY_Y + 0.30, 4.1, -4.85, -0.55, 4.1],
    [-1.4, QUAY_Y + 0.30, 5.85, -1.4, -0.55, 5.32],
    [3.1, QUAY_Y + 0.30, 6.4, 3.68, -0.55, 6.4],
  ];
  dippingLines.forEach(([x0, y0, z0, x1, y1, z1]) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3((x0 + x1) * 0.5, QUAY_Y + 0.05, (z0 + z1) * 0.5),
      new THREE.Vector3(x1, 0.15, z1),
      new THREE.Vector3(x1, y1, z1),
    ]);
    // Dry upper part
    const dryGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([curve.getPoint(0), curve.getPoint(0.42), curve.getPoint(0.70)]),
      10,
      0.026,
      6,
      false
    );
    root.add(new THREE.Mesh(dryGeo, matRopeDry));
    // Wet darkened lower part dipping into water
    const wetGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([curve.getPoint(0.68), curve.getPoint(0.85), curve.getPoint(1.0)]),
      8,
      0.026,
      6,
      false
    );
    root.add(new THREE.Mesh(wetGeo, matRopeWet));
  });

  const tmpCleatW = new THREE.Vector3();
  const tmpUp = new THREE.Vector3(0, 1, 0);
  const tmpDir = new THREE.Vector3();
  const tmpP0 = new THREE.Vector3();
  const tmpP1 = new THREE.Vector3();

  return {
    root,
    boats,
    update(t) {
      const b4Traj = evalBoat4Trajectory(t);

      // Compute wake ripple arrival strength at any (x, z) from Boat 4's cruise
      function getBoat4WakeSwell(x, z) {
        if (!b4Traj.active) return 0;
        const dist = Math.hypot(x - b4Traj.pos.x, z - b4Traj.pos.z);
        // Expanding wave propagation delay based on distance from Boat 4's path
        const waveRing = Math.sin(dist * 1.15 - t * 3.8);
        const atten = Math.exp(-dist * 0.09) * b4Traj.speed;
        return waveRing * atten * 0.065;
      }

      boats.forEach((b, idx) => {
        if (idx === 3) {
          // Boat 4 (departing & returning boat)
          const h = getWaterHeight(b4Traj.pos.x, b4Traj.pos.z, t);
          b.mesh.position.set(b4Traj.pos.x, h, b4Traj.pos.z);
          b.mesh.rotation.y = b4Traj.yaw;
          const speedPitch = -b4Traj.speed * 0.045;
          b.mesh.rotation.x = speedPitch + Math.sin(t * b.freq * 1.2 + b.phase) * 0.018;
          b.mesh.rotation.z = Math.cos(t * b.freq + b.phase) * 0.025;
        } else {
          // Boats 1, 2, 3 gently bob & roll with independent rhythms + wake surge
          const wakeSwell = getBoat4WakeSwell(b.baseX, b.baseZ);
          const h = getWaterHeight(b.baseX, b.baseZ, t) + wakeSwell;
          const swaySide = Math.sin(t * b.freq * 0.72 + b.phase) * 0.045 + wakeSwell * 0.45;
          // Gentle fender contact against quay (clamped slightly so hull never clips deep into concrete)
          const offX = b.baseYaw === 0 ? Math.max(-0.02, swaySide) : 0;
          const offZ = b.baseYaw !== 0 ? Math.min(0.02, -swaySide) : 0;

          b.mesh.position.set(b.baseX + offX, h, b.baseZ + offZ);
          b.mesh.rotation.y = b.baseYaw + Math.sin(t * b.freq * 0.55 + b.phase) * 0.015;
          b.mesh.rotation.x = Math.sin(t * b.freq * 1.1 + b.phase) * 0.022 + wakeSwell * 0.35;
          b.mesh.rotation.z = Math.cos(t * b.freq + b.phase) * 0.032 + wakeSwell * 0.45;
        }
        b.mesh.updateMatrixWorld(true);
      });

      // Update dynamic mooring rope catenaries (tightening & slackening naturally!)
      ropeLines.forEach((line) => {
        const boat = boats[line.boatIdx];
        const show = line.alwaysAttached || !b4Traj.active;
        line.segs.forEach((s) => {
          s.visible = show;
        });
        if (!show) return;

        tmpCleatW.copy(line.localCleat).applyMatrix4(boat.mesh.matrixWorld);
        const start = line.bollardPos;
        const end = tmpCleatW;
        const dist = start.distanceTo(end);
        // Tighter when stretched further; sags smoothly when boat drifts closer!
        const sag = Math.max(0.06, 0.38 - (dist - 1.5) * 0.12);

        for (let i = 0; i < ropeSegCount; i++) {
          const u0 = i / ropeSegCount;
          const u1 = (i + 1) / ropeSegCount;
          // Arch cleanly over yellow-black quay hazard curb (u ~ 0..0.40) then dip smoothly over water
          const lift0 = u0 < 0.44 ? Math.sin((u0 / 0.44) * Math.PI) * 0.17 : 0;
          const lift1 = u1 < 0.44 ? Math.sin((u1 / 0.44) * Math.PI) * 0.17 : 0;
          const drop0 = Math.pow(u0, 1.35) * Math.sin(u0 * Math.PI) * sag;
          const drop1 = Math.pow(u1, 1.35) * Math.sin(u1 * Math.PI) * sag;
          tmpP0.lerpVectors(start, end, u0);
          tmpP0.y += lift0 - drop0;
          tmpP1.lerpVectors(start, end, u1);
          tmpP1.y += lift1 - drop1;

          const seg = line.segs[i];
          seg.position.lerpVectors(tmpP0, tmpP1, 0.5);
          tmpDir.subVectors(tmpP1, tmpP0);
          const len = tmpDir.length();
          seg.scale.set(1, Math.max(0.001, len * 1.04), 1);
          if (len > 0.0001) {
            seg.quaternion.setFromUnitVectors(tmpUp, tmpDir.normalize());
          }
          // Darken lower droop near water if close
          seg.material = seg.position.y < 0.72 ? matRopeWet : matRopeDry;
        }
      });
    },
  };
}
