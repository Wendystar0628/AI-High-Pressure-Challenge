const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = path.join(__dirname, '..', 'assets', 'wallpapers');
fs.mkdirSync(outDir, { recursive: true });

// CRC32 table for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, crcInput, crcBuf]);
}

function writePng(filePath, width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });
  const png = Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(filePath, png);
}

// Deterministic hash & smooth value noise / fbm
function hash1(x, seed) {
  let n = Math.sin(x * 127.1 + seed * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise1D(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i, seed) * (1 - u) + hash1(i + 1, seed) * u;
}

function fbm1D(x, seed, octaves = 5) {
  let v = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let o = 0; o < octaves; o++) {
    v += amp * noise1D(x * freq, seed + o * 17);
    freq *= 2.03;
    amp *= 0.5;
  }
  return v;
}

function ridge1D(x, seed, octaves = 5) {
  let v = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let o = 0; o < octaves; o++) {
    const n = 1.0 - Math.abs(noise1D(x * freq, seed + o * 23) * 2.0 - 1.0);
    v += amp * n * n;
    freq *= 2.1;
    amp *= 0.5;
  }
  return v;
}

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function mixColor(c1, c2, t) {
  const k = Math.max(0, Math.min(1, t));
  return [
    lerp(c1[0], c2[0], k),
    lerp(c1[1], c2[1], k),
    lerp(c1[2], c2[2], k)
  ];
}

