/* ========================================================================
   textures.js — 全部贴图由 Canvas 程序化绘制（本地文件方式可直接用作纹理）
   ======================================================================== */
(function () {
'use strict';
const T = window.THREE;
const SR = window.SR;
const tx = SR.tex = {};

const FONT = '"Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif';
const SERIF = '"SimSun","Songti SC",serif';

function txt(g, s, x, y, size, color, align, font, weight) {
  g.save();
  g.fillStyle = color || '#333';
  g.textAlign = align || 'center';
  g.textBaseline = 'middle';
  g.font = (weight ? weight + ' ' : '') + size + 'px ' + (font || FONT);
  g.fillText(s, x, y);
  g.restore();
}
tx.txt = txt;
tx.FONT = FONT;

tx.make = function (w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
};
tx.tiled = function (tex, rx, ry) {
  const t = tex.clone();
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
};

/* 细颗粒噪点 */
function grain(g, w, h, amount, light, dark) {
  for (let i = 0; i < amount; i++) {
    const x = SR.rand() * w, y = SR.rand() * h, r = SR.rnd(0.4, 1.8);
    g.fillStyle = SR.rand() > 0.5 ? light : dark;
    g.globalAlpha = SR.rnd(0.10, 0.42);
    g.beginPath(); g.arc(x, y, r, 0, SR.TAU); g.fill();
  }
  g.globalAlpha = 1;
}
tx.grain = grain;

/* 水渍 / 斑驳圆斑 */
function stains(g, w, h, n, colors, rmin, rmax, alpha) {
  for (let i = 0; i < n; i++) {
    const x = SR.rand() * w, y = SR.rand() * h;
    const r = SR.rnd(rmin, rmax);
    g.save();
    g.globalAlpha = SR.rnd(alpha * 0.35, alpha);
    g.fillStyle = SR.pick(colors);
    g.beginPath();
    g.ellipse(x, y, r, r * SR.rnd(0.5, 1.4), SR.rand() * SR.PI, 0, SR.TAU);
    g.fill();
    g.restore();
  }
}
tx.stains = stains;

/* ---------- 柔边 alpha 贴图 ---------- */
tx.cloud = () => tx.make(512, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const x = SR.rnd(20, w - 20), y = SR.rnd(h * 0.25, h * 0.75);
    const r = SR.rnd(22, 78);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.42)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(x, y, r * 1.5, r * 0.65, 0, 0, SR.TAU); g.fill();
  }
});

tx.halo = () => tx.make(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,246,214,0.95)');
  grd.addColorStop(0.18, 'rgba(255,242,205,0.55)');
  grd.addColorStop(0.5, 'rgba(255,240,205,0.12)');
  grd.addColorStop(1, 'rgba(255,240,205,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

tx.blob = () => tx.make(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const grd = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
  grd.addColorStop(0, 'rgba(30,70,74,0.85)');
  grd.addColorStop(0.55, 'rgba(30,70,74,0.42)');
  grd.addColorStop(1, 'rgba(30,70,74,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

tx.foam = () => tx.make(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 150; i++) {
    const x = SR.rand() * w, y = SR.rand() * h, r = SR.rnd(2, 15);
    g.fillStyle = 'rgba(255,255,255,' + SR.rnd(0.35, 0.95).toFixed(2) + ')';
    g.beginPath(); g.ellipse(x, y, r, r * SR.rnd(0.4, 0.9), SR.rand() * SR.PI, 0, SR.TAU); g.fill();
  }
  for (let i = 0; i < 42; i++) {
    const x = SR.rand() * w, y = SR.rand() * h, r = SR.rnd(6, 22);
    g.strokeStyle = 'rgba(255,255,255,' + SR.rnd(0.3, 0.75).toFixed(2) + ')';
    g.lineWidth = SR.rnd(1.5, 3.5);
    g.beginPath(); g.arc(x, y, r, SR.rand() * SR.PI, SR.rand() * SR.PI + SR.PI); g.stroke();
  }
});

tx.ripple = () => tx.make(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  for (let k = 0; k < 3; k++) {
    g.lineWidth = 2.2 - k * 0.5;
    g.globalAlpha = 0.75 - k * 0.2;
    g.beginPath(); g.ellipse(w / 2, h / 2, 34 + k * 26, 26 + k * 21, 0, 0, SR.TAU); g.stroke();
  }
  g.globalAlpha = 1;
});

