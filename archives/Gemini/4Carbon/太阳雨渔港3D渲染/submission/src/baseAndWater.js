import * as THREE from 'three';
import { PALETTE, getSunlightAt } from './palette.js';
import { mulberry32, fbm2D, clamp, lerp, smoothstep } from './prng.js';
import { createAnimeMaterial, addInkEdges, SHARED_ANIME_UNIFORMS } from './materials.js';

export function getSeabedHeight(x, z) {
  // Gently sloping gravel seabed: shallower near inner quay (-3.3), deeper toward outer corner (-4.45)
  const distOuter = clamp((x + 6) * 0.025 + (14 - z) * 0.012, 0, 1);
  const base = lerp(-3.35, -4.45, distOuter);
  const undul = (fbm2D(x * 0.16 + 11.3, z * 0.16 + 7.1, 3) - 0.5) * 0.42;
  return clamp(base + undul, -4.65, -3.05);
}

/**
 * Builds an authentic 4-pod tetrahedral Tetrapod (消波块) geometry.
 */
function createTetrapodGeometry(scale = 1.0) {
  const dirs = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0.9428, -0.3333, 0),
    new THREE.Vector3(-0.4714, -0.3333, 0.8165),
    new THREE.Vector3(-0.4714, -0.3333, -0.8165),
  ];
  const group = new THREE.Group();
  const geos = [];
  const podLen = 0.88 * scale;
  for (const d of dirs) {
    const cyl = new THREE.CylinderGeometry(0.20 * scale, 0.31 * scale, podLen, 10, 1);
    cyl.translate(0, podLen * 0.44, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    cyl.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
    geos.push(cyl);
  }
  const core = new THREE.DodecahedronGeometry(0.34 * scale, 1);
  geos.push(core);
  return mergeSimpleGeometries(geos);
}