function renderLandscape(width, height, theme) {
  const buf = Buffer.alloc(width * height * 4);
  const lakeLine = Math.floor(height * theme.lakeY);

  // Precompute mountain layer heights per X
  const layers = theme.layers.map((layer) => {
    const heights = new Float32Array(width);
    const detail = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      const nx = (x / width) * layer.scale + layer.offset;
      const r = layer.ridge ? ridge1D(nx, layer.seed, 6) : fbm1D(nx, layer.seed, 5);
      // Shape dramatic twin peaks
      const env = 0.65 + 0.35 * Math.sin((x / width) * Math.PI * layer.archFreq + layer.archPhase);
      heights[x] = height * (layer.baseY - r * layer.amp * env);
      detail[x] = fbm1D(nx * 6.5, layer.seed + 99, 3);
    }
    return { ...layer, heights, detail };
  });

  // Tree line along lake shore
  const treeHeights = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const mask = Math.max(0, Math.sin((x / width) * Math.PI * 2.2 + 0.4) * 0.6 + 0.4);
    const spike = Math.pow(noise1D(x * 0.35, theme.seed + 501), 1.6);
    treeHeights[x] = lakeLine - spike * height * 0.048 * mask - height * 0.006;
  }

  const sunX = width * theme.sunPos[0];
  const sunY = height * theme.sunPos[1];

  function sampleSceneAboveWater(x, y) {
    const ny = y / lakeLine;
    // Sky multi-stop gradient
    let col;
    if (ny < 0.45) {
      col = mixColor(theme.skyTop, theme.skyMid, ny / 0.45);
    } else {
      col = mixColor(theme.skyMid, theme.skyHorizon, (ny - 0.45) / 0.55);
    }

    // Subtle aurora / high clouds
    const cloudWave = fbm1D((x / width) * 5.0 + ny * 2.2, theme.seed + 11, 4);
    if (ny < 0.65) {
      const band = Math.exp(-Math.pow((ny - 0.28 + (cloudWave - 0.5) * 0.16) * 7.5, 2));
      col = mixColor(col, theme.aurora, band * theme.auroraStrength);
    }

    // Sun disc + atmospheric halo
    const dx = (x - sunX) / height;
    const dy = (y - sunY) / height;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const glow = Math.exp(-dist * 4.2) * 0.65 + Math.exp(-dist * 14.0) * 0.45;
    col = mixColor(col, theme.sunGlow, Math.min(1, glow));
    if (dist < theme.sunRadius) {
      const edge = Math.min(1, (theme.sunRadius - dist) / 0.004);
      col = mixColor(col, [255, 250, 232], edge * 0.92);
    }

    // Paint mountain ranges back-to-front
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li];
      const my = L.heights[x];
      if (y >= my) {
        const depthFromRidge = (y - my) / (lakeLine - my + 1);
        // Sunlit 2D diagonal ridge facet estimation
        const diagX = Math.max(0, Math.min(width - 1, Math.round(x + (y - my) * 0.42)));
        const xNext = Math.min(width - 1, diagX + 4);
        const slope = (L.heights[xNext] - L.heights[diagX]) / 4.0;
        const facet = noise1D(x * 0.035 + (y - my) * 0.045, L.seed + 77) - 0.5;
        const sunDir = sunX > x ? -1 : 1;
        const lit = Math.max(0, Math.min(1, 0.48 + slope * sunDir * 0.34 + facet * 0.32));

        let mCol = mixColor(L.shadowColor, L.litColor, lit);
        // Snow cap on highest peaks following organic snowline
        const snowReach = height * (0.045 + L.detail[diagX] * 0.035) * (0.5 + lit * 0.7);
        if (L.snow && y - my < snowReach && my < height * 0.49) {
          const snowMask = Math.pow(Math.max(0, 1 - (y - my) / snowReach), 1.35);
          mCol = mixColor(mCol, L.snowColor, snowMask * (0.4 + lit * 0.6));
        }
        // Valley mist near base of each range
        const mist = Math.pow(Math.max(0, depthFromRidge), 2.1) * L.mistAmount;
        col = mixColor(mCol, theme.mistColor, mist);
      }
    }

    // Foreground pine silhouettes along shore
    if (y >= treeHeights[x]) {
      col = mixColor(col, theme.shoreColor, 0.92);
    }
    return col;
  }

  // First render above-water into buffer, then render reflective lake below lakeLine
  for (let y = 0; y < lakeLine; y++) {
    for (let x = 0; x < width; x++) {
      const col = sampleSceneAboveWater(x, y);
      const idx = (y * width + x) * 4;
      buf[idx] = Math.round(col[0]);
      buf[idx + 1] = Math.round(col[1]);
      buf[idx + 2] = Math.round(col[2]);
      buf[idx + 3] = 255;
    }
  }

  for (let y = lakeLine; y < height; y++) {
    const waterT = (y - lakeLine) / (height - lakeLine);
    const rippleFreq = 0.25 + (1.0 - waterT) * 1.4;
    for (let x = 0; x < width; x++) {
      const ripple = Math.sin(y * rippleFreq + noise1D(x * 0.04 + y * 0.1, theme.seed + 77) * 6.28);
      const srcX = Math.max(0, Math.min(width - 1, Math.round(x + ripple * (2 + waterT * 10))));
      const reflY = Math.max(0, Math.min(lakeLine - 1, Math.round(lakeLine - 1 - (y - lakeLine) * 0.88 + ripple * 3)));
      const srcIdx = (reflY * width + srcX) * 4;
      let refl = [buf[srcIdx], buf[srcIdx + 1], buf[srcIdx + 2]];
      // Darken & tint water toward bottom
      refl = mixColor(refl, theme.waterDeep, 0.28 + waterT * 0.56);
      // Sun shimmer path on water
      const dx = Math.abs(x - sunX) / width;
      const shimmer = Math.exp(-dx * (18 - waterT * 10)) * Math.max(0, ripple) * (1 - waterT * 0.55);
      refl = mixColor(refl, theme.sunGlow, shimmer * 0.65);
      // Crisp shoreline highlight
      if (y - lakeLine < 2) {
        refl = mixColor(refl, theme.mistColor, 0.35);
      }
      const idx = (y * width + x) * 4;
      buf[idx] = Math.round(refl[0]);
      buf[idx + 1] = Math.round(refl[1]);
      buf[idx + 2] = Math.round(refl[2]);
      buf[idx + 3] = 255;
    }
  }

  return buf;
}

