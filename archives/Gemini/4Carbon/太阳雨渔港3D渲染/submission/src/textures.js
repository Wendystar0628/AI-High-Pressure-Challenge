import * as THREE from 'three';
import { mulberry32 } from './prng.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function buildAllTextures() {
  const textures = {};

  // 1. Rain-wet rough concrete deck texture (tileable)
  {
    const rng = mulberry32(101);
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#dde5e6';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle watercolor washes & damp stains
    for (let i = 0; i < 65; i++) {
      const x = rng() * 512;
      const y = rng() * 512;
      const r = 24 + rng() * 75;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
      const dark = rng() > 0.45;
      grad.addColorStop(0, dark ? 'rgba(148, 168, 174, 0.20)' : 'rgba(242, 248, 249, 0.22)');
      grad.addColorStop(1, 'rgba(200, 212, 215, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine aggregate speckles
    for (let i = 0; i < 2400; i++) {
      const x = rng() * 512;
      const y = rng() * 512;
      const sz = 1 + rng() * 1.8;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(120, 136, 142, 0.16)' : 'rgba(250, 253, 253, 0.22)';
      ctx.fillRect(x, y, sz, sz);
    }

    // Concrete slab expansion joints (2x2 slabs per tile)
    ctx.strokeStyle = 'rgba(116, 134, 140, 0.42)';
    ctx.lineWidth = 2;
    for (const p of [0, 256]) {
      ctx.beginPath();
      ctx.moveTo(p, 0); ctx.lineTo(p, 512);
      ctx.moveTo(0, p); ctx.lineTo(512, p);
      ctx.stroke();
    }
    textures.wetConcrete = toTexture(c, 5, 5);
  }

  // 2. Concrete Seawall Blocks + Tidal Watermarks (vertical UV mapped from seabed y=-4.5 to top y=+1.65)
  {
    const rng = mulberry32(202);
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c9d4d6';
    ctx.fillRect(0, 0, 512, 512);

    const rows = 10;
    const rowH = 512 / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      const cols = 4;
      const colW = 512 / cols;
      const offset = (r % 2) * (colW * 0.5);
      for (let k = -1; k <= cols; k++) {
        const x = k * colW + offset;
        const shade = Math.floor(188 + (rng() - 0.5) * 24);
        ctx.fillStyle = `rgb(${shade}, ${shade + 8}, ${shade + 10})`;
        ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

        // Rough stone pitting
        for (let s = 0; s < 18; s++) {
          ctx.fillStyle = rng() > 0.5 ? 'rgba(90,110,115,0.18)' : 'rgba(240,247,248,0.15)';
          ctx.fillRect(x + 4 + rng() * (colW - 8), y + 4 + rng() * (rowH - 8), 3 + rng() * 5, 2 + rng() * 4);
        }
      }
      // Mortar joint
      ctx.fillStyle = 'rgba(84, 102, 108, 0.58)';
      ctx.fillRect(0, y, 512, 3);
    }

    // Tidal lines & long-term immersion bands (waterline is around v = 0.27 from top -> y = ~140px)
    // Remember canvas y=0 is top (y=+1.65), y=512 is bottom (y=-4.5). Waterline y=0 is at py ~ 138!
    const bands = [
      { y0: 112, y1: 148, col: 'rgba(66, 94, 86, 0.48)' },   // High tide damp band
      { y0: 136, y1: 190, col: 'rgba(46, 78, 68, 0.62)' },   // Main intertidal algal band
      { y0: 175, y1: 265, col: 'rgba(52, 86, 82, 0.45)' },   // Mid-submerged patina
      { y0: 250, y1: 512, col: 'rgba(42, 76, 82, 0.36)' },   // Deep submerged tint
    ];
    for (const b of bands) {
      const g = ctx.createLinearGradient(0, b.y0, 0, b.y1);
      g.addColorStop(0, 'rgba(50,80,75,0)');
      g.addColorStop(0.35, b.col);
      g.addColorStop(0.8, b.col);
      g.addColorStop(1, 'rgba(45,75,75,0.15)');
      ctx.fillStyle = g;
      ctx.fillRect(0, b.y0, 512, b.y1 - b.y0);
    }

    // Irregular wavy tide stain streaks
    ctx.strokeStyle = 'rgba(40, 68, 60, 0.55)';
    for (let w = 0; w < 5; w++) {
      const baseY = 122 + w * 14;
      ctx.lineWidth = 2 + (w % 2);
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 8) {
        const wy = baseY + Math.sin(x * 0.035 + w * 1.7) * 4 + (rng() - 0.5) * 3;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    textures.seawallBlocks = toTexture(c, 1, 1);
    const tiled = toTexture(c, 3, 1);
    textures.seawallBlocksWide = tiled;
  }

  // 3. Weathered Yellow & Black Diagonal Hazard Curb
  {
    const rng = mulberry32(303);
    const c = makeCanvas(512, 128);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#efc038';
    ctx.fillRect(0, 0, 512, 128);

    ctx.fillStyle = '#2b363c';
    const stripeW = 32;
    for (let x = -128; x < 640; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW - 96, 128);
      ctx.lineTo(x - 96, 128);
      ctx.closePath();
      ctx.fill();
    }

    // Natural paint chips & cement wear along edges
    for (let i = 0; i < 280; i++) {
      const x = rng() * 512;
      const y = rng() < 0.65 ? rng() * 28 : rng() * 128;
      ctx.fillStyle = rng() > 0.3 ? 'rgba(206, 216, 218, 0.68)' : 'rgba(130, 142, 145, 0.45)';
      ctx.fillRect(x, y, 3 + rng() * 10, 2 + rng() * 6);
    }
    textures.hazardStripes = toTexture(c, 6, 1);
  }

  // 4. Clean White Boat Hull Paint with Subtle Rust Streaks
  {
    const rng = mulberry32(404);
    const c = makeCanvas(512, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f4f9fa';
    ctx.fillRect(0, 0, 512, 256);

    // Subtle crisp blue-teal sheer stripe near top
    ctx.fillStyle = '#367f96';
    ctx.fillRect(0, 24, 512, 16);

    // Localized patchy rust drips & scuffs (kept restrained so hull stays clean white!)
    for (let i = 0; i < 14; i++) {
      const x = 25 + rng() * 462;
      const y = 36 + rng() * 150;
      const h = 18 + rng() * 48;
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, 'rgba(178, 92, 54, 0.68)');
      g.addColorStop(0.5, 'rgba(190, 112, 68, 0.32)');
      g.addColorStop(1, 'rgba(190, 112, 68, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 2, y, 4 + rng() * 6, h);
    }
    // Lower waterline anti-fouling red-teal rub mark
    ctx.fillStyle = 'rgba(175, 86, 68, 0.82)';
    ctx.fillRect(0, 224, 512, 32);

    textures.boatHull = toTexture(c, 1, 1);
  }

  // 5. Faded Harbor Name & Warning Signboard ("汐見漁港 / 注意落水")
  {
    const rng = mulberry32(505);
    const c = makeCanvas(512, 384);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e7eeed';
    ctx.fillRect(0, 0, 512, 384);

    // Faded sea-blue border
    ctx.strokeStyle = '#4c7e8e';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, 484, 356);

    // Header band
    ctx.fillStyle = '#3d7486';
    ctx.fillRect(24, 24, 464, 78);
    ctx.fillStyle = '#f3f8f8';
    ctx.font = 'bold 44px "Shippori Mincho B1 Medium", "Source Han Serif CN", "Yu Gothic", serif';
    ctx.textAlign = 'center';
    ctx.fillText('汐 見 漁 港', 256, 79);

    // Warning stripe & text
    ctx.fillStyle = '#d16047';
    ctx.font = 'bold 54px "Source Han Sans CN", "Noto Sans SC", "Yu Gothic", sans-serif';
    ctx.fillText('注意落水', 256, 186);

    ctx.fillStyle = '#3f5963';
    ctx.font = 'bold 28px "Yu Gothic", "Noto Sans SC", sans-serif';
    ctx.fillText('岸壁・階段すべりやすい', 256, 246);
    ctx.font = '22px "Yu Gothic", "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#5a747d';
    ctx.fillText('関係者以外立入注意 ・ 汐見町漁協', 256, 312);

    // Sun-fading & rust streaks around corner bolts
    for (const [bx, by] of [[34, 34], [478, 34], [34, 350], [478, 350]]) {
      ctx.fillStyle = '#7d4a35';
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();
      const rg = ctx.createLinearGradient(bx, by, bx, by + 48);
      rg.addColorStop(0, 'rgba(155, 84, 48, 0.55)');
      rg.addColorStop(1, 'rgba(155, 84, 48, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(bx - 5, by, 10, 48);
    }
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = 'rgba(235, 242, 242, 0.25)';
      ctx.fillRect(rng() * 512, rng() * 384, 8 + rng() * 26, 4 + rng() * 12);
    }
    textures.harborSign = toTexture(c);
  }

  // 6. Fishery Co-op Warehouse Sign & Auction Blackboard ("黑板上写着拍卖价格")
  {
    const c = makeCanvas(512, 128);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#dce6e7';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#53737d';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 112);
    ctx.fillStyle = '#2d5361';
    ctx.font = 'bold 42px "Shippori Mincho B1 Medium", "Source Han Serif CN", serif';
    ctx.textAlign = 'center';
    ctx.fillText('汐見漁業協同組合 荷捌所', 256, 78);
    textures.coopSign = toTexture(c);
  }

  {
    const c = makeCanvas(512, 320);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#244238';
    ctx.fillRect(0, 0, 512, 320);
    // Chalk dust smudge
    ctx.fillStyle = 'rgba(235, 245, 238, 0.08)';
    ctx.fillRect(24, 24, 464, 272);

    ctx.strokeStyle = 'rgba(235, 245, 240, 0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 472, 280);
    ctx.beginPath();
    ctx.moveTo(20, 76); ctx.lineTo(492, 76);
    ctx.stroke();

    ctx.fillStyle = '#f4f8f2';
    ctx.font = 'bold 30px "KaiTi", "STKaiti", "Yu Gothic", serif';
    ctx.textAlign = 'left';
    ctx.fillText('本日競り値（kg単価）  11/13', 38, 58);

    const items = [
      ['真鯛 (マダイ)', '¥2,450', '天然・上'],
      ['真鯵 (マアジ)', '¥  980', '定置網'],
      ['鯖   (サバ)',   '¥  840', '朝獲れ'],
      ['障泥烏賊',       '¥3,100', '活〆'],
      ['鰤   (ブリ)',   '¥1,890', '一本釣'],
    ];
    ctx.font = '25px "KaiTi", "STKaiti", "Yu Gothic", sans-serif';
    items.forEach(([fish, price, note], idx) => {
      const y = 118 + idx * 40;
      ctx.fillStyle = '#f2f7f0';
      ctx.fillText(fish, 38, y);
      ctx.fillStyle = '#ffe58f';
      ctx.fillText(price, 235, y);
      ctx.fillStyle = '#b9e3d8';
      ctx.fillText(note, 378, y);
    });
    textures.auctionBlackboard = toTexture(c);
  }

  // 7. Ferry Waiting Room Sign, Faded Timetable, Clock, Radio
  {
    const c = makeCanvas(512, 112);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f0f5f4';
    ctx.fillRect(0, 0, 512, 112);
    ctx.strokeStyle = '#4a7a88';
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, 500, 100);
    ctx.fillStyle = '#2d5c6b';
    ctx.font = 'bold 40px "Zen Kaku Gothic New Medium", "Yu Gothic", "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('汐見港 連絡船待合所', 256, 70);
    textures.ferrySign = toTexture(c);
  }

  {
    const c = makeCanvas(384, 512);
    const ctx = c.getContext('2d');
    // Sun-bleached aged paper
    ctx.fillStyle = '#f1ecdd';
    ctx.fillRect(0, 0, 384, 512);
    ctx.fillStyle = '#5c8f99';
    ctx.fillRect(20, 20, 344, 64);
    ctx.fillStyle = '#faf8f2';
    ctx.font = 'bold 30px "Yu Gothic", "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('定期船 発着時刻表', 192, 62);

    ctx.strokeStyle = '#8aa3a6';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 344, 470);

    const rows = [
      ['07 : 15', '青島・本港 行'],
      ['09 : 40', '青島・岬浦 行'],
      ['12 : 30', '本港 直行便'],
      ['15 : 50', '青島・本港 行'],
      ['17 : 45', '最終 本港 行'],
    ];
    rows.forEach(([time, dest], i) => {
      const y = 138 + i * 66;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(138, 175, 182, 0.16)' : 'rgba(0,0,0,0)';
      ctx.fillRect(24, y - 36, 336, 52);
      ctx.fillStyle = '#c46a52';
      ctx.font = 'bold 28px "Consolas", "Yu Gothic", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(time, 38, y);
      ctx.fillStyle = '#486066';
      ctx.font = '22px "Yu Gothic", "Noto Sans SC", sans-serif';
      ctx.fillText(dest, 168, y);
    });
    ctx.fillStyle = '#7d8e8f';
    ctx.font = '18px "Yu Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('荒天時は欠航する場合があります', 192, 468);
    textures.ferryTimetable = toTexture(c);
  }

  {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f7f5ec';
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4c6269';
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.fillStyle = '#2f434a';
    ctx.font = 'bold 24px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let h = 1; h <= 12; h++) {
      const ang = (h * Math.PI) / 6 - Math.PI / 2;
      ctx.fillText(String(h), 128 + Math.cos(ang) * 90, 128 + Math.sin(ang) * 90);
    }
    for (let m = 0; m < 60; m++) {
      const ang = (m * Math.PI) / 30;
      const r0 = m % 5 === 0 ? 105 : 110;
      ctx.strokeStyle = '#3b5159';
      ctx.lineWidth = m % 5 === 0 ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(128 + Math.cos(ang) * r0, 128 + Math.sin(ang) * r0);
      ctx.lineTo(128 + Math.cos(ang) * 115, 128 + Math.sin(ang) * 115);
      ctx.stroke();
    }
    textures.clockDial = toTexture(c);
  }

  // 8. Vending Machine Illuminated Front
  {
    const c = makeCanvas(256, 512);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#eef5f6';
    ctx.fillRect(0, 0, 256, 512);
    // Blue coastal lower apron
    ctx.fillStyle = '#3b86a1';
    ctx.fillRect(0, 320, 256, 192);

    // Glowing drink display window
    ctx.fillStyle = '#fff9e6';
    ctx.fillRect(20, 34, 216, 224);
    ctx.strokeStyle = '#89a4ad';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 34, 216, 224);

    // 3 shelves of colorful miniature drink cans/bottles
    const canColors = ['#e35b48', '#3da1c4', '#63b86c', '#f2b63d', '#4c75b8', '#e88a3e'];
    for (let row = 0; row < 3; row++) {
      const sy = 52 + row * 68;
      ctx.fillStyle = '#cfdce0';
      ctx.fillRect(26, sy + 44, 204, 8);
      for (let col = 0; col < 6; col++) {
        const cx = 34 + col * 32;
        ctx.fillStyle = canColors[(row * 3 + col) % canColors.length];
        ctx.fillRect(cx, sy + 6, 22, 36);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx + 3, sy + 14, 16, 8);
      }
      // Hot / Cold strip
      ctx.fillStyle = row === 2 ? '#d95745' : '#3a8cb5';
      ctx.fillRect(26, sy + 45, 204, 6);
    }

    // Coin slot + retrieval flap
    ctx.fillStyle = '#26363d';
    ctx.fillRect(30, 360, 140, 88);
    ctx.fillStyle = '#dce8eb';
    ctx.fillRect(184, 278, 46, 56);
    textures.vendingFront = toTexture(c);
  }

  // 9. Wheelhouse Interior Screens & Documents (Radar, Fishfinder, Chart+Tide, Omamori, Catch Photo)
  {
    // Glowing green/cyan Radar Screen
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0c2629';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#3ef2c8';
    ctx.lineWidth = 2;
    for (const r of [36, 72, 108]) {
      ctx.beginPath(); ctx.arc(128, 128, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(16, 128); ctx.lineTo(240, 128);
    ctx.moveTo(128, 16); ctx.lineTo(128, 240);
    ctx.stroke();
    // Radar coastline & breakwater echo blobs
    ctx.fillStyle = 'rgba(90, 255, 198, 0.78)';
    ctx.beginPath();
    ctx.moveTo(45, 70); ctx.lineTo(115, 62); ctx.lineTo(148, 88); ctx.lineTo(95, 105); ctx.closePath();
    ctx.fill();
    ctx.fillRect(156, 114, 24, 10);
    ctx.fillRect(92, 162, 14, 9);
    // Sweep sector glow
    const sg = ctx.createLinearGradient(128, 128, 225, 65);
    sg.addColorStop(0, 'rgba(90, 255, 205, 0.52)');
    sg.addColorStop(1, 'rgba(90, 255, 205, 0.05)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.arc(128, 128, 108, -0.85, -0.25);
    ctx.closePath();
    ctx.fill();
    textures.radarScreen = toTexture(c);
  }

  {
    // Glowing Fishfinder Echogram Screen
    const c = makeCanvas(256, 192);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#102944';
    ctx.fillRect(0, 0, 256, 192);
    // Seabed contour in warm orange/red + yellow
    ctx.fillStyle = '#d95b38';
    ctx.beginPath();
    ctx.moveTo(0, 192);
    for (let x = 0; x <= 256; x += 8) {
      const y = 136 + Math.sin(x * 0.04) * 18 + Math.cos(x * 0.09) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(256, 192);
    ctx.closePath();
    ctx.fill();
    // Fish school blips in cyan/yellow
    ctx.fillStyle = '#ffd95e';
    for (const [fx, fy] of [[68, 82], [84, 76], [96, 88], [164, 68], [180, 74], [192, 64]]) {
      ctx.fillRect(fx, fy, 12, 6);
    }
    ctx.fillStyle = '#7bf5ff';
    ctx.font = 'bold 20px Consolas, monospace';
    ctx.fillText('14.8m', 14, 28);
    ctx.fillText('18.2°C', 172, 28);
    textures.fishFinder = toTexture(c);
  }

  {
    // Clipped Nautical Chart & Tide Table ("夹在板上的海图与潮汐表")
    const c = makeCanvas(256, 320);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f6f2e1';
    ctx.fillRect(0, 0, 256, 320);
    // Landmass & bathymetry contours
    ctx.fillStyle = '#d9e3c8';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(155, 0); ctx.lineTo(120, 95); ctx.lineTo(42, 130); ctx.lineTo(0, 150);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5c9fb5';
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(185, 115, 35 + k * 24, 1.5, 4.4);
      ctx.stroke();
    }
    // Compass rose
    ctx.strokeStyle = '#bf5c4b';
    ctx.beginPath();
    ctx.arc(194, 64, 22, 0, Math.PI * 2);
    ctx.moveTo(194, 36); ctx.lineTo(194, 92);
    ctx.moveTo(166, 64); ctx.lineTo(222, 64);
    ctx.stroke();

    // Lower half: Tide Table Curve ("潮汐表")
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14, 182, 228, 122);
    ctx.strokeStyle = '#6f878f';
    ctx.strokeRect(14, 182, 228, 122);
    ctx.fillStyle = '#34525c';
    ctx.font = 'bold 18px "Yu Gothic", sans-serif';
    ctx.fillText('汐見港 潮汐表 11月', 24, 206);
    ctx.strokeStyle = '#2d84a3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 24; x <= 232; x += 4) {
      const y = 258 + Math.sin((x - 24) * 0.058) * 26;
      if (x === 24) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    textures.chartAndTide = toTexture(c);
  }

  {
    // Omamori charm ("海上安全") & Fish Catch Photo ("渔获照片")
    const c1 = makeCanvas(128, 192);
    const ctx1 = c1.getContext('2d');
    ctx1.fillStyle = '#d44238';
    ctx1.fillRect(0, 0, 128, 192);
    ctx1.strokeStyle = '#f5d16e';
    ctx1.lineWidth = 8;
    ctx1.strokeRect(10, 10, 108, 172);
    ctx1.fillStyle = '#faf5e6';
    ctx1.fillRect(36, 26, 56, 140);
    ctx1.fillStyle = '#2b2420';
    ctx1.font = 'bold 28px "Shippori Mincho B1 Medium", "Source Han Serif CN", serif';
    ctx1.textAlign = 'center';
    ['海', '上', '安', '全'].forEach((ch, i) => ctx1.fillText(ch, 64, 58 + i * 31));
    textures.omamori = toTexture(c1);

    const c2 = makeCanvas(192, 160);
    const ctx2 = c2.getContext('2d');
    ctx2.fillStyle = '#faf8f2';
    ctx2.fillRect(0, 0, 192, 160);
    ctx2.fillStyle = '#a8dbe3';
    ctx2.fillRect(14, 14, 164, 108);
    ctx2.fillStyle = '#4ca8ad';
    ctx2.fillRect(14, 78, 164, 44);
    // Prized red sea bream silhouette
    ctx2.fillStyle = '#e36f5b';
    ctx2.beginPath();
    ctx2.ellipse(92, 68, 48, 22, -0.08, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.moveTo(136, 65); ctx2.lineTo(158, 48); ctx2.lineTo(155, 82); ctx2.closePath();
    ctx2.fill();
    ctx2.fillStyle = '#223136';
    ctx2.beginPath(); ctx2.arc(58, 63, 4, 0, Math.PI * 2); ctx2.fill();
    ctx2.font = '16px "KaiTi", sans-serif';
    ctx2.textAlign = 'center';
    ctx2.fillText('大漁 真鯛 68cm', 96, 145);
    textures.catchPhoto = toTexture(c2);
  }

  // 10. Japanese Kawara Roof Tiles & Seabed Gravel
  {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#475c68';
    ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 32) {
      const g = ctx.createLinearGradient(x, 0, x + 32, 0);
      g.addColorStop(0, '#364852');
      g.addColorStop(0.45, '#59717e');
      g.addColorStop(1, '#31424b');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 32, 256);
    }
    ctx.strokeStyle = 'rgba(30, 42, 48, 0.55)';
    ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    textures.kawaraTiles = toTexture(c, 3, 2);
  }

  {
    const rng = mulberry32(909);
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8fa9a5';
    ctx.fillRect(0, 0, 512, 512);
    const pebbleCols = ['#789693', '#a3bab4', '#698583', '#b8cbc4', '#5c7878'];
    for (let i = 0; i < 950; i++) {
      const x = rng() * 512;
      const y = rng() * 512;
      const rx = 3 + rng() * 9;
      const ry = 2 + rng() * 7;
      ctx.fillStyle = pebbleCols[Math.floor(rng() * pebbleCols.length)];
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    textures.seabedGravel = toTexture(c, 4, 4);
  }

  // 11. Diorama Base Cross-Section Cutaway Texture (2.1 底座侧壁清晰可见，展示码头岸壁和水体的剖面，强化微缩模型的实体感)
  {
    const rng = mulberry32(1111);
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');

    // Top layer (y = 0..92px -> top ~1.1m): Poured coastal concrete deck slab cross-section
    ctx.fillStyle = '#ccd7d9';
    ctx.fillRect(0, 0, 512, 94);
    ctx.fillStyle = 'rgba(104, 122, 128, 0.45)';
    ctx.fillRect(0, 91, 512, 4);

    // Subtle tie-rod form holes & concrete aggregate in top slab
    for (let x = 32; x < 512; x += 64) {
      ctx.fillStyle = 'rgba(92, 110, 116, 0.45)';
      ctx.beginPath();
      ctx.arc(x, 46, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Middle layer (y = 94..225px): Compacted crushed coastal stone sub-base
    ctx.fillStyle = '#adbabd';
    ctx.fillRect(0, 94, 512, 132);
    const gravelShades = ['#97a7ab', '#bcc8ca', '#88989c', '#c7d2d4'];
    for (let i = 0; i < 420; i++) {
      const gx = rng() * 512;
      const gy = 98 + rng() * 122;
      ctx.fillStyle = gravelShades[Math.floor(rng() * gravelShades.length)];
      ctx.beginPath();
      ctx.ellipse(gx, gy, 4 + rng() * 8, 2.5 + rng() * 4.5, (rng() - 0.5) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(86, 102, 106, 0.42)';
    ctx.fillRect(0, 224, 512, 3);

    // Lower layer (y = 226..512px): Stratified coastal sandstone / harbor foundation rock
    const rockGrad = ctx.createLinearGradient(0, 226, 0, 512);
    rockGrad.addColorStop(0, '#9aa9ac');
    rockGrad.addColorStop(0.5, '#8a9a9e');
    rockGrad.addColorStop(1, '#798a8e');
    ctx.fillStyle = rockGrad;
    ctx.fillRect(0, 226, 512, 286);

    // Gentle sedimentary strata lines
    ctx.strokeStyle = 'rgba(70, 86, 90, 0.34)';
    for (let sy = 258; sy < 500; sy += 36) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 16) {
        const wy = sy + Math.sin(x * 0.025 + sy) * 3.5;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    textures.dioramaCutaway = toTexture(c, 3, 1);
  }

  // 13. Weathered Cedar Plank Texture for Inverted Wooden Sampan ("倒扣着的小木舢板")
  {
    const rng = mulberry32(1313);
    const c = makeCanvas(512, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#a38364';
    ctx.fillRect(0, 0, 512, 256);

    const planks = 6;
    const ph = 256 / planks;
    const plankColors = ['#a88869', '#9c7c5e', '#ad8d6e', '#967659', '#a58566', '#8f6f53'];
    for (let p = 0; p < planks; p++) {
      const py = p * ph;
      ctx.fillStyle = plankColors[p % plankColors.length];
      ctx.fillRect(0, py + 1, 512, ph - 2);

      // Subtle horizontal cedar wood-grain streaks
      for (let g = 0; g < 18; g++) {
        const gy = py + 3 + rng() * (ph - 6);
        ctx.strokeStyle = rng() > 0.5 ? 'rgba(92, 66, 44, 0.22)' : 'rgba(218, 194, 166, 0.18)';
        ctx.lineWidth = 1 + rng() * 1.4;
        ctx.beginPath();
        for (let x = 0; x <= 512; x += 32) {
          const wy = gy + Math.sin(x * 0.02 + g + p) * 1.6;
          if (x === 0) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.stroke();
      }
      // Caulked strake seam between cedar planks
      ctx.fillStyle = 'rgba(68, 48, 34, 0.72)';
      ctx.fillRect(0, py, 512, 2.5);
    }

    // Damp dark patina near gunwale (v=0 -> y=0) & sun-bleached salt wear near keel (v=1 -> y=256)
    const dampGrad = ctx.createLinearGradient(0, 0, 0, 58);
    dampGrad.addColorStop(0, 'rgba(58, 72, 64, 0.42)');
    dampGrad.addColorStop(1, 'rgba(58, 72, 64, 0)');
    ctx.fillStyle = dampGrad;
    ctx.fillRect(0, 0, 512, 58);

    const keelBleach = ctx.createLinearGradient(0, 200, 0, 256);
    keelBleach.addColorStop(0, 'rgba(215, 208, 196, 0)');
    keelBleach.addColorStop(1, 'rgba(215, 208, 196, 0.28)');
    ctx.fillStyle = keelBleach;
    ctx.fillRect(0, 200, 512, 56);

    textures.woodenSampan = toTexture(c, 1, 1);
  }

  return textures;
}

/**
 * Generates a custom faded buoy number texture or boat registration plaque.
 */
export function makeNumberedTexture(label, bgHex = '#eb7b46', textHex = '#f7f8f2') {
  const rng = mulberry32(label.charCodeAt(0) * 97 + label.length * 31);
  const c = makeCanvas(256, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = textHex;
  ctx.font = 'bold 52px "Consolas", "Yu Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 64);
  // Salt-water fading scuffs
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = bgHex;
    ctx.globalAlpha = 0.28;
    ctx.fillRect(rng() * 256, rng() * 128, 4 + rng() * 14, 3 + rng() * 8);
  }
  return toTexture(c);
}
