import * as THREE from 'three';

const CJK_SANS = '"Yu Gothic", "Source Han Sans CN", "Noto Sans SC", "Microsoft YaHei", sans-serif';
const CJK_SERIF = '"Shippori Mincho B1 Medium", "Source Han Serif CN", "Noto Serif SC", "MS PMincho", serif';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTexture(canvas, { repeatX = 1, repeatY = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createConcreteDeckTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const rng = seededRand(101);

  ctx.fillStyle = '#dde5e7';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle wet rainwater stains & tonal patches
  for (let i = 0; i < 65; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const r = 18 + rng() * 68;
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    const dark = rng() > 0.45 ? 'rgba(138, 158, 165, 0.16)' : 'rgba(245, 250, 252, 0.14)';
    g.addColorStop(0, dark);
    g.addColorStop(1, 'rgba(220, 230, 233, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine aggregate concrete speckle
  for (let i = 0; i < 2200; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const v = rng() > 0.5 ? 'rgba(95,115,122,0.12)' : 'rgba(255,255,255,0.18)';
    ctx.fillStyle = v;
    ctx.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 2);
  }

  // Concrete slab expansion joints
  ctx.strokeStyle = 'rgba(105, 125, 134, 0.42)';
  ctx.lineWidth = 2;
  for (let p = 0; p < 512; p += 128) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 512);
    ctx.moveTo(0, p);
    ctx.lineTo(512, p);
    ctx.stroke();
  }

  return finalizeTexture(c, { repeatX: 5, repeatY: 5 });
}

export function createQuayMasonryTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const rng = seededRand(202);

  // Base concrete block color
  ctx.fillStyle = '#cdd8db';
  ctx.fillRect(0, 0, 512, 512);

  // Layered concrete courses (5 rows across height)
  const rows = 5;
  const rowH = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const cols = 4;
    const colW = 512 / cols;
    const offset = (r % 2) * (colW * 0.5);

    for (let col = -1; col <= cols; col++) {
      const x = col * colW + offset;
      const shade = 200 + Math.floor((rng() - 0.5) * 20);
      ctx.fillStyle = `rgb(${shade - 6}, ${shade + 3}, ${shade + 7})`;
      ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

      // Subtle vertical weathering streaks
      for (let s = 0; s < 5; s++) {
        const sx = x + 6 + rng() * (colW - 12);
        ctx.fillStyle = 'rgba(85, 108, 118, 0.14)';
        ctx.fillRect(sx, y + 3, 3 + rng() * 6, rowH - 6);
      }
    }

    // Crisp recessed mortar seam
    ctx.fillStyle = 'rgba(72, 92, 102, 0.55)';
    ctx.fillRect(0, y, 512, 4);
  }

  // Vertical block seams
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const cols = 4;
    const colW = 512 / cols;
    const offset = (r % 2) * (colW * 0.5);
    ctx.fillStyle = 'rgba(72, 92, 102, 0.5)';
    for (let col = 0; col <= cols; col++) {
      const x = ((col * colW + offset) % 512 + 512) % 512;
      ctx.fillRect(x, y, 3, rowH);
    }
  }

  return finalizeTexture(c, { repeatX: 4, repeatY: 1 });
}

export function createHazardCurbTexture() {
  const c = makeCanvas(512, 128);
  const ctx = c.getContext('2d');
  const rng = seededRand(303);

  ctx.fillStyle = '#f2c12e';
  ctx.fillRect(0, 0, 512, 128);

  // Diagonal charcoal-black stripes
  ctx.fillStyle = '#252d33';
  const stripeW = 46;
  for (let x = -128; x < 640; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 128);
    ctx.lineTo(x + stripeW, 128);
    ctx.lineTo(x + stripeW + 96, 0);
    ctx.lineTo(x + 96, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Natural chipped concrete wear along top edge & face
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = rng() > 0.35 ? 'rgba(216, 224, 226, 0.65)' : 'rgba(130, 145, 150, 0.45)';
    const x = rng() * 512;
    const y = rng() < 0.5 ? rng() * 24 : rng() * 128;
    ctx.fillRect(x, y, 3 + rng() * 14, 2 + rng() * 8);
  }

  return finalizeTexture(c, { repeatX: 1, repeatY: 1 });
}