tx.caustic = () => tx.make(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,252,220,0.85)';
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = SR.rand() * w, y = SR.rand() * h, len = SR.rnd(8, 34);
    g.lineWidth = SR.rnd(1.2, 3.4);
    g.globalAlpha = SR.rnd(0.25, 0.9);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len * 0.5, y - SR.rnd(-8, 8), x + len, y + SR.rnd(-5, 5));
    g.stroke();
  }
  g.globalAlpha = 1;
});

/* ---------- 混凝土顶面（被雨打湿） ---------- */
tx.concrete = () => tx.make(512, 512, (g, w, h) => {
  g.fillStyle = '#d7e0dc'; g.fillRect(0, 0, w, h);
  stains(g, w, h, 42, ['#c6d4cf', '#e6eee9', '#b9ccc8', '#cddad5'], 12, 62, 0.30);
  /* 分格缝 */
  g.strokeStyle = 'rgba(120,146,142,0.42)'; g.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke();
    g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke();
  }
  /* 缝旁高光 */
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    g.beginPath(); g.moveTo(i * w / 4 + 2, 0); g.lineTo(i * w / 4 + 2, h); g.stroke();
    g.beginPath(); g.moveTo(0, i * h / 4 + 2); g.lineTo(w, i * h / 4 + 2); g.stroke();
  }
  /* 湿痕 / 水渍流 */
  for (let i = 0; i < 26; i++) {
    const x = SR.rand() * w, y = SR.rand() * h;
    g.fillStyle = 'rgba(150,180,176,0.10)';
    g.beginPath(); g.ellipse(x, y, SR.rnd(6, 32), SR.rnd(4, 16), SR.rand() * SR.PI, 0, SR.TAU); g.fill();
  }
  grain(g, w, h, 5200, 'rgba(255,255,255,0.5)', 'rgba(90,120,116,0.5)');
  /* 柔和反光斑 */
  for (let i = 0; i < 16; i++) {
    const x = SR.rand() * w, y = SR.rand() * h;
    const grd = g.createRadialGradient(x, y, 0, x, y, SR.rnd(20, 60));
    grd.addColorStop(0, 'rgba(255,255,255,0.24)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(x - 60, y - 60, 120, 120);
  }
});

