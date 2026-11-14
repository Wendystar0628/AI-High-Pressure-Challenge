import * as THREE from 'three';
import type { BranchId, EnemyType, MapId, TowerType } from './types';

export interface ProceduralTextures {
  linkAlbedo: THREE.CanvasTexture;
  linkBump: THREE.CanvasTexture;
  legacyAlbedo: THREE.CanvasTexture;
  platformAlbedo: THREE.CanvasTexture;
  nodeAlbedo: THREE.CanvasTexture;
  serverRackEmissive: THREE.CanvasTexture;
  hexShieldTex: THREE.CanvasTexture;
  protocolGridTex: THREE.CanvasTexture;
  streamTex: THREE.CanvasTexture;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

export function createProceduralTextures(): ProceduralTextures {
  // 1. Link road brushed navy-steel deck + illuminated fiber trace channels
  const [cLink, ctxL] = makeCanvas(256, 256);
  ctxL.fillStyle = '#1b2e4b';
  ctxL.fillRect(0, 0, 256, 256);
  ctxL.strokeStyle = '#0d192b';
  ctxL.lineWidth = 8;
  ctxL.strokeRect(4, 4, 248, 248);
  ctxL.strokeStyle = '#385780';
  ctxL.lineWidth = 3;
  ctxL.strokeRect(14, 14, 228, 228);
  // Crisp circuit lanes & node pads
  ctxL.strokeStyle = 'rgba(56, 189, 248, 0.36)';
  ctxL.lineWidth = 3;
  ctxL.beginPath();
  ctxL.moveTo(128, 14);
  ctxL.lineTo(128, 242);
  ctxL.moveTo(14, 128);
  ctxL.lineTo(242, 128);
  ctxL.stroke();
  ctxL.fillStyle = 'rgba(56, 189, 248, 0.45)';
  ctxL.fillRect(118, 118, 20, 20);
  const linkAlbedo = new THREE.CanvasTexture(cLink);
  linkAlbedo.colorSpace = THREE.SRGBColorSpace;

  // Bump map for panel grooves
  const [cBump, ctxB] = makeCanvas(256, 256);
  ctxB.fillStyle = '#808080';
  ctxB.fillRect(0, 0, 256, 256);
  ctxB.strokeStyle = '#303030';
  ctxB.lineWidth = 6;
  ctxB.strokeRect(6, 6, 244, 244);
  ctxB.strokeStyle = '#c0c0c0';
  ctxB.lineWidth = 2;
  ctxB.strokeRect(22, 22, 212, 212);
  const linkBump = new THREE.CanvasTexture(cBump);

  // 2. Legacy road tarnished copper + amber hazard chevrons
  const [cLeg, ctxLeg] = makeCanvas(256, 256);
  ctxLeg.fillStyle = '#362314';
  ctxLeg.fillRect(0, 0, 256, 256);
  ctxLeg.strokeStyle = '#92400e';
  ctxLeg.lineWidth = 6;
  ctxLeg.strokeRect(6, 6, 244, 244);
  ctxLeg.fillStyle = 'rgba(245, 158, 11, 0.34)';
  for (let i = -256; i < 512; i += 44) {
    ctxLeg.beginPath();
    ctxLeg.moveTo(i, 0);
    ctxLeg.lineTo(i + 20, 0);
    ctxLeg.lineTo(i + 20 - 256, 256);
    ctxLeg.lineTo(i - 256, 256);
    ctxLeg.closePath();
    ctxLeg.fill();
  }
  ctxLeg.strokeStyle = '#f59e0b';
  ctxLeg.lineWidth = 3;
  ctxLeg.strokeRect(24, 24, 208, 208);
  const legacyAlbedo = new THREE.CanvasTexture(cLeg);
  legacyAlbedo.colorSpace = THREE.SRGBColorSpace;

  // 3. Elevated Platform brushed titanium mount pad
  const [cPlat, ctxP] = makeCanvas(256, 256);
  ctxP.fillStyle = '#2d415c';
  ctxP.fillRect(0, 0, 256, 256);
  ctxP.strokeStyle = '#64748b';
  ctxP.lineWidth = 10;
  ctxP.strokeRect(8, 8, 240, 240);
  ctxP.fillStyle = '#1e2c40';
  ctxP.fillRect(26, 26, 204, 204);
  ctxP.strokeStyle = '#38bdf8';
  ctxP.lineWidth = 5;
  ctxP.beginPath();
  ctxP.arc(128, 128, 72, 0, Math.PI * 2);
  ctxP.stroke();
  ctxP.strokeStyle = 'rgba(125, 211, 252, 0.55)';
  ctxP.lineWidth = 2.5;
  ctxP.beginPath();
  ctxP.arc(128, 128, 44, 0, Math.PI * 2);
  ctxP.stroke();
  // Corner mounting bolts + reticle ticks
  ctxP.fillStyle = '#bae6fd';
  for (const [bx, by] of [[38, 38], [218, 38], [38, 218], [218, 218]]) {
    ctxP.beginPath();
    ctxP.arc(bx, by, 7, 0, Math.PI * 2);
    ctxP.fill();
  }
  const platformAlbedo = new THREE.CanvasTexture(cPlat);
  platformAlbedo.colorSpace = THREE.SRGBColorSpace;

  // 4. Switch Node junction plate
  const [cNode, ctxN] = makeCanvas(256, 256);
  ctxN.fillStyle = '#0d2b31';
  ctxN.fillRect(0, 0, 256, 256);
  ctxN.strokeStyle = '#10b981';
  ctxN.lineWidth = 6;
  ctxN.beginPath();
  ctxN.arc(128, 128, 86, 0, Math.PI * 2);
  ctxN.stroke();
  ctxN.fillStyle = 'rgba(16, 185, 129, 0.34)';
  ctxN.fillRect(114, 0, 28, 256);
  ctxN.fillRect(0, 114, 256, 28);
  const nodeAlbedo = new THREE.CanvasTexture(cNode);
  nodeAlbedo.colorSpace = THREE.SRGBColorSpace;

  // 5. Server Rack LED emissive
  const [cRack, ctxR] = makeCanvas(128, 256);
  ctxR.fillStyle = '#050810';
  ctxR.fillRect(0, 0, 128, 256);
  for (let row = 8; row < 248; row += 14) {
    ctxR.fillStyle = '#0f172a';
    ctxR.fillRect(10, row, 108, 10);
    for (let col = 16; col < 108; col += 12) {
      const h = (row * 13 + col * 7) % 11;
      if (h < 3) ctxR.fillStyle = '#22d3ee';
      else if (h === 4) ctxR.fillStyle = '#34d399';
      else if (h === 7) ctxR.fillStyle = '#f59e0b';
      else continue;
      ctxR.fillRect(col, row + 3, 6, 4);
    }
  }
  const serverRackEmissive = new THREE.CanvasTexture(cRack);
  serverRackEmissive.colorSpace = THREE.SRGBColorSpace;

  // 6. Hex shield pattern
  const [cHex, ctxH] = makeCanvas(256, 256);
  ctxH.clearRect(0, 0, 256, 256);
  ctxH.strokeStyle = 'rgba(52, 211, 153, 0.75)';
  ctxH.lineWidth = 2.5;
  const r = 24;
  const dx = r * 1.5;
  const dy = r * Math.sqrt(3);
  for (let gx = -1; gx < 10; gx++) {
    for (let gy = -1; gy < 10; gy++) {
      const cx = gx * dx;
      const cy = gy * dy + (gx % 2 === 0 ? 0 : dy * 0.5);
      ctxH.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 3) * k;
        const px = cx + r * 0.9 * Math.cos(ang);
        const py = cy + r * 0.9 * Math.sin(ang);
        if (k === 0) ctxH.moveTo(px, py);
        else ctxH.lineTo(px, py);
      }
      ctxH.closePath();
      ctxH.stroke();
    }
  }
  const hexShieldTex = new THREE.CanvasTexture(cHex);
  hexShieldTex.wrapS = THREE.RepeatWrapping;
  hexShieldTex.wrapT = THREE.RepeatWrapping;

  // 7. Protocol Layer underground circuit grid
  const [cProto, ctxPr] = makeCanvas(512, 512);
  ctxPr.clearRect(0, 0, 512, 512);
  ctxPr.strokeStyle = 'rgba(34, 211, 238, 0.24)';
  ctxPr.lineWidth = 2;
  for (let g = 0; g <= 512; g += 64) {
    ctxPr.beginPath();
    ctxPr.moveTo(g, 0);
    ctxPr.lineTo(g, 512);
    ctxPr.moveTo(0, g);
    ctxPr.lineTo(512, g);
    ctxPr.stroke();
  }
  ctxPr.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctxPr.lineWidth = 3;
  ctxPr.strokeRect(128, 128, 256, 256);
  ctxPr.fillStyle = 'rgba(34, 211, 238, 0.55)';
  for (let x = 64; x < 512; x += 128) {
    for (let y = 64; y < 512; y += 128) {
      ctxPr.fillRect(x - 4, y - 4, 8, 8);
    }
  }
  const protocolGridTex = new THREE.CanvasTexture(cProto);
  protocolGridTex.wrapS = THREE.RepeatWrapping;
  protocolGridTex.wrapT = THREE.RepeatWrapping;
  protocolGridTex.repeat.set(8, 8);

  // 8. Public Network Stream flow texture
  const [cStr, ctxSt] = makeCanvas(256, 256);
  ctxSt.fillStyle = '#07142b';
  ctxSt.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 42; i++) {
    const x = (i * 53) % 256;
    const y = (i * 97) % 256;
    const w = 18 + (i % 4) * 14;
    ctxSt.fillStyle = i % 3 === 0 ? '#38bdf8' : i % 3 === 1 ? '#818cf8' : '#22d3ee';
    ctxSt.fillRect(x, y, w, 4);
  }
  const streamTex = new THREE.CanvasTexture(cStr);
  streamTex.wrapS = THREE.RepeatWrapping;
  streamTex.wrapT = THREE.RepeatWrapping;

  return {
    linkAlbedo,
    linkBump,
    legacyAlbedo,
    platformAlbedo,
    nodeAlbedo,
    serverRackEmissive,
    hexShieldTex,
    protocolGridTex,
    streamTex,
  };
}