export function createSeabedTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const rng = seededRand(404);

  ctx.fillStyle = '#8cb7b3';
  ctx.fillRect(0, 0, 512, 512);

  // Sandy shoal mottling
  for (let i = 0; i < 80; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const r = 20 + rng() * 55;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, rng() > 0.5 ? 'rgba(176, 204, 188, 0.32)' : 'rgba(78, 126, 128, 0.28)');
    g.addColorStop(1, 'rgba(120,165,162,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gravel pebbles & shell flecks
  for (let i = 0; i < 2400; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const sz = 1.5 + rng() * 4.5;
    const pick = rng();
    ctx.fillStyle = pick > 0.72 ? '#d7e3d6' : pick > 0.35 ? '#6d9494' : '#4a6e72';
    ctx.beginPath();
    ctx.ellipse(x, y, sz, sz * 0.75, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(c, { repeatX: 6, repeatY: 6 });
}

export function createRoofTileTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#38566d';
  ctx.fillRect(0, 0, 256, 256);

  const cols = 8;
  const rows = 8;
  const cw = 256 / cols;
  const rh = 256 / rows;

  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    for (let col = 0; col < cols; col++) {
      const x = col * cw;
      const g = ctx.createLinearGradient(x, y, x + cw, y);
      g.addColorStop(0, '#2a4559');
      g.addColorStop(0.45, '#4c6d85');
      g.addColorStop(0.85, '#3b5a72');
      g.addColorStop(1, '#22384a');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cw, rh - 2);
    }
    ctx.fillStyle = '#1f3242';
    ctx.fillRect(0, y + rh - 3, 256, 3);
  }
  return finalizeTexture(c, { repeatX: 3, repeatY: 2 });
}

export function createCorrugatedWallTexture(baseHex = '#dae5e8') {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const rng = seededRand(505);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Vertical corrugation ribs
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x, 0, 5, 256);
    ctx.fillStyle = 'rgba(72, 102, 118, 0.22)';
    ctx.fillRect(x + 8, 0, 6, 256);
  }

  // Subtle rust along bottom hem
  const rustGrad = ctx.createLinearGradient(0, 195, 0, 256);
  rustGrad.addColorStop(0, 'rgba(175, 102, 66, 0)');
  rustGrad.addColorStop(1, 'rgba(155, 86, 52, 0.36)');
  ctx.fillStyle = rustGrad;
  ctx.fillRect(0, 195, 256, 61);

  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = 'rgba(155, 86, 52, 0.22)';
    ctx.fillRect(rng() * 256, 200 + rng() * 52, 4 + rng() * 14, 3 + rng() * 10);
  }

  return finalizeTexture(c, { repeatX: 2, repeatY: 1 });
}

export function createAuctionBlackboardTexture() {
  const c = makeCanvas(512, 320);
  const ctx = c.getContext('2d');

  // Deep slate chalkboard
  ctx.fillStyle = '#253b38';
  ctx.fillRect(0, 0, 512, 320);

  // Chalk dust smudges
  const g = ctx.createRadialGradient(256, 160, 20, 256, 160, 240);
  g.addColorStop(0, 'rgba(235, 245, 240, 0.08)');
  g.addColorStop(1, 'rgba(20, 35, 32, 0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 320);

  ctx.strokeStyle = 'rgba(245, 248, 242, 0.72)';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, 484, 292);

  ctx.fillStyle = '#f4e39e';
  ctx.font = `bold 32px ${CJK_SANS}`;
  ctx.fillText('本日の水揚げ・競り値', 36, 58);

  ctx.strokeStyle = 'rgba(244, 227, 158, 0.55)';
  ctx.beginPath();
  ctx.moveTo(32, 74);
  ctx.lineTo(476, 74);
  ctx.stroke();

  const items = [
    ['真鯛 (マダイ)', '¥ 1,850 / kg'],
    ['真鯵 (マアジ)', '¥   680 / kg'],
    ['スルメイカ', '¥   980 / 杯'],
    ['伊勢海老', '¥ 4,200 / kg'],
    ['青背サバ', '¥   520 / kg'],
  ];

  ctx.font = `24px ${CJK_SANS}`;
  items.forEach(([name, price], i) => {
    const y = 116 + i * 40;
    ctx.fillStyle = '#eef5ef';
    ctx.fillText(name, 40, y);
    ctx.fillStyle = i === 3 ? '#f7b89c' : '#d6f0ea';
    ctx.fillText(price, 290, y);
  });

  return finalizeTexture(c, { repeatX: 1, repeatY: 1 });
}