/* ---------- 岸壁剖面：分层砌块 + 潮位线 ---------- */
tx.wall = () => tx.make(512, 512, (g, w, h) => {
  g.fillStyle = '#aebfbc'; g.fillRect(0, 0, w, h);
  stains(g, w, h, 36, ['#9db2ae', '#bdcdc9', '#97aca8'], 10, 46, 0.42);
  /* 砌块横线 */
  const rows = 6, rh = h / rows;
  g.strokeStyle = 'rgba(74,102,100,0.52)'; g.lineWidth = 3;
  for (let r = 1; r < rows; r++) { g.beginPath(); g.moveTo(0, r * rh); g.lineTo(w, r * rh); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,0.30)'; g.lineWidth = 1.4;
  for (let r = 1; r < rows; r++) { g.beginPath(); g.moveTo(0, r * rh + 3); g.lineTo(w, r * rh + 3); g.stroke(); }
  /* 错缝竖线 */
  g.strokeStyle = 'rgba(74,102,100,0.38)'; g.lineWidth = 2.2;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 0.5;
    for (let k = 0; k < 4; k++) {
      const x = (k + off) * w / 4;
      g.beginPath(); g.moveTo(x, r * rh); g.lineTo(x, (r + 1) * rh); g.stroke();
    }
  }
  /* 潮位带（下部） */
  const grd = g.createLinearGradient(0, h * 0.55, 0, h);
  grd.addColorStop(0, 'rgba(74,124,120,0)');
  grd.addColorStop(0.42, 'rgba(72,120,116,0.32)');
  grd.addColorStop(0.78, 'rgba(52,98,98,0.58)');
  grd.addColorStop(1, 'rgba(44,86,88,0.72)');
  g.fillStyle = grd; g.fillRect(0, h * 0.55, w, h * 0.45);
  /* 数条深浅潮线 */
  for (let i = 0; i < 5; i++) {
    const y = h * (0.62 + i * 0.075);
    g.strokeStyle = 'rgba(46,88,88,' + (0.14 + i * 0.07).toFixed(2) + ')';
    g.lineWidth = SR.rnd(2, 5);
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += 24) g.lineTo(x, y + Math.sin(x * 0.04 + i) * 3 + SR.rnd(-1.5, 1.5));
    g.stroke();
  }
  /* 上部绿藻痕 */
  g.fillStyle = 'rgba(110,150,120,0.20)';
  for (let i = 0; i < 40; i++) {
    const x = SR.rand() * w, y = h * SR.rnd(0.72, 1.0);
    g.beginPath(); g.ellipse(x, y, SR.rnd(2, 9), SR.rnd(1, 4), 0, 0, SR.TAU); g.fill();
  }
  /* 藤壶与牡蛎壳小白点 */
  for (let i = 0; i < 130; i++) {
    const x = SR.rand() * w, y = h * SR.rnd(0.66, 1.0);
    const r = SR.rnd(1.2, 4.2);
    g.fillStyle = SR.rand() > 0.45 ? 'rgba(232,232,214,0.85)' : 'rgba(200,206,190,0.75)';
    g.beginPath(); g.arc(x, y, r, 0, SR.TAU); g.fill();
    g.strokeStyle = 'rgba(90,110,105,0.5)'; g.lineWidth = 0.8; g.stroke();
  }
  /* 锈迹垂流 */
  for (let i = 0; i < 16; i++) {
    const x = SR.rand() * w, y = h * SR.rnd(0.2, 0.7), len = SR.rnd(20, 90);
    g.strokeStyle = 'rgba(160,96,54,' + SR.rnd(0.10, 0.28).toFixed(2) + ')';
    g.lineWidth = SR.rnd(2, 8);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + SR.rnd(-4, 4), y + len); g.stroke();
  }
  grain(g, w, h, 3600, 'rgba(255,255,255,0.35)', 'rgba(50,80,78,0.35)');
});

/* ---------- 黄黑警示斜纹（带磨损） ---------- */
tx.hazard = () => tx.make(512, 128, (g, w, h) => {
  g.fillStyle = '#f0c33f'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2e3c3d';
  const step = 74;
  for (let x = -h; x < w + h; x += step) {
    g.beginPath();
    g.moveTo(x, 0); g.lineTo(x + 36, 0); g.lineTo(x + 36 + h, h); g.lineTo(x + h, h);
    g.closePath(); g.fill();
  }
  /* 磨损：刮痕、褪色斑 */
  for (let i = 0; i < 150; i++) {
    g.fillStyle = SR.rand() > 0.5 ? 'rgba(213,222,215,0.45)' : 'rgba(120,130,120,0.35)';
    g.fillRect(SR.rand() * w, SR.rand() * h, SR.rnd(2, 22), SR.rnd(1, 4));
  }
  stains(g, w, h, 20, ['#d8d4bf', '#b9bdb2'], 3, 16, 0.35);
  grain(g, w, h, 1600, 'rgba(255,255,255,0.4)', 'rgba(60,70,68,0.35)');
});

