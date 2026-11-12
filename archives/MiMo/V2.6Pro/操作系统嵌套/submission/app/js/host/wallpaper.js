/* wallpaper.js — procedurally generated wallpapers & icon art (no external images) */

const W = 1920, H = 1080;

export function makeWallpaper(kind = 'valley', accent = '#4f7cff') {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  if (kind === 'valley') drawValley(g, accent);
  else if (kind === 'aurora') drawAurora(g, accent);
  else if (kind === 'dusk') drawDusk(g, accent);
  else if (kind === 'peaks') drawPeaks(g, accent);
  else if (kind === 'minimal') drawMinimal(g, accent);
  else drawValley(g, accent);
  return c.toDataURL('image/png');
}

function lerpColor(a, b, t) {
  const pa = hex(a), pb = hex(b);
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
}
function hex(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function drawValley(g, accent) {
  // sky
  const sky = g.createLinearGradient(0, 0, 0, H * 0.72);
  sky.addColorStop(0, '#0b1d3a');
  sky.addColorStop(0.45, '#1c3f6e');
  sky.addColorStop(0.8, '#4a7fb5');
  sky.addColorStop(1, '#8fb8d8');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // sun glow
  const sun = g.createRadialGradient(W * 0.72, H * 0.30, 10, W * 0.72, H * 0.30, 340);
  sun.addColorStop(0, 'rgba(255,220,150,0.9)');
  sun.addColorStop(0.25, 'rgba(255,190,110,0.35)');
  sun.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  // clouds
  for (let i = 0; i < 7; i++) {
    const cx = (i * 311 + 80) % W, cy = 120 + (i % 3) * 70;
    g.fillStyle = `rgba(255,255,255,${0.06 + (i % 3) * 0.03})`;
    for (let j = 0; j < 5; j++) {
      g.beginPath();
      g.ellipse(cx + j * 42, cy + (j % 2) * 12, 70 + j * 12, 26 + (j % 2) * 8, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // far mountains
  mountainLayer(g, H * 0.52, 90, '#2a4a72', 0.9);
  mountainLayer(g, H * 0.60, 120, '#1f3a5e', 1);
  mountainLayer(g, H * 0.70, 100, '#16294a', 1);
  // valley floor
  const gr = g.createLinearGradient(0, H * 0.72, 0, H);
  gr.addColorStop(0, '#1a3328');
  gr.addColorStop(0.5, '#24473a');
  gr.addColorStop(1, '#142a20');
  g.fillStyle = gr; g.fillRect(0, H * 0.70, W, H * 0.30);
  // river
  g.fillStyle = 'rgba(120,180,220,0.35)';
  g.beginPath();
  g.moveTo(W * 0.30, H);
  g.bezierCurveTo(W * 0.38, H * 0.85, W * 0.46, H * 0.82, W * 0.52, H * 0.72);
  g.bezierCurveTo(W * 0.55, H * 0.68, W * 0.54, H * 0.66, W * 0.52, H * 0.64);
  g.lineTo(W * 0.50, H * 0.64);
  g.bezierCurveTo(W * 0.48, H * 0.70, W * 0.42, H * 0.82, W * 0.34, H);
  g.closePath(); g.fill();
  // trees
  for (let i = 0; i < 60; i++) {
    const x = (i * 137.7) % W, y = H * 0.72 + ((i * 53) % (H * 0.26));
    const s = 8 + (i % 5) * 4;
    g.fillStyle = `rgba(${20 + (i % 3) * 8},${50 + (i % 4) * 12},${30 + (i % 3) * 8},0.9)`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - s, y + s * 2.2); g.lineTo(x + s, y + s * 2.2); g.closePath(); g.fill();
  }
  // accent horizon light
  const gl = g.createLinearGradient(0, H * 0.55, 0, H * 0.62);
  gl.addColorStop(0, 'rgba(255,255,255,0)');
  gl.addColorStop(0.5, accent + '22');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.fillRect(0, H * 0.52, W, H * 0.14);
}

function mountainLayer(g, baseY, amp, color, alpha) {
  g.fillStyle = color;
  g.globalAlpha = alpha;
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(0, baseY);
  for (let x = 0; x <= W; x += 40) {
    const y = baseY - Math.abs(Math.sin(x * 0.0031 + amp) * amp) - Math.sin(x * 0.0007) * amp * 0.6;
    g.lineTo(x, y);
  }
  g.lineTo(W, H);
  g.closePath(); g.fill();
  g.globalAlpha = 1;
}

function drawAurora(g, accent) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#050914');
  sky.addColorStop(0.6, '#0d1b36');
  sky.addColorStop(1, '#152a48');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // stars
  for (let i = 0; i < 220; i++) {
    const x = (i * 977.3) % W, y = (i * 577.7) % (H * 0.65);
    const s = (i % 3) * 0.7 + 0.5;
    g.fillStyle = `rgba(255,255,255,${0.25 + (i % 5) * 0.12})`;
    g.fillRect(x, y, s, s);
  }
  // aurora bands
  for (let b = 0; b < 4; b++) {
    const grad = g.createLinearGradient(0, H * (0.12 + b * 0.06), 0, H * (0.5 + b * 0.08));
    const col = b % 2 === 0 ? accent : '#3ecf8e';
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.4, col + '30');
    grad.addColorStop(0.7, col + '55');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    for (let x = 0; x <= W; x += 30) {
      const y = H * (0.18 + b * 0.05) + Math.sin(x * 0.004 + b * 1.7) * 60 + Math.sin(x * 0.0013 + b) * 40;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.lineTo(W, H * (0.55 + b * 0.07));
    g.lineTo(0, H * (0.55 + b * 0.07));
    g.closePath(); g.fill();
  }
  // mountains silhouette
  mountainLayer(g, H * 0.82, 70, '#081120', 1);
  const gr = g.createLinearGradient(0, H * 0.82, 0, H);
  gr.addColorStop(0, '#0c1a2e'); gr.addColorStop(1, '#060d18');
  g.fillStyle = gr; g.fillRect(0, H * 0.84, W, H * 0.16);
}

function drawDusk(g, accent) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1a1038');
  sky.addColorStop(0.4, '#5c2d6e');
  sky.addColorStop(0.7, '#c2587a');
  sky.addColorStop(1, '#f0a06a');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const sun = g.createRadialGradient(W * 0.5, H * 0.72, 20, W * 0.5, H * 0.72, 300);
  sun.addColorStop(0, 'rgba(255,230,170,1)');
  sun.addColorStop(0.3, 'rgba(255,170,110,0.5)');
  sun.addColorStop(1, 'rgba(255,170,110,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  mountainLayer(g, H * 0.78, 80, '#2a1840', 1);
  mountainLayer(g, H * 0.86, 60, '#1a0f2c', 1);
  const gr = g.createLinearGradient(0, H * 0.88, 0, H);
  gr.addColorStop(0, '#241438'); gr.addColorStop(1, '#12081e');
  g.fillStyle = gr; g.fillRect(0, H * 0.88, W, H * 0.12);
  // accent streak
  g.fillStyle = accent + '28';
  g.fillRect(0, H * 0.66, W, 4);
}

function drawPeaks(g, accent) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a1628');
  sky.addColorStop(0.5, '#28527e');
  sky.addColorStop(1, '#6fa3c9');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // snow caps
  for (let layer = 0; layer < 3; layer++) {
    const baseY = H * (0.42 + layer * 0.14);
    const col = ['#dfeaf5', '#9db8cf', '#4a6b8c'][layer];
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 24) {
      const n = Math.sin(x * 0.0025 + layer * 2.2) * 0.5 + 0.5;
      const peak = Math.pow(n, 1.6) * (140 - layer * 30);
      g.lineTo(x, baseY - peak);
    }
    g.lineTo(W, H); g.closePath(); g.fill();
    if (layer === 0) {
      // snow highlights
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (let x = 0; x <= W; x += 24) {
        const n = Math.sin(x * 0.0025) * 0.5 + 0.5;
        const peak = Math.pow(n, 1.6) * 140;
        if (peak > 60) {
          g.beginPath();
          g.moveTo(x - 12, baseY - peak + 18);
          g.lineTo(x, baseY - peak);
          g.lineTo(x + 12, baseY - peak + 18);
          g.closePath(); g.fill();
        }
      }
    }
  }
  const gl = g.createLinearGradient(0, 0, W, 0);
  gl.addColorStop(0, 'rgba(255,255,255,0)');
  gl.addColorStop(0.5, accent + '18');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.fillRect(0, 0, W, H);
}