export function createTimetableTexture() {
  const c = makeCanvas(384, 512);
  const ctx = c.getContext('2d');

  // Weathered yellowing paper poster
  ctx.fillStyle = '#efe6cf';
  ctx.fillRect(0, 0, 384, 512);
  ctx.strokeStyle = '#6f828a';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 360, 488);

  ctx.fillStyle = '#2c5b73';
  ctx.fillRect(24, 24, 336, 66);

  ctx.fillStyle = '#f8f5ea';
  ctx.font = `bold 26px ${CJK_SANS}`;
  ctx.fillText('潮風港 定期船時刻表', 52, 66);

  ctx.fillStyle = '#3b4a52';
  ctx.font = `18px ${CJK_SANS}`;
  ctx.fillText('行先：沖ノ島・南浜', 36, 122);

  const times = [
    ['第1便', '07:20', '07:55'],
    ['第2便', '10:45', '11:20'],
    ['第3便', '14:10', '14:45'],
    ['第4便', '16:35', '17:10'],
    ['最終便', '18:05', '18:40'],
  ];

  ctx.strokeStyle = '#9aa6aa';
  ctx.lineWidth = 2;
  times.forEach(([label, dep, arr], idx) => {
    const y = 175 + idx * 54;
    ctx.fillStyle = idx % 2 === 0 ? 'rgba(44, 91, 115, 0.08)' : 'rgba(255,255,255,0.22)';
    ctx.fillRect(30, y - 30, 324, 44);
    ctx.fillStyle = '#2d3b42';
    ctx.font = `bold 21px ${CJK_SANS}`;
    ctx.fillText(label, 44, y);
    ctx.fillText(`${dep} → ${arr}`, 152, y);
  });

  ctx.fillStyle = '#b45340';
  ctx.font = `16px ${CJK_SANS}`;
  ctx.fillText('※ 雨天・強風時は欠航の場合あり', 44, 466);

  return finalizeTexture(c);
}

export function createClockTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#f4f1e6';
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#344c57';
  ctx.lineWidth = 10;
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r1 = i % 3 === 0 ? 84 : 94;
    const r2 = 106;
    ctx.strokeStyle = '#2d404a';
    ctx.lineWidth = i % 3 === 0 ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1);
    ctx.lineTo(128 + Math.cos(a) * r2, 128 + Math.sin(a) * r2);
    ctx.stroke();
  }

  // Hands at ~4:15 after-school afternoon
  ctx.strokeStyle = '#233038';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.cos(0.45) * 60, 128 + Math.sin(0.45) * 60);
  ctx.stroke();

  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.cos(-0.15) * 88, 128 + Math.sin(-0.15) * 88);
  ctx.stroke();

  ctx.fillStyle = '#c85b42';
  ctx.beginPath();
  ctx.arc(128, 128, 8, 0, Math.PI * 2);
  ctx.fill();

  return finalizeTexture(c);
}