/* ---------- 木材 ---------- */
tx.wood = (base) => tx.make(512, 256, (g, w, h) => {
  g.fillStyle = base || '#c39a6b'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const y = SR.rnd(0, h);
    g.strokeStyle = SR.rand() > 0.5 ? 'rgba(120,84,50,0.22)' : 'rgba(240,214,172,0.22)';
    g.lineWidth = SR.rnd(0.6, 2.6);
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2.5);
    g.stroke();
  }
  /* 板缝 */
  g.strokeStyle = 'rgba(90,62,38,0.55)'; g.lineWidth = 3;
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(0, k * h / 4); g.lineTo(w, k * h / 4); g.stroke(); }
  g.strokeStyle = 'rgba(255,235,200,0.35)'; g.lineWidth = 1.2;
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(0, k * h / 4 + 3); g.lineTo(w, k * h / 4 + 3); g.stroke(); }
  /* 钉子 */
  g.fillStyle = 'rgba(70,70,66,0.5)';
  for (let k = 0; k < 4; k++) for (let j = 0; j < 5; j++) {
    g.beginPath(); g.arc(28 + j * 116, k * h / 4 + 14, 2.2, 0, SR.TAU); g.fill();
  }
  grain(g, w, h, 2400, 'rgba(255,240,210,0.3)', 'rgba(90,60,35,0.3)');
});

/* ---------- 锈斑 / 旧漆 ---------- */
tx.rust = (base) => tx.make(256, 256, (g, w, h) => {
  g.fillStyle = base || '#d9ded6'; g.fillRect(0, 0, w, h);
  stains(g, w, h, 55, ['#a5653d', '#c08a55', '#8d5a38', '#d0a878'], 3, 22, 0.55);
  for (let i = 0; i < 30; i++) {
    const x = SR.rand() * w, y = SR.rand() * h;
    g.strokeStyle = 'rgba(150,86,48,0.30)'; g.lineWidth = SR.rnd(1, 5);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + SR.rnd(-3, 3), y + SR.rnd(8, 44)); g.stroke();
  }
  grain(g, w, h, 2200, 'rgba(255,255,255,0.4)', 'rgba(90,60,40,0.4)');
});

/* ---------- 消波块 / 粗混凝土 ---------- */
tx.tetrapod = () => tx.make(256, 256, (g, w, h) => {
  g.fillStyle = '#c8d2ce'; g.fillRect(0, 0, w, h);
  stains(g, w, h, 30, ['#b3c2bd', '#dae3de', '#a9bbb6'], 6, 30, 0.45);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = 'rgba(90,120,115,0.10)';
    g.beginPath(); g.arc(SR.rand() * w, SR.rand() * h, SR.rnd(1, 5), 0, SR.TAU); g.fill();
  }
  grain(g, w, h, 4200, 'rgba(255,255,255,0.5)', 'rgba(70,100,96,0.5)');
});

/* ---------- 水下碎石海床 ---------- */
tx.seabed = () => tx.make(512, 512, (g, w, h) => {
  g.fillStyle = '#9db5a6'; g.fillRect(0, 0, w, h);
  stains(g, w, h, 60, ['#8fae9c', '#b3c8b3', '#86a394'], 8, 40, 0.5);
  for (let i = 0; i < 900; i++) {
    const x = SR.rand() * w, y = SR.rand() * h, r = SR.rnd(1.5, 8);
    g.fillStyle = SR.pick(['#b9c9bb', '#7f9c8c', '#c9d6c6', '#8aa89a', '#a8bbaa']);
    g.globalAlpha = SR.rnd(0.4, 0.95);
    g.beginPath(); g.ellipse(x, y, r, r * SR.rnd(0.5, 0.9), SR.rand() * SR.PI, 0, SR.TAU); g.fill();
  }
  g.globalAlpha = 1;
  /* 沙纹 */
  g.strokeStyle = 'rgba(230,240,220,0.18)'; g.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    const y = SR.rand() * h;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 5);
    g.stroke();
  }
  grain(g, w, h, 3000, 'rgba(255,255,255,0.35)', 'rgba(50,80,70,0.35)');
});