function drawMinimal(g, accent) {
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0d1220');
  bg.addColorStop(1, '#1a2438');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // soft blobs
  for (let i = 0; i < 6; i++) {
    const x = ((i * 461) % W), y = ((i * 277) % H);
    const r = 180 + (i % 3) * 90;
    const rad = g.createRadialGradient(x, y, 10, x, y, r);
    rad.addColorStop(0, accent + '1c');
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // grid lines
  g.strokeStyle = 'rgba(255,255,255,0.035)';
  g.lineWidth = 1;
  for (let x = 0; x < W; x += 60) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 60) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
}

/* ---------- icons ---------- */
const ICON_DEFS = {
  files:      { bg: '#f5b83d', emoji: '📁' },
  spreadsheet:{ bg: '#3ecf8e', emoji: '▦' },
  widgets:    { bg: '#7c6df2', emoji: '◫' },
  editor:     { bg: '#4f7cff', emoji: '✎' },
  browser:    { bg: '#39b8e8', emoji: '🌐' },
  tasks:      { bg: '#ff7a59', emoji: '▤' },
  settings:   { bg: '#8d99ae', emoji: '⚙' },
  player:     { bg: '#b266ff', emoji: '▶' },
  charts:     { bg: '#ff6b9d', emoji: '◔' },
  system:     { bg: '#6c8cff', emoji: '▣' },
  folder:     { bg: '#e8b64c', emoji: '📁' },
  text:       { bg: '#6b7791', emoji: '📄' },
  scene:      { bg: '#b266ff', emoji: '◈' },
  sheet:      { bg: '#3ecf8e', emoji: '▦' },
  program:    { bg: '#4f7cff', emoji: '⌘' },
  kernel:     { bg: '#ff8c42', emoji: '✷' },
  record:     { bg: '#ff6b6b', emoji: '◉' },
  trash:      { bg: '#666a75', emoji: '🗑' },
  chart:      { bg: '#ff6b9d', emoji: '◔' },
  unknown:    { bg: '#5b6478', emoji: '▢' }
};