export function buildObstacleProp(
  mapId: MapId,
  tx: number,
  ty: number,
  tex: ProceduralTextures
): THREE.Group {
  const g = new THREE.Group();
  const h = ((tx * 73 + ty * 37) % 10) / 10;

  // Map 2 Public Stream river across y=3..4 (except tunnel columns)
  if (mapId === 'backbone' && (ty === 3 || ty === 4)) {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.98, 0.25, 1.98),
      new THREE.MeshStandardMaterial({
        color: 0x0b1630,
        emissive: 0x1d4ed8,
        emissiveIntensity: 0.55,
        map: tex.streamTex,
        roughness: 0.2,
        metalness: 0.7,
      })
    );
    base.position.y = -0.18;
    g.add(base);
    g.userData.isPublicStream = true;
    return g;
  }

  // Map 3 Central Air-Gap containment chasm (x=5..8, y=4..6)
  if (mapId === 'airgap' && tx >= 5 && tx <= 8 && ty >= 4 && ty <= 6) {
    const pit = new THREE.Mesh(
      new THREE.BoxGeometry(1.92, 0.12, 1.92),
      new THREE.MeshStandardMaterial({
        color: 0x16070c,
        emissive: 0x9f1239,
        emissiveIntensity: 0.32,
        roughness: 0.45,
        metalness: 0.7,
      })
    );
    pit.position.y = -0.22;
    g.add(pit);

    // Subtle dark laser grid frame around gap floor
    const gridWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.88, 0.04, 1.88)),
      new THREE.LineBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.5 })
    );
    gridWire.position.y = -0.14;
    g.add(gridWire);

    if ((tx === 5 || tx === 8) && (ty === 4 || ty === 6)) {
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.24, 1.45, 6),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 })
      );
      pylon.position.y = 0.55;
      pylon.castShadow = true;
      g.add(pylon);

      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22),
        new THREE.MeshStandardMaterial({
          color: 0xf43f5e,
          emissive: 0xf43f5e,
          emissiveIntensity: 1.8,
        })
      );
      core.position.y = 1.42;
      g.add(core);
      g.userData.spinCrystal = core;
    } else {
      const field = new THREE.Mesh(
        new THREE.PlaneGeometry(1.75, 0.95),
        new THREE.MeshBasicMaterial({
          color: 0xfb7185,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
        })
      );
      field.position.y = 0.42;
      field.rotation.y = (tx + ty) % 2 === 0 ? 0 : Math.PI / 2;
      g.add(field);
    }
    return g;
  }

  // Standard Facility Obstacle based on Map Style
  const basePlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.86, 0.16, 1.86),
    new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.65, metalness: 0.72 })
  );
  basePlate.position.y = -0.02;
  basePlate.receiveShadow = true;
  g.add(basePlate);

  if (mapId === 'intranet') {
    // Sleek corporate server monoliths (dark graphite top louver, LED sides)
    const tall = 0.72 + h * 0.95;
    const rack = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, tall, 1.12),
      new THREE.MeshStandardMaterial({
        color: 0x162032,
        emissive: 0xffffff,
        emissiveMap: tex.serverRackEmissive,
        emissiveIntensity: 0.88,
        metalness: 0.75,
        roughness: 0.38,
      })
    );
    rack.position.y = 0.1 + tall * 0.5;
    rack.castShadow = true;
    rack.receiveShadow = true;
    g.add(rack);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.08, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.88,
        roughness: 0.35,
      })
    );
    roof.position.y = 0.14 + tall;
    g.add(roof);

    const louver = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.05, 0.84),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.5 })
    );
    louver.position.y = 0.2 + tall;
    g.add(louver);

    // Dual front/side vertical blue rack status LED strips
    const ledStripMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (const sx of [-0.42, 0.42]) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, tall * 0.74, 0.03), ledStripMat);
      led.position.set(sx, 0.1 + tall * 0.5, 0.575);
      g.add(led);
    }
  } else if (mapId === 'backbone') {
    // Fiber-optic telecom relay towers (dark metallic monolith + mid waveguide collar)
    const tall = 0.65 + h * 0.75;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.56, tall, 6),
      new THREE.MeshStandardMaterial({
        color: 0x181c36,
        metalness: 0.82,
        roughness: 0.32,
      })
    );
    pillar.position.y = 0.1 + tall * 0.5;
    pillar.castShadow = true;
    g.add(pillar);

    const waveguide = new THREE.Mesh(
      new THREE.CylinderGeometry(0.49, 0.51, 0.12, 6),
      new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        emissive: 0x4f46e5,
        emissiveIntensity: 0.9,
      })
    );
    waveguide.position.y = 0.12 + tall * 0.58;
    g.add(waveguide);

    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.42, 0.09, 6),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.3 })
    );
    dish.position.y = 0.14 + tall;
    g.add(dish);

    // Top optical relay spire & rotating corona ring
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.08, 0.34, 6),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85 })
    );
    spire.position.y = 0.32 + tall;
    g.add(spire);
    const corona = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.025, 6, 12),
      new THREE.MeshBasicMaterial({ color: 0x818cf8 })
    );
    corona.position.y = 0.36 + tall;
    corona.rotation.x = Math.PI / 3;
    g.add(corona);
    g.userData.spinCrystal = corona;
  } else {
    // Industrial SCADA coolant pipes & shielded bulkheads (dark gunmetal + mid hazard trim!)
    const tall = 0.52 + h * 0.62;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(1.24, tall, 1.24),
      new THREE.MeshStandardMaterial({
        color: 0x202736,
        metalness: 0.8,
        roughness: 0.42,
      })
    );
    block.position.y = 0.1 + tall * 0.5;
    block.castShadow = true;
    block.receiveShadow = true;
    g.add(block);

    const hazardBand = new THREE.Mesh(
      new THREE.BoxGeometry(1.29, 0.08, 1.29),
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        emissive: 0x92400e,
        emissiveIntensity: 0.45,
      })
    );
    hazardBand.position.y = 0.12 + tall * 0.45;
    g.add(hazardBand);

    const armorCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.08, 0.96),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.88,
        roughness: 0.35,
      })
    );
    armorCap.position.y = 0.14 + tall;
    g.add(armorCap);

    // Side coolant conduits & amber safety beacon on industrial bulkhead
    for (const sx of [-0.56, 0.56]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, tall * 0.82, 8),
        new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.85, roughness: 0.3 })
      );
      pipe.position.set(sx, 0.12 + tall * 0.44, 0.56);
      g.add(pipe);
    }
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.1, 8),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 1.5,
      })
    );
    beacon.position.set(0.32, 0.22 + tall, 0.32);
    g.add(beacon);
  }

  return g;
}