export function mergeSimpleGeometries(geos) {
  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(totalVerts * 3);
  const norm = new Float32Array(totalVerts * 3);
  const uv = new Float32Array(totalVerts * 2);
  const indices = new Uint32Array(totalIdx);

  let vOffset = 0;
  let iOffset = 0;
  for (const g of geos) {
    const pAttr = g.attributes.position;
    const nAttr = g.attributes.normal;
    const uAttr = g.attributes.uv;
    pos.set(pAttr.array, vOffset * 3);
    if (nAttr) norm.set(nAttr.array, vOffset * 3);
    if (uAttr) uv.set(uAttr.array, vOffset * 2);

    if (g.index) {
      const idxArr = g.index.array;
      for (let i = 0; i < idxArr.length; i++) {
        indices[iOffset + i] = idxArr[i] + vOffset;
      }
      iOffset += idxArr.length;
    } else {
      for (let i = 0; i < pAttr.count; i++) {
        indices[iOffset + i] = vOffset + i;
      }
      iOffset += pAttr.count;
    }
    vOffset += pAttr.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  return out;
}

export function buildBaseAndWater(scene, textures, reflectionRT, puddleRT) {
  const root = new THREE.Group();
  scene.add(root);
  const rng = mulberry32(777);

  // Materials
  const plinthMat = createAnimeMaterial({ color: PALETTE.plinthTrim, shadowTintStrength: 0.45 });
  const strataMat = createAnimeMaterial({ color: 0x7a8d8e, shadowTintStrength: 0.4 });
  const quayTopMat = createAnimeMaterial({
    color: 0xffffff,
    map: textures.wetConcrete,
    wetness: 0.85,
    roughPatch: 0.7,
  });
  const quaySideCutMat = createAnimeMaterial({
    color: 0xc4d0d2,
    wetness: 0.25,
  });
  const quayExteriorCutMat = createAnimeMaterial({
    color: 0xffffff,
    map: textures.dioramaCutaway,
    wetness: 0.22,
  });
  const seawallMat = createAnimeMaterial({
    color: 0xffffff,
    map: textures.seawallBlocksWide,
    wetness: 0.45,
  });
  const seawallNarrowMat = createAnimeMaterial({
    color: 0xffffff,
    map: textures.seawallBlocks,
    wetness: 0.45,
  });
  const hazardMat = createAnimeMaterial({
    color: 0xffffff,
    map: textures.hazardStripes,
    wetness: 0.55,
  });
  const rustIronMat = createAnimeMaterial({
    color: 0x704334,
    wetness: 0.35,
  });

  // 1. Complete 40x40 Square Diorama Base Rim & Sub-seabed Geological Strata
  const rimGeo = new THREE.BoxGeometry(40.16, 0.52, 40.16);
  const rimMesh = new THREE.Mesh(rimGeo, plinthMat);
  rimMesh.position.set(0, -5.86, 0);
  rimMesh.receiveShadow = true;
  addInkEdges(rimMesh, 30, 0.45);
  root.add(rimMesh);

  // Sub-seabed earth/rock base block under the entire 40x40 square (-5.6 to -4.45)
  const subEarth = new THREE.Mesh(new THREE.BoxGeometry(40.0, 1.25, 40.0), strataMat);
  subEarth.position.set(0, -4.98, 0);
  subEarth.receiveShadow = true;
  addInkEdges(subEarth, 30, 0.35);
  root.add(subEarth);

  // Helper to add a solid concrete quay prism [x0..x1, y0..y1, z0..z1]
  function addQuayBlock(x0, x1, y0, y1, z0, z1, mat = quayTopMat, receive = true) {
    const w = x1 - x0;
    const h = y1 - y0;
    const d = z1 - z0;
    const g = new THREE.BoxGeometry(w, h, d);
    // Scale top & exterior diorama cutaway UVs proportionally to world coordinates!
    const uvAttr = g.attributes.uv;
    const normAttr = g.attributes.normal;
    const posAttr = g.attributes.position;
    for (let i = 0; i < uvAttr.count; i++) {
      const nx = normAttr.getX(i);
      const ny = normAttr.getY(i);
      const nz = normAttr.getZ(i);
      const wx = (x0 + x1) * 0.5 + posAttr.getX(i);
      const wy = (y0 + y1) * 0.5 + posAttr.getY(i);
      const wz = (z0 + z1) * 0.5 + posAttr.getZ(i);
      if (Math.abs(ny) > 0.8) {
        uvAttr.setXY(i, (wx + 20) / 40, (wz + 20) / 40);
      } else {
        const horiz = Math.abs(nx) > 0.8 ? wz : wx;
        const vCut = clamp((wy - (-4.4)) / (1.65 - (-4.4)), 0.01, 0.99);
        uvAttr.setXY(i, (horiz + 20) / 40, vCut);
      }
    }
    // BoxGeometry face order: 0:+X, 1:-X, 2:+Y, 3:-Y, 4:+Z, 5:-Z
    const isFullCutaway = h > 4.5;
    const matNegX = (isFullCutaway && x0 <= -19.9) ? quayExteriorCutMat : quaySideCutMat;
    const matPosZ = (isFullCutaway && z1 >= 19.9) ? quayExteriorCutMat : quaySideCutMat;
    const matNegZ = (isFullCutaway && z0 <= -19.9) ? quayExteriorCutMat : quaySideCutMat;
    const m = new THREE.Mesh(g, [quaySideCutMat, matNegX, mat, quaySideCutMat, matPosZ, matNegZ]);
    m.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
    m.receiveShadow = receive;
    m.castShadow = true;
    addInkEdges(m, 35, 0.28);
    root.add(m);
    return m;
  }

  // 2. Non-overlapping L-shaped Concrete Quay Slabs (top y = +1.65)
  // Far-left hillside foundation (-20..-5, -20..-14)
  addQuayBlock(-20.0, -5.0, -4.4, 1.65, -20.0, -14.0);
  // Zone B: Left Quay Arm (-20..-4, -14..+4)
  addQuayBlock(-20.0, -4.0, -4.4, 1.65, -14.0, 4.0);
  // Zone A West Main (-20..+0.8, +4..+20)
  addQuayBlock(-20.0, 0.8, -4.4, 1.65, 4.0, 20.0);
  // Zone A Mid-South behind slipway (+0.8..+4.2, +8.2..+20)
  addQuayBlock(0.8, 4.2, -4.4, 1.65, 8.2, 20.0);
  // Sub-foundation beneath slipway (+0.8..+4.2, +3.8..+8.2, up to y=-0.55)
  addQuayBlock(0.8, 4.2, -4.4, -0.50, 3.8, 8.2, quaySideCutMat);
  // Zone A East North of Steps (+4.2..+6.0, +4.0..+10.5)
  addQuayBlock(4.2, 6.0, -4.4, 1.65, 4.0, 10.5);
  // Sub-foundation beneath steps & low boarding platform (+4.2..+6.0, +10.5..+16.8, up to y=0.52)
  addQuayBlock(4.2, 6.0, -4.4, 0.52, 10.5, 16.8);
  // Low Boarding Platform jutting slightly to x=+6.35 (+4.2..+6.35, +13.3..+16.8, y=0.10..0.54)
  addQuayBlock(4.2, 6.35, 0.08, 0.54, 13.3, 16.8);
  // Zone A East South of Boarding Platform (+4.2..+6.0, +16.8..+20.0)
  addQuayBlock(4.2, 6.0, -4.4, 1.65, 16.8, 20.0);

  // 4 Concrete Steps descending from y=1.65 (at z=10.5) down to y=0.54 (at z=13.3) + Galvanized Pipe Step Handrail
  const stepCount = 4;
  for (let s = 0; s < stepCount; s++) {
    const sz0 = 10.5 + s * 0.7;
    const sz1 = sz0 + 0.72;
    const sy1 = 1.65 - (s + 1) * 0.22;
    addQuayBlock(4.2, 6.02, 0.52, sy1, sz0, sz1);
  }
  {
    // Continuous bent galvanized pipe coastal stair handrail with smooth return loops at both ends!
    const railMat = createAnimeMaterial({ color: 0xbacbd0, wetness: 0.45 });
    const loopPts = [
      new THREE.Vector3(4.28, 1.65, 10.42),
      new THREE.Vector3(4.28, 2.24, 10.42),
      new THREE.Vector3(4.28, 2.28, 10.62),
      new THREE.Vector3(4.28, 1.18, 13.22),
      new THREE.Vector3(4.28, 1.12, 13.34),
      new THREE.Vector3(4.28, 0.54, 13.34),
    ];
    const rCurve = new THREE.CatmullRomCurve3(loopPts, false, 'catmullrom', 0.22);
    const topPipe = new THREE.Mesh(new THREE.TubeGeometry(rCurve, 22, 0.020, 7, false), railMat);
    const midCurve = new THREE.LineCurve3(
      new THREE.Vector3(4.28, 1.94, 10.44),
      new THREE.Vector3(4.28, 0.84, 13.32)
    );
    const midPipe = new THREE.Mesh(new THREE.TubeGeometry(midCurve, 4, 0.014, 6, false), railMat);
    root.add(topPipe, midPipe);
  }

  // Concrete Boat Slipway Ramp (斜坡式滑道 スロープ): x in [0.8, 4.2], z from 8.2 (y=1.65) down to 3.6 (y=-0.52)
  {
    const rampLen = Math.hypot(8.2 - 3.6, 1.65 - (-0.52));
    const rampAngle = Math.atan2(1.65 - (-0.52), 8.2 - 3.6);
    const rampGeo = new THREE.BoxGeometry(3.38, 0.28, rampLen);
    const rampMesh = new THREE.Mesh(rampGeo, quayTopMat);
    rampMesh.position.set(2.5, (1.65 - 0.52) * 0.5 - 0.12, (8.2 + 3.6) * 0.5);
    rampMesh.rotation.x = rampAngle; // tilts down toward -Z (z=3.6 is lower, z=8.2 is higher!)
    // Verify tilt: in Three.js, rotating +angle around X moves +Z down and -Z up!
    // Wait: let's check! y' = y*cos(a) - z*sin(a). At local z = +rampLen/2 (which corresponds to world z=8.2), we want y' HIGHER (+1.65)!
    // So sin(a) must be NEGATIVE -> rotation.x = -rampAngle! Great catch!
    rampMesh.rotation.x = -rampAngle;
    rampMesh.receiveShadow = true;
    addInkEdges(rampMesh, 30, 0.3);
    root.add(rampMesh);

    // Anti-slip grooves across concrete slipway
    const grooveMat = createAnimeMaterial({ color: 0x8f9fa2, wetness: 0.7 });
    for (let i = 1; i <= 8; i++) {
      const f = i / 9;
      const gz = lerp(3.9, 8.0, f);
      const gy = lerp(-0.42, 1.56, f);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.03, 0.07), grooveMat);
      strip.position.set(2.5, gy + 0.02, gz);
      strip.rotation.x = -rampAngle;
      root.add(strip);
    }
  }

  // Short Breakwater (短防波堤) extending from Left Quay end (-5.0, -14.3) out to (+9.2, -14.3)
  addQuayBlock(-5.0, 9.4, -4.2, 1.82, -15.3, -13.3);
  // Breakwater outer wave parapet wall
  addQuayBlock(-4.8, 7.6, 1.82, 2.42, -15.3, -14.75);

  // 3. Seawall Cladding Panels (混凝土岸壁剖面: layered blocks + tidal lines from y=-4.4 to +1.65)
  function addSeawallFace(cx, cy, cz, width, height, rotY, wide = true) {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      wide ? seawallMat : seawallNarrowMat
    );
    plane.position.set(cx, cy, cz);
    plane.rotation.y = rotY;
    plane.receiveShadow = true;
    root.add(plane);
  }
  // East foreground seawall facing +X (x = +6.03)
  addSeawallFace(6.03, -1.38, 7.25, 6.5, 6.06, Math.PI / 2, false);
  addSeawallFace(6.03, -1.38, 18.4, 3.2, 6.06, Math.PI / 2, false);
  addSeawallFace(6.03, -1.95, 11.9, 2.8, 4.9, Math.PI / 2, false);
  addSeawallFace(6.37, -1.95, 15.05, 3.5, 4.9, Math.PI / 2, false);
  // Inner berth seawall facing +X (x = -3.97, z in [-13.3, +4.0])
  addSeawallFace(-3.97, -1.38, -4.65, 17.3, 6.06, Math.PI / 2, true);
  // Inner L-corner seawalls facing -Z (z = +3.97)
  addSeawallFace(-1.6, -1.38, 3.97, 4.8, 6.06, Math.PI, false);
  addSeawallFace(5.1, -1.38, 3.97, 1.8, 6.06, Math.PI, false);
  // Breakwater seawalls facing +Z and -Z and +X
  addSeawallFace(2.2, -1.19, -13.27, 14.4, 6.02, 0, true);
  addSeawallFace(2.2, -1.19, -15.33, 14.4, 6.02, Math.PI, true);
  addSeawallFace(9.43, -1.19, -14.3, 2.05, 6.02, Math.PI / 2, false);

  // 4. Yellow & Black Diagonal Hazard Wheel-Guard Curbs (边缘护轮坎刷有斜纹黄黑警示条)
  function addHazardCurb(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    const g = new THREE.BoxGeometry(0.24, 0.20, len);
    // Align UVs on ALL faces along curb length so both top & sides show crisp diagonal stripes!
    const uvAttr = g.attributes.uv;
    const normAttr = g.attributes.normal;
    const posAttr = g.attributes.position;
    const tileScale = len / 12.0;
    for (let i = 0; i < uvAttr.count; i++) {
      const nx = Math.abs(normAttr.getX(i));
      const ny = Math.abs(normAttr.getY(i));
      const pz = posAttr.getZ(i) + len * 0.5;
      if (ny > 0.8) {
        uvAttr.setXY(i, (pz / 12.0), (posAttr.getX(i) + 0.12) / 0.24);
      } else if (nx > 0.8) {
        uvAttr.setXY(i, (pz / 12.0), (posAttr.getY(i) + 0.10) / 0.20);
      } else {
        uvAttr.setXY(i, uvAttr.getX(i) * 0.08 * tileScale, uvAttr.getY(i));
      }
    }
    const curb = new THREE.Mesh(g, hazardMat);
    curb.position.set((x0 + x1) * 0.5, 1.75, (z0 + z1) * 0.5);
    curb.rotation.y = ang;
    curb.castShadow = true;
    curb.receiveShadow = true;
    addInkEdges(curb, 30, 0.38);
    root.add(curb);
  }
  addHazardCurb(-4.14, -13.1, -4.14, 3.88);
  addHazardCurb(-4.02, 4.14, 0.65, 4.14);
  addHazardCurb(4.35, 4.14, 5.88, 4.14);
  addHazardCurb(5.88, 4.25, 5.88, 10.35);
  addHazardCurb(5.88, 16.95, 5.88, 19.85);

  // 5. Rusted Iron Ladders & Mooring Rings on Seawall (系船环与锈蚀铁梯沿岸壁向下延伸)
  function addIronLadder(x, z, topY, bottomY, rotY) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const h = topY - bottomY;
    for (const sx of [-0.22, 0.22]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h, 6), rustIronMat);
      rail.position.set(sx, (topY + bottomY) * 0.5, 0.06);
      g.add(rail);
      // Curved top grab loops on quay edge
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.022, 6, 12, Math.PI), rustIronMat);
      arch.position.set(sx, topY, -0.04);
      arch.rotation.y = Math.PI / 2;
      g.add(arch);
    }
    const rungs = Math.floor(h / 0.34);
    for (let r = 0; r < rungs; r++) {
      const ry = topY - 0.24 - r * 0.34;
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6), rustIronMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, ry, 0.06);
      g.add(rung);
    }
    root.add(g);
  }
  // Foreground seawall ladder (extending clearly underwater!) + inner berth ladder
  addIronLadder(6.04, 7.6, 1.66, -2.4, Math.PI / 2);
  addIronLadder(-3.96, -2.6, 1.66, -2.1, Math.PI / 2);

  function addMooringRing(x, y, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.04), rustIronMat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 7, 14), rustIronMat);
    ring.position.set(0, -0.09, 0.05);
    ring.rotation.x = 0.22;
    g.add(plate, ring);
    root.add(g);
  }
  for (const z of [5.6, 9.2, 18.0]) addMooringRing(6.04, 0.88, z, Math.PI / 2);
  addMooringRing(6.36, 0.34, 15.0, Math.PI / 2);
  for (const z of [1.8, -1.2, -5.8, -9.8]) addMooringRing(-3.96, 0.92, z, Math.PI / 2);

  // 6. Barnacles & Oyster Shells on Lower Seawalls (岸壁底部附着藤壶、牡蛎壳)
  {
    const barnacleGeo = new THREE.CylinderGeometry(0.022, 0.058, 0.048, 6);
    const barnacleMat = createAnimeMaterial({ color: 0xd5ded8, shadowTintStrength: 0.45 });
    const oysterGeo = new THREE.SphereGeometry(0.068, 7, 5);
    oysterGeo.scale(1.25, 0.45, 0.95);
    const oysterMat = createAnimeMaterial({ color: 0xb7c4be, shadowTintStrength: 0.45 });

    const count = 220;
    const bInst = new THREE.InstancedMesh(barnacleGeo, barnacleMat, count);
    const oInst = new THREE.InstancedMesh(oysterGeo, oysterMat, 120);
    const dummy = new THREE.Object3D();

    // Wall segments where barnacles & oysters attach
    const wallSpans = [
      { x0: 6.04, z0: 4.3, x1: 6.04, z1: 19.6, nx: 1, nz: 0 },
      { x0: -3.96, z0: -13.0, x1: -3.96, z1: 3.7, nx: 1, nz: 0 },
      { x0: -3.7, z0: 3.96, x1: 5.7, z1: 3.96, nx: 0, nz: -1 },
      { x0: -4.5, z0: -13.26, x1: 9.0, z1: -13.26, nx: 0, nz: 1 },
    ];

    for (let i = 0; i < count; i++) {
      const seg = wallSpans[i % wallSpans.length];
      const f = rng();
      const px = lerp(seg.x0, seg.x1, f);
      const pz = lerp(seg.z0, seg.z1, f);
      const py = -2.3 + Math.pow(rng(), 0.7) * 2.42; // Concentrated around -2.3 .. +0.12
      dummy.position.set(px, py, pz);
      dummy.rotation.set(
        seg.nz * (Math.PI / 2) + (rng() - 0.5) * 0.3,
        rng() * Math.PI * 2,
        -seg.nx * (Math.PI / 2) + (rng() - 0.5) * 0.3
      );
      const s = 0.7 + rng() * 1.3;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      bInst.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < 120; i++) {
      const seg = wallSpans[i % wallSpans.length];
      const f = rng();
      const px = lerp(seg.x0, seg.x1, f);
      const pz = lerp(seg.z0, seg.z1, f);
      const py = -2.6 + rng() * 2.5;
      dummy.position.set(px, py, pz);
      dummy.rotation.set(rng() * 0.5, rng() * Math.PI, rng() * 0.5);
      const s = 0.8 + rng() * 1.25;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      oInst.setMatrixAt(i, dummy.matrix);
    }
    root.add(bInst, oInst);
  }

  // 7. Gravel Seabed Mesh + Underwater Rocks, Sunken Old Tires, Anchor & Chain, Seagrass, Seaweed
  {
    const segX = 56;
    const segZ = 56;
    const bedGeo = new THREE.PlaneGeometry(40, 40, segX, segZ);
    bedGeo.rotateX(-Math.PI / 2);
    const p = bedGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      p.setY(i, getSeabedHeight(x, z));
    }
    bedGeo.computeVertexNormals();
    const bedMat = createAnimeMaterial({
      color: 0xb6cfcb,
      map: textures.seabedGravel,
      shadowTintStrength: 0.48,
    });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.receiveShadow = true;
    root.add(bedMesh);

    // Scattered low-profile underwater cobbles (kept gentle so depth outlines stay calm & clean!)
    const rockGeo = new THREE.DodecahedronGeometry(0.26, 1);
    const rockMat = createAnimeMaterial({ color: 0x769492, shadowTintStrength: 0.42 });
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, 36);
    const dummy = new THREE.Object3D();
    let rIdx = 0;
    while (rIdx < 36) {
      const rx = -3.2 + rng() * 22.4;
      const rz = -19.0 + rng() * 38.0;
      if (rz > 4.0 && rx < 6.2) continue; // Inside foreground quay
      if (rz > -15.5 && rz < -13.1 && rx < 9.5) continue; // Inside breakwater
      const ry = getSeabedHeight(rx, rz);
      dummy.position.set(rx, ry - 0.02, rz);
      dummy.rotation.set(rng() * 0.4, rng() * 3, rng() * 0.4);
      dummy.scale.set(0.7 + rng() * 1.4, 0.16 + rng() * 0.16, 0.7 + rng() * 1.3);
      dummy.updateMatrix();
      rockInst.setMatrixAt(rIdx++, dummy.matrix);
    }
    root.add(rockInst);

    // Sunken Old Tires (沉底的旧轮胎) clearly visible through water cross-section & top
    const tireMat = createAnimeMaterial({ color: 0x2c373b, shadowTintStrength: 0.4 });
    const sunkenTireCoords = [
      [11.8, 15.6, 0.18, 0.25],
      [15.4, 12.2, 0.42, -0.3],
      [9.4, 7.8, -0.15, 0.12],
      [16.2, -3.4, 0.28, 0.4],
      [8.6, -8.5, -0.22, -0.18],
    ];
    for (const [tx, tz, rx, rz] of sunkenTireCoords) {
      const ty = getSeabedHeight(tx, tz);
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.19, 10, 18), tireMat);
      tire.position.set(tx, ty + 0.14, tz);
      tire.rotation.set(Math.PI / 2 + rx, rng() * Math.PI, rz);
      addInkEdges(tire, 35, 0.35);
      root.add(tire);
    }

    // Sunken Anchor & Heavy Anchor Chain (沉底的锚与锚链)
    const chainMat = createAnimeMaterial({ color: 0x5d443b, shadowTintStrength: 0.42 });
    const anchorGroup = new THREE.Group();
    const ax = 14.4, az = 14.2;
    const ay = getSeabedHeight(ax, az) + 0.16;
    anchorGroup.position.set(ax, ay, az);
    anchorGroup.rotation.set(0.28, 0.65, 1.25);
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.35, 8), chainMat);
    const flukeArm = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.065, 7, 14, Math.PI * 0.85), chainMat);
    flukeArm.position.set(0, -0.45, 0);
    flukeArm.rotation.z = Math.PI * 1.07;
    const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.82, 7), chainMat);
    stock.position.set(0, 0.48, 0);
    stock.rotation.z = Math.PI / 2;
    const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 12), chainMat);
    topRing.position.set(0, 0.72, 0);
    anchorGroup.add(shank, flukeArm, stock, topRing);
    root.add(anchorGroup);

    // 26-link heavy anchor chain snaking across the gravel seabed
    const chainCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(14.1, getSeabedHeight(14.1, 14.0) + 0.11, 14.0),
      new THREE.Vector3(12.6, getSeabedHeight(12.6, 12.2) + 0.09, 12.2),
      new THREE.Vector3(10.8, getSeabedHeight(10.8, 10.8) + 0.09, 10.8),
      new THREE.Vector3(8.5, getSeabedHeight(8.5, 9.4) + 0.12, 9.4),
      new THREE.Vector3(6.2, -2.6, 8.6),
    ]);
    const linkGeo = new THREE.TorusGeometry(0.105, 0.033, 6, 10);
    linkGeo.scale(1.45, 0.86, 1.0);
    const linkCount = 46;
    for (let i = 0; i < linkCount; i++) {
      const u = i / (linkCount - 1);
      const pt = chainCurve.getPointAt(u);
      const tan = chainCurve.getTangentAt(u);
      const link = new THREE.Mesh(linkGeo, chainMat);
      link.position.copy(pt);
      link.lookAt(pt.clone().add(tan));
      // Rotate Y by 90 deg so torus major axis aligns ALONG chain tangent, then alternate 90 deg roll so links interlock!
      link.rotateY(Math.PI / 2);
      if (i % 2 === 1) link.rotateX(Math.PI / 2);
      root.add(link);
    }
  }

  // 8. Swaying Seawall Seaweed & Seabed Seagrass (海藻与水下海草)
  const swayingPlants = [];
  {
    const weedMat = createAnimeMaterial({ color: 0x3b7d64, side: THREE.DoubleSide, shadowTintStrength: 0.4 });
    const grassMat = createAnimeMaterial({ color: 0x4b9977, side: THREE.DoubleSide, shadowTintStrength: 0.35 });

    function makeBladeGeo(h, w) {
      const g = new THREE.PlaneGeometry(w, h, 1, 5);
      g.translate(0, h * 0.5, 0);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const f = y / h;
        pos.setX(i, pos.getX(i) * (1.0 - f * 0.72));
      }
      g.computeVertexNormals();
      return g;
    }
    const bladeGeo = makeBladeGeo(0.95, 0.14);
    const shortBladeGeo = makeBladeGeo(0.68, 0.13);

    // Seabed seagrass clumps (visible through side wall & top)
    const grassSpots = [
      [8.4, 16.5], [10.6, 17.8], [13.2, 16.2], [16.8, 15.4], [18.1, 10.5],
      [12.2, 8.4], [16.5, 4.2], [8.8, 1.5], [14.8, -1.8], [17.8, -6.5],
      [11.2, -6.2], [7.5, -10.8], [15.6, -11.5], [18.2, -15.8], [4.2, -17.2],
      [11.8, -18.2],
    ];
    for (const [gx, gz] of grassSpots) {
      const clump = new THREE.Group();
      const gy = getSeabedHeight(gx, gz);
      clump.position.set(gx, gy - 0.04, gz);
      const blades = 5 + Math.floor(rng() * 4);
      for (let b = 0; b < blades; b++) {
        const m = new THREE.Mesh(bladeGeo, grassMat);
        const ang = (b / blades) * Math.PI * 2 + rng() * 0.5;
        m.position.set(Math.cos(ang) * 0.14, 0, Math.sin(ang) * 0.14);
        m.rotation.y = rng() * Math.PI;
        m.rotation.z = (rng() - 0.5) * 0.25;
        m.scale.setScalar(0.75 + rng() * 0.65);
        clump.add(m);
      }
      root.add(clump);
      swayingPlants.push({ group: clump, phase: rng() * 10, amp: 0.18 + rng() * 0.08 });
    }

    // Seawall clinging seaweed tufts (3.1 岸壁底部附着藤壶、牡蛎壳，以及随水轻轻摆动的海藻)
    const wallWeedSpots = [
      [6.06, -0.65, 6.2], [6.06, -1.25, 7.3], [6.06, -1.55, 8.6], [6.06, -0.85, 10.1],
      [6.06, -1.35, 11.6], [6.38, -0.75, 13.8], [6.38, -1.25, 15.2], [6.06, -1.3, 17.6],
      [6.06, -0.7, 19.0], [-3.94, -0.9, 2.4], [-3.94, -1.5, -0.8],
      [-3.94, -1.1, -4.6], [-3.94, -1.3, -8.5], [-3.94, -0.8, -11.6], [2.5, -1.1, -13.22],
      [6.4, -1.2, -13.22],
    ];
    for (const [wx, wy, wz] of wallWeedSpots) {
      const tuft = new THREE.Group();
      tuft.position.set(wx, wy, wz);
      for (let b = 0; b < 6; b++) {
        const m = new THREE.Mesh(shortBladeGeo, weedMat);
        m.rotation.set(0.28 + rng() * 0.35, rng() * Math.PI, -0.52 + rng() * 0.35);
        m.scale.setScalar(0.85 + rng() * 0.65);
        tuft.add(m);
      }
      root.add(tuft);
      swayingPlants.push({ group: tuft, phase: rng() * 10, amp: 0.24 });
    }
  }

  // 9. Underwater Fish Schools (水中有小鱼游动; 镜头推近时散开、过一会儿再聚拢)
  const fishSchools = [];
  {
    // Sleek anime minnow/bream geometry facing +X
    const fishBody = new THREE.SphereGeometry(0.11, 8, 6);
    fishBody.scale(2.1, 0.72, 0.42);
    const tail = new THREE.ConeGeometry(0.09, 0.18, 4);
    tail.rotateZ(Math.PI / 2);
    tail.scale(1.0, 1.0, 0.35);
    tail.translate(-0.26, 0, 0);
    const fishGeo = mergeSimpleGeometries([fishBody, tail]);
    const fishMat1 = createAnimeMaterial({ color: 0x8de0dc, shadowTintStrength: 0.3 });
    const fishMat2 = createAnimeMaterial({ color: 0xf2be6b, shadowTintStrength: 0.3 });

    const centers = [
      { cx: 13.8, cy: -1.75, cz: 15.2, count: 10, mat: fishMat1, rx: 2.2, rz: 1.8 }, // Right near front-right water wall!
      { cx: 15.2, cy: -2.15, cz: 3.5, count: 9, mat: fishMat2, rx: 2.4, rz: 2.2 },
      { cx: 11.4, cy: -1.85, cz: -7.5, count: 8, mat: fishMat1, rx: 2.0, rz: 2.0 },
    ];

    centers.forEach((sc, sIdx) => {
      const members = [];
      for (let i = 0; i < sc.count; i++) {
        const mesh = new THREE.Mesh(fishGeo, sc.mat);
        const s = 0.68 + rng() * 0.52;
        mesh.scale.setScalar(s);
        root.add(mesh);
        members.push({
          mesh,
          baseScale: s,
          angleOffset: (i / sc.count) * Math.PI * 2 + rng() * 0.4,
          radMul: 0.45 + rng() * 0.75,
          yOff: (rng() - 0.5) * 0.65,
          speed: 0.48 + rng() * 0.18,
          scatterDir: new THREE.Vector3(rng() - 0.5, (rng() - 0.5) * 0.35, rng() - 0.5).normalize(),
        });
      }
      fishSchools.push({
        ...sc,
        sIdx,
        members,
        scatterTriggerTime: -999,
        wasClose: false,
      });
    });
  }

  // 10. Tetrapods & Shore Foam (消波块与岸边浪花)
  const tetrapodFoamMeshes = [];
  {
    const tetraGeo = createTetrapodGeometry(1.05);
    const tetraMat = createAnimeMaterial({
      color: 0xdbe3e4,
      wetness: 0.65,
      roughPatch: 0.5,
    });

    // Cel-shaded shore foam ring shader around tetrapods
    const foamRingMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: SHARED_ANIME_UNIFORMS.uTime,
        uWakeBoost: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uWakeBoost;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vec2 c = vUv * 2.0 - 1.0;
          float r = length(c);
          float ang = atan(c.y, c.x);
          float wob = sin(ang * 5.0 + uTime * 1.9 + vWorldPos.x) * 0.06
                    + cos(ang * 8.0 - uTime * 2.4 + vWorldPos.z) * 0.04;
          float pulse = 0.56 + 0.09 * sin(uTime * 2.1 + vWorldPos.x * 0.8 + vWorldPos.z * 0.7) + uWakeBoost * 0.10;
          float outer = (1.0 - smoothstep(pulse - 0.04, pulse + 0.03, r + wob)) * (1.0 - smoothstep(0.80, 0.94, r));
          float inner = smoothstep(0.30, 0.42, r + wob * 0.6);
          // Cel-stepped lacy foam holes (3.3 细小、克制的白色泡沫)
          float lace = sin(ang * 11.0 - uTime * 1.5) * cos(r * 16.0 - uTime * 2.2);
          float alpha = outer * inner * smoothstep(-0.22, 0.18, lace) * (0.65 + uWakeBoost * 0.25);
          if (alpha < 0.08) discard;
          gl_FragColor = vec4(0.96, 0.99, 0.99, alpha);
        }
      `,
    });

    const tetrapodPlacements = [
      // Breakwater tip & flank cluster
      [7.4, -0.15, -15.8, 0.2, 0.5, 0.1, 1.05],
      [8.8, -0.22, -16.0, 0.6, 1.4, -0.2, 1.12],
      [10.1, -0.18, -15.4, -0.3, 2.1, 0.4, 1.08],
      [10.8, -0.28, -14.2, 0.4, 0.8, -0.3, 1.0],
      [10.3, -0.20, -13.0, -0.2, 1.9, 0.2, 1.06],
      [9.2, 0.35, -15.3, 0.5, 2.6, 0.1, 0.96],
      [11.6, -0.42, -15.1, 0.1, 0.3, 0.5, 0.98],
      [6.1, -0.25, -15.8, -0.4, 1.1, 0.2, 1.0],
      [4.7, -0.30, -15.9, 0.3, 2.4, -0.1, 0.96],
      [11.4, -0.36, -13.6, -0.5, 1.5, 0.3, 0.95],
      // Base outer corner cluster (+16..+19, -18..-15)
      [16.8, -0.28, -18.2, 0.2, 0.9, -0.2, 1.1],
      [18.2, -0.22, -17.6, -0.3, 1.7, 0.4, 1.08],
      [17.6, -0.32, -16.5, 0.5, 2.5, -0.1, 1.0],
      [18.6, 0.28, -18.5, 0.1, 0.4, 0.3, 0.98],
      // Foreground seawall corner cluster (strictly inside x >= 7.0, z <= 18.3 so zero pod pokes past z=20!)
      [7.0, -0.14, 17.6, 0.2, 1.2, -0.2, 1.02],
      [8.1, -0.24, 18.2, -0.4, 2.2, 0.3, 1.00],
      [7.3, 0.30, 18.3, 0.3, 0.6, 0.1, 0.92],
      [9.1, -0.34, 18.2, -0.2, 1.8, -0.4, 0.95],
      [7.0, -0.28, 16.6, 0.5, 2.9, 0.2, 0.94],
    ];

    const foamPlaneGeo = new THREE.PlaneGeometry(2.35, 2.35);
    foamPlaneGeo.rotateX(-Math.PI / 2);

    for (const [tx, ty, tz, rx, ry, rz, sc] of tetrapodPlacements) {
      const m = new THREE.Mesh(tetraGeo, tetraMat);
      m.position.set(tx, ty, tz);
      m.rotation.set(rx, ry, rz);
      m.scale.setScalar(sc);
      m.castShadow = true;
      m.receiveShadow = true;
      addInkEdges(m, 38, 0.30);
      root.add(m);

      if (ty < 0.25) {
        const fm = new THREE.Mesh(foamPlaneGeo, foamRingMat);
        fm.position.set(tx, 0.03, tz);
        fm.scale.setScalar(sc * (0.9 + rng() * 0.25));
        root.add(fm);
        tetrapodFoamMeshes.push(fm);
      }
    }
    tetrapodFoamMeshes.sharedMat = foamRingMat;
  }

  // 11. Semi-Transparent Sea-Green Water Cross-Section Walls (半透明青绿色水体剖面)
  const waterCutMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: SHARED_ANIME_UNIFORMS.uTime,
      uTopColor: { value: new THREE.Color(0x6bd4ce) },
      uMidColor: { value: new THREE.Color(0x3ba8a5) },
      uDeepColor: { value: new THREE.Color(0x1f6478) },
      uSkyDimming: SHARED_ANIME_UNIFORMS.uSkyDimming,
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying float vIsTop;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        // Match wave profile along the top edge (y near 0)
        if (wp.y > -0.08) {
          float w = sin(wp.x * 0.55 + uTime * 1.25) * 0.045
                  + cos(wp.z * 0.48 - uTime * 1.05) * 0.04;
          wp.y += w;
          vIsTop = 1.0;
        } else {
          vIsTop = 0.0;
        }
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uDeepColor;
      uniform float uSkyDimming;
      varying vec3 vWorldPos;
      varying float vIsTop;
      void main() {
        float depthFrac = clamp(-vWorldPos.y / 4.4, 0.0, 1.0);
        vec3 col = mix(uTopColor, uMidColor, smoothstep(0.0, 0.45, depthFrac));
        col = mix(col, uDeepColor, smoothstep(0.45, 1.0, depthFrac));
        col *= (1.0 - 0.22 * uSkyDimming);

        // Subtle underwater sun-ray vertical shimmer in the water cross-section!
        float ray = sin(vWorldPos.x * 0.9 + vWorldPos.z * 0.8 + vWorldPos.y * 0.4 - uTime * 0.7);
        float rayMask = smoothstep(0.55, 0.95, ray) * (1.0 - depthFrac) * 0.14 * (1.0 - uSkyDimming);
        col += vec3(0.85, 0.98, 0.92) * rayMask;

        // Crisp bright meniscus line right at the waterline (y ~ 0)
        float meniscus = 1.0 - smoothstep(0.0, 0.075, abs(vWorldPos.y));
        col = mix(col, vec3(0.93, 0.99, 0.99), meniscus * 0.75);

        // Keep crystal-clear & transparent so underwater seabed, tires, anchor & fish pop clearly!
        float alpha = mix(0.30, 0.46, depthFrac) + meniscus * 0.34;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  function buildWaterWallStrip(x0, z0, x1, z1, segs) {
    const pos = [];
    const idx = [];
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const x = lerp(x0, x1, f);
      const z = lerp(z0, z1, f);
      const bedY = getSeabedHeight(x, z) - 0.05;
      pos.push(x, 0.0, z);
      pos.push(x, bedY, z);
      if (i < segs) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, waterCutMat);
    m.renderOrder = 4;
    root.add(m);
  }
  // Front water cross-section (z = +20, x from +6.0 to +20.0)
  buildWaterWallStrip(6.0, 20.0, 20.0, 20.0, 32);
  // Right water cross-section (x = +20, z from +20.0 to -20.0)
  buildWaterWallStrip(20.0, 20.0, 20.0, -20.0, 64);
  // Back water cross-section (z = -20, x from +20.0 to -5.0)
  buildWaterWallStrip(20.0, -20.0, -5.0, -20.0, 44);

  // 12. Harbor Water Surface with Posterized Anime Reflections (9.4 色块化水面倒影)
  // Build custom water surface mesh covering ONLY the water portion of [-20..20]x[-20..20]
  const MAX_RIPPLES = 10;
  const rippleArray = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0));

  const waterSurfaceUniforms = {
    uTime: SHARED_ANIME_UNIFORMS.uTime,
    uReflectionTex: { value: reflectionRT.texture },
    uCloudCenter: SHARED_ANIME_UNIFORMS.uCloudCenter,
    uCloudStrength: SHARED_ANIME_UNIFORMS.uCloudStrength,
    uSkyDimming: SHARED_ANIME_UNIFORMS.uSkyDimming,
    uGustFront: { value: -30.0 },
    uGustActive: { value: 0.0 },
    uBoatPos: { value: new THREE.Vector2(0.5, -10.8) },
    uBoatDir: { value: new THREE.Vector2(1.0, 0.0) },
    uBoatSpeed: { value: 0.0 },
    uSeawallWakeBoost: { value: 0.0 },
    uRipples: { value: rippleArray }, // xy = world xz, z = startTime, w = strength
  };

  const waterSurfaceMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: waterSurfaceUniforms,
    vertexShader: `
      uniform float uTime;
      uniform vec2 uBoatPos;
      uniform float uBoatSpeed;
      varying vec3 vWorldPos;
      varying vec4 vClipPos;

      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float w = sin(wp.x * 0.55 + uTime * 1.25) * 0.045
                + cos(wp.z * 0.48 - uTime * 1.05) * 0.04
                + sin((wp.x - wp.z) * 0.9 + uTime * 1.8) * 0.018;
        wp.y += w;
        vWorldPos = wp.xyz;
        vClipPos = projectionMatrix * viewMatrix * wp;
        gl_Position = vClipPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uReflectionTex;
      uniform float uCloudCenter;
      uniform float uCloudStrength;
      uniform float uSkyDimming;
      uniform float uGustFront;
      uniform float uGustActive;
      uniform vec2 uBoatPos;
      uniform vec2 uBoatDir;
      uniform float uBoatSpeed;
      uniform float uSeawallWakeBoost;
      uniform vec4 uRipples[${MAX_RIPPLES}];

      varying vec3 vWorldPos;
      varying vec4 vClipPos;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec2 xz = vWorldPos.xz;

        // Sea-gust advancing fine ripple band (10.2 海面先泛起一片细碎波纹向码头推进)
        float proj = -0.76 * xz.x + 0.65 * xz.y;
        float distGust = uGustFront - proj;
        float gustBand = 0.0;
        if (uGustActive > 0.001 && distGust > -2.0 && distGust < 20.0) {
          gustBand = smoothstep(-2.0, 2.5, distGust) * (1.0 - smoothstep(10.0, 20.0, distGust)) * uGustActive;
        }

        // Camera-relative horizontal wave axis so posterized reflection fragments slice HORIZONTALLY from every 360° angle!
        // (9.4 碎块边缘利落，像动画背景美术中的水面概括；随波浪缓慢变形、碎裂与重组)
        vec2 camDelta = xz - cameraPosition.xz;
        float viewDist = length(camDelta);
        vec2 viewFwd = camDelta / max(viewDist, 0.001);
        vec2 viewRight = vec2(-viewFwd.y, viewFwd.x);
        float across = dot(xz, viewRight);

        float waveRows = viewDist * 5.6 + sin(across * 1.35 + uTime * 1.18) * 0.85;
        float bandIdx = floor(waveRows);
        float bandPhase = hash(vec2(bandIdx, 17.3));
        float waveShiftX = sin(bandIdx * 0.85 + uTime * 1.55 + bandPhase * 6.28) * 0.018
                         + sin(xz.x * 8.0 + xz.y * 7.0 + uTime * 5.5) * 0.012 * gustBand;
        float waveShiftY = cos(across * 2.4 + uTime * 1.25) * 0.012;

        // Screen-space planar reflection UV (reflCam mirrored across y=0 with up=(0,1,0): x matches, y flips)
        vec2 ndc = vClipPos.xy / max(vClipPos.w, 0.0001);
        vec2 reflUv = vec2(0.5 + ndc.x * 0.5, 0.5 - ndc.y * 0.5);
        reflUv = clamp(reflUv + vec2(waveShiftX, waveShiftY), 0.004, 0.996);

        vec4 rawRefl4 = texture2D(uReflectionTex, reflUv);
        vec3 rawRefl = rawRefl4.rgb;
        // Strict object reflection mask (alpha == 1 on real harbor objects/boats/lighthouse, 0 on sky & faint rain!)
        float objMask = smoothstep(0.42, 0.72, rawRefl4.a);

        // --- POSTERIZED ANIME REFLECTION (9.4 将船只及港口景物的倒影概括为青绿、深蓝与白色的碎块) ---
        float lum = dot(rawRefl, vec3(0.299, 0.587, 0.114));
        float warmth = rawRefl.r - rawRefl.b;
        float breakN = vnoise(vec2(across * 2.1 + uTime * 0.40, bandIdx * 0.68 - uTime * 0.52));
        float ribbonCut = step(0.24, fract(waveRows + (breakN - 0.5) * 0.32));

        vec3 colAquaLight = vec3(0.20, 0.60, 0.58);   // 海玻璃浅青绿 (linear)
        vec3 colSeaGreen  = vec3(0.105, 0.42, 0.45);  // 青绿碎块 (linear)
        vec3 colDeepBlue  = vec3(0.028, 0.125, 0.235);// 深蓝碎块 (linear)
        vec3 colWhiteBlk  = vec3(0.90, 0.98, 0.98);   // 白色船影碎块 (linear)

        // 1. Base water flat cel bands (sea-glass cyan & jade green)
        float waterBand = smoothstep(0.48, 0.50, vnoise(xz * 0.42 + vec2(uTime * 0.08, -uTime * 0.06)) + sin(xz.x * 0.35 + xz.y * 0.25 + uTime * 0.38) * 0.16);
        vec3 posterWater = mix(colSeaGreen, colAquaLight, waterBand);

        // 2. Crisp Cyan-Green & Deep Marine Blue reflection blocks on reflected harbor structures & boats!
        float isMidRefl = objMask * (1.0 - smoothstep(0.55, 0.57, lum + (breakN - 0.5) * 0.10));
        posterWater = mix(posterWater, colSeaGreen * 0.84, isMidRefl * 0.88);

        float isDeepBlue = objMask * (1.0 - smoothstep(0.32, 0.34, lum + (breakN - 0.5) * 0.12 - max(warmth, 0.0) * 0.26));
        posterWater = mix(posterWater, colDeepBlue, isDeepBlue * ribbonCut * 0.92);

        // 3. Crisp Pure White reflection blocks strictly on bright reflected hulls, cabins & lighthouse white bands!
        float isWhiteHull = objMask * smoothstep(0.56, 0.58, lum + (breakN - 0.5) * 0.10) * (1.0 - smoothstep(0.18, 0.28, warmth));
        float hullBlock = step(0.48, isWhiteHull) * ribbonCut;
        posterWater = mix(posterWater, colWhiteBlk, hullBlock * 0.94);

        // Sea-gust fine surface ripple highlights sweeping toward the quay!
        if (gustBand > 0.01) {
          float fineRip = sin(proj * 9.5 - uTime * 9.0 + vnoise(xz * 3.0) * 3.5);
          float gustLine = smoothstep(0.72, 0.82, fineRip) * gustBand;
          posterWater = mix(posterWater, vec3(0.84, 0.96, 0.96), gustLine * 0.55);
        }

        // Concentric raindrop & drip ripples (10.1 水面不断泛起细小的同心涟漪)
        float rippleSum = 0.0;
        for (int i = 0; i < ${MAX_RIPPLES}; i++) {
          vec4 rp = uRipples[i];
          float age = uTime - rp.z;
          if (age > 0.0 && age < 2.2) {
            float rad = age * 1.15;
            float d = length(xz - rp.xy);
            float ring = (1.0 - smoothstep(0.0, 0.055, abs(d - rad)))
                       + 0.6 * (1.0 - smoothstep(0.0, 0.045, abs(d - rad * 0.62)));
            rippleSum += ring * (1.0 - age / 2.2) * rp.w;
          }
        }
        // Continuous procedural ambient raindrop ripples across the basin
        vec2 rCell = floor(xz * 0.85);
        vec2 rLocal = fract(xz * 0.85) - 0.5;
        float cellSeed = hash(rCell);
        float rPhase = fract(uTime * 0.55 + cellSeed * 7.13);
        if (cellSeed > 0.35) {
          float rDist = length(rLocal - (vec2(hash(rCell + 3.1), hash(rCell + 8.7)) - 0.5) * 0.45);
          float ambRing = (1.0 - smoothstep(0.0, 0.035, abs(rDist - rPhase * 0.42))) * (1.0 - rPhase);
          rippleSum += ambRing * 0.65;
        }
        posterWater = mix(posterWater, vec3(0.92, 0.99, 0.99), clamp(rippleSum, 0.0, 0.78));

        // Boat #4 Kelvin V-wake foam lines on water surface when sailing!
        if (uBoatSpeed > 0.05) {
          vec2 rel = xz - uBoatPos;
          float behind = -dot(rel, uBoatDir);
          float side = abs(dot(rel, vec2(-uBoatDir.y, uBoatDir.x)));
          if (behind > 0.2 && behind < 14.0) {
            float wakeHalfW = 0.38 + behind * 0.28;
            float vEdge = 1.0 - smoothstep(0.0, 0.22, abs(side - wakeHalfW));
            float centerWash = (1.0 - smoothstep(0.0, 0.45, side)) * (1.0 - behind / 9.0);
            float wakeFade = (1.0 - behind / 14.0) * clamp(uBoatSpeed, 0.0, 1.0);
            float wakeCut = smoothstep(0.35, 0.55, vnoise(xz * 3.5 + uTime * 2.0));
            float wakeFoam = clamp((vEdge * wakeCut + max(centerWash, 0.0) * 0.8) * wakeFade, 0.0, 1.0);
            posterWater = mix(posterWater, vec3(0.96, 0.99, 0.99), wakeFoam * 0.85);
          }
        }

        // Cloud shadow & intermittent warm-gold sun sparkles (细碎粼光间歇闪烁)
        float cloudAxis = -0.75 * xz.x + 0.66 * xz.y;
        float cloudBand = (1.0 - smoothstep(4.0, 15.0, abs(cloudAxis - uCloudCenter))) * uCloudStrength * 0.68;
        float sunVis = clamp(1.0 - cloudBand - uSkyDimming * 0.55, 0.22, 1.0);

        posterWater *= mix(0.78, 1.0, sunVis);

        // Crisp cel-shaded warm golden sun sparkles!
        vec2 spCell = floor(xz * 3.2 + vec2(sin(uTime * 0.7), cos(uTime * 0.6)) * 0.4);
        float spRnd = hash(spCell);
        float spTwinkle = sin(uTime * (3.2 + spRnd * 3.5) + spRnd * 31.4);
        if (spRnd > 0.84 && spTwinkle > 0.72) {
          vec2 spPos = fract(xz * 3.2 + vec2(sin(uTime * 0.7), cos(uTime * 0.6)) * 0.4) - 0.5;
          // Star/diamond sparkle shape
          float diamond = 1.0 - smoothstep(0.08, 0.16, abs(spPos.x) + abs(spPos.y));
          posterWater = mix(posterWater, vec3(1.0, 0.95, 0.72), diamond * sunVis * 0.92);
        }

        // Seawall & breakwater cel-shaded white lap line + Boat #4 wake splash! (10.5 拍上岸壁和消波块)
        float lapWidth = 0.28 + uSeawallWakeBoost * 0.34;
        float nearInnerWall = (1.0 - smoothstep(0.0, lapWidth, abs(xz.x + 4.0))) * step(-13.4, xz.y) * step(xz.y, 4.1);
        float nearFrontWall = (1.0 - smoothstep(0.0, lapWidth, abs(xz.x - 6.0))) * step(4.0, xz.y);
        float nearBreakwater = (1.0 - smoothstep(0.0, lapWidth, abs(xz.y + 13.3))) * step(-4.8, xz.x) * step(xz.x, 9.3);
        float lapWave = sin(xz.y * 2.4 + xz.x * 2.1 + uTime * (2.1 + uSeawallWakeBoost * 3.0));
        float lapPulse = step(0.25 - uSeawallWakeBoost * 0.45, lapWave);
        float wallFoam = clamp((nearInnerWall + nearFrontWall + nearBreakwater) * lapPulse, 0.0, 1.0);
        posterWater = mix(posterWater, vec3(0.95, 0.99, 0.99), wallFoam * (0.58 + uSeawallWakeBoost * 0.34));

        // Keep water translucent so underwater gravel seabed, tires, anchor & fish remain visible!
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.4);
        float alpha = clamp(0.50 + fresnel * 0.30 + hullBlock * 0.16, 0.46, 0.86);

        gl_FragColor = vec4(posterWater, alpha);
      }
    `,
  });

  // Build non-overlapping water surface grid covering ONLY water cells
  {
    const nx = 80, nz = 80;
    const positions = [];
    const indices = [];
    const vertMap = new Int32Array((nx + 1) * (nz + 1)).fill(-1);

    function isInsideSolidQuay(x, z) {
      // Strictly inside solid dry quay (leave 0.05 margin under overhangs)
      if (x < -5.05 && z < -14.05) return true; // Hillside
      if (x < -4.05 && z >= -14.05 && z <= 4.05) return true; // Zone B
      if (x < 0.78 && z > 4.05) return true; // Zone A west
      if (x >= 0.78 && x <= 4.22 && z > 8.15) return true; // Behind slipway
      // Slipway goes into water around z = 5.0 (where ramp y == 0.0! Let's compute exact z where ramp y=0:
      // lerp(-0.52, 1.65, f) = 0 -> f = 0.52 / 2.17 = 0.24 -> z = 3.6 + 0.24 * 4.6 = 4.70!)
      if (x >= 0.78 && x <= 4.22 && z > 4.75) return true;
      if (x > 4.18 && x < 5.98 && z > 4.05) return true; // Zone A east
      return false;
    }

    let vCount = 0;
    for (let iz = 0; iz <= nz; iz++) {
      for (let ix = 0; ix <= nx; ix++) {
        const x = -20 + (ix / nx) * 40;
        const z = -20 + (iz / nz) * 40;
        positions.push(x, 0, z);
        vertMap[iz * (nx + 1) + ix] = vCount++;
      }
    }
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const cx = -20 + ((ix + 0.5) / nx) * 40;
        const cz = -20 + ((iz + 0.5) / nz) * 40;
        if (isInsideSolidQuay(cx, cz)) continue;
        // Also skip inside solid breakwater (-4.95..9.35, -15.25..-13.35)
        if (cx > -4.95 && cx < 9.35 && cz > -15.25 && cz < -13.35) continue;

        const a = vertMap[iz * (nx + 1) + ix];
        const b = vertMap[iz * (nx + 1) + ix + 1];
        const c = vertMap[(iz + 1) * (nx + 1) + ix];
        const d = vertMap[(iz + 1) * (nx + 1) + ix + 1];
        indices.push(a, c, b, b, c, d);
      }
    }
    const surfGeo = new THREE.BufferGeometry();
    surfGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    surfGeo.setIndex(indices);
    surfGeo.computeVertexNormals();
    const surfMesh = new THREE.Mesh(surfGeo, waterSurfaceMat);
    surfMesh.renderOrder = 3;
    root.add(surfMesh);
  }

  // 13. Shallow Rainwater Puddles on Quay (4.1 码头低洼处形成小水洼，倒映船只、灯柱和飞过的海鸥)
  const puddleUniforms = {
    uTime: SHARED_ANIME_UNIFORMS.uTime,
    uPuddleReflectTex: { value: puddleRT.texture },
    uCloudCenter: SHARED_ANIME_UNIFORMS.uCloudCenter,
    uCloudStrength: SHARED_ANIME_UNIFORMS.uCloudStrength,
    uSkyDimming: SHARED_ANIME_UNIFORMS.uSkyDimming,
  };

  const puddleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: puddleUniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vClipPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vClipPos = projectionMatrix * viewMatrix * wp;
        gl_Position = vClipPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uPuddleReflectTex;
      uniform float uSkyDimming;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vClipPos;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec2 c = vUv * 2.0 - 1.0;
        float ang = atan(c.y, c.x);
        float organic = 0.82 + 0.10 * sin(ang * 3.0 + vWorldPos.x) + 0.06 * cos(ang * 5.0 - vWorldPos.z);
        float dist = length(c) / organic;
        if (dist > 1.0) discard;

        // Tiny concentric raindrop ripples in the puddle
        vec2 pCell = floor(vWorldPos.xz * 1.8);
        vec2 pLoc = fract(vWorldPos.xz * 1.8) - 0.5;
        float seed = hash(pCell);
        float ph = fract(uTime * 0.85 + seed * 5.3);
        float rDist = length(pLoc);
        float ring = (1.0 - smoothstep(0.0, 0.045, abs(rDist - ph * 0.42))) * (1.0 - ph);

        vec2 ndc = vClipPos.xy / max(vClipPos.w, 0.0001);
        vec2 rUv = vec2(0.5 + ndc.x * 0.5, 0.5 - ndc.y * 0.5);
        rUv = clamp(rUv + normalize(pLoc + 0.001) * ring * 0.014, 0.004, 0.996);

        vec3 refl = texture2D(uPuddleReflectTex, rUv).rgb;
        // Soft anime watercolor glaze + wet dark rim on concrete
        vec3 wetEdge = vec3(0.62, 0.72, 0.75) * (1.0 - 0.2 * uSkyDimming);
        vec3 col = mix(refl, wetEdge, smoothstep(0.75, 1.0, dist) * 0.55);
        col = mix(col, vec3(0.95, 0.99, 0.99), ring * 0.65);

        float alpha = (1.0 - smoothstep(0.86, 1.0, dist)) * 0.82;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const puddleDefs = [
    { x: 1.65, z: 9.85, sx: 4.35, sz: 3.25, rot: 0.14 },  // Foreground puddle reflecting boats, lamp post & seagulls!
    { x: -6.2, z: 11.4, sx: 3.2, sz: 2.2, rot: -0.4 },    // Outside Fishery Co-op Warehouse roller door
    { x: -6.8, z: -1.8, sx: 2.8, sz: 2.0, rot: 0.55 },    // Outside Ferry Waiting Room glass
    { x: -1.6, z: 6.4, sx: 2.4, sz: 1.7, rot: 0.1 },      // Near L-corner & lamp post
  ];
  const puddleMeshes = [];
  for (const pd of puddleDefs) {
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(pd.sx, pd.sz), puddleMat);
    pm.rotation.x = -Math.PI / 2;
    pm.rotation.z = pd.rot;
    pm.position.set(pd.x, 1.656, pd.z);
    pm.renderOrder = 2;
    root.add(pm);
    puddleMeshes.push(pm);
  }

  // Subtle harbor quay drainage trench & cast-iron storm grates along warehouse apron
  {
    const grateMat = createAnimeMaterial({ color: 0x5c6d73, wetness: 0.55 });
    const trench = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 11.2), grateMat);
    trench.rotation.x = -Math.PI / 2;
    trench.position.set(-4.65, 1.653, 12.6);
    root.add(trench);
  }

  // Trigger helper for drip ripples on harbor water
  let rippleCursor = 0;
  function spawnWaterRipple(x, z, strength = 0.85, tNow = 0) {
    rippleArray[rippleCursor].set(x, z, tNow, strength);
    rippleCursor = (rippleCursor + 1) % MAX_RIPPLES;
  }

  // Per-frame update for underwater plants, fish schools, water & foam shaders
  function update(t, weather, cameraPos, isExportTour, boatWakeInfo) {
    waterSurfaceUniforms.uGustFront.value = weather.gust1Front;
    waterSurfaceUniforms.uGustActive.value = weather.gust1Active;

    if (boatWakeInfo) {
      waterSurfaceUniforms.uBoatPos.value.set(boatWakeInfo.x, boatWakeInfo.z);
      waterSurfaceUniforms.uBoatDir.value.set(boatWakeInfo.dirX, boatWakeInfo.dirZ);
      waterSurfaceUniforms.uBoatSpeed.value = boatWakeInfo.speed;
      waterSurfaceUniforms.uSeawallWakeBoost.value = boatWakeInfo.seawallWakeBoost || 0;
      tetrapodFoamMeshes.sharedMat.uniforms.uWakeBoost.value = boatWakeInfo.tetrapodWakeBoost || 0;
    }

    // Sway underwater plants
    for (const sp of swayingPlants) {
      sp.group.rotation.z = Math.sin(t * 1.35 + sp.phase) * sp.amp;
      sp.group.rotation.x = Math.cos(t * 1.05 + sp.phase * 0.7) * (sp.amp * 0.6);
    }

    // Update swimming fish schools + camera proximity scatter & regroup (10.6)
    for (const sc of fishSchools) {
      let scatterAmt = 0;
      if (isExportTour && sc.sIdx === 0) {
        // Deterministic scatter during Shot 10 (underwater cross-section close-up at t ~ 45.2s)
        const dt = t - 45.3;
        if (dt > 0 && dt < 4.2) {
          scatterAmt = smoothstep(0.0, 0.45, dt) * (1.0 - smoothstep(1.8, 4.0, dt));
        }
      } else if (cameraPos) {
        const dCam = Math.hypot(cameraPos.x - sc.cx, cameraPos.y - sc.cy, cameraPos.z - sc.cz);
        const isClose = dCam < 9.5 && cameraPos.y < 3.2;
        if (isClose && !sc.wasClose) {
          sc.scatterTriggerTime = t;
        }
        sc.wasClose = isClose;
        const elapsed = t - sc.scatterTriggerTime;
        if (elapsed >= 0 && elapsed < 4.2) {
          scatterAmt = smoothstep(0.0, 0.45, elapsed) * (1.0 - smoothstep(1.8, 4.0, elapsed));
        }
      }

      for (const f of sc.members) {
        const ang = t * f.speed + f.angleOffset;
        const rx = sc.rx * f.radMul;
        const rz = sc.rz * f.radMul;
        let fx = sc.cx + Math.cos(ang) * rx + f.scatterDir.x * scatterAmt * 2.4;
        let fy = sc.cy + f.yOff + Math.sin(t * 1.8 + f.angleOffset) * 0.12 + f.scatterDir.y * scatterAmt * 0.9;
        let fz = sc.cz + Math.sin(ang) * rz + f.scatterDir.z * scatterAmt * 2.4;
        fx = clamp(fx, 6.6, 19.3);
        fz = clamp(fz, -19.3, 19.3);
        fy = clamp(fy, getSeabedHeight(fx, fz) + 0.25, -0.35);

        // Tangent heading + wiggle
        const tx = -Math.sin(ang) * rx + f.scatterDir.x * scatterAmt * 3.0;
        const tz = Math.cos(ang) * rz + f.scatterDir.z * scatterAmt * 3.0;
        f.mesh.position.set(fx, fy, fz);
        f.mesh.rotation.y = -Math.atan2(tz, tx) + Math.sin(t * (9.0 + scatterAmt * 10.0) + f.angleOffset) * 0.14;
      }
    }
  }

  return {
    root,
    waterSurfaceMat,
    puddleMeshes,
    spawnWaterRipple,
    update,
  };
}