export function createRadarScreenTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#07241e';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#1f7a58';
  ctx.lineWidth = 2;
  [36, 72, 108].forEach((r) => {
    ctx.beginPath();
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.moveTo(16, 128);
  ctx.lineTo(240, 128);
  ctx.moveTo(128, 16);
  ctx.lineTo(128, 240);
  ctx.stroke();

  // Sweep glow wedge
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 110);
  g.addColorStop(0, 'rgba(90, 255, 175, 0.55)');
  g.addColorStop(1, 'rgba(30, 160, 105, 0.08)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.arc(128, 128, 108, -0.9, -0.15);
  ctx.closePath();
  ctx.fill();

  // Coastline echoes & buoy blips
  ctx.fillStyle = '#8affc4';
  [
    [164, 88, 5],
    [182, 104, 4],
    [82, 152, 6],
    [146, 62, 4],
  ].forEach(([x, y, r]) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  return finalizeTexture(c);
}

export function createFishfinderTexture() {
  const c = makeCanvas(256, 192);
  const ctx = c.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, 192);
  bg.addColorStop(0, '#0c3554');
  bg.addColorStop(1, '#061a2c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 192);

  // Depth grid lines
  ctx.strokeStyle = 'rgba(110, 210, 245, 0.28)';
  ctx.lineWidth = 1;
  for (let y = 32; y < 192; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  // Seabed profile contour
  ctx.fillStyle = '#d9693b';
  ctx.beginPath();
  ctx.moveTo(0, 192);
  for (let x = 0; x <= 256; x += 16) {
    ctx.lineTo(x, 148 + Math.sin(x * 0.05) * 14);
  }
  ctx.lineTo(256, 192);
  ctx.closePath();
  ctx.fill();

  // Fish school arch echoes
  const fishes = [
    [68, 86],
    [94, 78],
    [118, 92],
    [154, 74],
    [176, 88],
  ];
  fishes.forEach(([x, y]) => {
    ctx.strokeStyle = '#ffdf5e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 10, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  });

  ctx.fillStyle = '#8ef5ff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('14.2m', 12, 26);

  return finalizeTexture(c);
}

export function createChartClipboardTexture() {
  const c = makeCanvas(256, 320);
  const ctx = c.getContext('2d');

  // Nautical paper chart + tide table sheet
  ctx.fillStyle = '#f5f2e4';
  ctx.fillRect(0, 0, 256, 320);

  // Shallow cyan water contour on chart
  ctx.fillStyle = '#cfeef2';
  ctx.fillRect(16, 18, 224, 172);
  ctx.fillStyle = '#e5dcc3';
  ctx.beginPath();
  ctx.moveTo(16, 18);
  ctx.lineTo(120, 18);
  ctx.lineTo(95, 110);
  ctx.lineTo(16, 145);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#294859';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('CHART 海図', 24, 36);
  ctx.font = '11px monospace';
  ctx.fillStyle = '#3d697a';
  ctx.fillText('5.8m', 124, 148);
  ctx.fillText('3.2m', 142, 74);

  // Route line & compass rose
  ctx.strokeStyle = '#cc4d3d';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(74, 130);
  ctx.lineTo(165, 92);
  ctx.lineTo(205, 52);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#406b7d';
  ctx.beginPath();
  ctx.arc(196, 148, 20, 0, Math.PI * 2);
  ctx.stroke();

  // Tide table curve below (潮汐表)
  ctx.fillStyle = '#2d5c78';
  ctx.fillRect(16, 200, 224, 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('潮汐表 TIDE TABLE', 24, 215);
  ctx.strokeStyle = '#2d5c78';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 220, 224, 82);
  ctx.beginPath();
  for (let x = 22; x <= 234; x += 8) {
    const t = (x - 22) / 212;
    const y = 264 - Math.sin(t * Math.PI * 2.2) * 24;
    if (x === 22) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#406072';
  ctx.font = '10px monospace';
  ctx.fillText('06h      12h      18h', 26, 297);

  return finalizeTexture(c);
}

export function createCatchPhotoTexture() {
  const c = makeCanvas(192, 144);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f7f5ee';
  ctx.fillRect(0, 0, 192, 144);
  ctx.fillStyle = '#7ec8d8';
  ctx.fillRect(12, 12, 168, 102);
  ctx.fillStyle = '#43899e';
  ctx.fillRect(12, 74, 168, 40);
  // Stylized red snapper silhouette on boat deck snapshot
  ctx.fillStyle = '#e56f5b';
  ctx.beginPath();
  ctx.ellipse(100, 66, 42, 18, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(136, 56);
  ctx.lineTo(156, 44);
  ctx.lineTo(152, 74);
  ctx.closePath();
  ctx.fill();
  return finalizeTexture(c);
}

export function createOmamoriTexture() {
  const c = makeCanvas(128, 192);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c84b3d';
  ctx.fillRect(0, 0, 128, 192);
  ctx.strokeStyle = '#f3cb6c';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 108, 172);
  ctx.fillStyle = '#f5eedc';
  ctx.fillRect(36, 38, 56, 114);
  ctx.fillStyle = '#2d3a40';
  ctx.font = `bold 24px ${CJK_SERIF}`;
  ['航', '海', '安', '全'].forEach((ch, idx) => {
    ctx.fillText(ch, 52, 66 + idx * 26);
  });
  return finalizeTexture(c);
}

export function createWarningSignTexture() {
  const c = makeCanvas(512, 360);
  const ctx = c.getContext('2d');
  const rng = seededRand(606);

  // Faded cream enamel plate
  ctx.fillStyle = '#f0ede0';
  ctx.fillRect(0, 0, 512, 360);

  // Teal header band
  ctx.fillStyle = '#2e6f86';
  ctx.fillRect(18, 18, 476, 112);

  ctx.fillStyle = '#f7f8f5';
  ctx.font = `bold 44px ${CJK_SANS}`;
  ctx.fillText('潮風漁港', 152, 76);
  ctx.font = `24px ${CJK_SANS}`;
  ctx.fillText('第三岸壁・小型船泊地', 132, 114);

  // Warning stripe & text
  ctx.fillStyle = '#d95343';
  ctx.fillRect(28, 152, 456, 14);
  ctx.fillStyle = '#c94334';
  ctx.font = `bold 64px ${CJK_SANS}`;
  ctx.fillText('注意落水', 124, 242);

  ctx.fillStyle = '#334854';
  ctx.font = `26px ${CJK_SANS}`;
  ctx.fillText('足元滑りやすし・立入注意', 96, 298);

  ctx.strokeStyle = '#3d5866';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 488, 336);

  // Chipped paint & rust weathering around bolts
  [
    [30, 30],
    [482, 30],
    [30, 330],
    [482, 330],
  ].forEach(([bx, by]) => {
    const g = ctx.createRadialGradient(bx, by, 2, bx, by, 26);
    g.addColorStop(0, 'rgba(148, 72, 40, 0.72)');
    g.addColorStop(1, 'rgba(148, 72, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, 26, 0, Math.PI * 2);
    ctx.fill();
  });

  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = 'rgba(195, 200, 192, 0.45)';
    ctx.fillRect(rng() * 512, rng() * 360, 4 + rng() * 14, 2 + rng() * 6);
  }

  return finalizeTexture(c);
}

export function createVendingFrontTexture() {
  const c = makeCanvas(384, 512);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#e7eef0';
  ctx.fillRect(0, 0, 384, 512);

  // Illuminated showcase backdrop
  ctx.fillStyle = '#fff9e6';
  ctx.fillRect(26, 28, 332, 278);

  const rowColors = [
    ['#d95847', '#4aa869', '#387dc4', '#e8a238', '#429ea6', '#8d5ca6'],
    ['#387dc4', '#387dc4', '#58b878', '#58b878', '#f0c446', '#e06358'],
    ['#68c4d4', '#68c4d4', '#499e75', '#d97a4a', '#3c689c', '#3c689c'],
  ];

  rowColors.forEach((cols, r) => {
    const ry = 46 + r * 86;
    // Shelf bar
    ctx.fillStyle = '#cfd9dc';
    ctx.fillRect(34, ry + 56, 316, 12);

    cols.forEach((col, ci) => {
      const cx = 44 + ci * 50;
      ctx.fillStyle = col;
      ctx.fillRect(cx, ry + 8, 30, 46);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(cx + 5, ry + 14, 6, 32);
      // Price tag
      ctx.fillStyle = '#263842';
      ctx.fillRect(cx + 2, ry + 58, 26, 9);
    });
  });

  // Lower blue coastal graphic panel
  ctx.fillStyle = '#3c8ea8';
  ctx.fillRect(24, 322, 336, 84);
  ctx.fillStyle = '#f8fbff';
  ctx.font = `bold 28px ${CJK_SANS}`;
  ctx.fillText('つめた〜い お飲物', 62, 374);

  // Pickup flap
  ctx.fillStyle = '#36464f';
  ctx.fillRect(42, 424, 240, 56);

  return finalizeTexture(c);
}

export function createBuoyNumberTexture(numStr) {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  const rng = seededRand(numStr.charCodeAt(0) * 97);

  ctx.fillStyle = '#e88b35';
  ctx.fillRect(0, 0, 512, 256);

  // Subtle cream band near top
  ctx.fillStyle = 'rgba(246, 243, 232, 0.35)';
  ctx.fillRect(0, 26, 512, 20);

  // Print faded stencil number on two opposite sides around circumference
  ctx.fillStyle = 'rgba(250, 246, 232, 0.90)';
  ctx.font = 'bold 88px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numStr, 128, 134);
  ctx.fillText(numStr, 384, 134);

  // Salt & faded wear
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = 'rgba(235, 228, 210, 0.34)';
    ctx.fillRect(rng() * 512, rng() * 256, 4 + rng() * 14, 2 + rng() * 8);
  }
  return finalizeTexture(c);
}

export function createFishnetTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  ctx.strokeStyle = '#3f7673';
  ctx.lineWidth = 4.5;
  const step = 28;
  for (let offset = -256; offset <= 512; offset += step) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + 256, 256);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offset + 256, 0);
    ctx.lineTo(offset, 256);
    ctx.stroke();
  }

  // Border rope selvedge along top & bottom edges
  ctx.fillStyle = '#538a84';
  ctx.fillRect(0, 0, 256, 10);
  ctx.fillRect(0, 246, 256, 10);

  const tex = finalizeTexture(c, { repeatX: 2, repeatY: 1 });
  return tex;
}

