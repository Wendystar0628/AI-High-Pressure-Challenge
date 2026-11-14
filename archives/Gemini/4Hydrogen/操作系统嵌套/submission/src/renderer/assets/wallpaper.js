// Procedural high-resolution custom wallpapers for Nested OS (zero external images).

export const WALLPAPERS = [
  {
    id: 'alpine-horizon',
    name: '群峰晨曦 (默认)',
    previewColor: '#244b7a',
  },
  {
    id: 'cobalt-aurora',
    name: '极光曜蓝',
    previewColor: '#17385c',
  },
  {
    id: 'nebula-ridge',
    name: '星云紫岭',
    previewColor: '#372359',
  },
  {
    id: 'amber-peaks',
    name: '琥珀暮山',
    previewColor: '#664026',
  },
];

const cachedWallpapers = new Map();

function drawAlpineHorizon(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.68);
  sky.addColorStop(0, '#0d1b36');
  sky.addColorStop(0.45, '#1d3c68');
  sky.addColorStop(0.78, '#4a6e99');
  sky.addColorStop(1, '#d8a683');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Subtle glow behind far ridge
  const sun = ctx.createRadialGradient(w * 0.72, h * 0.42, 8, w * 0.72, h * 0.42, h * 0.48);
  sun.addColorStop(0, 'rgba(255, 224, 172, 0.75)');
  sun.addColorStop(0.35, 'rgba(255, 178, 130, 0.28)');
  sun.addColorStop(1, 'rgba(255, 178, 130, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  // Crisp stars in upper sky
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  for (let i = 0; i < 65; i++) {
    const sx = ((i * 397 + 131) % 1000) / 1000 * w;
    const sy = ((i * 613 + 73) % 1000) / 1000 * (h * 0.36);
    const r = (i % 3 === 0) ? 1.5 : 0.9;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Far mountain range
  const drawRange = (baseY, amp, freq, phase, color) => {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) {
      const nx = x / w;
      const y = baseY
        - Math.sin(nx * freq + phase) * amp
        - Math.sin(nx * freq * 2.1 + phase * 1.7) * (amp * 0.42)
        - Math.abs(Math.cos(nx * freq * 3.4 + phase)) * (amp * 0.22);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  drawRange(h * 0.56, h * 0.14, 5.2, 0.7, '#344c72');
  drawRange(h * 0.62, h * 0.12, 6.4, 2.3, '#223859');
  drawRange(h * 0.68, h * 0.08, 7.8, 4.1, '#142640');

  // Lake reflection band
  const lake = ctx.createLinearGradient(0, h * 0.68, 0, h);
  lake.addColorStop(0, '#3a4f70');
  lake.addColorStop(0.25, '#192b45');
  lake.addColorStop(1, '#0c1626');
  ctx.fillStyle = lake;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);

  // Soft water sun shimmer
  for (let i = 0; i < 24; i++) {
    const ry = h * 0.70 + (i / 24) * h * 0.25;
    const rw = (140 - i * 4.2) * (w / 1440);
    ctx.fillStyle = `rgba(255, 206, 158, ${0.20 - i * 0.007})`;
    ctx.fillRect(w * 0.72 - rw * 0.5 + Math.sin(i * 1.4) * 14, ry, Math.max(12, rw), 2.2);
  }
}

function drawAurora(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#091426');
  g.addColorStop(0.55, '#112c4d');
  g.addColorStop(1, '#0b1c30');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Aurora ribbons
  const ribbon = ctx.createLinearGradient(0, h * 0.12, w * 0.85, h * 0.62);
  ribbon.addColorStop(0, 'rgba(42, 232, 180, 0)');
  ribbon.addColorStop(0.35, 'rgba(56, 224, 198, 0.32)');
  ribbon.addColorStop(0.65, 'rgba(84, 168, 255, 0.34)');
  ribbon.addColorStop(1, 'rgba(136, 98, 255, 0)');
  ctx.fillStyle = ribbon;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.38);
  ctx.bezierCurveTo(w * 0.28, h * 0.10, w * 0.62, h * 0.56, w, h * 0.22);
  ctx.lineTo(w, h * 0.52);
  ctx.bezierCurveTo(w * 0.64, h * 0.72, w * 0.26, h * 0.32, 0, h * 0.58);
  ctx.closePath();
  ctx.fill();

  // Subtle architectural grid lines
  ctx.strokeStyle = 'rgba(120, 190, 255, 0.06)';
  ctx.lineWidth = 1;
  const step = Math.round(w / 24);
  for (let x = 0; x < w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

function drawNebula(ctx, w, h) {
  const g = ctx.createRadialGradient(w * 0.32, h * 0.35, 30, w * 0.5, h * 0.5, w * 0.85);
  g.addColorStop(0, '#5a3185');
  g.addColorStop(0.42, '#2d1c4d');
  g.addColorStop(1, '#110d24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.74, h * 0.65, 20, w * 0.74, h * 0.65, w * 0.45);
  glow.addColorStop(0, 'rgba(246, 196, 83, 0.22)');
  glow.addColorStop(1, 'rgba(246, 196, 83, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 85; i++) {
    const x = ((i * 521 + 19) % 1000) / 1000 * w;
    const y = ((i * 743 + 47) % 1000) / 1000 * h;
    ctx.beginPath();
    ctx.arc(x, y, (i % 4 === 0) ? 1.5 : 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAmberPeaks(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1e1c2e');
  sky.addColorStop(0.5, '#593335');
  sky.addColorStop(0.8, '#b56c42');
  sky.addColorStop(1, '#261714');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const ridge = (base, amp, freq, phase, color) => {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 14) {
      const nx = x / w;
      const y = base - Math.abs(Math.sin(nx * freq + phase)) * amp - Math.cos(nx * freq * 1.9 + phase) * (amp * 0.25);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  ridge(h * 0.66, h * 0.16, 4.5, 0.4, '#4d2b28');
  ridge(h * 0.78, h * 0.14, 5.7, 1.9, '#311a18');
  ridge(h * 0.88, h * 0.08, 7.1, 3.3, '#1b0e0d');
}

export function getWallpaperUrl(id = 'alpine-horizon') {
  if (cachedWallpapers.has(id)) return cachedWallpapers.get(id);
  const w = 1440;
  const h = 900;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (id === 'cobalt-aurora') drawAurora(ctx, w, h);
  else if (id === 'nebula-ridge') drawNebula(ctx, w, h);
  else if (id === 'amber-peaks') drawAmberPeaks(ctx, w, h);
  else drawAlpineHorizon(ctx, w, h);

  const url = canvas.toDataURL('image/png');
  cachedWallpapers.set(id, url);
  return url;
}

export function clearWallpaperCache() {
  cachedWallpapers.clear();
}