/* ---------- 水面色块化倒影底图 ---------- */
tx.reflection = (items) => tx.make(1024, 1024, (g, w, h) => {
  const X = x => (x + 10) / 20 * w;
  /* CanvasTexture 默认 flipY=true：采样 v=(z+10)/20 对应画布 y=(10-z)/20*h。
     翻转映射才能让船只倒影落在船体的正下方。 */
  const Z = z => (10 - z) / 20 * h;
  g.fillStyle = '#7dc3ba'; g.fillRect(0, 0, w, h);
  /* 大块青绿 / 深蓝色块 */
  for (let i = 0; i < 150; i++) {
    const x = SR.rand() * w, y = SR.rand() * h;
    const bw = SR.rnd(30, 130), bh = SR.rnd(10, 42);
    g.globalAlpha = SR.rnd(0.14, 0.46);
    g.fillStyle = SR.pick(['#4f9a9b', '#96ded0', '#3d7f86', '#c3ece0', '#6bbcba', '#e6f5ea']);
    g.fillRect(x, y, bw, bh);
  }
  g.globalAlpha = 1;
  /* 水平反光条纹 */
  for (let i = 0; i < 55; i++) {
    const y = SR.rand() * h;
    g.fillStyle = 'rgba(255,255,255,' + SR.rnd(0.04, 0.14).toFixed(2) + ')';
    g.fillRect(SR.rand() * w, y, SR.rnd(40, 240), SR.rnd(2, 5));
  }
  /* 船只与景物的概括倒影 */
  (items || []).forEach(it => {
    const cx = X(it.x), cy = Z(it.z);
    const col = it.color || '#f2f6f0';
    for (let k = 0; k < 22; k++) {
      const ox = SR.rnd(-it.w * 0.45, it.w * 0.45) / 20 * w;
      const oy = SR.rnd(-it.h * 0.4, it.h * 1.5) / 20 * h;
      g.globalAlpha = SR.rnd(0.50, 0.95);
      g.fillStyle = k % 5 === 0 ? (it.shade || '#39777c') : col;
      g.fillRect(cx + ox - SR.rnd(4, 18), cy + oy, SR.rnd(22, 80), SR.rnd(4, 13));
    }
    /* 深色船底块 */
    g.globalAlpha = 0.72;
    g.fillStyle = it.shade || '#39777c';
    g.fillRect(cx - it.w / 20 * w * 0.34, cy + 4, it.w / 20 * w * 0.68, SR.rnd(8, 18));
    g.globalAlpha = 1;
  });
});

/* ---------- 通用告示牌 / 文字牌 ---------- */
tx.board = (opts) => {
  const o = opts || {};
  const w = o.w || 512, h = o.h || 256;
  return tx.make(w, h, (g, W, H) => {
    g.fillStyle = o.bg || '#e5e0cd'; g.fillRect(0, 0, W, H);
    /* 褪色与污渍 */
    stains(g, W, H, 30, ['#cfc9b2', '#f0ecd9', '#bdb9a4'], 6, 40, 0.38);
    g.strokeStyle = 'rgba(90,100,92,0.55)'; g.lineWidth = 7;
    g.strokeRect(9, 9, W - 18, H - 18);
    /* 边缘掉漆 */
    for (let i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(120,125,110,0.30)';
      g.fillRect(SR.rand() * W, SR.rand() * H, SR.rnd(2, 14), SR.rnd(1, 5));
    }
    const lines = o.lines || [];
    const fs = o.fontSize || Math.floor(H / (lines.length + 1.7));
    lines.forEach((ln, i) => {
      const y = H * (i + 1) / (lines.length + 1);
      txt(g, ln, W / 2, y, fs, o.color || '#3a4b48', 'center', o.font || FONT, o.weight || 'bold');
    });
    grain(g, W, H, 2600, 'rgba(255,255,255,0.35)', 'rgba(70,80,70,0.3)');
  });
};

tx.signHarbor = () => tx.board({
  bg: '#e7e2cd', lines: ['みなと　第三漁港', '注意落水　／　足元に注意'],
  fontSize: 52, color: '#40544f', w: 640, h: 280,
});