export function buildTowerModel(
  type: TowerType,
  level: 1 | 2,
  branch: BranchId | null,
  tex: ProceduralTextures
): THREE.Group {
  const root = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.82,
    roughness: 0.28,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.85,
    roughness: 0.24,
  });

  if (type === 'firewall') {
    const accent = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.4,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.24, 6), metalMat);
    base.position.y = 0.12;
    base.castShadow = true;
    root.add(base);

    const headPivot = new THREE.Group();
    headPivot.position.y = 0.24;
    root.add(headPivot);

    // Wide shield front wall
    const shieldWall = new THREE.Mesh(
      new THREE.BoxGeometry(level === 2 ? 1.25 : 1.05, level === 2 ? 0.82 : 0.65, 0.22),
      trimMat
    );
    shieldWall.position.set(0, 0.36, 0.28);
    shieldWall.castShadow = true;
    headPivot.add(shieldWall);

    const holoScreen = new THREE.Mesh(
      new THREE.BoxGeometry(level === 2 ? 1.32 : 1.1, level === 2 ? 0.68 : 0.48, 0.06),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.55,
      })
    );
    holoScreen.position.set(0, 0.42, 0.42);
    headPivot.add(holoScreen);

    // Core plasma emitter
    const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.48), metalMat);
    emitter.position.set(0, 0.3, -0.1);
    headPivot.add(emitter);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.18), accent);
    visor.position.set(0, 0.46, 0.16);
    headPivot.add(visor);

    if (level === 2) {
      for (const sx of [-0.62, 0.62]) {
        const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.58), metalMat);
        pauldron.position.set(sx, 0.4, 0.08);
        pauldron.castShadow = true;
        headPivot.add(pauldron);

        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.24), accent);
        fin.position.set(sx * 1.12, 0.68, 0.02);
        fin.rotation.z = sx > 0 ? -0.22 : 0.22;
        headPivot.add(fin);
      }
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.14), accent);
      crest.position.set(0, 0.8, 0.34);
      headPivot.add(crest);

      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.045, 8, 6), accent);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.94;
      headPivot.add(halo);
      root.userData.spinRing = halo;
    }

    root.userData.headPivot = headPivot;
  } else if (type === 'honeypot') {
    const isMimic = branch === 'honeypot_mimic';
    const isSnare = branch === 'honeypot_snare';
    const mainColor = isSnare ? 0xa855f7 : isMimic ? 0xfbbf24 : 0xf472b6;
    const accent = new THREE.MeshStandardMaterial({
      color: mainColor,
      emissive: mainColor,
      emissiveIntensity: 1.6,
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.2, 8), metalMat);
    base.position.y = 0.1;
    base.castShadow = true;
    root.add(base);

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(level === 2 ? 0.36 : 0.28, 0), accent);
    crystal.position.y = 0.68;
    crystal.castShadow = true;
    root.add(crystal);
    root.userData.bobCrystal = crystal;

    const lureRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 8, 24), accent);
    lureRing.position.y = 0.68;
    root.add(lureRing);
    root.userData.spinRing = lureRing;

    if (isMimic) {
      // Twin floating golden prism mirrors
      for (let k = 0; k < 3; k++) {
        const ang = (k * Math.PI * 2) / 3;
        const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.34), trimMat);
        mirror.position.set(Math.cos(ang) * 0.56, 0.65, Math.sin(ang) * 0.56);
        mirror.rotation.y = -ang;
        root.add(mirror);
      }
    } else if (isSnare) {
      // 4 angled magnetic snare claws
      for (let k = 0; k < 4; k++) {
        const ang = (k * Math.PI) / 2 + Math.PI / 4;
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 4), trimMat);
        claw.position.set(Math.cos(ang) * 0.54, 0.52, Math.sin(ang) * 0.54);
        claw.rotation.z = -Math.cos(ang) * 0.35;
        claw.rotation.x = Math.sin(ang) * 0.35;
        root.add(claw);
      }
    }
  } else if (type === 'gate') {
    const accent = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.35,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.22, 1.48), metalMat);
    base.position.y = 0.11;
    base.castShadow = true;
    root.add(base);

    // Heavy twin blast jaws
    for (const sx of [-0.46, 0.46]) {
      const jaw = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, level === 2 ? 0.96 : 0.74, 1.18),
        trimMat
      );
      jaw.position.set(sx, level === 2 ? 0.6 : 0.48, 0);
      jaw.castShadow = true;
      root.add(jaw);
    }

    const optBeam = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 0.95), accent);
    optBeam.position.y = level === 2 ? 0.72 : 0.56;
    root.add(optBeam);

    if (level === 2) {
      for (const sx of [-0.56, 0.56]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.86, 1.32), accent);
        wing.position.set(sx * 1.18, 0.58, 0);
        root.add(wing);
      }
      const upperBeam = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.96), accent);
      upperBeam.position.y = 0.92;
      root.add(upperBeam);

      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 8), accent);
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 1.14;
      root.add(crown);
      root.userData.spinRing = crown;
    }
  } else if (type === 'interceptor') {
    const isPierce = branch === 'interceptor_pierce';
    const isSupp = branch === 'interceptor_suppress';
    const accColor = isPierce ? 0xe0f2fe : isSupp ? 0x60a5fa : 0x22d3ee;
    const accent = new THREE.MeshStandardMaterial({
      color: accColor,
      emissive: accColor,
      emissiveIntensity: 1.5,
    });

    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.72, 0.24, 8), metalMat);
    ped.position.y = 0.12;
    ped.castShadow = true;
    root.add(ped);

    const headPivot = new THREE.Group();
    headPivot.position.y = 0.36;
    root.add(headPivot);

    const turretBody = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.38, 0.78), trimMat);
    turretBody.position.y = 0.14;
    turretBody.castShadow = true;
    headPivot.add(turretBody);

    const barrelGroup = new THREE.Group();
    barrelGroup.position.set(0, 0.2, 0.28);
    headPivot.add(barrelGroup);

    if (isPierce) {
      // Twin elongated electromagnetic rail lance!
      for (const bx of [-0.14, 0.14]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 1.18), metalMat);
        rail.position.set(bx, 0, 0.42);
        rail.castShadow = true;
        barrelGroup.add(rail);
      }
      const coreGlow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 1.08), accent);
      coreGlow.position.set(0, 0, 0.42);
      barrelGroup.add(coreGlow);
      // Accelerator rings
      for (const rz of [0.3, 0.65, 0.92]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 6, 12), accent);
        ring.position.set(0, 0, rz);
        barrelGroup.add(ring);
      }
    } else if (isSupp) {
      // Twin side cooling drums + broad rotary 3-barrel suppression cannon + muzzle ring
      for (const sx of [-0.42, 0.42]) {
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.54, 8), metalMat);
        drum.rotation.x = Math.PI / 2;
        drum.position.set(sx, 0.16, 0.02);
        drum.castShadow = true;
        headPivot.add(drum);
        const cap = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.028, 6, 10), accent);
        cap.position.set(sx, 0.16, 0.3);
        headPivot.add(cap);
      }
      const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.29, 0.52, 8), metalMat);
      shroud.rotation.x = Math.PI / 2;
      shroud.position.z = 0.24;
      barrelGroup.add(shroud);
      for (let k = 0; k < 3; k++) {
        const ang = (k * Math.PI * 2) / 3;
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.94, 8), accent);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(Math.cos(ang) * 0.14, Math.sin(ang) * 0.14, 0.48);
        barrelGroup.add(tube);
      }
      for (const bz of [0.54, 0.86]) {
        const brace = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.03, 6, 12), accent);
        brace.position.set(0, 0, bz);
        barrelGroup.add(brace);
      }
      root.userData.spinBarrel = barrelGroup;
    } else {
      // Standard sleek rail barrel
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.84), metalMat);
      barrel.position.z = 0.34;
      barrel.castShadow = true;
      barrelGroup.add(barrel);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.72), accent);
      tip.position.set(0, 0.06, 0.36);
      barrelGroup.add(tip);
    }

    root.userData.headPivot = headPivot;
    root.userData.barrelGroup = barrelGroup;
  } else if (type === 'sandbox') {
    const accent = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xa855f7,
      emissiveIntensity: 1.5,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.76, 0.22, 8), metalMat);
    base.position.y = 0.11;
    base.castShadow = true;
    root.add(base);

    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.2, 0.22, 12), trimMat);
    dish.position.y = 0.34;
    root.add(dish);

    const dome = new THREE.Mesh(
      new THREE.IcosahedronGeometry(level === 2 ? 0.44 : 0.34, 1),
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 1.0,
        wireframe: true,
      })
    );
    dome.position.y = 0.72;
    root.add(dome);
    root.userData.bobCrystal = dome;

    const scanRing = new THREE.Mesh(
      new THREE.TorusGeometry(level === 2 ? 0.62 : 0.5, 0.035, 8, 24),
      accent
    );
    scanRing.rotation.x = Math.PI / 2;
    scanRing.position.y = 0.72;
    root.add(scanRing);
    root.userData.spinRing = scanRing;

    if (level === 2) {
      for (let k = 0; k < 4; k++) {
        const ang = (k * Math.PI) / 2 + Math.PI / 4;
        const probe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.12), trimMat);
        probe.position.set(Math.cos(ang) * 0.58, 0.44, Math.sin(ang) * 0.58);
        probe.rotation.y = -ang;
        probe.rotation.z = 0.28;
        root.add(probe);
      }
      const crossRing = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.03, 6, 18), accent);
      crossRing.position.y = 0.72;
      crossRing.rotation.y = Math.PI / 4;
      root.add(crossRing);
    }
  } else if (type === 'repair') {
    const accent = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 1.5,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.72, 0.22, 6), metalMat);
    base.position.y = 0.11;
    base.castShadow = true;
    root.add(base);

    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.85, 6), trimMat);
    spire.position.y = 0.62;
    spire.castShadow = true;
    root.add(spire);

    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), accent);
    orb.position.y = 1.15;
    root.add(orb);
    root.userData.bobCrystal = orb;

    const droneCount = level === 2 ? 3 : 2;
    const orbitGroup = new THREE.Group();
    orbitGroup.position.y = 0.86;
    for (let k = 0; k < droneCount; k++) {
      const ang = (k * Math.PI * 2) / droneCount;
      const drone = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.22), accent);
      drone.position.set(Math.cos(ang) * 0.56, 0, Math.sin(ang) * 0.56);
      orbitGroup.add(drone);
    }
    root.add(orbitGroup);
    root.userData.spinRing = orbitGroup;

    if (level === 2) {
      for (let k = 0; k < 3; k++) {
        const ang = (k * Math.PI * 2) / 3;
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.68, 0.14), trimMat);
        pylon.position.set(Math.cos(ang) * 0.5, 0.44, Math.sin(ang) * 0.5);
        pylon.rotation.y = -ang;
        root.add(pylon);
      }
    }
  }

  // Shared friendly Energy Shield dome (toggled by shield > 0!)
  const shieldDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x34d399,
      map: tex.hexShieldTex,
      transparent: true,
      opacity: 0.42,
      wireframe: false,
      depthWrite: false,
    })
  );
  shieldDome.position.y = 0.52;
  shieldDome.visible = false;
  root.add(shieldDome);
  root.userData.shieldDome = shieldDome;

  // Shared Encryption Purple Lock Collar & Floating Cipher Crystal (toggled by encryptedTimer > 0!)
  const encGroup = new THREE.Group();
  const encCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.64, 0.032, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xd946ef })
  );
  encCollar.rotation.x = Math.PI / 2;
  encCollar.position.y = 0.52;
  const encLock = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18),
    new THREE.MeshBasicMaterial({ color: 0xe879f9 })
  );
  encLock.position.y = 1.28;
  encGroup.add(encCollar, encLock);
  encGroup.visible = false;
  root.add(encGroup);
  root.userData.encryptGroup = encGroup;

  cacheUnitMaterials(root, [shieldDome, encGroup]);
  return root;
}

