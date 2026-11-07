// 生成原创风景壁纸 (PNG, 无外部依赖)
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function writePNG(file, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  console.log('wrote', file, w + 'x' + h, (png.length / 1024 | 0) + 'KB');
}

// ---- 简单噪声 ----
function hash2(x, y) {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2; a *= 0.5; }
  return s;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function mixc(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }

// ---- 壁纸 1: 黄昏湖山 (默认) ----
function genDuskLake(file, W, H) {
  const rgba = Buffer.alloc(W * H * 4);
  const sunX = 0.72, sunY = 0.30;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      let col;
      const horizon = 0.545;
      // 太阳方向
      const dx = u - sunX, dy = (v - sunY) * (H / W);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (v < horizon) {
        // 天空: 顶部深蓝紫 -> 地平线暖橙
        const t = Math.pow(v / horizon, 0.85);
        let sky = mixc([26, 22, 66], [255, 150, 92], t);
        sky = mixc(sky, [255, 205, 140], Math.max(0, 1 - dist * 3.2) * 0.9);
        // 太阳光晕
        const glow = Math.exp(-dist * 7.5);
        sky = mixc(sky, [255, 236, 190], Math.min(1, glow * 1.25));
        if (dist < 0.035) sky = [255, 248, 224];
        // 云
        const cl = fbm(u * 5.5, v * 13 + 2, 4);
        const band = Math.max(0, 1 - Math.abs(v - 0.30) * 7) * Math.max(0, cl - 0.44) * 2.4;
        if (band > 0.01) {
          const cloudCol = mixc([255, 190, 160], [255, 235, 205], Math.max(0, 1 - dist * 2.2));
          sky = mixc(sky, cloudCol, Math.min(0.85, band));
        }
        const cl2 = fbm(u * 8 + 10, v * 18 + 5, 3);
        const band2 = Math.max(0, 1 - Math.abs(v - 0.18) * 9) * Math.max(0, cl2 - 0.5) * 1.8;
        if (band2 > 0.01) sky = mixc(sky, [120, 100, 165], Math.min(0.7, band2));
        col = sky;
      } else {
        // 山体与湖面
        const ridge = horizon + 0.012 * (0.5 - fbm(u * 6.5 + 3, 0.5, 3)) * 2;
        const m1 = horizon + 0.085 * (1 - Math.abs(fbm(u * 3.1 + 1.7, 2.2, 4) - 0.5) * 2.1);
        const m2 = horizon + 0.055 * (1 - Math.abs(fbm(u * 5.2 + 8.1, 4.4, 4) - 0.5) * 2.2);
        if (v < ridge) {
          const t = (v - horizon) / 0.028;
          col = mixc([255, 150, 92], [88, 62, 110], 1 - t * 0.25);
          col = mixc(col, [70, 48, 96], Math.min(1, Math.abs(v - horizon) * 30));
        } else if (v < m1) {
          const s = Math.min(1, (m1 - v) / 0.11);
          col = mixc([120, 82, 132], [56, 40, 82], s);
          const tex = fbm(u * 40, v * 40, 3) * 0.16 - 0.08;
          col = mixc(col, [255, 160, 120], Math.max(0, 1 - dist * 3) * 0.22 * (1 - s * 0.4));
          col = [col[0] + tex * 60, col[1] + tex * 50, col[2] + tex * 40];
        } else if (v < m2) {
          const s = Math.min(1, (m2 - v) / 0.075);
          col = mixc([96, 66, 118], [40, 30, 66], s);
          col = mixc(col, [255, 150, 110], Math.max(0, 1 - dist * 2.6) * 0.3 * (1 - s * 0.5));
          const tex = fbm(u * 55 + 3, v * 55, 3) * 0.18 - 0.09;
          col = [col[0] + tex * 70, col[1] + tex * 55, col[2] + tex * 45];
        } else {
          // 湖面
          const lv = (v - horizon - 0.028) / (1 - horizon - 0.028);
          const reflV = horizon - (v - horizon) * 0.82;
          const ru = u + (fbm(u * 22, v * 60, 3) - 0.5) * 0.016 * (0.35 + lv);
          // 天空反射
          const t = Math.pow(Math.max(0, reflV) / horizon, 0.85);
          let refl = mixc([30, 26, 72], [255, 150, 92], t);
          const rdx = ru - sunX, rdy = (reflV - sunY) * (H / W);
          const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
          refl = mixc(refl, [255, 236, 190], Math.exp(-rdist * 6.2) * 1.1);
          // 山影
          const m2 = horizon + 0.055 * (1 - Math.abs(fbm(ru * 5.2 + 8.1, 4.4, 4) - 0.5) * 2.2);
          if (reflV < m2 && reflV > horizon) {
            refl = mixc(refl, [52, 38, 84], 0.55);
          }
          // 波纹
          const ripple = fbm(u * 26, v * 120, 3);
          const sparkle = Math.max(0, ripple - 0.62) * 3.2 * Math.exp(-rdist * 3.4);
          refl = mixc(refl, [255, 230, 190], Math.min(1, sparkle));
          const fade = 0.86 + 0.14 * Math.exp(-lv * 1.1);
          col = [refl[0] * fade, refl[1] * fade, refl[2] * fade];
          col = mixc(col, [22, 20, 48], lv * 0.42);
        }
      }
      // 暗角
      const vx = (u - 0.5), vy = (v - 0.5);
      const vig = 1 - (vx * vx + vy * vy) * 0.55;
      col = [col[0] * vig, col[1] * vig, col[2] * vig];
      const i = (y * W + x) * 4;
      rgba[i] = Math.max(0, Math.min(255, col[0] | 0));
      rgba[i + 1] = Math.max(0, Math.min(255, col[1] | 0));
      rgba[i + 2] = Math.max(0, Math.min(255, col[2] | 0));
      rgba[i + 3] = 255;
    }
  }
  writePNG(file, W, H, rgba);
}