export function createBoatHullTexture(regCode, stripeHex = '#3a869e', seed = 701) {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  const rng = seededRand(seed);

  // Clean off-white hull paint
  ctx.fillStyle = '#f3f7f8';
  ctx.fillRect(0, 0, 512, 256);

  // Accent stripe along sheer
  ctx.fillStyle = stripeHex;
  ctx.fillRect(0, 62, 512, 22);

  // Subtle boot-top waterline band
  ctx.fillStyle = '#2d5c70';
  ctx.fillRect(0, 196, 512, 60);

  // Faded hull registration letters centered amidships (legible on both port & starboard)
  ctx.fillStyle = '#2f4b5a';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(regCode, 256, 126);
  ctx.textAlign = 'left';

  // Patchy rust streaks near bow hawsehole & rubbing strakes
  for (let i = 0; i < 18; i++) {
    const rx = 40 + rng() * 430;
    const ry = 48 + rng() * 135;
    const g = ctx.createLinearGradient(rx, ry, rx, ry + 34);
    g.addColorStop(0, 'rgba(165, 88, 52, 0.42)');
    g.addColorStop(1, 'rgba(165, 88, 52, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx - 4, ry, 8 + rng() * 8, 24 + rng() * 20);
  }

  return finalizeTexture(c);
}

// Coarse twisted hemp/nylon braided rope texture (干缆橙棕 vs 浸水深褐)
export function createRopeFiberTexture({ darkWet = false } = {}) {
  const c = makeCanvas(256, 128);
  const ctx = c.getContext('2d');
  const rng = seededRand(darkWet ? 912 : 419);

  ctx.fillStyle = darkWet ? '#72341c' : '#d2673d';
  ctx.fillRect(0, 0, 256, 128);

  // Diagonal braided rope twist valleys & raised fiber ridges
  for (let offset = -128; offset <= 384; offset += 24) {
    ctx.strokeStyle = darkWet ? 'rgba(42, 16, 8, 0.52)' : 'rgba(112, 46, 20, 0.42)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + 128, 128);
    ctx.stroke();

    ctx.strokeStyle = darkWet ? 'rgba(148, 80, 52, 0.34)' : 'rgba(244, 168, 122, 0.38)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(offset + 8, 0);
    ctx.lineTo(offset + 136, 128);
    ctx.stroke();
  }

  // Fine coarse loose hemp fiber striations
  for (let i = 0; i < 180; i++) {
    const x = rng() * 256;
    const y = rng() * 128;
    const len = 10 + rng() * 18;
    ctx.strokeStyle = rng() > 0.5
      ? (darkWet ? 'rgba(46, 18, 9, 0.35)' : 'rgba(128, 52, 22, 0.28)')
      : (darkWet ? 'rgba(162, 96, 66, 0.24)' : 'rgba(255, 204, 166, 0.26)');
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + len);
    ctx.stroke();
  }

  return finalizeTexture(c, { repeatX: 6, repeatY: 2 });
}