tx.blackboard = () => tx.board({
  bg: '#33433f', color: '#e8eadd', w: 512, h: 384,
  lines: ['本日　競り値', '鯵  ¥ 480   鯖  ¥ 360', '烏賊 ¥ 620   鯛  ¥ 980', '〆  15:30'],
  fontSize: 34, weight: 'normal',
});

tx.timetable = () => tx.board({
  bg: '#eee9d7', color: '#4b5a55', w: 384, h: 512,
  lines: ['连络船 时刻表', '07:30  大崎行', '09:10  沖磯行', '11:40  大崎行', '14:20  沖磯行', '16:50  最終便', '※ 欠航あり'],
  fontSize: 29, weight: 'normal',
});

tx.chart = () => tx.make(512, 384, (g, w, h) => {
  g.fillStyle = '#f2ead2'; g.fillRect(0, 0, w, h);
  /* 海图等深线 */
  g.strokeStyle = 'rgba(90,140,150,0.55)'; g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const cx = SR.rnd(60, w - 60), cy = SR.rnd(40, h - 40);
    g.beginPath();
    for (let a = 0; a <= SR.TAU + 0.1; a += 0.12) {
      const r = 24 + i * 13 + Math.sin(a * 3 + i) * 9;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.62;
      if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  /* 航线与标记 */
  g.strokeStyle = 'rgba(190,90,60,0.8)'; g.lineWidth = 2.5; g.setLineDash([8, 6]);
  g.beginPath(); g.moveTo(40, h - 50); g.lineTo(w - 60, 60); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#c85c3e';
  for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(SR.rnd(30, w - 30), SR.rnd(30, h - 30), 3.5, 0, SR.TAU); g.fill(); }
  g.strokeStyle = 'rgba(60,90,100,0.5)'; g.lineWidth = 1;
  g.strokeRect(6, 6, w - 12, h - 12);
  txt(g, '海図  № 12  沖磯', w / 2, h - 20, 20, '#5b6b64');
  grain(g, w, h, 1400, 'rgba(255,255,255,0.3)', 'rgba(100,90,60,0.25)');
});

tx.tideTable = () => tx.board({
  bg: '#f4efe0', color: '#4a5f5b', w: 320, h: 420,
  lines: ['潮汐表', '満  06:12', '干  12:38', '満  18:44', '干  00:56', '大潮'],
  fontSize: 30, weight: 'normal',
});

tx.radar = () => tx.make(256, 256, (g, w, h) => {
  g.fillStyle = '#0d2b2a'; g.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const grd = g.createRadialGradient(cx, cy, 4, cx, cy, w / 2);
  grd.addColorStop(0, 'rgba(80,220,170,0.55)'); grd.addColorStop(0.5, 'rgba(40,150,130,0.22)'); grd.addColorStop(1, 'rgba(10,50,50,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, w / 2, 0, SR.TAU); g.fill();
  g.strokeStyle = 'rgba(120,235,190,0.40)'; g.lineWidth = 1.5;
  for (let r = 28; r < w / 2; r += 28) { g.beginPath(); g.arc(cx, cy, r, 0, SR.TAU); g.stroke(); }
  g.beginPath(); g.moveTo(cx, 8); g.lineTo(cx, h - 8); g.moveTo(8, cy); g.lineTo(w - 8, cy); g.stroke();
  /* 扫描扇形 */
  const sg = g.createLinearGradient(cx, cy, w, cy);
  sg.addColorStop(0, 'rgba(150,255,205,0.55)'); sg.addColorStop(1, 'rgba(150,255,205,0)');
  g.fillStyle = sg; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, w / 2, -0.45, 0.05); g.closePath(); g.fill();
  /* 亮点 */
  g.fillStyle = '#b8ffd8';
  for (let i = 0; i < 14; i++) { const a = SR.rand() * SR.TAU, r = SR.rnd(20, w / 2 - 12); g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, SR.rnd(1.5, 3.5), 0, SR.TAU); g.fill(); }
});