function cacheUnitMaterials(root: THREE.Group, excludeGroups: THREE.Object3D[]): void {
  const excluded = new Set<THREE.Object3D>(excludeGroups);
  const mats: Array<{ mat: THREE.MeshStandardMaterial; baseEmissive: THREE.Color; baseIntensity: number }> = [];
  const seen = new Set<THREE.Material>();

  const walk = (obj: THREE.Object3D) => {
    if (excluded.has(obj)) return;
    if ((obj as THREE.Mesh).isMesh) {
      const m = (obj as THREE.Mesh).material;
      if (m && !Array.isArray(m) && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial && !seen.has(m)) {
        seen.add(m);
        const sm = m as THREE.MeshStandardMaterial;
        mats.push({
          mat: sm,
          baseEmissive: sm.emissive.clone(),
          baseIntensity: sm.emissiveIntensity,
        });
      }
    }
    for (const c of obj.children) walk(c);
  };
  walk(root);
  root.userData.unitMats = mats;
}

export function buildEnemyModel(type: EnemyType, isClone = false): THREE.Group {
  const root = new THREE.Group();
  const scale = isClone ? 0.78 : 1.0;

  if (type === 'worm') {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xbe123c,
      emissiveIntensity: 0.7,
      roughness: 0.35,
      metalness: 0.5,
    });
    const segs: THREE.Mesh[] = [];
    for (let k = 0; k < 5; k++) {
      const r = (0.24 - k * 0.03) * scale;
      const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), bodyMat);
      seg.position.set(0, 0.24 * scale, -k * 0.24 * scale);
      seg.castShadow = true;
      root.add(seg);
      segs.push(seg);
    }
    // Mandible jaws on head
    const jaws: THREE.Mesh[] = [];
    for (const sx of [-0.12, 0.12]) {
      const jaw = new THREE.Mesh(
        new THREE.ConeGeometry(0.06 * scale, 0.22 * scale, 4),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 1.0 })
      );
      jaw.rotation.x = Math.PI / 2;
      jaw.position.set(sx * scale, 0.24 * scale, 0.22 * scale);
      jaw.userData.side = sx;
      root.add(jaw);
      jaws.push(jaw);
    }
    root.userData.jaws = jaws;
    root.userData.segments = segs;
  } else if (type === 'flood') {
    // Heavy brutalist battering-ram juggernaut with animated front pistons!
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x9a3412,
      metalness: 0.75,
      roughness: 0.35,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.4,
    });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.56, 0.86), hullMat);
    chassis.position.y = 0.34;
    chassis.castShadow = true;
    root.add(chassis);

    const ramHead = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.52, 4), coreMat);
    ramHead.rotation.x = Math.PI / 2;
    ramHead.rotation.y = Math.PI / 4;
    ramHead.position.set(0, 0.34, 0.52);
    ramHead.castShadow = true;
    root.add(ramHead);
    root.userData.ramHead = ramHead;
  } else if (type === 'trojan') {
    // Disguised innocent packet box vs opened spider-blade core!
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.65,
      metalness: 0.4,
      roughness: 0.25,
    });
    const dangerMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 1.7,
    });

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), dangerMat);
    core.position.y = 0.4;
    root.add(core);

    const disguiseShell = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.56), shellMat);
    disguiseShell.position.y = 0.4;
    disguiseShell.castShadow = true;
    root.add(disguiseShell);
    root.userData.disguiseShell = disguiseShell;

    // Revealed spider blades (hidden while disguised)
    const bladesGroup = new THREE.Group();
    bladesGroup.position.y = 0.4;
    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) / 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.58, 4), dangerMat);
      leg.position.set(Math.cos(ang) * 0.34, -0.08, Math.sin(ang) * 0.34);
      leg.rotation.z = -Math.cos(ang) * 0.9;
      leg.rotation.x = Math.sin(ang) * 0.9;
      bladesGroup.add(leg);
    }
    bladesGroup.visible = false;
    root.add(bladesGroup);
    root.userData.revealedBlades = bladesGroup;
  } else if (type === 'ransomware') {
    // Hovering dark-violet cipher drone with twin spinning rings
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x3b0764,
      metalness: 0.85,
      roughness: 0.25,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xa855f7,
      emissiveIntensity: 1.6,
    });
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), darkMat);
    body.position.y = 0.72;
    body.castShadow = true;
    root.add(body);
    root.userData.cipherBody = body;

    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 6, 18), glowMat);
    r1.position.y = 0.72;
    const r2 = r1.clone();
    r2.rotation.y = Math.PI / 2;
    root.add(r1, r2);
    root.userData.cipherRings = [r1, r2];
  } else if (type === 'hotspot') {
    // Airborne quad-rotor signal moth in wireless layer!
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x422006,
      metalness: 0.75,
      roughness: 0.3,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 1.8,
    });

    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.56), bodyMat);
    fuselage.castShadow = true;
    root.add(fuselage);

    const rotors: THREE.Mesh[] = [];
    for (const [rx, rz] of [[-0.36, -0.3], [0.36, -0.3], [-0.36, 0.3], [0.36, 0.3]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.38), bodyMat);
      arm.position.set(rx * 0.55, 0, rz * 0.55);
      arm.rotation.y = Math.atan2(rx, rz);
      root.add(arm);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.06), glowMat);
      blade.position.set(rx, 0.08, rz);
      root.add(blade);
      rotors.push(blade);
    }
    const beacon = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 6), glowMat);
    beacon.position.y = 0.2;
    root.add(beacon);

    // Subtle vertical altitude tether line down toward ground plane
    const dropGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.1, 0),
      new THREE.Vector3(0, -2.15, 0),
    ]);
    const dropLine = new THREE.Line(
      dropGeo,
      new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.32 })
    );
    root.add(dropLine);

    root.userData.rotors = rotors;
  } else if (type === 'packer') {
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      metalness: 0.7,
      roughness: 0.25,
    });
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x14b8a6,
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.85,
    });
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.92, 6), coreMat);
    obelisk.position.y = 0.52;
    obelisk.castShadow = true;
    root.add(obelisk);

    const orbitPlates = new THREE.Group();
    orbitPlates.position.y = 0.55;
    for (let k = 0; k < 3; k++) {
      const ang = (k * Math.PI * 2) / 3;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.34), plateMat);
      plate.position.set(Math.cos(ang) * 0.46, 0, Math.sin(ang) * 0.46);
      plate.rotation.y = -ang;
      orbitPlates.add(plate);
    }
    root.add(orbitPlates);
    root.userData.orbitPlates = orbitPlates;
  } else if (type === 'boss_wankui') {
    // Colossal 6-legged botnet spider-mainframe
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.85,
      roughness: 0.3,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.8,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 1.35), hullMat);
    body.position.y = 0.78;
    body.castShadow = true;
    root.add(body);

    const spineCore = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), coreMat);
    spineCore.position.set(0, 1.12, -0.1);
    root.add(spineCore);

    const legs: THREE.Mesh[] = [];
    for (let side of [-1, 1]) {
      for (let idx of [-1, 0, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.16), hullMat);
        leg.position.set(side * 0.78, 0.46, idx * 0.46);
        leg.rotation.z = side * -0.55;
        leg.castShadow = true;
        root.add(leg);
        legs.push(leg);
      }
    }
    root.userData.bossLegs = legs;
    root.userData.bossCore = spineCore;
  } else if (type === 'boss_shenlou') {
    // Towering iridescent routing prism-serpent
    const prismMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xdb2777,
      emissiveIntensity: 1.5,
      metalness: 0.9,
      roughness: 0.15,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x311042,
      metalness: 0.85,
      roughness: 0.25,
    });
    const upper = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.0, 6), prismMat);
    upper.position.y = 1.2;
    upper.castShadow = true;
    root.userData.shenlouUpper = upper;
    const lower = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.75, 6), darkMat);
    lower.rotation.x = Math.PI;
    lower.position.y = 0.45;
    root.add(upper, lower);

    const rings = new THREE.Group();
    rings.position.y = 0.85;
    for (let k = 0; k < 2; k++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.82 - k * 0.18, 0.05, 8, 24), prismMat);
      r.rotation.x = Math.PI / 3 + k * 0.7;
      rings.add(r);
    }
    root.add(rings);
    root.userData.orbitPlates = rings;
  } else if (type === 'boss_zheying') {
    // APT Leviathan with stealth phase transparency -> escalated armor -> overdrive blades
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0xe11d48,
      emissiveIntensity: 1.2,
      metalness: 0.88,
      roughness: 0.22,
      transparent: true,
      opacity: 0.45,
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 1), bodyMat);
    core.position.y = 0.88;
    core.castShadow = true;
    root.add(core);
    root.userData.zheyingCore = core;
    root.userData.zheyingMat = bodyMat;

    const wings = new THREE.Group();
    wings.position.y = 0.9;
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xbe123c,
      emissiveIntensity: 1.6,
      metalness: 0.75,
    });
    for (const sx of [-1, 1]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 0.45), wingMat);
      blade.position.set(sx * 0.75, 0.1, -0.15);
      blade.rotation.z = sx * 0.38;
      blade.rotation.y = sx * -0.35;
      wings.add(blade);
    }
    root.add(wings);
    root.userData.orbitPlates = wings;
  }

  // Enemy Pack-Shield Bubble
  const enemyShield = new THREE.Mesh(
    new THREE.SphereGeometry(type.startsWith('boss_') ? 1.15 : 0.56, 12, 10),
    new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.34,
      wireframe: true,
    })
  );
  enemyShield.position.y = 0.48;
  enemyShield.visible = false;
  root.add(enemyShield);
  root.userData.enemyShield = enemyShield;

  cacheUnitMaterials(root, [enemyShield]);
  return root;
}