export function iconDataURL(kind, size = 64) {
  const def = ICON_DEFS[kind] || ICON_DEFS.unknown;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const r = size * 0.22;
  g.fillStyle = def.bg;
  roundRect(g, 0, 0, size, size, r);
  g.fill();
  // subtle gradient overlay
  const gr = g.createLinearGradient(0, 0, 0, size);
  gr.addColorStop(0, 'rgba(255,255,255,0.22)');
  gr.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = gr;
  roundRect(g, 0, 0, size, size, r);
  g.fill();
  g.font = `${Math.floor(size * 0.5)}px "Segoe UI Emoji", "Segoe UI Symbol", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.shadowColor = 'rgba(0,0,0,0.3)';
  g.shadowBlur = size * 0.05;
  g.fillText(def.emoji, size / 2, size / 2 + size * 0.02);
  return c.toDataURL('image/png');
}

export function iconKindForFile(name, type) {
  if (type === 'dir') return name === 'RecycleBin' ? 'trash' : 'folder';
  const n = name.toLowerCase();
  if (n.endsWith('.sheet')) return 'sheet';
  if (n.endsWith('.scene')) return 'scene';
  if (n.endsWith('.ks')) return n.includes('kernel') ? 'kernel' : 'program';
  if (n.endsWith('.txt') || n.endsWith('.md')) return 'text';
  if (n.endsWith('.rec')) return 'record';
  if (n.endsWith('.chart')) return 'chart';
  return 'unknown';
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* icon image cache */
const iconCache = {};
export function getIcon(kind, size = 44) {
  const key = kind + '@' + size;
  if (!iconCache[key]) iconCache[key] = iconDataURL(kind, size * 2);
  return iconCache[key];
}