// ---- 壁纸 2: 翠绿山谷 ----
function genGreenValley(file, W, H) {
  const rgba = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      let col;
      const horizon = 0.46;
      if (v < horizon) {
        const t = Math.pow(v / horizon, 0.9);
        col = mixc([120, 190, 255], [210, 240, 255], t);
        const cl = fbm(u * 4 + 2, v * 11, 4);
        const band = Math.max(0, 1 - Math.abs(v - 0.22) * 8) * Math.max(0, cl - 0.46) * 2.6;
        if (band > 0.01) col = mixc(col, [255, 255, 255], Math.min(0.92, band));
        const sun = Math.exp(-Math.sqrt((u - 0.3) ** 2 + ((v - 0.16) * H / W) ** 2) * 6);
        col = mixc(col, [255, 250, 220], sun * 0.85);
      } else if (v < horizon + 0.14) {
        const h = horizon + 0.12 * (1 - Math.abs(fbm(u * 3.6 + 5, 1.3, 4) - 0.5) * 2.3);
        if (v < h) {
          const s = (h - v) / 0.14;
          col = mixc([86, 150, 96], [46, 96, 70], s);
          const tex = fbm(u * 30, v * 30, 3) * 0.2 - 0.1;
          col = [col[0] + tex * 50, col[1] + tex * 60, col[2] + tex * 40];
        } else col = null;
        if (!col) {
          const s = Math.min(1, (v - horizon - 0.02) / 0.35);
          col = mixc([110, 175, 88], [52, 120, 62], s);
          const tex = fbm(u * 18, v * 22, 4) * 0.3 - 0.15;
          col = [col[0] + tex * 80, col[1] + tex * 90, col[2] + tex * 50];
          // 草地高光
          const gl = Math.max(0, fbm(u * 60, v * 80, 2) - 0.55) * 2;
          col = mixc(col, [180, 220, 130], gl * 0.5);
        }
      } else {
        const s = (v - horizon - 0.14) / (1 - horizon - 0.14);
        col = mixc([64, 132, 70], [34, 84, 48], s);
        const tex = fbm(u * 14, v * 18, 4) * 0.32 - 0.16;
        col = [col[0] + tex * 90, col[1] + tex * 100, col[2] + tex * 60];
      }
      const vx = (u - 0.5), vy = (v - 0.5);
      const vig = 1 - (vx * vx + vy * vy) * 0.45;
      col = [col[0] * vig, col[1] * vig, col[2] * vig];
      const i = (y * W + x) * 4;
      rgba[i] = Math.max(0, Math.min(255, col[0] | 0));
      rgba[i + 1] = Math.max(0, Math.min(255, col[1] | 0));
      rgba[i + 2] = Math.max(0, Math.min(255, col[2] | 0));
      rgba[i + 3] = 255;
    }
  }
  writePNG(file, W, H, rgba);
}