tx.fishfinder = () => tx.make(256, 256, (g, w, h) => {
  g.fillStyle = '#132b3a'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(70,150,190,0.25)'; g.fillRect(0, 0, w, h * 0.35);
  for (let i = 0; i < 130; i++) {
    const y = SR.rnd(0, h);
    g.fillStyle = SR.rand() > 0.5 ? 'rgba(255,190,90,0.8)' : 'rgba(120,220,240,0.7)';
    g.fillRect(SR.rand() * w, y, SR.rnd(3, 16), SR.rnd(1, 3));
  }
  /* 鱼形弧线 */
  g.strokeStyle = 'rgba(255,205,110,0.9)'; g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const x = SR.rnd(20, w - 20), y = SR.rnd(h * 0.4, h - 20);
    g.beginPath(); g.arc(x, y, SR.rnd(10, 26), 0.2, 2.4); g.stroke();
  }
  g.strokeStyle = 'rgba(150,220,240,0.35)'; g.lineWidth = 1;
  for (let y = 0; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
});

tx.vending = () => tx.make(256, 512, (g, w, h) => {
  g.fillStyle = '#e8eee9'; g.fillRect(0, 0, w, h);
  /* 灯箱 */
  g.fillStyle = '#f7f4e2'; g.fillRect(14, 16, w - 28, h * 0.52);
  g.fillStyle = '#5b9fb5'; g.fillRect(14, 16, w - 28, 40);
  txt(g, '冷たい飲み物', w / 2, 36, 22, '#ffffff');
  /* 饮料罐阵列 */
  const cols = 4, rows = 5;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = 30 + c * 52, y = 76 + r * 38;
    g.fillStyle = SR.pick(['#d75b47', '#4a86ad', '#e0b64a', '#79a86a', '#e9e6dc', '#c96a3e']);
    g.fillRect(x, y, 26, 28);
    g.fillStyle = 'rgba(255,255,255,0.65)'; g.fillRect(x + 2, y + 3, 22, 5);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 2, y + 12, 22, 8);
  }
  /* 价格与按钮 */
  g.fillStyle = '#d9ded7'; g.fillRect(14, h * 0.62, w - 28, h * 0.14);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = '#c0c9c2'; g.beginPath(); g.arc(40 + i * 58, h * 0.68, 13, 0, SR.TAU); g.fill();
    g.fillStyle = '#6d7b76'; txt(g, '¥' + (120 + i * 10), 40 + i * 58, h * 0.68, 11, '#ffffff');
  }
  /* 取货口 */
  g.fillStyle = '#5c6b66'; g.fillRect(30, h * 0.82, w - 60, h * 0.12);
  g.fillStyle = '#3f4c48'; g.fillRect(38, h * 0.84, w - 76, h * 0.08);
  /* 锈迹与磨损 */
  stains(g, w, h, 26, ['#a5653d', '#c08a55', '#b0b8ae'], 3, 18, 0.28);
  grain(g, w, h, 2000, 'rgba(255,255,255,0.3)', 'rgba(80,80,70,0.3)');
});

tx.photo = () => tx.make(256, 192, (g, w, h) => {
  g.fillStyle = '#f3efe2'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#a9cfd2'; g.fillRect(8, 8, w - 16, h - 40);
  g.fillStyle = '#6fa4a8';
  g.beginPath(); g.moveTo(8, h * 0.62); g.lineTo(w / 3, h * 0.42); g.lineTo(w * 0.62, h * 0.66); g.lineTo(w - 8, h * 0.48); g.lineTo(w - 8, h - 32); g.lineTo(8, h - 32); g.fill();
  /* 一条大鱼（银色） */
  g.fillStyle = '#e8ece2';
  g.beginPath(); g.ellipse(w * 0.5, h * 0.45, 52, 16, -0.12, 0, SR.TAU); g.fill();
  g.beginPath(); g.moveTo(w * 0.5 + 48, h * 0.45); g.lineTo(w * 0.5 + 72, h * 0.34); g.lineTo(w * 0.5 + 72, h * 0.56); g.fill();
  txt(g, '大漁記念  令和六年', w / 2, h - 16, 17, '#5a625a');
  g.strokeStyle = 'rgba(90,90,80,0.4)'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
});