export function createScaleDialTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const cx = 128;
  const cy = 128;

  ctx.fillStyle = '#f5f2e6';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#33464f';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 114, 0, Math.PI * 2);
  ctx.stroke();

  // Minor and major scale graduation ticks
  for (let i = 0; i < 40; i++) {
    const a = -Math.PI * 0.5 + (i / 40) * Math.PI * 2;
    const isMajor = i % 4 === 0;
    const r0 = isMajor ? 82 : 94;
    const r1 = 104;
    ctx.strokeStyle = i >= 32 ? '#c94c3e' : '#2e414b';
    ctx.lineWidth = isMajor ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }

  ctx.fillStyle = '#2d404a';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ['0', '10', '20', '30', '40'].forEach((label, idx) => {
    const a = -Math.PI * 0.5 + (idx / 5) * Math.PI * 2;
    ctx.fillText(label, cx + Math.cos(a) * 63, cy + Math.sin(a) * 63);
  });
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#536c77';
  ctx.fillText('kg', cx, cy + 32);

  // Red pointer hand & center cap
  ctx.strokeStyle = '#d9483b';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy + 16);
  ctx.lineTo(cx + 42, cy - 68);
  ctx.stroke();

  ctx.fillStyle = '#2b3940';
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.fill();

  return finalizeTexture(c);
}