const themes = [
  {
    name: 'aurora-peaks.png',
    seed: 24,
    lakeY: 0.68,
    sunPos: [0.64, 0.44],
    sunRadius: 0.034,
    skyTop: [15, 20, 44],
    skyMid: [54, 42, 98],
    skyHorizon: [219, 134, 88],
    aurora: [126, 214, 198],
    auroraStrength: 0.28,
    sunGlow: [255, 196, 118],
    mistColor: [188, 152, 168],
    shoreColor: [14, 17, 32],
    waterDeep: [13, 21, 42],
    layers: [
      { seed: 101, scale: 3.6, offset: 0.2, baseY: 0.56, amp: 0.26, ridge: true, archFreq: 1.2, archPhase: 0.2, shadowColor: [64, 54, 106], litColor: [148, 112, 156], snow: true, snowColor: [252, 236, 224], mistAmount: 0.55 },
      { seed: 205, scale: 4.8, offset: 1.7, baseY: 0.61, amp: 0.22, ridge: true, archFreq: 1.8, archPhase: 0.9, shadowColor: [40, 38, 78], litColor: [108, 82, 134], snow: true, snowColor: [245, 220, 198], mistAmount: 0.40 },
      { seed: 309, scale: 6.2, offset: 3.1, baseY: 0.66, amp: 0.14, ridge: false, archFreq: 2.2, archPhase: 1.9, shadowColor: [24, 27, 54], litColor: [58, 56, 96], snow: false, snowColor: [255, 255, 255], mistAmount: 0.22 }
    ]
  },
  {
    name: 'emerald-canyon.png',
    seed: 48,
    lakeY: 0.70,
    sunPos: [0.34, 0.38],
    sunRadius: 0.032,
    skyTop: [12, 36, 48],
    skyMid: [28, 88, 96],
    skyHorizon: [212, 224, 178],
    aurora: [110, 235, 185],
    auroraStrength: 0.22,
    sunGlow: [248, 236, 176],
    mistColor: [164, 206, 192],
    shoreColor: [11, 28, 28],
    waterDeep: [10, 34, 38],
    layers: [
      { seed: 401, scale: 3.2, offset: 0.8, baseY: 0.55, amp: 0.24, ridge: true, archFreq: 1.3, archPhase: 0.4, shadowColor: [34, 78, 82], litColor: [102, 158, 138], snow: true, snowColor: [236, 248, 240], mistAmount: 0.58 },
      { seed: 505, scale: 4.5, offset: 2.1, baseY: 0.62, amp: 0.19, ridge: false, archFreq: 1.7, archPhase: 1.2, shadowColor: [22, 58, 62], litColor: [64, 122, 108], snow: false, snowColor: [255, 255, 255], mistAmount: 0.38 },
      { seed: 609, scale: 5.8, offset: 4.0, baseY: 0.67, amp: 0.13, ridge: false, archFreq: 2.4, archPhase: 2.1, shadowColor: [14, 40, 42], litColor: [38, 84, 76], snow: false, snowColor: [255, 255, 255], mistAmount: 0.20 }
    ]
  },
  {
    name: 'amber-coast.png',
    seed: 72,
    lakeY: 0.66,
    sunPos: [0.52, 0.48],
    sunRadius: 0.038,
    skyTop: [28, 20, 42],
    skyMid: [112, 48, 74],
    skyHorizon: [246, 162, 84],
    aurora: [244, 114, 150],
    auroraStrength: 0.20,
    sunGlow: [255, 208, 122],
    mistColor: [224, 156, 128],
    shoreColor: [24, 16, 24],
    waterDeep: [24, 22, 42],
    layers: [
      { seed: 701, scale: 3.0, offset: 1.1, baseY: 0.57, amp: 0.21, ridge: true, archFreq: 1.1, archPhase: 0.1, shadowColor: [78, 42, 66], litColor: [176, 98, 92], snow: false, snowColor: [255, 240, 220], mistAmount: 0.52 },
      { seed: 805, scale: 4.4, offset: 2.9, baseY: 0.62, amp: 0.16, ridge: true, archFreq: 1.9, archPhase: 1.5, shadowColor: [48, 28, 48], litColor: [122, 66, 74], snow: false, snowColor: [255, 240, 220], mistAmount: 0.32 }
    ]
  }
];

for (const theme of themes) {
  const rgba = renderLandscape(1600, 900, theme);
  const target = path.join(outDir, theme.name);
  writePng(target, 1600, 900, rgba);
  console.log('Generated wallpaper:', target);
}