export function buildEntryPortalModel(hex: number): THREE.Group {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.28,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: 1.7,
    metalness: 0.3,
    roughness: 0.2,
  });

  for (const sx of [-0.72, 0.72]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.92, 0.22), metal);
    pylon.position.set(sx, 0.42, 0);
    pylon.castShadow = true;
    g.add(pylon);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.25), glow);
    strip.position.set(sx, 0.45, 0);
    g.add(strip);
  }

  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.065, 8, 18, Math.PI), glow);
  arch.position.y = 0.78;
  g.add(arch);

  const curtain = new THREE.Mesh(
    new THREE.PlaneGeometry(1.26, 0.76),
    new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    })
  );
  curtain.position.y = 0.44;
  g.add(curtain);
  return g;
}

export function buildExitCoreModel(mapId: MapId): { group: THREE.Group; spinParts: THREE.Object3D[] } {
  const g = new THREE.Group();
  const spinParts: THREE.Object3D[] = [];
  const darkSteel = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.86,
    roughness: 0.25,
  });

  if (mapId === 'intranet') {
    const emeraldGlow = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 1.65,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.34, 8), darkSteel);
    base.position.y = 0.2;
    g.add(base);

    for (let k = 0; k < 3; k++) {
      const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.56 - k * 0.08, 0.62 - k * 0.08, 0.14, 8), darkSteel);
      platter.position.y = 0.56 + k * 0.32;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62 - k * 0.08, 0.03, 6, 8), emeraldGlow);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = platter.position.y;
      g.add(platter, rim);
      spinParts.push(rim);
    }

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.36), emeraldGlow);
    gem.position.y = 1.62;
    g.add(gem);
    spinParts.push(gem);
  } else if (mapId === 'backbone') {
    const cyanGlow = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.65,
    });
    const violetGlow = new THREE.MeshStandardMaterial({
      color: 0xa78bfa,
      emissive: 0x7c3aed,
      emissiveIntensity: 1.4,
    });
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.66, 1.35, 6), darkSteel);
    spire.position.y = 0.72;
    g.add(spire);

    for (let k = 0; k < 3; k++) {
      const gyro = new THREE.Mesh(
        new THREE.TorusGeometry(0.78 - k * 0.1, 0.036, 8, 24),
        k % 2 === 0 ? cyanGlow : violetGlow
      );
      gyro.position.y = 1.1;
      gyro.rotation.set(Math.PI / 2 + k * 0.42, k * 0.5, 0);
      g.add(gyro);
      spinParts.push(gyro);
    }

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), cyanGlow);
    core.position.y = 1.56;
    g.add(core);
    spinParts.push(core);
  } else {
    // Airgap ICS containment reactor core
    const reactorGlow = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x059669,
      emissiveIntensity: 1.6,
    });
    const amberTrim = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 1.1,
    });
    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) / 2 + Math.PI / 4;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.34), darkSteel);
      fin.position.set(Math.cos(ang) * 0.68, 0.58, Math.sin(ang) * 0.68);
      fin.rotation.y = -ang;
      g.add(fin);
    }
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.68, 0.88, 12), darkSteel);
    drum.position.y = 0.5;
    g.add(drum);

    const hazard = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 8, 20), amberTrim);
    hazard.rotation.x = Math.PI / 2;
    hazard.position.y = 0.94;
    g.add(hazard);

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), reactorGlow);
    crystal.position.y = 1.38;
    g.add(crystal);
    spinParts.push(crystal);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.038, 8, 24), reactorGlow);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.38;
    g.add(halo);
    spinParts.push(halo);
  }

  return { group: g, spinParts };
}