tx.omamori = () => tx.make(128, 192, (g, w, h) => {
  g.fillStyle = '#d8544c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8c976'; g.fillRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#c8463f'; g.fillRect(18, 18, w - 36, h - 36);
  txt(g, '安全', w / 2, h * 0.42, 38, '#f6e7bd', 'center', SERIF, 'bold');
  txt(g, '大漁', w / 2, h * 0.68, 30, '#f6e7bd', 'center', SERIF, 'bold');
  g.strokeStyle = '#f0d68d'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
});

tx.buoyNumber = (n) => tx.make(256, 128, (g, w, h) => {
  g.fillStyle = '#e7c15a'; g.fillRect(0, 0, w, h);
  stains(g, w, h, 22, ['#c9a95a', '#f0d98a', '#b09a62'], 4, 20, 0.4);
  txt(g, String(n), w / 2, h / 2, 78, '#3b4b49', 'center', FONT, 'bold');
  grain(g, w, h, 1200, 'rgba(255,255,255,0.3)', 'rgba(80,70,50,0.3)');
});

tx.boatName = (name) => tx.make(512, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  txt(g, name, w / 2, h / 2, 68, '#4d6f74', 'center', FONT, 'bold');
});

tx.clockFace = () => tx.make(256, 256, (g, w, h) => {
  g.fillStyle = '#f2efe1'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6, 0, SR.TAU); g.fill();
  g.strokeStyle = '#6c7a73'; g.lineWidth = 7; g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * SR.TAU - SR.PI / 2;
    g.strokeStyle = '#4d5b54'; g.lineWidth = i % 3 === 0 ? 5 : 2;
    g.beginPath();
    g.moveTo(w / 2 + Math.cos(a) * (w / 2 - 22), h / 2 + Math.sin(a) * (h / 2 - 22));
    g.lineTo(w / 2 + Math.cos(a) * (w / 2 - 34), h / 2 + Math.sin(a) * (h / 2 - 34));
    g.stroke();
  }
  g.strokeStyle = '#3d4b46'; g.lineCap = 'round';
  g.lineWidth = 7; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 34, h / 2 - 44); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 - 52, h / 2 - 12); g.stroke();
  g.fillStyle = '#c2544a'; g.beginPath(); g.arc(w / 2, h / 2, 7, 0, SR.TAU); g.fill();
});

tx.label = (text, bg, fg, fs) => tx.make(256, 96, (g, w, h) => {
  g.fillStyle = bg || '#e9e5d4'; g.fillRect(0, 0, w, h);
  txt(g, text, w / 2, h / 2, fs || 40, fg || '#40544f', 'center', FONT, 'bold');
  g.strokeStyle = 'rgba(90,100,90,0.4)'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
});

tx.rainbow = () => tx.make(512, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const bands = ['rgba(232,110,96,0.5)', 'rgba(240,180,90,0.5)', 'rgba(240,225,120,0.5)',
    'rgba(150,210,150,0.5)', 'rgba(130,190,225,0.5)', 'rgba(160,150,215,0.5)'];
  for (let i = 0; i < bands.length; i++) {
    g.strokeStyle = bands[i]; g.lineWidth = 10;
    g.beginPath(); g.arc(w / 2, h, 150 + i * 13, SR.PI, SR.TAU); g.stroke();
  }
});

tx.windowLight = () => tx.make(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, 'rgba(255,240,190,0.55)');
  grd.addColorStop(1, 'rgba(255,235,180,0.05)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

tx.flag = () => tx.make(256, 128, (g, w, h) => {
  g.fillStyle = '#e8765a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2eee0'; g.beginPath(); g.arc(w * 0.5, h * 0.5, 36, 0, SR.TAU); g.fill();
  txt(g, '港', w / 2, h - 22, 24, '#c8564a');
  stains(g, w, h, 14, ['#c9b8a0', '#f2e6d2'], 4, 18, 0.3);
});

})();