// ---- 壁纸 3: 星夜极光 ----
function genStarNight(file, W, H) {
  const rgba = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const horizon = 0.62;
      let col;
      if (v < horizon) {
        const t = v / horizon;
        col = mixc([8, 10, 32], [24, 28, 66], t);
        // 极光
        const a1 = Math.sin(u * 6 + fbm(u * 3, v * 2, 3) * 5) * 0.5 + 0.5;
        const aBand = Math.max(0, 1 - Math.abs(v - 0.26 - a1 * 0.14) * 9);
        const a2 = Math.sin(u * 9 + 2 + fbm(u * 4, v * 3, 3) * 6) * 0.5 + 0.5;
        const aBand2 = Math.max(0, 1 - Math.abs(v - 0.36 - a2 * 0.1) * 11);
        col = mixc(col, [40, 220, 160], aBand * 0.5);
        col = mixc(col, [90, 120, 255], aBand2 * 0.38);
        // 星
        const n = hash2(Math.floor(u * W / 3), Math.floor(v * H / 3));
        if (n > 0.997) {
          const tw = 0.6 + 0.4 * Math.sin(n * 100);
          col = mixc(col, [255, 255, 240], tw * (0.5 + 0.5 * (1 - t)));
        }
      } else {
        const s = (v - horizon) / (1 - horizon);
        col = mixc([18, 22, 52], [6, 8, 22], s);
        // 山影
        const h = horizon + 0.07 * (1 - Math.abs(fbm(u * 4 + 2, 7, 3) - 0.5) * 2.4);
        if (v < h) col = mixc(col, [4, 5, 16], 0.75);
        // 湖面反光
        if (v > horizon + 0.12) {
          const ru = u + (fbm(u * 20, v * 40, 2) - 0.5) * 0.02;
          const a1 = Math.sin(ru * 6 + fbm(ru * 3, horizon * 2, 3) * 5) * 0.5 + 0.5;
          const aBand = Math.max(0, 1 - Math.abs(horizon * 0.42 - a1 * 0.14 - 0.1) * 8);
          col = mixc(col, [30, 160, 130], aBand * 0.22 * (1 - s * 0.6));
        }
      }
      const i = (y * W + x) * 4;
      rgba[i] = Math.max(0, Math.min(255, col[0] | 0));
      rgba[i + 1] = Math.max(0, Math.min(255, col[1] | 0));
      rgba[i + 2] = Math.max(0, Math.min(255, col[2] | 0));
      rgba[i + 3] = 255;
    }
  }
  writePNG(file, W, H, rgba);
}

const out = process.argv[2] || path.join(__dirname, '..', 'assets');
genDuskLake(path.join(out, 'wallpaper.png'), 1920, 1080);
genDuskLake(path.join(out, 'wallpapers', 'dusk-lake.png'), 1280, 720);
genGreenValley(path.join(out, 'wallpapers', 'green-valley.png'), 1280, 720);
genStarNight(path.join(out, 'wallpapers', 'star-night.png'), 1280, 720);
console.log('wallpapers done');
